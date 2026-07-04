# 高德 Agent后端开发日常实习一面

> **来源**: 小红书  
> **链接**: http://xhslink.com/o/RvWzWsQikR  
> **标签**: #高德 #阿里 #Agent后端 #日常实习 #面经  
> **日期**: 2026-05-14  
> **类型**: 日常实习一面  
> **考点分类**: 项目深度、SQL基础、Kafka、Redis、AI Agent认知、场景设计

---

## 1、项目

### Q1a. 你觉得这个事情的复杂度在哪里？

**考点**: 项目思维，区分CRUD和真正有技术深度的工作

**参考答案**:

面试官问这个问题的意图：看你能不能从"做了什么"上升到"为什么难"。

**回答框架**:

```
复杂度不在CRUD本身，而在：
1. 规模复杂度：数据量/并发量导致简单方案不可行
2. 一致性复杂度：分布式场景下的数据一致性保障
3. 边界复杂度：异常场景、边界case的处理
4. 演进复杂度：系统如何在需求变化中保持可维护性
```

**举例**:
- "我做了一个订单系统，CRUD本身不复杂，但复杂度在于：高并发下的库存扣减一致性（要用分布式锁+幂等）、订单状态机的状态流转约束（不能从已完成回退到待支付）、以及分库分表后跨表查询的方案选择。"

---

### Q1b. 你如何看待"实习期间做的全是CRUD"这件事？进阶的关注点应该是什么？

**考点**: 成长思维、技术视野

**参考答案**:

> CRUD是表象，关键是你有没有在CRUD的基础上做深度思考。

**进阶关注点**:

| 层级 | 关注点 | 示例 |
|------|--------|------|
| **基础** | 功能正确性 | 接口能跑通 |
| **进阶1** | 性能 | 慢SQL优化、缓存策略、批量操作 |
| **进阶2** | 可靠性 | 幂等设计、事务保障、降级方案 |
| **进阶3** | 可扩展性 | 分库分表、读写分离、异构索引 |
| **进阶4** | 可维护性 | 代码分层、DDD建模、领域事件 |

**关键转变**: 从"写代码"到"设计系统"，从"实现功能"到"解决复杂度"。

---

### Q1c. 项目里提到了耗时优化，详细讲讲怎么分析和优化的？

**考点**: 性能优化方法论

**参考答案**:

**性能优化四步法**:

```
1. 度量 → 2. 定位 → 3. 优化 → 4. 验证
```

**1. 度量**：先量化，不要凭感觉
- APM工具：SkyWalking/Jaeger链路追踪
- 日志打点：关键步骤耗时
- 数据库慢查询日志：`slow_query_log`

**2. 定位**：找到瓶颈
```
常见瓶颈排序：
数据库慢SQL > 外部调用超时 > 序列化/反序列化 > 锁竞争 > GC
```

**3. 优化**：针对性解决

| 瓶颈 | 优化方案 |
|------|---------|
| 慢SQL | EXPLAIN分析 → 加索引 → 优化查询 → 分库分表 |
| 外部调用 | 异步化(MQ) → 并行调用(CompletableFuture) → 缓存 |
| 序列化 | 换协议(Protobuf) → 减少字段 |
| 锁竞争 | 缩小锁粒度 → 乐观锁 → 无锁设计 |
| GC | 调整堆大小 → 选择合适GC算法 → 减少对象创建 |

**4. 验证**：压测对比优化前后数据

