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
summary: "Interview Harness 分阶段实现路线图：44 个步骤，每步包含目标、类、测试、验收标准和 Commit Message。"
tags:
  - interview
  - harness
  - roadmap
  - java
---

# Interview Harness — 实现路线图

> 这是 [技术方案](./interview-harness-deep-research.md) 的配套执行文档。
> 先读技术方案理解设计意图，再用本文档逐步执行。

---

## 阶段 A：最小评测闭环（步骤 1-7）

> 目标：固定题目 + 固定 Prompt 跑通一次答案评测，建立第一批 Eval Case。
> 此时没有面试状态机、没有数据库、没有 Web API。

### 步骤 1：创建工程

**目标**：可编译、可运行的空 Spring Boot 工程。

**新增**：
- `pom.xml`（spring-boot-starter, spring-ai-openai, junit-jupiter, testcontainers）
- `InterviewHarnessApplication.java`
- `application.yml`（spring.ai.openai.api-key, base-url, model）

**测试**：`InterviewHarnessApplicationTests.java` — `contextLoads()`

**完成标准**：`mvn test` 通过，Spring 上下文启动成功。

**Commit Message**：`chore: init Spring Boot project with Spring AI`

**明确不做什么**：不拆模块（单模块）、不加数据库、不写业务代码。

---

### 步骤 2：接入一个模型

**目标**：通过 Spring AI 成功调用模型并获取响应。

**新增**：
- `ModelGateway` 接口（domain 层）
- `SpringAiModelGateway`（infrastructure 层，实现 `ModelGateway`，依赖 `ChatModel`）
- `ModelGatewayTest.java`（集成测试，用 Testcontainers 或 mock）

**完成标准**：`ModelGateway.call(prompt)` 返回模型响应，日志打印 token 消耗。

**Commit Message**：`feat: add ModelGateway with Spring AI adapter`

**明确不做什么**：不定义 Agent、不写评测逻辑。

---

### 步骤 3：准备 10 道 Java 并发题

**目标**：从现有题库标准化 10 道题目，形成可程序读取的题目集。

**新增**：
- `InterviewQuestion` 记录（domain）
- `QuestionVersion` 记录（domain）
- `QuestionLoader`（从 classpath 加载 JSON 题目文件）
- `src/main/resources/questions/java-concurrency.json`（10 道题 + Rubric）

**测试**：`QuestionLoaderTest.java` — 校验题目格式、知识点编码唯一性。

**完成标准**：10 道题可成功加载，每题有 `questionCode`、`knowledgePointCodes`、`rubricTemplate`。

**Commit Message**：`feat: add 10 Java concurrency questions with rubric templates`

**明确不做什么**：不写数据库表（内存加载）、不支持多主题。

---

### 步骤 4：定义 EvaluationResult

**目标**：定义评测结果的完整领域模型。

**新增**：
- `EvaluationResult` 记录（score, scoreBreakdown, coveredPoints, missingPoints, incorrectClaims, followUpSuggestions, overallComment）
- `CoveredPoint`、`MissingPoint`、`IncorrectClaim` 记录
- `FollowUpSuggestion` 记录
- `ScoreBreakdown` 记录（correctness, completeness, depth, structure, communication）

**测试**：`EvaluationResultTest.java` — 序列化/反序列化、必填字段校验。

**完成标准**：领域对象可正确序列化为 JSON Schema 定义的格式。

**Commit Message**：`feat: define EvaluationResult domain model`

**明确不做什么**：不实现评测逻辑、不定义 Evaluator。

---

### 步骤 5：实现一次结构化评测

**目标**：调用模型完成一次从"用户回答"到"结构化 EvaluationResult"的评测。

**新增**：
- `EvaluationService`（application 层）——组装 Prompt、调用 ModelGateway、解析 JSON
- `RubricPromptBuilder`——根据 `QuestionVersion.rubricTemplate` 构建 Prompt
- `EvaluationServiceTest.java`（集成测试）

**完成标准**：给定一道题和一个回答，`EvaluationService.evaluate()` 返回合法的 `EvaluationResult` JSON。

**Commit Message**：`feat: implement structured evaluation service`

**明确不做什么**：不处理非法 JSON（下一步做）、不持久化。

---

### 步骤 6：增加结果校验

