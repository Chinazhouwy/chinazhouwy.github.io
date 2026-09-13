---
title: "灰度发布体系设计：策略维度、双层切流与全链路标签透传"
date: "2026-09-10"
domain: "学习"
area: "工程与架构"
module: "工程与架构"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "以小米二面真题为引子整理灰度发布体系：蓝绿/金丝雀/灰度概念区分、四类分流维度、网关哈希切流、跨服务与跨线程的标签透传（请求头 + TransmittableThreadLocal）、配置中心动态放量、监控对比与一键回滚，并附本机实测勘误。"
tags:
  - 灰度发布
  - 全链路灰度
  - Spring Cloud Gateway
  - TransmittableThreadLocal
  - 配置中心
  - 发布策略
source: "微信公众号「Java技术实战」"
source_url: "https://mp.weixin.qq.com/s/z5h92vwE599-GeGwP8IuTg"
published_at: "2026-09-10 10:32:00 +08:00"
---

# 灰度发布体系设计：策略维度、双层切流与全链路标签透传

> 原文标题：《小米二面：请设计一套灰度发布体系，说明其策略与实现》[1]
>
> 来源：微信公众号「Java技术实战」
>
> 发布时间：2026-09-10 10:32（北京时间）
>
> 原文环境：Spring Cloud Gateway / Feign / Apollo / transmittable-thread-local（按原文示例代码，未注明具体版本）
>
> **类型**：📚 技术文章整理（原文以小米二面题为引子，但内容是通用灰度发布体系设计，不是小米面经实录）

## 题目（原文）

> 小米的 MIUI 系统升级、米家 IoT 固件推送、商城后端服务发布，都涉及一个共同的问题：新版本如何安全地上线给真实用户？请设计一套灰度发布体系，说明灰度策略的维度、流量切分机制，以及全链路灰度标签如何透传。[1]

## 一、核心结论

灰度发布 = **按规则放量 + 双层切流 + 标签透传 + 动态放量**：网关用哈希判定流量归属，请求头加可传递 ThreadLocal 保证标签不丢，配置中心让比例秒级可调，监控对比兜底一键回滚。[1]

## 二、概念对齐：蓝绿、金丝雀、灰度

| 发布方式 | 核心做法 | 回滚难度 | 适用场景 |
|---|---|---|---|
| 蓝绿发布 | 同时启两套完整环境（蓝=旧、绿=新），流量整体切换 | 低，直接切回蓝 | 机器资源充足、对停机敏感 |
| 金丝雀发布 | 先放一小撮流量到新版本，没问题再逐步放大 | 中 | 快速验证新版本可用性 |
| 灰度发布 | 按规则（用户/比例/设备/地域）精细放量，逐步覆盖 | 中，需按规则回滚 | 业务复杂、需要精细控制放量节奏 |

一句话区分：金丝雀是只按流量比例放量的灰度；灰度多了"按规则"的维度。[1]

## 三、灰度维度：先让谁用上新版本

| 灰度维度 | 示例 | 优点 | 缺点 |
|---|---|---|---|
| 用户维度 | 白名单、VIP、按 userId 哈希 | 精准、可控、可定向 | 样本可能不具代表性 |
| 流量比例 | 1% → 5% → 20% → 100% | 简单、统计意义强 | 无法定向到特定人群 |
| 设备/机型 | 手机型号、固件版本、App 版本 | 适配 IoT/App 场景 | 维度复杂，规则维护成本高 |
| 地域/机房 | 按城市、按可用区 | 隔离故障域、就近验证 | 覆盖慢 |

维度选择本质是**可控性与代表性的权衡**，成熟方案多维度叠加：白名单内测 → 按比例小流量 → 按地域扩面 → 全量。[1]

## 四、第一层实现：网关切流

灰度分流的第一落点通常在网关：所有请求都经过网关，在这里分流成本最低、覆盖最全。原文以 Spring Cloud Gateway 全局过滤器为例：命中灰度的用户请求被打上 `X-Gray: true` 头再转发。[1]

判定引擎核心是**白名单优先 + userId 哈希取模**：

```java
public boolean isGrayUser(String userId) {
    if (userId == null || userId.isEmpty()) return false;
    // 1. 白名单直接命中（内测/定向放量）
    if (grayWhitelist.contains(userId)) return true;
    // 2. 哈希取模：同一用户稳定落在同一侧
    int bucket = (userId.hashCode() & Integer.MAX_VALUE) % 100;
    return bucket < currentGrayPercent();
}
```

