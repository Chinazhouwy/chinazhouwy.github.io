# 阿里淘天三面面经（深度版）

> **来源**: 小红书 — http://xhslink.com/o/3DRfpshaQgw
> **标签**: `#大厂` `#互联网大厂` `#面试日常` `#面经` `#阿里巴巴` `#淘天` `#暑期实习`
> **考点分类**: RAG系统设计 / 上下文管理 / Agent设计 / 通信协议 / Vibe Coding
> **面试特点**: 三面偏架构深挖+工程思考，面试官会不停追问（"你刚提到XX，具体怎么实现"），看你是否真正理解每个设计决策的细节。4.30 OC。
> **面试轮次**: 三面（终面技术面），后续HR面

---

## Q1: RAG系统应该给大模型什么，大模型才能更好的执行任务？

### 答题思路

这道题考的是你对RAG本质的理解——不是"检索文档塞给模型"，而是**精心组织信息让模型高效推理**。面试官想看你有没有想过：给什么、怎么给、给多少。

### 深度解答

RAG系统给大模型的不只是"文档片段"，而是**结构化的、有层次的、带上下文的任务支撑信息**：

**必须给的四类信息**：

| 信息类型 | 作用 | 示例 |
|----------|------|------|
| **相关文档片段** | 提供事实依据 | 检索到的产品文档、FAQ回答 |
| **结构化元数据** | 帮助模型理解文档边界和来源 | 文档标题、来源、时效性、置信度 |
| **对话历史摘要** | 维持多轮对话连贯性 | Redis中的近期对话摘要 |
| **任务引导指令** | 约束模型输出格式和范围 | system prompt中的角色定义和输出约束 |

**关键原则**：

1. **信息要有层次**：不要把所有检索结果平铺给模型。按相关性排序，最相关的放前面，并标注来源和可信度。

2. **信息要有边界**：每个文档片段标明来源和范围，防止模型把不同来源的信息张冠李戴。

3. **信息要有时效标注**：过时的文档要标明"截至2025年3月"，让模型知道信息可能已失效。

4. **信息量和质量的trade-off**：不是越多越好。实验数据——注入5条相关文档，准确率82%；注入15条，准确率反而降到71%，因为噪音增加了。

```java
// RAG系统构建给大模型的上下文
@Service
public class RAGContextBuilder {
    
    public String buildContext(String query, List<RetrievedDoc> docs, 
                               ConversationHistory history) {
        StringBuilder context = new StringBuilder();
        
        // 1. 任务引导
        context.append("## 任务说明\n");
        context.append("基于以下检索到的文档回答用户问题。如果文档中没有相关信息，请明确说明。\n\n");
        
        // 2. 对话历史摘要（如果有）
        if (!history.getSummary().isEmpty()) {
            context.append("## 对话背景\n");
            context.append(history.getSummary()).append("\n\n");
        }
        
        // 3. 检索结果（按相关性排序，带元数据）
        context.append("## 检索结果\n");
        for (int i = 0; i < Math.min(docs.size(), 5); i++) {
            RetrievedDoc doc = docs.get(i);
            context.append(String.format("""
                ### [%d] %s
                - 来源：%s
                - 时效：%s
                - 相关性：%.2f
                
                %s
                """, i + 1, doc.getTitle(), doc.getSource(), 
                    doc.getUpdateTime(), doc.getScore(), doc.getContent()));
        }
        
        // 4. 输出约束
        context.append("\n## 输出要求\n");
        context.append("- 引用信息时标注来源编号，如[1]\n");
        context.append("- 不要编造文档中不存在的信息\n");
        
        return context.toString();
    }
}
```

### 工程踩坑

- **文档片段之间矛盾**：不同来源的文档对同一问题有不同说法。在context里标注每个来源的可信度权重，让模型优先采信高可信度来源。
- **检索结果和对话历史冲突**：用户之前被告知的信息和最新检索结果矛盾。检测到冲突时，在context里主动标注"最新信息已更新"。

---

## Q2: Redis存储对话历史的流程（用户_ID+session_ID作为唯一key）

### 深度解答

**Key设计**：`chat:{userId}:{sessionId}`

为什么用userId+sessionId做复合key？
- 只用sessionId：跨设备无法共享历史
- 只用userId：多会话串台（用户同时开两个问题，历史混在一起）
- 复合key：精确到每次独立对话

**存储结构**：用Redis List存储消息序列

```
chat:user123:session456
  ├── [0] {"role":"user","content":"推荐一款手机","timestamp":1714...}
  ├── [1] {"role":"assistant","content":"为您推荐...","timestamp":1714...}
  ├── [2] {"role":"user","content":"有没有更便宜的","timestamp":1714...}
  └── [3] {"role":"assistant","content":"这款性价比更高...","timestamp":1714...}
```

**完整流程**：

1. **新消息写入**：`RPUSH chat:{userId}:{sessionId} {message_json}`，追加到列表尾部
2. **读取历史**：`LRANGE chat:{userId}:{sessionId} -10 -1`，取最近10轮
3. **TTL设置**：`EXPIRE chat:{userId}:{sessionId} 1800`，30分钟超时
4. **摘要压缩**：超过20轮时，对前15轮做摘要，存到 `chat:summary:{userId}:{sessionId}`
5. **会话恢复**：新session开始时，检查是否有活跃session可以续接

