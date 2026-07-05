# 《从零实现 Agent 系统》连载 16｜可观测性与可靠性：日志、指标、追踪与演练

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第16篇
> **核心主题**：可观测性/追踪

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目Agentium，源码详见GitHub。

连载 15 《控制面 API：运维与运行时操纵》
的控制面能 

cancel run、拉 timeline

——timeline 来自 

AuditSink

（
连载 12
）。

本篇补另一块拼图

：同样一次 Turn，在 

指标与追踪

 里长什么样；故障来了系统是否 

safe degrade

；发布前有没有 

可重复的演练证据

。可观测不是「多打几行 printf」；可靠性不是「希望别挂」——要和工艺标准里的 

可验证

 绑在一起。

三件套：日志、指标、追踪，各管什么

信号

回答什么

Agent 系统里典型内容

Log

这一瞬间发生了什么（离散事件）

policy denied、DLP hit、background paused

Metric

聚合趋势、SLO、告警

tool 成功率、turn 延迟、p99 queue wait

Trace

一次请求跨组件的路径与耗时

Turn span → 子 span tool / gateway

Audit

（append-only 合规账本）偏 

「谁对谁错、能否回放」

；

Telemetry

 偏 

「系统健不健康、哪慢」

——字段应对齐 

tenant_id

、

run_id

、

trace_id

，便于从 Grafana 跳到 timeline（
连载 15
）。

Agentium 用 

RuntimeTelemetry

 协议抽象：

start_span

、

record_tool_execution

、

record_runtime_turn

、

record_event

、

record_quota_hard_limit_trigger

。未配 OTel 时 

NullTelemetry

 no-op——单测不依赖 exporter，生产用 

OTelTelemetry

（

OTEL_EXPORTER_OTLP_ENDPOINT

 等环境变量）。

控制循环上至少 3 个必打 span / 指标点

连载 03
 的 loop，观测应钉在 

边界

，不是 handler 内部随意 log：

Turn 外层

agentium.turn.run

 / 

agentium.turn.resume

——带 

tenant_id

、

run_id

、

trace_id

；结束 **

record_runtime_turn

**（status、error_code：completed / pending_approval / blocked / cancelled）。

工具执行

Registry 

execute

 完成时 **

record_tool_execution

**（tool_name、status、latency_ms）——与 ToolCallRecord、审计事件对账。

网关 completion

（Chat tool loop 每一圈）

宜有独立 span（如 

gateway.complete

）或至少 event：模型 latency、rate_limited、blocked——否则「慢在 LLM 还是慢在工具」分不清。

另：

安全与治理事件

用 

record_event

 统一计数——

prompt_injection_blocked

、

dlp_hits_detected

、

control_plane_backpressure

、

emergence_guardrail_tripped

 等，别散落 magic string 且无 metric。

OpenTelemetry：协议稳定，导出可换

OTelTelemetry

 初始化：

Tracer

：BatchSpanProcessor + Console / OTLP gRPC；

Meter

：

agentium_tool_executions_total

、

agentium_runtime_turns_total

、

agentium_tool_latency_ms

（histogram）、

agentium_events_total

、

agentium_quota_hard_limit_triggers_total

。

start_span(name, attributes)

 返回 context manager，与 

with

 配合保证 span 闭合。

命名宜 

稳定、带点分域

：

agentium.turn.run

 而非 

doStuff

——便于告警规则跨版本复用。

结构化 log（

otel.tool_execution

 等）与 metric 

双写

——没配 collector 时仍能从日志 grep，但 

SLO 应靠 metric

。

属性与 cardinality：能关联，别爆炸

必带

：

tenant_id

、

run_id

、

trace_id

（RequestContext 已有）。

可选

：

tool_name

、

error_code

、

scheduler_queue_wait_ms

（控制面调度注入）。

慎做高基数 label

：

user_id

 全量进 metric label 会炸 TSDB；高基数放 

span attribute 或 audit

，metric 用聚合维度（tenant、tool、status）。

Chat 多圈 loop：子 span 的 parent 应是 

