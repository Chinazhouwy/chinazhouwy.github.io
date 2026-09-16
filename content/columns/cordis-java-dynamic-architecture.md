---
title: "从 Cordis 到 Java：动态加载与动态流程的架构设计"
date: "2026-09-15"
domain: "专栏"
area: "技术"
module: "架构设计"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "以一个可运行的 Java 17 原型为主线，完整展示 ServiceKey、Component、EffectContext、Fiber、CtxRuntime 与订单管线代码，演示依赖激活、插件卸载回退和流程动态重排。"
tags:
  - Java
  - 架构设计
  - Cordis
  - 插件系统
  - 动态加载
---

# 从 Cordis 到 Java：动态加载与动态流程的架构设计

> 这篇按“代码优先”重写：少讲背景，直接看一个可运行的 Java 17 原型如何实现动态组件、依赖自动激活、卸载回退，以及订单流程的实时增删。
>
> Cordis 论文把动态组合拆成两个问题：组件被移除后，副作用能否完整撤销；组件依赖变化后，生命周期能否反应式调整。[1] 官方教程也把 lifecycle/effect、service/inject、composition/HMR 作为连续的实践路径。[3] 下面的代码是**独立 Java 原型**，不是 Cordis 官方 Java 实现；官方仓库目前仍提示 API 处于活跃开发阶段、可能变化。[2]

## 0. 先看这个 Demo 要证明什么

业务场景是一个订单处理管线：

```text
Pipeline
  ├── 预留库存（order = 20）
  ├── VIP 支付（order = 30，需要 pay.gateway）
  └── 发送通知（order = 40）

支付网关：提供 pay.gateway
管线引擎：提供 order.pipeline
```

运行过程中会发生这些事情：

1. 先加载 `step-vip`，但没有支付网关，所以它保持 `INACTIVE`。
2. 加载支付宝网关，`step-vip` 自动激活并注册进管线。
3. 卸载通知步骤，管线中的注册被自动撤销。
4. 卸载支付宝网关，依赖它的 `step-vip` 先卸载，随后网关才撤销。
5. 加载微信网关，`step-vip` 自动恢复，订单继续执行。
6. 插件执行到一半抛异常，已经安装的绑定被回滚。

核心调用最终就是：

```java
rt.use("engine", pipelineEngine());
rt.use("step-vip", vipStep());       // 依赖不满足，先 INACTIVE
rt.use("gw-alipay", gateway("支付宝")); // 依赖满足，step-vip 自动激活
rt.retire("step-notify");
rt.retire("gw-alipay");              // 先撤依赖者，再撤 provider
rt.use("gw-wechat", gateway("微信支付"));
```

---

## 1. `ServiceKey`：用名字标识服务，用泛型保留 Java 类型

`ServiceKey<T>` 是运行时查找服务的键。运行时用名字比较，Java 编译器用 `T` 帮我们检查 `get/set` 的类型。

```java
package cordis;

/**
 * 类型化共效应键（论文 Definition 19 的 k : K，配合类型族 V_k）。
 * Java 没有依赖类型，用带类型参数的 token 对象承载 V_k 的静态类型。
 * 键按名字标识（intern），因此跨 ClassLoader 也能对齐——插件热加载需要这一点。
 */
public final class ServiceKey<T> {

    private final String name;

    private ServiceKey(String name) {
        this.name = name;
    }

    public static <T> ServiceKey<T> of(String name) {
        return new ServiceKey<>(name);
    }

    public String name() {
        return name;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof ServiceKey<?> other && other.name.equals(name);
    }

    @Override
    public int hashCode() {
        return name.hashCode();
    }

    @Override
    public String toString() {
        return name;
    }
}
```

这里故意让 `equals/hashCode` 只看 `name`：`ServiceKey<Gateway>` 和另一个同名的 `ServiceKey<?>` 会指向同一个运行时槽位；泛型只负责静态类型，不参与运行时身份判断。

## 2. `Component`：组件只有依赖、供给和副作用

一个组件不直接暴露复杂生命周期 API，只实现三个方法：

- `inject()`：我需要哪些服务；
- `provide()`：我会提供哪些服务；
- `apply()`：激活时执行哪些副作用。

```java
package cordis;

import java.util.Map;
import java.util.Set;
import java.util.function.BooleanSupplier;

/**
 * 组件 = 论文 Definition 48 的三元组 (d, p, e)：
 *   d = inject()  共效应规约（声明依赖）
 *   p = provide() 共效应供给（声明可安装的键，不得安装 p 之外的键）
 *   e = apply()   被见证的效应迭代器（安装副作用 + 交回逆）
 *
 * apply 收到的 guard 是迭代边界上的守卫（Algorithm 1 的 guard）：
 * 每一步之前必须检查，false 时立即返回，只保留已累积的逆——这就是 L-Divert。
 */
public interface Component {

    /** d：需要从环境读取的键。未声明就读 = UNDECLARED_ACCESS。 */
    Set<ServiceKey<?>> inject();

    /** p：本组件可能安装的键。 */
    Set<ServiceKey<?>> provide();

    /** e：效应函数。通过 ctx.effect(...) 安装副作用并交回逆。 */
    void apply(EffectContext ctx, BooleanSupplier guard) throws Exception;

    /**
     * 组件工厂：把配置（loader 的 config 字段）绑定进组件，
     * 对应论文“配置绑定进效应函数后才是 Definition 48 的组件”。
     */
    interface Factory {
        Component create(Map<String, String> config);
    }
}
```

