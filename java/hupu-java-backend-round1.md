# 虎扑后端Java一面面经

> 来源：小红书 | 日期：2026-05-26 | 时长：45分钟

## 面试概览

- **公司**：虎扑
- **岗位**：后端Java开发
- **轮次**：一面
- **面试风格**：侧重并发编程 + 线程底层（进阶基础向），基础为辅，侧重原理和场景落地

---

## 一、Java并发核心

### 1. Java线程的6种生命周期状态，以及状态之间的流转场景

**答题思路**：

6种状态：
- **新建（NEW）** → `new Thread()`
- **就绪（RUNNABLE）** → `start()`，等待CPU时间片
- **运行（RUNNING）** → 获取CPU时间片执行
- **阻塞（BLOCKED）** → 等待锁（synchronized隐式锁）
- **等待（WAITING）** → `wait()`, `join()`, `park()` 无限期等待
- **超时等待（TIMED_WAITING）** → `sleep(time)`, `wait(time)`, `parkNanos()`
- **终止（TERMINATED）** → 执行完毕/异常退出

**核心流转**：
```
NEW → start() → RUNNABLE → 获取CPU → RUNNING
RUNNING → sleep/wait/lock竞争 → BLOCKED/WAITING/TIMED_WAITING → 条件满足 → RUNNABLE
RUNNING → 执行完毕/异常 → TERMINATED
```

### 2. synchronized 和 ReentrantLock 的区别，各自适用场景

**答题思路**：

| 维度 | synchronized | ReentrantLock |
|------|-------------|---------------|
| 性质 | JVM原生锁，隐式加解锁 | API层面锁，显式加解锁 |
| 可重入 | ✅ 可重入 | ✅ 可重入 |
| 公平性 | ❌ 非公平 | ✅ 支持公平/非公平 |
| 中断响应 | ❌ 不支持 | ✅ 可中断 `lockInterruptibly()` |
| 超时 | ❌ 不支持 | ✅ 可限时 `tryLock(time)` |
| 条件变量 | ❌ 一个条件 | ✅ 多个 `Condition` 对象 |
| 释放 | 自动释放（异常也释放） | 必须手动 `unlock()`（finally释放） |

**适用场景**：
- 简单同步 → `synchronized`（代码简洁，自动释放）
- 复杂并发控制（限时锁、公平锁、多条件） → `ReentrantLock`

### 3. ThreadLocal 底层原理，是否存在内存泄漏问题及解决方案

**答题思路**：

**原理**：
- 每个线程持有自己的 `ThreadLocalMap`
- 键为**弱引用** `ThreadLocal` 对象
- 值为线程独立副本

**内存泄漏问题**：
- 当线程池中的线程常驻时，`ThreadLocal` 的 key 被 GC 回收（弱引用）
- 但 **value 是强引用**，无法被回收 → 内存泄漏

**解决方案**：
- **每次使用完毕调用 `remove()` 方法清除数据**
- 用 `try-finally` 确保即使异常也能清理

### 4. 线程池核心参数，`newFixedThreadPool` 为什么不推荐使用

**核心参数**：
- `corePoolSize`：核心线程数
- `maximumPoolSize`：最大线程数
- `keepAliveTime` + `TimeUnit`：空闲线程存活时间
- `workQueue`：任务队列（BlockingQueue）
- `threadFactory`：线程工厂
- `RejectedExecutionHandler`：拒绝策略

**为什么不用 `newFixedThreadPool`**：
- 它使用 **无界队列** `LinkedBlockingQueue`（默认容量 `Integer.MAX_VALUE`）
- 高并发下任务**无限堆积**，导致 **OOM 内存溢出**
- ⚠️ 生产环境禁止直接使用 Executors 工厂方法，必须手动 `new ThreadPoolExecutor()` 指定有界队列

---

## 二、基础补充提问

### 1. `volatile` 关键字的作用，能否保证原子性？

**作用**：
- **可见性**：写操作立即刷新到主存，读操作直接从主存读
- **有序性**：禁止指令重排序（内存屏障）

**不保证原子性**：
- `volatile` 不能保证复合操作的原子性，如 `count++`（读-改-写三步）
- 复合操作需要 `synchronized` 或 `Atomic` 类

### 2. 乐观锁和悲观锁的实现方式及业务场景

| 类型 | 实现方式 | 适用场景 |
|------|----------|----------|
| 悲观锁 | `synchronized`, `ReentrantLock`, 数据库 `SELECT ... FOR UPDATE` | 写多读少，冲突频繁 |
| 乐观锁 | CAS（`AtomicInteger`），版本号/时间戳 | 读多写少，冲突概率低 |

---

## 三、场景题

### 1. 接口高并发请求下，如何避免超卖问题？（简单口述方案）

**方案组合**：
1. **Redis 分布式锁**（Redisson） → 扣减库存前加锁
2. **Redis 原子操作** → `DECR` 原子扣减，扣到负数则回滚
3. **数据库乐观锁** → `UPDATE ... WHERE stock > 0 AND version = ?`
4. **令牌桶/漏桶限流** → 防止流量洪峰冲垮系统
5. **库存预扣 + 延时队列** → 下单预扣库存，未支付超时释放

---

## 面试总结

虎扑社区帖子、评论接口高并发场景多，一面对**并发编程**考察较深，重点关注：
- 线程安全、线程生命周期
- 锁机制（synchronized vs ReentrantLock）
- 线程池原理 & 参数调优
- 高并发场景落地（超卖、性能优化）

> 对比：偏向**并发体系**而非分布式/微服务，说明虎扑一面侧重基础扎实度。
