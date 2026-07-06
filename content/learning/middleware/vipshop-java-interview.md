---
title: "唯品会 Java 开发面经复盘"
date: "2026-07-06"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "唯品会 Java 开发面经复盘"
tags:
---

# 唯品会 Java 开发面经复盘

> **来源**: 小红书  
> **链接**: http://xhslink.com/o/3OP9sVEdvJr  
> **标签**: #唯品会 #Java #互联网大厂 #后端开发 #社招  
> **日期**: 2026-05-14  
> **背景**: 5年Java + 一本，硬刚4轮面试  
> **考点分类**: Java集合/并发、MySQL索引、Redis分布式锁、Spring AOP/自动装配、唯品会自研技术栈

---

## 面试特点

唯品会Java面试有3个鲜明特点：

1. **"工程味"非常重，不喜欢背八股** — 面试官反感"只会背书背概念"，更看重能不能把理论落到业务场景
2. **一定要深挖项目，拷打真实经历** — "介绍一下你做过的最复杂的项目"几乎必问，要的是"为什么这么做、有什么权衡、遇到了什么坑"
3. **技术栈偏"自研中台"** — 唯品会自研框架（OSP、Saturn、Hera、Mercury），聊出服务治理理解会很加分

## 面试轮次

| 轮次 | 内容 | 时长 |
|------|------|------|
| 一面 | 技术基础面（Java八股 + 集合 + 并发） | 45分钟，视频 |
| 二面 | 项目深挖 + 架构设计面 | 60分钟，视频 |
| 三面 | 交叉面 + 业务理解面 | 45分钟，视频 |
| 四面 | HR面 | 30分钟 |

---

## 一面 | 技术基础面

### Q1. ArrayList和LinkedList的区别？各适合什么场景？

**答**: ArrayList基于动态数组，适合随机访问；LinkedList基于链表，适合频繁插入删除。

**追问: ArrayList扩容机制？初始容量是多少？**
- 无参构造初始容量10，1.5倍扩容

**追问: 插入数据时谁更快？**
- 头部插入LinkedList快，尾部插入ArrayList不一定

**深度延伸**:

```java
// ArrayList扩容源码分析
public boolean add(E e) {
    ensureCapacityInternal(size + 1);  // 确保容量足够
    elementData[size++] = e;
    return true;
}

private void grow(int minCapacity) {
    int oldCapacity = elementData.length;
    int newCapacity = oldCapacity + (oldCapacity >> 1); // 1.5倍扩容
    if (newCapacity - minCapacity < 0)
        newCapacity = minCapacity;
    if (newCapacity - MAX_ARRAY_SIZE > 0)
        newCapacity = hugeCapacity(minCapacity);
    elementData = Arrays.copyOf(elementData, newCapacity); // 数组拷贝，O(n)
}
```

**工程踩坑**:
- 如果已知数据量，务必用 `new ArrayList<>(expectedSize)` 避免多次扩容
- LinkedList的随机访问是O(n)，不要用 `get(index)` 遍历，用Iterator
- 尾部插入ArrayList不一定快：如果触发扩容，需要O(n)拷贝；但如果不需要扩容，ArrayList是O(1)，LinkedList也是O(1)（有尾指针）

---

### Q2. HashMap的put过程？1.7和1.8的区别？

**答**: 计算hash → 定位桶 → 判断是否为空 → 判断key是否相同 → 插入

**追问: 多线程下会有什么问题？**
- 1.7会死循环（扩容时链表成环），1.8已修复（但仍有数据丢失风险）

**追问: ConcurrentHashMap怎么保证线程安全？**
- 1.7分段锁（Segment），1.8 CAS + synchronized

**深度延伸 — HashMap put全流程源码**:

