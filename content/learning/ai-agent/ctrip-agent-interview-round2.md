---
title: "携程 Agent开发岗 二面面经"
date: "2026-07-06"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "携程 Agent开发岗 二面面经"
tags:
---

# 携程 Agent开发岗 二面面经

> **来源**: 小红书
> **面试方向**: AI Agent开发（二面）
> **面试风格**: 实战型，关注Prompt调优瓶颈后的决策逻辑
> **标签**: #携程 #Agent开发 #大模型 #面经

---

## 面试概览

面试官非常实战向，全程围绕 **Agent系统生产落地的真实场景** 拷问，没有八股文。

**核心考察点**：
- 架构选型的**trade-off理解**（不是背概念）
- **Prompt调优陷入瓶颈后的决策逻辑**（面试官最关注）
- **Badcase归因到具体Agent**的定位能力
- 推理优化、时延等**工程落地细节**

---

## 一、架构设计

### Q1: 用的是什么架构？LangGraph还是自研？为什么这么选？

**实际场景**: 面试官想知道你是否有真实的架构选型经验，而不是只会用某个框架。

**深度回答**:

架构选型需要根据业务场景判断，没有银弹：

| 维度 | LangGraph / LangChain4j | 自研框架 | Spring AI |
|------|------------------------|---------|-----------|
| 开发效率 | 高，开箱即用 | 低，从头搭 | 中，与Spring生态集成好 |
| 灵活性 | 受框架约束 | 完全可控 | 中等 |
| 调试难度 | 黑盒多，难定位 | 自己写的自己懂 | 相对透明 |
| 适合场景 | 快速验证、标准流程 | 复杂定制、生产级 | Spring Boot项目首选 |

**推荐回答**（以Spring AI为例，适用于Java技术栈团队）：

```java
// 方案一：Spring AI + 自研编排层（生产推荐）
// 为什么不用纯LangGraph？因为团队Java技术栈，引入Python框架增加维护成本

@Configuration
public class AgentArchitectureConfig {

    /**
     * 核心思想：用 Spring AI Advisor 链实现 Workflow 路由，
     * 将LLM调用封装在 Java 层，保持团队技术栈统一
     */
    @Bean
    public ChatClient agentClient(ChatClient.Builder builder,
                                   ChatMemory chatMemory,
                                   VectorStore vectorStore) {

        return builder
            .defaultSystem("你是携程AI助手，根据用户需求提供帮助")
            .defaultAdvisors(
                // 1. 意图识别层 → 路由判断
                new IntentRoutingAdvisor(),
                // 2. 对话记忆层
                new MessageChatMemoryAdvisor(chatMemory),
                // 3. RAG检索层
                new QuestionAnswerAdvisor(vectorStore),
                // 4. 安全校验层
                new SafeGuardAdvisor()
            )
            .defaultFunctions(
                "queryOrder", "searchHotel", "bookTicket",
                "cancelReservation", "createComplaint"
            )
            .build();
    }
}
```

**架构对比分析**：

```java
// LangGraph 方式（Python为例）：有向图编排
// 适合复杂状态机、多条件分支
//
// 自研 + Spring AI 方式（Java）：
// 用Advisor链实现线性Workflow + 条件分支通过RoutingAdvisor控制
// 适合80%的业务场景，且Java生态更成熟

// 选型决策树：
// 业务逻辑固定、流程清晰 → Spring AI Advisor链（简单可靠）
// 复杂状态跳转、循环执行 → 考虑LangGraph或自研状态机
// 纯Java团队 → 优先Spring AI / LangChain4j
```

> ⚠️ **工程踩坑**：不要为了"炫技"引入Python框架。Java团队维护Python Agent框架的成本极高，部署、监控、排障都是额外负担。**团队技术栈一致性 > 框架功能完整性**。

---

### Q2: 整体是 master+sub Agent 还是 workflow 形式？为什么这么选？

**深度回答**:

两种模式有各自的适用场景，关键在于**任务的耦合度**：

```java
// ========== Workflow模式（串行Pipeline）==========
// 适用场景：任务步骤明确、顺序固定
// 例如：用户咨询→意图识别→知识检索→答案生成

@Service
public class WorkflowAgentOrchestrator {

    private final ChatClient intentClient;    // 意图识别Agent
    private final ChatClient ragClient;       // RAG检索Agent
    private final ChatClient responseClient;  // 响应生成Agent

    public String process(String userMessage) {
        // Step 1: 意图识别
        String intent = intentClient.prompt()
            .user(userMessage)
            .call().content();

        // Step 2: 根据意图路由
        return switch (intent) {
            case "ORDER_QUERY" -> handleOrderQuery(userMessage);
            case "KNOWLEDGE" -> handleKnowledgeQuery(userMessage);
            case "COMPLAINT" -> handleComplaint(userMessage);
            default -> handleGeneral(userMessage);
        };
    }
}

// ========== Master+Sub Agent模式（任务分发）==========
// 适用场景：任务需要多工具协作、子任务可并行

@Component
public class MasterAgentOrchestrator {

    // Master Agent：负责任务拆解、分发、结果汇聚
    private final ChatClient masterClient;

    // Sub Agents：各司其职
    private final Map<String, ChatClient> subAgents;

    public String process(String userMessage) {
        // 1. Master拆解任务
        TaskPlan plan = masterClient.prompt()
            .user("将以下用户需求拆解为子任务: " + userMessage)
            .call(TaskPlan.class);  // 结构化输出

        // 2. 并行执行子任务
        Map<String, CompletableFuture<String>> futures = new HashMap<>();
        for (SubTask task : plan.getSubTasks()) {
            ChatClient agent = subAgents.get(task.getAgentType());
            futures.put(task.getId(),
                CompletableFuture.supplyAsync(() ->
                    agent.prompt().user(task.getDescription()).call().content()
                )
            );
        }

        // 3. 等待全部完成 + 结果汇聚
        CompletableFuture.allOf(futures.values().toArray(new CompletableFuture[0])).join();

        return masterClient.prompt()
            .user("综合以下子任务结果生成最终回答: " + futures)
            .call().content();
    }
}
```

**选型原则**：

| 维度 | Workflow | Master+Sub Agent |
|------|----------|-----------------|
| 复杂度 | 低～中 | 中～高 |
| 可观测性 | 高（步骤清晰） | 中（子Agent内部黑盒） |
| 并行能力 | 串行为主 | 子任务可并行 |
| 容错 | 单步失败可重试 | 子Agent独立失败影响局部 |
| 适用场景 | 客服/FAQ/标准流程 | 复杂报告生成/多工具编排 |

> ⚠️ **工程踩坑**：Master+Sub Agent模式下，Master的Prompt设计至关重要。如果Master拆解任务出问题，后面全错。建议给Master加**结构化输出约束**（用Java POJO接收），避免自由文本导致解析失败。

---

### Q3: 首次生成和多轮补充的链路路由怎么区分？

**深度回答**:

核心思路：**首次生成走完整链路，多轮补充走增量链路**。

```java
@Service
public class SessionRouterService {

    private final ChatClient fullChainClient;   // 完整链路
    private final ChatClient incrementalClient; // 增量链路
    private final ChatMemory chatMemory;

    /**
     * 路由逻辑：
     * - 首次（会话第一轮）：走完整链路 = RAG + 工具 + 全量上下文
     * - 多轮补充：走增量链路 = 仅上下文 + 最后一轮补充意图
     */
    public String route(UserMessage message, String sessionId) {
        // 获取会话历史
        List<Message> history = chatMemory.get(sessionId, 10);
        boolean isFirstTurn = history.isEmpty();

        if (isFirstTurn) {
            // 首次生成：完整链路
            return fullChainClient.prompt()
                .user(message.getContent())
                .advisors(
                    new MessageChatMemoryAdvisor(chatMemory),  // 空历史，但保留框架
                    new QuestionAnswerAdvisor(vectorStore),     // 需要RAG
                    new ContextCompressionAdvisor()             // 上下文压缩（空）
                )
                .call().content();
        } else {
            // 多轮补充：增量链路
            // 技巧：只传最近2轮对话 + 当前query，不重复RAG
            return incrementalClient.prompt()
                .user(message.getContent())
                .advisors(
                    new MessageChatMemoryAdvisor(chatMemory, 4), // 仅最近2轮
                    new ContextCompressionAdvisor()              // 压缩历史
                )
                .call().content();
        }
    }
}
```

