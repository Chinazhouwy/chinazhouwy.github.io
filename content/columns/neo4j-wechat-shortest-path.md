---
title: "从微信分享关系到 Neo4j 最短人脉路径：Cypher 与 GDS 实战"
date: "2026-09-16"
domain: "专栏"
area: "技术"
module: "图数据库与图算法"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "high"
visibility: "public"
summary: "以微信分享链路为例，从 Neo4j/Cypher 建模、幂等初始化和 shortestPath 查询出发，进一步说明参数化、约束与 GDS 加权最短路径的演进边界。"
tags:
  - Neo4j
  - Cypher
  - 图数据库
  - 最短路径
  - GDS
  - 系统设计
source: "用户提供的 Neo4j 微信分享关系 Demo 文档"
source_url: ""
updated_at: "2026-09-16"
---

# 从微信分享关系到 Neo4j 最短人脉路径：Cypher 与 GDS 实战

> 本文将一份 Neo4j 微信分享关系 Demo 整理为可复现的技术专栏。示例区分“人脉层级最短”和“综合关系质量最优”：前者使用 Cypher 的 `shortestPath()`，后者才需要把关系权重交给 Neo4j Graph Data Science（GDS）。Neo4j 语法和版本边界以文末官方文档为准。
>
> **安全提示**：第 0.1 节会删除当前数据库中的全部节点和关系，只能在本地学习库执行；不要在生产数据库运行。连接密码不在专栏正文固化，应通过本地配置或环境变量提供。

## 先看修订点

原始 Demo 的逐条节点初始化中，`user-001` 被重复写入了一次，同时关系示例引用了未创建的 `user-002`。本专栏已将初始化示例修正为 7 个节点：1 个业务员、3 个转发用户、3 个潜在客户；批量初始化语句与逐条初始化保持一致。

另外，页面停留时间只是潜在意向信号，不是图上的距离，也不能直接证明客户一定有购买意向。路径的“最短”在本文中指分享关系跳数最少。

## 一、为什么用图来表达分享链路

## Cypher 基础用法

Cypher 是 Neo4j 的查询语言。它不像 SQL 主要围绕“表和行”，而是围绕“节点和关系”；本文使用的最短路径语法属于 Cypher 官方文档覆盖的路径查询能力。[1]

```text
(节点)-[关系]->(节点)
```

例如：

```text
(业务员小周)-[:SHARED_TO]->(用户甲)
```

下面的语句都可以直接复制到 Neo4j Browser（`http://localhost:7474`）中执行。

## 0. 从空库初始化完整 Demo 数据

如果你刚刚清空了数据库，先按下面的顺序执行。每个代码块都可以单独复制到 Neo4j Browser 运行。

> 注意：第 0.1 步会删除当前数据库中的全部节点和关系，只适合本地学习库，不要在生产数据库执行。

### 0.1 清空旧数据（可选）

```cypher
MATCH (node)
DETACH DELETE node;
```

这一步只删除数据，不删除后面创建的约束、索引或数据库本身。

### 0.2 创建唯一约束

```cypher
CREATE CONSTRAINT person_id IF NOT EXISTS
FOR (person:Person)
REQUIRE person.id IS UNIQUE;
```

`id` 是每个人的业务主键。约束可以避免重复写入同一个人，也能帮助 Neo4j 更快定位节点。

### 0.3 创建业务节点

下面 7 条语句分别创建业务员、转发用户和潜在客户。这里使用 `MERGE`，所以在匹配条件和唯一约束设计正确时，重复执行不会因为相同 `id` 产生重复节点。[3][4]

```cypher
MERGE (person:Person {id: 'sales-001'})
SET person.name = '业务员小周', person.role = 'SALES';
```

```cypher
MERGE (person:Person {id: 'user-001'})
SET person.name = '转发用户甲', person.role = 'SHARER';
```

```cypher
MERGE (person:Person {id: 'user-002'})
SET person.name = '转发用户乙', person.role = 'SHARER';
```

```cypher
MERGE (person:Person {id: 'user-003'})
SET person.name = '转发用户丙', person.role = 'SHARER';
```

