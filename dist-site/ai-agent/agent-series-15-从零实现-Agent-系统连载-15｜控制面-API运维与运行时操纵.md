# 《从零实现 Agent 系统》连载 15｜控制面 API：运维与运行时操纵

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第15篇
> **核心主题**：控制面API

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目Agentium，源码详见GitHub。

连载 14 《后台平面（Background）：主动任务与桥接通知》
的后台 daemon 需要 

pause/resume

；
连载 12 《治理平面：策略引擎、审批与审计血缘》
的审批要 

decide

；运维要看 

run  timeline、制品、预算

。

控制面 API

 就是把这些「操纵运行时」的动作收成 

稳定 HTTP 契约

，与 Chat 产品接口同进程但 

语义分层

——别让运维 curl 一条路由，底层却绕过 Policy 直调 handler。

控制面 vs 数据面：为什么要单独一层

数据面

：用户/chat/workflow 正常跑 Turn、写消息、调工具——业务流量。

控制面

：健康探测、取消 run、查审计时间线、批/拒审批、查 effective policy、后台 pause、预算摘要——

运维与治理流量

。

分开的好处：

鉴权模型不同

：控制动作绑 

capability

（如 

runs.cancel

、

background.control

），不是「能聊天就能杀进程」；

故障域隔离

：

/healthz

 轻量；重查询（timeline 500 条）不堵 Chat POST；

审计一致

：

run_cancel_requested

、

approval_decided

 走同一 

AuditSink

（
连载 12
）。

Agentium 里 

ControlPlaneAPI

 是面向运行时的 

facade

（

run_turn

、

resume_turn

、审批查询、run 摘要）；

HTTP 层

用 mixin 拆路由（chat、runs、policy、budget/background…），装配时注入 

HTTPControlPlaneResources

——registry、daemon、artifact_store 等 

窄引用

，避免 handler 反向依赖整个 bootstrap。

入口薄、路由厚：HTTP 怎么长

典型分层：

ThreadingHTTPServer

  → ControlPlaneHTTPRequestHandler（按 path 分发）

      → _resolve_identity（X-Tenant-Id / Bearer）

      → cap_granted（capabilities）

      → ControlPlaneAPI 或 resources.xxx

GET /v1/me

 返回当前主体的 

capabilities 列表

（由 role 并集算出），前端用来灰显菜单；

每个敏感接口仍二次校验 cap

——

me

 只是发现，不是授权本身。

身份头常见：

X-Tenant-Id

、

X-User-Id

、

X-Role

；生产可 hybrid Bearer。

空 tenant

 在 control plane 层 

直接拒绝

 并审计——与 memory、policy 的 tenant  invariant 同族。

存活与就绪：healthz / readyz

**

/v1/healthz

**：进程活着吗；若挂了 

StateObserver

，可带 probe 明细，unhealthy 时 

503

；

**

/v1/readyz

**：API 与依赖是否可接流量（如 runtime 已装配、observer ready）。

K8s 里 liveness vs readiness 的老套路；Agent 系统长时间跑 tool loop，

ready 不应只 ping 通端口

——database、audit sink、关键 store 宜进 probe。

/v1/version

 供发布对照；与插件 

fingerprint

（
连载 11
）一起回答「这盒是什么版本」。

运行时操纵：Turn、审批、取消

ControlPlaneAPI.run_turn / resume_turn

映射到 

AgentRuntime

，可走 

TenantFairScheduler

 入队；队列满则 

backpressure

 结构化返回，而不是挂死 HTTP。

审批

get_approval

、

decide_approval

（approve/reject）——与 ApprovalGate 同步，供工单/UI 调；cap 需 

approval.decide

。

取消 run

POST .../runs/{run_id}/cancel

（cap：

runs.cancel

）典型链：

RunCancelRegistry.cancel

（协作式，
连载 04
）；

LifecycleManager

 stop/kill（可选 force）；

TaskGraphSupervisor.terminate_run

（子 run 孤儿策略，
连载 08
）；

审计 

run_cancel_requested

。

取消是 

控制面一等公民

