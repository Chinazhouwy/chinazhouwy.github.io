# 弦冰Java一面66道高频考点

> **来源**: 小红书
> **链接**: http://xhslink.com/o/8BdnvyhicxP
> **标签**: #Java面试 #后端开发 #面经 #集合 #JVM #并发编程 #RocketMQ #MySQL #设计模式

---

## 模块一：集合篇（Q1-10）

### Q1: ArrayList底层数据怎么存储？
**核心**：底层是 `Object[]` 数组。ArrayList 本质上是对数组的封装，提供动态扩容能力。

```java
transient Object[] elementData; // 非序列化，节约空间
```

### Q2: ArrayList扩容机制？
JDK8 无参构造：初始为空数组 `{}`，**首次 add 时扩容至 10**，后续每次扩容为原容量的 **1.5 倍**（`oldCapacity + (oldCapacity >> 1)`）。

```java
// 扩容核心逻辑
private void grow(int minCapacity) {
    int oldCapacity = elementData.length;
    int newCapacity = oldCapacity + (oldCapacity >> 1); // 1.5倍
    elementData = Arrays.copyOf(elementData, newCapacity);
}
```

> ⚠️ **踩坑**：如果预估数据量大，初始化时指定容量 `new ArrayList<>(1000)`，避免频繁扩容导致的数组拷贝开销。

### Q3-Q4: ArrayList线程安全问题？
**ArrayList** 所有方法都没加锁，多线程并发写会抛 **ConcurrentModificationException**（fail-fast 机制）。
- 多线程场景选 **CopyOnWriteArrayList**（读多写少）或 **Collections.synchronizedList**

### Q5: ConcurrentHashMap怎么保证线程安全？
**JDK7**：分段锁（Segment 继承 ReentrantLock），默认16个Segment
**JDK8**：**CAS + synchronized**，只锁数组桶的头节点，并发度更高

```java
// JDK8 putVal 核心逻辑
final V putVal(K key, V value, boolean onlyIfAbsent) {
    // 1. 空桶：CAS 无锁插入
    if (tabAt(tab, i) == null)
        casTabAt(tab, i, null, new Node<K,V>(hash, key, value));
    else {
        // 2. 有冲突：synchronized 锁头节点
        synchronized (f) {
            // 链表/红黑树插入
        }
    }
}
```

### Q6-Q8: HashMap vs ConcurrentHashMap
| 维度 | HashMap | ConcurrentHashMap |
|------|---------|-----------------|
| 线程安全 | ❌ | ✅ |
| 允许null | ✅ key/value均可null | ❌ |
| 锁粒度 | 无锁 | 桶级synchronized |
| 迭代器 | fail-fast | 弱一致性（不抛CME） |

**场景选择**：单线程或确定无并发 → HashMap；高并发读写 → ConcurrentHashMap

### Q9-Q10: 为什么需要ConcurrentHashMap？
HashMap 并发场景三大坑：
1. **数据覆盖**：两个线程同时 put 触发热点，一个 key 被另一个覆盖
2. **死循环**（JDK7）：扩容时环形链表，get 时 CPU 100%
3. **size 不准确**：多线程同时 put/remove，size() 返回的值是错的

**项目中实际场景**：缓存热点数据（如用户持仓信息），多个线程并发读写，用 ConcurrentHashMap + 本地过期策略。

---

## 模块二：线上问题排查（Q11-19）

### Q11: CPU飙高排查流程（必考）

```
① top 命令看整体
   → us 高：用户态代码问题（死循环、频繁GC）
   → sy 高：内核态问题（线程上下文切换频繁）

② top -Hp <pid>  定位高CPU线程ID
   → 找到 %CPU 最高的线程，记下 PID（十进制）

③ printf '%x\n' <pid>  转为16进制

④ jstack <pid> | grep -A 30 <16进制nid>
   → 定位到具体代码行
```

```java
// 常见CPU飙高原因
// 1. 死循环
while (true) { /* 无sleep/yield */ }

// 2. 频繁GC（内存泄漏导致）
// 3. 正则回溯（ReDoS）
Pattern.compile("(a+)+b").matcher("aaaaaaaaaaaaaaaac").matches(); // 指数级回溯

// 4. 频繁反序列化（Jackson/Fastjson）
```

### Q12-Q15: 线上OOM事故复盘

**典型案例**：基金收益查询接口

**问题**：接口查询全量用户持仓计算收益，**无分页**，数据量从几千涨到几十万后直接 OOM

**排查**：
1. 告警 → `jstat -gcutil <pid> 1000` 看到 FGC 频繁
2. `jmap -dump:live,format=b,file=heap.hprof <pid>` 导出堆
3. MAT 分析 → 发现 List 持有几十万条持仓记录

**修复方案**：

