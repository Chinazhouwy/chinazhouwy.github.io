---
title: "Spring Boot 自动装配原理是什么？Boot 2 和 Boot 3 有什么变化？"
date: "2026-06-24"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "Spring Boot 自动装配原理是什么？Boot 2 和 Boot 3 有什么变化？"
tags:
schema_version: "1"
question_id: "36"
question: "Spring Boot 自动装配原理是什么？Boot 2 和 Boot 3 有什么变化？"
sources:
  - "middleware/vipshop-java-interview.md"
  - "java/baidu-java-backend-round1.md"
  - "java/spring-boot-async-4-patterns.md"
score: "4/10"
round: "R0"
next_review: "unknown"
session_id: "unknown"
---

# 第36题 — Spring Boot 自动装配原理

> **题目**：Spring Boot 自动装配原理是什么？Boot 2 和 Boot 3 有什么变化？
> **追问**：自定义 Starter 怎么写？SPI 机制是什么？多个实现怎么办？
> **来源**：`middleware/vipshop-java-interview.md`；`java/baidu-java-backend-round1.md`；`java/spring-boot-async-4-patterns.md`

---

## 得分：4/10

### ✅ 答对的部分
- 知道自动装配核心是 `@EnableAutoConfiguration`
- 知道会读取配置文件中的类并初始化

### ❌ 扣分点
1. 自动装配核心流程只说了"读取文件夹初始化bean"，漏了条件装配、去重、优先级（-2）
2. Boot 2→3 变化完全没答（-1.5）
3. spring.factories vs AutoConfiguration.imports 区别没答出来（-1）
4. 条件注解说"看有没有缺少某个bean"，不够准确（-0.5）

---

## 一、核心概念

### 1.1 自动装配完整流程

```
@SpringBootApplication
    └─ @EnableAutoConfiguration
           └─ @Import(AutoConfigurationImportSelector.class)
                  └─ selectImports()
                         └─ 读取 META-INF/spring/AutoConfiguration.imports
                                └─ 得到所有候选配置类
                                       └─ 逐个判断 @Conditional 条件
                                              └─ 条件满足 → 注册 Bean
                                              └─ 条件不满足 → 跳过
```

### 1.2 SPI 机制（Service Provider Interface）

**一句话**：框架定义接口，第三方实现，框架自动发现并加载。

```
Java 原生 SPI：
1. 框架定义接口：public interface LogService { void log(String msg); }
2. 第三方实现：public class MyLogService implements LogService { ... }
3. 第三方声明：META-INF/services/com.example.LogService → com.example.MyLogService
4. 框架加载：ServiceLoader.load(LogService.class) 自动找到实现类
```

**Java SPI vs Spring SPI**：

| 对比 | Java SPI | Spring SPI |
|------|----------|------------|
| 文件路径 | `META-INF/services/` | `META-INF/spring.factories` |
| 加载方式 | `ServiceLoader` | `SpringFactoriesLoader` |
| 功能 | 只能加载 | 加载 + 条件判断 + 排序 |

---

## 二、条件注解怎么工作

```java
@AutoConfiguration
@ConditionalOnClass(DataSource.class)        // classpath 有某个类才生效
@ConditionalOnMissingBean(DataSource.class)  // 容器没有某个 bean 才生效
@EnableConfigurationProperties(DataSourceProperties.class)
public class DataSourceAutoConfiguration {
    
    @Bean
    @ConditionalOnMissingBean  // 用户自定义了，这里就不生效
    public DataSource dataSource() {
        return createDefaultDataSource();
    }
}
```

**常见条件注解**：

| 注解 | 含义 | 典型场景 |
|------|------|----------|
| `@ConditionalOnClass` | classpath 有某个类 | 引入 mysql-connector 才配数据源 |
| `@ConditionalOnMissingBean` | 容器没有某个 bean | 用户没自定义才用默认的 |
| `@ConditionalOnProperty` | 配置文件有某个属性 | `spring.cache.type=redis` 才配 Redis |
| `@ConditionalOnWebApplication` | 是 Web 项目 | 只在 Web 环境生效 |

**关键点**：`@ConditionalOnMissingBean` 保证了**用户自定义优先于自动配置**。

---

## 三、spring.factories vs AutoConfiguration.imports

