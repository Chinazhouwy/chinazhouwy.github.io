---
title: "LangGraph教程转写笔记（尚硅谷132集完整版）"
date: "2026-07-21"
domain: "技术"
area: "AI Agent"
type: "学习笔记"
status: "可复习"
priority: "P1"
energy: "high"
visibility: "private"
summary: "基于132集视频转写的LangGraph完整知识点笔记，包含代码片段和实操细节"
tags:
  - LangGraph
  - AI Agent
  - LangChain
  - 状态图
  - ReAct
  - Human-in-the-Loop
  - Checkpoint
source: "B站"
source_url: "https://www.bilibili.com/video/BV1z3NY66EY1/"
author: "尚硅谷"
stats: "6.6万播放 / 3578收藏"
total_episodes: 132
---

# LangGraph教程转写笔记（尚硅谷132集完整版）

> 来源：B站 · 尚硅谷（猛哥主讲）
> 链接：https://www.bilibili.com/video/BV1z3NY66EY1/
> 配套资料：关注公众号「尚硅谷教育」回复"LangGraph"免费获取
> 课程定位：从入门到部署，零基础上手智能体Agent必备技能
> 笔记特点：基于转写文本提取，保留重要代码片段和实操细节

---

## 一、课程总览与环境部署（P1-P7）

### 1.1 课程介绍与定位（P1-P2）

LangGraph被称为**Agent的操作系统**，以可靠的持久化执行和人机协同生产能力在AI Agent中占据重要地位。

**六大模块：**
1. 环境工具链 → 基础入门 → 控制流 → 持久化与中断 → 部署 → 高级特性
2. 核心能力：状态/节点/边 → 控制流 → 持久化Checkpoint → Human-in-the-Loop → 流式执行/子图

**LangChain vs LangGraph 定位：**

| 维度 | LangChain | LangGraph |
|------|-----------|-----------|
| 定位 | 高层应用框架 | 底层编排引擎 |
| 核心入口 | `create_agent` | `StateGraph` |
| 适用场景 | 简单Agent | 复杂工作流+状态+人工介入 |
| 底层原理 | — | 基于自研Pregel运行逻辑（借鉴Google Pregel论文） |

> 猛哥强调：LangChain和LangGraph**不是对立关系**，而是**协同工作**。LangChain倾向顶层应用设计，LangGraph倾向底层架构编排。推荐先学LangChain再学LangGraph。

### 1.2 环境准备与安装（P3-P7）

**MiniConda安装：**
```bash
# 安装Miniconda（跨平台包管理工具）
# Windows/Mac/Linux 各有安装包
```

**创建虚拟环境：**
```bash
conda create -n langgraph python=3.11
conda activate langgraph
```

**安装依赖：**
```bash
pip install langgraph langchain-openai langchain-core
# 完整依赖见 requirements.txt
```

**API Key配置：**

在项目根目录创建 `.env` 文件（文件名固定）：
```env
# DeepSeek API Key（必填）
DEEPSEEK_API_KEY=your_key_here

# LangSmith配置（可选，部署用）
# LANGCHAIN_TRACING_V2=true
# LANGSMITH_API_KEY=your_key
# LANGSMITH_PROJECT=your_project
```

> ⚠️ API Key绝对保密，不要给别人。泄露了及时到官网删除。用Git时记得在`.gitignore`中排除`.env`。

**环境变量加载方式：**
```python
# 方式1：dotenv库
from dotenv import load_dotenv
load_dotenv()

# 方式2：ChatDeepSeek自动读取
# 创建ChatDeepSeek客户端时自动从环境变量读取DEEPSEEK_API_KEY
```

**Jupyter部署：**
```bash
pip install jupyter notebook
jupyter notebook
```

---

## 二、LangGraph入门基础（P8-P13）

### 2.1 三要素：State、Node、Edge

```
┌─────────────┐
│   State     │  ← 状态：数据在节点间传递的载体
├─────────────┤
│   Node      │  ← 节点：执行具体逻辑的函数
├─────────────┤
│   Edge      │  ← 边：连接节点，决定执行流向
└─────────────┘
```

### 2.2 图运行过程：Super Step（超步）

每次执行（节点执行）称为一个**Super Step（超步）**，分三个阶段：

1. **路由（Routing）**：确定下一个要执行的节点
2. **执行（Execution）**：读取State快照，执行函数逻辑，产生局部更新
3. **提交（Commit）**：将返回结果合并到全局State，更新状态

```
执行 → 路由确定下一节点 → 执行节点函数 → 提交到全局State → 下一个超步
```

> 开头和结尾是例外：START直接进入第一个节点，END直接结束。

### 2.3 基础Graph流程代码

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

# 1. 定义状态
class State(TypedDict):
    input: str
    output: str

# 2. 定义节点
def process(state: State) -> dict:
    return {"output": f"处理: {state['input']}"}

# 3. 构建图
graph = StateGraph(State)
graph.add_node("process", process)
graph.add_edge(START, "process")
graph.add_edge("process", END)

# 4. 编译执行
app = graph.compile()
result = app.invoke({"input": "hello"})
```

**编写LangGraph代码的三步走：定义状态 → 定义节点 → 定义边**

### 2.4 图结构可视化

```python
from IPython.display import display
display(app.get_graph())
# 或
print(app.get_graph().draw_mermaid())
```

### 2.5 API风格选择

| 风格 | 说明 | 适用场景 |
|------|------|----------|
| Function API | 函数式，装饰器定义 | 简单图 |
| StateGraph API | 类式，继承定义 | 复杂图（本课程主要方式） |

---

## 三、State状态管理（P14-P27）

### 3.1 状态的多种实现方式

| 方式 | 示例 | 特点 |
|------|------|------|
| TypedDict | `class State(TypedDict)` | 轻量，类型提示 |
| Pydantic | `class State(BaseModel)` | 验证严格，支持JSON Schema |
| dataclass | `@dataclass class State` | Python原生 |
| dict | 直接用字典 | 最灵活，无类型 |

**三种方式的校验行为对比（LangGraph下）：**

| 方式 | 校验行为 |
|------|----------|
| TypedDict | Key不匹配抛 `KeyError` |
| dataclass | 字段不匹配抛 `TypeError` |
| Pydantic | 类型不匹配抛 `ValidationError` |

> ⚠️ 与LangChain不同：LangChain中只有Pydantic会校验返回结果；LangGraph中三种方式都要求字段名称一致。

**推荐方式：dict（字典方式）**，因为功能上没有区别，最简洁。

#### ✅ 完整可运行代码：TypedDict方式

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

# 1. 定义状态（TypedDict方式，推荐简洁场景）
class OverallState(TypedDict):
    input: str
    output: str
    current_id: str

# 2. 定义节点
def node1(state: OverallState) -> dict:
    """节点支持部分更新——只返回需要修改的字段"""
    return {"output": f"处理: {state['input']}", "current_id": "node1"}

def node2(state: OverallState) -> dict:
    return {"output": f"二次处理: {state['output']}", "current_id": "node2"}

# 3. 构建图
builder = StateGraph(OverallState)
builder.add_node("node1", node1)
builder.add_node("node2", node2)
builder.add_edge(START, "node1")
builder.add_edge("node1", "node2")
builder.add_edge("node2", END)

# 4. 编译并运行
app = builder.compile()
result = app.invoke({"input": "hello", "output": "", "current_id": ""})
print(result)
# {'input': 'hello', 'output': '二次处理: 处理: hello', 'current_id': 'node2'}
```

#### ✅ 完整可运行代码：dataclass方式（类似Java类定义）

