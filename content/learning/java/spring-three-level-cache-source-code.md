---
title: "Spring 三级缓存源码逐行注释"
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
summary: "Spring 三级缓存源码逐行注释"
tags:
---

# Spring 三级缓存源码逐行注释

> 本文聚焦 `DefaultSingletonBeanRegistry` 和 `AbstractAutowireCapableBeanFactory` 中三级缓存相关的核心代码，逐行注释。

---

## 1. 三级缓存的定义

```java
// DefaultSingletonBeanRegistry.java

public class DefaultSingletonBeanRegistry {

    // 一级缓存：存储完全初始化完毕的成品 Bean
    // key = beanName, value = 成品 Bean 实例
    // 使用 ConcurrentHashMap 保证并发读安全
    private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);

    // 二级缓存：存储早期暴露的引用（可能是原始对象，也可能是代理对象）
    // 当某个 Bean 被其他 Bean 提前获取时，工厂的执行结果放在这里
    // 使用 ConcurrentHashMap 保证并发读安全
    private final Map<String, Object> earlySingletonObjects = new ConcurrentHashMap<>(16);

    // 三级缓存：存储 ObjectFactory（工厂 lambda）
    // 注意：这里是 HashMap，不是 ConcurrentHashMap
    // 因为三级缓存的操作都在 synchronized 块内
    // key = beanName, value = ObjectFactory（一个 lambda 表达式）
    // 这个工厂负责：在被调用时决定返回原始对象还是代理对象
    private final Map<String, ObjectFactory<?>> singletonFactories = new HashMap<>(16);
}
```

---

## 2. getSingleton() —— 缓存查询的核心方法

```java
// DefaultSingletonBeanRegistry.java

/**
 * @param beanName          要获取的 Bean 名称
 * @param allowEarlyReference 是否允许获取早期引用（true = 三级级联查，false = 只查一二级）
 */
protected Object getSingleton(String beanName, boolean allowEarlyReference) {

    // ========== 第一步：查一级缓存 ==========
    Object singletonObject = this.singletonObjects.get(beanName);

    // 一级没有 AND 这个 Bean 正在创建中（说明有循环依赖）
    if (singletonObject == null && isSingletonCurrentlyInCreation(beanName)) {

        // ========== 第二步：查二级缓存 ==========
        singletonObject = this.earlySingletonObjects.get(beanName);

        // 二级也没有 AND 允许早期引用
        if (singletonObject == null && allowEarlyReference) {

            // 加锁，防止并发创建同一个 Bean
            synchronized (this.singletonObjects) {

                // 双重检查：再查一次一级（可能别的线程刚放进去）
                singletonObject = this.singletonObjects.get(beanName);
                if (singletonObject == null) {

                    // 再查一次二级
                    singletonObject = this.earlySingletonObjects.get(beanName);
                    if (singletonObject == null) {

                        // ========== 第三步：查三级缓存 ==========
                        ObjectFactory<?> singletonFactory = this.singletonFactories.get(beanName);
                        if (singletonFactory != null) {

                            // ⭐ 执行工厂！这是三级缓存最核心的一行
                            // 工厂内部会调用 getEarlyBeanReference()
                            // 根据 Bean 是否需要 AOP 代理，返回原始对象或代理对象
                            singletonObject = singletonFactory.getObject();

                            // 工厂的产出物放入二级缓存（升级）
                            this.earlySingletonObjects.put(beanName, singletonObject);

                            // 三级缓存移除（工厂已执行，不再需要）
                            this.singletonFactories.remove(beanName);
                        }
                    }
                }
            }
        }
    }

    // 返回结果：
    // 有循环依赖时：返回早期引用（原始或代理）
    // 没有循环依赖时：返回 null（一级有就直接返回了）
    return singletonObject;
}
```

---

## 3. addSingletonFactory() —— 放入三级缓存

```java
// DefaultSingletonBeanRegistry.java

protected void addSingletonFactory(String beanName, ObjectFactory<?> singletonFactory) {
    synchronized (this.singletonObjects) {
        // 只有一级缓存里没有才会放三级
        // 如果一级已经有了（说明 Bean 已经创建完了），就不需要放工厂了
        if (!this.singletonObjects.containsKey(beanName)) {
            // 放入三级缓存
            this.singletonFactories.put(beanName, singletonFactory);
            // 清掉二级缓存（防止数据不一致）
            this.earlySingletonObjects.remove(beanName);
        }
    }
}
```

