# 第39题：MQ — RocketMQ 事务消息、延时消息、顺序消息

> 日期：2026-07-01
> 来源：`middleware/rocketmq-kafka-transaction-ordering.md`; `java/eleme-java-backend-round1.md`; `practice/22-kafka-consumer-group-rebalance.md`

---

## 第一轮：初始回答

**得分：4/10** 😐

方向大致对，但关键概念模糊或有误。

**问题：**
1. 事务消息漏了 Half Message 和回查机制
2. 顺序消息"通道"说法不够精确，没提 MessageQueueSelector
3. 延时消息"必须在一个通道里面"是错误的

---

## 核心概念

### 事务消息

**完整流程：**

```
1. Producer 发 Half Message（半消息）→ Broker 存着，消费者看不到
2. Producer 执行本地事务（比如 DB 插入订单）
3. 本地事务成功 → 发 Commit → 消息投递给消费者
   本地事务失败 → 发 Rollback → 消息丢弃

关键兜底：如果 Broker 没收到 Commit/Rollback（比如 Producer 宕机），
Broker 会主动回查 Producer 的本地事务状态
```

**回查机制：**

```
触发条件：Half Message 超过一定时间没状态变更（默认 6 秒）
回查流程：Broker → Producer: "你那个本地事务到底成功没？"
  → 成功 → 发 Commit
  → 失败 → 发 Rollback
  → 还没执行完 → 不响应（Broker 过一会再问）
最多回查 15 次，超过直接 Rollback 丢弃
```

**代码示例：**

```java
// 1. 发送半消息
Message msg = new Message("ORDER_TOPIC", "订单创建".getBytes());
SendResult result = producer.sendMessageInTransaction(msg, order);

// 2. 事务监听器
public class OrderTransactionListener implements TransactionListener {
    @Override
    public LocalTransactionState executeLocalTransaction(Message msg, Object arg) {
        Order order = (Order) arg;
        try {
            orderMapper.insert(order);
            return LocalTransactionState.COMMIT_MESSAGE;
        } catch (Exception e) {
            return LocalTransactionState.ROLLBACK_MESSAGE;
        }
    }

    @Override
    public LocalTransactionState checkLocalTransaction(MessageExt msg) {
        String orderId = msg.getKeys();
        Order order = orderMapper.selectById(orderId);
        return order != null ? LocalTransactionState.COMMIT_MESSAGE
                            : LocalTransactionState.ROLLBACK_MESSAGE;
    }
}
```

### 延时消息

**机制：** Producer 设置延时级别 → Broker 延迟投递 → 时间到才进入目标 Queue

**固定 18 个级别（4.x）：**

| Level | 延时 | Level | 延时 |
|-------|------|-------|------|
| 1 | 1s | 10 | 6m |
| 2 | 5s | 11 | 7m |
| 3 | 10s | 12 | 8m |
| 4 | 30s | 13 | 9m |
| 5 | 1m | 14 | 10m |
| 6 | 2m | 15 | 20m |
| 7 | 3m | 16 | 30m |
| 8 | 4m | 17 | 1h |
| 9 | 5m | 18 | 2h |

**5.0 支持任意秒级精度（TimerWheel 时间轮实现）。**

**代码示例：**

```java
Message msg = new Message("ORDER_TOPIC", "付款超时提醒".getBytes());
msg.setDelayTimeLevel(4);  // 30秒后投递
producer.send(msg);
```

### 顺序消息

**机制：** 同一 Queue 内 FIFO → Producer 用 `MessageQueueSelector` 按业务 key 路由到同一 Queue → Consumer 用 `MessageListenerOrderly` 单线程消费

**Queue 分配机制：** 同一 ConsumerGroup 内，一个 Queue 只分配给一个消费者，不会出现多个消费者抢同一 Queue 导致乱序。

**代码示例：**

```java
// Producer：按订单ID路由到同一Queue
producer.send(msg, (mqs, msg1, arg) -> {
    int orderId = (int) arg;
    int index = orderId % mqs.size();
    return mqs.get(index);
}, order.getId());

// Consumer：顺序消费
consumer.registerMessageListener((MessageListenerOrderly) (msgs, ctx) -> {
    for (MessageExt msg : msgs) {
        processOrder(msg);
    }
    return CONSUME_SUCCESS;
});
```

**MessageListenerOrderly vs MessageListenerConcurrently：**

| | MessageListenerOrderly | MessageListenerConcurrently |
|--|----------------------|---------------------------|
| 执行方式 | 同一 Queue 单线程 | 多线程并发 |
| 顺序保证 | ✅ Queue 内严格有序 | ❌ 无序 |
| 吞吐量 | 低 | 高 |
| 适用场景 | 订单状态流转、交易流水 | 无关顺序的日志、通知 |

**顺序消费的坑：**
1. 消费失败重试会阻塞整个 Queue
2. Queue 扩缩容会打乱顺序
3. Rebalance 时可能短暂乱序

---

## 用户追问纠正记录

1. 事务消息的"两阶段提交"方向对，但必须提到 Half Message + 回查机制
2. 延时消息"必须在一个通道里面"是错误的，延时消息跟 Queue 无关
3. 顺序消息的"通道"说法不够精确，关键是 MessageQueueSelector + MessageListenerOrderly
4. 消费者订阅：同组内一个 Queue 只分配给一个消费者，不会冲突；不同 ConsumerGroup 可以同时订阅同一个 Queue

---

## 这次讨论的收获

- 事务消息的核心是 Half Message + 回查机制，不是简单的两阶段提交
- 延时消息是 Broker 端延迟投递，Producer 设级别，Consumer 不用管
- 顺序消息需要 Producer 选 Queue + Consumer 单线程消费，两端配合
- 同一 ConsumerGroup 内一个 Queue 只给一个消费者，不会出现多消费者抢 Queue 导致乱序
- RocketMQ 4.x 延时只有 18 个固定级别，5.0 支持任意秒级精度
