---
title: "Spring Bean 生命周期全解：四阶段与 16 个扩展点"
date: "2026-08-31"
domain: "学习"
area: "Java 后端"
module: "Spring 生态"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "Bean 从实例化到销毁的四阶段 16 个扩展点逐一拆解，含 Aware 家族、BeanPostProcessor、初始化/销毁回调的官方标准顺序，以及原文勘误与三个高频坑。"
tags:
  - Spring
  - Bean生命周期
  - IOC
  - AOP
source: "https://mp.weixin.qq.com/s/0WeiAxuReGFuPEG_l2ZvvQ"
---

# Spring Bean 生命周期全解：四阶段与 16 个扩展点

> 来源：微信公众号「程序员1970」（作者：五散人），2026-08-20
> 勘误说明：原文有两处回调顺序与 Spring 官方文档相反，本文按官方顺序整理并在「原文勘误」标注

## 一、Bean 的一生：四阶段总览

```
实例化 → 属性填充 → 初始化 → 使用 → 销毁
   ↓         ↓         ↓            ↓
 构造器    @Autowired  Aware 家族   @PreDestroy
 实例化前/后  @Value     BeanPostProcessor  DisposableBean
 处理器                @PostConstruct / InitializingBean
```

大多数开发者只知道 @PostConstruct 和 @Autowired，对中间那些"暗桩"一无所知——而恰恰是它们承载了 AOP 代理、事务管理、缓存填充、监控埋点等核心能力。

## 二、16 个扩展点逐一拆解

### 阶段一：实例化（Instantiation）

**扩展点 1：构造器**——Bean 创建第一步。Spring 4.3+ 有参构造自动推断（无需 @Autowired）。坑：构造器中不要做任何生命周期相关操作——属性还没注入，调用依赖方法必抛 NPE。

**扩展点 2：`InstantiationAwareBeanPostProcessor.postProcessBeforeInstantiation`**——唯一能在实例化之前干预的扩展点。返回非 null → Spring 用该对象代替原本要创建的 Bean（可做自定义代理/替换 Bean 定义）；返回 null → 走正常流程。注意触发频率极高，实现必须快速返回。

**扩展点 3：工厂方法推断**——@Bean 方法本质是工厂方法，实例化阶段解析。坑：@Bean 方法内部调用另一个 @Bean 方法，Spring 默认走 CGLIB 代理而非直接调用目标方法（拿到的是代理对象），需要 @Scope("prototype") 或 ObjectProvider 解耦。

### 阶段二：属性填充（Populate Properties）

**扩展点 4：`postProcessAfterInstantiation`**——实例化完成但属性未注入时触发；返回 false 表示跳过后续属性填充和初始化。

**扩展点 5：AutowiredAnnotationBeanPostProcessor**——@Autowired/@Value 生效的幕后推手，扫描字段和 setter 注入。坑：required 默认 true，注入失败直接抛 NoSuchBeanDefinitionException；设 false 容错但可能运行时 NPE，建议配合 @NonNull。

**扩展点 6：CommonAnnotationBeanPostProcessor**——处理 @Resource、@PostConstruct、@PreDestroy 等 JSR-250 注解。

**扩展点 7：@Value 属性解析**——占位符 + SpEL（`${app.timeout:3000}` 默认值、`#{T(...)}` SpEL 表达式）。坑：SpEL 引用其他 Bean 可能出现循环依赖（属性填充阶段就要解析，目标 Bean 可能还没建完）。

### 阶段三：初始化（Initialization）——扩展点最密集

**Aware 家族（扩展点 8-11）**，都在属性注入完成后触发：
- 8. `BeanNameAware.setBeanName` — 感知容器中的名字
- 9. `BeanClassLoaderAware.setBeanClassLoader` — 获取 ClassLoader
- 10. `BeanFactoryAware.setBeanFactory` — 拿到 BeanFactory 手动 getBean（绕过 @Autowired）
- 11. `EnvironmentAware.setEnvironment` — 获取环境配置（activeProfiles 等）

