---
noteId: 6a1969c0000000003501e602
source: https://www.xiaohongshu.com/explore/6a1969c0000000003501e602
author: HateMe
date: 2026-05-29
company: 飞猪（阿里旗下）
position: Java后端
round: 一面
tags: [实习, 项目, JDK, GC, 分库分表, 线程池, Agent, RAG]
---

# 飞猪 Java后端一面面经（实习+项目）

> **面试时长**：未标注
> **手撕代码**：无
> **面试氛围**：偏基础 + 项目深挖

---

## 1、你常用的 JDK 是什么？JDK8 和 17 区别在哪里？JDK21 的新特性？

### JDK 8 vs 17 核心区别

| 特性 | JDK 8 | JDK 17 |
|------|-------|--------|
| **Lambda** | ✅ 支持 | ✅ 支持 |
| **Stream API** | ✅ 基础版 | ✅ 增强（toList() 等） |
| **Switch 表达式** | ❌ | ✅ `switch(x) { case 1 -> ...}` |
| **Record 类** | ❌ | ✅ `record Point(int x, int y) {}` |
| **Sealed 类** | ❌ | ✅ 密封类，限制继承 |
| **Pattern Matching** | ❌ | ✅ `if (obj instanceof String s)` |
| **Text Block** | ❌ | ✅ 多行字符串 `"""..."""` |
| **ZGC** | 实验性 | 生产可用 |
| **Shenandoah GC** | 需要特殊构建 | 内置 |
| **G1 默认** | ❌（ParallelGC） | ✅ G1 为默认 GC |

### JDK 21 新特性

- **虚拟线程（Virtual Threads）**：Project Loom，轻量级线程，百万级并发
- **分代 ZGC**：ZGC 分代管理，性能提升
- **Record Patterns**：解构模式 `case Point(int x, int y) ->`
- **Switch Pattern Matching**：`case String s when s.length() > 5 ->`
- **String Templates**（预览）

---

## 2、CMS、G1、ZGC 的区别和底层？

### 三者对比

| | CMS | G1 | ZGC |
|--|-----|-----|-----|
| **算法** | 标记-清除 | 分区标记-整理 | 染色指针 + 读屏障 |
| **目标** | 最短停顿 | 吞吐量+低延迟平衡 | 极致低延迟 |
| **停顿时间** | 不可控 | 可设目标（-XX:MaxGCPauseMillis） | <1ms |
| **内存碎片** | 有（需Full GC整理） | 无（复制整理） | 无 |
| **JDK** | 9 废弃 | 9+ 默认 | 15+ 生产可用 |
| **堆大小** | 中小堆 | 中大堆 | 超大堆（TB级） |

### 底层原理

**CMS**（Concurrent Mark Sweep）：
- 初始标记(STW) → 并发标记 → 重新标记(STW) → 并发清除
- 缺点：内存碎片、浮动垃圾、CPU敏感

**G1**（Garbage-First）：
- 堆分成等大 Region（1-32MB）
- 每个 Region 动态扮演 Eden/Survivor/Old/Humongous
- Mixed GC：优先回收垃圾最多的 Region（Garbage-First 名字由来）
- Remembered Set 跨 Region 引用追踪

**ZGC**：
- 染色指针（Colored Pointer）：指针中存 GC 状态
- 读屏障（Load Barrier）：访问对象时检查指针状态
- 并发整理：几乎全程并发，停顿 <1ms
- 支持 TB 级堆

---

## 3、为什么 G1 不以最短停顿为目的，但实现了短停顿？

**关键点**：G1 的目标是**可预测的停顿时间**，不是"最短"。

```
G1 通过 -XX:MaxGCPauseMillis=200 设定目标停顿时间
  ↓
G1 在每次 GC 时，根据停顿时间预算
选择回收价值最高的 Region（Garbage-First 策略）
  ↓
在时间预算内尽可能多回收垃圾
  ↓
结果：停顿时间可控，同时吞吐量也不错
```

**对比 CMS**：CMS 的并发停顿时间不可控，退化到 Full GC 时停顿可能几秒。G1 通过 Region 化 + 回收优先级，让停顿时间**可预测**。

