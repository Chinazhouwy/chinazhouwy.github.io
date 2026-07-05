# 腾讯AI Agent二面面经

> 📌 **来源**: 小红书 | **作者**: 顶尖耐面王～老帆 | **时间**: 2026年5月
> 🏷️ 标签: #互联网大厂 #面经 #大模型应用 #大模型应用开发 #java #春招 #后端开发
> 💬 互动: 8赞 | 43收藏 | 9分享

---

## 面试风格

> "难 难 难" — 27道题，覆盖Agent+RAG+后端+前沿协议，广度+深度双重碾压

---

## 一、Agent核心架构（5题）

### Q1: Agent的上下文你是怎么维护的？说下具体方案

**实际场景**: 做客服Agent时，用户聊了30轮，前面提到过"我订单号是A123"，第25轮问"这个订单发货了吗"，Agent得知道"这个订单"是哪个。

**深度回答**:

上下文维护不是简单地把历史消息全塞进prompt，而是分三层管理：

1. **工作记忆（Working Memory）**：当前对话窗口内的消息，直接放进prompt。比如最近5轮完整保留。
2. **会话摘要（Session Summary）**：超过窗口的历史用LLM压缩成摘要，保留关键实体和决策。
3. **长期记忆（Long-term Memory）**：跨会话的持久化信息，存向量库，按需检索注入。

**Spring AI实现**：

```java
// 1. 工作记忆：ChatMemory管理对话窗口
@Bean
public ChatClient chatClient(ChatClient.Builder builder, ChatMemory chatMemory) {
    return builder
        .defaultAdvisors(
            // 短期记忆：保留最近N轮对话
            MessageChatMemoryAdvisor.builder(chatMemory)
                .chatMemoryRetrieveSize(10)  // 最近5轮(10条消息)
                .build(),
            // 长期记忆：向量库检索相关历史
            VectorStoreChatMemoryAdvisor.builder(vectorStore)
                .topK(5)                     // 召回5条最相关历史
                .similarityThreshold(0.7)
                .build()
        )
        .build();
}

// 2. 会话摘要：自定义Advisor，token到达70%时异步压缩
public class SummaryAdvisor implements CallAroundAdvisor {
    private final ChatModel summaryModel;  // 用小模型做摘要，省成本
    private final RedisTemplate<String, String> redis;

    @Override
    public AdvisedResponse aroundCall(AdvisedRequest request, Chain chain) {
        int currentTokens = estimateTokens(request.messages());
        int windowLimit = getModelContextLimit();

        if (currentTokens > windowLimit * 0.7) {
            // 异步摘要：把窗口外的历史压缩
            String summary = summarizeHistory(request.messages());
            // 存入Redis，下次直接加载摘要
            redis.opsForValue().set("summary:" + request.sessionId(), summary);
        }
        return chain.nextAroundCall(request);
    }
}
```

```python
# Python对照（LangChain/LangGraph）
# 1. 工作记忆：ConversationBufferWindowMemory 保留最近N轮
from langchain.memory import ConversationBufferWindowMemory
from langchain.chains import ConversationChain

window_memory = ConversationBufferWindowMemory(
    k=5,  # 最近5轮对话
    return_messages=True
)

chain = ConversationChain(
    llm=llm,
    memory=window_memory
)

# 2. 长期记忆：VectorStoreRetrieverMemory 跨会话检索相关历史
from langchain.memory import VectorStoreRetrieverMemory
from langchain_community.vectorstores import Chroma

vectorstore = Chroma(embedding_function=embeddings, persist_directory="./chat_history")
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

long_term_memory = VectorStoreRetrieverMemory(retriever=retriever)

# 3. 会话摘要：ConversationSummaryMemory 自动压缩历史
from langchain.memory import ConversationSummaryMemory

summary_memory = ConversationSummaryMemory(
    llm=summary_llm,  # 用小模型做摘要，省成本
    return_messages=True
)

# 4. 组合使用：窗口记忆 + 摘要记忆（LangChain推荐方式）
from langchain.memory import ConversationSummaryBufferMemory

combined_memory = ConversationSummaryBufferMemory(
    llm=summary_llm,
    max_token_limit=2000,  # token到达上限时触发摘要压缩
    return_messages=True
)
```

**工程细节**：摘要时机用token计数器监控，到达窗口70%时触发异步摘要，不阻塞主流程。摘要本身也存一份向量库，方便后续按需检索。

---

### Q2: 现在主流大模型能处理多长的上下文？

**深度回答**:

|| 模型 | 上下文长度 | 备注 |
||------|-----------|------|
|| GPT-4o | 128K | 实际有效利用约64K后性能下降（Lost in the Middle） |
|| Claude 3.5 | 200K | 长上下文表现相对稳定 |
|| DeepSeek V3 | 128K | 国内首选，性价比高 |
|| Qwen 2.5 | 1M | 百炼平台，超长文档场景 |
|| Gemini 2.5 Pro | 1M+ | 目前最长，但API可用性受限 |

**关键认知**：上下文长度≠有效利用长度。多篇论文证明，模型在长上下文中间位置的信息检索准确率明显下降（"Lost in the Middle"现象）。所以即使模型支持128K，实际工程中还是要做上下文管理。

**实际决策**：我们项目选DeepSeek V3做主模型，128K够用，但会话管理上限设为50轮（约30K tokens），超过就触发摘要压缩，留出余量给RAG检索结果和system prompt。

---

### Q3: Agent智能体的架构一般拆成哪几层？

**实际场景**: 不是让你背分层图，而是看你有没有从0到1搭过，知道每层该干什么不该干什么。

**深度回答**:

我实际项目中拆成4层：

```
┌─────────────────────────────┐
│  对话层 (Dialog Layer)       │  ← 多轮对话管理、意图识别、指代消解
├─────────────────────────────┤
│  编排层 (Orchestration Layer)│  ← workflow引擎、条件路由、Agent调度
├─────────────────────────────┤
│  工具层 (Tool Layer)         │  ← MCP工具注册、Function Call、Skill加载
├─────────────────────────────┤
│  模型层 (Model Layer)        │  ← LLM调用、Prompt管理、输出约束
└─────────────────────────────┘
```

**Spring AI中各层对应**：

```java
// 模型层：统一封装LLM调用，切换模型只改配置
@Configuration
public class ModelConfig {
    @Bean
    @Primary
    public ChatModel primaryModel() {
        // 通过配置切换：spring.ai.openai/base-url指向不同供应商
        // DeepSeek / Qwen / OpenAI 都走OpenAI兼容协议
        return new OpenAiChatModel(openAiApi());
    }
}

// 对话层：ChatMemory + Advisor管理多轮状态
// 编排层：自定义Advisor链实现条件路由
// 工具层：FunctionCallback注册工具
```

