# 《从零实现 Agent 系统》连载 06｜AI 网关：路由、限流、内容与成本

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第6篇
> **核心主题**：AI网关/路由/限流

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目Agentium，源码详见GitHub。

连载 05 《工具系统：契约、注册与安全默认》
管住了「工具怎么出门」。

本篇管「算从哪来、花多少、什么话能进能出」

——模型厂商 API 不应散落在业务代码里各写各的；需要一层 

AI 网关

，把路由、限速、内容安全、输出策略和成本意识收在一处。

为什么单独一层，而不是在 handler 里调 OpenAI

三个现实理由：

换模型、换区域、换隐私级别

时，只改路由表，不动 tool loop；

限流与审计

要按租户记账，和「这一轮对话逻辑」解耦；

安全与合规

（注入、DLP、密钥形态、输出格式）应在

进模型前、出模型后

各走一遍，而不是每个调用点复制粘贴。

网关是 

critical path

：用户等着回复，这里的检查多数是

同步

的——能挡就挡、能限就限，别指望全部扔到异步队列里「事后补刀」（离线扫描可以并存，但不能替代在线闸门）。

路由：不是 round-robin，是带约束的选型

路由回答：

这次请求该用哪条模型线路

。常见输入包括：

数据隐私级别

：受监管数据不能送到「公网模型」的线路；

能力需求

：要不要 tool、长上下文、多模态；

成本与延迟档位

：在能满足约束的路由里，优先更便宜或更快；

策略禁止项

：某些 capability 全局 deny。

Agentium 的路由器思路是

确定性决策链

：先按隐私过滤，再查 capability 是否缺失或被 deny，再比 cost/latency tier，留下候选里「足够便宜、足够快」的一条，并写 

reason_chain

 方便审计——不是黑盒 load balance。

Chat 场景里，具体厂商客户端（如 DeepSeek 兼容 API）挂在路由选定的线后面；

厂商差异

（thinking 模式、DSML 工具格式等）宜收在网关子适配里，别漏到 coordination 层。

限流：按租户的 token 桶

模型按 token 计费，网关侧常用 

token bucket

：每个租户一个桶，容量 + refill 速率，允许短时突发，长期仍受 cap。

请求进来先 

reserve 预估 token

；若不够，返回 

rate_limited

，并可选告诉调用方要等多久——这与连载 04 的背压同族，只是计量单位换成 

token/min

 一类。

被挡在路由或安全闸门之前消耗的预留，应 

refund

 回桶里，避免「没打成模型也扣额度」的冤案。

内容安全：进门一道、出门一道

Inbound（进模型前）

：用户可控 prompt——提示注入探测、违宪/滥用话术等。

Outbound（出模型后）

：响应里是否夹带密钥形态、敏感片段，是否需 

redact

 再返回。

网关把多探测器收成 

ContentSafetyPipeline

，给出统一 

allowed / blocked_reason / findings

，路由器只认结果并写审计——安全模块可以迭代，管线顺序保持稳定。

注意与连载 05 工具层 

post_check

 的分工：网关管 

模型表面

；工具输出还有自己的 DLP 阶段，两层不要混成一个 if。

输出策略与成本防御

Prompt/Output Policy

：除了「内容危不危险」，还有「格式合不合规、是否泄露内部模板」等——进模型前检 prompt，出模型后检 response，违规可直接 

PolicyDenied

，不进用户界面。

成本防御

靠组合手段：路由的 cost tier、token 限流、连载 02 的预算账本、以及 tool loop 里的 

usage 汇总

（每圈 completion 的 prompt/completion tokens 累加）。网关是

第一道 token 闸门

；全链路账单还要和工具、多圈 loop 对齐，别只盯单次 completion。

Critical path 上建议的顺序

一条可落地的 

complete

 管线，可记作：

输出策略（prompt）

限流 reserve

Inbound 内容安全

路由 decide

调用模型客户端

输出策略（response）

Outbound 内容安全

（必要时 redact）

返回 + 审计

前面任一步失败，应短路并尽量 

退还已 reserve 的 token

；状态宜区分 

rate_limited

、

blocked

、

no_route

、

ok

，便于前端与告警各走各的处理。

伪代码：gateway.complete（结构用）

function

 GatewayComplete(ctx, route_req, prompt, estimated_tokens) -> Outcome:

    assert_prompt_policy(prompt)

    rate := RateLimiter.Reserve(ctx.tenant_id, estimated_tokens)

    

if

 not rate.allowed:

        

return

 RateLimited(rate)

    safety_in := ContentSafety.CheckInbound(prompt)

    

if

 not safety_in.allowed:

        RateLimiter.Refund(ctx.tenant_id, estimated_tokens)

        

return

 Blocked(safety_in)

    route := Router.Decide(ctx, route_req)

    

if

 route is None:

        RateLimiter.Refund(ctx.tenant_id, estimated_tokens)

        

return

 NoRoute

    client := ProviderClient(route)

    raw := client.Complete(prompt)   

# 含 timeout / 取消，略

    assert_response_policy(raw)

    safety_out := ContentSafety.CheckOutbound(raw, prompt)

    

if

 not safety_out.allowed:

        

return

 Blocked(safety_out)   

# 或 redact 后返回

    Audit.Log(ctx, route, rate, safety_in, safety_out)

    

return

 Ok(maybe_redact(raw, safety_out))

ProviderClient

 之下才是 HTTP/SDK；

coordination 里的 tool loop

 只应看见「我要一轮带 tools 的 completion」，而不是自己拼 API Key 和 base URL。

几句容易踩坑的地方

业务里散落三家 SDK

，路由和限流永远加不齐。

只做 outbound 不做 inbound

，注入在 prompt 里长驱直入。

限流按 QPS 不按 token

，大上下文一冲就穿。

路由无 reason_chain

，出事只能说「换了个模型试试」。

把网关当万能 DLP

，工具返回的脏数据不在工具后检——防线缺口。

收束一下，下一篇讲什么

本篇应能说清：

网关为何独立

、critical path 上 

先限流还是先安全、路由在哪一步

、token 与成本如何在第一道门就开始守。

下一篇进入 

记忆系统

：上下文窗口、外部记忆后端、以及和主对话「泳道」怎么分，避免所有东西都塞进 prompt。（连载 07）

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922925&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVPaHHOWJXC*MS8wv6ZLXK5yOQCItSyNgmTMK59saMYUa2bQ-jpF*wGfxLZSkEMMs4n*QU7rCYEcR3l87tx4rejj&new=1