```java
// 优化案例：串行调用 → 并行调用
// Before: 3个接口串行调用，总耗时 = t1 + t2 + t3
public OrderDetail getOrderDetail(String orderId) {
    Order order = orderService.getOrder(orderId);     // 200ms
    User user = userService.getUser(order.getUserId()); // 150ms
    Product product = productService.getProduct(order.getProductId()); // 100ms
    return new OrderDetail(order, user, product);
}

// After: CompletableFuture并行调用，总耗时 = max(t1, t2, t3)
public OrderDetail getOrderDetailParallel(String orderId) {
    CompletableFuture<Order> orderFuture = CompletableFuture.supplyAsync(
        () -> orderService.getOrder(orderId));
    CompletableFuture<User> userFuture = orderFuture.thenApplyAsync(
        order -> userService.getUser(order.getUserId()));
    CompletableFuture<Product> productFuture = orderFuture.thenApplyAsync(
        order -> productService.getProduct(order.getProductId()));
    
    return CompletableFuture.allOf(userFuture, productFuture)
        .thenApply(v -> new OrderDetail(
            orderFuture.join(), userFuture.join(), productFuture.join()))
        .join();
}
// 耗时从 450ms → ~200ms
```

---

## 2、八股

### Q2a. 解释SQL中的Select语句的基本结构，举例如何使用

**参考答案**:

```sql
SELECT [DISTINCT] column1, column2, aggregate_func(column)
FROM table_name
[JOIN table2 ON condition]
[WHERE filter_condition]
[GROUP BY column]
[HAVING group_filter]
[ORDER BY column [ASC|DESC]]
[LIMIT n OFFSET m]
```

**示例**:
```sql
-- 查询各部门平均薪资大于10000的部门，按平均薪资降序
SELECT dept_id, AVG(salary) AS avg_salary, COUNT(*) AS headcount
FROM employees
WHERE status = 'active'
GROUP BY dept_id
HAVING AVG(salary) > 10000
ORDER BY avg_salary DESC
LIMIT 10;
```

---

### Q2b. 两表内联查询怎么构造SQL语句？

**参考答案**:

```sql
-- INNER JOIN: 只返回两表中匹配的行
SELECT o.order_id, o.amount, u.name
FROM orders o
INNER JOIN users u ON o.user_id = u.id;

-- 其他JOIN对比:
-- LEFT JOIN: 左表全保留，右表无匹配填NULL
-- RIGHT JOIN: 右表全保留，左表无匹配填NULL
-- CROSS JOIN: 笛卡尔积
```

---

### Q2c. ON和WHERE的区别是什么？

**考点**: SQL执行顺序（重点题）

**参考答案**:

| 区别 | ON | WHERE |
|------|-----|-------|
| **作用时机** | JOIN时匹配行 | JOIN之后过滤行 |
| **适用对象** | 连接条件 | 结果集过滤 |
| **LEFT JOIN中** | 不影响左表保留 | 会过滤掉左表行（即使右表NULL） |

**关键区别 — LEFT JOIN中**:

```sql
-- 场景： orders LEFT JOIN users

-- ON中的条件：只过滤右表，左表行始终保留
SELECT o.*, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id AND u.status = 'active'
-- 结果：所有order都保留，user不匹配时name为NULL

-- WHERE中的条件：过滤最终结果集，左表行也会被去掉
SELECT o.*, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE u.status = 'active'  -- 等价于INNER JOIN！
-- 结果：只保留user.status='active'的order，LEFT JOIN失效
```

**SQL执行顺序**: FROM → ON → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT

---

### Q2d. 怎么判断SQL是否慢，命中了索引没有？

**参考答案**:

**1. 开启慢查询日志**:
```sql
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1; -- 超过1秒记录
```

**2. EXPLAIN分析执行计划**:

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123;
```

| 字段 | 关注点 |
|------|--------|
| **type** | ALL(全表扫描) < index < range < ref < eq_ref < const |
| **key** | 实际使用的索引（NULL=没命中） |
| **rows** | 预估扫描行数 |
| **Extra** | Using index(覆盖索引✅) / Using filesort(❌) / Using temporary(❌) |

**3. 判断索引是否命中**:
- `type=ALL` → 全表扫描，没命中
- `type=ref/eq_ref` → 命中索引
- `key=NULL` → 没用索引
- `Extra=Using index` → 覆盖索引，最优

---

### Q2e. 了解数据库里面的Binlog、Redolog之类吗？

**考点**: MySQL日志体系（重点题）

**参考答案**:

| 日志 | 作用 | 写入时机 | 存储层 |
|------|------|---------|--------|
| **Redo Log** | 崩溃恢复，保证持久性 | 事务执行中持续写入 | InnoDB存储引擎层 |
| **Undo Log** | 事务回滚，保证原子性 | 修改数据前写入 | InnoDB存储引擎层 |
| **Binlog** | 主从复制、数据恢复 | 事务提交时写入 | MySQL Server层 |

**深度延伸 — WAL(Write-Ahead Logging)机制**:

```
数据修改流程:
1. 读取数据页到Buffer Pool
2. 修改前写Undo Log（用于回滚）
3. 修改数据页（Dirty Page）
4. 写Redo Log到Log Buffer → fsync到磁盘（WAL原则：先写日志再写数据）
5. 事务提交时写Binlog
6. 后台线程择时将Dirty Page刷盘