```python
# Python对照（LangChain/LangGraph）
# 模型层：统一封装LLM调用，切换模型只改配置
from langchain_openai import ChatOpenAI

# DeepSeek / Qwen / OpenAI 都走OpenAI兼容协议
llm = ChatOpenAI(
    model="deepseek-chat",
    base_url="https://api.deepseek.com/v1",
    api_key="your-key"
)

# 对话层：RunnableWithMessageHistory 管理多轮状态
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import InMemoryChatMessageHistory

chain = prompt | llm
chain_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history=lambda sid: InMemoryChatMessageHistory(),
    input_messages_key="input",
    history_messages_key="history"
)

# 编排层：LangGraph StateGraph 实现条件路由
# 工具层：@tool 装饰器注册工具
```

**为什么这么拆**：
- 对话层独立出来，是因为多轮对话的状态管理（上下文、指代、意图追踪）足够复杂，混在编排层会让调度逻辑膨胀。
- 编排层只做"走哪条路"，不做"怎么回答"。加新能力只需要加Advisor，不动现有流程。
- 工具层统一管理MCP协议的工具注册和调用，解耦具体工具实现。
- 模型层封装Prompt模板和输出约束，切换模型只需要改配置，不影响上层。

---

### Q4: Agent和普通LLM的核心区别在哪里？

**深度回答**:

核心区别是**闭环决策能力**：

|| 维度 | 普通LLM | Agent |
||------|---------|-------|
|| 执行模式 | 单次输入→输出 | 观察→思考→行动→观察（循环） |
|| 工具使用 | 不会主动调用 | 根据需要选择并调用工具 |
|| 错误处理 | 输出错了就错了 | 能检测错误并重试/换策略 |
|| 状态管理 | 无状态 | 有状态，跨步骤维护上下文 |
|| 目标达成 | 回答问题 | 完成任务 |

**Spring AI中Agent的闭环实现**：

```java
// 普通LLM：单次调用，无状态
String answer = chatClient.prompt()
    .user("帮我查下国电南瑞的最新财报数据")
    .call()
    .content();  // 直接编造答案 → 幻觉！

// Agent：有工具+有记忆+有循环
String agentAnswer = chatClient.prompt()
    .user("帮我查下国电南瑞的最新财报数据")
    .advisors(messageChatMemoryAdvisor)      // 有状态
    .functions("stockQuery", "financialReport")  // 有工具
    .call()
    .content();
// → 识别需要实时数据 → 调用stockQuery工具 → 发现不完整
// → 再调用financialReport → 交叉验证 → 组织回答
```

```python
# Python对照（LangChain/LangGraph）
# 普通LLM：单次调用，无状态
answer = llm.invoke("帮我查下国电南瑞的最新财报数据")
# → 直接编造答案 → 幻觉！

# Agent：有工具+有记忆+有循环（LangChain Agent）
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.tools import tool
from langchain_core.prompts import ChatPromptTemplate

@tool
def stock_query(company: str) -> str:
    """查询股票实时数据"""
    return f"{company} 当前股价 28.5 元"

@tool
def financial_report(company: str) -> str:
    """查询财报数据"""
    return f"{company} 2025Q1 营收 120亿，净利润 18亿"

tools = [stock_query, financial_report]
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是专业的金融分析助手"),
    ("placeholder", "{chat_history}"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(
    agent=agent, tools=tools,
    memory=ConversationBufferWindowMemory(k=5, memory_key="chat_history",
                                          return_messages=True),
    verbose=True
)

result = agent_executor.invoke({"input": "帮我查下国电南瑞的最新财报数据"})
# → 识别需要实时数据 → 调用stock_query → 发现不完整
# → 再调用financial_report → 交叉验证 → 组织回答
```

**Agent的关键不是"能调工具"，而是"知道什么时候该调、调哪个、结果不对能怎么办"**。

---

### Q5: 你知道哪些Agent开发框架？每个框架里有哪些核心组件？

**深度回答**:

|| 框架 | 语言 | 核心组件 | 适用场景 | 我的选择 |
||------|------|---------|---------|---------|
| **Spring AI** | Java | ChatClient, Advisor, VectorStore, FunctionCallback, ChatMemory | Java项目AI接入，Spring生态 | ✅ 工作项目 |
| **LangChain4j** | Java | AiServices, RAG, @Tool, ChatMemory, DocumentSplitters | Java项目，轻量灵活 | ✅ 原型开发 |
| **AgentScope4j** | Java | Agent, Pipeline, Workflow, Message | 多Agent编排，阿里出品 | 多Agent场景 |
| **LangGraph** | Python | StateGraph, Node, Edge, Checkpoint | 复杂有状态Agent | 参考学习 |
| **AutoGen** | Python | AssistantAgent, GroupChat | 多Agent协作讨论 | 参考学习 |

**Java框架选型决策**：

```java
// Spring AI：Spring生态无缝集成，适合企业级项目
// 优势：自动配置、Advisor链、与Spring Boot深度融合
// 劣势：抽象较重，自定义复杂流程不如LangChain4j灵活
@Bean
public ChatClient chatClient(ChatClient.Builder builder) {
    return builder
        .defaultSystem("你是专业的客服助手")
        .defaultAdvisors(
            new MessageChatMemoryAdvisor(chatMemory),
            new QuestionAnswerAdvisor(vectorStore))
        .defaultFunctions("queryOrder", "searchKnowledge")
        .build();
}

// LangChain4j：更轻量，接口设计清晰，适合快速原型
// 优势：@Tool注解声明式工具、AiServices自动实现接口
// 劣势：Spring集成需手动配置
@UserMessage("查询订单状态: {{orderId}}")
interface OrderAssistant {
    String chat(@V("orderId") String orderId);
}

// AgentScope4j：阿里出品，Agent/Pipeline抽象适合多Agent编排
// 优势：原生支持多Agent workflow、消息传递
// 劣势：社区较小，文档偏中文
```

**实际选型**：企业项目用Spring AI（Spring Boot自动配置+生产级特性），个人项目用LangChain4j（轻量灵活），多Agent协作场景考虑AgentScope4j。

---

## 二、RAG与检索（5题）

### Q6: 向量检索和关键词检索各自适合什么场景？区别是啥？

**实际场景**: 做企业知识库时，用户搜"年假怎么请"，文档里写的是"休假申请流程"，纯关键词检索搜不到。

**深度回答**:

- **向量检索**：擅长语义相似。"年假怎么请"和"休假申请流程"向量距离近，能匹配。但专有名词（如"GB/T 50123"标准号）向量检索可能匹配错。
- **关键词检索（BM25）**：擅长精确匹配。"GB/T 50123"用BM25能精确命中，但"年假"搜不到"休假"。

**混合检索（RRF融合）Java实现**：

```java
public class HybridSearchService {
    private final VectorStore vectorStore;      // Spring AI向量检索
    private final BM25SearchService bm25Service; // 自定义BM25

    /**
     * RRF融合：基于排名融合，不需要调权重
     * 早期用0.7*向量分 + 0.3*BM25分，但两路分数量纲不同，调参痛苦
     * 换成RRF后，效果稳定，不依赖分数绝对值
     */
    public List<Document> hybridSearch(String query, int topK) {
        int k = 60; // RRF参数，一般取60

        // 两路检索
        List<Document> vectorResults = vectorStore.similaritySearch(
            SearchRequest.builder().query(query).topK(topK * 2).build());
        List<BM25Result> bm25Results = bm25Service.search(query, topK * 2);

        // RRF打分
        Map<String, Double> scores = new HashMap<>();
        for (int i = 0; i < vectorResults.size(); i++) {
            String id = vectorResults.get(i).getId();
            scores.merge(id, 1.0 / (k + i + 1), Double::sum);
        }
        for (int i = 0; i < bm25Results.size(); i++) {
            String id = bm25Results.get(i).getId();
            scores.merge(id, 1.0 / (k + i + 1), Double::sum);
        }

        return scores.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .limit(topK)
            .map(e -> findById(vectorResults, e.getKey()))
            .toList();
    }
}
```

