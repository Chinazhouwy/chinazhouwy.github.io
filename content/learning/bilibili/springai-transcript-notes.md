---
title: "SpringAI Alibaba教程笔记（尚硅谷86集转写整理）"
date: "2026-07-21"
domain: "技术"
area: "AI Agent"
type: "学习笔记"
status: "可复习"
priority: "P1"
energy: "high"
visibility: "private"
summary: "基于86集视频转写内容，按模块整理的Spring AI Alibaba完整知识点笔记，涵盖SAA入门、ChatClient、SSE、Prompt、ChatMemory、多模态、向量化、RAG、Tool Calling、MCP、生态篇"
tags:
  - SpringAI
  - SpringAIAlibaba
  - SAA
  - RAG
  - MCP
  - ToolCalling
  - SSE
  - ChatMemory
  - Embedding
  - PromptEngineering
  - Java
  - AI
source: "B站"
source_url: "https://www.bilibili.com/video/BV1pvWGznEqh/"
author: "尚硅谷"
total_episodes: 86
---

# SpringAI Alibaba教程笔记（尚硅谷86集转写整理）

> 来源：B站 · 尚硅谷  
> 链接：https://www.bilibili.com/video/BV1pvWGznEqh/  
> 配套资料：关注公众号「尚硅谷教育」回复"SpringAI"免费获取  
> 课程定位：Spring AI Alibaba 实战（RAG、SAA、MCP）  
> 课程版本：Spring AI Alibaba 1.0.0.2 + Spring AI 1.0 + Spring Boot 3.5.5

---

## 一、SAA概述与入门（P01-P12）

### 1.1 SAA是什么

- **Spring AI Alibaba** = Spring AI + 阿里云百炼平台生态
- 类比：Spring AI 是东风小康汽车，SAA 是加持了华为鸿蒙智驾的问界M9
- Spring Cloud Alibaba 对标 Spring Cloud，SAA 对标 Spring AI
- 一句话总结：Spring AI 的功能全部具备，额外集成了阿里云百炼平台（智能体、工作流、Agent、知识库、知识图谱、MCP）

### 1.2 为什么需要SAA

- 大模型 API 各家不同（OpenAI/通义千问/DeepSeek），SAA 提供统一抽象层
- 切换模型只需改配置，不用改代码
- Java 生态原生集成（Spring Boot Starter）
- 微服务与大模型之间的桥梁调度框架

### 1.3 框架对比

| 框架 | 语言 | 生态 | 特点 |
|------|------|------|------|
| LangChain | Python | Python生态 | 功能最全，社区最大 |
| LangChain4j | Java | Java生态 | LangChain的Java移植 |
| Spring AI | Java | Spring生态 | Spring官方，与Boot深度集成 |
| Spring AI Alibaba | Java | Spring+阿里云 | 增加百炼平台支持（推荐） |

**选择建议**：三个框架80%功能相似，学通一个再学另外两个顺手拈来。SAA 已经把 Spring AI 慢慢替了，就像 Spring Cloud Alibaba 把 Spring Cloud 替了。

### 1.4 前置知识

- **必须**：JDK17+、Spring Boot 3、Maven、Redis
- **建议**：了解 Docker、Linux、大模型基本概念

### 1.5 大模型调用三件套

1. **API Key**（密钥）：阿里云百炼平台 → 密钥管理 → 创建
2. **模型名称**（Model）：模型广场 → 查看详情 → 拷贝模型名（如 `qwen-plus`）
3. **Base URL**（调用地址）：API 参考 → 拷贝地址

### 1.6 入门案例（Hello World）

**Maven依赖**：
```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-alibaba-starter-dashscope</artifactId>
</dependency>
```

**application.properties配置**：
```properties
server.port=8080
spring.ai.dashscope.api-key=${DASHSCOPE_API_KEY}
# 三件套配置：api-key, base-url, model（使用DashScope时可省略后两个）
```

