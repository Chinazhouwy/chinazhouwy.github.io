---
title: "面试深挖"
date: "2026-10-06"
updated: "2026-10-07"
domain: "专栏"
area: "技术"
module: "面试深挖"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "把面试手册里讲过的题逐题深挖：解释版原文完整收录，会话推导笔记合并，跨题连线成网。当前收录 Q14/Q15/Q17/Q18/Q21/Q22 与三个延伸专题。"
tags:
  - Java
  - 集合
  - 并发
  - JVM
---

# 面试深挖
## 01 · String 不可变与版本差异（Q14）【P1】


> 本章第一部分完整收录《Java × Agent · 四天面试准备》解释版 Q14 原文（来源：wy-java-agent-interview.chinazhouwy.chatgpt.site，2026-10-06 版），第二部分是 2026-10-06 会话中围绕本题的多轮深挖笔记合并。

### 一、手册原文（解释版）

#### ① 不可变来自封装，而不是只写 final

String 的逻辑字符内容在创建后不改变。类被 final 限制继承，内部存储不通过公开接口暴露为可写数组，方法也不修改已有字符串的内容。字段 final 仅限制引用重新指向其他数组，不能禁止数组元素被改。接受外部 char[] 的公开构造器做防御性复制；toCharArray() 也返回副本。内部 hash 缓存可以变化，它是派生信息，不改变逻辑内容。两个 String 安全共享不可变内部数据，与直接保留调用者可写数组，是不同情况。

#### ② 操作返回结果，不代表一律创建对象

教学例：`char[] a={'A','B'}; String s=new String(a); a[0]='X';` 此时 s 仍为 AB，因为构造时已复制。`s.toCharArray()[0]='Y'` 也不会改 s。拼接出不同内容需要另一个字符串结果，但某些无变化操作可以返回 this，例如覆盖全长的 substring，以及没有命中字符的 replace。不可变约束是"旧对象内容不变"，不是"每个方法必须分配新对象"；也不能用对象身份推测所有操作的分配成本。

#### ③ 存储编码与字符计数要分开

JDK 8 的主要表示为 char[]，每个 char 是一个 UTF-16 代码单元。JDK 9 起 Compact Strings 通常以 byte[] 加 coder 表示：开启该优化时，整串能用 Latin-1 表示才使用单字节形式；否则整串使用 UTF-16 的双字节形式，不是在同一字符串里逐字混用两种宽度。`"A😀".length()` 为 3，因为表情占一个代理对；codePointCount 为 2。`"e\u0301"` 的长度和码点数都是 2，但常显示成一个带重音的字素。码点也不等于用户看到的完整字符，需要字素分段规则处理组合字符与复杂表情。

#### ④ 字符串池不等于一块装字符串的特殊堆

intern 返回内容相同字符串的规范引用。应区别 class 文件中的常量池、类加载后运行时常量池，以及 HotSpot 的 StringTable。现代 HotSpot 中，String 对象及其内容数组在堆里；StringTable 是 native 层维护规范引用的表结构。对象在哪、索引表在哪、类常量如何解析，是三个不同问题。不同 JDK 和虚拟机实现的布局细节不能互相套用。

| 结构 | 作用及位置 |
|---|---|
| class 文件常量池 | .class 文件格式的一部分，保存字面量和符号引用等 |
| 运行时常量池 | 类加载后的常量信息，关联类元数据；HotSpot 解析后的对象引用还涉及堆中结构，不能说全部对象都在元空间 |
| 字符串规范引用表 StringTable | HotSpot 在 native 层维护表，引用的 String 对象和内容数组在堆中；intern 取得规范引用 |

#### 60–90 秒口述（手册版）

String 不可变靠内部数据封装和公开操作约束，final 引用本身不能冻结数组。接受外部字符数组时会防御性复制；无变化操作也可能返回原对象。8 主要使用 char 数组，9 起通常用 byte 数组和 coder，按整串选择 Latin-1 或 UTF-16。length 数代码单元，码点计数仍不等于可见字素。现代 HotSpot 的字符串对象在堆中，native StringTable 管理规范引用，不能混为一谈。

#### 手册追问

- new String(existingString) 为何可共享数据？两端都没有公开修改内部存储的能力，共享不可变数据安全。
- intern 会让任意两个相等字符串的引用自动相同吗？不会；要使用 intern 返回的规范引用，原引用不会被原地替换。
- 为什么中文可能让整串占更多字节？一个字符不能以 Latin-1 表示就需要 UTF-16 coder，整串表示一起切换。
- 为什么把 String 设计成不可变？便于安全共享和字符串池复用，散列内容稳定适合 Map 键，多线程共享无需防止内容被修改；路径、类名等参数传入后也不会被原调用方通过正常 API 中途篡改。

### 二、深挖补充（2026-10-06 会话笔记）

#### 2.1 两个独立的层：怎么"存" vs 怎么"数"

第③段最容易绕晕，是因为它把两个互相独立的层面放在一起：

- **存储层（编码）**：JVM 内部用什么格式放字符串。JDK 8 用 char[]，JDK 9 起用 byte[] + coder。这是实现细节，JDK 9 改的是这一层。
- **计数层（API 契约）**：length()、charAt() 数的是什么。这层从 JDK 8 到 9 **一个字都没变**，永远是"UTF-16 代码单元"。

如果存储和计数混为一谈，会得出"byte[] 存的串 length 应该变小了"这种错误结论——实际上 `"AB"` 不管底层存 4 字节还是 2 字节，length() 都是 2。

#### 2.2 数"字符"有三个单位

| 单位 | 是什么 | 用哪个 API 数 |
|---|---|---|
| 代码单元 (code unit) | 一个 UTF-16 槽位，2 字节，就是 char | length()、charAt(i) |
| 码点 (code point) | 一个真实的 Unicode 字符 | codePointCount() |
| 字素 (grapheme) | 用户眼里"一个字" | JDK 无直接 API（BreakIterator/ICU） |

