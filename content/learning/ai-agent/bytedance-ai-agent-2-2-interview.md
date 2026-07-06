---
title: "字节跳动 AI Agent 三轮技术面拿下2-2"
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
summary: "字节跳动 AI Agent 三轮技术面拿下2-2"
tags:
---

# 字节跳动 AI Agent 三轮技术面拿下2-2

> **来源**: 小红书  
> **链接**: http://xhslink.com/o/82kwtWr7Fp4  
> **标签**: #字节跳动 #AI Agent #2-2 #面经  
> **日期**: 2026-05-14  
> **定级**: 2-2（字节高级研发）  
> **考点分类**: 多模态模型、ReAct工程化、Agent训练流程、RAG融合、Agent异常处理、Multi-Agent架构、MCP/A2A/Skills、上下文工程

---

## 面试感受

> 字节的面试官确实专业，问的问题都很深入，不是那种背八股文就能过的。一面基础打得牢，二面项目挖得深，三面系统设计视野要广。每个问题都直击工程落地的痛点，没点实战经验还真扛不住。不过准备充分的话，2-2应该问题不大。

---

## 一面 | 基础+Agent工程

### Q1. 自我介绍

### Q2. 项目介绍，重点介绍与AI Agent相关的项目经验

### Q3. 多模态大模型的具体结构是什么样的？请详细描述视觉编码器和语言模型的衔接方式

**考点**: 多模态模型架构、Vision-Language连接

**参考答案**:

多模态大模型的核心架构由三部分组成：**视觉编码器 → 投影层 → 语言模型**

```
图像输入 → Vision Encoder (ViT/CLIP) → Projection Layer (MLP/Q-Former) → LLM (Transformer)
```

**视觉编码器与LLM的衔接方式**：

| 方案 | 代表模型 | 原理 | 优缺点 |
|------|---------|------|--------|
| **线性投影(MLP)** | LLaVA | ViT输出直接过MLP映射到LLM词表空间 | 简单高效，但信息损失 |
| **Q-Former** | BLIP-2 | 可学习Query提取视觉特征，压缩到固定长度 | 更灵活，压缩冗余信息 |
| **交叉注意力** | Flamingo | LLM层间插入交叉注意力层，视觉特征做K/V | 效果好，但改动大 |
| **Adapter** | LLaMA-Adapter | 在LLM层间插入轻量Adapter注入视觉信息 | 参数少，训练快 |

**深度延伸 — Q-Former连接详解**:

```java
// Q-Former的核心思想：用N个可学习Query从ViT特征中"提问"
// 类比：ViT是一本书，Q-Former是读者根据自己的需求提取关键信息

// BLIP-2 Q-Former伪代码
public class QFormer {
    private final int numQueries; // 如32个Query
    private final List<CrossAttentionLayer> layers;
    
    /**
     * 输入: ViT输出的image_features (L×D, L是patch数)
     * 输出: 压缩后的visual_tokens (numQueries×D)
     * 
     * 32个Query从几百个patch特征中提取最相关的信息
     * 大幅减少传给LLM的token数量
     */
    public Tensor forward(Tensor imageFeatures) {
        Tensor queries = this.learnableQueries; // (32, D)
        for (CrossAttentionLayer layer : layers) {
            // Self-Attention: Query之间交互
            queries = layer.selfAttention(queries);
            // Cross-Attention: Query从image_features提取信息
            // Q=queries, K=V=imageFeatures
            queries = layer.crossAttention(
                queries, imageFeatures, imageFeatures
            );
            // FFN
            queries = layer.ffn(queries);
        }
        return queries; // (32, D) → 投影后传给LLM
    }
}
```

**工程踩坑**:
- ViT的分辨率限制：大多数ViT在224×224预训练，高分辨率图片需要切patch分别编码再合并
- 视觉token数量直接影响LLM推理成本：用Q-Former压缩到32个token比直接传576个patch高效
- 视觉编码器是否冻结：冻结ViT节省训练成本，但可能限制多模态对齐效果

---

### Q4. ReAct框架的工程实现细节，消息格式如何设计？tool_response应该用什么角色传回？为什么？

**考点**: ReAct循环、消息角色设计（重点题）

**参考答案**:

**ReAct消息格式设计**:

```
System: 你是一个AI助手，可以使用以下工具...

User: 帮我查一下北京的天气

Assistant: [Thought] 用户想知道北京天气，我需要调用天气查询工具
            [Action] call_weather(city="北京")

Tool: {"temperature": 25, "condition": "晴"}  ← tool_response

Assistant: [Observation] 北京今天25度，晴天
            [Thought] 我已经获取到天气信息，可以回答用户了
            [Answer] 北京今天天气晴朗，气温25度
```

**tool_response的角色问题**:

| 方案 | 角色名 | 优缺点 |
|------|--------|--------|
| OpenAI官方 | `tool` | 语义最清晰，专门角色 |
| 通用兼容 | `function` | 旧版API用法 |
| 自研框架 | `system`或`user` | 兼容性最好但语义不清晰 |

**为什么tool_response要用独立角色（tool/function）？**

1. **语义清晰**：区分"模型生成的内容"和"工具返回的结果"，避免模型混淆
2. **训练对齐**：如果SFT训练时tool_response用user角色，模型可能混淆用户输入和工具输出
3. **安全隔离**：工具返回可能包含敏感信息（SQL结果、日志），独立角色便于过滤脱敏
4. **对话管理**：计算上下文长度时可以单独处理tool消息的截断策略

**深度延伸 — Spring AI中的ReAct实现**:

```java
@Service
public class ReactAgentExecutor {
    
    private final ChatClient chatClient;
    private final ToolRegistry toolRegistry;
    private static final int MAX_ITERATIONS = 10;
    
    public String execute(String userMessage, List<String> availableTools) {
        List<Message> messages = new ArrayList<>();
        messages.add(new SystemMessage(buildSystemPrompt(availableTools)));
        messages.add(new UserMessage(userMessage));
        
        for (int i = 0; i < MAX_ITERATIONS; i++) {
            // 1. 模型思考 → 生成Action或Final Answer
            ChatResponse response = chatClient.prompt()
                .messages(messages)
                .call()
                .chatResponse();
            
            String content = response.getResult().getOutput().getText();
            messages.add(new AssistantMessage(content));
            
            // 2. 解析是否需要调用工具
            ToolCall toolCall = parseToolCall(content);
            if (toolCall == null) {
                return content; // 模型直接给出最终回答
            }
            
            // 3. 执行工具调用
            ToolExecutor executor = toolRegistry.getExecutor(toolCall.getName());
            String toolResult = executor.execute(toolCall.getArguments());
            
            // 4. 用ToolMessage角色传回结果（关键！）
            messages.add(new ToolMessage(toolResult, toolCall.getId()));
            
            // 5. 继续循环，模型基于工具结果继续推理
        }
        
        return "Agent reached max iterations";
    }
}
```

**工程踩坑**:
- tool_response太大时要截断或摘要，否则上下文窗口爆炸
- 工具返回异常时也要作为tool_message传回，让模型自己决定是否重试
- 多轮工具调用时，要保留完整的Thought-Action-Observation链条，不能只传最终结果

---

### Q5. Agentic CPT、SFT、RL三阶段训练流程分别是什么？为什么SFT时要mask observation tokens？

**考点**: Agent训练Pipeline（重点题）

**参考答案**:

**Agentic三阶段训练**:

| 阶段 | 全称 | 数据 | 目标 |
|------|------|------|------|
| **CPT** | Continual Pre-Training | 大量Agent交互轨迹数据 | 让基座模型学会Agent行为模式（工具调用格式、ReAct思维链） |
| **SFT** | Supervised Fine-Tuning | 高质量人工标注轨迹 | 学习"好的Agent行为"（正确决策、高效工具使用） |
| **RL** | Reinforcement Learning | 在线交互 + Reward Model | 优化长期收益（任务完成率、工具调用效率、用户满意度） |

**为什么SFT时要mask observation tokens？**

这是核心考点。在SFT训练时，**只有模型的输出部分（Thought + Action）计算loss，observation（工具返回的结果）部分mask掉不计算loss**。

原因：
1. **模型不应学习"预测工具返回"**：observation是外部工具产生的，不是模型自己生成的，模型无法控制工具返回什么
2. **避免分布偏移**：如果模型学习预测observation，训练时用的是真实工具返回，推理时模型自己生成的observation可能不同，导致分布偏移
3. **只强化决策能力**：SFT的目的是让模型学会"什么时候该调用什么工具"（决策），而不是"工具会返回什么"（预测）

```
训练样本:
User: 查北京天气
Assistant: [Thought]需要调用天气工具 ✓ 计算loss
           [Action] call_weather(city="北京") ✓ 计算loss
Tool: {"temp": 25} ✗ mask掉，不计算loss
Assistant: [Thought]获取到天气信息 ✓ 计算loss
           [Answer] 北京25度，晴天 ✓ 计算loss
```

**深度延伸 — RL阶段设计**:

```java
// Agent RL训练的Reward设计
public class AgentRewardModel {
    
    /**
     * 多维度Reward:
     * 1. 任务完成度: 最终回答是否解决了用户问题
     * 2. 工具调用效率: 是否用了最少次数的工具调用
     * 3. 格式正确性: 工具调用参数是否合法
     * 4. 幻觉惩罚: 是否编造了不存在的工具返回
     */
    public double computeReward(AgentTrajectory trajectory) {
        double taskReward = trajectory.isTaskCompleted() ? 1.0 : 0.0;
        double efficiencyReward = 1.0 / Math.sqrt(trajectory.getToolCallCount());
        double formatReward = trajectory.allToolCallsValid() ? 0.2 : -0.5;
        double hallucinationPenalty = trajectory.hasHallucination() ? -1.0 : 0.0;
        
        return taskReward * 0.6 + efficiencyReward * 0.2 
               + formatReward * 0.1 + hallucinationPenalty;
    }
}
```

---

### Q6. Redis在AI Agent系统中可能有哪些应用场景？如何设计缓存策略？

**考点**: Redis在Agent系统中的应用

**参考答案**:

| 场景 | Redis数据结构 | 说明 |
|------|-------------|------|
| 会话上下文 | String/Hash | 存储当前对话历史，支持断线恢复 |
| 工具调用结果缓存 | String + TTL | 相同参数的工具调用结果缓存，避免重复调用 |
| 用户画像 | Hash | 存储用户偏好、历史行为，个性化Agent回复 |
| 限流/配额 | String(INCR) + TTL | 限制用户每分钟Agent调用次数 |
| 任务状态 | Hash + TTL | Agent异步任务状态（pending/running/completed） |
| 分布式锁 | SETNX | 防止同一任务被重复触发 |

**缓存策略设计**:

```java
@Service
public class AgentCacheStrategy {
    
    /**
     * 工具调用结果缓存 — 根据工具特性设置不同TTL
     */
    public CacheConfig getToolCacheConfig(String toolName) {
        return switch (toolName) {
            // 天气查询：30分钟缓存（天气变化不频繁）
            case "weather" -> new CacheConfig(30, TimeUnit.MINUTES);
            // 股票查询：不缓存（实时数据）
            case "stock" -> new CacheConfig(0, TimeUnit.SECONDS);
            // 数据库查询：5分钟缓存
            case "db_query" -> new CacheConfig(5, TimeUnit.MINUTES);
            // 文档检索：1小时缓存（文档不常变）
            case "doc_search" -> new CacheConfig(1, TimeUnit.HOURS);
            default -> new CacheConfig(5, TimeUnit.MINUTES);
        };
    }
    
    /**
     * 对话上下文管理 — 滑动窗口 + 摘要压缩
     */
    public void cacheConversation(String sessionId, List<Message> messages) {
        String key = "agent:ctx:" + sessionId;
        
        // 超过窗口大小时，压缩早期消息
        if (messages.size() > MAX_WINDOW) {
            List<Message> recent = messages.subList(
                messages.size() - MAX_WINDOW, messages.size());
            String summary = summarizeHistory(
                messages.subList(0, messages.size() - MAX_WINDOW));
            redisTemplate.opsForValue().set(key, 
                new CachedContext(summary, recent), 30, TimeUnit.MINUTES);
        } else {
            redisTemplate.opsForValue().set(key, 
                new CachedContext(null, messages), 30, TimeUnit.MINUTES);
        }
    }
}
```

