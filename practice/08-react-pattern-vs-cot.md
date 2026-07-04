---
schema_version: 1
question_id: 8
question: "AI Agent · ReAct 模式 vs CoT"
date: 2026-05-29
sources:
  - unknown
score: "7/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
## 第8题 · AI Agent · ReAct 模式 vs CoT

**题目**：Agent 的 ReAct 模式是什么？和单纯的 Chain of Thought（CoT）有什么区别？追问：Agent 调用外部工具时 ReAct 的循环是怎么运转的？

### 用户回答（摘要）

> React模式是通过一个循环，大模型推理分析，调用tool，再推理分析这样的流程，天气查询大概就是这样的流程，COT是模型自身的思维链，是一次完整模型调用中的一部分

### 评分：7/10

### 扣分点

1. ReAct 循环少了一步：观察（Observe）（-1.5）
2. CoT 和 ReAct 的关系没说清楚（-1）
3. 没提 ReAct 名字由来（-0.5）

### 正确答案

- ReAct = Reasoning + Acting，循环：Reason → Act → Observe → Reason...
- CoT 是模型内部思维链，单次调用完成，没有工具调用
- CoT 是 ReAct 里 Reason 步骤的核心，ReAct = CoT + 工具调用
---

## 回顾记录（2026-07-02，R5）

**得分：5/10**（首次 7/10，退步 2 分，原因：混淆了 CoT 的本质）

### 用户回答
- ReAct 是和 AI 交互的方式，先推理再行动
- AI 判断调哪个工具/MCP，调完把结果塞回 AI，形成反馈循环
- ReAct 是工程手段，CoT 是模型天生的、训练时就有的思维链
- CoT 是模型自我思考的过程

### 追问+纠正记录
1. **CoT 的本质纠正**：CoT 既是 Prompt 技术，也是模型训练出来的能力。模型训练时内化了逐步推理能力，Prompt（如"Let's think step by step"）只是把这种能力激发出来。说"纯粹是 Prompt 技术"太片面
2. **ReAct vs CoT 核心区别**：CoT 没有外部交互（纯内部推理），ReAct 有工具调用+观察反馈（Thought→Action→Observation 循环）
3. **早期模型 CoT 效果差**：因为训练时没充分学好逐步推理，能力不够，Prompt 激发不出来

### 最终结论
CoT = 模型训练内化的逐步推理能力 + Prompt 激发；ReAct = CoT + 工具调用 + 观察反馈循环。两者都是 Prompt 技术，但 CoT 的推理能力来自训练。

### 这次讨论的收获
- CoT 不是纯粹的 Prompt 技术，推理能力来自模型训练
- Prompt 是"触发器"，模型能力是"基础"
- ReAct = CoT + Act + Observe，形成外部交互循环

