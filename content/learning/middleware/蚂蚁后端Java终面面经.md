---
title: "蚂蚁集团 后端Java终面面经"
date: "2026-07-06"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "蚂蚁集团 后端Java终面面经"
tags:
---

# 蚂蚁集团 后端Java终面面经

> **来源**: 小红书
> **链接**: http://xhslink.com/o/6Z5GukbsjYD
> **NoteId**: 6a0ac5be0000000007020f35
> **标签**: #面试 #面经 #蚂蚁 #Java #后端
> **考点分类**: 项目深挖、分布式架构、JVM、并发编程、数据库、中间件、业务理解

---

## 基本信息

- **侧重**: 项目深挖 + 分布式架构
- **背景**: 3年经验，普通业务线
- **时长**: 45分钟
- **面试官**: 1位技术Leader + 1位业务负责人（双面试官）

---

## 一、自我介绍（3分钟）

**答题要点**:
- **核心模块**: 重点介绍你在项目中负责的核心模块，不要泛泛而谈
- **技术栈选型**: 说明为什么选择这些技术，体现技术决策能力
- **不可替代性**: 突出你在项目中的独特价值，比如解决了什么别人解决不了的问题

> ⚠️ 面试技巧: 3分钟很短，不要流水账式地介绍项目背景。直接切入重点：我负责了什么 → 解决了什么难题 → 带来了什么业务价值。面试官已经看过简历，自我介绍是引导后续提问的方向。

---

## 二、项目深挖（15分钟）

> 面试的核心环节，考察实际项目经验、系统设计能力和解决复杂问题的能力。

### 2.1 复杂项目阐述

**Q: 详细讲解你做过的最复杂的后端项目，包括整体架构设计、核心技术难点及解决方案。**

**追问**:
- 当时为什么选择这种方案？
- 有没有更优的实现方式？（Trade-off 分析）

**答题思路**:
使用 **STAR 法则** 结构化回答：
- **Situation**: 业务背景是什么，面临什么挑战
- **Task**: 你的职责和目标是什么
- **Action**: 你采取了什么技术方案，为什么这么选
- **Result**: 最终效果如何，用数据说话

**架构设计展示模板**:
```
┌─────────────────────────────────────────────┐
│                   网关层                      │
│            (Spring Cloud Gateway)            │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│                  业务层                       │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │ 订单服务  │  │ 支付服务  │  │ 用户服务  │  │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│        │              │              │        │
└────────┼──────────────┼──────────────┼───────┘
         │              │              │
┌────────▼──────────────▼──────────────▼───────┐
│                 数据层                        │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │  MySQL   │  │  Redis   │  │  Kafka   │  │
│   └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
```

> ⚠️ 工程踩坑: 面试官一定会追问 "为什么这么选"。每个技术决策都要能说出 Trade-off，比如为什么选 Kafka 而不是 RabbitMQ（吞吐量 vs 延迟），为什么选 MySQL 而不是 MongoDB（事务 vs 灵活性）。

### 2.2 分布式场景

**Q: 项目中涉及的分布式场景（如分布式事务、分布式缓存），具体是怎么实现的？遇到过哪些坑？**

#### 2.2.1 分布式事务

**常见方案对比**:

| 方案 | 一致性 | 性能 | 复杂度 | 适用场景 |
|------|-------|------|--------|---------|
| 2PC/XA | 强一致 | 低 | 高 | 金融场景，强一致性要求 |
| TCC | 强一致 | 中 | 高 | 库存扣减、资金操作 |
| 本地消息表 | 最终一致 | 高 | 中 | 订单-物流等异步场景 |
| RocketMQ事务消息 | 最终一致 | 高 | 低 | 消息队列场景 |
| Seata AT | 最终一致 | 中 | 低 | 快速开发场景 |

