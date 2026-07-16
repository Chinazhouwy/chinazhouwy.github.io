---
title: "Java 并发 · CompletableFuture 异步编程"
date: "2026-07-03"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "Java 并发 · CompletableFuture 异步编程"
tags:
schema_version: "1"
question_id: "47"
question: "Java 并发 · CompletableFuture 异步编程"
sources:
  - "java/eleme-java-backend-round1.md"
  - "ai-agent/completable-future-production-pitfalls.md"
  - "java/jd-java-backend-round2-jvm-concurrency.md"
score: "3/10"
round: "R1"
next_review: "2026-07-18"
session_id: "unknown"
---

## 第47题 · Java 并发 · CompletableFuture 异步编程

**题目**：CompletableFuture 怎么用？异常处理、超时和线程池隔离怎么做？

### 用户回答

> CompletableFuture 是 Java 8 的，感觉以前接触不多，它是替代 new Thread 这样的概念的吗？

### 评分：3/10

### 扣分点
1. 没回答 API 用法（-3）
2. 异常处理没提（-2）
3. 超时控制没提（-1）
4. 线程池隔离没提（-1）

### 核心纠正
- CompletableFuture 不是替代 new Thread，是替代 Future.get() 阻塞 + 手动编排
- 底层还是用 ExecutorService，只是封装了"提交→等待→组合→异常处理"整套流程

---

## 一、CompletableFuture 是什么

```
new Thread()
  → 太原始，没法拿结果，没法组合
    ↓ 进化
ExecutorService + Callable + Future
  → 能拿结果了，但只能 get() 阻塞等
  → 链式调用？做不了。超时？手动写。合并多个任务？CountDownLatch
    ↓ 进化
CompletableFuture（底层还是用 ExecutorService）
  → 链式调用，不用阻塞
  → 自动编排，不用手动管顺序
  → 超时、异常一行搞定
```

**一句话**：CompletableFuture 不是替代线程池，是替代"你手动管理异步任务"这件事。

---

## 二、核心 API 分类

```java
// === 创建阶段 ===
CompletableFuture.supplyAsync(() -> queryDB(), pool);      // 有返回值
CompletableFuture.runAsync(() -> log("hello"), pool);       // 无返回值
CompletableFuture.completedFuture("已知结果");              // 直接返回
CompletableFuture.failedFuture(exception);                  // 直接返回异常

// === 编排阶段（依赖上一步结果） ===
.thenApply(data -> transform(data))         // 同步转换（类似 Stream.map）
.thenApplyAsync(data -> transform(data), pool) // 异步转换
.thenAccept(data -> save(data))             // 消费结果，无返回值
.thenRun(() -> log("done"))                 // 不关心上一步结果

// === 组合阶段（多个独立任务） ===
.thenCompose(data -> queryDetail(data))     // 扁平化嵌套（类似 flatMap）
.thenCombine(httpFuture, (db, http) -> merge(db, http)) // 两个都完成后合并
.allOf(f1, f2, f3)                          // 全部完成
.anyOf(f1, f2, f3)                          // 任一完成
```

### 图解链式调用

```
supplyAsync(queryDB)
    │
    ├─ thenApply(transform)       → 异步1完成后做转换
    │      │
    │      └─ thenAccept(save)    → 转换完后保存
    │
    └─ thenCombine(httpFuture)    → 等DB和HTTP都回来
           │                        合并结果
           └─ exceptionally(...)  → 任一异常兜底
```

---

## 三、异常处理（5 种方式）

```java
// 方式1：exceptionally — 捕获异常，返回兜底值
supplyAsync(() -> divide(10, 0))
    .exceptionally(ex -> -1)    // 异常时返回 -1
    .thenAccept(result -> log(result));  // -1

// 方式2：handle — 同时处理正常结果和异常
supplyAsync(() -> divide(10, 0))
    .handle((result, ex) -> {
        if (ex != null) return -1;
        return result * 2;
    });

// 方式3：whenComplete — 事后回调，不改变结果（异常继续传播）
supplyAsync(() -> divide(10, 0))
    .whenComplete((result, ex) -> {
        if (ex != null) log.error("计算失败", ex);
    });

// 方式4：exceptionallyCompose — 异常时用备用链路
supplyAsync(() -> callPrimary())
    .exceptionallyCompose(ex -> callFallback())
    .thenApply(this::process);

// 方式5：try-catch（只对 join/get 有效）
try {
    String result = supplyAsync(() -> riskyOp()).join();
} catch (CompletionException e) {
    Throwable real = e.getCause();  // 真正的异常
}
```

### 异常传播规则（重要）

