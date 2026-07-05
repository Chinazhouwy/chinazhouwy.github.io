# 携程AI应用开发一面面经

> 📌 **来源**: 小红书 | **作者**: 程序员尺哥 | **时间**: 2026年5月
> 🏷️ 标签: #面经 #携程面试 #大厂面试 #agent开发
> 💬 互动: 177赞 | 319收藏 | 48分享 | 8评论

---

## 面试风格

> "这轮感觉不是单纯考八股，更像在看你对**项目设计有没有自己的思考**"

核心考察点：**设计合理性**
- 不是问你有没有做，而是问你**为什么这么做**
- 面试官会顺着项目细节往下追，看设计能不能迁移到他们业务里

---

## 一、Agent架构设计（6题）

### Q1: 介绍一下Agent项目，整体架构怎么设计？

**实际场景**: 面试官想看你的全局观，不是听你堆技术名词，而是看你能不能说清楚"为什么这么分层"。

**深度回答**:

我项目拆成4层，用Spring AI的Advisor链实现：

```java
// 对话层：ChatMemory管理多轮状态
// 编排层：Advisor链实现条件路由
// 工具层：FunctionCallback注册工具
// 模型层：ChatClient封装，切换模型只改配置

@Configuration
public class AgentConfig {
    @Bean
    public ChatClient agentClient(ChatClient.Builder builder,
                                   ChatMemory chatMemory,
                                   VectorStore vectorStore) {
        return builder
            .defaultSystem("你是专业的客服助手，根据知识库回答用户问题")
            // 编排层：Advisor链 = 条件路由
            .defaultAdvisors(
                new MessageChatMemoryAdvisor(chatMemory),     // 对话层
                new QuestionAnswerAdvisor(vectorStore),        // RAG层
                new SafeGuardAdvisor()                        // 安全校验层
            )
            // 工具层：注册可用工具
            .defaultFunctions("queryOrder", "searchKnowledge", "createTicket")
            .build();
    }
}
```

```python
# Python对照：LangChain LCEL实现4层Agent架构
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_openai import ChatOpenAI
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain.chains import RetrievalQA

# 模型层：LCEL管道，切换模型只改一行
llm = ChatOpenAI(model="gpt-4o", temperature=0)

# 编排层：LCEL链式组合（等价于Advisor链）
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是专业的客服助手，根据知识库回答用户问题"),
    ("human", "{question}")
])

# RAG层：检索器
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

# 工具层：绑定工具
from langchain_core.tools import tool

@tool
def query_order(order_id: str) -> str:
    """查询订单状态"""
    return f"订单{order_id}状态：已发货"

@tool
def search_knowledge(query: str) -> str:
    """搜索知识库"""
    docs = retriever.invoke(query)
    return "\n".join(d.page_content for d in docs)

# LCEL组合：prompt | llm | output_parser
from langchain_core.output_parsers import StrOutputParser

chain = (
    {"question": RunnablePassthrough()}
    | prompt
    | llm.bind_tools([query_order, search_knowledge])
    | StrOutputParser()
)

# 对话层：加上历史记忆
chain_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history=lambda sid: RedisChatMessageHistory(sid, url="redis://localhost:6379"),
    input_messages_key="question",
)
```

**为什么这么拆**：对话层独立出来是因为多轮状态管理足够复杂，混在编排层会让调度逻辑膨胀。编排层只做"走哪条路"，加新能力只需加Advisor。

---

### Q2: 为什么选择workflow，而不是完全自主决策的Agent？

**实际场景**: 你做的是客服系统，用户问"我要退货"，Agent不能自己决定给用户退多少钱。

**深度回答**:

| 维度 | Workflow | 自主Agent |
|------|----------|-----------|
| 可控性 | ✅ 强，路径可预测 | ❌ 弱，可能走偏 |
| 可解释性 | ✅ 每步都有日志 | ❌ 黑盒决策 |
| 调试 | ✅ 容易定位问题 | ❌ 难复现 |
| 灵活性 | ❌ 固定路径 | ✅ 能处理意外情况 |

**实际生产选择：Workflow + 局部ReAct**

```java
// AgentScope4j：Workflow定义主干流程
var workflow = Workflow.builder()
    .addNode("intentRecognize", intentAgent)   // 意图识别（规则）
    .addNode("knowledgeSearch", ragAgent)      // 知识检索（ReAct）
    .addNode("answerGenerate", genAgent)       // 生成回答（规则）
    .addNode("safetyCheck", guardAgent)        // 安全校验（规则）
    .edge("intentRecognize", "knowledgeSearch", when(isKnowledgeQuery))
    .edge("intentRecognize", "answerGenerate", when(isSimpleQuery))
    .edge("knowledgeSearch", "answerGenerate")
    .edge("answerGenerate", "safetyCheck")
    .build();

// 关键：只有knowledgeSearch节点需要ReAct能力（可能需要多轮检索）
// 其他节点都是确定性的，不需要让模型"自由发挥"
```

