---
schema_version: "1"
question_id: "71"
question: "ReAct 原理和工程落地怎么讲？什么时候会循环失败？"
date: "2026-07-22"
sources:
  - "practice/08-react-pattern-vs-cot.md"
  - "practice/20-agent-architecture-react.md"
  - "tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md"
  - "content/sources/agentscope-java2-series/02.md"
score: "5/10"
round: "R0"
next_review: "2026-07-23"
session_id: "unknown"
status: "completed"
title: "第71题：ReAct 原理和循环失败"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "ReAct 原理和工程落地，循环失败场景"
tags:
  - "AI Agent"
  - "ReAct"
  - "Architecture"
---

# 第71题：ReAct 原理和循环失败

## 题目
ReAct 原理和工程落地怎么讲？什么时候会循环失败？

## 用户原始回答
> 以AI决策为中心，由AI自主决策，让他先分析问题，给出推理步骤，根据当前的工具情况来决定下一步的流程。工具调用失败？

## 评分与扣分点

**评分：5/10**

- 答对了核心方向：AI 自主决策、分析问题、根据工具情况决定下一步
- 知道工具调用失败是循环失败的一种
- 缺少 ReAct 名称拆解（Reasoning + Acting）
- 缺少四步循环结构（Thought → Action → Observation）
- 循环失败场景只提到一种，缺少死循环、推理跑偏等

## 完整答案

### ReAct 是什么
ReAct = **Re**asoning + **Act**ing（推理 + 行动）

核心思想：让 LLM 交替进行"思考"和"行动"，而不是一次性给出答案。

### 四步循环
```
Thought（我想想）→ Action（我调工具）→ Observation（我看结果）→ 循环
```

1. **Thought**：分析当前状态，推理下一步该做什么
2. **Action**：决定调用哪个工具，传什么参数
3. **Observation**：拿到工具返回的结果
4. 回到 Thought，根据 Observation 继续推理，直到得出最终答案

### 工程落地要点
- 最大循环次数限制（防止无限循环）
- 超时熔断（单次工具调用或整体流程）
- 重复 Action 检测（连续调同一个工具就停）
- 结构化输出（Thought/Action/Observation 用固定格式解析）

### 循环失败场景

| 失败类型 | 表现 | 工程对策 |
|----------|------|----------|
| 死循环 | 每次 Thought 都决定调同一个工具，拿到同样结果 | 检测重复 Action，连续 N 次相同就强制终止 |
| 工具持续失败 | 调用报错但 Agent 不换策略，一直重试 | 限制同一工具重试次数，失败后换工具或降级 |
| 推理跑偏 | Thought 的推理方向错了，越走越远 | 进度检测：连续几轮没有信息增量就触发重新规划 |
| 没有终止条件 | Agent 不知道什么时候算"完成" | 设最大循环次数 + 最终答案格式检测 |

### 推理跑偏的处理（加分项）
推理跑偏本质是 Agent 缺乏"元认知"（对自己思考过程的思考）。工程解法：
1. **进度检测**：跟踪信息增量，连续无新信息就触发重规划
2. **自我反思**：在 Thought 阶段加自检——"我目前的推理和目标还相关吗？"
3. **外部仲裁**：用另一个模型或规则系统判断推理链是否合理
4. **人类介入**：关键节点暂停，让人确认方向再继续
5. **强制重置**：丢掉中间推理，只保留目标，从头重新规划

## 面试回答模板
> ReAct 是 Reasoning 加 Acting 的缩写，核心是让 LLM 交替思考和行动：Thought 分析问题、Action 调工具、Observation 看结果，循环直到得出答案。工程上要防几种循环失败：死循环靠重复检测，工具失败靠重试限制，推理跑偏靠进度检测和自我反思，还要设最大循环次数兜底。推理跑偏本质是缺乏元认知，工程上通过外部仲裁和人类介入来弥补。
