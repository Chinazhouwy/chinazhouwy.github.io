---
title: "Spring Boot 已过时的 10 个模式：迁移清单与版本边界"
date: "2026-09-10"
domain: "学习"
area: "Java 后端"
module: "Spring 生态"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "整理一篇 Spring Boot 旧模式迁移清单，逐条区分真正移除、已不推荐、仍可使用与需要版本边界的做法，并补充官方资料核验。"
tags:
  - Java
  - Spring
  - Spring Boot
  - Spring Security
  - Spring MVC
  - Spring Cloud
  - Jakarta
  - 虚拟线程
  - 迁移
source: "微信公众号「Spring全家桶实战案例」"
source_url: "https://mp.weixin.qq.com/s/DBi6yAIbUTvq5uQfm0XJTA"
published_at: "2026-09-10 12:00:00 +08:00"
---

# Spring Boot 已过时的 10 个模式：迁移清单与版本边界

> **类型**：📚 参考资料（非面试题/面经）
>
> **原文标题**：《Spring Boot 已过时的10个模式》
>
> **来源**：微信公众号「Spring全家桶实战案例」
>
> **原文环境**：Spring Boot 3.5.0（按原文标注）
>
> **发布时间**：2026-09-10 12:00（北京时间）
>
> **整理时间**：2026-09-10
>
> **核验原则**：原文只是迁移清单，不把“已过时”四个字统一理解成“API 已删除”。本笔记用 Spring 官方参考文档和 Javadoc 区分“仍能用”“不推荐新代码”“已弃用”和“需要迁移”。

原文的主线判断是：从 Spring Boot 2.x 迁移到 3.x，再考虑 4.x，变化不只是版本号，还涉及 API、配置模式和生态约定。[1] 这个方向成立，但每一个条目都必须绑定具体的 Spring Framework、Spring Security 或 Spring Boot 版本，不能把某个组件的迁移结论扩大成整个 Spring Boot 的结论。[1]

## 一、十个模式的快速判断

| 原文条目 | 更准确的判断 | 复习动作 |
|---|---|---|
| `@Autowired` 字段注入 | 仍可工作，但构造器注入更适合表达必需依赖 | 新代码优先构造器注入 |
| 大量 `@Value` | 单值注入仍然合适；相关配置多时不利于集中管理 | 改用 `@ConfigurationProperties` |
| `WebSecurityConfigurerAdapter` | 已弃用，现代配置使用 `SecurityFilterChain` | 按 Bean 配置重写 |
| `RestTemplate` | 当前 Spring Framework 文档已将其列为更老的同步客户端，推荐 `RestClient` | 新代码优先 `RestClient`；不要照抄“Boot 4.2+ 才废弃” |
| `WebMvcConfigurerAdapter` | 自 Spring Framework 5.0 起已弃用 | 直接实现 `WebMvcConfigurer` |
| `javax.*` | Spring Boot 3 的 Jakarta 迁移要求涉及 Java EE/Jakarta API，但不是所有 `javax.*` 包都能机械替换 | 按依赖和包用途逐个迁移 |
| JUnit 4 测试模式 | JUnit 5+ 是现代测试方向，但不能只替换注解 | 同时检查依赖、Runner/Extension 和测试引擎 |
| `spring.factories` 注册自动配置 | 自动配置候选使用 `AutoConfiguration.imports`；`spring.factories` 不是全局失效 | 只迁移自动配置注册这一类用途 |
| 自定义错误 Map | `ProblemDetail` 提供标准化错误响应模型 | 统一错误响应结构和字段 |
| 盲目上 WebFlux | 虚拟线程让部分阻塞式 MVC 场景有了新选项，但不是并发量的万能答案 | 按 I/O、调用链和运维约束选模型 |

## 二、逐条整理与勘误

### 1. `@Autowired` 字段注入：不是“失效”，而是依赖表达不够清晰

字段注入的主要问题不是 Spring 不能工作，而是类的必需依赖隐藏在字段上，构造函数无法直接表达对象成立所需的条件。构造函数注入还能让依赖字段声明为 `final`，也更容易在不启动 Spring 容器的单元测试中传入替身对象。[2]

Spring 官方文档明确说明：如果 Bean 只有一个构造函数，那个构造函数即使不写 `@Autowired` 也会被使用。[2] 因此，下面这种写法已经足够：

