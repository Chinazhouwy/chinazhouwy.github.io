---
title: "Java 并发优化 5 个实战技巧"
date: "2026-07-06"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "Java 并发优化 5 个实战技巧"
tags:
---

# Java 并发优化 5 个实战技巧

> **来源**：微信公众号《Spring Boot 3实战案例锦集》
> **日期**：2026-06-05
> **分类**：技术笔记 / 并发编程

---

## 一、CompletableFuture 构建非阻塞流水线

### 问题
大多数开发者只用 `supplyAsync` 就止步，没有构建完整的依赖流水线，容易导致线程饥饿。

### 解决方案：并行分发 + 聚合模式（fan-out + join）

```java
public CompletableFuture<UserDashboard> buildDashboard(long userId) {
    CompletableFuture<User> user = getUser(userId)
        .exceptionally(ex -> fallbackUser(userId));
    
    CompletableFuture<List<Order>> orders = getOrders(userId)
        .exceptionally(ex -> Collections.emptyList());
    
    CompletableFuture<List<Notification>> notifications = getNotifications(userId)
        .exceptionally(ex -> Collections.emptyList());
    
    return user
        .thenCombine(orders, (u, o) -> new UserContext(u, o))
        .thenCombine(notifications, (ctx, n) -> {
            ctx.setNotifications(n);
            return new UserDashboard(ctx);
        })
        .exceptionally(ex -> {
            log.error("Failed to build dashboard", ex);
            return new UserDashboard(fallbackContext(userId));
        });
}
```

### 关键点
- ✅ 全程无阻塞（避免使用 `get()` 阻塞调用）
- ✅ 并行分发 + 聚合模式（fan-out + join）
- ✅ 高效利用 ForkJoinPool 的工作窃取机制
- ✅ 组合式设计使错误局部化且可恢复

---

## 二、StampedLock 替代传统锁

### 问题
`ReentrantReadWriteLock` 存在写线程饥饿和高争用问题。

### 解决方案：StampedLock 乐观读模式

```java
private final StampedLock lock = new StampedLock();
private double x, y;

public double distanceFromOrigin() {
    long stamp = lock.tryOptimisticRead();  // 乐观读，不加锁
    double currentX = x, currentY = y;
    
    if (!lock.validate(stamp)) {  // 校验是否有写操作
        stamp = lock.readLock();   // 升级为悲观读锁
        try {
            currentX = x;  // 重新读取最新值
            currentY = y;
        } finally {
            lock.unlockRead(stamp);
        }
    }
    return Math.hypot(currentX, currentY);
}
```

### 关键点
- ✅ 乐观读：先读取，校验时再决定是否加锁
- ✅ 低争用特性：读取密集型场景下吞吐量更高
- ✅ 减少上下文切换开销

### 适用场景
- 读多写少（如缓存、配置中心）
- 需要同时读取多个变量的一致性快照

---

## 三、有界队列 + CallerRunsPolicy 避免过载

### 问题
初学者常用 `Executors.newFixedThreadPool(10)`，导致：
- 无界队列 → 请求无限缓冲 → JVM 崩溃

### 解决方案：自定义线程池 + 背压机制

```java
public static ExecutorService createExecutor() {
    int corePoolSize = Runtime.getRuntime().availableProcessors() + 1;
    int maxPoolSize = corePoolSize;
    long keepAliveTime = 0L;
    
    // 有界队列，最多缓冲 500 个任务
    BlockingQueue<Runnable> queue = new ArrayBlockingQueue<>(500);
    
    // 拒绝策略：调用方线程直接执行任务（背压）
    RejectedExecutionHandler policy = new ThreadPoolExecutor.CallerRunsPolicy();
    
    return new ThreadPoolExecutor(
        corePoolSize, maxPoolSize,
        keepAliveTime, TimeUnit.MILLISECONDS,
        queue, policy
    );
}
```

### 关键点
- ✅ 背压机制：队列满时由调用方直接执行任务
- ✅ 防止下游服务过载
- ✅ 确保突发流量下内存不会无限增长

### 拒绝策略对比

