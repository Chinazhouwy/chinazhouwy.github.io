# 《从零实现 Agent 系统》连载 17｜记忆再往下挖：压缩分档、九档归属与 Skill 策略

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第17篇
> **核心主题**：记忆压缩/九档归属/Skill策略

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目 Agentium，源码详见 GitHub。

连载 07 讲清了「消息表管原话、Memory Service 管结构化片段」、三层 SHORT/MID/LONG、泳道与 context budget。

本篇不再重复那套入门口径

，而是往下挖四件事：

短期到底有几件事

——分清 

SHORT 记忆层（clip 无 LLM）/ 短期对话压缩（红区会调 LLM、结果进消息流）/ 异步 episode 摘要

，以及默认每 Turn 的 LLM 成本（压缩机制本身见 07）；

中期记忆归谁

——九档 scope 各自存什么、什么时候写、什么时候读；含 

查数/BI 专档 S9 与 MID 边界

；

长期记忆从哪来

——Persona 维度块与 LLM 抽取的用户事实如何并存、如何晋升；

Skill 怎么定制策略

——同一套 Chat 管线，不同业务 Skill 能否用不同的压缩窗口、召回范围、检索方式。

读前建议先回顾 07；本篇例子偏多，适合已经搭过一轮记忆读写、想定策略的人。

07 与 17 的分工

07 侧重

17 侧重

双轨、Memory Service 薄门面、租户隔离

SHORT / 压缩 / 异步摘要谁用 LLM

、每轮 LLM 成本

SHORT/MID/LONG 表格式介绍

九档 scope

 各写什么、查数专档 S9

泳道、privacy、context budget 三档

Persona 维度块

 与 LONG 抽取、晋升策略

污染与 backend 可插拔

Skill memory_profile

 何时定制、怎么合并

当轮 prompt 压缩裁剪机制

recency / vector

 两种检索及 SQLite、PG 选型

一句话：

07 讲「上下文怎么裁、边界在哪」；17 讲「同一轮 Turn 里，存什么、取什么、检索怎么排」

。

短期：SHORT 记忆层、短期压缩与异步写回（先分清谁用 LLM）

「短期」其实塞了 

三件容易混为一谈

 的事，它们「用不用 LLM、压完放哪」完全不同，先拆开：

名词

干什么

用 LLM？

结果放哪

SHORT 记忆层

Turn 后把本轮原文 

clip 一条

（默认约 512 字符）写库，给后台 consolidator

否

，纯字符串

memory 库；

不进 prompt、不参与 recall

短期对话压缩

历史消息超出 context window 时，把较旧一段折叠成一条 

compacted

 块

滚动折叠

否

；

红区（token 顶满）同步调一次 LLM

，失败回退规则摘要

消息流（dialogue）

，

不是 system prompt

异步 episode 摘要

Turn 后 deferred worker 把会话增量合并成 running summary

是

（deferred LLM）

落 MID；下一轮经 

recall

 注入 system prompt

归纳一下谁用 LLM：

SHORT 记忆层不用

（纯 clip），

短期对话压缩在红区会调一次 LLM

，

异步 episode 摘要也会调

。另外这三件事还分属「

压 prompt

」和「

写 memory

」两条时间线——同步压缩决定 Turn N 模型看见什么，异步写回决定 Turn N+1 能 recall 什么。

“

关键澄清：

短期对话压缩压出来的 

compacted

 块是插进消息流（dialogue）的

（实现里 

out = [系统块, compacted, ...尾部]

），

不是放 system prompt

；system prompt 只放 Persona / Skill / recall 块。当轮 prompt 的折叠/分档/budget 机制连载 07 已讲，本篇不展开。

SHORT 记忆层细节（是 clip，不是摘要）

很多读者会把 

SHORT 层

 当成「每轮用 LLM 做的短期摘要」——

在 Agentium 里不是

，它就是一条原文预览：

维度

SHORT 层实际行为

写什么

本轮 user/assistant 