用手册的两个例子走阶梯：`"A😀"` 的 length() 是 3（😀 是代理对占两个单元）、codePointCount 是 2、字素也是 2；`"e\u0301"`（e + 组合重音符）的 length 和码点都是 2，但显示成一个字 **é**，字素只有 1。三级阶梯：`length() ≥ codePointCount ≥ 用户看到的字数`。

配套 API：`codePointCount(begin, end)` 遍历区间，代理对算 1；`offsetByCodePoints()` 按码点找索引；`codePoints()` 返回码点 IntStream。实际选用：日志/UI 截断、防 emoji 截半 → 码点或字素；内存/字节估算 → 看 coder 模式；length() → 只在协议按 char 语义定义时用。

#### 2.3 byte 与 char：一个改写法的操作

| | byte | char |
|---|---|---|
| 宽度 | 8 位（1 字节） | 16 位（2 字节） |
| 符号 | 有符号 -128~127 | 无符号 0~65535（Java 唯一的无符号类型） |
| 语义 | 原始 8 比特，无固有含义（数据） | 天生就是"一个 UTF-16 代码单元"（文本） |

`StringLatin1.charAt` 的源码只有一行：`return (char)(value[index] & 0xff);`。& 0xff 的作用是**改读法**：byte `11101001`（é = U+00E9 = 233）按有符号读是 -23（最高位当符号位），参与运算提升为 int 时负数高位补 1 变成 `1111...111101001`，拿 0xff（低 8 位全 1）一与，补出来的 24 个 1 全被清掉，只留原始 8 比特 → 233。8 个比特本身没变，变的只是解释方式。对比 StringUTF16 的 charAt 是把两个字节拼起来：`(char)(((value[i] & 0xff) << 8) | (value[i+1] & 0xff))`。

#### 2.4 补码：-23 和 233 是同一串比特的两套标签

按 408 的三种编码读同一串 `11101001`：

| 编码 | 规则 | 读作 | 8 位范围 |
|---|---|---|---|
| 原码 | 最高位纯符号标签，不参与数值 | -105 | -127~+127（有 ±0） |
| 反码 | 负数 = 原码尾数按位取反 | -22 | -127~+127（仍有 ±0） |
| 补码 | 反码 +1；等价定义：最高位权重是 -2⁷ | **-23** | **-128~+127**（零唯一） |

补码的直读法：`值 = (-128)×b₇ + 64×b₆ + ... + 1×b₀`，即 `-128 + 105 = -23`。转换法：取反加一得绝对值。两法等价，因为补码定义式 `[x]补 = 2ⁿ + x (mod 2ⁿ)`：**233 和 -23 正好差 256**，是同一图案在无符号/有符号两套钟面标签下的名字。正数在三种编码下完全相同（01101001 都是 +105）；分歧全在最高位为 1 的负数区。硬件选补码是因为：零唯一、加减法统一成加法器、8 位能用满 256 个图案（负端多出 -128，且 -128 取反加一后无法变回正数形态——正数只到 +127）。

#### 2.5 Compact Strings 的完整规则与源码机制

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

#### 2.6 intern 的精确语义与三种使用姿势

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

#### 2.7 intern 与 String Dedup：两个维度的冗余消除

| | 冗余藏在哪 | 合并什么 | 保留什么 | 用户可见变化 |
|---|---|---|---|---|
| **intern** | 对象之间 | 重复的 String 对象（连人带数组） | 一个规范对象 | `==` 成立；要求换用返回的引用 |
| **Dedup** | 对象之间的内容数组 | 重复的 byte[]（value 字段改指同一数组） | 全部 String 对象 | 完全不可见，`==` 依然 false |

Dedup 敢偷改 value 字段的前提恰是不可变：内容永不变化，共享底层数组无任何可观察差别。代价差别：intern 连对象头一起省（要换引用配合）；dedup 只省数组那份钱，对象头开销（约 16 字节 + hash 字段）一个没省——短重复串 dedup 省得有限，长串才痛快。而 Compact Strings 消除的是**单个字符串内部**的编码宽度冗余，与对象层去重正交、可叠加：**表示层有 Compact Strings，对象层有 intern/dedup，两个维度互补**。若被问"intern 是为了省内存吗"，更高层的答法是：intern 本质是引用规范化机制（语义工具），省内存是有条件的副产品；纯省内存的正解是 dedup。

### 三、与其他题的连线

- Q21/Q22（CHM）：StringTable 池里存引用、禁 null 的思路，与 CHM"null 返回值必须无歧义"同源。
- Q17（fail-fast）：Dedup 后台线程的"异步、时机不定"，与 modCount 非volatile 的"尽力而为"是同一种工程权衡。
- Q15（Builder）：StringBuilder 可变共享的事故，反向证明 String 不可变为什么值得。

---

## 02 · Builder、Integer、BigDecimal 的坑（Q15）【P1】



> 第一部分完整收录手册解释版 Q15 原文；第二部分是 2026-10-06 会话对①中线程安全句子的展开，并给出了本题与 Q22 的统一理论。

### 一、手册原文（解释版）

#### ① Builder 的长度和容量不是一回事

StringBuilder 用可变存储和有效长度累积内容，容量足够时 append 复用空间，不足才扩容复制。JDK 8 常见候选容量是旧容量乘二加二，仍不足就至少满足本次需求，超大容量还有边界处理。容量 16、长度 3 表示只有前三个位置属于有效内容。它没有保证多线程共同 append 的安全性；StringBuffer 的单方法同步也不能自动保护"检查再追加"的复合动作。

#### ② 包装整数必须区分引用与数值

Integer 的 == 在两个包装引用间比较对象身份，缓存会让部分小整数碰巧共享对象。不能据此推导所有相等数值的引用相同。应使用 equals 或拆箱后比较，但拆箱 null 会抛 NullPointerException。例如两个 Integer.valueOf(1000) 的 equals 为 true，引用是否相同不能作为业务判断。