原文强调两个易被追问的点：[1]

1. **为什么用哈希不用随机**：随机会导致同一用户这次命中灰度、下次回到正常，状态有变更的场景直接出 bug；哈希取模保证"用户稳定性"。
2. **为什么要处理负数**：`hashCode()` 可能返回负数，需要保证 bucket 非负（原文用 `& Integer.MAX_VALUE` 清符号位）。⚠️ 原文对这个问题的症状描述有误，见文末勘误 1——实测方向正好相反且更严重。

过滤器 `getOrder()` 返回 0 并注释"优先级最高，最先执行"也不严谨：Spring 的 `Ordered` 语义是 **order 值越小优先级越高**，0 只是相对靠前；要确保最先执行应使用 `Ordered.HIGHEST_PRECEDENCE`（即 `Integer.MIN_VALUE`）或明确的负值，并核对链上其他过滤器的 order。[4]

## 五、第二层实现：全链路标签透传（真正的难点）

灰度发布最难的不是"切流量"，而是"标签不丢"。请求经过网关 → 服务A → 服务B → 服务C，只在网关打标签的话，服务 C 不知道这是灰度请求，无法走灰度分支。[1]

![全链路灰度标签透传：网关注入 X-Gray Tag，服务 A 读取标签执行 Gray Logic 并继续透传至服务 B/C，灰度库与灰度配置独立](./2026-09-10-gray-release-system-images/01.png)

透传分两个战场：

### 5.1 跨服务：请求头

Dubbo 用 `RpcContext` 或自定义 Filter，Spring Cloud 用 Feign `RequestInterceptor`，把 `X-Gray` 头从上游带给下游：

```java
@Component
public class GrayHeaderInterceptor implements RequestInterceptor {
    @Override
    public void apply(RequestTemplate template) {
        if (GrayContext.isGray()) {
            template.header("X-Gray", "true");
        }
    }
}
```

### 5.2 跨线程：可传递的 ThreadLocal

这是最容易踩坑的地方：用普通 `ThreadLocal` 存灰度标签，交给线程池异步处理后子线程拿不到标签，灰度逻辑悄悄失效。[1]

三层机制的区别（已对照官方文档核验）：

| 机制 | 传递时机 | 线程池场景 |
|---|---|---|
| `ThreadLocal` | 不传递 | 子线程完全拿不到 |
| `InheritableThreadLocal` | **子线程创建时**自动传递一次 | 线程是池化复用的，创建早已发生，传递失效 [2] |
| `TransmittableThreadLocal`（阿里开源，非 JDK 自带） | **任务提交给线程池时**捕获、任务执行时回放 | 需要 `TtlExecutors.getTtlExecutorService()` 包装线程池 [3] |

```java
public class GrayContext {
    private static final TransmittableThreadLocal<Boolean> GRAY_TAG = new TransmittableThreadLocal<>();
    public static void setGray(boolean gray) { GRAY_TAG.set(gray); }
    public static boolean isGray() { return Boolean.TRUE.equals(GRAY_TAG.get()); }
    public static void clear() { GRAY_TAG.remove(); }
}
```

入口拦截器从请求头读标签写入上下文，`afterCompletion` 必须 `clear()`，防止线程池复用串味。[1]

> 同一类坑在本仓库有独立实战记录：[多数据源上下文在异步线程中不会自动传播](../java/2026-07-27-dynamic-datasource-async-context-propagation.md)——`CompletableFuture.supplyAsync()` 切到 ForkJoinPool 后 ThreadLocal 不跨线程，数据源上下文读到 null。两篇互为印证：**任何基于 ThreadLocal 的请求上下文（数据源 key、灰度标签、traceId、MDC）在线程池/异步边界都会丢**。

全链路灰度的本质是"标签的可达性"：跨服务（请求头）和跨线程（可传递 ThreadLocal）两个维度都不能丢；丢任何一个，灰度就变成新旧逻辑混跑的"半吊子灰度"。[1]

## 六、第三层实现：配置中心动态下发

灰度比例每次调整都要发版重启，等于没灰度。正确做法是把灰度策略抽到配置中心（原文以 Apollo 为例，Nacos 同理）：

```yaml
gray:
  switch: true                        # 灰度总开关，紧急一键关停
  percent: 5                          # 灰度流量比例 0~100
  whitelist: admin_001,beta_001       # 白名单
  grayServices: user-service,order-service  # 参与灰度的下游服务
```