原文截断

（默认约 512 字符），不是语义摘要

何时写

Turn 结束后 

同步

写库，毫秒级

是否调 LLM

否

谁在读

后台 

Consolidator

 做晋升/整理；

不注入

 recall prompt

和 episode summary 的关系

SHORT 是「原话预览条」；episode running summary 才是 

LLM 语义合并

，走 deferred

Skill 可通过 

memory_profile.layers.short.enabled=false

关掉 SHORT 写入

；关掉后不影响当轮 prompt，只少一条给 consolidator 的预览。

recall 用的是 MID/LONG

（session / episode / user / project …），不是 SHORT。若你关心「下轮还能不能想起某个结论」，应看 

episode summary + 相关 scope 的 fact/ref

，而不是 SHORT。

异步写回：Turn 结束后才决定「下轮记得什么」

真正影响 

Turn N+1 recall

 的写入，绝大多数走 

异步 deferred 队列

，不拖慢本轮流式收尾：

动作

同步 / 异步

是否 LLM

影响哪一轮

episode 

running summary

 增量合并

异步

（deferred）

是

N+1

 起 recall 的 

session

 别名

MID 

事实抽取

（mid_semantic）

异步

（deferred）

是

N+1

 起各 scope 的 fact

LONG 

用户偏好晋升

（consolidator）

后台周期任务

可选 LLM

跨会话、非每 Turn

SHORT 摘录

同步

写库

否

不参与

 recall

running summary

 用固定章节（Goal、Progress、Key Decisions……）做 

增量合并

，是 

持久化的 episode 语义

（供 HTTP 查询与 recall）。写完后 SSE 先发 

memory.updated(deferred)

，落库再补 finalized，前端可二次拉取。

默认每 Turn 会调几次 LLM？

下列为 

默认 Skill / 配置

 下的典型成本（可通过 env、Skill 

memory_profile

 关闭或降级）：

步骤

每 Turn 都跑？

是否 LLM

说明

主对话 completion

是

是

用户可见回复

SHORT 摘录

默认是（可关）

否

字符串 clip

短期对话压缩（折叠超窗历史）

仅超 context window 时

滚动折叠

否

；

红区可能调 1 次

失败回退规则摘要，结果进消息流

MID 事实抽取

默认开

是

（deferred）

不阻塞流式收尾

episode running summary

默认开

是

（deferred）

影响下轮 recall

向量 recall

vector

 模式且开启 recall

Embedding API

非 chat completion

粗算

：在 mid_semantic + session_summary 都开的情况下，用户体感通常是 

1 次主流式 LLM + 最多 2 次 deferred LLM

；只有当历史顶满 

红区

 时，才

额外多 1 次同步 LLM

 折叠历史（失败还回退规则摘要）。

不是

「SHORT + 折叠 + 抽取每轮各算一次同步 LLM」。

中期：九档归属边界与策略

仅有 SHORT/MID/LONG 不够。同一句「项目代号 Phoenix」，可以记在 

这次聊天

、

这次研究任务

 或 

整个工作区

——查询、purge、审计粒度完全不同。Agentium 用 

scope

 描述「这条记给谁」；与 

layer

 正交组合。

下面九档按 

中期（MID）为主

 说明典型内容与策略；部分档也会挂 SHORT（摘录）或 LONG（见下一节）。

先记一张速查表

——九档里只有 

6 个能被 recall 别名拉回 prompt

，另外几个是「写给编排/审计/引用」的，不进 recall：

scope

recall 别名

谁来读

S1 session / S3 episode

session

（含 episode）、

episode

recall 注入 + 工作台默认

S2 task

task

编排 / Deep Research recall

S4 project（subject=project）

project

recall（会话/工作区状态）

S4 user（subject=user，LONG）

user

（可配 

persona_dimensions

）

recall（跨会话偏好）

S9 data

data

（

opt-in

，

session

 不自动并入）

查数 Skill 显式 recall

