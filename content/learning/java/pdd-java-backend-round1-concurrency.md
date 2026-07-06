---
title: "拼多多后端Java一面面经 — 并发核心"
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
summary: "拼多多后端Java一面面经 — 并发核心"
tags:
---

# 拼多多后端Java一面面经 — 并发核心

> 来源：小红书 | 侧重：并发编程+线程池

## 面试题

### 1. Synchronized vs ReentrantLock

- synchronized：JVM 原生锁，隐式加解锁，自动释放
- ReentrantLock：API 层面锁，显式加解锁，支持公平/非公平/可中断/可限时
- 简单同步用 synchronized，复杂并发控制用 ReentrantLock

### 2. ThreadLocal 原理、内存泄漏

**原理：**
- 每个线程持有自己的 ThreadLocalMap
- 键为弱引用 ThreadLocal 对象，值为线程独立副本

**内存泄漏：**
- 线程池线程常驻，key 被 GC 回收（弱引用），但 value 强引用无法回收
- **解决方案**：每次使用完调用 `remove()` 方法

### 3. 线程池7大参数 + 4种拒绝策略

**核心参数：** corePoolSize、maximumPoolSize、keepAliveTime、TimeUnit、workQueue、threadFactory、RejectedExecutionHandler

**拒绝策略：**
1. `AbortPolicy`：抛异常（默认）
2. `CallerRunsPolicy`：调用者线程执行
3. `DiscardPolicy`：丢弃不抛异常
4. `DiscardOldestPolicy`：丢弃队列最旧任务

### 4. 为什么不推荐 Executors？

- `newFixedThreadPool`：无界队列 `LinkedBlockingQueue`，任务堆积 → OOM
- `newCachedThreadPool`：最大线程数 `Integer.MAX_VALUE`，线程创建过多 → OOM
- **必须手动 `new ThreadPoolExecutor()` 指定有界队列**

### 5. 死锁的4个条件

1. 互斥条件
2. 持有并等待
3. 不可剥夺
4. 循环等待

### 6. 算法题

**二叉树层序遍历（BFS）**

```java
public List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> res = new ArrayList<>();
    if (root == null) return res;
    Queue<TreeNode> queue = new LinkedList<>();
    queue.offer(root);
    while (!queue.isEmpty()) {
        int size = queue.size();
        List<Integer> level = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            TreeNode node = queue.poll();
            level.add(node.val);
            if (node.left != null) queue.offer(node.left);
            if (node.right != null) queue.offer(node.right);
        }
        res.add(level);
    }
    return res;
}
```

## 面试总结

- 并发是重头戏：锁比较、ThreadLocal、线程池参数
- 拒绝 Executors 是高频坑点
- 算法题中等难度（BFS）
