---
title: "面试手册深挖 01 · String 不可变与版本差异（Q14）"
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
summary: "《Java × Agent 四天面试手册》Q14 解释版原文 + 会话深挖：存储编码与字符计数分层、Compact Strings 位级走查、补码与 & 0xff、intern 与 String Dedup 的两层冗余消除。"
tags:
  - Java
  - String
  - 编码
  - JVM
---

# 面试手册深挖 01 · String 不可变与版本差异（Q14）

> 本文第一部分完整收录《Java × Agent · 四天面试准备》解释版 Q14 原文（来源：wy-java-agent-interview.chinazhouwy.chatgpt.site，2026-10-06 版），第二部分是 2026-10-06 会话中围绕本题的多轮深挖笔记合并。

## 一、手册原文（解释版）

### ① 不可变来自封装，而不是只写 final

String 的逻辑字符内容在创建后不改变。类被 final 限制继承，内部存储不通过公开接口暴露为可写数组，方法也不修改已有字符串的内容。字段 final 仅限制引用重新指向其他数组，不能禁止数组元素被改。接受外部 char[] 的公开构造器做防御性复制；toCharArray() 也返回副本。内部 hash 缓存可以变化，它是派生信息，不改变逻辑内容。两个 String 安全共享不可变内部数据，与直接保留调用者可写数组，是不同情况。

### ② 操作返回结果，不代表一律创建对象

教学例：`char[] a={'A','B'}; String s=new String(a); a[0]='X';` 此时 s 仍为 AB，因为构造时已复制。`s.toCharArray()[0]='Y'` 也不会改 s。拼接出不同内容需要另一个字符串结果，但某些无变化操作可以返回 this，例如覆盖全长的 substring，以及没有命中字符的 replace。不可变约束是"旧对象内容不变"，不是"每个方法必须分配新对象"；也不能用对象身份推测所有操作的分配成本。

### ③ 存储编码与字符计数要分开

JDK 8 的主要表示为 char[]，每个 char 是一个 UTF-16 代码单元。JDK 9 起 Compact Strings 通常以 byte[] 加 coder 表示：开启该优化时，整串能用 Latin-1 表示才使用单字节形式；否则整串使用 UTF-16 的双字节形式，不是在同一字符串里逐字混用两种宽度。`"A😀".length()` 为 3，因为表情占一个代理对；codePointCount 为 2。`"e\u0301"` 的长度和码点数都是 2，但常显示成一个带重音的字素。码点也不等于用户看到的完整字符，需要字素分段规则处理组合字符与复杂表情。

### ④ 字符串池不等于一块装字符串的特殊堆

intern 返回内容相同字符串的规范引用。应区别 class 文件中的常量池、类加载后运行时常量池，以及 HotSpot 的 StringTable。现代 HotSpot 中，String 对象及其内容数组在堆里；StringTable 是 native 层维护规范引用的表结构。对象在哪、索引表在哪、类常量如何解析，是三个不同问题。不同 JDK 和虚拟机实现的布局细节不能互相套用。

| 结构 | 作用及位置 |
|---|---|
| class 文件常量池 | .class 文件格式的一部分，保存字面量和符号引用等 |
| 运行时常量池 | 类加载后的常量信息，关联类元数据；HotSpot 解析后的对象引用还涉及堆中结构，不能说全部对象都在元空间 |
| 字符串规范引用表 StringTable | HotSpot 在 native 层维护表，引用的 String 对象和内容数组在堆中；intern 取得规范引用 |

### 60–90 秒口述（手册版）

String 不可变靠内部数据封装和公开操作约束，final 引用本身不能冻结数组。接受外部字符数组时会防御性复制；无变化操作也可能返回原对象。8 主要使用 char 数组，9 起通常用 byte 数组和 coder，按整串选择 Latin-1 或 UTF-16。length 数代码单元，码点计数仍不等于可见字素。现代 HotSpot 的字符串对象在堆中，native StringTable 管理规范引用，不能混为一谈。

### 手册追问

- new String(existingString) 为何可共享数据？两端都没有公开修改内部存储的能力，共享不可变数据安全。
- intern 会让任意两个相等字符串的引用自动相同吗？不会；要使用 intern 返回的规范引用，原引用不会被原地替换。
- 为什么中文可能让整串占更多字节？一个字符不能以 Latin-1 表示就需要 UTF-16 coder，整串表示一起切换。
- 为什么把 String 设计成不可变？便于安全共享和字符串池复用，散列内容稳定适合 Map 键，多线程共享无需防止内容被修改；路径、类名等参数传入后也不会被原调用方通过正常 API 中途篡改。

## 二、深挖补充（2026-10-06 会话笔记）

### 2.1 两个独立的层：怎么"存" vs 怎么"数"

第③段最容易绕晕，是因为它把两个互相独立的层面放在一起：

