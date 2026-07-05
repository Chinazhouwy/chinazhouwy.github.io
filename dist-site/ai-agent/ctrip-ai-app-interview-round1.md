# 携程AI应用开发一面面经（深度版）

> **来源**: 小红书 — http://xhslink.com/o/7feIp4OkyuN
> **标签**: `#agent` `#人工智能` `#大模型` `#大模型应用` `#面经` `#校招` `#后端开发` `#AI应用开发`
> **考点分类**: Agent架构设计 / RAG / Memory / 评测体系 / 工程取舍
> **面试特点**: 不是纯背八股，更看重"设计合理性"，面试官会顺着项目细节往下挖，看你能不能复用到他们自己的业务

---

## Q1: 介绍一下你的Agent项目，整体架构怎么分层？

### 答题思路

面试官想看你是否真正做过架构设计，而不是只会用框架拼装。回答要从**职责划分**出发，讲清楚每一层"做什么"和"为什么这样分"。

### 深度解答

一个生产级Agent项目，典型分为**四层**：

```
┌─────────────────────────────────────────┐
│           接入层 (Gateway)               │  ← 对话管理、鉴权、限流
├─────────────────────────────────────────┤
│           编排层 (Orchestrator)          │  ← Workflow引擎、Agent调度
├─────────────────────────────────────────┤
│           能力层 (Capability)            │  ← RAG、Tool、Memory、LLM
├─────────────────────────────────────────┤
│           基础设施层 (Infrastructure)     │  ← 向量库、数据库、消息队列
└─────────────────────────────────────────┘
```

**接入层**：负责用户会话管理（Session）、意图路由（走哪个Workflow）、鉴权限流。这一层的核心价值是**屏蔽上游差异**——不管是小程序、APP还是API调用，到编排层都是统一的请求格式。

**编排层**：这是整个系统的**大脑**。我们用Workflow引擎（如LangGraph、自研状态机）来编排多个Agent的执行顺序。Workflow定义了"先做检索、再做推理、最后做校验"这种确定性流程，但每个节点内部可以嵌入ReAct循环让Agent自主决策。

**能力层**：每个能力模块是独立的服务——RAG Service负责检索增强、Memory Service负责记忆读写、Tool Service负责工具调用。这一层的关键设计原则是**无状态**——能力层不持有对话上下文，由编排层在调用时注入。

**基础设施层**：向量数据库（Milvus/Qdrant）、关系数据库（PostgreSQL）、消息队列（Kafka，用于异步工具执行）、对象存储（MinIO，存文档和chunk）。

### 工程踩坑

- **编排层和能力的边界容易模糊**：早期把Memory读写逻辑写在Workflow节点里，导致编排层越来越臃肿。后来把Memory抽成独立Service，编排层只做调度，代码量降了40%。
- **不要一开始就微服务**：先用单体模块化开发，等调用量和团队规模上来后再拆。过早拆微服务只会增加调试成本。

---

## Q2: 为什么选workflow模式，而不是让Agent完全自主决策？

### 答题思路

这道题考的是**工程务实能力**——不是workflow更好或Agent更好，而是你能不能说清楚在什么场景下该用哪个，以及为什么。

### 深度解答

选workflow的核心原因有**三个**：

**1. 确定性保障**：生产环境的Agent处理的是用户真实请求，不能接受"10次里有2次跑偏"。Workflow把主干流程写死，每一步的输入输出是可预期的。完全自主的Agent在复杂任务中容易出现**目标漂移**——第3步开始就忘了原始目标。

**2. 可观测性和可调试性**：Workflow的每个节点有明确的输入输出，日志和trace天然结构化。Agent自主决策的链路是动态的，一次请求走5步、下次可能走8步，出了badcase很难复现和定位。

**3. 成本控制**：Workflow的节点数量是固定的，LLM调用次数可控。完全自主的Agent可能陷入循环，一次请求调20次LLM才终止，token成本直接翻几倍。

**但workflow不是银弹**，它的局限是**不灵活**——如果用户问了一个没在workflow里预定义的问题，系统就无法处理。所以我们采用**混合模式**：主干用workflow保证稳定性，关键节点（比如意图识别不确定时、工具选择时）嵌入ReAct让Agent自主决策。

```java
// Spring AI + LangChain4j 的混合编排示例
public class HybridWorkflow {
    
    private final ChatClient chatClient;
    private final WorkflowEngine engine;
    
    public Response execute(UserRequest request) {
        // Step 1: 意图识别 — workflow固定节点
        Intent intent = intentClassifier.classify(request.getMessage());
        
        // Step 2: 检索 — workflow固定节点
        List<Document> docs = ragService.search(request.getMessage());
        
        // Step 3: 生成 — 这里用ReAct，让Agent自主决定是否需要调工具
        // 如果文档足够回答就直接生成，不够则Agent自主选择调搜索工具
        ReActAgent agent = ReActAgent.builder()
            .chatClient(chatClient)
            .tools(List.of(searchTool, codeTool))
            .maxIterations(5)  // 防止死循环
            .context(docs)
            .build();
        
        String answer = agent.run(request.getMessage());
        
        // Step 4: 校验 — workflow固定节点
        return validationService.validate(answer);
    }
}
```

