---
title: "《从零实现 Agent 系统》连载 04｜调度、租赁与并发：把「跑起来」变成「可治理地跑」"
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
summary: "《从零实现 Agent 系统》连载 04｜调度、租赁与并发：把「跑起来」变成「可治理地跑」"
tags:
---

# 《从零实现 Agent 系统》连载 04｜调度、租赁与并发：把「跑起来」变成「可治理地跑」

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第4篇
> **核心主题**：调度/租赁/并发

---

连载 03 《控制循环：感知—决策—行动—反思》
讲清了一轮 Turn 里的 tool loop。

本篇往上抬一层

：当不止一个租户、不止一条 run 同时在抢 CPU、模型配额和工具槽位时，

谁先跑、跑多久、满了怎么办、能不能被掐断

——这才从「能转」进到「可治理地转」。

上一篇缺的那块：单轮能闭，全场会挤

一条请求里，循环可以收口；可生产环境里往往是

很多轮、很多租户叠在一起

。没有调度，就变成：

谁先到谁占满线程

；大租户拖死小租户，队列无限涨，僵尸任务占着预算不还。

治理里要的「公平」「可取消」「有上限」，在运行时侧通常落三件事：

调度

（排队与并发帽）、

租约

（占着资源就得有时限）、

背压

（满了就明确拒绝，而不是默默变慢）。

调度：不是「有个线程池」四个字

调度回答：

工作单元怎么入队、按什么顺序出队、同一时刻最多跑几个

。企业 Agent 场景里，

按租户切队列

很常见——避免一家公司的批量任务把另一家对话全堵死。一种朴素做法是：

每个租户一条 FIFO

，全局再有一个

轮询指针

在租户之间转，谁轮到且没超本租户并发上限，就 dequeue 一个 job 执行。

还要两层帽子：

租户内最大并发

（例如同一租户同时只跑 N 个 turn/workflow 节点）和

全局最大并发

（整机或单进程总槽位）。两层都触顶时，新来的只能

排队

；队列也设上限，便是下面的背压。

在 Agentium 里，

core

 一侧有面向租户公平的调度器思路：提交 job 时带上 

tenant_id

 和可取消的 token；由 worker 侧周期性调用「抽干待执行」一类方法，在轮询顺序里挑出就绪任务。它与连载 03 的同步 tool loop 

可以并存

——loop 解决「一轮里的圈」，调度解决「多轮/多任务谁占槽」。

租约（lease）：占坑必须能过期

租约不是法律合同，是工程上的

限时占有证

：谁拿着 

lease_id

、代表哪个 

holder

（常可绑在一次 

run_id

 或某次 tool 执行）、属于哪个租户、

什么时候自动失效

。用途包括：

预算预占

（先扣额度再干活，异常路径也要能释放）、

工具执行槽

（防止同一资源被重复并发写）、

多实例下互斥

（更重的全局锁在后续「分布式任务锁」一篇单讲）。

要点：

TTL 到了必须能收回

。实现上往往是带过期时间的记录表，由后台 sweep 或每轮 hook 扫一遍过期项，把占用的槽位还回去——否则死锁和「额度永远被占满」会悄悄发生。租约可续期（renew），但续期次数与上限宜有谱，免得变相无限占坑。

背压：队列满了要说「不」

背压（backpressure）的意思是：

上游别再往已经喘不过气的系统里塞活

。典型信号：租户队列长度达到 

max_queue_per_tenant

，

submit

 直接失败或返回「系统繁忙」，让调用方重试、降级或走异步通道——而不是让请求无限挂着，直到超时把用户体验磨没。

背压和「慢」不同：

慢

还能排队等；

背压

是明确告诉你「此刻不接了」。对 API 产品，这会转化成 429、队列满错误码、或引导用户稍后再试；对内部 worker，则是保护进程内存与线程不被拖垮。

协作式取消：掐断要一路传下去

连载 03 末尾提过：取消不能只绑在 HTTP 连接断开上。运行时会给每个 job 发 

CancelToken

：外部调用 

cancel

 后，执行体在

工具调用间隙、每一圈 LLM 前、长循环里

