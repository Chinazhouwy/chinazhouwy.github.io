# 蚂蚁国际 · 智能体与大模型应用工程 一面面经

> 来源：小红水面经分享（5.8）
> 标签：`#蚂蚁国际` `#智能体` `#大模型` `#高并发` `#RAG` `#AI Coding`
> 岗位：智能体与大模型应用工程

---

## 一、面试概况

| 项目 | 内容 |
|------|------|
| **公司** | 蚂蚁国际（Ant International） |
| **岗位** | 智能体与大模型应用工程 |
| **轮次** | 一面 |
| **特点** | 47题连环问，覆盖高并发+MySQL+RAG+AI Coding |

---

## 二、面试题全记录（47题）

### 第一部分：高并发系统设计（1-25题）

> 场景：抢券项目（优惠券领取/库存扣减）

#### Q1. 系统中高并发一般是哪种情况？

**答案**：
- **秒杀/抢购**：大量用户在同一时刻请求有限资源
- **活动促销**：大促期间流量突增（如双11）
- **热点事件**：突发新闻/热门内容引发大量访问
- **定时任务**：整点抢券、整点下单

#### Q2. 什么阶段产生的？

**答案**：
```
用户请求 → 网关层 → 应用层 → 服务层 → 数据层
  ↑           ↑         ↑         ↑         ↑
 并发入口   并发路由  并发处理  并发读写  并发存储
```
- **入口阶段**：大量请求同时到达网关
- **处理阶段**：应用层并发执行业务逻辑
- **数据阶段**：数据库并发读写，锁竞争

#### Q3. MQ 怎么来解决？

**答案**：
```
用户请求 → 快速返回"排队中" → 写入MQ → 消费者异步处理 → 结果通知
```
- **削峰填谷**：MQ 缓冲瞬时高峰，消费者按能力处理
- **异步化**：用户请求不阻塞，MQ 异步处理
- **限流**：消费者控制消费速率，保护下游

```java
// 示例：抢券MQ处理
public void grabCoupon(CouponGrabRequest request) {
    // 快速校验
    if (!validate(request)) throw new BusinessException("参数错误");
    
    // 写入MQ，快速返回
    rabbitTemplate.convertAndSend("coupon.exchange", "grab", request);
    
    // 返回排队状态
    return Response.success("排队中，请稍后查看结果");
}

// 消费者
@RabbitListener(queues = "coupon.grab")
public void consume(CouponGrabRequest request) {
    // 实际扣减库存
    couponService.grabCoupon(request);
}
```

#### Q4. 如何保证 Redis 和 DB 的一致性？

**答案**：

| 策略 | 方案 | 优缺点 |
|------|------|--------|
| **先更新DB，再删缓存** | 更新DB → 删除Redis缓存 | 经典方案，需配合延迟双删 |
| **先删缓存，再更新DB** | 删除Redis → 更新DB | 可能读到旧数据 |
| **延迟双删** | 删缓存 → 更新DB → 延迟删缓存 | 解决并发读问题 |
| **Canal监听Binlog** | DB更新 → Canal监听 → 异步删缓存 | 最终一致，解耦 |

**推荐方案（抢券场景）**：
```java
// 先更新DB，再删缓存 + 延迟双删
public void updateCoupon(Coupon coupon) {
    // 1. 更新DB
    couponMapper.update(coupon);
    
    // 2. 删除缓存
    redisTemplate.delete("coupon:" + coupon.getId());
    
    // 3. 延迟双删（100ms后再次删除，解决并发读）
    CompletableFuture.runAsync(() -> {
        try {
            Thread.sleep(100);
            redisTemplate.delete("coupon:" + coupon.getId());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    });
}
```

#### Q5. 扣减 Redis 的时候怎么样防止它重复扣减？

**答案**：
```java
// 方案1：Lua脚本保证原子性
String luaScript = """
    local key = KEYS[1]
    local userKey = KEYS[2]
    if redis.call('exists', userKey) == 1 then
        return 0  -- 已领取，返回失败
    end
    local stock = redis.call('get', key)
    if stock and tonumber(stock) > 0 then
        redis.call('decrby', key, 1)
        redis.call('set', userKey, '1', 'EX', 86400)
        return 1  -- 扣减成功
    end
    return 0  -- 库存不足
    """;

DefaultRedisScript<Long> script = new DefaultRedisScript<>(luaScript, Long.class);
script.setScriptText(luaScript);
Long result = redisTemplate.execute(script, 
    Arrays.asList("coupon:stock:" + couponId, "coupon:user:" + userId));
```

