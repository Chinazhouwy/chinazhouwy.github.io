---
title: "DSH：DeepSeek Harness 架构解析"
date: 2026-08-14
domain: "学习"
area: "AI Agent"
module: "Agent 工程与源码"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
lane: agent
summary: "以运行时插件图和追加式 Session 事件流为主线，整理 DeepSeek Harness 如何用 Cordis 组合模型、工具、会话、沙箱和 Agent loop，并区分原文源码分析、官方资料与尚未独立复现的结论。"
tags:
  - Agent
  - Harness
  - DeepSeek
  - Cordis
  - Agent Runtime
  - Session
  - Tool Calling
  - 插件系统
source: "微信公众号「浮之静」"
source_url: "https://mp.weixin.qq.com/s/Kf87hcNdSmY4ODWI4UZ8cg"
published_at: "2026-08-14 11:09:44 +08:00"
---

# DSH：DeepSeek Harness 架构解析

> **类型**：技术文章整理（非面试题 / 面经）
>
> **原文标题**：DSH：DeepSeek Harness 架构解析
>
> **来源**：微信公众号「浮之静」
>
> **发布时间**：2026-08-14 11:09（北京时间）
>
> **原文链接**：<https://mp.weixin.qq.com/s/Kf87hcNdSmY4ODWI4UZ8cg>
>
> **整理说明**：本文不是逐段搬运，而是把原文的源码分析重组为学习笔记。原文以固定源码快照为分析对象；本文用 DSH 官方 README、官方架构文档、Cordis 官方仓库和论文摘要核对能核对的事实。原文中的跨项目比较、评测数字和特定快照行为，未独立复现的部分明确标注。

## 一句话结论

**DSH 的核心不是“有很多工具”，而是把 Harness 自身也变成一棵可以组合、替换、观察和卸载的运行时插件树。**

可以把它拆成两条同时运行的线：

```text
Cordis runtime graph
  现在有哪些能力？谁依赖谁？在哪个作用域生效？卸载如何清理？

Session event stream
  这次 Agent 做过什么？怎样恢复、分叉、压缩和投影给模型？

Agent loop
  从运行图取得能力，把执行过程写回事件流。
```

原文把这句话说得很准确：**Cordis 解决“系统现在由什么组成”，Session 解决“系统刚才做过什么”。**[1] DSH 官方也明确把自己定义为基于 Cordis 的 “everything-is-a-plugin” agent harness。[2]

## 1. 先确认 DSH 处在什么位置

DeepSeek Harness（简称 DSH）不是一个单独的模型，也不是只负责循环调用模型的 Agent loop。官方 README 将它描述为 DeepSeek AI 开源的 agent harness，并说明它建立在 “everything-is-a-plugin” 架构和 Cordis 之上。[2]

因此，DSH 试图插件化的不只是工具，还包括：

- 模型适配器；
- 系统提示词和工具目录；
- Session 日志与持久化；
- 沙箱、审批和执行能力；
- Agent loop；
- Web UI 与不同运行模式。

这带来一个重要区别：普通 Agent 项目往往把 loop 当作核心、把工具当作外围扩展；DSH 则把 loop、Session、模型、工具和 UI 都放到同一套插件组合机制中。[1][3]

### 当前状态边界

DSH 官方 README 明确标记为 **developer preview**，并警告会有兼容性破坏变更。[2] Cordis 官方仓库也说明 API 仍在开发中、尚不稳定。[4]

所以阅读 DSH 源码时，应该区分三种结论：

| 结论类型 | 写法 |
|---|---|
| 官方 README / 架构文档明确写出的设计 | 可以作为当前官方架构事实 |
| 对某个源码快照的阅读 | 写明快照或版本范围，不泛化成永久 API |
| 原文作者的比较、推测和评测数字 | 保留为“原文分析/原文声称”，不当作独立验证结果 |

## 2. 两套系统：运行时插件图与追加式事件流

### 2.1 Cordis 维护“现在的系统”

Cordis 运行时图描述当前系统由什么组成：