#### ③ 金额需要明确输入、精度与舍入

new BigDecimal(0.1) 接收的是已经近似的二进制浮点数，会保留该近似值；用字符串 new BigDecimal("0.1") 或 valueOf 更符合常见十进制意图。1.0 与 1.00 的 equals 为 false，因为 scale 不同；compareTo 为 0，因为数值相同。1 / 3 若不指定可接受的精度或舍入策略，可能因无限小数抛异常。金额示例可以要求结果保留两位并显式使用 HALF_UP，但实际舍入规则应来自业务，不是所有金额都一律四舍五入。

#### 60–90 秒口述（手册版）

Builder 通过可变存储减少连续追加时的复制，要区分有效长度和预留容量，且不要让多个线程无同步共同修改。Integer 的双等号可能比较引用，缓存只是实现优化，数值判断应明确使用 equals 或安全拆箱。BigDecimal 应从十进制文本或合适的 valueOf 创建，注意 equals 还比较 scale，除法也要明确精度和舍入，不能把金额规则交给默认行为。

#### 手册追问

- 循环里用了 Builder 就没有新对象吗？扩容、toString 和循环中其他表达式仍可能分配，不能只看变量类型。
- BigDecimal.equals 与 compareTo 哪个好？去重和 Map 键应明确 scale 是否属于身份；数值大小比较一般用 compareTo。

### 二、深挖补充（2026-10-06 会话笔记）

#### 2.1 前半句：StringBuilder 连"单方法"都不原子

一次 `append(str)` 看着是一行，内部至少三步：

```
① ensureCapacity(count + len)   ← 可能新建数组、复制旧内容
② 把 str 拷进内部数组的 count 位置
③ count += len
```

两个线程并发 append，三步任意交错都会出事：**丢更新**（都读到 count=5，都往位置 5 写，互相覆盖）；**扩容竞态**（A 正在换新数组，B 还往旧数组写 → 数据丢失或 ArrayIndexOutOfBoundsException）；**计数错乱**（count 加了两次、数据只写成一份，有效长度里混垃圾字符）。

#### 2.2 后半句：StringBuffer 锁了每个方法，锁不住"两个方法之间"

StringBuffer 每个方法都 synchronized——**单次调用原子**。但"检查再追加"是两次独立调用，中间有锁已释放的空档：

```java
if (sb.length() < 10) {      // 调用 1：原子
    sb.append("xxxxxx");     // 调用 2：原子，但与调用 1 之间没有原子性
}
```

时间线：线程 A `length()=5 ✓` → 线程 B `length()=5 ✓` → A append → B append → 长度 15，"不足 10 才追加"的意图被击穿。每一次方法调用都完美原子，**但业务规则活在"两次调用"这个跨度上，那里没有任何保护**。修复：`synchronized(sb) { if (...) sb.append(...); }` 把锁的边界扩到和业务规则一样大；更好的做法是设计上绕开（每线程一个 Builder 最后合并）。

#### 2.3 统一理论：JDK 原子性两档 + 复合动作三类 + 出路三条

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

### 三、与其他题的连线

- Q22（CHM 与事务）：本章 2.2 的"单方法原子 vs 复合动作"与 Q22 的"单键原子 vs 跨键事务"是同一条边界线——容器的线程安全承诺永远只到单次操作。
- Q18（HashMap）：HashMap 在第一档（连单方法都不原子），并发场景直接换 CHM。
- Q14（String）：StringBuilder 可变共享的事故，反向解释 String 为什么设计成不可变。

---

## 03 · subList、迭代器、fail-fast（Q17）【P1】



> 第一部分完整收录手册解释版 Q17 原文；第二部分是 2026-10-06 会话深挖：modCount 是否有上限、SubList"账本+抄本+对账"的源码级机制（JDK 25 ArrayList.java 行号可查）。

### 一、手册原文（解释版）

#### ① subList 是视图，通常不是复制

对父列表 [A,B,C,D] 调用 subList(1,3)，视图为 [B,C]。视图 set(0,X) 会把父列表变成 [A,X,C,D]；通过视图删除也会修改父结构。父列表在视图外发生结构修改后，继续使用原视图可能失效或抛 ConcurrentModificationException。视图可能保留父列表及其大数组，长期留存小切片应考虑 new ArrayList<>(view) 创建独立容器，但元素对象仍是同一批引用。

#### ② fail-fast 是查错机制，不是并发协议

迭代器通常记录创建时的修改计数，遍历中比较 modCount 与期望值来尽早暴露非法结构修改。这是尽力检测，不能承诺所有并发错误都被捕获，也不提供跨线程可见性。教学例：增强 for 中直接 list.remove，后续迭代可能抛异常；使用 iterator.remove 则会正确更新该迭代器的期望计数。批量删除也可用 removeIf。

#### ③ 固定长度和不可修改不同

Arrays.asList 由原数组支持，允许 set，通常不允许 add/remove；改变数组内容也影响列表。JDK 9 起的 List.of 不允许修改，也不接收 null。Collections.unmodifiableList 是包装视图，底层列表仍可能被别处修改；不可修改容器也不冻结元素对象。接口的修改能力、存储共享和元素可变性应逐层判断。

#### 60–90 秒口述（手册版）

subList 通常共享父列表存储，修改会关联，还可能因为持有父结构而保留大数组；要独立数据应复制。fail-fast 靠修改计数尽力发现不合规结构修改，不能代替同步，遍历删除应使用迭代器或批量 API。Arrays.asList 是由数组支持的固定长度列表，List.of 是不可修改列表，包装成只读视图也不能保证底层或元素完全不变。

#### 手册追问

- list.set 为什么通常不触发结构修改异常？它只替换元素，不改变列表长度或结构；具体计数行为仍取决于实现。
- 复制 subList 后元素也独立了吗？仅复制容器引用，若元素可变，双方仍可能看见同一元素的修改。

