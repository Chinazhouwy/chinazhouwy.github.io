# 腾讯瑞驰 后端Java二面面经

> **来源**: 小红书
> **链接**: http://xhslink.com/o/IXXDrfOT5G
> **NoteId**: 6a0aadd5000000000803272e
> **标签**: #面试 #面经 #腾讯 #Java #后端
> **考点分类**: 项目设计、Java核心、中间件、数据库、算法、系统设计

---

## 基本信息

- **方向**: 偏业务 + 架构设计
- **时长**: 45-50min
- **形式**: 视频面
- **难度**: 中

---

## 一、项目深挖（20min）

> 面试的重头戏，占据近一半时间。面试官要求候选人详细介绍一个复杂的业务项目。

### 1.1 项目整体介绍

详细介绍一个业务复杂的项目，涵盖以下方面：
- **业务背景**: 项目解决什么问题，业务价值是什么
- **核心流程**: 关键业务链路如何运转
- **角色权限**: 不同角色的权限划分和控制
- **核心功能**: 系统提供的核心能力

### 1.2 核心业务逻辑设计

**Q: 项目中核心业务逻辑怎么设计的？有没有状态机 / 流程引擎？**

**答题思路**:
- 如果使用了状态机（如 Spring Statemachine、自研状态机），说明状态定义、事件驱动、状态流转规则
- 如果使用了流程引擎（如 Flowable、Camunda、Activiti），说明流程定义、任务分配、审批流转
- 如果没有使用，说明自研方案的设计思路和取舍

> ⚠️ 工程踩坑: 状态机设计时注意状态爆炸问题，避免过多的状态组合导致维护困难。建议在状态定义阶段就做好状态合并和抽象。

### 1.3 数据模型设计

**Q: 项目中数据模型设计：表结构、字段设计、关联关系、索引设计，有没有踩坑？**

**答题思路**:
- 说明核心表的设计思路（主表、关联表、扩展表）
- 关键字段的类型选择（如金额用 DECIMAL，状态用 TINYINT）
- 索引设计：联合索引的最左前缀原则、覆盖索引、避免索引失效
- 分享实际踩坑经历，如：
  - 索引设计不合理导致慢查询
  - 字段类型选择不当导致隐式类型转换索引失效
  - 分库分表后的 join 问题

> ⚠️ 工程踩坑: 最常见的坑是联合索引顺序设计不当。将区分度高的字段放在前面，且要考虑查询条件的组合。另外，VARCHAR 字段上建索引时注意前缀索引的长度选择。

### 1.4 扩展性设计

**Q: 项目中扩展性设计：新需求来了怎么快速迭代？有没有用策略模式 / 工厂模式？**

**答题思路**:
- **策略模式**: 用于消除 if-else 分支，如不同支付渠道的处理、不同促销策略的计算
- **工厂模式**: 用于对象的创建，如不同业务场景的 Service 工厂
- **模板方法模式**: 定义算法骨架，子类实现具体步骤
- 结合 Spring 的 `@Service` + 接口抽象 + 策略注册中心（Map注入）

**Java 示例（策略模式）**:
```java
// 策略接口
public interface PaymentStrategy {
    PaymentResult pay(PaymentRequest request);
    PaymentType supportType();
}

// 具体策略
@Service
public class AlipayStrategy implements PaymentStrategy {
    @Override
    public PaymentResult pay(PaymentRequest request) {
        // 支付宝支付逻辑
    }
    @Override
    public PaymentType supportType() {
        return PaymentType.ALIPAY;
    }
}

// 策略注册中心
@Service
public class PaymentStrategyRegistry {
    private final Map<PaymentType, PaymentStrategy> strategyMap;
    
    // Spring 自动注入所有 PaymentStrategy 实现
    public PaymentStrategyRegistry(List<PaymentStrategy> strategies) {
        this.strategyMap = strategies.stream()
            .collect(Collectors.toMap(PaymentStrategy::supportType, Function.identity()));
    }
    
    public PaymentStrategy getStrategy(PaymentType type) {
        return strategyMap.get(type);
    }
}
```

