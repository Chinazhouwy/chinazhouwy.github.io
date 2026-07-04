# 喜茶AI应用开发面经（深度版）

> **来源**: 小红书 — http://xhslink.com/o/63PL1co68Lt
> **标签**: `#面经` `#ai开发` `#喜茶`
> **考点分类**: Agent观测 / Multi-Agent / 对话管理 / RAG / Prompt工程 / 工程实践
> **面试特点**: 针对自己Agent项目的深度拷打，不是背八股，而是看你有没有真正落地和迭代过。面试官会追着你的项目细节问，看你的设计有没有经过真实场景验证。
> **结果**: 二面通过，三面已凉

---

## Q1: 有没有观测这个Agent的系统？

### 答题思路

面试官想看你有没有把Agent从"demo"推向"生产"——没有观测的Agent就是黑盒，出了问题完全无法定位。要讲清楚你观测了什么、怎么观测、观测数据怎么用。

### 深度解答

Agent观测系统分为**三层**：

```
┌──────────────────────────────────────────────────┐
│              业务指标层 (Business Metrics)          │  ← 任务完成率、用户满意度、成本/请求
├──────────────────────────────────────────────────┤
│              链路追踪层 (Tracing)                   │  ← 每个节点的输入输出、耗时、token消耗
├──────────────────────────────────────────────────┤
│              基础设施层 (Infrastructure)            │  ← GPU利用率、API延迟、错误率
└──────────────────────────────────────────────────┘
```

**链路追踪**是核心——基于OpenTelemetry，给每次Agent请求生成一个traceID，每个节点（意图识别、RAG检索、LLM生成、工具调用）都是一个span，记录输入、输出、耗时、token数。

**业务指标**才是老板关心的：任务完成率（用户有没有得到满意回答）、平均对话轮次、成本（每次请求花了多少token钱）。

```java
// 基于Micrometer + OpenTelemetry的Agent观测
@Service
public class AgentObservability {
    
    private final MeterRegistry registry;
    private final Tracer tracer;
    
    // 链路追踪：记录每个Agent节点的执行
    public <T> T observeNode(String nodeName, Supplier<T> execution) {
        Span span = tracer.nextSpan().name("agent.node." + nodeName).start();
        try (Tracer.SpanInScope ws = tracer.withSpan(span)) {
            T result = execution.get();
            span.tag("node.status", "success");
            return result;
        } catch (Exception e) {
            span.tag("node.status", "error");
            span.tag("error.type", e.getClass().getSimpleName());
            throw e;
        } finally {
            span.end();
        }
    }
    
    // Token消耗监控
    public void recordTokenUsage(String model, int promptTokens, int completionTokens) {
        registry.counter("agent.token.usage", 
            "model", model, 
            "type", "prompt").increment(promptTokens);
        registry.counter("agent.token.usage", 
            "model", model, 
            "type", "completion").increment(completionTokens);
    }
    
    // 业务指标：任务完成率
    public void recordTaskCompletion(String agentType, boolean completed) {
        registry.counter("agent.task.completion",
            "agent", agentType,
            "result", completed ? "success" : "failed").increment();
    }
}
```

### 工程踩坑

- **Token计数的坑**：不同模型的tokenizer不同，OpenAI的tiktoken和本地模型的不一致。我们统一在后端用`tokenize`接口计数，而不是信任模型返回的`usage`字段（有些模型不返回）。
- **Trace数据量爆炸**：一次多步Agent请求可能产生20+个span，高峰期每秒几百请求，trace数据量巨大。我们只在采样率10%的情况下全量记录，badcase才全量采集。
- **观测和业务代码耦合**：早期把观测逻辑写在业务代码里，改观测要改业务。后来用AOP切面+自定义注解解耦。

---

## Q2: 有没有监测Agent运行中消耗的token数量，做了什么改进？

### 答题思路

这道题考的是**成本意识**和**持续优化能力**——不只看你有没有监控，更看你根据监控数据做了什么行动。

### 深度解答

**Token监测维度**：

| 维度 | 指标 | 告警阈值 |
|------|------|----------|
| 按模型 | 每次请求平均token | 单次>8K |
| 按节点 | 各节点token消耗占比 | RAG检索后prompt>4K |
| 按用户 | 单用户日消耗 | 日消耗>50K |
| 按时间 | 每小时总消耗 | 环比增长>30% |

**做的改进**：

1. **Prompt压缩**：系统prompt从1200 token压缩到600 token——删掉冗余描述、用缩写替代长变量名、把示例从5个减到2个。单次请求节省约600 token，按日均1万请求算，每天省600万token。

2. **上下文窗口管理**：多轮对话不是无脑把所有历史塞进prompt。实现滑动窗口+摘要策略——最近5轮保留原文，更早的做摘要压缩。token消耗减少约40%。

3. **小模型分流**：简单问题（意图分类、格式化输出）用7B模型，复杂推理用72B模型。70%的请求走小模型，整体token成本降60%。

4. **缓存高频结果**：对高频相似问题做语义缓存，命中直接返回，不走LLM。缓存命中率约25%。