**核心代码**：
```java
// ChatModel方式（简单调用）
@Autowired
private ChatModel chatModel;

public String doChat(String message) {
    return chatModel.call(new Prompt(message))
        .getResult().getOutput().getContent();
}

// 流式调用
public Flux<String> streamChat(String message) {
    return chatModel.stream(new Prompt(message))
        .map(response -> response.getResult().getOutput().getContent());
}

// ChatClient方式（推荐）
@Autowired
private ChatClient chatClient;

public String doChat(String message) {
    return chatClient.prompt()
        .user(message)
        .call()
        .content();
}
```

### 1.7 DashScope vs OpenAI 协议

- **OpenAI 协议**：通用标准，泛之四海皆准（类比国语普通话）
- **DashScope 协议**：阿里巴巴灵积服务，阿里生态专用（类比方言）
- 使用 SAA 框架时，三件套配置只需要配一个 API Key，其余使用默认值

### 1.8 模型切换

- 通过阿里云百炼平台统一入口，可切换 DeepSeek、通义千问等不同模型
- 只需修改 `spring.ai.dashscope.chat.options.model` 配置即可
- **DeepSeek 两个版本**：V3（查询对话型）、R1（深度思考推理型）

---

## 二、Ollama本地模型（P13-P16）

### 2.1 Ollama是什么

- 本地运行大模型的工具，借鉴 Docker 容器镜像思想
- Docker 玩镜像，Ollama 玩大模型
- 提供兼容 OpenAI 的 API 接口，默认端口 **11434**

### 2.2 安装要点

```bash
# 安装（Linux/Mac）
curl -fsSL https://ollama.com/install.sh | sh

# 下载模型
ollama pull qwen2.5:7b

# 启动服务
ollama serve

# 查看已下载模型
ollama list

# 查看运行中的模型实例
ollama ps

# 退出对话
/bye
```

### 2.3 模型参数说明

- **B** = Billion（十亿参数），7B = 70亿参数
- 7B 需要至少 8GB 可用内存
- 推荐小版本练习：千问2.5 latest（4.7G）

### 2.4 SpringAI集成Ollama

**Maven依赖**：
```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-starter-model-ollama</artifactId>
</dependency>
```

**配置**：
```yaml
spring:
  ai:
    ollama:
      base-url: http://localhost:11434
      chat:
        model: qwen2.5:latest
```

### 2.5 多模型共存问题

当同时引入 DashScope 和 Ollama 时，后台会报错：
> 一个组件要求一个单一的bean，但找到了两个（DashScope ChatModel 和 Ollama ChatModel）

**解决方案**：使用 `@Qualifier` 指定具体的 ChatModel

---

## 三、ChatClient与ChatModel（P17-P20）

### 3.1 两者对比

| 维度 | ChatModel | ChatClient |
|------|-----------|------------|
| 注入方式 | 支持自动注入 | **不支持**自动注入，需手动注入 |
| 调用方式 | `call()` / `stream()` | `prompt().user().call().content()` |
| 编程风格 | 传统样板代码 | 链式调用、流式编程 |
| 功能 | 基础模型调用 | 支持记忆、工具、RAG等高级功能 |
| 结构化输出 | 需手动解析 | 自动映射为对象 |

### 3.2 ChatClient注入方式

**方式一：构造注入（推荐，支持多模型）**
```java
@Bean
public ChatClient chatClient(ChatClient.Builder builder) {
    return builder
        .defaultSystem("你是一个助手")
        .defaultFunctions("getWeather")
        .build();
}
```

**方式二：编程方式创建**
```java
ChatClient client = ChatClient.builder(chatModel)
    .defaultOptions(DashScopeChatOptions.builder()
        .model("deepseek-v3")
        .build())
    .build();
```

### 3.3 关键结论

