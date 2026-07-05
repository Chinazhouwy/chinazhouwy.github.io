# 《从零实现 Agent 系统》连载 10｜多通道（Channels）：同一核心，多种入口

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第10篇
> **核心主题**：多通道入口

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目Agentium，源码详见GitHub。

连载 09《沙箱与资源：执行隔离的工程含义》 
守住了工具与脚本在宿主里的执行边界。

本篇看「人从哪进来、系统往哪出去」

：Web 工作台、邮件、IM webhook、将来还有 CLI——若每个入口各写一套 Turn 逻辑，策略、审计、记忆泳道会碎成一地。通道层的任务是把 

传输细节

 挡在门外，让 

控制平面 + ChatTurnService

 只认统一的会话语义。

入站 vs 出站：两条线，一个核心

通道平面常拆成两半：

方向

做什么

归一后交给谁

入站（inbound）

外部事件 → 稳定 envelope → 触发一轮 Chat

控制平面 

POST /v1/chat/messages

 → 

ChatTurnService

出站（outbound）

系统通知 / 审批提醒 / 工具触达 → 选通道发送

OutboundOrchestrator

 → 各 

ChannelAdapter

核心不应知道 SMTP 端口或飞书 JSON 长什么样；它只认 

tenant_id

、

user_id

、

session_id

、

content

、以及 HTTP 头上的 

Idempotency-Key

（IM 消息 id 防重放）。

入站：normalize，再 enqueue Turn

IM 或邮件网关打进来的 payload 字段名各家不同：

msg_id

 / 

message_id

、

open_id

 / 

sender

、

text

 / 

content

……

ChannelInboundEnvelope

 做稳定形状：

channel

：wechat / feishu / email …

external_message_id

：外部去重键；

peer_id

：对端标识；

content

：用户文本；

tenant_id

 / 

user_id

 / 

role

；

可选 

session_id

，缺省则 

{channel}:{peer_id}

。

normalize

 只做字段映射与必填校验，不做 LLM。

dispatch_inbound_to_chat

 再转发到控制平面 Chat API，带上 

X-Tenant-Id

、

X-User-Id

、

X-Channel-Id

、

X-Channel-Peer-Id

 等——与 Workbench 直连接口 

同一条 Turn 管线

（
连载 03 tool loop
、
连载 07 记忆
、
连载 05 工具注册
表全复用）。

Workbench 自己也是通道的一种：

浏览器 → HTTP handler → ChatTurnService

，只是省略了 normalize 那层，session 由前端显式传。

出站：Adapter 模式 + 统一 OutboundMessage

出站侧抽象 

ChannelAdapter

：

send(OutboundMessage) -> ChannelDeliveryResult

。

OutboundMessage

 已归一：

tenant_id

、

recipient

、

subject

、

body

、

kind

（WEB / EMAIL / …）、可选 

run_id

、metadata。各实现只关心 transport：

Web

：JSON POST 到配置的 webhook URL（Slack/Teams/自建 UI 接收入站 webhook 即可）；

Email

：SMTP 发 plain-text，测试可注入 fake sender；

Null

：内存记录、不触网——单测与 dry-run 默认适配器，保证 

Orchestrator 永远有合法 adapter 可调

。

还有飞书、企微、微信等 IM 适配器，原则相同：

不解析业务，只投递 envelope

；失败抛 

ChannelError

，由编排层记 failed 而非静默吞掉。

Adapter 应 

线程安全、快速返回

（目标在一秒以内）；慢 transport 宜异步队列 + 

transport_id

 对账，别占 worker 线程。

OutboundOrchestrator：出站也要过闸

工具或后台任务要「发通知」时，不应绕过治理直调 SMTP。

OutboundOrchestrator.dispatch

 典型顺序：

Quiet hours

：租户静默时段自动 defer（运维 override 可显式 bypass）；

Rate limit

：按租户滑动窗口，防通知风暴；

Pre-send 安全

：DLP、密钥泄漏、社工话术扫描——与连载 06 网关、连载 05 post_check 

同族

，专门守 

出站正文

；

Emergence guardrails

：

channel.outbound

 计数，trip 则 skip；

Fan-out

：对选定 adapter 逐个 

send

；

Audit + telemetry

：

channel_delivered

 / 

skipped

 / 

failed

 / 

*_blocked

 全入账。

这样即使有人 

绕过 ToolRegistry 直接调 orchestrator

，仍走 PRD 里的 

Channel → … → ChannelSend

 管线。

调用链（白板用）

入站 

进

 Turn；Turn 或 workflow 结束 

可能触发

 出站，但两条链 

adapter 不互相 import

。

伪代码：on_inbound 与 dispatch

function

 OnChannelInbound(channel, raw_payload, tenant_ctx) -> Result:

    envelope := NormalizeInbound(

        channel=channel,

        payload=raw_payload,

        tenant_id=tenant_ctx.tenant_id,

        user_id=tenant_ctx.user_id,

    )

    

return

 DispatchToControlPlane(

        POST 

"/v1/chat/messages"

,

        headers={

            

"X-Tenant-Id"

: envelope.tenant_id,

            

"X-User-Id"

: envelope.user_id,

            

"Idempotency-Key"

: envelope.external_message_id,

            

"X-Channel-Id"

: envelope.channel,

            

"X-Channel-Peer-Id"

: envelope.peer_id,

        },

        body={

            

"session_id"

: envelope.session_id or f

"{envelope.channel}:{envelope.peer_id}"

,

            

"content"

: envelope.content,

            

"auto_ingress"

: 

true

,

        },

    )

function

 OutboundDispatch(message, channels[]) -> DispatchResult:

    

if

 QuietHours(message.tenant_id) and not operator_override:

        

return

 Skipped(

"quiet_hours"

)

    

if

 not RateLimit.Allow(message.tenant_id):

        

return

 Skipped(

"rate_limited"

)

    EnforceOutboundSafety(message)   

# DLP / secrets / SE

    

for

 name 

in

 channels:

        adapter := Adapters[name]

        try:

            results.append(adapter.send(message))

        catch ChannelError as e:

            failures.append(name, e)

    AuditDeliveredOrFailed(results, failures)

    

return

 Aggregate(results, failures)

几句容易踩坑的地方

每个 IM 各自 fork 一套 Chat 逻辑

——策略与记忆永远对不齐。

入站不做 Idempotency-Key

——用户连点或 webhook 重试产生 duplicate Turn。

出站直调 SMTP 不经 Orchestrator

——DLP 与限流全缺。

Adapter 里塞 LLM

——通道层变第二大脑，延迟与审计不可控。

Null adapter 未接 bootstrap

——测试环境 send 空指针。

Quiet hours 无 override

——凌晨 P0 故障发不出告警。

Web webhook 失败只打日志

——应 

ChannelError

 + audit 

channel_failed

，便于告警。

收束一下，下一篇讲什么

本篇应能画出 

入站 normalize → 控制平面 Chat → Turn Service

 与 

出站 Orchestrator → Adapter

 两条链，并说明 

为何出站也要独立过闸

。

下一篇进入 

插件与 MCP

：扩展怎么加载、失败时安全默认、与 ToolRegistry 的边界。（连载 11）

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922925&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVO8SDmiJ0NNohrMDlDhskLT4Yo9xkHOEsTTxkg9BF-Hbzw14Rq3ObIEIe51KMezHyhm6dqBnNC6H9kMXt0e3Qcg&new=1