同一 trace_id

  propagated 的 context——否则 Jaeger 里一 Turn 散成几条根 trace。

可观测 ↔ 可验证：别只有 dashboard 没有断言

工艺标准里 

可观测

 与 

可验证

 联动方式：

单测

断言 

record_event

 / audit 被调用（Mock Telemetry）；

集成测

跑一条 Turn，查 timeline 事件顺序；

发布门

跑 

ReliabilityDrillRunner

，产出 

ReliabilityDrillReport

 当证据。

Drill 覆盖标准场景（确定性模拟，非随机 fuzz）：

model_timeout

——网关/LLM 超时是否 safe degrade；

tool_exception

——handler 抛错是否 structured blocked，不拖死 loop；

queue_backpressure

——调度满是否返回 backpressure 而非 silent hang。

报告指标示例：

safe_degrade_success_rate

、

recovery_mttr_seconds

 vs 

mttr_target

；全 scenario 

passed

 才过门——与连载 24 评测/发布门衔接。

一张白板图：一次 Turn 的信号流

伪代码：span 与演练

function

 RunTurnWithObservability(ctx, tool_name, args):

    attrs := {tenant_id: ctx.tenant_id, run_id: ctx.run_id, trace_id: ctx.trace_id}

    with Telemetry.StartSpan(

"agentium.turn.run"

, attrs):

        try:

            with Telemetry.StartSpan(

"tool.invoke"

, {tool_name: tool_name}):

                t0 := clock()

                result := ToolRegistry.Execute(ctx, tool_name, args)

                Telemetry.RecordToolExecution(tool_name, result.status, MsSince(t0), attrs)

        except Backpressure as e:

            Telemetry.RecordEvent(

"control_plane_backpressure"

, attrs)

            

return

 Blocked(e)

        finally:

            Telemetry.RecordRuntimeTurn(result.status, result.error_code, attrs)

    Audit.MirrorCriticalEvents(...)   

# 与 telemetry 互补

function

 RunReliabilityDrillsForReleaseGate() -> Report:

    runner := ReliabilityDrillRunner(mttr_target_seconds=300)

    report := runner.RunStandardDrills(rounds_per_scenario=10)

    assert report.metrics[

"safe_degrade_success_rate"

] >= threshold

    assert report.metrics[

"recovery_mttr_seconds"

] <= report.metrics[

"mttr_target_seconds"

]

    

return

 report

几句容易踩坑的地方

只有 audit 没有 metric

——无法做 SLO 告警。

只有 metric 没有 trace

——p99 高但不知哪一段。

span 不带 trace_id

——与 Chat 多圈 loop 对不齐。

NullTelemetry 在生产忘记换 OTel

——盲飞。

高基数 label

（session_id 进 counter）——监控系统拖垮。

日志打用户 prompt 全文

——合规灾难；打 hash/长度。

Drill 只跑 happy path

——发布门假绿。

演练结果不入 CI artifact

——论文/审计无法复现。

收束一下，下一篇讲什么

本篇应能为控制循环指出 

≥3 个打点位置

（Turn、tool、gateway），说清 

RuntimeTelemetry / OTel

 与 

audit timeline

 的分工，以及 

ReliabilityDrillRunner

 如何把「可观测」接到 

可验证/发布门

。

下一篇我们回到连载 07 没讲透的记忆，把方案做深。企业级 Chat 的记忆其实有两条互相独立的线：一条是时间尺度，短期对话、中期要点、长期事实各有各的保留与压缩策略；另一条是隔离边界，从租户、用户到具体某一次会话乃至外联记忆，都得分得清、审计得了。下一篇会讲清这两条线怎么正交组合，为什么把中长期记忆统一成一种叫 Structured Notes 的结构化笔记，以及每个 Skill 又如何用自己的记忆策略去覆盖默认的写入、压缩和召回。（连载 17）

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922888&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVNZ024umBlGAuPxxj7SGJWHNyDt4L2G5OaSszVchn0OK7VdyIVOZrzBKtZSQX9oAleO9qrIa-C-*A2pMlf5OzI0&new=1
