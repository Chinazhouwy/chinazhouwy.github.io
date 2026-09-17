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
summary: "从普通 Java 订单流程出发，用一个 150 行以内的 MiniCordisDemo 解释 Cordis 的两个核心思想：动态副作用返回 undo，组件声明依赖并由 Runtime 自动启停。"
tags:
  - Java
  - 架构设计
  - Cordis
  - 插件系统
  - 动态加载
---

# 从 Cordis 到 Java：动态加载与动态流程的架构设计

> 这篇文章不尝试用 Java 手搓完整 Cordis Runtime，而是做一件更实用的事：**把 Cordis 翻译成 Java 程序员熟悉的几个小接口**。
>
> 你只需要先看懂两个动作：动态注册时返回一个 undo；组件声明自己需要哪些服务，Runtime 根据服务是否存在决定它什么时候启动和停止。
>
> Cordis 论文把动态组合概括为两个问题：组件移除后，副作用能否完整撤销；依赖变化后，组件能否反应式地激活和去激活。[1] 官方教程也把生命周期、副作用、服务依赖和组合热重载串成一条学习路径。[3] 本文的 Java 代码是一个独立的教学 Demo，不是 Cordis 官方 Java 实现；官方仓库明确提示其 API 仍在活跃开发中。[2]

## 1. 普通 Java 动态流程为什么麻烦

一个普通订单流程可能先这样写：`pipeline.add(new CheckStockStep())`、`pipeline.add(new DiscountStep())`、`pipeline.add(new PayStep())`。

现在来了一个 VIP 插件，代码也许只需要再加一个步骤，但真正的问题马上出现：

- 插件卸载时，怎么把它注册的步骤删掉？
- 插件依赖的支付服务不存在时，要不要启动？
- 支付服务后来上线，插件要不要自动恢复？
- 插件除了步骤，还注册了监听器、定时任务、路由，怎么保证全部清理？

普通 Java 当然能解决这些问题，但通常靠开发者自己维护一堆 `start()`、`stop()`、`unregister()` 和条件判断，很容易出现“注册成功了，卸载漏了一处”的问题。

Cordis 值得借鉴的地方，不是某个神秘 API，而是它把这两类运行时问题变成了约束：

- 动态副作用：做一件事时，同时记住怎么撤销。
- 动态依赖：声明我需要什么，由 Runtime 决定我何时可运行。

## 2. 先把 Cordis 翻译成 Java

| Cordis 的概念 | Java 程序员先这样理解 |
|---|---|
| Context | `Context` / 运行时容器 |
| Service | `Context` 里的一个服务名和值 |
| `inject` | `requires()`：我需要哪些服务 |
| `effect` | 执行注册动作，同时返回 undo |
| `dispose` | `Runnable`、`close()` 或 `unregister()` |
| Plugin | 一个可动态启动和停止的组件 |
| reactive | 服务变化后重新检查并自动启停 |

这不是严格的一一对应，而是为了让 Java 开发者先抓住主线：**插件不是被代码硬调用，而是被 Runtime 根据环境状态管理。**

## 3. 第一个思想：注册动作必须能撤销

先看最小的 Java 形式：`pipeline.register(step)` 做正向注册，同时返回 `Runnable` 作为撤销动作。

在 Demo 中，注册的正向动作是把步骤加入 `steps`；返回的逆动作是 `steps.remove(step)`。这两个动作必须放在一起，不能一个写在插件启动处、另一个散落在别的清理逻辑里。

如果一个插件有多个动态副作用，可以把它们交给一个作用域保存。Demo 里的 `EffectScope` 保存多个 undo，并在关闭时倒序执行：后注册的先撤销。

```text
启动插件：注册步骤、注册监听器、创建定时任务
卸载插件：倒序执行步骤注销、监听器注销、定时任务取消
```

这样，“卸载插件”不需要知道插件内部注册过什么，只需要关闭它的作用域。

## 4. 第二个思想：组件声明自己需要什么

