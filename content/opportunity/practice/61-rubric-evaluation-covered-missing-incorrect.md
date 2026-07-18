---
schema_version: "1"
question_id: "61"
question: "面试系统的 Rubric 评测怎么设计？Covered、Missing、Incorrect、Evidence 如何结构化？"
date: "2026-07-17"
sources:
  - "content/projects/interview-harness/interview-harness-deep-research.md"
  - "content/projects/site-life-os/codex-gpt-fixes.md"
score: "5/10"
round: "R0"
next_review: "2026-07-18"
session_id: "20260717_195827_11958e52"
status: "completed"
title: "第61题：Rubric 评测的 Covered/Missing/Incorrect/Evidence 设计"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "面试系统的 Rubric 评测怎么设计"
tags:
  - "Harness"
  - "Eval"
  - "Rubric"
---

# 第61题：Rubric 评测的 Covered/Missing/Incorrect/Evidence 设计

## 题目

面试系统的 Rubric 评测怎么设计？Covered、Missing、Incorrect、Evidence 如何结构化？

## 用户原始回答

> 先让模型根据用户回答拆解，再调用一次模型进行分析。

## 评分与扣分点

**评分：5/10**

- 两阶段思路可行：先提取回答中的声明，再对照 Rubric 评估。
- 没有说明 Rubric 条目、Evidence 和评分结果的数据结构。
- 没有说明如何防止 Evidence 被模型改写或编造。

## GPT 纠错

- GPT 纠错：原回答把“三段式”说成必需的完整方案，这是过度断言。提取、评估、计分是三个逻辑职责，不等于必须调用三次模型；一次结构化调用、两阶段调用或混合实现都可以。
- GPT 纠错：Evidence 不能只要求模型“引用原话”。必须验证引用确实存在于用户原始回答，最好保存原文片段及字符位置。
- GPT 纠错：最终分数和追问优先级不必再次交给模型自由判断。Rubric 有权重和必答项时，可以由确定性代码计算，减少评分漂移。

## 完整答案

Rubric 应先拆成稳定的知识点条目：

```json
{
  "rubricItemId": "THREAD_POOL_REJECTION",
  "description": "说明线程池的拒绝策略及触发条件",
  "weight": 2,
  "required": true
}
```

一次评测结果按 Rubric 条目输出：

```json
{
  "rubricItemId": "THREAD_POOL_REJECTION",
  "verdict": "MISSING",
  "evidence": [],
  "explanation": "用户回答未提及队列和最大线程数均耗尽后的处理",
  "confidence": 0.94
}
```

四个概念的边界：

- `Covered`：用户正确覆盖了 Rubric 条目，必须附可核验原文。
- `Missing`：Rubric 要求的内容没有出现，Evidence 通常为空。
- `Incorrect`：用户明确说了错误结论，必须附错误原文和纠正说明。
- `Evidence`：用户原始回答中的精确片段，可增加 `startOffset`、`endOffset`。

实现可以有三种：

1. 单次结构化评测：成本低，适合第一版。
2. 两阶段：先提取 Claims，再对照 Rubric，适合长回答或证据要求高的场景。
3. 混合方式：模型负责语义匹配，Java 负责 Evidence 校验、权重计分和追问规则。

## 面试回答模板

> 我会先把标准答案拆成带 ID、权重和必答标记的 RubricItem。评测结果不只给总分，而是
> 对每个条目输出 Covered、Missing 或 Incorrect；Covered 和 Incorrect 必须引用用户原话，
> 并由代码校验引用确实存在。模型负责语义判断，Java 负责 Schema 校验、Evidence 校验和
> 权重计分。提取和评估可以一次或两次调用，是否拆调用要通过 Eval 比较质量、延迟和成本。

