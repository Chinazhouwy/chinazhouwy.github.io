---
title: "MyBatis 源码深度拆解（三）：Mapper 接口动态代理底层原理"
date: "2026-06-14"
domain: "学习"
area: "Java 后端"
module: "MyBatis 源码拆解"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "写在最前面 版本说明 本文主要基于  MyBatis 3.5.10  和  mybatis-spring 3.0.3  …"
tags:
  - "MyBatis"
  - "源码分析"
---

# MyBatis 源码深度拆解（三）：Mapper 接口动态代理底层原理

> 来源：微信公众号（MyBatis 源码深度拆解系列）
> 链接：[http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484015&idx=1&sn=36d33b759a3b1515a22aaac91862d1a4&chksm=c2b81030f5cf9926a3848cc3a03aebd6f9c020ca1169754095bab662bddbbbd8658735c83c6f](http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484015&idx=1&sn=36d33b759a3b1515a22aaac91862d1a4&chksm=c2b81030f5cf9926a3848cc3a03aebd6f9c020ca1169754095bab662bddbbbd8658735c83c6f)
> 类型：📚 参考资料（非面试题/面经）—— MyBatis 源码深度拆解系列
> 相关：第247题(MyBatis 分页拦截器)、第196题(MyBatis 与 Spring 事务整合)
> 整理时间：2026-08-03

---

写在最前面 版本说明

本文主要基于 

MyBatis 3.5.10

 和 

mybatis-spring 3.0.3

 源码进行分析。不同小版本可能在缓存实现、default 方法处理等方面存在差异，建议读者以自己实际使用的版本源码为准。

一、从一道面试题说起

很多初学者都会问：

我明明只定义了一个

UserMapper

接口，并没有写实现类，为什么 MyBatis 能帮我执行 SQL？

答案：

JDK 动态代理

。MyBatis 在运行时为你的接口生成了一个代理对象，所有的方法调用都会被这个代理对象拦截，然后转发给

SqlSession

去执行。

今天我们就从源码角度，把代理对象的

创建过程

和

调用过程

完整拆解一遍。

二、代理对象的创建时机

2.1 入口：

session.getMapper(UserMapper.class)

我们通常这样获取 Mapper：


```
<code><span leaf="">UserMapper mapper = session.getMapper(UserMapper.<span class="code-snippet__keyword">class</span>);</span></code>
```


这个 

session

 实际是 

DefaultSqlSession

，我们跟进去：


```
<code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <T> T <span class="code-snippet__title">getMapper</span>(<span class="code-snippet__params"><span class="code-snippet__title">Class</span></span><span class="code-snippet__params"><T> </span><span class="code-snippet__params"><span class="code-snippet__keyword">type</span></span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> configuration.<span class="code-snippet__title">getMapper</span>(<span class="code-snippet__keyword">type</span>, <span class="code-snippet__variable">this</span>);</span></code><code><span leaf="">}</span></code>
```


继续：


```
<code><span leaf=""><span class="code-snippet__comment">// Configuration</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <T> T <span class="code-snippet__title">getMapper</span>(<span class="code-snippet__params"><span class="code-snippet__title">Class</span></span><span class="code-snippet__params"><T> </span><span class="code-snippet__params"><span class="code-snippet__keyword">type</span></span><span class="code-snippet__params">, </span><span class="code-snippet__params"><span class="code-snippet__title">SqlSession</span></span><span class="code-snippet__params"> sqlSession</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> mapperRegistry.<span class="code-snippet__title">getMapper</span>(<span class="code-snippet__keyword">type</span>, sqlSession);</span></code><code><span leaf="">}</span></code>
```


mapperRegistry

是

MapperRegistry

类型，它是

Configuration

中专门管理 Mapper 接口与代理工厂的注册表。

2.2 

MapperRegistry.getMapper()


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <T> T <span class="code-snippet__title">getMapper</span>(<span class="code-snippet__params"><span class="code-snippet__title">Class</span></span><span class="code-snippet__params"><T> </span><span class="code-snippet__params"><span class="code-snippet__keyword">type</span></span><span class="code-snippet__params">, </span><span class="code-snippet__params"><span class="code-snippet__title">SqlSession</span></span><span class="code-snippet__params"> sqlSession</span>) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 从 knownMappers 中获取该接口对应的 MapperProxyFactory</span></span></code><code><span leaf="">    final <span class="code-snippet__title">MapperProxyFactory</span><T> mapperProxyFactory = (<span class="code-snippet__title">MapperProxyFactory</span><T>) knownMappers.<span class="code-snippet__title">get</span>(<span class="code-snippet__keyword">type</span>);</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (mapperProxyFactory == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">BindingException</span>(<span class="code-snippet__string">"Type "</span> + <span class="code-snippet__keyword">type</span> + <span class="code-snippet__string">" is not known to the MapperRegistry."</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 通过工厂创建代理实例</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> mapperProxyFactory.<span class="code-snippet__title">newInstance</span>(sqlSession);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">Exception</span> e) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">BindingException</span>(<span class="code-snippet__string">"Error getting mapper instance. Cause: "</span> + e, e);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


