---
schema_version: "1"
question_id: "229"
question: "RBAC + AOP + SpEL 动态数据权限怎么设计？组织层级、行级范围、表达式安全和 SQL 注入点如何处理？"
date: "2026-07-27"
sources:
  - "content/about/about-me.md"
  - "content/opportunity/practice/27-spring-aop-proxy-transaction.md"
score: "3/10"
round: "R0"
next_review: "2026-07-28"
session_id: "unknown"
status: "completed"
title: "第229题：RBAC + AOP + SpEL 权限设计（简历专项 03）"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "RBAC角色权限 + AOP切面 + SpEL动态表达式"
tags:
  - "权限系统"
  - "RBAC"
  - "AOP"
  - "Spring"
---

# 第229题：RBAC + AOP + SpEL 权限设计（简历专项 03）

## 题目
RBAC + AOP + SpEL 动态数据权限怎么设计？组织层级、行级范围、表达式安全和 SQL 注入点如何处理？

## 用户原始回答
> RBAC 不知道是什么。AOP 无非就是切面去拿用户的权限，根据 token 获取用户权限。SpEL（用户不确定发音）就是 Spring 表达式，放缓存或数据库里，表达式决定了它向哪个页面、有哪些菜单权限。

## 评分与扣分点

**评分：3/10**

- 理解了 AOP 权限拦截的基本思路（token → 权限 → 拦截）
- 理解了 SpEL 配置化权限的核心思想（表达式存 DB/缓存）
- 不知道 RBAC（Role-Based Access Control）这个基础概念
- 不会 SpEL 正确发音（Spring Expression Language）
- 没有涉及数据权限（行级）、组织层级、表达式安全和 SQL 注入防护

## 完整答案

### RBAC（Role-Based Access Control）

用户 → 角色 → 权限 三层模型：

```
用户（张三）──→ 角色（业务员）──→ 权限（查看自己的商机、创建投保单）
                                  权限（不能看别人的商机、不能审批）
```

### AOP 拦截流程

```
请求 → @PreAuthorize 切面 → 解析 Token → 查用户角色 → 查权限表达式
                                                           │
                                             SpEL 表达式评估（true/false）
                                                           │
                                              通过 → 执行方法
                                              拒绝 → 403
```

### SpEL 动态权限表达式

```java
// 存数据库的权限表达式示例
@PreAuthorize("@permissionEvaluator.check(#userId, 'SALES_OPPORTUNITY:VIEW')")
public List<Opportunity> listOpportunities(Long userId) { ... }

// 行级数据权限：只能看自己所属组织的数据
@PreAuthorize("hasRole('SALES') and #orgId == authentication.principal.orgId")
public List<Customer> listCustomers(Long orgId) { ... }

// 组织层级：部门经理看本部门及下属部门
@PreAuthorize("@orgHierarchy.hasAccess(#deptId, authentication.principal)")
public Report viewReport(Long deptId) { ... }
```

### 安全保障

| 风险点 | 防护 |
|--------|------|
| SpEL 表达式注入 | 表达式预编译 + 白名单校验，拒绝动态拼接 |
| SQL 注入（行级过滤） | 参数化查询，行级条件通过 MyBatis 拦截器追加，不拼接用户输入 |
| 组织层级越权 | 服务端计算组织树，不从客户端传层级范围 |

## 面试回答模板

> 我们用 RBAC 模型：用户绑定角色，角色绑定权限表达式。AOP 切面统一拦截请求，从 Token 解析用户身份后，用 SpEL 评估权限表达式——表达式存在数据库，支持动态配置。比如"业务员只能看自己名下商机"就是一条 SpEL 规则。数据权限通过 MyBatis 拦截器追加行级过滤条件，参数化查询防注入。

## GPT 纠错 / 补充

- RBAC = Role-Based Access Control，用户说的"根据 token 拿用户权限"就是它的落地形式
- SpEL = Spring Expression Language（不是"SPR表E"）
- 用户对 AOP + SpEL 配置化的理解方向正确，只是缺少术语和结构化表达
