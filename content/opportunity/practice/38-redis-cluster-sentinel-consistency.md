---
title: "Redis — Cluster 和 Sentinel 区别 + 主从切换一致性风险"
date: "2026-07-01"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "Redis — Cluster 和 Sentinel 区别 + 主从切换一致性风险"
tags:
schema_version: "1"
question_id: "38"
question: "Redis — Cluster 和 Sentinel 区别 + 主从切换一致性风险"
sources:
  - "java/hupu-java-backend-round2-redis-distributed.md"
  - "practice/10-distributed-lock.md"
  - "practice/14-redis-distributed-lock-deep.md"
score: "6/10"
round: "R1"
next_review: "2026-07-12"
session_id: "unknown"
---

# 第38题：Redis — Cluster 和 Sentinel 区别 + 主从切换一致性风险

> 日期：2026-07-01
> 来源：`java/hupu-java-backend-round2-redis-distributed.md`; `practice/10-distributed-lock.md`; `practice/14-redis-distributed-lock-deep.md`

---

## 第一轮：初始回答

**得分：4/10** 😐

提到主从读写分离和集群数据同步，方向对了一部分，但核心概念没打到点上。

**问题：**
1. Sentinel 不是"读写分离"，是高可用自动故障转移方案
2. Cluster 不是"同步数据"，是数据分片水平扩展方案
3. 主从切换的一致性风险完全没展开

---

## 核心概念

### 三种部署模式

| 模式 | 解决的问题 | 本质 |
|------|-----------|------|
| **主从复制** | 读写分离、数据冗余 | 一主多从，数据从主同步到从 |
| **Sentinel** | 高可用（HA） | 主从 + 监控 + 自动故障转移 |
| **Redis Cluster** | 水平扩展（写瓶颈、内存容量） | 16384 槽位分片到多个主节点 |

**一句话区分：Sentinel 解决"谁来当主"，Cluster 解决"数据放哪"。**

### 主从切换的一致性风险

Redis 主从复制是**异步的**，这是一切风险的根源：

```
Client 写入 Master → Master 返回 OK → 异步同步到 Slave
如果在这个间隙 Master 宕机 → Slave 提升为新 Master → 那条写入就丢了
```

具体风险：
1. **写丢失**：Master 收到写命令返回 OK，还没同步到 Slave 就宕了
2. **分布式锁失效**：Client1 在 Master A 加锁成功，同步前 A 宕机，Client2 在新 Master B 加锁也成功，两个 Client 同时持有锁
3. **脑裂（Split Brain）**：网络分区时，旧 Master 和新 Master 同时接受写入，分区恢复后旧 Master 的数据被覆盖丢失

### 生产中降低风险的方案

| 风险 | 应对方案 |
|------|----------|
| 写丢失 | `min-slaves-to-write 1` + `min-slaves-max-lag 10`，从节点不够就拒绝写 |
| 锁失效 | 业务幂等 + 乐观锁/fencing token 兜底；金融场景用 ZooKeeper |
| 脑裂 | `cluster-node-timeout` 合理配置；客户端做版本号校验 |
| 数据一致性 | 强一致需求用 RedLock 或直接用 etcd/ZK |

### Cluster 下的额外一致性问题

Cluster 每个主节点是独立的，不支持跨节点事务和 Lua。主从切换时跟 Sentinel 一样的异步复制丢数据风险存在，但 Cluster 有自己的故障检测（gossip + 投票），故障转移速度更快（通常 15 秒内）。

---

## 第二轮：深入追问 + 纠正记录

**核心收获：后端视角 vs 运维视角的区分**

后端不需要深究 Gossip 协议、槽位迁移步骤、Sentinel 选举算法。后端要关注的是：**代码层面怎么防**。

### 追问1：代码层面的坑怎么解决？

**三层防御：**

```
第一层：业务幂等（兜底中的兜底）
  → 数据库唯一索引，不管锁丢不丢，同一条数据只处理一次

第二层：Lua 脚本校验持有者
  → 加锁时写入线程唯一标识，释放时必须校验是不是自己的锁

第三层：Redisson WatchDog 自动续期
  → 默认30秒，每10秒续一次，防止业务跑太久锁过期
```

### 追问2：看门狗自动续期能解决主从切换丢锁吗？

**不能。这两个是完全不同的问题：**

| 问题 | WatchDog 能否解决 | 原因 |
|------|------------------|------|
| 业务跑太慢锁过期 | ✅ 能 | 每10秒续期，锁不会过期 |
| 主从切换丢锁 | ❌ 不能 | Master 宕了，续期给谁？锁数据根本没到新 Master |

**看门狗解决的是"锁过期了业务还没跑完"，不是"主从切换时数据丢失"。**

### 追问3：加线程 ID 能解决吗？

**不能。** 线程 ID 能解决"误删别人的锁"（同一个 Master 上），但主从切换时：

```
Master A 上有：lock:order:1001 = uuid-111（Client1 的锁）
还没同步给 Slave B
A 宕机，B 升为新 Master
B 上：lock:order:1001 这个 key 根本不存在
Client2 在 B 上 SET NX → 成功！因为 B 上从来没收到过这个 key
```

**你加线程 ID 也好、加 UUID 也好——数据根本没到新 Master 上，校验无从谈起。**

### 追问4：有没有彻底的方法？

**Redis 本身做不到彻底。要彻底，得换武器：**

| 方案 | 一致性 | 性能 | 适用场景 |
|------|--------|------|----------|
| Redisson + 幂等兜底 | 最终一致 | 极快（0.1ms） | 99% 普通业务 |
| RedLock | 强（有争议） | 快 | 想留在 Redis 体系 |
| ZooKeeper/etcd | 强一致 | 较慢（几ms） | 金融级扣款、转账 |

