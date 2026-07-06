---
title: "《从零实现 Agent 系统》连载 03｜控制循环：感知—决策—行动—反思"
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
summary: "《从零实现 Agent 系统》连载 03｜控制循环：感知—决策—行动—反思"
tags:
---

# 《从零实现 Agent 系统》连载 03｜控制循环：感知—决策—行动—反思

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第3篇
> **核心主题**：感知-决策-行动-反思循环

---

前两篇
《Agent 系统是什么：问题空间与架构切片》
和
《领域模型与状态：先把「名词」对齐》
画了分层盒子、对齐了会话和轮次里该出现的东西。

本篇接上：在一轮之内，运行时如何一圈一圈转起来

——模型的多步工具循环、在哪儿停，以及打点该挂在哪儿。

一句话：这轮里系统在干什么

外行看聊天，内行看「

在同一条会话状态上，谁先谁后地走完了哪些步

」。一次用户发来的 

Turn

（我们在连载 02 里说过的粒度）内里，往往不是「打一枪模型就收工」，而可能是：

读当前上下文 → 模型出一招（可能要工具）→ 真去执行工具并把结果喂回去 → 再读、再出一招

，直到模型决定收笔，或者被规则掐停。

老式教科书爱用 

感知—决策—行动—反思

：

感知

：此刻模型和策略能「看见」什么（消息序列、上一轮工具产出、租户身份等）；

决策

：模型（再叠策略门禁）吐出「下一步说什么、要不要调哪个工具」；

行动

：网关与注册表真正把工具跑了；

反思

在这里不必玄乎，落地成：

把行动的观测写回上下文

，下一轮感知才能接续

同一事实

。名字古典，本质是

闭环

。

同步「轮」与内部的「tool 小节拍」

要分清两样东西：

外层

：用户这一轮 Turn，在服务端可能是一个同步 handler 或服务过程里走完（对调用方看起来像一次请求在等待）；

内层

：为了完成这一次 Turn，

while

/

for

 出来的

多圈 LLM ↔ 工具

往返，行业里常叫 

tool loop

。

内层每一圈粗略是：

把当前 

work

 消息列表送进网关，附上当圈允许暴露给模型的工具 Schema；

模型回合结束：若没有工具调用，就带着最终 Assistant 话术

收口

，外层 Turn 完结；

若有工具调用：对每个调用走一遍

批准与策略闸门

（可挡、可待人审），再通过控制面跑一次「执行 turn」，把结构化结果包成 

role: tool

 的消息

追加进 

work

；

回到步骤 1

。

外层同步与否，不改变这个内层节拍；异步调度是后话，这里只管「

这一轮里语义怎么闭合

」。

与 LLM 的多轮交接：靠什么「对话态」连在一起

模型的 API 吃的是

消息链表

一类的结构：system、user、assistant、夹杂 tool 角色的返回。Tool loop 

不是

在服务外另开若干个无状态 HTTP；而是在

同一个 

work

 副本上反复 append

。谁负责维护这条链、谁负责截断与摘要，便是记忆层和网关要守的界线——本篇只假定「链在，且每一步追加是 deterministic 的」。

实战中还要注意：

finish_reason

 一类信号（停词、超长、提供商自定义）会与「有没有 tool_calls」一起决定走不走下一圈——具体字段依厂商而异，思想上都是「这轮模型声明自己停在哪」。

停下来：四类常见出口

不写代码也能先立规矩，

轮到什么时候必须停

：

自然停

：本轮模型产出里

不再有工具调用

，Assistant 的最终文本已经可以返回给用户。

步数熔断

：工具圈数设有

上限

（例如配置里的「最大工具轮数」）；超出则宁可返回可读错误话术，也别无限转悠——防止费用与时间上不封顶，也方便测试预期。Agentium 的聊天 agent 在这条路上走到头时，会向用户退回一句交代「已到工具轮上限」类信息，并把内部原因记成 