```python
# Python对照：LangGraph StateGraph实现Workflow
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

# 定义状态
class AgentState(TypedDict):
    query: str
    intent: str
    docs: list
    answer: str
    is_safe: bool

# 节点1：意图识别（规则）
def intent_recognize(state: AgentState) -> AgentState:
    query = state["query"]
    if any(kw in query for kw in ["退货", "退款", "投诉"]):
        state["intent"] = "knowledge_query"
    else:
        state["intent"] = "simple_query"
    return state

# 节点2：知识检索（ReAct）
def knowledge_search(state: AgentState) -> AgentState:
    from langchain.agents import create_react_agent
    docs = retriever.invoke(state["query"])
    state["docs"] = [d.page_content for d in docs]
    return state

# 节点3：生成回答（规则）
def answer_generate(state: AgentState) -> AgentState:
    context = "\n".join(state.get("docs", []))
    state["answer"] = llm.invoke(f"根据以下内容回答：{context}\n问题：{state['query']}").content
    return state

# 节点4：安全校验（规则）
def safety_check(state: AgentState) -> AgentState:
    unsafe_keywords = ["密码", "银行卡号"]
    state["is_safe"] = not any(kw in state["answer"] for kw in unsafe_keywords)
    return state

# 条件路由
def route_intent(state: AgentState) -> str:
    return "knowledge_search" if state["intent"] == "knowledge_query" else "answer_generate"

# 构建StateGraph
workflow = StateGraph(AgentState)
workflow.add_node("intent_recognize", intent_recognize)
workflow.add_node("knowledge_search", knowledge_search)
workflow.add_node("answer_generate", answer_generate)
workflow.add_node("safety_check", safety_check)

workflow.set_entry_point("intent_recognize")
workflow.add_conditional_edges("intent_recognize", route_intent)
workflow.add_edge("knowledge_search", "answer_generate")
workflow.add_edge("answer_generate", "safety_check")
workflow.add_edge("safety_check", END)

app = workflow.compile()
```

**核心观点**：生产环境99%的场景用Workflow + 局部ReAct就够了。完全自主Agent适合探索性任务（如研究、创意），不适合业务流程。

---

### Q3: workflow里哪些节点需要ReAct能力？

**深度回答**:

需要ReAct的节点特征：**需要外部信息且结果不确定**

- ✅ 知识检索节点：检索结果不够时需要换关键词重试
- ✅ 工具调用节点：工具可能失败需要换策略
- ❌ 意图识别：用分类模型或规则，不需要循环
- ❌ 格式化输出：确定性的转换，不需要推理
- ❌ 安全校验：规则匹配，不需要模型决策

---

### Q4: 长链路Agent为什么能接受十几分钟耗时？

**深度回答**:

不是所有Agent都要实时响应。关键看业务场景：

| 场景 | 可接受延迟 | 实现方式 |
|------|-----------|---------|
| 客服对话 | <3秒 | 同步，流式输出 |
| 报告生成 | 5-15分钟 | 异步，通知用户 |
| 数据分析 | 30分钟+ | 异步，邮件/消息推送 |

```java
// 异步Agent：WebFlux + SSE流式通知
@GetMapping(value = "/agent/report", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<String>> generateReport(@RequestParam String topic) {
    return Flux.create(sink -> {
        // 提交异步任务
        CompletableFuture.runAsync(() -> {
            sink.next(ServerSentEvent.builder("开始生成报告...").build());
            String result = agentClient.prompt()
                .user("生成" + topic + "的分析报告")
                .call()
                .content();
            sink.next(ServerSentEvent.builder(result).build());
            sink.complete();
        });
    });
}
```

```python
# Python对照：FastAPI + SSE实现异步Agent
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio
from langchain_openai import ChatOpenAI

app = FastAPI()
llm = ChatOpenAI(model="gpt-4o", streaming=True)

@app.get("/agent/report")
async def generate_report(topic: str):
    async def event_stream():
        yield f"data: 开始生成报告...\n\n"
        # 流式生成
        async for chunk in llm.astream(f"生成{topic}的分析报告"):
            yield f"data: {chunk.content}\n\n"
        yield f"data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

# 异步后台任务版本（长时间报告）
from fastapi import BackgroundTasks

@app.post("/agent/report/async")
async def generate_report_async(topic: str, background_tasks: BackgroundTasks):
    task_id = str(uuid4())

    async def long_running_task():
        result = await llm.ainvoke(f"生成{topic}的分析报告")
        # 保存结果到Redis/DB，通知用户
        await redis.set(f"report:{task_id}", result.content)
        await notify_user(task_id, result.content)

    background_tasks.add_task(long_running_task)
    return {"task_id": task_id, "status": "processing"}
```

---

### Q5: 不同业务场景下，延迟和效果怎么取舍？

**深度回答**:

分级策略——简单query走快链路，复杂query走深度链路：

```java
@Service
public class TieredAgentService {
    private final ChatClient fastClient;   // 快链路：小模型+少工具
    private final ChatClient deepClient;   // 深度链路：大模型+RAG+工具

    public String chat(String userMessage, QueryComplexity complexity) {
        return switch (complexity) {
            case SIMPLE -> fastClient.prompt()   // FAQ类，<1秒
                .user(userMessage)
                .call().content();
            case MEDIUM -> deepClient.prompt()   // 需检索，2-3秒
                .user(userMessage)
                .advisors(new QuestionAnswerAdvisor(vectorStore))
                .call().content();
            case COMPLEX -> deepClient.prompt()  // 需检索+工具，5-10秒
                .user(userMessage)
                .advisors(new QuestionAnswerAdvisor(vectorStore))
                .functions("queryOrder", "searchKnowledge")
                .call().content();
        };
    }
}
```

