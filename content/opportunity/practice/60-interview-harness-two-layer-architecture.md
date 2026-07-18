---
schema_version: "1"
question_id: "60"
question: "Interview Harness 为什么要拆成 Interview Orchestrator 和 Agent Runtime 两层？边界和失败隔离怎么讲？"
date: "2026-07-17"
sources:
  - "content/projects/interview-harness/interview-harness-deep-research.md"
  - "content/learning/ai-agent/AgentScope-Java-1.1.0-Harness-Framework.md"
score: "4/10"
round: "R0"
next_review: "2026-07-18"
session_id: "20260717_195827_11958e52"
status: "completed"
title: "第60题：Interview Harness 两层架构拆分"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "Interview Harness 为什么要拆成 Interview Orchestrator 和 Agent Runtime 两层"
tags:
  - "Harness"
  - "Agent"
  - "架构设计"
---

# 第60题：Interview Harness 两层架构拆分

## 题目

Interview Harness 为什么要拆成 Interview Orchestrator 和 Agent Runtime 两层？边界和失败隔离怎么讲？

## 用户原始回答

> 先根据各种状态变量判断是什么规则，实在不行，就让模型判断。

## 评分与扣分点

**评分：4/10**

- 答对了“确定性规则优先由状态变量判断”的方向。
- 没有明确哪些决策属于业务规则、哪些能力只是通过模型完成。
- “实在不行交给模型”边界过宽，可能让模型接管本应确定的状态迁移。

## GPT 纠错

- GPT 纠错：原回答把“评测判断”直接归为 Agent Runtime 职责，边界不准确。Runtime 只负责模型、工具、Hook、事件、技术状态和循环控制；Rubric 评测属于面试业务能力，可以通过 Runtime 调用模型，但业务语义和结果校验不属于 Runtime。
- GPT 纠错：“是否做归 Orchestrator、怎么做归 Runtime”只能作为简化记忆。更严格的边界是：业务状态迁移和策略归 Orchestrator，模型调用的可靠执行归 Runtime，自然语言生成与结构化评测由业务组件借助 Runtime 完成。
- GPT 纠错：失败隔离不只是“能够从断点恢复”。Runtime 失败时，Orchestrator 必须保持当前题状态不前进，记录失败事件，并通过幂等重试、人工重试或恢复任务继续。

## 完整答案

`InterviewOrchestrator` 管理确定性的面试业务流程：

- 当前题号、会话阶段和追问次数；
- 根据已经校验的评测结果决定是否追问；
- 进入下一题或结束面试；
- 以事务方式持久化业务状态和能力证据。

`AgentRuntime` 管理可复用的模型执行基础设施：

- 模型请求、消息格式和结构化响应；
- Tool Call 的解析、权限、执行和结果回填；
- AgentState、Hook、类型化事件和上下文策略；
- 超时、取消、最大循环次数和连续失败限制。

Rubric 评测或追问生成是业务能力。业务组件准备 Rubric 和 Prompt，通过 Runtime 调用模型，
再校验结构化结果，最后由 Orchestrator 决定状态迁移。

失败隔离的关键是：Runtime 调用失败不能让面试状态自动跳到下一题或结束。当前业务状态
保持不变，失败记录带上 `sessionId`、`questionId`、`attemptId` 和 `traceId`；重试使用同一个
幂等键，成功后才提交下一次状态迁移。

## 面试回答模板

> 我把面试业务和 Agent 执行拆成两层。Orchestrator 负责题号、追问次数、状态迁移和结束
> 条件，这些必须是确定性的 Java 规则；Agent Runtime 负责模型、工具、Hook、事件、超时
> 和循环限制。评测服务可以通过 Runtime 调用模型，但评测语义和“是否追问”的决策仍属于
> 业务层。Runtime 失败时不推进业务状态，记录失败并幂等重试，因此模型异常不会破坏整场
> 面试流程。

