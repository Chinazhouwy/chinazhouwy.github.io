---
title: "AI Agent · MCP、RAG、Skill 三者区别和组合方式"
date: "2026-07-06"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "AI Agent · MCP、RAG、Skill 三者区别和组合方式"
tags:
schema_version: "1"
question_id: "56"
question: "AI Agent · MCP、RAG、Skill 三者区别和组合方式"
sources:
  - "tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md"
  - "practice/21-mcp-protocol-vs-function-calling.md"
  - "ai-agent/agentium-mcp-execution-mechanism.md"
score: "6/10"
round: "R0"
next_review: "2026-07-07"
session_id: "unknown"
---

## 第56题 · AI Agent · MCP、RAG、Skill 三者区别和组合方式

**题目**：MCP、RAG、Skill 三者区别和组合方式是什么？

### 用户回答

> MCP 是 Model Context Protocol，模型获取外部信息的通用协议，通过它调用外部接口获取知识。RAG 是外挂文档库，防止知识冻结和幻觉，切割文档存向量数据库，模型查询。Skill 是一套方法论策略，渐进式披露提示词，模型一步一步操作，包括提示词和脚本。

### 评分：6/10

### 扣分点
1. MCP 只说了"通用协议"，缺少标准化、动态发现、统一调用等关键特性（-1）
2. RAG 流程不完整，缺少查询改写、Reranker、引用追踪等（-1）
3. Skill 不准确，不只是"方法论+提示词+脚本"，是结构化工作流（-2）

### 最终修正版

| 维度 | MCP | RAG | Skill |
|------|-----|-----|-------|
| 本质 | 通信协议 | 知识库 | 工作流 |
| 解决什么 | 工具调用标准化 | 知识冻结/幻觉 | 复杂任务编排 |
| 类比 | USB-C 接口 | 图书馆 | 操作手册 |
| 动态性 | 运行时发现工具 | 离线索引在线检索 | 预定义步骤 |
| 组合方式 | 被 Skill 调用 | 被 Skill 调用 | 编排 MCP + RAG |

### 复习骨架

MCP（标准化协议，动态发现+统一调用）→ RAG（查询改写+向量检索+Rerank+引用追踪）→ Skill（结构化工作流，编排MCP+RAG）