```cypher
MERGE (person:Person {id: 'prospect-001'})
SET person.name = '潜在客户甲', person.role = 'PROSPECT';
```

```cypher
MERGE (person:Person {id: 'prospect-002'})
SET person.name = '潜在客户乙', person.role = 'PROSPECT';
```

```cypher
MERGE (person:Person {id: 'prospect-003'})
SET person.name = '低停留客户', person.role = 'PROSPECT';
```

执行完后，可以先检查节点是否齐全：

```cypher
MATCH (person:Person)
RETURN person.id AS id,
       person.name AS name,
       person.role AS role
ORDER BY id;
```

预期看到 7 个节点：1 个业务员、3 个转发用户、3 个潜在客户。该输出是 Demo 预期结果，未在本机 Neo4j 实例执行。[unverified]

### 0.4 创建分享关系

关系方向是“谁分享给谁”。`dwellSeconds` 表示被分享人在页面上的停留时间；它是业务属性，不是图算法默认使用的距离。[unverified]

```cypher
MATCH (from:Person {id: 'sales-001'}), (to:Person {id: 'user-001'})
MERGE (from)-[share:SHARED_TO {shareId: 'share-001'}]->(to)
SET share.dwellSeconds = 180;
```

```cypher
MATCH (from:Person {id: 'sales-001'}), (to:Person {id: 'user-002'})
MERGE (from)-[share:SHARED_TO {shareId: 'share-002'}]->(to)
SET share.dwellSeconds = 45;
```

```cypher
MATCH (from:Person {id: 'user-001'}), (to:Person {id: 'prospect-001'})
MERGE (from)-[share:SHARED_TO {shareId: 'share-003'}]->(to)
SET share.dwellSeconds = 300;
```

```cypher
MATCH (from:Person {id: 'user-002'}), (to:Person {id: 'user-003'})
MERGE (from)-[share:SHARED_TO {shareId: 'share-004'}]->(to)
SET share.dwellSeconds = 600;
```

```cypher
MATCH (from:Person {id: 'user-003'}), (to:Person {id: 'prospect-002'})
MERGE (from)-[share:SHARED_TO {shareId: 'share-005'}]->(to)
SET share.dwellSeconds = 420;
```

```cypher
MATCH (from:Person {id: 'user-001'}), (to:Person {id: 'prospect-003'})
MERGE (from)-[share:SHARED_TO {shareId: 'share-006'}]->(to)
SET share.dwellSeconds = 20;
```

检查关系：

```cypher
MATCH (from:Person)-[share:SHARED_TO]->(to:Person)
RETURN from.name AS from,
       type(share) AS relationType,
       to.name AS to,
       share.shareId AS shareId,
       share.dwellSeconds AS dwellSeconds
ORDER BY shareId;
```

预期看到 6 条关系。该输出是 Demo 预期结果，未在本机 Neo4j 实例执行。[unverified] 直接画出完整分享图：

```cypher
MATCH path = ()-[:SHARED_TO]->()
RETURN path;
```

### 0.5 直接执行最短路径查询

下面这版写死了 Demo 的业务员和阈值，可以在 Browser 中直接执行，不需要先设置参数：

```cypher
MATCH (sales:Person {id: 'sales-001'}),
      (prospect:Person {role: 'PROSPECT'})
WHERE sales <> prospect
MATCH path = shortestPath((sales)-[:SHARED_TO*1..6]->(prospect))
WITH prospect,
     path,
     length(path) AS hops,
     last(relationships(path)).dwellSeconds AS finalDwellSeconds,
     reduce(total = 0, relation IN relationships(path) |
         total + relation.dwellSeconds) AS totalDwellSeconds
WHERE finalDwellSeconds >= 60
RETURN prospect.id AS prospectId,
       prospect.name AS prospectName,
       hops,
       finalDwellSeconds,
       totalDwellSeconds,
       [node IN nodes(path) | node.name] AS pathNames
ORDER BY hops ASC, finalDwellSeconds DESC, totalDwellSeconds DESC;
```

