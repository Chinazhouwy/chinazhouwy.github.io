# 快手后端Java一面面经 — MySQL数据库+索引优化

**时间**: 2026-05-25  
**来源**: 小红书面经  
**时长**: 50分钟  
**面试流程**: 自我介绍 → 数据库基础 → 索引原理 → 事务与锁 → SQL优化 → 项目场景提问 → 算法 → 反问

---

## 1️⃣ MySQL 基础与索引

### 1.1 InnoDB vs MyISAM 核心区别

| 对比维度 | InnoDB | MyISAM |
|---------|--------|--------|
| **事务** | ✅ 支持（ACID） | ❌ 不支持 |
| **锁粒度** | 行锁（MVCC实现） | 表锁 |
| **外键** | ✅ 支持 | ❌ 不支持 |
| **聚簇索引** | ✅ 数据与索引一起 | ❌ 索引与数据分离 |
| **全文索引** | 5.6+ 支持 | ✅ 天生支持 |
| **COUNT(\*)** | 需要扫描 | 直接读取缓存行数 |
| **崩溃恢复** | ✅ redo log + undo log | ❌ 易丢数据 |
| **适用场景** | 写多、事务性场景 | 读多、日志、数据仓库 |

**血泪教训**: 曾经在生产环境用 MyISAM 存订单表，并发插入时全表锁死，QPS 直接归零。InnoDB 行锁 + MVCC 才是 OLTP 的标配。

### 1.2 B树 vs B+树，MySQL为什么选B+树？

```
B树（每个节点存数据+指针）:
        [k1, k2]
       /    |    \
   [d1]  [d2]  [d3]
   
B+树（非叶子节点只存key，叶子节点存数据+链表）:
        [k1, k2]
       /    |    \
   [d1]-[d2]-[d3]  ← 叶子节点双向链表
```

**B+树优势**:
1. **IO更少** — 非叶子节点不存数据，一个节点可存更多key，树高更低（通常3-4层）
2. **范围查询高效** — 叶子节点链表结构，找到起点后顺序遍历即可，B树需要多次回溯
3. **查询更稳定** — 所有数据都在叶子节点，每次查询IO次数一致

> **工程细节**: MySQL 默认一个页16KB。假设索引字段是 bigint (8B) + 指针 (6B)，一个非叶子节点可存约 16KB/14B ≈ 1170个key。三层B+树可存 1170×1170×16 ≈ 2000万行数据。这就是为什么千万级表3次IO就够了。

### 1.3 聚簇索引 vs 非聚簇索引

```sql
-- 建表示例
CREATE TABLE `user` (
  `id` bigint PRIMARY KEY AUTO_INCREMENT,  -- 聚簇索引 (InnoDB自动创建)
  `name` varchar(50),
  `phone` varchar(20),
  KEY `idx_name` (`name`)                   -- 非聚簇索引（二级索引）
) ENGINE=InnoDB;
```

**聚簇索引（Clustered Index）**:
- InnoDB 表必然有且只有一个聚簇索引
- 主键列就是聚簇索引，数据行存储在叶子节点
- 没有主键时，MySQL 选第一个 UNIQUE 列，都没有则隐藏6字节 ROW_ID

**非聚簇索引（Secondary Index）**:
- 叶子节点存储的是 **主键值**，不是行数据的物理地址
- 查询流程：二级索引找到主键 → 回表查聚簇索引 → 获取完整行

**回表查询示例**:
```sql
-- idx_name 是二级索引
SELECT * FROM user WHERE name = '张三';
-- 执行: idx_name 查到 id=123 → 聚簇索引查到完整行（1次回表）
```

**覆盖索引优化（避免回表）**:
```sql
-- idx_name_phone 包含 name 和 phone
SELECT name, phone FROM user WHERE name = '张三';
-- 二级索引已经包含查询需要的所有字段，无需回表！
```

### 1.4 联合索引最左匹配原则

