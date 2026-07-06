---
title: "MySQL — redo log、undo log、binlog + 两阶段提交"
date: "2026-06-28"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "MySQL — redo log、undo log、binlog + 两阶段提交"
tags:
schema_version: "1"
question_id: "37"
question: "MySQL — redo log、undo log、binlog + 两阶段提交"
sources:
  - "ai-agent/amap-agent-backend-intern-interview.md"
  - "java/cainiao-java-backend-round2-mysql.md"
  - "middleware/rocketmq-kafka-transaction-ordering.md"
score: "3/10"
round: "R0"
next_review: "unknown"
session_id: "unknown"
---

# 第37题：MySQL — redo log、undo log、binlog + 两阶段提交

> 日期：2026-06-28
> 来源：`ai-agent/amap-agent-backend-intern-interview.md`; `java/cainiao-java-backend-round2-mysql.md`; `middleware/rocketmq-kafka-transaction-ordering.md`
> 得分：3/10

---

## 得分

**3/10** 😐

知道 undo log 是回滚、binlog 是操作轨迹，但两阶段提交方向跑偏（以为是分布式事务），redo log 写入机制没答出来。

---

## 核心概念

### 三种 log

| 日志 | 归属层 | 作用 | 文件 |
|------|--------|------|------|
| **redo log** | InnoDB 引擎层 | 崩溃恢复（Crash Recovery）— 保证持久性 | `ib_logfile0/1` |
| **undo log** | InnoDB 引擎层 | 事务回滚 + MVCC — 保证原子性 | 共享表空间或独立 undo 表空间 |
| **binlog** | MySQL Server 层 | 主从复制 + 数据恢复 | `mysql-bin.000001` |

#### redo log（重做日志）
记录"对某个数据页做了什么修改"。WAL（Write-Ahead Logging）机制——数据刷盘前，redo log 必须先落盘。

**写入机制（三层缓存）：**
```
redo log buffer（内存）→ write() → OS Page Cache → fsync() → 磁盘
```

**`innodb_flush_log_at_trx_commit` 参数：**
- `1`（默认）：每次提交，buffer → OS Cache → fsync 刷盘。最安全但最慢
- `2`：每次提交 buffer → OS Cache，每秒 fsync。丢 1 秒
- `0`：每秒 buffer → OS Cache → fsync。最快但最不安全

#### undo log（回滚日志）
记录"修改前的数据"，是当前操作的逆向操作。两种用途：事务回滚 + MVCC 快照读。

**undo log 也会写 redo log**：因为 undo 表空间本身也是数据页，redo log 保护所有数据页的变更。

#### binlog（二进制日志）
记录所有修改数据库的操作事件。三种格式：STATEMENT / ROW（推荐）/ MIXED。

---

### 两阶段提交

**不是分布式事务**，而是 MySQL 内部 **redo log（InnoDB 引擎层）和 binlog（Server 层）之间的一致性协议**。

**流程：**
```
Prepare 阶段：
  ① redo log 写入 Prepare 记录并 fsync 刷盘
  
Commit 阶段：
  ② binlog 写入并 fsync 刷盘
  ③ redo log 写入 Commit 记录
```

**崩溃恢复规则：**
- binlog 有记录 → 事务必须提交（从库可能已复制）
- binlog 无记录 → 事务回滚

**先写 redo log Prepare→再写 binlog→再写 redo log Commit**，保证任何一步崩溃都能正确恢复。

---

## 用户追问纠正记录

1. fsync 是**同步**的，必须等磁盘确认才返回，不是异步
2. "undo log 也会写 redo log" 不是回滚时再写一条日志，而是 undo 表空间本身也是数据页，被 redo log 统一保护

---

## 这次讨论的收获

- 两阶段提交的核心是 redo log 和 binlog 的一致性问题，之前误以为是分布式事务
- redo log 三层缓存架构 + fsync 同步落盘机制
- undo log → redo log 的关系：摄像机拍剧本的比喻
