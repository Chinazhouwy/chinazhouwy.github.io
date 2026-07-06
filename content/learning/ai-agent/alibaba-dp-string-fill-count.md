---
title: "阿里笔试 · 字符串填充组合计数（动态规划）"
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
summary: "阿里笔试 · 字符串填充组合计数（动态规划）"
tags:
---

# 阿里笔试 · 字符串填充组合计数（动态规划）

> 来源：小红书「小哲讲算法」视频笔记
> 标签：`#动态规划` `#字符串` `#组合计数` `#阿里笔试`

---

## 一、题目描述

给定一个由小写字母和 `?` 组成的字符串，`?` 可以替换为任意小写字母（a~z）。要求**相邻字符不能相同**，求有多少种合法的填充方案。

**示例**：`a?b`
- `?` 可以是 b~z 中除 b 外的任意字母（因为右边是 b），也可以是 a（左边是 a，但中间隔了一个位置）
- 实际上 `?` 不能等于左边字符，也不能等于右边字符
- 当 `?` 左边是 `a`、右边是 `b` 时：`?` 不能是 `a`（相邻），不能是 `b`（相邻）
- 所以 `?` 有 24 种选择（26 - 2 = 24）

**约束**：
- 字符串长度 N 可达 10^5
- 相邻字符不能相同
- `?` 可填 a~z 任意字母

---

## 二、暴力枚举（错误思路）

```python
# 暴力思路：对每个 ? 位置，a~z 全试一遍
for char in "abcdefghijklmnopqrstuvwxyz":
    if not has_adjacent_duplicates(pwd):
        count += 1
```

**问题**：假设有 k 个 `?`，每个位置有 26 种选择，时间复杂度 O(26^k)，直接爆炸。

---

## 三、动态规划解法

### 3.1 核心思想

**不需要记住前面所有的密码组合长什么样，只需要记录一个核心数据：在当前这一步，以每个字母结尾的合法方案数。**

状态定义：`dp[i][c]` = 前 i 个字符中，第 i 个位置填字符 c 的合法方案数

### 3.2 状态转移方程

**关键洞察**：计算当前位置填字符 c 的方案数时：
- 如果前一个位置是**固定字符** x（x ≠ c）：当前位置填 c 的方案数 = 前一个位置的总方案数
- 如果前一个位置是**固定字符** x（x = c）：当前位置不能填 c（相邻相同），方案数 = 0
- 如果前一个位置是 `?`：当前位置填 c 的方案数 = 前一个位置的总方案数 - 前一个位置以 c 结尾的方案数

**统一公式**：
```
dp[i][c] = Σ(dp[i-1][所有字符]) - dp[i-1][c]
```

即：**当前位置填 c 的方案数 = 上一页所有方案总数 - 上一页以 c 结尾的方案数**

### 3.3 推演示例：`a?b`

**第 0 步**（字符 `a`，固定）：
- dp[0][a] = 1，dp[0][b~z] = 0
- 总方案数 = 1

**第 1 步**（字符 `?`，通配符）：
- 对于每个字符 c，计算 dp[1][c]：
  - 若 c = a：dp[1][a] = 总(1) - dp[0][a](1) = 0（撞衫！不合法）
  - 若 c = b~z：dp[1][c] = 总(1) - dp[0][c](0) = 1
- 总方案数 = 0 + 25×1 = **25**

**第 2 步**（字符 `b`，固定）：
- 只能填 b：
  - dp[2][b] = 总(25) - dp[1][b](1) = **24**
- 总方案数 = **24**

**答案：24 种方案**

### 3.4 空间优化（滚动数组）

计算第 i 步只需要第 i-1 步的数据，不需要保留全部历史：

```javascript
// 撕掉旧账本，只留新一页
let prev = { a: 1, b: 1, c: 1, /* ... all 26 */ };

for (let i = 1; i < n; i++) {
    let curr = {};
    let total = 0;
    // 先算 prev 的总和
    for (let c = 0; c < 26; c++) {
        total += prev[c];
    }
    // 计算 curr
    for (let c = 0; c < 26; c++) {
        curr[c] = total - prev[c]; // 核心转移方程
    }
    prev = curr; // 状态滚动
}
```

### 3.5 时间复杂度

- **O(N)**：从左到右扫描一次，每步 26 次常数运算
- 26 是常数，所以总时间复杂度是 O(N)
- 即使字符串长度是 10 万，也能秒出结果

---

## 四、Java 完整实现

