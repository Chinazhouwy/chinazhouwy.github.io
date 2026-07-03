# 第18题：ConcurrentHashMap 底层实现（JDK1.7/1.8）

> **方向**：后端·并发集合
> **练习日期**：2026-06-06
> **来源**：active-batch-plan.md 计划题

---

## 题目

ConcurrentHashMap 在 JDK 1.7 和 1.8 中的实现有什么区别？锁的粒度是怎样的？size() 为什么用 LongAdder 思想？扩容机制是什么？

---

## 核心概念

### 一、JDK 1.7：Segment 分段锁

```
ConcurrentHashMap
  └─ Segment[] segments（默认16个）
       └─ Segment 继承 ReentrantLock（可重入锁）
            └─ HashEntry[] table（存数据的数组）
                 └─ HashEntry 链表
```

**put 流程：**
1. 先定位到哪个 Segment（hash >>> segmentShift & segmentMask）
2. 对该 Segment 加锁（只锁一小段，不锁整个 map）
3. 在 Segment 内部的 table 里找桶位，遍历链表
4. 找到 key → 覆盖；没找到 → 头插法追加
5. 释放锁

**核心思想：**
- 整个 map = 16 个小 HashMap，每个各自加锁
- 不同 Segment 之间完全并行，并发度 = Segment 数量
- 缺点：Segment 数组创建后不能扩容，并发度被锁死

### 二、JDK 1.8：CAS + synchronized 锁单个桶

```
ConcurrentHashMap 1.8
  └─ Node<K,V>[] table（和 HashMap 一样的桶数组）
       ├─ Node（链表节点）
       └─ TreeNode（红黑树节点）
  // 锁粒度：单个桶（table 的一个槽位）
```

**put 流程：**
1. table 为空 → CAS 初始化（initTable）
2. 桶位置为空 → CAS 直接放入（无锁）
3. 正在扩容（hash == MOVED = -1）→ 帮忙迁移（helpTransfer）
4. 桶不为空 → synchronized 锁桶的头节点，链表尾插法追加
5. size 增加 → addCount()，用 CounterCell 数组（LongAdder 思想）

**锁机制总结：**

| 场景 | 锁的方式 |
|------|----------|
| 桶为空 | CAS（无锁） |
| 桶不为空（链表） | synchronized 桶头节点 |
| 桶不为空（红黑树） | synchronized 根节点 |
| size 增加 | CAS（CounterCell 数组） |
| table 初始化 | CAS |
| table 扩容 | 多线程协作迁移 |

### 三、LongAdder 思想（CounterCell 数组）

**问题：AtomicInteger 高并发下 CAS 失败率极高**

```
100 个线程同时 CAS baseCount → 90+ 次失败重试 → 变成串行
```

**LongAdder 做法：拆成多个 Cell，竞争分散**

```
CounterCell[] 数组（初始长度 = CPU核心数）

每个线程来 +1：
  1. 用线程ID hash 选一个 Cell
  2. CAS 更新自己那个 Cell（不同线程不冲突）
  3. 搞定

线程1 → CAS Cell[0] ✓
线程2 → CAS Cell[3] ✓   ← 互不干扰
线程3 → CAS Cell[7] ✓
```

**sum() 计算：**

```java
sum = baseCount + Cell[0] + Cell[1] + ... + Cell[n]
```

**Cell 满了怎么办？**

- Cell 不是链表，就是一个 `long value`，没有"满"的概念
- CAS 失败 → 扩容 Cell[] 数组（16→32→64→...），重新散列
- 核心思想：宁可 sum() 慢一点（加法），也不能让写入（put）互相等待

**size() 不精确的原因和接受理由：**
- 写入是热点（put 可能每秒几十万次），size() 只是偶尔查
- 即使精确，读到的那一刻就过期了（其他线程可能刚改）
- 大部分场景只需要"大概知道有多少"（判断空、阈值告警、容量预估）
- 需要精确的场景（扣钱、库存）靠事务和锁，不靠 size()

### 四、扩容 — 多线程协作迁移

**1.7：** Segment 内部可扩，但 Segment 数量固定

**1.8：**
1. 一个线程发现需要扩容 → 创建新数组 nextTab
2. 设定 stride（每线程迁移的桶数，最少16个）
3. 在旧数组上标记 MOVED 节点（hash=-1）表示已迁移
4. 其他线程读到 MOVED → 帮忙迁移自己领到的那段桶
5. 所有线程迁移完 → 替换 table = nextTab

**MOVED 节点作用：**
- 迁移后旧位置放 Node(hash=-1) 标记
- 任何线程读到 hash=-1 → 知道这个桶已迁移走 → 去新数组找
- 类似 Work-Stealing 的分工流水线，但更像"协作分区"，不需要抢

### 五、get 操作不需要加锁

Node 的 val 和 next 都用 `volatile` 修饰，保证可见性。put 时用 synchronized + volatile 写，get 直接读。

### 六、不允许 null key/value

HashMap 里 null key 表示"没有找到"返回 null。ConcurrentHashMap 用 null 来标记"桶为空"，如果允许 null value，get() 返回 null 时分不清是"没有这个 key"还是"value 就是 null"。

---

## JDK 1.7 vs 1.8 对比表

| 维度 | JDK 1.7 | JDK 1.8 |
|------|---------|---------|
| 数据结构 | Segment + HashEntry[] + 链表 | Node[] + 链表 + 红黑树 |
| 锁 | Segment（继承 ReentrantLock） | synchronized 桶头节点 + CAS |
| 锁粒度 | Segment（默认16个） | 单个桶 |
| 并发度 | 恒定（= Segment 数量） | 桶数量（可以很大） |
| 插入方式 | 头插法 | 尾插法 |
| null key/value | 不允许 | 不允许 |
| size() | 遍历所有 Segment 的 count（不精确） | CounterCell（类似 LongAdder） |
| 扩容 | Segment 内部扩，Segment 数量不变 | 多线程协作迁移 |

---

## 面试高频追问

| 追问 | 答案要点 |
|------|----------|
| **为什么 1.8 不用分段锁了？** | Segment 锁粒度太粗，并发度被锁死。synchronized 在 JDK 1.8 已优化到偏向锁/轻量级锁，锁单个桶性能已经很好 |
| **1.8 put 有没有锁竞争？** | 大概率没有——桶空时 CAS 无锁；桶不空时 synchronized 锁单个桶，不同桶完全并行 |
| **get 操作需要加锁吗？** | 不需要。val 和 next 用 volatile 修饰，保证可见性 |
| **为什么不允许 null key/value？** | 分不清"没有这个 key"还是"value 就是 null" |
| **size() 为什么不用 AtomicInteger？** | 高并发下 CAS 失败率太高。CounterCell 把竞争分散，类似 LongAdder |
| **和 Work-Stealing 有什么区别？** | Work-Stealing 是从别人的队列偷任务；ConcurrentHashMap 扩容是分工流水线，桶已经被切好，各领一段，不需要抢 |

---

## 本次讨论收获

- ConcurrentHashMap 1.7 = 多个小 HashMap 分段锁，1.8 = 单个 HashMap 锁单个桶
- LongAdder 思想：CAS 失败就换一个 Cell，用空间换并发度
- Cell 不是链表，就是一个 long，满了就扩容数组重新散列
- size() 不精确但够用：读到的那一刻就过期了，精确没意义
- 扩容类似 Work-Stealing 但更像分工流水线