```python
# Python对照：LangChain RouterChain实现分级策略
from langchain.chains.router import MultiPromptChain
from langchain.chains import ConversationChain
from langchain.chains.llm import LLMChain
from langchain_core.prompts import PromptTemplate

# 快链路：小模型，FAQ场景
fast_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 深度链路：大模型 + RAG + 工具
deep_llm = ChatOpenAI(model="gpt-4o", temperature=0)

# 定义不同链路
simple_chain = ConversationChain(
    llm=fast_llm,
    prompt=PromptTemplate.from_template("简洁回答：{input}")
)

medium_chain = RetrievalQA.from_chain_type(
    llm=deep_llm,
    retriever=vectorstore.as_retriever(search_kwargs={"k": 5}),
    return_source_documents=True
)

complex_chain = deep_llm.bind_tools([query_order, search_knowledge])

# RouterChain：根据query复杂度路由
prompt_infos = [
    {"name": "simple", "description": "简单FAQ问题，如常见问答", "prompt": "简洁回答：{input}"},
    {"name": "medium", "description": "需要检索知识库的问题，如政策查询", "prompt": "根据知识库回答：{input}"},
    {"name": "complex", "description": "需要调用工具和检索的复杂问题，如订单相关", "prompt": "综合处理：{input}"},
]

router_chain = MultiPromptChain.from_prompts(
    fast_llm,
    prompt_infos,
    verbose=True
)

# 使用
result = router_chain.invoke({"input": "我要退货"})
```

---

### Q6: Agent之间怎么编排？框架选型怎么考虑？

**深度回答**:

| 编排模式 | 适用场景 | Java实现 |
|---------|---------|---------|
| 串行 | 前一步输出是后一步输入 | AgentScope4j SequentialPipeline |
| 并行 | 多个独立子任务 | CompletableFuture.allOf() |
| 条件路由 | 根据中间结果走不同路径 | Spring AI Advisor链 |

```java
// LangChain4j AI Services：声明式Agent接口
interface CustomerServiceAgent {
    @SystemMessage("你是携程客服，根据用户问题选择合适的处理方式")
    String chat(@UserMessage String message);
}

// AgentScope4j：多Agent Pipeline
var pipeline = Pipeline.builder()
    .addAgent(intentAgent)      // 第一步：意图识别
    .addAgent(ragAgent)         // 第二步：知识检索
    .addAgent(responseAgent)    // 第三步：生成回答
    .build();

String result = pipeline.run(userMessage);
```

```python
# Python对照：AutoGen GroupChat实现多Agent编排
import autogen

# 配置LLM
llm_config = {"model": "gpt-4o", "temperature": 0}

# 定义Agent角色
intent_agent = autogen.AssistantAgent(
    name="IntentAgent",
    system_message="你是意图识别专家，分析用户问题属于哪个类别：知识查询/订单处理/投诉建议",
    llm_config=llm_config,
)

rag_agent = autogen.AssistantAgent(
    name="RAGAgent",
    system_message="你是知识检索专家，根据用户问题从知识库中检索相关信息并回答",
    llm_config=llm_config,
)

response_agent = autogen.AssistantAgent(
    name="ResponseAgent",
    system_message="你是回答生成专家，综合所有信息生成专业、友好的客服回复",
    llm_config=llm_config,
)

# 人类用户代理
user_proxy = autogen.UserProxyAgent(
    name="User",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=0,
)

# GroupChat编排
groupchat = autogen.GroupChat(
    agents=[user_proxy, intent_agent, rag_agent, response_agent],
    messages=[],
    max_round=6,  # 最多6轮对话
    speaker_selection_method="round_robin",  # 轮流发言
)

manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)

# 启动编排
user_proxy.initiate_chat(manager, message="我要退货，订单号A123")
```

---

## 二、Memory设计（5题）

### Q7: memory为什么要分短期、长期、summary？

**实际场景**: 用户第一次来问"年假怎么请"，你回答了。第二次来问"上次说的那个"，Agent得知道"那个"是什么。

**深度回答**:

```java
// Spring AI ChatMemory：短期记忆
@Bean
public ChatMemory chatMemory() {
    return new InMemoryChatMemory();  // 生产用Redis持久化
}

// 短期记忆：当前会话最近N轮
var shortTermAdvisor = MessageChatMemoryAdvisor.builder(chatMemory)
    .chatMemoryRetrieveSize(10)  // 最近5轮(10条消息)
    .build();

// 长期记忆：跨会话检索
var longTermAdvisor = VectorStoreChatMemoryAdvisor.builder(vectorStore)
    .topK(5)  // 召回5条最相关历史
    .build();

// 组合使用：短期完整保留，长期按需检索
@Bean
public ChatClient memoryClient(ChatClient.Builder builder) {
    return builder
        .defaultAdvisors(shortTermAdvisor, longTermAdvisor)
        .build();
}
```

