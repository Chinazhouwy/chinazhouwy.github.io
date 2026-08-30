---
title: "synchronized 锁升级全过程：偏向锁→轻量级锁→重量级锁的 JVM 级细节"
date: "2026-08-28"
domain: "学习"
area: "Java 后端"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "synchronized 锁升级的 JVM 级解析：对象头 Mark Word 位布局、偏向锁撤销机制、轻量级锁 CAS 自旋、ObjectMonitor 膨胀与 wait/notify，附 HotSpot 源码、调优参数与实战验证方法。"
tags:
  - Java
  - JVM
  - 并发
  - synchronized
  - 锁升级
---

# synchronized 锁升级全过程：偏向锁→轻量级锁→重量级锁的 JVM 级细节

> 来源：微信公众号文章（技术分享）
> 链接：<https://mp.weixin.qq.com/s/TMub0BJB91PVf2Po-RMi9g>
> 类型：📚 技术文章（非面经）—— synchronized 锁升级的 JVM 实现细节
> 整理时间：2026-08-28

## 一、对象头与 Mark Word：一切的起点

synchronized 的底层实现依赖对象头中的 Mark Word。在 64 位 JVM 中（开启压缩指针），对象头占 12 字节：

- **Mark Word（8 bytes）**：`lock:2 | biased_lock:1 | age:4 | identity_hashcode:31` 等位域（不同状态下位域含义不同）
- **Klass Word（4 bytes）**：类型指针
- **Array Length（4 bytes）**：数组长度（仅数组对象）

Mark Word 在不同状态下的 bit 布局：

| 状态 | lock | biased_lock | age | identity_hashcode |
|---|---|---|---|---|
| 无锁 | 01 | 0 | 000 | hashcode |
| 偏向锁 | 01 | 1 | age | threadId |
| 轻量级锁 | 00 | 0 | age | ptr(Lock Record) |
| 重量级锁 | 10 | 0 | age | ptr(ObjectMonitor) |
| GC 标记 | 11 | 0 | age | 0 |

关键理解：

- `lock` 只占两位：01 = 无锁/偏向锁，00 = 轻量级锁，10 = 重量级锁
- `biased_lock` 标记是否为偏向锁
- `age` 在偏向锁中存储偏向时间戳，在轻量级锁中存储自旋次数
- `identity_hashcode` 字段随状态复用：无锁存 hashcode → 偏向锁存 threadId → 轻量级锁存栈上 Lock Record 指针 → 重量级锁存 ObjectMonitor 指针

## 二、偏向锁：一次 CAS 解决大多数场景

**原理假设**：锁在大多数情况下由同一个线程多次获取（约占锁操作的 60-70%）。

第一次获取时，JVM 用 CAS 把 Mark Word 中的 threadId 改为当前线程 ID（HotSpot `biasedlocking.cpp` 的 `revoke_and_rebias`）；之后加锁/解锁只需一次 threadId 比较——无 CAS、无系统调用，快到飞起。

**撤销（Revoke）**：另一个线程尝试获取时触发。过程：暂停持有线程（Safepoint）→ 检查持有线程是否仍在同步块内：

- 已退出：直接 CAS 改 threadId 为 B（重新偏向 B）
- 仍在运行：升级为轻量级锁（A 栈上创建 Lock Record，B 自旋）

**批量撤销优化（JDK 6+）**：`bulk_revoke_at_safepoint()` 遍历 Thread 的 bias_map 一次性批量撤销，减少 Safepoint 次数。

**偏向延迟启动**：`-XX:BiasedLockingStartupDelay=4000`（默认 4 秒后启用）。原因：JVM 启动时类加载过程有大量锁竞争，偏向锁反而浪费，等应用稳定后再开启。

## 三、轻量级锁：CAS 自旋，不阻塞线程

**加锁过程**：

1. 在当前线程栈帧中创建 Lock Record
2. 把 Mark Word 复制到 Lock Record 的 Displaced Mark Word
3. CAS 把对象头 Mark Word 替换为指向 Lock Record 的指针

**解锁过程**：CAS 把 Mark Word 从 Lock Record 指针改回 Displaced Mark Word；CAS 失败说明有其他线程竞争 → 膨胀为重量级锁。

**自旋机制**：CAS 失败时线程不立即阻塞而是自旋，每次自旋前检查 Mark Word 是否已被释放；自旋次数耗尽才膨胀。JDK 6+ 自适应自旋：上次自旋成功则增加次数，失败则减少。

> 注意区分：spin lock 是"忙等"浪费 CPU；JVM 自旋是"尝试 CAS + sleep 交替"，有退让机制。

## 四、重量级锁：ObjectMonitor 与操作系统互斥量

每个对象膨胀为重量级锁时关联一个 ObjectMonitor（`objectMonitor.hpp`）：

```cpp
class ObjectMonitor : public CHeapObj<mtInternal> {
  volatile int  _header;        // 锁状态 + 线程ID
  void*         _object;        // 关联的Java对象
  oop           _owner;         // 持有锁的线程
  int           _EntryList;     // 阻塞等待线程数
  int           _WaitSet;       // wait()线程数
  ObjectWaiter* _WaitSetList;   // wait队列
};
```

**膨胀流程**：轻量级锁 CAS 失败 → `inflate()` 创建 ObjectMonitor → CAS 设置 Mark Word 指向它。

**enter 核心操作**：