```java
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final PaymentGateway paymentGateway;

    public OrderService(OrderRepository orderRepository,
                        PaymentGateway paymentGateway) {
        this.orderRepository = orderRepository;
        this.paymentGateway = paymentGateway;
    }
}
```

**边界：**字段注入不是一升级 Spring Boot 就不能启动；它更像是可维护性和测试设计问题。老项目可以渐进式改造，不必为了形式上的“现代化”一次性重写所有 Bean。[2]

### 2. 大型配置对象：从分散的 `@Value` 转向 `@ConfigurationProperties`

`@Value` 注入一个或两个值仍然很直接；Spring Boot 同时支持把配置绑定到结构化的 `@ConfigurationProperties` 对象。[3]

```java
@Value("${app.timeout}")
private Duration timeout;
```

当一个模块有十几个相关配置时，把字段散落在多个服务类里会让默认值、校验和配置前缀难以维护。[3]

```java
@ConfigurationProperties(prefix = "app.client")
@Validated
public class AppClientProperties {

    @NotBlank
    private String host;

    @Min(1)
    @Max(65535)
    private int port;

    @NotNull
    private Duration timeout;

    // getters and setters
}
```

对应配置：

```yaml
app:
  client:
    host: api.example.com
    port: 443
    timeout: 2s
```

**复习要点：**这里的迁移重点不是“所有 `@Value` 都必须删除”，而是把同一业务边界下的配置聚合、校验并集中注入。

### 3. `WebSecurityConfigurerAdapter`：按 `SecurityFilterChain` Bean 重写

原文给出的旧写法继承 `WebSecurityConfigurerAdapter`。[1] Spring Security 5.7 的官方 Javadoc 已将该适配器标记为弃用，并明确建议使用 `SecurityFilterChain` Bean 或 `WebSecurityCustomizer` Bean。[8] 当前官方 Java 配置示例也围绕 `SecurityFilterChain` 构建安全过滤器链。[4]

现代写法可以是：

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated())
            .httpBasic(Customizer.withDefaults());
        return http.build();
    }
}
```

**勘误：**原文说“5.7 弃用、6.0 移除”。本次证据链直接确认的是 5.7 官方 Javadoc 已经给出替代方案；面对 6.x 或更高版本时，不要继续围绕适配器设计新代码，应直接采用 Bean 配置。[4][8]

### 4. `RestTemplate` 与 `RestClient`：方向正确，但原文的 Boot 版本断言过满

原文推荐同步调用使用 `RestClient`、响应式场景使用 `WebClient`，这个分层是合理的。[1] 当前 Spring Framework REST 客户端文档把 `RestClient` 定义为带流式 API 的同步客户端，同时把 `RestTemplate` 描述为更老的模板式同步客户端，并列为“已不推荐，优先使用 `RestClient`”。[5]

`RestTemplate` 的当前 Javadoc 还说明，`RestClient` 自 Spring Framework 6.1 起提供了更现代的同步 HTTP 访问 API，二者共享请求工厂、拦截器和消息转换器等基础设施。[6]

```java
RestClient restClient = RestClient.builder()
        .baseUrl("https://api.example.com")
        .build();

User user = restClient.get()
        .uri("/users/{id}", 1)
        .retrieve()
        .body(User.class);
```

**关键勘误：**原文写“自 Spring Boot 4.2+ 起 `RestTemplate` 彻底废弃”。原文确实这样声称。[1] 但本次核验到的官方依据是 Spring Framework 文档对 `RestClient` 的推荐关系，而不是一个可直接确认的 “Spring Boot 4.2+” 版本门槛。因此归档时保留为“原文声称”，不要把这个具体版本号当成已核验事实。

**选型：**

- 同步、阻塞式调用：优先 `RestClient`；
- 响应式链路、流式响应或非阻塞 I/O：考虑 `WebClient`；
- 已有稳定的 `RestTemplate` 代码：先评估升级收益、拦截器、错误处理和测试成本，再安排迁移；官方资料确认 `RestClient` 与 `RestTemplate` 共享不少基础设施。[5][6]

### 5. `WebMvcConfigurerAdapter`：直接实现 `WebMvcConfigurer`

`WebMvcConfigurerAdapter` 的废弃原因不是 Spring MVC 不再支持扩展，而是 Java 8 接口默认方法已经可以为 `WebMvcConfigurer` 提供空实现。Spring Framework 5.3 的官方 Javadoc 明确写着：该适配器自 5.0 起弃用，`WebMvcConfigurer` 可以直接实现。[7]

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedMethods("GET", "POST");
    }
}
```

