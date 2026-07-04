# 第26题：volatile、synchronized、CAS 和 JMM 的关系

> 日期：2026-06-09
> 来源：《唯品会Java一面面经》、《腾讯云终面》、《拼多多Java一面并发》
> 方向：Java 并发

---

## 得分：3.5/10

---

## 核心概念

### 1. JMM（Java Memory Model，Java 内存模型）

- 一套规范，定义线程之间如何通过内存交互
- 核心模型：**主内存**（Main Memory）和**工作内存**（Working Memory）
- 每个线程有自己的工作内存，操作变量必须先 copy 到工作内存，改完再 flush 回主内存
- 产生**可见性**问题：线程A改了变量，线程B可能还在读自己工作内存里的旧值

**八大原子操作：**

| 操作 | 作用 |
|------|------|
| lock | 把变量标记为线程独占 |
| unlock | 释放锁定的变量 |
| read | 从主内存读取变量值 |
| load | 把 read 的值放到工作内存 |
| use | 把工作内存的值传给执行引擎 |
| assign | 执行引擎的值写回工作内存 |
| store | 把工作内存的值送到主内存 |
| write | 把 store 的值正式写入主内存 |

**happens-before（先行发生）规则：**
- 程序顺序规则：同一个线程内，前面的操作 happens-before 后面的
- volatile 变量规则：volatile 写 happens-before 后续的 volatile 读
- 锁规则：unlock happens-before 后续的 lock
- 传递性：A happens-before B，B happens-before C → A happens-before C

---

### 2. volatile — 可见性 + 有序性

**保证两件事：**

① **可见性**
- 写 volatile 变量时：JMM 强制把工作内存的值 flush 到主内存
- 读 volatile 变量时：JMM 强制 invalidate 工作内存的缓存，从主内存重新 read

② **有序性（禁止重排）**
- 通过内存屏障（Memory Barrier）实现
- 写之前插入 StoreStore 屏障：保证前面的写不会重排到 volatile 写之后
- 写之后插入 StoreLoad 屏障：保证 volatile 写不会重排到后面的读之后
- 读之前插入 LoadLoad 屏障：保证前面的读不会重排到 volatile 读之后
- 读之后插入 LoadStore 屏障：保证 volatile 读不会重排到后面的写之后
- 四种屏障是最小化约束，只禁止真正可能导致问题的重排，开销更小

**不保证的事：原子性**
- `volatile int i; i++` 不安全，`i++` 是 read-modify-write 复合操作

---

### 3. synchronized — 原子性 + 可见性 + 有序性

**底层实现：**
- 编译后变成 monitorenter 和 monitorexit 两条字节码指令
- 关联一个 Monitor 对象，包含 owner（持有者）和 entrylist（等待队列）

**可见性保证：**
- 加锁时：JMM 清空工作内存，从主内存重新 load
- 解锁时：JMM 把工作内存的修改 flush 到主内存

**锁升级（膨胀）过程：**

| 阶段 | 场景 | 实现 | 代价 |
|------|------|------|------|
| 偏向锁 | 一个线程反复进出 | 比较线程 ID | 几乎为零 |
| 轻量级锁 | 几个线程交替执行 | CAS + 自旋 | 消耗一点 CPU |
| 重量级锁 | 真正的并发竞争 | OS Mutex 阻塞 | 上下文切换，最重 |

**锁升级细节：**

1. **无锁 → 偏向锁**：第一个线程进入，JVM 在对象头（Mark Word）记录线程 ID
2. **偏向锁 → 轻量级锁**：第二个线程来了，撤销偏向锁，线程在自己栈帧创建 Lock Record，CAS 把 Lock Record 地址写入对象头
3. **轻量级锁 → 重量级锁**：自旋超过次数，调用 OS Mutex，线程阻塞挂起

**Lock Record 解释：**
- 线程执行 synchronized 时，在自己栈帧里创建的一小块"凭证"
- 包含 Displaced Mark Word（对象头原始值的备份）+ 指向锁对象的引用
- CAS 成功 = 拿到锁，对象头指向这个 Lock Record
- 解锁时把 Displaced Mark Word CAS 写回对象头，恢复原状
- 两个线程争抢的是对象头 Mark Word 这个公共位置，CAS 保证原子性

**偏向锁撤销的 STW 问题：**
- 撤销需要等持有偏向锁的线程到安全点（Safe Point）暂停
- 不是同一个锁反复撤销，是大量不同锁对象各自经历"偏向→撤销"过程
- 每次撤销都要 STW，总量加起来很大
- JDK 15 默认关闭偏向锁，维护成本 > 收益

**synchronized 是非公平锁：**
- 有等待队列（EntryList）≠ 公平锁
- 锁释放后从 EntryList 随机选一个线程竞争，新来线程也可插队抢

---

### 4. CAS（Compare And Swap，比较并交换）

- CPU 级别的原子指令（x86 是 cmpxchg）
- 三个操作数：内存值 V、旧的预期值 A、要写入的新值 B
- 逻辑：`if (V == A) { V = B; }`，整个过程是原子的
- AtomicXxx 类 = volatile 变量 + CAS 操作
- CAS 需要配合 volatile 保证可见性

**ABA 问题：**
- 值从 A→B→A，CAS 认为没变过
- 解决：AtomicStampedReference（带版本号的引用）

---

### 5. 三者的关系

| 特性 | volatile | synchronized | CAS |
|------|---------|-------------|-----|
| 原子性 | ❌ | ✅ | ✅（单变量） |
| 可见性 | ✅ | ✅ | 需配合 volatile |
| 有序性 | ✅（屏障） | ✅（锁内串行） | ❌ |
| 阻塞 | ❌ | ✅ | ❌ |

---

## 用户追问+纠正记录

1. **用户追问锁升级"无锁膨胀到轻量锁"是什么意思** → 解释了 CAS 写入 Lock Record 的过程，JVM 自动执行
2. **用户追问"偏向锁反复撤销"** → 纠正：不是同一个锁反复撤销，是大量不同锁对象各自经历偏向→撤销过程，每次 STW
3. **用户追问 CAS 为什么要用，第一次有人竞争吗** → 解释：CAS 不是因为确定有人竞争，而是确保不管有没有竞争都安全
4. **用户追问 Lock Record 具体是什么** → 解释：线程栈帧里的凭证，包含 Displaced Mark Word（备份）+ 指向锁对象的引用
5. **用户追问 StoreStore 等四种屏障** → 解释：读和写是两个方向，每个方向各需要两个屏障，是最小化约束
6. **用户追问 synchronized 有等待队列所以是公平锁？** → 纠正：有队列 ≠ 公平锁，synchronized 是非公平的，从队列随机选线程
7. **用户追问 CAS 写入 Lock Record 地址时有没有竞争** → 解释：可能有也可能没有，CAS 保证不管有没有竞争都安全
8. **用户追问 A 和 B 是不同线程，Lock Record 在各自栈里怎么争抢** → 解释：争抢的是对象头 Mark Word 这个公共位置，CAS 保证原子性

---

## 最终结论

- volatile 保证可见性+有序性，不保证原子性
- synchronized 保证三大特性全保，底层有锁升级过程
- CAS 是乐观锁实现，需要配合 volatile
- JMM 是这三者的框架，先讲 JMM 再讲三个概念

---

## 这次讨论的收获

1. 知道每个概念的定义，但没串到 JMM 框架里
2. Lock Record、锁升级、偏向锁撤销 STW 是深入理解的关键
3. CAS 的原子性是 CPU 级别保证的，不是 Java 层面
4. 四种内存屏障是最小化约束，不是"统一屏障"
