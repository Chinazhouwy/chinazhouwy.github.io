---
schema_version: 1
question_id: 45
question: "算法 · LRU/LFU 缓存手写"
date: 2026-07-02
sources:
  - unknown
score: "1/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
## 第45题 · 算法 · LRU/LFU 缓存手写

**题目**：LRU 缓存 O(1) 怎么手写？线程安全版本怎么设计？

### 用户回答

> 优先队列吧，内部是个堆好像，每次拿取数据按照数据的时间来进行调整，线程安全得 arrayblockingqueue?

### 评分：1/10

### 扣分点
1. LRU 和优先队列/堆没关系（-4）
2. 线程安全方案错误（-3）
3. 核心数据结构 HashMap + 双向链表没提（-2）

---

## 缓存淘汰策略对比

### 缓存淘汰算法一览

| 算法 | 全称 | 淘汰规则 | 数据结构 | 复杂度 |
|------|------|---------|----------|--------|
| **LRU** | Least Recently Used | 最久没被访问的淘汰 | HashMap + 双向链表 | O(1) |
| **LFU** | Least Frequently Used | 访问次数最少的淘汰 | HashMap + 多层链表 | O(1) |
| **MRU** | Most Recently Used | 最近刚被使用的淘汰 | 栈 / 双向链表 | O(1) |
| **FIFO** | First In First Out | 最早进入的淘汰 | 队列 | O(1) |
| **ARC** | Adaptive Replacement Cache | LRU + LFU 自适应 | 多链表 | O(1) |
| **Clock** | 二次机会算法 | FIFO + 访问位标记 | 环形链表 | O(1) |

---

## LRU（Least Recently Used）— LeetCode 146

### 核心思想

```
谁最久没被访问 → 淘汰谁

数据结构：HashMap + 双向链表

  HashMap：key → Node 地址，O(1) 查找
  双向链表：维护访问顺序
    HEAD ⇄ 最近使用 ⇄ ... ⇄ 最久未用 ⇄ TAIL
```

### Java 实现

```java
class LRUCache {
    int capacity;
    Map<Integer, Node> map = new HashMap<>();
    Node head = new Node(0, 0), tail = new Node(0, 0);

    class Node {
        int key, val;
        Node prev, next;
        Node(int k, int v) { key = k; val = v; }
    }

    public LRUCache(int capacity) {
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    public int get(int key) {
        if (!map.containsKey(key)) return -1;
        Node node = map.get(key);
        remove(node);
        addToHead(node);
        return node.val;
    }

    public void put(int key, int val) {
        if (map.containsKey(key)) {
            Node node = map.get(key);
            node.val = val;
            remove(node);
            addToHead(node);
        } else {
            if (map.size() == capacity) {
                Node lru = tail.prev;   // 最久未用的
                remove(lru);
                map.remove(lru.key);
            }
            Node node = new Node(key, val);
            map.put(key, node);
            addToHead(node);
        }
    }

    void remove(Node node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    void addToHead(Node node) {
        node.next = head.next;
        node.prev = head;
        head.next.prev = node;
        head.next = node;
    }
}
```

### 图解操作

```
初始：HEAD ⇄ TAIL

put(1,1)：[1]
  HEAD ⇄ Node(1) ⇄ TAIL

put(2,2)：[2,1]
  HEAD ⇄ Node(2) ⇄ Node(1) ⇄ TAIL

put(3,3)：[3,2,1]
  HEAD ⇄ Node(3) ⇄ Node(2) ⇄ Node(1) ⇄ TAIL

get(1)：[1,3,2]  ← 1 移到头部
  HEAD ⇄ Node(1) ⇄ Node(3) ⇄ Node(2) ⇄ TAIL

put(4,4)：容量满了，淘汰尾部 2 → [4,1,3]
  HEAD ⇄ Node(4) ⇄ Node(1) ⇄ Node(3) ⇄ TAIL
                         ↑ 2 被淘汰
```

### 线程安全版本