### 工程踩坑

- **Workflow节点粒度**：太细（每个API调用一个节点）维护成本高，太粗（整个生成逻辑一个节点）又失去了workflow的优势。经验法则是：**一个节点对应一个"能力决策点"**——如果这个步骤可能走不同的分支，就拆成独立节点。
- **混合模式的切换时机**：让Agent自主决策的触发条件要写清楚，比如"置信度<0.7时切换到ReAct模式"，否则又变成隐式逻辑了。

---

## Q3: workflow里哪些节点必须塞ReAct能力？

### 答题思路

面试官想看你有没有真正做过workflow设计，理解哪些环节需要灵活决策、哪些环节必须确定。

### 深度解答

**必须塞ReAct的节点**有三个特征：**输入不确定、路径不确定、工具不确定**。

**1. 意图模糊时的澄清节点**：用户说"帮我处理一下那个问题"，Agent需要自主判断是先问清楚还是直接去查，这种场景写死if-else根本覆盖不完。

**2. 信息检索不足时的补搜节点**：RAG检索回来的文档不够回答问题时，Agent需要自主决定是再搜一次、换个query、还是调外部搜索工具——这些决策依赖当前上下文，不可能提前写死。

**3. 工具选择和组合节点**：当有多个工具可用时（搜索、计算、代码执行），Agent需要根据问题动态选择用哪个工具、用什么参数、甚至组合多个工具。

**不需要塞ReAct的节点**：
- 纯检索节点（query → 向量检索 → 返回docs，路径确定）
- 格式校验节点（输出 → 正则/规则校验 → 通过/拒绝）
- 日志和监控节点（纯IO操作，无决策）

```java
// 判断节点是否需要ReAct的决策框架
public class NodeDesign {
    
    public boolean needsReAct(WorkflowNode node) {
        // 输入是否不确定？— 用户意图可能有多种解读
        boolean inputUncertain = node.getInputSchema().hasOptionalFields();
        
        // 路径是否不确定？— 需要根据运行时状态选择不同分支
        boolean pathUncertain = node.getBranches().size() > 1 
            && !node.hasDeterministicRouting();
        
        // 工具是否不确定？— 需要动态选择用哪个工具
        boolean toolUncertain = node.getAvailableTools().size() > 1;
        
        return inputUncertain || pathUncertain || toolUncertain;
    }
}
```

---

## Q4: 长链路Agent为什么可以容忍十几分钟的响应时间？

### 答题思路

这道题考的是**业务场景理解**——不是所有Agent都需要秒级响应，关键看用户预期和业务属性。

### 深度解答

长链路Agent能容忍长时间响应，前提是**三个条件同时满足**：

**1. 任务性质是"异步可等待"的**：比如生成一份深度研报、做完整的代码审查、执行一个多步骤的数据分析——用户知道这是复杂任务，预期就是"等一会儿给结果"。对比客服问答场景，用户期望秒级回复，就不能做长链路。

**2. 过程可感知**：用户不是干等，而是能看到进度——"正在检索相关文档...已找到23篇""正在分析数据...完成3/5步"。通过**流式中间状态推送**（SSE/WebSocket），让用户知道系统在干活而不是卡死了。

**3. 结果价值足够高**：十几分钟等待换来的结果，质量明显优于秒级返回。比如深度研报vs简单摘要、完整代码审查vs单文件扫描——用户为高质量结果愿意等。

**工程实现**：
- 用**异步任务队列**（Kafka/RabbitMQ）解耦请求和响应
- **SSE推送中间状态**，前端实时展示进度条
- 设置**最大超时时间**（比如20分钟），超时返回已完成的部分结果
- 支持**断点续跑**——如果中间节点失败，从失败点重试而不是从头来

---

## Q5: 不同业务下，延迟和效果你怎么做取舍？

### 答题思路

这是一道**架构决策题**，面试官想看你的决策框架，而不是某个具体答案。

### 深度解答

我的取舍框架是**三维决策矩阵**：

| 维度 | 偏效果 | 偏延迟 |
|------|--------|--------|
| **用户预期** | 深度分析、研报生成 | 实时问答、客服 |
| **错误代价** | 错误回答影响大（医疗/法律） | 错误回答代价低（闲聊） |
| **调用量** | 低频高价值 | 高频低成本 |

**具体策略**：

1. **分级响应**：同一个系统，简单问题走快速路径（单次LLM调用），复杂问题走深度路径（多步Agent）。用意图分类做路由。

2. **延迟预算分配**：给每个节点设定延迟上限，比如"检索200ms、LLM生成2s、校验100ms"。超预算就降级——检索从向量+关键词混合降为纯向量，LLM从大模型降为小模型。

3. **异步补偿**：先返回一个快速但不完美的结果，后台继续跑深度路径，完成后通过消息推送更新结果。