```python
from langgraph.graph import StateGraph, START, END
from dataclasses import dataclass, field

@dataclass
class OverallState:
    input: str = ""
    output: str = ""
    current_id: str = ""

# 节点中用点号访问属性（不是中括号）
def node1(state: OverallState) -> dict:
    # dataclass用点号调用：state.input 而非 state["input"]
    return {"output": f"处理: {state.input}", "current_id": "node1"}

def node2(state: OverallState) -> dict:
    return {"output": f"二次处理: {state.output}", "current_id": "node2"}

builder = StateGraph(OverallState)
builder.add_node("node1", node1)
builder.add_node("node2", node2)
builder.add_edge(START, "node1")
builder.add_edge("node1", "node2")
builder.add_edge("node2", END)

app = builder.compile()
# 创建时可以用字典，也可以用类实例
result = app.invoke({"input": "hello", "output": "", "current_id": ""})
print(result)
# 或：result = app.invoke(OverallState(input="hello"))
```

#### ✅ 完整可运行代码：Pydantic方式（严格类型校验）

```python
from langgraph.graph import StateGraph, START, END
from pydantic import BaseModel

class OverallState(BaseModel):
    input: str
    output: str
    current_id: str = ""  # 可设默认值

def node1(state: OverallState) -> dict:
    # Pydantic也用点号访问
    return {"output": f"处理: {state.input}", "current_id": "node1"}

builder = StateGraph(OverallState)
builder.add_node("node1", node1)
builder.add_edge(START, "node1")
builder.add_edge("node1", END)

app = builder.compile()
# Pydantic会校验类型，不匹配抛ValidationError
result = app.invoke(OverallState(input="hello", output=""))
print(result)
```

> **LangGraph校验行为对比：**
> - TypedDict → 字段不匹配抛 `KeyError`
> - dataclass → 字段不匹配抛 `TypeError`
> - Pydantic → 类型不匹配抛 `ValidationError`
> - **三种方式功能无差别，推荐用dict方式（TypedDict）最简洁**

### 3.2 Reducer（状态归约）

**问题**：多个节点更新同一状态字段，如何合并？

#### ✅ 完整可运行代码：自定义Reducer

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated

# 自定义Reducer函数
def my_reducer(current: list[str], update: list[str]) -> list[str]:
    """当前值 + 新值 → 合并后的值"""
    # current是从最开始累加到当前的值，不是上一个节点的值
    # update是当前节点新产生的值
    return current + update

# 定义状态，用Annotated注解关联Reducer
class OverallState(TypedDict):
    logs: Annotated[list[str], my_reducer]  # 自定义reducer
    step: str

def node_a(state: OverallState) -> dict:
    return {"logs": ["Node A执行完毕"], "step": "a"}

def node_b(state: OverallState) -> dict:
    return {"logs": ["Node B执行完毕"], "step": "b"}

builder = StateGraph(OverallState)
builder.add_node("node_a", node_a)
builder.add_node("node_b", node_b)
builder.add_edge(START, "node_a")
builder.add_edge("node_a", "node_b")
builder.add_edge("node_b", END)

app = builder.compile()
result = app.invoke({"logs": ["Start"], "step": ""})
print(result["logs"])
# ['Start', 'Node A执行完毕', 'Node B执行完毕'] —— Reducer执行列表追加
```

#### ✅ 完整可运行代码：add_messages Reducer（消息合并核心）

```python
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.graph import add_messages

# 模拟左侧（已归约好的历史消息）
left_messages = [
    SystemMessage(content="你是一个专业的翻译", id="1"),
    HumanMessage(content="你好", id="2"),
    AIMessage(content="你好，我是专业的翻译", id="3"),
]

# 模拟右侧（当前新产生的消息）
right_messages = [
    HumanMessage(content="我是老王", id="2"),     # ID=2相同 → 覆盖替换
    AIMessage(content="好的我记住了", id="4"),     # ID=4不存在 → 追加
    HumanMessage(content="你是谁", id="5"),        # ID=5不存在 → 追加
]

merged = add_messages(left_messages, right_messages)

for msg in merged:
    print(f"ID={msg.id}, type={type(msg).__name__}, content={msg.content}")

# 输出：
# ID=1, type=SystemMessage, content=你是一个专业的翻译        ← 保留（无同ID）
# ID=2, type=HumanMessage, content=我是老王                  ← 覆盖（ID=2相同）
# ID=3, type=AIMessage, content=你好，我是专业的翻译         ← 保留
# ID=4, type=AIMessage, content=好的我记住了                 ← 追加（新ID）
# ID=5, type=HumanMessage, content=你是谁                    ← 追加（新ID）
```

> **add_messages核心逻辑：不是简单列表拼接！**
> - 新ID → 追加到末尾
> - 相同ID → 用新消息覆盖旧消息（即使消息子类型不同也按ID判断）

| Reducer | 行为 |
|---------|------|
| `add` | 列表/数值拼接（并集） |
| `add_messages` | 按ID合并消息（新追加/旧覆盖） |
| 自定义lambda | 自定义合并逻辑 |

### 3.3 4种状态更新模式

| 模式 | 说明 | 示例 |
|------|------|------|
| 覆盖（默认） | 新值替换旧值 | `state["key"] = new_val` |
| 追加 | 添加到列表 | Reducer: `add` |
| 合并 | 字典合并 | Reducer: `dict_merge` |
| 自定义 | 自定义逻辑 | 自定义Reducer函数 |

### 3.4 节点中读取和更新状态

```python
def my_node(state: State):
    # 读取状态
    input_val = state["input"]
    # 返回部分更新（partial update）
    return {"output": f"processed: {input_val}"}
```

**关键原则：节点支持部分更新**
- 节点不返回某字段 → LangGraph保留原值
- 返回某字段有Reducer → 调用Reducer合并
- 返回某字段无Reducer → 新值覆盖旧值

### 3.5 Overwrite覆盖机制

当字段配置了Reducer，但在某个节点需要直接覆盖（不调用Reducer）时：

```python
from langgraph.types import overwrite

def node_b(state: State):
    return overwrite({"logs": ["Node B的输出"]})
# overwrite只影响当前节点，后续节点恢复Reducer逻辑
```

#### ✅ 完整可运行代码：Overwrite覆盖机制

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from operator import add
from langgraph.types import overwrite

class OverallState(TypedDict):
    logs: Annotated[list[str], add]  # 配置了Reducer

def node_a(state: OverallState) -> dict:
    return {"logs": ["Node A执行完毕"]}

def node_b(state: OverallState) -> dict:
    # ⚠️ 使用overwrite直接覆盖，不走Reducer追加逻辑
    return overwrite({"logs": ["Node B执行完毕"]})  # 清空之前所有内容

def node_c(state: OverallState) -> dict:
    # 没有overwrite，恢复正常Reducer逻辑
    return {"logs": ["Node C执行完毕"]}

builder = StateGraph(OverallState)
builder.add_node("node_a", node_a)
builder.add_node("node_b", node_b)
builder.add_node("node_c", node_c)
builder.add_edge(START, "node_a")
builder.add_edge("node_a", "node_b")
builder.add_edge("node_b", "node_c")
builder.add_edge("node_c", END)

app = builder.compile()
result = app.invoke({"logs": ["Start"]})
print(result["logs"])
# ['Node B执行完毕', 'Node C执行完毕']
# ↑ node_b用overwrite清空了之前的，node_c恢复Reducer正常追加
```

### 3.6 节点并行执行

```python
graph.add_node("node_a", func_a)
graph.add_node("node_b", func_b)

# 并行：两个节点同时执行（从同一上游节点出发）
graph.add_edge(START, "node_a")
graph.add_edge(START, "node_b")
graph.add_edge("node_a", END)
graph.add_edge("node_b", END)
```

> 并行执行的好处：减少等待大模型回复的时间。如顺序执行需2秒，并行只需1秒。
> ⚠️ 并行写入同一状态字段必须配置Reducer，否则报错。

### 3.7 预定义状态 MessagesState