预期结果（未在本机 Neo4j 实例执行）：[unverified]

```text
潜在客户甲：2 跳，路径为 业务员小周 -> 转发用户甲 -> 潜在客户甲
潜在客户乙：3 跳，路径为 业务员小周 -> 转发用户乙 -> 转发用户丙 -> 潜在客户乙
```

`低停留客户` 的最后一次停留只有 20 秒，小于 60 秒，因此会被过滤掉。

### 0.6 一次性批量初始化

不想逐条执行时，也可以使用下面两条批量语句完成同样的初始化。它们与上面的 7 个节点和 6 条关系完全对应。

批量创建节点：

```cypher
UNWIND [
    {id: 'sales-001', name: '业务员小周', role: 'SALES'},
    {id: 'user-001', name: '转发用户甲', role: 'SHARER'},
    {id: 'user-002', name: '转发用户乙', role: 'SHARER'},
    {id: 'user-003', name: '转发用户丙', role: 'SHARER'},
    {id: 'prospect-001', name: '潜在客户甲', role: 'PROSPECT'},
    {id: 'prospect-002', name: '潜在客户乙', role: 'PROSPECT'},
    {id: 'prospect-003', name: '低停留客户', role: 'PROSPECT'}
] AS row
MERGE (person:Person {id: row.id})
SET person.name = row.name,
    person.role = row.role;
```

批量创建关系：

```cypher
UNWIND [
    {shareId: 'share-001', fromId: 'sales-001', toId: 'user-001', dwellSeconds: 180},
    {shareId: 'share-002', fromId: 'sales-001', toId: 'user-002', dwellSeconds: 45},
    {shareId: 'share-003', fromId: 'user-001', toId: 'prospect-001', dwellSeconds: 300},
    {shareId: 'share-004', fromId: 'user-002', toId: 'user-003', dwellSeconds: 600},
    {shareId: 'share-005', fromId: 'user-003', toId: 'prospect-002', dwellSeconds: 420},
    {shareId: 'share-006', fromId: 'user-001', toId: 'prospect-003', dwellSeconds: 20}
] AS row
MATCH (from:Person {id: row.fromId})
MATCH (to:Person {id: row.toId})
MERGE (from)-[share:SHARED_TO {shareId: row.shareId}]->(to)
SET share.dwellSeconds = row.dwellSeconds;
```

后面的查询、聚合和最短路径示例都依赖这套初始化数据。使用 Java Demo 时，`WeChatShareGraphDemo` 的 `createSchema`、`resetDemoData` 和 `seedDemoData` 方法会自动完成同样的工作。[unverified]

> 从这里开始的章节是 Cypher 语法拆解。完成第 0 节初始化后，查询类示例可以继续执行；带有 `CREATE` 的写入示例不要原样重复执行，否则可能违反唯一约束或产生重复关系。实际业务导入优先使用前面的 `MERGE` 写法。

### 1. 创建节点

```cypher
CREATE (person:Person {
    id: 'user-001',
    name: '用户甲',
    role: 'SHARER'
})
RETURN person
```

- `CREATE`：创建数据。
- `person`：当前节点的变量名，只在当前语句中有效。
- `:Person`：节点标签，可以理解为节点类型或分类。
- `{...}`：节点属性，使用键值对保存业务数据。

### 2. 查询节点

查询所有 `Person` 节点：

```cypher
MATCH (person:Person)
RETURN person
```

根据属性查询：

```cypher
MATCH (person:Person {id: 'user-001'})
RETURN person.name, person.role
```

使用 `WHERE` 写更复杂的条件：

```cypher
MATCH (person:Person)
WHERE person.role = 'PROSPECT'
  AND person.name CONTAINS '客户'
RETURN person.id, person.name
```

常见条件写法：

```cypher
person.age >= 18
person.name STARTS WITH '张'
person.name CONTAINS '客户'
person.role IN ['SALES', 'PROSPECT']
```

### 3. 创建节点之间的关系

```cypher
MATCH (sales:Person {id: 'sales-001'})
MATCH (user:Person {id: 'user-001'})
CREATE (sales)-[share:SHARED_TO {
    shareId: 'share-001',
    dwellSeconds: 180
}]->(user)
RETURN sales, share, user
```

