---
title: "面试手册深挖 05 · ConcurrentHashMap 读写、扩容（Q21）"
date: "2026-10-06"
updated: "2026-10-06"
domain: "专栏"
area: "技术"
module: "面试手册深挖"
project: ""
type: "文章"
status: "可复习"
priority: "P0"
energy: "medium"
visibility: "public"
summary: "《Java × Agent 四天面试手册》Q21 解释版原文 + 会话深挖：compute/computeIfAbsent 家族的执行流程与分支矩阵、ForwardingNode 哨兵节点、扩容协助。"
tags:
  - Java
  - ConcurrentHashMap
  - 并发
---

# 面试手册深挖 05 · ConcurrentHashMap 读写、扩容（Q21）

> 第一部分完整收录手册解释版 Q21 原文；第二部分是 2026-10-06 会话深挖：compute 方法家族的执行流程、ForwardingNode 的位级解释。

## 一、手册原文（解释版）

### ① JDK 8 把写竞争限制在桶附近

空桶安装首节点通常通过比较并交换，即 CAS，只有一个线程能成功建立入口；失败者重读。非空桶写入通常同步桶头，并重新确认它仍是当前桶头，再在链或树内更新。不同桶可并行处理，不是把整张表锁住；树桶还有专门协调逻辑。JDK 7 的 Segment 分段锁模型不能直接用来解释 8。

### ② 读为何通常不拿写入的桶锁

表槽访问以及节点的关键字段提供所需可见性，读者能沿已经安全发布的链接读取。仅说 table 是 volatile 不够：volatile 数组引用保证的是引用的读写，不会自动让每个数组槽变成 volatile。实现必须对槽位使用相应的原子或有序访问，并为节点值、链接等安排可见性。通常不获取该桶的写锁，不等于"任何路径都绝不等待"。

### ③ 扩容可以让多个线程协作

教学例：旧桶已搬到新表，旧槽放 ForwardingNode，读者遇到它转向新表，写线程也可能加入搬迁。sizeCtl 在初始化、正常阈值和扩容阶段承担不同控制含义，不能永远解释成容量。元素计数为降低竞争可分散累加；并发时 size 只能作为观察统计。比如刚看到 size 为 10，再遍历不保证正好取得同一组十条记录；跨键结算不能靠 size 和一次遍历拼出事务快照。

### 60–90 秒口述（手册版）

JDK 8 的 ConcurrentHashMap 空桶常用 CAS 安装，非空桶写入在桶头附近同步并重新检查，减少不同桶之间的竞争。读依靠表槽和节点的可见性机制通常不拿写锁，不能只用 table 引用是 volatile 来解释元素可见性。扩容用转发节点指向新表，并允许其他线程协助转移。size 是并发统计，读写安全也不意味着多键操作具有事务快照。

### 手册追问

- 为什么锁住桶头后还要重检查？等待锁时桶可能已经搬迁或替换，不能在过时结构上继续写。
- 遍历会抛 fail-fast 异常吗？其迭代是弱一致观察，可见部分并发更新，不承诺固定时点快照。

## 二、深挖补充（2026-10-06 会话笔记）

### 2.1 compute 方法家族：一个骨架的五种变体

JDK 8 给 Map 加的这组方法，骨架都是四步：**查旧值 → 判断条件 →（可能）调回调 → 写结果**，区别只在中间两步。统一判断矩阵：

| 方法 | 键不存在时 | 键存在时 | 回调返回 null 的含义 |
|---|---|---|---|
| `compute` | 调回调（oldValue=null），结果非 null 就插入 | 调回调，非 null 覆盖 | **删除该键** |
| `computeIfAbsent` | 调回调，非 null 插入 | **不调回调**，返回旧值 | 不插入（等于没存过） |
| `computeIfPresent` | 不调回调，返回 null | 调回调，非 null 覆盖 | **删除该键** |
| `merge` | 不调回调，直接放传入 value | 调回调(旧值, 新值) | **删除该键** |
| `putIfAbsent` | 直接放 value | 不放，返回旧值 | （无回调） |

两个易踩差异：compute 系回调参数是 (key, 旧值)，merge 是 (旧值, 新传入值)，顺序不同；putIfAbsent 返回旧值，compute 系返回该键最终新值。在 HashMap 上这些方法仍是两步（get+put）**不原子**——原子性是 CHM 重写后塞进桶锁的结果，"用了 computeIfAbsent 就线程安全"必须先问是什么 Map。

### 2.2 compute 在 CHM 里的执行流程

```
1. 算 hash，定位桶
2. 桶为空 → CAS 放占位节点（ReservationNode，因为值要等回调跑完才知道），
   锁占位节点，跑回调，换成真节点
3. 桶头是 ForwardingNode → 正在扩容，先帮忙搬数据，回头重试
4. 桶头是普通节点 → synchronized(桶头)，锁内重新在链/树上找一遍该键
   （防止锁上前被改），拿到旧值 → 跑回调 → 写回结果
5. addCount 更新 size（分散计数）
```

这就是 Q21 答案"空桶常 CAS 安装，非空桶同步桶头并重新检查"的执行流。整个"查→算→写"在锁内完成，所以单键读改写原子；**但换一个键的第二次 compute 就在另一把桶锁里**——这就是 Q22"单次原子边界"的物理来源。

回调约束（Q22②的展开）：回调持桶锁执行，必须**短**（查库/RPC 会阻塞同桶所有线程）、**可重算**（返回 null 不建映射、抛异常不留结果、刚算完被删都会导致回调再跑一遍，副作用必须可重复）、**不递归**（回调里再 compute 同 Map 可能死锁，JDK 9+ 抛 IllegalStateException: Recursive update）。

### 2.3 ForwardingNode：扩容期的哨兵节点

```java
static final int MOVED = -1;   // 特殊 hash 值
static final class ForwardingNode<K,V> extends Node<K,V> {
    final Node<K,V>[] nextTable;   // 指向扩容后的新表
    // hash = MOVED(-1)，没有 key、没有 value
}
```

本质是**墓碑 + 转发指针**。扩容把旧表桶逐个搬到 2 倍新表，搬完的旧槽不能放 null（并发读会误判"键不存在"），所以放 ForwardingNode。撞上它时：

- **读**：顺着它持有的 nextTable 引用到新表找（ForwardingNode.find()），全程无锁、不阻塞、不重试
- **写**：这个桶写不进去了；线程检查 sizeCtl 发现扩容还在进行，就**加入搬桶大军**（经 transferIndex 认领一段桶区间），搬完在新表重试——"把等待变成帮忙"

sizeCtl 是状态机：正数=阈值，-1=初始化中，其他负数（带扩容戳）=扩容中+参与线程数。

配套追问：**扩容时桶怎么搬**——按新掩码多出的那一位把桶拆成 lo（0，留原位）/hi（1，搬 +16）两条链，与 Q18 的"只查一位"是同一算法。**get 为什么不加锁**——Node 的 val 和 next 是 volatile，靠可见性遍历。

## 三、与其他题的连线

- Q22：本文 2.2 的"另一把桶锁"就是 Q22"多键无事务"的物理来源。
- Q18：扩容拆 lo/hi 与 HashMap"只查一位"同源；CHM 禁 null 键值 vs HashMap 允许 null，一组对仗。
- Q17：CHM 迭代是弱一致、不抛 fail-fast——它不靠 modCount 账本，定位就是容忍并发演进。