```java
@Service
public class ConversationStore {
    
    private final StringRedisTemplate redis;
    private final ChatClient chatClient;
    
    private static final int MAX_ROUNDS = 20;        // 超过此数触发压缩
    private static final int KEEP_ROUNDS = 5;         // 压缩后保留最近N轮
    private static final int SESSION_TTL_MINUTES = 30;
    
    // 写入消息
    public void appendMessage(String userId, String sessionId, Message msg) {
        String key = "chat:" + userId + ":" + sessionId;
        String json = serializeMessage(msg);
        redis.opsForList().rightPush(key, json);
        redis.expire(key, SESSION_TTL_MINUTES, TimeUnit.MINUTES);
        
        // 检查是否需要压缩
        Long size = redis.opsForList().size(key);
        if (size != null && size > MAX_ROUNDS * 2) {  // *2因为每轮有user+assistant
            compressHistory(userId, sessionId);
        }
    }
    
    // 读取历史
    public ConversationHistory getHistory(String userId, String sessionId) {
        String key = "chat:" + userId + ":" + sessionId;
        String summaryKey = "chat:summary:" + userId + ":" + sessionId;
        
        // 摘要 + 最近对话
        String summary = redis.opsForValue().get(summaryKey);
        List<String> recentMessages = redis.opsForList().range(key, -KEEP_ROUNDS * 2, -1);
        
        return new ConversationHistory(summary, recentMessages);
    }
    
    // 压缩历史
    private void compressHistory(String userId, String sessionId) {
        String key = "chat:" + userId + ":" + sessionId;
        String summaryKey = "chat:summary:" + userId + ":" + sessionId;
        
        // 取需要压缩的消息（保留最近KEEP_ROUNDS轮）
        Long size = redis.opsForList().size(key);
        long compressEnd = size - KEEP_ROUNDS * 2;
        List<String> oldMessages = redis.opsForList().range(key, 0, compressEnd - 1);
        
        // 生成摘要
        String existingSummary = redis.opsForValue().get(summaryKey);
        String newSummary = chatClient.prompt()
            .user("请将以下对话历史压缩为关键信息摘要（保留用户偏好、关键实体、决策）：\n"
                + "已有摘要：" + existingSummary + "\n"
                + "新对话：" + oldMessages)
            .call().content();
        
        redis.opsForValue().set(summaryKey, newSummary);
        
        // 删除已压缩的消息，只保留最近的
        redis.opsForList().trim(key, -(KEEP_ROUNDS * 2), -1);
    }
}
```

### 工程踩坑

- **大Key问题**：如果对话特别长（100+轮），Redis List会变成大Key，影响性能。解决方案：压缩后只保留最近5轮，历史走摘要。
- **消息序列化格式**：早期用JSON存每条消息，占用空间大。后来改成Protobuf，存储减少60%。
- **并发写入**：用户快速连续发消息时，RPUSH可能乱序。加时间戳字段，读取时按时间排序。

---

## Q3: RAG出来的东西，怎么和Redis里面的历史消息结合？

### 深度解答

结合的关键是**在Prompt中分层组织**，让模型清楚区分"历史对话"和"检索结果"：

```
System Prompt（角色+约束）
├── 对话摘要（Redis摘要层）
├── 近期对话（Redis短期层，最近5轮原文）
├── RAG检索结果（标注来源和相关性）
└── 用户当前问题
```

**结合逻辑**：

1. **RAG结果和历史不冲突时**：直接拼接，模型综合两者回答
2. **RAG结果和历史有矛盾时**：RAG结果优先（因为是最新的文档），但在回答中说明"根据最新信息"
3. **历史中有指代RAG内容的**：先用历史做指代消解，再用消解后的query做RAG检索

```java
// RAG结果 + 历史消息 结合
@Service
public class ContextComposer {
    
    public String compose(String query, ConversationHistory history, 
                          List<RetrievedDoc> ragDocs) {
        StringBuilder prompt = new StringBuilder();
        
        // Layer 1: 系统指令
        prompt.append("你是淘天智能客服。基于检索结果和对话历史回答问题。\n\n");
        
        // Layer 2: 历史摘要（压缩后的早期对话）
        if (history.getSummary() != null) {
            prompt.append("【对话背景】\n").append(history.getSummary()).append("\n\n");
        }
        
        // Layer 3: 近期对话原文
        if (!history.getRecentMessages().isEmpty()) {
            prompt.append("【近期对话】\n");
            for (Message msg : history.getRecentMessages()) {
                prompt.append(msg.getRole()).append(": ").append(msg.getContent()).append("\n");
            }
            prompt.append("\n");
        }
        
        // Layer 4: RAG检索结果
        if (!ragDocs.isEmpty()) {
            prompt.append("【检索结果】\n");
            for (int i = 0; i < ragDocs.size(); i++) {
                prompt.append(String.format("[%d] (来源:%s, 相关性:%.2f) %s\n",
                    i + 1, ragDocs.get(i).getSource(), 
                    ragDocs.get(i).getScore(), ragDocs.get(i).getContent()));
            }
            prompt.append("\n");
        }
        
        // Layer 5: 当前问题
        prompt.append("【用户问题】\n").append(query);
        
        return prompt.toString();
    }
}
```

### 追问：类似于Agent里面长期记忆和短期记忆

是的，这里的设计和Agent Memory三层架构完全对应：
- Redis短期记忆 → 对话最近5轮原文
- Redis摘要记忆 → 对话历史压缩摘要
- RAG检索结果 → 相当于"长期记忆"的语义检索
- 关键区别：Agent长期记忆是**用户个性化的知识**，RAG是**公共知识库**的信息，两者应该分开展

---

## Q4: 如果LLM上下文爆了怎么办？

### 深度解答

上下文爆了（超出模型最大token限制）的**分级应对策略**：

| 严重程度 | 策略 | 效果 |
|----------|------|------|
| 轻微超限 | 压缩历史对话（摘要替代原文） | token减少60% |
| 中度超限 | 截断检索结果（只保留top3） | token减少40% |
| 重度超限 | 分步处理（先处理子问题，再汇总） | 保证不超过限制 |
| 极端情况 | 降级（告知用户问题太复杂，建议拆分） | 兜底方案 |

**工程实现的核心**：**提前预算，不要等爆了再处理**。