```java
// 前端：改为滚动加载/虚拟滚动
// 后端：强制分页 + 流式处理
public Result queryFundIncome(PageReq req) {
    // 强制每页最大100条
    if (req.getPageSize() > 100) req.setPageSize(100);
    
    // 游标分页（避免大偏移）
    List<Hold> holds = holdMapper.pageQuery(req.getLastId(), req.getPageSize());
    
    // 按需返回字段，不返回大字段
    return Result.ok(holds.stream()
        .map(FundIncomeVO::from)
        .collect(toList()));
}
```

### Q16-Q19: 耗时接口优化思路

接口链路：前端 → 网关(5s超时) → 服务A → 服务B/C/D

**优化思路**：

```
方案1: 并行化（CompletableFuture）
方案2: 缓存（本地Caffeine + Redis）
方案3: 异步化（MQ削峰）
方案4: 数据聚合层（BFF）
```

---

## 模块三：异步&线程池（Q20-27）

### Q20-Q24: CompletableFuture 深度

**典型优化场景**：基金收益接口需要查用户身份、持仓、行情、费率4个独立服务

```java
// ❌ 串行：4个RPC依次调用，耗时 = sum(各耗时)
UserInfo user = userService.getUser(uid);
List<Hold> holds = holdService.getHolds(uid);
Price price = priceService.getPrice(code);
Fee fee = feeService.getFee(uid);

// ✅ 并行：用CompletableFuture自定义线程池
ExecutorService bizPool = new ThreadPoolExecutor(
    8, 32, 60L, TimeUnit.SECONDS,
    new LinkedBlockingQueue<>(500),
    new NamedThreadFactory("biz-pool")
);

CompletableFuture<UserInfo> userFuture = 
    CompletableFuture.supplyAsync(() -> userService.getUser(uid), bizPool);
CompletableFuture<List<Hold>> holdFuture = 
    CompletableFuture.supplyAsync(() -> holdService.getHolds(uid), bizPool);
CompletableFuture<Price> priceFuture = 
    CompletableFuture.supplyAsync(() -> priceService.getPrice(code), bizPool);
CompletableFuture<Fee> feeFuture = 
    CompletableFuture.supplyAsync(() -> feeService.getFee(uid), bizPool);

// 等待所有结果
CompletableFuture.allOf(userFuture, holdFuture, priceFuture, feeFuture).join();

UserInfo user = userFuture.get(); // 此时已结束，不阻塞
```

> ⚠️ **踩坑**：必须用**自定义线程池**！默认的 `ForkJoinPool.commonPool()` 被占满会影响整个 JVM。

### Q25-Q27: 线程池应用场景

**场景**：
- 批量数据处理（百万级导入导出）
- 异步通知（短信、推送）
- 并行查询（上述CompletableFuture）
- 定时任务（如每日对账）

**线程池调度流程**：

```
任务提交
  ↓
核心线程 < corePoolSize？ 
  ├─ 是 → 新建核心线程执行
  └─ 否 → 任务队列满？
       ├─ 否 → 入队等待
       └─ 是 → 当前线程数 < maxPoolSize？
            ├─ 是 → 新建非核心线程
            └─ 否 → 执行拒绝策略（默认AbortPolicy抛异常）
```

---

## 模块四：RocketMQ（Q28-37）

### Q28: 消息不丢失三件套

```
生产者端：同步发送 + 等待ACK
   ↓
Broker端：同步刷盘（FlushDiskType=SYNC_FLUSH） + 主从复制
   ↓
消费者端：业务处理完才手动ACK（MANUAL）
```

```java
// 生产者：同步发送
SendResult result = producer.send(message);
if (result.getSendStatus() != SendStatus.SEND_OK) {
    // 重试或记录失败消息
}

// 消费者：手动ACK
consumer.registerMessageListener((MessageListenerConcurrently) (msgs, context) -> {
    try {
        process(msgs);      // 业务处理
        return ConsumeConcurrentlyStatus.CONSUME_SUCCESS; // 手动ACK
    } catch (Exception e) {
        return ConsumeConcurrentlyStatus.RECONSUME_LATER; // 重试
    }
});
```

### Q29-Q31: 幂等与死信

**幂等方案**：

```java
// 业务唯一ID + Redis SETNX
String idempotentKey = "order:" + orderId + ":" + eventType;
Boolean success = redis.setIfAbsent(idempotentKey, "1", 1, TimeUnit.HOURS);
if (!success) {
    return; // 已处理过，跳过
}
// 执行业务逻辑...
```

**达到最大重试次数** → 消息转入**死信队列**（DLQ），人工介入排查。

### Q33-Q37: 顺序消费

**保证顺序的三层**：
1. **生产端**：同类消息发送到同一个 MessageQueue（`selector` 按业务ID取模）
2. **Broker端**：队列本身有序（FIFO）
3. **消费端**：`MessageListenerOrderly` 加锁串行处理

```java
// 生产端：相同orderId的消息进同一个queue
producer.send(message, (mqs, msg, arg) -> {
    Long orderId = (Long) arg;
    return mqs.get(orderId.intValue() % mqs.size());
}, orderId);
```

> ⚠️ **踩坑**：顺序消息的消费端不要异步处理！如果非要异步，用单线程线程池（`Executors.newSingleThreadExecutor()`）确保串行。

