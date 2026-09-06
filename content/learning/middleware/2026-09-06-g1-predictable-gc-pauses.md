---
title: "G1 回收器：如何把 GC 停顿变得可预测"
date: "2026-09-06"
domain: "学习"
area: "Java 后端"
module: "JVM 与性能调优"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "从 Region、逻辑分代、RSet/卡表、SATB 并发标记、Mixed GC 和停顿预测模型拆解 G1；重点厘清 IHOP 触发并发标记与进入 Mixed GC 的时序，并给出日志排查与参数使用边界。"
tags:
  - JVM
  - GC
  - G1
  - SATB
  - RSet
  - Mixed GC
  - GC 调优
  - 性能排查
source: "微信公众号「栏天百云」"
source_url: "https://mp.weixin.qq.com/s/RVAj9Nh-iFlsueWadl2Cdw"
published_at: "2026-09-06 16:13:16 +08:00"
---

# G1 回收器：如何把 GC 停顿变得可预测

> 原文标题：G1回收器：如何把GC停顿变得可预测
>
> 来源：微信公众号「栏天百云」·「JVM 与性能调优系列」第 7 篇
>
> 环境：原文未标明 JDK 版本；本文以 Oracle JDK 17 官方参数文档、Oracle G1 机制文档和本机 JDK 17 参数输出为核验依据。
>
> 发布时间：2026-09-06 16:13（北京时间）
>
> 原文链接：<https://mp.weixin.qq.com/s/RVAj9Nh-iFlsueWadl2Cdw>

## 一、先记住 G1 的一条主线

G1 不是“设置一个停顿数值，GC 就一定按时结束”。更准确的理解是：

```text
Region 化堆
  + 逻辑分代
  + RSet / 卡表追踪跨 Region 引用
  + SATB 并发标记
  + 按垃圾收益选择 Collection Set
  + 复制存活对象完成整理
  + 历史数据驱动的停顿预测
```

`-XX:MaxGCPauseMillis=200` 表达的是一个**软目标**。JVM 会根据历史回收成本，在预算内尽量选择合适数量的 Region；分配速率、存活对象数量、RSet 处理成本、CPU 竞争、Humongous 对象和晋升压力都可能让实际停顿超出目标。

## 二、Region：G1 的空间组织方式

G1 将 Java 堆切分成大量等大小的 Region。Region 大小是 2 的幂，范围为 1 MB—32 MB；默认值由堆大小以人体工学方式决定，目标是大约 2048 个 Region，并不是永远固定为 2048 个。

一个 Region 在不同时间可以承担不同角色：

- **Eden**：新对象分配区域；
- **Survivor**：Young GC 后暂存存活对象；
- **Old**：存放晋升或长期存活对象；
- **Humongous**：大于半个 Region 的对象，通常占用连续多个 Region，并走特殊路径。

G1 仍然使用分代思想，但年轻代和老年代主要是 Region 集合的逻辑划分，不是 CMS 那种连续的老年代空间。回收时，G1 把存活对象复制到新的 Region，同时完成整理，因此能够持续降低碎片风险。

## 三、RSet、卡表与写屏障：为什么不用扫描整个堆

Young GC 或 Mixed GC 只回收部分 Region，因此必须知道“没有被回收的 Region 中，哪些对象指向待回收 Region”。

G1 为 Region 维护 Remembered Set（RSet），记录来自其他 Region 的相关引用。应用线程写入对象引用时，写屏障会把对应内存卡标记为脏卡；后台 refinement 线程再处理这些卡表记录，更新 G1 所需的跨 Region 引用信息。

这换来了局部回收的能力，但也有成本：

- RSet 和卡表需要额外内存；
- 引用写入会触发写屏障；
- 脏卡积累和 RSet 更新会消耗并发线程、影响停顿；
- RSet 的实际大小和耗时与对象引用图、写入速率、JDK 版本有关，不能把“1%—20%”当成所有应用的固定开销。

## 四、一次并发标记周期和 Mixed GC 的关系

