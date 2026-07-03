# 后续抽题计划（23-200）

> 基线提交点：`00cf77fa4354eca3fac184b49d2a7ccf1d707455`
> 基线说明：截至该提交，`practice/01` 到 `practice/22` 已完成，后续抽题从第 23 题开始。
> 后续规则：每次继续抽题前，先执行 `git fetch origin`，对比 `00cf77fa4354eca3fac184b49d2a7ccf1d707455..origin/master` 之后是否有 Hermes 新增题目或新资料；如果有，先把新增内容纳入来源，再继续从未完成题号抽。

---

## 已完成

| 范围 | 状态 |
|------|------|
| 1-22 | 已完成，暂不重复抽 |
| 23-122 | 核心 100 道母题 |
| 123-200 | 补充题池，覆盖边角题、低频题、手撕题和项目拷打题 |

---

## 核心 100 道（23-122）

| 题号 | 方向 | 题目 | 来源 |
|------|------|------|------|
| 23 | MySQL | Explain 怎么判断 SQL 是否走索引？`type/key/rows/Extra` 分别怎么看？ | `ai-agent/amap-agent-backend-intern-interview.md`; `middleware/vipshop-java-interview.md`; `java/cainiao-java-backend-round2-mysql.md` |
| 24 | Redis | 更新 DB 后删缓存为什么推荐？极端不一致怎么兜底？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `middleware/vipshop-java-interview.md`; `ai-agent/amap-agent-backend-intern-interview.md` |
| 25 | 分布式 | 高并发库存扣减如何防超卖？乐观锁、悲观锁、Redis、MQ 怎么取舍？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/eleme-java-backend-round1.md`; `java/baidu-java-backend-round1-shezhao.md` |
| 26 | Java 并发 | `volatile`、`synchronized`、CAS 和 JMM 的关系是什么？ | `middleware/vipshop-java-interview.md`; `tencent/2026-05-27-tencent-cloud-final-round.md`; `java/pdd-java-backend-round1-concurrency.md` |
| 27 | Spring | Spring AOP 代理原理是什么？JDK 动态代理和 CGLIB 怎么选？事务为什么会失效？ | `middleware/vipshop-java-interview.md`; `java/baidu-java-backend-round1.md`; `java/baidu-java-backend-round2.md` |
| 28 | MQ | RabbitMQ 如何保证可靠投递、可靠消费、死信队列和幂等？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/eleme-java-backend-round1.md` |
| 29 | MySQL | InnoDB 行锁、间隙锁、next-key lock 和死锁排查怎么讲？ | `java/cainiao-java-backend-round2-mysql.md`; `tencent/2026-05-27-tencent-cloud-final-round.md`; `practice/06-mvcc.md` |
| 30 | Redis | Redis 热点 Key、大 Key、缓存击穿的生产处理方案？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/megvii-java-round1-12-questions.md`; `middleware/vipshop-java-interview.md` |
| 31 | JVM | JVM 类加载机制、双亲委派和打破双亲委派怎么回答？ | `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `java/eleme-java-backend-round1.md`; `java/baidu-java-backend-round2-concurrency.md` |
|| 32 | AI Agent | Agent Memory 怎么设计？短期、长期、摘要、向量记忆如何取舍？（✅ 已完成） | `tencent/2026-06-07-wxg-wechat-pay-cool-jing.md`; `ai-agent/bytedance-agent-interview-round2.md`; `ai-agent/backend-to-agent-transition.md` |
|| 33 | 系统设计 | 秒杀系统怎么设计？限流、削峰、库存一致性、订单异步化怎么做？（✅ 已完成） | `java/eleme-java-backend-round1.md`; `java/megvii-java-round1-12-questions.md`; `tiktok/2026-05-27-tiktok-ecommerce-backend-round1.md` |
|| 34 | Java 集合 | ArrayList、LinkedList、HashMap、ConcurrentHashMap 如何选？（✅ 已完成） | `middleware/vipshop-java-interview.md`; `java/meitu-backend-server-round1.md`; `java/megvii-java-round1-12-questions.md` |
| 35 | Java 并发 | AQS 原理：`state`、CLH 队列、独占/共享模式怎么讲？ | `practice/07-lock-vs-trylock-aqs.md`; `java/pdd-java-backend-round1-concurrency.md`; `java/jd-java-backend-round2-jvm-concurrency.md` |
| 36 | Spring | Spring Boot 自动装配原理是什么？Boot 2 和 Boot 3 有什么变化？ | `middleware/vipshop-java-interview.md`; `java/baidu-java-backend-round1.md`; `java/spring-boot-async-4-patterns.md` |
| 37 | MySQL | redo log、undo log、binlog 分别干什么？两阶段提交是什么？ | `ai-agent/amap-agent-backend-intern-interview.md`; `java/cainiao-java-backend-round2-mysql.md`; `middleware/rocketmq-kafka-transaction-ordering.md` |
| 38 || Redis | Redis Cluster 和 Sentinel 的区别？主从切换有什么一致性风险？（✅ 已完成） | `java/hupu-java-backend-round2-redis-distributed.md`; `practice/10-distributed-lock.md`; `practice/14-redis-distributed-lock-deep.md` |
| 39 || MQ | RocketMQ 事务消息、延时消息和顺序消息怎么实现？（✅ 已完成） | `middleware/rocketmq-kafka-transaction-ordering.md`; `java/eleme-java-backend-round1.md`; `practice/22-kafka-consumer-group-rebalance.md` |
| 40 || AI Agent | Harness 到底是什么？和 Eval、Agent Framework、MCP 的边界是什么？（✅ 已完成） | `codex gpt 修复点.md`; `ai-agent/alibaba-fliggy-backend-interview.md`; `industry/2026-05-25-deepseek-agent-harness-hiring.md` |
| 41 || AI Agent | LangGraph 的状态图执行模型是什么？和普通 ReAct Loop 有什么区别？（✅ 已完成） | `ai-agent/langgraph-state-machine-engine.md`; `ai-agent/bytedance-agent-interview-round2.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 42 || RAG | RAG 如何评测和优化？召回率、精排、幻觉率怎么设计指标？（✅ 已完成） | `practice/19-rag-system-design.md`; `ai-agent/taotian-ai-agent-interview.md`; `ai-agent/bytedance-agent-interview-round2.md` |
| 43 || JVM | 对象分配流程：TLAB、Eden、Minor GC、老年代晋升怎么讲？（✅ 已完成） | `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `java/jd-java-backend-round2-jvm-concurrency.md`; `java/megvii-java-round1-12-questions.md` |
||| 44 || 分布式 | CAP、BASE、Raft 怎么回答？和业务最终一致性有什么关系？（✅ 已完成） | `java/eleme-java-backend-round1.md`; `middleware/rocketmq-kafka-transaction-ordering.md`; `java/baidu-java-backend-round1-shezhao.md` |
||| 45 || 算法 | LRU 缓存 O(1) 怎么手写？线程安全版本怎么设计？（✅ 已完成） | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `ai-agent/amap-agent-backend-intern-interview.md`; `middleware/vipshop-java-interview.md` |
||| 46 || Java 并发 | ThreadLocal 原理、内存泄漏和线程池复用问题怎么回答？（✅ 已完成） | `java/pdd-java-backend-round1-concurrency.md`; `middleware/vipshop-java-interview.md`; `java/baidu-java-backend-round2.md` |
||| 47 || Java 并发 | CompletableFuture 怎么用？异常处理、超时和线程池隔离怎么做？（✅ 已完成） | `java/eleme-java-backend-round1.md`; `ai-agent/completable-future-production-pitfalls.md`; `java/jd-java-backend-round2-jvm-concurrency.md` |
| 48 | MySQL | 深分页怎么优化？覆盖索引、延迟关联、游标翻页怎么选？ | `middleware/后端慢SQL优化面经.md`; `java/cainiao-java-backend-round2-mysql.md`; `middleware/大厂SQL高频题第2期.md` |
| 49 | Redis | Redis 常用数据结构底层和场景：ZSet、Bitmap、HyperLogLog 怎么用？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/megvii-java-round1-12-questions.md`; `java/hupu-java-backend-round2-redis-distributed.md` |
| 50 | Spring | Spring Boot 限流拦截器怎么设计？令牌桶、漏桶、滑动窗口怎么落地？ | `java/spring-concurrency-throttle-interceptor.md`; `java/megvii-java-round1-12-questions.md`; `java/eleme-java-backend-round1.md` |
| 51 | JVM | G1、ZGC、CMS 的区别和适用场景是什么？ | `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `java/jd-java-backend-round2-jvm-concurrency.md`; `tencent/2026-05-27-tencent-cloud-final-round.md` |
| 52 | 分布式 | 分布式 ID 方案：雪花算法、号段、Redis、自增 ID 怎么选？ | `java/baidu-java-backend-round1-shezhao.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md`; `java/baidu-java-backend-final-round.md` |
| 53 | 系统设计 | 购物车系统怎么设计？未登录用户跨设备怎么同步？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `tiktok/2026-05-27-tiktok-ecommerce-backend-round1.md` |
| 54 | 系统设计 | 优惠券/满减活动规则和库存怎么设计？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md`; `java/baidu-java-backend-round1-shezhao.md` |
| 55 | AI Agent | 超长上下文冗余怎么优化？摘要、裁剪、子 Agent 怎么取舍？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `ai-agent/backend-to-agent-transition.md`; `ai-agent/claude-code-dynamic-workflows.md` |
| 56 | AI Agent | MCP、RAG、Skill 三者区别和组合方式是什么？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `practice/21-mcp-protocol-vs-function-calling.md`; `ai-agent/agentium-mcp-execution-mechanism.md` |
| 57 | AI Agent | Agent 评测体系怎么设计？任务成功率、工具调用准确率、幻觉率怎么测？ | `ai-agent/bytedance-agent-interview-round2.md`; `codex gpt 修复点.md`; `ai-agent/agent-interview-questions-summary.md` |
| 58 | 网络/OS | TCP 三次握手、WebSocket vs HTTP 轮询怎么讲？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/baidu-java-backend-round1-shezhao.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 59 | 算法 | 合并 K 个升序链表怎么写？复杂度是多少？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 60 | 算法 | 最长无重复子串 / 最长回文子串怎么写？ | `java/eleme-java-backend-round1.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 61 | MySQL | B+ 树为什么适合数据库索引？和 B 树、红黑树有什么区别？ | `java/2026-05-18-youzan-java-ai-interview.md`; `java/cainiao-java-backend-round2-mysql.md`; `kuaishou/2026-05-25-kuaishou-backend-java-round1-mysql.md` |
| 62 | MySQL | 索引失效有哪些场景？函数、隐式转换、LIKE、OR 分别怎么处理？ | `java/cainiao-java-backend-round2-mysql.md`; `middleware/vipshop-java-interview.md`; `java/2026-05-18-youzan-java-ai-interview.md` |
| 63 | MySQL | 事务隔离级别有哪些？RC 和 RR 下 Read View 有什么区别？ | `java/cainiao-java-backend-round2-mysql.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `practice/06-mvcc.md` |
| 64 | MySQL | MySQL 主从复制、binlog 格式和延迟问题怎么处理？ | `middleware/腾讯后端开发社招强度.md`; `middleware/zhihu-mysql-add-column-online-ddl.md`; `java/baidu-java-backend-final-round.md` |
| 65 | Redis | Redis 为什么快？单线程、IO 多路复用、网络模型怎么讲？ | `java/megvii-java-round1-12-questions.md`; `middleware/Redis事务与原子性原理深度解析.md`; `java/hupu-java-backend-round2-redis-distributed.md` |
| 66 | Redis | Redis 持久化 RDB/AOF/混合持久化怎么选？大实例 fork 有什么问题？ | `practice/03-redis-rdb-vs-aof.md`; `java/megvii-java-round1-12-questions.md`; `java/hupu-java-backend-round2-redis-distributed.md` |
| 67 | Redis | 布隆过滤器如何解决缓存穿透？误判率和删除问题怎么处理？ | `practice/13-redis-cache-penetration-breakdown-avalanche.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/2026-05-18-youzan-java-ai-interview.md` |
| 68 | Redis | Redis Pub/Sub、Stream、List 做消息队列有什么区别？ | `tiktok/2026-05-27-tiktok-ecommerce-backend-round1.md`; `middleware/Redis事务与原子性原理深度解析.md`; `java/hupu-java-backend-round2-redis-distributed.md` |
| 69 | MQ | Kafka 消息堆积怎么处理？扩分区、扩消费者、限流分别怎么做？ | `ai-agent/amap-agent-backend-intern-interview.md`; `java/2026-05-18-youzan-java-ai-interview.md`; `practice/22-kafka-consumer-group-rebalance.md` |
| 70 | MQ | MQ 如何保证消息不丢、不重、不乱序？ | `java/eleme-java-backend-round1.md`; `middleware/rocketmq-kafka-transaction-ordering.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md` |
| 71 | MQ | 本地消息表、事务消息、CDC Outbox 分别怎么实现最终一致性？ | `practice/22-kafka-consumer-group-rebalance.md`; `middleware/rocketmq-kafka-transaction-ordering.md`; `java/eleme-java-backend-round1.md` |
| 72 | Spring | Spring IOC 核心思想是什么？BeanFactory 和 ApplicationContext 有什么区别？ | `java/baidu-java-backend-round1.md`; `java/alibaba-backend-java-final-round-framework.md`; `java/spring-three-level-cache-source-code.md` |
| 73 | Spring | Spring Bean 三级缓存为什么能解决循环依赖？哪些场景解决不了？ | `java/spring-three-level-cache-circular-dependency.md`; `practice/15-spring-ioc-bean-lifecycle-circular-dependency.md`; `java/alibaba-backend-java-final-round-framework.md` |
| 74 | Spring | `@Transactional` 默认回滚规则是什么？checked exception 怎么配置回滚？ | `practice/16-spring-transaction-propagation-internals.md`; `java/baidu-java-backend-round1.md`; `java/baidu-java-backend-round2.md` |
| 75 | Spring | SpringMVC 请求执行流程是什么？`DispatcherServlet` 做了什么？ | `java/baidu-java-backend-round1.md`; `java/baidu-java-backend-round2.md` |
| 76 | Java 并发 | 线程池 7 大参数、队列选择、拒绝策略和 OOM 风险怎么讲？ | `practice/01-thread-pool-core-params.md`; `java/pdd-java-backend-round1-concurrency.md`; `java/2026-05-18-youzan-java-ai-interview.md` |
| 77 | Java 并发 | 为什么不推荐 Executors？生产线程池怎么命名、监控和隔离？ | `java/pdd-java-backend-round1-concurrency.md`; `java/2026-05-18-youzan-java-ai-interview.md`; `java/java-concurrency-5-optimization-tips.md` |
| 78 | Java 并发 | 死锁产生的四个条件是什么？线上死锁怎么排查？ | `java/pdd-java-backend-round1-concurrency.md`; `java/baidu-java-backend-round1-shezhao.md`; `java/arthas-diagnostic-guide.md` |
| 79 | Java 并发 | ReentrantLock 公平锁/非公平锁、Condition、多条件队列怎么讲？ | `practice/02-synchronized-vs-reentrantlock.md`; `practice/07-lock-vs-trylock-aqs.md`; `java/jd-java-backend-round2-jvm-concurrency.md` |
| 80 | Java 集合 | HashMap JDK7/JDK8 扩容差异、红黑树化条件和线程不安全怎么讲？ | `practice/17-hashmap底层-jdk7-8-红黑树.md`; `middleware/vipshop-java-interview.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 81 | Java 集合 | ConcurrentHashMap JDK7/JDK8 区别、size 统计和扩容协助怎么讲？ | `practice/18-concurrent-hashmap.md`; `middleware/vipshop-java-interview.md`; `tencent/2026-05-27-tencent-cloud-final-round.md` |
| 82 | JVM | JVM 内存区域怎么划分？哪些区域会 OOM？ | `java/jd-java-backend-round2-jvm-concurrency.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `middleware/2026-06-01-jvm-core-principles-troubleshooting.md` |
| 83 | JVM | 线上 OOM 怎么排查？MAT、jmap、jstack、Arthas 怎么用？ | `practice/05-jvm-full-gc-troubleshooting.md`; `java/arthas-diagnostic-guide.md`; `java/jd-java-backend-round2-jvm-concurrency.md` |
| 84 | JVM | Minor GC 和 Full GC 区别是什么？什么对象会进入老年代？ | `java/megvii-java-round1-12-questions.md`; `java/jd-java-backend-round2-jvm-concurrency.md`; `middleware/2026-06-01-jvm-core-principles-troubleshooting.md` |
| 85 | 分布式 | 2PC、TCC、Saga、本地消息表、Seata AT 怎么选？ | `practice/09-distributed-transaction.md`; `java/eleme-java-backend-round1.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md` |
| 86 | 分布式 | 分布式锁 Redis、Zookeeper、数据库实现各有什么问题？ | `practice/10-distributed-lock.md`; `practice/14-redis-distributed-lock-deep.md`; `java/eleme-java-backend-round1.md` |
| 87 | 分布式 | 幂等设计怎么做？唯一索引、token、状态机、去重表怎么选？ | `middleware/vipshop-java-interview.md`; `java/eleme-java-backend-round1.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md` |
| 88 | 分布式 | 服务注册发现原理是什么？Nacos 和 Eureka 有什么区别？ | `java/eleme-java-backend-round1.md`; `java/baidu-java-backend-final-round.md` |
| 89 | 微服务 | 熔断、降级、限流分别是什么？Sentinel 怎么落地？ | `java/eleme-java-backend-round1.md`; `java/spring-concurrency-throttle-interceptor.md`; `java/megvii-java-round1-12-questions.md` |
| 90 | 系统设计 | 短链接系统怎么设计？ID 生成、防冲突、缓存和过期怎么做？ | `java/baidu-java-backend-final-round.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md` |
| 91 | 系统设计 | 分布式定时任务怎么设计？时间轮、分片、幂等怎么做？ | `java/baidu-java-backend-final-round.md`; `tencent/2026-05-25-wxg-wechat-pay-backend-round2.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md` |
| 92 | 系统设计 | 日志高并发落盘怎么设计？缓冲、批量、异步、背压怎么做？ | `tencent/2026-05-25-wxg-wechat-pay-backend-round2.md`; `middleware/senior-java-3-soul-questions.md` |
| 93 | 系统设计 | 多级缓存怎么设计？本地缓存、Redis、DB 的一致性怎么保证？ | `java/2026-05-18-youzan-java-ai-interview.md`; `middleware/vipshop-java-interview.md`; `java/megvii-java-round1-12-questions.md` |
| 94 | AI Agent | Agent 和普通 LLM 调用有什么区别？工具、记忆、规划分别是什么？ | `tencent/2026-06-07-wxg-wechat-pay-cool-jing.md`; `practice/20-agent-architecture-react.md`; `ai-agent/agent-interview-questions-summary.md` |
| 95 | AI Agent | ReAct 原理和工程落地怎么讲？什么时候会循环失败？ | `practice/08-react-pattern-vs-cot.md`; `practice/20-agent-architecture-react.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 96 | AI Agent | Function Calling、Tool Use、Workflow、MCP 的边界是什么？ | `practice/21-mcp-protocol-vs-function-calling.md`; `practice/20-agent-architecture-react.md`; `ai-agent/agentium-mcp-execution-mechanism.md` |
| 97 | RAG | RAG 完整流程怎么讲？离线索引和在线检索分别做什么？ | `practice/19-rag-system-design.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/2026-05-18-youzan-java-ai-interview.md` |
| 98 | RAG | 向量检索、BM25、混合检索、RRF、Reranker 分别解决什么问题？ | `practice/04-rag-retrieval-indices.md`; `practice/19-rag-system-design.md`; `ai-agent/rag-hybrid-search-meilisearch.md` |
| 99 | RAG | RAG 幻觉怎么治理？检索无关、答案编造、引用错误怎么处理？ | `java/2026-05-18-youzan-java-ai-interview.md`; `ai-agent/bytedance-agent-interview-round2.md`; `ai-agent/taotian-ai-agent-interview.md` |
| 100 | AI Agent | 多 Agent 协作怎么设计？主从、对等、层级、竞争模式怎么选？ | `practice/20-agent-architecture-react.md`; `ai-agent/agent-interview-questions-summary.md`; `ai-agent/claude-code-dynamic-workflows.md` |
| 101 | AI Agent | Claude Code 为什么更偏 grep/工具检索，而不是直接 RAG 检索代码？ | `ai-agent/claude-code-grep-vs-rag-code-retrieval.md`; `ai-agent/backend-to-agent-transition.md` |
| 102 | AI Agent | AI Coding Agent 的沙箱、权限、上下文压缩和错误恢复怎么设计？ | `ai-agent/AI-Coding-Agent-技术参考文档.md`; `ai-agent/backend-to-agent-transition.md`; `codex gpt 修复点.md` |
| 103 | AI Agent | LangGraph checkpoint、状态恢复、人机协作节点怎么讲？ | `ai-agent/langgraph-state-machine-engine.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 104 | AI Agent | Agent 项目如何做 Badcase 闭环？日志、trace、评测集、回流怎么做？ | `ai-agent/bytedance-agent-interview-round2.md`; `ai-agent/taotian-ai-agent-interview.md`; `codex gpt 修复点.md` |
| 105 | AI Agent | Agent 安全怎么做？工具权限、Prompt 注入、数据泄露、人工审核怎么防？ | `ai-agent/2026-05-25-kimi-frontend-agent-interview-detailed.md`; `ai-agent/alibaba-intl-ai-agent-interview.md`; `ai-agent/AgentScope-Java-1.1.0-Harness-Framework.md` |
| 106 | 前端/AI | SSE、WebSocket、流式输出和 Generative UI 怎么设计？ | `frontend/ai-agent-frontend-interview.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md` |
| 107 | 网络 | 从 URL 输入到页面展示完整链路怎么讲？DNS、TCP、TLS、HTTP 分别做什么？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `java/baidu-java-backend-round1-shezhao.md` |
| 108 | OS | 进程和线程核心区别是什么？Python 多进程为什么能绕过 GIL？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/baidu-java-backend-round1-shezhao.md` |
| 109 | Go/语言 | Go GMP 调度模型怎么讲？和 Java 线程池、虚拟线程有什么区别？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `middleware/Minimax-Go面试复盘.md` |
| 110 | 语言基础 | Java、Python、Go 的运行模型和适用场景怎么对比？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `middleware/Minimax-Go面试复盘.md` |
| 111 | 算法 | 二叉树路径和等于 K，输出所有路径怎么写？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 112 | 算法 | 数组找局部峰值元素怎么做？二分为什么成立？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 113 | 算法 | 解码数字串 LC91 怎么做？DP 状态怎么定义？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 114 | 算法 | 有效括号、最长无重复子串如何手写并说明复杂度？ | `java/eleme-java-backend-round1.md` |
| 115 | 算法 | 不用加减乘除求和、LIS、LRU 三连怎么准备？ | `tencent/2026-05-25-wxg-wechat-pay-backend-round2.md` |
| 116 | 项目 | 项目性能瓶颈怎么定位？慢 SQL、外部调用、锁竞争、GC 怎么排？ | `ai-agent/amap-agent-backend-intern-interview.md`; `java/baidu-java-backend-round1-shezhao.md`; `java/megvii-java-round1-12-questions.md` |
| 117 | 项目 | 项目中最大技术难点是什么？如何讲清方案、取舍和效果数据？ | `java/baidu-java-backend-round1-shezhao.md`; `java/eleme-java-backend-round1.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 118 | 项目 | 后端项目如何结合 AI Agent？RAG、工具调用、权限和审计怎么落地？ | `ai-agent/backend-to-agent-transition.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `ai-agent/bytedance-ai-agent-backend-round1.md` |
| 119 | 项目 | AI 辅助写代码在公司里怎么用？Spec、Plan、Agent Mode 怎么区分？ | `ai-agent/amap-agent-backend-intern-interview.md`; `ai-agent/backend-to-agent-transition.md`; `ai-agent/claude-code-dynamic-workflows.md` |
| 120 | 架构 | 单机十万 QPS 系统怎么设计？线程模型、缓存、限流、异步化怎么做？ | `tencent/2026-05-27-tencent-cloud-final-round.md`; `middleware/senior-java-3-soul-questions.md`; `java/baidu-java-backend-final-round.md` |
| 121 | 架构 | 高可用系统怎么设计？降级、熔断、限流、监控告警、灰度怎么做？ | `java/eleme-java-backend-round1.md`; `sf/2026-05-25-sf-java-backend-round1-round2.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md` |
| 122 | 架构 | 从后端转 AI Agent 岗，怎么讲自己的技术路线和项目价值？ | `ai-agent/backend-to-agent-transition.md`; `ai-agent/后端转Agent开发学习路线.md`; `ai-agent/ai-agent-learning-roadmap.md` |

