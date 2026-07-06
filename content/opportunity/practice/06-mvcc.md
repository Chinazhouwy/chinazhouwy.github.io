---
title: "MVCC（多版本并发控制）是怎么实现的？"
date: "2026-06-03"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "MVCC（多版本并发控制）是怎么实现的？"
tags:
schema_version: "1"
question_id: "6"
question: "MVCC（多版本并发控制）是怎么实现的？"
sources:
  - "unknown"
score: "2/10"
round: "R0"
next_review: "unknown"
session_id: "unknown"
---

# 第6题 — MVCC + 锁机制完整讨论

> **题目**：MVCC（多版本并发控制）是怎么实现的？
> 追问1：Read View（读视图）里包含哪些字段？它是怎么决定一个数据版本是否可见的？
> 追问2：当前读和快照读有什么区别？哪些操作是当前读？
> 追问3：可重复读（RR）下能完全解决幻读吗？什么情况下不能？
> 追问4：临键锁（Next-Key Lock）是什么？什么时候触发？
> 追问5：间隙锁防 INSERT，那 UPDATE 和 DELETE 呢？

---

## 得分：2/10

### ✅ 答对的部分
- MVCC 是做并发控制的 ✅

### ❌ 问题
| 扣分点 | 扣分 |
|--------|------|
| "记录一行" — MVCC 是维护**多个版本**，不是只记录一行 | -1 |
| "按照某个字段状态来控制" — 没说清 trx_id、roll_pointer、Read View | -2 |
| 完全没提 Undo Log、Read View、快照读 vs 当前读 | -4 |

---

## 一、MVCC 核心概念

### 用户复述（修正后）

> MVCC 是 InnoDB 的并发控制机制。每次 UPDATE 操作，先把旧版本写入 Undo Log，然后修改当前行的事务ID和回滚指针，串成一个版本链。读数据时通过 Read View 判断版本链中哪个版本对当前事务可见——已提交的可见，未提交的不可见，不可见就沿着版本链找上一个版本。

### 三个核心组件

```
1. 隐藏列（每行数据自带）：
   - DB_TRX_ID：最后修改这行的事务ID
   - DB_ROLL_PTR：回滚指针，指向 Undo Log 中的上一个版本

2. Undo Log（版本链）：
   当前版本 → 上一个版本 → 上上个版本 → ... → 初始版本

3. Read View（读视图）：
   - m_ids：当前活跃（未提交）的事务ID列表
   - min_trx_id：最小活跃事务ID
   - max_trx_id：下一个将要分配的事务ID
   - creator_trx_id：创建 Read View 的事务ID
```

### Read View 可见性判断规则

```
拿到一行的 DB_TRX_ID，和 Read View 比较：

规则1：DB_TRX_ID == creator_trx_id → 自己的，可见 ✅
规则2：DB_TRX_ID < min_trx_id → 提交过了，可见 ✅
规则3：DB_TRX_ID >= max_trx_id → 还没开始，不可见 ❌
规则4：min_trx_id <= DB_TRX_ID < max_trx_id
  → 在 m_ids 中：没提交，不可见 ❌
  → 不在 m_ids 中：已提交，可见 ✅

不可见 → 沿 roll_ptr 找上一个版本，重复判断
```

---

## 二、用户追问 + 纠正记录

### 追问1：RC 和 RR 的区别

**用户回答**：
> RC（Read Committed）每次读都创建新的快照读，读已提交的记录。RR（Repeatable Read）只在第一次读时创建快照，后续复用。

**纠正**：用户说"会出现幻读"，实际应该是**不可重复读**。

```
| | RC（读已提交） | RR（可重复读） |
|--|--|--|
| Read View 创建时机 | 每次 SELECT 都新建 | 第一次 SELECT 创建，后续复用 |
| 核心区别 | 不可重复读（同一次事务两次读结果不同） | 可重复读（两次读结果相同） |
```

---

### 追问2：幻读 vs 不可重复读的区别