```java
// Token消耗监控 + 自动优化
@Service
public class TokenOptimizer {
    
    private final MeterRegistry registry;
    private final Cache<String, String> semanticCache;  // Caffeine语义缓存
    
    public String chat(ChatRequest request) {
        // 1. 语义缓存检查
        String cacheKey = embeddingService.embed(request.getQuery());
        String cached = semanticCache.getIfPresent(cacheKey);
        if (cached != null && similarity(cacheKey, cached) > 0.95) {
            registry.counter("agent.cache", "type", "semantic_hit").increment();
            return cached;  // 省掉整次LLM调用
        }
        
        // 2. 意图分类决定用哪个模型
        ComplexityScore score = evaluator.evaluate(request);
        String model = score.isSimple() ? "qwen-7b" : "qwen-72b";
        
        // 3. 构建精简prompt
        String prompt = promptBuilder.build(request, 
            recentTurns(5),      // 最近5轮原文
            summaryOlder(),       // 更早的摘要
            compressedSystem()    // 压缩后的system prompt
        );
        
        String response = llmClient.chat(model, prompt);
        semanticCache.put(cacheKey, response);
        return response;
    }
}
```

### 工程踩坑

- **压缩过头反而更费token**：摘要压缩如果质量差，模型反而需要更多token去理解模糊的上下文。要A/B测试压缩前后效果，不能只看输入token减少。
- **语义缓存的误命中**：相似但不等价的问题被缓存命中，返回错误答案。加了一层规则校验——缓存结果要过关键词匹配才返回。

---

## Q3: 主要在这个项目怎么表现Multi-Agent的？

### 答题思路

面试官想看你对Multi-Agent的理解不是停留在"多个Agent协作"的概念上，而是真正设计过协作模式，理解不同模式的优劣势和适用场景。

### 深度解答

我们项目用的是**中心化编排模式**（Orchestrator-Worker），一个主Agent负责调度，多个专职Agent负责执行。

**架构**：

```
用户请求 → Orchestrator Agent（意图识别 + 任务拆解 + 结果汇总）
                ├── RAG Agent（文档检索 + 知识问答）
                ├── Tool Agent（API调用 + 数据查询）
                ├── Code Agent（代码生成 + 执行）
                └── Review Agent（结果校验 + 质量把关）
```

**为什么选中心化而不是去中心化**：
- 我们的场景是客服+知识库，任务流程相对确定，不需要Agent之间自由对话
- 中心化编排链路清晰，每个Agent的职责边界明确，出问题好定位
- 去中心化模式下Agent之间可能陷入无限对话，成本不可控

**Multi-Agent的关键设计**：

1. **Agent注册表**：每个Agent启动时注册自己的能力和接口，Orchestrator根据任务类型动态选Agent
2. **共享上下文**：所有Agent通过Blackboard模式共享对话状态，而不是Agent之间直接传消息
3. **结果聚合**：Orchestrator汇总多个Agent的结果，做冲突检测和优先级排序

```java
// Multi-Agent编排实现
@Service
public class AgentOrchestrator {
    
    private final Map<String, Agent> agentRegistry;
    private final Blackboard blackboard;  // 共享上下文
    
    public Response orchestrate(UserRequest request) {
        // 1. 意图识别 → 任务拆解
        TaskPlan plan = planner.plan(request);
        blackboard.init(request.getSessionId());
        
        // 2. 按计划调度Agent
        List<CompletableFuture<AgentResult>> futures = new ArrayList<>();
        for (Task task : plan.getTasks()) {
            Agent agent = selectAgent(task);
            futures.add(CompletableFuture.supplyAsync(
                () -> agent.execute(task, blackboard.getContext())
            ));
        }
        
        // 3. 并行执行 + 结果聚合
        List<AgentResult> results = futures.stream()
            .map(CompletableFuture::join)
            .toList();
        
        // 4. 冲突检测和汇总
        return aggregator.aggregate(results, blackboard);
    }
    
    private Agent selectAgent(Task task) {
        return agentRegistry.values().stream()
            .filter(a -> a.canHandle(task.getType()))
            .findFirst()
            .orElse(fallbackAgent);
    }
}
```

### 工程踩坑

- **Agent之间上下文传递是最大的坑**：早期用消息传递，Agent A的输出格式变了，Agent B就挂了。后来改用Blackboard+Schema约束，每个Agent读写Blackboard时都要通过Schema校验。
- **并行执行的依赖问题**：有些任务有先后依赖（先检索再生成），不能无脑并行。TaskPlan里要声明依赖关系，用DAG调度。
- **超时和降级**：某个Agent超时不能阻塞整条链路。每个Agent设超时时间，超时返回兜底结果。

---

## Q4: 数据库量级上云了吗？

### 答题思路

面试官想看你的项目有没有真正处理过**数据规模问题**，以及你对云原生架构的理解。不是简单的"上了没有"，而是数据量多大、选的什么方案、为什么这么选。

### 深度解答

