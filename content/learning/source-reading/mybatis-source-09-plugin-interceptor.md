---
title: "MyBatis 源码深度拆解（九）：插件 Plugin 拦截器底层原理"
date: "2026-08-03"
domain: "学习"
area: "Java 后端"
module: "MyBatis 源码拆解"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "面试官：MyBatis 的插件是如何实现的？它能在哪些地方进行拦截？分页插件的工作原理是什么？ 一、开篇 MyBatis…"
tags:
  - "MyBatis"
  - "源码分析"
---

# MyBatis 源码深度拆解（九）：插件 Plugin 拦截器底层原理

> 来源：微信公众号（MyBatis 源码深度拆解系列）
> 链接：[http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484061&idx=1&sn=cc54c7165c0d484453f9669e763f466e&chksm=c2b810c2f5cf99d4c10cc9c81689e970e150248bfad0b2caa54614b30d003ba7b91dbc9d2425](http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484061&idx=1&sn=cc54c7165c0d484453f9669e763f466e&chksm=c2b810c2f5cf99d4c10cc9c81689e970e150248bfad0b2caa54614b30d003ba7b91dbc9d2425)
> 类型：📚 参考资料（非面试题/面经）—— MyBatis 源码深度拆解系列
> 相关：第247题(MyBatis 分页拦截器)、第196题(MyBatis 与 Spring 事务整合)、第235题(百万行导出)
> 整理时间：2026-08-03

---

面试官：MyBatis 的插件是如何实现的？它能在哪些地方进行拦截？分页插件的工作原理是什么？

一、开篇

MyBatis 的插件机制允许我们在

四大对象

的创建和方法调用过程中插入自定义逻辑，从而实现分页、性能监控、SQL 打印、数据权限控制等功能。

四大拦截点

：

Executor

：执行器，负责 SQL 执行和一级缓存

StatementHandler

：语句处理器，负责 JDBC Statement 的操作

ParameterHandler

：参数处理器，负责为 PreparedStatement 设置参数

ResultSetHandler

：结果集处理器，负责将 ResultSet 映射成 Java 对象

本篇目标

：

理解插件的加载与注册过程

剖析

Plugin

类的动态代理实现（JDK 动态代理）

学习责任链模式在拦截器链中的应用

以分页插件为例，分析自定义插件的实现原理

二、插件核心类

Interceptor

(拦截器接口)

：由开发者实现，是插件的

行为定义者

，包含 

intercept()

、

plugin()

 和 

setProperties()

 三个核心方法。

InterceptorChain

：拦截器链，持有所有插件的列表。

Plugin

(代理工具类)

：MyBatis 内置的工具类，是插件的

实现辅助者

。它

实现了 

InvocationHandler

 接口，其 

wrap()

 静态方法用于为目标对象创建 JDK 动态代理，并负责在 

invoke()

 中根据 

@Signature

 注解的判断结果，决定是否调用 

Interceptor.intercept()

 方法

Invocation

：封装了目标对象、方法、参数，传递给 

intercept

 方法。

三、插件的加载与注册

3.1 配置方式

在 

mybatis-config.xml

 中：


```
<plugins>
    <plugin interceptor="com.example.MyPlugin">
        <property name="property1" value="value1"/>
    </plugin>
    <plugin interceptor="com.example.PageInterceptor"/>
</plugins>
```


3.2 解析与注册：

XMLConfigBuilder.pluginsElement


```
private void pluginsElement(XNode context) throws Exception {
    if (context != null) {
      for (XNode child : context.getChildren()) {
        String interceptor = child.getStringAttribute("interceptor");
        Properties properties = child.getChildrenAsProperties();
        Interceptor interceptorInstance = (Interceptor) resolveClass(interceptor).getDeclaredConstructor()
            .newInstance();
        interceptorInstance.setProperties(properties);
        configuration.addInterceptor(interceptorInstance);
      }
    }
  }
```


3.3

Configuration

存储拦截器


```
public class Configuration {
    protected final InterceptorChain interceptorChain = new InterceptorChain();

    public void addInterceptor(Interceptor interceptor) {
        interceptorChain.addInterceptor(interceptor);
    }

    public List<Interceptor> getInterceptors() {
        return interceptorChain.getInterceptors();
    }
}
```


InterceptorChain

 内部就是一个 

List<Interceptor>

，按配置顺序存储。

四、拦截点的生成：InterceptorChain.pluginAll

当 MyBatis 创建这四大核心对象时，在

