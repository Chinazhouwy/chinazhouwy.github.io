# RocketMQ vs Kafka：事务、原子写入、有序性

> 整理自对话讨论，覆盖面试高频考点

---

## 一、核心概念对照

| 维度 | Kafka | RocketMQ |
|------|-------|----------|
| 多条消息原子写入 | ✅ 原生 Transaction API | ❌ 不原生支持，需变通 |
| 本地事务+消息一致性 | ❌ 需外部实现 | ✅ 事务消息（半消息） |
| 恰好一次语义（Exactly-Once） | ✅ 幂等生产者+事务 | ❌ 至少一次（At-Least-Once），消费端必须幂等 |
| 消费+生产原子事务 | ✅ sendOffsetsToTransaction | ❌ 不支持 |
| 顺序消息 | 同分区内有序，跨分区无序 | 全局有序 / 分区有序 |
| 定时/延时消息 | ❌ 不原生支持 | ✅ 原生支持 |
| 消息回溯/重消费 | ✅ 按 offset 回溯任意时间点 | ⚠️ 支持但不如 Kafka 灵活 |

---

## 二、消息传递三种语义

| 语义 | 中文 | 含义 | 谁支持 |
|------|------|------|--------|
| **At-most-once** | 至多一次 | 消息可能丢失，不会重复 | - |
| **At-least-once** | 至少一次 | 消息不会丢失，可能重复 | RocketMQ 默认 |
| **Exactly-once** | 恰好一次 | 既不丢失也不重复 | Kafka 事务 |

RocketMQ 默认是 **At-least-once（至少一次）**，所以消费端**必须做幂等处理**。

---

## 三、Kafka Transaction（事务）

### 3.1 多条消息原子写入

```java
Properties props = new Properties();
props.put("bootstrap.servers", "localhost:9092");
props.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
props.put("value.serializer", "org.apache.kafka.common.serialization.StringSerializer");
// 开启幂等生产者（Idempotent Producer）
// 作用：即使同一条消息重试发送多次，Broker 也只写入一次
props.put("enable.idempotence", "true");
// 指定事务 ID（Transaction ID）
// 作用：Kafka 通过这个 ID 跟踪事务状态，保证跨会话的幂等性
props.put("transactional.id", "my-transaction-1");

KafkaProducer<String, String> producer = new KafkaProducer<>(props);

// 初始化事务（必须在 beginTransaction 之前调用）
// 作用：向 Broker 注册这个事务 ID，清理上一次未完成的事务残留
producer.initTransactions();

try {
    producer.beginTransaction();

    // 在一个事务内发送多条消息
    for (int i = 0; i < 10; i++) {
        ProducerRecord<String, String> record = new ProducerRecord<>(
            "order-topic", "key-" + i, "订单-" + i + "已创建"
        );
        producer.send(record);
    }

    // 提交：10条消息作为一个原子单元
    // 提交后消息才对消费者可见
    // 如果调用 abortTransaction()，10条消息全部丢弃
    producer.commitTransaction();

} catch (Exception e) {
    // 回滚：10条消息全部丢弃，消费者看不到任何一条
    producer.abortTransaction();
} finally {
    producer.close();
}
```

### 3.2 消费位点提交也放进事务（读-处理-写模式）

**问题场景**：消费者读消息 → 处理 → 生产新消息 → 提交消费位点

```
情况A：生产成功，位点提交失败
→ 结果消息已发出，但位点没提交
→ 下次重新消费同一条消息 → 重复消费！

情况B：生产失败，位点提交成功
→ 结果消息没发出去，但位点已提交
→ 这条消息丢了！
```

**Kafka 的解决方案**：把消费位点提交也放进事务

