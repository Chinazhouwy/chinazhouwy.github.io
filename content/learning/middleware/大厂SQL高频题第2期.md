---
title: "大厂面试SQL高频题 第2期"
date: "2026-07-06"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "大厂面试SQL高频题 第2期"
tags:
---

# 大厂面试SQL高频题 第2期

> **来源**: 小红书
> **链接**: http://xhslink.com/o/2nM6BZAjLwG
> **标签**: #SQL #大厂笔试 #后端开发 #数据开发 #面试真题

---

## 题A · 每科最高分学员（含并列）

**出题频率**：字节26次 / 腾讯8次 / 快手6次 / 京东5次 / 美团4次

### 题意
成绩表（subject, student_name, score），求每科最高分学员，要求**包含并列**。

### 错误解法 ❌

```sql
SELECT subject, student_name, MAX(score)
FROM score_table
GROUP BY subject;
```

**问题**：`MAX + GROUP BY` 拿到的 `student_name` 是分组后任意一行的值，**不一定是最高分对应的学生**。MySQL 的 `ONLY_FULL_GROUP_BY` 模式下甚至直接报错。

### 正确解法 ✅ `DENSE_RANK` 窗口函数

```sql
SELECT subject, student_name, score
FROM (
  SELECT *,
    DENSE_RANK() OVER (PARTITION BY subject ORDER BY score DESC) AS rk
  FROM score_table
) t
WHERE rk = 1
ORDER BY subject;
```

### 为什么用 DENSE_RANK 而不是 ROW_NUMBER？

| 函数 | 并列处理 | 适用场景 |
|------|---------|---------|
| `ROW_NUMBER()` | 同分随机排号，不保留并列 | 唯一排名场景 |
| `RANK()` | 同分并列但跳号（1,1,3） | 竞赛排名 |
| **`DENSE_RANK()`** | **同分并列不跳号（1,1,2）** | ✅ 本题场景 |

假设数据：
| subject | student_name | score |
|---------|-------------|-------|
| 数学 | 张三 | 95 |
| 数学 | 李四 | 95 |
| 数学 | 王五 | 90 |

- `ROW_NUMBER`：张三=1, 李四=2 → 漏掉李四 ❌
- `RANK`：张三=1, 李四=1, 王五=3 ✅ 但跳号
- `DENSE_RANK`：张三=1, 李四=1, 王五=2 ✅

### 拓展：TopN 通用模板

```sql
-- 每科前三（含并列）
SELECT subject, student_name, score
FROM (
  SELECT *,
    DENSE_RANK() OVER (PARTITION BY subject ORDER BY score DESC) AS rk
  FROM score_table
) t
WHERE rk <= 3;
```

---

## 题B · 找重复工号

**出题频率**：字节55次 / 美团31次 / 京东23次 / 腾讯15次 / 快手10次

### 题意
教师表（teacher_no, name, ...），找出出现 **≥2次** 的工号。

### 错误解法 ❌

```sql
SELECT teacher_no
FROM teacher_table
WHERE COUNT(*) > 1
GROUP BY teacher_no;
```

**报错**：`WHERE` 子句在聚合操作（`GROUP BY`）**之前**执行，此时 `COUNT(*)` 还未计算，直接报聚合函数不能用于WHERE的错误。

### 正确解法 ✅ `GROUP BY + HAVING COUNT`

```sql
SELECT teacher_no, COUNT(*) AS cnt
FROM teacher_table
GROUP BY teacher_no
HAVING COUNT(*) > 1;
```

### 执行顺序理解

```
FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```

- `WHERE`：在分组前过滤行 — 此时还不知道 COUNT
- `HAVING`：在分组后过滤组 — 此时 COUNT 已计算完毕

### 通用模板：找重复值

```sql
-- 找重复手机号
SELECT phone, COUNT(*) AS cnt
FROM user_table
GROUP BY phone
HAVING COUNT(*) > 1;

-- 找重复邮箱（出现≥3次）
SELECT email, COUNT(*) AS cnt
FROM user_table
GROUP BY email
HAVING COUNT(*) >= 3;

-- 找重复SKU
SELECT sku_id, COUNT(*) AS cnt
FROM order_item
GROUP BY sku_id
HAVING COUNT(*) > 1;
```

### 进阶：找重复并取明细

```sql
-- 找出所有重复的工号及其完整信息
SELECT t1.*
FROM teacher_table t1
INNER JOIN (
  SELECT teacher_no
  FROM teacher_table
  GROUP BY teacher_no
  HAVING COUNT(*) > 1
) t2 ON t1.teacher_no = t2.teacher_no
ORDER BY t1.teacher_no;
```

---

## 🎯 总结

| 场景 | 套路 | 关键字 |
|------|------|--------|
| 分组取Top1（含并列） | 窗口函数 | `DENSE_RANK + PARTITION BY` |
| 找重复值 | 分组聚合 | `GROUP BY + HAVING COUNT` |
| 分组TopN | 窗口函数 + WHERE过滤 | `DENSE_RANK + WHERE rk <= N` |
| 找重复值明细 | 子查询+JOIN | `HAVING COUNT > 1` + INNER JOIN |