> ⚠️ 工程踩坑: 策略模式在 Spring 中要注意循环依赖问题。如果策略内部依赖了父级 Service，可能导致 Bean 创建失败。建议通过构造函数注入或 `@Lazy` 注解解决。

### 1.5 上线与运维

**Q: 项目上线后业务变更、数据迁移怎么做的？有没有风险？**

**答题思路**:
- **灰度发布**: 按用户/流量比例逐步放量
- **数据迁移方案**: 
  - 双写方案（老库+新库同时写，读从老库切到新库）
  - 离线迁移（停机维护，适合低峰期）
- **回滚方案**: 任何变更都要有回滚预案
- **风险评估**: 数据一致性、性能影响、兼容性

> ⚠️ 工程踩坑: 数据迁移最常见的坑是双写期间的数据一致性。建议在双写前先做全量数据比对，确认一致后再切读流量。切读后保留一段时间的双写，确认无问题后再关闭老库写入。

---

## 二、Java 核心（8min）

### 2.1 设计模式

**Q: 单例（懒汉 / 饿汉 / 双重校验）、工厂、策略、观察者，项目中用过哪些？**

**答题思路**:

**单例模式 — 双重校验锁（DCL）**:
```java
public class Singleton {
    // volatile 保证可见性和禁止指令重排
    private static volatile Singleton instance;
    
    private Singleton() {}
    
    public static Singleton getInstance() {
        if (instance == null) {          // 第一次检查
            synchronized (Singleton.class) {
                if (instance == null) {   // 第二次检查
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```
> ⚠️ 为什么需要 volatile: 没有 volatile 时，`new Singleton()` 的指令重排可能导致其他线程拿到半初始化的对象。

**观察者模式 — Spring 事件机制**:
```java
// 定义事件
public class OrderCreatedEvent extends ApplicationEvent {
    private final String orderId;
    public OrderCreatedEvent(Object source, String orderId) {
        super(source);
        this.orderId = orderId;
    }
    public String getOrderId() { return orderId; }
}

// 发布事件
@Service
public class OrderService {
    @Autowired private ApplicationEventPublisher publisher;
    
    public void createOrder(Order order) {
        // 创建订单逻辑...
        publisher.publishEvent(new OrderCreatedEvent(this, order.getId()));
    }
}

// 监听事件
@Component
public class OrderEventListener {
    @EventListener
    @Async  // 异步处理
    public void handleOrderCreated(OrderCreatedEvent event) {
        // 发送通知、更新库存等
    }
}
```

### 2.2 接口 vs 抽象类

**Q: 接口 vs 抽象类，区别、适用场景、设计原则。**

| 对比维度 | 接口 (Interface) | 抽象类 (Abstract Class) |
|---------|-----------------|----------------------|
| 多继承 | 支持多实现 | 单继承 |
| 成员变量 | 只能是 `public static final` | 可以有各种类型的成员变量 |
| 构造方法 | 无 | 有，子类构造时调用 |
| 默认方法 | Java 8+ 支持 `default` | 支持具体方法实现 |
| 设计意图 | 定义行为规范（Can-Do） | 定义模板和共性（Is-A） |

**适用场景**:
- **接口**: 定义能力/行为契约，如 `Comparable`、`Serializable`；跨领域的能力抽象
- **抽象类**: 有代码复用的场景，多个子类共享公共逻辑；定义算法骨架（模板方法模式）

> ⚠️ 设计原则: 优先使用接口（组合优于继承），当需要代码复用或定义模板时才用抽象类。这也是《Effective Java》推荐的 "Prefer interfaces to abstract classes"。

### 2.3 异常处理

**Q: 受检 / 非受检异常、自定义异常、try-catch-finally 执行顺序。**

**受检异常 (Checked Exception) vs 非受检异常 (Unchecked Exception)**:
- **受检异常**: 编译期必须处理，如 `IOException`、`SQLException`。适用于可恢复的异常场景。
- **非受检异常**: 继承 `RuntimeException`，编译期不强制处理，如 `NullPointerException`、`IllegalArgumentException`。适用于编程错误。

