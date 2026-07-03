# 联想 后端Java二面面经

> **来源**: 小红书
> **链接**: http://xhslink.com/o/1rw4gVj293I
> **NoteId**: 6a0c068d0000000036000fe3
> **标签**: #面试 #面经 #联想 #Java #后端
> **考点分类**: 业务场景、问题排查、中间件、Linux、英文、算法

---

## 基本信息

- **侧重**: 业务场景 + 问题排查 + 英文考察
- **时长**: 45分钟
- **面试官**: 2位技术面试官 + 1位HR（侧重业务理解+综合能力，含英文提问）
- **难度**: 偏上

---

## 一、自我介绍（中英文各1分钟）

**中文自我介绍要点**:
- 重点介绍项目经验和技术能力
- 突出与岗位匹配的技能栈
- 简述个人优势和职业目标

**英文自我介绍要点**:
- 简要介绍学习或工作经历
- 准备常用技术词汇的英文表达
- 保持简洁，控制在一分钟内

> ⚠️ 面试技巧: 英文自我介绍不需要太复杂，重点是能流畅表达。可以提前准备模板，但要根据实际情况灵活调整。

---

## 二、业务场景题

**Q: 假设联想某后端系统，用户量突增，出现接口响应变慢，你怎么分析和优化？从数据库、缓存、服务器等多个维度说明。**

### 2.1 排查思路

```
1. 监控定位 → Prometheus/Grafana 查看指标
   - QPS、响应时间、错误率、CPU、内存、磁盘IO
   
2. 链路追踪 → SkyWalking/Zipkin 定位瓶颈
   - 查看哪个服务/接口慢
   - 查看慢查询SQL
   
3. 日志分析 → ELK/Grep 查找异常
   - 查看错误日志、慢查询日志
   - 分析GC日志
```

### 2.2 数据库维度优化

```sql
-- 1. 慢查询优化
-- 查看慢查询日志
SHOW VARIABLES LIKE 'slow_query%';

-- 使用 EXPLAIN 分析执行计划
EXPLAIN SELECT * FROM orders WHERE user_id = 123 AND status = 1;
-- 关注: type (ALL→index→range→ref→eq_ref→const)
-- 关注: rows (扫描行数)
-- 关注: Extra (Using filesort/Using temporary 需要优化)

-- 2. 索引优化
-- 联合索引遵循最左前缀原则
CREATE INDEX idx_user_status ON orders(user_id, status);

-- 3. 读写分离
-- 主库写入，从库查询
-- 使用 MyCat/ShardingSphere 实现读写分离

-- 4. 分库分表
-- 当单表数据量超过 1000万 或 5GB 时考虑分表
-- 按 user_id 取模分片
```

### 2.3 缓存维度优化

```java
// 1. 热点数据缓存
@Service
public class ProductService {
    
    @Autowired private StringRedisTemplate redisTemplate;
    @Autowired private ProductMapper productMapper;
    
    // 缓存查询
    public Product getProductById(Long id) {
        String key = "product:" + id;
        String cached = redisTemplate.opsForValue().get(key);
        if (cached != null) {
            return JSON.parseObject(cached, Product.class);
        }
        
        Product product = productMapper.selectById(id);
        if (product != null) {
            redisTemplate.opsForValue().set(key, JSON.toJSONString(product), 30, TimeUnit.MINUTES);
        }
        return product;
    }
}

// 2. 缓存穿透防护（布隆过滤器）
@Component
public class BloomFilterHelper {
    @Autowired private RedisTemplate redisTemplate;
    
    public boolean mightExist(String key) {
        return redisTemplate.opsForValue().getBit("bloom:" + key, 0);
    }
}

// 3. 缓存击穿防护（分布式锁）
public Product getProductWithLock(Long id) {
    String key = "product:" + id;
    String cached = redisTemplate.opsForValue().get(key);
    if (cached != null) return JSON.parseObject(cached, Product.class);
    
    String lockKey = "lock:product:" + id;
    boolean locked = redisTemplate.opsForValue().setIfAbsent(lockKey, "1", 10, TimeUnit.SECONDS);
    
    if (locked) {
        try {
            // 双重检查
            cached = redisTemplate.opsForValue().get(key);
            if (cached != null) return JSON.parseObject(cached, Product.class);
            
            Product product = productMapper.selectById(id);
            redisTemplate.opsForValue().set(key, JSON.toJSONString(product), 30, TimeUnit.MINUTES);
            return product;
        } finally {
            redisTemplate.delete(lockKey);
        }
    } else {
        // 没拿到锁，休眠后重试
        Thread.sleep(50);
        return getProductWithLock(id);
    }
}

// 4. 缓存雪崩防护（过期时间加随机值）
public void setCache(String key, String value) {
    long expire = 30 * 60 + ThreadLocalRandom.current().nextInt(0, 300);
    redisTemplate.opsForValue().set(key, value, expire, TimeUnit.SECONDS);
}
```

