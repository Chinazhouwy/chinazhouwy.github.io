---
title: "RabbitMQ 如何保证可靠投递、可靠消费、死信队列和幂等？"
date: "2026-06-10"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "RabbitMQ 如何保证可靠投递、可靠消费、死信队列和幂等？"
tags:
schema_version: "1"
question_id: "28"
question: "RabbitMQ 如何保证可靠投递、可靠消费、死信队列和幂等？"
sources:
  - "tencent/2026-06-07-tencent-ai-backend-round1-xhs.md"
  - "java/eleme-java-backend-round1.md"
score: "5/10"
round: "R0"
next_review: "unknown"
session_id: "unknown"
---

# 第28题 — RabbitMQ 可靠投递、可靠消费、死信队列与幂等

## 📊 得分：5/10

**题目**：RabbitMQ 如何保证可靠投递、可靠消费、死信队列和幂等？

**来源**：《腾讯AI后端一面》、《饿了么Java一面》
- `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`
- `java/eleme-java-backend-round1.md`

---

## 用户回答原文

> 可靠投递好像可是靠着broke给他响应吧。可靠消费是指消费端给他一个OK这样的标识。死信队列好像是指消息推送了多次，但是一直没有被消费掉，会进入死信队列差不多吧

---

## 用户追问+纠正记录

### 纠正1：可靠投递 — "broker 响应"太笼统

用户说"靠 broker 给响应"，方向对但没说清机制。

**纠正**：RabbitMQ 的可靠投递是 **Publisher Confirm（生产者确认）** 机制（注意：不是 Broker Confirm，名字从 Publisher 视角命名）：
- 生产者发送消息到 Broker
- Broker **落盘持久化**成功后，返回 confirm 给生产者
- 配置 `spring.rabbitmq.publisher-confirm-type=correlated`
- 还涉及交换机路由确认和镜像队列同步确认

### 纠正2：可靠消费 — "给 OK 标识"太笼统

用户说"消费端给 OK"，方向对但漏了关键点。

**纠正**：
- 是 **Manual Acknowledge（手动确认）**，不是泛泛的"给 OK"
- 默认的 `autoAck=true` 反而是**不可靠**的（消息一到消费端就确认，处理失败消息就丢了）
- 正确做法：`autoAck=false`，处理成功后手动 `basicAck`，失败 `basicNack` 或 `basicReject`

### 纠正3：死信队列理解偏差

用户说"推送多次没消费就进死信队列"，核心理解有误。

**纠正**：死信队列是三种情况，不是"推多次没消费"：
1. 消息被消费者 **reject/nack 且 requeue=false**（主动拒绝）
2. 消息 **TTL 过期**（超过了存活时间）
3. 消息**超过队列最大长度**（队列满了，最早的消息被丢弃到死信队列）

死信队列的用途是**兜底**，让无法正常消费的消息有个去处，可以人工排查或后续处理。

### 纠正4：幂等没提

用户完全没提到幂等。

**补充**：幂等是可靠消费的配套问题。消费端可能重复消费同一条消息（网络抖动、requeue 等），必须做幂等处理：
- 唯一 ID + 去重表
- Redis SETNX
- 业务状态机

用户指出：**幂等应该在业务层按业务组件来区分**，不是 MQ 层面能解决的。✅ 正确。

### 关键信息：用户 MQ 经验

用户明确表示：**RabbitMQ 没用过**，主要用 **RocketMQ**，少量 **Kafka**。RabbitMQ 是 Erlang 写的，不是 Java 语言。

---

## 最终结论

1. **可靠投递**：Publisher Confirm + 消息持久化，Broker 落盘后返回 confirm
2. **可靠消费**：Manual Ack（手动确认），关闭 autoAck，处理成功 ack，失败 nack
3. **死信队列**：三种触发条件 — reject/nack、TTL 过期、队列超长，不是"推多次没消费"
4. **幂等**：业务层按业务组件设计，常见方案：唯一ID+去重表、Redis SETNX、状态机

### MQ 选型口诀
- 小团队业务解耦 → RabbitMQ
- 电商金融事务消息 → **RocketMQ**（用户主用）
- 大数据日志流处理 → Kafka

---

## 这次讨论的收获

1. **RabbitMQ 的核心机制**：Publisher Confirm、Manual Ack、死信队列，概念需要了解但实际工作中用 RocketMQ 更多
2. **死信队列 ≠ 重试失败**：是三种情况（拒绝、过期、超长），面试容易说错
3. **幂等在业务层**：不是 MQ 能解决的，需要按业务组件设计去重方案
4. **MQ 选型**：RocketMQ 在事务消息、延时消息、顺序消息方面原生支持最好，电商/金融场景首选