```java
// 分级响应路由
public class ResponseRouter {
    
    private final FastPathAgent fastAgent;   // 小模型 + 单步
    private final DeepPathAgent deepAgent;   // 大模型 + 多步ReAct
    
    public Response route(UserRequest request) {
        ComplexityScore score = complexityEvaluator.evaluate(request);
        
        if (score.isSimple()) {
            return fastAgent.run(request);  // < 2s
        } else {
            // 先给快速预览，后台跑深度
            CompletableFuture<Response> deepResult = 
                CompletableFuture.supplyAsync(() -> deepAgent.run(request));
            Response preview = fastAgent.run(request);
            preview.setDeepResultPromise(deepResult);
            return preview;
        }
    }
}
```

---

## Q6: Agent之间怎么编排？框架选型你考虑过哪些？

### 答题思路

考的是**多Agent编排的实际经验**，要讲清楚选型过程和最终决定的原因。

### 深度解答

**编排模式**主要两种：

**1. 中心化编排（Orchestrator模式）**：一个主Agent统一调度，Worker Agent只负责执行。优点是链路清晰、好调试、好控制。缺点是主Agent成为瓶颈。

**2. 去中心化编排（Peer-to-Peer模式）**：Agent之间直接通信。优点是灵活、无单点。缺点是调试困难、可能出现死循环。

**框架选型考虑过**：
| 框架 | 优势 | 劣势 |
|------|------|------|
| **LangGraph** | 图状态机、可视化、Python生态 | Python only、生产部署偏重 |
| **CrewAI** | 角色定义清晰、上手快 | 定制性差、性能一般 |
| **AutoGen** | 多Agent对话、灵活 | 过于灵活难以控制、文档差 |
| **自研状态机** | 完全可控、性能好 | 开发成本高 |

**最终选择**：核心编排用自研状态机（基于Spring StateMachine），原因：
- Java生态，和现有技术栈一致
- 完全可控，日志和trace自己说了算
- Agent内部逻辑用LangChain4j做ReAct，两者结合

```java
// 自研编排 + LangChain4j Agent
@Configuration
@EnableStateMachineFactory
public class AgentOrchestratorConfig 
        extends EnumStateMachineConfigurerAdapter<States, Events> {
    
    @Override
    public void configure(StateMachineStateConfigurer<States, Events> states) {
        states.withStates()
            .initial(States.INTENT_CLASSIFY)
            .states(EnumSet.allOf(States.class))
            .end(States.RESPONSE_VALIDATED);
    }
    
    @Override
    public void configure(StateMachineTransitionConfigurer<States, Events> transitions) {
        transitions
            .withExternal().source(States.INTENT_CLASSIFY).target(States.RAG_SEARCH)
                .event(Events.INTENT_CLEAR)
            .and()
            .withExternal().source(States.RAG_SEARCH).target(States.REASONING)
                .event(Events.DOC_RETRIEVED)
            .and()
            .withExternal().source(States.REASONING).target(States.VALIDATE)
                .event(Events.ANSWER_GENERATED);
    }
}
```

---

## Q7: memory为什么要拆成短期、长期、摘要三层？

### 答题思路

这道题考的是**Memory设计的工程深度**，不能只说概念，要讲清楚每一层解决什么问题、为什么两层不够。

### 深度解答

**为什么不只用一层？** 因为记忆的**生命周期**和**检索模式**完全不同：

| 层级 | 生命周期 | 存储位置 | 检索方式 | 解决的问题 |
|------|----------|----------|----------|-----------|
| 短期记忆 | 单次会话 | Context Window | 直接引用 | 维持当前对话连贯性 |
| 摘要记忆 | 跨会话 | KV Store | 按会话ID | 压缩历史、节省token |
| 长期记忆 | 永久 | 向量数据库 | 语义检索 | 跨任务知识复用 |

**为什么两层不够？**

- 只有短期+长期：长期记忆检索噪音大，一次对话中讨论的10个话题，下次全存到长期记忆里，检索时根本分不清哪些和当前问题相关。
- 摘要层的作用是**降噪**——在短期记忆即将被丢弃时，先做一次摘要压缩，只保留关键信息写入长期记忆。相当于给长期记忆做了一层"过滤器"。

**实际数据**：不做摘要压缩直接存长期记忆，检索准确率约65%；加了摘要层后，准确率提升到82%，因为存进去的每条记忆信息密度更高。

```java
// 三层Memory架构
@Service
public class ThreeLayerMemory {
    
    private final ConversationHistory shortTerm;  // 短期：当前对话messages
    private final SummaryStore summaryStore;       // 摘要：Redis
    private final VectorStore longTermStore;       // 长期：Milvus
    
    @Scheduled(fixedRate = 60000)  // 每分钟检查一次
    public void compressIfNeeded() {
        for (Session session : shortTerm.getActiveSessions()) {
            if (session.getMessageCount() > 20) {
                // 1. 对短期记忆做摘要
                String summary = summarizer.summarize(session.getMessages());
                // 2. 存入摘要层
                summaryStore.save(session.getId(), summary);
                // 3. 提取关键实体存入长期记忆
                List<Entity> entities = entityExtractor.extract(summary);
                longTermStore.add(entities);
                // 4. 裁剪短期记忆，只保留最近10条
                session.truncateTo(10);
            }
        }
    }
    
    public String retrieveContext(String query, String sessionId) {
        // 组合三层记忆作为上下文
        String recent = shortTerm.getRecent(sessionId, 10);
        String summary = summaryStore.get(sessionId);
        List<String> relevant = longTermStore.search(query, 5);
        return String.join("\n", recent, summary, String.join("\n", relevant));
    }
}
```

