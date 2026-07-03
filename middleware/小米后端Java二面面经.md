# 小米 后端Java二面面经

> **来源**: 小红书
> **链接**: http://xhslink.com/o/8x4qavupqgE
> **NoteId**: 6a0bfc190000000008024568
> **作者**: 寄意
> **标签**: #面试 #面经 #小米 #Java #后端
> **考点分类**: 分布式事务、Redis、RabbitMQ、高并发、Java并发、算法

---

## 基本信息

- **侧重**: 分布式 + 中间件 + 高并发
- **时长**: 50分钟
- **形式**: 线上视频（腾讯会议）
- **考察侧重**: 分布式架构、中间件应用、高并发场景处理

---

## 一、自我介绍（3分钟）

**答题要点**:
- 重点介绍分布式相关项目经验
- 说明使用过的中间件（Redis、RabbitMQ 等）
- 举例解决过的高并发问题
- 展示对分布式架构的理解

---

## 二、核心问题

### （1）分布式事务

**Q: 什么是分布式事务？常见的分布式事务解决方案有哪些（2PC、TCC、本地消息表等）？分别说说它们的优缺点，小米的订单系统中可能会用哪种方案，为什么？**

**答题思路**:

| 方案 | 一致性 | 性能 | 复杂度 | 优点 | 缺点 |
|------|-------|------|--------|------|------|
| 2PC/XA | 强一致 | 低 | 高 | 协议标准，实现简单 | 阻塞、单点故障 |
| TCC | 强一致 | 中 | 高 | 性能较好，细粒度控制 | 编码量大，补偿逻辑复杂 |
| 本地消息表 | 最终一致 | 高 | 中 | 实现简单，性能好 | 依赖额外表，有延迟 |
| RocketMQ事务消息 | 最终一致 | 高 | 低 | 低侵入，性能好 | 依赖 RocketMQ |
| Seata AT | 最终一致 | 中 | 低 | 无侵入，自动补偿 | 性能有损耗 |

**小米订单场景选型**:
- 订单创建 + 库存扣减：推荐 **本地消息表** 或 **RocketMQ事务消息**（最终一致，性能好）
- 支付场景：推荐 **TCC**（强一致，资金安全）
- 理由：电商订单对性能要求高，最终一致性可接受；支付涉及资金流转，需要强一致

> ⚠️ 工程踩坑: 本地消息表方案中，消息表和订单表必须在同一事务中写入。定时任务扫描消息时，注意幂等性——消息可能发送成功但状态更新失败，导致重复发送。

### （2）Redis 核心数据结构

**Q: Redis 的核心数据结构有哪些？说说 Hash 和 ZSet 的应用场景（结合小米业务，比如用户积分、商品排序）。**

**Redis 核心数据结构**:

| 数据类型 | 底层编码 | 应用场景 |
|---------|---------|---------|
| String | SDS | 缓存、计数器、分布式锁 |
| Hash | ZipList / HashTable | 对象存储、用户信息、购物车 |
| List | QuickList | 消息队列、最新动态 |
| Set | IntSet / HashTable | 共同好友、去重 |
| ZSet | SkipList / ZipList | 排行榜、延迟队列 |
| Bitmap | SDS | 用户活跃统计、签到 |
| HyperLogLog | HyperLogLog | UV 统计 |
| Geo | ZSet | 地理位置 |

**Hash 场景 — 小米用户积分**:
```java
// 用户积分存储
String key = "points:user:" + userId;

// 增加积分
redisTemplate.opsForHash().increment(key, "total", 100);
// 记录积分明细
redisTemplate.opsForHash().put(key, "lastUpdate", System.currentTimeMillis());

// 查询积分
Long total = (Long) redisTemplate.opsForHash().get(key, "total");

// 优势: Hash 存储对象比 String(JSON) 更省内存，且支持字段级更新
```

**ZSet 场景 — 小米商品排序/排行榜**:
```java
// 商品热度排行
String key = "product:hotRank";

// 根据热度分数排序
redisTemplate.opsForZSet().add(key, "productId:1001", 95.5);
redisTemplate.opsForZSet().add(key, "productId:1002", 88.3);

// 获取 Top 10 热门商品
Set<String> top10 = redisTemplate.opsForZSet().reverseRange(key, 0, 9);

// 获取商品排名
Long rank = redisTemplate.opsForZSet().reverseRank(key, "productId:1001");

// 更新热度（实时刷新）
redisTemplate.opsForZSet().incrementScore(key, "productId:1001", 5.0);
```