服务端用 `@ApolloConfigChangeListener` 监听变更，把新值刷进 `volatile` 字段，无需重启。这样才能做到"几秒钟从 5% 拉到 100%"或"发现异常一键回滚到 0"。[1]

## 七、生命周期：放量、监控、回滚

![灰度放量流程：白名单内测 1% → 小流量 5% → 中等流量 20% → 大流量 50% → 全量 100%，每步检查异常，异常立即回滚](./2026-09-10-gray-release-system-images/02.png)

放量每一步都要盯**新旧版本监控指标对比**，这是灰度和"裸奔上线"的分水岭：[1]

| 监控维度 | 具体指标 | 异常信号 |
|---|---|---|
| 可用性 | 错误率、超时率 | 灰度组错误率显著高于对照组 |
| 性能 | RT、TP99、QPS | 灰度组 RT 明显劣化 |
| 业务 | 下单成功率、支付成功率 | 核心转化指标下滑 |
| 资源 | CPU、内存、GC | 灰度实例资源异常飙升 |

回滚必须"一键化"，两条路径：

1. **配置回滚**：`gray.percent` 拉到 0 或关灰度开关，秒级生效，流量全回旧版本；
2. **版本回滚**：灰度集群独立部署时，直接切断灰度集群路由，全部切回稳定集群。

⚠️ 回滚的前提是**新旧版本兼容**：灰度期间数据格式、接口、存储结构必须向前兼容，否则回滚后老版本读不懂新数据，回滚变成二次事故。[1]

## 八、小米场景的特殊性：三条灰度链路

| 业务线 | 灰度对象 | 核心维度 | 特殊难点 |
|---|---|---|---|
| MIUI 系统 OTA | 手机 ROM 升级 | 机型 + 地域 + 批次 | 升级包下发后无法即时撤回，必须分批按机型灰度 |
| 米家 IoT 固件 | 智能硬件设备 | 设备型号 + 固件版本 + 设备 ID | 设备离线、回滚困难，灰度必须更保守 |
| 服务端 | 商城/广告/账号 | 用户 + 流量比例 | 与常规微服务灰度一致，但需与 App 灰度联动 |

面小米可以主动补一句：IoT 固件和手机 OTA 的灰度比服务端更讲究"按设备维度分批"，因为固件推到设备后回滚成本极高，放量节奏必须更慢、更保守。[1]

## 九、常见追问速答（原文口径）

- **Q1 灰度期间数据写到不同库，回滚后怎么对齐？** 正确做法是灰度期间**不拆库、只拆流量**：新旧版本共用同一份数据，靠代码向前兼容；确需新表新字段就"双写"，回滚后老版本仍读旧表，全量稳定后再下线双写。
- **Q2 怎么防止灰度用户"一直灰"？** 哈希取模天然固定用户归属；灰度结束要么下掉灰度逻辑，要么 percent 拉到 100；中途撤回某批用户靠白名单 + 配置动态调整，不改哈希算法。
- **Q3 中间服务不认识灰度标签会怎样？** 透传原则是"能透传就透传，读不到按正常处理"：下游读不到 `X-Gray` 默认走正常分支，不报错；要强保证就在统一 RPC 框架层（如 Dubbo Filter）透传，而不是每个服务自己写。
- **Q4 网关切流和服务层切流选哪个？** 两者配合：网关负责"第一刀"（按规则打标签并路由），服务层负责"第二刀"（按标签走灰度/正常逻辑）。只做网关则内部逻辑没换，只做服务层则标签来源不明。[1]

## 十、面试口语模板（原文）

> 这道题我从"规则、切流、透传、放量"四块来答。
>
> 灰度发布的核心是按规则放量，规则维度有用户、流量比例、设备和地域四类，成熟方案是多维度叠加：先白名单内测，再按比例放量，最后扩面全量。
>
> 切流分两层。第一层在网关，用 userId 哈希取模判定是否命中灰度，哈希保证同一用户每次请求稳定落在同一侧。第二层是服务层，根据灰度标签走不同逻辑。
>
> 透传是全链路灰度的难点：跨服务靠请求头（Dubbo 的 RpcContext 或 Feign 拦截器），跨线程用可传递的 ThreadLocal，保证标签在调用链上不丢。
>
> 放量节奏上，灰度比例、白名单、开关全部放配置中心动态下发，从 1% 逐步放到 100%，每一步盯住新旧版本的错误率、RT 和业务指标对比，发现异常一键把比例拉到 0 回滚。
>
> 如果面的是小米，再补一句：手机 OTA 和 IoT 固件的灰度更讲究按设备维度分批、放量更保守，因为固件推给设备后回滚成本极高。[1]