Demo 中的 `Plugin` 只有四个关心点：名称、依赖、启动和停止。

`VipPlugin.requires()` 返回 `payment`，所以它不需要自己查找支付实现，也不需要自己决定启动顺序。Runtime 每次服务变化后调用 `refresh()`：

```text
requires 全部满足 → start(context, scope)
依赖缺失         → scope.close() + stop()
依赖恢复         → 再次 start()
```

这和传统 Java 常见的“我自己找依赖然后启动”不同，更接近：**我声明依赖，运行时决定我什么时候可以活着。**

## 5. 完整 Demo：动态订单流程

下面是完整的单文件 Demo，共 150 行，不依赖 Spring 或第三方库，使用 JDK 17 即可运行。

```java
import java.util.*;

public class MiniCordisDemo {
    record Order(String id) {}

    interface OrderStep {
        void execute(Order order);
    }

    interface Effect {
        Runnable apply();
    }
    static final class Pipeline {
        private final List<OrderStep> steps = new ArrayList<>();

        Runnable register(OrderStep step) {
            steps.add(step);
            return () -> steps.remove(step);
        }

        void run(Order order) {
            steps.forEach(step -> step.execute(order));
        }

        int size() { return steps.size(); }
    }

    static final class EffectScope implements AutoCloseable {
        private final List<Runnable> disposers = new ArrayList<>();

        void add(Effect effect) { disposers.add(effect.apply()); }

        @Override
        public void close() {
            for (int i = disposers.size() - 1; i >= 0; i--) {
                disposers.get(i).run();
            }
            disposers.clear();
        }
    }

    interface Plugin {
        String name();
        Set<String> requires();
        void start(Context context, EffectScope scope);
        void stop();
    }

    static final class Context {
        private final Map<String, Object> services = new HashMap<>();
        private final Pipeline pipeline = new Pipeline();

        void putService(String name, Object service) { services.put(name, service); }

        void removeService(String name) { services.remove(name); }

        boolean hasAll(Set<String> names) {
            return services.keySet().containsAll(names);
        }

        @SuppressWarnings("unchecked")
        <T> T service(String name) {
            return (T) services.get(name);
        }

        Pipeline pipeline() { return pipeline; }
    }

    static final class Runtime {
        private final Context context = new Context();
        private final List<Plugin> plugins = new ArrayList<>();
        private final Map<Plugin, EffectScope> active = new LinkedHashMap<>();

        void add(Plugin plugin) {
            plugins.add(plugin);
            System.out.println("加载插件: " + plugin.name());
            refresh();
        }

        void loadService(String name, Object service) {
            context.putService(name, service);
            System.out.println("上线服务: " + name);
            refresh();
        }

        void unloadService(String name) {
            context.removeService(name);
            System.out.println("下线服务: " + name);
            refresh();
        }

        private void refresh() {
            for (Plugin plugin : plugins) {
                boolean ready = context.hasAll(plugin.requires());
                if (ready && !active.containsKey(plugin)) {
                    EffectScope scope = new EffectScope();
                    plugin.start(context, scope);
                    active.put(plugin, scope);
                } else if (!ready && active.containsKey(plugin)) {
                    active.remove(plugin).close();
                    plugin.stop();
                }
            }
        }

        Context context() {
            return context;
        }
    }

    record Payment(String channel) {}

    static final class VipPlugin implements Plugin {
        public String name() {
            return "vip-discount";
        }

        public Set<String> requires() {
            return Set.of("payment");
        }

        public void start(Context context, EffectScope scope) {
            Payment payment = context.service("payment");
            OrderStep step = order -> System.out.println(
                payment.channel() + " VIP 折扣: " + order.id());
            scope.add(() -> context.pipeline().register(step));
            System.out.println("VIP 插件启动，使用 " + payment.channel());
        }

        public void stop() {
            System.out.println("VIP 插件停止");
        }
    }

    public static void main(String[] args) {
        Runtime runtime = new Runtime();
        runtime.add(new VipPlugin());
        System.out.println("流程步骤数: " + runtime.context().pipeline().size());

        runtime.loadService("payment", new Payment("支付宝"));
        System.out.println("流程步骤数: " + runtime.context().pipeline().size());
        runtime.context().pipeline().run(new Order("SO-001"));

        runtime.unloadService("payment");
        System.out.println("流程步骤数: " + runtime.context().pipeline().size());

        runtime.loadService("payment", new Payment("微信支付"));
        runtime.context().pipeline().run(new Order("SO-002"));
    }
}
```