**为什么这样设计？**

```
首次生成：
  用户：帮我规划一个北京5日游
  → 需要：意图识别 → RAG(景点/酒店/攻略) → 工具(查价格) → 多工具组合 → 生成完整方案

多轮补充：
  用户：把第二天改成去故宫
  → 不需要重新RAG，只需要理解"第二天"的指代 + 局部修改
  → 走增量链路，省时省Token
```

> ⚠️ **工程踩坑**：多轮补充最怕**指代消解失败**。建议在增量链路中加入一个**指代解析前置步骤**，将"第二天"→"行程第2天"这种模糊指代明确化后再往下走。

---

## 二、评测与 Badcase

### Q4: 效果怎么评估？没有用户反馈时如何抽检？

**深度回答**:

构建**三层评测体系**：

```java
@Component
public class EvaluationSystem {

    /**
     * 第一层：自动评测（覆盖率100%）
     * 基于规则的自动化检查
     */
    public AutoEvalResult autoEvaluate(AgentResponse response, UserQuery query) {
        AutoEvalResult result = new AutoEvalResult();

        // 1. 响应时长检查
        result.setLatencyOk(response.getLatencyMs() < 3000);

        // 2. 关键词覆盖检查（对知识类query）
        if (query.getType() == QueryType.KNOWLEDGE) {
            result.setKeywordCoverage(
                checkKeywords(query.getRequiredKeywords(), response.getContent())
            );
        }

        // 3. 安全合规检查
        result.setSafe(checkSensitiveContent(response.getContent()));

        // 4. 格式合规检查
        result.setFormatValid(validateFormat(response, query.getExpectedFormat()));

        return result;
    }

    /**
     * 第二层：LLM-as-Judge（抽检 + Badcase）
     * 用 LLM 评估 LLM，适合模糊判断
     */
    public LLMJudgeResult llmJudge(AgentResponse response, UserQuery query) {
        // 用Judge模型（qwen2.5-72b或doubao-pro）评估
        String judgePrompt = """
            你是Agent质量评估专家，请从以下维度评分（1-5分）：
            1. 准确性：回答是否正确、无幻觉
            2. 完整性：是否覆盖了用户所有需求
            3. 友好度：语气是否礼貌、易懂
            4. 安全性：是否包含不当内容

            用户问题：%s
            Agent回答：%s

            请输出JSON格式评分和说明。
            """.formatted(query.getContent(), response.getContent());

        return judgeClient.prompt()
            .user(judgePrompt)
            .call(LLMJudgeResult.class);
    }

    /**
     * 第三层：人工抽检（覆盖核心场景）
     * 针对高风险场景 + 自动打分低的case
     */
    public List<ManualReviewCase> getReviewQueue() {
        // 自动打分低于3分的case
        // 涉及金融/隐私等高危场景的case
        // 随机抽样5%的正常case
    }
}
```

**没有用户反馈时的抽检策略**：

| 抽检方式 | 覆盖率 | 成本 | 适用场景 |
|---------|--------|------|---------|
| 规则自动检查 | 100% | 低 | 格式/关键词/安全 |
| LLM-as-Judge | 20%-30% | 中 | 质量/准确性 |
| 人工抽检 | 1%-5% | 高 | 核心场景/高危场景 |
| A/B对比 | 50%流量 | 中 | 版本升级验证 |
| 用户行为信号 | 100% | 低 | 间接反馈（重问/流失） |

