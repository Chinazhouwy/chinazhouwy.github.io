---
title: "《从零实现 Agent 系统》连载 09｜沙箱与资源：执行隔离的工程含义"
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
summary: "《从零实现 Agent 系统》连载 09｜沙箱与资源：执行隔离的工程含义"
tags:
---

# 《从零实现 Agent 系统》连载 09｜沙箱与资源：执行隔离的工程含义

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第9篇
> **核心主题**：沙箱/资源隔离

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目Agentium，源码详见GitHub。

连载 05《工具系统：契约、注册与安全默认》
 的工具 execute 管线里，handler 之前有过策略、预算、预检；之后还有 DLP 与审计。

本篇落在 handler 真正「动手」那一格

：模型不会自觉守超时、不会懂路径白名单、更不会替你限制出站主机——这些必须是 

宿主 / 沙箱

 的执行期约束。理想是容器或 VM 级隔离；工程上往往先做 

能力声明 + 硬限制 + 可审计的单点 chokepoint

，留好接口以便日后换更强后端。

理想 vs 实用：别等完美隔离才上线

教科书里的沙箱是：

独立进程、只读根文件系统、网络 namespace、seccomp

。企业 Agent 第一版常做不到全栈容器化，但仍需要 

SafetySandbox 一类边界

：

工具 

声明

 自己要哪些 capability（如 

net.outbound.email

、

fs.read

）；

租户 / 工具 profile 

允许

 哪些 capability；

deny 发生在调用 callable 之前

——策略不过，handler 根本不跑；

进程内至少守 

墙钟超时、输出大小上限

；路径与 egress 用 metadata 辅助校验。

Agentium 参考实现是 

in-process 安全边界

：注释里写清楚「真容器以后可换 

_SandboxBackend

」，但 **call site 只认 

sandbox.run

**——这与
连载 01
 说的「固定入口」一致。

至少三条：不该交给模型解决的约束

面试或设计评审里，能脱口而出这三条（其实远不止）：

墙钟超时（wall-clock timeout）

模型无法保证 handler 在 N 秒内返回；无限循环、阻塞 I/O、死锁都要在沙箱层量 duration，超限抛 

SandboxTimeoutError

 并审计——与
连载 04
 节点/工具分层超时同族。

路径与文件访问范围（path allowlist）

工具若读写磁盘，应在 request metadata 里带 

sandbox_path

；profile 配置 

前缀白名单

，不在名单内直接 deny。别让「读 

/etc/passwd

」靠 prompt 里说不读来防。

出站网络与 capability 子集（egress + capability allowlist）

工具声明 

net.*

 类 capability；profile 可 

egress_deny_by_default

，仅 

egress_allow_hosts

 里的主机放行。模型侧看不见 DNS 解析细节，

宿主必须硬拦

。

还可加：

输出字节上限

（防单工具把 context 撑爆）、

并发 sandbox worker 配额

（见下文 ResourceManager）、

与策略引擎一致的 deny-before-invoke

。

SafetySandbox：单点 run，先审后跑

核心 API 形状：

sandbox.run(request, callable, *args)

。

SandboxRequest

 携带：

tool_name

、

tenant_id

、

capabilities 列表

、可选 

run_id

 / 

tool_use_id

、metadata（路径、egress 主机等）。

SandboxProfile

 按 

(tenant_id, tool_name)

 解析，支持通配 fallback：

(*, tool_name)

、

(tenant_id, *)

、

(*, *)

。未配置则 

默认 deny 全部 capability

——安全默认。

执行顺序大致：

解析 profile；

requested - allowed

 非空 → 

SandboxDeniedError

 + 

sandbox_denied

 审计；

路径 / egress 附加规则；

调用 callable

；

检查 duration、输出 size；

返回 

SandboxOutcome

（granted caps、duration_ms、output_bytes）+ 

sandbox_granted

 审计。

每一次 grant/deny/timeout 都走 

audit 回调

，便于灌进连载 12 的 lineage，而不是只在 stdout 里骂一句。

领域包（domain pack）可带 **

sandbox_profiles.yaml