这表示业务员把页面分享给用户甲，用户甲在页面停留了 180 秒。

- `-[share:SHARED_TO {...}]->`：创建一条有方向的关系。
- `share`：关系变量名。
- `SHARED_TO`：关系类型。
- 关系也可以拥有属性，例如 `shareId`、`dwellSeconds`。

### 4. 查询关系

查询业务员分享给了谁：

```cypher
MATCH (sales:Person {id: 'sales-001'})
      -[share:SHARED_TO]->(receiver:Person)
RETURN sales.name,
       type(share) AS relationType,
       receiver.name,
       share.dwellSeconds
```

查询某个用户分享给了谁：

```cypher
MATCH (user:Person {id: 'user-001'})-[:SHARED_TO]->(receiver)
RETURN receiver
```

查询谁分享给了某个潜在客户：

```cypher
MATCH (sharer)-[:SHARED_TO]->(prospect:Person {id: 'prospect-001'})
RETURN sharer
```

### 5. 查询多跳关系

查询业务员后面最多 3 层的分享链路：

```cypher
MATCH path = (sales:Person {id: 'sales-001'})-[:SHARED_TO*1..3]->(target)
RETURN path
```

- `*1..3`：关系可以连续出现 1 到 3 次。
- `path`：保存整条路径。
- `nodes(path)`：取路径上的节点。
- `relationships(path)`：取路径上的关系。
- `length(path)`：取路径经过的关系数量。

把路径上的人名打印出来：

```cypher
MATCH path = (sales:Person {id: 'sales-001'})-[:SHARED_TO*1..3]->(target)
RETURN [node IN nodes(path) | node.name] AS names,
       length(path) AS hops
```

### 6. 更新和删除

更新节点属性：

```cypher
MATCH (person:Person {id: 'user-001'})
SET person.role = 'PROSPECT',
    person.updatedAt = datetime()
RETURN person
```

删除一个属性：

```cypher
MATCH (person:Person {id: 'user-001'})
REMOVE person.updatedAt
RETURN person
```

删除没有关系的节点：

```cypher
MATCH (person:Person {id: 'user-001'})
DELETE person
```

节点有关系时，使用 `DETACH DELETE` 同时删除关系：

```cypher
MATCH (person:Person {id: 'user-001'})
DETACH DELETE person
```

删除关系但保留两端节点：

```cypher
MATCH (:Person {id: 'sales-001'})
      -[share:SHARED_TO {shareId: 'share-001'}]->()
DELETE share
```

### 7. `CREATE` 和 `MERGE`

`CREATE` 每次都会创建一份新数据，重复执行可能产生重复节点：

```cypher
CREATE (:Person {id: 'user-001', name: '用户甲'})
```

`MERGE` 会先查找，找到就复用，找不到才创建；这是官方语义，但真正的业务幂等仍取决于匹配条件和约束。[3][4]

```cypher
MERGE (person:Person {id: 'user-001'})
SET person.name = '用户甲'
RETURN person
```

业务导入和初始化数据通常使用 `MERGE`。不过 `MERGE` 是否真正幂等，还取决于匹配条件和唯一约束是否设计正确。[3][4]

### 8. 聚合统计

统计每个业务员分享了多少次：

```cypher
MATCH (sales:Person {role: 'SALES'})-[share:SHARED_TO]->()
RETURN sales.name,
       count(share) AS shareCount,
       sum(share.dwellSeconds) AS totalDwellSeconds
ORDER BY shareCount DESC
```

常见聚合函数：

```text
count(...)    统计数量
sum(...)      求和
avg(...)      平均值
min(...)      最小值
max(...)      最大值
collect(...)  收集成列表
```

### 9. 使用参数

Cypher 中用 `$name` 表示参数：

```cypher
MATCH (person:Person {id: $personId})
RETURN person
```

Java 侧传入参数：

```java
session.run(
        "MATCH (person:Person {id: $personId}) RETURN person",
        Map.of("personId", "user-001")
);
```

