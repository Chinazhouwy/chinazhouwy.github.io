---
title: "SQLite 深度实战：从类型、索引与 WAL 到工程边界"
date: "2026-07-12"
domain: "学习"
area: "数据与中间件"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "以 SQLite 的存储模型、模式设计、查询计划、事务并发、JSON/FTS5 和备份为主线，补齐原文版本与 SQL 示例的边界，形成可直接复习的嵌入式数据库实践地图。"
tags:
  - SQLite
  - SQL
  - 数据库
  - 索引
  - 查询优化
  - 事务
  - WAL
  - FTS5
  - JSON
  - 性能调优
  - Python
source: "微信公众号「网优小兵玩Python」"
source_url: "https://mp.weixin.qq.com/s/uhMm0vZpDwf76Nh4Z5A0iA"
published_at: "2026-07-12 08:42:14 +08:00"
---

# SQLite 深度实战：从类型、索引与 WAL 到工程边界

> 原文标题：SQLite深度实战
>
> 来源：微信公众号「网优小兵玩Python」
>
> 发布时间：2026-07-12 08:42:14（北京时间）
>
> 整理日期：2026-09-07
>
> 原文定位：从基础语法到性能调优的开发者知识地图，覆盖 15 个主题、80+ 个代码示例和 50+ 条性能建议。[1]
>
> 整理原则：保留原文的知识结构；涉及版本、并发、备份和性能数字的地方，以 SQLite 官方文档为准；无法由公开资料或本地实验确认的结论标为“原文声称”或 `[unverified]`。

## 一、先建立正确定位

SQLite 是进程内、无服务器、零配置、事务型的 SQL 数据库引擎，数据库通常以一个文件存在；官方代码采用公共领域许可。[2]

因此，SQLite 不是“缩小版的 MySQL”，也不是默认用来承载多节点数据库集群的组件。SQLite 官方明确提醒，它与 MySQL、PostgreSQL 等客户端/服务器数据库解决的是不同问题。[3]

更合适的心智模型是：**SQLite 把数据库能力嵌入应用进程，应用负责连接、权限、并发入口和备份策略。** 这也是它在移动端、桌面端、嵌入式设备、测试环境和低到中等流量单机服务中有吸引力的原因。[2][3]

### 1. 适用场景

| 场景 | 适合原因 | 需要留意 |
|---|---|---|
| 移动 App、桌面应用、嵌入式设备 | 无独立服务、文件随应用分发 | 文件权限、迁移和备份由应用负责 |
| CLI、爬虫、数据分析原型 | 开箱即用，SQL 能力完整 | 数据增长后要重新评估并发与备份 |
| CI/CD 临时数据库 | 零配置，测试隔离简单 | 不要把临时库误当作共享服务 |
| 单机低到中等流量 Web 应用 | 部署和运维成本低 | 写密集或多服务器时重新选型 |

SQLite 官方给出的边界不是一个固定 QPS 数字，而是访问模式、写入强度、客户端数量、网络文件系统和是否需要多服务器的组合判断。[3]

### 2. 不宜直接使用 SQLite 的情况

- 多个客户端通过网络文件系统直接访问同一个数据库文件；
- 写入非常密集，需要多个写入者长期竞争；
- 需要跨节点复制、读写分离、复杂角色权限或行级安全；
- 数据库服务本身需要作为独立网络服务运行；
- 需要把固定的高 QPS 指标作为容量承诺。

“超过 100 写入/秒就不行”“超过 1000 QPS 必须换库”等阈值只能算某个工作负载下的经验说法，不能从 SQLite 的产品定义推出。[unverified]

## 二、文章知识地图

原文按“基础 → 数据模型 → SQL → 查询优化 → 并发 → 高级能力 → 性能 → 备份 → 编程语言集成 → 选型边界”组织内容。[1]

