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
round: "R0"
next_review: "unknown"
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