**用户提问**：幻读只是多了一行，和不可重复读差别也不大吧？

**解答**：差别在于**什么操作导致的**：

```
不可重复读：别人改了（UPDATE）→ 同一行的值变了
幻读：别人插了（INSERT）→ 行数变了，多了一行

不可重复读 → 靠 MVCC 的 Read View 就能解决（RR 下复用快照）
幻读 → 要区分快照读和当前读：RR 下普通快照读靠 MVCC 不会看到新插入；`SELECT ... FOR UPDATE` / `UPDATE` 这类当前读要靠 Next-Key Lock 锁范围
```

**数据库并发 4 种问题**：

| 问题 | 含义 | 例子 |
|------|------|------|
| 脏读 | 读到未提交的数据 | A改了没提交，B读到了 |
| 不可重复读 | 同一事务内两次读同一行，结果不同 | A读到100，B改成200，A再读变成200 |
| 幻读 | 同一事务内两次范围查询，行数不同 | A查到10条，B插入1条，A再查变成11条 |
| 丢失更新 | 两个事务互相覆盖 | A读100加50写150，B读100减30写70，A的+50丢了 |

**4 种隔离级别**：

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|----------|------|-----------|------|
| Read Uncommitted | ❌ | ❌ | ❌ |
| Read Committed | ✅ 解决 | ❌ | ❌ |
| Repeatable Read | ✅ | ✅ | ⚠️ 快照读解决，当前读没解决 |
| Serializable | ✅ | ✅ | ✅ |

---

### 追问3：临键锁（Next-Key Lock）是什么？

**用户提问**：临键锁是什么？FOR UPDATE 也会触发吗？

**解答**：

```
临键锁 = 行锁（Record Lock）+ 间隙锁（Gap Lock）

行锁：锁住已存在的某一行 → 防 UPDATE / DELETE
间隙锁：锁住两行之间的间隙 → 防 INSERT
临键锁：两个同时加 → 既防改又防插
```

```
表数据：id = [1, 3, 5, 7, 10]
SELECT * FROM user WHERE id > 3 AND id < 10 FOR UPDATE;

加的锁：
  行锁：id=5, id=7（范围内的已存在行）
  间隙锁：(3,5), (5,7), (7,10)（所有间隙）

其他事务：
  UPDATE id=5 → ❌ 行锁挡住
  DELETE id=7 → ❌ 行锁挡住
  INSERT id=6 → ❌ 间隙锁挡住
  INSERT id=8 → ❌ 间隙锁挡住
  UPDATE id=3 → ✅ 不在范围内
  INSERT id=11 → ✅ 不在范围内
```

---

### 追问4：间隙锁只防 INSERT 吗？UPDATE 和 DELETE 呢？

**用户提问**：FOR UPDATE 一个范围，别人删和更新就可以，那不也出问题了吗？

**纠正**：之前的例子有误导性。正确结论：

```
FOR UPDATE 范围内有行：
  → 行锁锁住那些行
  → UPDATE / DELETE 都不行 ❌
  → INSERT 也不行 ❌

FOR UPDATE 范围内没行：
  → 没有行锁，只有间隙锁
  → 没有东西可以 UPDATE / DELETE（不是"可以"，是"没有"）
  → INSERT 不行 ❌
```

**之前说错的例子**：

```
❌ 我之前说：
  表数据：id = [1, 5, 10]
  SELECT * FROM user WHERE id > 5 AND id < 10 FOR UPDATE;
  → 事务B：UPDATE id=5 → ✅ 可以执行

  这个例子虽然技术上没错（id=5 不在 id>5 范围内）
  但表述方式有误导性，让人以为 FOR UPDATE 不防 UPDATE/DELETE

✅ 正确说法：
  范围内有行 → 行锁锁住 → UPDATE / DELETE 都不行
  范围内没行 → 没东西可改 → 不存在"可以改"的问题
```

---

### 追问5：INSERT 也会触发间隙锁吗？