```python
# Python对照（LangChain/LangGraph）
# RRF混合检索实现
from langchain_community.vectorstores import Chroma
from rank_bm25 import BM25Okapi

class HybridSearchService:
    def __init__(self, vectorstore: Chroma, bm25_corpus: list[str]):
        self.vectorstore = vectorstore
        # BM25初始化
        tokenized_corpus = [doc.split() for doc in bm25_corpus]
        self.bm25 = BM25Okapi(tokenized_corpus)
        self.bm25_corpus = bm25_corpus

    def hybrid_search(self, query: str, top_k: int = 10) -> list[dict]:
        """
        RRF融合：基于排名融合，不需要调权重
        早期用0.7*向量分 + 0.3*BM25分，但两路分数量纲不同，调参痛苦
        换成RRF后，效果稳定，不依赖分数绝对值
        """
        k = 60  # RRF参数，一般取60

        # 两路检索
        vector_results = self.vectorstore.similarity_search_with_score(
            query, k=top_k * 2
        )
        bm25_scores = self.bm25.get_scores(query.split())
        bm25_ranked = sorted(
            enumerate(bm25_scores), key=lambda x: x[1], reverse=True
        )[:top_k * 2]

        # RRF打分
        scores = {}
        for rank, (doc, _) in enumerate(vector_results):
            doc_id = doc.metadata.get("id", str(rank))
            scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (k + rank + 1)

        for rank, (idx, _) in enumerate(bm25_ranked):
            doc_id = f"bm25_{idx}"
            scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (k + rank + 1)

        # 按RRF分数排序，取top_k
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        return [{"id": doc_id, "score": score} for doc_id, score in ranked]
```

---

### Q15: RAG的标准流程是什么？有哪几种主流实现方式？

**深度回答**:

**标准流程**：
```
文档解析 → chunk切分 → Embedding → 向量存储
                                    ↓
用户Query → Query改写 → 混合检索 → Rerank → 上下文组装 → LLM生成 → 校验
```

**Spring AI实现进阶RAG**：

```java
@Service
public class RagService {
    private final VectorStore vectorStore;
    private final ChatClient chatClient;

    // 1. 文档入库
    public void ingestDocuments(List<Resource> resources) {
        // LangChain4j的DocumentSplitters做递归字符切片
        var splitter = DocumentSplitters.recursive(500, 50,
            new HashSet<>(List.of("\n\n", "\n", "。", "！", "？", ".")));

        List<Document> docs = resources.stream()
            .flatMap(r -> {
                var chunks = splitter.split(new Document(r));
                return chunks.stream();
            })
            .toList();

        vectorStore.add(docs);  // 自动Embedding + 存储
    }

    // 2. RAG检索+生成（进阶版：Query改写 + Rerank）
    public String ask(String question) {
        return chatClient.prompt()
            .user(question)
            // QuestionAnswerAdvisor自动检索相关文档注入上下文
            .advisors(new QuestionAnswerAdvisor(vectorStore,
                SearchRequest.builder()
                    .query(question)
                    .topK(10)              // 召回多
                    .similarityThreshold(0.6)
                    .build()))
            .call()
            .content();
    }
}
```

```python
# Python对照（LangChain/LangGraph）
# LangChain RetrievalQA 实现进阶RAG
from langchain.chains import RetrievalQA
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter

# 1. 文档入库
embeddings = OpenAIEmbeddings()
vectorstore = Chroma(embedding_function=embeddings, persist_directory="./kb")

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", "。", "！", "？", ".", " "]
)

from langchain_community.document_loaders import DirectoryLoader
loader = DirectoryLoader("./docs")
docs = loader.load()
chunks = splitter.split_documents(docs)
vectorstore.add_documents(chunks)  # 自动Embedding + 存储

# 2. RAG检索+生成（进阶版：Query改写 + Rerank）
from langchain.retrievers import ContextualCompressionRetriever
from langchain_cohere import CohereRerank

# 基础检索器
base_retriever = vectorstore.as_retriever(
    search_kwargs={"k": 10}  # 召回多
)

# Rerank压缩检索器：先召回多，再精排
compressor = CohereRerank(top_n=5)
compression_retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=base_retriever
)

# RetrievalQA链
qa_chain = RetrievalQA.from_chain_type(
    llm=ChatOpenAI(model="deepseek-chat"),
    chain_type="stuff",  # stuff/map_reduce/refine
    retriever=compression_retriever,
    return_source_documents=True
)

result = qa_chain.invoke({"query": "年假怎么请？"})
print(result["result"])
print(result["source_documents"])
```

**三种实现方式对比**：
1. **朴素RAG**：上面代码去掉Advisor，手动检索+拼接。简单但效果有限。
2. **进阶RAG**：Query改写+混合检索+Rerank。我们项目用的这个，准确率从60%提到85%。
3. **Agentic RAG**：Agent自主决定检索策略，延迟太高（3-5次检索循环），客服场景等不了。

---

### Q23: RAG里递归字符切片比固定长度切片好在哪里？

**深度回答**:

**固定长度切片的问题**：每500字切一刀，可能正好把一句话从中间切断。"用户可以通过APP端发起退款申请，审核通过后"被切成两段，后半段"3个工作日内到账"在下一个chunk里。

**LangChain4j递归字符切片**：

```java
// LangChain4j提供现成的递归切片器
import dev.langchain4j.data.document.splitter.DocumentSplitters;

var splitter = DocumentSplitters.recursive(
    500,    // chunkSize
    50,     // overlap：相邻chunk重叠50字，避免边界信息丢失
    Set.of("\n\n", "\n", "。", "！", "？", ".", " ")  // 分隔符层级
);

// 切分逻辑：先按\n\n（段落）切，段落太长再按\n（行）切，
// 还太长再按句号切，最后才按字符长度兜底
// → 切出来的chunk语义完整度更高

List<TextSegment> chunks = splitter.split(document);
```

```python
# Python对照（LangChain/LangGraph）
# LangChain 递归字符切片器
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,      # chunkSize
    chunk_overlap=50,    # overlap：相邻chunk重叠50字，避免边界信息丢失
    separators=["\n\n", "\n", "。", "！", "？", ".", " "],  # 分隔符层级
    length_function=len,
    is_separator_regex=False
)

# 切分逻辑：先按\n\n（段落）切，段落太长再按\n（行）切，
# 还太长再按句号切，最后才按字符长度兜底
# → 切出来的chunk语义完整度更高

chunks = splitter.split_text(document_text)
# 或直接处理Document对象
chunks = splitter.split_documents(documents)
```

