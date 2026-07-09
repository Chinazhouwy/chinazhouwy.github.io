---
title: "Interview Harness — 实现路线图"
date: 2026-07-09
domain: "项目"
area: "自研项目"
module: ""
project: "自研项目"
type: "路线图"
status: "draft"
priority: "P0"
energy: "high"
visibility: "private"
summary: "Interview Harness 实现路线图：当前迭代的详细步骤，以及后续阶段的进入条件和计划方向。"
tags:
  - interview
  - harness
  - roadmap
  - java
---

# Interview Harness — 实现路线图

> 这是[技术方案](./interview-harness-deep-research.md)的配套执行文档。
> **先读技术方案理解设计意图，再用本文档开始编码。**

---

## 第一部分：当前迭代（步骤 1-10）

以下是当前需要执行的步骤。每一步有明确的目标和完成标准。后面阶段的方向取决于这些步骤的实际情况。

### 步骤 1：建立最小工程

**目标**：Spring Boot 可以启动，Spring AI 可以调用一个模型。

**要做什么**：
- 创建 Spring Boot 3.x + Java 21 工程，单模块。
- 引入 `spring-ai-openai-spring-boot-starter`（或其他兼容 OpenAI API 的 starter）。
- 配置通过环境变量注入（`API_KEY`、`BASE_URL`、`MODEL_NAME`）。

**完成标准**：有一个模型 Smoke Test——发一条消息，收到回复，日志打印 token 消耗。

**明确不引入**：数据库、Agent 相关代码、Web 页面、Flyway。

---

### 步骤 2：准备 5-10 道人工校验的题

**目标**：先选 Java 并发主题，形成可程序读取的题目集。

**要做什么**：
- 从现有 55 道题中选取 5-10 道 Java 并发相关题目。
- 每道题整理为结构化格式：`questionCode`、题目文本、`knowledgePointCodes`、参考答案要点、常见错误/遗漏点。
- 存储为 classpath JSON 文件，程序通过 `QuestionLoader` 读取。

**完成标准**：程序可加载题目列表，所有 `knowledgePointCode` 唯一，内容经过人工检查（不是模型生成的）。

**明确不引入**：数据库表、题目版本系统。

---

### 步骤 3：定义结构化评测结果

**目标**：定义评测输出的完整领域模型，不依赖任何框架类型。

**要做什么**：
- 定义 `EvaluationResult`：score、scoreBreakdown（correctness/completeness/depth/structure/communication）。
- 定义 `CoveredPoint`（含 evidence）、`MissingPoint`（含 importance）、`IncorrectClaim`（含 severity 和 correction）。
- 定义 `FollowUpSuggestion`（含 targetKnowledgePoint 和 direction）。

**完成标准**：领域对象可正确序列化/反序列化。不 import 任何 Spring AI 类型。

---

### 步骤 4：跑通一次答案评测

**目标**：一道题 + 一段回答 → 一个结构化 `EvaluationResult`。

**要做什么**：
- 实现 `EvaluationService`：组装 Prompt（注入题目内容和 Rubric）、调用 `ChatModel`、解析 JSON 响应。
- 在 Prompt 中明确要求模型按 JSON Schema 输出，包含 coveredPoints、missingPoints、incorrectClaims、scoreBreakdown。
- 记录原始模型输出（rawOutput）方便调试。

**完成标准**：给定一道题和一段回答，`evaluate()` 返回有效的 `EvaluationResult`，至少包含覆盖点和遗漏点。暂时不强制要求所有字段完整。

---

### 步骤 5：增加结果校验和修复重试

**目标**：非法输出能被检测并触发重试。

**要做什么**：
- 实现 `EvaluationResultValidator`：校验 JSON Schema、score 范围、必填字段、knowledgePointCode 存在性。
- 校验失败时，将错误信息附加到重试请求中，让模型修复。
- 最多重试 1 次（共 2 次调用），仍失败则标记为 FAILED 并记录日志。

**完成标准**：合法 JSON 一次通过；非法 JSON 自动重试；两次都失败时返回明确错误状态，不静默吞掉。具体重试次数后续根据实际情况调整。

---

### 步骤 6：建立最小 Eval 集

**目标**：一批固定样本，可以重复执行和对比。

**要做什么**：
- 准备 6-10 个 Eval Case，覆盖以下类型：
  - 完整且正确的回答。
  - 部分正确但遗漏关键边界。
  - 明显概念错误。
  - 术语多但缺少深度（最危险的一类）。
  - 表达差但核心正确。
  - 自相矛盾。
- 每个 case 定义 expectedCovered、expectedMissing、expectedIncorrect、expectedScoreRange。
- 实现 `EvalRunner`：加载所有 case，逐个评测，统计各项指标（covered recall、missing recall、incorrect FPR、score range pass rate）。

**完成标准**：修改 Prompt 后可以重新跑全量 Eval，看出哪些 case 变好或变差。先不做自动对比（手动对比即可）。

---

### 步骤 7：实现内存版面试流程（先不做追问）

**目标**：开始面试 → 返回题目 → 回答 → 评测 → 返回结果。暂不追问。

**要做什么**：
- 定义 `InterviewSession`（内存版）、`InterviewStatus` 枚举。
- 实现 `InterviewOrchestrator`：startInterview、submitAnswer、endInterview。
- 实现 `QuestionSelector`：按主题随机或顺序选择题目。
- 通过简单 REST API 暴露：`POST /start`、`POST /{id}/answer`、`GET /{id}/status`。