```sql
KEY `idx_a_b_c` (`a`, `b`, `c`)
```

| SQL | 是否走索引 | 说明 |
|-----|-----------|------|
| `WHERE a=1` | ✅ | 匹配第一列 |
| `WHERE a=1 AND b=2` | ✅ | 匹配前两列 |
| `WHERE a=1 AND b=2 AND c=3` | ✅ | 全匹配 |
| `WHERE a=1 ORDER BY b` | ✅ | a用于过滤，b用于排序 |
| `WHERE b=2` | ❌ | 跳过最左列 |
| `WHERE a=1 AND c=3` | ⚠️ | a走索引，c不能（跳过b） |
| `WHERE a>1 AND b=2` | ⚠️ | a走索引，b不能（范围查询后面列失效） |

**实战经验**: `ORDER BY` 和 `GROUP BY` 同样遵循最左匹配。如果 `ORDER BY b` 但 `WHERE a=常量`，b 仍可使用索引排序，因为 a 已经过滤到常数，b 相当于最左列。

### 1.5 索引失效常见场景（面试高频）

```sql
1. 隐式类型转换
   WHERE phone = 13800138000        -- phone是varchar，不走索引
   WHERE phone = '13800138000'      -- ✅ 正确写法

2. 函数操作
   WHERE LEFT(name, 1) = '张'       -- 不走索引
   WHERE name LIKE '张%'            -- ✅ 前缀匹配走索引
   WHERE name LIKE '%张'            -- ❌ 后缀模糊不走

3. 索引列参与计算
   WHERE salary * 1.1 > 10000       -- 不走索引
   WHERE salary > 10000 / 1.1       -- ✅ 写在右侧

4. OR 条件中有非索引列
   WHERE a=1 OR d=2    -- d没有索引，整个查询不走索引

5. 不等于/IS NOT NULL/NOT IN/!= 
   WHERE status != 1     -- 不走索引（除非是区分度极低的列用索引合并）
```

---

## 2️⃣ 事务与并发锁

### 2.1 四大隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 实现方式 |
|---------|:---:|:---------:|:---:|---------|
| READ UNCOMMITTED | ❌可能 | ❌可能 | ❌可能 | 不加锁 |
| READ COMMITTED | ✅解决 | ❌可能 | ❌可能 | MVCC + 语句级快照 |
| REPEATABLE READ (默认) | ✅解决 | ✅解决 | ❌可能 | MVCC + 事务级快照 |
| SERIALIZABLE | ✅解决 | ✅解决 | ✅解决 | 全表加锁 |

### 2.2 InnoDB 如何解决幻读？（重点）

**RC+MVCC 解决不可重复读**:
- 每条 SQL 执行时创建 ReadView
- 同一事务中多次读取，能看到其他事务已提交的变更（不可重复读）

**RR+MVCC 解决不可重复读**:
- 事务开始时创建 ReadView
- 整个事务期间使用同一个快照

**RR+间隙锁 解决幻读（只是部分解决）**:
```sql
-- 当前读（for update）下，行锁+间隙锁 = Next-Key Lock
SELECT * FROM user WHERE age BETWEEN 20 AND 30 FOR UPDATE;
-- 锁住 age=20~30 之间的所有间隙，阻止其他事务插入新记录

-- 快照读下幻读不会出现（MVCC保证）
-- 但当前读下如果没间隙锁，幻读仍然可能
-- 实际RR级别在大多数场景下可解决幻读，但不是100%
```

### 2.3 MVCC 底层原理

**核心组件**:
- **Undo Log 版本链** — 每行数据有多个版本，通过回滚指针串联
- **ReadView** — 事务快照，记录活跃事务列表

**ReadView 关键字段**:
```java
class ReadView {
    long creator_trx_id;    // 创建这个ReadView的事务ID
    long[] m_ids;           // 创建时活跃的事务ID列表
    long min_trx_id;        // m_ids 中的最小值
    long max_trx_id;        // 下一个待分配的事务ID
}
```

