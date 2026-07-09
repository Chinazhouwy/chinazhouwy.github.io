---
title: "Interview Harness — 技术方案与开发路线"
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
summary: "基于 Spring AI 模型抽象、自研 Mini Harness 和显式业务状态机的面试训练系统。重点解决 Rubric 评测、追问闭环、能力证据和 Eval 回归，而非普通 AI 模拟面试聊天页面。"
tags:
  - interview
  - harness
  - agent
  - spring-ai
  - eval
  - java
---

# Interview Harness — 技术方案与开发路线

> **状态**：规划文档，尚未开始编码。
> **相关文档**：[实现路线图](./interview-harness-implementation-roadmap.md)（每个阶段的详细步骤、类和验收标准）。

---

## 1. 我为什么要做 Interview Harness

刷了 55 道面试题之后，我发现普通 AI 模拟面试有几个根本问题：

- **AI 经常在回答表面正确时直接说"回答得很好"。** 真人面试官不会这样——他会追问边界条件、原理层次、源码细节和极端场景，直到确认你是"真正理解"还是"恰好说对"。
- **缺少针对回答缺口的连续追问。** 当前的练习模式是我答一道，AI 评一道，然后换下一道。但在真实面试中，追问才是最暴露水平的环节。
- **缺少稳定、可解释、可回归的评测。** 每次评分依赖 Prompt 和模型的即时判断，评分标准在多次对话间漂移。改了 Prompt 之后，不知道系统是变好了还是变坏了。
- **缺少跨多次训练积累的能力证据。** 55 道题的数据分散在独立 markdown 文件中。我看得到每道题的分数，但看不到"线程池"这个知识点我到底掌握了没有——是某次碰巧答对，还是每次都能稳定覆盖关键点。
- **普通 AI 面试项目只调用框架 API，无法体现对 Agent 机制的理解。** 市面上大多数"AI 模拟面试"只是 `ChatModel.call(prompt)` 包装一层聊天 UI。这对求职没有说服力。

这个项目不是要做另一个"能聊天的面试页面"。它要解决的问题是：**发现"似乎知道"和"真正掌握"之间的差距，连续追问直到确认边界，记录证据并验证进步。**

---

## 2. 项目最终要解决什么问题

完整闭环：

```text
选择训练主题
→ 选择问题
→ 用户回答
→ Rubric 评测（带证据的评分）
→ 识别 CoveredPoint / MissingPoint / IncorrectClaim
→ Java Policy 决定是否追问
→ 用户继续回答
→ 记录 MasteryEvidence（可追溯到具体 turn 和 evaluation）
→ 生成复盘报告
→ 下一次优先训练薄弱点
→ Eval 回归验证系统改动没有退化
```

这个闭环的核心不是"模型有多聪明"，而是**确定性代码约束非确定性模型**——模型负责语义理解和缺口识别，Java 代码负责状态流转、追问决策和证据持久化。

---

## 3. 为什么不直接使用 AgentScope Harness

AgentScope 的 `HarnessAgent` 解决的是通用 Agent 评测问题：给定一个 Agent、一组数据集和一套评测指标，自动运行并统计结果。它关注的是 **Agent 能力的基准测试**。

Interview Harness 解决的是面试训练问题：管理面试会话、根据 Rubric 评测单次回答、决定是否追问、记录能力证据、生成复盘报告。它关注的是**面试者的能力成长**。

两者的交集：都需要调用模型、管理上下文、执行评测。

两者不能互相替代的部分：

| | AgentScope Harness | Interview Harness |
|---|---|---|
| 会话模型 | 无状态或简单状态 | 显式业务状态机（CREATED → WAITING → EVALUATING → DECIDING） |
| 评测对象 | Agent 行为 | 人类回答（知识点覆盖、遗漏、错误） |
| 追问机制 | 不在范围内 | 核心能力——Java Policy 控制追问次数和方向 |
| 证据持久化 | 评测结果 | MasteryEvidence + SkillMasteryCalculator |
| 业务数据库 | 无 | PostgreSQL + Flyway |

如果第一版直接用 HarnessAgent 托管整个业务流程，会隐藏最值得学习的机制：**Agent 实例为什么可以无状态、状态在什么时机加载和保存、工具循环如何停止、Hook 的执行顺序、类型化事件如何传播。**

AgentScope 的正确定位是：**作为源码教材、设计对照和后期可替换的 Runtime Adapter**，而不是第一版的黑盒底座。

---

## 4. 为什么主模型接入层选择 Spring AI

**通用性**：Spring AI 在 Java 招聘市场中的认可度远高于 LangChain4j。大多数 Spring 团队选型时会优先考虑 Spring 官方生态项目。

**生态结合**：与 Spring Boot 的自动配置、Actuator、Micrometer 无缝集成，不需要额外适配层。

