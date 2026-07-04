---
schema_version: 1
question_id: 14
question: "Redis 分布式锁怎么实现？Redisson 的看门狗（Watchdog）机制是什么？Redis 单节点和 Redis Cluster 下的分布式锁有什么区别？"
date: 2026-06-03
sources:
  - unknown
score: "7/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
# 第14题 — Redis 分布式锁深入

> **题目**：Redis 分布式锁怎么实现？Redisson 的看门狗（Watchdog）机制是什么？Redis 单节点和 Redis Cluster 下的分布式锁有什么区别？
> 追问1：Redisson 的看门狗默认多久续期一次？如果业务执行时间超过了最大重试次数会怎样？
> 追问2：Redis Cluster 下用 SETNX 加锁有什么问题？RedLock 算法了解吗？
> 追问3：用 Lua 脚本实现一个可重入的分布式锁，怎么设计？
> 补充追问：Java 调用 Lua 脚本可能并发吗？

---

## 得分：7/10

### ✅ 答对的部分
| 要点 | 评价 |
|------|------|
| SETNX + 过期时间 | ✅ 正确 |
| 看门狗：监控线程，到期前续期 | ✅ 核心概念正确 |
| 分布式要考虑主从/集群 | ✅ 关键点 |
| 时钟偏移 + GC 停顿 | ✅ RedLock 的痛点 |
| RedLock：集群加锁才算成功 | ✅ 概念正确，多数节点成功 |
| Lua 脚本：先判断再设置 | ✅ 思路对 |

### ❌ 问题
| 扣分点 | 扣分 |
|--------|------|
| 看门狗检测时间说错：默认30s租约，每10s检测续期（不是30s检测一次） | -0.5 |
| SETNX + 过期时间的原子性问题没提（需要 Lua 或 SET EX NX） | -1 |
| 看门狗续期到什么时候停？业务完成自动释放，Redisson 内部是后台线程续 | -0.5 |
| RedLock 没说具体算法步骤（N/2+1 节点成功）和争议（Martin Kleppmann 批评） | -1 |

---

## 一、Redis 分布式锁实现演进

### 方案1：SETNX + EXPIRE（非原子，有坑）

```java
// ❌ 错误写法：SETNX 和 EXPIRE 是两条命令，不原子
redis.setnx("order_lock:1001", "thread-1");
redis.expire("order_lock:1001", 30);  // 如果这行之前进程挂了，锁永远不会释放
```

### 方案2：SET EX NX（原子操作，生产可用）

```java
// ✅ SET key value EX seconds NX（Redis 2.6.12+）
// NX: only if Not eXists（不存在才设置）
// EX: 过期时间（秒）
Boolean ok = redisTemplate.execute((RedisCallback<Boolean>) conn ->
    conn.set("order_lock:1001".getBytes(), "thread-1".getBytes(),
             Expiration.seconds(30),
             RedisStringCommands.SetOption.SET_IF_ABSENT));

if (Boolean.TRUE.equals(ok)) {
    try {
        // 执行业务
    } finally {
        // 释放锁（需要 Lua 保证原子性）
        redisTemplate.execute((RedisCallback<Void>) conn -> {
            conn.eval("if redis.call('get',KEYS[1]) == ARGV[1] then " +
                      "return redis.call('del',KEYS[1]) " +
                      "else return 0 end",
                      RedisCallback.Returns.INTEGER,
                      List.of("order_lock:1001"),
                      List.of("thread-1"));
            return null;
        });
    }
}
```

### 方案3：Redisson（生产首选，封装了看门狗）

```java
RLock lock = redissonClient.getLock("order_lock:1001");

try {
    // lock(leaseTime, unit)：这里的 10 秒是锁持有时间，不是获取锁的等待超时
    // 不传 leaseTime 时使用默认 30s，并启动看门狗自动续期
    lock.lock(10, TimeUnit.SECONDS);
    // 或
    // tryLock(waitTime, leaseTime, unit)：5 秒内抢不到就返回 false，抢到后 30 秒自动释放
    // boolean locked = lock.tryLock(5, 30, TimeUnit.SECONDS);
    
    // 执行业务
    orderService.createOrder(order);
} finally {
    if (lock.isHeldByCurrentThread()) {
        lock.unlock();
    }
}
```

---

## 二、看门狗（Watchdog）机制详解

### 核心原理

```
Redisson 看门狗是 Redisson 内部的一个后台调度线程
名字叫 "redisson-watchdog-thread"
```

```
默认参数：
  - 租约时间（leaseTime）：30秒
  - 看门狗检测间隔：10秒（租约时间的 1/3）
  - 自动续期到：30秒
```

```
时间线：
0s       10s       20s       30s
|---------|---------|---------|
├─ 加锁 ──┤
│         ├─ 第1次续期 ──┤
│         │  续到30s     │
│         │              ├─ 第2次续期 ──┤
│         │              │  续到30s     │
│         │              │              ├─ 业务完成，手动unlock()
```

### 什么时候停？