---

## 4、模板方法是什么，有什么用？

```java
public abstract class AbstractService {
    
    // 模板方法：定义算法骨架，不可被子类重写
    public final void execute() {
        init();           // 步骤1
        doBusiness();     // 步骤2（子类实现）
        destroy();        // 步骤3
    }
    
    protected abstract void doBusiness();  // 抽象方法，子类必须实现
    
    private void init() { /* 固定逻辑 */ }
    private void destroy() { /* 固定逻辑 */ }
}
```

**用途**：
- 固定流程，子类只关心变化的部分
- 钩子方法：子类可选择性重写默认行为
- 避免代码重复

**Spring 中的例子**：`JdbcTemplate`、`RestTemplate` 都是模板方法模式。

---

## 5、Stream 流怎么将对象映射到 Map？会有哪些安全问题？

```java
// 对象列表转 Map
Map<Long, User> userMap = userList.stream()
    .collect(Collectors.toMap(
        User::getId,      // key：用户ID
        Function.identity() // value：用户对象本身
    ));
```

### 安全问题

**1. Key 重复抛异常**
```java
// 如果有重复的 ID，会抛 IllegalStateException
// 解决：指定合并函数
Map<Long, User> userMap = userList.stream()
    .collect(Collectors.toMap(
        User::getId,
        Function.identity(),
        (v1, v2) -> v1  // 重复key时保留第一个
    ));
```

**2. NPE 风险**
```java
// 如果 User 的 getId() 返回 null，会抛 NPE
// 解决：过滤 null
Map<Long, User> userMap = userList.stream()
    .filter(u -> u.getId() != null)
    .collect(Collectors.toMap(User::getId, Function.identity()));
```

**3. 线程安全**
```java
// Stream 本身是串行的，但如果在 parallelStream 中使用
// Collectors.toMap 不是线程安全的
// 解决：用 parallelStream 时改用 ConcurrentHashMap
Map<Long, User> userMap = userList.parallelStream()
    .collect(Collectors.toMap(
        User::getId,
        Function.identity(),
        (v1, v2) -> v1,
        ConcurrentHashMap::new  // 指定线程安全的Map
    ));
```

---

## 6、订单表每天百万增量，怎么设计表字段和数据库？

### 表设计原则

```sql
CREATE TABLE orders (
    order_id      BIGINT PRIMARY KEY,    -- 雪花算法ID
    user_id       BIGINT NOT NULL,       -- 用户ID（分片键）
    order_no      VARCHAR(32) UNIQUE,    -- 业务订单号
    amount        DECIMAL(10,2),         -- 金额
    status        TINYINT,               -- 状态：0待支付 1已支付 2已发货 3完成 4取消
    created_at    DATETIME,              -- 创建时间
    updated_at    DATETIME,              -- 更新时间
    INDEX idx_user_id (user_id),         -- 用户维度查询
    INDEX idx_created_at (created_at)    -- 时间维度查询
) ENGINE=InnoDB;
```

### 分库分表策略

```
日增100万 → 月增3000万 → 年增3.6亿
  ↓
单表超5000万性能下降 → 必须分表
  ↓
分片键：user_id（最常用的查询维度）
分表规则：user_id % 64 → 分到64张表
分库：按 user_id 范围或哈希分到多个库
```

---

## 7、分库分表分片键怎么设置？多表关联事务怎么保证？

### 分片键选择

- **按用户维度**：`user_id % N`，用户相关查询都在同一分片
- **按时间维度**：`created_at 按月分片`，冷热数据分离
- **按订单维度**：`order_id % N`

### 多表关联事务

**问题**：分库后，关联的表可能在不同库，无法用本地事务。

**解决方案**：

| 方案 | 适用场景 | 优缺点 |
|------|---------|--------|
| **分布式事务（Seata）** | 强一致性 | 性能差，复杂 |
| **消息最终一致性** | 异步场景 | 可靠，但有延迟 |
| **同库部署** | 相关表放同一库 | 简单，但扩展性差 |
| **数据冗余** | 读多写少 | 空间换时间 |

---