`apply()` 不返回“业务对象”，而是通过 `ctx.set(...)`、`ctx.effect(...)` 把修改交给运行时登记。这样卸载时运行时才知道该撤销什么。

## 3. `EffectContext`：每个副作用都必须带一个逆操作

这是整个原型最关键的类。`effect(action)` 执行一次正向修改，要求 `action` 返回逆操作 `Runnable`；逆操作进入累加器，并且后注册的逆先执行。

```java
package cordis;

import java.util.ArrayList;
import java.util.List;

/**
 * 效应上下文 = 论文 Definition 2 的 ∂Γ = (γ, φ)：
 *   γ = 当前上下文状态（这里就是 coeffect 存储 + 子上下文链）
 *   φ = 累加器：迄今所有效应的逆之复合，调用它把 γ 恢复到初始态
 *
 * ctx.effect(action) 是唯一改变上下文的原语（§5.1.1）：
 *   - 执行 action，拿到一个逆（disposer）
 *   - 把逆前置进累加器 => LIFO 恢复顺序
 *   - 把逆也前置进父上下文的累加器 => ∂²Γ 的递归结构
 */
public final class EffectContext {

    private final CtxRuntime runtime;
    private final EffectContext parent;   // π：父上下文
    private Fiber owner;                  // 拥有此上下文的 fiber（可为 null = root；构造后绑定）

    /** 逆累加器 φ。LIFO：后装的先撤。 */
    private final List<Runnable> accumulator = new ArrayList<>();
    /** 已冒泡进父上下文的条目（recover 时精确移除，不动其他 fiber 的条目）。 */
    private final List<Runnable> bubbled = new ArrayList<>();

    EffectContext(CtxRuntime runtime, EffectContext parent, Fiber owner) {
        this.runtime = runtime;
        this.parent = parent;
        this.owner = owner;
    }

    public CtxRuntime runtime() {
        return runtime;
    }

    public EffectContext parent() {
        return parent;
    }

    public Fiber owner() {
        return owner;
    }

    /** 构造后绑定 owner（fiber 与它的上下文互相引用，先建 ctx 再建 fiber 再回填）。 */
    void bindOwner(Fiber f) {
        this.owner = f;
    }

    /**
     * 效应原语。action 执行一次上下文变换并返回它的逆（Runnable）。
     * 逆被前置进本上下文累加器，并冒泡进父上下文累加器。
     * 返回的 dispose 幂等：重复调用只在首次真正恢复。
     */
    public Runnable effect(EffectAction action) throws Exception {
        final boolean[] armed = {true};
        Runnable inverse = action.run(this);   // 执行正向变换，拿到逆

        Runnable dispose = () -> {
            if (!armed[0]) return;
            armed[0] = false;
            inverse.run();
        };

        // 前置 => LIFO
        accumulator.add(0, dispose);
        // 冒泡到父上下文（∂²Γ）：仅当父上下文本身属于某个 fiber 时
        // （子组件的逆是父 fiber 上下文上的效应；root 不持有所有者，不冒泡）
        if (parent != null && parent.owner != null) {
            parent.accumulator.add(0, dispose);
            bubbled.add(dispose);
        }
        return dispose;
    }

    /** 应用累加器 φ：恢复上下文到初始态并清空（Definition 6 recover）。 */
    public void recover() {
        // accumulator 已是 LIFO 顺序，正序执行即逆序撤销
        for (Runnable r : accumulator) {
            try {
                r.run();
            } catch (Exception e) {
                runtime.log("recover 逆执行异常: " + e);
            }
        }
        // 精确移除已冒泡到父上下文的条目（不动其他 fiber 的条目）
        if (parent != null) {
            for (Runnable r : bubbled) parent.accumulator.remove(r);
        }
        bubbled.clear();
        accumulator.clear();
    }

    @FunctionalInterface
    public interface EffectAction {
        Runnable run(EffectContext ctx) throws Exception;
    }

    // ---------- 共效应存取（§5.1.2 的 get/set，走 effect 因而自动可逆）----------

    /** ctx.get(key)：从存储读绑定值；解析走 owner 的 committed 视图（§5.1.4）。 */
    @SuppressWarnings("unchecked")
    public <T> T get(ServiceKey<T> key) {
        // 声明检查：未声明就读 = UNDECLARED_ACCESS（Algorithm 6）
        if (owner != null && !owner.inject().contains(key) && !owner.provide().contains(key)) {
            throw new IllegalStateException("UNDECLARED_ACCESS: " + key
                + " 未在组件 " + owner.name() + " 的 inject/provide 中声明");
        }
        return (T) runtime.store().get(key);
    }

    /** ctx.set(key, value)：安装绑定并返回逆（删除 + 通知）；这本身是一个 effect。 */
    public <T> Runnable set(ServiceKey<T> key, T value) throws Exception {
        return effect(ctx -> {
            Object prev = runtime.store().put(key, value);
            runtime.notifyDependents(key);   // activating/deactivating 分类传播
            return () -> {
                if (prev == null) runtime.store().remove(key);
                else runtime.store().put(key, prev);
                runtime.notifyDependents(key);
            };
        });
    }

    /** 派生子上下文：isolate/intercept 等只是调整继承表，丢弃子上下文即恢复（§5.1.2）。 */
    public EffectContext derive(Fiber childOwner) {
        return new EffectContext(runtime, this, childOwner);
    }
}
```