---

### Q7. MySQL索引在什么情况下会失效？LIKE模糊查询什么情况下会失效？

**考点**: 索引失效场景

**参考答案**:

**索引失效常见场景**:
1. 对索引列使用函数：`WHERE YEAR(create_time) = 2026`
2. 隐式类型转换：`WHERE varchar_col = 123`
3. 违反最左匹配：联合索引(a,b,c)，只查b或c
4. 范围查询后的列：`WHERE a = 1 AND b > 2 AND c = 3`（c不走索引）
5. `OR`条件中有无索引列：`WHERE indexed_col = 1 OR non_indexed_col = 2`
6. `NOT IN` / `NOT EXISTS` / `!=`（优化器可能选择全表扫描）

**LIKE失效规则**:
- `LIKE '张%'` → ✅ 走索引（前缀匹配）
- `LIKE '%张'` → ❌ 不走索引（左模糊）
- `LIKE '%张%'` → ❌ 不走索引（全模糊）
- `LIKE '张_三'` → ✅ 走索引（前缀+单字符通配）

---

### Q8. 消息队列在AI Agent系统中的作用是什么？为什么不直接通过数据库通信？

**考点**: MQ在Agent系统中的角色

**参考答案**:

**MQ在Agent系统中的作用**:
1. **异步解耦**: Agent任务可能耗时很长（多轮工具调用），MQ实现异步执行
2. **削峰填谷**: 大量用户同时触发Agent任务，MQ缓冲避免后端过载
3. **可靠投递**: Agent调用外部工具可能失败，MQ保证消息不丢失、可重试
4. **事件驱动**: 工具执行完成后通过MQ通知，而非轮询数据库

**为什么不直接用数据库通信？**

| 对比 | 消息队列 | 数据库轮询 |
|------|---------|-----------|
| 实时性 | 毫秒级推送 | 轮询间隔决定（秒级） |
| 性能 | 事件驱动，无无效查询 | 大量无效SELECT |
| 可靠性 | ACK机制 + 重试 | 需要自己实现 |
| 耦合度 | 生产者消费者解耦 | 强耦合（共享表结构） |
| 扩展性 | 消费者水平扩展容易 | 轮询竞争需要加锁 |

---

### Q9. RAG流程中为什么要引入父子索引？BM25和向量检索如何融合？

**考点**: RAG高级优化（重点题）

**参考答案**:

**父子索引（Parent-Child Index）**:

问题：小chunk检索精准但信息碎片化，大chunk上下文完整但检索噪声大。

方案：**用小chunk做检索（child），命中后返回对应的大chunk（parent）**

```
文档 → 切成大chunk(parent) → 每个parent再切成小chunk(child)
       ↓                            ↓
    存parent内容                 存child向量 + parent_id

检索: query → 向量匹配child → 取parent_id → 返回parent全文
```

**深度延伸**:

```java
@Service
public class ParentChildRetriever {
    
    private final VectorStore childVectorStore;  // 子chunk向量库
    private final DocumentStore parentStore;     // 父chunk原文存储
    
    /**
     * 父子索引检索流程：
     * 1. 用小chunk做精准语义匹配
     * 2. 命中后取对应的大chunk，提供完整上下文
     */
    public List<Document> retrieve(String query, int topK) {
        // Step 1: 在子chunk向量库中检索
        List<SearchResult> childResults = childVectorStore.similaritySearch(
            query, topK * 2); // 多检索一些，去重后取topK
        
        // Step 2: 去重 — 多个child可能属于同一个parent
        Set<String> parentIds = childResults.stream()
            .map(r -> r.getMetadata().get("parent_id"))
            .collect(Collectors.toCollection(
                () -> new LinkedHashSet<>())); // 保持顺序
        
        // Step 3: 取parent全文
        List<Document> parentDocs = parentIds.stream()
            .limit(topK)
            .map(parentStore::get)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
        
        return parentDocs;
    }
}
```

**BM25和向量检索融合（Hybrid Search）**:

| 方式 | BM25（稀疏检索） | 向量检索（稠密检索） |
|------|-----------------|-------------------|
| 擅长 | 关键词精确匹配、专业术语 | 语义相似、同义表达 |
| 弱点 | 无法理解同义词 | 可能忽略关键词精确匹配 |
| 适用 | "Java HashMap" 精确查询 | "怎么解决并发问题" 语义查询 |

**融合策略 — Reciprocal Rank Fusion (RRF)**:

```java
public List<Document> hybridSearch(String query, int topK) {
    // 1. 分别检索
    List<RankedDoc> bm25Results = bm25Searcher.search(query, topK * 2);
    List<RankedDoc> vectorResults = vectorSearcher.search(query, topK * 2);
    
    // 2. RRF融合：score = Σ 1/(k + rank_i)
    Map<String, Double> fusedScores = new HashMap<>();
    int k = 60; // RRF常数
    
    for (int i = 0; i < bm25Results.size(); i++) {
        String docId = bm25Results.get(i).getId();
        fusedScores.merge(docId, 1.0 / (k + i + 1), Double::sum);
    }
    for (int i = 0; i < vectorResults.size(); i++) {
        String docId = vectorResults.get(i).getId();
        fusedScores.merge(docId, 1.0 / (k + i + 1), Double::sum);
    }
    
    // 3. 按融合分数排序
    return fusedScores.entrySet().stream()
        .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
        .limit(topK)
        .map(e -> parentStore.get(e.getKey()))
        .collect(Collectors.toList());
}
```

