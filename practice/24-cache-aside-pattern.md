---
schema_version: 1
question_id: 24
question: "更新数据库后删缓存（Cache Aside Pattern）为什么比\"先删缓存再更新DB\"推荐？极端情况下（如并发读写）仍然会不一致，怎么兜底？"
date: 2026-06-08
sources:
  - tencent/2026-06-07-tencent-ai-backend-round1-xhs.md
  - middleware/vipshop-java-interview.md
  - ai-agent/amap-agent-backend-intern-interview.md
score: "5/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
# 第24题 — 缓存更新策略（Cache Aside Pattern）

> **题目**：更新数据库后删缓存（Cache Aside Pattern）为什么比"先删缓存再更新DB"推荐？极端情况下（如并发读写）仍然会不一致，怎么兜底？
> 追问：1. 延迟双删能解决什么问题？有什么风险？2. Canal binlog方案和MQ方案区别？3. 逻辑过期 vs 物理过期？4. 实际项目怎么选？

---

## 得分：5/10

### ✅ 答对的部分
- Cache Aside 基本原理正确（先更新DB再删缓存）
- 指出了先删缓存的问题（并发读导致旧值重新写入缓存）
- 延迟双删提到500ms延迟
- Canal监听binlog方向正确
- 逻辑过期的基本概念

### ❌ 问题
| 问题 | 扣分 |
|------|------|
| 延迟双删顺序说反了 | -1 |
| 500ms是拍脑袋的，应从主从延迟推导 | -1 |
| 逻辑过期解释模糊，没说异步刷新机制 | -1 |
| Canal方案没展开 | -1 |
| 没回答"实际怎么选" | -1 |

---

## 一、核心概念

### 为什么"先更新DB再删缓存"更好？

```
方案A（推荐）：更新DB → 删缓存
线程1: UPDATE name='张三' ✓
线程2:          GET name → 缓存已删 → 查DB → 返回'张三' ✓
线程1:          DEL cache ✓
最坏：线程2在DEL之前读到旧值，但DEL之后就一致了

方案B（有问题）：删缓存 → 更新DB
线程1: DEL cache ✓
线程2:          GET name → 缓存空 → 查DB(旧值) → SET cache='李四' ✗
线程1:          UPDATE name='张三' ✓
结果：DB='张三'，缓存='李四' → 不一致且持久
```

核心区别：方案A不一致是**暂时的**，方案B不一致是**持久的**。

### 延迟双删

正确顺序：删缓存 → 更新DB → sleep(主从延迟) → 再删缓存

N的取值：主从同步延迟 + 业务读取耗时 + 余量

### Canal binlog方案

业务只管更新DB，Canal监听binlog异步删/更新缓存。

Canal vs MQ：
- Canal：零侵入、binlog天然有序、需部署Canal Server
- MQ：需要业务发消息、可能丢消息、需维护MQ基础设施

### 逻辑过期 vs 物理过期

物理过期：Redis TTL，过期后完全一致，但瞬间可能穿透
逻辑过期：字段内嵌expire_time，过期后异步刷新，当前返回旧值保证可用性

---

## 二、延迟双删 Demo

```java
public void updateWithDoubleDelete(String key, Object newValue) {
    // 1. 先删缓存
    redisTemplate.delete(key);
    // 2. 更新数据库
    userRepository.update(newValue);
    // 3. 异步延迟再删一次
    CompletableFuture.runAsync(() -> {
        try {
            long slaveDelay = getSlaveSyncDelayMs(); // 从监控获取
            Thread.sleep(slaveDelay + 100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        redisTemplate.delete(key);
    });
}
```

### 延迟双删风险
- sleep期间服务重启，第二次删丢失
- 第二次删失败无重试
- 主从延迟动态变化，固定N可能不够

---

## 三、面试回答模板

> 缓存更新用 Cache Aside Pattern——先更新DB再删缓存。
> "先删缓存再更新DB"在并发下会导致脏缓存（持久不一致），而"先更新DB再删缓存"最多读到一次旧值（暂时不一致）。
> 极端情况用延迟双删兜底，等主从同步后再次删除。
> 已有Canal基础设施的话用binlog方案，业务零侵入。
> 高可用场景用逻辑过期——内嵌过期时间+异步刷新，保证可用性。

---

## 用户追问+纠正记录

1. **延迟双删顺序**：用户说"更新完先删一遍，再更新DB"——顺序说反了，正确是删缓存→更新DB→延迟删缓存
2. **500ms取值**：用户说"500ms吧"——应从主从延迟推导，不是拍脑袋
3. **逻辑过期**：用户说"数据不过期然后给标识"——方向对但解释模糊，核心是异步刷新+返回旧值
4. **Canal**：用户说"监听binlog日志"——方向正确但没展开和MQ的区别

## 原始来源
- `tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`
- `middleware/vipshop-java-interview.md`
- `ai-agent/amap-agent-backend-intern-interview.md`