```java
// Token预算管理器
@Service
public class TokenBudgetManager {
    
    private static final int MODEL_CONTEXT_LIMIT = 128000;  // 模型上下文上限
    private static final int RESERVED_FOR_OUTPUT = 4096;     // 预留给输出
    private static final int SAFETY_MARGIN = 2000;           // 安全余量
    
    // 各部分的token预算
    private static final int SYSTEM_PROMPT_BUDGET = 1000;
    private static final int HISTORY_BUDGET = 8000;
    private static final int RAG_BUDGET = 12000;
    private static final int QUERY_BUDGET = 2000;
    
    public BudgetedContext allocate(String systemPrompt, ConversationHistory history,
                                     List<RetrievedDoc> docs, String query) {
        int totalBudget = MODEL_CONTEXT_LIMIT - RESERVED_FOR_OUTPUT - SAFETY_MARGIN;
        
        // 1. 系统prompt（不可压缩）
        int systemTokens = countTokens(systemPrompt);
        
        // 2. 用户query（不可压缩）
        int queryTokens = countTokens(query);
        
        // 3. 剩余预算分配给历史和RAG
        int remaining = totalBudget - systemTokens - queryTokens;
        int historyAllowance = (int)(remaining * 0.4);   // 40%给历史
        int ragAllowance = (int)(remaining * 0.6);       // 60%给RAG
        
        // 4. 按预算压缩
        String compressedHistory = compressToFit(history, historyAllowance);
        String compressedRAG = compressRagToFit(docs, ragAllowance);
        
        return new BudgetedContext(systemPrompt, compressedHistory, compressedRAG, query);
    }
    
    private String compressToFit(ConversationHistory history, int tokenBudget) {
        // 先尝试摘要+最近3轮
        String candidate = history.getSummary() + "\n" + 
            history.getRecentMessages(3).stream().map(Message::getContent).collect(joining("\n"));
        
        if (countTokens(candidate) <= tokenBudget) {
            return candidate;
        }
        
        // 还是超了：进一步压缩摘要，只保留最近1轮
        return history.getCompressedSummary() + "\n" + 
            history.getLatestMessage().getContent();
    }
}
```

### 工程踩坑

- **不同模型token限制不同**：GPT-4是128K，Qwen-72B是32K，Qwen-7B是8K。模型切换时token预算要动态调整。
- **Token计数不准**：tiktoken和各模型tokenizer不一致。我们统一用最大值估算，宁可少塞也不超限。
- **压缩后效果下降**：暴力截断比摘要压缩效果差很多。宁可花200ms做摘要，也不要直接砍掉一半历史。

---

## Q5: 你了解到目前的一些主流框架，怎么做的上下文管理？

### 深度解答

| 框架 | 上下文管理策略 | 核心思路 |
|------|---------------|----------|
| **LangChain** | `ConversationBufferMemory` / `ConversationSummaryMemory` / `ConversationBufferWindowMemory` | 插件化Memory，按需选择策略 |
| **LangChain4j** | `ChatMemory` + `MessageWindowChatMemory` | 滑动窗口，保留最近N条消息 |
| **Spring AI** | `ChatMemory` + `MessageChatMemoryAdvisor` | Advisor模式，在调用前后自动管理 |
| **MemGPT** | 虚拟上下文管理，自动分页加载 | 模拟OS的虚拟内存，按需换入换出 |
| **LlamaIndex** | `ContextWindowStrategy` | 检索结果自动适配上下文窗口大小 |

**MemGPT的思路最值得关注**：它把上下文管理类比操作系统的虚拟内存——
- 主存 = 当前上下文窗口
- 磁盘 = 长期存储（向量库/数据库）
- 当上下文满了，自动"换页"——把最不相关的信息换出，需要时再换入

```java
// Spring AI的上下文管理实现
@Service
public class SpringAIContextManager {
    
    private final ChatClient chatClient;
    private final ChatMemory chatMemory;
    
    public SpringAIContextManager(ChatClient.Builder builder) {
        // 滑动窗口：保留最近20条消息
        this.chatMemory = MessageWindowChatMemory.builder()
            .maxMessages(20)
            .build();
        
        this.chatClient = builder
            .defaultAdvisors(
                // 自动在调用前注入历史，调用后保存消息
                MessageChatMemoryAdvisor.builder()
                    .chatMemory(chatMemory)
                    .build(),
                // 自动在prompt中注入检索结果
                QuestionAnswerAdvisor.builder()
                    .vectorStore(vectorStore)
                    .build()
            )
            .build();
    }
}
```

---

## Q6: 上下文压缩怎么做？

### 深度解答

**四种压缩方法**：

1. **滑动窗口**：只保留最近N轮，简单粗暴但丢失早期信息
2. **摘要压缩**：用LLM对早期对话生成摘要，保留关键信息
3. **实体提取**：从对话中提取关键实体和关系，存为结构化数据
4. **动态压缩**：根据当前query相关性，动态决定保留/压缩哪些内容

**实际效果对比**：

| 方法 | 压缩率 | 信息保留率 | 额外延迟 |
|------|--------|-----------|----------|
| 滑动窗口 | 70% | 40%（丢失早期） | 0ms |
| 摘要压缩 | 85% | 75% | 200-500ms |
| 实体提取 | 90% | 60%（只保留实体） | 300-600ms |
| 动态压缩 | 80% | 85% | 400-800ms |

**推荐方案**：摘要压缩为主，动态压缩为辅。简单场景用摘要就够了，复杂场景加动态压缩。

---

## Q7: 你刚提到动态压缩，具体怎么压缩？

### 深度解答

动态压缩的核心思想：**不是均匀压缩所有内容，而是根据当前query的相关性来决定保留什么、压缩什么**。

**流程**：

1. 对当前query做embedding
2. 对历史中每条消息做相关性评分（基于embedding相似度 + 时间衰减）
3. 高相关的消息保留原文，低相关的压缩为摘要或关键词
4. 完全不相关的直接丢弃

