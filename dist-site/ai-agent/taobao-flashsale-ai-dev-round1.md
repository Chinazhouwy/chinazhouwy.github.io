# 淘宝闪购 · AI应用开发一面凉经

> 来源：小红书面经分享
> 标签：`#淘宝闪购` `#AI应用开发` `#八股` `#中间件` `#RAG`

---

## 一、面试概况

| 项目 | 内容 |
|------|------|
| **岗位** | 淘宝闪购 · AI应用开发 |
| **时长** | 1小时 |
| **流程** | 八股考核 → 场景设计 → 算法题 → 反问 |
| **结果** | 凉（秒挂） |
| **特点** | 项目细节一点没问，纯考基础和场景 |

**自我归因**：
- 八股答的还行
- 场景题系统分析能力差一些
- 算法题变参边界条件有一步没处理好

**核心教训**：底层原理，分析好边界条件，才能把 prompt 写清楚。

---

## 二、八股考核（中间件和 RAG）

### 2.1 Java 线程池核心参数

**问题**：介绍线程池里面都有哪些参数？

**答案**：

```java
public ThreadPoolExecutor(int corePoolSize,
                          int maximumPoolSize,
                          long keepAliveTime,
                          TimeUnit unit,
                          BlockingQueue<Runnable> workQueue,
                          ThreadFactory threadFactory,
                          RejectedExecutionHandler handler)
```

| 参数 | 说明 | 关键点 |
|------|------|--------|
| `corePoolSize` | 核心线程数 | 即使空闲也不回收（除非 allowCoreThreadTimeOut） |
| `maximumPoolSize` | 最大线程数 | 队列满后，线程数可扩充到此值 |
| `keepAliveTime` | 空闲超时 | 超过 corePoolSize 的线程空闲多久被回收 |
| `unit` | 时间单位 | 配合 keepAliveTime |
| `workQueue` | 任务队列 | ArrayBlockingQueue / LinkedBlockingQueue / SynchronousQueue |
| `threadFactory` | 线程工厂 | 自定义线程名、守护线程等 |
| `handler` | 拒绝策略 | 队列和线程池都满时的处理 |

**线程池工作流程**（必须能画出来）：
```
任务提交
  ↓
核心线程未满？→ 是 → 创建核心线程执行
  ↓ 否
队列未满？→ 是 → 加入队列等待
  ↓ 否
线程数 < maximumPoolSize？→ 是 → 创建非核心线程执行
  ↓ 否
执行拒绝策略
```

### 2.2 线程池拒绝策略

**问题**：拒绝策略都有哪些？

**答案**：

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| `AbortPolicy`（默认） | 抛出 `RejectedExecutionException` | 需要感知任务拒绝的场景 |
| `CallerRunsPolicy` | 调用者线程执行任务 | 需要降速、背压的场景 |
| `DiscardPolicy` | 静默丢弃 | 允许丢失的非关键任务 |
| `DiscardOldestPolicy` | 丢弃队列头部任务，重试当前 | 新任务优先级更高的场景 |

**自定义拒绝策略**（面试加分项）：
```java
// 示例：先写日志，再丢弃
new RejectedExecutionHandler() {
    @Override
    public void rejectedExecution(Runnable r, ThreadPoolExecutor executor) {
        log.warn("Task rejected, queue size: {}, active: {}", 
                 executor.getQueue().size(), 
                 executor.getActiveCount());
        // 可以写入 MQ、持久化、或告警
    }
}
```

### 2.3 Redis 跳表（SkipList）

**问题**：Redis 中的跳表了解吗？

**答案**：

**什么是跳表**：一种基于链表 + 多级索引的数据结构，查找/插入/删除时间复杂度 O(log N)。

**为什么 Redis 用跳表而不用平衡树/红黑树**：