---

## Q8: 长期memory里存什么？什么时候触发加载？

### 深度解答

**存什么**：长期记忆只存**结构化事实**和**决策知识**，不存原始对话。

- ✅ 用户偏好："用户喜欢简洁回答，不要长篇大论"
- ✅ 关键实体："用户的项目用Spring Boot 3.2 + LangChain4j"
- ✅ 决策经验："上次同类问题用了Tool A而非Tool B，效果更好"
- ❌ 原始闲聊："今天天气不错"

**什么时候触发加载**：
1. **会话开始时**：加载该用户最近的摘要记忆（轻量）
2. **语义触发**：当前query和长期记忆的embedding相似度超过阈值时，加载相关记忆片段
3. **规则触发**：检测到特定意图时主动加载（比如用户问"上次我们讨论的方案"，触发搜索历史记忆）

### 工程踩坑

- 长期记忆**不能全部加载**——一次注入20条记忆到prompt，信噪比急剧下降。实践经验：**每次最多注入3-5条最相关的长期记忆**。
- 记忆有**过期问题**——用户3个月前的偏好可能已经变了。给长期记忆加时间衰减因子，越久远的记忆权重越低。

---

## Q9: memory是靠模型自己选，还是用规则触发更靠谱？

### 深度解答

**两者混用，但规则为主、模型为辅**。

原因很简单：让模型自己决定要不要加载记忆，本身就需要一次LLM调用，增加了延迟和成本。而且模型判断的准确率并不高——实验数据显示模型自主选择记忆的准确率只有约60%，而基于规则的语义检索能达到80%+。

**规则触发场景**：
- 会话开始 → 必加载用户画像摘要
- 检测到指代词（"那个"、"上次"）→ 触发历史记忆检索
- RAG检索结果不足 → 触发长期记忆补充

**模型决策场景**（仅当规则无法覆盖时）：
- 判断检索回来的记忆是否真的和当前问题相关（做二次过滤）
- 判断哪些记忆需要更新、哪些可以丢弃

```java
// 规则优先的记忆触发
public class MemoryTrigger {
    
    private final VectorStore vectorStore;
    private final ChatClient chatClient;
    
    public List<Memory> trigger(String query, SessionContext ctx) {
        List<Memory> result = new ArrayList<>();
        
        // Rule 1: 会话开始，加载摘要
        if (ctx.isNewSession()) {
            result.addAll(vectorStore.search(
                "user_profile:" + ctx.getUserId(), 3));
        }
        
        // Rule 2: 检测指代词
        if (containsReference(query)) {
            result.addAll(vectorStore.search(
                ctx.getRecentTopics(), 5));
        }
        
        // Rule 3: 用模型做二次过滤（仅在检索结果较多时）
        if (result.size() > 5) {
            result = chatClient.prompt()
                .user("从以下记忆中选择与问题最相关的3条：\n" + 
                      result + "\n问题：" + query)
                .call()
                .content();
        }
        
        return result.stream().limit(3).collect(toList());
    }
}
```

---

## Q10: 多轮对话里指代不清的问题你怎么处理？

### 深度解答

指代不清（coreference resolution）是Agent对话的**经典难题**，处理方法分三层：

**1. Query改写**：最常用的方法。把"那个方案怎么样"改写成"你之前提到的XX方案怎么样"，消除指代。实现方式是把最近几轮对话作为上下文，让LLM重写当前query。

**2. 共指消解**：用NLP模型识别指代关系——"它"指代上文提到的哪个实体。这个精度比query改写高，但需要额外的模型调用。

**3. 对话状态追踪（DST）**：维护一个结构化的对话状态对象，记录当前讨论的实体和话题。每次新query进来时，用状态对象补充上下文。

**实际选择**：我主用query改写，因为实现成本低、效果够用。对于关键业务场景（比如金融、医疗），在改写后加一层共指消解做校验。

```java
// Query改写消除指代
public class QueryRewriter {
    private final ChatClient chatClient;
    
    public String rewrite(String query, List<Message> history) {
        // 只保留最近5轮对话作为改写上下文
        String recentHistory = history.stream()
            .skip(Math.max(0, history.size() - 5))
            .map(m -> m.getRole() + ": " + m.getContent())
            .collect(joining("\n"));
        
        return chatClient.prompt()
            .user("""
                根据对话历史，将用户的最新问题改写为独立、完整的问题。
                消除所有指代词（它、那个、这个方案等），替换为具体实体。
                
                对话历史：
                %s
                
                用户最新问题：%s
                
                只输出改写后的问题，不要解释。
                """.formatted(recentHistory, query))
            .call()
            .content();
    }
}
```

---

## Q11: query改写放在哪个环节最合适？

### 深度解答

