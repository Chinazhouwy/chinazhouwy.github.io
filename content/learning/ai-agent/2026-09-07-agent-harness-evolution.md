---
title: "从一次 LLM 调用到完整 Harness：Agent 系统如何长出运行时"
date: "2026-09-07"
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
summary: "用 Harness 视角梳理 Agent 从单次模型调用走向上下文、循环、工具、记忆、权限、会话和多 Agent 的演化，并区分可核验的工程结构与待验证的评测数字。"
tags:
  - Agent
  - Harness
  - Agent Runtime
  - Tool Calling
  - Memory
  - MCP
  - Codex
  - Hermes
  - Multi-Agent
  - 评测
source: "微信公众号「腾讯技术工程」"
source_url: "https://mp.weixin.qq.com/s/kZZac-VBgnQIZeookE9Y8g"
published_at: "2026-09-07 17:36:00 +08:00"
---

# 从一次 LLM 调用到完整 Harness：Agent 系统如何长出运行时

> 原文标题：从一次 LLM 调用到完整 Harness，Agent 到底经历了什么？
>
> 来源：微信公众号「腾讯技术工程」
>
> 作者：ivanxxie、davoszhang
>
> 发布时间：2026-09-07 17:36（北京时间）
>
> 原文链接：<https://mp.weixin.qq.com/s/kZZac-VBgnQIZeookE9Y8g>
>
> 整理说明：本文不是逐段翻译，而是对原文的结构化学习笔记。原文中的基准数字、项目内部实现和排名，只在“原文声称”范围内保留；能拿到一手资料的部分另行核验。

## 一句话结论

**模型负责生成下一步决策，Harness 负责把这个决策放进可持续、可约束、可恢复、可观测的运行环境。**

原文最有价值的视角，是把 Agent 的复杂性理解成一层层“边界补丁”：模型没有历史，于是系统装配上下文；模型不能改变世界，于是系统提供工具；一次动作做不完，于是系统增加循环；历史装不下，于是系统引入外部记忆；动作产生副作用，于是系统增加权限、沙箱、审批、事件和恢复机制。[1]

这里的 **Harness** 更适合作为一个架构观察框架，而不是所有项目都必须遵循的标准组件清单。

## 一、从单次 LLM 调用到 Agent Loop

### 1. LLM：只有输入和输出

最小模型接口可以抽象为：

```text
answer = LLM(question)
```

模型参数中可能包含训练所得的通用知识，但一次调用不会天然知道用户上一轮说过什么，也不知道它刚刚生成的命令是否真的执行过。用户偏好、任务状态和外部事实必须由应用在下一次请求中重新提供。[1]

### 2. Q&A Bot：增加 Working Memory

聊天应用把系统指令、近期历史和当前用户输入拼成一次请求：

```text
working_context = [
    system_prompt,
    recent_chat_history,
    user_prompt,
]
answer = LLM(working_context)
```

因此，Working Memory 不是模型内部自动增长的档案，而是**本轮真正提交给模型的上下文投影**。运行时选择什么历史、裁掉什么内容、让哪条指令拥有更高优先级，都会改变模型行为。[1]

### 3. ReAct：把行动结果接回决策

问答机器人通常回答一次；Agent 要根据环境反馈继续决定下一步。ReAct 论文把推理轨迹和任务动作交错起来，核心形式是：

```text
Thought → Action → Observation → Thought → ...
```

arXiv 记录显示，该论文首次发表于 2022-10-06，后续版本标注为 ICLR camera-ready；论文摘要明确讨论了让 LLM 交错生成 reasoning traces 与 task-specific actions。[2]

最小执行循环可以写成：

```python
while not finished:
    response = model(context)
    if response.has_action:
        observation = environment.execute(response.action)
        context.append(response.action, observation)
    else:
        return response.answer
```

这里真正持续运行的不是模型，而是模型外面的程序：它解析输出、调用环境、记录结果、决定是否继续，并把 Observation 重新装入上下文。

### 4. Tool Calling：从“像命令的文本”到结构化动作

早期 Agent 常让模型输出类似 `Search[Wikipedia]` 的文本，再由正则表达式解析。结构化 Tool Calling 则把动作拆成：