```
Spring Boot 2.x:
  META-INF/spring.factories
  ┌─────────────────────────────────────────────┐
  │ org.springframework.boot.autoconfigure.    │
  │   EnableAutoConfiguration=\                 │
  │   com.example.MyAutoConfiguration,\         │
  │   org.springframework.boot.autoconfigure.  │
  │     DataSourceAutoConfiguration              │
  └─────────────────────────────────────────────┘

Spring Boot 3.x:
  META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
  ┌─────────────────────────────────────────────┐
  │ com.example.MyAutoConfiguration             │
  │ org.springframework.boot.autoconfigure.    │
  │   DataSourceAutoConfiguration                │
  └─────────────────────────────────────────────┘
```

| 对比 | spring.factories (Boot 2) | AutoConfiguration.imports (Boot 3) |
|------|---------------------------|-------------------------------------|
| 文件路径 | `META-INF/spring.factories` | `META-INF/spring/...imports` |
| 格式 | key=value 格式 | 每行一个类名 |
| 用途 | 通用 SPI，加载所有扩展 | 专门加载自动配置类 |
| 性能 | 加载所有 SPI（含非自动配置） | 只加载自动配置，更快 |

**核心区别**：老方式是"一个大杂烩文件里按 key 找"，新方式是"专门的文件直接读"。

---

## 四、Boot 2 → Boot 3 关键变化

| 变化 | Boot 2 | Boot 3 |
|------|--------|--------|
| 配置文件 | `spring.factories` | `AutoConfiguration.imports` |
| 配置类注解 | `@Configuration` | `@AutoConfiguration` |
| 包名 | `javax.servlet` | `jakarta.servlet` |
| Java 版本 | Java 8+ | Java 17+ |
| GraalVM | 不支持 | 原生支持 |

**面试回答**：自动装配核心原理从 Boot 1 到现在没变过——都是 SPI + 条件判断。Boot 3 做了优化（配置类独立文件、加载更高效），但原理一样。

---

## 五、自定义 Starter 怎么写

### 5.1 项目结构

```
my-service-spring-boot-starter/
├── pom.xml
└── src/main/java/com/example/
    ├── MyServiceAutoConfiguration.java    ← 自动配置类
    ├── MyServiceProperties.java           ← 配置属性类
    └── MyService.java                     ← 你的服务类
```

### 5.2 定义配置属性类

```java
@ConfigurationProperties(prefix = "my-service")
public class MyServiceProperties {
    private String endpoint = "http://default.com";
    private int timeout = 3000;
    private boolean enable = true;
    // getter/setter 省略
}
```

### 5.3 定义服务类

```java
public class MyService {
    private final String endpoint;
    private final int timeout;
    
    public MyService(String endpoint, int timeout) {
        this.endpoint = endpoint;
        this.timeout = timeout;
    }
    
    public String call(String param) {
        return "Result from " + endpoint;
    }
}
```

### 5.4 写自动配置类（核心）

```java
@AutoConfiguration
@EnableConfigurationProperties(MyServiceProperties.class)
@ConditionalOnClass(MyService.class)
@ConditionalOnProperty(prefix = "my-service", name = "enable", havingValue = "true", matchIfMissing = true)
public class MyServiceAutoConfiguration {
    
    @Bean
    @ConditionalOnMissingBean
    public MyService myService(MyServiceProperties properties) {
        return new MyService(properties.getEndpoint(), properties.getTimeout());
    }
}
```

### 5.5 注册到 SPI

```
# Spring Boot 3
文件：META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
内容：com.example.MyServiceAutoConfiguration

# Spring Boot 2
文件：META-INF/spring.factories
内容：
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
  com.example.MyServiceAutoConfiguration
```

### 5.6 pom.xml

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-autoconfigure</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-configuration-processor</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>
```

### 5.7 使用方

```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>my-service-spring-boot-starter</artifactId>
</dependency>
```

```yaml
my-service:
  endpoint: http://api.example.com
  timeout: 5000
```

```java
@Autowired
private MyService myService;  // 直接注入使用
```

---

## 六、多个实现怎么办

### 场景：多个 Starter 提供同类型 Bean

```
项目引入了两个 Starter：
├── my-service-spring-boot-starter（自己的）
└── third-party-spring-boot-starter（第三方的）

两个都注册了 MyService 类型的 Bean
        │
        ▼
Spring 启动报错：NoUniqueBeanDefinitionException
```

### 解决方案

| 场景 | 解决方案 |
|------|----------|
| Starter 设计时 | 用 `@ConditionalOnMissingBean`，让用户自定义优先 |
| 用户想用默认的 | 直接引入 Starter，什么都不配 |
| 用户想自定义 | 自己写 `@Bean`，自动配置自动退让 |
| 多个 Starter 冲突 | 用 `@Primary` 或 `@Qualifier` 指定 |
| 控制加载顺序 | 用 `@AutoConfiguration(before/after)` |

### 方案 1：@ConditionalOnMissingBean（推荐）

```java
// 第三方 Starter
@AutoConfiguration
@ConditionalOnClass(MyService.class)
public class ThirdPartyAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    public MyService thirdPartyMyService() {
        return new ThirdPartyMyService();
    }
}

