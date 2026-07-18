---
title: "codex gpt 修复点"
date: "2026-07-06"
domain: "项目"
area: "自研项目"
module: ""
project: "自研项目"
type: "复盘"
status: "进行中"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "codex gpt 修复点"
tags:
---

# codex gpt 修复点

> 目标：这份文档专门记录“标准答案不能错”的修复点。你的回答可以错，追问可以幼稚，但题库/Agent 给出的纠正答案必须尽量稳。

## 先说结论

这批内容不是“没价值”，反而 `practice/` 很值钱，因为它来自真实一对一追问。现在的问题主要不是题目不行，而是 Hermes 输出有三种混在一起：

- **用户原始回答**：可以错，要保留，因为能看到薄弱点。
- **追问过程**：可以不严谨，也要保留，因为追问能暴露理解盲区。
- **标准答案/纠正答案**：必须尽量准确，不能把“通常”“可能”“取决于版本”写成绝对结论。

以后审题库时，优先看第三类。用户答错没关系，Agent 纠错错了才危险。

## 这次修了什么

| 文件 | 原问题 | 修复后口径 |
|------|--------|------------|
| `practice/03-redis-rdb-vs-aof.md` | AOF “最多丢1条”不准确 | AOF 丢数据取决于 fsync；`everysec` 通常最多丢约 1 秒写入 |
| `practice/06-mvcc.md` | “幻读 MVCC 解决不了”过于绝对 | RR 下快照读靠 MVCC，当前读靠 next-key/gap lock |
| `practice/06-mvcc.md` | “INSERT 加间隙锁防别人插入”误导 | INSERT 是插入意向锁；会被别人已有 gap/next-key lock 阻塞 |
| `practice/09-distributed-transaction.md` | 把 Redis/ZK/DB 直接判成“答对” | 它们是协调/存储/参与组件，不是标准事务模式本身 |
| `practice/10-distributed-lock.md` | “SETNX 不原子”错误 | SETNX 原子；SETNX + EXPIRE 两步组合不原子 |
| `practice/11-mysql-composite-index.md` | 联合索引“完全用不到”太绝对 | 不满足最左前缀通常不能定位；MySQL 8 特定场景可能 skip scan |
| `practice/11-mysql-composite-index.md` | 范围条件后面的列“完全用不到”太绝对 | 不能继续缩小范围，但可能通过 ICP 在索引层过滤 |
| `practice/14-redis-distributed-lock-deep.md` | Redisson `lock(10, unit)` 注释错成等待超时 | 这是 leaseTime；等待时间要用 `tryLock(waitTime, leaseTime, unit)` |
| `practice/14-redis-distributed-lock-deep.md` | RedLock `3/5` 写成“刚好半数” | `3/5` 是超过半数 |
| `practice/15-spring-ioc-bean-lifecycle-circular-dependency.md` | BPP 后置方法名写错 | 后置是 `postProcessAfterInitialization()` |
| `practice/19-rag-system-design.md` | “混合检索提升10-15%”像固定结论 | 改成“通常更稳，具体靠评测验证” |
| `practice/20-agent-architecture-react.md` | Function Calling vs Tool Use 概念边界错 | Function Calling 是结构化调用机制；Tool Use 是更宽泛的工具使用行为；Workflow 才是流程编排 |
| `practice/47-completable-future-async-programming.md` | `thenApplyAsync` 被写成“一定新建线程”，Future 被写成自带线程池 | async 阶段提交到 Executor，不保证新建线程；Future 只是结果句柄 |
| `practice/47-completable-future-async-programming.md` | `exceptionally` 被写成只处理紧邻一步，`join()` 被写成绝对优先 | 异常可沿上游链传播；`join()`/`get()` 根据中断与异常契约选择 |
| `practice/60-interview-harness-two-layer-architecture.md` | 把 Rubric 评测判断直接归入 Agent Runtime | Runtime 负责可靠执行；评测语义、结果校验和状态迁移属于面试业务层 |
| `practice/61-rubric-evaluation-covered-missing-incorrect.md` | 把三段式、三次模型处理说成唯一完整方案 | 提取/评估/计分是逻辑职责，可按 Eval 选择一次、两次或混合实现 |
| `practice/62-llm-score-drift-eval-regression.md` | 正文“不评分”但元数据 `0/10`，回归门禁只有相对不退化 | 统一为未作答 0/10；门禁同时包含绝对底线、相对退化和重复运行波动 |
| `ai-agent/AI-Coding-Agent-技术参考文档.md` | 断言 Claude Code 使用 ACP | 改成通用 Host-Agent/Tool 通信层，不把未公开内部细节当事实 |
| `ai-agent/alibaba-fliggy-backend-interview.md` | Harness 被窄化为评测框架 | 改成工具、上下文、记忆、权限、沙箱、评测、观测、反馈的工程外壳 |

