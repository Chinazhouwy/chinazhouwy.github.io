---
title: "分布式 · CAP/BASE/Raft"
date: "2026-07-02"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "分布式 · CAP/BASE/Raft"
tags:
schema_version: "1"
question_id: "44"
question: "分布式 · CAP/BASE/Raft"
sources:
  - "java/eleme-java-backend-round1.md"
  - "middleware/rocketmq-kafka-transaction-ordering.md"
  - "java/baidu-java-backend-round1-shezhao.md"
score: "5/10"
round: "R1"
next_review: "unknown"
session_id: "unknown"
---

## 第44题 · 分布式 · CAP/BASE/Raft

**题目**：CAP、BASE、Raft 怎么回答？和业务最终一致性有什么关系？

### R0 用户回答（2026-07-02）

> CP, 我刚刚在前面已经回答过了，是吧？P是分区容错，C是一致性，A是可用性。贝斯我不知道，Raft忘了，好像是某个协议吧。最终一致性是指说在流程运转过程中，可能有少量不一致或中间状态，但最终的状态是要保持一致的。

**得分：3/10**

扣分点：BASE 没答（-3）、Raft 没答（-3）、最终一致性理解太浅（-1）

### R1 用户回答（2026-07-04）

> CAP 是分布式的三个点，可用性，一致性，分区容错，不能同时实现；Raft 其实主挂了，从怎么选举，推选新的主出来的一个分布式协同协议。

**得分：5/10**

扣分点：BASE 仍然没答（-2）；Raft 只说了选举，缺日志复制和成员变更（-2）

### 最终修正版

**CAP**
- C（一致性）、A（可用性）、P（分区容错）
- 网络分区必然存在，只能在 CP 和 AP 间选
- CP：Zookeeper、Etcd、HBase
- AP：Eureka、Cassandra

**BASE**
- Basically Available（基本可用）
- Soft State（软状态，允许中间状态）
- Eventually Consistent（最终一致）
- 是 CAP 中 AP 的延伸，牺牲强一致性换可用性

**Raft**
三个核心机制：
1. Leader 选举：Term 编号 + 随机超时 + 多数投票
2. 日志复制：Leader 收到写请求 → 追加本地日志 → 发给 Follower → 多数确认后 commit
3. 安全性：只有包含最新日志的节点能当选 Leader；已 commit 的日志不会被覆盖

### 复习骨架

CAP 三选二（P 必选，CP 或 AP）→ BASE 是 AP 的实践方案 → Raft 用选举+日志复制实现 CP