**工程踩坑**:
- BM25和向量检索的权重需要根据场景调整：专业文档类偏BM25，问答类偏向量
- RRF比简单分数相加更鲁棒，不受原始分数尺度影响
- 父子索引的chunk_size比例：parent 512-1024 tokens, child 128-256 tokens

---

### Q10. Agent的记忆机制怎么设计？短期记忆和长期记忆分别如何实现？

**考点**: Agent Memory设计（高频题）

**参考答案**:

| 层级 | 存储 | 内容 | 生命周期 |
|------|------|------|---------|
| **短期记忆** | 对话上下文（内存/Redis） | 当前对话的历史消息 | 会话结束清理 |
| **工作记忆** | 滑动窗口/摘要 | 最近N轮的压缩摘要 | 会话内持久 |
| **长期记忆** | 向量数据库 | 跨会话的用户偏好、知识 | 永久存储 |

**深度延伸**:

```java
@Service
public class AgentMemoryManager {
    
    private final RedisTemplate<String, Object> redis;
    private final VectorStore longTermMemory;
    private final ChatClient summarizer;
    
    /**
     * 短期记忆 — 直接存对话历史
     */
    public void saveShortTerm(String sessionId, List<Message> messages) {
        redis.opsForValue().set("memory:short:" + sessionId, 
            messages, 30, TimeUnit.MINUTES);
    }
    
    /**
     * 工作记忆 — 超出窗口时动态摘要压缩
     */
    public List<Message> getWorkingMemory(String sessionId, int windowSize) {
        List<Message> all = getShortTerm(sessionId);
        if (all.size() <= windowSize) return all;
        
        // 早期消息生成摘要
        List<Message> oldMessages = all.subList(0, all.size() - windowSize);
        String summary = summarizer.prompt()
            .user("请总结以下对话的关键信息：\n" + formatMessages(oldMessages))
            .call().content();
        
        List<Message> recent = all.subList(all.size() - windowSize, all.size());
        List<Message> result = new ArrayList<>();
        result.add(new SystemMessage("之前的对话摘要：" + summary));
        result.addAll(recent);
        return result;
    }
    
    /**
     * 长期记忆 — 用户偏好和重要信息写入向量库
     */
    public void saveLongTerm(String userId, String keyInfo) {
        longTermMemory.add(List.of(
            new Document(keyInfo, Map.of(
                "userId", userId,
                "timestamp", Instant.now().toString(),
                "type", "preference"  // preference / fact / decision
            ))
        ));
    }
    
    /**
     * 检索长期记忆 — 根据当前对话内容召回相关记忆
     */
    public List<String> retrieveLongTerm(String userId, String currentQuery) {
        return longTermMemory.similaritySearch(
                SimilaritySearchRequest.builder()
                    .query(currentQuery)
                    .topK(5)
                    .filterExpression("userId == '" + userId + "'")
                    .build())
            .stream()
            .map(Document::getContent)
            .collect(Collectors.toList());
    }
}
```

---

### Q11. 上下文超出限制时如何处理？滑动窗口和动态摘要的区别是什么？

**考点**: 上下文窗口管理

**参考答案**:

| 策略 | 滑动窗口 | 动态摘要 |
|------|---------|---------|
| 原理 | 保留最近N条消息，丢弃更早的 | 将早期消息压缩成摘要，保留关键信息 |
| 信息保留 | 完整保留近期对话 | 保留所有对话的"精华" |
| Token消耗 | 固定（N条消息的token数） | 较少（摘要通常很短） |
| 缺点 | 丢失早期重要信息 | 摘要可能遗漏细节；多次摘要会"失真" |
| 适用 | 短对话、精确引用 | 长对话、需要上下文延续 |

**最佳实践：滑动窗口 + 动态摘要组合**

```java
// 策略：最近K轮保持原文 + 更早的对话压缩为摘要
// 这样既有近期的精确引用，又有全局的上下文感知
```

### 一面编程题: 反转链表 (LeetCode 206)

```java
class Solution {
    // 迭代法
    public ListNode reverseList(ListNode head) {
        ListNode prev = null, curr = head;
        while (curr != null) {
            ListNode next = curr.next;
            curr.next = prev;
            prev = curr;
            curr = next;
        }
        return prev;
    }
    
    // 递归法
    public ListNode reverseListRecursive(ListNode head) {
        if (head == null || head.next == null) return head;
        ListNode newHead = reverseListRecursive(head.next);
        head.next.next = head;
        head.next = null;
        return newHead;
    }
}
```

---

## 二面 | 项目深挖+异常处理

### Q1. 自我介绍

### Q2. 详细描述你最近参与的AI Agent项目，包括架构设计和技术选型

### Q3. 你的Agent如果出现死循环怎么办？异常处理机制如何设计？

**考点**: Agent鲁棒性（重点题）

**参考答案**:

**死循环防护**:

```java
@Service
public class AgentLoopGuard {
    
    private static final int MAX_ITERATIONS = 10;   // 最大循环次数
    private static final int MAX_TOOL_CALLS = 15;    // 最大工具调用次数
    private static final int MAX_TOKENS = 8000;      // 最大token消耗
    private static final int MAX_TIME_SECONDS = 120; // 最大执行时间
    
    /**
     * 多维度终止条件：
     * 1. 循环次数上限
     * 2. 工具调用次数上限
     * 3. Token消耗上限
     * 4. 执行时间上限
     * 5. 检测重复工具调用（连续3次相同调用=死循环）
     */
    public LoopCheckResult check(AgentExecutionContext ctx) {
        if (ctx.getIteration() >= MAX_ITERATIONS) {
            return LoopCheckResult.terminate("超过最大循环次数，降级为建议模式");
        }
        if (ctx.getToolCallCount() >= MAX_TOOL_CALLS) {
            return LoopCheckResult.terminate("工具调用次数超限");
        }
        if (ctx.getTotalTokens() >= MAX_TOKENS) {
            return LoopCheckResult.terminate("Token消耗超限");
        }
        if (ctx.getElapsedTime() >= MAX_TIME_SECONDS) {
            return LoopCheckResult.terminate("执行超时");
        }
        if (ctx.hasRepeatedToolCall(3)) {
            return LoopCheckResult.terminate("检测到重复工具调用，疑似死循环");
        }
        return LoopCheckResult.continueLoop();
    }
    
    /**
     * 降级策略：超限时不是直接报错，而是降级
     */
    public String gracefulDegradation(AgentExecutionContext ctx, String reason) {
        // 策略1: 降级为Suggestion模式（只给建议，不自动执行）
        // 策略2: 返回已有部分结果 + 说明未完成
        // 策略3: 引导用户补充信息或简化需求
        return "由于" + reason + "，我无法完成全部任务。" +
               "以下是我目前的分析结果：" + ctx.getPartialResult() +
               "\n建议您可以：1) 简化需求 2) 分步执行 3) 补充更多信息";
    }
}
```

**异常处理机制**:

| 异常类型 | 处理策略 |
|---------|---------|
| 工具调用超时 | 重试1-2次 → 降级或跳过 |
| 工具返回格式错误 | 让模型根据错误信息重试 |
| 模型输出非法工具调用 | 解析失败 → 提示模型重新输出 |
| 上下文超限 | 动态摘要压缩 |
| 关键数据误删 | 事前确认 + 操作回滚 |

---

### Q4. 工具库有上百个工具时，如何让模型快速准确地选择工具？

**考点**: 大规模工具选择优化

**参考答案**:

| 方案 | 原理 | 适用规模 |
|------|------|---------|
| **工具检索（RAG）** | 根据用户query先检索top-K相关工具描述，再让模型从候选中选择 | 100+工具 |
| **分层路由** | 先分类（数据查询/文件操作/代码执行），再在子类中选择 | 50+工具 |
| **工具摘要** | 不传完整工具描述，只传摘要+示例，减少token | Token敏感场景 |
| **微调模型** | 在工具选择任务上微调小模型做路由 | 超大规模 |

**深度延伸 — 两阶段工具检索**:

```java
@Service
public class ToolRetrievalService {
    
    private final VectorStore toolEmbeddingStore; // 工具描述向量库
    
    /**
     * 两阶段工具选择：
     * 1. 粗筛：向量检索top-20相关工具
     * 2. 精选：把候选工具描述给LLM，让它选top-5
     */
    public List<ToolDefinition> selectTools(String userQuery, int selectCount) {
        // Phase 1: 向量检索粗筛
        List<ToolDefinition> candidates = toolEmbeddingStore
            .similaritySearch(userQuery, 20);
        
        // Phase 2: LLM精选
        String prompt = """
            用户需求: %s
            候选工具列表:
            %s
            
            请从中选择最相关的%d个工具，按相关性排序，返回工具名称列表。
            """.formatted(userQuery, 
                formatToolList(candidates), selectCount);
        
        List<String> selectedNames = chatClient.prompt()
            .user(prompt).call()
            .entity(new ParameterizedTypeReference<List<String>>() {});
        
        return candidates.stream()
            .filter(t -> selectedNames.contains(t.getName()))
            .collect(Collectors.toList());
    }
}
```

---

### Q5. Agent执行过程中遇到工具调用失败（如支付接口超时）如何处理？

**参考答案**:

```java
/**
 * 工具调用失败处理策略：
 * 1. 可重试的错误（超时、限流）→ 重试（指数退避）
 * 2. 不可重试的错误（参数错误、权限不足）→ 告知模型，让它换策略
 * 3. 关键操作失败（支付、删除）→ 终止执行，通知人工
 */
public ToolResult handleToolCall(ToolCall call) {
    int maxRetry = call.isCritical() ? 1 : 3; // 关键操作不重试
    
    for (int attempt = 0; attempt <= maxRetry; attempt++) {
        try {
            return toolExecutor.execute(call);
        } catch (TimeoutException e) {
            if (attempt < maxRetry) {
                Thread.sleep((long) Math.pow(2, attempt) * 1000); // 指数退避
            }
        } catch (PermissionDeniedException e) {
            // 不可重试，返回错误信息让模型调整策略
            return ToolResult.error("权限不足: " + e.getMessage());
        }
    }
    
    if (call.isCritical()) {
        alertService.notifyHuman("关键操作失败: " + call); // 人工介入
    }
    return ToolResult.error("工具调用失败，已重试" + maxRetry + "次");
}
```

---

### Q6. 长上下文对话中，如何让Agent不忘记关键信息？除了向量检索还有什么方法？

**参考答案**:

| 方法 | 原理 | 优缺点 |
|------|------|--------|
| **向量检索** | 相关信息存向量库，按需召回 | 主流方案，但检索可能不精准 |
| **摘要+关键信息提取** | 每轮对话后提取关键实体/决策，固定保留 | 信息密度高，但需要额外LLM调用 |
| **Working Memory** | 维护一个结构化的"当前状态表" | 精确，适合任务型对话 |
| **Scratchpad** | Agent主动写笔记到固定区域 | 模型自主管理，但依赖模型能力 |

**Working Memory方案**:

```java
// 结构化工作记忆 — 比纯摘要更精确
public class WorkingMemory {
    private Map<String, Object> state = new HashMap<>();
    // state: {"current_task": "订酒店", "destination": "北京", 
    //         "date": "5月20日", "budget": "500", "confirmed": false}
    
    // 每轮对话后更新，作为System Prompt的一部分注入
    public String toSystemPrompt() {
        return "当前任务状态:\n" + state.entrySet().stream()
            .map(e -> "- " + e.getKey() + ": " + e.getValue())
            .collect(Collectors.joining("\n"));
    }
}
```