```java
// JDK 1.8 HashMap.putVal
final V putVal(int hash, K key, V value, boolean onlyIfAbsent, boolean evict) {
    Node<K,V>[] tab; Node<K,V> p; int n, i;
    if ((tab = table) == null || (n = tab.length) == 0)
        n = (tab = resize()).length;                    // 1. 初始化/扩容
    if ((p = tab[i = (n - 1) & hash]) == null)
        tab[i] = newNode(hash, key, value, null);       // 2. 桶为空，直接插入
    else {
        Node<K,V> e; K k;
        if (p.hash == hash && ((k = p.key) == key || (key != null && key.equals(k))))
            e = p;                                      // 3. key相同，覆盖
        else if (p instanceof TreeNode)
            e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value); // 4. 红黑树插入
        else {
            for (int binCount = 0; ; ++binCount) {
                if ((e = p.next) == null) {
                    p.next = newNode(hash, key, value, null); // 5. 尾插法
                    if (binCount >= TREEIFY_THRESHOLD - 1)    // 链表长度>=8转红黑树
                        treeifyBin(tab, hash);
                    break;
                }
                if (e.hash == hash && ((k = e.key) == key || (key != null && key.equals(k))))
                    break;
                p = e;
            }
        }
        if (e != null) { // key已存在，替换value
            V oldValue = e.value;
            if (!onlyIfAbsent || oldValue == null)
                e.value = value;
            return oldValue;
        }
    }
    if (++size > threshold)
        resize();  // 扩容：容量*2，重新hash分配
    return null;
}
```

**1.7 vs 1.8 关键区别**:

| 对比项 | 1.7 | 1.8 |
|--------|-----|-----|
| 数据结构 | 数组+链表 | 数组+链表+红黑树 |
| 插入方式 | 头插法（多线程扩容死循环） | 尾插法 |
| 扩容 | 重新计算hash | 高低位分离（原位置或原位置+oldCap） |
| 链表转红黑树 | 无 | 长度≥8且数组≥64时转 |
| 红黑树退化链表 | 无 | resize时≤6退化 |

**ConcurrentHashMap 1.8线程安全**:
```java
// CAS + synchronized 细粒度锁
final V putVal(K key, V value, boolean onlyIfAbsent) {
    // ...
    if ((f = tabAt(tab, i = (n - 1) & hash)) == null) {
        if (casTabAt(tab, i, null, new Node<K,V>(hash, key, value, null))) // CAS插入空桶
            break;
    }
    else {
        synchronized (f) { // 只锁桶头节点，不锁整个Segment
            // 链表/红黑树操作
        }
    }
}
```

---

### Q3. i++是线程安全的吗？Java有哪些保证线程安全的方式？

**答**: i++不是线程安全的（读-改-写三步非原子）

**追问: volatile和synchronized的区别？**
- volatile轻量级、不阻塞、仅保证可见性（不保证原子性）
- synchronized重量级、阻塞、保证原子性+可见性

**线程安全方式**:

| 方式 | 保证范围 | 适用场景 |
|------|---------|---------|
| synchronized | 原子性+可见性 | 竞争不激烈的通用场景 |
| Lock (ReentrantLock) | 原子性+可见性 | 需要tryLock/公平锁/Condition |
| Atomic类 (CAS) | 原子性 | 单个变量的原子操作 |
| volatile | 可见性+有序性 | 状态标志位、DCL单例 |
| ThreadLocal | 线程隔离 | 避免共享（如SimpleDateFormat） |

**i++的坑**:
```java
// i++ 的字节码：不是原子操作
// iload_1    // 读取i
// iinc 1, 1  // i+1
// istore_1   // 写回i

// 正确的原子递增
AtomicInteger count = new AtomicInteger();
count.incrementAndGet(); // CAS保证原子性

// 或者用LongAdder（高并发下更优）
LongAdder adder = new LongAdder();
adder.increment(); // 分段CAS，竞争分散
```

---

### Q4. final、finally、finalize的区别？

| 关键字 | 作用 | 场景 |
|--------|------|------|
| final | 修饰类（不可继承）、方法（不可重写）、变量（不可修改） | 常量定义、防止继承/重写 |
| finally | try-catch-finally中保证执行 | 资源释放（关闭连接、流） |
| finalize | Object的方法，GC回收前调用（已废弃） | JDK 9标记@Deprecated，不推荐使用 |

**工程建议**: 
- 用 try-with-resources 代替 finally 手动关闭
- finalize有性能问题（GC延迟）和不确定性（不保证执行），用 Cleaner/PhantomReference 替代

---

### Q5. MySQL索引类型？联合索引(a,b,c)只查b会走索引吗？

**答**: 不会走索引（最左匹配原则，跳过a直接查b无法利用索引）

**索引类型**:
- 普通索引、唯一索引、主键索引、联合索引、全文索引

**追问: explain的type列？**
- 性能从好到差：`const > eq_ref > ref > range > index > ALL`

**深度延伸 — 最左匹配原则**:

```sql
-- 联合索引 idx_abc (a, b, c)
SELECT * FROM t WHERE a = 1;              -- ✅ 走索引 ref
SELECT * FROM t WHERE a = 1 AND b = 2;    -- ✅ 走索引 ref
SELECT * FROM t WHERE a = 1 AND b = 2 AND c = 3; -- ✅ 走索引 ref
SELECT * FROM t WHERE b = 2;              -- ❌ 不走索引（跳过a）
SELECT * FROM t WHERE a = 1 AND c = 3;    -- ⚠️ 只用a，c不走索引
SELECT * FROM t WHERE a > 1 AND b = 2;    -- ⚠️ 只用a的范围扫描，b不走

-- 索引下推优化（ICP，MySQL 5.6+）
-- 虽然c不能用于索引查找，但可以在存储引擎层用c过滤，减少回表次数
SELECT * FROM t WHERE a = 1 AND c = 3;  -- ICP: 在索引中就过滤c，不需要回表再过滤
```

**索引失效常见场景**:
1. 对索引列使用函数：`WHERE YEAR(create_time) = 2026` → 改为 `WHERE create_time >= '2026-01-01'`
2. 隐式类型转换：`WHERE varchar_col = 123` → 改为 `WHERE varchar_col = '123'`
3. LIKE左模糊：`WHERE name LIKE '%张'` → 改为全文索引或ES
4. OR条件：`WHERE a = 1 OR b = 2`（a和b分别有索引时可能走index_merge）

---

### Q6. Redis的分布式锁怎么实现？

**答**: SETNX + 过期时间 + Lua脚本保证原子性释放

**追问: Redlock了解吗？** — 知道，但一般单机Redis分布式锁够用

**深度延伸 — 分布式锁实现**:

```java
@Service
public class RedisDistributedLock {
    
    private final StringRedisTemplate redisTemplate;
    
    /**
     * 加锁 — 使用SET命令的NX+EX参数保证原子性
     */
    public boolean tryLock(String key, String value, long expireSeconds) {
        Boolean result = redisTemplate.opsForValue()
            .setIfAbsent(key, value, expireSeconds, TimeUnit.SECONDS);
        return Boolean.TRUE.equals(result);
    }
    
    /**
     * 释放锁 — Lua脚本保证"检查+删除"原子性
     * 防止误删别人的锁：A的锁过期了，B加锁成功，A删除了B的锁
     */
    public boolean unlock(String key, String value) {
        String script = """
            if redis.call('get', KEYS[1]) == ARGV[1] then
                return redis.call('del', KEYS[1])
            else
                return 0
            end
            """;
        Long result = redisTemplate.execute(
            new DefaultRedisScript<>(script, Long.class),
            Collections.singletonList(key),
            value
        );
        return Long.valueOf(1L).equals(result);
    }
}
```

**Redlock vs 单机锁**:

| 对比 | 单机Redis锁 | Redlock |
|------|------------|---------|
| 原理 | SETNX + 过期 | 向N个独立Redis实例加锁，多数成功即获取 |
| 可靠性 | 主从切换可能丢锁 | 更高（容忍少数节点故障） |
| 性能 | 高 | 低（需要多次网络往返） |
| 推荐 | 绝大多数场景够用 | 极端严格场景（金融） |

**工程踩坑**:
- 锁续期问题：业务执行时间超过锁过期时间 → 用Redisson的Watchdog自动续期
- value必须唯一（UUID）：防止误删别人的锁
- 加锁和设过期时间必须原子操作：`SET key value NX EX 30`，不要分成两步

---

### Q7. Spring AOP的实现原理？用的是哪种代理方式？

**答**: JDK动态代理（有接口）和CGLIB（无接口）

**追问: Spring默认用哪种？**
- 有接口用JDK，没有则CGLIB（Spring Boot 2.x默认全部CGLIB）

**深度延伸**:

```java
// JDK动态代理 — 基于接口
public class JdkProxy implements InvocationHandler {
    private Object target;
    
    public Object createProxy(Object target) {
        this.target = target;
        return Proxy.newProxyInstance(
            target.getClass().getClassLoader(),
            target.getClass().getInterfaces(),
            this
        );
    }
    
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        // 前置增强
        System.out.println("Before: " + method.getName());
        Object result = method.invoke(target, args);
        // 后置增强
        System.out.println("After: " + method.getName());
        return result;
    }
}

// CGLIB代理 — 基于继承（生成目标类的子类）
// Spring Boot 2.x 默认使用CGLIB，配置项：
// spring.aop.proxy-target-class=true (默认)
```