`MessagesState` 内置了 `messages` 字段和追加Reducer，适合对话场景。

#### ✅ MessagesState内部源码结构

```python
# LangGraph官方MessagesState的等效定义
from typing import Annotated
from langchain_core.messages import AnyMessage
from langgraph.graph import add_messages

class MessagesState(dict):
    messages: Annotated[list[AnyMessage], add_messages]  # 内置messages + add_messages reducer
```

#### ✅ 完整可运行代码：MessagesState + DeepSeek LLM对话

```python
from dotenv import load_dotenv
load_dotenv(override=True)

from langgraph.graph import StateGraph, START, END, MessagesState
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

# 1. 定义状态（继承MessagesState，自动拥有messages字段+Reducer）
class OverallState(MessagesState):
    username: str           # 自定义扩展字段
    final_output: str       # 最终输出

# 2. 连接LLM
model = ChatOpenAI(model="deepseek-v4-flash")

# 3. 定义节点A：组装用户消息
def node_a(state: OverallState) -> dict:
    return {
        "messages": [HumanMessage(content=f"你好，我是{state['username']}")]
    }

# 4. 定义LLM节点：直接把messages发给模型
def llm_node(state: OverallState) -> dict:
    # MessagesState的messages字段可以直接发给模型！
    response = model.invoke(state["messages"])
    return {
        "messages": [response],           # AI回复追加到messages
        "final_output": response.content  # 同时提取content
    }

# 5. 构建图
builder = StateGraph(OverallState)
builder.add_node("node_a", node_a)
builder.add_node("llm_node", llm_node)
builder.add_edge(START, "node_a")
builder.add_edge("node_a", "llm_node")
builder.add_edge("llm_node", END)

app = builder.compile()

# 6. 执行
result = app.invoke({"username": "老王", "messages": [], "final_output": ""})
print(f"最终输出: {result['final_output']}")
print(f"消息历史:")
for msg in result["messages"]:
    msg.pretty_print()
```

> **使用MessagesState的好处：**
> - 内置messages字段 + add_messages Reducer，自动维护对话历史
> - messages可以直接发给LLM，无需手动拼装
> - 回复自动追加到messages，保持完整的对话上下文

### 3.8 节点命名注意

子图节点命名时要**避开 `mem` 关键字**，这是LangGraph的专有名词。

---

## 四、控制流-边（P28-P55）

### 4.1 边的类型

| 类型 | 说明 | 示例 |
|------|------|------|
| 普通边 | 固定连接 | `add_edge("A", "B")` |
| 条件边 | 根据状态选择 | `add_conditional_edges()` |
| START/END | 特殊节点 | 图的入口和出口 |

### 4.2 并行节点（P30）

从同一上游节点出发的多个节点会在**同一个超步被激活**。

```python
# 同时运行两个节点
graph.add_edge(START, "node_a")  # A生成诗
graph.add_edge(START, "node_b")  # B生成笑话
graph.add_edge("node_a", END)
graph.add_edge("node_b", END)
```

> 并行节点在读取状态时互相独立，输出时需通过Reducer合并。

### 4.3 静态分支与动态分支

**静态分支**：图添加边后执行流程已确定
- 并行节点、条件边（path_map固定）

**动态分支**：运行时动态决定下一步

### 4.4 条件分支与path_map

```python
def route(state: State):
    if state["type"] == "chat":
        return "chat_node"
    else:
        return "qa_node"

graph.add_conditional_edges(
    START,
    route,
    {"chat": "chat_node", "qa": "qa_node"}  # path_map
)
```

### 4.5 多分支路由

```python
def complex_route(state):
    if state["level"] == 1:
        return "easy_node"
    elif state["level"] == 2:
        return "medium_node"
    else:
        return "hard_node"
```

### 4.6 延迟节点执行（P35, Defer）

某些节点需要**等所有普通节点执行完**再触发（如日志、审计）：

```python
graph.add_node("audit_node", audit_func, defer=True)
# 延迟节点在额外超步中执行，可读取到所有节点的最终状态
```

**延迟执行原理：**
1. 注册时标记为defer，创建特殊通道（`last_value` finish通道）
2. 常规运行时指向延迟节点的边只写入不触发
3. 所有普通节点执行完后触发 `finish` 事件
4. finish事件解锁延迟节点，在额外超步中执行

> 适用场景：日志记录、审计检查、结尾汇总、收尾清理。

### 4.7 ReAct循环结构（P40-P42）

**Agent中的循环不是大模型自身循环**，而是大模型判断需要调用工具时的循环：

```
用户问题 → LLM推理(reason) → 判断是否调用工具 → 调用工具(action) → 观察结果 → 循环/结束
```

```python
# Agent循环：思考 → 工具调用 → 观察 → 再思考
def agent_node(state):
    response = llm.invoke(state["messages"])
    if response.tool_calls:
        return {"action": "tool_call"}
    return {"action": "finish"}

# 循环边
graph.add_conditional_edges(
    "agent",
    lambda s: "tool" if s["action"] == "tool_call" else END,
    {"tool": "tool_node", END: END}
)
graph.add_edge("tool_node", "agent")  # 工具结果回到Agent
```

**完整ReAct实现（P42）：**

#### ✅ 完整可运行代码：静态循环ReAct（含工具调用+失败重试模拟）

```python
from dotenv import load_dotenv
load_dotenv(override=True)

from langgraph.graph import StateGraph, START, END, MessagesState
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
import random

# ========== 1. 定义工具 ==========
@tool
def get_weather(city: str) -> str:
    """查询指定城市的当日天气

    Arguments:
        city: 城市名称
    """
    # 模拟外部API调用（实际项目中对接真实天气API）
    return f"{city}今天天气晴朗，气温25度，适合出行"

@tool
def get_news(domain: str) -> str:
    """查询特定领域的当日热点

    Arguments:
        domain: 特定领域（如AI、食品安全）
    """
    if domain == "AI":
        return "AI热点：DeepSeek发布新模型，性能超越GPT-4"
    elif domain == "食品安全":
        return "食品安全：新版国标将于下月实施"
    return f"未找到{domain}领域相关新闻"

# 工具字典（方便按名称调用）
tools_by_name = {"get_weather": get_weather, "get_news": get_news}
tools = list(tools_by_name.values())

# ========== 2. 连接LLM并绑定工具 ==========
model = ChatOpenAI(model="deepseek-v4-flash")
model_with_tools = model.bind_tools(tools)

# ========== 3. 定义状态 ==========
class OverallState(MessagesState):
    user_input: str
    final_output: str

# ========== 4. 定义节点 ==========
# 输入节点：将user_input转为HumanMessage
def input_node(state: OverallState) -> dict:
    return {"messages": [HumanMessage(content=state["user_input"])]}

# LLM节点：调用模型，返回结果
def llm_node(state: OverallState) -> dict:
    response = model_with_tools.invoke(state["messages"])
    return {"messages": [response]}

# 工具节点（手动实现，含模拟失败重试）
def tool_node(state: OverallState) -> dict:
    messages = state["messages"]
    last_message = messages[-1]
    tool_calls = last_message.tool_calls

    for tool_call in tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]

        if tool_name in tools_by_name:
            # 模拟30%失败概率（演示ReAct循环重试）
            if random.random() < 0.3:
                messages.append(ToolMessage(
                    content=f"网络波动，调用{tool_name}失败，请重试",
                    tool_call_id=tool_call["id"]
                ))
            else:
                # 正常执行工具
                result = tools_by_name[tool_name].invoke(tool_args)
                messages.append(ToolMessage(
                    content=str(result),
                    tool_call_id=tool_call["id"]
                ))
        else:
            messages.append(ToolMessage(
                content=f"工具名称错误：{tool_name}，调用失败",
                tool_call_id=tool_call["id"]
            ))
    return {"messages": messages}

# 输出节点：提取最终结果
def output_node(state: OverallState) -> dict:
    return {"final_output": state["messages"][-1].content}

# 路由：判断是否需要工具调用
def router(state: OverallState):
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tool_node"    # 有tool_calls → 走工具节点（循环）
    return "output_node"      # 无tool_calls → 直接输出

# ========== 5. 构建图 ==========
builder = StateGraph(OverallState)
builder.add_node("input_node", input_node)
builder.add_node("llm_node", llm_node)
builder.add_node("tool_node", tool_node)
builder.add_node("output_node", output_node)

builder.add_edge(START, "input_node")
builder.add_edge("input_node", "llm_node")
builder.add_conditional_edges("llm_node", router)
builder.add_edge("tool_node", "llm_node")   # 工具结果回到LLM（循环）
builder.add_edge("output_node", END)

app = builder.compile()

# ========== 6. 执行 ==========
result = app.invoke({
    "user_input": "今天上海天气怎么样？",
    "messages": [SystemMessage(content="如果工具调用失败，必须重新调用直到成功为止")],
    "final_output": ""
})

print(f"最终输出: {result['final_output']}")
print(f"\n对话历史:")
for msg in result["messages"]:
    msg.pretty_print()
```

