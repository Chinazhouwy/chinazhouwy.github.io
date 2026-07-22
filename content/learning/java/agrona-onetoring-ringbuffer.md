---
schema_version: "1"
title: "Agrona OneToOneRingBuffer 无锁环形缓冲深度拆解"
date: "2026-07-22"
domain: "学习"
area: "Java 并发"
module: ""
project: ""
type: "学习笔记"
priority: ""
energy: "medium"
visibility: "private"
summary: "Agrona OneToOneRingBuffer 无锁环形缓冲区设计原理，对比 JDK 队列的性能优势和五大瓶颈"
tags:
  - "Java"
  - "并发"
  - "无锁"
  - "RingBuffer"
  - "Agrona"
  - "高性能"
source: "https://mp.weixin.qq.com/s/JLvDZfT9cV1x3tdrWtX3Mg"
---

# Agrona OneToOneRingBuffer 无锁环形缓冲深度拆解

> 来源：微信公众号文章
> 链接：https://mp.weixin.qq.com/s/JLvDZfT9cV1x3tdrWtX3Mg

## 背景

在高频交易、行情分发、日志采集、跨线程消息传递等纳秒级延迟场景中，JDK 自带并发队列性能天花板不够用：

| JDK 队列 | 瓶颈 |
|----------|------|
| ArrayBlockingQueue | 全程加锁开销大 |
| LinkedBlockingQueue | 对象分配带来 GC 灾难 |
| ConcurrentLinkedQueue | 无锁但 CAS 竞争激烈、缓存失效严重 |
| JDK 21 LinkedTransferQueue | SPSC 场景吞吐仅 400万-800万 ops/s |

**Agrona OneToOneRingBuffer** 同硬件下稳定跑到 **8000万-1.5亿 ops/s**，P99 延迟 100 纳秒级别。

Agrona 是 Real Logic 团队开源的高性能基础库，也是 Aeron 消息框架、SBE 编码库的底层依赖。环形缓冲有三个变种：
- SPSC → OneToOneRingBuffer
- MPSC → ManyToOneRingBuffer
- SPMC → OneToManyRingBuffer

## 一、JDK 队列为什么跑不快？

五个核心瓶颈，每个都对应 CPU 与内存架构的底层规律：

### 1. 对象封装带来的 GC 压力
JDK 队列存储对象引用，每条消息伴随对象创建与丢弃。千万级 QPS 下短命对象迅速占满 Eden 区，频繁触发 Young GC。

### 2. 锁与 CAS 的内存屏障开销
加锁伴随 CPU 内存屏障指令，强制刷写缓存、触发缓存行失效；CAS 竞争下的重试与缓存一致性开销同样昂贵。

### 3. 隐蔽的缓存行伪共享
CPU 缓存以 64 字节缓存行为单位读写。head、tail 指针若落在同一条缓存行，生产者写 tail 会让消费者缓存的 head 失效，反之亦然。JDK 8 的 `@Contended` 注解仅能部分缓解。

### 4. 链表布局对 CPU 预取不友好
链表节点分散在堆内存中，CPU 硬件预取器无法预测地址，每次访问大概率触发 cache miss（L1 命中 1 纳秒 vs 主存 100 纳秒）。

### 5. 阻塞语义的上下文切换成本
`BlockingQueue` 的 `take/put` 会挂起线程，一次 `park/unpark` 伴随两次内核态切换，开销数微秒起步。

## 二、四大核心设计

### 1. 连续字节缓冲：零分配、零拷贝

**核心改动：不存对象引用，只存字节流。**

- 底层是预分配的连续内存（`AtomicBuffer` 抽象，支持堆内数组、堆外 DirectByteBuffer、内存映射文件）
- 容量必须是 2 的幂，取模退化为位运算
- 消息帧格式：4 字节长度 + 4 字节消息类型 + N 字节载荷，按 8 字节对齐
- **就地零拷贝**：写入通过 `tryClaim` 拿到偏移量直接写入最终位置；读取时 handler 直接拿到 buffer 引用与偏移就地读取