- ChatClient 是**不可变的**，每次 `.build()` 生成新实例
- 实际工作中 ChatModel 和 ChatClient **混合使用**
- ChatClient 基于 ChatModel 构建（"离开我你啥都不是"）

---

## 四、SSE流式输出（P21-P26）

### 4.1 SSE是什么

- **Server-Sent Events**：服务端向客户端推送事件
- HTTP 长连接，服务端单向推送
- 大模型逐字输出的基础技术

### 4.2 面试题：SSE vs WebSocket vs 轮询

| 技术 | 方向 | 连接 | 适用场景 |
|------|------|------|----------|
| SSE | 服务端→客户端 | HTTP长连接 | 大模型流式输出 |
| WebSocket | 双向 | 独立连接 | 聊天室、游戏 |
| 轮询 | 客户端→服务端 | 短连接反复请求 | 低频更新 |

**下一代**：Streamable HTTP（SSE升级版，支持双向通信）

### 4.3 流式输出代码

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

### 4.4 多模型共存配置

```java
@Configuration
public class MultiModelConfig {
    
    @Bean("deepseekChatModel")
    public ChatModel deepseekChatModel() {
        return new DashScopeChatModel(
            DashScopeApi.builder()
                .apiKey(env.getProperty("DASHSCOPE_API_KEY"))
                .build(),
            DashScopeChatOptions.builder()
                .model("deepseek-v3")
                .build()
        );
    }

    @Bean("qwenChatModel")
    public ChatModel qwenChatModel() {
        return new DashScopeChatModel(
            DashScopeApi.builder()
                .apiKey(env.getProperty("DASHSCOPE_API_KEY"))
                .build(),
            DashScopeChatOptions.builder()
                .model("qwen-plus")
                .build()
        );
    }
}
```

**使用时**：用 `@Qualifier` 指定具体模型

### 4.5 前后端联调

```java
@GetMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<String> chatStream(@RequestParam String message) {
    return chatClient.prompt()
        .user(message)
        .stream()
        .content();
}
```

**前端 JavaScript**：
```javascript
const eventSource = new EventSource(url + '?message=' + encodeURIComponent(msg));
eventSource.onmessage = function(event) {
    messagesDiv.innerHTML += event.data;  // 流式追加
};
eventSource.onerror = function(error) {
    eventSource.close();  // 错误时关闭连接
};
```

---

## 五、提示词工程（P27-P37）

### 5.1 提示词四大角色（必背）

| 角色 | 说明 | 示例 |
|------|------|------|
| **System** | 系统设定，定义AI行为边界 | "你是一个Java面试官" |
| **User** | 用户输入的问题 | "解释HashMap原理" |
| **Assistant** | AI的回复（历史） | 模型的回答 |
| **Tool** | 工具返回的结果 | 天气查询结果 |

### 5.2 提示词API演变

```
String → UserMessage → Prompt → (更复杂的组合)
```

- String：最简单的字符串提问
- UserMessage：包装后的用户消息对象
- Prompt：包含 `List<Message>` + `ChatOptions` 的完整提示词

### 5.3 提示词模板

**方式一：字符串模板（代码写死）**
```java
String template = """
    你是一个{role}专家。
    请用{language}解释以下概念：{concept}
    """;

Prompt prompt = PromptTemplate.create(template)
    .create(Map.of("role", "Java", "concept", "JVM"));
```

**方式二：配置文件分离**
```java
@Value("classpath:prompts/user-template.txt")
private Resource userTemplate;

// 模板文件内容：
// "讲一个关于{topic}的故事，并以{format}格式输出"
```

**方式三：角色设定 + 边界划分**
```java
chatClient.prompt()
    .system(sb -> sb
        .text("你是{role}助手，只回答{domain}相关问题，其他回答'无可奉告'")
        .param("role", "法律")
        .param("domain", "法律"))
    .user(userMessage)
    .call()
    .content();
```

### 5.4 三套框架角色对比

