---
title: "从 Cordis 到 Java：动态加载与动态流程的架构设计"
date: "2026-09-15"
domain: "专栏"
area: "技术"
module: "架构设计"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "以 Cordis 的时空可组合性思想为蓝本，把「可逆效应」与「反应式依赖」两个运行时原语落到 Java：给出动态加载与动态流程（流程=可组合数据）的架构设计、代码走读与 10 个场景的实测输出。"
tags:
  - Java
  - 架构设计
  - Cordis
  - 插件系统
  - 动态加载
---

# 从 Cordis 到 Java：动态加载与动态流程的架构设计

> 本文基于 Cordis 官方材料与论文《A Programming Paradigm for Spatiotemporal Composability》（arXiv:2608.25512，北京大学 + DeepSeek-AI）整理，并给出一个已实测的 Java 原型设计。Cordis 处于活跃开发中、API 尚未稳定，本文语义以论文和官方入门/教程为准；原型用于语义验证，未做生产化加固。

---

## 一、问题：为什么需要「能拆装」的架构

静态组合（函数调用、import、类继承）在编译期定型；而插件系统、自演化 agent 系统需要**运行时**的加载、卸载与重配置。现有工程手段粒度太粗：

- **VSCode 扩展**（论文统计）：Top 100 扩展中 87 个含可执行代码，卸载任一都需重启整个 extension host；`extensionDependencies` 仅 7 个扩展在用，跨扩展交互无类型契约；deactivate 钩子只是宿主进程终止时的优雅关闭回调，不支持活体移除。
- **操作系统 / 容器编排**：进程粒度、服务粒度的「粗粒度替代」——代价是丢进程内状态、网络开销、粒度错位（同一地址空间内的组件依赖无法表达）。

Cordis 把问题拆成两个正交维度：

| 维度 | 含义 | 需要什么 |
|---|---|---|
| **时间可组合性**（temporal） | 组件被移除时，它对共享环境做过的全部修改必须完整、安全地逆转 | 追踪每一次资源分配/注册/状态修改，并保证有序回收 |
| **空间可组合性**（spatial） | 组件之间的依赖能被声明、发现、结构化解决 | 管理依赖拓扑 + 依赖变化时协调生命周期 |

## 二、Cordis 是什么

Cordis 自述为 **"A Meta-Framework of Spatiotemporal Composability"**（时空可组合性元框架）。它处于活跃开发中、API 尚未稳定，官方文档仍在建设中——目前最权威的说明是论文与随附入门/教程。工程背景上，它是 DeepSeek Harness 底层以 vendor 方式引入的插件框架；论文以 Koishi（基于 Cordis 的开源聊天机器人框架）为生产案例（Koishi 当前使用 v3，论文描述的是 v4）。

### 五个核心概念

1. **插件（Plugin）**——一切能力都是插件：可以是带 `inject` / `apply(ctx)` 的函数，也可以是 Service 子类，生命周期由框架挂载到当前上下文。
2. **上下文（Context）**——服务的容器：每个服务占据一个稳定的 `ctx.xxx`（如 `ctx.tools`、`ctx.llm`、`ctx.sessions`）；插件按 key 查找服务，而不是 import 具体实现。
3. **inject 依赖声明**——插件声明所需服务后，**等待其就绪才启动**；加载顺序由依赖表达，而非手工编排启动序列。
4. **类型化事件通信**——服务注册事件名后，以五种分发模式之一分发（见下表）。
5. **注册是可逆的副作用**——提示词片段、工具 schema、适配器、提供方、监听器通过 `ctx.effect()` / `ctx.on()` 安装；reload 和 teardown 时会自动撤销。

### 事件分发模式

每个事件只能通过对应方法分发：

| 模式 | 是否 await | 分发顺序 | 是否有返回值 |
|---|---|---|---|
| `emit` | 否 | 监听器按注册顺序观察 | 无 |
| `waterfall` | 否 | 按注册顺序，可包装下游返回值 | 有 |
| `parallel` | 是 | 所有监听器并行 | 无 |
| `serial` | 是 | 按注册顺序 | 有 |
| `bail` | 否 | 按注册顺序，直到某监听器返回 bail 值 | 有 |