把“并发标记”和“混合回收”分成两个阶段理解最重要：

```text
Young GC
  ↓（某次 Young GC 可顺带完成 Initial Mark）
Root Region Scan
  ↓
Concurrent Mark
  ↓
Remark（STW，完成最终标记）
  ↓
Cleanup（统计空 Region、整理回收候选）
  ↓
后续 Mixed GC：Young Region + 部分 Old Region
```

几个阶段的职责：

1. **Initial Mark**：短暂 STW，标记 GC Roots 直接关联对象；在常见路径中搭在一次 Evacuation/Young Pause 上完成。
2. **Root Region Scan**：扫描 Survivor 等根区域到老年代的引用；需要在后续 Young GC 前完成。
3. **Concurrent Mark**：与应用线程并发遍历对象图，计算各 Region 的存活情况。
4. **Remark**：STW，处理并发期间的引用变化，完成最终标记。
5. **Cleanup**：统计回收收益、识别空 Region，并为后续回收准备候选集合；不同 JDK 版本的具体日志和停顿边界可能不同。
6. **Mixed GC**：在完成标记后，除了 Eden/Survivor，还挑选一部分收益较高的 Old Region 一起疏散和整理。

### IHOP 不等于 Mixed GC 立即开始

`-XX:InitiatingHeapOccupancyPercent`（IHOP）描述的是：老年代占用达到某个水平时，何时启动前几轮并发标记周期。它不是“达到 45% 就马上进入 Mixed GC”的开关。

更准确的链路是：

```text
IHOP 达到阈值
  → 启动并发标记周期
  → Remark / Cleanup 完成
  → 评估可回收 Old Region
  → 后续若干次 Mixed GC 按收益逐步回收
```

此外，`G1UseAdaptiveIHOP` 开启时，G1 会根据历史标记周期和分配预测自适应调整启动时机；不能只盯着手工设置的 45%。

## 五、SATB：为什么允许“浮动垃圾”

G1 的并发标记使用 SATB（Snapshot-At-The-Beginning，起始快照）思路：并发标记开始时，先把当时的存活关系视作快照。应用线程修改引用时，写屏障记录必要的旧引用，使原本在快照中可达的对象不会因为并发修改而被漏标。

结果是：

- 可能把标记开始后才变成垃圾的对象暂时当作存活对象；
- 这些对象称为**浮动垃圾**，通常留到后续周期处理；
- 设计原则是宁可多保留一部分垃圾，也不能错误回收仍然存活的对象。

可以这样对比：

| 维度 | G1 的 SATB | CMS 常见的 Incremental Update 表述 |
|---|---|---|
| 关注点 | 起始快照中的旧引用 | 并发期间新建立的引用关系 |
| 典型代价 | 可能产生浮动垃圾 | 重新标记阶段需要处理新增关系 |
| 目标 | 避免漏标活对象 | 避免漏标活对象 |

这里的“浮动垃圾”不是内存泄漏，而是并发标记的时间窗口带来的延迟回收。

## 六、停顿预测模型究竟做了什么

每次回收后，G1 会积累 Region 数量、存活对象复制量、扫描和处理耗时等历史信息。下一次构造 Collection Set 时，它会估计在停顿预算内能处理多少 Region，并优先选择垃圾多、回收收益高的 Region。

所以“可预测”应理解为：

- 在历史数据足够、资源状况相近时，停顿更容易控制；
- 目标是高概率满足，而不是硬实时保证；
- 突发分配、存活率陡增、RSet 爆发、Humongous 分配或 Evacuation Failure 都可能破坏预测。

## 七、关键参数：先理解语义，再决定是否改

下表的默认值以本机 Tencent Kona JDK 17 的 `-XX:+PrintFlagsFinal` 输出和 Oracle JDK 17 参数文档为准；不同 JDK、版本、平台和人体工学选择可能不同。

