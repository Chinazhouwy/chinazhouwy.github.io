---
title: "SQL窗口函数，看这一篇就够啦"
date: 2026-09-20
domain: "学习"
area: "数据与中间件"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "按图文介绍 SQL 窗口函数的语法、函数类别、窗口框架与分析场景。"
tags:
  - SQL
  - 窗口函数
  - 数据分析
source: "微信公众号「数据分析看Jason」"
source_url: "https://mp.weixin.qq.com/s/iTpohSM1wb45jjXKUC5WKg"
published_at: "2026-09-20 11:03:46 +08:00"
---

> 本文按原图顺序转写，17 张原图均保留在配套目录。视觉转写中的少数模糊字句已标为 `[不确定]`，以原图为准。

#### 原图 01

![原图 01](./2026-09-20-sql-window-functions-images/01.png)

备忘录

SQL窗口函数

全流程

存一下吧

很难找全了

---

#### 原图 02

![原图 02](./2026-09-20-sql-window-functions-images/02.jpg)

SQL 窗口函数用法总结

一、什么是SQL窗口函数？

SQL窗口函数，也称为分析函数，是一种强大的工具，用于在SQL查询中进行复杂的数据分析和转换。
这些函数允许我们在不改变查询返回的行数的情况下，对数据集的子集执行计算。窗口函数的核心是
`OVER()` 子句，它定义了函数操作的数据窗口。

1、基本语法

代码块

```sql
1  function_name([expression]) OVER (
2      [PARTITION BY column1, column2, ...]
3      [ORDER BY column1, column2, ...]
4      [ROWS/RANGE BETWEEN start AND end]
5  )
```

WINDOW FUNCTIONS

AGGREGATE

- AVG()
- MAX()
- MIN()
- SUM()
- COUNT()

RANKING

- ROW_NUMBER()
- RANK()
- DENSE_RANK()
- PERCENT_RANK()
- NTILE()

VALUE

- LAG()
- LEAD()
- FIRST_VALUE()
- LAST_VALUE()
- NTH_VALUE()

Current Row

Unbounded Preceding

Unbounded Following

PARTITION BY

```sql
SELECT order_id, cus_id, cost,
SUM(cost) OVER (PARTITION BY cus_id) AS sum_cost
FROM orders;
```

| order_id | cus_id | cost   | sum_cost |
|----------|--------|--------|----------|
| 107      | 1      | 200.00 | 376.25   |
| 109      | 1      | 75.50  | 376.25   |
| 111      | 1      | 100.75 | 376.25   |
| 106      | 2      | 150.00 | 300.00   |
| 108      | 2      | 150.00 | 300.00   |
| 105      | 4      | 300.00 | 400.00   |
| 110      | 4      | 100.00 | 400.00   |

ORDER BY

```sql
SELECT order_id, cus_id, cost,
SUM(cost) OVER (PARTITION BY cus_id ORDER BY cost ASC)
AS cumulative_cost
FROM orders;
```

| order_id | cus_id | cost   | cumulative_cost |
|----------|--------|--------|-----------------|
| 109      | 1      | 75.50  | 75.50           |
| 111      | 1      | 100.75 | 176.25          |
| 107      | 1      | 200.00 | 376.25          |
| 106      | 2      | 150.00 | 150.00          |
| 108      | 2      | 150.00 | 300.00          |
| 110      | 4      | 100.00 | 100.00          |
| 105      | 4      | 300.00 | 400.00          |

---

#### 原图 03

![原图 03](./2026-09-20-sql-window-functions-images/03.jpg)

2、关键组成部分：

• 功能：该做什么计算
• 排序顺序：每个分区内的排序顺序
• 划分方式：如何分组行（比如GROUP BY）
• 框架：计算中应包含哪些行

二、窗口功能类别

1. 排名函数　　　　　　　　　2. 聚合函数

为分区内的行分配排名或行号。　　在一行窗口内进行计算。

3. 偏移函数　　　　　　　　　4. 统计函数

相对于当前行的其他行的访问值。　计算百分位数、分布和统计指标。

让我们用实际例子来探讨每个类别。

1、排名函数

--ROW_NUMBER ()　　　　　　　　　为分区内的每一行分配唯一的顺序号。

代码块