#### Q6. 数据存在哪里？

**答案**：
- **Redis**：库存数量、用户领取状态（热数据，快速访问）
- **DB（MySQL）**：订单记录、领券记录、库存流水（持久化，最终依据）
- **MQ**：待处理请求（缓冲）

#### Q7. 在里面落了一个数据怎么就不会扣减？

**答案**：通过**用户领取标记**判断：
```
扣减前检查 → redis.exists("coupon:user:" + userId) 
  → 存在：已领取，跳过
  → 不存在：执行扣减，写入标记
```

#### Q8. 是落库之前去查一下吗？

**答案**：
```
Redis检查（快速拦截）→ DB检查（最终确认）→ 扣减 → 落库
```
- Redis 做第一层快速拦截（大部分重复请求在此拦截）
- DB 做最终确认（防止Redis数据丢失/过期导致重复）

#### Q9. Redis 里面是不是有过期时间？

**答案**：是的，用户领取标记需要设置过期时间（如24小时），防止数据无限增长。但过期时间设置需权衡：
- 太短：过期后可能重复扣减
- 太长：占用内存

#### Q10. 两个线程如果都没有查到这个数据就会同时写入？

**答案**：这就是**并发竞争问题**。解决方案：
- **Redis Lua脚本**：原子性检查+扣减
- **分布式锁**：Redisson SETNX
- **DB唯一索引**：防止重复插入

#### Q11. 线程 B 为什么一定能查到 A 的数据？

**答案**：这取决于**锁机制**：
- 如果用了分布式锁，B 会等待 A 释放锁后再执行，此时能查到 A 写入的数据
- 如果没加锁，B 可能查不到（并发竞争）

#### Q12. A 和 B 同时获取锁，A 就开始执行业务，为什么 B 最后还会查一次呢？

**答案**：这是**Double-Check（双重检查）**模式：
```java
// 获取锁前检查（第一次）
if (redis.exists(userKey)) return;

lock.lock();
try {
    // 获取锁后再次检查（第二次）
    if (redis.exists(userKey)) return;  // B在这里发现A已处理
    
    // 执行业务
    redis.decr(stockKey);
    redis.set(userKey, "1");
} finally {
    lock.unlock();
}
```
B 获取锁后再次检查，是因为 A 可能已经处理完了。

#### Q13. 那这不应该是查询？应该是互斥写入吧？

**答案**：面试官说得对。更准确的描述是**互斥写入 + 双重检查**：
- 查询是前置判断
- 核心是互斥写入（锁保证同一时刻只有一个线程写入）

#### Q14. 在缓存里面你用这个办法，在 DB 里面怎么保证只执行一次？

**答案**：
- **唯一索引**：`(user_id, coupon_id)` 联合唯一索引
- **INSERT IGNORE / ON DUPLICATE KEY UPDATE**

```sql
CREATE UNIQUE INDEX uk_user_coupon ON coupon_grab_record(user_id, coupon_id);

INSERT IGNORE INTO coupon_grab_record(user_id, coupon_id, amount, create_time)
VALUES (#{userId}, #{couponId}, #{amount}, NOW());
```

#### Q15. 领券的数量为什么也作为幂等联合索引的一部分呢？

**答案**：
- 同一用户可能领多张券（不同场次/不同批次）
- 如果只按 `(user_id, coupon_id)` 做唯一索引，同用户第二次领取同一券会被拦截
- 加入 `amount` 或 `batch_no` 可以区分不同批次的领取

**更合理的方案**：用 `(user_id, coupon_id, batch_no)` 或 `(user_id, order_id)`

#### Q16. 这怎么做幂等判定？