```java
Properties consumerProps = new Properties();
consumerProps.put("bootstrap.servers", "localhost:9092");
consumerProps.put("group.id", "my-consumer-group");
consumerProps.put("enable.auto.commit", "false");  // 关闭自动提交位点
consumerProps.put("isolation.level", "read_committed"); // 只读已提交的消息

KafkaConsumer<String, String> consumer = new KafkaConsumer<>(consumerProps);
consumer.subscribe(Arrays.asList("order-topic"));

Properties producerProps = new Properties();
producerProps.put("bootstrap.servers", "localhost:9092");
producerProps.put("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
producerProps.put("value.serializer", "org.apache.kafka.common.serialization.StringSerializer");
producerProps.put("enable.idempotence", "true");
producerProps.put("transactional.id", "order-processor-tx");

KafkaProducer<String, String> producer = new KafkaProducer<>(producerProps);
producer.initTransactions();

while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
    if (records.isEmpty()) continue;

    producer.beginTransaction();
    try {
        // 处理消息，生产结果消息到下游 Topic
        for (ConsumerRecord<String, String> record : records) {
            String result = "处理结果: " + record.value();
            producer.send(new ProducerRecord<>("result-topic", result));
        }

        // 【关键】消费位点提交也放进事务
        // sendOffsetsToTransaction 把"消费位点"和上面"生产的结果消息"
        // 绑定在同一个事务里
        producer.sendOffsetsToTransaction(
            consumer.assignment().stream()
                .collect(Collectors.toMap(
                    tp -> tp,
                    tp -> new OffsetAndMetadata(
                        records.records(tp).get(records.records(tp).size() - 1).offset() + 1
                    )
                )),
            consumer.groupMetadata()
        );

        // 同时提交消息 + 消费位点
        producer.commitTransaction();

    } catch (Exception e) {
        // 回滚：消息丢弃 + 位点不提交 → 下次重新消费
        producer.abortTransaction();
    }
}
```

**执行流程**：
```
开始事务
  ├─ 从 Topic-A 读取消息（offset 100~110）
  ├─ 处理每条消息，生产结果到 Topic-B
  ├─ 记录消费位点：offset = 111
  ├─ commitTransaction()
  │     → Topic-B 的结果消息：对消费者可见 ✅
  │     → Topic-A 的消费位点：记录为111 ✅
  └─ 如果失败 → abortTransaction()
        → Topic-B 的结果消息：丢弃 ❌
        → Topic-A 的消费位点：不提交，下次重新读 ✅
```

**为什么不封装成自动的？**
Kafka 的 Consumer 和 Producer 是独立组件，大多数消费者只消费不生产（不需要事务）。Kafka 作为底层引擎追求灵活性，把选择权交给用户。Flink、Kafka Streams 等上层框架已封装好了 Checkpoint + 两阶段提交（Two-Phase Commit）。

---

## 四、本地事务 + 消息一致性

### 4.1 RocketMQ 事务消息（Transaction Message / 半消息）

RocketMQ **原生支持**，解决"本地事务和发消息的原子性"。

```java
// ========== 1. 生产者 ==========
@Service
public class OrderService {
    @Autowired
    private TransactionMQProducer transactionProducer;
    @Autowired
    private OrderMapper orderMapper;

    public void createOrder(Order order) {
        Message<String> msg = MessageBuilder
            .withPayload(JSON.toJSONString(order))
            .setHeader("orderId", order.getId())
            .build();

        // 发送事务消息（半消息，Half Message）
        // 半消息对消费者不可见，等本地事务结果确认后才可见
        transactionProducer.sendMessageInTransaction(
            MessageBuilder.withPayload(msg)
                .setHeader("orderId", order.getId())
                .build(),
            order  // 传递参数给 executeLocalTransaction
        );
    }
}
```

```java
// ========== 2. 事务监听器 ==========
@Component
public class OrderTransactionListener implements TransactionListener {
    @Autowired
    private OrderMapper orderMapper;

    /**
     * 收到半消息后，执行本地事务
     * 流程：Broker 发半消息 → 本地执行这个方法 → 根据结果 commit/rollback
     */
    @Override
    public LocalTransactionState executeLocalTransaction(Message msg, Object arg) {
        Order order = (Order) arg;
        try {
            orderMapper.insert(order);
            return LocalTransactionState.COMMIT_MESSAGE;  // 提交，半消息变为可见
        } catch (Exception e) {
            return LocalTransactionState.ROLLBACK_MESSAGE; // 回滚，半消息丢弃
        }
    }

    /**
     * 回查机制：如果 commit/rollback 响应丢失（网络抖动），
     * Broker 定期调用这个方法确认本地事务状态
     * 必须保证幂等
     */
    @Override
    public LocalTransactionState checkLocalTransaction(MessageExt msg) {
        String orderId = msg.getProperty("orderId");
        Order order = orderMapper.selectById(orderId);
        return order != null ?
            LocalTransactionState.COMMIT_MESSAGE :
            LocalTransactionState.ROLLBACK_MESSAGE;
    }
}
```

