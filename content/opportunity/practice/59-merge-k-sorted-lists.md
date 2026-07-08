---
title: "算法 — 合并 K 个升序链表"
date: "2026-07-08"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "算法 — 合并 K 个升序链表"
tags:
  - "algorithm"
  - "linked-list"
  - "heap"
schema_version: "1"
question_id: "59"
question: "算法 — 合并 K 个升序链表怎么写？复杂度是多少？"
sources:
  - "tencent/2026-06-07-tencent-ai-backend-round1-xhs.md"
  - "tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md"
score: "7/10"
round: "R0"
next_review: "2026-07-11"
session_id: "unknown"
---

# 第59题：算法 — 合并 K 个升序链表

> 日期：2026-07-08
> 来源：`tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`

---

## 第一轮：初始回答

**得分：7/10**

用户回答要点：
- 初始想到逐个比较 O(N×K)，意识到不是最优 ✓
- 经提示后理解：每次从 K 个头节点找最小值 ✓
- 理解堆的作用：O(logK) 取最小值 ✓
- 理解堆大小 = K，不是 N ✓
- 能描述完整流程 ✓

漏掉的：
- 未自己写出代码（看了参考答案）

---

## 核心思路

```
K 个升序链表，每次从 K 个头节点里找最小的
→ 用最小堆，O(logK) 取最小值
→ 弹出后把下一个节点放进堆
→ 重复直到堆空
```

---

## 复杂度分析

```
N = 所有节点总数
K = 链表个数

时间复杂度：O(N×logK)
  堆操作每次 O(logK)，总共 N 次

空间复杂度：O(K)
  堆最多存 K 个节点

对比暴力法 O(N×K)，快很多
```

---

## Java 代码

```java
import java.util.PriorityQueue;

class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        // 最小堆：按节点值排序
        PriorityQueue<ListNode> heap = new PriorityQueue<>((a, b) -> a.val - b.val);
        
        // 初始化：把所有非空链表头节点放进堆
        for (ListNode head : lists) {
            if (head != null) {
                heap.offer(head);
            }
        }
        
        ListNode dummy = new ListNode(0);
        ListNode curr = dummy;
        
        while (!heap.isEmpty()) {
            ListNode node = heap.poll();
            curr.next = node;
            curr = curr.next;
            
            // 这个链表还有下一个节点，放进堆
            if (node.next != null) {
                heap.offer(node.next);
            }
        }
        
        return dummy.next;
    }
}
```

---

## Python 代码

```python
import heapq

def mergeKLists(lists):
    # 堆里放 (值, 链表索引, 节点)
    heap = []
    for i, head in enumerate(lists):
        if head:
            heapq.heappush(heap, (head.val, i, head))
    
    dummy = curr = ListNode(0)
    while heap:
        val, i, node = heapq.heappop(heap)
        curr.next = node
        curr = curr.next
        if node.next:
            heapq.heappush(heap, (node.next.val, i, node.next))
    
    return dummy.next
```

---

## 用户追问纠正记录

1. 暴力法 O(N×K) 不是最优
2. 堆大小 = K，不是 N
3. 每次从 K 个头节点找最小值
4. 弹出后把下一个节点放进堆

---

## 这次讨论的收获

- 合并 K 个有序链表用最小堆
- 堆大小 = K，时间复杂度 O(N×logK)
- 每次弹出最小，把下一个节点放进堆
- Java 用 PriorityQueue，Python 用 heapq