**能力范围**：Spring AI 提供 `ChatModel` 统一抽象、结构化输出（`BeanOutputConverter`）、Tool Calling（`@Tool` 注解）、Observability（自动记录 token 和延迟）。这些正是 Interview Harness 需要的底层能力。

**为什么只把它作为模型连接器和底层适配层**：

- Spring AI 的 `Advisor` 和 `QuestionAnswerAdvisor` 适合简单 RAG 场景，不适合需要显式状态机的面试流程。
- 不让 Spring AI 的类型（如 `ChatModel`、`Prompt`）泄漏到 Domain 层和 Application 层。Domain 只定义自己的 `ModelGateway` 接口，由 `model-spring-ai` 模块实现。
- 框架的 Tool Calling 循环由 Spring AI 驱动，但**工具权限校验、循环次数限制、失败处理**由 Mini Harness 控制。

---

## 5. 为什么当前不选择 LangChain4j 作为主线

**LangChain4j 的优点**：声明式 AI Service（`@SystemMessage`、`@UserMessage`）写起来非常方便；内置 RAG 组件（`EasyRag`）；多模型支持成熟。

**但为什么当前不用**：

- 声明式 AI Service 的便利会隐藏模型调用的生命周期——对于 Interview Harness，我们需要精确控制每次调用的上下文、token 消耗和重试策略，而不是让框架自动管理。
- LangChain4j 的 `AiServices` 和 Spring AI 的 `ChatModel` 抽象层次不同，混用会增加认知负担。
- **后期可以实现一个 LangChain4j Adapter 做横向比较。** 比如用同一批 Eval Case，对比 Spring AI 和 LangChain4j 在结构化输出的首次成功率、延迟和 token 消耗上的差异。这是很好的工程判断展示。

当前原则：**不在主项目混入多套框架。** Spring AI 一条主线走通，LangChain4j 作为后期对比实验。

---

## 6. 总体架构

### 6.1 最终模块划分（规划）

```text
interview-harness-parent
├── interview-domain          # 领域模型，不依赖任何框架
├── interview-application     # 业务用例编排，只依赖 domain 接口
├── interview-api             # REST API（Spring Web），依赖 application
├── interview-infrastructure  # 基础设施实现
├── mini-harness-core         # 轻量 Agent Runtime，不依赖 interview 业务
├── model-spring-ai           # Spring AI ChatModel 适配
├── runtime-agentscope-adapter # AgentScope Runtime 适配（后期）
├── persistence-postgres      # PostgreSQL Repository 实现 + Flyway
└── interview-eval            # Eval 回归数据集和执行器
```

依赖方向：

```text
api → application → domain ← infrastructure
                         ← persistence-postgres
                         ← model-spring-ai
mini-harness-core（独立，不依赖 interview）
eval → application + model-spring-ai
```

关键约束：

- **Domain 不依赖 Spring、Spring AI、AgentScope。** 只使用纯 Java + 标准库。
- **Application 只依赖自己定义的接口（Port）。** 具体实现由 infrastructure 提供。
- **Spring AI 和 AgentScope 被隔离在 Adapter 模块。**
- **Mini Harness 不依赖 Interview 业务。** 它是一个通用 Agent Runtime，可以独立使用和测试。

### 6.2 第一阶段实际结构

第一阶段**不拆模块**。在单 Maven 模块中按包划分，达到明确复杂度后再拆：

```text
interview-harness/
└── src/main/java/com/zhouwy/interview/
    ├── domain/           # 领域模型（纯 POJO + 接口）
    ├── application/      # 业务用例
    ├── api/              # REST Controller
    ├── infrastructure/   # Spring AI 适配、PostgreSQL Repository
    └── harness/          # Mini Harness（独立包，零业务依赖）
```

过早模块化是当前文章最大的问题之一。第一阶段只有一个 `pom.xml`，依赖只有 `spring-boot-starter-web`、`spring-ai-openai-spring-boot-starter`、`spring-boot-starter-jdbc`（或 JPA）、`flyway-core`、`postgresql`、`testcontainers`。

---

## 7. Interview 业务领域模型

### 7.1 核心对象