---

## 4. getEarlyBeanReference() —— 工厂的核心逻辑

```java
// AbstractAutowireCapableBeanFactory.java

/**
 * 这是 ObjectFactory lambda 内部真正执行的方法
 * 负责：根据 Bean 是否需要 AOP 代理，返回原始对象或代理对象
 *
 * @param beanName  Bean 名称
 * @param mbd       Bean 的定义信息（包含是否需要代理等元数据）
 * @param bean      实例化后的原始对象
 * @return          原始对象 或 代理对象
 */
protected Object getEarlyBeanReference(String beanName, RootBeanDefinition mbd, Object bean) {

    // 先假设返回原始对象
    Object exposedObject = bean;

    // 检查 Bean 定义是否是合成的（synthetic = 框架内部生成的，不需要代理）
    if (!mbd.isSynthetic() && hasInstantiationAwareBeanPostProcessors()) {

        // 遍历所有 BeanPostProcessor
        for (BeanPostProcessor bp : getBeanPostProcessors()) {

            // 只处理 SmartInstantiationAwareBeanPostProcessor 类型
            // 主要就是 AbstractAutoProxyCreator（AOP 代理创建器）
            if (bp instanceof SmartInstantiationAwareBeanPostProcessor) {

                // ⭐ 调用代理创建器的 getEarlyBeanReference
                // 如果 Bean 需要代理（如 @Transactional），在这里生成代理
                // 如果不需要，返回原始对象
                exposedObject = ((SmartInstantiationAwareBeanPostProcessor) bp)
                        .getEarlyBeanReference(exposedObject, beanName);
            }
        }
    }

    return exposedObject;
}
```

---

## 4. AbstractAutoProxyCreator 的 getEarlyBeanReference

```java
// AbstractAutoProxyCreator.java（AOP 代理创建器）

// 用于记录哪些 Bean 已经被"提前代理"过了
// 防止后续 initializeBean 时重复生成代理
private final Map<Object, Object> earlyProxyReferences = new HashMap<>();

// 用于缓存已生成的代理对象，同一个 Bean 不会生成两个代理
private final Map<Object, Object> proxyCache = new ConcurrentHashMap<>();

public Object getEarlyBeanReference(Object bean, String beanName) {
    // 生成缓存 key（通常就是 beanName）
    Object cacheKey = getCacheKey(bean.getClass(), beanName);

    // ⭐ 标记：这个 Bean 已经被提前代理过了
    // 后续 initializeBean 中的 postProcessAfterInitialization 会检查这个标记
    this.earlyProxyReferences.put(cacheKey, bean);

    // 如果需要代理，生成代理并缓存；如果不需要，返回原始对象
    return wrapIfNecessary(bean, beanName, cacheKey);
}

// 后续在 initializeBean 中会调用这个方法
public Object postProcessAfterInitialization(Object bean, String beanName) {
    if (bean != null) {
        Object cacheKey = getCacheKey(bean.getClass(), beanName);

        // ⭐ 检查是否已经被提前代理过
        if (this.earlyProxyReferences.remove(cacheKey) != bean) {
            // 没被提前代理过 → 需要正常生成代理
            return wrapIfNecessary(bean, beanName, cacheKey);
        }
        // 被提前代理过 → 不重复生成，返回原始对象
        // （代理一致性由 doCreateBean 的对账逻辑保证）
    }
    return bean;
}
```

---

## 5. doCreateBean() —— Bean 创建的主流程