```
1. 异常不会丢失 — 未处理的异常一路传播到最后终结操作
2. exceptionally 只捕获前一步的异常
3. handle 能捕获所有上游异常
4. join() 抛 CompletionException，get() 抛 ExecutionException
5. 多层链路中，exceptionally 只拦"最近"的异常
```

---

## 四、超时控制

```java
// 方式1：orTimeout（Java 9+）— 超时抛 TimeoutException
supplyAsync(() -> slowCall())
    .orTimeout(3, TimeUnit.SECONDS)
    .exceptionally(ex -> {
        if (ex instanceof TimeoutException) return "超时兜底";
        throw new RuntimeException(ex);
    });

// 方式2：completeOnTimeout — 超时给默认值（不抛异常）
supplyAsync(() -> slowCall())
    .completeOnTimeout("默认值", 3, TimeUnit.SECONDS)
    .thenAccept(result -> log(result));

// 方式3：手动控制（Java 8 兼容）
CompletableFuture<String> future = supplyAsync(() -> slowCall());
CompletableFuture<String> timeoutFuture = new CompletableFuture<>();
scheduler.schedule(() -> timeoutFuture.complete("超时兜底"), 3, TimeUnit.SECONDS);
CompletableFuture<String> result = future.applyToEither(timeoutFuture, Function.identity());
```

**⚠️ 踩坑**：orTimeout 内部用 ScheduledExecutorService 实现，如果用自定义线程池创建 Future，超时回调也在那个线程池执行——可能导致线程池被占满。

---

## 五、线程池隔离（生产必做）

```java
// ❌ 错误：用 ForkJoinPool.commonPool()
supplyAsync(() -> queryDB());      // 默认公共线程池
supplyAsync(() -> callHTTP());     // 还是同一个公共线程池！
// 一个慢查询拖垮所有异步任务

// ✅ 正确：自定义线程池
ExecutorService dbPool = Executors.newFixedThreadPool(10);
ExecutorService httpPool = Executors.newFixedThreadPool(20);
supplyAsync(() -> queryDB(), dbPool);
supplyAsync(() -> callHTTP(), httpPool);

// ⚠️ 关键：下游链路也会用上游的线程池！
supplyAsync(() -> queryDB(), dbPool)
    .thenApply(data -> transform(data));  // transform 也在 dbPool！
// ✅ 解决：thenApplyAsync + 指定线程池
supplyAsync(() -> queryDB(), dbPool)
    .thenApplyAsync(data -> transform(data), computePool)
    .thenAcceptAsync(result -> send(result), httpPool);
```

### 线程池选择策略

```
| 任务类型   | 线程池       | 大小           | 队列                          |
|-----------|-------------|----------------|-------------------------------|
| DB 查询   | dbPool      | CPU核数×2      | LinkedBlockingQueue(100)      |
| HTTP 调用 | httpPool    | 50-100         | 有界队列+超时                  |
| CPU 计算  | computePool | CPU核数+1      | LinkedBlockingQueue           |
| 兜底      | fallbackPool| 10             | CallerRunsPolicy              |

⚠️ 所有线程池必须有界，所有队列必须有界，所有线程池必须命名
```

---

## 六、生产踩坑

```
1. 未指定线程池 → 所有任务挤 commonPool → 一个慢全卡住
2. 异常被吞 → 调用链太长，中间层没处理 → join() 结果不对
3. Future 不取消 → 业务逻辑判断不需要了，但底层线程还在跑 → 资源浪费
4. CompletableFuture 不能被中断 → interrupt() 无效，只能靠 cancel + timeout
5. thenApply 异步传播 → 默认用上一步的线程，不指定线程池就是串行假异步
```

---

## 七、与传统方案对比

```
| 维度         | Future (Callable)       | CompletableFuture          |
|-------------|------------------------|---------------------------|
| 获取结果     | get() 阻塞              | join()/getNow() 可非阻塞   |
| 异常处理     | try-catch               | exceptionally/handle       |
| 超时         | get(timeout) 粗糙       | orTimeout/completeOnTimeout|
| 组合         | 手动编排                 | thenApply/allOf 链式       |
| 线程池       | 每个 Future 自带         | 可指定、可复用              |
| 取消         | cancel(true) 中断        | cancel + timeout           |
| 流式编排     | ❌                       | ✅ 链式操作                 |
```

---

## 八、典型场景

```java
// 场景：同时调 DB + HTTP + 缓存，三个都回来再返回给前端
CompletableFuture<User> dbFuture = supplyAsync(() -> queryUser(id), dbPool);
CompletableFuture<List<Order>> httpFuture = supplyAsync(() -> fetchOrders(id), httpPool);
CompletableFuture<String> cacheFuture = supplyAsync(() -> getFromRedis(id), redisPool);

CompletableFuture.allOf(dbFuture, httpFuture, cacheFuture)
    .thenApply(v -> new UserDTO(
        dbFuture.join(),
        httpFuture.join(),
        cacheFuture.join()
    ))
    .orTimeout(3, TimeUnit.SECONDS)
    .exceptionally(ex -> defaultDTO());
```

