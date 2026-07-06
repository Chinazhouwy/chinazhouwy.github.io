---
title: "《从零实现 Agent 系统》连载 22｜Tool Search 与按需加载：工具多了以后怎么办"
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
summary: "《从零实现 Agent 系统》连载 22｜Tool Search 与按需加载：工具多了以后怎么办"
tags:
---

# 《从零实现 Agent 系统》连载 22｜Tool Search 与按需加载：工具多了以后怎么办

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第22篇
> **核心主题**：Tool Search/按需加载

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目 Agentium，源码详见 GitHub

连载 21
 把 

ToolContract

 讲成「说明书要可教、可测」。说明书合格之后，还会撞上一道硬墙：

工具一多，每一轮 completion 前都要塞进去的 schema 会把上下文撑爆

——还没开始推理，token 已经花在「阅读电话簿」上。

常见应对有两条：

defer_loading

（先只暴露一小撮 + 一个「搜工具」元工具，按需再展开）和 

programmatic tool calling

（Agent运行时按显式步骤链式 execute，少烧 LLM 往返）。Agentium 两条都有 MVP：

阈值触发的 tool_search + Top-K

，以及 

programmatic batch

（HTTP 与 Chat 内 meta 工具）。本篇讲清它们怎么挂在
连载 03
 的 tool loop 上，以及和
连载 20
 code-exec 的边界。

问题长什么样

假设 Chat 里 eligible 的低风险工具有四十个，每个带 description + JSON schema，一轮就可能上万 token。模型还容易 

在相似工具之间点错

（
连载 21
 的重叠审计能减这类问题，但不能减体积）。

目标不是「少注册工具」，而是 

少暴露、晚暴露、暴露得准

：

默认只给模型 

Top-K

 个 schema（K 可配，常见个位数）；

另给一个 

tool_search

 元工具

，用自然语言 query 在 catalog 里捞名字；

搜完 

下一轮

 再按命中结果刷新暴露子集，而不是一次把全集塞进 prompt。

若 catalog 本身不大，或阈值设为 0，则 

退回全量暴露

——简单场景不付复杂度税。

defer 模式：阈值、元工具、刷新

逻辑挂在 

组 OpenAI tools 载荷

 的那一步（Chat tool loop 每轮 completion 前都会重建）：

统计 

chat-eligible

 工具数（低风险、非 blocklist，且 

不含

tool_search

 自身）。

若数量 

不超过阈值

（环境可配，默认大约二十多），行为与以前一样：全量 schema 进模型。

若 

超过阈值

 且 Registry 里已注册 

tool_search

 元工具

：本轮只暴露 

tool_search

 + Top-K

 个工具的 schema。首轮 Top-K 取 catalog 名字的 

稳定排序切片

（结果可复现，方便测）；之后若模型调过 

tool_search

 且返回 hits，则用 

命中名列表

 刷新子集（仍 cap 在 K），打日志 

chat_tool_search_refresh

。

若超阈值却 

没有

tool_search

：打警告并 

回退全量

——避免「想 defer 却没入口」的半吊子状态。

每个工具的 description 还有 

字符上限

（防止单个 schema 巨型描述拖死上下文）。defer 激活时会有 

chat_tool_defer_active

 一类日志，便于对账「这轮到底暴露了几个」。

tool_search

 在 loop 里怎么动

tool_search

 是 

meta 工具

：不替你做业务，只返回 

候选工具名 + 分数 + 短 snippet

。模型应先搜再点具体工具——产品上要接受 

多一轮往返

 换 

更小的常驻 schema

。

loop 里还有配套细节：工具结果 JSON 会 

截断

 再包一层「不可信外源」标记进对话，避免一次 tool 输出撑爆窗口；评测场景下 allowlist 会 

自动带上 tool_search

，否则 defer 模式下模型没有搜索入口。

运维旋钮（名称以部署为准）：

阈值

：超过多少工具才 defer；设为 0 即关闭。

Top-K

：defer 时最多同时暴露几个业务工具 schema。

单工具描述字符上限

：与 defer 正交，但常一起调。

契约 examples 进 prompt（可选）