```java
// AbstractAutowireCapableBeanFactory.java

protected Object doCreateBean(String beanName, RootBeanDefinition mbd, Object[] args) {

    // ========== 第1步：实例化 ==========
    // 调用构造器 new 出原始对象（属性全是 null）
    BeanWrapper instanceWrapper = createBeanInstance(beanName, mbd, args);
    Object bean = instanceWrapper.getWrappedInstance();

    // ========== 第2步：判断是否需要提前曝光 ==========
    // 条件：是单例 AND 允许循环引用 AND 当前正在创建中
    boolean earlySingletonExposure = (mbd.isSingleton()
            && this.allowCircularReferences
            && isSingletonCurrentlyInCreation(beanName));

    if (earlySingletonExposure) {
        // ⭐ 将 ObjectFactory 放入三级缓存
        // 工厂的逻辑：() -> getEarlyBeanReference(beanName, mbd, bean)
        // 此时工厂只是存着，还没执行
        addSingletonFactory(beanName,
                () -> getEarlyBeanReference(beanName, mbd, bean));
    }

    // 初始化 exposedObject 为原始对象
    // exposedObject 是最终要放进一级缓存的对象
    Object exposedObject = bean;

    try {
        // ========== 第3步：属性填充 ==========
        // ⭐ 循环依赖在这里发生！
        // 如果 A 需要 B，这里会触发 B 的完整创建流程
        // B 创建时如果需要 A，会从三级缓存拿 A 的工厂并执行
        populateBean(beanName, mbd, instanceWrapper);

        // ========== 第4步：初始化 ==========
        // 执行 @PostConstruct、InitializingBean.afterPropertiesSet() 等
        // 调用所有 BeanPostProcessor 的 postProcessAfterInitialization
        // 如果 A 没被提前代理过，代理可能在这一步生成
        exposedObject = initializeBean(beanName, exposedObject, mbd);

    } catch (Throwable ex) {
        // ...异常处理省略...
    }

    // ========== 第5步：对账 ==========
    if (earlySingletonExposure) {
        // 从二级缓存获取早期引用（可能是原始对象或代理）
        Object earlySingletonReference = getSingleton(beanName, false);

        if (earlySingletonReference != null) {
            if (exposedObject == bean) {
                // ⭐ 关键判断：
                // exposedObject 还是原始对象 bean → 说明 initializeBean 没生成新代理
                // 用二级缓存的早期引用替换
                // 这保证了一级缓存和二级缓存指向同一个对象
                exposedObject = earlySingletonReference;
            }
            // 如果 exposedObject != bean → 说明 initializeBean 生成了新代理
            // 此时用新代理，不用二级的（因为没人提前拿过）
        }
    }

    return exposedObject;
}
```

---

## 6. addSingleton() —— 放入一级缓存 + 清理

```java
// DefaultSingletonBeanRegistry.java

protected void addSingleton(String beanName, Object singletonObject) {
    synchronized (this.singletonObjects) {
        // 放入一级缓存（成品 Bean）
        this.singletonObjects.put(beanName, singletonObject);

        // ⭐ 清理二级和三级缓存
        // Bean 已经完成创建，不再需要早期引用和工厂了
        this.earlySingletonObjects.remove(beanName);
        this.singletonFactories.remove(beanName);
    }
}
```

---

## 7. 整体调用链总结

```
getBean("A")
  ↓
doCreateBean("A")
  ├── createBeanInstance()          → new A()，属性为 null
  ├── addSingletonFactory()         → 工厂放三级缓存
  ├── populateBean()                → 填充属性
  │     └── 发现需要 B → getBean("B")
  │           └── doCreateBean("B")
  │                 ├── createBeanInstance()  → new B()
  │                 ├── addSingletonFactory() → 工厂放三级
  │                 ├── populateBean()
  │                 │     └── 发现需要 A → getBean("A")
  │                 │           └── getSingleton("A")
  │                 │                 ├── 一级：空
  │                 │                 ├── 二级：空
  │                 │                 └── 三级：找到工厂 → 执行 → 返回原始/代理
  │                 │                       → 结果放二级，三级移除
  │                 │                 → B 拿到 A 的早期引用
  │                 ├── initializeBean()      → B 初始化完成
  │                 └── addSingleton()        → B 进一级，清二级三级
  │           ← B 创建完成，返回
  │     ← A 拿到 B，属性填充完成
  ├── initializeBean()             → A 初始化完成
  └── 对账逻辑                      → 确保一级和二级指向同一个对象
        → addSingleton()            → A 进一级，清二级三级
```