S5 fork / S6 shared / S7 checkpoint / S8 artifact

无 recall 别名

编排恢复 / 审计 / 按 

artifact_id

 引用

1. 当前会话（session）

记什么

：本会话里确认的事实、约束、进度片段——「用户说预算上限 50 万」「当前卡在第三步审批」。

层

：MID 为主（

fact

）；SHORT 有每轮预览。

写

：Turn 结束后 LLM 抽取，scope 判为 session 则写 MID；去重按规范化文本。

读

：recall 别名 

session

 会同时拉 

会话 + episode 窗口

（见下），工作台默认也查这一档。

例子

：普通 Chat 里用户临时改的交付日期——只对本会话有效，不应进用户级 LONG。

2. 单次任务 / Run（task）

记什么

：一次研究 job、一次 workflow run 的结论摘要——「任务 
#job
-42 已完成，报告要点……」。

层

：MID。

写

：研究管线结束、工作流节点完成后 

best-effort

 写入；绑定 

run_id

。

读

：recall 别名 

task

；多 Agent 编排、Deep Research 场景常用。

例子

：用户发起「帮我写竞品分析报告」，job 跑完把 

completion 摘要

 记在 task scope，下次同会话 recall 时可带上，而不必重跑 pipeline。

3. 滚动 Episode 窗口（episode）

记什么

：

整场对话的 running summary

——不是单句 fact，而是带章节的 Markdown（Goal、Constraints、Progress、Key Decisions、Next Steps……）。

层

：MID；canonical key 

upsert

（每轮增量合并，不堆历史版本）。

写

：异步 deferred，Turn 结束后 LLM 合并「上一份摘要 + 本轮对话」。

读

：recall 别名 

episode

 或 

session

（后者包含 episode）。

例子

：长会话里用户隔几小时回来，模型靠 episode summary 恢复「我们上次定下的方案和待办」，而不必从第 1 轮原话重读。

4. 项目 / 工作区（project，subject=project）

记什么

：

天到周级

 的工作区状态——会话标题、挂载 Skill、编排模式、是否挂了 workspace agent 等；

不是

永久用户画像。

层

：MID（同一 enum 档与 user 共用，靠 

subject_kind=project

 区分）。

写

：会话 metadata 变更时 best-effort 更新。

读

：recall 别名 

project

。

例子

：用户把会话从「闲聊」切成「深度研究」并换了 Skill 组合——project state 记下当前配置，新 Turn 的 effective profile 与之一致。

5. Agent 分支 Fork（fork）

记什么

：多 Agent 分叉时 

子 run 的状态

——父节点、深度、子任务 query 等。

层

：MID。

写

：spawn 子 worker 时写入。

读

：编排 / 研究 harness 恢复分支上下文时用。

例子

：Lead Agent 拆出三个子课题并行搜资料，每个 fork 一条 state，合并报告时能追溯「这个结论来自哪个分支」。

6. 共享协作空间（shared workspace）

记什么

：多 Agent 

黑板

：谁占了哪个 slot、worker 交回来的 handoff manifest。

层

：MID；带 

lease

 语义——先 claim 再 post，避免两个 worker 写同一 slot。

写

：研究 harness 里 spawn / worker 回调时 claim、post。

读

：Lead 汇总前 read 全 workspace。

例子

：Lead 占 slot 

topic-A

，Worker 搜完 post 

{status, source_count, summary}

，Lead 读黑板拼报告，而不是靠临时消息数组传话。

7. Checkpoint 快照（checkpoint）

记什么

：用户或系统打的 

会话 checkpoint

 的 payload 镜像——可恢复点的 label、seq、快照体。

层

：MID（

state

 / snapshot 形）。

写

：创建 checkpoint API 成功后 best-effort 写入。

读

：恢复会话、审计「当时记到了哪」。

例子

：长任务做到一半用户手动存盘；恢复时除了消息表，memory 里还有 S7 的结构化快照可对账。

8. 制品 / 检索缓存（artifact）