```python
# Python对照：LangChain ConversationBufferWindowMemory
from langchain.memory import ConversationBufferWindowMemory, ConversationSummaryMemory
from langchain.chains import ConversationChain
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# 短期记忆：保留最近K轮（窗口滑动）
short_term_memory = ConversationBufferWindowMemory(
    k=5,  # 最近5轮
    return_messages=True,
)

# 长期记忆：向量存储检索
from langchain.memory import VectorStoreRetrieverMemory
from langchain_community.vectorstores import Chroma

vectorstore = Chroma(embedding_function=embeddings, persist_directory="./chat_history")
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

long_term_memory = VectorStoreRetrieverMemory(retriever=retriever)

# Summary记忆：自动摘要旧对话
summary_memory = ConversationSummaryMemory(
    llm=llm,
    return_messages=True,
)

# 组合使用：短期 + 长期 + Summary
from langchain.chains import ConversationalRetrievalChain

combined_chain = ConversationalRetrievalChain.from_llm(
    llm=llm,
    retriever=retriever,               # 长期记忆检索
    memory=short_term_memory,           # 短期窗口记忆
    return_source_documents=True,
    verbose=True,
)

# 使用
result = combined_chain.invoke({"question": "年假怎么请？"})
```

**为什么不能只用一层**：
- 全放短期 → token爆炸，10轮后40K tokens
- 全存长期 → 每轮检索延迟高，可能遗漏关键信息
- Summary → 丢细节但保留关键决策点

---

### Q8: 长期memory存什么？什么时候加载？

**深度回答**:

- **存**：用户画像（偏好、历史投诉）、关键决策（用户同意/拒绝了什么）、实体信息（订单号、地址）
- **加载时机**：会话开始时预加载用户画像，特定意图触发时按需检索

```java
// 自定义Advisor：会话开始时预加载用户画像
public class UserProfileAdvisor implements CallAroundAdvisor {
    private final UserProfileRepository repo;

    @Override
    public AdvisedResponse aroundCall(AdvisedRequest request, Chain chain) {
        String userId = extractUserId(request);
        UserProfile profile = repo.findById(userId);

        // 注入用户画像到system prompt
        request = request.withSystemMessage(
            request.systemMessage() + "\n用户画像：" + profile.summary()
        );
        return chain.nextAroundCall(request);
    }
}
```

---

### Q9: memory是模型自己选，还是规则触发更合理？

**深度回答**:

**规则为主 + 模型兜底**：

| 方式 | 优势 | 劣势 |
|------|------|------|
| 规则触发 | 可控、可预测、成本低 | 不灵活，可能漏掉 |
| 模型选择 | 灵活 | 不可控、成本高、可能选错 |

实际做法：高频场景（如用户画像加载）用规则触发，边缘场景用模型自主判断。

---

### Q10: 多轮对话里，指代不清怎么处理？

**深度回答**:

```java
// Spring AI + 指代消解：让模型改写query
public String resolveQuery(String currentQuery, List<Message> history) {
    return chatClient.prompt()
        .system("""
            根据对话历史，改写用户当前问题，补充缺失的指代信息。
            规则：只补充，不改变原意。如果指代明确，原样返回。
            """)
        .user("""
            对话历史：%s
            当前问题：%s
            改写后的问题：
            """ .formatted(formatHistory(history), currentQuery))
        .call()
        .content();
}

// 示例：
// 历史: "订单A123的物流到哪了" → "已到上海中转站"
// 当前: "那个呢" → 改写为: "订单A123的物流到哪了" → 检索更准确
```

```python
# Python对照：LangChain query改写实现指代消解
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# 指代消解prompt
rewrite_prompt = ChatPromptTemplate.from_messages([
    ("system", """根据对话历史，改写用户当前问题，补充缺失的指代信息。
规则：只补充，不改变原意。如果指代明确，原样返回。"""),
    ("human", """对话历史：{history}
当前问题：{query}
改写后的问题：""")
])

# 改写链
rewrite_chain = (
    {"history": lambda x: x["history"], "query": lambda x: x["query"]}
    | rewrite_prompt
    | llm
    | StrOutputParser()
)

# 使用
history = [
    ("human", "订单A123的物流到哪了"),
    ("ai", "已到上海中转站"),
]
rewritten = rewrite_chain.invoke({
    "history": "\n".join(f"{r[0]}: {r[1]}" for r in history),
    "query": "那个呢"
})
# 输出: "订单A123的物流到哪了"

# 集成到RAG链路
from langchain_core.runnables import RunnableLambda

rag_chain = (
    {"query": RunnablePassthrough()}
    | RunnableLambda(lambda x: {"query": x, "history": get_history()})
    | RunnableLambda(lambda x: rewrite_chain.invoke(x))  # 先改写
    | retriever                                                 # 再检索
    | docs_to_string
    | answer_prompt
    | llm
    | StrOutputParser()
)
```

---

### Q11: query改写放在哪个环节最合适？

**深度回答**:

**检索前改写为主**，提升召回质量：

```java
// 自定义Advisor：检索前做query改写
public class QueryRewriteAdvisor implements CallAroundAdvisor {
    @Override
    public AdvisedResponse aroundCall(AdvisedRequest request, Chain chain) {
        // 在QuestionAnswerAdvisor之前执行
        String originalQuery = extractUserQuery(request);
        String rewrittenQuery = rewriteQuery(originalQuery, request.history());

        // 用改写后的query替换原始query
        request = replaceUserQuery(request, rewrittenQuery);
        return chain.nextAroundCall(request);
    }
}

// 注册顺序很重要：QueryRewrite → QuestionAnswerAdvisor
@Bean
public ChatClient client(ChatClient.Builder builder) {
    return builder
        .defaultAdvisors(
            new QueryRewriteAdvisor(),           // 先改写
            new QuestionAnswerAdvisor(vectorStore) // 再检索
        )
        .build();
}
```