- 哪些插件已经挂载；
- 每个插件能看到哪些 service；
- 哪些依赖尚未满足；
- 哪些能力只在某个 Context / realm 中生效；
- Provider 替换后哪些 Consumer 需要重载；
- 插件卸载时哪些注册、监听器、进程和句柄需要回收。

DSH 官方架构文档把运行中的 `dsh` 描述为由有序层组合出来的 plugin tree；每一行配置最终对应一组可挂载、可替换的运行时对象。[3]

### 2.2 Session 维护“已经发生的事”

Session 不是当前 service 图的副本，而是追加式事件流。它记录：

- turn / step 边界；
- 用户消息、模型消息和工具调用；
- 流式输出及最终落定结果；
- 压缩、恢复和分叉所需的历史事实。

官方架构文档把 Session log 视为模型上下文的来源，并提出 **Model-visible means logged**：任何真正进入模型请求的输入，都应该能从日志重建。[3]

这解释了为什么“完整记录”和“完整发送”不是一回事：磁盘上的事件可以很完整，但 `deriveMessages()` 只把当前请求需要的消息投影给模型。

### 2.3 Agent loop 是中间层

Agent loop 从插件图读取：

```text
ctx.sessions
ctx.systemPrompt
ctx.tools
ctx.agents
ctx.agentLoop
ctx.llm
```

然后执行一次 turn：读取输入、组装 prompt 和工具 schema、调用模型、执行工具、写回事件，再判断是否需要下一个 step。官方架构文档把这些 service 和 turn flow 都列为核心扩展边界。[3]

简化后是：

```text
turn/start
  → 领取输入
  → 组装 prompt + tool schemas
  → agent/pre-step
  → step/start
  → agent/request → llm/stream
  → tool/call → tools/pre-execute → tools/execute → tools/post-execute
  → tool/result
  → step/end
  → 仍有后续工作则进入下一 step
  → agent/turn-stopping
  → turn/end
```

因此，Agent loop 不是孤立的 `while` 循环，而是一个依赖 Session、Prompt、Tool、LLM 和 Agent Registry 的插件。

## 3. 从配置到运行图：Bundle、Profile、Patch

DSH 启动时不是直接 `new Agent()`，而是从多层配置生成最终插件树。

### 3.1 三个配置概念

| 概念 | 作用 |
|---|---|
| Bundle | 分发一组 Cordis 配置行和它们挂载的插件代码 |
| Profile | 决定一个进程堆叠哪些 Bundle |
| Patch | 按配置行 id 替换整行配置，或插入新的配置行 |

官方架构文档给出的层叠顺序是：先应用 Profile 中按顺序列出的 Bundle，再应用 Profile 自己的 patch、Harness home 下的 patch，最后应用命令行 `--patch` 覆盖。[3]

因此：

```text
源码 import 图 = 可能加载什么
最终配置树   = 这台机器实际会挂载什么
```

排查启动问题时，`dsh --profile web --dump-config` 比只读 import 图更接近真实运行状态；官方文档明确把它作为查看最终树的入口。[3]

### 3.2 一个简化的文件系统例子

原文用 minimal preset 的文件系统组合说明 Provider / Consumer 关系。压缩后可以写成：

```yaml
- id: filesystem
  name: cordis:group
  group: true
  isolate:
    fs: true

- id: editor
  name: '@deepseek-ai/dsh-tool-str-replace-editor'
  inject: [tools, fs]
  config:
    maxOutputChars: 16000

- id: fs-provider
  name: '@deepseek-ai/dsh-fs-local'
  config:
    cwd: process.cwd()
```

这里 `editor` 是 Consumer，`fs-provider` 是 Provider；`editor` 依赖 `tools` 和 `fs`，在依赖未满足时不应进入活跃状态。`isolate.fs: true` 则把 `fs` 放进这棵子树自己的 service realm，避免不同作用域的同名服务互相覆盖。[1]

这段 YAML 只声明期望拓扑，不负责完整的退出逻辑。Provider 和 Consumer 仍需要在代码中通过 `effect`、`provide`、事件监听等方式登记清理动作；插件卸载时，运行时才能回收这些副作用。[1][5]

