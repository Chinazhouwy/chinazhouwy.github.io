---
title: "SpringAI教程知识点整理（尚硅谷86集）"
date: "2026-07-20"
domain: "技术"
area: "AI Agent"
module: ""
project: ""
type: "学习笔记"
status: "可复习"
priority: "P1"
energy: "high"
visibility: "private"
summary: "SpringAI Alibaba从入门到RAG/MCP/Agent实战的86集课程知识点"
tags:
  - SpringAI
  - SAA
  - RAG
  - MCP
  - ToolCalling
  - Java
source: "B站"
source_url: "https://www.bilibili.com/video/BV1pvWGznEqh/"
author: "尚硅谷"
stats: "77万播放 / 9563收藏"
total_episodes: 86
---

# SpringAI教程知识点整理（尚硅谷86集）

> 来源：B站 · 尚硅谷
> 链接：https://www.bilibili.com/video/BV1pvWGznEqh/
> 配套资料：关注公众号「尚硅谷教育」回复"SpringAI"免费获取
> 课程定位：Spring AI Alibaba 实战（RAG、SAA、MCP）

---

## 一、SAA概述与入门（P1-P12）

### 1.1 SAA是什么
- **Spring AI Alibaba** = Spring AI + 阿里云百炼平台集成
- Spring 生态下对接大模型的标准框架
- 类比：MyBatis 之于数据库，Spring AI 之于大模型

### 1.2 为什么需要SAA
- 大模型API各家不同（OpenAI/通义千问/DeepSeek）
- SAA 提供统一抽象层，切换模型只需改配置
- Java 生态原生集成（Spring Boot Starter）

### 1.3 框架对比

| 框架 | 语言 | 生态 | 特点 |
|------|------|------|------|
| LangChain | Python | Python生态 | 功能最全，社区最大 |
| LangChain4j | Java | Java生态 | LangChain的Java移植 |
| Spring AI | Java | Spring生态 | Spring官方，与Spring Boot深度集成 |
| Spring AI Alibaba | Java | Spring+阿里云 | 增加阿里云百炼平台支持 |

### 1.4 入门案例

**三件套申请**（阿里云百炼平台）：
1. 注册阿里云账号
2. 开通百炼平台
3. 获取 API Key

**项目搭建**：
```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-alibaba-starter</artifactId>
</dependency>
```

**核心代码**：
```java
@Autowired
private ChatClient chatClient;

public String chat(String userMessage) {
    return chatClient.prompt()
        .user(userMessage)
        .call()
        .content();
}
```

---

## 二、Ollama本地模型（P13-P16）

### 2.1 Ollama是什么
- 本地运行大模型的工具
- 支持 Llama、Qwen、Mistral 等开源模型
- 提供兼容 OpenAI 的 API 接口

### 2.2 安装与使用
```bash
# 安装
curl -fsSL https://ollama.com/install.sh | sh

# 下载模型
ollama pull qwen2.5:7b

# 启动服务（默认端口11434）
ollama serve
```

### 2.3 SpringAI集成Ollama
```yaml
spring:
  ai:
    ollama:
      base-url: http://localhost:11434
      chat:
        model: qwen2.5:7b
```

---

## 三、ChatClient深入（P17-P20）

### 3.1 ChatClient vs ChatModel
| 组件 | 职责 | 使用场景 |
|------|------|----------|
| ChatModel | 底层模型调用 | 简单调用 |
| ChatClient | 高级封装（记忆/工具/RAG） | 复杂应用 |

### 3.2 注入方式
```java
// 方式1：构造注入（推荐，支持多模型）
@Bean
public ChatClient chatClient(ChatClient.Builder builder) {
    return builder
        .defaultSystem("你是一个助手")
        .defaultFunctions("getWeather")
        .build();
}

// 方式2：自动注入（单模型场景）
@Autowired
private ChatClient chatClient;
```

### 3.3 关键点
- ChatClient 是**不可变的**，每次 `.build()` 生成新实例
- `defaultSystem()` 设置默认系统提示词
- `defaultFunctions()` 绑定默认工具

