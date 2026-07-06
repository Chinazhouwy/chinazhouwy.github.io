---
title: "《从零实现 Agent 系统》连载 02｜领域模型与状态：先把「名词」对齐"
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
summary: "《从零实现 Agent 系统》连载 02｜领域模型与状态：先把「名词」对齐"
tags:
---

# 《从零实现 Agent 系统》连载 02｜领域模型与状态：先把「名词」对齐

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第2篇
> **核心主题**：领域模型/状态管理

---

上一篇《Agent 系统是什么：问题空间与架构切片》
画了分层盒子。本篇往下沉一层：

会话、轮次、消息、工具调用、制品、账本、租户与身份

——先得叫法统一，后面的控制循环才好讲。

名词对不齐，后面一定打架

三个人开会，一个人口中的「会话」其实指浏览器里的聊天窗口，另一个指的是数据库里一行 

session

，第三个说的是一次 HTTP 生命周期——若不事先对齐，编排和审计会对不上号。

领域模型层

要做的，就是把这类对象用稳定的名字和字段固定下来：谁在什么边界里活动、什么东西可以落库或出账，而

不把连接池、Redis 客户端、路由细节

塞进同一份定义里。

下面每一块只说「这个词在本系列里指什么」，实现上可参考开源项目 

Agentium

 的 

models

 包（里面是 Pydantic 一类的纯数据形状）；具体循环怎么转，连载下一篇再说。

会话（Session）：一条长期对话线

会话回答的问题是：

谁在跟谁聊，这条线在时间上延续

。它有稳定 id，下面挂着多轮交互；关掉浏览器不等于会话在服务端已经结束——是否归档、何时过期，属于策略与存储，但

会话 id

本身是贯穿审计与配额的关键外键。

在 Agentium 的常见用法里，

RequestContext

 上会带 

tenant_id

、

user_id

，有时还带 

chat_session_id

，表示当前这条请求落在哪条会话里。

租户与用户

先于会话存在：租户划资源与合规边界，用户是会话的主体；会话再把这些串成一条可用的「聊天线」。

轮次（Turn）：一次「用户有话要说」的处理单元

轮次通常是：

用户一条输入进来

（有时附带系统前置事件），系统在内部跑完这一轮推理与可选工具，再给出面向用户的收口。它比「HTTP 请求」粒度大——一次轮次内部可能触发多次模型调用和多次工具往返。

画图时：

会话 ⊃ 多个 Turn

。Turn 自己不负责连数据库，只管在这一格里记下：收到了什么、模型想了什么、工具试了啥、最终给用户回了啥——这些都是

可被序列化的事件或切片

，后面才能回放与评测。

消息（Message）：模型看得见的符号串

消息一般指

进模型上下文的一条条内容

：角色（人/助手/系统）、文本或多段附件引用。它属于 turn 内部的材料，不等同于完整的审计记录：审计里还要时间戳、租户、

run_id

 等工程字段。

原则是：

消息结构越稳定，网关与记忆层越好做截断与合并

；把业务 id、隐私标识混在 Markdown 里糊弄过去，后面做 DLP 和脱敏会哭。

工具调用（Tool call / invocation）：受控的「对外伸手」

一轮里模型可能提出「要调某个注册名 + 参数」。领域层应能表达：

工具名

、

这一次调用的唯一标识

、参数指纹或摘要、结果状态、耗时——用于观测与审计，而不是只留一段自然语言说「我调了啥」。

在 Agentium 里有类似 

ToolCallRecord

 的形状：谁被执行、是否成功、被拒绝还是失败、花了多少毫秒。

是否允许执行

则来自策略侧的决定（例如 

Decision

：放行、拒绝、要人批），决定本身也可以作为不可变记录进账本，而不是覆盖成一句「OK」。

制品（Artifact）：这一轮里产出的「可交付」

制品指

可引用、可存档、可传给下一步或给人的结果物

：生成文件、结构化报告、中间表、草图等。它往往比「助手自然语言一段」更硬，常带版本与来源。

制品和消息不同：消息偏

模型口型

，制品偏

系统手型

。谁创建、谁可读、是否进制品库、如何接工作流，通常在协调层有一条明确路径；领域模型侧只要

能描述「有这么个东西、属于哪次 run、什么类型」