### 二、深挖补充（2026-10-06 会话笔记）

#### 2.1 三个点的最小实验

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

#### 2.2 modCount 会不会触发上限？

modCount 是普通 int（AbstractList.java:630，JDK 25），Java int 溢出是**无声回绕**：数到 21.47 亿后变负继续，不抛异常不清零。所以不存在"上限触发"。

回绕无害的原因：检查是裸的 `!=`（ArrayList.java:1095 `if (modCount != expectedModCount)`），回绕后的值照样对不上、照样抛 CME。唯一的漏检窗口：迭代器活着期间列表恰好被结构修改 **2³²（约 42.9 亿次）** 的整数倍——绕一整圈回到期望值。每秒百万次修改也要 70 多分钟不间断，且迭代器还得一次 next() 都不调，实践不可达。真正要注意的是：modCount **非 volatile**（跨线程可见性无保证——fail-fast 不是并发协议的物理基础），以及它非并发计数（size 用原子变量，另一套）。

#### 2.3 账本 + 抄本 + 对账：一个协议、三处复用

modCount 本质是"结构变动流水号"。所有需要"记住位置"的东西按同一个三步协议工作：**创建时抄一份流水号 → 使用前对账 → 对不上抛 CME**。这个协议被复制到三处：

1. **ArrayList 自己的迭代器（Itr）**：抄 `modCount`，next() 前查 `modCount != expectedModCount`（:1095）。
2. **SubList**：它没有自己的存储，只是"父列表 + offset"的透镜——`get(0)` 实际执行 `root.elementData[offset + 0]`。父列表一动，offset 全错。所以它对账的对象是**根列表的账**（:1497 `if (root.modCount != modCount)`）。"视图外改父列表 → 视图作废"不是为了保护用户，是它自救：不对账它自己就会取错元素。
3. **HashMap/HashSet**：不继承 AbstractList，拿不到那个字段，于是**另立一本同款 `transient int modCount`**，HashIterator 创建时抄、nextNode() 前对账。HashSet 包着 HashMap，共用一本。

#### 2.4 SubList 的源码证据（JDK 25 ArrayList.java）

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

#### 2.5 全图与统一规律

```
root.modCount ──────────────── 唯一真账（ArrayList）
   ↑ 读前对账        ↑ 写后对齐
SubList.modCount ───────────── 视图的抄本
   ↑ 读前对账        ↑ 写后对齐
iterator.expectedModCount ──── 迭代器的抄本
```

统一规律：**所有结构性写操作，最后一步把抄本对齐真账；所有依赖位置的操作，第一步检查抄本是否等于真账。** 自己人写 → 写完顺手对齐 → 下次对账通过（合法）；外人写 → 没人对齐 → 对账失败 → CME（作废）。通过 sub 增删合法、视图外增删作废，物理原因就在这。

### 三、与其他题的连线

- Q18（HashMap）：HashMap 也在"另立一本账"的名单里（modCount 机制同款），且它的迭代器同为 fail-fast。
- Q21（CHM）：对照记忆——CHM 迭代器是**弱一致**（不抛 fail-fast），因为它的并发定位就不是"检测非法修改"而是"容忍并发演进"。
- Q15（Builder）：迭代是复合动作、synchronizedList 要求外部同步，出自同一条"复合动作自己负责"的边界线。

---

## 04 · HashMap put/get、扩容（Q18）【P0】



> 第一部分完整收录手册解释版 Q18 原文；第二部分是 2026-10-06 会话的位级走查与扩展。

### 一、手册原文（解释版）

#### ① 先按散列缩小范围，再比较键

JDK 8 HashMap 用数组保存桶，桶内主要是链表或红黑树。键的 hashCode 经高低位扰动后，以 (n-1)&hash 定位；容量取二的幂，让掩码运算可覆盖全部桶。get 找到桶后，还要核对散列以及引用相同或 equals 相等。put 匹配已有键就更新值，不匹配才插入节点；因此碰撞不等于覆盖。

例如容量16，掩码15的二进制是1111，可保留散列低四位并覆盖0–15；容量10若仍直接用掩码9，即1001，只会产生0、1、8、9等下标，很多桶根本用不上。这是当前掩码算法要求二次幂的原因，不是所有哈希表都必须使用二次幂。高低位扰动还帮助利用原hashCode的高位信息。

#### ② 容量、数量、阈值各有作用

capacity 是桶数组长度，size 是映射数量，扩容阈值通常是容量乘负载因子。默认构造并不一定马上分配数组，第一次 put 才初始化。增加映射超过阈值时扩容，是用更多桶缓解碰撞；代价是分配数组并重新分布节点，不能认为一次 put 永远常数耗时。预设容量要考虑负载因子，而不是把预计元素数直接当最终桶数。

#### ③ 扩容为什么只需检查一位

教学例：容量从 16 变 32，旧下标为 hash&15，新下标为 hash&31。如果 hash 的 16 这一位为 0，节点仍在原下标；为 1，则去原下标加 16。旧桶里的 hash 为 3 和 19 的节点，原来都在桶 3，扩容后分别到 3 和 19。节点已保存散列，无需再次调用用户键的 hashCode。HashMap 不支持无同步并发写；JDK 7 头插转移的历史环链问题不能当作 JDK 8 同一路径的解释，但 8 仍存在数据丢失与错误观察风险。

#### 60–90 秒口述（手册版）

HashMap 先扰动键散列，用二次幂容量的掩码确定桶，再比较键判断是更新还是新增。size 超过扩容阈值时通常翻倍。翻倍后旧桶只会拆到原位置和原位置加旧容量，因为新掩码仅多开放一位，保存的散列就够用，不必重新算键的 hashCode。一次 put 可能承担扩容成本，且这些内部机制没有让 HashMap 自动具备并发安全。

#### 手册追问