---

## 四、SSE流式输出（P21-P26）

### 4.1 SSE是什么
- **Server-Sent Events**：服务端向客户端推送事件
- 大模型逐字输出的基础技术
- HTTP 长连接，服务端单向推送

### 4.2 面试题：SSE vs WebSocket vs 轮询

| 技术 | 方向 | 连接 | 适用场景 |
|------|------|------|----------|
| SSE | 服务端→客户端 | HTTP长连接 | 大模型流式输出 |
| WebSocket | 双向 | 独立连接 | 聊天室、游戏 |
| 轮询 | 客户端→服务端 | 短连接反复请求 | 低频更新 |

### 4.3 SpringAI流式输出
```java
// ChatModel 流式
Flux<String> stream = chatModel.stream(new Prompt(userMessage))
    .map(response -> response.getResult().getOutput().getContent());

// ChatClient 流式
Flux<String> stream = chatClient.prompt()
    .user(userMessage)
    .stream()
    .content();
```

### 4.4 前后端联调
```java
// SSE 端点
@GetMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<String> chatStream(@RequestParam String message) {
    return chatClient.prompt()
        .user(message)
        .stream()
        .content();
}
```

---

## 五、提示词工程（P27-P37）

### 5.1 提示词四大角色

| 角色 | 说明 | 示例 |
|------|------|------|
| System | 系统设定，定义AI行为边界 | "你是一个Java面试官" |
| User | 用户输入的问题 | "解释HashMap原理" |
| Assistant | AI的回复（历史） | 模型的回答 |
| Tool | 工具返回的结果 | 天气查询结果 |

### 5.2 提示词模板
```java
// 方式1：字符串模板
String promptTemplate = """
    你是一个{role}专家。
    请用{language}解释以下概念：{concept}
    """;

// 方式2：配置文件
// application.yml
spring.ai.openai.chat.options:
  system-prompt: "你是{role}专家"
```

### 5.3 角色设定与边界划分
```java
chatClient.prompt()
    .system(sb -> sb
        .text("你是Java面试官，专精JVM和并发编程")
        .param("role", "Java面试"))
    .user(userMessage)
    .call()
    .content();
```

---

## 六、格式化输出（P38-P40）

### 6.1 为什么需要结构化输出
- 模型返回自由文本，程序难以处理
- 结构化输出便于类型校验和后续处理

### 6.2 SpringAI的结构化输出
```java
// 定义输出结构（Java Record）
public record MovieReview(
    String title,
    int rating,
    String summary,
    List<String> pros,
    List<String> cons
) {}

// 使用
MovieReview review = chatClient.prompt()
    .user("评价一下《流浪地球》")
    .call()
    .entity(MovieReview.class);
```

### 6.3 Record vs Class
- **Record**：不可变，自动生成构造器/getter/equals/hashCode（推荐）
- **Class**：可变，需要手写样板代码

---

## 七、ChatMemory对话记忆（P41-P47）

### 7.1 记忆是什么
- 多轮对话需要记住之前的上下文
- SpringAI 通过 ChatMemory 管理对话历史

### 7.2 记忆类型

| 类型 | 存储位置 | 生命周期 |
|------|----------|----------|
| InMemoryChatMemory | JVM内存 | 应用重启丢失 |
| JdbcChatMemory | 数据库 | 持久化 |

### 7.3 对话窗口上限
```java
chatClient.prompt()
    .advisors(new MessageChatMemoryAdvisor(chatMemory, sessionId, 10))  // 保留最近10轮
    .user(userMessage)
    .call()
    .content();
```

### 7.4 持久化实现
```java
// 基于JDBC的持久化
ChatMemory chatMemory = new JdbcChatMemory(jdbcTemplate);

// 自动建表（SpringAI内置）
// 表名：SPRING_AI_CHAT_MEMORY
// 字段：conversation_id, content, type, timestamp
```

---

## 八、多模态能力（P48-P50）

