# 《从零实现 Agent 系统》连载 08｜编排与工作流：从 Chat 到任务图

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第8篇
> **核心主题**：编排/工作流/任务图

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目Agentium，源码详见GitHub。

连载 03《控制循环：感知—决策—行动—反思》
 讲清了一轮 Turn 里的 tool loop；
连载 07 《记忆系统：短期上下文 vs 长期外部记忆》
管住了记忆怎么读写。

本篇往上再抬一层

：真实业务往往不是「问一句答一句」——要检索、起草、人审、再发布；多个步骤有先后、有分支、有挂起。

协调层（coordination）

 负责把这些步骤排成 

任务图

，并在节点之间交接 

制品（artifact）

；

控制循环

仍留在节点内部——一个节点里完全可以跑
连载 03 
那套 LLM ↔ 工具往返。

协调层 vs 控制循环：谁管什么

可以记一句分工：

层级

管什么

典型粒度

控制循环

单轮/单节点内：感知—决策—行动—反思

一次 Turn、一圈 tool loop

协调层

多节点：依赖顺序、状态、挂起与恢复、制品 lineage

一个 workflow run

Chat 入口可以只是 

只有一个节点的 workflow

；研究流水线、批处理评测、带审批的发布流，则是 

显式 DAG

。别把「编排」和「tool loop」混成一个 while——前者是 

跨步骤的调度与契约

，后者是 

单步里的模型节拍

。

任务图：节点、边、拓扑序

工作流用 

WorkflowSpec

 描述：名字、节点列表、每个节点的 

depends_on

。边表示 

数据与语义上的先后

——B 依赖 A，则 A 的输出应能进入 B 的输入。

运行时按 

拓扑序

 依次执行：无依赖的 root 先跑（多个 root 可 fan-in）；每个节点完成后，把结果 merge 进共享 

inputs

 字典（例如 

inputs["gather"] = {...}

），下游节点从里面取。

节点本身不绑死实现，而是指向 

handler 名

：注册表里 

gather → 检索函数

、

draft → 调 LLM 写稿

、

review → 待人批

。handler 签名统一 

(context, inputs) -> output

，里面爱调网关、爱跑 tool loop 都行，但 

超时

 应在节点级设帽（与
连载 04 
分层超时一致）。

原生编排 vs LangGraph：一条主线，一种可选引擎

实现上可以 

两条路并存

：

原生 Orchestrator

：自己维护 

WorkflowState

、按拓扑序 

_drive

，逻辑透明、易单测、HITL resume 走同一条路径。

LangGraph 引擎

：把同一套 

step_workflow_node

 包进 StateGraph 节点，用图库做 fan-in/fan-out；

resume 仍回落到原生 orchestrator

，避免「图引擎一套、人审恢复另一套」的分叉。

选型土法：

步骤少、要强审计、要审批挂起

 → 原生主线足够；

分支复杂、团队已有 LangGraph 资产

 → 外引擎作壳，

节点语义与制品校验仍共用

。不必为了「用了 LangGraph」就把业务逻辑写进图定义字符串里。

节点生命周期：成功、失败、挂起、取消

每个节点跑完应落在明确 

NodeStatus

 上，例如：

COMPLETED

：输出过契约校验，inputs 已 merge；

FAILED

：handler 异常、制品不合规、涌现护栏 trip；

AWAITING_APPROVAL

：handler 抛出「需要审批」，workflow 

挂起

，记下 

pending_node

 + 

approval_id

 + 当时 inputs；

CANCELLED

：run 级取消注册表已标记，后续节点不再推进。

resume

 时校验 

approval_id

 与挂起态一致，从 pending 节点 

重入

——这与 Chat 里「工具待人批」同族，只是粒度从「一次 tool call」升到「一个 workflow 节点」。

节点执行应包 

超时

；取消 token 在步骤间隙检查（协作式，
连载 04 
已述）。

制品合同：节点之间别「口头交接」

多步流水线最怕：上游默默改了 JSON 形状，下游读到一半才炸。 

ArtifactSpec

 声明每个节点产出物的契约：

required_keys

：必须有；

forbidden_keys

：禁止出现（如 raw secret）；

max_bytes

：序列化大小上限，防单节点撑爆内存与下游 prompt。

校验通过后算 

checksum

，再 

写入 ArtifactStore

：带 

workflow

、

node

、

tenant_id

、

run_id

、

parent_ids

（来自依赖链上已完成节点的 artifact id）——形成 

lineage

，审计与复盘能回答「这份稿从哪几步长出来」。