**数据量级**：
- 向量数据库：约50万条文档chunk，维度1536，存储约12GB
- 关系数据库：对话记录约200万条，用户画像约5万条
- 对象存储：原始文档约10万份，2TB+

**上云方案**：

| 数据类型 | 本地方案 | 云方案 | 迁移原因 |
|----------|----------|--------|----------|
| 向量库 | 本地Milvus | 阿里云Hologres | 弹性扩缩容、免运维 |
| 关系库 | 本地MySQL | RDS PostgreSQL | 高可用、自动备份 |
| 对象存储 | 本地MinIO | OSS | 无限容量、CDN加速 |

**上云踩坑**：
- 向量库迁移最复杂——Milvus和Hologres的索引类型不同，同样的IVF_FLAT参数在Hologres上效果不一样，需要重新调参
- 网络延迟增加——本地调用Milvus是<1ms，上云后变成5-10ms。通过连接池+区域部署缓解
- 成本——本地Milvus只要服务器钱，Hologres按存储+查询计费，月成本增加约2K

```java
// 数据源抽象层，支持本地/云切换
@Configuration
public class DataSourceConfig {
    
    @Bean
    @ConditionalOnProperty(name = "datasource.mode", havingValue = "cloud")
    public VectorStore cloudVectorStore() {
        return HologresVectorStore.builder()
            .endpoint(env.getProperty("hologres.endpoint"))
            .instance(env.getProperty("hologres.instance"))
            .dimension(1536)
            .indexType(IndexType.IVF_PQ)  // 云端用IVF_PQ更省内存
            .build();
    }
    
    @Bean
    @ConditionalOnProperty(name = "datasource.mode", havingValue = "local", matchIfMissing = true)
    public VectorStore localVectorStore() {
        return MilvusVectorStore.builder()
            .host("localhost")
            .port(19530)
            .indexType(IndexType.IVF_FLAT)  // 本地用IVF_FLAT精度更高
            .build();
    }
}
```

---

## Q5: 多轮对话，怎么保证之前的历史对齐？

### 答题思路

"历史对齐"不是简单的"记住之前的对话"，而是确保Agent在多轮对话中**语义一致、不遗忘、不矛盾**。

### 深度解答

历史对齐的三个层次：

**1. 结构对齐**：确保对话历史格式统一
- 每条消息有明确的role（system/user/assistant/tool）
- 工具调用的请求和结果成对出现，不能只留请求不留结果
- 系统prompt始终在最前面

**2. 语义对齐**：确保Agent理解前文语境
- 指代消解：将"它"、"那个"替换为具体实体
- 话题追踪：维护当前话题栈，防止Agent跑偏
- 一致性检查：生成前检查是否和前文矛盾

**3. 状态对齐**：确保业务状态和对话状态同步
- 如果用户中途修改了条件（"换一个更便宜的"），后续回答要基于新条件
- 如果工具调用失败了，Agent知道之前的结果无效

```java
// 多轮对话历史管理
@Service
public class ConversationAligner {
    
    private final ChatClient chatClient;
    private final SessionStore sessionStore;
    
    public AlignedContext align(String sessionId, String newQuery) {
        ConversationSession session = sessionStore.get(sessionId);
        
        // 1. 结构对齐：补全缺失的tool response
        List<Message> alignedHistory = alignToolResponses(session.getHistory());
        
        // 2. 语义对齐：指代消解
        String resolvedQuery = resolveReferences(newQuery, alignedHistory);
        
        // 3. 状态对齐：检测条件变更
        List<ConditionChange> changes = detectConditionChanges(newQuery, alignedHistory);
        if (!changes.isEmpty()) {
            // 追加系统消息，提醒Agent条件已变更
            alignedHistory.add(SystemMessage.of(
                "注意：用户修改了条件：" + changes
            ));
        }
        
        return new AlignedContext(alignedHistory, resolvedQuery);
    }
    
    private List<Message> alignToolResponses(List<Message> history) {
        // 确保每个tool_call后面都有对应的tool_result
        List<Message> aligned = new ArrayList<>();
        for (int i = 0; i < history.size(); i++) {
            Message msg = history.get(i);
            aligned.add(msg);
            if (msg instanceof ToolCallMessage tc && 
                (i + 1 >= history.size() || !(history.get(i+1) instanceof ToolResultMessage))) {
                // 补一个空的tool_result，防止模型报错
                aligned.add(ToolResultMessage.of(tc.getId(), "工具调用超时，无结果"));
            }
        }
        return aligned;
    }
}
```

### 工程踩坑

- **历史太长导致模型"遗忘"**：对话超过20轮后，模型开始忽略前面的关键信息。解决方案：在每次生成前，从历史中提取关键实体和约束条件，注入到system prompt里做强调。
- **Tool结果太长**：一次API返回了几千字，塞进历史后token暴涨。对tool结果做摘要或截断，只保留关键字段。

---

## Q6: 了不了解ReAct还有其他范式，他们的区别是什么，适用于什么样的不同工程场景？

### 答题思路

这道题考的是你对Agent范式的**体系化理解**——不是只听过ReAct，而是知道有哪些范式、各自优劣、什么场景该用哪个。