> **ReAct循环关键点：**
> 1. LLM返回的message中有`tool_calls`字段 → 判断是否需要调用工具
> 2. 工具执行后返回`ToolMessage` → 回到LLM节点继续判断
> 3. LLM不再返回`tool_calls` → 退出循环，输出最终结果
> 4. 失败重试：ToolMessage返回错误信息 → LLM会自动重新调用工具

### 4.8 Command控制

```python
from langgraph.types import Command

def node_a(state):
    # 使用Command跳转到指定节点
    return Command(goto="node_c", update={"step": "skipped"})
```

### 4.9 扇入（Fan-in）

```python
# 多个节点汇聚到一个节点
graph.add_edge("node_a", "merge_node")
graph.add_edge("node_b", "merge_node")
graph.add_edge("node_c", "merge_node")
```

### 4.10 循环控制

| 方式 | 说明 |
|------|------|
| 限制步数 | `recursion_limit=10` |
| 主动退出 | 节点返回 `END` |
| 被动退出 | 条件边判断终止 |

### 4.11 重试机制

```python
graph.add_node(
    "retry_node",
    func,
    retry=3,  # 重试3次
    retry_on=lambda e: isinstance(e, TimeoutError)
)
```

### 4.12 超时控制（P50）

> ⚠️ 要求LangGraph >= 1.2，且节点必须是**异步节点**（async def）

原因：Python目前缺少从外部安全终止同步函数的通用机制。同步强行中断可能导致资源未释放、锁未释放等问题。

```python
from langgraph.types import TimeoutPolicy

# TimeoutPolicy参数：
# - run_timeout: 运行超时时间（秒）
# - idle_timeout: 空闲超时时间
# - refresh: 刷新方式（手动/自动，默认自动）

graph.add_node(
    "timeout_node",
    async_func,
    timeout=TimeoutPolicy(run_timeout=60)
)
# 超时抛出 NodeTimeoutError，交给重试判断
```

### 4.13 错误处理与节点缓存

```python
# try-catch模式
def safe_node(state):
    try:
        result = risky_operation()
        return {"output": result}
    except Exception as e:
        return {"error": str(e)}

# 节点缓存（相同输入返回缓存结果）
graph.add_node("cached_node", func, cache=True)
```

---

## 五、持久化与记忆管理（P56-P83）

### 5.1 可恢复执行的含义（P56）

**核心区别：节点重试 vs 全局持久化**

| 维度 | 节点重试/缓存 | 全局持久化 |
|------|---------------|------------|
| 粒度 | 单个节点 | 整个任务 |
| 目的 | 保存节点计算数据 | 让整个系统具有可恢复性 |
| 记录内容 | 计算结果 | 任务进度、状态、下一步 |

**可恢复执行**：关键进度状态结果保存到可靠存储（落盘），中断/失败/等待后可从检查点恢复。

### 5.2 内存持久化（P57-P59）

```python
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()
app = graph.compile(checkpointer=checkpointer)

# 执行时指定thread_id
result = app.invoke(
    {"input": "hello"},
    config={"configurable": {"thread_id": "1"}}
)
```

> 内存持久化局限：进程重启/新文件创建后数据丢失，无法跨文件跨进程读取。

### 5.3 数据库持久化（PostgreSQL）（P60-P67）

**内存 vs 数据库持久化区别（P60）：**
- 内存：速度快，但重启后丢失，无法跨文件读取
- 数据库：更稳定持久，换文件/换进程只要连接相同就能读取

```python
from langgraph.checkpoint.postgres import PostgresSaver

DB_URL = "postgresql://user:password@localhost/dbname"

with PostgresSaver.from_conn_string(DB_URL) as checkpointer:
    # 首次使用需调用setup（创建表，幂等操作）
    checkpointer.setup()
    
    app = graph.compile(checkpointer=checkpointer)
    
    # 使用with语法确保连接管理
    result = app.invoke(
        {"messages": [HumanMessage(content="你好，我是老王")]},
        config={"configurable": {"thread_id": "user_001"}}
    )
```

> `setup()` 是幂等操作：多次执行不会重新创建表、不会删除数据。生产中应提前做好表格准备。

### 5.4 检查点操作（P68-P73）

```python
# 查看所有检查点（历史记录）
states = list(app.get_state_history(config))
for state in states:
    print(state.config["configurable"]["checkpoint_id"])
    print(state.next)  # 下一步执行的节点

# 查看最新检查点
state = app.get_state(config)

# 查看特定检查点
state = app.get_state(config={
    "configurable": {
        "thread_id": "1",
        "checkpoint_id": "xxx"
    }
})

# 从特定检查点恢复（Fork机制）
app.invoke(
    {"input": "new path"},
    config={
        "configurable": {
            "thread_id": "1",
            "checkpoint_id": "xxx"
        }
    }
)
```

### 5.5 失败恢复

```python
try:
    app.invoke(input, config=config)
except Exception:
    # 从最后的检查点恢复
    app.invoke(None, config=config)
```

### 5.6 Fork机制

```python
# 从某个检查点分叉执行（多条执行路径对比）
app.invoke(
    {"input": "new path"},
    config={
        "configurable": {
            "thread_id": "1",
            "checkpoint_id": "xxx"  # 从这里分叉
        }
    }
)
```

### 5.7 长期记忆 Store（P78-P83）

```python
from langgraph.store.memory import InMemoryStore

store = InMemoryStore()

app = graph.compile(
    checkpointer=checkpointer,  # 短期记忆
    store=store                  # 长期记忆
)

# 在节点中访问长期记忆
def check_preference(state, *, store):
    # 读取用户偏好
    memories = store.search(("user", state["user_id"]))
    # 写入用户偏好
    store.put(("user", state["user_id"]), "preference", data)
```

**长期记忆 + 短期记忆结合使用（P80）：**

```python
# 同时获取长期记忆和短期记忆
with PostgresStore.from_conn_string(DB_URL) as store, \
     PostgresSaver.from_conn_string(DB_URL) as checkpointer:
    
    checkpointer.setup()  # 幂等
    
    app = builder.compile(
        checkpointer=checkpointer,
        store=store
    )
    
    # 执行时同时使用
    result = app.invoke(
        {"username": "Alice", "user_input": "推荐一下酸奶"},
        config={"configurable": {"thread_id": "777"}}
    )
```

> 短期记忆依赖checkpoint，同一thread_id可跨调用保持记忆。长期记忆需自己写节点去读取store中的数据。

---

## 六、中断与Human-in-the-Loop（P84-P97）