```java
class ThreadSafeLRUCache {
    private final LRUCache lru;
    private final ReentrantLock lock = new ReentrantLock();

    public ThreadSafeLRUCache(int capacity) {
        this.lru = new LRUCache(capacity);
    }

    public int get(int key) {
        lock.lock();
        try { return lru.get(key); }
        finally { lock.unlock(); }
    }

    public void put(int key, int val) {
        lock.lock();
        try { lru.put(key, val); }
        finally { lock.unlock(); }
    }
}
```

```java
// 分段锁版本（高性能）
class SegmentedLRUCache {
    private final int segmentCount;
    private final ThreadSafeLRUCache[] segments;

    public SegmentedLRUCache(int totalCapacity, int segmentCount) {
        this.segmentCount = segmentCount;
        this.segments = new ThreadSafeLRUCache[segmentCount];
        int perSegment = totalCapacity / segmentCount;
        for (int i = 0; i < segmentCount; i++) {
            segments[i] = new ThreadSafeLRUCache(perSegment);
        }
    }

    private int getSegment(int key) {
        return Math.abs(key.hashCode()) % segmentCount;
    }

    public int get(int key) {
        return segments[getSegment(key)].get(key);
    }

    public void put(int key, int val) {
        segments[getSegment(key)].put(key, val);
    }
}
```

---

## LFU（Least Frequently Used）— LeetCode 460

### 核心思想

```
谁被访问次数最少 → 淘汰谁
相同次数时，按 LRU 规则淘汰最久没用的

数据结构：HashMap + 多层链表

  keyToNode：key → Node
  freqToList：频率 → 该频率的双向链表
  minFreq：当前最小频率
```

### Java 实现

```java
class LFUCache {
    int capacity, minFreq;
    Map<Integer, Node> keyToNode = new HashMap<>();
    Map<Integer, DoublyLinkedList> freqToList = new HashMap<>();

    class Node {
        int key, val, freq;
        Node prev, next;
        Node(int k, int v) { key = k; val = v; freq = 1; }
    }

    class DoublyLinkedList {
        Node head, tail;
        DoublyLinkedList() {
            head = new Node(0, 0);
            tail = new Node(0, 0);
            head.next = tail;
            tail.prev = head;
        }
        void addFirst(Node node) {
            node.next = head.next;
            node.prev = head;
            head.next.prev = node;
            head.next = node;
        }
        void remove(Node node) {
            node.prev.next = node.next;
            node.next.prev = node.prev;
        }
        Node removeLast() {
            if (head.next == tail) return null;
            Node last = tail.prev;
            remove(last);
            return last;
        }
        boolean isEmpty() { return head.next == tail; }
    }

    public LFUCache(int capacity) {
        this.capacity = capacity;
    }

    public int get(int key) {
        if (!keyToNode.containsKey(key)) return -1;
        Node node = keyToNode.get(key);
        increaseFreq(node);
        return node.val;
    }

    public void put(int key, int val) {
        if (capacity == 0) return;
        if (keyToNode.containsKey(key)) {
            Node node = keyToNode.get(key);
            node.val = val;
            increaseFreq(node);
        } else {
            if (keyToNode.size() == capacity) {
                DoublyLinkedList minList = freqToList.get(minFreq);
                Node removed = minList.removeLast();
                keyToNode.remove(removed.key);
            }
            Node node = new Node(key, val);
            keyToNode.put(key, node);
            freqToList.computeIfAbsent(1, k -> new DoublyLinkedList()).addFirst(node);
            minFreq = 1;
        }
    }

    void increaseFreq(Node node) {
        int freq = node.freq;
        freqToList.get(freq).remove(node);
        if (freqToList.get(freq).isEmpty()) {
            freqToList.remove(freq);
            if (minFreq == freq) minFreq++;
        }
        node.freq++;
        freqToList.computeIfAbsent(node.freq, k -> new DoublyLinkedList()).addFirst(node);
    }
}
```

### 图解操作

```
操作：put(1,1) put(2,2) get(1) get(2) get(2) put(3,3)

freq=1: [3]     ← 新建 freq=1
freq=2: [1]     ← get(1) 后 freq 1→2
freq=3: [2]     ← get(2) 两次后 freq 1→3

淘汰时：minFreq=1 → 淘汰 freq=1 链表的尾部
```

---