---

## 补充题池（123-200）

| 题号 | 方向 | 题目 | 来源 |
|------|------|------|------|
| 123 | 项目 | 如何证明一个项目不是 CRUD？复杂度、指标、故障和取舍怎么讲？ | `ai-agent/amap-agent-backend-intern-interview.md`; `java/baidu-java-backend-round1-shezhao.md`; `java/eleme-java-backend-round1.md` |
| 124 | 项目 | 项目接口并发量、QPS、RT、错误率怎么描述？没有真实上线数据怎么办？ | `java/baidu-java-backend-round1-shezhao.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `ai-agent/backend-to-agent-transition.md` |
| 125 | 项目 | 线上故障复盘怎么讲？定位、止血、根因、修复、预防分别是什么？ | `java/arthas-diagnostic-guide.md`; `middleware/senior-java-3-soul-questions.md`; `java/jd-java-backend-round2-jvm-concurrency.md` |
| 126 | 项目 | 如何做灰度发布、回滚、监控告警和链路追踪？ | `sf/2026-05-25-sf-java-backend-round1-round2.md`; `java/eleme-java-backend-round1.md`; `java/baidu-java-backend-final-round.md` |
| 127 | 项目 | 订单状态机怎么设计？状态流转、幂等、防回退怎么保证？ | `ai-agent/amap-agent-backend-intern-interview.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md`; `sf/2026-05-25-sf-java-backend-round1-round2.md` |
| 128 | 项目 | 对账系统怎么设计？长短款、幂等、补偿、重试怎么做？ | `sf/2026-05-25-sf-java-backend-round1-round2.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md`; `java/spring-three-level-cache-circular-dependency.md` |
| 129 | MySQL | InnoDB 和 MyISAM 的区别是什么？为什么生产常用 InnoDB？ | `java/cainiao-java-backend-round2-mysql.md`; `kuaishou/2026-05-25-kuaishou-backend-java-round1-mysql.md`; `middleware/vipshop-java-interview.md` |
| 130 | MySQL | count 查询怎么优化？`count(*)`、`count(1)`、`count(col)` 有什么区别？ | `middleware/大厂SQL高频题第2期.md`; `middleware/后端慢SQL优化面经.md`; `java/cainiao-java-backend-round2-mysql.md` |
| 131 | MySQL | ORDER BY 和 GROUP BY 如何利用索引？什么时候会 filesort/temporary？ | `java/2026-05-18-youzan-java-ai-interview.md`; `middleware/后端慢SQL优化面经.md`; `java/cainiao-java-backend-round2-mysql.md` |
| 132 | MySQL | 分库分表怎么设计？分片键、扩容、跨分片查询怎么处理？ | `ai-agent/amap-agent-backend-intern-interview.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md`; `sf/2026-05-25-sf-java-backend-round1-round2.md` |
| 133 | MySQL | 读写分离有什么坑？主从延迟、读己之写、强制走主怎么做？ | `ai-agent/amap-agent-backend-intern-interview.md`; `middleware/腾讯后端开发社招强度.md`; `java/baidu-java-backend-final-round.md` |
| 134 | MySQL | 千万级表在线加字段怎么做？Online DDL、gh-ost、pt-osc 怎么选？ | `middleware/zhihu-mysql-add-column-online-ddl.md`; `middleware/后端慢SQL优化面经.md`; `java/cainiao-java-backend-round2-mysql.md` |
| 135 | Redis | Redis 内存淘汰策略有哪些？volatile/allkeys、LRU/LFU 怎么选？ | `java/hupu-java-backend-round2-redis-distributed.md`; `middleware/Redis事务与原子性原理深度解析.md`; `java/megvii-java-round1-12-questions.md` |
| 136 | Redis | Redis 过期删除策略是什么？定期删除、惰性删除和内存淘汰有什么关系？ | `java/hupu-java-backend-round2-redis-distributed.md`; `middleware/Redis事务与原子性原理深度解析.md`; `java/megvii-java-round1-12-questions.md` |
| 137 | Redis | Redis Lua 为什么能保证原子性？脚本太慢会有什么风险？ | `middleware/Redis事务与原子性原理深度解析.md`; `practice/10-distributed-lock.md`; `ai-agent/amap-agent-backend-intern-interview.md` |
| 138 | Redis | Redis 事务 MULTI/EXEC/WATCH 和 Lua 的区别是什么？ | `middleware/Redis事务与原子性原理深度解析.md`; `java/hupu-java-backend-round2-redis-distributed.md`; `practice/10-distributed-lock.md` |
| 139 | Redis | Redis 秒杀库存预扣怎么设计？库存回补和超卖怎么处理？ | `java/eleme-java-backend-round1.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md`; `java/baidu-java-backend-round1-shezhao.md` |
| 140 | Redis | Redis 限流怎么做？固定窗口、滑动窗口、令牌桶、漏桶怎么选？ | `java/2026-05-18-youzan-java-ai-interview.md`; `java/megvii-java-round1-12-questions.md`; `java/spring-concurrency-throttle-interceptor.md` |
| 141 | MQ | Kafka 分区机制和 key 路由怎么设计？如何保证同一订单有序？ | `practice/22-kafka-consumer-group-rebalance.md`; `ai-agent/amap-agent-backend-intern-interview.md`; `middleware/rocketmq-kafka-transaction-ordering.md` |
| 142 | MQ | Kafka ISR、acks、min.insync.replicas 如何影响可靠性？ | `practice/22-kafka-consumer-group-rebalance.md`; `java/2026-05-18-youzan-java-ai-interview.md`; `middleware/rocketmq-kafka-transaction-ordering.md` |
| 143 | MQ | Kafka Exactly Once 语义是什么？幂等生产者和事务分别解决什么？ | `practice/22-kafka-consumer-group-rebalance.md`; `middleware/rocketmq-kafka-transaction-ordering.md`; `java/2026-05-18-youzan-java-ai-interview.md` |
| 144 | MQ | RocketMQ 和 Kafka 在日志模型、消费模型、事务消息上的本质区别？ | `practice/22-kafka-consumer-group-rebalance.md`; `middleware/rocketmq-kafka-transaction-ordering.md`; `java/eleme-java-backend-round1.md` |
| 145 | MQ | 延迟队列怎么实现？RabbitMQ、RocketMQ、时间轮、Redis ZSet 怎么选？ | `java/eleme-java-backend-round1.md`; `tencent/2026-05-25-wxg-wechat-pay-backend-round2.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md` |
| 146 | MQ | 消息重试如何避免打爆下游？退避、死信、限流、人工补偿怎么做？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/eleme-java-backend-round1.md`; `middleware/rocketmq-kafka-transaction-ordering.md` |
| 147 | Spring | `@Async` 的坑有哪些？线程池、事务、异常、上下文传递怎么处理？ | `java/spring-boot-async-4-patterns.md`; `java/spring-concurrency-throttle-interceptor.md`; `java/eleme-java-backend-round1.md` |
| 148 | Spring | `@Lazy`、构造器注入、原型 Bean 为什么会影响循环依赖？ | `java/spring-three-level-cache-circular-dependency.md`; `practice/15-spring-ioc-bean-lifecycle-circular-dependency.md`; `java/spring-three-level-cache-source-code.md` |
| 149 | Spring | BeanPostProcessor、InitializingBean、Aware 接口在生命周期中顺序如何？ | `practice/15-spring-ioc-bean-lifecycle-circular-dependency.md`; `java/baidu-java-backend-round1.md`; `java/spring-three-level-cache-source-code.md` |
| 150 | Spring | MyBatis 和 Spring 事务如何整合？SqlSession、连接绑定怎么做？ | `java/alibaba-backend-java-final-round-framework.md`; `java/baidu-java-backend-round2.md`; `practice/16-spring-transaction-propagation-internals.md` |
| 151 | Spring | Spring Cloud Gateway 或网关层限流、鉴权、灰度怎么设计？ | `java/eleme-java-backend-round1.md`; `java/spring-concurrency-throttle-interceptor.md`; `middleware/vipshop-java-interview.md` |
| 152 | JVM | GC Roots 有哪些？可达性分析和引用类型怎么结合？ | `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `practice/05-jvm-full-gc-troubleshooting.md` |
| 153 | JVM | 强软弱虚引用分别什么时候回收？ThreadLocal 弱引用为什么还会泄漏？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/pdd-java-backend-round1-concurrency.md`; `middleware/2026-06-01-jvm-core-principles-troubleshooting.md` |
| 154 | JVM | 标记清除、标记整理、复制算法的区别和碎片问题怎么讲？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `java/jd-java-backend-round2-jvm-concurrency.md` |
| 155 | JVM | CPU 飙高怎么排查？`top -Hp`、jstack、Arthas 怎么串起来？ | `java/arthas-diagnostic-guide.md`; `practice/05-jvm-full-gc-troubleshooting.md`; `java/jd-java-backend-round2-jvm-concurrency.md` |
| 156 | JVM | 类卸载和 Metaspace OOM 怎么排查？ | `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`; `java/arthas-diagnostic-guide.md`; `java/jd-java-backend-round2-jvm-concurrency.md` |
| 157 | Java 并发 | synchronized 锁升级：无锁、偏向锁、轻量级锁、重量级锁怎么讲？ | `tencent/2026-05-27-tencent-cloud-final-round.md`; `java/jd-java-backend-round2-jvm-concurrency.md`; `practice/02-synchronized-vs-reentrantlock.md` |
| 158 | Java 并发 | CAS 的 ABA 问题怎么解决？AtomicStampedReference 和版本号怎么用？ | `tencent/2026-05-27-tencent-cloud-final-round.md`; `middleware/lock-free-queue-deep-dive.md`; `java/pdd-java-backend-round1-concurrency.md` |
| 159 | Java 并发 | 无锁队列怎么设计？CAS、内存屏障、Disruptor 思想怎么讲？ | `middleware/lock-free-queue-deep-dive.md`; `java/java-concurrency-5-optimization-tips.md`; `java/jd-java-backend-round2-jvm-concurrency.md` |
| 160 | Java 并发 | CountDownLatch、CyclicBarrier、Semaphore 的区别和使用场景？ | `java/jd-java-backend-round2-jvm-concurrency.md`; `java/pdd-java-backend-round1-concurrency.md`; `java/java-concurrency-5-optimization-tips.md` |
| 161 | Java 并发 | 虚拟线程、平台线程、Go 协程的调度差异是什么？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `middleware/Minimax-Go面试复盘.md`; `java/java-concurrency-5-optimization-tips.md` |
| 162 | 网络 | HTTPS 握手流程是什么？TLS、证书、对称/非对称加密怎么配合？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `java/baidu-java-backend-round1-shezhao.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md` |
| 163 | 网络 | TCP 粘包/拆包是什么？Netty 如何处理？ | `java/eleme-java-backend-round1.md`; `middleware/Minimax-Go面试复盘.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md` |
| 164 | 网络 | HTTP/1.1、HTTP/2、HTTP/3 的区别是什么？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md` |
| 165 | OS | 死锁产生条件、避免方式和银行家算法怎么讲？ | `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `java/pdd-java-backend-round1-concurrency.md`; `java/baidu-java-backend-round1-shezhao.md` |
| 166 | OS | IO 多路复用 select/poll/epoll 区别是什么？Redis/Netty 为什么用它？ | `java/megvii-java-round1-12-questions.md`; `middleware/Minimax-Go面试复盘.md`; `java/eleme-java-backend-round1.md` |
| 167 | OS | 进程间通信方式有哪些？管道、消息队列、共享内存、socket 怎么选？ | `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/baidu-java-backend-round1-shezhao.md`; `middleware/Minimax-Go面试复盘.md` |
| 168 | 分布式 | Nacos 注册发现、配置中心和服务健康检查怎么工作？ | `java/eleme-java-backend-round1.md`; `java/baidu-java-backend-final-round.md`; `middleware/腾讯瑞驰后端Java二面面经.md` |
| 169 | 分布式 | Dubbo 调用链路、负载均衡、超时重试和幂等风险怎么讲？ | `java/baidu-java-backend-round2.md`; `java/baidu-java-backend-final-round.md`; `middleware/腾讯瑞驰后端Java二面面经.md` |
| 170 | 分布式 | 配置中心动态刷新怎么设计？一致性和灰度怎么处理？ | `java/eleme-java-backend-round1.md`; `sf/2026-05-25-sf-java-backend-round1-round2.md`; `java/baidu-java-backend-final-round.md` |
| 171 | 系统设计 | 搜索系统怎么设计？ES 倒排索引、分词、排序、召回怎么做？ | `java/2026-05-18-youzan-java-ai-interview.md`; `ai-agent/rag-hybrid-search-meilisearch.md`; `java/baidu-java-backend-final-round.md` |
| 172 | 系统设计 | 文件上传/大文件分片上传怎么设计？秒传、断点续传、校验怎么做？ | `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md`; `sf/2026-05-25-sf-java-backend-round1-round2.md` |
| 173 | 系统设计 | 订单超时自动取消怎么设计？延迟队列、时间轮、定时扫描怎么选？ | `java/eleme-java-backend-round1.md`; `tencent/2026-05-25-wxg-wechat-pay-backend-round2.md`; `chayanyuese/2026-05-25-chayanyuese-java-round2-system-design.md` |
| 174 | 系统设计 | 支付防重和防重复扣款怎么设计？幂等号、状态机、唯一索引怎么做？ | `sf/2026-05-25-sf-java-backend-round1-round2.md`; `middleware/vipshop-java-interview.md`; `chayanyuese/2026-05-26-chayanyuese-java-round2-scenario-35k.md` |
| 175 | 系统设计 | 客服机器人/智能客服系统怎么设计？RAG、工单、人工转接怎么做？ | `ai-agent/ctrip-ai-agent-interview.md`; `frontend/ai-agent-frontend-interview.md`; `ai-agent/taotian-ai-agent-interview.md` |
| 176 | 系统设计 | 推荐/导购 Agent 怎么设计？用户画像、召回、排序、工具调用怎么结合？ | `ai-agent/ctrip-ai-agent-interview.md`; `ai-agent/taobao-flashsale-ai-dev-round1.md`; `ai-agent/heytea-ai-app-interview.md` |
| 177 | AI Agent | Workflow 和完全自主 Agent 怎么取舍？生产为什么常用混合模式？ | `ai-agent/ctrip-ai-agent-interview.md`; `practice/20-agent-architecture-react.md`; `ai-agent/langgraph-state-machine-engine.md` |
| 178 | AI Agent | 规则链路和大模型链路怎么取舍？哪些场景不该用大模型？ | `ai-agent/ctrip-ai-agent-interview.md`; `ai-agent/taotian-ai-agent-interview.md`; `practice/20-agent-architecture-react.md` |
| 179 | AI Agent | RAG + Function Calling 混合链路怎么设计？离线知识和实时接口如何组合？ | `ai-agent/ctrip-ai-agent-interview.md`; `practice/21-mcp-protocol-vs-function-calling.md`; `practice/19-rag-system-design.md` |
| 180 | AI Agent | 文档版本、有效期、权限和更新机制怎么设计？ | `ai-agent/ctrip-ai-agent-interview.md`; `ai-agent/bytedance-agent-interview-round2.md`; `practice/19-rag-system-design.md` |
| 181 | AI Agent | SFT、LoRA、RLHF、RAG 分别适合什么？为什么知识更新不建议靠微调？ | `ai-agent/ctrip-ai-agent-interview.md`; `ai-agent/taotian-ai-agent-interview.md`; `practice/19-rag-system-design.md` |
| 182 | AI Agent | Prompt 注入攻击怎么防？系统提示、工具权限、输出校验怎么设计？ | `ai-agent/2026-05-25-kimi-frontend-agent-interview-detailed.md`; `ai-agent/alibaba-intl-ai-agent-interview.md`; `ai-agent/AgentScope-Java-1.1.0-Harness-Framework.md` |
| 183 | AI Agent | Tool 调用失败、参数错、结果为空时 Agent 怎么恢复？ | `practice/20-agent-architecture-react.md`; `ai-agent/bytedance-agent-interview-round2.md`; `codex gpt 修复点.md` |
| 184 | AI Agent | 多模型路由怎么做？小模型、深度模型、本地模型如何按场景分流？ | `ai-agent/ctrip-ai-agent-interview.md`; `ai-agent/DeepSeek超越Opus4.7的优化之道.md`; `ai-agent/taotian-ai-agent-interview.md` |
| 185 | AI Agent | Token 成本和延迟怎么优化？缓存、裁剪、摘要、批处理怎么做？ | `ai-agent/ctrip-ai-agent-interview.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `ai-agent/backend-to-agent-transition.md` |
| 186 | RAG | Chunk 分块策略怎么选？固定长度、语义分块、递归分割有什么取舍？ | `practice/19-rag-system-design.md`; `ai-agent/ctrip-ai-agent-interview.md`; `java/2026-05-18-youzan-java-ai-interview.md` |
| 187 | RAG | 查询改写、HyDE、Query Expansion 分别解决什么问题？ | `ai-agent/ctrip-ai-agent-interview.md`; `ai-agent/rag-hybrid-search-meilisearch.md`; `practice/19-rag-system-design.md` |
| 188 | RAG | 向量数据库 Milvus、Qdrant、Chroma、PGVector 怎么选？ | `practice/19-rag-system-design.md`; `ai-agent/ai-agent-learning-roadmap.md`; `ai-agent/rag-hybrid-search-meilisearch.md` |
| 189 | RAG | 知识图谱和 RAG 怎么结合？什么时候需要 Graph RAG？ | `java/2026-05-18-youzan-java-ai-interview.md`; `ai-agent/agent-interview-questions-summary.md`; `ai-agent/ctrip-ai-agent-interview.md` |
| 190 | RAG | Anti-RAG 是什么？什么时候不该用 RAG？ | `java/2026-05-18-youzan-java-ai-interview.md`; `ai-agent/ctrip-ai-agent-interview.md`; `practice/19-rag-system-design.md` |
| 191 | AI Coding | Spec Coding、Vibe Coding、Agent Mode、Yolo Mode 怎么区分？ | `ai-agent/amap-agent-backend-intern-interview.md`; `ai-agent/claude-code-dynamic-workflows.md`; `ai-agent/backend-to-agent-transition.md` |
| 192 | AI Coding | 让 AI 从 0 到 1 做电商项目，你怎么拆任务和验收？ | `ai-agent/amap-agent-backend-intern-interview.md`; `ai-agent/claude-code-dynamic-workflows.md`; `ai-agent/backend-to-agent-transition.md` |
| 193 | AI Coding | AI 生成代码怎么做安全审查？依赖、权限、测试、回滚怎么管？ | `ai-agent/AI-Coding-Agent-技术参考文档.md`; `ai-agent/backend-to-agent-transition.md`; `codex gpt 修复点.md` |
| 194 | 算法 | 字符串填充组合计数怎么做？DP 状态如何设计？ | `ai-agent/alibaba-dp-string-fill-count.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 195 | 算法 | 二叉树层序遍历、路径和、最近公共祖先怎么准备？ | `java/baidu-java-backend-round1-shezhao.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 196 | 算法 | 滑动窗口类题怎么总结？无重复子串、最小覆盖、固定窗口怎么区分？ | `java/eleme-java-backend-round1.md`; `middleware/vipshop-java-interview.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 197 | 算法 | DP 面试题怎么讲状态、转移、初始化和空间优化？ | `ai-agent/alibaba-dp-string-fill-count.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`; `tencent/2026-05-25-wxg-wechat-pay-backend-round2.md` |
| 198 | 算法 | 链表题怎么准备？反转链表、倒数第 K 个、合并链表怎么写？ | `tiktok/2026-05-27-tiktok-ecommerce-backend-round1.md`; `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/eleme-java-backend-round1.md` |
| 199 | 算法 | TopK、高频词、堆排序和快速选择怎么讲？ | `middleware/京东上岸Java岗面经48题.md`; `java/baidu-java-backend-final-round.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md` |
| 200 | 综合 | 面试最后让你总结技术优势和短板，你怎么把 Java 后端 + AI Agent 串成一条主线？ | `ai-agent/backend-to-agent-transition.md`; `ai-agent/后端转Agent开发学习路线.md`; `codex gpt 修复点.md` |

