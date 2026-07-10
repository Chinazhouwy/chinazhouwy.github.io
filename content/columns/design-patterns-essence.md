---
title: "设计模式入门：从 if、for 和 new 开始理解常见模式"
date: "2026-07-09"
updated: "2026-07-10"
domain: "专栏"
area: "技术"
module: "设计模式"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "从基础控制流（if-else、for、new）出发，理解 12 种常见设计模式为什么出现、解决什么问题、什么时候先不要用。"
tags:
  - Java
  - 设计模式
  - 基础
  - 代码重构
---

# 设计模式入门：从 if、for 和 new 开始理解常见模式

> 本文代码主要用于表达设计结构和变化方式，省略了参数校验、异常处理和部分工程细节，不建议直接复制到生产环境。

---

## 一、为什么初学者觉得设计模式难

传统教程常从 UML、GoF 定义、角色名称、类图和适用性开始。这些内容没有错，但初学者缺少具体代码痛点，容易变成背诵——记住了"Strategy 定义一系列算法"，但不清楚什么时候该用它、不用它会怎样。

本文换一个视角：**从你已经熟悉的 `if-else`、`for`、`new` 出发，看代码随着需求变化出现什么问题，再去看设计模式如何重组这些代码。** 先建立直觉，再记名字。

---

## 二、判断是否需要模式的简单标准

在引入任何模式之前，先问自己：

- 这段代码是否频繁变化？
- 每次增加需求是否都要修改主流程？
- 相同判断是否散落在多个地方？
- 业务代码是否同时负责选择、创建、执行和扩展？
- 当前复杂度真的值得增加抽象吗？

如果只有两个稳定分支、未来几乎不会扩展，保留简单的 `if` 可能更清晰。模式是工具，不是目的。

---

## 三、具体模式

### 1. Strategy（策略）

**原始代码**：

```java
if ("FULL_REDUCTION".equals(type)) {
    // 满减计算
} else if ("DISCOUNT".equals(type)) {
    // 折扣计算
} else if ("COUPON".equals(type)) {
    // 优惠券计算
}
```

> 实际开发中建议使用 enum 而非字符串比较，此处为演示。后文示例同。

**问题**：每增加一种优惠类型，就要修改这段 `if-else`，容易影响已有分支。

**模式重组**：

```java
// 每种算法独立成类
interface PromotionStrategy {
    BigDecimal calculate(Order order);
}
// FullReductionStrategy、DiscountStrategy、CouponStrategy 各自实现

// 主流程保持稳定
PromotionStrategy strategy = strategyMap.get(type);
BigDecimal result = strategy.calculate(order);
```

**一句话理解**：主流程保持稳定，把可变化的算法交给策略对象。选择策略的逻辑并不会消失——它只是从 `if-else` 链移到了别处（Map、配置、工厂）。

**什么时候先不要用**：只有两三种稳定算法且不太会扩展时，保持 `if-else` 更清晰。

---

### 2. State（状态）

**原始代码**：

```java
if (order.getStatus() == OrderStatus.PENDING_PAY) {
    // 待支付行为
} else if (order.getStatus() == OrderStatus.PAID) {
    // 已支付行为
} else if (order.getStatus() == OrderStatus.SHIPPED) {
    // 已发货行为
}
```

**问题**：订单状态可能不断增加（退款中、已完成、已取消……），每个状态的行为散落在各处，新增状态需要修改大量条件判断。

**模式重组**：

```java
interface OrderState {
    void handle(OrderContext context);
}
// PendingPayState、PaidState、ShippedState 各自实现

currentState.handle(context);  // 状态自己知道自己能做什么
```

**一句话理解**：把不同状态下对象的不同行为封装到独立的状态类中，消除散落的巨型条件判断。

**什么时候先不要用**：状态只有两三个且行为简单时（比如只有"开/关"），状态模式可能过度设计。State 和 Strategy 结构相似但意图不同——这部分放在进阶篇详细讨论。

---

### 3. Factory（工厂）

**原始代码**：

```java
if ("mysql".equals(type)) {
    conn = new MySQLConnection();
} else if ("redis".equals(type)) {
    conn = new RedisConnection();
} else if ("kafka".equals(type)) {
    conn = new KafkaConnection();
}
```