崩溃恢复: Redo Log重做已提交事务 + Undo Log回滚未提交事务
```

**Redo Log vs Binlog**:
- Redo Log是循环写（固定大小，会覆盖），Binlog是追加写
- Redo Log是物理日志（"某页某偏移改了什么"），Binlog是逻辑日志（"执行了什么SQL"）
- Redo Log用于崩溃恢复，Binlog用于主从复制

---

### Q2f. 消息中间件的理解和应用场景？

**参考答案**:

| 应用场景 | 说明 |
|---------|------|
| **异步处理** | 用户注册后异步发邮件/短信 |
| **应用解耦** | 订单系统发MQ，库存/物流/积分各自消费 |
| **流量削峰** | 秒杀请求先入MQ，后端按能力消费 |
| **日志收集** | 各服务日志写MQ，统一采集处理 |
| **分布式事务** | 基于MQ的最终一致性方案 |

---

### Q2g. Kafka消息堆积怎么处理？

**考点**: Kafka运维（高频题）

**参考答案**:

**消息堆积原因**:
1. 消费速度 < 生产速度
2. 消费端异常/宕机
3. 消费逻辑过重（如每次消费都调外部接口）

**处理方案**:

| 方案 | 做法 | 适用场景 |
|------|------|---------|
| **增加消费者** | 同组内增加消费者实例 | 分区数 > 当前消费者数 |
| **增加分区** | 扩大并行度 | 消费者已等于分区数 |
| **临时消费者** | 另起一组消费者只消费不做业务，转发到新Topic | 紧急堆积 |
| **优化消费逻辑** | 批量处理、异步化、减少外部调用 | 消费逻辑过重 |
| **调整参数** | `fetch.min.bytes`/`max.poll.records` | 调优 |
| **降级/跳过** | 非核心消息跳过或延迟处理 | 容忍少量丢失 |

**深度延伸**:

```java
// Kafka消费者调优示例
Properties props = new Properties();
props.put("max.poll.records", 500);      // 每次poll拉取更多消息
props.put("fetch.min.bytes", 1024 * 1024); // 减少请求次数
props.put("max.poll.interval.ms", 300000); // 给消费逻辑更多时间

// 批量消费提升吞吐
@KafkaListener(topics = "orders")
public void batchConsume(List<ConsumerRecord<String, String>> records) {
    // 批量入库而非逐条
    List<Order> orders = records.stream()
        .map(r -> JSON.parseObject(r.value(), Order.class))
        .toList();
    orderService.batchInsert(orders); // 批量插入
}
```

---

### Q2h. 一个分区只能被一个消费者组的一个消费者消费的原因

**考点**: Kafka消费模型

**参考答案**:

**原因：保证消息的顺序性和消费的幂等性**

1. **顺序性保障**: 如果一个分区被多个消费者同时消费，无法保证消息的处理顺序（消费者1处理msg3时，消费者2可能已处理msg5）
2. **避免重复消费**: 多个消费者读同一分区，需要额外的协调机制来分配消息，增加复杂度
3. **Offset管理简化**: 每个分区只需维护一个offset，无需分布式协调

**反向思考**: 如果需要多个消费者处理同一分区数据？
- 用不同消费者组（广播模式，每条消息每个组各消费一次）
- 消费者内部用线程池并行处理（但要注意顺序性）

---

### Q2i. 如何确保Redis的性能和数据一致性，在高并发场景下

**考点**: Redis高并发 + 一致性（重点题）

**参考答案**:

**性能保障**:

| 策略 | 做法 |
|------|------|
| 合理的数据结构 | 小数据用String/Hash，排序用ZSet |
| Pipeline | 批量命令一次发送，减少RTT |
| Lua脚本 | 复杂原子操作用Lua，减少网络交互 |
| 连接池 | 配置合理的连接池参数 |
| 避免大Key | 单个Value不超过10KB，使用`redis-cli --bigkeys`排查 |
| 集群分片 | 数据分散到多个节点 |

**数据一致性 — Cache Aside Pattern**:

```java
@Service
public class CacheAsidePattern {
    
