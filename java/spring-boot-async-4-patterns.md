# Spring Boot @Async 实战4种模式

> **来源**：微信公众号（Spring Boot 3实战案例锦集）
> **日期**：2026-06-06
> **分类**：Java / Spring Boot / 异步编程 / 线程池
> **环境**：Spring Boot 3.5.0

---

## 一、核心观点

> @Async 最危险的地方不是这个注解本身，是你不配的话，它偷偷用的那个线程池。

默认情况下，@Async 查找 beanName 为 `applicationTaskExecutor`、类型为 `Executor` 的线程池。Spring Boot 默认配置的是 `SimpleAsyncTaskExecutor`，**每次调用都新建一个线程**，没有池化，没有限制。

**规则：用了 @Async 但没配命名线程池，你没有并发。你有的是一个善意的线程泄漏。**

---

## 二、模式一：配置线程池 — 永远别用默认的

### ❌ 错误做法

```java
@Service
public class EmailService {
    @Async
    public void sendWelcomeEmail(String userEmail) {
        // 默认跑在 SimpleAsyncTaskExecutor 上
        // 每次调用都新建一个线程，没有池化
        emailGateway.send(userEmail);
    }
}
```

### ✅ 正确做法

```java
@Configuration
@EnableAsync
public class AsyncConfig {
    
    // 邮件任务线程池 —— 有边界、可观测、有命名
    @Bean("emailExecutor")
    Executor emailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);           // 常驻线程数
        executor.setMaxPoolSize(10);           // 突发上限
        executor.setQueueCapacity(100);        // 拒绝前的等待队列
        executor.setThreadNamePrefix("email-async-");  // 日志里能看到
        executor.setRejectedExecutionHandler(
            new ThreadPoolExecutor.CallerRunsPolicy()  // 反压：线程池满了，调用方自己干
        );
        return executor;
    }
    
    // 库存任务单独线程池 —— 不同 SLA，不同池
    @Bean("inventoryExecutor")
    Executor inventoryExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("inventory-async-");
        executor.setRejectedExecutionHandler(
            new ThreadPoolExecutor.AbortPolicy()  // 严格：满了就拒绝抛异常
        );
        return executor;
    }
}

// 每个 @Async 方法明确声明用哪个池
@Service
public class EmailService {
    @Async("emailExecutor")
    public CompletableFuture<Void> sendWelcomeEmail(String userEmail) {
        emailGateway.send(userEmail);
        return CompletableFuture.completedFuture(null);
    }
}
```

### 拒绝策略对比

| 策略 | 行为 | 适用场景 |
|------|------|----------|
| **CallerRunsPolicy** | 线程池满了，调用方线程自己来干 | 温和反压，任务不能丢 |
| **AbortPolicy** | 满了就拒绝并抛异常 | 任务绝对不能丢，需要显式处理 |
| **DiscardPolicy** | 静默丢弃 | 可以丢的任务（如日志） |
| **DiscardOldestPolicy** | 丢弃队列最老的任务 | 优先处理新任务 |

---

## 三、模式二：CompletableFuture — 多任务并行

### ❌ 错误做法（串行）

```java
@GetMapping("/dashboard/{userId}")
public DashboardDTO getDashboard(@PathVariable Long userId) {
    // 三个调用依次执行
    // 总耗时 = 200ms + 150ms + 300ms = 650ms
    UserProfile profile = ps.getProfile(userId);        // 200ms
    List<Order> orders = os.getRecentOrders(userId);    // 150ms
    AccountBalance balance = bs.getBalance(userId);     // 300ms
    return new DashboardDTO(profile, orders, balance);
}
```

### ✅ 正确做法（并行）

```java
@Service
public class DashboardService {
    
    public DashboardDTO buildDashboard(Long userId) 
            throws ExecutionException, InterruptedException {
        
        // 三个任务同时启动
        CompletableFuture<UserProfile> profileFuture = 
            CompletableFuture.supplyAsync(
                () -> profileService.getProfile(userId), dashboardExecutor);
        
        CompletableFuture<List<Order>> ordersFuture = 
            CompletableFuture.supplyAsync(
                () -> orderService.getRecentOrders(userId), dashboardExecutor);
        
        CompletableFuture<AccountBalance> balanceFuture = 
            CompletableFuture.supplyAsync(
                () -> billingService.getBalance(userId), dashboardExecutor);
        
        // 等三个都完成，再组装结果
        return CompletableFuture.allOf(profileFuture, ordersFuture, balanceFuture)
            .thenApply(v -> new DashboardDTO(
                profileFuture.join(),
                ordersFuture.join(),
                balanceFuture.join()))
            .exceptionally(ex -> {
                logger.error("Dashboard assembly failed for user {}", userId, ex);
                return DashboardDTO.partial();  // 优雅降级
            })
            .get();
    }
}
```

**总耗时现在是三者中最慢的那个——300ms，不是650ms。**

**规则：多个独立调用拼一个响应，你却串行做——你在让用户为你的懒惰买单。**

---

## 四、模式三：@TransactionalEventListener — 事务提交后的副作用

### ❌ 错误做法（事务没提交就触发）