**overlap的作用**：相邻chunk重叠一部分内容，确保边界信息不会丢失。但overlap不能太大，否则冗余信息多浪费token。一般设chunk_size的10%。

---

### Q24: Milvus里用多个Collection还是用分区效率高？

**深度回答**:

**分区（Partition）更优**，原因：
1. 多个Collection = 每个独立建索引、独立占内存。10个分类就是10套索引。分区共享索引结构。
2. 跨分类查询：多Collection要查多个再合并，分区只需指定多个partition names。
3. 管理成本：新增分类，分区加一个就行。

**Spring AI + Milvus分区实践**：

```yaml
# application.yml - Milvus配置
spring:
  ai:
    vectorstore:
      milvus:
        collection-name: "knowledge_base"
        embedding-dimension: 1536
```

```java
// 分区做一级分类过滤，metadata做二级过滤
List<Document> search(String query, String category) {
    return vectorStore.similaritySearch(
        SearchRequest.builder()
            .query(query)
            .topK(10)
            .filterExpression(
                // metadata过滤：category + 时间范围
                "category == '" + category + "' && year >= 2025"
            )
            .build());
}
```

```python
# Python对照（LangChain/LangGraph）
# LangChain + Milvus 分区+metadata过滤
from langchain_milvus import Milvus

vectorstore = Milvus(
    embedding_function=embeddings,
    collection_name="knowledge_base",
    connection_args={"host": "localhost", "port": "19530"},
)

# 分区做一级分类过滤，metadata做二级过滤
results = vectorstore.similarity_search(
    query=query,
    k=10,
    expr='category == "技术" and year >= 2025'  # metadata过滤
)
```

---

### Q26: 工业图纸识别如果大模型出现了幻觉，你在Prompt层或后处理层有什么应对方法？

**深度回答**：

**Prompt层**：约束生成范围 + 结构化输出 + 少样本示例

**后处理层**：

```java
// Spring AI的Structured Output保证输出格式
record DrawingResult(
    @JsonProperty(required = true) String partName,
    @JsonProperty(required = true) String dimension,
    @JsonProperty(required = true) String material,
    @JsonProperty(required = true) double confidence,
    @JsonProperty(required = true) String source  // 标注来源
) {}

// 结构化输出：强制模型按固定格式输出
DrawingResult result = chatClient.prompt()
    .user("识别这张工程图纸")
    .call()
    .entity(DrawingResult.class);

// 后处理：置信度过滤 + 规则校验
public DrawingResult validate(DrawingResult result) {
    // 1. 置信度过滤
    if (result.confidence() < 0.7) {
        return result.withNote("⚠️ 以下信息需人工确认");
    }
    // 2. 材料白名单校验
    if (!MATERIAL_WHITELIST.contains(result.material())) {
        throw new HallucinationException("材料不在白名单: " + result.material());
    }
    // 3. OCR交叉验证：关键数值与OCR原始结果比对
    if (Math.abs(parseOcrDimension(result.partName()) -
                 Double.parseDouble(result.dimension())) > 0.01) {
        return result.withNote("⚠️ 尺寸与OCR识别不一致");
    }
    return result;
}
```

```python
# Python对照（LangChain/LangGraph）
# LangChain 结构化输出 + 幻觉后处理
from pydantic import BaseModel, Field, field_validator
from langchain_core.output_parsers import PydanticOutputParser

class DrawingResult(BaseModel):
    partName: str = Field(..., description="零件名称")
    dimension: str = Field(..., description="尺寸")
    material: str = Field(..., description="材料")
    confidence: float = Field(..., ge=0, le=1, description="置信度")
    source: str = Field(..., description="来源标注")

# 结构化输出：强制模型按固定格式输出
parser = PydanticOutputParser(pydantic_object=DrawingResult)
chain = llm | parser

result = chain.invoke("识别这张工程图纸")

# 后处理：置信度过滤 + 规则校验
MATERIAL_WHITELIST = {"Q235", "45#", "304不锈钢", "铝合金6061"}

def validate(result: DrawingResult) -> DrawingResult:
    # 1. 置信度过滤
    if result.confidence < 0.7:
        print("⚠️ 以下信息需人工确认")
    # 2. 材料白名单校验
    if result.material not in MATERIAL_WHITELIST:
        raise ValueError(f"材料不在白名单: {result.material}")
    # 3. OCR交叉验证：关键数值与OCR原始结果比对
    ocr_dim = parse_ocr_dimension(result.partName)
    if abs(ocr_dim - float(result.dimension)) > 0.01:
        print("⚠️ 尺寸与OCR识别不一致")
    return result
```

**关键思路**：不是消灭幻觉（做不到），而是**让幻觉可检测、可拦截、可降级**。

---

## 三、Memory与上下文管理（3题）

### Q13: Memory在Agent里扮演什么角色？

**深度回答**:

Memory是Agent"记住过去、服务当前"的核心机制。

**Spring AI的三层Memory实现**：

```java
// 1. 工作记忆：InMemoryChatMemory / RedisChatMemory
@Bean
public ChatMemory chatMemory() {
    return new InMemoryChatMemory();  // 生产环境用Redis持久化
}

// 2. 向量记忆：VectorStoreChatMemoryAdvisor
// 跨会话检索相关历史
var vectorMemoryAdvisor = VectorStoreChatMemoryAdvisor.builder(vectorStore)
    .topK(5)
    .build();

// 3. 组合使用
@Bean
public ChatClient agentClient(ChatClient.Builder builder) {
    return builder
        .defaultAdvisors(
            MessageChatMemoryAdvisor.builder(chatMemory)
                .chatMemoryRetrieveSize(10)  // 工作记忆
                .build(),
            vectorMemoryAdvisor              // 长期记忆
        )
        .build();
}
```

```python
# Python对照（LangChain/LangGraph）
# 1. 工作记忆：ConversationBufferWindowMemory
from langchain.memory import ConversationBufferWindowMemory

window_memory = ConversationBufferWindowMemory(
    k=5,  # 保留最近5轮
    return_messages=True
)

# 2. 向量记忆：VectorStoreRetrieverMemory 跨会话检索
from langchain.memory import VectorStoreRetrieverMemory

vector_memory = VectorStoreRetrieverMemory(
    retriever=vectorstore.as_retriever(search_kwargs={"k": 5})
)

# 3. 组合使用：RunnableWithMessageHistory + 向量记忆
from langchain_core.runnables.history import RunnableWithMessageHistory

chain = prompt | llm
chain_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history=get_session_history,
    input_messages_key="input",
    history_messages_key="history"
)

# 额外注入长期记忆
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是客服助手。相关历史：{long_term_context}"),
    MessagesPlaceholder("history"),
    ("human", "{input}")
])

# 检索长期记忆并注入
def build_chain(input_dict):
    long_term = vector_memory.load_memory_variables({"prompt": input_dict["input"]})
    return prompt | llm
```

**为什么不能只用一层**：
- 全放工作记忆 → token爆炸，10轮后token到40K
- 全存向量库 → 每轮检索延迟高，且可能遗漏关键信息
- 实际方案：最近5轮完整保留 + 5轮之前做摘要 + 跨会话按需检索

