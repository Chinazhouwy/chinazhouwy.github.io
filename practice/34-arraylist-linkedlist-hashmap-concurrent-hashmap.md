---
schema_version: 1
question_id: 34
question: "ArrayList、LinkedList、HashMap、ConcurrentHashMap 如何选"
date: 2026-06-14
sources:
  - middleware/vipshop-java-interview.md
  - java/meitu-backend-server-round1.md
  - java/megvii-java-round1-12-questions.md
score: "5/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
# 第 34 题：ArrayList、LinkedList、HashMap、ConcurrentHashMap 如何选

> **得分：5 / 10**
> **来源：** `middleware/vipshop-java-interview.md`、`java/meitu-backend-server-round1.md`、`java/megvii-java-round1-12-questions.md`

---

## 核心概念

### 一、底层数据结构

| 集合 | 底层结构 | 扩容机制 |
|------|----------|----------|
| **ArrayList** | Object[] 数组 | 1.5倍扩容（oldCapacity + oldCapacity >> 1） |
| **LinkedList** | 双向链表 | 无需扩容，每次新增创建新节点 |
| **HashMap** | 数组 + 链表 + 红黑树 | 2倍扩容，链表长度>8且数组长度≥64时转红黑树 |
| **ConcurrentHashMap** | 同 HashMap，但线程安全 | JDK7: 分段锁；JDK8: CAS + synchronized |

### 二、性能对比

| 操作 | ArrayList | LinkedList | HashMap | ConcurrentHashMap |
|------|-----------|------------|---------|-------------------|
| **随机读** | O(1) | O(n) | O(1) | O(1) |
| **尾部插入** | O(1)均摊 | O(1) | O(1)均摊 | O(1)均摊 |
| **中间插入** | O(n) | O(1)已知节点 | O(1) | O(1) |
| **删除** | O(n) | O(1)已知节点 | O(1) | O(1) |
| **线程安全** | ❌ | ❌ | ❌ | ✅ |

### 三、使用场景选择

**ArrayList**：读多写少，随机访问
- 数据库查询结果集、配置列表、菜单列表

**LinkedList**：写多读少，频繁头部/中间插入删除（实际很少用）
- 实现队列/栈（但实际用 ArrayDeque 更快）

**HashMap**：单线程，key-value 映射
- 缓存（单机）、配置管理、数据去重

**ConcurrentHashMap**：多线程，需要线程安全
- 多线程共享缓存、分布式锁计数器

### 四、HashMap 底层细节

**JDK7 vs JDK8**：

| | JDK7 | JDK8 |
|---|---|---|
| **结构** | 数组 + 链表 | 数组 + 链表 + 红黑树 |
| **插入** | 头插法 | 尾插法 |
| **扩容** | 先扩容再插入 | 先插入再扩容 |
| **线程安全** | 死循环（头插法导致） | 安全（尾插法） |

**红黑树转换条件**：
- 链表长度 > 8 且 数组长度 ≥ 64
- 为什么是 8：泊松分布，链表长度达到 8 的概率只有 0.00000006

### 五、ConcurrentHashMap 底层细节

**JDK7：分段锁（Segment）**
- 每个 Segment 是一个小 HashMap
- 锁粒度：Segment（并发度 = Segment 数量，默认16）

**JDK8：CAS + synchronized**
- 每个桶（bin）单独加锁
- 锁粒度：桶头节点（并发度 = 桶数量）

**为什么 JDK8 比 JDK7 快**：
- 锁粒度更细（桶级别 vs Segment 级别）
- 不用 Segment，内存占用更少
- CAS 无锁写入（桶为空时）

---

## 用户回答记录

### 初始回答

**ArrayList**：读多写少，数组 - 正确
**LinkedList**：读少写多，链表 - 正确
**HashMap**：数组+链表（红黑树），非并发 - 正确
**ConcurrentHashMap**：并发Map - 正确，但太简单

**评分：5 / 10**

---

## 最终结论

| 用户问题 | 结论 |
|---------|------|
| ArrayList 适用场景 | 读多写少，随机访问 O(1) |
| LinkedList 适用场景 | 写多读少，但实际很少用 |
| HashMap 底层 | 数组+链表+红黑树，链表>8且数组≥64转红黑树 |
| ConcurrentHashMap JDK7 vs JDK8 | 分段锁 vs CAS+synchronized，锁粒度更细 |

---

## 这次讨论的收获

1. **HashMap 红黑树转换条件**：链表长度>8 且 数组长度≥64
2. **ConcurrentHashMap JDK8 改进**：CAS + synchronized，锁粒度从 Segment 细化到桶
3. **LinkedList 实际很少用**：ArrayDeque 实现队列更快
4. **性能对比**：ArrayList 随机读 O(1)，LinkedList 随机读 O(n)