> ⚠️ **工程踩坑**：LLM-as-Judge 本身也会出错。建议**多模型交叉验证**（用A模型评估B模型的结果），或者同一个case让Judge评估3次取多数。

---

### Q5: Badcase出现后怎么定位到具体Agent？

**深度回答**:

关键思路：**全链路追踪 + 逐层日志快照**。

```java
/**
 * Badcase定位系统的核心：给每个请求分配TraceId，
 * 记录每个Agent的输入输出，支持回放
 */
@Component
public class AgentTracer {

    private final Tracer tracer; // 分布式链路追踪（如SkyWalking/Zipkin）

    /**
     * 在每次Agent调用前记录输入快照
     */
    public Span startAgentSpan(String agentName, String traceId,
                                String input, Context context) {
        Span span = tracer.buildSpan("agent." + agentName)
            .withTag("traceId", traceId)
            .withTag("input.truncated", truncate(input, 2000))
            .withTag("context.round", context.getCurrentRound())
            .withTag("context.tools", context.getAvailableTools().toString())
            .start();

        // 同时写一份到Redis，方便实时查看
        redis.lpush("trace:" + traceId + ":spans",
            serializeAgentSpan(agentName, input, null, "START"));

        return span;
    }

    /**
     * Badcase归因分析
     */
    public BadcaseReport analyzeBadcase(String traceId) {
        // 1. 获取全链路Span列表
        List<AgentSpan> spans = getSpans(traceId);

        // 2. 逐层对比：哪个Agent的输出和期望差距最大
        for (AgentSpan span : spans) {
            double score = evaluateSpanQuality(span);
            if (score < THRESHOLD) {
                return BadcaseReport.builder()
                    .traceId(traceId)
                    .culpritAgent(span.getAgentName())
                    .culpritReason(analyzeFailureReason(span))
                    .suggestion(generateFixSuggestion(span))
                    .build();
            }
        }

        // 3. 如果是组合问题（单个Agent没问题，组合后出问题）
        return analyzeCompositionIssue(spans);
    }

    /**
     * 判断该对哪个Agent做SFT的决策逻辑
     */
    public SFTDecision decideSFTTarget(List<BadcaseReport> badcases) {
        // 统计：哪个Agent的Badcase最多
        Map<String, Long> agentErrorCount = badcases.stream()
            .collect(Collectors.groupingBy(
                BadcaseReport::getCulpritAgent, Collectors.counting()));

        // 如果某个Agent错误率 > 30%，且错误模式集中 → 考虑SFT
        for (Map.Entry<String, Long> entry : agentErrorCount.entrySet()) {
            String agentName = entry.getKey();
            long count = entry.getValue();
            double ratio = (double) count / badcases.size();

            if (ratio > 0.3) {
                List<String> errorPatterns = extractErrorPatterns(
                    badcases.stream()
                        .filter(b -> b.getCulpritAgent().equals(agentName))
                        .collect(Collectors.toList())
                );

                if (errorPatterns.size() <= 3) {
                    // 错误模式集中，适合SFT
                    return SFTDecision.forSFT(agentName, errorPatterns);
                } else {
                    // 错误模式分散，先调Prompt
                    return SFTDecision.promptFirst(agentName, errorPatterns);
                }
            }
        }

        return SFTDecision.noActionNeeded();
    }
}
```

**定位流程总结**：

```
Badcase出现
    ↓
① 根据traceId拉取全链路日志
    ↓
② 逐层回放：检查每个Agent的输入/输出
    ↓
③ 发现异常层（比如RAG检索结果为空 → 后续Agent基于错误信息回答）
    ↓
④ 判断根因：
   - RAG检索失败 → 优化Embedding/切分策略
   - LLM理解偏差 → 优化Prompt / 加few-shot
   - 工具调用错误 → 修Function Calling定义
   - 多轮指代错误 → 加指代消解模块
```

