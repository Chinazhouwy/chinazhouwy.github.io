---
title: "OPPO 后端 Java 二面面经（高并发+线程池专场）"
date: "2026-05-25"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "资料"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "OPPO 后端 Java 二面面经（高并发+线程池专场）"
tags:
---

# OPPO 后端 Java 二面面经（高并发+线程池专场）

> **来源**: 小红书
> **链接**: http://xhslink.com/o/39f5zP8XTIT
> **公司**: OPPO
> **轮次**: 二面
> **标签**: #后端 #Java #高并发 #线程池 #面经

---

## 基本信息

- **面试时长**: 32分钟
- **面试形式**: 线上面试
- **考察重点**: 多线程、线程池、并发工具、并发问题解决

---

## 一、自我介绍（2分钟）

---

## 二、核心技术提问

### 1. 线程池核心参数详解？拒绝策略有哪些？实际项目中如何配置线程池？

**答**：
- **核心参数**：核心线程数、最大线程数、空闲时间、阻塞队列、拒绝策略
- **四种拒绝策略**：
  - `AbortPolicy` — 抛出异常
  - `DiscardPolicy` — 静默丢弃
  - `DiscardOldestPolicy` — 丢弃队列最旧任务
  - `CallerRunsPolicy` — 调用者线程执行
- **项目实践**：
  - IO密集型：多设置核心线程数
  - 禁止使用 `Executors` 创建线程池，自定义线程池防止 OOM

### 2. 线程的五大状态流转？阻塞状态有几种？分别对应什么场景？

**答**：
- **五大状态**：新建（New）→ 就绪（Runnable）→ 运行（Running）→ 阻塞（Blocked）→ 终止（Terminated）
- **阻塞状态分类**：
  1. **等待阻塞**（Waiting）— `wait()` 调用
  2. **同步阻塞**（Blocked）— 获取锁失败
  3. **超时阻塞**（Timed Waiting）— `sleep()` / `join(timeout)`

---

## 三、高并发安全问题

- 线程安全问题及解决方案（详细展开）

---

## 四、反问环节

- 团队高并发业务场景
- 线上常见并发问题

---

## 五、面试总结

- 本场聚焦**高并发实战能力**，偏向业务落地
- 不仅考理论，重点考察线程池、并发集合的实际使用规范
- 附带简单手撕代码
- OPPO 后端二面高频场次

---

> **相关面试**: [OPPO 后端 Java 终面面经（Redis+缓存）](./2026-05-25-oppo-backend-java-final-round-redis-cache.md)