### 6.1 两种中断机制（P84）

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| 动态中断（核心） | 运行时调用`interrupt()`函数 | 条件审批、异常处理 |
| 静态中断 | 编译时设置断点 | 调试 |

### 6.2 主动中断（动态中断，P85-P89）

```python
from langgraph.types import interrupt

def approval_node(state):
    # 中断等待人工审批
    user_decision = interrupt("请确认是否继续？")
    if user_decision == "approve":
        return {"approved": True}
    return {"approved": False}
```

#### ✅ 完整可运行代码：HITL审批流程

```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict

# 1. 定义状态
class OverallState(TypedDict):
    username: str
    approved: bool

# 2. 定义节点：询问用户姓名
def ask_name(state: OverallState) -> dict:
    # interrupt() 会暂停图执行，等待用户输入
    user_input = interrupt("请输入您的姓名：")
    return {"username": user_input}

# 3. 定义节点：审批节点
def approval_node(state: OverallState) -> dict:
    decision = interrupt(f"用户 {state['username']}，确认提交？(approve/reject)")
    return {"approved": decision == "approve"}

# 4. 定义节点：执行节点
def execute_node(state: OverallState) -> dict:
    if state["approved"]:
        print(f"✅ 已为 {state['username']} 提交成功")
    else:
        print(f"❌ {state['username']} 的提交被拒绝")

# 5. 构建图
builder = StateGraph(OverallState)
builder.add_node("ask_name", ask_name)
builder.add_node("approval", approval_node)
builder.add_node("execute", execute_node)
builder.add_edge(START, "ask_name")
builder.add_edge("ask_name", "approval")
builder.add_edge("approval", "execute")
builder.add_edge("execute", END)

# 6. 编译（必须配置checkpoint！）
checkpointer = MemorySaver()
app = builder.compile(checkpointer=checkpointer)

# ========== 模拟HITL交互 ==========

config = {"configurable": {"thread_id": "user_001"}}

# 第一次执行 → 在ask_name处中断，等待输入
print("=== 第一次执行（触发中断）===")
result = app.invoke({}, config=config)
print(f"中断信息: {result}")

# 获取中断状态
state = app.get_state(config)
print(f"下一步: {state.next}")  # ['ask_name']

# 第二次执行 → 传入用户输入，恢复执行
print("\n=== 第二次执行（传入姓名）===")
result = app.invoke("小王", config=config)
print(f"中断信息: {result}")  # approval节点触发中断

# 第三次执行 → 传入审批决策
print("\n=== 第三次执行（审批通过）===")
result = app.invoke("approve", config=config)
print(f"执行结果: {result}")
# ✅ 已为小王 提交成功
```

> **HITL核心流程：**
> 1. `interrupt(value)` → value展示给用户，图暂停
> 2. 第二次`app.invoke(feedback, config)` → feedback作为interrupt返回值
> 3. **必须配置checkpointer**，否则中断后无法恢复

### 6.3 多级审批

```python
def multi_approval(state):
    approval1 = interrupt("主管审批")
    if approval1 != "approve":
        return {"status": "rejected"}
    
    approval2 = interrupt("总监审批")
    return {"approved": True}
```

### 6.4 静态断点（P95-P96）

在编译时设置断点：

```python
app = builder.compile(
    checkpointer=checkpointer,
    interrupt_before=["node_a", "node_b"],  # 节点执行前中断
    interrupt_after=["node_a", "node_b"]    # 节点执行后中断
)

# 每次执行到断点时暂停，需要invoke恢复
result1 = app.invoke(None, config=config)  # 空状态恢复
result2 = app.invoke(None, config=config)  # 继续
```

### 6.5 中断使用规范（P90）⚠️

**四个绝对不要做的事：**

1. **不要用try-catch包裹interrupt调用**：interrupt通过抛异常实现暂停，包裹后异常抛不出去，永远无法中断

2. **不要更改单个节点内interrupt的调用顺序**：恢复时resume按顺序填写，顺序混乱会导致语义混乱。应拆分到不同节点。

3. **不要传递复杂类型**：interrupt内的数据需支持JSON序列化。只传字符串、数字、布尔、字典。不要传函数、类实例。

4. **断点之前的副作用操作必须是幂等的**：中断恢复时会重新执行整个节点，非幂等操作（如append、累加）会重复执行。将副作用操作放在断点之后，或拆分到不同节点。

> 幂等性：多次执行结果等价于一次执行。`upsert`是幂等的，`append`不是。

---

## 七、项目部署（P98-P100）

### 7.1 LangSmith对接（P98-P99）

LangSmith是LangChain官方的Agent应用评估工程平台，支持链路追踪、调试、评估和生产监控。

**项目结构（最小架构）：**
```
Human-in-the-Loop Demo/
├── src/
│   ├── __init__.py
│   └── agent.py        # Agent启动文件
├── .env                 # 环境变量
└── langgraph.json       # LangSmith配置
```

**langgraph.json 配置：**
```json
{
    "dependencies": ["."],
    "graphs": {
        "agent": "src/agent.py"
    },
    "env": ".env"
}
```

**.env 追加LangSmith配置：**
```env
LANGCHAIN_TRACING_V2=true
LANGSMITH_API_KEY=your_langsmith_key
LANGSMITH_PROJECT=Human-in-the-Loop-Demo
```

**启动部署：**
```bash
# 需要额外依赖：langgraph-client
pip install langgraph-client

# 启动本地服务并发布到LangSmith
langgraph dev
```

**Windows GBK编码问题解决：**
```bash
conda activate langgraph
conda config vars set PYTHONIOENCODING=utf-8
# 退出并重新进入虚拟环境
```

### 7.2 Agent Chat UI部署（P100）

使用LangChain AI开源的Agent Chat UI框架：

```python
# Chat Agent示例
from langgraph.types import interrupt

def tool_node_with_approval(state):
    last_message = state["messages"][-1]
    
    # 中断等待用户审批工具调用
    user_decision = interrupt({
        "tool_call_name": last_message.tool_calls[0]["name"],
        "arguments": last_message.tool_calls[0]["args"],
        "message": "是否允许调用此工具？"
    })
    
    if user_decision["action"] == "accept":
        # 执行工具
        result = execute_tool(...)
        return {"messages": [ToolMessage(content=str(result))]}
    elif user_decision["action"] == "reject":
        return {"messages": [AIMessage(content="用户拒绝了工具调用")]}
    elif user_decision["action"] == "edit":
        # 修改参数后执行
        ...
```

> Agent Chat UI的中断格式需遵循其Human-in-the-loop协议，才能正确渲染。

---

## 八、工具节点（P101-P106）

### 8.1 手动调用工具（P101-P102）

```python
from langchain_core.tools import tool

# 定义工具（Google风格docstring）
@tool(response_format="content_and_artifact")
def get_weather(city: str) -> str:
    """查询指定城市的当日天气
    
    Arguments:
        city: 城市名称
    """
    return f"{city}天气晴朗，微风"

@tool
def get_news(about: bool) -> str:
    """查询国内外新闻
    
    Arguments:
        about: true表示国内新闻，false表示国外新闻
    """
    if about:
        return "国内：Kimi新模型发布"
    return "国外：Anthropic暂停新模型访问"
```

**将工具绑定到模型：**
```python
# 工具字典（方便按名称调用）
tools_by_name = {
    "get_weather": get_weather,
    "get_news": get_news
}

# 绑定到模型
tools = [get_weather, get_news]
model_with_tools = model.bind_tools(tools)
```

### 8.2 ToolNode（推荐，P103-P105）

```python
from langgraph.prebuilt import ToolNode

# 自动处理工具调用（解析tool_calls、执行、返回ToolMessage）
tool_node = ToolNode(tools)

# 替代手动实现的tool_node，代码量大幅减少
```