| 对比项 | 跳表 | 红黑树 |
|--------|------|--------|
| 实现复杂度 | 简单 | 复杂（旋转+变色） |
| 范围查询 | 天然支持（链表遍历） | 需要中序遍历 |
| 并发 | 更容易实现并发 | 锁粒度大 |
| 内存开销 | 多级指针，略高 | 固定3个指针 |
| 有序性 | 天然有序 | 天然有序 |

**Redis 中跳表的使用场景**：
- **ZSET（有序集合）**：当元素较多或成员较长时使用跳表
- 配合字典使用：字典 O(1) 查找，跳表 O(log N) 范围查询

**跳表核心结构**：
```java
class SkipList<T> {
    static final int MAX_LEVEL = 32;
    SkipListNode<T> head;
    int level;  // 当前最大层数
    int size;
    
    // 查找：从最高层开始，逐层下降
    // 插入：随机生成层数（50%概率升一层）
    // 删除：找到目标节点，更新前后指针
}
```

### 2.4 Redis 内存淘汰策略

**问题**：Redis 中的内存淘汰策略？

**答案**：

当 Redis 内存超过 `maxmemory` 时触发淘汰：

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| `volatile-lru` | 从设置了 TTL 的 key 中淘汰最近最少使用的 | 缓存场景 |
| `allkeys-lru` | 从所有 key 中淘汰最近最少使用的 | 通用缓存 |
| `volatile-lfu` | 从设置了 TTL 的 key 中淘汰最不经常使用的 | 访问频率差异大 |
| `allkeys-lfu` | 从所有 key 中淘汰最不经常使用的 | Redis 4.0+ 推荐 |
| `volatile-ttl` | 淘汰 TTL 最短的 | 需要优先保留长 TTL 数据 |
| `volatile-random` | 随机淘汰设置了 TTL 的 key | 不推荐 |
| `allkeys-random` | 随机淘汰任意 key | 不推荐 |
| `noeviction`（默认） | 不淘汰，直接报错 | 数据不能丢失的场景 |

**LRU vs LFU 的区别**：
- **LRU**：基于时间，淘汰最久未访问的
- **LFU**：基于频率，淘汰访问次数最少的
- LFU 能更好地处理"一次性热点"问题（比如临时大流量访问后不再访问的数据不会被误保留）

### 2.5 LRU/LFU 底层实现

**问题**：LRU/LFU 的底层怎么实现的，描述清楚数据结构，具体过程？

**LRU 实现**：

```java
class LRUCache<K, V> {
    private final int capacity;
    private final Map<K, Node<K, V>> map;
    private final DoublyLinkedList<Node<K, V>> list;
    
    // 核心数据结构：HashMap + 双向链表
    // HashMap: O(1) 查找
    // 双向链表：头部=最近使用，尾部=最久未使用
    
    public V get(K key) {
        Node<K, V> node = map.get(key);
        if (node == null) return null;
        list.moveToHead(node);  // 访问后移到头部
        return node.value;
    }
    
    public void put(K key, V value) {
        if (map.containsKey(key)) {
            Node<K, V> node = map.get(key);
            node.value = value;
            list.moveToHead(node);
        } else {
            if (map.size() >= capacity) {
                Node<K, V> removed = list.removeTail();  // 淘汰尾部
                map.remove(removed.key);
            }
            Node<K, V> node = new Node<>(key, value);
            list.addToHead(node);
            map.put(key, node);
        }
    }
}
```

**LFU 实现**（双 HashMap + 双向链表）：