### 8.1 文生图（通义万相）
```java
@Autowired
private ImageClient imageClient;

public String generateImage(String prompt) {
    ImageResponse response = imageClient.call(
        new ImagePrompt(prompt, 
            ImageOptionsBuilder.builder()
                .model("wanx-v1")
                .build()));
    return response.getResult().getOutput().getUrl();
}
```

### 8.2 语音合成（CosyVoice）
- 阿里云 CosyVoice 语音合成
- 支持多种音色和情感
- SpringAI 集成方式

---

## 九、向量化（P51-P58）

### 9.1 向量化是什么
- 将文本转换为高维向量（数字数组）
- 语义相似的文本，向量距离近

### 9.2 文本向量化
```java
@Autowired
private EmbeddingModel embeddingModel;

public float[] embed(String text) {
    EmbeddingResponse response = embeddingModel.call(
        new EmbeddingRequest(List.of(text), 
            EmbeddingOptionsBuilder.builder()
                .model("text-embedding-v2")
                .build()));
    return response.getResult().getOutput().getEmbedding();
}
```

### 9.3 向量维度对比

| 模型 | 维度 | 特点 |
|------|------|------|
| text-embedding-v2 | 1536 | 阿里云，中文优化 |
| text-embedding-ada-002 | 1536 | OpenAI，通用 |
| bge-large-zh | 1024 | 开源，中文优秀 |

### 9.4 向量数据库
| 数据库 | 特点 | 适用场景 |
|--------|------|----------|
| Milvus | 分布式，高性能 | 大规模生产 |
| Chroma | 轻量，嵌入式 | 开发测试 |
| PgVector | PostgreSQL扩展 | 已有PG的项目 |
| Redis | 内存数据库 | 低延迟需求 |

---

## 十、RAG检索增强生成（P59-P64）

### 10.1 RAG是什么
- **Retrieval-Augmented Generation**
- 让大模型基于外部知识回答问题
- 解决：知识截止、幻觉、私有数据

### 10.2 RAG工作流程
```
文档加载 → 文档切分 → 向量化 → 存入向量库
                                    ↓
用户查询 → 查询向量化 → 相似度搜索 → Top-K结果
                                    ↓
                          拼接上下文 → LLM生成回答
```

### 10.3 索引和检索
- **索引**：文档 → 向量化 → 存入向量库
- **检索**：查询 → 向量化 → 相似度搜索 → 返回相关文档

### 10.4 AI智能运维案例
```java
// 1. 文档加载
List<Document> docs = new FileSystemResourceLoader()
    .load("classpath:docs/");

// 2. 文档切分
TextSplitter splitter = new TokenTextSplitter();
List<Document> splitDocs = splitter.apply(docs);

// 3. 向量化并存储
VectorStore vectorStore = ...;
vectorStore.add(splitDocs);

// 4. RAG查询
String answer = chatClient.prompt()
    .user("如何排查CPU使用率过高？")
    .advisors(new QuestionAnswerAdvisor(vectorStore))
    .call()
    .content();
```

---

## 十一、Tool Calling工具调用（P65-P69）

### 11.1 Tool Calling是什么
- 大模型调用外部函数/工具
- 模型决定何时调用、传什么参数
- 类似函数调用，但由AI触发

### 11.2 工作流程
```
用户提问 → LLM判断需要调用工具 → 返回工具名+参数
     ↓
执行工具 → 获取结果 → 返回给LLM → LLM生成最终回答
```

### 11.3 SpringAI Tool Calling
```java
// 1. 定义工具
@Bean
public Function<WeatherRequest, WeatherResponse> getWeather() {
    return request -> {
        // 调用天气API
        return new WeatherResponse("北京", "晴", 25);
    };
}

// 2. 绑定工具
chatClient.prompt()
    .user("北京今天天气怎么样？")
    .functions("getWeather")  // 绑定工具
    .call()
    .content();
```

### 11.4 有/无Tool Calling对比
- **无Tool Calling**：LLM只能用训练数据回答，无法获取实时信息
- **有Tool Calling**：LLM可以调用API、查数据库、执行代码

---

## 十二、MCP协议（P70-P79）

