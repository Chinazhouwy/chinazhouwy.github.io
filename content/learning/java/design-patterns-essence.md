---
title: "设计模式本质：每个模式替换了什么基础控制流"
date: "2026-07-09"
domain: "专栏"
area: "技术"
module: "Java"
project: ""
type: "学习"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "设计模式本质：每个模式替换了什么基础控制流"
tags:
  - 设计模式
  - Java
  - 面试
---

# 设计模式本质：每个模式替换了什么基础控制流

> 核心洞察：设计模式 = 把 if/for/while 这些基础控制流，封装成可复用、可扩展的结构。
> 理解了这个视角，面试时说设计模式就不会背概念，而是能解释**为什么要用它、替换了什么、解决了什么问题**。

---

## 一、总览：基础控制流 → 对应模式

| 基础控制流 | 对应模式 |
|-----------|---------|
| if-else / switch | 策略模式、状态模式 |
| for + break/continue | 责任链、观察者 |
| 重复代码 + 小差异 | 模板方法、装饰器 |
| method 前后重复逻辑 | 代理、AOP |
| scattered new | 工厂 |
| 超长参数 | 建造者 |
| 递归 instanceof | 组合 |
| 类型转换散落 | 适配器 |

---

## 二、逐个拆解

### 1. 策略模式 → 替换 if-else / switch 选择

```java
// 没有策略模式
if (type == "满减") { ... }
else if (type == "折扣") { ... }
else if (type == "直减") { ... }

// 策略模式
strategyMap.get(type).calculate(order);
```

**本质：** 把算法选择从 if-else 链中抽离，每个算法独立成类，通过 Map 或配置动态选择。

**面试话术：** "优惠券规则用策略模式，每种券类型一个 Strategy 实现，通过配置管理规则。比 EL 表达式更灵活可控，新增规则只需加一个实现类，不用改循环逻辑。"

---

### 2. 责任链模式 → 替换 for 循环 + break/continue

```java
// 没有责任链
for (Handler h : handlers) {
    if (!h.handle(request)) break;  // 硬链：某个失败就停止
    // 或者
    h.handle(request);              // 软链：全部执行
}

// 责任链
handler.handle(request);  // 内部决定是否传给下一个
```

**本质：** 把循环逻辑分散到每个节点里，而不是集中在循环体里。

**硬链 vs 软链：**
- 硬链：某个节点返回 null → 终止（类似 `break`）
- 软链：每个节点都执行，最后汇总结果（类似 `for` 全部跑完）

**典型场景：** Servlet Filter、Netty ChannelPipeline、日志/权限校验链

**面试话术：** "优惠券规则场景，for 循环 + 优先级排序就能搞定。如果规则之间有复杂的拦截逻辑需要解耦，可以用责任链，但本质是同一种思路的封装。"

---

### 3. 工厂模式 → 替换 scattered new XXX()

```java
// 没有工厂
if (type == "mysql") conn = new MySQLConnection();
else if (type == "redis") conn = new RedisConnection();
else if (type == "kafka") conn = new KafkaConnection();

// 工厂
conn = ConnectionFactory.create(type);
```

**本质：** 把对象创建逻辑集中管理，调用方不需要知道具体类名。

**面试话术：** "用工厂模式封装连接创建，调用方只传 type 字符串，工厂内部根据配置选择具体实现。新增数据源只需加一个工厂分支，不用改所有调用方。"

---

### 4. 观察者模式 → 替换 for 循环 + 逐个通知

```java
// 没有观察者
for (Listener l : listeners) {
    l.onOrderCreated(order);  // 每加一个监听者，改这里
}

// 观察者
eventBus.publish(orderCreatedEvent);  // 监听者自己注册，发布者不用管
```

**本质：** 发布者不知道有多少订阅者，订阅者自己注册，解耦发布和订阅。

**面试话术：** "订单创建后发事件，各个子系统（库存、积分、通知）自己订阅处理。发布者不需要知道有哪些监听者，新增子系统只需加一个监听器，不用改订单逻辑。"

---

### 5. 模板方法 → 替换重复代码 + 小差异

