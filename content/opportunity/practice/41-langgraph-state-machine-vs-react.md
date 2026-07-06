---
title: "AI Agent — LangGraph 状态图执行模型 + 与 ReAct Loop 的区别"
date: "2026-07-01"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "AI Agent — LangGraph 状态图执行模型 + 与 ReAct Loop 的区别"
tags:
schema_version: "1"
question_id: "41"
question: "AI Agent — LangGraph 状态图执行模型 + 与 ReAct Loop 的区别"
sources:
  - "ai-agent/langgraph-state-machine-engine.md"
  - "ai-agent/bytedance-agent-interview-round2.md"
score: "0/10"
round: "R0"
next_review: "unknown"
session_id: "unknown"
---

# 第41题：AI Agent — LangGraph 状态图执行模型 + 与 ReAct Loop 的区别

> 日期：2026-07-01
> 来源：`ai-agent/langgraph-state-machine-engine.md`; `ai-agent/bytedance-agent-interview-round2.md`

---

## 第一轮：初始回答

**得分：0/10** 😰

完全不了解 LangGraph，只记得"节点流转"。知道 LangChain 但没学过 LangGraph。

---

## 核心概念

### LangChain vs LangGraph

```
LangChain = 工具箱（LLM调用、Prompt模板、工具定义）
LangGraph = 流程引擎（基于LangChain零件，定义Agent执行流程）
```

### LangGraph 四个核心概念

| 概念 | 含义 | 类比 |
|------|------|------|
| **State（状态）** | 节点之间传递的数据包 | 共享字典 |
| **Node（节点）** | 一个处理步骤（函数） | 流程图里的处理框 |
| **Edge（边）** | 节点之间的跳转关系 | 流程图里的箭头 |
| **Conditional Edge** | 根据条件决定下一步去哪 | 流程图里的菱形判断 |

### 与 ReAct Loop 的区别

| 维度 | ReAct Loop | LangGraph |
|------|-----------|-----------|
| 流程控制 | LLM 自己决定 | 代码写死 |
| 可调试性 | 难（黑盒） | 容易（每步有状态） |
| 条件分支 | 隐式（LLM推理） | 显式（代码定义） |
| 并行 | 不支持 | 支持 |
| 断点恢复 | 不支持 | Checkpoint |
| 适用场景 | 简单任务 | 复杂业务流程 |

### 代码示例

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict

class MyState(TypedDict):
    user_input: str
    intent: str
    tool_result: str
    answer: str

def intent_node(state):
    intent = llm.call(f"判断意图：{state['user_input']}")
    return {"intent": intent}

def weather_node(state):
    result = weather_api.get(extract_city(state["user_input"]))
    return {"tool_result": result}

def answer_node(state):
    answer = llm.call(f"用以下信息回答：{state['tool_result']}")
    return {"answer": answer}

def route_by_intent(state):
    return state["intent"]  # weather / currency / chat

graph = StateGraph(MyState)
graph.add_node("intent", intent_node)
graph.add_node("weather", weather_node)
graph.add_node("answer", answer_node)

graph.set_entry_point("intent")
graph.add_conditional_edges("intent", route_by_intent, {
    "weather": "weather",
    "currency": "currency",
    "chat": "chat"
})
graph.add_edge("weather", "answer")
graph.add_edge("answer", END)

app = graph.compile()
result = app.invoke({"user_input": "今天北京天气怎么样"})
```

### 意图识别是所有生产级 Agent 的第一步

```
为什么必须先做意图识别？
  → 不做意图识别，LLM可能调错工具、走错分支
  → 意图识别后走固定分支，流程可控

实现方式：
  ① LLM 判断（最常见，灵活）
  ② 关键词/正则（零成本，快）
  ③ 分类模型（最快，省token）
  ④ 混合方案（推荐：先关键词，再LLM）
```

### ReAct + 工具做意图识别为什么"别扭"

```
根本原因：ReAct里LLM同时是"决策者"和"执行者"
  → LLM可能跳过意图识别直接调工具
  → LLM可能调错工具
  → 流程不可控

LangGraph = 把决策权写在代码里，LLM只管执行
  → 分工明确，流程可控