### 2.4 服务器维度优化

```java
// 1. 线程池调优
@Configuration
public class ThreadPoolConfig {
    
    @Bean("orderExecutor")
    public ThreadPoolExecutor orderExecutor() {
        int cpuCore = Runtime.getRuntime().availableProcessors();
        // IO密集型: CPU核数 * (1 + 平均等待时间/平均计算时间)
        int coreSize = cpuCore * 5;
        int maxSize = coreSize * 2;
        
        return new ThreadPoolExecutor(
            coreSize,
            maxSize,
            60, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(1000),
            new ThreadFactoryBuilder()
                .setNameFormat("order-pool-%d")
                .setUncaughtExceptionHandler((t, e) -> 
                    log.error("Thread {} error", t.getName(), e))
                .build(),
            new ThreadPoolExecutor.CallerRunsPolicy()
        );
    }
}

// 2. 异步化非核心逻辑
@Async("orderExecutor")
public CompletableFuture<Void> sendNotification(Long userId, String message) {
    notificationService.send(userId, message);
    return CompletableFuture.completedFuture(null);
}

// 3. 连接池优化
// 数据库连接池: HikariCP
spring.datasource.hikari.maximum-pool-size=50
spring.datasource.hikari.minimum-idle=10
spring.datasource.hikari.connection-timeout=30000

// HTTP连接池: Apache HttpClient
CloseableHttpClient httpClient = HttpClients.custom()
    .setMaxConnTotal(200)
    .setMaxConnPerRoute(50)
    .build();
```

### 2.5 架构层面优化

```
1. 水平扩展: 增加服务器节点，通过负载均衡分发流量
   - Nginx 负载均衡（轮询/加权轮询/IP Hash）
   - 服务无状态化

2. 垂直扩展: 提升单机性能
   - 升级CPU、内存、SSD
   - 优化JVM参数

3. 服务降级: 非核心功能降级
   - 使用 Sentinel/Hystrix 实现熔断降级
   - 优先保证核心链路

4. 限流: 保护系统不被打垮
   - 令牌桶算法（允许突发流量）
   - Sentinel 限流规则

5. 消息队列削峰: 异步处理
   - 用户请求 → MQ → 消费者处理
   - 平滑流量峰值
```

> ⚠️ 工程踩坑: 排查性能问题一定要基于数据说话，不要凭感觉。先用监控工具定位瓶颈，再针对性优化。优化后也要有数据对比，证明优化有效。

---

## 三、项目深挖

**Q: 你做的项目中，有没有涉及到高并发场景？怎么设计的，有没有做过压测？压测中发现的问题怎么解决的？**

### 3.1 高并发项目设计示例

```java
// 秒杀系统设计
@Service
public class FlashSaleService {
    
    @Autowired private StringRedisTemplate redisTemplate;
    @Autowired private RocketMQTemplate rocketMQTemplate;
    
    // 1. 预热: 活动开始前将库存加载到 Redis
    @Scheduled(cron = "0 55 23 * * ?")
    public void preloadStock() {
        List<Product> products = productMapper.selectActiveFlashSale();
        for (Product p : products) {
            String key = "flashsale:stock:" + p.getId();
            redisTemplate.opsForValue().set(key, String.valueOf(p.getStock()));
        }
    }
    
    // 2. 限流: 令牌桶
    private final RateLimiter rateLimiter = RateLimiter.create(1000.0);
    
    // 3. 防刷: 用户维度限频
    public boolean checkAntiSpam(Long userId, Long productId) {
        String key = "flashsale:user:" + productId + ":" + userId;
        return Boolean.TRUE.equals(
            redisTemplate.opsForValue().setIfAbsent(key, "1", 24, TimeUnit.HOURS)
        );
    }
    
    // 4. 抢购: Redis 预扣减
    public boolean preDeduct(Long productId) {
        String key = "flashsale:stock:" + productId;
        
        // Lua 脚本保证原子性
        String luaScript = """
            local stock = tonumber(redis.call('GET', KEYS[1]))
            if stock == false or stock < 1 then
                return 0
            end
            redis.call('DECRBY', KEYS[1], 1)
            local newStock = tonumber(redis.call('GET', KEYS[1]))
            if newStock < 0 then
                redis.call('INCRBY', KEYS[1], 1)
                return 0
            end
            return 1
            """;
        
        Long result = redisTemplate.execute(
            new DefaultRedisScript<>(luaScript, Long.class),
            Collections.singletonList(key)
        );
        
        return result == 1;
    }
    
    // 5. 异步创建订单
    public void asyncCreateOrder(Long productId, Long userId) {
        rocketMQTemplate.convertAndSend("flashsale.order", 
            JSON.toJSONString(new FlashSaleOrder(productId, userId)));
    }
}
```

