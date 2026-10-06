---
title: "面试手册深挖 07 · 延伸专题：synchronizedXxx、RandomAccess、协变与擦除"
date: "2026-10-06"
updated: "2026-10-06"
domain: "专栏"
area: "技术"
module: "面试手册深挖"
project: ""
type: "文章"
status: "可复习"
priority: "P2"
energy: "medium"
visibility: "public"
summary: "Q17/Q18 讨论引申出的三个延伸专题：Collections.synchronizedXxx 的装饰器实现、RandomAccess 标记接口、数组协变与泛型不变的推导，以及泛型擦除的经典问题清单。"
tags:
  - Java
  - 集合
  - 泛型
  - 设计模式
---

# 面试手册深挖 07 · 延伸专题：synchronizedXxx、RandomAccess、协变与擦除

> 本文是 2026-10-06 会话中从 Q17/Q18 讨论延伸出的三个专题笔记，源码均验证自本机 OpenJDK 25。

## 一、Collections.synchronizedXxx：装饰器模式 + 一堵 synchronized 墙

### 1.1 机制

同步逻辑不在工厂方法里，在 `Collections` 的私有内部类（JDK 25 Collections.java:2287 起）：

```java
static class SynchronizedCollection<E> implements Collection<E>, Serializable {
    final Collection<E> c;   // 被包的真实集合
    final Object mutex;      // 锁对象
    SynchronizedCollection(Collection<E> c) {
        this.c = Objects.requireNonNull(c);
        mutex = this;                                  // ★ 默认拿包装器自己当锁
    }
    public int size() {
        synchronized (mutex) { return c.size(); }      // 每个方法：抢 mutex → 转发
    }
    public Iterator<E> iterator() {
        return c.iterator(); // Must be manually synched by user!
    }
}
```

没有魔法，就是**每个方法 `synchronized(mutex)` 后转发**。工厂方法只按能力选壳：`list instanceof RandomAccess ? new SynchronizedRandomAccessList<> : new SynchronizedList<>`（保留标记，见专题二）。

### 1.2 三个关键细节

1. **mutex = this**：迭代时要 `synchronized (返回的list)` 才有效——必须抢同一把锁。
2. **iterator() 故意不同步**：迭代器交出去之后 wrapper 失控，就算每次 next() 上锁也护不住"hasNext 到 next 之间"。源码注释明说 "Must be manually synched by user!"。
3. **绕道陷阱**：谁手里攥着原始引用，谁就绕开全部同步——`raw.add(...)` 完全不过锁。

对照 Q15 的理论：这类包装器把"单方法原子"这一档补齐了，复合动作（尤其迭代）仍然自己负责。

## 二、RandomAccess：贴在类型上的性能标签

### 2.1 它是什么

```java
public interface RandomAccess {
}   // 整个接口体就是空的
```

**空标记接口**——用"类型"本身携带一条性能承诺：`get(i)` 近似 O(1)。ArrayList/Vector/CopyOnWriteArrayList/Arrays.asList 结果都有标记；LinkedList 没有（get(i) O(n)）。同一家族：Serializable、Cloneable——注解诞生前的"类型级元数据"，好处是参与 instanceof、重载和编译期检查。

### 2.2 解决什么问题

泛型算法拿到的是 List 接口，看不出底下是数组还是链表，而遍历策略性能天差地别（对 LinkedList 做 `for(i) get(i)` 接近 O(n²)）。JDK 里十几个算法按标记分支（binarySearch/shuffle/reverse/fill/copy/rotate/replaceAll，Collections.java 里十余处 `instanceof RandomAccess`）：

```java
if (list instanceof RandomAccess || list.size() < BINARYSEARCH_THRESHOLD) {
    // 下标直达版
} else {
    // 迭代器版：沿链前进，绝不每次从头走
}
```

注意 `|| size() < THRESHOLD`：**小列表不值得分支**，常数太小——"量小免优化"的工程判断本身也值得学。写自己的 List 装饰器时要把标记传下去（性能契约属于类型，换壳不换本质）。

### 2.3 本质原因不是泛型擦除