**用户提问**：INSERT 加间隙锁也太奇怪了吧，生产中不会这样吧？

**解答**：

```
间隙锁不是 INSERT 自己加的，是别人加的锁挡住了你的 INSERT

真正的情况：
  事务A：SELECT * FROM user WHERE id > 5 AND id < 10 FOR UPDATE;
  → 加了间隙锁 (5, 10)

  事务B：INSERT INTO user (id) VALUES (7);
  → 被事务A的间隙锁挡住 ❌

所以：
  间隙锁不是为了限制 INSERT
  间隙锁是为了保护 SELECT ... FOR UPDATE 的一致性
```

**触发锁的操作汇总**：

| 操作 | 锁类型 | 说明 |
|------|--------|------|
| SELECT ... FOR UPDATE | 临键锁 | 行锁 + 间隙锁 |
| SELECT ... LOCK IN SHARE MODE | 临键锁 | 共享锁版本 |
| UPDATE | 行锁 + 间隙锁 | 锁已存在的行 + 防止间隙插入 |
| DELETE | 行锁 + 间隙锁 | 同上 |
| INSERT | 插入意向锁（Insert Intention Lock） | INSERT 自己不是为了“锁间隙防别人插入”，而是在插入位置申请意向；如果该间隙已有 gap/next-key lock，就会被阻塞 |

---

### 追问6：临键锁的"键"是什么键？

**用户提问**：是主键还是某个 ID？锁错了怎么办？

**解答**：

```
临键锁锁的是索引键，不是随便一个字段

用哪个索引，就锁哪个索引的范围：
  - 用主键查 → 锁主键索引的范围
  - 用二级索引查 → 锁二级索引的范围
  - 没走合适索引 → 扫描并锁住大量记录/间隙，效果接近锁全表

锁不会锁错，因为 B+树是有序的，InnoDB 严格按索引顺序扫描

但索引选择错误会导致锁范围变大：
  - 走对索引：只锁相关行 ✅
  - 没走合适索引：锁范围非常大，效果接近锁全表 ❌
  - 范围查询：锁很大范围 ❌
```

---

## 三、最终结论

### MVCC 能处理哪些操作

| 操作 | MVCC 能处理？ | 怎么处理 |
|------|-------------|---------|
| UPDATE | ✅ | 旧版本写 Undo Log，读旧版本 |
| DELETE | ✅ | 打删除标记，旧版本写 Undo Log，读旧版本 |
| INSERT | ⚠️ 要分场景 | RR 快照读不会看到后插入的数据；当前读要靠 next-key/gap lock 阻止范围内新插入 |

### 锁的分工

```
行锁（Record Lock）→ 防 UPDATE / DELETE
间隙锁（Gap Lock）→ 防 INSERT
临键锁（Next-Key Lock）= 行锁 + 间隙锁 → 既防改又防插 → 防幻读
```

### 面试一句话总结

> MVCC 通过版本链 + Read View 实现读写不冲突。RC 每次一致性读新建快照，RR 通常复用事务第一次一致性读的快照。RR 下快照读靠 MVCC 避免看到新插入，当前读靠临键锁（行锁+间隙锁）防幻读。临键锁锁的是索引范围，没走合适索引就可能锁住大量记录和间隙——这也是为什么慢 SQL 加锁影响大。

---

## 四、这次讨论的收获（用户追问的价值）

1. **RC vs RR**：用户追问后才搞清楚"不可重复读"和"幻读"的区别
2. **临键锁触发条件**：用户追问"只有 INSERT 才触发吗"，才发现 FOR UPDATE 也会触发
3. **间隙锁防什么**：用户追问"UPDATE 和 DELETE 呢"，才发现之前例子有误导性
4. **键是什么**：用户追问"锁错了怎么办"，才引出索引选择对锁范围的影响
5. **生产实用性**：用户追问"INSERT 加间隙锁太冷门了"，才区分面试考点和生产痛点

**结论：追问比标准答案更有价值，因为追问暴露了理解的盲区。**