```text
1    -- Basic row numbering
2    SELECT
3        employee_name,
4        department,
5        salary,
6        ROW_NUMBER() OVER (ORDER BY salary DESC) as overall_rank,
7        ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as
     dept_rank
8    FROM employees;
9
10   -- Result:
11   -- employee_name | department | salary | overall_rank | dept_rank
12   -- Alice Johnson | Engineering | 120000 | 1 | 1
13   -- Bob Smith     | Engineering | 115000 | 2 | 2
14   -- Carol Davis   | Marketing   | 110000 | 3 | 1
15   -- David Wilson  | Marketing   | 105000 | 4 | 2
```

--RANK () 和 DENSE_RANK ()

在排名中处理平局时要有不同的处理方式。

代码块

```text
1    -- Compare ranking functions with ties
```

---

#### 原图 04

![原图 04](./2026-09-20-sql-window-functions-images/04.jpg)

--RANK () 和 DENSE_RANK ()　　在排名中处理平局时要有不同的处理方式。

代码块

```text
1   -- Compare ranking functions with ties
2   SELECT
3       employee_name,
4       salary,
5       ROW_NUMBER() OVER (ORDER BY salary DESC) as row_num,
6       RANK() OVER (ORDER BY salary DESC) as rank_with_gaps,
7       DENSE_RANK() OVER (ORDER BY salary DESC) as dense_rank
8   FROM employees;
9
10  -- Sample data with ties:
11  -- employee_name | salary | row_num | rank_with_gaps | dense_rank
12  -- Alice         | 120000 | 1       | 1              | 1
13  -- Bob           | 115000 | 2       | 2              | 2
14  -- Carol         | 115000 | 3       | 2              | 2
15  -- David         | 110000 | 4       | 4              | 3
16  -- Eve           | 110000 | 5       | 4              | 3
17  -- Frank         | 105000 | 6       | 6              | 4
```

何时使用哪种：

• ROW_NUMBER () : 需要唯一的连续编号（[不确定：OCR 识别为“分码”]）

• 等级 () : 传统排名，[不确定：OCR 识别为“并签后有空档”]

• DENSE_RANK () : [不确定：OCR 识别为“无缺席排名（排行榜）”]

--NTILE ()　　将行划分为指定数量的大致相等组。

代码块

```text
1   -- Quartile analysis
2   SELECT
3       employee_name,
4       salary,
5       NTILE(4) OVER (ORDER BY salary) as salary_quartile,
6       NTILE(10) OVER (ORDER BY salary) as salary_decile
7   FROM employees;
8
9   -- Use for customer segmentation
10  SELECT
11      customer_id,
12      total_lifetime_value,
13      NTILE(5) OVER (ORDER BY total_lifetime_value DESC) as value_segment,
14      CASE NTILE(5) OVER (ORDER BY total_lifetime_value DESC)
```

---

#### 原图 05

![原图 05](./2026-09-20-sql-window-functions-images/05.jpg)

• 等级（）：传统排名，[不确定：OCR 识别为“并签后有空档”]
• DENSE_RANK（）：[不确定：OCR 识别为“无缺席排名（排行榜）”]

--NTILE（）　　　　　　　　　将行划分为指定数量的大致相等组。

代码块

```text
1    -- Quartile analysis
2    SELECT
3        employee_name,
4        salary,
5        NTILE(4) OVER (ORDER BY salary) as salary_quartile,
6        NTILE(10) OVER (ORDER BY salary) as salary_decile
7    FROM employees;
8
9    -- Use for customer segmentation
10   SELECT
11       customer_id,
12       total_lifetime_value,
13       NTILE(5) OVER (ORDER BY total_lifetime_value DESC) as value_segment,
14       CASE NTILE(5) OVER (ORDER BY total_lifetime_value DESC)
15           WHEN 1 THEN 'VIP'
16           WHEN 2 THEN 'High Value'
17           WHEN 3 THEN 'Medium Value'
18           WHEN 4 THEN 'Low Value'
19           ELSE 'Entry Level'
20       END as segment_name
21   FROM customer_metrics;
```

2、聚合窗口函数

--总计

计算累计总和、平均值及其他总量。

代码块

```text
1    -- Running total of sales
2    SELECT
3        order_date,
4        daily_sales,
5        SUM(daily_sales) OVER (
6            ORDER BY order_date
7            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
8        ) as running_total,
9        -- Simplified syntax (same result)
```

---

#### 原图 06

