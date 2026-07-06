---
title: "Spring 三级缓存解决循环依赖 —— 完整讨论记录"
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
summary: "Spring 三级缓存解决循环依赖 —— 完整讨论记录"
tags:
---

# Spring 三级缓存解决循环依赖 —— 完整讨论记录

> 来源：微信面试讨论（2026-06-04）
> 核心考点：Spring IOC 循环依赖 + 三级缓存 + AOP 代理
> 源码注释版：[spring-three-level-cache-source-code.md](./spring-three-level-cache-source-code.md)

---

## 一、三级缓存的定义

| 级别 | 变量名 | 存什么 | 说明 |
|---|---|---|---|
| 一级 | `singletonObjects` | 完全初始化的成品 Bean | 所有依赖已解决，可直接使用 |
| 二级 | `earlySingletonObjects` | 早期暴露的引用 | **可能是原始对象，也可能是代理对象** |
| 三级 | `singletonFactories` | ObjectFactory（lambda） | **不是对象，是工厂（选择器）** |

**关键认知**：三级缓存存的不是"半成品对象"，而是一个 lambda 工厂。这个工厂的职责是：**在被调用时决定返回原始对象还是代理对象**。

```java
// 三级缓存的工厂
() -> getEarlyBeanReference("A", mbd, bean_A)
//  bean_A 已经 new 好了，工厂不负责创建
//  工厂只负责：要不要给这个对象套个代理壳
```

执行结果只有两种：
- A 没有 `@Transactional` → 返回原始 bean_A
- A 有 `@Transactional` → 返回 proxy_A

---

## 二、正常流程（没有 AOP 代理）

```
1. new A() → 属性全是 null 的原始对象
2. 工厂放三级缓存（lambda: 返回原始 A）
3. A 填充属性 → 发现需要 B → 触发 B 的创建
4. B 实例化 → 工厂放三级缓存
5. B 填充属性 → 发现需要 A → 从三级拿到 A 的工厂
6. 工厂执行 → 返回原始 A → 放入二级缓存
7. B 拿到原始 A → B 完成创建 → B 放入一级缓存
8. 回到 A → A 从一级拿到 B → A 完成创建 → A 放入一级缓存
```

**要点**：没代理时，二级缓存就是个"中转站"，同一个对象从二级搬到一级。

---

## 二、有 AOP 代理时的流程

假设 A 加了 `@Transactional`，需要生成代理：

```
第1步：new A() → 堆内存创建 bean_A（属性全是 null）
第2步：工厂放三级 → lambda: () -> getEarlyBeanReference(bean_A)
第3步：A 填充属性 → 发现需要 B → 触发 B 创建
第4步：B 填充属性 → 需要 A → 从三级拿到 A 的工厂
第5步：⭐ 工厂执行
       → getEarlyBeanReference(bean_A)
       → 发现 A 有 @Transactional → 生成 proxy_A
       → proxy_A 放入二级缓存
第6步：B 拿到 proxy_A → B 完成 → B 放入一级缓存
第7步：回到 A → A 继续填充属性 → 拿到 B
第8步：A 初始化（initializeBean）
       → 后置处理器发现 A 需要代理
       → 但 A 已被提前代理过（earlyProxyReferences 有标记）
       → 不重复生成代理
第9步：⭐ 对账
       earlySingletonReference = proxy_A（二级缓存）
       exposedObject = bean_A（初始化后还是原始对象）
       if (exposedObject == bean_A) → true → 用二级的 proxy_A
第10步：addSingleton("A", proxy_A) → 一级缓存放 proxy_A
```

**最终状态**：
- 一级缓存：A = proxy_A，B = bean_B
- B 持有的 A 引用 = proxy_A（同一个对象）

---

## 三、核心问题解答

### Q1：为什么要三级缓存？两级够不够？

```
没有 AOP 代理 → 两级够用
有 AOP 代理   → 必须三级

原因：三级缓存是一个"工厂（选择器）"，在被调用时才决定返回原始对象还是代理对象。
如果只有两级，实例化后直接存对象，此时还没执行后置处理器，判断不了要不要代理。
```

