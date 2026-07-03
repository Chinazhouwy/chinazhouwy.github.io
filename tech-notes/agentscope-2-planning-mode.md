# AgentScope 2.0.3 计划模式深度解析：显式任务清单

> 类型：📚 参考资料（非面试题/面经）
> 来源：微信公众号
> 原文链接：https://mp.weixin.qq.com/s/DI6H0mH1XH9KX0rTKSE3_w
> 提取日期：2026-07-01

---

AgentScope 2.0.3 计划模式深度解析

你不加规划，Agent 就会在东一榔头西一棒槌中迷失。AgentScope 2.0.3 的计划模式给 Agent 一份显式、结构化、可追踪的任务清单——通过普通的工具调用维护，不靠 Prompt Engineering。

一、问题：Agent 为什么需要显式计划？

一个没有计划的 Agent 处理复杂任务时是这样的：

用户: "帮我搭建一个用户认证系统"
Agent: 开始创建 app.py...
      "哦对了，需要数据库"
      跑去写 models.py...
      "等等，还没设计 API"
      回去改 app.py...
      "咦，token 怎么生成来着？"
      陷入循环...

问题不是模型不够聪明，而是它没有一份
外部化的任务清单
。每一步推理时，它只能在 prompt 里回忆「我做过什么、还有什么要做」——上下文越长，遗漏越多。

AgentScope 2.0.3 的答案：给 Agent 四个内置工具，让它通过
普通的工具调用
维护一份任务清单。任务清单存在 
agent.state.tasks_context
 上，随 Agent 状态一同持久化、恢复、迁移。

二、四个 Plan 工具

工具

操作

只读

一句话

TaskCreate

向任务清单末尾追加新任务

❌

「把这件事加到待办列表」

TaskGet

按 ID 获取单个任务完整信息

✅

「这条任务具体要做什么来着？」

TaskList

列出所有任务，含状态/owner/阻塞关系

✅

「我现在有哪些活要干？」

TaskUpdate

更新状态、字段或依赖关系，亦可删除

❌

「这条做完了」「这条不做了」「B 依赖 A」

四个工具都是状态注入式（
is_state_injected = True
）
——Agent 运行时把当前 
AgentState
 注入每次调用，工具直接读写 
agent.state.tasks_context
。任务清单以 Agent 为作用域，跨推理步骤、ReAct 轮次、HITL 暂停而保留。

三、装配工具

from
 agentscope.agent 
import
 Agent

from
 agentscope.tool 
import
 Toolkit, TaskCreate, TaskGet, TaskList, TaskUpdate

toolkit = Toolkit(
    tools=[
        TaskCreate(),
        TaskGet(),
        TaskList(),
        TaskUpdate(),
    ],
)

agent = Agent(
    name=
"planner"
,
    system_prompt=
"You are a planning assistant."
,
    model=model,
    toolkit=toolkit,
)

不需要额外的 System Prompt 工程
——每个工具的 
description
 已经包含详细 prompt，说明了何时调用、何时跳过、如何解读输出。
check_permissions()
 硬编码为 
ALLOW
——纯内存状态变更，不触发用户提示。

四、任务生命周期：pending → in_progress → completed

一个完整的规划循环：

1. TaskCreate    → 登记工作，每个离散步骤一条任务（自动分配数字 ID）
2. TaskList      → 查看队列，挑下一个可做的（ID 最小、无阻塞的 pending 任务）
3. TaskUpdate    → 认领任务，status → in_progress
4. TaskGet       → 获取完整描述和依赖（长描述的场景有用）
5. TaskUpdate    → 完成后 status → completed；若发现新工作则回到 TaskCreate

状态流转是线性的
：

pending → in_progress → completed
  ↑            ↑
  └────────────┴── deleted（任意状态均可，硬删除）

4.1 TaskCreate——登记任务

# Agent 内部调用 TaskCreate

# 每条任务一个数字 ID（"1"、"2"……），按创建顺序单调递增

await
 TaskCreate()(
    subject=
"创建 users 表"
,
    description=
"在 PostgreSQL 中创建 users 表，包含 id/email/password_hash/created_at 字段。"
,
    _agent_state=agent.state,
)

4.2 TaskList——查看队列

TaskList
 返回每个任务一行的紧凑摘要：id、状态、subject、owner、blocked_by。Agent 据此挑选下一个工作。

4.3 TaskGet——获取详情

当任务的 
description
 很长时，在执行前用 
TaskGet
 获取完整上下文。

await
 TaskGet()(task_id=
"3"
, _agent_state=agent.state)

4.4 TaskUpdate——更新状态

# 开始工作