| 部件 | 职责 |
|---|---|
| Tool Schema | 描述工具名、用途、参数类型与约束 |
| Tool Router | 校验参数、按名称找到实现、决定是否需要审批 |
| Tool Call ID | 把请求与结果一一对应 |
| Tool Result | 携带执行状态和返回值，进入下一轮上下文 |

它把“模型看起来想执行某件事”变成“运行时收到一份可校验、可路由、可审计的动作请求”。[1] OpenAI Function Calling 的具体时间线在本次核验中没有拿到官方正文，保留为原文时间线，不把日期当作已确认事实。[unverified]

## 二、Memory：Working Memory 之外的三类长期信息

Agent Loop 解决“如何连续行动”，却没有解决“如何跨会话积累”。完整会话越来越长，而上下文窗口有限，所以系统通常把信息拆成两层：

- **Working Memory**：当前这一步真正送给模型的上下文；
- **Long-term Memory**：模型外部持久化、可检索、可更新的历史或知识。

原文把长期信息分为三类，这个分类适合用于分析系统职责：

| 类型 | 记住什么 | 常见载体 | 主要风险 |
|---|---|---|---|
| Procedural Memory（程序记忆） | 技能、习惯、操作流程、用户约定 | 规则文件、Skills、工作流配置 | 把一次性的做法误升级为通用规则 |
| Semantic Memory（语义记忆） | 稳定事实、概念、偏好、项目知识 | 摘要、全文索引、向量检索、数据库 | 过时、冲突、来源不明 |
| Episodic Memory（情景记忆） | 某次任务发生了什么、采取了哪些动作、结果如何 | 会话归档、事件日志、轨迹 | 信息太多，检索噪声挤压当前上下文 |

关键难点不是“能不能存”，而是：什么值得写入？什么时候合并？冲突如何覆盖？检索多少条？怎样防止错误经验长期污染后续任务？[1]

以 Hermes 为例，官方文档把 Memory 定义为跨会话持久化、且有边界的整理型记忆；当前实现把记忆注入新会话开始时的系统上下文，并强调不同进程不要共同写入同一个 Hermes home。[4] 官方 Skills 文档则把 Skill 定义为按需加载的知识文档，并采用渐进式披露来减少不必要的 token 消耗。[5]

这说明“记忆”和“技能”不是同一个东西：前者更接近事实与经验，后者更接近可复用的程序性流程。

## 三、什么时候出现 Harness

当 Agent 开始执行真实工作，单纯的 Prompt + Loop + Tools 会同时暴露出多种工程问题：

1. **会话能否恢复**：进程崩溃、用户退出后，如何从一致状态继续？
2. **副作用是否安全**：命令、文件、网络和凭证访问如何不依赖模型自觉？
3. **上下文如何压缩**：长任务如何保留关键状态，同时释放窗口？
4. **客户端如何连接**：TUI、IDE、Web、桌面端和 SDK 如何观察同一个任务？
5. **扩展如何装配**：工具、MCP、Skills、Hooks 和配置如何发现、加载、版本化？
6. **任务如何并行**：子 Agent 如何拥有独立上下文、权限、历史和生命周期？
7. **结果如何评价**：如何区分“输出看起来合理”和“任务真的完成”？

因此，Harness 可以理解成包裹 Agent Loop 的运行时层：

```text
Harness
├── Context Assembly       当前模型能看到什么
├── Agent Loop             何时继续、何时结束
├── Tool Router            能调用什么、参数是否有效
├── Permission / Sandbox   动作在哪里、以什么权限执行
├── Session / Event Store  过程怎样留下、能否恢复
├── Compaction             长历史如何投影成工作上下文
├── Memory / Skills        哪些经验影响未来任务
├── Multi-Agent Scheduler  如何派生、并行、回收子任务
└── Evaluator / Observer   结果是否正确、安全、经济
```

原文的核心表述是：Agent 决定下一步做什么，Harness 决定这一步在什么上下文、权限、生命周期和持久化规则下发生。[1]

