---
title: "Spring 都有 IoC 了，Cordis 还多了什么？"
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
summary: "以 Spring 容器和插件子 ApplicationContext 为底座，展示如何补上 Cordis 的动态依赖生命周期：payment 上线激活 VipPlugin，下线关闭子容器并触发 destroy，重新上线再次激活。"
tags:
  - Java
  - Spring
  - 架构设计
  - Cordis
  - 插件系统
  - 动态加载
---

# Spring 都有 IoC 了，Cordis 还多了什么？

> 这篇不再自己造一个完整运行时，而是回答 Java 开发者真正会问的问题：**Spring 已经有 IoC、Bean、依赖注入和生命周期了，Cordis 到底还多了什么？**
>
> Cordis 论文把动态组合概括为两个问题：组件被移除后，副作用能否撤销；依赖变化后，组件能否反应式地激活和去激活。[1] Spring 已经提供了容器、依赖注入、Bean 生命周期和程序化注册能力；官方文档把 `ApplicationContext` / `GenericApplicationContext` 作为容器和程序化注册的重要入口。[4][5]
>
> Spring 7 还提供了更正式的 `BeanRegistrar` / `BeanRegistry` API。[6]
>
> 所以本文只在 Spring 上补一层很薄的东西：**运行中的依赖变化管理器**。Demo 使用 Spring `6.2.19`，不是 Cordis 官方 Java 实现；Cordis 官方仓库本身也提示 API 仍在活跃开发、可能变化。[2]

## 1. 普通 Spring 已经解决了一半

普通 Spring 写一个依赖支付服务的插件，大概是这样：

```java
@Component
class VipPlugin {
    private final PaymentService paymentService;

    VipPlugin(PaymentService paymentService) {
        this.paymentService = paymentService;
    }
}
```

这段代码表达得很清楚：`VipPlugin` 依赖 `PaymentService`。Spring 负责创建对象、解析构造器依赖，并在容器销毁时调用 Bean 的销毁回调。[4]

但它默认假设：

```text
应用启动
  → Bean 创建
  → 依赖图建立
  → 应用持续运行
```

如果运行中发生：

```text
PaymentService 被移除
```

Spring 不会仅因为某个 Bean 的依赖对象消失，就自动替你完成：

```text
找到所有消费者
  → 按依赖顺序停止消费者
  → 移除服务
  → 服务回来后重新创建消费者
```

这不是 Spring 的容器能力“不够”，而是它默认面向 bootstrap/configuration；这里缺的是一层**动态依赖生命周期协调**。

## 2. 文章的核心切口：启动期依赖图 vs 运行期依赖图

先建立一组不严格、但对 Java 开发者很有用的映射：

| Spring | Cordis 直觉 |
|---|---|
| Bean | Component / Service |
| 构造器注入、`@Autowired` | `inject` / dependency |
| `ApplicationContext` / `BeanFactory` | `Context` / `Registry` |
| `InitializingBean` / `DisposableBean` | `start` / `dispose` |
| 子 `ApplicationContext.close()` | 动态插件卸载 |

这不是说 Spring 和 Cordis 完全等价，而是借用 Spring 已经熟悉的词汇，先把问题说清楚。

再看两种模型的差异：

| | 普通 Spring | 加上本文的薄层 |
|---|---|---|
| 依赖图什么时候建立 | 容器启动 / refresh 时 | 服务上线、下线时反复检查 |
| 插件依赖表达 | 构造器注入 | `PluginDefinition.requires` + Spring 构造器注入 |
| 插件启动 | Bean 创建时 | 依赖满足后打开插件子容器 |
| 插件停止 | 容器销毁时 | 依赖消失后关闭插件子容器 |
| 副作用清理 | Bean destroy 生命周期 | `DisposableBean.destroy()` / `AutoCloseable` |
| 动态服务 | 需要额外管理 | `GenericApplicationContext.registerBean` + 管理器 |

架构只有两层：

```text
Root ApplicationContext
├── Pipeline                 普通公共 Bean
└── PaymentService           动态注册的服务

Plugin ApplicationContext
└── VipPlugin                依赖 PaymentService 的动态 Bean
```