> ⚠️ 工程踩坑: ZSet 在数据量大时内存消耗较高。如果排行榜数据量百万级，考虑分页查询 + 定期持久化到 DB。另外，ZSet 的 score 是 double 类型，精度有限，如果需要精确排序（如按时间+分数），需要组合 score = 分数 * 时间权重。

### （3）Redis 持久化机制

**Q: Redis 的持久化机制（RDB 和 AOF）区别，各自的优缺点，生产环境中如何选择？**

| 对比维度 | RDB | AOF |
|---------|-----|-----|
| 原理 | 定时 fork 子进程生成数据快照 | 记录每次写命令到日志文件 |
| 文件大小 | 小（压缩后） | 大（需 BGREWRITEAOF 压缩） |
| 恢复速度 | 快 | 慢 |
| 数据安全性 | 丢失最后一次快照后的数据 | 根据 fsync 策略（默认 everysec 最多丢 1 秒） |
| 性能影响 | fork 子进程时可能卡顿 | 写入有开销，everysec 影响较小 |

**生产选择**:
- 主节点：RDB（备份）+ AOF everysec（数据安全）
- 从节点：仅 RDB（用于读写分离）
- 纯缓存场景：可关闭持久化（性能最优）

### （4）Redis 分布式锁

**Q: 用 Redis 实现分布式锁的核心思路是什么？需要注意哪些问题（死锁、锁误删、单点故障）？Redisson 实现分布式锁的原理是什么，相比原生 Redis 实现有什么优势？**

**原生实现**:
```java
// 核心思路: SET NX + 过期时间
public boolean tryLock(String key, String value, long expireSeconds) {
    Boolean success = redisTemplate.opsForValue()
        .setIfAbsent(key, value, expireSeconds, TimeUnit.SECONDS);
    return Boolean.TRUE.equals(success);
}

// ⚠️ 问题1: 锁误删 — 线程A的锁过期了，线程B拿到了锁，
// 线程A执行完后删除了线程B的锁
// 解决: 删除时校验 value（UUID），保证只删自己的锁

// ⚠️ 问题2: 死锁 — 程序异常导致锁没释放
// 解决: 设置过期时间

// ⚠️ 问题3: 单点故障 — Redis 主节点挂了，锁丢失
// 解决: Redisson 红锁（RedLock）或多节点部署
```

**Redisson 原理**:
```java
RLock lock = redissonClient.getLock("myLock");
try {
    // tryLock(等待时间, 锁自动释放时间, 时间单位)
    if (lock.tryLock(10, 30, TimeUnit.SECONDS)) {
        try {
            // 业务逻辑
        } finally {
            lock.unlock();
        }
    }
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
}
```

**Redisson 优势**:
- **WatchDog 自动续期**: 默认 30s 过期，每 10s 自动续期，业务没执行完不会误删
- **可重入**: 基于 Redis Hash 结构实现可重入计数
- **原子性**: Lua 脚本保证加锁/解锁的原子性
- **支持公平锁、读写锁、红锁**

> ⚠️ 工程踩坑: Redisson 的 WatchDog 只在未指定 leaseTime 时生效。如果指定了 leaseTime，到期后不会续期。另外，RedLock 在极端网络分区下仍可能不安全，强一致性场景建议用 Zookeeper。

### （5）消息队列 RabbitMQ

**Q: RabbitMQ 的交换机类型有哪些？如何保证消息的可靠性传输？如何处理消息重复消费问题？**

**交换机类型**:

| 类型 | 路由规则 | 场景 |
|------|---------|------|
| Direct | 精确匹配 routingKey | 点对点通知 |
| Fanout | 广播到所有队列 | 广播通知 |
| Topic | 通配符匹配 routingKey | 灵活路由 |
| Headers | 匹配消息 header 属性 | 复杂条件路由 |

**消息可靠性保障**:
```
生产者 → Confirm 机制 → Broker 持久化 → 消费者 → Ack 机制
```

```java
// 生产者 Confirm
spring.rabbitmq.publisher-confirm-type=correlated
spring.rabbitmq.publisher-returns=true

@Configuration
public class RabbitConfirmConfig implements RabbitTemplate.ConfirmCallback {
    @Override
    public void confirm(CorrelationData data, boolean ack, String cause) {
        if (!ack) {
            log.error("消息发送失败: {}", cause);
            // 重试或记录到本地消息表
        }
    }
}

// 消费者手动 Ack
spring.rabbitmq.listener.simple.acknowledge-mode=manual

@RabbitListener(queues = "order.queue")
public void handleOrder(Message message, Channel channel) throws IOException {
    try {
        // 处理消息
        orderService.process(new String(message.getBody()));
        channel.basicAck(message.getMessageProperties().getDeliveryTag(), false);
    } catch (Exception e) {
        // 拒绝消息，重新入队或进死信队列
        channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, false);
    }
}
```