---

### Q14: 上下文窗口满了需要压缩，你怎么压缩？

**深度回答**:

**三步压缩法**：

1. **分类标记**：A级（必须保留：实体、决策） → B级（压缩保留） → C级（可丢弃：寒暄）
2. **增量摘要**：每3-5轮做一次，保留实体和决策，丢弃情感词
3. **优先级挤占**：先删C级，再压缩B级，A级永远保留

```java
public class ContextCompressor {
    private final ChatModel summaryModel;  // 小模型做摘要
    private final TokenCounter tokenCounter;

    public List<Message> compress(List<Message> messages, int maxTokens) {
        // 1. 分类标记
        List<AnnotatedMessage> annotated = messages.stream()
            .map(this::annotateImportance)  // A/B/C分级
            .toList();

        // 2. 先删C级
        annotated = annotated.stream()
            .filter(m -> m.level() != ImportanceLevel.C)
            .toList();

        int currentTokens = tokenCounter.count(annotated);
        if (currentTokens <= maxTokens) return toMessages(annotated);

        // 3. 再压缩B级：增量摘要
        List<AnnotatedMessage> bLevel = annotated.stream()
            .filter(m -> m.level() == ImportanceLevel.B)
            .toList();
        String summary = summarizeIncremental(bLevel);  // LLM压缩
        // 用摘要替换原始B级消息

        // 4. A级永远保留，极端情况做二次压缩
        return assembleFinal(annotated, summary, maxTokens);
    }

    // 增量摘要：保留实体和决策
    private String summarizeIncremental(List<AnnotatedMessage> messages) {
        String prompt = """
            压缩以下对话，保留：1.所有实体(订单号/金额/日期) 2.关键决策
            丢弃：寒暄/重复/情感词
            对话：%s""".formatted(formatMessages(messages));
        return summaryModel.call(prompt);
    }
}
```

```python
# Python对照（LangChain/LangGraph）
# 上下文压缩器：三级分类 + 增量摘要
from langchain.memory import ConversationSummaryMemory
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from typing import Literal

class ContextCompressor:
    def __init__(self, summary_llm):
        self.summary_llm = summary_llm  # 小模型做摘要
        self.summary_memory = ConversationSummaryMemory(llm=summary_llm)

    def annotate_importance(self, msg: BaseMessage) -> Literal["A", "B", "C"]:
        """分类标记：A(必须保留) / B(压缩保留) / C(可丢弃)"""
        content = msg.content.lower()
        # 含实体/决策 → A级
        if any(kw in content for kw in ["订单", "金额", "日期", "确认", "取消"]):
            return "A"
        # 寒暄 → C级
        if len(content) < 10 or any(kw in content for kw in ["你好", "谢谢", "好的"]):
            return "C"
        return "B"

    def compress(self, messages: list[BaseMessage], max_tokens: int) -> list[BaseMessage]:
        # 1. 分类标记
        annotated = [(msg, self.annotate_importance(msg)) for msg in messages]

        # 2. 先删C级
        filtered = [(msg, level) for msg, level in annotated if level != "C"]

        # 3. 再压缩B级：增量摘要
        b_level = [msg for msg, level in filtered if level == "B"]
        if b_level:
            summary = self._summarize_incremental(b_level)
            # 用摘要替换B级消息
            a_level = [msg for msg, level in filtered if level == "A"]
            return a_level + [HumanMessage(content=f"[摘要]{summary}")]

        return [msg for msg, _ in filtered]

    def _summarize_incremental(self, messages: list[BaseMessage]) -> str:
        """增量摘要：保留实体和决策"""
        prompt = f"""压缩以下对话，保留：1.所有实体(订单号/金额/日期) 2.关键决策
丢弃：寒暄/重复/情感词
对话：{self._format_messages(messages)}"""
        return self.summary_llm.invoke(prompt).content
```

**准确率保障**：压缩后校验摘要是否覆盖所有实体 + A级信息双写向量库 + 监控压缩比。

---

## 四、工具调用与协议（4题）

### Q6: 工具调用的底层原理讲一下

**深度回答**:

Function Call完整链路：

```java
// Spring AI的FunctionCallback：工具注册+调用一体化

// 1. 注册阶段：定义工具Schema
@Bean
@Description("根据订单号查询订单状态和物流信息")
public FunctionCallback queryOrder() {
    return FunctionCallback.builder()
        .name("queryOrder")
        .description("查询订单状态")
        .inputType(OrderQuery.class)  // 自动生成JSON Schema
        .outputType(OrderResult.class)
        .method(this::doQueryOrder)   // 实际执行逻辑
        .build();
}

record OrderQuery(
    @JsonProperty(required = true) @Description("订单号") String orderId,
    @Description("查询字段: status/logistics/payment") List<String> fields
) {}

// 2-5. Spring AI自动处理：决策→执行→回填→继续生成
// 用户: "我订单A123到哪了"
// → 模型输出: {name: "queryOrder", arguments: {orderId: "A123"}}
// → Spring AI拦截 → 执行doQueryOrder → 结果回填到对话
// → 模型基于结果: "您的订单A123正在运输中，预计周三到达"

String answer = chatClient.prompt()
    .user("我订单A123到哪了")
    .functions("queryOrder")  // 声明可用工具
    .call()
    .content();
```

```python
# Python对照（LangChain/LangGraph）
# LangChain tool_calling：工具注册+调用一体化
from langchain_core.tools import tool
from pydantic import BaseModel, Field

# 1. 注册阶段：定义工具Schema（@tool装饰器自动生成Schema）
class OrderQuery(BaseModel):
    orderId: str = Field(..., description="订单号")
    fields: list[str] = Field(default=["status"], description="查询字段: status/logistics/payment")

@tool(args_schema=OrderQuery)
def query_order(orderId: str, fields: list[str] = ["status"]) -> dict:
    """根据订单号查询订单状态和物流信息"""
    # 实际执行逻辑
    return {"orderId": orderId, "status": "运输中", "eta": "周三"}

# 2-5. LangChain自动处理：决策→执行→回填→继续生成
# 用户: "我订单A123到哪了"
# → 模型输出: {name: "query_order", arguments: {orderId: "A123"}}
# → LangChain拦截 → 执行query_order → 结果回填到对话
# → 模型基于结果: "您的订单A123正在运输中，预计周三到达"

from langchain.agents import create_tool_calling_agent, AgentExecutor

tools = [query_order]
agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools)

answer = agent_executor.invoke({"input": "我订单A123到哪了"})
```

**底层原理**：模型不是"执行"函数，而是生成结构化的工具调用意图（JSON）。训练时用大量(用户输入, 工具schema, 工具调用)三元组做SFT。

**工程细节**：
- 模型可能输出不合法JSON → Spring AI自动JSON Schema校验+重试
- 模型可能一次调用多个工具 → 框架并行执行+结果聚合
- 工具执行超时 → 设超时+降级策略

---

### Q17: MCP你了解吗？底层实现原理是什么？

**深度回答**:

MCP（Model Context Protocol）是Anthropic提出的工具调用标准协议，解决**工具接入碎片化**。