| 模块 | 需要掌握的核心问题 |
|---|---|
| 架构与工具链 | 一个数据库文件如何被应用和 CLI 使用 |
| 存储类与类型亲和性 | 为什么列声明类型不是严格类型 |
| 表与约束 | 主键、唯一、检查、外键如何保护数据 |
| SQL | JOIN、聚合、子查询、UPSERT 如何写 |
| 索引 | B-Tree、复合索引、覆盖索引和查询计划 |
| 事务与锁 | DEFERRED、IMMEDIATE、EXCLUSIVE 的区别 |
| WAL | 如何改善读写并发，以及它没有解决什么 |
| 高级特性 | CTE、窗口函数、JSON、FTS5、生成列 |
| 性能 | 批量事务、参数化、ANALYZE、VACUUM |
| 可靠性 | 在线备份、恢复、扩展和加密边界 |
| 集成 | Python、Node.js、Go、Rust 等驱动的共同原则 |
| 选型 | 什么时候 SQLite 足够，什么时候应换服务型数据库 |

## 三、数据类型：存储类和亲和性分开理解

### 1. 五种存储类

SQLite 的值具有存储类，而不是由列声明强制决定的静态类型。官方文档把存储类归纳为 `NULL`、`INTEGER`、`REAL`、`TEXT` 和 `BLOB`；普通列可以存储不同存储类的值。[4]

```text
NULL     空值
INTEGER  整数
REAL     IEEE 754 浮点数
TEXT     UTF-8/UTF-16 文本
BLOB     原始二进制
```

这解释了 SQLite 的灵活性，也解释了它为什么容易把数据质量问题推迟到应用层：列声明更像是**类型亲和性建议**，不是所有写入值都必须满足的硬约束。[4]

工程上可以采用三层防线：

1. 在表结构中写清楚 `NOT NULL`、`CHECK`、`UNIQUE` 和外键；
2. 在应用层用 DTO、Pydantic 或等价校验模型做输入验证；
3. 对需要严格类型检查的表评估 `STRICT` 表，而不是把动态类型误解为“无需约束”。

### 2. 日期、布尔和 JSON 列

SQLite 没有传统意义上独立的日期类型，团队应统一时间格式、时区和字段命名；例如使用 UTC 的 ISO 8601 文本，并在展示层转换本地时区。[1]

布尔值通常使用 `INTEGER` 的 `0/1` 表示，但应通过 `CHECK (is_active IN (0, 1))` 明确约束，而不是依赖调用方自觉。[1]

`data JSON` 这样的声明不会把列变成强制 JSON 类型。SQLite 的 JSON 接口仍然遵守它的五种存储类模型；官方文档明确说明 JSON 默认以普通文本存储。[12]

### 3. 主键的 SQLite 特殊性

单列、声明类型恰为 `INTEGER` 的主键，在普通 rowid 表中具有特殊的 rowid 别名行为。[5]

原文把“PRIMARY KEY 隐含 NOT NULL”写成了普遍规则，这在 SQLite 中不严谨：除 `INTEGER PRIMARY KEY`、`WITHOUT ROWID` 表、`STRICT` 表或显式 `NOT NULL` 外，SQLite 允许普通主键列出现 `NULL`，这是历史兼容行为。[5]

更稳妥的建模方式是：

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1))
);
```

`AUTOINCREMENT` 不应作为默认习惯。只有在确实需要“已使用过的 rowid 永不重用”等语义时才评估它，并接受额外的维护成本。[1]

### 4. 外键必须显式打开

SQLite 支持外键，但官方文档说明外键约束默认是关闭的，并要求应用在每个连接上执行 `PRAGMA foreign_keys = ON`；构建选项也可能影响可用性。[8]

```python
import sqlite3