> ⚠️ **工程踩坑**：一定要给每个请求分配 **全局唯一的TraceId**，并在前端也透传。否则用户反馈"上次的回答不对"，你根本查不到是哪次请求。

---

### Q6: Prompt调优遇到修好一类、坏了另一类怎么办？调到极限后，下一步换模型、调参数还是上SFT？

**深度回答**:

这是面试官**最关注**的问题——Prompt调优的**帕累托瓶颈**决策。

**修好一类坏了另一类的解决方案**：

```java
/**
 * 方案1：路由分流（解决"修好A坏了B"）
 * 不同场景用不同Prompt，而不是一个Prompt吃天下
 */
@Service
public class PromptRouter {

    private final Map<String, ChatClient> scenarioClients = new HashMap<>();

    @PostConstruct
    public void init() {
        // 每个场景独立Prompt，互不干扰
        scenarioClients.put("ORDER_QUERY", buildClient("""
            你是一个订单查询助手。规则：
            1. 只回答订单相关的问题
            2. 必须提供订单号
            3. 非订单问题请婉拒
            """));
        scenarioClients.put("HOTEL_SEARCH", buildClient("""
            你是一个酒店搜索助手。规则：
            1. 必须确认入住日期和退房日期
            2. 推荐至少3个选项
            3. 包含价格区间
            """));
        // ...更多场景
    }

    public String chat(String userMessage) {
        String scenario = classifyScenario(userMessage);
        return scenarioClients.get(scenario)
            .prompt().user(userMessage).call().content();
    }
}
```

**Prompt到极限后的决策树**：

```
Prompt调优遇到瓶颈（修好A坏了B）
    ↓
① 是否尝试了场景分流？
    ├否 → 按场景拆分成多个Prompt（推荐首选）
    └是 → 进入下一步
    ↓
② 是否尝试了Few-shot优化？
    ├否 → 给每个场景加3-5个高质量few-shot示例
    └是 → 进入下一步
    ↓
③ 当前模型能力是否足够？
    ├小模型（7B-14B）→ 换大模型（72B+/闭源）可能直接解决
    └已用大模型 → 进入下一步
    ↓
④ Badcase是否集中在特定模式？
    ├是（≤3种错误模式）→ 收集数据做SFT（性价比最高）
    └否（分散的偶发错误）→ 尝试调参数（temperature/ top_p）
    ↓
⑤ 最终决策：
   - 核心场景+高频错误 → SFT
   - 长尾场景+偶发错误 → 加兜底逻辑/人工兜底
   - 成本不敏感 → 换更强模型
   - 延迟敏感 → 小模型+规则兜底
```

**SFT vs Prompt vs 调参 vs 换模型 对比**：

| 方案 | 成本 | 效果上限 | 维护成本 | 适合场景 |
|------|------|---------|---------|---------|
| Prompt优化 | 低 | 中 | 中 | 初期快速迭代 |
| Few-shot | 低 | 中 | 低 | 模式固定的场景 |
| 调参(temperature等) | 低 | 低 | 低 | 微调输出风格 |
| **SFT** | **高** | **高** | **中** | **核心场景，高频错误模式明确** |
| 换大模型 | 中～高 | 高 | 低 | 当前模型能力不够 |
| RLHF/DPO | 极高 | 极高 | 高 | 对输出质量有极致要求的场景 |

