---
title: "在职 Java 工程师的数据结构统考 Coding 实战指南"
date: "2026-09-01"
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
summary: "面向在职 Java 工程师，用可运行代码、C 对照、手工推演和 Debug 系统掌握全国统考数据结构。"
tags:
  - 计算机学科专业基础
  - 数据结构
  - Java
  - C
  - 算法
---

# 在职 Java 工程师的数据结构统考 Coding 实战指南

> 这不是算法竞赛路线，也不是 Java 集合框架使用手册。目标是把统考试卷中的结构、性质、C 代码和手算过程，转换成可以在公司电脑上运行、暂停、观察和改写的最小实验。

## 一、范围、依据与使用方式

### 1. 内容审计依据

本文于 2026-09-02 重新核验公开资料。截至核验日，没有在教育部、研招网或高等教育出版社公开页面检索到标明下一年度的正式计算机科目大纲。当前可公开核验的最近正式出版资料，是高等教育出版社 2025 年印次、出版日期为 2025-10-15 的《全国硕士研究生招生考试计算机学科专业基础考试大纲解析》。其数据结构部分仍按七章组织：

1. 基本概念。
2. 线性表。
3. 栈、队列和数组。
4. 树与二叉树。
5. 图。
6. 查找，其中包含字符串模式匹配。
7. 排序，其中包含外部排序。

本文按这套公开目录逐项补齐，但正式应试范围始终以报考年度正式发布的大纲为最高依据。本文不会把辅导机构目录、个人经验或工程常识冒充正式范围。

参考资料：