### 深度解答

**主流Agent范式对比**：

| 范式 | 核心思想 | 优势 | 劣势 | 适用场景 |
|------|----------|------|------|----------|
| **ReAct** | 推理(Reason)+行动(Act)交替 | 灵活、可解释 | 慢、token消耗大 | 需要多步推理的复杂任务 |
| **Plan-then-Execute** | 先规划全量步骤，再逐步执行 | 全局视角、效率高 | 规划可能不准、不灵活 | 步骤确定的任务（数据分析、报告生成） |
| **Reflexion** | 执行→反思→重试 | 自我纠错能力强 | 循环成本高 | 创作类任务（代码、文案） |
| **Function Calling** | 模型直接输出工具调用 | 简单高效、延迟低 | 只能调工具、不推理 | API聚合、简单查询 |
| **Workflow/DAG** | 预定义流程图 | 确定性、可控 | 不灵活 | 流程固定的业务场景 |

**工程场景选择**：

1. **客服问答**：Function Calling为主——意图识别后直接调知识库API，不需要多步推理
2. **数据分析**：Plan-then-Execute——先规划"取数据→清洗→分析→可视化"，再逐步执行
3. **代码生成**：Reflexion——生成后自测，不通过就反思修改
4. **复杂调研**：ReAct——需要边检索边推理边决策

**实际项目中**：我们用**混合模式**——Workflow做主干，关键节点嵌入ReAct。不是说某个范式更好，而是不同节点需要不同的决策模式。

```java
// 根据任务特征选择Agent范式
public class AgentParadigmSelector {
    
    public Agent selectParadigm(TaskCharacteristics chars) {
        if (chars.isSimpleToolCall()) {
            // 简单工具调用 → Function Calling
            return FunctionCallAgent.builder()
                .tools(chars.getRequiredTools())
                .build();
        }
        
        if (chars.isStepsDeterministic()) {
            // 步骤确定 → Plan-then-Execute
            return PlanExecuteAgent.builder()
                .planner(chatClient)
                .executor(chatClient)
                .steps(chars.getPlannedSteps())
                .build();
        }
        
        if (chars.needsSelfCorrection()) {
            // 需要自纠错 → Reflexion
            return ReflexionAgent.builder()
                .chatClient(chatClient)
                .maxRetries(3)
                .evaluator(chatClient)  // 用LLM评估结果质量
                .build();
        }
        
        // 默认 → ReAct
        return ReActAgent.builder()
            .chatClient(chatClient)
            .tools(chars.getAvailableTools())
            .maxIterations(5)
            .build();
    }
}
```

---

## Q7: 你是怎么设计一个Prompt的，在项目中Prompt只能在工程里修改吗？还是说是可以定制化的？

### 答题思路

这道题分两部分：**Prompt设计方法论** + **Prompt运维方式**。面试官想看你不只会写prompt，还知道怎么管理prompt的生命周期。

### 深度解答

**Prompt设计方法论**（我从实践中总结的四步法）：

1. **定义边界**：先明确这个prompt要解决什么问题、输入是什么、输出格式是什么。不要一上来就写prompt，先写spec。
2. **骨架搭建**：用CRISPE框架——Capacity（角色）、Input（输入）、Steps（步骤）、Purpose（目的）、Expectation（期望输出）。
3. **注入示例**：Few-shot示例比长描述有效得多。3个精心设计的示例 > 300字的规则描述。
4. **迭代优化**：用badcase驱动迭代——每次badcase加一个约束或示例，prompt逐渐收敛。

**Prompt定制化**：绝对不能写死在代码里！我们的方案：

- **开发阶段**：Prompt存放在YAML配置文件中，和代码解耦
- **运营阶段**：Prompt存入数据库，支持后台管理界面修改，热更新无需重启
- **高级阶段**：不同业务线/不同客户可以有不同的prompt版本，A/B测试不同prompt的效果

```java
// Prompt管理：支持配置文件 + 数据库 + 热更新
@Configuration
public class PromptManagerConfig {
    
    @Bean
    public PromptManager promptManager(DataSource dataSource) {
        return PromptManager.builder()
            // 优先从数据库读（支持运营修改）
            .primaryStore(new DatabasePromptStore(dataSource))
            // 数据库没有则从配置文件读（开发兜底）
            .fallbackStore(new YamlPromptStore("prompts/"))
            .cache(new CaffeinePromptCache())  // 缓存，避免每次查库
            .enableHotReload(true)  // 热更新，监听数据库变更
            .build();
    }
}

// 使用示例
@Service
public class AgentService {
    
    private final PromptManager promptManager;
    
    public Response chat(UserRequest request) {
        // 按业务线+场景获取prompt，支持A/B测试
        PromptTemplate template = promptManager.getPrompt(
            "customer_service",     // 业务线
            "rag_answer",          // 场景
            request.getAbGroup()   // A/B分组
        );
        
        String systemPrompt = template.render(Map.of(
            "business_context", request.getBusinessContext(),
            "output_format", "json"
        ));
        // ...
    }
}
```

