---
schema_version: 1
question_id: 50
question: "Spring · Spring Boot 限流拦截器"
date: 2026-07-04
sources:
  - java/spring-concurrency-throttle-interceptor.md
  - java/megvii-java-round1-12-questions.md
  - java/eleme-java-backend-round1.md
score: "3/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
## 第50题 · Spring · Spring Boot 限流拦截器

**题目**：Spring Boot 限流拦截器怎么设计？令牌桶、漏桶、滑动窗口怎么落地？

### 用户回答

> 令牌桶：一堆令牌，来一个请求分发一个令牌，控制处理的速度；漏桶类似吧；滑动窗口，控制一段时间窗口内的数量，随着时间变化，可以调整时间段内的处理的多少。

**得分：3/10**

扣分点：
1. 令牌桶基本正确（0扣分）
2. 漏桶"类似吧"没说清区别（-2）：漏桶是固定速率流出，不允许突发；令牌桶允许突发
3. 滑动窗口太模糊（-3）：没说清固定窗口 vs 滑动窗口的区别，缺少实现细节

### 最终修正版

| 算法 | 原理 | 突发处理 | 适用场景 |
|------|------|---------|---------|
| **令牌桶** | 固定速率放令牌，请求取令牌 | 允许突发（桶满时一次性处理） | API 网关、接口限流 |
| **漏桶** | 固定速率流出，请求进桶排队 | 严格平滑，不允许突发 | 需要严格控速的场景 |
| **滑动窗口** | 统计窗口内请求数，超限拒绝 | 精确但内存开销大 | QPS 统计、精确限流 |
| **固定窗口** | 固定时间段计数 | 有边界突发问题 | 简单场景 |

Spring Boot 落地：拦截器 + `RateLimiter`（Guava）或 Sentinel

### 复习骨架

令牌桶允许突发 vs 漏桶严格平滑 → 滑动窗口比固定窗口精确 → 落地用 Guava RateLimiter 或 Sentinel