## 4. Cordis 的四个运行时概念

论文把问题概括为两个正交方向：**temporal composability**，组件移除时完整撤销副作用；**spatial composability**，组件声明依赖并反应式管理组件间关系。[5]

DSH 中的 Context、Service、Fiber 和 effect，正是把这两个方向落到运行时的主要对象。

### 4.1 Context：能力可见性的边界

Context 不只是一个 service map。它还携带：

- 父子作用域关系；
- 当前可见的 service；
- realm 隔离；
- 当前 Fiber；
- 依赖声明和 effect 所有权。

子 Context 默认可以继承父级 service，`isolate` 可以为某个 service 建立独立 realm。于是两个会话都访问 `ctx.tools` 时，可以得到不同的工具目录。

这是一种依赖约束，不等于安全边界。未注入 `fs` 不代表同进程 JavaScript 插件在操作系统层面就失去了文件访问能力；真正的权限边界仍需沙箱、进程、容器或其他执行隔离。[1]

### 4.2 Service：可替换能力的 seam

一项可替换能力通常有三个角色：

```text
Service Definition   定义接口和公共语义
Service Provider     提供本地、远程、沙箱或测试实现
Consumer             通过当前 Context 使用能力
```

例如文件系统、子进程、模型适配器都可以成为 capability seam。替换 Provider 时，Consumer 不应该直接绑定实现类，而应该依赖稳定的 service 名称和接口。

官方架构文档也用“Definition / Provider / Consumer”描述可替换能力，并说明文件系统和子进程可以共享同一个 execution world；切换到远程 sandbox 时，多个相关能力可以一起切换。[3]

### 4.3 Fiber：一次插件挂载的运行实例

Plugin 是可复用定义；Fiber 是这个定义在某个父 Context、某份配置和某组依赖下的一次实际运行实例。

Fiber 需要记录：

- 父 Context 与当前 Context；
- 插件配置和 `inject` 依赖；
- 当前解析到的 Provider；
- 加载、活跃、卸载等生命周期状态；
- 当前运行期间登记的 disposer。

因此，Provider 出现、消失或替换时，运行时不是简单地改一个全局变量，而是重新计算相关 Fiber 的依赖状态，必要时卸载 Consumer，再以新的绑定重载。

### 4.4 effect：副作用归属与回收

插件加载常常会产生：

- 注册项；
- 事件监听器；
- 定时器；
- 文件句柄；
- 后台进程；
- 外部 backend 的连接。

理想的写法是把资源获取和清理写在同一个 effect 中：

```ts
export const inject = ["storage"]

export function apply(ctx, config) {
  const backend = new JsonStorageBackend(config.root)

  ctx.effect(() => {
    const unregister = ctx.storage.backend.register("json", backend)

    return async () => {
      unregister()
      await backend.close()
    }
  })

  ctx.provide("storageBackend:json", backend)
}
```

这样，插件卸载时不需要另外维护一份散落的 `deactivate()` 清单；effect 保存的是这次挂载产生的逆操作。[1][5]

但“可逆”不等于“事务回滚”：

- 未登记的进程和句柄不会自动消失；
- 已经发送到外部系统的消息不会凭空撤回；
- 共享文件写入和支付等外部副作用需要幂等、补偿或事务协议；
- 多个顶层 effect 的清理顺序不能想当然地理解成一条严格串行 LIFO 栈。

## 5. Event 与 Loader：让运行图持续变化

### 5.1 Event 不是一种广播方式

原文把 Cordis 的事件行为分成几类：

| 类型 | 语义 | 适用场景 |
|---|---|---|
| `emit` | 同步通知监听器，忽略返回值 | 状态变化通知 |
| `parallel` | 并发执行并等待全部监听器 | 独立异步观察者 |
| `serial` | 顺序执行，遇到有效结果可停止 | 有优先级的决策 |
| `bail` | `serial` 的同步版本 | 快速同步决策 |
| `waterfall` | 监听器通过 `next()` 包裹剩余链路 | 请求、模型流、工具中间件 |