- **存储层（编码）**：JVM 内部用什么格式放字符串。JDK 8 用 char[]，JDK 9 起用 byte[] + coder。这是实现细节，JDK 9 改的是这一层。
- **计数层（API 契约）**：length()、charAt() 数的是什么。这层从 JDK 8 到 9 **一个字都没变**，永远是"UTF-16 代码单元"。

如果存储和计数混为一谈，会得出"byte[] 存的串 length 应该变小了"这种错误结论——实际上 `"AB"` 不管底层存 4 字节还是 2 字节，length() 都是 2。

### 2.2 数"字符"有三个单位

| 单位 | 是什么 | 用哪个 API 数 |
|---|---|---|
| 代码单元 (code unit) | 一个 UTF-16 槽位，2 字节，就是 char | length()、charAt(i) |
| 码点 (code point) | 一个真实的 Unicode 字符 | codePointCount() |
| 字素 (grapheme) | 用户眼里"一个字" | JDK 无直接 API（BreakIterator/ICU） |

用手册的两个例子走阶梯：`"A😀"` 的 length() 是 3（😀 是代理对占两个单元）、codePointCount 是 2、字素也是 2；`"e\u0301"`（e + 组合重音符）的 length 和码点都是 2，但显示成一个字 **é**，字素只有 1。三级阶梯：`length() ≥ codePointCount ≥ 用户看到的字数`。

配套 API：`codePointCount(begin, end)` 遍历区间，代理对算 1；`offsetByCodePoints()` 按码点找索引；`codePoints()` 返回码点 IntStream。实际选用：日志/UI 截断、防 emoji 截半 → 码点或字素；内存/字节估算 → 看 coder 模式；length() → 只在协议按 char 语义定义时用。

### 2.3 byte 与 char：一个改写法的操作

| | byte | char |
|---|---|---|
| 宽度 | 8 位（1 字节） | 16 位（2 字节） |
| 符号 | 有符号 -128~127 | 无符号 0~65535（Java 唯一的无符号类型） |
| 语义 | 原始 8 比特，无固有含义（数据） | 天生就是"一个 UTF-16 代码单元"（文本） |

`StringLatin1.charAt` 的源码只有一行：`return (char)(value[index] & 0xff);`。& 0xff 的作用是**改读法**：byte `11101001`（é = U+00E9 = 233）按有符号读是 -23（最高位当符号位），参与运算提升为 int 时负数高位补 1 变成 `1111...111101001`，拿 0xff（低 8 位全 1）一与，补出来的 24 个 1 全被清掉，只留原始 8 比特 → 233。8 个比特本身没变，变的只是解释方式。对比 StringUTF16 的 charAt 是把两个字节拼起来：`(char)(((value[i] & 0xff) << 8) | (value[i+1] & 0xff))`。

### 2.4 补码：-23 和 233 是同一串比特的两套标签

按 408 的三种编码读同一串 `11101001`：

| 编码 | 规则 | 读作 | 8 位范围 |
|---|---|---|---|
| 原码 | 最高位纯符号标签，不参与数值 | -105 | -127~+127（有 ±0） |
| 反码 | 负数 = 原码尾数按位取反 | -22 | -127~+127（仍有 ±0） |
| 补码 | 反码 +1；等价定义：最高位权重是 -2⁷ | **-23** | **-128~+127**（零唯一） |

补码的直读法：`值 = (-128)×b₇ + 64×b₆ + ... + 1×b₀`，即 `-128 + 105 = -23`。转换法：取反加一得绝对值。两法等价，因为补码定义式 `[x]补 = 2ⁿ + x (mod 2ⁿ)`：**233 和 -23 正好差 256**，是同一图案在无符号/有符号两套钟面标签下的名字。正数在三种编码下完全相同（01101001 都是 +105）；分歧全在最高位为 1 的负数区。硬件选补码是因为：零唯一、加减法统一成加法器、8 位能用满 256 个图案（负端多出 -128，且 -128 取反加一后无法变回正数形态——正数只到 +127）。

### 2.5 Compact Strings 的完整规则与源码机制

规则按**整串**选择：整串每个字符码点 ≤ 0xFF（Latin-1，含 ASCII 和 é ü ñ 这类西欧字母）→ 1 字节一字符；任何一个字符超线（中文、emoji、俄文、甚至拼音的 ā = U+0101）→ **整串**切 UTF-16 双字节模式。不是逐字混用。

JDK 25 源码（String.java 197-232 行）的关键注释：

```java
static final boolean COMPACT_STRINGS;
static {
    COMPACT_STRINGS = true;   // ← 只是占位，javadoc 明说 "The actual value for this field is injected by JVM."
}
```

