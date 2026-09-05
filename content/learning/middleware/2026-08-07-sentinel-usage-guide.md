---
title: "Sentinel 限流熔断实战指南：接入、规则、持久化与生产实践"
date: "2026-08-07"
domain: "学习"
area: "工程与架构"
module: "工程与架构"
project: "机会雷达"
type: "深度文章"
status: "可复习"
priority: "P1"
energy: "high"
visibility: "public"
summary: "Sentinel 完整用法：资源与 Slot 链、SphU/注解/Web 自动适配三种接入、流控/熔断/热点/授权/系统保护五类规则、Nacos 推模式持久化、控制台部署、以及阈值设定、兜底设计、同类调用失效等生产实践与坑。"
tags:
  - Sentinel
  - 限流
  - 熔断
  - 降级
  - 稳定性治理
---

# Sentinel 限流熔断实战指南

> 本文为简历专项 #238（稳定性治理）配套学习笔记，目标：看完能直接写代码、能回答面试追问、能避开生产上的主要坑。
> 版本基线：Sentinel 1.8.6 / Spring Cloud Alibaba 2.2.x。

## 一、核心概念：资源、规则、Slot 链

- **资源（Resource）**：Sentinel 保护的最小单位，一个方法、一个 URL、一段代码都可以是一个资源。所有限流/熔断/授权规则都是挂在资源名上的。
- **规则（Rule）**：流控（FlowRule）、熔断降级（DegradeRule）、热点参数（ParamFlowRule）、授权（AuthorityRule）、系统保护（SystemRule）。
- **Slot 链**：请求进入资源后按固定顺序过插槽：`NodeSelectorSlot → ClusterBuilderSlot → StatisticSlot → FlowSlot → DegradeSlot → AuthoritySlot → SystemSlot`。统计、限流、熔断、授权、系统保护都在这一条链上完成。
- **默认规则只存内存**：重启即丢。生产必须接持久化数据源（见第五节）。

一句话：**先埋资源，再挂规则，规则管行为，控制台看监控。**

## 二、依赖与初始化

```xml
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-core</artifactId>
    <version>1.8.6</version>
</dependency>
<!-- 注解 @SentinelResource 支持 -->
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-annotation-aspectj</artifactId>
    <version>1.8.6</version>
</dependency>
<!-- 对接控制台（生产按需） -->
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-transport-simple-http</artifactId>
    <version>1.8.6</version>
</dependency>
```

Spring Cloud Alibaba 项目一行依赖即可（自动带 Web MVC 适配、控制台通信、Feign 适配）：

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
</dependency>
```

```yaml
spring:
  application:
    name: order-service        # project.name，控制台按它区分应用
  cloud:
    sentinel:
      transport:
        dashboard: localhost:8080   # 控制台地址
        port: 8719                  # 应用向控制台上报的端口（默认 8719）
      eager: true                   # 启动即注册，不做懒加载（否则首次访问才注册）
```

## 三、三种接入方式

### 1. 代码埋点（SphU）—— 最灵活，适合任意代码块

```java
try (Entry entry = SphU.entry("createOrder")) {
    // 受保护的业务逻辑
    return orderService.create(req);
} catch (BlockException ex) {
    // 被限流 / 熔断 / 降级时进入这里
    return OrderResult.failed("系统繁忙，请稍后再试");
}
```

### 2. 注解（@SentinelResource）—— 最常用，适合 Service 方法

```java
@SentinelResource(
    value = "createOrder",                    // 资源名，规则都挂这个名字
    blockHandler = "createOrderBlock",        // 限流/熔断时执行
    fallback = "createOrderFallback"          // 业务异常时执行
)
public Order createOrder(OrderReq req) {
    if (!stockService.deduct(req.getSkuId())) {
        throw new BizException("库存不足");
    }
    return orderService.create(req);
}

// blockHandler：签名 = 主方法签名 + BlockException（放最后）
public Order createOrderBlock(OrderReq req, BlockException ex) {
    return Order.failed("系统繁忙，请稍后再试");
}