记什么

：大段 tool 输出、workflow 

制品 id 与摘要

，不内嵌全文。

层

：MID；note 类型 

ref

。

写

：artifact store put 成功后写入引用。

读

：编排 replay 或后续按 

artifact_id

 拉制品本体。注意 

没有 

artifact

 recall 别名

——它不会被 recall 自动注入 prompt；要在 prompt 里带上「制品摘要」，通常是由 S1/S9 的 fact/note 引用其 

artifact_id

。

例子

：代码分析 tool 吐出 2 万字报告——memory 只存「artifact_id=xxx，摘要：发现 3 处 SQL 注入风险」；下轮 prompt 想带这条摘要，靠 session fact 或 S9 引用该 id，而不是直接 recall artifact 档。

9. 数据上下文（data，查数/BI 专档）

记什么

：查数/BI/SQL 场景的 

结构化查询元数据

——

{query_kind, sql, tables, row_count, filters, summary, artifact_id}

。

不是

 原始结果正文，是「这一刀查了什么、查了多少、结论一句」的指针。

层

：MID；note 类型 

data

。

同步写、无 LLM

。

写

：Turn 结束后从本轮 

tool_trace

启发式捕获

（tool 名含 

sql

/

query

/

db_

/

bi_

，或返回含 

sql

 + 

row_count

/

tables

），

latest

 key upsert（最近一次查数）+ 

{call_id}

 历史条目。默认 

关

，需 Skill 在 profile 里开 

data_context

 这一档（避免普通 Chat 被查数噪声污染）。

读

：recall 别名 

data

——

opt-in

，

session

 别名 

不

 自动并入；查数 Agent 在 Skill 的 

recall.scopes

 里显式加 

data

 才会回灌。

与 S8 的区别

：S8 

ref

 指向 

大制品本体

（2 万字报告、CSV 文件）；S9 

data

 记 

查询动作的结构化轮廓

（跑了哪条 SQL、命中几张表、多少行、一句 aggregate）。两者可互相引用——S9 的 

artifact_id

 可指向 S8 的明细。

例子

：查数 Agent 跑「上季度华东区 GMV」→ 8000 行结果落 S8 artifact；S9 同步记下 

{sql: "SELECT region, SUM(gmv)...", tables: [t_orders], row_count: 8000, summary: "GMV 同比 +12%", artifact_id: ...}

。下一轮用户问「按城市 breakdown」，模型 recall 到 S9 就知道「上次查的是华东区 GMV、口径是这条 SQL」，可在此基础上改写查询，而不必从头猜。

查数 / BI 场景：S9 落地后的边界

有了 S9，查数上下文不再「无处安放」，但仍要分清各档职责，别指望一档存下所有东西：

数据形态

主要落在哪

recall 能否用到

完整 tool 返回（可能上万行）

消息表

当轮流水；超长被 

tool 结果截断

；建议落 

S8 artifact

当轮可见；旧轮可能被同步压缩折叠

查询轮廓（SQL/表/行数/结论）

S9 data

（同步、无 LLM、opt-in recall）

下轮 recall 

data

 别名可用

「用户预算 50 万」类确认句

session / user

 fact（异步 LLM 抽取）

下轮 recall

逐行明细 / 全表

不进 memory

——留消息表或 S8/数仓

需重查或按 artifact_id 拉

仍要记住的边界：

S9 存 

元数据指针

，不是全表——下轮要逐行明细，仍应 

重查或读 artifact

。

SHORT

 只存截断原话、

不参与 recall

，不能替代 S9。

Red 区 

同步压

 掉的 tool 大块与 

异步 episode summary

 之间 

尚未完全对账

——这是仍在演进的部分；S9 恰好缓解了「查数轮廓被压没」的常见痛点。

后续演进

：把 S9 与 compaction 水位对账（同步压块带版本号、deferred summary 引用同一水位）、以及把明细查询沉淀到独立知识库/数仓，仍是路线图上的事。

