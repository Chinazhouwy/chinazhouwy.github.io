---
schema_version: 1
question_id: 15
question: "Spring Bean 的完整生命周期是怎样的？三级缓存如何解决循环依赖问题？"
date: 2026-06-03
sources:
  - unknown
score: "4/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
# 第15题 — Spring Bean 生命周期 + 三级缓存循环依赖

> **题目**：Spring Bean 的完整生命周期是怎样的？三级缓存如何解决循环依赖问题？
> **追问**：为什么不能只用二级缓存？构造器注入为什么无法解决循环依赖？

---

## 得分：4/10

### ✅ 答对的部分
1. 生命周期大框架正确：实例化 → 属性填充 → 使用 → 销毁
2. 意识到每个环节有扩展点（拦截器/回调）
3. 三级缓存核心思路正确：发现循环依赖 → 先放低级别缓存 → 逐步提升
4. 构造器注入的回答切中要害：构造器阶段就要完整对象

### ❌ 问题
1. 生命周期缺少具体扩展点名称（BeanPostProcessor、Aware接口族、InitializingBean等）
2. 三级缓存描述太模糊：每级缓存存什么？为什么是三级不是二级？核心区分点没讲
3. 缺少Bean作用域、@Autowired注入时机等关键细节

---

## 一、Spring Bean 完整生命周期（场景化讲解）

### 生产场景

想象你在用 Spring 写一个 `OrderService`：

```java
@Service
public class OrderService implements ApplicationContextAware, InitializingBean {
    
    @Autowired
    private UserService userService;  // 依赖注入
    
    @Override
    public void afterPropertiesSet() {  // 初始化回调
        System.out.println("属性设置完毕，初始化中...");
    }
    
    @Override
    public void setApplicationContext(ApplicationContext ctx) {  // Aware回调
        System.out.println("容器已注入");
    }
}
```

Spring 容器启动时，这个 Bean 要经历 **12个步骤**：

### 完整流程（必须记住的顺序）

```
1. BeanDefinition 加载    ← XML/@Component/@Bean 解析成 BeanDefinition 对象
          ↓
2. 实例化（Instantiation）← 构造器调用，创建原始对象（此时还没有属性）
          ↓
3. 属性填充（Populate）   ← @Autowired、@Value 等依赖注入
          ↓
4. Aware 回调             ← BeanNameAware → BeanFactoryAware → ApplicationContextAware
          ↓
5. BeanPostProcessor 前置处理 ← postProcessBeforeInitialization()
          ↓
6. @PostConstruct ← JSR-250 初始化回调
          ↓
7. InitializingBean.afterPropertiesSet() ← 初始化回调
          ↓
8. 自定义 init-method     ← @Bean(initMethod="init") 指定的方法
          ↓
9. BeanPostProcessor 后置处理 ← postProcessAfterInitialization() → AOP代理通常在这里生成！
          ↓
10. Bean 就绪，放入容器    ← 可以被 @Autowired 使用了
          ↓
11. 容器关闭
          ↓
12. DisposableBean.destroy() ← 销毁回调
          ↓
13. 自定义 destroy-method  ← @Bean(destroyMethod="cleanup")
```

### 面试必答的扩展点

| 扩展点 | 作用 | 常见用法 |
|--------|------|----------|
| **BeanPostProcessor** | 在初始化前后拦截所有 Bean | AOP 代理生成、@Async 注解处理、@Transactional 注解处理 |
| **Aware 接口族** | Bean 感知容器环境 | ApplicationContextAware 获取容器、BeanFactoryAware 获取工厂 |
| **InitializingBean** | 初始化回调 | 检查必要属性是否已注入 |
| **init-method** | 自定义初始化 | 连接池预热、缓存预加载 |
| **@PostConstruct** | JSR-250 标准初始化 | 最常用的初始化注解 |

### ⚠️ 关键点：AOP 代理在第 8 步生成

BeanPostProcessor 后置处理阶段，`AbstractAutoProxyCreator` 会判断当前 Bean 是否需要代理：
- 有 `@Aspect` / `@Transactional` / `@Async` → 生成代理对象（JDK 或 CGLIB）
- 没有 → 返回原始对象

**这就是为什么 Spring 中拿到的 Bean 可能不是原始类，而是代理类。**

---

## 二、三级缓存解决循环依赖

### 生产场景

```java
@Service
public class OrderService {
    @Autowired
    private UserService userService;  // 依赖 UserService
}

@Service
public class UserService {
    @Autowired
    private OrderService orderService;  // 又依赖 OrderService → 循环依赖！
}
```

### 三级缓存到底是什么？

Spring 的 `DefaultSingletonBeanRegistry` 中有三个 Map：