## 勘误与补充

### 1. 负数 bucket 的真实症状与原文相反（本机实测）

- **原文表述**："`hashCode()` 可能返回负数，负数取模还是负数，会导致部分用户**永远无法命中灰度**。" [1]
- **实测结果**：按原文代码 `bucket = hashCode % 100; return bucket < grayPercent;`，负 bucket（如 -48）**恒小于**任何非负 grayPercent——症状是这些用户**永远命中灰度**，甚至在 `percent = 0`（灰度全关）时也被放进灰度侧。本机 JDK 17 运行验证：`"polygenelubricants".hashCode() == Integer.MIN_VALUE`，naive 写法在 percent=0 时返回 true，`& Integer.MAX_VALUE` 修复后返回 false。
- **影响**：比原文描述的更严重——灰度开关拉到 0 也无法完全关停，"一键回滚"对这批用户失效。
- **补充**：修复不要用 `Math.abs(hashCode)`，`Math.abs(Integer.MIN_VALUE)` 仍返回负数；原文的 `& Integer.MAX_VALUE` 掩码写法是正确选择。

### 2. InheritableThreadLocal 的传递时机（官方文档核验，原文结论正确）

- **原文表述**："JDK 自带的 InheritableThreadLocal 只在创建线程那一刻复制一次，线程池复用线程后就失效了。" [1]
- **核验**：JDK 17 Javadoc 明确 ITL 的值在**创建子线程时**自动传递 [2]；TTL 官方 README 同样指出线程池场景下"父子线程关系的 ThreadLocal 值传递已经没有意义"，需要的是任务提交时捕获、执行时回放 [3]。原文结论正确。

### 3. TTL 不是 JDK 自带、需要包装线程池（官方 README 核验，原文正确）

- **原文表述**："TransmittableThreadLocal 来自阿里开源的 transmittable-thread-local 库（包名 com.alibaba.ttl），不是 JDK 自带的……线程池得用 TtlExecutors.getTtlExecutorService() 包一层。" [1]
- **核验**：TTL 官方 README 确认其"继承并加强 InheritableThreadLocal"，且示例代码就是 `TtlExecutors.getTtlExecutorService(executorService)` 包装 [3]。原文正确。

### 4. `getOrder() = 0` 不等于"优先级最高"（Spring Javadoc 核验）

- **原文表述**：过滤器 `return 0; // 优先级最高，最先执行`。[1]
- **更准确表述**：Spring `Ordered` 的语义是 order 值越小优先级越高 [4]；0 只是相对靠前，是否"最先"取决于链上其他过滤器。要保证最先执行应返回 `Ordered.HIGHEST_PRECEDENCE`（`Integer.MIN_VALUE`）。

### 5. 原文未注明的环境边界

原文示例基于 Spring Cloud Gateway（WebFlux/Reactor）+ Feign（Servlet 栈）+ Apollo，未注明各组件版本；`GrayTagInterceptor` 用的是 Servlet 的 `HandlerInterceptor`，与网关侧 Reactor 栈不是同一编程模型，落地时注意两套栈的上下文机制不同（Reactor 用 Context，Servlet 用 ThreadLocal）。此条为整理者补充的工程提示，非原文内容。

## 关联本仓库资料

- 顺丰面经第 18 题（真实考过灰度与流量调度）：[灰度发布与流量调度](../../opportunity/companies/sf/2026-05-25-sf-java-backend-round1-round2.md)
- 简历专项 #232 遗留系统升级（灰度/双轨/回退是同一套发布纪律）：[Ant→Maven、Spring3→Boot、WebLogic→Undertow](../../opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)
- ThreadLocal 跨线程丢失实战记录：[多数据源上下文异步传播](../java/2026-07-27-dynamic-datasource-async-context-propagation.md)
- 配置中心动态规则下发（Nacos 推模式）：[Sentinel 限流熔断实战指南](../middleware/2026-08-07-sentinel-usage-guide.md)
- 简历 200 题自测中对应题：`content/opportunity/practice/gpt-resume-200-self-test.md` 自测 130（Gateway 灰度发布）

## 原始链接

https://mp.weixin.qq.com/s/z5h92vwE599-GeGwP8IuTg

## Sources

[1] https://mp.weixin.qq.com/s/z5h92vwE599-GeGwP8IuTg
[2] https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/InheritableThreadLocal.html
[3] https://github.com/alibaba/transmittable-thread-local
[4] https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/Ordered.html