await
 TaskUpdate()(task_id=
"1"
, status=
"in_progress"
, _agent_state=agent.state)

# 完成工作

await
 TaskUpdate()(task_id=
"1"
, status=
"completed"
, _agent_state=agent.state)

# 删除任务（硬删除，自动清理依赖边）

await
 TaskUpdate()(task_id=
"4"
, status=
"deleted"
, _agent_state=agent.state)

五、任务依赖：让 Agent 自己画工作流图

5.1 两条对称的依赖边

每个任务有两条依赖边，像链表一样连接：

任务 A                    任务 B
  blocks ──────→ b
  blocked_by ←── a

边

含义

示例

blocks

本任务完成前，这些任务不能开始

A 完成后，B 才能开始

blocked_by

这些任务必须在本任务之前完成

B 必须等 A 完成

5.2 调一次，两端自动同步

# 让任务 "2" 依赖任务 "1"

await
 TaskUpdate()(
    task_id=
"2"
,
    add_blocked_by=[
"1"
],
    _agent_state=agent.state,
)

# 此时自动同步：

# 任务 "1": blocks = ["2"]

# 任务 "2": blocked_by = ["1"]

不需要你手动维护两端
——
TaskUpdate
 自动修改 
blocks
 和 
blocked_by
，保证数据一致。

5.3 删除任务时自动清理依赖图

任务被 delete 时，其 ID 从其他所有任务的 
blocks
 和 
blocked_by
 中自动移除，依赖图始终有效。

5.4 依赖是建议性的，不是硬闸门

TaskList
 会标注仍有未解 
blocked_by
 的任务，Agent 据此优先选择无阻塞的任务。但
运行时不会强制阻止 Agent 去做一个被阻塞的任务
——依赖边是协调信号，不是执行锁。

六、数据模型：Task + TaskContext

所有任务状态存储在 
agent.state.tasks_context
：

from
 agentscope.state 
import
 Task

from
 pydantic 
import
 BaseModel

class
 
Task
(
BaseModel
):
    
id
: 
str
                          
# 数字串，TaskCreate 自动分配 ("1","2"...)

    subject: 
str
                     
# 一句话命令式描述

    description: 
str
                 
# 详细需求 / 上下文

    state: 
Literal
[
"pending"
, 
"in_progress"
, 
"completed"
] = 
"pending"

    owner: 
str
 | 
None
 = 
None
          
# 多 Agent 场景下的持有者

    blocks: 
list
[
str
] = []            
# 被本任务阻塞的任务 ID

    blocked_by: 
list
[
str
] = []        
# 阻塞本任务的任务 ID

    metadata: 
dict
[
str
, 
Any
] = {}
    created_at: 
str
                   
# ISO-8601 时间戳

class
 
TaskContext
(
BaseModel
):
    tasks: 
list
[Task] = []

关键特性
：

可序列化持久化
：
agent.state_dict()
 完整保存任务清单，恢复 state 时计划一并恢复

以 Agent 为单位
：两个 Agent 默认不共享任务清单

可在 LLM 循环之外修改
：任何能拿到 
agent.state
 的代码——middleware、应用代码、评测器——都可以直接读写任务

七、实战场景

场景一：复杂项目搭建——Agent 自主规划并执行

from
 agentscope.agent 
import
 Agent

from
 agentscope.tool 
import
 Toolkit, TaskCreate, TaskGet, TaskList, TaskUpdate

from
 agentscope.model 
import
 DashScopeChatModel

from
 agentscope.credential 
import
 DashScopeCredential

from
 agentscope.message 
import
 UserMsg

agent = Agent(
    name=
"builder"
,
    system_prompt=
"你是全栈项目搭建助手。收到需求后先规划任务清单，再逐条执行。"
,
    model=DashScopeChatModel(
        credential=DashScopeCredential(api_key=
"YOUR_API_KEY"
),
        model=
"qwen-max"
,
    ),
    toolkit=Toolkit(
        tools=[TaskCreate(), TaskGet(), TaskList(), TaskUpdate()],
    ),
)

# 给 Agent 一个复杂任务

result = 
await
 agent.reply(
    UserMsg(
        name=
"user"
,
        content=
"搭建一个 FastAPI 用户认证系统，包含注册、登录、JWT token、数据库模型。"

    )
)

# Agent 内部的执行流程：

# 1. TaskCreate("搭建项目结构")     → id=1, pending

# 2. TaskCreate("创建数据库模型")    → id=2, pending

# 3. TaskCreate("实现注册接口")      → id=3, pending

# 4. TaskCreate("实现登录接口")      → id=4, pending

# 5. TaskCreate("实现 JWT 中间件")   → id=5, pending

