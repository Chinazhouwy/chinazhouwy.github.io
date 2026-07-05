# 《从零实现 Agent 系统》连载 19｜Workflow vs Agent：编排选型与 Harness 三元

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第19篇
> **核心主题**：Workflow vs Agent/Harness

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目 Agentium，源码详见 GitHub。

连载 03《控制循环：感知—决策—行动—反思》
讲的是 

tool loop

——模型自己决定下一步；
连载 08《编排与工作流：从 Chat 到任务图》
讲的是 

任务图

——步骤事先排好。真到做产品时，团队往往卡在更早一关：这件事，到底要不要让模型自由发挥？

很多人一上来就写 while 循环、接 MCP、上多 Agent，结果账单和不可复现一起涨。更稳的做法是先把 

编排选型

 说清楚：什么时候用固定 workflow，什么时候交给 agentic 环，什么时候再往上叠一层研究 harness。Agentium 用会话上的 

orchestration_mode

 把这道选择题写进元数据与审计；长程任务里，再把常被混在一起的 

Session、Harness、Sandbox

 拆成三件不同的事——会话态、验收契约、执行隔离，各管各的。

稳定的图，还是自主的环？

可以先记三条土法，再往下落实现。

任务图稳定、步骤能预先排好、要可复现、要回滚

——走 

workflow

（
连载 08
 的 DAG/pipeline）。固定多段检索、报表流水线、ETL 式流程，都属于「图已经画好」这一类。

下一步强依赖上一步的中间结果，需要模型临场判断

——走 

agentic

（
连载 03
的 tool loop）。调试、探索式问答、改代码，典型是「环」而不是「图」。

要并行派多个子代理去搜证、读料、再汇总

——走 

research harness

（连载 29 会展开 lead/worker）。这是第三种铺法：不是单环一直转，而是 fan-out 再收束。

工程圈有一句常被引用的取向：

能用 workflow 就别上 agent

——自主度是成本，不是默认值。Agentium 把它写成 

Workflow-first

：默认优先 workflow；真要走高自治，需要按豁免流程登记边界、回滚、观测与验收，让「为什么给这么大权限」留痕，而不是会上口头拍板。

这里还要分清两个容易混在一起的「mode」。本篇的 

orchestration_mode

 是 

会话级

 的：这件事走哪条流水线（对话环、固定工作流、研究任务）。连载 28 会讲的 

interaction_mode

（plan / agent / autonomous）是 

轮次级

 的：这一轮给多大工具权限、审批节奏多紧。一个选「走哪条路」，一个选「这一轮开多大油门」，可以叠加，不能互相替代。

把选型写进会话：

orchestration_mode

选型如果只活在产品经理的脑子里，过两周就没人记得当时为什么上了 agent。Agentium 把它收成会话上的三档枚举：

workflow

、

agentic

（默认）、

research

。建会话时可以声明；发消息时也可以临时改一档，写回 session 元数据后再跑这一轮。

分流本身是一张很短的映射表：agentic 对普通对话轮次，workflow 对工作流运行，research 对研究任务入队。解析逻辑做成 

纯函数、表驱动

——HTTP 入口只做确定性的分支，单测好写；配置写错、传了未知值时 

回落到 agentic

，不会让请求悬空在半路。

对前端和集成方来说，有一个需要提前对齐的约定：同一个发消息接口，

agentic 仍是流式对话

；workflow 和 research 

故意不走 LLM 流

，而是 202 返回快照或任务句柄。客户端必须看响应里的 

dispatch

 字段，别用解析 SSE 的那套逻辑去啃 202。

非 agentic 入口还有两道硬门禁：要有 

research.run

 权限，且用户内容不能为空——缺权限或缺查询，直接拒绝，不把工作流和研究任务暴露成「谁都能点」的按钮。分流成功会记 

chat_orchestration_dispatch

 审计（走了哪条路、当时是什么编排模式、run_id 是什么），事后对账「为什么这次没走对话」才查得到。

长程任务里别搅在一起的三件事

任务一跑就是几十分钟、换实例、换人接手时，「会话」「脚手架」「沙箱」经常被写进同一个 God object。拆开之后，交接和验收才说得清。