| 框架 | 枚举名 | 角色 |
|------|--------|------|
| LangChain4j | ChatMessageType | system, user, AI, tool, customer |
| Spring AI | MessageType | system, user, assistant, tools |
| Spring AI Alibaba | MessageType | 同 Spring AI |

---

## 六、格式化输出（P38-P40）

### 6.1 为什么需要

- 模型返回自由文本，程序难以处理
- 结构化输出便于类型校验和后续处理

### 6.2 使用Record类（JDK14+）

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

### 6.4 自定义参数的格式化输出

```java
chatClient.prompt()
    .user(spec -> spec
        .text("我叫{name}，专业{major}，邮箱{email}")
        .param("name", "张三")
        .param("email", "zhangsan@test.com"))
    .call()
    .entity(StudentRecord.class);
```

---

## 七、ChatMemory对话记忆（P41-P47）

### 7.1 记忆是什么

- 大模型是**无状态的**，不保留先前交互信息
- 多轮对话需要记住之前的上下文
- SpringAI 通过 ChatMemory 管理对话历史

### 7.2 两个核心痛点

1. **持久化**：内存存储重启就没了，需要存入 Redis/MySQL 等
2. **对话窗口上限**：不可能无限制保存，需要设定最大消息数

### 7.3 三件套核心组件

| 组件 | 作用 |
|------|------|
| **ChatMemoryRepository** | 接口，定义存储方式（InMemory / Redis） |
| **MessageWindowChatMemory** | 消息窗口，设定最大保存条数（默认20条） |
| **MessageChatMemoryAdvisor** | 顾问增强器，将记忆功能注入 ChatClient |

### 7.4 Redis持久化实现

```java
// 1. 配置类 - 实现 ChatMemoryRepository
@Configuration
public class RedisMemoryConfig {
    @Bean
    public ChatMemoryRepository chatMemoryRepository() {
        return new RedisChatMemoryRepository(
            RedisChatMemory.builder()
                .jedisPool(jedisPool)
                .build());
    }
}

// 2. 构建 ChatMemory
ChatMemory chatMemory = MessageWindowChatMemory.builder()
    .chatMemoryRepository(chatMemoryRepository)
    .maxMessages(10)  // 最大10条
    .build();

// 3. ChatClient 加载 Advisor
ChatClient client = ChatClient.builder(chatModel)
    .defaultAdvisors(new MessageChatMemoryAdvisor(chatMemory))
    .build();

// 4. 调用时指定 userId
client.prompt()
    .user(userMessage)
    .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, userId))
    .call()
    .content();
```

**Redis Key 格式**：`SPRING_AI_CHAT_MEMORY:{conversationId}`  
**存储类型**：List  
**Redis依赖**：
```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-starter-memory-redis</artifactId>
</dependency>
<dependency>
    <groupId>redis.clients</groupId>
    <artifactId>jedis</artifactId>
</dependency>
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
                .model("wanx-v1")  // 通义万象2.1
                .build()));
    return response.getResult().getOutput().getUrl();
}
```

- 模型选择：千问Image（擅长中英文文本）、通义万象（通用场景）
- 参数：n（生成数量）、width/height（尺寸）

### 8.2 语音合成（CosyVoice）

```java
@Autowired
private SpeechSynthesisModel speechModel;

public void textToVoice(String text) {
    SpeechSynthesisPrompt prompt = new SpeechSynthesisPrompt(text,
        DashScopeSpeechSynthesisOptions.builder()
            .model("cosyvoice-v2")
            .voice("longjiachui")  // 音色：龙吟催
            .build());
    
    SpeechSynthesisResponse response = speechModel.call(prompt);
    // 保存为 mp3 文件
    Files.write(Path.of("output.mp3"), 
        response.getResult().getOutput().getAudio());
}
```

- 模型版本：V1、V2、V3、V3 Plus（越高越好，越贵越好）
- 音色列表：男声/女声/童声/方言等，需与模型版本对应