# 6. TaskList → 选 id=1 → TaskUpdate("1", in_progress) → 创建文件...

# 7. TaskUpdate("1", completed)

# 8. TaskList → 选 id=2 → TaskUpdate("2", in_progress) → ...

场景二：任务依赖——先设计再实现

让 Agent 自己表达「实现依赖设计」：

# Agent 内部对话：

# TaskCreate("设计 API 接口文档")    → id=1

# TaskCreate("实现 /register")      → id=2, add_blocked_by=["1"]

# TaskCreate("实现 /login")         → id=3, add_blocked_by=["1"]

# TaskCreate("编写集成测试")         → id=4, add_blocked_by=["2","3"]

# TaskList 结果：

# 1  pending  设计 API 接口文档          阻塞: [2,3]

# 2  pending  实现 /register             阻塞于: [1]

# 3  pending  实现 /login                阻塞于: [1]

# 4  pending  编写集成测试                阻塞于: [2,3]

# Agent 看到只有 id=1 无阻塞 → 先做

# 做完 1 后 → 2 和 3 解除阻塞 → 并行执行

# 做完 2 和 3 → 4 解除阻塞 → 执行

场景三：预置计划——从外部系统导入任务

不是所有计划都要由 Agent 生成。你可以从 Jira、GitHub Issues 或其他系统导入任务，然后让 Agent 执行：

from
 agentscope.state 
import
 Task

# 从外部系统导入一批任务

external_tasks = [
    {
"id"
: 
"1"
, 
"subject"
: 
"读取 requirements.md"
, 
"desc"
: 
"..."
},
    {
"id"
: 
"2"
, 
"subject"
: 
"分析现有代码结构"
, 
"desc"
: 
"..."
},
    {
"id"
: 
"3"
, 
"subject"
: 
"编写迁移脚本"
, 
"desc"
: 
"..."
, 
"blocked_by"
: [
"2"
]},
    {
"id"
: 
"4"
, 
"subject"
: 
"运行测试验证"
, 
"desc"
: 
"..."
, 
"blocked_by"
: [
"3"
]},
]

for
 t 
in
 external_tasks:
    agent.state.tasks_context.tasks.append(
        Task(
            
id
=t[
"id"
],
            subject=t[
"subject"
],
            description=t[
"desc"
],
            metadata={
"source"
: 
"jira_import"
},
        )
    )

# 手动维护依赖边双向一致

for
 t 
in
 external_tasks:
    
for
 blocked_id 
in
 t.get(
"blocked_by"
, []):
        agent.state.tasks_context.tasks[
            
int
(t[
"id"
]) - 
1

        ].blocked_by.append(blocked_id)
        agent.state.tasks_context.tasks[
            
int
(blocked_id) - 
1

        ].blocks.append(t[
"id"
])

# Agent 现在直接看到预置好的计划，不需要自己规划

result = 
await
 agent.reply(
    UserMsg(name=
"user"
, content=
"按照任务清单逐条执行"
)
)

场景四：进度中断与恢复

# 中途保存状态

state_dict = agent.state_dict()

# 持久化到磁盘/Redis

import
 json

with
 
open
(
"agent_state.json"
, 
"w"
) 
as
 f:
    json.dump(state_dict, f)

# ...Agent 崩溃或用户关闭...

# 恢复

with
 
open
(
"agent_state.json"
, 
"r"
) 
as
 f:
    saved_state = json.load(f)

agent = Agent(
    name=
"planner"
,
    system_prompt=
"You are a planning assistant."
,
    model=model,
    toolkit=Toolkit(
        tools=[TaskCreate(), TaskGet(), TaskList(), TaskUpdate()],
    ),
)

# 恢复状态——任务清单一并恢复

agent.load_state_dict(saved_state)

# Agent 看到之前完成到哪了，从哪里继续

result = 
await
 agent.reply(
    UserMsg(name=
"user"
, content=
"继续未完成的任务"
)
)

# 关闭后清空计划也很简单

# agent.state.tasks_context.tasks.clear()

八、直接编程操作任务清单

Plan 工具只是面向 LLM 的便利接口——底层操作的是同一份 Pydantic 数据结构。你可以绕过 LLM 直接编程操作：

# 清空计划

agent.state.tasks_context.tasks.clear()

# 手动标记任务完成

for
 task 
in
 agent.state.tasks_context.tasks:
    
if
 task.
id
 == 
"3"
:
        task.state = 
"completed"

        
break

# 手动删除任务（保持依赖图一致）

target_id = 
"5"

tasks_to_remove = [t 
for
 t 
in
 agent.state.tasks_context.tasks 
if
 t.
id
 == target_id]

for
 task 