## MRU（Most Recently Used）

### 核心思想

```
最近刚被使用的优先淘汰（和 LRU 相反）
适用于：数据几乎不会再被访问的场景
```

### Java 实现

```java
class MRUCache {
    int capacity;
    Map<Integer, Node> map = new HashMap<>();
    Node head = new Node(0, 0), tail = new Node(0, 0);

    class Node {
        int key, val;
        Node prev, next;
        Node(int k, int v) { key = k; val = v; }
    }

    public MRUCache(int capacity) {
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    public int get(int key) {
        if (!map.containsKey(key)) return -1;
        Node node = map.get(key);
        // MRU：不移动到头部，保持原位
        return node.val;
    }

    public void put(int key, int val) {
        if (map.containsKey(key)) {
            Node node = map.get(key);
            node.val = val;
        } else {
            if (map.size() == capacity) {
                Node mru = head.next;   // 最近使用的在头部
                remove(mru);
                map.remove(mru.key);
            }
            Node node = new Node(key, val);
            map.put(key, node);
            addToHead(node);
        }
    }

    void remove(Node node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    void addToHead(Node node) {
        node.next = head.next;
        node.prev = head;
        head.next.prev = node;
        head.next = node;
    }
}
```

---

## FIFO（First In First Out）

### 核心思想

```
最早进入的优先淘汰（最简单）
不关心访问次数，不关心最近是否用过
```

### Java 实现

```java
class FIFOCache {
    int capacity;
    Queue<Integer> queue = new LinkedList<>();
    Map<Integer, Integer> map = new HashMap<>();

    public FIFOCache(int capacity) {
        this.capacity = capacity;
    }

    public int get(int key) {
        return map.getOrDefault(key, -1);
    }

    public void put(int key, int val) {
        if (map.containsKey(key)) {
            map.put(key, val);
        } else {
            if (map.size() == capacity) {
                int oldest = queue.poll();  // 最早进入的
                map.remove(oldest);
            }
            queue.offer(key);
            map.put(key, val);
        }
    }
}
```

---

## 对比总结

```
| 算法 | 淘汰谁 | 优点 | 缺点 | 适用场景 |
|------|--------|------|------|----------|
| LRU  | 最久没访问 | 简单高效 | 对偶发访问敏感 | 通用缓存、数据库Buffer |
| LFU  | 访问次数最少 | 抗偶发访问 | 实现复杂、冷数据难淘汰 | 音乐播放、热门内容 |
| MRU  | 最近刚访问 | 特殊场景好用 | 通用性差 | 数据不再被读取的场景 |
| FIFO | 最早进入 | 最简单 | 不考虑访问模式 | 消息队列、日志 |
```

---

## 线程安全方案对比

```
| 方案 | 实现 | 性能 | 适用场景 |
|------|------|------|----------|
| Collections.synchronizedMap | 包装器 | 差（全表锁） | 低并发 |
| ReentrantLock | 手动加锁 | 中（方法级锁） | 一般场景 |
| 分段锁 | N 个段独立锁 | 好（锁粒度 1/N） | 高并发 |
| ConcurrentHashMap + 链表 | 分段 + 链表 | 最好 | 生产首选 |
```

## GPT 纠错

- GPT 纠错：文中的 MRU 实现是错误的。`get()` 后没有把节点移动到“最近使用”位置，更新已有 key 时也没有更新顺序，因此淘汰的并不一定是 MRU。
- GPT 纠错：LRU 和 FIFO 示例没有处理 `capacity == 0`，会删除哨兵节点或对 `null` 解包，代码不能直接视为完整实现。
- GPT 纠错：分段 LRU 只能保证“段内 LRU”，不再是全局 LRU；`totalCapacity / segmentCount` 还会丢失余数容量。
- GPT 纠错：`Math.abs(key.hashCode()) % segmentCount` 遇到 `Integer.MIN_VALUE` 仍可能得到负数，应使用 `Math.floorMod`。
- GPT 纠错：`ConcurrentHashMap + 链表` 不会天然成为“性能最好、生产首选”，链表顺序维护仍需要同步。生产中优先评估 Caffeine 等成熟缓存库。