长期：Persona 维度块与其他 LONG 记忆

LONG 层只收跨会话、相对稳定的事实

——不要把「这会儿在改哪个 bug」写进 LONG；那种应留在 session / episode MID。

长期记忆来源有两条，

不要混为一谈

：

1. Persona 角色模板（注入四类 + manifest 标签）

Workspace Agent 绑 Persona 时，系统 prompt 里会注入 

四类 Markdown 块

（与角色包文件对应）：

维度

典型内容

与 memory 的关系

identity

角色是谁、职责边界

模板注入，非 Turn 后自动改写

soul

语气、价值观、风格

同上

tools

工具使用习惯、禁忌

同上

user

对该用户的长期偏好（模板侧）

可与 LONG 抽取 

对照

，模板是「预设」，抽取是「对话里新确认的」

Turn 后 LLM 抽取用户级 fact 时，会打 

persona_dimension

 标签

——除上面四类外还包含 

manifest

（运行清单/约束声明这类）；该标签用于 recall 时 

只拉某一维

（Skill 里 

persona_dimensions

 可配）。注意 

manifest 只是抽取/召回的维度标签，并不作为独立 Persona 块注入 system prompt

——注入的是 identity / soul / tools / user 四类。

策略

：Persona 文件是 

人工维护的稳定面

；LONG 抽取是 

对话沉淀

。两者冲突时，应以 Persona + 显式用户更正为准，抽取事实宜保守——

拿不准就留 session，别升 LONG

。

2. LLM 抽取的用户级 fact（LONG，subject=user）

例子

：「默认用中文回复」「所属部门风控」「不要用 emoji」——跨会话有效。

写

：MID 语义抽取时 scope 判为 user；经 

normalize + hash 去重

 写 LONG。

读

：recall 别名 

user

；可配合 

persona_dimensions

 过滤。

3. 后台晋升（Consolidator）

若 

同一句用户偏好在多个 session 的 MID fact 里重复出现

（默认至少 2 个会话），Consolidator 可 

晋升到 LONG user fact

——避免只靠单次抽取漏记，也避免人工扫库。

策略

：晋升是 

保守、可审计

 的；更复杂的「跨 scope 语义整合」仍在演进，当前以「重复偏好」这类高置信模式为主。

LONG 与其他层的边界（例子）

内容

应放哪

「这单 Q2 预算 50 万」仅对本项目会话

MID session

「我所有项目都不要超过 100 万」

LONG user

「Deep Research Skill 默认开 8 轮窗口」

project MID 或 Skill profile，不是 LONG

角色包里的「你是资深架构师」

Persona identity 注入

Skill 定制化记忆策略

系统有一份 

默认记忆剖面

；每个 Skill 可在 frontmatter 写 **

memory_profile

**，会话还可挂 **

memory_profile_override

**。合并顺序：

系统默认 → 按 skill_tags 顺序逐个 Skill 合并 → 会话 override

（后者覆盖前者）。

什么时候值得定制

业务场景

建议定制点

快问快答

 Skill

关 MID 抽取或 

max_facts_per_turn: 1

；compaction 窗口小；recall 关或 limit 低

深度研究 / 长会话

 Skill

开大 compaction 窗口；

recall.inject_into_system_prompt: true

；scopes 含 

session, user, task

合规 / 本地部署

 Skill

privacy_tier: local_only

；

lane_preference: native

；禁止 mem0 外联

强 Persona 角色 Skill

recall 设 

persona_dimensions: [identity, soul]

，只拉 LONG 里对应维

查数 / 工具密集型 Skill

开 

data_context

（写 S9 查数轮廓）；

recall.scopes

 加 

data

；大结果走 artifact 外置（tool 结果截断、token 软硬限是 

env 级

，非 Skill 旋钮）

旋钮一览（节选）

**layers.***：

mid_semantic

 / 

session_summary

 / 

short

 / 

data_context

 的 

enabled

、

max_facts_per_turn

、