```python
# Python对照：LangChain ContextualCompressionRetriever实现query改写
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor
from langchain_openai import ChatOpenAI
from langchain_community.vectorstores import Chroma

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# 基础检索器
base_retriever = vectorstore.as_retriever(search_kwargs={"k": 10})

# LLM压缩器：对检索结果做上下文压缩（等价于query改写+结果过滤）
compressor = LLMChainExtractor.from_llm(llm)

# ContextualCompressionRetriever：检索后压缩，只保留与query相关的部分
compression_retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=base_retriever,
)

# 对比：基础检索 vs 压缩检索
# 基础: 返回10个chunk，可能包含大量无关内容
# 压缩: 返回精简后的内容，只保留与query相关的部分

# 结合query改写 + 压缩检索的完整链路
from langchain_core.runnables import RunnableLambda

def rewrite_query(query: str) -> str:
    """利用LLM改写query"""
    return llm.invoke(
        f"根据上下文改写以下问题使其更具体：{query}"
    ).content

full_chain = (
    RunnableLambda(rewrite_query)              # 先改写query
    | compression_retriever                     # 再检索+压缩
    | RunnableLambda(format_docs)
    | answer_prompt
    | llm
    | StrOutputParser()
)
```

---

## 三、评测体系（3题）

### Q12: Agent评测体系怎么设计？

**深度回答**:

三层评测体系：

| 层级 | 方法 | 指标 |
|------|------|------|
| 组件级 | 单元测试 | 检索准确率、工具调用成功率 |
| 链路级 | 集成测试 | 端到端准确率、延迟 |
| 线上 | A/B测试 | 用户满意度、追问率 |

```java
// 组件级评测：检索准确率
@Test
void testRetrievalAccuracy() {
    List<String> testQueries = List.of(
        "年假怎么请", "退货流程", "配送时效"
    );
    for (String query : testQueries) {
        List<Document> results = vectorStore.similaritySearch(
            SearchRequest.builder().query(query).topK(5).build());
        // 检查是否包含预期文档
        assertTrue(results.stream().anyMatch(d -> d.getContent().contains(expectedAnswer)));
    }
}
```

---

### Q13: 用户行为能不能作为效果评估信号？

**深度回答**:

可以，但要处理偏差：

- **正向信号**：点赞、采纳、不再追问
- **负向信号**：追问、重试、跳出、转人工
- **偏差处理**：需要样本量、A/B对照、因果推断

---

### Q14: badcase怎么回流到评测集和后续迭代？

**深度回答**:

```java
// 自动收集badcase → 分类归因 → 补充评测集
@Service
public class BadCaseCollector {
    private final BadCaseRepository repo;

    // 1. 自动收集：用户不满信号
    public void collect(String sessionId, String userQuery,
                        String agentResponse, String signal) {
        BadCase badCase = BadCase.builder()
            .sessionId(sessionId)
            .query(userQuery)
            .response(agentResponse)
            .signal(signal)  // "追问" / "转人工" / "负反馈"
            .timestamp(LocalDateTime.now())
            .build();
        repo.save(badCase);
    }

    // 2. 分类归因：检索问题 / 生成问题 / 理解问题
    public String classify(BadCase badCase) {
        return chatClient.prompt()
            .system("分析badcase的根因：检索问题/生成问题/理解问题")
            .user("Query: " + badCase.getQuery() + "\nResponse: " + badCase.getResponse())
            .call().content();
    }
}

// 3. 回归测试：新版本必须过已有badcase
// 4. 评测集持续扩充：badcase → 标注 → 补充到评测集
```

```python
# Python对照：badcase自动收集与分类归因
from datetime import datetime
from pydantic import BaseModel
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o", temperature=0)

class BadCase(BaseModel):
    session_id: str
    query: str
    response: str
    signal: str  # "追问" / "转人工" / "负反馈"
    timestamp: datetime = datetime.now()
    root_cause: str | None = None

# 1. 自动收集badcase
class BadCaseCollector:
    def __init__(self, db_path: str = "badcases.jsonl"):
        self.db_path = db_path

    def collect(self, session_id: str, user_query: str,
                agent_response: str, signal: str):
        bad_case = BadCase(
            session_id=session_id,
            query=user_query,
            response=agent_response,
            signal=signal,
        )
        # 持久化到JSONL
        with open(self.db_path, "a") as f:
            f.write(bad_case.model_dump_json() + "\n")
        return bad_case

    # 2. 分类归因：检索问题 / 生成问题 / 理解问题
    def classify(self, bad_case: BadCase) -> str:
        result = llm.invoke(
            "分析badcase的根因：检索问题/生成问题/理解问题\n"
            f"Query: {bad_case.query}\nResponse: {bad_case.response}\n"
            f"Signal: {bad_case.signal}\n根因："
        ).content
        bad_case.root_cause = result
        return result

    # 3. 回归测试：新版本必须过已有badcase
    def load_all(self) -> list[BadCase]:
        cases = []
        with open(self.db_path) as f:
            for line in f:
                cases.append(BadCase.model_validate_json(line.strip()))
        return cases

# 使用
collector = BadCaseCollector()
collector.collect("sess_001", "我要退货", "好的，已为您退款500元", "转人工")
```

---

## 四、RAG全链路（10题）