**放在检索之前、意图识别之后**。

原因：
- 如果放在意图识别之前，改写可能改变用户意图——"它好不好"改写成"XX方案好不好"，意图从模糊变成了明确，分类更准确。
- 如果放在检索之后，检索已经用了原始query，改写就没意义了。

**完整流程**：用户输入 → 意图分类 → query改写 → 检索 → 生成

但有个trade-off：query改写本身需要一次LLM调用，增加了100-300ms延迟。如果用户query本身很清晰（没有指代），改写是浪费的。所以加一个**轻量判断**——检测是否包含指代词，有的话才做改写。

---

## Q12: query改写带来的额外延迟怎么压住？

### 深度解答

**四种策略**：

1. **条件触发**：不是每个query都改写，只在检测到指代词或语义模糊时才触发。减少60-70%的改写调用。

2. **用小模型做改写**：改写任务不需要最强模型，用Qwen-7B或甚至3B就能做好，延迟从300ms降到50ms。

3. **并行执行**：原始query和改写后的query同时检索，取并集。改写不再阻塞检索流程。

4. **缓存改写结果**：相似query的改写结果缓存，命中率约30%。

```java
// 并行改写 + 检索
public class ParallelQueryProcessor {
    private final ExecutorService executor;
    
    public SearchResult search(String query, List<Message> history) {
        // 原始query立即检索
        CompletableFuture<List<Document>> originalSearch = 
            CompletableFuture.supplyAsync(() -> ragService.search(query));
        
        // 并行做改写
        CompletableFuture<String> rewritten = 
            CompletableFuture.supplyAsync(() -> rewriter.rewrite(query, history));
        
        // 改写后再检索
        CompletableFuture<List<Document>> rewrittenSearch = 
            rewritten.thenApply(q -> ragService.search(q));
        
        // 合并结果
        List<Document> merged = Stream.concat(
            originalSearch.join().stream(),
            rewrittenSearch.join().stream()
        ).distinct().collect(toList());
        
        return reranker.rerank(query, merged);
    }
}
```

---

## Q13: Agent的评测体系怎么搭？

### 深度解答

评测体系分**三层**：

**1. 离线评测（开发阶段）**：
- **准确率**：准备标准QA对，计算Agent回答的语义相似度
- **完整率**：Agent是否完成了所有必要步骤
- **工具调用正确率**：Agent选的工具和参数是否正确

**2. 在线评测（上线后）**：
- **用户反馈信号**：点赞/点踩、复制/分享、追问率
- **业务指标**：解决率（用户是否在对话后还去人工客服）、转化率
- **延迟和成本**：平均响应时间、token消耗

**3. Badcase驱动评测**：
- 每个badcase自动进入评测集
- 每次发版前跑全量评测集，确保没有回归
- 评测集按**难度**和**类型**分层，不只是看总通过率

```java
// 评测框架
@Service
public class AgentEvaluator {
    
    private final List<TestCase> testCases;  // 评测集
    private final ChatClient judgeModel;     // 用LLM做评判
    
    public EvaluationReport evaluate() {
        List<Result> results = new ArrayList<>();
        
        for (TestCase tc : testCases) {
            // 1. 执行Agent
            AgentResponse response = agent.run(tc.getInput());
            
            // 2. LLM-as-Judge评分
            Score score = judgeModel.prompt()
                .user("""
                    评判Agent回答质量，1-5分：
                    问题：%s
                    标准答案：%s
                    Agent回答：%s
                    
                    评分维度：准确性、完整性、相关性
                    输出JSON：{"accuracy": N, "completeness": N, "relevance": N}
                    """.formatted(tc.getInput(), tc.getExpected(), response))
                .call()
                .entity(Score.class);
            
            results.add(new Result(tc, response, score));
        }
        
        return new EvaluationReport(results);
    }
}
```

---

## Q14: 用户行为能不能当成效果评估信号？

### 深度解答

**可以，但要做校准**。

用户行为是**隐式反馈**，比显式点赞/点踩量大得多，但噪音也大：

| 行为信号 | 正面含义 | 噪音可能 |
|---------|---------|---------|
| 用户复制了回答 | 回答有用 | 用户可能复制后去搜别的 |
| 用户追问 | 不满意 | 用户对话题感兴趣，想深入 |
| 用户离开 | 满意了 | 用户放弃了、去别处找答案 |
| 用户点踩 | 不满意 | 用户心情不好、误触 |

**校准方法**：
1. **行为组合判断**：单信号不准，组合信号更可靠——"复制+离开"大概率满意，"追问+换话题"大概率不满意。
2. **和显式反馈对标**：收集一批同时有行为和显式反馈的数据，训练校准模型。
3. **AB实验验证**：用用户行为信号指导的优化，通过AB实验验证是否真的提升了业务指标。

---

## Q15: badcase怎么回流到评测集和后续迭代里？

### 深度解答

**闭环流程**：