**自定义异常**:
```java
// 业务异常基类
public class BusinessException extends RuntimeException {
    private final String errorCode;
    private final String errorMessage;
    
    public BusinessException(String errorCode, String errorMessage) {
        super(errorMessage);
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
    }
}

// 全局异常处理
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(BusinessException.class)
    public Result handleBusinessException(BusinessException e) {
        return Result.error(e.getErrorCode(), e.getErrorMessage());
    }
}
```

**try-catch-finally 执行顺序**:
```java
public int test() {
    try {
        System.out.println("try");
        return 1;  // 先保存返回值
    } catch (Exception e) {
        System.out.println("catch");
    } finally {
        System.out.println("finally");
        // 如果 finally 中也有 return，会覆盖 try 中的返回值！
        // return 2;  // 千万不要这样做！
    }
    return 0;
}
// 输出: try -> finally -> 返回 1
```
> ⚠️ 工程踩坑: finally 中的 return 会覆盖 try 中的 return，且会"吞掉" try 中抛出的异常。永远不要在 finally 中 return 或 throw。

---

## 三、中间件 & 分布式（7min）

### 3.1 Spring Boot / Spring Cloud

**Q: 用没用到 Spring Boot/Spring Cloud？自动配置原理、starter 机制。**

**自动配置原理**:
1. `@SpringBootApplication` 包含 `@EnableAutoConfiguration`
2. `@EnableAutoConfiguration` 通过 `@Import(AutoConfigurationImportSelector.class)` 导入配置
3. `AutoConfigurationImportSelector` 读取 `META-INF/spring.factories`（Spring Boot 3.x 为 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`）
4. 根据 `@Conditional` 注解（如 `@ConditionalOnClass`、`@ConditionalOnMissingBean`、`@ConditionalOnProperty`）决定是否生效

```java
// 简化版的自动配置
@Configuration
@ConditionalOnClass(DataSource.class)  // 类路径有 DataSource 才生效
@EnableConfigurationProperties(DataSourceProperties.class)  // 绑定配置
public class DataSourceAutoConfiguration {
    
    @Bean
    @ConditionalOnMissingBean  // 容器中没有 DataSource 才创建
    public DataSource dataSource(DataSourceProperties props) {
        return props.initializeDataSourceBuilder().build();
    }
}
```

**Starter 机制**:
- Starter 是一个依赖描述符，将常用依赖打包在一起
- 如 `spring-boot-starter-web` 包含 Spring MVC、Tomcat、Jackson 等
- 自定义 Starter 命名规范：`xxx-spring-boot-starter`

> ⚠️ 工程踩坑: 自动配置冲突是常见问题。当多个 Starter 提供了相同 Bean 的自动配置时，使用 `@ConditionalOnMissingBean` 优先级不够，需要 `@AutoConfigureBefore` / `@AutoConfigureAfter` 明确顺序。

### 3.2 Spring 事务

**Q: Spring 事务：传播行为、隔离级别、失效场景（内部调用、异常未捕获）。**

**传播行为 (Propagation)**:
| 传播行为 | 说明 |
|---------|------|
| `REQUIRED` (默认) | 有事务就加入，没有就新建 |
| `REQUIRES_NEW` | 挂起当前事务，新建事务 |
| `NESTED` | 嵌套事务，外层回滚内层也回滚 |
| `SUPPORTS` | 有事务就加入，没有就以非事务方式执行 |
| `NOT_SUPPORTED` | 以非事务方式执行，挂起当前事务 |
| `MANDATORY` | 必须有事务，否则抛异常 |
| `NEVER` | 必须无事务，否则抛异常 |

**隔离级别 (Isolation)**:
| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|---------|-----|----------|-----|
| READ_UNCOMMITTED | ✓ | ✓ | ✓ |
| READ_COMMITTED | ✗ | ✓ | ✓ |
| REPEATABLE_READ (MySQL默认) | ✗ | ✗ | ✓ |
| SERIALIZABLE | ✗ | ✗ | ✗ |

**失效场景** (经典面试题):
```java
@Service
public class OrderService {
    