DSH 用 waterfall 处理 agent/pre-step、agent/request、llm/stream 和工具执行前后扩展点；`agent/turn-stopping` 使用 serial。官方架构文档也明确区分了 Session events、Agent events 和 Capability events。[1][3]

### 5.2 Loader 是配置 reconciler

Loader 把配置 Entry 变成 Fiber：

```text
配置树发生变化
  → 找出新增、修改、禁用和删除的 Entry
  → 创建、更新、卸载或重载对应 Fiber
  → 让运行中的插件图向期望状态收敛
```

所以 `cordis.yml` 不只是“给固定程序填参数”，而是在声明：

- 装哪些插件；
- 插件挂在哪个父节点；
- 使用哪份配置；
- 哪些 service 建立新 realm；
- 哪些组合在当前 Profile 启用。

DSH 的 HMR 和 patch 机制属于这条配置到运行图的路径。具体模式是否开启 HMR，应以对应 Profile 的当前配置为准，不能把论文中的 HMR 目标自动当成每种 DSH 模式都已完整支持。[1][3]

## 6. Session 与 Agent loop 的事件边界

DSH 的事件至少可以分成三类：

| 事件类型 | 是否持久化 | 作用 |
|---|---|---|
| Session events | 是 | 作为恢复、分叉、投影和审计的事实 |
| Agent events | 通常是运行期扩展点 | 携带 live Agent，观察或拦截进行中的工作 |
| Capability events | 视能力而定 | 在 `fs/*`、`tools/*`、`telemetry/*` 等 seam 上挂策略和适配器 |

官方架构文档明确指出：Session events 是追加到日志并在 `session/event` 广播的 durable facts；Agent events 负责 inbox、step、status、request、validation 和 continuation；Capability events 则附着在能力 seam 上。[3]

### 一次 turn 的最小理解

```text
一次 turn
  ├── 0..n 个 step
  ├── 每个 step = 1 次模型请求 + 其工具执行
  └── 没有待处理工作后 turn 才结束
```

这比“调用一次模型就是一次任务”更准确：工具结果可能驱动下一次 step；重试可能让同一个 step 发起多次 Provider 请求；被拒绝的输入可能只留下 turn 边界而没有模型 step。[3]

### Model-visible means logged

任何进入模型请求的内容，都应该能从 Session log 重建：

- 用户消息；
- 系统提示词的有效投影；
- 工具 schema；
- 已提交的 assistant 内容；
- 工具调用和结果；
- compaction 后仍对模型可见的替代节点。

这条约束的意义是：模型上下文不是某个内存数组的偶然结果，而是可以从持久事实重新投影出来的状态。[3]

## 7. Profile、Preset 与产品模式不要混为一谈

原文用 standard、code、minimal、cordis 讨论 Agent preset；官方架构文档列出的进程级 Profile 则包括 `web`、`headless`、`sdk`、`sdk-minimal` 和 `acp`。[1][3]

因此至少要区分两条轴：

```text
Runtime Profile
  决定整个进程以 Web、Headless、SDK 或 ACP 等方式启动

Agent Preset
  决定某个会话看到的工具、提示词、局部 service 和行为组合
```

这能避免一个常见误解：四种 Agent preset 不一定代表四个互斥的进程；一个 Web 进程可以承载不同 preset 的会话。具体名称和组合仍然绑定 DSH 版本，不能脱离源码快照写成稳定公共 API。[2][3][4]

## 8. 原文比较的阅读方法

原文把 Pi、OpenClaw、Hermes-Agent、Codex 和 DSH 放在一起比较，核心不是比较工具数量，而是比较 Harness 把边界放在哪里：

| 方向 | 更关注的边界 |
|---|---|
| Pi | 简短、直接的 Agent 内环 |
| OpenClaw | Gateway、渠道和产品集成 |
| Hermes-Agent | Memory、Skills 和长期运行能力 |
| Codex | Thread / Turn / Item 与 typed app-server |
| DSH | 插件拓扑、作用域、生命周期和 Session 事件流 |

