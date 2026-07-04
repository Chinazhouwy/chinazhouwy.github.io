---
schema_version: 1
question_id: 45
question: "算法 · LRU/LFU 缓存手写"
date: 2026-07-02
sources:
  - tencent/2026-06-07-tencent-ai-backend-round1-xhs.md
  - ai-agent/amap-agent-backend-intern-interview.md
  - middleware/vipshop-java-interview.md
score: "5/10"
round: R1
next_review: unknown
session_id: unknown
status: completed
---
## 第45题 · 算法 · LRU/LFU 缓存手写

**题目**：LRU 缓存 O(1) 怎么手写？线程安全版本怎么设计？

### R0 用户回答（2026-07-02）

> 优先队列吧，内部是个堆好像，每次拿取数据按照数据的时间来进行调整，线程安全得 arrayblockingqueue?

**得分：1/10**

扣分点：LRU 和优先队列/堆没关系（-4）、线程安全方案错误（-3）、核心数据结构没提（-2）

### R1 用户回答（2026-07-04）

> LRU 最近最少使用，是 LinkedHashMap，本质是一个 map + 双向链表；LFU 是最近最少频次使用，LinkedHashSet，最小频次，Map<Integer,Node> 这样组成。

**得分：5/10**

扣分点：LRU 正确（0扣分）；LFU 说的 LinkedHashSet 不对，标准实现是 HashMap + 最小频次指针（-3）

### 最终修正版

**LRU（最近最少使用）**
- 结构：HashMap + 双向链表，O(1) get/put
- 每次访问移到链表头，淘汰时删链表尾
- Java 直接用 `LinkedHashMap(accessOrder=true)` 重写 `removeEldestEntry()`
- 线程安全：`Collections.synchronizedMap()` 或 `ReentrantLock`

**LFU（最不经常使用）**
- 核心结构：`Map<Integer, Node> keyMap` + `Map<Integer, DoublyLinkedList> freqMap` + `int minFreq`
- 每个节点存 val、key、freq
- get：命中时 freq+1，移到对应频率链表头；miss 时从 minFreq 链表尾删
- put：满了先删 minFreq 链表尾；插入后 minFreq=1
- **不是 LinkedHashSet**，LinkedHashSet 不维护频次

### 复习骨架

LRU = HashMap + 双向链表（访问移头，淘汰删尾）→ LFU = keyMap + freqMap + minFreq（频次+时间双维度）
