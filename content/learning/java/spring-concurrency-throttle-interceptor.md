---
title: "Spring Boot 并发限流拦截器 ConcurrencyThrottleInterceptor 实战"
date: "2026-07-06"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "Spring Boot 并发限流拦截器 ConcurrencyThrottleInterceptor 实战"
tags:
---

# Spring Boot 并发限流拦截器 ConcurrencyThrottleInterceptor 实战

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：微信公众号（Spring Boot 3 实战案例系列）
> **抓取时间**：2026-06-07
> **分类**：Spring / 并发控制
> **环境**：Spring Boot 3.5.0

---

## 核心概念

Spring 内置了 `ConcurrencyThrottleInterceptor`（并发限流拦截器），用于限制并发访问。当达到指定并发限制时，会阻塞调用。

**适用场景**：针对特定服务限制并发量，比限制整个线程池更高效。

---

## 实现原理

`ConcurrencyThrottleInterceptor` 是 `MethodInterceptor`（方法拦截器），属于 AOP 的一部分。

Spring AOP 需要两个核心组件：
- **Pointcut（切入点）**：定义哪些方法被拦截
- **Advice（通知）**：MethodInterceptor 实现了 Advice

最终 Spring AOP 将 Pointcut 和 Advice 封装到 **Advisor** 中统一管理。

---

## 基本使用

```java
@Configuration
public class ConcurrentConfig {
    @Bean
    ConcurrencyThrottleInterceptor throttleInterceptor() {
        ConcurrencyThrottleInterceptor interceptor = new ConcurrencyThrottleInterceptor();
        interceptor.setConcurrencyLimit(2);  // 最多2个线程并发
        return interceptor;
    }

    @Bean
    DefaultPointcutAdvisor concurrentAdvisor() {
        DefaultPointcutAdvisor advisor = new DefaultPointcutAdvisor();
        AspectJExpressionPointcut aspectPointcut = new AspectJExpressionPointcut();
        aspectPointcut.setExpression("execution(* com.pack..*.*(..))");
        advisor.setPointcut(aspectPointcut);
        advisor.setAdvice(throttleInterceptor());
        return advisor;
    }
}
```

---

## 问题：所有方法共享并发限制

默认情况下，所有匹配的方法共享同一个 `ConcurrencyThrottleInterceptor`，导致 a 业务方法和 b 业务方法共享同一个并发数。

### 解决方案

**方案1**：为每个切入点配置独立的 Advisor（太麻烦）

```java
@Bean
DefaultPointcutAdvisor concurrentAdvisorQuery() {
    AspectJExpressionPointcut pointcut = new AspectJExpressionPointcut();
    pointcut.setExpression("execution(* com.pack..UserService.query(..))");
    ConcurrencyThrottleInterceptor advice = new ConcurrencyThrottleInterceptor();
    advice.setConcurrencyLimit(2);
    return new DefaultPointcutAdvisor(pointcut, advice);
}
```

**方案2**：通过 BeanPostProcessor + 自定义注解（更优雅）

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface ConcurrencyLimit {
    int value();  // 并发限制数
}

// 使用
@Service
public class UserService {
    @ConcurrencyLimit(2)
    public void query() { ... }

    @ConcurrencyLimit(3)
    public void batch() { ... }
}
```

通过 `BeanPostProcessor` 自动为标注 `@ConcurrencyLimit` 的方法创建独立的拦截器。

---

## 面试相关考点

1. Spring AOP 的核心组件（Pointcut + Advice + Advisor）
2. MethodInterceptor 的作用和使用场景
3. 并发限流的实现方式（信号量 vs 拦截器 vs 线程池）
4. BeanPostProcessor 的作用和使用场景
5. 自定义注解 + AOP 的实战应用

---

## 原始链接

https://mp.weixin.qq.com/s/d15I32hj6E-3a6Vqvs4b6w