---

## 抽题规则

1. 每次抽题前，先看基线提交点之后是否有新提交：
   - `git fetch origin`
   - `git log --oneline 00cf77fa4354eca3fac184b49d2a7ccf1d707455..origin/master`
2. 如果 Hermes 已经新增了某个题号，就跳过该题号，继续抽下一个未完成题。
3. 每次只抽 1-3 道，不要解释抽题方法，直接给题目、来源、必答点和追问路线。
4. 已完成题不重复，除非用户明确要求复盘或重练。
5. Hermes 生成的标准答案如果有疑点，后续进入 `codex gpt 修复点.md` 做审计。

---

## 补充题池（201-216）— 来源：网易一面 AI Agent 面经

> 来源文件：`ai-agent/netease-ai-agent-round1.md`
> 提取日期：2026-06-15

| 题号 | 方向 | 题目 | 来源 |
|------|------|------|------|
| 201 | AI Agent | 多Agent为什么选择三层架构？不能两层或四层的理由是什么？ | `ai-agent/netease-ai-agent-round1.md` |
| 202 | AI Agent | Agent执行失败的处理逻辑是什么？重试策略、降级方案怎么设计？ | `ai-agent/netease-ai-agent-round1.md` |
| 203 | AI Agent | Agent任务拆分如何保证准确性？防幻觉的工程机制有哪些？ | `ai-agent/netease-ai-agent-round1.md` |
| 204 | AI Agent | 异步Channel机制是什么？Agent间异步通信如何实现？ | `ai-agent/netease-ai-agent-round1.md` |
| 205 | AI Agent | DAG如何检测依赖关系？循环依赖（死循环）怎么防护？ | `ai-agent/netease-ai-agent-round1.md` |
| 206 | AI Agent | Agent沙箱设计规则是什么？资源限制、权限隔离、超时控制怎么做？ | `ai-agent/netease-ai-agent-round1.md` |
| 207 | AI Agent | A2A（Agent-to-Agent）协议在项目中怎么用？其他业务Agent如何接入？ | `ai-agent/netease-ai-agent-round1.md` |
| 208 | AI Agent | LLM Wiki是什么？知识检索如何避免每次都从头开始？ | `ai-agent/netease-ai-agent-round1.md` |
| 209 | AI Agent | Agent结合业务时，安全审计怎么做？操作日志、敏感操作审批如何设计？ | `ai-agent/netease-ai-agent-round1.md` |
| 210 | AI Agent | Agent真实提效的业务场景怎么举例子？量化指标怎么描述？ | `ai-agent/netease-ai-agent-round1.md` |
| 211 | 项目 | 问答助手完整架构设计：检索策略、Prompt工程、上下文管理怎么做？ | `ai-agent/netease-ai-agent-round1.md` |
| 212 | AI Agent | 文档权限控制怎么做？细粒度权限、RBAC、操作权限如何设计？ | `ai-agent/netease-ai-agent-round1.md` |
| 213 | AI Agent | 文档增量更新机制怎么设计？版本控制、并发处理怎么做？ | `ai-agent/netease-ai-agent-round1.md` |
| 214 | 项目 | Agent项目规模：多少人在用？如何描述用户覆盖和业务价值？ | `ai-agent/netease-ai-agent-round1.md` |
| 215 | AI Agent | 多Agent架构中，任务编排和依赖管理的核心设计模式有哪些？ | `ai-agent/netease-ai-agent-round1.md` |
| 216 | RAG | 知识图谱化组织 vs 传统向量检索，什么时候需要LLM Wiki？ | `ai-agent/netease-ai-agent-round1.md` |
