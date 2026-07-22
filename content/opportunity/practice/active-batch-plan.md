---
title: "后续题目计划（23-226）"
date: "2026-07-10"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "后续题目计划（23-226）"
tags:
---

# 后续题目计划（23-226）

> 进度必须以当前 `content/opportunity/practice/` 文件和最近会话为准，不使用历史提交号推断。
> 状态约定：`✅ 已完成` 表示已有练习文件；`🟡 已练习，待补档` 表示已有对话记录但文件缺失，不重新抽题；无标记表示尚未练习。
> 2026-07-10 重排原则：已完成 #1-#59 不改；#60 起优先 Hermes、Agent、AI、Harness、RAG、AI Coding，普通 Java/数据库/算法整体后移。
> 2026-07-18 轨道调整：#63-#69 是“项目研读支线”，用于讨论尚未完成的自研设计，不计正式模拟题数量和得分；正式模拟主线完成 #62 后从 #70 继续。

---

## 题池结构

| 范围 | 状态 |
|------|------|
| 1-22 | 已完成，暂不重复抽 |
| 23-59 | 已完成或待补档，保留原题号 |
| 60-62 | Interview Harness 已完成练习 |
| 63-69 | 项目研读支线，不计正式模拟题配额和得分 |
| 70-119 | Agent / AI / RAG / AI Coding 正式模拟主线 |
| 120-226 | Java 后端、数据库、中间件、系统设计、算法后置区 |

## 重排审计

- 最近新增题源：`content/projects/interview-harness/` 两篇项目文档、`content/learning/ai-agents/deepseek-agent-harness-pm-analysis.md`、`content/learning/java/design-patterns-essence.md`。
- 已提取新增题：#60-#69，全部围绕 Interview Harness、Hermes/Agent Runtime、Eval、Skill/Memory、模型路由和项目表达。
- 新增 Java 设计模式长文暂不提前插队；它适合后续 Spring/设计模式专项，不符合本轮 Hermes/Agent/AI 优先目标。
- 最近模拟审计：2026-07-08 已完成 #57-#59；2026-07-09 新题未做、只完成 #52/#54 R1，所以今日新题从重排后的 #60 开始。
- 2026-07-17 已完成 #60-#62；#63 已出题但未作答，#63-#69 经审计改为项目研读支线。
- 2026-07-13 新增的 AgentScope Java 2.0 八篇资料已映射到 #64、#65、#67、#70-#72、#78、#81 等现有题，不重复扩充题号。

## 当前题目顺序