- 为什么容量要二的幂？配合掩码均匀定桶和翻倍拆分，若任意容量直接用此掩码，会漏掉部分下标。
- get 返回 null 能证明没有键吗？不能，HashMap 允许 null 值；可用 containsKey 区分映射存在但值为空。

### 二、深挖补充（2026-10-06 会话笔记）

#### 2.1 定位两步走的位级细节

```java
hash = h ^ (h >>> 16);      // 第一步：扰动，高 16 位异或进低 16 位
index = (n - 1) & hash;     // 第二步：掩码定位
```

**为什么扰动**：掩码只用低位。若一批键的 hashCode 只在高 16 位不同、低位全同（整数键常见），低位掩码会疯狂碰撞。扰动把高位信息"搬"进低位：

```
h₁ = 0x00010001   h₁ ^ (h₁>>>16) = 0x00010000
h₂ = 0x00020001   h₂ ^ (h₂>>>16) = 0x00020003
低位原本相同（…0001）→ 扰动后 0000 vs 0011，分开了
```

get 的下半场：定位到桶后逐节点核对——先比 hash（便宜），再比 `key == k || key.equals(k)`。所以**碰撞 ≠ 覆盖**：put 遇到 equals 相等的键才更新 value，否则同桶追加成链。

#### 2.2 三个量与预设容量法则

| 量 | 是什么 | 默认值 |
|---|---|---|
| capacity | 桶数组长度 | 16（首次 put 懒分配） |
| size | 实际键值对数 | 0 |
| threshold | 扩容线 ≈ capacity × 0.75 | 12 |

两个后果：触发扩容的那次 put 承担重建成本（均摊 O(1)、单次可能很贵）；**预设容量要除以负载因子**——想放 1000 条，`new HashMap<>(1000)` 会在约 768 条时扩容，传 `1000/0.75 ≈ 1334` 才能全程不扩。

#### 2.3 扩容只查一位的完整推导

容量 16 → 32，掩码从 `01111` 变 `11111`——**只多开放一位**（第 5 位，值 16）。所以新下标只有两种可能：

```
hash = 3  = 00011 → &15 = 3；第5位=0 → 新下标 = 3    原地不动（lo 链）
hash = 19 = 10011 → &15 = 3（高位的1被掩掉）；第5位=1 → 新下标 = 19 = 3+16（hi 链）
```

扩容时每个旧桶拆成两条链：这一位是 0 的留原地，是 1 的搬去 +16。**不用重算 hashCode**——Node 构造时就存了 `final int hash`，只看那一位。源码里的判据就是 `(e.hash & oldCap) == 0`。

#### 2.4 JDK 7 环链的正确说法

JDK 7 头插法转移 + 并发扩容会成环链 → get 死循环 CPU 100%。JDK 8 改尾插后不再成环，**但 HashMap 依然线程不安全**——并发写照样丢数据、覆盖更新。面试口径：别拿 7 的环链解释 8；要线程安全换 ConcurrentHashMap，其扩容协作（ForwardingNode、lo/hi 拆链）正是这套算法的并发版。

### 三、与其他题的连线

- Q21（CHM）：CHM 扩容"lo/hi 拆两条链"与本章 2.3 是同一算法；HashMap 的 `modCount` 账本与 Q17 同款。
- Q22（CHM 与事务）：HashMap 在"连单方法都不原子"的第一档。
- Q14（String）：键的 equals/hashCode 契约就是 Q14 第 13 题"可变键"问题的落点。

---

## 05 · ConcurrentHashMap 读写、扩容（Q21）【P0】



> 第一部分完整收录手册解释版 Q21 原文；第二部分是 2026-10-06 会话深挖：compute 方法家族的执行流程、ForwardingNode 的位级解释。

### 一、手册原文（解释版）

#### ① JDK 8 把写竞争限制在桶附近

空桶安装首节点通常通过比较并交换，即 CAS，只有一个线程能成功建立入口；失败者重读。非空桶写入通常同步桶头，并重新确认它仍是当前桶头，再在链或树内更新。不同桶可并行处理，不是把整张表锁住；树桶还有专门协调逻辑。JDK 7 的 Segment 分段锁模型不能直接用来解释 8。

#### ② 读为何通常不拿写入的桶锁

表槽访问以及节点的关键字段提供所需可见性，读者能沿已经安全发布的链接读取。仅说 table 是 volatile 不够：volatile 数组引用保证的是引用的读写，不会自动让每个数组槽变成 volatile。实现必须对槽位使用相应的原子或有序访问，并为节点值、链接等安排可见性。通常不获取该桶的写锁，不等于"任何路径都绝不等待"。

#### ③ 扩容可以让多个线程协作

教学例：旧桶已搬到新表，旧槽放 ForwardingNode，读者遇到它转向新表，写线程也可能加入搬迁。sizeCtl 在初始化、正常阈值和扩容阶段承担不同控制含义，不能永远解释成容量。元素计数为降低竞争可分散累加；并发时 size 只能作为观察统计。比如刚看到 size 为 10，再遍历不保证正好取得同一组十条记录；跨键结算不能靠 size 和一次遍历拼出事务快照。

#### 60–90 秒口述（手册版）

JDK 8 的 ConcurrentHashMap 空桶常用 CAS 安装，非空桶写入在桶头附近同步并重新检查，减少不同桶之间的竞争。读依靠表槽和节点的可见性机制通常不拿写锁，不能只用 table 引用是 volatile 来解释元素可见性。扩容用转发节点指向新表，并允许其他线程协助转移。size 是并发统计，读写安全也不意味着多键操作具有事务快照。

#### 手册追问

- 为什么锁住桶头后还要重检查？等待锁时桶可能已经搬迁或替换，不能在过时结构上继续写。
- 遍历会抛 fail-fast 异常吗？其迭代是弱一致观察，可见部分并发更新，不承诺固定时点快照。

### 二、深挖补充（2026-10-06 会话笔记）