    @Autowired private OrderMapper orderMapper;
    
    // ❌ 场景1: 同类内部调用，事务不生效
    public void createOrder(Order order) {
        saveOrder(order);  // 直接调用，不走代理，事务失效！
    }
    
    @Transactional(rollbackFor = Exception.class)
    public void saveOrder(Order order) {
        orderMapper.insert(order);
    }
    
    // ❌ 场景2: 异常被 catch 吞掉，不回滚
    @Transactional(rollbackFor = Exception.class)
    public void updateOrder(String orderId) {
        try {
            orderMapper.update(orderId);
            throw new RuntimeException("模拟异常");
        } catch (Exception e) {
            // 吞掉异常，事务不会回滚！
            log.error("error", e);
        }
    }
    
    // ✅ 正确做法1: 注入自己（通过 AopContext）
    public void createOrderFixed(Order order) {
        ((OrderService) AopContext.currentProxy()).saveOrder(order);
    }
    
    // ✅ 正确做法2: 手动抛出异常
    @Transactional(rollbackFor = Exception.class)
    public void updateOrderFixed(String orderId) {
        try {
            orderMapper.update(orderId);
            throw new RuntimeException("模拟异常");
        } catch (Exception e) {
            log.error("error", e);
            throw e;  // 重新抛出，触发回滚
        }
    }
}
```
> ⚠️ 工程踩坑: `@Transactional` 默认只回滚 `RuntimeException` 和 `Error`，不回滚受检异常。必须加 `rollbackFor = Exception.class` 确保所有异常都回滚。

### 3.3 微服务注册中心

**Q: Nacos / Eureka / Consul，各自优缺点、选型依据。**

| 对比维度 | Nacos | Eureka | Consul |
|---------|-------|--------|--------|
| CAP | 支持 AP/CP 切换 | AP | CP |
| 健康检查 | TCP/HTTP/MySQL/MYSQL | 心跳 | 多种（HTTP/TCP/gRPC） |
| 配置管理 | ✅ 内置 | ❌ 需配合 Config | ✅ 内置 KV |
| 多数据中心 | ❌ | ❌ | ✅ |
| 协议 | DNS/HTTP | HTTP | HTTP/DNS/gRPC |
| 社区活跃度 | 高（阿里开源） | 低（已停更） | 高（HashiCorp） |
| Spring Cloud 支持 | ✅ | ✅ | ✅ |

**选型建议**:
- **Nacos**: 国内首选，AP/CP 灵活切换，配置管理一体，阿里生态
- **Eureka**: 老项目维护，不推荐新项目使用（Netflix 已停更）
- **Consul**: 多数据中心场景，Go 生态，健康检查能力强

---

## 四、数据库（5min）

### 4.1 数据库范式

**Q: 1NF/2NF/3NF/BCNF，反范式设计场景。**

| 范式 | 要求 |
|-----|------|
| 1NF | 原子性，字段不可再分 |
| 2NF | 满足1NF，非主属性完全依赖主键（消除部分依赖） |
| 3NF | 满足2NF，非主属性不依赖其他非主属性（消除传递依赖） |
| BCNF | 满足3NF，每个决定因素都包含候选键 |

**反范式设计场景**:
- **数据仓库/报表查询**: 空间换时间，预先 join 好数据
- **高频查询字段冗余**: 如订单表中冗余用户名，避免频繁 join
- **宽表设计**: 减少关联查询，提升查询性能

> ⚠️ 工程踩坑: 反范式化带来的数据一致性问题。冗余字段更新时必须同步更新，建议使用触发器或业务层保证一致性。

### 4.2 SQL 优化

**Q: 避免 select *、小表驱动大表、in 与 exists 选择、join 优化。**

**核心原则**:
1. **避免 `SELECT *`**: 减少网络传输和 IO，利用覆盖索引避免回表
2. **小表驱动大表**: 
   - `IN`: 当子查询结果集小时用 `IN`（小表驱动大表）
   - `EXISTS`: 当外表结果集小时用 `EXISTS`
   - 原则: 驱动表（小表）的数据量越小越好
3. **JOIN 优化**:
   - 确保 JOIN 字段有索引
   - 小表作为驱动表
   - 避免多表 JOIN（一般不超过3张表）
   - 使用 `EXPLAIN` 分析执行计划

```sql
-- ✅ 好的写法
EXPLAIN SELECT o.id, o.amount, u.name 
FROM orders o 
INNER JOIN users u ON o.user_id = u.id 
WHERE o.status = 1 AND o.create_time > '2024-01-01';
-- 确保 orders.status, orders.create_time, orders.user_id 有索引