in
 tasks_to_remove:
    agent.state.tasks_context.tasks.remove(task)

# 清理依赖边

for
 t 
in
 agent.state.tasks_context.tasks:
    t.blocks = [bid 
for
 bid 
in
 t.blocks 
if
 bid != target_id]
    t.blocked_by = [bid 
for
 bid 
in
 t.blocked_by 
if
 bid != target_id]

注意事项
：

ID 唯一且数字串
：
TaskCreate
 取下一个 ID 的方式是 
max(int(task.id)) + 1
，非数字 ID 被忽略但不重新分配

依赖边双向一致
：
TaskUpdate
 自动维护，但手动修改需自行同步 
blocks
 和 
blocked_by

状态值合法
：
Task.state
 只接受 
pending
、
in_progress
、
completed
；
deleted
 是操作不是存储状态

九、何时用 Plan？何时跳过？

Plan 工具的 prompt 已经内置了判断逻辑——
Agent 会自己决定是否做计划
。作为开发者，你的判断标准：

适合 Plan

不适合 Plan

三步以上的非平凡步骤

「帮我写个 hello world」

子任务之间有依赖

「这段代码什么意思？」

需要用户可见的进度

纯对话式交互

多人协作（有 owner 概念）

单命令、单步骤

即使装配了 Plan 工具，Agent 也会按设计跳过琐碎请求
——工具的 prompt 已明确告诉它不要为小事做计划。

十、与 v1 plan_notebook 的区别

维度

v1 
plan_notebook

v2.0.3 Plan 工具

接口

plan_notebook=
 参数

四个独立的 
Tool
（注册到 
Toolkit
）

状态存储

专有模块

agent.state.tasks_context
（Pydantic 模型）

依赖管理

无内置

blocks
 / 
blocked_by
 双向自动维护

编程操作

受限

直接读写 
tasks_context

持久化

不确定

随 
agent.state_dict()
 完整序列化

跳过逻辑

手动判断

Prompt 内置，Agent 自主决定

十一、最佳实践

#

实践

解释

1

复杂任务必须装配 Plan 工具

三步以上的工作不让 Agent 靠自由推理硬撑

2

使用数字串 ID

"1"
 / 
"2"
 / 
"3"
，让 
TaskCreate
 自动分配正常工作

3

用 
TaskUpdate
 设置依赖

不要手动改 
blocks
 / 
blocked_by
——用 
add_blocked_by
 和 
add_blocks

4

手动操作时保持依赖边双向一致

直接改 
tasks_context
 时自行同步

5

利用持久化做断点续传

state_dict()
 保存，
load_state_dict()
 恢复——任务清单随状态走

6

依赖边是建议，不是锁

Agent 理论上可以无视依赖执行——如果它能给出更好的结果也行

十二、总结

AgentScope 2.0.3 的计划模式用四个工具回答了一个朴素的问题：
Agent 怎么知道现在该做什么？

机制

作用

TaskCreate

把「要做的事」写下来

TaskList

随时查看「还有哪些事」

TaskGet

执行前确认「这件事具体要做什么」

TaskUpdate

标记「做完了」或设置「B 依赖 A」

核心洞察：
计划不是 Prompt Engineering，是数据结构。
 Plan 工具把计划变成一份 
TaskContext
——Agent 通过工具调用读写它，你可以通过 Python 代码操作它，状态持久化时它跟着走，恢复时它原样回来。

从「把要做的事写下来」开始——剩下的，Agent 自己会管。

v2.0.3 Plan 文档
：docs.agentscope.io/versions/2.0.3/zh/building-blocks/plan
[1]

Python 版本
：2.0.3

本文完全基于 AgentScope v2.0.3 官方文档 
docs.agentscope.io/versions/2.0.3/zh/building-blocks/plan
 撰写。

引用链接

[1]

docs.agentscope.io/versions/2.0.3/zh/building-blocks/plan: 
https://docs.agentscope.io/versions/2.0.3/zh/building-blocks/plan

          

            var first_sceen__time = (+new Date());
            if ("" == 1 && document.getElementById('js_content')) {
              document.getElementById('js_content').addEventListener("selectstart",function(e){ e.preventDefault(); });
            }
          

        

                

       
       
        if ("0" == 1) {
          document.addEventListener("keydown",function(e){
            if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X' || e.key === 'a' || e.key === 'A')) {
              if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') { return; }
              e.preventDefault();
            }
          });
          document.addEventListener("copy",function(e){
            var sel = window.getSelection();
            var content = document.getElementById('js_content');
            if (sel && sel.rangeCount > 0 && content && content.contains(sel.getRangeAt(0).commonAncestorContainer)) {
              e.preventDefault();
            }
          });
        }