**目标**：对模型返回的 JSON 做 Schema 校验，非法时重试。

**新增**：
- `EvaluationResultValidator`（domain 层接口）
- `JsonSchemaEvaluationResultValidator`（infrastructure 层）——校验 JSON Schema、score 范围、必填字段、knowledgePointCode 存在性
- `EvaluationResultValidatorTest.java`——正常/缺失字段/非法 score/未知知识点等 case

**修改**：
- `EvaluationService`——加入 validator 调用和重试逻辑（最多重试 2 次）

**完成标准**：
- 合法 JSON 一次通过
- 非法 JSON 自动重试，最多 3 次调用
- 3 次均失败返回 `EVALUATION_FAILED`，记录日志

**Commit Message**：`feat: add evaluation result validation with retry`

**明确不做什么**：不引入消息队列、不异步化。

---

### 步骤 7：建立第一批 Eval Case 和 EvalRunner

**目标**：第一批可运行的 Eval 回归集，能输出指标对比。

**新增**：
- `EvalCase` 记录
- `EvalRunner`——加载 Eval Case，逐条执行评测，对比预期指标，输出 report
- `src/test/resources/eval/cases/java-concurrency-v1.json`（至少 20 个 case，覆盖 8 种回答类型）
- `EvalRunnerTest.java`——验证所有 case 格式合法、指标可计算

**完成标准**：
- `EvalRunner.run()` 输出每个 case 的 covered recall、missing recall、incorrect FPR、score range pass、结构化输出首次成功率
- 全量 Eval 在 5 分钟内完成
- 与上一版本指标可对比

**Commit Message**：`feat: add Eval regression dataset and runner with 20+ cases`

**明确不做什么**：不自动对比历史版本（手动对比即可）、不 CI 集成。

---

## 阶段 B：可用面试 MVP（步骤 8-13）

> 目标：实现完整面试状态机和追问闭环，通过 REST API 完成一场 5 题面试。
> 此时仍不接入数据库（内存存储）。

### 步骤 8：实现内存版 InterviewSession 和状态机

**目标**：定义面试状态机并实现状态流转。

**新增**：
- `InterviewSession` 类（domain）
- `InterviewStatus` 枚举：CREATED, WAITING_FOR_ANSWER, EVALUATING, DECIDING_NEXT_STEP, COMPLETED, ABORTED
- `SessionStateMachine`——管理状态转换，校验合法转换路径
- `InMemorySessionRepository`（存储到 ConcurrentHashMap）
- `InterviewTurn` 记录 + `TurnType` 枚举
- `SessionStateMachineTest.java`——所有合法/非法状态转换
- `InMemorySessionRepositoryTest.java`

**完成标准**：
- 状态机拒绝非法转换（如直接从 WAITING_FOR_ANSWER 跳到 COMPLETED）
- 创建、查询、更新会话功能正常

**Commit Message**：`feat: implement InterviewSession with explicit state machine`

**明确不做什么**：不接入数据库（内存版）、不支持持久化。

---

### 步骤 9：实现 InterviewOrchestrator

**目标**：实现面试流程编排，协调状态机、评测和追问。

**新增**：
- `InterviewOrchestrator`（application 层）——startInterview、submitAnswer、endInterview
- `QuestionSelector` 接口 + `SimpleQuestionSelector`（顺序或随机选题）
- `InterviewOrchestratorTest.java`

**完成标准**：
- `startInterview(topic, questionCount)` 创建会话，选择第一道题
- `submitAnswer(sessionId, answer)` 触发评测 → 状态转换 → 返回下一动作
- `endInterview(sessionId)` 结束会话

**Commit Message**：`feat: implement InterviewOrchestrator with question selection`

**明确不做什么**：不实现个性化出题（始终用 SimpleQuestionSelector）、不接入 Web。

---

### 步骤 10：实现 FollowUpPolicy

**目标**：Java 代码决定是否追问，模型只提议追问方向。

**新增**：
- `FollowUpPolicy` 接口 + `RuleBasedFollowUpPolicy`
- `FollowUpDecision`、`FollowUpDirection` 记录
- `FollowUpGenerator`——将 `FollowUpDirection` 转换为自然语言追问
- `FollowUpPolicyTest.java`——各种评测结果下的追问决策
- `FollowUpGeneratorTest.java`