最值得看的不是注释，而是这 4 行：

```java
Runnable inverse = action.run(this);
accumulator.add(0, dispose);       // 前置，形成 LIFO
parent.accumulator.add(0, dispose); // 子上下文的逆向父上下文冒泡
return dispose;
```

因此 `Pipeline.register(step)` 可以只返回一个 `steps.remove(step)`，然后交给 `ctx.effect(...)`：

```java
Runnable unregister = p.register(impl);
ctx.effect(c -> unregister::run);
```

组件卸载时，运行时调用 `ctx.recover()`，注册动作自然回退。`dispose` 还有 `armed` 标记，所以重复回收不会重复执行逆操作。

## 4. `Fiber`：组件的一次运行时实例

`Component` 是定义，`Fiber` 是被加载进运行时的一次实例。它保存状态、退役标记、失败原因和自己的 `EffectContext`。

```java
package cordis;

import java.util.Set;

/**
 * Fiber = 组件的一次实例化（Definition 49），自带生命周期状态 θ：
 *   Inactive -> Reloading -> Active -> Unloading -> Inactive
 *
 * 关键字段：
 *   inject/provide  = d/p（声明）
 *   ctx             = fiber 自己的子上下文（承载它的效应）
 *   committed       = ω：声明键 -> 提交时提供它的 fiber 名（这里简化为“已满足”集合）
 *   retiring        = τ：编排者是否已退役该 fiber
 *   target          = 目标视图：当前 inject 是否全部被 Active provider 满足
 */
public final class Fiber {

    public enum State { INACTIVE, RELOADING, ACTIVE, UNLOADING, FAILED }

    private final String name;
    private final Component component;
    private final EffectContext ctx;

    private volatile State state = State.INACTIVE;
    private volatile boolean retiring = false;
    private Throwable failure;

    Fiber(String name, Component component, EffectContext ctx) {
        this.name = name;
        this.component = component;
        this.ctx = ctx;
    }

    public String name() { return name; }
    public State state() { return state; }
    void setState(State s) { this.state = s; }
    public EffectContext ctx() { return ctx; }
    public Set<ServiceKey<?>> inject() { return component.inject(); }
    public Set<ServiceKey<?>> provide() { return component.provide(); }
    public Component component() { return component; }

    boolean isRetiring() { return retiring; }
    void retire() { this.retiring = true; }

    public boolean isActive() { return state == State.ACTIVE; }

    void fail(Throwable t) { this.failure = t; this.state = State.FAILED; }
    public Throwable failure() { return failure; }

    @Override
    public String toString() {
        return name + "(" + state + ")";
    }
}
```

状态流转在代码里是显式的：

```text
INACTIVE -> RELOADING -> ACTIVE
ACTIVE   -> UNLOADING -> INACTIVE
RELOADING -> FAILED
```

## 5. `CtxRuntime`：依赖满足就激活，依赖消失就级联卸载

下面是运行时完整实现。阅读顺序建议是：`use` → `refreshAll` → `isSatisfied` → `activate/deactivate` → `retire`。