---

## 九、向量化与向量数据库（P51-P58）

### 9.1 向量是什么

- 向量 = 具有**大小**和**方向**的量
- 文本向量化：将文本转换为**浮点数数组**
- 语义相似的文本，向量距离近

### 9.2 向量化示例

```
汽车 → [4, 1, 1, 5]  // 4轮、有发动机、地上开、5座
飞机 → [6, 1, 0, 200] // 6轮、有发动机、不在地上开、200座
```

- **余弦相似度**：通过向量夹角判断相似程度
- 维度越多，描述越精确（通常 1024 维）

### 9.3 EmbeddingModel

```java
@Autowired
private EmbeddingModel embeddingModel;

public float[] embed(String text) {
    EmbeddingResponse response = embeddingModel.call(
        new EmbeddingRequest(List.of(text), 
            EmbeddingOptionsBuilder.builder()
                .model("text-embedding-v3")
                .build()));
    return response.getResult().getOutput().getEmbedding();
}
```

### 9.4 向量维度对比

| 模型 | 维度 | 特点 |
|------|------|------|
| text-embedding-v3 | 1024 | 阿里云，推荐 |
| text-embedding-v2 | 1536 | 阿里云，中文优化 |
| text-embedding-ada-002 | 1536 | OpenAI，通用 |
| bge-large-zh | 1024 | 开源，中文优秀 |

### 9.5 向量数据库对比

| 数据库 | 特点 | 适用场景 |
|--------|------|----------|
| **Redis Stack** | 增强版Redis，全家桶 | 推荐（已有Redis基础） |
| Milvus | 分布式，高性能 | 大规模生产 |
| Chroma | 轻量，嵌入式 | 开发测试 |
| PgVector | PostgreSQL扩展 | 已有PG的项目 |
| In-Memory | 内存 | 测试（重启丢失） |

### 9.6 Redis Stack

- Redis 实验室推出的**增强版**Redis
- = 原生Redis + Elasticsearch + Neo4j + JSON + 时序 + 概率结构
- 支持：JSON、全文搜索、**向量搜索**、图查询
- 安装：`docker run -d --name redis-stack -p 6379:6379 redis/redis-stack-server:latest`

### 9.7 向量化存储与查询

```java
@Autowired
private VectorStore vectorStore;

// 存储文档
vectorStore.add(documents);

// 相似度查询
List<Document> results = vectorStore.similaritySearch(
    SearchRequest.builder()
        .query("买一部手机")
        .topK(5)
        .build());
```

**SpringAI VectorStore Redis 配置**：
```yaml
spring:
  ai:
    vectorstore:
      redis:
        uri: redis://localhost:6379
        index: custom-index
        prefix: "embedding:"
        initialize-schema: true
```

---

## 十、RAG检索增强生成（P59-P64）

### 10.1 RAG是什么

- **Retrieval-Augmented Generation**：检索增强生成
- 给大模型准备"小抄"，解决知识截止、幻觉、私有数据问题
- **三种解决大模型知识不足的方法**：RAG、微调、混合使用

### 10.2 RAG工作流程（两步）

```
【索引阶段】
文档加载 → 文本切分(chunk) → 向量化(embedding) → 存入向量库

【检索阶段】
用户查询 → 查询向量化 → 相似度搜索(Top-K) → 拼接上下文 → LLM生成回答
```

### 10.3 AI智能运维案例

