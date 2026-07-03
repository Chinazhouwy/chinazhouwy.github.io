# 《从零实现 Agent 系统》连载 01｜Agent 系统是什么：问题空间与架构切片

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第1篇
> **核心主题**：Agent定义/架构切片

---

这是连载的开篇，只谈「我们到底在做什么样的系统」：问题从哪来、为何借几套老理论来读图、开源项目 

Agentium

 为什么那样分层。具体控制循环、工具协议，后面几篇再展开。

先分清一件事：你在接模型，还是在做一套能跑的「系统」

接一次大模型，本质是换一段上下文、拿回一段文字。它不管上一秒会话里承诺过什么，也不管这次要不要写库、能不能调外部接口、出了问题谁来背锅。业务一旦变成多步、带副作用、多人多租户、还要事后追责，你就得按

长期在线的程序

来设计——靠在同一 HTTP 里多打几次推理，补不齐这些窟窿。

大家口语里叫 Agent 系统，名字随便。关键是：你有没有把

状态、编排、工具怎么出门、策略与记账、运维能不能伸手

当成正经架构问题，而不是堆在 prompt 里。

多平面

听起来玄，其实就是几类责任不要糊成一锅：谁在算、谁在管风险、谁接人、谁管后台与存储，彼此用清晰的依赖方向约束，以后才改得动。

三个借来的「尺子」：操作系统、控制论、容器思维

借旧理论不是为了掉书袋，是为了

开会时能把图画在一张白板上

，而且大家指的是同一块东西。每一块下面，我只保留最顺手的那两三个抓手。

操作系统这面尺子

，问的是三件事：谁在跑、能不能被优雅打断、写盘和出站是不是只能走

固定入口

。把「一轮会话里多次 tool」想成用户态里一段活，就要有人扮演「边界」：网关、会话与编排、沙箱和工具契约，在上面对业务稳定、在下面可以换实现。前台聊天和后台定时任务可以共享同一套语义，但

入口和配额

宜分开，否则账算不清。落到 Agentium，大致是 

core

 管生命周期和调度那一挂、

coordination

 管会话和 Turn、执行侧再交给网关与沙箱；这些该在装配里接好，而不是塞满 

api

 的 if-else。

控制论这面尺子

，把一个目标当成给定值：外面世界被你改动了，是对象侧；日志、账单、评测、人要插嘴，是观测；策略、限流、编排是调节；真正能动手的是带过闸的工具执行。

审批、发布门、内容检查

该是并联的闭环，接口写清楚；不能装作「模型更懂事」就当合规做完了。在 Agentium，这条线主要泡在 

governance

 以及与安全、评测相关的横切能力里，和「纯推理」那条路并排走。

容器思维这面尺子

，重点不是嘴上「像 Docker」，而是三件可落地的事：

谁占多少配额

、

一次运行拿什么版本的路由与白名单可当快照用

、

默认是否收紧出站与高风险能力

。行业里常把租户与预算类比成 cgroup/namespace 一类的硬隔断，把「每次 run 固化一份配置快照」类比成不可变镜像，把角色模板、领域包分层类比成分层镜像，用来约束副作用和发布链路——和前两种读法是同一件事的侧面。

三件事连起来：

边界、闭环、配额与快照

。你画图时心里有这三词，就够撑住第一波评审。

Agentium：为什么入口要薄、包却要分得细

有一句话可以先记住：

门面薄，线在中间，底子能换

。HTTP 和命令行只是把外面来的字节变成内部能懂的一次调用；真正把会话往前推、把策略串起来、把 turn 收口的，应尽量落在中间的协调与治理层。包名一长串不是为了炫目录，而是为了在语言和文档里说死

谁不许反向依赖谁

——例如领域模型不沾具体数据库类型，编排层不把业务叙事写死在路由文件里。

启动时那一段初始化（把依赖全部「接线」的那层代码），干的是把所有该单例的对象接起来：网关、入站会话、账本、审计、预算、插件、沙箱，再装进运行时对外暴露的几个大壳子里。这跟「装好内核再注册一张表」只是气质相近的比喻，别以为真要写操作系统。

多平面可以同时存在：

对话主线

、

后台

、给运维准备的

控制面

、还有评测演练——共用一套领域故事，部署上再分开。记不住包名也没关系，只要把依赖箭头画稳：

先有 HTTP 或 CLI 这一层薄薄的脸面，往里是装配和各个职责域，最底下再接存储、消息和纯粹的领域数据

。

从能 demo 到能上线，差的不止多几行 prompt

最小演示往往是：进来 → 过网关 → 跑一轮 loop → 碰工具。要往企业里推，通常还得单开

治理与安全

、

异步与后台

、

控制面

、以及

能替身的存储和消息

。不必每个「面」都对应一台机器；要紧的是

箭头朝哪、谁不该知道谁

。

两张图：盒子怎么叠、一笔请求怎么走

第一张是

分层盒子

，箭头表示装配时谁依赖谁（和同类的启动接线顺序一个方向）。