## Hermes 输出规范

建议以后每次 practice 文件都固定成这几块，别让内容一路聊天式堆下去：

1. **题目**
   - 原题、方向、日期、来源。
   - 如果来自某篇面经，保留来源文件名。

2. **用户回答**
   - 只记录用户真实回答，不要替用户美化。
   - 可以保留口语和错误，这部分是训练价值。

3. **评分**
   - 分数可以粗糙，但扣分点要具体。
   - 不要用“答对”鼓励模糊答案，比如“Redis/ZK/数据库能参与分布式事务”这种只能算有意识到外部协调，不能算答对核心模式。

4. **标准答案**
   - 用“面试可背的一句话 + 展开解释 + 边界条件”。
   - 遇到版本、配置、场景差异，必须写清楚：`通常/可能/取决于/在 MySQL 8 特定场景`。

5. **追问记录**
   - 追问不用追求漂亮，但要标出追问最后修正了什么误区。
   - 如果 Agent 之前说错，要明确写“前面说法有误，修正为...”。

6. **最终口径**
   - 最后必须有 3-5 句可直接面试复述的答案。
   - 不要只留长篇推导，否则复习时很难抓主线。

## 仓库分层建议

现在最有价值的是 `practice/`，但它不应该和普通文章混成一类。建议心里按三层看：

| 层级 | 目录/文件 | 用法 |
|------|-----------|------|
| 原料层 | `java/`、`middleware/`、`ai-agent/`、各公司目录 | 收集题目、面经、文章，允许粗糙 |
| 训练层 | `practice/` | 一对一问答、追问、扣分、标准答案，最值得复习 |
| 审计层 | `codex gpt 修复点.md` | 专门记录 Agent 标准答案的错误和修复口径 |

一个很实用的流程是：

```
面经/文章 → Hermes 抽题 → practice 追问 → Codex/人工审标准答案 → 修复点沉淀 → 下一轮复习
```

## 面试时更稳的标准口径

### Redis 分布式锁

`SETNX` 本身是原子的，错的是老写法：

```redis
SETNX lock_key request_id
EXPIRE lock_key 30
```

这两步之间如果进程挂掉，锁可能没有过期时间。生产用：

```redis
SET lock_key request_id NX PX 30000
```

释放锁也要校验 value，避免删掉别人的锁。GC 暂停、主从切换、网络分区都可能让锁语义变弱，所以高一致业务要有数据库乐观锁、唯一约束、幂等或 fencing token 兜底。

### MVCC 和幻读

不要一句话说“MVCC 解决不了幻读”。更稳：

> InnoDB RR 下，普通快照读通过 Read View 复用，不会看到事务开始后新插入的数据；当前读如 `SELECT ... FOR UPDATE`、`UPDATE`、`DELETE` 要靠 next-key/gap lock 锁住范围，防止别人在范围内插入。

### 联合索引

`(a,b,c)` 下：

- `b=2 AND c=3`：不满足最左前缀，通常不能用联合索引做定位；MySQL 8 特定场景可能 skip scan。
- `a=1 AND b>2 AND c=3`：`a,b` 可用于范围扫描，`c` 不能继续缩小范围，但可能通过 ICP 在索引层过滤。

面试主线还是最左前缀，但别说“绝对完全用不到”。

### Function Calling vs Tool Use

更稳答案：

> Function Calling 是模型/API 输出结构化函数名和参数的机制；Tool Use 是模型使用外部工具完成任务的泛称；Workflow 是开发者定义控制流。三者可以组合，但不是同一个概念。

### Harness

更稳答案：

> Harness 是模型外面的工程外壳，负责把 LLM 变成可运行、可控、可观测、可评测的系统。它包括工具接入、上下文管理、记忆、权限、沙箱、评测、trace、错误恢复和反馈闭环。评测框架只是 Harness 的一部分。

## 判断原则

- 你的初答错了：正常扣分，但文档要明确错在哪里。
- 你的追问不严谨：可以保留，因为追问能暴露盲区。
- Agent 的纠正错了：必须修，因为它会污染后续复习。
- 遇到“通常、可能、取决于版本/配置/场景”的知识点，不要写成绝对结论。

## 下一批优先审什么

优先审这些高风险主题，因为它们最容易被 Agent 写成“看似标准、实际过度绝对”的答案：

- MySQL：MVCC、间隙锁、索引、Explain、慢 SQL。
- Redis：分布式锁、AOF/RDB、缓存一致性、集群故障。
- Spring：事务传播、循环依赖、Bean 生命周期、AOP 代理时机。
- AI Agent：Function Calling、Tool Use、MCP、Harness、ReAct、RAG 评测。
- 分布式：TCC/Saga/Seata、MQ 可靠性、幂等、最终一致性。
