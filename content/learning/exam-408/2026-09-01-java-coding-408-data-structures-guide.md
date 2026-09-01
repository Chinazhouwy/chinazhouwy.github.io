---
title: "在职 Java 程序员的数据结构 Coding 路线"
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
summary: "用可运行的 Java、强制 C 双写、手工推演和 Debug，把数据结构 Coding、复杂度计算与计算机基础统考考法连成闭环。"
tags:
  - 计算机学科专业基础
  - 数据结构
  - Java
  - C
  - 算法
---

# 在职 Java 程序员的数据结构 Coding 路线

> 目标不是转行做算法竞赛，也不是用 `ArrayList` 和 `TreeMap` 把答案封装掉。目标是看到统考试题里的 C/C++ 代码时，脑中能还原出一个可运行的 Java 模型；看到 Java 循环和指针移动时，又能判断它的复杂度、边界条件和考法。

## 先确定边界：这篇文章学什么，不学什么

截至 2026-09-01，教育部公开的研究生招生规定仍将“计算机学科专业基础”列为全国统一命题科目。高等教育出版社公开的考纲解析目录中，数据结构部分的主干仍是：基本概念、线性表、栈队列与数组、树、图、查找、字符串模式匹配和排序，其中外部排序是正式小节。本文据此组织内容，并以当年正式出版的考试大纲为最终准绳。

本文覆盖计算机学科专业基础考试的数据结构主线，但不向 ACM、LeetCode 竞赛技巧、Spring、并发或分布式系统扩展。各知识点不平均用力：

| 层级 | 要求 | 典型内容 |
| --- | --- | --- |
| S：能独立写 | 不看资料写出核心循环，能解释每个变量 | 链表、栈队列、遍历、折半、KMP、快排、堆排、归并、BFS/DFS、Dijkstra |
| A：能补全与推演 | 看懂代码，补关键语句，手算过程 | AVL、Prim、Kruskal、Floyd、拓扑排序、关键路径、Hash |
| B：理解结构与性质 | 会画图、比较、判断，不追求完整工程实现 | 红黑树、B/B+ 树、线索树、外部排序 |