    /**
     * 读：先读缓存，miss则读DB并回写缓存
     */
    public Object get(String key) {
        Object value = redisTemplate.opsForValue().get(key);
        if (value != null) return value;
        
        // 缓存miss，读DB
        value = db.query(key);
        if (value != null) {
            redisTemplate.opsForValue().set(key, value, 30, TimeUnit.MINUTES);
        }
        return value;
    }
    
    /**
     * 写：先更新DB，再删除缓存（推荐！）
     * 
     * 为什么是删缓存而不是更新缓存？
     * - 更新缓存在并发场景下可能出现旧值覆盖新值
     * - 删缓存+惰性加载更简单且一致
     * 
     * 为什么先更新DB再删缓存？
     * - 先删缓存：删缓存后、更新DB前，另一个请求读到DB旧值回写缓存 → 不一致
     * - 先更新DB：极端情况也有短暂不一致窗口，但概率极低
     */
    public void put(String key, Object value) {
        // 1. 更新DB
        db.update(key, value);
        // 2. 删除缓存
        redisTemplate.delete(key);
    }
}
```

**高并发一致性问题**:

| 问题 | 方案 |
|------|------|
| 缓存击穿（热点Key过期） | 互斥锁/永不过期+异步刷新 |
| 缓存穿透（查询不存在的数据） | 布隆过滤器/缓存空值 |
| 缓存雪崩（大量Key同时过期） | 过期时间加随机偏移 |

---

### Q2k. Redisson实现分布式锁的原理和场景

**考点**: 分布式锁（重点题）

**参考答案**:

**底层原理**: 基于Redis的Lua脚本实现SETNX + 过期时间 的原子操作

```java
@Service
public class DistributedLockService {
    
    @Autowired
    private RedissonClient redissonClient;
    