**waterfall 是环绕中间件**：监听器收到 `(...args, next)`；调用 `next()` 执行下游并拿回其返回值，包装后继续外传；不调用 `next()` 直接返回即短路。仅当监听器必须在普通注册之前运行时才用 `prepend: true`。

**Loader**：配置文件（`cordis.yml`）声明插件树，Loader 负责装载与配置校验，配置值在依赖激活后基于插件上下文插值；支持配置协调（configuration reconciliation）与热模块替换（HMR）。

## 三、形式化地基：可逆效应与反应式共效应

论文把「效应系统」和「共效应系统」从一个编译期分析工具**提升为运行时机制**：

- **可逆效应（revertible effects）**：每一次上下文变换都携带一个「逆」，由运行时持有；追踪与恢复都保复合——组件移除时上下文可恢复初始态（局部时间可组合性）。
- **反应式共效应（reactive coeffects）**：组件以「规约」声明依赖；每一次上下文变化都被分类为 **activating / deactivating / neutral**，以此驱动组件的激活与去激活（局部空间可组合性）。
- **上下文范式（context paradigm）**：把效应上下文与共效应上下文统一为单一 context 类型，一切效应与共效应都经它中介；该中介诱导出一种**观察等价**——不同组件的效应可以安全交错、互不扰动。
- **动态组合演算**：以组件（component）/ fiber（一次实例化）为核心，给出编排（insert / retire / remove）、生命周期（begin / iter / finish / leave / unload）、守卫（guard / Divert）等规则的算子语义；元理论把时空可组合性从单个组件推广到整个交错组件系统。

## 四、落到 Java：为什么不能只用 Spring

Spring 已提供 IoC、Bean 生命周期钩子（`@PostConstruct`/`@PreDestroy`、`AutoCloseable`）、应用事件、父子上下文。但 Spring 不提供（这正是 Cordis 论文针对的缺口）：

- **单个插件独立卸载**——Bean 一旦被注入，依赖者仍持有引用，无法安全「拔插」；
- **provider 变化后的自动重载**——没有「依赖满足性」概念，更不会级联激活/去激活；
- **任意注册的逆序撤销**——监听器/工具/路由这类动态注册需要显式 disposer 纪律，容器只能管住一部分；
- **装载失败的回滚**——半装载状态无法自动恢复。

设计选择：**Spring 做普通 DI 基座 + 一层薄运行时实现 Cordis 语义**；或者像原型一样全部自研（适合流程平台类从零起步的场景）。原型的关键映射：

| Cordis 概念 | Java 原型抽象 | 说明 |
|---|---|---|
| 上下文 context | `EffectContext` | 承载「共效应存取 + 逆累加器」；`derive()` 派生子上下文 |
| 共效应键 | `ServiceKey<T>` | 类型化 token；**相等性按名字**（跨 ClassLoader 对齐，为热加载留路） |
| 组件 (d, p, e) | `Component` | `inject()` 声明依赖 / `provide()` 声明可装键 / `apply()` 效应迭代器 |
| fiber（实例） | `Fiber` | 状态机：INACTIVE → RELOADING → ACTIVE → UNLOADING → INACTIVE（+FAILED） |
| 注册表 + 编排 | `CtxRuntime` | `use` / `retire` / `remove`、notify 传播、refresh 不动点 |
| 可逆效应 | `ctx.effect(action) → dispose` | 执行变换、拿到逆；逆**前置**进累加器（LIFO），并冒泡到父上下文 |
| 反应式依赖 | `isSatisfied()` + `notifyDependents()` | 每次键变化对相关 fiber 重新分类（激活 / 去激活 / 中性） |
| 顺序守卫 | `deactivate()`：先级联依赖者、后恢复自身 | 拆除期间，依赖者仍能读到自己依赖的绑定 |