不要把用户输入直接拼接到 Cypher 字符串中：

```java
// 不推荐：字符串拼接可能造成注入，也不利于 Neo4j 复用查询计划。
String cypher = "MATCH (p:Person {id: '" + personId + "'}) RETURN p";
```

### 10. 创建唯一约束

```cypher
CREATE CONSTRAINT person_id IF NOT EXISTS
FOR (person:Person)
REQUIRE person.id IS UNIQUE
```

这条语句要求所有 `Person` 节点的 `id` 唯一。Demo 在 Java 的 `createSchema` 方法中执行了同样的语句。[4]

约束可以防止同一个业务用户被重复写入，也能帮助 Neo4j 更快定位节点。

## 业务模型

```text
业务员 --SHARED_TO--> 被分享人 --SHARED_TO--> 被分享人/潜在客户
                         |
                         └── dwellSeconds：页面停留时间
```

- `Person`：业务员、转发用户或潜在客户。
- `SHARED_TO`：分享关系，方向表示分享链路。
- `dwellSeconds`：被分享人在页面上的停留时间，是意向信号，不是图上的距离。
- 路径长度：分享关系的跳数，越少表示业务员触达潜在客户所经过的人脉层级越少。

## 运行

Docker Desktop 启动后，在项目根目录执行；以下运行链路未在本机执行。[unverified]

```bash
docker compose -f dev/neo4j/compose.yml up -d
mvn -q -DskipTests compile
mvn -q dependency:build-classpath -Dmdep.outputFile=/tmp/advanced-java-classpath.txt
java -cp "target/classes:$(cat /tmp/advanced-java-classpath.txt)" \
  com.advancedjava.graph.neo4j.WeChatShareGraphDemo
```

也可以在 IDE 中直接运行：

```text
com.advancedjava.graph.neo4j.WeChatShareGraphDemo
```

默认连接地址：`bolt://localhost:7687`，用户名为 `neo4j`。密码应通过本地 Docker Compose 配置或 `NEO4J_PASSWORD` 环境变量提供，不在专栏正文固化。[unverified]
如需修改，通过 `NEO4J_URI`、`NEO4J_USER`、`NEO4J_PASSWORD` 环境变量覆盖。

Neo4j Browser 地址：`http://localhost:7474`。

## Demo 查询逻辑

Demo 使用 Cypher 的 `shortestPath` 查询业务员到每个潜在客户的一条最短路径，再用最后一次分享的停留时间过滤低意向客户：

```cypher
MATCH (sales:Person {id: $salesId}), (prospect:Person {role: 'PROSPECT'})
MATCH path = shortestPath((sales)-[:SHARED_TO*1..6]->(prospect))
WHERE last(relationships(path)).dwellSeconds >= $minimumDwellSeconds
RETURN path
ORDER BY length(path)
```

## 查询逐行解释

这段不是传统 SQL，而是 Neo4j 的 Cypher。可以先记住三个符号；最短路径和路径模式的具体语义以 Cypher 官方文档为准。[1]

```text
(person:Person)       一个节点，Person 是节点类型
[:SHARED_TO]          一条关系，SHARED_TO 是关系类型
(a)-[:SHARED_TO]->(b) 一条从 a 指向 b 的有向关系
```

Demo 中的数据大致是：

```text
(业务员小周)-[:SHARED_TO]->(转发用户甲)-[:SHARED_TO]->(潜在客户甲)
```

### 第 1 行：找到起点和候选终点

```cypher
MATCH (sales:Person {id: $salesId}), (prospect:Person {role: 'PROSPECT'})
```

- `MATCH`：从图中匹配数据，作用有点像 SQL 的 `SELECT ... FROM ...`，但匹配的是图结构。[1]
- `(sales:Person ...)`：找到一个 `Person` 节点，并把它临时命名为 `sales`。
- `{id: $salesId}`：要求节点的 `id` 等于参数 `$salesId`。本 Demo 传入的是 `sales-001`。
- `(prospect:Person {role: 'PROSPECT'})`：找到所有角色为 `PROSPECT` 的 `Person` 节点。
- 中间的逗号表示同时匹配两组节点。这里会得到“一个业务员 + 多个潜在客户”的候选组合。