    /**
     * Redisson分布式锁使用
     */
    public void deductStock(String productId, int quantity) {
        RLock lock = redissonClient.getLock("lock:stock:" + productId);
        try {
            // 尝试加锁：等待5秒，锁自动释放时间30秒
            if (lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                // 检查库存
                int stock = getStock(productId);
                if (stock >= quantity) {
                    // 扣减库存
                    updateStock(productId, stock - quantity);
                }
            }
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }
}
```

**Redisson分布式锁核心原理**:

1. **加锁Lua脚本**: 原子执行 `SETNX + EXPIRE`
```lua
-- 如果key不存在，设置值和过期时间，返回成功
if redis.call('exists', KEYS[1]) == 0 then
    redis.call('hset', KEYS[1], ARGV[2], 1)
    redis.call('pexpire', KEYS[1], ARGV[1])
    return nil
end
-- 如果key存在且是当前线程持有，重入计数+1
if redis.call('hexists', KEYS[1], ARGV[2]) == 1 then
    redis.call('hincrby', KEYS[1], ARGV[2], 1)
    redis.call('pexpire', KEYS[1], ARGV[1])
    return nil
end
-- 被其他线程持有，返回剩余TTL
return redis.call('pttl', KEYS[1])
```

2. **Watchdog看门狗**: 默认30秒过期，每10秒自动续期（如果持有锁的线程还活着）

3. **可重入**: Hash结构存储，field=线程ID，value=重入次数

4. **释放锁**: Lua脚本判断是当前线程持有才删除，避免误删别人的锁

**常见场景**: 库存扣减、防重复提交、定时任务防重、分布式限流

---

## 3、AI相关

### Q3a. 你目前日常使用哪些AI工具？

**参考答案**:

按用途分类回答：
- **编码**: Cursor/Copilot/Claude Code（代码生成+补全+Review）
- **聊天/分析**: ChatGPT/Claude/豆包（知识问答、方案设计）
- **搜索**: Perplexity/DeeResearch（信息检索）
- **文档**: AI辅助写文档、翻译

---

### Q3b. 是否了解Spec Coding与Vibe Coding的区别？

**考点**: AI编程模式认知

**参考答案**:

| 模式 | Spec Coding | Vibe Coding |
|------|------------|-------------|
| **核心理念** | 先写详细规格说明，AI按规格实现 | 凭感觉描述需求，AI自由发挥 |
| **人类角色** | 架构师/设计师（定义What） | 指挥者/审核者（描述Feel） |
| **适用场景** | 企业级开发、需求明确 | 原型/MVP、探索性项目 |
| **代码质量** | 可控、可维护 | 不确定、可能需要重构 |
| **类似** | TDD + Design Doc | Prompt-Driven Dev |

> Spec Coding = "我要一个订单系统，包含以下接口和字段定义..."  
> Vibe Coding = "帮我做一个酷炫的订单页面..."

---

### Q3c. 是否了解KPC、Plan mode等AI编程模式？

**参考答案**:

| 模式 | 全称 | 说明 |
|------|------|------|
| **KPC** | Key Press Coding | 逐行确认模式，每行代码人工审核后再继续，最可控 |
| **Plan Mode** | 规划模式 | AI先输出完整计划，人工审核确认后再执行，适合大任务 |
| **Agent Mode** | 代理模式 | AI自主决策+执行，人工只做最终Review |
| **Yolo Mode** | 全自动模式 | AI完全自主，无需确认，适合信任度高的场景 |

**选择策略**: 
- 关键业务代码 → KPC/Plan Mode
- 常规CRUD → Agent Mode  
- 实验/原型 → Yolo Mode

---

### Q3d. 说说大模型和Agent区别，MCP和Function Call区别

**考点**: AI基础概念辨析（重点题）

**参考答案**:

**大模型 vs Agent**:

| 维度 | 大模型(LLM) | Agent |
|------|------------|-------|
| 本质 | 语言理解和生成引擎 | 自主决策+行动的系统 |
| 能力 | 文本→文本 | 感知→决策→执行→反馈 |
| 记忆 | 无状态（单次推理） | 有状态（短期+长期记忆） |
| 工具 | 不能使用外部工具 | 可以调用工具/API |
| 自主性 | 被动响应 | 主动规划+多步执行 |

> 大模型 = 大脑（只负责思考）  
> Agent = 大脑 + 手脚 + 记忆 + 规划能力

**MCP vs Function Call**:

| 维度 | Function Call | MCP |
|------|--------------|-----|
| **定义** | 模型输出结构化的函数调用JSON | 标准化协议，连接模型与外部工具/数据 |
| **范围** | 单次调用-返回 | 完整的工具注册+发现+调用协议 |
| **标准化** | 各厂商格式不同(OpenAI/Claude等) | Anthropic提出的开放标准 |
| **类比** | 一次性函数调用 | USB协议（标准化的设备连接） |
| **层级** | 底层机制 | 上层协议（底层仍可用Function Call实现） |

```
Function Call: 模型说 "我要调用weather_api(city='北京')"
MCP: 标准化了 "工具怎么注册、怎么发现、怎么调用、怎么鉴权" 的完整流程
```

---

## 4、场景题

### Q4a. 让你用AI从0到1起一个电商项目，你的任务拆分流程是怎样的？

**考点**: AI辅助工程实践能力

**参考答案**:

```
Phase 1: 需求定义 (Spec Coding)
├── 用AI梳理需求文档（PRD）
├── 定义核心实体和接口（API Spec）
└── 产出: 需求文档 + API定义 + 数据模型

Phase 2: 架构设计 (Plan Mode)
├── 用AI生成技术选型对比
├── 生成系统架构图和模块划分
└── 产出: 架构设计文档 + 技术选型

Phase 3: 编码实现 (Agent Mode + 人工Review)
├── 数据库建表 → DAO层 → Service层 → Controller层
├── 每个模块AI生成后人工Review
└── 关键逻辑(支付/库存)用Spec Coding精确控制

Phase 4: 测试验证
├── AI生成单元测试 + 集成测试
├── 人工补充边界case
└── 产出: 测试报告

Phase 5: 部署上线
├── AI生成Dockerfile/K8s配置
├── AI生成监控告警配置
└── 产出: 部署文档 + 运维手册
```

---

### Q4b. 如何确保AI实现的需求满足预期？

**参考答案**:

| 策略 | 做法 |
|------|------|
| **精确Spec** | 需求描述越具体，AI输出越准确 |
| **分步验证** | 不要一次性让AI生成整个项目，每步Review |
| **测试驱动** | 先写测试用例，AI实现代码后跑测试 |
| **Diff审查** | 每次AI改动都看diff，理解改了什么 |
| **回滚机制** | Git版本管理，AI生成不对就回滚 |
| **人工兜底** | 关键逻辑（支付/安全）必须人工Review |

---

## 5、手撕算法: LRU缓存变种 (LeetCode 146)

```java
class LRUCache {
    