对象实例化完成后

，都会

显式调用

interceptorChain.pluginAll(target)

 方法，用于将配置的拦截器链应用到该对象上，最终返回的可能是一个层层包裹的代理对象。

4.1

Executor

创建时

Configuration.newExecutor

 方法中：


```
public Executor newExecutor(Transaction transaction, ExecutorType executorType) {
    // ... 创建 SimpleExecutor/ReuseExecutor/BatchExecutor
    if (cacheEnabled) {
        executor = new CachingExecutor(executor);
    }
    return (Executor) interceptorChain.pluginAll(executor);
}
```


4.2

StatementHandler

创建时

Configuration.newStatementHandler

 方法中：


```
public StatementHandler newStatementHandler(Executor executor, MappedStatement ms,
        Object parameter, RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) {
    StatementHandler statementHandler = new RoutingStatementHandler(executor, ms, parameter, rowBounds, resultHandler, boundSql);
    return (StatementHandler) interceptorChain.pluginAll(statementHandler);
}
```


4.3

ParameterHandler

创建时

Configuration.newParameterHandler

：


```
public ParameterHandler newParameterHandler(MappedStatement ms, Object parameter, BoundSql boundSql) {
    ParameterHandler parameterHandler = new DefaultParameterHandler(ms, parameter, boundSql);
    return (ParameterHandler) interceptorChain.pluginAll(parameterHandler);
}
```


4.4

ResultSetHandler

创建时

Configuration.newResultSetHandler

：


```
public ResultSetHandler newResultSetHandler(Executor executor, MappedStatement ms,
        RowBounds rowBounds, ParameterHandler parameterHandler, ResultHandler resultHandler, BoundSql boundSql) {
    ResultSetHandler resultSetHandler = new DefaultResultSetHandler(executor, ms, parameterHandler, resultHandler, boundSql, rowBounds);
    return (ResultSetHandler) interceptorChain.pluginAll(resultSetHandler);
}
```


InterceptorChain.pluginAll

实现

：


```
public Object pluginAll(Object target) {
    for (Interceptor interceptor : interceptors) {
        target = interceptor.plugin(target);
    }
    return target;
}
```


每个拦截器可以决定是否对目标对象生成代理（通过 

plugin

 方法）。通常我们使用 

Plugin.wrap

 工具方法。

五、

Plugin

类：JDK 动态代理的核心

Plugin

 类实现了 

InvocationHandler

，是 MyBatis 提供的便利代理工厂。


```
public class Plugin implements InvocationHandler {
    private final Object target;
    private final Interceptor interceptor;
    private final Map<Class<?>, Set<Method>> signatureMap;

    private Plugin(Object target, Interceptor interceptor, Map<Class<?>, Set<Method>> signatureMap) {
        this.target = target;
        this.interceptor = interceptor;
        this.signatureMap = signatureMap;
    }

    public static Object wrap(Object target, Interceptor interceptor) {
        // 从 @Intercepts 和 @Signature 注解中提取要拦截的接口和方法
        Map<Class<?>, Set<Method>> signatureMap = getSignatureMap(interceptor);
        Class<?> type = target.getClass();
        Class<?>[] interfaces = getAllInterfaces(type, signatureMap);
        if (interfaces.length > 0) {
            return Proxy.newProxyInstance(type.getClassLoader(), interfaces, new Plugin(target, interceptor, signatureMap));
        }
        return target;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        try {
            // 判断当前方法是否需要被拦截
            Set<Method> methods = signatureMap.get(method.getDeclaringClass());
            if (methods != null && methods.contains(method)) {
                // 需要拦截，调用拦截器的 intercept 方法
                return interceptor.intercept(new Invocation(target, method, args));
            }
            // 不需要拦截，直接调用目标对象的方法
            return method.invoke(target, args);
        } catch (Exception e) {
            throw ExceptionUtil.unwrapThrowable(e);
        }
    }
}
```


5.1 注解：

@Intercepts

和

@Signature

自定义插件需要指定拦截的目标和方法签名：


```
@Intercepts({
    @Signature(
        type = Executor.class,
        method = "query",
        args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class}
    )
})
public class MyPlugin implements Interceptor {
    // ...
}
```


type

：

四大接口之一

（Executor

,

StatementHandler

,

ParameterHandler

,

ResultSetHandler)。

method

：接口中的方法名。

args

 属性用于

精确匹配接口中的重载方法

。因为在 

