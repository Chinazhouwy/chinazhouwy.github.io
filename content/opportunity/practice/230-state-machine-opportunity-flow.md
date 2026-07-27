---
schema_version: "1"
question_id: "230"
question: "商机创建、分配、跟进、转化和关闭如何用状态模式实现？如何防非法流转、重复消息和状态回退？"
date: "2026-07-27"
sources:
  - "content/about/about-me.md"
  - "content/columns/design-patterns-essence.md"
score: "4/10"
round: "R0"
next_review: "2026-07-28"
session_id: "unknown"
status: "completed"
title: "第230题：商机状态机与防非法流转（简历专项 04）"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "商机状态模式实现、防非法流转和消息去重"
tags:
  - "状态机"
  - "设计模式"
  - "MQ"
---

# 第230题：商机状态机与防非法流转（简历专项 04）

## 题目
商机创建、分配、跟进、转化和关闭如何用状态模式实现？如何防非法流转、重复消息和状态回退？

## 用户原始回答
> 状态通过一个接口实现，定义多个枚举，依次往下推进。阶段之间允许跨级，每个阶段校验前会看状态条件是否满足。推进时只能从某几个状态往前推，不能从其他状态再推。消息重复消费用 messageId 缓存一段时间防重，业务组件根据状态控制。

## 评分与扣分点

**评分：4/10**

- 状态枚举 + 接口推进的思路正确 ✓
- 状态校验前置、白名单跳转意识有 ✓
- 消息去重用 messageId 思路对 ✓
- 没列出具体状态：创建→分配→跟进→转化→关闭
- 缺 Java 落地代码（状态模式怎么编码）
- 防回退只提了方向，没说"终态不可再转"的硬约束
- 乐观锁/版本号防并发覆盖没提

## 完整答案

### 状态流转图

```
创建 ──→ 已分配 ──→ 跟进中 ──→ 已转化
  │                              │
  └──────────→ 已关闭 ←──────────┘
```

### Java 状态模式实现

```java
public enum OpportunityState {
    CREATED, ASSIGNED, FOLLOWING, CONVERTED, CLOSED;

    static {
        CREATED.allowed = Set.of(ASSIGNED, CLOSED);
        ASSIGNED.allowed = Set.of(FOLLOWING, CLOSED);
        FOLLOWING.allowed = Set.of(CONVERTED, CLOSED);
        CONVERTED.allowed = Set.of();
        CLOSED.allowed = Set.of();
    }

    private Set<OpportunityState> allowed;

    public void checkTransition(OpportunityState target) {
        if (!allowed.contains(target)) {
            throw new IllegalStateException(
                "不允许从 " + this + " 跳转到 " + target);
        }
    }
}
```

### 三重防护

| 防护层 | 怎么做 | 防什么 |
|--------|--------|--------|
| 状态机校验 | `checkTransition()` 白名单 | 非法流转、状态回退 |
| 消息去重 | messageId → Redis SETNX，TTL 5分钟 | MQ 重复消费 |
| 业务幂等 | 唯一键 + 乐观锁版本号 | 并发更新覆盖 |

## 面试回答模板

> "商机状态用枚举 + 白名单控制流转，每个状态只允许跳到特定目标状态。CREATED 只到 ASSIGNED 或 CLOSED，终态（CONVERTED/CLOSED）不可再转。防重复消息用 messageId 在 Redis 里做短期去重，业务侧用乐观锁版本号防止并发覆盖。三重防护保证状态机不会出现非法流转、重复处理和并发冲突。"
