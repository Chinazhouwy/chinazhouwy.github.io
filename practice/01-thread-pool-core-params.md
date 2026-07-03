---
question: 第 1 题 · Java 并发 · 线程池核心参数与执行流程
date: 2026-05-28
---

## 第 1 题 · Java 并发 · 线程池核心参数与执行流程

**题目**：线程池的 7 个核心参数分别是什么？`corePoolSize`、`maximumPoolSize`、`keepAliveTime` 这三个参数之间是什么关系？当一个新任务提交到线程池时，内部的执行流程是怎样的？

### 用户回答（摘要）

> 线程池创建时以最小线程数（核心线程数）存活。新来的任务先到任务队列，线程池从队列抓取任务处理。超过核心线程数范围时，创建新线程。新线程处理完任务后等待一段时间销毁。任务越来越多超过等待队列范围，执行拒绝策略。

### 评分：4/10

### 扣分点

1. **执行流程搞反了（-4分）**：回答"先入队列"，实际是**先创建核心线程，核心线程满了才入队**
2. 7 个参数没有逐一列出
3. `keepAliveTime` 只对非核心线程生效（默认），没提到

### 正确流程

```
任务提交
  ↓
① 当前线程数 < corePoolSize？
  → 是：直接创建新核心线程执行（不入队）
  ↓
② 核心线程满了 → 任务入队（workQueue）
  ↓
③ 队列满了 + 当前线程数 < maximumPoolSize？
  → 是：创建非核心线程执行
  ↓
④ 都满了 → 执行拒绝策略
```

### 核心源码：ThreadPoolExecutor.execute()

```java
public void execute(Runnable command) {
    int c = ctl.get();

    // ① 当前线程数 < corePoolSize → 直接创建核心线程执行
    if (workerCountOf(c) < corePoolSize) {
        if (addWorker(command, true))   // true = 核心线程
            return;
        c = ctl.get();
    }

    // ② 核心线程满了 → 入队
    if (isRunning(c) && workQueue.offer(command)) {
        int recheck = ctl.get();
        if (!isRunning(recheck) && remove(command))
            reject(command);
        else if (workerCountOf(recheck) == 0)
            addWorker(null, false);
    }
    // ③ 入队失败（队列满了）→ 尝试创建非核心线程
    else if (!addWorker(command, false))
        // ④ 非核心线程也创建失败 → 执行拒绝策略
        reject(command);
}
```

### 7 个核心参数

| 参数 | 含义 |
|------|------|
| `corePoolSize` | 核心线程数（最小存活线程） |
| `maximumPoolSize` | 最大线程数 |
| `keepAliveTime` | 非核心线程空闲存活时间 |
| `unit` | keepAliveTime 的时间单位 |
| `workQueue` | 任务等待队列 |
| `threadFactory` | 线程创建工厂（自定义线程名等） |
| `handler` | 拒绝策略 |

### 常见线程池默认值

```java
// newFixedThreadPool：core=maximum，无界队列，用完即销毁
new ThreadPoolExecutor(n, n, 0L, MILLISECONDS, new LinkedBlockingQueue<>());

// newCachedThreadPool：core=0，最大无限，60秒超时，SynchronousQueue
new ThreadPoolExecutor(0, Integer.MAX_VALUE, 60L, SECONDS, new SynchronousQueue<>());
```

### 踩坑点

- `newFixedThreadPool` 用无界队列，maximumPoolSize 设了也没用 → 任务堆积 → OOM
- 生产环境必须用**有界队列** + 自定义拒绝策略

### 薄弱项

- [ ] 线程池执行流程（核心考点，已纠正）
- [ ] 7 个参数完整记忆

---