Executor

 等接口中，可能存在方法名相同但参数列表不同的情况，通过指定 

args

 参数类型数组，MyBatis 才能准确定位到开发者想要拦截的具体方法。

Plugin.getSignatureMap

 会解析这些注解，构建一个 

Map<Class<?>, Set<Method>>

，用于 

invoke

 时判断是否拦截。

5.2 

Invocation

 类


```
public class Invocation {
    private final Object target;
    private final Method method;
    private final Object[] args;

    public Object proceed() throws InvocationTargetException, IllegalAccessException {
        return method.invoke(target, args);
    }
    // getters...
}
```


在自定义插件的

intercept

方法中，拿到

Invocation

对象后，可以：

执行前置逻辑

调用

invocation.proceed()

继续执行原方法

执行后置逻辑

甚至完全修改返回值

六、自定义插件示例：分页插件核心逻辑

以下代码来自开源的 PageHelper 分页插件，展示了真实插件如何处理分页逻辑，包括参数个数判断、异步 count、缓存 key 处理等细节。


```
@Intercepts(
    @Signature(type = Executor.class, method = "query",
        args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class}
    )
)
public class PageInterceptor implements Interceptor {
    private Dialect dialect;
    // ... 其他字段

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        try {
            Object[] args = invocation.getArgs();
            MappedStatement ms = (MappedStatement) args[0];
            Object parameter = args[1];
            RowBounds rowBounds = (RowBounds) args[2];
            ResultHandler resultHandler = (ResultHandler) args[3];
            Executor executor = (Executor) invocation.getTarget();
            CacheKey cacheKey;
            BoundSql boundSql;

            // 重要：query 方法有两种重载：4 参数和 6 参数（带 CacheKey 和 BoundSql）
            if (args.length == 4) {
                // 4 个参数时：动态创建 BoundSql 和 CacheKey
                boundSql = ms.getBoundSql(parameter);
                cacheKey = executor.createCacheKey(ms, parameter, rowBounds, boundSql);
            } else {
                // 6 个参数时：直接从参数中获取
                cacheKey = (CacheKey) args[4];
                boundSql = (BoundSql) args[5];
            }

            checkDialectExists();
            // 如果 dialect 实现了 BoundSqlInterceptor 链，则处理 boundSql
            if (dialect instanceof BoundSqlInterceptor.Chain) {
                boundSql = ((BoundSqlInterceptor.Chain) dialect).doBoundSql(
                    BoundSqlInterceptor.Type.ORIGINAL, boundSql, cacheKey);
            }
            List resultList;

            // 判断是否需要分页
            if (!dialect.skip(ms, parameter, rowBounds)) {
                // 调试堆栈日志（用于检查分页使用是否正确）
                debugStackTraceLog();
                Future<Long> countFuture = null;
                // 是否需要执行 count 查询
                if (dialect.beforeCount(ms, parameter, rowBounds)) {
                    if (dialect.isAsyncCount()) {
                        // 异步查询总数
                        countFuture = asyncCount(ms, boundSql, parameter, rowBounds);
                    } else {
                        // 同步查询总数
                        Long count = count(executor, ms, parameter, rowBounds, null, boundSql);
                        if (!dialect.afterCount(count, parameter, rowBounds)) {
                            // 总数为 0，直接返回空列表
                            return dialect.afterPage(new ArrayList(), parameter, rowBounds);
                        }
                    }
                }
                // 执行分页查询
                resultList = ExecutorUtil.pageQuery(dialect, executor,
                        ms, parameter, rowBounds, resultHandler, boundSql, cacheKey);
                if (countFuture != null) {
                    Long count = countFuture.get();
                    dialect.afterCount(count, parameter, rowBounds);
                }
            } else {
                // 不需要分页，直接执行原始查询（但仍使用已有的 boundSql 和 cacheKey）
                resultList = executor.query(ms, parameter, rowBounds, resultHandler, cacheKey, boundSql);
            }
            return dialect.afterPage(resultList, parameter, rowBounds);
        } finally {
            if (dialect != null) {
                dialect.afterAll();  // 清理 ThreadLocal 等资源
            }
        }
    }

    @Override
    public Object plugin(Object target) {
        // 只对 Executor 类型的对象进行代理
        if (target instanceof Executor) {
            return Plugin.wrap(target, this);
        }
        return target;
    }

    @Override
    public void setProperties(Properties properties) {
        // 初始化 dialect 等
    }
}
```


关键点解读

：

参数个数判断