**答案**：
```java
// 方案1：唯一索引 + INSERT IGNORE
int rows = mapper.insertIgnore(record);
if (rows == 0) {
    // 已存在，幂等拦截
    return Response.fail("已领取");
}

// 方案2：先查询再插入（需配合分布式锁）
if (mapper.existsByUserIdAndCouponId(userId, couponId)) {
    return Response.fail("已领取");
}
mapper.insert(record);
```

#### Q17. 怎样区分第二次是用户自己的行为还是系统重试行为？

**答案**：
- **用户行为**：不同的 `orderId` / `requestId`
- **系统重试**：相同的 `messageId` / `requestId`

```java
// 用 messageId 做幂等键
String idempotentKey = "idempotent:" + messageId;
if (redisTemplate.opsForValue().setIfAbsent(idempotentKey, "1", 5, TimeUnit.MINUTES)) {
    // 首次请求，执行
    process(request);
} else {
    // 重复请求，直接返回
    return Response.success("处理中");
}
```

#### Q18. 那这只是在 Redis 里面做防重？DB 里面有没有更好的方法？

**答案**：
- **DB 唯一索引**是最可靠的防重手段
- Redis 做快速拦截（性能），DB 做最终保障（可靠性）
- 两者配合：Redis 防重 + DB 唯一索引兜底

#### Q19. messageId？

**答案**：
- `messageId` 是 MQ 消息的唯一标识
- 每条消息有唯一 ID，可用于幂等判定
- 消费者处理前检查 messageId 是否已处理，避免重复消费

#### Q20. 分库分表的话，怎样才能保证唯一性？

**答案**：

| 方案 | 说明 |
|------|------|
| **分布式ID** | 雪花算法（Snowflake），保证全局唯一 |
| **分库分表键** | 按 `user_id` 分片，同一用户数据在同一库表 |
| **全局唯一索引表** | 单独一张表维护唯一性 |
| **Redis预分配** | Redis 自增ID分配给各分片 |

```java
// 雪花算法生成全局唯一ID
public class SnowflakeIdGenerator {
    private static final long WORKER_ID_BITS = 5L;
    private static final long DATA_CENTER_ID_BITS = 5L;
    private static final long SEQUENCE_BITS = 12L;
    
    private long workerId;
    private long dataCenterId;
    private long sequence = 0L;
    private long lastTimestamp = -1L;
    
    public synchronized long nextId() {
        long timestamp = timeGen();
        if (timestamp == lastTimestamp) {
            sequence = (sequence + 1) & ~(-1L << SEQUENCE_BITS);
            if (sequence == 0) {
                timestamp = tilNextMillis(lastTimestamp);
            }
        } else {
            sequence = 0L;
        }
        lastTimestamp = timestamp;
        return ((timestamp - EPOCH) << TIMESTAMP_LEFT_SHIFT)
             | (dataCenterId << DATA_CENTER_ID_SHIFT)
             | (workerId << WORKER_ID_SHIFT)
             | sequence;
    }
}
```

#### Q21. MQ 怎么保证 Redis 扣减完一定写入了数据库？

**答案**：
- **事务消息**：MQ 支持事务消息，确保消息发送与本地事务一致
- **补偿机制**：定时任务扫描未完成的记录，补偿写入
- **ACK机制**：消费者处理完成后发送 ACK，未 ACK 的消息重新投递

#### Q22. 补偿机制可以具体说一下吗？

**答案**：
```java
// 定时补偿任务
@Scheduled(cron = "0 */5 * * * ?")  // 每5分钟执行
public void compensate() {
    // 查找 Redis 已扣减但 DB 未写入的记录
    List<String> keys = redisTemplate.keys("coupon:pending:*");
    for (String key : keys) {
        String orderId = key.replace("coupon:pending:", "");
        // 检查 DB 是否已有记录
        if (!orderMapper.existsById(orderId)) {
            // 补偿写入
            Order order = redisTemplate.opsForValue().get(key);
            orderMapper.insert(order);
            redisTemplate.delete(key);
        }
    }
}
```

#### Q23. 如果我因为网络超时没有收到 ACK 怎么办？

**答案**：
- **MQ 自动重试**：未收到 ACK，MQ 会重新投递（可能重复）
- **幂等消费**：消费者必须幂等，通过 messageId 防重
- **手动 ACK**：处理完成后再 ACK，避免消息丢失