| 对象 | 职责 | 关键字段 |
|---|---|---|
| `InterviewSession` | 一次面试的生命周期 | sessionId, userId, status, currentQuestionId, followUpCount, maxFollowUps, totalQuestions, completedQuestions |
| `InterviewTurn` | 一次问答交互（主问题或追问） | turnId, sessionId, questionId, turnType (MAIN_QUESTION/FOLLOW_UP), userAnswer, sequenceNumber |
| `InterviewStatus` | 面试状态枚举 | CREATED, WAITING_FOR_ANSWER, EVALUATING, DECIDING_NEXT_STEP, COMPLETED, ABORTED |
| `TurnType` | 区分主问题和追问 | MAIN_QUESTION, FOLLOW_UP |
| `InterviewQuestion` | 面试题目定义 | questionCode, title, content, topic, difficulty, knowledgePoints |
| `QuestionVersion` | 题目版本（为什么需要版本化见下文） | questionCode, versionNumber, content, rubricTemplate, createdAt |
| `KnowledgePoint` | 细粒度知识点 | code, name, topic, parentCode |
| `EvaluationRun` | 一次评测执行记录 | runId, turnId, promptVersion, rubricVersion, modelName, rawOutput, parsedResult, retryCount, latency |
| `MasteryEvidence` | 能力证据（可追溯到 turn 和 evaluation） | evidenceId, userId, knowledgePointCode, turnId, evaluationRunId, evidenceType (COVERED/MISSING/INCORRECT), confidence, createdAt |
| `InterviewReport` | 单次面试复盘报告 | reportId, sessionId, summary, scoreBreakdown, weakAreas, recommendations |

### 7.2 关键设计决策

**为什么问题需要版本化？**

修改评测 Rubric 或题目措辞后，旧回答的评测结果需要能追溯到当时的题目版本。否则改完题目后，Eval 回归无法判断是"题目变好了"还是"模型变差了"。

**为什么一次回答可以有多次 EvaluationRun？**

因为可能发生：第一次评测返回非法 JSON 需要重试、换了模型重新评测做对比、改了 Prompt 后回填评测。每次评测都记录 `promptVersion`、`rubricVersion` 和 `modelName`。

**为什么主问题和追问都应该是 InterviewTurn？**

结构统一。追问只是 `turnType=FOLLOW_UP`、`sequenceNumber` 接在主问题之后的 Turn。这样所有交互都有统一的事件序列，复盘时能看到完整追问链。

**为什么能力画像不能只是一个 JSON 总结？**

JSON 总结（"线程池：7 分"）无法回答：这 7 分基于哪几次评测？覆盖了哪些知识点？遗漏了哪些？每次评测的 confidence 是多少？`MasteryEvidence` 必须能追溯到具体的 turn、evaluation 和 knowledgePoint。

---

## 8. Rubric 评测设计

### 8.1 评测不是"给一个分"

每次评测返回结构化结果，必须包含：

```json
{
  "evaluationRunId": "ev_20260709_001",
  "questionCode": "JAVA-001",
  "score": 6,
  "scoreBreakdown": {
    "correctness": 7,
    "completeness": 5,
    "depth": 6,
    "structure": 6,
    "communication": 7
  },
  "coveredPoints": [
    {
      "knowledgePointCode": "KP-THREADPOOL-PARAMS",
      "evidence": "正确说明了 corePoolSize 和 maxPoolSize 的区别",
      "confidence": 0.95
    }
  ],
  "missingPoints": [
    {
      "knowledgePointCode": "KP-THREADPOOL-REJECTION",
      "description": "未提及四种拒绝策略及其适用场景",
      "importance": "high"
    }
  ],
  "incorrectClaims": [
    {
      "claim": "线程池线程数越多越好",
      "correction": "线程数受 CPU 核心数、IO 密集度和内存限制",
      "severity": "critical"
    }
  ],
  "followUpSuggestions": [
    {
      "direction": "询问在 IO 密集型场景下如何估算线程数",
      "targetKnowledgePoint": "KP-THREADPOOL-SIZING",
      "priority": "high"
    }
  ],
  "overallComment": "核心参数理解正确，但缺少拒绝策略和线程数估算的讨论。",
  "promptVersion": "v1.2.0",
  "rubricVersion": "v1.2.0",
  "modelName": "gpt-4o-mini",
  "rawOutput": "{...原始模型输出...}"
}
```

**评分必须带证据，不能只返回一个 8 分。** 每个 `coveredPoint` 必须有 `evidence`（引用用户原话或总结），每个 `missingPoint` 和 `incorrectClaim` 必须有明确的 `knowledgePointCode`。

### 8.2 评测偏差控制

- **结构化输出校验**：`EvaluationResultValidator` 校验 JSON Schema、score 范围、必填字段、knowledgePointCode 是否存在。
- **非法输出重试**：最多重试 2 次（共 3 次调用），每次记录 `retryCount` 和 `rawOutput`。3 次均失败则标记为 `EVALUATION_FAILED`，人工介入。
- **同一回答多次评测**：Eval 模式下可以用不同模型跑同一 case，对比稳定性。

---

## 9. FollowUpPolicy 设计

**核心原则：模型只提出缺口和追问意图，Java Policy 决定是否追问。**