**架构**：
```
AI应用 (MCP Client) ←→ MCP协议 ←→ MCP Server (工具实现)
```

**底层原理**：
- 传输层：stdio（本地进程间通信）或SSE over HTTP（远程通信）
- 协议层：JSON-RPC 2.0，定义了`tools/list`、`tools/call`、`resources/list`等标准方法
- 工具注册：MCP Server启动时暴露工具列表，Client发现并注册

**Spring AI集成MCP**：

```yaml
# application.yml - MCP Server配置
spring:
  ai:
    mcp:
      server:
        name: "order-service"
        version: "1.0.0"
```

```java
// MCP Server端：暴露工具
@McpTool(name = "queryOrder", description = "查询订单状态")
public OrderResult queryOrder(@McpParam(description = "订单号") String orderId) {
    return orderService.query(orderId);
}

// MCP Client端：配置文件声明Server地址，启动时自动发现工具
// Agent根据用户意图选择调用，新增工具只需部署MCP Server
```

```python
# Python对照（LangChain/LangGraph）
# LangChain MCP集成（通过langchain-mcp-adapters）
from langchain_mcp_adapters.client import MultiServerMCPClient

# MCP Client端：配置Server地址，启动时自动发现工具
async with MultiServerMCPClient(
    {"order-service": {
        "url": "http://localhost:8080/mcp/sse",
        "transport": "sse"
    }}
) as client:
    tools = client.get_tools()
    # 工具自动转为LangChain @tool格式
    agent = create_tool_calling_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools)

# MCP Server端：用FastMCP暴露工具
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("order-service")

@mcp.tool()
def query_order(orderId: str) -> dict:
    """查询订单状态"""
    return order_service.query(orderId)
```

**与Function Call的关系**：Function Call是模型能力（模型知道何时调用），MCP是协议标准（定义工具怎么注册、怎么调用）。MCP工具列表 → 转成Function Call schema → 模型决策 → MCP Client执行。

---

### Q18: Skill你了解吗？渐进式披露的原理是什么？

**深度回答**:

Skill是比Function Call更高级的封装——一组相关工具+知识+流程。

**渐进式披露**：Agent有100个Skill，全放进prompt占几千token，模型也选不准。解决方案——分级展示：

```java
// 渐进式披露的Java实现
@Service
public class SkillRegistry {
    private final List<Skill> allSkills;  // 全量Skill列表

    // Level 1: 只返回名称+一句话描述（占几百token）
    public List<SkillSummary> listSkillNames() {
        return allSkills.stream()
            .map(s -> new SkillSummary(s.getName(), s.getShortDesc()))
            .toList();
    }

    // Level 2: 候选Skill的详细描述
    public List<SkillDetail> getDetails(List<String> candidateNames) {
        return allSkills.stream()
            .filter(s -> candidateNames.contains(s.getName()))
            .map(Skill::toDetail)
            .toList();
    }

    // Level 3: 最终选定Skill的完整Schema
    public SkillSchema getSchema(String skillName) {
        return allSkills.stream()
            .filter(s -> s.getName().equals(skillName))
            .map(Skill::getFullSchema)
            .findFirst()
            .orElseThrow();
    }
}

// Agent调用流程：
// 1. 首轮prompt只放listSkillNames()结果 → 模型选出3-5个候选
// 2. 加载getDetails() → 模型确认1-2个
// 3. 加载getSchema() → 模型填充参数 → 执行
```

```python
# Python对照（LangChain/LangGraph）
# 渐进式披露的Python实现
from dataclasses import dataclass
from typing import Optional

@dataclass
class Skill:
    name: str
    short_desc: str
    detail: str
    schema: dict  # 完整的JSON Schema

class SkillRegistry:
    def __init__(self, all_skills: list[Skill]):
        self.all_skills = all_skills

    # Level 1: 只返回名称+一句话描述（占几百token）
    def list_skill_names(self) -> list[dict]:
        return [{"name": s.name, "desc": s.short_desc} for s in self.all_skills]

    # Level 2: 候选Skill的详细描述
    def get_details(self, candidate_names: list[str]) -> list[dict]:
        return [
            {"name": s.name, "detail": s.detail}
            for s in self.all_skills
            if s.name in candidate_names
        ]

    # Level 3: 最终选定Skill的完整Schema
    def get_schema(self, skill_name: str) -> dict:
        for s in self.all_skills:
            if s.name == skill_name:
                return s.schema
        raise ValueError(f"Skill not found: {skill_name}")

# Agent调用流程：
# 1. 首轮prompt只放list_skill_names()结果 → 模型选出3-5个候选
# 2. 加载get_details() → 模型确认1-2个
# 3. 加载get_schema() → 模型填充参数 → 执行
```

**类比**：餐厅菜单——先给分类目录，选了热菜再给热菜列表，选了宫保鸡丁才看详细配料。

---

### Q21: A2A协议听说过吗？

**深度回答**:

A2A（Agent-to-Agent）是Google提出的多Agent通信协议，解决**不同框架Agent之间怎么对话**。

**核心概念**：
- **Agent Card**：Agent的名片，声明能力、接口、认证方式
- **Task**：Agent间通信的基本单元
- **Message**：Task内的消息，支持文本、文件、表单等

**与MCP的区别**：
- MCP：Agent ↔ 工具（工具被动，等调用）
- A2A：Agent ↔ Agent（双方主动，可协商、拒绝、转交）

**Java生态中AgentScope4j对多Agent的支持**：

```java
// AgentScope4j：Pipeline编排多Agent
var pipeline = Pipeline.builder()
    .addAgent(customerServiceAgent)   // 客服Agent
    .addAgent(dataAnalysisAgent)      // 数据分析Agent
    .addAgent(reportAgent)            // 报告生成Agent
    .build();

// A2A未来可以让不同框架的Agent跨系统通信
// 目前还在早期，但方向是对的
```

```python
# Python对照（LangChain/LangGraph）
# AutoGen：GroupChat多Agent协作
import autogen

customer_service_agent = autogen.AssistantAgent(
    name="客服Agent",
    llm_config=llm_config,
    system_message="你是客服，负责理解用户需求"
)

data_analysis_agent = autogen.AssistantAgent(
    name="数据分析Agent",
    llm_config=llm_config,
    system_message="你是数据分析师，负责查询和分析数据"
)

report_agent = autogen.AssistantAgent(
    name="报告生成Agent",
    llm_config=llm_config,
    system_message="你负责生成最终报告"
)

# GroupChat编排多Agent协作
groupchat = autogen.GroupChat(
    agents=[customer_service_agent, data_analysis_agent, report_agent],
    messages=[],
    max_round=10
)

manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)
user_proxy = autogen.UserProxyAgent("user", code_execution_config=False)
user_proxy.initiate_chat(manager, message="帮我分析国电南瑞最新财报")
```

---

## 五、Agent反思与生成控制（2题）

### Q25: Agent的反思机制是什么？

**深度回答**:

反思机制是Agent的"自我纠错"能力——生成回答后不直接输出，先评估质量，不满意就修改。

