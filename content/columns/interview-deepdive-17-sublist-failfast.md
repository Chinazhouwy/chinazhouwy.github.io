---
title: "面试手册深挖 03 · subList、迭代器、fail-fast（Q17）"
date: "2026-10-06"
updated: "2026-10-06"
domain: "专栏"
area: "技术"
module: "面试手册深挖"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "《Java × Agent 四天面试手册》Q17 解释版原文 + 会话深挖：modCount 回绕上限、SubList 账本+抄本+对账的源码机制（JDK 25 行号）、三种"不可变"的区分。"
tags:
  - Java
  - 集合
  - fail-fast
---

# 面试手册深挖 03 · subList、迭代器、fail-fast（Q17）

> 第一部分完整收录手册解释版 Q17 原文；第二部分是 2026-10-06 会话深挖：modCount 是否有上限、SubList"账本+抄本+对账"的源码级机制（JDK 25 ArrayList.java 行号可查）。

## 一、手册原文（解释版）

### ① subList 是视图，通常不是复制

对父列表 [A,B,C,D] 调用 subList(1,3)，视图为 [B,C]。视图 set(0,X) 会把父列表变成 [A,X,C,D]；通过视图删除也会修改父结构。父列表在视图外发生结构修改后，继续使用原视图可能失效或抛 ConcurrentModificationException。视图可能保留父列表及其大数组，长期留存小切片应考虑 new ArrayList<>(view) 创建独立容器，但元素对象仍是同一批引用。

### ② fail-fast 是查错机制，不是并发协议

迭代器通常记录创建时的修改计数，遍历中比较 modCount 与期望值来尽早暴露非法结构修改。这是尽力检测，不能承诺所有并发错误都被捕获，也不提供跨线程可见性。教学例：增强 for 中直接 list.remove，后续迭代可能抛异常；使用 iterator.remove 则会正确更新该迭代器的期望计数。批量删除也可用 removeIf。

### ③ 固定长度和不可修改不同

Arrays.asList 由原数组支持，允许 set，通常不允许 add/remove；改变数组内容也影响列表。JDK 9 起的 List.of 不允许修改，也不接收 null。Collections.unmodifiableList 是包装视图，底层列表仍可能被别处修改；不可修改容器也不冻结元素对象。接口的修改能力、存储共享和元素可变性应逐层判断。

### 60–90 秒口述（手册版）

subList 通常共享父列表存储，修改会关联，还可能因为持有父结构而保留大数组；要独立数据应复制。fail-fast 靠修改计数尽力发现不合规结构修改，不能代替同步，遍历删除应使用迭代器或批量 API。Arrays.asList 是由数组支持的固定长度列表，List.of 是不可修改列表，包装成只读视图也不能保证底层或元素完全不变。

### 手册追问

- list.set 为什么通常不触发结构修改异常？它只替换元素，不改变列表长度或结构；具体计数行为仍取决于实现。
- 复制 subList 后元素也独立了吗？仅复制容器引用，若元素可变，双方仍可能看见同一元素的修改。

## 二、深挖补充（2026-10-06 会话笔记）

### 2.1 三个点的最小实验

```java
// ① subList 是视图
List<String> list = new ArrayList<>(List.of("A","B","C","D"));
List<String> sub = list.subList(1, 3);
sub.set(0, "X");
System.out.println(list);        // [A, X, C, D] ← 父列表被改了
list.remove(0);                  // 视图外动父结构
sub.get(0);                      // 💥 ConcurrentModificationException —— 视图作废

// ② 遍历中直接删
for (String s : list) {
    if (s.equals("B")) list.remove(s);   // 💥 后续 next() 抛 CME
}
// 正确姿势：iterator.remove()（同步更新期望计数）或 list.removeIf(...)

// ③ 三种"不能改"
String[] arr = {"A","B"};
List<String> a = Arrays.asList(arr);   // 定长视图：set ✅，add/remove ❌，改 arr 它跟着变
List<String> b = List.of("A","B");     // 冻死：全 ❌，且不收 null
List<String> c = Collections.unmodifiableList(list);  // 只读包装：自己不能改，底层改了它跟着变
```

一句话区分：**asList = 定长（能换不能增删）、List.of = 冻死、unmodifiable = 我不改 ≠ 别人不改**；三者都不冻结元素对象。

### 2.2 modCount 会不会触发上限？

modCount 是普通 int（AbstractList.java:630，JDK 25），Java int 溢出是**无声回绕**：数到 21.47 亿后变负继续，不抛异常不清零。所以不存在"上限触发"。