```java
@RabbitListener(queues = "coupon.grab", ackMode = "MANUAL")
public void consume(Message message, Channel channel) throws IOException {
    String messageId = message.getMessageProperties().getMessageId();
    
    try {
        // 幂等检查
        if (idempotentChecker.isProcessed(messageId)) {
            channel.basicAck(message.getMessageProperties().getDeliveryTag(), false);
            return;
        }
        
        // 处理业务
        process(message);
        
        // 标记已处理
        idempotentChecker.markProcessed(messageId);
        
        // 手动ACK
        channel.basicAck(message.getMessageProperties().getDeliveryTag(), false);
    } catch (Exception e) {
        //  nack，重新投递
        channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, true);
    }
}
```

#### Q24. 如果用 MQ 的事务消息我该怎么做？

**答案**：
```java
// RocketMQ 事务消息示例
TransactionMQProducer producer = new TransactionMQProducer("transaction_group");
producer.setTransactionListener(new TransactionListener() {
    @Override
    public LocalTransactionState execute(Message msg, Object arg) {
        try {
            // 执行本地事务（扣减Redis + 写DB）
            couponService.grabCoupon((CouponRequest) arg);
            return LocalTransactionState.COMMIT;
        } catch (Exception e) {
            return LocalTransactionState.ROLLBACK;
        }
    }
    
    @Override
    public LocalTransactionState checkLocalTransaction(Message msg) {
        // 回查本地事务状态
        String orderId = msg.getHeaders().get("orderId");
        if (orderMapper.existsById(orderId)) {
            return LocalTransactionState.COMMIT;
        }
        return LocalTransactionState.ROLLBACK;
    }
});
```

#### Q25. 锁加到哪里？

**答案**：

| 锁类型 | 加锁位置 | 适用场景 |
|--------|----------|----------|
| **分布式锁** | 扣减Redis前 | 多实例部署 |
| **synchronized** | 单实例方法级 | 单机场景 |
| **Redisson锁** | 关键业务代码块 | 分布式场景 |
| **DB行锁** | SELECT ... FOR UPDATE | 数据库层面 |

```java
// Redisson分布式锁
RLock lock = redisson.getLock("coupon:lock:" + couponId);
try {
    if (lock.tryLock(3, 10, TimeUnit.SECONDS)) {
        // 扣减库存
        couponService.grab(couponId, userId);
    }
} finally {
    if (lock.isHeldByCurrentThread()) {
        lock.unlock();
    }
}
```

---

### 第二部分：MySQL 与并发编程（26-38题）

#### Q26. 这里的 producer 和 broker 分别是谁？

**答案**：
- **Producer（生产者）**：应用服务（抢券接口），负责发送消息到 MQ
- **Broker（消息中间件）**：MQ 服务器（如 RocketMQ/RabbitMQ/Kafka），负责消息存储和转发
- **Consumer（消费者）**：异步处理服务，从 MQ 拉取消息处理

#### Q27. 先发消息还是先写 Redis？

**答案**：

**抢券场景**：先写 Redis（扣减库存），再发消息（异步落库）
```
用户请求 → Redis扣减库存（快速响应） → 发送MQ消息 → 消费者异步写DB
```

**原因**：
- Redis 扣减是核心操作，必须立即完成
- 写 DB 可以异步，通过 MQ 削峰

#### Q28. MySQL 的查询过程中怎么优化性能？

**答案**：

| 优化方向 | 具体措施 |
|----------|----------|
| **索引优化** | 合理建索引、避免索引失效、覆盖索引 |
| **SQL优化** | 避免 SELECT *、优化 JOIN、避免子查询 |
| **表设计** | 范式与反范式、分库分表、读写分离 |
| **查询优化** | LIMIT 分页优化、避免全表扫描 |
| **配置优化** | 调整 buffer_pool、连接数等参数 |

#### Q29. 如果有一张表有 A、B 两个字段，根据 A 查、根据 B 查、根据 A 和 B 查，怎样建索引？

**答案**：建一个**联合索引** `(A, B)` 即可覆盖三种查询。

#### Q30. 索引的底层结构是什么？