```java
public class StringFillCount {
    
    private static final int MOD = 1_000_000_007;
    
    /**
     * 计算字符串填充方案数
     * @param s 包含小写字母和 '?' 的字符串
     * @return 合法填充方案数（对 10^9+7 取模）
     */
    public int countWays(String s) {
        int n = s.length();
        
        // prev[c] 表示上一步以字符 c 结尾的方案数
        long[] prev = new long[26];
        
        // 初始化第一步
        char first = s.charAt(0);
        if (first == '?') {
            // ? 可以填任意字母，每种方案数为 1
            Arrays.fill(prev, 1);
        } else {
            // 固定字符，只有该字符的方案数为 1
            prev[first - 'a'] = 1;
        }
        
        // 动态规划
        for (int i = 1; i < n; i++) {
            long[] curr = new long[26];
            char c = s.charAt(i);
            
            // 计算 prev 的总和
            long total = 0;
            for (long v : prev) {
                total = (total + v) % MOD;
            }
            
            if (c == '?') {
                // 通配符：可以填任意字母
                for (int j = 0; j < 26; j++) {
                    // curr[j] = total - prev[j]（不能与前一个相同）
                    curr[j] = (total - prev[j] + MOD) % MOD;
                }
            } else {
                // 固定字符：只能填这个字符
                int idx = c - 'a';
                curr[idx] = (total - prev[idx] + MOD) % MOD;
            }
            
            prev = curr; // 状态滚动
        }
        
        // 最终答案 = 所有结尾字母的方案数之和
        long ans = 0;
        for (long v : prev) {
            ans = (ans + v) % MOD;
        }
        return (int) ans;
    }
}
```

---

## 五、核心要点总结

| 要点 | 说明 |
|------|------|
| **状态定义** | `dp[i][c]` = 前 i 个字符，第 i 个以 c 结尾的方案数 |
| **转移方程** | `dp[i][c] = Σ(dp[i-1][所有]) - dp[i-1][c]` |
| **空间优化** | 滚动数组，只需 O(26) 空间 |
| **时间复杂度** | O(N)，每步 26 次常数运算 |
| **核心思想** | 用历史的结果，推导现在的状态 |

---

## 六、相似题目拓展

### 6.1 LeetCode 91 · 解码方法（Decode Ways）

**题目**：给定数字字符串，`'A'->1, 'B'->2, ..., 'Z'->26`，求解码方案数。

**相似点**：字符串填充/解码计数，DP 状态转移

```java
public int numDecodings(String s) {
    int n = s.length();
    int[] dp = new int[n + 1];
    dp[0] = 1;
    dp[1] = s.charAt(0) == '0' ? 0 : 1;
    
    for (int i = 2; i <= n; i++) {
        // 单字符解码
        int one = Integer.parseInt(s.substring(i - 1, i));
        if (one >= 1 && one <= 9) {
            dp[i] += dp[i - 1];
        }
        // 双字符解码
        int two = Integer.parseInt(s.substring(i - 2, i));
        if (two >= 10 && two <= 26) {
            dp[i] += dp[i - 2];
        }
    }
    return dp[n];
}
```

### 6.2 LeetCode 639 · 解码方法 II（Decode Ways II）

**题目**：数字字符串含 `*`，`*` 可代表 1~9，求解码方案数。

**相似点**：通配符 + 组合计数 + 取模

```java
public int numDecodingsII(String s) {
    long MOD = 1_000_000_007;
    int n = s.length();
    long[] dp = new long[n + 1];
    dp[0] = 1;
    
    // 初始化第一个字符
    dp[1] = s.charAt(0) == '*' ? 9 : (s.charAt(0) == '0' ? 0 : 1);
    
    for (int i = 2; i <= n; i++) {
        char c1 = s.charAt(i - 1), c2 = s.charAt(i - 2);
        
        // 单字符解码
        if (c1 == '*') {
            dp[i] = (dp[i] + 9 * dp[i - 1]) % MOD;
        } else if (c1 != '0') {
            dp[i] = (dp[i] + dp[i - 1]) % MOD;
        }
        
        // 双字符解码
        if (c2 == '*' && c1 == '*') {
            dp[i] = (dp[i] + 15 * dp[i - 2]) % MOD; // 11~19(9种) + 21~26(6种)
        } else if (c2 == '*') {
            int val = c1 - '0';
            if (val <= 6) dp[i] = (dp[i] + 2 * dp[i - 2]) % MOD;
            else dp[i] = (dp[i] + dp[i - 2]) % MOD;
        } else if (c1 == '*') {
            if (c2 == '1') dp[i] = (dp[i] + 9 * dp[i - 2]) % MOD;
            else if (c2 == '2') dp[i] = (dp[i] + 6 * dp[i - 2]) % MOD;
        } else {
            int val = (c2 - '0') * 10 + (c1 - '0');
            if (val >= 10 && val <= 26) dp[i] = (dp[i] + dp[i - 2]) % MOD;
        }
    }
    return (int) dp[n];
}
```