这是来源文章的架构分析，不是这些项目共同认可的官方分类；本文不把它写成排行榜或兼容性结论。[1][unverified]

更稳妥的比较问题应该是：

1. 一项能力如何接入系统？
2. 同一套核心如何服务多个入口？
3. 会话历史如何持久化、恢复和投影？
4. Provider 或工具替换时，哪些状态需要重建？
5. 高风险动作如何审批、沙箱化和审计？

## 9. 收益、代价与边界

### 9.1 收益

**组合方式统一。** 工具、模型、Session、UI 和沙箱可以共享 Context、Service、Event、Effect 和 Fiber 这套装配语言。[1][3]

**生命周期成为一等问题。** 配置、依赖和 disposer 归属于一次 Fiber 挂载，热更新、测试隔离、临时插件和会话级能力可以共享退出路径。

**依赖可以晚绑定和按位置替换。** Consumer 依赖 service 名称；Provider 晚到、消失、换成本地/远程/沙箱实现时，运行时可以只重载受影响的 Consumer。

**模式是组合而不是复制主程序。** Web / Headless、不同 Agent preset 和不同 Provider 可以通过配置树组合，减少多套 loop 分叉。

### 9.2 代价

**静态代码不再等于实际系统。** import 图只能说明可能性；Profile、Bundle、Patch、Preset、条件表达式和 realm 才共同决定真实拓扑。

**动态依赖放大因果链。** Provider 的一次变化可能使一组 Consumer Fiber 进入卸载和重载；异步 setup、事件通知和 disposer 会交错，排障需要看配置树、Provider 身份、Fiber epoch 和清理结果。

**可逆不等于事务。** Effect 只能回收插件声明过的资源，不能自动补偿网络消息、共享文件写入或支付。

**插件化不等于安全。** `inject` 约束的是通过 Context 使用能力，不是同进程代码的操作系统权限；沙箱必须在执行层落实。

**运行时成本需要基准。** 当前来源和官方资料没有给出可直接复现的 Cordis 运行时开销、配置重组延迟或大规模插件图对照基准，因此本文不宣称动态运行图“几乎没有成本”或“一定成为瓶颈”。[1][unverified]

## 10. 勘误与补充

### 10.1 “一切皆插件”不是字面上的递归事实

“Everything is a plugin”适合描述 DSH 的应用能力组织方式；但根 Context、Registry、Events、Logger、Boot 和 Loader 等组合内核必须先存在，插件图才能建立。更准确的说法是：**业务能力尽量插件化，组合内核仍然是基础设施。**[1][3]

### 10.2 论文页数以当前 arXiv 元数据为准

原文按其阅读版本写成“88 页论文”。当前 arXiv 摘要页的元数据写的是 `Comments: 92 pages, 1 figure, 2 tables`，所以归档时不把“88 页”当成稳定事实；读者应以具体版本 PDF 为准。[1][5]

### 10.3 论文性质不是 DSH 整体的性能或安全证明

论文讨论的是时空可组合性的形式模型：可逆 effect、反应式 coeffect、Context、Fiber 和 Loader 的成立条件。[5] 这不能直接证明 DSH 的安全性、性能、插件质量或恢复完整性；这些仍需绑定源码版本和实验配置独立验证。

### 10.4 原文评测数字不作为已复现结论

原文提到 Pi、Codex、Hermes 等项目的评测数字，但没有在本笔记中逐一复现公开任务集、模型版本、权限配置、上下文预算、重试规则和成功标准。因此这里只保留一个可复用的评测清单：

```text
模型版本与推理强度
工具集合与工具 schema
权限、审批与沙箱策略
上下文预算与压缩规则
重试、超时和并发策略
任务环境与外部数据
成功、正确、安全、经济的判定标准
跨任务 Memory 是否开启
成本和延迟的统计口径
```

没有这些变量，所谓“同一个模型换 Harness 后更强/更便宜”很容易把环境差异误算成 Harness 能力。[1][unverified]

## 11. 复习速记