原文借 Pi、OpenCode、Codex 和 Hermes 四条路线说明，Harness 的差异最终会反映到上下文、工具路径、循环轮数、停止条件和任务生命周期上。[1]

这套分析的重点不是“组件越多越好”，而是每个组件都应该对应 Agent Loop 的一个明确边界，并能说明失败后如何继续。[1]

## 四、四条路线：同一个 Agent Loop 的不同外壳

### 1. Pi：极简 Harness

原文把 Pi 描述为“先把最小 Harness 看清楚”：默认工具集合较小，Resource Loader 装配指令、Skills 和模板，Session Manager 通过活动分支和 Compaction 生成更紧的 Working Memory。[1]

这个方向的优点是上下文短、工具面小、运行成本容易控制；代价是能力边界和安全边界也更依赖外部容器或沙箱。**极简不等于安全**，少几个工具只能降低动作空间，不能替代权限模型。[1]

原文引用了 Composio 测试中 Pi 的通过率和中位成本，并进一步引用 Databricks 的内部基准比较不同 Harness 的上下文规模和成本。这些数字在文章中没有附公开报告、任务清单、模型配置或可复现实验脚本，详见“评测数据边界”。[1]

### 2. OpenCode：事件驱动的服务化 Harness

原文将 OpenCode 的关键变化概括为：一次回复不再只是一块文本，而是一组可持续更新的结构化 Part，例如 Reasoning、Text、Tool、Step Start、Step Finish、Patch 和 Compaction。[1]

这带来三种能力：[1]

- **可恢复**：退出界面不等于丢掉任务现场；
- **可观察**：客户端可以消费事件，而不是重放终端字符；
- **可复用**：TUI、Web、桌面端和 SDK 可以共享同一运行时。

代价也很清楚：事件顺序、数据库投影、权限合并、压缩边界和后台模型调用都会增加状态工程复杂度。原文对 OpenCode 的源码级描述属于文章分析，本文不把它当作 OpenCode 官方架构规范。

### 3. Codex：把安全执行和 Thread 生命周期做成一等公民

原文对 Codex 的抽象是：

```text
Thread
└── Turn
    ├── User Input Item
    ├── Reasoning / Agent Message Item
    ├── Command Execution / File Change Item
    ├── Tool Call / Approval Item
    └── Turn Completed
```

其中：

- **Thread** 是可持续多轮任务的容器；
- **Turn** 是用户推动任务向前走的一次过程；
- **Item** 是可观察的最小事件单元；
- **Approval Policy** 决定何时需要用户批准；
- **Sandbox Policy** 把文件、网络和系统能力落实成技术限制。

这不是只凭文章推断：当前 Codex 开源源码把 `ThreadManager` 定义为负责创建 Thread 并在内存中维护它的组件，状态中确实存在按 `ThreadId` 索引的 `HashMap`。[7] App Server 的线程处理器提供 `thread_start`、`thread_resume` 和 `thread_fork` 入口。[8] 协议 schema 也把 `thread/start`、`thread/resume`、`thread/fork` 等请求定义为结构化 API。[9]

因此，文章关于“Thread Manager 是任务控制平面，而不是模型推理本身”的理解是有工程依据的；但具体字段、恢复时机和实现边界会随 Codex 版本变化，阅读源码时必须绑定版本。

### 4. Hermes：把能力延伸到下一次任务

原文把 Hermes 的差异放在“自进化”上：一次任务留下会话轨迹，之后由 Memory、Skills 和后台整理过程决定哪些经验影响下一次任务。[1]

当前 Hermes 官方文档可以独立确认三件事：

1. Memory 能跨会话保存经过整理的用户、环境和经验信息。[4]
2. Skills 是可以按需加载的知识/流程文档，支持渐进式披露。[5]
3. Cron 能运行一次性或周期性任务，并可在新 Agent 会话中执行，也支持无 Agent 的脚本模式。[6]

因此，“长期运行时”这个方向是成立的。但“有 Memory/Skills/Cron”不自动等于“已经自我改进”：真正的自我改进必须用跨会话任务、对照组、错误记忆纠正和后续成功率来衡量。

## 五、评测数据边界：哪些只是原文声称

