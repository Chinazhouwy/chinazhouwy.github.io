---
title: "CompletableFuture 进阶：组合、超时与线程池避坑"
date: "2026-07-05"
domain: "学习"
area: "Java 后端"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "围绕 CompletableFuture 的线程池污染、异步链执行、超时、allOf 结果聚合和异常传播，整理生产环境中最常见的使用陷阱与修正方式。"
tags:
  - Java
  - 并发
  - CompletableFuture
  - 线程池
  - 异步编程
source: "微信公众号「码农程序员」"
source_url: "https://mp.weixin.qq.com/s/Vvqchp7cma5XIP9SwQcXBw"
published_at: "2026-07-05 07:10:00 +08:00"
---

# CompletableFuture 进阶：组合、超时与线程池避坑

> 来源：微信公众号「码农程序员」
>
> 发布时间：2026-07-05 07:10（北京时间）
>
> 原文链接：<https://mp.weixin.qq.com/s/Vvqchp7cma5XIP9SwQcXBw>

## 一、核心结论

`CompletableFuture` 不只是把任务丢到后台执行。生产环境真正容易出问题的地方主要集中在：

1. 异步阶段到底在哪个线程中执行；
2. 阻塞 IO 是否污染了公共线程池；
3. 超时后底层任务是否真的停止；
4. 多个 Future 的结果如何聚合；
5. 异常是否被正确记录、降级和传播。

一套可复用的原则是：

```text
IO/耗时操作 → 指定专用线程池 + Async 版本
有依赖关系 → thenCompose
无依赖关系 → thenCombine / allOf
必须有时限 → orTimeout / completeOnTimeout
必须可观测 → handle / whenComplete + 日志告警
```

## 二、非 Async 方法的线程语义

示例：

```java
CompletableFuture
    .supplyAsync(() -> fetchOrder(orderId))
    .thenApply(order -> enrich(order))
    .thenAccept(System.out::println);
```

不指定执行器时，`supplyAsync` 默认使用 `ForkJoinPool.commonPool()`。

而 `thenApply`、`thenAccept` 属于非 `Async` 版本，它们通常会在完成前一阶段的线程中执行；如果前一阶段已经完成，也可能直接在当前调用线程中执行。因此不能简单地认为“所有 then 阶段都固定在某个线程池里”。

如果后续操作是阻塞 IO 或耗时计算，应明确指定异步执行器：

```java
CompletableFuture
    .supplyAsync(() -> fetchOrder(orderId), ioPool)
    .thenApplyAsync(this::enrich, cpuPool)
    .thenAcceptAsync(this::publishResult, ioPool);
```

轻量、纯内存的转换可以使用非 `Async` 版本，避免不必要的线程切换；阻塞或耗时操作则应隔离资源。

## 三、ForkJoinPool 公共线程池污染

无参的 `supplyAsync` 和 `thenApplyAsync` 默认依赖 `ForkJoinPool.commonPool()`。它的并行度通常与 CPU 核数相关，并不是为大量阻塞 IO 设计的。

如果业务代码在公共池中执行以下操作：

- 查询数据库；
- 调用外部 HTTP 服务；
- 写入 Elasticsearch；
- 读写文件；
- 长时间 `sleep`；

少量慢任务就可能占满公共池，使其他 CompletableFuture、并行流或依赖公共池的任务一起排队。

### 推荐做法：业务线程池隔离

```java
private final ExecutorService ioPool = new ThreadPoolExecutor(
    20,
    100,
    60,
    TimeUnit.SECONDS,
    new SynchronousQueue<>(),
    new ThreadFactoryBuilder()
        .setNameFormat("order-async-%d")
        .build(),
    new ThreadPoolExecutor.CallerRunsPolicy()
);

CompletableFuture<Order> future = CompletableFuture.supplyAsync(
    () -> externalOrderService.fetch(orderId),
    ioPool
);
```

线程池不应在各个类中随意 `new` 多份。应该按业务边界统一管理，设置合理的队列容量、拒绝策略、线程命名和监控指标。

### 虚拟线程

JDK 21+ 可以使用虚拟线程执行大量阻塞 IO：

