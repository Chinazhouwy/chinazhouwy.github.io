---
title: "Redis Streams：有确认、能回溯的消息队列"
date: "2026-09-16"
domain: "学习"
area: "数据与中间件"
module: "Redis 与缓存"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "整理 Redis Streams 的追加日志、消费者组、PEL、故障转移与 Redis 8.6 生产端幂等投递机制。"
tags:
  - Redis
  - Streams
  - 消息队列
  - 消费者组
  - 幂等
source: "微信公众号「苏渡苇」"
source_url: "https://mp.weixin.qq.com/s/aEHlslURczLvp1pTC6SWNA"
published_at: "2026-09-16 06:50:00+08:00"
---

# Redis Streams：有确认、能回溯的消息队列

> **来源**：微信公众号「苏渡苇」《Redis Streams——有确认、能回溯的消息队列》
>
> **发布时间**：2026-09-16 06:50（北京时间）
>
> **原始链接**：<https://mp.weixin.qq.com/s/aEHlslURczLvp1pTC6SWNA>
>
> **整理范围**：将原文重构为学习笔记；命令示例来自原文，关键版本和机制已对照 Redis 官方文档。

## 一句话结论

如果 `List + BRPOP` 只是“取走一条就算交付”，那么 Redis Streams 提供的是一条仍然保留历史记录的追加日志：可以按 ID 回看，可以用消费者组分工，可以用 `XACK` 确认处理完成，还可以把长时间未确认的消息转给其他消费者。[1][2]

它适合“Redis 已经在系统里、消息量中等、需要确认和一定程度重放，但还不值得单独维护 Kafka/RocketMQ”的内部任务场景。这个选型判断来自原文经验，不是 Redis 官方给出的容量边界或性能基准。[1]

## 1. Stream 的数据模型

Redis 官方把 Stream 定义为一种类似追加日志的数据结构，同时提供随机访问和消费者组等消费策略。[2]

一条 Stream entry 主要有两部分：

- **ID**：默认形如 `毫秒时间戳-序号`，例如 `1789086136869-0`；通常让 Redis 通过 `*` 自动生成。
- **字段和值**：类似 Hash 的 field-value 对，例如 `user_id`、`amount`、`sku`。

```redis
XADD orders * user_id 1001 amount 299 sku sku_1001
XLEN orders
XRANGE orders - +
```

`XADD` 的核心语义是追加一条 entry；当前命令语法还支持 `MAXLEN` / `MINID` 裁剪以及 Redis 8.6 的 `IDMP` / `IDMPAUTO` 幂等参数。[4]

常用读取方式：

| 命令 | 用途 |
|---|---|
| `XLEN` | 查看 Stream 长度 |
| `XRANGE key start end` | 按 ID 范围读取历史消息 |
| `XREAD ... STREAMS key id` | 从指定 ID 继续读；配合 `BLOCK` 等待新消息 |
| `XTRIM` 或 `XADD ... MAXLEN ~ N` | 控制历史长度，避免无限增长 |

`MAXLEN ~ N` 是近似裁剪：允许 Redis 少裁一些，以换取更低的维护开销。是否裁剪、裁剪多少，应结合重放窗口、积压风险和内存预算决定，不能只照抄示例数字。

## 2. 普通读取与消费者组的区别

`XREAD` 更接近“每个客户端自己维护游标”：多个客户端可以各自读到同一条消息。若目标是让多个工人分摊任务，而不是让每个客户端都收到全量消息，应使用消费者组。[2][5]

### 2.1 创建消费者组

```redis
# 从已有历史消息开始消费
XGROUP CREATE orders packer 0-0

# 只消费建组之后的新消息
XGROUP CREATE orders packer $

# Stream 还不存在时，可使用 MKSTREAM 创建空 Stream
# XGROUP CREATE orders packer $ MKSTREAM
```

`0-0` 与 `$` 的选择决定了消费者组建立时的起始位置：前者从历史起点开始，后者只关注之后到达的消息。生产环境建组前应明确是否需要补历史，避免把两者混用。

### 2.2 分工读取、确认与 PEL

```redis
# >：读取这个组中尚未投递给任何消费者的新消息
XREADGROUP GROUP packer node-a COUNT 1 STREAMS orders >
XREADGROUP GROUP packer node-b COUNT 1 STREAMS orders >

# 查看组内 pending 消息
XPENDING orders packer

# 业务处理成功后确认
XACK orders packer 1789086136869-0
```

消费者组会记录已经投递但尚未确认的消息，这份记录称为 **PEL（Pending Entries List）**。[2] `XACK` 的作用是从消费者组的 PEL 中移除确认记录；它不是删除 Stream entry，因此历史消息仍可通过 `XRANGE` 查看，其他消费者组也不会因为某个组确认而失去自己的消费记录。[7]

一个 Stream 可以有多个相互独立的消费者组。例如：