**，启动时 merge 进 sandbox——与策略包一起发布、一起回滚。

与工具管线的分层：沙箱在哪一层

连载 05
 的 execute 七步里，沙箱宜包在 

第 5 步 handler

 外层，而不是替代策略或 DLP：

阶段

谁管

策略 / 审批

governance

token / 费用

budget + 网关

参数 schema

registry

能力、路径、超时、输出大小

sandbox

密钥形态、社工话术

post_check / 内容安全

模型、prompt、tool description 都不可靠

；最后一道「能不能真的执行这段代码、打这个 URL」必须在 sandbox chokepoint 闭合。

Skill 脚本类能力尤其应 

经 sandbox 暴露或执行

，而不是 handler 里直接 

subprocess

 绕过。

ResourceManager：cgroups 味的运营配额

BudgetLedger

 管 token、钱、并发 turn；

ResourceManager

 管 

运营资源

：并发文件句柄、内存占用估算、sandbox worker 槽位等——PRD 里类比 Docker 

cgroups

。

模式：

reserve → 用 → release

（

lease

 上下文管理器自动 release）。每个 

(tenant_id, resource)

 有 

hard_limit

 与可选 

soft_limit

：

超 hard → 

ResourceQuotaExceededError

，拒掉；

超 soft → 仍放行，但 

soft_breached

 供 telemetry 告警。

这与
连载 04
 租约、
连载 06
 token 桶 

同族不同维

：别用「限流 API」代替「限制同时跑几个重沙箱 worker」。

一张白板图：工具执行穿过沙箱与配额

POST

 之后 

release

 配额；异常路径也要 release，避免槽位泄漏。

伪代码：sandbox.run（结构用）

function

 SandboxRun(request, callable, args...) -> Outcome | Error:

    profile := ResolveProfile(request.tenant_id, request.tool_name)

    denied := 

set

(request.capabilities) - profile.allowed_capabilities

    

if

 denied:

        Audit(

"sandbox_denied"

, request, denied)

        

return

 SandboxDenied

    

if

 not PathAllowed(request.metadata.sandbox_path, profile.path_allowlist):

        

return

 SandboxDenied

    

if

 not EgressAllowed(request, profile):

        

return

 SandboxDenied

    start := MonotonicClock()

    output := callable(*args)

    duration := MonotonicClock() - start

    

if

 duration > profile.max_wall_seconds:

        Audit(

"sandbox_timeout"

, ...)

        

return

 SandboxTimeout

    size := EstimateBytes(output)

    

if

 size > profile.max_output_bytes:

        

return

 SandboxOutputTooLarge

    Audit(

"sandbox_granted"

, duration, size)

    

return

 Ok(output, duration, size)

编排层（
连载 08
）的 workflow 节点若内嵌工具调用，

仍应走同一 sandbox

，别因为「在 DAG 里」就特权 bypass。

几句容易踩坑的地方

handler 直接调 subprocess，从不经 sandbox.run

——审计与 capability 全失效。

默认 allow *`

——任何新工具自动获得全网权限。

只有超时没有输出上限

——一次工具返回 50MB JSON 拖垮下游。

deny 发生在 callable 之后

——恶意代码已经跑完。

ResourceManager reserve 不 release

——并发槽永久占满。

把沙箱当 DLP

——密钥扫描仍在 post_check；沙箱管「能不能执行、执行多久、读哪条路径」。

以为容器将来会上，接口随便写

——换 backend 时 call site 散落三处，永远换不成。

收束一下，下一篇讲什么

本篇应能列出 

至少三条执行期硬约束

（超时、路径、出站/capability），说清 

SafetySandbox 单点 run

 与 

ResourceManager 配额

 如何 complement 工具管线与预算账本。

下一篇进入 

多通道（Channels）

：Web、Email 等入口如何归一到同一 Turn / 控制平面语义。（连载 10）

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922925&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVPEJJt*u3yMMF6K*O-6ABFOdQgW18dA5d-AjcVT-XGTJtlSTvgGPcWxbVhHu7jlcaLZfc7upr*ruUrTztaaNp0r&new=1