```java
package cordis;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 运行时 = 论文的 registry（Definition 50）+ 编排/生命周期规则（§4.2）。
 *
 * 核心不变量（§3.2 反应式共效应）：
 *   一个 fiber 只有在它 inject 的每个键都被某个 Active provider 提供时才激活；
 *   任何一次 set/remove 都对所有相关 fiber 重新分类（activating/deactivating/neutral），
 *   驱动激活或去激活——依赖消失时先去激活依赖者，再撤销绑定（L-Unload 的顺序守卫）。
 */
public final class CtxRuntime {

    /** Σ：coeffect 存储（键 -> 绑定值）。 */
    private final Map<ServiceKey<?>, Object> store = new ConcurrentHashMap<>();

    /** 每个键当前的 provider fiber（保证 Definition 50 的 provider 唯一性）。 */
    private final Map<ServiceKey<?>, Fiber> providers = new ConcurrentHashMap<>();

    /** F_γ：fiber 注册表。 */
    private final Map<String, Fiber> fibers = new LinkedHashMap<>();

    private final EffectContext root;
    private final List<String> trace = Collections.synchronizedList(new ArrayList<>());

    public CtxRuntime() {
        this.root = new EffectContext(this, null, null);
    }

    public Map<ServiceKey<?>, Object> store() { return store; }
    public EffectContext root() { return root; }
    public List<String> trace() { return trace; }

    public void log(String s) {
        trace.add(s);
        System.out.println("  [runtime] " + s);
    }

    // ===================== 编排：O-Insert =====================

    /**
     * 装载一个组件为 fiber。O-Insert 的前置条件：provide 不得与已存在的 provider 冲突。
     * 装载后并不立即激活——是否激活由 refresh 根据依赖满足性决定（反应式）。
     */
    public synchronized Fiber use(String name, Component component) {
        if (fibers.containsKey(name)) {
            throw new IllegalStateException("fiber 名已存在: " + name);
        }
        for (ServiceKey<?> k : component.provide()) {
            Fiber exist = providers.get(k);
            if (exist != null) {
                throw new IllegalStateException("provide 冲突: 键 " + k
                    + " 已由 " + exist.name() + " 提供，" + name + " 不能重复提供");
            }
        }
        EffectContext child = root.derive(null);
        Fiber fiber = new Fiber(name, component, child);
        child.bindOwner(fiber);   // 回填 owner，get 的声明检查从此刻生效
        fibers.put(name, fiber);
        log("O-Insert " + name + " (inject=" + component.inject() + ", provide=" + component.provide() + ")");
        // 反应式：新 fiber 可能让别的 fiber 满足，也可能自己被满足
        refreshAll("insert:" + name);
        return fibers.get(name);
    }

    // ===================== 反应式分类：notify + refresh =====================

    /**
     * Algorithm 3 notify：绑定变化后，对所有 inject 了该键的 fiber 重新求值。
     */
    void notifyDependents(ServiceKey<?> key) {
        for (Fiber f : new ArrayList<>(fibers.values())) {
            if (f.inject().contains(key)) {
                refresh(f, "notify:" + key.name());
            }
        }
    }

    private void refreshAll(String reason) {
        // 反复刷新直到不动点：一个 fiber 激活可能让另一个满足（链式反应）
        boolean changed = true;
        int guard = 0;
        while (changed && guard++ < 100) {
            changed = false;
            for (Fiber f : new ArrayList<>(fibers.values())) {
                if (refresh(f, reason)) changed = true;
            }
        }
        if (guard >= 100) log("refreshAll 未收敛（可能存在依赖环，环上组件永久 inactive）");
    }

    /**
     * 单个 fiber 的重新求值（Algorithm 5 refresh）：
     *   target = inject 是否全部由 Active provider 满足
     *   target 且未 retiring -> 应 Active；否则应 Inactive
     * 返回是否发生了状态迁移。
     */
    private boolean refresh(Fiber f, String reason) {
        boolean satisfied = isSatisfied(f);
        boolean wantActive = satisfied && !f.isRetiring();

        if (wantActive && f.state() == Fiber.State.INACTIVE) {
            activate(f, reason);
            return true;
        } else if (!wantActive && f.state() == Fiber.State.ACTIVE) {
            deactivate(f, reason);
            return true;
        } else if (!wantActive && f.state() == Fiber.State.RELOADING) {
            // 装载途中依赖被抽走：guard 在迭代边界触发（L-Divert）
            f.ctx().recover();
            f.setState(Fiber.State.INACTIVE);
            log("L-Divert " + f.name() + " 装载中断，已恢复");
            return true;
        }
        return false;
    }

    /** 满足性谓词 σ ⊧ d：inject 的每个键都有 Active provider（Definition 53）。 */
    private boolean isSatisfied(Fiber f) {
        for (ServiceKey<?> k : f.inject()) {
            Fiber p = providers.get(k);
            if (p == null || !p.isActive()) return false;
            if (store.get(k) == null) return false;
        }
        return true;
    }

    // ===================== 生命周期：activate / deactivate =====================

    /** L-Begin + L-Iter + L-Finish：运行效应迭代器，安装 provide 的键。 */
    private void activate(Fiber f, String reason) {
        f.setState(Fiber.State.RELOADING);
        log("L-Begin " + f.name() + " (" + reason + ")");
        // 先登记 provider 身份（这样它的依赖者能看到 Active provider）
        for (ServiceKey<?> k : f.provide()) {
            providers.put(k, f);
        }
        // guard：target 稳定性检查。装载途中若被退役/依赖抽走，迭代边界处停下。
        java.util.function.BooleanSupplier guard = () ->
            f.state() == Fiber.State.RELOADING && !f.isRetiring() && isSatisfied(f);
        try {
            f.component().apply(f.ctx(), guard);
            if (f.state() == Fiber.State.RELOADING) {
                f.setState(Fiber.State.ACTIVE);
                log("L-Finish " + f.name() + " -> ACTIVE");
            }
        } catch (Exception e) {
            f.fail(e);
            log("FAILED " + f.name() + ": " + e.getMessage());
            // 失败时撤销已装的部分
            f.ctx().recover();
            for (ServiceKey<?> k : f.provide()) providers.remove(k, f);
        }
    }

    /**
     * L-Unload：去激活。顺序守卫（Definition on L-Unload）：
     *   先让依赖者去激活，再撤销本 fiber 的绑定——
     *   这样依赖者在拆除期间仍能读到它的依赖（Theorem 70）。
     */
    private void deactivate(Fiber f, String reason) {
        f.setState(Fiber.State.UNLOADING);
        log("L-Leave " + f.name() + " -> UNLOADING (" + reason + ")");

        // 1) 先递归去激活依赖 f 所提供键的 fiber
        for (Fiber dep : new ArrayList<>(fibers.values())) {
            if (dep == f) continue;
            boolean dependsOnF = false;
            for (ServiceKey<?> k : dep.inject()) {
                if (providers.get(k) == f) { dependsOnF = true; break; }
            }
            if (dependsOnF && dep.state() == Fiber.State.ACTIVE) {
                deactivate(dep, "cascade:" + f.name());
            }
        }

        // 2) 再应用累加器 φ 恢复上下文（撤销绑定 + 触发通知）
        f.ctx().recover();
        for (ServiceKey<?> k : f.provide()) {
            providers.remove(k, f);
            store.remove(k);
        }
        f.setState(Fiber.State.INACTIVE);
        log("L-Unload " + f.name() + " -> INACTIVE，效应已完全回退");
    }

    // ===================== 编排：O-Retire（卸载入口）=====================

    /** 退役一个 fiber：置 τ，然后反应式去激活（依赖者会级联跟随）。 */
    public synchronized void retire(String name) {
        Fiber f = fibers.get(name);
        if (f == null) { log("retire: 无此 fiber " + name); return; }
        f.retire();               // τ = ⊤
        log("O-Retire " + name);
        refresh(f, "retire");
        // 退役后可能让别的 fiber 也不满足
        refreshAll("retire:" + name);
    }

    /** 从注册表移除（O-Remove，要求子先于父；这里扁平化简化）。 */
    public synchronized void remove(String name) {
        retire(name);
        fibers.remove(name);
        log("O-Remove " + name + "（uid 清除）");
    }

    public synchronized Collection<Fiber> allFibers() {
        return new ArrayList<>(fibers.values());
    }

    public void dumpState() {
        StringBuilder sb = new StringBuilder("  registry: ");
        for (Fiber f : fibers.values()) sb.append(f).append(" ");
        sb.append("| store keys: ").append(store.keySet());
        log(sb.toString());
    }
}
```