对应的业务意思是：从指定业务员出发，逐个寻找潜在客户。

### 第 2 行：排除起点和终点是同一个节点

```cypher
WHERE sales <> prospect
```

- `WHERE`：过滤条件，类似 SQL 的 `WHERE`。
- `<>`：不等于。
- 这行保证业务员节点本身不会被当成潜在客户。

### 第 3 行：匹配一条最短分享路径

```cypher
MATCH path = shortestPath((sales)-[:SHARED_TO*1..6]->(prospect))
```

拆开看：

- `path =`：把找到的完整路径保存到变量 `path`。
- `shortestPath(...)`：在符合条件的路径中，寻找关系跳数最少的一条。[1]
- `(sales)`：路径起点，就是上一步找到的业务员。
- `[:SHARED_TO]`：只沿着分享关系查找。
- `*1..6`：关系可以连续出现 1 到 6 次，也就是最多追踪 6 层转发。
- `->`：表示只沿分享方向查找，不能反向从客户倒推分享人。
- `(prospect)`：路径终点，就是当前候选潜在客户。

例如：

```text
业务员 -> 用户甲 -> 客户甲       2 跳
业务员 -> 用户乙 -> 用户丙 -> 客户乙  3 跳
```

`shortestPath` 会优先选择 2 跳的路径。这里的“最短”是人脉层级最少，不是页面停留时间最短。[1][unverified]

### 第 4～8 行：计算路径上的统计值

```cypher
WITH prospect, path,
     length(path) AS hops,
     last(relationships(path)).dwellSeconds AS finalDwellSeconds,
     reduce(total = 0, relation IN relationships(path) |
         total + relation.dwellSeconds) AS totalDwellSeconds
```

`WITH` 可以理解为查询过程中的“中间结果管道”：先保留需要的数据，再计算新的字段，计算结果可以交给后面的 `WHERE`、`RETURN` 使用。[unverified]

#### `length(path) AS hops`

```cypher
length(path) AS hops
```

- `length(path)`：计算路径经过了多少条关系。
- `AS hops`：把计算结果命名为 `hops`，中文可以理解为“跳数”。

#### `relationships(path)`

```cypher
relationships(path)
```

把整条路径上的关系取出来，得到一个列表。例如：

```text
[业务员 -> 用户甲, 用户甲 -> 客户甲]
```

#### `last(...).dwellSeconds`

```cypher
last(relationships(path)).dwellSeconds AS finalDwellSeconds
```

- `last(...)`：取关系列表中的最后一条关系。
- 最后一条关系通常是“中间转发人分享给潜在客户”的那次分享。
- `.dwellSeconds`：读取这条分享关系上的页面停留时间。
- `AS finalDwellSeconds`：把它命名为“最后一次分享停留时间”。

例如：

```text
业务员 -> 用户甲       停留 180 秒
用户甲 -> 潜在客户甲   停留 300 秒
```

最后一次停留时间就是 300 秒，它比业务员最初分享给用户甲的 180 秒更能说明潜在客户本人的兴趣。

#### `reduce(...)`

```cypher
reduce(total = 0, relation IN relationships(path) |
    total + relation.dwellSeconds) AS totalDwellSeconds
```

这是 Cypher 对列表做累加：

- `total = 0`：累加器初始值为 0。
- `relation IN relationships(path)`：逐条遍历路径上的关系。
- `total + relation.dwellSeconds`：把每条关系的停留时间加起来。
- `AS totalDwellSeconds`：得到整条分享链路的累计停留时间。

这和 Java 里的循环类似：

```java
long total = 0;
for (ShareRelation relation : relations) {
    total += relation.dwellSeconds();
}
```

### 第 9 行：过滤低意向客户

```cypher
WHERE finalDwellSeconds >= $minimumDwellSeconds
```

- 只保留最后一次页面停留时间大于等于阈值的客户。
- `$minimumDwellSeconds` 是 Java 传入的参数，本 Demo 是 60 秒。
- 低于 60 秒的“低停留客户”会被过滤。