| 题号 | 方向 | 题目 | 来源 | 备注 |
|------|------|------|------|------|
| 23 | MySQL | Explain 怎么判断 SQL 是否走索引？`type/key/rows/Extra` 分别怎么看？ | `ai-agent/amap-agent-backend-intern-interview.md`; `middleware/vipshop-java-interview.md`; `java/cainiao-java-backend-round2-mysql.md` |  |
| 24 | Redis | 更新 DB 后删缓存为什么推荐？极端不一致怎么兜底？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `middleware/vipshop-java-interview.md`; `ai-agent/amap-agent-backend-intern-interview.md` |  |
| 25 | 分布式 | 高并发库存扣减如何防超卖？乐观锁、悲观锁、Redis、MQ 怎么取舍？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/eleme-java-backend-round1.md`; `java/baidu-java-backend-round1-shezhao.md` |  |
| 26 | Java 并发 | `volatile`、`synchronized`、CAS 和 JMM 的关系是什么？ | `middleware/vipshop-java-interview.md`; `tencent/2026-05-27-tencent-cloud-final-round.md`; `java/pdd-java-backend-round1-concurrency.md` |  |
| 27 | Spring | Spring AOP 代理原理是什么？JDK 动态代理和 CGLIB 怎么选？事务为什么会失效？ | `middleware/vipshop-java-interview.md`; `java/baidu-java-backend-round1.md`; `java/baidu-java-backend-round2.md` |  |
| 28 | MQ | RabbitMQ 如何保证可靠投递、可靠消费、死信队列和幂等？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/eleme-java-backend-round1.md` |  |
| 29 | MySQL | InnoDB 行锁、间隙锁、next-key lock 和死锁排查怎么讲？ | `java/cainiao-java-backend-round2-mysql.md`; `tencent/2026-05-27-tencent-cloud-final-round.md`; `practice/06-mvcc.md` |  |
| 30 | Redis | Redis 热点 Key、大 Key、缓存击穿的生产处理方案？（🟡 已练习，待补档） | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/megvii-java-round1-12-questions.md`; `middleware/vipshop-java-interview.md` | 待补档 |
| 31 | JVM | JVM 类加载机制、双亲委派和打破双亲委派怎么回答？ | `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `java/eleme-java-backend-round1.md`; `java/baidu-java-backend-round2-concurrency.md` |  |
| 32 | AI Agent | Agent Memory 怎么设计？短期、长期、摘要、向量记忆如何取舍？（✅ 已完成） | `tencent/2026-06-07-wxg-wechat-pay-cool-jing.md`; `ai-agent/bytedance-agent-interview-round2.md`; `ai-agent/backend-to-agent-transition.md` | 已完成 |
| 33 | 系统设计 | 秒杀系统怎么设计？限流、削峰、库存一致性、订单异步化怎么做？（✅ 已完成） | `java/eleme-java-backend-round1.md`; `java/megvii-java-round1-12-questions.md`; `tiktok/2026-05-27-tiktok-ecommerce-backend-round1.md` | 已完成 |
| 34 | Java 集合 | ArrayList、LinkedList、HashMap、ConcurrentHashMap 如何选？（✅ 已完成） | `middleware/vipshop-java-interview.md`; `java/meitu-backend-server-round1.md`; `java/megvii-java-round1-12-questions.md` | 已完成 |
| 35 | Java 并发 | AQS 原理：`state`、CLH 队列、独占/共享模式怎么讲？（🟡 已练习，待补档） | `practice/07-lock-vs-trylock-aqs.md`; `java/pdd-java-backend-round1-concurrency.md`; `java/jd-java-backend-round2-jvm-concurrency.md` | 待补档 |
| 36 | Spring | Spring Boot 自动装配原理是什么？Boot 2 和 Boot 3 有什么变化？ | `middleware/vipshop-java-interview.md`; `java/baidu-java-backend-round1.md`; `java/spring-boot-async-4-patterns.md` |  |
| 37 | MySQL | redo log、undo log、binlog 分别干什么？两阶段提交是什么？ | `ai-agent/amap-agent-backend-intern-interview.md`; `java/cainiao-java-backend-round2-mysql.md`; `middleware/rocketmq-kafka-transaction-ordering.md` |  |
| 38 | Redis | Redis Cluster 和 Sentinel 的区别？主从切换有什么一致性风险？（✅ 已完成） | `java/hupu-java-backend-round2-redis-distributed.md`; `practice/10-distributed-lock.md`; `practice/14-redis-distributed-lock-deep.md` | 已完成 |
| 39 | MQ | RocketMQ 事务消息、延时消息和顺序消息怎么实现？（✅ 已完成） | `middleware/rocketmq-kafka-transaction-ordering.md`; `java/eleme-java-backend-round1.md`; `practice/22-kafka-consumer-group-rebalance.md` | 已完成 |
| 40 | AI Agent | Harness 到底是什么？和 Eval、Agent Framework、MCP 的边界是什么？（✅ 已完成） | `codex gpt 修复点.md`; `ai-agent/alibaba-fliggy-backend-interview.md`; `industry/2026-05-25-deepseek-agent-harness-hiring.md` | 已完成 |
| 41 | AI Agent | LangGraph 的状态图执行模型是什么？和普通 ReAct Loop 有什么区别？（✅ 已完成） | `ai-agent/langgraph-state-machine-engine.md`; `ai-agent/bytedance-agent-interview-round2.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 已完成 |
| 42 | RAG | RAG 如何评测和优化？召回率、精排、幻觉率怎么设计指标？（✅ 已完成） | `practice/19-rag-system-design.md`; `ai-agent/taotian-ai-agent-interview.md`; `ai-agent/bytedance-agent-interview-round2.md` | 已完成 |
| 43 | JVM | 对象分配流程：TLAB、Eden、Minor GC、老年代晋升怎么讲？（✅ 已完成） | `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `java/jd-java-backend-round2-jvm-concurrency.md`; `java/megvii-java-round1-12-questions.md` | 已完成 |
| 44 | 分布式 | CAP、BASE、Raft 怎么回答？和业务最终一致性有什么关系？（✅ 已完成） | `java/eleme-java-backend-round1.md`; `middleware/rocketmq-kafka-transaction-ordering.md`; `java/baidu-java-backend-round1-shezhao.md` | 已完成 |
| 45 | 算法 | LRU 缓存 O(1) 怎么手写？线程安全版本怎么设计？（✅ 已完成） | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `ai-agent/amap-agent-backend-intern-interview.md`; `middleware/vipshop-java-interview.md` | 已完成 |
| 46 | Java 并发 | ThreadLocal 原理、内存泄漏和线程池复用问题怎么回答？（✅ 已完成） | `java/pdd-java-backend-round1-concurrency.md`; `middleware/vipshop-java-interview.md`; `java/baidu-java-backend-round2.md` | 已完成 |
| 47 | Java 并发 | CompletableFuture 怎么用？异常处理、超时和线程池隔离怎么做？（✅ 已完成） | `java/eleme-java-backend-round1.md`; `ai-agent/completable-future-production-pitfalls.md`; `java/jd-java-backend-round2-jvm-concurrency.md` | 已完成 |
| 48 | MySQL | 深分页怎么优化？覆盖索引、延迟关联、游标翻页怎么选？（✅ 已完成） | `middleware/后端慢SQL优化面经.md`; `java/cainiao-java-backend-round2-mysql.md`; `middleware/大厂SQL高频题第2期.md` | 已完成 |
| 49 | Redis | Redis 常用数据结构底层和场景：ZSet、Bitmap、HyperLogLog 怎么用？（✅ 已完成） | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/megvii-java-round1-12-questions.md`; `java/hupu-java-backend-round2-redis-distributed.md` | 已完成 |
| 50 | Spring | Spring Boot 限流拦截器怎么设计？令牌桶、漏桶、滑动窗口怎么落地？（✅ 已完成） | `java/spring-concurrency-throttle-interceptor.md`; `java/megvii-java-round1-12-questions.md`; `java/eleme-java-backend-round1.md` | 已完成 |
| 51 | JVM | G1、ZGC、CMS 的区别和适用场景是什么？（✅ 已完成） | `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `java/jd-java-backend-round2-jvm-concurrency.md`; `tencent/2026-05-27-tencent-cloud-final-round.md` | 已完成 |
| 52 | 分布式 | 分布式 ID 方案：雪花算法、号段、Redis、自增 ID 怎么选？（✅ 已完成） | `java/baidu-java-backend-round1-shezhao.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md`; `java/baidu-java-backend-final-round.md` | 已完成 |
| 53 | 系统设计 | 购物车系统怎么设计？未登录用户跨设备怎么同步？（✅ 已完成） | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `tiktok/2026-05-27-tiktok-ecommerce-backend-round1.md` | 已完成 |
| 54 | 系统设计 | 优惠券/满减活动规则和库存怎么设计？（✅ 已完成） | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md`; `java/baidu-java-backend-round1-shezhao.md` | 已完成 |
| 55 | AI Agent | 超长上下文冗余怎么优化？摘要、裁剪、子 Agent 怎么取舍？（✅ 已完成） | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `ai-agent/backend-to-agent-transition.md`; `ai-agent/claude-code-dynamic-workflows.md` | 已完成 |
| 56 | AI Agent | MCP、RAG、Skill 三者区别和组合方式是什么？（✅ 已完成） | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `practice/21-mcp-protocol-vs-function-calling.md`; `ai-agent/agentium-mcp-execution-mechanism.md` | 已完成 |
| 57 | AI Agent | Agent 评测体系怎么设计？任务成功率、工具调用准确率、幻觉率怎么测？（✅ 已完成） | `ai-agent/bytedance-agent-interview-round2.md`; `codex gpt 修复点.md`; `ai-agent/agent-interview-questions-summary.md` | 已完成 |
| 58 | 网络/OS | TCP 三次握手、WebSocket vs HTTP 轮询怎么讲？（✅ 已完成） | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/baidu-java-backend-round1-shezhao.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 已完成 |
| 59 | 算法 | 合并 K 个升序链表怎么写？复杂度是多少？（✅ 已完成） | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 已完成 |
| 60 | Hermes/Harness | Interview Harness 为什么要拆成 Interview Orchestrator 和 Agent Runtime 两层？边界和失败隔离怎么讲？（✅ 已完成） | `content/projects/interview-harness/interview-harness-deep-research.md`; `content/learning/ai-agent/AgentScope-Java-1.1.0-Harness-Framework.md` | 已完成：4/10；2026-07-18 GPT 纠错 |
| 61 | Hermes/Harness | 面试系统的 Rubric 评测怎么设计？Covered/Missing/Incorrect/Evidence 如何结构化？（✅ 已完成） | `content/projects/interview-harness/interview-harness-deep-research.md`; `content/projects/site-life-os/codex-gpt-fixes.md` | 已完成：5/10；2026-07-18 GPT 纠错 |
| 62 | Hermes/Harness | LLM 评分漂移怎么做 Eval 回归？固定样本、指标和阈值怎么设计？（✅ 已完成） | `content/projects/interview-harness/interview-harness-deep-research.md`; `content/opportunity/practice/57-agent-evaluation-system.md` | 已完成：0/10（未作答）；2026-07-18 GPT 纠错 |
| 63 | 项目研读 · Harness | MasteryEvidence 能力证据怎么建模？为什么不能把“用户不懂某知识点”直接写进长期记忆？ | `content/projects/interview-harness/interview-harness-deep-research.md`; `content/references/ai-memory-tag-system-design.md` | 已出题未作答；不计正式题配额和得分 |
| 64 | 项目研读 · Harness | Mini Harness 的核心抽象怎么拆？AgentState、StateStore、RuntimeContext、Hook、Event、ToolLoop 分别负责什么？ | `content/projects/interview-harness/interview-harness-deep-research.md`; `content/projects/interview-harness/interview-harness-implementation-roadmap.md`; `content/sources/agentscope-java2-series/02.md`; `content/sources/agentscope-java2-series/03.md`; `content/sources/agentscope-java2-series/06.md`; `content/sources/agentscope-java2-series/07.md` | 不计正式题配额和得分 |
| 65 | 项目研读 · Harness | 为什么不用 Spring AI 自动 ToolCallingAdvisor，而选择自己控制 Tool Loop？权限、重试、循环上限怎么落地？ | `content/projects/interview-harness/interview-harness-deep-research.md`; `content/projects/interview-harness/interview-harness-implementation-roadmap.md`; `content/sources/agentscope-java2-series/05.md`; `content/sources/agentscope-java2-series/06.md` | 不计正式题配额和得分 |
| 66 | 项目研读 · Hermes | Hermes 的 Skill 和长期记忆应该怎么治理？哪些信息该固化，哪些必须写回业务文档或 practice？ | `docs/hermes-skills/README.md`; `docs/new-session-handoff-site-hermes.md`; `content/projects/site-life-os/codex-gpt-fixes.md` | 不计正式题配额和得分 |
| 67 | 项目研读 · Agent | Agent 模型路由怎么做？模拟面试、整理资料、普通问答为什么可能需要不同模型和上下文窗口策略？ | `content/learning/ai-agent/agent-series-06-从零实现-Agent-系统连载-06｜AI-网关路由、限流、内容与成本.md`; `content/learning/ai-agent/agent-series-18-从零实现-Agent-系统连载-18｜DeepSeek-V4-网关适配Model.md`; `content/sources/agentscope-java2-series/04.md` | 不计正式题配额和得分 |
| 68 | 项目研读 · AI 产品 | DeepSeek Agent Harness PM 如何定义“更多场景、更深入、更多人”？产品指标如何反哺模型和 Harness 迭代？ | `content/learning/ai-agents/deepseek-agent-harness-pm-analysis.md`; `content/opportunity/sources/2026-05-25-deepseek-agent-harness-hiring.md` | 不计正式题配额和得分 |
| 69 | 项目研读 · AI Coding | 把 Interview Harness 写成简历项目时，如何讲清 Java 后端能力、Agent Runtime 能力和 Eval 能力？ | `content/projects/interview-harness/interview-harness-deep-research.md`; `content/projects/interview-harness/interview-harness-implementation-roadmap.md`; `content/learning/ai-agent/backend-to-agent-transition.md` | 项目完成后再做；不虚构经历 |
| 70 | AI Agent | Agent 和普通 LLM 调用有什么区别？工具、记忆、规划分别是什么？（✅ 已完成） | `tencent/2026-06-07-wxg-wechat-pay-cool-jing.md`; `practice/20-agent-architecture-react.md`; `ai-agent/agent-interview-questions-summary.md`; `content/sources/agentscope-java2-series/01.md`; `content/sources/agentscope-java2-series/02.md` | 已完成：4/10 |
| 71 | AI Agent | ReAct 原理和工程落地怎么讲？什么时候会循环失败？（✅ 已完成） | `practice/08-react-pattern-vs-cot.md`; `practice/20-agent-architecture-react.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `content/sources/agentscope-java2-series/02.md` | 已完成：5/10 |
| 72 | AI Agent | Function Calling、Tool Use、Workflow、MCP 的边界是什么？ | `practice/21-mcp-protocol-vs-function-calling.md`; `practice/20-agent-architecture-react.md`; `ai-agent/agentium-mcp-execution-mechanism.md`; `content/sources/agentscope-java2-series/05.md` | 原 #96 |
| 73 | RAG | RAG 完整流程怎么讲？离线索引和在线检索分别做什么？ | `practice/19-rag-system-design.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/2026-05-18-youzan-java-ai-interview.md` | 原 #97 |
| 74 | RAG | 向量检索、BM25、混合检索、RRF、Reranker 分别解决什么问题？ | `practice/04-rag-retrieval-indices.md`; `practice/19-rag-system-design.md`; `ai-agent/rag-hybrid-search-meilisearch.md` | 原 #98 |
| 75 | RAG | RAG 幻觉怎么治理？检索无关、答案编造、引用错误怎么处理？ | `java/2026-05-18-youzan-java-ai-interview.md`; `ai-agent/bytedance-agent-interview-round2.md`; `ai-agent/taotian-ai-agent-interview.md` | 原 #99 |
| 76 | AI Agent | 多 Agent 协作怎么设计？主从、对等、层级、竞争模式怎么选？ | `practice/20-agent-architecture-react.md`; `ai-agent/agent-interview-questions-summary.md`; `ai-agent/claude-code-dynamic-workflows.md` | 原 #100 |
| 77 | AI Agent | Claude Code 为什么更偏 grep/工具检索，而不是直接 RAG 检索代码？ | `ai-agent/claude-code-grep-vs-rag-code-retrieval.md`; `ai-agent/backend-to-agent-transition.md` | 原 #101 |
| 78 | AI Agent | AI Coding Agent 的沙箱、权限、上下文压缩和错误恢复怎么设计？ | `ai-agent/AI-Coding-Agent-技术参考文档.md`; `ai-agent/backend-to-agent-transition.md`; `codex gpt 修复点.md`; `content/sources/agentscope-java2-series/07.md`; `content/sources/agentscope-java2-series/08.md` | 原 #102 |
| 79 | AI Agent | LangGraph checkpoint、状态恢复、人机协作节点怎么讲？ | `ai-agent/langgraph-state-machine-engine.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 原 #103 |
| 80 | AI Agent | Agent 项目如何做 Badcase 闭环？日志、trace、评测集、回流怎么做？ | `ai-agent/bytedance-agent-interview-round2.md`; `ai-agent/taotian-ai-agent-interview.md`; `codex gpt 修复点.md` | 原 #104 |
| 81 | AI Agent | Agent 安全怎么做？工具权限、Prompt 注入、数据泄露、人工审核怎么防？ | `ai-agent/2026-05-25-kimi-frontend-agent-interview-detailed.md`; `ai-agent/alibaba-intl-ai-agent-interview.md`; `ai-agent/AgentScope-Java-1.1.0-Harness-Framework.md`; `content/sources/agentscope-java2-series/08.md` | 原 #105 |
| 82 | 前端/AI | SSE、WebSocket、流式输出和 Generative UI 怎么设计？ | `frontend/ai-agent-frontend-interview.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md` | 原 #106 |
| 83 | 项目 | 后端项目如何结合 AI Agent？RAG、工具调用、权限和审计怎么落地？ | `ai-agent/backend-to-agent-transition.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `ai-agent/bytedance-ai-agent-backend-round1.md` | 原 #118 |
| 84 | 项目 | AI 辅助写代码在公司里怎么用？Spec、Plan、Agent Mode 怎么区分？ | `ai-agent/amap-agent-backend-intern-interview.md`; `ai-agent/backend-to-agent-transition.md`; `ai-agent/claude-code-dynamic-workflows.md` | 原 #119 |
| 85 | 架构 | 从后端转 AI Agent 岗，怎么讲自己的技术路线和项目价值？ | `ai-agent/backend-to-agent-transition.md`; `ai-agent/后端转Agent开发学习路线.md`; `ai-agent/ai-agent-learning-roadmap.md` | 原 #122 |
| 86 | 系统设计 | 客服机器人/智能客服系统怎么设计？RAG、工单、人工转接怎么做？ | `ai-agent/ctrip-ai-agent-interview.md`; `frontend/ai-agent-frontend-interview.md`; `ai-agent/taotian-ai-agent-interview.md` | 原 #175 |
| 87 | 系统设计 | 推荐/导购 Agent 怎么设计？用户画像、召回、排序、工具调用怎么结合？ | `ai-agent/ctrip-ai-agent-interview.md`; `ai-agent/taobao-flashsale-ai-dev-round1.md`; `ai-agent/heytea-ai-app-interview.md` | 原 #176 |
| 88 | AI Agent | Workflow 和完全自主 Agent 怎么取舍？生产为什么常用混合模式？ | `ai-agent/ctrip-ai-agent-interview.md`; `practice/20-agent-architecture-react.md`; `ai-agent/langgraph-state-machine-engine.md` | 原 #177 |
| 89 | AI Agent | 规则链路和大模型链路怎么取舍？哪些场景不该用大模型？ | `ai-agent/ctrip-ai-agent-interview.md`; `ai-agent/taotian-ai-agent-interview.md`; `practice/20-agent-architecture-react.md` | 原 #178 |
| 90 | AI Agent | RAG + Function Calling 混合链路怎么设计？离线知识和实时接口如何组合？ | `ai-agent/ctrip-ai-agent-interview.md`; `practice/21-mcp-protocol-vs-function-calling.md`; `practice/19-rag-system-design.md` | 原 #179 |
| 91 | AI Agent | 文档版本、有效期、权限和更新机制怎么设计？ | `ai-agent/ctrip-ai-agent-interview.md`; `ai-agent/bytedance-agent-interview-round2.md`; `practice/19-rag-system-design.md` | 原 #180 |
| 92 | AI Agent | SFT、LoRA、RLHF、RAG 分别适合什么？为什么知识更新不建议靠微调？ | `ai-agent/ctrip-ai-agent-interview.md`; `ai-agent/taotian-ai-agent-interview.md`; `practice/19-rag-system-design.md` | 原 #181 |
| 93 | AI Agent | Prompt 注入攻击怎么防？系统提示、工具权限、输出校验怎么设计？ | `ai-agent/2026-05-25-kimi-frontend-agent-interview-detailed.md`; `ai-agent/alibaba-intl-ai-agent-interview.md`; `ai-agent/AgentScope-Java-1.1.0-Harness-Framework.md` | 原 #182 |
| 94 | AI Agent | Tool 调用失败、参数错、结果为空时 Agent 怎么恢复？ | `practice/20-agent-architecture-react.md`; `ai-agent/bytedance-agent-interview-round2.md`; `codex gpt 修复点.md` | 原 #183 |
| 95 | AI Agent | 多模型路由怎么做？小模型、深度模型、本地模型如何按场景分流？ | `ai-agent/ctrip-ai-agent-interview.md`; `ai-agent/DeepSeek超越Opus4.7的优化之道.md`; `ai-agent/taotian-ai-agent-interview.md` | 原 #184 |
| 96 | AI Agent | Token 成本和延迟怎么优化？缓存、裁剪、摘要、批处理怎么做？ | `ai-agent/ctrip-ai-agent-interview.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `ai-agent/backend-to-agent-transition.md` | 原 #185 |
| 97 | RAG | Chunk 分块策略怎么选？固定长度、语义分块、递归分割有什么取舍？ | `practice/19-rag-system-design.md`; `ai-agent/ctrip-ai-agent-interview.md`; `java/2026-05-18-youzan-java-ai-interview.md` | 原 #186 |
| 98 | RAG | 查询改写、HyDE、Query Expansion 分别解决什么问题？ | `ai-agent/ctrip-ai-agent-interview.md`; `ai-agent/rag-hybrid-search-meilisearch.md`; `practice/19-rag-system-design.md` | 原 #187 |
| 99 | RAG | 向量数据库 Milvus、Qdrant、Chroma、PGVector 怎么选？ | `practice/19-rag-system-design.md`; `ai-agent/ai-agent-learning-roadmap.md`; `ai-agent/rag-hybrid-search-meilisearch.md` | 原 #188 |
| 100 | RAG | 知识图谱和 RAG 怎么结合？什么时候需要 Graph RAG？ | `java/2026-05-18-youzan-java-ai-interview.md`; `ai-agent/agent-interview-questions-summary.md`; `ai-agent/ctrip-ai-agent-interview.md` | 原 #189 |
| 101 | RAG | Anti-RAG 是什么？什么时候不该用 RAG？ | `java/2026-05-18-youzan-java-ai-interview.md`; `ai-agent/ctrip-ai-agent-interview.md`; `practice/19-rag-system-design.md` | 原 #190 |
| 102 | AI Coding | Spec Coding、Vibe Coding、Agent Mode、Yolo Mode 怎么区分？ | `ai-agent/amap-agent-backend-intern-interview.md`; `ai-agent/claude-code-dynamic-workflows.md`; `ai-agent/backend-to-agent-transition.md` | 原 #191 |
| 103 | AI Coding | 让 AI 从 0 到 1 做电商项目，你怎么拆任务和验收？ | `ai-agent/amap-agent-backend-intern-interview.md`; `ai-agent/claude-code-dynamic-workflows.md`; `ai-agent/backend-to-agent-transition.md` | 原 #192 |
| 104 | AI Coding | AI 生成代码怎么做安全审查？依赖、权限、测试、回滚怎么管？ | `ai-agent/AI-Coding-Agent-技术参考文档.md`; `ai-agent/backend-to-agent-transition.md`; `codex gpt 修复点.md` | 原 #193 |
| 105 | 综合 | 面试最后让你总结技术优势和短板，你怎么把 Java 后端 + AI Agent 串成一条主线？ | `ai-agent/backend-to-agent-transition.md`; `ai-agent/后端转Agent开发学习路线.md`; `codex gpt 修复点.md` | 原 #200 |
| 106 | AI Agent | 多Agent为什么选择三层架构？不能两层或四层的理由是什么？ | `ai-agent/netease-ai-agent-round1.md` | 原 #201 |
| 107 | AI Agent | Agent执行失败的处理逻辑是什么？重试策略、降级方案怎么设计？ | `ai-agent/netease-ai-agent-round1.md` | 原 #202 |
| 108 | AI Agent | Agent任务拆分如何保证准确性？防幻觉的工程机制有哪些？ | `ai-agent/netease-ai-agent-round1.md` | 原 #203 |
| 109 | AI Agent | 异步Channel机制是什么？Agent间异步通信如何实现？ | `ai-agent/netease-ai-agent-round1.md` | 原 #204 |
| 110 | AI Agent | DAG如何检测依赖关系？循环依赖（死循环）怎么防护？ | `ai-agent/netease-ai-agent-round1.md` | 原 #205 |
| 111 | AI Agent | Agent沙箱设计规则是什么？资源限制、权限隔离、超时控制怎么做？ | `ai-agent/netease-ai-agent-round1.md` | 原 #206 |
| 112 | AI Agent | A2A（Agent-to-Agent）协议在项目中怎么用？其他业务Agent如何接入？ | `ai-agent/netease-ai-agent-round1.md` | 原 #207 |
| 113 | AI Agent | LLM Wiki是什么？知识检索如何避免每次都从头开始？ | `ai-agent/netease-ai-agent-round1.md` | 原 #208 |
| 114 | AI Agent | Agent结合业务时，安全审计怎么做？操作日志、敏感操作审批如何设计？ | `ai-agent/netease-ai-agent-round1.md` | 原 #209 |
| 115 | AI Agent | Agent真实提效的业务场景怎么举例子？量化指标怎么描述？ | `ai-agent/netease-ai-agent-round1.md` | 原 #210 |
| 116 | 项目 | 问答助手完整架构设计：检索策略、Prompt工程、上下文管理怎么做？ | `ai-agent/netease-ai-agent-round1.md` | 原 #211 |
| 117 | AI Agent | 文档权限控制怎么做？细粒度权限、RBAC、操作权限如何设计？ | `ai-agent/netease-ai-agent-round1.md` | 原 #212 |
| 118 | AI Agent | 文档增量更新机制怎么设计？版本控制、并发处理怎么做？ | `ai-agent/netease-ai-agent-round1.md` | 原 #213 |
| 119 | 项目 | Agent项目规模：多少人在用？如何描述用户覆盖和业务价值？ | `ai-agent/netease-ai-agent-round1.md` | 原 #214 |
| 120 | AI Agent | 多Agent架构中，任务编排和依赖管理的核心设计模式有哪些？ | `ai-agent/netease-ai-agent-round1.md` | 原 #215 |
| 121 | RAG | 知识图谱化组织 vs 传统向量检索，什么时候需要LLM Wiki？ | `ai-agent/netease-ai-agent-round1.md` | 原 #216 |
| 122 | Redis | Redis 为什么快？单线程、IO 多路复用、网络模型怎么讲？ | `java/megvii-java-round1-12-questions.md`; `middleware/Redis事务与原子性原理深度解析.md`; `java/hupu-java-backend-round2-redis-distributed.md` | 原 #65 |
| 123 | Go/语言 | Go GMP 调度模型怎么讲？和 Java 线程池、虚拟线程有什么区别？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `middleware/Minimax-Go面试复盘.md` | 原 #109 |
| 124 | 语言基础 | Java、Python、Go 的运行模型和适用场景怎么对比？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `middleware/Minimax-Go面试复盘.md` | 原 #110 |
| 125 | 架构 | 单机十万 QPS 系统怎么设计？线程模型、缓存、限流、异步化怎么做？ | `tencent/2026-05-27-tencent-cloud-final-round.md`; `middleware/senior-java-3-soul-questions.md`; `java/baidu-java-backend-final-round.md` | 原 #120 |
| 126 | MQ | RocketMQ 和 Kafka 在日志模型、消费模型、事务消息上的本质区别？ | `practice/22-kafka-consumer-group-rebalance.md`; `middleware/rocketmq-kafka-transaction-ordering.md`; `java/eleme-java-backend-round1.md` | 原 #144 |
| 127 | Spring | `@Async` 的坑有哪些？线程池、事务、异常、上下文传递怎么处理？ | `java/spring-boot-async-4-patterns.md`; `java/spring-concurrency-throttle-interceptor.md`; `java/eleme-java-backend-round1.md` | 原 #147 |
| 128 | 算法 | 最长无重复子串 / 最长回文子串怎么写？ | `java/eleme-java-backend-round1.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 原 #60 |
| 129 | MySQL | B+ 树为什么适合数据库索引？和 B 树、红黑树有什么区别？ | `java/2026-05-18-youzan-java-ai-interview.md`; `java/cainiao-java-backend-round2-mysql.md`; `kuaishou/2026-05-25-kuaishou-backend-java-round1-mysql.md` | 原 #61 |
| 130 | MySQL | 索引失效有哪些场景？函数、隐式转换、LIKE、OR 分别怎么处理？ | `java/cainiao-java-backend-round2-mysql.md`; `middleware/vipshop-java-interview.md`; `java/2026-05-18-youzan-java-ai-interview.md` | 原 #62 |
| 131 | MySQL | 事务隔离级别有哪些？RC 和 RR 下 Read View 有什么区别？ | `java/cainiao-java-backend-round2-mysql.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `practice/06-mvcc.md` | 原 #63 |
| 132 | MySQL | MySQL 主从复制、binlog 格式和延迟问题怎么处理？ | `middleware/腾讯后端开发社招强度.md`; `middleware/zhihu-mysql-add-column-online-ddl.md`; `java/baidu-java-backend-final-round.md` | 原 #64 |
| 133 | Redis | Redis 持久化 RDB/AOF/混合持久化怎么选？大实例 fork 有什么问题？ | `practice/03-redis-rdb-vs-aof.md`; `java/megvii-java-round1-12-questions.md`; `java/hupu-java-backend-round2-redis-distributed.md` | 原 #66 |
| 134 | Redis | 布隆过滤器如何解决缓存穿透？误判率和删除问题怎么处理？ | `practice/13-redis-cache-penetration-breakdown-avalanche.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/2026-05-18-youzan-java-ai-interview.md` | 原 #67 |
| 135 | Redis | Redis Pub/Sub、Stream、List 做消息队列有什么区别？ | `tiktok/2026-05-27-tiktok-ecommerce-backend-round1.md`; `middleware/Redis事务与原子性原理深度解析.md`; `java/hupu-java-backend-round2-redis-distributed.md` | 原 #68 |
| 136 | MQ | Kafka 消息堆积怎么处理？扩分区、扩消费者、限流分别怎么做？ | `ai-agent/amap-agent-backend-intern-interview.md`; `java/2026-05-18-youzan-java-ai-interview.md`; `practice/22-kafka-consumer-group-rebalance.md` | 原 #69 |
| 137 | MQ | MQ 如何保证消息不丢、不重、不乱序？ | `java/eleme-java-backend-round1.md`; `middleware/rocketmq-kafka-transaction-ordering.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md` | 原 #70 |
| 138 | MQ | 本地消息表、事务消息、CDC Outbox 分别怎么实现最终一致性？ | `practice/22-kafka-consumer-group-rebalance.md`; `middleware/rocketmq-kafka-transaction-ordering.md`; `java/eleme-java-backend-round1.md` | 原 #71 |
| 139 | Spring | Spring IOC 核心思想是什么？BeanFactory 和 ApplicationContext 有什么区别？ | `java/baidu-java-backend-round1.md`; `java/alibaba-backend-java-final-round-framework.md`; `java/spring-three-level-cache-source-code.md` | 原 #72 |
| 140 | Spring | Spring Bean 三级缓存为什么能解决循环依赖？哪些场景解决不了？ | `java/spring-three-level-cache-circular-dependency.md`; `practice/15-spring-ioc-bean-lifecycle-circular-dependency.md`; `java/alibaba-backend-java-final-round-framework.md` | 原 #73 |
| 141 | Spring | `@Transactional` 默认回滚规则是什么？checked exception 怎么配置回滚？ | `practice/16-spring-transaction-propagation-internals.md`; `java/baidu-java-backend-round1.md`; `java/baidu-java-backend-round2.md` | 原 #74 |
| 142 | Spring | SpringMVC 请求执行流程是什么？`DispatcherServlet` 做了什么？ | `java/baidu-java-backend-round1.md`; `java/baidu-java-backend-round2.md` | 原 #75 |
| 143 | Java 并发 | 线程池 7 大参数、队列选择、拒绝策略和 OOM 风险怎么讲？ | `practice/01-thread-pool-core-params.md`; `java/pdd-java-backend-round1-concurrency.md`; `java/2026-05-18-youzan-java-ai-interview.md` | 原 #76 |
| 144 | Java 并发 | 为什么不推荐 Executors？生产线程池怎么命名、监控和隔离？ | `java/pdd-java-backend-round1-concurrency.md`; `java/2026-05-18-youzan-java-ai-interview.md`; `java/java-concurrency-5-optimization-tips.md` | 原 #77 |
| 145 | Java 并发 | 死锁产生的四个条件是什么？线上死锁怎么排查？ | `java/pdd-java-backend-round1-concurrency.md`; `java/baidu-java-backend-round1-shezhao.md`; `java/arthas-diagnostic-guide.md` | 原 #78 |
| 146 | Java 并发 | ReentrantLock 公平锁/非公平锁、Condition、多条件队列怎么讲？ | `practice/02-synchronized-vs-reentrantlock.md`; `practice/07-lock-vs-trylock-aqs.md`; `java/jd-java-backend-round2-jvm-concurrency.md` | 原 #79 |
| 147 | Java 集合 | HashMap JDK7/JDK8 扩容差异、红黑树化条件和线程不安全怎么讲？ | `practice/17-hashmap底层-jdk7-8-红黑树.md`; `middleware/vipshop-java-interview.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 原 #80 |
| 148 | Java 集合 | ConcurrentHashMap JDK7/JDK8 区别、size 统计和扩容协助怎么讲？ | `practice/18-concurrent-hashmap.md`; `middleware/vipshop-java-interview.md`; `tencent/2026-05-27-tencent-cloud-final-round.md` | 原 #81 |
| 149 | JVM | JVM 内存区域怎么划分？哪些区域会 OOM？ | `java/jd-java-backend-round2-jvm-concurrency.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `middleware/2026-06-01-jvm-core-principles-troubleshooting.md` | 原 #82 |
| 150 | JVM | 线上 OOM 怎么排查？MAT、jmap、jstack、Arthas 怎么用？ | `practice/05-jvm-full-gc-troubleshooting.md`; `java/arthas-diagnostic-guide.md`; `java/jd-java-backend-round2-jvm-concurrency.md` | 原 #83 |
| 151 | JVM | Minor GC 和 Full GC 区别是什么？什么对象会进入老年代？ | `java/megvii-java-round1-12-questions.md`; `java/jd-java-backend-round2-jvm-concurrency.md`; `middleware/2026-06-01-jvm-core-principles-troubleshooting.md` | 原 #84 |
| 152 | 分布式 | 2PC、TCC、Saga、本地消息表、Seata AT 怎么选？ | `practice/09-distributed-transaction.md`; `java/eleme-java-backend-round1.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md` | 原 #85 |
| 153 | 分布式 | 分布式锁 Redis、Zookeeper、数据库实现各有什么问题？ | `practice/10-distributed-lock.md`; `practice/14-redis-distributed-lock-deep.md`; `java/eleme-java-backend-round1.md` | 原 #86 |
| 154 | 分布式 | 幂等设计怎么做？唯一索引、token、状态机、去重表怎么选？ | `middleware/vipshop-java-interview.md`; `java/eleme-java-backend-round1.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md` | 原 #87 |
| 155 | 分布式 | 服务注册发现原理是什么？Nacos 和 Eureka 有什么区别？ | `java/eleme-java-backend-round1.md`; `java/baidu-java-backend-final-round.md` | 原 #88 |
| 156 | 微服务 | 熔断、降级、限流分别是什么？Sentinel 怎么落地？ | `java/eleme-java-backend-round1.md`; `java/spring-concurrency-throttle-interceptor.md`; `java/megvii-java-round1-12-questions.md` | 原 #89 |
| 157 | 系统设计 | 短链接系统怎么设计？ID 生成、防冲突、缓存和过期怎么做？ | `java/baidu-java-backend-final-round.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md` | 原 #90 |
| 158 | 系统设计 | 分布式定时任务怎么设计？时间轮、分片、幂等怎么做？ | `java/baidu-java-backend-final-round.md`; `tencent/2026-05-25-wxg-wechat-pay-backend-round2.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md` | 原 #91 |
| 159 | 系统设计 | 日志高并发落盘怎么设计？缓冲、批量、异步、背压怎么做？ | `tencent/2026-05-25-wxg-wechat-pay-backend-round2.md`; `middleware/senior-java-3-soul-questions.md` | 原 #92 |
| 160 | 系统设计 | 多级缓存怎么设计？本地缓存、Redis、DB 的一致性怎么保证？ | `java/2026-05-18-youzan-java-ai-interview.md`; `middleware/vipshop-java-interview.md`; `java/megvii-java-round1-12-questions.md` | 原 #93 |
| 161 | 网络 | 从 URL 输入到页面展示完整链路怎么讲？DNS、TCP、TLS、HTTP 分别做什么？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `java/baidu-java-backend-round1-shezhao.md` | 原 #107 |
| 162 | OS | 进程和线程核心区别是什么？Python 多进程为什么能绕过 GIL？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/baidu-java-backend-round1-shezhao.md` | 原 #108 |
| 163 | 算法 | 二叉树路径和等于 K，输出所有路径怎么写？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 原 #111 |
| 164 | 算法 | 数组找局部峰值元素怎么做？二分为什么成立？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 原 #112 |
| 165 | 算法 | 解码数字串 LC91 怎么做？DP 状态怎么定义？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 原 #113 |
| 166 | 算法 | 有效括号、最长无重复子串如何手写并说明复杂度？ | `java/eleme-java-backend-round1.md` | 原 #114 |
| 167 | 算法 | 不用加减乘除求和、LIS、LRU 三连怎么准备？ | `tencent/2026-05-25-wxg-wechat-pay-backend-round2.md` | 原 #115 |
| 168 | 项目 | 项目性能瓶颈怎么定位？慢 SQL、外部调用、锁竞争、GC 怎么排？ | `ai-agent/amap-agent-backend-intern-interview.md`; `java/baidu-java-backend-round1-shezhao.md`; `java/megvii-java-round1-12-questions.md` | 原 #116 |
| 169 | 项目 | 项目中最大技术难点是什么？如何讲清方案、取舍和效果数据？ | `java/baidu-java-backend-round1-shezhao.md`; `java/eleme-java-backend-round1.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 原 #117 |
| 170 | 架构 | 高可用系统怎么设计？降级、熔断、限流、监控告警、灰度怎么做？ | `java/eleme-java-backend-round1.md`; `sf/2026-05-25-sf-java-backend-round1-round2.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md` | 原 #121 |
| 171 | 项目 | 如何证明一个项目不是 CRUD？复杂度、指标、故障和取舍怎么讲？ | `ai-agent/amap-agent-backend-intern-interview.md`; `java/baidu-java-backend-round1-shezhao.md`; `java/eleme-java-backend-round1.md` | 原 #123 |
| 172 | 项目 | 项目接口并发量、QPS、RT、错误率怎么描述？没有真实上线数据怎么办？ | `java/baidu-java-backend-round1-shezhao.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `ai-agent/backend-to-agent-transition.md` | 原 #124 |
| 173 | 项目 | 线上故障复盘怎么讲？定位、止血、根因、修复、预防分别是什么？ | `java/arthas-diagnostic-guide.md`; `middleware/senior-java-3-soul-questions.md`; `java/jd-java-backend-round2-jvm-concurrency.md` | 原 #125 |
| 174 | 项目 | 如何做灰度发布、回滚、监控告警和链路追踪？ | `sf/2026-05-25-sf-java-backend-round1-round2.md`; `java/eleme-java-backend-round1.md`; `java/baidu-java-backend-final-round.md` | 原 #126 |
| 175 | 项目 | 订单状态机怎么设计？状态流转、幂等、防回退怎么保证？ | `ai-agent/amap-agent-backend-intern-interview.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md`; `sf/2026-05-25-sf-java-backend-round1-round2.md` | 原 #127 |
| 176 | 项目 | 对账系统怎么设计？长短款、幂等、补偿、重试怎么做？ | `sf/2026-05-25-sf-java-backend-round1-round2.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md`; `java/spring-three-level-cache-circular-dependency.md` | 原 #128 |
| 177 | MySQL | InnoDB 和 MyISAM 的区别是什么？为什么生产常用 InnoDB？ | `java/cainiao-java-backend-round2-mysql.md`; `kuaishou/2026-05-25-kuaishou-backend-java-round1-mysql.md`; `middleware/vipshop-java-interview.md` | 原 #129 |
| 178 | MySQL | count 查询怎么优化？`count(*)`、`count(1)`、`count(col)` 有什么区别？ | `middleware/大厂SQL高频题第2期.md`; `middleware/后端慢SQL优化面经.md`; `java/cainiao-java-backend-round2-mysql.md` | 原 #130 |
| 179 | MySQL | ORDER BY 和 GROUP BY 如何利用索引？什么时候会 filesort/temporary？ | `java/2026-05-18-youzan-java-ai-interview.md`; `middleware/后端慢SQL优化面经.md`; `java/cainiao-java-backend-round2-mysql.md` | 原 #131 |
| 180 | MySQL | 分库分表怎么设计？分片键、扩容、跨分片查询怎么处理？ | `ai-agent/amap-agent-backend-intern-interview.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md`; `sf/2026-05-25-sf-java-backend-round1-round2.md` | 原 #132 |
| 181 | MySQL | 读写分离有什么坑？主从延迟、读己之写、强制走主怎么做？ | `ai-agent/amap-agent-backend-intern-interview.md`; `middleware/腾讯后端开发社招强度.md`; `java/baidu-java-backend-final-round.md` | 原 #133 |
| 182 | MySQL | 千万级表在线加字段怎么做？Online DDL、gh-ost、pt-osc 怎么选？ | `middleware/zhihu-mysql-add-column-online-ddl.md`; `middleware/后端慢SQL优化面经.md`; `java/cainiao-java-backend-round2-mysql.md` | 原 #134 |
| 183 | Redis | Redis 内存淘汰策略有哪些？volatile/allkeys、LRU/LFU 怎么选？ | `java/hupu-java-backend-round2-redis-distributed.md`; `middleware/Redis事务与原子性原理深度解析.md`; `java/megvii-java-round1-12-questions.md` | 原 #135 |
| 184 | Redis | Redis 过期删除策略是什么？定期删除、惰性删除和内存淘汰有什么关系？ | `java/hupu-java-backend-round2-redis-distributed.md`; `middleware/Redis事务与原子性原理深度解析.md`; `java/megvii-java-round1-12-questions.md` | 原 #136 |
| 185 | Redis | Redis Lua 为什么能保证原子性？脚本太慢会有什么风险？ | `middleware/Redis事务与原子性原理深度解析.md`; `practice/10-distributed-lock.md`; `ai-agent/amap-agent-backend-intern-interview.md` | 原 #137 |
| 186 | Redis | Redis 事务 MULTI/EXEC/WATCH 和 Lua 的区别是什么？ | `middleware/Redis事务与原子性原理深度解析.md`; `java/hupu-java-backend-round2-redis-distributed.md`; `practice/10-distributed-lock.md` | 原 #138 |
| 187 | Redis | Redis 秒杀库存预扣怎么设计？库存回补和超卖怎么处理？ | `java/eleme-java-backend-round1.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md`; `java/baidu-java-backend-round1-shezhao.md` | 原 #139 |
| 188 | Redis | Redis 限流怎么做？固定窗口、滑动窗口、令牌桶、漏桶怎么选？ | `java/2026-05-18-youzan-java-ai-interview.md`; `java/megvii-java-round1-12-questions.md`; `java/spring-concurrency-throttle-interceptor.md` | 原 #140 |
| 189 | MQ | Kafka 分区机制和 key 路由怎么设计？如何保证同一订单有序？ | `practice/22-kafka-consumer-group-rebalance.md`; `ai-agent/amap-agent-backend-intern-interview.md`; `middleware/rocketmq-kafka-transaction-ordering.md` | 原 #141 |
| 190 | MQ | Kafka ISR、acks、min.insync.replicas 如何影响可靠性？ | `practice/22-kafka-consumer-group-rebalance.md`; `java/2026-05-18-youzan-java-ai-interview.md`; `middleware/rocketmq-kafka-transaction-ordering.md` | 原 #142 |
| 191 | MQ | Kafka Exactly Once 语义是什么？幂等生产者和事务分别解决什么？ | `practice/22-kafka-consumer-group-rebalance.md`; `middleware/rocketmq-kafka-transaction-ordering.md`; `java/2026-05-18-youzan-java-ai-interview.md` | 原 #143 |
| 192 | MQ | 延迟队列怎么实现？RabbitMQ、RocketMQ、时间轮、Redis ZSet 怎么选？ | `java/eleme-java-backend-round1.md`; `tencent/2026-05-25-wxg-wechat-pay-backend-round2.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md` | 原 #145 |
| 193 | MQ | 消息重试如何避免打爆下游？退避、死信、限流、人工补偿怎么做？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/eleme-java-backend-round1.md`; `middleware/rocketmq-kafka-transaction-ordering.md` | 原 #146 |
| 194 | Spring | `@Lazy`、构造器注入、原型 Bean 为什么会影响循环依赖？ | `java/spring-three-level-cache-circular-dependency.md`; `practice/15-spring-ioc-bean-lifecycle-circular-dependency.md`; `java/spring-three-level-cache-source-code.md` | 原 #148 |
| 195 | Spring | BeanPostProcessor、InitializingBean、Aware 接口在生命周期中顺序如何？ | `practice/15-spring-ioc-bean-lifecycle-circular-dependency.md`; `java/baidu-java-backend-round1.md`; `java/spring-three-level-cache-source-code.md` | 原 #149 |
| 196 | Spring | MyBatis 和 Spring 事务如何整合？SqlSession、连接绑定怎么做？ | `java/alibaba-backend-java-final-round-framework.md`; `java/baidu-java-backend-round2.md`; `practice/16-spring-transaction-propagation-internals.md` | 原 #150 |
| 197 | Spring | Spring Cloud Gateway 或网关层限流、鉴权、灰度怎么设计？ | `java/eleme-java-backend-round1.md`; `java/spring-concurrency-throttle-interceptor.md`; `middleware/vipshop-java-interview.md` | 原 #151 |
| 198 | JVM | GC Roots 有哪些？可达性分析和引用类型怎么结合？ | `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `practice/05-jvm-full-gc-troubleshooting.md` | 原 #152 |
| 199 | JVM | 强软弱虚引用分别什么时候回收？ThreadLocal 弱引用为什么还会泄漏？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/pdd-java-backend-round1-concurrency.md`; `middleware/2026-06-01-jvm-core-principles-troubleshooting.md` | 原 #153 |
| 200 | JVM | 标记清除、标记整理、复制算法的区别和碎片问题怎么讲？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `java/jd-java-backend-round2-jvm-concurrency.md` | 原 #154 |
| 201 | JVM | CPU 飙高怎么排查？`top -Hp`、jstack、Arthas 怎么串起来？ | `java/arthas-diagnostic-guide.md`; `practice/05-jvm-full-gc-troubleshooting.md`; `java/jd-java-backend-round2-jvm-concurrency.md` | 原 #155 |
| 202 | JVM | 类卸载和 Metaspace OOM 怎么排查？ | `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `java/arthas-diagnostic-guide.md`; `java/jd-java-backend-round2-jvm-concurrency.md` | 原 #156 |
| 203 | Java 并发 | synchronized 锁升级：无锁、偏向锁、轻量级锁、重量级锁怎么讲？ | `tencent/2026-05-27-tencent-cloud-final-round.md`; `java/jd-java-backend-round2-jvm-concurrency.md`; `practice/02-synchronized-vs-reentrantlock.md` | 原 #157 |
| 204 | Java 并发 | CAS 的 ABA 问题怎么解决？AtomicStampedReference 和版本号怎么用？ | `tencent/2026-05-27-tencent-cloud-final-round.md`; `middleware/lock-free-queue-deep-dive.md`; `java/pdd-java-backend-round1-concurrency.md` | 原 #158 |
| 205 | Java 并发 | 无锁队列怎么设计？CAS、内存屏障、Disruptor 思想怎么讲？ | `middleware/lock-free-queue-deep-dive.md`; `java/java-concurrency-5-optimization-tips.md`; `java/jd-java-backend-round2-jvm-concurrency.md` | 原 #159 |
| 206 | Java 并发 | CountDownLatch、CyclicBarrier、Semaphore 的区别和使用场景？ | `java/jd-java-backend-round2-jvm-concurrency.md`; `java/pdd-java-backend-round1-concurrency.md`; `java/java-concurrency-5-optimization-tips.md` | 原 #160 |
| 207 | Java 并发 | 虚拟线程、平台线程、Go 协程的调度差异是什么？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `middleware/Minimax-Go面试复盘.md`; `java/java-concurrency-5-optimization-tips.md` | 原 #161 |
| 208 | 网络 | HTTPS 握手流程是什么？TLS、证书、对称/非对称加密怎么配合？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `java/baidu-java-backend-round1-shezhao.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md` | 原 #162 |
| 209 | 网络 | TCP 粘包/拆包是什么？Netty 如何处理？ | `java/eleme-java-backend-round1.md`; `middleware/Minimax-Go面试复盘.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md` | 原 #163 |
| 210 | 网络 | HTTP/1.1、HTTP/2、HTTP/3 的区别是什么？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md` | 原 #164 |
| 211 | OS | 死锁产生条件、避免方式和银行家算法怎么讲？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `java/pdd-java-backend-round1-concurrency.md`; `java/baidu-java-backend-round1-shezhao.md` | 原 #165 |
| 212 | OS | IO 多路复用 select/poll/epoll 区别是什么？Redis/Netty 为什么用它？ | `java/megvii-java-round1-12-questions.md`; `middleware/Minimax-Go面试复盘.md`; `java/eleme-java-backend-round1.md` | 原 #166 |
| 213 | OS | 进程间通信方式有哪些？管道、消息队列、共享内存、socket 怎么选？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/baidu-java-backend-round1-shezhao.md`; `middleware/Minimax-Go面试复盘.md` | 原 #167 |
| 214 | 分布式 | Nacos 注册发现、配置中心和服务健康检查怎么工作？ | `java/eleme-java-backend-round1.md`; `java/baidu-java-backend-final-round.md`; `middleware/腾讯瑞驰后端Java二面面经.md` | 原 #168 |
| 215 | 分布式 | Dubbo 调用链路、负载均衡、超时重试和幂等风险怎么讲？ | `java/baidu-java-backend-round2.md`; `java/baidu-java-backend-final-round.md`; `middleware/腾讯瑞驰后端Java二面面经.md` | 原 #169 |
| 216 | 分布式 | 配置中心动态刷新怎么设计？一致性和灰度怎么处理？ | `java/eleme-java-backend-round1.md`; `sf/2026-05-25-sf-java-backend-round1-round2.md`; `java/baidu-java-backend-final-round.md` | 原 #170 |
| 217 | 系统设计 | 搜索系统怎么设计？ES 倒排索引、分词、排序、召回怎么做？ | `java/2026-05-18-youzan-java-ai-interview.md`; `ai-agent/rag-hybrid-search-meilisearch.md`; `java/baidu-java-backend-final-round.md` | 原 #171 |
| 218 | 系统设计 | 文件上传/大文件分片上传怎么设计？秒传、断点续传、校验怎么做？ | `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md`; `sf/2026-05-25-sf-java-backend-round1-round2.md` | 原 #172 |
| 219 | 系统设计 | 订单超时自动取消怎么设计？延迟队列、时间轮、定时扫描怎么选？ | `java/eleme-java-backend-round1.md`; `tencent/2026-05-25-wxg-wechat-pay-backend-round2.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md` | 原 #173 |
| 220 | 系统设计 | 支付防重和防重复扣款怎么设计？幂等号、状态机、唯一索引怎么做？ | `sf/2026-05-25-sf-java-backend-round1-round2.md`; `middleware/vipshop-java-interview.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md` | 原 #174 |
| 221 | 算法 | 字符串填充组合计数怎么做？DP 状态如何设计？ | `ai-agent/alibaba-dp-string-fill-count.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 原 #194 |
| 222 | 算法 | 二叉树层序遍历、路径和、最近公共祖先怎么准备？ | `java/baidu-java-backend-round1-shezhao.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 原 #195 |
| 223 | 算法 | 滑动窗口类题怎么总结？无重复子串、最小覆盖、固定窗口怎么区分？ | `java/eleme-java-backend-round1.md`; `middleware/vipshop-java-interview.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 原 #196 |
| 224 | 算法 | DP 面试题怎么讲状态、转移、初始化和空间优化？ | `ai-agent/alibaba-dp-string-fill-count.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `tencent/2026-05-25-wxg-wechat-pay-backend-round2.md` | 原 #197 |
| 225 | 算法 | 链表题怎么准备？反转链表、倒数第 K 个、合并链表怎么写？ | `tiktok/2026-05-27-tiktok-ecommerce-backend-round1.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/eleme-java-backend-round1.md` | 原 #198 |
| 226 | 算法 | TopK、高频词、堆排序和快速选择怎么讲？ | `middleware/京东上岸Java岗面经48题.md`; `java/baidu-java-backend-final-round.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` | 原 #199 |

## 抽题规则

1. 每次抽题前执行 `git fetch origin`，检查当前分支、远端提交、实际 practice 文件和最近会话。
2. `✅ 已完成` 的题不重复；`🟡 已练习，待补档` 的题先补文件，不重新面试。
3. 每次提供 1～3 道候选题，只给题目和来源，不提前给答案。
4. 用户回答后由实时面试会话负责评分、完整答案和追问记录。
5. Hermes 的最终修正版存在疑点时，进入 `codex gpt 修复点.md` 审计。

---
