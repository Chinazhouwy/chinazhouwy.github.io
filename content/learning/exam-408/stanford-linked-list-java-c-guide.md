---
title: "Stanford 链表经典教程：Java 程序员的中文实战版"
date: "2026-09-02"
domain: "学习"
area: "计算机基础"
module: "数据结构与算法"
project: "data-structure-algorithm-lab"
type: "实战指南"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
lane: theory
summary: "把 Stanford 两份经典链表讲义重组为 Java 主线、C 指针桥接、内存图推演和统考取舍明确的中文实战教程。"
tags:
  - Stanford CS Education Library
  - 链表
  - Java
  - C
  - 指针
---

# Stanford 链表经典教程：Java 程序员的中文实战版

> 本文基于 Nick Parlante 在 Stanford CS Education Library 发布的 [Linked List Basics](https://cslibrary.stanford.edu/103/) 与 [Linked List Problems](https://cslibrary.stanford.edu/105/) 重组而成。前者共 26 页，后者共 33 页。本文不是逐句翻译，也不替代原文，而是保留其指针训练主线，改写成适合 Java 程序员的中文 Coding 路线。

Stanford 这两份讲义真正值得学的，不是“链表在工程里多常用”，而是三件事：

1. 把栈上的引用变量、堆上的节点和节点内部的 next 分开看。
2. 在覆盖一条引用之前，先确认旧链是否还有入口。
3. 把“第一个节点是特殊情况”改写成 dummy node 或 pointer-to-pointer 的统一操作。

全文以 Java 为主代码，以 C 还原指针语义。每道原题都保留英文名称、完整核心实现、指针变化、复杂度和统考价值，但不会平均分配篇幅。

## 分级约定

| 级别 | 要求 |
| --- | --- |
| S | 必须能脱离模板写出，能画每一步指针变化 |
| A | 建议完整写过，能处理空表、单节点和边界 |
| B | 理解算法和关键语句，至少手工推演一次 |
| C | 主要作为指针技巧欣赏，不需要背实现 |

---

## 一、先把链表看成“显式保存的位置关系”

### 1. 节点、data、next、head、NULL

最普通的单链表只有一种业务节点：

~~~java
static final class Node {
    int data;
    Node next;

    Node(int data) {
        this.data = data;
    }

    Node(int data, Node next) {
        this.data = data;
        this.next = next;
    }
}
~~~

~~~c
typedef struct Node {
    int data;
    struct Node *next;
} Node;
~~~

两段代码表达的是同一张关系图：

~~~text
head
  |
  v
+------+------+
| data | next | ----+
+------+------+     |
                    v
              +------+------+
              | data | NULL |
              +------+------+
~~~

需要分清：

- **Node**：一个节点对象或一块节点内存。
- **data**：节点承载的数据。
- **next**：从当前节点到后继节点的关系。
- **head**：保存首元节点地址或引用的变量，不是节点本身。
- **NULL / null**：没有后继；当 head 为它时，表示空表。

Java 的 Node next 与 C 的 Node *next 都表示“保存另一个节点的位置”。相似之处是都可以沿 next 访问后继；不同之处是 C 指针可做更底层的地址操作，需要 malloc/free，Java 引用受类型和运行时管理，不能做指针算术。

### 2. 数组与链表的根本差异

“数组连续、链表不连续”只是现象，真正的差异是位置关系存在哪里。

~~~text
数组：
base + index * elementSize
下一个元素的位置由地址计算得到

链表：
current.next
下一个元素的位置由当前节点显式保存
~~~

数组中的“下一个”由物理布局决定，所以按下标访问通常是 O(1)；链表中的“下一个”只能沿关系逐个读取，所以获取第 n 个节点是 O(n)。

~~~text
数组

base
 |
 v
+----+----+----+----+
| A  | B  | C  | D  |
+----+----+----+----+
  0    1    2    3

链表

head
 |
 v
[A | *] ----> [B | *] ----> [C | /]
  0              1              2
~~~

链表换来的不是“插入永远 O(1)”，而是**已经拿到待修改位置的前驱节点时**，改链接不需要整体搬移。若题目只给 index，寻找前驱仍是 O(n)。

### 3. head 指针、头节点、首元节点、dummy node

这四个概念不能混用。

~~~text
Stanford 主要采用的 plain list：

head 变量
   |
   v
[A] -> [B] -> [C] -> NULL
 ^
 首元节点，也是实际头节点
~~~

~~~text
带 dummy 的链表：

head 或 dummy 引用
   |
   v
[DUMMY] -> [A] -> [B] -> [C] -> NULL
             ^
             首元节点
~~~

- **head 指针/引用**：变量。
- **头节点**：链上的第一个节点；有些教材专指 dummy，需要结合定义。
- **首元节点**：第一个存放业务数据的节点。
- **dummy node**：不承载业务数据的哨兵节点。

Stanford 的 Problems 故意以无 dummy 的 plain list 为主，因为这样 Push、Pop、Append 会暴露 head 变化和 Node**。业务 Java 代码常用 dummy 消除“插在第一个位置”的分支；考试中两种表示都可能出现，必须先看题目如何定义空表与首元节点。

---

## 二、Stanford 的三类建链动作

### 1. BuildOneTwoThree：先理解结果，再理解写法

Stanford 用 BuildOneTwoThree 构造 {1, 2, 3}。如果只会头插，就必须逆序 Push：

~~~java
static Node buildOneTwoThree() {
    Node head = null;
    head = push(head, 3);
    head = push(head, 2);
    head = push(head, 1);
    return head;
}

static Node push(Node head, int value) {
    return new Node(value, head);
}
~~~

~~~c
static Node *newNode(int value) {
    Node *node = malloc(sizeof(*node));
    assert(node != NULL);
    node->data = value;
    node->next = NULL;
    return node;
}

static void Push(Node **headRef, int value) {
    Node *node = newNode(value);
    node->next = *headRef;
    *headRef = node;
}

static Node *BuildOneTwoThree(void) {
    Node *head = NULL;
    Push(&head, 3);
    Push(&head, 2);
    Push(&head, 1);
    return head;
}
~~~

### 2. Push：三步头插

原链：

~~~text
head
 |
 v
[A] -> [B] -> NULL

newNode
 |
 v
[X] -> NULL
~~~

正确顺序：

~~~text
1. X.next = head

newNode
 |
 v
[X] --------+
            |
head        v
 |         [A] -> [B] -> NULL
 +----------^

2. head = X

head
 |
 v
[X] -> [A] -> [B] -> NULL
~~~

头插为 O(1)，但会反转插入顺序。Java 返回 new head；C 通过 Node** 修改调用方的 head。

### 3. AppendNode：先找尾，再接入

没有 tail 时：

~~~java
static Node appendNode(Node head, int value) {
    Node node = new Node(value);
    if (head == null) return node;

    Node current = head;
    while (current.next != null) {
        current = current.next;
    }
    current.next = node;
    return head;
}
~~~

~~~text
head                  current
 |                       |
 v                       v
[A] -> [B] -> NULL      [B] -> [X] -> NULL
~~~

单次 AppendNode 需要 O(n)。若构造过程中一直维护 tail，则每次尾插是 O(1)：

~~~java
Node dummy = new Node(0);
Node tail = dummy;

for (int value : values) {
    tail.next = new Node(value);
    tail = tail.next;
}
Node head = dummy.next;
~~~

dummy 的作用不是存数据，而是让第一次尾插与后续尾插都写成 tail.next = node。

### 4. 三种尾部构造策略

Stanford 把“第一次插入的特殊情况”展开成三种解法：

| 策略 | 第一个节点怎么处理 | 优点 | 代价 |
| --- | --- | --- | --- |
| special case + tail | 单独给 head 赋值 | 直白、适合生产代码 | 有分支 |
| dummy + tail | 从 dummy.next 开始 | 统一所有节点 | 需要理解哨兵 |
| local reference | 始终持有最后一个“指针槽位” | 无 dummy、统一写法 | Node** 难度高 |

---

## 三、Node** 与 Local Reference：修改的不是节点，而是“入口槽位”

### 1. 为什么 Node *head 不够

C 的函数参数也是值传递：

~~~c
void wrongPush(Node *head, int value) {
    Node *node = newNode(value);
    node->next = head;
    head = node;
}
~~~

这里改变的是 wrongPush 内部 head 副本。调用方的 head 没变。

~~~text
调用方变量              函数参数副本
caller.head ----> A      head ----> A

head = X 之后：

caller.head ----> A      head ----> X ----> A
~~~

要改调用方保存的地址，需要传入这个变量本身的地址：

~~~c
void Push(Node **headRef, int value) {
    Node *node = newNode(value);
    node->next = *headRef;
    *headRef = node;
}
~~~

~~~text
Node*  = 一个节点地址
Node** = 保存“节点地址”的变量或字段的地址

headRef ----> caller.head ----> A
*headRef                 == A 的地址
*headRef = node          == 改写 caller.head
~~~

Node** 不只可以指向 head，也可以指向某个节点内部的 next 字段：

~~~c
Push(&(tail->next), value);
~~~

这正是 Stanford 指针题最有价值的地方：函数修改的是一个“链接槽位”，这个槽位可以位于栈上的 head，也可以位于堆节点里的 next。

### 2. Local Reference：永远指向结果链最后一个空槽

~~~c
Node *head = NULL;
Node **lastPtrRef = &head;

Push(lastPtrRef, 1);
lastPtrRef = &((*lastPtrRef)->next);

Push(lastPtrRef, 2);
lastPtrRef = &((*lastPtrRef)->next);
~~~

变化过程：

~~~text
初始：
lastPtrRef -> head
               |
               v
              NULL

加入 1：
head -> [1 | NULL]
             ^
             |
lastPtrRef --+   （现在指向 1.next 这个字段）

加入 2：
head -> [1 | *] -> [2 | NULL]
                         ^
                         |
lastPtrRef ---------------+
~~~

这里维护的不是“最后一个节点”，而是“下一次应该写入的指针槽位”。dummy + tail 与 local reference 解决的是同一个问题：

~~~text
dummy + tail：我持有最后一个节点，写 tail.next
local reference：我直接持有最后一个 next 槽位，写 *lastPtrRef
~~~

### 3. Java 不是引用传递

Java 同样只有值传递，只是 Node 变量里装的是对象引用值的副本。

~~~java
static void wrongPush(Node head, int value) {
    head = new Node(value, head);
}
~~~

调用方 head 不会改变。Java 常用三种方式表达 C 的 Node** 效果：

1. 返回新的 head。
2. 传入可变包装对象，例如 ListState。
3. 使用 dummy，让需要改 head 的操作变成修改 dummy.next。

本文优先返回新 head；Pop 等需要同时返回数据和新 head 的操作使用结果对象。

---

## 四、改 next 前，先问“旧链还找不找得到？”

这是整篇最重要的安全规则。

原链：

~~~text
A -> B -> C -> NULL
~~~

若直接执行：

~~~java
a.next = x;
~~~

且没有其他引用指向 B，逻辑上就失去了从 A 到 B、C 的路径：

~~~text
A -> X

B -> C -> NULL   （旧链已脱离，入口可能丢失）
~~~

正确插入 X：

~~~java
x.next = a.next;
a.next = x;
~~~

~~~text
保存旧关系：
X.next -----+
            v
A --------> B -> C

替换入口：
A -> X -> B -> C
~~~

Reverse 同理，必须先保存 cur.next：

~~~java
Node next = cur.next;
cur.next = prev;
prev = cur;
cur = next;
~~~

一旦先执行 cur.next = prev，原来通向后续节点的唯一链接就被覆盖；如果没有 next 临时变量，剩余链会丢失。

同一原则也适用于 C 的 free：

~~~c
Node *next = current->next;
free(current);
current = next;
~~~

free 之后再读 current->next 是 use-after-free。

---

## 五、共同代码骨架

下面各题的 Java 方法均放入同一个 StanfordLinkedListLab 类即可运行。把后文方法放在
of 与类的最后一个右花括号之间，再加入第 18 题后的 smoke test。

~~~java
import java.util.NoSuchElementException;

public final class StanfordLinkedListLab {
    static final class Node {
        int data;
        Node next;

        Node(int data) {
            this.data = data;
        }

        Node(int data, Node next) {
            this.data = data;
            this.next = next;
        }
    }

    record PopResult(int value, Node head) {}
    record SplitResult(Node front, Node back) {}
    record MoveResult(Node dest, Node source) {}

    static Node of(int... values) {
        Node dummy = new Node(0);
        Node tail = dummy;
        for (int value : values) {
            tail.next = new Node(value);
            tail = tail.next;
        }
        return dummy.next;
    }

    // 将后文 18 个 Java 方法及 smoke test 放在这里。
}
~~~

C 方法共享以下定义：

~~~c
#include <assert.h>
#include <stddef.h>
#include <stdlib.h>

typedef struct Node {
    int data;
    struct Node *next;
} Node;

static Node *NewNode(int value) {
    Node *node = malloc(sizeof(*node));
    assert(node != NULL);
    node->data = value;
    node->next = NULL;
    return node;
}

static void Push(Node **headRef, int value) {
    Node *node = NewNode(value);
    node->next = *headRef;
    *headRef = node;
}
~~~

---

## 六、Stanford 18 题路线总表

| # | Stanford 操作 | 中文含义 | 核心技术 | Java 建议写 | C 建议写 | 统考级别 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Count | 统计目标值次数 | 遍历、NULL 终止 | 是 | 可选 | A |
| 2 | GetNth | 取第 n 个节点 | 按位查找、边界 | 是 | 是 | S |
| 3 | DeleteList | 释放整条链 | 保存后继、free、改 head | 是 | 是 | S |
| 4 | Pop | 删除并返回首元节点 | 解链、改 head | 是 | 是 | S |
| 5 | InsertNth | 按位置插入 | 找前驱、头部特判 | 是 | 是 | S |
| 6 | SortedInsert | 插入有序链表 | 前驱定位、local reference | 是 | 是 | A |
| 7 | InsertSort | 链表插入排序 | 拆节点、重建链 | 建议 | 建议 | B |
| 8 | Append | 拼接两条链 | 找尾、所有权转移 | 是 | 是 | A |
| 9 | FrontBackSplit | 前后拆分 | 快慢指针、断链 | 是 | 是 | A |
| 10 | RemoveDuplicates | 删除有序重复节点 | 相邻比较、删除后不前进 | 是 | 是 | S |
| 11 | MoveNode | 搬运首节点 | 两次改 head、节点复用 | 看懂 | 是 | B |
| 12 | AlternatingSplit | 奇偶位拆分 | MoveNode、尾指针 | 看懂 | 建议 | B |
| 13 | ShuffleMerge | 交替合并 | 双链推进、dummy | 看懂 | 可选 | C |
| 14 | SortedMerge | 合并两条有序链 | 双指针、dummy、MoveNode | 是 | 是 | S |
| 15 | MergeSort | 链表归并排序 | 拆分、递归、合并 | 是 | 是 | A |
| 16 | SortedIntersect | 有序链表交集 | 双指针、新建结果 | 建议 | 建议 | B |
| 17 | Reverse | 迭代逆置 | prev、cur、next | 是 | 是 | S |
| 18 | RecursiveReverse | 递归逆置 | 递归假设、回溯接链 | 是 | 是 | A |

---

## 01 Count

**问题是什么**

统计目标整数在链表中出现多少次。它不是求链表长度，只在 data 等于 target 时累加。

**Stanford 想训练什么**

最标准的遍历骨架：从 head 出发，以 null 为终止条件，每轮推进 current = current.next。

**Java 实现**

~~~java
static int count(Node head, int target) {
    int result = 0;
    for (Node current = head; current != null; current = current.next) {
        if (current.data == target) result++;
    }
    return result;
}
~~~

**C 实现**

~~~c
static int Count(Node *head, int target) {
    int count = 0;
    for (Node *current = head; current != NULL; current = current->next) {
        if (current->data == target) {
            count++;
        }
    }
    return count;
}
~~~

**指针变化**

~~~text
current
   |
   v
 [1] -> [2] -> [2] -> NULL
          ^      ^
          两次命中
~~~

**复杂度**

时间 O(n)，额外空间 O(1)。

**统考价值：A**

遍历本身必须熟练；Count 的业务目标简单，价值在于建立不漏节点、不多走一步的循环模板。

---

## 02 GetNth

**问题是什么**

按从 0 开始的 index 返回对应节点数据；合法范围是 [0, length - 1]。它刻意让链表看起来像数组，但访问代价完全不同。

**Stanford 想训练什么**

按位查找、off-by-one、越界处理，以及“链表下标访问是线性时间”。

**Java 实现**

~~~java
static int getNth(Node head, int index) {
    if (index < 0) throw new IndexOutOfBoundsException(index);

    Node current = head;
    for (int i = 0; current != null; i++, current = current.next) {
        if (i == index) return current.data;
    }
    throw new IndexOutOfBoundsException(index);
}
~~~

**C 实现**

~~~c
static int GetNth(Node *head, int index) {
    assert(index >= 0);
    int currentIndex = 0;

    for (Node *current = head; current != NULL; current = current->next) {
        if (currentIndex == index) {
            return current->data;
        }
        currentIndex++;
    }

    assert(!"GetNth index out of range");
    abort();
}
~~~

**指针变化**

~~~text
index:    0        1        2
head -> [42] ->  [13] ->  [666] -> NULL
                    ^
              GetNth(head, 1)
~~~

**复杂度**

最坏时间 O(n)，额外空间 O(1)。数组按下标访问通常是 O(1)。

**统考价值：S**

按位查找是链表基础操作；必须能解释 index 0、index length - 1、空表和 index length 四个边界。

---

## 03 DeleteList

**问题是什么**

删除整条链。C 必须逐节点 free 并把调用方 head 设为 NULL；Java 的核心是解除逻辑链接，实际内存由 GC 回收。

**Stanford 想训练什么**

在释放当前节点前保存后继，理解 Node** 为什么能改调用方 head。

**Java 实现**

~~~java
static Node deleteList(Node head) {
    Node current = head;
    while (current != null) {
        Node next = current.next;
        current.next = null;
        current = next;
    }
    return null;
}
~~~

Java 若只写 head = null，也能让“仅由 head 可达”的整条链等待 GC；逐个断开不是释放内存的必要条件，但更直观地表达逻辑删除，也避免其他外部引用继续沿旧链访问。

**C 实现**

~~~c
static void DeleteList(Node **headRef) {
    Node *current = *headRef;

    while (current != NULL) {
        Node *next = current->next;
        free(current);
        current = next;
    }

    *headRef = NULL;
}
~~~

**指针变化**

~~~text
current -> [A] -> [B] -> [C] -> NULL
next ----------> [B]

free(A) 之后：
current = next -> [B] -> [C] -> NULL
~~~

**复杂度**

时间 O(n)，额外空间 O(1)。

**统考价值：S**

重点不在 GC，而在“释放前保存 next”和“最后让 head 表示空表”。C 代码题、错误分析题都可能考这个顺序。

---

## 04 Pop

**问题是什么**

Push 的逆操作：从非空链表移除首元节点，返回其数据，并得到新的 head。

**Stanford 想训练什么**

解链、head 改写和 C 内存释放。节点是否还“长得完整”不重要；只要 head 不再经过它，它就已经不属于链表。

**Java 实现**

~~~java
static PopResult pop(Node head) {
    if (head == null) throw new NoSuchElementException("empty list");

    Node next = head.next;
    int value = head.data;
    head.next = null;
    return new PopResult(value, next);
}
~~~

调用：

~~~java
PopResult result = pop(head);
head = result.head();
int value = result.value();
~~~

**C 实现**

~~~c
static int Pop(Node **headRef) {
    assert(headRef != NULL && *headRef != NULL);

    Node *first = *headRef;
    int value = first->data;
    *headRef = first->next;
    free(first);
    return value;
}
~~~

**指针变化**

~~~text
before:
head -> [1] -> [2] -> [3] -> NULL

after:
        [1]    head -> [2] -> [3] -> NULL
         X
~~~

**复杂度**

时间 O(1)，额外空间 O(1)。

**统考价值：S**

它把删除首节点这个特殊情况讲透，也能检查是否误把 Java 的 node = null 当成“从链上删除”。

---

## 05 InsertNth

**问题是什么**

在合法范围 [0, length] 插入新节点。index 等于 length 是尾部插入；空表只允许 index 0。

**Stanford 想训练什么**

先找到 index - 1 位置的前驱，再改前驱的 next；index 0 必须改 head。原讲义借用 Push(&current->next, data) 表明 Push 可以修改任意链接槽位。

**Java 实现**

~~~java
static Node insertNth(Node head, int index, int value) {
    if (index < 0) throw new IndexOutOfBoundsException(index);
    if (index == 0) return new Node(value, head);

    Node previous = head;
    for (int i = 1; i < index; i++) {
        if (previous == null) throw new IndexOutOfBoundsException(index);
        previous = previous.next;
    }
    if (previous == null) throw new IndexOutOfBoundsException(index);

    previous.next = new Node(value, previous.next);
    return head;
}
~~~

**C 实现**

~~~c
static void InsertNth(Node **headRef, int index, int value) {
    assert(headRef != NULL && index >= 0);

    if (index == 0) {
        Push(headRef, value);
        return;
    }

    Node *previous = *headRef;
    for (int i = 1; i < index; i++) {
        assert(previous != NULL);
        previous = previous->next;
    }
    assert(previous != NULL);
    Push(&(previous->next), value);
}
~~~

**指针变化**

~~~text
插入 X 到 index 1：

previous
   |
   v
  [A] -> [B] -> [C]
          ^
          old next

X.next = previous.next
previous.next = X

[A] -> [X] -> [B] -> [C]
~~~

**复杂度**

定位时间 O(n)，实际改链 O(1)，额外空间 O(1)。

**统考价值：S**

必须能区分 add(size, x) 合法与 get(size) 非法，并解释“按位置插入”的总体复杂度仍是 O(n)。

---

## 06 SortedInsert

**问题是什么**

把一个已经存在、准备接入的节点插入升序链表。Stanford 强调复用节点，不重新复制 data。

**Stanford 想训练什么**

在第一个不小于 newNode.data 的节点前插入；比较 special case、dummy 和 local reference 三种写法。

**Java 实现**

~~~java
static Node sortedInsert(Node head, Node newNode) {
    if (newNode == null) throw new IllegalArgumentException("newNode");
    newNode.next = null;

    if (head == null || newNode.data <= head.data) {
        newNode.next = head;
        return newNode;
    }

    Node previous = head;
    while (previous.next != null && previous.next.data < newNode.data) {
        previous = previous.next;
    }
    newNode.next = previous.next;
    previous.next = newNode;
    return head;
}
~~~

**C 实现**

Local Reference 直接指向“应该被替换的链接槽位”：

~~~c
static void SortedInsert(Node **headRef, Node *newNode) {
    assert(headRef != NULL && newNode != NULL);

    Node **linkRef = headRef;
    while (*linkRef != NULL && (*linkRef)->data < newNode->data) {
        linkRef = &((*linkRef)->next);
    }

    newNode->next = *linkRef;
    *linkRef = newNode;
}
~~~

**指针变化**

~~~text
linkRef
   |
   v
  previous.next ----> [7]

插入 5：
newNode.next = *linkRef
*linkRef = newNode

previous -> [5] -> [7]
~~~

**复杂度**

时间 O(n)，额外空间 O(1)。

**统考价值：A**

有序链表插入常与合并、去重组合出现。C 的 linkRef 写法值得理解，但 Java 不必为了模仿 Node** 强造语法。

---

## 07 InsertSort

**问题是什么**

把原链节点逐个拆下，使用 SortedInsert 插入结果链，得到升序链表。

**Stanford 想训练什么**

重排现有节点而非复制；修改 current.next 前先保存 next。

**Java 实现**

~~~java
static Node insertSort(Node head) {
    Node result = null;
    Node current = head;

    while (current != null) {
        Node next = current.next;
        current.next = null;
        result = sortedInsert(result, current);
        current = next;
    }
    return result;
}
~~~

**C 实现**

~~~c
static void InsertSort(Node **headRef) {
    Node *result = NULL;
    Node *current = *headRef;

    while (current != NULL) {
        Node *next = current->next;
        current->next = NULL;
        SortedInsert(&result, current);
        current = next;
    }

    *headRef = result;
}
~~~

**指针变化**

~~~text
source: [3] -> [1] -> [2]
result: NULL

拆 3：source [1] -> [2]   result [3]
拆 1：source [2]          result [1] -> [3]
拆 2：source NULL         result [1] -> [2] -> [3]
~~~

**复杂度**

时间 O(n²)，额外空间 O(1)，节点原地重排。

**统考价值：B**

能体现链式插入排序，但排序章节更应掌握统一的比较、移动次数和稳定性分析，不必把此函数背成模板。

---

## 08 Append

**问题是什么**

把 b 整条接到 a 末尾。Stanford 的 C 语义还要求 b 设为 NULL，明确节点所有权已经转移。

**Stanford 想训练什么**

a 为空时必须改 aRef；无 tail 时要找到 a 的末节点；aRef、bRef 都可能被改。

**Java 实现**

~~~java
static Node append(Node a, Node b) {
    if (a == null) return b;

    Node tail = a;
    while (tail.next != null) {
        tail = tail.next;
    }
    tail.next = b;
    return a;
}
~~~

Java 调用方若还保留 b 变量，它仍指向原 b 首节点。若要模拟所有权转移，调用后显式执行 b = null；这不是语言强制，而是调用约定。

**C 实现**

~~~c
static void Append(Node **aRef, Node **bRef) {
    assert(aRef != NULL && bRef != NULL);

    if (*aRef == NULL) {
        *aRef = *bRef;
    } else {
        Node *tail = *aRef;
        while (tail->next != NULL) {
            tail = tail->next;
        }
        tail->next = *bRef;
    }

    *bRef = NULL;
}
~~~

**指针变化**

~~~text
a -> [1] -> [2] -> NULL
b -> [3] -> [4] -> NULL

tail.next = b
b = NULL

a -> [1] -> [2] -> [3] -> [4] -> NULL
b -> NULL
~~~

**复杂度**

无 tail 时 O(length(a))；若结构长期维护 tail，则接入动作可为 O(1)。

**统考价值：A**

考点是找尾、空表特判与所有权。只写“链表拼接 O(1)”必须说明已经持有 a 的尾指针。

---

## 09 FrontBackSplit

**问题是什么**

把一条链拆成前后两条；长度为奇数时，前半段多一个节点。{2, 3, 5, 7, 11} 拆成 {2, 3, 5} 与 {7, 11}。

**Stanford 想训练什么**

讲义给出两种方案：先计数再走到切点；或 slow 每次一步、fast 每次两步。后者只遍历一趟，是必须重点掌握的快慢指针模型。

**Java 实现**

~~~java
static SplitResult frontBackSplit(Node source) {
    if (source == null || source.next == null) {
        return new SplitResult(source, null);
    }

    Node slow = source;
    Node fast = source.next;

    while (fast != null) {
        fast = fast.next;
        if (fast != null) {
            slow = slow.next;
            fast = fast.next;
        }
    }

    Node back = slow.next;
    slow.next = null;
    return new SplitResult(source, back);
}
~~~

**C 实现**

~~~c
static void FrontBackSplit(Node *source, Node **frontRef, Node **backRef) {
    assert(frontRef != NULL && backRef != NULL);

    if (source == NULL || source->next == NULL) {
        *frontRef = source;
        *backRef = NULL;
        return;
    }

    Node *slow = source;
    Node *fast = source->next;

    while (fast != NULL) {
        fast = fast->next;
        if (fast != NULL) {
            slow = slow->next;
            fast = fast->next;
        }
    }

    *frontRef = source;
    *backRef = slow->next;
    slow->next = NULL;
}
~~~

**指针变化**

以 5 个节点为例：

~~~text
初始：
slow
 |
 v
[2] -> [3] -> [5] -> [7] -> [11] -> NULL
        ^
        |
       fast

每轮 slow 走 1，fast 走 2：

               slow
                 |
                 v
[2] -> [3] -> [5] -> [7] -> [11] -> NULL
                               ^
                               |
                              fast

fast 到末尾后：
back = slow.next
slow.next = NULL

front: [2] -> [3] -> [5] -> NULL
back:  [7] -> [11] -> NULL
~~~

为什么 fast 从 source.next 开始？这样偶数长度时前后等长，奇数长度时额外节点留在 front。真正拆链的关键不是找到中点，而是执行 slow.next = NULL；漏掉这句，两条“结果链”仍共享后半段。

边界推演：

| 长度 | front | back |
| --- | --- | --- |
| 0 | 空 | 空 |
| 1 | 1 个 | 空 |
| 2 | 1 个 | 1 个 |
| 3 | 2 个 | 1 个 |
| 4 | 2 个 | 2 个 |
| 5 | 3 个 | 2 个 |

**复杂度**

时间 O(n)，额外空间 O(1)。

**统考价值：A**

直接对应找中点，也迁移到倒数第 k 个节点、快慢关系和链表结构判断。这里先掌握“速度差 + 终止条件”，不扩展成题库合集。

---

## 10 RemoveDuplicates

**问题是什么**

删除升序链表中的重复节点。因为相同值相邻，只需比较 current 与 current.next。

**Stanford 想训练什么**

删除后不能无条件前进；同一 current 可能还要继续删除多个重复后继。C 还要保存被删节点并 free。

**Java 实现**

~~~java
static Node removeDuplicates(Node head) {
    Node current = head;

    while (current != null && current.next != null) {
        if (current.data == current.next.data) {
            Node duplicate = current.next;
            current.next = duplicate.next;
            duplicate.next = null;
        } else {
            current = current.next;
        }
    }
    return head;
}
~~~

**C 实现**

~~~c
static void RemoveDuplicates(Node *head) {
    Node *current = head;

    while (current != NULL && current->next != NULL) {
        if (current->data == current->next->data) {
            Node *duplicate = current->next;
            current->next = duplicate->next;
            free(duplicate);
        } else {
            current = current->next;
        }
    }
}
~~~

**指针变化**

~~~text
current
   |
   v
  [2] -> [2] -> [2] -> [5]
           X

删除第一个重复节点后 current 不动：
  [2] ------> [2] -> [5]
   ^
   继续比较
~~~

**复杂度**

时间 O(n)，额外空间 O(1)。

**统考价值：S**

是“删除节点 + 连续重复 + 指针推进条件”的典型综合题。前提是链表有序；无序链表不能只比较相邻节点。

---

## 11 MoveNode

**问题是什么**

从 source 头部摘下一个现有节点，再压到 dest 头部，不分配新节点。

**Stanford 想训练什么**

把 Push 的“新建节点”替换为“搬运节点”，同时修改 source 和 dest 两个 head。它是后续 AlternatingSplit 与 SortedMerge 的工具。

**Java 实现**

~~~java
static MoveResult moveNode(Node dest, Node source) {
    if (source == null) throw new NoSuchElementException("empty source");

    Node moved = source;
    source = source.next;
    moved.next = dest;
    dest = moved;
    return new MoveResult(dest, source);
}
~~~

**C 实现**

~~~c
static void MoveNode(Node **destRef, Node **sourceRef) {
    assert(destRef != NULL && sourceRef != NULL && *sourceRef != NULL);

    Node *moved = *sourceRef;
    *sourceRef = moved->next;
    moved->next = *destRef;
    *destRef = moved;
}
~~~

**指针变化**

~~~text
dest   -> [D1] -> [D2]
source -> [S1] -> [S2]

摘 S1，再接到 dest：

dest   -> [S1] -> [D1] -> [D2]
source -> [S2]
~~~

**复杂度**

时间 O(1)，额外空间 O(1)。

**统考价值：B**

不是常见独立考点，但非常适合练习“一个节点从哪条链离开，又从哪条链进入”。

---

## 12 AlternatingSplit

**问题是什么**

把原链奇数位置节点放入 a，偶数位置节点放入 b。Stanford 允许结果顺序反转，并给出 MoveNode 头插与 dummy 尾插两类方案。

**Stanford 想训练什么**

复用节点、交替分发，以及选择“头插简单但逆序”还是“尾插保持顺序”。

**Java 实现**

下面用 dummy 保持原顺序：

~~~java
static SplitResult alternatingSplit(Node source) {
    Node aDummy = new Node(0);
    Node bDummy = new Node(0);
    Node aTail = aDummy;
    Node bTail = bDummy;
    boolean toA = true;

    Node current = source;
    while (current != null) {
        Node next = current.next;
        current.next = null;

        if (toA) {
            aTail.next = current;
            aTail = current;
        } else {
            bTail.next = current;
            bTail = current;
        }

        toA = !toA;
        current = next;
    }

    return new SplitResult(aDummy.next, bDummy.next);
}
~~~

**C 实现**

~~~c
static void AlternatingSplit(Node *source, Node **aRef, Node **bRef) {
    Node *a = NULL;
    Node *b = NULL;
    Node **aTailRef = &a;
    Node **bTailRef = &b;

    while (source != NULL) {
        MoveNode(aTailRef, &source);
        aTailRef = &((*aTailRef)->next);

        if (source != NULL) {
            MoveNode(bTailRef, &source);
            bTailRef = &((*bTailRef)->next);
        }
    }

    *aRef = a;
    *bRef = b;
}
~~~

**指针变化**

~~~text
source: A -> B -> C -> D -> E
a:      A -> C -> E
b:      B -> D
~~~

**复杂度**

时间 O(n)，额外空间 O(1)，不计输出链本身。

**统考价值：B**

理解拆链和尾指针即可；不必背 Stanford 的四种构造变体。

---

## 13 ShuffleMerge

**问题是什么**

从 a、b 交替取节点合并；某条链先耗尽后，直接接上另一条剩余链。

**Stanford 想训练什么**

同一题比较 dummy、MoveNode、local reference 与递归四种写法，认识多种指针抽象的等价性。

**Java 实现**

~~~java
static Node shuffleMerge(Node a, Node b) {
    Node dummy = new Node(0);
    Node tail = dummy;

    while (a != null && b != null) {
        Node aNext = a.next;
        Node bNext = b.next;

        tail.next = a;
        tail = a;
        tail.next = b;
        tail = b;

        a = aNext;
        b = bNext;
    }

    tail.next = a != null ? a : b;
    return dummy.next;
}
~~~

**C 实现**

~~~c
static Node *ShuffleMerge(Node *a, Node *b) {
    Node dummy = {0, NULL};
    Node *tail = &dummy;

    while (a != NULL && b != NULL) {
        Node *aNext = a->next;
        Node *bNext = b->next;

        tail->next = a;
        tail = a;
        tail->next = b;
        tail = b;

        a = aNext;
        b = bNext;
    }

    tail->next = a != NULL ? a : b;
    return dummy.next;
}
~~~

**指针变化**

~~~text
a: 1 -> 2 -> 3
b: 7 -> 8

result: 1 -> 7 -> 2 -> 8 -> 3
~~~

**复杂度**

时间 O(n + m)，额外空间 O(1)。

**统考价值：C**

主要价值是比较实现风格；对目标考试的直接收益低于有序合并、逆置和拆分。

---

## 14 SortedMerge

**问题是什么**

把两条升序链表合成一条升序链表，复用原节点，不创建数据节点。

**Stanford 想训练什么**

每次比较 a、b 头节点，把较小节点移动到结果尾部；处理结果为空、任一输入为空和剩余链一次接入。

### Java：dummy 写法

~~~java
static Node sortedMerge(Node a, Node b) {
    Node dummy = new Node(0);
    Node tail = dummy;

    while (a != null && b != null) {
        if (a.data <= b.data) {
            Node next = a.next;
            tail.next = a;
            a = next;
        } else {
            Node next = b.next;
            tail.next = b;
            b = next;
        }
        tail = tail.next;
    }

    tail.next = a != null ? a : b;
    return dummy.next;
}
~~~

### C：Stanford 的 MoveNode + Local Reference 思路

~~~c
static Node *SortedMerge(Node *a, Node *b) {
    Node *result = NULL;
    Node **lastPtrRef = &result;

    while (a != NULL && b != NULL) {
        if (a->data <= b->data) {
            MoveNode(lastPtrRef, &a);
        } else {
            MoveNode(lastPtrRef, &b);
        }
        lastPtrRef = &((*lastPtrRef)->next);
    }

    *lastPtrRef = a != NULL ? a : b;
    return result;
}
~~~

### 指针变化

~~~text
a: 1 -> 3 -> 7
b: 2 -> 4 -> 6

初始：
dummy
  |
  v
 [D] -> NULL
tail = D

取 a 的 1：
[D] -> [1] -> NULL
        ^
       tail
a: 3 -> 7
b: 2 -> 4 -> 6

取 b 的 2：
[D] -> [1] -> [2] -> NULL
               ^
              tail
a: 3 -> 7
b: 4 -> 6
~~~

dummy 写法让“第一个结果节点”也变成 tail.next 的普通写入，适合 Java 和生产代码。Stanford 的 local reference 不创建 dummy，而让 lastPtrRef 直接指向 result 或最后节点的 next；它更难读，但清楚暴露了“我们真正修改的是链接槽位”。

使用 <= 选择 a，可以保持来自 a、b 各自的相对顺序，合并是稳定的。

**复杂度**

时间 O(n + m)，额外空间 O(1)。

**统考价值：S**

有序链表合并是线性表高频综合操作。必须能画出 a、b、tail 三者，而不是只背 dummy 模板。

---

## 15 MergeSort

**问题是什么**

在链表上做归并排序：FrontBackSplit 拆成两半，递归排序两半，再 SortedMerge。

**Stanford 想训练什么**

组合已经掌握的拆分与合并。原文指出它反而比 FrontBackSplit 和 SortedMerge 本身更容易，因为控制结构很清楚。

**Java 实现**

~~~java
static Node mergeSort(Node head) {
    if (head == null || head.next == null) return head;

    SplitResult split = frontBackSplit(head);
    Node left = mergeSort(split.front());
    Node right = mergeSort(split.back());
    return sortedMerge(left, right);
}
~~~

**C 实现**

~~~c
static void MergeSort(Node **headRef) {
    Node *head = *headRef;
    if (head == NULL || head->next == NULL) {
        return;
    }

    Node *a;
    Node *b;
    FrontBackSplit(head, &a, &b);
    MergeSort(&a);
    MergeSort(&b);
    *headRef = SortedMerge(a, b);
}
~~~

**指针变化**

~~~text
4 -> 1 -> 3 -> 2
       split
   /             \
4 -> 1         3 -> 2
 /   \          /   \
4     1        3     2
 \   /          \   /
1 -> 4         2 -> 3
       \       /
      1 -> 2 -> 3 -> 4
~~~

链表适合 MergeSort 的原因：

- 合并主要改 next，不需要像数组那样搬移一段元素。
- 不依赖随机访问。
- 选择 a.data <= b.data 时可稳定。
- 平衡拆分后递归深度是 O(log n)。

注意：拆分本身仍要走链，整轮不是 O(1)。整体时间 O(n log n)，递归栈 O(log n)；若 SortedMerge 也用递归，合并层可能额外占 O(n) 栈，所以本文使用迭代合并。

**复杂度**

时间 O(n log n)，平衡递归栈 O(log n)；迭代合并本身只使用 O(1) 额外指针。

**统考价值：A**

它是链表上的归并排序实例。这里掌握拆、排、合三步即可；完整排序理论应放在排序章节统一学习。

---

## 16 SortedIntersect

**问题是什么**

求两条升序链表的交集，返回一条新链，不能破坏输入链。两头相等时复制值；不等时推进较小者。

**Stanford 想训练什么**

利用“有序”让两条链各走一遍，并区分 Push 新建节点与 MoveNode 复用节点的语义。

**Java 实现**

~~~java
static Node sortedIntersect(Node a, Node b) {
    Node dummy = new Node(0);
    Node tail = dummy;

    while (a != null && b != null) {
        if (a.data == b.data) {
            tail.next = new Node(a.data);
            tail = tail.next;
            a = a.next;
            b = b.next;
        } else if (a.data < b.data) {
            a = a.next;
        } else {
            b = b.next;
        }
    }

    return dummy.next;
}
~~~

**C 实现**

~~~c
static Node *SortedIntersect(const Node *a, const Node *b) {
    Node dummy = {0, NULL};
    Node *tail = &dummy;

    while (a != NULL && b != NULL) {
        if (a->data == b->data) {
            tail->next = NewNode(a->data);
            tail = tail->next;
            a = a->next;
            b = b->next;
        } else if (a->data < b->data) {
            a = a->next;
        } else {
            b = b->next;
        }
    }

    return dummy.next;
}
~~~

**指针变化**

~~~text
a: 1 -> 3 -> 5 -> 7
b: 2 -> 3 -> 6 -> 7

1 < 2：a 前进
2 < 3：b 前进
3 = 3：复制 3
5 < 6：a 前进
6 < 7：b 前进
7 = 7：复制 7

result: 3 -> 7
~~~

**复杂度**

时间 O(n + m)，新结果最坏 O(min(n, m)) 空间。

**统考价值：B**

双指针思想值得掌握，但链表交集新建结果不是最核心操作。注意这里的“交集”是按值比较，不是判断两条链是否共享同一节点。

---

## 17 Reverse

**问题是什么**

只改 next 和 head，用一趟遍历把链表原地逆置。

**Stanford 想训练什么**

同时维护前、中、后三个位置。本文使用更常见的 prev、cur、next 命名，与原文 back、middle、front 一一对应。

**Java 实现**

~~~java
static Node reverse(Node head) {
    Node prev = null;
    Node cur = head;

    while (cur != null) {
        Node next = cur.next;
        cur.next = prev;
        prev = cur;
        cur = next;
    }

    return prev;
}
~~~

**C 实现**

~~~c
static void Reverse(Node **headRef) {
    Node *prev = NULL;
    Node *cur = *headRef;

    while (cur != NULL) {
        Node *next = cur->next;
        cur->next = prev;
        prev = cur;
        cur = next;
    }

    *headRef = prev;
}
~~~

**指针变化**

初始：

~~~text
prev     cur        next
NULL     A          B
          \        /
           v      v
          [A] -> [B] -> [C] -> NULL
~~~

第一轮先保存 B，再反转 A.next：

~~~text
NULL <- [A]    [B] -> [C] -> NULL
         ^      ^
        prev   cur
~~~

第二轮：

~~~text
NULL <- [A] <- [B]    [C] -> NULL
                 ^      ^
                prev   cur
~~~

结束：

~~~text
NULL <- [A] <- [B] <- [C]
                         ^
                        prev

new head = prev
即 [C] -> [B] -> [A] -> NULL
~~~

四句顺序不能随意交换：

1. next = cur.next：保存旧链入口。
2. cur.next = prev：反转当前边。
3. prev = cur：已反转区间向前扩一格。
4. cur = next：回到尚未处理的旧链。

**复杂度**

时间 O(n)，额外空间 O(1)。

**统考价值：S**

必须闭眼写并能解释每个变量。不只记结果，还要能指出少保存 next 会在哪里断链。

---

## 18 RecursiveReverse

**问题是什么**

递归逆置整条链。核心不是“记住两句神奇代码”，而是接受递归假设：从第二个节点开始的 rest 已经被正确逆置。

**Stanford 想训练什么**

分清递归下去解决什么，回溯时如何把 first 接到 rest 的尾部。

**Java 实现**

~~~java
static Node recursiveReverse(Node head) {
    if (head == null || head.next == null) return head;

    Node newHead = recursiveReverse(head.next);
    head.next.next = head;
    head.next = null;
    return newHead;
}
~~~

**C 实现**

~~~c
static void RecursiveReverse(Node **headRef) {
    Node *first = *headRef;
    if (first == NULL || first->next == NULL) {
        return;
    }

    Node *rest = first->next;
    RecursiveReverse(&rest);

    first->next->next = first;
    first->next = NULL;
    *headRef = rest;
}
~~~

**指针变化**

以 A -> B -> C 为例。递归调用先处理 B -> C，回溯时已知：

~~~text
rest
 |
 v
[C] -> [B] -> NULL

first -> [A] ----> [B]
                  ^
            first.next
~~~

此时 first.next 仍是 B，所以：

~~~text
first.next.next = first

[C] -> [B] -> [A]
        ^
        B.next 改为 A
~~~

但 A.next 仍指向 B，会形成 A <-> B 环，因此必须紧接着：

~~~text
first.next = null

[C] -> [B] -> [A] -> NULL
~~~

递归下去做的是“逆置 rest”；回溯时做的是“把 first 放到已逆置 rest 的末尾”。newHead 始终是原链最后一个节点 C。

**复杂度**

时间 O(n)，递归栈 O(n)。

**统考价值：A**

必须看懂并至少手写一次，但工程中长链可能栈溢出，迭代版更稳。考试若给补空题，重点通常就是 head.next.next = head 与 head.next = null 的先后和含义。

---

## 七、Java 版统一 smoke test

将下面方法与前述 18 个 Java 方法一起放入 StanfordLinkedListLab。它覆盖每个操作的至少
一个主路径；练习时还应追加空表、单节点和非法下标。

~~~java
static void assertList(Node head, int... expected) {
    Node current = head;
    for (int value : expected) {
        if (current == null || current.data != value) {
            throw new AssertionError("list mismatch");
        }
        current = current.next;
    }
    if (current != null) throw new AssertionError("list has extra nodes");
}

static void check(boolean condition, String message) {
    if (!condition) throw new AssertionError(message);
}

public static void main(String[] args) {
    check(count(of(1, 2, 2), 2) == 2, "Count");
    check(getNth(of(4, 5, 6), 1) == 5, "GetNth");
    check(deleteList(of(1, 2, 3)) == null, "DeleteList");

    PopResult popped = pop(of(1, 2, 3));
    check(popped.value() == 1, "Pop value");
    assertList(popped.head(), 2, 3);

    assertList(insertNth(of(1, 3), 1, 2), 1, 2, 3);
    assertList(sortedInsert(of(1, 3, 5), new Node(4)), 1, 3, 4, 5);
    assertList(insertSort(of(3, 1, 2)), 1, 2, 3);
    assertList(append(of(1, 2), of(3, 4)), 1, 2, 3, 4);

    SplitResult halves = frontBackSplit(of(1, 2, 3, 4, 5));
    assertList(halves.front(), 1, 2, 3);
    assertList(halves.back(), 4, 5);

    assertList(removeDuplicates(of(1, 1, 1, 2, 2, 3)), 1, 2, 3);

    MoveResult moved = moveNode(of(9), of(1, 2));
    assertList(moved.dest(), 1, 9);
    assertList(moved.source(), 2);

    SplitResult alternating = alternatingSplit(of(1, 2, 3, 4, 5));
    assertList(alternating.front(), 1, 3, 5);
    assertList(alternating.back(), 2, 4);

    assertList(shuffleMerge(of(1, 2, 3), of(7, 8)), 1, 7, 2, 8, 3);
    assertList(sortedMerge(of(1, 3, 7), of(2, 4, 6)), 1, 2, 3, 4, 6, 7);
    assertList(mergeSort(of(4, 1, 3, 2)), 1, 2, 3, 4);
    assertList(sortedIntersect(of(1, 3, 5, 7), of(2, 3, 6, 7)), 3, 7);
    assertList(reverse(of(1, 2, 3)), 3, 2, 1);
    assertList(recursiveReverse(of(1, 2, 3)), 3, 2, 1);
}
~~~

运行：

~~~bash
javac StanfordLinkedListLab.java
java StanfordLinkedListLab
~~~

无输出表示断言全部通过。

---

## 八、Java 程序员最容易犯的链表错误

### 1. 把 dummy 当成 index 0

dummy 不属于业务数据。若 dummy.next 是第一个数据节点，则 get(0) 应返回 dummy.next.data，而不是 dummy.data。

### 2. 修改 next 前没有保存后继

~~~java
cur.next = prev;
cur = cur.next;
~~~

第二句走回了 prev，不再沿旧链前进。必须在覆盖前保存 next。

### 3. 以为 node = null 等于删除节点

~~~java
node = null;
~~~

只改变当前局部变量，不会自动修改前驱的 next。逻辑删除必须让 predecessor.next 跳过目标节点。GC 只负责回收不可达对象，不负责维护链表关系。

### 4. get(index) 的 off-by-one

第一个节点是 index 0。循环变量表示“当前节点的 index”，不要同时在循环头和循环体各加一次。

### 5. 混淆 add(size, x) 与 get(size)

长度为 size 的表，合法数据下标是 [0, size - 1]；插入位置是 [0, size]。尾插位置 size 合法，读取 size 越界。

### 6. 只背“链表插入 O(1)”

若已持有前驱，改两条链接是 O(1)；若只给 index 或 value，需要先查找，整体通常 O(n)。

### 7. 把 Java 引用当成 C 指针完全等价

两者都能表达节点关系，但 Java 不能取局部变量地址，也没有直接对应 &head 的 Node**。Java 是引用值的值传递，内存释放由 GC 管理。

### 8. 删除后无条件 current = current.next

RemoveDuplicates 删除 current.next 后，应继续用同一个 current 检查新后继，否则连续三个重复值会漏删一个。

### 9. 拆链只返回两个入口，却没有断开 slow.next

两个变量指向不同位置，不代表已经形成两条独立链。必须切断前半段尾部的 next。

### 10. 复用节点时忘记所有权

SortedMerge、MoveNode 会重排原节点。合并后继续把旧 a、b 当独立链使用，容易出现共享、重复遍历或二次释放。

---

## 九、Java 到 C 的最小迁移表

| Java | C | 语义差异 |
| --- | --- | --- |
| Node p | Node *p | 都保存节点位置；C 是裸指针 |
| p.next | p->next | C 通过指针访问字段 |
| null | NULL | 都表示无有效后继 |
| new Node(v) | malloc(sizeof(Node)) | C 要检查分配并初始化字段 |
| GC | free(node) | C 释放后不得再解引用 |
| return newHead | 返回 Node * 或接收 Node ** | C 可直接改调用方 head |
| 无直接对应 | &head | 获取 head 变量地址 |
| 无直接对应 | &node->next | 获取节点内部链接槽位地址 |
| Node[] | Node *array[] | Java 是引用数组；C 这是指针数组 |
| Node[] | Node array[] | C 这是连续存放的结构体数组 |
| 包装对象 ListState | struct List { Node *head; Node *tail; } | 都可避免频繁传 Node** |

最小翻译规则：

~~~text
Java 看到 p.next
   -> C 写 p->next

Java 方法需要返回新 head
   -> C 可返回 Node*
   -> 或传 Node **headRef

Java 里断开逻辑链接
   -> C 还要决定谁负责 free
~~~

---

## 十、原讲义的历史代码应如何阅读

两份 PDF 发布于上世纪九十年代，算法思想依然清楚，但扫描版/讲义代码中有少量明显排版或变量名问题：

- Basics 的 AppendNode 声明为返回 struct node*，函数体却不返回；按语义应视为 void，或改为返回 head。
- Basics 的 dummy CopyList 版本有一行 current = current->next 落在 while 外的排版问题。
- Basics 的递归 CopyList 参数名是 head，函数体却出现 current，应按 head 读取。
- Problems 的题面 MergeSort 参数少一层星号，解答区正确使用 struct node**。
- Problems 的 SortedInsert local-reference 版本有一处疑似 next 层级笔误；正确链接顺序应是 newNode->next = *linkRef，再执行 *linkRef = newNode。

阅读旧资料时应保留算法，不应把明显的印刷错误也当成“原汁原味”照抄。本文的 Java、C 版本统一按现代编译器可检查的写法重建。

---

## 十一、统考链表最小掌握集

如果最终目标是计算机基础统考，不需要背下 Stanford 所有 18 个答案。

### 必须闭眼写

1. 单链表遍历与长度/计数。
2. 按位查找，分清读取范围与插入范围。
3. 头插、尾插及其复杂度条件。
4. 按位置插入与删除，能定位前驱。
5. Pop 与删除整链，能处理 head 变化。
6. 迭代 Reverse，能画 prev、cur、next。
7. 两条有序链表 SortedMerge。
8. 有序链表 RemoveDuplicates。
9. 快慢指针找中点并正确断链。

### 必须看懂并写过一次

1. dummy node 与无 dummy 表示的互换。
2. Node** 修改 head 与 node->next。
3. FrontBackSplit 的奇偶边界。
4. RecursiveReverse 的递归假设与回溯接链。
5. 链表 MergeSort 的拆、排、合。
6. 双链表插入删除时前后两侧指针更新。
7. 循环链表以“回到起点”而不是 NULL 为终止条件。

### 只需知道结构与用途

1. MoveNode、AlternatingSplit、ShuffleMerge 的指针训练价值。
2. 静态链表用数组下标 cursor 模拟 next。
3. 带 tail、length 的头部结构如何换取更快操作。
4. chunk list、动态数组等 Stanford 附录变体的取舍。

---

## 十二、推荐 Coding 顺序

不要机械按 PDF 页码推进。按依赖关系练：

~~~text
Node 与内存图
  ↓
遍历
  ↓
Count / GetNth
  ↓
Push / Pop
  ↓
InsertNth
  ↓
DeleteList
  ↓
Append
  ↓
SortedInsert
  ↓
Reverse
  ↓
RemoveDuplicates
  ↓
FrontBackSplit
  ↓
SortedMerge
  ↓
RecursiveReverse
  ↓
MergeSort
  ↓
MoveNode / AlternatingSplit / ShuffleMerge / SortedIntersect
~~~

每个 S 级方法至少过以下用例：

| 类型 | 示例 |
| --- | --- |
| 空表 | null |
| 单节点 | 1 |
| 两节点 | 1 -> 2 |
| 奇数长度 | 1 -> 2 -> 3 |
| 偶数长度 | 1 -> 2 -> 3 -> 4 |
| 重复值 | 1 -> 1 -> 1 -> 2 |
| 已有序 | 1 -> 2 -> 3 |
| 逆序 | 3 -> 2 -> 1 |
| 边界下标 | 0、length - 1、length |

建议用以下命令建立零依赖 Java/C 实验：

~~~bash
javac StanfordLinkedListLab.java
java StanfordLinkedListLab

cc -std=c11 -Wall -Wextra -Werror stanford_linked_list_lab.c -o linked-list-lab
./linked-list-lab
~~~

---

## 十三、一页复盘

~~~text
数组：
下一个位置由地址计算

链表：
下一个位置保存在 next

head：
保存首元节点入口，不是节点本身

dummy：
用一个非业务节点统一头部特判

Node**：
指向“节点指针变量或 next 字段”的地址
用于修改调用方的链接槽位

改链原则：
覆盖 next 前，先保存旧链唯一入口

三类关键操作：
找前驱
改链接
处理 head

三个核心组合：
FrontBackSplit + SortedMerge = MergeSort
prev + cur + next = Reverse
slow 走 1 + fast 走 2 = 中点
~~~

Stanford 的目标从来不是让你背 18 个函数，而是让你能在脑中看见栈变量、堆节点和每一条 next。Java 降低了裸指针风险，却没有替你消除引用关系；真正掌握链表的标志，是每次写入 next 之前，你都知道旧链还从哪里能找到。
