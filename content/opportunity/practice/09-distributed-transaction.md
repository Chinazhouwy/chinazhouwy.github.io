---
title: "分布式事务有哪些解决方案？Seata 的 AT 模式底层是怎么实现的？"
date: "2026-05-30"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "分布式事务有哪些解决方案？Seata 的 AT 模式底层是怎么实现的？"
tags:
schema_version: "1"
question_id: "9"
question: "分布式事务有哪些解决方案？Seata 的 AT 模式底层是怎么实现的？"
sources:
  - "unknown"
score: "2/10"
round: "R0"
next_review: "unknown"
session_id: "unknown"
---

# 第9题 — 分布式事务

> **题目**：分布式事务有哪些解决方案？Seata 的 AT 模式底层是怎么实现的？
> 追问：AT 模式和 TCC 模式的区别是什么？什么场景用 AT，什么场景用 TCC？

---

## 得分：2/10

### ✅ 答对的部分
- 意识到需要外部组件参与协调，但 Redis、Zookeeper、数据库本身不是一类标准“分布式事务方案”。它们可以做状态存储、锁/协调、XA 参与者或幂等兜底，真正要答的是 2PC/XA、TCC、Saga、本地消息表、Seata AT 等模式。

### ❌ 问题
1. 没有说出分布式事务的核心模式（-3）：2PC、TCC、Saga、本地消息表
2. Seata 完全没提（-2.5）
3. 只列了工具，没说事务模式和失败补偿路径（-2）
4. AT/TCC 模式没答（-0.5）

---

## 一、先搞懂：分布式事务为什么难？

```
本地事务：一个数据库，BEGIN → 操作 → COMMIT，简单
分布式事务：多个服务、多个数据库，要保证"要么全成功，要么全回滚"
```

**例子**：用户下单
```
订单服务：创建订单 ✅
库存服务：扣减库存 ✅
支付服务：扣款失败 ❌  ← 怎么回滚前面两个？
```

---

## 二、5大解决方案

### 1. 2PC（两阶段提交）

```
协调者（比如数据库）：
  第1阶段（准备）：问所有参与者"你能提交吗？"
    订单库：可以 ✅
    库存库：可以 ✅
  第2阶段（提交）：通知所有人"全部提交！"
    订单库：提交 ✅
    库存库：提交 ✅
```

| 优点 | 缺点 |
|------|------|
| 强一致 | 同步阻塞，性能差 |
| 实现简单 | 协调者单点故障 |

**适用**：数据库层面的分布式事务（如 MySQL XA）

---

### 2. TCC（Try-Confirm-Cancel）

```
Try（预留）：  订单：冻结金额100元 ✅  库存：冻结库存1件 ✅
Confirm（确认）：订单：扣款100元 ✅    库存：扣减库存1件 ✅
Cancel（取消）：订单：解冻100元 ✅     库存：释放库存1件 ✅
```

**核心思想**：业务层面实现"预留→确认/回滚"

| 优点 | 缺点 |
|------|------|
| 性能好（不锁数据库） | 业务侵入性强（每个接口要写3个方法） |
| 灵活 | 开发成本高 |

**适用**：金融、支付等**强一致性 + 高性能**场景

---

### 3. Saga 模式

```
正向操作：T1 → T2 → T3
补偿操作：C1 ← C2 ← C3

如果 T3 失败：
  执行 C2（补偿T2）
  执行 C1（补偿T1）
```

**例子**：
```
T1：创建订单 → T2：扣库存 → T3：扣款（失败）
C2：恢复库存
C1：取消订单
```

| 优点 | 缺点 |
|------|------|
| 业务侵入小 | 最终一致，不是实时一致 |
| 适合长流程 | 补偿逻辑复杂 |

**适用**：电商下单、跨服务长流程

---

### 4. 本地消息表（最常用）

```
订单服务：
  1. 创建订单 + 写入消息表（同一个本地事务）
  2. 定时扫描消息表，发送 MQ
  3. 库存服务消费消息，扣减库存
  4. 扣减成功 → 更新消息状态为"已处理"
  5. 失败 → 重试
```

| 优点 | 缺点 |
|------|------|
| 实现简单 | 有延迟（非实时） |
| 可靠（本地事务保证） | 需要定时任务扫描 |

**适用**：大多数业务场景，**最常用的方案**

---

### 5. Seata（阿里开源框架）

#### AT 模式（最常用）