**完成标准**：
- 存在 `importance=high` missing point 或 `severity=critical` incorrect claim → 追问
- 所有 missing/incorrect 都是 minor → 不追问，进入下一题
- 连续 2 次 `completeness >= 8` → 可以不追问进入下一题
- 每道主问题最多追问 3 次

**Commit Message**：`feat: implement FollowUpPolicy with rule-based decision`

**明确不做什么**：不让模型决定是否追问。

---

### 步骤 11：实现追问生成

**目标**：生成自然语言的追问文本，并在上下文中正确关联。

**新增**：
- `FollowUpGenerator` 改用模型生成追问文本
- 修改 `InterviewTurn` 支持 `turnType=FOLLOW_UP`，sequence_number 接在主问题之后

**修改**：
- `InterviewOrchestrator`——追问流程集成

**完成标准**：追问正确显示在面试上下文中，sequence_number 连续，主问题 + 追问形成完整链。

**Commit Message**：`feat: integrate follow-up generation into orchestrator`

**明确不做什么**：不生成"听起来像新问题"的追问（始终明确这是追问）。

---

### 步骤 12：暴露 REST API

**目标**：通过 HTTP API 完成面试交互。

**新增**：
- `InterviewController`（api 层）
  - `POST /api/v1/interviews/start` —— `{ "topic": "java-concurrency", "questionCount": 5 }`
  - `POST /api/v1/interviews/{sessionId}/answer` —— `{ "answer": "..." }`
  - `GET /api/v1/interviews/{sessionId}/status`
  - `POST /api/v1/interviews/{sessionId}/end`
- `InterviewControllerTest.java`（`@WebMvcTest`）

**完成标准**：通过 curl 或 HTTP client 发起一场面试，完成问答、收到评测结果和追问。

**Commit Message**：`feat: expose interview REST API`

**明确不做什么**：不做用户认证（先单用户）、不做 WebSocket/SSE（REST 先跑通）。

---

### 步骤 13：端到端测试 — 完成一场 5 题面试

**目标**：自动化端到端测试，验证完整流程。

**新增**：
- `InterviewE2ETest.java`——启动 Spring Boot Test，模拟一场 5 题面试
- 验证：5 道题全部完成、追问次数在配置范围内、每次回答都有评测结果

**完成标准**：端到端测试通过，5 题面试（含追问）在 2 分钟内完成。

**Commit Message**：`test: add end-to-end 5-question interview test`

**明确不做什么**：不接入前端、不实现实时流式输出。

---

## 阶段 C：持久化和证据化（步骤 14-21）

> 目标：接入 PostgreSQL，实现能力证据和复盘报告。
> 服务重启后可恢复面试会话。

### 步骤 14：建表 + Flyway

**目标**：建好第一版所有表，Flyway 管理迁移。

**新增**：
- `src/main/resources/db/migration/V1__init.sql`——question, question_version, interview_session, interview_turn, evaluation_run, mastery_evidence, agent_state, processed_request
- Flyway 自动配置（Spring Boot auto-config 已包含）

**完成标准**：应用启动时 Flyway 自动建表，`\dt` 列出 8 张表。

**Commit Message**：`feat: add Flyway migration with initial schema`

**明确不做什么**：不加索引优化（第一版够用即可）、不加分区表。

---

### 步骤 15：PostgreSQL Repository 实现

**目标**：用 JDBC（或 JPA）实现持久化，替换内存存储。

**新增**：
- `JdbcSessionRepository`（替换 InMemorySessionRepository）
- `JdbcTurnRepository`
- `JdbcQuestionRepository`
- `JdbcSessionRepositoryTest.java`（用 Testcontainers PostgreSQL）

**完成标准**：所有 Repository 能正确 CRUD，并发创建不抛异常。

**Commit Message**：`feat: implement PostgreSQL repositories`

**明确不做什么**：不引入 JPA/Hibernate（JDBC 更可控，方便后续对比 ORM）、不引入 Redis 缓存。

---

### 步骤 16：幂等和乐观锁

**目标**：重复提交不会重复调用模型，并发更新不会覆盖。

**新增**：
- `ProcessedRequestRepository`——`INSERT ... ON CONFLICT DO NOTHING`，返回已有 resultRef
- 修改 `InterviewSession` 更新逻辑：`UPDATE ... WHERE version = ?`
- 修改 `AgentState` 更新逻辑：同上
- `IdempotencyTest.java`——重复提交同一 requestId
- `OptimisticLockTest.java`——并发更新 session