**扩展点 12：`BeanPostProcessor.postProcessBeforeInitialization`**——初始化方法执行之前的钩子，AOP 代理创建入口（AbstractAutoProxyCreator 的 wrapIfNecessary 在这里判断是否需要代理）。

**扩展点 13：`InitializingBean.afterPropertiesSet`**
**扩展点 14：`@PostConstruct`**

> ⚠️ **官方标准顺序：`@PostConstruct` → `afterPropertiesSet()` → 自定义 init()**（原文写反了，见勘误）

**扩展点 15：`BeanPostProcessor.postProcessAfterInitialization`**——初始化完成后的最后一个钩子，AOP 代理最终确认（已是 Advised 直接返回，不重复包装）。

### 阶段四：使用与销毁

**扩展点 16：`DisposableBean.destroy` + `@PreDestroy`**

> ⚠️ **官方标准顺序：`@PreDestroy` → `destroy()` → 自定义 destroy()**（原文写反了，见勘误）

销毁触发条件：容器正常关闭（ContextClosedEvent）；原型 Bean 被 GC（需配置 destroy-method）；单例被手动移除（极少用）。

## 三、官方标准执行顺序（Spring 官方文档为准）

初始化回调（多个机制配置同一 Bean 时，按此顺序）：
1. `@PostConstruct` 注解方法
2. `InitializingBean.afterPropertiesSet()`
3. 自定义 init()（init-method / @Bean(initMethod)）

销毁回调（同一顺序）：
1. `@PreDestroy` 注解方法
2. `DisposableBean.destroy()`
3. 自定义 destroy()（destroy-method / @Bean(destroyMethod)）

**两个关键官方事实**：
- **初始化回调作用于原始 Bean（raw bean reference），此时 AOP 拦截器尚未应用**——先完整创建目标 Bean，再包 AOP 代理
- @PostConstruct 等初始化方法在**单例创建锁内**执行；昂贵且耗时的初始化（异步 DB 准备等）应放 SmartInitializingSingleton.afterSingletonsInstantiated() 或 @EventListener(ContextRefreshedEvent)，否则有初始化死锁风险

## 四、原文勘误（面试答错顺序很致命）

| # | 原文说法 | 官方正确顺序 |
|---|---------|-------------|
| 1 | "执行顺序：afterPropertiesSet → @PostConstruct" | **@PostConstruct → afterPropertiesSet → 自定义 init()** |
| 2 | "销毁顺序：DisposableBean.destroy() → @PreDestroy" | **@PreDestroy → destroy() → 自定义 destroy()** |
| 3 | "@PostConstruct 里拿到的 this 已经可能是代理对象" | 标准流程下初始化回调在**原始 Bean** 上执行，代理尚未应用；只有循环依赖三级缓存的 early proxy 场景才可能拿到早期代理 |

## 五、三个高频坑

1. **@PostConstruct 里 this 不是原始对象**（原文坑一，需限定场景）：被 AOP 代理时，@PostConstruct 中调用自身方法是否经过代理取决于代理创建时机——标准流程初始化回调先于代理，但循环依赖场景可能拿到早期代理。稳妥做法：初始化逻辑抽到独立非 Bean 类，或用 @Lazy 绕过
2. **循环依赖下 @PostConstruct 的执行时机**（原文坑二）：A→B→A 循环依赖靠三级缓存解决，但早期引用对象可能还没完成初始化，@PostConstruct 依赖另一个循环 Bean 的完整状态会拿到半成品
3. **Prototype Bean 销毁不自动触发**（原文坑三）：默认只有 Singleton 的 destroy 被容器调用；Prototype 需显式 destroy-method 或手动注册销毁回调

## 六、一句话理解

16 个扩展点是把"对象创建"从简单的 new 拆成一条精密流水线。理解它才能真正搞懂：为什么 AOP 在初始化回调之后生效、为什么 @Autowired 可能注入失败、为什么容器关闭时某些资源没释放。这些扩展点用过 5 个以上的，才算真正懂 Spring。
