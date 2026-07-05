# 面试刷题练习记录

> 开始时间：2026-05-28
> 题池范围：以 `active-batch-plan.md` 当前内容为准，不使用固定总数
> 用法：每次练习 2-3 题，一道一个文件，记录问答过程 + 打分 + 薄弱点

---

## 得分总览

| 题号 | 方向 | 文件 | 得分 |
|------|------|------|------|
| 1 | Java线程池 | [01-thread-pool-core-params.md](01-thread-pool-core-params.md) | 4/10 |
| 2 | synchronized vs ReentrantLock | [02-synchronized-vs-reentrantlock.md](02-synchronized-vs-reentrantlock.md) | 3/10 |
| 3 | Redis RDB vs AOF | [03-redis-rdb-vs-aof.md](03-redis-rdb-vs-aof.md) | 5/10 |
| 4 | RAG检索索引 | [04-rag-retrieval-indices.md](04-rag-retrieval-indices.md) | 1/10 |
| 5 | JVM Full GC排查 | [05-jvm-full-gc-troubleshooting.md](05-jvm-full-gc-troubleshooting.md) | 4/10 |
| 6 | MVCC多版本并发控制 | [06-mvcc.md](06-mvcc.md) | 2/10 |
| 7 | AQS Lock/tryLock | [07-lock-vs-trylock-aqs.md](07-lock-vs-trylock-aqs.md) | — |
| 8 | ReAct vs CoT | [08-react-pattern-vs-cot.md](08-react-pattern-vs-cot.md) | 7/10 |
| 9 | 分布式事务 | [09-distributed-transaction.md](09-distributed-transaction.md) | 2/10 |
| 10 | 分布式锁 | [10-distributed-lock.md](10-distributed-lock.md) | 3/10 |
| 11 | MySQL复合索引 | [11-mysql-composite-index.md](11-mysql-composite-index.md) | 2/10 |
| 12 | MySQL慢SQL | [12-mysql-slow-sql.md](12-mysql-slow-sql.md) | 4/10 |
| 13 | 缓存穿透/击穿/雪崩 | [13-redis-cache-penetration-breakdown-avalanche.md](13-redis-cache-penetration-breakdown-avalanche.md) | 4/10 |
| 14 | Redis分布式锁深入 | [14-redis-distributed-lock-deep.md](14-redis-distributed-lock-deep.md) | 7/10 |
| 15 | Spring Bean生命周期+三级缓存循环依赖 | [15-spring-ioc-bean-lifecycle-circular-dependency.md](15-spring-ioc-bean-lifecycle-circular-dependency.md) | 4/10 |
| 16 | Spring事务传播机制 | [16-spring-transaction-propagation-internals.md](16-spring-transaction-propagation-internals.md) | 6/10 |
| 17 | HashMap底层JDK7/8+红黑树 | [17-hashmap底层-jdk7-8-红黑树.md](17-hashmap底层-jdk7-8-红黑树.md) | 5/10 |
| 18 | ConcurrentHashMap | [18-concurrent-hashmap.md](18-concurrent-hashmap.md) | — |
| 19 | RAG系统设计 | [19-rag-system-design.md](19-rag-system-design.md) | 5/10 |
| 20 | Agent架构设计+ReAct | [20-agent-architecture-react.md](20-agent-architecture-react.md) | 7/10 |
| 21 | MCP协议 vs Function Calling vs Tool | [21-mcp-protocol-vs-function-calling.md](21-mcp-protocol-vs-function-calling.md) | 8.5/10 |
| 22 | Kafka消费者组+Rebalance+消息丢失/重复消费 | [22-kafka-consumer-group-rebalance.md](22-kafka-consumer-group-rebalance.md) | — |
| 23 | MySQL EXPLAIN执行计划 | [23-mysql-explain-execution-plan.md](23-mysql-explain-execution-plan.md) | — |
| 24 | Redis Cache Aside Pattern | [24-cache-aside-pattern.md](24-cache-aside-pattern.md) | — |
| 25 | 高并发库存扣减防超卖 | [25-inventory-oversell-prevention.md](25-inventory-oversell-prevention.md) | — |
| 26 | volatile/synchronized/CAS/JMM | [26-volatile-synchronized-cas-jmm.md](26-volatile-synchronized-cas-jmm.md) | 3.5/10 |
| 27 | Spring AOP代理+事务失效 | [27-spring-aop-proxy-transaction.md](27-spring-aop-proxy-transaction.md) | 7/10 |
| 28 | RabbitMQ可靠投递+死信队列 | [28-rabbitmq-reliable-delivery-dead-letter.md](28-rabbitmq-reliable-delivery-dead-letter.md) | 5/10 |
| 29 | InnoDB间隙锁+Next-Key Lock | [29-innodb-gap-lock-next-key-lock.md](29-innodb-gap-lock-next-key-lock.md) | 6/10 |
| 31 | JVM类加载+双亲委派 | [31-jvm-classloading-parent-delegation.md](31-jvm-classloading-parent-delegation.md) | 4.5/10 |
| 32 | Agent Memory设计 | [32-agent-memory-design.md](32-agent-memory-design.md) | 5.5/10 |
| 33 | 秒杀系统设计 | [33-seckill-system-design.md](33-seckill-system-design.md) | 5/10 |
| 34 | ArrayList/LinkedList/HashMap/ConcurrentHashMap | [34-arraylist-linkedlist-hashmap-concurrent-hashmap.md](34-arraylist-linkedlist-hashmap-concurrent-hashmap.md) | 5/10 |
| 36 | Spring Boot 自动装配原理 | [36-spring-boot-auto-configuration.md](36-spring-boot-auto-configuration.md) | 4/10 |
| 37 | MySQL redo/undo/binlog + 两阶段提交 | [37-redo-undo-binlog-two-phase-commit.md](37-redo-undo-binlog-two-phase-commit.md) | 3/10 |
| 38 | Redis Cluster/Sentinel + 主从切换一致性 | [38-redis-cluster-sentinel-consistency.md](38-redis-cluster-sentinel-consistency.md) | 4/10 |
| 39 | RocketMQ 事务/延时/顺序消息 | [39-rocketmq-transaction-delay-ordered.md](39-rocketmq-transaction-delay-ordered.md) | 4/10 |
| 40 | Harness/Eval/Framework/MCP 边界 | [40-harness-eval-framework-mcp-boundary.md](40-harness-eval-framework-mcp-boundary.md) | 4/10 |
| 41 | LangGraph 状态图 vs ReAct | [41-langgraph-state-machine-vs-react.md](41-langgraph-state-machine-vs-react.md) | 0/10 |
| 42 | RAG 评测与优化 | [42-rag-evaluation-optimization.md](42-rag-evaluation-optimization.md) | 1/10 |
| 43 | JVM 对象分配流程 | [43-jvm-object-allocation-tlab-eden-gc.md](43-jvm-object-allocation-tlab-eden-gc.md) | 5/10 |
| 44 | CAP/BASE/Raft | [44-cap-base-raft.md](44-cap-base-raft.md) | 3/10 |
| 45 | LRU/LFU 缓存实现 | [45-lru-lfu-cache-implementation.md](45-lru-lfu-cache-implementation.md) | 1/10 |
| 46 | ThreadLocal 原理与泄漏 | [46-threadlocal-memory-leak-threadpool.md](46-threadlocal-memory-leak-threadpool.md) | 3/10 |
| 47 | CompletableFuture 异步编程 | [47-completable-future-async-programming.md](47-completable-future-async-programming.md) | 3/10 |
| 48 | MySQL 深分页优化 | [48-deep-pagination-optimization.md](48-deep-pagination-optimization.md) | 5/10 |
| 49 | Redis ZSet/Bitmap/HyperLogLog | [49-redis-data-structures-zset-bitmap-hyperloglog.md](49-redis-data-structures-zset-bitmap-hyperloglog.md) | 3/10 |
| 50 | Spring Boot 限流拦截器 | [50-spring-boot-rate-limiting-interceptor.md](50-spring-boot-rate-limiting-interceptor.md) | — |
| 51 | G1/ZGC/CMS 垃圾收集器 | [51-g1-zgc-cms-garbage-collectors.md](51-g1-zgc-cms-garbage-collectors.md) | — |
| 52 | 分布式ID方案 | [52-distributed-id-snowflake-segment-redis-autoincrement.md](52-distributed-id-snowflake-segment-redis-autoincrement.md) | — |
| 53 | 购物车系统设计 | [53-shopping-cart-design-sync.md](53-shopping-cart-design-sync.md) | 5/10 |
| 54 | 优惠券/满减活动规则和库存设计 | [54-coupon-discount-rules-inventory-design.md](54-coupon-discount-rules-inventory-design.md) | 4/10 |