    private final int capacity;
    private final Map<Integer, Node> cache;
    private final Node head, tail; // 哨兵节点
    
    // 双向链表节点
    private static class Node {
        int key, value;
        Node prev, next;
        Node(int k, int v) { key = k; value = v; }
    }
    
    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.cache = new HashMap<>();
        head = new Node(0, 0);
        tail = new Node(0, 0);
        head.next = tail;
        tail.prev = head;
    }
    
    public int get(int key) {
        if (!cache.containsKey(key)) return -1;
        Node node = cache.get(key);
        moveToHead(node); // 访问后移到头部
        return node.value;
    }
    
    public void put(int key, int value) {
        if (cache.containsKey(key)) {
            Node node = cache.get(key);
            node.value = value;
            moveToHead(node);
        } else {
            Node node = new Node(key, value);
            cache.put(key, node);
            addToHead(node);
            if (cache.size() > capacity) {
                Node removed = removeTail(); // 淘汰最久未使用
                cache.remove(removed.key);
            }
        }
    }
    
    private void addToHead(Node node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }
    
    private void removeNode(Node node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }
    
    private void moveToHead(Node node) {
        removeNode(node);
        addToHead(node);
    }
    
    private Node removeTail() {
        Node node = tail.prev;
        removeNode(node);
        return node;
    }
}
// HashMap + 双向链表，get/put均O(1)
```

**变种考法**:
- 加一个`getRecentKeys()`返回最近访问的Key列表
- 支持TTL过期（每个节点加过期时间，get时检查）
- 线程安全的LRU（加ReentrantLock或用ConcurrentHashMap + 同步块）

---

## 考点总览

| 类别 | 核心考点 |
|------|---------|
| **项目** | 复杂度认知、CRUD进阶思维、性能优化方法论 |
| **SQL** | SELECT结构、JOIN、ON vs WHERE、EXPLAIN、Binlog/RedoLog/UndoLog |
| **Kafka** | 消息堆积处理、分区消费模型 |
| **Redis** | 高并发一致性(Cache Aside)、缓存三大问题、Redisson分布式锁(Lua+Watchdog) |
| **AI** | Spec vs Vibe Coding、KPC/Plan/Agent模式、LLM vs Agent、MCP vs Function Call |
| **场景** | AI辅助项目流程、需求验证策略 |
| **算法** | LRU缓存(HashMap+双向链表) |
