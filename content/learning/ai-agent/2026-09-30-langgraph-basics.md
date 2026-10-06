---
title: "LangGraph 基础：智能体架构、核心组件、控制流与工具调用"
date: 2026-09-30
domain: "学习"
area: "AI Agent"
module: "Agent 工程与源码"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
lane: agent
summary: "以第一章梳理 LangGraph 基础：智能体架构分类、LangChain 与 LangGraph 的分工、Graph/State/Node/Edge 四要素、四类控制流，以及 invoke/stream 两种执行方式与工具调用流程。"
tags:
  - LangGraph
  - LangChain
  - Agent
  - 工作流
  - 流式输出
  - Tool Calling
source: "微信公众号「Stellula」"
source_url: "https://mp.weixin.qq.com/s/4rnIU7rd2v8khTWVE5gszg"
published_at: "2026-09-30 11:46:08 +08:00"
---

# LangGraph 基础：智能体架构、核心组件、控制流与工具调用

> 来源：微信公众号「Stellula」
> 发布时间：2026-09-30 11:46（北京时间）
> 原文链接：<https://mp.weixin.qq.com/s/4rnIU7rd2v8khTWVE5gszg>
> 配图：25 张原图按原文顺序保留在配套目录（未做逐图转写）。

[ 第一章 | LangGraph 基础 ]

## 00 智能体架构

智能体（Agent）本质上是由大语言模型负责决策，再结合工具、环境、工作流完成任务的计算机系统。

根据决策方式、协作关系的不同，常见的智能体架构分为：

单智能体架构（Single Agent）：由单个 LLM（大语言模型）独立完成决策，结构简单。

网状架构（Network）：去中心化的多智能体结构，智能体间可以直接通信、自主决策。

监督者架构（Supervisor）：由一个主管智能体决策并调度其他下级智能体完成任务。

"监督者-工具"架构（Supervisor as tools）：智能体作为工具，直接由主管 LLM 调用。

分级架构（Hierarchical）：由"主管-子主管-底层智能体"构成的多级树状结构。

自定义架构（Custom）：根据实际需求，部分智能体有决策权，其余按固定工作流运行。

![原文配图 01](./2026-09-30-langgraph-basics-images/01.png)

## 01 LangChain 与 LangGraph

LangChain 更适合单 Agent 链式的简单流程，LangGraph 更适合多 Agent 协作的复杂流程。

![原文配图 02](./2026-09-30-langgraph-basics-images/02.png)

⚠️ 注意事项：

LangGraph 与 LangChain 不是对立关系。

LangGraph 由 LangChain 团队开发，同样基于 LangChain 生态，故在 LangGraph 的节点内，仍可调用 LangChain 的组件。

## 02 LangGraph 核心组件

### 2.1 Graph

图（Graph）：

Graph 是节点及其连接关系的集合，代表整个工作流程。

Graph 定义了信息在不同节点间的流动方式，控制着整个应用的执行逻辑。

Graph 可以是线性的简单结构，也可以是包含分支、循环的复杂结构。

状态图（StateGraph）：

StateGraph 是 LangGraph 中最主要的图类型，由用户定义的 State 进行参数化。

StateGraph 通过 state 保存和管理工作流运行过程中共享的状态数据。

消息图（MessageGraph）：

MessageGraph 是一种特殊的图类型，其 state 由消息列表构成，主要用于对话场景。

相比 StateGraph，MessageGraph 状态结构简单，但扩展能力有限，现已被官方废弃，新项目一般使用 StateGraph 管理消息状态。

### 2.2 State

状态（State）：

state 是 Graph 运行过程中共享的数据载体，用于保存工作流当前的状态。

节点可以从 state 中读取输入，并将更新结果写入 state，使得不同节点可以围绕同一个 state 进行协作。

state 可以包含消息、用户信息、任务结果、中间变量等数据。

### 2.3 Node

节点（Node）：

Node 是 Graph 的基本单元，负责完成一项具体的功能或操作。

