---
schema_version: 1
question_id: 23
question: "MySQL EXPLAIN 执行计划 + Oracle 执行计划"
date: 2026-06-08
sources:
  - unknown
score: "5/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
# 第23题：MySQL EXPLAIN 执行计划 + Oracle 执行计划

**来源**：《高德Agent面经》Q2d + 《唯品会Java面经》Q5追问 + 《菜鸟二面》+ 用户追问
**练习日期**：2026-06-07
**得分**：5/10（MySQL基础部分），追问深入后理解到位

---

## 一、MySQL EXPLAIN 怎么看

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123;
```

### 四个核心字段

| 字段 | 看什么 | 怎么判断 |
|------|--------|----------|
| **type** | 访问类型 | `ALL`(全表❌) < `index` < `range` < `ref` < `eq_ref` < `const`(最优✅) |
| **key** | 实际使用的索引 | `NULL` = 没走索引❌；有值 = 走了索引✅ |
| **rows** | 预估扫描行数 | 越小越好；和表总行数对比 |
| **Extra** | 额外信息 | `Using index`(覆盖索引✅) / `Using filesort`(❌) / `Using temporary`(❌) |

### type 详解（从差到好）

```
ALL      → 全表扫描（最差）
index    → 全索引扫描
range    → 索引范围扫描（WHERE id > 100, BETWEEN, IN）
ref      → 非唯一索引等值查找
eq_ref   → 唯一索引/主键等值查找（JOIN时用）
const    → 常量查找（WHERE id = 1，最多一行）
system   → 表只有一行
```

### const vs eq_ref 区别

| 维度 | const | eq_ref |
|------|-------|--------|
| 场景 | 单表查询 | JOIN 关联查询 |
| 索引 | 主键/唯一索引 | 主键/唯一索引 |
| 返回 | 最多1行 | 每次最多1行，可能查多次 |
| 例子 | `WHERE id = 1` | `JOIN ON a.id = b.id` |

### Extra 常见值

| Extra | 含义 | 好坏 |
|-------|------|------|
| `Using index` | 覆盖索引，不需要回表 | ✅ |
| `Using where` | Server层再过滤 | 一般 |
| `Using temporary` | 使用临时表（GROUP BY/DISTINCT） | ❌ |
| `Using filesort` | 文件排序（ORDER BY没走索引） | ❌ |
| `Using index condition` | 索引下推 ICP | ✅ |

---

## 二、Using filesort 和 Using temporary 优化

### filesort（文件排序）

**原因**：ORDER BY 的列不在索引中，MySQL 无法利用索引顺序，被迫自己排序。

```sql
-- 索引：(user_id, create_time)

-- ❌ 慢：按 amount 排，索引用不上
SELECT * FROM orders WHERE user_id = 123 ORDER BY amount;
-- Extra: Using filesort

-- ✅ 快：按 create_time 排，命中索引
SELECT * FROM orders WHERE user_id = 123 ORDER BY create_time;
-- Extra: NULL（索引已排好序，不需要额外排序）
```

**优化**：让 ORDER BY 的列和索引列一致，或加新索引。

### temporary（临时表）

**原因**：GROUP BY 的列不在索引中，MySQL 建临时表做分组。

```sql
-- 索引：(user_id, status)

-- ❌ 慢：GROUP BY user_id，索引帮不上
SELECT user_id, COUNT(*) FROM orders GROUP BY user_id;
-- Extra: Using temporary

-- ✅ 快：GROUP BY user_id + status，命中索引
SELECT user_id, status, COUNT(*) FROM orders GROUP BY user_id, status;
-- Extra: NULL
```

**优化**：GROUP BY 的列尽量在索引中。

---

## 三、Oracle 执行计划

Oracle 不用 `EXPLAIN`，而是用 `EXPLAIN PLAN FOR` + 查询结果：

```sql
-- 1. 生成执行计划（只是写入 PLAN_TABLE，不会显示任何东西！）
EXPLAIN PLAN FOR
SELECT * FROM orders WHERE user_id = 123;