就够了，具体存 OSS 还是磁盘由适配层接手。

预算账本（Budget ledger）：谁在花什么额度

企业里常见：每租户每日 token 上限、每分钟工具次数、外呼条数。账本记录

扣减、超限、软限制与硬阻断

的事实；数字从哪来可以是价格表或运营配置，但

「这一笔算在谁头上」

必须先有稳定主键：

tenant_id

、

run_id

、有时还有会话或用户。

领域层表达的是

账目行

与

余额视图

的语义，而不是直接 

SELECT ... FOR UPDATE

 的 SQL。

执行扣减

的动作放在协调或治理与存储适配之间，模型对象保持可测、可快照。

身份与租户：所有行的前缀

没有租户与身份，

会话、轮次、审计、预算

都会漂在真空中。至少要能回答：这是

哪个租户

的请求、

哪个用户

发起的、在策略里匹配

什么角色

。

在 Agentium 的请求上下文习惯里，这些是随请求传递的

只读小抄

：

tenant_id

、

user_id

、

role

，加上 

run_id

、

trace_id

 这类

一次执行

的关联符。

run_id

 常与一次「从进门到收口」的后端执行绑定，比「会话」更短、比「单次 HTTP」可能更长——画图时别和 

request_id

 混用，前者偏业务执行，后者偏接入记录。

运行快照（例如某次允许的模型路由、工具白名单、策略版本）若随请求携带摘要，往往以

摘要指纹

的形式回到上下文，仅供审计对齐，不在本篇展开实现。

为什么 

models

 里不写 I/O

一句话：

怕循环依赖和测不动

。领域对象若 

import

 了具体数据库客户端，编译图就糊了；单测也会被迫起真库。常见做法是：

models

 里只有

数据形状与校验

；读写交给 

infra

 与协调服务；HTTP 层只管 DTO 映射。

你在代码评审时可以用一个土办法：打开 

models

 下的文件，看 import 里有没有 

sqlite

、

httpx

、某 Web 框架——

原则上不该有

。

一张关系草图

实心箭头只表示

语义包含或归属

，不等于数据库外键一定长这样；但能帮你在会上把话说明白。

伪代码：纯结构，不讲存储

下面这段

不能运行

，只表达「对象怎么叠、方法保持纯」：

type

 RequestContext = immutable {

    request_id, run_id, tenant_id, user_id, trace_id,

    role, chat_session_id_optional, …

}

type

 TurnState = {

    session_id

    turn_index

    messages: List[MessageChunk]

    tool_traces: List[ToolCallRecord]

    artifact_refs: List[ArtifactRef]

}

function

 append_user_input(turn: TurnState, text: String) -> TurnState:

    

return

 copy(turn, messages = turn.messages + [UserMessage(text)])

function

 record_tool_outcome(turn: TurnState, rec: ToolCallRecord) -> TurnState:

    

return

 copy(turn, tool_traces = turn.tool_traces + [rec])

function

 charge_budget(tenant: TenantId, run: RunId, cost: CostUnit, ledger: BudgetPort) -> Result:

    

# 领域只描述「要记一笔」；真正写库在 BudgetPort 背后

    

return

 ledger.try_debit(tenant, run, cost)

BudgetPort

 这类名字代表

接口占位

：领域知道「能扣款」，不知道对方是 SQLite 还是别的。

几句容易踩坑的地方

把 

HTTP JSON

 当成领域真理，换一个通道就推倒重来。

会话 id 每请求新建

，审计永远对不齐。

Tool 的自然语言摘要

代替了结构化记录，事后无法算账。

租户缺省成全站共享

，一有数据就泄密。

在 

models

 里 new 数据库连接

——评审一票否决。

收束一下，下一篇讲什么

读到这里，你应能白板画出：

租户与用户如何钉在会话上，会话如何包含多轮，每轮里消息与工具与制品的位置，预算记在谁的头上

。下一篇开始进入

控制循环

：这些结构在运行时如何被一遍一遍推进。

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922925&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVOARLxSL3kY49YpTM*8UvIPcqMOEFu1fEdLfN5tj8HM7RQvo*f4OxwxvvQnUw9wqjoITMnc7IHW1VTDyipT5DLW&new=1