### 5.1 `use` 只负责注册，不保证立即激活

```java
public synchronized Fiber use(String name, Component component) {
    // 检查 fiber 名和 provide 键冲突
    // 放进 fibers
    // refreshAll：重新判断所有依赖
}
```

真正决定状态的是 `isSatisfied`：

```java
private boolean isSatisfied(Fiber f) {
    for (ServiceKey<?> k : f.inject()) {
        Fiber p = providers.get(k);
        if (p == null || !p.isActive()) return false;
        if (store.get(k) == null) return false;
    }
    return true;
}
```

所以 `step-vip` 的 `inject()` 是：

```java
Set.of(K_PIPELINE, K_GATEWAY)
```

没有 `K_GATEWAY` 时，它只能是 `INACTIVE`；网关上线后，`refreshAll` 会再次判断并激活它。

### 5.2 激活失败时恢复已经安装的部分

`activate` 先把组件置为 `RELOADING`，执行 `apply`；如果中途抛异常，进入 `FAILED`，然后调用 `recover()`：

```java
try {
    f.component().apply(f.ctx(), guard);
    f.setState(Fiber.State.ACTIVE);
} catch (Exception e) {
    f.fail(e);
    f.ctx().recover();
    for (ServiceKey<?> k : f.provide()) providers.remove(k, f);
}
```

这就是“装载到一半失败，不留下半个绑定”的代码位置。

### 5.3 卸载顺序：先依赖者，后 provider

`deactivate` 的关键顺序不能反：

```java
// 1. 先递归卸载依赖当前 provider 的 fiber
// 2. 再 recover 当前 fiber 的副作用
// 3. 最后移除 provider 和 store 绑定
```

这样 `step-vip` 的 disposer 在执行时仍然可以读取 `K_GATEWAY`；如果先删网关，再执行依赖者的 disposer，这个读取就会失效。

## 6. `DemoMain`：把流程步骤真的动态装进管线

前面的运行时没有业务含义，业务含义全部在这个演示类里：网关是 provider，步骤是依赖者，`Pipeline.register` 返回可逆的注销函数。