**问题**：创建逻辑散落各处，调用方需要知道所有具体类名。新增一种连接类型需要修改所有创建点。

**模式重组**：

```java
Connection conn = ConnectionFactory.create(type);
// 工厂内部集中管理创建逻辑，调用方不知道具体类名
```

**一句话理解**：把散落的 `new` 集中到一处管理，让调用方只依赖接口而非具体类。

> 本文基础示例展示的是简单工厂的直觉。工厂方法（Factory Method）和抽象工厂（Abstract Factory）的区别放在进阶篇。简单工厂新增类型时通常仍需要修改中心工厂，不能简单宣称"完全符合开闭原则"。

**什么时候先不要用**：只创建一两种固定类型的对象，直接 `new` 足够清晰。工厂的价值在类型会持续增加时才体现。

---

### 4. Builder（建造者）

**原始代码**：

```java
new Order(userId, productId, quantity, couponId, 
          address, phone, remark, null, null, true);
// 第 8 个参数是什么？第 10 个参数 true 是什么意思？
```

**问题**：参数多、部分可选、调用时容易传错位置。构造函数重载会越写越多。

**模式重组**：

```java
Order order = Order.builder()
    .userId(1L)          // 必填
    .productId(100L)      // 必填
    .quantity(2)          // 必填
    .remark("急")        // 可选，不传也没关系
    .build();
```

**一句话理解**：把构造过程分步骤进行，每个步骤有明确的方法名，参数按需设置。

**什么时候先不要用**：参数只有两三个且全部必填时，构造函数足够。Builder 有额外样板代码成本，不是"参数多了就一定要用"。

---

### 5. Observer（观察者）

**原始代码**：

```java
public void onOrderCreated(Order order) {
    smsService.send(order);       // 发短信
    pointsService.add(order);     // 加积分
    inventoryService.deduct(order); // 扣库存
    // 每次新增一个处理方，都要修改这段代码
}
```

**问题**：订单创建直接依赖了短信、积分、库存等具体模块。新增一个处理方（比如发送优惠券）就要修改订单核心代码。

**模式重组**：

```java
// 发布者只发布事件
eventBus.publish(new OrderCreatedEvent(order));

// 各个订阅方各自注册自己
// SmsListener、PointsListener、InventoryListener 各自处理
```

**一句话理解**：从控制流角度看，Observer 把"谁需要被通知、如何维护订阅关系"的工作从业务代码中抽离出去。其底层仍可能通过遍历完成通知——它抽离的是订阅关系和通知协议，而不是消灭了遍历。

**什么时候先不要用**：只有一两个固定的后续处理，且不太会变化时，直接顺序调用即可。事件机制会降低代码的直观可读性（调试时不容易一眼看出谁在监听）。

---

### 6. Chain of Responsibility（责任链）

**原始代码**：

```java
for (Handler handler : handlers) {
    HandleResult result = handler.handle(request);
    if (result.isHandled()) {
        break;  // 某个处理器处理后就终止
    }
}
```

**问题**：循环体内的控制逻辑（什么时候继续、什么时候终止）和业务处理逻辑混在一起。当不同场景需要不同的终止条件时，修改循环体会影响所有场景。

**模式重组**：

```java
handlerChain.handle(request);
// 每个节点内部决定：自己处理请求，还是传给下一个处理器
```

**一句话理解**：把"是否继续传递"的控制权从集中循环移到每个节点自身。经典责任链常见的是"命中某个处理器后终止"；工程中也存在让所有节点依次处理的变体，后者往往更接近 Filter Chain 或 Pipeline。

**什么时候先不要用**：处理流程简单且固定、节点间没有复杂的传递逻辑时，`for` 循环更直观。

> "责任链"和"管道/拦截器链"在代码结构上可能相似，严格区别放到进阶篇。

---

### 7. Template Method（模板方法）

**原始代码**：

```java
// fetchFromDB()
connect(); query(); parse(); close();

// fetchFromRedis()
connect(); query(); parse(); close();

// 每个数据源的 connect/close 重复，只有 query/parse 不同
```