| 对比 | JDK动态代理 | CGLIB |
|------|------------|-------|
| 原理 | 基于接口，实现InvocationHandler | 基于继承，生成子类重写方法 |
| 限制 | 目标类必须实现接口 | 不能代理final类/final方法 |
| 性能 | 生成快，调用稍慢 | 生成慢，调用快 |
| Spring Boot 2.x | 不再默认 | 默认使用 |

---

### Q8. 唯品会的微服务框架OSP你了解吗？

**答**: OSP是唯品会自研的服务治理框架，类似Dubbo，更轻量、更适合唯品会业务场景。

**唯品会自研技术栈**:

| 组件 | 定位 | 类似开源 |
|------|------|---------|
| **OSP** | 微服务框架 | Dubbo |
| **Janus** | 服务网关 | Spring Cloud Gateway |
| **Saturn** | 分布式任务调度 | XXL-Job / Elastic-Job |
| **Hera** | 数仓服务平台 | 基于Alluxio |
| **Mercury** | 全链路监控 | SkyWalking / Jaeger |

**面试加分点**: 搜"唯品会技术博客"提前读几篇文章，面试官听到Hera/Saturn会眼前一亮

### 一面编程题: LRU缓存 (LeetCode 146)

```java
class LRUCache {
    private final int capacity;
    private final Map<Integer, Node> cache;
    private final Node head, tail; // 双向链表哨兵节点
    
    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.cache = new HashMap<>();
        head = new Node(0, 0);
        tail = new Node(0, 0);
        head.next = tail;
        tail.prev = head;
    }
    
    public int get(int key) {
        if (!cache.containsKey(key)) return -1;
        Node node = cache.get(key);
        moveToHead(node); // 访问后移到头部
        return node.value;
    }
    
    public void put(int key, int value) {
        if (cache.containsKey(key)) {
            Node node = cache.get(key);
            node.value = value;
            moveToHead(node);
        } else {
            Node node = new Node(key, value);
            cache.put(key, node);
            addToHead(node);
            if (cache.size() > capacity) {
                Node lru = removeTail();
                cache.remove(lru.key);
            }
        }
    }
    
    // 双向链表操作
    private void addToHead(Node node) {
        node.next = head.next;
        node.prev = head;
        head.next.prev = node;
        head.next = node;
    }
    
    private void removeNode(Node node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }
    
    private void moveToHead(Node node) {
        removeNode(node);
        addToHead(node);
    }
    
    private Node removeTail() {
        Node lru = tail.prev;
        removeNode(lru);
        return lru;
    }
    
    class Node {
        int key, value;
        Node prev, next;
        Node(int k, int v) { key = k; value = v; }
    }
}
```

---

## 二面 | 项目深挖 + 架构设计面

### Q1. 详细介绍一个你做过的最复杂的项目？

**答题框架 — STAR法则**:
- **S (Situation)**: 业务背景和挑战
- **T (Task)**: 你的职责和目标
- **A (Action)**: 具体做了什么、技术选型权衡
- **R (Result)**: 量化成果（QPS提升、延迟降低、成本节约）

**追问: 如果再让你做一次，你会怎么改进？** — 考验复盘能力

---

### Q2. 高并发场景下，如何保证接口的幂等性？

**答**: 唯一流水号 + Redis幂等字典 + 数据库唯一索引

**深度延伸**:

```java
@Service
public class IdempotentService {
    
    private final StringRedisTemplate redisTemplate;
    private final OrderMapper orderMapper;
    
    /**
     * 幂等性保证三层防线：
     * 1. Redis幂等键（快速失败）
     * 2. 数据库唯一索引（兜底）
     * 3. 乐观锁/状态机（并发更新）
     */
    @Transactional
    public OrderResult createOrder(CreateOrderRequest request) {
        String idempotentKey = "idempotent:order:" + request.getRequestId();
        
        // 第1层：Redis幂等检查
        Boolean isNew = redisTemplate.opsForValue()
            .setIfAbsent(idempotentKey, "1", 24, TimeUnit.HOURS);
        
        if (Boolean.FALSE.equals(isNew)) {
            // 重复请求，返回已有结果
            return getExistingOrder(request.getRequestId());
        }
        
        try {
            // 第2层：数据库唯一索引兜底（request_id唯一索引）
            Order order = orderMapper.insert(request);
            return OrderResult.success(order);
        } catch (DuplicateKeyException e) {
            // 唯一索引冲突，说明重复
            return getExistingOrder(request.getRequestId());
        }
    }
}
```