```java
// 实际决策代码逻辑
public OptimizationDecision decideNextStep(
        List<BadcaseReport> badcases,
        ModelConfig currentModel,
        boolean hasSFTData) {

    // 统计错误模式
    Map<String, Long> patterns = groupByErrorPattern(badcases);
    boolean hasConcentratedPattern = patterns.values().stream()
        .anyMatch(c -> c > badcases.size() * 0.2);

    if (currentModel.isSmallModel() && hasConcentratedPattern) {
        // 小模型 + 错误集中 → 换大模型（最快见效）
        return new OptimizationDecision(
            Action.UPGRADE_MODEL,
            "当前7B模型能力不足，建议升级到72B+模型"
        );
    }

    if (hasConcentratedPattern && hasSFTData) {
        // 错误集中 + 有训练数据 → SFT
        return new OptimizationDecision(
            Action.SFT,
            "收集了%d条高质量badcase数据，适合SFT".formatted(badcases.size())
        );
    }

    if (!hasConcentratedPattern) {
        // 错误分散 → 场景分流 + 规则兜底
        return new OptimizationDecision(
            Action.SCENARIO_ROUTING,
            "错误分散，先拆场景+加兜底规则"
        );
    }

    // 默认：先试Prompt优化
    return new OptimizationDecision(
        Action.PROMPT_TUNE,
        "尝试针对性优化Prompt"
    );
}
```

> ⚠️ **工程踩坑**：SFT不是万能药。**SFT适合"错误模式明确且集中"的场景**。如果Badcase是偶发的、多样的，SFT反而可能引入新问题——因为微调数据覆盖不到的case会退化。先确认错误模式再决定是否SFT。

---

## 三、工程落地

### Q7: 推理优化做了哪些？用了continuous batching、KV Cache还是vLLM？

**深度回答**:

**推理优化三板斧**：

```java
/**
 * 推理优化配置（接入vLLM的Java客户端）
 */
@Configuration
public class InferenceOptimizationConfig {

    // ========== 1. vLLM + PagedAttention ==========
    // 替代原生Transformers推理，内存利用率提升5-10倍
    // 启用方式：部署时用 vllm serve --model Qwen/Qwen2.5-72B-Instruct
    // Java端通过OpenAI兼容接口调用

    @Bean
    public ChatClient optimizedClient() {
        return ChatClient.builder()
            // 指向vLLM部署的服务
            .baseUrl("http://vllm-inference:8000/v1")
            .defaultRequestOptions(RequestOptions.builder()
                // 2. Continuous Batching：vLLM默认开启
                // 多个请求共享一个批次，GPU利用率提升
                .build())
            .build();
    }

    // ========== 2. KV Cache 优化 ==========
    // 对于多轮对话场景，重用历史KV Cache，避免重复计算
    // vLLM支持 prefix caching（自动缓存公共前缀）
    // 部署参数: vllm serve ... --enable-prefix-caching

    // ========== 3. 量化 ==========
    // INT4/INT8量化，显存占用降低60%+，延迟降低30%
    // vllm serve ... -- quantization awq --qmodel Qwen2.5-72B-Instruct-AWQ

    // ========== 4. 流式输出 ==========
    // 首字时延优先：用stream=true + SSE，用户感知更快
}
```

**各优化技术效果对比**：

| 技术 | 延迟降低 | 吞吐提升 | 显存节省 | 实现复杂度 |
|------|---------|---------|---------|-----------|
| vLLM + PagedAttention | 20-30% | 5-10x | 60% | 中（替换推理引擎） |
| Continuous Batching | - | 2-3x | - | vLLM内置 |
| KV Cache Prefix Cache | 30-50%* | - | 40% | vLLM内置 |
| INT4量化 | 30-50% | 1.5-2x | 60-70% | 低（下载量化版模型） |
| 流式输出(SSE) | 感知提升 | - | - | 低 |

> **注**：*KV Cache Prefix Cache在多轮对话中效果最明显，首次查询无收益。

**吞吐量参考**（基于单张A100-80G）：

| 模型 | 量化 | 批次大小 | 输出吞吐(tokens/s) |
|------|------|---------|-------------------|
| Qwen2.5-7B | INT4 | 64 | ~5000 |
| Qwen2.5-14B | INT4 | 32 | ~3000 |
| Qwen2.5-72B | INT4 | 8 | ~800 |
| Qwen2.5-72B | FP16 | 4 | ~200 |