```java
class LFUCache<K, V> {
    private final int capacity;
    private int minFreq = 0;
    
    // key → Node
    private final Map<K, Node<K, V>> keyToNode;
    // freq → DoublyLinkedList<Node>
    private final Map<Integer, DoublyLinkedList<Node<K, V>>> freqToNodes;
    
    public V get(K key) {
        Node<K, V> node = keyToNode.get(key);
        if (node == null) return null;
        increaseFreq(node);  // 频率+1，移到新的频率链表
        return node.value;
    }
    
    public void put(K key, V value) {
        if (keyToNode.containsKey(key)) {
            Node<K, V> node = keyToNode.get(key);
            node.value = value;
            increaseFreq(node);
        } else {
            if (keyToNode.size() >= capacity) {
                // 淘汰 minFreq 链表的尾部
                DoublyLinkedList<Node<K, V>> minList = freqToNodes.get(minFreq);
                Node<K, V> removed = minList.removeTail();
                keyToNode.remove(removed.key);
            }
            Node<K, V> node = new Node<>(key, value, 1);
            keyToNode.put(key, node);
            freqToNodes.computeIfAbsent(1, k -> new DoublyLinkedList<>()).addToHead(node);
            minFreq = 1;  // 新插入的 freq=1，minFreq 重置为 1
        }
    }
    
    private void increaseFreq(Node<K, V> node) {
        int oldFreq = node.freq;
        freqToNodes.get(oldFreq).remove(node);
        node.freq = oldFreq + 1;
        freqToNodes.computeIfAbsent(node.freq, k -> new DoublyLinkedList<>()).addToHead(node);
        if (freqToNodes.get(minFreq).isEmpty()) {
            minFreq++;  // 如果 minFreq 链表空了，minFreq+1
        }
    }
}
```

### 2.6 RAG 组成部分

**问题**：RAG 包含哪些组成部分？

**答案**：

```
┌─────────────────────────────────────────────────────────┐
│                    RAG 架构                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ 知识获取  │ →  │ 文档切分  │ →  │ 向量化    │          │
│  │ (爬虫/ETL)│    │ (Chunk)  │    │ (Embed)  │          │
│  └──────────┘    └──────────┘    └──────────┘          │
│                           ↓                              │
│                    ┌──────────┐                          │
│                    │ 向量数据库│                          │
│                    │ (Milvus/ │                          │
│                    │  FAISS)  │                          │
│                    └──────────┘                          │
│                           ↓                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ 用户查询  │ →  │ 检索召回  │ →  │ 重排序    │          │
│  │ (Query)  │    │ (Recall)  │    │ (Rerank) │          │
│  └──────────┘    └──────────┘    └──────────┘          │
│                           ↓                              │
│                    ┌──────────┐                          │
│                    │ Prompt   │                          │
│                    │ 组装     │                          │
│                    └──────────┘                          │
│                           ↓                              │
│                    ┌──────────┐                          │
│                    │ LLM 生成  │                          │
│                    │ (Answer) │                          │
│                    └──────────┘                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**核心模块详解**：

| 模块 | 关键技术 | 说明 |
|------|----------|------|
| **知识获取** | 爬虫、API、ETL | 从多数据源获取原始文档 |
| **文档切分** | 固定长度、语义切分、递归切分 | 控制 chunk 大小（通常 500-1000 token） |
| **向量化** | BGE、text-embedding-3 | 文本→向量，维度 768-3072 |
| **向量存储** | Milvus、FAISS、Pinecone | 支持 ANN 近似最近邻搜索 |
| **检索召回** | 向量检索、关键词检索（BM25）、混合检索 | 多路召回提升覆盖率 |
| **重排序** | Cross-Encoder、BGE-Reranker | 精排提升准确率 |
| **Prompt 组装** | 上下文窗口管理、指令模板 | 将检索结果注入 prompt |
| **LLM 生成** | 温度、top_p、max_tokens 控制 | 基于上下文的生成 |

### 2.7 检索部分评测

**问题**：检索部分怎么评测的？

**答案**：

**离线评测指标**：

| 指标 | 公式 | 说明 |
|------|------|------|
| **Recall@K** | 相关文档在TopK中出现的比例 | 衡量召回率，K通常取5/10/20 |
| **Precision@K** | TopK中相关文档的比例 | 衡量精确率 |
| **MRR** (Mean Reciprocal Rank) | 1/首次命中排名 的平均值 | 衡量首次命中位置 |
| **NDCG@K** | 归一化折损累积增益 | 衡量排序质量，考虑相关性分级 |
| **Hit Rate** | 至少召回一个相关文档的查询比例 | 简单直观 |

**评测集构建方法**：

```
1. 人工标注：专家对 (query, doc) 对打相关性标签 (0/1/2/3)
2. 自动生成：用 LLM 生成 query-doc 对，再人工抽检
3. 点击日志：从用户行为中提取隐式反馈
```

**线上评测指标**：

| 指标 | 说明 |
|------|------|
| **检索耗时** | P50/P99 延迟 |
| **回答采纳率** | 用户对回答的点赞/点踩比例 |
| **追问率** | 需要追问的比例（追问率高说明检索不准） |
| **拒答率** | 模型说"不知道"的比例 |

**评测工具**：
- **RAGAS**：开源 RAG 评测框架，支持 faithfulness、answer_relevance、context_precision 等
- **LangSmith**：LangChain 官方评测平台
- **自建评测集**：定期回归测试

---

## 三、场景设计题

### 3.1 线程池队列满了，如何设计扩展方案？

**问题**：承接线程池参数问题，如果 workQueue 满了，可以扩充中间件的话，怎么设计？

**答案**：

**方案一：线程池 + MQ 二级缓冲**

```
任务提交
  ↓