**问题**：固定的流程骨架（连接→操作→解析→关闭）在每个实现中重复，修改公共流程要改多处。

**模式重组**：

```java
abstract class DataFetcher {
    final void fetch() {
        connect();    // 公共步骤
        doQuery();    // 子类实现差异
        parse();      // 公共步骤
        close();      // 公共步骤
    }
    protected abstract void doQuery();
}
```

**一句话理解**：在父类中固定流程骨架，把局部差异步骤留给子类实现。另一种常见方式是模板流程加回调（如 `JdbcTemplate`），不要求继承，而是在固定流程中调用传入的回调接口——进阶篇会展开。

**什么时候先不要用**：流程本身还不够稳定，模板方法会让后续修改变得困难（父类变更影响所有子类）。

---

### 8. Adapter（适配器）

**原始代码**：

```java
if (source instanceof AliPayAPI) {
    result = aliPayAPI.pay(order);
} else if (source instanceof WechatPayAPI) {
    result = wechatPayAPI.transfer(order);  // 接口名都不一样
}
```

**问题**：不同来源的接口不兼容（方法名、参数、返回值格式不同），调用方需要做类型判断和转换。

**模式重组**：

```java
interface PaymentAdapter {
    PaymentResult pay(Order order);
}
// AliPayAdapter、WechatPayAdapter 各自实现，内部调用原始接口

PaymentAdapter adapter = ...;
PaymentResult result = adapter.pay(order);  // 调用方只面对统一接口
```

**一句话理解**：用适配器包装不兼容的接口，让调用方只面对统一接口。适配层本身会增加代码量，但当外部接口数量多、变化频繁时是值得的。

**什么时候先不要用**：只需要对接一两个外部系统且它们接口恰好相似时，过度适配可能增加不必要的间接层。

---

### 9. Proxy（代理）

**原始代码**：

```java
public void save(Order order) {
    log.info("开始保存");           // 前置
    checkPermission(order);         // 前置
    dao.save(order);                // 核心业务
    log.info("保存完成");           // 后置
    metrics.record(order);          // 后置
}
```

**问题**：日志、权限、指标等横切关注点和业务逻辑混在一起。每个方法都重复这套前置/后置逻辑。

**模式重组**：

```java
// 通过代理对象，在不修改原对象的情况下，自动在方法前后加入额外处理
// Spring AOP 的 @Around 就是这种思路
// 原对象只写业务代码，代理负责日志、权限、缓存等
```

**一句话理解**：通过代理控制对原对象的访问，在调用前后统一加入额外处理（事务、安全、日志、延迟加载）。代理的主要意图是控制访问，而非添加功能——与 Decorator 的区别放在进阶篇。

**什么时候先不要用**：只有少数方法需要额外处理时，直接写前置/后置代码更简单。代理引入了额外的间接层，对调试和理解执行流有一定成本。

---

### 10. Decorator（装饰器）

**原始代码**：

```java
// 对于需要"读文件 + 解压 + 缓冲"的场景
// 如果用 if 判断排列组合：
if (needGzip && needBuffer) { ... }
else if (needGzip) { ... }
else if (needBuffer) { ... }
```

**问题**：功能的动态组合无法用静态 `if` 优雅表达。继承所有排列组合会导致类爆炸。

**模式重组**：

```java
InputStream input = new BufferedInputStream(
    new GZIPInputStream(
        new FileInputStream("data.txt")
    )
);
// 每一层只负责一个功能（缓冲、解压、文件读取），可以自由组合
```

**一句话理解**：通过层层包装的方式，动态给对象添加职责。因为保持相同抽象接口，可以在类型兼容、顺序合理的前提下灵活组合。

**什么时候先不要用**：功能组合方式固定且不会变化时，装饰器带来的层层包装反而降低可读性。

---

### 11. Composite（组合）

**原始代码**：

```java
if (item instanceof File) {
    size += ((File) item).getSize();
} else if (item instanceof Folder) {
    for (Item child : ((Folder) item).getChildren()) {
        // 递归判断每个 child 是 File 还是 Folder...
    }
}
```

