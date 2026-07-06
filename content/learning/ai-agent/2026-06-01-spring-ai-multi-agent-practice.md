---
title: "Spring AI 2.0 Multi-Agent 实战：构建智能协作系统"
date: "2026-06-01"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "Spring AI 2.0 Multi-Agent 实战：构建智能协作系统"
tags:
---

# Spring AI 2.0 Multi-Agent 实战：构建智能协作系统

> **版本**: Spring Boot 4.0.0 + Spring AI 2.0.0-M4 + Java 21
> **日期**: 2026-06-01
> **关键词**: Multi-Agent, Orchestrator-Workers, MCP, Advisor, Virtual Threads

---

## 📌 一句话总结

Spring AI 2.0 提供了 MCP 协议 + Advisor 机制 + 虚拟线程，使得用纯 Java 生态构建生产级多智能体系统成为可能，核心模式是 **Orchestrator-Workers**（编排者+工作者）。

---

## 1. 架构概览：Orchestrator-Workers 模式

```
用户请求
    │
    ▼
┌─────────────────┐
│  Orchestrator    │  ← 任务分解、调度
│  (编排Agent)     │
└────────┬────────┘
         │
    ┌────┼────┬────────┐
    ▼    ▼    ▼        ▼
┌──────┐┌──────┐┌──────┐┌──────┐
│Worker││Worker││Worker││Worker│  ← 并行执行子任务
│  A   ││  B   ││  C   ││  D   │
└──┬───┘└──┬───┘└──┬───┘└──┬───┘
   └───────┴───────┴───────┘
              │
              ▼
     ┌─────────────────┐
     │  Summary Agent   │  ← 汇总输出
     └─────────────────┘
```

**核心职责划分：**
- **Orchestrator Agent**：接收用户请求，分解为子任务，分配给 Worker
- **Worker Agent**：各自执行独立子任务（可并行），返回结构化结果
- **Summary Agent**：汇总所有 Worker 结果，生成最终回复

---

## 2. Spring AI 2.0 核心特性

### 2.1 MCP（Model Context Protocol）

- **定位**：AI 工具的"USB 接口"——即插即用
- **作用**：标准化 Agent 与外部工具/数据源的交互协议
- **MCP Client 配置**：Spring AI 提供 `McpClient` 自动发现和调用 MCP Server 暴露的工具
- **SSE 流式传输**：MCP 支持 Server-Sent Events 进行实时工具调用结果推送

### 2.2 Advisor 机制（AOP for AI）

- **类比**：Spring AOP 的拦截器链，但作用于 AI 调用链
- **内置 Advisor**：
  - `MessageChatMemoryAdvisor` — 记忆管理
  - `QuestionAnswerAdvisor` — RAG 检索增强
  - `SafeGuardAdvisor` — 安全护栏/内容过滤
- **自定义 Advisor**：实现 `CallAdvisor` 或 `StreamAdvisor` 接口

### 2.3 Virtual Threads（Java 21）

- **优势**：多 Agent 并行执行时，每个 Worker 使用虚拟线程，避免 OS 线程爆炸
- **配置**：`ExecutorService.newVirtualThreadPerTaskExecutor()`
- **适用场景**：多 Worker 并行调用 LLM，IO 密集型任务

---

## 3. 核心代码模式

### 3.1 BaseAgent 抽象类

```java
public abstract class BaseAgent {
    protected final ChatClient chatClient;
    protected final ChatMemory chatMemory;
    
    public BaseAgent(ChatClient.Builder builder, ChatMemory chatMemory, 
                     String conversationId) {
        this.chatMemory = chatMemory;
        this.chatClient = builder
            .defaultAdvisors(
                MessageChatMemoryAdvisor.builder(chatMemory)
                    .conversationId(conversationId)
                    .build()
            )
            .build();
    }
    
    public String chat(String userMessage) {
        return chatClient.prompt()
            .user(userMessage)
            .call()
            .content();
    }
}
```

**要点：**
- 每个 Agent 绑定独立的 `conversationId` 实现记忆隔离
- `ChatClient` 是 Spring AI 2.0 的统一 API 入口
- Advisor 链通过 `defaultAdvisors` 注入

### 3.2 @Tool 注解（工具调用）

```java
@Component
public class SearchTool {
    @Tool(description = "Search for information about the given topic")
    public String search(@ToolParam("The search query") String query) {
        // 实现搜索逻辑
        return searchResult;
    }
}
```

- `@Tool` 注解让 LLM 自动发现和调用工具
- Spring AI 自动将 Java 方法转换为 MCP/Function Call 格式

### 3.3 并行 Agent 执行

