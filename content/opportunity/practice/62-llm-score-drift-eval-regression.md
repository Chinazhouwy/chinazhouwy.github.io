---
schema_version: "1"
question_id: "62"
question: "LLM 评分漂移怎么做 Eval 回归？固定样本、指标和阈值怎么设计？"
date: "2026-07-17"
sources:
  - "content/projects/interview-harness/interview-harness-deep-research.md"
  - "content/opportunity/practice/57-agent-evaluation-system.md"
score: "0/10"
round: "R0"
next_review: "2026-07-18"
session_id: "20260717_195827_11958e52"
status: "completed"
title: "第62题：LLM 评分漂移的 Eval 回归设计"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "LLM 评分漂移怎么做 Eval 回归"
tags:
  - "Harness"
  - "Eval"
  - "Regression"
---

# 第62题：LLM 评分漂移的 Eval 回归设计

## 题目

LLM 评分漂移怎么做 Eval 回归？固定样本、指标和阈值怎么设计？

## 用户原始回答

> 不会，哈哈。

## 评分与扣分点

**评分：0/10（未作答）**

该分数只记录本轮原始回答，没有把后续展示的参考答案计入用户得分。

## GPT 纠错

- GPT 纠错：原记录正文写“不评分”，frontmatter 和台账却写 `0/10`，事实不一致；现统一为“0/10（未作答）”。
- GPT 纠错：固定 Case 单次运行不足以识别随机波动。同一版本至少重复运行若干次，统计均值、方差、分位数或最差结果。
- GPT 纠错：“改后指标没变差就算通过”不完整。回归门禁应同时包含绝对质量底线和相对基线退化容忍度。

## 完整答案

每个 Eval Case 固定以下内容：

```yaml
case_id: thread-pool-incomplete-001
question_version: JAVA-001-v3
rubric_version: THREAD-POOL-v2
answer: "核心参数有 corePoolSize、maximumPoolSize、keepAliveTime..."
expected_covered: [THREAD_POOL_PARAMS]
expected_missing: [REJECTION_POLICY, POOL_SIZING]
expected_incorrect: []
expected_score_range: [5, 7]
```

每次修改 Prompt、Rubric、模型或结构化输出逻辑后，使用同一批 Case 回归，并固定记录：

- 模型和 Provider 版本；
- Prompt、Rubric、代码和数据集版本；
- temperature 等采样参数；
- 每个 Case 的重复运行次数和原始结果。

核心指标包括：

- Covered precision/recall；
- Missing recall；
- Incorrect precision、false positive rate；
- Evidence 精确匹配率；
- Score range pass rate；
- 追问方向命中率；
- 结构化输出成功率、延迟和 Token 成本。

阈值先通过首批人工标注样本建立基线，再设置两类门禁：

1. 绝对门禁，例如 Incorrect false positive rate 不得超过上限。
2. 相对门禁，例如 Covered recall 相对基线下降不得超过容忍值。

对于存在随机性的模型，对每个 Case 重复运行，比较均值和波动；高风险错误可以使用
“任一次出现即失败”的门禁。Eval 的目标不是证明模型绝对正确，而是让每次改动的质量变化
可测量、可解释、可阻断。

## 面试回答模板

> 我会准备版本化的固定 Eval Case，标注 expectedCovered、expectedMissing、
> expectedIncorrect、Evidence 和 scoreRange。每次改 Prompt、Rubric 或模型都跑同一批
> Case，并重复运行统计波动。指标既看 Covered/Missing 的 precision 和 recall，也看错误
> 误报、Evidence、分数区间、结构化成功率和成本。门禁同时设置绝对质量底线与相对基线
> 退化阈值，未达标就阻止发布。