关键点

：

knownMappers

是一个

Map<Class<?>, MapperProxyFactory<?>>

，在解析配置文件或包扫描时就已经填充好了。

每个 Mapper 接口对应一个

MapperProxyFactory

，专门用来生成该接口的代理对象。

2.3 

MapperProxyFactory.newInstance()


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> T <span class="code-snippet__title">newInstance</span>(<span class="code-snippet__params"><span class="code-snippet__title">SqlSession</span></span><span class="code-snippet__params"> sqlSession</span>) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 创建 MapperProxy，它实现了 InvocationHandler</span></span></code><code><span leaf="">    final <span class="code-snippet__title">MapperProxy</span><T> mapperProxy = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">MapperProxy</span><>(sqlSession, mapperInterface, methodCache);</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">newInstance</span>(mapperProxy);</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__keyword">protected</span> T <span class="code-snippet__title">newInstance</span>(<span class="code-snippet__params"><span class="code-snippet__title">MapperProxy</span></span><span class="code-snippet__params"><T> mapperProxy</span>) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 使用 JDK 动态代理生成代理对象</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> (T) <span class="code-snippet__title">Proxy</span>.<span class="code-snippet__title">newProxyInstance</span>(mapperInterface.<span class="code-snippet__title">getClassLoader</span>(), </span></code><code><span leaf="">                                      <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">Class</span>[] { mapperInterface }, </span></code><code><span leaf="">                                      mapperProxy);</span></code><code><span leaf="">}</span></code>
```


到这里，代理对象就诞生了。

核心三要素

：

类加载器

：

mapperInterface.getClassLoader()

要代理的接口数组

：

new Class[] { mapperInterface }

InvocationHandler

：

mapperProxy

，当代理对象的方法被调用时，会进入它的 

invoke

 方法。

三、代理对象的方法调用链路

当调用

userMapper.selectById(1)

时，实际上进入的是

MapperProxy.invoke()

。

3.1 

MapperProxy.invoke()


```
<code><span leaf=""><span class="code-snippet__variable">@Override</span></span></code><code><span leaf="">public Object invoke(Object proxy, Method <span class="code-snippet__function"><span class="code-snippet__keyword">method</span></span><span class="code-snippet__function">, </span><span class="code-snippet__function"><span class="code-snippet__title">Object</span></span><span class="code-snippet__function">[] </span><span class="code-snippet__function"><span class="code-snippet__title">args</span></span><span class="code-snippet__function">) </span><span class="code-snippet__function"><span class="code-snippet__title">throws</span></span><span class="code-snippet__function"> </span><span class="code-snippet__function"><span class="code-snippet__title">Throwable</span></span><span class="code-snippet__function"> </span>{</span></code><code><span leaf="">    try {</span></code><code><span leaf="">        <span class="code-snippet__regexp">//</span> 如果是 Object 类的方法（如 toString、hashCode），直接调用，不拦截</span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (Object.class.equals(method.getDeclaringClass())) {</span></code><code><span leaf="">            <span class="code-snippet__keyword">return</span> method.invoke(this, args);</span></code><code><span leaf="">        }</span></code><code><span leaf="">        // 缓存或新建 MapperMethod，然后执行</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> cachedInvoker(<span class="code-snippet__function"><span class="code-snippet__keyword">method</span></span><span class="code-snippet__function">).</span><span class="code-snippet__function"><span class="code-snippet__title">invoke</span></span>(proxy, <span class="code-snippet__keyword">method</span>, args, sqlSession);</span></code><code><span leaf="">    } catch (Throwable t) {</span></code><code><span leaf="">        throw ExceptionUtil.unwrapThrowable(t);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


这里出现了 

MapperMethod

，它是真正干活的类。

3.2

cachedInvoker(method)

与

MapperMethod

cachedInvoker

会从

methodCache

（一个

ConcurrentHashMap<Method, MapperMethodInvoker>

）中获取或创建

MapperMethodInvoker

。

MapperMethodInvoker

是 MyBatis 内部定义的函数式接口，有两个实现类：

PlainMethodInvoker

：内部持有

MapperMethod

对象，负责普通接口方法的 SQL 执行；

DefaultMethodInvoker

：直接调用接口中的

default

方法（Java 8+）。

每次方法调用时，

methodCache

 缓存的是 

MapperMethodInvoker

，而 

MapperMethod

 只是 

PlainMethodInvoker

 的一个成员变量。


```
<code><span leaf="">private MapperMethodInvoker cachedInvoker(Method <span class="code-snippet__function"><span class="code-snippet__keyword">method</span></span><span class="code-snippet__function">) </span><span class="code-snippet__function"><span class="code-snippet__title">throws</span></span><span class="code-snippet__function"> </span><span class="code-snippet__function"><span class="code-snippet__title">Throwable</span></span><span class="code-snippet__function"> </span>{</span></code><code><span leaf="">    try {</span></code><code><span leaf="">      <span class="code-snippet__keyword">return</span> MapUtil.computeIfAbsent(methodCache, <span class="code-snippet__function"><span class="code-snippet__keyword">method</span></span><span class="code-snippet__function">, </span><span class="code-snippet__function"><span class="code-snippet__title">m</span></span><span class="code-snippet__function"> -> </span>{</span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (!m.isDefault()) {</span></code><code><span leaf="">          <span class="code-snippet__keyword">return</span> new PlainMethodInvoker(new MapperMethod(mapperInterface, <span class="code-snippet__function"><span class="code-snippet__keyword">method</span></span><span class="code-snippet__function">, </span><span class="code-snippet__function"><span class="code-snippet__title">sqlSession</span></span><span class="code-snippet__function">.</span><span class="code-snippet__function"><span class="code-snippet__title">getConfiguration</span></span>()));</span></code><code><span leaf="">        }</span></code><code><span leaf="">        try {</span></code><code><span leaf="">          <span class="code-snippet__keyword">if</span> (privateLookupInMethod == null) {</span></code><code><span leaf="">            <span class="code-snippet__keyword">return</span> new DefaultMethodInvoker(getMethodHandleJava8(<span class="code-snippet__function"><span class="code-snippet__keyword">method</span></span><span class="code-snippet__function">))</span>;</span></code><code><span leaf="">          }</span></code><code><span leaf="">          <span class="code-snippet__keyword">return</span> new DefaultMethodInvoker(getMethodHandleJava9(<span class="code-snippet__function"><span class="code-snippet__keyword">method</span></span><span class="code-snippet__function">))</span>;</span></code><code><span leaf="">        } catch (IllegalAccessException | InstantiationException | InvocationTargetException</span></code><code><span leaf="">            | NoSuchMethodException e) {</span></code><code><span leaf="">          throw new RuntimeException(e);</span></code><code><span leaf="">        }</span></code><code><span leaf="">      });</span></code><code><span leaf="">    } catch (RuntimeException re) {</span></code><code><span leaf="">      Throwable cause = re.getCause();</span></code><code><span leaf="">      throw cause == null ? re : cause;</span></code><code><span leaf="">    }</span></code><code><span leaf="">  }</span></code>
```


MapperMethod

构造时会解析：

方法名（对应 Mapper XML 中的 id）

方法的返回类型（是单对象还是集合？）

方法的参数信息（是否使用

@Param

等）

MapperMethod

 中有两个核心字段：


```
<code><span leaf="">public <span class="code-snippet__class"><span class="code-snippet__keyword">class</span></span><span class="code-snippet__class"> </span><span class="code-snippet__class"><span class="code-snippet__title">MapperMethod</span></span><span class="code-snippet__class"> </span>{</span></code><code><span leaf="">    private final SqlCommand command;   <span class="code-snippet__regexp">//</span> 封装 SQL 的类型(SELECT/INSERT/UPDATE/DELETE)和 MappedStatement 的 id</span></code><code><span leaf="">    private final MethodSignature <span class="code-snippet__function"><span class="code-snippet__keyword">method</span></span>; // 封装方法的签名信息（返回类型、参数等）</span></code><code><span leaf="">}</span></code>
```


3.3

MapperMethod.execute()

PlainMethodInvoker.invoke()

最终会调用

mapperMethod.execute(sqlSession, args)

：


```
<code><span leaf=""><span class="code-snippet__function"><span class="code-snippet__keyword">public</span></span><span class="code-snippet__function"> Object </span><span class="code-snippet__function"><span class="code-snippet__title">execute</span></span><span class="code-snippet__function">(</span><span class="code-snippet__function"><span class="code-snippet__params">SqlSession sqlSession, Object[] </span></span><span class="code-snippet__function"><span class="code-snippet__params"><span class="code-snippet__keyword">args</span></span></span><span class="code-snippet__function">)</span> {</span></code><code><span leaf="">    Object result;</span></code><code><span leaf="">    <span class="code-snippet__keyword">switch</span> (command.getType()) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">case</span> INSERT:</span></code><code><span leaf="">            <span class="code-snippet__comment">// 处理 insert</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">break</span>;</span></code><code><span leaf="">        <span class="code-snippet__keyword">case</span> UPDATE:</span></code><code><span leaf="">            <span class="code-snippet__comment">// 处理 update</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">break</span>;</span></code><code><span leaf="">        <span class="code-snippet__keyword">case</span> DELETE:</span></code><code><span leaf="">            <span class="code-snippet__comment">// 处理 delete</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">break</span>;</span></code><code><span leaf="">        <span class="code-snippet__keyword">case</span> SELECT:</span></code><code><span leaf="">            <span class="code-snippet__comment">// 根据返回类型，调用 sqlSession 的不同方法</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (method.returnsVoid() && method.hasResultHandler()) {</span></code><code><span leaf="">                executeWithResultHandler(sqlSession, <span class="code-snippet__keyword">args</span>);</span></code><code><span leaf="">                result = <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">            } <span class="code-snippet__keyword">else</span> <span class="code-snippet__keyword">if</span> (method.returnsMany()) {</span></code><code><span leaf="">                result = executeForMany(sqlSession, <span class="code-snippet__keyword">args</span>);</span></code><code><span leaf="">            } <span class="code-snippet__keyword">else</span> <span class="code-snippet__keyword">if</span> (method.returnsMap()) {</span></code><code><span leaf="">                result = executeForMap(sqlSession, <span class="code-snippet__keyword">args</span>);</span></code><code><span leaf="">            } <span class="code-snippet__keyword">else</span> <span class="code-snippet__keyword">if</span> (method.returnsCursor()) {</span></code><code><span leaf="">                result = executeForCursor(sqlSession, <span class="code-snippet__keyword">args</span>);</span></code><code><span leaf="">            } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">                <span class="code-snippet__comment">// 返回单个对象</span></span></code><code><span leaf="">                Object param = method.convertArgsToSqlCommandParam(<span class="code-snippet__keyword">args</span>);</span></code><code><span leaf="">                result = sqlSession.selectOne(command.getName(), param);</span></code><code><span leaf="">            }</span></code><code><span leaf="">            <span class="code-snippet__keyword">break</span>;</span></code><code><span leaf="">        <span class="code-snippet__keyword">case</span> FLUSH:</span></code><code><span leaf="">            result = sqlSession.flushStatements();</span></code><code><span leaf="">            <span class="code-snippet__keyword">break</span>;</span></code><code><span leaf="">        <span class="code-snippet__literal">default</span>:</span></code><code><span leaf="">            <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> BindingException(<span class="code-snippet__string">"Unknown execution method..."</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> result;</span></code><code><span leaf="">}</span></code>
```


最终，我们看到了我们熟悉的方法：

sqlSession.selectOne()

 或 

selectList()

，后面的流程就回到了第一篇中讲过的 

Executor

 → 

StatementHandler

 → JDBC。

四、

@MapperScan

底
层注册流程（Spring 集成）

4.1 整体设计理念：延迟扫描

@MapperScan

 的设计理念是 

延迟扫描 + 职责分离

：

角色

实现类

核心职责

触发者

@MapperScan

 注解

声明扫描范围，通过

@Import导入 Registrar

定义注册者

MapperScannerRegistrar

注册

MapperScannerConfigurer

的 BeanDefinition

扫描执行者

MapperScannerConfigurer

实现

BeanDefinitionRegistryPostProcessor

，在 Spring 生命周期中触发扫描

核心扫描器

ClassPathMapperScanner

执行真正的包扫描和 BeanDefinition 转换

4.2 阶段一：MapperScannerRegistrar — 注册扫描器定义

@MapperScan

 注解通过 

@Import

 导入了 

MapperScannerRegistrar

：


```
<code><span leaf=""><span class="code-snippet__meta">@Retention(RetentionPolicy.RUNTIME)</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Target(ElementType.TYPE)</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Import(MapperScannerRegistrar.class)</span>  <span class="code-snippet__comment">// 关键：导入了一个 Registrar</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__meta">@interface</span> MapperScan {</span></code><code><span leaf="">    String[] value() <span class="code-snippet__keyword">default</span> {};</span></code><code><span leaf="">    String[] basePackages() <span class="code-snippet__keyword">default</span> {};</span></code><code><span leaf="">    <span class="code-snippet__comment">// ...</span></span></code><code><span leaf="">}</span></code>
```


MapperScannerRegistrar

 实现了 

ImportBeanDefinitionRegistrar

 接口，Spring 启动时会调用其 

registerBeanDefinitions

 方法：


```
<code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">registerBeanDefinitions</span>(<span class="code-snippet__params"><span class="code-snippet__title">AnnotationMetadata</span></span><span class="code-snippet__params"> importingClassMetadata, </span></span></code><code><span leaf="">                                    <span class="code-snippet__title">BeanDefinitionRegistry</span> registry) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 1. 获取 @MapperScan 注解的所有属性</span></span></code><code><span leaf="">    <span class="code-snippet__title">AnnotationAttributes</span> mapperScanAttrs = <span class="code-snippet__title">AnnotationAttributes</span>.<span class="code-snippet__title">fromMap</span>(</span></code><code><span leaf="">        importingClassMetadata.<span class="code-snippet__title">getAnnotationAttributes</span>(<span class="code-snippet__title">MapperScan</span>.<span class="code-snippet__property">class</span>.<span class="code-snippet__title">getName</span>()));</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (mapperScanAttrs != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 2. 调用重载方法，传入生成的基名</span></span></code><code><span leaf="">        <span class="code-snippet__variable">this</span>.<span class="code-snippet__title">registerBeanDefinitions</span>(importingClassMetadata, mapperScanAttrs, registry, </span></code><code><span leaf="">                                     <span class="code-snippet__title">generateBaseBeanName</span>(importingClassMetadata, <span class="code-snippet__number">0</span>));</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__keyword">private</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">registerBeanDefinitions</span>(<span class="code-snippet__params"><span class="code-snippet__title">AnnotationMetadata</span></span><span class="code-snippet__params"> importingClassMetadata,</span></span></code><code><span leaf="">                                     <span class="code-snippet__title">AnnotationAttributes</span> mapperScanAttrs,</span></code><code><span leaf="">                                     <span class="code-snippet__title">BeanDefinitionRegistry</span> registry, <span class="code-snippet__title">String</span> beanName) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 3. 创建 MapperScannerConfigurer 的 BeanDefinitionBuilder</span></span></code><code><span leaf="">    <span class="code-snippet__title">BeanDefinitionBuilder</span> builder = <span class="code-snippet__title">BeanDefinitionBuilder</span></span></code><code><span leaf="">        .<span class="code-snippet__title">genericBeanDefinition</span>(<span class="code-snippet__title">MapperScannerConfigurer</span>.<span class="code-snippet__property">class</span>);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 4. 设置 basePackage（扫描路径）</span></span></code><code><span leaf="">    builder.<span class="code-snippet__title">addPropertyValue</span>(<span class="code-snippet__string">"basePackage"</span>, </span></code><code><span leaf="">        <span class="code-snippet__title">StringUtils</span>.<span class="code-snippet__title">collectionToCommaDelimitedString</span>(basePackages));</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 5. 其他属性设置（sqlSessionFactoryBeanName、annotationClass 等）</span></span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 6. 注册到 Spring 容器，此时扫描尚未执行</span></span></code><code><span leaf="">    registry.<span class="code-snippet__title">registerBeanDefinition</span>(beanName, builder.<span class="code-snippet__title">getBeanDefinition</span>());</span></code><code><span leaf="">}</span></code>
```


核心要点

：

MapperScannerRegistrar

只注册 

MapperScannerConfigurer

 的 BeanDefinition

，不执行扫描

扫描动作被推迟到 Spring 后续的生命周期中执行

4.3 阶段二：MapperScannerConfigurer — 触发扫描

MapperScannerConfigurer

 实现了 

BeanDefinitionRegistryPostProcessor

 接口，这是 Spring 提供的核心扩展点，允许在 Bean 实例化之前修改或新增 BeanDefinition。

Spring 在 

refresh()

 容器的 

invokeBeanDefinitionRegistryPostProcessors

 阶段，会回调 

postProcessBeanDefinitionRegistry

 方法


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 1. 处理占位符（如 ${basePackage}）</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (<span class="code-snippet__keyword">this</span>.processPropertyPlaceHolders) {</span></code><code><span leaf="">        processPropertyPlaceHolders();</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 2. 创建 ClassPathMapperScanner</span></span></code><code><span leaf="">    ClassPathMapperScanner scanner = new ClassPathMapperScanner(registry);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 3. 设置各项属性</span></span></code><code><span leaf="">    scanner.setAddToConfig(<span class="code-snippet__keyword">this</span>.addToConfig);</span></code><code><span leaf="">    scanner.setAnnotationClass(<span class="code-snippet__keyword">this</span>.annotationClass);</span></code><code><span leaf="">    scanner.setMarkerInterface(<span class="code-snippet__keyword">this</span>.markerInterface);</span></code><code><span leaf="">    scanner.setSqlSessionFactory(<span class="code-snippet__keyword">this</span>.sqlSessionFactory);</span></code><code><span leaf="">    scanner.setSqlSessionTemplate(<span class="code-snippet__keyword">this</span>.sqlSessionTemplate);</span></code><code><span leaf="">    scanner.setResourceLoader(<span class="code-snippet__keyword">this</span>.applicationContext);</span></code><code><span leaf="">    scanner.setBeanNameGenerator(<span class="code-snippet__keyword">this</span>.nameGenerator);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 4. 注册过滤器（决定哪些接口被扫描）</span></span></code><code><span leaf="">    scanner.registerFilters();</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 5. 执行扫描（核心动作）</span></span></code><code><span leaf="">    scanner.scan(StringUtils.tokenizeToStringArray(<span class="code-snippet__keyword">this</span>.basePackage, </span></code><code><span leaf="">        ConfigurableApplicationContext.CONFIG_LOCATION_DELIMITERS));</span></code><code><span leaf="">}</span></code>
```


执行时机

：此方法在

容器解析完所有 XML 和注解配置之后、任何 Bean 实例化之前

执行，是 Spring 提供的最后添加 BeanDefinition 的地方

4.4 阶段三：ClassPathMapperScanner — 扫描与 BeanDefinition 转换

ClassPathMapperScanner

 继承自 Spring 的 

ClassPathBeanDefinitionScanner

，重写了 

doScan

 方法：


```
<code><span leaf=""><span class="code-snippet__comment">// ClassPathMapperScanner (mybatis-spring 3.0.3)</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">ClassPathMapperScanner</span> <span class="code-snippet__keyword">extends</span> <span class="code-snippet__title">ClassPathBeanDefinitionScanner</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__title">Class</span><? <span class="code-snippet__keyword">extends</span> <span class="code-snippet__title">MapperFactoryBean</span>> mapperFactoryBeanClass = <span class="code-snippet__title">MapperFactoryBean</span>.<span class="code-snippet__property">class</span>;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">Set</span><<span class="code-snippet__title">BeanDefinitionHolder</span>> <span class="code-snippet__title">doScan</span>(<span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params">... basePackages</span>) {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 1. 调用父类进行标准组件扫描，得到原始 BeanDefinition（beanClass = 接口本身）</span></span></code><code><span leaf="">        <span class="code-snippet__title">Set</span><<span class="code-snippet__title">BeanDefinitionHolder</span>> beanDefinitions = <span class="code-snippet__variable">super</span>.<span class="code-snippet__title">doScan</span>(basePackages);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (!beanDefinitions.<span class="code-snippet__title">isEmpty</span>()) {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 2. 对扫描到的 BeanDefinition 进行二次处理（关键步骤）</span></span></code><code><span leaf="">            <span class="code-snippet__title">processBeanDefinitions</span>(beanDefinitions);</span></code><code><span leaf="">        }</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> beanDefinitions;</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">processBeanDefinitions</span>(<span class="code-snippet__params"><span class="code-snippet__title">Set</span></span><span class="code-snippet__params"><</span><span class="code-snippet__params"><span class="code-snippet__title">BeanDefinitionHolder</span></span><span class="code-snippet__params">> beanDefinitions</span>) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">for</span> (<span class="code-snippet__title">BeanDefinitionHolder</span> holder : beanDefinitions) {</span></code><code><span leaf="">            <span class="code-snippet__title">BeanDefinition</span> definition = holder.<span class="code-snippet__title">getBeanDefinition</span>();</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">            <span class="code-snippet__comment">// 3. 修改 beanClass：将接口类型改为 MapperFactoryBean</span></span></code><code><span leaf="">            definition.<span class="code-snippet__title">setBeanClass</span>(<span class="code-snippet__variable">this</span>.<span class="code-snippet__property">mapperFactoryBeanClass</span>);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">            <span class="code-snippet__comment">// 4. 添加构造参数：原始 Mapper 接口类型</span></span></code><code><span leaf="">            definition.<span class="code-snippet__title">getConstructorArgumentValues</span>()</span></code><code><span leaf="">                .<span class="code-snippet__title">addGenericArgumentValue</span>(definition.<span class="code-snippet__title">getBeanClassName</span>());</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">            <span class="code-snippet__comment">// 5. 添加属性：sqlSessionFactory 或 sqlSessionTemplate</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (<span class="code-snippet__variable">this</span>.<span class="code-snippet__property">sqlSessionFactory</span> != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">                definition.<span class="code-snippet__title">getPropertyValues</span>().<span class="code-snippet__title">add</span>(<span class="code-snippet__string">"sqlSessionFactory"</span>, <span class="code-snippet__variable">this</span>.<span class="code-snippet__property">sqlSessionFactory</span>);</span></code><code><span leaf="">            }</span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (<span class="code-snippet__variable">this</span>.<span class="code-snippet__property">sqlSessionTemplate</span> != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">                definition.<span class="code-snippet__title">getPropertyValues</span>().<span class="code-snippet__title">add</span>(<span class="code-snippet__string">"sqlSessionTemplate"</span>, <span class="code-snippet__variable">this</span>.<span class="code-snippet__property">sqlSessionTemplate</span>);</span></code><code><span leaf="">            }</span></code><code><span leaf="">        }</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


关键转换

：

转换前

转换后

beanName =

userMapper

beanName =

userMapper

（不变）

beanClass =

com.example.mapper.UserMapper（接口）

beanClass =

MapperFactoryBean

无构造参数

构造参数 =

UserMapper.class

4.5 阶段四：MapperFactoryBean — 生成代理对象

经过上述转换，Spring 容器中每个 Mapper 接口都对应一个

MapperFactoryBean

的 BeanDefinition。

MapperFactoryBean

 实现了 

FactoryBean

 接口，Spring 实例化时会调用 

getObject()

 方法获取真正的 Mapper 代理对象：


```
<code><span leaf=""><span class="code-snippet__comment">// MapperFactoryBean (mybatis-spring 3.0.3)</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">MapperFactoryBean</span><T> <span class="code-snippet__keyword">extends</span> <span class="code-snippet__title">SqlSessionDaoSupport</span> <span class="code-snippet__keyword">implements</span> <span class="code-snippet__title">FactoryBean</span><T> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> Class<T> mapperInterface;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">MapperFactoryBean</span><span class="code-snippet__params">(Class<T> mapperInterface)</span> {</span></code><code><span leaf="">        <span class="code-snippet__built_in">this</span>.mapperInterface = mapperInterface;</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> T <span class="code-snippet__title">getObject</span><span class="code-snippet__params">()</span> <span class="code-snippet__keyword">throws</span> Exception {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 通过 SqlSession 获取 Mapper 代理对象</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> getSqlSession().getMapper(<span class="code-snippet__built_in">this</span>.mapperInterface);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


getSqlSession().getMapper()

的调用链最终进入 MyBatis 核心：


```
<code><span leaf=""><span class="code-snippet__title">SqlSessionTemplate</span>.<span class="code-snippet__title">getMapper</span>()</span></code><code><span leaf="">    → <span class="code-snippet__title">Configuration</span>.<span class="code-snippet__title">getMapper</span>()</span></code><code><span leaf="">        → <span class="code-snippet__title">MapperRegistry</span>.<span class="code-snippet__title">getMapper</span>()</span></code><code><span leaf="">            → <span class="code-snippet__title">MapperProxyFactory</span>.<span class="code-snippet__title">newInstance</span>()</span></code><code><span leaf="">                → <span class="code-snippet__title">Proxy</span>.<span class="code-snippet__title">newProxyInstance</span>() → 生成 <span class="code-snippet__title">MapperProxy</span></span></code>
```


最终，Spring 容器中存入的是 

MapperProxy

 动态代理对象

，这就是为什么我们可以直接用 

@Autowired

 注入一个接口的原因。

4.7 完整调用链总览


```
<code><span leaf="">启动类 @MapperScan(<span class="code-snippet__string">"com.example.mapper"</span>)</span></code><code><span leaf="">    ↓</span></code><code><span leaf="">@Import(MapperScannerRegistrar.<span class="code-snippet__keyword">class</span>)</span></code><code><span leaf="">    ↓</span></code><code><span leaf="">MapperScannerRegistrar.registerBeanDefinitions()</span></code><code><span leaf="">    → 注册 MapperScannerConfigurer 的 BeanDefinition</span></code><code><span leaf="">    ↓</span></code><code><span leaf=""><span class="code-snippet__function">Spring </span><span class="code-snippet__function"><span class="code-snippet__title">refresh</span></span><span class="code-snippet__function">() → invokeBeanDefinitionRegistryPostProcessors</span></span></code><code><span leaf="">    ↓</span></code><code><span leaf="">MapperScannerConfigurer.<span class="code-snippet__title">postProcessBeanDefinitionRegistry</span>()</span></code><code><span leaf="">    → 创建 ClassPathMapperScanner</span></code><code><span leaf="">    → 调用 scanner.<span class="code-snippet__title">scan</span>(<span class="code-snippet__params">basePackages</span>)</span></code><code><span leaf="">        ↓</span></code><code><span leaf="">    ClassPathMapperScanner.<span class="code-snippet__title">doScan</span>()</span></code><code><span leaf="">        → super.<span class="code-snippet__title">doScan</span>() → 父类扫描包，发现 Mapper 接口</span></code><code><span leaf="">        → <span class="code-snippet__title">processBeanDefinitions</span>()</span></code><code><span leaf="">            → 修改 BeanDefinition：beanClass = MapperFactoryBean</span></code><code><span leaf="">            → 添加构造参数：原始 Mapper 接口类型</span></code><code><span leaf="">        ↓</span></code><code><span leaf="">    MapperFactoryBean.getObject()</span></code><code><span leaf="">        → sqlSession.getMapper(mapperInterface)</span></code><code><span leaf="">            → MapperRegistry.getMapper()</span></code><code><span leaf="">                → MapperProxyFactory.newInstance()</span></code><code><span leaf="">                    → JDK 动态代理 → MapperProxy</span></code><code><span leaf="">        ↓</span></code><code><span leaf="">Spring 容器注入 MapperProxy 代理对象</span></code>
```


五、面试高频题

Q1：MyBatis 的 Mapper 接口为什么不需要实现类？

A

：因为 MyBatis 使用了 JDK 动态代理，在运行时为接口生成了一个代理对象。当调用接口方法时，会被

MapperProxy.invoke()

拦截，然后根据方法名找到对应的

MappedStatement

，最终调用

SqlSession

执行 SQL。

Q2：

MapperProxy

中为什么要缓存

MapperMethod

？

A

：

MapperMethod

的构造过程需要解析方法的返回值类型、参数信息等，这些信息是固定的。缓存可以避免每次方法调用都重复解析，提高性能。

Q3：

@MapperScan

的原理是什么？

A

：

@MapperScan

 底层通过 

@Import(MapperScannerRegistrar.class)

 导入了一个 

ImportBeanDefinitionRegistrar

。Spring 启动时，

MapperScannerRegistrar

 会向容器注册一个 

MapperScannerConfigurer

 的 BeanDefinition。

MapperScannerConfigurer

 实现了 

BeanDefinitionRegistryPostProcessor

，所以在 Spring 的 

refresh()

 过程中，它的 

postProcessBeanDefinitionRegistry

 方法会被调用。在这个方法里，会创建一个 

ClassPathMapperScanner

，执行 

doScan

 扫描指定包下的所有 Mapper 接口，然后将每个接口的 BeanDefinition 的 

beanClass

 修改为 

MapperFactoryBean

，并将原始接口类型作为构造参数传入。最终，Spring 实例化 

MapperFactoryBean

 时，会调用其 

getObject()

 方法，通过 

SqlSession.getMapper()

 生成真正的 Mapper 动态代理对象（即 

MapperProxy

）并注入容器。

Q4：

MapperFactoryBean

和

MapperProxyFactory

是什么关系？

A

：

MapperProxyFactory

是 MyBatis 内部用来创建代理对象的工厂，与 Spring 无关。

MapperFactoryBean

是 Spring 集成中的适配器，它实现了

FactoryBean

，内部持有

SqlSession

，并调用

sqlSession.getMapper()

来获取代理对象，而

sqlSession.getMapper()

最终会调用

MapperProxyFactory

创建代理。

六、下篇预告

第 4 篇我们将深入

SqlSession

体系，拆解

DefaultSqlSession

、

SqlSessionFactory

的构建流程，以及

SqlSession

的四大核心对象的初始化时机。

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