> ⚠️ **工程踩坑**：KV Cache优化在多轮对话中收益很大，但**长对话的显存占用是线性增长的**。建议设置最大历史轮数（如最近10轮），超出的部分抛弃或做summary压缩。

---

## 四、语音与时延

### Q8: 是否涉及语音？ASR选型看哪些指标？

**深度回答**:

如果涉及语音客服场景，ASR选型要关注以下指标：

| 指标 | 说明 | 阈值要求 |
|------|------|---------|
| **WER (词错误率)** | 核心指标，越低越好 | <5%（安静环境）/<15%（嘈杂） |
| **首字时延** | 从说话到第一个字识别出来 | <200ms |
| **尾字时延** | 说话结束到完整文本输出 | <500ms |
| **VAD准确率** | 语音活动检测，静音切分 | 漏检率<1% |
| **领域适配** | 是否支持旅游/酒店等专业术语 | 支持热词定制 |
| **方言支持** | 携程用户覆盖全国 | 至少支持粤语/川渝 |

**Java集成示例**：

```java
@Service
public class ASRService {

    // 集成阿里云/腾讯云ASR（Java SDK）
    private final SpeechRecognizer recognizer;

    /**
     * 流式语音识别
     */
    public Flux<String> streamingRecognize(InputStream audioStream) {
        return Flux.create(sink -> {
            recognizer.startTranscription(
                RecognitionRequest.builder()
                    .sampleRate(16000)
                    .enableIntermediateResult(true)  // 实时返回中间结果
                    .enablePunctuation(true)
                    .enableHotWords(List.of("携程", "机票", "退改签", "酒店预订"))
                    .build(),
                new RecognitionCallback() {
                    @Override
                    public void onRecognitionResult(RecognitionResult result) {
                        // 持续吐出识别文本
                        sink.next(result.getText());
                    }

                    @Override
                    public void onComplete() {
                        sink.complete();
                    }

                    @Override
                    public void onError(Exception e) {
                        sink.error(e);
                    }
                }
            );
        });
    }
}
```

---

### Q9: 整体链路从query到报告生成，首字时延和完整时延分别是多少？

**深度回答**:

**以携程旅行报告生成场景为例**：

```
链路拆解：
用户语音 → ASR识别 → 意图理解 → RAG检索 → LLM生成 → TTS播报
                    ↓           ↓          ↓
                 200-500ms   300-800ms  1-3s
                    ↓                      ↓
               首字时延起点           完整时延终点
```

**各环节延迟拆解**：

| 环节 | 耗时 | 优化方案 |
|------|------|---------|
| ASR识别 | 200-500ms | 流式识别，边听边出 |
| 意图理解 | 50-100ms | 小模型分类器替代LLM |
| RAG检索 | 100-500ms | 向量+缓存，减少检索量 |
| LLM首Token | 300-1000ms | vLLM + KV Cache |
| LLM完整生成 | 1-5s | 量化 + 流式输出 |
| TTS | 0-500ms | 首句预合成 |

**优化目标**：

```
实时交互场景：
  首字时延（用户感知）: < 500ms
  完整时延（最终结果）: < 3s

异步报告场景：
  首字时延（告知开始）: < 2s
  完整时延（报告完成）: < 30s
```

> ⚠️ **工程踩坑**：**首字时延不等于首Token时延**。用户感知的"首字"是LLM生成第一个有意义的字，而不仅仅是模型输出第一个token。建议在SSE流式中，先返回"正在为您查询..."等占位文本，然后再流式输出真实内容，降低用户等待焦虑。

---

## 五、团队与协作

### Q10: 团队规模和分工？你负责的边界在哪？

**深度回答建议**：

这道题考察你的**角色定位**和**协作意识**，建议按以下结构回答：

