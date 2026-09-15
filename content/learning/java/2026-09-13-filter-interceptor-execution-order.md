---
title: "Filter 与 Interceptor 执行顺序：一次说清（附本机实测 trace）"
date: "2026-09-13"
domain: "学习"
area: "Java 后端"
module: "Spring 生态"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "Filter/Interceptor 的出身差异、完整执行链、注册顺序控制与四个高频陷阱，全部结论带本机 trace 实测或官方 Javadoc 证据"
tags: [spring-mvc, servlet, filter, interceptor, 执行顺序]
source: "微信公众号「话喵师」"
source_url: "https://mp.weixin.qq.com/s/WNUh4vlGQxaVByDXT_sLiw"
published_at: "2026-09-13 10:23 (北京时间)"
---

# Filter 与 Interceptor 执行顺序：一次说清（附本机实测 trace）

> 来源：微信公众号「话喵师」《Spring 拦截器与过滤器到底先走谁？执行顺序一次说清》，2026-09-13 发布 [1]。
> 本稿在原文基础上重构整理，并用本机最小复现工程实测验证：Spring Boot 3.5.16 / Spring Framework 6.2.19 / Tomcat 10.1.55 / JDK 17（实测 trace 证据见文末）。与原文不一致处以【勘误】标注。

## 一、一句话定位：出身不同，管辖范围不同

- **Filter**：Servlet 规范组件（Spring Boot 3.x 起为 `jakarta.servlet.Filter`），由 Servlet 容器管理。官方定义："A filter is an object that performs filtering tasks on either the request to a resource (a servlet or static content), or on the response from a resource, or both." [3]
- **Interceptor**：Spring MVC 组件（`HandlerInterceptor`），由 `DispatcherServlet` 管理，只在匹配到 Handler 的请求上生效；preHandle 的官方定位是 "Interception point before the execution of a handler. Called after HandlerMapping determined an appropriate handler object, but before HandlerAdapter invokes the handler" [2]。

**执行顺序铁律**：Filter 在请求进入 Spring 之前生效；Interceptor 在 DispatcherServlet 找到 Handler 之后、Controller 之前生效。Filter 不放行（不调 `chain.doFilter()`），Interceptor 根本不会触发 [1]。

## 二、完整执行链（本机实测 trace）

一次正常请求（`/ok`，@RestController 返回字符串）的完整顺序：

```text
Filter1.before
Filter2.before
WfFilter(@Order HIGHEST).before        ← Ordered.HIGHEST_PRECEDENCE 的 Filter 最先
Interceptor1.preHandle(true)
Interceptor2.preHandle(true)
Controller                             ← handler 执行
ResponseBodyAdvice.beforeBodyWrite     ← 消息转换器序列化在这里
Interceptor2.postHandle(mv=null, committed=true)
Interceptor1.postHandle(mv=null, committed=true)
Interceptor2.afterCompletion(ex=null)
Interceptor1.afterCompletion(ex=null)
WfFilter.after
Filter2.after
Filter1.after
```

要点：

1. Filter 链正序进、逆序出；Interceptor 的 preHandle 正序，postHandle/afterCompletion 逆序——官方 Javadoc 明确 "the method will be invoked on each interceptor in the chain in reverse order, so the first interceptor will be the last to be invoked" [2]。
2. `@ResponseBody` 场景下 postHandle 拿到的 `mv=null` 且响应已提交（trace 中 `committed=true`）。postHandle 的官方定位是 "Called after HandlerAdapter actually invoked the handler, but before the DispatcherServlet renders the view" [2]——它服务于**视图渲染前**补充模型，而 JSON 序列化在 handler 返回时就完成了，根本没有"视图渲染"阶段。
3. Controller 抛未被 `@ExceptionHandler` 接住的异常时，两个 Interceptor 的 afterCompletion 都收到 `ex=UnsupportedOperationException`；被 `@ExceptionHandler` 接住时 afterCompletion 收到 `ex=null`（异常已在 MVC 内部消化）。清理 ThreadLocal 放 afterCompletion 是对的。