```text
Agent = LLM + Context + Loop + Tools + Environment Feedback
Harness = Agent Loop 外面的运行时边界

DSH 的两条主线：
1. Cordis runtime graph：现在系统由什么组成
2. Session event stream：过去系统发生了什么

配置装配：
Bundle → Profile → Patch → Loader → Fiber tree

Cordis 关键对象：
Context  = 能力可见性、继承与 realm 隔离
Service  = 可替换能力的接口/Provider/Consumer seam
Fiber    = 一次插件挂载的运行实例
Effect   = 副作用 + disposer
Event    = 观察、决策和流程拦截

Session：
Model-visible means logged
完整记录 ≠ 完整发送

安全边界：
inject 不是沙箱
Effect 不是事务回滚
Developer preview 不是稳定 API
```

## 12. 原文配图

原文 HTML 中提取到 8 张配图，已按原顺序保存；这里只保留附件，不对图片中的细节另行猜测或补写：

| 序号 | 附件 |
|---:|---|
| 01 | [查看原文配图 01](./2026-08-14-dsh-deepseek-harness-images/01.png) |
| 02 | [查看原文配图 02](./2026-08-14-dsh-deepseek-harness-images/02.png) |
| 03 | [查看原文配图 03](./2026-08-14-dsh-deepseek-harness-images/03.png) |
| 04 | [查看原文配图 04](./2026-08-14-dsh-deepseek-harness-images/04.png) |
| 05 | [查看原文配图 05](./2026-08-14-dsh-deepseek-harness-images/05.png) |
| 06 | [查看原文配图 06](./2026-08-14-dsh-deepseek-harness-images/06.png) |
| 07 | [查看原文配图 07](./2026-08-14-dsh-deepseek-harness-images/07.png) |
| 08 | [查看原文配图 08](./2026-08-14-dsh-deepseek-harness-images/08.png) |

## 核验备注

- 正文抓取文件：`/tmp/wechat_article_Kf87hcNdSmY4ODWI4UZ8cg.txt`。
- 原始 HTML：`/tmp/wechat_article_Kf87hcNdSmY4ODWI4UZ8cg.html`。
- 原文图片清单：`/tmp/wechat_article_Kf87hcNdSmY4ODWI4UZ8cg.images.json`。
- 8 张原图已归档到 `2026-08-14-dsh-deepseek-harness-images/`。
- DSH 官方 README 与架构文档按当前 `master` 内容核对；Cordis API 稳定性和论文定义分别以官方仓库与 arXiv 摘要为准。
- 原文涉及的提交快照、跨项目评测和部分运行时行为未在本机完整复现，已按“原文分析”或 `[unverified]` 处理。

## Sources

[1] https://mp.weixin.qq.com/s/Kf87hcNdSmY4ODWI4UZ8cg — DSH：DeepSeek Harness 架构解析（微信公众号原文）
    > "DSH 想插件化的不只是工具。模型适配器、系统提示词、工具目录、会话、存储、沙箱、Agent loop、Web UI，乃至标准、PTC、极简和创造模式，都尽量通过同一种机制组合。"
    > "Cordis 解决“系统现在由什么组成”，Session 解决“系统刚才做过什么”。这两条线合起来，才是 DSH 的主体。"
[2] https://github.com/deepseek-ai/deepseek-harness — DeepSeek Harness official repository
    > "It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512)."
    > "DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**"
[3] https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/architecture.md — DeepSeek Harness Architecture
    > "A running `dsh` is a plugin tree composed at boot from ordered layers."
    > "The session log is the source of the context the model sees."
    > "**Model-visible means logged.** Anything that reaches a model request must be reconstructable from the log, and a runtime invariant asserts it."
[4] https://github.com/cordiverse/cordis — Cordis official repository
    > "**Cordis is under active development. The API is not yet stable and may change without notice.**"
[5] https://arxiv.org/abs/2608.25512 — A Programming Paradigm for Spatiotemporal Composability
    > "We identify two orthogonal dimensions of the problem: temporal composability, the ability to completely revert a component's side effects upon removal, and spatial composability, the ability to declare and reactively manage inter-component dependencies."
    > "Comments: 92 pages, 1 figure, 2 tables"