```
情况1：业务正常完成 → 手动调用 lock.unlock() → 看门狗停止续期 → 锁释放

情况2：持有锁的 JVM 宕机 → 看门狗线程死亡，无法续期 → 30秒后锁自动过期 → 其他线程可以获取

情况3：业务执行超过30秒但没宕机 → 看门狗每10秒续期一次 → 锁不会过期 → 业务能执行完
       （这就是看门狗的价值：防止业务没执行完锁就过期了）
```

### 看门狗源码核心逻辑（简化）

```java
// Redisson 内部简化逻辑
private void scheduleExpirationRenewal() {
    // 每 10 秒（leaseTime / 3）执行一次续期
    renewalTask = executor.schedule(() -> {
        if (isHeldByCurrentThread()) {
            // 续期：重新设置过期时间为 30 秒
            redis.expire(lockKey, 30, TimeUnit.SECONDS);
            // 递归调用，继续下一轮续期
            scheduleExpirationRenewal();
        }
    }, 10, TimeUnit.SECONDS);  // 10秒后执行
}

// 调用 unlock() 时停止续期
public void unlock() {
    // 1. 释放锁
    // 2. 取消 renewalTask
    renewalTask.cancel(false);
}
```

---

## 三、SETNX + 过期时间的原子性问题

```java
// 为什么需要原子性？
// 场景：SETNX 成功后，还没执行 EXPIRE，进程就挂了
// 结果：锁永远不释放，死锁

// 解决方案1：SET EX NX（一条命令）
SET lock_key value EX 30 NX

// 解决方案2：Lua 脚本
// 如果 Redis 不支持 SET EX NX（老版本）
EVAL "
  if redis.call('setnx', KEYS[1], ARGV[1]) == 1 then
    redis.call('expire', KEYS[1], ARGV[2])
    return 1
  end
  return 0
" 1 lock_key thread-1 30
```

---

## 四、Redis Cluster 下的问题

### 主从切换丢锁

```
时间线：
Client1 → Node A（主）加锁成功
Node A 还没同步到 Node B（从）
Node A 宕机
Node B 升为主
Client2 → Node B 加锁成功
现在 Client1 和 Client2 同时持有锁！❌
```

### RedLock 算法（解决集群丢锁问题）

```
前提：至少5个独立的 Redis 节点（不是主从关系，是独立部署）

步骤：
1. 获取当前时间 T1
2. 依次向 5 个节点发送 SET EX NX 加锁请求（超时时间很短，如50ms）
3. 计算加锁耗时 = 当前时间 - T1
4. 如果在 3 个以上节点加锁成功（N/2+1），且耗时 < 锁的过期时间 → 加锁成功
5. 锁的有效时间 = 过期时间 - 加锁耗时
6. 如果加锁失败，向所有节点发送释放锁请求
```

```
示例（5个节点）：
Node1 ✅ Node2 ✅ Node3 ✅ Node4 ❌ Node5 ✅
→ 3/5 成功（超过半数）→ 加锁成功

Node1 ✅ Node2 ✅ Node3 ❌ Node4 ❌ Node5 ✅
→ 3/5 成功（超过半数）→ 加锁成功

Node1 ✅ Node2 ❌ Node3 ❌ Node4 ❌ Node5 ✅
→ 2/5 成功（不到半数）→ 加锁失败
```

### RedLock 的争议（Martin Kleppmann 批评）

```
问题1：时钟跳跃
  节点的系统时钟可能发生跳跃（如NTP同步）
  导致锁提前过期

问题2：GC停顿
  Client1 获取锁后，JVM发生长时间GC
  锁过期了，Client2获取锁
  Client1 GC结束，以为自己还持有锁 → 两个客户端同时操作

问题3：网络延迟
  请求在途中耗时过长，到达节点时锁已过期
```

### 实际生产怎么选？

```
| 场景 | 方案 |
|------|------|
| 单 Redis 实例 | SET EX NX + Lua 释放 |
| Redis 主从（容忍偶尔不一致） | SET EX NX，业务层幂等兜底 |
| Redis Cluster（高可用） | Redisson（内置了对集群的支持） |
| 极高一致性要求（金融） | RedLock 或 ZooKeeper/etcd |
| 最稳妥 | ZooKeeper 临时顺序节点（CP系统） |
```

---

## 五、Lua 脚本实现可重入分布式锁

### 数据结构设计

```
Redis 中用 Hash 存储锁信息：
  Key:   lock:order:1001
  Field: thread-uuid    （持有锁的线程标识）
  Value: 重入次数        （同一线程可以多次加锁）
```

### 加锁 Lua 脚本

