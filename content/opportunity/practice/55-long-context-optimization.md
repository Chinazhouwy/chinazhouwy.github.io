---
title: "AI Agent · 超长上下文冗余优化"
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
summary: "AI Agent · 超长上下文冗余优化"
tags:
schema_version: "1"
question_id: "55"
question: "AI Agent · 超长上下文冗余优化"
sources:
  - "tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md"
  - "ai-agent/backend-to-agent-transition.md"
  - "ai-agent/claude-code-dynamic-workflows.md"
score: "5/10"
round: "R0"
next_review: "2026-07-07"
session_id: "unknown"
---

## 第55题 · AI Agent · 超长上下文冗余优化

**题目**：超长上下文冗余怎么优化？摘要、裁剪、子 Agent 怎么取舍？

### 用户回答

> 分为长期记忆、中期记忆和短期记忆。长期记忆存到表里或用另一个模型进行意图提取。短期记忆去掉语气词、助词、谢谢、你好这些，采用 FIFO 取最近的，再加上远期意图信息拼成当前对话窗口。子 Agent 是对任务而言，长任务拆成多个 Agent 并行处理，每个 Agent 返回时信息提取合并，控制信息在一定范围内。

### 评分：5/10

### 扣分点
1. 记忆分层方向对但细节缺失（-1）
2. 短期记忆裁剪只说了去噪，缺少摘要压缩技术（-2）
3. 子 Agent 说了并行但缺少 Map-Reduce 模式和上下文传递细节（-2）

### 最终修正版

| 技术 | 用途 | 实现方式 |
|------|------|----------|
| 滑动窗口 | 控制短期记忆大小 | 固定窗口 / 重要性窗口 / 混合窗口 |
| 摘要压缩 | 减少旧对话 token 占用 | Rolling Summary / Progressive Summarization |
| 向量检索 | 中期记忆召回 | Embedding + 相似度匹配 |
| Landmark 标记 | 保留关键决策点 | 重要消息打标记，裁剪时强制保留 |
| 子 Agent 并行 | 大任务拆分 | Map-Reduce / 上下文压缩传递 |
| 上下文隔离 | 防止信息污染 | 子 Agent 不共享原始上下文 |

### 复习骨架

记忆分层 → 滑动窗口+摘要压缩 → 向量检索中期记忆 → 子Agent Map-Reduce + 上下文压缩传递