> 平均分由看板根据当前有评分文件实时计算，README 不保存易过期汇总值。

> 编号说明：第 30、35 题已有会话记录但缺少独立文件，暂列为“待补档”；历史上存在两个第 25 题文件，后续整理时保留来源并重新编号，当前不覆盖原记录。

---

## 薄弱知识点汇总

- [ ] 线程池执行流程（核心考点）
- [ ] AQS 公平/非公平源码
- [ ] synchronized 三种使用方式
- [ ] Condition 多条件唤醒机制
- [ ] RDB/AOF 全称
- [ ] fork() 内存翻倍
- [ ] AOF rewrite 机制
- [ ] 混合持久化
- [ ] RAG 检索索引类型
- [ ] BM25 稀疏检索原理
- [ ] 混合检索 + RRF 融合
- [ ] jstat 命令
- [ ] MAT 分析 dump 文件
- [ ] GC 参数调优（G1/ZGC 配置）
- [ ] Spring 事务传播和挂起机制
- [ ] HashMap treeify 条件和扩容细节
- [ ] ConcurrentHashMap size/addCount/扩容协作
- [ ] RAG 全链路设计和评测
- [ ] Agent 架构、Tool Use、Harness 概念边界
- [ ] Kafka 消费者组、Rebalance、事务和 RocketMQ 事务消息区别

---

## 质量审计

- [../codex gpt 修复点.md](../codex%20gpt%20修复点.md)：记录 Codex/GPT 对 practice 标准答案的修复点，重点看“Agent 纠错是否正确”。