> 一条消息从生产到消费，全程零对象分配、零内存拷贝，只在 CPU 缓存内完成字节移动。

### 2. 极简无锁协议：全程没有 CAS，只有一次 volatile 写

**核心约束：单生产者单消费者（SPSC）。**

核心状态只有两个单调递增的 long 计数器：
- `head`（消费者进度）
- `tail`（生产者进度）
- 不是数组索引，是累计字节数，对容量取模得到真实偏移

**单一写者原则**：生产者只写 tail，消费者只写 head，每个共享变量只有一个线程写。

**写入流程**：volatile 读 head → 普通读 tail → 写入消息字节 → volatile 写 tail
**读取流程**：volatile 读 tail → 普通读 head → 解析消息 → volatile 写 head

> 全程只有一次 volatile 写，在 x86 上仅对应一条 store 屏障，成本远低于 CAS。

正确性依托 JMM 的 happens-before 规则：volatile 写先行于后续对同一变量的 volatile 读。

**对比**：多生产者的 ManyToOneRingBuffer 需要引入 CAS，性能比 SPSC 低 30%-50%。

### 3. 手动缓存行填充：物理消除伪共享

- head 和 tail 各自独占一条 64 字节缓存行，中间用填充字节强行隔开
- 不依赖 JVM 参数（`-XX:-RestrictContended`），任何环境下效果稳定
- **进度缓存优化**：生产者和消费者各自缓存对方进度值，90%+ 热路径只访问本地缓存变量

### 4. 非阻塞设计：策略决策权交还业务

OneToOneRingBuffer **天生不阻塞**：写满返回 false，读不到返回 0，从不主动 park 线程。

**四种 IdleStrategy**：

| 策略 | 行为 | 适用场景 |
|------|------|----------|
| BusySpinIdleStrategy | 纯自旋，占满 CPU | 交易系统 |
| YieldingIdleStrategy | 自旋 + yield | 兼顾延迟与 CPU |
| BackoffIdleStrategy | 自旋→yield→park 逐级退让 | 通用推荐 |
| SleepingIdleStrategy | 直接休眠 | 低功耗 |

> 机制与策略分离：基础组件只做机制，把策略决策交还给业务。

## 三、选型对比

| 维度 | OneToOneRingBuffer | JDK 队列 |
|------|-------------------|----------|
| 吞吐量 | 8000万-1.5亿 ops/s | ArrayBlockingQueue 的 1/20-1/40 |
| 延迟 | P50 60-80ns，P99 ~100ns | 数百纳秒到数微秒，抖动大 |
| GC 压力 | 稳态零对象分配 | 千万级 QPS 下 Young GC 秒级 |
| 场景通用性 | 严格 SPSC，非阻塞 API | MPMC、阻塞、超时、泛型 |
| 内存形态 | 支持堆外内存与 mmap | 仅限堆内 |

**选型一句话**：千万级 QPS 以下、毫秒级延迟 → JDK 队列足够；千万级以上、微秒级 SLA → OneToOneRingBuffer 或 Disruptor；跨进程低延迟 → Agrona + Aeron。

## 四、五条设计心法

1. **用约束换性能** — 先把核心 90% 场景的约束抽出来做极致优化，剩下 10% 走通用降级
2. **内存布局优先于数据结构** — 连续字节缓冲 + 帧格式 > 散列对象引用（Kafka 日志段、Netty ByteBuf 同理）
3. **单一写者是无锁最优解** — CAS 只是入门，真正的高手通过架构避免竞争
4. **显式管理缓存行** — 热点变量考虑伪共享风险，源码层面显式表达
5. **机制与策略分离** — 基础组件只做机制，阻塞/自旋/重试/丢弃由业务决定

## 面试关联

这篇文章和以下面试题相关：
- #205 无锁队列怎么设计？CAS、内存屏障、Disruptor 思想怎么讲？
- #26 volatile、synchronized、CAS 和 JMM 的关系
- #203 synchronized 锁升级
- #143 线程池 7 大参数、队列选择