```java
// 1. 初始化 - 加载文档到向量数据库
@PostConstruct
public void init() {
    // 读取文件
    TextReader reader = new TextReader(opsFile);
    reader.setCharset(StandardCharsets.UTF_8);
    
    // 文本切分
    List<Document> documents = new TokenTextSplitter()
        .apply(reader.read());
    
    // 去重判断（Redis setnx）
    String source = "ops.txt";
    String key = "vector:ops:" + SecurityUtil.md5(source);
    Boolean exists = redisTemplate.hasKey(key);
    
    if (!Boolean.TRUE.equals(exists)) {
        vectorStore.add(documents);
        redisTemplate.opsForValue().set(key, "1");
    }
}

// 2. RAG查询
@GetMapping("/rag/query")
public String ragQuery(@RequestParam String question) {
    return chatClient.prompt()
        .user(question)
        .advisors(new QuestionAnswerAdvisor(vectorStore))
        .call()
        .content();
}
```

### 10.4 向量数据库去重

- 问题：每次重启微服务都会重复加载文档
- 方案：使用 Redis `setNX` 判断文档是否已加载
- 对文件名做 MD5 加密后作为 Redis key

---

## 十一、Tool Calling工具调用（P65-P69）

### 11.1 Tool Calling是什么

- 大模型调用外部函数/工具，获取实时信息
- 模型决定何时调用、传什么参数
- **大模型本身不执行函数**，只指示调用哪个函数及参数

### 11.2 工作流程（泳道图）

```
用户提问 → 程序调用LLM → LLM判断是否需要工具
    ├── 不需要 → 直接返回回复
    └── 需要 → 返回工具名+参数 → 执行工具 → 结果返回LLM → LLM生成最终回答
```

### 11.3 定义工具类

```java
public class DateTimeTools {
    
    @Tool(description = "获取当前时间")
    public String getCurrentTime() {
        return LocalDateTime.now().format(
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }
    
    // @Tool 参数说明：
    // description: 工具描述（必填）
    // returnDirect: 是否直接返回（默认false，由LLM整合后返回）
}
```

### 11.4 ChatModel方式使用Tool Calling

```java
// 1. 注册工具
ToolCallbackProvider toolProvider = ToolCallbacks.forAll(new DateTimeTools());

// 2. 构建Options
ChatOptions options = DashScopeChatOptions.builder()
    .withToolCallbacks(toolProvider)
    .build();

// 3. 调用
ChatResponse response = chatModel.call(
    new Prompt("现在几点了？", options));
```

### 11.5 ChatClient方式使用Tool Calling

```java
chatClient.prompt()
    .user("现在几点了？")
    .tools(new DateTimeTools())
    .call()
    .content();
```

### 11.6 returnDirect 参数

- `false`（默认）：工具结果返回给LLM，LLM整合后回复
- `true`：工具结果直接返回给用户，不经过LLM处理

### 11.7 注意事项

- Tool Calling 使用前提是大模型要支持 function calling
- Tool Calling 和 RAG 都能增强大模型，但一个是工具类，一个是知识库

---

## 十二、MCP协议（P70-P79）

### 12.1 MCP为什么出现

- Tool Calling 的痛点：每个微服务都要带一份工具类，重复劳动
- MCP 解决：**共用 + 数量**，一个 MCP Server 提供多个工具
- 类比：微服务的 OpenFeign 是服务间通讯，MCP 是**大模型间通讯**

### 12.2 MCP核心概念

| 概念 | 说明 |
|------|------|
| **MCP Server** | 提供工具的服务端 |
| **MCP Client** | 调用工具的客户端（AI应用） |
| **Tool** | 可调用的函数 |
| **Resource** | 可读取的数据源 |
| **Prompt** | 预定义的提示词模板 |

### 12.3 CS架构

```
AI应用（Client）
    ↓ MCP协议（JSON-RPC 2.0）
MCP Server A（时间服务）
MCP Server B（天气服务）
MCP Server C（百度地图）
    ↓
外部服务（API/数据库/文件系统）
```

### 12.4 MCP 通信协议

| 协议 | 特点 | 适用 |
|------|------|------|
| **STDIO** | 标准输入输出 | 本地集成，双向流 |
| **SSE** | HTTP长连接 | 远程服务，单向推送 |

### 12.5 本地MCP Server实现