// fallback：签名 = 主方法签名 + Throwable（放最后）
public Order createOrderFallback(OrderReq req, Throwable t) {
    return Order.failed("服务开小差了：" + t.getMessage());
}
```

三个必知细节：

- `blockHandler` 只管 **BlockException**（限流/熔断/降级触发）；业务异常走 `fallback`。
- 两者都配时，被限流优先走 `blockHandler`。
- 方法写在其他类时用 `blockHandlerClass = XxxHandler.class`，且方法必须是 `static`。

### 3. Web/Feign/Gateway 自动适配 —— 零侵入兜底

- **Web MVC**：每个 URL 自动成为一个资源（如 `GET:/api/order`），不加注解也能限。
- **Feign**：`feign.sentinel.enabled: true` 后，被调服务触发熔断会抛 `SentinelInvocationHandler` 包装的异常，可配 `fallback` 类。
- **Spring Cloud Gateway**：`spring-cloud-alibaba-sentinel-gateway` 适配，按 route 限流。

> 注意：URL 资源会随路径参数爆炸（`/api/order/1`、`/api/order/2` 各自成资源），控制台会刷屏。**核心入口建议显式用 @SentinelResource 命名资源**，URL 自动适配只当第一道粗筛。

## 四、五类规则详解

### 1. 流控规则（FlowRule）—— 管 QPS / 并发线程数

```java
FlowRule rule = new FlowRule();
rule.setResource("createOrder");
rule.setGrade(RuleConstant.FLOW_GRADE_QPS);   // 按 QPS 限（另一个维度：FLOW_GRADE_THREAD 并发线程数）
rule.setCount(1000);                          // 阈值
rule.setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_DEFAULT); // 流控效果
FlowRuleManager.loadRules(Collections.singletonList(rule));
```

三种流控模式：

| 模式 | 含义 | 典型场景 |
|------|------|----------|
| 直接 | 资源自身超阈值就限 | 单个接口限流 |
| 关联 | 资源 A 超阈值时，限流资源 B | 写接口打满时，限读接口（保写优先） |
| 链路 | 按调用入口分别统计 | 同一方法被 A、B 两个入口调，只限 A |

```java
// 关联模式：orderWrite 超阈值时，orderQuery 被限
rule.setStrategy(RuleConstant.STRATEGY_RELATE);
rule.setRefResource("orderWrite");
```

三种流控效果（面试高频）：

| 效果 | 枚举 | 行为 | 适用 |
|------|------|------|------|
| 快速失败 | `CONTROL_BEHAVIOR_DEFAULT` | 超阈值直接抛 BlockException | 默认，绝大多数接口 |
| Warm Up 预热 | `CONTROL_BEHAVIOR_WARM_UP` | 阈值从 `count/coldFactor`（默认 3）在 `warmUpPeriodSec`（默认 10s）内爬升到 count | **活动/服务刚启动，防冷启动打爆**（令牌桶思想） |
| 匀速排队 | `CONTROL_BEHAVIOR_RATE_LIMITER` | 请求按固定速率通过，超出部分排队，`maxQueueingTimeMs`（默认 500ms）内排不上就拒绝 | **必须匀速的写操作、落库、调用下游**（漏桶思想） |

```java
// Warm Up：阈值从 333 爬升到 1000，用时 10s
rule.setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_WARM_UP);
rule.setWarmUpPeriodSec(10);

// 匀速排队：每秒放 500 个，队列最多等 2s
rule.setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_RATE_LIMITER);
rule.setMaxQueueingTimeMs(2000);
```

### 2. 熔断降级（DegradeRule）—— 管下游故障

三种熔断策略：

```java
// ① 慢调用比例：RT 超过 500ms 的请求占比 ≥ 20% 时熔断 10s（统计窗口 1s，最少 5 个请求）
DegradeRule slow = new DegradeRule();
slow.setResource("GET:/api/order");
slow.setGrade(RuleConstant.DEGRADE_GRADE_SLOW_REQUEST_RATIO);
slow.setCount(500);                // 慢调用 RT 阈值（ms）
slow.setSlowRatioThreshold(0.2);   // 慢调用比例阈值
slow.setMinRequestAmount(5);       // 触发熔断的最小请求数，防抖动误熔断
slow.setStatIntervalMs(1000);      // 统计时长
slow.setTimeWindow(10);            // 熔断时长（s）

// ② 异常比例：1s 内异常占比 ≥ 60% 熔断 10s
DegradeRule exRatio = new DegradeRule();
exRatio.setResource("GET:/api/policy");
exRatio.setGrade(RuleConstant.DEGRADE_GRADE_EXCEPTION_RATIO);
exRatio.setCount(0.6);
exRatio.setMinRequestAmount(5);
exRatio.setStatIntervalMs(1000);
exRatio.setTimeWindow(10);

// ③ 异常数：1 分钟内异常数 ≥ 100 熔断 10s（该模式统计窗口固定 1 分钟）
DegradeRule exCount = new DegradeRule();
exCount.setResource("GET:/api/claim");
exCount.setGrade(RuleConstant.DEGRADE_GRADE_EXCEPTION_COUNT);
exCount.setCount(100);
exCount.setTimeWindow(10);

