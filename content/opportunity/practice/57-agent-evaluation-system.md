---
title: "AI Agent — 评测体系设计：任务成功率、工具调用准确率、幻觉率"
date: "2026-07-08"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "AI Agent — 评测体系设计：任务成功率、工具调用准确率、幻觉率"
tags:
  - "ai-agent"
  - "evaluation"
  - "metrics"
schema_version: "1"
question_id: "57"
question: "AI Agent — 评测体系设计：任务成功率、工具调用准确率、幻觉率怎么测？"
sources:
  - "ai-agent/bytedance-agent-interview-round2.md"
  - "codex gpt 修复点.md"
  - "ai-agent/agent-interview-questions-summary.md"
score: "5/10"
round: "R0"
next_review: "2026-07-11"
session_id: "unknown"
---

# 第57题：AI Agent — 评测体系设计：任务成功率、工具调用准确率、幻觉率

> 日期：2026-07-08
> 来源：`ai-agent/bytedance-agent-interview-round2.md`; `codex gpt 修复点.md`; `ai-agent/agent-interview-questions-summary.md`

---

## 第一轮：初始回答

**得分：5/10**

用户回答要点：
- 启动子线程监控（Runtime Tracing）✓
- 人工评测 ✓
- 认为没有其他好办法

漏掉的：
- 离线测试集（最重要）
- LLM-as-Judge（自动化评测）
- A/B 测试
- 具体指标定义
- Agent 特有的评测维度

---

## 核心概念

### 三个核心指标

```
任务成功率 = 完成的任务数 / 总任务数
工具调用准确率 = 正确调用次数 / 总调用次数
幻觉率 = 编造内容次数 / 总输出次数
```

### Agent 评测 vs RAG 评测

| 维度 | RAG 评测 | Agent 评测 |
|------|----------|------------|
| 核心指标 | 召回率、精确率、幻觉率 | 任务成功率、工具调用准确率、幻觉率 |
| 评测方式 | 离线测试集 + LLM-as-Judge + 人工 | 离线测试集 + LLM-as-Judge + 人工 |
| 独特点 | 检索质量（找全了没、准不准） | 执行质量（做完了没、做对了没） |

**本质区别：**
```
RAG：给问题 → 找文档 → 生成答案
     评测重点：找对了没？答案有没有编？

Agent：给任务 → 规划 → 调工具 → 再规划 → 再调工具 → 完成
     评测重点：做完了没？每步调对了没？有没有编？
```

### Agent 多出来的评测维度

```
① 规划能力：任务拆解是否合理
② 工具调用：参数对不对、选对工具没
③ 错误恢复：调用失败后能不能自救
④ 多步推理：中间步骤会不会跑偏
```

### 评测方式完整版

| 方式 | 用途 | 成本 |
|------|------|------|
| 离线测试集 | 版本回归、策略对比 | 中（需标注） |
| LLM-as-Judge | 日常迭代验证 | 低 |
| 人工评测 | 校准 LLM-as-Judge | 高 |
| Runtime Tracing | 事后分析、debug | 低 |
| A/B 测试 | 验证最终效果 | 低（周期长） |

### 离线测试集（最重要）

```
准备 50-100 个标准任务 + 期望输出
每次改策略/模型后跑一遍
对比：成功率从 72% → 85%？
这才是真正的"评测"，不是"监控"
```

### LLM-as-Judge（自动化评测）

```
用另一个大模型打分
输入：[任务描述] + [Agent 输出] + [参考答案]
输出：1-5 分 + 理由

比人工快 100 倍，可以天天跑
```

### Runtime Tracing（用户说的"子线程监控"）

```
记录每次工具调用的：输入、输出、耗时、是否成功
用于事后分析，不是评测本身
```

---

## 用户追问纠正记录

1. "子线程监控"更准确叫 Runtime Tracing
2. 离线测试集是最可靠的评测方式，不只是"监控"
3. Agent 评测比 RAG 多了规划、工具调用、错误恢复等维度
4. LLM-as-Judge 可以自动化，比人工快 100 倍

---

## 这次讨论的收获

- Agent 评测框架跟 RAG 类似，只是指标不同
- 离线测试集是最可靠的评测方式
- LLM-as-Judge 可以自动化日常评测
- Runtime Tracing 用于事后分析，不是评测本身
- Agent 特有维度：规划能力、工具调用准确率、错误恢复
