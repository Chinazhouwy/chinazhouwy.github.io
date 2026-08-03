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
<code><span leaf=""><span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">plugins</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">    <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">plugin</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">interceptor</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"com.example.MyPlugin"</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">        <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">property</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">name</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"property1"</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">value</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"value1"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf="">    <span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">plugin</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">    <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">plugin</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">interceptor</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"com.example.PageInterceptor"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf=""><span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">plugins</span></span><span class="code-snippet__tag">></span></span></code>
```


3.2 解析与注册：

XMLConfigBuilder.pluginsElement


```
<code><span leaf=""><span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">void</span> <span class="code-snippet__title">pluginsElement</span><span class="code-snippet__params">(XNode context)</span> <span class="code-snippet__keyword">throws</span> Exception {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (context != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">      <span class="code-snippet__keyword">for</span> (XNode child : context.getChildren()) {</span></code><code><span leaf="">        <span class="code-snippet__type">String</span> <span class="code-snippet__variable">interceptor</span> <span class="code-snippet__operator">=</span> child.getStringAttribute(<span class="code-snippet__string">"interceptor"</span>);</span></code><code><span leaf="">        <span class="code-snippet__type">Properties</span> <span class="code-snippet__variable">properties</span> <span class="code-snippet__operator">=</span> child.getChildrenAsProperties();</span></code><code><span leaf="">        <span class="code-snippet__type">Interceptor</span> <span class="code-snippet__variable">interceptorInstance</span> <span class="code-snippet__operator">=</span> (Interceptor) resolveClass(interceptor).getDeclaredConstructor()</span></code><code><span leaf="">            .newInstance();</span></code><code><span leaf="">        interceptorInstance.setProperties(properties);</span></code><code><span leaf="">        configuration.addInterceptor(interceptorInstance);</span></code><code><span leaf="">      }</span></code><code><span leaf="">    }</span></code><code><span leaf="">  }</span></code>
```


3.3

Configuration

存储拦截器


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">Configuration</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> final <span class="code-snippet__title">InterceptorChain</span> interceptorChain = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">InterceptorChain</span>();</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">addInterceptor</span>(<span class="code-snippet__params"><span class="code-snippet__title">Interceptor</span></span><span class="code-snippet__params"> interceptor</span>) {</span></code><code><span leaf="">        interceptorChain.<span class="code-snippet__title">addInterceptor</span>(interceptor);</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">List</span><<span class="code-snippet__title">Interceptor</span>> <span class="code-snippet__title">getInterceptors</span>() {</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> interceptorChain.<span class="code-snippet__title">getInterceptors</span>();</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
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
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">Executor</span> <span class="code-snippet__title">newExecutor</span>(<span class="code-snippet__params"><span class="code-snippet__title">Transaction</span></span><span class="code-snippet__params"> transaction, </span><span class="code-snippet__params"><span class="code-snippet__title">ExecutorType</span></span><span class="code-snippet__params"> executorType</span>) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// ... 创建 SimpleExecutor/ReuseExecutor/BatchExecutor</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (cacheEnabled) {</span></code><code><span leaf="">        executor = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">CachingExecutor</span>(executor);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> (<span class="code-snippet__title">Executor</span>) interceptorChain.<span class="code-snippet__title">pluginAll</span>(executor);</span></code><code><span leaf="">}</span></code>
```


4.2

StatementHandler

创建时

Configuration.newStatementHandler

 方法中：


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">StatementHandler</span> <span class="code-snippet__title">newStatementHandler</span>(<span class="code-snippet__params"><span class="code-snippet__title">Executor</span></span><span class="code-snippet__params"> executor, </span><span class="code-snippet__params"><span class="code-snippet__title">MappedStatement</span></span><span class="code-snippet__params"> ms, </span></span></code><code><span leaf="">        <span class="code-snippet__title">Object</span> parameter, <span class="code-snippet__title">RowBounds</span> rowBounds, <span class="code-snippet__title">ResultHandler</span> resultHandler, <span class="code-snippet__title">BoundSql</span> boundSql) {</span></code><code><span leaf="">    <span class="code-snippet__title">StatementHandler</span> statementHandler = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">RoutingStatementHandler</span>(executor, ms, parameter, rowBounds, resultHandler, boundSql);</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> (<span class="code-snippet__title">StatementHandler</span>) interceptorChain.<span class="code-snippet__title">pluginAll</span>(statementHandler);</span></code><code><span leaf="">}</span></code>
```


4.3

ParameterHandler

创建时

Configuration.newParameterHandler

：


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">ParameterHandler</span> <span class="code-snippet__title">newParameterHandler</span>(<span class="code-snippet__params"><span class="code-snippet__title">MappedStatement</span></span><span class="code-snippet__params"> ms, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameter, </span><span class="code-snippet__params"><span class="code-snippet__title">BoundSql</span></span><span class="code-snippet__params"> boundSql</span>) {</span></code><code><span leaf="">    <span class="code-snippet__title">ParameterHandler</span> parameterHandler = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">DefaultParameterHandler</span>(ms, parameter, boundSql);</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> (<span class="code-snippet__title">ParameterHandler</span>) interceptorChain.<span class="code-snippet__title">pluginAll</span>(parameterHandler);</span></code><code><span leaf="">}</span></code>
```