### 代码只看 5 个位置

1. **`Pipeline.register`**：加入步骤后返回 `steps.remove(step)`，这就是最小 undo。
2. **`Effect`**：`apply()` 不返回业务结果，而是返回撤销动作。
3. **`EffectScope.close`**：倒序执行所有撤销动作。
4. **`Plugin.requires`**：VIP 插件声明需要 `payment`，不负责自己查找依赖。
5. **`Runtime.refresh`**：服务出现就启动插件，服务消失就关闭作用域并停止插件。

注意 `VipPlugin.start()` 里的这一行：`scope.add(() -> context.pipeline().register(step))`。

它表达的是：

执行 `Effect.apply()`，把步骤注册进 `Pipeline`，得到一个 `Runnable undo`，最后由 `EffectScope` 保存。

## 6. 运行

把代码保存为 `MiniCordisDemo.java` 后，执行 `mkdir -p build && javac -encoding UTF-8 -d build MiniCordisDemo.java && java -Dfile.encoding=UTF-8 -cp build MiniCordisDemo`。

这段代码的实际运行结果是：先输出步骤数 `0`，上线支付宝后输出 `VIP 插件启动，使用 支付宝` 和步骤数 `1`；下线支付服务后输出 `VIP 插件停止` 和步骤数 `0`；重新上线微信支付后输出 `VIP 插件启动，使用 微信支付`，订单使用微信支付执行。

把输出按过程读一遍：

| 时机 | 结果 |
|---|---|
| 加载 `vip-discount` | `payment` 不存在，插件没有启动，流程步骤数为 0 |
| 上线支付宝服务 | 依赖满足，VIP 插件启动并注册 1 个步骤 |
| 执行订单 | 使用支付宝配置执行 VIP 折扣 |
| 下线 `payment` | 作用域关闭，步骤被移除，插件停止，流程步骤数回到 0 |
| 上线微信支付 | 依赖再次满足，插件重新启动并注册步骤 |
| 执行订单 | 同一个插件使用新的微信支付服务 |

## 7. 这个 Demo 故意没有做什么

这是“通过 Java 理解 Cordis”的第一篇，不是 Cordis 源码复刻，也不是生产插件框架。

它故意没有展开：

- JAR / `ClassLoader` 级别的热加载；
- 配置文件 Loader 和 HMR；
- 事件系统、权限隔离、持久化；
- 并发下的插件启停和失败恢复；
- 多版本服务、循环依赖和复杂依赖传播。

真实 Cordis 还有更完整的运行时机制，后续再单独看。第一篇先记住这句话就够了：

> **动态组件产生的副作用要能撤销；组件要声明依赖，并随着依赖出现和消失自动启停。**

看懂这个 Mini Demo，就已经理解了 Cordis 最值得迁移到 Java 架构里的核心思想。

## Sources

[1] https://arxiv.org/abs/2608.25512 — A Programming Paradigm for Spatiotemporal Composability
    > "We identify two orthogonal dimensions of the problem: temporal composability, the ability to completely revert a component’s side effects upon removal, and spatial composability, the ability to declare and reactively manage inter-component dependencies."
[2] https://github.com/cordiverse/cordis — Cordis official repository
    > "Cordis is under active development. The API is not yet stable and may change without notice."
[3] https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial — DeepSeek Harness Cordis tutorial
    > "生命周期与 effect ：由 Cordis 管理的注册会在所属插件卸载时撤销。 服务 ：在 ctx 上公开一项能力，并通过 inject 依赖它。"