**本地消息表实现**:
```java
@Service
public class OrderService {
    
    @Autowired private OrderMapper orderMapper;
    @Autowired private MessageMapper messageMapper;
    @Autowired private KafkaTemplate<String, String> kafkaTemplate;
    
    // 保证业务数据和消息数据在同一事务中写入
    @Transactional(rollbackFor = Exception.class)
    public void createOrder(OrderDTO dto) {
        // 1. 创建订单
        Order order = new Order(dto);
        orderMapper.insert(order);
        
        // 2. 写入本地消息表（与订单在同一事务）
        Message message = Message.builder()
            .topic("order.created")
            .key(order.getId())
            .content(JSON.toJSONString(order))
            .status(MessageStatus.PENDING)
            .retryCount(0)
            .build();
        messageMapper.insert(message);
    }
    
    // 定时任务扫描未发送的消息
    @Scheduled(fixedDelay = 1000)
    public void resendPendingMessages() {
        List<Message> pending = messageMapper.selectPending(100);
        for (Message msg : pending) {
            try {
                kafkaTemplate.send(msg.getTopic(), msg.getKey(), msg.getContent());
                messageMapper.updateStatus(msg.getId(), MessageStatus.SENT);
            } catch (Exception e) {
                messageMapper.incrementRetry(msg.getId());
                if (msg.getRetryCount() > 3) {
                    messageMapper.updateStatus(msg.getId(), MessageStatus.FAILED);
                }
            }
        }
    }
}
```

#### 2.2.2 分布式缓存三大问题

**缓存穿透**（查询不存在的数据）:
```java
// 方案1: 缓存空值（短期过期）
public User getUserById(Long id) {
    String key = "user:" + id;
    String cached = redisTemplate.opsForValue().get(key);
    if (cached != null) {
        return cached.equals(NULL_VALUE) ? null : JSON.parseObject(cached, User.class);
    }
    
    User user = userMapper.selectById(id);
    if (user == null) {
        // 缓存空值，短期过期（5分钟）
        redisTemplate.opsForValue().set(key, NULL_VALUE, 5, TimeUnit.MINUTES);
    } else {
        redisTemplate.opsForValue().set(key, JSON.toJSONString(user), 30, TimeUnit.MINUTES);
    }
    return user;
}

// 方案2: 布隆过滤器（适合数据量大的场景）
@Component
public class BloomFilterHelper {
    
    @Autowired private RedisTemplate redisTemplate;
    
    // 初始化布隆过滤器
    public void initBloomFilter() {
        // 使用 RedisBitmap 或 RedisBloom 模块
        // 将所有有效的 userId 加入布隆过滤器
        List<Long> allIds = userMapper.selectAllIds();
        for (Long id : allIds) {
            redisTemplate.opsForValue().setBit("bloom:user", id, true);
        }
    }
    
    // 查询前先判断
    public boolean mightExist(Long id) {
        return redisTemplate.opsForValue().getBit("bloom:user", id);
    }
}
```

**缓存击穿**（热点 Key 过期瞬间大量请求打到 DB）:
```java
// 方案1: 互斥锁（适合单机，分布式用 Redis SET NX）
public Product getProductById(Long id) {
    String key = "product:" + id;
    String cached = redisTemplate.opsForValue().get(key);
    if (cached != null) {
        return JSON.parseObject(cached, Product.class);
    }
    
    // 分布式锁
    String lockKey = "lock:product:" + id;
    boolean locked = redisTemplate.opsForValue()
        .setIfAbsent(lockKey, "1", 10, TimeUnit.SECONDS);
    
    if (locked) {
        try {
            // 双重检查
            cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                return JSON.parseObject(cached, Product.class);
            }
            
            Product product = productMapper.selectById(id);
            redisTemplate.opsForValue().set(key, JSON.toJSONString(product), 30, TimeUnit.MINUTES);
            return product;
        } finally {
            redisTemplate.delete(lockKey);
        }
    } else {
        // 没拿到锁，休眠后重试
        Thread.sleep(50);
        return getProductById(id);
    }
}

// 方案2: 逻辑过期（不设置 TTL，后台异步更新）
public Product getProductWithLogicalExpiry(Long id) {
    String key = "product:" + id;
    CacheData cached = redisTemplate.opsForValue().get(key);
    
    if (cached != null && System.currentTimeMillis() < cached.getExpireTime()) {
        return cached.getData();
    }
    
    // 逻辑过期，异步更新
    if (redisTemplate.opsForValue().setIfAbsent("rebuild:" + id, "1", 10, TimeUnit.SECONDS)) {
        CompletableFuture.runAsync(() -> {
            Product product = productMapper.selectById(id);
            CacheData newData = new CacheData(product, System.currentTimeMillis() + 30 * 60 * 1000);
            redisTemplate.opsForValue().set(key, newData);
        });
    }
    
    return cached != null ? cached.getData() : null;
}
```