4.4

ResultSetHandler

创建时

Configuration.newResultSetHandler

：


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">ResultSetHandler</span> <span class="code-snippet__title">newResultSetHandler</span>(<span class="code-snippet__params"><span class="code-snippet__title">Executor</span></span><span class="code-snippet__params"> executor, </span><span class="code-snippet__params"><span class="code-snippet__title">MappedStatement</span></span><span class="code-snippet__params"> ms, </span></span></code><code><span leaf="">        <span class="code-snippet__title">RowBounds</span> rowBounds, <span class="code-snippet__title">ParameterHandler</span> parameterHandler, <span class="code-snippet__title">ResultHandler</span> resultHandler, <span class="code-snippet__title">BoundSql</span> boundSql) {</span></code><code><span leaf="">    <span class="code-snippet__title">ResultSetHandler</span> resultSetHandler = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">DefaultResultSetHandler</span>(executor, ms, parameterHandler, resultHandler, boundSql, rowBounds);</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> (<span class="code-snippet__title">ResultSetHandler</span>) interceptorChain.<span class="code-snippet__title">pluginAll</span>(resultSetHandler);</span></code><code><span leaf="">}</span></code>
```


InterceptorChain.pluginAll

实现

：


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">Object</span> <span class="code-snippet__title">pluginAll</span>(<span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> target</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">for</span> (<span class="code-snippet__title">Interceptor</span> interceptor : interceptors) {</span></code><code><span leaf="">        target = interceptor.<span class="code-snippet__title">plugin</span>(target);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> target;</span></code><code><span leaf="">}</span></code>
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
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">Plugin</span> <span class="code-snippet__keyword">implements</span> <span class="code-snippet__title">InvocationHandler</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> final <span class="code-snippet__title">Object</span> target;</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> final <span class="code-snippet__title">Interceptor</span> interceptor;</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> final <span class="code-snippet__title">Map</span><<span class="code-snippet__title">Class</span><?>, <span class="code-snippet__title">Set</span><<span class="code-snippet__title">Method</span>>> signatureMap;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__title">Plugin</span>(<span class="code-snippet__title">Object</span> target, <span class="code-snippet__title">Interceptor</span> interceptor, <span class="code-snippet__title">Map</span><<span class="code-snippet__title">Class</span><?>, <span class="code-snippet__title">Set</span><<span class="code-snippet__title">Method</span>>> signatureMap) {</span></code><code><span leaf="">        <span class="code-snippet__variable">this</span>.<span class="code-snippet__property">target</span> = target;</span></code><code><span leaf="">        <span class="code-snippet__variable">this</span>.<span class="code-snippet__property">interceptor</span> = interceptor;</span></code><code><span leaf="">        <span class="code-snippet__variable">this</span>.<span class="code-snippet__property">signatureMap</span> = signatureMap;</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">static</span> <span class="code-snippet__title">Object</span> <span class="code-snippet__title">wrap</span>(<span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> target, </span><span class="code-snippet__params"><span class="code-snippet__title">Interceptor</span></span><span class="code-snippet__params"> interceptor</span>) {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 从 @Intercepts 和 @Signature 注解中提取要拦截的接口和方法</span></span></code><code><span leaf="">        <span class="code-snippet__title">Map</span><<span class="code-snippet__title">Class</span><?>, <span class="code-snippet__title">Set</span><<span class="code-snippet__title">Method</span>>> signatureMap = <span class="code-snippet__title">getSignatureMap</span>(interceptor);</span></code><code><span leaf="">        <span class="code-snippet__title">Class</span><?> <span class="code-snippet__keyword">type</span> = target.<span class="code-snippet__title">getClass</span>();</span></code><code><span leaf="">        <span class="code-snippet__title">Class</span><?>[] interfaces = <span class="code-snippet__title">getAllInterfaces</span>(<span class="code-snippet__keyword">type</span>, signatureMap);</span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (interfaces.<span class="code-snippet__property">length</span> > <span class="code-snippet__number">0</span>) {</span></code><code><span leaf="">            <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">Proxy</span>.<span class="code-snippet__title">newProxyInstance</span>(<span class="code-snippet__keyword">type</span>.<span class="code-snippet__title">getClassLoader</span>(), interfaces, <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">Plugin</span>(target, interceptor, signatureMap));</span></code><code><span leaf="">        }</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> target;</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">Object</span> <span class="code-snippet__title">invoke</span>(<span class="code-snippet__title">Object</span> proxy, <span class="code-snippet__title">Method</span> method, <span class="code-snippet__title">Object</span>[] args) throws <span class="code-snippet__title">Throwable</span> {</span></code><code><span leaf="">        <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 判断当前方法是否需要被拦截</span></span></code><code><span leaf="">            <span class="code-snippet__title">Set</span><<span class="code-snippet__title">Method</span>> methods = signatureMap.<span class="code-snippet__title">get</span>(method.<span class="code-snippet__title">getDeclaringClass</span>());</span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (methods != <span class="code-snippet__literal">null</span> && methods.<span class="code-snippet__title">contains</span>(method)) {</span></code><code><span leaf="">                <span class="code-snippet__comment">// 需要拦截，调用拦截器的 intercept 方法</span></span></code><code><span leaf="">                <span class="code-snippet__keyword">return</span> interceptor.<span class="code-snippet__title">intercept</span>(<span class="code-snippet__keyword">new</span> <span class="code-snippet__title">Invocation</span>(target, method, args));</span></code><code><span leaf="">            }</span></code><code><span leaf="">            <span class="code-snippet__comment">// 不需要拦截，直接调用目标对象的方法</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">return</span> method.<span class="code-snippet__title">invoke</span>(target, args);</span></code><code><span leaf="">        } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">Exception</span> e) {</span></code><code><span leaf="">            <span class="code-snippet__keyword">throw</span> <span class="code-snippet__title">ExceptionUtil</span>.<span class="code-snippet__title">unwrapThrowable</span>(e);</span></code><code><span leaf="">        }</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


5.1 注解：

@Intercepts

和

@Signature

自定义插件需要指定拦截的目标和方法签名：


```
<code><span leaf=""><span class="code-snippet__variable">@Intercepts</span>({</span></code><code><span leaf="">    <span class="code-snippet__variable">@Signature</span>(</span></code><code><span leaf="">        type = Executor.class,</span></code><code><span leaf="">        <span class="code-snippet__function"><span class="code-snippet__keyword">method</span></span><span class="code-snippet__function"> = "</span><span class="code-snippet__function"><span class="code-snippet__title">query</span></span><span class="code-snippet__function">",</span></span></code><code><span leaf="">        <span class="code-snippet__title">args</span> = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class}</span></code><code><span leaf="">    )</span></code><code><span leaf="">})</span></code><code><span leaf="">public <span class="code-snippet__class"><span class="code-snippet__keyword">class</span></span><span class="code-snippet__class"> </span><span class="code-snippet__class"><span class="code-snippet__title">MyPlugin</span></span><span class="code-snippet__class"> </span><span class="code-snippet__class"><span class="code-snippet__title">implements</span></span><span class="code-snippet__class"> </span><span class="code-snippet__class"><span class="code-snippet__title">Interceptor</span></span><span class="code-snippet__class"> </span>{</span></code><code><span leaf="">    // ...</span></code><code><span leaf="">}</span></code>
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
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">Invocation</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">final</span> Object target;</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">final</span> Method method;</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">final</span> Object[] args;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__function"><span class="code-snippet__keyword">public</span></span><span class="code-snippet__function"> Object </span><span class="code-snippet__function"><span class="code-snippet__title">proceed</span></span><span class="code-snippet__function"><span class="code-snippet__params">()</span></span><span class="code-snippet__function"> throws InvocationTargetException, IllegalAccessException </span>{</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> method.<span class="code-snippet__built_in">invoke</span>(target, args);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__comment">// getters...</span></span></code><code><span leaf="">}</span></code>
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
<code><span leaf=""><span class="code-snippet__meta">@Intercepts</span>(</span></code><code><span leaf="">    <span class="code-snippet__meta">@Signature</span>(<span class="code-snippet__keyword">type</span> = <span class="code-snippet__title">Executor</span>.<span class="code-snippet__property">class</span>, method = <span class="code-snippet__string">"query"</span>,</span></code><code><span leaf="">        args = {<span class="code-snippet__title">MappedStatement</span>.<span class="code-snippet__property">class</span>, <span class="code-snippet__title">Object</span>.<span class="code-snippet__property">class</span>, <span class="code-snippet__title">RowBounds</span>.<span class="code-snippet__property">class</span>, <span class="code-snippet__title">ResultHandler</span>.<span class="code-snippet__property">class</span>}</span></code><code><span leaf="">    )</span></code><code><span leaf="">)</span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">PageInterceptor</span> <span class="code-snippet__keyword">implements</span> <span class="code-snippet__title">Interceptor</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__title">Dialect</span> dialect;</span></code><code><span leaf="">    <span class="code-snippet__comment">// ... 其他字段</span></span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">Object</span> <span class="code-snippet__title">intercept</span>(<span class="code-snippet__title">Invocation</span> invocation) throws <span class="code-snippet__title">Throwable</span> {</span></code><code><span leaf="">        <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">            <span class="code-snippet__title">Object</span>[] args = invocation.<span class="code-snippet__title">getArgs</span>();</span></code><code><span leaf="">            <span class="code-snippet__title">MappedStatement</span> ms = (<span class="code-snippet__title">MappedStatement</span>) args[<span class="code-snippet__number">0</span>];</span></code><code><span leaf="">            <span class="code-snippet__title">Object</span> parameter = args[<span class="code-snippet__number">1</span>];</span></code><code><span leaf="">            <span class="code-snippet__title">RowBounds</span> rowBounds = (<span class="code-snippet__title">RowBounds</span>) args[<span class="code-snippet__number">2</span>];</span></code><code><span leaf="">            <span class="code-snippet__title">ResultHandler</span> resultHandler = (<span class="code-snippet__title">ResultHandler</span>) args[<span class="code-snippet__number">3</span>];</span></code><code><span leaf="">            <span class="code-snippet__title">Executor</span> executor = (<span class="code-snippet__title">Executor</span>) invocation.<span class="code-snippet__title">getTarget</span>();</span></code><code><span leaf="">            <span class="code-snippet__title">CacheKey</span> cacheKey;</span></code><code><span leaf="">            <span class="code-snippet__title">BoundSql</span> boundSql;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">            <span class="code-snippet__comment">// 重要：query 方法有两种重载：4 参数和 6 参数（带 CacheKey 和 BoundSql）</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (args.<span class="code-snippet__property">length</span> == <span class="code-snippet__number">4</span>) {</span></code><code><span leaf="">                <span class="code-snippet__comment">// 4 个参数时：动态创建 BoundSql 和 CacheKey</span></span></code><code><span leaf="">                boundSql = ms.<span class="code-snippet__title">getBoundSql</span>(parameter);</span></code><code><span leaf="">                cacheKey = executor.<span class="code-snippet__title">createCacheKey</span>(ms, parameter, rowBounds, boundSql);</span></code><code><span leaf="">            } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">                <span class="code-snippet__comment">// 6 个参数时：直接从参数中获取</span></span></code><code><span leaf="">                cacheKey = (<span class="code-snippet__title">CacheKey</span>) args[<span class="code-snippet__number">4</span>];</span></code><code><span leaf="">                boundSql = (<span class="code-snippet__title">BoundSql</span>) args[<span class="code-snippet__number">5</span>];</span></code><code><span leaf="">            }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">            <span class="code-snippet__title">checkDialectExists</span>();</span></code><code><span leaf="">            <span class="code-snippet__comment">// 如果 dialect 实现了 BoundSqlInterceptor 链，则处理 boundSql</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (dialect <span class="code-snippet__keyword">instanceof</span> <span class="code-snippet__title">BoundSqlInterceptor</span>.<span class="code-snippet__property">Chain</span>) {</span></code><code><span leaf="">                boundSql = ((<span class="code-snippet__title">BoundSqlInterceptor</span>.<span class="code-snippet__property">Chain</span>) dialect).<span class="code-snippet__title">doBoundSql</span>(</span></code><code><span leaf="">                    <span class="code-snippet__title">BoundSqlInterceptor</span>.<span class="code-snippet__property">Type</span>.<span class="code-snippet__property">ORIGINAL</span>, boundSql, cacheKey);</span></code><code><span leaf="">            }</span></code><code><span leaf="">            <span class="code-snippet__title">List</span> resultList;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">            <span class="code-snippet__comment">// 判断是否需要分页</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (!dialect.<span class="code-snippet__title">skip</span>(ms, parameter, rowBounds)) {</span></code><code><span leaf="">                <span class="code-snippet__comment">// 调试堆栈日志（用于检查分页使用是否正确）</span></span></code><code><span leaf="">                <span class="code-snippet__title">debugStackTraceLog</span>();</span></code><code><span leaf="">                <span class="code-snippet__title">Future</span><<span class="code-snippet__title">Long</span>> countFuture = <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">                <span class="code-snippet__comment">// 是否需要执行 count 查询</span></span></code><code><span leaf="">                <span class="code-snippet__keyword">if</span> (dialect.<span class="code-snippet__title">beforeCount</span>(ms, parameter, rowBounds)) {</span></code><code><span leaf="">                    <span class="code-snippet__keyword">if</span> (dialect.<span class="code-snippet__title">isAsyncCount</span>()) {</span></code><code><span leaf="">                        <span class="code-snippet__comment">// 异步查询总数</span></span></code><code><span leaf="">                        countFuture = <span class="code-snippet__title">asyncCount</span>(ms, boundSql, parameter, rowBounds);</span></code><code><span leaf="">                    } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">                        <span class="code-snippet__comment">// 同步查询总数</span></span></code><code><span leaf="">                        <span class="code-snippet__title">Long</span> count = <span class="code-snippet__title">count</span>(executor, ms, parameter, rowBounds, <span class="code-snippet__literal">null</span>, boundSql);</span></code><code><span leaf="">                        <span class="code-snippet__keyword">if</span> (!dialect.<span class="code-snippet__title">afterCount</span>(count, parameter, rowBounds)) {</span></code><code><span leaf="">                            <span class="code-snippet__comment">// 总数为 0，直接返回空列表</span></span></code><code><span leaf="">                            <span class="code-snippet__keyword">return</span> dialect.<span class="code-snippet__title">afterPage</span>(<span class="code-snippet__keyword">new</span> <span class="code-snippet__title">ArrayList</span>(), parameter, rowBounds);</span></code><code><span leaf="">                        }</span></code><code><span leaf="">                    }</span></code><code><span leaf="">                }</span></code><code><span leaf="">                <span class="code-snippet__comment">// 执行分页查询</span></span></code><code><span leaf="">                resultList = <span class="code-snippet__title">ExecutorUtil</span>.<span class="code-snippet__title">pageQuery</span>(dialect, executor,</span></code><code><span leaf="">                        ms, parameter, rowBounds, resultHandler, boundSql, cacheKey);</span></code><code><span leaf="">                <span class="code-snippet__keyword">if</span> (countFuture != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">                    <span class="code-snippet__title">Long</span> count = countFuture.<span class="code-snippet__title">get</span>();</span></code><code><span leaf="">                    dialect.<span class="code-snippet__title">afterCount</span>(count, parameter, rowBounds);</span></code><code><span leaf="">                }</span></code><code><span leaf="">            } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">                <span class="code-snippet__comment">// 不需要分页，直接执行原始查询（但仍使用已有的 boundSql 和 cacheKey）</span></span></code><code><span leaf="">                resultList = executor.<span class="code-snippet__title">query</span>(ms, parameter, rowBounds, resultHandler, cacheKey, boundSql);</span></code><code><span leaf="">            }</span></code><code><span leaf="">            <span class="code-snippet__keyword">return</span> dialect.<span class="code-snippet__title">afterPage</span>(resultList, parameter, rowBounds);</span></code><code><span leaf="">        } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (dialect != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">                dialect.<span class="code-snippet__title">afterAll</span>();  <span class="code-snippet__comment">// 清理 ThreadLocal 等资源</span></span></code><code><span leaf="">            }</span></code><code><span leaf="">        }</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">Object</span> <span class="code-snippet__title">plugin</span>(<span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> target</span>) {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 只对 Executor 类型的对象进行代理</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (target <span class="code-snippet__keyword">instanceof</span> <span class="code-snippet__title">Executor</span>) {</span></code><code><span leaf="">            <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">Plugin</span>.<span class="code-snippet__title">wrap</span>(target, <span class="code-snippet__variable">this</span>);</span></code><code><span leaf="">        }</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> target;</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">setProperties</span>(<span class="code-snippet__params"><span class="code-snippet__title">Properties</span></span><span class="code-snippet__params"> properties</span>) {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 初始化 dialect 等</span></span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
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