**完成标准**：
- 重复 `POST /answer` 同一 requestId，只评测一次
- 并发更新同一 session，后者收到 `OptimisticLockException`

**Commit Message**：`feat: add idempotency and optimistic locking`

**明确不做什么**：不实现分布式锁（单实例足够）。

---

### 步骤 17：EvaluationRun 持久化

**目标**：每次评测执行记录持久化到 evaluation_run 表。

**修改**：
- `EvaluationService`——评测完成后写入 `evaluation_run` 表
- 记录 prompt_version、rubric_version、model_name、raw_output、parsed_result、retry_count、latency_ms

**完成标准**：每此评测在 evaluation_run 表中有一条记录，可追溯到 turn 和版本。

**Commit Message**：`feat: persist EvaluationRun with version tracking`

**明确不做什么**：不实现评测结果缓存。

---

### 步骤 18：MasteryEvidence 持久化

**目标**：将 covered/missing/incorrect 知识点转化为 MasteryEvidence 持久化。

**新增**：
- `MasteryEvidenceRepository`
- 修改 `EvaluationService`——评测完成后提取 coveredPoints/missingPoints/incorrectClaims，写入 `mastery_evidence` 表

**完成标准**：每次评测产生 N 条 MasteryEvidence（N = covered + missing + incorrect 知识点数），每条可追溯到 turn_id 和 evaluation_run_id。

**Commit Message**：`feat: persist MasteryEvidence linked to turns and evaluations`

**明确不做什么**：不实现复杂的知识图谱（简单 evidence 即可）、不实现自动标签。

---

### 步骤 19：SkillMasteryCalculator

**目标**：根据 MasteryEvidence 计算每个知识点的掌握程度。

**新增**：
- `SkillMasteryCalculator`——聚合用户在某知识点上的所有 evidence
- 输出：`SkillMastery` 记录（knowledgePointCode, coverageRate, avgConfidence, trend, lastUpdated）
- `SkillMasteryCalculatorTest.java`

**完成标准**：
- 同一知识点被多次标记 covered → coverageRate 高
- 最近一次为 missing → trend 下降
- 未出现过 → 返回 UNKNOWN

**Commit Message**：`feat: implement SkillMasteryCalculator from evidence`

**明确不做什么**：不实现复杂的 skill 进化模型（简单统计即可）。

---

### 步骤 20：证据化复盘报告

**目标**：生成可读的复盘报告，所有结论都可追溯到具体 turn 和 evaluation。

**新增**：
- `ReportGenerator`——基于 session、turns、evaluations、evidence 生成报告
- 报告内容：题目列表、每题的分数和 evidence、弱点分析、改进建议
- `ReportGeneratorTest.java`

**完成标准**：生成的报告中每条"掌握/不掌握"的结论都有对应 evidence 引用。

**Commit Message**：`feat: generate evidence-backed interview report`

**明确不做什么**：不生成 HTML/PDF（JSON + Markdown 即可）、不支持导出。

---

### 步骤 21：服务重启恢复会话

**目标**：服务重启后，停留在 EVALUATING 或 DECIDING_NEXT_STEP 的会话可恢复。

**新增**：
- `SessionRecoveryService`——启动时扫描非终态会话，重置为 WAITING_FOR_ANSWER
- 恢复时通知用户"上次回答未被评测，请重新回答"

**完成标准**：
- 模拟 EVALUATING 中杀进程 → 重启 → 会话恢复为 WAITING_FOR_ANSWER
- COMPLETED 的会话不受影响

**Commit Message**：`feat: recover interrupted sessions on startup`

**明确不做什么**：不实现热备（冷启动恢复即可）。

---

## 阶段 D：Mini Harness（步骤 22-30）

> 目标：抽出通用 Agent Runtime，独立于 Interview 业务。
> Mini Harness 可以独立使用和测试，不依赖 Interview 领域模型。

### 步骤 22：创建 mini-harness-core 包

**目标**：在现有单模块中创建独立包 `com.zhouwy.harness`，零业务依赖。

**新增**：
- `com.zhouwy.harness` 包
- `package-info.java`——说明 Mini Harness 的职责和边界
- `AgentLimits` 记录