线程池 workQueue 尝试入队
  ↓ 满了
降级到 MQ（RabbitMQ/Kafka）
  ↓
消费者线程从 MQ 拉取任务
  ↓
重新提交到线程池
```

```java
class ExtendedThreadPool {
    private final ThreadPoolExecutor executor;
    private final RabbitMQTemplate rabbitTemplate;
    private final String queueName = "task.fallback";
    
    public void submit(Runnable task) {
        try {
            // 先尝试直接提交
            executor.submit(task);
        } catch (RejectedExecutionException e) {
            // 队列满了，降级到 MQ
            try {
                rabbitTemplate.convertAndSend(queueName, serialize(task));
                log.info("Task offloaded to MQ");
            } catch (Exception ex) {
                // MQ 也挂了，执行拒绝策略
                executor.getRejectedExecutionHandler()
                        .rejectedExecution(task, executor);
            }
        }
    }
    
    // 消费者：从 MQ 拉取任务，重新提交
    @RabbitListener(queues = "task.fallback")
    public void consumeFromMQ(byte[] taskData) {
        Runnable task = deserialize(taskData);
        // 关键：用独立的消费线程池，避免死锁
        executor.submit(task);
    }
}
```

**方案二：动态扩缩容 + 优先级队列**

```java
// 监控线程池状态，动态调整
class AdaptiveThreadPool {
    private final ThreadPoolExecutor executor;
    private final ScheduledExecutorService monitor;
    
    void startMonitoring() {
        monitor.scheduleAtFixedRate(() -> {
            int queueSize = executor.getQueue().size();
            int active = executor.getActiveCount();
            int max = executor.getMaximumPoolSize();
            
            // 队列使用率 > 80% 且线程数 < 最大值 → 扩容
            if (queueSize > executor.getQueue().capacity() * 0.8 
                && active >= max * 0.8) {
                executor.setMaximumPoolSize(max + 10);
            }
            // 队列使用率 < 20% 且线程数 > 核心值 → 缩容
            else if (queueSize < executor.getQueue().capacity() * 0.2 
                     && active < executor.getCorePoolSize()) {
                executor.setMaximumPoolSize(
                    Math.max(executor.getCorePoolSize(), max - 5));
            }
        }, 0, 5, TimeUnit.SECONDS);
    }
}
```

**方案三：分级任务处理**

```
高优先级任务 → 直接提交线程池（不经过队列）
中优先级任务 → 进入 workQueue
低优先级任务 → 进入 MQ 延迟处理
```

**面试官期望的回答要点**：
1. **能串起来**：线程池和中间件的联动机制（拒绝 → 降级 → 消费 → 重试）
2. **考虑边界**：MQ 挂了怎么办？消费失败怎么重试？死信队列？
3. **性能权衡**：MQ 引入的延迟 vs 任务不丢失的保障

---

## 四、算法题

### 4.1 广义爬楼梯问题

**问题**：类似爬楼梯问题，只是总台阶数 n 和每步能爬多少 m 是个参数。

**题意**：总共 n 级台阶，每次可以爬 1~m 级，求有多少种不同的爬法。

**标准爬楼梯**：m=2（每次爬1或2级）
**广义爬楼梯**：m 是参数

**解法**：动态规划

```java
/**
 * 广义爬楼梯
 * @param n 总台阶数
 * @param m 每次最多爬 m 级
 * @return 爬法总数
 */