conn = sqlite3.connect("app.db")
conn.execute("PRAGMA foreign_keys = ON")
```

`PRAGMA foreign_keys` 是连接级设置，不应只在某个初始化脚本里执行一次后就假设所有连接都继承它。[8]

## 四、SQL 核心：参数化、UPSERT 与版本特性

### 1. 参数化查询优先

不要把用户输入拼进 SQL 字符串。参数化查询同时改善注入防护、类型处理和预编译语句复用，是 Python、Node.js、Go、Rust 等驱动的共同底线。[1]

```python
row = conn.execute(
    "SELECT id, display_name FROM users WHERE email = ?",
    (email,),
).fetchone()
```

### 2. UPSERT 的语义

SQLite 的 UPSERT 是附带一个或多个 `ON CONFLICT` 子句的 `INSERT`，发生唯一性冲突时可以执行 `DO NOTHING` 或 `DO UPDATE`。[10]

```sql
INSERT INTO users (id, email, display_name)
VALUES (?, ?, ?)
ON CONFLICT (email) DO UPDATE SET
    display_name = excluded.display_name;
```

需要注意：冲突目标必须对应唯一约束或唯一索引；多个 `ON CONFLICT` 子句按顺序匹配，每行通常只执行第一个命中的子句。[10]

### 3. JOIN 版本边界

原文把 SQLite 的 `FULL OUTER JOIN` 写成“通过 `LEFT JOIN + UNION` 模拟”，这对旧版本是常见兼容写法，但 SQLite 从 3.39.0 起已经原生支持 `RIGHT JOIN` 和 `FULL OUTER JOIN`。[18]

```sql
SELECT a.id AS a_id, b.id AS b_id
FROM a
FULL OUTER JOIN b ON a.id = b.id;
```

如果部署环境包含旧版本，仍需在启动检查或迁移策略中明确版本要求，而不是让 SQL 在生产环境首次执行时才失败。

### 4. CTE 和窗口函数

CTE 适合把复杂查询拆成有名字的中间关系；递归 CTE 适合组织树、目录和依赖关系。[1]

窗口函数的版本边界应写进兼容矩阵：SQLite 3.25.0 的发布说明加入了窗口函数支持。[16]

```sql
SELECT
    user_id,
    created_at,
    amount,
    SUM(amount) OVER (
        PARTITION BY user_id
        ORDER BY created_at
    ) AS running_total,
    LAG(amount) OVER (
        PARTITION BY user_id
        ORDER BY created_at
    ) AS previous_amount
FROM orders;
```

## 五、索引与查询计划

### 1. B-Tree 和查找成本

SQLite 的常规索引使用 B-Tree；查询计划的关键不是“建了索引就一定快”，而是优化器能否利用索引定位候选行、减少回表和排序。官方查询规划文档用二分查找解释了从线性扫描到对数级定位的差异。[9]

### 2. 复合索引的列顺序

复合索引的列顺序要围绕真实查询设计。左侧列决定索引中的主要排序和定位范围，不能机械地把所有过滤列按表结构顺序拼起来。[9]

例如：

```sql
CREATE INDEX idx_orders_user_status_created
ON orders (user_id, status, created_at DESC);
```

它更适合包含 `user_id`、`status` 过滤并按 `created_at` 排序的查询；但“缺少第一列就完全不走索引”过于绝对，优化器还可能使用部分索引能力或其他策略，应以 `EXPLAIN QUERY PLAN` 为准。[1][9]

### 3. 覆盖索引

如果索引已经包含查询所需的过滤列和返回列，SQLite 可以避免回到原表取数据，这就是覆盖索引。[9]

```sql
CREATE INDEX idx_users_email_name
ON users (email, display_name);

