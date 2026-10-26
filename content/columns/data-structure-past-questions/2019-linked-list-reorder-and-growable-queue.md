---
title: "2019 · 链表重新排列与只增不减的队列"
date: "2026-10-26"
importedAt: "2026-10-26"
domain: "专栏"
area: "计算机基础"
module: "数据结构历年综合题"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "找中点+逆置+合并重构链表，以及出队空间可复用但总占用只增不减的队列设计。"
tags:
  - "数据结构"
  - "单链表"
  - "队列"
  - "空间复用"
---

# 2019 · 链表重新排列与只增不减的队列

> 卷面位置：2019 年综合卷 第 41 题（13 分）、第 42 题（10 分）。

## 第 41 题（13 分）：把 L0,L1,…,Ln 重排为 L0,Ln,L1,Ln-1,…

设线性表 L = (a₁, a₂, …, aₙ) 采用带头结点的单链表保存，结点结构为 `data | next`。请设计一个空间复杂度为 O(1) 且时间上尽可能高效的算法，重新排列 L 中的各结点，得到线性表 L′ = (a₁, aₙ, a₂, aₙ₋₁, a₃, aₙ₋₂, …)。要求：给出算法的基本设计思想；用 C/C++ 描述算法并注释；说明时间复杂度。

## 考点

- 单链表不能随机访问，「从尾往前取」只能靠逆置；
- 三件套：找中点 → 逆置后半段 → 交替合并；
- 空间必须是 O(1)，不能借辅助数组。

## 思路

1. 快慢指针找中点：p 每步走 2、q 每步走 1，q 停在 ⌈n/2⌉ 处，从 q->next 起把后半段摘下；
2. 头插法逆置后半段；
3. 交替合并：前半段一个结点、后半段一个结点依次串起来。

以 n = 6 的 a1..a6 为例：后半段 a4,a5,a6 逆置成 a6,a5,a4，交替合并得 a1,a6,a2,a5,a3,a4，符合 a₁,aₙ,a₂,aₙ₋₁,… 的形态。

## 参考实现（C）

```c
typedef struct LNode {
    int data;
    struct LNode *next;
} LNode, *LinkList;

void reorder(LinkList head) {
    LNode *slow = head, *fast = head;
    while (fast->next && fast->next->next) {     /* 找中点 */
        slow = slow->next;
        fast = fast->next->next;
    }
    LNode *mid = slow->next;                     /* 后半段首结点 */
    slow->next = NULL;

    LNode *rev = NULL;                           /* 头插逆置后半段 */
    while (mid) {
        LNode *t = mid->next;
        mid->next = rev;
        rev = mid;
        mid = t;
    }

    LNode *p = head->next, *q = rev;              /* 交替合并 */
    while (q) {
        LNode *t1 = p->next, *t2 = q->next;
        p->next = q;
        q->next = t1;
        p = t1;
        q = t2;
    }
}
```

## 复杂度

- 时间：O(n)，三趟线性；
- 空间：O(1)，只用了常量个指针。

## 容易丢分的地方

- 中点算错（快慢指针写成 fast 每次走 2 但不判 `fast->next->next`，偶数长度时越界）；
- 后半段逆置后忘记把中间断开（`slow->next = NULL`），合并时死循环；
- 合并循环条件写成 `p && q`，n 为奇数时把中间结点重复使用；
- 借数组存结点实现，空间不满足 O(1)。

## 第 42 题（10 分）：出队空间可复用、总占用只增不减的队列

请设计一个队列，要求满足：① 初始时队列为空；② 入队时，允许增加队列占用空间；③ 出队后，出队元素所占用的空间可重复使用，即整个队列所占用的空间只增不减；④ 入队操作和出队操作的时间复杂度始终保持 O(1)。

要求：给出队列的设计思想；用 C/C++ 给出数据类型定义；描述入队和出队算法，关键之处给出注释；说明时间复杂度。

## 思路（链式 + 空闲结点链）

用**不带头结点的循环链表**存数据，另设一个空闲结点链（把出队的结点串起来复用）：

- 结构：`front` 指向队头，`rear` 指向队尾，`freeList` 指向空闲结点链；
- 入队：若 freeList 非空，摘一个空闲结点挂到队尾；否则 `malloc` 新结点。计数器 n++；
- 出队：摘队头，`n--`，把该结点挂到 freeList（**不 free**）。

这样空间只增不减（复用的结点不还给系统），且出入队都是 O(1)。

## 参考实现（C）

```c
typedef struct Node {
    int data;
    struct Node *next;
} Node;

typedef struct {
    Node *front;      /* 队头 */
    Node *rear;       /* 队尾 */
    Node *freeList;   /* 空闲结点链，用 next 串起来 */
    int  n;           /* 当前元素个数 */
} Queue;

void initQueue(Queue *q) {
    q->front = q->rear = q->freeList = NULL;
    q->n = 0;
}

void enqueue(Queue *q, int x) {
    Node *t;
    if (q->freeList) {                   /* 复用空闲结点 */
        t = q->freeList;
        q->freeList = t->next;
    } else {
        t = (Node *)malloc(sizeof(Node));
    }
    t->data = x;
    t->next = NULL;
    if (q->rear == NULL) q->front = q->rear = t;
    else { q->rear->next = t; q->rear = t; }
    q->n++;
}

int dequeue(Queue *q, int *x) {
    if (q->n == 0) return 0;
    Node *t = q->front;
    *x = t->data;
    q->front = t->next;
    if (q->front == NULL) q->rear = NULL;
    t->next = q->freeList;               /* 归还到空闲链，不释放给系统 */
    q->freeList = t;
    q->n--;
    return 1;
}
```

## 复杂度

- 入队、出队：均 O(1)；
- 空间：O(max(n))，只随历史峰值增长，不随出队回落。

## 容易丢分的地方

- 出队时直接 `free`，空间会回落，违反「只增不减」；
- 只用循环队列 + 扩容：扩容后老空间被释放，同样违反只增不减；
- 忘记维护 n，空队列判断出错；
- 空闲链和队列链混用同一个指针域，摘结点时串错。

## 关联

- 2017 · 表达式树与遍历
- 2020 · 前缀编码（同属「结构复用 + O(1) 操作」的工程型设计题）