![原图 06](./2026-09-20-sql-window-functions-images/06.jpg)

```text
10    SUM(daily_sales) OVER (ORDER BY order_date) as running_total_simple
11 FROM daily_sales_summary
12 ORDER BY order_date;
13
14 -- Result:
15 -- order_date | daily_sales | running_total
16 -- 2024-01-01 | 1000       | 1000
17 -- 2024-01-02 | 1500       | 2500
18 -- 2024-01-03 | 1200       | 3700
19 -- 2024-01-04 | 1800       | 5500
```

--移动平均线

计算行的滑动窗口内的平均值。

代码块

```text
1  -- 7-day moving average
2  SELECT
3      order_date,
4      daily_sales,
5      AVG(daily_sales) OVER (
6          ORDER BY order_date
7          ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
8      ) as moving_avg_7_day,
9      -- 30-day moving average
10     AVG(daily_sales) OVER (
11         ORDER BY order_date
12         ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
13     ) as moving_avg_30_day
14 FROM daily_sales_summary
15 ORDER BY order_date;
```

--占总额的百分比

计算每行代表总数的多少部分。

代码块

```text
1  -- Sales by region as percentage of total
2  SELECT
3      region,
4      sales_amount,
5      -- Percentage of total sales
6      ROUND(
7          sales_amount * 100.0 / SUM(sales_amount) OVER (),
```

---

#### 原图 07

![原图 07](./2026-09-20-sql-window-functions-images/07.jpg)

```sql
        2
    ) as pct_of_total,
    -- Cumulative percentage
    ROUND(
        SUM(sales_amount) OVER (ORDER BY sales_amount DESC) * 100.0 /
        SUM(sales_amount) OVER (),
        2
    ) as cumulative_pct
FROM regional_sales
ORDER BY sales_amount DESC;
```

--按组的聚合

在分区内进行计算。

代码块

```sql
-- Department statistics with individual employee data
SELECT
    employee_name,
    department,
    salary,
    -- Department-level aggregates
    COUNT(*) OVER (PARTITION BY department) as dept_employee_count,
    AVG(salary) OVER (PARTITION BY department) as dept_avg_salary,
    MAX(salary) OVER (PARTITION BY department) as dept_max_salary,
    MIN(salary) OVER (PARTITION BY department) as dept_min_salary,
    -- Individual vs department comparison
    salary - AVG(salary) OVER (PARTITION BY department) as salary_vs_dept_avg,
    ROUND(
        salary * 100.0 / SUM(salary) OVER (PARTITION BY department),
        2
    ) as pct_of_dept_payroll
FROM employees
ORDER BY department, salary DESC;
```

3、偏移函数

--LAG () 和 LEAD ()

访问前一行或下一行的值。

代码块

```sql
-- Month-over-month growth analysis
SELECT
```

---

#### 原图 08

![原图 08](./2026-09-20-sql-window-functions-images/08.jpg)

```text
3    month,
4    revenue,
5    LAG(revenue) OVER (ORDER BY month) as prev_month_revenue,
6    revenue - LAG(revenue) OVER (ORDER BY month) as month_over_month_change,
7    ROUND(
8        (revenue - LAG(revenue) OVER (ORDER BY month)) * 100.0 /
9        LAG(revenue) OVER (ORDER BY month),
10       2
11   ) as mom_growth_pct,
12   -- Look ahead to next month
13   LEAD(revenue) OVER (ORDER BY month) as next_month_revenue
14 FROM monthly_revenue
15 ORDER BY month;
16
17 -- Customer order patterns
18 SELECT
19     customer_id,
20     order_date,
21     order_amount,
22     -- Days since last order
23     order_date - LAG(order_date) OVER (
24         PARTITION BY customer_id
25         ORDER BY order_date
26     ) as days_since_last_order,
27     -- Order amount trends
28     order_amount - LAG(order_amount) OVER (
29         PARTITION BY customer_id
30         ORDER BY order_date
31     ) as amount_change_from_last_order
32 FROM orders
33 ORDER BY customer_id, order_date;
```

--FIRST_VALUE () 和 LAST_VALUE ()

获取窗口中的第一个或最后一个数值。

代码块

```text
1    -- Compare each employee's salary to highest and lowest in department
2    SELECT
3        employee_name,
4        department,
5        salary,
6        FIRST_VALUE(salary) OVER (
7            PARTITION BY department
8            ORDER BY salary DESC
9            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
```

