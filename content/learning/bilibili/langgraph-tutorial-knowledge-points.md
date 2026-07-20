---
title: "LangGraph教程知识点整理（尚硅谷132集）"
date: "2026-07-20"
domain: "技术"
area: "AI Agent"
module: ""
project: ""
type: "学习笔记"
status: "可复习"
priority: "P1"
energy: "high"
visibility: "private"
summary: "LangGraph从入门到智能体项目实战的132集课程知识点"
tags:
  - LangGraph
  - AI Agent
  - LangChain
  - 状态图
source: "B站"
source_url: "https://www.bilibili.com/video/BV1z3NY66EY1/"
author: "尚硅谷"
stats: "6.6万播放 / 3578收藏"
total_episodes: 132
---

# LangGraph教程知识点整理（尚硅谷132集）

> 来源：B站 · 尚硅谷
> 链接：https://www.bilibili.com/video/BV1z3NY66EY1/
> 配套资料：关注公众号「尚硅谷教育」回复"LangGraph"免费获取
> 课程定位：从入门到部署，零基础上手智能体Agent必备技能

---

## 一、环境部署（P1-P7）

### 1.1 环境准备
- MiniConda 安装
- Python 虚拟环境创建与激活
- 依赖库安装
- API Key 配置
- Jupyter 工具部署
- 环境验证

### 1.2 关键配置
```bash
# 创建环境
conda create -n langgraph python=3.11
conda activate langgraph

# 安装依赖
pip install langgraph langchain-openai langchain-core
```

---

## 二、LangGraph入门基础（P8-P27）

### 2.1 LangChain vs LangGraph

| 维度 | LangChain | LangGraph |
|------|-----------|-----------|
| 定位 | 链式调用框架 | 状态图执行引擎 |
| 流程控制 | 线性链（Sequential） | 图（Graph）+ 条件分支 |
| 状态管理 | 无内置状态 | 内置 State 管理 |
| 循环支持 | 不支持 | 原生支持 |
| 适用场景 | 简单链式调用 | 复杂Agent工作流 |

### 2.2 LangGraph三要素

```
┌─────────────┐
│   State     │  ← 状态：数据在节点间传递的载体
├─────────────┤
│   Node      │  ← 节点：执行具体逻辑的函数
├─────────────┤
│   Edge      │  ← 边：连接节点，决定执行流向
└─────────────┘
```

### 2.3 图运行过程
```
START → Node1 → Node2 → Node3 → END
         ↓ (条件边)
        Node4 → Node5
```

### 2.4 API风格选择

| 风格 | 说明 | 适用场景 |
|------|------|----------|
| Function API | 函数式，装饰器定义 | 简单图 |
| StateGraph API | 类式，继承定义 | 复杂图 |

### 2.5 基础Graph流程
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

### 2.6 图结构可视化
```python
# 生成Mermaid图
print(app.get_graph().draw_mermaid())
```

---

## 三、State状态管理（P14-P27）

### 3.1 状态的多种实现

| 方式 | 示例 | 特点 |
|------|------|------|
| TypedDict | `class State(TypedDict)` | 轻量，类型提示 |
| Pydantic | `class State(BaseModel)` | 验证严格，功能全 |
| dataclass | `@dataclass class State` | Python原生 |
| dict | 直接用字典 | 最灵活，无类型 |

### 3.2 Reducer（状态归约）

**问题**：多个节点更新同一状态字段，如何合并？

```python
from typing import Annotated
from operator import add

class State(TypedDict):
    messages: Annotated[list[str], add]  # 列表追加
    count: Annotated[int, lambda a, b: a + b]  # 整数累加
```

**Reducer函数**：

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

### 3.4 节点中调用状态
```python
def my_node(state: State):
    # 读取状态
    input_val = state["input"]
    # 返回更新（部分更新即可）
    return {"output": f"processed: {input_val}"}
```

### 3.5 节点并行执行
```python
graph.add_node("node_a", func_a)
graph.add_node("node_b", func_b)

# 并行：两个节点同时执行
graph.add_edge(START, "node_a")
graph.add_edge(START, "node_b")
graph.add_edge("node_a", END)
graph.add_edge("node_b", END)
```

### 3.6 预定义状态
```python
from langgraph.graph import MessagesState

# LangGraph内置的消息状态
class MyState(MessagesState):
    extra_field: str  # 可扩展
```

---

## 四、控制流-边（P28-P55）

### 4.1 边的类型

| 类型 | 说明 | 示例 |
|------|------|------|
| 普通边 | 固定连接 | `add_edge("A", "B")` |
| 条件边 | 根据状态选择 | `add_conditional_edges()` |
| START/END | 特殊节点 | 图的入口和出口 |

### 4.2 条件分支
```python
def route(state: State):
    if state["type"] == "chat":
        return "chat_node"
    else:
        return "qa_node"

graph.add_conditional_edges(
    START,
    route,
    {"chat": "chat_node", "qa": "qa_node"}
)
```

### 4.3 path_map映射
```python
# path_map: 路由函数返回值 → 节点名
graph.add_conditional_edges(
    START,
    route,
    path_map={  # 返回值 → 节点
        "A": "node_a",
        "B": "node_b"
    }
)
```