文章把多个外部或内部评测写成了很具体的数字。它们可以作为待查线索，但目前不能当成已经独立复现的通用结论：

| 文章中的说法 | 本次核验状态 | 正确用法 |
|---|---|---|
| Composio：4 个 Harness、30 个 Agentic Tasks，Pi 通过率 66.7%、中位成本 0.012 美元 | 原文声称；文章未给公开报告或任务配置。[1] | 只能说“原文引用的测试结果” |
| Databricks：数百万行代码库、不同模型/Harness 的 Pareto 前沿，Pi 上下文约少三倍 | 原文声称；未拿到公开实验细节。[1] | 作为“上下文预算影响成本”的案例假说 |
| OpenBench：42 个任务，Codex 完成 31 个、通过率 73.8%、中位耗时 94.6 秒、成功任务平均 117,107 个新 token | 原文声称；未给公开报告、脚本和任务集。[1] | 不写成 Codex 的通用排行榜结论 |
| PAST-Bench：26 个场景、204 个跨会话 Episode，Hermes 总体增益 +0.13 | 原文声称；本次在官方 Hermes 文档和源码中未找到对应基准定义或报告。[1] | 把它标为待验证的研究线索 |
| Hermes 机制证据分 0.64、nanobot 0.57 | 原文声称；缺少评分协议与原始数据 | 不据此判断框架优劣 |

评测 Agent Harness 至少要固定：模型版本、推理强度、工具集合、权限策略、上下文预算、重试规则、任务环境、成功标准、成本口径和是否允许跨任务记忆。否则“同一个模型换 Harness”的结论很容易把环境变量误算成 Harness 能力。

## 六、勘误与补充

### 1. “Harness 就是一套小型操作系统” → 是有用的比喻，不是严格定义

- **原文表达**：Agent 系统越来越像小型操作系统。
- **更准确的理解**：它们都可能拥有资源装配、进程/任务生命周期、权限、事件、持久化和调度，但不代表每个 Agent 都需要完整实现操作系统式的抽象。
- **我的判断**：把 Harness 当作“面向模型动作的运行时”比把它直接等同于操作系统更稳妥。

### 2. “记忆让 Agent 自我改进” → 存储能力不等于学习增益

- **原文容易造成的理解**：只要保存 Memory 和 Skills，Agent 就会越来越强。
- **更准确的理解**：必须同时验证写入、检索、应用、纠错和长期收益；错误记忆可能使系统越用越乱。
- **依据**：Hermes 官方文档确认 Memory/Skills 的机制，但没有为本文中的 PAST-Bench 数字提供公开证据。[4][5]

### 3. “Codex Thread Manager 只是一个 HashMap” → HashMap 是当前实现的一部分

- **原文容易造成的理解**：Thread Manager 的本质就是一张内存表。
- **更准确的理解**：当前源码确实用按 Thread ID 索引的并发 HashMap 维护活跃 Thread，但它还连接线程创建、恢复、派生、事件和持久化历史；内存表只是生命周期管理的一部分。[7][8]

### 4. “Structured Tool Calling 已经解决了工具可靠性” → 只解决协议层的一部分

Schema 能降低格式漂移和参数缺失，但不能保证：工具语义正确、权限安全、结果真实、操作幂等、网络重试不重复执行，或模型会在工具失败后正确重规划。可靠性还需要校验器、审批、沙箱、超时、重试和 evaluator。

### 5. MCP 的时间线可以确认，但不能把协议接入等同于 Agent 能力

Anthropic 官方页面标注 2024-11-25，并称当天开源 Model Context Protocol，目标是用开放标准连接 AI 系统与数据源。[3] 这能核对文章“2024 年 11 月 MCP”这一时间点；但接入 MCP 只说明连接协议存在，不代表工具发现、权限、数据质量和任务闭环已经做好。

## 七、我的观点：Harness 的核心是“边界 + 状态 + 反馈”

### 认同的部分