-- ❌ 避免的写法
SELECT * FROM orders WHERE user_id IN (SELECT id FROM users WHERE status = 1);
-- 如果 users 结果集很大，IN 会非常慢
```

> ⚠️ 工程踩坑: 索引失效的常见场景 — 对索引字段做函数运算（`YEAR(create_time) = 2024`）、隐式类型转换（VARCHAR 字段传 INT）、LIKE 前缀模糊（`LIKE '%abc'`）、OR 条件中部分字段无索引。

---

## 五、算法（5min，手写）

### 5.1 反转单链表

```java
public ListNode reverseList(ListNode head) {
    ListNode prev = null;
    ListNode curr = head;
    while (curr != null) {
        ListNode next = curr.next;  // 保存下一个节点
        curr.next = prev;           // 反转指针
        prev = curr;                // prev 前移
        curr = next;                // curr 前移
    }
    return prev;  // prev 是新的头节点
}
```

### 5.2 求最长回文子串（中心扩展法）

```java
public String longestPalindrome(String s) {
    if (s == null || s.length() < 1) return "";
    int start = 0, end = 0;
    for (int i = 0; i < s.length(); i++) {
        int len1 = expandAroundCenter(s, i, i);       // 奇数长度
        int len2 = expandAroundCenter(s, i, i + 1);   // 偶数长度
        int len = Math.max(len1, len2);
        if (len > end - start) {
            start = i - (len - 1) / 2;
            end = i + len / 2;
        }
    }
    return s.substring(start, end + 1);
}

private int expandAroundCenter(String s, int left, int right) {
    while (left >= 0 && right < s.length() 
           && s.charAt(left) == s.charAt(right)) {
        left--;
        right++;
    }
    return right - left - 1;
}
```
> 时间复杂度: O(n²)，空间复杂度: O(1)。Manacher 算法可优化到 O(n)。

---

## 六、系统设计（5min）

### 6.1 设计一个电商订单系统

**考察核心点**: 订单状态流转、库存扣减、支付回调、超时取消、幂等性。

#### 6.1.1 订单状态流转（状态机）

```java
public enum OrderStatus {
    PENDING(0, "待支付"),
    PAID(1, "已支付"),
    SHIPPED(2, "已发货"),
    COMPLETED(3, "已完成"),
    CANCELLED(4, "已取消"),
    CLOSED(5, "已关闭");
    
    private final int code;
    private final String desc;
}

// 状态机定义
public class OrderStateMachine {
    private static final Map<OrderStatus, List<OrderStatus>> TRANSITIONS = Map.of(
        OrderStatus.PENDING, List.of(OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.CLOSED),
        OrderStatus.PAID, List.of(OrderStatus.SHIPPED),
        OrderStatus.SHIPPED, List.of(OrderStatus.COMPLETED),
        OrderStatus.COMPLETED, List.of(),
        OrderStatus.CANCELLED, List.of(),
        OrderStatus.CLOSED, List.of()
    );
    
    public boolean canTransit(OrderStatus from, OrderStatus to) {
        return TRANSITIONS.getOrDefault(from, List.of()).contains(to);
    }
}
```

#### 6.1.2 库存扣减

```java
// 方案: Redis 预扣减 + 数据库异步确认
@Service
public class StockService {
    
    @Autowired private StringRedisTemplate redisTemplate;
    @Autowired private StockMapper stockMapper;
    