- `packer` 组负责订单打包；
- `stock` 组负责扣减库存；
- 两个组各自维护投递、pending 和确认状态。

因此，“同一条消息在一个组内只分给一个消费者”和“多个业务组都可以各自消费同一条 Stream”可以同时成立。

## 3. 消费者故障：用 XAUTOCLAIM 接管未确认消息

典型故障路径是：消费者 `node-a` 已通过 `XREADGROUP` 领到消息，但业务处理还没结束就宕机，因而没有执行 `XACK`。此时消息仍在 PEL 中，不会自动变成一条全新的消息。

其他消费者可以按空闲时间接管：

```redis
# 将 packer 组中空闲超过 60000 ms 的 pending 消息转给 node-b
XAUTOCLAIM orders packer node-b 60000 0-0 COUNT 10
```

`XAUTOCLAIM` 用于转移符合条件的 pending entry 所有权，官方命令文档标注其从 Redis Open Source 6.2.0 开始提供。[6] 接管不是业务成功的替代品：新消费者仍要重新执行业务逻辑，成功后再 `XACK`。[6][7]

一个稳妥的消费循环通常包含两条路径：

1. 用 `XREADGROUP ... >` 获取新消息；
2. 定期用 `XAUTOCLAIM` 扫描长时间未确认的消息；
3. 业务处理成功后 `XACK`；
4. 业务处理必须具备幂等性，避免同一消息因超时接管而产生重复副作用。

重启后的消费者还可以先读取自己的历史 pending 消息，再继续读取 `>` 的新消息；否则容易把“自己上次领到但未完成的任务”遗漏在 PEL 中。

## 4. Redis 8.6：生产端幂等投递

原文提到 Redis 8.6 为 `XADD` 增加幂等能力；Redis 官方文档也明确说明，Redis Streams 从 8.6 开始支持幂等消息处理，用来避免生产者重试造成重复 entry。[1][2][3]

这里要区分两个问题：

- **生产端幂等**：生产者执行 `XADD` 后网络断开，没收到响应，重试时不会因为同一幂等 ID 再写出一条重复 entry。
- **消费端幂等**：消费者可能在业务完成后、执行 `XACK` 前崩溃，消息随后被重新投递；业务处理本身仍需幂等。

因此，`IDMP` / `IDMPAUTO` 解决的是生产端重复写入，不等于整个业务链路的 exactly-once 执行。这个边界不能省略。[2][3][7]

### 4.1 IDMPAUTO：按消息内容生成幂等 ID

```redis
XADD pay_log IDMPAUTO pay-svc-1 * order_id 9001 amount 299
```

`IDMPAUTO` 由 Redis 根据 field-value 内容计算幂等 ID；相同生产者 ID、相同消息内容的重试可以被识别为同一条消息。[3]

它的风险是：两个业务事件即使语义不同，只要字段和值完全相同，也可能被视为同一内容。若业务上“相同内容也可能是两笔不同交易”，不要只依赖 `IDMPAUTO`。

### 4.2 IDMP：使用业务幂等 ID

```redis
XADD pay_log IDMP pay-svc-1 txn-9001 * order_id 9001 amount 299

# 重试：同一 (producer-id, idempotent-id)，不会新增同一条消息
XADD pay_log IDMP pay-svc-1 txn-9001 * order_id 9001 amount 299

# 另一笔业务事件：使用不同的 txn ID
XADD pay_log IDMP pay-svc-1 txn-9002 * order_id 9001 amount 299
```

`IDMP` 由生产者显式提供 producer ID 和幂等 ID，适合直接使用订单号、事务号或业务事件 ID。生产者重启后必须继续使用同一个 producer ID，否则 Redis 无法延续原来的幂等跟踪。[3]

### 4.3 幂等记录不是永久去重表

官方文档给出的默认值是：`IDMP-DURATION` 默认 100 秒，`IDMP-MAXSIZE` 默认每个生产者跟踪 100 个幂等 ID；到期或达到容量上限后，旧的幂等记录会被清理。[3]

```redis
XCFGSET pay_log IDMP-DURATION 600 IDMP-MAXSIZE 1000
```

这意味着 Redis 8.6 的 IDMP 不是永久业务去重表。重试窗口超过保留时间，或超过 per-producer 的跟踪上限后，再次提交仍可能新增 entry。需要长期去重时，应把业务事件 ID 记录在独立的持久化存储或业务状态机中。

## 5. 与 List、Kafka/RocketMQ 的边界

### List 什么时候够用

如果任务允许偶尔丢失、没有重放需求、处理逻辑简单，`List + BRPOP` 的实现成本更低。它不应被强行升级成 Streams，只是为了追求“消息队列”这个名词。

### Streams 什么时候更合适

以下需求同时出现时，Streams 更有价值：

