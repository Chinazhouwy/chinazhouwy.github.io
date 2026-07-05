# 28天 Agent 开发学习路线

> **来源**: 小红书
> **类型**：📚 参考资料（非面试题/面经）
> **链接**: http://xhslink.com/o/7VYrxwTm0BI
> **标签**: #大模型 #Agent开发 #学习路线 #八股文

---

## 📅 28天学习路线总览

### 1️⃣ Agent 基本概念
- 什么是 Agent
- Agent vs Workflow
- 单 Agent vs Multi-Agent
- Agent 的组成（LLM + 记忆 + 规划 + 工具使用）
- Agent 运行流程
- Agent 范式

### 2️⃣ Agent 开发 / 工程核心

| 模块 | 内容 |
|------|------|
| **工具相关** | Tool Calling、Function Calling、MCP、Skills |
| **记忆机制** | Short-Term Memory、Long-Term Memory、Memory 压缩、Memory 检索 |
| **上下文工程** | Prompt Engineering、Context Window 管理、幻觉治理、Context 压缩 |
| **检索增强（RAG）** | Embedding、Chunking、Retrieval、Rerank、Graph RAG、Agentic RAG |
| **多智能体** | 多 Agent 编排、Router、Supervisor、Agent 通信 |
| **智能体协议** | MCP、ACP、A2A |
| **开发框架** | LangChain、LangGraph、AutoGen、CrewAI、Mastra、LlamaIndex、PydanticAI |
| **可观测性和评估** | Trace、Logging、LLM as Judge |
| **部署** | API 部署、Streaming、WebSocket、Docker |

### 3️⃣ 大模型基础 / 扩展
- Transformer
- Token、Context Window
- 微调（SFT、RL）
- 推理（Inference）
- 训练

### 4️⃣ Agent 前沿概念
- Harness Engineering
- 主流范式：Coding Agent、Browser Agent、Deep Research Agent、Workflow Agent、Multi-Agent

---

## 🧠 Agent 核心架构

### Agent 是什么？
Agent（智能体）是一种能够感知环境、自主决策、执行行动的 AI 系统。与传统的一问一答式 LLM 调用不同，Agent 具备以下核心能力：
- **目标导向**：自主拆解、执行、迭代
- **工具使用**：调用外部 API/工具
- **记忆管理**：短期 + 长期记忆
- **规划能力**：任务分解、路径规划

### Agent 架构组件
```
LLM Brain → Planning → Memory → Tool Call
```
- **LLM Brain**: 核心推理引擎
- **Planning**: 任务分解与路径规划
- **Memory**: Long-term（持久化）+ Short-term（当前任务上下文）
- **Tool Call**: 外部工具集成

### Agent 类型
| 类型 | 说明 |
|------|------|
| **ToolsCallingAgent** | 最基础，单任务，直接调用工具 |
| **ReActAgent** | Thought → Action → Observation 循环 |
| **ReflectionAgent** | 批评者模式，持续改进 |
| **PlanAndSolveAgent** | 先规划再执行 |
| **Multi-Agent** | 层级式/Hybrid，多角色协作 |
| **Human-in-the-Loop** | 含人工兜底 |

### Agent Loop 核心循环
```
感知 → 推理 → 规划 → 执行 → 观察 → 迭代
```
各环节需要关注：成本控制、延迟、可观测性、可靠性

### Workflow vs Agent
| 维度 | Workflow | Agent |
|------|----------|-------|
| 流程 | 固定编排 | 自主决策 |
| 适用场景 | 确定性任务 | 复杂不确定任务 |
| 可调试性 | 高 | 低 |
| 成本控制 | 可控 | 动态 |

---

## 🔧 推理模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| CoT / Direct | 直接推理/链式思考 | 简单逻辑 |
| ReAct | 推理 + 行动循环 | 工具调用场景 |
| Reflection | 自我反思改进 | 代码生成、写作 |
| Tree of Thoughts | 多路径探索 | 复杂规划 |
| Sequential Workflow | 串行流程 | 确定性业务 |
| Human-in-the-Loop | 人工介入兜底 | 高安全场景 |

---

## 📚 RAG 全流程

RAG（检索增强生成）完整流程四个阶段：
1. **数据准备**（Ingestion）：文档、数据库等知识源
2. **索引构建**：Chunking → Embedding → 向量存储
3. **检索**：Query → Embedding → 向量检索 → Rerank
4. **生成**：Context + Query → LLM → Answer

---

## 🛠 学习资源

### 面试题库
- AI应用开发面试题（Agent/RAG）
- AI大模型面试题-基础篇
- Agent 基础知识面试题
- Agent 记忆机制/上下文管理
- RAG 系统常见问题合集
- 网络基础八股文（HTTPS/TLS 等）

### 框架学习
- **LangChain**: 从入门到实战开发（附代码）
- **LangGraph**: 从入门到实战
- **Spring AI + RAG + Milvus**

### 实战项目
- 智能出行 Agent 助手
- RAG 知识库助手实战
- Vibe coding（AI编辑器全栈开发）
- 从零搭建知识库问答助手
- MCP + LangGraph 结合

### 面试加分点
> 关注：**落地经验、工程实践、可靠性设计、成本控制和可观测性**

---

## 🔐 网络基础（HTTPS）

HTTPS = HTTP + TLS/SSL，在 TCP 之上加了一层加密传输层。

**TLS 1.2 完整握手流程**：
1. TCP 三次握手
2. ClientHello：客户端发送支持的 TLS 版本、加密套件列表、Client Random
3. ServerHello：服务器选定 TLS 版本和加密套件，返回 Server Random 和数字证书
4. 证书验证：检查证书链、域名、有效期、吊销状态
5. 密钥交换：Pre-Master Secret 用公钥加密传输，双方计算会话密钥
6. 切换加密通信

**TLS 1.3 改进**：2-RTT → 1-RTT，支持 0-RTT；移除 RSA，全面使用 ECDHE。

---

> **关联路线图**: [Java开发者转型AI Agent路线图](./ai-agent-learning-roadmap.md)

---

## 原始链接

http://xhslink.com/o/7VYrxwTm0BI