```java
// 1. 工具服务类
@Service
public class WeatherService {
    public String getWeather(String city) {
        return switch(city) {
            case "北京" -> "晴，25℃";
            case "上海" -> "多云，22℃";
            default -> "未查到城市";
        };
    }
}

// 2. MCP Server配置
@Bean
public ToolCallbackProvider weatherToolCallbackProvider() {
    return MethodToolCallbackProvider.builder()
        .toolObjects(new WeatherService())
        .build();
}
```

**MCP Server配置**（application.yml）：
```yaml
spring:
  ai:
    mcp:
      server:
        enabled: true
        name: weather-server
        version: 1.0.0
```

**注意**：MCP Server 要引入 `mcp-server-webflux`，启动 **Netty**（不是Tomcat）

### 12.6 本地MCP Client实现

**Maven依赖**：
```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-starter-mcp-client</artifactId>
</dependency>
```

**配置**：
```yaml
spring:
  ai:
    mcp:
      client:
        stdio:
          servers:
            weather-server:
              command: java
              args: -jar, weather-server.jar
        sse:
          connections:
            server1:
              url: http://localhost:8014
```

**使用**：
```java
@Autowired
private ChatClient chatClient;  // 已集成 MCP 能力

chatClient.prompt()
    .user("北京今天天气怎么样？")
    .call()
    .content();
```

### 12.7 百度地图MCP案例

1. 申请百度地图 API Key
2. 安装 Node.js 环境
3. 配置 `mcp-server.json5`：
```json5
{
  "mcpServers": {
    "baidu-map": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@baidu/map-mcp-server"],
      "env": {
        "BAIDU_MAP_API_KEY": "你的AK"
      }
    }
  }
}
```

4. 通过 ChatClient 调用，可获得：地理编码、天气预报、路线规划、IP定位等功能

### 12.8 MCP vs Tool Calling

| 维度 | Tool Calling | MCP |
|------|-------------|-----|
| 使用方式 | 自己携带工具类 | 调用外部MCP Server |
| 共用性 | 每个服务各带一份 | 全局共用 |
| 数量 | 一个工具做一件事 | 一个Server多个工具 |
| 协议 | 无标准 | 标准化MCP协议 |
| 类比 | 内联工具类 | 微服务RPC调用 |

### 12.9 MCP源码分析要点

- 百度MCP Server 本质是 Node.js 的 `index.js` 脚本
- 使用 `@modelcontextprotocol/sdk` 的 Server SDK
- 基于 **JSON-RPC 2.0** 协议通信
- 工具描述使用 **JSON Schema** 格式

---

## 十三、SAA生态篇（P80-P86）

### 13.1 云上RAG（AI智能运维）

**与本地RAG的区别**：知识库存放在阿里云百炼平台

**搭建步骤**：
1. 上传数据到阿里云百炼平台（应用数据 → 导入）
2. 创建知识库（选择非结构化数据 → 配置 → 导入）
3. 命中测试验证

**Java代码调用**：
```java
// 1. 构建百炼RAG检索器
DashScopeApi dashScopeApi = new DashScopeApi(apiKey);
DocumentRetriever retriever = dashScopeApi.documentRetrieverBuilder()
    .knowledgeBaseId("ops知识库ID")
    .workspaceId("业务空间ID")  // 必填！
    .build();

// 2. 使用 Advisor 增强
chatClient.prompt()
    .user("00000是什么意思？")
    .advisors(new RetrievalAdvisor(retriever))
    .call()
    .content();
```

**踩坑点**：
- 知识库 ID 和名称要区分
- 必须配置 `workspaceId`（类似Java包名），否则报 `Index Not Exist`
- 通过 DashScopeApi 源码可发现缺失参数

### 13.2 工作流配置

- 在阿里云百炼平台可视化编排 AI 流程
- 支持：开始节点 → 大模型节点 → 结束节点
- 节点库：大模型、知识库、MCP、应用组件、API、插件

