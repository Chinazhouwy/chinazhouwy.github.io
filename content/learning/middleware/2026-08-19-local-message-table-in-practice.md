---
title: "本地消息表实战整理：机制、落地与生产边界"
date: "2026-08-19"
domain: "学习"
area: "数据与中间件"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "整理一篇本地消息表实战文：业务与消息同事务落库、轮询补发、消费端幂等的完整链路，并补上原文口号之外的生产边界（重试策略、并发扫描、数据清理、对账兜底）与逐条勘误。"
tags:
  - 分布式事务
  - 最终一致性
  - 本地消息表
  - Outbox
  - 消息队列
  - 幂等
  - 微服务
source: "微信公众号「互联网后端架构栈」"
source_url: "https://mp.weixin.qq.com/s/_KKtOk07TPjRnc_SB-wWzQ"
published_at: "2026-08-19 14:10:11 +08:00"
---

# 本地消息表实战整理：机制、落地与生产边界

> **类型**：📚 技术文章整理（非面试题 / 面经）
>
> **原文标题**：《本地消息表终极实战！彻底解决微服务异步事务一致性，根治消息丢包、重复消费、数据不一致》
>
> **来源**：微信公众号「互联网后端架构栈」
>
> **原文环境**：未注明版本（示例为 Spring / MyBatis 风格伪代码 + MySQL DDL）
>
> **发布时间**：2026-08-19 14:10（北京时间）
>
> **整理时间**：2026-09-14
>
> **核验原则**：原文标题是"彻底解决 / 零故障 / 碾压"式营销措辞。本笔记保留落地骨架，用 Spring 官方 Javadoc 与 RocketMQ 官方文档核验机制描述 [2][3]，并对原文自相矛盾与过度承诺之处逐条勘误（第六节）。

## 一、问题：两个断裂点，而不是"MQ 不可靠"

标准链路是「执行业务 SQL → 发送 MQ 消息 → 下游服务消费」，它有两个无法回避的断裂点：[1]

1. **先发消息、后落库**：消息已发出，本地事务回滚，下游空执行产生脏数据；
2. **先落库、后发消息**：库已提交，服务宕机在发消息之前，消息永久丢失。

本质问题不是"MQ 不保证 100% 投递"——典型 MQ 的语义本来就是至少一次，可靠性靠"生产者重试 + 消费端幂等"共同兑现——而是**业务库写与消息投递跨了两个无法共同提交的资源**。[1] 本地消息表的思路，就是把"发消息"改成"先在本地事务里记账，再异步投递"，用本地事务的原子性封住断裂点。[1]

## 二、核心机制：五步闭环

1. 本地事务内：写业务数据 + 向本地消息表插一条【待发送】记录；[1]
2. 提交事务：业务与消息要么全成功、要么全回滚；[1]
3. 独立定时任务轮询消息表，投递【待发送】的消息；[1]
4. 投递成功更新为【已发送】；消费完成回调更新为【已完成】；[1]
5. 投递失败记录重试次数与下次重试时间，延迟重试。[1]

```text
0 待发送 ──定时扫描投递──▶ 1 已发送 ──消费端回调──▶ 2 已完成
   └─────投递失败────▶ retry_count + 1 / next_retry_time 顺延，超限转"发送失败"+人工
```

关键不变式只有一条：**业务数据与消息记录在同一个本地事务（同一个库）里提交**。[1] 后面的全部正确性都建立在这条之上；跨库时会失效，见勘误 4。

## 三、落地：表结构与两段核心代码

原文给出的表结构（重排版）：[1]