### 工程踩坑

- **Prompt版本管理**：修改prompt后效果变差无法回滚。必须做版本管理，每次修改存新版本，支持回滚到任意版本。
- **Prompt注入攻击**：用户输入里混入恶意指令，覆盖system prompt。对所有用户输入做转义，并用分隔符把system prompt和用户输入隔开。

---

## Q8: 长短期记忆怎么在你这个项目里表现？

### 答题思路

面试官想看你不是背概念，而是真正在自己的项目里**落地过**Memory方案，有具体的技术选型和数据支撑。

### 深度解答

**短期记忆**：
- 实现：直接存在对话上下文（ConversationBufferWindow），保留最近10轮
- 存储：Redis，key为sessionId，TTL 30分钟
- 何时写入：每轮对话结束自动追加
- 何时读取：每次新请求自动加载

**长期记忆**：
- 实现：把用户关键信息（偏好、历史决策、项目背景）存入向量数据库
- 存储：Milvus，embedding后存储，带metadata（用户ID、时间戳、类型标签）
- 何时写入：对话结束时，用LLM提取关键实体和偏好，写入向量库
- 何时读取：新会话开始时，用当前query做语义检索，取top3相关记忆注入prompt

**摘要记忆**：
- 实现：对话超过10轮时，对前8轮做摘要压缩
- 存储：Redis，key为sessionId_summary
- 效果：10轮对话原文约2000 token，摘要后约200 token，压缩率90%

```java
// 项目中实际使用的Memory架构
@Service
public class ProjectMemory {
    
    private final StringRedisTemplate redis;      // 短期+摘要
    private final VectorStore vectorStore;         // 长期
    private final ChatClient chatClient;
    
    // 读取：组合三层记忆
    public MemoryContext loadContext(String userId, String sessionId, String query) {
        // 1. 短期记忆：最近10轮
        List<Message> recent = redis.opsForList().range("chat:" + sessionId, -10, -1)
            .stream().map(this::deserialize).toList();
        
        // 2. 摘要记忆：更早的对话摘要
        String summary = redis.opsForValue().get("chat:summary:" + sessionId);
        
        // 3. 长期记忆：语义检索用户相关记忆
        List<Document> longTerm = vectorStore.similaritySearch(
            SearchRequest.query(query)
                .withTopK(3)
                .withFilterExpression("userId == '" + userId + "'")
        );
        
        return new MemoryContext(recent, summary, longTerm);
    }
    
    // 写入：对话结束时更新各层
    @Async
    public void persist(String userId, String sessionId, List<Message> history) {
        // 1. 更新短期记忆
        redis.opsForList().rightPush("chat:" + sessionId, 
            serialize(history.get(history.size() - 1)));
        redis.expire("chat:" + sessionId, 30, TimeUnit.MINUTES);
        
        // 2. 超过10轮则压缩摘要
        if (redis.opsForList().size("chat:" + sessionId) > 10) {
            String newSummary = chatClient.prompt()
                .user("请摘要以下对话的关键信息：\n" + recentHistory)
                .call().content();
            redis.opsForValue().set("chat:summary:" + sessionId, newSummary);
        }
        
        // 3. 提取关键实体写入长期记忆
        String entities = chatClient.prompt()
            .user("从以下对话中提取用户的关键偏好、实体、决策：\n" + fullHistory)
            .call().content();
        vectorStore.add(List.of(new Document(entities, 
            Map.of("userId", userId, "timestamp", Instant.now()))));
    }
}
```

### 工程踩坑

- **Redis短期记忆的TTL问题**：30分钟TTL意味着用户离开30分钟后回来，短期记忆全丢了。对重要会话延长TTL到24小时，或者会话恢复时从摘要+长期记忆重建。
- **长期记忆的噪音**：早期什么都往长期记忆里存，导致检索噪音很大。后来加了过滤——只有"用户偏好"和"关键实体"才存，闲聊内容不存。

---

## Q9: RAG是怎么设计的？只是用了简单的文档吗？量级是多少？

### 答题思路

面试官想看你的RAG不是"加个向量库就完了"的玩具方案，而是真正处理过**多种数据源、多种格式、不同量级**的生产级RAG。

### 深度解答

**不只是简单文档**！我们的RAG数据源包括：

| 数据源 | 格式 | 量级 | 更新频率 | 检索方式 |
|--------|------|------|----------|----------|
| 产品文档 | PDF/Word/Markdown | ~5000篇 | 日更 | 向量+关键词混合 |
| FAQ知识库 | 结构化Q&A | ~2000条 | 周更 | 关键词优先 |
| 内部API文档 | OpenAPI/Swagger | ~300个接口 | 随版本更新 | 结构化查询 |
| 历史工单 | 文本+标签 | ~10万条 | 实时 | 向量检索 |

**完整RAG链路**：

```
文档入库：原始文档 → 解析(PDF/Word) → Chunk切分 → Embedding → 向量库+倒排索引
线上检索：用户Query → Query改写 → 混合检索(向量+BM25) → Rerank → 拼接上下文
```