EXPLAIN QUERY PLAN
SELECT display_name
FROM users
WHERE email = ?;
```

覆盖索引会增加索引体积和写入维护成本，不能脱离读写比例盲目添加。[1][9]

### 4. 慢查询排查顺序

1. 用真实参数执行 `EXPLAIN QUERY PLAN`；
2. 区分 `SEARCH`、`SCAN`、临时排序和回表；
3. 检查是否存在 N+1 查询或无必要的 `SELECT *`；
4. 再决定是否需要复合、部分、表达式或覆盖索引；
5. 用代表性数据重新测量，而不是只看开发机上的一次耗时。

索引建议必须与数据分布、选择性、写入频率和查询形状一起评估。原文“低基数列一律不建索引”“小表一律不建索引”应当理解为经验提醒，而不是优化器规则。[1]

## 六、事务、锁和 WAL

### 1. 一个重要事实：多读单写

SQLite 允许来自不同连接、线程或进程的多个并发读事务，但同时只能有一个写事务。[6]

这决定了容量评估的第一问不是“SQLite 能不能跑 SQL”，而是：**写事务会不会长时间占住写入通道？** 应尽量缩短事务、批量提交，并避免在事务里执行不可控的网络调用。

### 2. 三种 BEGIN 模式

- `BEGIN DEFERRED`：默认模式，开始时不立即取得读/写锁，首次访问数据库时才决定事务性质；
- `BEGIN IMMEDIATE`：立即启动写事务，适合希望尽早暴露写锁竞争的场景；
- `BEGIN EXCLUSIVE`：更强的排他语义；在 WAL 模式下它与 `IMMEDIATE` 的差异较小，在其他日志模式下会限制其他连接读取。[6]

```sql
BEGIN IMMEDIATE;
-- 一组相互关联的写操作
COMMIT;
```

`BEGIN IMMEDIATE` 不是“自动解决并发”的开关。它可能把锁竞争提前到事务开始处，是否有利取决于业务的冲突模式和事务长度。[6]

### 3. WAL 的收益与边界

WAL 模式允许读者和写者大部分时间并行运行，减少读写互相阻塞的情况；但由于只有一个 WAL 文件，任何时刻仍然只有一个写者。[7]

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

WAL 还带来几个必须纳入运维的事项：

- checkpoint 会把 WAL 内容合并回主数据库；
- 长时间未结束的读事务可能阻碍 checkpoint 回收旧页面；
- WAL 要求相关进程位于同一主机，不能把网络文件系统当作普通本地文件系统使用；
- `synchronous = NORMAL` 是可靠性与性能之间的取舍，不能脱离掉电模型直接称为“最优”。

因此，“WAL 让读写不阻塞”应改写成：**WAL 改善了常见读写并发，但不改变 SQLite 的单写者事实，也不消除长事务、checkpoint、文件系统和故障恢复问题。**[6][7]

## 七、高级能力：虚拟表、FTS5、JSON 和生成列

### 1. 虚拟表与 FTS5

虚拟表把表接口扩展到全文搜索、文件或其他可插拔数据源。FTS5 是 SQLite 的虚拟表模块，为数据库应用提供全文搜索能力。[11]

```sql
CREATE VIRTUAL TABLE articles_fts USING fts5(
    title,
    content,
    tokenize = 'unicode61'
);

SELECT title
FROM articles_fts
WHERE articles_fts MATCH 'SQLite';
```

FTS5 是否可用仍取决于发行版和构建方式；官方文档说明它自 3.9.0 起进入 amalgamation，但源码树构建可能需要显式启用。[11]

### 2. JSON 的两个时间点

原文把“JSON1 已内置”和“JSONB”放在同一版本描述中，需要拆开：

- SQLite 3.38.0：JSON 函数从可选扩展变为默认内置接口，但仍可通过编译选项关闭。[17]
- SQLite 3.45.0：JSON 函数内部引入可序列化的 JSONB 解析树格式；JSONB 是 BLOB 表示，不等于新增一个强制的 `JSON` 列类型。[19]
- SQLite 官方 JSON 文档仍明确说明，普通 JSON 会作为文本存储。[12]

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    data TEXT NOT NULL CHECK (json_valid(data)),
    name TEXT GENERATED ALWAYS AS (
        json_extract(data, '$.name')
    ) STORED
);

CREATE INDEX idx_products_name ON products(name);
```