---

### Q7. Tree of Thoughts在线上系统中能用吗？如何平衡成本和效果？

**参考答案**:

Tree of Thoughts (ToT) 让模型探索多条推理路径再选最优，效果好但成本高（N倍推理次数）。

**线上使用的平衡策略**:
1. **分层应用**: 简单问题用CoT，复杂问题才用ToT
2. **广度限制**: 每步只展开2-3个分支（而非5+）
3. **深度限制**: 最多3层
4. **小模型评估**: 用小模型做分支评估/剪枝，大模型只做最终生成
5. **缓存热门路径**: 用户常问的问题，预计算最优路径并缓存

---

### Q8. 如果Agent的决策出错导致数据误删，系统设计上如何防范？

**考点**: Agent安全设计（重点题）

**参考答案**:

**四层防护**:

| 层级 | 策略 | 实现 |
|------|------|------|
| **1. 事前审批** | 高危操作前必须人类确认 | 删除/支付/发送等操作弹出确认 |
| **2. 权限最小化** | Agent只能访问必要的数据和操作 | 工具权限按角色配置 |
| **3. 操作可逆** | 逻辑删除而非物理删除 | deleted_at字段 + 回收站 |
| **4. 审计追踪** | 全量记录Agent的操作日志 | who/when/what/before/after |

```java
@Service
public class SafeToolExecutor {
    
    private static final Set<String> DANGEROUS_OPERATIONS = 
        Set.of("delete", "drop", "update_critical", "payment");
    
    public ToolResult execute(ToolCall call) {
        // 1. 危险操作必须人类审批
        if (DANGEROUS_OPERATIONS.contains(call.getAction())) {
            ApprovalRequest req = approvalService.requestApproval(call);
            if (!req.isApproved()) {
                return ToolResult.error("操作被拒绝: " + req.getReason());
            }
        }
        
        // 2. 逻辑删除而非物理删除
        if ("delete".equals(call.getAction())) {
            return softDelete(call); // UPDATE SET deleted_at = NOW()
        }
        
        // 3. 记录审计日志
        auditService.log(AuditEntry.builder()
            .agentId(call.getAgentId())
            .operation(call.getAction())
            .target(call.getTarget())
            .beforeSnapshot(getCurrentState(call.getTarget()))
            .build());
        
        return toolExecutor.execute(call);
    }
}
```

---

### Q9. 用户提出模糊需求如"按老样子帮我订一下"，Agent如何处理？

**参考答案**:

1. **检索历史记忆**: 从长期记忆中查找该用户的"老样子"偏好
2. **澄清确认**: 找不到时主动追问（"您说的老样子是指上次订的那个酒店吗？"）
3. **预设模板**: 常见场景有默认模板，模糊指令映射到模板
4. **渐进式明确**: 先执行可确定的部分，不确定的部分逐项确认

---

### Q10. 如何量化评估一个上线的Agent好坏？除了准确率还有哪些指标？

**考点**: Agent评估体系

**参考答案**:

| 维度 | 指标 | 说明 |
|------|------|------|
| **效果** | 任务完成率 | 最终是否解决了用户问题 |
| **效率** | 平均工具调用次数 | 越少越好 |
| **效率** | 平均响应时间 | 端到端耗时 |
| **成本** | 平均Token消耗 | 直接影响成本 |
| **鲁棒性** | 异常恢复率 | 出错后能否自修复 |
| **用户感知** | 点赞率/点踩率 | 用户主观评价 |
| **安全** | 误操作率 | 不该执行的操作被执行 |
| **稳定性** | P99延迟 | 长尾延迟 |

### Q11. Kafka在AI Agent系统中可能用于哪些场景？如何保证消息顺序性？

**参考答案**:

**Kafka在Agent系统中的应用**:
1. **Agent任务队列**: 用户请求 → Kafka → Agent Worker消费
2. **工具调用事件流**: 工具执行结果通过Kafka传递
3. **对话日志采集**: 全链路日志写入Kafka → 下游实时分析
4. **模型推理请求分发**: 多模型部署时，Kafka做负载均衡

**消息顺序性保证**:
- **相同key的消息发到同一Partition**: 用 `sessionId` 或 `taskId` 做key
- **单Partition内有序**: Kafka保证同一Partition内消息顺序
- **消费端单线程消费**: 每个Partition对应一个消费者线程

### Q12. Elasticsearch在RAG系统中的作用是什么？如何优化检索性能？

**参考答案**:

**ES在RAG中的角色**: BM25关键词检索引擎，与向量检索做Hybrid Search

**性能优化**:
1. **合理设计mapping**: keyword类型不分词，text类型选合适分词器
2. **冷热分离**: 热数据SSD，冷数据HDD
3. **分片策略**: 按数据量规划主分片数，避免过多小分片
4. **使用filter而非query**: filter利用缓存，不计算评分
5. **批量操作**: 用Bulk API替代单条写入

### 二面编程题: 计算二叉树最大宽度 (LeetCode 662)

```java
class Solution {
    public int widthOfBinaryTree(TreeNode root) {
        if (root == null) return 0;
        
        int maxWidth = 0;
        Queue<Pair<TreeNode, Integer>> queue = new LinkedList<>();
        queue.offer(new Pair<>(root, 0));
        
        while (!queue.isEmpty()) {
            int size = queue.size();
            int start = queue.peek().getValue(); // 本层最左节点的编号
            int end = start;
            
            for (int i = 0; i < size; i++) {
                Pair<TreeNode, Integer> pair = queue.poll();
                TreeNode node = pair.getKey();
                int idx = pair.getValue();
                end = idx; // 更新到本层最右
                
                if (node.left != null) 
                    queue.offer(new Pair<>(node.left, 2 * idx));
                if (node.right != null) 
                    queue.offer(new Pair<>(node.right, 2 * idx + 1));
            }
            
            maxWidth = Math.max(maxWidth, end - start + 1);
        }
        
        return maxWidth;
    }
}
// BFS层序遍历 + 节点编号，时间O(n)，空间O(n)
```