#### 2.1 compute 方法家族：一个骨架的五种变体

JDK 8 给 Map 加的这组方法，骨架都是四步：**查旧值 → 判断条件 →（可能）调回调 → 写结果**，区别只在中间两步。统一判断矩阵：

| 方法 | 键不存在时 | 键存在时 | 回调返回 null 的含义 |
|---|---|---|---|
| `compute` | 调回调（oldValue=null），结果非 null 就插入 | 调回调，非 null 覆盖 | **删除该键** |
| `computeIfAbsent` | 调回调，非 null 插入 | **不调回调**，返回旧值 | 不插入（等于没存过） |
| `computeIfPresent` | 不调回调，返回 null | 调回调，非 null 覆盖 | **删除该键** |
| `merge` | 不调回调，直接放传入 value | 调回调(旧值, 新值) | **删除该键** |
| `putIfAbsent` | 直接放 value | 不放，返回旧值 | （无回调） |

两个易踩差异：compute 系回调参数是 (key, 旧值)，merge 是 (旧值, 新传入值)，顺序不同；putIfAbsent 返回旧值，compute 系返回该键最终新值。在 HashMap 上这些方法仍是两步（get+put）**不原子**——原子性是 CHM 重写后塞进桶锁的结果，"用了 computeIfAbsent 就线程安全"必须先问是什么 Map。

#### 2.2 compute 在 CHM 里的执行流程

```
1. 算 hash，定位桶
2. 桶为空 → CAS 放占位节点（ReservationNode，因为值要等回调跑完才知道），
   锁占位节点，跑回调，换成真节点
3. 桶头是 ForwardingNode → 正在扩容，先帮忙搬数据，回头重试
4. 桶头是普通节点 → synchronized(桶头)，锁内重新在链/树上找一遍该键
   （防止锁上前被改），拿到旧值 → 跑回调 → 写回结果
5. addCount 更新 size（分散计数）
```

这就是 Q21 答案"空桶常 CAS 安装，非空桶同步桶头并重新检查"的执行流。整个"查→算→写"在锁内完成，所以单键读改写原子；**但换一个键的第二次 compute 就在另一把桶锁里**——这就是 Q22"单次原子边界"的物理来源。

回调约束（Q22②的展开）：回调持桶锁执行，必须**短**（查库/RPC 会阻塞同桶所有线程）、**可重算**（返回 null 不建映射、抛异常不留结果、刚算完被删都会导致回调再跑一遍，副作用必须可重复）、**不递归**（回调里再 compute 同 Map 可能死锁，JDK 9+ 抛 IllegalStateException: Recursive update）。

#### 2.3 ForwardingNode：扩容期的哨兵节点

```java
static final int MOVED = -1;   // 特殊 hash 值
static final class ForwardingNode<K,V> extends Node<K,V> {
    final Node<K,V>[] nextTable;   // 指向扩容后的新表
    // hash = MOVED(-1)，没有 key、没有 value
}
```

本质是**墓碑 + 转发指针**。扩容把旧表桶逐个搬到 2 倍新表，搬完的旧槽不能放 null（并发读会误判"键不存在"），所以放 ForwardingNode。撞上它时：

- **读**：顺着它持有的 nextTable 引用到新表找（ForwardingNode.find()），全程无锁、不阻塞、不重试
- **写**：这个桶写不进去了；线程检查 sizeCtl 发现扩容还在进行，就**加入搬桶大军**（经 transferIndex 认领一段桶区间），搬完在新表重试——"把等待变成帮忙"

sizeCtl 是状态机：正数=阈值，-1=初始化中，其他负数（带扩容戳）=扩容中+参与线程数。

配套追问：**扩容时桶怎么搬**——按新掩码多出的那一位把桶拆成 lo（0，留原位）/hi（1，搬 +16）两条链，与 Q18 的"只查一位"是同一算法。**get 为什么不加锁**——Node 的 val 和 next 是 volatile，靠可见性遍历。

### 三、与其他题的连线

- Q22：本章 2.2 的"另一把桶锁"就是 Q22"多键无事务"的物理来源。
- Q18：扩容拆 lo/hi 与 HashMap"只查一位"同源；CHM 禁 null 键值 vs HashMap 允许 null，一组对仗。
- Q17：CHM 迭代是弱一致、不抛 fail-fast——它不靠 modCount 账本，定位就是容忍并发演进。

---

## 06 · CHM 能替代业务事务吗（Q22）【P1】



> 第一部分完整收录手册解释版 Q22 原文；第二部分是 2026-10-06 会话深挖：这道题为什么存在（它抓住的是哪个真实设计失误）、转账反例的完整推演。

### 一、手册原文（解释版）

#### ① 原子方法保护明确的单次边界

CHM 即 ConcurrentHashMap。putIfAbsent 可原子地"没有才放"，compute 可把同一键的读、计算、更新放到受控范围内。普通 get 后再 put 仍是两步，其他线程能插入其中。若值是可变对象，把它放在并发 Map 中不会自动保护对象内部字段；两个线程取出同一个 ArrayList 后 append，仍需单独同步。

#### ② 多键约束需要另外的机制

教学例：A 账户减 10、B 账户加 10，哪怕两次 compute 分别原子，中间仍可能被读取到只扣未加，第二步失败也没有自动回滚。要维护跨键不变量，可以用共同锁、不可变整体状态加原子替换，或在数据库事务中完成，具体取决于共享范围。跨进程场景中的内存 Map 更不承担持久化和分布式事务。

#### ③ 计算回调不是永久只执行一次的缓存承诺

computeIfAbsent 在缺映射时协调计算，但回调返回 null 就不建立映射，抛异常也不留下成功结果，删除后再次请求还会重算。回调应短且不递归修改相关映射，慢查库可能占用桶附近的协调路径。查库成功不等于缓存永远最新，仍要处理版本和失效竞态。CHM 禁止 null 键和值，让 get 的 null 可以清晰表达当前没有映射。

