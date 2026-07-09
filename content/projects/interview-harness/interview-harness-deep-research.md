---
title: "Interview Harness — 设计思考与技术方案"
date: 2026-07-09
domain: "项目"
area: "自研项目"
module: ""
project: "自研项目"
type: "设计文档"
status: "draft"
priority: "P0"
energy: "high"
visibility: "private"
summary: "基于 Spring AI 模型抽象、自研 Mini Harness 和显式业务状态机的面试训练系统。重点解决 Rubric 评测、追问闭环、能力证据和 Eval 回归。"
tags:
  - interview
  - harness
  - agent
  - spring-ai
  - eval
  - java
---

# Interview Harness — 设计思考与技术方案

> **状态**：规划设计阶段，尚未开始编码。
> **配套文档**：[实现路线图](./interview-harness-implementation-roadmap.md)（当前迭代的详细步骤）。

---

## 1. 为什么想做这个系统

过去几个月我刷了 55 道面试题。在这个过程中有几个感受越来越强烈。

**普通 AI 面试很容易在表面正确时说"回答得很好"。** 我说了核心参数和基本用法，没有提拒绝策略，没有讨论线程数如何估算，没有解释为什么不用无界队列——但模型常常跳过这些，给一个 7 分然后进入下一题。真人面试官不会这样。他会追问边界、追问原理层次、追问"如果换成你的项目你会怎么选"。追问才是最能暴露理解深度的环节。

**评分本身也在漂移。** 同一道题，同一段回答，隔几天问同一个模型有时 6 分有时 8 分。我改了一行 Prompt，不知道结果变好还是变差。这在开发中叫"没有回归测试"，只不过这里的"被测对象"是模型。

**最让我困扰的是：我无法回答"我到底掌握了没有"。** 55 道题分散在 55 个文件里，每道有一个分。但"线程池"这个概念我答了 3 道题，3 次都在关键点上被扣分。没有一个地方告诉我：这个知识点你有 3 条遗漏证据，最近一次是 7 月 3 号，至今未改善。

我真正想解决的不是自动出题，也不是做另一个聊天页面。我想做的是：**发现一次回答到底暴露了什么知识缺口，通过追问确认缺口边界，记录每次训练的证据，然后能回答"这个知识点我到底掌握了没有"。**

---

## 2. 我真正想解决的问题

一条闭环：

```text
选择主题 → 回答问题 → 按 Rubric 识别覆盖点、遗漏点、错误点
→ 判断是否值得追问 → 追问并验证理解边界
→ 记录这次训练产生的 MasteryEvidence
→ 下一次优先训练那些有证据表明薄弱的知识点
```

出题不是核心。评测和追问也不是孤立功能。真正的核心是**让多次离散训练形成可验证的能力变化**——你能指着某条证据说：7 月初关于"线程池拒绝策略"有一条 missing，7 月中旬追问后修正，现在这个知识点稳定 covered。

---

## 3. 两层控制结构

这是整个系统最重要的设计决策。

系统在每一次"用户回答 → 系统响应"的过程中，有两层控制在工作：

### Interview Orchestrator——负责可确定的业务流程

- 现在第几题。
- 当前是否在等待回答。
- 评测完成后，根据 missing points 的严重程度判断要不要追问。
- 已经追了几次，还剩几次。
- 什么时候进入下一题。
- 什么时候结束面试。
- 把业务事实写入数据库。

这些都是**确定性的规则**。追问几次、什么条件进入下一题、面试总时长——不应该由模型自由决定。

### Agent Runtime——负责模型调用过程中的技术问题

- 模型调用和消息格式。
- Tool Call 的解析、权限校验、执行和结果写回。
- 跨调用的 AgentState 保存和恢复。
- Hook 在调用前后的执行。
- 类型化事件（调用开始、调用完成、错误、循环结束）。
- 超时、最大循环次数、连续失败限制。

这两个层次分开的原因是：**面试流程是一个业务问题，模型调用是一个技术基础设施问题。** 面试是否结束是业务决策，不能因为 Agent 循环里的某次异常而悄悄改变。反过来，Agent 循环的重试策略和上下文压缩，也不应该泄漏到面试业务代码里。

---

## 4. 为什么采用 Spring AI + 自研 Mini Harness + AgentScope 对照

### Spring AI

我的主技术栈是 Java 和 Spring Boot，目标岗位是 Java 后端和 Agent 应用方向。Spring AI 与现有 Spring 生态的整合更自然——自动配置、Actuator、Micrometer 都可以直接复用。

在系统中，Spring AI 负责：