length

/上限

语义，留给日志与告警。

人等门

：中途某工具被要求 

pending 审批

，循环主动抛错或挂起，把控制权交给工单或另一条接口——这一轮不算悄悄成功。

故障与网关错误

：提供商异常、超时、解析失败——应进入你们统一的错误通路，别把半条消息链默默丢了。

四类里，前两样是产品设计必谈；后两样是企业里区分「不可用」与「尚未批准」的分水岭。

观测打在哪儿：tracing / log 的落脚点

每一段值得单独计账：

每一圈网关调用

：一次 

span

（或等价物），挂上 

tenant_id

、

run_id

/

session_id

、本轮索引。

每一次工具派发

：再起子 span：工具名、参数摘要、成功与否、毫秒耗时——与连载 02 提到的

工具调用记录

字段应能对上账。

策略门禁结果

：放行、拒绝、待人批，各占一条结构化日志，出事要能按 

trace_id

 串起来。

原则：

打点跟着「感知—行动」边界走

，比在业务代码里零散 

printf

 可维护得多。

一张循环示意

虚线熔断表示：

每一圈都可能被配置或全局守卫掐断

，图里不单画分叉，脑子里要有这根弦。

伪代码：最小 tool loop（带步帽）

照旧

跑不起来

，只表达结构；

MAX_STEPS

 即工程里的「最多工具轮」配置。

function

 RunTurnToolLoop(initial_messages, deps) -> AssistantOutcome:

    work := copy(initial_messages)

    steps_used := 0

    

while

 steps_used < MAX_STEPS:

        round := deps.llm.complete_one_round(work, tools=deps.tool_schemas_this_round(work))

        

if

 round.has_final_text_without_tools():

            

return

 ok(round.assistant_text, finish_reason=round.finish_reason)

        

if

 round.tool_calls empty:

            

return

 ok(round.assistant_text, finish_reason=round.finish_reason_or_stop)

        work.append(round.assistant_message_with_tool_calls())

        

for

 each call 

in

 round.tool_calls:

            

if

 deps.policy.blocks(call):          

# 含待人工审批的路径

                

return

 blocked_or_raise(call.reason)

            result := deps.execute_tool_via_control_plane(call)

            work.append(tool_message(result))

            deps.observe_tool_span(call, result) 

# tracing / latency / status

        steps_used += 1

        

# 「反思」已通过 work 重写完成；下一轮感知自动看见新工具消息

    

return

 cut_off(

"已达到工具循环步数上限"

, trace=deps.collected_trace)

deps

 在真项目里是一大捆对象（网关客户端、注册表、控制面、

RequestContext

 工厂……），拆不拆是工程细节；

环形结构不变

。

容易被低估的三件事

把「能用」当成「不会在第十二圈才爆」

：没有步帽和费用意识，_demo 跑得越顺，投产越心惊。

tool 结果被人类悄悄改了再喂模型

：少了结构化边界，回放对不上。

取消信号

如果只挂在 HTTP，内层长跑次工具卡住时，

run_id

 级的中断无从谈起（下一篇会与生命周期补缝）。

观测只做「最后一跳」

：中间圈的延迟与失败全黑箱，出事只能猜。

收束一下，下一篇讲什么

现在你应能说清：

外层 Turn

 包住 

内层 tool loop

；每一圈「模型—工具—写回」怎么闭；在哪儿

自然停

、在哪儿

熔断

、在哪儿

把人接进回路

。下一篇轮到 

调度与租约

——如何把「跑得动」升级到「可多任务、可被抢占、可被治理地跑」（仍尽量保持同步心智，异步平面再往后放）。

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922925&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVMSaHKwa0PbDHEeZfNDJVKsNE6hfwC3Jm33Pq5T1uqEgPAEBNSS1yhsxLkrHn7lpciy5Ka7hvCuY4OGtJWApH-s&new=1