Session（会话态）

 管的是「我是谁、到哪了」。编排模式、checkpoint、事件时间线都挂在会话上。Agentium 还提供 

不调用模型

 的恢复入口：可以分页翻事件时间线，也可以 

wake

 一次拿到 resume 快照——元数据、编排模式、最近 checkpoint、最近几条消息的摘要。进程重启、前端重连时，先搞清楚状态再决定要不要续跑，不必为了「回忆上下文」先烧一轮 token。

Harness（长程契约）

 管的是「要做完什么、做完怎么算、交接交什么」。可以把它想成一张 

验收单

：版本号（旧契约别静默跑）、功能清单、Definition of Done、评估器引用、可选的确定性自检命令、需要互斥占用的资源键、以及 

交接必须产出的工件键

。跑之前按资源键 

顺序加锁

，某一键抢不到就 

释放已持有的锁

，避免半个 harness 占着坑；跑完之后，若开了严格交接校验，缺任何一个声明的工件键，任务直接标失败——

交接物没产出，就不算完成

。可选的 oracle（例如「命令必须 exit 0」）走的是确定性自检，结果进日志，不跟模型的「我觉得做完了」绑在一起。

Sandbox（执行隔离）

 管的是「动手时不许越界」。路径前缀白名单、默认拒绝出站、执行超时——这些是
连载 09
 里「别指望模型自觉」的那一层。workflow 步骤再固定，工具一旦落地，仍要过沙箱；下一篇连载 20 会接着讲 code-exec 与 MCP 怎么挂在这层上。

一句话：

Session 记状态，Harness 管验收与交接，Sandbox 管执行边界。

同一套心智：先凑上下文，再动手，再验收

不管最后铺成 workflow 图、agentic 环，还是多 Agent 研究，长程任务都可以收成 

gather → act → verify

 三拍。

gather

 是组上下文：记忆 recall、工具说明、按需加载（
连载 17
、22）。

act

 是 tool loop 加沙箱执行（
连载 03
、
09
）。

verify

 是 DoD、交接工件、oracle、输出策略与审计（
连载 12
、
16
，加上本篇的 Harness）。

workflow 把三拍 

编进节点

；agentic 把三拍 

压进每一轮

；research harness 把 act 拍 

拆给多个子代理

。铺法不同，心智相同。

几句容易踩坑的地方

把编排模式和交互模式当成一回事

——会出现「明明选了工作流，客户端还在等流式 token」的拧巴。

非对话分流不做权限门禁

——研究和工作流入口变成人人可触发。

未知编排值不回落对话

——配置 typo 让请求挂在半空。

客户端用流式解析去处理 202

——workflow 和研究返回的是快照和 job 句柄，不是 SSE。

验收单 schema 太松

——错字段静默吞掉，Harness 名存实亡。

严格交接校验默认全开

——早期流程还没产出工件就全被判失败，应按场景开。

多资源加锁失败不回滚

——下一个任务永远抢不到锁。

以为步骤固定就不需要沙箱

——图再死板，工具执行仍可能越权。

收束一下，下一篇讲什么

做 Agent 系统，别跳过「该不该让模型自由发挥」这道选择题。能画稳图就 workflow，必须临场判断再 agentic，要并行搜证再 research；把选型写进会话元数据与审计，客户端也按 dispatch 区分流式对话和 202 句柄。长程跑起来以后，把 Session、Harness、Sandbox 分开——状态、验收、隔离各管一段，再用 gather → act → verify 把三种铺法统一到同一套心智里。

下一篇进入 

MCP 与 Code Execution

：工具是直接调，还是先进代码沙箱再调 MCP、凭证怎么不进沙箱——把「工具变多了以后」的执行边界讲清楚。（连载 20。）

你的系统里 workflow 与 agent 怎么分工，Session / Harness / Sandbox 是分得很清还是揉成了一坨？欢迎评论区聊聊。

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922888&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVPS*RvvJVpsQWb4Vrhr*fHDH9pbexEQughmm2W8eTESB*Lo-JEIMhQ9n*ZnsWs6A4ZZ*HT1ZTWuzznMMayhKpg3&new=1