如果要使用 JSONB，应先确认目标 SQLite 版本和驱动是否支持 `jsonb()`；不能因为文档写了 `data JSON` 就认为列会自动校验 JSON 或自动使用二进制表示。[12][17][19]

### 3. 生成列

生成列由表达式计算得到，可以是 `VIRTUAL` 或 `STORED`；官方文档说明生成列可以参与索引。[13]

原文附录中的示例把 `email_lower` 定义为 `lower(email)`，但表结构没有声明 `email` 列。该 SQL 在本地 SQLite 运行时得到 `no such column: email`，不能直接复制到项目中。

修正后应显式声明依赖列：

```sql
CREATE TABLE account (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    email_lower TEXT GENERATED ALWAYS AS (lower(email)) STORED
);

CREATE UNIQUE INDEX idx_account_email_lower
ON account(email_lower);
```

## 八、性能调优：先测量，再改参数

### 1. 可信的优化顺序

1. 用代表性数据和真实查询建立基线；
2. 先看查询计划，再决定索引；
3. 把大量写入放进一个合理大小的事务，使用批量 API；
4. 使用参数化语句，避免 SQL 解析和注入风险；
5. 根据读写比例、内存和故障模型评估 WAL、cache、mmap 等参数；
6. 数据分布变化后执行 `ANALYZE`；
7. 大量删除后再评估 `VACUUM`、自动回收和磁盘空间策略。

### 2. 不要照抄文章中的性能数字

原文给出了单条 INSERT、批量 INSERT、简单 SELECT、百万行聚合和 FTS5 搜索的参考耗时，并注明这些数字来自典型 SSD、i5 和 WAL 环境。[1]

这些数字没有同时给出完整硬件、SQLite 编译选项、数据分布、页面大小、同步策略、事务边界和测试脚本，因此只能作为数量级示意，不能作为 SLA 或选型依据。[unverified]

同理，“批量插入 100 倍提速”“prepared statement 快 2–3 倍”等表述取决于基线是否逐条提交、驱动是否缓存语句、数据是否落盘以及测量方法；复现时必须把这些变量写入 benchmark。

### 3. 一个可复现的最小基准设计

```text
固定：SQLite 版本、编译选项、页面大小、磁盘、数据量、随机种子
对照：逐条提交 / 单事务 executemany / 分批事务
记录：总耗时、吞吐、数据库大小、WAL 大小、错误和 p95
重复：预热后多轮运行，报告中位数和离散程度
验证：用 integrity_check、行数和聚合结果检查正确性
```

## 九、备份、扩展与安全

### 1. 不要把“拷贝文件”当成通用热备

直接复制正在写入的数据库文件，在电源或操作系统故障期间可能得到损坏的备份。SQLite 官方提供 Online Backup API，可以分步复制在线数据库，并形成源数据库开始复制时的一致快照。[15]

Python 示例：

```python
import sqlite3

source = sqlite3.connect("app.db")
target = sqlite3.connect("backup.db")
try:
    with target:
        source.backup(target)
finally:
    target.close()
    source.close()
```

生产备份还要补齐：恢复演练、备份校验、保留周期、加密、权限、WAL/checkpoint 策略和跨故障域存储。Litestream、对象存储和 SQLCipher 都属于外围方案，不应误写成 SQLite 核心能力。[1]

### 2. 扩展不是“所有发行版默认都有”

JSON、FTS5、`csv`、`fileio`、数学函数等功能的可用性与版本、编译选项和发行版有关。上线前应通过 `sqlite_version()`、`pragma_compile_options` 和实际函数调用做启动检查，而不是只看开发机的 SQLite。

### 3. 参数化和密钥管理

SQL 参数化是基本安全措施，但它不能替代文件系统权限、应用鉴权、备份加密和密钥轮换。加密数据库时，密钥不得写入源码、文章或配置示例；应由部署系统注入并通过独立的密钥管理方案保护。

## 十、容量边界与选型