flowchart TB

    subgraph facade [接口层 api / cli]

        API["api"]

        CLI["cli"]

    end

    subgraph app_layer [装配 app]

        Boot["runtime 装配"]

    end

    subgraph run [运行与业务能力]

        CORE["core · 调度与生命周期"]

        COORD["coordination · 会话与编排"]

        GW["ai_gateway"]

        MORE["channels / tools / memory / sandbox / plugins …"]

    end

    subgraph gov [治理与安全]

        GOV["governance · security · evaluation …"]

    end

    subgraph infra [基础设施]

        INFRA["infra · db / mq / telemetry …"]

    end

    subgraph bg [后台]

        BG["background …"]

    end

    API --> Boot

    CLI --> Boot

    Boot --> CORE

    Boot --> COORD

    Boot --> GW

    Boot --> MORE

    Boot --> GOV

    Boot --> INFRA

    Boot --> BG

    CORE -.-> INFRA

    GOV -.-> INFRA

    BG -.-> COORD

第二张把

实心线

当

主业务数据

走的路：

请求进门 → coordination 里的会话和 turn → 网关推理 → 需要时再进工具沙箱

。

虚线

是治理和生命周期一类的「另一只手」：

turn

 和网关旁边擦一下，不改变主路径读起来顺。手机端若图看不清，死记一句也行：

实心管内容，虚线管准不准你走

。

flowchart LR

    subgraph data [数据主路径示意]

        E[请求] --> H[http/cli]

        H --> C[coordination · turn]

        C --> G[ai_gateway]

        C --> X[tools · sandbox可选]

        G --> C

        X --> C

        C --> R[响应]

    end

    subgraph ctrl [控制侧示意]

        P[governance]

        K[core · 生命周期可选]

    end

    P -.-> C

    P -.-> G

    K -.-> C

「入口不写业务逻辑」说白了是什么

不是要禁止控制器里出现条件判断；而是别把

这轮对话该怎么推进

、

预算钩子怎么串

这种事只写在某个 HTTP handler 里。Web 上和 CLI 上应该是同一剧本，以后要接别的入口也好复用。

薄门面

也方便你把「载入会话 → 跑 turn」整段搬进测试里去——这和行业里常见的分层习惯一致：

领域编排别焊死在某一种 Web 路由上

，数据对象也别偷偷绑死某一种数据库驱动。

一段分层伪代码，专门用来对「谁先谁后」上心

下面这些

跑不起来

，只是把装配顺序摊平：从下往上叠基建、叠策略、叠网关和执行环境，再回到会话工作台，最后才挂路由——顺序本身就在讲架构。

procedure BootstrapRuntimeArchitected(settings) -> Runtime R:

    

# 底座：能换的假 backend 真放在这儿

    infra_bundle := InfrastructureBundle(settings)

    

# 策略侧：账本、审计、审批，吃上面那条底座

    gov_bundle := GovernanceBundle(settings, infra_bundle)

    

# 执行侧：模型网关、沙箱、工具注册、插件 MCP、记忆泳道 …

    gateway := AIMGateway(settings, gov_bundle.hooks)

    exec_env := ExecutionEnv(settings)

    memory := MemoryLaneService(settings, infra_bundle, gov_bundle.limits)

    

# 会话语义的「工作台」：把网关和执行台接进来

    turn_service := CoordinationTurnService(

        gateway, exec_env.registry, exec_env.sandbox,

        gov_bundle.policy_hooks, memory,

    )

    core_handles := CoreRuntimeHandles(settings, infra_bundle)

    

bg

 := BackgroundWorkersOptional(settings, infra_bundle, turn_service, gov_bundle)

    R := ApplicationContainer(settings,

        coordination = turn_service,

        core = core_handles,

        governance = gov_bundle,

        background = 

bg

,

        control_plane_api = BuildControlPlaneAPI(core_handles, …),

    )

    RegisterThinHttpAndCli(R)

    

return

 R

用户敲进来一条请求时，可以压成五步想象：

解析 → 找会话 → 门前挡一下 → 跑 turn → 门后记账再包装回去

。

function

 HandleTurnArchitected(R, envelope) -> response:

    ctx := ParseFacade(envelope)

    session := LoadOrCreateSession(ctx, R.infra)

    

if

 DenyByPolicyOrAudit(R.gov, ctx, session):

        

return

 Reject()

    outcome := R.coordination.RunTurn(session, ctx, R.core_cancel_token_registry)

    FinalizeGovernance(R.gov, ctx, session, outcome)

    

return

 Render(outcome)

读的时候顺手想三件事够不够：

models 有没有偷偷 import 数据库实现

；

核心业务有没有只有 api 知道的秘密

；

安全评测是不是反向要求 HTTP

。都对上了，这张图就没白画。

几句逆耳的话

能把 tool calling 跑出 demo ≠ 能上生产；

只靠 prompt 当法务

也不行；控制台里什么也没有的时候，长尾任务别全堆在同步接口里活活拖死。

容器类比

若说不上配额和快照，就只剩一句空话。

收束一下，下一篇讲什么

如果你能对着白板复述一遍盒子图，再徒手画一笔请求的实心线和边上的虚线，这一篇要说的也就到位了。

下一篇会从

会话、轮次、预算

这些名词说起，顺带讲讲数据模型应干净到什么程度、少和磁盘网络绑死。

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922888&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVNecN8k2Pxuf2QnyQaTjmul7yBb2pB6Ka*ilIEVSuNbJ-zm2rDiP8jczePLZvZkN4IwOd1qqm0evibCP5oQbbqM&new=1
