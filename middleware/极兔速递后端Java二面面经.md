# 极兔速递后端Java二面面经

> **来源**: 小红书
> **时长**: 40分钟
> **形式**: 线上视频（技术面）
> **标签**: #极兔速递 #后端开发 #Java #面经

---

## 一、自我介绍（3分钟）
重点说说做过的**分布式相关项目**，以及在其中负责的**核心模块**。

---

## 二、技术提问

### 1. Synchronized vs ReentrantLock 深度对比

| 维度 | synchronized | ReentrantLock |
|------|-------------|---------------|
| 底层实现 | JVM层面（monitorenter/monitorexit） | JDK层面（AQS + CAS） |
| 锁升级 | 无锁→偏向锁→轻量级锁→重量级锁 | 直接CAS自旋 |
| 可中断 | ❌ 不可中断 | ✅ `lockInterruptibly()` |
| 超时 | ❌ 不支持 | ✅ `tryLock(timeout, unit)` |
| 公平性 | 非公平 | 可选公平/非公平 |
| 条件变量 | `wait()/notify()` 单一条件 | 多个 `Condition` 对象 |
| 性能（低竞争） | 优（偏向锁优化） | 略差 |
| 性能（高竞争） | 重量级锁后较慢 | 优（自旋+阻塞） |

**选择原则**：
- 简单同步、锁范围小 → `synchronized`（代码简洁，JVM持续优化）
- 需要超时/中断/多条件 → `ReentrantLock`
- 高并发热点资源 → `ReentrantLock`（避免重量级锁）

**实际项目选择**：
```java
// 业务场景：物流订单状态更新（高频写入）
// 选择 ReentrantLock + 超时机制
private final ReentrantLock lock = new ReentrantLock();

public boolean updateOrderStatus(String orderId, int newStatus) {
    if (lock.tryLock(3, TimeUnit.SECONDS)) {
        try {
            // 更新 DB
            return true;
        } finally {
            lock.unlock();
        }
    }
    // 超时走降级
    return fallbackProcess(orderId, newStatus);
}
```

> ⚠️ **踩坑**：`ReentrantLock` 务必在 finally 中 unlock，否则锁永远不释放！

---

### 2. Redis 五大基本数据类型及极兔业务场景

| 类型 | 底层结构 | 极兔业务场景 |
|------|---------|-------------|
| **String** | SDS（动态字符串） | 快递单号状态缓存、短信验证码、Token |
| **Hash** | 压缩列表/哈希表 | 包裹详情（下单人→收件人→配送员→签收状态） |
| **List** | 双向链表/压缩列表 | 派件任务队列（快递员待派列表） |
| **Set** | 哈希表/整数集合 | 每日已签收单号去重、优惠券领取用户去重 |
| **Sorted Set (ZSet)** | 跳跃表+哈希表 | 快递员今日派件量排行榜、优先级派单排序 |

**极兔业务数据存储示例**：

```java
// 1. 快递单号状态 → String（简单key-value）
redis.set("express:status:" + waybillNo, "IN_TRANSIT");

// 2. 包裹详细信息 → Hash（多字段，频繁更新单一字段）
redis.hset("parcel:" + parcelId, "sender", "张三");
redis.hset("parcel:" + parcelId, "receiver", "李四");
redis.hset("parcel:" + parcelId, "status", "已揽收");

// 3. 快递员待派件队列 → List（从左侧取任务）
redis.lpush("courier:tasks:" + courierId, parcelId);
// 快递员领取下一个任务
String nextTask = redis.rpop("courier:tasks:" + courierId);

// 4. 今日签收去重 → Set
redis.sadd("signed:20260520", waybillNo);

// 5. 快递员派件排行榜 → ZSet
redis.zadd("courier:daily:rank", deliveredCount, courierId);
// 取Top10
Set<String> top10 = redis.zrevrange("courier:daily:rank", 0, 9);
```

---

### 3. Redis 分布式锁深度

#### setnx 的局限性

```bash
# ❌ 原始 setnx 方案的问题
SETNX lock:order:123 1    # 加锁
EXPIRE lock:order:123 30   # 设置过期
# 问题：如果 SETNX 和 EXPIRE 之间服务挂了，锁永远不会释放
```

#### ✅ Redisson 解决方案

```java
// Redisson 分布式锁
RLock lock = redisson.getLock("lock:order:" + orderId);

// 尝试加锁，最多等3秒，锁30秒自动释放
if (lock.tryLock(3, 30, TimeUnit.SECONDS)) {
    try {
        // 执行业务逻辑
        processOrder(orderId);
    } finally {
        lock.unlock(); // 安全释放
    }
}
```

**Redisson 看门狗机制**：