---

## 模块五：微服务&MySQL（Q38-55）

### Q42: 超时重试幂等

```java
// 方案1：Token机制（提前生成唯一token，重试携带同一token，服务端去重）
// 方案2：业务唯一ID（如orderId + eventType）
// 方案3：数据库唯一索引（insert ... on duplicate key update）
```

### Q46-Q55: MySQL优化

#### 索引优化经验（6秒→1秒）

```sql
-- 原始SQL（6秒，全表扫描）
SELECT * FROM order WHERE status = 1 AND create_time > '2025-01-01' ORDER BY id DESC;

-- 加联合索引后（0.8秒）
ALTER TABLE `order` ADD INDEX idx_status_create_id (status, create_time, id);

-- 再进一步：覆盖索引（0.2秒）
-- 只查索引包含的字段，避免回表
SELECT id, status, create_time FROM `order` 
WHERE status = 1 AND create_time > '2025-01-01' ORDER BY id DESC;
```

#### 为什么用游标分页？

```sql
-- ❌ 传统offset分页（越往后越慢）
SELECT * FROM order LIMIT 100000, 20;
-- 实际执行：扫描100020条，丢弃前100000条

-- ✅ 游标分页（稳定耗时）
SELECT * FROM order WHERE id > 100000 LIMIT 20;
-- 实际执行：B+树定位到id=100000，往后取20条
```

> ⚠️ **踩坑**：联合索引最左匹配原则——`WHERE a > 1 AND b = 2`，a走索引但b不走（范围查询右边失效）

---

## 模块六：分布式锁&设计模式（Q56-66）

### Q56-Q59: Redis分布式锁

**基础实现**：

```bash
SET key value NX EX 30  # NX = 不存在才设置，EX = 过期时间
```

**完整代码**：

```java
// 正确的Redis分布式锁
String lockKey = "lock:order:" + orderId;
String requestId = UUID.randomUUID().toString(); // 唯一标识，用于安全解锁

// 加锁
Boolean locked = redis.setIfAbsent(lockKey, requestId, 30, TimeUnit.SECONDS);
if (!locked) {
    throw new BizException("系统繁忙，请稍后重试");
}
try {
    // 执行业务
    processOrder(orderId);
} finally {
    // 安全解锁：Lua脚本保证原子性（只删除自己的锁）
    String luaScript = 
        "if redis.call('get', KEYS[1]) == ARGV[1] then " +
        "  return redis.call('del', KEYS[1]) " +
        "else return 0 end";
    redis.eval(luaScript, Collections.singletonList(lockKey), 
               Collections.singletonList(requestId));
}
```

**Redisson看门狗机制**：
- 默认锁过期时间30秒
- 加锁成功后启动后台线程，每10秒检查一次
- 如果业务未执行完，自动续期到30秒
- 避免锁提前释放导致并发问题

### Q61-Q62: 策略模式 + Spring 集成

```java
// 策略接口
public interface CalculationStrategy {
    String getType();              // 策略标识
    Result calculate(Input input);
}

// Spring自动注入所有策略实现
@Component
public class CalculationContext {
    @Autowired
    private Map<String, CalculationStrategy> strategyMap; // key=beanName
    
    // 或按策略类型分组
    private final Map<String, CalculationStrategy> strategies;
    
    public CalculationContext(List<CalculationStrategy> strategyList) {
        this.strategies = strategyList.stream()
            .collect(Collectors.toMap(CalculationStrategy::getType, Function.identity()));
    }
    
    public Result calculate(String type, Input input) {
        CalculationStrategy strategy = strategies.get(type);
        if (strategy == null) throw new BizException("不支持的策略类型");
        return strategy.calculate(input);
    }
}
```

> ⚠️ **踩坑**：新增策略实现类后**无需改旧代码**，只需新增一个 `@Component` 类实现接口。这也是开闭原则（OCP）的最佳实践。

### Q63-Q65: 加解密 & HTTPS

- **AES**：对称加密，速度快，用于大数据量加密
- **RSA**：非对称加密，慢但安全，用于密钥交换和数字签名
- **HTTPS**：先 RSA 交换对称密钥（会话密钥），后续用 AES 加密通信内容

---

## 💡 总结

| 模块 | 核心考点 | 难度 |
|------|---------|------|
| 集合 | 扩容机制、红黑树转换、线程安全选择 | ⭐⭐ |
| 线上排查 | CPU飙高/OOM排查工具链、分页设计 | ⭐⭐⭐ |
| 异步&线程池 | CompletableFuture并行、自定义线程池 | ⭐⭐⭐ |
| RocketMQ | 消息不丢失、幂等、顺序消费 | ⭐⭐⭐ |
| MySQL | 索引优化、游标分页、EXPLAIN分析 | ⭐⭐⭐ |
| 分布式锁 | SET NX EX、看门狗、安全解锁 | ⭐⭐⭐ |
| 设计模式 | 策略模式Spring集成 | ⭐⭐ |