**消息重复消费 — 幂等性设计**:
```java
// 方案1: 数据库唯一索引
INSERT INTO order_message (message_id, order_id, status) 
VALUES (?, ?, 'PROCESSED')
ON DUPLICATE KEY UPDATE status = VALUES(status);

// 方案2: Redis SET NX
String key = "msg:processed:" + messageId;
Boolean success = redisTemplate.opsForValue().setIfAbsent(key, "1", 24, TimeUnit.HOURS);
if (!Boolean.TRUE.equals(success)) {
    return; // 已处理，幂等返回
}
```

### （6）高并发处理

**Q: 面对高并发请求，如何进行系统优化？说说你了解的限流算法（令牌桶、漏桶），小米的接口限流可能会用哪种？**

**系统优化手段**:
```
缓存层: Redis 缓存热点数据 → Caffeine 本地缓存
↓
网关层: 限流、熔断、降级
↓
应用层: 线程池调优、异步化、连接池优化
↓
数据库层: 索引优化、读写分离、分库分表
↓
架构层: 服务拆分、消息队列削峰、CDN 静态化
```

**限流算法对比**:

| 算法 | 原理 | 特点 | 场景 |
|------|------|------|------|
| 固定窗口 | 按固定时间窗口计数 | 简单，临界点突发 | 粗粒度限流 |
| 滑动窗口 | 滑动时间窗口计数 | 更平滑，内存开销大 | 精确限流 |
| 令牌桶 | 固定速率产生令牌，请求取令牌 | 允许突发流量 | API 限流 |
| 漏桶 | 固定速率处理请求，超出则丢弃 | 输出速率恒定 | 流量整形 |

**小米接口限流推荐令牌桶**:
```java
// Guava RateLimiter (令牌桶)
RateLimiter rateLimiter = RateLimiter.create(100.0); // 每秒 100 个请求

public Result queryProduct(Long productId) {
    // 尝试获取令牌，最多等待 100ms
    if (!rateLimiter.tryAcquire(100, TimeUnit.MILLISECONDS)) {
        return Result.error("RATE_LIMITED", "请求过于频繁");
    }
    return Result.success(productService.getById(productId));
}

// 小米场景: 令牌桶允许突发流量（如秒杀开始时的大流量），
// 同时保证平均速率可控，适合电商场景
```

> ⚠️ 工程踩坑: Guava RateLimiter 是单机限流，分布式场景需要 Sentinel 或 Redis + Lua 实现。Sentinel 支持 QPS/线程数限流 + 熔断降级 + 热点参数限流，更适合生产环境。

### （7）Java 并发 — 线程池

**Q: 线程池的核心参数有哪些？核心线程数和最大线程数如何设置？线程池的拒绝策略有哪些？在项目中如何使用线程池处理并发任务？**

**7 大参数**:
```java
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    corePoolSize,              // 核心线程数
    maximumPoolSize,           // 最大线程数
    keepAliveTime,             // 空闲线程存活时间
    unit,                      // 时间单位
    workQueue,                 // 工作队列
    threadFactory,             // 线程工厂
    handler                    // 拒绝策略
);
```

**参数设置建议**:
```java
// CPU 密集型: corePoolSize = CPU 核数 + 1
int cpuCore = Runtime.getRuntime().availableProcessors();
int coreSize = cpuCore + 1;

// IO 密集型: corePoolSize = CPU 核数 * (1 + 平均等待时间/平均计算时间)
// 假设等待:计算 = 4:1，则 corePoolSize = cpuCore * 5
int ioSize = cpuCore * 5;

// 最大线程数一般为核心线程数的 2-3 倍
int maxSize = coreSize * 2;

// 队列: 有界队列（ArrayBlockingQueue），防止 OOM
BlockingQueue<Runnable> queue = new ArrayBlockingQueue<>(500);
```

**4 种拒绝策略**:

| 策略 | 行为 | 场景 |
|------|------|------|
| AbortPolicy (默认) | 抛 RejectedExecutionException | 需要告警的场景 |
| CallerRunsPolicy | 调用者线程执行 | 允许降级的场景 |
| DiscardPolicy | 静默丢弃 | 可丢失的监控数据 |
| DiscardOldestPolicy | 丢弃队列最老任务 | 优先级低的场景 |