### Q2：B 在哪一级缓存？

```
B 不在任何缓存里等着 A 来拿。
A 的属性填充触发了 B 的"完整创建流程"：
  B 实例化 → 工厂放三级 → B 填充属性 → B 初始化 → B 直接进一级
等 B 到了一级缓存后，A 才继续从一级拿到 B。
```

### Q3：代理类和实例类的关系？

```
代理 = 壳 + target 指针
  代理对象 proxy_A 在堆内存中，内部持有 bean_A 的引用（指针）
  不是拷贝，是同一个堆内存地址

bean_A 的属性后来被填充了
  → proxy_A 调方法时转发给 bean_A
  → bean_A 现在有属性了 → 正常工作
```

### Q4：工厂返回原始对象还是代理？

```
A 没有 @Transactional → 工厂返回原始 bean_A → 放二级
A 有 @Transactional   → 工厂返回 proxy_A   → 放二级

不管返回什么，都放二级缓存，不直接放一级。
一级只在 Bean 完全创建完毕后才放。
```

### Q5：对账在什么时候？解决什么问题？

```
对账发生在 doCreateBean 的最后一步（initializeBean 之后，addSingleton 之前）

解决的问题：
  B 手里拿的是 proxy_A（从二级缓存）
  如果一级缓存放的是 bean_A（原始对象）
  → 同一个 Bean 两个不同对象，代理白做了

对账确保：一级的 A = proxy_A = B 拿到的 proxy_A → 指向同一个对象
```

### Q6：@Lazy 能解决循环依赖吗？

```
能，但本质是"绕开"而非"解决"。

原理：注入点创建代理，把依赖解析从启动期推迟到运行期首次调用时。
  A 创建 → 需要 B → B 标记 @Lazy → 给个代理 → A 完成
  → B 延迟到 A 完成后再创建 → B 需要 A → 从一级拿成品 ✅

缺点：
  - 运行时才报错，启动期发现不了问题
  - 有 NPE 风险
  - 本质是掩耳盗铃，设计问题还在
```

### Q7：构造器注入为什么解决不了循环依赖？

```
三级缓存的前提：Bean 已经实例化（对象在堆内存中）
构造器注入：在实例化阶段就需要依赖 → 对象还没创建 → 三级缓存无法介入
字段注入：实例化后才注入属性 → 实例化和注入分离 → 三级缓存能介入
```

### Q8：原型（Prototype）Bean 为什么不行？

```
原型 Bean 每次获取都新建实例，不走缓存 → 三级缓存机制无效
单例 Bean 由容器缓存管理，中间状态可以共享 → 三级缓存能介入
```

---

## 四、整体缓存流转图

```
三级缓存（singletonFactories）     二级缓存（earlySingletonObjects）     一级缓存（singletonObjects）
┌─────────────────────┐          ┌──────────────────────┐          ┌──────────────────────┐
│ A 的 ObjectFactory  │          │                      │          │                      │
│ B 的 ObjectFactory  │          │                      │          │                      │
└─────────┬───────────┘          └──────────────────────┘          └──────────────────────┘
          │                                                      
          │ B 来拿 A，工厂执行                                       
          │ 返回 proxy_A（或原始 A）                                 
          ▼                                                      
┌─────────────────────┐          ┌──────────────────────┐          
│ A 的工厂已执行       │          │ A: proxy_A           │          
│ 三级清掉 A           │ ──────→  │                      │          
└─────────────────────┘          └──────────────────────┘          
                                                              
                                                    B 完成创建      
                                                    ▼              
                                         ┌──────────────────────┐  
                                         │ A: proxy_A           │  
                                         │ B: bean_B            │  
                                         │                      │  
                                         │ 二级/三级已清空        │  
                                         └──────────────────────┘  
```

---

## 五、面试答题模板

**Q：Spring 如何通过三级缓存解决循环依赖？**