**工程踩坑**:
- Redis和DB的幂等键要设不同过期时间：Redis 24h，DB永久（或定期归档清理）
- 返回已有结果时要返回完整的业务数据，不要只返回"重复请求"
- 对于支付类操作，还需要加上第3层：状态机校验（只有待支付状态才能支付）

---

### Q3. 唯品会的数仓服务平台Hera你了解吗？

**答**: Hera是唯品会自研的数仓服务平台，基于Alluxio缓存表同步，人群计算从30分钟降到几分钟。

**面试追问: 如果是你设计类似的平台，会考虑哪些架构问题？**
- 多引擎适配（Spark/Flink/Presto）
- 缓存策略（热数据缓存、冷数据淘汰）
- 资源隔离（多租户场景）

---

### Q4. SpringBoot的自动装配原理？

**答**: `@SpringBootApplication` → `@EnableAutoConfiguration` → `META-INF/spring.factories`

**深度延伸**:

```java
// @SpringBootApplication 组合注解
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan
public @interface SpringBootApplication {}

// @EnableAutoConfiguration 核心
@AutoConfigurationPackage
@Import(AutoConfigurationImportSelector.class)
public @interface EnableAutoConfiguration {}

// AutoConfigurationImportSelector 加载流程：
// 1. 从 META-INF/spring.factories 读取 EnableAutoConfiguration 对应的类
// 2. 根据 @ConditionalOnClass / @ConditionalOnMissingBean 等条件过滤
// 3. 生效的自动配置类注册到容器

// Spring Boot 3.x 改为 META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

**条件注解**:
- `@ConditionalOnClass`: classpath存在某类时生效
- `@ConditionalOnMissingBean`: 容器中不存在某Bean时生效
- `@ConditionalOnProperty`: 配置项满足条件时生效

---

### Q5. 唯品会OSP微服务框架和服务网关Janus，解决的核心问题是什么？

**答**: 服务注册发现、负载均衡、统一鉴权

**网关层应该做的事**:
- 限流（令牌桶/滑动窗口）
- 熔断（Sentinel/Hystrix）
- 鉴权（JWT/OAuth2）
- 日志（访问日志、链路追踪ID注入）
- 协议转换（HTTP ↔ 内部RPC）

### 二面编程题: 合并K个有序链表 (LeetCode 23)

```java
class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        if (lists == null || lists.length == 0) return null;
        
        // 最小堆，按节点值排序
        PriorityQueue<ListNode> minHeap = new PriorityQueue<>(
            (a, b) -> a.val - b.val
        );
        
        // 把每个链表的头节点入堆
        for (ListNode node : lists) {
            if (node != null) minHeap.offer(node);
        }
        
        ListNode dummy = new ListNode(0);
        ListNode curr = dummy;
        
        while (!minHeap.isEmpty()) {
            ListNode min = minHeap.poll();  // 取出最小节点
            curr.next = min;
            curr = curr.next;
            if (min.next != null) {
                minHeap.offer(min.next);  // 下一个节点入堆
            }
        }
        
        return dummy.next;
    }
}
// 时间复杂度: O(N * logK)，N为总节点数，K为链表数
```

---

## 三面 | 交叉面 + 业务理解面

### Q1. 聊聊唯品会的个性化推荐业务，如果你是技术负责人会怎么架构？

**答题框架**: 数据采集 → 特征工程 → 模型推理 → AB实验

**架构设计要点**:
- 用户画像和标签数据（唯品会个性化工程平台部核心业务）
- 实时特征计算（Flink流处理）
- 模型服务化（TF Serving / Triton）
- AB实验平台（分流、指标收集、显著性检验）

---

### Q2. Redis和数据库数据一致性怎么保证？

**答**: 先更新DB再删缓存（Cache Aside Pattern）

**深度延伸 — 为什么是先更新DB再删缓存？**

| 策略 | 问题 |
|------|------|
| 先删缓存再更新DB | 并发时：A删缓存 → B读DB旧值写缓存 → A更新DB → **缓存是旧值** |
| 先更新DB再删缓存 | 并发时：A更新DB → B读缓存miss → B读DB新值 → A删缓存 → B写缓存（新值）✅ |
| 延迟双删 | 先删缓存 → 更新DB → 延迟再删缓存（兜底） |

**极端情况**: 先更新DB再删缓存也有极小概率不一致（B读缓存miss发生在A更新DB之前），但概率远低于先删缓存方案。

**工程实践**:
```java
// Cache Aside + 消息队列兜底
@Transactional
public void updateOrder(Order order) {
    // 1. 更新数据库
    orderMapper.update(order);
    
    // 2. 删除缓存
    redisTemplate.delete("order:" + order.getId());
    
    // 3. 发送消息到MQ，消费者异步再删一次（兜底）
    // 防止步骤2失败导致缓存与DB不一致
    mqTemplate.send("cache-invalidation", order.getId());
}
```

---

### Q3. 唯品会的Saturn和XXL-Job比有什么优势？

**答**: Saturn基于Elastic-Job改良，支持分片并发处理、全域统一配置监控。适合大促期间大量定时任务调度场景。

---

### Q4. 线上CPU飙高，怎么快速定位问题？

**答**: `top -Hp` 抓高占用线程 → `jstack` 抓堆栈 → 定位代码

**详细步骤**:

```bash
# 1. 找到高CPU的Java进程
top -c
# 假设PID = 12345