- 需要显式确认处理结果；
- 消费者崩溃后需要查看、重试或接管 pending 消息；
- 多个业务消费组需要分别维护进度；
- Redis 已经是系统基础设施，消息规模和堆积量仍在可控范围内。

### Kafka/RocketMQ 什么时候更合适

如果需要大规模吞吐、按分区扩展、长期磁盘日志、跨机房复制或成熟的积压治理，就不应把 Redis Streams 当成 Kafka 的替代品。原文的“日千万级、需要按分区扩展时考虑 Kafka/RocketMQ”是选型建议；这篇文章没有给出可复现的压测脚本、硬件、消息大小和吞吐数据，因此不能把它当作性能结论。[1]

## 6. 推荐的最小可靠模式

```text
生产者：业务事件 ID → XADD IDMP（或确认内容天然唯一时使用 IDMPAUTO）
        ↓
消费者组：XREADGROUP ... > 分工拿新消息
        ↓
业务处理：先保证副作用幂等，再执行实际业务
        ↓
成功：XACK，清理该消息在组内的 PEL 记录
        ↓
故障恢复：XPENDING 观察 → XAUTOCLAIM 接管 → 重试 → XACK
        ↓
维护：XLEN / XPENDING / XINFO 监控，按重放窗口设置 MAXLEN 或 XTRIM
```

关键顺序是：**业务成功后再 ACK**。如果先 ACK 再执行业务，消费者崩溃会造成消息已经从 PEL 中移除、业务却没有完成；如果业务完成但 ACK 失败，则要接受重复投递并依靠业务幂等兜底。

## 7. 练习路径

1. 执行三次 `XADD orders * ...`，用 `XRANGE orders - +` 验证 entry ID 和字段值。
2. 创建 `packer` 消费者组，让 `node-a`、`node-b` 分别用 `XREADGROUP ... >` 读取，观察同一组内的消息分工。
3. 只确认其中一条，用 `XPENDING orders packer` 验证剩余 pending 数量。
4. 模拟一个消费者在处理后、ACK 前退出，用另一个消费者执行 `XAUTOCLAIM`，验证接管后需要重新处理并最终 ACK。
5. 在 Redis 8.6 环境中使用同一组 `producer-id + idempotent-id` 重试 `XADD IDMP`，观察 Stream 长度是否保持不变；再换业务 ID，确认会新增 entry。

## 勘误与补充

1. **“Redis 8.6 的幂等”不是永久去重，也不是端到端 exactly-once。** 官方描述的是生产端的幂等消息处理和重复 entry 抑制；消费端仍存在“业务成功但 ACK 未完成”的重投递窗口。[2][3][7]
2. **`XACK` 不会删除 Stream entry。** 它移除的是消费者组 PEL 中的确认记录；要删除历史 entry，需要使用 `XTRIM`、`MAXLEN` 或相应的删除命令。[7]
3. **`XAUTOCLAIM` 的版本门槛是 Redis 6.2.0。** 原文写作“6.2+”，与官方命令文档一致。[6]
4. **幂等记录默认保留窗口有限。** 原文写“默认只记大约 100 秒、每个生产者最多 100 个 ID”，官方文档给出的对应默认值是 `IDMP-DURATION=100` 秒和 `IDMP-MAXSIZE=100`，但两种淘汰条件都可能使记录更早失效。[3]
5. **本文示例未在本机运行。** 本机没有发现 `redis-server` 或 `redis-cli` 可执行文件；命令语义、版本边界和关键参数已对照 Redis 官方文档，实际部署前仍需用目标 Redis 版本做集成测试。

## 复习速记

```text
Stream = 追加日志 + 可按 ID 回看
XADD  = 写入；XRANGE/XREAD = 读历史或等待新消息
Group = XGROUP CREATE → XREADGROUP → XACK
PEL   = 已投递但未确认的消息集合
故障  = XPENDING 观察 → XAUTOCLAIM 接管 → 重试 → XACK
幂等  = Redis 8.6 的 IDMP / IDMPAUTO，解决生产端重复写入
边界  = 不是永久去重表，也不是端到端 exactly-once
```

## Sources

[1] https://mp.weixin.qq.com/s/aEHlslURczLvp1pTC6SWNA — Redis Streams——有确认、能回溯的消息队列（公众号原文）
[2] https://redis.io/docs/latest/develop/data-types/streams — Redis Streams 官方文档
[3] https://redis.io/docs/latest/develop/data-types/streams/idempotency — Redis Streams 幂等消息处理官方文档
[4] https://redis.io/docs/latest/commands/xadd — XADD 官方命令文档
[5] https://redis.io/docs/latest/commands/xreadgroup — XREADGROUP 官方命令文档
[6] https://redis.io/docs/latest/commands/xautoclaim — XAUTOCLAIM 官方命令文档
[7] https://redis.io/docs/latest/commands/xack — XACK 官方命令文档