---

## 三面 | 架构+视野+软素质

### Q1. 自我介绍

### Q2. 从架构角度分析Tools、Workflow和Agent三者的本质区别

**考点**: Agent架构认知（重点题）

**参考答案**:

| 维度 | Tools | Workflow | Agent |
|------|-------|----------|-------|
| **决策方式** | 人工决定调用 | 预定义DAG流程 | 模型自主决策 |
| **灵活性** | 低（固定API） | 中（流程可编排） | 高（动态规划） |
| **可控性** | 高 | 高 | 低（不确定性） |
| **适用场景** | 单一能力调用 | 流程确定的任务 | 开放式复杂任务 |
| **代表** | Function Call | Dify/Coze工作流 | ReAct/AutoGPT |

**本质区别**:

- **Tools**: 被动的能力单元，没有自主性。"做什么"由外部决定
- **Workflow**: 预设的编排逻辑，确定性执行。"怎么做"提前定义好
- **Agent**: 自主的决策实体，根据环境动态规划。"做什么+怎么做"都自己决定

**工程实践中的取舍**:
- 流程明确的任务（审批流、ETL）→ Workflow
- 需要灵活决策的任务（排查问题、写代码）→ Agent
- 实际系统中往往是混合: **Workflow编排 + Agent处理复杂节点**

---

### Q3. Multi-Agent系统如何设计三层架构？Agent之间如何通信？

**考点**: Multi-Agent架构设计（重点题）

**参考答案**:

**三层架构**:

```
┌─────────────────────────────────────┐
│  编排层 (Orchestrator)              │  任务拆分、Agent调度、结果汇总
├─────────────────────────────────────┤
│  Agent层 (Specialized Agents)       │  代码Agent / 检索Agent / 测试Agent
├─────────────────────────────────────┤
│  基础设施层 (Infrastructure)        │  消息总线 / 共享记忆 / 工具库
└─────────────────────────────────────┘
```

**Agent通信方式**:

| 方式 | 机制 | 适用场景 |
|------|------|---------|
| **消息总线** | 发布/订阅，异步解耦 | Agent数量多、松耦合 |
| **共享黑板** | 读写共享状态空间 | 需要共享上下文的协作 |
| **直接调用** | Agent间RPC/HTTP调用 | 紧耦合、简单场景 |
| **自然语言** | Agent间用自然语言沟通 | 研究方向，效率低 |

**深度延伸 — 基于消息总线的Multi-Agent**:

```java
@Service
public class MultiAgentOrchestrator {
    
    private final MessageBus messageBus;
    private final Map<String, Agent> agents;
    
    /**
     * 示例：代码开发任务
     * 1. Planner拆分任务
     * 2. Coder写代码
     * 3. Reviewer审查
     * 4. Tester测试
     */
    public TaskResult execute(String task) {
        String taskId = UUID.randomUUID().toString();
        
        // Planner拆分任务
        Plan plan = agents.get("planner").execute(task);
        
        // 并行执行子任务
        List<CompletableFuture<SubResult>> futures = plan.getSubTasks().stream()
            .map(subTask -> CompletableFuture.supplyAsync(() -> {
                String agentName = subTask.getAssignedAgent();
                return agents.get(agentName).execute(subTask);
            }))
            .toList();
        
        // 汇总结果
        List<SubResult> results = futures.stream()
            .map(CompletableFuture::join)
            .toList();
        
        return agents.get("aggregator").aggregate(results);
    }
}
```

---

### Q4. 当前阻碍Agent大规模落地的最大挑战是什么？如何解决可控性和能力的平衡问题？

**参考答案**:

**最大挑战**: **可控性与能力的矛盾**

- 能力越强的Agent越不可控（自主决策=不可预测）
- 可控的Agent能力有限（Workflow=死板）

**平衡方案**:

| 策略 | 做法 |
|------|------|
| **Human-in-the-loop** | 关键决策点人类审批 |
| **分级自治** | 简单操作自动执行，复杂操作需确认 |
| **沙箱执行** | Agent在隔离环境中执行，结果确认后才生效 |
| **护栏（Guardrails）** | 输入/输出层加规则过滤，防止越界 |
| **可观测性** | 全链路追踪，出问题能快速定位 |

---

### Q5. MCP、A2A、Skills和Function Call分别是什么？它们之间有什么区别？

**考点**: Agent协议生态（重点题）

**参考答案**:

| 协议 | 全称 | 定位 | 提出方 |
|------|------|------|--------|
| **Function Call** | 函数调用 | 模型调用工具的标准接口 | OpenAI |
| **MCP** | Model Context Protocol | 标准化模型与外部数据/工具的连接协议 | Anthropic |
| **A2A** | Agent-to-Agent | Agent之间的通信协议 | Google |
| **Skills** | 技能包 | 预定义的Agent能力模板 | 社区/自研 |

**区别与关系**:

```
Function Call: 模型 → 调用单个工具（原子操作）
MCP: 模型 ↔ 工具服务器（标准化的工具注册+调用协议）
A2A: Agent ↔ Agent（多Agent协作协议）
Skills: 预打包的"工具+Prompt+流程"（可复用的能力模板）

关系: Skills可能包含多个Function Call;
      MCP提供工具给Agent使用;
      A2A让多个Agent协作;
      底层都依赖Function Call机制
```

---

### Q6. Agent的上下文工程有哪些主流技术？如何设计有效的上下文管理策略？

**考点**: 上下文工程（Context Engineering）

**参考答案**:

| 技术 | 原理 | 适用场景 |
|------|------|---------|
| **RAG** | 检索相关文档注入上下文 | 知识密集型任务 |
| **Sliding Window** | 保留最近N轮对话 | 短对话 |
| **Summary** | 压缩历史对话为摘要 | 长对话 |
| **Scratchpad** | Agent主动记录中间结果 | 多步推理 |
| **Few-shot** | 注入示例引导模型格式 | 格式要求严格的输出 |
| **System Prompt分层** | 固定指令 + 动态上下文分离 | 通用 |

**上下文管理策略**:

```java
public class ContextEngineering {
    
    /**
     * 上下文组装优先级（从高到低）:
     * 1. System Prompt（不可压缩，必须保留）
     * 2. 当前用户问题（不可压缩）
     * 3. Working Memory/关键状态（尽量保留）
     * 4. RAG检索结果（按相关性截断）
     * 5. 对话历史（最早的最先压缩/丢弃）
     */
    public String assembleContext(AgentRequest request, int maxTokens) {
        StringBuilder ctx = new StringBuilder();
        int remaining = maxTokens;
        
        // 1. System Prompt
        ctx.append(request.getSystemPrompt());
        remaining -= estimateTokens(request.getSystemPrompt());
        
        // 2. 当前问题
        ctx.append(request.getUserQuery());
        remaining -= estimateTokens(request.getUserQuery());
        
        // 3. Working Memory
        String memory = workingMemory.toPrompt();
        if (estimateTokens(memory) <= remaining) {
            ctx.append(memory);
            remaining -= estimateTokens(memory);
        }
        
        // 4. RAG检索结果
        List<String> ragResults = retriever.search(request.getUserQuery(), 5);
        for (String result : ragResults) {
            if (estimateTokens(result) <= remaining) {
                ctx.append(result);
                remaining -= estimateTokens(result);
            } else break;
        }
        
        // 5. 对话历史（从最近开始填充）
        List<Message> history = request.getHistory();
        for (int i = history.size() - 1; i >= 0 && remaining > 0; i--) {
            String msg = formatMessage(history.get(i));
            if (estimateTokens(msg) <= remaining) {
                ctx.insert(ctx.indexOf("HISTORY_MARKER"), msg);
                remaining -= estimateTokens(msg);
            } else {
                // 压缩为摘要
                String summary = summarize(msg);
                ctx.insert(ctx.indexOf("HISTORY_MARKER"), "[摘要]" + summary);
                remaining -= estimateTokens(summary);
            }
        }
        
        return ctx.toString();
    }
}
```

---

### Q7-Q9. 软素质题

**Q7. 在团队中如何推动AI Agent项目的技术选型和架构演进？**
- 用POC证明技术可行性 → 数据说话 → 逐步推进

**Q8. 当团队成员对技术方案有分歧时，你如何沟通并达成共识？**
- 理解各方关注点 → 列出对比表格 → 用数据/实验验证 → 求同存异

**Q9. 如何保证复杂AI Agent项目的开发进度和质量？**
- 拆分里程碑 + 每周Demo + 自动化测试 + Code Review

### Q10-Q12. 学习与发展

**Q10. 最近在学习和研究哪些AI相关的新技术或论文？**
- 根据自身情况回答，建议关注：MCP生态、Multi-Agent框架、Agent评测benchmark

**Q11. 你是如何系统性地学习一门新技术的？**
- 官方文档入手 → 跑通Hello World → 读源码/论文 → 写博客沉淀 → 做项目实战

**Q12. 对于AI Agent领域的未来发展，你有什么看法和规划？**
- Agent从辅助工具→自主决策→多Agent协作演进，安全性和可控性是关键挑战

### 三面编程题: 生成括号组合 (LeetCode 22)

```java
class Solution {
    public List<String> generateParenthesis(int n) {
        List<String> result = new ArrayList<>();
        backtrack(result, new StringBuilder(), 0, 0, n);
        return result;
    }
    
    private void backtrack(List<String> result, StringBuilder current,
                           int open, int close, int max) {
        if (current.length() == max * 2) {
            result.add(current.toString());
            return;
        }
        
        if (open < max) {
            current.append('(');
            backtrack(result, current, open + 1, close, max);
            current.deleteCharAt(current.length() - 1);
        }
        if (close < open) { // 关键：右括号数量不能超过左括号
            current.append(')');
            backtrack(result, current, open, close + 1, max);
            current.deleteCharAt(current.length() - 1);
        }
    }
}
// 回溯法，时间O(4^n/√n)（Catalan数），空间O(n)
```

---

## HR面

| 问题 | 要点 |
|------|------|
| 为什么选择字节跳动？为什么对AI Agent方向感兴趣？ | 字节技术氛围 + Agent是AI落地核心方向 |
| 未来3-5年职业规划 | 技术深度 → 架构能力 → 技术影响力 |
| 之前工作最大的挑战？如何解决的？ | STAR法则，体现解决问题能力 |
| 期望的团队氛围和工作方式？ | 技术驱动、开放讨论、快速迭代 |
| 工作与生活的平衡？ | 专注效率，关键期全力投入 |
| 薪资期望？ | 2-2级别参考：北京50-70K×15薪 |
| 反问？ | 团队Agent产品方向、技术栈、团队规模 |

---

## 考点总览

| 轮次 | 类别 | 核心考点 |
|------|------|---------|
| **一面** | 基础+工程 | 多模态架构、ReAct消息设计、Agent训练三阶段、Redis应用、索引失效、MQ作用、RAG父子索引+Hybrid Search、记忆机制、上下文管理 |
| **二面** | 项目+异常 | Agent死循环防护、大规模工具选择、工具调用失败处理、长上下文记忆、ToT成本平衡、安全防护（数据误删）、模糊需求处理、评估指标、Kafka顺序性、ES优化 |
| **三面** | 架构+视野 | Tools/Workflow/Agent区别、Multi-Agent三层架构+通信、可控性vs能力、MCP/A2A/Skills/FC区别、上下文工程、软素质 |
| **编程** | 算法 | 反转链表、二叉树最大宽度、生成括号组合 |
