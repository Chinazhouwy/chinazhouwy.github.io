---
title: "线上 Java 应用频繁 Full GC + CPU 飙升，完整的排查思路和调优步骤是什么？用哪些工具？找到问题后怎么验证？"
date: "2026-05-28"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "线上 Java 应用频繁 Full GC + CPU 飙升，完整的排查思路和调优步骤是什么？用哪些工具？找到问题后怎么验证？"
tags:
schema_version: "1"
question_id: "5"
question: "线上 Java 应用频繁 Full GC + CPU 飙升，完整的排查思路和调优步骤是什么？用哪些工具？找到问题后怎么验证？"
sources:
  - "unknown"
score: "4/10"
round: "R0"
next_review: "unknown"
session_id: "unknown"
---

## 第 5 题 · （待补充）

**题目**：线上 Java 应用频繁 Full GC + CPU 飙升，完整的排查思路和调优步骤是什么？用哪些工具？找到问题后怎么验证？

### 用户回答（摘要）

> 对象频繁创建销毁，CPU 飙升大概率是线程死循环。先看服务器运行日志，然后 jstack 看线程锁，dump 日志看大对象频繁创建，根据思路处理。

### 评分：4/10

### 扣分点

1. 没有完整排查流程，思路碎片化（-2）
2. 工具缺失：漏了 jstat、jinfo、MAT、jmap -histo（-2）
3. 没有说具体命令和分析方法（-1）
4. GC 调优参数未提及（-0.5）
5. 验证环节缺失（-0.5）

### 正确答案要点

**完整流程：jstat 定频率 → jstack 看线程 → jmap 看对象 → MAT 找泄漏 → 收集器调参 → 日志验证**

| 步骤 | 工具 | 做什么 |
|------|------|--------|
| 快速定位 | jstat -gcutil | 看 FGC 频率、OU 老年代使用量 |
| 线程分析 | top -Hp + jstack | 找 CPU 最高线程，定位代码行 |
| 堆分析 | jmap -histo:live | 看哪个类实例最多 |
| Dump 分析 | jmap -dump + MAT | Leak Suspects + Dominator Tree |
| 调优 | jinfo -flags | G1/ZGC 参数调整 |
| 验证 | jstat + GC日志 | 对比优化前后 FGC 次数和停顿时间 |

### 薄弱项

- [ ] jstat 命令（第一步就应该用）
- [ ] 完整排查流程（定位→分析→优化→验证）
- [ ] MAT 分析 dump 文件
- [ ] GC 参数调优（G1/ZGC 配置）

---