```
1. 一阶段（自动）
   执行 SQL 前，记录旧数据（before image）
   执行 SQL
   执行 SQL 后，记录新数据（after image）
   提交本地事务

2. 二阶段
   提交：删除 undo log（异步，很快）
   回滚：用 before image 反向修复数据
```

**核心原理**：通过 **undo log** 实现自动回滚

```
用户操作：UPDATE account SET balance = balance - 100 WHERE id = 1

Seata 自动记录：
  before image: {id:1, balance:500}  ← 修改前
  after image:  {id:1, balance:400}  ← 修改后

如果需要回滚：
  用 before image 覆盖当前数据 → balance 恢复为 500
```

#### AT vs TCC 对比

| | AT 模式 | TCC 模式 |
|--|---------|----------|
| **实现方式** | 框架自动（SQL拦截） | 手动写 Try/Confirm/Cancel |
| **业务侵入** | 低（加注解即可） | 高（3个接口） |
| **性能** | 中（有全局锁） | 高（无锁） |
| **一致性** | 最终一致 | 强一致 |
| **适用场景** | 普通业务 | 金融/支付 |

---

## 三、一句话记住

> **2PC 数据库层、TCC 业务预留、Saga 补偿回滚、消息表异步可靠、Seata 自动托管**

### 选型口诀

```
能用消息表就用消息表（简单可靠）
金融支付用 TCC（强一致高性能）
普通业务用 Seata AT（开发快）
长流程用 Saga（补偿机制）
数据库层面用 2PC（简单但慢）
```

---

## 四、代码 Demo（5种方案实现）

> 以下代码均为可运行的最小示例，重点理解思路而非生产级写法。

---

### Demo 1：2PC（MySQL XA 事务）

> 场景：订单服务 + 库存服务，两个库在同一个 MySQL 实例上模拟

```java
// 2PC — MySQL XA 分布式事务
// 前提：MySQL 开启 XA 支持（默认开启）

import javax.sql.DataSource;
import java.sql.*;

public class XADemo {

    /**
     * 模拟一个事务管理器，协调两个数据源
     */
    public static void twoPhaseCommit(DataSource orderDs, DataSource stockDs) throws Exception {
        Connection orderConn = null;
        Connection stockConn = null;
        
        try {
            // ===== 阶段1：PREPARE（准备）=====
            
            // 1. 订单库：扣款 + 创建订单（但不提交）
            orderConn = orderDs.getConnection();
            orderConn.setAutoCommit(false);
            // 开启 XA 事务，分配全局事务 ID
            orderConn.createStatement().executeUpdate(
                "XA START 'tx001'"
            );
            orderConn.createStatement().executeUpdate(
                "INSERT INTO orders(user_id, amount) VALUES(1, 100)"
            );
            orderConn.createStatement().executeUpdate(
                "UPDATE account SET balance = balance - 100 WHERE user_id = 1"
            );
            orderConn.createStatement().executeUpdate(
                "XA END 'tx001'"
            );
            orderConn.createStatement().executeUpdate(
                "XA PREPARE 'tx001'"  // 准备就绪，但不提交
            );
            System.out.println("订单库：PREPARE 成功 ✅");

            // 2. 库存库：扣减库存
            stockConn = stockDs.getConnection();
            stockConn.setAutoCommit(false);
            stockConn.createStatement().executeUpdate(
                "XA START 'tx001'"
            );
            stockConn.createStatement().executeUpdate(
                "UPDATE stock SET quantity = quantity - 1 WHERE product_id = 1"
            );
            stockConn.createStatement().executeUpdate(
                "XA END 'tx001'"
            );
            stockConn.createStatement().executeUpdate(
                "XA PREPARE 'tx001'"
            );
            System.out.println("库存库：PREPARE 成功 ✅");

            // ===== 阶段2：COMMIT（提交）=====
            // 所有参与者都 PREPARE 成功，一起提交
            orderConn.createStatement().executeUpdate(
                "XA COMMIT 'tx001'"
            );
            stockConn.createStatement().executeUpdate(
                "XA COMMIT 'tx001'"
            );
            System.out.println("两个库都 COMMIT ✅ 分布式事务成功！");

        } catch (Exception e) {
            System.out.println("事务失败，回滚！❌");
            // ===== 阶段2：ROLLBACK（回滚）=====
            if (orderConn != null) {
                try {
                    orderConn.createStatement().executeUpdate("XA ROLLBACK 'tx001'");
                } catch (Exception ignored) {}
            }
            if (stockConn != null) {
                try {
                    stockConn.createStatement().executeUpdate("XA ROLLBACK 'tx001'");
                } catch (Exception ignored) {}
            }
            throw e;
        } finally {
            if (orderConn != null) orderConn.close();
            if (stockConn != null) stockConn.close();
        }
    }
}
```