**关键设计**：

1. **Chunk切分不是固定长度**：按语义边界切分（段落、章节），而不是每512字切一刀。用LLM判断切分点，保证chunk内语义完整。

2. **混合检索**：向量检索捕捉语义相似性，BM25关键词检索捕捉精确匹配。两者按6:4加权融合，比单一检索准确率提升15%。

3. **Rerank**：检索回来20条，用Cross-Encoder做精排，取top5注入prompt。Rerank虽然慢（+200ms），但准确率提升显著。

4. **Metadata过滤**：每个chunk带metadata（文档版本、部门、更新时间），检索时可以用metadata做预过滤，缩小检索范围。

```java
// 生产级RAG实现
@Service
public class ProductionRAG {
    
    private final VectorStore vectorStore;       // 向量检索
    private final BM25Searcher bm25Searcher;     // 关键词检索
    private final CrossEncoderReranker reranker; // 精排
    
    public List<RetrievedDoc> search(String query, SearchContext ctx) {
        // 1. Query改写（消除指代）
        String rewrittenQuery = queryRewriter.rewrite(query, ctx.getHistory());
        
        // 2. 并行混合检索
        CompletableFuture<List<RetrievedDoc>> vectorFuture = 
            CompletableFuture.supplyAsync(() -> 
                vectorStore.similaritySearch(query, 20));
        CompletableFuture<List<RetrievedDoc>> bm25Future = 
            CompletableFuture.supplyAsync(() -> 
                bm25Searcher.search(query, 20));
        
        List<RetrievedDoc> vectorResults = vectorFuture.join();
        List<RetrievedDoc> bm25Results = bm25Future.join();
        
        // 3. 融合（RRF算法）
        List<RetrievedDoc> merged = reciprocalRankFusion(
            vectorResults, bm25Results, 0.6, 0.4);
        
        // 4. Rerank精排
        List<RetrievedDoc> reranked = reranker.rerank(rewrittenQuery, merged, 5);
        
        return reranked;
    }
}
```

### 工程踩坑

- **PDF解析是最深的坑**：表格、公式、多栏排版、扫描件，每个都是噩梦。我们最终用了3种解析器组合——PyPDF4处理简单PDF、Unstructured处理复杂排版、PaddleOCR处理扫描件。
- **Chunk切分粒度的trade-off**：太短丢失上下文，太长检索噪音大。我们的经验：**500-800字为一个chunk，chunk之间重叠100字**，效果最好。

---

## Q10: 了不了解Redis，项目里有没有用？

### 深度解答

**项目中Redis的使用场景**：

1. **对话短期记忆**：存储最近10轮对话，key=`chat:{sessionId}`，TTL 30min
2. **Prompt缓存**：热门prompt模板缓存，减少数据库查询
3. **限流**：每用户每分钟最多20次请求，滑动窗口限流
4. **分布式锁**：文档入库时防止重复处理，`SET NX EX`
5. **语义缓存**：高频query的LLM响应缓存，key为query的embedding hash

```java
// Redis在Agent项目中的典型用法
@Service
public class RedisUsage {
    
    private final StringRedisTemplate redis;
    
    // 1. 滑动窗口限流
    public boolean allowRequest(String userId) {
        String key = "rate_limit:" + userId;
        Long count = redis.opsForValue().increment(key);
        if (count == 1) redis.expire(key, 1, TimeUnit.MINUTES);
        return count <= 20;
    }
    
    // 2. 分布式锁（防文档重复入库）
    public boolean tryLock(String docId) {
        return Boolean.TRUE.equals(
            redis.opsForValue().setIfAbsent(
                "lock:doc:" + docId, "processing", 5, TimeUnit.MINUTES));
    }
    
    // 3. 语义缓存（简化版）
    public String getCachedResponse(String query) {
        String hash = DigestUtils.md5Hex(query);
        return redis.opsForValue().get("cache:llm:" + hash);
    }
}
```

---

## Q11: 怎么确保数据存储不会用于冗余？

### 答题思路

这道题考的是**数据治理能力**——不只是存数据，还要保证数据不重复、不过期、不浪费存储。

### 深度解答

**冗余的三个维度**：

1. **数据重复**：同一份文档被多次入库，同一用户的多条记忆内容重复
2. **数据过期**：旧版本文档和新版本同时存在，检索出过时信息
3. **数据膨胀**：chunk数无限增长，向量库越来越大、检索越来越慢

**解决方案**：

1. **去重**：文档入库前计算内容hash，已存在则跳过或更新（而非新增）
2. **版本管理**：每个文档有version字段，新版本入库时标记旧版本为deprecated，检索时过滤
3. **定期清理**：每天跑一次清理任务，删除deprecated文档和过期记忆

