---
title: "《从零实现 Agent 系统》连载 05｜工具系统：契约、注册与安全默认"
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
summary: "《从零实现 Agent 系统》连载 05｜工具系统：契约、注册与安全默认"
tags:
---

# 《从零实现 Agent 系统》连载 05｜工具系统：契约、注册与安全默认

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第5篇
> **核心主题**：工具系统/契约/安全

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目Agentium，源码详见GitHub。

连载 03《控制循环：感知—决策—行动—反思》
 里，模型在 loop 中反复「点名要工具」；
连载 04 《调度、租赁与并发：把「跑起来」变成「可治理地跑」》
里，多任务争槽位。

本篇落在中间那块硬骨头

：工具不是随便挂个 Python 函数——要有

契约、注册表、校验与默认安全

，还要把「模型能看见什么」和「运行时真执行什么」对齐。

工具在系统里占哪一格

对模型来说，工具是一组

带名字、带说明、带参数形状

的可调用能力；对运行时来说，工具是

在策略与预算闸门之后才真正跑起来的 handler

。

中间必须有一层 

Registry（注册表）

：登记谁存在、风险级别从哪来、执行时走哪条管线。没有它，就会出现 demo 里常见的反模式：

prompt 里手写工具列表

，执行路径却在另一个文件里偷偷 

if name == "xxx"

——换通道、做审计、做 manifest 白名单时全崩。

契约（Contract）：给模型和给审计的同一本说明书

一份像样的工具契约，至少说清楚：

名字与版本

：稳定、可引用；

描述

：给模型读的自然语言（也有最小长度等质量门槛，避免空壳工具混进 catalog）；

input_schema / output_schema

：参数与返回的结构（常见是 JSON Schema 片段）；

failure_semantics

：失败能不能重试、是否幂等、要不要补偿；

examples

：至少一个正例，方便人和评测对齐「正常长什么样」。

契约解决两件事：

模型侧

——描述和 schema 会被转成厂商 API 需要的 

tools

 载荷（连载 03 里每一圈 completion 前组装的那个列表）；

运行侧

——注册时可校验「没说明书的不许上架」，执行后可对照 output 形状做基本 sanity check。

参数校验

应在执行前做：模型吐出来的 JSON 再花哨，进 handler 之前也要过 schema；非法参数直接结构化拒绝，别带着脏数据进沙箱。

注册：register 不是 dict.setdefault

注册时典型要带上：

ToolSpec

：名字、能力标签、

风险级别

（如 low / high）、实际 handler、来源标签（内置 / MCP / 插件…）；

可选或强制的 ToolContract

：与 spec 同名，描述与 schema 对齐。

规则宜写死几条：

重名冲突即失败

；开启「必须有契约」模式时，缺描述、缺示例的不能进表；Chat 场景还可维护

块名单

——某些名字即使用户侧看不见，也不进 LLM 驱动的自动 loop（例如过重、需专用入口的技能类工具）。

内置工具

在启动装配时批量 register（按环境 profile 决定开多少：生产少而稳，开发可扩 catalog）；

动态注册

来自 MCP 加载、插件 merge——原则相同：先进表、再走同一套 execute 管线，别另开后门。

Agentium 里内置 demo 工具、技能相关工具、审查类工具（如代码/文本 review）都走同一注册表；差别在 handler 里干什么，不在「有没有过闸门」。

执行：invoke / execute 里该串什么

模型点名之后，真正执行不应是 

handler(args)

 一行了事。一条可治理的管线大致是：

上下文

：

RequestContext

 带上 tenant、run、trace、角色、可选 manifest 工具白名单；

门禁

：策略决策（allow / deny / require approval）、访问控制、运行快照里声明的工具是否在允许列表；

预算

：预估 token/费用，超限则拒；

安全预检

：参数与上下文的注入/滥用探测（视配置启用）；

handler

：在超时层与取消 token 协作下跑业务逻辑；

输出后检

：DLP、密钥泄漏、社工话术等（视配置）；

审计与 telemetry

：写 

ToolCallRecord

、append audit event、打 span。

超时

应挂在工具这一层（连载 04 的分层超时之一），并与 

CancelToken

 配合：长 I/O 要可打断。

幂等

：契约里声明 

