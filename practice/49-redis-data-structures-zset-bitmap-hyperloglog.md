---
question: 第49题 · Redis · ZSet/Bitmap/HyperLogLog 数据结构底层和场景
date: 2026-07-03
score: 3/10
round: R0（初次完成）
next_review: 2026-07-04 (R1)
source: tencent/2026-06-07-tencent-ai-backend-round1-xhs.md; java/megvii-java-round1-12-questions.md; java/hupu-java-backend-round2-redis-distributed.md
---

## 第49题 · Redis · ZSet/Bitmap/HyperLogLog 数据结构底层和场景

**题目**：Redis 常用数据结构底层和场景：ZSet、Bitmap、HyperLogLog 怎么用？

### 用户回答

> ZSet 是有序集合，里面是有序的，根据某个字段排序的。不知道底层结构。Bitmap 是比特位图，一个用户一个比特。HyperLogLog 统计会有一点点误差。Set 是集合。

### 评分：3/10

### 扣分点
1. ZSet 底层结构没答（跳表+哈希表）（-2）
2. 三种结构的实际业务场景没展开（-2）
3. HyperLogLog 原理没答（-2）
4. Set 和 ZSet 区别没答（-1）

### 核心纠正
- ZSet 底层是跳表（SkipList）+ 哈希表（HashTable），不是单一结构
- HyperLogLog 的核心是 Hash 前导零概率估算，桶数量固定 16384 个
- 哈希算法的质量比桶数量更关键

---

## 一、ZSet（有序集合）

### 底层结构：跳表（SkipList） + 哈希表（HashTable）

```
ZSet 内部有两个数据结构并存：

1. 跳表（SkipList）：存储 (score, member) 的有序链表
   → 支持范围查询：ZRANGEBYSCORE、ZRANK
   → 查找复杂度：O(logN)

2. 哈希表（HashTable）：存储 member → score 的映射
   → 支持 O(1) 单点查找：ZSCORE

为什么两个都保留？
  跳表擅长范围查询，但单点查找是 O(logN)
  哈希表擅长单点查找 O(1)，但不支持范围查询
  两个组合 = 既能范围查又能单点查
```

### 跳表原理

```
原始链表：1 → 3 → 5 → 7 → 9 → 12 → 15

加一层索引：
Level 2: 1 ────────→ 7 ────────→ 15
Level 1: 1 ──→ 5 ──→ 7 ──→ 12 ──→ 15
Level 0: 1 → 3 → 5 → 7 → 9 → 12 → 15

查找 9：
  Level 2: 1 → 7（跳过 3,5）→ 15（太大，回退）
  Level 1: 7 → 12（太大，回退）
  Level 0: 7 → 9 ✅

时间复杂度：O(logN)，和二分查找一样
```

### 实际业务场景

```java
// 场景1：排行榜
ZADD rank 100 "player1"
ZADD rank 200 "player2"
ZREVRANGE rank 0 9 WITHSCORES   // TOP 10，O(logN + 10)
ZREVRANK rank "player1"          // 某人排名，O(logN)

// 场景2：延迟队列（score = 执行时间戳）
ZADD delay_queue 1720000000 "task1"
ZRANGEBYSCORE delay_queue 0 当前时间戳  // 取到期任务
ZREM delay_queue "task1"               // 取后删除

// 场景3：滑动窗口限流
ZADD rate_limit:user1 当前时间戳 UUID
ZREMRANGEBYSCORE rate_limit:user1 0 (当前时间戳-60000)
ZCARD rate_limit:user1  // 窗口内请求数
```

---

## 二、Bitmap（位图）

### 底层结构：Redis String，用二进制位存储

```
本质是一个 byte 数组，每个 bit 代表一个状态

用户签到示例：
  bit位置:  7 6 5 4 3 2 1 0
  user1:   1 0 1 1 0 1 0 0   → 1号、3号、4号、6号签到了
```

### 1 亿用户签到设计

```java
// 每人每月一个 Bitmap
SETBIT sign:2026-07:{userId} (day-1) 1

// 统计某天签到人数
BITCOUNT sign:2026-07-01

// 统计连续签到
BITOP AND sign:2026-07-01 sign:2026-07-02 sign:2026-07-03
BITCOUNT sign:2026-07-01  // 三天都签到的人数

// 内存占用
1 亿用户 × 31 天 × 1 bit ≈ 37MB（Set 要几个 GB）
```

### 适用场景

```
✅ 用户签到、在线状态、特征标签、布隆过滤器
❌ 需要存储具体值（只能存 0/1）、用户 ID 不连续、需要删除
```

---

## 三、HyperLogLog（基数统计）

### 解决什么问题

统计不重复元素数量（基数），允许误差 0.81%，固定 12KB 内存

### 底层原理

```
核心思想：用 Hash 前导零的长度估算元素数量

Hash("user1") = 00010110...   → 前导零 3 个
Hash("user2") = 00000011...   → 前导零 6 个

概率关系：
  前导零 1 个 → 大约 2 个元素
  前导零 3 个 → 大约 8 个元素
  前导零 6 个 → 大约 64 个元素
  前导零 N 个 → 估算 2^N 个元素

比喻：掷硬币连续 N 个正面的概率 = 1/2^N
  看到连续 10 个正面 → 估算至少掷了 1024 次
```

### 为什么只用 12KB

```
16384 个桶（2^14），每个桶存 6 bit（最大前导零长度）
= 16384 × 6 / 8 = 12,288 字节 = 12KB

流程：
  元素进来 → Hash → 前 14 位决定去哪个桶 → 后面位数算前导零
  → 每个桶记录最大前导零 → 最后取调和平均修正误差
```

### 精度与哈希算法

```
| 数据量      | 相对误差  | 绝对误差    | 建议         |
|------------|----------|------------|-------------|
| < 1000     | 10-20%   | 几十个      | 用 Set       |
| 1000~1万   | 收敛中    | 几百        | HLL 开始划算  |
| > 1万      | 稳定 0.81%| 比例固定    | HLL 完胜     |

哈希算法是根基：
  MurmurHash → 分布均匀 → 误差 0.81% ✅
  烂哈希      → 分布不均 → 误差可能 30% ❌
  桶再多也没用，数据源头歪了就全废
```

### 用法

```java
PFADD page:uv "user1" "user2" "user3"  // 添加
PFCOUNT page:uv                          // 统计基数（近似）
PFMERGE page:uv:week page:uv:day1 page:uv:day2  // 合并统计
```

---

## 四、Set vs ZSet

```
| 维度       | Set                    | ZSet                      |
|-----------|------------------------|---------------------------|
| 有序性     | 无序                   | 有序（按 score 排序）       |
| 底层结构   | HashMap（只有 key）     | 跳表 + 哈希表              |
| 查找       | O(1)                   | O(logN)                   |
| 范围查询   | ❌ 不支持               | ✅ ZRANGEBYSCORE          |
| 典型场景   | 标签、共同好友、抽奖      | 排行榜、延迟队列、限流       |
```

---

## 五、其他数据结构速查

```
| 结构      | 底层             | 场景                          |
|----------|-----------------|-------------------------------|
| String   | SDS             | 缓存、计数器、分布式锁           |
| List     | quicklist       | 消息队列、最新列表               |
| Hash     | ziplist/hashtable| 对象存储、购物车                |
| Set      | hashtable       | 标签、共同好友、抽奖              |
| ZSet     | skiplist+hashtable| 排行榜、延迟队列、限流           |
| Stream   | radix tree      | 消息队列（替代 List/PubSub）     |
```