#### 60–90 秒口述（手册版）

ConcurrentHashMap 保证它定义的单次操作边界，例如同键的 putIfAbsent 或 compute，但两个 get 和 put 不会自动合成原子操作，多键转账也没有自动回滚。值对象自身的修改仍需同步。computeIfAbsent 适合短计算，返回 null、异常或删除后都可能再次执行；不能把它当永久只查一次库的保证。业务事务应围绕完整不变量选择锁或数据库事务。

#### 手册追问

- compute(k,(key,v)->v+1) 能解决计数丢失吗？对该键且所有更新都使用兼容原子路径时可以，但不保护其他键。
- 为什么不在回调里调用慢接口？会延长相关键或桶的协调时间，并引入失败、重试和递归更新风险。

### 二、深挖补充（2026-10-06 会话笔记）

#### 2.1 这道题为什么存在：它抓住一个真实的设计失误

真实系统里很多操作就是"改内存里的一个 Map"：幂等去重、计数器、本地缓存、简单状态流转。于是有开发者会想：**"CHM 的 compute 是原子的，那我这套业务逻辑岂不是很安全？是不是连数据库事务都不用开了？"**

面试官问"CHM 能替代业务事务吗"，就是问这个想法对不对。这不是把两个平级的东西做比较，而是抓住一条容易混淆的边界：**线程安全 ≠ 事务一致性**。

- CHM 解决的问题：多线程同时改共享数据时，数据结构不被改坏、单次操作不丢更新——**并发安全**
- 事务解决的问题：一组业务动作作为整体，面对崩溃和并发保持业务一致——**一致性**

前者是后者的前提之一，但远远不是后者本身。

#### 2.2 转账反例的完整推演

用内存 Map 做一笔支付，业务上是三个动作：

```java
map.put(orderId, "已支付");        // 1. 订单标记已支付
map.compute(账户, 扣除保费);        // 2. 扣钱
map.put(保单号, "生效");            // 3. 保单生效
```

每一步单看都线程安全（compute 有桶锁）。但：

- **故障**：第 2 步前进程崩了 → 订单已"已支付"、钱没扣。第 1 步无法撤销——CHM 没有"回滚"概念，甚至不知道这三个 put 属于同一笔业务。
- **并发可见**：没崩，但另一线程在第 1、2 步之间读状态 → 看到"订单已支付、账户未扣"。CHM 对跨操作的隔离没有任何承诺。

这两个问题正是**事务**要解决的：要么全提交、要么全不提交，中间态不可见，出错整体回滚。

#### 2.3 结合保险金融背景的答题路径

这个题正好接自己的项目经历："为什么账务流水必须落库、用数据库约束兜底，内存结构只能做加速层"。标准答法：

> 不能。CHM 的原子性只到单键单操作；业务事务要的是跨多步、跨资源的原子性、隔离性和可回滚性，CHM 没有。内存 Map 只能承载**单键语义**的场景——计数、去重、缓存；涉及钱、状态流转的多步一致性必须落数据库事务（或 Outbox/TCC），配合事件 ID 唯一约束在同一个事务里去重并变更业务，提交后 ACK；外部接口另带幂等键；账务约束和对账兜底。

注意最后半句也是考点：CHM 并非不能用于业务，**能用在哪、边界在哪**才是这题的核心。

#### 2.4 手册追问②"为什么不在回调里调慢接口"的展开

computeIfAbsent 的回调持桶锁执行。回调里查库/RPC 意味着：同桶所有其他线程被阻塞的时长 = 慢接口耗时；慢接口失败时账已动还是没动说不清；回调里重试可能触发递归更新检查。所以规范姿势是"回调放轻计算，慢 IO 放外面 + 二次确认"，或者干脆查库写缓存用"版本 + 失效"策略而不是指望回调原子。

### 三、与其他题的连线

- Q21：本文所有结论的物理来源是 Q21 的桶锁粒度——"另一把桶锁"之间没有保护。
- Q15：StringBuffer 的"检查再追加"与本文"跨键转账"是同一条边界线的两个表现；JDK 三条出路（compute 化/自己加锁/状态坍缩）在这里对应"共同锁/不可变整体状态+原子替换/数据库事务"。
- Q18：HashMap 连单方法都不原子，第一档；CHM 单方法原子，第二档——复合动作两档都不保。

---

## 07 · 延伸专题：synchronizedXxx、RandomAccess、协变与擦除



> 本文是 2026-10-06 会话中从 Q17/Q18 讨论延伸出的三个专题笔记，源码均验证自本机 OpenJDK 25。

### 一、Collections.synchronizedXxx：装饰器模式 + 一堵 synchronized 墙

#### 1.1 机制

同步逻辑不在工厂方法里，在 `Collections` 的私有内部类（JDK 25 Collections.java:2287 起）：

```java
static class SynchronizedCollection<E> implements Collection<E>, Serializable {
    final Collection<E> c;   // 被包的真实集合
    final Object mutex;      // 锁对象
    SynchronizedCollection(Collection<E> c) {
        this.c = Objects.requireNonNull(c);
        mutex = this;                                  // ★ 默认拿包装器自己当锁
    }
    public int size() {
        synchronized (mutex) { return c.size(); }      // 每个方法：抢 mutex → 转发
    }
    public Iterator<E> iterator() {
        return c.iterator(); // Must be manually synched by user!
    }
}
```

没有魔法，就是**每个方法 `synchronized(mutex)` 后转发**。工厂方法只按能力选壳：`list instanceof RandomAccess ? new SynchronizedRandomAccessList<> : new SynchronizedList<>`（保留标记，见专题二）。

#### 1.2 三个关键细节

1. **mutex = this**：迭代时要 `synchronized (返回的list)` 才有效——必须抢同一把锁。
2. **iterator() 故意不同步**：迭代器交出去之后 wrapper 失控，就算每次 next() 上锁也护不住"hasNext 到 next 之间"。源码注释明说 "Must be manually synched by user!"。
3. **绕道陷阱**：谁手里攥着原始引用，谁就绕开全部同步——`raw.add(...)` 完全不过锁。

