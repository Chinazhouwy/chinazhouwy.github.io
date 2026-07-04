# 第25题 — 高并发库存扣减防超卖

> **题目**：高并发库存扣减如何防超卖？乐观锁、悲观锁、Redis、MQ 怎么取舍？
> **来源**：《腾讯AI后端一面》（tencent/2026-06-07-tencent-ai-backend-round1-xhs.md）；《饿了么Java一面》（java/eleme-java-backend-round1.md）；《百度Java一面社招》（java/baidu-java-backend-round1-shezhao.md）
> **练习日期**：2026-06-09

---

## 得分：5/10

### ✅ 答对的部分
- 超卖本质是高并发下并发控制失败 ✅
- Redis 预扣库存后 DB 落库失败要补偿回补 ✅
- Canal 监听 MySQL binlog 保证一致性 ✅
- 延迟双删思路方向对（但放错了层面）

### ❌ 问题
| 问题 | 扣分 |
|------|------|
| 乐观锁/悲观锁适用场景说反了 | -1 |
| 没提 Redis Lua 原子扣减这个最常用方案 | -1 |
| 延迟双删是缓存一致性方案，不是防超卖方案，串题了 | -1 |
| 没提 MQ 异步削峰 | -0.5 |
| 没有区分"预扣"和"最终落库"两个阶段 | -0.5 |

---

## 一、超卖的本质

高并发下多个请求同时读到同一个库存值，各自扣减后写回，导致**最终库存比实际多减或少减**。

---

## 二、三种方案的适用场景

### 1. 乐观锁（CAS/版本号）— 高并发 + 冲突少

**场景举例**：电商商品点赞数
```
用户A 点赞 → UPDATE goods SET likes = likes + 1 WHERE id = 1 AND likes = 500
用户B 点赞 → UPDATE goods SET likes = likes + 1 WHERE id = 1 AND likes = 500
```
- 100万人浏览但只有1000人点赞，冲突概率极低
- 冲突了重试一次就行，重试成本几乎为零
- **核心判断：操作多，但撞车少 → 乐观锁**

### 2. 悲观锁（SELECT ... FOR UPDATE）— 冲突多 + 不能容忍重试

**场景举例**：银行转账
```sql
BEGIN;
SELECT balance FROM account WHERE user_id = A FOR UPDATE;
UPDATE account SET balance = balance - 100 WHERE user_id = A;
UPDATE account SET balance = balance + 100 WHERE user_id = B;
COMMIT;
```
- 同一账户可能同时转账、扣款、退款
- 乐观锁冲突重试 → 重试期间余额又变了 → **钱会算错**
- 必须锁住一个一个来，保证强一致
- **核心判断：钱相关、不能算错、不能重试 → 悲观锁**

### 3. Redis Lua 原子扣减 — 高并发 + 冲突多

**场景举例**：秒杀抢购
```lua
-- Redis Lua 脚本（原子执行）
local stock = redis.call('GET', 'stock:1001')
if tonumber(stock) > 0 then
    redis.call('DECR', 'stock:1001')
    return 1  -- 扣减成功
else
    return 0  -- 库存不足
end
```
- 10万人同时请求，冲突率极高
- 乐观锁重试 → 每秒几万次重试，DB 打崩
- 悲观锁 → DB 连接瞬间满，所有人排队
- **Redis 单线程 + Lua 原子性，每秒十几万 QPS，先拦住**
- **核心判断：高并发 + 冲突多 + 要快 → Redis 先顶住**

---

## 三、生产方案：Redis + MQ 异步落库

### 完整链路

```
用户请求
  ↓
Redis Lua 原子预扣库存（扣成功才放行）
  ↓ 扣成功
发 MQ 消息（削峰，匀速写入）
  ↓
消费者异步落库（DB 扣减库存 + 创建订单）
  ↓ 失败
消费重试 + 补偿任务回补 Redis 库存
  ↓ 兜底
Canal 监听 binlog，定时对账 Redis 和 DB 一致性
```

### 关键设计点

| 环节 | 方案 | 说明 |
|------|------|------|
| 预扣库存 | Redis Lua | 原子操作，每秒 10w+ QPS |
| 异步落库 | MQ（RocketMQ/Kafka） | 削峰填谷，保护 DB |
| 落库失败 | 消费重试 + 补偿 job | 回补 Redis 库存，防少卖 |
| 最终一致 | Canal 监听 binlog | 兜底对账，Redis 和 DB 库存同步 |

---

## 四、按并发量选型

| 场景 | 超卖控制 | 落库方式 | 是否需要 MQ |
|------|---------|---------|------------|
| 日常卖货（QPS < 1000） | DB 乐观锁 `WHERE count > 0` | 同步 | ❌ |
| 活动促销（QPS 1000~10000） | Redis Lua | 同步落库 | ❌ |
| 秒杀抢购（QPS > 10000） | Redis Lua | 异步（MQ 削峰） | ✅ |

**面试回答要点**：
> "防超卖的核心是 Redis Lua 原子扣减，这一步在任何并发量下都够用。MQ 不是防超卖用的，而是在秒杀这种极端高并发场景下，把 DB 写入从同步变异步，保护数据库不被打崩。日常场景直接 Redis + 同步落库就够了。"

---

## 五、这次讨论的收获

1. **乐观锁/悲观锁的适用场景容易搞反**：不是"高并发→乐观锁"，而是看冲突率。乐观锁适合冲突少的场景，冲突多反而重试成本爆炸。
2. **MQ 不是防超卖的必须组件**：MQ 的作用是削峰，不是控制超卖。日常场景不需要 MQ。
3. **延迟双删是缓存一致性方案**，和防超卖是不同层面的问题，不能串题。
4. **生产方案是分层的**：Redis Lua 预扣 → MQ 异步落库 → 补偿回补 → Canal 兜底对账。