## GPT 纠错

- GPT 纠错：`orTimeout`/`completeOnTimeout` 使用内部定时机制触发完成，不是“超时回调一定在创建 Future 的自定义线程池执行”。非 async 的后续阶段可能由完成该 Future 的线程执行。
- GPT 纠错：`orTimeout` 只让 CompletableFuture 超时完成，通常不会自动中断或取消底层正在执行的 HTTP、数据库或计算任务，资源取消需要单独设计。
- GPT 纠错：不带 Executor 的 async 方法默认使用 `ForkJoinPool.commonPool()`，但 commonPool 并非绝对错误；隔离阻塞 IO、控制容量和上下文传播时才应明确使用业务线程池。
- GPT 纠错：“IO 线程池=CPU×2”“CPU 线程池=CPU+1”不是通用生产公式，应根据阻塞比例、下游容量、延迟目标和压测结果配置。
- GPT 纠错：`thenApply` 是非 async 阶段，它可能由完成上一步的线程或调用完成方法的线程执行，不能简单称为“串行假异步”。

---

## 九、补充 · 与线程池的关系（2026-07-15 回顾追问）

### CompletableFuture ≠ 线程池

```
ExecutorService（线程池） = 干活的工人，负责"怎么跑"
CompletableFuture        = 工头，负责"跑完怎么串联结果"
```

- `CompletableFuture` 是一个**容器**：里面放着一个将来会有的结果
- 你不能用它来取代 `ThreadPoolExecutor`
- 它**依赖**线程池来干活，只是把"提交 → 等待 → 组合 → 异常"的过程从你手动写变成了链式声明
- `supplyAsync(() -> task())` 用 `ForkJoinPool.commonPool()`（默认）
- `supplyAsync(() -> task(), myPool)` 用自定义线程池

---

## 十、补充 · CompletableFuture 完整 API 速查

### 前置概念：Async vs 非 Async

```java
.thenApply(fn)         // 非 async：可能由完成上游的线程执行，不一定开新线程
.thenApplyAsync(fn)    // async：一定在新线程执行（默认 commonPool 或指定线程池）
```

| 方法后缀 | 执行线程 | 何时用 |
|---------|---------|--------|
| 无后缀 | 复用上游线程 | 轻量转换（CPU 密集且极快） |
| `Async` | 新线程执行 | 阻塞操作（IO/DB），必须指定线程池 |
| `Async(pool)` | 指定线程池 | 生产环境强烈建议 |

---

### Java 8 核心 API

#### 创建

```java
// 有返回值（Supplier）
CompletableFuture<String> f1 = CompletableFuture.supplyAsync(() -> "hello");
CompletableFuture<String> f2 = CompletableFuture.supplyAsync(() -> "hello", pool);

// 无返回值（Runnable）
CompletableFuture<Void> f3 = CompletableFuture.runAsync(() -> log("done"));
CompletableFuture<Void> f4 = CompletableFuture.runAsync(() -> log("done"), pool);

// 直接完成
CompletableFuture<String> f5 = CompletableFuture.completedFuture("已知值");
```

#### 单步转换（thenXxx 系列）

```java
// thenApply：接收上一步结果，返回新值（类似 Stream.map）
.thenApply(user -> user.getName())

// thenAccept：接收结果，无返回值（类似 Stream.forEach）
.thenAccept(user -> System.out.println(user))

// thenRun：不关心结果，只执行动作
.thenRun(() -> log("完成"))

// thenCompose：接收结果，返回一个新的 CompletableFuture（类似 flatMap）
// ★ 关键：避免 thenApply 返回 CompletableFuture<CompletableFuture<T>>
.thenCompose(user -> supplyAsync(() -> queryOrders(user.getId())))
```

#### 双步组合

```java
// thenCombine：两个都完成后，合并结果
cf1.thenCombine(cf2, (r1, r2) -> r1 + r2)

// thenAcceptBoth：两个都完成后，消费结果（无返回值）
cf1.thenAcceptBoth(cf2, (r1, r2) -> log(r1 + r2))

// runAfterBoth：两个都完成后，执行动作
cf1.runAfterBoth(cf2, () -> log("都完了"))

// applyToEither：任一完成就用它的结果
cf1.applyToEither(cf2, result -> result)

// acceptEither：任一完成就消费
cf1.acceptEither(cf2, result -> log(result))

// runAfterEither：任一完成就执行
cf1.runAfterEither(cf2, () -> log("有一个完了"))
```

#### 批量等待