```java
// Spring AI实现反思机制
@Service
public class ReflectiveAgent {
    private final ChatClient mainModel;    // 主回答用大模型
    private final ChatClient reflectModel; // 反思用小模型（省成本）

    public String chat(String userMessage) {
        // 第一步：生成初稿
        String draft = mainModel.prompt()
            .user(userMessage)
            .call()
            .content();

        // 第二步：反思评估（简单寒暄不触发，涉及专业建议才反思）
        if (needsReflection(userMessage)) {
            String reflection = reflectModel.prompt()
                .system("""
                    评估以下回复是否：
                    1. 语气专业温暖，没有说教感
                    2. 没有给出确定性诊断
                    3. 没有不当承诺
                    4. 包含了适当的引导和资源推荐
                    如有问题请指出修改建议，回复格式：{pass: true/false, feedback: "..."}
                    """)
                .user("待评估回复：" + draft)
                .call()
                .entity(ReflectionResult.class);

            // 第三步：根据反思修改（最多2轮，避免无限循环）
            if (!reflection.pass() && reflection.retries() < 2) {
                return mainModel.prompt()
                    .system("根据反馈修改回复，保留专业性")
                    .user("原回复：" + draft + "\n反馈：" + reflection.feedback())
                    .call()
                    .content();
            }
        }
        return draft;
    }
}
```

```python
# Python对照（LangChain/LangGraph）
# LangGraph StateGraph 反思循环
from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    draft: str
    reflection_feedback: str
    reflection_pass: bool
    retries: int

def generate(state: AgentState) -> dict:
    """生成初稿"""
    response = main_llm.invoke(state["messages"])
    return {"draft": response.content}

def reflect(state: AgentState) -> dict:
    """反思评估：用小模型评估初稿质量"""
    reflection_prompt = f"""评估以下回复是否：
1. 语气专业温暖，没有说教感
2. 没有给出确定性诊断
3. 没有不当承诺
4. 包含了适当的引导和资源推荐
如有问题请指出修改建议，回复格式：PASS/FAIL|反馈内容

待评估回复：{state['draft']}"""
    result = reflect_llm.invoke(reflection_prompt)
    passed = result.content.startswith("PASS")
    feedback = result.content.split("|", 1)[-1].strip() if "|" in result.content else ""
    return {
        "reflection_pass": passed,
        "reflection_feedback": feedback,
        "retries": state.get("retries", 0)
    }

def rewrite(state: AgentState) -> dict:
    """根据反思反馈修改"""
    rewrite_prompt = f"根据反馈修改回复，保留专业性\n原回复：{state['draft']}\n反馈：{state['reflection_feedback']}"
    response = main_llm.invoke(rewrite_prompt)
    return {"draft": response.content, "retries": state.get("retries", 0) + 1}

def should_reflect(state: AgentState) -> Literal["reflect", "end"]:
    """判断是否需要反思（简单寒暄不触发）"""
    user_msg = state["messages"][-1].content if state["messages"] else ""
    if not needs_reflection(user_msg):
        return "end"
    return "reflect"

def should_rewrite(state: AgentState) -> Literal["rewrite", "end"]:
    """判断是否需要重写（最多2轮，避免无限循环）"""
    if state.get("reflection_pass", True):
        return "end"
    if state.get("retries", 0) >= 2:
        return "end"
    return "rewrite"

# 构建反思循环图
graph = StateGraph(AgentState)
graph.add_node("generate", generate)
graph.add_node("reflect", reflect)
graph.add_node("rewrite", rewrite)

graph.set_entry_point("generate")
graph.add_conditional_edges("generate", should_reflect, {"reflect": "reflect", "end": END})
graph.add_conditional_edges("reflect", should_rewrite, {"rewrite": "rewrite", "end": END})
graph.add_edge("rewrite", "reflect")  # 重写后再反思

app = graph.compile()
result = app.invoke({"messages": [HumanMessage(content="我的订单A123发货了吗？")]})
```

**关键设计**：
- 反思不是每次都做，涉及专业建议/敏感话题才触发
- 反思用小模型（如Qwen-7B），主回答用大模型，省成本
- 最多反思2轮，避免无限循环
- 反思结果记录，用于badcase分析

---

### Q27: Function Call的原理，JSON怎么触发代码执行？

**深度回答**:

**Spring AI完整链路**：

```java
// 1. 工具注册：Spring AI自动从@Bean FunctionCallback生成Schema
@Configuration
class Tools {
    @Bean
    @Description("查询订单状态")
    public FunctionCallback queryOrder(OrderService orderService) {
        return FunctionCallback.builder()
            .name("queryOrder")
            .inputType(OrderQuery.class)      // 自动生成JSON Schema
            .method(orderService::query)       // 实际方法引用
            .build();
    }
}

// 2. 调用链路：
// 用户输入: "查下订单A123"
// → Spring AI把用户消息+工具Schema发给模型
// → 模型输出: {name: "queryOrder", arguments: {"orderId": "A123"}}
//   ↑ 模型只生成JSON意图，不执行代码——执行在框架层，这是安全边界
// → Spring AI拦截tool_call，通过name查找注册的FunctionCallback
// → 调用orderService.query(new OrderQuery("A123"))
// → 结果回填为tool message：{status: "运输中", eta: "周三"}
// → 模型基于工具结果继续生成最终回答

// 3. ChatClient调用
String answer = chatClient.prompt()
    .user("查下订单A123")
    .functions("queryOrder")  // 声明可用工具
    .call()
    .content();
// → "您的订单A123正在运输中，预计周三到达"
```

```python
# Python对照（LangChain/LangGraph）
# LangChain @tool 装饰器：工具注册+调用完整链路
from langchain_core.tools import tool
from pydantic import BaseModel, Field

# 1. 工具注册：@tool装饰器自动从函数签名生成Schema
class OrderQuery(BaseModel):
    orderId: str = Field(..., description="订单号")

@tool(args_schema=OrderQuery)
def query_order(orderId: str) -> str:
    """查询订单状态"""
    # 实际执行逻辑
    return f"订单{orderId}状态：运输中，预计周三到达"

# 2. 调用链路：
# 用户输入: "查下订单A123"
# → LangChain把用户消息+工具Schema发给模型
# → 模型输出: {name: "query_order", arguments: {"orderId": "A123"}}
#   ↑ 模型只生成JSON意图，不执行代码——执行在框架层，这是安全边界
# → LangChain拦截tool_call，通过name查找注册的@tool函数
# → 调用query_order(orderId="A123")
# → 结果回填为tool message
# → 模型基于工具结果继续生成最终回答

# 3. Agent调用
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate

tools = [query_order]
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是客服助手"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools)

answer = agent_executor.invoke({"input": "查下订单A123"})
# → "您的订单A123正在运输中，预计周三到达"
```

**关键点**：
- 工具注册表是解耦关键——函数实现和模型调用完全分离
- 多工具并行：模型可一次输出多个tool_call，框架并行执行后全部回填
- 安全边界：模型永远不直接执行代码，框架层做校验+路由

---

## 六、后端基础（5题）

### Q7: MySQL慢查询怎么定位和优化？

**深度回答**:

**定位**：
1. 开启慢查询日志：`slow_query_log=1, long_query_time=1`
2. 用`mysqldumpslow`或`pt-query-digest`分析Top N慢SQL
3. `EXPLAIN`看执行计划：重点关注type、key、rows、Extra

**优化**：
- 索引优化：复合索引遵循最左前缀，避免索引失效
- 查询优化：避免SELECT *、子查询改JOIN、大分页用延迟关联
- 架构优化：读写分离、分库分表
- 缓存：热点数据放Redis

**实际案例**：订单表500万数据，按status查最近订单全表扫描。加了`(status, create_time)`复合索引 + 延迟关联优化分页，查询从3秒降到50ms。

---

### Q8: MySQL事务的ACID特性是什么？

**深度回答**:

- **A（原子性）**：事务要么全成功要么全回滚。靠undo log实现。
- **C（一致性）**：事务前后数据库状态一致。靠应用层约束+数据库约束共同保证。
- **I（隔离性）**：并发事务互不干扰。靠锁+MVCC实现。MySQL默认可重复读。
- **D（持久性）**：事务提交后数据不丢。靠redo log实现（WAL机制）。

**面试加分点**：ACID不是四个独立特性，原子性靠undo log，持久性靠redo log，隔离性靠MVCC+锁，一致性是前面三个的最终目标。

---

### Q9: 索引覆盖的原理是什么？

**深度回答**:

查询需要的所有列都在索引中，不需要回表。

```sql
-- 联合索引 (name, age)
SELECT name, age FROM users WHERE name = '张三';
-- 索引里已经有name和age，直接从索引返回，不需要回表
```

EXPLAIN的Extra列出现`Using index`就是覆盖索引。好处：减少IO，性能提升显著。

---

### Q10: 协程是什么？跟线程比有什么不同？

**深度回答**:

|| 维度 | 线程 | 协程 | Java虚拟线程 |
||------|------|------|-------------|
|| 调度 | OS内核调度 | 用户态调度 | JVM调度（Project Loom） |
|| 切换开销 | 大 | 极小 | 极小 |
|| 并发数 | 几千 | 几十万 | 几十万 |
|| 语法 | 平台线程 | async/await | 与普通线程API一致 |

**Java虚拟线程（Project Loom）对Agent的意义**：

```java
// Java 21+ 虚拟线程：Agent场景大量IO等待，虚拟线程完美适配
ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

// 10个Agent并发处理，用虚拟线程几乎不占资源
List<Future<String>> futures = IntStream.range(0, 10)
    .mapToObj(i -> executor.submit(() -> {
        // 大量时间在等LLM API响应
        return chatClient.prompt()
            .user(tasks.get(i))
            .call()
            .content();
    }))
    .toList();

// 对比传统线程池：
// 1. 平台线程：10个线程占~10MB栈内存，上千个就OOM
// 2. 虚拟线程：每个只占几KB，百万级并发无压力
// 3. API完全一致，只需改Executors工厂方法
```

```python
# Python对照（LangChain/LangGraph）
# Python asyncio：Agent场景大量IO等待，协程完美适配
import asyncio

async def call_llm(task: str) -> str:
    """异步调用LLM，大量时间在等API响应"""
    # 模拟LLM API调用（实际用aiohttp或异步SDK）
    await asyncio.sleep(1)  # IO等待时自动让出控制权
    return f"处理结果: {task}"

async def main():
    tasks = [f"任务{i}" for i in range(10)]

    # 10个Agent并发处理，用协程几乎不占资源
    # asyncio.gather 并发执行所有协程
    results = await asyncio.gather(*[
        call_llm(task) for task in tasks
    ])
    return results

# 对比传统线程：
# 1. 线程：10个线程占~10MB栈内存，上千个就OOM
# 2. 协程：每个只占几KB，百万级并发无压力
# 3. Python原生async/await语法，无需额外线程池

# 运行
results = asyncio.run(main())

# LangChain异步支持
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model="deepseek-chat")

async def agent_task(task: str) -> str:
    # LangChain原生支持异步调用
    response = await llm.ainvoke(task)
    return response.content

async def concurrent_agents():
    results = await asyncio.gather(*[
        agent_task(t) for t in tasks
    ])
    return results
```

---

### Q11: HTTPS的握手过程能讲清楚吗？

**深度回答**:

1. **Client Hello**：客户端发送TLS版本、加密套件列表、随机数R1
2. **Server Hello**：服务端选择TLS版本和加密套件，返回证书+随机数R2
3. **证书验证**：客户端验证证书链（CA签名→域名匹配→有效期）
4. **密钥交换**：客户端生成预主密钥，用服务端公钥加密发送或ECDHE协商
5. **生成会话密钥**：双方用R1+R2+预主密钥生成对称密钥
6. **Finished**：双方用会话密钥加密确认消息

**TLS 1.3优化**：1-RTT握手，0-RTT恢复。

---

## 七、其他（4题）

### Q16: 除了RAG，你在项目中还用过哪些Agent相关技术？

**深度回答**:
- Function Call / MCP工具调用（Spring AI FunctionCallback）
- 多Agent编排（Advisor链 + 条件路由）
- Memory管理（ChatMemory + VectorStore双层）
- 反思机制（双模型自检）
- Prompt版本管理（A/B测试）
- 输出约束（Spring AI Structured Output / BeanOutputConverter）

### Q19: Spring Boot做AI应用，常用哪些依赖？

**深度回答**:
```xml
<!-- Spring AI核心 -->
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-openai-spring-boot-starter</artifactId>
</dependency>
<!-- 向量库 -->
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-milvus-store</artifactId>
</dependency>
<!-- Redis：缓存+会话存储 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<!-- WebFlux：SSE流式输出 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
```

### Q20: OpenClaw你玩过吗？

**深度回答**:
OpenClaw是开源AI Agent框架，最亮眼的是：
- MCP协议原生支持，工具生态丰富
- 技能系统（Skill）设计，可复用能力单元
- 多平台接入（微信、飞书、Telegram等）
- 配置驱动，非代码方式扩展Agent能力

### Q22: 项目深挖，详细说说

> 根据个人项目回答，重点讲：架构决策为什么这么做、踩了什么坑、怎么解决的、效果数据

---

## 八、与携程/淘天对比

|| 维度 | 携程一面 | 淘天二面 | 腾讯二面 |
||------|---------|---------|---------|
|| 题量 | 26题 | 17题 | 27题 |
|| 侧重点 | 设计合理性 | 技术广度 | **全栈深度** |
|| Agent架构 | workflow vs 自主 | CoT vs ReAct | **分层架构+上下文维护** |
|| RAG | 全链路 | 召回优化 | **切片策略+向量库选型** |
|| 新考点 | — | Skill/护栏 | **MCP底层/A2A/反思机制/渐进式披露** |
|| 后端 | 无 | 无 | **MySQL/ACID/索引覆盖/协程/HTTPS** |
|| 难度 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

> 💡 腾讯二面是三场里最全面的：Agent+RAG+后端+协议全覆盖，追问到**底层实现原理**
> 💡 代码示例全部基于Java生态：Spring AI / LangChain4j / AgentScope4j