| 缓存 | Map 名 | 存什么 | 作用 |
|------|--------|--------|------|
| **一级缓存** | `singletonObjects` | 完整的 Bean 实例 | 最终成品，所有初始化完成的 Bean 都在这里 |
| **二级缓存** | `earlySingletonObjects` | 提前暴露的半成品 Bean | 解决循环依赖的中间态 |
| **三级缓存** | `singletonFactories` | `ObjectFactory`（lambda 表达式） | 延迟创建代理对象的工厂 |

### 循环依赖解决全流程

```
场景：OrderService 依赖 UserService，UserService 依赖 OrderService

步骤1：创建 OrderService
  → 实例化 OrderService（原始对象，属性为空）
  → 将 OrderService 的 ObjectFactory 放入【三级缓存】

步骤2：OrderService 需要注入 UserService
  → 发现 UserService 还没创建 → 先去创建 UserService

步骤3：创建 UserService
  → 实例化 UserService（原始对象，属性为空）
  → 将 UserService 的 ObjectFactory 放入【三级缓存】

步骤4：UserService 需要注入 OrderService
  → 查【一级缓存】→ 没有
  → 查【二级缓存】→ 没有
  → 查【三级缓存】→ 找到 OrderService 的 ObjectFactory
  → 执行 ObjectFactory.getObject()
      → 如果有 AOP → 返回代理对象 → 放入【二级缓存】→ 从三级缓存移除
      → 如果没 AOP → 返回原始对象 → 放入【二级缓存】→ 从三级缓存移除
  → UserService 拿到 OrderService 的引用，完成属性填充

步骤5：UserService 初始化完成
  → 放入【一级缓存】→ 从三级缓存移除

步骤6：回到 OrderService，继续注入 UserService
  → 查【一级缓存】→ 找到 UserService ✓
  → OrderService 初始化完成 → 放入【一级缓存】

结果：两个 Bean 都正常创建，循环依赖完美解决！
```

### Demo：代码演示三级缓存的流转

```java
/**
 * 模拟 Spring DefaultSingletonBeanRegistry 的三级缓存
 * 关键：理解 ObjectFactory 的延迟执行机制
 */
public class ThreeLevelCacheDemo {

    // 一级缓存：完整的 Bean
    private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>();
    // 二级缓存：提前暴露的半成品
    private final Map<String, Object> earlySingletonObjects = new ConcurrentHashMap<>();
    // 三级缓存：ObjectFactory（延迟工厂）
    private final Map<String, ObjectFactory<?>> singletonFactories = new ConcurrentHashMap<>();

    // 三级缓存的核心接口
    @FunctionalInterface
    interface ObjectFactory<T> {
        T getObject();  // 延迟创建，可能返回代理对象
    }

    /**
     * 模拟获取 Bean 的过程
     * 关键逻辑：从三级缓存逐步往一级查
     */
    @SuppressWarnings("unchecked")
    public <T> T getSingleton(String beanName) {
        // 1. 先查一级缓存
        Object singleton = singletonObjects.get(beanName);
        if (singleton != null) {
            return (T) singleton;
        }

        // 2. 再查二级缓存
        singleton = earlySingletonObjects.get(beanName);
        if (singleton != null) {
            return (T) singleton;
        }

        // 3. 最后查三级缓存
        ObjectFactory<?> factory = singletonFactories.get(beanName);
        if (factory != null) {
            // 执行 ObjectFactory → 可能返回代理对象！
            Object earlyRef = factory.getObject();
            earlySingletonObjects.put(beanName, earlyRef);
            singletonFactories.remove(beanName);  // 三级→二级
            return (T) earlyRef;
        }

        return null;
    }

    /**
     * 演示：OrderService 和 UserService 的循环依赖
     */
    public static void main(String[] args) {
        ThreeLevelCacheDemo demo = new ThreeLevelCacheDemo();

        // 模拟步骤1：创建 OrderService，放入三级缓存
        demo.singletonFactories.put("orderService", () -> {
            System.out.println("三级缓存执行：创建 OrderService 的早期引用");
            return new Object();  // 实际是原始对象或代理对象
        });

        // 模拟步骤2-3：创建 UserService 时需要 OrderService
        Object orderService = demo.getSingleton("orderService");
        // → 查一级没有，查二级没有，查三级有 → 执行 ObjectFactory
        // → 输出："三级缓存执行：创建 OrderService 的早期引用"
        // → 放入二级缓存

        System.out.println("UserService 拿到 OrderService: " + orderService);
        System.out.println("一级缓存大小: " + demo.singletonObjects.size());  // 0
        System.out.println("二级缓存大小: " + demo.earlySingletonObjects.size()); // 1
        System.out.println("三级缓存大小: " + demo.singletonFactories.size());  // 0
    }
}
```