根容器负责公共 Bean；一个动态插件对应一个子容器。插件启动就是创建并 `refresh()` 子容器，插件停止就是 `close()` 子容器。

Spring 官方文档明确展示了 `GenericApplicationContext` 的程序化容器用法和 `refresh()` 流程。[5] 本文用的就是这个思路，只是把“什么时候创建/关闭子容器”交给自己的 `DynamicComponentManager`。

## 3. Effect 在 Spring 里就是“注册 + 销毁回调”

不用再造一套 effect runtime。在 Java / Spring 里，最直观的对应关系就是：

- `afterPropertiesSet()`：Bean 创建完成后，把步骤注册进 `Pipeline`；
- `destroy()`：把步骤注销；
- 子容器 `close()`：触发所有 Bean 的销毁生命周期。

`VipPlugin` 的关键逻辑是：它注册步骤时保存 `Runnable unregister`；销毁时执行它。于是：

```text
正向：pipeline.register(step)
逆向：unregister.run()
触发：pluginContext.close()
```

这就是 Cordis 的可撤销副作用，用 Spring 已经提供的生命周期机制表达出来。

## 4. 动态依赖只需要一个很薄的 Manager

`DynamicComponentManager` 只做三件事：

1. 保存插件定义和它需要的服务类型；
2. 服务满足时创建插件子容器；
3. 服务消失时先关闭依赖它的子容器，再从根容器移除服务。

Spring 仍然负责：

- 调用 `VipPlugin(PaymentService, Pipeline)` 构造器注入；
- 执行 `afterPropertiesSet()`；
- 子容器关闭时执行 `destroy()`；
- 管理 Bean 定义和实例。

下面是完整可运行 Demo，共 166 行，只有一个 Spring 依赖。为了让示例能直接编译，Maven 配置至少需要 Java 17、`spring-context` 和编译器插件：

```xml
<properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
</properties>
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-context</artifactId>
    <version>6.2.19</version>
</dependency>
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-compiler-plugin</artifactId>
    <version>3.13.0</version>
    <configuration>
        <release>17</release>
    </configuration>
</plugin>
```

```java
package demo;

import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.support.GenericApplicationContext;

import java.util.*;

public class SpringCordisDemo {
    record Order(String id) {}
    record PaymentService(String channel) {}

    interface OrderStep {
        void execute(Order order);
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

    static final class VipPlugin implements InitializingBean, DisposableBean {
        private final PaymentService payment;
        private final Pipeline pipeline;
        private Runnable unregister;

        VipPlugin(PaymentService payment, Pipeline pipeline) {
            this.payment = payment;
            this.pipeline = pipeline;
        }

        @Override
        public void afterPropertiesSet() {
            OrderStep step = order -> System.out.println(
                payment.channel() + " VIP 折扣: " + order.id());
            unregister = pipeline.register(step);
            System.out.println("VIP 插件启动，使用 " + payment.channel());
        }

        @Override
        public void destroy() {
            if (unregister != null) {
                unregister.run();
                unregister = null;
            }
            System.out.println("VIP 插件停止");
        }
    }

    record PluginDefinition(String name, Set<Class<?>> requires,
                            Class<?> beanType) {}

    static final class DynamicComponentManager implements AutoCloseable {
        private final GenericApplicationContext root = new GenericApplicationContext();
        private final Map<String, PluginDefinition> definitions = new LinkedHashMap<>();
        private final Map<String, ConfigurableApplicationContext> active = new LinkedHashMap<>();
        private final Map<Class<?>, String> serviceNames = new LinkedHashMap<>();

        DynamicComponentManager() {
            root.registerBean(Pipeline.class);
            root.refresh();
        }

        void addPlugin(PluginDefinition definition) {
            definitions.put(definition.name(), definition);
            refresh();
        }

        <T> void registerService(String beanName, Class<T> type, T value) {
            if (serviceNames.containsKey(type)) {
                unregisterService(type);
            }
            root.registerBean(beanName, type, () -> value);
            serviceNames.put(type, beanName);
            System.out.println("上线服务: " + beanName);
            refresh();
        }

        void unregisterService(Class<?> type) {
            String beanName = serviceNames.remove(type);
            if (beanName == null) return;
            definitions.values().stream()
                .filter(d -> d.requires().contains(type))
                .forEach(d -> deactivate(d.name()));
            DefaultListableBeanFactory factory = root.getDefaultListableBeanFactory();
            factory.destroySingleton(beanName);
            factory.removeBeanDefinition(beanName);
            System.out.println("下线服务: " + beanName);
            refresh();
        }

        private void refresh() {
            for (PluginDefinition definition : definitions.values()) {
                boolean ready = definition.requires().stream()
                    .allMatch(type -> !root.getBeansOfType(type).isEmpty());
                if (ready && !active.containsKey(definition.name())) {
                    activate(definition);
                } else if (!ready && active.containsKey(definition.name())) {
                    deactivate(definition.name());
                }
            }
        }

        private void activate(PluginDefinition definition) {
            AnnotationConfigApplicationContext child =
                new AnnotationConfigApplicationContext();
            child.setParent(root);
            child.registerBean(definition.beanType());
            child.refresh();
            active.put(definition.name(), child);
        }

        private void deactivate(String name) {
            ConfigurableApplicationContext child = active.remove(name);
            if (child != null) child.close();
        }

        void dump() {
            System.out.println("active=" + active.keySet()
                + ", steps=" + root.getBean(Pipeline.class).size());
        }

        void run(Order order) {
            root.getBean(Pipeline.class).run(order);
        }

        @Override
        public void close() {
            new ArrayList<>(active.keySet()).forEach(this::deactivate);
            root.close();
        }
    }

    public static void main(String[] args) {
        try (DynamicComponentManager manager = new DynamicComponentManager()) {
            manager.addPlugin(new PluginDefinition(
                "vip", Set.of(PaymentService.class), VipPlugin.class));
            manager.dump();

            manager.registerService("payment", PaymentService.class,
                new PaymentService("支付宝"));
            manager.dump();
            manager.run(new Order("SO-001"));

            manager.unregisterService(PaymentService.class);
            manager.dump();

            manager.registerService("payment", PaymentService.class,
                new PaymentService("微信支付"));
            manager.run(new Order("SO-002"));
        }
    }
}
```