DegradeRuleManager.loadRules(Arrays.asList(slow, exRatio, exCount));
```

熔断状态机（面试必答）：

```
CLOSED（关闭，正常放量）
   └─ 触发条件达成（慢调用比例/异常比例/异常数超阈值）
        ↓
OPEN（打开，快速失败，所有请求直接走 blockHandler）
   └─ timeWindow 时间到
        ↓
HALF_OPEN（半开，只放 1 个探测请求）
   ├─ 探测成功 → CLOSED（恢复）
   └─ 探测失败 → OPEN（继续熔断）
```

### 3. 热点参数（ParamFlowRule）—— 管单个参数值

场景：同一接口，普通商品 QPS 1000 没事，**爆款商品**瞬间打爆——按参数值单独限。

```java
// 资源必须用 @SentinelResource 注解的资源名；paramIdx 指第几个参数（从 0 开始）
ParamFlowRule rule = new ParamFlowRule("querySku");
rule.setParamIdx(0);              // 第一个参数（skuId）
rule.setCount(50);                // 每个参数值 QPS 上限 50
rule.setDurationInSec(1);

// 指定参数值单独设限：skuId=9527 这个爆款最多 10 QPS
ParamFlowItem item = new ParamFlowItem();
item.setObject("9527");
item.setClassType(int.class.getName());
item.setCount(10);
rule.setParamFlowItemList(Collections.singletonList(item));

ParamFlowRuleManager.loadRules(Collections.singletonList(rule));
```

```java
@SentinelResource(value = "querySku")
public Sku querySku(int skuId) { ... }
```

### 4. 授权规则（AuthorityRule）—— 黑白名单

```java
AuthorityRule rule = new AuthorityRule();
rule.setResource("createOrder");
rule.setStrategy(RuleConstant.AUTHORITY_WHITE);  // AUTHORITY_BLACK 为黑名单
rule.setLimitApp("inner-app,backoffice");        // 来源白名单
AuthorityRuleManager.loadRules(Collections.singletonList(rule));
```

来源从请求里解析，需要实现 `RequestOriginParser`：

```java
@Component
public class OriginParser implements RequestOriginParser {
    @Override
    public String parseOrigin(HttpServletRequest request) {
        return request.getHeader("S-Origin");   // 网关透传的调用方标识
    }
}
```

### 5. 系统保护（SystemRule）—— 管整机水位

```java
SystemRule rule = new SystemRule();
rule.setHighestSystemLoad(10.0);   // 系统 LOAD1 超过 10 触发（Linux 生效）
rule.setHighestCpuUsage(0.8);      // CPU 使用率超过 80% 触发
rule.setAvgRt(500);                // 入口平均 RT 超过 500ms 触发
rule.setMaxThread(5000);           // 入口并发线程数超过 5000 触发
rule.setQps(20000);                // 入口 QPS 超过 2 万触发
SystemRuleManager.loadRules(Collections.singletonList(rule));
```

系统保护是**兜底**：前面所有规则都没拦住、机器要被打垮时，按整机水位限流入口流量。

## 五、规则持久化（生产必配）

规则在内存里重启就丢，等于裸奔。生产标准做法：**Push 模式——控制台改规则 → 推给 Nacos → 应用监听 Nacos 实时更新**。

```java
@Configuration
public class SentinelNacosConfig {

    @PostConstruct
    public void init() {
        String serverAddr = "localhost:8848";
        String groupId = "SENTINEL_GROUP";

        // 流控规则数据源
        ReadableDataSource<String, List<FlowRule>> flowDs = new NacosDataSource<>(
            serverAddr, groupId, "order-service-flow-rules",
            source -> JSON.parseObject(source, new TypeReference<List<FlowRule>>() {})
        );
        FlowRuleManager.register2Property(flowDs.getProperty());

        // 熔断降级规则数据源
        ReadableDataSource<String, List<DegradeRule>> degradeDs = new NacosDataSource<>(
            serverAddr, groupId, "order-service-degrade-rules",
            source -> JSON.parseObject(source, new TypeReference<List<DegradeRule>>() {})
        );
        DegradeRuleManager.register2Property(degradeDs.getProperty());

        // 热点参数 / 授权 / 系统保护同理：
        // ParamFlowRuleManager / AuthorityRuleManager / SystemRuleManager
    }
}
```

要点：

- 控制台选择"推模式"后，修改的规则会持久化到 Nacos，应用实时生效，重启不丢。
- 规则 JSON 里 `resource` 必须与应用内 @SentinelResource 的资源名完全一致。
- 应用启动时 Nacos 不可用，规则加载失败会**静默降级为无规则**——要监控数据源健康状态，或用本地文件数据源（FileDataSource）做兜底。

## 六、控制台部署

```bash
# 下载 sentinel-dashboard-1.8.6.jar，启动（默认 8080）
java -Dserver.port=8080 \
     -Dcsp.sentinel.dashboard.auth.username=sentinel \
     -Dcsp.sentinel.dashboard.auth.password=sentinel \
     -jar sentinel-dashboard-1.8.6.jar