### 3.2 压测方案

```bash
# 使用 JMeter 压测
# 1. 创建线程组: 1000 线程，Ramp-Up 10秒
# 2. HTTP 请求: 配置接口地址、参数
# 3. 监听器: 查看聚合报告、响应时间图

# 使用 wrk 压测（更轻量）
wrk -t12 -c400 -d30s http://localhost:8080/api/product/123
# -t: 线程数
# -c: 连接数
# -d: 持续时间
```

### 3.3 压测常见问题及解决

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| CPU 100% | 死循环、频繁GC、大量计算 | 使用 arthas profiler 定位，优化代码 |
| 内存溢出 | 对象未释放、缓存过大 | 调整堆大小，优化缓存策略 |
| 连接池耗尽 | 连接未释放、并发过高 | 增加连接池大小，检查连接泄漏 |
| 数据库慢查询 | 索引缺失、SQL 低效 | 添加索引，优化 SQL |
| 网络瓶颈 | 带宽不足、DNS 解析慢 | 升级带宽，使用 CDN |

> ⚠️ 工程踩坑: 压测一定要模拟真实场景，包括数据量、并发模型、请求分布等。压测环境要尽量接近生产环境，否则结果可能不准确。

---

## 四、中间件相关

**Q: RabbitMQ 和 Kafka 的区别，实际项目中为什么选择其中一种？消息队列的重复消费、消息丢失问题怎么解决？**

### 4.1 RabbitMQ vs Kafka

| 对比维度 | RabbitMQ | Kafka |
|---------|----------|-------|
| 语言 | Erlang | Scala/Java |
| 吞吐量 | 万级 | 十万级/百万级 |
| 延迟 | 微秒级 | 毫秒级 |
| 消息可靠性 | 高（ACK机制） | 高（副本机制） |
| 消息顺序 | 保证单队列顺序 | 保证分区内顺序 |
| 适用场景 | 复杂路由、低延迟 | 大数据、日志收集 |
| 集群模式 | 镜像队列 | 副本机制 |

### 4.2 选型依据

```
选择 RabbitMQ 的场景:
- 需要复杂的路由规则（Direct/Topic/Fanout）
- 对延迟要求高（微秒级）
- 需要消息确认和重试机制
- 业务消息处理（订单、支付）

选择 Kafka 的场景:
- 需要高吞吐量（日志、事件流）
- 需要持久化大量数据
- 需要流式处理（Kafka Streams）
- 数据管道和日志聚合
```

### 4.3 消息可靠性保障

**RabbitMQ 可靠性方案**:
```java
// 生产者 Confirm 机制
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
@RabbitListener(queues = "order.queue")
public void handleOrder(Message message, Channel channel) throws IOException {
    try {
        orderService.process(new String(message.getBody()));
        channel.basicAck(message.getMessageProperties().getDeliveryTag(), false);
    } catch (Exception e) {
        // 拒绝消息，重新入队或进死信队列
        channel.basicNack(message.getMessageProperties().getDeliveryTag(), false, false);
    }
}

// 消息持久化
@Bean
public Queue orderQueue() {
    return QueueBuilder.durable("order.queue").build();
}
```

**Kafka 可靠性方案**:
```java
// 生产者配置
@Configuration
public class KafkaProducerConfig {
    @Bean
    public ProducerFactory<String, String> producerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "kafka:9092");
        props.put(ProducerConfig.ACKS_CONFIG, "all");           // 所有副本确认
        props.put(ProducerConfig.RETRIES_CONFIG, 3);            // 重试
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);  // 幂等生产者
        return new DefaultKafkaProducerFactory<>(props);
    }
}

// 消费者配置
@KafkaListener(topics = "order.created", groupId = "order-service")
public void consume(ConsumerRecord<String, String> record, Acknowledgment ack) {
    try {
        orderService.process(record.value());
        ack.acknowledge();  // 手动确认
    } catch (Exception e) {
        log.error("Consume failed", e);
        // 不确认，消息会重新消费
    }
}
```

