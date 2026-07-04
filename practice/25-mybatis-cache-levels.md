# 第25题：MyBatis 一级/二级缓存机制

**来源**：用户追问（从第24题Redis缓存延伸）
**练习日期**：2026-06-09
**得分**：N/A（追问式讨论，非正式答题）

---

## 一、MyBatis 缓存架构

```
请求 → 一级缓存（SqlSession）→ 二级缓存（Mapper namespace）→ 数据库
```

## 二、一级缓存（SqlSession级别）

### 核心特点
- **默认开启，无法关闭**
- 生命周期 = SqlSession 的生命周期
- 执行增删改（insert/update/delete）后自动清空
- Spring 中一个事务 = 一个 SqlSession，事务结束后销毁

### 坑：事务内脏读

```java
@Transactional
public void test() {
    User u1 = mapper.getUserById(1);  // 查DB，存入一级缓存
    // 此时另一个事务改了id=1的数据并提交
    User u2 = mapper.getUserById(1);  // 还是走一级缓存！读到旧值
}
```

**原因**：同一个 SqlSession 内，相同查询直接走一级缓存，不会重新查 DB。

## 三、二级缓存（Mapper/namespace级别）

### 开启方式

```xml
<mapper namespace="com.example.UserMapper">
    <cache/>  <!-- 开启二级缓存 -->
</mapper>
```

### 核心特点
- 跨 SqlSession 共享（同一 Mapper 下的所有 SqlSession）
- 需要手动开启
- **脏读风险高，生产中基本不用**

### 脏读的根本原因：写入时机

**二级缓存的数据要等 SqlSession commit/close 之后才会真正写入。**

```
时间线：

T1: SqlSession A 执行 SELECT * FROM user WHERE id = 1
    → 查DB，结果存入【一级缓存】
    → 注意：此时还没写入二级缓存！

T2: SqlSession B 执行 UPDATE user SET name = '新名字' WHERE id = 1
    → 更新DB → 提交

T3: 此时二级缓存里有 id=1 的数据吗？
    → 没有！因为 Session A 还没 commit/close
    → 二级缓存不知道 id=1 被改过了

T4: Session A commit/close → 旧数据被写入二级缓存 ⚠️

T5: 新的 SqlSession C 执行 SELECT * FROM user WHERE id = 1
    → 二级缓存命中 → 返回旧数据 ❌ 脏读！
```

### 更坑的多表 JOIN 场景

```
UserMapper 二级缓存    OrderMapper 二级缓存
      ↑                      ↑
  各自独立，互不感知

改了 order 表 → OrderMapper 二级缓存失效
              → 但 UserMapper 二级缓存不知道！
              → JOIN 查询可能返回脏数据
```

## 四、为什么还要设计二级缓存？

### 历史背景

MyBatis 诞生于 2010 年左右，当时 Redis 不是标配：

```
单体应用 + 单个MySQL实例
  → 没有 Redis
  → 二级缓存是"唯一能跨请求共享数据"的手段
```

### 设计初衷 vs 现实

| 设计初衷 | 现实情况 |
|---------|---------|
| 跨 SqlSession 共享查询结果 | 分布式部署后，每个实例各有独立缓存，共享没意义 |
| 减少 DB 压力 | Redis 做得更好、更可控 |
| 简单开启就能用 | 脏读风险大，生产不敢开 |
| 基于 namespace 的缓存隔离 | 多表 JOIN 时缓存失效逻辑复杂 |

### 什么时候"可以"用？

```
✅ 适合：单机部署 + 读远多于写 + 写操作极少且不并发 + 对一致性要求不高
❌ 不适合：分布式部署 + 有并发读写 + 对一致性有要求 + 已有 Redis
```

## 五、三级缓存对比

| 维度 | MyBatis一级 | MyBatis二级 | Redis |
|------|-----------|-----------|-------|
| **粒度** | SqlSession | Mapper namespace | 业务Key |
| **范围** | 单次会话 | 同Mapper跨会话 | 分布式共享 |
| **开启** | 默认 | 需配置 | 需引入 |
| **一致性** | 事务内一致 | ⚠️ 有脏读风险 | 需设计 |
| **生产用** | ✅ 默认用 | ❌ 基本不用 | ✅ 主力 |

## 六、面试实战回答模板

> "MyBatis 二级缓存的设计初衷是在没有 Redis 的年代，提供跨 SqlSession 的查询结果复用。在单机、读多写少的简单场景下确实有效。但现代架构普遍有 Redis，二级缓存的跨实例共享能力为零，脏读风险又大，所以生产基本关掉。它的存在更像是历史产物——**设计没问题，只是被更好的方案（Redis）替代了。**"

---

## 七、这次讨论的收获

- 二级缓存脏读的根本原因：写入时机（commit/close 后才写入）
- 二级缓存不是"设计错了"，而是"时代变了"
- 能说出"为什么存在 + 为什么不用"比光说"坑多别用"更有深度
- MyBatis一级缓存是"顺手优化"，二级缓存"历史产物"，Redis才是"正主"