1. **模型能力不是系统能力**：同一模型在不同上下文、工具、权限和停止条件下，确实可能表现出巨大差异。
2. **控制流比 Prompt 堆砌更重要**：真正决定系统是否可控的，是状态机、工具路由、失败分支、恢复语义和验收标准。
3. **长期记忆必须被当作有风险的外部状态**：写入要有门控，读取要有相关性和时效性，更新要能覆盖错误事实。
4. **安全边界必须落到执行层**：审批是决策门，沙箱是技术门；只在系统提示词里提醒模型“小心”不够。

### 可商榷的部分

1. **极简 Harness 不必然更高效**：上下文短可以降成本，但过度裁剪可能漏掉约束、失败历史和关键接口信息；应该优化“有效上下文密度”，不是只追求 token 少。
2. **事件化不等于可恢复**：只有在事件具备顺序、幂等键、快照和重放语义时，事件日志才真正支持恢复；把每一步写成 JSON 仍可能无法重建状态。
3. **跨会话记忆不必然带来正向增益**：错误偏好、过期项目事实、一次性 workaround 都可能污染未来任务。Memory 的质量指标应包括纠错率、过期率和误召回率。
4. **多 Agent 不必然优于单 Agent**：并行带来分工和吞吐，也带来通信、同步、冲突、权限和汇总成本。若任务不能自然拆分，多个 Agent 只是把一条错误链变成多条错误链。
5. **基准排名不等于生产选型**：短任务可能偏爱轻量 Harness，长任务和高风险副作用则更看重恢复、审批和审计；必须按真实约束选型。

### 一个实用的 Harness 设计清单

```text
1. Context：本轮模型究竟看到了什么？每段信息来自哪里？
2. State：任务状态、工具状态、审批状态和持久化状态是否分离？
3. Action：工具参数是否有 schema、权限检查和幂等语义？
4. Boundary：网络、文件、凭证和进程权限是否由执行层限制？
5. Feedback：工具结果是否带状态、错误类型和可重试信息？
6. Recovery：中断后从快照、事件还是重新规划恢复？
7. Memory：什么写入长期记忆，如何纠错和过期？
8. Evaluation：怎样判断完成、正确、安全和经济？
9. Observability：能否按 Thread/Turn/Item 追踪成本、延迟和失败？
```

## 八、概念解释表

| 概念 | 一句话解释 |
|---|---|
| LLM | 根据当前输入上下文逐 token 生成输出的模型，本身不是任务管理器。 |
| Working Memory | 这一轮真正塞给模型的上下文，不等于全部历史。 |
| Agent Loop | 模型决定动作、环境执行、结果回传、模型继续决策的循环。 |
| ReAct | 把推理与行动交错起来，让行动观察进入下一轮决策。 |
| Tool Calling | 模型以结构化方式请求程序执行工具。 |
| Tool Schema | 工具的“使用说明书”，规定参数类型和约束。 |
| Tool Router | 工具总机：校验参数、找实现、执行前检查权限。 |
| Tool Result | 工具执行后的回执，必须能对应到原始调用。 |
| Harness | 包裹 Agent Loop 的运行时边界，负责上下文、工具、状态和安全。 |
| Resource Loader | 在运行前发现并装配指令、Skills 和模板的加载器。 |
| Compaction | 把长历史压缩成当前任务仍需要的摘要和近期上下文。 |
| Profile | 一套角色、模型、权限、工具和生成参数的组合，不只是换一段 Prompt。 |
| Thread | 可持续恢复的任务容器。 |
| Turn | 用户推动一次任务进展的过程。 |
| Item | Turn 中可观察的输入、消息、工具、审批或文件变更单元。 |
| Session Event | 描述状态变化的事件，适合驱动多客户端和恢复。 |
| Sandbox | 在操作系统或容器层限制模型动作实际能触碰的资源。 |
| Approval Policy | 决定哪些动作必须停下来请求人类许可的策略。 |
| RAG | 从外部知识源检索内容，再把相关片段装入当前上下文。 |
| Procedural Memory | 记住“怎么做”的流程、技能和约定。 |
| Semantic Memory | 记住“是什么”的事实、概念和知识。 |
| Episodic Memory | 记住“曾经发生过什么”的具体任务经历。 |
| MCP | 连接 AI 应用与外部数据/工具服务的一种开放协议。 |
| Evaluator | 判断结果是否正确、安全、一致、经济或满足用户目标的组件。 |