- [高教社《计算机学科专业基础考试大纲解析》公开目录](https://xuanshu.hep.com.cn/front/h5Mobile/bookDetails?bookId=68b8764ae119ac9729e8a8bc)
- [高教社配套习题公开目录](https://xuanshu.hep.com.cn/front/h5Mobile/bookDetails?bookId=6852f178e119ac9729287abb)
- [高教社《数据结构：用 C 语言描述（第 3 版）》](https://xuanshu.hep.com.cn/front/book/findBookDetails?bookId=6052fbafadb85dae6a2f3dab)
- [研招网公开的计算机学科考试大纲资料](https://yz.chsi.com.cn/kyzx/zyk/201209/20120917/343200917.html)
- [教育部 2026 年全国硕士研究生招生工作管理规定](https://www.moe.gov.cn/srcsite/A15/moe_778/s3261/202509/t20250918_1413836.html)

### 2. 三种视角必须同时建立

| 视角 | 每次要回答的问题 | 常见失误 |
| --- | --- | --- |
| 结构视角 | 元素之间是什么关系，内存里怎样表示 | 把线性表等同于数组，把树等同于二叉链表 |
| 算法视角 | 不变量是什么，哪个变量推进，何时终止 | 只背代码，不知道循环为何正确 |
| 试题视角 | 会考性质、手算、补代码还是复杂度 | 会调用 API，却不会画中间状态 |

工程类比只用于帮助理解，会明确标为“工程延伸”。它不能替代教材定义，也不能据此删减考试知识。

### 3. 统一学习层级

每种数据结构都按同一逻辑展开：

```text
它是什么
  -> 如何存储
  -> 最小定义
  -> CRUD
  -> 复杂度
  -> 高频性质
  -> 常见算法
  -> Java Coding
  -> C 对照
  -> Debug 变量
  -> 典型手算
  -> 优先级
```

代码训练分三级：

| 层级 | 验收标准 | 典型内容 |
| --- | --- | --- |
| S | 不看资料独立写出，能解释变量、不变量、边界和复杂度 | 顺序表、单链表、栈队列、KMP、树遍历、BFS/DFS、折半、Hash、快速/堆/归并排序 |
| A | 能补全核心循环并完整手算，知道成立条件 | AVL、Prim、Kruskal、Dijkstra、Floyd、拓扑排序、关键路径 |
| B | 能画结构、判断性质、解释操作，不要求完整工程实现 | 静态链表、线索树、红黑树、B/B+ 树、外部排序 |

### 4. 碎片时间闭环

一次 30 分钟只完成一个最小闭环：

```text
5 分钟：写清输入、输出、结构约定
15 分钟：不用集合框架写核心代码
5 分钟：断点观察关键变量
5 分钟：记录复杂度、边界和错因
```

60 分钟时增加空结构、单元素、重复值、逆序、越界或不连通测试。90 分钟时再做 Java 与 C 双写。不要把“看完一章”当作完成。

## 二、零依赖实验室

```text
data-structure-algorithm-lab/
├── src/
│   ├── linear/
│   ├── stackqueue/
│   ├── string/
│   ├── tree/
│   ├── graph/
│   ├── search/
│   └── sort/
├── c/
├── cases/
└── notes/
```

每个实验保留一个 `main`，不用 Maven、Spring 或第三方依赖：

```bash
javac -d out src/linear/SeqList.java
java -cp out linear.SeqList
```

“能编译”只证明语法成立，“一个样例通过”也不证明算法正确。每个实验至少保留：

- 正常例。
- 最小例。
- 边界例。
- 退化例。
- 一个故意写错后可观察的故障例。

## 三、Java 程序员需要的最小 C 基础

| C | Java 思维 | 关键差异 |
| --- | --- | --- |
| `int a[100]` | `new int[100]` | C 数组通常不携带长度 |
| `Node *p` | `Node p` | Java 变量保存对象引用值 |
| `p->next` | `p.next` | `->` 通过指针访问成员 |
| `*p` | `p` 指向的对象或值 | 声明和表达式中的 `*` 含义不同 |
| `&x` | 无直接对应 | 取得变量地址 |
| `struct Node` | `class Node` | C 结构体不管理生命周期 |
| `malloc/free` | `new`/GC | C 需要显式释放 |
| `NULL` | `null` | 都表示无有效目标 |
| `Node **head` | 返回新头，或传包装对象 | 二级指针可修改调用方保存的头指针 |

```c
typedef struct Node {
    int data;
    struct Node *next;
} Node;

Node *push_front(Node *head, int value) {
    Node *node = malloc(sizeof(*node));
    if (node == NULL) return head;
    node->data = value;
    node->next = head;
    return node;
}
```

Java 永远是值传递。对象引用也是一个被复制的值，所以函数能修改 `node.next`，却不能直接替换调用方变量 `head`；常见做法是返回新头节点。

## 四、基本概念与算法评价

### 1. 数据结构不是一个类名

```text
数据结构 = 逻辑结构 + 存储结构 + 数据运算
```

| 术语 | 含义 | 示例 |
| --- | --- | --- |
| 数据元素 | 讨论中的基本单位 | 一名学生、一个顶点 |
| 数据项 | 元素中的字段 | 学号、边权 |
| 数据对象 | 性质相同的元素集合 | 全部顶点 |
| 逻辑结构 | 元素之间的抽象关系 | 集合、线性、树形、图状 |
| 存储结构 | 关系在内存中的实现 | 顺序、链式、索引、散列 |
| ADT | 数据对象、关系和操作语义 | `List` 的接口契约 |

同一个 ADT 可以有多种存储实现。`List` 表示逻辑上的线性表，顺序表和链表才是物理实现。

### 2. 算法评价

算法通常具有有穷性、确定性、可行性，可以有零个或多个输入，但至少有一个输出。分析时先定义规模 `n`，再数基本操作：

```text
T(n) = 3n^2 + 5n + 8  -> O(n^2)
S(n) = 2n + 32        -> O(n)
```

必须区分：

- 最好、平均、最坏时间复杂度。
- 问题本身所需空间与算法辅助空间。
- 单次复杂度与连续操作的均摊复杂度。
- 递归调用栈与显式辅助栈。

> 手算检查：看到 `O(n)` 前先问 `n` 是数组长度、节点数、顶点数还是边数；看到“原地”先确认讨论的是辅助空间，而不是变量数量为零。

## 五、线性表

### 1. 线性表是什么

线性表是有限个同类型数据元素组成的有序序列。除首元素外，每个元素有唯一直接前驱；除尾元素外，每个元素有唯一直接后继。

```text
逻辑上的线性表
!= 数组
!= 链表
```

数组和链表只是线性表的两类存储实现。前者用连续地址隐含次序，后者用指针或引用显式保存次序。

### 2. 顺序表

#### 2.1 存储与最小定义

顺序表的最小状态只有：

```java
private int[] data;
private int size;
```

`data.length` 是容量，`size` 是当前元素数，合法元素区间是 `[0, size)`。本文所有 Java 线性结构统一使用 0 下标。

#### 2.2 完整 CRUD

```java
package linear;

public final class SeqList {
    private int[] data;
    private int size;

    public SeqList(int capacity) {
        if (capacity < 0) throw new IllegalArgumentException("negative capacity");
        data = new int[Math.max(1, capacity)];
    }

    public void add(int index, int value) {
        checkPositionIndex(index);
        ensureCapacity();
        for (int i = size; i > index; i--) {
            data[i] = data[i - 1];
        }
        data[index] = value;
        size++;
    }

    public void add(int value) {
        add(size, value);
    }

    public int get(int index) {
        checkElementIndex(index);
        return data[index];
    }

    public int remove(int index) {
        checkElementIndex(index);
        int removed = data[index];
        for (int i = index; i < size - 1; i++) {
            data[i] = data[i + 1];
        }
        size--;
        return removed;
    }

    public int indexOf(int value) {
        for (int i = 0; i < size; i++) {
            if (data[i] == value) return i;
        }
        return -1;
    }

    public int size() {
        return size;
    }

    private void ensureCapacity() {
        if (size < data.length) return;
        int[] expanded = new int[data.length * 2];
        for (int i = 0; i < size; i++) expanded[i] = data[i];
        data = expanded;
    }

    private void checkPositionIndex(int index) {
        if (index < 0 || index > size) throw new IndexOutOfBoundsException(index);
    }

    private void checkElementIndex(int index) {
        if (index < 0 || index >= size) throw new IndexOutOfBoundsException(index);
    }
}
```

其中动态扩容属于工程延伸。固定容量的考试模型通常在满表时返回失败，不讨论均摊；动态数组的单次扩容为 `O(n)`，连续尾插才可讨论均摊 `O(1)`。

#### 2.3 复杂度与手算

| 操作 | 最好 | 平均/最坏 | 原因 |
| --- | --- | --- | --- |
| 按下标访问 | `O(1)` | `O(1)` | 地址可直接计算 |
| 按值查找 | `O(1)` | `O(n)` | 最多逐个比较 |
| 尾部插入且不扩容 | `O(1)` | `O(1)` | 不搬移 |
| 指定位置插入 | `O(1)` | `O(n)` | 后缀右移 |
| 删除 | `O(1)` | `O(n)` | 后缀左移 |

对长度为 `n` 的表，在 0 下标位置 `i` 插入，需要移动 `n-i` 个元素；删除位置 `i`，需要移动 `n-i-1` 个元素。

> Debug 观察：`size`、`index`、搬移循环的 `i`，以及每一步的有效区间 `[0, size)`。最常见错误是插入时从左向右搬移，导致原值被覆盖。

**优先级：S。** CRUD、边界和搬移次数都要独立写出。

### 3. 单链表

#### 3.1 头指针、头节点与首元节点

这三个词必须分开：

| 术语 | 含义 |
| --- | --- |
| 头指针 | 保存链表起始地址的变量 |
| 头节点，也称哑节点 | 不保存业务数据的辅助节点 |
| 首元节点 | 第一个真正保存业务数据的节点 |

带头节点时，头指针指向头节点，首元节点是 `dummy.next`。不带头节点时，头指针直接指向首元节点，空表时为 `null`。

#### 3.2 带头节点的完整 CRUD

统一使用“先找前驱，再改两条连接”的写法：

```java
package linear;

public final class SinglyLinkedList {
    static final class Node {
        int value;
        Node next;
        Node(int value) { this.value = value; }
    }

    private final Node dummy = new Node(0);
    private int size;

    public void add(int index, int value) {
        checkPositionIndex(index);
        Node previous = nodeBefore(index);
        Node node = new Node(value);
        node.next = previous.next;
        previous.next = node;
        size++;
    }

    public void add(int value) {
        add(size, value);
    }

    public int get(int index) {
        checkElementIndex(index);
        return nodeBefore(index).next.value;
    }

    public int remove(int index) {
        checkElementIndex(index);
        Node previous = nodeBefore(index);
        Node target = previous.next;
        previous.next = target.next;
        target.next = null;
        size--;
        return target.value;
    }

    public int indexOf(int value) {
        int index = 0;
        for (Node current = dummy.next; current != null; current = current.next) {
            if (current.value == value) return index;
            index++;
        }
        return -1;
    }

    public int size() {
        return size;
    }

    private Node nodeBefore(int index) {
        Node current = dummy;
        for (int i = 0; i < index; i++) current = current.next;
        return current;
    }

    private void checkPositionIndex(int index) {
        if (index < 0 || index > size) throw new IndexOutOfBoundsException(index);
    }

    private void checkElementIndex(int index) {
        if (index < 0 || index >= size) throw new IndexOutOfBoundsException(index);
    }
}
```

按逻辑位置访问、插入和删除都要先走到前驱，所以是 `O(n)`；已知前驱节点时插入、删除是 `O(1)`。不能把“链表插删是常数时间”脱离“已知操作位置的节点或前驱”这个前提。

#### 3.3 常见算法

> 链表操作原则：修改某个 `next` 前，先判断旧引用是否还需要；如果需要，先保存，否则可能断链。

```java
static Node reverse(Node head) {
    Node previous = null;
    Node current = head;
    while (current != null) {
        Node next = current.next;
        current.next = previous;
        previous = current;
        current = next;
    }
    return previous;
}

static Node mergeSorted(Node first, Node second) {
    Node dummy = new Node(0);
    Node tail = dummy;
    while (first != null && second != null) {
        if (first.value <= second.value) {
            tail.next = first;
            first = first.next;
        } else {
            tail.next = second;
            second = second.next;
        }
        tail = tail.next;
    }
    tail.next = first != null ? first : second;
    return dummy.next;
}

static void deduplicateSorted(Node head) {
    Node current = head;
    while (current != null && current.next != null) {
        if (current.value == current.next.value) {
            current.next = current.next.next;
        } else {
            current = current.next;
        }
    }
}

static Node removeAll(Node head, int target) {
    Node dummy = new Node(0);
    dummy.next = head;
    Node previous = dummy;
    while (previous.next != null) {
        if (previous.next.value == target) {
            previous.next = previous.next.next;
        } else {
            previous = previous.next;
        }
    }
    return dummy.next;
}

static Node kthFromEnd(Node head, int k) {
    if (k <= 0) throw new IllegalArgumentException("k must be positive");
    Node fast = head;
    for (int i = 0; i < k; i++) {
        if (fast == null) throw new IllegalArgumentException("k exceeds length");
        fast = fast.next;
    }
    Node slow = head;
    while (fast != null) {
        fast = fast.next;
        slow = slow.next;
    }
    return slow;
}
```

快慢指针还可用于找中点和判环。判环时 `slow` 每次一步、`fast` 每次两步；若相遇则有环。不要把“相遇节点”误认为“环入口”，寻找入口还需要额外阶段。

| 算法 | 不变量 | 时间 | 辅助空间 |
| --- | --- | --- | --- |
| 逆置 | `previous` 已逆置，`current` 及以后未处理 | `O(n)` | `O(1)` |
| 有序合并 | `dummy.next..tail` 始终有序 | `O(m+n)` | `O(1)` |
| 有序去重 | `current` 之前已无重复 | `O(n)` | `O(1)` |
| 删除目标值 | `previous.next` 是待检查节点 | `O(n)` | `O(1)` |
| 倒数第 k 个 | 快指针始终领先慢指针 k 步 | `O(n)` | `O(1)` |

> Debug 观察：逆置看 `previous/current/next`；删除看 `previous/target`；合并看 `tail/first/second`。每改一次引用，都画出仍然可达的链。

**优先级：S。** CRUD、逆置、合并、删除和快慢指针要分开练，不能合并成一个“链表大题”。

#### 3.4 C 对照

```c
Node *reverse(Node *head) {
    Node *previous = NULL;
    Node *current = head;
    while (current != NULL) {
        Node *next = current->next;
        current->next = previous;
        previous = current;
        current = next;
    }
    return previous;
}
```

C 版控制流不变，额外责任是检查分配失败、维护 `Node **head` 或返回新头，并释放被删除节点。

### 4. 双链表

双链表节点同时保存前驱和后继，适合已知节点时双向移动和 `O(1)` 删除。使用首尾哨兵可统一边界：

```java
static final class DoublyList {
    static final class Node {
        int value;
        Node previous;
        Node next;
        Node(int value) { this.value = value; }
    }

    private final Node head = new Node(0);
    private final Node tail = new Node(0);
    private int size;

    DoublyList() {
        head.next = tail;
        tail.previous = head;
    }

    void insertBefore(Node next, int value) {
        Node node = new Node(value);
        Node previous = next.previous;
        node.previous = previous;
        node.next = next;
        previous.next = node;
        next.previous = node;
        size++;
    }

    int remove(Node node) {
        if (node == head || node == tail) throw new IllegalArgumentException("sentinel");
        node.previous.next = node.next;
        node.next.previous = node.previous;
        size--;
        return node.value;
    }
}
```

已知节点时插删为 `O(1)`；按位置找到节点仍为 `O(n)`。手算时必须同时检查：

```text
previous.next == current
current.next.previous == current
```

**优先级：A。** 会画四条引用的修改顺序，会补核心语句。

### 5. 循环链表

循环单链表的尾节点 `next` 指回头节点或首元节点；循环双链表常让首尾哨兵互相连接。它仍是线性表的链式存储，只是终止条件改变：

```text
普通链表：current == null 时结束
循环链表：current 再次回到起点时结束
```

若只保存尾指针 `tail`，首元节点是 `tail.next`，头插和尾插都可在 `O(1)` 内完成。典型应用是轮转调度和约瑟夫问题。

> Debug 观察：从任意节点出发最多走 `size` 步应回到起点。把普通链表的 `current != null` 搬过来会形成死循环。

**优先级：A。** 独立练首插、尾插、删除首元节点和单节点边界。

### 6. 静态链表

静态链表用数组下标模拟指针，`next` 保存下一节点下标，`-1` 表示空指针。它应在线性表常规链式存储之后学习。

| 下标 | `data` | `next` |
| ---: | ---: | ---: |
| 0 | 12 | 3 |
| 1 | 未使用 | -1 |
| 2 | 25 | -1 |
| 3 | 18 | 2 |

若 `head = 0`，逻辑顺序是 `12 -> 18 -> 25`。已知前驱下标时插删为 `O(1)`，按逻辑位置或值查找仍为 `O(n)`，容量固定且不能随机访问第 k 个逻辑元素。

维护 `freeHead` 把空闲槽位串成另一条链，属于工程延伸。第一轮只需会读游标、修改一条已用链；不必把空闲链写成通用内存分配器。

**优先级：B。** 会读表、画链和完成一次游标插删。

### 7. 线性表对比

| 结构 | 随机访问 | 按值查找 | 已知位置插删 | 空间特点 |
| --- | --- | --- | --- | --- |
| 顺序表 | `O(1)` | `O(n)` | 搬移导致 `O(n)` | 连续、可能预留容量 |
| 单链表 | `O(n)` | `O(n)` | 已知前驱为 `O(1)` | 每节点多一个指针 |
| 双链表 | `O(n)` | `O(n)` | 已知节点为 `O(1)` | 每节点多两个指针 |
| 静态链表 | `O(n)` | `O(n)` | 已知前驱下标为 `O(1)` | 固定数组、游标连接 |

## 六、栈、队列和数组

### 1. 栈

栈是只允许在同一端插入和删除的线性表，遵循后进先出。`push`、`pop`、`peek` 是操作语义，顺序栈和链栈是两种实现。

#### 1.1 顺序栈

先约定 `top` 的含义。下面令 `top` 指向下一个可写位置，所以空栈 `top == 0`，栈顶元素是 `data[top - 1]`：

```java
final class ArrayStack {
    private final int[] data;
    private int top;

    ArrayStack(int capacity) {
        if (capacity < 0) throw new IllegalArgumentException("negative capacity");
        data = new int[capacity];
    }

    void push(int value) {
        if (top == data.length) throw new IllegalStateException("full");
        data[top++] = value;
    }

    int pop() {
        if (isEmpty()) throw new IllegalStateException("empty");
        return data[--top];
    }

    int peek() {
        if (isEmpty()) throw new IllegalStateException("empty");
        return data[top - 1];
    }

    boolean isEmpty() {
        return top == 0;
    }

    int size() {
        return top;
    }
}
```

#### 1.2 链栈

链栈把链表首元节点作为栈顶，头插和头删均为 `O(1)`：

```java
final class LinkedStack {
    private static final class Node {
        int value;
        Node next;
        Node(int value, Node next) {
            this.value = value;
            this.next = next;
        }
    }

    private Node top;
    private int size;

    void push(int value) {
        top = new Node(value, top);
        size++;
    }

    int pop() {
        int value = peek();
        top = top.next;
        size--;
        return value;
    }

    int peek() {
        if (top == null) throw new IllegalStateException("empty");
        return top.value;
    }

    boolean isEmpty() { return top == null; }
    int size() { return size; }
}
```

| 应用 | 栈中保存什么 | 高频检查 |
| --- | --- | --- |
| 括号匹配 | 尚未匹配的左括号 | 类型必须对应，结束时栈为空 |
| 表达式求值 | 运算数、运算符 | 优先级与结合性 |
| 中缀转后缀 | 尚未输出的运算符 | 遇右括号弹到左括号 |
| 递归转迭代 | 返回位置、局部状态 | 入栈顺序决定恢复顺序 |
| DFS | 待继续访问的节点 | 访问标记何时设置 |

> Debug 观察：`top` 是元素下标还是下一可写位置。两套定义都成立，但判空、判满和取栈顶公式必须统一。

**优先级：S。** 顺序栈 CRUD、括号匹配和表达式过程要能写；链栈会补全。

### 2. 队列

队列只允许在队尾插入、队头删除，遵循先进先出。顺序队列若只让 `front/rear` 单调右移，即使数组左侧已空也可能出现“假溢出”，因此需要循环队列或链队列。

#### 2.1 循环队列

采用“牺牲一个存储单元”的约定：

```text
front 指向队头元素
rear 指向下一可写位置
空：front == rear
满：(rear + 1) mod capacity == front
队长：(rear - front + capacity) mod capacity
```

下面构造器参数是可容纳的真实元素数，内部数组额外申请一个位置：

```java
final class CircularQueue {
    private final int[] data;
    private int front;
    private int rear;

    CircularQueue(int capacity) {
        if (capacity < 0) throw new IllegalArgumentException("negative capacity");
        data = new int[capacity + 1];
    }

    void enqueue(int value) {
        if ((rear + 1) % data.length == front) {
            throw new IllegalStateException("full");
        }
        data[rear] = value;
        rear = (rear + 1) % data.length;
    }

    int dequeue() {
        if (isEmpty()) throw new IllegalStateException("empty");
        int value = data[front];
        front = (front + 1) % data.length;
        return value;
    }

    int peek() {
        if (isEmpty()) throw new IllegalStateException("empty");
        return data[front];
    }

    boolean isEmpty() {
        return front == rear;
    }

    int size() {
        return (rear - front + data.length) % data.length;
    }
}
```

另一种合法约定是额外维护 `size` 或 `tag`，让全部数组单元可用。做题时先写约定，再推判空判满，不能混用公式。

#### 2.2 链队列

带头节点的链队列令 `head.next` 指向队头，`tail` 指向队尾；空队列时二者都落在头节点：

```java
final class LinkedQueue {
    private static final class Node {
        int value;
        Node next;
        Node(int value) { this.value = value; }
    }

    private final Node head = new Node(0);
    private Node tail = head;
    private int size;

    void enqueue(int value) {
        Node node = new Node(value);
        tail.next = node;
        tail = node;
        size++;
    }

    int dequeue() {
        Node first = head.next;
        if (first == null) throw new IllegalStateException("empty");
        head.next = first.next;
        if (tail == first) tail = head;
        size--;
        return first.value;
    }

    int peek() {
        if (head.next == null) throw new IllegalStateException("empty");
        return head.next.value;
    }

    boolean isEmpty() {
        return head.next == null;
    }

    int size() {
        return size;
    }
}
```

双端队列允许两端插删。受限双端队列还可分为输入受限和输出受限。队列典型应用包括层序遍历、BFS、缓冲区和任务调度。

> 手算检查：循环队列长度为 6，采用牺牲一格约定，最多只能存 5 个元素；若 `front=4,rear=2`，队长为 `(2-4+6)%6=4`。

> Debug 观察：每次入队、出队后记录 `front/rear/size`。链队列删除最后一个元素时必须让 `tail` 回到头节点。

**优先级：S。** 循环队列公式和链队列空队列边界要独立写出。

### 3. 多维数组与特殊矩阵

#### 3.1 地址计算

设二维数组有 `m` 行、`n` 列，行下界为 `L1`，列下界为 `L2`，首元素地址为 `base`，每个元素占 `w` 字节。

按行优先：

```text
LOC(a[i][j]) = base + ((i-L1)*n + (j-L2))*w
```

按列优先：

```text
LOC(a[i][j]) = base + ((j-L2)*m + (i-L1))*w
```

必须先判断 `L1 <= i < L1+m`、`L2 <= j < L2+n`。题目给的是“首地址”还是“某个已知元素地址”，以及按字节还是按元素编号计算，也要先确认。

#### 3.2 对称、三角与三对角矩阵

以下均使用 0 下标。

对称矩阵只存下三角，按行优先时：

```text
i >= j: k = i*(i+1)/2 + j
i <  j: k = j*(j+1)/2 + i
```

下三角矩阵可把上三角的同一常量放在额外位置 `n*(n+1)/2`。上三角按行优先时，若 `i <= j`：

```text
k = i*(2*n-i+1)/2 + (j-i)
```

三对角矩阵只存 `|i-j| <= 1` 的元素，按行优先压缩后：

```text
k = 2*i + j
```

越界位置通常视为常量 0，不进入压缩数组。使用公式前要确认题目是否采用 1 下标，否则会整体偏移。

#### 3.3 稀疏矩阵

稀疏矩阵不能只压成固定带状数组，常见存储有：

- 三元组顺序表：每个非零元素保存 `(row, column, value)`。
- 行逻辑链接：额外记录每行首个非零元位置。
- 十字链表：每个非零元同时进入所在行链和列链。

三元组按坐标查找通常为 `O(t)`，其中 `t` 是非零元数；十字链表适合按行、列插删，但节点指针更多。

| 内容 | 手算重点 | 优先级 |
| --- | --- | --- |
| 行/列优先地址 | 下界、列数/行数、元素字节数 | S |
| 对称/三角/三对角压缩 | 分段公式和 0/1 下标 | A |
| 稀疏矩阵 | 三元组转置、结构辨认 | A |

## 七、串与模式匹配

串是零个或多个字符组成的有限序列。模式匹配要在主串 `text` 中寻找模式串 `pattern` 的首次出现位置。

### 1. BF 朴素匹配

BF 在每次失配后把主串起点右移一位：

```java
static int bruteForce(String text, String pattern) {
    if (pattern.isEmpty()) return 0;
    for (int start = 0; start + pattern.length() <= text.length(); start++) {
        int j = 0;
        while (j < pattern.length()
                && text.charAt(start + j) == pattern.charAt(j)) {
            j++;
        }
        if (j == pattern.length()) return start;
    }
    return -1;
}
```

设主串长 `n`、模式长 `m`，最坏时间为 `O(nm)`，辅助空间 `O(1)`。

### 2. KMP 的唯一定义

本文固定使用 0 下标和 `next[0] = -1`：

```text
next[j] 表示 pattern[j] 失配后，模式指针 j 应回到的下标。
主串指针 i 不回退。
```

```java
static int[] buildNext(String pattern) {
    if (pattern.isEmpty()) return new int[0];
    int[] next = new int[pattern.length()];
    next[0] = -1;
    int j = 0;
    int candidate = -1;
    while (j < pattern.length() - 1) {
        if (candidate == -1 || pattern.charAt(j) == pattern.charAt(candidate)) {
            j++;
            candidate++;
            next[j] = candidate;
        } else {
            candidate = next[candidate];
        }
    }
    return next;
}

static int kmp(String text, String pattern) {
    if (pattern.isEmpty()) return 0;
    int[] next = buildNext(pattern);
    int i = 0;
    int j = 0;
    while (i < text.length() && j < pattern.length()) {
        if (j == -1 || text.charAt(i) == pattern.charAt(j)) {
            i++;
            j++;
        } else {
            j = next[j];
        }
    }
    return j == pattern.length() ? i - j : -1;
}
```

模式 `ABABAA` 在本文定义下：

```text
下标       0  1  2  3  4  5
字符       A  B  A  B  A  A
next      -1  0  0  1  2  3
nextval   -1  0 -1  0 -1  3
```

`nextval` 在回退位置字符仍与当前字符相同时继续回退，用于跳过必然再次失配的比较。不同教材还可能使用 1 下标、前缀函数 `pi`、`next[0]=0` 或整体右移的表；这些定义都可以自洽，但数值不能与本文代码混用。

> Debug 观察：失配时只看 `i/j/next[j]`。若 `i` 回退，或 `j` 在同一位置反复跳转，说明定义和代码混用了。

> 手算方法：先写模式下标和字符，再逐位求“失配后可复用的最长相等真前后缀”，最后按本文的失配下标定义转换，不要背孤立数组。

**优先级：S。** BF、`next` 构造和完整匹配要分别实现，时间为 `O(n+m)`。

## 八、树与二叉树

### 1. 基本概念

树是 `n` 个节点的有限集合。`n=0` 时为空树；非空树有且仅有一个根，其余节点分成若干互不相交的子树。

| 概念 | 含义 |
| --- | --- |
| 节点的度 | 该节点的孩子数 |
| 树的度 | 所有节点度的最大值 |
| 叶节点 | 度为 0 的节点 |
| 深度 | 从根到该节点所在层的距离约定 |
| 高度 | 从该节点到最深叶的最长路径约定 |
| 路径长度 | 路径上的边数 |
| 森林 | 若干棵互不相交树的集合 |

深度和高度可能从 0 或 1 开始计数。公式使用前必须声明约定；本文层数从 1 开始，边数从 0 开始。

### 2. 存储结构先于遍历

#### 2.1 二叉树的顺序存储

完全二叉树适合放入数组。0 下标时：

```text
父节点：(i-1)/2，i > 0
左孩子：2*i+1
右孩子：2*i+2
最后一个非叶节点：n/2-1
```

普通二叉树也可按完全二叉树位置存储，但斜树会产生大量空槽。顺序存储的结构 CRUD 是“按位置读写”，而插入一个节点可能要求同时满足父节点存在和位置语义，不能把它当普通动态数组。

#### 2.2 二叉链表

```java
static final class TreeNode {
    int value;
    TreeNode left;
    TreeNode right;
    TreeNode(int value) { this.value = value; }
}
```

已知父节点时连接或断开孩子是 `O(1)`；按值查找、寻找父节点或删除整棵子树通常要遍历，时间为 `O(n)`。

#### 2.3 一般树的三种存储

| 存储 | 节点字段 | 适合操作 | 代价 |
| --- | --- | --- | --- |
| 双亲表示法 | `data,parentIndex` | 快速找父节点 | 找全部孩子要扫描 |
| 孩子表示法 | 每个节点一条孩子链 | 快速枚举孩子 | 找父节点不直接 |
| 孩子兄弟表示法 | `firstChild,nextSibling` | 用二叉链表表示任意树 | 关系需要转换理解 |

孩子兄弟表示法规定：

```text
left  -> 第一个孩子
right -> 下一个兄弟
```

森林转二叉树时，各棵树的根也通过右指针连接。对应关系：

- 树或森林的先根遍历，等价于对应二叉树的先序遍历。
- 树或森林的后根遍历，等价于对应二叉树的中序遍历。
- 层序遍历没有这样简单的一一对应。

### 3. 二叉树性质

| 性质 | 公式或结论 |
| --- | --- |
| 第 `i` 层最多节点数 | `2^(i-1)` |
| 高度为 `h` 的二叉树最多节点数 | `2^h-1` |
| 非空二叉树叶数与二度节点数 | `n0 = n2 + 1` |
| 有 `n` 个节点的树边数 | `n-1` |
| 完全二叉树叶节点范围 | 只可能出现在最后两层 |
| 完全二叉树节点 `i` 的孩子 | 由数组下标公式直接判断 |
| `n` 个不同节点能形成的二叉树数 | 卡特兰数 `C_n = (1/(n+1))*binom(2n,n)` |

对任意非空二叉树：

```text
n = n0 + n1 + n2
边数 = n - 1 = n1 + 2*n2
两式相减得到 n0 = n2 + 1
```

满二叉树每层都达到最大节点数；完全二叉树只要求按层序从左到右与同高度满二叉树的前若干位置一致，二者不能混用。

### 4. 遍历

#### 4.1 递归遍历

```java
static void preorder(TreeNode root) {
    if (root == null) return;
    visit(root);
    preorder(root.left);
    preorder(root.right);
}

static void inorder(TreeNode root) {
    if (root == null) return;
    inorder(root.left);
    visit(root);
    inorder(root.right);
}

static void postorder(TreeNode root) {
    if (root == null) return;
    postorder(root.left);
    postorder(root.right);
    visit(root);
}
```

三者只改变 `visit` 与两个递归调用的相对位置。访问每个节点一次，时间 `O(n)`；辅助空间等于树高 `O(h)`，平衡树约为 `O(log n)`，斜树为 `O(n)`。

#### 4.2 非递归遍历

```java
import java.util.ArrayDeque;
import java.util.Deque;

static void inorderIterative(TreeNode root) {
    Deque<TreeNode> stack = new ArrayDeque<>();
    TreeNode current = root;
    while (current != null || !stack.isEmpty()) {
        while (current != null) {
            stack.push(current);
            current = current.left;
        }
        current = stack.pop();
        visit(current);
        current = current.right;
    }
}

static void postorderIterative(TreeNode root) {
    Deque<TreeNode> stack = new ArrayDeque<>();
    TreeNode current = root;
    TreeNode lastVisited = null;
    while (current != null || !stack.isEmpty()) {
        if (current != null) {
            stack.push(current);
            current = current.left;
        } else {
            TreeNode peek = stack.peek();
            if (peek.right != null && peek.right != lastVisited) {
                current = peek.right;
            } else {
                visit(stack.pop());
                lastVisited = peek;
            }
        }
    }
}
```

后序遍历中的 `lastVisited` 表示最近完成访问的子树根。若右子树存在且尚未访问，就不能弹出当前节点。

#### 4.3 层序遍历

```java
static void levelOrder(TreeNode root) {
    if (root == null) return;
    java.util.ArrayDeque<TreeNode> queue = new java.util.ArrayDeque<>();
    queue.add(root);
    while (!queue.isEmpty()) {
        TreeNode node = queue.remove();
        visit(node);
        if (node.left != null) queue.add(node.left);
        if (node.right != null) queue.add(node.right);
    }
}
```

> Debug 观察：递归遍历看调用栈；非递归中序看 `current/stack`；非递归后序再加 `lastVisited`；层序看每次出队前后的队列。

**优先级：S。** 递归先、中、后序，非递归中序、后序和层序要分别推演。

### 5. 线索二叉树

二叉链表中空指针很多。线索化用空的左指针保存遍历前驱，用空的右指针保存遍历后继：

```java
static final class ThreadNode {
    int value;
    ThreadNode left;
    ThreadNode right;
    boolean leftThread;
    boolean rightThread;
    ThreadNode(int value) { this.value = value; }
}
```

中序线索化需要一个跨递归调用保存的 `previous`：

```java
static ThreadNode previous;

static void createInorderThreads(ThreadNode root) {
    previous = null;
    threadInorder(root);
    if (previous != null && previous.right == null) {
        previous.rightThread = true;
    }
}

private static void threadInorder(ThreadNode node) {
    if (node == null) return;
    threadInorder(node.left);

    if (node.left == null) {
        node.left = previous;
        node.leftThread = true;
    }
    if (previous != null && previous.right == null) {
        previous.right = node;
        previous.rightThread = true;
    }
    previous = node;

    threadInorder(node.right);
}
```

这段代码假设输入尚未线索化，`leftThread/rightThread` 初始为 `false`。中序遍历线索树时，先走到最左的孩子；若 `rightThread` 为真，右指针就是后继，否则进入右子树后再找最左节点。

> 手算检查：先写出原树中序序列，再只在线索化前为空的指针上填前驱或后继。孩子指针不能被覆盖。

**优先级：B。** 会画 `tag`、会跟踪 `previous`、会用线索找前驱后继。

### 6. BST、AVL 与红黑树

#### 6.1 二叉搜索树

BST 满足左子树关键字小于根、右子树关键字大于根，且左右子树也满足该性质。若允许重复值，必须额外声明放左、放右或计数，不能默认。

```java
static TreeNode search(TreeNode root, int key) {
    while (root != null && root.value != key) {
        root = key < root.value ? root.left : root.right;
    }
    return root;
}

static TreeNode insert(TreeNode root, int key) {
    if (root == null) return new TreeNode(key);
    if (key < root.value) root.left = insert(root.left, key);
    else if (key > root.value) root.right = insert(root.right, key);
    return root;
}

static TreeNode delete(TreeNode root, int key) {
    if (root == null) return null;
    if (key < root.value) {
        root.left = delete(root.left, key);
    } else if (key > root.value) {
        root.right = delete(root.right, key);
    } else if (root.left == null) {
        return root.right;
    } else if (root.right == null) {
        return root.left;
    } else {
        TreeNode successor = root.right;
        while (successor.left != null) successor = successor.left;
        root.value = successor.value;
        root.right = delete(root.right, successor.value);
    }
    return root;
}
```

时间为 `O(h)`。平衡时 `h=O(log n)`，按有序序列插入可能退化为 `h=O(n)`。中序遍历结果有序。

#### 6.2 AVL

AVL 要求任一节点左右子树高度差绝对值不超过 1。插入或删除后，从失衡节点沿更高孩子方向判断：

| 类型 | 路径 | 修复 |
| --- | --- | --- |
| LL | 左孩子的左子树更高 | 右旋 |
| RR | 右孩子的右子树更高 | 左旋 |
| LR | 左孩子的右子树更高 | 先左旋孩子，再右旋 |
| RL | 右孩子的左子树更高 | 先右旋孩子，再左旋 |

旋转后必须重新接回父节点，并按“先低后高”更新高度。查找、插入和删除保持 `O(log n)`。

#### 6.3 红黑树

红黑树是近似平衡 BST，核心约束是：

1. 节点为红或黑。
2. 根为黑。
3. 空叶视为黑。
4. 红节点不能有红孩子。
5. 从任一节点到其后代空叶的路径包含相同数量黑节点。

这些约束保证树高为 `O(log n)`。考试重点是性质、插入删除后的变色与旋转判断，以及与 AVL 的比较，不要求重写完整 `TreeMap`。

| 结构 | 平衡强度 | 更新特点 | 优先级 |
| --- | --- | --- | --- |
| BST | 不保证 | 简单但会退化 | S |
| AVL | 严格高度平衡 | 查找稳定，旋转更频繁 | A |
| 红黑树 | 近似平衡 | 更新折中 | B |

### 7. Huffman 树与并查集

#### 7.1 Huffman

带权路径长度：

```text
WPL = sum(叶节点权值 * 根到该叶的边数)
```

构造时每轮取权值最小的两棵树合并，新节点权值为两者之和，直到只剩一棵树。含 `n` 个叶节点的 Huffman 树共有 `2n-1` 个节点，没有度为 1 的节点。左边写 0、右边写 1 只是编码约定，不影响 WPL。

#### 7.2 并查集

并查集用森林维护不相交集合。根节点可让 `parent[root]` 保存负的集合大小：

```java
final class UnionFind {
    private final int[] parent;

    UnionFind(int n) {
        parent = new int[n];
        java.util.Arrays.fill(parent, -1);
    }

    int find(int x) {
        if (parent[x] < 0) return x;
        return parent[x] = find(parent[x]);
    }

    boolean union(int first, int second) {
        int rootA = find(first);
        int rootB = find(second);
        if (rootA == rootB) return false;
        if (parent[rootA] > parent[rootB]) {
            int temp = rootA;
            rootA = rootB;
            rootB = temp;
        }
        parent[rootA] += parent[rootB];
        parent[rootB] = rootA;
        return true;
    }
}
```

路径压缩加按大小合并的均摊复杂度近似常数，严格为反阿克曼函数量级。Kruskal 用它判断加入一条边是否形成环。

**优先级：Huffman A，并查集 S。** 前者重在手算树和 WPL，后者要独立写 `find/union`。

### 8. 堆作为树结构

堆是用数组存储的完全二叉树。大根堆满足父节点不小于孩子，小根堆相反。堆只保证沿父子关系有序，不保证中序、层序整体有序。

```java
final class IntMaxHeap {
    private int[] data;
    private int size;

    IntMaxHeap(int capacity) {
        data = new int[Math.max(1, capacity)];
    }

    IntMaxHeap(int[] values) {
        data = java.util.Arrays.copyOf(values, Math.max(1, values.length));
        size = values.length;
        for (int i = size / 2 - 1; i >= 0; i--) siftDown(i);
    }

    void offer(int value) {
        ensureCapacity();
        data[size] = value;
        siftUp(size);
        size++;
    }

    int peek() {
        if (size == 0) throw new IllegalStateException("empty");
        return data[0];
    }

    int poll() {
        int result = peek();
        data[0] = data[--size];
        if (size > 0) siftDown(0);
        return result;
    }

    int size() {
        return size;
    }

    private void siftUp(int child) {
        int value = data[child];
        while (child > 0) {
            int parent = (child - 1) / 2;
            if (data[parent] >= value) break;
            data[child] = data[parent];
            child = parent;
        }
        data[child] = value;
    }

    private void siftDown(int root) {
        int value = data[root];
        for (int child = root * 2 + 1; child < size; child = root * 2 + 1) {
            if (child + 1 < size && data[child + 1] > data[child]) child++;
            if (data[child] <= value) break;
            data[root] = data[child];
            root = child;
        }
        data[root] = value;
    }

    private void ensureCapacity() {
        if (size < data.length) return;
        data = java.util.Arrays.copyOf(data, data.length * 2);
    }
}
```

工程延伸是动态扩容；考试核心是数组下标、建堆、上浮和下沉。

| 操作 | 时间 |
| --- | --- |
| 查看堆顶 | `O(1)` |
| 插入并上浮 | `O(log n)` |
| 删除堆顶并下沉 | `O(log n)` |
| 自底向上建堆 | `O(n)` |

自底向上建堆不是 `n/2 * log n` 的紧确结论。越靠近叶子的节点越多而下沉高度越小，对各高度的“节点数乘高度”求和得到 `O(n)`。

> Debug 观察：`root/child/size/value`。删除堆顶后，`size` 必须先缩小，已移出的元素不能重新参加下沉。

**优先级：S。** `siftUp`、`siftDown`、插入、删除堆顶和建堆分别实现；堆排序在排序章讨论。

### 9. 树章节手算与验收

| 主题 | 手算动作 | 关键变量 |
| --- | --- | --- |
| 遍历 | 画访问次序和递归栈 | `current/stack/lastVisited` |
| 完全二叉树 | 写下标、父子公式 | `i/n` |
| 线索树 | 先写遍历序列，再填空指针 | `previous/tag` |
| BST | 插入序列、三类删除 | `root/key/successor` |
| AVL | 找最低失衡点并判四型 | 高度、平衡因子 |
| Huffman | 每轮合并最小两权 | 当前森林、WPL |
| 并查集 | 画父数组变化 | `parent/root` |
| 堆 | 逐次交换或覆盖 | `root/child/size` |

## 九、图

### 1. 基本概念

图由顶点集 `V` 和边集 `E` 组成，记为 `G=(V,E)`。

| 概念 | 必须分清 |
| --- | --- |
| 无向图/有向图 | 无序顶点对与有序顶点对 |
| 简单图 | 无自环、无重复边 |
| 完全图 | 任意两个顶点之间都有所需方向的边 |
| 度/入度/出度 | 无向边贡献两个度；有向边贡献一个入度和一个出度 |
| 路径/回路 | 顶点序列是否首尾相同 |
| 连通/强连通 | 无向可达与有向双向可达 |
| 连通分量/强连通分量 | 极大连通子图 |
| 生成树 | 含全部顶点且无环的连通子图 |
| DAG | 无有向环图 |
| AOV 网 | 顶点表示活动，边表示先后约束 |
| AOE 网 | 边表示活动，顶点表示事件 |

无向图所有顶点度数之和为 `2|E|`；有向图入度之和与出度之和都等于 `|E|`。含 `n` 个顶点的生成树恰有 `n-1` 条边。

### 2. 图的基本操作与四种存储

基本操作包括创建图、增删顶点、增删边、判断邻接、枚举邻接点、取得或更新边权，以及遍历。复杂度必须绑定具体存储。

| 存储 | 空间 | 判断边 `(u,v)` | 枚举 `u` 的邻接点 | 插入边 | 删除边 |
| --- | --- | --- | --- | --- | --- |
| 邻接矩阵 | `O(V^2)` | `O(1)` | `O(V)` | `O(1)` | `O(1)` |
| 邻接表 | `O(V+E)` | `O(deg(u))` | `O(deg(u))` | 头插可 `O(1)` | `O(deg(u))` |
| 十字链表 | `O(V+E)` | 依链长 | 易枚举有向图入边和出边 | 改两条链 | 改两条链 |
| 邻接多重表 | `O(V+E)` | 依链长 | 一条无向边只存一次 | 改两个端点链 | 改两个端点链 |

带权邻接矩阵必须使用单独的“无边”标记，例如 `INF` 或额外布尔矩阵。不能用权值 0 表示无边，因为零权边是合法边。

十字链表的边节点通常保存：

```text
tailVertex, headVertex, tailLink, headLink, weight
```

邻接多重表的边节点通常保存：

```text
vertexI, vertexJ, linkI, linkJ, weight
```

前者服务有向图，后者服务无向图。识别题先看同一条边进入几条链，不要只背字段名。

### 3. BFS 与 DFS

下面使用邻接表，所以“有没有边”由列表成员关系决定，不受边权是否为 0 影响：

```java
import java.util.ArrayDeque;
import java.util.List;

static void bfsAll(List<Integer>[] graph) {
    boolean[] visited = new boolean[graph.length];
    ArrayDeque<Integer> queue = new ArrayDeque<>();
    for (int start = 0; start < graph.length; start++) {
        if (visited[start]) continue;
        visited[start] = true;
        queue.add(start);
        while (!queue.isEmpty()) {
            int vertex = queue.remove();
            visit(vertex);
            for (int next : graph[vertex]) {
                if (!visited[next]) {
                    visited[next] = true;
                    queue.add(next);
                }
            }
        }
    }
}

static void dfsAll(List<Integer>[] graph) {
    boolean[] visited = new boolean[graph.length];
    for (int start = 0; start < graph.length; start++) {
        if (!visited[start]) dfs(graph, start, visited);
    }
}

private static void dfs(List<Integer>[] graph, int vertex, boolean[] visited) {
    visited[vertex] = true;
    visit(vertex);
    for (int next : graph[vertex]) {
        if (!visited[next]) dfs(graph, next, visited);
    }
}
```

邻接表上的 BFS/DFS 时间都是 `O(V+E)`，邻接矩阵上为 `O(V^2)`。非连通图必须有外层循环，才能形成 BFS 森林或 DFS 森林。

访问标记常在入队时设置，避免同一顶点被多个前驱重复入队。邻接点存储顺序不同，合法遍历序列也可能不同。

> Debug 观察：BFS 看 `queue/visited`，DFS 看递归栈或显式栈。手算时每一步都写“已访问、待处理、尚未发现”三个集合。

**优先级：S。** BFS 和 DFS 必须作为两个独立算法实现。

### 4. 最小生成树

最小生成树适用于连通、无向、带权图。若图不连通，得到的是最小生成森林，不能声称得到一棵生成树。

#### 4.1 Prim

Prim 每轮把一个新顶点并入当前树，适合邻接矩阵和稠密图：

```java
static final long INF = Long.MAX_VALUE / 4;

static long prim(long[][] weight) {
    int n = weight.length;
    if (n == 0) return 0;
    boolean[] inTree = new boolean[n];
    long[] lowCost = new long[n];
    java.util.Arrays.fill(lowCost, INF);
    lowCost[0] = 0;
    long total = 0;

    for (int count = 0; count < n; count++) {
        int vertex = -1;
        for (int i = 0; i < n; i++) {
            if (!inTree[i] && (vertex == -1 || lowCost[i] < lowCost[vertex])) {
                vertex = i;
            }
        }
        if (vertex == -1 || lowCost[vertex] == INF) {
            throw new IllegalArgumentException("disconnected graph");
        }
        inTree[vertex] = true;
        total += lowCost[vertex];

        for (int next = 0; next < n; next++) {
            if (!inTree[next] && weight[vertex][next] < lowCost[next]) {
                lowCost[next] = weight[vertex][next];
            }
        }
    }
    return total;
}
```

矩阵实现时间 `O(V^2)`；配合小根堆和邻接表可降为 `O(E log V)`。

#### 4.2 Kruskal

Kruskal 按边权从小到大扫描，若边的两个端点属于不同集合就加入，并用并查集合并。排序成本主导为 `O(E log E)`，适合边表和稀疏图。

```text
sort edges by weight
for each (u, v, w):
    if find(u) != find(v):
        choose edge
        union(u, v)
    stop after choosing V-1 edges
```

边权互不相同时最小生成树一定唯一，但“存在相同边权”不等于“一定不唯一”。唯一性要看是否存在可替换的同权边。

**优先级：Prim/Kruskal A。** 会选算法、写核心循环、逐轮记录 `lowCost` 或并查集。

### 5. 最短路径

先按条件选算法：

| 问题 | 算法 | 权值条件 |
| --- | --- | --- |
| 无权单源 | BFS | 每条边等价 |
| 带权单源 | Dijkstra | 边权非负 |
| 所有顶点对 | Floyd | 可有负边，但不能有负环 |

#### 5.1 Dijkstra

```java
static long[] dijkstra(long[][] weight, int source) {
    int n = weight.length;
    for (long[] row : weight) {
        for (long edge : row) {
            if (edge != INF && edge < 0) {
                throw new IllegalArgumentException("negative edge");
            }
        }
    }
    long[] distance = new long[n];
    boolean[] fixed = new boolean[n];
    java.util.Arrays.fill(distance, INF);
    distance[source] = 0;

    for (int count = 0; count < n; count++) {
        int vertex = -1;
        for (int i = 0; i < n; i++) {
            if (!fixed[i] && (vertex == -1 || distance[i] < distance[vertex])) {
                vertex = i;
            }
        }
        if (vertex == -1 || distance[vertex] == INF) break;
        fixed[vertex] = true;

        for (int next = 0; next < n; next++) {
            long edge = weight[vertex][next];
            if (!fixed[next] && edge != INF
                    && distance[vertex] <= INF - edge) {
                long candidate = distance[vertex] + edge;
                if (candidate < distance[next]) distance[next] = candidate;
            }
        }
    }
    return distance;
}
```

Dijkstra 一旦把顶点加入 `fixed`，就认为最短距离已确定，因此不能处理负边。矩阵实现 `O(V^2)`；邻接表配小根堆为 `O((V+E) log V)`。

#### 5.2 Floyd

`distance[i][j]` 表示当前只允许指定中间顶点集合时的最短距离。加入中间顶点 `k`：

```java
static void floyd(long[][] distance) {
    int n = distance.length;
    for (int k = 0; k < n; k++) {
        for (int i = 0; i < n; i++) {
            if (distance[i][k] == INF) continue;
            for (int j = 0; j < n; j++) {
                if (distance[k][j] == INF) continue;
                long candidate = distance[i][k] + distance[k][j];
                if (candidate < distance[i][j]) distance[i][j] = candidate;
            }
        }
    }
}
```

这里先排除 `INF` 再相加，且 `INF` 取 `Long.MAX_VALUE/4`，避免把“不可达 + 不可达”溢出成负数。时间 `O(V^3)`，额外空间取决于是否原地更新。

> Debug 观察：Dijkstra 看 `fixed/distance/vertex`；Floyd 看第 `k` 轮前后矩阵。若零权边消失、负边进入 Dijkstra，或 `INF` 参与加法，模型已经错误。

**优先级：Dijkstra A，Floyd A。** 两者都要完整手算，Dijkstra 需完成一次 Java/C 双写。

### 6. 拓扑排序与关键路径

#### 6.1 拓扑排序

拓扑序只存在于 DAG。Kahn 算法反复选择入度为 0 的顶点：

```java
static int[] topologicalOrder(List<Integer>[] graph, int[] originalIndegree) {
    int[] indegree = java.util.Arrays.copyOf(originalIndegree, originalIndegree.length);
    ArrayDeque<Integer> queue = new ArrayDeque<>();
    for (int i = 0; i < indegree.length; i++) {
        if (indegree[i] == 0) queue.add(i);
    }

    int[] order = new int[graph.length];
    int count = 0;
    while (!queue.isEmpty()) {
        int vertex = queue.remove();
        order[count++] = vertex;
        for (int next : graph[vertex]) {
            if (--indegree[next] == 0) queue.add(next);
        }
    }
    if (count != graph.length) throw new IllegalArgumentException("cycle");
    return order;
}
```

邻接表实现为 `O(V+E)`。若每一步都只有一个入度为 0 的候选顶点，则拓扑序唯一；某一步候选不止一个，至少存在不同选择顺序。

#### 6.2 AOE 网与关键路径

AOE 网是带权 DAG，边表示活动、权值表示持续时间。计算顺序：

1. 按拓扑序前推事件最早发生时间 `ve`。
2. 用汇点的 `ve` 初始化工期。
3. 按逆拓扑序后推事件最迟发生时间 `vl`。
4. 对活动边 `<u,v,w>`，计算 `ee=ve[u]`、`el=vl[v]-w`。
5. `ee == el` 的活动为关键活动。

```text
ve[v] = max(ve[v], ve[u] + w)
vl[u] = min(vl[u], vl[v] - w)
```

关键路径可能不唯一。缩短某一条关键活动不一定缩短总工期，因为可能还存在另一条同长关键路径；只有缩短所有当前控制工期的路径才可能生效。

> 手算验收：写出拓扑序、`ve`、逆拓扑序、`vl`、每条边的 `ee/el`，最后再圈关键活动，不要直接目测最长路径。

**优先级：A。** 拓扑排序会写，关键路径会完整列表手算。

### 7. 图章节总验收

| 内容 | 成立条件 | 复杂度要点 | 训练级别 |
| --- | --- | --- | --- |
| 四种存储 | 有向/无向、稀疏/稠密 | 绑定具体操作 | A/B |
| BFS | 任意图 | 表 `O(V+E)`，矩阵 `O(V^2)` | S |
| DFS | 任意图 | 表 `O(V+E)`，矩阵 `O(V^2)` | S |
| Prim | 连通无向带权 | 矩阵 `O(V^2)` | A |
| Kruskal | 连通无向带权 | `O(E log E)` | A |
| Dijkstra | 非负边 | 矩阵 `O(V^2)` | A |
| Floyd | 无负环 | `O(V^3)` | A |
| 拓扑排序 | DAG | `O(V+E)` | A |
| 关键路径 | AOE 网 | `O(V+E)` | A |

## 十、查找

### 1. 基本概念

查找是在数据集合中确定是否存在关键字等于给定值的记录。

| 术语 | 含义 |
| --- | --- |
| 查找表 | 同类型记录组成的集合 |
| 关键字 | 唯一或非唯一标识记录的数据项 |
| 静态查找表 | 只做查询，不修改集合 |
| 动态查找表 | 查询过程中还会插入、删除 |
| 查找成功 | 找到满足条件的记录 |
| 查找失败 | 证明集合中不存在目标 |
| ASL | 各种查找长度按概率加权后的平均值 |

成功 ASL 和失败 ASL 的状态空间、概率分母通常不同。题目若未给概率，一般按各成功记录等概率，或各失败区间等概率处理；比较次数是否包含最终失败比较，要服从题目定义。

### 2. 顺序、折半与分块查找

#### 2.1 顺序查找

普通顺序查找适用于有序或无序线性表，时间为 `O(n)`。带哨兵写法把目标临时放在边界位置，可减少循环中的越界判断，但要说明是否会覆盖原数据以及如何恢复。

#### 2.2 折半查找

折半查找要求顺序存储且按关键字有序：

```java
static int binarySearch(int[] values, int target) {
    int low = 0;
    int high = values.length - 1;
    while (low <= high) {
        int middle = low + (high - low) / 2;
        if (values[middle] == target) return middle;
        if (values[middle] < target) low = middle + 1;
        else high = middle - 1;
    }
    return -1;
}
```

闭区间 `[low, high]` 对应循环条件 `low <= high`。查找过程可画成判定树，树高约为 `ceil(log2(n+1))`，时间 `O(log n)`。它不适合链表，因为链表取得中点本身不是 `O(1)`。

#### 2.3 分块查找

分块查找要求块间有序，块内可以无序。索引表保存每块最大关键字和块起始位置：

```text
先在索引表确定候选块
再在块内顺序查找
```

若有 `b` 块、每块约 `s` 个元素，顺序查索引的平均量级为 `O(b+s)`；在均匀条件下取 `b`、`s` 约为 `sqrt(n)` 可得到 `O(sqrt(n))` 量级。若索引表折半查找，则还要单独计算索引比较与块内比较。

> Debug 观察：折半看 `low/middle/high`；分块查找看索引命中的块边界。最常见错误是把块内也误认为必须有序。

**优先级：顺序 A，折半 S，分块 A。**

### 3. 树形查找

BST、AVL 和红黑树已在树章节给出。此处从查找角度对比：

| 结构 | 最坏查找 | 更新 | 主要考点 |
| --- | --- | --- | --- |
| BST | `O(n)` | 简单 | 判定树、删除 |
| AVL | `O(log n)` | 严格平衡、旋转 | 四种失衡 |
| 红黑树 | `O(log n)` | 变色与旋转 | 性质和高度界 |

判定树中成功查找长度是根到目标节点的比较数；失败查找落在空指针位置，不能直接沿用成功节点数作为分母。

### 4. B 树与 B+ 树

#### 4.1 m 阶 B 树的约束

本文采用“m 阶表示最多 m 个孩子”的定义：

- 每个节点最多 `m` 个孩子、`m-1` 个关键字。
- 除根外，非叶节点至少有 `ceil(m/2)` 个孩子，即至少 `ceil(m/2)-1` 个关键字。
- 根若不是叶节点，至少有两个孩子。
- 所有叶节点在同一层。
- 含 `k` 个关键字的节点有 `k+1` 个孩子。

不同教材可能把“最小度数”作为参数，操作前先确认阶数定义。

#### 4.2 分裂、借位与合并示例

以 4 阶 B 树为例，每节点最多 3 个关键字，非根节点至少 1 个关键字。依次插入：

```text
10, 20, 5       -> [5,10,20]
再插入 6        -> 临时 [5,6,10,20]
提升 10         -> 根 [10]，孩子 [5,6] 和 [20]
再插 12,30,7,17 -> 根 [10,20]，孩子 [5,6,7] [12,17] [30]
```

删除示例：

1. 删除 `7`，左孩子变为 `[5,6]`，仍合法。
2. 删除 `30`，右孩子下溢；中间兄弟 `[12,17]` 有多余关键字。
3. 将父关键字 `20` 下移到右孩子，将兄弟最大关键字 `17` 上移到父节点。
4. 得到根 `[10,17]`，孩子 `[5,6] [12] [20]`，这是借位。
5. 再删除 `20`，右孩子下溢且兄弟只有最少关键字，便把兄弟 `[12]`、父分隔关键字 `17` 和空右孩子合并为 `[12,17]`。
6. 根变为 `[10]`，孩子 `[5,6] [12,17]`。

内部节点删除通常用前驱或后继替换，再把问题转到子节点。若根删除后没有关键字，唯一孩子成为新根，树高减一。

#### 4.3 B+ 树

| 对比 | B 树 | B+ 树 |
| --- | --- | --- |
| 数据记录 | 内部和叶节点都可保存 | 通常只在叶节点保存 |
| 内部关键字 | 同时承担索引和记录 | 只承担索引 |
| 叶节点 | 不一定相连 | 通常按关键字链接 |
| 精确查找 | 可能在内部结束 | 通常走到叶节点 |
| 范围查找 | 需中序式遍历 | 定位首叶后沿链扫描 |

工程延伸：数据库索引常使用 B+ 树，是因为高扇出降低树高，叶链适合范围扫描。这个类比只帮助理解，不替代阶数、最少关键字和分裂合并手算。

**优先级：B 树 A，B+ 树 B。** 不要求完整工程实现，但必须能按指定阶数画插入分裂、删除借位与合并。

### 5. Hash 查找

散列表把关键字映射到槽位。装填因子：

```text
alpha = 表中记录数 / 表长
```

冲突处理常见两类：

- 开放定址：线性探测、平方探测、双散列。
- 拉链法：同一地址的记录放入链表。

开放定址删除不能直接改回 `EMPTY`，否则会截断后续记录的探测路径，必须使用 `DELETED` 墓碑：

```java
final class OpenAddressHash {
    private static final byte EMPTY = 0;
    private static final byte OCCUPIED = 1;
    private static final byte DELETED = 2;

    private final int[] keys;
    private final byte[] state;
    private int size;

    OpenAddressHash(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("capacity");
        keys = new int[capacity];
        state = new byte[capacity];
    }

    int findSlot(int key) {
        int start = Math.floorMod(key, keys.length);
        for (int step = 0; step < keys.length; step++) {
            int index = (start + step) % keys.length;
            if (state[index] == EMPTY) return -1;
            if (state[index] == OCCUPIED && keys[index] == key) return index;
        }
        return -1;
    }

    boolean add(int key) {
        int start = Math.floorMod(key, keys.length);
        int firstDeleted = -1;
        for (int step = 0; step < keys.length; step++) {
            int index = (start + step) % keys.length;
            if (state[index] == OCCUPIED && keys[index] == key) return false;
            if (state[index] == DELETED && firstDeleted == -1) firstDeleted = index;
            if (state[index] == EMPTY) {
                occupy(firstDeleted == -1 ? index : firstDeleted, key);
                return true;
            }
        }
        if (firstDeleted != -1) {
            occupy(firstDeleted, key);
            return true;
        }
        throw new IllegalStateException("full");
    }

    boolean remove(int key) {
        int index = findSlot(key);
        if (index == -1) return false;
        state[index] = DELETED;
        size--;
        return true;
    }

    private void occupy(int index, int key) {
        keys[index] = key;
        state[index] = OCCUPIED;
        size++;
    }
}
```

装填因子较低且散列均匀时，平均查找接近 `O(1)`；最坏仍为 `O(n)`。线性探测易产生一次聚集，平方探测与双散列用于改善探测分布。ASL 手算必须逐个写探测序列，包括回绕和失败停止位置。

> Debug 观察：`start/step/index/state/firstDeleted`。探测最多进行表长次，必须有上界。

**优先级：S。** 至少独立实现开放定址的查找、插入、墓碑删除，并手算成功与失败 ASL。

### 6. 字符串模式匹配在查找体系中的位置

正式目录把字符串模式匹配放在查找章。本文为了 Coding 顺序已在第七章先讲 BF 和 KMP；复习覆盖时仍把它记作查找内容，避免误以为是额外扩展。

## 十一、排序

### 1. 基本概念与统一计数口径

排序把记录按关键字重排。内部排序假设数据能放入内存；外部排序处理无法一次装入内存的数据。

稳定性只讨论关键字相等的记录：排序后它们的相对次序不变，算法才稳定。稳定与正确、快慢没有直接等价关系。

比较次数和记录移动次数必须分开。本文把一次交换视为三次记录赋值；若题目把暂存到 `temp`、循环最后写回也计入移动，精确数值会相应变化，必须服从题目口径。

| 算法 | 最好时间 | 平均时间 | 最坏时间 | 辅助空间 | 稳定 | 比较与移动特征 |
| --- | --- | --- | --- | --- | --- | --- |
| 直接插入 | `O(n)` | `O(n^2)` | `O(n^2)` | `O(1)` | 是 | 最好仅 `n-1` 次关键比较、无位移；最坏比较和位移均为平方级 |
| 折半插入 | `O(n log n)` | `O(n^2)` | `O(n^2)` | `O(1)` | 是 | 比较降为 `O(n log n)`，移动量不变 |
| Shell | 依增量 | 依增量 | 常见简单增量可到 `O(n^2)` | `O(1)` | 否 | 跨组移动，不能套直接插入精确式 |
| 冒泡 | `O(n)` | `O(n^2)` | `O(n^2)` | `O(1)` | 是 | 提前结束时最好 `n-1` 次比较；交换次数依逆序对 |
| 快速 | `O(n log n)` | `O(n log n)` | `O(n^2)` | 平均 `O(log n)` | 否 | 分区每层线性；枢轴极端时退化 |
| 简单选择 | `O(n^2)` | `O(n^2)` | `O(n^2)` | `O(1)` | 否 | 比较恒为 `n(n-1)/2`，交换至多 `n-1` 次 |
| 堆 | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(1)` | 否 | 建堆 `O(n)`，随后每次调整 `O(log n)` |
| 二路归并 | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(n)` | 是 | 每层线性比较与移动，共 `log n` 层 |
| 基数 | `O(d(n+r))` | 同左 | 同左 | `O(n+r)` | 是 | 非比较排序；`d` 为位数，`r` 为基数 |

### 2. 插入类排序

#### 2.1 直接插入

不变量：每轮开始时 `[0, i)` 已有序，把 `a[i]` 插入该前缀。

```java
static void insertionSort(int[] a) {
    for (int i = 1; i < a.length; i++) {
        int value = a[i];
        int j = i - 1;
        while (j >= 0 && a[j] > value) {
            a[j + 1] = a[j];
            j--;
        }
        a[j + 1] = value;
    }
}
```

条件写成 `a[j] > value` 而不是 `>=`，相等元素不跨越，所以稳定。

#### 2.2 折半插入

折半只减少“在有序前缀中确定插入位置”的比较次数，后缀仍要移动。下面用上界位置把新元素插到相等元素之后，保持稳定：

```java
static void binaryInsertionSort(int[] a) {
    for (int i = 1; i < a.length; i++) {
        int value = a[i];
        int low = 0;
        int high = i;
        while (low < high) {
            int middle = low + (high - low) / 2;
            if (a[middle] <= value) low = middle + 1;
            else high = middle;
        }
        for (int j = i; j > low; j--) a[j] = a[j - 1];
        a[low] = value;
    }
}
```

#### 2.3 Shell

Shell 按增量把元素分组，每组做插入排序，最终增量必须为 1：

```java
static void shellSort(int[] a) {
    for (int gap = a.length / 2; gap > 0; gap /= 2) {
        for (int i = gap; i < a.length; i++) {
            int value = a[i];
            int j = i;
            while (j >= gap && a[j - gap] > value) {
                a[j] = a[j - gap];
                j -= gap;
            }
            a[j] = value;
        }
    }
}
```

Shell 的复杂度依赖增量序列，不能笼统宣称固定为 `O(n log n)`。跨组跳跃可能改变相等记录次序，因此不稳定。

### 3. 交换类排序

#### 3.1 冒泡

```java
static void bubbleSort(int[] a) {
    for (int end = a.length - 1; end > 0; end--) {
        boolean swapped = false;
        for (int i = 0; i < end; i++) {
            if (a[i] > a[i + 1]) {
                swap(a, i, i + 1);
                swapped = true;
            }
        }
        if (!swapped) return;
    }
}
```

一趟后当前最大元素落到 `end`。只在严格大于时交换，所以稳定；`swapped` 使已有序输入达到 `O(n)`。

#### 3.2 快速排序

分区模板不能混用。下面固定首元素枢轴、左右挖坑式分区：

```java
static int partition(int[] a, int low, int high) {
    int pivot = a[low];
    while (low < high) {
        while (low < high && a[high] >= pivot) high--;
        a[low] = a[high];
        while (low < high && a[low] <= pivot) low++;
        a[high] = a[low];
    }
    a[low] = pivot;
    return low;
}

static void quickSort(int[] a, int low, int high) {
    if (low >= high) return;
    int pivot = partition(a, low, high);
    quickSort(a, low, pivot - 1);
    quickSort(a, pivot + 1, high);
}
```

对 `[49,38,65,97,76,13,27]`，首轮枢轴 49 的最终状态可得到：

```text
[27,38,13,49,76,97,65]
```

分区只保证枢轴左侧不大于它、右侧不小于它，两侧内部并未整体有序。划分均匀时总时间 `O(n log n)`、递归栈 `O(log n)`；每次枢轴都是极值时退化为 `O(n^2)` 时间和 `O(n)` 栈。

> 工程延伸：随机枢轴、三数取中和小区间转插入排序可改善实际表现，但第一轮训练只固定一种可手算模板。

### 4. 选择类排序

#### 4.1 简单选择

```java
static void selectionSort(int[] a) {
    for (int i = 0; i < a.length - 1; i++) {
        int minimum = i;
        for (int j = i + 1; j < a.length; j++) {
            if (a[j] < a[minimum]) minimum = j;
        }
        if (minimum != i) swap(a, i, minimum);
    }
}
```

比较次数与初始次序无关，恒为 `n(n-1)/2`。对 `[2a,2b,1]` 首轮交换后为 `[1,2b,2a]`，相等元素次序改变，所以不稳定。

#### 4.2 堆排序

复用树章节的下沉思想，但这里直接在原数组内建大根堆：

```java
static void siftDown(int[] a, int root, int size) {
    int value = a[root];
    for (int child = root * 2 + 1; child < size; child = root * 2 + 1) {
        if (child + 1 < size && a[child + 1] > a[child]) child++;
        if (a[child] <= value) break;
        a[root] = a[child];
        root = child;
    }
    a[root] = value;
}

static void heapSort(int[] a) {
    for (int i = a.length / 2 - 1; i >= 0; i--) {
        siftDown(a, i, a.length);
    }
    for (int end = a.length - 1; end > 0; end--) {
        swap(a, 0, end);
        siftDown(a, 0, end);
    }
}
```

`size` 是当前堆区间右边界的开区间。每轮把最大值换到 `end` 后，调整范围必须排除已排序后缀。

### 5. 归并排序

```java
static void mergeSort(int[] a, int left, int right, int[] temp) {
    if (left >= right) return;
    int middle = left + (right - left) / 2;
    mergeSort(a, left, middle, temp);
    mergeSort(a, middle + 1, right, temp);

    int i = left;
    int j = middle + 1;
    int out = left;
    while (i <= middle && j <= right) {
        temp[out++] = a[i] <= a[j] ? a[i++] : a[j++];
    }
    while (i <= middle) temp[out++] = a[i++];
    while (j <= right) temp[out++] = a[j++];
    for (int k = left; k <= right; k++) a[k] = temp[k];
}
```

时间始终为 `O(n log n)`，辅助数组 `O(n)`，递归栈 `O(log n)`。相等时先取左段元素，所以稳定。

### 6. 基数排序

最低位优先法从个位到高位反复进行稳定的分配和收集。以下代码只处理非负整数，`radix=10`：

```java
static void radixSortNonNegative(int[] a) {
    if (a.length == 0) return;
    int maximum = 0;
    for (int value : a) {
        if (value < 0) throw new IllegalArgumentException("negative value");
        maximum = Math.max(maximum, value);
    }

    int[] output = new int[a.length];
    for (long divisor = 1; maximum / divisor > 0; divisor *= 10) {
        int[] count = new int[10];
        for (int value : a) count[(int) (value / divisor % 10)]++;
        for (int i = 1; i < count.length; i++) count[i] += count[i - 1];
        for (int i = a.length - 1; i >= 0; i--) {
            int digit = (int) (a[i] / divisor % 10);
            output[--count[digit]] = a[i];
        }
        System.arraycopy(output, 0, a, 0, a.length);
    }
}
```

逆向扫描输入并按累计计数落位，使每一趟稳定。若最大值为 0，不需要任何分配趟，数组本身已有序。`divisor` 使用 `long`，避免最高位后乘 10 发生 `int` 溢出。

### 7. 手算与 Debug

| 算法 | 每轮应记录 | 常见错误 |
| --- | --- | --- |
| 直接/折半插入 | 有序前缀、待插值、插入点 | 覆盖待插值，折半后忘记仍需搬移 |
| Shell | 增量、每组下标 | 把一趟误认为整体有序 |
| 冒泡 | 当前 `end`、是否交换 | 无提前结束仍声称最好 `O(n)` |
| 快速 | `low/high/pivot` | 混用分区模板、指针不推进 |
| 选择 | 当前最小下标 | 把交换少误认为时间线性 |
| 堆 | `root/child/size` | 已排序后缀重新入堆 |
| 归并 | `i/j/out/temp` | 相等时先取右边破坏稳定性 |
| 基数 | 当前位、桶计数、收集序列 | 分配过程不稳定 |

统一用 `[5,2,4,2]` 至少手算一次每种内部排序，并标记两个值为 2 的记录相对次序，稳定性就不再只是背表。

**优先级：直接插入、冒泡、快速、堆、归并为 S；折半插入、Shell、简单选择、基数为 A。**

### 8. 外部排序

外部排序处理数据量大于可用内存的情况，优化重点是磁盘或外存 I/O，不是单纯减少 CPU 比较。

```text
原始文件
  -> 分批读入内存并做内部排序
  -> 初始归并段 R1...Rr
  -> 反复做 k 路归并
  -> 有序文件
```

若共有 `N` 条记录，固定内存每次容纳 `M` 条，则初始归并段数约为：

```text
r = ceil(N/M)
```

平衡 `k` 路归并的趟数：

```text
passes = ceil(log_k(r))
```

每一趟要顺序读完并写回全部记录，所以只计归并阶段的记录传输量约为 `2*N*passes`。增加 `k` 会减少趟数，但至少需要 `k` 个输入缓冲区和 1 个输出缓冲区，内存限制决定 `k` 不能无限增大。

#### 8.1 多路归并模拟

```java
static int[] mergeSortedRuns(int[][] runs) {
    int total = 0;
    for (int[] run : runs) total += run.length;
    int[] position = new int[runs.length];
    int[] output = new int[total];

    for (int out = 0; out < total; out++) {
        int winner = -1;
        for (int run = 0; run < runs.length; run++) {
            if (position[run] >= runs[run].length) continue;
            if (winner == -1
                    || runs[run][position[run]] < runs[winner][position[winner]]) {
                winner = run;
            }
        }
        output[out] = runs[winner][position[winner]++];
    }
    return output;
}
```

线性扫描选胜者的时间为 `O(Nk)`；败者树或小根堆可把它降为 `O(N log k)`。

#### 8.2 三个容易混淆的优化

| 技术 | 优化对象 | 核心动作 |
| --- | --- | --- |
| 败者树 | 每次从 k 个段首选最小值 | 内部节点保存败者，输出后只重赛一条根路径 |
| 置换选择 | 让初始归并段更长 | 新记录小于本段最后输出值时冻结到下一段 |
| 最佳归并树 | 各段长度不等时减少总 I/O | 段长作权值，优先合并较短段 |

`k` 路最佳归并树必须满足叶节点数条件。令：

```text
u = (r-1) mod (k-1)
```

若 `u=0`，不补虚段；若 `u!=0`，精确补：

```text
(k-1)-u
```

个权值为 0 的虚段，再按 Huffman 思想合并。仅写“补一些虚段”无法保证形成严格的 `k` 叉归并树。

> 手算验收：给出 `N/M/k` 后，依次算 `r`、归并趟数、合并阶段 I/O、缓冲区数量和虚段数；给出不等长归并段时再画最佳归并树。

**优先级：B。** 会计算、会解释三种优化，不要求实现真实文件系统。

## 十二、从代码反推复杂度

| 代码形态 | 识别方法 | 复杂度 |
| --- | --- | --- |
| 单循环线性推进 | 基本操作执行约 `n` 次 | `O(n)` |
| `i *= 2` | 翻倍多少次达到 `n` | `O(log n)` |
| 两层都走 `n` | 乘法原则 | `O(n^2)` |
| 内层走到 `i` | 求和 `1+2+...+n` | `O(n^2)` |
| 二分递归、每层常数工作 | `T(n)=T(n/2)+O(1)` | `O(log n)` |
| 两个子问题、每层合并 `n` | `T(n)=2T(n/2)+O(n)` | `O(n log n)` |
| 邻接表遍历图 | 每个顶点和边有限次 | `O(V+E)` |

判断复杂度的固定步骤：

1. 定义输入规模。
2. 找到基本操作。
3. 写出循环次数、求和式或递推式。
4. 给出最好、平均或最坏条件。
5. 单独计算辅助数组、队列、栈和递归深度。

“两个指针各走一遍”通常是 `O(n)` 而非 `O(n^2)`，关键看它们是否单调前进；“代码只有一层循环”也不保证线性，例如循环体里可能调用线性函数。

## 十三、统一 Debug 清单

| 算法 | 断点位置 | 必看变量 | 失败征兆 |
| --- | --- | --- | --- |
| 顺序表插入 | 搬移循环前后 | `size/index/i` | 从左搬导致覆盖 |
| 链表逆置 | 修改 `next` 前 | `previous/current/next` | 余链不可达 |
| 循环队列 | 入队、出队后 | `front/rear/size` | 满与空同时成立 |
| KMP | 失配分支 | `i/j/next[j]` | 主串回退 |
| 非递归后序 | 栈顶判断处 | `current/peek/lastVisited` | 重复进入右子树 |
| 线索化 | 访问节点时 | `previous/tag` | 覆盖真实孩子 |
| 堆调整 | 选较大孩子后 | `root/child/size/value` | 已排序区入堆 |
| BFS | 邻接点入队前 | `queue/visited` | 同一顶点重复入队 |
| Dijkstra | 选定顶点后 | `fixed/distance/vertex` | 负边被当作合法输入 |
| Floyd | 每个 `k` 完成后 | 距离矩阵 | `INF` 参与加法 |
| Hash | 每次探测 | `start/step/state` | 墓碑截断探测 |
| 快速排序 | 每次填坑 | `low/high/pivot` | 指针不推进 |
| 归并排序 | 合并循环 | `i/j/out/temp` | 边界漏元素 |

故障注入比只看正确结果更有效。例如故意把循环队列判满改成 `rear==front`，观察它如何与判空冲突；把 Floyd 的 `INF` 保护删掉，观察不可达路径如何产生伪最短路。

## 十四、Java 与 C 的双写边界

双写的目的不是维护两套工程，而是确认你能把引用、数组长度和内存责任翻译到纸面代码。重新评估后，下面 18 项值得强制完成一次：

| 序号 | 独立双写项 | C 入口或迁移重点 |
| ---: | --- | --- |
| 1 | 顺序表插入 | `seq_insert(a, &n, capacity, index, value)` |
| 2 | 顺序表删除 | 修改逻辑长度，返回被删值 |
| 3 | 单链表 CRUD | `.` 转 `->`，删除后 `free` |
| 4 | 单链表逆置 | 返回新头或传 `Node **` |
| 5 | 循环队列 | `front/rear` 与取模公式 |
| 6 | KMP | 字符串长度、终止符、统一 `next` 定义 |
| 7 | 二叉树递归遍历 | 空指针与节点生命周期 |
| 8 | 二叉树非递归遍历 | 手写数组栈 |
| 9 | BST 删除 | 子树新根必须接回父节点 |
| 10 | 堆下沉 | 0/1 下标统一 |
| 11 | BFS | 手写数组队列和访问数组 |
| 12 | DFS | 递归边界和非连通外层循环 |
| 13 | Dijkstra | `INF`、防溢出、非负边前提 |
| 14 | 折半查找 | 显式长度与闭区间 |
| 15 | Hash 开放定址 | `EMPTY/OCCUPIED/DELETED` 三态 |
| 16 | 快速排序 | 分区模板与递归区间 |
| 17 | 堆排序 | 堆区边界与下沉 |
| 18 | 归并排序 | 临时数组与闭区间边界 |

堆排序与归并排序即使安排在同一周，也必须产出两个独立源文件，不能用一个“大排序程序”掩盖边界错误。

C 版至少用严格警告和运行时检查编译：

```bash
cc -std=c11 -Wall -Wextra -Werror \
  -fsanitize=address,undefined -g list_reverse.c -o list_reverse
./list_reverse
```

双写验收顺序：

1. Java 和 C 使用同一组输入。
2. 输出相同的关键中间状态，而不只比最终结果。
3. 测空、单元素、重复、逆序、越界或不连通。
4. `malloc` 的节点必须 `free`。
5. 最后在纸上默写一次函数签名、核心循环和复杂度。

## 十五、12 周线性路线

| 周 | 学习顺序 | 当周验收 |
| ---: | --- | --- |
| 1 | 基本概念、算法评价、顺序表 | 完整 CRUD、搬移次数、Java/C 双写 |
| 2 | 单链表 CRUD 与算法、双链表、循环链表、静态链表 | 分清三种“头”，完成逆置与删除边界 |
| 3 | 顺序/链式栈队列、多维数组、特殊矩阵 | 循环队列公式，行列地址与压缩下标 |
| 4 | BF、KMP | 手算统一定义的 `next/nextval`，完成双写 |
| 5 | 树的三类存储、性质、递归/非递归/层序遍历 | 画栈和队列，完成两类遍历双写 |
| 6 | 线索树、树森林转换、BST、AVL、红黑树 | 线索化、三类删除、四类旋转 |
| 7 | Huffman、并查集、堆 ADT | WPL、路径压缩、上浮下沉和建堆 |
| 8 | 图概念、基本操作、四种存储、BFS、DFS | 非连通图遍历和复杂度 |
| 9 | Prim、Kruskal、Dijkstra、Floyd | 逐轮记录数组，检查算法前提 |
| 10 | 拓扑排序、关键路径、查找基本概念、顺序/折半/分块 | `ve/vl/ee/el` 与 ASL |
| 11 | B/B+ 树、Hash、插入/交换/选择类排序 | 分裂借位合并，探测序列，稳定性 |
| 12 | 快速、堆、归并、基数、外部排序 | 独立写三大排序，计算归并 I/O 与虚段 |

工作日做 30 分钟闭环；周末做一次 Java/C 双写和纸面限时。某周中断时，从当周验收项继续，不通过熬夜追赶制造新的遗忘。

## 十六、S/A/B 复习优先级

分级表示训练深度，不代表正式范围可以删除。

| 级别 | 必须达到 | 内容 |
| --- | --- | --- |
| S | 独立 Coding + 手算 + 复杂度 + 边界 | 顺序表 CRUD；单链表 CRUD、逆置、合并；栈；循环队列；KMP；树遍历；BST；堆；并查集；BFS；DFS；折半；开放定址 Hash；直接插入；冒泡；快速；堆排；归并 |
| A | 补全核心代码 + 完整过程表 | 双/循环链表；数组矩阵；AVL；Huffman；四种图存储；Prim；Kruskal；Dijkstra；Floyd；拓扑；关键路径；分块；B 树；折半插入；Shell；选择；基数 |
| B | 画结构 + 判性质 + 会解释操作 | 静态链表；线索树；红黑树；B+ 树；外部排序及三种优化 |

第一轮先打通全部 S，再用 A 连接综合题，最后用 B 补选择题和结构判断。B 级不是“不学”，而是暂不投入完整工程实现成本。

## 十七、核心 20 个实验与可选 10 个实验

### 1. 核心 20

每一项建立独立类或源文件，S 级算法不合并：

1. `SeqListCrud`
2. `SinglyLinkedListCrud`
3. `LinkedListReverse`
4. `CircularQueue`
5. `KmpMatch`
6. `RecursiveTreeTraversal`
7. `IterativeTreeTraversal`
8. `BinarySearchTree`
9. `HeapPriorityQueue`
10. `UnionFind`
11. `BreadthFirstSearch`
12. `DepthFirstSearch`
13. `DijkstraShortestPath`
14. `BinarySearch`
15. `OpenAddressHash`
16. `InsertionSort`
17. `BubbleSort`
18. `QuickSort`
19. `HeapSort`
20. `MergeSort`

### 2. 可选 10

1. `StaticLinkedListCursor`
2. `DoublyLinkedList`
3. `BruteForceMatch`
4. `MatrixCompression`
5. `ThreadedBinaryTree`
6. `AvlTree`
7. `HuffmanTree`
8. `PrimMst`
9. `KruskalMst`
10. `FloydAllPairs`

可选不等于范围外。Shell、基数、拓扑、关键路径、B/B+ 树与外部排序仍要手算，只是不强制占用一个完整工程实验。

## 十八、范围覆盖审计表

| 正式主线 | 逐项内容 | 本文位置 | 覆盖状态 |
| --- | --- | --- | --- |
| 基本概念 | 数据、逻辑/存储结构、ADT | 第四章 | 已覆盖 |
| 算法评价 | 时间、空间、最好/平均/最坏、均摊 | 第四、十二章 | 已覆盖 |
| 线性表 | 定义、顺序存储、CRUD、应用 | 第五章 1-2 | 已覆盖 |
| 线性表 | 单链、双链、循环链、静态链 | 第五章 3-6 | 已覆盖 |
| 栈 | 顺序/链式存储、CRUD、应用 | 第六章 1 | 已覆盖 |
| 队列 | 顺序问题、循环队列、链队列、双端队列 | 第六章 2 | 已覆盖 |
| 数组 | 行/列优先地址、多维数组 | 第六章 3.1 | 已覆盖 |
| 特殊矩阵 | 对称、三角、三对角、稀疏矩阵 | 第六章 3.2-3.3 | 已覆盖 |
| 字符串匹配 | BF、KMP、`next/nextval` | 第七章 | 已覆盖 |
| 树 | 概念、性质、顺序/链式存储 | 第八章 1-3 | 已覆盖 |
| 二叉树遍历 | 递归、非递归、层序 | 第八章 4 | 已覆盖 |
| 线索二叉树 | 结构、构造、遍历 | 第八章 5 | 已覆盖 |
| 树与森林 | 双亲、孩子、孩子兄弟、转换、遍历关系 | 第八章 2.3 | 已覆盖 |
| 树形查找 | BST、AVL、红黑树 | 第八章 6、第十章 3 | 已覆盖 |
| 树的应用 | Huffman、并查集、堆 | 第八章 7-8 | 已覆盖 |
| 图 | 概念、CRUD、复杂度 | 第九章 1-2 | 已覆盖 |
| 图存储 | 矩阵、邻接表、十字链表、邻接多重表 | 第九章 2 | 已覆盖 |
| 图遍历 | BFS、DFS、非连通图 | 第九章 3 | 已覆盖 |
| 图应用 | Prim、Kruskal | 第九章 4 | 已覆盖 |
| 图应用 | Dijkstra、Floyd | 第九章 5 | 已覆盖 |
| 图应用 | 拓扑排序、关键路径 | 第九章 6 | 已覆盖 |
| 查找概念 | 静态/动态表、成功/失败、ASL | 第十章 1 | 已覆盖 |
| 线性查找 | 顺序、折半、分块 | 第十章 2 | 已覆盖 |
| 多路查找 | B 树、B+ 树、分裂/借位/合并 | 第十章 4 | 已覆盖 |
| Hash | 构造、冲突、查插删、ASL | 第十章 5 | 已覆盖 |
| 排序概念 | 稳定性、比较、移动、复杂度与应用 | 第十一章 1 | 已覆盖 |
| 插入类 | 直接插入、折半插入、Shell | 第十一章 2 | 已覆盖 |
| 交换类 | 冒泡、快速 | 第十一章 3 | 已覆盖 |
| 选择类 | 简单选择、堆排序 | 第十一章 4 | 已覆盖 |
| 其他内部排序 | 二路归并、基数 | 第十一章 5-6 | 已覆盖 |
| 外部排序 | 多路归并、败者树、置换选择、最佳归并树 | 第十一章 8 | 已覆盖 |

这张表只证明本文有对应内容，不证明已经掌握。真正的覆盖要以“能画、能算、能写、能解释边界”为准。

## 十九、最终验收

随机抽一个核心实验，必须同时完成：

1. 不用集合框架写出核心结构和操作。
2. 解释每个指针、下标和循环不变量。
3. 手算一个正常例和一个边界例。
4. 改写为 C 或考试伪代码。
5. 写出时间、辅助空间和成立条件。
6. 故意制造一个边界错误，并用 Debug 定位。

完成这六步，试卷里的 C 代码不再是陌生符号，而是已经运行、暂停、改坏并修复过的模型。对于在职 Java 工程师，这比把大量零散题目做成一次性记忆更可靠。