---

#### 原图 09

![原图 09](./2026-09-20-sql-window-functions-images/09.jpg)

```text
10        ) as highest_salary_in_dept,
11        LAST_VALUE(salary) OVER (
12            PARTITION BY department
13            ORDER BY salary DESC
14            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
15        ) as lowest_salary_in_dept,
16        -- Performance vs department extremes
17        salary - FIRST_VALUE(salary) OVER (
18            PARTITION BY department
19            ORDER BY salary DESC
20            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
21        ) as gap_from_highest
22    FROM employees
23    ORDER BY department, salary DESC;
```

重要：始终用 LAST_VALUE ( ) 指定框架子句，以避免意外结果。

--NTH_VALUE ()

在窗口中获得第N个值。

代码块

```text
1   -- Compare to 2nd and 3rd highest performersSELECT
2       employee_name,
3       department,
4       salary,
5       NTH_VALUE(salary, 2) OVER (PARTITION BY department
6           ORDER BY salary DESCROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as second_highest_salary,
7       NTH_VALUE(salary, 3) OVER (PARTITION BY department
8           ORDER BY salary DESCROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as third_highest_salary
9   FROM employees
10  ORDER BY department, salary DESC;
```

4、统计函数

--百分位数

计算百分位排名和数值。

代码块

```text
1   -- Salary percentile analysis
2   SELECT
```

---

#### 原图 10

![原图 10](./2026-09-20-sql-window-functions-images/10.jpg)

```text
3    employee_name,
4    department,
5    salary,
6    -- What percentile is this salary?
7    PERCENT_RANK() OVER (ORDER BY salary) as percentile_rank,
8    PERCENT_RANK() OVER (PARTITION BY department ORDER BY salary) as
     dept_percentile_rank,
9    -- Cumulative distribution
10   CUME_DIST() OVER (ORDER BY salary) as cumulative_distribution,
11   -- Convert to percentage
12   ROUND(PERCENT_RANK() OVER (ORDER BY salary) * 100, 1) as salary_percentile
13   FROM employees
14   ORDER BY salary DESC;

16   -- Find specific percentile values
17   SELECT DISTINCT
18       department,
19       PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY salary) OVER (PARTITION BY
     department) as q1_salary,
20       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) OVER (PARTITION BY
     department) as median_salary,
21       PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY salary) OVER (PARTITION BY
     department) as q3_salary,
22       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY salary) OVER (PARTITION BY
     department) as p90_salary
23   FROM employees;
```

5、高级窗框规格

窗口框架精确定义了计算中应包含哪些行。

--帧语法

代码块

```text
1    -- Frame options:
2    ROWS BETWEEN start AND end
3    RANGE BETWEEN start AND end
4
5    -- Start and end options:
6    -- UNBOUNDED PRECEDING - From the beginning of partition
7    -- n PRECEDING - n rows before current row
8    -- CURRENT ROW - The current row
9    -- n FOLLOWING - n rows after current row
10   -- UNBOUNDED FOLLOWING - To the end of partition
```

---

#### 原图 11

![原图 11](./2026-09-20-sql-window-functions-images/11.jpg)

--实用框架示例

代码块

```text
1    -- Different moving average windows
2    SELECT
3        order_date,
4        daily_sales,
5        -- Last 7 days including today
6        AVG(daily_sales) OVER (
7            ORDER BY order_date
8            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
9        ) as avg_last_7_days,
10       -- Centered 7-day average (3 before, current, 3 after)
11       AVG(daily_sales) OVER (
12           ORDER BY order_date
13           ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING
14       ) as centered_7_day_avg,
15       -- Next 5 days (excluding current)
16       AVG(daily_sales) OVER (
17           ORDER BY order_date
18           ROWS BETWEEN 1 FOLLOWING AND 5 FOLLOWING
19       ) as avg_next_5_days
20   FROM daily_sales_summary
21   ORDER BY order_date;
```

--范围与行数

代码块

```text
1    -- Sample data with duplicate dates
2    -- order_date | amount
3    -- 2024-01-01 | 100
4    -- 2024-01-01 | 150
5    -- 2024-01-02 | 200
6    -- 2024-01-02 | 120
7    -- 2024-01-03 | 180
8
9    -- ROWS: Counts physical rows
10   SELECT
11       order_date,
12       amount,
13       SUM(amount) OVER (
14           ORDER BY order_date
15           ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
16       ) as sum_rows
```