public int climbStairs(int n, int m) {
    if (n <= 0) return 0;
    if (n == 1) return 1;
    
    // dp[i] = 爬到第 i 级台阶的方案数
    int[] dp = new int[n + 1];
    dp[0] = 1;  // 边界：还没爬也算1种方案
    
    for (int i = 1; i <= n; i++) {
        // 当前可以从 i-m 到 i-1 中的任意一步跳过来
        for (int j = 1; j <= m && j <= i; j++) {
            dp[i] += dp[i - j];
        }
    }
    
    return dp[n];
}
```

**时间复杂度**：O(n × m)
**空间复杂度**：O(n)，可优化为 O(m) 滚动数组

**空间优化**：
```java
public int climbStairsOptimized(int n, int m) {
    if (n <= 0) return 0;
    if (n == 1) return 1;
    
    // 只需要保留最近 m 个状态
    int[] dp = new int[m + 1];
    dp[0] = 1;
    
    for (int i = 1; i <= n; i++) {
        // 用滑动窗口求和避免重复计算
        int sum = 0;
        for (int j = 1; j <= m && j <= i; j++) {
            sum += dp[j % (m + 1)];
        }
        // 注意：这里需要特殊处理，因为 dp[i] 会覆盖旧值
        // 更优的做法是用前缀和
    }
    
    return dp[n % (m + 1)];
}
```

**前缀和优化到 O(n)**：
```java
public int climbStairsOptimized(int n, int m) {
    if (n <= 0) return 0;
    
    int[] dp = new int[n + 1];
    dp[0] = 1;
    int windowSum = 1;  // 滑动窗口和
    
    for (int i = 1; i <= n; i++) {
        dp[i] = windowSum;
        windowSum += dp[i];
        // 窗口超过 m 个元素时，减去最老的
        if (i >= m) {
            windowSum -= dp[i - m];
        }
    }
    
    return dp[n];
}
```

**边界条件**（面试容易踩坑）：
- n = 0：返回 0（没有台阶）
- n = 1：返回 1
- m = 1：只能一次爬1级，返回 1
- m >= n：退化为 2^(n-1)

---

## 五、反问环节

1. **业务方向**：大数据方面，偏算法，提取用户画像等
2. **自我认知**：系统分析能力方面需要提升
3. **行业认知**：即使 AI 编程时代也需要了解底层原理

---

## 六、面试复盘总结

### 6.1 失败原因分析

| 环节 | 问题 | 改进 |
|------|------|------|
| 八股 | 基础答得还行 | 继续保持 |
| 场景 | 系统分析能力差 | 多练系统设计题，建立分析框架 |
| 算法 | 边界条件没处理好 | 先想清楚边界再写代码 |
| 整体 | 项目细节没问 | 可能基础挂了就没必要问了 |

### 6.2 准备建议

**八股重点**：
- 中间件：线程池、Redis（跳表/淘汰策略/LRU/LFU）
- RAG：组件、评测、优化

**场景题框架**：
```
1. 明确需求：输入/输出/约束/SLA
2. 画架构图：数据流向、组件交互
3. 核心机制：降级/容错/监控
4. 边界考虑：极端情况、异常处理
```

**算法题习惯**：
```
1. 先确认题意和边界条件
2. 想清楚 DP 状态定义和转移方程
3. 手写代码前先口述思路
4. 写完自测边界用例
```

---

*整理时间：2026-05-17*
*来源：小红书面经分享*
