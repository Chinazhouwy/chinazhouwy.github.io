---
title: "百度后端Java二面面经 — 并发+数据库底层"
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
summary: "百度后端Java二面面经 — 并发+数据库底层"
tags:
---

# 百度后端Java二面面经 — 并发+数据库底层

> 来源：小红书 | 时长：50分钟 | 面试形式：线上面试（牛客网）

## 面试流程

自我介绍(30s) → 核心技术提问 → 项目深挖 → 算法题 → 反问

## 核心技术提问

### 1. ConcurrentHashMap 下标计算？JDK1.7和1.8区别？

**答题思路：**
- JDK1.7：`Segment` 数组 + `HashEntry`，分段锁
- JDK1.8：`Node` 数组 + 链表/红黑树，`synchronized` + CAS
- 1.8优化哈希计算：`(h ^ (h >>> 16)) & (n-1)`，分散哈希、减少碰撞
- 1.8为什么优化：减少哈希冲突概率，提升并发插入性能

### 2. MVCC 实现原理？Undo Log 链和 Read View 的作用？

- **Undo Log 版本链**：每行记录有 `DB_TRX_ID`（事务ID）和 `DB_ROLL_PTR`（回滚指针），串起多个版本
- **Read View**：事务启动时创建的快照视图
  - `m_ids`：当前活跃事务ID列表
  - `min_trx_id`：最小活跃事务ID
  - `max_trx_id`：下一个要分配的事务ID
  - `creator_trx_id`：创建该Read View的事务ID
- **可见性判断**：数据事务ID < `min_trx_id` 可见；= `creator_trx_id` 可见；在 `m_ids` 中不可见...

### 3. 读已提交 vs 可重复读，Read View 创建时机？

- **RC**：**每次查询**都创建新的 Read View → 不可重复读
- **RR**：**事务第一次查询**创建 Read View，复用 → 可重复读
- RC 问题：不可重复读（同一事务两次查询结果不同）
- RR 问题：幻读（间隙锁解决一部分，但部分场景仍有）

### 4. Synchronized 和 Lock 的区别

| 维度 | synchronized | Lock |
|------|-------------|------|
| 底层 | JVM 原生（monitorenter/monitorexit） | AQS（API层面） |
| 锁升级 | 无锁→偏向锁→轻量级锁→重量级锁 | 无升级机制 |
| 可中断 | ❌ | ✅ `lockInterruptibly()` |
| 公平性 | ❌ 非公平 | ✅ 支持公平/非公平 |
| 超时 | ❌ | ✅ `tryLock(time, unit)` |

### 5. 线程池核心参数如何配置？

```
corePoolSize + maximumPoolSize + keepAliveTime + TimeUnit
+ workQueue + threadFactory + RejectedExecutionHandler
```

**配置原则：**
- **CPU密集型**：`core = N+1`（N为CPU核数）
- **IO密集型**：`core = 2N` 或更高
- **混合型**：拆分或根据RT计算：`core = 目标QPS × RT`
- **队列**：有界队列（避免OOM），根据峰值计算容量
- **拒绝策略**：`CallerRunsPolicy` 保证不丢任务，或自定义

## 项目深挖

1. 项目中并发场景如何保证并发安全？死锁排查和解决？
2. 数据库索引如何设计？如何判断索引是否有效？

## 算法题

**手撕快速排序**：分治思想、边界处理
- 时间复杂度：平均 O(n log n)，最坏 O(n²)
- 空间复杂度：O(log n) 递归栈

## 面试总结

- 侧重基础原理的深度考察
- 并发和数据库底层细节
- 项目追问聚焦并发安全和性能优化
- 算法题中等难度，注重代码规范