### 4.4 映射多节点
```python
# 一个路由函数可以映射到多个节点
def complex_route(state):
    if state["level"] == 1:
        return "easy_node"
    elif state["level"] == 2:
        return "medium_node"
    else:
        return "hard_node"
```

### 4.5 动态分支
```python
# 节点动态决定下一步
def dynamic_node(state):
    next_node = decide_next(state)
    return {"next": next_node}  # 动态指定下一个节点
```

### 4.6 Command控制
```python
from langgraph.types import Command

def node_a(state):
    # 使用Command跳转到指定节点
    return Command(goto="node_c", update={"step": "skipped"})
```

### 4.7 扇入（Fan-in）
```python
# 多个节点汇聚到一个节点
graph.add_edge("node_a", "merge_node")
graph.add_edge("node_b", "merge_node")
graph.add_edge("node_c", "merge_node")
```

### 4.8 循环结构

**Agent构建中的循环**：
```python
# Agent循环：思考 → 工具调用 → 观察 → 再思考
def agent_node(state):
    # LLM决定是否调用工具
    response = llm.invoke(state["messages"])
    if response.tool_calls:
        return {"action": "tool_call"}
    return {"action": "finish"}

def tool_node(state):
    # 执行工具
    result = execute_tool(state["tool_call"])
    return {"messages": [result]}

# 循环边
graph.add_conditional_edges(
    "agent",
    lambda s: "tool" if s["action"] == "tool_call" else END,
    {"tool": "tool_node", END: END}
)
graph.add_edge("tool_node", "agent")  # 工具结果回到Agent
```

### 4.9 循环控制

| 方式 | 说明 |
|------|------|
| 限制步数 | `recursion_limit=10` |
| 主动退出 | 节点返回 `END` |
| 被动退出 | 条件边判断终止 |

### 4.10 重试机制
```python
# 节点执行失败时重试
graph.add_node(
    "retry_node",
    func,
    retry=3,  # 重试3次
    retry_on=lambda e: isinstance(e, TimeoutError)
)
```

### 4.11 超时控制
```python
graph.add_node(
    "timeout_node",
    func,
    timeout=30  # 30秒超时
)
```

### 4.12 错误处理
```python
# try-catch 模式
def safe_node(state):
    try:
        result = risky_operation()
        return {"output": result}
    except Exception as e:
        return {"error": str(e)}
```

### 4.13 节点缓存
```python
# 相同输入返回缓存结果
graph.add_node(
    "cached_node",
    func,
    cache=True
)
```

---

## 五、持久化（P56-P83）

### 5.1 可恢复执行
- 图执行过程中可以中断
- 从断点恢复继续执行
- 适用于长时间运行的Agent

### 5.2 持久化机制
```
执行 → 保存Checkpoint → 中断
                ↓
恢复 → 加载Checkpoint → 继续执行
```

### 5.3 内存持久化
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

### 5.4 数据库持久化（PostgreSQL）
```python
from langgraph.checkpoint.postgres import PostgresSaver

checkpointer = PostgresSaver.from_conn_string(
    "postgresql://user:pass@localhost/db"
)
```

### 5.5 检查点操作
```python
# 查看所有检查点
states = list(app.get_state_history(config))

# 查看特定检查点
state = app.get_state(config)

# 从特定检查点恢复
app.invoke(None, config={"configurable": {
    "thread_id": "1",
    "checkpoint_id": "xxx"
}})
```

### 5.6 失败恢复
```python
# 执行失败后恢复
try:
    app.invoke(input, config=config)
except Exception:
    # 从最后的检查点恢复
    app.invoke(None, config=config)
```

### 5.7 Fork机制
```python
# 从某个检查点分叉执行
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

### 5.8 长期记忆
```python
# Store: 跨会话的长期记忆
store = InMemoryStore()

app = graph.compile(
    checkpointer=checkpointer,
    store=store
)

# 在节点中访问长期记忆
def my_node(state, *, store):
    # 读取记忆
    memories = store.search(("user", state["user_id"]))
    # 写入记忆
    store.put(("user", state["user_id"]), "preference", data)
```

---

## 六、中断与Human-in-the-Loop（P84-P97）

### 6.1 两种中断机制

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| 静态中断 | 图定义时设置断点 | 调试、固定流程 |
| 动态中断 | 运行时动态触发 | 条件审批、异常处理 |

### 6.2 主动中断
```python
from langgraph.types import interrupt

def approval_node(state):
    # 中断等待人工审批
    user_decision = interrupt("请确认是否继续？")
    if user_decision == "approve":
        return {"approved": True}
    return {"approved": False}
```

### 6.3 HITL（Human-in-the-Loop）
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

### 6.4 审批模式
```python
# 多级审批
def multi_approval(state):
    # 第一级审批
    approval1 = interrupt("主管审批")
    if approval1 != "approve":
        return {"status": "rejected"}
    
    # 第二级审批
    approval2 = interrupt("总监审批")
    return {"approved": True}
