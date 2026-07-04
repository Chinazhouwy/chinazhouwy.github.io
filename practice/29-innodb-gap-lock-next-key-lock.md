---
schema_version: 1
question_id: 29
question: "InnoDB 行锁、间隙锁、Next-Key Lock 和死锁排查"
date: 2026-06-10
sources:
  - unknown
score: "unknown"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
# 第29题：InnoDB 行锁、间隙锁、Next-Key Lock 和死锁排查

## 题目来源
《菜鸟Java二面MySQL篇》、《腾讯云终面》、《practice/06-mvcc.md》

## 你的回答

### 行锁（Record Lock）
**得分：3/3**
- 你的回答：`SELECT ... FOR UPDATE` 会锁住索引记录
- 评价：✅ 基本正确

### 间隙锁（Gap Lock）
**得分：2/4**
- 你的回答：在 `FOR UPDATE` 一个范围的时候，会把 B 树上的节点都锁起来
- 评价：⚠️ 方向对但描述不精确
- 纠正：间隙锁锁的不是"B树节点"，而是**索引记录之间的间隙**（gap），目的是防止幻读

### Next-Key Lock
**得分：0/2**
- 你的回答：说不清楚
- 补充学习：Next-Key Lock = Record Lock + Gap Lock，在 RR 隔离级别下默认使用

### 死锁排查
**得分：1/1**
- 你的回答：生产环境会有告警提示（alert），程序一般会监控
- 评价：✅ 方向正确

---

## 核心知识点

### 1. 锁类型定义

| 锁类型 | 含义 | 作用 |
|--------|------|------|
| Record Lock | 记录锁，锁住一行 | 防止其他事务修改/删除该行 |
| Gap Lock | 间隙锁，锁住索引记录之间的间隙 | 防止幻读（其他事务在间隙中插入） |
| Next-Key Lock | 临键锁 = Record Lock + Gap Lock | InnoDB 在 RR 下默认使用，防幻读 |

### 2. Next-Key Lock 退化条件

| 查询类型 | 索引类型 | 锁类型 | 能否插入间隙数据 |
|----------|----------|--------|------------------|
| 等值查询命中 | 唯一索引（主键） | Record Lock | ✅ 可以 |
| 等值查询未命中 | 唯一索引 | Gap Lock | ❌ 不行 |
| 等值查询命中 | 非唯一索引 | Next-Key Lock | ❌ 不行 |
| 等值查询未命中 | 非唯一索引 | Gap Lock | ❌ 不行 |
| 范围查询 | 任意索引 | Next-Key Lock | ❌ 不行 |

### 3. 不同数据库的锁机制对比

| 数据库 | 行锁 | 间隙锁 | 幻读解决方案 |
|--------|------|--------|--------------|
| MySQL InnoDB | ✅ 有 | ✅ 有 | 间隙锁 + MVCC |
| Oracle | ✅ 有 | ❌ 没有 | MVCC（快照读） |
| PostgreSQL | ✅ 有 | ❌ 没有 | MVCC（SSI） |
| OceanBase（MySQL模式） | ✅ 有 | ✅ 有 | 类似 InnoDB |

### 4. lock_mode 锁模式

| lock_mode | 含义 |
|-----------|------|
| `S` | Shared Lock（共享锁/读锁） |
| `X` | Exclusive Lock（排他锁/写锁） |
| `IS` | Intention Shared Lock（意向共享锁） |
| `IX` | Intention Exclusive Lock（意向排他锁） |
| `record` | Record Lock（记录锁） |
| `gap` / `gap before rec` | Gap Lock（间隙锁） |
| `next-key` | Next-Key Lock（临键锁） |
| `insert intention` | Insert Intention Lock（插入意向锁） |

---

## 追问+纠正记录

### 追问1：间隙锁锁的是什么？
- **你的回答**：锁 B 树上的节点
- **纠正**：间隙锁锁的不是"B树节点"，而是**索引记录之间的间隙**
- **实际验证**：如果 id 是主键（唯一索引），等值查询命中时 Next-Key Lock 会退化为 Record Lock，此时**可以**插入间隙数据

### 追问2：这个锁机制是 MySQL 特有的吗？
- **你的回答**：不确定
- **补充**：Gap Lock 和 Next-Key Lock 是 InnoDB 特有的，Oracle 和 PostgreSQL 没有
- **Oracle**：用 MVCC 解决幻读，SELECT 是快照读，不加锁
- **OceanBase**（MySQL模式）：兼容 InnoDB 的锁机制

### 追问3：死锁排查怎么答？
- **你的回答**：生产环境有告警（alert），程序会监控
- **补充完整步骤**：
  1. 确认死锁：`SHOW ENGINE INNODB STATUS`
  2. 分析锁竞争：看 `HOLDS`（持有）和 `WAITING`（等待）
  3. 定位 SQL：根据事务 ID 找对应 SQL
  4. 分析根因：锁顺序？Gap Lock？长事务？
  5. 预防：统一访问顺序、缩短事务、加索引

---

## 最终结论

| 维度 | 得分 | 说明 |
|------|------|------|
| 行锁（Record Lock） | 3/3 | 基本正确 |
| 间隙锁（Gap Lock） | 2/4 | 方向对但描述不精确 |
| Next-Key Lock | 1/2 | 补充后理解了 |
| 死锁排查 | 1/1 | 方向正确 |
| **总分** | **7/10** | |

---

## 这次讨论的收获

1. **Next-Key Lock 是 InnoDB 特有的**，Oracle/PostgreSQL 用 MVCC 解决幻读，不需要间隙锁
2. **唯一索引等值查询命中时会退化为 Record Lock**，此时可以插入间隙数据
3. **lock_mode 字段**是死锁日志的关键，要看懂 `gap`、`next-key`、`insert intention` 的含义
4. **死锁排查的通用思路**：确认死锁 → 分析锁竞争 → 定位 SQL → 分析根因 → 预防

---

*完成时间：2026-06-10*