节点输出里可回写 

_artifact_id

，下游 handler 若需要可追溯，读 id 去 store 拉全量，而不是在 inputs 里复制粘贴大 blob。

Workflow 全部完成后，还可做 

harness handoff

 校验：规定必须存在的 artifact key 集合齐了没有——适合评测 harness 与生产发布门。

任务图监督：父子 run 与孤儿策略

复杂场景会有 

子 run

（子 agent、子 workflow）挂在父 run 下。

TaskGraphSupervisor

 登记 parent/child，父 run 终止时按 

OrphanPolicy

 处理孩子：

FAIL

：标记失败，防无人认领的僵尸子任务；

CANCEL

：级联取消；

ADOPT

：交给指定 adopter run 接手。

这与 OS 里进程组、会话领导退出时的语义类似——Agent 编排里 

别默认「父死子活还正确」

，策略要写进 spec。

涌现护栏与预算台账：多节点时的「别跑飞」

多个节点、多个子 run 叠在一起，容易出现 

步数或外呼次数指数感膨胀

。

EmergenceGuardrails

 在进程内维护计数器（如 

workflow.node_completed

）：warn 阈值 + hard limit，trip 则 

短路当前节点并记审计

。集群化时可换成集中计数存储，但 

API 形状

宜稳定。

BudgetLedger

（
连载 02
 提过账本）在租户维度管 token/cost/并发等；workflow 节点若消耗大，应在 

进 handler 前

 与 ledger 对齐——编排层负责「这一 run 还值不值得继续」，不是等账单事后才发现。

一张白板图：从 spec 到节点内的 tool loop

伪代码：compile 与 run（结构用）

function

 CompileWorkflow(spec) -> Runnable:

    order := TopologicalSort(spec.nodes)

    

for

 name 

in

 order:

        register_node(name, handler=spec.handlers[name.name])

    

return

 Runnable(order, spec)

function

 RunWorkflow(ctx, spec, initial_inputs) -> WorkflowState:

    state := NewState(ctx.run_id, spec.name)

    inputs := initial_inputs

    

for

 node_name 

in

 TopologicalSort(spec.nodes):

        

if

 RunCancelled(ctx.run_id):

            

break

        result := StepNode(ctx, spec, state, node_name, inputs)

        

if

 result is Halted:

            

return

 state   

# 失败 / 待审批 / 护栏 trip

        inputs := result.merged_inputs

    VerifyHarnessHandoff(state)   

# 可选

    

return

 state

function

 StepNode(ctx, spec, state, node_name, inputs):

    out := HandlerRegistry[spec.node(node_name).handler](ctx, inputs)

    

if

 out needs approval:

        state.pending := node_name

        

return

 Halted

    

if

 not ValidateArtifact(spec.node(node_name).artifact_spec, out):

        

return

 Halted

    artifact_id := ArtifactStore.Put(out, parent_ids=DependsArtifacts(state))

    Guardrails.Increment(

"workflow.node_completed"

, ctx.tenant_id)

    

return

 Ok(merge(inputs, node_name, out, artifact_id))

Handler 内部

仍可调用 

GatewayComplete

 + 

ToolRegistry.Execute

（
连载 06
、
05
）——编排不替代控制循环，只是 

包一层壳

。

几句容易踩坑的地方

把 workflow 写成 5000 行 if-else

——没有 spec、没有拓扑、无法 resume。

节点之间传 Python 对象不入 store

——进程重启后 lineage 全没。

无 ArtifactSpec

——上游改字段下游 silent break。

审批 resume 走另一套代码路径

——图引擎与原生状态不一致。

子 run 无 orphan 策略

——父任务取消后子 agent 还在调外网。

只有 COMPLETED 无 AWAITING_APPROVAL

——人审只能杀进程。

涌现护栏只打日志不 trip

——多节点跑飞直到账单爆。

收束一下，下一篇讲什么

本篇应能说清：

协调层与控制循环的分工

、DAG 与节点 handler、

制品合同与 store lineage

、挂起/resume 与 

TaskGraph 孤儿策略

，以及多节点场景下护栏/账本为何必要。

下一篇进入 

沙箱与资源

：工具与代码执行的超时、路径与配额——哪些约束不该交给模型自觉。（连载 09）

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922888&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVPIb30kmXRHh3M7iBELJfkFMTzShd6AA3xMIIa02oFCUDQy3tSRLpAoGYzEjJxbFilGfAVwy-dTm5gKc1P0B0Kc&new=1