---

#### 原图 12

![原图 12](./2026-09-20-sql-window-functions-images/12.jpg)

```sql
17 FROM orders;

19 -- RANGE: Groups by value (all rows with same order_date)
20 SELECT
21     order_date,
22     amount,
23     SUM(amount) OVER (
24         ORDER BY order_date
25         RANGE BETWEEN INTERVAL '1 day' PRECEDING AND INTERVAL '1 day' FOLLOWING
26     ) as sum_range
27 FROM orders;
```

##### 现实世界的商业用例

### 客户群体分析

代码块

```sql
1  -- Customer retention cohort analysis
2  WITH user_cohorts AS (
3      SELECT
4          user_id,
5          DATE_TRUNC('month', first_order_date) as cohort_month
6      FROM (
7          SELECT
8              user_id,
9              MIN(order_date) as first_order_date
10         FROM orders
11         GROUP BY user_id
12     ) first_orders
13 ),
14 cohort_data AS (
15     SELECT
16         uc.cohort_month,
17         DATE_TRUNC('month', o.order_date) as order_month,
18         COUNT(DISTINCT o.user_id) as active_users
19     FROM user_cohorts uc
20     JOIN orders o ON uc.user_id = o.user_id
21     GROUP BY uc.cohort_month, DATE_TRUNC('month', o.order_date)
22 )
23 SELECT
24     cohort_month,
25     order_month,
26     active_users,
27     -- Cohort size (users in first month)
28     FIRST_VALUE(active_users) OVER (
```

---

#### 原图 13

![原图 13](./2026-09-20-sql-window-functions-images/13.jpg)

```sql
PARTITION BY cohort_month
ORDER BY order_month
) as cohort_size,
-- Retention rate
ROUND(
    active_users * 100.0 / FIRST_VALUE(active_users) OVER (
        PARTITION BY cohort_month
        ORDER BY order_month
    ),
    2
) as retention_rate,
-- Months since cohort start
ROW_NUMBER() OVER (PARTITION BY cohort_month ORDER BY order_month) - 1 as month_number
FROM cohort_data
ORDER BY cohort_month, order_month;
```

销售绩效仪表盘

代码块

```sql
-- Comprehensive sales performance metrics
SELECT
    sales_rep,
    month,
    monthly_sales,
    -- Ranking metrics
    RANK() OVER (PARTITION BY month ORDER BY monthly_sales DESC) as monthly_rank,
    RANK() OVER (ORDER BY monthly_sales DESC) as overall_rank,
    -- Performance vs peers
    monthly_sales - AVG(monthly_sales) OVER (PARTITION BY month) as vs_monthly_avg,
    ROUND(
        monthly_sales * 100.0 / SUM(monthly_sales) OVER (PARTITION BY month),
        2
    ) as pct_of_monthly_total,
    -- Trend analysis
    LAG(monthly_sales, 1) OVER (PARTITION BY sales_rep ORDER BY month) as prev_month_sales,
    LAG(monthly_sales, 12) OVER (PARTITION BY sales_rep ORDER BY month) as same_month_last_year,
    -- Running totals
    SUM(monthly_sales) OVER (
        PARTITION BY sales_rep
        ORDER BY month
```

---

#### 原图 14

![原图 14](./2026-09-20-sql-window-functions-images/14.jpg)

```sql
22        ) as ytd_sales,
23        -- Moving averages
24        AVG(monthly_sales) OVER (
25            PARTITION BY sales_rep
26            ORDER BY month
27            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
28        ) as three_month_avg
29    FROM monthly_sales_by_rep
30    ORDER BY sales_rep, month;
```

库存优化

代码块

```sql
1     -- Product performance and inventory analysis
2     SELECT
3         product_id,
4         week_ending,
5         units_sold,
6         inventory_level,
7         -- Sales trend analysis
8         AVG(units_sold) OVER (
9             PARTITION BY product_id
10            ORDER BY week_ending
11            ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
12        ) as four_week_avg_sales,
13        -- Inventory projections
14        inventory_level / NULLIF(
15            AVG(units_sold) OVER (
16                PARTITION BY product_id
17                ORDER BY week_ending
18                ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
19            ), 0
20        ) as weeks_of_inventory,
21        -- Performance ranking
22        RANK() OVER (
23            PARTITION BY week_ending
24            ORDER BY units_sold DESC
25        ) as sales_rank_this_week,
26        -- Growth analysis
27        (units_sold - LAG(units_sold, 4) OVER (
28            PARTITION BY product_id
29            ORDER BY week_ending
30        )) * 100.0 / NULLIF(LAG(units_sold, 4) OVER (
31            PARTITION BY product_id
32            ORDER BY week_ending
```