对照 Q15 的理论：这类包装器把"单方法原子"这一档补齐了，复合动作（尤其迭代）仍然自己负责。

### 二、RandomAccess：贴在类型上的性能标签

#### 2.1 它是什么

```java
public interface RandomAccess {
}   // 整个接口体就是空的
```

**空标记接口**——用"类型"本身携带一条性能承诺：`get(i)` 近似 O(1)。ArrayList/Vector/CopyOnWriteArrayList/Arrays.asList 结果都有标记；LinkedList 没有（get(i) O(n)）。同一家族：Serializable、Cloneable——注解诞生前的"类型级元数据"，好处是参与 instanceof、重载和编译期检查。

#### 2.2 解决什么问题

泛型算法拿到的是 List 接口，看不出底下是数组还是链表，而遍历策略性能天差地别（对 LinkedList 做 `for(i) get(i)` 接近 O(n²)）。JDK 里十几个算法按标记分支（binarySearch/shuffle/reverse/fill/copy/rotate/replaceAll，Collections.java 里十余处 `instanceof RandomAccess`）：

```java
if (list instanceof RandomAccess || list.size() < BINARYSEARCH_THRESHOLD) {
    // 下标直达版
} else {
    // 迭代器版：沿链前进，绝不每次从头走
}
```

注意 `|| size() < THRESHOLD`：**小列表不值得分支**，常数太小——"量小免优化"的工程判断本身也值得学。写自己的 List 装饰器时要把标记传下去（性能契约属于类型，换壳不换本质）。

#### 2.3 本质原因不是泛型擦除

擦除管的是"类型参数"（`List<String>` 与 `List<Integer>` 运行时同一个 Class）；RandomAccess 管的是"实现特征"（ArrayList 还是 LinkedList），与类型参数无关。反证：C# 泛型是真类型（无擦除），判断随机访问能力依然要运行时检查或接口拆分。真正的本质链：**一个 List 接口统一了数组背和链表背 → 接口只能约定行为、不能约定复杂度 → 运行时唯一信息通道是具体类型 → 空标记 + instanceof**。可选替代设计是子接口 `RandomAccessList extends List`，标记接口胜在正交（任何实现可自由贴标，不动继承树）。

### 三、数组协变与泛型不变：一条可推导的边界

#### 3.1 协变是一个赋值规则

`String[] strs; Object[] objs = strs;` 被允许——"装 String 的数组"可以冒充"装 Object 的数组"。此刻同一箱子上有了两个名字，两个承诺矛盾。事故路径：

```java
objs[0] = 42;              // 编译通过，运行时当场 ArrayStoreException —— 炸在写入点
List<Object> objs = strs;  // 若 List 也允许协变（实际不允许）：
objs.add(42);              // 编译通过
String s = strs.get(0);    // 💥 ClassCastException —— 炸在无辜的读取点
```

差别在**炸的位置**：数组每次写入有运行时核对（数组对象的类自带组件类型 `[Ljava.lang.String;`），错误停在作案点；泛型擦除后无检查可做，错误延迟到受害者。所以泛型唯一安全的选择是**不变**——把错误摁死在编译期。

#### 3.2 普遍规律与通配符

变型安全性由读写方向决定：**只读（生产者）→ 协变安全；只写（消费者）→ 逆变安全；可读可写 → 必须不变**。List 是读写双门接口，所以不变。通配符是"按方向开门"：

```java
List<? extends Number> read = listOfInts;   // 协变视图：读门开，写门被编译器焊死
List<? super Integer>  write = listOfNumbers; // 逆变视图：写门开，读只按 Object
```

相当于数组的协变去掉了 ArrayStoreException 版本——运行时检查被前移成编译错误（PECS 的由来）。补充：Java 是使用点变型（每次用通配符），Kotlin/C# 是声明点变型（`List<out T>` 定义一次全局生效）。

#### 3.3 泛型擦除的经典问题清单

证明擦除的最短代码：`new ArrayList<String>().getClass() == new ArrayList<Integer>().getClass()` → true。

编译期禁止五件事：`instanceof List<String>`；`new T()` / `new T[]`；泛型数组（数组协变+运行时检查的组合在擦除后无法实现，会留堆污染炸弹）；静态成员用类的 T；泛型类 extends Throwable / catch 泛型类型；`f(List<String>)` 与 `f(List<Integer>)` 重载撞车。运行期两个经典坑：反射破坏泛型后错误延迟到读取点（`List.class.getMethod("add", Object.class).invoke(list, "hello")` 打印正常、get 时才 CCE）；覆写泛型父类方法生成桥方法，反射/AOP 会看到两个签名。

**高级精确点**：擦除丢的是"实例的类型参数"——不是"对象不知道自己的类"（对象头 klass 指针永远精确指向真实类），也不是"声明处泛型没了"（字节码 Signature 属性里留着，所以 Jackson 的 `new TypeReference<List<User>>(){}` 能经 `getGenericSuperclass()` 读到——匿名子类是真实存在的类）。**擦除抹掉的是"某次实例化的实参"，它从未在运行时存在过。** 为什么这么设计：JDK 5 时代的迁移兼容——raw 集合代码不重编译就能混用。

### 四、与其他题的连线

- Q17：synchronizedXxx 的"单方法原子、迭代自己同步"与 fail-fast 同属一条"复合动作自己负责"的边界线。
- Q18/Q21：RandomAccess 分支选壳出现在 synchronizedList 工厂里；lo/hi 拆链是 HashMap/CHM 扩容的公共算法。
- Q14：Dedup 敢共享 byte[] 的前提是不可变——和泛型通配符"焊死危险门"是同一种思路：把不安全的操作在类型层面取消掉。
