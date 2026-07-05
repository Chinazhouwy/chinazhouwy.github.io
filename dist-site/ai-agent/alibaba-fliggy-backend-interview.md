# 阿里飞猪后端面经（深度版）

> **来源**: [小红书](http://xhslink.com/o/2yDW3vtDMME)
> **发布日期**: 2026-05
> **标签**: `阿里飞猪` `后端` `Java基础` `JVM` `并发` `缓存` `MQ` `RAG` `MCP` `Skill`
> **考点分类**: Java并发 / JVM / 线程池 / 缓存 / 消息队列 / AI Agent（RAG/MCP/Skill/上下文工程）

---

## 面试结构

- **Java并发**（Q1-Q4）：HashMap、ConcurrentHashMap、synchronized vs ReentrantLock、锁粒度
- **JVM**（Q5-Q8）：内存区域、GC、Full GC排查、JVM调优
- **线程池**（Q9-Q12）：底层实现、为什么不用Executors、阻塞队列、参数设置
- **缓存**（Q13-Q16）：击穿/穿透/雪崩、布隆过滤器、误判、本地缓存一致性
- **高并发+MQ**（Q17-Q19）：QPS百倍提升、MQ可靠消费、幂等
- **AI Agent**（Q20-Q28）：AI Coding、LLM、RAG、向量检索vs BM25、MCP/Tool、Skill、上下文工程、Harness
- **反问**：AI在工作中的使用比例

---

## Java并发（Q1-Q4）

### Q1: HashMap底层原理，是否线程安全，并发时会有什么问题？

**答题思路**：JDK 7数组+链表 → JDK 8数组+链表/红黑树，重点讲并发问题。

**深度解答**：

**底层原理**：
- **JDK 7**：数组 + 链表（头插法）
- **JDK 8**：数组 + 链表 + 红黑树（尾插法），链表长度>8且数组≥64时转红黑树

**核心流程**：
1. `put(key, value)`：计算hash → 定位数组下标 → 遍历链表/树 → 插入/更新
2. `resize()`：扩容2倍 → 重新hash分配
3. `get(key)`：计算hash → 定位 → 遍历查找

**是否线程安全：否！**

**并发问题**：
1. **JDK 7 死循环**：并发resize时，头插法导致链表成环 → get时死循环（CPU 100%）
2. **JDK 8 数据丢失**：并发put时，两个线程同时判断链表末尾为null，后写入的覆盖先写入的
3. **size()不准确**：并发put时size统计不精确
4. **ConcurrentModificationException**：遍历时修改抛异常（fail-fast机制）

```java
// JDK 8 HashMap put核心逻辑（简化）
public V put(K key, V value) {
    int hash = key.hashCode() ^ (key.hashCode() >>> 16); // 扰动函数
    int n = table.length;
    int i = (n - 1) & hash; // 定位数组下标（等价取模，但更快）

    if (table[i] == null) {
        // CAS插入（JDK8用cas保证首节点插入安全，但后续操作不安全）
        table[i] = new Node<>(hash, key, value, null);
    } else {
        // 遍历链表/红黑树 → 插入或更新
        // ⚠️ 并发问题：两个线程可能同时走到这里，导致数据覆盖
    }
}
```

**工程踩坑点**：
- 不要用`Collections.synchronizedMap(new HashMap<>())`——性能差，全表锁
- 多线程场景直接用ConcurrentHashMap，不要试图在HashMap外加锁
- JDK 8虽然修复了死循环，但数据丢失问题仍在

---

### Q2: ConcurrentHashMap底层原理

**答题思路**：JDK 7分段锁 → JDK 8 CAS+synchronized，要讲清锁粒度的进化。

**深度解答**：

| 版本 | 锁机制 | 锁粒度 | 并发度 |
|------|--------|--------|--------|
| JDK 7 | ReentrantLock（Segment） | 段级别（16段） | 16 |
| JDK 8 | CAS + synchronized | 桶级别（每个数组槽） | 数组长度 |

**JDK 8 核心实现**：
1. **插入首节点**：CAS操作，无锁
2. **插入链表/树**：synchronized锁住首节点（头节点做锁对象）
3. **扩容**：多线程协同扩容（transfer），每个线程负责一段

```java
// JDK 8 ConcurrentHashMap put核心逻辑（简化）
public V put(K key, V value) {
    int hash = spread(key.hashCode());
    int i = (tab.length - 1) & hash;

    if (tab[i] == null) {
        // 首节点CAS插入——无锁
        if (casTabAt(tab, i, null, new Node<>(hash, key, value)))
            break;
    } else {
        // 非首节点——synchronized锁住头节点
        synchronized (tab[i]) {
            // 遍历链表/红黑树，插入或更新
        }
    }
    // 检查是否需要转红黑树（链表>8）或扩容（元素>0.75*capacity）
}
```

**为什么JDK 8比JDK 7好**：
- 锁粒度更细：16段 → N个桶，并发度大幅提升
- CAS首节点：无竞争时完全无锁，性能更好
- 协同扩容：多线程一起扩容，而不是单线程扩容其他等待

**工程踩坑点**：
- ConcurrentHashMap不能替代所有同步——`putIfAbsent`是原子的，但"先get再put"组合操作不是原子的
- `computeIfAbsent`可以做原子条件插入——比`get + put`安全且高效
- JDK 8的ConcurrentHashMap key/value不能为null——和HashMap不同

---

### Q3: synchronized和ReentrantLock有什么区别？该如何选择？

**答题思路**：不是简单列区别，要讲清底层机制差异和选型原则。

**深度解答**：

| 维度 | synchronized | ReentrantLock |
|------|-------------|---------------|
| 实现层级 | JVM内置（monitorenter/monitorexit） | JDK API层（AQS） |
| 锁获取 | 不可中断 | 可中断（lockInterruptibly） |
| 公平性 | 非公平 | 可选公平/非公平 |
| 条件变量 | 一个（wait/notify） | 多个（Condition） |
| 锁超时 | 不支持 | tryLock(timeout) |
| 释放方式 | 自动（退出同步块） | 手动（finally中unlock） |
| 可重入 | 是 | 是 |
| 性能 | JDK6+优化后差距不大 | 高竞争时略优 |

**选型原则**：
- **默认用synchronized**：简单、安全、JVM优化好
- **需要高级功能时用ReentrantLock**：可中断、超时获取、公平锁、多条件变量

```java
// 场景1: 需要超时获取锁——防止死锁
ReentrantLock lock = new ReentrantLock();
if (lock.tryLock(5, TimeUnit.SECONDS)) {
    try {
        // 获取到锁
    } finally {
        lock.unlock();
    }
} else {
    // 获取锁超时，降级处理
}

// 场景2: 需要多个条件变量——生产者-消费者
ReentrantLock lock = new ReentrantLock();
Condition notFull = lock.newCondition();  // 缓冲区不满
Condition notEmpty = lock.newCondition(); // 缓冲区不空

// 生产者：缓冲区满时等待notFull
lock.lock();
try {
    while (buffer.isFull()) notFull.await();
    buffer.add(item);
    notEmpty.signal(); // 通知消费者
} finally { lock.unlock(); }

// 场景3: 简单同步——直接synchronized
synchronized (this) {
    // 简单互斥，不需要高级功能
}
```

**工程踩坑点**：
- ReentrantLock必须在finally中unlock——否则异常时锁不释放，其他线程永远等待
- synchronized在JDK 6后有偏向锁→轻量级锁→重量级锁的升级，大部分场景不需要ReentrantLock
- 公平锁性能差10-100倍——除非严格要求FIFO，否则用非公平锁

---

### Q4: synchronized锁粒度

**答题思路**：锁粒度 = 锁住的范围，要讲清从粗到细的四个层次和JVM的锁优化。

**深度解答**：

**代码层面的锁粒度**：
1. **类锁**：`synchronized (MyClass.class)` — 最粗，所有实例共享
2. **实例锁**：`synchronized (this)` — 当前实例
3. **方法锁**：`synchronized method()` — 等价于实例锁
4. **对象锁**：`synchronized (lockObj)` — 最细，指定锁对象

**JVM层面的锁优化（锁升级）**：
```
无锁 → 偏向锁 → 轻量级锁 → 重量级锁
  ↑       ↑          ↑           ↑
  无竞争  单线程    少量竞争    严重竞争
  不加锁  记录线程ID CAS自旋    OS互斥量
```

**原则：锁的粒度越细越好，但不要过度细分**：
- 太粗：并发度低，性能差
- 太细：锁获取/释放开销大，代码复杂度高
- 最佳实践：只锁住必须互斥的代码块

```java
// ❌ 锁粒度太粗——整个方法加锁
public synchronized void process() {
    validate();      // 不需要锁
    doCompute();     // 需要锁
    logResult();     // 不需要锁
}

// ✅ 只锁需要互斥的部分
public void process() {
    validate();      // 无锁执行
    synchronized (this) {
        doCompute(); // 最小锁粒度
    }
    logResult();     // 无锁执行
}
```

---

## JVM（Q5-Q8）

### Q5: JVM内存区域划分

**答题思路**：线程私有 vs 线程共享，每个区域存什么、什么会溢出。

**深度解答**：

```
┌─────────────────────────────────────────────┐
│  线程私有                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ 程序计数器 │ │  虚拟机栈  │ │  本地方法栈   │ │
│  │(字节码行号)│ │(栈帧/局部 │ │(Native方法)  │ │
│  │ 不会OOM  │ │ 变量/操作数)│ │  可能StackOF │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
├─────────────────────────────────────────────┤
│  线程共享                                     │
│  ┌──────────────────┐ ┌───────────────────┐  │
│  │       堆          │ │   方法区(元空间)    │  │
│  │  对象实例+数组     │ │ 类信息+常量+静态   │  │
│  │  GC主要区域       │ │ JDK8后用本地内存   │  │
│  └──────────────────┘ └───────────────────┘  │
└─────────────────────────────────────────────┘
```

| 区域 | 存储内容 | 异常类型 |
|------|---------|---------|
| 程序计数器 | 当前线程执行的字节码行号 | 唯一不会OOM的区域 |
| 虚拟机栈 | 栈帧（局部变量表、操作数栈、方法返回地址） | StackOverflowError / OOM |
| 本地方法栈 | Native方法的栈帧 | StackOverflowError / OOM |
| 堆 | 对象实例、数组 | OutOfMemoryError |
| 方法区/元空间 | 类信息、常量池、静态变量 | OutOfMemoryError（元空间） |

**JDK 8关键变化**：永久代(PermGen) → 元空间(Metaspace)，使用本地内存，默认无上限。

---

### Q6: 垃圾回收

**答题思路**：判断算法 → 回收算法 → 收集器，三层递进。

**深度解答**：

**判断算法**：
- **引用计数法**：简单但无法处理循环引用（已淘汰）
- **可达性分析**：从GC Roots出发，不可达的对象即为垃圾（当前使用）

**GC Roots包括**：虚拟机栈引用、方法区静态引用、方法区常量引用、本地方法栈JNI引用

**回收算法**：
| 算法 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| 标记-清除 | 标记垃圾→清除 | 简单 | 内存碎片 |
| 标记-整理 | 标记→整理到一端 | 无碎片 | 移动开销大 |
| 复制 | 分两块，存活对象复制到另一块 | 无碎片、快 | 空间利用率50% |

**分代收集**（当前主流）：
- **年轻代**：复制算法（Eden + S0 + S1，8:1:1）
- **老年代**：标记-整理 / 标记-清除

**常见收集器**：
| 收集器 | 分代 | 特点 |
|--------|------|------|
| Serial | 年轻代 | 单线程，Client模式 |
| ParNew | 年轻代 | Serial多线程版 |
| Parallel Scavenge | 年轻代 | 吞吐量优先 |
| CMS | 老年代 | 低延迟，标记-清除（有碎片） |
| G1 | 全代 | 分Region，可预测停顿时间 |
| ZGC | 全代 | 亚毫秒停顿，JDK 15+ |

---

### Q7: 发生Full GC如何排查？

**答题思路**：不是简单列命令，要讲排查流程和常见原因。

**深度解答**：

**排查流程**：

```
1. 确认Full GC频率 → 2. 查看GC日志 → 3. 分析内存对象 → 4. 定位代码 → 5. 修复
```

**具体步骤**：

```bash
# 1. 查看GC概况
jstat -gcutil <pid> 1000  # 每秒输出，看FGC频率和FGCT时间

# 2. 导出堆dump
jmap -dump:live,format=b,file=heap.hprof <pid>

# 3. 分析大对象（用MAT/VisualVM打开dump）
jmap -histo <pid> | head -20  # 快速查看对象数量排行

# 4. 查看线程堆栈（是否有阻塞）
jstack <pid> > thread_dump.txt
```

**常见Full GC原因**：

| 原因 | 特征 | 解决方案 |
|------|------|---------|
| 内存泄漏 | 老年代持续增长，Full GC后不释放 | MAT分析dump，找GC Root引用链 |
| 大对象直接进老年代 | 超过PretenureSizeThreshold | 减小大对象或调整阈值 |
| System.gc() | 代码显式调用 | -XX:+DisableExplicitGC |
| 元空间不足 | Metaspace持续增长 | -XX:MaxMetaspaceSize=256m |
| 内存分配过快 | 年轻代频繁晋升 | 增大年轻代或优化代码 |

**工程踩坑点**：
- 线上要加JVM参数自动dump：`-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/`
- GC日志必须开：`-Xlog:gc*:file=gc.log:time,uptime,level,tags`
- Full GC后老年代还是满的→内存泄漏，必须分析dump

---

### Q8: JVM调优

**答题思路**：调优不是背参数，是定目标→看现状→调参数→验证的过程。

**深度解答**：

**调优目标**：
- 延迟敏感型：最小化GC停顿（CMS/ZGC）
- 吞吐量敏感型：最大化应用运行时间占比（Parallel Scavenge）

**常用参数**：

```bash
# 堆大小
-Xms4g -Xmx4g          # 初始=最大，避免堆动态调整开销

# 年轻代
-Xmn2g                  # 年轻代大小
-XX:SurvivorRatio=8     # Eden:S0:S1 = 8:1:1

# 元空间
-XX:MetaspaceSize=256m -XX:MaxMetaspaceSize=256m

# GC选择
-XX:+UseG1GC            # G1收集器（JDK9默认）
-XX:MaxGCPauseMillis=200 # G1目标停顿时间

# GC日志
-Xlog:gc*:file=gc.log:time,uptime,level,tags
```

**调优思路**：
1. 先定目标：停顿<100ms or 吞吐量>95%
2. 压测+观察GC日志：jstat看频率，GC日志看停顿
3. 针对性调整：停顿长→换收集器或调MaxGCPauseMillis；吞吐低→增大堆或年轻代
4. 线上灰度验证

---

## 线程池（Q9-Q12）

### Q9: 线程池底层实现

**答题思路**：核心是ThreadPoolExecutor的7个参数和执行流程。

**深度解答**：

```java
public ThreadPoolExecutor(
    int corePoolSize,        // 核心线程数（常驻）
    int maximumPoolSize,     // 最大线程数
    long keepAliveTime,      // 非核心线程空闲存活时间
    TimeUnit unit,           // 时间单位
    BlockingQueue<Runnable> workQueue,  // 任务队列
    ThreadFactory threadFactory,        // 线程工厂
    RejectedExecutionHandler handler    // 拒绝策略
)
```

**执行流程**：
```
提交任务 → 核心线程未满？→ 创建核心线程执行
                ↓ 已满
         任务队列未满？→ 加入队列等待
                ↓ 已满
         最大线程未满？→ 创建非核心线程执行
                ↓ 已满
         执行拒绝策略
```

**4种拒绝策略**：
| 策略 | 行为 | 场景 |
|------|------|------|
| AbortPolicy | 抛RejectedExecutionException | 默认策略 |
| CallerRunsPolicy | 调用者线程执行 | 不丢弃任务 |
| DiscardPolicy | 静默丢弃 | 可容忍丢失 |
| DiscardOldestPolicy | 丢弃队列最老任务 | 优先最新任务 |

---

### Q10: 为什么不用Executors创建线程池？

**答题思路**：阿里Java规约明确禁止，原因是资源失控风险。

**深度解答**：

| Executors方法 | 问题 |
|--------------|------|
| `newFixedThreadPool` | 队列用LinkedBlockingQueue（**无界队列**）→ 任务堆积OOM |
| `newSingleThreadExecutor` | 同上，无界队列 |
| `newCachedThreadPool` | 最大线程数=Integer.MAX_VALUE → **线程爆炸**OOM |
| `newScheduledThreadPool` | 队列用DelayedWorkQueue（**无界队列**）→ OOM |

**正确做法**：用ThreadPoolExecutor手动指定参数：
```java
// ✅ 明确指定所有参数，可控
new ThreadPoolExecutor(
    4,                      // 核心线程
    8,                      // 最大线程
    60, TimeUnit.SECONDS,   // 空闲存活
    new ArrayBlockingQueue<>(100),  // 有界队列！
    new ThreadPoolExecutor.CallerRunsPolicy()  // 拒绝策略
);
```

---

### Q11: 阻塞队列

**答题思路**：线程池使用的核心组件，要讲清实现原理和选型。

**深度解答**：

| 队列 | 特点 | 适用场景 |
|------|------|---------|
| **ArrayBlockingQueue** | 有界、数组、公平/非公平 | 线程池标配 |
| **LinkedBlockingQueue** | 可有界/无界、链表 | 默认无界，⚠️OOM风险 |
| **SynchronousQueue** | 不存储元素、直接传递 | CachedThreadPool |
| **PriorityBlockingQueue** | 优先级排序、无界 | 任务有优先级 |
| **DelayQueue** | 延迟取出、无界 | 定时任务 |

**阻塞实现原理**：ReentrantLock + 两个Condition（notEmpty / notFull）

```java
// ArrayBlockingQueue核心实现
public void put(E e) throws InterruptedException {
    lock.lock();
    try {
        while (count == items.length) // 队列满
            notFull.await();          // 等待不满
        enqueue(e);                   // 入队
        notEmpty.signal();            // 通知消费者
    } finally { lock.unlock(); }
}
```

---

### Q12: 项目中哪里用到了线程池？线程池参数该如何设置？

**答题思路**：结合实际项目讲，参数设置要有理论依据。

**深度解答**：

**参数设置公式**：
- **CPU密集型**：核心线程数 = CPU核心数 + 1
- **IO密集型**：核心线程数 = CPU核心数 × 2（或 CPU核心数 / (1 - 阻塞系数)）
- **混合型**：根据实际IO等待比例计算

```java
// AI Agent场景：异步调用LLM API（IO密集型）
ThreadPoolExecutor llmPool = new ThreadPoolExecutor(
    Runtime.getRuntime().availableProcessors() * 4,  // 核心=CPU*4（IO密集）
    Runtime.getRuntime().availableProcessors() * 8,  // 最大=CPU*8
    60, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(200),    // 有界队列200
    new ThreadFactory() {
        private final AtomicInteger i = new AtomicInteger();
        public Thread newThread(Runnable r) {
            Thread t = new Thread(r, "llm-api-" + i.incrementAndGet());
            t.setDaemon(true);  // 守护线程，不阻止JVM退出
            return t;
        }
    },
    new ThreadPoolExecutor.CallerRunsPolicy()  // 不丢弃，调用者线程执行
);
```

**工程踩坑点**：
- 队列大小要根据任务处理速度计算：队列容量 = 峰值QPS × 平均处理时间 × 安全系数
- 拒绝策略不要用AbortPolicy——线上会抛异常，用CallerRunsPolicy更安全
- 核心线程数要不要超时？`allowCoreThreadTimeOut(true)`可以回收核心线程

---

## 缓存（Q13-Q16）

### Q13: 缓存击穿、穿透、雪崩

**深度解答**：

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| **缓存击穿** | 热点Key过期，大量请求打到DB | 互斥锁/逻辑过期/永不过期 |
| **缓存穿透** | 查不存在的数据，缓存和DB都没有 | 布隆过滤器/空值缓存 |
| **缓存雪崩** | 大量Key同时过期，或缓存宕机 | 过期时间加随机值/多级缓存/熔断 |

```java
// 击穿解决方案：互斥锁
public String getWithMutex(String key) {
    String value = redis.get(key);
    if (value == null) {
        synchronized (key.intern()) {  // 只让一个线程重建缓存
            value = redis.get(key);
            if (value == null) {
                value = db.query(key);
                redis.set(key, value, 30, TimeUnit.MINUTES);
            }
        }
    }
    return value;
}

// 雪崩解决方案：过期时间加随机值
int expire = 1800 + new Random().nextInt(600); // 30分钟+0~10分钟随机
redis.set(key, value, expire, TimeUnit.SECONDS);
```

---

### Q14: 布隆过滤器的原理

**深度解答**：

布隆过滤器 = 位数组 + 多个哈希函数

**判断流程**：
1. 插入：对元素做K次哈希 → 对应K个位置置1
2. 查询：对元素做K次哈希 → 如果所有位都是1，**可能存在**；如果有任何位是0，**一定不存在**

**特点**：
- 空间效率极高：1%误判率只需9.6bit/元素
- 判断不存在100%准确，判断存在有误判（false positive）
- 不支持删除（置1容易，置0会影响其他元素）

```java
// Guava布隆过滤器
BloomFilter<String> filter = BloomFilter.create(
    Funnels.stringFunnel(Charset.defaultCharset()),
    1000000,   // 预期元素数
    0.01       // 1%误判率
);

filter.put("user:123");
filter.mightContain("user:123");  // true
filter.mightContain("user:456");  // 可能有误判
```

---

### Q15: 误判的解决办法

**深度解答**：

| 方案 | 原理 | 代价 |
|------|------|------|
| **增大位数组** | 更多位→更低冲突率 | 更多内存 |
| **增加哈希函数数量** | K次哈希→更多位参与判断 | 更慢 |
| **多层布隆过滤器** | 第一层误判→查第二层确认 | 空间翻倍 |
| **配合DB兜底** | 布隆过滤器说存在→查DB确认 | 多一次DB查询 |
| **Counting Bloom Filter** | 用计数器代替位数组，支持删除 | 3-4倍空间 |

**工程最佳实践**：布隆过滤器做初筛 → 命中后查DB确认。这样布隆过滤器挡住了99%的无效请求，少量误判请求查一次DB也能接受。

---

### Q16: 如何保证本地缓存的数据一致性？

**深度解答**：

| 方案 | 原理 | 一致性 | 复杂度 |
|------|------|--------|--------|
| **TTL过期** | 设置短过期时间 | 最终一致 | 低 |
| **主动失效** | 数据变更时通知本地缓存失效 | 强一致 | 中 |
| **版本号** | 每次变更版本+1，本地比对 | 强一致 | 中 |
| **Redis Pub/Sub** | 变更时发布消息，各节点收到后删本地缓存 | 最终一致 | 中 |

```java
// Redis Pub/Sub方案：多节点本地缓存一致性
@Component
public class LocalCacheSync {
    private final Cache<String, String> localCache = Caffeine.newBuilder()
        .maximumSize(10000)
        .expireAfterWrite(5, TimeUnit.MINUTES)
        .build();

    private final RedisMessageListenerContainer listenerContainer;

    // 收到失效消息 → 删除本地缓存
    @RedisListener(topic = "cache:invalidate")
    public void onInvalidate(String key) {
        localCache.invalidate(key);
    }

    // 数据变更时 → 发布失效消息
    public void put(String key, String value) {
        db.save(key, value);
        redis.set(key, value);
        redis.publish("cache:invalidate", key);  // 通知所有节点
        localCache.put(key, value);
    }
}
```

---

## 高并发+MQ（Q17-Q19）

### Q17: 如果QPS提高一百倍该从哪些方面改善？

**答题思路**：不是简单说"加机器"，要从架构分层系统回答。

**深度解答**：

```
QPS提升100倍 = 单机10倍 × 10倍水平扩展
```

| 层次 | 优化手段 | 效果 |
|------|---------|------|
| **接入层** | Nginx负载均衡、CDN静态资源、WAF防刷 | 挡住无效流量 |
| **应用层** | 无状态化→水平扩容、异步化→MQ削峰 | 线性扩容 |
| **缓存层** | 多级缓存（本地→Redis→DB）、热点探测 | 读QPS 10-100倍 |
| **数据库层** | 读写分离、分库分表、连接池优化 | 写QPS线性扩展 |
| **MQ层** | 削峰填谷、异步解耦、批量写入 | 峰值平滑 |
| **降级限流** | Sentinel限流、熔断降级、兜底 | 保护核心链路 |

```java
// Sentinel限流保护
@SentinelResource(value = "queryOrder", blockHandler = "queryBlock")
public Order queryOrder(String orderId) {
    return orderService.get(orderId);
}

public Order queryBlock(String orderId, BlockException e) {
    return Order.empty();  // 限流降级：返回空订单
}
```

---

### Q18: 如何保证MQ的消息不丢失、不重复消费？

**深度解答**：

**消息不丢失**（三个环节）：

| 环节 | 风险 | 解决方案 |
|------|------|---------|
| 生产者 | 发送失败 | 同步发送+重试+确认机制 |
| MQ | 宕机丢消息 | 持久化（刷盘+主从同步） |
| 消费者 | 处理失败 | 手动ACK（处理完再确认） |

```java
// RabbitMQ: 保证消息不丢失
// 生产者：confirm模式
channel.confirmSelect();
channel.basicPublish("", "queue", MessageProperties.PERSISTENT_TEXT_PLAIN, msg.getBytes());
channel.waitForConfirms(); // 等待MQ确认

// 消费者：手动ACK
channel.basicConsume("queue", false, (tag, msg) -> {
    try {
        process(msg);         // 先处理
        channel.basicAck(tag, false);  // 处理成功再ACK
    } catch (Exception e) {
        channel.basicNack(tag, false, true);  // 处理失败→重回队列
    }
});
```

**消息不重复消费** = 幂等性（见Q19）

---

### Q19: 幂等怎么做的？

**深度解答**：

| 方案 | 原理 | 适用场景 |
|------|------|---------|
| **唯一ID去重** | 消息ID存Redis，重复消息跳过 | 通用 |
| **数据库唯一约束** | 利用唯一索引防止重复插入 | 创建类操作 |
| **乐观锁** | 带版本号更新 | 更新类操作 |
| **状态机** | 只允许特定状态转换 | 订单类流程 |

```java
// 方案1: Redis去重（最常用）
public void consume(String msgId, String payload) {
    Boolean isNew = redis.setIfAbsent("msg:consumed:" + msgId, "1", 24, TimeUnit.HOURS);
    if (!isNew) {
        log.info("重复消息，跳过: {}", msgId);
        return;  // 幂等：重复消费=消费一次
    }
    process(payload);  // 只处理一次
}

// 方案2: 乐观锁
@Update("UPDATE account SET balance = balance - #{amount}, version = version + 1 WHERE id = #{id} AND version = #{version}")
int deductBalance(@Param("id") Long id, @Param("amount") BigDecimal amount, @Param("version") Integer version);
```

---

## AI Agent（Q20-Q28）

### Q20: 平时如何AI Coding？学习了哪些AI相关的内容？

**答题思路**：展示你对AI工具的实际使用和持续学习态度。

**深度解答**：

**AI Coding工作流**：
1. **需求分析**：用AI辅助拆解需求、生成技术方案
2. **编码**：Copilot/Claude Code生成代码 + 人工review
3. **调试**：AI辅助定位bug、分析日志
4. **测试**：AI生成单元测试用例
5. **文档**：AI生成API文档和注释

**学习内容**：
- Agent框架：LangChain4j / Spring AI / LangGraph
- RAG系统：向量化、检索、重排序
- MCP协议：工具调用标准化
- Prompt工程：结构化Prompt、Few-shot、CoT
- 模型评估：评测集、Badcase分析

---

### Q21: 各个大语言模型使用上的感受

**深度解答**：

| 模型 | 特点 | 适用场景 |
|------|------|---------|
| **GPT-4o** | 综合能力最强，多模态 | 复杂推理、代码生成 |
| **Claude** | 长上下文200K，代码能力强 | 长文档分析、代码审查 |
| **Qwen** | 中文最优，开源生态好 | 中文RAG、自部署 |
| **DeepSeek** | 代码能力突出，性价比高 | 代码生成 |
| **Doubao** | 便宜、速度快 | 高频调用、简单任务 |

---

### Q22: LLM

**简答**：大语言模型（Large Language Model），基于Transformer架构，通过海量文本训练，具备文本生成、理解、推理能力。核心技术：自注意力机制、预训练+微调、RLHF对齐。

---

### Q23: RAG

**深度解答**：

RAG = Retrieval Augmented Generation，检索增强生成。

**核心流程**：文档解析 → 切分 → 向量化 → 索引 → 查询检索 → Rerank → 注入Prompt → LLM生成

**为什么需要RAG**：
- LLM知识截止（训练数据有期限）
- 幻觉问题（编造不存在的信息）
- 领域知识不足（通用模型不懂专业领域）
- 成本问题（微调太贵）

```java
// Spring AI: RAG完整实现
@Component
public class RagService {
    private final VectorStore vectorStore;
    private final ChatClient chatClient;

    public String query(String question) {
        // 1. 检索相关文档
        List<Document> docs = vectorStore.similaritySearch(
            SearchRequest.builder().query(question).topK(5).build());

        // 2. 构建增强Prompt
        String context = docs.stream()
            .map(Document::getText)
            .collect(Collectors.joining("\n\n"));

        // 3. LLM生成
        return chatClient.prompt()
            .system("基于以下参考资料回答问题，如果资料中没有相关信息，请说明：\n" + context)
            .user(question)
            .call()
            .content();
    }
}
```

---

### Q24: 向量检索和BM25的使用场景，什么时候更适合哪个

**深度解答**：

| 维度 | 向量检索 | BM25 |
|------|---------|------|
| 原理 | 语义相似度（Embedding→向量距离） | 关键词匹配（TF-IDF变体） |
| 优势 | 理解语义、"意思相近"也能匹配 | 精确关键词匹配、可解释 |
| 劣势 | 模型依赖、对专有名词不敏感 | 无法理解语义 |
| 最适合 | "怎么实现用户认证"→匹配相关代码 | "找到UserService类"→精确匹配 |

**选型原则**：
- 查询包含**精确标识符/专有名词** → BM25
- 查询是**自然语言描述/语义模糊** → 向量检索
- **生产环境**：混合检索（BM25+向量），RRF融合 → 效果最好

---

### Q25: MCP、Tool

**深度解答**：

**MCP（Model Context Protocol）**：Anthropic提出的工具调用标准协议。

核心概念：
- **MCP Server**：暴露工具能力（如filesystem、github、database）
- **MCP Client**：Agent侧连接MCP Server，发现和调用工具
- **传输方式**：stdio（子进程）/ SSE（HTTP长连接）
- **协议**：JSON-RPC 2.0

**Tool（工具）**：Agent可调用的原子能力。

MCP vs 直接Function Calling：
- MCP：标准化协议，跨Agent共享，独立生命周期
- Function Calling：模型原生能力，简单直接，但非标准

---

### Q26: Skill

**深度解答**：

Skill = 面向业务的工具组合编排。

与MCP的关系：
- MCP = 原子工具（`read_file`、`search_code`）
- Skill = 业务流程（`代码审查` = read_diff + search_pattern + analyze + comment）

Skill三要素：
1. **YAML描述**：名称、描述、所需工具、参数定义
2. **实现脚本**：具体的执行逻辑（Shell/Python/Java）
3. **注册机制**：目录扫描→元数据解析→注册到Agent

（详细实现见字节一面Q8的Skill系统设计手撕题）

---

### Q27: 上下文工程

**深度解答**：

上下文工程（Context Engineering）= 管理LLM输入上下文的系统性方法。

核心关注点：
1. **上下文组装**：System Prompt + 记忆 + 检索结果 + 用户输入，如何排列、谁优先
2. **上下文压缩**：滑动窗口、摘要、关键信息提取（见阿里国际Q12）
3. **上下文缓存**：Claude的Prompt Caching，相同前缀不重复计算
4. **上下文隔离**：不同任务用独立上下文，避免信息串扰

```java
// 上下文组装策略
public Prompt assembleContext(String query, AgentMemory memory, List<Document> retrieved) {
    return Prompt.builder()
        .system(systemPrompt)                    // 1. 角色定义（最高优先级）
        .system(memory.getLongTermSummary())      // 2. 长期记忆摘要
        .system(memory.getProjectContext())        // 3. 项目上下文（CLAUDE.md）
        .context(formatRetrievedDocs(retrieved))  // 4. RAG检索结果
        .messages(memory.getRecentMessages(10))   // 5. 近期对话
        .user(query)                              // 6. 当前问题
        .build();
}
```

**关键原则**：上下文不是越多越好——无关信息会干扰模型判断，精准>全面。

---

### Q28: Harness

**深度解答**：

Harness 不只是评测框架，更像“把模型包起来变成可运行系统”的工程外壳：负责工具、上下文、记忆、权限、沙箱、评测、观测和反馈闭环。评测只是 Harness 的一个重要组成部分。

**核心概念**：
1. **工具与权限**：模型能调用什么、参数如何校验、失败如何处理
2. **上下文与记忆**：检索、摘要、窗口裁剪、跨会话状态
3. **沙箱与安全**：代码执行、文件访问、网络权限、审计日志
4. **评测与观测**：评测集、工具调用正确率、任务完成率、trace、成本和延迟
5. **反馈闭环**：批量运行→打分→定位失败→修 prompt/工具/策略

**常见Harness**：
- **lm-evaluation-harness**（EleutherAI）：60+学术基准（MMLU、HumanEval等）
- **LangSmith / LangFuse**：Agent链路追踪+评估
- **自定义Harness**：针对业务场景的评测（Badcase率、用户满意度）

```java
// 自定义Agent评测Harness
@Component
public class AgentEvaluationHarness {

    public EvaluationReport run(EvaluationDataset dataset, Agent agent) {
        List<CaseResult> results = new ArrayList<>();

        for (EvaluationCase c : dataset.getCases()) {
            String actual = agent.execute(c.getInput());
            double score = computeScore(actual, c.getExpectedOutput());
            results.add(new CaseResult(c, actual, score));
        }

        return EvaluationReport.builder()
            .totalCases(results.size())
            .avgScore(results.stream().mapToDouble(CaseResult::score).average().orElse(0))
            .passRate(results.stream().filter(r -> r.score() > 0.8).count() / (double) results.size())
            .badCases(results.stream().filter(r -> r.score() < 0.5).toList())
            .build();
    }
}
```

---

## 反问：AI在工作中的使用比例

好问题。可以问：
- 团队用AI辅助编码的比例大概多少？
- 主要用在哪些环节（代码生成/文档/测试/运维）？
- 对新人AI能力的期望是什么？

---

## 总结：考点分布

| 类别 | 题数 | 关键词 |
|------|------|--------|
| Java并发 | 4 | HashMap/ConcurrentHashMap/锁/锁粒度 |
| JVM | 4 | 内存区域/GC/Full GC排查/调优 |
| 线程池 | 4 | 底层实现/Executors坑/阻塞队列/参数设置 |
| 缓存 | 4 | 击穿穿透雪崩/布隆过滤器/误判/本地缓存一致性 |
| 高并发+MQ | 3 | QPS百倍/消息可靠/幂等 |
| AI Agent | 9 | AI Coding/LLM/RAG/向量vs BM25/MCP/Skill/上下文工程/Harness |

**一面特点**：Java八股前半段（Q1-Q19）+ AI Agent后半段（Q20-Q28），飞猪后端岗已经把AI能力纳入面试范围，说明行业趋势——后端开发也要懂AI Agent。
