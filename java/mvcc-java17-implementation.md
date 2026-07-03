---
source: https://mp.weixin.qq.com/s/lD3vUMW2uHziT08H85qLHA
title: 用Java 17手写一个MVCC，彻底搞懂多版本并发控制
date: 2026-05-29
tags: [MVCC, 并发控制, 事务, 数据库, Java17]
---

# 用Java 17手写一个MVCC，彻底搞懂多版本并发控制

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：微信公众号
> **核心观点**：MVCC = 先操作再校验，不加锁，读写各干各的，提交时才检查冲突

---

## 一、悲观锁 vs MVCC

| | 悲观锁 | MVCC |
|--|--------|------|
| **思路** | 先加锁再操作 | 先操作再校验 |
| **读写关系** | 读写互斥 | 读写各干各的 |
| **并发性能** | 低（锁粒度大） | 高（读全程无锁） |
| **冲突处理** | 加锁等待 | 提交时版本校验 |

**类比**：像 Git 协作 — 每人本地修改不阻塞，push 时才检查冲突。

---

## 二、Demo 整体设计（5个类）

| 类 | 职责 |
|----|------|
| `VersionedRecord<V>` | 带版本号的不可变数据记录（Java record） |
| `MvccStore<V>` | 存储引擎，管理已提交数据，提交时版本校验 |
| `MvccTransaction<V>` | 事务对象，持有快照 + 写缓冲区 |
| `ConflictException` | 版本冲突异常 |
| `MvccDemo` | 演示入口，3个并发场景 |

### 事务生命周期

```
1. 开始事务 → 从 Store 拿快照（浅拷贝）
2. 读数据   → 先查写缓冲区，没有再读快照（全程无锁）
3. 写数据   → 写到本地缓冲区（对其他事务不可变）
4. 提交     → 加锁，检查版本号是否一致
              一致 → 写入已提交存储，版本号+1
              不一致 → 抛 ConflictException
```

---

## 三、核心代码

### 1. 不可变数据记录

```java
public record VersionedRecord<V>(V value, int version) {}
```

**不可变性的意义**：事务拍快照时拷贝的是 record 引用，如果 record 可变，其他线程修改会导致快照不一致。用不可变的 record，引用拷贝就够了，不需要深拷贝。

### 2. 存储引擎提交校验

```java
void commitTransaction(MvccTransaction<V> tx) throws ConflictException {
    Map<String, V> writeBuffer = tx.getWriteBuffer();
    Map<String, VersionedRecord<V>> snapshot = tx.getSnapshot();
    
    commitLock.lock();  // 全局锁，保证多key写入原子性
    try {
        // 版本校验阶段
        for (String key : writeBuffer.keySet()) {
            VersionedRecord<V> currentRecord = committed.get(key);
            VersionedRecord<V> snapshotRecord = snapshot.get(key);
            int actualVersion = (currentRecord != null) ? currentRecord.version() : 0;
            int expectedVersion = (snapshotRecord != null) ? snapshotRecord.version() : 0;
            
            if (expectedVersion != actualVersion) {
                throw new ConflictException(tx.getTxId(), key, expectedVersion, actualVersion);
            }
        }
        // 写入阶段
        for (Map.Entry<String, V> entry : writeBuffer.entrySet()) {
            String key = entry.getKey();
            V newValue = entry.getValue();
            VersionedRecord<V> currentRecord = committed.get(key);
            int currentVersion = (currentRecord != null) ? currentRecord.version() : 0;
            committed.put(key, new VersionedRecord<>(newValue, currentVersion + 1));
        }
    } finally {
        commitLock.unlock();
    }
}
```

### 3. 事务读写

```java
// 读：先查写缓冲区，再查快照（读自己的写）
public V read(String key) {
    if (writeBuffer.containsKey(key)) {
        return writeBuffer.get(key);
    }
    VersionedRecord<V> record = snapshot.get(key);
    return (record != null) ? record.value() : null;
}

// 写：只写本地缓冲区
public void write(String key, V value) {
    writeBuffer.put(key, value);
}
```

---

## 四、3个并发场景

### 场景1：并发修改不同key → 无冲突

```
TX-1: 读 balanceA=1000, 写 balanceA=900, 提交 ✅
TX-2: 读 balanceB=2000, 写 balanceB=1800, 提交 ✅
结果: balanceA=900(v2), balanceB=1800(v2)
```

### 场景2：并发修改同一key → 版本冲突

```
TX-1: 读 balance=1000(v1), 写 balance=900, 提交 ✅ (v1→v2)
TX-2: 读 balance=1000(v1), 写 balance=800, 提交 ❌ (快照v1≠当前v2)
结果: balance=900(v2)
```

### 场景3：读不阻塞写（快照隔离）

```
TX-1: 读 config=v1.0 (长读事务)
TX-2: 写 config=v2.0, 提交 ✅
TX-1: 再读 config=v1.0 (快照隔离，不受影响)
```

---

## 五、两个关键设计决策

### 1. 版本号 per-key，不是全局递增

每个 key 独立维护版本号，提交时只检查涉及的 key，不需要关心其他 key。

### 2. 全局锁 vs per-key CAS

单 key 用 CAS 就够（`ConcurrentHashMap.replace`），但一个事务可能写多个 key，需要保证**全部写入或一个都不写**。全局锁让提交串行化，保证多 key 写入原子性。

---

## 六、业务应用场景

| 场景 | 说明 |
|------|------|
| **电商库存+订单** | 商品详情页读 >> 下单写，MVCC 保证查询不被库存扣减阻塞 |
| **金融账户余额** | 查余额 >> 转账，快照隔离保证一致性 |
| **配置中心** | etcd 用 MVCC 管理配置，支持按版本查询历史 |
| **数据分析报表** | 长时间查询走快照，不阻塞线上写操作 |

---

## 七、面试答题模板

> **Q：MVCC 怎么做到读不阻塞写？**
> 
> A：每条数据维护多版本，读操作读历史快照（全程无锁），写操作创建新版本。提交时加锁检查版本号：一致则写入并递增版本号，不一致则抛冲突异常。核心是「先操作再校验」，类似 Git 协作模式。


---

## 原始链接

https://mp.weixin.qq.com/s/lD3vUMW2uHziT08H85qLHA