**完成标准**：`harness` 包不 import 任何 `com.zhouwy.interview` 类。

**Commit Message**：`feat: create mini-harness-core package with zero business dependency`

**明确不做什么**：不拆 Maven 模块（先包级隔离）。

---

### 步骤 23：定义核心接口

**目标**：定义 Mini Harness 的全部接口。

**新增**（全部在 `com.zhouwy.harness` 包下）：
- `ModelGateway`（从 interview 移到 harness 或保留在 domain 作为共享接口）
- `AgentRuntime` 接口
- `AgentStateStore` 接口
- `AgentHook` 接口
- `AgentTool` 接口
- `ToolRegistry` 接口
- `ContextPolicy` 接口
- `AgentRequest`、`AgentResult`、`AgentEvent`、`AgentState`、`AgentSessionKey`、`RuntimeContext` 记录

**测试**：接口编译通过，无循环依赖。

**完成标准**：所有接口定义清晰，每个接口有 javadoc。

**Commit Message**：`feat: define Mini Harness core interfaces`

**明确不做什么**：不实现任何接口（只定义）。

---

### 步骤 24：实现单轮 AgentRuntime

**目标**：实现最简单的 AgentRuntime——无 Hook、无工具、无循环。

**新增**：
- `SimpleAgentRuntime`——加载 AgentState → 准备 context → 调用 ModelGateway → 保存 AgentState → 返回 AgentResult
- `InMemoryAgentStateStore`
- `SimpleAgentRuntimeTest.java`

**完成标准**：`AgentRuntime.execute(request)` 成功调用模型并返回结果。

**Commit Message**：`feat: implement single-turn AgentRuntime`

**明确不做什么**：不支持 Hook、不考虑 Tool Calling、不考虑循环。

---

### 步骤 25：实现 Hook Chain

**目标**：支持在模型调用前后插入自定义 Hook。

**新增**：
- `AgentHookChain`——有序执行多个 Hook
- 修改 `SimpleAgentRuntime`——集成 HookChain
- `LoggingHook`（before/after 日志）
- `TimingHook`（记录延迟）
- `AgentHookChainTest.java`

**完成标准**：
- `beforeModel` 按注册顺序执行
- `afterModel` 按注册逆序执行
- Hook 异常不影响主流程（捕获 + 日志）

**Commit Message**：`feat: implement AgentHook chain with ordered execution`

**明确不做什么**：不支持异步 Hook、不支持 Hook 返回值修改 context。

---

### 步骤 26：实现 AgentStateStore（JDBC 版）

**目标**：基于 JDBC 实现 AgentStateStore，支持乐观锁。

**新增**：
- `JdbcAgentStateStore`——操作 `agent_state` 表
- `JdbcAgentStateStoreTest.java`

**完成标准**：
- `load(key)` 返回已有状态或 empty
- `save(key, state, expectedVersion)` 成功保存
- 版本冲突时抛出 `OptimisticLockException`

**Commit Message**：`feat: implement JDBC-backed AgentStateStore with optimistic lock`

**明确不做什么**：不支持 Redis 版 StateStore、不支持内存版 StateStore（直接用 JDBC）。

---

### 步骤 27：实现类型化 AgentEvent

**目标**：Agent Runtime 输出类型化事件流，支持外部监听。

**新增**：
- `AgentEvent` 密封类/接口——`ModelCallStarted`、`ModelCallCompleted`、`ToolCallRequested`、`ToolCallCompleted`、`HookExecuted`、`ErrorOccurred`、`RunCompleted`
- 修改 `SimpleAgentRuntime`——每个关键节点 emit 对应事件
- `AgentEventTest.java`

**完成标准**：调用方可以通过事件流追踪一次 Agent 执行的完整生命周期。

**Commit Message**：`feat: add typed AgentEvent stream to runtime`

**明确不做什么**：不基于 Reactor（先用同步事件回调，后期需要流式时再引入）。

---

### 步骤 28：实现受限 Tool Loop

**目标**：Agent 可以调用工具，但受严格限制。

**新增**：
- `ToolRegistry` 实现——`Map<String, AgentTool>`
- `DefaultToolRegistry`
- 修改 `SimpleAgentRuntime`——检查 ToolCall → 校验权限 → 执行 → 写入 ToolResult → 判断是否继续循环
- 两个只读工具：`LoadQuestionContextTool`、`LoadSkillHistoryTool`
- `ToolLoopTest.java`——正常调用、权限拒绝、达到 maxIterations、重复调用同一工具