### Q15: RAG从文档入库到线上检索，完整链路怎么做？

**深度回答**:

```java
@Service
public class FullRagService {
    private final VectorStore vectorStore;
    private final ChatClient chatClient;

    // ===== 入库链路 =====
    public void ingestDocuments(List<Resource> documents) {
        // 1. 文档解析（PDF/Word/Markdown）
        // 2. 递归字符切片
        var splitter = DocumentSplitters.recursive(500, 50,
            Set.of("\n\n", "\n", "。", "！", "？", "."));

        List<Document> chunks = documents.stream()
            .flatMap(doc -> splitter.split(parseDocument(doc)).stream())
            .toList();

        // 3. Embedding + 向量存储（Spring AI自动处理）
        vectorStore.add(chunks);
    }

    // ===== 检索链路 =====
    public String ask(String question) {
        return chatClient.prompt()
            .user(question)
            .advisors(new QuestionAnswerAdvisor(vectorStore,
                SearchRequest.builder()
                    .query(question)
                    .topK(10)
                    .similarityThreshold(0.6)
                    .build()))
            .call()
            .content();
    }
}
```

```python
# Python对照：LangChain RetrievalQA完整RAG链路
from langchain_community.document_loaders import PyPDFLoader, UnstructuredMarkdownLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain.chains import RetrievalQA

# ===== 入库链路 =====
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = Chroma(embedding_function=embeddings, persist_directory="./chroma_db")

def ingest_documents(file_paths: list[str]):
    """完整入库链路：解析 → 切片 → Embedding → 存储"""
    all_docs = []
    for path in file_paths:
        # 1. 文档解析
        if path.endswith(".pdf"):
            loader = PyPDFLoader(path)
        elif path.endswith(".md"):
            loader = UnstructuredMarkdownLoader(path)
        else:
            loader = TextLoader(path)
        docs = loader.load()

        # 2. 递归字符切片
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            separators=["\n\n", "\n", "。", "！", "？", ".", " "],
        )
        chunks = splitter.split_documents(docs)
        all_docs.extend(chunks)

    # 3. Embedding + 向量存储
    vectorstore.add_documents(all_docs)
    print(f"入库完成，共{len(all_docs)}个chunk")

# ===== 检索链路 =====
llm = ChatOpenAI(model="gpt-4o", temperature=0)

qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",  # stuff/map_reduce/refine
    retriever=vectorstore.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs={"k": 10, "score_threshold": 0.6}
    ),
    return_source_documents=True,
)

# 使用
result = qa_chain.invoke({"query": "退货政策是什么？"})
print(result["result"])           # 回答
print(result["source_documents"]) # 来源文档
```

---

### Q16: 为什么要混合检索？向量和关键词分别解决什么问题？

**深度回答**:

- **向量检索**：语义相似，"年假怎么请"匹配"休假申请流程"
- **BM25**：精确匹配，"GB/T 50123"精确命中

**Java RRF融合**（同腾讯篇Q6，此处省略重复代码）

**踩坑**：早期用加权打分，两路分数量纲不同调参痛苦。换RRF后基于排名融合，效果好且稳定。

---

### Q17: TopK怎么定？召回多一点一定更好吗？

**深度回答**:

**不是越多越好**：召回多 → 上下文长 → 噪声多 → 效果下降

| TopK | 优点 | 缺点 |
|------|------|------|
| 5 | 精准、token省 | 可能遗漏关键信息 |
| 10-20 | 召回覆盖面广 | 需要Rerank精排 |
| 50+ | 几乎不遗漏 | 噪声多、token浪费、效果下降 |

**实践**：TopK=10-20，配合Rerank精排到Top5再送模型。

---

### Q18: 什么场景下规则链路比大模型更合适？

**深度回答**:

高频简单查询用规则链路：快、准、便宜、可控。

```java
// 规则链路：FAQ精确匹配，<50ms
@GetMapping("/faq")
public String faq(@RequestParam String question) {
    return faqRepository.findByQuestion(question)
        .map(FAQ::getAnswer)
        .orElseGet(() -> ragService.ask(question));  // 兜底走RAG
}

// 适合规则链路的场景：
// 1. FAQ：常见问题，答案固定
// 2. 价格计算：确定性逻辑
// 3. 库存查询：实时接口，不需要LLM
// 4. 政策查询：结构化数据，SQL直接查
```

---

### Q19: 复杂PDF解析最难的点是什么？

**深度回答**:
- 表格解析（跨页、合并单元格）
- 图文混排（图片与文字关联）
- 多栏布局
- 公式/特殊符号

实际方案：Apache PDFBox做基础解析 + 大模型做结构化理解，表格用专门的Table Extraction模型。

---

### Q20: chunk切分为什么不能只用固定长度？

**深度回答**:

固定长度会切断语义完整性。用LangChain4j递归字符切片：

```java
import dev.langchain4j.data.document.splitter.DocumentSplitters;

// 递归字符切片：先按段落切，太长再按行切，再按句号，最后兜底
var splitter = DocumentSplitters.recursive(
    500,    // chunkSize
    50,     // overlap: 相邻chunk重叠50字
    Set.of("\n\n", "\n", "。", "！", "？", ".", " ")  // 分隔符层级
);

// 对比固定长度：
// 固定: "用户可以通过APP端发起退款申请，审核通" | "过后3个工作日内到账"
// → 检索只召回前半段，模型不知道到账时间
// 递归: 按段落/句子切，语义完整
```