```
1. 团队规模：XX人（后端N人 + 算法N人 + 前端N人 + 产品N人）
2. 分工方式：按模块/按流程/按能力
3. 你的职责：
   - 核心负责：Agent编排框架设计、Prompt工程管理、RAG链路
   - 配合部分：模型选型评估、数据标注标准、线上监控
4. 边界意识：知道自己负责什么，知道什么需要拉别人一起讨论
```

**示例回答**：

> "我们团队12人，后端6人、算法3人、前端2人、PM1人。我主要负责Agent编排层的设计和实现，包括Workflow路由、工具注册管理、多轮对话状态维护。算法同学负责模型训练和SFT，我负责提供Badcase数据和评估标准。前端同学负责对话UI和流式展示，我需要定义SSE的传输协议格式。"

---

### Q11: 作为项目负责人，怎么定里程碑、推进协作、处理阻塞？

**深度回答建议**：

**定里程碑**方法：

```
里程碑制定原则：逆向拆解
① 确定上线目标日期 → ② 倒推各阶段时间
③ 预留buffer（20-30%） → ④ 拆解到周任务

示例（Agent系统从0到1，3个月）：
  W1-W2: 架构设计 + 技术选型评审
  W3-W5: 核心链路开发（意图识别 + RAG + 生成）
  W6-W7: 工具集成 + 多轮对话
  W8-W9: Prompt调优 + 评测体系搭建
  W10-W11: Badcase修复 + 压力测试
  W12: 灰度上线 + 线上监控
```

**推进协作**：

```java
// 以Sprint Review和每日站会为推进手段
// 关键：暴露风险 > 汇报进度

// 每日站会三句话：
// 1. 昨天做了什么
// 2. 今天计划做什么
// 3. 有什么阻塞（重点！）
```

**处理阻塞**：

| 阻塞类型 | 处理策略 |
|---------|---------|
| 技术方案不确定 | 快速POC验证（2天内出结论） |
| 依赖其他团队 | 提前沟通、拉群、定期同步会 |
| 资源不足 | 量化影响，让PM排优先级 |
| 模型效果不好 | 如果是核心路径，果断上备用方案 |

---

## 六、动机

### Q12: 为什么离开？下一份工作的诉求是什么？

**回答策略**：

```
❌ 不推荐：
  - "现有平台太小，想换大厂"（显得浮躁）
  - "薪资太低"（显得只看钱）
  - "团队氛围不好"（显得难以相处）

✅ 推荐方向：
  - "希望在Agent领域深入，贵司的业务场景很有挑战"
  - "想从偏基础建设转到偏业务落地的位置"
  - "看好智能化客服/旅游助手的方向，与我的经验匹配"

核心：把"离开"包装成"追求"，而不是"逃避"
```

**诉求表达建议**：

```
✅ 好：
  "希望有真正落地的Agent业务场景"
  "希望团队技术氛围好，有定期的技术分享"
  "希望有明确的成长路径，不只是做重复工作"

❌ 不好：
  "希望不加班"
  "希望薪资翻倍"
  "希望没有压力"
```

---

## 七、面试官视角总结

**面试官最关心的3个点**：

1. **有没有真实生产经验** — Prompt调优、Badcase归因、推理优化这些只有真做过才能讲出细节
2. **决策逻辑是否清晰** — 遇到瓶颈怎么判断下一步，比背"SFT比Prompt好"这种结论重要100倍
3. **工程意识** — 链路追踪、评估体系、延迟优化，这些都是线上Agent系统必须有的

**备考建议**：

- **重点准备Prompt调优→瓶颈→SFT决策**这条线，面试官明确说了"很关注"
- 准备一个 **Badcase归因的真实案例**，从发现到定位到修复的完整链条
- 理解**架构选型的trade-off**，而不是只说"我们用XX框架"
- 时延相关的数据要能说出**具体数字**（首字时延、完整时延、吞吐量），有数字=有经验