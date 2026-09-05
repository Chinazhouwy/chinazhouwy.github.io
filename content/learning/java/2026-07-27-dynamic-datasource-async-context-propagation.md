---
title: "多数据源上下文在异步线程中不会自动传播：CompletableFuture 查错库排查记录"
date: "2026-07-27"
domain: "学习"
area: "Java 后端"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "动态多数据源基于线程上下文路由；CompletableFuture.supplyAsync() 无参调用切到 ForkJoinPool 后上下文丢失，查询回落 primary 库。整理现象、根因、验证方法与四种修复方案，并延伸到异步事务的线程边界问题。"
tags:
  - Java
  - 并发
  - CompletableFuture
  - ThreadLocal
  - 动态数据源
  - Spring
source: "微信公众号「进阶的小名」"
source_url: "https://mp.weixin.qq.com/s/nRvJOiJ8Kl5by6gLWbsY6w"
published_at: "2026-07-27 08:50:00 +08:00"
---

# 多数据源上下文在异步线程中不会自动传播：CompletableFuture 查错库排查记录

> 原文标题：多数据源上下文在异步线程中不会自动传播：一次 CompletableFuture 排查记录
>
> 来源：微信公众号「进阶的小名」
>
> 发布时间：2026-07-27 08:50（北京时间）
>
> 原文链接：<https://mp.weixin.qq.com/s/nRvJOiJ8Kl5by6gLWbsY6w>
>
> 环境：原文未标明 JDK / Spring Boot 版本；本文核验使用本机 JDK 17 与 JDK 21 官方 Javadoc。

## 一、问题现象：库里明明有数据，代码却查出 null

项目使用动态多数据源（`spring.datasource.dynamic`，配置了 `master` 与 `en` 两个库），入口 Filter 按请求头切换数据源：

```yaml
spring:
  datasource:
    dynamic:
      primary: master   # 上下文为空时回退 master
      strict: true      # 指定不存在的数据源直接报错
```

```java
String header = request.getHeader("Accept-Language");
String dataSourceKey = isEnglish(header) ? "en" : "master";
DynamicDataSourceContextHolder.push(dataSourceKey);
try {
    chain.doFilter(request, response);
} finally {
    DynamicDataSourceContextHolder.poll();
}
```

请求携带 `Accept-Language: en-US` 时出现矛盾现象：

- Filter 已把当前请求线程数据源设置为 `en`；
- 目标用户在 `en` 库确实存在；
- 接口中某个查询却返回 `null`，随后 `user.getType()` 抛空指针。

排查发现返回 null 的查询不在原 HTTP 线程执行，而在 `CompletableFuture.supplyAsync()` 创建的异步任务中：

```java
CompletableFuture<User> userFuture =
    CompletableFuture.supplyAsync(() -> userService.findById(userId));
// … allOf().join() 后 user == null → NPE
```

关键：`supplyAsync(...)` 没有传 executor，任务默认提交到 `ForkJoinPool.commonPool()`。

## 二、根因：数据源上下文是线程级的，异步线程不继承

```text
http-nio-8099-exec-5:        datasource = en
ForkJoinPool.commonPool-x:   datasource = null  → 回落 primary(master)
```

异步线程上下文为空 → 框架按 `primary: master` 路由 → 在 master 库查 `en` 库才有的用户 → `null` → NPE。

三层机制支撑这个结论（均已对照官方文档核验）：

1. **ThreadLocal 只对当前线程可见**。JDK Javadoc：每个线程持有自己那份 thread-local 变量的隐式引用，线程 A 设置的值线程 B 读不到。
2. **线程池线程不是请求线程的子线程**。线程池里的线程早已创建并被复用，不会"自然继承"提交任务时的上下文。
3. **InheritableThreadLocal 也救不了线程池**。继承只发生在*线程创建*那一刻；池化线程创建后反复复用，后续任务的上下文不会更新——甚至可能读到线程创建时的旧值。

还有一个容易被忽略的次生风险：**传播了却不清理**。线程池线程被复用，若任务结束不 `poll()`，A 请求留下的 `datasource=en` 会污染下一个本应走 master 的 B 请求。这类问题难稳定复现（取决于线程分配），后果可能是查错库甚至写错库。MDC 串了只是日志错，数据源串了是数据错。所以 push/poll 必须成对出现：

```java
DynamicDataSourceContextHolder.push(dataSourceKey);
try {
    return doQuery();
} finally {
    DynamicDataSourceContextHolder.poll();
}
```

## 三、验证路径（怎么确认就是这个问题）

1. **看异常线程名**：栈里出现 `ForkJoinPool` 或自定义池名 → 异常发生在异步线程。
2. **搜无参异步调用**：`rg "CompletableFuture\.(supply|run)Async"`，重点看没传 executor 的。
3. **两个库分别查同一条数据**：en 库有、master 库无、代码返回 null → 强烈指向查错库（还需第 4 步坐实）。
4. **打印路由证据链**：在 Filter、Controller、异步 lambda 分别打印
   `DynamicDataSourceContextHolder.peek()`、当前线程名、实际连接的 JDBC URL / 连接池名、实际执行的 SQL。看到 `Filter/Controller: en`、`lambda: null` 且连接指向 master，问题闭环。

## 四、四种修复方案对比

