---
title: "Redis 的持久化方式有哪些？RDB 和 AOF 的区别是什么？10GB 内存用 RDB/AOF 分别有什么问题？生产环境怎么选？"
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
summary: "Redis 的持久化方式有哪些？RDB 和 AOF 的区别是什么？10GB 内存用 RDB/AOF 分别有什么问题？生产环境怎么选？"
tags:
schema_version: "1"
question_id: "3"
question: "Redis 的持久化方式有哪些？RDB 和 AOF 的区别是什么？10GB 内存用 RDB/AOF 分别有什么问题？生产环境怎么选？"
sources:
  - "unknown"
score: "5/10"
round: "R0"
next_review: "unknown"
session_id: "unknown"
---

## 第 3 题 · （待补充）

**题目**：Redis 的持久化方式有哪些？RDB 和 AOF 的区别是什么？10GB 内存用 RDB/AOF 分别有什么问题？生产环境怎么选？

### 用户回答（摘要）

> RDB 隔一段时间存快照，AOF append of 什么什么，把每条指令按顺序记录。RDB 可能卡顿，AOF 恢复慢。生产环境定时 RDB + 每天 AOF。

### 评分：5/10

### 扣分点

1. RDB 全称记错（Redis Database，不是 Remote Database）（-0.5）
2. AOF 全称记错（Append Only File，不是 append of）（-0.5）
3. fork() 内存翻倍问题未答出（-2）
4. AOF rewrite 机制未提及（-1）
5. 混合持久化（Redis 4.0+）未提及（-1）

### 正确答案要点

| 维度 | RDB | AOF |
|------|-----|-----|
| 全称 | Redis Database | Append Only File |
| 原理 | fork 子进程写快照 | 追加写每条写命令 |
| 恢复速度 | 快 | 慢（重放所有命令） |
| 数据安全 | 可能丢数据 | 取决于 fsync 策略；everysec 通常最多丢约 1 秒写入 |

- 10GB RDB 问题：fork() 写时复制，最坏内存翻倍 20GB+
- 10GB AOF 问题：文件可能几十GB，恢复重放很慢
- AOF rewrite：fork 子进程压缩冗余命令，生成精简 AOF
- AOF 刷盘策略：`always` 最安全但慢；`everysec` 常用，异常宕机可能丢约 1 秒写入；`no` 交给操作系统，性能高但风险更大
- 生产推荐：混合持久化（RDB 前缀 + AOF 增量），恢复分钟级

### 薄弱项

- [ ] RDB/AOF 全称
- [ ] fork() 内存翻倍
- [ ] AOF rewrite 机制
- [ ] 混合持久化

---