**项目中使用线程池**:
```java
// 异步处理非核心逻辑（如发送通知、记录日志）
@Async("orderExecutor")
public CompletableFuture<Void> sendOrderNotification(Order order) {
    // 发送邮件/短信通知
    notificationService.send(order.getUserId(), "订单创建成功");
    return CompletableFuture.completedFuture(null);
}

// 并发查询优化（并行查询多个数据源）
CompletableFuture<User> userFuture = CompletableFuture.supplyAsync(
    () -> userService.getById(userId), executor);
CompletableFuture<List<Order>> orderFuture = CompletableFuture.supplyAsync(
    () -> orderService.listByUserId(userId), executor);

CompletableFuture.allOf(userFuture, orderFuture).join();
User user = userFuture.join();
List<Order> orders = orderFuture.join();
```

> ⚠️ 工程踩坑: 线程池一定要自定义 ThreadFactory，设置有意义的线程名，方便排查问题。子线程中 ThreadLocal 不传递，用 TransmittableThreadLocal。禁止使用 Executors 创建线程池（可能 OOM）。

### （8）项目相关 — 缓存三大问题

**Q: 项目中用到了分布式缓存，有没有遇到过缓存穿透、缓存击穿、缓存雪崩问题？分别是怎么解决的？**

详见 [蚂蚁终面面经](蚂蚁后端Java终面面经.md) 中的详细解答。

### （9）算法题 — LRU 缓存

**Q: 手写一个 LRU 缓存淘汰算法（要求时间复杂度 O(1)），并讲解思路，结合 Redis 的近似 LRU 实现说说优化方向。**

**手写实现**:
```java
public class LRUCache<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;
    
    public LRUCache(int capacity) {
        // accessOrder=true 表示按访问顺序排序
        super(capacity, 0.75f, true);
        this.capacity = capacity;
    }
    
    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;
    }
    
    // 时间复杂度: get/put 都是 O(1)
    // 底层: HashMap + 双向链表
}

// 手动实现版本
public class LRUCacheManual<K, V> {
    private final Map<K, Node<K, V>> map;
    private final DoublyLinkedList<K, V> list;
    private final int capacity;
    
    public LRUCacheManual(int capacity) {
        this.capacity = capacity;
        this.map = new HashMap<>();
        this.list = new DoublyLinkedList<>();
    }
    
    public V get(K key) {
        Node<K, V> node = map.get(key);
        if (node == null) return null;
        list.moveToHead(node);  // O(1)
        return node.value;
    }
    
    public void put(K key, V value) {
        if (map.containsKey(key)) {
            map.get(key).value = value;
            list.moveToHead(map.get(key));
        } else {
            if (map.size() >= capacity) {
                Node<K, V> tail = list.removeTail();  // O(1)
                map.remove(tail.key);
            }
            Node<K, V> node = new Node<>(key, value);
            list.addToHead(node);  // O(1)
            map.put(key, node);
        }
    }
}
```

**Redis 近似 LRU**:
- Redis 的 `maxmemory-policy allkeys-lru` 不是真正的 LRU，而是 **近似 LRU**
- 实现方式: 随机采样（默认 5 个 key），淘汰其中最久未使用的
- 优势: 内存开销小（不需要为每个 key 维护 lru_clock），性能高
- 劣势: 精度不如真实 LRU
- 优化方向: 增加采样数量（`maxmemory-samples`），或使用 LFU（least-frequently-used）替代

---

## 三、反问环节（2分钟）

**建议提问**:
1. 团队目前在分布式架构方面有哪些技术难点或优化方向？
2. 日常开发中，如何进行系统监控和问题排查，会用到哪些工具？

---

## 总结

| 模块 | 重要程度 |
|------|---------|
| 分布式事务 | ⭐⭐⭐⭐⭐ |
| Redis（数据结构/持久化/分布式锁/缓存问题） | ⭐⭐⭐⭐⭐ |
| RabbitMQ（可靠性/幂等） | ⭐⭐⭐⭐ |
| 高并发（限流算法/系统优化） | ⭐⭐⭐⭐ |
| Java 并发（线程池） | ⭐⭐⭐⭐ |
| 算法（LRU） | ⭐⭐⭐ |

**面试特点**: 侧重分布式 + 中间件 + 高并发，Redis 是绝对重点（问了 4 道相关题），需要深入理解每个知识点并能结合业务场景分析。