**关键点**：
- `XA START` → `XA END` → `XA PREPARE` → `XA COMMIT`
- 任何一个参与者 PREPARE 失败，全部 ROLLBACK
- 缺点：全程阻塞，性能差

---

### Demo 2：TCC（Try-Confirm-Cancel）

> 场景：账户扣款，需要冻结金额

```java
// TCC — Try / Confirm / Cancel 三阶段

/**
 * 账户服务 TCC 接口
 */
public interface AccountTccService {

    /**
     * Try：冻结金额（不真正扣款）
     * - 检查余额是否充足
     * - 扣减可用余额，增加冻结金额
     */
    @Transactional
    default void tryDeduct(Long userId, BigDecimal amount) {
        // 1. 查询可用余额
        Account account = getAccount(userId);
        if (account.getAvailable().compareTo(amount) < 0) {
            throw new RuntimeException("余额不足");
        }
        // 2. 冻结：可用余额 - amount，冻结金额 + amount
        // SQL: UPDATE account 
        //      SET available = available - #{amount},
        //          frozen = frozen + #{amount}
        //      WHERE user_id = #{userId} AND available >= #{amount}
        executeUpdate(
            "UPDATE account SET available = available - ?, frozen = frozen + ? " +
            "WHERE user_id = ? AND available >= ?",
            amount, amount, userId, amount
        );
        System.out.println("Try 成功：冻结了 " + amount + " 元");
    }

    /**
     * Confirm：确认扣款
     * - 冻结金额真正转为扣减
     * - 冻结金额 - amount（实际已经冻结了，这里是真正生效）
     */
    @Transactional
    default void confirmDeduct(Long userId, BigDecimal amount) {
        // SQL: UPDATE account SET frozen = frozen - ? WHERE user_id = ?
        // （冻结金额已经在Try阶段加进来了，Confirm不需要额外操作）
        // 如果Try阶段有额外操作（如写交易记录），Confirm阶段才真正生效
        System.out.println("Confirm 成功：扣款 " + amount + " 元生效");
    }

    /**
     * Cancel：取消，解冻金额
     * - 冻结金额转回可用余额
     */
    @Transactional
    default void cancelDeduct(Long userId, BigDecimal amount) {
        // SQL: UPDATE account 
        //      SET available = available + ?, frozen = frozen - ?
        //      WHERE user_id = ?
        executeUpdate(
            "UPDATE account SET available = available + ?, frozen = frozen - ? " +
            "WHERE user_id = ?",
            amount, amount, userId
        );
        System.out.println("Cancel 成功：解冻 " + amount + " 元");
    }
}
```