## 三、preHandle 返回 false 后的链路（实测 `/blocked`）

```text
Filter1.before → Filter2.before → WfFilter.before
Interceptor1.preHandle(true)
Interceptor2.preHandle(deny->false)    ← 拒绝
Interceptor1.afterCompletion(ex=null)  ← 只有已放行的 Interceptor1 收尾
WfFilter.after → Filter2.after → Filter1.after
```

- 拒绝方自己（Interceptor2）的 afterCompletion **不执行**——官方 Javadoc："Will only be called if this interceptor's preHandle method has successfully completed and returned true" [2]。
- 此前已返回 true 的 Interceptor1 的 afterCompletion 仍会执行；postHandle 全部跳过 [1]。
- Filter 链完整走完（before 之后 chain.doFilter 返回，after 段照常执行）。

## 四、注册与顺序控制

### Filter（Spring Boot）

```java
// 方式一：FilterRegistrationBean（推荐，可控顺序与参数）
@Bean
public FilterRegistrationBean<TraceFilter> traceFilter() {
    FilterRegistrationBean<TraceFilter> bean = new FilterRegistrationBean<>();
    bean.setFilter(new TraceFilter());
    bean.addUrlPatterns("/*");
    bean.setOrder(1); // 数值越小越先执行
    return bean;
}
```

- **顺序坑**：`@WebFilter`（配合 `@ServletComponentScan`）注册的 Filter，类上加 Spring 的 `@Order` 不生效——Servlet 规范不识别 Spring 注解；可靠手段只有 `FilterRegistrationBean.setOrder()` [1]。
- 直接 `@Component` 注册的 Filter Bean 会被 Boot 自动注册到所有 URL，顺序可用 `@Order`/`Ordered` 控制（trace 中 `WfFilter(@Order HIGHEST)` 最先执行即此机制）。

### Interceptor（Spring MVC）

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Autowired
    private AuthInterceptor authInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/login");
    }
}
```

注册顺序决定 preHandle 正序；postHandle/afterCompletion 自动逆序 [1][2]。

## 五、404 与 /error 分发的真实行为（实测，修正原文）

**【勘误 1】原文说"原始 404 请求 Interceptor 不会触发"——在默认 Spring Boot 下不成立。**

实测 `GET /notfound-xyz` 的 trace：

```text
REQUEST /notfound-xyz
Filter1.before → Filter2.before → WfFilter.before
Interceptor1.preHandle(true, handler=ResourceHttpRequestHandler)   ← 拦截器执行了！
Interceptor2.preHandle(true, handler=ResourceHttpRequestHandler)
Interceptor2.afterCompletion → Interceptor1.afterCompletion
WfFilter.after → Filter2.after → Filter1.after