1. **发现**：用户反馈（点踩/投诉）、监控告警（超长响应/异常工具调用）、人工抽检
2. **录入**：badcase结构化记录（输入、期望输出、实际输出、错误类型、严重程度）
3. **分类**：按错误类型分——检索不足、推理错误、工具选择错误、格式问题
4. **修复验证**：修复后先跑badcase对应的评测用例，通过后再跑全量评测
5. **回归守护**：badcase永久进入评测集，防止后续修改导致相同问题复现

```java
// Badcase自动录入
@Aspect
@Component
public class BadcaseCollector {
    
    @Autowired
    private BadcaseRepository repo;
    
    @AfterThrowing(pointcut = "execution(* com.example.agent..*(..))", 
                   throwing = "ex")
    public void collectBadcase(JoinPoint jp, Exception ex) {
        Badcase bc = Badcase.builder()
            .input(getCurrentRequest())
            .actualOutput(getCurrentResponse())
            .errorType(classify(ex))
            .severity(determineSeverity(ex))
            .timestamp(LocalDateTime.now())
            .build();
        repo.save(bc);
    }
}
```

---

## Q16: RAG从文档入库到线上检索，完整链路怎么走？

### 深度解答

**完整链路分5个阶段**：

```
文档上传 → 文档解析 → Chunk切分 → Embedding+入库 → 线上检索
```

**1. 文档上传**：支持PDF/Word/HTML/Markdown，存到对象存储（MinIO），记录元数据（来源、版本、上传时间）。

**2. 文档解析**：
- PDF：复杂排版用PyMuPDF/Unstructured，表格用Camelot
- Word：Apache POI提取段落+表格
- HTML：BeautifulSoup去标签，保留结构

**3. Chunk切分**：不能只按固定长度切，要按语义边界（段落、章节、标题）切。每个chunk带上metadata（所属文档、章节标题、页码）。

**4. Embedding + 入库**：
- 文本用BGE-large/M3E做embedding
- 存入向量数据库（Milvus），同时存原始文本到PostgreSQL
- 构建倒排索引（Elasticsearch），用于关键词检索

**5. 线上检索**：
- 用户query做embedding → 向量检索TopK
- 同时用关键词检索（BM25）
- 混合检索结果做Rerank（Cohere Rerank或BGE-Reranker）
- 取TopN注入prompt

---

## Q17: 为什么要搞混合检索？向量和关键词各自解决什么痛点？

### 深度解答

**向量检索的局限**：
- 对**精确匹配**差——搜"2024年Q3财报"，向量检索可能返回"2023年Q4财报"（语义相似但年份不对）
- 对**专有名词**差——产品名、人名、缩写，embedding可能分不清

**关键词检索的局限**：
- 对**语义理解**差——搜"怎么退款"，文档里写的是"退费流程"，关键词匹配不上
- 对**同义词**差——搜"价格"，文档里写的是"定价"或"费用"

**混合检索=互补**：向量解决语义相似，关键词解决精确匹配。实践数据：纯向量检索准确率约72%，纯关键词约65%，混合检索达到**85%+**。

```java
// 混合检索实现
@Service
public class HybridRetriever {
    
    private final VectorRepository vectorRepo;     // Milvus
    private final KeywordRepository keywordRepo;   // Elasticsearch
    
    public List<Chunk> retrieve(String query, int topK) {
        // 并行检索
        CompletableFuture<List<Chunk>> vectorResults = 
            CompletableFuture.supplyAsync(() -> vectorRepo.search(query, topK * 2));
        CompletableFuture<List<Chunk>> keywordResults = 
            CompletableFuture.supplyAsync(() -> keywordRepo.search(query, topK * 2));
        
        List<Chunk> vector = vectorResults.join();
        List<Chunk> keyword = keywordResults.join();
        
        // Reciprocal Rank Fusion (RRF) 融合
        return reciprocalRankFusion(vector, keyword, topK);
    }
    
    private List<Chunk> reciprocalRankFusion(
            List<Chunk> list1, List<Chunk> list2, int topK) {
        Map<String, Double> scores = new HashMap<>();
        int k = 60; // RRF参数
        
        for (int i = 0; i < list1.size(); i++) {
            scores.merge(list1.get(i).getId(), 1.0 / (k + i + 1), Double::sum);
        }
        for (int i = 0; i < list2.size(); i++) {
            scores.merge(list2.get(i).getId(), 1.0 / (k + i + 1), Double::sum);
        }
        
        return scores.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .limit(topK)
            .map(e -> chunkRepo.findById(e.getKey()))
            .collect(toList());
    }
}
```

---

## Q18: TopK怎么定？召回越多就一定越好吗？

### 深度解答

**不是越多越好**，原因有二：

**1. 信噪比下降**：TopK=5时可能3条相关、2条噪音；TopK=20时可能4条相关、16条噪音。多余的不相关文档反而会干扰LLM生成，导致幻觉。

**2. Token成本和延迟**：更多文档意味着更长的context，LLM推理延迟线性增长。

**TopK怎么定**：
- **经验值**：生产环境TopK通常在5-10之间，经过Rerank后取3-5条注入prompt
- **实验调优**：在评测集上测试不同TopK的准确率曲线，找拐点
- **动态调整**：简单问题TopK小（3-5），复杂问题TopK大（10-15）

