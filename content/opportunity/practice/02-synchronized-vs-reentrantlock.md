---
title: "synchronized` 和 `ReentrantLock` 的区别是什么？各自适用什么场景？ReentrantLock 的公平锁和非公平锁在源码层面有什么区别？为什么默认用非公平锁？"
date: "2026-05-28"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "synchronized` 和 `ReentrantLock` 的区别是什么？各自适用什么场景？ReentrantLock 的公平锁和非公平锁在源码层面有什么区别？为什么默认用非公平锁？"
tags:
schema_version: "1"
question_id: "2"
question: "synchronized` 和 `ReentrantLock` 的区别是什么？各自适用什么场景？ReentrantLock 的公平锁和非公平锁在源码层面有什么区别？为什么默认用非公平锁？"
sources:
  - "unknown"
score: "5/10"
round: "R0"
next_review: "unknown"
session_id: "unknown"
---

## 第 2 题 · （待补充）

**题目**：`synchronized` 和 `ReentrantLock` 的区别是什么？各自适用什么场景？ReentrantLock 的公平锁和非公平锁在源码层面有什么区别？为什么默认用非公平锁？

### 用户回答（摘要）
---

## 回顾记录（2026-07-02，R5）

**得分：5/10**（首次 3/10，进步 2 分）

### 用户回答
- sync 是 JVM 层面锁，Reentrant 是 JDK 基于 AQS 的锁
- sync 可针对代码块、方法，没有时间设置
- Reentrant 可设置超时、是否公平
- sync 在 JVM 层面经历偏向锁→轻量级（CAS）→重量级的锁膨胀

### 追问+纠正记录
1. **可中断获取锁**：ReentrantLock 的 `lockInterruptibly()` 可以在等锁时响应中断，抛出 InterruptedException 主动放弃；synchronized 阻塞时 interrupt 无反应
2. **Condition 条件变量**：ReentrantLock 可以 `newCondition()` 创建多个等待队列，精确唤醒；synchronized 只有一个 wait/notify 队列，notifyAll 会全部唤醒
3. **偏向锁英文名**：Biased Locking，JDK 15（JEP 374）已废弃

### 最终结论
synchronized = JVM 内置锁，简单但功能少；ReentrantLock = 基于 AQS，支持超时、中断、公平、多条件队列。生产中需要精细控制时用 ReentrantLock，JDK 6+ 两者性能已差不多。

### 这次讨论的收获
- 偏向锁不是"偏向某个线程"，而是"偏向第一个用它的线程"
- ReentrantLock 的三个核心卖点：可中断、Condition、tryLock
- 锁膨胀路径：无锁→偏向→轻量级→重量级，JDK 15 废弃偏向锁


> synchronized好像是重锁，不能设置超时时间，只能针对方法或锁定某一个对象。reentrant log好像可以重复加锁。公平和非公平忘了。

### 评分：3/10

### 扣分点

1. synchronized 三种使用方式只提了"方法"，漏了同步代码块（-0.5）
2. ReentrantLock 只说了可重入，漏了超时/中断/公平/Condition 等关键差异（-1.5）
3. 公平锁 vs 非公平锁源码未掌握（-2）
4. AQS 原理未提及（-3）

### 正确答案要点

| 维度 | synchronized | ReentrantLock |
|------|-------------|---------------|
| 实现 | JVM 内置 | API 层面（AQS） |
| 加锁 | 方法/类锁/同步代码块 | lock/tryLock/lockInterruptibly |
| 超时 | ❌ | ✅ tryLock(time, unit) |
| 中断 | ❌ | ✅ lockInterruptibly |
| 公平性 | ❌ | ✅ 可选 |
| 条件变量 | wait/notify（一个） | 多个 Condition |
| 释放 | 自动 | 手动 finally |

### 公平锁 vs 非公平锁源码

- 非公平锁：lock() 时直接 CAS 抢锁，不管队列
- 公平锁：tryAcquire() 时先 `hasQueuedPredecessors()` 检查队列，有人排队就乖乖排队
- 默认非公平：减少线程切换开销，吞吐量高 10%-20%

### Condition 精确唤醒（追问）

- wait/notify 只有一个等待队列，notify 随机唤醒，notifyAll 全部唤醒
- Condition 可以创建多个等待队列（notFull/notEmpty），signal() 精确唤醒对应队列
- 底层：await() 从同步队列→Condition 队列，signal() 从 Condition 队列→同步队列
- 场景：生产者-消费者模型精确唤醒

### 薄弱项

- [ ] synchronized 三种使用方式
- [ ] AQS 公平/非公平源码
- [ ] Condition 多条件唤醒机制

---