ERROR /error
Interceptor1.preHandle(true, handler=HandlerMethod)   ← BasicErrorController 是真实 Handler
...（/error 这次分发没有 Filter——默认 Filter 只注册 REQUEST 类型）
```

- Spring Boot 默认把 `/**` 映射到 `ResourceHttpRequestHandler`（静态资源兜底），404 请求**匹配到了 Handler**，所以拦截器照常执行（只是 handler 不是 HandlerMethod）。"找不到 Handler 就没有执行链"只在关闭静态资源映射（`spring.web.resources.add-mappings=false`）或非 Boot 纯 MVC 场景成立。
- 错误转发到 `/error`（ERROR 分发）时，`BasicErrorController` 是真实 Handler，路径覆盖 `/error` 的拦截器会**再执行一次**；而默认注册的 Filter 不含 ERROR 分发类型，不会重复执行 [1][4]。Boot 官方文档：需要 Filter 覆盖 ERROR 分发时必须显式 "registered as an ERROR dispatcher" [4]。
- 实测静态资源 `/hello.txt` 同样完整走 Filter + Interceptor 链（handler=ResourceHttpRequestHandler）。**【勘误 2】原文"Interceptor 仅拦截 DispatcherServlet 映射的 Handler"容易让人以为静态资源不经过拦截器——在 Boot 下静态资源就是一个 Handler，会经过。**

## 六、【勘误 3】postHandle 里改响应头：默认配置下无效

原文 Q3 称 @ResponseBody 场景 postHandle "可以修改 response 响应头"。实测（20KB 大响应）postHandle 时 `committed=true`，此时 `response.setHeader()` 静默失效——Tomcat 缓冲默认 8KB，响应体超过缓冲或已刷出即提交。只有响应体足够小、仍在缓冲内时才可能改头成功。这不是"能不能改"的确定行为，而是**取决于响应是否已提交**；写代码时不要依赖它，需要改响应头应使用 Filter（包裹 response）或 `ResponseBodyAdvice`/`HandlerInterceptor.preHandle` 阶段。

## 七、高频问答速查

| 问题 | 答案 | 证据 |
| --- | --- | --- |
| Interceptor 能拦到 Filter 没放行的请求吗 | 不能，请求到不了 DispatcherServlet | 原文 [1] |
| preHandle=false 后自己的 afterCompletion 执行吗 | 不执行；之前已放行的 Interceptor 逆序执行 afterCompletion | Javadoc [2] + 实测 `/blocked` |
| @RestController 下 postHandle 有用吗 | mv 恒为 null、响应多已提交；收尾逻辑放 afterCompletion | Javadoc [2] + 实测 `/ok` |
| Boot 3.x 迁移 Filter 注意什么 | 包名 javax.servlet → jakarta.servlet（Boot 2.7 仍是 javax） | 原文 [1] |
| 404 请求经过 Filter/Interceptor 吗 | Filter 经过；Interceptor 在 Boot 默认配置下也经过（ResourceHttpRequestHandler），随后 /error 分发再经过一次 Interceptor、不经过 Filter | 实测 + [4] |

## 八、选型

- **选 Filter**：编码、跨域、请求/响应日志、XSS 过滤、包装原始 request/response 流；Filter 作用于 "the request to a resource (a servlet or static content)"，覆盖所有请求（含静态资源与错误分发，ERROR 分发需显式注册 DispatcherType）[3][4]。
- **选 Interceptor**：登录态校验、基于 HandlerMethod 的方法级权限、业务埋点、ThreadLocal 上下文注入与清理（afterCompletion）。
- 生产建议：入口层通用能力用 Filter，业务语义强、需要 Spring Bean/HandlerMethod 的用 Interceptor；同一件事不要在两层重复做 [1]。

## 本机实测环境与方法

- Spring Boot 3.5.16、Spring Framework 6.2.19、Tomcat 10.1.55、JDK 17（用于核验原文 [1] 的全部顺序主张）。
- 最小工程：两个 FilterRegistrationBean Filter + 一个 @Order(HIGHEST_PRECEDENCE) Filter + 两个 Interceptor + ResponseBodyAdvice，全部钩子把事件写入共享 trace 列表，通过 `/__trace` 导出 JSON。
- 覆盖场景：正常返回、preHandle 拒绝、Controller 抛异常（被/不被 @ExceptionHandler 接住）、静态资源、404（GET/POST）、大响应体（20KB）提交状态。
- trace 原始 JSON 证据文件：`/tmp/final-verify/trace.json`、`r4_summary.txt`、`r4_big_headers.txt`（本机留存）。

## 关联本仓库资料

- Spring 生态同模块文章见 `content/learning/java/` 目录（module: Spring 生态）。

## Sources

[1] https://mp.weixin.qq.com/s/WNUh4vlGQxaVByDXT_sLiw — Spring 拦截器与过滤器到底先走谁？执行顺序一次说清
[2] https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/HandlerInterceptor.html — Spring Framework Javadoc: HandlerInterceptor
[3] https://tomcat.apache.org/tomcat-10.1-doc/servletapi/jakarta/servlet/Filter.html — Jakarta Servlet 6.0 Javadoc: Filter (Tomcat 10.1)
[4] https://docs.spring.io/spring-boot/reference/web/servlet.html — Spring Boot Reference: Servlet Web Applications