- `TryLock`：CAS 把 _owner 从 null 设为当前线程
- `park`：调用 os::ParkEvent，底层是 Linux 的 futex 或 Windows 的 WaitForSingleObject
- `unpark`：唤醒被 park 的线程

**wait/notify 机制**：

- `wait()`：从 EntryList 移到 WaitSet，释放锁（owner=NULL），park 挂起；被唤醒后重新入 EntryList 抢锁
- `notify()`：从 WaitSet 移回 EntryList，unpark 唤醒

## 五、锁降级

- 重量级锁释放时若 `_EntryList` 为空（无竞争）→ 降级为无锁（Mark Word 恢复 prototype）
- 轻量级锁解锁成功 → 恢复无锁 → 后续获取时可再尝试偏向（若开启且延迟期已过）

**注意**：锁降级只能逐级进行，不能跳级（重量级不能直接到偏向，中间必须经过轻量级/无锁状态）。

## 六、完整升级路径

```
[无锁] --CAS成功--> [偏向锁] --竞争--> [轻量级锁] --自旋失败--> [重量级锁]
   ↑                  │ 撤销成功(重新偏向)                        │
   │                  ↓                                          │
   │            [偏向锁(新线程)]                            释放无竞争↓
   └──────────────────────────────────────────────────────────┘
             (降级：重量级→轻量级→无锁→偏向)
```

## 七、JVM 参数调优

| 参数 | 作用 |
|---|---|
| `-XX:+UseBiasedLocking` | 开启偏向锁（默认开启） |
| `-XX:BiasedLockingStartupDelay=4000` | 偏向锁延迟启动（ms） |
| `-XX:BiasedLockingBulkRebiasThreshold=20` | 批量重偏向阈值 |
| `-XX:BiasedLockingBulkRevokeThreshold=40` | 批量撤销阈值（达到后标记不可偏向） |
| `-XX:-UseBiasedLocking` | 关闭偏向锁（高竞争场景） |
| `-XX:PreBlockSpin=10` | 自旋次数（JDK 6 前） |
| `-XX:+UseAdaptiveSizePolicy` | 自适应自旋（JDK 6+ 默认开启，间接影响自旋策略） |

## 八、实战验证：如何观察锁状态

1. **jcmd**：`jcmd <pid> Thread.print`、`jcmd <pid> VM.flags | grep Biased`
2. **JFR**：`java -XX:+FlightRecorder -XX:StartFlightRecording=duration=60s,filename=lock.jfr MyApp`，用 JMC 看 Lock Instance Events
3. **代码验证**：线程 t1 先持有锁 2s（进入偏向），t2 竞争触发撤销+升级；JFR 中可见 t1 的 `biased_lock` 事件、t2 的 `biased_lock_revoke + fast_enter`

## 九、性能瓶颈分析与优化建议

1. **避免锁内耗时操作**（反模式：锁内 sleep/网络 IO → 其他线程竞争 → 升级）。优化：先做 IO 再缩小同步范围，只锁必要的写操作
2. **锁粗化**：JVM 自动合并连续的 synchronized 块（JIT 编译时进行，不是始终有效）
3. **减少锁竞争**：全局锁 → 分段锁（`locks[id % 16]`，ConcurrentHashMap 思路）
4. **偏向锁失效场景**（考虑关闭）：线程池线程频繁竞争同一对象、锁持有时间极短且线程切换频繁、大量短生命周期对象作锁

## 十、与其他锁机制对比

| 维度 | synchronized | ReentrantLock |
|---|---|---|
| 底层 | ObjectMonitor（JVM C++ 实现） | AQS（Java 实现） |
| 锁升级 | 偏向→轻量→重量（自动） | 无升级机制 |
| 可中断 | 不支持 | lockInterruptibly() 支持 |
| 公平锁 | 非公平（JVM 内部实现） | 可选公平/非公平 |
| 条件变量 | 一个（wait/notify） | 多个 Condition |
| 性能（低竞争） | 偏向锁极快 | 需要 AQS 入队 |
| 性能（高竞争） | Monitor park 开销大 | AQS 自旋 + park |
| 颗粒度 | 对象级别 | 代码块级别 |

## 十一、JVM 为什么这样设计

- **偏向锁**：覆盖大多数单线程场景（约占锁操作 60-70%），一次 CAS + 一次比较，几乎零开销
- **轻量级锁**：覆盖低竞争多线程场景，自旋避免线程切换，CAS 失败才 park
- **重量级锁**：高竞争场景兜底，用操作系统 mutex 保证公平性，代价是线程挂起/唤醒的内核态切换

本质是**渐进式优化**：从最快但最脆弱（偏向）到最慢但最可靠（重量级），JVM 根据运行时数据动态选择。我们要做的不是控制升级，而是通过代码结构减少竞争，让 JVM 停留在低成本的锁状态。

---

## 复习要点

- 锁升级路径：无锁 → 偏向锁 → 轻量级锁 → 重量级锁（单向为主，可逐级降级）
- Mark Word 状态位：lock 两位（01/00/10）、biased_lock 一位
- 偏向锁撤销需要 Safepoint；批量撤销/重偏向有阈值参数
- 轻量级锁 = 栈上 Lock Record + Displaced Mark Word + CAS；失败自旋，自旋耗尽膨胀
- 重量级锁 = ObjectMonitor + futex park/unpark；wait 进 WaitSet，notify 回 EntryList
- 面试高频追问：为什么不能跳级降级？偏向锁为什么延迟启动？自旋和 spin lock 的区别？