```

---

## 用户追问纠正记录

1. "节点流转"理解方向对，但缺了State、Edge、Conditional Edge的概念
2. 意图识别是生产级Agent第一步，用户直觉正确
3. ReAct+工具做意图识别"别扭"是因为流程不可控，用户直觉正确
4. LangGraph和AgentScope的RoutingGraphService本质是同一套思想

---

## 这次讨论的收获

- LangGraph = LangChain的流程引擎，用状态图定义Agent执行流程
- 核心概念：State（数据包）、Node（处理步骤）、Edge（跳转关系）、Conditional Edge（条件分支）
- 与ReAct区别：ReAct是LLM自己推理，LangGraph是代码写死流程
- 意图识别是所有生产级Agent的第一步
- 简单任务ReAct够用，复杂业务必须LangGraph
- AgentScope的RoutingGraphService和LangGraph本质一样

## GPT 纠错

- GPT 纠错：LangGraph 与 ReAct 不是同一层的互斥方案。LangGraph 是图运行时，可以在图中直接实现 ReAct Loop，也可以实现固定工作流或两者混合。
- GPT 纠错：LangGraph 的流程并非全部“代码写死”；条件边既可以由确定性代码决定，也可以由模型动态路由。
- GPT 纠错：ReAct 是否支持并行、Checkpoint 和断点恢复取决于承载它的运行时，不能把这些能力写成 ReAct 天生不支持。
- GPT 纠错：意图识别不是所有生产 Agent 的必备第一步。单工具、开放式研究、Coding Agent 等场景可能直接规划或进入 ReAct。
- GPT 纠错：“复杂业务必须 LangGraph”和“RoutingGraphService 与 LangGraph 本质一样”都过于绝对，应根据状态持久化、分支、人工介入和可观测需求选型。

---

## 最终修正版（审计后）

### 核心概念

```
LangChain = 工具箱（LLM调用、Prompt模板、工具定义）
LangGraph = 图运行时（基于LangChain零件，定义Agent执行流程）
```

### LangGraph 四个核心概念

| 概念 | 含义 | 类比 |
|------|------|------|
| **State（状态）** | 节点之间传递的数据包 | 共享字典 |
| **Node（节点）** | 一个处理步骤（函数） | 流程图里的处理框 |
| **Edge（边）** | 节点之间的跳转关系 | 流程图里的箭头 |
| **Conditional Edge** | 根据条件决定下一步去哪 | 流程图里的菱形判断 |

### 与 ReAct Loop 的区别（修正后）

| 维度 | ReAct Loop | LangGraph |
|------|-----------|-----------|
| 流程控制 | LLM 自己决定 | 代码写死 或 模型动态路由 |
| 可调试性 | 难（黑盒） | 容易（每步有状态） |
| 条件分支 | 隐式（LLM推理） | 显式（代码定义）或 动态路由 |
| 并行 | 取决于运行时 | 支持 |
| 断点恢复 | 取决于运行时 | Checkpoint |
| 适用场景 | 简单任务、单工具、开放式研究 | 复杂业务流程、需要状态持久化 |

### 关键修正点

```
1. LangGraph 不是 ReAct 的替代品
   → LangGraph 可以在图中实现 ReAct Loop
   → 也可以实现固定工作流，或两者混合

2. 条件边不全是"代码写死"
   → 可以由确定性代码决定
   → 也可以由模型动态路由（LLM 决定下一步）

3. ReAct 的能力取决于运行时
   → 不能说 ReAct 天生不支持并行/Checkpoint
   → 要看承载它的框架提供了什么

4. 意图识别不是所有场景的第一步
   → 单工具场景：直接调用
   → 开放式研究：直接 ReAct
   → 复杂业务：先意图识别再分支

5. 选型依据
   → 需要状态持久化、分支、人工介入、可观测 → LangGraph
   → 简单任务、快速原型 → ReAct 足够
```

### 适用场景（修正后）

| 场景 | 推荐 | 原因 |
|------|------|------|
| 简单问答 | ReAct | 足够灵活 |
| 单工具调用 | ReAct | 不需要复杂流程 |
| 开放式研究 | ReAct | LLM 自主探索 |
| 复杂业务流程 | LangGraph | 需要状态管理和分支 |
| 需要人工介入 | LangGraph | Checkpoint + 人工节点 |
| 需要审计追踪 | LangGraph | 每步状态可追溯 |
