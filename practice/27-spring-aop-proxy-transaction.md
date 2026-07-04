---
schema_version: 1
question_id: 27
question: "Spring AOP 代理原理是什么？JDK 动态代理（Dynamic Proxy）和 CGLIB 怎么选？事务为什么会失效？"
date: 2026-06-10
sources:
  - middleware/vipshop-java-interview.md
  - java/baidu-java-backend-round1.md
  - java/baidu-java-backend-round2.md
score: "7/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
# 第27题 — Spring AOP 代理原理

## 📊 得分：7/10

**题目**：Spring AOP 代理原理是什么？JDK 动态代理（Dynamic Proxy）和 CGLIB 怎么选？事务为什么会失效？

**来源**：《唯品会Java面试》、《百度Java一面》、《百度Java二面》
- `middleware/vipshop-java-interview.md`
- `java/baidu-java-backend-round1.md`
- `java/baidu-java-backend-round2.md`

---

## 核心概念

### 1. AOP 动态代理原理

Spring AOP 的底层就是**动态代理（Dynamic Proxy）**。Spring 不修改目标类的源码，而是在运行时为目标对象生成一个代理对象（Proxy），在代理对象中织入切面逻辑（如事务、日志、权限校验），然后让调用方拿到的是代理对象而非原始目标对象。

两种实现方式：
- **JDK Proxy（JDK 动态代理）**：基于**接口（Interface）**，目标类必须实现接口。通过 `java.lang.reflect.Proxy` + `InvocationHandler`（调用处理器）实现。
- **CGLib（Code Generation Library，字节码生成库）**：基于**继承（Subclass）**，不需要接口。通过 ASM 字节码框架生成目标类的**子类**，重写目标方法来实现代理。

### 2. JDK Proxy vs CGLib 区别

| 对比维度 | JDK Proxy | CGLib |
|---------|-----------|-------|
| 实现原理 | 基于接口 + 反射 | 基于继承 + 字节码生成子类 |
| 前提条件 | 目标类**必须实现接口** | 目标类**不能是 final 类** |
| 代理范围 | 接口中定义的所有方法 | public 和 protected 方法 |
| 不能代理 | 非接口方法 | final 方法、private 方法（无法重写/无法继承） |
| 性能 | 反射调用，相对较慢 | 字节码直接调用，相对更快 |
| Spring 默认 | Spring Boot 2.x 之前默认 | Spring Boot 2.x 之后默认 |

### 3. 事务失效原理

Spring 的事务是通过 **AOP 切面**实现的。正常流程：

```
客户端 → 代理对象 → 切面(开启事务) → 目标方法 → 切面(提交/回滚事务)
```

**事务失效的典型场景**：同类内部直接调用（`this.methodB()`）

```java
@Service
public class UserService {
    @Transactional
    public void methodA() {
        this.methodB();  // ⚠️ 同类内部直接调用，绕过代理
    }
    
    @Transactional
    public void methodB() {
        // 这里的事务不会生效！
    }
}
```

原因：`this.methodB()` 调用的是目标对象本身的方法，**绕过了代理对象（Proxy）**，AOP 切面根本没有机会介入。

解决方案：
1. 注入自身：`@Autowired private UserService self; self.methodB();`
2. 从 `ApplicationContext` 获取代理对象
3. 使用 `AopContext.currentProxy()` 获取当前代理（需要开启 `exposeProxy = true`）

---

## 用户回答原文

> AOP动态代理的原理其实就是AOP的原理，就是动态代理呀，有两个，一个JDK代理，一个c g lab代理，JDK是JDK自带的，Cg lab是外部的。然后他们的区别是动JDK的话，只能够对那个方法进行代理，公共方法c g lab可以对字段进行代理，好像是的。然后，事务师效的原理就是，可能直接调用的方法没有采用引用调采用引用的方式，就是导致了没有走切面这个过程

---

## 用户追问+纠正记录

### 纠正1：CGLib 代理字段 ❌ → 代理方法（子类重写）

用户说"CGLib可以对字段进行代理"，**这是错误的**。

**纠正**：CGLib 生成子类**重写方法**，和 JDK Proxy 一样代理的都是**方法**，不是字段。"字段代理"这个概念不存在，两者都不能直接拦截字段访问。

CGLib 的原理是通过 ASM 字节码框架在运行时生成目标类的一个子类（subclass），然后重写目标类中所有非 final 的方法，在重写的方法中织入拦截逻辑（`MethodInterceptor`）。本质上和 JDK Proxy 一样，都是代理方法。

### 纠正2：JDK Proxy 描述不精确

用户说"JDK只能对方法进行代理"，方向对但没点出**接口**这个关键约束。

**纠正**：JDK Proxy 的核心限制是**必须有接口才能代理**，不仅仅是"能代理方法"。准确说法：
- JDK Proxy 要求目标类实现接口，代理的是接口中定义的方法
- 如果目标类没有接口，JDK Proxy 无法工作

### 纠正3：缺少 CGLib 局限性

用户没提到 CGLib 不能代理的场景。

**补充**：CGLib 不能代理：
- **final 方法**：子类无法重写 final 方法
- **final 类**：子类无法继承 final 类
- **private 方法**：子类无法访问 private 方法

### 纠正4：缺少 Spring 默认选择策略

用户没提到 Spring 如何在两种代理之间选择。

**补充**：
- **Spring Boot 2.x 之前**：默认策略是有接口用 JDK Proxy，无接口用 CGLib
- **Spring Boot 2.x 之后**：默认全部使用 CGLib（即使有接口）
- 可通过 `spring.aop.proxy-target-class=false` 强制使用 JDK Proxy

### 纠正5：打分制度（十分制）

用户指出应该用十分制打分，而不是百分制。

---

## 最终结论

1. **AOP 动态代理**：Spring AOP 底层是动态代理，JDK Proxy 和 CGLib 是两种实现
2. **核心区别是接口 vs 继承**：
   - JDK Proxy：基于接口，必须有接口，通过 `java.lang.reflect.Proxy` 实现
   - CGLib：基于继承，不需要接口，生成子类重写方法，final/private 无法代理
3. **事务失效**：同类内部 `this` 调用绕过代理对象，切面无法介入
4. **Spring 默认策略**：Boot 2.x 后默认 CGLib

---

## 这次讨论的收获

1. **核心要纠正**：CGLib 代理的是方法不是字段，和 JDK 的区别是**接口 vs 继承**，不是字段 vs 方法
2. **面试回答框架**：先说"Spring AOP 底层是动态代理"，再说两种实现方式和区别，最后说事务失效
3. **CGLib 的关键限制**：final 方法、final 类、private 方法都不能代理
4. **打分制度**：十分制，不是百分制（曾犯错忘记）