传递链：`-XX:+/-CompactStrings`（PrintFlagsFinal 显示为 `pd product`，平台相关——这是手册"通常"二字的来源之一）→ HotSpot 启动 native 引导阶段把真实值**直接写进这个静态字段**。占位符写法的两个原因：① 写成 `static final boolean X = true` 常量表达式会被 javac 内联进所有引用类，运行时改 flag 对已编译类失效；② 静态块赋值避免 VM 初始化期的循环依赖。运行时性能靠 JIT 常量折叠：`if (COMPACT_STRINGS && coder == LATIN1)` 在 flag 关闭时被编译成 `if (false)`，Latin-1 分支直接消失。

源码复杂的根源：每个操作都有 StringLatin1 和 StringUTF16 两份平行实现，外层按 coder 分发。记忆模型：**byte[] 是物理存储，coder 是"这块字节该怎么解释"的开关，公开 API 永远按 UTF-16 代码单元说话。**

补充一张 UTF-8 / UTF-16 / GBK 对照（Java String 内存里三者都不是，它们只出现在 IO 边界 `getBytes(charset)` / `new String(bytes, charset)`；乱码的全部根源是边界两侧编码约定不一致；JDK 18 起 file.encoding 默认 UTF-8，JEP 400）：

| | "A" (U+0041) | "中" (U+4E2D) | "😀" (U+1F600) |
|---|---|---|---|
| UTF-8 | 1 字节 | 3 字节 | 4 字节 |
| UTF-16 | 2 字节 | 2 字节 | 4 字节（2 个单元） |
| GBK | 1 字节 | 2 字节 | 无法表示 |

### 2.6 intern 的精确语义与三种使用姿势

流程是两分支，不只是"返回已有的"：

```
s.intern():
  按 s 的内容查 StringTable
   ├─ 池里没有 → 把 s 自己的引用装进池 → 返回 s 本身
   └─ 池里已有 → 什么都不加 → 返回池里那个旧引用（s 等着被 GC）
```

作用一句话：**把"内容相等"（equals）升级为"引用相同"（==）**。池里存的是引用不是副本（呼应④段三个池）；intern 省内存的前提是你**改用返回的那个引用**，旧副本不放手就白搭。

```java
String a = new StringBuilder("ab_").append("cd").toString(); // 堆上新对象，池里没有
String b = a.intern();   // 分支一：a 入池，返回 a 本身 → b == a
String y = new String("ab_cd");
String z = y.intern();   // 分支二：返回 a 的引用 → z == a，z != y
```

修改 intern 后的引用安全吗？——String 不可变，"修改"只能让变量改指向（`z = z + "!"` 新建对象），a 和池子毫发无损。对比 StringBuilder：`sb2 = sb1; sb2.append("!")` 会真改到共享对象。这正是"为什么 String 设计成不可变"的场景化证明：**共享引用不可怕，共享可变对象才可怕**；StringTable 的对象全 JVM 共享，可变的话任何持有者改内容就是全局灾难。

业务代码几乎不手动 intern，依赖的是两次"自动 intern"：① 字面量自动入池；② G1 String Deduplication（JEP 192，JDK 8u20 引入 G1，JDK 18 起扩展到更多 GC，`-XX:+UseStringDeduplication`）。手动 intern 的真实小众场景：解析器/词法分析器的关键字表、海量重复值瘦身（千万行 CSV 里的重复城市名）。不用的原因：收益小（语义重复的值应该用 enum）、StringTable 是 native 固定大小哈希表（默认 65536 桶，-XX:StringTableSize 可调）、单 JVM 一份跨实例无意义。

### 2.7 intern 与 String Dedup：两个维度的冗余消除

| | 冗余藏在哪 | 合并什么 | 保留什么 | 用户可见变化 |
|---|---|---|---|---|
| **intern** | 对象之间 | 重复的 String 对象（连人带数组） | 一个规范对象 | `==` 成立；要求换用返回的引用 |
| **Dedup** | 对象之间的内容数组 | 重复的 byte[]（value 字段改指同一数组） | 全部 String 对象 | 完全不可见，`==` 依然 false |

Dedup 敢偷改 value 字段的前提恰是不可变：内容永不变化，共享底层数组无任何可观察差别。代价差别：intern 连对象头一起省（要换引用配合）；dedup 只省数组那份钱，对象头开销（约 16 字节 + hash 字段）一个没省——短重复串 dedup 省得有限，长串才痛快。而 Compact Strings 消除的是**单个字符串内部**的编码宽度冗余，与对象层去重正交、可叠加：**表示层有 Compact Strings，对象层有 intern/dedup，两个维度互补**。若被问"intern 是为了省内存吗"，更高层的答法是：intern 本质是引用规范化机制（语义工具），省内存是有条件的副产品；纯省内存的正解是 dedup。

## 三、与其他题的连线

- Q21/Q22（CHM）：StringTable 池里存引用、禁 null 的思路，与 CHM"null 返回值必须无歧义"同源。
- Q17（fail-fast）：Dedup 后台线程的"异步、时机不定"，与 modCount 非volatile 的"尽力而为"是同一种工程权衡。
- Q15（Builder）：StringBuilder 可变共享的事故，反向证明 String 不可变为什么值得。
