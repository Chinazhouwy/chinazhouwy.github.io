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

```python
# Pydantic方式示例
from pydantic import BaseModel

class State(BaseModel):
    input: str
    output: str

# 使用时
state = State(input="hello", output="")
# 或用字典
state = State(**{"input": "hello", "output": ""})
```

### 3.2 Reducer（状态归约）

**问题**：多个节点更新同一状态字段，如何合并？

```python
from typing import Annotated
from operator import add

class State(TypedDict):
    messages: Annotated[list[str], add]  # 列表追加
    count: Annotated[int, lambda a, b: a + b]  # 整数累加
```

| Reducer | 行为 |
|---------|------|
| `add` | 列表追加 |
| `operator.add` | 数值累加 |
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

```python
from langgraph.graph import MessagesState

class MyState(MessagesState):
    extra_field: str  # 可扩展字段
```

`MessagesState` 内置了 `messages` 字段和追加Reducer，适合对话场景。

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

```python
from langgraph.graph import StateGraph, START, END, MessagesState
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage

# 1. 声明状态
class OverallState(MessagesState):
    user_input: str
    final_output: str

# 2. 定义输入节点：将user_input转为message
def input_node(state):
    return {"messages": [HumanMessage(content=state["user_input"])]}

# 3. 大模型节点
def llm_node(state):
    response = model_with_tools.invoke(state["messages"])
    return {"messages": [response]}

# 4. 工具节点（手动实现）
def tool_node(state):
    messages = state["messages"]
    last_message = messages[-1]
    tool_calls = last_message.tool_calls
    
    for tool_call in tool_calls:
        tool_name = tool_call["name"]
        if tool_name in tools_by_name:
            result = tools_by_name[tool_name].invoke(tool_call["args"])
            messages.append(ToolMessage(
                content=str(result),
                tool_call_id=tool_call["id"]
            ))
    return {"messages": messages}

# 5. 路由：判断是否需要工具调用
def router(state):
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tool_node"
    return "output_node"

# 6. 构建图
builder = StateGraph(OverallState)
builder.add_node("input_node", input_node)
builder.add_node("llm_node", llm_node)
builder.add_node("tool_node", tool_node)
builder.add_node("output_node", output_node)

builder.add_edge(START, "input_node")
builder.add_edge("input_node", "llm_node")
builder.add_conditional_edges("llm_node", router)
builder.add_edge("tool_node", "llm_node")  # 循环
builder.add_edge("output_node", END)
```

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

**HITL完整流程：**
```python
# 1. 执行到中断点
app.invoke(input, config=config)

# 2. 获取中断状态
state = app.get_state(config)

# 3. 人工决策后恢复
app.invoke(
    {"decision": "approve"},
    config=config
)
```

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

```python
# 生成笑话 → 检查是否有包袱 → 有则改进 → 润色
# 生成 → 判断（条件边） → 合格：END / 不合格：改进 → 润色
```

### 11.2 并行化（Parallelization，P129）

```
        ┌→ LLM_A →┐
输入 → ├→ LLM_B →├→ 合并 → 输出
        └→ LLM_C →┘
```

- **核心思想**：相互独立的任务同时执行，汇总结果
- **两种用途**：
  - 任务拆分：提升速度
  - 多次独立判断：提升置信度（投票/平均）
- **适用场景**：多角度分析、多模型评分

```python
# 同时生成笑话、故事、诗歌，合并为单一输出
builder.add_edge(START, "node_joke")
builder.add_edge(START, "node_story")
builder.add_edge(START, "node_poem")
# 合并节点
["node_joke", "node_story", "node_poem"] >> merge_node
```

### 11.3 路由（Routing，P129）

```
        ┌→ 专业A处理
输入 → ├→ 专业B处理
        └→ 专业C处理
```

- **核心思想**：根据输入特征选择专业处理器
- **适用场景**：意图分类、专家系统

```python
def router(state):
    intent = classify_intent(state["input"])
    if intent == "math": return "math_expert"
    if intent == "code": return "code_expert"
    return "general_expert"
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

```python
# 编排器生成章节列表 → send动态发放worker → 聚合
def orchestrator(state):
    # LLM生成章节规划
    plan = planner_llm.invoke(state["input"])
    return {"chapters": plan.chapters}

# 条件边：动态发放
def dispatch_chapters(state):
    return [
        Send("worker_node", {"chapter": ch})
        for ch in state["chapters"]
    ]

builder.add_conditional_edges("orchestrator", dispatch_chapters)
builder.add_edge("worker_node", "aggregator")
```

### 11.5 评估器-优化器模式（Evaluator-Optimizer，P131）

```
生成器 → 评估器 → 不满意 → 生成器（改进）
                → 满意 → 输出
```

- **核心思想**：生成后评估，不满意则循环改进
- **适用场景**：代码生成、文本润色

```python
def evaluator(state):
    score = evaluate(state["output"])
    if score >= 0.8:
        return "end"
    return "generator"  # 继续改进

builder.add_conditional_edges("evaluator", evaluator)
builder.add_edge("generator", "evaluator")  # 循环
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

```python
# 最基础的ReAct架构
model_with_tools = model.bind_tools([tool1, tool2])

def agent_node(state):
    response = model_with_tools.invoke(state["messages"])
    return {"messages": [response]}

def router(state):
    last_msg = state["messages"][-1]
    if last_msg.tool_calls:
        return "tool_node"
    return END

builder.add_conditional_edges("agent", router)
builder.add_edge("tool_node", "agent")
```

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