Node 接收 state 作为输入，处理后更新 state，将执行结果传递给后续流程。

开始节点（START）：START 表示 Graph 的执行入口，用于指定工作流从哪里开始。

结束节点（END）：END 表示 Graph 的执行终点，用于指定工作流在哪里结束。

### 2.4 Edge

普通边（Edge）：

Edge 用于连接两个 Node，定义 Node 之间的执行关系。其最基本的形式为： A → B。

Node 负责具体任务，Edge 负责 Node 连接和流程控制。

条件边（Conditional Edge）：

Conditional Edge 根据当前 state 或模型输出动态决定下一步进入哪个 Node。

通过 Conditional Edge 可以实现分支、路由和决策，例如：判断成功 → A；判断失败 → B；需要人工处理 → C。

## 03 基本控制

LangGraph 控制逻辑：用图（Graph）描述工作流，用状态（State）保存数据，用节点（Node）执行任务，用边（Edge）控制流程。

### 3.1 串行控制

串行控制是最简单的工作流，即节点按照固定的链式顺序依次执行。

串行控制的示例及运行结果如下：

![原文配图 03](./2026-09-30-langgraph-basics-images/03.png)

![原文配图 04](./2026-09-30-langgraph-basics-images/04.png)

关于代码示例的几点说明：

Mermaid 是基于文本和图表的可视化工具，可以通过简单的文本语法来创建复杂图表。

State 是结构规范（类），state 是实际数据（变量/实参）

节点内部无法通过修改 state 的方式直接更新状态，一般只能通过 return 返回字典的形式更新 state。

### 3.2 分支控制

分支控制通过一对多的形式，在一个节点执行完成后，进入多个后续节点。

分支控制的示例及运行结果如下：

![原文配图 05](./2026-09-30-langgraph-basics-images/05.png)

![原文配图 06](./2026-09-30-langgraph-basics-images/06.png)

关于代码示例的几点说明：

Annotated 允许携带额外的元数据，配合 operator.add 可以实现列表结果的归约合并。

operator 是标准库，把 Python 中的"运算符"封装成可以调用的"函数"。

![原文配图 07](./2026-09-30-langgraph-basics-images/07.png)

### 3.3 条件分支控制

条件分支控制根据路由函数的返回值，从多个后续节点中选择部分节点执行。

条件分支控制的示例及运行结果如下：

![原文配图 08](./2026-09-30-langgraph-basics-images/08.png)

![原文配图 09](./2026-09-30-langgraph-basics-images/09.png)

关于代码示例的几点说明：

Literal 用于限定路由函数的返回值，在定义条件边函数时，建议写明，否则制图时，路由线可能无法展示。

recursion_limit 为运行图时的可配置项，用于限制图运行时最多可经历的 super-step 次数，早期版本默认为 25。

在条件边场景中，条件函数的主要职责是决定下一步去向，通常不负责更新 state。

### 3.4 条件循环控制

条件循环控制根据路由函数的返回值，重复执行部分节点，直到满足条件后结束。

条件循环控制的示例及运行结果如下：

![原文配图 10](./2026-09-30-langgraph-basics-images/10.png)

![原文配图 11](./2026-09-30-langgraph-basics-images/11.png)

关于代码示例的几点说明：

add_edge(start_key, end_key) 的 start_key 支持以节点列表的形式实现多对一，但 end_key 不支持节点列表的形式，故一对多时，需通过多个 add_edge(...) 实现。

START 和 END 都不是独立的 super-step，故计算时不算入 recursion_limit。

并行的节点属于同一个 super-step。

## 04 invoke(...) 与 stream(...)

在 LangGraph 中，.invoke(...) 和 .stream(...) 是最常见的两种执行图的方式。

### 4.1 invoke(...)

.invoke(...) 会执行整个图，执行结束后，一次性返回最终结果。

.invoke(...) 执行图的示例及运行结果如下：

![原文配图 12](./2026-09-30-langgraph-basics-images/12.png)

![原文配图 13](./2026-09-30-langgraph-basics-images/13.png)

