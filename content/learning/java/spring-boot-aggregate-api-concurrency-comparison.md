---
title: "Spring Boot 聚合API查询，3种方式性能对比（虚拟线程+结构化并发，CompletableFuture）"
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
summary: "Spring Boot 聚合API查询，3种方式性能对比（虚拟线程+结构化并发，CompletableFuture）"
tags:
---

# Spring Boot 聚合API查询，3种方式性能对比（虚拟线程+结构化并发，CompletableFuture）

类型：📚 参考资料（非面试题/面经）

---

## 1. 简介

在高并发的应用场景中，如何高效地处理多个并行任务成为了提升系统性能的关键。传统的顺序调用方式由于同步执行的特性，在处理多个请求时效率低下。而在Java并发编程中，CompletableFuture和结构化并发（虚拟线程结合StructuredTaskScope）等新技术为开发者提供了更高效的并发处理方案。

本篇文章将测试对比顺序调用、CompletableFuture和结构化并发三种方式在处理并行执行多个任务时性能差异，以便为实际项目中选择合适的并发策略提供参考。

## 2. 实战案例

### 2.1 准备环境

```java
@Entity
@Table(name = "o_user")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    private String name;
    private String sex;
    private String phone;
    private Integer age;
}
```

准备近400w的数据，数据库连接池配置：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:***
```

### 2.2 Controller层

```java
@RestController
@RequestMapping("/users")
public class UserController {
    private final UserService userService;
    
    public UserController(UserService userService) {
        this.userService = userService;
    }
    
    @GetMapping("/sequential")
    public ResponseEntity<?> complexQuerySequential() {
        return ResponseEntity.ok(this.userService.complexQuerySequential());
    }
    
    @GetMapping("/completablefuture")
    public ResponseEntity<?> complexQueryCompletableFuture() {
        return ResponseEntity.ok(this.userService.complexQueryCompletableFuture());
    }
    
    @GetMapping("/vt")
    public ResponseEntity<?> complexQueryVirtualThreadStructuredConcurrent() {
        return ResponseEntity.ok(this.userService.complexQueryVirtualThreadStructuredConcurrent());
    }
}
```

### 2.3 测试结果

通过JMeter对3个接口进行测试，结果如下：

| 方式 | 响应时间 | 吞吐量 | 适用场景 |
|------|---------|--------|---------|
| 顺序调用 | 最高 | 最低 | 请求数少或实时性要求不高 |
| CompletableFuture | 最低 | 最高 | 性能要求高 |
| 结构化并发 | 中等 | 中等 | 代码可维护性和可靠性要求高 |

## 3. 总结

### CompletableFuture性能最佳
在本次测试中，CompletableFuture表现出了最低的响应时间和最高的吞吐量，适合对性能要求较高的场景。

### 结构化并发可靠性高
虽然响应时间和吞吐量不如CompletableFuture，但结构化并发在任务管理和错误处理方面具有优势，适合对代码可维护性和可靠性要求较高的场景。

### 顺序调用效率最低
顺序调用由于同步执行的特性，在处理多个请求时效率最低，仅适用于请求数量较少或对实时性要求不高的场景。

## 4. 关键知识点

### CompletableFuture
- Java 8引入的异步编程工具
- 支持链式调用、组合多个异步任务
- 适用于IO密集型任务并行处理

### 结构化并发（Structured Concurrency）
- Java 21引入的新特性
- 基于虚拟线程（Virtual Thread）
- 使用StructuredTaskScope管理并发任务
- 提供更好的任务生命周期管理和错误传播

### 顺序调用
- 传统的同步执行方式
- 代码简单但效率低
- 适用于简单场景

---

原始链接：https://mp.weixin.qq.com/s/uvMJHqm47stjhdjOP1u77A