```java
package demo;

import cordis.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.BooleanSupplier;

/**
 * 演示：用 Cordis 思想搭一个「订单处理管线」业务架构。
 *
 * 三个演示点：
 *  A. 反应式激活：管线步骤声明依赖（inject），依赖缺位时保持 Inactive，
 *     provider 上线后自动激活——加载顺序不用人工编排。
 *  B. 卸载即回退：卸载插件时，它对管线/存储的全部副作用自动撤销（LIFO），
 *     且拆除期间仍能读到自己的依赖（依赖者先拆、提供者后拆的顺序守卫）。
 *  C. 流程动态组装：步骤按 order 注册进引擎；加载/卸载步骤组件时，
 *     执行流程实时变化——流程不是硬编码调用链。
 */
public final class DemoMain {

    // ---------- 键（coeffect keys）----------

    static final ServiceKey<Gateway> K_GATEWAY = ServiceKey.of("pay.gateway");
    static final ServiceKey<Pipeline> K_PIPELINE = ServiceKey.of("order.pipeline");

    // ---------- 业务类型 ----------

    record Order(String id, long amountFen) {}

    interface Gateway {
        String charge(Order o);
    }

    /** 管线步骤：order 决定它在流程里的位置。 */
    interface PipelineStep {
        int order();
        String name();
        void execute(Order o, List<String> out);
    }

    /** 管线引擎：步骤可逆地注册进来，按 order 排序执行。 */
    static final class Pipeline {
        final List<PipelineStep> steps = new ArrayList<>();

        Runnable register(PipelineStep s) {
            steps.add(s);
            steps.sort(java.util.Comparator.comparingInt(PipelineStep::order));
            return () -> steps.remove(s);   // 逆：注销
        }

        List<String> run(Order o) {
            List<String> out = new ArrayList<>();
            for (PipelineStep s : steps) s.execute(o, out);
            return out;
        }
    }

    // ---------- 组件 ----------

    /** 支付网关：提供 pay.gateway。 */
    static Component gateway(String mode) {
        return new Component() {
            public Set<ServiceKey<?>> inject() { return Set.of(); }
            public Set<ServiceKey<?>> provide() { return Set.of(K_GATEWAY); }
            public void apply(EffectContext ctx, BooleanSupplier guard) throws Exception {
                Gateway gw = o -> mode + " 扣款成功:" + o.id() + " ¥" + (o.amountFen() / 100.0);
                ctx.set(K_GATEWAY, gw);
            }
        };
    }

    /** 管线引擎组件：提供 order.pipeline。 */
    static Component pipelineEngine() {
        return new Component() {
            final Pipeline pipeline = new Pipeline();
            public Set<ServiceKey<?>> inject() { return Set.of(); }
            public Set<ServiceKey<?>> provide() { return Set.of(K_PIPELINE); }
            public void apply(EffectContext ctx, BooleanSupplier guard) throws Exception {
                ctx.set(K_PIPELINE, pipeline);
            }
        };
    }

    /** 通用步骤组件：可选依赖网关；把步骤注册进引擎（注册 = 可逆副作用）。 */
    static Component step(PipelineStep impl, boolean needsGateway) {
        return new Component() {
            public Set<ServiceKey<?>> inject() {
                return needsGateway ? Set.of(K_PIPELINE, K_GATEWAY) : Set.of(K_PIPELINE);
            }
            public Set<ServiceKey<?>> provide() { return Set.of(); }
            public void apply(EffectContext ctx, BooleanSupplier guard) throws Exception {
                Pipeline p = ctx.get(K_PIPELINE);
                Runnable unregister = p.register(impl);
                ctx.effect(c -> () -> {
                    // 拆除期间读取依赖：顺序守卫保证提供者尚未撤销绑定（Theorem 70）
                    if (needsGateway) {
                        Gateway still = ctx.get(K_GATEWAY);
                        System.out.println("    (step) " + impl.name()
                            + " 注销中——拆除期间仍可读到网关: " + (still != null));
                    } else {
                        System.out.println("    (step) " + impl.name() + " 注销中");
                    }
                    unregister.run();
                });
                System.out.println("    (step) " + impl.name() + " 已注册 (order=" + impl.order() + ")");
            }
        };
    }

    /** VIP 支付步骤：激活时读取网关，执行时使用（读依赖的典型模式）。 */
    static Component vipStep() {
        return new Component() {
            public Set<ServiceKey<?>> inject() { return Set.of(K_PIPELINE, K_GATEWAY); }
            public Set<ServiceKey<?>> provide() { return Set.of(); }
            public void apply(EffectContext ctx, BooleanSupplier guard) throws Exception {
                Pipeline p = ctx.get(K_PIPELINE);
                Gateway gw = ctx.get(K_GATEWAY);
                Runnable unregister = p.register(new PipelineStep() {
                    public int order() { return 30; }
                    public String name() { return "VIP 支付"; }
                    public void execute(Order o, List<String> out) { out.add(gw.charge(o)); }
                });
                ctx.effect(c -> () -> {
                    Gateway still = ctx.get(K_GATEWAY);
                    System.out.println("    (step) VIP 支付 注销中——拆除期间仍可读到网关: " + (still != null));
                    unregister.run();
                });
                System.out.println("    (step) VIP 支付 已注册 (order=30)");
            }
        };
    }

    // ---------- 演示 ----------

    public static void main(String[] args) throws Exception {
        CtxRuntime rt = new CtxRuntime();

        System.out.println("\n== 1. 装载引擎 ==");
        rt.use("engine", pipelineEngine());
        Pipeline engine = (Pipeline) rt.store().get(K_PIPELINE);

        System.out.println("\n== 2. 声明了依赖但网关缺席：步骤保持 Inactive ==");
        rt.use("step-vip", vipStep());
        rt.dumpState();   // step-vip 应为 INACTIVE

        System.out.println("\n== 3. 网关上线：step-vip 自动激活并注册（反应式） ==");
        rt.use("gw-alipay", gateway("支付宝"));
        rt.dumpState();

        System.out.println("\n== 4. 再装载两个步骤：流程实时变长 ==");
        rt.use("step-inventory", step(new StepInventory(), false));
        rt.use("step-notify", step(new StepNotify(), false));
        System.out.println("    当前流程: " + engine.steps.stream().map(PipelineStep::name).toList());

        System.out.println("\n== 5. 运行一单 ==");
        for (String line : engine.run(new Order("SO-2026-0915", 12900))) System.out.println("    > " + line);

        System.out.println("\n== 6. 卸载通知步骤：注册的副作用完好回退（时间可组合性） ==");
        rt.retire("step-notify");
        System.out.println("    当前流程: " + engine.steps.stream().map(PipelineStep::name).toList());

        System.out.println("\n== 7. 网关下线：依赖它的 step-vip 级联去激活（顺序守卫：先依赖者后提供者） ==");
        rt.retire("gw-alipay");
        rt.dumpState();
        System.out.println("    当前流程: " + engine.steps.stream().map(PipelineStep::name).toList());

        System.out.println("\n== 8. 换一个网关配置重装（配置协调 = 替换 provider） ==");
        rt.use("gw-wechat", gateway("微信支付"));
        rt.dumpState();
        for (String line : engine.run(new Order("SO-2026-0916", 9900))) System.out.println("    > " + line);

        System.out.println("\n== 9. 组件内异常：装载到一半失败自动回退（FAILED + recover） ==");
        rt.use("bad-plugin", new Component() {
            public Set<ServiceKey<?>> inject() { return Set.of(); }
            public Set<ServiceKey<?>> provide() { return Set.of(ServiceKey.of("audit.sink")); }
            public void apply(EffectContext ctx, BooleanSupplier guard) throws Exception {
                ctx.set(ServiceKey.of("audit.sink"), (Object) "占位绑定");
                throw new IllegalStateException("装载到一半失败");
            }
        });
        rt.dumpState();

        System.out.println("\n== 10. 最终检查：卸载全部 ==");
        for (String n : List.of("bad-plugin", "step-inventory", "gw-wechat", "engine")) {
            rt.retire(n);
        }
        rt.dumpState();
        System.out.println("\n演示完毕。store 残留: " + rt.store().keySet());
    }

    // ---------- 两个业务步骤 ----------

    static final class StepInventory implements PipelineStep {
        public int order() { return 20; }
        public String name() { return "预留库存"; }
        public void execute(Order o, List<String> out) { out.add("库存已预留: " + o.id()); }
    }

    static final class StepNotify implements PipelineStep {
        public int order() { return 40; }
        public String name() { return "发送通知"; }
        public void execute(Order o, List<String> out) { out.add("通知已发送: " + o.id()); }
    }
}
```