```java
// 数据去重 + 版本管理
@Service
public class DataDeduplication {
    
    private final VectorStore vectorStore;
    private final DocumentRepository docRepo;
    
    public void ingestDocument(Document doc) {
        String contentHash = DigestUtils.md5Hex(doc.getContent());
        
        // 1. 查重：同hash的已存在？
        Optional<Document> existing = docRepo.findByContentHash(contentHash);
        if (existing.isPresent()) {
            // 同内容不同版本 → 更新metadata，不新增chunk
            if (!existing.get().getVersion().equals(doc.getVersion())) {
                existing.get().setDeprecated(true);
                docRepo.save(existing.get());
                docRepo.save(doc.withContentHash(contentHash));
            }
            return;  // 完全相同则跳过
        }
        
        // 2. 新文档入库
        docRepo.save(doc.withContentHash(contentHash));
        List<Chunk> chunks = chunker.split(doc);
        vectorStore.add(chunks);
    }
    
    // 定期清理过期数据
    @Scheduled(cron = "0 0 3 * * ?")  // 每天凌晨3点
    public void cleanup() {
        // 删除标记deprecated的文档和chunk
        List<Document> deprecated = docRepo.findAllByDeprecatedTrue();
        deprecated.forEach(doc -> {
            vectorStore.delete(doc.getChunkIds());
            docRepo.delete(doc);
        });
        
        // 清理长期记忆中超过6个月且从未被检索的条目
        vectorStore.deleteOldAndUnused(6, ChronoUnit.MONTHS);
    }
}
```

---

## Q12: 了不了解最近阿里写的那个最新的开发框架？

### 深度解答

面试官大概率指的是**阿里最近开源的Agent框架**，需要关注的几个：

1. **Spring AI Alibaba**：阿里基于Spring AI的扩展，集成了通义千问、DashScope API，提供了中国开发者友好的Agent开发体验。核心优势：和Spring生态无缝集成、支持国产模型、内置RAG和Tool调用。

2. **AgentScope**：阿里达摩院出的Multi-Agent框架，支持分布式Agent编排，内置Pipeline和MsgCenter模式。特点：轻量、Python-first、适合研究但也支持生产部署。

3. **ModelScope Agent**：基于ModelScope生态的Agent框架，集成了大量开源模型和工具。

**如果面试官问的是Spring AI Alibaba**（最可能，因为你是Java开发者）：

```java
// Spring AI Alibaba 使用示例
@SpringBootApplication
public class CtripAgentApp {
    
    public static void main(String[] args) {
        SpringApplication.run(CtripAgentApp.class, args);
    }
    
    @Bean
    public ChatClient chatClient(ChatClient.Builder builder) {
        // 默认使用通义千问
        return builder
            .defaultSystem("你是携程智能客服...")
            .defaultAdvisors(
                MessageChatMemoryAdvisor.chatMemory(memory),
                QuestionAnswerAdvisor.vectorStore(vectorStore)  // RAG
            )
            .build();
    }
    
    @Bean
    public ToolCallbackProvider tools() {
        // 注册工具
        return MethodToolCallbackProvider.builder()
            .toolObjects(new OrderTool(), new FlightTool())
            .build();
    }
}
```

---

## Q13: 除了LangChain还知道什么框架？

### 深度解答

| 框架 | 语言 | 特点 | 适用场景 |
|------|------|------|----------|
| **LangChain** | Python/JS | 生态最全、组件最多 | 通用Agent开发 |
| **LangChain4j** | Java | LangChain的Java移植 | Java生态Agent |
| **Spring AI** | Java | Spring官方、轻量 | Spring项目集成 |
| **Spring AI Alibaba** | Java | 国产模型集成 | 国内企业应用 |
| **LlamaIndex** | Python | RAG最强 | 知识库应用 |
| **CrewAI** | Python | 多Agent角色协作 | 团队模拟场景 |
| **AutoGen** | Python | 微软出品、多Agent对话 | 研究/复杂协作 |
| **Semantic Kernel** | C#/Python/Java | 微软出品、企业级 | .NET/企业集成 |
| **Dify** | 全栈 | 可视化编排、低代码 | 快速搭建、运营友好 |
| **Coze** | 全栈 | 字节出品、低代码 | 快速搭建、工具生态丰富 |

**我的选择思路**：
- Java项目 → Spring AI + LangChain4j（主用Spring AI，LangChain4j补充缺失能力）
- 需要可视化/运营介入 → Dify
- RAG重度场景 → LlamaIndex做检索层，Spring AI做应用层

---

## Q14: 写Prompt的时候有没有利用其他的工程方法辅助？

### 深度解答

写Prompt不只是"手写然后试"，我们有**工程化的Prompt开发流程**：

1. **Prompt版本管理**：每个prompt有版本号，修改后自动保存新版本，支持回滚和A/B测试

2. **自动评估**：写完prompt后，用评估集自动跑分，量化效果而不是凭感觉
   - 准确率：回答是否正确
   - 完整性：是否覆盖了所有要点
   - 格式合规：是否按照要求的格式输出

3. **DSPy式的Prompt优化**：不是手写prompt，而是定义输入输出示例，让框架自动优化prompt
   - 类似DSPy的理念，但在Java生态下用Spring AI实现

4. **Prompt注入检测**：上线前用红队测试检测prompt是否容易被注入攻击