连载 21
 要求每个工具至少一个 

contract.examples

。除了进 catalog 校验，还可开 **

AGENTIUM_CHAT_TOOL_EXAMPLES_IN_PROMPT

**：把 

当前暴露

 的工具各抽一例，压成 

有字符预算

 的 few-shot 块拼进 prompt——让模型看见「长什么样的一行调用」，又不把 examples 无限复制。

这是 

在 defer 之后

 的增密手段：暴露面小了，examples 才塞得进预算。默认关，避免 prompt 再胀一截。

Programmatic batch：宿主链式调，不是模型写 Python

Anthropic 所说的 

programmatic tool calling

，在 Agentium 里对应 

显式 JSON batch

：每一步是 

{ name, args }

，按顺序走 

Registry.execute

——策略、预算、审批、审计 

逐步生效

，不是「模型自由写脚本」。

HTTP

：

POST /v1/tools/programmatic-batch

 供集成方在 loop 外批跑。

Chat meta 工具

programmatic_tool_batch

：loop 内也可提交 batch，通过 contextvar 绑回当前 RequestContext。

安全默认：

allowlist

 默认是 

chat-eligible 低风险工具

，且 

剔除

tool_search

、

programmatic_tool_batch

、

code_run_python

 等，防 

自递归

（batch 里再调 batch）。

步数上限

（环境可配，默认十几步）；

fail_fast

 时一步失败后面标 skipped。

与
连载 20
 

code-exec-mcp

 不同：那边是 

模型产出 Python

，在 sidecar 里跑，再通过 token 桥回调工具；programmatic batch 是 

宿主/编排器写死的步骤表

，审计上更清晰。

适合「检索 → 过滤 → 再读详情」这类 

确定性流水线

，由应用侧组装 batch，而不是让模型每步都重新 completion。

和相邻连载怎么拼

03
 / 
18

：tool loop 与 DSML 不变；变的是 

每轮 

tools=

 数组怎么裁剪

。

21

：defer 不替代 ACI；描述太差，搜出来也会点错。

20

：code-exec 解决「用代码调 MCP」；本篇解决「工具太多塞不进 prompt」和「宿主批跑」。

24

：defer 日志 + ACI eval 通过率，可一起做发布门证据。

几句容易踩坑的地方

阈值开了却没注册 tool_search

——静默回退全量，以为自己在 defer。

K 设太大

——defer 省不下 token。

搜完不刷新暴露集

——每轮仍用首轮字母序切片，搜索白调。

把关键词搜索当语义搜索

——英文 query 搜中文描述命中率差，要改描述或上向量（若以后有）。

examples 进 prompt 不设预算

——省下的 schema 又被 examples 吃回去。

programmatic batch 放写操作且不标幂等

——fail_fast 中途失败，前面步骤已生效。

batch 里塞 meta 工具

——被 allowlist 拒或递归风险。

混淆 programmatic 与 code-exec

——前者是宿主步骤表，后者是模型写代码。

工具结果不截断

——一次大 JSON 顶满 context。

defer 后不做 ACI eval

——暴露子集变了，通过率会变，发布前要重跑。

收束一下，下一篇讲什么

工具多了以后，别硬扛全量 schema：

超阈值就 tool_search + Top-K

，搜完下一轮刷新暴露面；需要确定性多步时，用 

programmatic batch

 走 execute 管线，别和 code-exec 混。契约合格（
连载 21
）之后，再用可选 

examples 块

 给当前暴露面加一点「示范密度」，并记得调阈值、K 和描述字符上限。

下一篇进入 

Skill 体系与 Skill Creator

：SKILL.md 怎么打包能力、怎么和 memory_profile / 路由联动，以及 creator 评测环怎么迭代技能包。（连载 23）

你们工具超过多少个开始 defer？Top-K 和阈值怎么定的？欢迎评论区聊聊。

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922925&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVNQ4nAw-Ny9F457iqNQGScsxgoVYtQJIyjP9vuBo8iDd50KdWXnfdJRfO18VGtgZTiO87KLWP0PTligMN9uq6Lh&new=1