```sql
CREATE TABLE `local_message` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `message_no` varchar(64) NOT NULL COMMENT '消息唯一编号',
  `topic` varchar(64) NOT NULL COMMENT 'MQ主题',
  `message_body` text NOT NULL COMMENT '消息体内容',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0待发送 1已发送 2已完成 3发送失败',
  `retry_count` int NOT NULL DEFAULT '0' COMMENT '重试次数',
  `next_retry_time` datetime DEFAULT NULL COMMENT '下次重试时间',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_msg_no` (`message_no`),
  KEY `idx_status_retry` (`status`,`next_retry_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='本地消息事务表';
```

设计要点：

- `message_no` 唯一键：配合消费端幂等做消息去重；[1]
- `(status, next_retry_time)` 联合索引：让轮询查询走索引而不是全表扫描；[1]
- `next_retry_time` 允许为 NULL（新消息尚未安排重试），扫描 SQL 必须兼容 `IS NULL OR <= NOW()` 两种情况；
- `status=3`（发送失败）是"超限转人工"的落点，但原文没有给出写入它的代码，落地时记得补上（见勘误 1）。

业务侧落地（原文代码重排版）：[1]

```java
@Transactional(rollbackFor = Exception.class)
public void createOrder(OrderDTO dto) {
    // 1、创建订单业务数据
    Order order = buildOrder(dto);
    orderMapper.insert(order);
    // 2、同步落本地消息表（同事务，保证原子）
    LocalMessage message = new LocalMessage();
    message.setMessageNo(UUID.randomUUID().toString());
    message.setTopic("order_create_topic");
    message.setMessageBody(JSON.toJSONString(order));
    message.setStatus(0);
    localMessageMapper.insert(message);
}
```

补发任务（原文代码重排版）：[1]

```java
@Scheduled(fixedDelay = 3000)
public void scanAndSendMessage() {
    // 查询待发送、且到重试时间的消息
    List<LocalMessage> messageList = localMessageMapper.selectWaitSendMessage();
    for (LocalMessage msg : messageList) {
        try {
            mqProducer.send(msg.getTopic(), msg.getMessageBody());
            msg.setStatus(1);
            localMessageMapper.updateById(msg);
        } catch (Exception e) {
            msg.setRetryCount(msg.getRetryCount() + 1);
            msg.setNextRetryTime(getNextRetryTime(msg.getRetryCount()));
            localMessageMapper.updateById(msg);
        }
    }
}
```

生产化建议（补）：扫描要"批量 + 兼容 NULL + 抢占式领取"。

```sql
-- 单实例：批量取到点消息（限制批量，避免一次拉爆内存）
SELECT * FROM local_message
WHERE status = 0 AND (next_retry_time IS NULL OR next_retry_time <= NOW())
ORDER BY id LIMIT 200;
```

多实例场景可以先把一批行 UPDATE 成"发送中"状态（抢占），再按实例拉取处理；更严谨的抢占可结合数据库行锁能力（如 `SKIP LOCKED` 一类机制，按数据库版本确认支持情况）。

## 四、生产边界：上线前要想清楚的四件事

1. **重试必须有限且带退避**。原文一处写"无限重试，直到成功"，另一处又写"最大重试次数兜底"——两句互相矛盾（见勘误 1）。生产建议：指数退避 + 最大次数 + 超限置"发送失败"并告警，用 `retry_count` / `next_retry_time` 落库。[1]
2. **多实例部署的并发扫描**。重复投递在原文里被定义为必然现象（所以要消费端幂等）[1]；多实例部署会让同一批消息被多个实例同时扫到，加剧重复。要么分片调度（按 id 取模），要么抢占式领取。
3. **消息表要清理**。原文索引设计的目标是轮询"不扫全表"[1]，但没有给出清理策略：已发送 / 已完成的行会持续堆积，表无限增长时索引也顶不住。按时间窗口归档或删除（留足对账窗口），必要时拆分"待发送"小表或分区。
4. **对账兜底**。本方案闭合的是"业务提交 → 消息进入 MQ"的断裂带；"消费端处理失败"与"回执丢失"仍可能留下不一致。[1] 资金、积分类链路应再加一层定期对账补偿。

## 五、和相邻方案的关系：别把选型表当圣经

- **vs MQ 事务消息**：RocketMQ 的事务消息在普通消息基础上支持两阶段提交与回查（半消息机制）[3]，把"本地事务与发消息的原子性"下沉到 MQ；本地消息表不依赖 MQ 的事务能力、任何 MQ 都能用，代价是轮询延迟与表维护。[1] 两者的维度差异（多条消息原子写入、消费位点提交等）见仓库笔记，不重复展开。
- 仓库里已有一篇把两者放在一起细讲的笔记：[RocketMQ vs Kafka：事务、原子写入、有序性](./rocketmq-kafka-transaction-ordering.md)（4.1—4.4 节），本文与其互为补充。
- **选型表口径提醒**：原文对比表里"Seata AT = 弱一致 / TCC = 强一致"这类标签是社区资料的简化口径。[1] 面试时讲清机制差异（全局锁 + 补偿回滚 vs 业务预留资源 vs 至少一次 + 幂等），比背标签更稳。

## 六、勘误与补充

### 1. "无限重试"与"最大重试次数"互相矛盾，且 status=3 没有写入逻辑

- **原文表述 A**："发送失败，无限重试，直到成功。"[1]
- **原文表述 B**："设置最大重试次数，超过阈值标记为失败，人工兜底，避免死循环。"[1]
- **更准确**：两句不能同时成立。生产做法：`retry_count` 超限后 `UPDATE status=3`（DDL 里已定义这个状态）并接入告警；"无限重试"只适合能容忍长尾且带全局熔断 / 告警的场景。原文正文没有给出把消息写成 3 的代码，落地时记得补。

### 2. "彻底解决 / 零故障 / 彻底清零"的边界

- **原文表述**：接入后"线上异步数据不一致问题彻底清零"，并称方案"零故障"。[1]
- **更准确**：本地消息表 + 幂等收敛的是"消息不丢、不重复生效"这条链路，拿到的是**最终一致**；消费端处理失败、下游业务缺陷、对账缺失造成的不一致不在它的射程内。[1] 面试时讲"至少一次投递 + 幂等收敛"比讲"彻底解决"更站得住。

### 3. "性能极高"的前提条件

- **原文表述**："状态+重试时间联合索引，保证定时轮询不扫全表，性能极高。"[1]
- **更准确**：联合索引能消除全表扫描，但"扫得动"还要满足：批量 LIMIT 取数、已完结数据及时归档、避免大消息体塞进高频扫描的索引路径；否则表体积与索引写放大照样拖慢轮询。[1]

### 4. "同事务"成立的前提：同一个库 / 同一数据源

- **原文表述**："业务表、消息表同事务，绝对不可能出现一半成功一半失败。"[1]
- **更准确**：本地事务是"资源本地"的（绑定单个 JDBC 连接 / 数据源），两张表必须在同一个库里，该保证才成立；跨库时必须换方案（或补对账），"绝对"并不无条件。可对照仓库笔记的异常场景表自查：[RocketMQ vs Kafka：事务、原子写入、有序性](./rocketmq-kafka-transaction-ordering.md)。

### 5. `fixedDelay = 3000` 的语义：不是"每 3 秒一轮"

- **原文表述**：用 `@Scheduled(fixedDelay = 3000)` 每 3 秒扫描一次补发。[1]
- **更准确**：`fixedDelay` 的官方语义是"上一轮执行结束之后、再间隔固定时长启动下一轮"，不是固定频率；单线程串行下，扫描 + 发送的耗时会让实际周期大于 3 秒。[2] 提高吞吐应走"批量 + 并发 / 分片"，而不是继续调小周期。
- **来源**：Spring Framework `@Scheduled` Javadoc [2]。

## 七、复习速记

```text
本地消息表 = 同库同事务写「业务 + 消息」，再轮询补发
重复投递不可避免 → 消费端幂等（messageNo 唯一键）收敛
它只闭合"业务 → MQ"断裂带；消费失败 / 回执丢失仍要靠对账兜底
重试 = 有限次数 + 指数退避 + 超限告警（别写"无限重试"）
多实例要抢占 / 分片扫描；消息表要归档清理；周期不是越小越好
vs 事务消息：MQ 能力下沉 vs 业务自管；多表 / 多库原子性只有 Outbox 类方案能兜
```

## 关联本仓库资料

- 事务消息、Outbox 对比与异常场景表：[RocketMQ vs Kafka：事务、原子写入、有序性](./rocketmq-kafka-transaction-ordering.md)
- TCC / 本地消息表练习题（同一知识点的出题视角）：[231-tcc-local-message-table-distributed-tx](../../opportunity/practice/231-tcc-local-message-table-distributed-tx.md)
- "Redis 扣减成功但 MQ 发送失败 → 本地消息表兜底"的同场景笔记：[Java 高级灵魂三问](./senior-java-3-soul-questions.md)
- 微服务稳定性姊妹主题（限流熔断）：[Sentinel 限流熔断实战指南](./2026-08-07-sentinel-usage-guide.md)

## 原始链接

https://mp.weixin.qq.com/s/_KKtOk07TPjRnc_SB-wWzQ

## Sources

[1] https://mp.weixin.qq.com/s/_KKtOk07TPjRnc_SB-wWzQ — 本地消息表终极实战（公众号：互联网后端架构栈）
[2] https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/annotation/Scheduled.html — Spring Framework Javadoc: @Scheduled
[3] https://rocketmq.apache.org/docs/featureBehavior/04transactionmessage — Apache RocketMQ Docs: Transactional Messages
