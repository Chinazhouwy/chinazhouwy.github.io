---
schema_version: 1
question_id: 53
question: "购物车系统怎么设计？未登录用户跨设备怎么同步？"
date: 2026-07-05
sources:
  - tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md
  - tiktok/2026-05-27-tiktok-ecommerce-backend-round1.md
score: "5/10"
round: R0
next_review: 2026-07-06
session_id: unknown
status: completed
---
## 第53题 · 系统设计 · 购物车系统怎么设计？未登录用户跨设备怎么同步？

**题目**：购物车系统怎么设计？未登录用户跨设备怎么同步？

### 用户回答

> 存redis, 异步存入到数据库里；先存本地，等联网后和当前的记录进行合并。

**得分：5/10**

扣分点：
- "存Redis异步存DB"说对了，但没展开数据结构设计、过期策略（-2）
- "先存本地再合并"方向对，但没说合并策略、未登录用户识别方式（-2）
- 没提到购物车容量限制、并发库存校验、已登录用户的合并逻辑（-1）

### 最终修正版

#### 整体架构

```
┌─────────────────────────────────────────────────┐
│                   客户端                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ 已登录    │    │ 未登录   │    │  离线     │  │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘  │
└───────┼───────────────┼───────────────┼─────────┘
        │               │               │
        ▼               ▼               ▼
┌─────────────────────────────────────────────────┐
│                 购物车服务                        │
│  ┌─────────────────────────────────────────┐   │
│  │           Redis 缓存层                    │   │
│  │  - 已登录：user_id:{sku_id} → 数量       │   │
│  │  - 未登录：device_id:{sku_id} → 数量     │   │
│  └─────────────────────────────────────────┘   │
│                      │                          │
│                      ▼ 异步/定时同步             │
│  ┌─────────────────────────────────────────┐   │
│  │           MySQL 持久层                    │   │
│  │  cart_item 表                            │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

#### Redis Hash 存储方案

```
Key: cart:{user_id}  或  cart:anon:{device_id}
Field: {sku_id}
Value: JSON {quantity, add_time, selected}

为什么用 Hash：
- 批量查询快：HGETALL cart:123 一次拿全部
- 内存效率高：比多个 String 省 30%+
- 支持部分更新：HSET cart:123 sku_001 '{"quantity":2}'
```

#### MySQL 表结构

```sql
CREATE TABLE cart_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    device_id VARCHAR(64) COMMENT '未登录用户的设备标识',
    sku_id BIGINT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    selected TINYINT DEFAULT 1 COMMENT '是否选中',
    add_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_sku (user_id, sku_id),
    INDEX idx_device (device_id)
);
```

#### 未登录用户的识别与合并

识别方式：
1. 设备ID：APP 端生成 UUID 存本地，每次请求带上
2. Cookie：Web 端写入 device_id Cookie
3. 设备指纹：浏览器指纹 + User-Agent 拼接

登录时合并流程：
1. 读取本地购物车（device_id 关联）
2. 读取已登录用户的购物车
3. 合并策略：SKU 相同数量相加，不同直接加入
4. 超过容量限制：按添加时间淘汰旧的
5. 写入 Redis + DB

```java
public void mergeCart(Long userId, String deviceId) {
    Map<Long, CartItem> localCart = getCartByDevice(deviceId);
    Map<Long, CartItem> userCart = getCartByUser(userId);
    
    for (Map.Entry<Long, CartItem> entry : localCart.entrySet()) {
        Long skuId = entry.getKey();
        CartItem localItem = entry.getValue();
        
        if (userCart.containsKey(skuId)) {
            CartItem userItem = userCart.get(skuId);
            userItem.setQuantity(
                Math.min(userItem.getQuantity() + localItem.getQuantity(), 
                        MAX_QUANTITY_PER_SKU)
            );
        } else {
            userCart.put(skuId, localItem);
        }
    }
    
    if (userCart.size() > MAX_CART_SIZE) {
        evictOldest(userCart, MAX_CART_SIZE);
    }
    
    saveToRedis(userId, userCart);
    saveToDB(userId, userCart);
    clearLocalCart(deviceId);
}
```

#### 容量限制

| 维度 | 限制 | 原因 |
|------|------|------|
| SKU 数量 | 50-100 个 | 前端展示、内存压力 |
| 单 SKU 数量 | 99 件 | 防刷、库存限制 |

#### 购物车 ≠ 下单

购物车只记录"想买什么"，不扣库存。下单时才校验库存、锁定库存。

### 复习骨架

- 存储：Redis（Hash）缓存 + MySQL 持久化，异步同步
- 未登录：设备ID识别，本地存储，登录时合并
- 合并策略：SKU 相同数量相加，不同直接加入，超容量按时间淘汰
- 购物车 ≠ 下单：购物车不扣库存，下单时才校验
- 容量限制：SKU 数量上限 + 单 SKU 数量上限
