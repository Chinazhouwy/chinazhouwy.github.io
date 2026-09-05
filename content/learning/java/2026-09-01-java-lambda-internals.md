---
title: "Java Lambda 原理拆解：动态生成类与调用流程"
date: "2026-09-01"
domain: "学习"
area: "Java 后端"
module: "Java 函数式与 Stream"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "lambda 不是匿名内部类的语法糖：javac 把方法体编译成宿主类私有静态合成方法，调用点是一条 invokedynamic，由 LambdaMetafactory 运行期生成 $$Lambda 类。含非捕获单例、捕获字段、SerializedLambda 序列化元信息与 MyBatis-Plus 取字段名原理。"
tags:
  - Java
  - JVM
  - Lambda
  - 函数式接口
source: "https://mp.weixin.qq.com/s/stUbw9thrV24qxlfIgwzww"
---

# Java Lambda 原理拆解：动态生成类与调用流程

> 来源：微信公众号「扶锐随笔」（作者：扶锐），2026-08-10 发布
> 验证：本机 JDK 17（TencentKona）实测复现；原文结论与 javap/运行输出一致
> 关联：MyBatis 源码系列（Mapper 动态代理）、Stream 设计系列（内部迭代与控制反转）

## 一、接口与抽象类：先分清两个"兄弟"

- **接口 = 能力的声明（契约）**：编译期保证"能调用某个方法"，不靠继承，靠契约。`obj.doSomething()` 能编译，是因为接口声明了该方法。
- **抽象类 = 半成品**：通用逻辑写好，差异点留给子类实现。模板方法模式就是典型用法。

## 二、lambda 是什么：把函数当参数，但用"类"来承载

Java 没有"函数"这种一等公民，函数永远是"某个类的方法"。写 `() -> {...}` 把逻辑当参数传递时，JVM 必须找一个对象兜住逻辑——这个对象的类实现了那个函数式接口，逻辑绑在接口唯一抽象方法上。

**为什么函数式接口只能有一个抽象方法？** 因为写 lambda 时只写了 `() -> {}`，没指定逻辑绑到哪个方法。接口有且仅有一个抽象方法，JVM 才能确定绑定目标。所以"单一抽象方法"不是语法洁癖，是 lambda 这种"匿名写逻辑、不指名绑哪个方法"的写法逼出来的——这也是 JDK 8 引入 `@FunctionalInterface` 注解做编译期校验的原因。

**两个常见误解**（用字节码纠正）：
- ❌ "给当前类塞一个默认静态字段，类型是 lambda 接口"
- ❌ "用当前类的某个字段兜住 lambda"
- ✅ 真实实现：逻辑在宿主类的**私有静态合成方法**里；lambda 对象是**运行期新生成的独立类**；捕获的变量存这个新类的实例字段里。

## 三、底层真容：invokedynamic + 运行时生成的类

### 3.1 lambda 体被编译成宿主类的私有静态方法

javac 没有把 lambda 变成匿名内部类，而是把方法体编译成宿主类里 `private static` 的合成方法，命名规则 `lambda$<方法名>$<序号>`：

```java
// 编译器在宿主类里额外生成的合成方法（源码不可见）
private static void lambda$makeCapturing$1(int x) {
    System.out.println("capturing: x = " + x);
}
```

注意：被捕获的 `x` 在合成方法里变成了**普通参数**——这就是"捕获"在字节码层面的真身。

### 3.2 调用点是一条 invokedynamic

反编译宿主类看到：

```
0: iload_1
1: invokedynamic #3, 0 // InvokeDynamic #1:run:(I)Ljava/lang/Runnable;
```

`javap -v` 能看到 BootstrapMethods，引导参数直接带着宿主类的合成静态方法：

```
BootstrapMethods:
1: invokestatic java/lang/invoke/LambdaMetafactory.metafactory:(...)
Method arguments:
#74 invokestatic LambdaInternals.lambda$makeCapturing$1:(I)V  // lambda 体在这
```

**lambda 与匿名内部类的最大区别**：匿名内部类是编译期生成 `.class` 文件；lambda 是运行期由 `LambdaMetafactory.metafactory` 引导方法**现生成**的。

### 3.3 运行时真实生成的类：非捕获 vs 捕获

用 `-Djdk.internal.lambda.dumpProxyClasses=.` 可以把运行时生成的 `$$Lambda` 类 dump 出来：

**非捕获 lambda**（不引用外部变量）：
```java
final class LambdaInternals$$Lambda$1 implements Runnable {
    private LambdaInternals$$Lambda$1() {}            // 构造器私有
    public void run() {
        LambdaInternals.lambda$makeNonCapturing$0();  // 委托回宿主类静态方法
    }
}
```

**捕获 lambda**（引用了外部变量 x）：
```java
final class LambdaInternals$$Lambda$2 implements Runnable {
    private final int arg$1;                          // 被捕获的 x 存在实例字段
    private LambdaInternals$$Lambda$2(int x) { this.arg$1 = x; }
    private static Runnable get$Lambda(int x) { return new LambdaInternals$$Lambda$2(x); }
    public void run() {
        LambdaInternals.lambda$makeCapturing$1(this.arg$1);
    }
}
```

