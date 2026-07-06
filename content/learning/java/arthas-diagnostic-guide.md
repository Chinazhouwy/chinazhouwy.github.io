---
title: "Arthas Java 诊断工具完全指南"
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
summary: "Arthas Java 诊断工具完全指南"
tags:
---

# Arthas Java 诊断工具完全指南

> 来源：微信公众号 | 标签：Java、Arthas、性能调优、问题排查
> **类型**：📚 参考资料（非面试题/面经）

## 简介

Arthas 是阿里开源的 Java 诊断工具，能够帮助开发者快速定位和解决 Java 应用的性能问题、内存泄漏、CPU 飙升等问题。

---

## 1. 安装与启动

```bash
# 下载
curl -O https://arthas.aliyun.com/arthas-boot.jar

# 启动
java -jar arthas-boot.jar

# 选择需要诊断的 Java 进程（输入进程编号）
```

---

## 2. 常用命令速查

### dashboard — 实时系统状态

```bash
dashboard
```

| 指标 | 用途 |
|------|------|
| CPU | 查看占用 CPU 高的线程 |
| Memory | 查看堆内存使用情况 |
| Threads | 查看活跃线程 |

### thread — 线程信息

```bash
thread                    # 查看所有线程
thread -n 3               # 查看 CPU 占用最高的 3 个线程
thread <线程ID>            # 查看某个线程的堆栈
thread -b                 # 查找阻塞的线程（deadlock）
```

### jvm — JVM 信息

```bash
jvm                       # 查看 JVM 信息（内存、GC、类加载等）
```

### heapdump — 堆内存快照

```bash
heapdump /path/to/heapdump.hprof
# 使用 MAT 或 JVisualVM 分析 heapdump.hprof 文件
```

### sc / sm — 类/方法信息

```bash
sc com.example.MyClass    # 查看已加载的类信息
sm com.example.MyClass    # 查看类的方法信息
```

### watch — 方法监控

```bash
watch com.example.MyClass myMethod "{params, returnObj, throwExp}" -n 5
```

| 变量 | 说明 |
|------|------|
| params | 方法参数 |
| returnObj | 返回值 |
| throwExp | 异常信息 |
| -n 5 | 监控 5 次调用 |

### trace — 方法调用链路追踪

```bash
trace com.example.MyClass myMethod
# 分析性能瓶颈，查看每个子调用的耗时
```

### monitor — 方法调用统计

```bash
monitor -c 5 com.example.MyClass myMethod
# -c 5：每 5 秒统计一次（调用次数、成功率、平均耗时等）
```

### ognl — 执行 OGNL 表达式

```bash
ognl '@com.example.MyClass@myStaticField'
# 查看或修改运行时的变量
```

---

## 3. 排查常见问题（标准流程）

### 场景一：CPU 飙升

| 步骤 | 命令 | 目的 |
|------|------|------|
| 1 | `dashboard` | 查看 CPU 占用高的线程 |
| 2 | `thread -n 3` | 找到 CPU 占用最高的 3 个线程 |
| 3 | `thread <线程ID>` | 查看线程堆栈，定位问题代码 |
| 4 | `trace` / `watch` | 进一步分析问题方法 |

### 场景二：内存泄漏

| 步骤 | 命令 | 目的 |
|------|------|------|
| 1 | `dashboard` | 查看内存使用情况 |
| 2 | `heapdump /tmp/heapdump.hprof` | 导出堆内存快照 |
| 3 | MAT / JVisualVM 分析 | 查找内存泄漏根源 |
| 4 | `sc` / `sm` | 查看相关类的加载和方法调用 |

### 场景三：方法性能问题

| 步骤 | 命令 | 目的 |
|------|------|------|
| 1 | `trace` | 追踪方法调用链路，分析耗时操作 |
| 2 | `monitor` | 监控调用统计，查看平均耗时和次数 |
| 3 | `watch` | 监控入参和返回值，定位问题 |

### 场景四：死锁

| 步骤 | 命令 | 目的 |
|------|------|------|
| 1 | `thread -b` | 查找死锁线程 |
| 2 | `thread <线程ID>` | 查看线程堆栈，分析锁竞争 |

---

## 4. 面试答题模板

### Q: 线上 CPU 飙升怎么排查？

> 1. `dashboard` 看整体 CPU 使用率
> 2. `thread -n 3` 找到 CPU 最高的线程
> 3. `thread <ID>` 看堆栈，定位到具体代码行
> 4. 如果是业务代码问题，用 `trace` 分析调用链路耗时
> 5. 如果是 GC 线程占用高，说明内存压力大，需要 `heapdump` 分析内存泄漏

### Q: 如何排查内存泄漏？

> 1. `dashboard` 看内存使用趋势
> 2. `heapdump` 导出堆快照
> 3. 用 MAT 分析，找 Dominator Tree 中占用最大的对象
> 4. 查看 GC Roots 引用链，找到泄漏源头
> 5. 常见泄漏场景：静态集合未清理、ThreadLocal 未 remove、未关闭的流/连接

### Q: 如何定位慢接口？

> 1. `trace` 追踪方法调用链路，看哪一步耗时最长
> 2. `monitor` 看调用统计，确认是否偶发还是持续慢
> 3. `watch` 看入参，确认是否是特定参数导致
> 4. 如果是 DB 慢，结合 `explain` 分析 SQL
> 5. 如果是外部调用慢，考虑加超时和熔断

---

## 5. 核心命令速查表

| 问题类型 | 首选命令 | 辅助命令 |
|---------|---------|---------|
| CPU 飙升 | `thread -n 3` | `dashboard`, `trace` |
| 内存泄漏 | `heapdump` | `dashboard`, `sc/sm` |
| 慢接口 | `trace` | `monitor`, `watch` |
| 死锁 | `thread -b` | `thread <ID>` |
| 方法参数/返回值 | `watch` | `ognl` |
| 调用统计 | `monitor` | `trace` |

---

## 6. 对面试的启示

1. **Arthas 是性能调优标配**: 腾讯瑞驰二面、有赞面经都考了 JVM 排查
2. **排查流程要熟练**: CPU 飙升 → 线程 → 堆栈 → 代码，这是标准链路
3. **MAT 要会用**: heapdump 导出后需要用 MAT 分析 Dominator Tree
4. **trace vs monitor**: trace 看调用链路耗时，monitor 看统计指标
5. **watch 看入参返回值**: 定位"为什么这个方法慢"的关键

---

*整理时间: 2026-05-18*


---

## 原始链接

原文链接待补充（搜索触发反爬，无法自动获取）

