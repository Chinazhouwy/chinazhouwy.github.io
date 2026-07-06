---
title: "《从零实现 Agent 系统》连载 14｜后台平面（Background）：主动任务与桥接通知"
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
summary: "《从零实现 Agent 系统》连载 14｜后台平面（Background）：主动任务与桥接通知"
tags:
---

# 《从零实现 Agent 系统》连载 14｜后台平面（Background）：主动任务与桥接通知

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第14篇
> **核心主题**：后台平面/主动任务

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目Agentium，源码详见GitHub。

连载 03
–
04 
的 Turn 与调度，默认 

用户发消息才转

。生产里还有另一类活：

审批过期扫描、记忆 consolidate、事件驱动的运维通知、定时 health sweep

——不应占 HTTP 线程，也不能另起一套「没策略、没审计」的小脚本。

Background 平面

就是 

系统驱动的外环

：守护进程 tick、触发器、事件 ingest → plan → dispatch，与前台 

共用

 Policy、ToolRegistry、Memory、OutboundOrchestrator，但 

身份、run_id、权限 cap

 要分清楚。

前台 vs 后台：同一核心，不同入口

维度

用户驱动（Foreground）

系统驱动（Background）

触发

Chat API、通道 inbound

IntervalTrigger、CallbackTrigger、EventIngestor

会话

显式 

session_id

、用户消息

headless / 运维 

run_id

（如 

_background

）

等待方

用户等 HTTP 响应

无同步 caller；结果走 notify 或 audit

停手

取消 token、连接断开

pause/resume

、noise tripwire

连载 01
 说过：前台 Chat 与后台任务 

语义可共享

（同一 tool loop、同一 memory lane），

入口与配额宜分开

——否则「谁花的 token、谁触发的出站」算不清。

Scheduled Job

（cron 类定时任务，协调层另有一套 runner）与 Background daemon 

可并存

：前者偏「到点跑一条 job 记录」；后者偏 

进程内 sweep + 事件反应 + 安全 hook

。别混成一个 cron 打天下。

BackgroundDaemon：周期 tick，可暂停

BackgroundDaemon

 在独立 

daemon 线程

里按 

interval_seconds

 循环 

tick()

，职责包括：

扫 ApprovalGate 过期

 → 审计 

background_approval_expired

；

评估 IntervalTrigger / CallbackTrigger

 → 到点则 

_dispatch

 注册 handler；

pause/resume

：运维 

一键停主动作

（trigger 不 fire，但线程可仍在）；

tick_full

（全量 sweep）：drain 事件 → plan → notify / 待审批 → memory consolidate。

每一步 

try/except 隔离

——consolidate 失败不应挡住 approval 过期扫描。

HTTP 侧提供 

background.read / background.control

 capability：查 

paused

、thread 是否 alive，远程 pause/resume——控制面与数据面分开（下一篇 15 展开 API）。

触发器：定时与回调

IntervalTrigger

：固定 cadence，

should_fire

 + 

mark_fired

 产生 

TriggerEvent

（name、时间戳、payload）；

CallbackTrigger

：外部谓词为真时 fire（如「队列深度大于 N」），适合与 metrics hook 对接。

Handler 注册在 daemon 上：**trigger 名 → callable(event)**。Handler 内若要做 side effect，应再走 

BackgroundPolicyGuard

 或 

evaluate_action

，不能假设后台免策略。

事件 ingest → TriggerPlanner：主动，但不自动乱动

并非所有主动作都靠 cron。

EventIngestor

 收运行时信号（审批失败、rate limit、通道错误、新 memory 条目…）：

有界 FIFO + 

dedupe

（同 topic + dedupe_key 在 TTL 内只收一次）；

drain()

 交给 

TriggerPlanner

。

Planner 用 

声明式 TriggerRule

（topic → action、risk、description），输出两类队列：

suggestions

（低风险）→ 经 

NotifyBridge

 直接通知；

approval_required

（high/critical risk）→ 只记 

background_action_requires_approval

，

不偷偷执行

。

Planner 

规则确定性、不依赖 LLM

——审计能把每条 action 指回 source event。

若 ingest 

噪声过高

（submissions_in_window 超阈），daemon 可 

自动 pause

 并打 

background_noise_tripwire

——防事件风暴拖死外环。