```java
// 动态压缩实现
@Service
public class DynamicCompressor {
    
    private final EmbeddingService embeddingService;
    private final ChatClient chatClient;
    
    public String compress(String query, List<Message> history, int tokenBudget) {
        float[] queryEmbedding = embeddingService.embed(query);
        
        // 1. 对每条历史消息计算相关性分数
        List<ScoredMessage> scored = history.stream()
            .map(msg -> {
                float[] msgEmbedding = embeddingService.embed(msg.getContent());
                double similarity = cosineSimilarity(queryEmbedding, msgEmbedding);
                double timeDecay = Math.exp(-0.1 * minutesSince(msg.getTimestamp()));
                double score = similarity * 0.7 + timeDecay * 0.3;
                return new ScoredMessage(msg, score);
            })
            .sorted(Comparator.comparingDouble(ScoredMessage::getScore).reversed())
            .toList();
        
        // 2. 按预算分配：高相关保留原文，低相关压缩
        StringBuilder result = new StringBuilder();
        int usedTokens = 0;
        
        for (ScoredMessage sm : scored) {
            int msgTokens = countTokens(sm.getMessage().getContent());
            
            if (sm.getScore() > 0.7 && usedTokens + msgTokens <= tokenBudget) {
                // 高相关 + 预算够 → 保留原文
                result.append("[原文] ").append(sm.getMessage().getContent()).append("\n");
                usedTokens += msgTokens;
            } else if (sm.getScore() > 0.4) {
                // 中等相关 → 压缩为一句话摘要
                String summary = chatClient.prompt()
                    .user("用一句话概括以下内容的要点：" + sm.getMessage().getContent())
                    .call().content();
                result.append("[摘要] ").append(summary).append("\n");
                usedTokens += countTokens(summary);
            }
            // 低相关 → 直接丢弃
        }
        
        return result.toString();
    }
}
```

---

## Q8: 你刚提到利用一个小模型来做压缩，那怎么写Prompt？

### 深度解答

小模型做压缩的Prompt设计，关键是**明确任务边界、给出具体示例、约束输出格式**：

```java
// 小模型压缩Prompt
String COMPRESSION_PROMPT = """
    你是一个对话压缩助手。你的任务是将多轮对话压缩为简洁的摘要。
    
    ## 规则
    1. 只保留关键信息：用户偏好、关键实体、重要决策、约束条件
    2. 丢弃闲聊、问候、重复内容
    3. 用第三人称描述，不要保留对话格式
    4. 输出不超过200字
    
    ## 示例
    
    输入：
    用户: 我想找一款5000以内的手机
    助手: 为您推荐XX手机，价格4999...
    用户: 有没有续航好一点的
    助手: 这款YY手机续航5000mAh...
    用户: 颜色有蓝色的吗
    助手: YY手机有星空蓝配色...
    
    输出：
    用户需求：5000元以内、续航好的手机，偏好蓝色。已推荐YY手机（星空蓝）。
    
    ## 现在请压缩以下对话
    
    %s
    """;
```

**关键设计点**：

1. **用3B-7B的小模型就够了**：压缩是相对简单的任务，不需要72B大模型。我们用Qwen-7B，延迟从300ms降到80ms。
2. **Few-shot比长规则有效**：2个示例比500字规则描述效果好，准确率从70%提升到88%。
3. **输出格式要严格约束**：要求"不超过200字"、"第三人称"，否则小模型容易输出冗余内容。
4. **增量压缩而非全量**：不是每次从头压缩所有历史，而是只压缩新增的部分，和已有摘要合并。

---

## Q9: RAG出来的信息在大模型上下文压缩的时候应该如何处理？

### 深度解答

RAG检索结果在上下文压缩中的处理原则：**RAG结果比对话历史更难压缩，因为它是事实性信息，压缩可能导致事实失真**。

**策略**：

1. **RAG结果不参与摘要压缩**：对话历史可以被摘要压缩，但RAG检索结果尽量保留原文。因为摘要可能改变事实表述，导致模型基于错误信息回答。

2. **按相关性裁剪RAG结果**：如果RAG结果太多超预算，不是压缩，而是**裁剪**——只保留相关性最高的top3，丢掉其余的。裁剪不改变内容，只减少数量。

3. **RAG结果分级**：
   - 核心片段（和query直接相关）→ 保留原文
   - 补充片段（提供背景信息）→ 只保留关键句
   - 边缘片段（弱相关）→ 只保留标题和来源

4. **RAG结果的时效性标注**：在压缩时，保留RAG结果的时效性元数据。过时的信息即使相关也要标注"此信息可能已过期"。

```java
// RAG结果在上下文压缩中的处理
@Service
public class RAGAwareCompressor {
    
    public CompressedContext compress(String query, ConversationHistory history,
                                       List<RetrievedDoc> ragDocs, int tokenBudget) {
        // 1. RAG结果不压缩，按优先级裁剪
        int ragBudget = (int)(tokenBudget * 0.5);  // RAG占50%预算
        List<RetrievedDoc> keptDocs = new ArrayList<>();
        int ragTokens = 0;
        
        for (RetrievedDoc doc : ragDocs) {
            int docTokens = countTokens(doc.getContent());
            if (ragTokens + docTokens <= ragBudget) {
                keptDocs.add(doc);  // 保留原文
                ragTokens += docTokens;
            } else if (doc.getScore() > 0.8) {
                // 超预算但高相关 → 只保留关键句
                String keySentences = extractKeySentences(doc.getContent(), query);
                keptDocs.add(doc.withContent(keySentences));
                ragTokens += countTokens(keySentences);
            }
            // 低相关且超预算 → 丢弃
        }
        
        // 2. 剩余预算给历史（历史可以压缩）
        int historyBudget = tokenBudget - ragTokens;
        String compressedHistory = dynamicCompressor.compress(query, history, historyBudget);
        
        return new CompressedContext(compressedHistory, keptDocs);
    }
}
```

---

## Q10: 最近在用的Agent

### 深度解答

这道题考的是你的**技术视野和实际使用经验**，不是背框架名字。

**我的回答思路**：按用途分类，讲清楚每个Agent解决了什么问题、效果如何。

| Agent | 类型 | 用途 | 效果 |
|-------|------|------|------|
| **Cursor/Copilot** | 编码Agent | 代码补全、重构、debug | 日常编码效率提升3x |
| **Claude Code / Codex** | 终端Agent | 复杂编码任务、项目级代码生成 | 全栈功能开发 |
| **Dify** | 编排Agent | 可视化搭建RAG/Agent应用 | 快速原型验证 |
| **Coze** | 低代码Agent | 搭建带工具的对话Agent | 工具生态丰富 |
| **Manus** | 通用Agent | 网页操作、信息收集 | 复杂任务自动化 |