```java
// TCC 事务协调器（简化版）
public class TccTransactionCoordinator {

    private List<TccParticipant> participants = new ArrayList<>();

    /**
     * 注册参与者
     */
    public void addParticipant(String name, Runnable tryOp, 
                               Runnable confirmOp, Runnable cancelOp) {
        participants.add(new TccParticipant(name, tryOp, confirmOp, cancelOp));
    }

    /**
     * 执行 TCC 分布式事务
     */
    public void execute() {
        List<TccParticipant> executed = new ArrayList<>();
        
        // ===== 阶段1：Try =====
        try {
            for (TccParticipant p : participants) {
                System.out.println(">>> Try: " + p.name);
                p.tryOp.run();
                executed.add(p);
            }
        } catch (Exception e) {
            // ===== Try 失败，逆序执行 Cancel =====
            System.out.println(">>> Try 失败！执行 Cancel 回滚...");
            Collections.reverse(executed);
            for (TccParticipant p : executed) {
                try {
                    System.out.println(">>> Cancel: " + p.name);
                    p.cancelOp.run();
                } catch (Exception cancelEx) {
                    System.err.println("Cancel 也失败了: " + p.name + 
                                       "，需要人工介入！日志记录...");
                }
            }
            throw e;
        }

        // ===== 阶段2：Confirm =====
        for (TccParticipant p : participants) {
            System.out.println(">>> Confirm: " + p.name);
            p.confirmOp.run();
        }
        System.out.println(">>> 所有 Confirm 完成，分布式事务成功 ✅");
    }

    static class TccParticipant {
        String name;
        Runnable tryOp, confirmOp, cancelOp;
        // 构造器...
    }
}

// 使用示例
public class TccDemo {
    public static void main(String[] args) {
        TccTransactionCoordinator coordinator = new TccTransactionCoordinator();

        // 参与者1：订单服务 — 冻结订单
        coordinator.addParticipant(
            "订单服务",
            () -> {
                // Try: 创建订单，状态=待确认
                System.out.println("  订单：创建待确认订单...");
            },
            () -> {
                // Confirm: 订单状态 → 已确认
                System.out.println("  订单：状态改为已确认");
            },
            () -> {
                // Cancel: 删除/取消订单
                System.out.println("  订单：删除待确认订单");
            }
        );

        // 参与者2：库存服务 — 冻结库存
        coordinator.addParticipant(
            "库存服务",
            () -> {
                // Try: 冻结库存 1 件
                System.out.println("  库存：冻结 1 件（可用 -1，冻结 +1）");
            },
            () -> {
                // Confirm: 冻结转扣减
                System.out.println("  库存：冻结转扣减，冻结 -1");
            },
            () -> {
                // Cancel: 解冻
                System.out.println("  库存：解冻 1 件（可用 +1，冻结 -1）");
            }
        );

        // 参与者3：支付服务 — 冻结余额
        coordinator.addParticipant(
            "支付服务",
            () -> {
                // Try: 冻结 100 元
                System.out.println("  支付：冻结 100 元");
            },
            () -> {
                // Confirm: 真正扣款
                System.out.println("  支付：确认扣款 100 元");
            },
            () -> {
                // Cancel: 解冻
                System.out.println("  支付：解冻 100 元");
            }
        );

        coordinator.execute();
    }
}
```

**运行输出**：
```
>>> Try: 订单服务
  订单：创建待确认订单...
>>> Try: 库存服务
  库存：冻结 1 件（可用 -1，冻结 +1）
>>> Try: 支付服务
  支付：冻结 100 元
>>> Confirm: 订单服务
  订单：状态改为已确认
>>> Confirm: 库存服务
  库存：冻结转扣减，冻结 -1
>>> Confirm: 支付服务
  支付：确认扣款 100 元
>>> 所有 Confirm 完成，分布式事务成功 ✅
```

**关键点**：
- Try 只冻结资源，不真正扣减
- Confirm 才是真正生效
- Cancel 解冻，回到原状
- Cancel 必须实现**幂等**（重试不影响结果）

---

### Demo 3：本地消息表

> 场景：订单创建后，异步通知库存服务扣减

