---
title: "JVM · G1/ZGC/CMS 区别与适用场景"
date: "2026-07-04"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "JVM · G1/ZGC/CMS 区别与适用场景"
tags:
schema_version: "1"
question_id: "51"
question: "JVM · G1/ZGC/CMS 区别与适用场景"
sources:
  - "middleware/2026-06-01-jvm-core-principles-troubleshooting.md"
  - "java/jd-java-backend-round2-jvm-concurrency.md"
  - "tencent/2026-05-27-tencent-cloud-final-round.md"
score: "5/10"
round: "R1"
next_review: "2026-07-09"
session_id: "unknown"
---

## 第51题 · JVM · G1/ZGC/CMS 区别与适用场景

**题目**：G1、ZGC、CMS 的区别和适用场景是什么？

### 用户回答

> 三个暂时不清楚，大概和新生代，老生代有关。

**得分：1/10**

扣分点：基本不会（-9）

### 最终修正版

| 收集器 | 设计目标 | 特点 | 适用场景 |
|--------|---------|------|---------|
| **CMS** | 低停顿 | 并发标记清除，有碎片，已废弃 | JDK 8 旧系统 |
| **G1** | 可预测停顿 | Region 化，Mixed GC，JDK 9+ 默认 | 4G-8G 堆，通用 |
| **ZGC** | 超低停顿（<10ms） | 染色指针 + 读屏障，TB 级堆 | 大堆、延迟敏感 |

三者都支持分代，G1 是分 Region 的分代，ZGC 在 JDK 21 后也支持分代。

**CMS**：并发标记清除，停顿 10-100ms，有碎片问题，JDK 14 移除

**G1**：堆切成 Region（1-32MB），优先回收垃圾最多的 Region，可设 `-XX:MaxGCPauseMillis=200`

**ZGC**：染色指针（64位高16位塞状态位）+ 读屏障（访问时自动修正引用），STW 只在根扫描阶段，<1ms

### 复习骨架

CMS 标记清除有碎片 → G1 Region化可预测停顿 → ZGC 染色指针+读屏障实现<1ms

---

## 回顾记录（2026-07-06 R1）

**得分：5/10**

### 用户回答
- CMS：先标记→remark→并发清理，适合老年代
- G1：分 Region，逻辑划分（新/老/survivor），标记复制，优先清理垃圾多的 Region
- ZGC：在 G1 基础上优化，用染色标记加速

### 扣分点
1. CMS 流程说对但缺少两次 STW 细节（-1）
2. G1 回答较完整（+1）
3. ZGC 关键错误：不是基于 G1 的优化，是独立实现（-2）
4. ZGC 染色指针+读屏障原理模糊（-2）

### 回顾收获
- ZGC 使用染色指针（Colored Pointers）+ 读屏障（Load Barrier），不是 G1 的升级
- CMS 有内存碎片和浮动垃圾问题，JDK 14 废弃
- G1 可预测停顿时间，Mixed GC 选择性回收 Old Region