```java
// 没有模板方法
// fetchFromDB() { 连接 → 查询 → 解析 → 关闭 }
// fetchFromRedis() { 连接 → 查询 → 解析 → 关闭 }  // 重复

// 模板方法
abstract class DataFetcher {
    void fetch() {
        connect();    // 公共
        query();      // 子类实现
        parse();      // 公共
        close();      // 公共
    }
}
```

**本质：** 把公共流程固定在父类，差异点留给子类实现。

**面试话术：** "数据采集流程用模板方法，连接、关闭是公共逻辑，查询和解析各数据源不同。子类只需实现差异部分，不用重复写连接关闭代码。"

---

### 6. 代理模式 → 替换 method 前后的重复处理

```java
// 没有代理
public void save(Order order) {
    log.info("开始保存");        // 前置
    checkPermission(order);      // 前置
    dao.save(order);
    log.info("保存完成");        // 后置
    notify(order);               // 后置
}

// 代理
@Log + @Permission + @Notify  // 或 JDK/CGLIB 代理自动包裹
public void save(Order order) {
    dao.save(order);
}
```

**本质：** 在不修改原方法的情况下，动态添加前置/后置处理。

**面试话术：** "用代理模式做日志、权限、缓存，业务代码保持纯净。Spring AOP 就是代理模式的实现，通过切面统一处理横切关注点。"

---

### 7. 装饰器模式 → 替换嵌套 if 判断行为组合

```java
// 没有装饰器
if (needLog && needRetry && needCache) {
    // 一堆嵌套逻辑
}

// 装饰器
InputStream is = new BufferedInputStream(
    new GZIPInputStream(
        new FileInputStream("data.txt")));  // 一层套一层，自由组合
```

**本质：** 动态地给对象添加功能，比继承更灵活。

**面试话术：** "IO 流用装饰器模式，BufferedInputStream 包装 GZIPInputStream，每一层只负责一个功能（缓冲、压缩、文件读取），可以自由组合。"

---

### 8. 建造者模式 → 替换超长参数列表

```java
// 没有建造者
new Order(userId, productId, quantity, couponId, 
          address, phone, remark, null, null, true);

// 建造者
Order.builder()
    .userId(1L)
    .productId(100L)
    .quantity(2)
    .build();
```

**本质：** 把构造过程分步骤，参数可选，代码可读。

**面试话术：** "复杂对象用建造者模式，参数按需设置，比构造函数重载更清晰。Lombok @Builder 自动生成，零成本。"

---

### 9. 状态模式 → 替换复杂状态机 if-else

```java
// 没有状态
if (state == "待支付") { ... }
else if (state == "已支付") { ... }
else if (state == "已发货") { ... }
else if (state == "已完成") { ... }
// 每个状态的行为散落各处

// 状态模式
currentState.handle(context);  // 状态自己知道自己能做什么
```

**本质：** 把状态相关的行为分散到各个状态类中，消除巨型 if-else。

**面试话术：** "订单状态机用状态模式，每个状态是一个类，自己处理自己的转换逻辑。新增状态只需加一个类，不用改状态机主逻辑。"

---

### 10. 单例模式 → 替换全局变量管理

```java
// 没有单例
// 全局变量？static？到处 new？谁知道几个实例？

// 单例
Config config = Config.getInstance();  // 明确：只有一个
```

**本质：** 控制实例数量，确保全局唯一。

**面试话术：** "配置中心客户端用单例，确保全局只有一个连接池，避免资源浪费和配置不一致。"

---

### 11. 适配器模式 → 替换类型转换散落各处

```java
// 没有适配器
if (source instanceof MySQL) {
    conn = new MySQLConnection(source);
} else if (source instanceof PostgreSQL) {
    conn = new PGConnection(source);
}

// 适配器
conn = new DatabaseAdapter(source);  // 统一接口
```

**本质：** 让不兼容的接口能够协同工作。

**面试话术：** "第三方支付对接用适配器，把支付宝、微信支付的接口统一成内部支付接口，调用方不用关心具体实现。"

---

