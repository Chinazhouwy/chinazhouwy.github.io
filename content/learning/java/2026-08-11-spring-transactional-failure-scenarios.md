---
title: "Spring @Transactional 失效的 7 个场景：从代理到事务边界"
date: "2026-08-11"
domain: "学习"
area: "Java 后端"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "从 Spring AOP 代理、异常回滚规则、线程绑定和事务传播四个角度，系统排查 @Transactional 不生效与 UnexpectedRollbackException。"
tags:
  - Java
  - Spring
  - Spring Boot
  - 事务
  - AOP
  - @Transactional
source: "微信公众号「程序员代码随笔」"
source_url: "https://mp.weixin.qq.com/s/MA5CQgET-1pGWJyXqAifbA"
published_at: "2026-08-11 12:28:56 +08:00"
---

# Spring `@Transactional` 失效的 7 个场景：从代理到事务边界

> 原文标题：Spring @Transactional 失效的 7 个场景：自调用、代理、异常被吞，你中了几个？
>
> 来源：微信公众号「程序员代码随笔」
>
> 环境：JDK 21、Spring Boot 3.2.7、H2 内存库、`spring-boot-starter-jdbc`
>
> 发布时间：2026-08-11 12:28（北京时间）
>
> 原文链接：<https://mp.weixin.qq.com/s/MA5CQgET-1pGWJyXqAifbA>

## 一、先记住一条总原则

Spring 的声明式事务在默认 proxy 模式下依赖 AOP 代理。外部调用 Bean 时，调用路径大致是：

```text
调用方
  ↓
Spring 代理：开启/加入事务
  ↓
目标方法
  ↓
正常返回 → 提交
抛出符合规则的异常 → 回滚
```

排查“明明加了 `@Transactional` 却没回滚”，优先检查四个问题：

1. 调用有没有真正经过 Spring 代理；
2. 异常有没有从事务方法边界抛出去；
3. 异常类型是否命中回滚规则；
4. 数据库操作是否发生在同一个线程、同一个事务连接中。

这四项分别对应代理边界、异常边界、回滚规则和线程边界。

## 二、7 个典型失效场景

### 场景 1：同类自调用绕过代理

```java
public void createOrder(String orderNo) {
    this.saveOrder(orderNo); // 直接调用目标对象，不经过代理
    throw new RuntimeException("创建失败");
}

@Transactional
public void saveOrder(String orderNo) {
    orderStore.insert(orderNo);
}
```

如果外层方法没有事务，`this.saveOrder(...)` 不会触发 `@Transactional`。`saveOrder` 中的写入可能以无事务/自动提交方式落库，外层随后抛异常也没有事务可以回滚。

**修复方式：**

- 最优先：把 `@Transactional` 放在真正的对外入口方法上；
- 将内层事务方法拆到另一个 Spring Bean，通过 Bean 引用调用；
- 复杂场景使用 `TransactionTemplate` 明确划分事务；
- 需要织入式语义时考虑 AspectJ，但不要为了绕过一个简单的自调用问题就盲目引入。

不要把 `this` 改成“注入自身代理”当成默认方案：它会增加循环依赖、初始化和可读性问题。

### 场景 2：`private` 方法上的注解不生效

```java
@Transactional
private void saveOrder(String orderNo) {
    orderStore.insert(orderNo);
}
```

在 proxy 模式下，`private` 方法无法被代理覆盖或拦截，因此注解只是元数据，不会自动开启事务。即便把调用改成同类内部调用，也仍然绕不开这个限制。

**修复方式：** 把事务边界放到由 Spring 管理、能够经代理进入的入口方法上，通常是一个 `public` Service 方法。

### 场景 3：`try-catch` 把异常吞掉

```java
@Transactional
public void createOrder(String orderNo) {
    orderStore.insert(orderNo);
    try {
        callSomething();
    } catch (RuntimeException ex) {
        log.warn("调用失败", ex);
        // 没有重新抛出，也没有标记 rollback-only
    }
}
```

事务拦截器看到方法正常返回，就会按正常路径提交。日志里出现异常，不代表事务管理器知道应该回滚。

**修复方式：**

```java
@Transactional
public void createOrder(String orderNo) {
    orderStore.insert(orderNo);
    try {
        callSomething();
    } catch (RuntimeException ex) {
        log.warn("调用失败", ex);
        throw ex; // 让异常越过事务方法边界
    }
}
```

如果业务上必须捕获并继续返回，则要明确决定是否调用：

```java
TransactionAspectSupport.currentTransactionStatus()
    .setRollbackOnly();
```

不过，主动标记后再正常返回，调用方可能只看到“方法返回成功”，而提交阶段才发现事务已被标记回滚；更好的做法是让返回值、异常和回滚语义保持一致。

### 场景 4：检查异常默认不触发回滚

```java
@Transactional
public void createOrder(String orderNo) throws IOException {
    orderStore.insert(orderNo);
    throw new IOException("远程调用失败");
}
```