---

## Q11: 假设让RAG做一些复杂的功能，比如帮助用户写总结，这样的Agent还需要什么能力？

### 深度解答

单纯RAG只能"检索+回答"，做复杂任务（写总结、做分析、生成报告）需要加**Agent能力**：

**必须增加的能力**：

1. **任务规划能力**：用户说"帮我总结"，Agent需要拆解为——检索相关文档→提取关键信息→组织结构→生成总结→校验完整性

2. **多步推理能力**：写总结不是一步完成，而是需要多轮"读→理解→写→改"的循环

3. **工具调用能力**：可能需要调搜索引擎补充信息、调格式化工具输出排版

4. **自我评估能力**：生成总结后，Agent要能判断"这个总结是否覆盖了关键点"，不满足则重写

5. **人机协作能力**：复杂任务不能一次做完，需要和用户确认方向——"我打算从这三个维度总结，可以吗？"

```java
// 带Agent能力的RAG总结系统
@Service
public class SummaryAgent {
    
    private final ChatClient chatClient;
    private final RAGService ragService;
    
    public String generateSummary(String userQuery, String sessionId) {
        // Step 1: 任务规划
        TaskPlan plan = chatClient.prompt()
            .user("用户要求写总结，请规划步骤：" + userQuery)
            .call().content();  // → ["检索相关文档", "提取要点", "组织大纲", "撰写总结", "校验"]
        
        // Step 2: 多步执行
        // 2a. 检索
        List<RetrievedDoc> docs = ragService.search(userQuery, 10);
        
        // 2b. 提取关键信息
        String keyPoints = chatClient.prompt()
            .user("从以下文档中提取总结所需的关键要点：\n" + docs)
            .call().content();
        
        // 2c. 组织大纲
        String outline = chatClient.prompt()
            .user("基于以下要点，列出总结大纲：\n" + keyPoints)
            .call().content();
        
        // 2d. 生成总结
        String summary = chatClient.prompt()
            .system("你是一个专业总结撰写助手")
            .user("根据大纲和要点撰写完整总结：\n大纲：" + outline + "\n要点：" + keyPoints)
            .call().content();
        
        // Step 3: 自我评估
        String evaluation = chatClient.prompt()
            .user("评估以下总结的完整性和准确性（0-10分）：\n" + summary + 
                  "\n\n原始要点：" + keyPoints)
            .call().content();
        
        // 如果评分<7，重写
        if (extractScore(evaluation) < 7) {
            return chatClient.prompt()
                .user("根据评估反馈重写总结：\n评估：" + evaluation + "\n原文：" + summary)
                .call().content();
        }
        
        return summary;
    }
}
```

---

## Q12: 你刚提到的任务规划能力具体一点，在Agent系统中怎么实现？

### 深度解答

任务规划在Agent系统中有**三种实现方式**：

**1. 基于Prompt的规划**：让LLM直接生成任务列表。最简单但最不稳定。

**2. 基于模板的规划**：预定义每种任务类型的步骤模板，运行时根据任务类型选择模板。稳定但不灵活。

**3. 基于状态机的规划**（推荐）：将任务步骤建模为状态机，每个状态有明确的前置条件和后置动作。兼具灵活性和可控性。

```java
// 基于状态机的任务规划
@Configuration
@EnableStateMachineFactory
public class SummaryTaskPlanner 
        extends EnumStateMachineConfigurerAdapter<TaskState, TaskEvent> {
    
    @Override
    public void configure(StateMachineStateConfigurer<TaskState, TaskEvent> states) {
        states.withStates()
            .initial(TaskState.PLANNING)
            .states(EnumSet.allOf(TaskState.class))
            .end(TaskState.COMPLETED);
    }
    
    @Override
    public void configure(StateMachineTransitionConfigurer<TaskState, TaskEvent> transitions) {
        transitions
            // 规划 → 检索
            .withExternal().source(TaskState.PLANNING).target(TaskState.SEARCHING)
                .event(TaskEvent.PLAN_READY)
            // 检索 → 提取
            .and().withExternal().source(TaskState.SEARCHING).target(TaskState.EXTRACTING)
                .event(TaskEvent.DOCS_FOUND)
            // 提取 → 撰写
            .and().withExternal().source(TaskState.EXTRACTING).target(TaskState.WRITING)
                .event(TaskEvent.KEYPOINTS_EXTRACTED)
            // 撰写 → 校验
            .and().withExternal().source(TaskState.WRITING).target(TaskState.VALIDATING)
                .event(TaskEvent.DRAFT_DONE)
            // 校验 → 完成（通过）
            .and().withExternal().source(TaskState.VALIDATING).target(TaskState.COMPLETED)
                .event(TaskEvent.VALIDATION_PASSED)
            // 校验 → 重写（不通过）
            .and().withExternal().source(TaskState.VALIDATING).target(TaskState.WRITING)
                .event(TaskEvent.VALIDATION_FAILED)
            // 检索不足 → 补充检索
            .and().withExternal().source(TaskState.EXTRACTING).target(TaskState.SEARCHING)
                .event(TaskEvent.INSUFFICIENT_INFO);
    }
}
```

**动态规划 vs 静态规划**：
- 静态：所有步骤预定义，按顺序执行。简单任务用这个。
- 动态：Agent在执行过程中根据中间结果调整后续步骤。复杂任务用这个。比如检索结果不够，动态增加"补充搜索"步骤。

---

## Q13: RAG系统中问答的交互，整体流程是咋样子的？

### 深度解答

```
用户输入
  │
  ▼
┌─────────────┐
│  意图识别     │  ← 判断是问答/闲聊/复杂任务
└──────┬──────┘
       │ 问答类
       ▼
┌─────────────┐
│  Query改写    │  ← 消除指代、补全上下文
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  混合检索     │  ← 向量检索 + BM25关键词检索
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Rerank精排   │  ← Cross-Encoder对检索结果重排序
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  上下文组装    │  ← System Prompt + 历史摘要 + 检索结果 + Query
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  LLM生成      │  ← 带检索结果作为上下文生成回答
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  后处理校验    │  ← 事实一致性检查、格式校验
└──────┬──────┘
       │
       ▼
  返回用户
```