### 12. 组合模式 → 替换递归 instanceof 判断

```java
// 没有组合模式
if (item instanceof File) { ... }
else if (item instanceof Folder) {
    for (Item child : folder.getChildren()) {
        // 递归判断...
    }
}

// 组合模式
item.getSize();  // File 和 Folder 都实现同一接口，递归自动处理
```

**本质：** 把树形结构的对象统一处理，消除递归中的类型判断。

**面试话术：** "菜单权限用组合模式，按钮和菜单都实现 Permission 接口，递归检查权限时不用判断类型。"

---

## 三、开源框架中的设计模式

### 1. 策略模式

| 框架 | 体现 | 说明 |
|------|------|------|
| **Spring** | `ResourceLoader` | `ClassPathResource` / `FileSystemResource` / `UrlResource`，根据前缀自动选择策略 |
| **Spring** | `InstantiationStrategy` | `SimpleInstantiationStrategy` / `CglibSubclassingInstantiationStrategy`，Bean 实例化策略 |
| **JDK** | `Comparator` | `Collections.sort(list, comparator)`，排序算法不变，比较策略可换 |
| **JDK** | `TreeMap` / `TreeSet` | 构造时传入 Comparator，决定排序策略 |

```java
// Spring ResourceLoader - 策略模式经典应用
ResourceLoader loader = new DefaultResourceLoader();
Resource res = loader.getResource("classpath:config.xml");  // 根据前缀选策略
```

---

### 2. 责任链模式

| 框架 | 体现 | 说明 |
|------|------|------|
| **Netty** | `ChannelPipeline` | `ChannelHandler` 链，每个 Handler 处理后决定是否传递 |
| **Spring** | `FilterChain` | Servlet Filter 链，`doFilter` 内调用 `chain.doFilter` 传递 |
| **Spring Security** | `SecurityFilterChain` | 认证、授权、CSRF 等过滤器链 |
| **MyBatis** | `InterceptorChain` | 插件拦截器链，层层拦截 SQL 执行 |

```java
// Netty ChannelPipeline - 责任链经典应用
pipeline.addLast("decoder", new HttpDecoder());
pipeline.addLast("aggregator", new HttpObjectAggregator());
pipeline.addLast("handler", new BusinessHandler());
// 每个 Handler 处理完决定是否 fireNext
```

---

### 3. 工厂模式

| 框架 | 体现 | 说明 |
|------|------|------|
| **Spring** | `BeanFactory` / `ApplicationContext` | 根据配置创建 Bean，隐藏实例化细节 |
| **JDK** | `Collections.unmodifiableList()` | 返回不可变列表，隐藏具体实现类 |
| **JDK** | `Arrays.asList()` | 返回固定大小列表，隐藏具体实现 |
| **MyBatis** | `SqlSessionFactory` | 根据配置创建 SqlSession |

```java
// Spring BeanFactory - 工厂模式核心
BeanFactory factory = new ClassPathXmlApplicationContext("beans.xml");
UserDao dao = factory.getBean(UserDao.class);  // 不需要知道具体实现类
```

---

### 4. 观察者模式

| 框架 | 体现 | 说明 |
|------|------|------|
| **Spring** | `ApplicationEvent` / `ApplicationListener` | Spring 事件机制，`publishEvent` 触发所有监听器 |
| **Spring** | `@EventListener` | 注解驱动的观察者，更简洁 |
| **JDK** | `EventListener` | AWT/Swing 事件模型的基础 |
| **MQ** | Kafka / RocketMQ | 消息队列本质是分布式观察者 |

```java
// Spring Event - 观察者模式经典应用
@Component
public class OrderEventListener {
    @EventListener
    public void onOrderCreated(OrderCreatedEvent event) {
        // 库存、积分、通知各自监听，发布者不需要知道
    }
}
```

---

### 5. 模板方法

