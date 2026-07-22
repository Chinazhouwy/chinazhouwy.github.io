---
schema_version: "1"
question_id: "70"
question: "Agent 和普通 LLM 调用有什么区别？工具、记忆、规划分别是什么？"
date: "2026-07-22"
sources:
  - "tencent/2026-06-07-wxg-wechat-pay-cool-jing.md"
  - "practice/20-agent-architecture-react.md"
  - "ai-agent/agent-interview-questions-summary.md"
  - "content/sources/agentscope-java2-series/01.md"
  - "content/sources/agentscope-java2-series/02.md"
score: "4/10"
round: "R0"
next_review: "2026-07-23"
session_id: "unknown"
status: "completed"
title: "第70题：Agent 与普通 LLM 调用的区别"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "Agent 和普通 LLM 调用的区别"
tags:
  - "AI Agent"
  - "Architecture"
---

# 第70题：Agent 与普通 LLM 调用的区别

## 题目
Agent 和普通 LLM 调用有什么区别？工具、记忆、规划分别是什么？

## 用户原始回答
> agent是一个管理工程，包括记忆，窗口，工具，流程；LLM 只是单纯的和AI对话

## 评分与扣分点

**评分：4/10**

- 答对了方向：Agent 是管理工程，LLM 是单纯对话
- 提到了记忆、工具、流程等要素
- 但没有展开每个要素的具体含义和区别
- 缺少"规划"能力的解释
- 缺少工具调用、记忆分类、规划循环的具体描述

## 完整答案

**普通 LLM 调用**是一问一答：用户输入 → 模型生成文本 → 返回。没有外部能力，没有状态保持，没有主动决策。

**Agent** 是在 LLM 基础上增加了三个核心能力：

### 工具（Tool Calling）
- 普通 LLM：只能基于训练数据生成文本，问"今天天气"只能瞎编
- Agent：能调 API、查数据库、执行代码、操作文件，拿到真实结果后再回答
- 关键词：Function Calling、MCP、Tool Loop

### 记忆（Memory）
- 普通 LLM：单轮对话，关了窗口就忘了
- Agent：有短期记忆（当前对话上下文窗口）和长期记忆（跨会话持久化，如向量数据库、摘要存储）
- 能记住用户偏好、历史交互、项目上下文

### 规划（Planning）
- 普通 LLM：你问一句它答一句，没有主动拆解能力
- Agent：能把复杂任务拆成步骤，按顺序执行，中间还能根据结果调整计划
- 典型模式：ReAct（Thought → Action → Observation 循环）

**一句话总结：** 普通 LLM 调用是"一问一答"，Agent 是"感知-规划-执行-反馈"的闭环。

## 面试回答模板
> 普通 LLM 调用是一问一答，模型只能基于训练数据生成文本。Agent 在此基础上增加了三个核心能力：一是工具调用，能调 API、查数据库拿到真实结果；二是记忆，包括短期上下文和长期持久化；三是规划，能把复杂任务拆成步骤，通过 ReAct 循环自主决策执行。本质上 Agent 是一个"感知-规划-执行-反馈"的闭环系统。
