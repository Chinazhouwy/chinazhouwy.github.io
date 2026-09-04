---
title: "Spring Batch 入门到实战：从定时循环到可恢复的批处理系统"
date: "2026-09-04"
importedAt: "2026-09-04"
domain: "学习"
area: "Java 后端"
module: "Spring 生态"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "Spring Batch 核心领域模型、chunk 处理、skip/retry/restart 失败分类、测试与可观测性的完整学习笔记。"
tags:
  - "Spring Batch"
  - "批处理"
  - "Spring Boot"
  - "幂等"
  - "事务"
---

# Spring Batch 入门到实战：从定时循环到可恢复的批处理系统

> **类型**：📚 参考资料（非面试题/面经）
> **来源公众号**：编程拾录
> **原文链接**：[https://mp.weixin.qq.com/s/BMrfKXqvrggKGtZfc9A41A](https://mp.weixin.qq.com/s/BMrfKXqvrggKGtZfc9A41A)
> **发布日期**：2026-09-04

---

## 核心观点

Spring Batch 解决的不是"怎么写 for 循环"，而是**"怎么定义一次可恢复、可审计、可测试的批处理运行"**。

很多团队的批处理从 `@Scheduled` + for 循环开始，第一次生产事故后才暴露问题：
- 任务跑到一半进程退出，下次从哪里继续？
- 某行数据格式坏了，跳过还是整批失败？
- 数据库死锁，重试几次？
- 同一天任务被重复触发，会不会重复入库？
- 昨晚处理了多少条、失败了多少条？

## 一、什么场景值得引入（三问判断法）

1. **有没有明确的批次边界？**（导入一个文件 / 处理某日交易 / 生成某账期账单）
2. **失败后是否需要继续、重跑或回滚？**（重复执行会造成脏数据就需要运行状态 + 幂等）
3. **运行结果是否需要审计？**（读/写/跳过计数、失败在哪一步）

三个都不需要时，`@Scheduled` 或普通命令行程序更合适——Spring Batch 引入元数据表、作业参数、事务边界的复杂度只有在"批处理运行本身需要被管理"时才值得。

**典型场景**：CSV/Excel 导入、账单生成、订单对账、批量补偿、离线报表、历史数据迁移、外部系统同步。

**分工**：Quartz / CronJob / 调度系统负责"什么时候启动"；Spring Batch 负责"这一次批处理如何可靠运行"。它不替代实时流处理，也不是调度平台。

## 二、领域模型（最重要的抽象）

| 概念 | 含义 |
|---|---|
| **Job** | 批处理作业定义（如"导入客户 CSV"），描述做什么，不是某一次运行 |
| **JobParameters** | 一次运行的输入参数（输入文件、业务日期） |
| **JobInstance** | Job + 一组识别实例的参数；同一 Job 处理不同日期数据 = 不同 Instance |
| **JobExecution** | 某个 JobInstance 的一次执行尝试；失败后修复重启 = 新 execution 同 instance |
| **Step / StepExecution** | 作业里的一个阶段；Execution 记录该阶段的读写数、跳过数、提交/回滚次数 |
| **ExecutionContext** | 提交点保存的上下文（reader 读到哪、中间状态），重启时据此继续 |
| **JobRepository** | 运行账本：状态持久化、重启判断、执行统计、并发实例控制的根基 |

**关键认知**：批处理的"身份"不是进程 ID 或方法调用，而是业务上那一次应被追踪和恢复的运行。

## 三、最小可运行示例（Spring Batch 6.x / Spring Boot 4.x 风格）

依赖：`spring-boot-starter-batch` + `spring-boot-starter-jdbc` + 数据库（入门可用 H2，生产需显式管理元数据表迁移）。

```java
@Configuration
class HelloBatchJobConfiguration {
    @Bean
    Job helloJob(JobRepository jobRepository, Step helloStep) {
        return new JobBuilder("helloJob", jobRepository)
                .start(helloStep)
                .build();
    }

    @Bean
    Step helloStep(JobRepository jobRepository,
                   PlatformTransactionManager tm) {
        return new StepBuilder("helloStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    System.out.println("Hello Spring Batch");
                    return RepeatStatus.FINISHED;
                }, tm)
                .build();
    }
}
```

**两个实践要点**：
- 长期运行的 Web 服务里用 `spring.batch.job.enabled=false` 关闭启动自动跑批，改为显式触发（命令行/管理接口/调度器）。
- 显式构造业务参数（`inputFile`、`businessDate`），**不要随手塞随机时间戳**绕过重复运行保护——是否允许重跑应由作业参数 + 幂等策略共同决定。

## 四、Chunk 模型：读、处理、写与事务边界

三角色：`ItemReader<T>`（一次读一个 item）→ `ItemProcessor<I,O>`（可选，校验/清洗/转换）→ `ItemWriter<O>`（一次写出一个 chunk）。

**commit-interval 不只是性能参数**，同时影响四件事：

| 维度 | 影响 |
|---|---|
| 事务开销 | 太小 → 提交次数多 |
| 失败重放范围 | 太大 → 失败时当前 chunk 内更多数据要重新处理 |
| 内存占用 | writer 写出前，chunk 内 item 需暂存 |
| 锁持有时间 | 大事务可能扩大数据库锁竞争 |

入门从 100 或 500 起步，再按 item 大小、写入方式、数据库压力和恢复成本压测调整。

## 五、实战案例：客户 CSV 导入与清洗入库

**reader**（`@StepScope` 让 bean 在 Step 执行时创建，可读当次 JobParameters）：

```java
@Bean
@StepScope
FlatFileItemReader<CustomerCsvRow> customerReader(
        @Value("#{jobParameters['inputFile']}") String inputFile) {
    return new FlatFileItemReaderBuilder<CustomerCsvRow>()
            .name("customerCsvReader")
            .resource(new FileSystemResource(inputFile))
            .linesToSkip(1)
            .delimited()
            .names("external_id", "name", "email", "mobile")
            .fieldSetMapper(fieldSet -> new CustomerCsvRow(
                    fieldSet.readString("external_id"),
                    fieldSet.readString("name"),
                    fieldSet.readString("email"),
                    fieldSet.readString("mobile")))
            .build();
}
```

**processor**：校验邮箱/手机号正则、trim、转小写；不合法直接抛 `ValidationException`，是否跳过由 Step 的 fault-tolerant 配置决定。

**writer**：`JdbcBatchItemWriter` 批量写入；生产环境必须把唯一键、幂等语义和重复导入策略说清楚（upsert 或先删后写），不能只用普通 insert。

**Step 装配（配置背后的语义比代码更重要）**：

```java
return new StepBuilder("importCustomerStep", jobRepository)
        .<CustomerCsvRow, Customer>chunk(100, transactionManager)
        .reader(customerReader)
        .processor(customerProcessor)
        .writer(customerWriter)
        .faultTolerant()
        .skip(FlatFileParseException.class)
        .skip(ValidationException.class)
        .skipLimit(100)
        .retry(DeadlockLoserDataAccessException.class)
        .retryLimit(3)
        .build();
```

`FlatFileParseException`（行解析不了）和 `ValidationException`（读得出但业务不接受）归为 **skip**——"这条数据可隔离，整批不必失败"；`DeadlockLoserDataAccessException` 归为 **retry**——"同一条数据稍后再试可能成功"。**两类错误不能混**。

## 六、失败不是一种：skip / retry / restart 三分法

| 类型 | 适用 | 注意 |
|---|---|---|
| **skip（可跳过）** | 数据层坏 item：缺字段、格式不合法、外部编码不存在 | 是业务决策不是"忽略异常"；若跳过会影响财务结算就不该悄悄跳过，先让 Step 失败，业务确认阈值后再配 skipLimit |
| **retry（可重试）** | 暂态故障：死锁、网络抖动、限流 | 对确定性错误无意义（邮箱格式错重试三次也不会对），滥用会放大耗时和下游压力 |
| **restart（可重启）** | 本次执行应失败但修复后可从上次状态继续：代码 bug、依赖长时间不可用、输入文件缺失 | 能否可靠取决于 reader 能否保存位置、writer 是否幂等、业务写入无重复副作用 |

**容易忽略的点**：Spring Batch 能记录执行状态，但不能替你定义业务幂等。"发短信""调外部扣款接口"这类不可逆副作用，必须有业务流水号、状态表或外部幂等键。

## 七、让作业可测试（不要只测 processor）

processor 单测覆盖转换/校验规则，但证明不了 reader/writer/事务/skip/retry/元数据配置能协同工作。测试分层原则：

1. processor 规则 → 快单测
2. reader/writer 映射 → 小文件 + 临时数据库
3. Job 级测试 → 真实 Step 编排、事务、错误策略（`@SpringBatchTest`，6.0 后以 JUnit Jupiter 为主）
4. **重启测试** → 制造一次中途失败，验证二次运行不重复写入已提交数据

> 如果作业没有重启测试，最好不要轻易声称它"支持断点续跑"。

## 八、可观察性（不是最后加几行日志）

`JobExecution` / `StepExecution` 已记录开始/结束时间、状态、退出码、read/write/skip/rollback count。最少要能回答：

- 本次作业参数是什么？
- 哪个 Step 失败？
- 读/写/跳过多少条？跳过的数据和原因？
- 是否发生过重试和回滚？
- 这次能否重启，还是必须人工清理后重跑？

用 `StepExecutionListener.afterStep()` 输出统计；生产环境接入统一日志、指标、告警。**失败告警至少带上 job name、instance parameters、step name、exit status、execution id**。事故里恢复最快的人是"能最快判断失败在哪一批、哪一步、哪些数据已提交"的人。

## 九、从能用到能扛量（先定位瓶颈再并行）

单线程不够时有：多线程 Step、并行 Step、分区、远程分区。**先定位瓶颈**：

- reader 慢 → SQL 索引/分页方式/远程读取
- processor 慢 → CPU 密集？可缓存基础数据？
- writer 慢 → 批量写入不足？锁竞争/唯一键冲突？
- 外部系统慢 → 限流/异步化/预拉取

并发会改变失败模型：多线程要检查 reader/writer 线程安全；分区要检查分片边界稳定性；并行 Step 要确认无隐藏顺序依赖。**先解决 SQL、索引、chunk 大小、批量写、事务边界，并行化才是优化而不是放大事故**。幂等也要重新审视：单线程不明显的重复写在并发下可能变成竞态；文件顺序在分区后可能不再稳定。

## 十、落地检查清单（按顺序推进）

1. **定义批次身份**：哪些 JobParameters 决定同一个 JobInstance
2. **拆分阶段**：哪些是独立 Step，哪些只是 processor 内部逻辑
3. **选择输入输出**：文件/数据库/消息/远程 API 分别用什么 reader/writer
4. **定义事务边界**：chunk 多大、writer 是否批量写、副作用可否回滚
5. **分类失败**：哪些 skip、哪些 retry、哪些必须失败等重启
6. **设计幂等**：重复运行/重启/并发执行会不会重复写入或重复调用外部系统
7. **补测试**：processor 单测、Step 测试、Job 级测试、失败重启测试
8. **补观测**：运行参数、执行状态、计数、错误样本、告警字段
9. **做演练**：坏文件、半程失败、暂态错误、重复触发验证真实行为

## 结语

Spring Batch 入门最容易的坑是把它当成一组 reader/writer 工具类。真正的价值在于：它把一次批处理运行建模成**有身份、有状态、有阶段、有事务边界、有恢复策略的系统**。

关键不是记住所有 API，而是每个批处理需求前问出正确的问题：这一次运行如何被识别、如何被记录、如何失败、如何恢复、又如何证明它真的处理对了。

---

## 参考资料

- Spring Batch Reference: The Domain Language of Batch / Chunk-oriented Processing / The Commit Interval / Configuring Skip Logic / Configuring Retry Logic / Item Reader and Writer Implementations / Scaling and Parallel Processing / Unit Testing
- Spring Boot Reference: Spring Batch

> 原始链接：[https://mp.weixin.qq.com/s/BMrfKXqvrggKGtZfc9A41A](https://mp.weixin.qq.com/s/BMrfKXqvrggKGtZfc9A41A)