应主动检查，一旦已取消就抛统一异常、收尾释放租约与并发槽。

这叫

协作式

——硬杀线程成本高、资源难清理；协作式配合租约 sweep，更适合 Agent 这种「一步慢、多步长」的工作负载。调度器侧还可以提供「取消全部排队中任务」一类运维动作，与连载 01 说的控制面语义接上。

超时：分层，别只有一个「总超时」

长链路里，

工具

、

单次 LLM

、

整轮 Turn

、

工作流节点

耗时应分开设帽。最紧的一层应先触发，避免外层还在傻等、内层早已失控。思想上与租约类似：

每一层都有权利在预算耗尽时短路

，并把原因写进日志（哪一层、已用多少秒），方便和 tracing 对齐。

进程内协作 vs 丢进队列：怎么选

不必二极管，按

延迟、隔离、失败语义

选：

场景

更常选

用户等着回复的一轮 Chat，步数可控

进程内

同步或短调度器 drain，少跨进程

生成标题、固化记忆、批量评测

进程内 defer 或专用 worker 队列

，别占 HTTP 线程

多机扩容、要幂等、要重试

外部队列 + 独立 worker 进程

（后面「延期任务」篇展开）

判断土法：

调用方是否在等这条 HTTP？

 等，就别把尾巴全扔去 Kafka 还假装同步返回。

不等

，就该有明确「已受理」与任务 id，并靠调度/租约保证不会无声丢失。

一张白板图：调度、租约、取消如何叠在一起

伪代码：提交、执行、掐断（结构用）

function

 SubmitWork(scheduler, tenant_id, work_fn) -> JobHandle:

    

if

 scheduler.tenant_queue_full(tenant_id):

        raise Backpressure(

"tenant queue full"

)

    token := NewCancelToken()

    

return

 scheduler.enqueue(tenant_id, work_fn, token)

function

 WorkerDrain(scheduler, lease_mgr, max_batch):

    

for

 _ 

in

 range(max_batch):

        job := scheduler.pick_next_round_robin()

        

if

 job is None:

            

return

        lease := lease_mgr.acquire(

            lease_id = job.id,

            holder = job.run_id,

            tenant_id = job.tenant_id,

            ttl_seconds = TURN_BUDGET,

        )

        try:

            job.token.raise_if_cancelled()

            result := run_with_timeout_layers(job.work, job.token)

            job.complete_ok(result)

        except Cancelled:

            job.complete_cancelled()

        except TimeoutExceeded as e:

            job.complete_timeout(e.layer)

        finally:

            lease_mgr.release(lease.lease_id)

            scheduler.release_slot(job.tenant_id)

function

 OpsCancelRun(scheduler, run_id):

    scheduler.cancel_jobs_matching(run_id)

    

# 协作式: 已在跑的 work 在下一检查点退出

run_with_timeout_layers

 表示工具/LLM/Turn 多层计时嵌套，与单一 

sleep(9999)

 不是一回事。

几句容易踩坑的地方

只有线程池，没有租户公平

——大租户一忙，小租户 SLA 直接废。

租约只 acquire 不 sweep

——额度泄漏像慢漏气，一周后才发现全站「预算已满」。

背压做成无限队列

——内存和延迟先爆，再怪模型慢。

取消只 cancel HTTP

，长跑 tool 还在外面写库。

所有尾巴都上 Kafka

——简单对话也绕远，观测与排错成本翻倍。

收束一下，下一篇讲什么

本篇把「跑起来」推进到「

排队、占坑有时限、满了拒绝、能协作式掐断

」。你应能解释：

调度帽

与

租约 TTL

各防什么、

背压

和「慢」的差别、

进程内 drain

 与

外部队列

大致怎么选。

下一篇进入 

工具系统

：契约、注册表、默认安全——模型看见的「能调什么」如何变成可治理的执行入口。

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922888&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVN7CGUgwgNnoyoBM7D4Wxfn2Dzh-DMviqSP3Cb49CkTGRQIJQPnPZCYs1n2m-Crk8L1Agr54kxKAhrnxYfd3ekO&new=1
