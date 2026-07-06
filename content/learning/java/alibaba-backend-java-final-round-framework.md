---
title: "阿里后端Java终面面经 — 框架源码+问题排查"
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
summary: "阿里后端Java终面面经 — 框架源码+问题排查"
tags:
---

# 阿里后端Java终面面经 — 框架源码+问题排查

> 来源：小红书 | 时长：65分钟 | 岗位：阿里Java后端开发（框架研发方向）

## 面试流程

自我介绍 → 框架源码提问 → 问题排查 → 编码题 → 反问

## 核心面试题

### 1. 自我介绍

重点说框架相关的学习和实践：Spring、MyBatis 源码阅读，自定义框架相关经验。

### 2. Spring 源码

**Q：Spring Boot 自动配置原理？@EnableAutoConfiguration 作用？如何实现自定义 Starter？**

**答题思路：**
- `@SpringBootApplication` → 组合了 `@EnableAutoConfiguration` + `@ComponentScan` + `@Configuration`
- `@EnableAutoConfiguration` → `@Import(AutoConfigurationImportSelector.class)`
- 读取 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- 结合 `@Conditional` 系列条件注解按需加载

**自定义 Starter：**
1. 引入 `spring-boot-starter` + `spring-boot-autoconfigure`
2. 编写 `@Configuration` + `@ConditionalOnClass`/`@ConditionalOnMissingBean`
3. 在 `AutoConfiguration.imports` 中注册
4. `@ConfigurationProperties` 绑定配置项

### 3. MyBatis 源码

**Q：执行流程？SqlSession 作用？Mapper 如何关联 XML？**
```
SqlSessionFactoryBuilder → 解析 XML → SqlSessionFactory → SqlSession → Mapper代理 → 执行SQL
```
- `SqlSession.getMapper()` → `MapperProxyFactory` 创建 JDK 动态代理
- `MapperProxy.invoke()` → 方法签名找 XML `<select>` 标签

**Q：一级缓存 vs 二级缓存？**

| 维度 | 一级缓存 | 二级缓存 |
|------|----------|----------|
| 作用域 | SqlSession 级别（默认） | namespace 级别（手动开启） |
| 生命周期 | SqlSession 关闭即清空 | 跨 SqlSession 共享 |
| 分布式共享 | 不支持 | 实现 `Cache` 接口 + Redis |

### 4. 问题排查

**OOM 排查步骤：**
1. `-XX:+HeapDumpOnOutOfMemoryError` 保留现场
2. MAT/jvisualvm/arthas 分析 dump
3. Dominator Tree 找大对象 → GC Roots 引用链
4. 常见：大List未释放、线程池无界队列、ThreadLocal 未 remove

**CPU 过高定位：**
1. `top` → PID → `top -H -p <PID>` → TID
2. `printf '%x\n' <TID>` → `jstack <PID> | grep -A 30 <nid=0xHEX>`
3. 分析：死循环、频繁GC、正则回溯

### 5. 编码题

**线程安全单例：DCL**
```java
public class Singleton {
    private static volatile Singleton instance;
    private Singleton() {}
    public static Singleton getInstance() {
        if (instance == null) {
            synchronized (Singleton.class) {
                if (instance == null) instance = new Singleton();
            }
        }
        return instance;
    }
}
```

**静态内部类**
```java
public class Singleton {
    private Singleton() {}
    private static class Holder {
        private static final Singleton INSTANCE = new Singleton();
    }
    public static Singleton getInstance() { return Holder.INSTANCE; }
}
```

### 6. JVM

**双亲委派模型：** Bootstrap → Extension → Application → 自定义
- 作用：避免重复加载、防止核心 API 被篡改
- 打破：重写 `findClass()`、SPI（线程上下文类加载器）、热部署

**堆 vs 栈：** 堆存对象实例（线程共享），栈存局部变量/操作数栈（线程私有）
**栈帧组成：** 局部变量表 → 操作数栈 → 动态链接 → 方法返回地址

### 7. ORM 框架设计

核心思路：实体映射 → SQL生成 → 连接池 → 缓存 → 事务管理 → 延迟加载 → 插件机制

## 面试总结

侧重框架源码深度考察，适合有框架源码阅读经验的候选人。