```

---

## 七、项目部署（P98-P100）

### 7.1 LangSmith调试
```python
import langsmith
langsmith.traceable(
    project_name="my-project",
    tags=["production"]
)
```

### 7.2 部署方式
- **本地部署**：直接运行
- **Docker部署**：容器化
- **云服务部署**：AWS/Azure/GCP

---

## 八、工具节点（P101-P106）

### 8.1 手动调用工具
```python
def tool_node(state):
    # 手动解析工具调用
    last_message = state["messages"][-1]
    tool_call = last_message.tool_calls[0]
    
    # 执行工具
    result = tools[tool_call["name"]](**tool_call["args"])
    
    return {"messages": [ToolMessage(content=str(result))]}
```

### 8.2 ToolNode（推荐）
```python
from langgraph.prebuilt import ToolNode

# 自动处理工具调用
tool_node = ToolNode(tools)
```

### 8.3 ToolRuntime自定义
```python
from langgraph.prebuilt import ToolRuntime

runtime = ToolRuntime(tools)
# 自定义工具执行逻辑
```

### 8.4 wrap_tool_call
```python
# 包装工具调用（日志、重试、缓存等）
def wrapped_tool_call(func):
    def wrapper(*args, **kwargs):
        print(f"调用工具: {func.__name__}")
        result = func(*args, **kwargs)
        print(f"工具返回: {result}")
        return result
    return wrapper
```

---

## 九、流式执行（P107-P113）

### 9.1 流式输出类型

| 类型 | 说明 |
|------|------|
| values | 完整状态值 |
| messages | 消息流 |
| checkpoints | 检查点信息 |
| custom | 自定义输出 |

### 9.2 流式调用
```python
# 基础流式输出
for event in app.stream(input, config=config):
    print(event)

# 只输出消息
for event in app.stream(input, config=config, stream_mode="messages"):
    print(event)

# 异步流式
async for event in app.astream(input, config=config):
    print(event)
```

---

## 十、子图（P114-P127）

### 10.1 子图概念
- 图可以嵌套：父图包含子图
- 子图是独立的StateGraph
- 子图可以有自己的状态和检查点

### 10.2 子图调用方式

| 方式 | 说明 |
|------|------|
| 节点中调用 | 在父图节点中直接调用子图 |
| 作为节点 | 子图直接作为父图的节点 |

### 10.3 父子图状态
```python
# 子图
child_graph = StateGraph(ChildState)
child_app = child_graph.compile()

# 父图节点中调用
def parent_node(state):
    result = child_app.invoke({"input": state["data"]})
    return {"output": result["result"]}
```

### 10.4 持久化策略
- **Stateless**：子图无状态，每次独立执行
- **With Checkpoint**：子图有自己的检查点
- **共享检查点**：父子图共享同一检查点

### 10.5 子图流式输出
```python
# 子图的chunk会传递给父图
for chunk in parent_app.stream(input):
    # 包含子图的输出
    print(chunk)
```

### 10.6 子图动态路由
```python
# 子图内部可以动态决定执行路径
def child_router(state):
    if state["type"] == "A":
        return "node_a"
    return "node_b"
```

---

## 十一、图设计模型（P128-P132）

### 11.1 提示词链（Prompt Chaining）
```
Prompt1 → LLM1 → Prompt2 → LLM2 → 输出
```
- 适合：多步骤推理、质量检查

### 11.2 并行化（Parallelization）
```
        ┌→ LLM_A →┐
输入 → ├→ LLM_B →├→ 合并 → 输出
        └→ LLM_C →┘
```
- 适合：多角度分析、投票决策

### 11.3 路由（Routing）
```
        ┌→ 专业A处理
输入 → ├→ 专业B处理
        └→ 专业C处理
```
- 适合：意图分类、专家系统

### 11.4 编排器-工作者模式（Orchestrator-Worker）
```
编排器（LLM）
    ├→ 工作者1（子任务）
    ├→ 工作者2（子任务）
    └→ 工工作者3（子任务）
        ↓
编排器（汇总）
```
- 适合：复杂任务分解

### 11.5 评估器-优化器模式（Evaluator-Optimizer）
```
生成器 → 评估器 → 不满意 → 生成器（改进）
                → 满意 → 输出
```
- 适合：代码生成、文本润色

### 11.6 Agent模式
```
Agent（LLM）
    ├→ 工具1
    ├→ 工具2
    └→ 工具3
        ↓
Agent（观察结果）→ 继续/结束
```
- 适合：开放式问题、多步推理

---

## 十二、关键概念速查

| 概念 | 一句话解释 |
|------|-----------|
| LangGraph | 基于状态图的Agent执行引擎 |
| State | 节点间传递的数据载体 |
| Node | 执行具体逻辑的函数 |
| Edge | 连接节点，决定执行流向 |
| Reducer | 多节点更新同一状态时的合并策略 |
| Checkpoint | 执行状态的快照，用于恢复 |
| HITL | Human-in-the-Loop，人工介入 |
| ToolNode | 预构建的工具执行节点 |
| 子图 | 嵌套的图，可独立执行 |
| 流式执行 | 逐步输出中间结果 |