---

#### 原图 15

![原图 15](./2026-09-20-sql-window-functions-images/15.jpg)

```text
33    ), 0) as four_week_growth_pct
34    FROM weekly_product_metrics
35    ORDER BY product_id, week_ending;
```

性能考虑

窗口功能性能提示

1. 使用合适的索引：

代码块

```text
1    -- For PARTITION BY column and ORDER BY column
2    CREATE INDEX idx_orders_customer_date ON orders(customer_id, order_date);
3
4    -- Query will be much faster:
5    SELECT
6        customer_id,
7        order_date,
8        amount,
9        SUM(amount) OVER (PARTITION BY customer_id ORDER BY order_date) as
     running_total
10   FROM orders;
```

2. 尽可能限制结果集：

代码块

```text
1    -- Instead of calculating for all customersSELECT
2        customer_id,
3        order_date,
4        amount,
5        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) as
     recent_order_rank
6    FROM orders
7    WHERE ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) <=
     5;-- Better: Use a subquery to limit firstSELECT *FROM (SELECT
8        customer_id,
9        order_date,
10       amount,
11       ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC)
     as recent_order_rank
12   FROM orders
13   WHERE customer_id IN (SELECT id FROM active_customers)  -- Limit scope)
     ranked
14   WHERE recent_order_rank <= 5;
```

---

#### 原图 16

![原图 16](./2026-09-20-sql-window-functions-images/16.jpg)

3. 考虑实现复杂的计算：

代码块

```sql
1　-- For frequently-used complex window calculations, consider creating a view
2　CREATE MATERIALIZED VIEW customer_metrics_summary AS
3　SELECT
4　　　customer_id,
5　　　order_date,
6　　　amount,
7　　　SUM(amount) OVER (PARTITION BY customer_id ORDER BY order_date) as
　　　lifetime_value,
8　　　ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) as
　　　order_sequence,
9　　　LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date) as
　　　prev_order_date
10　FROM orders;

12　-- Refresh periodically
13　REFRESH MATERIALIZED VIEW customer_metrics_summary;
```

常见的陷阱与解决方案

1. 默认帧行为

代码块

```sql
1　-- ❌ This might not do what you expect
2　SELECT
3　　　order_date,
4　　　daily_sales,
5　　　SUM(daily_sales) OVER (ORDER BY order_date) as running_total
6　FROM daily_sales;

8　-- The default frame is RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
9　-- With duplicate order_dates, this might include future rows

11　-- ✅ Be explicit about frame
12　SELECT
13　　　order_date,
14　　　daily_sales,
15　　　SUM(daily_sales) OVER (
16　　　　　ORDER BY order_date
17　　　　　ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
```

---

#### 原图 17

![原图 17](./2026-09-20-sql-window-functions-images/17.jpg)

```text
18        ) as running_total
19 FROM daily_sales;
```

2. LAST_VALUE() [不确定：OCR 识别为“明白了”]

代码块

```text
1  -- ❌ This doesn't return the last value in the partition
2  SELECT
3      employee_name,
4      salary,
5      LAST_VALUE(salary) OVER (ORDER BY salary) as highest_salary
6  FROM employees;
7
8  -- ✅ Specify the complete frame
9  SELECT
10     employee_name,
11     salary,
12     LAST_VALUE(salary) OVER (
13         ORDER BY salary
14         ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
15     ) as highest_salary
16 FROM employees;
```

3. 空处理

代码块

```text
1  -- Window functions handle NULLs in ORDER BY differently than you might expect
   -- NULLs are typically ordered last (NULLS LAST is default in most databases)
   -- Be explicit about NULL ordering:
   SELECT
2      employee_name,
3      salary,
4      RANK() OVER (ORDER BY salary DESC NULLS LAST) as salary_rank
5  FROM employees;
```

数据库差异

PostgreSQL

• 全窗口功能支持
• 条件聚合的FILTER子句
• 高级框架规范

---