**完成标准**：
- Agent 在评测时可以调用 `load_question_context` 获取题目背景
- 调用写类工具时被拒绝并记录日志
- 达到 `maxIterations` 或 `maxToolCalls` 时停止循环

**Commit Message**：`feat: implement constrained tool calling loop with permission check`

**明确不做什么**：不支持动态注册工具（启动时注册即可）、不实现 MCP。

---

### 步骤 29：实现 ContextPolicy

**目标**：控制发送给模型的上下文大小和内容。

**新增**：
- `DefaultContextPolicy`——保留最近 N 条消息 + Summary，截断超出部分
- 修改 `SimpleAgentRuntime`——调用模型前应用 ContextPolicy
- `ContextPolicyTest.java`

**完成标准**：
- 上下文消息数超过 `maxMessages` 时，只保留最近的 `maxMessages` 条
- 被截断的部分生成 Summary（调用模型压缩或简单截断）
- 不修改原始 AgentState 中的完整消息历史

**Commit Message**：`feat: implement ContextPolicy with message window and summary`

**明确不做什么**：不实现复杂的 sliding window 算法（简单截断+摘要）。

---

### 步骤 30：将评测、追问和报告接入 Mini Harness

**目标**：将阶段 B/C 的 Interview 功能迁移到 Mini Harness 之上。

**修改**：
- `EvaluationService`——使用 `AgentRuntime` 代替直接调用 `ModelGateway`
- `FollowUpGenerator`——使用 `AgentRuntime`
- `InterviewOrchestrator`——通过 `AgentRuntime` 管理模型交互
- `EvaluationServiceTest.java`——验证通过 Mini Harness 的评测结果与直接调用一致

**完成标准**：所有阶段 B/C 的测试通过，Eval 指标不退化。

**Commit Message**：`refactor: migrate evaluation and follow-up to Mini Harness runtime`

**明确不做什么**：不改变业务逻辑（行为保持完全一致）。

---

## 阶段 E：AgentScope 源码学习（步骤 31-38）

> 目标：对照 AgentScope 源码，理解设计差异，产出学习文档。
> 此阶段不修改业务代码，仅写文档和实验代码。

### 步骤 31-38：逐一研究，对比记录

每步格式：
1. 我先实现什么（对应 Mini Harness 的某个组件）
2. 我带着什么问题读源码
3. AgentScope 怎么实现
4. 我的实现与它有什么差异
5. 哪些应该借鉴
6. 哪些不应该照搬

| 步骤 | 研究主题 | 产出文档 |
|---|---|---|
| 31 | ReActAgent 和 Agent Loop | `docs/source-study/01-agent-loop.md` |
| 32 | RuntimeContext 和 Msg 上下文 | `docs/source-study/02-runtime-context.md` |
| 33 | AgentStateStore 和状态持久化 | `docs/source-study/03-state-store.md` |
| 34 | Middleware 和 Hook | `docs/source-study/04-middleware.md` |
| 35 | streamEvents 和事件流 | `docs/source-study/05-event-stream.md` |
| 36 | Compaction 和上下文压缩 | `docs/source-study/06-context-compaction.md` |
| 37 | Workspace、Skill、Memory | `docs/source-study/07-workspace-skill-memory.md` |
| 38 | 整体对比总结 | `docs/source-study/README.md` |

**Commit Message**（每个步骤）：`docs: source study — [主题] comparison with AgentScope`

**明确不做什么**：不修改 Mini Harness 代码（纯学习阶段）。如果发现值得借鉴的设计，记录到 ADR 中，阶段 F 再实现。

---

## 阶段 F：Adapter 与工程化（步骤 39-44）

> 目标：实现 AgentScope Adapter，完成工程化收尾。

### 步骤 39：实现 AgentScopeRuntimeAdapter

**目标**：用 AgentScope ReActAgent 实现 `AgentRuntime` 接口。

**新增**：
- `AgentScopeRuntimeAdapter`——实现 `AgentRuntime`，内部委托给 AgentScope ReActAgent
- 翻译层：Mini Harness 的 `AgentRequest` → AgentScope 的 `Msg/AgentState`
- `AgentScopeRuntimeAdapterTest.java`

