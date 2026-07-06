---
title: "LangGraph 底层执行引擎深度拆解"
date: "2026-07-06"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "LangGraph 底层执行引擎深度拆解"
tags:
---

# LangGraph 底层执行引擎深度拆解

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：微信公众号
> **抓取时间**：2026-06-07
> **分类**：AI Agent / LangGraph 框架

---

## 核心问题

LangChain 的早期架构是线性的（Chain），控制流固定。一旦需要条件分支、重试、循环，就放不下这些逻辑。

**LangGraph 用状态机（State Machine）解决这个问题**：让 AI 能"想一步、停一步、判断一步"。

---

## 状态机三要素

| 要素 | 含义 | LangGraph 对应 |
|------|------|----------------|
| **State** | 当前数据快照 | 对话历史 + 工具结果 + 中间变量 |
| **Node** | 执行动作，更新 State | LLM 调用 / 工具执行 / 业务逻辑 |
| **Edge** | 决定下一步去哪个 Node | 普通跳转 / 条件分支（Conditional Edge） |

---

## StateGraph 内部结构

```
┌──────────────────────────────────────────────────┐
│                  StateGraph 内部                  │
├─────────────────┬────────────────────────────────┤
│  nodes          │  Map<名称, 函数>                │
│  edges          │  Map<from, to[]>                │
│  conditional_   │  Map<from, (state)=>节点名>     │
│  edges          │                                 │
│  channels/      │  每个状态字段的 Reducer         │
│  schema         │                                 │
└─────────────────┴────────────────────────────────┘
```

`compile()` 做了什么：
1. 验证图结构（有没有孤立节点？有没有到 END 的路径？）
2. 构建邻接表（预计算每个节点的后继）
3. 初始化 Channels（每个状态字段注册 Reducer）
4. 返回 CompiledGraph（可以 invoke/stream）

---

## Reducer：状态更新的核心机制

Reducer 决定多个节点同时更新同一个 State 字段时如何合并：

```javascript
// 方式1：内置 messagesStateReducer（追加消息）
const AgentState = Annotation.Root({
  messages: Annotation<HumanMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

// 方式2：覆盖式（最后一个生效）
const AgentState = Annotation.Root({
  status: Annotation<string>({
    reducer: (prev, next) => next,
    default: () => "idle",
  }),
});

// 方式3：自定义合并逻辑
const AgentState = Annotation.Root({
  results: Annotation<number[]>({
    reducer: (prev, next) => [...new Set([...prev, ...next])],
    default: () => [],
  }),
});
```

**执行时机**：每个节点执行完 → 用 Reducer 合并到 new_state → 传给下一个节点

---

## 调度器（Scheduler）：怎么决定下一步去哪

1. 找到当前节点的所有后继
2. 如果是普通 Edge → 直接跳转
3. 如果是 Conditional Edge → 执行条件函数，返回目标节点名
4. 用 Reducer 合并状态 → new_state
5. 重复直到到达 END

---

## 并行执行：Fan-out / Fan-in 模式

LangGraph 支持一个节点连到多个后继节点，实现并行执行：

```javascript
const parallelGraph = new StateGraph(AgentState)
  .addNode("research", researchNode)
  .addNode("write", writeNode)
  .addNode("review", reviewNode)
  .addEdge(START, "research")
  .addEdge("research", "write")      // research → write
  .addEdge("research", "review")     // research → review（并行）
  .addEdge("write", END)
  .addEdge("review", END)
  .compile();
```

---

## 编译产物：CompiledGraph

- 支持 `invoke()`（单次执行）和 `stream()`（流式输出）
- 支持 `interrupt()`（人工介入）和 `resume()`（恢复执行）
- 支持 `getStateException()`（获取异常状态）
- 需要 Checkpointer 才能获取历史状态

---

## 面试相关考点

1. LangChain Chain vs LangGraph StateGraph 的区别
2. 状态机三要素在 Agent 中的应用
3. Reducer 的作用和常见写法
4. Conditional Edge 的实现原理
5. Fan-out/Fan-in 并行执行模式

---

## 原始链接

https://mp.weixin.qq.com/s/J8IgrW3LgRROLUC8Q5gvZg
