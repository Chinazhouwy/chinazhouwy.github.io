---
title: "秒杀系统怎么设计"
date: "2026-06-14"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "秒杀系统怎么设计"
tags:
schema_version: "1"
question_id: "33"
question: "秒杀系统怎么设计"
sources:
  - "java/eleme-java-backend-round1.md"
  - "java/megvii-java-round1-12-questions.md"
  - "tiktok/2026-05-27-tiktok-ecommerce-backend-round1.md"
score: "5/10"
round: "R0"
next_review: "unknown"
session_id: "unknown"
---

# 第 33 题：秒杀系统怎么设计

> **得分：5 / 10**
> **来源：** `java/eleme-java-backend-round1.md`、`java/megvii-java-round1-12-questions.md`、`tiktok/2026-05-27-tiktok-ecommerce-backend-round1.md`

---

## 核心概念

### 一、整体架构

```
用户请求 → 网关限流 → 秒杀服务 → Redis预扣库存 → 发MQ → 消费者落库
                ↓
           令牌桶/滑动窗口
```

### 二、限流方案对比

| 方案 | 原理 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|----------|
| **固定窗口** | 计数器，每秒重置 | 最简单 | 临界点可能翻倍 | 简单场景 |
| **滑动窗口（Sorted Set）** | ZADD + ZREMRANGEBYSCORE | 精确，无临界问题 | 内存占用大 | 精确控制 |
| **滑动窗口（Lua）** | Lua 脚本原子操作 | 原子性，精确 | 需要写脚本 | 高并发 |
| **令牌桶** | 桶容量 + 填充速率 | 允许突发，平滑 | 实现复杂 | 秒杀入口 |
| **本地 + Redis 组合** | Guava + Redis 分布式 | 快且一致 | 两层配置 | 生产推荐 |

**生产推荐方案**：
```java
// 第一层：本地 Guava RateLimiter（粗粒度）
RateLimiter localLimiter = RateLimiter.create(100);

// 第二层：Redis Lua 令牌桶（商品维度，细粒度）
boolean redisAllowed = redisson.getRateLimiter("limit:sku_001").tryAcquire();
```

### 三、削峰（MQ 异步）

**同步 vs 异步**：
```
同步：用户下单 → 等待数据库写入 → 返回结果（慢，3-5秒）
异步：用户下单 → Redis预扣 → 发MQ → 立即返回"排队中"（快，100ms）
```

**RocketMQ 配置要点**：
- 一个订单只能被一个消费者消费（用 MessageGroup 保证顺序）
- 消费失败要重试，但不能无限重试（3次后进死信）
- 死信队列：处理失败的消息人工介入

### 四、库存一致性（Redis预扣 + 数据库最终一致）

**流程**：
```
1. 秒杀开始前：库存从DB加载到Redis
   redis.set("stock:sku_001", 100)

2. 用户下单：Redis预扣库存（Lua脚本保证原子性）
   if redis.get("stock:sku_001") > 0:
       redis.decr("stock:sku_001")
       return "扣减成功"
   else:
       return "已售罄"

3. 预扣成功 → 发MQ消息
   {orderId, skuId, userId, quantity}

4. 消费者收到消息 → 数据库扣减
   UPDATE sku SET stock = stock - 1 WHERE sku_id = 'sku_001' AND stock > 0

5. 数据库扣减失败 → 补偿Redis
   redis.incr("stock:sku_001")
```

**防超卖 Lua 脚本**：
```lua
local stock = redis.call('get', KEYS[1])
if stock and tonumber(stock) > 0 then
    redis.call('decr', KEYS[1])
    return 1  -- 扣减成功
else
    return 0  -- 已售罄
end
```

**为什么不直接扣数据库**：
- 数据库 QPS 限制（一般几千）
- 秒杀请求量（几万到几十万）
- Redis QPS 十万级，先在 Redis 挡住

### 五、订单异步（状态机）

**订单状态机**：
```
待支付 → 支付中 → 已支付 → 已发货 → 已完成
  ↓        ↓         ↓
已取消  支付失败   已退款
```

**为什么要中间状态**：
- 防止重复扣款（幂等性）
- 方便排查问题（知道卡在哪一步）
- 支持超时取消（定时任务扫描"待支付"超过30分钟的订单）

### 六、完整流程

```
1. 秒杀开始
   └→ 库存从DB加载到Redis

2. 用户点击"秒杀"
   └→ 网关限流（令牌桶）
   └→ 秒杀服务限流（商品维度）

3. Redis预扣库存（Lua脚本）
   ├→ 失败 → 返回"已售罄"
   └→ 成功 → 发MQ消息 → 返回"排队中"

4. MQ消费者处理
   ├→ 创建订单（状态：待支付）
   ├→ 发起支付
   ├→ 支付成功 → 更新状态（已支付）→ 扣减DB库存
   └→ 支付失败 → 更新状态（已取消）→ Redis库存回补

5. 超时未支付
   └→ 定时任务扫描 → 取消订单 → Redis库存回补
```

---

## 用户回答记录

### 初始回答

**限流**：令牌桶就行 - 框架对，太简单
**削峰**：MQ RocketMQ - 正确，没展开
**库存一致**：先保证Redis释放（预扣），成功后发消息，消息接收后处理持久化 - 方向对，表述不够准确
**订单异步**：中间状态（处理中、扣款中），背后用MQ处理 - 方向对

**评分：5 / 10**

---

## 追问 + 纠正记录

### 追问 1：Bitmap 限流

用户提到用 Bitmap 做限流。纠正：Bitmap 主要用于权限控制、用户标签，不是限流。限流主要用令牌桶或滑动窗口。

### 追问 2：滑动窗口竞态条件

用户问分布式情况下 Pipeline 是否有问题。纠正：有竞态条件，必须用 Lua 脚本保证原子性。生产推荐直接用 Redisson 的 RRateLimiter。

---

## 最终结论

| 用户问题 | 结论 |
|---------|------|
| 限流用什么 | 本地 Guava + Redis Lua 令牌桶组合 |
| 削峰用什么 | RocketMQ 异步，同步转异步 |
| 库存一致怎么做 | Redis Lua 预扣 → MQ → 数据库扣减 → 失败补偿 |
| 订单异步怎么做 | 状态机管理中间状态，支持超时取消 |
| Bitmap 能限流吗 | 不能，Bitmap 用于权限控制/标签 |

---

## 这次讨论的收获

1. **限流要组合使用**：本地 + 分布式，粗粒度 + 细粒度
2. **Lua 脚本保证原子性**：分布式场景必须用 Lua，Pipeline 有竞态
3. **Redisson 是生产首选**：不用自己写 Lua，封装好了
4. **Bitmap 用于权限控制**：不是限流方案
5. **状态机管理订单**：中间状态支持排查和超时取消