**答案**：**B+ 树**
- 非叶子节点只存储索引，不存储数据
- 叶子节点存储数据，并通过链表连接
- 支持范围查询和等值查询

#### Q31. 为什么是这个底层结构？

**答案**：

| 对比 | B+树 | B树 | Hash | 红黑树 |
|------|------|-----|------|--------|
| 范围查询 | ✅ 叶子节点链表 | ❌ | ❌ | ✅ 但树高较高 |
| 磁盘IO | ✅ 树矮胖，IO少 | 较多 | - | 较多 |
| 等值查询 | ✅ O(log n) | ✅ | ✅ O(1) | ✅ O(log n) |
| 全表扫描 | ✅ 链表顺序遍历 | ❌ | - | - |

B+树的优势：
- **树更矮**：非叶子节点只存索引，单节点可存更多索引项
- **范围查询友好**：叶子节点链表
- **查询稳定**：所有数据都在叶子节点，查询路径长度一致

#### Q32. 一个 SQL 到底可以走几个索引？

**答案**：
- **MySQL 5.x**：一般只走 1 个索引（最左前缀）
- **MySQL 8.x**：支持 Index Merge，可以走多个索引
- **最佳实践**：尽量用联合索引，避免 Index Merge（效率不如单个联合索引）

#### Q33. 如果表里有 age 字段索引，先通过 A 字段找到了索引树上的某个位置，那还能不能再根据 B 字段继续走 B 字段索引？

**答案**：
- 如果建了联合索引 `(A, B)`，可以继续使用 B 字段的排序（**索引下推**）
- 如果分别建了 `(A)` 和 `(B)` 两个单列索引，MySQL 5.x 只能选其中一个

#### Q34. 这种情况下，一共要建几个索引？最终这张表一共建几个索引？

**答案**：**1个联合索引** `(A, B)` 即可。
- 根据 A 查：走联合索引的 A 部分（最左前缀）
- 根据 A 和 B 查：走完整联合索引
- 根据 B 查：如果 A 是等值条件，可以利用索引下推；如果只按 B 查，需要额外建 `(B)` 索引

#### Q35. 如果现在有三个索引，还能不能砍掉一个索引？

**答案**：
- **最左前缀原则**：如果有 `(A)`、`(A, B)`、`(A, B, C)`，可以砍掉 `(A)` 和 `(A, B)`，只保留 `(A, B, C)`
- **索引覆盖**：如果查询字段都在索引中，不需要回表

#### Q36. 在抢券项目中，大量用户同时请求，为什么多线程能提升系统性能？

**答案**：
- **CPU 空闲时间利用**：IO 操作（网络、磁盘）时 CPU 空闲，多线程可充分利用
- **并发处理**：多核 CPU 可同时处理多个请求
- **吞吐量提升**：单位时间内处理更多请求

```
单线程：请求1 [处理---IO等待---处理] → 请求2 [处理---IO等待---处理]
多线程：请求1 [处理---IO等待---处理]
        请求2       [处理---IO等待---处理]
```

#### Q37. 多线程会带来线程安全问题，线程安全问题是由什么原因导致的？

**答案**：
1. **共享变量**：多个线程访问同一个变量
2. **非原子操作**：如 `count++` 实际是读-改-写三步
3. **内存可见性**：线程缓存导致其他线程看不到最新值
4. **指令重排**：编译器/CPU 优化导致执行顺序变化

#### Q38. 乐观锁和悲观锁分别适用于什么场景？

**答案**：

| 锁类型 | 机制 | 适用场景 |
|--------|------|----------|
| **悲观锁** | 假设会冲突，先加锁再操作 | 写多读少，冲突频繁 |
| **乐观锁** | 假设不会冲突，更新时检查版本 | 读多写少，冲突少 |

```java
// 悲观锁：SELECT ... FOR UPDATE
SELECT stock FROM coupon WHERE id = #{id} FOR UPDATE;

// 乐观锁：version 字段
UPDATE coupon SET stock = stock - 1, version = version + 1
WHERE id = #{id} AND version = #{version};
```

---

### 第三部分：RAG 与大模型（39-42题）

#### Q39. 你的 RAG 系统大致有哪些核心模块？

**答案**：