SQLite 官方的实现上限与推荐运行规模不是同一个概念。官方限制文档指出，在最大 65536 字节页面和最大页数条件下，理论数据库文件上限约为 281 TB；默认 4096 字节页面下约为 17.5 TB。[14]

这不意味着“281 TB 以内都适合 SQLite”。索引数量、备份窗口、写入并发、恢复时间、文件系统、单机故障域和应用访问方式往往更早成为瓶颈。[3][14]

| 需求 | 优先考虑 |
|---|---|
| 嵌入式、单机、单进程或少量协作进程 | SQLite |
| 多服务通过网络访问同一数据库 | PostgreSQL / MySQL 等服务型数据库 |
| 多副本、读写分离、跨节点容灾 | 服务型数据库及其复制方案 |
| 嵌入式分析和列式处理 | DuckDB 等专用分析引擎 |
| 全文检索 | SQLite FTS5 或专用搜索系统，取决于规模 |
| 复杂角色、行级安全、审计策略 | 应用层配合服务型数据库 |

“先问自己是否真的需要 Postgres”可以作为成本意识，但不能替代对并发、运维、恢复和安全需求的清单式评估。[3]

## 十一、版本勘误表

| 原文说法 | 更准确的写法 | 依据 |
|---|---|---|
| SQLite 的 `FULL OUTER JOIN` 需要 `LEFT + UNION` 模拟 | 3.39.0 起原生支持；旧版本才需要兼容写法 | [18] |
| 3.38+ 已有“原生 JSONB” | 3.38.0 是 JSON 函数默认内置；JSONB 相关内部格式从 3.45.0 引入 | [17][19] |
| JSON 列就是严格 JSON 类型 | SQLite 仍按五种存储类工作，普通 JSON 以文本存储 | [4][12] |
| 所有 `PRIMARY KEY` 都隐含 `NOT NULL` | 普通 SQLite 主键存在允许 `NULL` 的历史兼容例外，应显式写 `NOT NULL` | [5] |
| WAL 等于完全不阻塞 | WAL 改善读写并发，但仍然单写者，并有 checkpoint、长事务和同主机限制 | [6][7] |
| 281 TB 是 SQLite 的推荐数据规模 | 这是特定页面大小/页数下的理论上限，不是容量承诺 | [14] |
| 直接复制 `.db` 文件即可完成在线备份 | 写入期间应使用 Online Backup API 或经过验证的备份工具 | [15] |
| 任何 SQLite 都有 JSONB、FTS5 和扩展表函数 | 版本、编译选项、驱动和发行版需要逐项确认 | [11][12][19] |
| 固定 QPS、固定耗时可以直接指导选型 | 性能数字必须给出环境、数据、事务和测试脚本；原文数字未独立复现 | [1][unverified] |

截至本次整理，从 SQLite 官网下载页读取到的源码版本为 3.53.4；原文附录只列到 3.46，版本表不应继续作为当前完整版本矩阵使用。[20]

## 十二、复习速记

1. SQLite 是嵌入应用的进程内数据库，不是默认的网络数据库服务。
2. 五种存储类是 `NULL / INTEGER / REAL / TEXT / BLOB`，列类型更多体现亲和性。
3. 普通主键不等于自动 `NOT NULL`；关键字段显式写约束。
4. 外键每个连接都要 `PRAGMA foreign_keys = ON`。
5. 索引要看真实查询、列顺序、选择性和 `EXPLAIN QUERY PLAN`。
6. SQLite 可以多读，但同一时刻只有一个写事务。
7. WAL 改善读写并发，不会把 SQLite 变成多写者数据库。
8. JSON 函数内置、JSON 文本存储和 JSONB 是三个不同层次的事实。
9. 备份要考虑在线一致性、恢复演练和故障域，不能只复制正在写的文件。
10. QPS、文件大小和 benchmark 数字都必须绑定工作负载与环境。

## 十三、建议练习

### 练习 1：约束与迁移

