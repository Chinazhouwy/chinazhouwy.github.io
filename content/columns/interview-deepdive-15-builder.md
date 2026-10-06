---
title: "面试手册深挖 02 · Builder、Integer、BigDecimal 的坑（Q15）"
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
summary: "《Java × Agent 四天面试手册》Q15 解释版原文 + 会话深挖：StringBuilder 无原子性、StringBuffer 单方法同步护不住复合动作、JDK 原子性的两档分法与三条出路。"
tags:
  - Java
  - StringBuilder
  - 线程安全
---

# 面试手册深挖 02 · Builder、Integer、BigDecimal 的坑（Q15）

> 第一部分完整收录手册解释版 Q15 原文；第二部分是 2026-10-06 会话对①中线程安全句子的展开，并给出了本题与 Q22 的统一理论。

## 一、手册原文（解释版）

### ① Builder 的长度和容量不是一回事

StringBuilder 用可变存储和有效长度累积内容，容量足够时 append 复用空间，不足才扩容复制。JDK 8 常见候选容量是旧容量乘二加二，仍不足就至少满足本次需求，超大容量还有边界处理。容量 16、长度 3 表示只有前三个位置属于有效内容。它没有保证多线程共同 append 的安全性；StringBuffer 的单方法同步也不能自动保护"检查再追加"的复合动作。

### ② 包装整数必须区分引用与数值

Integer 的 == 在两个包装引用间比较对象身份，缓存会让部分小整数碰巧共享对象。不能据此推导所有相等数值的引用相同。应使用 equals 或拆箱后比较，但拆箱 null 会抛 NullPointerException。例如两个 Integer.valueOf(1000) 的 equals 为 true，引用是否相同不能作为业务判断。

### ③ 金额需要明确输入、精度与舍入

new BigDecimal(0.1) 接收的是已经近似的二进制浮点数，会保留该近似值；用字符串 new BigDecimal("0.1") 或 valueOf 更符合常见十进制意图。1.0 与 1.00 的 equals 为 false，因为 scale 不同；compareTo 为 0，因为数值相同。1 / 3 若不指定可接受的精度或舍入策略，可能因无限小数抛异常。金额示例可以要求结果保留两位并显式使用 HALF_UP，但实际舍入规则应来自业务，不是所有金额都一律四舍五入。

### 60–90 秒口述（手册版）

Builder 通过可变存储减少连续追加时的复制，要区分有效长度和预留容量，且不要让多个线程无同步共同修改。Integer 的双等号可能比较引用，缓存只是实现优化，数值判断应明确使用 equals 或安全拆箱。BigDecimal 应从十进制文本或合适的 valueOf 创建，注意 equals 还比较 scale，除法也要明确精度和舍入，不能把金额规则交给默认行为。

### 手册追问

- 循环里用了 Builder 就没有新对象吗？扩容、toString 和循环中其他表达式仍可能分配，不能只看变量类型。
- BigDecimal.equals 与 compareTo 哪个好？去重和 Map 键应明确 scale 是否属于身份；数值大小比较一般用 compareTo。

## 二、深挖补充（2026-10-06 会话笔记）

### 2.1 前半句：StringBuilder 连"单方法"都不原子

一次 `append(str)` 看着是一行，内部至少三步：

```
① ensureCapacity(count + len)   ← 可能新建数组、复制旧内容
② 把 str 拷进内部数组的 count 位置
③ count += len
```

两个线程并发 append，三步任意交错都会出事：**丢更新**（都读到 count=5，都往位置 5 写，互相覆盖）；**扩容竞态**（A 正在换新数组，B 还往旧数组写 → 数据丢失或 ArrayIndexOutOfBoundsException）；**计数错乱**（count 加了两次、数据只写成一份，有效长度里混垃圾字符）。

### 2.2 后半句：StringBuffer 锁了每个方法，锁不住"两个方法之间"

StringBuffer 每个方法都 synchronized——**单次调用原子**。但"检查再追加"是两次独立调用，中间有锁已释放的空档：

```java
if (sb.length() < 10) {      // 调用 1：原子
    sb.append("xxxxxx");     // 调用 2：原子，但与调用 1 之间没有原子性
}
```

时间线：线程 A `length()=5 ✓` → 线程 B `length()=5 ✓` → A append → B append → 长度 15，"不足 10 才追加"的意图被击穿。每一次方法调用都完美原子，**但业务规则活在"两次调用"这个跨度上，那里没有任何保护**。修复：`synchronized(sb) { if (...) sb.append(...); }` 把锁的边界扩到和业务规则一样大；更好的做法是设计上绕开（每线程一个 Builder 最后合并）。

### 2.3 统一理论：JDK 原子性两档 + 复合动作三类 + 出路三条

被追问"JDK 方法是不是都不保证复合动作"时的高分回答：

**两档**：StringBuilder/HashMap/ArrayList 连单方法都不原子；StringBuffer/Vector/Hashtable/CHM 单键操作单方法原子。**两档对复合动作一律不保**，而且复合动作比想象的隐蔽——检查再行动、先读后 put、**迭代**（`Collections.synchronizedList` 的 javadoc 明文要求迭代时手动同步，最古老也最容易忘的复合动作）。

**为什么 JDK 不能保**：库知道数据结构，不知道你的业务不变量——"不足 10 才追加"、"转账两步全成"只存在于调用方代码里。

**三条出路**：

1. **把复合塞进单次调用**：putIfAbsent（检查+放入原子化）、compute/computeIfAbsent（读改写进桶锁）——这些方法存在的意义就在这；
2. **自己圈范围**：synchronized / ReentrantLock / 读写锁，锁的跨度自己画；
3. **状态坍缩**：把 N 个相关字段打包成一个不可变对象，全并发只碰一个 volatile/AtomicReference 引用——"改 10 个字段"坍缩成"换 1 个引用"，复合动作在结构上消失。CopyOnWriteArrayList 就是这个思想的容器版（写时复制整个数组，最后一步原子换引用）。

```java
// 坏：两个 AtomicLong 各自改，中间态可见
count.incrementAndGet();
total.addAndGet(x);
// 好：整个状态打包，单次 CAS 原子切换
state.updateAndGet(s -> new State(s.count + 1, s.total + x));
```

## 三、与其他题的连线

- Q22（CHM 与事务）：本文 2.2 的"单方法原子 vs 复合动作"与 Q22 的"单键原子 vs 跨键事务"是同一条边界线——容器的线程安全承诺永远只到单次操作。
- Q18（HashMap）：HashMap 在第一档（连单方法都不原子），并发场景直接换 CHM。
- Q14（String）：StringBuilder 可变共享的事故，反向解释 String 为什么设计成不可变。