```java
public interface FollowUpPolicy {
    /**
     * 根据评测结果决定是否追问。
     *
     * @return FollowUpDecision 包含是否追问、追问方向和优先级
     */
    FollowUpDecision decide(EvaluationResult result, InterviewSession session);
}

public record FollowUpDecision(
    boolean shouldFollowUp,
    List<FollowUpDirection> directions,  // 按优先级排序
    String reason                        // 决策理由（用于日志和复盘）
) {}

public record FollowUpDirection(
    String targetKnowledgePoint,
    String suggestedAngle,
    Priority priority
) {}
```

**规则**：

- 每道主问题最多追问 **3 次**（可配置）。
- 只有当存在 `importance=high` 或 `severity=critical` 的 missing/incorrect 时才追问。
- 追问方向由模型提议（"建议追问线程数估算"），但具体追问措辞由 `FollowUpGenerator` 生成，然后由模型润色。
- 连续 2 次回答 `completeness >= 8` 时可以提前进入下一题（即使还有 minor missing）。
- 总面试题数达到 `maxQuestions` 或 `COMPLETED` 信号触发时结束。

---

## 10. Eval 回归体系

> **没有 Eval，项目就不能真正称为 Harness。**

### 10.1 Eval Case 定义

```java
public record EvalCase(
    String caseCode,
    String questionCode,
    String candidateAnswer,
    List<String> expectedCoveredKnowledgePoints,
    List<String> expectedMissingKnowledgePoints,
    List<String> expectedIncorrectKnowledgePoints,
    Range expectedScoreRange,       // e.g., [4, 7]
    List<String> expectedFollowUpIntents,
    String description              // 这个 case 测什么
) {}
```

### 10.2 第一批样本覆盖

第一批至少 20 个 case，覆盖：

| 类型 | 示例 |
|---|---|
| 优秀回答 | 完整覆盖所有知识点，表述清晰 |
| 部分正确 | 核心对了但遗漏关键边界 |
| 严重错误 | 基本概念混淆 |
| 听起来专业但遗漏关键点 | 术语多但缺少深度——最危险的类型 |
| 自相矛盾 | 前半段说 A，后半段隐含非 A |
| 回答过长但信息密度低 | 1 分钟说了 10 秒就能说清的内容 |
| 表达不好但核心正确 | 口语化但知识点都对 |
| 追问后自我纠正 | 第一次错了，追问后改正 |

### 10.3 首批指标

| 指标 | 目标 | 说明 |
|---|---|---|
| Covered Point Recall | > 0.85 | 模型正确识别的 covered 点比例 |
| Missing Point Recall | > 0.80 | 模型正确识别的 missing 点比例 |
| Incorrect Claim False Positive Rate | < 0.15 | 模型错误标记正确内容为错误的比例 |
| Score Range Pass Rate | > 0.90 | 评分落在预期区间的比例 |
| Follow-up Intent Match Rate | > 0.75 | 追问方向与预期一致的比例 |
| Structured Output First-pass Success Rate | > 0.85 | 模型首次返回合法 JSON 的比例 |

### 10.4 Eval 执行

```text
每次修改 Prompt、Rubric、FollowUpPolicy 或切换模型后：
  1. 跑全量 Eval Case
  2. 对比上一版本的各项指标
  3. 标记退化项（regression）
  4. 只有指标不退化（或退化有合理解释）才合入
```

---

## 11. Mini Harness 设计

> Mini Harness 是第一版只做精简范围、不做完整 AgentScope 的轻量 Runtime。

### 11.1 核心接口

```java
// 模型网关——屏蔽 Spring AI 或其他模型适配器
public interface ModelGateway {
    ModelResponse call(ModelRequest request);
}

// Agent Runtime——管理单次 Agent 调用的完整生命周期
public interface AgentRuntime {
    AgentResult execute(AgentRequest request);
}

// Agent 状态存储——跨调用持久化
public interface AgentStateStore {
    Optional<AgentState> load(AgentSessionKey key);
    void save(AgentSessionKey key, AgentState state, long expectedVersion);
}

// Hook 链——在模型调用前后插入自定义逻辑
public interface AgentHook {
    void beforeModel(AgentRequest request, RuntimeContext ctx);
    void afterModel(ModelResponse response, RuntimeContext ctx);
    void onError(Throwable error, RuntimeContext ctx);
}
```

### 11.2 受控 Agent Loop

```text
加载 AgentState（或创建新状态）
→ 准备 Active Context（取最近 N 条消息 + Summary）
→ beforeModel Hook
→ 调用模型
→ 检查 ToolCall
→ 校验工具权限（第一版只允许读取类工具）
→ 执行工具
→ 写入 ToolResult 到 AgentState
→ 判断是否继续循环（maxIterations / timeout / 无 ToolCall）
→ afterModel Hook
→ 保存 AgentState（乐观锁）
→ 输出类型化 AgentEvent
```