**缓存雪崩**（大量 Key 同时过期）:
```java
// 方案: 过期时间加随机值
public void setCache(String key, String value) {
    // 基础过期时间 30 分钟 + 随机 0-5 分钟
    long expire = 30 * 60 + ThreadLocalRandom.current().nextInt(0, 300);
    redisTemplate.opsForValue().set(key, value, expire, TimeUnit.SECONDS);
}

// 方案2: 热点数据永不过期（逻辑过期 + 异步刷新）
// 方案3: 多级缓存（本地缓存 Caffeine + Redis）
```

> ⚠️ 工程踩坑: 分布式锁一定要设置合理的过期时间，并且考虑锁续期（Redisson 的 WatchDog 机制）。另外，缓存和数据库的双写一致性是经典难题，推荐 "先更新数据库，再删除缓存" 的方案，配合延迟双删或订阅 Binlog 异步删除。

### 2.3 性能优化

**Q: 项目上线后出现过性能瓶颈，你是如何排查和优化的？（要求结合具体指标）**

**排查思路**:
```
1. 监控发现异常 → Prometheus/Grafana 告警
   - QPS 下降、响应时间飙升、CPU 利用率异常
   
2. 定位问题 → 
   - 线程堆栈: jstack pid > thread.dump
   - CPU 火焰图: arthas profiler start → profiler stop --file /tmp/flame.html
   - SQL 慢查询: EXPLAIN 分析执行计划
   
3. 优化措施 →
   - 代码层: 循环查库改为批量查询、异步化非核心逻辑
   - 缓存层: 热点数据加缓存、减少缓存 Key 数量
   - 数据库层: 索引优化、SQL 改写、分库分表
   - 架构层: 读写分离、服务拆分、消息队列削峰
   
4. 效果验证 →
   - 对比优化前后的 QPS、RT、CPU、内存指标
```

**实际案例模板**:
```
问题: 大促期间订单查询接口 RT 从 50ms 飙升到 2s

排查:
- jstack 发现大量线程阻塞在 DB 查询
- EXPLAIN 发现某联合查询走了全表扫描（索引失效）
- 慢查询日志显示该 SQL 执行时间 1.5s

优化:
1. 重建联合索引 (status, create_time, user_id)
2. 查询结果加 Redis 缓存（TTL 5分钟 + 随机偏移）
3. 非核心字段（如商品信息）改为异步批量查询

效果:
- RT 从 2s 降至 30ms
- QPS 从 500 提升至 3000
- CPU 利用率从 85% 降至 40%
```

> ⚠️ 工程踩坑: 性能优化一定要基于数据说话，不要凭感觉优化。先用工具定位瓶颈，再针对性优化。优化后也要有数据对比，证明优化有效。

### 2.4 重构与改进

**Q: 如果让你重新设计这个项目，你会做哪些改进？结合蚂蚁的技术体系谈一谈。**

**答题要点**:
- **微服务拆分**: 单体应用 → 按业务域拆分（DDD 限界上下文）
- **中间件选型**: 蚂蚁体系（SOFAStack: SOFARegistry、SOFARPC、SOFATracer、SOFABolt）
- **可观测性**: 接入全链路监控（SOFATracer + SkyWalking）
- **容错机制**: 引入 Sentinel 限流熔断
- **部署架构**: 容器化 + K8s + 多机房部署

---

## 三、核心技术提问（15分钟）

### 3.1 JVM

**Q: CMS 和 G1 垃圾回收器的区别，各自的适用场景？**

| 对比维度 | CMS | G1 |
|---------|-----|-----|
| 算法 | 标记-清除 | 标记-整理（Region 划分） |
| 停顿时间 | 不可预测 | 可预测（可设置目标停顿时间） |
| 内存碎片 | 会产生碎片 | 无碎片（整理算法） |
| 适用堆大小 | 小堆（< 4GB） | 大堆（> 4GB） |
| 并发阶段 | 多阶段并发 | 并发标记 + 并发回收 |
| JDK 版本 | JDK 8 默认 | JDK 9+ 默认 |

**G1 参数调优**:
```bash
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200        # 目标停顿时间
-XX:G1HeapRegionSize=16m        # Region 大小
-XX:InitiatingHeapOccupancyPercent=45  # 触发并发标记的堆占用阈值
-XX:G1ReservePercent=10         # 预留内存比例
```