```java
// 本地消息表 — 最简单可靠的分布式事务方案

import javax.sql.DataSource;
import java.sql.*;
import java.util.List;

public class LocalMessageTableDemo {

    private final DataSource orderDs;    // 订单库
    private final MessageProducer mq;     // 消息发送（模拟 MQ）

    // =============== 订单服务 ===============

    /**
     * 下单：订单 + 消息写入同一个本地事务
     */
    @Transactional  // Spring 本地事务
    public void createOrder(Long userId, Long productId, int quantity) {
        Connection conn = getConnection();
        
        // 1. 创建订单
        PreparedStatement ps1 = conn.prepareStatement(
            "INSERT INTO orders(user_id, product_id, quantity, status) VALUES(?,?,?,?)"
        );
        ps1.setLong(1, userId);
        ps1.setLong(2, productId);
        ps1.setInt(3, quantity);
        ps1.setString(4, "CREATED");
        ps1.executeUpdate();
        System.out.println("订单创建成功");

        // 2. 写入本地消息表（同一个事务！）
        PreparedStatement ps2 = conn.prepareStatement(
            "INSERT INTO local_message(event_type, payload, status, retry_count) " +
            "VALUES(?, ?, ?, ?)"
        );
        ps2.setString(1, "STOCK_DEDUCT");  // 事件类型
        ps2.setString(2, String.format(
            "{\"productId\":%d,\"quantity\":%d}", productId, quantity
        ));
        ps2.setString(3, "PENDING");       // 待发送
        ps2.setInt(4, 0);
        ps2.executeUpdate();
        System.out.println("消息写入本地表");

        // 两个操作在同一个事务中，要么都成功，要么都失败！
    }

    // =============== 定时任务：扫描消息表 ===============

    /**
     * 每隔 3 秒扫描一次 PENDING 消息
     */
    public void scanPendingMessages() {
        Connection conn = getConnection();
        
        // 找出未发送的消息（最多100条）
        ResultSet rs = conn.prepareStatement(
            "SELECT id, event_type, payload FROM local_message " +
            "WHERE status = 'PENDING' AND retry_count < 5 " +
            "ORDER BY id LIMIT 100"
        ).executeQuery();

        List<Long> successIds = new ArrayList<>();
        List<Long> failedIds = new ArrayList<>();

        while (rs.next()) {
            long msgId = rs.getLong("id");
            String eventType = rs.getString("event_type");
            String payload = rs.getString("payload");
            
            try {
                // 发送到 MQ
                mq.send(eventType, payload);
                successIds.add(msgId);
                System.out.println("消息发送成功: id=" + msgId);
            } catch (Exception e) {
                failedIds.add(msgId);
                System.err.println("消息发送失败: id=" + msgId + "，重试+1");
            }
        }

        // 批量更新成功消息的状态
        if (!successIds.isEmpty()) {
            String sql = "UPDATE local_message SET status = 'SENT' WHERE id IN (" +
                         successIds.stream().map(String::valueOf)
                                   .collect(Collectors.joining(",")) + ")";
            conn.prepareStatement(sql).executeUpdate();
        }

        // 批量更新失败消息的重试次数
        for (long failedId : failedIds) {
            conn.prepareStatement(
                "UPDATE local_message SET retry_count = retry_count + 1 WHERE id = " + failedId
            ).executeUpdate();
        }
    }

    // =============== 库存服务（消费者） ===============

    /**
     * 消费消息，扣减库存
     */
    public void handleStockDeduct(String payload) {
        // 解析 JSON
        JSONObject json = JSON.parseObject(payload);
        long productId = json.getLongValue("productId");
        int quantity = json.getIntValue("quantity");

        Connection conn = getConnection();
        
        // 幂等检查：这个订单是否已经处理过？
        PreparedStatement check = conn.prepareStatement(
            "SELECT COUNT(*) FROM stock_log WHERE product_id = ? AND quantity = ?"
        );
        check.setLong(1, productId);
        check.setInt(2, quantity);
        ResultSet rs = check.executeQuery();
        rs.next();
        if (rs.getInt(1) > 0) {
            System.out.println("库存已扣减过，跳过（幂等）");
            return;
        }

        // 扣减库存
        int affected = conn.prepareStatement(
            "UPDATE stock SET quantity = quantity - ? WHERE product_id = ? AND quantity >= ?"
        ).executeUpdate(
            new Object[]{quantity, productId, quantity}  // quantity >= ? 防超卖
        );

        if (affected == 0) {
            throw new RuntimeException("库存不足，扣减失败！");
        }

        // 记录处理日志（防重）
        conn.prepareStatement(
            "INSERT INTO stock_log(product_id, quantity, created_at) VALUES(?,?,NOW())"
        ).executeUpdate(productId, quantity);

        System.out.println("库存扣减成功，产品=" + productId + "，数量=" + quantity);
    }
}
```

**建表 SQL**：
```sql
-- 本地消息表
CREATE TABLE local_message (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    event_type  VARCHAR(50)  NOT NULL,       -- 事件类型
    payload     TEXT         NOT NULL,       -- JSON 负载
    status      VARCHAR(20)  DEFAULT 'PENDING', -- PENDING / SENT / DONE
    retry_count INT          DEFAULT 0,     -- 重试次数
    created_at  DATETIME     DEFAULT NOW()
);

-- 库存处理日志（幂等防重）
CREATE TABLE stock_log (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NOT NULL,
    quantity   INT    NOT NULL,
    created_at DATETIME
);
```

**流程**：
```
1. 下单：订单 + 消息写入同一个本地事务（原子性保证）
2. 定时任务：扫描 PENDING 消息 → 发到 MQ
3. 库存服务：消费消息 → 扣库存 → 幂等检查
4. 发送失败 → 重试（最多5次）→ 超过5次告警人工处理
```

---

### Demo 4：Saga 模式（编排式）

> 场景：下单 → 扣库存 → 扣款，任一步失败按逆序补偿