### 3.4 非捕获 lambda 是单例（实测复现）

```java
Runnable r1 = demo.makeNonCapturing();
Runnable r2 = demo.makeNonCapturing();
System.out.println(r1 == r2);          // true —— 非捕获：同一个对象
Runnable c1 = demo.makeCapturing(10);
Runnable c2 = demo.makeCapturing(10);
System.out.println(c1 == c2);          // false —— 捕获：每次 new
```

原因：invokedynamic 调用站在链接后被缓存成常量，同一调用点永远返回同一对象；非捕获无状态可存，自然复用。捕获的每次携带值可能不同，每次新建。（JDK 17 实测输出与之一致。）

### 3.5 一次 makeCapturing(10) 的完整链路

1. 代码执行到 invokedynamic 调用点
2. `LambdaMetafactory` 首次链接：生成 `$$Lambda$2` 类
3. 调用 `get$Lambda(10)` → `new $$Lambda$2(10)`，x 存入 arg$1 字段
4. 返回 Runnable 对象
5. 调 `r.run()` → `$$Lambda$2.run()` → 委托回 `LambdaInternals.lambda$makeCapturing$1(arg$1)`

## 四、lambda 的序列化：为什么默认不能序列化

普通 lambda 不实现 `Serializable`，直接 `ObjectOutputStream.writeObject(lambda)` 抛 `NotSerializableException`——lambda 对象是运行期现生成的，JVM 不知道如何存盘复原。

**交集类型写法**（目标类型同时带 Serializable）：
```java
Runnable serializable = (Runnable & Serializable) () -> System.out.println("serializable");
```

这样 JVM 会给生成的 lambda 类自动加 `writeReplace()` 方法。它**不写 lambda 的字节码**，而是返回一个 `SerializedLambda`——里面记录的全是"这个 lambda 是怎么来的"元信息：定义在哪个类、函数式接口叫什么、真正实现的方法是哪个。反序列化时靠这些元信息重新链接出对象。

⚠️ 关键点：序列化的是"如何重建 lambda 的元信息"，不是 lambda 代码本身。

## 五、lambda 表达式 vs 方法引用：运行一样，元信息不一样

- **运行层面**：确实一样。两者都生成实现函数式接口的实例，行为无差别。
- **序列化层面（SerializedLambda 元信息）**：完全不一样——这正是 MyBatis-Plus 能否拿到字段名的分水岭。

通过反射调 `writeReplace()` 读出 `SerializedLambda.getImplMethodName()`：

```java
// 方法引用 User::getId  →  implMethodName = getId
// lambda 表达式 u -> u.getId()  →  implMethodName = lambda$main$b75f8606$1
```

（JDK 17 实测两行输出与此一致。）

- `User::getId` 是方法引用：编译器明确知道指向 User 类的 getId 方法，生成的代理类里 `writeReplace()` 直接记下 `implClass = "User"`、`implMethodName = "getId"`。
- `u -> u.getId()` 是 lambda 表达式：编译器把逻辑抽成宿主类的私有合成静态方法，`SerializedLambda` 记下的 implMethodName 是合成方法名，原始 getId 语义丢失。

**一句话：方法引用"记得自己指向谁"，lambda 表达式只记得"我指向一个编译器临时生成的方法"。**

**MyBatis-Plus 取字段名的原理**：`SFunction<T, R> extends Function<T, R>, Serializable`，让函数式接口自己继承 Serializable。`LambdaQueryWrapper.eq(User::getId, 1)` 时，框架反射调用 `writeReplace()` 拿 SerializedLambda → `getImplMethodName()` 返回 `"getId"` → 去掉 `get` 前缀得到字段名 `id` → 拼 SQL 列名。实体字段改名，SQL 自动跟着变，不用手写字符串列名。

⚠️ 避坑：想让框架从 lambda 反推出字段名，**必须写方法引用 `User::getId`**，不要写 lambda 表达式 `u -> u.getId()`。后者的 implMethodName 是合成方法名，框架拿不到真实字段名。

## 六、复习要点

1. 接口=契约，抽象类=半成品；函数式接口单一抽象方法是 lambda 匿名绑定语义逼出来的
2. lambda 体 → 宿主类 private static 合成方法（`lambda$方法名$序号`）
3. 调用点是一条 invokedynamic，`LambdaMetafactory` 运行期生成 `$$Lambda` 类——与匿名内部类编译期生成 .class 的根本区别
4. 非捕获：无字段、单例（调用站缓存）；捕获：`private final` 字段存值、每次 new
5. lambda 默认不可序列化；目标类型带 `Serializable` 后 JVM 自动加 `writeReplace()` 返回 SerializedLambda（重建元信息，不是代码）
6. 方法引用 vs lambda 表达式：运行行为相同，SerializedLambda 元信息不同；框架取字段名只认方法引用
7. 面试高频追问："lambda 捕获的变量为什么必须是 effectively final？"——合成方法参数在生成类字段里一次性赋值，运行时不再变化，语义上等同 final

**待补**：下篇讲 `LambdaMetafactory` 本身如何把指令变成对象、SerializedLambda 反序列化如何"凭空复活"——等公众号更新后可以跟进。