参考范围：[高教社《计算机学科专业基础考试大纲解析》目录](https://xuanshu.hep.com.cn/front/h5Mobile/bookDetails?bookId=68b8764ae119ac9729e8a8bc)、[高教社配套习题目录](https://xuanshu.hep.com.cn/front/h5Mobile/bookDetails?bookId=6852f178e119ac9729287abb)、[高教社《数据结构——用 C 语言描述（第 3 版）》](https://xuanshu.hep.com.cn/front/book/findBookDetails?bookId=6052fbafadb85dae6a2f3dab)、[研招网公开的计算机学科考试大纲](https://yz.chsi.com.cn/kyzx/zyk/201209/20120917/343200917.html)、[教育部 2026 年硕士研究生招生工作管理规定](https://www.moe.gov.cn/srcsite/A15/moe_778/s3261/202509/t20250918_1413836.html)。

## 一套适合碎片时间的闭环

每次 Coding 都沿同一条链走，不要只“看懂”：

```text
问题
  ↓ 需要保存什么关系
数据结构
  ↓ 数组下标还是节点引用
Java 实现
  ↓ 画出每一步状态
手工运行
  ↓ 在关键变量上打断点
Debug
  ↓ 改写成考试中的结构体、指针和伪代码
C/C++ 对照
  ↓ 数循环、递归深度和辅助空间
复杂度
  ↓ 判断题、选择题、综合题会挖什么坑
考试考法
```

一次 30 分钟只做一个闭环：15 分钟写，10 分钟单步调试，5 分钟写复杂度和错因。60 分钟再加一组边界实验；90 分钟才做 Java 与 C 的双写。不要把“连续看完一章”当作完成。

## 先搭一个零依赖实验室

```text
data-structure-algorithm-lab/
├── src/
│   ├── linear/       # 顺序表、链表
│   ├── stackqueue/   # 栈、循环队列
│   ├── string/       # BF、KMP
│   ├── tree/         # 遍历、BST、AVL、Huffman、并查集
│   ├── graph/        # 存储、遍历、MST、最短路、AOE
│   ├── search/       # 折半、分块、Hash
│   └── sort/         # 内部排序与多路归并模拟
├── c/                # 14 个 S 级算法的 C 双写版本
├── cases/            # 每个算法的输入与期望输出
└── notes/            # 手算过程、复杂度、C 写法、错题
```

每个类都保留 `main`，不用 Maven、Spring 或测试框架：

```bash
javac -d out src/linear/SeqList.java
java -cp out linear.SeqList
```

“能运行”只证明语法和一个样例通过。至少还要测：空结构、单元素、重复元素、已排序、逆序、越界或不连通。

## Java 程序员参加统考的最低限度 C/C++

先建立翻译表，再学算法。考试里的 C 并不要求你掌握复杂工程语法。

| C/C++ | Java 思维 | 必须理解的差异 |
| --- | --- | --- |
| `int a[100]` | `int[] a = new int[100]` | C 数组通常不携带长度 |
| `Node *p` | `Node p` | Java 对象变量本身就是引用语义 |
| `p->next` | `p.next` | `->` 是通过指针访问成员 |
| `*p` | “p 指向的对象/值” | `*` 在声明中表示指针，在表达式中表示解引用 |
| `&x` | 无直接对应 | 取变量地址 |
| `struct Node` | `class Node` | C 结构体只有数据，不自动管理内存 |
| `malloc/free` | `new`/GC | C 需要显式分配和释放 |
| `NULL` | `null` | 都表示“不指向有效对象” |
| `Node **head` | 返回新头节点，或用包装对象 | 允许函数修改调用方保存的头指针 |

最小链表定义：

```c
typedef struct Node {
    int data;
    struct Node *next;
} Node;

void pushFront(Node **head, int value) {
    Node *node = (Node *)malloc(sizeof(Node));
    node->data = value;
    node->next = *head;
    *head = node;
}
```

Java 通常直接返回新头节点：

```java
static Node pushFront(Node head, int value) {
    Node node = new Node(value);
    node.next = head;
    return node;
}
```

必须分清三种参数效果：值传递不会改调用方变量；传指针可以改指针指向的数据；传二级指针可以改调用方保存的指针。Java 永远是值传递，只是对象引用这个“值”让你可以改对象字段，不能直接把调用方的 `head` 变量换掉。

## 第零站：基本概念，先分清“关系”和“实现”

高教社公开的解析目录把“数据结构的基本概念”和“算法与算法评价”单列为第一章。这部分 Coding 量很小，却决定选择题中的术语和复杂度判断是否稳定。

### 一组不能混用的词

| 概念 | 含义 | 例子 |
| --- | --- | --- |
| 数据 | 能被计算机识别和处理的符号集合 | 整数、字符、图像像素、订单记录 |
| 数据元素 | 讨论中的基本单位 | 一名学生、一条边、一个数组元素 |
| 数据项 | 构成数据元素的不可分割字段 | 学号、边权、关键字 |
| 数据对象 | 性质相同的数据元素集合 | 全部学生记录、图中的顶点集合 |

数据结构要同时回答三件事：元素之间是什么关系，关系如何存进内存，允许对它做什么操作。

```text
数据结构 = 逻辑结构 + 存储结构 + 数据运算
```

| 维度 | 分类 | 只问什么 |
| --- | --- | --- |
| 逻辑结构 | 集合、线性、树形、图状 | 元素之间的抽象关系 |
| 存储结构 | 顺序、链式、索引、散列 | 这种关系怎样落到内存 |

Java 中最直接的类比是“接口与实现”：

```java
interface IntList {                 // ADT：声明逻辑和操作
    int get(int index);
    void add(int index, int value);
    int remove(int index);
}

// 同一个线性表 ADT，可以有两种物理实现：
// SeqList          -> 连续数组，顺序存储
// SinglyLinkedList -> 节点引用，链式存储
```

ADT 只规定数据对象、关系和操作语义，不规定字段布局。`List` 是逻辑上的线性表，`ArrayList` 与 `LinkedList` 才是不同存储实现；不能把“线性结构”等同于“数组”。

### 算法评价先固定输入规模

算法通常要求有穷性、确定性、可行性，可以有零个或多个输入，但至少有一个输出。评价复杂度时先定义输入规模 `n`，再数基本操作执行次数；忽略常数、低阶项和不影响增长阶的系数。

```text
T(n) = 3n² + 5n + 8  -> O(n²)
S(n) = 2n + 32       -> O(n)
```

必须分清最好、平均和最坏情况，也要把递归栈、临时数组、队列等辅助空间算进去。原地算法通常指辅助空间为 `O(1)`，不是“完全不使用任何变量”。遇到代码题先写清 `n` 代表数组长度、节点数还是顶点数，后面的复杂度结论才有意义。

## 第一站：线性表，把引用翻译成指针

### 顺序表：重点是搬移，不是 `ArrayList`

```java
package linear;

public final class SeqList {
    private int[] data = new int[4];
    private int size;

    public void add(int index, int value) {
        if (index < 0 || index > size) throw new IndexOutOfBoundsException();
        ensureCapacity();
        for (int i = size; i > index; i--) data[i] = data[i - 1];
        data[index] = value;
        size++;
    }

    public int remove(int index) {
        check(index);
        int old = data[index];
        for (int i = index; i < size - 1; i++) data[i] = data[i + 1];
        size--;
        return old;
    }

    public int get(int index) {
        check(index);
        return data[index];
    }

    private void ensureCapacity() {
        if (size < data.length) return;
        int[] next = new int[data.length * 2];
        for (int i = 0; i < size; i++) next[i] = data[i];
        data = next;
    }

    private void check(int index) {
        if (index < 0 || index >= size) throw new IndexOutOfBoundsException();
    }
}
```

随机访问是 `O(1)`；按位置插入、删除平均和最坏都是 `O(n)`，因为要搬元素。动态扩容的单次成本是 `O(n)`，连续尾插通常讨论均摊 `O(1)`。试题经常区分“某次操作”和“连续操作”，不要把两者混为一谈。

### 静态链表：用数组下标模拟指针

静态链表把节点放进固定数组，`next` 保存的不是 `Node` 引用，而是下一个节点的数组下标。`-1` 相当于 `NULL`。它适合没有指针或不允许动态分配内存的环境，也经常用于比较顺序表、普通链表和游标实现。

```java
static final class StaticLinkedList {
    private static final int NIL = -1;

    static final class Cell {
        int data;
        int next;
    }

    private final Cell[] cells;
    private int head = NIL;
    private int freeHead;

    StaticLinkedList(int capacity) {
        cells = new Cell[capacity];
        for (int i = 0; i < capacity; i++) {
            cells[i] = new Cell();
            cells[i].next = i + 1 < capacity ? i + 1 : NIL;
        }
        freeHead = capacity == 0 ? NIL : 0;
    }

    private int allocate(int value) {
        if (freeHead == NIL) throw new IllegalStateException("full");
        int index = freeHead;
        freeHead = cells[index].next;
        cells[index].data = value;
        cells[index].next = NIL;
        return index;
    }

    private void release(int index) {
        cells[index].next = freeHead;
        freeHead = index;
    }

    int insertAfter(int previous, int value) {
        int node = allocate(value);
        if (previous == NIL) {
            cells[node].next = head;
            head = node;
        } else {
            cells[node].next = cells[previous].next;
            cells[previous].next = node;
        }
        return node;
    }

    int removeAfter(int previous) {
        int target = previous == NIL ? head : cells[previous].next;
        if (target == NIL) throw new IllegalStateException("nothing to remove");
        if (previous == NIL) head = cells[target].next;
        else cells[previous].next = cells[target].next;
        int value = cells[target].data;
        release(target);
        return value;
    }
}
```

这里同时维护两条链：`head` 串起已使用节点，`freeHead` 串起空闲槽位。已知前驱下标时插删为 `O(1)`，按值查找仍为 `O(n)`；容量固定、不能直接按逻辑位置随机访问。亲手写一次分配、回收和首节点插删就够了，不值得扩成通用容器。

### 单链表：所有算法都先问“谁会丢”

```java
static final class Node {
    int value;
    Node next;
    Node(int value) { this.value = value; }
}

static Node reverse(Node head) {
    Node prev = null;
    Node cur = head;
    while (cur != null) {
        Node next = cur.next; // 先保存后继，否则改指针后余链会丢
        cur.next = prev;
        prev = cur;
        cur = next;
    }
    return prev;
}

static Node mergeSorted(Node a, Node b) {
    Node dummy = new Node(0);
    Node tail = dummy;
    while (a != null && b != null) {
        if (a.value <= b.value) {
            tail.next = a;
            a = a.next;
        } else {
            tail.next = b;
            b = b.next;
        }
        tail = tail.next;
    }
    tail.next = a != null ? a : b;
    return dummy.next;
}

static void deduplicateSorted(Node head) {
    for (Node cur = head; cur != null && cur.next != null; ) {
        if (cur.value == cur.next.value) cur.next = cur.next.next;
        else cur = cur.next;
    }
}
```

`dummy` 是头节点，不保存业务数据。它让“删除第一个元素”和“删除中间元素”走同一条路径。没有头节点时，删除首元节点可能改变 `head`；C 中常用 `Node **head`，Java 中通常返回新头。

双链表删除节点 `p` 的核心是同时维护两条边：

```text
p.prev.next = p.next
p.next.prev = p.prev
```

循环链表则把终止条件从 `p != null` 改为“是否回到起点”。最常见死循环原因，是写成普通链表的终止条件。

建议实验：逆置空链表和单节点；合并两个有序链表且其中一个为空；有序去重包含连续三个重复值；在循环链表中单步观察何时回到 `head`。

## 第二站：栈、队列与特殊矩阵

### 栈：`top` 到底指向哪里必须先约定

以下约定 `top` 是下一个可写位置，因此空栈 `top == 0`，栈顶元素在 `data[top - 1]`：

```java
final class ArrayStack {
    private final int[] data;
    private int top;

    ArrayStack(int capacity) { data = new int[capacity]; }

    void push(int value) {
        if (top == data.length) throw new IllegalStateException("full");
        data[top++] = value;
    }

    int pop() {
        if (top == 0) throw new IllegalStateException("empty");
        return data[--top];
    }
}
```

括号匹配、表达式求值、函数调用和二叉树非递归遍历，本质上都在保存“暂时没处理完的现场”。递归不是魔法，每一层至少保存参数、局部变量和返回位置。

### 循环队列：先写约定，再写判空判满

牺牲一个数组位置时，`front` 指向队头，`rear` 指向下一可写位置：

```java
final class CircularQueue {
    private final int[] data;
    private int front;
    private int rear;

    CircularQueue(int usableCapacity) { data = new int[usableCapacity + 1]; }

    boolean isEmpty() { return front == rear; }
    boolean isFull() { return (rear + 1) % data.length == front; }
    int size() { return (rear - front + data.length) % data.length; }

    void offer(int value) {
        if (isFull()) throw new IllegalStateException("full");
        data[rear] = value;
        rear = (rear + 1) % data.length;
    }

    int poll() {
        if (isEmpty()) throw new IllegalStateException("empty");
        int value = data[front];
        front = (front + 1) % data.length;
        return value;
    }
}
```

若题目改用 `size` 计数或 `tag` 标记，判满条件也会改变。不要背一个公式后套到所有定义。双端队列只是在两端都允许入队/出队，选择题常考受限双端队列能否生成某个序列。

链式队列不需要判满，但要同时维护队头和队尾。采用头节点时，空队列满足 `front == rear`；入队改 `rear.next` 后再移动 `rear`，删除最后一个元素后 `front` 和 `rear` 应再次指向同一个头节点。考试最常挖的坑是只移动其中一个指针。

### 特殊矩阵：二维问题最终都要落到一维下标

以下均采用 0 下标：

| 结构 | 一维位置 `k` | 存储量 |
| --- | --- | --- |
| 行优先 `m × n` | `k = i * n + j` | `mn` |
| 对称矩阵下三角 `i >= j` | `k = i * (i + 1) / 2 + j` | `n(n+1)/2` |
| 对称矩阵上三角 `i < j` | 交换 `i, j` 后套下三角 | `n(n+1)/2` |
| 三对角矩阵 `|i-j| <= 1` | `k = 2 * i + j` | `3n-2` |

公式不要裸背。画出前三行，按实际存储顺序从 0 编号，再找第 `i` 行之前一共存了多少个元素。

## 第三站：串与 KMP，不回退主串指针

BF 失配后把模式串整体右移一位，最坏 `O(nm)`。KMP 利用模式串自己的前后缀信息，让主串下标 `i` 不回退。

本文固定采用 0 下标、`next[0] = -1` 的定义：`next[j]` 表示模式串在 `j` 处失配后，模式串下标应跳到哪里。

```java
static int[] buildNext(String pattern) {
    int[] next = new int[pattern.length()];
    next[0] = -1;
    int j = 0;
    int k = -1;
    while (j < pattern.length() - 1) {
        if (k == -1 || pattern.charAt(j) == pattern.charAt(k)) {
            j++;
            k++;
            next[j] = k;
        } else {
            k = next[k];
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

对模式串 `ABABAA` 手算：

```text
下标      0  1  2  3  4  5
字符      A  B  A  B  A  A
next     -1  0  0  1  2  3
nextval  -1  0 -1  0 -1  3
```

例如 `j = 4` 前已经匹配 `ABAB`，它的最长相等真前后缀是 `AB`，所以下次从模式串下标 2 继续，不必重新比较主串前面的字符。`nextval` 进一步跳过“跳过去仍会拿同一个字符比较”的无效位置。

教材的 `next` 可能从 1 开始，也可能记录“最长公共前后缀长度”。数值不一致不代表算法不同，答题前必须先确认定义。构造 `next` 是 `O(m)`，匹配是 `O(n)`，总复杂度 `O(n+m)`，辅助空间 `O(m)`。

## 第四站：树，把递归栈显式画出来

```java
static final class TreeNode {
    int value;
    TreeNode left;
    TreeNode right;
    TreeNode(int value) { this.value = value; }
}
```

### 递归与非递归遍历

```java
static void preorder(TreeNode root) {
    if (root == null) return;
    visit(root);
    preorder(root.left);
    preorder(root.right);
}

static void inorderIterative(TreeNode root) {
    TreeNode[] stack = new TreeNode[100];
    int top = 0;
    TreeNode cur = root;
    while (cur != null || top > 0) {
        while (cur != null) {
            stack[top++] = cur;
            cur = cur.left;
        }
        cur = stack[--top];
        visit(cur);
        cur = cur.right;
    }
}

static void postorderIterative(TreeNode root) {
    TreeNode[] stack = new TreeNode[100];
    int top = 0;
    TreeNode cur = root;
    TreeNode lastVisited = null;
    while (cur != null || top > 0) {
        if (cur != null) {
            stack[top++] = cur;
            cur = cur.left;
        } else {
            TreeNode peek = stack[top - 1];
            if (peek.right != null && peek.right != lastVisited) {
                cur = peek.right;
            } else {
                visit(peek);
                lastVisited = stack[--top];
            }
        }
    }
}
```

先序是“节点一入栈就处理”，中序是“左边走到底后弹栈处理”，后序必须知道右子树是否已访问，所以多一个 `lastVisited`。层序遍历则把栈换成队列。

### 高频性质

| 性质 | 结论 |
| --- | --- |
| 非空二叉树 | `n0 = n2 + 1`，`n0` 为叶子数，`n2` 为度为 2 的节点数 |
| 第 `i` 层最多节点数 | `2^(i-1)`，根为第 1 层 |
| 高度为 `h` 的二叉树最多节点 | `2^h - 1` |
| 含 `n` 个节点的完全二叉树高度 | `floor(log2 n) + 1` |
| 0 下标完全二叉树 | 左孩子 `2i+1`，右孩子 `2i+2`，父节点 `(i-1)/2` |

### 树的计算题与卡特兰数

树中有 `n` 个节点就有 `n-1` 条边，因此所有节点的度数之和也是 `n-1`。很多公式不必死背：画出“节点数、边数、各度节点数”的关系再列方程，更不容易混用二叉树和普通树的结论。

卡特兰数解决的是一类“左右有序、递归地拆成左右两部分”的计数问题：

```text
C0 = 1
Cn = 1 / (n + 1) * C(2n, n)
Cn = Σ Ci * C(n - 1 - i)，其中 i = 0..n-1

C0, C1, C2, C3, C4 = 1, 1, 2, 5, 14
```

计算机基础数据结构中常见三个入口：

1. `n` 个节点只计左右有序形态时，不同二叉树形态数为 `Cn`。
2. `1..n` 依次入栈时，合法出栈序列数为 `Cn`。
3. `n` 个互异关键字的中序次序固定时，不同二叉排序树形态数为 `Cn`。

“节点互异”不能直接推出答案是 `Cn`。如果普通二叉树的 `n` 个节点标签还能任意排列，总数是 `n! * Cn`；只有形态计数，或二叉排序树已经由关键字大小固定中序次序时，才直接使用卡特兰数。它属于手算知识，不需要为了公式再写一个 Java 工程。

线索二叉树利用空的左右指针保存遍历前驱和后继，并用 `ltag/rtag` 区分“孩子边”和“线索边”。它的重点是画线索、找前驱后继，不是默写一套大型 Java 类。

树/森林转二叉树使用“左孩子、右兄弟”：树节点的第一个孩子变成左孩子，下一个兄弟变成右孩子。口诀只是入口，必须画一棵至少有三兄弟、某个孩子还有孩子的树验证。

## 第五站：BST、AVL、红黑树、Huffman 与并查集

### BST：中序遍历有序，删除最容易出题

```java
static TreeNode bstDelete(TreeNode root, int key) {
    if (root == null) return null;
    if (key < root.value) root.left = bstDelete(root.left, key);
    else if (key > root.value) root.right = bstDelete(root.right, key);
    else {
        if (root.left == null) return root.right;
        if (root.right == null) return root.left;
        TreeNode successor = root.right;
        while (successor.left != null) successor = successor.left;
        root.value = successor.value;
        root.right = bstDelete(root.right, successor.value);
    }
    return root;
}
```

删除分三类：叶子直接删；只有一个孩子就让孩子顶上；两个孩子时，用中序前驱或后继替换，再删除那个前驱/后继。平均查找可到 `O(log n)`，但有序插入会退化成链表，最坏 `O(n)`。

### AVL：失衡点、较高孩子、较高孙子决定旋转

平衡因子通常定义为 `height(left) - height(right)`，只允许 `-1、0、1`。

```text
LL：右旋失衡点
RR：左旋失衡点
LR：先左旋左孩子，再右旋失衡点
RL：先右旋右孩子，再左旋失衡点
```

旋转后要自底向上更新高度。调试时盯住 `node.value`、左右子树高度、平衡因子和旋转后的新根。AVL 的插入和查找为 `O(log n)`；完整删除修复属于 A 级，先做到能判断旋转类型和补全代码。

### 红黑树：理解约束，不手搓 `TreeMap`

红黑树用较弱平衡换更少旋转：根黑、空叶黑、红节点的孩子必须黑、任一路径黑高相同。最长根叶路径不会超过最短路径的两倍，因此查找、插入、删除仍为 `O(log n)`。Java `TreeMap` 可作为工程参照，但统考训练要能独立画出变色和旋转，不应调用它代替算法。

### Huffman：每次选权值最小的两棵树

有 `n` 个叶子时，Huffman 树共有 `2n-1` 个节点。带权路径长度 `WPL = Σ(weight × depth)`。构造时重复选择两个最小权值合并；编码时左 0 右 1，得到前缀编码。优先队列是工程实现，考试还会让你手工画树、算 WPL 和编码长度。

### 并查集：路径压缩 + 按大小合并

```java
final class UnionFind {
    private final int[] parent;
    private final int[] size;

    UnionFind(int n) {
        parent = new int[n];
        size = new int[n];
        for (int i = 0; i < n; i++) {
            parent[i] = i;
            size[i] = 1;
        }
    }

    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);
        return parent[x];
    }

    void union(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra == rb) return;
        if (size[ra] < size[rb]) { int t = ra; ra = rb; rb = t; }
        parent[rb] = ra;
        size[ra] += size[rb];
    }
}
```

它支撑 Kruskal 的“是否成环”判断。带路径压缩和按秩/大小合并后，均摊复杂度近似常数，严格写作 `O(α(n))`。

## 第六站：图，先固定存储再谈算法

邻接矩阵 `matrix[u][v]` 查边 `O(1)`，空间 `O(V²)`，适合稠密图；邻接表空间 `O(V+E)`，遍历某顶点邻边更自然，适合稀疏图。无向图每条边在邻接表中出现两次，计算度数和边数时别重复。

### 十字链表与邻接多重表：只认边节点字段

这两种结构的价值是让一条边只保存一次，同时仍能沿某个顶点找到相关边。它们属于结构识别题，不进入 Java 必写清单。

```text
有向图：十字链表