**输出：**
```
三级缓存执行：创建 OrderService 的早期引用
UserService 拿到 OrderService: java.lang.Object@xxxx
一级缓存大小: 0
二级缓存大小: 1
三级缓存大小: 0
```

---

## 三、为什么不能只用二级缓存？

这是面试的**核心追问**，答出来直接加分。

### 答案：因为 AOP 代理对象的创建需要延迟到属性注入之后

假设只用二级缓存（没有三级缓存的 ObjectFactory）：

```
如果只用二级缓存：
  实例化 OrderService → 立即创建代理对象 → 放入二级缓存
  
问题：
  1. 违背 Spring 设计原则：代理应该在 BeanPostProcessor 后置处理阶段创建
     （第8步），不应该在实例化阶段就创建
  2. 如果不需要 AOP，也强制创建了代理 → 性能浪费
  3. 如果有多个 BeanPostProcessor 依赖后置处理顺序 → 无法保证
```

**三级缓存的 ObjectFactory 实现了"延迟决策"：**
- 先把工厂放进去（三级缓存）
- 只有真正发生循环依赖时才执行工厂
- 工厂内部决定返回原始对象还是代理对象

```java
// Spring 源码：AbstractAutowireCapableBeanFactory.doCreateBean()
// 这段代码决定了三级缓存存的是什么

// 即使是 AOP 代理，也先放 ObjectFactory 到三级缓存
addSingletonFactory(beanName, () -> getEarlyBeanReference(beanName, mbd, bean));

// 只有当循环依赖触发 getSingleton() 时，才执行这个工厂
// 工厂内部调用 SmartInstantiationAwareBeanPostProcessor.getEarlyBeanReference()
// → 判断是否需要 AOP → 返回代理对象或原始对象
```

### 对比表

| 方案 | 能否解决循环依赖 | 问题 |
|------|------------------|------|
| **不处理** | ❌ | StackOverflowError（无限递归创建） |
| **只用一级缓存** | ❌ | 只存完整 Bean，半成品无法共享 |
| **二级缓存** | ⚠️ 基本能解决 | 代理对象提前创建，违反设计原则，无法支持有序的 BeanPostProcessor 链 |
| **三级缓存** | ✅ 完美解决 | ObjectFactory 延迟执行，代理创建时机正确，支持扩展 |

---

## 四、构造器注入为什么无法解决循环依赖？

### 核心原因：实例化和依赖注入是同一步

```java
// 构造器注入
@Service
public class OrderService {
    private final UserService userService;
    
    public OrderService(UserService userService) {  // 构造器调用时必须传入完整对象
        this.userService = userService;
    }
}
```

### 对比：Setter 注入 vs 构造器注入

```
Setter 注入（可以解决循环依赖）：
  1. 先 new OrderService()  ← 无参构造，对象已创建（半成品）
  2. 放入三级缓存          ← 有半成品可以暴露
  3. 再调 setUserService()  ← 这时候再去创建 UserService
  ✅ 成功！半成品先暴露出去

构造器注入（无法解决循环依赖）：
  1. 要创建 OrderService，必须先调用构造器
  2. 构造器要求传入 UserService
  3. UserService 还没创建 → 去创建 UserService
  4. UserService 构造器又要 OrderService
  5. OrderService 还没创建完（卡在步骤1）→ 死循环！
  ❌ 失败！根本拿不到半成品，因为连 new 都还没 new 出来
```

### Demo：两种注入方式对比

```java
/**
 * 构造器注入 vs Setter注入 对循环依赖的影响
 * 
 * 运行后观察：
 * - Setter注入：正常启动，循环依赖被解决
 * - 构造器注入：启动报错 "Currently in creation check"
 */
// ========== Setter注入（能解决） ==========
@Service
class OrderServiceA {
    private UserServiceA userService;
    
    @Autowired  // 等价于 setter 注入
    public void setUserService(UserServiceA userService) {
        this.userService = userService;
    }
}

@Service
class UserServiceA {
    private OrderServiceA orderService;
    
    @Autowired
    public void setOrderService(OrderServiceA orderService) {
        this.orderService = orderService;
    }
}
// ✅ 启动正常！三级缓存解决了循环依赖


// ========== 构造器注入（不能解决） ==========
@Service
class OrderServiceB {
    private final UserServiceB userService;
    
    @Autowired
    public OrderServiceB(UserServiceB userService) {  // 构造器注入
        this.userService = userService;
    }
}

@Service
class UserServiceB {
    private final OrderServiceB orderService;
    
    @Autowired
    public UserServiceB(OrderServiceB orderService) {  // 构造器注入
        this.orderService = orderService;
    }
}
// ❌ 启动报错！
// BeanCurrentlyInCreationException:
// Requested bean 'orderServiceB' that is currently in creation check
```

---

## 五、Spring Bean 作用域速查