**迁移注意：**只实现需要的回调即可；不要为了“替换适配器”把一堆空方法全部复制进项目。

### 6. `javax.*` 到 `jakarta.*`：按生态边界迁移，不是全局字符串替换

Spring Boot 3 的升级涉及 Jakarta EE 基线。Boot 3 文档中的示例已经使用 `jakarta.validation`，并说明与 Jakarta EE 9 基线兼容的依赖要选择对应的 `-jakarta` 变体。[9]

常见迁移包括：

```text
javax.servlet       -> jakarta.servlet
javax.persistence   -> jakarta.persistence
javax.validation    -> jakarta.validation
javax.annotation    -> jakarta.annotation
javax.transaction   -> jakarta.transaction
```

但不能把所有出现 `javax` 的 import 都替换掉。例如 `javax.sql.DataSource`、`javax.management.MBeanServer` 属于 JDK 平台 API，是否迁移必须看包的归属和依赖版本。[9]

**迁移顺序：**

1. 先升级 Spring Boot、Spring Framework 和相关 starter；
2. 检查 Servlet、JPA、Validation、Mail、Transaction 等 Jakarta 依赖；
3. 再处理业务源码的 import；
4. 最后检查测试、插件、代码生成器和第三方 starter 是否仍停留在旧命名空间。

### 7. JUnit 4 到 JUnit 5+：不只是替换 `@RunWith`

旧测试常见写法：[1]

```java
@RunWith(SpringRunner.class)
@SpringBootTest
public class UserServiceTest {
}
```

现代测试通常使用 JUnit Jupiter，并让 Spring Boot 的测试注解完成 Spring Test 集成。当前 Spring Boot 测试文档说明，`@SpringBootTest` 默认不会启动服务器；同时，现代 `@…Test` 注解已经带有 Spring 扩展集成，不需要再机械添加等价的扩展注解。[13]

```java
@SpringBootTest
class UserServiceTest {

    @Test
    void contextLoads() {
    }
}
```

**迁移清单：**

- `org.junit.Test` 改为 `org.junit.jupiter.api.Test`；
- `@RunWith(SpringRunner.class)` 不再作为 JUnit 5 的入口；
- 检查 Maven/Gradle 测试引擎、Surefire/Failsafe 版本；
- 检查 `@Rule`、`@ClassRule`、参数化测试和自定义 Runner 的替代方案；
- 不要把“测试上下文能启动”误当成业务测试已经覆盖。

### 8. `spring.factories` 到 `AutoConfiguration.imports`：只针对自动配置候选

为自定义 Spring Boot Starter 注册自动配置时，现代方式是在 JAR 中放置；Spring Boot 官方文档把它作为自动配置候选的定位文件。[10]

```text
META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

每行写一个自动配置类名。Spring Boot 官方文档明确说明，Boot 会检查这个文件来定位自动配置候选。[10]

示例：

```text
com.example.autoconfigure.ExampleAutoConfiguration
```

**重要勘误：**“`spring.factories` 已被 `AutoConfiguration.imports` 全面取代”是不准确的。自动配置候选注册确实应迁移到 `AutoConfiguration.imports`，但 Spring 生态中 `SpringFactoriesLoader` 还有其他扩展用途。比如 Spring Security 5.7 的官方 Javadoc 仍展示了通过 `META-INF/spring.factories` 注册自定义 `AbstractHttpConfigurer` 的方式。[8]

因此，迁移时先确认 `spring.factories` 中每个 key 的用途：

- `EnableAutoConfiguration` 相关候选：迁移到 `AutoConfiguration.imports`；
- 其他 Spring 工厂扩展：按对应框架版本文档决定是否保留；
- 不要用全局搜索替换把所有 `spring.factories` 文件删除。

### 9. `ProblemDetail`：统一错误响应，但要注意 RFC 版本表述

旧项目常见做法是返回自定义 Map：[1]

```java
return Map.of("code", 500, "msg", "internal error");
```

Spring 6 / Spring Boot 3 引入的 `ProblemDetail` 能把 HTTP 状态、标题、详情和扩展字段放进统一错误模型。当前 Spring Framework 文档把它放在“Problem Details for HTTP APIs”规范下，并标注为 RFC 9457。[1][11]

一个简单的异常处理示例：

```java
@RestControllerAdvice
class ApiExceptionHandler {