max_summary_chars

 — 控制写哪些、写多少；

compaction

：

enabled

 与窗口轮数（

max_facts_per_turn

）— 控制 prompt 内保留几对原文（

唯一

 的 prompt 窗口 Skill 旋钮；token 软硬限是 env 级）；

recall

：是否注入 system、

scopes

、

limit

、

persona_dimensions

 — 控制读什么、读几条；

lane_preference / privacy_tier

：native vs 外联 mem0，与 07 泳道门一致。

示例 A：轻量问答 Skill

memory_profile:

  

layers:

    

mid_semantic:

      

enabled:

false

    

session_summary:

      

enabled:

false

    

compaction:

      

enabled:

true

      

max_facts_per_turn:

4

recall:

    

inject_into_system_prompt:

false

效果

：几乎不写 MID/LONG，只靠消息表 + 短窗口压缩，适合一次性问答、降低 LLM 二次调用成本。

示例 B：深度研究 Skill

memory_profile:

  

layers:

    

mid_semantic:

      

max_facts_per_turn:

6

    

session_summary:

      

max_summary_chars:

8000

    

compaction:

      

enabled:

true

      

max_facts_per_turn:

16

recall:

    

inject_into_system_prompt:

true

    

layers:

[mid,

long]

    

limit:

32

    

scopes:

[session,

user,

task]

效果

：Turn 后多抽 fact、summary 更长；组 prompt 时主动 recall 会话 + 用户 + 任务三档，适合 multi-step research。

示例 C：企业内网 Persona Skill

memory_profile:

  

privacy_tier:

local_only

lane_preference:

native

recall:

    

inject_into_system_prompt:

true

    

scopes:

[session,

user]

    

persona_dimensions:

[user,

tools]

    

limit:

16

效果

：数据不出本地泳道；recall 只拉 user/tools 两维 LONG，减少无关 persona 块进 prompt。

示例 D：查数 / BI Skill（开 S9）

memory_profile:

  

layers:

    

data_context:

      

enabled:

true

      

max_facts_per_turn:

4

recall:

    

inject_into_system_prompt:

true

    

layers:

[mid,

long]

    

scopes:

[session,

data]

    

limit:

24

效果

：Turn 后从 tool_trace 同步捕获查数轮廓写 S9（无 LLM）；

recall.scopes

 显式带上 

data

，下一轮把「上次查的 SQL/表/行数/结论」回灌进 prompt。

data_context

 默认关，这里显式打开——普通 Chat 不会被查数噪声污染。

排查「配置没生效」

：先看会话挂了哪些 skill_tags、

后挂载是否覆盖前挂载

；再看 override 是否盖掉了 Skill。

S9 没写进去

：确认 

data_context.enabled=true

 且全局开关未关，并且 tool 名/返回结构能被启发式识别。

recall 拉不到 data

：确认 

recall.scopes

 显式含 

data

（

session

 不会自动带）。

检索：recency 与 vector（SQLite / PostgreSQL）

Memory 的 

recall

 与 HTTP 查询都要回答：

同一 scope 下很多条 note，先取哪几条？

recency（默认）

按写入时间 

新者优先

（

id DESC

）。

零依赖

：无 embedding API、无向量扩展，CI 和无 key 环境也能跑。适合：

note 总量不大、以「最近几轮相关 fact」为主；

会话级 recall 条数已被 

limit

 卡死（例如 24 条）。

vector（显式开启）

把 

当前 Turn 用户话

 作为 

query_text

，对 Structured Note 文本做 

语义近邻排序

 再取 top-K。适合：

会话很长、MID fact 上百条，

时间新≠相关

；

用户问「上次说的那个数据库方案」，字面与旧 fact 不完全重合。

实现要点

（与 backend 选型绑定）：

Backend

vector 做法

recency 做法

SQLite

sqlite-vec

 虚表，按 tenant/layer 分区 ANN，再回表滤 scope

同左，无 query_text 时

PostgreSQL