```java
private final ExecutorService virtualThreadPool =
    Executors.newVirtualThreadPerTaskExecutor();

CompletableFuture<Order> future = CompletableFuture.supplyAsync(
    () -> externalOrderService.fetch(orderId),
    virtualThreadPool
);
```

虚拟线程减少了阻塞平台线程的成本，但不会自动改变 CompletableFuture 的默认执行器。后续使用 `thenApplyAsync` 等方法时，仍应显式传入正确的执行器。

## 四、超时控制

### 1. JDK 8：手动构造超时 Future

JDK 8 没有 `orTimeout`，可以使用定时线程池完成一个超时 Future，再与业务 Future 竞争：

```java
ScheduledExecutorService scheduler =
    Executors.newScheduledThreadPool(1);

CompletableFuture<String> timeoutFuture = new CompletableFuture<>();
scheduler.schedule(
    () -> timeoutFuture.completeExceptionally(
        new TimeoutException("timeout")
    ),
    3,
    TimeUnit.SECONDS
);

CompletableFuture<String> result =
    CompletableFuture.anyOf(businessFuture, timeoutFuture)
        .thenApply(value -> (String) value);
```

实际项目还要处理定时任务清理、底层调用取消和异常类型转换。

### 2. JDK 9+：原生 API

快速失败：

```java
CompletableFuture<String> result = CompletableFuture
    .supplyAsync(() -> externalService.call(), ioPool)
    .orTimeout(3, TimeUnit.SECONDS);
```

超时后返回降级值：

```java
CompletableFuture<String> result = CompletableFuture
    .supplyAsync(() -> externalService.call(), ioPool)
    .completeOnTimeout("default", 3, TimeUnit.SECONDS);
```

两者区别：

| 方法 | 超时结果 | 适用场景 |
|---|---|---|
| `orTimeout` | 以 `TimeoutException` 异常完成 | 快速失败、及时告警 |
| `completeOnTimeout` | 以默认值正常完成 | 容忍失败、提供降级 |

### 3. 超时不等于取消底层任务

`orTimeout` 或 `completeOnTimeout` 主要改变 Future 对调用方呈现的结果。底层 HTTP、数据库或 RPC 调用可能仍在执行，因此生产代码还需要：

- 给底层客户端设置真实连接/读取超时；
- 在可行时传播取消信号；
- 避免超时任务继续占满线程池；
- 对重试次数和退避策略设上限。

## 五、任务组合

### 1. `thenCompose`：有依赖关系的串联

第二个任务依赖第一个任务的结果：

```java
CompletableFuture<Order> orderFuture =
    userFuture.thenCompose(user ->
        orderService.queryAsync(user.getId())
    );
```

如果错误地使用 `thenApply`，会得到嵌套类型：

```java
CompletableFuture<CompletableFuture<Order>> nested;
```

`thenCompose` 相当于把嵌套 Future 扁平化。

### 2. `thenCombine`：两个独立任务完成后合并

```java
CompletableFuture<Product> product =
    CompletableFuture.supplyAsync(() -> loadProduct(), ioPool);

CompletableFuture<Comments> comments =
    CompletableFuture.supplyAsync(() -> loadComments(), ioPool);

CompletableFuture<Detail> detail = product.thenCombine(
    comments,
    (p, c) -> new Detail(p, c)
);
```

两个任务可以并行执行，总耗时通常接近较慢的那个任务，而不是二者耗时之和。

### 3. `allOf`：等待全部完成，但不自动聚合结果

```java
CompletableFuture<Void> all = CompletableFuture.allOf(
    future1,
    future2,
    future3
);

all.join();
String a = future1.join();
String b = future2.join();
String c = future3.join();
```

`allOf` 返回 `CompletableFuture<Void>`，不会自动生成结果列表。批量查询时需要自行收集结果，并提前决定失败策略：

| 策略 | 实现思路 | 适用场景 |
|---|---|---|
| 全部成功 | 直接 `allOf`，任一失败整体失败 | 事务性批量操作 |
| 部分失败可接受 | 每个 Future 单独降级，再收集结果 | 批量查询、推荐列表 |
| 收集完整错误 | 记录每个任务的成功/失败状态 | 批量任务报告 |
| 只要最快结果 | `anyOf` 或自定义竞速逻辑 | 多副本查询 |

