---
title: "AQS 源码深度解析：CLH 队列、独占/共享模式与 Condition"
date: "2026-08-30"
domain: "学习"
area: "Java 后端"
module: "Java 并发与异步"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "从架构到源码：state+CLH变体队列+CAS三核心、Node设计、独占/共享获取释放、Condition等待通知、取消清理、以及为什么是CLH不是MCS。"
tags:
  - Java
  - 并发
  - AQS
  - JUC
---

# AQS 源码深度解析

> 来源：微信公众号文章（JUC 源码系列）
> 关联：synchronized 锁升级、CompletableFuture 实战，构成并发三件套；与 JD 面经"三个锁工具选型"呼应

## 一、整体架构

JUC 基石：ReentrantLock、CountDownLatch、Semaphore、ReentrantReadWriteLock 都建在它上面。

**三个核心**：
- `volatile int state` — 同步状态：独占模式 = 重入次数/锁占用，共享模式 = 剩余许可数
- **CLH 变体队列** — FIFO 双向链表，线程阻塞/唤醒的载体
- **CAS** — 所有状态变更的原子操作基础

## 二、Node 设计要点

- `SHARED` 用 Node 实例、`EXCLUSIVE` 用 null 区分（非枚举）——省内存、省比较
- `waitStatus`：CANCELLED(1) / SIGNAL(-1) / CONDITION(-2) / PROPAGATE(-3)
- 用 volatile 字段而非 volatile 数组——每个 Node 独立可见，避免伪共享
- **与原版 CLH 区别**：原版是自旋锁（每个节点自旋等前驱），AQS 改为 park 挂起 + waitStatus 协作唤醒——避免无效唤醒、省 CPU、支持超时取消

## 三、state 的 CAS：为什么用 Unsafe 而非 AtomicInteger

- AtomicInteger 底层也是 `Unsafe.compareAndSwapInt`；直接用少一层封装，性能更可控
- `acquireQueued` 自旋：前驱是 head 且 `tryAcquire` 成功 → `setHead`；否则 `shouldParkAfterFailedAcquire` + `parkAndCheckInterrupt`
- **设计哲学**：CAS 失败不立刻 park，先检查前驱状态，只有前驱是 SIGNAL/CANCELLED 才 park——减少无效 park/unpark

## 四、独占模式（ReentrantLock 底层）

- **公平 vs 非公平唯一区别**：公平版 CAS 前多 `hasQueuedPredecessors()` 检查
  - 注意 `h.next == null` 表示队列正在初始化，不算有前驱
- **tryRelease**：state 减到 0 才算释放（重入语义），否则只减计数
- **unparkSuccessor 从 tail 向前扫描**：node.next 可能已失效（取消时 next 置 null），从 tail 倒序找最近的非取消节点——AQS 中为数不多的反向遍历

## 五、共享模式（Semaphore/CountDownLatch 底层）

- `tryAcquireShared` 返回值：`>= 0` 成功（剩余许可数），`< 0` 失败
- **setHeadAndPropagate 是共享与独占最大不同**：propagate > 0（还有剩余许可）或原 head 是 SIGNAL → `doReleaseShared` 唤醒后继；且**只唤醒 isShared() 节点，不唤醒独占节点**避免浪费

## 六、enq 入队：两次 CAS 设计

先 CAS 设 tail 成功后才 `t.next = node`——若先设 next 再 CAS，失败时 tail 未变但 next 已挂，其他线程看到不一致状态。先 CAS 再改 next 保证原子性。

## 七、Condition：独占模式下的等待/通知

本质是**独立的 CLH 队列**（firstWaiter/lastWaiter）：
- `await`：addConditionWaiter 加入 Condition 队列 → `fullyRelease` 释放锁（state=0，不占锁等待）→ 不在主队列时 park
- `signal`：`transferForSignal` 把节点从 Condition 队列 **移到 AQS 主队列尾部**（enq），必要时 unpark
- 节点 waitStatus=CONDITION(-2)，不在主队列唤醒逻辑中

## 八、cancelAcquire：取消清理

断 thread 引用 → 标记 CANCELLED → CAS 逐指针跳过自己（`compareAndSetNext(pred, node, succ)`）。双向链表删除难点：多线程同时操作，用 CAS 逐个更新 next 而非一次性断开。

## 九、shouldParkAfterFailedAcquire：惰性 SIGNAL 标记

- 前驱 SIGNAL → 安全 park
- 前驱 CANCELLED → 跳过所有取消节点
- 否则 CAS 给前驱标记 SIGNAL，**返回 false 再自旋一次**——CAS 可能失败（其他线程在改），需再循环确认。惰性标记：不到 park 那一刻不做多余的事

## 十、四个设计之问

1. **为什么 CLH 不是 MCS**：AQS 需要从 tail 向前扫描找有效节点，CLH 的 prev 引用天然支持；MCS 的 hint 机制在此场景无优势
2. **为什么 volatile 而非 synchronized**：synchronized 竞争激烈时涉及内核态切换；volatile+CAS 无竞争时单指令、有竞争时自旋，延迟更可控。代价是约 2000 行全是细节
3. **为什么 int 而非 AtomicInteger**：少一层对象头间接访问；AQS 自封装 CAS 可加失败自旋；独占模式 state 表示重入次数（>1），语义不符"单一值"
4. **模板方法精髓**：子类只需实现 tryAcquire/tryRelease/tryAcquireShared/tryReleaseShared 四选二，队列管理、park/unpark、CAS 全部复用——"策略模式+模板方法"经典结合：AQS 负责什么时候能排队，子类负责什么时候能拿到锁