pgvector

，

embedding <=> query

，HNSW/IVFFlat 索引

同左

进程内

注入 embedder 时用 cosine 排序（测试 / 小规模）

同左

embedding 使用 

独立的记忆专用配置

（与 Wiki 流水线解耦）。**

vector

 模式是硬要求

：开了就必须配 embedding 和扩展，缺了直接报错，

不会悄悄退成 recency**——避免以为在做语义检索、实际却在按时间乱序。

外联 

Mem0

 泳道：

search

 同样透传真实 query 文本，不再用固定占位 query。

运维建议

：默认 

recency

 上线；note 规模上来、recall 命中率不够再切 

vector

，并为 SQLite 装 vec 扩展或换 PG 实例。

一次 Turn 的读写顺序（串起来看）

读（Turn 前，同步）

System：Persona 四类注入块 + Skill 正文

可选 Recall：按 effective profile 从 MID/LONG 拉 note（recency 或 vector）

Dialogue：消息表最近行 → 07 的压缩裁剪链

写（Turn 后）

SHORT 预览：

同步、字符串 clip，无 LLM

（不参与 recall）

S9 data 上下文：

同步、无 LLM

，从 tool_trace 启发式捕获（opt-in）

SSE：

memory.updated

（常带 deferred）

deferred worker：MID/LONG fact、episode summary/state upsert

finalized 标记：供前端二次拉取

后台 

Consolidator

 另起周期：SHORT 去重、晋升 MID、重复用户偏好晋升 LONG。

伪代码：召回与 Turn 写入

下面几段把本篇的 

记忆

 线收成可实现的形状；当轮 prompt 的压缩裁剪沿用 07，这里只用一行带过。

function

 ResolveEffectiveMemoryProfile(session, skill_tags):

    profile := DefaultMemoryProfile()

    

for

 tag 

in

 skill_tags:

        profile := Merge(profile, LoadSkill(tag).memory_profile)

    

if

 session.memory_profile_override:

        profile := Merge(profile, session.memory_profile_override)

    

return

 profile

function

 BuildMessagesBeforeTurn(session, user_text, profile):

    system := PersonaBlocks(session) + SkillAddons(session)

    

if

 profile.recall.inject_into_system_prompt:

        system += RecallBlock(

            layers=[mid, long],

            scopes=profile.recall.scopes,

            

limit

=profile.recall.limit,

            query_text=user_text,          // 当前轮用户话，供 vector 排序

            mode=env.MEMORY_RETRIEVAL_MODE // recency | vector

        )

    dialogue := LoadRecentRows(session)

    messages := CompactAndBudget([system] + dialogue)  // 07 的裁剪链，详见 07

    

return

 messages

function

 AfterTurnWrite(ctx, user_text, assistant_text, profile, tool_trace):

    // clip 非 LLM；recall 不读 SHORT

    Memory.Remember(SHORT, scope=session, preview=clip(user_text, assistant_text))

    PersistDataContextFromTools(ctx, tool_trace, profile)   // 同步、无 LLM、opt-in

    EmitSSE(

"memory.updated"

, deferred=HasDeferredSink())

    

if

 HasDeferredSink():

        Enqueue(PersistTurnMemory, ctx, user_text, assistant_text, profile)

    

else

:

        PersistTurnMemory(ctx, user_text, assistant_text, profile)

function

 PersistDataContextFromTools(ctx, tool_trace, profile):

    // S9：仅当全局开关 AND Skill data_context.enabled 才捕获

    

if

 not (GlobalAutoCapture and profile.layers.data_context.enabled):

        

return

    

for

 data 

in

 ExtractDataContexts(tool_trace):       // 启发式、纯函数、无 LLM

        Memory.Upsert(data_context_key(ctx.session, 

"latest"

),

                      note=data, layer=MID, scope=data)

        

if

 data.call_id:

            Memory.Append(data_context_key(ctx.session, data.call_id),

                          note=data, layer=MID, scope=data)