## 九、复习速记

```text
Agent = LLM + Context + Loop + Tools + Environment Feedback
Harness = Agent Loop 外面的运行时边界

模型：决定下一步做什么
Harness：决定看什么、能做什么、在哪做、如何记录、失败后怎么继续

最小演化：
单次调用 → Working Memory → ReAct Loop → Tool Calling
→ Long-term Memory → Permission/Sandbox → Session/Event
→ Compaction → Multi-Agent → Evaluator

长期记忆三分：
Procedural = 怎么做
Semantic   = 是什么
Episodic   = 发生过什么

评测 Harness 必须固定：
模型、工具、权限、上下文预算、重试、环境、成功标准、成本口径、跨任务记忆
```

## 十、原文配图

原文 HTML 中共提取到 17 张配图，已保存为本条笔记的附件。原文没有为每张图提供独立的可复制说明，以下保留原顺序：

| 序号 | 附件 |
|---:|---|
| 01 | [查看配图 01](./2026-09-07-agent-harness-images/01.gif) |
| 02 | [查看配图 02](./2026-09-07-agent-harness-images/02.png) |
| 03 | [查看配图 03](./2026-09-07-agent-harness-images/03.png) |
| 04 | [查看配图 04](./2026-09-07-agent-harness-images/04.png) |
| 05 | [查看配图 05](./2026-09-07-agent-harness-images/05.png) |
| 06 | [查看配图 06](./2026-09-07-agent-harness-images/06.png) |
| 07 | [查看配图 07](./2026-09-07-agent-harness-images/07.png) |
| 08 | [查看配图 08](./2026-09-07-agent-harness-images/08.png) |
| 09 | [查看配图 09](./2026-09-07-agent-harness-images/09.png) |
| 10 | [查看配图 10](./2026-09-07-agent-harness-images/10.png) |
| 11 | [查看配图 11](./2026-09-07-agent-harness-images/11.png) |
| 12 | [查看配图 12](./2026-09-07-agent-harness-images/12.png) |
| 13 | [查看配图 13](./2026-09-07-agent-harness-images/13.png) |
| 14 | [查看配图 14](./2026-09-07-agent-harness-images/14.png) |
| 15 | [查看配图 15](./2026-09-07-agent-harness-images/15.png) |
| 16 | [查看配图 16](./2026-09-07-agent-harness-images/16.gif) |
| 17 | [查看配图 17](./2026-09-07-agent-harness-images/17.png) |

## 核验备注

- 原文正文已抓取到 `/tmp/wechat_article_kZZac.txt`，原始 HTML 已保存到 `/tmp/wechat_article_kZZac.html`。
- Codex 源码核验使用 2026-09-07 抓取的 `openai/codex` 主分支工作副本；源码细节应以实际版本为准。
- Hermes Memory、Skills、Cron 的能力核验使用 Hermes 官方文档；PAST-Bench 的具体数字没有在本次核验中独立复现。

## Sources

[1] https://mp.weixin.qq.com/s/kZZac-VBgnQIZeookE9Y8g — 从一次 LLM 调用到完整 Harness，Agent 到底经历了什么？
[2] https://arxiv.org/abs/2210.03629 — ReAct: Synergizing Reasoning and Acting in Language Models
[3] https://www.anthropic.com/news/model-context-protocol — Introducing the Model Context Protocol
[4] https://hermes-agent.nousresearch.com/docs/user-guide/features/memory — Persistent Memory | Hermes Agent
[5] https://hermes-agent.nousresearch.com/docs/user-guide/features/skills — Skills System | Hermes Agent
[6] https://hermes-agent.nousresearch.com/docs/user-guide/features/cron — Scheduled Tasks (Cron) | Hermes Agent
[7] https://github.com/openai/codex/blob/main/codex-rs/core/src/thread_manager.rs — Codex ThreadManager source
[8] https://github.com/openai/codex/blob/main/codex-rs/app-server/src/request_processors/thread_processor.rs — Codex thread lifecycle processor
[9] https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/json/ClientRequest.json — Codex App Server client request schema