```

应用侧（或 yml 里 `spring.cloud.sentinel.transport.dashboard`）：

```bash
java -Dcsp.sentinel.dashboard.server=localhost:8080 \
     -Dproject.name=order-service \
     -jar order-service.jar
```

- 控制台功能：实时监控（QPS/RT/线程数曲线）、规则管理（在线改规则）、机器列表。
- **生产上控制台只建议内网部署 + 权限控制**；监控数据长期留存、告警对接建议用应用自身埋点接 Prometheus/Grafana 或 ELK，控制台不适合当生产监控主源。

## 七、与 #238 稳定性治理串起来的实践套路

面试口述时把 Sentinel 放进完整的稳定性方案里讲：

1. **阈值怎么定**：压测打出来的（单机压测 → 全链路压测），先按历史峰值 × 1.5 冗余放量，运行两周看误限次数再收紧。拍脑袋定阈值 = 面试送分变送命。
2. **每个被限流的入口必须有兜底**：快速失败也要返回可读提示（"系统繁忙"）、或降级到缓存数据、或引导人工客服。限流不等于让用户体验断裂。
3. **冷启动用 Warm Up**：活动开始流量突增，直接满阈值容易误伤刚启动的实例。
4. **熔断期间禁止重试**：OPEN 状态快速失败，等 HALF_OPEN 探测成功再放量；下游恢复前疯狂重试会雪上加霜。
5. **Sentinel 管"入口"，线程池隔离管"内部"**：限流只是不让流量进来，线程池隔离是防止内部一个慢任务占满线程池拖垮其他接口——两者配合不是二选一。
6. **规则变更要有审计**：谁在什么时候改了哪个资源的阈值，控制台 + Nacos 要能追溯。

## 八、常见坑清单（面试可主动讲）

| 坑 | 说明 | 解法 |
|----|------|------|
| 规则重启丢失 | 默认内存态 | Nacos/文件数据源持久化，启动校验规则非空 |
| 同类内部调用注解失效 | `this.method()` 不走 Spring 代理 | 注入自身代理、或拆到别的 Bean、或改 SphU 埋点 |
| blockHandler 和 fallback 混用 | 限流走 blockHandler，业务异常走 fallback，二者签名都要符合规范 | 都配，且方法签名带 BlockException/Throwable |
| URL 资源爆炸 | Web 自动适配把带参 URL 各自成资源 | 核心入口显式 @SentinelResource 命名 |
| 线程数限流误用 | `FLOW_GRADE_THREAD` 是对并发线程数兜底，不是主限流手段 | 主用 QPS，线程数维度做系统保护 |
| 熔断阈值拍脑袋 | RT 阈值定太低会频繁误熔断 | 用 P99 压测数据定 RT 阈值，加 minRequestAmount 防抖动 |
| 单机阈值 × 机器数 ≠ 集群容量 | 流量倾斜时某台先被打爆 | 按最差单机容量设阈值，或上集群流控（Token Server） |
| 异步线程 Entry 丢失上下文 | 异步中直接 SphU.entry 不统计到原链路 | 用 AsyncEntry + Context 传递 |
| 控制台当生产监控 | 控制台是运维面板，数据不长期留存 | 监控告警走 Prometheus/ELK |

## 九、面试一句话总结

> Sentinel 是阿里开源的**轻量级高可用流量防护组件**，核心是"资源 + 规则"模型：用 SphU/注解/自动适配把代码埋成资源，挂上流控、熔断、热点、授权、系统保护五类规则；默认滑动窗口计数限流，Warm Up 是令牌桶思想防冷启动，匀速排队是漏桶思想保写链路；规则必须接 Nacos 持久化；它解决的是**入口流量治理**，和线程池隔离、异步化、监控告警一起构成稳定性治理的完整闭环。