原型聚焦语义验证，未覆盖原版的 Loader/HMR、上下文隔离（isolate）与拦截（intercept）、事件系统、并发编排与持久化——这些属于生产化范围，后面单独讨论。

## 五、动态加载的三条机制

1. **装载 ≠ 激活**。`use(name, component)` 只是注册 fiber（初始 INACTIVE）；随后按「依赖是否全部由 ACTIVE provider 提供」（满足性谓词）决定是否激活——**这就是「加载顺序不用人工编排」的原因**：依赖就绪即自动激活。
2. **卸载是「先拔依赖者、再撤提供者」的级联**。`retire(name)` 后：递归去激活依赖本 fiber 的组件 → 应用本 fiber 的逆累加器（全部注册依次回退）→ 清空绑定。**顺序守卫**保证依赖者在拆除过程中仍能读到依赖（实测：`拆除期间仍可读到网关: true`）。
3. **替换 provider = retire + use**。旧 provider 下线（依赖者级联变 INACTIVE）→ 新 provider 上线 → 依赖者自动恢复（实测：支付宝 → 微信支付热替换，流程不停）。另外，**装载中途失败自动回退**：`apply` 抛异常 → FAILED + 恢复已装部分 + provider 注销，不留半个绑定。

## 六、动态流程：把流程变成可组合的数据

```java
interface PipelineStep { int order(); String name(); void execute(Order o, List<String> out); }
```

- 每个流程节点是一个**组件**：激活时把自己 `register` 进管线引擎（**注册 = 可逆副作用**，卸载时自动摘除）；
- 管线引擎本身也是组件（提供 `order.pipeline` 服务），步骤通过 `inject` 依赖它；
- 步骤间的可选依赖直接用 `inject` 声明——例如「VIP 支付」依赖「支付网关」；网关不在时它保持 INACTIVE（**节点级的优雅降级**）；
- 加载或卸载任意步骤组件，**执行流程实时变化**：`[预留库存, VIP 支付, 发送通知]` ⇄ `[预留库存, VIP 支付]`。

映射到真实业务：审批流节点、风控规则链、数据管道算子、Agent 工具链——都是「可插拔步骤 + 声明式依赖 + 卸载即回退」的同类问题。

## 七、原型走读与实测输出

原型共 6 个 Java 文件、约 680 行（含注释）：5 个运行时文件 + 1 个订单管线演示。要点：

- **`ServiceKey`**：只存名字、按名字判等——同名即同键，为跨 ClassLoader 热加载对齐；泛型参数只承载静态类型。
- **`Component`**：`inject()` / `provide()` / `apply(ctx, guard)` 三元组；`guard` 是迭代边界守卫，每步之前检查，false 即停并只保留已积累的逆。
- **`EffectContext`**：`.effect(action)` 执行变换、拿到逆、**前置**进累加器（LIFO），并冒泡到父上下文；`set/get` 走 `effect` 因而自动可逆；`get` 带**声明检查**（未声明就读 → `UNDECLARED_ACCESS`）；`recover()` 正序执行即逆序撤销。
- **`Fiber`**：实例状态机 + retiring 标志 + 自己的子上下文。
- **`CtxRuntime`**：`use` 查重后建 fiber 并触发全量 refresh（迭代到不动点）；`refresh` 用满足性谓词决定 activate / deactivate；`deactivate` 先递归去激活依赖者（顺序守卫）再恢复自身；状态迁移全程打日志（L-Begin / L-Finish / L-Leave / L-Unload / FAILED）。

关键片段（`EffectContext.effect`，LIFO + 幂等）：

```java
public Runnable effect(EffectAction action) throws Exception {
    final boolean[] armed = {true};
    Runnable inverse = action.run(this);          // 正向变换，拿到逆
    Runnable dispose = () -> {                    // 幂等包装
        if (!armed[0]) return; armed[0] = false; inverse.run();
    };
    accumulator.add(0, dispose);                  // 前置 => LIFO
    if (parent != null && parent.owner != null) { // 冒泡到父上下文
        parent.accumulator.add(0, dispose); bubbled.add(dispose);
    }
    return dispose;
}
```