**完成标准**：同一接口 `AgentRuntime` 有两个实现（SimpleAgentRuntime 和 AgentScopeRuntimeAdapter），可以互换。

**Commit Message**：`feat: implement AgentScopeRuntimeAdapter`

**明确不做什么**：不实现完整的 AgentScope 所有功能（只实现 ReActAgent 核心路径）。

---

### 步骤 40：用同一批 Eval 对比两种 Runtime

**目标**：量化对比自研 Runtime 和 AgentScope Runtime。

**新增**：
- `RuntimeComparisonTest.java`——同一批 Eval Case 分别用两种 Runtime 执行
- 对比：评测结果一致性、延迟、token 消耗、结构化输出成功率

**完成标准**：输出对比报告，明确两种 Runtime 的差异和各自优势。

**Commit Message**：`test: compare Mini Harness vs AgentScope Runtime with same Eval set`

**明确不做什么**：不写长篇对比文章（数据表格 + 简要分析即可）。

---

### 步骤 41：增加 SSE

**目标**：支持服务端推送事件（流式输出、状态变更通知）。

**新增**：
- `InterviewSseController`——`GET /api/v1/interviews/{sessionId}/stream`
- 推送：评测开始、评测完成、追问生成、面试结束
- `InterviewSseTest.java`

**完成标准**：客户端可通过 SSE 接收面试过程中的实时事件。

**Commit Message**：`feat: add SSE streaming for interview events`

**明确不做什么**：不实现 WebSocket（SSE 够用）。

---

### 步骤 42：增加可观测性

**目标**：基于 Micrometer 暴露指标。

**新增**：
- 按 [技术方案 17 节](./interview-harness-deep-research.md#17-可观测性设计) 定义的所有指标
- `MetricsHook`（Mini Harness Hook，自动记录每次调用的延迟和 token）
- Actuator endpoint 暴露指标

**完成标准**：`/actuator/metrics` 可查到所有定义的指标。

**Commit Message**：`feat: add Micrometer metrics and observability`

**明确不做什么**：不引入 OpenTelemetry Exporter（Micrometer 先够用）。

---

### 步骤 43：增加故障测试

**目标**：对 [技术方案 16 节](./interview-harness-deep-research.md#16-故障场景设计) 的 14 个场景编写自动化测试。

**新增**：
- `FaultToleranceTest.java`——模拟超时、非法 JSON、工具失败、乐观锁冲突、服务重启恢复等
- 使用 WireMock 或 OkHttp MockWebServer 模拟模型超时

**完成标准**：14 个故障场景至少覆盖 10 个，每个有明确的 expected behavior。

**Commit Message**：`test: add fault tolerance tests for 10+ failure scenarios`

**明确不做什么**：不追求 100% 场景覆盖（SSE 中断等难以自动化）。

---

### 步骤 44：完成 README、ADR 和演示脚本

**目标**：项目文档齐全，新读者可快速理解并运行。

**新增**：
- `README.md`——项目介绍、快速开始、架构概览、开发指南
- `docs/adr/`——关键架构决策记录（为什么选 Spring AI、为什么不拆微服务、为什么不用 LangChain4j 等）
- `scripts/demo.sh`——演示脚本（启动 → 发起面试 → 完成 3 题 → 查看报告）

**完成标准**：
- 新读者按 README 能在 10 分钟内启动并完成一场面试
- 每个 ADR 说明决策背景、选项、理由和后果

**Commit Message**：`docs: add README, ADR, and demo script`

**明确不做什么**：不写花哨的徽章、贡献指南等（个人项目不需要）。

---

## 阶段完成后可做什么

44 步完成后，系统具备：
- 完整的面试训练闭环（出题 → 回答 → 评测 → 追问 → 证据 → 复盘）
- Eval 回归验证机制
- 可替换的 Agent Runtime（自研 + AgentScope Adapter）
- 故障恢复和可观测性

此后的扩展（RAG、多 Agent、MCP、知识图谱等）在产生真实需要时再引入。目前仓库中的 [RAG 设计方案](../rag-agent/rag-interview-design.md) 可以作为未来扩展的参考。

---

*文档版本：v1.0*
*最后更新：2026-07-09*