Spring 默认对 `RuntimeException` 和 `Error` 回滚，对检查异常通常不回滚。`IOException`、自定义 checked exception 等如果没有额外配置，方法虽然异常结束，事务仍可能提交。

需要检查异常触发回滚时，显式声明规则：

```java
@Transactional(rollbackFor = IOException.class)
public void createOrder(String orderNo) throws IOException {
    orderStore.insert(orderNo);
    throw new IOException("远程调用失败");
}
```

`rollbackFor = Exception.class` 可以作为粗粒度策略，但生产代码更适合根据业务语义精确指定。回滚规则应表达“哪些失败意味着本次写入不可接受”，而不是机械地把所有异常都当成同一种失败。

### 场景 5：直接 `new` 出来的对象不是 Spring Bean

```java
OrderService service = new OrderService(orderStore);
service.createOrder(); // 没有 Spring 代理
```

`@Transactional` 不是 Java 语言本身的运行时魔法。Spring 只有在创建并管理 Bean 时，才会为它配置事务拦截器或代理。直接 `new` 的对象没有事务代理，注解不会执行。

类似问题还包括：

- 手工创建的 Service、Repository 或事务管理器；
- 调用了错误的 Bean 实例，而不是容器中的 Bean；
- `static` 方法；
- 类代理下无法覆盖的 `final` 方法或 `final` 类。

**修复方式：** 把对象交给 Spring 管理，通过构造器注入使用，并确认实际调用的是容器 Bean。

### 场景 6：子线程不会自动继承当前事务

```java
@Transactional
public void createOrder(String orderNo) throws InterruptedException {
    Thread t = new Thread(() -> orderStore.insert(orderNo));
    t.start();
    t.join();
    throw new RuntimeException("主线程失败");
}
```

Spring 事务资源通过线程绑定机制关联到当前线程。主线程开启的事务不会自动传播到新建线程、线程池任务或异步执行器中。子线程通常会获得自己的数据库连接；如果没有显式开启新事务，写入可能直接自动提交，主线程回滚无法撤销它。

`join()` 只负责等待线程结束，不会把事务上下文复制给子线程。

**修复方式：**

- 需要原子性的数据库写入放在同一个事务线程中；
- 异步通知、消息投递、对账等操作设计为独立流程；
- 需要“提交后再异步”的场景，使用 `@TransactionalEventListener(phase = AFTER_COMMIT)` 或可靠消息/Outbox；
- 不要把 `ThreadLocal` 上下文复制工具误当成数据库事务传播机制。

异步任务即使能读到部分业务上下文，也不等于能安全复用主线程的数据库事务连接。

### 场景 7：内层 `REQUIRED` 失败后，外层无法继续提交

默认传播级别是 `REQUIRED`。外层和内层加入同一个物理事务：

```java
@Transactional
public void outer() {
    orderStore.insert("outer");
    try {
        innerService.inner();
    } catch (RuntimeException ex) {
        log.warn("忽略内层失败", ex);
    }
}

@Transactional // 默认 REQUIRED，加入 outer 的事务
public void inner() {
    orderStore.insert("inner");
    throw new RuntimeException("inner failed");
}
```

内层异常触发回滚规则后，共享事务会被标记为 `rollback-only`。外层虽然 catch 住了异常并正常返回，事务管理器在提交阶段仍会发现它不能提交，通常抛出：

```text
UnexpectedRollbackException:
Transaction rolled back because it has been marked as rollback-only
```

如果内层失败确实不应影响外层，可以使用：

```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void inner() {
    // 挂起外层事务，开启独立事务
}
```

但 `REQUIRES_NEW` 不是“嵌套回滚”的万能按钮：

- 内层失败只回滚自己，外层仍可提交；
- 内层成功提交后，外层失败也不会撤销内层提交；
- 外层挂起期间会占用连接，内层还要申请新连接，连接池过小可能造成等待甚至死锁；
- 两个事务之间的一致性要靠业务补偿、重试或对账设计。

## 三、事务传播的关键区别

| 传播级别 | 行为 | 典型用途 |
|---|---|---|
| `REQUIRED` | 有事务就加入，没有就新建 | 默认业务事务边界 |
| `REQUIRES_NEW` | 挂起外层，始终新建独立事务 | 独立审计、失败记录、补偿记录 |
| `NESTED` | 同一物理事务内使用保存点，需底层支持 | 局部回滚但最终仍受外层提交影响 |
| `SUPPORTS` | 有事务就加入，没有就非事务执行 | 读操作或可选事务场景 |
| `NOT_SUPPORTED` | 挂起当前事务，以非事务方式执行 | 明确不希望占用外层事务的操作 |

“内层事务”不一定意味着新事务。默认 `REQUIRED` 往往只是加入外层事务；只有传播配置和事务管理器能力满足条件时，才会产生独立边界。