> 一个值得记录的编译花絮：首轮 `javac` 暴露了 5 处 `ServiceKey<Object>` 泛型标注不当的问题（`get()` 无法类型推断）；改为 `ServiceKey<Gateway>` / `ServiceKey<Pipeline>` 后即通过——这正是「类型化键」价值的直接体现。

**实测输出（节选）**，10 个场景全部通过：

```text
== 2. 声明了依赖但网关缺席：步骤保持 Inactive ==
  registry: engine(ACTIVE) step-vip(INACTIVE) | store keys: [order.pipeline]

== 3. 网关上线：step-vip 自动激活并注册（反应式） ==
  L-Begin step-vip (insert:gw-alipay)
    (step) VIP 支付 已注册 (order=30)

== 4. 再装载两个步骤：流程实时变长 ==
    当前流程: [预留库存, VIP 支付, 发送通知]

== 5. 运行一单 ==
    > 库存已预留: SO-2026-0915
    > 支付宝 扣款成功:SO-2026-0915 ¥129.0
    > 通知已发送: SO-2026-0915

== 6. 卸载通知步骤：注册的副作用完好回退 ==
    当前流程: [预留库存, VIP 支付]

== 7. 网关下线：依赖它的 step-vip 级联去激活（顺序守卫） ==
    (step) VIP 支付 注销中——拆除期间仍可读到网关: true

== 8. 换一个网关配置重装（配置协调 = 替换 provider） ==
    > 微信支付 扣款成功:SO-2026-0916 ¥99.0

== 9. 组件内异常：装载到一半失败自动回退（FAILED + recover） ==
  FAILED bad-plugin: 装载到一半失败

== 10. 最终检查：卸载全部 ==
  registry: engine(INACTIVE) … | store keys: []
演示完毕。store 残留: []
```

## 八、落地建议

**路线选择**（从小到大）：

1. **全自研轻量 Runtime**（像本原型）：语义完整、可控，适合流程平台 / 规则引擎从零起步；代价是并发、持久化、可观测性都要自己补。
2. **Spring 基座 + 薄语义层**（推荐起点）：普通服务交给 Spring；需要动态性的模块走自研 Runtime（可逆注册 + 反应式依赖）；两者用适配器桥接。
3. **JAR 级动态加载**：需要「换 jar 不重启」时，评估 OSGi / PF4J 或进程隔离；JDK `ServiceLoader` 只解决静态发现。注意：JVM 的类卸载依赖 ClassLoader 回收（老 ClassLoader 不被引用才能 GC），这是 HMR 最硬的边界。

**生产化注意事项**：

- **幂等**：所有 disposer 必须幂等（原型的 `armed` 守卫是范例）；
- **循环依赖**：refresh 需要「不动点 + 上限守卫」（原型 100 轮封顶防死循环）；
- **线程与资源归属**：线程池、定时器、连接必须纳入逆累加器统一回收，否则「卸载干净」是假的；
- **可观测性**：状态迁移日志是最好的排障材料。

## 九、复现与参考

原型为 6 个 Java 文件（`src/cordis/` 五个 + `src/demo/DemoMain.java`），编译运行（JDK 17）：

```bash
mkdir -p build
javac -encoding UTF-8 -d build src/cordis/*.java src/demo/*.java
java -Dfile.encoding=UTF-8 -cp build demo.DemoMain
```

参考：

- 论文：*A Programming Paradigm for Spatiotemporal Composability* — arXiv:2608.25512（https://arxiv.org/abs/2608.25512）
- 仓库：https://github.com/cordiverse/cordis （README 极简：API 未稳定、文档建设中）
- 官方入门 / 教程：DeepSeek Harness 文档站（`reference/cordis-primer`、`develop/cordis-tutorial`；cordis-api 参考页当前未部署）
- Spring 文档：`docs.spring.io/spring-framework/reference/core/beans/`（basics / context-introduction / factory-nature）
- JDK ServiceLoader：`docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ServiceLoader.html`
