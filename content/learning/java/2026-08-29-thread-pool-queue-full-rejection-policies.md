---
title: "线程池队列满了会怎样：从拒绝策略看 ThreadPoolExecutor 扩容顺序"
date: "2026-08-29"
domain: "学习"
area: "Java 后端"
module: "Java 并发与异步"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "从 execute() 源码拆解 ThreadPoolExecutor 的扩容顺序：核心线程、入队、非核心线程、拒绝策略，并整理四种拒绝策略与生产配置。"
tags:
  - Java
  - 并发
  - 线程池
  - ThreadPoolExecutor
  - 拒绝策略
source: "微信公众号「Java技术工坊」"
source_url: "https://mp.weixin.qq.com/s/DzBfVkWw3faI2GYX5mIwCg"
published_at: "2026-08-29 09:00:00 +08:00"
---

# 线程池队列满了会怎样：从拒绝策略看 ThreadPoolExecutor 扩容顺序

> 原文标题：线程池队列满了会怎样？从拒绝策略看懂 ThreadPoolExecutor 的扩容顺序
>
> 来源：微信公众号「Java技术工坊」
>
> 发布时间：2026-08-29 09:00（北京时间）
>
> 原文链接：<https://mp.weixin.qq.com/s/DzBfVkWw3faI2GYX5mIwCg>

## 一、核心结论

线程池不是"任务来了就创建线程"。`ThreadPoolExecutor` 的扩容顺序固定为四步：

```text
1. 线程数 < corePoolSize        → 创建核心线程执行
2. 核心线程满，队列未满          → 任务入队等待
3. 队列满，线程数 < maximumPoolSize → 创建非核心线程执行
4. 队列满且线程数 = maximumPoolSize → 执行拒绝策略
```

很多人以为"先把线程数扩到最大，再入队"，这个理解是错的。先入队、后扩容的设计目的是用最少的线程处理最多的任务：核心线程负责常态流量，队列缓冲突发，非核心线程是处理完突发流量就回收的"临时援军"。

## 二、execute() 源码拆解

```java
public void execute(Runnable command) {
    if (command == null) throw new NullPointerException();
    int c = ctl.get(); // 高3位存线程池状态，低29位存线程数

    // 第一步：线程数 < 核心线程数 → 创建核心线程
    if (workerCountOf(c) < corePoolSize) {
        if (addWorker(command, true)) return;
        c = ctl.get(); // 创建失败（并发竞争），重新读
    }

    // 第二步：运行中且能入队
    if (isRunning(c) && workQueue.offer(command)) {
        int recheck = ctl.get();
        // 入队后发现线程池已关闭 → 移除任务并拒绝
        if (!isRunning(recheck) && remove(command))
            reject(command);
        // 线程数为0（核心线程都超时回收了）→ 补一个非核心线程消费队列
        else if (workerCountOf(recheck) == 0)
            addWorker(null, false);
        return;
    }
    // 第三步：入队失败（队列满）→ 创建非核心线程；失败则拒绝
    else if (!addWorker(command, false))
        reject(command);
}
```

要点：

- `ctl` 是原子整数，高 3 位存状态（RUNNING / SHUTDOWN / STOP / TIDYING / TERMINATED），低 29 位存工作线程数，一次 CAS 即可同时检查两者；
- `addWorker(command, true)` 的第二个参数为 `true` 表示按 `corePoolSize` 限制，`false` 表示按 `maximumPoolSize` 限制；
- 入队成功后的二次检查覆盖两种边界：入队瞬间线程池被关闭（移除并拒绝）；所有工作线程已因超时回收（补一个空线程从队列取任务，防止任务饿死）；
- `addWorker` 返回 `false` 的两种情况：线程数达到对应上限，或线程池处于不接受新任务的状态。

## 三、一个可复现的例子

核心线程 2、最大线程 4、队列容量 2，连续提交 6 个长任务：

```text
任务1、2 → 创建核心线程执行
任务3、4 → 核心线程忙，入队
任务5、6 → 队列满，创建非核心线程（线程数 2 → 4）
任务7   → 线程数到顶、队列也满 → 抛 RejectedExecutionException
```

即：`maximumPoolSize` 只有在队列满之后才可能被用到。

## 四、四种拒绝策略

当线程数达到 `maximumPoolSize` 且队列已满，任务交给 `RejectedExecutionHandler`。