| 作用域 | 说明 | 场景 |
|--------|------|------|
| **singleton** | 默认，整个容器一个实例 | Service、Dao、工具类 |
| **prototype** | 每次获取都创建新实例 | 有状态的 Bean、不可共享的对象 |
| **request** | 每个 HTTP 请求一个实例 | Web 应用，线程不安全的 Bean |
| **session** | 每个 Session 一个实例 | 存用户登录状态 |
| **application** | 每个 ServletContext 一个实例 | 全局共享配置 |

**⚠️ 注意：prototype 作用域不参与循环依赖检测！** Spring 不会缓存 prototype Bean。

---

## 六、@Transactional 失效场景（追问补充）

这是滴滴二面的高频追问，一起整理：

| 失效场景 | 原因 | 修复 |
|----------|------|------|
| **同类方法自调用** | `this.method()` 不走代理，事务增强不生效 | 注入自身代理 / AopContext.currentProxy() |
| **方法非 public** | CGLIB 代理只能代理 public 方法 | 改为 public |
| **异常被 catch 吞掉** | Spring 靠异常触发回滚，catch 吞掉就不会回滚 | throw 出去 / TransactionAspectSupport |
| **rollbackFor 没配** | 默认只回滚 RuntimeException 和 Error，不回滚 checked 异常 | rollbackFor = Exception.class |
| **数据库引擎不支持事务** | MyISAM 不支持事务 | 改 InnoDB |

```java
// 同类自调用的陷阱 —— 面试必考
@Service
public class OrderService {
    
    public void createOrder() {
        this.cancelOrder();  // ⚠️ this 调用，不走代理，事务失效！
    }
    
    @Transactional
    public void cancelOrder() {
        // 这里的事务不会生效！因为 this 调用跳过了 AOP 代理
    }
}

// 修复方式1：注入自身代理
@Service
public class OrderService {
    @Autowired
    @Lazy  // 避免循环依赖
    private OrderService self;
    
    public void createOrder() {
        self.cancelOrder();  // ✅ 通过代理对象调用，事务生效
    }
}

// 修复方式2：AopContext
@Service
public class OrderService {
    public void createOrder() {
        ((OrderService) AopContext.currentProxy()).cancelOrder();  // ✅
    }
}
```

---

## 七、面试回答模板

### 回答 Bean 生命周期

> Spring Bean 生命周期分两大阶段：**创建** 和 **销毁**。
> 
> 创建阶段：先通过 BeanDefinition 加载配置 → 构造器实例化 → 属性填充（@Autowired 注入）→ Aware 回调（让 Bean 感知容器）→ BeanPostProcessor 前置处理 → InitializingBean / init-method 初始化 → BeanPostProcessor 后置处理（**AOP 代理在这里生成**）→ Bean 就绪。
> 
> 销毁阶段：容器关闭时 → DisposableBean.destroy() → destroy-method。
> 
> 其中最关键的扩展点是 **BeanPostProcessor**，AOP 代理、@Async、@Transactional 这些注解的处理都在这个阶段。

### 回答三级缓存

> Spring 用三级缓存解决单例 Bean 的循环依赖。
> 
> - 一级缓存（singletonObjects）：存完整的 Bean
> - 二级缓存（earlySingletonObjects）：存提前暴露的半成品
> - 三级缓存（singletonFactories）：存 ObjectFactory，延迟创建代理对象
> 
> 解决流程：A 实例化后，把 ObjectFactory 放入三级缓存。A 注入 B 时触发 B 创建，B 创建时要注入 A，发现 A 在三级缓存 → 执行 ObjectFactory 拿到 A 的早期引用 → 放入二级缓存 → B 完成创建。A 拿到 B 后也完成创建，最终都放入一级缓存。
> 
> 之所以要三级而不是二级，是因为**代理对象的创建要延迟到属性注入之后**。三级缓存的 ObjectFactory 实现了延迟决策，只有真正发生循环依赖时才决定返回原始对象还是代理对象。

### 回答构造器注入为何不能解决

> 构造器注入时，实例化和依赖注入是同一步——必须在构造器参数都准备好才能 new 出对象。而循环依赖解决的前提是"先 new 一个半成品暴露出去"，构造器注入连半成品都暴露不了，所以无法解决。

---

## 八、这次讨论的收获

1. **用户的回答骨架正确但缺少具体名词**：面试中必须说出 BeanPostProcessor、Aware 接口族、InitializingBean 等具体名称，不能只说"扩展点"
2. **三级缓存的核心是 ObjectFactory**：不是简单的"放一级→放二级"，而是延迟工厂的执行时机
3. **同类自调用是最高频陷阱**：@Transactional 在同类中 this 调用失效，面试几乎必问
4. **构造器注入 = 实例化 + 依赖注入同一步**：无法暴露半成品，所以无法解决循环依赖