```python
# Python对照：LangChain RecursiveCharacterTextSplitter
from langchain_text_splitters import RecursiveCharacterTextSplitter

# 递归字符切片：先按段落切，太长再按行切，再按句号，最后兜底
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", "。", "！", "？", ".", " "],  # 分隔符层级
    length_function=len,
    is_separator_regex=False,
)

# 切分文档
from langchain_community.document_loaders import TextLoader
docs = TextLoader("policy.txt").load()
chunks = splitter.split_documents(docs)

print(f"原文档{len(docs)}个 → 切分后{len(chunks)}个chunk")
for i, chunk in enumerate(chunks[:3]):
    print(f"--- Chunk {i+1} (长度:{len(chunk.page_content)}) ---")
    print(chunk.page_content[:100])

# 对比固定长度：
# 固定: "用户可以通过APP端发起退款申请，审核通" | "过后3个工作日内到账"
# → 检索只召回前半段，模型不知道到账时间
# 递归: 按段落/句子切，语义完整
```

---

### Q21: metadata除了存字段，还能怎么参与召回？

**深度回答**:

```java
// metadata参与召回的三种方式：

// 1. 过滤：按部门/时间/类型过滤
List<Document> search = vectorStore.similaritySearch(
    SearchRequest.builder()
        .query("退货政策")
        .filterExpression("department == '售后' && year >= 2025")
        .build());

// 2. 加权：时效性权重（新文档优先）
// 在Document的metadata中加timestamp，检索后按时间加权排序

// 3. 路由：不同类型走不同检索策略
public String routeSearch(String query, String docType) {
    return switch (docType) {
        case "policy" -> policyRagService.ask(query);     // 政策走RAG
        case "realtime" -> realtimeApiService.query(query); // 实时走API
        default -> generalRagService.ask(query);           // 默认走通用RAG
    };
}
```

```python
# Python对照：LangChain SelfQueryRetriever实现metadata过滤
from langchain.chains.query_constructor.base import AttributeInfo
from langchain.retrievers import SelfQueryRetriever
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

llm = ChatOpenAI(model="gpt-4o", temperature=0)
embeddings = OpenAIEmbeddings()
vectorstore = Chroma(embedding_function=embeddings, persist_directory="./chroma_db")

# 定义metadata字段描述
metadata_field_info = [
    AttributeInfo(name="department", description="文档所属部门，如：售后、客服、物流", type="string"),
    AttributeInfo(name="year", description="文档年份", type="integer"),
    AttributeInfo(name="doc_type", description="文档类型：policy/realtime/faq", type="string"),
]

document_content_description = "携程客服知识库文档"

# SelfQueryRetriever：自动从自然语言提取filter
retriever = SelfQueryRetriever.from_llm(
    llm=llm,
    vectorstore=vectorstore,
    document_contents=document_content_description,
    metadata_field_info=metadata_field_info,
    enable_limit=True,
    verbose=True,
)

# 使用：自然语言查询 → 自动提取filter
# "售后部门2025年的退货政策" → filter: department=="售后" AND year>=2025
docs = retriever.invoke("售后部门2025年的退货政策")

# 路由：不同类型走不同检索策略
def route_search(query: str, doc_type: str) -> str:
    if doc_type == "policy":
        return policy_rag_service.ask(query)      # 政策走RAG
    elif doc_type == "realtime":
        return realtime_api_service.query(query)   # 实时走API
    else:
        return general_rag_service.ask(query)      # 默认走通用RAG
```

---

### Q22: 文档版本、有效期、更新机制怎么设计？

**深度回答**:

- 版本管理：文档版本号 + 增量更新
- 有效期：过期自动降权（metadata中加expireAt，检索时过滤/降权）
- 更新策略：小改动增量更新（只更新变化的chunk），大改动全量重建

---

### Q23: 离线文档和实时接口分别适合什么场景？

**深度回答**:

| 知识源 | 适合场景 | 变更频率 | 实现方式 |
|--------|---------|---------|---------|
| 离线文档 | 政策、规范、知识库 | 低 | RAG |
| 实时接口 | 库存、价格、订单状态 | 高 | Function Call |
| 混合 | 先检索知识库，再调接口补实时数据 | - | RAG + Function Call |

```java
// Spring AI：RAG + Function Call混合
String answer = chatClient.prompt()
    .user("这个订单能退货吗？")
    .advisors(new QuestionAnswerAdvisor(vectorStore))  // RAG查退货政策
    .functions("queryOrder")                           // 实时查订单状态
    .call()
    .content();
// → 模型先查退货政策，再查订单状态，综合判断
```

```python
# Python对照：LangChain Agent实现RAG + Function Call混合
from langchain.agents import create_openai_tools_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# 定义工具
@tool
def query_order(order_id: str) -> str:
    """查询订单状态，返回订单当前状态信息"""
    # 调用实时订单API
    return f"订单{order_id}：已签收，签收时间2025-04-01"

@tool
def search_knowledge_base(query: str) -> str:
    """搜索知识库，查找退货政策、流程等信息"""
    docs = vectorstore.as_retriever().invoke(query)
    return "\n".join(d.page_content for d in docs)

# 创建Agent
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是携程客服，先用知识库查政策，再用工具查实时数据"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

agent = create_openai_tools_agent(llm, [query_order, search_knowledge_base], prompt)
agent_executor = AgentExecutor(agent=agent, tools=[query_order, search_knowledge_base], verbose=True)

# 使用：模型先查退货政策，再查订单状态，综合判断
result = agent_executor.invoke({"input": "订单A123能退货吗？"})
# → 模型先调用search_knowledge_base查退货政策
# → 再调用query_order查订单A123状态
# → 综合判断给出回答
```