**频繁 Full GC 排查**:
```bash
# 1. 开启 GC 日志
-XX:+PrintGCDetails -XX:+PrintGCDateStamps -Xloggc:/tmp/gc.log

# 2. 使用 arthas 诊断
dashboard          # 查看实时 GC 情况
memory             # 查看内存使用
profiler start     # 开始 profiling
profiler stop      # 停止并生成火焰图

# 3. 分析 Heap Dump
jmap -dump:format=b,file=/tmp/heap.hprof <pid>
jhat /tmp/heap.hprof  # 或使用 MAT/Eclipse 分析

# 4. 常见原因
# - 大对象直接进入老年代（大数组、大字符串）
# - 长期存活对象过多（缓存未设置过期）
# - 内存泄漏（ThreadLocal 未清理、静态集合持续增长）
# - 元空间不足（动态加载大量类）
```
> ⚠️ 工程踩坑: JDK 8 中 CMS 已在 JDK 9 标记为废弃，JDK 17 中移除。新项目统一用 G1 或 ZGC。ZGC 在 JDK 15+ 中已生产可用，停顿时间 < 1ms。

### 3.2 并发编程

**Q: synchronized 和 Lock 的区别，锁升级过程？**

| 对比维度 | synchronized | ReentrantLock |
|---------|-------------|---------------|
| 实现方式 | JVM 内置（Monitor） | Java 类库实现（AQS） |
| 锁释放 | 自动释放（异常安全） | 必须手动释放（try-finally） |
| 公平性 | 非公平 | 可配置公平/非公平 |
| 可中断 | 不可中断 | 支持 tryLock(timeout) |
| 多条件变量 | 仅一个（wait/notify） | 支持多个 Condition |
| 性能 | JDK 6+ 优化后接近 | 接近 |

**锁升级过程**（JDK 6+）:
```
无锁 → 偏向锁 → 轻量级锁（CAS） → 重量级锁（Monitor）
```

```java
// 锁升级示例
public class LockUpgradeDemo {
    
    // 无锁状态
    Object obj = new Object();
    
    // 偏向锁：第一个线程获取锁时，Mark Word 记录线程 ID
    synchronized(obj) {
        // 后续同一线程进入只需检查 Mark Word，无需 CAS
    }
    
    // 轻量级锁：多个线程交替获取锁时，通过 CAS 竞争
    // 线程在栈帧中创建 Lock Record，用 CAS 替换 Mark Word
    
    // 重量级锁：竞争激烈时，升级为 Monitor，线程阻塞等待
    // 此时涉及用户态/内核态切换，开销较大
}
```

**Q: 线程池的核心参数，如何根据业务场景进行调优？**

```java
// 线程池 7 大参数
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    corePoolSize,        // 核心线程数
    maximumPoolSize,     // 最大线程数
    keepAliveTime,       // 空闲线程存活时间
    unit,                // 时间单位
    workQueue,           // 工作队列
    threadFactory,       // 线程工厂（推荐自定义，设置有意义的线程名）
    handler              // 拒绝策略
);

// 参数调优建议:
// CPU 密集型: corePoolSize = CPU核数 + 1
// IO 密集型: corePoolSize = CPU核数 * (1 + 平均等待时间/平均计算时间)
// 队列选择: 有界队列（ArrayBlockingQueue）优于无界队列（防止 OOM）
// 拒绝策略: 业务场景用 CallerRunsPolicy（降级），监控场景用 AbortPolicy（告警）

// 实际项目中的线程池配置
@Configuration
public class ThreadPoolConfig {
    
    @Bean("orderExecutor")
    public ThreadPoolExecutor orderExecutor() {
        return new ThreadPoolExecutor(
            20,                              // 核心线程数
            50,                              // 最大线程数
            60, TimeUnit.SECONDS,            // 空闲存活时间
            new ArrayBlockingQueue<>(1000),  // 有界队列
            new ThreadFactoryBuilder()
                .setNameFormat("order-pool-%d")
                .setUncaughtExceptionHandler((t, e) -> 
                    log.error("Thread {} error", t.getName(), e))
                .build(),
            new ThreadPoolExecutor.CallerRunsPolicy()  // 调用者运行
        );
    }
}
```
> ⚠️ 工程踩坑: 阿里巴巴开发手册强制要求线程池必须通过 ThreadPoolExecutor 创建，不允许用 Executors 工厂方法。因为 Executors 创建的线程池使用无界队列，可能导致 OOM。另外，子线程中不要使用 ThreadLocal 传递上下文（如用户信息、TraceId），推荐使用 TransmittableThreadLocal。