// 用户自己的代码
@Configuration
public class MyConfig {
    @Bean
    public MyService myService() {
        return new MyService();  // 用户自定义的
    }
}
```

**结果**：用户自定义的生效，第三方的自动退让。

### 方案 2：@Primary 指定默认

```java
@AutoConfiguration
public class ThirdPartyAutoConfiguration {
    @Bean
    @Primary   // 标记为默认首选
    public MyService thirdPartyMyService() {
        return new ThirdPartyMyService();
    }
}
```

**结果**：`@Autowired MyService` → 注入第三方的（@Primary）

### 方案 3：@Qualifier 指定注入

```java
@Autowired
@Qualifier("myService")
private MyService myService;  // 注入自己的

@Autowired
@Qualifier("thirdPartyMyService")
private MyService thirdPartyMyService;  // 注入第三方的
```

### 方案 4：@AutoConfiguration 控制加载顺序

```java
// 先加载第三方的
@AutoConfiguration(before = MyAutoConfiguration.class)
public class ThirdPartyAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    public MyService thirdPartyMyService() {
        return new ThirdPartyMyService();
    }
}

// 再加载自己的（优先级更高）
@AutoConfiguration(after = ThirdPartyAutoConfiguration.class)
public class MyAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    public MyService myService() {
        return new MyService();
    }
}
```

**核心原则**：`@ConditionalOnMissingBean` 是 Starter 的灵魂——它保证了"用户自定义永远优先"。

---

## 七、面试回答模板

> Spring Boot 自动装配的核心是 `@EnableAutoConfiguration`，它通过 `AutoConfigurationImportSelector` 读取 `META-INF/spring/AutoConfiguration.imports` 中的配置类列表，然后逐个判断 `@Conditional` 条件注解，条件满足才注册 Bean。
>
> 关键设计：`@ConditionalOnMissingBean` 保证用户自定义 Bean 优先于自动配置，实现了"约定大于配置"。
>
> 自定义 Starter 的核心三步：定义 `@ConfigurationProperties` 类接收配置，写 `@AutoConfiguration` 类控制装配条件，在 `.imports` 文件中注册。
>
> 多个实现冲突时，用 `@Primary` 指定默认、`@Qualifier` 指定注入、或 `@ConditionalOnMissingBean` 让自动配置退让。

---

## 八、用户追问+纠正记录

### 追问 1：spring.factories 为什么"加载全部"？
- 用户说"没太明白会加载全部"
- 纠正：`spring.factories` 是通用 SPI 机制，一个文件里塞了所有类型的扩展点（自动配置、Listener、FailureAnalyzer 等），自动配置只是其中之一。新方式专门开一个文件只放自动配置类，更精准。

### 追问 2：Boot 2 vs 3 是不是太 out 了？
- 用户说"Spring 4 都快出来了，你这个 2 和 3 是不是太 out 了，有点死记硬背"
- 纠正：用户说得对。面试官真正想考的是自动装配原理（SPI + 条件判断），不是版本差异。应该重点讲原理，版本差异一句话带过即可。

### 追问 3：自定义 Starter 怎么写？
- 用户说"我还真不会"
- 已详细讲解：项目结构、配置属性类、服务类、自动配置类、SPI 注册、pom.xml

### 追问 4：SPI 机制是什么？
- 用户说"我忘了"
- 已从第一原理讲解：框架定义接口 → 第三方实现 → META-INF 声明 → 框架自动发现加载

### 追问 5：多个实现怎么办？
- 用户问"如果有多个实现"
- 已讲解四种方案：@ConditionalOnMissingBean（推荐）、@Primary、@Qualifier、@AutoConfiguration(before/after)

---

## 这次讨论的收获

1. **SPI 机制**：Java SPI 和 Spring SPI 的区别，spring.factories 是通用 SPI，新方式是专用文件
2. **自动装配核心**：SPI 加载 + 条件判断，@ConditionalOnMissingBean 是灵魂
3. **自定义 Starter**：三步走（Properties 类 → AutoConfiguration 类 → .imports 注册）
4. **多实现冲突**：四种解决方案，@ConditionalOnMissingBean 是 Starter 设计最佳实践
5. **面试策略**：讲原理比背版本差异更重要，版本差异一句话带过即可