**可见性判断**:
```
trx_id < min_trx_id   → 已提交，可见 ✓
trx_id == creator_trx_id → 自己修改的，可见 ✓
trx_id >= max_trx_id  → 未来事务，不可见 ✗
trx_id 在 m_ids 中    → 未提交，不可见 ✗（RC下重新生成ReadView可见）
```

**RR vs RC 差异关键**: RR 只在事务第一次读时创建 ReadView；RC 每条 SQL 都重新创建。

### 2.4 行锁、表锁、间隙锁、临键锁

```sql
-- 行锁（Record Lock）
SELECT * FROM user WHERE id = 1 FOR UPDATE;  -- 只锁 id=1 这一行

-- 间隙锁（Gap Lock）
SELECT * FROM user WHERE id BETWEEN 5 AND 10 FOR UPDATE;
-- 锁住 id>5 且 id<10 的区间，阻止插入 id=6,7,8,9

-- 临键锁（Next-Key Lock）= 行锁 + 间隙锁
SELECT * FROM user WHERE id > 3 AND id < 7 FOR UPDATE;
-- 锁住 id>3 AND id<=7 的范围

-- 表锁
LOCK TABLES user WRITE;  -- 整表锁定，读写全阻塞
```

**实战场景 — 死锁案例**:
```sql
-- 事务A                           -- 事务B
UPDATE user SET name='a' WHERE id=1;
                                   UPDATE user SET name='b' WHERE id=2;
UPDATE user SET name='a' WHERE id=2; -- 等待B释放id=2
                                   UPDATE user SET name='b' WHERE id=1; -- 等待A释放id=1
                                   -- DEADLOCK! InnoDB检测到后回滚事务B
```

**避免方案**: 固定顺序访问资源（总是按id从小到大更新）。

---

## 3️⃣ SQL 优化与实战

### 3.1 慢查询定位

```sql
-- 开启慢查询日志
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1;       -- 超过1秒
SET GLOBAL log_queries_not_using_indexes = ON;

-- 分析工具
mysqldumpslow -s t -t 10 slow.log     -- 按时间排序取top10
pt-query-digest slow.log               -- Percona Toolkit 分析
```

### 3.2 EXPLAIN 解读（必考）

```sql
EXPLAIN SELECT * FROM user WHERE name = '张三';
```

| 字段 | 含义 | 重点关注 |
|------|------|---------|
| **type** | 访问类型 | `const > eq_ref > ref > range > index > ALL`，出现 ALL 就是全表扫 |
| **key** | 实际使用的索引 | NULL 表示没走索引 |
| **rows** | 预估扫描行数 | 越小越好 |
| **Extra** | 额外信息 | `Using filesort`（文件排序，没走索引排序）、`Using temporary`（临时表，没走索引分组）、`Using index`（覆盖索引） |

**实战问题**: `Using filesort` 通常意味着 `ORDER BY` 没走索引，解决办法是建联合索引让排序字段成为索引一部分。

### 3.3 查询优化器选错索引怎么办？

```sql
-- 场景：表有 idx_a 和 idx_b，优化器选了 idx_a 但 idx_b 更快

-- 方案1：FORCE INDEX 强制指定
SELECT * FROM user FORCE INDEX(idx_b) WHERE a=1 AND b=2;

-- 方案2：USE INDEX 建议
SELECT * FROM user USE INDEX(idx_b) WHERE a=1 AND b=2;

-- 方案3：分析表更新统计信息
ANALYZE TABLE user;

-- 方案4：索引列数据倾斜导致优化器误判
-- 比如 status 大部分是0，少量是1，查询 status=1 时全表扫比走索引更快
-- 但 MySQL 统计信息可能误判，可以加 hint 强制
```

### 3.4 大表分页查询优化

**经典问题**: `LIMIT 100000, 20` 会扫描100020行然后丢弃前10万行

**优化方案**:

```sql
-- 方案1：子查询 + 覆盖索引（推荐）
SELECT * FROM user 
WHERE id > (SELECT id FROM user ORDER BY id LIMIT 99999, 1) 
LIMIT 20;

-- 方案2：JOIN 延迟关联
SELECT * FROM user t1
INNER JOIN (SELECT id FROM user ORDER BY id LIMIT 99999, 20) t2
ON t1.id = t2.id;

-- 方案3：记录上次最后ID（业务场景常用）
SELECT * FROM user WHERE id > 100000 ORDER BY id LIMIT 20;

-- 方案4：范围分页（适用于时间序列）
SELECT * FROM orders WHERE create_time >= '2025-01-01' AND create_time < '2025-02-01'
```

### 3.5 分库分表适用场景

**何时需要分库分表**:
- 单表数据量 > 千万级（实际取决于业务，有些表2亿还在单表）
- 单库写入TPS > 5000
- 单表存储空间 > 100GB

**分片策略**:
```
水平分表:
  user_0, user_1, ..., user_15  (按 user_id hash 分16表)
  
范围分片:
  order_202501, order_202502, ... (按月分表)

分库分表中间件:
  - ShardingSphere-JDBC（客户端级）
  - MyCat / DBLE（代理层）
```

**实战注意**: 
- **分布式ID**：雪花算法（Snowflake）或发号器
- **跨分片查询**：尽量避免，或使用ES做搜索层
- **事务**：分库后本地事务失效，需分布式事务（SEATA/TSF）
- **不建议过度设计**：90%的业务单库单表够用，别为了分而分

---

## 4️⃣ 算法题 — 二叉树层序遍历（BFS）

```java
public List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> result = new ArrayList<>();
    if (root == null) return result;
    
    Queue<TreeNode> queue = new LinkedList<>();
    queue.offer(root);
    
    while (!queue.isEmpty()) {
        int levelSize = queue.size();
        List<Integer> level = new ArrayList<>();
        
        for (int i = 0; i < levelSize; i++) {
            TreeNode node = queue.poll();
            level.add(node.val);
            if (node.left != null) queue.offer(node.left);
            if (node.right != null) queue.offer(node.right);
        }
        result.add(level);
    }
    return result;
}

// 进阶变体: 之字形层序遍历（Zigzag）
// 只需加一个 boolean reverse 标记，偶数层 reverse=true 时 Collections.reverse(level)
```

---

## 5️⃣ 项目场景问答思路

### 问答: "项目中做过哪些 SQL 优化？"

**STAR 法则回答模板**:

**Situation**: 订单查询接口，用户按月查询历史订单，数据量500万+
**Task**: 接口响应时间从3s降到200ms以内
**Action**:
1. 通过慢查询日志定位到 `WHERE DATE(create_time) = '2025-01-01'` 不走索引
2. 改为 `WHERE create_time >= '2025-01-01' AND create_time < '2025-01-02'`
3. 对 `user_id + create_time` 建联合索引，覆盖查询 + 排序
4. 分页从 `LIMIT OFFSET` 改为 `WHERE id > ? LIMIT ?`
**Result**: 接口耗时从3.2s降至180ms，QPS从50提升到2000+

### 反问环节建议

> **别问太基础的**，展现你的深度思考：
> 1. "咱们业务侧的数据量级大概多少？有没有遇到过热点行数据的锁竞争问题？"
> 2. "数据库用的是自建还是云RDS？读写分离是怎么做的？"
> 3. "慢查询的监控体系是怎么搭建的？"

---

## 📌 面试总结

- **MySQL是快手一面重点**，占据了70%的面试时间
- **索引原理+SQL优化**是重灾区，需要能手撕执行计划分析
- **事务隔离+MVCC**是灵魂拷问，需要讲清楚 ReadView 版本链
- **项目场景**考察是否有真实优化经验，光背书不够
- **算法简单**（BFS二叉树），基本属于送分题