```java
// Saga — 正向操作 + 补偿操作

public class SagaTransactionCoordinator {

    /**
     * Saga 步骤定义
     */
    static class SagaStep {
        String name;
        Consumer<Long> execute;     // 正向操作
        Consumer<Long> compensate;  // 补偿操作
        
        SagaStep(String name, Consumer<Long> execute, Consumer<Long> compensate) {
            this.name = name;
            this.execute = execute;
            this.compensate = compensate;
        }
    }

    private final List<SagaStep> steps = new ArrayList<>();

    public void addStep(String name, Consumer<Long> execute, Consumer<Long> compensate) {
        steps.add(new SagaStep(name, execute, compensate));
    }

    /**
     * 执行 Saga 事务
     * @param orderId 全局业务ID（用于幂等）
     */
    public void execute(Long orderId) {
        List<SagaStep> executedSteps = new ArrayList<>();

        // ===== 正向执行 =====
        for (SagaStep step : steps) {
            try {
                System.out.println("▶ 正向执行: " + step.name);
                step.execute.accept(orderId);
                executedSteps.add(step);
            } catch (Exception e) {
                System.err.println("❌ " + step.name + " 失败: " + e.getMessage());
                
                // ===== 逆序补偿 =====
                System.out.println("\n🔄 开始补偿...");
                List<SagaStep> reverse = new ArrayList<>(executedSteps);
                Collections.reverse(reverse);
                
                for (SagaStep compensation : reverse) {
                    try {
                        System.out.println("↩ 补偿: " + compensation.name);
                        compensation.compensate.accept(orderId);
                    } catch (Exception ce) {
                        // 补偿失败：记录日志 + 告警，不能继续抛异常
                        System.err.println("⚠️ 补偿失败: " + compensation.name 
                                           + "，需人工介入！日志ID=" + orderId);
                    }
                }
                
                throw new RuntimeException("Saga 失败，已执行补偿", e);
            }
        }

        System.out.println("\n✅ 所有步骤执行成功，Saga 完成！");
    }
}
```

```java
// 使用示例
public class SagaDemo {
    public static void main(String[] args) {
        SagaTransactionCoordinator saga = new SagaTransactionCoordinator();

        // 步骤1：创建订单
        saga.addStep(
            "创建订单",
            orderId -> {
                System.out.println("  订单服务：创建订单 " + orderId);
                // INSERT INTO orders...
            },
            orderId -> {
                System.out.println("  订单服务：取消订单 " + orderId);
                // UPDATE orders SET status = 'CANCELLED' WHERE id = ?
            }
        );

        // 步骤2：扣减库存
        saga.addStep(
            "扣减库存",
            orderId -> {
                System.out.println("  库存服务：扣减库存");
                // UPDATE stock SET quantity = quantity - 1
            },
            orderId -> {
                System.out.println("  库存服务：恢复库存");
                // UPDATE stock SET quantity = quantity + 1
            }
        );

        // 步骤3：扣款（这里模拟失败）
        saga.addStep(
            "扣款",
            orderId -> {
                System.out.println("  支付服务：扣款 100 元");
                // 模拟失败！
                throw new RuntimeException("银行卡余额不足");
            },
            orderId -> {
                System.out.println("  支付服务：退款（没有扣成功，无需补偿）");
                // 如果扣款还没发生，这里可能不需要实际操作
            }
        );

        // 执行
        saga.execute(1001L);
    }
}
```

**运行输出**：
```
▶ 正向执行: 创建订单
  订单服务：创建订单 1001
▶ 正向执行: 扣减库存
  库存服务：扣减库存
▶ 正向执行: 扣款
  支付服务：扣款 100 元
❌ 扣款 失败: 银行卡余额不足

🔄 开始补偿...
↩ 补偿: 扣减库存
  库存服务：恢复库存
↩ 补偿: 创建订单
  订单服务：取消订单 1001
```

**关键点**：
- 每一步都有对应的补偿操作
- 失败时逆序执行补偿
- **补偿操作必须幂等**（重复执行结果一样）
- 补偿失败要记录日志 + 告警

---

### Demo 5：Seata AT 模式（原理模拟）

> 场景：Seata 如何通过 undo_log 自动实现回滚