- 模型 Provider 适配（OpenAI、DashScope 等）。
- `ChatModel` 统一抽象和消息格式。
- 结构化输出的基础能力（`BeanOutputConverter`）。
- 流式响应。
- Tool 的 `@Tool` 注解定义。
- 基础 Observability（自动记录 token 和延迟）。

Spring AI 不负责：完整面试流程、FollowUpPolicy、能力画像、业务状态机、Agent Runtime 的控制逻辑。

关于 Tool Calling 需要明确一点：Spring AI 提供了两种使用方式。一种是 `ChatClient` + `ToolCallingAdvisor`，框架自动完成整个"检测 ToolCall → 执行工具 → 写回结果 → 继续循环"的过程。另一种是更底层的 `ChatModel`，自己解析响应中的 ToolCall、自己执行工具、自己写回。**本项目选择后者。** 原因是我需要自己控制循环次数、权限校验和失败处理——如果让框架自动执行，这些控制点就消失了，Mini Harness 的核心学习价值也随之消失。

### 自研 Mini Harness

这不是要重写一个完整 AgentScope，也不是要做"自研大型 Agent 框架"。

Mini Harness 只实现对我有学习和项目价值的控制面：

- `AgentState` 和 `AgentStateStore`：理解"Agent 为什么可以无状态"以及状态在什么时机加载和保存。
- `RuntimeContext`：单次调用的临时上下文（traceId、开始时间、取消信号）。
- `AgentHook` 和 `HookChain`：理解 middleware/hook 模式在 Agent 中的执行顺序。
- 类型化 `AgentEvent`：理解事件如何在 Runtime 中传播。
- 受控 Tool Loop：自己解析 ToolCall、校验权限、执行工具、写回结果、判断是否继续。
- `ContextPolicy`：控制发送给模型的上下文窗口和截断策略。
- 基础状态恢复。

这些都是我在学习 Hermes 和 AgentScope 源码时反复遇到的核心机制。写一遍才能真正理解。

### AgentScope 对照

AgentScope 2.0 的 Harness 是一个长期运行 Agent 的工程底座，主要处理：ReAct Agent 运行基础、跨调用状态恢复、Workspace、Context Compaction、长期记忆、Skill、权限控制、沙箱、子 Agent、类型化事件、多用户和多会话隔离。

它和我的 Interview Harness 不是同一层概念：

```text
Interview Harness：领域业务系统（面试会话、评测、追问、证据、复盘）
AgentScope Harness：一种可选的 Agent Runtime 工程底座
```

第一版不直接用 AgentScope 托管业务流程，不是因为 AgentScope 有问题，而是因为面试业务状态必须由确定性 Java 代码控制，而且亲手实现一次状态管理、Hook、事件流和受控循环，才能真正学到这些设计。AgentScope 更适合在后期作为源码对照和 Runtime Adapter——用同一批 Eval Case 对比自研 Runtime 和 AgentScope Runtime，这是很好的工程判断展示。

### LangChain4j

API 友好，Java 社区有较多使用者，不做长篇论证。当前选择一条主线走通，后期可以考虑实现一个 Adapter 做横向对比。

---

## 5. 第一版真正要验证什么

不是 44 步的所有功能。第一版只需要验证三个问题。

### 目标一：评测是否能识别真实缺口

输入一道题和一段回答，系统能不能稳定输出：哪些知识点被覆盖了、哪些遗漏了、哪些说错了、对应的证据是什么。不是"给个 7 分"。

### 目标二：追问是否针对缺口

系统根据具体 missing point 生成追问，而不是随机问一个相关问题。追问后用户的回答是否能用来判断"他刚才的遗漏现在补上了吗"。

### 目标三：多次训练是否能形成能力证据

系统能不能回答：为什么认为某个知识点薄弱、这个判断来自哪次回答的哪次评测、用户是否在后续追问中修正了。如果这些问题答不上来，"能力画像"就只是另一个 JSON 总结。

---

## 6. Eval 为什么是关键

模型评分不是客观真值。修改 Prompt、调整 Rubric、切换到另一个模型——评分结果可能漂移，而且漂移的方向不一定是你想要的。一行 Prompt 改动可能让评分更"宽容"，表面看分数普遍高了，但 missing point 的识别率下降了。

因此需要一批固定样本做回归：

- 每次改动后跑同一批 case。
- 看 covered point recall、missing point recall、incorrect claim false positive rate、score range pass rate 等指标。
- 不是追求某个"绝对正确"的分数，而是发现退化。

一个简化的 Eval Case 示例：