```java
// allOf：等全部完成，返回 Void（需要手动 join 取结果）
CompletableFuture.allOf(f1, f2, f3).join();
String r1 = f1.join();  // 此时一定完成了
String r2 = f2.join();

// anyOf：任一完成就返回（返回 Object，需要转型）
Object result = CompletableFuture.anyOf(f1, f2, f3).join();
```

#### 异常处理

```java
// exceptionally：捕获异常 → 返回兜底值（不抛异常了）
.exceptionally(ex -> "兜底")

// handle：同时处理正常结果和异常（必须返回新值）
.handle((result, ex) -> {
    if (ex != null) return "兜底";
    return result.toUpperCase();
})

// whenComplete：事后回调（不改变结果，异常继续传播）
.whenComplete((result, ex) -> {
    if (ex != null) log.error("炸了", ex);
    else log.info("结果: {}", result);
})
```

#### 主动完成与取消

```java
CompletableFuture<String> f = new CompletableFuture<>();

// 外部主动完成
f.complete("手动结果");      // 成功完成
f.completeExceptionally(ex);  // 异常完成
f.obtrudeValue("强制覆盖");   // 强制重置（无视已有结果）

// 取消
f.cancel(true);   // 用 CancellationException 完成
f.isCancelled();  // 是否已取消
f.isDone();       // 是否已完成（正常/异常/取消都算 done）
```

---

### Java 9 新增

```java
// 超时
.orTimeout(3, TimeUnit.SECONDS)           // 超时抛 TimeoutException
.completeOnTimeout("默认值", 3, SECONDS)  // 超时给默认值（不抛异常）

// 延迟执行（必须传 Executor）
CompletableFuture.delayedExecutor(3, SECONDS)           // commonPool
CompletableFuture.delayedExecutor(3, SECONDS, pool)    // 自定义池

// 带超时的 join/get
.copy()                          // 返回一个副本（用于防御性编程）
.newIncompleteFuture()           // 返回同类型的新未完成 Future
.completeAsync(supplier)         // 异步完成（用默认 ForkJoinPool）
.completeAsync(supplier, pool)   // 异步完成（指定线程池）

// 失败 Future（静态方法）
CompletableFuture<T> f = CompletableFuture.failedFuture(ex);

// exceptionallyCompose：异常时切换到备用链路
.exceptionallyCompose(ex -> supplyAsync(() -> callFallback()))
```

---

### Java 12+ 新增

```java
// exceptionallyAsync / exceptionallyComposeAsync（异步异常处理）
.exceptionallyAsync(ex -> fallback(ex))             // 默认池
.exceptionallyAsync(ex -> fallback(ex), pool)       // 自定义池
.exceptionallyComposeAsync(ex -> callFallback(ex))  // 默认池

// completeAsync —— 兜底数据的异步获取
f.completeAsync(() -> computeDefault(), pool)
```

---

### ⚠️ join() vs get() 的区别（面试高频）

```java
// get()：抛出 checked 异常（ExecutionException、InterruptedException）
//       必须 try-catch，代码臃肿
String r = future.get();           // 需要处理异常
String r = future.get(3, SECONDS); // 带超时

// join()：抛出 unchecked 异常（CompletionException）
//        链式调用友好，不需要 try-catch
String r = future.join();
```

实际项目中 **优先用 `join()`**，因为 CompletableFuture 的设计哲学就是声明式 + 不强制检查异常。`get()` 来自 Future 接口的历史包袱。

---

### 💡 快速选型指南

| 需求 | 用这个 |
|------|--------|
| 异步执行一个任务 | `supplyAsync(() -> task(), pool)` |
| 等结果 | `join()` |
| 转换结果 | `.thenApply(r -> transform(r))` |
| 消费结果 | `.thenAccept(r -> log(r))` |
| 组合两个任务 | `.thenCombine(f2, (a, b) -> merge(a, b))` |
| 扁平化异步调用 | `.thenCompose(r -> supplyAsync(...))` |
| 等 N 个全部完成 | `CompletableFuture.allOf(f1, f2, f3)` |
| 异常兜底 | `.exceptionally(ex -> fallback)` |
| 异常记录日志后继续抛 | `.whenComplete((r, ex) -> {...})` |
| 异常后走备用链路 | `.exceptionallyCompose(ex -> callFallback())` |
| 超时 | `.orTimeout(3, SECONDS)` (Java 9) / `applyToEither` (Java 8) |

---

## 2026-07-15 回顾记录

- R1 回顾：用户记忆了线程池隔离要点（4/10），未答出 API 全貌、异常处理和超时
- 追问1：Java 8 超时 —— 手动 `applyToEither` 竞速模式
- 追问2：与线程池关系 —— CF 不是线程池，是线程池的编排层
- 补充：完整 API 速查（Java 8 / 9 / 12+）