> ToolNode封装了通用工具调用逻辑，不需要手动解析tool_calls、构造ToolMessage。

### 8.3 包装工具调用

```python
# 日志、重试、缓存等包装
def wrap_tool_call(func):
    def wrapper(*args, **kwargs):
        print(f"调用工具: {func.__name__}")
        result = func(*args, **kwargs)
        print(f"工具返回: {result}")
        return result
    return wrapper
```

---

## 九、流式执行（P107-P113）

### 9.1 概述（P107）

**流式执行**：程序未完成时，将中间结果（状态变化、事件、调试信息）输出给调用者。

**与invoke的区别：**
- `invoke`：等整个图执行完，返回最终结果
- `stream/astream`：边执行边输出中间结果

> 流式执行可以是同步的也可以是异步的。不是所有流式都是异步！

### 9.2 两套流式API

| API | 输出内容 | 说明 |
|-----|----------|------|
| `stream/astream` | 数据本身 | 直接输出状态值、消息等 |
| `stream_events/astream_events` | 结构化Runnable事件 | 封装好的标准事件 |

### 9.3 stream_mode 参数（P108-P113）

| stream_mode | 输出内容 |
|-------------|----------|
| `values` | 完整状态值 |
| `messages` | 消息流（增量） |
| `updates` | 状态更新 |
| `checkpoints` | 检查点信息 |
| `debug` | 调试信息 |
| `custom` | 自定义输出 |

```python
# 基础流式输出（values模式）
for chunk in app.stream(input, config=config):
    print(chunk)

# 消息流式输出
for chunk in app.stream(input, config=config, stream_mode="messages"):
    print(chunk)

# 检查点信息流式输出
for chunk in app.stream(input, config=config, stream_mode="checkpoints"):
    print(chunk)

# 异步流式
async for chunk in app.astream(input, config=config):
    print(chunk)

# stream_events（Runnable事件）
async for event in app.astream_events(input, config=config, version="v2"):
    print(event)
```

### 9.4 检查点流式输出详解（P110）

```python
# 并行节点 + 检查点 + 中断的完整示例
checkpointer = InMemorySaver()
app = builder.compile(checkpointer=checkpointer)

for chunk in app.stream(
    {"init": "开始"},
    config={"configurable": {"thread_id": "test"}},
    stream_mode="checkpoints"
):
    print(chunk)
# 输出内容包含：config、metadata、next、task、interrupts等
# 与get_state_history对比：少了created_at，多了interrupts，顺序相反
```

### 9.5 stream_events事件详解

```python
# 事件类型
# - on_chain_start / on_chain_end
# - on_llm_start / on_llm_end
# - on_tool_start / on_tool_end
# - on_chat_model_start / on_chat_model_end

async for event in app.astream_events(input, config=config, version="v2"):
    if event["event"] == "on_chat_model_stream":
        print(event["data"]["chunk"].content, end="")
```

---

## 十、子图（P114-P127）

### 10.1 子图概念（P114）

子图 = 在一个图的某个节点中调用另一个图，实现**嵌套（套娃）**结构。

### 10.2 两种嵌套方式

**方式1：父图在节点中调用子图（P114）**
```python
# 子图
child_graph = StateGraph(ChildState)
child_graph.add_node("child_node", child_func)
child_graph.add_edge(START, "child_node")
child_graph.add_edge("child_node", END)
child_app = child_graph.compile()

# 父图节点中调用
def parent_node(state):
    result = child_app.invoke({"input": state["data"]})
    return {"output": result["result"]}

# 父图
parent_builder = StateGraph(ParentState)
parent_builder.add_node("parent_node", parent_node)
```

**方式2：子图直接作为父图节点（P116）**
```python
# 状态共享，无需额外定义
parent_builder = StateGraph(OverallState)
parent_builder.add_node("sub_graph", child_app)  # 直接传入编译后的图
parent_builder.add_edge(START, "sub_graph")
parent_builder.add_edge("sub_graph", END)
```

### 10.3 持久化策略（P118-P122）

| 策略 | 说明 |
|------|------|
| Stateless（默认） | 子图无状态，每次独立执行 |
| With Checkpoint | 子图有自己的检查点 |
| 共享检查点 | 父子图共享同一检查点 |

**pair invocation vs pair search（P120-P122）：**

```python
# 无记忆模式（pair invocation）- 默认
parent_app = parent_builder.compile()  # 子图每次独立

# 有记忆模式（pair search）- 多轮对话
parent_app = parent_builder.compile(checkpointer=True)  # 子图有记忆
```

> 多轮会话测试：pair invocation下AI不记得之前的对话；pair search下AI能记住。

### 10.4 子图流式输出

```python
# 子图的chunk会传递给父图
for chunk in parent_app.stream(input):
    # 包含子图的输出
    print(chunk)
```

### 10.5 子图动态路由

```python
# 子图内部可以动态决定执行路径
def child_router(state):
    if state["type"] == "A":
        return "node_a"
    return "node_b"
```

---

## 十一、图设计模式（P128-P132）

### 11.1 提示词链（Prompt Chaining，P128）

```
Prompt1 → LLM1 → Prompt2 → LLM2 → 输出
```

- **核心思想**：复杂任务拆分为若干顺序执行的小任务
- **适用场景**：翻译→校对→润色；生成→检查一致性→修订
- **特点**：可加入条件边做质量管控

#### ✅ 完整可运行代码：提示词链（生成笑话→检查→改进→润色）

```python
from dotenv import load_dotenv
load_dotenv(override=True)

from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from typing import TypedDict

model = ChatOpenAI(model="deepseek-v4-flash")

# 状态：保存笑话和改进建议
class OverallState(TypedDict):
    topic: str
    joke: str
    improved_joke: str
    final_joke: str
    improvement_suggestion: str

# 节点1：生成笑话
def generate_joke(state: OverallState) -> dict:
    response = model.invoke([HumanMessage(content=f"写一个关于{state['topic']}的简短笑话")])
    return {"joke": response.content}

# 节点2：检查笑话是否有包袱（条件判断）
def check_joke(state: OverallState) -> dict:
    joke = state["joke"]
    # 简单规则：检查是否有问号或感叹号（模拟质量检查）
    if "?" in joke or "!" in joke:
        return {"improvement_suggestion": ""}
    return {"improvement_suggestion": "笑话缺少双关语或反转，请添加"}

# 节点3：条件路由
def route_joke(state: OverallState):
    if state["improvement_suggestion"]:  # 有建议 → 需要改进
        return "improve_joke"
    return "polish_joke"  # 无建议 → 直接润色

# 节点4：改进笑话
def improve_joke(state: OverallState) -> dict:
    response = model.invoke([HumanMessage(
        content=f"改进这个笑话，添加双关语让它更有趣：{state['joke']}\n改进建议：{state['improvement_suggestion']}"
    )])
    return {"improved_joke": response.content}

# 节点5：润色笑话
def polish_joke(state: OverallState) -> dict:
    joke_to_polish = state.get("improved_joke") or state["joke"]
    response = model.invoke([HumanMessage(content=f"给这个笑话添加一个出乎意料的反转结尾：{joke_to_polish}")])
    return {"final_joke": response.content}

# 构建图
builder = StateGraph(OverallState)
builder.add_node("generate_joke", generate_joke)
builder.add_node("check_joke", check_joke)
builder.add_node("improve_joke", improve_joke)
builder.add_node("polish_joke", polish_joke)

builder.add_edge(START, "generate_joke")
builder.add_edge("generate_joke", "check_joke")
builder.add_conditional_edges("check_joke", route_joke)
builder.add_edge("improve_joke", "polish_joke")
builder.add_edge("polish_joke", END)

app = builder.compile()
result = app.invoke({"topic": "猫", "joke": "", "improved_joke": "", "final_joke": "", "improvement_suggestion": ""})
print(f"原始笑话: {result['joke']}")
print(f"改进笑话: {result.get('improved_joke', '无')}")
print(f"最终笑话: {result['final_joke']}")
```