擦除管的是"类型参数"（`List<String>` 与 `List<Integer>` 运行时同一个 Class）；RandomAccess 管的是"实现特征"（ArrayList 还是 LinkedList），与类型参数无关。反证：C# 泛型是真类型（无擦除），判断随机访问能力依然要运行时检查或接口拆分。真正的本质链：**一个 List 接口统一了数组背和链表背 → 接口只能约定行为、不能约定复杂度 → 运行时唯一信息通道是具体类型 → 空标记 + instanceof**。可选替代设计是子接口 `RandomAccessList extends List`，标记接口胜在正交（任何实现可自由贴标，不动继承树）。

## 三、数组协变与泛型不变：一条可推导的边界

### 3.1 协变是一个赋值规则

`String[] strs; Object[] objs = strs;` 被允许——"装 String 的数组"可以冒充"装 Object 的数组"。此刻同一箱子上有了两个名字，两个承诺矛盾。事故路径：

```java
objs[0] = 42;              // 编译通过，运行时当场 ArrayStoreException —— 炸在写入点
List<Object> objs = strs;  // 若 List 也允许协变（实际不允许）：
objs.add(42);              // 编译通过
String s = strs.get(0);    // 💥 ClassCastException —— 炸在无辜的读取点
```

差别在**炸的位置**：数组每次写入有运行时核对（数组对象的类自带组件类型 `[Ljava.lang.String;`），错误停在作案点；泛型擦除后无检查可做，错误延迟到受害者。所以泛型唯一安全的选择是**不变**——把错误摁死在编译期。

### 3.2 普遍规律与通配符

变型安全性由读写方向决定：**只读（生产者）→ 协变安全；只写（消费者）→ 逆变安全；可读可写 → 必须不变**。List 是读写双门接口，所以不变。通配符是"按方向开门"：

```java
List<? extends Number> read = listOfInts;   // 协变视图：读门开，写门被编译器焊死
List<? super Integer>  write = listOfNumbers; // 逆变视图：写门开，读只按 Object
```

相当于数组的协变去掉了 ArrayStoreException 版本——运行时检查被前移成编译错误（PECS 的由来）。补充：Java 是使用点变型（每次用通配符），Kotlin/C# 是声明点变型（`List<out T>` 定义一次全局生效）。

### 3.3 泛型擦除的经典问题清单

证明擦除的最短代码：`new ArrayList<String>().getClass() == new ArrayList<Integer>().getClass()` → true。

编译期禁止五件事：`instanceof List<String>`；`new T()` / `new T[]`；泛型数组（数组协变+运行时检查的组合在擦除后无法实现，会留堆污染炸弹）；静态成员用类的 T；泛型类 extends Throwable / catch 泛型类型；`f(List<String>)` 与 `f(List<Integer>)` 重载撞车。运行期两个经典坑：反射破坏泛型后错误延迟到读取点（`List.class.getMethod("add", Object.class).invoke(list, "hello")` 打印正常、get 时才 CCE）；覆写泛型父类方法生成桥方法，反射/AOP 会看到两个签名。

**高级精确点**：擦除丢的是"实例的类型参数"——不是"对象不知道自己的类"（对象头 klass 指针永远精确指向真实类），也不是"声明处泛型没了"（字节码 Signature 属性里留着，所以 Jackson 的 `new TypeReference<List<User>>(){}` 能经 `getGenericSuperclass()` 读到——匿名子类是真实存在的类）。**擦除抹掉的是"某次实例化的实参"，它从未在运行时存在过。** 为什么这么设计：JDK 5 时代的迁移兼容——raw 集合代码不重编译就能混用。

## 四、与其他题的连线

- Q17：synchronizedXxx 的"单方法原子、迭代自己同步"与 fail-fast 同属一条"复合动作自己负责"的边界线。
- Q18/Q21：RandomAccess 分支选壳出现在 synchronizedList 工厂里；lo/hi 拆链是 HashMap/CHM 扩容的公共算法。
- Q14：Dedup 敢共享 byte[] 的前提是不可变——和泛型通配符"焊死危险门"是同一种思路：把不安全的操作在类型层面取消掉。