    // 1. Redis 预扣减（高并发场景）
    public boolean preDeduct(String productId, int quantity) {
        String key = "stock:" + productId;
        Long stock = redisTemplate.opsForValue().decrement(key, quantity);
        if (stock == null || stock < 0) {
            redisTemplate.opsForValue().increment(key, quantity);  // 回滚
            return false;
        }
        return true;
    }
    
    // 2. 数据库确认扣减（异步）
    @Transactional
    public void confirmDeduct(String productId, int quantity) {
        // 乐观锁扣减，防止超卖
        int rows = stockMapper.updateStockWithVersion(productId, quantity);
        if (rows == 0) {
            throw new BusinessException("STOCK_INSUFFICIENT", "库存不足");
        }
    }
}
```

#### 6.1.3 支付回调 & 幂等性

```java
@Service
public class PaymentCallbackService {
    
    @Autowired private OrderService orderService;
    @Autowired private PaymentLogMapper paymentLogMapper;
    
    // 幂等性保证：基于支付流水号
    public void handleCallback(PaymentCallback callback) {
        // 1. 检查是否已处理
        PaymentLog log = paymentLogMapper.selectByTransactionId(callback.getTransactionId());
        if (log != null && log.getStatus() == PaymentStatus.SUCCESS) {
            return;  // 幂等：已处理，直接返回
        }
        
        // 2. 插入支付日志（唯一索引保证幂等）
        try {
            paymentLogMapper.insert(PaymentLog.builder()
                .transactionId(callback.getTransactionId())
                .orderId(callback.getOrderId())
                .amount(callback.getAmount())
                .status(PaymentStatus.SUCCESS)
                .build());
        } catch (DuplicateKeyException e) {
            return;  // 幂等：重复回调
        }
        
        // 3. 更新订单状态
        orderService.updateStatus(callback.getOrderId(), OrderStatus.PAID);
    }
}
```

#### 6.1.4 超时取消（延迟队列）

```java
// 方案: Redis + 过期监听 / RabbitMQ 延迟队列 / 时间轮
@Configuration
public class DelayQueueConfig {
    
    // Redis 过期 Key 监听
    @Bean
    public RedisMessageListenerContainer redisListenerContainer(
            RedisConnectionFactory factory, 
            KeyExpirationListener listener) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        container.addMessageListener(listener, PatternTopic("__keyevent@0__:expired"));
        return container;
    }
}

@Component
public class OrderTimeoutListener implements MessageListener {
    
    @Autowired private OrderService orderService;
    
    @Override
    public void onMessage(Message message, byte[] pattern) {
        String expiredKey = message.toString();
        if (expiredKey.startsWith("order:timeout:")) {
            String orderId = expiredKey.replace("order:timeout:", "");
            orderService.cancelIfUnpaid(orderId);
        }
    }
}
```

---

## 七、行为问题（5min）

### 7.1 优势和劣势

**答题要点**:
- **优势**: 结合具体项目经验，说明技术深度和解决问题的实际能力
- **劣势**: 诚实但要有改进方案，不要说致命缺点

### 7.2 为什么选择后端开发？未来想往哪个方向深入？

**答题要点**:
- **选择后端**: 对系统架构的兴趣、对高并发/高可用的追求、解决问题的成就感
- **未来方向**: 如分布式系统、云原生、微服务架构等，体现持续学习的意愿

---

## 总结

| 模块 | 时间占比 | 重要程度 |
|-----|---------|---------|
| 项目深挖 | 20min / 45min ≈ 44% | ⭐⭐⭐⭐⭐ |
| Java 核心 | 8min ≈ 18% | ⭐⭐⭐⭐ |
| 中间件 & 分布式 | 7min ≈ 15% | ⭐⭐⭐⭐ |
| 数据库 | 5min ≈ 11% | ⭐⭐⭐ |
| 算法 | 5min ≈ 11% | ⭐⭐⭐ |
| 系统设计 | 5min ≈ 11% | ⭐⭐⭐⭐ |
| 行为问题 | 5min ≈ 11% | ⭐⭐ |

**面试特点**: 偏业务 + 架构设计，项目深挖占大头（20分钟），需要对自己的项目非常熟悉，能讲清楚设计决策和技术细节。