### 11.2 并行化（Parallelization，P129）

```
        ┌→ LLM_A →┐
输入 → ├→ LLM_B →├→ 合并 → 输出
        └→ LLM_C →┘
```

- **核心思想**：相互独立的任务同时执行，汇总结果
- **两种用途**：任务拆分（提升速度）、多次独立判断（提升置信度）
- **适用场景**：多角度分析、多模型评分

#### ✅ 完整可运行代码：并行化（同时生成笑话、故事、诗歌）

```python
from dotenv import load_dotenv
load_dotenv(override=True)

from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from typing import TypedDict

model = ChatOpenAI(model="deepseek-v4-flash")

class OverallState(TypedDict):
    topic: str
    joke: str
    story: str
    poem: str
    combined_output: str

# 并行节点：各自独立执行
def generate_joke(state: OverallState) -> dict:
    response = model.invoke([HumanMessage(content=f"写一个关于{state['topic']}的简短笑话")])
    return {"joke": response.content}

def generate_story(state: OverallState) -> dict:
    response = model.invoke([HumanMessage(content=f"写一个关于{state['topic']}的简短故事（100字以内）")])
    return {"story": response.content}

def generate_poem(state: OverallState) -> dict:
    response = model.invoke([HumanMessage(content=f"写一首关于{state['topic']}的四行诗")])
    return {"poem": response.content}

# 合并节点
def merge_output(state: OverallState) -> dict:
    combined = f"=== 关于{state['topic']}的创意合集 ===\n\n"
    combined += f"笑话：\n{state['joke']}\n\n"
    combined += f"故事：\n{state['story']}\n\n"
    combined += f"诗歌：\n{state['poem']}"
    return {"combined_output": combined}

# 构建图：扇入扇出结构
builder = StateGraph(OverallState)
builder.add_node("joke", generate_joke)
builder.add_node("story", generate_story)
builder.add_node("poem", generate_poem)
builder.add_node("merge", merge_output)

# 扇出：START → 三个并行节点
builder.add_edge(START, "joke")
builder.add_edge(START, "story")
builder.add_edge(START, "poem")
# 扇入：三个并行节点 → merge
builder.add_edge("joke", "merge")
builder.add_edge("story", "merge")
builder.add_edge("poem", "merge")
builder.add_edge("merge", END)

app = builder.compile()
result = app.invoke({"topic": "猫", "joke": "", "story": "", "poem": "", "combined_output": ""})
print(result["combined_output"])
```

### 11.3 路由（Routing，P129）

```
        ┌→ 专业A处理
输入 → ├→ 专业B处理
        └→ 专业C处理
```

- **核心思想**：根据输入特征选择专业处理器
- **适用场景**：意图分类、专家系统

#### ✅ 完整可运行代码：路由模式（意图分类→专家处理）

```python
from dotenv import load_dotenv
load_dotenv(override=True)

from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from typing import TypedDict

model = ChatOpenAI(model="deepseek-v4-flash")

class OverallState(TypedDict):
    input: str
    intent: str
    result: str

# 节点：LLM意图分类
def classify_intent(state: OverallState) -> dict:
    response = model.invoke([HumanMessage(
        content=f"判断以下问题的意图，只返回一个词（math/code/general）：{state['input']}"
    )])
    return {"intent": response.content.strip().lower()}

# 路由函数
def route_intent(state: OverallState):
    intent = state["intent"]
    if "math" in intent:
        return "math_expert"
    elif "code" in intent:
        return "code_expert"
    return "general_expert"

# 专家节点
def math_expert(state: OverallState) -> dict:
    response = model.invoke([HumanMessage(content=f"你是数学专家，请解答：{state['input']}")])
    return {"result": response.content}

def code_expert(state: OverallState) -> dict:
    response = model.invoke([HumanMessage(content=f"你是编程专家，请解答：{state['input']}")])
    return {"result": response.content}

def general_expert(state: OverallState) -> dict:
    response = model.invoke([HumanMessage(content=f"请回答：{state['input']}")])
    return {"result": response.content}

# 构建图
builder = StateGraph(OverallState)
builder.add_node("classifier", classify_intent)
builder.add_node("math_expert", math_expert)
builder.add_node("code_expert", code_expert)
builder.add_node("general_expert", general_expert)

builder.add_edge(START, "classifier")
builder.add_conditional_edges("classifier", route_intent, {
    "math_expert": "math_expert",
    "code_expert": "code_expert",
    "general_expert": "general_expert"
})
builder.add_edge("math_expert", END)
builder.add_edge("code_expert", END)
builder.add_edge("general_expert", END)

app = builder.compile()
result = app.invoke({"input": "Python如何读取JSON文件？", "intent": "", "result": ""})
print(f"意图分类: {result['intent']}")
print(f"专家回答: {result['result']}")
```

### 11.4 编排器-工作者模式（Orchestrator-Worker，P130）

```
编排器（LLM）
    ├→ 工作者1（子任务）
    ├→ 工作者2（子任务）
    └→ 工作者3（子任务）
        ↓
编排器（汇总）
```

- **核心思想**：编排器动态决定拆分多少任务（通过`send`动态发放）
- **与并行化的区别**：并行化编译时已确定任务数量；编排器模式运行时动态决定
- **本质**：MapReduce

#### ✅ 完整可运行代码：编排器-工作者（动态章节报告生成）

```python
from dotenv import load_dotenv
load_dotenv(override=True)

from langgraph.graph import StateGraph, START, END
from langgraph.types import Send
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from typing import TypedDict
from pydantic import BaseModel

model = ChatOpenAI(model="deepseek-v4-flash")

# 结构化输出：章节规划
class ChapterPlan(BaseModel):
    chapters: list[str]

# 编排器节点：生成章节规划
def orchestrator(state: dict) -> dict:
    response = model.with_structured_output(ChapterPlan).invoke([
        HumanMessage(content=f"为'{state['topic']}'生成3-5个章节标题，每个标题简短清晰")
    ])
    return {"chapters": response.chapters}

# 条件边：动态发放worker（Send机制）
def dispatch_chapters(state: dict):
    return [
        Send("worker", {"chapter": ch})
        for ch in state["chapters"]
    ]

# 工作者节点：为每个章节生成内容
def worker(state: dict) -> dict:
    response = model.invoke([
        HumanMessage(content=f"为'{state['chapter']}'这个章节写一段100字的内容概述")
    ])
    return {"chapter_contents": [f"## {state['chapter']}\n{response.content}"]}

# 聚合节点：合并所有章节
def aggregator(state: dict) -> dict:
    # chapter_contents是list[str]，用Reducer自动合并
    report = f"# {state['topic']}\n\n"
    report += "\n\n---\n\n".join(state["chapter_contents"])
    return {"report": report}

# 全局状态
class OverallState(TypedDict):
    topic: str
    chapters: list[str]
    chapter_contents: list[str]  # 需要Reducer合并
    report: str

# 构建图
builder = StateGraph(OverallState)
builder.add_node("orchestrator", orchestrator)
builder.add_node("worker", worker)
builder.add_node("aggregator", aggregator)

builder.add_edge(START, "orchestrator")
builder.add_conditional_edges("orchestrator", dispatch_chapters)
builder.add_edge("worker", "aggregator")  # 所有worker汇聚到aggregator
builder.add_edge("aggregator", END)

app = builder.compile()
result = app.invoke({
    "topic": "大语言模型缩放定律",
    "chapters": [],
    "chapter_contents": [],
    "report": ""
})
print(result["report"])
```

### 11.5 评估器-优化器模式（Evaluator-Optimizer，P131）