```java
// ========== 3. 消费者 ==========
@Component
@RocketMQMessageListener(topic = "order-topic", consumerGroup = "order-consumer")
public class OrderConsumer implements RocketMQListener<MessageExt> {
    @Override
    public void onMessage(MessageExt msg) {
        // 消费者只看到 commit 后的消息，半消息不会投递过来
        Order order = JSON.parseObject(msg.getBody(), Order.class);
        System.out.println("收到订单: " + order.getId());
    }
}
```

```
执行流程：
Producer                Broker                   Consumer
  │── 1.发送半消息 ────────→│                        │
  │   (对消费者不可见)       │                        │
  │←── 2.确认收到 ──────────│                        │
  │   3.执行本地事务         │                        │
  ├── 4a.commit ──────────→│── 5.消息可见 ──────────→│
  │    或                   │                        │
  ├── 4b.rollback ────────→│── 5.消息丢弃            │
  │   [如果响应丢失]         │                        │
  │←── 6.回查(check) ──────│   (定期触发)             │
  ├── 7.返回commit/rollback→│                        │
```

### 4.2 本地事务表（Transactional Outbox / 事务发件箱）

不依赖 MQ 的事务能力，**任何 MQ 都适用**，生产中最主流。

```java
// ========== 1. 建表 ==========
// 业务表
CREATE TABLE `order` (
    `id` BIGINT PRIMARY KEY,
    `user_id` BIGINT,
    `amount` DECIMAL(10,2),
    `status` VARCHAR(20)
);

// 本地消息表（Outbox Table）
CREATE TABLE `outbox_message` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `topic` VARCHAR(100),
    `message_key` VARCHAR(100),
    `message_body` TEXT,
    `status` TINYINT DEFAULT 0,  -- 0=待发送, 1=已发送
    `create_time` DATETIME,
    `update_time` DATETIME
);
```

```java
// ========== 2. 业务代码：本地事务保证原子性 ==========
@Service
public class OrderService {
    @Autowired
    private OrderMapper orderMapper;
    @Autowired
    private OutboxMapper outboxMapper;

    @Transactional  // 同一个数据库事务
    public void createOrder(Order order) {
        // ① 写业务数据
        orderMapper.insert(order);

        // ② 写消息记录到本地表（和上面是同一个事务！）
        OutboxMessage msg = new OutboxMessage();
        msg.setTopic("order-created");
        msg.setMessageKey(String.valueOf(order.getId()));
        msg.setMessageBody(JSON.toJSONString(order));
        msg.setStatus(0);
        msg.setCreateTime(LocalDateTime.now());
        outboxMapper.insert(msg);

        // @Transactional 自动提交，两个表同时写入成功
    }
}
```

```java
// ========== 3. 后台任务：把本地消息同步到 MQ ==========
@Component
public class OutboxSyncJob {
    @Autowired
    private OutboxMapper outboxMapper;
    @Autowired
    private RocketMQTemplate mqTemplate;

    @Scheduled(fixedDelay = 1000)  // 每秒扫一次
    public void syncToMq() {
        List<OutboxMessage> pending = outboxMapper.selectPending(100);
        for (OutboxMessage msg : pending) {
            try {
                mqTemplate.convertAndSend(msg.getTopic(), msg.getMessageBody());
                outboxMapper.updateStatus(msg.getId(), 1);
            } catch (Exception e) {
                log.error("消息同步失败, id={}", msg.getId(), e);
                // 下次重试（msg.status 还是0）
            }
        }
    }
}
```