回绕无害的原因：检查是裸的 `!=`（ArrayList.java:1095 `if (modCount != expectedModCount)`），回绕后的值照样对不上、照样抛 CME。唯一的漏检窗口：迭代器活着期间列表恰好被结构修改 **2³²（约 42.9 亿次）** 的整数倍——绕一整圈回到期望值。每秒百万次修改也要 70 多分钟不间断，且迭代器还得一次 next() 都不调，实践不可达。真正要注意的是：modCount **非 volatile**（跨线程可见性无保证——fail-fast 不是并发协议的物理基础），以及它非并发计数（size 用原子变量，另一套）。

### 2.3 账本 + 抄本 + 对账：一个协议、三处复用

modCount 本质是"结构变动流水号"。所有需要"记住位置"的东西按同一个三步协议工作：**创建时抄一份流水号 → 使用前对账 → 对不上抛 CME**。这个协议被复制到三处：

1. **ArrayList 自己的迭代器（Itr）**：抄 `modCount`，next() 前查 `modCount != expectedModCount`（:1095）。
2. **SubList**：它没有自己的存储，只是"父列表 + offset"的透镜——`get(0)` 实际执行 `root.elementData[offset + 0]`。父列表一动，offset 全错。所以它对账的对象是**根列表的账**（:1497 `if (root.modCount != modCount)`）。"视图外改父列表 → 视图作废"不是为了保护用户，是它自救：不对账它自己就会取错元素。
3. **HashMap/HashSet**：不继承 AbstractList，拿不到那个字段，于是**另立一本同款 `transient int modCount`**，HashIterator 创建时抄、nextNode() 前对账。HashSet 包着 HashMap，共用一本。

### 2.4 SubList 的源码证据（JDK 25 ArrayList.java）

```java
// 构造时抄账（:1205）
public SubList(ArrayList<E> root, int fromIndex, int toIndex) {
    this.root = root; this.offset = fromIndex; this.size = toIndex - fromIndex;
    this.modCount = root.modCount;              // ★ 把根账本抄一份
}

// 增删三步曲：对账 → 传导 → 记账（:1242 / :1249）
public void add(int index, E element) {
    rangeCheckForAdd(index);
    checkForComodification();                   // ① 用前对账
    root.add(offset + index, element);          // ② 传导给根列表（真账 +1）
    updateSizeAndModCount(1);                   // ③ 自己人记账
}

// 记账方法：连父视图的账一起记（:1501）
private void updateSizeAndModCount(int sizeChange) {
    SubList<E> slist = this;
    do {
        slist.size += sizeChange;
        slist.modCount = root.modCount;         // ★ 抄本 = 根账本最新值
        slist = slist.parent;                   // ★ 沿 parent 链，每层祖先视图都同步
    } while (slist != null);
}

// SubList 自己的迭代器 remove（:1434）：同款
SubList.this.remove(lastRet);
cursor = lastRet; lastRet = -1;
expectedModCount = SubList.this.modCount;       // ★ 删完对齐视图层的账
```

`parent` 链是给"视图的视图"用的：内层视图加元素，外层视图的 size 和偏移也变了，所以每层祖先视图的抄本都要同步。

**反向对照**：`SubList.set`（:1222）直接写 `root.elementData[offset+index]`，**没有** updateSizeAndModCount——set 不改长度、结构没变、真账没动，抄本自然还是对的。这就是手册追问"list.set 为什么不触发异常"的源码级答案。

### 2.5 全图与统一规律

```
root.modCount ──────────────── 唯一真账（ArrayList）
   ↑ 读前对账        ↑ 写后对齐
SubList.modCount ───────────── 视图的抄本
   ↑ 读前对账        ↑ 写后对齐
iterator.expectedModCount ──── 迭代器的抄本
```

统一规律：**所有结构性写操作，最后一步把抄本对齐真账；所有依赖位置的操作，第一步检查抄本是否等于真账。** 自己人写 → 写完顺手对齐 → 下次对账通过（合法）；外人写 → 没人对齐 → 对账失败 → CME（作废）。通过 sub 增删合法、视图外增删作废，物理原因就在这。

## 三、与其他题的连线

- Q18（HashMap）：HashMap 也在"另立一本账"的名单里（modCount 机制同款），且它的迭代器同为 fail-fast。
- Q21（CHM）：对照记忆——CHM 迭代器是**弱一致**（不抛 fail-fast），因为它的并发定位就不是"检测非法修改"而是"容忍并发演进"。
- Q15（Builder）：迭代是复合动作、synchronizedList 要求外部同步，出自同一条"复合动作自己负责"的边界线。