：

Executor.query

有两个重载，4 参数版本（无

CacheKey

和

BoundSql

）和 6 参数版本。插件必须兼容两种调用方式。

CacheKey

和

BoundSql

的处理

：如果是从 4 参数进入，需要自己创建；如果是从 6 参数进入，直接使用已有对象。

异步 count

：某些场景下可异步获取总记录数，提高性能。

dialect

策略模式

：不同数据库分页方言实现不同，通过

dialect

接口解耦。

资源清理

：

finally

 块中调用 

dialect.afterAll()

，确保 

ThreadLocal

 被清理，避免内存泄漏或线程安全问题。

七、责任链模式：多个插件的执行顺序

拦截器按配置顺序添加到

InterceptorChain.interceptors

列表。

pluginAll

遍历列表，对目标对象依次调用

interceptor.plugin(target)

。

每个插件都可能返回一个代理对象，pluginAll方法会遍历拦截器列表，后配置的拦截器会包装先配置的拦截器生成的代理，形成

洋葱模型

。当方法被调用时，

从最外层代理（后配置的插件）开始向内执行

，内层插件执行完后，再逐层返回到最外层。。

当方法被调用时，

从最外层代理开始，层层向内

，如果插件都拦截同一个方法，执行顺序为：配置

最后

的插件先执行

intercept

，然后

invocation.proceed()

调用内一层代理。

示例

：两个插件 A（先配置）、B（后配置），都拦截 Executor.query。

包装后：

B 代理 包装 A 代理 包装 真实 Executor

。

调用顺序：

B.intercept

→

invocation.proceed()

→

A.intercept

→

invocation.proceed()

→ 真实 Executor.query。

返回时逆序。

八、面试高频题

Q1：MyBatis 插件能拦截哪些对象和方法？

A

：四大对象：

Executor

、

StatementHandler

、

ParameterHandler

、

ResultSetHandler

。具体拦截的方法通过

@Signature

注解指定，只要这些类中声明的方法都可以拦截。

Q2：MyBatis 插件使用什么技术实现？为什么能拦截接口方法？

A

：使用

JDK 动态代理

。四大对象都是

接口

（

Executor

、

StatementHandler

、

ParameterHandler

、

ResultSetHandler

），JDK 动态代理可以对这些接口生成代理对象，在

invoke

方法中判断是否执行拦截逻辑。

Q3：多个插件执行顺序是怎样的？

A

：按

mybatis-config.xml

中

<plugin>

配置的顺序，

后配置的插件包装先配置的插件

。执行时，最外层的插件（后配置）最先执行

intercept

，调用

proceed()

后进入内层插件，最后才到达真实对象。

Q4：自定义插件需要注意什么？

A

：

实现

Interceptor

接口，并使用

@Intercepts

和

@Signature

注解。

在

plugin

方法中通常使用

Plugin.wrap(target, this)

生成代理。

不要忘记调用

invocation.proceed()

放行原方法，否则可能导致业务中断。

注意线程安全问题（如分页插件使用

ThreadLocal

传递分页参数，用完后必须清理）。

Q5：

Plugin.wrap

方法中，如何判断一个接口方法是否需要拦截？

A

：通过解析

@Intercepts

注解生成

signatureMap

，

invoke

时根据当前

method

的 declaring class 和 method 本身是否在

signatureMap

中决定。

九、下篇预告

第 10 篇我们将深入

TypeHandler 类型转换体系

，包括：

JDBC 类型与 Java 类型的映射关系

内置类型处理器全集

自定义 TypeHandler 的开发与注册

参数赋值和结果集封装底层调用时机

如果觉得有帮助，欢迎

点赞、在看、转发

支持！

系列持续更新，关注不走丢 

👇

          

            var first_sceen__time = (+new Date());
            if ("" == 1 && document.getElementById('js_content')) {
              document.getElementById('js_content').addEventListener("selectstart",function(e){ e.preventDefault(); });
            }
          

        

                

       
       
        if ("0" == 1) {
          document.addEventListener("keydown",function(e){
            if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X' || e.key === 'a' || e.key === 'A')) {
              if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') { return; }
              e.preventDefault();
            }
          });
          document.addEventListener("copy",function(e){
            var sel = window.getSelection();
            var content = document.getElementById('js_content');
            if (sel && sel.rangeCount > 0 && content && content.contains(sel.getRangeAt(0).commonAncestorContainer)) {
              e.preventDefault();
            }
          });
        }