| 策略 | 行为 | 适用场景 |
|------|------|----------|
| **CallerRunsPolicy** | 调用方线程执行 | 需要背压，不愿丢弃任务 |
| **AbortPolicy** | 抛出 RejectedExecutionException | 需要感知过载 |
| **DiscardPolicy** | 静默丢弃 | 可接受丢弃 |
| **DiscardOldestPolicy** | 丢弃队列最老的任务 | 新任务比老任务重要 |

---

## 四、ConcurrentHashMap computeIfAbsent

### 问题：双重初始化竞争（Double Initialization Race）

```java
// ❌ 错误：先检查后操作，多线程不安全
if (!cache.containsKey(key)) {
    cache.put(key, loadValue(key));  // 两个线程可能同时执行 loadValue
}
```

### 解决方案：原子操作

```java
// ✅ 正确：computeIfAbsent 是原子操作
var value = cache.computeIfAbsent(key, k -> loadValue(k));
```

### ⚠️ 陷阱：函数内不能有阻塞或耗时操作

```java
// ❌ 错误：getFromDb() 是慢操作，会长时间持有桶级锁
cache.computeIfAbsent(key, k -> getFromDb(k));

// ✅ 正确：将耗时操作放到异步线程
cache.computeIfAbsent(key, k -> 
    CompletableFuture.supplyAsync(() -> getFromDb(k))
);
```

### 原理
- `computeIfAbsent` 内部会对 key 所在的哈希桶加锁（synchronized）
- 如果 lambda 函数有阻塞操作，会长时间持有锁，导致其他线程无法访问该桶
- 解决：将耗时操作异步化，lambda 只做轻量计算

---

## 五、虚拟线程正确使用

### 问题：错误地将虚拟线程当作普通线程

```java
// ❌ 错误：在虚拟线程中卸载阻塞任务到其他线程池
executor.submit(() -> {
    CompletableFuture.supplyAsync(() -> getFromDb());  // 无意义，丧失虚拟线程优势
});
```

### 解决方案：直接让虚拟线程阻塞

```java
// ✅ 正确：虚拟线程直接阻塞
ExecutorService vts = Executors.newVirtualThreadPerTaskExecutor();
vts.submit(() -> {
    String data = getFromDb();    // 虚拟线程阻塞，释放平台线程
    writeToDisk(data);            // 虚拟线程阻塞，释放平台线程
});
```

### 原理
- 虚拟线程阻塞时会释放底层平台线程（物理线程）
- JVM 可复用该平台线程处理其他虚拟线程
- 虚拟线程的挂起成本接近零，可轻松支持百万级并发

### 关键点
- ✅ 虚拟线程的优势在于内部阻塞
- ✅ 不要把阻塞操作卸载到其他线程池（会丧失扩展性）
- ✅ 直接让虚拟线程执行 IO/数据库查询等阻塞操作

---

## 总结：5 个技巧的核心思想

| # | 技巧 | 核心思想 |
|---|------|----------|
| 1 | CompletableFuture 流水线 | 并行分发 + 聚合，全程无阻塞 |
| 2 | StampedLock 乐观读 | 读多写少场景，乐观读避免加锁 |
| 3 | 有界队列 + CallerRunsPolicy | 背压机制，防止过载崩溃 |
| 4 | computeIfAbsent | 原子操作避免双重初始化，lambda 别阻塞 |
| 5 | 虚拟线程 | 直接阻塞，不要卸载到其他线程池 |

---

## 面试加分点

1. **CompletableFuture**：能说清 fan-out + join 模式，以及 exceptionally 的降级设计
2. **StampedLock**：能说清乐观读 vs 悲观读的区别，以及 validate 的作用
3. **线程池调优**：能说清 CallerRunsPolicy 的背压机制，以及为什么不用 Executors.newFixedThreadPool
4. **ConcurrentHashMap**：能说清 computeIfAbsent 的锁粒度（桶级），以及 lambda 不能阻塞的原因
5. **虚拟线程**：能说清虚拟线程 vs 平台线程的本质区别，以及为什么不要卸载阻塞操作