-- 2. 查看执行计划（必须再查一次才能看到结果）
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```

> ⚠️ `EXPLAIN PLAN FOR` 执行完不会显示任何东西！它只是把结果写入 `PLAN_TABLE` 这张临时表，必须再查一次才能看到。PL/SQL Developer 的 F5 内部自动做了这两步。

> ⚠️ 如果提示 `PLAN_TABLE` 不存在，需要 DBA 执行 `$ORACLE_HOME/rdbms/admin/utlxplan.sql` 建表。

### Oracle 执行计划关键字段

| Oracle 字段 | 对应 MySQL | 含义 |
|-------------|-----------|------|
| **operation** | type | `TABLE ACCESS FULL`(全表) / `INDEX RANGE SCAN`(范围) / `INDEX UNIQUE SCAN`(唯一) |
| **cost** | rows（间接） | 优化器估算成本，越小越好 |
| **cardinality** | rows | 预估返回行数 |
| **access predicates** | key的WHERE条件 | 走索引的条件 |
| **filter predicates** | Extra(Using where) | 额外过滤 |

### Oracle 访问路径（从差到好）

```
TABLE ACCESS FULL           → 全表扫描（最差）
TABLE ACCESS BY INDEX ROWID → 回表（先索引再回表取行）
INDEX RANGE SCAN            → 索引范围扫描
INDEX UNIQUE SCAN           → 唯一索引等值查找
```

### Oracle 独有的概念

| 概念 | 说明 |
|------|------|
| **Rowid** | 物理行地址，通过索引拿到 Rowid 再回表 |
| **CBO（Cost-based Optimizer，基于成本的优化器）** | 根据统计信息算 cost，选最小 cost 的计划 |
| **Hints（提示）** | `/*+ INDEX(t idx_name) */` 强制走索引 |

---

## 四、预估执行计划 vs 实际执行计划

| | 预估计划（Estimated） | 实际计划（Actual） |
|--|---------------------|-------------------|
| 命令 | `EXPLAIN PLAN FOR` + `DBMS_XPLAN.DISPLAY` | 先执行 SQL 加 `GATHER_PLAN_STATISTICS`，再用 `DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST')` |
| SQL是否执行 | ❌ 没有真正执行 | ✅ 已经真正执行过 |
| Rows/Cost | 优化器**估算值** | **真实运行值**（A-Rows, A-Time） |
| PL/SQL Developer | F5 看到的就是这个 | 菜单里"Explain Plan (with actual stats)" |
| 什么时候用 | 日常快速查看 | 统计信息不准、需要对比估算vs真实时 |

### GATHER_PLAN_STATISTICS 说明

```sql
SELECT /*+ GATHER_PLAN_STATISTICS */ * FROM orders WHERE user_id = 123;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST'));
```

- `/*+ GATHER_PLAN_STATISTICS */`：Oracle Hint（提示），告诉优化器执行时额外收集真实运行统计
- `DBMS_XPLAN.DISPLAY_CURSOR(sql_id, child_number, format)`：Oracle 内置存储过程，格式化显示执行计划
  - `NULL, NULL`：看刚执行的最后一条 SQL
  - `'ALLSTATS LAST'`：显示所有统计 + 取最后一次执行的数据

### 日常工作不用手动跑 DISPLAY_CURSOR

Oracle 内置监控机制自动记录真实执行计划：

| 机制 | 说明 |
|------|------|
| **AWR（Automatic Workload Repository，自动工作负载仓库）** | 每小时快照，记录每条SQL的真实执行统计，保留默认8天 |
| **ASH（Active Session History，活动会话历史）** | 每秒采样，看当前活跃SQL卡在哪一步 |
| **SQL Plan Baseline（SQL 计划基线）** | 自动捕获执行计划，防止"计划退化" |

日常运维靠这些自动机制 + PL/SQL Developer 的 F5，手动 DISPLAY_CURSOR 只在临时排查时用。

---

## 五、OceanBase 执行计划

OceanBase 兼容 MySQL 和 Oracle 两种模式：

- **MySQL 模式**：`EXPLAIN ...`，字段和 MySQL 一致
- **Oracle 模式**：`EXPLAIN PLAN FOR` + `DBMS_XPLAN.DISPLAY`，同 Oracle
- **OceanBase 特有**：支持 `EXPLAIN ANALYZE`（实际执行+显示真实统计）、分布式执行计划（`DISTRIBUTED TASK`）

---

## 六、面试实战回答模板

> "我们后端做 SQL 优化，主要看 EXPLAIN 执行计划：
> 1. 看 type 是不是 ALL（全表扫描），是的话加索引
> 2. 看 key 是不是 NULL，是的话索引没生效
> 3. 看 rows 扫描行数多不多
> 4. 看 Extra 有没有 filesort、temporary，有的话优化 ORDER BY / GROUP BY
> 
> EXPLAIN 显示的是预估计划，实际执行可能有偏差。Oracle 的话用 `EXPLAIN PLAN FOR` + `DBMS_XPLAN.DISPLAY`，核心思路一样，只是术语不同——Oracle 叫 `TABLE ACCESS FULL`，MySQL 叫 `type=ALL`。
> 
> 深层的执行计划分析、统计信息管理这些是 DBA 的事，我们发现问题会提给 DBA。"

---

## 七、这次讨论的收获

- MySQL `type=ALL` 是全表扫描，"table access full" 是 Oracle 说法
- Oracle 的 `EXPLAIN PLAN FOR` 只是写入 PLAN_TABLE，不会显示任何东西，必须再查
- PL/SQL Developer 的 F5 内部自动做了这两步，所以直接能看
- `GATHER_PLAN_STATISTICS` Hint 让优化器收集真实运行数据
- `DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST')` 格式化显示真实执行计划
- AWR/ASH 自动记录真实执行计划，日常不需要手动跑
- `Using filesort` = ORDER BY 没走索引，`Using temporary` = GROUP BY 用了临时表
- Java 后端优化三板斧：索引类型、数据量、耗时，不需要深入 DBA 级别的执行计划分析