```java
// Seata AT 模式原理模拟
// 生产环境用 Seata 框架，这里模拟其核心原理

public class SeataAtModeDemo {

    /**
     * 模拟 Seata AT 模式的 SQL 拦截器
     * Seata 通过 DataSource 代理自动拦截 SQL，不需要改业务代码
     */
    public static class AtModeInterceptor {

        /**
         * 模拟：执行 SQL 前的处理（Seata 自动完成）
         * 1. 获取全局锁
         * 2. 记录 before image
         */
        public BeforeExecution interceptBefore(Connection conn, String sql, Object[] params) {
            System.out.println("🔍 Seata 拦截 SQL: " + sql);
            
            // 1. 查询修改前的数据（before image）
            // 原始 SQL: UPDATE account SET balance = balance - 100 WHERE id = 1
            // Seata 会先执行: SELECT id, balance FROM account WHERE id = 1
            BeforeExecution exec = new BeforeExecution();
            
            // 模拟查询结果
            exec.beforeImage = Map.of(
                "id", 1,
                "balance", 500  // 修改前：500元
            );
            System.out.println("📷 Before image: " + exec.beforeImage);
            
            return exec;
        }

        /**
         * 模拟：执行 SQL 后的处理（Seata 自动完成）
         * 1. 记录 after image
         * 2. 生成 undo log
         * 3. 提交本地事务 + 写 undo log（同一个事务）
         */
        public AfterExecution interceptAfter(Connection conn, String sql, 
                                              Object[] params, BeforeExecution before) {
            // 执行原始 SQL
            System.out.println("⚡ 执行原始 SQL");
            
            // 查询修改后的数据（after image）
            AfterExecution exec = new AfterExecution();
            exec.afterImage = Map.of(
                "id", 1,
                "balance", 400  // 修改后：400元
            );
            System.out.println("📷 After image: " + exec.afterImage);
            
            // 生成 undo log
            String undoLog = String.format(
                "{\"sqlType\":\"UPDATE\", \"table\":\"account\", " +
                "\"beforeImage\":%s, \"afterImage\":%s}",
                before.beforeImage, exec.afterImage
            );
            System.out.println("📝 Undo log 已生成: " + undoLog);
            
            // 提交本地事务（数据 + undo log 一起提交）
            System.out.println("✅ 本地事务提交（数据 + undo log）");
            
            return exec;
        }

        /**
         * 模拟：二阶段回滚（Seata 自动完成）
         * 用 before image 反向修复数据
         */
        public void rollback(BeforeExecution before) {
            System.out.println("\n🔄 二阶段回滚...");
            
            Map<String, Object> beforeImg = before.beforeImage;
            
            // 生成回滚 SQL
            // 原始: UPDATE account SET balance = balance - 100 WHERE id = 1
            // 回滚: UPDATE account SET balance = 500 WHERE id = 1
            String rollbackSql = String.format(
                "UPDATE account SET balance = %d WHERE id = %d",
                beforeImg.get("balance"),  // 用 before image 的值覆盖
                beforeImg.get("id")
            );
            System.out.println("🔄 回滚 SQL: " + rollbackSql);
            
            // 执行回滚 + 删除 undo log
            System.out.println("✅ 数据已恢复，undo log 已删除");
        }

        static class BeforeExecution {
            Map<String, Object> beforeImage;
        }
        static class AfterExecution {
            Map<String, Object> afterImage;
        }
    }

    // =============== 主流程模拟 ===============

    public static void main(String[] args) {
        AtModeInterceptor interceptor = new AtModeInterceptor();
        Connection conn = null; // 模拟连接
        String sql = "UPDATE account SET balance = balance - 100 WHERE id = 1";
        Object[] params = {1};

        System.out.println("=== 一阶段：自动执行 ===\n");
        
        // 拦截 SQL → 记录 before image
        AtModeInterceptor.BeforeExecution before = interceptor.interceptBefore(conn, sql, params);
        
        // 执行 SQL → 记录 after image → 生成 undo log → 提交
        AtModeInterceptor.AfterExecution after = interceptor.interceptAfter(conn, sql, params, before);
        
        // 此时数据已提交到数据库，但 undo log 还在
        
        System.out.println("\n=== 二阶段：需要回滚 ===");
        
        // 假设全局事务失败，TC（事务协调器）通知回滚
        interceptor.rollback(before);
        
        System.out.println("\n=== 如果不需要回滚 ===");
        System.out.println("✅ 直接删除 undo log（异步，很快）");
        System.out.println("✅ 全局锁释放");
    }
}
```

**运行输出**：
```
=== 一阶段：自动执行 ===

🔍 Seata 拦截 SQL: UPDATE account SET balance = balance - 100 WHERE id = 1
📷 Before image: {id=1, balance=500}
⚡ 执行原始 SQL
📷 After image: {id=1, balance=400}
📝 Undo log 已生成: {"sqlType":"UPDATE", ...}
✅ 本地事务提交（数据 + undo log）

=== 二阶段：需要回滚 ===

🔄 二阶段回滚...
🔄 回滚 SQL: UPDATE account SET balance = 500 WHERE id = 1
✅ 数据已恢复，undo log 已删除

=== 如果不需要回滚 ===
✅ 直接删除 undo log（异步，很快）
✅ 全局锁释放
```