| 框架 | 体现 | 说明 |
|------|------|------|
| **Spring** | `JdbcTemplate` | 连接、关闭是模板，SQL 是差异 |
| **Spring** | `RestTemplate` | HTTP 调用模板，拦截器是扩展点 |
| **MyBatis** | `BaseExecutor` | `SimpleExecutor` / `BatchExecutor` 继承它，实现不同执行策略 |
| **JDK** | `AbstractList` | `get()` / `size()` 是模板，具体存储由子类实现 |

```java
// Spring JdbcTemplate - 模板方法经典应用
jdbcTemplate.query("SELECT * FROM user", (rs, rowNum) -> {
    // 连接、关闭是模板，映射逻辑是子类实现
    return new User(rs.getLong("id"), rs.getString("name"));
});
```

---

### 6. 代理模式

| 框架 | 体现 | 说明 |
|------|------|------|
| **Spring AOP** | `JDK Dynamic Proxy` / `CGLIB` | 方法拦截，添加前置/后置处理 |
| **Spring** | `@Transactional` | 事务管理通过代理实现，业务代码不感知事务 |
| **MyBatis** | `MapperProxy` | Mapper 接口的代理，拦截方法调用转为 SQL 执行 |
| **Spring** | `@Async` | 异步执行通过代理，调用方以为是同步 |

```java
// Spring AOP - 代理模式核心应用
@Aspect
@Component
public class LogAspect {
    @Before("execution(* com.example.service.*.*(..))")
    public void before(JoinPoint jp) {
        // 所有 service 方法执行前自动记录日志
    }
}
```

---

### 7. 装饰器模式

| 框架 | 体现 | 说明 |
|------|------|------|
| **JDK** | `BufferedInputStream` | 包装 `FileInputStream`，添加缓冲功能 |
| **JDK** | `Collections.synchronizedList` | 包装普通 List，添加线程安全 |
| **MyBatis** | Cache 装饰器 | `LruCache` / `FIFOcache` / `LoggingCache` 层层装饰 |
| **Netty** | `ByteBuf` 包装 | `CompositeByteBuf` 等组合多个 ByteBuf |

```java
// MyBatis Cache - 装饰器模式经典应用
Cache cache = new LruCache(new LoggingCache(new PerpetualCache()));
// 每层只负责一个功能：LRU淘汰、日志、持久化
```

---

### 8. 建造者模式

| 框架 | 体现 | 说明 |
|------|------|------|
| **Spring** | `UriComponentsBuilder` | 构建 URI，参数按需设置 |
| **MyBatis** | `Environment.Builder` | 构建 MyBatis 环境配置 |
| **Lombok** | `@Builder` | 自动生成建造者代码 |
| **Netty** | `ServerBootstrap` | 链式调用配置服务器 |

```java
// Spring UriComponentsBuilder - 建造者模式经典应用
URI uri = UriComponentsBuilder
    .fromHttpUrl("https://api.example.com")
    .path("/users")
    .queryParam("id", 123)
    .build()
    .toUri();
```

---

### 9. 状态模式

| 框架 | 体现 | 说明 |
|------|------|------|
| **Spring State Machine** | `StateMachine` | 完整的状态机框架 |
| **Netty** | `ChannelState` | 连接状态管理 |
| **MyBatis** | `TransactionState` | 事务状态转换 |

---

### 10. 单例模式

| 框架 | 体现 | 说明 |
|------|------|------|
| **Spring** | Bean 默认 Scope | `@Scope("singleton")`，容器内唯一 |
| **JDK** | `Runtime.getRuntime()` | JVM 运行时单例 |
| **JDK** | `Logger` | 日志管理器单例 |

---

### 11. 适配器模式

| 框架 | 体现 | 说明 |
|------|------|------|
| **Spring MVC** | `HandlerAdapter` | 统一处理 Controller、Servlet、Function 等不同类型的 Handler |
| **JDK** | `InputStreamReader` | 字节流 → 字符流的适配 |
| **JDK** | `Arrays.asList()` | 数组 → List 的适配 |
| **Spring** | `AdvisorAdapter` | 将 Advice 适配为 MethodInterceptor |

```java
// Spring MVC HandlerAdapter - 适配器模式经典应用
// 不同类型的 Handler（Controller、HttpRequestHandler、Servlet）
// 通过 HandlerAdapter 统一调用
```