# 2. 找到进程中CPU最高的线程
top -Hp 12345
# 假设线程TID = 12350

# 3. 线程ID转十六进制
printf "%x\n" 12350
# 输出: 303e

# 4. jstack查看线程堆栈
jstack 12345 | grep -A 30 "303e"
# 定位到具体代码行

# 其他工具:
# arthas: thread -n 3  # 直接看Top3高CPU线程
# jmap -histo:live 12345  # 查看对象统计（排查内存问题）
```

### 三面编程题: 无重复字符的最长子串 (LeetCode 3)

```java
class Solution {
    public int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> window = new HashMap<>();
        int maxLen = 0, left = 0;
        
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            if (window.containsKey(c)) {
                // 窗口内有重复，收缩左边界
                left = Math.max(left, window.get(c) + 1);
            }
            window.put(c, right);
            maxLen = Math.max(maxLen, right - left + 1);
        }
        
        return maxLen;
    }
}
// 滑动窗口，时间O(n)，空间O(min(n, 字符集大小))
```

---

## 四面 | HR面

| 问题 | 要点 |
|------|------|
| 离职原因 | 正面表达，聚焦成长空间 |
| 期望薪资 | 唯品会参考 25K-40K × 15薪，5年经验35K左右 |
| 加班接受程度 | 大促期间有加班，平时相对稳定 |
| 反问 | 团队业务规划 |

**福利**: 唯品会广州总部工作环境和福利在广州算第一梯队

---

## 核心考点总结

| 类别 | 考点 | 频率 |
|------|------|------|
| Java集合 | HashMap底层(1.7/1.8)、ArrayList/LinkedList、ConcurrentHashMap | ⭐⭐⭐⭐⭐ |
| 并发编程 | volatile vs synchronized、线程池、i++线程安全、乐观锁/悲观锁 | ⭐⭐⭐⭐⭐ |
| MySQL | B+树索引、联合索引最左匹配、explain、索引失效 | ⭐⭐⭐⭐ |
| Spring | AOP代理方式、SpringBoot自动装配、IOC原理 | ⭐⭐⭐⭐ |
| Redis | 数据结构、分布式锁、缓存一致性 | ⭐⭐⭐⭐ |
| 唯品会技术栈 | OSP微服务、Saturn任务调度、Hera数仓、Mercury全链路监控 | ⭐⭐⭐（加分项） |
| 算法 | LRU、合并K个有序链表、无重复子串、树遍历 | ⭐⭐⭐ |

**面试建议**:
1. 一面八股不能丢：HashMap、volatile、ArrayList这些基础题必须扎实
2. 项目经验必须深度复盘：用STAR法则准备"最复杂的项目"
3. 提前了解唯品会自研技术栈：OSP、Saturn、Hera、Mercury是加分亮点
4. 本科够用，更看重技术和匹配度
5. 算法要刷：LRU高频必考