### 4.4 消息重复消费 — 幂等性设计

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

// 方案3: 业务层幂等（状态机）
@Transactional
public void processOrder(String orderId) {
    Order order = orderMapper.selectById(orderId);
    if (order.getStatus() != OrderStatus.PENDING) {
        return; // 已处理，幂等返回
    }
    // 处理订单...
    orderMapper.updateStatus(orderId, OrderStatus.PROCESSED);
}
```

> ⚠️ 工程踩坑: 消息队列的 "不丢失" 和 "不重复" 不能同时完美保证。生产中最常见的做法是：生产者用幂等 + 消费者做幂等处理。幂等的核心是消息唯一 ID + 业务层去重。

---

## 五、Linux 指令

**Q: 常用的 Linux 指令有哪些？怎么查看系统 CPU、内存占用？怎么查找某个日志文件中的特定内容？**

### 5.1 系统监控

```bash
# 查看 CPU 使用率
top -c
# 或
mpstat 1 10    # 每秒输出一次，共10次
vmstat 1       # 虚拟内存统计

# 查看内存使用
free -h        # 人类可读格式
cat /proc/meminfo

# 查看磁盘使用
df -h          # 磁盘空间
du -sh *       # 目录大小

# 查看网络状态
netstat -an | grep ESTABLISHED
ss -s          # 更快速的网络统计
```

### 5.2 日志分析

```bash
# 查找日志中的特定内容
grep "ERROR" app.log                    # 查找 ERROR
grep -i "error" app.log                 # 忽略大小写
grep -n "ERROR" app.log                 # 显示行号
grep -C 5 "ERROR" app.log               # 显示前后5行

# 统计错误次数
grep -c "ERROR" app.log

# 查找最近100行
tail -100 app.log

# 实时监控日志
tail -f app.log

# 复杂查询：查找某个时间段的 ERROR
awk '/2024-01-15 10:00:00/,/2024-01-15 11:00:00/' app.log | grep "ERROR"

# 查找最慢的 SQL
grep "Slow query" mysql-slow.log | sort -k 10 -rn | head -10
```

### 5.3 进程管理

```bash
# 查看进程
ps -ef | grep java
ps aux | sort -k 4 -rn | head -10    # 按内存排序

# 查看线程
jstack <pid> > thread.dump            # Java 线程堆栈
top -Hp <pid>                         # 查看线程

# 查看文件描述符
lsof -p <pid>
lsof -i :8080                         # 查看端口占用

# 杀死进程
kill -9 <pid>                         # 强制杀死
kill -3 <pid>                         # Java 输出线程堆栈
```

### 5.4 性能分析

```bash
# CPU 火焰图（使用 arthas）
java -jar arthas-boot.jar
profiler start
profiler stop --file /tmp/flame.html

# GC 分析
jstat -gc <pid> 1000 10              # 每秒输出一次，共10次
jmap -heap <pid>                     # 堆内存使用情况
jmap -dump:format=b,file=/tmp/heap.hprof <pid>  # 导出堆快照

# 网络分析
tcpdump -i eth0 port 8080 -w /tmp/capture.pcap
wireshark /tmp/capture.pcap
```

> ⚠️ 工程踩坑: 排查线上问题一定要先保存现场（线程堆栈、堆快照），再分析问题。不要直接重启服务，否则可能丢失关键信息。

---

## 六、英文提问

**Q: What do you think is the most important skill for a Java backend developer?**

**参考答案**:
```
I think the most important skill for a Java backend developer is problem-solving ability. 
Specifically:

1. Deep understanding of Java fundamentals, including concurrency, memory management, 
   and JVM internals.

2. Ability to design scalable and maintainable systems, considering factors like 
   performance, reliability, and security.

3. Strong debugging and troubleshooting skills, being able to quickly identify and 
   resolve issues in production environments.

4. Good communication and collaboration skills, as backend development often involves 
   working with cross-functional teams.

In my experience, technical skills can be learned, but the ability to think critically 
and solve complex problems is what truly distinguishes a great developer.
```

> ⚠️ 面试技巧: 英文回答不需要太复杂，重点是能清晰表达观点。可以提前准备几个常见问题的英文答案，如技术选型、职业规划、团队合作等。

---

## 七、算法题

**Q: 手写 LeetCode 415. 字符串相加（要求处理大数，避免溢出）**

**题目描述**:
给定两个字符串形式的非负整数 num1 和 num2，计算它们的和并同样以字符串形式返回。
不能使用任何内建的大数处理库，也不能直接将输入的字符串转换为整数形式。

**示例**:
```
输入: num1 = "11", num2 = "123"
输出: "134"

