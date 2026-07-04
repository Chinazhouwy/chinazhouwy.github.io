---
schema_version: 1
question_id: 12
question: "MySQL · 慢SQL排查"
date: 2026-06-01
sources:
  - unknown
score: "4/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
## 第 12 题 · MySQL · 慢SQL排查

**题目**：线上突然报警，一个查询从50ms飙到5秒，你怎么排查？从发现问题到解决，完整说一下流程。

追问：EXPLAIN 的 type 列各值含义？Extra 列哪些要警惕？

### 用户回答（摘要）

> 要sqlid，根据sqlid，提取sql看执行计划，飙升一般是数据倾斜或者某些表异常增大，看是否有table access full，看cost耗时，是否走了索引。

### 评分：4/10

### 扣分点

1. **排查流程不够完整**（-3）：只说了看执行计划，没说怎么找到SQL ID、怎么分析原因
2. **慢的原因说少了**（-2）：只提了数据倾斜和表增大，还有很多原因
3. **解决手段没提**（-1）

### 排查流程（四步走）

**第一步：定位慢SQL**

```sql
-- performance_schema（推荐）
SELECT SQL_ID, DIGEST_TEXT, COUNT_STAR, AVG_TIMER_WAIT/1000000000 AS avg_ms
FROM performance_schema.events_statements_summary_by_digest
ORDER BY AVG_TIMER_WAIT DESC LIMIT 10;

-- 或SHOW PROCESSLIST看当前慢查询
SHOW PROCESSLIST;
```

**第二步：拿到SQL，看执行计划**

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123 AND status = 1;
-- 看 type / key / rows / Extra
```

**第三步：分析原因（六种常见原因）**

| 原因 | 表现 | 例子 |
|------|------|------|
| 索引失效 | type=ALL, key=NULL | 对索引列用了函数/隐式转换 |
| 数据量暴增 | rows很大 | 某张表从100万涨到1000万 |
| 数据倾斜 | rows小但实际慢 | 某个值占了90%的数据 |
| 执行计划变了 | 以前走索引现在不走 | 统计信息过期 |
| 锁等待 | 查询本身没问题 | 其他事务锁住了表 |
| 连接池耗尽 | 应用层报超时 | 连接不够用 |

**第四步：针对性解决**

索引失效 → 加索引/改写SQL | 数据暴增 → 加索引/分库分表 | 数据倾斜 → 拆分查询/force index | 执行计划变 → ANALYZE TABLE | 锁等待 → 优化事务 | 连接池 → 调大连接数

### EXPLAIN type 列（从好到差）

| type | 含义 |
|------|------|
| system | 表只有一行 |
| const | 主键/唯一索引等值查询 |
| eq_ref | 关联查询用主键/唯一索引 |
| ref | 非唯一索引等值查询 |
| range | 索引范围查询 |
| index | 全索引扫描 |
| ALL | 全表扫描 ❌ |

### EXPLAIN Extra 列（要警惕的）

| Extra | 含义 |
|-------|------|
| Using index | 覆盖索引 ✅ |
| Using index condition | ICP ✅ |
| Using where | Server层过滤 ⚠️ |
| Using filesort | 额外排序 ❌ |
| Using temporary | 用了临时表 ❌ |

### 索引失效的常见场景

```sql
-- 1. 对索引列用函数
WHERE YEAR(create_time) = 2026    → ❌
WHERE create_time >= '2026-01-01' → ✅

-- 2. 隐式类型转换
WHERE varchar_col = 123    → ❌
WHERE varchar_col = '123'  → ✅

-- 3. LIKE左边通配
WHERE name LIKE '%张'   → ❌
WHERE name LIKE '张%'   → ✅

-- 4. OR条件（部分场景）
WHERE a=1 OR b=2  → ❌ 如果a和b不是同一个索引

-- 5. NOT IN / != / IS NOT NULL（通常不走索引）
```

### 一句话总结

> **慢SQL排查四步走：定位SQL → 看执行计划 → 分析原因 → 针对性解决。核心看type是不是ALL、Extra有没有filesort/temporary、rows扫描量大不大。**