### 3.3 数据库

**Q: MySQL 的聚簇索引和非聚簇索引区别，如何优化慢查询？**

**聚簇索引 vs 非聚簇索引**:
```
聚簇索引（主键索引）:
┌─────────────────────────────┐
│  主键  │  整行数据            │
├─────────────────────────────┤
│  1     │  {name: "A", ...}   │
│  2     │  {name: "B", ...}   │
│  3     │  {name: "C", ...}   │
└─────────────────────────────┘
数据按主键顺序存储在 B+ 树叶子节点

非聚簇索引（二级索引）:
┌─────────────────────────────┐
│  name  │  主键               │
├─────────────────────────────┤
│  "A"   │  1                  │
│  "B"   │  2                  │
│  "C"   │  3                  │
└─────────────────────────────┘
叶子节点只存索引列 + 主键，需要回表查完整数据
```

**回表 vs 覆盖索引**:
```sql
-- ❌ 需要回表
SELECT * FROM users WHERE name = 'Alice';
-- 走 name 索引 → 找到主键 → 回表查整行

-- ✅ 覆盖索引（无需回表）
SELECT id, name FROM users WHERE name = 'Alice';
-- 如果索引是 (name, id)，直接在索引中获取结果

-- ✅ 索引下推（MySQL 5.6+）
SELECT id, name, age FROM users WHERE name LIKE 'A%' AND age = 25;
-- 索引 (name, age) 可以在索引层过滤 age，减少回表次数
```

**慢查询优化步骤**:
```sql
-- 1. 开启慢查询日志
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1;  -- 超过 1 秒记录

-- 2. EXPLAIN 分析
EXPLAIN SELECT o.*, u.name FROM orders o 
JOIN users u ON o.user_id = u.id 
WHERE o.status = 1 AND o.create_time > '2024-01-01';

-- 关注字段:
-- type: ALL(全表) < index < range < ref < eq_ref < const
-- key: 实际使用的索引
-- rows: 扫描行数
-- Extra: Using filesort / Using temporary（需要优化）

-- 3. 索引优化
-- 联合索引遵循最左前缀原则
CREATE INDEX idx_status_time ON orders(status, create_time);

-- 避免索引失效:
-- ❌ 对索引列做函数运算
WHERE YEAR(create_time) = 2024
-- ✅ 改为范围查询
WHERE create_time >= '2024-01-01' AND create_time < '2025-01-01'

-- ❌ 隐式类型转换
WHERE phone = 13800138000  -- phone 是 VARCHAR
-- ✅ 加引号
WHERE phone = '13800138000'
```

**Q: 分库分表的实现方案，分片规则如何选择？**

```java
// 分片策略示例（ShardingSphere）
@Configuration
public class ShardingConfig {
    
    @Bean
    public DataSource shardingDataSource() {
        // 分库策略: 按 user_id 取模分 4 个库
        ShardingRuleConfiguration shardingRule = new ShardingRuleConfiguration();
        shardingRule.getTableRuleConfigs().add(
            new TableRuleConfiguration("orders", "ds${0..3}.orders_${0..7}")
        );
        
        // 分片键: user_id
        shardingRule.getBroadcastTables().add("dict_table");
        
        // 分片算法: 取模
        shardingRule.getShardingAlgorithms().put(
            "database-inline",
            new ShardingSphereAlgorithmConfiguration("INLINE", 
                Map.of("algorithm-expression", "ds${user_id % 4}"))
        );
        shardingRule.getShardingAlgorithms().put(
            "table-inline",
            new ShardingSphereAlgorithmConfiguration("INLINE", 
                Map.of("algorithm-expression", "orders_${user_id % 8}"))
        );
        
        return ShardingSphereDataSourceFactory.createDataSource(
            createDataSourceMap(), Collections.singletonList(shardingRule), new Properties());
    }
}
```

> ⚠️ 工程踩坑: 分库分表后的核心难题 — 跨库 Join（用冗余字段或宽表解决）、分页查询（用游标分页替代 OFFSET）、全局 ID（用雪花算法或号段模式）。分库分表前一定要评估数据量，不要过度设计。

### 3.4 中间件

**Q: Redis 的持久化机制（RDB 和 AOF）？**