---

### Q24: 生成后校验层解决什么问题？

**深度回答**:

```java
// 自定义GuardrailAdvisor：生成后校验
public class SafeGuardAdvisor implements CallAroundAdvisor {
    private final List<OutputGuardrail> guardrails;

    @Override
    public AdvisedResponse aroundCall(AdvisedRequest request, Chain chain) {
        AdvisedResponse response = chain.nextAroundCall(request);
        String content = response.content();

        // 1. 事实性校验：生成内容是否与检索内容一致
        // 2. 安全性校验：是否包含敏感信息
        // 3. 格式校验：是否符合预期输出格式
        for (OutputGuardrail guardrail : guardrails) {
            GuardrailResult result = guardrail.validate(content);
            if (!result.passed()) {
                // 拦截或降级
                return response.withContent(result.safeResponse());
            }
        }
        return response;
    }
}
```

```python
# Python对照：NeMo Guardrails实现生成后校验
from nemoguardrails import RailsConfig, LLMRails
from nemoguardrails.rails import LLMRail

# 1. 定义guardrails配置（config.yml）
config_yml = """
models:
  - type: main
    engine: openai
    model: gpt-4o

rails:
  output:
    flows:
      - self check output
"""

# 2. 定义输出校验规则（prompts.yml）
prompts_yml = """
- task: self_check_output
  content: |
    Check if the following output is safe and appropriate.
    - Does not contain sensitive information (passwords, bank cards)
    - Does not contain harmful content
    - Is factually consistent with the provided context
    If any check fails, respond with "NO". Otherwise "YES".

    Output: {{ output }}
    Context: {{ context }}

    Result:
"""

# 3. 初始化Rails
config = RailsConfig.from_string(config_yml, prompts_yml)
rails = LLMRails(config)

# 4. 使用guardrails保护
result = rails.generate(
    messages=[{"role": "user", "content": "这个订单能退货吗？"}]
)
# 如果输出未通过校验，guardrails会拦截或替换为安全回复

# 5. 自定义校验flow（colang）
colang_config = """
define flow self check output
  bot response
  if not output_is_safe
    bot refuse response
    stop

define subflow output_is_safe
  execute self_check_output
  $check_result = execute self_check_output(output=$bot_response, context=$context)
  if $check_result == "NO"
    return False
  return True
"""

# 组合使用
from langchain.chains import RetrievalQA

# RAG链路 + NeMo Guardrails保护
def safe_rag_query(question: str) -> str:
    # 先检索生成
    rag_result = qa_chain.invoke({"query": question})
    # 再做guardrails校验
    safe_result = rails.generate(
        messages=[{"role": "user", "content": question}],
        context=rag_result["source_documents"]
    )
    return safe_result["content"]
```

---

## 五、模型优化（2题）

### Q25: 为什么有些场景SFT效果不好？

**深度回答**:

- 数据量不足/质量差
- 任务与预训练分布差异太大
- 需要外部知识的场景（RAG更合适）
- SFT适合风格/格式对齐，不适合知识注入

---

### Q26: reward model适合解决什么问题？

**深度回答**:

| 手段 | 适用场景 | 成本 | 效果 |
|------|---------|------|------|
| Prompt优化 | 快速迭代、格式控制 | 低 | 有限 |
| RAG | 知识密集、数据更新频繁 | 中 | 好 |
| SFT | 风格对齐、格式固定 | 高 | 稳定 |
| PPO/RLHF | 偏好对齐、安全性 | 很高 | 最优 |

---

## 六、反问环节

携程AI团队业务方向：
- 🤖 **智能客服** — 多轮对话+知识库
- 🛍️ **超级导购** — 个性化推荐Agent
- 📚 **统一知识库** — 企业级RAG
- 🔧 **MCP工具集** — 工具调用标准化

> 💡 评论补充: "携程这个业务组已经有AI应用在线上了，所以更上道，问得很细"

---

## 七、答题思路总结

### 核心原则
1. **每个设计决策都要能说出"为什么"** — 不只是做了什么，而是为什么这么做
2. **讲清取舍** — A方案 vs B方案，各自优劣，为什么选了这个
3. **可迁移性** — 设计能复用到其他业务场景
4. **成本意识** — Token消耗、延迟、运维成本

### 高频考点

| 频次 | 考点 | 关键词 |
|------|------|--------|
| ⭐⭐⭐ | 架构取舍 | workflow vs Agent, 规则 vs 模型 |
| ⭐⭐⭐ | Memory设计 | 短期/长期/summary, 指代消解 |
| ⭐⭐⭐ | RAG全链路 | 混合检索, chunk切分, 校验 |
| ⭐⭐ | 评测体系 | badcase回流, 用户行为信号 |
| ⭐⭐ | 成本控制 | 延迟 vs 效果, TopK选择 |
| ⭐ | 模型优化 | SFT局限, reward model |