### 11.3 安全限制

```java
public record AgentLimits(
    int maxIterations,           // 默认 5
    Duration timeout,            // 默认 120s
    int maxToolCalls,            // 默认 3
    int maxConsecutiveFailures,  // 默认 2
    boolean allowWriteTools      // 第一版 false
) {}
```

**第一版工具白名单（只允许读取）**：

- `load_question_context`：加载当前题目的知识点背景
- `load_candidate_skill_history`：加载用户在该知识点上的历史 MasteryEvidence

Agent **不得**通过工具直接修改 InterviewSession、EvaluationRun 或 MasteryEvidence。这些只能通过 Java 业务代码修改。

### 11.4 三类状态

这是整篇文章最重要的设计概念之一，详见 [第 12 节](#12-上下文历史和记忆的边界) 中的状态边界说明。这里从 Mini Harness 视角总结：

| 状态类型 | 管理者 | 生命周期 | 持久化 |
|---|---|---|---|
| `InterviewSession`（业务状态） | `InterviewOrchestrator` | 一次面试 | PostgreSQL |
| `AgentState`（技术状态） | `AgentRuntime` + `AgentStateStore` | 跨多次模型调用 | PostgreSQL（agent_state 表） |
| `RuntimeContext`（调用上下文） | `AgentRuntime`（单次调用内） | 一次 `execute()` | 不持久化 |

**为什么要分开**：
- `InterviewSession` 是确定性业务事实——面试是否结束、当前第几题——不能因为 Agent 循环里的某次模型幻觉而改变。
- `AgentState` 是 Agent Runtime 需要的技术状态——总结、上下文、工具调用记录——它是 Runtime 的实现细节，不应该混入业务表。
- `RuntimeContext` 是单次调用的临时数据——traceId、开始时间、取消信号——持久化它没有意义，还增加存储和一致性负担。

---

## 12. 上下文、历史和记忆的边界

| 概念 | 定义 | 存储位置 | 发送给模型？ |
|---|---|---|---|
| 完整聊天历史 | 所有 turn 的原始消息 | PostgreSQL (interview_turn) | 否 |
| Active Context | 当前发送给模型的消息集合 | 内存（AgentState 中维护） | 是 |
| Summary | 超出上下文窗口的历史压缩 | AgentState.summary | 是（作为 system message 的一部分） |
| 稳定用户偏好 | 目标岗位、回答风格 | interview_session.preferences (JSONB) | 是（注入 prompt） |
| 面试业务事实 | 当前题目、状态、已完成题数 | InterviewSession | 部分（注入 prompt 作为引导） |
| MasteryEvidence | 能力证据 | PostgreSQL (mastery_evidence) | 是（注入 prompt 帮助个性化追问） |
| AgentState | Agent Runtime 技术状态 | PostgreSQL (agent_state) | 否（Runtime 内部使用） |

关键原则：

- **完整历史用于审计和回放，不发送给模型。**
- **只有 Active Context 和 Summary 发送给模型。**
- **"用户不懂线程池"不能直接作为长期稳定记忆。** 这只是一次评测的快照，需要通过多次 MasteryEvidence 才能形成稳定的 SkillMastery 结论。
- **目标岗位、回答风格偏好是稳定偏好，可以持久化并在每次面试中注入。**
- **业务事实必须保存在 PostgreSQL 业务表中，不能依赖 Agent 自动记忆。**

---

## 13. 数据库设计

### 13.1 核心表（第一版）

```sql
-- 题目定义
CREATE TABLE question (
    question_code   VARCHAR(50) PRIMARY KEY,
    title           TEXT NOT NULL,
    topic           VARCHAR(100) NOT NULL,
    difficulty      VARCHAR(20) NOT NULL,
    knowledge_point_codes TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 题目版本（支持题目和 Rubric 独立演化）
CREATE TABLE question_version (
    id              BIGSERIAL PRIMARY KEY,
    question_code   VARCHAR(50) NOT NULL REFERENCES question(question_code),
    version_number  INT NOT NULL,
    content         TEXT NOT NULL,
    rubric_template JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (question_code, version_number)
);

-- 面试会话
CREATE TABLE interview_session (
    session_id          UUID PRIMARY KEY,
    user_id             VARCHAR(100) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    current_question_code VARCHAR(50),
    current_turn_seq    INT NOT NULL DEFAULT 0,
    follow_up_count     INT NOT NULL DEFAULT 0,
    max_follow_ups      INT NOT NULL DEFAULT 3,
    total_questions     INT NOT NULL DEFAULT 0,
    completed_questions  INT NOT NULL DEFAULT 0,
    preferences         JSONB,
    version             BIGINT NOT NULL DEFAULT 0,  -- 乐观锁
    started_at          TIMESTAMPTZ,
    ended_at            TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 面试交互记录
CREATE TABLE interview_turn (
    turn_id         UUID PRIMARY KEY,
    session_id      UUID NOT NULL REFERENCES interview_session(session_id),
    question_code   VARCHAR(50) NOT NULL,
    question_version INT NOT NULL,
    turn_type       VARCHAR(20) NOT NULL,  -- MAIN_QUESTION / FOLLOW_UP
    sequence_number INT NOT NULL,
    user_answer     TEXT,
    asked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, sequence_number)
);

-- 评测执行记录（一次回答可以有多次评测）
CREATE TABLE evaluation_run (
    run_id          UUID PRIMARY KEY,
    turn_id         UUID NOT NULL REFERENCES interview_turn(turn_id),
    prompt_version  VARCHAR(50) NOT NULL,
    rubric_version  VARCHAR(50) NOT NULL,
    model_name      VARCHAR(100) NOT NULL,
    raw_output      TEXT,
    parsed_result   JSONB,
    retry_count     INT NOT NULL DEFAULT 0,
    latency_ms      INT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING/SUCCESS/FAILED
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 能力证据（可追溯到 turn 和 evaluation）
CREATE TABLE mastery_evidence (
    evidence_id         UUID PRIMARY KEY,
    user_id             VARCHAR(100) NOT NULL,
    knowledge_point_code VARCHAR(100) NOT NULL,
    turn_id             UUID NOT NULL REFERENCES interview_turn(turn_id),
    evaluation_run_id   UUID NOT NULL REFERENCES evaluation_run(run_id),
    evidence_type       VARCHAR(20) NOT NULL,  -- COVERED / MISSING / INCORRECT
    confidence          NUMERIC(3,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent 技术状态（与业务状态分离）
CREATE TABLE agent_state (
    session_key     VARCHAR(200) PRIMARY KEY,
    user_id         VARCHAR(100) NOT NULL,
    session_id      UUID,
    summary         TEXT,
    active_context  JSONB,
    iteration_count INT NOT NULL DEFAULT 0,
    tool_call_log   JSONB,
    attributes      JSONB,
    version         BIGINT NOT NULL DEFAULT 0,  -- 乐观锁
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 幂等请求记录
CREATE TABLE processed_request (
    request_id      VARCHAR(200) PRIMARY KEY,
    session_id      UUID,
    result_ref      VARCHAR(200),
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 13.2 关键约束

- `interview_session.version`：乐观锁，更新时 `WHERE version = ?`，防止并发覆盖。
- `interview_turn (session_id, sequence_number)` 唯一约束：同一个会话内序号不重复。
- `evaluation_run` 记录 `prompt_version` 和 `rubric_version`：每次评测可追溯到具体的 Prompt 版本。
- `mastery_evidence` 关联 `turn_id` 和 `evaluation_run_id`：任何能力证据都能追溯到哪次回答、哪次评测。
- `agent_state` 独立表：Agent 技术状态不混入业务表，按 `sessionKey` 隔离。
- `processed_request`：`session_id + request_id` 幂等，重复提交返回已有结果。

---

## 14. 具体开发步骤

> 完整的分阶段详细步骤（每步的目标、类、测试、验收标准、Commit Message）见
> **[实现路线图](./interview-harness-implementation-roadmap.md)**。
> 以下只保留概览。

### 阶段 A：最小评测闭环

目标：固定题目 + 固定 Prompt 跑通一次答案评测，建立第一批 Eval Case。

1. 创建 Spring Boot 工程（Java 21，单模块）
2. 接入 Spring AI + 一个模型（OpenAI 兼容 API）
3. 准备 10 道 Java 并发题（从现有题库中选取、标准化格式）
4. 定义 `EvaluationResult` 领域对象
5. 实现一次结构化评测（`EvaluationService`）
6. 增加 `EvaluationResultValidator`（JSON Schema 校验 + 重试）
7. 建立第一批 Eval Case（至少 20 个，覆盖 8 种回答类型）
8. 实现 `EvalRunner`（跑全量 Eval，输出指标对比）

### 阶段 B：可用面试 MVP

目标：实现完整的面试状态机和追问闭环，通过 REST API 完成一场 5 题面试。

8. 实现内存版 `InterviewSession` 和状态机
9. 实现 `InterviewOrchestrator`
10. 实现 `FollowUpPolicy` 和 `FollowUpGenerator`
11. 实现追问生成和显示
12. 暴露 REST API
13. 端到端：完成一场 5 题面试（带追问）

### 阶段 C：持久化和证据化

目标：接入 PostgreSQL，实现能力证据和复盘报告。

14. 建表 + Flyway migration
15. PostgreSQL Repository 实现
16. 幂等和乐观锁
17. `EvaluationRun` 持久化
18. `MasteryEvidence` 持久化
19. `SkillMasteryCalculator`
20. 证据化复盘报告
21. 服务重启后恢复会话

### 阶段 D：Mini Harness

目标：抽出通用 Agent Runtime，独立于 Interview 业务。

22-30：实现 `ModelGateway`、`AgentRuntime`、`AgentStateStore`、`AgentHook`、`AgentEvent`、受限 Tool Loop、`ContextPolicy`、`AgentLimits`。将评测、追问和报告接入 Mini Harness。

### 阶段 E：AgentScope 源码学习

31-38：对照 AgentScope 源码，比较 ReActAgent、RuntimeContext、StateStore、Middleware、事件流、Compaction、Workspace/Skill。产出一系列源码学习文档。

### 阶段 F：Adapter 与工程化

39-44：实现 AgentScopeRuntimeAdapter、用同一批 Eval 对比两种 Runtime、增加 SSE、可观测性、故障测试、README 和 ADR。

---

## 15. AgentScope 源码学习路线

不列源码类名，采用对照学习方式：

```text
我先实现什么 → 我带着什么问题读源码 → AgentScope 怎么实现 → 我的差异 → 借鉴/不借鉴
```

### 重点研究主题

| # | 主题 | 对照方式 |
|---|---|---|
| 1 | Agent 为什么可以无状态 | 我先实现 `AgentState` + `AgentStateStore`，然后读 AgentScope 的 `AgentState` 和 `ReActAgent` |
| 2 | 单次调用的可变数据放哪里 | 我先实现 `RuntimeContext`，然后读 `Msg` 和 `ToolCall` 的上下文管理 |
| 3 | userId/sessionId 隔离 | 我先实现 `AgentSessionKey`，然后读 AgentScope 的 session 隔离策略 |
| 4 | 状态加载/保存时机 | 我先在 Hook 中实现，然后读 AgentScope 的 Middleware |
| 5 | 工具循环如何停止 | 我先实现 `AgentLimits` 中的停止条件，然后读 `ToolUseLimitMiddleware` |
| 6 | Hook/Middleware 执行顺序 | 我先实现 `AgentHookChain`，然后读 `MiddlewareStack` |
| 7 | 类型化事件如何传播 | 我先实现 `AgentEvent`，然后读 `AgentEventStream` 和 Reactor |
| 8 | Reactor Context 如何参与调用链 | 读源码理解 AgentScope 如何用 Reactor Context 传递 traceId |
| 9 | Context Compaction | 我先实现 summary 截断，然后读 `CompactionMiddleware` |
| 10 | Workspace/Skill/Memory 边界 | 读源码理解三者的职责分离 |
| 11 | 状态恢复是快照还是事件模型 | 分析 AgentScope 的状态持久化策略 |
| 12 | 并发调用防覆盖 | 读乐观锁和版本号的使用 |

### 计划产出文档

```text
docs/source-study/
├── 01-agent-loop.md
├── 02-runtime-context.md
├── 03-state-store.md
├── 04-middleware.md
├── 05-event-stream.md
├── 06-context-compaction.md
└── 07-workspace-skill-memory.md
```

---

## 16. 故障场景设计

| # | 场景 | 最终状态 | 允许重试？ | 重复调用模型？ | 重复 Evidence？ | 用户看到什么 | 如何恢复 |
|---|---|---|---|---|---|---|---|
| 1 | 模型超时 | EVALUATING | 是（最多 2 次） | 可能（幂等保护） | 否（同一 requestId） | "评测中，请稍候" | 自动重试，超时后标记 FAILED |
| 2 | 模型返回非法 JSON | 同上 | 是（最多 2 次） | 是 | 否 | 同上 | `EvaluationResultValidator` 触发重试 |
| 3 | 模型返回未知知识点 | 取决于 importance | — | 否 | 否 | 正常（忽略未知点） | 记录 WARN 日志，不阻塞流程 |
| 4 | 模型输出空内容 | EVALUATING | 是 | 是 | 否 | 同上 | 重试，仍空则 FAILED |
| 5 | 模型持续调用同一工具 | 达到 maxIterations | 否 | 最多 maxIterations 次 | — | "处理中" | `AgentLimits` 停止循环 |
| 6 | 工具参数错误 | 当前 iteration | 否（不重试整个循环） | 否 | 否 | 取决于 fallback | 记录错误，继续下一 iteration |
| 7 | 工具执行失败 | 同上 | 否 | 否 | 否 | 同上 | 同上 |
| 8 | 达到 maxIterations | RUNNING → 强制结束 | 否 | 否 | 否 | 当前轮次结果 | 返回已有结果 |
| 9 | 乐观锁冲突 | 上次保存 | 是 | 否 | 否 | "操作冲突，请重试" | 重新加载状态后重试 |
| 10 | 重复提交同一 requestId | 已处理 | — | 否 | 否 | 返回已有结果 | `processed_request` 去重 |
| 11 | 保存 Evaluation 成功但更新 Session 失败 | Session 状态不一致 | 否（需补偿） | 否 | 是（Evaluation 已写入） | "面试状态异常" | 补偿逻辑或定时扫描修复 |
| 12 | EVALUATING 后服务重启 | Session 停留在 EVALUATING | 是（启动时扫描） | 是（新 requestId） | 否（幂等） | 上次回答可能丢失 | 启动扫描 + 自动恢复 |
| 13 | SSE 中断 | 连接断开 | 是（客户端重连） | 否 | 否 | "连接中断，重连中" | 客户端重连，服务端幂等 |
| 14 | Prompt 版本更新导致评测漂移 | 评测结果变化 | — | — | — | — | 跑全量 Eval 对比指标 |

---

## 17. 可观测性设计

### 17.1 日志记录（结构化）

每个关键操作记录：

```
sessionId, turnId, evaluationRunId, requestId, traceId,
modelName, promptVersion, rubricVersion,
latencyMs, inputTokens, outputTokens,
retryCount, toolCallCount, resultStatus
```

### 17.2 指标

| 指标 | 说明 |
|---|---|
| `model.call.success_rate` | 模型调用成功率 |
| `eval.structured_output.first_pass_rate` | 结构化输出首次成功率 |
| `eval.latency.p99` | 评测延迟 P99 |
| `eval.token.avg` | 平均 Token 消耗 |
| `interview.follow_up.avg` | 每次面试平均追问次数 |
| `eval.regression.pass_rate` | Eval 回归通过率 |
| `harness.tool_call.failure_rate` | Tool Call 失败率 |
| `session.recovery.success_rate` | 会话恢复成功率 |

---

## 18. 项目演进路线

```text
可靠评测（阶段 A）
→ 针对性追问（阶段 B）
→ 能力证据（阶段 C）
→ Eval 回归（阶段 C）
→ Mini Harness（阶段 D）
→ 源码对照（阶段 E）
→ AgentScope Adapter（阶段 F）
→ RAG / Skill / MCP 等扩展（未来）
```

**以下功能必须在前面闭环产生真实需要后才引入：**

多 Agent、Python 服务、独立向量数据库（Milvus）、知识图谱平台（Neo4j）、自动 Skill 生成、MCP 插件平台、沙箱执行、语音面试、多租户、分布式部署。

---

## 19. 求职和作品集价值

### 这个项目能证明什么

- Spring AI 模型接入与多模型适配
- Java 领域建模（Domain 零框架依赖）
- 显式业务状态机设计
- LLM 结构化评测与 Rubric 设计
- Eval 回归体系（数据集 + 指标 + 版本对比）
- 轻量 Agent Runtime（状态管理 + Hook 链 + 事件流）
- 受控 Tool Calling Loop
- Context Compaction（Summary + Active Context）
- 状态恢复与幂等设计
- 乐观锁与并发控制
- 结构化可观测性
- AgentScope 源码级理解与对照

### 简历描述（建议）

> 基于 Spring AI 模型抽象，自研轻量级 Agent Harness，完成会话状态隔离、受控工具循环、生命周期 Hook、类型化事件流、上下文压缩和 JDBC 状态恢复；结合显式业务状态机实现面试追问、Rubric 评测、能力证据与 Eval 回归，并与 AgentScope Harness 进行源码级设计对比。

---

## 附录：与旧版方案的主要差异

| 维度 | 旧方案 | 新方案 |
|---|---|---|
| 语言 | Java + Python 双服务 | 纯 Java 21 |
| 模型接入 | LangGraph + LangChain（Python 侧） | Spring AI（适配层，不泄漏到 Domain） |
| Agent Runtime | LangGraph StateGraph | 自研 Mini Harness（精简范围） |
| AgentScope | 未提及 | 源码对照 + 后期 Adapter |
| 数据库 | PostgreSQL + Redis + Milvus | PostgreSQL（第一版） |
| 微服务 | API Gateway + 多模块服务 | 模块化单体（先单模块，复杂后再拆） |
| 评测 | 单维度评分（0-10 + 评语） | 多维度 + Covered/Missing/Incorrect + 证据 + Eval 回归 |
| 状态管理 | 无显式设计 | 三层状态分离 |
| 追问 | Python Agent 内部实现 | Java FollowUpPolicy + 模型提议 |
| 开发计划 | 3 个 Phase 各 2 周，描述笼统 | 6 个阶段 44 步，每步有目标/类/测试/验收标准 |
| 故障处理 | 未涉及 | 14 个场景逐一分析 |

---

*文档版本：v4.0*
*最后更新：2026-07-09*