## 四、原文结论中的勘误与补充

### 1. “所有非 public 方法都不支持”需要结合 Spring 版本和代理类型

`private` 方法不能被 Spring proxy 模式拦截，这一点没有问题。

但 Spring Framework 6.0 起，**基于类的代理**默认也可以让 `protected` 或包可见方法参与事务；**基于接口的 JDK 代理**则仍要求事务方法是 `public` 且定义在被代理接口中。是否可拦截还取决于代理策略、方法所在类以及调用是否经过代理。

因此更准确的表述是：

```text
private：不能被代理拦截
protected / 包可见：Spring 6+ 的类代理可支持，JDK 代理不支持
public：最稳妥，但仍必须从代理外部调用
final / static：在对应代理模型下通常无法被类代理覆盖
```

官方说明：<https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html>

### 2. “Spring Boot 3.x 默认 CGLIB”不是排查时的充分条件

实际代理类型由 Spring 配置、Bean 是否实现接口以及 `proxyTargetClass` 等因素共同决定。排查问题时，不要只凭版本推断代理类型，应该观察运行时 Bean：

```java
log.info("bean class = {}", applicationContext
    .getBean(OrderService.class)
    .getClass());
```

无论是 JDK 代理还是类代理，默认 proxy 模式都有一个共同限制：**只有从代理外部进入的调用才会触发拦截，自调用不会触发事务。**

### 3. “检查异常代表应该提交”只是默认规则，不是业务真理

Spring 默认不因检查异常回滚，主要是框架的历史默认策略，不代表所有检查异常都表示“业务处理成功”。是否回滚应由事务边界的业务语义决定，并通过 `rollbackFor` / `noRollbackFor` 明确表达。

### 4. 事务回滚只回滚数据库事务内的资源

事务不能自动撤销已经发送的 HTTP 请求、短信、邮件、文件写入或外部消息副作用。数据库写入与外部系统调用混在一个方法里时，应考虑：

- Outbox + 消费者；
- 事务事件监听器；
- 幂等键和补偿任务；
- 状态机与对账；
- 必要时使用适合场景的分布式事务方案。

## 五、生产排查清单

遇到“事务没有回滚”时，按顺序检查：

1. **Bean 来源**：对象是否来自 Spring 容器，是否有直接 `new`；
2. **代理类型**：运行时 Bean 是 JDK Proxy、CGLIB 还是原始对象；
3. **调用路径**：调用是否来自其他 Bean/外部入口，是否存在 `this.xxx()`；
4. **方法可见性**：是否为 `private`、`static`、`final`，接口代理是否声明了该方法；
5. **事务管理器**：是否配置了正确的 `PlatformTransactionManager`，数据源和 Repository 是否使用同一事务管理器；
6. **异常出口**：异常是否被 catch、包装、转换或异步化，是否真正离开事务方法；
7. **回滚规则**：检查异常是否配置 `rollbackFor`，是否配置了 `noRollbackFor`；
8. **线程边界**：数据库操作是否发生在异步任务、线程池或消息消费者中；
9. **事务传播**：内层是否加入外层，是否因 `rollback-only` 触发 `UnexpectedRollbackException`；
10. **数据库事实**：确认实际使用的存储引擎支持事务，并检查隔离级别、自动提交和连接配置；
11. **测试干扰**：测试方法自身的 `@Transactional`、测试回滚和清理逻辑是否掩盖了真实行为；
12. **日志验证**：临时开启事务、数据源连接和 SQL 日志，确认事务 begin、commit、rollback 的真实顺序。

## 六、推荐的事务边界

事务方法尽量围绕一个清晰的业务操作设置边界：

```java
@Service
public class OrderApplicationService {

    @Transactional(rollbackFor = OrderCreationException.class)
    public void createOrder(CreateOrderCommand command) {
        orderRepository.insert(command.toOrder());
        inventoryRepository.reserve(command.items());
        // 同一事务内完成必须原子提交的数据库写入
    }
}
```

以下操作通常不宜长时间放在数据库事务里：

- 慢速外部 HTTP/RPC；
- 文件上传；
- 等待用户或其他线程；
- 不受本地事务控制的消息、邮件和短信发送。

可以先在事务内写入“待处理”状态或 Outbox 记录，事务提交后再由独立 Worker 处理外部副作用。

## 七、复习速记

```text
自调用：绕过代理，注解不生效
直接 new：没有 Spring 代理
private：不能被 proxy 模式拦截
protected/包可见：Spring 6+ 类代理可支持，JDK 代理仍要求 public
异常被吞：方法正常返回，事务提交
checked exception：默认不回滚，按业务配置 rollbackFor
子线程：不自动继承当前事务
REQUIRED：默认加入外层，共享 rollback-only
REQUIRES_NEW：挂起外层，独立提交/回滚
事务回滚：只能撤销事务管理范围内的资源
```