**完成标准**：通过 HTTP 请求完成一场 3 题面试（无追问），每题都有评测结果。

**明确不引入**：数据库、追问逻辑、用户认证。

---

### 步骤 8：实现规则化追问决策

**目标**：LLM 识别缺口并提议追问方向，Java 代码决定是否追问。

**要做什么**：
- 实现 `FollowUpPolicy`（初版用规则）：存在 `importance=high` 的 missing point 或 `severity=critical` 的 incorrect claim 时追问。每道主问题暂定最多追问 2 次。
- 实现 `FollowUpGenerator`：根据 FollowUpDirection 生成自然语言追问文本（调用模型生成）。
- 在 `InterviewOrchestrator` 中接入追问流程。

**完成标准**：追问能对应某个明确的 MissingPoint 或 IncorrectClaim，追问次数有上限，模型不能自行结束面试。暂定参数（追问次数上限等）在实际使用后调整。

---

### 步骤 9：跑通一场内存版完整面试

**目标**：3-5 道题，支持追问，生成简单复盘。

**要做什么**：
- 端到端测试：启动 → 答题 → 追问 → 下一题 → 结束 → 复盘。
- 复盘内容：每道题的分数、主要缺失点、追问后的改善情况。
- 全部在内存中运行，不持久化。

**完成标准**：端到端测试通过。复盘内容能对应到具体 missing point 和追问结果。

---

### 步骤 10：根据实际使用结果决定下一步

此时你已经有一版可以实际使用（尽管只跑在内存里）的系统。在继续之前，先回答：

- 评测结果是否稳定？同一个回答多次评分是否接近？
- Eval 集是否覆盖了你实际遇到的主要问题类型？
- 追问是否真的有价值，还是变成了形式？
- 你最想先解决的问题是什么？是数据不丢（持久化）、还是评分更准（改进 Rubric 和 Eval）、还是体验更好（简单前端）？

根据回答，从后续阶段中选择下一个方向。不强制按固定顺序。

---

## 第二部分：后续阶段

后续阶段不再规划到每一步。每个阶段有进入条件和大体方向，具体步骤在进入时再细化。

### 阶段 B：持久化与能力证据

**进入条件**：
- 内存版面试闭环已经能实际使用（至少自己跑过几次完整面试）。
- 评测结果基本稳定（相同回答多次评分偏差不大）。
- 已经积累了一些真实训练记录，能感受到"数据不持久"的痛点。

**计划方向**：
- PostgreSQL + Flyway 建表。
- InterviewSession、InterviewTurn、EvaluationRun 持久化。
- MasteryEvidence 持久化（可追溯到具体 turn 和 evaluation）。
- 请求幂等（同一 requestId 不重复处理）。
- 乐观锁（session 和 agent_state 版本号）。
- 服务重启后恢复未完成会话。
- SkillMasteryCalculator：聚合多次 evidence 形成知识点掌握度。
- 证据化复盘报告。

---

### 阶段 C：抽取 Mini Harness

**进入条件**：
- 模型调用逻辑在评测、追问、报告等多个场景中重复出现。
- 确实需要统一的状态管理、Hook 和事件流。
- 已经知道哪些抽象来自真实需求（而不是提前设计的）。

**计划方向**：
- 从业务代码中抽出 `com.zhouwy.harness` 包，零业务依赖。
- 定义核心接口：`AgentRuntime`、`AgentStateStore`、`AgentHook`、`AgentTool`、`ToolRegistry`、`ContextPolicy`。
- 实现：AgentState 管理、HookChain、类型化 AgentEvent、受控 Tool Loop、ContextPolicy。
- 第一版工具白名单只允许读取（`load_question_context`、`load_skill_history`），不允许写业务数据。
- 将评测、追问和报告接入 Mini Harness。

**Tool Calling 实现方式**：使用 Spring AI 的 `ChatModel`（底层 API），Mini Harness 自己解析 ToolCall、校验权限、执行工具、写回结果。不使用 `ChatClient` 或 `ToolCallingAdvisor` 的自动循环。

---

### 阶段 D：AgentScope 源码对照

**进入条件**：
- Mini Harness 的核心机制（状态、Hook、事件、Tool Loop）已经跑通。
- 在实际使用中遇到过状态恢复、上下文压缩或事件传播问题。
- 能带着具体问题阅读源码，而不是泛读。

**计划方向**：
- 对照 AgentScope 2.0 Harness 源码，逐一研究：ReActAgent、RuntimeContext、StateStore、Middleware、事件流、Compaction、Workspace/Skill/Memory 边界。
- 每项研究产出对比文档，格式：我先实现了什么 → 我带着什么问题读 → AgentScope 怎么实现 → 差异在哪 → 哪些值得借鉴。
- 产出 `docs/source-study/` 系列文档。

---

### 阶段 E：Adapter 与工程化

**进入条件**：
- Mini Harness 基本稳定。
- Eval 集能作为对比基础。
- 确实有必要验证 AgentScope Runtime 在某些能力上是否更好。

**计划方向**：
- 实现 `AgentScopeRuntimeAdapter`（实现 `AgentRuntime` 接口）。
- 用同一批 Eval Case 对比两种 Runtime。
- SSE 流式推送面试事件。
- Micrometer 指标暴露。
- 故障场景自动化测试（超时、非法输出、乐观锁冲突）。
- README、ADR 和演示脚本。

---

*最后更新：2026-07-09*