**关键环节说明**：

1. **意图识别**：不是所有输入都要走RAG。闲聊直接LLM生成，API查询直接调接口，只有知识类问题才走RAG。
2. **Query改写**：用户说"它怎么样"，要结合历史改写为"XX产品怎么样"，否则检索结果不相关。
3. **混合检索**：向量检索捕捉语义相似性，BM25捕捉精确关键词匹配。两者互补。
4. **Rerank**：粗排用双塔模型（快），精排用Cross-Encoder（准但慢）。
5. **后处理校验**：检查生成的回答是否和检索结果一致，防止幻觉。

---

## Q14: RAG系统中召回几轮，假设用Agent模式实现多轮召回，应该怎么设计？

### 深度解答

**为什么需要多轮召回**：单轮检索可能不够——用户问题模糊、文档分散、一次检索没找到全部相关信息。

**Agent模式多轮召回设计**：

```
第一轮召回 → 判断是否充分 → 不充分 → Query改写/扩展 → 第二轮召回 → 判断 → ...
                                                  → 充分 → 生成回答
```

**关键设计**：

1. **充分性判断**：用LLM判断检索结果是否足够回答问题。不是简单看数量，而是看信息覆盖度。

2. **Query改写策略**：
   - 第一轮没找到 → 换个表述重新检索
   - 找到部分 → 追加限定词缩小范围
   - 找到矛盾信息 → 补充查询验证

3. **最大召回轮次限制**：防止无限循环，最多3轮。

4. **结果去重和融合**：多轮检索结果合并，去重后按相关性排序。

```java
// Agent模式多轮召回
@Service
public class MultiRoundRetriever {
    
    private final RAGService ragService;
    private final ChatClient chatClient;
    private static final int MAX_ROUNDS = 3;
    
    public RetrievalResult retrieve(String query) {
        Set<String> seenDocIds = new HashSet<>();
        List<RetrievedDoc> allDocs = new ArrayList<>();
        String currentQuery = query;
        
        for (int round = 1; round <= MAX_ROUNDS; round++) {
            // 1. 检索
            List<RetrievedDoc> docs = ragService.search(currentQuery, 10);
            
            // 2. 去重
            List<RetrievedDoc> newDocs = docs.stream()
                .filter(d -> seenDocIds.add(d.getId()))
                .toList();
            allDocs.addAll(newDocs);
            
            // 3. 充分性判断
            SufficiencyCheck check = chatClient.prompt()
                .user("""
                    基于以下检索结果，判断是否足以回答用户问题。
                    用户问题：%s
                    检索结果：%s
                    
                    输出JSON：{"sufficient": true/false, "missing_aspects": "...", "suggested_query": "..."}
                    """.formatted(query, allDocs))
                .call()
                .entity(SufficiencyCheck.class);
            
            if (check.isSufficient()) {
                return new RetrievalResult(allDocs, round, true);
            }
            
            // 4. 改写Query继续检索
            currentQuery = check.getSuggestedQuery();
        }
        
        // 超过最大轮次，返回已有结果
        return new RetrievalResult(allDocs, MAX_ROUNDS, false);
    }
}
```

---

## Q15: 假设想做的更好，有记忆模式，能自我进化，还需要加什么功能？

### 深度解答

从"能回答问题"到"能自我进化"，需要增加：

**1. 用户偏好记忆**：记住每个用户的偏好，下次回答自动适配
- "这个用户喜欢简洁回答"→ 回答自动压缩
- "这个用户常问技术类问题"→ 检索优先走技术文档

**2. 交互模式学习**：从历史交互中学习什么类型的回答用户满意度高
- 用户对某类回答频繁追问 → 说明这类回答不够好，需要改进
- 用户对某类回答频繁点赞 → 说明这类回答效果好

**3. Badcase自优化**：
- 检测到回答质量差 → 自动分析原因 → 调整检索策略/prompt
- 常见badcase → 加入评测集 → 防止回退

**4. 知识库自动更新**：
- 监控文档源变化 → 自动重新入库
- 检测到新文档 → 自动解析+chunk+embedding
- 过期文档自动标记deprecated

**5. 反馈闭环**：
```
用户反馈（点赞/踩/追问/离开）→ 分析原因 → 更新策略 → A/B测试 → 全量上线
```

```java
// 自进化RAG系统
@Service
public class EvolvableRAG {
    
    private final FeedbackStore feedbackStore;
    private final StrategyStore strategyStore;
    
    // 记录用户反馈
    public void recordFeedback(String sessionId, Feedback feedback) {
        feedbackStore.save(sessionId, feedback);
        
        // 实时调整：如果用户标记"回答不准确"，触发策略更新
        if (feedback.getType() == FeedbackType.INACCURATE) {
            StrategyAdjustment adj = analyzeBadCase(sessionId, feedback);
            strategyStore.saveAdjustment(adj);
        }
    }
    
    // 定期批量优化（每天凌晨跑）
    @Scheduled(cron = "0 0 3 * * ?")
    public void batchOptimize() {
        // 1. 分析昨日badcase
        List<BadCaseAnalysis> analyses = analyzeBadCases(LocalDate.now().minusDays(1));
        
        // 2. 调整检索策略（如增加某类文档的权重）
        for (BadCaseAnalysis analysis : analyses) {
            strategyStore.adjustRetrievalWeight(
                analysis.getDocType(), analysis.getWeightDelta());
        }
        
        // 3. 调整Prompt（如增加某个约束）
        // 4. A/B测试新策略
    }
    
    // 用户偏好自动提取
    public UserPreference extractPreference(String userId) {
        List<Interaction> history = feedbackStore.getUserHistory(userId);
        return chatClient.prompt()
            .user("从以下用户交互历史中提取用户偏好：\n" + history)
            .call()
            .entity(UserPreference.class);
    }
}
```

---

## Q16: 你刚提到可以记录个人偏好，那这个偏好信息怎么得到，偏好更新的触发机制是什么？

### 深度解答