```java
// 虚拟线程执行器
ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

// 并行执行多个 Worker
List<CompletableFuture<String>> futures = workers.stream()
    .map(worker -> CompletableFuture.supplyAsync(
        () -> worker.chat(subtask), executor))
    .toList();

// 等待所有 Worker 完成
List<String> results = futures.stream()
    .map(CompletableFuture::join)
    .toList();
```

---

## 4. 生产实战要点

### 4.1 记忆隔离（conversationId 后缀）

```java
// 不同场景使用不同 conversationId 后缀
String techConvId = conversationId + "-tech";   // 技术问答
String prodConvId = conversationId + "-prod";   // 生产问题
String generalConvId = conversationId + "-gen";  // 通用对话
```

**原因**：同一个用户的对话，在不同 Agent 间需要独立记忆，避免上下文污染。

### 4.2 降级处理（LLM JSON 输出失败）

LLM 返回的结构化 JSON 经常格式不合法，需要兜底：

```java
public ProductInfo parseWithFallback(String llmOutput) {
    try {
        return objectMapper.readValue(llmOutput, ProductInfo.class);
    } catch (JsonProcessingException e) {
        // 降级：用正则提取关键字段
        log.warn("LLM JSON解析失败，使用正则降级", e);
        return regexFallbackParse(llmOutput);
    }
}
```

**最佳实践：**
- 优先 JSON Schema 约束 LLM 输出格式
- 二层兜底：正则提取关键字段
- 三层兜底：返回默认值/告警

### 4.3 Redis 持久化（MessageWindowChatMemory）

```java
// 内存版（重启丢失）
ChatMemory memory = MessageWindowChatMemory.builder()
    .maxMessages(20)
    .build();

// Redis 持久化版（生产环境）
ChatMemory redisMemory = new RedisChatMemory(redisTemplate, Duration.ofDays(7));
```

**注意：**
- 滑动窗口控制 token 消耗（`maxMessages`）
- Redis TTL 设置合理过期时间，避免存储无限增长
- 序列化格式建议 JSON，方便排查问题

---

## 5. Agent Message Bus（跨服务通信）

多 Agent 系统在微服务架构下的通信模式：

```
Service A (Agent 1) ──消息总线──▶ Service B (Agent 2)
        │                              │
        └──────异步事件/回调────────────┘
```

**实现方案：**
- **Redis Pub/Sub**：轻量级，适合简单事件通知
- **Kafka/RocketMQ**：需要可靠投递和顺序保证时
- **Spring Cloud Stream**：统一抽象，方便切换 MQ

---

## 6. 面试高频追问

| 问题 | 参考答案要点 |
|------|-------------|
| MCP 和 Function Call 的区别？ | MCP 是协议层标准，Function Call 是 OpenAI 的工具调用机制。MCP 更通用，支持跨模型、跨框架 |
| Advisor 和 AOP 的关系？ | Advisor 是 Spring AI 对 AOP 思想的借鉴——在 AI 调用链上插入拦截器，处理记忆/RAG/安全等横切关注点 |
| 多 Agent 并行为什么用虚拟线程？ | LLM 调用是 IO 密集型，虚拟线程成本低（~1KB 栈），不占用 OS 线程，可支撑数百 Worker 并行 |
| 记忆隔离为什么不用不同 ChatMemory？ | 同一 Redis 实例 + conversationId 后缀，比多个 ChatMemory 实例更轻量，且共享连接池 |
| 降级策略怎么设计？ | JSON Schema约束 → 正则兜底 → 默认值+告警，三层防御 |

---

## 7. 技术栈版本

| 组件 | 版本 | 说明 |
|------|------|------|
| Java | 21 | 虚拟线程支持 |
| Spring Boot | 4.0.0-M4 | 预览版 |
| Spring AI | 2.0.0-M4 | MCP + Advisor |
| Redis | 7.x | ChatMemory 持久化 |

---

## 8. 知识图谱速记

```
Spring AI 2.0 Multi-Agent
├── 架构：Orchestrator-Workers
│   ├── Orchestrator：任务分解+调度
│   ├── Worker：并行子任务执行
│   └── Summary：结果汇总
├── 核心特性
│   ├── MCP：工具即插即用协议
│   ├── Advisor：AI 调用链拦截器（AOP 思想）
│   └── ChatClient：统一 API 入口
├── 生产要点
│   ├── 记忆隔离：conversationId 后缀
│   ├── 降级：JSON→正则→默认值
│   └── 持久化：Redis + TTL
└── 并行方案
    ├── Virtual Threads（Java 21）
    └── CompletableFuture
```

---

> 📝 **面试话术**：Spring AI 2.0 通过 MCP 协议实现工具标准化，Advisor 机制实现调用链拦截（类比 AOP），结合 Java 21 虚拟线程实现多 Agent 并行，生产级需要做好记忆隔离、降级兜底和持久化。