function

 PersistTurnMemory(ctx, user_text, assistant_text, profile):

    

if

 profile.layers.mid_semantic.enabled:

        

for

 fact, scope 

in

 LLM.ExtractScopedMemories(user_text, assistant_text):

            layer := (scope == user) ? LONG : MID

            Memory.UpsertStructuredNote(fact, layer=layer, scope=scope)

    

if

 profile.layers.session_summary.enabled:

        prior := Memory.GetCanonical(summary_key(ctx.session))

        md := LLM.MergeRunningSummary(prior, user_text, assistant_text)

        Memory.Upsert(summary_key, note=md, layer=MID, scope=episode)

        Memory.Upsert(state_key, state=ParseSections(md), layer=MID, scope=session)

    EmitFinalizedMarker(ctx.session)   // 供前端二次拉取

function

 MemoryRecall(ctx, layer, scopes, 

limit

, query_text, mode):

    

if

 mode == vector and query_text:

        

return

 Backend.QueryVector(ctx, layer, scopes, 

limit

, query_text)

    

return

 Backend.QueryRecency(ctx, layer, scopes, 

limit

)  // ORDER BY id DESC

读路径：

先 profile → 再 recall（可带 query_text）→ 最后沿用 07 的裁剪链组 prompt

。写路径：

SHORT + S9 data 同步 → MID/LONG 异步

。

用户与运维怎么看见

HTTP

：按 session 查 memory，layers / scopes / limit 可选。

工作台侧栏

：默认 MID+LONG、session+user；听 SSE 刷新。

日志

：recall 是否走 vector、deferred 写入成败、S9 是否捕获——便于对账「下轮为什么记得 / 记不得」。

污染与治理（07 的延伸，一笔带过）

评测 tenant 与生产隔离；cross-tenant 硬拒；

local_only

 禁外联泳道；recall limit + 字符预算 + context budget 三重 cap；评测库勿拷进生产 sqlite。

几句容易踩坑的地方

把 SHORT 当成每轮 LLM 摘要

 — SHORT 只是 clip，recall 不读它。

把 prompt 裁剪和 episode summary 当成一回事

 — 一个改当轮窗口（07），一个落盘跨轮语义。

session fact 写进 user LONG

 — recall 串台。

Skill 合并顺序搞反

 — 以为先挂的 Skill 优先，实际是后覆盖前。

开了 vector 没配 embedding

 — 启动或 recall 直接失败（这是刻意的）。

查数大结果只指望 MID fact

 — 明细在消息表/artifact，fact 可能只有一句 aggregate。

只有 recency 却 recall limit=200

 — 条数爆仍可能顶 budget。

收束一下，下一篇讲什么

本篇在 07 之上补了：

SHORT/压缩/异步摘要三者谁用 LLM 与默认每 Turn 成本

、

Turn 后异步写回语义

、

九档中期 scope 的场景与读写策略（含查数专档 S9）

、

查数场景与 MID 边界/演进

、

Persona 维度块与 LONG 抽取/晋升

、

Skill memory_profile 定制方法与示例

、

SQLite/PG 下 recency 与 vector 两种检索

。当轮 prompt 的压缩裁剪机制仍以连载 07 为准。

也想听听你的：

 你的系统里，「项目代号、用户偏好、查数结论」现在分别记在哪一层、哪一档？评论区聊聊你踩过的「记串台 / 该记的没记住」的坑。如果只能给你的 Agent 留 

一档

 长期记忆，你会留哪一档？评论区一个词回答。

下一篇进入 

DeepSeek V4 网关适配

：Thinking 模式、DSML 工具提示与 fallback——同一套 Turn 管线里，厂商差异收在网关里，协调层少碰。（连载 18。）

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922888&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVMJm65X2cFgy4*vG*Q*m6ro7srESUR*lYaTdboNZm78PPYKH9GVlgbaHMqVo3T*x-2Y1jRZAJo2WDwntSs0AFNX&new=1