| 策略 | 行为 | 是否丢任务 | 适用场景 |
|---|---|---|---|
| `AbortPolicy`（默认） | 抛 `RejectedExecutionException` | 否，调用方可感知 | 核心业务，快速失败 |
| `CallerRunsPolicy` | 由提交任务的线程自己执行 | 否 | 不能丢任务、可接受降速 |
| `DiscardPolicy` | 静默丢弃 | 是，且无感知 | 仅真正可丢弃的任务 |
| `DiscardOldestPolicy` | 丢弃队列中最老的任务，重新提交当前任务 | 是（旧任务） | 新任务明显比旧任务重要的场景 |

生产建议：

- 默认 `AbortPolicy` 是最"安全"的，因为拒绝是显式的；
- `CallerRunsPolicy` 有隐性限流效果：调用方线程被占用后提交速度自然下降，形成背压。但如果调用方是 Tomcat 工作线程且任务执行很慢，会把 HTTP 工作线程池也拖垮；
- `DiscardPolicy` 最危险，静默丢失任务；`DiscardOldestPolicy` 用得很少，因为多数场景下旧任务和新任务同等重要；
- 生产环境优先自定义策略：记录指标（活跃线程、队列大小、任务信息）、发送告警，并对可补偿任务做持久化或降级。

自定义拒绝策略骨架：

```java
public class CustomRejectedPolicy implements RejectedExecutionHandler {
    @Override
    public void rejectedExecution(Runnable r, ThreadPoolExecutor executor) {
        log.error("任务被拒绝，活跃线程：{}，队列大小：{}，最大线程：{}",
            executor.getActiveCount(),
            executor.getQueue().size(),
            executor.getMaximumPoolSize());
        // 告警 + 可补偿任务持久化
        if (r instanceof PersistableTask) {
            taskRepository.save((PersistableTask) r);
        } else {
            throw new RejectedExecutionException("线程池已满，任务被拒绝");
        }
    }
}
```

## 五、高频误区

### 1. `execute()` 的扩容逻辑不等于日志输出顺序

“核心线程 → 入队 → 非核心线程 → 拒绝”描述的是任务提交时的决策路径，不代表控制台日志一定严格按任务编号打印。线程启动、任务开始执行和提交方法返回之间都存在调度竞争；示例中的任务 1～6 是为了说明容量路径，真实日志可能交错。

`submit()` 也遵循同一套线程池扩容逻辑，只是它会先把任务包装成 `FutureTask`，再交给 `execute()`；因此提交返回的 `Future` 还要结合任务异常、取消和拒绝异常一起处理。

### 2. `maximumPoolSize` 配了不一定生效——无界队列会让它形同虚设

`LinkedBlockingQueue` 不指定容量时默认 `Integer.MAX_VALUE`，队列永远不会满，流程永远停在第二步（入队），`maximumPoolSize` 永远不会被触发：

```java
// ❌ 无界队列，线程数永远不会超过 corePoolSize
new ThreadPoolExecutor(2, 20, 60, TimeUnit.SECONDS, new LinkedBlockingQueue<>());

// ✅ 有界队列
new ThreadPoolExecutor(2, 20, 60, TimeUnit.SECONDS, new LinkedBlockingQueue<>(100));
```

`Executors.newFixedThreadPool()` 和 `newSingleThreadExecutor()` 底层都是无界 `LinkedBlockingQueue`，这也是《阿里巴巴 Java 开发手册》禁止直接用 `Executors` 创建线程池的主要原因：无界队列可能堆积到 OOM，且掩盖了线程池的真实负载。

### 2. 核心线程默认不会超时回收

默认核心线程即使空闲也长期存活。`executor.allowCoreThreadTimeOut(true)` 可让核心线程也受 `keepAliveTime` 控制（适合低频使用的线程池），但之后所有线程空闲超时都会回收，下次提交需要重新创建，有启动开销。

### 3. 核心线程不是启动时创建的，是懒加载

提交第一个任务时才创建第一个核心线程。刚建完线程池 `getActiveCount() == 0` 是正常现象，不是配置没生效。想预热可以：

```java
executor.prestartAllCoreThreads(); // 启动时预创建所有核心线程
```

### 4. `shutdown()` 不会丢弃队列任务