```
┌──────────────────────────────────────────────┐
│              RAG 核心模块                     │
├──────────────────────────────────────────────┤
│ 1. 文档解析    → PDF/Word/HTML 解析为文本     │
│ 2. 文档切分    → 按语义/固定长度 chunk        │
│ 3. 向量化      → Embedding 模型生成向量       │
│ 4. 向量存储    → Milvus/FAISS 存储向量        │
│ 5. 检索召回    → 向量检索 + BM25 混合检索      │
│ 6. 重排序      → Cross-Encoder 精排           │
│ 7. 上下文组装  → Prompt 拼接检索结果           │
│ 8. 大模型生成  → LLM 基于上下文生成答案        │
└──────────────────────────────────────────────┘
```

#### Q40. RAG 里的问题重写是基于什么来重写用户问题的？

**答案**：
- **对话历史**：利用多轮对话上下文，补全省略/指代
- **领域知识**：结合业务领域术语，规范化表达
- **用户意图**：识别用户真实意图，扩展同义词

```java
// 问题重写 Prompt
String rewritePrompt = """
    你是一个问题重写助手。基于以下对话历史，重写用户最新问题，
    使其更清晰、完整、适合检索。
    
    对话历史：{history}
    用户问题：{query}
    
    要求：
    1. 补全省略和指代
    2. 扩展同义词和相关专业术语
    3. 保持原意不变
    4. 输出重写后的问题
    """;
```

#### Q41. 问题重写的输出标准是什么？如何界定重写得好不好？

**答案**：

| 标准 | 说明 | 评估方法 |
|------|------|----------|
| **语义一致性** | 重写后不改变原意 | 人工评估 / LLM 打分 |
| **检索效果** | 重写后检索召回率提升 | Recall@K 对比 |
| **完整性** | 补全了必要的上下文 | 人工检查 |
| **简洁性** | 不过度扩展，保持精炼 | 长度控制 |

**评估方法**：
- **离线**：构建 (原始问题, 重写问题, 标准答案) 数据集，计算检索指标
- **线上**：A/B 测试，对比重写前后的回答采纳率

#### Q42. RAG 系统中，如果把检索内容、用户提问、会话记忆都放进大模型，但上下文窗口有限，记忆超出上下文窗口时，怎么做上下文裁剪？

**答案**：

| 策略 | 说明 |
|------|------|
| **滑动窗口** | 保留最近 N 轮对话，丢弃更早的 |
| **摘要压缩** | 用 LLM 对历史对话生成摘要 |
| **重要性排序** | 按相关性/时间衰减排序，保留 Top-K |
| **混合策略** | 最近对话保留完整 + 早期对话摘要 |

```java
// 上下文裁剪策略
public String compressContext(List<Message> history, int maxTokens) {
    if (calculateTokens(history) <= maxTokens) {
        return formatMessages(history);
    }
    
    // 策略：保留最近5轮完整 + 更早的生成摘要
    int recentCount = Math.min(5, history.size());
    List<Message> recent = history.subList(
        Math.max(0, history.size() - recentCount), history.size());
    List<Message> old = history.subList(0, 
        Math.max(0, history.size() - recentCount));
    
    // 对早期对话生成摘要
    String summary = llm.summarize(formatMessages(old));
    
    // 组装：摘要 + 最近对话
    return "【历史摘要】" + summary + "\n【最近对话】" + formatMessages(recent);
}
```

---

### 第四部分：AI Coding（43-47题）

#### Q43. 你之前用过哪些 AI Coding 软件？

**答案**（参考）：
- **Claude Code（Claude Code / Anthropic）**：支持 Agent 模式、Plan 模式
- **Cursor**：基于 VS Code，支持代码补全和对话
- **GitHub Copilot**：代码补全、Chat、Agent
- **Windsurf（Codeium）**：AI 编辑器
- **OpenClaw + Hermes Agent**：自研 AI 编码工作流

#### Q44. 作为一个 Harness 工程，codex 大致有哪些模块构成？

**答案**：