### 代码只看 6 个位置

1. **根容器初始化**：`root.registerBean(Pipeline.class)` 后 `root.refresh()`。
2. **动态服务注册**：`root.registerBean(beanName, type, () -> value)`。
3. **依赖判断**：`requires().stream().allMatch(...)`。
4. **插件激活**：创建子 `AnnotationConfigApplicationContext`，设置 `root` 为 parent，注册 `VipPlugin` 后 `refresh()`。
5. **插件卸载**：`child.close()`，Spring 自动调用 `VipPlugin.destroy()`。
6. **卸载顺序**：先 `deactivate()` 依赖者，再 `destroySingleton()` / `removeBeanDefinition()` 移除服务。

最关键的不是 Manager 有多少代码，而是这个顺序：

```text
unregisterService(PaymentService.class)
  → close VipPlugin 子容器
  → VipPlugin.destroy()
  → unregister.run()
  → 移除 PaymentService Bean
```

如果反过来先删除 `PaymentService`，再关闭 `VipPlugin`，销毁回调执行时就可能读不到自己的依赖。

## 5. 运行过程

Demo 的主流程是：

```text
addPlugin(vip)
  → payment 不存在，VipPlugin 不创建

registerService(payment, 支付宝)
  → 依赖满足，创建子容器
  → Spring 注入 PaymentService
  → afterPropertiesSet 注册 VIP 步骤

unregisterService(payment)
  → 关闭子容器
  → destroy 注销 VIP 步骤
  → 移除 payment Bean

registerService(payment, 微信支付)
  → 再次创建子容器
  → VipPlugin 使用新的微信支付实例
```

实际运行时观察到的关键结果：

| 操作 | 结果 |
|---|---|
| 加载插件 | `active=[]`, `steps=0`，插件等待 payment |
| 上线支付宝 | `VIP 插件启动，使用 支付宝`，步骤数变为 1 |
| 执行订单 | 输出 `支付宝 VIP 折扣: SO-001` |
| 下线 payment | Spring 关闭子容器，输出 `VIP 插件停止`，步骤数回到 0 |
| 上线微信支付 | 插件重新启动，输出 `VIP 插件启动，使用 微信支付` |
| 执行订单 | 输出 `微信支付 VIP 折扣: SO-002` |