顶点节点 Vertex
├── firstOut  -> 第一条以该点为弧尾的弧
└── firstIn   -> 第一条以该点为弧头的弧

弧节点 Arc
├── tail      -> 弧尾顶点下标
├── head      -> 弧头顶点下标
├── tailLink  -> 下一条弧尾相同的弧
└── headLink  -> 下一条弧头相同的弧
```

十字链表把邻接表和逆邻接表交叉在同一批弧节点上，适合同时求出度、入度和删除有向边。

```text
无向图：邻接多重表

顶点节点 Vertex
└── firstEdge -> 第一条与该点关联的边

边节点 Edge
├── iVertex / jVertex -> 边的两个端点
├── iLink             -> 下一条与 iVertex 关联的边
└── jLink             -> 下一条与 jVertex 关联的边
```

看到边节点时，先根据当前顶点等于 `iVertex` 还是 `jVertex`，决定沿 `iLink` 还是 `jLink` 继续。会画一张包含三条边的结构图、解释为何便于删边即可，不必手写完整实现。

### BFS 与 DFS

```java
static void bfs(int[][] graph, int start) {
    boolean[] visited = new boolean[graph.length];
    int[] queue = new int[graph.length];
    int front = 0, rear = 0;
    visited[start] = true;
    queue[rear++] = start;
    while (front < rear) {
        int u = queue[front++];
        visit(u);
        for (int v = 0; v < graph.length; v++) {
            if (graph[u][v] != 0 && !visited[v]) {
                visited[v] = true; // 入队时标记，避免重复入队
                queue[rear++] = v;
            }
        }
    }
}