```java
// Prompt评估流水线
@Service
public class PromptEvaluation {
    
    private final ChatClient chatClient;
    private final List<EvalCase> evalSet;  // 评估集
    
    public EvalReport evaluate(PromptTemplate template) {
        List<EvalResult> results = new ArrayList<>();
        
        for (EvalCase testCase : evalSet) {
            String output = chatClient.prompt()
                .system(template.render(testCase.getVariables()))
                .user(testCase.getInput())
                .call().content();
            
            // 自动评分
            double accuracy = scoreAccuracy(output, testCase.getExpectedAnswer());
            double completeness = scoreCompleteness(output, testCase.getKeyPoints());
            boolean formatOk = validateFormat(output, template.getOutputFormat());
            
            results.add(new EvalResult(testCase, output, accuracy, completeness, formatOk));
        }
        
        return new EvalReport(template.getVersion(), results);
    }
}
```

---

## Q15: 熟不熟悉Java？大模型帮你写Java，怎么确定他写的是对的？

### 深度解答

**大模型写Java的验证方式**（从轻到重）：

1. **编译检查**：最基本的——代码能不能编译通过。大模型偶尔会虚构不存在的API或用错方法签名。

2. **静态分析**：用SpotBugs/Checkstyle扫描，检测空指针、资源泄漏、线程安全等问题。

3. **单元测试**：让大模型同时生成测试代码，跑测试验证功能正确性。测试覆盖率>80%才算通过。

4. **代码Review**：人工review大模型生成的代码，重点关注：异常处理、边界条件、资源释放、线程安全。

5. **集成测试**：在测试环境跑端到端测试，确保和上下游集成没问题。

**实际经验中的大模型写Java的常见问题**：
- 虚构Spring API（用了不存在的方法）
- 异常处理粗糙（catch Exception然后啥也不做）
- 忽略线程安全（Controller里用实例变量）
- 资源不释放（InputStream没close）
- 配置硬编码（数据库地址写死在代码里）

```java
// 自动验证大模型生成的Java代码
@Service
public class CodeVerification {
    
    public VerificationResult verify(String generatedCode) {
        List<String> issues = new ArrayList<>();
        
        // 1. 编译检查
        CompileResult compile = javaCompiler.compile(generatedCode);
        if (!compile.isSuccess()) {
            issues.add("编译失败: " + compile.getErrors());
            return VerificationResult.fail(issues);
        }
        
        // 2. 静态分析
        AnalysisResult analysis = spotBugs.analyze(compile.getClassFile());
        issues.addAll(analysis.getBugDescriptions());
        
        // 3. 代码规范检查
        CheckstyleResult style = checkstyle.check(generatedCode);
        issues.addAll(style.getViolations());
        
        // 4. 单元测试（让模型也生成测试）
        String testCode = chatClient.prompt()
            .user("为以下Java代码生成单元测试：\n" + generatedCode)
            .call().content();
        TestResult testResult = testRunner.run(testCode);
        if (testResult.getFailCount() > 0) {
            issues.add("测试失败: " + testResult.getFailures());
        }
        
        return issues.isEmpty() ? 
            VerificationResult.pass() : VerificationResult.fail(issues);
    }
}
```

---

## Q16: 讲一下你平常Vibe Coding的过程

### 深度解答

Vibe Coding（氛围编程）= 用自然语言描述需求，让AI帮你写代码。我的流程：

1. **明确需求**：先写清楚要做什么——输入、输出、边界条件、技术约束。需求越清晰，AI生成的代码质量越高。

2. **选择工具**：
   - 简单脚本/工具函数 → 直接和ChatGPT/Claude对话生成
   - 项目级代码 → 用Cursor/Copilot在IDE里生成，上下文更准
   - 复杂架构 → 先让AI出设计方案，review后再让它写代码

3. **迭代验证**：AI生成代码后，不直接用——先读懂、再验证、后修改。验证方式同Q15（编译→静态分析→测试）。

4. **积累模板**：好的AI生成代码沉淀为模板，下次相似需求直接复用+微调。

**踩坑经验**：
- AI生成的代码"看起来对"但隐含bug——尤其是并发、异常处理、资源管理。必须测试。
- 不要让AI一次性写太长的代码，分段生成+逐段验证更可靠。
- AI对项目上下文理解有限，生成的代码可能和现有架构风格不一致。需要人工调整。

---

## 反问环节 / 面试官介绍

喜茶AI方向：智能客服、饮品推荐Agent、门店运营辅助、内部知识库

## 整体感受

喜茶这轮面试偏**项目实战拷打**，不像携程那样挖架构设计，更像在看你：
- 有没有真正上线过Agent（观测、token监控、上云）
- 有没有遇到并解决过真实问题（历史对齐、数据冗余、prompt管理）
- 有没有工程思维（不是堆技术名词，而是有取舍、有优化、有验证）

**三面凉的原因推测**：可能终面偏综合评估——业务理解、文化匹配、成长潜力。一面二面技术过关不代表终面能过，建议后续面经准备加入业务深度思考。