---

### 12. 组合模式

| 框架 | 体现 | 说明 |
|------|------|------|
| **Spring** | `CompositeHealthContributor` | 多个 HealthIndicator 组合 |
| **JDK** | `java.awt.Container` | GUI 组件树，Component 统一处理 |
| **MyBatis** | `SqlNode` | SQL 片段组合，`MixedSqlNode` 包含多个子节点 |

---

## 四、横向对比：看起来像，本质不同

### 策略 vs 状态：都是 if-else 替代，但切换时机不同

| | 策略模式 | 状态模式 |
|--|---------|---------|
| **切换者** | 外部（调用方选择） | 内部（状态自身转换） |
| **切换时机** | 一次性选择，运行中不变 | 运行中根据行为动态切换 |
| **类比** | 导航选路线（高铁/飞机/自驾） | 游戏角色状态（站立/行走/攻击） |

```java
// 策略：外部选择
Strategy s = strategyMap.get(type);  // 调用方决定用哪个
s.execute();

// 状态：内部转换
currentState.handle(context);  // 状态执行完可能变成另一个状态
// context.setState(new PaidState());
```

**面试话术：** "策略是'你选哪个算法'，状态是'我现在是什么状态，能做什么'。策略切换由外部控制，状态切换由自身行为触发。"

---

### 工厂 vs 建造者：都是对象创建，但复杂度不同

| | 工厂模式 | 建造者模式 |
|--|---------|-----------|
| **复杂度** | 一步到位 | 分步构建 |
| **参数** | 固定 | 可选 |
| **场景** | 创建简单对象 | 创建复杂对象（多参数、可选） |

```java
// 工厂：一步创建
Connection conn = ConnectionFactory.create("mysql");

// 建造者：分步构建
Order order = Order.builder()
    .userId(1L)           // 必填
    .productId(100L)      // 必填
    .couponId(null)       // 可选，不传
    .remark("急")         // 可选
    .build();
```

**面试话术：** "工厂解决'怎么创建'，建造者解决'怎么拼装'。工厂是选择题，建造者是填空题。"

---

### 代理 vs 装饰器：都是包装，但目的不同

| | 代理模式 | 装饰器模式 |
|--|---------|-----------|
| **目的** | 控制访问（权限、日志） | 添加功能（缓冲、压缩） |
| **感知** | 被代理对象可能不知道 | 被装饰对象不知道 |
| **数量** | 通常一个代理 | 可以层层嵌套 |

```java
// 代理：控制访问
UserDao proxy = (UserDao) Proxy.newProxyInstance(...);
// 目的：权限检查、日志记录

// 装饰器：添加功能
InputStream is = new BufferedInputStream(
    new GZIPInputStream(
        new FileInputStream("data.txt")));
// 目的：添加缓冲、压缩功能
```

**面试话术：** "代理是'门卫'，控制谁能进；装饰器是'衣服'，给对象穿更多功能。代码结构类似，但意图完全不同。"

---

### 模板方法 vs 策略：都是封装差异，但手段不同

| | 模板方法 | 策略模式 |
|--|---------|---------|
| **手段** | 继承（子类实现差异） | 组合（传入不同策略） |
| **耦合** | 父子类强耦合 | 策略与调用方解耦 |
| **灵活性** | 编译时确定 | 运行时可换 |

```java
// 模板方法：继承
abstract class DataFetcher {
    void fetch() {
        connect();
        query();  // 子类实现
        close();
    }
}

// 策略：组合
class DataFetcher {
    private QueryStrategy strategy;  // 运行时传入
    void fetch() {
        connect();
        strategy.query();
        close();
    }
}
```

**面试话术：** "模板方法是'你继承我，按我的流程走'，策略是'你带着你的算法来，我调用你'。继承是强耦合，组合更灵活。"

---

### 观察者 vs 责任链：都是多节点，但流向不同

| | 观察者模式 | 责任链模式 |
|--|---------|-----------|
| **流向** | 一对多广播 | 一对一传递 |
| **结果** | 每个节点独立处理 | 节点间有依赖关系 |
| **终止** | 不会终止（除非异常） | 可以中途终止 |