| 参数 | 本机 JDK 17 结果/常见语义 | 使用边界 |
|---|---|---|
| `-XX:+UseG1GC` | `true`（ergonomic） | JDK 17 默认使用 G1，但显式写出便于启动参数审计 |
| `-XX:MaxGCPauseMillis` | `200` | 软目标，不是最大停顿保证；设得过小可能牺牲吞吐 |
| `-XX:G1HeapRegionSize` | `1m`（ergonomic） | 可设 1—32 MB 的 2 的幂；通常先让 JVM 自动选择 |
| `-XX:InitiatingHeapOccupancyPercent` | `45` | 启动前几轮并发标记的初始阈值；不是 Mixed GC 立即触发值 |
| `-XX:+G1UseAdaptiveIHOP` | `true` | 开启后会根据历史周期自适应估算 IHOP |
| `-XX:G1ReservePercent` | `10` | 为降低晋升失败风险预留堆空间；增大它会减少可用堆 |
| `-XX:G1HeapWastePercent` | `5` | 可回收比例低于该值时，不启动 Mixed GC 周期 |
| `-XX:G1MixedGCCountTarget` | `8` | Mixed GC 回收 Old Region 的目标次数，不是硬性次数保证 |
| `-XX:MaxTenuringThreshold` | `15` | 自适应 GC 大小策略使用的最大晋升年龄上限；不要脱离 Survivor/晋升日志单独调 |

不建议直接复制原文中的“8G 堆固定模板”或把 IHOP 改成 35、Reserve 改成 15。更稳妥的顺序是：

1. 先确认 JDK 版本、收集器和人体工学参数；
2. 开启统一 GC 日志，观察 Young、Concurrent Cycle、Remark、Mixed、Full 的频率与耗时；
3. 结合分配速率、晋升速率、存活率和堆余量定位瓶颈；
4. 一次只改一个参数，压测并比较吞吐、P99/P999 延迟和 Full GC 次数。

## 八、GC 日志怎么读

Java 9+ 可使用统一日志：

```bash
-Xlog:gc*,gc+heap=debug,gc+phases=debug,gc+humongous=debug:file=gc.log:time,uptime,level,tags:filecount=5,filesize=100m
```

重点观察：

- `Pause Young (G1 Evacuation Pause)`：年轻代疏散停顿；
- `Pause Initial Mark`：初始标记，通常与一次疏散停顿关联；
- `Concurrent Cycle`：并发标记周期；
- `Pause Remark`：最终标记 STW；
- `Pause Cleanup`：清理阶段日志，具体表现随 JDK 版本变化；
- `Pause Mixed`：开始把部分 Old Region 纳入回收；
- `Pause Full`：G1 未能通过常规疏散/并发周期及时解决压力，需要重点排查。

### 常见现象与方向

| 现象 | 优先排查 |
|---|---|
| Young GC 很频繁、停顿不长但吞吐下降 | 分配速率、年轻代大小、对象短命分配和暂停目标是否过紧 |
| Mixed GC 启动太早 | IHOP、分配预测、`G1HeapWastePercent` 和老年代回收收益 |
| Mixed GC 启动太晚、接近 Full GC | 老年代增长速度、并发标记周期是否赶得上、堆余量和 Reserve |
| Humongous 日志频繁 | 大数组/大字符串/大缓冲区分配、Region 大小、对象生命周期 |
| `Pause Full` 增多 | 晋升失败、Evacuation Failure、堆空间不足、Humongous 压力或分配突发 |

## 九、勘误与补充

### 1. “IHOP 达到阈值就进入 Mixed GC” → 需要拆成两个阶段

- **原文容易造成的理解**：老年代达到 IHOP 后立即进入 Mixed GC。
- **更准确的表述**：IHOP 主要启动并发标记周期；完成 Remark/Cleanup 并评估 Old Region 后，后续回收才会进入 Mixed GC。
- **依据**：Oracle G1 指南对并发收集周期和 Mixed Collection 的阶段说明；Oracle JDK 17 `java` 参数文档对 `InitiatingHeapOccupancyPercent` 的定义。

### 2. “MaxGCPauseMillis=200 能把停顿控制在 200ms 内” → 这是软目标