本地实际使用 JDK 17 和 Maven 编译运行通过：`mvn compile dependency:build-classpath`，随后执行 `demo.SpringCordisDemo`。

## 6. Spring 7 的 `BeanRegistrar` 放在哪里

Spring 7 的 `BeanRegistrar` / `BeanRegistry` 更适合把程序化 Bean 注册写成配置模块，例如按配置、环境或循环批量注册 Bean；官方文档把它定义为一等的程序化注册支持。[6]

但它不会自动替代本文的动态生命周期管理：

```text
BeanRegistrar / BeanRegistry
  解决：如何声明、批量、程序化注册 Bean

DynamicComponentManager
  解决：运行中谁现在应该激活、谁应该停止
```

因此生产代码可以把两者组合起来：启动期注册和配置使用 `BeanRegistrar`，运行期依赖变化仍由 Manager 协调插件子容器的创建和关闭。本文为了兼容 Spring 6.2，也直接使用 `GenericApplicationContext.registerBean`。

## 7. 这个方案和真正的 Cordis 还差什么

本文只实现了最容易理解、也最适合 Java 开发者迁移的两点：

- **动态依赖**：服务存在，插件子容器创建；服务消失，插件子容器关闭；
- **可逆生命周期**：步骤注册和注销绑定在 Spring Bean 的创建/销毁生命周期里。

它没有实现：

- Cordis 自己的完整运行时语义；
- JAR / `ClassLoader` 级别热替换；
- 复杂依赖图、循环依赖、多版本服务；
- 插件权限隔离、沙箱和跨线程资源治理。

子容器也不是魔法：它提供了很自然的插件边界，但根服务的移除顺序、插件之间的依赖关系和并发访问，仍然要由 Manager 负责。真实 Cordis 还有更完整的依赖传播和运行时机制，放到后续文章再展开。[1][3]

## 8. 最后只记住一句话

> **Spring 已经提供了 Bean、依赖注入和生命周期；Cordis 值得借鉴的，是把依赖图从“启动时确定”推进到“运行时可以变化”，并让动态注册的副作用能够随组件一起撤销。**

所以这篇不是“用 Java 重写 Cordis”，而是：

```text
Spring ApplicationContext
        +
DynamicComponentManager
        +
Plugin Child ApplicationContext
        =
一个 Java 程序员容易理解的 Cordis 思路 Demo
```

## Sources

[1] https://arxiv.org/abs/2608.25512 — A Programming Paradigm for Spatiotemporal Composability
    > "We identify two orthogonal dimensions of the problem: temporal composability, the ability to completely revert a component’s side effects upon removal, and spatial composability, the ability to declare and reactively manage inter-component dependencies."
[2] https://github.com/cordiverse/cordis — Cordis official repository
    > "Cordis is under active development. The API is not yet stable and may change without notice."
[3] https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial — DeepSeek Harness Cordis tutorial
    > "生命周期与 effect ：由 Cordis 管理的注册会在所属插件卸载时撤销。 服务 ：在 ctx 上公开一项能力，并通过 inject 依赖它。"
[4] https://docs.spring.io/spring-framework/reference/7.1/core/beans/beanfactory.html — The BeanFactory API
    > "programmatically registering bean definitions and annotated classes, and (as of 5.0) registering functional bean definitions."
    > "DisposableBean ) are important integration points for other framework components."
[5] https://docs.spring.io/spring-framework/reference/6.2/core/beans/basics.html — Container Overview
    > "The most flexible variant is  GenericApplicationContext  in combination with reader delegates"
    > "GenericApplicationContext context = new GenericApplicationContext();"
    > "The org.springframework.context.ApplicationContext interface represents the Spring IoC container and is responsible for instantiating, configuring, and assembling the beans."
[6] https://docs.spring.io/spring-framework/reference/7.1/core/beans/java/programmatic-bean-registration.html — Programmatic Bean Registration
    > "As of Spring Framework 7, a first-class support for programmatic bean registration is provided via the BeanRegistrar interface"