```
流程：
用户请求 → @Transactional（写 order + 写 outbox） → COMMIT（原子提交）
                                                    ↓
                                          后台扫描 outbox 表
                                                    ↓
                                            发送到 RocketMQ
                                                    ↓
                                              消费端幂等处理
```

### 4.3 异常场景分析

| 场景 | 结果 | 是否一致 |
|------|------|---------|
| 业务写入成功，消息写入失败 | 整个事务回滚 | ✅ 一致 |
| 两者都成功，COMMIT 前宕机 | 事务回滚，都没写入 | ✅ 一致 |
| 两者都成功，COMMIT 成功 | 业务和消息都写入 | ✅ 一致 |
| 消息同步到 MQ 失败 | outbox.status=0，下次重试 | ✅ 最终一致 |
| 同步成功但标记 status=1 失败 | 下次重复发送，消费端幂等 | ✅ 最终一致 |

### 4.4 事务消息 vs 本地事务表

| 维度 | 事务消息 | 本地事务表 |
|------|---------|-----------|
| 实现复杂度 | ⭐⭐ Broker 需要配置回查 | ⭐ 纯 SQL |
| 消息延迟 | 实时投递 | 定时轮询，有秒级延迟 |
| 对 MQ 侵入 | 需要 MQ 支持事务协议 | 只是普通消息，任何 MQ 都行 |
| 跨表写入 | ❌ 本地事务只管单条消息 | ✅ 可以在一个事务里写多张表 |
| 适用场景 | 对实时性要求高 | 追求简单可靠 |

**生产最佳实践**：**本地事务表 + Canal** 是最稳的组合。

---

## 五、消息有序性

### 5.1 三个概念

```
全局有序（Global Ordering）：消费者收到的顺序永远是 A → B → C
分区有序（Partition Ordering）：同一批消息内有序，不同批次之间无序
无序（Unordered）：消费者收到的顺序可能是 C → A → B
```

### 5.2 Kafka 有序性

**全局有序**：只有一个分区
```java
// 创建 Topic 时只指定 1 个分区
NewTopic topic = new NewTopic("order-topic", 1, (short) 3);
admin.createTopics(Collections.singletonList(topic));
```
```
分区0: [msg1] [msg2] [msg3] [msg4] [msg5]
代价：只能单消费者，吞吐量极低
```

**分区有序**：相同 Key 进入同一分区
```java
// Producer 按 orderId 作为 Key
for (Order order : orders) {
    ProducerRecord<String, String> record = new ProducerRecord<>(
        "order-topic",
        order.getOrderId(),  // 相同 orderId 进入同一分区
        JSON.toJSONString(order)
    );
    producer.send(record);
}
```
```
分区0: [订单A-下单] [订单A-支付] [订单A-发货]   ← 同一订单有序 ✅
分区1: [订单B-下单] [订单B-支付] [订单B-发货]   ← 同一订单有序 ✅
但是：订单A和订单B之间的顺序无法保证 ❌
```

### 5.3 RocketMQ 有序性

**全局有序**：队列数设为 1
```java
mqAdmin.createTopic("OrderCluster", "order-topic", 1);  // 1个队列
```

**分区有序（MessageQueueSelector）**：
```java
@Service
public class OrderProducer {
    @Autowired
    private DefaultMQProducer producer;

    public void sendOrderMessage(Order order) {
        Message msg = new Message(
            "order-topic",
            JSON.toJSONString(new OrderEvent(order.getId(), "下单"))
        );

        // MessageQueueSelector：同 orderId 选择同一个队列
        producer.send(msg, new MessageQueueSelector() {
            @Override
            public MessageQueue select(List<MessageQueue> mqs, Message msg, Object arg) {
                String orderId = (String) arg;
                int index = Math.abs(orderId.hashCode()) % mqs.size();
                return mqs.get(index);
            }
        }, order.getId());
    }

    // 模拟同一订单生命周期
    public void simulateOrderLifecycle(String orderId) {
        sendOrderMessage(new Order(orderId, "CREATED"));   // 下单
        sendOrderMessage(new Order(orderId, "PAID"));     // 支付
        sendOrderMessage(new Order(orderId, "SHIPPED"));  // 发货
    }
}
```