**判断检索质量的标准**不是"召回多少"，而是**Precision@K**和**MRR（Mean Reciprocal Rank）**——最相关的文档排在前面，比召回很多但相关的不在前面，效果好得多。

---

## Q19: 什么场景下规则链路比大模型更合适？

### 深度解答

**规则优于LLM的三种场景**：

1. **确定性要求极高**：金额计算、合规校验、权限判断——这些不能有幻觉，规则100%确定。
2. **高频低价值**：比如FAQ自动回复、格式化输出——用LLM是浪费，规则模板成本是LLM的1/100。
3. **LLM效果差**：数字精确计算、严格格式输出（JSON Schema），LLM经常出错，规则天然可靠。

**经验法则**：如果一个任务可以写成不超过50条的if-else，就不需要LLM。

```java
// 规则优先、LLM兜底
public class HybridRouter {
    
    public Response handle(Request request) {
        // 1. 先走规则
        RuleResult ruleResult = ruleEngine.evaluate(request);
        if (ruleResult.isConfident()) {
            return ruleResult.toResponse();  // 规则命中，直接返回
        }
        
        // 2. 规则没命中，走LLM
        return llmAgent.run(request);
    }
}
```

---

## Q20: 复杂PDF解析最难的点在哪？

### 深度解答

**三大难点**：

1. **版面还原**：多栏排版、图文混排、表格跨页——解析顺序容易错乱。解决：用版面分析模型（LayoutLMv3/PaddleOCR的版面分析）识别区域类型，按阅读顺序重组。

2. **表格解析**：合并单元格、嵌套表格、表格跨页——传统PDF解析器基本都处理不好。解决：Camelot/pdfplumber做初步提取，再用LLM做结构化纠正。

3. **公式和特殊符号**：数学公式、化学方程式——大部分PDF解析器直接丢失或乱码。解决：Nougat模型专门做学术PDF的公式识别。

### 工程踩坑

- **扫描版PDF**：需要先OCR再解析，OCR本身的准确率就是瓶颈。中英文混排OCR准确率约90%，需要在后处理环节做纠正。
- **不要追求100%解析率**：生产环境80-85%的解析质量够用了，剩余的badcase用人工抽检+纠正补充，比花大力气提升最后5%更划算。

---

## Q21: chunk切分为什么不能只用固定长度？

### 深度解答

**固定长度切分的三大问题**：

1. **语义截断**：一句话从中间断开，"2024年Q3营收同比增长"切成"2024年Q3营收同比"和"增长"，两个chunk语义都残缺。

2. **信息丢失**：标题和正文被切到不同chunk，检索到正文chunk时丢失了标题提供的上下文。

3. **粒度不均**：有的段落200字信息密度高，有的段落1000字是废话。固定长度要么信息丢失、要么噪音太大。

**正确做法**：
- 按语义边界切（段落、章节、标题）
- 每个chunk带上下文元数据（标题链：`第一章 > 1.2节 > 1.2.3小节`）
- chunk之间有**重叠**（overlap=100-200字），避免边界信息丢失

```java
// 语义切分策略
public class SemanticChunker {
    
    public List<Chunk> chunk(Document doc) {
        List<Chunk> chunks = new ArrayList<>();
        List<String> paragraphs = doc.getParagraphs();  // 按段落拆
        
        StringBuilder current = new StringBuilder();
        String currentHeading = "";
        
        for (String para : paragraphs) {
            // 检测到新标题，开始新chunk
            if (isHeading(para)) {
                if (current.length() > 0) {
                    chunks.add(buildChunk(current, currentHeading));
                }
                currentHeading = para;
                current = new StringBuilder();
            }
            
            current.append(para).append("\n");
            
            // 超过最大长度，强制切分
            if (current.length() > MAX_CHUNK_SIZE) {
                chunks.add(buildChunk(current, currentHeading));
                // 保留overlap部分
                current = new StringBuilder(getOverlap(current));
            }
        }
        
        return chunks;
    }
}
```

---

## Q22: metadata除了存字段，还能怎么参与召回？

### 深度解答

Metadata的召回价值远超"存储附加信息"：

**1. 过滤检索**：只检索特定来源、特定时间范围的文档。比如用户问"最新的退款政策"，用metadata里的`publish_date`做过滤，只返回近3个月的文档。

**2. 权重提升**：相似度相近的多个chunk，metadata更匹配的排前面。比如用户是VIP，metadata标记了"VIP专属"的chunk权重提升。

**3. 上下文增强**：检索到chunk后，把metadata（章节标题、来源文档名）拼到chunk前面，让LLM知道这段文字来自哪个文档的哪个章节，减少幻觉。

**4. 纠错辅助**：chunk内容有OCR错误，metadata里的标题是正确的，可以辅助LLM理解。

---

## Q23: 文档版本、有效期、更新机制怎么设计？

### 深度解答

**版本管理**：
- 每个文档有`doc_id`和`version`字段
- 新版本入库时，旧版本标记为`deprecated`但不删除（支持回滚）
- 检索时默认只返回`latest`版本