### 6.1 网关组件：只提供 `pay.gateway`

```java
static Component gateway(String mode) {
    return new Component() {
        public Set<ServiceKey<?>> inject() { return Set.of(); }
        public Set<ServiceKey<?>> provide() { return Set.of(K_GATEWAY); }
        public void apply(EffectContext ctx, BooleanSupplier guard) throws Exception {
            Gateway gw = o -> mode + " 扣款成功:" + o.id()
                + " ¥" + (o.amountFen() / 100.0);
            ctx.set(K_GATEWAY, gw);
        }
    };
}
```

`ctx.set(K_GATEWAY, gw)` 不只是往 Map 里 `put`：`set` 内部调用 `effect`，因此它同时登记了“恢复旧值/删除当前值”的逆操作。

### 6.2 普通步骤：注册动作和注销动作成对出现

```java
static Component step(PipelineStep impl, boolean needsGateway) {
    return new Component() {
        public Set<ServiceKey<?>> inject() {
            return needsGateway
                ? Set.of(K_PIPELINE, K_GATEWAY)
                : Set.of(K_PIPELINE);
        }

        public Set<ServiceKey<?>> provide() { return Set.of(); }

        public void apply(EffectContext ctx, BooleanSupplier guard)
                throws Exception {
            Pipeline p = ctx.get(K_PIPELINE);
            Runnable unregister = p.register(impl);
            ctx.effect(c -> () -> {
                unregister.run();
            });
            System.out.println("已注册: " + impl.name());
        }
    };
}
```

这里就是“动态流程”的核心：

```java
Runnable unregister = p.register(impl); // 正向：加入 steps
ctx.effect(c -> unregister::run);       // 逆向：从 steps 删除
```

### 6.3 VIP 支付步骤：依赖网关并捕获当前实现