    @ExceptionHandler(OrderNotFoundException.class)
    ProblemDetail handle(OrderNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND,
                ex.getMessage());
        problem.setTitle("Order not found");
        problem.setProperty("errorCode", "ORDER_NOT_FOUND");
        return problem;
    }
}
```

**勘误：**原文按 RFC 7807 介绍 `ProblemDetail`；当前官方 Spring Framework 页面使用 RFC 9457 的表述。[11] 学习时应把规范版本和 Spring Framework 版本一起记录，不要只背一个 RFC 编号。

**工程边界：**标准化错误结构不代表所有异常都应把内部堆栈、SQL、下游响应或敏感参数直接返回给客户端。对外字段仍需经过错误分级、脱敏和日志关联设计。

### 10. 虚拟线程与 WebFlux：新工具不是自动升级并发的按钮

Spring Boot 3.2 文档说明，在 Java 21 或更高版本上，可以通过 `spring.threads.virtual.enabled=true` 启用虚拟线程。[12]

```yaml
spring:
  threads:
    virtual:
      enabled: true
```

原文强调“高并发不等于一定要 WebFlux”，这个提醒有价值。[1] 如果业务主要是阻塞式数据库、HTTP 或文件 I/O，MVC 加虚拟线程可能比把整个调用链改成响应式更容易维护。[12]

但虚拟线程也有运行时边界。官方文档特别提醒，虚拟线程是 daemon thread；当应用依赖 `@Scheduled` 或其他线程维持 JVM 存活时，需要关注 `spring.main.keep-alive` 等行为。[12]

**不要直接从配置推导性能结论：**吞吐量还受数据库连接池、下游限流、CPU、锁竞争、线程绑定上下文、阻塞点和超时策略影响。文章配图中的“0.1 秒启动”“性能提升 N 倍”等目录宣传没有给出硬件、负载、基线和测试脚本，不能作为已复现的 benchmark。

## 三、从 Boot 2.x 迁移到 3.x 的建议顺序

原文把十个模式放在同一张清单里，实际迁移时最好分层处理：

### 第一层：先处理编译级阻断

1. 升级 Java、Spring Boot 和构建插件；
2. 处理 `javax.*` / `jakarta.*` 依赖边界；
3. 检查 Spring Security 适配器、Servlet 容器、JPA、Validation 和 Mail；
4. 让项目先恢复编译和最小上下文启动。

### 第二层：处理框架配置迁移

1. `WebSecurityConfigurerAdapter` 改为 `SecurityFilterChain`；
2. 自动配置候选迁移到 `AutoConfiguration.imports`；
3. `WebMvcConfigurerAdapter` 改成直接实现 `WebMvcConfigurer`；
4. 大量配置字段聚合为 `@ConfigurationProperties`。

### 第三层：处理可维护性改造

1. 字段注入渐进式改为构造函数注入；
2. 新的同步 HTTP 调用优先评估 `RestClient`；
3. 统一错误响应模型；
4. 清理 JUnit 4 Runner、Rule 和旧测试依赖。

### 第四层：按真实负载评估并发模型

1. 先测清楚阻塞点和下游依赖；
2. 再比较 MVC + 平台线程、MVC + 虚拟线程和 WebFlux；
3. 关注连接池、超时、取消、上下文传播和监控；
4. 用可复现的压测脚本记录吞吐、延迟、错误率和资源消耗。

## 四、原文配图核验

文章正文配有 10 张图片。逐图核验后，图片主要是 Spring Boot 实战案例目录和资料宣传页，没有展示足以独立证明“性能提升”“最优方案”或“0.1 秒启动”的完整代码、配置、硬件环境、压测脚本和结果表。因此，配图中的效果数字统一按“原文/目录宣传，未独立复现”处理。[1]

| 图片 | 内容 | 归档判断 |
|---:|---|---|
| 01 | Spring/Spring Boot 及周边技术资料目录 | 目录证据，不证明实现正确 |
| 02 | 案例 1—15 目录 | 技术主题清单，不证明效果 |
| 03 | 案例 16—30 目录 | 技术主题清单，不证明效果 |
| 04 | 案例 31—50 目录 | 含性能、事务、Cloud 等宣传标题 |
| 05 | 案例 51—60 目录 | 含 Redis、JPA、锁等主题 |
| 06 | 案例 61—70 目录 | 含并发、事务、日志等主题 |
| 07 | 案例 71—85 目录 | 含 GraalVM、限流、RPC 等主题；效果数字未复现 |
| 08 | 案例 86—100 目录 | 含监控、事务、SQL、规则引擎等主题 |
| 09 | 案例 101—115 目录 | 含 AOP、异步、接口治理等主题 |
| 10 | 案例 116—130 目录 | 含动态路由、数据源、事务和监控等主题 |

配图已经按实际文件签名保存为 PNG/WebP，没有把 WebP 伪标成 JPG。

## 五、复习速记

```text
“已过时”要拆成四种状态：仍可用、已不推荐、已弃用、已移除。
字段注入不是启动级错误；构造器注入主要改善依赖表达、不可变性和测试。
单值用 @Value，成组配置用 @ConfigurationProperties。
WebSecurityConfigurerAdapter -> SecurityFilterChain。
WebMvcConfigurerAdapter 自 Spring Framework 5.0 起弃用，直接实现 WebMvcConfigurer。
RestTemplate 的迁移依据是 Spring Framework 对 RestClient 的推荐，不要死背 Boot 4.2+ 门槛。
javax -> jakarta 只处理 Jakarta EE 生态，不能全局替换所有 javax.*。
spring.factories -> AutoConfiguration.imports 只针对自动配置候选注册。
ProblemDetail 要结合 Spring 版本和 RFC 9457 的当前表述理解。
虚拟线程需要 Java 21+，并且要检查 daemon thread、连接池和下游容量。
目录里的“性能提升 N 倍”不是 benchmark；没有负载、基线和脚本就不能复现。
```

## 六、配图

- [01：Spring 资料目录](./2026-09-10-spring-boot-obsolete-patterns-images/01.png)
- [02：案例 1—15](./2026-09-10-spring-boot-obsolete-patterns-images/02.webp)
- [03：案例 16—30](./2026-09-10-spring-boot-obsolete-patterns-images/03.webp)
- [04：案例 31—50](./2026-09-10-spring-boot-obsolete-patterns-images/04.webp)
- [05：案例 51—60](./2026-09-10-spring-boot-obsolete-patterns-images/05.webp)
- [06：案例 61—70](./2026-09-10-spring-boot-obsolete-patterns-images/06.webp)
- [07：案例 71—85](./2026-09-10-spring-boot-obsolete-patterns-images/07.webp)
- [08：案例 86—100](./2026-09-10-spring-boot-obsolete-patterns-images/08.webp)
- [09：案例 101—115](./2026-09-10-spring-boot-obsolete-patterns-images/09.webp)
- [10：案例 116—130](./2026-09-10-spring-boot-obsolete-patterns-images/10.webp)

---

## 原始链接

https://mp.weixin.qq.com/s/DBi6yAIbUTvq5uQfm0XJTA

## Sources

[1] https://mp.weixin.qq.com/s/DBi6yAIbUTvq5uQfm0XJTA — 微信公众号：Spring Boot 已过时的10个模式
[2] https://docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html
[3] https://docs.spring.io/spring-boot/reference/features/external-config.html
[4] https://docs.spring.io/spring-security/reference/servlet/configuration/java.html
[5] https://docs.spring.io/spring-framework/reference/integration/rest-clients.html
[6] https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/client/RestTemplate.html
[7] https://docs.spring.io/spring-framework/docs/5.3.x/javadoc-api/org/springframework/web/servlet/config/annotation/WebMvcConfigurerAdapter.html
[8] https://docs.spring.io/spring-security/site/docs/5.7.0/api/org/springframework/security/config/annotation/web/configuration/WebSecurityConfigurerAdapter.html
[9] https://docs.spring.io/spring-boot/docs/3.0.0/reference/htmlsingle
[10] https://docs.spring.io/spring-boot/reference/features/developing-auto-configuration.html
[11] https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html
[12] https://docs.spring.io/spring-boot/docs/3.2.0/reference/htmlsingle
[13] https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html