```
Claude Code / Codex 工程结构：
├── src/
│   ├── agent/          # Agent 核心逻辑
│   │   ├── planner/    # 计划生成
│   │   ├── executor/   # 任务执行
│   │   └── reviewer/   # 代码审查
│   ├── tools/          # 工具集
│   │   ├── terminal/   # 终端执行
│   │   ├── editor/     # 代码编辑
│   │   └── search/     # 代码搜索
│   ├── memory/         # 记忆系统
│   │   ├── short/      # 短期记忆
│   │   └── long/       # 长期记忆
│   └── llm/            # LLM 接口
├── config/             # 配置文件
└── skills/             # 技能库
```

#### Q45. 你是否了解 AI Coding 里的 Plan 模式？也就是先让模型生成计划再执行。

**答案**：

**Plan 模式**：先让 LLM 生成执行计划，再按步骤执行。

```
用户需求
  ↓
LLM 生成计划（Plan）
  ├─ Step 1: 分析代码结构
  ├─ Step 2: 修改文件 A
  ├─ Step 3: 修改文件 B
  └─ Step 4: 运行测试
  ↓
按步骤执行
  ↓
每步验证 + 反馈
  ↓
完成
```

**优势**：
- 全局视角，避免盲目修改
- 可审查、可调整
- 减少 token 消耗（一次生成计划，多次执行）

#### Q46. Plan 模式和 CoT 思维链有什么区别？

**答案**：

| 对比 | Plan 模式 | CoT（思维链） |
|------|-----------|---------------|
| **目标** | 生成可执行的步骤计划 | 引导模型逐步推理 |
| **粒度** | 宏观（任务级） | 微观（推理级） |
| **输出** | 结构化计划（Step 1/2/3） | 推理过程（Let me think step by step） |
| **执行** | 按计划逐步执行 | 模型内部推理 |
| **适用** | 复杂任务分解 | 推理/计算问题 |

**关系**：Plan 模式可以包含 CoT，在每个步骤内部使用思维链推理。

#### Q47. sub-agent 和 agent teams 在 Claude Code 里面的发展和使用？

**答案**：

| 概念 | 说明 | 应用场景 |
|------|------|----------|
| **sub-agent** | 主 Agent 派生的子 Agent，独立执行子任务 | 并行处理独立任务 |
| **agent teams** | 多个 Agent 协作完成复杂任务 | 代码审查+测试+部署流水线 |

```java
// 示例：Agent Teams 协作
class CodeReviewTeam {
    Agent developer;   // 负责编码
    Agent reviewer;    // 负责代码审查
    Agent tester;      // 负责测试
    
    public Result develop(Requirement req) {
        // 1. developer 编码
        Code code = developer.code(req);
        
        // 2. reviewer 审查
        Review review = reviewer.review(code);
        if (review.needsFix) {
            code = developer.fix(code, review.comments);
        }
        
        // 3. tester 测试
        TestResult result = tester.test(code);
        return result;
    }
}
```

**Claude Code 中的实践**：
- 主 Agent 负责任务分解和协调
- sub-agent 并行执行独立子任务（如同时修改多个文件）
- agent teams 实现流水线式协作（编码→审查→测试→部署）

---

## 三、面试要点总结

### 3.1 知识体系

| 方向 | 必考知识点 |
|------|------------|
| **高并发** | MQ削峰、Redis扣减、分布式锁、幂等性、补偿机制 |
| **MySQL** | 索引优化、B+树、联合索引、最左前缀、索引下推 |
| **并发编程** | 多线程原理、线程安全、乐观锁/悲观锁 |
| **RAG** | 核心模块、问题重写、上下文裁剪、检索评测 |
| **AI Coding** | Plan模式、CoT、sub-agent、agent teams |

### 3.2 高频考点串联

**抢券场景完整链路**：
```
用户请求 → MQ削峰 → Redis Lua原子扣减 → 分布式锁防重
  → DB唯一索引兜底 → MQ异步落库 → 补偿机制保障
```

**索引优化核心**：
```
联合索引(A,B) → 最左前缀 → 索引下推 → 覆盖索引 → 避免回表
```

**RAG优化核心**：
```
问题重写 → 混合检索 → 重排序 → 上下文裁剪 → Prompt组装 → LLM生成
```

---

*整理时间：2026-05-17*
*来源：小红水面经分享*