## 8、雪花算法的结构组成？用雪花算法做订单 ID 长度合适吗？

### 结构（64位）

```
0 | 00000000 00000000 00000000 00000000 00000000 0 | 00000 | 00000 | 000000000000
符号位(1)    时间戳(41位)                            数据中心(5) 机器(5)  序列号(12)
```

| 部分 | 位数 | 说明 |
|------|------|------|
| 时间戳 | 41位 | 毫秒级，可用69年 |
| 数据中心 | 5位 | 最多32个数据中心 |
| 机器ID | 5位 | 每个数据中心最多32台机器 |
| 序列号 | 12位 | 毫秒内最多4096个ID |

### 订单 ID 长度

```
雪花算法生成的 ID 是一个 Long 类型的数字
例如：1821345678901234567
长度：19位数字
```

**合适吗？**
- ✅ 数据库存 BIGINT 没问题
- ✅ 全局唯一，趋势递增
- ⚠️ 暴露了时间信息（安全敏感场景需注意）
- ⚠️ 单机依赖时钟，时钟回拨会出问题

**替代方案**：UUID（32位，太长）、Leaf（美团，支持号段模式和雪花模式）

---

## 9、线程池怎么实现的？自定义参数？项目里怎么用的？

### 核心参数（7个）

```java
new ThreadPoolExecutor(
    corePoolSize,      // 核心线程数
    maximumPoolSize,   // 最大线程数
    keepAliveTime,     // 非核心线程空闲存活时间
    TimeUnit.SECONDS,  // 时间单位
    workQueue,         // 任务队列
    threadFactory,     // 线程工厂
    handler            // 拒绝策略
);
```

### 执行流程

```
任务提交 → 核心线程没满？→ 创建核心线程执行
                  ↓ 满了
            任务入队（workQueue）
                  ↓ 队列满了
            创建非核心线程执行
                  ↓ 都满了
            执行拒绝策略
```

### 项目中的实际配置

```java
// 例子：订单处理线程池
ThreadPoolExecutor orderExecutor = new ThreadPoolExecutor(
    10,                 // 核心10个线程
    20,                 // 最大20个线程
    60, TimeUnit.SECONDS,
    new LinkedBlockingQueue<>(1000),  // 有界队列1000
    new ThreadFactoryBuilder().setNameFormat("order-%d").build(),
    new ThreadPoolExecutor.CallerRunsPolicy()  // 拒绝策略：调用者执行
);
```

---

## 10、Agent 项目怎么设计的？AI 客服流程？RAG 怎么分块的？向量模型？

### Agent 架构

```
用户输入
  ↓
意图识别（LLM 判断用户想干什么）
  ↓
├─ 知识问答 → RAG 检索 → 生成回答
├─ 工具调用 → 调用外部 API（查订单、退款等）
└─ 多轮对话 → 维护上下文，追问确认
```

### RAG 分块策略

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| **固定大小** | 按字符数分块（如500字） | 简单文本 |
| **语义分块** | 按段落/章节语义切分 | 结构化文档 |
| **滑动窗口** | 固定大小 + 重叠（overlap） | 保持上下文连贯 |
| **递归分块** | 先按大标题，再按段落，再按句子 | 长文档 |

### 向量模型选择

| 模型 | 维度 | 适用场景 |
|------|------|---------|
| **text-embedding-3-small** | 1536 | OpenAI，通用 |
| **bge-large-zh** | 1024 | 中文场景，开源 |
| **m3e-base** | 768 | 中文，轻量级 |

---

## 11、向量相似度计算之后的操作呢？

```
向量检索 → 返回 Top K 相似文档
  ↓
融合排序（RRF / Reranker）
  ↓
取 Top 3 喂给 LLM
  ↓
LLM 生成最终回答
```

### 检索后操作

1. **过滤**：去掉相似度低于阈值的结果
2. **去重**：合并重复内容
3. **重排序（Reranker）**：用小模型精排
4. **上下文拼接**：格式化为 Prompt 模板
5. **生成回答**：LLM 基于检索结果生成

---

## 面试标签

`#后端开发` `#java` `#飞猪` `#阿里`
