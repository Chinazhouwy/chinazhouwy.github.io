---
schema_version: "1"
question_id: "231"
question: "资金划扣为什么选 TCC？本地消息表 + RocketMQ 如何保证最终一致性？平安后续使用 Seata AT 时如何处理幂等、回滚和异常补偿？"
date: "2026-07-27"
sources:
  - "content/about/about-me.md"
  - "content/opportunity/practice/09-distributed-transaction.md"
  - "content/learning/middleware/rocketmq-kafka-transaction-ordering.md"
score: "4/10"
round: "R0"
next_review: "2026-07-28"
session_id: "unknown"
status: "completed"
title: "第231题：资金划扣与分布式事务（简历专项 05）"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "TCC、本地消息表、RocketMQ 保证资金最终一致性"
tags:
  - "分布式事务"
  - "TCC"
  - "RocketMQ"
---

# 第231题：资金划扣与分布式事务（简历专项 05）

## 题目
资金划扣为什么选 TCC？本地消息表 + RocketMQ 如何保证最终一致性？平安后续使用 Seata AT 时如何处理幂等、回滚和异常补偿？

## 用户原始回答
> TCC 是不是一种设计思路？try commit rollback if exception。我们先在库里面设置扣款中状态，封住后续所有资金操作和页面显示，等待支付回调后再改状态。

## 评分与扣分点

**评分：4/10**

- 理解了 TCC 的 Try/Confirm/Cancel 本质 ✓
- 实际方案：状态机 + 异步回调，方向正确 ✓
- 缺：回调丢失怎么兜底（分布式事务核心问题）
- 缺：本地消息表具体存什么、定时补偿怎么设计
- 没区分 TCC 和实际方案的取舍

## 完整答案

### 实际方案本质

```
本地事务：创建扣款记录（状态=扣款中）+ 写入本地消息表
    │
    ▼
发 RocketMQ 消息 → 通知支付网关
    │
    ▼
支付回调 → 修改状态：扣款中 → 已扣款
    │
    ▼
回调丢失 → 定时任务扫本地消息表，重试
```

### 本地消息表结构

```sql
CREATE TABLE t_payment_outbox (
    id BIGINT PRIMARY KEY,
    order_id VARCHAR(64),
    message_id VARCHAR(64),       -- MQ messageId，去重用
    status VARCHAR(16),           -- PENDING / SENT / CONFIRMED / FAILED
    retry_count INT DEFAULT 0,
    next_retry_time DATETIME,
    create_time DATETIME
);
```

### 回调丢失兜底

```java
@Scheduled(fixedDelay = 60000)
public void retryPendingPayments() {
    List<PaymentOutbox> pending = outboxMapper.selectPending();
    for (PaymentOutbox msg : pending) {
        if (msg.getRetryCount() > 10) {
            alertService.send("扣款超时未确认: " + msg.getOrderId());
            continue;  // 人工介入
        }
        paymentGateway.queryResult(msg.getOrderId());
        msg.setRetryCount(msg.getRetryCount() + 1);
        outboxMapper.update(msg);
    }
}
```

### 和 TCC 的对比

| | TCC | 实际方案 |
|------|-----|---------|
| 资源预留 | Try 显式冻结 | 状态="扣款中" 隐式锁定 |
| 回滚 | Cancel 主动调用 | 超时后人工/自动补偿 |
| 复杂度 | 高（每服务都要 Try/Confirm/Cancel） | 低（状态机 + 定时补偿） |
| 适用场景 | 强一致性（银行转账） | 最终一致性（保险扣款） |

## 面试回答模板

> "资金扣款没有引入完整 TCC，而是用状态机 + 本地消息表保证最终一致性。扣款前先写本地消息表并把业务状态置为'扣款中'，锁住后续操作。通过 RocketMQ 发支付请求，回调到达后释放状态。回调丢失靠定时任务扫本地消息表重试，超过次数转人工工单。这套比 TCC 复杂度低得多，适合保险业务的最终一致性要求。"