```
case: "线程池参数回答——正确但不完整"
question: JAVA-001
answer: "核心参数有 corePoolSize、maxPoolSize、keepAliveTime..."
expectedCovered: [KP-THREADPOOL-PARAMS]
expectedMissing: [KP-THREADPOOL-REJECTION, KP-THREADPOOL-SIZING]
expectedScoreRange: [5, 7]
```

初版会关注覆盖点识别、遗漏点识别、错误误报、评分区间和追问方向等指标。具体阈值在第一批样本跑起来后再确定，现在写一个"必须达到 85%"没有意义。

---

## 7. 状态与数据边界

系统中有几类不同性质的数据，它们的存储位置和"是否发送给模型"需要分清楚：

| 数据 | 性质 | 存储 | 发送给模型？ |
|---|---|---|---|
| 完整聊天历史 | 所有 turn 的原始消息，用于审计和回放 | PostgreSQL | 否 |
| Active Context | 当前发送给模型的消息窗口 | 内存（AgentState 中维护） | 是 |
| Summary | 超出窗口的历史压缩 | AgentState | 是（注入 system message） |
| InterviewSession | 确定性业务事实（状态、当前题号、追问计数） | PostgreSQL | 部分（注入 prompt 作为引导） |
| AgentState | Agent Runtime 的跨调用技术状态 | PostgreSQL（独立表） | 否（Runtime 内部使用） |
| RuntimeContext | 单次调用的临时上下文 | 不持久化 | 否 |
| MasteryEvidence | 可追溯到具体 turn 和 evaluation 的能力证据 | PostgreSQL | 是（注入 prompt 帮助个性化追问） |
| 稳定用户偏好 | 目标岗位、回答风格 | PostgreSQL（session.preferences） | 是 |

几个关键判断：

- "用户不懂线程池"不能直接作为长期稳定记忆。它只是一次评测的快照，需要多次 MasteryEvidence 聚合才能形成可信结论。
- AgentState 不混入业务表。Agent 技术状态和面试业务事实是不同的生命周期。
- 完整历史不发送给模型。只发送经过 ContextPolicy 筛选后的 Active Context 和 Summary。

具体表结构等真正需要建表时再设计，当前先作为设计约束记下来。

---

## 8. 开发演进路线

粗粒度阶段，详细步骤见路线图。

```text
可靠的单题评测（阶段 A）
→ 追问闭环（阶段 B）
→ 持久化与能力证据（阶段 C）
→ 抽取 Mini Harness（阶段 D）
→ 对照 AgentScope 源码（阶段 E）
→ AgentScope Adapter 与工程化（阶段 F）
```

- **阶段 A**：跑通结构化评测，建立最小 Eval 集。不涉及数据库、不涉及面试流程、不涉及追问。
- **阶段 B**：实现内存版面试状态机和追问闭环，能完成一场 3-5 题的面试。
- **阶段 C**：接入 PostgreSQL，实现能力证据持久化、复盘报告和会话恢复。
- **阶段 D**：从业务代码中抽出 Mini Harness——状态管理、Hook、事件流、受控 Tool Loop。进入条件是模型调用逻辑已在多个场景重复，确实需要统一抽象。
- **阶段 E**：带着自己实现的经验阅读 AgentScope 源码，产出对照文档。
- **阶段 F**：实现 AgentScopeRuntimeAdapter，用同一批 Eval 对比两种 Runtime。增加 SSE、可观测性和故障测试。

后续阶段的详细内容在路线图中描述，每个阶段有明确的进入条件——不是按固定时间表推进，而是根据上一个阶段的实际情况决定。

---

## 9. 这个项目最终能证明什么

- Java 领域建模（Domain 零框架依赖）。
- Spring AI 模型接入与多 Provider 适配。
- 显式业务状态机设计。
- LLM 结构化评测与 Rubric 设计。
- Eval 回归体系。
- Agent Runtime 基础机制：状态管理、Hook 链、事件流、受控 Tool Loop、Context Policy。
- 状态恢复、幂等和乐观锁。
- 结构化可观测性。
- 对 AgentScope 设计的源码级理解。

简历描述可以这样写：

> 基于 Spring AI 模型抽象，自研轻量级 Agent Harness，完成会话状态隔离、受控工具循环、生命周期 Hook、类型化事件流、上下文压缩和 JDBC 状态恢复；结合显式业务状态机实现面试追问、Rubric 评测、能力证据与 Eval 回归，并与 AgentScope Harness 进行源码级设计对比。

---

*最后更新：2026-07-09*