创建 `users`、`orders` 两张表，打开外键，分别验证：重复邮箱、孤儿订单、负数数量和非法状态是否被拒绝。

### 练习 2：查询计划

为以下查询设计不同索引，并记录 `EXPLAIN QUERY PLAN` 的变化：

```sql
SELECT id, created_at
FROM orders
WHERE user_id = ?
  AND status = ?
ORDER BY created_at DESC
LIMIT 20;
```

比较普通索引、复合索引和覆盖索引的查询计划与写入成本。

### 练习 3：事务与 WAL

用两个连接构造一个长读事务和一个批量写事务，观察 rollback journal 与 WAL 模式下的行为、WAL 文件增长和 checkpoint 时机。

### 练习 4：备份恢复

使用 Online Backup API 生成备份，删除源库后恢复到新路径；对比行数、约束、索引、FTS5 表和 `PRAGMA integrity_check` 结果。

### 练习 5：版本矩阵

在目标部署环境执行：

```sql
SELECT sqlite_version();
PRAGMA compile_options;
```

再分别调用 `jsonb()`、`FULL OUTER JOIN`、窗口函数和 FTS5，形成“版本—编译选项—驱动”的兼容表。

## 核验说明

- 本文的文章结构、原文数字和原文示例均来自公众号原文；没有把原文中的经验阈值自动升级为通用事实。[1]
- SQLite 的架构与选型定位优先使用官方文档核验。[2][3]
- 数据类型、事务和 WAL 的机制优先使用官方文档核验。[4][6][7]
- 外键、查询规划和在线备份的边界优先使用官方文档核验。[8][9][15]
- 数据库上限与版本特性按对应的官方发布说明核验。[14][16][17]
- 本地独立 smoke test 使用的 SQLite runtime 报告为 3.42.0：默认 `PRAGMA foreign_keys` 为 `0`；`FULL OUTER JOIN` 可执行；`jsonb()` 不存在；原文缺失 `email` 列的生成列示例报 `no such column: email`。
- 原文的固定性能数字、固定 QPS 阈值、部分“最优/最快”措辞没有附足够可复现实验条件，均不作为本文结论。[unverified]

## Sources

[1] https://mp.weixin.qq.com/s/uhMm0vZpDwf76Nh4Z5A0iA — SQLite深度实战
[2] https://www.sqlite.org/about.html — About SQLite
[3] https://www.sqlite.org/whentouse.html — Appropriate Uses For SQLite
[4] https://www.sqlite.org/datatype3.html — Datatypes In SQLite Version 3
[5] https://www.sqlite.org/lang_createtable.html — CREATE TABLE — SQLite
[6] https://www.sqlite.org/lang_transaction.html — SQLite Transactions
[7] https://www.sqlite.org/wal.html — Write-Ahead Logging
[8] https://www.sqlite.org/foreignkeys.html — SQLite Foreign Key Support
[9] https://www.sqlite.org/queryplanner.html — The SQLite Query Planner
[10] https://www.sqlite.org/lang_upsert.html — UPSERT — SQLite
[11] https://www.sqlite.org/fts5.html — SQLite FTS5 Extension
[12] https://www.sqlite.org/json1.html — JSON Functions And Operators
[13] https://www.sqlite.org/gencol.html — Generated Columns
[14] https://www.sqlite.org/limits.html — Implementation Limits For SQLite
[15] https://www.sqlite.org/backup.html — SQLite Online Backup API
[16] https://www.sqlite.org/releaselog/3_25_0.html — SQLite Release 3.25.0
[17] https://www.sqlite.org/releaselog/3_38_0.html — SQLite Release 3.38.0
[18] https://www.sqlite.org/releaselog/3_39_0.html — SQLite Release 3.39.0
[19] https://www.sqlite.org/releaselog/3_45_0.html — SQLite Release 3.45.0
[20] https://www.sqlite.org/download.html — SQLite Download Page
