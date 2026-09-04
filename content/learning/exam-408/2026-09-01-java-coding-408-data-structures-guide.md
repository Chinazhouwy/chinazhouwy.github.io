---
title: "Java数据结构和算法汇集"
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
summary: "按线性结构、串、树、图、查找和排序汇集 Java 实现，配套复杂度、边界条件、手工推演与 C 语言对照。"
tags:
  - 计算机学科专业基础
  - 数据结构
  - Java
  - C
  - 算法
---

# Java数据结构和算法汇集

代码使用 Java 17+；未标全限定名的集合类型来自 `java.util`，独立的 `static` 方法需放在类内。数组、字符串参数默认非 `null`；有序、无环等前提在对应算法处说明。

## 一、线性表

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

    public int set(int index, int value) {
        checkElementIndex(index);
        int previous = data[index];
        data[index] = value;
        return previous;
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

    public int set(int index, int value) {
        checkElementIndex(index);
        Node node = nodeBefore(index).next;
        int previous = node.value;
        node.value = value;
        return previous;
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

以下算法接收**不带哨兵的首元节点**，使用独立实验类中的这个 `Node`，不要把上一节封装类的 `dummy` 当作实参。除判环和找入口外，输入须为无环链表；原地合并要求两条链不共享节点。

```java
static final class Node {
    int value;
    Node next;
    Node(int value) { this.value = value; }
}

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

快慢指针还可用于找中点和判环。下面约定偶数长度返回**后一个中点**；`cycleEntry` 先找相遇点，再让一个指针回到头部，同速前进找到入口。它并不修改链表。

```java
static Node middleNode(Node head) {
    Node slow = head;
    Node fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    return slow;
}

static Node cycleEntry(Node head) {
    Node slow = head;
    Node fast = head;
    do {
        if (fast == null || fast.next == null) return null;
        slow = slow.next;
        fast = fast.next.next;
    } while (slow != fast);
    Node fromHead = head;
    while (fromHead != slow) {
        fromHead = fromHead.next;
        slow = slow.next;
    }
    return fromHead;
}

static boolean hasCycle(Node head) {
    return cycleEntry(head) != null;
}
```

三者均为 `O(n)` 时间、`O(1)` 辅助空间。测试空链、两节点链、自环和入口不在头部的环。不要把快慢指针首次相遇的位置误当成入口。

| 算法 | 不变量 | 时间 | 辅助空间 |
| --- | --- | --- | --- |
| 逆置 | `previous` 已逆置，`current` 及以后未处理 | `O(n)` | `O(1)` |
| 有序合并 | `dummy.next..tail` 始终有序 | `O(m+n)` | `O(1)` |
| 有序去重 | `current` 之前已无重复 | `O(n)` | `O(1)` |
| 删除目标值 | `previous.next` 是待检查节点 | `O(n)` | `O(1)` |
| 倒数第 k 个 | 快指针始终领先慢指针 k 步 | `O(n)` | `O(1)` |

> Debug 观察：逆置看 `previous/current/next`；删除看 `previous/target`；合并看 `tail/first/second`。每改一次引用，都画出仍然可达的链。

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

    void add(int index, int value) {
        if (index < 0 || index > size) throw new IndexOutOfBoundsException(index);
        insertBefore(index == size ? tail : nodeAt(index), value);
    }

    int get(int index) { return nodeAt(index).value; }

    int set(int index, int value) {
        Node node = nodeAt(index);
        int previous = node.value;
        node.value = value;
        return previous;
    }

    int remove(int index) { return remove(nodeAt(index)); }

    private Node nodeAt(int index) {
        if (index < 0 || index >= size) throw new IndexOutOfBoundsException(index);
        Node node = head.next;
        for (int i = 0; i < index; i++) node = node.next;
        return node;
    }

    private void insertBefore(Node next, int value) {
        Node node = new Node(value);
        Node previous = next.previous;
        node.previous = previous;
        node.next = next;
        previous.next = node;
        next.previous = node;
        size++;
    }

    private int remove(Node node) {
        if (node == head || node == tail) throw new IllegalArgumentException("sentinel");
        node.previous.next = node.next;
        node.next.previous = node.previous;
        node.previous = null;
        node.next = null;
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

### 5. 循环链表

循环单链表的尾节点 `next` 指回头节点或首元节点；循环双链表常让首尾哨兵互相连接。它仍是线性表的链式存储，只是终止条件改变：

```text
普通链表：current == null 时结束
循环链表：current 再次回到起点时结束
```

若只保存尾指针 `tail`，首元节点是 `tail.next`，头插和尾插都可在 `O(1)` 内完成。典型应用是轮转调度和约瑟夫问题。

```java
static final class CircularList {
    private Node tail;
    private int size;

    void addFirst(int value) {
        Node node = new Node(value);
        if (tail == null) {
            node.next = node;
            tail = node;
        } else {
            node.next = tail.next;
            tail.next = node;
        }
        size++;
    }

    void addLast(int value) {
        addFirst(value);
        tail = tail.next;
    }

    int removeFirst() {
        if (tail == null) throw new IllegalStateException("empty");
        Node first = tail.next;
        if (first == tail) tail = null;
        else tail.next = first.next;
        first.next = null;
        size--;
        return first.value;
    }

    int[] toArray() {
        int[] values = new int[size];
        Node current = tail == null ? null : tail.next;
        for (int i = 0; i < size; i++, current = current.next) {
            values[i] = current.value;
        }
        return values;
    }
}

static int[] josephusOrder(int n, int step) {
    if (n < 0 || step <= 0) throw new IllegalArgumentException("n/step");
    CircularList circle = new CircularList();
    for (int i = 0; i < n; i++) circle.addLast(i + 1);
    int[] order = new int[n];
    for (int i = 0; i < n; i++) {
        int moves = (step - 1) % circle.size;
        while (moves-- > 0) circle.tail = circle.tail.next;
        order[i] = circle.removeFirst();
    }
    return order;
}
```

`josephusOrder(5, 2)` 得到 `[2,4,1,5,3]`，编号从 1 开始，当前首元节点报 1。模拟需 `O(n * min(n, step))` 时间，链节点与输出为 `O(n)` 空间；不要把这种逐人报数模拟误写成 `O(n)`。

> Debug 观察：从任意节点出发最多走 `size` 步应回到起点。把普通链表的 `current != null` 搬过来会形成死循环。

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

下面给出固定容量教学版。`head` 串已用槽，`freeHead` 串空闲槽；一个槽只能属于其中一条链。

```java
static final class StaticLinkedList {
    private final int[] values;
    private final int[] next;
    private int head = -1;
    private int freeHead;
    private int size;

    StaticLinkedList(int capacity) {
        if (capacity < 0) throw new IllegalArgumentException("capacity");
        values = new int[capacity];
        next = new int[capacity];
        for (int i = 0; i < capacity; i++) next[i] = i + 1;
        if (capacity > 0) next[capacity - 1] = -1;
        freeHead = capacity == 0 ? -1 : 0;
    }

    void add(int index, int value) {
        if (index < 0 || index > size) throw new IndexOutOfBoundsException(index);
        if (freeHead == -1) throw new IllegalStateException("full");
        int previous = index == 0 ? -1 : slotAt(index - 1);
        int slot = freeHead;
        freeHead = next[slot];
        values[slot] = value;
        next[slot] = previous == -1 ? head : next[previous];
        if (previous == -1) head = slot;
        else next[previous] = slot;
        size++;
    }

    int get(int index) { return values[slotAt(index)]; }

    int set(int index, int value) {
        int slot = slotAt(index);
        int previous = values[slot];
        values[slot] = value;
        return previous;
    }

    int remove(int index) {
        if (index < 0 || index >= size) throw new IndexOutOfBoundsException(index);
        int previous = index == 0 ? -1 : slotAt(index - 1);
        int slot = previous == -1 ? head : next[previous];
        if (previous == -1) head = next[slot];
        else next[previous] = next[slot];
        int removed = values[slot];
        next[slot] = freeHead;
        freeHead = slot;
        size--;
        return removed;
    }

    private int slotAt(int index) {
        if (index < 0 || index >= size) throw new IndexOutOfBoundsException(index);
        int slot = head;
        for (int i = 0; i < index; i++) slot = next[slot];
        return slot;
    }
}
```

按逻辑下标操作为 `O(n)`，取得槽位后改链为 `O(1)`。重点测试“装满、删除、重新插入”，确认删除的槽确实能被复用。

### 7. 线性表对比

| 结构 | 随机访问 | 按值查找 | 已知位置插删 | 空间特点 |
| --- | --- | --- | --- | --- |
| 顺序表 | `O(1)` | `O(n)` | 搬移导致 `O(n)` | 连续、可能预留容量 |
| 单链表 | `O(n)` | `O(n)` | 已知前驱为 `O(1)` | 每节点多一个指针 |
| 双链表 | `O(n)` | `O(n)` | 已知节点为 `O(1)` | 每节点多两个指针 |
| 静态链表 | `O(n)` | `O(n)` | 已知前驱下标为 `O(1)` | 固定数组、游标连接 |

## 二、栈、队列和数组

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

#### 1.3 括号匹配、中缀转后缀与求值

括号匹配忽略非括号字符。表达式示例则明确限定为**非负十进制整数、二元 `+ - * /` 和小括号**，可以含空白，但不支持一元负号、小数或隐式乘法。减法的结果可以为负；除法遵循 Java 整数除法。超出 `int` 范围时报错，不静默回绕。

```java
static boolean bracketsMatch(String text) {
    java.util.Deque<Character> stack = new java.util.ArrayDeque<>();
    for (char ch : text.toCharArray()) {
        if (ch == '(' || ch == '[' || ch == '{') stack.push(ch);
        else if (ch == ')' || ch == ']' || ch == '}') {
            if (stack.isEmpty()) return false;
            char expected = ch == ')' ? '(' : ch == ']' ? '[' : '{';
            if (stack.pop() != expected) return false;
        }
    }
    return stack.isEmpty();
}

static int precedence(char operator) {
    return switch (operator) {
        case '+', '-' -> 1;
        case '*', '/' -> 2;
        default -> 0;
    };
}

static java.util.List<String> infixToPostfix(String expression) {
    java.util.List<String> output = new java.util.ArrayList<>();
    java.util.Deque<Character> operators = new java.util.ArrayDeque<>();
    boolean needOperand = true;
    for (int i = 0; i < expression.length();) {
        char ch = expression.charAt(i);
        if (Character.isWhitespace(ch)) { i++; continue; }
        if (ch >= '0' && ch <= '9') {
            if (!needOperand) throw new IllegalArgumentException("missing operator");
            int start = i++;
            while (i < expression.length() && expression.charAt(i) >= '0'
                    && expression.charAt(i) <= '9') i++;
            output.add(expression.substring(start, i));
            needOperand = false;
            continue;
        }
        if (ch == '(') {
            if (!needOperand) throw new IllegalArgumentException("missing operator");
            operators.push(ch);
        } else if (ch == ')') {
            if (needOperand) throw new IllegalArgumentException("missing operand");
            while (!operators.isEmpty() && operators.peek() != '(') {
                output.add(String.valueOf(operators.pop()));
            }
            if (operators.isEmpty()) throw new IllegalArgumentException("unmatched )");
            operators.pop();
        } else if (precedence(ch) != 0) {
            if (needOperand) throw new IllegalArgumentException("binary operator expected");
            while (!operators.isEmpty() && precedence(operators.peek()) >= precedence(ch)) {
                output.add(String.valueOf(operators.pop()));
            }
            operators.push(ch);
            needOperand = true;
        } else {
            throw new IllegalArgumentException("unsupported character");
        }
        i++;
    }
    if (needOperand) throw new IllegalArgumentException("incomplete expression");
    while (!operators.isEmpty()) {
        char operator = operators.pop();
        if (operator == '(') throw new IllegalArgumentException("unmatched (");
        output.add(String.valueOf(operator));
    }
    return output;
}

static int evaluatePostfix(java.util.List<String> tokens) {
    java.util.Deque<Integer> values = new java.util.ArrayDeque<>();
    for (String token : tokens) {
        if (token.length() == 1 && precedence(token.charAt(0)) != 0) {
            if (values.size() < 2) throw new IllegalArgumentException("missing operand");
            int right = values.pop();
            int left = values.pop();
            int result = switch (token.charAt(0)) {
                case '+' -> Math.addExact(left, right);
                case '-' -> Math.subtractExact(left, right);
                case '*' -> Math.multiplyExact(left, right);
                case '/' -> Math.toIntExact((long) left / right);
                default -> throw new IllegalArgumentException("operator");
            };
            values.push(result);
        } else {
            values.push(Integer.parseInt(token));
        }
    }
    if (values.size() != 1) throw new IllegalArgumentException("invalid postfix");
    return values.pop();
}
```

`12 + 3 * (4 - 2)` 转为 `12 3 4 2 - * +`，结果为 `18`。计算减法和除法时，先弹出的是右操作数。三个算法都只让每个字符或 token 有限次入栈出栈，时间、辅助空间均为 `O(n)`。

> Debug 观察：`top` 是元素下标还是下一可写位置。两套定义都成立，但判空、判满和取栈顶公式必须统一。

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

矩阵范围内、但在三对角带宽之外的位置视为常量 0，不进入压缩数组；真正的行列下标越界则是错误。使用公式前要确认题目是否采用 1 下标，否则会整体偏移。

```java
static void checkCell(int n, int row, int column) {
    if (n < 0 || row < 0 || row >= n || column < 0 || column >= n) {
        throw new IndexOutOfBoundsException("matrix coordinate");
    }
}

static int symmetricIndex(int n, int row, int column) {
    checkCell(n, row, column);
    int larger = Math.max(row, column);
    int smaller = Math.min(row, column);
    return Math.toIntExact((long) larger * (larger + 1L) / 2 + smaller);
}

static int lowerTriangleIndex(int n, int row, int column) {
    checkCell(n, row, column);
    long index = row >= column ? (long) row * (row + 1L) / 2 + column
            : (long) n * (n + 1L) / 2;
    return Math.toIntExact(index);
}

static int upperTriangleIndex(int n, int row, int column) {
    checkCell(n, row, column);
    long index = row <= column ? (long) row * (2L * n - row + 1) / 2 + column - row
            : (long) n * (n + 1L) / 2;
    return Math.toIntExact(index);
}

static int tridiagonalIndex(int n, int row, int column) {
    checkCell(n, row, column);
    if (Math.abs(row - column) > 1) return -1;
    return Math.toIntExact(2L * row + column);
}
```

每次映射都是 `O(1)`。三角矩阵把公共常量存于最后一格；三对角返回 `-1` 表示结构性零，调用方不能把 `-1` 当数组下标。下标中间计算使用 `long`，超过 Java 数组下标范围会显式报错。

#### 3.3 稀疏矩阵

稀疏矩阵不能只压成固定带状数组，常见存储有：

- 三元组顺序表：每个非零元素保存 `(row, column, value)`。
- 行逻辑链接：额外记录每行首个非零元位置。
- 十字链表：每个非零元同时进入所在行链和列链。

三元组按坐标查找通常为 `O(t)`，其中 `t` 是非零元数；十字链表适合按行、列插删，但节点指针更多。

三元组快速转置先统计每列数量，再把每列映射到输出中的连续区间。输入须按 `(row,column)` 排序、坐标唯一且只保存非零值；输出同样按行列有序。

```java
record Triple(int row, int column, int value) {}

static Triple[] fastTranspose(int rows, int columns, Triple[] entries) {
    if (rows < 0 || columns < 0) throw new IllegalArgumentException("shape");
    int[] counts = new int[columns];
    Triple previousEntry = null;
    for (Triple entry : entries) {
        if (entry.row() < 0 || entry.row() >= rows || entry.column() < 0
                || entry.column() >= columns || entry.value() == 0) {
            throw new IllegalArgumentException("invalid triple");
        }
        if (previousEntry != null && (entry.row() < previousEntry.row()
                || entry.row() == previousEntry.row()
                && entry.column() <= previousEntry.column())) {
            throw new IllegalArgumentException("triples must be ordered and unique");
        }
        counts[entry.column()]++;
        previousEntry = entry;
    }
    int[] nextPosition = new int[columns];
    for (int col = 1; col < columns; col++) {
        nextPosition[col] = nextPosition[col - 1] + counts[col - 1];
    }
    Triple[] output = new Triple[entries.length];
    for (Triple entry : entries) {
        output[nextPosition[entry.column()]++] =
                new Triple(entry.column(), entry.row(), entry.value());
    }
    return output;
}
```

时间 `O(columns+t)`，计数和位置数组为 `O(columns)`，输出为 `O(t)`。空矩阵、某列没有非零元、连续多项属于同一列，都应单独测试。

| 内容 | 手算重点 |
| --- | --- |
| 行/列优先地址 | 下界、列数/行数、元素字节数 |
| 对称/三角/三对角压缩 | 分段公式和 0/1 下标 |
| 稀疏矩阵 | 三元组转置、结构辨认 |

## 三、串与模式匹配

串是零个或多个字符组成的有限序列。模式匹配要在主串 `text` 中寻找模式串 `pattern` 的首次出现位置。下列实现按 Java UTF-16 字符单元匹配。

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

```java
static int[] buildNextVal(String pattern) {
    if (pattern.isEmpty()) return new int[0];
    int[] fallback = new int[pattern.length()];
    fallback[0] = -1;
    int j = 0;
    int candidate = -1;
    while (j < pattern.length() - 1) {
        if (candidate == -1 || pattern.charAt(j) == pattern.charAt(candidate)) {
            j++;
            candidate++;
            fallback[j] = pattern.charAt(j) == pattern.charAt(candidate)
                    ? fallback[candidate] : candidate;
        } else {
            candidate = fallback[candidate];
        }
    }
    return fallback;
}

static int kmpNextVal(String text, String pattern) {
    int[] fallback = buildNextVal(pattern);
    int i = 0;
    int j = 0;
    while (i < text.length() && j < pattern.length()) {
        if (j == -1 || text.charAt(i) == pattern.charAt(j)) { i++; j++; }
        else j = fallback[j];
    }
    return j == pattern.length() ? i - j : -1;
}
```

两种 KMP 返回值应与 `String.indexOf` 一致，包括空模式串返回 `0`；用重复字符模式更容易测出回退错误。

> Debug 观察：失配时只看 `i/j/next[j]`。若 `i` 回退，或 `j` 在同一位置反复跳转，说明定义和代码混用了。

> 手算方法：先写模式下标和字符，再逐位求“失配后可复用的最长相等真前后缀”，最后按本文的失配下标定义转换，不要背孤立数组。

## 四、树与二叉树

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

以下转换为每个节点创建副本，不修改原森林。输入必须是没有环和共享孩子的合法森林。

```java
static final class GeneralTreeNode {
    final int value;
    final java.util.List<GeneralTreeNode> children = new java.util.ArrayList<>();
    GeneralTreeNode(int value) { this.value = value; }
}

static TreeNode forestToBinary(java.util.List<GeneralTreeNode> roots) {
    TreeNode first = null;
    TreeNode last = null;
    for (GeneralTreeNode root : roots) {
        TreeNode node = new TreeNode(root.value);
        node.left = forestToBinary(root.children);
        if (first == null) first = node;
        else last.right = node;
        last = node;
    }
    return first;
}

static java.util.List<GeneralTreeNode> binaryToForest(TreeNode first) {
    java.util.List<GeneralTreeNode> roots = new java.util.ArrayList<>();
    for (TreeNode current = first; current != null; current = current.right) {
        GeneralTreeNode root = new GeneralTreeNode(current.value);
        root.children.addAll(binaryToForest(current.left));
        roots.add(root);
    }
    return roots;
}
```

时间和副本空间为 `O(n)`，递归栈为原森林高度 `O(h)`。逆转换时，`right` 必须解释为兄弟而非孩子。

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
static void visit(TreeNode node) {
    System.out.print(node.value + " ");
}

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

static void preorderIterative(TreeNode root) {
    if (root == null) return;
    Deque<TreeNode> stack = new ArrayDeque<>();
    stack.push(root);
    while (!stack.isEmpty()) {
        TreeNode node = stack.pop();
        visit(node);
        if (node.right != null) stack.push(node.right);
        if (node.left != null) stack.push(node.left);
    }
}

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

#### 4.4 求高度与叶节点数

```java
static int treeHeight(TreeNode root) {
    if (root == null) return 0;
    return 1 + Math.max(treeHeight(root.left), treeHeight(root.right));
}

static int leafCount(TreeNode root) {
    if (root == null) return 0;
    if (root.left == null && root.right == null) return 1;
    return leafCount(root.left) + leafCount(root.right);
}
```

空树高度为 `0`，单节点树高度为 `1`，均为 `O(n)` 时间、`O(h)` 调用栈。这两个递归是“后序汇总子问题结果”的最小例子。

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

```java
static ThreadNode firstInorder(ThreadNode node) {
    if (node == null) return null;
    while (!node.leftThread && node.left != null) node = node.left;
    return node;
}

static java.util.List<Integer> threadedInorder(ThreadNode root) {
    java.util.List<Integer> values = new java.util.ArrayList<>();
    ThreadNode current = firstInorder(root);
    while (current != null) {
        values.add(current.value);
        current = current.rightThread ? current.right : firstInorder(current.right);
    }
    return values;
}
```

遍历时间 `O(n)`，除返回列表外只需 `O(1)` 辅助空间；不能再用普通二叉树递归无条件追随线索指针。构造器中的静态 `previous` 仅供单线程实验，不能并发线索化两棵树。

> 手算检查：先写出原树中序序列，再只在线索化前为空的指针上填前驱或后继。孩子指针不能被覆盖。

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

下面是整数集合版 AVL，重复插入不增加节点，删除不存在的值不改变树。删除后的平衡判断依据**孩子的平衡因子**，不能照搬插入时“比较新关键字”的分支。

```java
static final class AvlTree {
    private static final class AvlNode {
        int key;
        int height = 1;
        AvlNode left;
        AvlNode right;
        AvlNode(int key) { this.key = key; }
    }

    private AvlNode root;

    void add(int key) { root = insert(root, key); }
    void remove(int key) { root = delete(root, key); }

    boolean contains(int key) {
        AvlNode current = root;
        while (current != null && current.key != key) {
            current = key < current.key ? current.left : current.right;
        }
        return current != null;
    }

    private static int height(AvlNode node) { return node == null ? 0 : node.height; }
    private static int factor(AvlNode node) { return height(node.left) - height(node.right); }
    private static void refresh(AvlNode node) {
        node.height = 1 + Math.max(height(node.left), height(node.right));
    }

    private static AvlNode rotateRight(AvlNode oldRoot) {
        AvlNode newRoot = oldRoot.left;
        oldRoot.left = newRoot.right;
        newRoot.right = oldRoot;
        refresh(oldRoot);
        refresh(newRoot);
        return newRoot;
    }

    private static AvlNode rotateLeft(AvlNode oldRoot) {
        AvlNode newRoot = oldRoot.right;
        oldRoot.right = newRoot.left;
        newRoot.left = oldRoot;
        refresh(oldRoot);
        refresh(newRoot);
        return newRoot;
    }

    private static AvlNode rebalance(AvlNode node) {
        refresh(node);
        if (factor(node) > 1) {
            if (factor(node.left) < 0) node.left = rotateLeft(node.left);
            return rotateRight(node);
        }
        if (factor(node) < -1) {
            if (factor(node.right) > 0) node.right = rotateRight(node.right);
            return rotateLeft(node);
        }
        return node;
    }

    private static AvlNode insert(AvlNode node, int key) {
        if (node == null) return new AvlNode(key);
        if (key < node.key) node.left = insert(node.left, key);
        else if (key > node.key) node.right = insert(node.right, key);
        else return node;
        return rebalance(node);
    }

    private static AvlNode delete(AvlNode node, int key) {
        if (node == null) return null;
        if (key < node.key) node.left = delete(node.left, key);
        else if (key > node.key) node.right = delete(node.right, key);
        else {
            if (node.left == null) return node.right;
            if (node.right == null) return node.left;
            AvlNode successor = node.right;
            while (successor.left != null) successor = successor.left;
            node.key = successor.key;
            node.right = delete(node.right, successor.key);
        }
        return rebalance(node);
    }
}
```

分别插入 `[3,2,1]`、`[1,2,3]`、`[3,1,2]`、`[1,3,2]`，四种情形都应得到根 `2`。随机增删时不只比查找结果，还要逐节点检查缓存高度和 `|左高-右高| <= 1`。

#### 6.3 红黑树

红黑树是近似平衡 BST，核心约束是：

1. 节点为红或黑。
2. 根为黑。
3. 空叶视为黑。
4. 红节点不能有红孩子。
5. 从任一节点到其后代空叶的路径包含相同数量黑节点。

这些约束保证树高为 `O(log n)`。考试重点是性质、插入删除后的变色与旋转判断，以及与 AVL 的比较，不要求重写完整 `TreeMap`。

为了能够运行观察，下面给出**左倾红黑树 LLRB 的整数集合版**。红链接向左倾是这一变体的附加约定，不是所有红黑树的通用性质；它也不是 JDK `TreeMap` 的源码复刻。算法背景可对照 [Princeton 的左倾红黑树说明与实现](https://algs4.cs.princeton.edu/33balanced/RedBlackBST.java.html)。

```java
static final class RedBlackTree {
    private static final class RedNode {
        int key;
        boolean red = true;
        RedNode left;
        RedNode right;
        RedNode(int key) { this.key = key; }
    }

    private RedNode root;

    boolean contains(int key) {
        RedNode node = root;
        while (node != null && node.key != key) {
            node = key < node.key ? node.left : node.right;
        }
        return node != null;
    }

    void add(int key) {
        root = insert(root, key);
        root.red = false;
    }

    void remove(int key) {
        if (!contains(key)) return;
        if (!isRed(root.left) && !isRed(root.right)) root.red = true;
        root = delete(root, key);
        if (root != null) root.red = false;
    }

    private static boolean isRed(RedNode node) { return node != null && node.red; }

    private static RedNode rotateLeft(RedNode node) {
        RedNode promoted = node.right;
        node.right = promoted.left;
        promoted.left = node;
        promoted.red = node.red;
        node.red = true;
        return promoted;
    }

    private static RedNode rotateRight(RedNode node) {
        RedNode promoted = node.left;
        node.left = promoted.right;
        promoted.right = node;
        promoted.red = node.red;
        node.red = true;
        return promoted;
    }

    private static void flipColors(RedNode node) {
        node.red = !node.red;
        node.left.red = !node.left.red;
        node.right.red = !node.right.red;
    }

    private static RedNode repair(RedNode node) {
        if (isRed(node.right)) node = rotateLeft(node);
        if (isRed(node.left) && isRed(node.left.left)) node = rotateRight(node);
        if (isRed(node.left) && isRed(node.right)) flipColors(node);
        return node;
    }

    private static RedNode insert(RedNode node, int key) {
        if (node == null) return new RedNode(key);
        if (key < node.key) node.left = insert(node.left, key);
        else if (key > node.key) node.right = insert(node.right, key);
        return repair(node);
    }

    private static RedNode moveRedLeft(RedNode node) {
        flipColors(node);
        if (isRed(node.right.left)) {
            node.right = rotateRight(node.right);
            node = rotateLeft(node);
            flipColors(node);
        }
        return node;
    }

    private static RedNode moveRedRight(RedNode node) {
        flipColors(node);
        if (isRed(node.left.left)) {
            node = rotateRight(node);
            flipColors(node);
        }
        return node;
    }

    private static RedNode removeMinimum(RedNode node) {
        if (node.left == null) return null;
        if (!isRed(node.left) && !isRed(node.left.left)) node = moveRedLeft(node);
        node.left = removeMinimum(node.left);
        return repair(node);
    }

    private static RedNode delete(RedNode node, int key) {
        if (key < node.key) {
            if (!isRed(node.left) && !isRed(node.left.left)) node = moveRedLeft(node);
            node.left = delete(node.left, key);
        } else {
            if (isRed(node.left)) node = rotateRight(node);
            if (key == node.key && node.right == null) return null;
            if (!isRed(node.right) && !isRed(node.right.left)) node = moveRedRight(node);
            if (key == node.key) {
                RedNode successor = node.right;
                while (successor.left != null) successor = successor.left;
                node.key = successor.key;
                node.right = removeMinimum(node.right);
            } else {
                node.right = delete(node.right, key);
            }
        }
        return repair(node);
    }
}
```

删除前先确认关键字存在，这是内部删除过程可以沿路径安全访问孩子的前提。查找、增删均为 `O(log n)`，递归辅助空间 `O(log n)`。验收同时检查有序性、黑根、无连续红节点、各路径黑高相同，以及本实现特有的“无右红链接”。

| 结构 | 平衡强度 | 更新特点 |
| --- | --- | --- |
| BST | 不保证 | 简单但会退化 |
| AVL | 严格高度平衡 | 查找稳定，旋转更频繁 |
| 红黑树 | 近似平衡 | 更新折中 |

### 7. Huffman 树与并查集

#### 7.1 Huffman

带权路径长度：

```text
WPL = sum(叶节点权值 * 根到该叶的边数)
```

构造时每轮取权值最小的两棵树合并，新节点权值为两者之和，直到只剩一棵树。含 `n` 个叶节点的 Huffman 树共有 `2n-1` 个节点，没有度为 1 的节点。左边写 0、右边写 1 只是编码约定，不影响 WPL。

输入数组下标作为符号编号，允许零权但不允许负权。空输入返回空树，单符号约定编码为 `0`。构造、编码和 WPL 分开实现，便于分别验证。

```java
static final class HuffmanNode {
    final long weight;
    final int symbol;
    final HuffmanNode left;
    final HuffmanNode right;
    HuffmanNode(long weight, int symbol, HuffmanNode left, HuffmanNode right) {
        this.weight = weight;
        this.symbol = symbol;
        this.left = left;
        this.right = right;
    }
}

static HuffmanNode buildHuffman(long[] weights) {
    java.util.PriorityQueue<HuffmanNode> queue = new java.util.PriorityQueue<>(
            java.util.Comparator.comparingLong((HuffmanNode node) -> node.weight));
    for (int i = 0; i < weights.length; i++) {
        if (weights[i] < 0) throw new IllegalArgumentException("negative weight");
        queue.add(new HuffmanNode(weights[i], i, null, null));
    }
    while (queue.size() > 1) {
        HuffmanNode left = queue.remove();
        HuffmanNode right = queue.remove();
        queue.add(new HuffmanNode(Math.addExact(left.weight, right.weight), -1, left, right));
    }
    return queue.poll();
}

static java.util.Map<Integer, String> huffmanCodes(HuffmanNode root) {
    java.util.Map<Integer, String> codes = new java.util.LinkedHashMap<>();
    collectCodes(root, "", codes);
    return codes;
}

private static void collectCodes(HuffmanNode node, String prefix,
        java.util.Map<Integer, String> codes) {
    if (node == null) return;
    if (node.symbol >= 0) {
        codes.put(node.symbol, prefix.isEmpty() ? "0" : prefix);
        return;
    }
    collectCodes(node.left, prefix + "0", codes);
    collectCodes(node.right, prefix + "1", codes);
}

static long huffmanWpl(HuffmanNode root, int depth) {
    if (root == null) return 0;
    if (root.symbol >= 0) return Math.multiplyExact(root.weight, depth);
    return Math.addExact(huffmanWpl(root.left, depth + 1), huffmanWpl(root.right, depth + 1));
}
```

`[2,3,7,9]` 的 WPL 为 `38`。单符号树的结构 WPL 为 `0`，与为便于输出而指定的一位编码不同，不能混算。构造为 `O(n log n)`，WPL 遍历为 `O(n)`；生成全部码字还需计入总码长和字符串复制成本。合并最小子树的依据可对照 [Princeton Huffman 教学实现](https://algs4.cs.princeton.edu/55compression/Huffman.java.html)。

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

## 五、图

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

后续算法统一使用顶点编号 `[0,n)`。下面的工厂补齐邻接表初始化与加边，以及带权矩阵构造；无向图加边时同时维护两个方向。矩阵遇到平行边取较小权值，邻接表保留输入顺序。

```java
record WeightedEdge(int from, int to, long weight) {}

static void checkVertex(int vertex, int n) {
    if (vertex < 0 || vertex >= n) throw new IndexOutOfBoundsException(vertex);
}

@SuppressWarnings("unchecked")
static java.util.List<Integer>[] newAdjacencyList(int n) {
    if (n < 0) throw new IllegalArgumentException("vertex count");
    java.util.List<Integer>[] graph = (java.util.List<Integer>[]) new java.util.List<?>[n];
    for (int i = 0; i < n; i++) graph[i] = new java.util.ArrayList<>();
    return graph;
}

static void addEdge(java.util.List<Integer>[] graph, int from, int to, boolean directed) {
    checkVertex(from, graph.length);
    checkVertex(to, graph.length);
    graph[from].add(to);
    if (!directed && from != to) graph[to].add(from);
}

static long[][] weightMatrix(int n, java.util.List<WeightedEdge> edges, boolean directed) {
    if (n < 0) throw new IllegalArgumentException("vertex count");
    long[][] matrix = new long[n][n];
    for (int i = 0; i < n; i++) {
        java.util.Arrays.fill(matrix[i], INF);
        matrix[i][i] = 0;
    }
    for (WeightedEdge edge : edges) {
        checkVertex(edge.from(), n);
        checkVertex(edge.to(), n);
        long limit = (INF - 1) / Math.max(1, n);
        if (edge.weight() < -limit || edge.weight() > limit) {
            throw new IllegalArgumentException("finite weight too large");
        }
        matrix[edge.from()][edge.to()] = Math.min(matrix[edge.from()][edge.to()], edge.weight());
        if (!directed) {
            matrix[edge.to()][edge.from()] = Math.min(matrix[edge.to()][edge.from()], edge.weight());
        }
    }
    checkWeightMatrix(matrix);
    return matrix;
}

static void checkWeightMatrix(long[][] matrix) {
    int n = matrix.length;
    long limit = (INF - 1) / Math.max(1, n);
    for (long[] row : matrix) {
        if (row.length != n) throw new IllegalArgumentException("matrix must be square");
        for (long weight : row) {
            if (weight != INF && (weight < -limit || weight > limit)) {
                throw new IllegalArgumentException("finite weight too large");
            }
        }
    }
}
```

`INF` 定义见 Prim 小节，组合使用时只声明一次。有限边权绝对值限制为 `(INF-1)/max(1,n)`，使简单路径长度与“不可达”保持可区分；非法端点和非方阵直接报错。十字链表、邻接多重表在本文仍是存储表示对照，不声称给出了完整增删容器。

### 3. BFS 与 DFS

下面使用邻接表，所以“有没有边”由列表成员关系决定，不受边权是否为 0 影响：

```java
import java.util.ArrayDeque;
import java.util.List;

static void visit(int vertex) {
    System.out.print(vertex + " ");
}

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

无权最短路需要在首次发现邻接点时记录距离，而不是只打印访问顺序：

```java
static int[] unweightedDistances(List<Integer>[] graph, int source) {
    checkVertex(source, graph.length);
    int[] distance = new int[graph.length];
    java.util.Arrays.fill(distance, -1);
    ArrayDeque<Integer> queue = new ArrayDeque<>();
    distance[source] = 0;
    queue.add(source);
    while (!queue.isEmpty()) {
        int vertex = queue.remove();
        for (int next : graph[vertex]) {
            if (distance[next] != -1) continue;
            distance[next] = distance[vertex] + 1;
            queue.add(next);
        }
    }
    return distance;
}
```

不可达顶点保留 `-1`，源点距离为 `0`，时间 `O(V+E)`、辅助空间 `O(V)`。

### 4. 最小生成树

最小生成树适用于连通、无向、带权图。若图不连通，得到的是最小生成森林，不能声称得到一棵生成树。

#### 4.1 Prim

Prim 每轮把一个新顶点并入当前树，适合邻接矩阵和稠密图：

```java
static final long INF = Long.MAX_VALUE / 4;

static long prim(long[][] weight) {
    checkWeightMatrix(weight);
    int n = weight.length;
    if (n == 0) return 0;
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            if (weight[i][j] != weight[j][i]) throw new IllegalArgumentException("undirected graph required");
        }
    }
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
        total = Math.addExact(total, lowCost[vertex]);

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

```java
record MstResult(long weight, java.util.List<WeightedEdge> edges) {}

static MstResult kruskal(int n, java.util.List<WeightedEdge> input) {
    if (n < 0) throw new IllegalArgumentException("vertex count");
    java.util.List<WeightedEdge> edges = new java.util.ArrayList<>(input);
    for (WeightedEdge edge : edges) {
        checkVertex(edge.from(), n);
        checkVertex(edge.to(), n);
    }
    edges.sort(java.util.Comparator.comparingLong(WeightedEdge::weight));
    UnionFind sets = new UnionFind(n);
    java.util.List<WeightedEdge> chosen = new java.util.ArrayList<>();
    long total = 0;
    for (WeightedEdge edge : edges) {
        if (sets.union(edge.from(), edge.to())) {
            chosen.add(edge);
            total = Math.addExact(total, edge.weight());
        }
        if (chosen.size() == n - 1) break;
    }
    if (chosen.size() != Math.max(0, n - 1)) {
        throw new IllegalArgumentException("disconnected graph");
    }
    return new MstResult(total, java.util.List.copyOf(chosen));
}
```

复用“树与二叉树”一节的 `UnionFind`，不原地重排调用方的边表。自环不会入选，重复边和负权边允许；不连通时明确拒绝，而不是把森林当成一棵树返回。空图约定总权值为 `0`。实现思路可对照 [Princeton Kruskal 说明](https://algs4.cs.princeton.edu/43mst/KruskalMST.java.html)，但这里选择的是“必须连通”的接口契约。

边权互不相同时最小生成树一定唯一，但“存在相同边权”不等于“一定不唯一”。唯一性要看是否存在可替换的同权边。

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
    checkWeightMatrix(weight);
    int n = weight.length;
    checkVertex(source, n);
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
    checkWeightMatrix(distance);
    int n = distance.length;
    for (int i = 0; i < n; i++) distance[i][i] = Math.min(distance[i][i], 0);
    for (int k = 0; k < n; k++) {
        for (int i = 0; i < n; i++) {
            if (distance[i][k] == INF) continue;
            for (int j = 0; j < n; j++) {
                if (distance[k][j] == INF) continue;
                long candidate = Math.addExact(distance[i][k], distance[k][j]);
                if (candidate < distance[i][j]) distance[i][j] = candidate;
            }
        }
    }
    for (int i = 0; i < n; i++) {
        if (distance[i][i] < 0) throw new IllegalArgumentException("negative cycle");
    }
}
```

这里先排除 `INF` 再相加，使用边权范围校验和精确加法，不能仅凭一个较小的 `INF` 就宣称任意输入都不会溢出。计算后通过对角线检测负环；一旦抛错，原地工作矩阵不得继续当作有效最短路结果使用。时间 `O(V^3)`，额外空间 `O(1)`，调用方若要保留原图需自行复制。

> Debug 观察：Dijkstra 看 `fixed/distance/vertex`；Floyd 看第 `k` 轮前后矩阵。若零权边消失、负边进入 Dijkstra，或 `INF` 参与加法，模型已经错误。

### 6. 拓扑排序与关键路径

#### 6.1 拓扑排序

拓扑序只存在于 DAG。Kahn 算法反复选择入度为 0 的顶点：

```java
static int[] topologicalOrder(List<Integer>[] graph, int[] originalIndegree) {
    if (originalIndegree.length != graph.length) throw new IllegalArgumentException("indegree length");
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

调用方传入的入度数组必须与图一致；函数复制它，不修改调用方数据。邻接表实现为 `O(V+E)`。若每一步都只有一个入度为 0 的候选顶点，则拓扑序唯一；某一步候选不止一个，至少存在不同选择顺序。

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

下面返回总工期、`ve/vl` 和关键活动。支持多个源/汇点：所有源事件可在时刻 0 启动，所有汇事件共享全局完工期限，等价于添加零时长的超级源点与汇点。这一约定比“随便取最后一个顶点的 `ve`”更明确。DAG 最长路径与工期的关系可参考 [Princeton CPM 说明](https://algs4.cs.princeton.edu/44sp/CPM.java.html)。

```java
record CriticalPathResult(long duration, long[] earliest, long[] latest,
        java.util.List<WeightedEdge> activities) {}

static CriticalPathResult criticalPath(int n, java.util.List<WeightedEdge> activities) {
    if (n < 0) throw new IllegalArgumentException("vertex count");
    java.util.List<java.util.List<WeightedEdge>> graph = new java.util.ArrayList<>();
    for (int i = 0; i < n; i++) graph.add(new java.util.ArrayList<>());
    int[] indegree = new int[n];
    for (WeightedEdge activity : activities) {
        checkVertex(activity.from(), n);
        checkVertex(activity.to(), n);
        if (activity.weight() < 0) throw new IllegalArgumentException("negative duration");
        graph.get(activity.from()).add(activity);
        indegree[activity.to()]++;
    }
    ArrayDeque<Integer> ready = new ArrayDeque<>();
    for (int i = 0; i < n; i++) if (indegree[i] == 0) ready.add(i);
    int[] order = new int[n];
    int count = 0;
    long[] earliest = new long[n];
    while (!ready.isEmpty()) {
        int vertex = ready.remove();
        order[count++] = vertex;
        for (WeightedEdge activity : graph.get(vertex)) {
            int next = activity.to();
            earliest[next] = Math.max(earliest[next],
                    Math.addExact(earliest[vertex], activity.weight()));
            if (--indegree[next] == 0) ready.add(next);
        }
    }
    if (count != n) throw new IllegalArgumentException("cycle");
    long duration = 0;
    for (long time : earliest) duration = Math.max(duration, time);
    long[] latest = new long[n];
    java.util.Arrays.fill(latest, duration);
    for (int i = n - 1; i >= 0; i--) {
        int vertex = order[i];
        for (WeightedEdge activity : graph.get(vertex)) {
            latest[vertex] = Math.min(latest[vertex],
                    Math.subtractExact(latest[activity.to()], activity.weight()));
        }
    }
    java.util.List<WeightedEdge> critical = new java.util.ArrayList<>();
    for (WeightedEdge activity : activities) {
        if (earliest[activity.from()] == latest[activity.to()] - activity.weight()) {
            critical.add(activity);
        }
    }
    return new CriticalPathResult(duration, earliest, latest, java.util.List.copyOf(critical));
}
```

例如活动 `0->1(3), 0->2(2), 1->3(2), 2->3(4)`，总工期为 `6`，关键活动为 `0->2` 和 `2->3`。空图工期为 `0`；负时长、有向环或 `long` 溢出显式报错。时间、存储图与结果所需空间均为 `O(V+E)`。

关键路径可能不唯一。缩短某一条关键活动不一定缩短总工期，因为可能还存在另一条同长关键路径；只有缩短所有当前控制工期的路径才可能生效。

> 手算验收：写出拓扑序、`ve`、逆拓扑序、`vl`、每条边的 `ee/el`，最后再圈关键活动，不要直接目测最长路径。

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

## 六、查找

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

```java
static int sequentialSearch(int[] values, int target) {
    for (int i = 0; i < values.length; i++) {
        if (values[i] == target) return i;
    }
    return -1;
}

static int sentinelSearch(int[] values, int target) {
    if (values.length == 0) return -1;
    int last = values.length - 1;
    int saved = values[last];
    int index = 0;
    try {
        values[last] = target;
        while (values[index] != target) index++;
    } finally {
        values[last] = saved;
    }
    return index < last || saved == target ? index : -1;
}
```

两者返回首次出现位置或 `-1`，辅助空间 `O(1)`。哨兵版调用期间暂时修改数组，不能与其他线程共享读写；函数返回后原数组必须完全恢复。

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

下面把“建索引”与“查索引”分开。`buildBlocks` 校验前一块最大值不大于后一块最小值；块内任意顺序均可。索引生成后若修改数组，须重新建立索引。

```java
record SearchBlock(int maximum, int start, int endExclusive) {}

static SearchBlock[] buildBlocks(int[] values, int blockSize) {
    if (blockSize <= 0) throw new IllegalArgumentException("block size");
    java.util.List<SearchBlock> blocks = new java.util.ArrayList<>();
    long previousMaximum = Long.MIN_VALUE;
    for (int start = 0; start < values.length;) {
        int end = (int) Math.min(values.length, (long) start + blockSize);
        int minimum = values[start];
        int maximum = values[start];
        for (int i = start + 1; i < end; i++) {
            minimum = Math.min(minimum, values[i]);
            maximum = Math.max(maximum, values[i]);
        }
        if (minimum < previousMaximum) throw new IllegalArgumentException("unordered blocks");
        blocks.add(new SearchBlock(maximum, start, end));
        previousMaximum = maximum;
        start = end;
    }
    return blocks.toArray(SearchBlock[]::new);
}

static int blockSearch(int[] values, SearchBlock[] blocks, int target) {
    int low = 0;
    int high = blocks.length;
    while (low < high) {
        int middle = low + (high - low) / 2;
        if (blocks[middle].maximum() < target) low = middle + 1;
        else high = middle;
    }
    if (low == blocks.length) return -1;
    SearchBlock block = blocks[low];
    for (int i = block.start(); i < block.endExclusive(); i++) {
        if (values[i] == target) return i;
    }
    return -1;
}
```

建索引一次 `O(n)`，随后单次查询 `O(log b+s)`，索引空间 `O(b)`；不能把每次重新建索引的版本也标为次线性查找。

> Debug 观察：折半看 `low/middle/high`；分块查找看索引命中的块边界。最常见错误是把块内也误认为必须有序。

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
- 含 `k` 个关键字的内部节点有 `k+1` 个孩子，叶节点没有孩子。

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

下面固定为 **4 阶 B 树，即最小度数 `t=2` 的 2-3-4 树**。整数关键字不重复，支持查找、插入和删除。采用自顶向下预分裂/预借位，因此中间形状可能与上面的“先溢出再分裂”手算不同，但阶数约束相同。

```java
static final class BTreeSet {
    private static final class Page {
        int count;
        boolean leaf = true;
        final int[] keys = new int[3];
        final Page[] children = new Page[4];
    }

    private Page root = new Page();

    boolean contains(int key) {
        Page page = root;
        while (true) {
            int index = position(page, key);
            if (index < page.count && page.keys[index] == key) return true;
            if (page.leaf) return false;
            page = page.children[index];
        }
    }

    void add(int key) {
        if (contains(key)) return;
        if (root.count == 3) {
            Page parent = new Page();
            parent.leaf = false;
            parent.children[0] = root;
            splitChild(parent, 0);
            root = parent;
        }
        insertNonFull(root, key);
    }

    void remove(int key) {
        if (!contains(key)) return;
        delete(root, key);
        if (root.count == 0 && !root.leaf) root = root.children[0];
    }

    private static int position(Page page, int key) {
        int index = 0;
        while (index < page.count && page.keys[index] < key) index++;
        return index;
    }

    private static void splitChild(Page parent, int index) {
        Page left = parent.children[index];
        Page right = new Page();
        right.leaf = left.leaf;
        right.keys[0] = left.keys[2];
        right.count = 1;
        if (!left.leaf) {
            right.children[0] = left.children[2];
            right.children[1] = left.children[3];
            left.children[2] = left.children[3] = null;
        }
        for (int i = parent.count; i > index; i--) parent.children[i + 1] = parent.children[i];
        for (int i = parent.count; i > index; i--) parent.keys[i] = parent.keys[i - 1];
        parent.keys[index] = left.keys[1];
        parent.children[index + 1] = right;
        parent.count++;
        left.count = 1;
    }

    private static void insertNonFull(Page page, int key) {
        int index = position(page, key);
        if (page.leaf) {
            for (int i = page.count; i > index; i--) page.keys[i] = page.keys[i - 1];
            page.keys[index] = key;
            page.count++;
        } else {
            if (page.children[index].count == 3) {
                splitChild(page, index);
                if (key > page.keys[index]) index++;
            }
            insertNonFull(page.children[index], key);
        }
    }

    private static void delete(Page page, int key) {
        int index = position(page, key);
        if (index < page.count && page.keys[index] == key) {
            if (page.leaf) {
                for (int i = index; i < page.count - 1; i++) page.keys[i] = page.keys[i + 1];
                page.count--;
            } else if (page.children[index].count >= 2) {
                Page predecessor = page.children[index];
                while (!predecessor.leaf) predecessor = predecessor.children[predecessor.count];
                page.keys[index] = predecessor.keys[predecessor.count - 1];
                delete(page.children[index], page.keys[index]);
            } else if (page.children[index + 1].count >= 2) {
                Page successor = page.children[index + 1];
                while (!successor.leaf) successor = successor.children[0];
                page.keys[index] = successor.keys[0];
                delete(page.children[index + 1], page.keys[index]);
            } else {
                mergeChildren(page, index);
                delete(page.children[index], key);
            }
            return;
        }
        if (page.leaf) return;
        if (page.children[index].count == 1) {
            if (index > 0 && page.children[index - 1].count >= 2) borrowLeft(page, index);
            else if (index < page.count && page.children[index + 1].count >= 2) borrowRight(page, index);
            else {
                if (index == page.count) index--;
                mergeChildren(page, index);
            }
        }
        delete(page.children[index], key);
    }

    private static void borrowLeft(Page parent, int index) {
        Page child = parent.children[index];
        Page sibling = parent.children[index - 1];
        for (int i = child.count; i > 0; i--) child.keys[i] = child.keys[i - 1];
        if (!child.leaf) {
            for (int i = child.count + 1; i > 0; i--) child.children[i] = child.children[i - 1];
            child.children[0] = sibling.children[sibling.count];
            sibling.children[sibling.count] = null;
        }
        child.keys[0] = parent.keys[index - 1];
        parent.keys[index - 1] = sibling.keys[sibling.count - 1];
        sibling.count--;
        child.count++;
    }

    private static void borrowRight(Page parent, int index) {
        Page child = parent.children[index];
        Page sibling = parent.children[index + 1];
        child.keys[child.count] = parent.keys[index];
        if (!child.leaf) {
            child.children[child.count + 1] = sibling.children[0];
            for (int i = 0; i < sibling.count; i++) sibling.children[i] = sibling.children[i + 1];
            sibling.children[sibling.count] = null;
        }
        parent.keys[index] = sibling.keys[0];
        for (int i = 0; i < sibling.count - 1; i++) sibling.keys[i] = sibling.keys[i + 1];
        sibling.count--;
        child.count++;
    }

    private static void mergeChildren(Page parent, int index) {
        Page left = parent.children[index];
        Page right = parent.children[index + 1];
        int offset = left.count + 1;
        left.keys[left.count] = parent.keys[index];
        for (int i = 0; i < right.count; i++) left.keys[offset + i] = right.keys[i];
        if (!left.leaf) {
            for (int i = 0; i <= right.count; i++) left.children[offset + i] = right.children[i];
        }
        left.count += right.count + 1;
        for (int i = index; i < parent.count - 1; i++) parent.keys[i] = parent.keys[i + 1];
        for (int i = index + 1; i < parent.count; i++) parent.children[i] = parent.children[i + 1];
        parent.children[parent.count] = null;
        parent.count--;
    }
}
```

固定阶数时查找与增删都是 `O(log n)`，递归辅助空间 `O(log n)`，节点总空间 `O(n)`。不要将数组容量直接改成另一数字后就宣称支持任意阶数：分裂中点、最少关键字和借位条件也必须一起推导。

#### 4.3 B+ 树

| 对比 | B 树 | B+ 树 |
| --- | --- | --- |
| 数据记录 | 内部和叶节点都可保存 | 通常只在叶节点保存 |
| 内部关键字 | 同时承担索引和记录 | 只承担索引 |
| 叶节点 | 不一定相连 | 通常按关键字链接 |
| 精确查找 | 可能在内部结束 | 通常走到叶节点 |
| 范围查找 | 需中序式遍历 | 定位首叶后沿链扫描 |

工程延伸：数据库索引常使用 B+ 树，是因为高扇出降低树高，叶链适合范围扫描。这个类比只帮助理解，不替代阶数、最少关键字和分裂合并手算。

下面给出内存中的整数集合版 B+ 树，内部节点只保存分隔键，实际关键字只在叶节点中。明确约定：内部节点最多 4 个孩子，非根至少 2 个；叶最多 3 个关键字，非根至少 2 个。分隔键等于**右孩子子树的最小关键字**，相等时必须向右走。代码覆盖分裂、借位、合并、根收缩和叶链范围扫描，不实现磁盘页或并发事务。

```java
static final class BPlusTreeSet {
    private static final class Page {
        final boolean leaf;
        final java.util.List<Integer> keys = new java.util.ArrayList<>();
        final java.util.List<Page> children = new java.util.ArrayList<>();
        Page next;
        int minimum;
        Page(boolean leaf) { this.leaf = leaf; }
    }

    private Page root = new Page(true);

    boolean contains(int key) {
        Page leaf = findLeaf(key);
        return java.util.Collections.binarySearch(leaf.keys, key) >= 0;
    }

    void add(int key) {
        if (contains(key)) return;
        Page right = insert(root, key);
        if (right != null) {
            Page parent = new Page(false);
            parent.children.add(root);
            parent.children.add(right);
            refresh(parent);
            root = parent;
        }
    }

    void remove(int key) {
        if (!contains(key)) return;
        delete(root, key);
        if (!root.leaf && root.children.size() == 1) root = root.children.get(0);
    }

    java.util.List<Integer> range(int fromInclusive, int toInclusive) {
        java.util.List<Integer> output = new java.util.ArrayList<>();
        if (fromInclusive > toInclusive) return output;
        Page leaf = findLeaf(fromInclusive);
        while (leaf != null) {
            for (int key : leaf.keys) {
                if (key > toInclusive) return output;
                if (key >= fromInclusive) output.add(key);
            }
            leaf = leaf.next;
        }
        return output;
    }

    private Page findLeaf(int key) {
        Page page = root;
        while (!page.leaf) page = page.children.get(childIndex(page, key));
        return page;
    }

    private static int childIndex(Page page, int key) {
        int index = 0;
        while (index < page.keys.size() && key >= page.keys.get(index)) index++;
        return index;
    }

    private static void refresh(Page page) {
        if (page.leaf) {
            page.minimum = page.keys.isEmpty() ? 0 : page.keys.get(0);
        } else {
            page.keys.clear();
            page.minimum = page.children.get(0).minimum;
            for (int i = 1; i < page.children.size(); i++) page.keys.add(page.children.get(i).minimum);
        }
    }

    private static Page insert(Page page, int key) {
        if (page.leaf) {
            int index = -java.util.Collections.binarySearch(page.keys, key) - 1;
            page.keys.add(index, key);
        } else {
            int index = childIndex(page, key);
            Page right = insert(page.children.get(index), key);
            if (right != null) page.children.add(index + 1, right);
        }
        refresh(page);
        if (page.keys.size() <= 3) return null;
        Page right = new Page(page.leaf);
        if (page.leaf) {
            right.keys.addAll(page.keys.subList(2, page.keys.size()));
            page.keys.subList(2, page.keys.size()).clear();
            right.next = page.next;
            page.next = right;
        } else {
            right.children.addAll(page.children.subList(3, page.children.size()));
            page.children.subList(3, page.children.size()).clear();
        }
        refresh(page);
        refresh(right);
        return right;
    }

    private static int occupancy(Page page) {
        return page.leaf ? page.keys.size() : page.children.size();
    }

    private static void delete(Page page, int key) {
        if (page.leaf) {
            page.keys.remove(java.util.Collections.binarySearch(page.keys, key));
            refresh(page);
            return;
        }
        int index = childIndex(page, key);
        Page child = page.children.get(index);
        delete(child, key);
        if (occupancy(child) < 2) {
            Page left = index == 0 ? null : page.children.get(index - 1);
            Page right = index + 1 == page.children.size() ? null : page.children.get(index + 1);
            if (left != null && occupancy(left) > 2) {
                if (child.leaf) child.keys.add(0, left.keys.remove(left.keys.size() - 1));
                else child.children.add(0, left.children.remove(left.children.size() - 1));
                refresh(left);
                refresh(child);
            } else if (right != null && occupancy(right) > 2) {
                if (child.leaf) child.keys.add(right.keys.remove(0));
                else child.children.add(right.children.remove(0));
                refresh(right);
                refresh(child);
            } else if (left != null) {
                merge(left, child);
                page.children.remove(index);
            } else {
                merge(child, right);
                page.children.remove(index + 1);
            }
        }
        refresh(page);
    }

    private static void merge(Page left, Page right) {
        if (left.leaf) {
            left.keys.addAll(right.keys);
            left.next = right.next;
        } else {
            left.children.addAll(right.children);
        }
        refresh(left);
    }
}
```

固定扇出下，查找/增删为 `O(log n)`；范围输出 `r` 个元素为 `O(log n+r)`，输出空间 `O(r)`。测试不能只看单点查找：删除后还要检查叶链是否漏页、分隔键是否更新、所有叶深度是否相同。

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

下面补齐拉链法，仍采用整数集合语义。负关键字用 `floorMod`，删除链首和链中节点走同一条前驱逻辑。

```java
static final class ChainedHashSet {
    private static final class Entry {
        final int key;
        Entry next;
        Entry(int key, Entry next) { this.key = key; this.next = next; }
    }

    private final Entry[] buckets;

    ChainedHashSet(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("capacity");
        buckets = new Entry[capacity];
    }

    boolean contains(int key) {
        for (Entry entry = buckets[Math.floorMod(key, buckets.length)]; entry != null; entry = entry.next) {
            if (entry.key == key) return true;
        }
        return false;
    }

    boolean add(int key) {
        if (contains(key)) return false;
        int slot = Math.floorMod(key, buckets.length);
        buckets[slot] = new Entry(key, buckets[slot]);
        return true;
    }

    boolean remove(int key) {
        int slot = Math.floorMod(key, buckets.length);
        Entry previousEntry = null;
        Entry current = buckets[slot];
        while (current != null && current.key != key) {
            previousEntry = current;
            current = current.next;
        }
        if (current == null) return false;
        if (previousEntry == null) buckets[slot] = current.next;
        else previousEntry.next = current.next;
        return true;
    }
}
```

均匀散列时预期操作时间 `O(1+alpha)`，最坏 `O(n)`；本版固定桶数，不声称在无限增长后仍保持常数查找。平方探测与双散列在这里是策略对照，下面只给探测位置公式，不能直接替换线性探测并沿用相同的“必遍历所有槽”假设：

```java
static int quadraticProbe(int key, int step, int capacity) {
    if (capacity <= 0 || step < 0) throw new IllegalArgumentException("probe parameters");
    return (int) ((Math.floorMod(key, capacity) + (long) step * step) % capacity);
}

static int doubleHashProbe(int key, int step, int capacity, int stride) {
    if (capacity <= 1 || step < 0 || stride <= 0 || stride >= capacity) {
        throw new IllegalArgumentException("probe parameters");
    }
    int a = capacity;
    int b = stride;
    while (b != 0) { int remainder = a % b; a = b; b = remainder; }
    if (a != 1) throw new IllegalArgumentException("stride must be coprime with capacity");
    return (int) ((Math.floorMod(key, capacity) + (long) step * stride) % capacity);
}
```

双散列中步长必须与表长互素；生产实现会为一个关键字计算并校验一次步长，而不是每次探测都重复做欧几里得算法。

> Debug 观察：`start/step/index/state/firstDeleted`。探测最多进行表长次，必须有上界。

### 6. 字符串模式匹配在查找体系中的位置

BF 和 KMP 用于在字符串中查找模式串，具体实现见“串与模式匹配”一节。

## 七、排序

### 1. 基本概念与统一计数口径

排序把记录按关键字重排。内部排序假设数据能放入内存；外部排序处理无法一次装入内存的数据。

稳定性只讨论关键字相等的记录：排序后它们的相对次序不变，算法才稳定。稳定与正确、快慢没有直接等价关系。

比较次数和记录移动次数必须分开。本文把一次交换视为三次记录赋值；若题目把暂存到 `temp`、循环最后写回也计入移动，精确数值会相应变化，必须服从题目口径。

冒泡、选择和堆排序会调用以下辅助方法，不能省略定义：

```java
static void swap(int[] values, int first, int second) {
    int temporary = values[first];
    values[first] = values[second];
    values[second] = temporary;
}
```

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

### 8. 外部排序

外部排序处理数据量大于可用内存的情况，优化重点是磁盘或外存 I/O，不是单纯减少 CPU 比较。下列实现使用内存数组模拟归并段，不包含文件 I/O、缓存管理和故障恢复。

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

小根堆版只保存每个非空段的当前元素，同值时按段号决定先后。输入段必须各自有序；这里只模拟选路，不读取真实磁盘文件。

```java
record RunHead(int value, int run, int index) {}

static int[] mergeRunsWithHeap(int[][] runs) {
    java.util.PriorityQueue<RunHead> queue = new java.util.PriorityQueue<>(
            java.util.Comparator.comparingInt(RunHead::value).thenComparingInt(RunHead::run));
    int total = 0;
    for (int i = 0; i < runs.length; i++) {
        total = Math.addExact(total, runs[i].length);
        if (runs[i].length != 0) queue.add(new RunHead(runs[i][0], i, 0));
    }
    int[] output = new int[total];
    for (int i = 0; i < total; i++) {
        RunHead head = queue.remove();
        output[i] = head.value();
        int next = head.index() + 1;
        if (next < runs[head.run()].length) {
            queue.add(new RunHead(runs[head.run()][next], head.run(), next));
        }
    }
    return output;
}
```

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

#### 8.3 败者树：只重赛当前胜者的路径

内部节点保存该场比赛的败者段号，总胜者单独保存。初始化时向上传递胜者并记录败者；每输出一次，只修改原胜者的段首，然后与路径上的旧败者重赛。耗尽通过位置判断，不用 `Integer.MAX_VALUE` 当哨兵，因此输入允许完整 `int` 值域。

```java
static final class LoserTree {
    private final int[][] runs;
    private final int[] positions;
    private final int[] losers;
    private final int leafBase;
    private int winner;

    LoserTree(int[][] runs) {
        this.runs = runs;
        positions = new int[runs.length];
        int base = 1;
        while (base < runs.length) base = Math.multiplyExact(base, 2);
        leafBase = base;
        losers = new int[base];
        winner = build(1);
    }

    boolean isEmpty() { return !active(winner); }

    int pop() {
        if (isEmpty()) throw new IllegalStateException("empty");
        int changedRun = winner;
        int value = runs[changedRun][positions[changedRun]++];
        int contender = changedRun;
        for (int node = (leafBase + changedRun) / 2; node > 0; node /= 2) {
            int opponent = losers[node];
            if (before(opponent, contender)) {
                losers[node] = contender;
                contender = opponent;
            }
        }
        winner = contender;
        return value;
    }

    private int build(int node) {
        if (node >= leafBase) return node - leafBase;
        int leftWinner = build(node * 2);
        int rightWinner = build(node * 2 + 1);
        boolean leftFirst = before(leftWinner, rightWinner);
        losers[node] = leftFirst ? rightWinner : leftWinner;
        return leftFirst ? leftWinner : rightWinner;
    }

    private boolean active(int run) {
        return run < runs.length && positions[run] < runs[run].length;
    }

    private boolean before(int first, int second) {
        boolean firstActive = active(first);
        boolean secondActive = active(second);
        if (firstActive != secondActive) return firstActive;
        if (!firstActive) return first < second;
        int comparison = Integer.compare(runs[first][positions[first]], runs[second][positions[second]]);
        return comparison < 0 || comparison == 0 && first < second;
    }
}

static int[] mergeRunsWithLoserTree(int[][] runs) {
    int total = 0;
    for (int[] run : runs) total = Math.addExact(total, run.length);
    LoserTree tree = new LoserTree(runs);
    int[] output = new int[total];
    for (int i = 0; i < total; i++) output[i] = tree.pop();
    return output;
}
```

初始化 `O(k)`，每次输出 `O(log k)`；含初始化的总时间为 `O(k+N log(k+1))`，辅助空间 `O(k)`，输出另计 `O(N)`。空段、全部耗尽、单路和非 2 的幂路数都要测。

#### 8.4 置换选择：生成更长的初始归并段

`active` 保存可继续进入本段的元素，`frozen` 保存必须推迟到下一段的元素。二者总元素数始终不超过 `memorySize`。一段结束后交换两个堆，不能把冻结元素提前拿出来。

```java
static java.util.List<int[]> replacementSelection(int[] input, int memorySize) {
    if (memorySize <= 0) throw new IllegalArgumentException("memory size");
    java.util.PriorityQueue<Integer> active = new java.util.PriorityQueue<>();
    java.util.PriorityQueue<Integer> frozen = new java.util.PriorityQueue<>();
    int read = 0;
    while (read < input.length && active.size() < memorySize) active.add(input[read++]);
    java.util.List<int[]> runs = new java.util.ArrayList<>();
    while (!active.isEmpty()) {
        java.util.List<Integer> current = new java.util.ArrayList<>();
        while (!active.isEmpty()) {
            int value = active.remove();
            current.add(value);
            if (read < input.length) {
                int incoming = input[read++];
                if (incoming >= value) active.add(incoming);
                else frozen.add(incoming);
            }
        }
        runs.add(current.stream().mapToInt(Integer::intValue).toArray());
        java.util.PriorityQueue<Integer> empty = active;
        active = frozen;
        frozen = empty;
    }
    return runs;
}
```

时间 `O(N log(M+1))`，候选堆占 `O(min(N,M))`；教学代码把所有输出段存在内存，输出占 `O(N)`，所以它不是“真实只用 M 个单元”的外排程序。实际文件版应将本段连续写入外存。顺序输入可产生一个长段，逆序输入会频繁冻结，不能保证每段都比内存容量长。

#### 8.5 k 路最佳归并代价

```java
static long optimalMergeCost(long[] runLengths, int ways) {
    if (ways < 2) throw new IllegalArgumentException("ways must be at least two");
    java.util.PriorityQueue<Long> lengths = new java.util.PriorityQueue<>();
    for (long length : runLengths) {
        if (length < 0) throw new IllegalArgumentException("negative run length");
        lengths.add(length);
    }
    if (lengths.size() <= 1) return 0;
    int remainder = (lengths.size() - 1) % (ways - 1);
    int padding = remainder == 0 ? 0 : ways - 1 - remainder;
    for (int i = 0; i < padding; i++) lengths.add(0L);
    long cost = 0;
    while (lengths.size() > 1) {
        long merged = 0;
        for (int i = 0; i < ways; i++) merged = Math.addExact(merged, lengths.remove());
        cost = Math.addExact(cost, merged);
        lengths.add(merged);
    }
    return cost;
}
```

`optimalMergeCost([2,3,7,9],2)` 为 `38`，与相同权值 Huffman 的 WPL 一致；它是每轮被合并记录数之和，若每轮都读一次写一次，记录传输量是 `2*38=76`，不包括生成初始段。补零后的段数为 `r'`，堆算法约为 `O(r' log r')` 时间、`O(r')` 空间；很大的归并路数还会带来补零和缓冲区成本。

> 手算验收：给出 `N/M/k` 后，依次算 `r`、归并趟数、合并阶段 I/O、缓冲区数量和虚段数；给出不等长归并段时再画最佳归并树。

## 八、Java 与 C 语法对照

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
