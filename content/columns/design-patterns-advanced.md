---
title: "设计模式进阶：意图、边界、代价与 Java 框架源码"
date: "2026-07-10"
domain: "专栏"
area: "技术"
module: "设计模式"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "high"
visibility: "private"
summary: "纠正入门篇的简化表述，深入解释设计模式的意图、边界、代价和 Java 框架中的真实实现。按容易混淆的问题组织，涵盖 Strategy/State、Proxy/Decorator、Factory 三种层次、Template Method/Callback、Observer/EventBus/MQ、CoR/FilterChain/Pipeline 等。"
tags:
  - Java
  - 设计模式
  - Spring
  - MyBatis
  - Netty
  - 源码
---

# 设计模式进阶：意图、边界、代价与 Java 框架源码

> 本文默认你已经阅读了[设计模式入门：从 if、for 和 new 开始理解常见模式](#/article/content%2Fcolumns%2Fdesign-patterns-essence.md)。基础篇为了降低门槛做了一些简化，本文补充严格的定义、边界和框架实现。

---

## 一、设计模式真正管理的是什么

设计模式不是对 `if`、`for`、`new` 的语法替换。它管理的是**变化轴**——识别代码中哪些部分会变化，把它们封装起来，让变化不会扩散到稳定部分。

| 变化轴 | 常见模式 |
|---|---|
| 算法或政策变化 | Strategy |
| 生命周期状态变化 | State |
| 创建方式变化 | Factory、Builder |
| 接口差异 | Adapter |
| 访问控制 | Proxy |
| 职责动态叠加 | Decorator |
| 一对多通知 | Observer |
| 请求在多个处理器间传递 | Chain of Responsibility |
| 流程骨架稳定、局部步骤变化 | Template Method |
| 整体与局部统一 | Composite |
| 实例数量和作用域 | Singleton |

模式名称的价值是**建立团队共同语言**——说"这里用 Strategy"比"把算法抽成接口然后各自实现"节约大量沟通成本。但反过来，模式不是强制模板——看到接口就说 Strategy、看到包装就说 Decorator，等于没有真正理解它。

---

## 二、Strategy 与 State

### 为什么容易混淆

两者的结构几乎相同——都是一个 Context 持有一个接口引用，调用接口方法。区别在于意图。

### Strategy

**意图**：替换算法或政策。Context 需要"以不同方式完成同一件事"。

**切换来源**：可以由外部决定（调用方传入），也可以由配置决定，也可以由 Context 根据条件自行选择。"外部切换"是常见情况，但不是唯一情况。

```java
// 调用方选择策略
Context ctx = new Context(new FullReductionStrategy());
ctx.execute(order);

// 也可以由内部条件选择
Strategy s = strategyMap.get(order.getType());
```

### State

**意图**：让对象在不同生命周期阶段展示不同行为。Context 的行为随当前 State 而变化。

**切换来源**：可以由 State 自身触发，可以由 Context 触发，也可以由外部事件触发。"内部切换"只是一个典型实现方式，不是定义。

```java
// 状态自己触发切换
class PaidState implements OrderState {
    void handle(OrderContext ctx) {
        // 支付完成后…
        ctx.setState(new ShippedState());
    }
}

// 也可以由外部触发
order.ship();  // Context 内部切换到 ShippedState
```

### 区分标准

关键不在于"谁切换"，而在于**读代码时你想到的是什么问题**：
- "这里有多种算法/政策需要动态选择" → 更接近 Strategy
- "这个对象在不同状态下行为完全不同" → 更接近 State

同一个结构，上下文不同，可能就是不同的模式。不需要强迫二选一。

---

## 三、Factory 的三种层次

### 简单工厂（Simple Factory）

一个类集中管理创建逻辑，根据参数返回不同类型的对象。

```java
class ConnectionFactory {
    static Connection create(String type) {
        switch (type) {
            case "mysql":  return new MySQLConnection();
            case "redis":  return new RedisConnection();
            default: throw new IllegalArgumentException();
        }
    }
}
```

**代价**：新增类型时通常需要修改工厂的 switch/if-else。不能简单宣称"符合开闭原则"——它只是把创建逻辑从调用方移到了工厂，变化点仍然存在。

### 工厂方法（Factory Method）

把"创建什么对象"的决定延迟到子类。

```java
abstract class Dialog {
    abstract Button createButton();  // 工厂方法
    void render() {
        Button btn = createButton();
        btn.paint();
    }
}

class WindowsDialog extends Dialog {
    Button createButton() { return new WindowsButton(); }
}
```

**核心**：父类定义流程，子类决定具体产品。在产品创建这一变化轴上更有利于遵循开闭原则：新增产品通常通过新增 Product 和 Creator 子类完成；但客户端如何选择和装配具体工厂，仍可能需要调整。

### 抽象工厂（Abstract Factory）

创建**一组**相关对象，而不指定具体类。

```java
interface WidgetFactory {
    Button createButton();
    ScrollBar createScrollBar();
}
// WindowsWidgetFactory、MacWidgetFactory 各自实现一组控件
```

**代价**：新增产品种类（比如增加 "Checkbox"）需要修改所有工厂实现。

### 辨别的捷径

- 创建逻辑通过 switch/if-else 集中管理 → 简单工厂
- 父类调用抽象方法，子类决定产品 → 工厂方法
- 一组工厂接口，每个实现负责一族产品 → 抽象工厂

在 Spring 中，`BeanFactory` 更像一个超级工厂容器，融合了多种创建模式，不适合贴单一标签。

---

## 四、流式 API 与 Builder 模式

基础篇中用了 `Order.builder()` 的写法。这里需要区分：Lombok `@Builder` 主要解决调用可读性和样板代码；经典 Builder 更强调将复杂对象的构建过程与最终表示分离，并允许分步骤构造、校验约束或生成不同表示。两者在意图上有交集但不等同。

判断是否真正需要 Builder，不只看参数数量，还要看构建过程是否复杂、是否存在可选步骤以及对象是否需要保证不变量。

---

## 五、Proxy 与 Decorator

### 从意图区分

**Proxy**：控制对目标对象的访问。关注的是"能不能访问、怎么访问"——安全校验、事务管理、远程调用、延迟加载、缓存。

**Decorator**：动态给目标对象增加职责。关注的是"让对象能做更多事"——缓冲、压缩、加密、日志格式化。

### 框架案例

**Spring AOP → Proxy**

Spring AOP 通过 JDK 动态代理或 CGLIB 生成代理对象，在方法调用前后织入切面逻辑。核心模式是 Proxy + Advisor/Pointcut 选择机制 + MethodInterceptor 调用链。

Spring 事件机制（`@EventListener`、`ApplicationEvent`）属于 Observer 范畴，不是 AOP 的组成部分。所以"Spring AOP = Proxy + Observer + CoR"是过度贴标签。

**JDK I/O → Decorator**

```java
InputStream input = new BufferedInputStream(
    new GZIPInputStream(
        new FileInputStream("data.txt")
    )
);
```

每一层保持 `InputStream` 接口，动态叠加缓冲和压缩功能。这是 Decorator 的教科案例。

### 不要把"层数"当区分标准

代理也可以多级（多层 AOP 拦截器、多层远程代理）。装饰器也可以单层。核心区分标准是**意图：控制访问 vs 增加职责**。

---

## 六、Template Method 与 Callback

### 继承式模板方法

父类定义算法骨架，子类覆盖原语操作（primitive operations）。

```java
abstract class BaseExecutor {
    final void execute() {
        before();     // 公共
        doExecute();  // 子类实现
        after();      // 公共
    }
    protected abstract void doExecute();
}
```

**代价**：继承耦合。父类修改影响所有子类，容易形成脆弱基类。

### 模板流程 + 回调

框架控制整体流程，调用方注入回调或策略。不依赖继承。

```java
// Spring JdbcTemplate
jdbcTemplate.query("SELECT * FROM user", (rs, rowNum) ->
    new User(rs.getLong("id"), rs.getString("name"))
);
```

`JdbcTemplate` 使用的是**模板流程加回调**，不是要求用户继承 `JdbcTemplate` 然后重写某些步骤。它体现了"固定流程、开放局部行为"的思想，但实现手段是回调而非传统继承。

### MyBatis BaseExecutor

```java
// BaseExecutor 定义了执行骨架
// SimpleExecutor、BatchExecutor、ReuseExecutor 继承并实现差异
```

这是继承式模板方法的框架案例。`BaseExecutor` 统一处理一级缓存、查询栈、延迟加载、提交回滚等公共流程，并将 `doQuery()`、`doUpdate()`、`doFlushStatements()` 等具体执行步骤留给 `SimpleExecutor`、`ReuseExecutor` 和 `BatchExecutor` 实现。

```text
// MyBatis Executor 模板方法调用链
BaseExecutor#query
  → 查询一级缓存
  → queryFromDatabase
  → doQuery (抽象，子类实现)
```

---

## 七、Observer、Event Bus 与消息队列

基础篇把 Observer 描述为"解耦发布者和订阅者"。进阶篇需要把它和其他类似机制区分开。

| | Observer | Event Bus | Spring Event | 消息队列 |
|---|---|---|---|---|
| 范围 | 通常进程内 | 通常进程内 | 默认进程内 | 通常跨进程或跨服务 |
| 同步/异步 | 取决于实现 | 均可 | 默认同步，可配置异步 | 通常异步 |
| 持久化 | 通常无 | 通常无 | 默认无 | 取决于产品和配置 |
| 重试 | 通常自行实现 | 通常自行实现 | 通常自行实现或扩展 | 通常提供重试或失败处理机制 |
| 顺序 | 取决于实现 | 取决于实现 | 可配置监听顺序 | 通常仅在特定队列、分区或消息组内保证 |
| 主要目标 | 对象间通知 | 进程内事件分发 | Spring 容器内事件 | 可靠的跨系统消息传递 |

Observer 的价值不在于"替换 for 循环"——它的底层通知仍然可能通过遍历完成。它的价值在于**发布者不需要知道具体订阅者是谁、有几个**，新增订阅方不需要修改发布代码。

Spring Event 默认同步执行，可通过 `@Async` + `@EnableAsync` 并配置线程池实现异步，但需要注意异步场景下的异常处理和上下文传递。

---

## 八、责任链、Filter Chain 与 Pipeline

这三种结构在代码上都是"一串处理器依次执行"，但执行协议不同。

### 经典责任链

请求沿处理器链传递。某个处理器可以**消费请求并终止链条**。

```java
// 经典 CoR：日志级别过滤
// DebugHandler → InfoHandler → ErrorHandler
// Debug 级别的日志被 DebugHandler 处理后就终止，不会传到 ErrorHandler
```

### Filter/Interceptor Chain

每个节点执行前置逻辑，通过显式调用 `next()` 控制后续链路的传播（通常还会执行后置逻辑）。

```java
// Servlet Filter
void doFilter(request, response, chain) {
    // 前置逻辑
    chain.doFilter(request, response);  // 传给下一个
    // 后置逻辑
}
```

Spring `HandlerInterceptor` 的 `preHandle` / `postHandle` 也体现这种模式。

### Pipeline（管道）

数据依次经过多个处理阶段，每个阶段通常承担转换、校验、编码或协议处理。

```java
// Netty ChannelPipeline
pipeline.addLast("codec", new HttpServerCodec());
pipeline.addLast("aggregator", new HttpObjectAggregator(65536));
pipeline.addLast("handler", new BusinessHandler());
// 数据依次经过 codec → aggregator → handler
```

### MyBatis InterceptorChain

MyBatis 的 `InterceptorChain.pluginAll()` 不完全是经典责任链。它更接近**插件包装 + Proxy/Decorator 的组合**——每个插件通过动态代理包装目标对象，层层嵌套后形成调用链。

---

## 九、Composite 与递归

> **我的理解变化**：我以前一直把"组合模式"理解成把多个对象装到一个对象里。后来才意识到，这只是普通的对象组合（`Car` 持有 `Engine`、`OrderService` 持有 `PaymentService`）。GoF 的 Composite Pattern 的特殊之处在于：单个对象和由多个对象组成的整体，共享同一种抽象。组合对象内部持有的仍然是这种抽象，因此组合完成后，整体仍然可以被当成一个普通对象使用。树并不是 Composite 的定义，而是这种递归组合结构自然形成的结果。

### 普通对象组合 ≠ Composite

```java
// 普通组合：对象之间的包含和协作，不共享同一个抽象
class Car {
    private Engine engine;
    private List<Wheel> wheels;
}
// Car、Engine、Wheel 不需要实现同一个接口
```

```java
// Composite：叶子对象和组合对象共享同一个抽象
interface FileSystemNode { long size(); }

class FileNode implements FileSystemNode { ... }      // 叶子
class DirectoryNode implements FileSystemNode {       // 组合
    private List<FileSystemNode> children;            // 内部持有的仍是 FileSystemNode
}
```

关键区别：`FileNode` 是 `FileSystemNode`，`DirectoryNode` 也是 `FileSystemNode`，`DirectoryNode` 内部持有的仍然是 `FileSystemNode`——组合后的整体可以继续被当成一个 `FileSystemNode` 使用。

### "组合优于继承"与 Composite

容易混淆的另一个概念是"组合优于继承"原则中的"组合"：

```java
// "组合优于继承"中的组合：通过持有对象复用行为
class Car {
    private Engine engine;  // 复用 Engine 的能力，降低继承耦合
}
```

这是一般面向对象设计原则——通过持有对象来复用行为、降低继承耦合、支持运行时替换协作者。而 Composite Pattern 的特殊点在于：**自己和子节点属于相同抽象，整体可以继续作为一个同类型对象使用**。二者有关联，但不是同一个概念。

**Composite 没有消灭递归。** 它把递归封装到组合对象的内部方法中，让客户端不再需要写类型判断和递归代码。

```java
// 不使用 Composite：递归散落在各处
int getTotalSize(Node node) {
    if (node instanceof FileNode) return node.getSize();
    int total = 0;
    for (Node child : ((FolderNode) node).getChildren()) {
        total += getTotalSize(child);
    }
    return total;
}

// 使用 Composite：递归封装在组合对象内部
class FolderNode implements TreeNode {
    int getSize() {
        return children.stream().mapToInt(TreeNode::getSize).sum();
    }
}
```

**代价**：统一的接口可能迫使叶子节点实现无意义的方法（如 `addChild`、`removeChild`）。不是所有树结构都适合 Composite——如果"叶子"和"容器"的行为差异巨大，强行统一接口反而更别扭。

---

## 十、Bridge：把两个变化维度拆开

> 我还记得一种结构：一个类通过继承扩展上层行为，但它的具体能力却不是自己实现的，而是交给内部的另一个对象完成。这到底是什么？

这种结构首先是一种 **Delegation（委托）**——把工作交给另一个对象。如果它的目的在于**把两个可以独立变化的维度分离开**，通常就是 Bridge Pattern。

### 先理解 Delegation

Delegation 是一种通用实现手段，不一定是完整的设计模式：

```java
class UserService {
    private final UserRepository repository;

    UserService(UserRepository repository) { this.repository = repository; }

    public User findUser(long id) {
        return repository.findById(id);  // 把查询工作委托给 Repository
    }
}
```

`UserService` 没有自己完成数据查询，而是交给 `UserRepository`。这叫委托。单纯使用另一个对象完成任务，并不自动构成 Bridge。

> 委托描述的是"谁替我完成工作"，而设计模式还需要回答"为什么要这样组织结构"。

### 什么情况下需要 Bridge

当系统中存在两个独立变化维度时。例如：

- **维度一，消息类型**：普通消息、紧急消息、加急消息
- **维度二，发送方式**：短信、邮件、App 推送

如果全部通过继承穷举，每增加一个消息类型或发送方式，子类数量都会乘法增长（3×3 = 9 个类）。Bridge 把两个维度拆开：

```java
// 实现维度：发送方式
interface MessageSender {
    void send(String content);
}

final class SmsSender implements MessageSender {
    @Override
    public void send(String content) { System.out.println("短信：" + content); }
}

final class EmailSender implements MessageSender {
    @Override
    public void send(String content) { System.out.println("邮件：" + content); }
}
```

```java
// 抽象维度：消息类型
abstract class Message {
    protected final MessageSender sender;

    protected Message(MessageSender sender) { this.sender = sender; }

    public abstract void send(String content);
}

final class NormalMessage extends Message {
    NormalMessage(MessageSender sender) { super(sender); }

    @Override
    public void send(String content) { sender.send(content); }
}

final class UrgentMessage extends Message {
    UrgentMessage(MessageSender sender) { super(sender); }

    @Override
    public void send(String content) { sender.send("[紧急] " + content); }
}
```

使用：

```java
Message msg1 = new UrgentMessage(new SmsSender());
Message msg2 = new UrgentMessage(new EmailSender());
msg1.send("服务异常");
msg2.send("服务异常");
```

关键结构：

- `Message` 是抽象维度，`MessageSender` 是实现维度
- 增加消息类型不需要修改 Sender，增加发送渠道不需要修改 Message
- 两者通过组合连接，可以分别扩展、自由组合
- 上层通过继承扩展，底层能力通过委托交给实现对象

### 什么不是 Bridge

```java
class OrderService extends BaseService {
    private OrderRepository repository;
}
```

这只是普通继承加依赖注入，并不必然是 Bridge。满足以下特征才更接近 Bridge：

1. 系统中存在两个相对独立的变化维度
2. 如果都使用继承，会出现类数量乘法增长
3. 抽象层持有实现层接口
4. 抽象层把具体能力委托给实现对象
5. 两个维度能够分别扩展和组合

**一句话总结**：Bridge 使用组合和委托，把两个可以独立变化的继承维度拆开，使它们能够分别扩展、自由组合。

---

## 十一、六种相关模式对比

以下模式在代码上都可能表现为"对象内部持有另一个对象，调用时将部分工作转发"，但意图和结构不同。

| 模式 | 自己与内部对象是否同抽象 | 主要目的 | 关键判断 |
|---|---|---|---|
| Composite | 是，叶子和组合共享 Component | 统一处理单个对象和对象整体 | 组合后仍然是同一种 Component |
| Decorator | 是，装饰器和被装饰对象共享接口 | 动态增加职责 | 同类型包装并增强 |
| Proxy | 是，代理和目标通常共享接口 | 控制或间接管理访问 | 同类型包装并控制访问 |
| Adapter | 通常不是 | 转换不兼容接口 | 对外是目标接口，对内调用旧接口 |
| Bridge | 通常不是，两边属于两个抽象体系 | 分离两个独立变化维度 | 抽象层委托给实现层 |
| Delegation | 不要求 | 把工作交给另一个对象 | 是通用手段，不一定构成模式 |

### 逐项说明

**Composite**：

```java
class Directory implements Node {
    private List<Node> children;
}
```

自己就是 `Node`，内部持有多个 `Node`，多个节点组合后仍然是一个节点。

**Decorator**：

```java
class BufferedInputStream extends InputStream {
    private InputStream delegate;
}
```

自己也是 `InputStream`，内部持有另一个 `InputStream`，对原对象增加缓冲职责。

**Proxy**：

```java
class UserServiceProxy implements UserService {
    private UserService target;
}
```

自己和目标使用同一接口，对调用进行事务、安全、远程访问或延迟加载控制。

**Adapter**：

```java
class LegacyPaymentAdapter implements Payment {
    private LegacyPay legacyPay;
}
```

对外实现调用方需要的 `Payment`，内部调用接口不兼容的 `LegacyPay`，重点是接口转换。

**Bridge**：

```java
abstract class Message {
    protected MessageSender sender;  // 两个维度不是同一个接口
}
```

`Message` 和 `MessageSender` 分别代表两个变化维度，通过组合连接。

**Delegation**：

```java
class UserService {
    private UserRepository repository;
}
```

只是把具体工作交给另一个对象，不一定构成特定的设计模式。

### 快速判断口诀

> 快速阅读代码时，可以先用下面的口诀形成初步判断，再结合模式意图确认：

```text
多个对象组合后，整体仍然是同类型对象
→ Composite

同类型包装，并增加职责
→ Decorator

同类型包装，并控制访问
→ Proxy

把旧接口转换成调用方需要的接口
→ Adapter

两个变化维度需要分别扩展
→ Bridge

只是把具体工作交给另一个对象
→ Delegation
```

---

## 十二、Singleton、Spring Scope 与全局状态

### GoF Singleton

- 类自身控制实例数量（通常为一个）。
- 提供全局访问入口。
- 构造器私有，通过静态方法获取实例。

### Spring singleton scope

- 每个 ApplicationContext / BeanFactory 中，**每个 Bean 定义一个共享实例**。
- 同一个类的不同 Bean 定义可以有多个实例。
- 不同容器也可以拥有同一个类的不同实例。

所以不能简单说"Spring Bean = Singleton 模式"。Spring 管理的是 Bean 的生命周期和作用域，singleton 只是默认的 scope 选项之一。

### Singleton 的副作用

无论是 GoF Singleton 还是 Spring singleton Scope 的 Bean，都需要注意：

- **全局可变状态**：如果 singleton 持有可变状态，所有调用方共享它，容易出现数据竞争。
- **隐式依赖**：调用方不显式声明依赖，让代码的依赖关系不可见。
- **测试困难**：全局单例让单元测试难以隔离——测试 A 时可能被测试 B 修改的状态影响。
- **生命周期耦合**：单例的生命周期与应用绑定，不灵活。

Spring 的依赖注入在很大程度缓解了隐式依赖问题（依赖在构造函数或 setter 中显式声明），但没有消除全局可变状态的风险。

---

## 十三、一个框架结构为什么可能包含多个模式

设计模式不是互斥标签。一个框架模块常常同时包含多种设计思想。正确做法是**区分主要意图和辅助结构**，而不是强行给每个类贴标签。

### Spring AOP

```
主要结构：Proxy
  + Advisor/Pointcut（切面选择机制）
  + MethodInterceptor Chain（拦截器调用链）
```

不要写成"AOP = Proxy + CoR + Observer"。Observer 属于 Spring 事件系统，不是 AOP 的必需组成部分。Self-invocation（类内部方法调用不走代理）是常见的 AOP 边界，使用时需要注意。

### Spring MVC

- `DispatcherServlet`：前端控制器，统一请求分发。
- `HandlerMapping`：根据请求查找对应的 Handler。
- `HandlerAdapter`：**较清晰的 Adapter 案例**——不同类型的 Handler（Controller、HttpRequestHandler、Servlet）通过 HandlerAdapter 统一调用。
- `ViewResolver`：根据视图名查找具体视图实现。

```text
// Spring MVC 关键调用链
DispatcherServlet#doDispatch
  → getHandlerAdapter(handler)
  → HandlerAdapter#handle
```

### MyBatis

- `BaseExecutor`：**Template Method**——定义 Executor 层公共执行与缓存控制骨架，子类（SimpleExecutor、BatchExecutor）实现差异。
- Cache 包装结构：**Decorator**——`LruCache(new LoggingCache(new PerpetualCache("id")))`，层层叠加功能。注意 `PerpetualCache` 需要传入 id，`FifoCache`（不是 `FIFOcache`）也是合法装饰器。
- Mapper 代理：**Proxy**——`MapperProxy` 拦截接口方法调用，转为 SQL 执行。
- 插件机制：插件通过动态代理层层包装目标对象，更接近 Proxy/Decorator 的组合，不是经典责任链。

```text
// MyBatis 插件包装调用链
InterceptorChain#pluginAll
  → interceptor.plugin(target)
  → 多层动态代理包装
```

### Netty

- `ChannelPipeline`：**Pipeline / Intercepting Filter**——入站和出站事件分别沿相反方向经过匹配的 Inbound/Outbound Handler，并非每个事件都会经过 Pipeline 中的所有 Handler。
- Handler 链：每个 Handler 处理特定协议层（编解码、业务逻辑）。

```text
// Inbound：数据从网络进入，沿 Inbound Handler 向前传播
ChannelHandlerContext.fireChannelRead(msg)
  → 下一个 Inbound Handler

// Outbound：业务写出数据，沿 Outbound Handler 反向传播
ChannelHandlerContext.write(msg)
  → 前一个 Outbound Handler
  → ... → HeadContext → 底层 I/O
```

要用 `HttpServerCodec` 或 `HttpRequestDecoder`，而不是不存在的 `new HttpDecoder()`。

---

## 总结

基础篇从控制流出发帮你建立直觉：if 分支膨胀了可以看看 Strategy，散落的 new 可以看看 Factory，重复的前置后置逻辑可以看看 Proxy。

进阶篇补充了更关键的判断：Strategy 和 State 的代码可以一模一样，差别在于你读代码时想到的是什么问题；Proxy 和 Decorator 的区别不是"层数"而是意图。框架模块经常组合多个模式，分析源码时应区分主要设计意图与辅助实现机制，而不是强行给每个类贴唯一标签——有些类的模式归属非常清晰（比如 `HandlerAdapter` 就是明确的适配边界），但更多时候需要具体分析。

---

如果你需要入门视角，可以回看：[设计模式入门：从 if、for 和 new 开始理解常见模式](#/article/content%2Fcolumns%2Fdesign-patterns-essence.md)

---

*创建时间：2026-07-10*