注意：停留时间只能作为潜在意向信号，不能直接证明客户一定有购买意向。

### 第 10～16 行：返回结果

```cypher
RETURN prospect.id AS prospectId,
       prospect.name AS prospectName,
       hops,
       finalDwellSeconds,
       totalDwellSeconds,
       [node IN nodes(path) | node.name] AS pathNames
```

- `RETURN`：返回查询结果，类似 SQL 的 `SELECT`。
- `prospect.id AS prospectId`：返回客户 id，并重命名为 `prospectId`。
- `prospect.name AS prospectName`：返回客户名称。
- `hops`：返回最短路径跳数。
- `finalDwellSeconds`：返回最后一次分享的停留时间。
- `totalDwellSeconds`：返回整条路径累计停留时间。
- `nodes(path)`：取出路径上的所有节点。
- `[node IN nodes(path) | node.name]`：遍历节点列表，只保留每个节点的名称，形成路径名称列表。

返回结果中的 `pathNames` 大致是：

```text
[业务员小周, 转发用户甲, 潜在客户甲]
```

### 最后一行：排序

```cypher
ORDER BY hops ASC, finalDwellSeconds DESC, totalDwellSeconds DESC
```

- `hops ASC`：先按跳数升序，路径越短越靠前。
- `finalDwellSeconds DESC`：跳数相同时，最后一次停留更久的客户靠前。
- `totalDwellSeconds DESC`：前两项都相同时，整条分享链路累计停留更久的靠前。

因此排序规则是：

```text
先找最短人脉，再看潜在客户本人停留时间，最后看整条链路累计停留时间。
```

### Java 如何把参数传给 Cypher

```java
session.run(cypher, Map.of(
        "salesId", salesId,
        "minimumDwellSeconds", minimumDwellSeconds
));
```

Java 的 `Map` 会对应 Cypher 中的 `$salesId` 和 `$minimumDwellSeconds`；参数值在执行时传入，而不是拼接进查询字符串。[2]

```text
$salesId                 <- Map 中的 salesId
$minimumDwellSeconds     <- Map 中的 minimumDwellSeconds
```

使用参数而不是字符串拼接，可以避免把用户输入直接拼进查询语句，也便于 Neo4j 复用查询计划。[2]

### 这条查询目前没有做什么

## 不需要自己手写最短路径算法

当前代码里的：

```cypher
shortestPath((sales)-[:SHARED_TO*1..6]->(prospect))
```

就是 Neo4j 内置的最短路径函数。我们自己写的是“业务查询条件”，不是 BFS 或 Dijkstra 算法本身。Neo4j 会负责在图中搜索跳数最少的路径。Cypher 现在还提供 `SHORTEST`、`ALL SHORTEST` 等更丰富的写法，旧的 `shortestPath()` 和 `allShortestPaths()` 仍然可以使用，但当前官方文档已将它们标为非 GQL-conformant。[1]

可以按需求这样选：

| 需求 | 推荐方式 | 是否需要自己实现算法 |
|---|---|---|
| 找一条跳数最少的路径 | `shortestPath()` | 不需要 |
| 找出所有同样最短的路径 | `ALL SHORTEST` 或 `allShortestPaths()` | 不需要 |
| 找第 2、3 短等多组路径 | `SHORTEST k GROUPS` | 不需要 |
| 停留时长、关系强度参与路径成本 | GDS Dijkstra | 不需要，但要安装/启用 GDS |
| 需要完全自定义业务规则 | 先用图查询缩小范围，再在 Java 中做业务排序 | 通常不需要手写图算法 |

### 为什么当前 Demo 不直接用 Dijkstra

当前目标是“业务员到潜在客户经过几层分享关系”，所以路径长度就是分享跳数，普通 `shortestPath()` 足够。页面停留时间只是筛选和排序条件：

```text
最短路径 = 人脉层级最少
停留时间 = 潜在意向信号
```

如果把停留时间也放进路径成本，就要先定义成本，例如停留越久，成本越低：

