# 百度 Java 后端一面面经

**时间：** 2026-05-24  
**时长：** 40 分钟  
**形式：** 线上视频面  
**侧重：** Spring 全家桶与 Web 开发（框架实战版）  
**适配：** CRUD 业务开发、接口开发求职者

> 一面主打**框架原理与实战**，全程围绕 Spring 展开，问的全是 Spring 核心机制，不会太难但很细

---

## 1. 自我介绍

重点介绍 SpringBoot 项目开发、接口开发、事务处理相关经验。

---

## 2. Spring 核心原理问答

### Q1: Spring IOC 核心思想？底层用到哪些设计模式？

**答：** IOC 控制反转，将对象创建、依赖管理交给 Spring 容器，解除代码耦合。

底层用到的设计模式：
- **工厂模式** — BeanFactory 创建对象
- **单例模式** — Bean 默认 singleton 作用域
- **装饰器模式** — BeanPostProcessor 增强 Bean
- **代理模式** — AOP 动态代理

核心实现：Bean 工厂（BeanFactory / ApplicationContext）

### Q2: Spring Bean 的生命周期？完整执行流程？

**完整流程：**

```
资源加载 → 解析配置 → Bean定义扫描注册
  → 实例化 Bean
  → 属性填充（依赖注入）
  → 初始化（前置处理 → init方法 → 后置处理）
  → 正常使用
  → 容器关闭 → 销毁
```

### Q3: Bean 的作用域有哪些？默认作用域及特点？

| 作用域 | 说明 |
|--------|------|
| **singleton（默认）** | 整个容器只创建一个 Bean 实例，全局共享，高效但需保证线程安全 |
| prototype | 每次获取都创建新实例 |
| request | 每个 HTTP 请求一个实例 |
| session | 每个 HTTP Session 一个实例 |
| application | 每个 ServletContext 一个实例 |

---

## 3. Spring 事务核心问答

### Q1: @Transactional 注解实现原理？为什么事务会失效？

**原理：** 基于 **AOP 动态代理**实现，通过拦截目标方法，开启、提交、回滚事务。

**常见失效场景：**
- 方法非 `public`
- **内部调用**（同类方法间调用，不走代理）
- 异常被 `try-catch` 捕获未抛出
- 传播属性配置不当
- 多线程调用事务方法

### Q2: Spring 事务传播机制有哪些？常用场景？

**7 种传播机制，核心常用：**

| 传播机制 | 说明 |
|---------|------|
| **REQUIRED（默认）** | 有事务则加入，无则新建 |
| SUPPORTS | 支持事务，无则非事务运行 |
| **REQUIRES_NEW** | 新建独立事务，挂起原事务 |
| **NESTED** | 嵌套事务（Savepoint 回滚点） |

---

## 4. Web 核心问答

### Q1: SpringMVC 完整执行流程？@RequestMapping 实现原理？

**执行流程：**

```
客户端请求 → DispatcherServlet 拦截
  → HandlerMapping 匹配处理器
  → HandlerAdapter 执行控制器方法
  → 视图解析 → 响应返回
```

**@RequestMapping 原理：** 通过注解扫描注册请求映射关系，绑定 URL 与对应处理方法。

### Q2: SpringBoot 自动配置原理？核心注解作用？

**原理：** 基于 **SPI 机制 + 条件注解**实现。

**@SpringBootApplication** 整合三个功能：
- `@ComponentScan` — 组件扫描
- `@EnableAutoConfiguration` — 自动配置
- `@SpringBootConfiguration` — 配置绑定

自动加载 `META-INF/spring.factories` 下的自动配置类，无需手动配置 XML。

---

## 5. AOP 收尾提问

AOP 的使用场景，项目中哪些地方用到了 AOP？

常见的项目应用：
- **日志记录** — 方法调用日志切面
- **权限校验** — 自定义注解 + 切面拦截
- **事务管理** — `@Transactional` 底层就是 AOP
- **性能监控** — 方法执行耗时统计
- **缓存** — 缓存切面实现

---

## 面试复盘

- 全程围绕 **Spring 框架** 展开
- **侧重原理而非使用** — 不只是怎么用，要懂底层机制
- 重点排查框架使用误区（事务失效、Bean 线程安全等）
- 这是后端开发**必备核心知识点**，答不上来基本和 offer 无缘

**难度评级：** ⭐⭐（一面偏基础，但原理必须吃透）

> 与 [百度二面](./baidu-java-backend-round2.md)（Spring AOP/MVC/事务/Redis锁/Dubbo/MQ）和 [百度终面](./baidu-java-backend-final-round.md)（高并发/短链接/分布式定时任务/Kafka）构成完整链路，逐面升级