**配置步骤**：
1. 创建工作流应用
2. 拖拽配置节点（开始 → 大模型 → 结束）
3. 配置提示词和变量
4. 发布，获取应用 ID

### 13.3 本地调用Agent

```java
// 1. 配置 Agent App ID
private String appId = "饿了么今天吃什么的Agent ID";

// 2. 构建 DashScope Agent
DashScopeAgent agent = new DashScopeAgent(
    new DashScopeAgentApi(new DashScopeApi(apiKey)));

// 3. 调用
DashScopeAgentOptions options = DashScopeAgentOptions.builder()
    .withAppId(appId)
    .build();

Prompt prompt = new Prompt("今天吃什么", options);
AgentResponse response = agent.call(prompt);
```

---

## 十四、关键概念速查

| 概念 | 一句话解释 |
|------|-----------|
| SAA | Spring AI Alibaba，Java生态的AI应用框架 |
| ChatClient | SpringAI的高级对话客户端（支持记忆/工具/RAG） |
| ChatModel | 底层模型调用接口 |
| SSE | Server-Sent Events，流式输出技术 |
| Prompt | 提示词，指导AI行为的指令 |
| ChatMemory | 对话记忆，管理多轮对话历史 |
| Embedding | 向量化，将文本转为数字向量 |
| VectorStore | 向量数据库，存储文档嵌入 |
| RAG | 检索增强生成，让LLM引用外部知识 |
| Tool Calling | 工具调用，让LLM调用外部函数 |
| MCP | Model Context Protocol，标准化工具调用协议 |
| DashScope | 阿里巴巴灵积服务，大模型调用协议 |
| Advisor | 顾问增强器，为ChatClient添加额外功能 |
| Record | JDK14+记录类，等价于Entity+Lombok |

---

## 十五、面试高频问题

### Q1：SpringAI 和 LangChain4j 的区别？
- **SpringAI**：Spring 官方项目，与 Spring Boot 深度集成
- **LangChain4j**：LangChain 的 Java 移植，功能更全但生态独立
- **选型**：Spring 项目用 SpringAI，需要 LangChain 特性用 LangChain4j

### Q2：SSE 和 WebSocket 的区别？
- **SSE**：HTTP 长连接，服务端单向推送，适合流式输出
- **WebSocket**：独立协议，双向通信，适合实时交互
- 大模型用 SSE 因为只需服务端推流
- **下一代**：Streamable HTTP（SSE升级版）

### Q3：RAG 的核心步骤？
1. **索引阶段**：文档加载 → 文本切分 → 向量化 → 存入向量库
2. **检索阶段**：查询向量化 → 相似度搜索(Top-K) → 拼接上下文 → LLM生成

### Q4：MCP 解决了什么问题？
- 标准化 AI 工具调用协议
- 不同 AI 平台可以用同一套工具
- 工具提供者只需实现一次 MCP Server
- 类比：大模型界的 OpenFeign / USB Type-C

### Q5：Tool Calling 的工作流程？
用户提问 → LLM判断需要工具 → 返回工具名+参数 → 执行工具 → 结果返回LLM → 生成回答

### Q6：ChatMemory 的三件套？
1. **ChatMemoryRepository**：存储方式（Redis/InMemory）
2. **MessageWindowChatMemory**：窗口大小限制
3. **MessageChatMemoryAdvisor**：功能增强器

### Q7：向量数据库和关系数据库的区别？
- 关系数据库：精确匹配（`WHERE id = 1`）
- 向量数据库：**相似性搜索**（余弦相似度）
- 用途：推荐系统、语义搜索、RAG知识库

### Q8：Tool Calling 和 MCP 的区别？
- Tool Calling：自己携带工具类，各自独立
- MCP：全局共享，标准化协议，一个Server多个工具
- MCP 是 Tool Calling 的**增强/替代**方案