**消费端有序消费（MessageListenerOrderly）**：
```java
@Component
@RocketMQMessageListener(
    topic = "order-topic",
    consumerGroup = "order-consumer",
    consumeMode = ConsumeMode.ORDERLY  // 有序消费模式
)
public class OrderConsumer implements RocketMQListenerConcurrently {
    @Override
    public ConsumeConcurrentlyStatus consumeMessage(
            List<MessageExt> msgs, ConsumeConcurrentlyContext context) {
        for (MessageExt msg : msgs) {
            OrderEvent event = JSON.parseObject(msg.getBody(), OrderEvent.class);
            System.out.println("订单" + event.getOrderId() + "：" + event.getType());
        }
        return ConsumeConcurrentlyStatus.CONSUME_SUCCESS;
    }
}
```

**有序消费的核心机制**：
```
对每个队列加 QueueLock（队列锁）
→ 同一队列同一时刻只有一个线程消费
→ 按队列内消息顺序逐条消费
→ 处理失败不跳过，一直重试直到成功
```

### 5.4 Kafka vs RocketMQ 有序消费对比

```
Kafka 有序消费：
- 消费者按 offset 顺序读取
- 某条消息处理失败 → 跳过或重试（不阻塞其他分区）
- 不需要加锁

RocketMQ 有序消费：
- 对队列加 QueueLock（队列锁）
- 同一队列同一时刻只有一个线程消费
- 某条消息处理失败 → 阻塞，一直重试，队列里后面的全部等待
- 性能牺牲更大，但顺序保证更严格
```

| 维度 | Kafka | RocketMQ |
|------|-------|----------|
| 全局有序 | ✅ 1个分区 | ✅ 1个队列 |
| 分区/队列有序 | ✅ 相同 Key 进同一分区 | ✅ MessageQueueSelector |
| 有序消费方式 | 按 offset 顺序读取 | MessageListenerOrderly 加队列锁 |
| 消息堆积时的保序 | ✅ 不影响其他分区 | ⚠️ 阻塞同队列所有后续消息 |
| 性能 | 好 | 差（锁队列） |

### 5.5 生产中有序消息的取舍

```
需要有序的场景：
✅ 订单生命周期：下单 → 支付 → 发货 → 完成
✅ 数据库 binlog 同步：INSERT → UPDATE → DELETE
✅ 账户流水：存款 → 取款 → 转账

不需要有序的场景：
❌ 日志收集
❌ 通知推送
❌ 数据同步（最终一致即可）

折中方案：按业务 Key 分组有序
→ 同一用户/订单有序，不同用户之间并行消费
```

---

## 六、面试答题模板

### Q1：Kafka 和 RocketMQ 事务的区别？

> Kafka 事务解决的是多条消息的原子写入，一个事务内发的所有消息要么全可见要么全不可见。RocketMQ 事务消息解决的是本地事务和发消息的一致性，通过半消息+回查机制实现。两者不在一个维度，不是对等关系。

### Q2：RocketMQ 如何保证消息有序？

> 通过 MessageQueueSelector 让相同业务 Key 的消息进入同一队列，消费端用 MessageListenerOrderly 加队列锁保证队列内按顺序消费。代价是同一队列内有消息处理失败时后续消息会阻塞。生产中一般按订单ID或用户ID分组有序，不同组之间并行消费。

### Q3：如何保证本地事务和消息的强一致？

> 最稳妥的方案是本地事务表（Transactional Outbox）：业务数据和消息记录在同一个 DB 事务里写入，后台任务或 Canal 扫描发到 MQ，消费端做幂等。不依赖 MQ 的事务能力，任何 MQ 都适用。RocketMQ 也有原生的事务消息（半消息），实时性更好，但只能保证单条消息和本地事务的原子性。

### Q4：Exactly-Once 怎么实现？

> Kafka 通过幂等生产者（enable.idempotence=true）+ 事务（Transaction API）+ 消费位点提交（sendOffsetsToTransaction）实现恰好一次语义。RocketMQ 默认是至少一次，需要消费端自行做幂等（Redis SETNX 或 DB 唯一键去重）。