```
生成器 → 评估器 → 不满意 → 生成器（改进）
                → 满意 → 输出
```

- **核心思想**：生成后评估，不满意则循环改进
- **适用场景**：代码生成、文本润色

#### ✅ 完整可运行代码：评估器-优化器（笑话质量迭代）

```python
from dotenv import load_dotenv
load_dotenv(override=True)

from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from typing import TypedDict
from pydantic import BaseModel

model = ChatOpenAI(model="deepseek-v4-flash")

# 结构化输出：评估结果
class Evaluation(BaseModel):
    is_funny: bool
    score: float  # 0-1
    suggestion: str

# 状态
class OverallState(TypedDict):
    topic: str
    joke: str
    evaluation: dict

# 生成器节点
def generator(state: OverallState) -> dict:
    suggestion = state.get("evaluation", {}).get("suggestion", "")
    prompt = f"写一个关于{state['topic']}的简短笑话"
    if suggestion:
        prompt += f"\n改进建议：{suggestion}"
    response = model.invoke([HumanMessage(content=prompt)])
    return {"joke": response.content}

# 评估器节点
def evaluator(state: OverallState) -> dict:
    response = model.with_structured_output(Evaluation).invoke([
        HumanMessage(content=f"评估这个笑话是否好笑，给出0-1的分数和改进建议：{state['joke']}")
    ])
    return {"evaluation": {"is_funny": response.is_funny, "score": response.score, "suggestion": response.suggestion}}

# 条件路由
def route_evaluation(state: OverallState):
    eval_data = state.get("evaluation", {})
    if eval_data.get("is_funny") or eval_data.get("score", 0) >= 0.7:
        return "end"  # 满意 → 结束
    return "generator"  # 不满意 → 继续改进

# 构建图
builder = StateGraph(OverallState)
builder.add_node("generator", generator)
builder.add_node("evaluator", evaluator)

builder.add_edge(START, "generator")
builder.add_edge("generator", "evaluator")
builder.add_conditional_edges("evaluator", route_evaluation, {"generator": "generator", "end": END})

# 编译时设置递归限制（避免无限循环）
app = builder.compile()
result = app.invoke(
    {"topic": "猫", "joke": "", "evaluation": {}},
    config={"recursion_limit": 5}  # 最多循环5次
)
print(f"最终笑话: {result['joke']}")
print(f"评估分数: {result['evaluation'].get('score', 'N/A')}")
```

### 11.6 Agent模式（P132）

```
Agent（LLM）
    ├→ 工具1
    ├→ 工具2
    └→ 工具3
        ↓
Agent（观察结果）→ 继续/结束
```

- **核心思想**：大模型自主决定是否调用工具（与workflow最大的区别：无需人为控制执行路径）
- **适用场景**：开放式问题、多步推理

#### ✅ 完整可运行代码：Agent模式（最基础ReAct架构）

```python
from dotenv import load_dotenv
load_dotenv(override=True)

from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool

# 定义工具
@tool
def get_weather(city: str) -> str:
    """查询指定城市的天气

    Arguments:
        city: 城市名称
    """
    return f"{city}今天天气晴朗，微风"

@tool
def search_web(query: str) -> str:
    """搜索网页信息

    Arguments:
        query: 搜索关键词
    """
    return f"搜索结果：关于'{query}'的最新信息..."

# 绑定工具到模型
tools = [get_weather, search_web]
model = ChatOpenAI(model="deepseek-v4-flash").bind_tools(tools)

# Agent节点
def agent_node(state: MessagesState) -> dict:
    response = model.invoke(state["messages"])
    return {"messages": [response]}

# 路由函数
def router(state: MessagesState):
    last_msg = state["messages"][-1]
    if last_msg.tool_calls:
        return "tools"  # 有tool_calls → 调用工具
    return END          # 无tool_calls → 结束

# 构建图
builder = StateGraph(MessagesState)
builder.add_node("agent", agent_node)
builder.add_node("tools", ToolNode(tools))  # 使用预构建的ToolNode

builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", router)
builder.add_edge("tools", "agent")  # 工具结果回到agent（循环）

app = builder.compile()
result = app.invoke({"messages": [HumanMessage(content="今天北京天气怎么样？")]})

for msg in result["messages"]:
    msg.pretty_print()
```

> **Agent模式 vs Workflow模式的本质区别：**
> - Workflow：人为定义执行路径（条件边、路由函数）
> - Agent：大模型自主决定是否调用工具，无需人为控制执行路径

### 11.7 设计模式选择指南

| 模式 | 适用场景 | 复杂度 |
|------|----------|--------|
| 提示词链 | 多步骤推理、质量检查 | 低 |
| 并行化 | 多角度分析、投票决策 | 低 |
| 路由 | 意图分类、专家系统 | 低 |
| 编排器-工作者 | 复杂任务分解、动态数量 | 中 |
| 评估器-优化器 | 代码生成、文本润色 | 中 |
| Agent | 开放式问题、多步推理 | 高 |

> 实际项目中往往多种设计模式并存。在这些模式之外，不建议使用冷门用法。

---

## 十二、关键概念速查

| 概念 | 一句话解释 |
|------|-----------|
| LangGraph | 基于状态图的Agent执行引擎（底层Pregel模型） |
| State | 节点间传递的数据载体 |
| Node | 执行具体逻辑的函数 |
| Edge | 连接节点，决定执行流向 |
| Super Step | LangGraph最小执行单元（路由→执行→提交） |
| Reducer | 多节点更新同一状态时的合并策略 |
| Checkpoint | 执行状态的快照，用于恢复和时间旅行 |
| HITL | Human-in-the-Loop，人工介入审批 |
| Interrupt | 动态中断函数，通过抛异常暂停图执行 |
| ToolNode | 预构建的工具执行节点 |
| 子图 | 嵌套的图，可独立执行（套娃） |
| 流式执行 | 逐步输出中间结果（stream/astream） |
| Overwrite | 在特定节点覆盖Reducer，直接写入新值 |
| Defer | 延迟节点，等所有普通节点执行完后再触发 |
| Store | 跨会话的长期记忆存储 |
| MessagesState | 内置messages字段的预定义状态 |
| ReAct | 推理-行动循环：reason→action→observe→loop |
| Pregel | LangGraph底层借鉴的Google图计算模型 |
| pair invocation | 子图无记忆的调用方式 |
| pair search | 子图有记忆的调用方式 |

---

## 附录：课程章节索引

| 模块 | 集数 | 主题 |
|------|------|------|
| 环境部署 | P1-P7 | 课程介绍、MiniConda、虚拟环境、依赖安装、API Key、Jupyter |
| 入门基础 | P8-P13 | LangGraph定位、三要素、Super Step、基础Graph流程、可视化 |
| 状态管理 | P14-P27 | TypedDict/Pydantic/dataclass/dict、Reducer、部分更新、Overwrite、并行、MessagesState |
| 控制流 | P28-P55 | 并行、条件分支、path_map、动态分支、Command、扇入、循环、延迟节点、ReAct、循环控制、重试、超时、错误处理 |
| 持久化 | P56-P83 | 可恢复执行、内存/数据库检查点、检查点操作、Fork、长期记忆Store |
| 中断HITL | P84-P97 | 动态/静态中断、interrupt()、审批模式、使用规范 |
| 项目部署 | P98-P100 | LangSmith、本地部署、Agent Chat UI |
| 工具节点 | P101-P106 | 手动工具调用、ToolNode、ToolRuntime |
| 流式执行 | P107-P113 | stream/astream、stream_mode、stream_events |
| 子图 | P114-P127 | 父子图嵌套、状态共享、持久化策略、多轮会话 |
| 图设计模式 | P128-P132 | 提示词链、并行化、路由、编排器-工作者、评估器-优化器、Agent模式 |