```java
static Component vipStep() {
    return new Component() {
        public Set<ServiceKey<?>> inject() {
            return Set.of(K_PIPELINE, K_GATEWAY);
        }

        public Set<ServiceKey<?>> provide() { return Set.of(); }

        public void apply(EffectContext ctx, BooleanSupplier guard)
                throws Exception {
            Pipeline p = ctx.get(K_PIPELINE);
            Gateway gw = ctx.get(K_GATEWAY);
            Runnable unregister = p.register(new PipelineStep() {
                public int order() { return 30; }
                public String name() { return "VIP 支付"; }
                public void execute(Order o, List<String> out) {
                    out.add(gw.charge(o));
                }
            });
            ctx.effect(c -> () -> {
                unregister.run();
            });
        }
    };
}
```

替换支付网关时，旧的 `step-vip` 会先退役；新网关上线后，运行时重新执行 `vipStep.apply()`，所以它捕获的是新的 `Gateway` 实例。

## 7. 编译运行

将上述 6 个源码文件放在以下目录结构中：

```text
src/
├── cordis/
│   ├── ServiceKey.java
│   ├── Component.java
│   ├── EffectContext.java
│   ├── Fiber.java
│   └── CtxRuntime.java
└── demo/
    └── DemoMain.java
```

使用 JDK 17 编译：

```bash
rm -rf build
mkdir -p build
javac -encoding UTF-8 -d build src/cordis/*.java src/demo/*.java
java -Dfile.encoding=UTF-8 -cp build demo.DemoMain
```

本地原型的实际输出包括：

```text
== 2. 声明了依赖但网关缺席：步骤保持 Inactive ==
  registry: engine(ACTIVE) step-vip(INACTIVE) | store keys: [order.pipeline]

== 3. 网关上线：step-vip 自动激活并注册（反应式） ==
  L-Begin step-vip (insert:gw-alipay)
    (step) VIP 支付 已注册 (order=30)

== 4. 再装载两个步骤：流程实时变长 ==
    当前流程: [预留库存, VIP 支付, 发送通知]

== 5. 运行一单 ==
    > 库存已预留: SO-2026-0915
    > 支付宝 扣款成功:SO-2026-0915 ¥129.0
    > 通知已发送: SO-2026-0915

== 6. 卸载通知步骤：注册的副作用完好回退 ==
    当前流程: [预留库存, VIP 支付]

== 7. 网关下线：依赖它的 step-vip 级联去激活 ==
    (step) VIP 支付 注销中——拆除期间仍可读到网关: true

== 8. 换一个网关配置重装 ==
    > 微信支付 扣款成功:SO-2026-0916 ¥99.0

== 9. 组件内异常：装载到一半失败自动回退 ==
  FAILED bad-plugin: 装载到一半失败

演示完毕。store 残留: []
```

这里的 `bad-plugin(FAILED)` 仍会留在 fiber 注册表中，这是当前原型的可观察失败状态；但它安装的 `audit.sink` 已经被 `recover()` 清掉，最终 `store` 没有残留。

## 8. 这份原型实现了什么，没实现什么

已实现的核心语义：

- `ctx.effect(action)`：副作用和逆操作绑定；
- 累加器前置插入：后注册、先回收；
- `inject/provide`：依赖满足后自动激活；
- provider 下线：依赖者先卸载，再撤 provider；
- `apply` 异常：恢复已经完成的部分；
- `Pipeline.register`：把流程步骤变成可逆注册。

明确没有实现：

- JAR/`ClassLoader` 级别的真正热加载；
- Cordis 官方 Loader、配置协调和 HMR；
- 事件总线、持久化、权限隔离和沙箱；
- 并发下的完整生命周期协调；
- 服务版本、多 provider、依赖环的生产级诊断。

因此这份代码适合拿来**看清楚运行时原语如何落地**，不应直接当成生产插件框架。

## 9. 复习时只记这 5 个代码点

1. **服务键**：`ServiceKey<T>` 是运行时依赖的身份。
2. **组件声明**：`inject()` 决定“我等谁”，`provide()` 决定“我提供谁”。
3. **副作用登记**：所有动态注册都要走 `ctx.effect(...)`，否则卸载时找不到逆操作。
4. **反应式激活**：`isSatisfied()` 决定 fiber 是否能进入 `ACTIVE`。
5. **卸载顺序**：`deactivate()` 必须先处理依赖者，再恢复 provider 自己。

## Sources

[1] https://arxiv.org/abs/2608.25512 — A Programming Paradigm for Spatiotemporal Composability
    > "We identify two orthogonal dimensions of the problem: temporal composability, the ability to completely revert a component’s side effects upon removal, and spatial composability, the ability to declare and reactively manage inter-component dependencies."
[2] https://github.com/cordiverse/cordis — Cordis official repository
    > "Cordis is under active development. The API is not yet stable and may change without notice."
[3] https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial — DeepSeek Harness Cordis tutorial
    > "生命周期与 effect ：由 Cordis 管理的注册会在所属插件卸载时撤销。 服务 ：在 ctx 上公开一项能力，并通过 inject 依赖它。"
