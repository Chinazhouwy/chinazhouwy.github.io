---
title: "字节跳动国际支付-后端开发-三面面经"
date: "2026-06-28"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "资料"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "字节跳动国际支付-后端开发-三面面经"
tags:
---

# 字节跳动国际支付-后端开发-三面面经

**来源：** [掘金](https://juejin.cn/post/7656276853405630479) | 作者：鹤望兰675 | 日期：2026-06-28

## 题目：用 Java 写一个秒杀系统

这一面只有手撕环节，没有问答环节。

### 题目描述

设计一个秒杀系统，让 100 个线程去秒杀库存为 30 的商品，需要保证线程安全。如果一个线程在调用秒杀接口时（抢锁）超过 3s，那么判定该次秒杀超时，放弃秒杀；如果一个线程抢到了秒杀的机会，但是在支付环节超过 10s 没有进行支付操作，那么判定这次秒杀无效，需要对库存数量进行回滚。

### 给定框架

```java
public class Redeem {
    // 初始化商品 ID 和对应的数量
    public void init(int goodId, int stock) {}
    
    // 秒杀入口，若秒杀成功，则返回订单 ID（这里我直接返回线程名称）
    public String redeemGood(int goodId) {}
    
    // 减少库存
    public boolean decrementStock(int goodId) {}

    // 回滚库存
    public void undoDecrement(int goodId) {}
    
    // 检查当前库存数量
    public int checkStock(int goodId) {}

    // 主函数
}
```

### 作者面试时的思路

- 一上来给 `redeemGood` 加 `synchronized`，用 `ConcurrentHashMap<Integer, AtomicInteger>` 存 `(goodId, stock)`
- 不知道如何在 `synchronized` 块判断超时，没想到 `ReentrantLock`
- 打算用线程池 + 100 个 `Callable` + `invokeAll`，但忘了 `newFixedThreadPool` 声明和拒绝策略

### 复盘思路（AI 辅助）

#### init 的设计

用 `ConcurrentHashMap` 存 `(goodId, stock)`，stock 使用 **Semaphore** 而非 `AtomicInteger`。

**为什么不用 AtomicInteger：**
- 先检查 `stock.get() > 0` 再 `decrementAndGet()` 是两步操作，存在竞态
- 用 CAS 自旋可以解决，但 `Semaphore.tryAcquire` 本身就是 CAS 操作，无需手动写自旋

**数据结构：** `ConcurrentHashMap<Integer, SemaphoreAndStocks>`

```java
public SemaphoreAndStocks(Semaphore semaphore, int stock) {
    this.semaphore = semaphore;
    this.initialStock = stock;  // 用于避免 semaphore.release() 溢出
}
```

#### redeemGood 的设计

```java
public String redeemGood(int goodId) {
    if (decrementStock(goodId)) {
        return Thread.currentThread().getName();
    }
    return "null";
}
```

#### decrementStock 的设计

使用 `Semaphore.tryAcquire(TIMEOUT, TimeUnit.MILLISECONDS)` 实现：
- 超时 3s 限制（通过 `tryAcquire(long, TimeUnit)` 参数实现）
- 无需在此模拟支付环节，支付在另一线程/逻辑中处理

```java
public boolean decrementStock(int goodId) {
    SemaphoreAndStocks sas = map.get(goodId);
    if (sas == null) return false;
    Semaphore semaphore = sas.getSemaphore();
    try {
        if (!semaphore.tryAcquire(TIMEOUT, TimeUnit.MILLISECONDS)) {
            return false;
        }
    } catch (InterruptedException e) {
        throw new RuntimeException(e);
    }
    return true;
}
```

#### undoDecrement 的设计

```java
public void undoDecrement(int goodId) {
    SemaphoreAndStocks sas = map.get(goodId);
    if (sas == null) return;
    Semaphore semaphore = sas.getSemaphore();
    if (semaphore.availablePermits() < sas.getInitialStock()) {
        semaphore.release();
    }
}
```

**关键点：** 限制 `semaphore.release()` 不能超过初始值，防止超卖。

### 完整代码

```java
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class Redeem {
    public static Random rand = new Random(2026);
    private static class SemaphoreAndStocks {
        private final Semaphore semaphore;
        private final int initialStock;

        public SemaphoreAndStocks(Semaphore semaphore, int stock) {
            this.semaphore = semaphore;
            this.initialStock = stock;
        }

        public Semaphore getSemaphore() { return semaphore; }
        public int getInitialStock() { return initialStock; }
    }

    private final ConcurrentHashMap<Integer, SemaphoreAndStocks> map = new ConcurrentHashMap<>();
    private static final long TIMEOUT = 3000;
    private static final int MAX_THREAD = 100;

    public void init(int goodId, int stock) {
        this.map.putIfAbsent(goodId, new SemaphoreAndStocks(new Semaphore(stock), stock));
    }

    public String redeemGood(int goodId) {
        if (decrementStock(goodId)) {
            return Thread.currentThread().getName();
        }
        return "null";
    }

    public boolean decrementStock(int goodId) {
        SemaphoreAndStocks sas = map.get(goodId);
        if (sas == null) return false;
        Semaphore semaphore = sas.getSemaphore();
        try {
            if (!semaphore.tryAcquire(TIMEOUT, TimeUnit.MILLISECONDS)) {
                return false;
            }
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
        return true;
    }

    public void undoDecrement(int goodId) {
        SemaphoreAndStocks sas = map.get(goodId);
        if (sas == null) return;
        Semaphore semaphore = sas.getSemaphore();
        if (semaphore.availablePermits() < sas.getInitialStock()) {
            semaphore.release();
        }
    }

    public int checkStock(int goodId) {
        SemaphoreAndStocks sas = map.get(goodId);
        if (sas == null) return 0;
        return sas.getSemaphore().availablePermits();
    }

    public static void main(String[] args) {
        int goodId = 1248;
        long payTimeout = 10_000;
        Redeem redeem = new Redeem();
        redeem.init(goodId, 30);
        ExecutorService fixedThreadPool = Executors.newFixedThreadPool(100);
        List<Callable<String>> callableList = new ArrayList<>(MAX_THREAD);
        AtomicInteger undo = new AtomicInteger();

        for (int i = 0; i < MAX_THREAD; i++) {
            callableList.add(() -> {
                String res = redeem.redeemGood(goodId);
                if ("null".equals(res)) return res;
                // 模拟支付环节 0~11s 随机
                long t0 = System.currentTimeMillis();
                Thread.sleep(rand.nextLong(0, 11_000));
                long t1 = System.currentTimeMillis();
                return t1 - t0 < payTimeout ? res : "undo";
            });
        }

        Map<String, Integer> threadAndRedeemTimes = new LinkedHashMap<>();
        int counter = 0;
        while (redeem.checkStock(goodId) > 0) {
            try {
                var futureList = fixedThreadPool.invokeAll(callableList);
                for (Future<String> future : futureList) {
                    try {
                        String s = future.get();
                        if ("undo".equals(s)) {
                            redeem.undoDecrement(goodId);
                            undo.incrementAndGet();
                        } else if (!"null".equals(s)) {
                            ++counter;
                            threadAndRedeemTimes.merge(s, 1, Integer::sum);
                        }
                    } catch (InterruptedException | ExecutionException e) {
                        throw new RuntimeException(e);
                    }
                }
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        }

        for (var entry : threadAndRedeemTimes.entrySet()) {
            System.out.println(entry.getKey() + ": " + entry.getValue());
        }
        System.out.println();
        System.out.println("========== 最终结果 ==========");
        System.out.println("剩余库存：" + redeem.checkStock(goodId));
        System.out.println("undo 数：" + undo.get());
        System.out.println("成功数：" + counter);
        fixedThreadPool.shutdown();
    }
}
```

### 核心知识点

| 考点 | 方案 |
|------|------|
| 线程安全库存管理 | `Semaphore` 替代 `AtomicInteger`，`tryAcquire` 天然 CAS |
| 抢锁超时 3s | `Semaphore.tryAcquire(3000, TimeUnit.MILLISECONDS)` |
| 支付超时 10s 回滚 | 主函数中模拟支付耗时，`undoDecrement` + `availablePermits()` 保护 |
| release 防溢出 | 调用前检查 `availablePermits() < initialStock` |
| 多轮秒杀 | `while(redeem.checkStock(goodId) > 0)` 循环 + `invokeAll` |

### 作者感悟

- 手敲代码仍然不可缺失，对系统架构里每一个细节的理解和把控，必须亲自设计一遍
- AI 写代码是短期乐趣，手搓复杂系统是能够不断回味的乐趣
- 多线程 API（Semaphore、ReentrantLock、线程池声明）需要实际记忆，不能完全依赖 AI