```lua
-- KEYS[1]: 锁的key，如 "lock:order:1001"
-- ARGV[1]: 线程唯一标识，如 "thread-uuid-123"
-- ARGV[2]: 过期时间（秒）

-- 1. 判断锁是否已被持有
if redis.call('exists', KEYS[1]) == 0 then
    -- 锁不存在，直接加锁
    redis.call('hset', KEYS[1], ARGV[1], 1)
    redis.call('expire', KEYS[1], ARGV[2])
    return 1
end

-- 2. 锁已存在，判断是否是当前线程重入
if redis.call('hexists', KEYS[1], ARGV[1]) == 1 then
    -- 是当前线程重入，重入次数+1
    redis.call('hincrby', KEYS[1], ARGV[1], 1)
    -- 重新设置过期时间（续期）
    redis.call('expire', KEYS[1], ARGV[2])
    return 1
end

-- 3. 是其他线程持有锁，返回剩余过期时间（用于等待重试）
return redis.call('pttl', KEYS[1])
```

### 解锁 Lua 脚本

```lua
-- KEYS[1]: 锁的key
-- ARGV[1]: 线程唯一标识

-- 1. 判断当前线程是否持有锁
if redis.call('hexists', KEYS[1], ARGV[1]) == 0 then
    return nil  -- 不是当前线程的锁，不释放
end

-- 2. 重入次数减1
local counter = redis.call('hincrby', KEYS[1], ARGV[1], -1)

-- 3. 如果重入次数为0，删除锁
if counter == 0 then
    redis.call('del', KEYS[1])
    return 1
end

-- 4. 还有重入，不删除，只减了次数
return 0
```

### Java 调用

```java
@Component
public class RedisLock {

    @Autowired
    private RedisScript<Long> lockScript;   // 加锁脚本
    @Autowired
    private RedisScript<Long> unlockScript; // 解锁脚本
    @Autowired
    private StringRedisTemplate redisTemplate;

    private final ThreadLocal<String> lockId = new ThreadLocal<>();

    public boolean tryLock(String key, long expireSeconds) {
        String uuid = UUID.randomUUID().toString();
        lockId.set(uuid);

        // 执行加锁 Lua 脚本
        Long result = redisTemplate.execute(
            lockScript,
            List.of("lock:" + key),
            uuid,
            String.valueOf(expireSeconds)
        );
        return result != null && result == 1;
    }

    public void unlock(String key) {
        String uuid = lockId.get();
        if (uuid == null) return;

        redisTemplate.execute(
            unlockScript,
            List.of("lock:" + key),
            uuid
        );
        lockId.remove();
    }
}
```

---

## 六、Java 调用 Lua 脚本的并发问题

### 核心结论：Java 并发调 Lua 不需要额外加锁

```
Java 线程1 ──EVAL lua──→ ┐
Java 线程2 ──EVAL lua──→ ├─→ Redis（单线程）→ 逐条执行，每条 EVAL 是原子的
Java 线程3 ──EVAL lua──→ ┘
```

Redis 是单线程模型，所有命令（包括 EVAL）串行执行。100个 Java 线程同时调 EVAL，Redis 也一个一个处理，每个 Lua 脚本执行过程中不会被其他命令打断。

### Java 调用 Lua 的方式

```java
// 方式1：RedisTemplate + DefaultRedisScript（Spring 常用）

// 注册脚本
@Bean
public DefaultRedisScript<Long> lockScript() {
    DefaultRedisScript<Long> script = new DefaultRedisScript<>();
    script.setLocation(new ClassPathResource("lock.lua")); // 从classpath加载文件
    script.setResultType(Long.class);
    return script;
}

// 调用
Long result = redisTemplate.execute(
    lockScript,
    List.of("lock:order:1001"),  // KEYS 数组
    "thread-uuid-123",           // ARGV[1]
    "30"                         // ARGV[2]
);

// 本质：RedisTemplate 内部发送 EVAL <script> <numkeys> key... arg...
```

```java
// 方式2：裸 Jedis 调用
Jedis jedis = new Jedis("localhost", 6379);
String script = "if redis.call('exists',KEYS[1]) == 0 then " +
                "redis.call('set',KEYS[1],ARGV[1],'EX',ARGV[2],'NX') " +
                "return 1 end return 0";
Object result = jedis.eval(script, List.of("lock:key"), List.of("thread-1", "30"));
```

```
Java 应用
    │
    │  EVAL "lua脚本内容" 1 "lock:key" "thread-id" "30"
    ▼
Redis 服务端
    │
    │  1. 接收 Lua 脚本
    │  2. 服务端直接执行（原子的！）
    │  3. 返回结果
    ▼
Java 收到返回值
```

---

## 七、面试回答模板

**Redis 分布式锁怎么实现？**

> 最简单的方案是 SET key value EX 30 NX，一条命令原子完成加锁+设过期时间。释放锁用 Lua 脚本，先判断持有者再删除，防止误删别人的锁。
> 
> 生产中用 Redisson，它封装了看门狗机制——后台线程每10秒检测一次，如果业务没执行完就自动续期到30秒，防止业务没跑完锁就过期了。JVM宕机后看门狗死亡，30秒后锁自动过期释放。
> 
> Redis Cluster 下的问题是主从切换可能丢锁，RedLock 通过向N个独立节点加锁、多数成功才算成功来解决，但有 GC 停顿和时钟偏移的争议。实际生产中如果对一致性要求不是特别高，Redisson + 业务幂等就够用了；金融级场景建议用 ZooKeeper。
