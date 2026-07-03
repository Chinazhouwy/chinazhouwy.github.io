# 字节跳动 Agent开发二面面经（深度版）

> **来源**: [小红书 @程序员尺哥](http://xhslink.com/o/4ZRu5qJzcrM)
> **发布日期**: 2026-05
> **标签**: `字节跳动` `Agent开发` `二面` `Multi-Agent` `RAG` `SFT` `评测`
> **考点分类**: Agent架构 / 幻觉治理 / 记忆设计 / Badcase链路 / RAG优化 / 系统设计
> **互动**: 👍96 📌207

---

## 面试结构

- **项目一/Agent落地**（Q3-Q12）：深挖架构、幻觉、Multi-Agent、记忆、Badcase
- **项目二/RAG系统**（Q13-Q18）：文档解析、检索优化、多轮对话、效率平衡
- **项目三/大规模系统**（Q19）：成本效率+架构设计
- **手撕算法**（Q20）：最长公共子串
- **HR类**（Q1-Q2, Q21+）：自我介绍、职级预期、换工作原因、反问

---

## 项目一：Agent落地（Q3-Q12）

### Q3: 研究型Agent的整体架构怎么设计？主要解决什么问题？

**答题思路**：先讲业务场景（研究型=高准确性、可溯源），再讲架构分层，最后说为什么这么设计。

```java
// 研究型Agent架构：分层编排 + 人工兜底
// 核心问题：学术/行业研究需要高准确性、可溯源、可审计

/**
 * 架构分层：
 * ┌─────────────────────────────────┐
 * │  编排层 (Orchestrator)          │  ← ReAct循环 + 人工审批节点
 * ├─────────────────────────────────┤
 * │  能力层 (Capabilities)           │  ← 检索/计算/图表/导出
 * ├─────────────────────────────────┤
 * │  记忆层 (Memory)                │  ← 短期/中期/长期 + 摘要压缩
 * ├─────────────────────────────────┤
 * │  安全层 (Guardrails)            │  ← 幻觉检测 + 引用校验 + 敏感过滤
 * └─────────────────────────────────┘
 */
```

**Spring AI实现**：

```java
@Service
public class ResearchAgent {
    private final ChatClient chatClient;
    private final ResearchMemory memory;
    private final HallucinationDetector detector;
    private final CitationValidator validator;

    public ResearchResult research(String question) {
        // Step 1: 规划 — 分解研究问题
        List<SubTask> tasks = planner.decompose(question);

        // Step 2: 执行 — ReAct循环，每步有校验
        List<ResearchStep> steps = new ArrayList<>();
        for (SubTask task : tasks) {
            ResearchStep step = executeWithVerification(task);
            // 幻觉检测不通过 → 重试或降级为人工审核
            if (!detector.isReliable(step)) {
                step = handleUnreliable(step); // 重试/人工审批
            }
            steps.add(step);
            memory.addShortTerm(step); // 滚动记忆
        }

        // Step 3: 综合 — 汇总各子任务结论
        ResearchReport report = synthesizer.compile(steps);
        // 引用校验：每个claim必须有source
        validator.validateAllCitations(report);
        return report;
    }
}
```

**为什么这么设计**：
- 研究型场景不能容忍幻觉 → 每步有校验，不通过就重试/人工兜底
- 问题复杂度高 → 先分解再执行，避免单次LLM调用上下文溢出
- 可溯源要求 → 每个结论必须关联引用源

---

### Q4: 高准确性场景里，怎么控制幻觉？

**答题思路**：不是"加个RAG就行"，要讲**多层防御**。

```java
/**
 * 幻觉控制：四层防线
 * Layer 1: Prompt约束 — 限制输出格式和引用要求
 * Layer 2: 检索增强 — 只基于检索到的事实生成
 * Layer 3: 后置校验 — 生成后交叉验证
 * Layer 4: 人工兜底 — 高风险领域人工审批
 */

// Layer 1: Prompt约束
private static final String RESEARCH_PROMPT = """
    你是一个严谨的研究助手。必须遵守：
    1. 只基于提供的参考资料回答，不得编造信息
    2. 每个论断必须标注引用来源 [source_id]
    3. 如果参考资料不足以回答，明确说"根据已有资料无法确认"
    4. 区分"事实"和"推测"，推测需标注[推测]
    """;

// Layer 3: 后置校验 — 交叉验证
@Component
public class HallucinationDetector {
    private final ChatClient verifier;

    /**
     * 校验方法：把生成的claim和原始检索文档做交叉验证
     * 返回置信度分数 0-1
     */
    public VerificationResult verify(String claim, List<Document> sources) {
        // 方法1: NLI（自然语言推理）— 判断claim是否可由source entail
        double nliScore = nliVerifier.entailment(claim, sources);

        // 方法2: 自一致性 — 多次生成看结果是否一致
        List<String> regenerations = IntStream.range(0, 3)
            .mapToObj(i -> regenerate(claim, sources))
            .toList();
        double consistencyScore = semanticSimilarity.avg(regenerations);

        // 方法3: 引用校验 — claim标注的引用是否真实存在于source
        boolean citationValid = citationChecker.check(claim, sources);

        double finalScore = 0.4 * nliScore + 0.3 * consistencyScore + 0.3 * (citationValid ? 1.0 : 0.0);
        return new VerificationResult(finalScore, finalScore >= 0.7);
    }
}

// Layer 4: 人工兜底（低置信度自动转人工）
@Component
public class HumanReviewGateway {
    public ResearchStep handleLowConfidence(ResearchStep step) {
        if (step.getConfidence() < 0.5) {
            // 创建人工审核任务
            reviewTaskService.createTask(step, ReviewPriority.HIGH);
            step.setStatus(StepStatus.PENDING_REVIEW);
        }
        return step;
    }
}
```

**工程踩坑**：
- 自一致性校验成本高（3倍token消耗）→ 只对关键结论做，普通描述性内容跳过
- NLI模型本身可能不准 → 用规则+模型混合：规则查引用存在性，模型判断语义一致性
- 阈值怎么定 → 根据业务可接受的错误率反推，不是拍脑袋

---

### Q5: 幻觉率和引用错误率做到什么水平？业务上是否可接受？

**答题思路**：给具体数字 + 讲清楚度量方式 + 说明为什么可接受。

```
度量体系：
├── 幻觉率 = 包含无支撑论断的回答数 / 总回答数
│   └── 我们做到：3-5%（行业基准10-15%）
│   └── 不可接受的场景（医疗/法律）→ 0%容忍，必须人工审核
│
├── 引用错误率 = 引用不匹配或捏造的引用数 / 总引用数
│   └── 我们做到：2-3%
│   └── 优化手段：引用锚点从"段落级"细化到"句子级"
│
└── 端到端准确率 = 用户标注正确的回答 / 总回答
    └── 我们做到：85-90%（非关键场景可接受）
```

**关键**：不是追求0%（不现实），而是建立**错误分级**：
- 🔴 致命错误（编造数据/法规）→ 0容忍，多层校验+人工兜底
- 🟡 次要错误（过度概括/细节偏差）→ 允许存在，badcase回流优化
- 🟢 可接受偏差（措辞不精确但不影响结论）→ 记录但不阻断

---

### Q6: Multi-Agent框架是自己搭的，还是基于LangChain/LangGraph做的？

**答题思路**：诚实回答 + 讲清楚选择理由和定制点。

```
我们选择自研框架，原因：
1. LangChain/LangGraph是Python生态，我们是Java技术栈
2. 研究场景需要深度定制：任务回退、checkpoint、trace回放，LangGraph的checkpoint机制不够灵活
3. 我们需要和内部系统深度集成（权限、数据源、审批流）

但借鉴了LangGraph的核心思想：
- 图结构编排（非简单链式）
- 条件分支 + 循环
- 状态机管理
```

```java
// 自研Agent框架核心：基于状态机的图编排
@Component
public class AgentGraph {
    private final Map<String, AgentNode> nodes;
    private final List<AgentEdge> edges;

    public static class Builder {
        public Builder addNode(String name, AgentNode node) { ... }
        public Builder addEdge(String from, String to) { ... }
        public Builder addConditionalEdge(String from, ConditionFn condition,
                                          Map<String, String> mappings) { ... }
        public AgentGraph build() { ... }
    }

    // 执行：状态机驱动
    public GraphState execute(GraphState initialState) {
        GraphState state = initialState;
        String currentNode = START;

        while (!currentNode.equals(END)) {
            AgentNode node = nodes.get(currentNode);
            state = node.execute(state);
            // 记录checkpoint（支持回退）
            checkpointManager.save(state);
            // 条件路由
            currentNode = route(currentNode, state);
        }
        return state;
    }
}

// 使用示例
AgentGraph graph = AgentGraph.builder()
    .addNode("planner", plannerNode)
    .addNode("researcher", researcherNode)
    .addNode("reviewer", reviewerNode)
    .addNode("reviser", reviserNode)
    .addEdge("planner", "researcher")
    .addConditionalEdge("researcher", 
        state -> state.getConfidence() > 0.7 ? "reviewer" : "reviser",
        Map.of("reviewer", "reviewer", "reviser", "reviser"))
    .addEdge("reviser", "researcher")  // 回退重做
    .addEdge("reviewer", END)
    .build();
```

---

### Q7: 你们定制了哪些能力？任务调度、状态回退、checkpoint、trace回放？

```java
// 1. 任务调度：优先级队列 + 依赖DAG
@Service
public class TaskScheduler {
    private final PriorityBlockingQueue<AgentTask> queue;
    private final TaskDependencyGraph dependencyGraph;

    public void submit(AgentTask task) {
        // 解析任务依赖，构建DAG
        dependencyGraph.addTask(task);
        // 所有前置依赖完成 → 入队执行
        if (dependencyGraph.readyToRun(task.getId())) {
            queue.put(task);
        }
    }
}

// 2. 状态回退：基于checkpoint的回滚
@Component
public class CheckpointManager {
    private final StateStore stateStore; // Redis/DB

    public void save(GraphState state) {
        stateStore.save(state.getTaskId(), state.getStepIndex(),
                        JsonUtils.serialize(state));
    }

    public GraphState rollback(String taskId, int targetStep) {
        // 回退到指定步骤的checkpoint
        String snapshot = stateStore.load(taskId, targetStep);
        return JsonUtils.deserialize(snapshot, GraphState.class);
    }

    // 支持分支：从某个checkpoint fork出新路径
    public GraphState fork(String taskId, int fromStep, Map<String, Object> overrides) {
        GraphState base = rollback(taskId, fromStep);
        base.merge(overrides);
        base.setBranchId(UUID.randomUUID().toString());
        return base;
    }
}

// 3. Trace回放：完整记录Agent执行过程
@Aspect
@Component
public class AgentTraceAspect {
    private final TraceStore traceStore;

    @Around("execution(* com..agent..*(..))")
    public Object trace(ProceedingJoinPoint pjp) throws Throwable {
        TraceSpan span = TraceSpan.builder()
            .traceId(MDC.get("traceId"))
            .node(pjp.getSignature().getName())
            .input(JsonUtils.serialize(pjp.getArgs()))
            .startTime(Instant.now())
            .build();

        try {
            Object result = pjp.proceed();
            span.setOutput(JsonUtils.serialize(result));
            span.setStatus(SpanStatus.SUCCESS);
            return result;
        } catch (Exception e) {
            span.setError(e.getMessage());
            span.setStatus(SpanStatus.FAILED);
            throw e;
        } finally {
            span.setEndTime(Instant.now());
            traceStore.save(span);
        }
    }
}

// 回放接口：按traceId重放整个Agent执行过程
@GetMapping("/trace/{traceId}/replay")
public ReplayResult replay(@PathVariable String traceId) {
    List<TraceSpan> spans = traceStore.loadByTraceId(traceId);
    // 可视化展示每一步的输入/输出/耗时
    // 支持从某一步开始重新执行（调试用）
    return ReplayResult.fromSpans(spans);
}
```

**工程踩坑**：
- Checkpoint粒度太细 → 存储爆炸。我们折中：每个AgentNode执行完存一次，中间步骤只记trace不存checkpoint
- Trace数据量大 → 热数据Redis（最近7天），冷数据转ES/S3
- 回放≠重放：回放是只读查看历史，重放是重新执行（可能结果不同因为LLM非确定性）

---

### Q8: Agent里的长期/中期/短期记忆分别怎么设计？

```
记忆分层架构：

短期记忆（工作记忆）
├── 存储：当前对话上下文
├── 载体：LLM的上下文窗口
├── 生命周期：单次会话
├── 大小限制：受模型context window约束（128K tokens）
│
中期记忆（会话记忆）
├── 存储：当前任务的累积状态
├── 载体：结构化状态对象 + 摘要
├── 生命周期：单次任务（可能跨多轮对话）
├── 滚动策略：超出窗口时做摘要压缩
│
长期记忆（知识记忆）
├── 存储：向量数据库 + 结构化知识图谱
├── 载体：向量索引 + Neo4j/关系表
├── 生命周期：永久，跨会话
├── 检索：语义相似度 + 知识图谱推理
```

```java
@Service
public class ResearchMemory {
    private final VectorStore vectorStore;      // 长期
    private final RedisTemplate<String, String> redis; // 中期
    private final ChatClient summarizer;         // 摘要压缩

    // 短期记忆：直接放在LLM上下文中
    public List<Message> buildShortTermContext(String sessionId) {
        // 从Redis取最近N轮对话
        return sessionStore.getRecentMessages(sessionId, 10);
    }

    // 中期记忆：任务级状态 + 摘要
    public String getMidTermSummary(String taskId) {
        String summary = (String) redis.opsForValue().get("memory:mid:" + taskId);
        if (summary == null) {
            // 首次，从短期记忆生成初始摘要
            summary = compressAndSummarize(taskId);
            redis.opsForValue().set("memory:mid:" + taskId, summary, 24, HOURS);
        }
        return summary;
    }

    // 长期记忆：语义检索
    public List<Document> recallLongTerm(String query, int topK) {
        return vectorStore.similaritySearch(
            SearchRequest.builder()
                .query(query)
                .topK(topK)
                .similarityThreshold(0.7)
                .build());
    }

    // 记忆写入：研究结果沉淀为长期记忆
    public void persistToLongTerm(ResearchReport report) {
        // 结构化存储：关键发现→知识图谱
        knowledgeGraphService.saveFindings(report.getFindings());
        // 非结构化存储：全文→向量库
        vectorStore.add(List.of(new Document(report.toText(), report.getMetadata())));
    }
}
```

---

### Q9: 记忆滚动更新、摘要压缩、结构化压缩是怎么做的？

```java
@Component
public class MemoryCompressor {
    private final ChatClient compressor;
    private final TokenCounter tokenCounter;

    /**
     * 滚动更新策略：
     * 1. 对话轮数 < N → 保留完整对话
     * 2. 对话轮数 >= N → 触发压缩
     * 3. 压缩方式：摘要 + 关键实体提取
     */
    public CompressedMemory compress(List<Message> messages, int maxTokens) {
        int currentTokens = tokenCounter.count(messages);
        if (currentTokens <= maxTokens) {
            return CompressedMemory.uncompressed(messages);
        }

        // Step 1: 保留最近K轮完整对话（最近的不压缩）
        int splitIndex = findSplitPoint(messages, maxTokens / 3);
        List<Message> recent = messages.subList(splitIndex, messages.size());
        List<Message> older = messages.subList(0, splitIndex);

        // Step 2: 摘要压缩（老对话）
        String summary = compressor.prompt()
            .user(u -> u.text("""
                将以下对话历史压缩为简洁摘要，保留：
                1. 关键决策和结论
                2. 已确定的事实和数据
                3. 未解决的问题
                丢弃：闲聊、重复内容、中间试错过程

                对话历史：{history}
                """).param("history", formatMessages(older)))
            .call()
            .content();

        // Step 3: 结构化压缩 — 提取关键实体和关系
        StructuredMemory structured = extractEntitiesAndRelations(older);

        return CompressedMemory.builder()
            .summary(summary)                    // 自然语言摘要
            .structuredMemory(structured)         // 结构化实体/关系
            .recentMessages(recent)              // 最近K轮完整保留
            .build();
    }

    /**
     * 结构化压缩：提取实体→关系→关键指标
     * 比纯摘要更紧凑，且支持精确检索
     */
    private StructuredMemory extractEntitiesAndRelations(List<Message> messages) {
        String json = compressor.prompt()
            .user(u -> u.text("""
                从对话中提取结构化信息，输出JSON：
                {
                  "entities": [{"name": "...", "type": "person|org|concept|data", "attrs": {...}}],
                  "relations": [{"from": "...", "to": "...", "type": "..."}],
                  "keyFindings": ["..."],
                  "openQuestions": ["..."]
                }
                对话：{messages}
                """).param("messages", formatMessages(messages)))
            .call()
            .content();
        return JsonUtils.parse(json, StructuredMemory.class);
    }
}
```

**工程踩坑**：
- 摘要压缩有信息损失 → 关键数据（数值、结论）单独提取为结构化字段，不依赖摘要
- Token计数不准 → 不同模型tokenizer不同，用tiktoken-java统一计数
- 压缩时机太晚 → 上下文接近上限时才压缩会截断，我们设在上限的60%就触发

---

### Q10: Badcase怎么定义？review拒绝、用户不采纳、高质量样本分别怎么处理？

```
Badcase分类体系：

1. Review拒绝（审校环节发现问题）
   ├── 事实性错误 → 标记为 F-ERROR，进入SFT回流
   ├── 格式不规范 → 标记为 F-FORMAT，进入prompt优化
   └── 安全合规问题 → 标记为 F-SAFETY，进入护栏规则库

2. 用户不采纳（用户看了但没用）
   ├── 回答不相关 → 标记为 U-IRRELEVANT，检索策略优化
   ├── 回答太浅/太深 → 标记为 U-DEPTH，prompt调优
   └── 回答太慢 → 标记为 U-LATENCY，架构优化

3. 高质量样本（用户采纳且好评）
   └── 标记为 POSITIVE，进入SFT正样本池
```

```java
@Component
public class BadcaseManager {
    private final BadcaseRepository repo;
    private final SftDataPipeline sftPipeline;

    /**
     * Badcase分类 → 不同处理链路
     */
    public void classifyAndRoute(BadcaseRecord record) {
        BadcaseCategory category = classify(record);
        record.setCategory(category);

        switch (category) {
            case FACTUAL_ERROR -> {
                // 事实性错误 → 构造SFT负样本（正确答案+错误答案对比）
                SftSample sample = SftSample.builder()
                    .input(record.getQuery())
                    .preferredOutput(record.getCorrectAnswer())  // 人工纠正后的答案
                    .rejectedOutput(record.getModelOutput())     // 模型原始输出
                    .type(SftSampleType.DPO)                    // DPO对比学习
                    .build();
                sftPipeline.addSample(sample);
            }
            case FORMAT_ERROR -> {
                // 格式问题 → 优化system prompt中的输出格式要求
                promptVersionService.suggestFormatFix(record);
            }
            case SAFETY -> {
                // 安全问题 → 加入护栏规则
                guardrailService.addRule(record.getViolationType(), record.getPattern());
            }
            case IRRELEVANT -> {
                // 不相关 → 检查检索质量
                retrievalAuditor.audit(record.getQuery(), record.getRetrievedDocs());
            }
        }
        repo.save(record);
    }
}
```

---

### Q11: Badcase回流到SFT的完整链路是怎样的？

```
Badcase → SFT 完整链路：

┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│ Badcase收集  │ →  │ 人工标注/纠正 │ →  │ 样本构造     │ →  │ SFT训练   │
│ (线上+离线)  │    │ (标注平台)    │    │ (DPO/SFT)   │    │ (百炼API) │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────┘
       ↓                   ↓                   ↓                  ↓
  自动采集           人工审核            数据增强/去重          模型评估
  用户行为信号       标注一致性检查       质量评分过滤          A/B测试上线
```

```java
@Service
public class SftDataPipeline {
    private final SftSampleRepository sampleRepo;
    private final QualityFilter qualityFilter;

    /**
     * Step 1: 样本构造 — Badcase转为训练数据
     */
    public void buildSftSamples(List<BadcaseRecord> badcases) {
        List<SftSample> samples = badcases.stream()
            .filter(bc -> bc.getCorrectAnswer() != null) // 已人工纠正
            .map(this::convertToSample)
            .filter(qualityFilter::passes)  // 质量过滤
            .toList();

        sampleRepo.saveAll(samples);
    }

    private SftSample convertToSample(BadcaseRecord bc) {
        if (bc.getCategory() == BadcaseCategory.FACTUAL_ERROR) {
            // DPO样本：preferred vs rejected
            return SftSample.builder()
                .systemPrompt(bc.getSystemPrompt())
                .userQuery(bc.getQuery())
                .preferredOutput(bc.getCorrectAnswer())
                .rejectedOutput(bc.getModelOutput())
                .type(SftSampleType.DPO)
                .source("badcase:" + bc.getId())
                .build();
        } else {
            // SFT样本：只学正确答案
            return SftSample.builder()
                .systemPrompt(bc.getSystemPrompt())
                .userQuery(bc.getQuery())
                .preferredOutput(bc.getCorrectAnswer())
                .type(SftSampleType.SFT)
                .source("badcase:" + bc.getId())
                .build();
        }
    }

    /**
     * Step 2: 数据增强 — 防止过拟合
     */
    public List<SftSample> augment(List<SftSample> samples) {
        return samples.stream()
            .flatMap(sample -> {
                List<SftSample> augmented = new ArrayList<>();
                augmented.add(sample); // 原始样本
                // 改写query（同义改写、换角度提问）
                augmented.addAll(paraphraseQuery(sample, 2));
                return augmented.stream();
            })
            .filter(s -> !isDuplicate(s))  // 去重（embedding相似度>0.95）
            .toList();
    }

    /**
     * Step 3: 训练 → 评估 → 上线
     * 调用阿里百炼API进行SFT训练
     */
    public FineTuneJob submitFineTuneJob(List<SftSample> samples) {
        // 上传训练数据到OSS
        String dataUrl = uploadToOss(samples);
        // 调用百炼SFT API
        return bailianSftClient.createJob(FineTuneRequest.builder()
            .model("qwen-plus")
            .trainingDataUrl(dataUrl)
            .epochs(3)
            .learningRate(1e-5)
            .build());
    }
}
```

**工程踩坑**：
- Badcase数量少、分布不均 → 数据增强很重要，否则模型过拟合到几个case
- 标注质量参差不齐 → 标注一致性检查：同一case双标注，不一致的丢弃
- SFT后效果回退 → 必须在hold-out测试集上评估，不能只在badcase上看

---

### Q12: 评测体系是谁来搭的？检索评测、生成评测、Agent链路评测和线上评测？

```
评测体系分层：

1. 检索评测（召回质量）
   ├── 指标：Recall@K, MRR, NDCG
   ├── 方法：人工标注query-doc相关性
   └── 负责人：搜索/检索团队

2. 生成评测（回答质量）
   ├── 指标：BLEU/ROUGE（参考性）, LLM-as-Judge（综合）
   ├── 方法：黄金数据集 + GPT-4裁判打分
   └── 负责人：算法团队

3. Agent链路评测（端到端）
   ├── 指标：任务完成率, 步骤准确率, 幻觉率
   ├── 方法：模拟用户场景 + 预期结果比对
   └── 负责人：Agent团队（我们搭的）

4. 线上评测（真实效果）
   ├── 指标：用户采纳率, 修正率, 留存率
   ├── 方法：A/B测试 + 用户行为埋点
   └── 负责人：产品+数据团队
```

```java
@Component
public class AgentEvaluator {
    /**
     * Agent链路评测：模拟场景 + 预期结果比对
     */
    public EvaluationReport evaluate(List<TestCase> testCases) {
        List<CaseResult> results = testCases.parallelStream()
            .map(tc -> {
                AgentOutput output = agent.run(tc.getInput());
                return CaseResult.builder()
                    .testCase(tc)
                    .actualOutput(output)
                    .taskCompleted(tc.getExpectedOutcome().matches(output))
                    .stepAccuracy(compareSteps(tc.getExpectedSteps(), output.getSteps()))
                    .hallucinationRate(detector.detectRate(output))
                    .build();
            })
            .toList();

        return EvaluationReport.builder()
            .totalCases(results.size())
            .taskCompletionRate(avg(results, CaseResult::isTaskCompleted))
            .avgStepAccuracy(avg(results, CaseResult::getStepAccuracy))
            .avgHallucinationRate(avg(results, CaseResult::getHallucinationRate))
            .failedCases(results.stream().filter(r -> !r.isTaskCompleted()).toList())
            .build();
    }
}
```

---

## 项目二：RAG系统（Q13-Q18）

### Q13: 第二个知识助手类项目的场景和难点是什么？

**场景**：企业内部知识库助手，员工用自然语言查询公司制度、产品文档、技术规范。

**难点**：
1. **文档类型复杂**：PDF/Word/Excel/图片混排，表格和条款解析难度大
2. **领域术语多**：行业黑话、缩写，通用embedding效果差
3. **准确率要求高**：错误的制度解读可能导致合规风险
4. **多轮对话**：用户追问时上下文容易断裂

---

### Q14: PDF/表格/条款类文档怎么解析和切分？

```java
@Service
public class DocumentParser {
    private final PdfParser pdfParser;      // Apache PDFBox / 自研
    private final TableExtractor tableExtractor;  // Camelot / Table Transformer
    private final OcrService ocrService;    // PaddleOCR（图片中的文字）

    /**
     * 分文档类型走不同解析链路
     */
    public List<DocumentChunk> parse(MultipartFile file) {
        String type = FilenameUtils.getExtension(file.getOriginalFilename());

        return switch (type) {
            case "pdf" -> parsePdf(file);
            case "docx" -> parseDocx(file);
            case "xlsx" -> parseExcel(file);
            default -> throw new UnsupportedDocumentTypeException(type);
        };
    }

    private List<DocumentChunk> parsePdf(MultipartFile file) {
        // Step 1: 区分文字PDF和扫描PDF
        boolean isScanned = pdfParser.isScanned(file.getInputStream());

        if (isScanned) {
            // 扫描件 → OCR
            return ocrService.extract(file.getBytes()).stream()
                .map(this::toChunk)
                .toList();
        }

        // Step 2: 提取文本 + 检测表格区域
        List<PdfElement> elements = pdfParser.extractElements(file.getInputStream());

        List<DocumentChunk> chunks = new ArrayList<>();
        for (PdfElement el : elements) {
            if (el.getType() == TABLE) {
                // 表格 → Markdown格式保留结构
                String markdownTable = tableExtractor.toMarkdown(el);
                chunks.add(DocumentChunk.table(el.getPage(), markdownTable));
            } else {
                // 文本 → 按语义切分
                chunks.addAll(semanticSplit(el.getText()));
            }
        }
        return chunks;
    }

    /**
     * 语义切分（而非固定长度切分）
     * 关键：保持段落/条款的完整性
     */
    private List<DocumentChunk> semanticSplit(String text) {
        // 策略1: 按标题层级切分（条款文档）
        List<String> sections = splitByHeadings(text);
        if (sections.size() > 1) {
            return sections.stream()
                .map(s -> DocumentChunk.text(s, estimateTokens(s)))
                .toList();
        }

        // 策略2: 按语义边界切分（无标题的连续文本）
        // 限制chunk大小：200-500 tokens，overlap 50 tokens
        return slidingWindowSplit(text, 400, 50);
    }
}
```

**工程踩坑**：
- PDF表格解析是老大难 → Camelot对简单表有效，复杂合并单元格用Table Transformer（基于Detr模型）
- 扫描件OCR准确率不够 → 关键文档人工校对，非关键文档容忍少量错误
- 切分粒度：太大→检索不精准，太小→上下文断裂 → 我们用"父子chunk"：检索用小chunk，返回用大chunk

---

### Q15: 检索怎么优化？向量检索、关键词检索、rerank、query rewrite？

```
混合检索架构：

Query → [Query Rewrite] → [并行检索] → [Rerank] → [Context组装]
              ↓                ↓           ↓
         意图识别+改写    向量+关键词    交叉精排
         多query展开      取并集去重     TopK筛选
```

```java
@Service
public class HybridRetriever {
    private final VectorStore vectorStore;     // 向量检索
    private final ElasticsearchService esService; // 关键词检索
    private final RerankService rerankService;    // 重排序
    private final ChatClient queryRewriter;       // Query改写

    public List<Document> retrieve(String query, int topK) {
        // Step 1: Query改写 — 多角度展开
        List<String> queries = rewriteQuery(query);
        // 原始: "年假怎么请"
        // 改写: ["年假申请流程", "年假天数规定", "请假审批链路"]

        // Step 2: 并行检索 — 向量 + 关键词
        CompletableFuture<List<Document>> vectorFuture =
            CompletableFuture.supplyAsync(() ->
                queries.stream()
                    .flatMap(q -> vectorStore.similaritySearch(
                        SearchRequest.builder().query(q).topK(20).build()).stream())
                    .toList());

        CompletableFuture<List<Document>> keywordFuture =
            CompletableFuture.supplyAsync(() ->
                queries.stream()
                    .flatMap(q -> esService.search(q, 20).stream())
                    .toList());

        // 合并去重
        List<Document> candidates = merge(vectorFuture.join(), keywordFuture.join());

        // Step 3: Rerank精排
        return rerankService.rerank(query, candidates, topK);
    }

    private List<String> rewriteQuery(String original) {
        String rewritten = queryRewriter.prompt()
            .user(u -> u.text("""
                用户查询：{query}
                请生成3个不同角度的改写查询，帮助更全面地检索相关信息。
                直接输出JSON数组，不要解释。
                """).param("query", original))
            .call()
            .content();

        List<String> queries = JsonUtils.parseList(rewritten, String.class);
        queries.add(0, original); // 保留原始query
        return queries;
    }
}
```

**工程踩坑**：
- 向量检索召回率高但精度不够 → 加rerank是必须的，但rerank慢（100ms+）→ 候选集控制在50以内
- Query改写可能偏离原意 → 改写后的query和原query结果做并集，不替代
- ES关键词检索对中文分词敏感 → 用IK分词器 + 同义词词典覆盖领域术语

---

### Q16: 多轮对话下怎么解决上下文断裂和幻觉问题？

```java
@Service
public class MultiTurnHandler {
    private final ChatClient chatClient;
    private final HybridRetriever retriever;
    private final SessionStore sessionStore;

    public Answer handle(String sessionId, String currentQuestion) {
        // Step 1: 上下文补全 — 把省略指代补充完整
        List<Message> history = sessionStore.getHistory(sessionId);
        String resolvedQuestion = resolveReferences(currentQuestion, history);
        // 用户: "那它的申请流程呢？" → 解析: "那年假的申请流程呢？"

        // Step 2: 基于完整问题检索（不是模糊的追问）
        List<Document> docs = retriever.retrieve(resolvedQuestion, 5);

        // Step 3: 构建多轮上下文
        String context = buildContext(history, docs, currentQuestion);

        // Step 4: 生成回答 + 约束幻觉
        String answer = chatClient.prompt()
            .system(SYSTEM_PROMPT_MULTI_TURN)
            .user(context)
            .call()
            .content();

        // Step 5: 会话记忆更新
        sessionStore.addExchange(sessionId, currentQuestion, answer);
        return new Answer(answer, docs);
    }

    /**
     * 指代消解：把"它""这个""那个"替换为具体实体
     */
    private String resolveReferences(String question, List<Message> history) {
        String historySummary = summarizeHistory(history);
        return chatClient.prompt()
            .user(u -> u.text("""
                对话历史摘要：{history}
                当前问题：{question}

                如果当前问题包含代词（它、这个、那个等）或省略了主语，
                请替换为对话历史中的具体实体，输出完整问题。
                如果不需要补充，原样输出。
                """).param("history", historySummary)
                .param("question", question))
            .call()
            .content();
    }
}
```

---

### Q17: 这个项目有哪些不足？和后面的Agent项目相比差在哪？

**诚实回答**：

| 维度 | RAG知识助手 | Agent项目 |
|------|------------|----------|
| 交互模式 | 单轮问答为主 | 多步推理+工具调用 |
| 幻觉控制 | 依赖prompt约束 | 有校验层+人工兜底 |
| 上下文管理 | 简单窗口 | 分层记忆+摘要压缩 |
| 可扩展性 | 硬编码pipeline | 图编排+动态路由 |
| 评测 | 只看检索/生成指标 | 链路级+线上A/B |

**RAG项目的核心不足**：
1. 没有推理能力 — 复杂问题不会拆解，只会检索+拼凑
2. 幻觉控制弱 — 只靠prompt约束，没有后置校验
3. 检索是瓶颈 — 改写/rerank有提升但仍有badcase，向量模型对领域术语不敏感

---

### Q18: 怎么平衡准确率和效率？

```
平衡策略矩阵：

| 策略 | 准确率影响 | 效率影响 | 适用场景 |
|------|-----------|---------|---------|
| 混合检索 | +15% | -10%（两次检索） | 所有场景 |
| Rerank TopK | +10% | -20%（排序耗时） | 高准确率要求 |
| 控制上下文长度 | -5% | +30%（省token） | 简单问答 |
| 模型路由 | 不变 | +40%（简单问题用小模型） | 有明确难度分层 |
| 缓存热门query | 不变 | +80%（命中直接返回） | 高重复率场景 |
```

```java
@Component
public class ModelRouter {
    /**
     * 模型路由：简单问题用小模型，复杂问题用大模型
     */
    public String route(String query, List<Document> docs) {
        // 规则1: query长度短 + 检索结果少 → 简单问答 → 小模型
        if (query.length() < 30 && docs.size() <= 2) {
            return "qwen-turbo"; // 快速模型
        }
        // 规则2: 涉及多文档推理 → 复杂 → 大模型
        if (docs.size() > 5 || requiresReasoning(query)) {
            return "qwen-plus"; // 精确模型
        }
        // 默认：中等模型
        return "qwen-turbo";
    }
}
```

---

## 项目三：大规模系统设计（Q19）

### Q19: 做大数据量、高并发系统时，怎么做成本和效率优化？

**答题思路**：从数据规模→存储→计算→网络逐层展开。

```
成本优化三板斧：

1. 存储优化
   ├── 冷热分离：热数据Redis/ES，温数据MySQL，冷数据OSS/HDFS
   ├── 数据压缩：向量库用PQ/SQ量化（内存降8x），文本用zstd压缩
   └── 索引裁剪：低频访问的索引不常驻内存

2. 计算优化
   ├── 模型路由：简单问题用小模型（成本1/10）
   ├── 批处理：离线分析用batch API（价格-50%）
   ├── 缓存：热门query结果缓存，相似query语义缓存
   └── 异步化：非实时需求走MQ异步处理

3. 架构优化
   ├── 读写分离：写走主库，读走从库/缓存
   ├── 分库分表：按业务域拆分，避免大表join
   └── 弹性伸缩：基于QPS自动扩缩容（K8s HPA）
```

```java
// 语义缓存：相似query命中缓存
@Component
public class SemanticCache {
    private final VectorStore cacheStore; // 缓存向量库
    private final RedisTemplate<String, String> redis;

    public CacheResult lookup(String query) {
        // 1. 精确匹配（Redis）
        String exact = redis.opsForValue().get("cache:exact:" + hash(query));
        if (exact != null) return CacheResult.hit(exact);

        // 2. 语义匹配（向量相似度>0.95视为相同问题）
        List<Document> similar = cacheStore.similaritySearch(
            SearchRequest.builder().query(query).topK(1)
                .similarityThreshold(0.95).build());

        if (!similar.isEmpty()) {
            String cached = redis.opsForValue().get("cache:sem:" + similar.get(0).getId());
            if (cached != null) return CacheResult.hit(cached);
        }
        return CacheResult.miss();
    }
}
```

---

## 手撕算法（Q20）

### Q20: 两个字符串的最长公共子串

**注意**：子串(连续) ≠ 子序列(可不连续)，面试常考易混淆。

```java
/**
 * 动态规划法 O(m*n) 时间, O(min(m,n)) 空间
 * dp[i][j] = 以s1[i-1]和s2[j-1]结尾的最长公共子串长度
 */
public String longestCommonSubstring(String s1, String s2) {
    if (s1 == null || s2 == null || s1.isEmpty() || s2.isEmpty()) {
        return "";
    }

    // 空间优化：用一维数组 + 前一个值
    String shorter = s1.length() <= s2.length() ? s1 : s2;
    String longer = s1.length() > s2.length() ? s1 : s2;

    int[] dp = new int[shorter.length() + 1];
    int maxLen = 0, endIdx = 0;

    for (int i = 1; i <= longer.length(); i++) {
        int prev = 0;
        for (int j = 1; j <= shorter.length(); j++) {
            int temp = dp[j];
            if (longer.charAt(i - 1) == shorter.charAt(j - 1)) {
                dp[j] = prev + 1;
                if (dp[j] > maxLen) {
                    maxLen = dp[j];
                    endIdx = j;
                }
            } else {
                dp[j] = 0;
            }
            prev = temp;
        }
    }

    return shorter.substring(endIdx - maxLen, endIdx);
}

// 测试
// s1 = "abcdefg", s2 = "xbcdeyz" → "bcde"
```

**进阶追问**：
- 如果字符串很长（1亿字符）？→ 后缀自动机 O(n+m) 或 二分+Hash O(nlogn)
- 如果求所有公共子串？→ 记录所有maxLen的位置

---

## HR类

### Q1-Q2: 自我介绍 + 项目重点

**策略**：自我介绍2分钟版本，结构化：

```
1. 基本信息（10秒）：X年Java经验，目前在做XX方向
2. 核心项目（90秒）：重点讲1-2个项目，突出你的角色和量化成果
3. 技术标签（10秒）：Agent/RAG/分布式/高并发
4. 求职意向（10秒）：为什么来字节+想做什么方向
```

### 职级预期 / 换工作原因 / 意见不一致怎么推进

- **职级**：基于当前水平和面试表现，合理范围即可（2-2到3-1）
- **换工作原因**：不要抱怨，讲成长诉求（"当前团队业务天花板，希望到更大平台做更有挑战的Agent落地"）
- **意见不一致**：STAR法则（Situation→Task→Action→Result），强调数据驱动决策

### 反问环节

面试官提到**偏AIGC创作场景** — 可追问：
- 创作场景的Agent和工具型Agent有什么设计差异？
- 团队目前在Agent自主性和可控性之间的平衡点在哪？

---

## 高频考点总结

| 频次 | 考点 | 本场出现 |
|------|------|---------|
| ⭐⭐⭐ | Agent架构设计（编排/校验/记忆） | Q3,Q6,Q7,Q8 |
| ⭐⭐⭐ | 幻觉治理（多层防御+度量） | Q4,Q5 |
| ⭐⭐⭐ | Badcase闭环（定义→SFT回流→评测） | Q10,Q11,Q12 |
| ⭐⭐ | RAG全链路（解析/检索/多轮/效率） | Q13-Q18 |
| ⭐⭐ | 记忆设计（分层+压缩+结构化） | Q8,Q9 |
| ⭐ | 成本效率优化 | Q19 |
| ⭐ | 算法基本功 | Q20 |