**偏好信息怎么得到**——三种获取方式：

| 方式 | 信号 | 示例 |
|------|------|------|
| **显式反馈** | 用户直接告诉 | "我喜欢简洁的回答"、"下次不要那么详细" |
| **隐式行为** | 从交互行为推断 | 用户频繁追问=回答不够、快速离开=不满意、点赞=满意 |
| **LLM提取** | 从对话中自动提取 | 对话中提到"我是Java开发者"→ 偏好Java技术栈 |

**偏好更新触发机制**：

1. **实时触发**：用户显式表达偏好时，立即更新。比如用户说"用中文回答"，立即标记该用户偏好中文。

2. **会话结束触发**：每次会话结束后，用小模型分析对话，提取新偏好。增量更新，不覆盖已有偏好。

3. **定期刷新**：每周跑一次全量偏好分析，基于最近一个月的交互数据重新计算偏好权重。防止偏好过时。

4. **冲突检测**：新偏好和旧偏好冲突时（之前偏好详细回答，现在偏好简洁），以最近的为准，但保留历史偏好供参考。

```java
@Service
public class PreferenceManager {
    
    // 实时触发：显式偏好
    public void onExplicitPreference(String userId, String preference) {
        UserPref pref = preferenceStore.get(userId);
        pref.addPreference(preference, Instant.now());
        pref.setConfidence(preference, 1.0);  // 显式偏好置信度最高
        preferenceStore.save(userId, pref);
    }
    
    // 隐式行为推断
    public void inferFromBehavior(String userId, Interaction interaction) {
        if (interaction.getFollowUpCount() > 3) {
            // 频繁追问 → 回答可能不够详细
            updatePreference(userId, "response_detail", "detailed", 0.6);
        }
        if (interaction.getTimeToLeave() < 5) {
            // 快速离开 → 可能不满意
            updatePreference(userId, "satisfaction_signal", "negative", 0.4);
        }
    }
    
    // 会话结束触发：LLM提取
    public void onSessionEnd(String userId, List<Message> sessionMessages) {
        String extracted = chatClient.prompt()
            .user("""
                从以下对话中提取用户的偏好信息，输出JSON：
                {"preferences": [{"key": "语言偏好", "value": "中文", "confidence": 0.9}, ...]}
                
                对话内容：%s
                """.formatted(sessionMessages))
            .call().content();
        
        mergePreferences(userId, parsePreferences(extracted));
    }
    
    // 偏好过期：时间衰减
    public double getEffectiveWeight(String userId, String prefKey) {
        UserPref pref = preferenceStore.get(userId);
        PreferenceEntry entry = pref.getEntry(prefKey);
        long daysSinceUpdate = ChronoUnit.DAYS.between(entry.getLastUpdated(), Instant.now());
        return entry.getConfidence() * Math.exp(-0.05 * daysSinceUpdate);  // 半衰期约14天
    }
}
```

---

## Q17: 为什么用WebSocket，不用SSE？现在主流大模型都用的什么协议？why？

### 深度解答

**WebSocket vs SSE**：

| 维度 | WebSocket | SSE |
|------|-----------|-----|
| 通信模式 | 全双工（双向） | 单向（服务器→客户端） |
| 协议 | ws://独立协议 | 基于HTTP |
| 重连 | 需要手动实现 | 浏览器自动重连 |
| 连接开销 | 较高（需握手升级） | 较低（普通HTTP） |
| 服务器资源 | 每连接一个线程/fd | 轻量，可复用HTTP连接 |

**主流大模型API用的什么**：OpenAI、通义千问、Claude等**全部用SSE**。

**Why SSE**：
- LLM交互本质是**请求-响应模式**：客户端发请求，服务器流式返回token。不需要客户端在连接上主动发消息。
- WebSocket的全双工能力在LLM场景下浪费了——客户端发完请求后，就是等服务器推数据，和SSE完全一样。
- SSE基于HTTP，天然支持CDN缓存、负载均衡、防火墙穿透。WebSocket的ws://协议在很多企业网络中被阻断。

---

## Q18: 假设用户比较多，上万，会选择SSE还是WebSocket？

### 深度解答

上万并发场景，**选SSE**。

表面上看WebSocket是全双工更强，但实际上：

1. **LLM场景不需要全双工**：用户发完问题就是等回答，不需要和服务端双向通信。SSE的单向推送完全够用。

2. **SSE的HTTP/2多路复用**：SSE基于HTTP，可以利用HTTP/2的多路复用——一个TCP连接上跑多个SSE流。WebSocket每个连接独占一个TCP连接。1万用户，SSE可能只需要几百个TCP连接，WebSocket需要1万个。

3. **CDN和代理友好**：SSE走HTTP，可以经过任何HTTP代理和CDN。WebSocket经常被代理拦截或超时断开。

---

## Q19: 思考一下对服务器的压力，总结一下为什么都用SSE

### 深度解答

**服务器压力对比**：

| 压力维度 | WebSocket (1万连接) | SSE (1万连接) |
|----------|--------------------|--------------------|
| TCP连接数 | 10,000（每个连接独占） | ~1,000（HTTP/2多路复用） |
| 内存 | 每连接~64KB buffer = 640MB | 共享连接，~100MB |
| 文件描述符 | 10,000个fd | ~1,000个fd |
| 心跳维护 | 需要ping/pong保活 | HTTP keep-alive，浏览器自动 |
| 负载均衡 | 需要sticky session | 无状态，随便转发 |

**总结：为什么大模型API都用SSE**

1. **场景匹配**：LLM是"请求→流式响应"，SSE的半双工模式完美匹配
2. **资源效率**：相同并发量下，SSE的服务器资源消耗是WebSocket的1/5
3. **基础设施友好**：SSE基于HTTP，穿透代理/CDN/防火墙无障碍
4. **运维简单**：SSE无状态，扩缩容和负载均衡简单；WebSocket有状态，需要sticky session
5. **浏览器兼容**：SSE有原生EventSource API，自动重连；WebSocket断线需要手动重连逻辑