> 1. **三级缓存定义**：一级存成品 Bean，二级存早期引用（原始或代理），三级存 ObjectFactory 工厂
> 2. **核心流程**：A 实例化后将 ObjectFactory 放入三级缓存，填充属性时发现需要 B，触发 B 创建。B 填充属性时需要 A，从三级拿到 A 的工厂并执行——如果 A 需要代理就提前生成代理，结果放入二级缓存。B 拿到 A 的早期引用后完成创建进入一级缓存，A 继续完成也进入一级缓存
> 3. **为什么需要三级**：三级存的是工厂而非对象，工厂在被调用时才决定返回原始对象还是代理对象。如果只有两级，实例化后直接存对象，此时还无法判断是否需要代理
> 4. **构造器注入不行**：因为实例化阶段就需要依赖对象，而三级缓存的前提是对象已实例化
> 5. **对账保证一致性**：Bean 创建完毕后，检查二级缓存的早期引用和最终对象是否一致，确保整个容器中同一个 Bean 只有一个对象

---

## 七、三级缓存搞不定的场景（生产常见坑）

### 1. 原型（Prototype）Bean

```java
@Scope("prototype")
@Service
public class OrderService {
    @Autowired
    private UserService userService;
}

@Scope("prototype")
@Service  
public class UserService {
    @Autowired
    private OrderService orderService;
}
```

**原因**：原型 Bean 每次创建都 new 新的，不走缓存，三级缓存机制无效。

### 2. @Async + 循环依赖（生产常见坑）

```java
@Service
public class OrderService {
    @Async  // 异步代理
    @Autowired
    private UserService userService;
}

@Service
public class UserService {
    @Autowired
    private OrderService orderService;
}
```

**原因**：`@Async` 的代理是在 `initializeBean` 阶段才生成的（通过 `AsyncAnnotationBeanPostProcessor`，只是 `BeanPostProcessor`），而 `@Transactional` 的代理是在 `getEarlyBeanReference` 阶段就生成的（通过 `AbstractAutoProxyCreator`，是 `SmartInstantiationAwareBeanPostProcessor`）。

```
@Transactional → SmartInstantiationAwareBeanPostProcessor → 工厂能提前生成代理 ✅
@Async → AsyncAnnotationBeanPostProcessor（只是 BeanPostProcessor）→ 工厂不处理 ❌
```

结果：B 拿到的是原始 A，不是异步代理，异步不生效。

### 3. BeanPostProcessor 自身循环依赖

```java
@Component
public class MyPostProcessor implements BeanPostProcessor {
    @Autowired
    private SomeService someService;
}

@Service
public class SomeService {
    @Autowired
    private MyPostProcessor myPostProcessor;
}
```

**原因**：`BeanPostProcessor` 在所有普通 Bean 创建之前就实例化了。此时容器还在初始化阶段，三级缓存机制还没准备好，直接报 `BeanCurrentlyInCreationException`。

### 4. @Lazy 只解决了一半

```java
@Service
public class A {
    @Lazy
    @Autowired
    private B b;
    
    public void doWork() {
        b.process();  // 运行时才触发 B 创建
        // 如果 B 创建失败 → 运行时 NPE，启动期发现不了
    }
}

@Service
public class B {
    @Autowired
    private A a;  // B 创建时 A 已经完成，从一级拿 ✅
}
```

虽然能跑，但把问题推迟到运行时。生产中如果 B 创建有依赖配置缺失，启动不报错，调用时才崩。

### 5. Spring Boot 2.6+ 默认禁止循环依赖

```yaml
# Spring Boot 2.6 开始，默认不允许循环依赖
spring:
  main:
    allow-circular-references: false  # 默认值
```

直接启动就报错，三级缓存根本没机会发挥。

> **待补充**：用户生产中遇到的具体场景，待确认后补充根因和解法。

---

## 八、相关阅读

- [Spring 三级缓存源码逐行注释](./spring-three-level-cache-source-code.md)
- 腾讯云文章分析：[深度解析Spring核心原理：循环依赖的"三级缓存"机制](https://cloud.tencent.com/developer/article/2560610)（数据有编造，核心知识点可参考）