NotifyBridge：后台也要走出站闸口

后台「建议通知运维」时，

NotifyBridge

 把 

NotifyRequest

 转成 

OutboundMessage

，交给
连载 10
 的 

OutboundOrchestrator

：

quiet hours、rate limit、DLP、SecretLeak、涌现护栏 

与前台一致

；

失败走 orchestrator 的 

channel_failed

 审计，不在 daemon 里 silent drop。

这是 

Background → Channel

 的唯一窄桥；别在 handler 里直接 

smtp.send

。

BackgroundPolicyGuard：外环不能绕过治理

BackgroundPolicyGuard

 包装 PolicyEngine：后台若要 

等价于一次 tool call

 的 action，先 

decide_tool_call

——只有 

ALLOW

 才继续；DENY / REQUIRE_APPROVAL 与前台同语义（审批路径走 gate，不硬跑）。

evaluate_action(context, tool_name, args)

 失败时记 

background_action_blocked

，带 

rule_id

。

与
连载 12
 衔接：

后台不是法外之地

。

Memory Consolidator：后台维护长期记忆

连载 07
 的 SHORT 层摘录，由 

MemoryConsolidator

 在 tick_full 里按租户跑：去重、晋升 MID、冲突标注。使用 

native memory lane

 的 consolidation target，与 chat 泳道路由分开配置——

写记忆在 Turn 后，整理记忆在 Background

。

一张白板图

伪代码：pollTriggers 与 headless dispatch

function

 BackgroundWorkerLoop(interval):

    

while

 not stopped:

        ExpirePendingApprovals()

        

if

 paused:

            sleep(interval)

            

continue

        

for

 trigger 

in

 IntervalTriggers:

            

if

 trigger.ShouldFire(now):

                event := trigger.MarkFired(now)

                DispatchTrigger(event)

        events := EventIngestor.Drain()

        plan := TriggerPlanner.Plan(events)

        

for

 action 

in

 plan.suggestions:

            

if

 action.risk is low:

                NotifyBridge.Notify(action.toNotifyRequest())

        

for

 action 

in

 plan.approval_required:

            Audit(

"background_action_requires_approval"

, action)

            

# 不自动执行 side effect

        

if

 MemoryConsolidator != nil:

            ctx := HeadlessContext(tenant_from_config)

            MemoryConsolidator.Consolidate(ctx)

        sleep(interval)

function

 DispatchHeadlessJob(spec, tenant_id):

    ctx := RequestContext(

        run_id=new_run_or_background_id(),

        tenant_id=tenant_id,

        user_id=

"system"

,

        role=

"background"

,

    )

    

if

 not BackgroundPolicyGuard.Check(ctx, spec.tool_name, spec.args):

        

return

 Blocked

    

return

 WorkflowOrchestrator.Run(ctx, spec)   

# 或 enqueue ScheduledJob

headless_session

 不是「无 tenant」——仍要带 

tenant_id、trace_id、审计 run_id

，只是没有用户在等 HTTP。

几句容易踩坑的地方

后台线程直接调 handler

——绕过 Registry execute 与 sandbox。

Notify 直发 SMTP

——绕过 Orchestrator 出站安全。

TriggerPlanner 用 LLM 当场决策

——不可审计、不可复现。

无 pause

——事件风暴时无法一键止血。

ingest 无 dedupe

——同一告警刷爆通知。

consolidate 与 chat 共 mem0 外联 lane

——local_only 会话被后台写穿。

前台/后台 共用同一 run_id

——血缘混乱。

ScheduledJob 与 BackgroundDaemon 职责重叠却不文档化

——运维不知 cron 改哪。

收束一下，下一篇讲什么

本篇应能区分 

用户驱动 Turn

 与 

系统驱动 tick/event

，说清 

Trigger → Planner → NotifyBridge → Orchestrator

、

PolicyGuard

、

pause/consolidate

 在后台的位置。

下一篇进入 

控制面 API

：健康检查、容量、后台 pause、预算查询——运维如何操纵运行时而不进业务 if-else。（连载 15）

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922925&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVO-0EZVSmaJLhts3sZODfqKL4UOGjjeJBX9gi-bUXid5eczM4dWvhW3lfgfgFZu*KevYdv9ELZdo2n33lK*XgXj&new=1