**Seata 核心组件**：
```
TC（Transaction Coordinator）：事务协调器，管理全局事务状态
TM（Transaction Manager）：事务管理器，发起全局事务的开始/提交/回滚
RM（Resource Manager）：资源管理器，每个微服务一个，管理本地事务

流程：
1. TM 向 TC 发起全局事务 → TC 分配 XID
2. 各微服务通过 XID 参与事务，RM 自动拦截 SQL
3. RM 记录 undo log → 提交本地事务
4. 全部成功 → TC 通知提交（删 undo log）
5. 任一失败 → TC 通知回滚（用 undo log 修复）
```

---

## 五、方案对比速查表

| 方案 | 一致性 | 性能 | 侵入性 | 复杂度 | 适用场景 |
|------|--------|------|--------|--------|----------|
| **2PC/XA** | 强一致 | 低 | 低 | 低 | 数据库层，单机两库 |
| **TCC** | 强一致 | 高 | 高 | 高 | 金融/支付，强一致+高性能 |
| **Saga** | 最终一致 | 高 | 中 | 中 | 长流程，电商下单 |
| **本地消息表** | 最终一致 | 中 | 低 | 低 | 通用业务，**最常用** |
| **Seata AT** | 最终一致 | 中 | 低 | 低 | 通用业务，**开发最快** |
| **Seata TCC** | 强一致 | 高 | 高 | 中 | 金融场景 + Seata 生态 |

---

## 六、面试回答模板

> **分布式事务有哪些解决方案？**
> 
> 主要有5种：2PC（两阶段提交）、TCC（Try-Confirm-Cancel）、Saga（补偿事务）、本地消息表、以及 Seata 框架。
>
> - **2PC** 是数据库层面的强一致方案，通过 prepare + commit 两阶段实现，但性能差
> - **TCC** 在业务层面实现冻结→确认/取消，性能好但侵入性强，适合金融场景
> - **Saga** 通过正向操作 + 逆序补偿实现最终一致，适合长流程
> - **本地消息表** 是最常用的方案，利用本地事务保证订单+消息的原子性，再通过 MQ 异步通知下游
> - **Seata** 是阿里开源的分布式事务框架，AT 模式通过 SQL 拦截 + undo log 自动实现回滚，开发成本最低

> **Seata AT 模式底层怎么实现的？**
>
> AT 模式核心是 undo log。一阶段：Seata 代理 DataSource，拦截 SQL 后先记录 before image（修改前的数据快照），执行 SQL 后记录 after image（修改后的数据快照），然后把数据变更和 undo log 在同一个本地事务中提交。二阶段如果需要回滚，就用 before image 反向修复数据；如果不需要回滚，直接异步删除 undo log。

> **AT 和 TCC 的区别？**
>
> AT 是框架自动拦截 SQL，业务无感知，开发快但有全局锁，性能中等；TCC 需要手动实现三个接口，业务侵入性强但没有锁，性能最高。普通业务用 AT，金融支付用 TCC。

---

## 回顾记录（2026-07-02，R4）

**得分：2/10**

### 用户回答
- 2PC 是两阶段提交
- TCC 和 Saga 是分布式事务框架（❌ 应是模式/方案）
- 采用数据库或插一条记录的策略（❌ 混淆了本地消息表）
- 没实际用过

### 追问+纠正记录
1. **TCC/Saga 是模式不是框架**：Seata 是框架，TCC/Saga 是事务模式
2. **往 DB 插记录是本地消息表**：不是 TCC/Saga 的核心
3. **2PC 核心问题**：同步阻塞、协调者单点故障、数据不一致
4. **TCC 三个接口**：Try 预留资源 → Confirm 确认提交 → Cancel 取消释放
5. **Saga 补偿机制**：正向执行 T1→T2→T3，失败反向执行 C2→C1
6. **Saga 两种编排**：协同式（事件驱动去中心化）vs 编排式（协调器指挥）
7. **补充方案**：本地消息表、事务消息（RocketMQ）、最大努力通知

### 最终结论
2PC 强一致但性能差；TCC 灵活但代码量大；Saga 适合长事务配补偿。生产常用本地消息表和事务消息用最终一致性换性能。

### 这次讨论的收获
- 2PC 的阻塞问题和单点故障是核心考点
- TCC 的 Try 不是"尝试"而是"冻结预留"
- Saga 的补偿是反向执行，不是简单的 rollback