**有效期**：
- 文档有`valid_from`和`valid_until`字段
- 定时任务扫描过期文档，标记为`expired`
- 检索时过滤掉过期文档

**更新机制**：
- **全量更新**：新文档入库，旧文档标记deprecated
- **增量更新**：只更新变化的chunk（用diff算法比对），减少重新embedding的成本
- **通知机制**：文档更新后，通知依赖该文档的Agent重新加载缓存

---

## Q24: 离线文档和实时接口分别适合什么场景？

### 深度解答

| 维度 | 离线文档（RAG） | 实时接口（API Tool） |
|------|----------------|---------------------|
| **数据时效** | 低频更新（政策、手册） | 实时变化（库存、价格） |
| **响应延迟** | 检索快（50-200ms） | 取决于接口（100ms-2s） |
| **准确性** | 可能过期 | 实时准确 |
| **成本** | 入库成本分摊，检索成本低 | 每次调用都有成本 |

**选择标准**：数据变化频率<1次/天 → 离线文档；数据变化频率>1次/小时 → 实时接口。

**混合模式**：用离线文档做知识底座，关键数据（价格、库存）实时接口补充。比如"XX产品的退费政策"从RAG取，"当前XX产品的价格"从API取。

---

## Q25: 生成后校验层是解决什么问题的？

### 深度解答

**生成后校验解决LLM的三类问题**：

1. **事实性错误**：LLM编造了不存在的信息。校验方式——把生成回答中的事实性陈述提取出来，和检索文档做交叉验证（faithfulness check）。

2. **格式错误**：LLM没有按要求的格式输出。校验方式——JSON Schema校验、正则匹配、字段完整性检查。

3. **安全性问题**：LLM输出了有害内容。校验方式——敏感词过滤、PII检测、合规审核。

**校验后的处理**：
- 格式错误 → 解析修正或重新生成
- 事实性错误 → 标记不可靠部分，用文档原文替换
- 安全问题 → 拦截返回，替换为安全模板回复

```java
// 生成后校验链
@Component
public class PostValidationChain {
    
    private final List<Validator> validators = List.of(
        new FormatValidator(),      // 格式校验
        new FaithfulnessValidator(), // 事实性校验
        new SafetyValidator()       // 安全性校验
    );
    
    public ValidationResult validate(String answer, List<Document> sources) {
        for (Validator v : validators) {
            ValidationResult r = v.validate(answer, sources);
            if (!r.isPassed()) {
                return r;  // 短路：任一校验失败即返回
            }
        }
        return ValidationResult.pass();
    }
}
```

---

## Q26: 为什么有些场景SFT效果不好？

### 深度解答

**SFT效果不好的四种情况**：

1. **训练数据不足**：SFT需要**高质量、多样化**的训练数据，少于500条基本不可能有效果。很多场景根本凑不够这么多标注数据。

2. **任务变化快**：SFT训练一次要几天到几周，如果业务规则频繁变化（比如产品政策每月更新），模型还没训完数据就过时了。RAG在这方面更灵活——更新文档就行，不用重新训练。

3. **泛化vs特化矛盾**：SFT倾向于让模型记住训练数据里的模式，但对训练数据没覆盖的新问题反而表现更差（灾难性遗忘）。而RAG+Prompt天然支持开放域问题。

4. **长尾分布**：80%的用户问题集中在20%的场景，SFT在这些高频场景有效。但剩下80%的长尾场景，训练数据太少，SFT学不到。RAG通过检索能覆盖更多长尾。

**什么场景SFT更好**：任务高度确定、输出格式严格、训练数据充足、不需要解释推理过程——比如合同条款提取、医疗报告结构化。

---

## Q27: reward model适合解决哪类问题？

### 深度解答

**Reward Model的核心价值是对齐"人类偏好"**，适合解决LLM输出"技术上没错但不符合预期"的问题：

1. **回答风格对齐**：用户要简洁答案，LLM给了长篇大论——技术上没毛病但体验差。Reward Model可以训练"简洁=高分"的偏好。

2. **安全对齐**：LLM输出了"正确但不安全"的信息——Reward Model训练"拒绝有害请求=高分"。

3. **多目标权衡**：回答既要准确又要完整又要简洁——多个目标之间需要权衡，Reward Model可以编码这种权衡。

**不适合Reward Model的场景**：
- **客观准确性**：2+2=4是客观事实，不需要偏好模型，规则校验更可靠
- **简单分类**：意图识别这种有标准答案的任务，SFT更直接

**工程实践**：Reward Model主要用于RLHF训练阶段，推理阶段用得不多——因为每次推理都跑reward model太慢。推理阶段用**规则校验+LLM-as-Judge**替代。

---

## 💡 反问环节

面试官重点介绍了携程的四个业务方向：
- **智能客服**
- **超级导购**
- **统一知识库**
- **MCP工具集**

## 💡 整体感受

携程这轮比较看重**"设计合理性"**。很多问题不是问你做没做，而是问你**为什么这么做**。面试官会顺着你的项目细节往下挖，看你这些设计能不能复用到他们自己的业务里。

如果项目只是堆技术名词但讲不清取舍，很容易露怯。