| 对比维度 | RDB | AOF |
|---------|-----|-----|
| 原理 | 定时生成数据快照 | 记录每次写命令 |
| 文件大小 | 小（压缩后） | 大（可 BGREWRITEAOF 压缩） |
| 恢复速度 | 快 | 慢 |
| 数据安全性 | 可能丢失最后一次快照后的数据 | 根据 fsync 策略决定 |
| 性能影响 | 快照期间 fork 子进程，可能卡顿 | AOF 写入有性能开销 |
| 适用场景 | 备份、灾难恢复 | 数据安全性要求高 |

**AOF 同步策略**:
```bash
appendfsync always    # 每次写都同步，最安全但最慢
appendfsync everysec  # 每秒同步（默认，推荐）
appendfsync no        # 由 OS 决定，最快但不安全
```

**Q: 分布式锁的实现方式（Redis、Zookeeper），各自的优缺点？**

```java
// 方案1: Redis SET NX + 过期时间（简单但不完美）
public boolean tryLock(String key, String value, long expireSeconds) {
    return redisTemplate.opsForValue()
        .setIfAbsent(key, value, expireSeconds, TimeUnit.SECONDS);
}

// 方案2: Redisson（推荐，生产级）
@Configuration
public class RedissonConfig {
    
    @Bean
    public RedissonClient redissonClient() {
        Config config = new Config();
        config.useSingleServer()
            .setAddress("redis://127.0.0.1:6379")
            .setConnectionPoolSize(64)
            .setConnectionMinimumIdleSize(10);
        return Redisson.create(config);
    }
}

@Service
public class DistributedLockService {
    
    @Autowired private RedissonClient redissonClient;
    
    public void doWithLock(String lockKey, Runnable task) {
        RLock lock = redissonClient.getLock(lockKey);
        try {
            // 尝试获取锁，最多等待 10 秒，锁自动释放时间 30 秒
            if (lock.tryLock(10, 30, TimeUnit.SECONDS)) {
                try {
                    task.run();
                } finally {
                    lock.unlock();
                }
            } else {
                throw new BusinessException("LOCK_ACQUIRE_FAILED", "获取锁失败");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Lock interrupted", e);
        }
    }
}
// Redisson 优势: WatchDog 自动续期、可重入、支持公平锁/读写锁/红锁
```

| 对比维度 | Redis 分布式锁 | Zookeeper 分布式锁 |
|---------|--------------|-------------------|
| 实现方式 | SET NX + 过期时间 | 临时顺序节点 + Watch |
| 可靠性 | 单点故障（哨兵/集群可缓解） | 高可用（ZAB 协议） |
| 性能 | 高（内存操作） | 中（磁盘写入） |
| 锁释放 | 过期自动释放（可能误删） | 客户端断开自动释放 |
| 适用场景 | 高性能场景 | 强一致性场景 |

**Q: Kafka 的高可用机制，如何保证消息不丢失、不重复消费？**

```java
// 生产者保证不丢失
@Configuration
public class KafkaProducerConfig {
    
    @Bean
    public ProducerFactory<String, String> producerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "kafka:9092");
        props.put(ProducerConfig.ACKS_CONFIG, "all");           // 所有副本确认
        props.put(ProducerConfig.RETRIES_CONFIG, 3);            // 重试
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);  // 幂等生产者
        props.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        return new DefaultKafkaProducerFactory<>(props);
    }
}

// 消费者保证不丢失 + 不重复
@Component
public class OrderConsumer {
    
    @KafkaListener(topics = "order.created", groupId = "order-service")
    public void consume(ConsumerRecord<String, String> record, Acknowledgment ack) {
        // 1. 幂等处理（基于消息唯一 ID）
        String messageId = record.headers().lastHeader("message-id").value();
        if (messageLogMapper.exists(messageId)) {
            ack.acknowledge();  // 已处理，直接确认
            return;
        }
        
        try {
            // 2. 业务处理
            Order order = JSON.parseObject(record.value(), Order.class);
            orderService.process(order);
            
            // 3. 记录消息日志（与业务在同一事务）
            messageLogMapper.insert(MessageLog.builder()
                .messageId(messageId)
                .status("PROCESSED")
                .build());
            
            // 4. 手动确认
            ack.acknowledge();
        } catch (Exception e) {
            // 不确认，消息会重新消费（但可能重复）
            log.error("Consume failed", e);
            // 死信队列处理
        }
    }
}
```