static void dfs(int[][] graph, int u, boolean[] visited) {
    visited[u] = true;
    visit(u);
    for (int v = 0; v < graph.length; v++) {
        if (graph[u][v] != 0 && !visited[v]) dfs(graph, v, visited);
    }
}
```

若图不保证连通，外层还要遍历所有顶点，对未访问顶点再次启动 BFS/DFS。矩阵实现的遍历时间是 `O(V²)`，邻接表是 `O(V+E)`。

### MST：Prim 扩顶点，Kruskal 选边

| 算法 | 每次选择 | 防止成环/重复 | 更适合 |
| --- | --- | --- | --- |
| Prim | 到当前树距离最小的新顶点 | `visited` | 稠密图 |
| Kruskal | 全局最小且不成环的边 | 并查集 | 稀疏图 |

Prim 的核心数组是 `lowCost[v]` 和 `parent[v]`；Kruskal 先按边权排序，再对边 `(u,v)` 判断 `find(u) != find(v)`。MST 要求无向、连通、带权。权值相同可能导致 MST 不唯一，但最小总权值相同。

### 最短路径：先检查边权和问题类型

| 问题 | 算法 | 限制 | 典型复杂度 |
| --- | --- | --- | --- |
| 无权图单源 | BFS | 每条边等权 | `O(V+E)` |
| 非负权单源 | Dijkstra | 不能有负权边 | 矩阵 `O(V²)` |
| 多源最短路 | Floyd | 可有负边，不能有负环 | `O(V³)` |

Dijkstra 的数组版骨架：

```java
static int[] dijkstra(int[][] w, int source, int inf) {
    int n = w.length;
    int[] dist = new int[n];
    boolean[] fixed = new boolean[n];
    for (int v = 0; v < n; v++) dist[v] = w[source][v];
    dist[source] = 0;
    for (int round = 0; round < n; round++) {
        int u = -1;
        for (int v = 0; v < n; v++)
            if (!fixed[v] && (u == -1 || dist[v] < dist[u])) u = v;
        if (u == -1 || dist[u] == inf) break;
        fixed[u] = true;
        for (int v = 0; v < n; v++) {
            if (!fixed[v] && w[u][v] < inf && dist[u] <= inf - w[u][v])
                dist[v] = Math.min(dist[v], dist[u] + w[u][v]);
        }
    }
    return dist;
}
```

Floyd 的循环顺序不能乱：

```java
for (int k = 0; k < n; k++)
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++)
            dist[i][j] = Math.min(dist[i][j], dist[i][k] + dist[k][j]);