### 6.3 LeetCode 1220 · 统计元音字母序列的数目

**题目**：长度为 n 的字符串，每个字符后面跟着的字符有特定规则，求合法字符串数。

**规则**：
- `a` 后只能跟 `e`
- `e` 后只能跟 `a` 或 `i`
- `i` 后只能跟 `a, e, o, u`
- `o` 后只能跟 `i` 或 `u`
- `u` 后只能跟 `a`

**相似点**：以特定字符结尾的方案数，状态转移

```java
public int countVowelPermutation(int n) {
    long MOD = 1_000_000_007;
    long a = 1, e = 1, i = 1, o = 1, u = 1;
    
    for (int k = 1; k < n; k++) {
        long na = (e + i + u) % MOD;  // a 前面可以是 e, i, u
        long ne = (a + i) % MOD;       // e 前面可以是 a, i
        long ni = (e + o) % MOD;       // i 前面可以是 e, o
        long no = i % MOD;             // o 前面可以是 i
        long nu = (i + o) % MOD;       // u 前面可以是 i, o
        a = na; e = ne; i = ni; o = no; u = nu;
    }
    
    return (int) ((a + e + i + o + u) % MOD);
}
```

### 6.4 LeetCode 1320 · 二指输入法定距离（Minimum Distance to Type Word Using Two Fingers）

**题目**：用两个手指在键盘上打字，求最小移动距离。

**相似点**：字符串 + 状态压缩 DP + 空间优化

### 6.5 阿里原题变种：括号序列填充

**题目**：给定含 `?` 的括号序列，`?` 可填 `(` 或 `)`，求合法括号序列的方案数。

```java
public int countValidParentheses(String s) {
    int n = s.length();
    long MOD = 1_000_000_007;
    // dp[i][j] = 前 i 个字符，当前深度为 j 的方案数
    long[][] dp = new long[n + 1][n + 1];
    dp[0][0] = 1;
    
    for (int i = 1; i <= n; i++) {
        char c = s.charAt(i - 1);
        for (int j = 0; j <= i; j++) {
            if (c == '(' || c == '?') {
                // 填 '('，深度 +1
                if (j > 0) dp[i][j] = (dp[i][j] + dp[i-1][j-1]) % MOD;
            }
            if (c == ')' || c == '?') {
                // 填 ')'，深度 -1
                if (j < n) dp[i][j] = (dp[i][j] + dp[i-1][j+1]) % MOD;
            }
        }
    }
    return (int) dp[n][0]; // 最终深度必须为 0
}
```

---

## 七、面试答题模板

**面试官问：字符串填充组合计数怎么做？**

1. **先确认题意**：`?` 能填什么？相邻字符有无限制？是否需要取模？
2. **指出暴力解法的问题**：26^k 指数级爆炸
3. **给出 DP 思路**：
   - 状态定义：`dp[i][c]` = 前 i 个字符，以 c 结尾的方案数
   - 转移方程：`dp[i][c] = Σ(dp[i-1]) - dp[i-1][c]`
   - 空间优化：滚动数组 O(26)
   - 时间复杂度：O(N)
4. **手写代码**：注意取模和边界条件
5. **复杂度分析**：时间 O(N)，空间 O(1)（滚动数组）

---

## 八、同类题型总结

| 题型 | 特征 | 解法 |
|------|------|------|
| 通配符填充计数 | `?` 可填任意字符，相邻不重复 | DP + 滚动数组 |
| 括号序列填充 | `?` 可填 `(` 或 `)`，求合法方案 | DP + 深度状态 |
| 解码方法 | 数字→字母映射，求解码数 | DP + 前一步/两步 |
| 字符规则序列 | 每个字符后有固定跟随规则 | DP + 状态转移 |
| 多手指/多指针打字 | 多个操作对象，求最小代价 | DP + 状态压缩 |

**共同特征**：
- 字符串/序列 + 计数问题
- 当前位置的合法选择依赖前一个状态
- DP 状态 = 前 i 个 + 结尾字符/深度
- 转移方程 = 前一步总方案 - 不合法方案
- 空间优化 = 滚动数组

---

*整理时间：2026-05-17*
*来源：小红书「小哲讲算法」*