| 问题 | 解决方案 |
|------|---------|
| 生产者丢失 | acks=all + 重试 + 幂等生产者 |
| Broker 丢失 | 副本机制（replication-factor >= 3）+ min.insync.replicas |
| 消费者丢失 | 手动确认（enable.auto.commit=false） |
| 重复消费 | 业务幂等（唯一索引/分布式锁/状态机） |

> ⚠️ 工程踩坑: Kafka 的 "不丢失" 和 "不重复" 不能同时完美保证。生产中最常见的做法是：生产者用幂等 + 消费者做幂等处理。幂等的核心是消息唯一 ID + 业务层去重（数据库唯一索引或 Redis SET NX）。

---

## 四、业务理解与职业规划（10分钟）

### 4.1 对蚂蚁业务的理解

**Q: 你对蚂蚁的核心业务（如支付、风控、理财）有多少了解？如果让你参与蚂蚁某块业务的后端开发，你会重点关注什么？**

**答题要点**:

**支付业务**:
- 核心要求：高可用、强一致、高并发
- 技术挑战：分布式事务、资金安全、对账系统
- 重点关注：幂等性、资金安全校验、异常处理

**风控业务**:
- 核心要求：实时性、准确性
- 技术挑战：规则引擎、实时计算、机器学习
- 重点关注：规则动态配置、决策链路监控

**理财业务**:
- 核心要求：数据准确性、合规性
- 技术挑战：净值计算、申购赎回、资金清算
- 重点关注：数据一致性、定时任务可靠性

> ⚠️ 面试技巧: 不需要对每个业务都深入了解，选择你最熟悉的一块深入分析。重点展示你的技术思维如何应用到业务场景中。

### 4.2 职业规划

**Q: 未来 3-5 年的职业规划，是偏向技术深耕还是技术 + 业务的综合发展？**

**答题要点**:
- **技术深耕**: 分布式系统、云原生、高可用架构等方向
- **技术 + 业务**: 成为业务领域的技术专家，既能解决技术问题，也能理解业务需求
- **建议**: 根据面试岗位选择回答方向，蚂蚁更看重 "技术 + 业务" 的综合能力

### 4.3 求职动机

**Q: 为什么选择蚂蚁？你认为自己的优势是什么，能为团队带来什么价值？**

**答题要点**:
- **选择蚂蚁**: 技术挑战大（双 11 场景）、技术体系成熟（SOFAStack）、成长空间大
- **个人优势**: 结合项目经验，突出解决复杂问题的能力
- **团队价值**: 快速上手业务、带来新的技术视角、团队协作能力

---

## 五、反问环节（2分钟）

**建议提问方向**:
- 团队当前的技术栈和业务重点？
- 新人入职后有哪些培训和成长路径？
- 团队的技术氛围和代码规范？
- 当前团队面临的最大技术挑战是什么？

> ⚠️ 面试技巧: 反问环节不要问薪资、加班等 HR 问题。问技术问题或团队问题，展示你对岗位的关注和思考。

---

## 总结

| 模块 | 时间占比 | 重要程度 |
|------|---------|---------|
| 自我介绍 | 3min ≈ 7% | ⭐⭐ |
| 项目深挖 | 15min ≈ 33% | ⭐⭐⭐⭐⭐ |
| 核心技术 | 15min ≈ 33% | ⭐⭐⭐⭐⭐ |
| 业务理解 | 10min ≈ 22% | ⭐⭐⭐⭐ |
| 反问环节 | 2min ≈ 5% | ⭐⭐ |

**面试特点**: 
- 双面试官（技术 Leader + 业务负责人），既考察技术深度也考察业务理解
- 项目深挖占大头（15分钟），需要对自己的项目非常熟悉，能讲清楚设计决策和 Trade-off
- 核心技术覆盖 JVM、并发、数据库、中间件四大板块，要求有实战经验
- 业务理解环节考察对蚂蚁业务的了解，提前做功课很重要

**准备建议**:
1. 准备 1-2 个复杂项目的完整故事（架构、难点、优化、反思）
2. 复习分布式事务、缓存、消息队列的核心原理和踩坑经验
3. 了解蚂蚁的技术体系（SOFAStack、中间件生态）
4. 准备性能优化的量化案例（QPS、RT、CPU 等指标）