### 4.2 stream(...)

相比于 .invoke(...)，.stream(...) 会在执行图的过程中持续返回中间结果，因此，更适合观察工作流的执行过程，或实现大模型的流式输出。

通过 .stream(...) 执行图时，可以选择性配置其 stream_mode 参数，常用模式有 updates、values、debug 和 messages。

① updates：输出节点更新

stream_mode="updates" 时，.stream(...) 返回一个可迭代的生成器对象，每个元素都是一个字典，键为节点名，值为节点函数的返回值。

updates 模式执行图的示例及运行结果如下：

![原文配图 14](./2026-09-30-langgraph-basics-images/14.png)

![原文配图 15](./2026-09-30-langgraph-basics-images/15.png)

② values：输出完整状态

stream_mode="values" 时，.stream(...) 返回一个可迭代的生成器对象，每个元素都是图执行到当前步骤时的完整状态。（包括图执行时的初始状态，不包括 END 状态，END 只是图停止的信号）

values 模式执行图的示例及运行结果如下：

![原文配图 16](./2026-09-30-langgraph-basics-images/16.png)

![原文配图 17](./2026-09-30-langgraph-basics-images/17.png)

③ debug：输出详细执行信息

stream_mode="debug" 时，.stream(...) 返回一个可迭代的生成器对象，输出图执行过程中尽可能多的信息，主要用于深度调试、监控状态流转细节、排查图执行过程中的异常。

debug 模式执行图的示例及运行结果如下：

![原文配图 18](./2026-09-30-langgraph-basics-images/18.png)

![原文配图 19](./2026-09-30-langgraph-basics-images/19.png)

④ messages：输出大模型生成过程

stream_mode="messages" 时，.stream(...) 返回一个可迭代的生成器对象，每个元素都是一个元组。元组的第一个元素为当前生成的消息增量对象（如 AIMessageChunk），包含 content 等信息；元组的第二个元素为包含当前消息元数据的字典对象，包含 langgraph_node 等信息。（该模式专门用于获取大模型流式生成的文本）

messages 模式执行图的示例及运行结果如下：

![原文配图 20](./2026-09-30-langgraph-basics-images/20.png)

![原文配图 21](./2026-09-30-langgraph-basics-images/21.png)

⚠️ 注意事项：

使用 stream_mode="messages" 时，会强行向 OpenAI API 发送带 "stream": true 的 HTTP 请求。故无论模型初始化时是否设置 streaming=True，或模型调用节点时是否使用 .stream(...)，LangGraph 内部都会在底层与模型的流式接口建立连接。

list[BaseMessage] 表示由 BaseMessage 构成的对话消息列表类型。

add_messages 是 LangGraph 专用的消息合并函数，用于消息的追加、覆盖、删除。

## 05 工具调用

工具调用是 Agent 能够"动手做事"的关键。

工具调用的基本流程可以概括为：

使用 @tool 定义工具 → 使用 .bind_tools(...) 绑定工具 → Tool Calling（大模型自主决定是否调用工具）→ 执行工具，返回 ToolMessage → 模型根据 ToolMessage 继续生成内容

![原文配图 22](./2026-09-30-langgraph-basics-images/22.png)

工具调用的示例及运行结果如下：

![原文配图 23](./2026-09-30-langgraph-basics-images/23.png)

![原文配图 24](./2026-09-30-langgraph-basics-images/24.png)

![原文配图 25](./2026-09-30-langgraph-basics-images/25.png)

⚠️ 注意事项：

并不是所有大模型都支持工具绑定。

工具函数的返回值建议为 str、dict、list 等标准 Python 数据类型，避免返回对象类型。

ToolNode 为预置工具节点，能从 AIMessage 中提取 tool_calls 字段，并在 tools 列表中执行对应的工具函数，再将函数的返回值封装为 ToolMessage 列表，组成以"messages"（默认，可通过 messages_key 参数修改）为键的字典。

END

那时，我国强大了，也要谦虚，永远保持学习的态度。

——《毛泽东传》