`anyOf` 只负责返回第一个完成的结果，不会自动取消其他仍在运行的任务，需要业务代码自行处理取消和资源释放。

## 六、异常处理

### 1. `exceptionally`

适合把异常转换成一个降级值：

```java
CompletableFuture<String> result =
    CompletableFuture.supplyAsync(() -> externalApi.call(), ioPool)
        .exceptionally(ex -> {
            log.error("external API failed", ex);
            return "fallback";
        });
```

它会捕获前面阶段的异常，并把链路恢复为正常结果继续向后传递。

### 2. `handle`

同时处理成功结果和异常：

```java
CompletableFuture<String> result =
    CompletableFuture.supplyAsync(() -> externalApi.call(), ioPool)
        .handle((value, ex) -> {
            if (ex != null) {
                log.warn("call failed, use cache", ex);
                return cache.get();
            }
            return value;
        });
```

适合统一做结果转换、降级和指标记录。

### 3. `whenComplete`

类似同步代码中的 `finally`：

```java
future.whenComplete((value, ex) -> {
    metrics.record(ex == null ? "success" : "failure");
});
```

它通常不改变原有结果，也不会吞掉异常，适合日志、埋点和告警。

### 4. 注意异常传播语义

如果上游 Future 以异常完成，后续 `thenApply` 通常不会执行，异常会继续向后传播；只有上游正常返回 `null` 时，后续函数才可能因为对 `null` 调用方法而产生 `NullPointerException`。

因此不要简单地把“异常结果”和“正常返回 null”混为一谈，应在边界处记录异常来源，并为业务结果设计清晰的空值语义。

## 七、组合一个生产级调用链

```java
public CompletableFuture<Order> fetchOrder(String orderId) {
    return CompletableFuture
        .supplyAsync(() -> orderService.get(orderId), ioPool)
        .orTimeout(2, TimeUnit.SECONDS)
        .exceptionally(ex -> {
            log.warn("fetch order failed, use cache, id={}", orderId, ex);
            return cache.get(orderId);
        });
}
```

多路详情接口可以按以下思路设计：

```text
商品、库存、评论、销量
      ↓ 并行查询
thenCombine / allOf
      ↓
统一超时
      ↓
按模块降级
      ↓
结果合成
```

关键不是“异步越多越快”，而是要让并发度、线程池容量、超时和降级策略相互匹配。

## 八、勘误与补充

### 1. `thenApplyToAsync` 的示例需要修正

原文出现了类似下面的写法：

```java
cacheFuture.thenApplyToAsync(remoteFuture, (cached, remote) -> ...)
```

标准 `CompletableFuture` 没有这个签名。两个 Future 的结果合并应使用 `thenCombine`：

```java
cacheFuture.thenCombine(
    remoteFuture,
    (cached, remote) -> cached != null ? cached : remote
);
```

### 2. `orTimeout` 并不是“另起一个独立任务后自动取消原任务”

它改变的是 CompletableFuture 的完成结果，底层调用是否停止取决于实际客户端和业务代码。必须在 HTTP、RPC、数据库客户端层同时配置超时。

### 3. 公共线程池问题的本质是资源隔离

问题不只是“线程数少”，更重要的是不同业务共享同一组有限资源。生产环境应按 IO 类型和业务重要性做线程池隔离，并配合队列、拒绝策略、超时和监控。

## 九、复习要点

```text
thenCompose：有依赖，串联并扁平化
thenCombine：无依赖，两个结果合并
allOf：等全部完成，但要自己收集结果
anyOf：取第一个完成，不会自动取消其他任务
thenApply：可能在前一阶段完成线程中执行
thenApplyAsync：异步执行，但仍要指定正确线程池
orTimeout：超时异常
completeOnTimeout：超时降级值
exceptionally：异常转兜底值
handle：同时拿到结果和异常
whenComplete：埋点清理，不改变结果语义
```