输入: num1 = "456", num2 = "77"
输出: "533"

输入: num1 = "1", num2 = "9"
输出: "10"
```

**解题思路**:
```java
public String addStrings(String num1, String num2) {
    StringBuilder sb = new StringBuilder();
    int i = num1.length() - 1, j = num2.length() - 1;
    int carry = 0;  // 进位
    
    // 从后往前逐位相加
    while (i >= 0 || j >= 0 || carry > 0) {
        int digit1 = i >= 0 ? num1.charAt(i--) - '0' : 0;
        int digit2 = j >= 0 ? num2.charAt(j--) - '0' : 0;
        
        int sum = digit1 + digit2 + carry;
        sb.append(sum % 10);  // 当前位
        carry = sum / 10;     // 进位
    }
    
    return sb.reverse().toString();
}
```

**复杂度分析**:
- 时间复杂度: O(max(m, n))，其中 m 和 n 分别是 num1 和 num2 的长度
- 空间复杂度: O(max(m, n))，存储结果字符串

**测试用例**:
```java
@Test
public void testAddStrings() {
    assertEquals("134", addStrings("11", "123"));
    assertEquals("533", addStrings("456", "77"));
    assertEquals("10", addStrings("1", "9"));
    assertEquals("0", addStrings("0", "0"));
    assertEquals("100", addStrings("99", "1"));
}
```

> ⚠️ 面试技巧: 手写算法题要注意边界条件（空字符串、进位处理、长度不一致）。写完代码后主动跑几个测试用例验证正确性。

---

## 八、HR 相关问题

**Q1: 你为什么选择联想？**

**答题要点**:
- 联想是全球化科技公司，业务覆盖广泛
- 在 AI、云计算、大数据等领域有深入布局
- 希望能在这样的平台上发挥技术能力，同时获得成长
- 认可联想的企业文化和价值观

**Q2: 未来 3-5 年的职业规划是什么？**

**答题要点**:
- 短期（1-2年）: 深入掌握后端开发技术，成为团队核心开发
- 中期（3-5年）: 向架构师方向发展，具备系统设计和技术选型能力
- 长期: 成为技术专家或技术管理者，带领团队解决复杂问题

**Q3: 能接受加班吗？**

**答题要点**:
- 理解互联网行业的特点，项目紧急时愿意配合
- 但更希望通过提高效率来减少不必要的加班
- 注重工作与生活的平衡，保持长期高效工作状态

---

## 九、反问环节

**建议提问方向**:

1. **项目业务场景**: 项目的业务场景主要是什么？当前面临的技术挑战是什么？
2. **团队构成**: 团队的人员构成如何？技术栈是什么？
3. **成长路径**: 新人入职后有哪些培训和成长路径？
4. **技术氛围**: 团队的技术氛围如何？有没有技术分享机制？

> ⚠️ 面试技巧: 反问环节不要问薪资、加班等 HR 问题。问技术问题或团队问题，展示你对岗位的关注和思考。

---

## 面试总结

| 维度 | 考察内容 | 重要程度 |
|------|---------|---------|
| 业务场景 | 系统分析、优化方案 | ⭐⭐⭐⭐⭐ |
| 问题排查 | Linux 指令、日志分析 | ⭐⭐⭐⭐ |
| 中间件 | RabbitMQ/Kafka、消息可靠性 | ⭐⭐⭐⭐ |
| 项目深挖 | 高并发设计、压测经验 | ⭐⭐⭐⭐⭐ |
| 英文能力 | 技术英语表达 | ⭐⭐⭐ |
| 算法 | 字符串处理、大数计算 | ⭐⭐⭐ |
| 综合素质 | 职业规划、团队协作 | ⭐⭐⭐ |

**面试特点**:
- 侧重业务场景分析和问题排查能力
- 加入英文考察，兼顾技术和综合素养
- 算法考察字符串处理，难度偏上
- HR 环节关注求职动机和职业规划

**准备建议**:
1. 熟悉业务场景题的排查思路和优化方案
2. 掌握 Linux 常用指令和日志分析方法
3. 了解消息队列的选型和可靠性保障
4. 准备英文自我介绍和常见问题回答
5. 练习字符串处理类算法题