- **原文容易造成的理解**：200ms 是硬上限。
- **更准确的表述**：这是 G1 的软目标，JVM 尽力达成，不能当成 SLA 保证。
- **依据**：Oracle JDK 17 `java` 参数文档明确写明 `MaxGCPauseMillis` 是 soft goal。

### 3. “G1 把堆切成约 2048 个 Region” → 是人体工学目标，不是固定数量

- **原文表述**：约 2048 个等大 Region。
- **补充**：默认 Region 大小按堆大小自动选择，目标约 2048 个；也可以通过 `G1HeapRegionSize` 显式指定 1—32 MB 的 2 的幂。
- **依据**：Oracle JDK 17 `java` 参数文档。

### 4. “RSet 约占堆 1%—20%” → 不宜作为通用常数

- **原文表述**：给出固定开销范围。
- **更稳妥的表述**：RSet、卡表和 refinement 线程确实有额外成本，但比例依赖引用图、写入速率、堆大小和 JDK 版本；应通过 Native Memory、GC 日志与实际停顿观测，而不是直接套百分比。
- **依据**：Oracle G1 指南对 remembered set/card table 的机制说明；范围属于经验值，不是 G1 的跨版本保证。

### 5. “Humongous 只在 Cleanup 或 Full GC 回收” → 必须带 JDK 版本前提

Humongous 对象大于半个 Region，分配和回收路径特殊，这是稳定事实；但具体回收时机、日志名称和实现细节会随 JDK 版本演进。生产排查不能只凭一篇旧版 G1 文章判断，应结合实际 JDK 版本和 `gc+humongous` 日志。

### 6. “G1 是 CMS 的正确答案” → 作为历史比喻可以，不能当作选型结论

G1 通过疏散复制兼顾整理和停顿目标，确实解决了 CMS 标记-清除带来的碎片问题；但它并非所有低延迟场景的最优选择。大堆、极低延迟或特定吞吐约束下，还要对比 ZGC、Shenandoah 或 Parallel GC，并以真实负载压测决定。

## 十、我的判断

这篇文章的主线是对的：G1 的价值不在某个“神参数”，而在 Region 化、按回收收益选择集合和历史数据预测停顿。真正容易误导初学者的是把几个相邻概念压成一句话：

```text
IHOP → 并发标记 → 候选 Region → Mixed GC
```

线上调优应优先回答三个问题：

1. 是分配太快，还是存活对象太多？
2. 是并发标记赶不上，还是疏散复制/晋升空间不够？
3. 停顿超标来自真正的 GC 工作，还是 RSet、Humongous、CPU 抢占和日志显示的其他阶段？

如果这三个问题没有被日志证据回答，直接复制 `-XX` 模板通常只是把问题从“看得见”变成“更难解释”。

## 十一、复习速记

```text
G1 = Region + 逻辑分代 + RSet/卡表 + SATB + Mixed GC + 停顿预测
Region 默认目标约 2048 个，大小 1—32MB 的 2 的幂，不是固定 2048
Humongous > 半个 Region，通常跨连续 Region，路径特殊
IHOP 先触发并发标记，不等于立即 Mixed GC
SATB 保护起始快照中的活对象，代价是浮动垃圾
MaxGCPauseMillis 是软目标，不是 200ms 硬上限
先看 GC 日志和分配/晋升数据，再改参数；一次只改一个
```

## 核验来源

- Oracle JDK 17 `java` 命令与 `-XX` 参数文档：<https://docs.oracle.com/en/java/javase/17/docs/specs/man/java.html>
- Oracle G1 机制说明（Region、预测模型、SATB、RSet、Mixed GC）：<https://docs.oracle.com/javase/8/docs/technotes/guides/vm/gctuning/g1_gc.html>
- Oracle JDK 17 可用垃圾收集器说明：<https://docs.oracle.com/en/java/javase/17/gctuning/available-collectors.html>

本机核验命令：`java -XX:+PrintFlagsFinal -version`（Tencent Kona JDK 17.0.17）。