，不是杀 HTTP 连接就完事。

可观测 run：timeline、制品、会话检查点

runs.read

列表：

list_run_summaries(tenant_id)

；

timeline

：

get_run_timeline(run_id)

——审计事件序列，串
连载 12
 血缘；

artifacts

：按 run 列制品（
连载 08 
ArtifactStore），tenant 不匹配 

403

。

sessions.checkpoint

会话检查点 list/create/restore——长对话 

可回滚到 seq

，与 memory trim 互补；MVP 里 session_id 常与 run_id 对齐，实现时读契约即可。

Chat 消息 API 也在同一 HTTP server，但产品语义归 

ChatTurnService

；控制面文档宜把 

「操纵 run」

 与 

「发一条消息」

 分开写，避免运维误用 chat 路由做 kill。

治理与容量：policy、budget、background

能力

典型 cap

作用

有效策略

governance.policy.read

GET 

/v1/policy/effective

策略发布

policy.release.submit

提交 signed bundle（连载 12）

领域包

governance.packs.read

加载/查询 domain pack

预算摘要

budget.read

租户 token/cost 快照

后台状态

background.read

daemon paused? thread alive?

后台控制

background.control

pause/resume（连载 14）

Scheduled jobs、MCP/skills 管理、Wiki ingest 等 

资源型 POST

 也在控制面路由表上，原则相同：

cap + tenant scope + 审计

。

一张白板图

伪代码：cancel 与 inspect

function

 ControlCancelRun(run_id, actor, force=

false

):

    require_capability(actor, 

"runs.cancel"

)

    RunCancelRegistry.Cancel(run_id)

    

if

 force:

        LifecycleManager.Kill(run_id, reason=

"http_cancel_force"

)

    

else

:

        LifecycleManager.Stop(run_id, reason=

"http_cancel"

)

    TaskGraph.TerminateRun(run_id)

    Audit.Append(

"run_cancel_requested"

, run_id, actor, force)

    

return

 Accepted

function

 ControlInspectQueues(tenant_id, actor):

    require_capability(actor, 

"observability.read"

)   

# 或 admin

    

return

 {

        

"scheduler_pending"

: Scheduler.PendingCount(tenant_id),

        

"chat_ingress_depth"

: ChatIngress.QueueDepth(tenant_id),

        

"background_paused"

: BackgroundDaemon.Paused,

        

"approval_pending"

: ApprovalGate.ListPending(tenant_id),

    }

function

 ControlRunTurn(ctx, tool_name, args):

    assert ctx.tenant_id non-empty

    

if

 Scheduler != nil:

        try:

            

return

 Scheduler.SubmitAndDrain(ctx, tool_name, args)

        catch Backpressure:

            

return

 Response(status=

"blocked"

, error_code=

"backpressure"

)

    

return

 Runtime.RunTurn(ctx, tool_name, args)

几句容易踩坑的地方

运维脚本直调 ToolRegistry

——无 cap、无 audit。

healthz 永远 200

——依赖挂了仍接流量。

只有 /v1/me 鉴权、接口不验 cap

——越权取消 run。

cancel 只断 WebSocket

——tool loop 仍在跑。

timeline 不滤 tenant

——跨租户读审计。

控制面 handler 里写业务规则

——应下沉 coordination/governance。

Chat 路由兼做 kill switch

——语义混乱、难 RBAC。

readyz 不检查 audit sink 可写

——「能启动不能记账」。

收束一下，下一篇讲什么

本篇应能解释 

控制面为何独立

、health/ready/capability、

cancel / timeline / checkpoint / budget / background

 在 API 层的落点，以及 

ControlPlaneAPI 与 HTTP resources 的分工

。

下一篇进入 

可观测性与可靠性

：日志、指标、追踪 span 该钉在哪；故障注入与演练怎么和「可验证」联动。（连载 16）

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922888&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVPEg*tpB0jiu3Ge3veVwD-GEGWe79alM8d-zgyBEdcJTa4cYfgrUaCXxy8hsh2mjemdyZLtPukXnf2Bl4RE-y4z&new=1