### 12.1 MCP为什么出现
- Tool Calling 的问题：每个AI平台定义不同
- **MCP（Model Context Protocol）**：标准化AI工具调用协议
- 类比：USB 之于外设，MCP 之于AI工具

### 12.2 MCP核心概念

| 概念 | 说明 |
|------|------|
| MCP Server | 提供工具的服务端 |
| MCP Client | 调用工具的客户端（AI应用） |
| Tool | 可调用的函数 |
| Resource | 可读取的数据源 |
| Prompt | 预定义的提示词模板 |

### 12.3 CS架构
```
AI应用（Client）
    ↓ MCP协议（JSON-RPC）
MCP Server（提供工具）
    ↓
外部服务（API/数据库/文件系统）
```

### 12.4 本地MCP Server实现
```java
// SpringAI MCP Server
@Bean
public ToolCallbackProvider weatherToolCallbackProvider() {
    return new MethodToolCallbackProvider(
        new WeatherTools());
}

// 配置
spring.ai.mcp.server:
  enabled: true
  name: weather-server
  version: 1.0.0
```

### 12.5 百度地图MCP案例
1. 申请百度地图 API Key
2. 配置 MCP Server
3. AI应用通过 MCP 协议调用地图服务

### 12.6 MCP原理浅谈
- 基于 JSON-RPC 2.0 协议
- 支持 stdio 和 SSE 两种传输方式
- 工具描述使用 JSON Schema 格式

---

## 十三、SAA生态篇（P80-P86）

### 13.1 云上RAG
- 阿里云百炼平台的 RAG 服务
- 托管向量数据库 + 文档处理
- 适合不想自建基础设施的场景

### 13.2 工作流配置
- 百炼平台可视化工作流
- 拖拽式配置 AI 流程
- 支持条件分支、循环、并行

### 13.3 本地调用Agent
```java
// 通过百炼平台创建Agent
// 本地通过API调用
String response = chatClient.prompt()
    .user("帮我查询北京到上海的机票")
    .advisors(new AgentAdvisor("travel-agent-id"))
    .call()
    .content();
```

---

## 十四、关键概念速查

| 概念 | 一句话解释 |
|------|-----------|
| SAA | Spring AI Alibaba，Java生态的AI应用框架 |
| ChatClient | SpringAI的高级对话客户端 |
| ChatModel | 底层模型调用接口 |
| SSE | Server-Sent Events，流式输出技术 |
| Prompt | 提示词，指导AI行为的指令 |
| ChatMemory | 对话记忆，管理多轮对话历史 |
| Embedding | 向量化，将文本转为数字向量 |
| RAG | 检索增强生成，让LLM引用外部知识 |
| Tool Calling | 工具调用，让LLM调用外部函数 |
| MCP | Model Context Protocol，标准化工具调用协议 |
| VectorStore | 向量数据库，存储文档嵌入 |

---

## 十五、面试高频问题

### Q1：SpringAI 和 LangChain4j 的区别？
- **SpringAI**：Spring 官方项目，与 Spring Boot 深度集成
- **LangChain4j**：LangChain 的 Java 移植，功能更全但生态独立
- 选型：Spring 项目用 SpringAI，需要 LangChain 特性用 LangChain4j

### Q2：SSE 和 WebSocket 的区别？
- **SSE**：HTTP 长连接，服务端单向推送，适合流式输出
- **WebSocket**：独立协议，双向通信，适合实时交互
- 大模型用 SSE 因为只需服务端推流

### Q3：RAG 的核心步骤？
1. 文档加载与切分
2. 向量化并存入向量库
3. 查询向量化 + 相似度搜索
4. 拼接上下文 + LLM 生成

### Q4：MCP 解决了什么问题？
- 标准化 AI 工具调用协议
- 不同 AI 平台可以用同一套工具
- 工具提供者只需实现一次 MCP Server

### Q5：Tool Calling 的工作流程？
用户提问 → LLM 判断需要工具 → 返回工具名+参数 → 执行工具 → 结果返回 LLM → 生成回答