```

外层 `k` 表示“只允许 0..k 作为中间点”的动态规划阶段。

### 拓扑排序与关键路径

拓扑排序只适用于 DAG。把所有入度为 0 的顶点入栈或入队，每取出一个顶点就删除其出边；最终输出数小于 `V`，说明存在环。若任一步同时出现多个零入度候选，就能交换候选的先后次序，拓扑序不唯一；每一步都恰好只有一个候选时，拓扑序唯一。

AOE 网的关键路径计算四组量：

```text
ve[v]：事件 v 最早发生时间，按拓扑序正向取 max
vl[v]：事件 v 最迟发生时间，按逆拓扑序反向取 min
ee(u,v)：活动最早开始 = ve[u]
el(u,v)：活动最迟开始 = vl[v] - weight(u,v)
松弛量：el - ee，为 0 的活动是关键活动
```

例：`0→1(3), 0→2(2), 1→3(2), 2→3(4), 3→4(3)`。

```text
ve = [0, 3, 2, 6, 9]
vl = [0, 4, 2, 6, 9]
关键活动：0→2、2→3、3→4
关键路径长度：9
```

项目工期由最长路径决定。缩短非关键活动不一定缩短总工期；关键路径也可能不止一条。

## 第七站：查找，把“比较次数”落到查找过程

### 顺序、折半与分块

顺序查找可在数组首位放“哨兵”，把循环里的越界判断移出去。折半查找要求顺序存储且有序：

```java
static int binarySearch(int[] a, int target) {
    int low = 0, high = a.length - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (a[mid] == target) return mid;
        if (a[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}
```

折半判定树可用来计算成功/失败 ASL。分块查找要求块间有序、块内可无序，先查索引再顺序查块，成本是两段比较次数之和。

### B 树与 B+ 树：磁盘查找结构，不是二叉树

| 对比 | B 树 | B+ 树 |
| --- | --- | --- |
| 数据位置 | 内部和叶节点都可保存记录 | 记录集中在叶节点 |
| 叶节点 | 通常不要求横向链接 | 常按关键字链接 |
| 单点查找 | 可能在内部节点结束 | 必须走到叶节点 |
| 范围查找 | 不如 B+ 树顺滑 | 沿叶链顺序扫描 |

对 `m` 阶 B 树，非根内部节点的孩子数通常在 `ceil(m/2)` 到 `m` 之间，关键字数比孩子数少 1。题目可能采用不同“阶”的定义，先读清题干。B/B+ 树属于 B 级：会插入分裂、删除借位/合并和性质判断，不要求默写完整 Java 工程。

### Hash：装填因子决定冲突概率

```java
static int search(int[] table, boolean[] used, int key) {
    int m = table.length;
    int start = Math.floorMod(key, m);
    for (int step = 0; step < m; step++) {
        int i = (start + step) % m; // 线性探测
        if (!used[i]) return -1;
        if (table[i] == key) return i;
    }
    return -1;
}
```

常见散列函数有除留余数、直接定址、数字分析；冲突处理有开放定址和拉链法。装填因子 `α = 实际记录数 / 表长`。开放定址删除不能直接改成“从未使用”，否则会截断后续探测链，应使用删除标记。ASL 必须按题目给定的散列函数、探测顺序和成功/失败定义逐项计算。

## 第八站：排序，用同一张表比较

先把所有算法放进同一套坐标：

| 算法 | 最好 | 平均 | 最坏 | 辅助空间 | 稳定 | 原地 | 模板级别 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 直接插入 | `O(n)` | `O(n²)` | `O(n²)` | `O(1)` | 是 | 是 | S |
| 折半插入 | `O(n log n)` | `O(n²)` | `O(n²)` | `O(1)` | 是 | 是 | A |
| Shell | 与增量有关 | 与增量有关 | 常见上界 `O(n²)` | `O(1)` | 否 | 是 | A |
| 冒泡 | `O(n)` | `O(n²)` | `O(n²)` | `O(1)` | 是 | 是 | S |
| 快速 | `O(n log n)` | `O(n log n)` | `O(n²)` | 平均 `O(log n)`，最坏 `O(n)` | 否 | 是 | S |
| 简单选择 | `O(n²)` | `O(n²)` | `O(n²)` | `O(1)` | 否 | 是 | S |
| 堆排序 | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(1)` | 否 | 是 | S |
| 二路归并 | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(n)` | 是 | 否 | S |
| 基数排序 | `O(d(n+r))` | 同左 | 同左 | `O(n+r)` | 是 | 否 | A |

折半插入只减少关键字比较，不减少元素搬移，所以平均和最坏时间仍是 `O(n²)`；经典实现即使输入有序也要折半定位，最好时间为 `O(n log n)`。简单选择无论原序列如何都要做约 `n(n-1)/2` 次比较。稳定性讨论的是“相等关键字的相对次序”。

### 高频排序核心模板

```java
static void insertionSort(int[] a) {
    for (int i = 1; i < a.length; i++) {
        int value = a[i], j = i - 1;
        while (j >= 0 && a[j] > value) a[j + 1] = a[j--];
        a[j + 1] = value;
    }
}

static void binaryInsertionSort(int[] a) {
    for (int i = 1; i < a.length; i++) {
        int value = a[i], low = 0, high = i - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (a[mid] <= value) low = mid + 1; // 插到相等元素之后，保持稳定
            else high = mid - 1;
        }
        for (int j = i; j > low; j--) a[j] = a[j - 1];
        a[low] = value;
    }
}

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

static void selectionSort(int[] a) {
    for (int i = 0; i < a.length - 1; i++) {
        int min = i;
        for (int j = i + 1; j < a.length; j++) if (a[j] < a[min]) min = j;
        swap(a, i, min);
    }
}

static void shellSort(int[] a) {
    for (int gap = a.length / 2; gap > 0; gap /= 2) {
        for (int i = gap; i < a.length; i++) {
            int value = a[i], j = i;
            while (j >= gap && a[j - gap] > value) {
                a[j] = a[j - gap];
                j -= gap;
            }
            a[j] = value;
        }
    }
}
```

Shell 排序就是按增量分组做插入排序；基数排序则按个位、十位等“桶”稳定分配与收集。仅处理非负整数的最低位优先版本如下，`count` 经过前缀和后表示每个桶在输出数组中的结束位置，从右向左放置才能保持稳定：

```java
static void radixSortNonNegative(int[] a) {
    int max = 0;
    for (int value : a) max = Math.max(max, value);
    int[] output = new int[a.length];
    for (int exp = 1; max / exp > 0; exp *= 10) {
        int[] count = new int[10];
        for (int value : a) count[(value / exp) % 10]++;
        for (int i = 1; i < 10; i++) count[i] += count[i - 1];
        for (int i = a.length - 1; i >= 0; i--) {
            int digit = (a[i] / exp) % 10;
            output[--count[digit]] = a[i];
        }
        for (int i = 0; i < a.length; i++) a[i] = output[i];
        if (exp > Integer.MAX_VALUE / 10) break;
    }
}
```

用具体序列记录“每趟结束”比只看最终输出更有效：

| 算法 | 输入 | 关键中间状态 |
| --- | --- | --- |
| 插入/折半插入 | `[5,2,4,2]` | `[2,5,4,2] → [2,4,5,2] → [2,2,4,5]` |
| Shell，增量 `2,1` | `[5,2,4,2]` | `gap=2: [4,2,5,2] → gap=1: [2,2,4,5]` |
| 冒泡 | `[5,2,4,2]` | 第一趟 `[2,4,2,5]`，第二趟 `[2,2,4,5]` |
| 简单选择 | `[2a,2b,1]` | 首趟把 `1` 与 `2a` 交换，得到 `[1,2b,2a]`，相等元素次序反转，因此不稳定 |
| 基数 | `[329,457,657,839,436,720,355]` | 个位 `[720,355,436,457,657,329,839]`；十位 `[720,329,436,839,355,457,657]`；百位后有序 |

快排、堆排和归并的逐步状态分别在下面三节展开。统考试题常用这些中间状态考“完成一趟后的序列”、比较/移动次数、稳定性、递归深度和最坏输入。

## 快速排序：先固定一种 partition

代码填空最怕混用 Hoare 与 Lomuto。第一轮只背一种。下面是首元素枢轴、左右挖坑式分区：

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
    int p = partition(a, low, high);
    quickSort(a, low, p - 1);
    quickSort(a, p + 1, high);
}
```

对 `[49, 38, 65, 97, 76, 13, 27]`，枢轴为 49：

```text
右侧找到 27，填左坑：[27, 38, 65, 97, 76, 13, 27]
左侧找到 65，填右坑：[27, 38, 65, 97, 76, 13, 65]
右侧找到 13，填左坑：[27, 38, 13, 97, 76, 13, 65]
左侧停在 97，填右坑：[27, 38, 13, 97, 76, 97, 65]
指针相遇，填回 49：[27, 38, 13, 49, 76, 97, 65]
```

每趟分区是 `O(n)`。分区接近均匀时递归深度 `O(log n)`，总时间 `O(n log n)`；每次都选到最小/最大值时深度 `O(n)`，总时间 `O(n²)`。随机枢轴和三数取中能改善工程表现，但不是第一轮统考模板重点。

## 堆与堆排序：数组里的一棵完全二叉树

0 下标大根堆满足 `a[parent] >= a[child]`。向下调整：

```java
static void siftDown(int[] a, int root, int size) {
    int value = a[root];
    for (int child = root * 2 + 1; child < size; child = child * 2 + 1) {
        if (child + 1 < size && a[child + 1] > a[child]) child++;
        if (a[child] <= value) break;
        a[root] = a[child];
        root = child;
    }
    a[root] = value;
}

static void heapSort(int[] a) {
    for (int i = a.length / 2 - 1; i >= 0; i--) siftDown(a, i, a.length);
    for (int end = a.length - 1; end > 0; end--) {
        swap(a, 0, end);
        siftDown(a, 0, end);
    }
}
```

建堆不是简单地说“`n/2` 个节点，每个 `log n`，所以 `O(n log n)`”。越靠近叶子的节点越多、下沉高度越小，总代价是各高度节点数乘高度的级数和，收敛到 `O(n)`。随后 `n-1` 次取堆顶和调整才是 `O(n log n)`。

若题目采用 1 下标，孩子改为 `2i` 和 `2i+1`，父节点为 `floor(i/2)`。下标体系不能混用。

## 归并排序：稳定来自“相等时先取左边”

```java
static void mergeSort(int[] a, int left, int right, int[] temp) {
    if (left >= right) return;
    int mid = left + (right - left) / 2;
    mergeSort(a, left, mid, temp);
    mergeSort(a, mid + 1, right, temp);
    int i = left, j = mid + 1, k = left;
    while (i <= mid && j <= right)
        temp[k++] = a[i] <= a[j] ? a[i++] : a[j++];
    while (i <= mid) temp[k++] = a[i++];
    while (j <= right) temp[k++] = a[j++];
    for (int p = left; p <= right; p++) a[p] = temp[p];
}
```

时间始终是 `O(n log n)`，辅助数组 `O(n)`，递归栈 `O(log n)`。`a[i] <= a[j]` 时先拿左段元素，保住相等元素原有顺序，因此稳定。外部排序以归并为核心，是因为每次只需顺序读取若干归并段，不要求所有数据进入内存。

## 外部排序：优化对象是磁盘 I/O，不是 CPU 比较次数

内部排序假设数据能放进内存；外部排序面对的是数据量大于可用内存的情况。基本流程只有两步：先分批读入内存并生成若干个内部有序的初始归并段，再反复做多路归并，直到只剩一个有序文件。

```text
原始文件
  ↓ 每次读入内存可容纳的一批记录
内部排序
  ↓
初始归并段 R1, R2, ..., Rr
  ↓ k 路归并若干趟
有序文件
```

若共有 `N` 条记录，内存一次容纳 `M` 条，固定分块生成的初始归并段数约为：

```text
r = ceil(N / M)
```

每次最多归并 `k` 段时，平衡归并需要的趟数为：

```text
passes = ceil(log_k r)
```

每一趟都要顺序读完并写回全部记录，所以合并阶段的记录传输量近似 `2N * passes`。例如 `N=10000`、`M=1000`，初始有 10 段：二路归并需要 4 趟，五路归并只需 2 趟。增加 `k` 可以减少趟数，但至少需要 `k` 个输入缓冲区和 1 个输出缓冲区，不能无限增大。

### 用数组模拟一次多路归并

下面不碰文件系统，只把每个已排序数组看成一个归并段。它刻意使用线性扫描选择当前最小值，让过程容易单步；真正的大规模归并会用败者树把选最小值从 `O(k)` 降到 `O(log k)`。

```java
static int[] mergeSortedRuns(int[][] runs) {
    int total = 0;
    for (int[] run : runs) total += run.length;
    int[] position = new int[runs.length];
    int[] output = new int[total];

    for (int out = 0; out < total; out++) {
        int winner = -1;
        for (int r = 0; r < runs.length; r++) {
            if (position[r] >= runs[r].length) continue;
            if (winner == -1 || runs[r][position[r]] < runs[winner][position[winner]]) {
                winner = r;
            }
        }
        output[out] = runs[winner][position[winner]++];
    }
    return output;
}
```

用 `[[2,9,18], [1,7,20], [3,4,15]]` 调试时，只盯 `position`、`winner` 和输出区。全部记录只写一次，但每次选胜者要扫描 `k` 段，总比较成本为 `O(Nk)`；败者树或小根堆可降为 `O(N log k)`。

### 败者树、置换选择与最佳归并树各解决什么

| 技术 | 解决的问题 | 必须记住的动作 |
| --- | --- | --- |
| 败者树 | `k` 路归并时反复选最小记录 | 内部节点保存比较中的败者，胜者向上；输出一个记录后只重赛该叶到根的路径 |
| 置换选择 | 固定内存下生成更长的初始归并段 | 小根堆输出当前最小值；新读记录若小于本段最后输出值，就冻结到下一段 |
| 最佳归并树 | 各归并段长度不同时减少总读写量 | 把段长当权值，按 Huffman 思想优先合并较短归并段 |

置换选择生成的段长不再被 `M` 严格限制，可能明显长于内存容量，但输入次序极差时也可能很短。`k` 路最佳归并树若不满足 `(r - 1) mod (k - 1) = 0`，要补权值为 0 的虚段，使每个内部节点都能按 `k` 路合并，再按 Huffman 思想计算最小带权路径长度。

外部排序的高频考法不是让你实现磁盘系统，而是：根据内存容量算初始段数，根据 `k` 算归并趟数与 I/O，根据段长画最佳归并树，或解释败者树与置换选择分别减少了哪一部分成本。

## 从代码反推复杂度

| 代码形态 | 识别方法 | 复杂度 |
| --- | --- | --- |
| 单循环走 `n` 次 | 计数变量线性变化 | `O(n)` |
| `i *= 2` | 看翻倍多少次达到 `n` | `O(log n)` |
| 两层都走 `n` | 乘法原则 | `O(n²)` |
| 内层走到 `i` | 求和 `1+2+...+n` | `O(n²)` |
| 递归二分且每层常数工作 | `T(n)=T(n/2)+O(1)` | `O(log n)` |
| 两个子问题且每层合并 `n` | `T(n)=2T(n/2)+O(n)` | `O(n log n)` |
| 遍历图邻接表 | 每顶点、每边有限次 | `O(V+E)` |

空间复杂度要把递归栈算进去。递归遍历平衡树为 `O(log n)`，退化树为 `O(n)`；迭代算法的显式栈并没有让空间凭空消失。

## 调试器训练法：不要只盯最终输出

| 算法 | 断点位置 | 必看变量 | 失败征兆 |
| --- | --- | --- | --- |
| 链表逆置 | `cur.next = prev` 前后 | `prev, cur, next` | 后半条链突然不可达 |
| 循环队列 | 入队、出队后 | `front, rear, size` | 满与空同时成立 |
| KMP | 失配分支 | `i, j, next[j]` | `i` 回退或 `j` 不收敛 |
| 中序遍历 | 入栈、弹栈 | `cur, top, stack` | 节点漏访问或重复 |
| AVL | 更新高度后 | 高度、平衡因子、新根 | 旋转后高度仍错误 |
| Dijkstra | 选定 `u` 后 | `fixed, dist, u` | 负边导致已确定距离被推翻 |
| 快排 | 每次填坑 | `low, high, pivot` | 指针不移动造成死循环 |
| 堆调整 | 选择较大孩子后 | `root, child, size` | 把已排序区重新纳入堆 |
| 归并 | 合并循环 | `i, j, k, temp` | 边界元素遗漏 |

每个算法至少做 2 到 5 个小实验：正常例、最小例、边界例、退化例、故障注入。故障注入尤其有效，例如故意把循环队列判满写成 `rear == front`，亲眼看它如何与判空冲突。

## Java 与 C/考试伪代码如何双写

以链表逆置为例：

```java
Node prev = null, cur = head;
while (cur != null) {
    Node next = cur.next;
    cur.next = prev;
    prev = cur;
    cur = next;
}
head = prev;
```

```c
Node *prev = NULL, *cur = head;
while (cur != NULL) {
    Node *next = cur->next;
    cur->next = prev;
    prev = cur;
    cur = next;
}
head = prev;
```

算法控制流完全相同，变化的是数据载体、长度传递方式和内存责任。链表代表“指针 + 节点”这一类迁移；数组算法则通常只需要把 `a.length` 改成显式参数。

下面的 C 快排与前文 Java 版保持同一种填坑式分区，控制流可以逐行对应：

```c
static int partition(int a[], int low, int high) {
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

void quick_sort(int a[], int low, int high) {
    if (low >= high) return;
    int pivot = partition(a, low, high);
    quick_sort(a, low, pivot - 1);
    quick_sort(a, pivot + 1, high);
}
```

### 14 个 S 级算法强制双写一次

不是每个算法都长期维护两份，而是以下 14 个算法至少完成一次 Java → C 的独立转写。表中的函数签名本身就是纸面训练入口。

| 双写项 | C 入口建议 | 迁移时必须处理 |
| --- | --- | --- |
| 顺序表插删 | `int seq_insert(int a[], int *n, int capacity, int index, int value)` | 数组不带长度，修改逻辑长度要传 `int *n` |
| 单链表插删与逆置 | `Node *list_reverse(Node *head)` | `.` 变 `->`，首节点变化时返回新头或传 `Node **` |
| 循环队列 | `int enqueue(Queue *q, int value)` | `front/rear` 约定、判满公式、结构体地址 |
| 二叉树遍历 | `void preorder(const TreeNode *root)` | 空指针、递归返回条件、节点生命周期 |
| BST 插入与删除 | `TreeNode *bst_delete(TreeNode *root, int key)` | 子树新根必须通过返回值接回父节点 |
| KMP | `int kmp(const char text[], const char pattern[], const int next[])` | 字符串结尾、数组长度、下标定义一致 |
| BFS | `void bfs(int n, int graph[MAX_V][MAX_V], int start)` | 手写数组队列与 `visited`，二维数组第二维固定 |
| DFS | `void dfs(int n, int graph[MAX_V][MAX_V], int u, int visited[])` | 递归边界与非连通图的外层循环 |
| Dijkstra | `void dijkstra(int n, int graph[MAX_V][MAX_V], int source, int dist[])` | 无穷大、防溢出、固定集合与距离数组 |
| 折半查找 | `int binary_search(const int a[], int n, int target)` | 显式长度、闭区间边界、`low <= high` |
| QuickSort | `void quick_sort(int a[], int low, int high)` | 分区模板不能混用，递归区间排除枢轴 |
| HeapSort | `void heap_sort(int a[], int n)` | 0/1 下标统一，已排序区不能再入堆 |
| MergeSort | `void merge_sort(int a[], int left, int right, int temp[])` | 辅助数组由调用方提供，合并边界完整 |
| Hash 开放定址 | `int hash_search(const int table[], const unsigned char state[], int m, int key)` | 空槽与已删除槽分开，探测最多 `m` 次 |

### 双写的验收不是“翻译完能编译”

每一对实现使用同一组输入和中间状态断言。C 版至少用严格警告和运行时检查编译一次：

```bash
cc -std=c11 -Wall -Wextra -Werror \
  -fsanitize=address,undefined -g quick_sort.c -o quick_sort
./quick_sort
```

验收顺序固定为：先让 Java 输出关键中间状态，再让 C 输出完全相同的状态；随后测空结构、单元素、重复值、逆序和越界；使用 `malloc` 的实验必须释放内存；最后在纸上重写一次核心函数签名和循环。考试书写仍遵循四条：先写结构约定；变量名体现角色；关键边界不省略；写完补时间和空间复杂度。不要把 Java API 名字机械翻译成 C，而要翻译数据结构本身。

## 12 周线性 Coding 路线

| 周 | 主线 | 当周验收 |
| --- | --- | --- |
| 1 | 基本概念、顺序表、静态链表、单链表 | 分清逻辑/存储结构，完成顺序表与单链表 C 双写 |
| 2 | 双/循环链表、栈、循环队列 | 画清头节点与 `front/rear`，完成循环队列 C 双写 |
| 3 | 特殊矩阵、BF、KMP | 手算 `next/nextval`，完成 KMP C 双写 |
| 4 | 二叉树递归遍历、性质、卡特兰数 | 会列树计算方程，完成遍历 C 双写 |
| 5 | 非递归遍历、线索树、树森林转换 | 能画显式栈与线索 |
| 6 | BST、AVL、Huffman、并查集 | 删除、旋转、WPL、路径压缩，完成 BST C 双写 |
| 7 | 四种图存储、BFS、DFS | 能识别边节点字段，完成 BFS/DFS C 双写 |
| 8 | Prim、Kruskal、Dijkstra、Floyd | 会选算法并手算数组，完成 Dijkstra C 双写 |
| 9 | 拓扑排序、关键路径 | 完整计算 `ve/vl/ee/el` |
| 10 | 顺序、折半、分块、Hash、B/B+ 树 | 会算 ASL、画分裂合并，完成折半与 Hash C 双写 |
| 11 | 插入、冒泡、选择、快排 | 同一数组逐趟推演，完成 QuickSort C 双写 |
| 12 | 堆排、归并、基数、外部排序 | 会算归并趟数与 I/O，完成 HeapSort/MergeSort C 双写 |

工作日只做 30 分钟闭环；周末选一个算法做 Java/C 双写和纸面限时。某周中断时，不“补课到凌晨”，下一次从该周验收项继续。

## 最终总表

| 知识点 | Java 必须实现 | C/C++ 必须会写 | 是否需要默写 | 考试重要度 | 建议 Coding 次数 |
| --- | --- | --- | --- | --- | --- |
| 基本概念、ADT、算法评价 | 小型接口实验 | 会判断术语 | 性质与复杂度 | 高 | 1 |
| 顺序表插删查 | 是 | 是 | 是 | 高 | 3 |
| 静态链表 | 游标实验一次 | 会读游标 | 否 | 中 | 1 |
| 单链表插删、逆置、合并 | 是 | 是 | 是 | 极高 | 5 |
| 双链表、循环链表 | 核心操作 | 核心指针 | 补全 | 中 | 2 |
| 栈与循环队列 | 是 | 是 | 是 | 高 | 4 |
| 特殊矩阵映射 | 小实验 | 会写公式 | 是 | 中 | 2 |
| BF、KMP、next/nextval | 是 | 会写核心循环 | 是 | 高 | 5 |
| 二叉树递归/非递归遍历 | 是 | 是 | 是 | 极高 | 5 |
| 树的计算、卡特兰数 | 否 | 会列式 | 公式与边界 | 中 | 2 |
| 线索树、树森林转换 | 可选 | 会画会补 | 否 | 中 | 2 |
| BST 查插删 | 是 | 是 | 是 | 高 | 4 |
| AVL 旋转 | 是 | 会补全 | 旋转模板 | 高 | 4 |
| 红黑树 | 否 | 会判断 | 否 | 中 | 2 |
| Huffman | 是 | 会构造 | 核心过程 | 中 | 2 |
| 并查集 | 是 | 是 | 是 | 高 | 3 |
| 图矩阵/邻接表 | 是 | 会定义 | 核心结构 | 高 | 3 |
| 十字链表/邻接多重表 | 否 | 会认字段 | 否 | 中 | 1 |
| BFS/DFS | 是 | 是 | 是 | 极高 | 5 |
| Prim/Kruskal | 是 | 会补全 | 核心循环 | 高 | 3 |
| Dijkstra/Floyd | 是 | 会补全 | 核心循环 | 极高 | 4 |
| 拓扑排序/关键路径 | 是 | 会补全 | 核心过程 | 高 | 4 |
| 顺序/折半/分块查找 | 是 | 是 | 折半必写 | 高 | 3 |
| B 树/B+ 树 | 否 | 会画操作 | 否 | 高 | 3 |
| Hash 与 ASL | 是 | 会探测 | 核心循环 | 高 | 4 |
| 插入/冒泡/选择排序 | 是 | 是 | 是 | 高 | 3 |
| 快速排序 | 是 | 是 | 是 | 极高 | 5 |
| 堆排序 | 是 | 是 | 是 | 极高 | 5 |
| 归并排序 | 是 | 是 | 是 | 高 | 4 |
| Shell/基数排序 | 可选 | 会推演 | 否 | 中 | 2 |
| 外部排序 | 多路归并数组模拟 | 会算趟数与 I/O | 否 | 中 | 1 |

## 最值得亲手完成的 30 个实验

1. `SeqList`：动态扩容、插入、删除、查找。
2. `StaticLinkedListCursor`：空闲链、已用链、游标插删。
3. `SinglyLinkedList`：带头节点与不带头节点两版。
4. `LinkedListReverse`：迭代逆置与递归逆置。
5. `LinkedListMergeAndDeduplicate`：有序合并和去重。
6. `DoublyCircularList`：双链、循环边界。
7. `ArrayStack`：括号匹配和表达式求值入口。
8. `CircularQueue`：牺牲一个位置的实现。
9. `MatrixCompression`：对称、三对角矩阵映射。
10. `BruteForceMatch`：与 KMP 做比较次数对照。
11. `KmpMatch`：`next`、`nextval`、完整匹配。
12. `TreeTraversalRecursive`：先中后序。
13. `TreeTraversalIterative`：栈与 `lastVisited`。
14. `TreeLevelOrderAndProperties`：层序、深度、节点计数。
15. `BinarySearchTree`：查找、插入、三类删除。
16. `AvlTree`：四类旋转和高度校验。
17. `HuffmanTree`：构造、编码、WPL。
18. `UnionFind`：路径压缩、按大小合并。
19. `GraphRepresentations`：矩阵与邻接表互转。
20. `GraphTraversal`：连通与非连通图的 BFS/DFS。
21. `PrimMst`：记录 `lowCost` 和父节点。
22. `KruskalMst`：边排序与并查集。
23. `DijkstraShortestPath`：距离与前驱数组。
24. `FloydAllPairs`：距离矩阵和路径恢复。
25. `TopoAndCriticalPath`：拓扑序与 `ve/vl`。
26. `BinaryAndBlockSearch`：查找过程与 ASL。
27. `OpenAddressHashTable`：插入、查找、删除标记。
28. `QuickAndHeapSort`：逐趟打印分区与堆。
29. `MergeAndRadixSort`：稳定性与辅助空间实验。
30. `ExternalMergeSimulation`：多路归并、趟数和 I/O 计算，不接真实磁盘。

## 最后的验收，不是“刷了多少题”

从任一程序随机抽一个，你应能完成五件事：不用集合框架写核心结构；在 Debugger 中解释每个指针或下标；在纸上推演一个正常例和一个边界例；改写成 C/考试伪代码；给出时间、空间复杂度和成立条件。

做到这些，统考试题里的代码不再是陌生的 C 符号，而是你已经运行、暂停、改坏并修好过的程序。对在职 Java 工程师来说，这比机械刷大量题更省时间，也更容易形成能带进考场的长期记忆。
