---
schema_version: 1
question_id: 43
question: "JVM — 对象分配流程：TLAB、Eden、Minor GC、老年代晋升"
date: 2026-07-01
sources:
  - middleware/2026-06-01-jvm-core-principles-troubleshooting.md
  - java/jd-java-backend-round2-jvm-concurrency.md
  - java/megvii-java-round1-12-questions.md
score: "5/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
# 第43题：JVM — 对象分配流程：TLAB、Eden、Minor GC、老年代晋升

> 日期：2026-07-01
> 来源：`middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `java/jd-java-backend-round2-jvm-concurrency.md`; `java/megvii-java-round1-12-questions.md`

---

## 第一轮：初始回答

**得分：5/10** 😊

整体方向对：新生代→老年代、大对象直接进老年代。但漏了 TLAB、Eden:S0:S1 比例、具体分配流程链路。

---

## 核心概念

### 对象分配完整流程

```
new Object()
    │
    ▼
① TLAB 分配（线程私有，无锁）→ 放不下
    ▼
② Eden 区分配（CAS 竞争）→ Eden 满
    ▼
③ Minor GC（存活对象复制到 S0/S1）
    │ S0/S1 放不下 → 直接进老年代
    │ 放得下 → 年龄+1
    ▼
④ 年龄到 15 → 晋升老年代
```

### 关键术语

| 术语 | 英文全称 | 中文 | 作用 |
|------|---------|------|------|
| TLAB | Thread Local Allocation Buffer | 线程本地分配缓冲区 | 每个线程在 Eden 的私有区域，分配不用加锁 |
| Eden | 伊甸园 | 新生代主区域 | 新对象诞生的地方 |
| S0/S1 | Survivor 0 / Survivor 1 | 幸存者区 | GC 后存活对象暂存，来回复制过滤短命对象 |
| Minor GC | Young GC | 新生代垃圾回收 | 只清 Eden + Survivor，快，几毫秒~几十毫秒 |
| Full GC | — | 全堆垃圾回收 | 清整个堆（新生代+老年代），慢，要尽量避免 |
| STW | Stop The World | 停顿 | GC 时暂停所有应用线程 |

### 内存布局

```
堆内存
├── 新生代（33%，-XX:NewRatio=2）
│   ├── Eden（80%）← 新对象分配
│   ├── S0  （10%）← GC 后存活对象暂存
│   └── S1  （10%）← GC 后存活对象暂存
│
└── 老年代（67%）← 长期存活对象 + 大对象

Eden : S0 : S1 = 8 : 1 : 1（默认，-XX:SurvivorRatio=8）
```

### TLAB 详解

```
为什么需要 TLAB：
  没有 TLAB：多线程分配对象 → CAS 竞争 → 性能差
  有 TLAB：每个线程有私有缓冲区 → 无锁分配 → 快

默认开启：-XX:+UseTLAB（JDK 默认开启）
```

### S0/S1 的作用

```
过滤短命对象：
  大部分对象活不过 1-2 次 GC
  在 S0/S1 之间来回复制几轮就死了
  不用急着进老年代

两条晋升路径：
  ① 正常晋升：年龄到 15 次 → 老年代
  ② 提前晋升：Survivor 放不下 → 直接进老年代
```

### 大对象直接进老年代

```
-XX:PretenureSizeThreshold=3M（超过 3MB）
  → 不走 Eden，直接进 Old Generation
  → 避免大对象在 Eden 和 Survivor 之间复制
```

---

## 用户追问纠正记录

1. S0/S1 只参与"汇集"（GC 后存活对象暂存），不参与分配 → 正确
2. Survivor 放不下不会借 Eden 空间 → JVM 设计哲学是简单粗暴，直接进老年代
3. Eden = 分配区，S0/S1 = 收集区，用户总结精准
4. 8:1:1 比例是经验值，生产中观察 GC 日志有晋升问题再调

---

## 这次讨论的收获

- 对象分配：TLAB → Eden → Minor GC → S0/S1 来回复制 → 老年代
- Eden 管生，S0/S1 管活，老年代管老
- Survivor 放不下不会借空间，直接进老年代（JVM 设计哲学：简单粗暴）
- TLAB 是核心考点，完全没提到会扣分
- 8:1:1 是默认比例，生产中根据 GC 日志调整

## GPT 纠错

- GPT 纠错：TLAB、Eden、两个 Survivor、Minor GC 的描述主要适用于分代堆和特定收集器，不能当成所有 JDK、所有 GC 的统一流程。
- GPT 纠错：对象年龄 15 是常见上限而不是固定晋升年龄；HotSpot 会根据 Survivor 占用动态调整晋升阈值。
- GPT 纠错：`8:1:1` 是传统参数语义下的常见初始比例，实际布局会受收集器和 JVM Ergonomics 调整，不能笼统称为生产环境固定默认值。
- GPT 纠错：Survivor 空间不足时可能发生晋升或晋升失败等处理，但“放不下就全部直接进老年代”过度简化。
- GPT 纠错：`PretenureSizeThreshold=3M` 不是通用默认值，而且该参数并非对所有收集器都按相同方式生效。