```text
cost = 1 + 1000 / (dwellSeconds + 1)
```

然后把 `cost` 存到 `SHARED_TO` 关系上，再用 Neo4j GDS 的 Dijkstra 算法按权重计算。GDS 官方提供 `gds.shortestPath.dijkstra.stream`，支持通过 `relationshipWeightProperty` 指定关系权重属性。[5]

概念上的 GDS 调用大致是：

```cypher
CALL gds.shortestPath.dijkstra.stream('shareGraph', {
    sourceNode: source,
    targetNodes: target,
    relationshipWeightProperty: 'cost'
})
YIELD totalCost, nodeIds
RETURN totalCost, nodeIds
```

这段需要先把 Neo4j 中的节点和关系投影成 GDS named graph，不能直接在当前只安装 Neo4j Community 的容器里运行。GDS 本身提供了 Dijkstra、A*、Yen、BFS 等现成图算法，不需要我们从头实现。[5][6]

所以当前 Demo 的分层是合理的：先用 Neo4j 内置 `shortestPath()` 把最短人脉跑通；等业务真的需要“综合停留时长和关系质量计算最佳路径”时，再接入 GDS 加权算法。[1][5]

生产系统还需要补充时间窗口、重复分享去重、关系有效期、隐私授权、数据脱敏和批量查询限制。页面停留时间只能提高潜在意向排序，不能直接证明客户意向。[unverified]

## 官方核验与版本边界

1. **`MERGE` 不是无条件的全局幂等。** Neo4j 官方定义是：精确模式已存在时复用匹配结果，不存在时创建模式；因此业务导入仍要用稳定匹配键，并配合属性唯一约束，不能只因为写了 `MERGE` 就假设所有重复写入都安全。[3][4]
2. **`shortestPath()` 仍可使用，但有新的 Cypher 写法。** 当前 Cypher 文档说明 `SHORTEST` 在功能上替代并扩展 `shortestPath()` 与 `allShortestPaths()`，旧函数仍可用但不是 GQL-conformant。[1]
3. **参数化查询是安全和可维护性边界。** Neo4j 文档说明参数可以承载字面量、节点/关系 ID 等值，并有助于执行计划缓存；标签、关系类型和属性键等查询结构不能简单用参数替换。[2]
4. **GDS Dijkstra 的示例使用 `targetNodes`。** 当前 GDS 文档把 `targetNodes` 作为目标节点参数，并将旧的 `targetNode` 标为 deprecated；示例因此采用 `targetNodes: target`。算法运行前还必须有图目录中的 named graph，不能把 GDS 调用当成普通 Cypher 的内置函数直接执行。[5]
5. **本文未锁定 Neo4j/GDS 的具体发行版本。** Docker Compose、Java Driver、Neo4j Server 和 GDS 插件的版本需要在实际项目中统一，并以目标版本文档和集成测试结果为准。

## 适合简历的描述

> 针对微信分享链路中“业务员无法识别潜在人脉”的问题，调研图数据库并完成 Neo4j Demo：将业务员、分享用户和潜在客户建模为节点与有向分享关系，使用最短路径查询业务员到潜在客户的最少分享层级，并结合页面停留时长进行潜在意向筛选和排序。

## Sources

[1] https://neo4j.com/docs/cypher-manual/current/patterns/shortest-paths — Neo4j Cypher Manual：Shortest paths
[2] https://neo4j.com/docs/cypher-manual/current/syntax/parameters — Neo4j Cypher Manual：Parameters
[3] https://neo4j.com/docs/cypher-manual/current/clauses/merge — Neo4j Cypher Manual：MERGE
[4] https://neo4j.com/docs/cypher-manual/current/schema/constraints/create-constraints — Neo4j Cypher Manual：Create constraints
[5] https://neo4j.com/docs/graph-data-science/current/algorithms/dijkstra-source-target — Neo4j Graph Data Science：Dijkstra Source-Target Shortest Path
[6] https://neo4j.com/docs/graph-data-science/current/algorithms/pathfinding — Neo4j Graph Data Science：Path finding algorithms