| 方案 | 做法 | 优点 | 缺点 | 适合 |
|---|---|---|---|---|
| 1. 去掉异步 | 改同步查询 | 最简单、天然沿用请求线程上下文 | 失去并发收益 | 查询量小、异步只是"看起来优化" |
| 2. 手动传播 | lambda 内 push + finally poll | 精确、改动局部 | 每处都要写、易遗漏、侵入业务 | 异步点很少、临时修复单接口 |
| 3. 统一 Executor | 封装 contextAwareExecutor，提交时捕获、执行时恢复、结束后清理 | 统一、可同时传播 MDC 等、清理集中 | 需替换存量无参调用、要形成规范 | 异步调用多、多数据源是长期架构 |
| 4. TaskDecorator | Spring 线程池统一装饰任务 | 与 Spring 生态集成好 | 覆盖不到 JDK commonPool | `@Async` 与显式传 Spring executor 的场景 |

方案 2 示例：

```java
String dataSourceKey = DynamicDataSourceContextHolder.peek(); // 提交前捕获

CompletableFuture.supplyAsync(() -> {
    DynamicDataSourceContextHolder.push(dataSourceKey);
    try {
        return userService.findRelatedUsers(userId);
    } finally {
        DynamicDataSourceContextHolder.poll(); // 必须成对
    }
}, executor);
```

方案 4 的边界要记牢：`TaskDecorator` 只能装饰**经过对应 Spring TaskExecutor 提交**的任务——即 `@Async("taskExecutor")` 和显式 `supplyAsync(..., taskExecutor)`；无参 `supplyAsync(...)` 走 JDK commonPool，TaskDecorator 完全够不着。

**团队规范沉淀**（原文第 8 节）：

- 多数据源场景禁止随手写无参 `CompletableFuture.supplyAsync/runAsync`，一律显式传统一 executor；
- 上下文传播必须带清理（finally poll），只传播不清理比不传播更危险。

## 五、延伸：@Transactional 方法里的异步任务为什么不在外层事务里

同一根因的另一个表现。Spring 事务通过 `TransactionSynchronizationManager` 把资源**绑定到当前线程**（官方 Javadoc：管理 per-thread 的资源与事务同步，资源如 JDBC Connection 是 thread-bound）。于是：

```java
@Transactional
public void process() {
    userService.updateUser(user);          // 请求线程：事务 A，连接 A
    CompletableFuture.runAsync(() ->
        userService.saveRelatedUser(u));   // ForkJoin 线程：无事务 A，独立执行
}
```

- 异步任务读不到原线程绑定的事务资源，通常无事务（自动提交）或自开新事务；
- 外层回滚时 `updateUser` 撤销，`saveRelatedUser` 若已提交则**保留** → 主操作回滚、副操作落库；
- `future.join()` 只是等结果，不会让异步线程加入外层事务；
- 需要事务就在异步线程内**独立开启**：通过 Spring 管理的 Bean 代理调用 `@Async + @Transactional` 方法（自调用、private 方法都不生效）；
- 要求多个操作同生共死，最稳妥是**保持同线程同步执行**；JDBC 本地事务的连接不适合多线程共享，不能靠传播 ThreadLocal 把一个本地事务扩到多个线程。

与已归档的《Spring @Transactional 失效的 7 个场景》场景 6（子线程不继承事务）互为印证。

## 六、勘误与补充

原文整体准确，无硬性错误。以下为补充与精确化（均对照一手来源核验）：

1. **commonPool 不是无条件使用**：JDK 21 Javadoc 明确——所有不带 Executor 的 async 方法使用 `ForkJoinPool.commonPool()`，*除非它不支持至少 2 的并行度，此时每个任务新建一个 Thread*。本机 JDK 17 实测：`ContextPropagationCheck` 中 `supplyAsync` 无参调用运行在 `Thread-0`（正是低并行度回退路径），上下文读到 `null`，结论不变——无论哪条路径，ThreadLocal 都不传播。
2. **"线程池污染"的隐蔽性可再强调**：`peek()` 返回 null 只说明异步线程无上下文；最终查了哪个库还要结合路由日志 / JDBC URL 证据（原文 6.3 也强调了这点，此处呼应）。排查时不要止步于"两边库各查一次"。
3. **TaskDecorator 异常处理限制**：Spring 官方 Javadoc 注明，Future 型操作暴露的 Runnable 是包装器，不从 `run()` 传播异常——用 TaskDecorator 做上下文传播时，清理逻辑要写在装饰器自己的 try/finally 里，不要指望异常透传后在外层清理。
4. **方案 3 的统一 Executor 建议同时传播 MDC**：数据源上下文与日志 traceId 是同类问题（线程绑定、需成对清理），一次封装可以一起解决，避免两套传播逻辑漂移。

核验方式：JDK 17 本机最小示例复现 + JDK 21 Javadoc（CompletableFuture / ThreadLocal / InheritableThreadLocal）+ Spring Framework 官方 Javadoc 与参考文档（TransactionSynchronizationManager / TaskDecorator / @Async proxy 模式）。

## 七、复习速记

```text
无参 supplyAsync → commonPool（或低并行度新线程）→ ThreadLocal 全丢
丢失的不只是数据源 key：MDC、事务资源、SecurityContext 同理
InheritableThreadLocal 只在线程创建时继承 → 线程池复用场景不可靠
传播必须成对：捕获 → push → finally poll；只 push 不 poll = 串库炸弹
TaskDecorator 只管 Spring executor；@Async 默认 proxy 模式，自调用不拦截
@Transactional + runAsync：异步任务不在外层事务；join() 不改变事务边界
要同生共死 → 同线程同步；要异步又要事务 → 异步线程内独立开事务
排查三步：看线程名 → 搜无参异步 → 打印 peek()/JDBC URL 证据链
```