```java
@Service
public class OrderService {
    @Transactional
    public Order createOrder(OrderRequest request) {
        Order order = orderRepository.save(request.toOrder());
        // 立即触发——即使事务会回滚！
        eventPublisher.publishEvent(new OrderCreatedEvent(this, order));
        return order;
    }
}

@Component
public class OrderEmailListener {
    @Async
    @EventListener  // 提交前就触发——错了
    public void onOrderCreated(OrderCreatedEvent event) {
        emailService.sendConfirmation(event.getOrder());
        // 客户收到邮件。事务回滚。订单根本不存在。
    }
}
```

### ✅ 正确做法（事务提交后才触发）

```java
@Component
public class OrderEmailListener {
    @Async("emailExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderCreated(OrderCreatedEvent event) {
        // 只有事务提交成功才会执行
        // 如果事务回滚，这个方法根本不会跑
        emailService.sendConfirmation(event.getOrder());
    }
}

@Component
public class InventoryListener {
    @Async("inventoryExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderCreated(OrderCreatedEvent event) {
        inventoryService.reserveItems(event.getOrder());
    }
}

@Component
public class LoyaltyListener {
    @Async("loyaltyExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_ROLLBACK)
    public void onOrderFailed(OrderCreatedEvent event) {
        // 专门对回滚做响应
        loyaltyService.releaseHeldPoints(event.getOrder().getUserId());
    }
}
```

### @TransactionalEventListener 的四个阶段

| 阶段 | 触发时机 | 典型场景 |
|------|----------|----------|
| **BEFORE_COMMIT** | 事务提交前 | 需要在提交前做校验 |
| **AFTER_COMMIT** | 事务提交后 | 发邮件、更新缓存、发消息 |
| **AFTER_ROLLBACK** | 事务回滚后 | 释放资源、记录日志 |
| **AFTER_COMPLETION** | 事务完成后（无论提交或回滚） | 清理资源 |

**规则：在 @Transactional 方法里触发副作用，永远不要用 @EventListener。只要事务边界重要，就用 @TransactionalEventListener。**

---

## 五、模式四：异步错误处理

### ❌ 错误做法（异常被吞掉）

```java
@Async
public void syncUserToSearchIndex(Long userId) {
    User user = userRepository.findById(userId).orElseThrow();
    searchClient.index(user);
    // 抛出连接超时
    // 异常被吞掉了。搜索索引永远不会更新。
    // 没日志。没报警。三天后你从工单里才发现。
}
```

### ✅ 正确做法一：AsyncUncaughtExceptionHandler

```java
@Configuration
public class AsyncConfig implements AsyncConfigurer {
    
    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (throwable, method, params) -> {
            // 任何 void @Async 方法抛异常时都会触发
            logger.error("Async method '{}' failed with params {} - {}",
                method.getName(), Arrays.toString(params), 
                throwable.getMessage(), throwable);
            alertingService.notifyAsync(method.getName(), throwable);
        };
    }
}
```

### ✅ 正确做法二：返回 CompletableFuture

```java
@Async("searchExecutor")
public CompletableFuture<Void> syncUserToSearchIndex(Long userId) {
    return CompletableFuture.runAsync(() -> {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new NotFoundException("User", userId));
        try {
            searchClient.index(user);
        } catch (SearchClientException e) {
            logger.error("Search index sync failed for userId={}", userId, e);
            throw e;
        }
    }, searchExecutor);
}

// 调用方显式处理成功和失败
public void onUserUpdated(Long userId) {
    syncUserToSearchIndex(userId)
        .whenComplete((result, ex) -> {
            if (ex != null) {
                retryQueue.enqueue(new SearchSyncTask(userId));
            }
        });
}
```

**规则：没有 AsyncUncaughtExceptionHandler 的 void @Async 方法就是个黑洞。异常进去了，出不来。**

---

## 六、面试关联点

### 与第1题（线程池核心参数）的关联

| 参数 | 文章中的体现 |
|------|-------------|
| corePoolSize | `executor.setCorePoolSize(5)` — 常驻线程数 |
| maximumPoolSize | `executor.setMaxPoolSize(10)` — 突发上限 |
| workQueue | `executor.setQueueCapacity(100)` — 等待队列 |
| rejectedExecutionHandler | `CallerRunsPolicy` / `AbortPolicy` — 拒绝策略 |

### 与第15题（Spring IOC）的关联

- `@Async` + 循环依赖的坑：`@Async` 的代理是在 `initializeBean` 阶段才生成的，而 `@Transactional` 的代理是在 `getEarlyBeanReference` 阶段就生成的
- 所以 `@Async` + 循环依赖会导致异步不生效

### 与第16题（事务传播）的关联

- `@TransactionalEventListener` 依赖事务边界
- `AFTER_COMMIT` 只在事务成功提交后触发
- `AFTER_ROLLBACK` 在事务回滚后触发

---

## 七、规则总结

| 规则 | 说明 |
|------|------|
| 用了 @Async 但没配命名线程池 | 你有的是一个善意的线程泄漏 |
| 多个独立调用拼响应却串行做 | 你在让用户为你的懒惰买单 |
| 在 @Transactional 方法里用 @EventListener | 事务回滚了副作用还执行了 |
| 没有 AsyncUncaughtExceptionHandler 的 void @Async | 异常进去了，出不来 |