```java
// 观察者：广播
eventBus.publish(event);  // 所有监听者都收到，互不影响

// 责任链：传递
handler1.handle(request)  // 处理后传给 handler2
    .handle(request)      // 可能中途返回 null 终止
```

**面试话术：** "观察者是'群发通知'，每个人独立处理；责任链是'接力棒'，一个传一个，中间可以断。"

---

## 五、面试回答模板

> "设计模式的本质是**把基础控制流封装成可扩展的结构**。
> 
> 比如策略模式把 if-else 链抽离成独立的算法类，责任链把 for 循环的 break/continue 逻辑分散到每个节点，工厂模式把 scattered new 集中管理。
> 
> 面试时不需要背概念，而是要能解释**为什么要用它、替换了什么、解决了什么问题**。比如优惠券规则用策略模式，是因为规则会频繁变化，用 if-else 每次都要改代码，策略模式让新增规则只需加一个类。
> 
> 同时要注意区分相似模式：策略 vs 状态（切换者不同）、代理 vs 装饰器（目的不同）、模板方法 vs 策略（继承 vs 组合）。"

---

## 六、常见追问

**Q: 策略模式和工厂模式有什么区别？**
> 工厂负责创建对象，策略负责使用对象。工厂解决"怎么创建"，策略解决"怎么选择算法"。可以组合使用：工厂创建策略对象，策略执行具体算法。

**Q: 代理模式和装饰器模式有什么区别？**
> 代理强调控制访问（权限、日志），装饰器强调添加功能（缓冲、压缩）。代码结构类似，但意图不同。

**Q: 什么时候用模板方法，什么时候用策略？**
> 流程固定、步骤差异 → 模板方法。算法可选、整体替换 → 策略。模板方法是继承，策略是组合。

**Q: Spring AOP 用了哪些设计模式？**
> 代理模式（核心）、观察者（事件机制）、策略（多种代理方式）、工厂（Bean 创建）。AOP 本身是代理模式的典型应用。

**Q: MyBatis 用了哪些设计模式？**
> 工厂（SqlSessionFactory）、代理（MapperProxy）、模板方法（BaseExecutor）、装饰器（Cache）、责任链（InterceptorChain）。MyBatis 是设计模式的教科书级应用。

---

## 七、引发思考

**思考 1：为什么 Java 框架这么爱用设计模式？**
> 因为 Java 是面向对象语言，设计模式是 OOP 的最佳实践。框架需要扩展性（用户自定义实现）、解耦（模块独立演进）、可维护（代码清晰），设计模式恰好解决这些问题。

**思考 2：设计模式有没有缺点？**
> 有。过度使用会导致：
> - 类数量爆炸（一个功能几十个类）
> - 理解成本高（要看懂类之间的关系）
> - 简单问题复杂化（一个 if-else 能搞定的事用策略模式）
> 
> 原则：**能用 if-else 搞定的，就不要用设计模式。只有当 if-else 会导致代码难以维护时，才考虑模式。**

**思考 3：设计模式和 SOLID 有什么关系？**
> 设计模式是 SOLID 原则的具体实现：
> - 策略模式 → 开闭原则（对扩展开放，对修改关闭）
> - 工厂模式 → 依赖倒置（依赖抽象，不依赖具体）
> - 代理模式 → 单一职责（日志/权限和业务分离）
> - 模板方法 → 里氏替换（子类可以替换父类）
> - 接口隔离 → 所有模式都强调小接口

**思考 4：为什么 Spring 能成为 Java 框架之王？**
> 因为它把设计模式用到了极致：
> - IOC 容器 = 工厂 + 单例 + 依赖注入
> - AOP = 代理 + 责任链 + 观察者
> - 事件机制 = 观察者
> - 模板方法 = JdbcTemplate / RestTemplate
> 
> Spring 的成功，本质上是设计模式的成功。

---

*创建时间：2026-07-09*
*更新时间：2026-07-09*
*来源：面试练习 #54 回顾讨论*