**问题**：树形结构中，客户端需要频繁判断节点类型并写递归逻辑。树的结构变化时，所有递归代码都要调整。

**模式重组**：

```java
interface TreeNode {
    int getSize();
}
// FileNode、FolderNode 都实现，FolderNode 内部递归处理子节点

item.getSize();  // 客户端不需要判断类型，不需要自己写递归
```

**一句话理解**：Composite 统一了叶子节点和组合节点，把递归和类型判断封装到组合对象内部。它没有消灭递归，只是让递归不再散落在每个调用方。

**什么时候先不要用**：树的深度和结构可预测、处理逻辑简单时，直接判断类型写递归可能更清晰。使用 Composite 可能迫使叶子节点实现无意义的方法（如 "添加子节点"）。

---

### 12. Singleton（单例）

**原始代码**：

```java
// 系统里到底有几个配置对象？几个连接池？
// 到处 new，无法保证全局唯一
```

**问题**：某些对象需要全局共享同一个实例（配置、连接池），但公开构造器无法阻止外界随意创建。

**模式重组**：

```java
final class Config {
    private static final Config INSTANCE = new Config();

    private Config() {}  // 构造器私有，外界无法 new

    public static Config getInstance() {
        return INSTANCE;
    }
}
```

**一句话理解**：控制实例数量，并为共享实例提供统一的访问点。"一个实例"指该类在运行时只有这一个共享对象，不意味着只能有一个引用或一个调用入口。

> Spring 默认的 singleton scope 是指每个容器、每个 Bean 定义一个共享实例，不等于 GoF 中"整个 JVM 只存在一个该类的对象"。同一个类可以注册为多个不同的 Spring Bean。这是进阶篇会展开讨论的常见误区。

**什么时候先不要用**：单例带来了全局状态、隐式依赖、测试隔离困难等副作用。很多场景下，通过依赖注入管理对象生命周期比硬编码单例更合适。

---

## 四、容易混淆的模式对

### Strategy 与 State

| | Strategy | State |
|---|---|---|
| 主要意图 | 替换算法或政策 | 行为随生命周期状态变化 |
| 关注点 | 选择怎么做 | 当前处于什么阶段 |
| 结构 | 常常相似 | 常常相似 |

初学时常听到"Strategy 外部切换、State 内部切换"。这作为入门直觉可以接受，但严格来说不够准确——State 的状态切换也可能由外部事件触发。核心区别在于意图：一个关注"选择什么算法"，一个关注"在不同状态下表现出不同行为"。

### Proxy 与 Decorator

| | Proxy | Decorator |
|---|---|---|
| 主要意图 | 控制访问（安全、事务、远程） | 动态增加职责 |
| 典型场景 | Spring AOP、@Transactional | JDK I/O（Buffered、GZIP） |

"代理只有一层、装饰器可以多层"不是本质区别——代理也可能多层，装饰器也可能单层。真正的区别在于**设计意图**：Proxy 关心怎么控制对目标对象的访问，Decorator 关心怎么给目标对象增加新能力。

### Template Method 与 Strategy

| | Template Method | Strategy |
|---|---|---|
| 手段 | 继承（子类覆盖局部步骤） | 组合（传入策略对象） |
| 耦合度 | 父子类强耦合 | 策略与调用方松耦合 |
| 灵活性 | 编译时确定结构 | 运行时替换策略 |

---

## 五、一句话总结

设计模式并不是对 `if`、`for`、`new` 等语法的机械替换，而是针对反复出现的变化点，组织对象的创建、组合和协作方式。当你发现某段代码频繁变化、每次增加需求都要修改主流程、或者同样的判断散落在多处——那时再考虑是否需要引入一个模式。

先写好能工作的代码，再识别变化点，最后引入合适的模式。不要反过来。

---

如果你已经能通过这些代码直觉识别常见模式，可以继续阅读：[设计模式进阶：意图、边界、代价与 Java 框架案例](#/article/content%2Fcolumns%2Fdesign-patterns-advanced.md)

---

*创建时间：2026-07-09*
*更新时间：2026-07-10*
*来源：面试练习 #54 回顾讨论*