**唯一选WebSocket的场景**：需要在流式返回的同时，客户端还要往服务器发消息（比如实时协作编辑、语音通话）。纯粹的LLM流式输出，SSE永远是更好的选择。

---

## Q20: 二面结束到现在你学了啥？

### 答题思路

三面问这个问题，不是考知识点，而是看你的**学习自驱力**和**对之前不足的反思**。好的回答应该：1）说明你从二面中学到了什么 2）展示你主动补短板的行动 3）体现成长思维。

### 深度解答

回答思路（不是背答案，而是真实的学习经历）：

1. **二面暴露的短板**：比如对上下文管理理解不够深、对Agent范式了解不全面
2. **采取的行动**：看了XX论文/源码、实践了XX项目、总结了XX笔记
3. **收获**：具体掌握了什么新能力，和之前比有什么提升

---

## Q21: Open Claude有用过吗？你日常使用场景，Codex比通义零码好在哪？

### 深度解答

**日常使用场景**：
- **Claude**：复杂推理、长文档分析、架构设计讨论（200K上下文是杀手锏）
- **Codex**：项目级代码生成、多文件修改、运行测试验证（有终端执行能力）
- **通义零码**：简单的页面/组件生成、低代码场景

**Codex比通义零码好在哪**：
1. **完整开发闭环**：Codex能生成代码+运行+看结果+修bug，通义零码只能生成不能验证
2. **项目级理解**：Codex能读整个项目结构，理解代码间的依赖关系；通义零码更多是单文件生成
3. **Agent能力**：Codex本质上是个编码Agent，能自主决策下一步做什么；通义零码更像是增强的代码补全
4. **Harness能力**：Codex支持harness（测试套件集成），能在写代码的同时跑测试

---

## Q22: 你日常是如何使用Vibe Coding，如何保证他不会出错？

### 深度解答

**Vibe Coding流程**：

1. **写清楚需求**：用自然语言描述——输入、输出、边界条件、技术约束
2. **选择合适粒度**：不一次性让AI写整个模块，而是按功能点分步生成
3. **逐步验证**：每生成一段代码，立即编译+测试，通过后再生成下一段
4. **人工Review**：AI生成的代码必须人工过一遍，重点关注异常处理、边界条件、线程安全

**保证不出错的核心方法**：

1. **强约束Prompt**：在需求描述中加入硬性约束——"必须处理null"、"必须用try-with-resources"、"必须写单元测试"
2. **测试驱动**：先让AI写测试，再写实现。测试通过才算完成。
3. **静态分析**：SpotBugs/Checkstyle扫描AI生成的代码，捕获常见问题
4. **代码Review Checklist**：对AI生成的代码有专门的review清单——异常处理、资源释放、线程安全、SQL注入、硬编码

---

## Q23: 你刚提到了强约束，强约束的提示词咋写的？每次都写强约束吗？

### 深度解答

**强约束Prompt示例**：

```
请实现一个Java服务类，要求：

## 功能
- 根据用户ID查询订单列表
- 支持分页和排序

## 强约束（必须遵守）
1. 所有方法必须处理null输入，不允许NPE
2. 数据库访问必须用@Transactional(readOnly=true)标注只读方法
3. 必须使用try-with-resources管理流式资源
4. 不允许catch Exception后静默吞掉，必须记录日志或抛出
5. 分页参数必须校验（pageSize不超过100，pageNum从1开始）
6. 必须写单元测试，覆盖率≥80%

## 技术栈
- Spring Boot 3.2 + MyBatis-Plus
- 返回Result<Page<OrderVO>>格式
```

**不是每次都写全部强约束**：
- **简单脚本/工具类**：只写关键约束（null处理、异常处理）
- **业务逻辑**：写完整强约束（加事务、加校验、加测试）
- **核心模块**：强约束+安全约束（SQL注入防护、权限校验）

我们团队的做法是：**把强约束做成模板**，按代码类型（Controller/Service/Mapper/Util）预设不同的约束模板，Vibe Coding时选择对应模板，不用每次手写。

---

## Q24: Codex有没有harness的能力，有了解过吗？agent.md有理解过吗？

### 深度解答

**Harness能力**：Codex支持在沙箱环境中运行代码和测试，形成"写代码→运行测试→看结果→修代码"的闭环。

- Codex可以执行测试命令（如`mvn test`），根据测试失败信息自动修复代码
- 这就是harness——**测试套件作为AI编码的护栏**，确保生成的代码能通过测试

**agent.md**：这是Codex/CodeX的项目配置文件，类似于`.cursorrules`：

```markdown
# agent.md 示例

## 项目信息
- Java 17 + Spring Boot 3.2
- 构建工具：Maven
- 测试框架：JUnit 5 + Mockito

## 编码规范
- 使用Optional而非null返回值
- Controller不做业务逻辑，只做参数校验和路由
- Service层事务注解必须标注readOnly

## 测试要求
- 每个public方法必须有单元测试
- 测试命名：should_期望行为_when_条件
- Mock外部依赖，不Mock被测类自身方法

## 构建和验证
- 运行：mvn clean test
- 代码检查：mvn spotbugs:check
```

**agent.md的价值**：
- 让AI理解项目上下文和规范，生成的代码更符合项目风格
- 约束AI的行为边界——什么该做、什么不该做
- 比每次在Prompt里重复写约束高效得多

---

## Q25: 反问环节

面试官重点介绍：
- **新人培养机制**
- **通过后续安排**：HR面

---

## 面试特点总结

淘天三面的风格和携程、喜茶不同：

| 对比 | 携程 | 喜茶 | 淘天三面 |
|------|------|------|----------|
| 风格 | 架构设计挖深 | 项目落地拷打 | 追问式深挖+工程思考 |
| 特点 | "为什么这么设计" | "你做了什么改进" | "你刚提到XX，具体怎么实现" |
| 难点 | 取舍论证 | 真实数据支撑 | 被追问到细节底层 |

**核心洞察**：淘天面试官非常擅长追问——你提到一个概念，他会连续追问2-3层，直到你讲出具体实现或承认不了解。**不要抛出自己不熟悉的概念来显得懂**，一旦被追问就会露怯。