idempotent

 与 

idempotency_key_args

；重试逻辑据此决定能否安全再调，而不是盲目重放写操作。

审批挂起时，execute 返回 pending，由连载 03 的 loop 抛给上层；批准后走 

execute_after_approval

 一类续跑路径——本篇不展开工单 UI，只记住：

工具层要支持「半次执行」状态

。

技能（Skill）和工具：别混成一个词

工具

是注册表里一行：

固定名字 + schema + handler

，模型通过 function calling 直接点名。

技能（Skill）

更像

打包的知识与脚本目录

（如 SKILL.md、可选 allowlist 脚本）：往往通过「加载说明」「按查询匹配技能」「再暴露少量 skill_* 工具」进入系统，policy 里还可能有单独的 

decide_skill_use

 维度。

实用边界：

日常 Chat loop 暴露 low-risk、契约齐全的工具子集

；

重技能、脚本执行、导出类能力

宜 blocklist 或走高风险通道与审批。别把整本技能库每次塞进 context——那是记忆与路由层的事，不是把 registry 当文件夹乱堆。

模型上下文里「工具描述」从哪来

流程可以压成四步（与连载 03 内层 loop 衔接）：

从 Registry 

列出

当前允许暴露的 spec + contract；

过滤

：风险级别、blocklist、defer/搜索策略（工具太多时先暴露 meta 搜索工具，再缩小子集——属产品优化，思想是

别一次性把上百个 schema 塞满 context

）；

转换

为厂商格式（OpenAI 风格 

type: function

 + 

parameters

 等），描述字段来自 contract.description，必要时截断并打日志；

随 

messages

 一起送给网关；模型返回的 

tool_calls

 再反查 registry 执行。

所以：

改 prompt 不如改 contract

；模型「能看见什么」应是 registry 的投影，不是文案里的悄悄话。

一张白板图：从注册到执行

伪代码：Registry 接口（结构用）

type

 ToolSpec = { name, risk_level, handler, capabilities, origin }

type

 ToolContract = { name, description, input_schema, output_schema, failure_semantics, examples }

function

 Register(registry, spec, contract):

    assert contract.name == spec.name

    validate_schema_and_examples(contract)

    

if

 registry.has(spec.name):

        raise Conflict

    registry.store(spec, contract)

function

 Execute(registry, ctx, name, args, deps) -> Result:

    deps.audit.on_start(ctx, name)

    deps.telemetry.span(

"tool.execute"

, name)

    

if

 not registry.resolve(name):

        

return

 deny(

"not_registered"

)

    

if

 not deps.policy.allow(ctx, name, args):

        

return

 deny_or_pending_approval(...)

    

if

 not deps.budget.try_reserve(ctx, name):

        

return

 deny(

"budget"

)

    validated := validate_args(registry.contract(name), args)

    deps.security.pre_check(ctx, name, validated)

    with timeout(deps.layers.tool_seconds), cancel_check(deps.token):

        out := registry.handler(name)(validated)

    deps.security.post_check(out)

    record := deps.audit.on_complete(ctx, name, out)

    

return

 ok(out, record)

deps

 聚合策略、预算、审计、telemetry、安全探测器——与「胖 handler」相比，

瘦 handler、胖管线

更好测。

几句容易踩坑的地方

只有 handler 没有 contract

——模型侧描述和运行侧行为漂移，评测无法复现。

校验只做在 prompt 里

——模型胡说参数照样进生产。

高风险工具与 low-risk 混在同一 Chat 暴露列表

——一次误点就出事。

Skill 目录当普通工具全量暴露

——context 爆、policy 也护不住。

execute 不写审计

——出事只能猜「好像调过啥」。

收束一下，下一篇讲什么

本篇应能回答：

ToolRegistry 登记什么、execute 管线串什么、描述如何进模型 context

；Skill 与 Tool 的边界至少能说清一句。

下一篇进入 

AI 网关

：多模型路由、限速、内容与成本——在工具之前，先管住「算」从哪来、花多少。（连载 06）

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922925&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVNkDw09NOyR35I-NAz-i83CEsz*iMaHdRrFZQXy3gAzWJ8f8KU4H4euKsUb2Fp1HT5w7MSScOY1cTmzU5Ub2ic7&new=1