**真正彻底的解法是 CP 系统（ZK/etcd）。**

### 追问5：AP 和 CP 怎么理解？

**CAP 定理：C（一致性）、A（可用性）、P（分区容错）最多满足两个，P 必须有。**

```
CP（选一致性，牺牲可用性）
  → 节点数据不一致时拒绝服务
  → 典型：ZooKeeper、etcd
  → 例子：银行柜台办业务，系统说"正在同步，等一下"

AP（选可用性，牺牲一致性）
  → 节点数据不一致时还是返回数据
  → 典型：Redis、Eureka
  → 例子：便利店有货就卖，不等总部确认
```

### 追问6：ZK 也会有 GC 停顿和时钟漂移问题吧？

**会，但影响完全不同：**

```
Redis RedLock + GC 停顿 → 出事
  → Client1 加锁成功，GC 停顿 30 秒，锁 TTL 20 秒过期
  → Client2 加锁成功，Client1 GC 结束以为还持有锁 → 两个 Client 同时操作

ZooKeeper + GC 停顿 → 不影响正确性
  → Client1 持有锁，Leader GC 停顿
  → Follower 检测心跳超时 → 触发选举 → 数据已在 Follower 上
  → Client1 Session 超时 → 连接断开 → 锁自动释放 → Client1 知道丢锁了
```

**核心区别：RedLock 靠物理时间（TTL），GC 停顿让 Client 失去对时间的感知；ZK 靠 Session 心跳，停顿了心跳就断，锁自动释放。**

### 追问7：ZK 加锁的"指定时间"怎么写？

**ZK 有两个时间维度：**

```java
// 1. Session 超时时间（锁的有效期）
CuratorFramework client = CuratorFrameworkFactory.builder()
    .sessionTimeoutMs(30000)   // 30秒，心跳超时后Session失效，锁释放
    .build();

// 2. 加锁等待时间（最多等多久拿到锁）
InterProcessMutex lock = new InterProcessMutex(client, "/lock/order:1001");
boolean acquired = lock.acquire(5, TimeUnit.SECONDS); // 最多等5秒
```

**跟 Redis 对比：**
- Redis `SET NX EX 30` = 锁有效期 30 秒（倒计时炸弹）
- ZK `sessionTimeoutMs=30000` = 锁有效期（心跳维持，刷卡进门）

### 追问8：ZK 的 Session 超时精确吗？

**不精确。** sessionTimeoutMs 是"最小超时"，不是精确超时：

```
实际释放时间 = 30秒 + 不确定的延迟

原因：
1. 心跳不是匀速发的（网络抖动、GC 停顿都可能晚到）
2. 超时判定在服务端，不是客户端说了算
3. 期间可能正好在 Leader 选举，没人管这事
```

**所以 ZK 锁的时效性：Redis 到点释放（精确），ZK 大概 30 多秒释放（不精确）。这不是缺陷，是设计取舍——ZK 牺牲时效性换一致性。**

---

## 这次讨论的收获

- **后端视角 vs 运维视角**：面试考的是你能不能把技术决策落到代码里，不是考你会不会配 Redis
- **看门狗只解决"锁过期"，不解决"主从切换丢数据"**：这是两个完全不同的问题，很多人混淆
- **加线程 ID 解决误删，不解决主从切换**：数据没到新 Master 上，校验无从谈起
- **AP vs CP 的本质**：Redis 选了 A，你不能反过来要求它保证 C；要彻底一致就用 CP 系统（ZK/etcd）
- **ZK 靠 Session 心跳而非物理时间**：停顿了心跳就断，锁自动释放，不会出现"以为有锁实际没有"
- **ZK 时间不精确**：sessionTimeoutMs 是最小超时，实际释放有延迟，不要当精确计时器用
- **锁是保镖，不是秒表**：不要依赖"锁刚好在 X 秒后释放"，要指望它在关键时刻拦住并发

## GPT 纠错

- GPT 纠错：不能把 Redis 整体简单定义为 AP。CAP 讨论的是发生网络分区时具体操作在一致性与可用性之间的选择；Redis 不同部署方式、读写路径和配置会表现不同。
- GPT 纠错：RedLock 不能作为“强一致”方案，它依赖租约和时间假设，存在公开争议。ZooKeeper/etcd 能提高锁服务本身的一致性，但操作数据库、文件等外部资源时仍建议使用 fencing token，不能宣称“彻底安全”。
- GPT 纠错：ZooKeeper Session 失效后，旧客户端可能暂时还不知道自己已经失去锁，因此“不会出现以为有锁实际没有”并不严谨。
- GPT 纠错：`sessionTimeoutMs` 是会话超时参数，不等同于固定的锁 TTL，也不是简单的“最小超时”；服务端会根据配置协商实际超时。
- GPT 纠错：Redis Cluster 并非完全不支持事务和 Lua；多个 key 位于同一 hash slot 时可以执行。故障转移耗时也不能固定写成“通常 15 秒内”。

---

## R1 回顾（2026-07-08）

**得分：6/10**

用户回答要点：
- Sentinel：客户端连哨兵，哨兵告诉连哪个实例 ✓
- Cluster：自己分配主从 ✓
- 主挂了，同步过程中可能丢 key ✓
- 理解分片：每台机器只存一部分，按 hash 规则分配 ✓
- Hash Slot 概念理解正确 ✓

漏掉/不准确的：
- 哨兵数量：应该是3个（奇数），不是2个
- Cluster 核心是分片 + 复制，不只是主从
- 丢数据原因是异步复制的延迟窗口