```
加锁成功（默认30秒）
    ↓
启动看门狗线程（每10秒检查一次）
    ↓
业务还在执行？ → 自动续期到30秒
业务已结束？   → 释放锁，看门狗线程退出
    ↓
解决了锁超时释放的问题（业务没跑完锁先过期）
```

**为什么 Redisson 可以解决 setnx 的局限性**：
- **原子性**：SET 命令自带 NX + EX 参数
- **看门狗自动续期**：避免锁提前释放
- **安全解锁**：Lua 脚本保证只删除自己的锁
- **可重入**：同一个线程可重复加锁

---

### 4. MySQL 索引底层 + 极兔订单表索引设计

#### 为什么 InnoDB 选 B+ 树？

| 结构 | 磁盘IO次数（千万级数据） | 范围查询 |
|------|------------------------|---------|
| 红黑树 | ~24次（树高） | 中序遍历，多次IO |
| B树 | ~4次 | 需要递归回父节点 |
| **B+树** | **3-4次** | **叶子节点链表，顺序IO** ✅ |

B+树的**核心优势**：
- 非叶子节点只存索引key（不存数据）→ 一个16KB页可存**1170个key**
- 3层B+树可存 **1170² ≈ 16亿条** 记录
- 叶子节点形成**有序链表** → 范围查询走顺序IO

#### 极兔订单表索引设计

```sql
CREATE TABLE `express_order` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `waybill_no` VARCHAR(32) NOT NULL COMMENT '快递单号',
  `sender_phone` VARCHAR(20) COMMENT '寄件人手机',
  `receiver_phone` VARCHAR(20) COMMENT '收件人手机',
  `status` TINYINT NOT NULL COMMENT '状态：1待揽收 2运输中 3派送中 4已签收',
  `courier_id` BIGINT COMMENT '配送快递员ID',
  `create_time` DATETIME NOT NULL,
  `sign_time` DATETIME COMMENT '签收时间',
  INDEX `idx_waybill` (`waybill_no`),                       -- 单号查询，唯一
  INDEX `idx_courier_status` (`courier_id`, `status`),       -- 快递员查看任务列表
  INDEX `idx_status_create` (`status`, `create_time`),       -- 按状态筛选+时间排序
  INDEX `idx_receiver_phone` (`receiver_phone`)              -- 收件人查件
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### 5. 项目中遇到的并发问题（实战）

**场景**：极兔快递员抢单（多个快递员同时抢同一包裹派送权）

```java
// ❌ 问题：并发抢单导致同一包裹被多个快递员接单
// 使用 Redis 分布式锁解决

public boolean grabOrder(Long parcelId, Long courierId) {
    String lockKey = "grab:lock:" + parcelId;
    RLock lock = redisson.getLock(lockKey);
    
    try {
        if (lock.tryLock(2, 5, TimeUnit.SECONDS)) {
            // 1. 检查包裹是否已被抢
            String owner = redis.get("parcel:owner:" + parcelId);
            if (owner != null) {
                return false; // 已被抢
            }
            // 2. 分配
            redis.set("parcel:owner:" + parcelId, String.valueOf(courierId));
            db.updateParcelOwner(parcelId, courierId);
            return true;
        }
        return false;
    } finally {
        if (lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }
}
```

> ⚠️ **踩坑**：一定要用 `lock.isHeldByCurrentThread()` 判断，避免非持有者解锁。

---

### 6. Spring 三级缓存

```java
// Spring 三级缓存（解决循环依赖）
// 第一级：singletonObjects     → 完全初始化好的 Bean
// 第二级：earlySingletonObjects → 提前曝光的 Bean（半成品）
// 第三级：singletonFactories   → 创建 Bean 的工厂方法
```

**执行流程**（A依赖B，B依赖A）：
```
① 创建A → 放入三级缓存（工厂方法）
② A注入B → 发现B未创建
③ 创建B → 放入三级缓存（工厂方法）
④ B注入A → 从三级缓存拿到A的工厂，生成半成品A到二级缓存
⑤ B创建完成 → 放入一级缓存
⑥ A拿到B → 创建完成 → 从二级缓存移到一级缓存
```

> 如果只有两级缓存（没有工厂方法那一层），对于**AOP代理对象**，就无法在提前曝光时拿到正确的代理。

---

### 7. 反问推荐

> "极兔后端系统中，Redis 主要用于哪些核心业务场景？团队平时是如何做 Redis 集群维护的？"

体现出你对极兔业务的理解 + 对中间件运维的关注。

---

## 💡 面试总结

极兔二面侧重 **Java并发 + Redis实战 + 分布式锁 + 索引设计**，题目不算深，但要求**结合公司业务场景**回答。回答时把知识点落到物流场景（快递单、抢单、派件队列）上，会加分很多。