- `shutdown()`：停止接受新任务，但会把已提交的任务（包括队列中的）执行完；
- `shutdownNow()`：停止接受新任务，尝试中断正在执行的任务，并返回队列中未开始的任务列表，由调用方自行处理。

## 六、生产配置要点

### 1. 线程数怎么估

没有万能公式，按任务类型起步再压测调整：

- CPU 密集型（计算、加密、编码）：线程数接近 `CPU 核心数 + 1`，线程过多只会增加上下文切换；
- IO 密集型（数据库、HTTP、文件）：线程数可以显著高于核心数，等待期间其他线程可继续工作；
- 常用估算参考：`线程数 ≈ CPU核心数 × (1 + 等待时间 / 计算时间)`。公式只是起点，最终参数要靠压测和线上指标校准。

### 2. 必须用有界队列

无界队列的三重风险：OOM、`maximumPoolSize` 失效、流量突增时任务全堆在队列里导致延迟不断上涨。推荐 `LinkedBlockingQueue` 指定容量或 `ArrayBlockingQueue`。

### 3. 给线程命名

默认的 `pool-1-thread-1` 在故障排查时无法定位线程池归属。用自定义 `ThreadFactory` 命名（如 `order-pool-%d`），并配置 `UncaughtExceptionHandler` 记录线程内未捕获异常。

### 4. 监控与告警

核心指标：`activeCount`、`poolSize`、队列大小、`completedTaskCount`。可用 Micrometer 暴露给 Prometheus / Grafana，告警规则示例：

```text
队列使用率 > 80%       → 警告
活跃线程达到最大线程数    → 严重
发生任务拒绝            → 立即告警
```

### 5. 优雅关闭

```java
@PreDestroy
public void shutdown() {
    executor.shutdown();
    try {
        if (!executor.awaitTermination(60, TimeUnit.SECONDS)) {
            executor.shutdownNow(); // 超时兜底
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        executor.shutdownNow();
    }
}
```

## 七、勘误与补充

1. **`allowCoreThreadTimeOut(true)` 的前置条件**：开启后 `keepAliveTime` 必须大于 0，否则 `ThreadPoolExecutor` 构造函数直接抛 `IllegalArgumentException`。原文没有提到这个约束。
2. **`AbortPolicy` 的"不丢任务"是相对的**：它只保证调用方能感知拒绝，任务本身是否真正丢失取决于调用方有没有处理异常、有没有重试或持久化。拒绝策略本身不负责持久化。
3. **`DiscardOldestPolicy` 丢的是"等待最久"的任务，不是"最老提交"的任务**：它 `poll()` 队列头部。如果队列里有优先级语义（例如业务上旧数据更关键），这个策略会系统性丢错东西，选用前必须确认队列语义。
4. **`CallerRunsPolicy` 的背压不是免费的**：背压方向取决于调用方是谁。在 Tomcat 请求线程里触发，会把降速传导给上游网关和用户；在定时任务线程里触发，只会拖慢下一次调度。上线前要确认调用链能承受这个降速。
5. **线程数公式是经验估算，不是容量规划**：`CPU核心数 × (1 + 等待/计算)` 假设所有任务行为一致。真实系统往往是混合负载，线程数应结合下游依赖的承载能力（数据库连接池、下游 QPS 限制）一起定，而不是只看本机 CPU。
6. **`newFixedThreadPool` 的另一个隐患**：除了无界队列，它的 `corePoolSize == maximumPoolSize`，配合无界队列意味着线程池没有弹性，突发流量全部转化为队列堆积，监控队列长度比监控线程数更重要。

## 八、复习速记

```text
扩容顺序：核心线程 → 入队 → 非核心线程 → 拒绝
ctl：高3位状态 + 低29位线程数，一次 CAS 判断
无界队列：maximumPoolSize 失效 + OOM 风险
AbortPolicy：显式失败，默认且推荐作为起点
CallerRunsPolicy：背压降速，小心拖垮调用方线程
DiscardPolicy：静默丢失，生产慎用
DiscardOldestPolicy：丢队头最老任务，语义要匹配
核心线程：懒加载创建，默认不回收
prestartAllCoreThreads：预热
allowCoreThreadTimeOut：需 keepAliveTime > 0
shutdown：排队任务执行完；shutdownNow：中断并返回剩余任务
```
