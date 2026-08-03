---
title: "MyBatis 源码深度拆解（四）：SqlSession 体系深度拆解"
date: "2026-06-21"
domain: "学习"
area: "Java 后端"
module: "MyBatis 源码拆解"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "面试官：SqlSession 是什么？它和 SqlSessionFactory 是什么关系？SqlSession 里的四…"
tags:
  - "MyBatis"
  - "源码分析"
---

# MyBatis 源码深度拆解（四）：SqlSession 体系深度拆解

> 来源：微信公众号（MyBatis 源码深度拆解系列）
> 链接：[http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484020&idx=1&sn=9bc9313a8519fc01ce47e9636d9e6d49&chksm=c2b8102bf5cf993d184926d0688326a62f77a47598413fadd5d302db34a93e1da26b9507a035](http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484020&idx=1&sn=9bc9313a8519fc01ce47e9636d9e6d49&chksm=c2b8102bf5cf993d184926d0688326a62f77a47598413fadd5d302db34a93e1da26b9507a035)
> 类型：📚 参考资料（非面试题/面经）—— MyBatis 源码深度拆解系列
> 相关：第196题(MyBatis 与 Spring 事务整合)
> 整理时间：2026-08-03

---

面试官：SqlSession 是什么？它和 SqlSessionFactory 是什么关系？SqlSession 里的四大对象是什么时候创建的？

一、回顾与开篇

前几篇我们走通了整体架构，也看了配置加载和 Mapper 代理。今天我们把目光聚焦到

SqlSession

这个“门面”上。

先看一段最熟悉的代码：


```
<code><span leaf=""><span class="code-snippet__comment">// 1. 构建 SqlSessionFactory</span></span></code><code><span leaf=""><span class="code-snippet__type">SqlSessionFactory</span> <span class="code-snippet__variable">factory</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">SqlSessionFactoryBuilder</span>().build(inputStream);</span></code><code><span leaf=""><span class="code-snippet__comment">// 2. 打开 SqlSession</span></span></code><code><span leaf=""><span class="code-snippet__type">SqlSession</span> <span class="code-snippet__variable">session</span> <span class="code-snippet__operator">=</span> factory.openSession();</span></code><code><span leaf=""><span class="code-snippet__comment">// 3. 获取 Mapper 并执行</span></span></code><code><span leaf=""><span class="code-snippet__type">UserMapper</span> <span class="code-snippet__variable">mapper</span> <span class="code-snippet__operator">=</span> session.getMapper(UserMapper.class);</span></code><code><span leaf=""><span class="code-snippet__type">User</span> <span class="code-snippet__variable">user</span> <span class="code-snippet__operator">=</span> mapper.selectById(<span class="code-snippet__number">1</span>);</span></code><code><span leaf=""><span class="code-snippet__comment">// 4. 关闭会话</span></span></code><code><span leaf="">session.close();</span></code>
```


第 2 步和第 4 步就是今天的主角：

SqlSession 的创建与销毁

。

本篇目标

：

搞清楚

SqlSessionFactory

的构建过程

深入

DefaultSqlSession

的核心实现

理清四大对象（Executor、StatementHandler、ParameterHandler、ResultSetHandler）的初始化时机

理解一级缓存与 SqlSession 的绑定关系

一句话总结

：

SqlSessionFactory

是生产

SqlSession

的工厂

SqlSession

是MyBatis的门面接口，对外提供统一的数据库操作API。具体执行时，

SqlSession

将操作委托给

Executor

执行器，由

Executor

统一调度

StatementHandler

、

ParameterHandler

和

ResultSetHandler

三大组件完成SQL执行与结果映射。

DefaultSqlSession

 是 MyBatis 原生提供的默认实现类，也是最常用的实现。除此之外，MyBatis 还提供了 

SqlSessionManager

 实现。在 Spring 整合环境中，核心实现则是 

SqlSessionTemplate

本文主要分析MyBatis原生框架中SqlSession的核心设计与实现。第3章补充说明在Spring整合环境下的额外机制（Mapper扫描、

SqlSessionTemplate

等），阅读时请注意区分纯MyBatis原生逻辑与Spring整合层逻辑

二、SqlSessionFactory 构建流程

2.1 从 builder.build() 说起


```
<code><span leaf=""><span class="code-snippet__comment">// SqlSessionFactoryBuilder</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">SqlSessionFactory</span> <span class="code-snippet__title">build</span>(<span class="code-snippet__params"><span class="code-snippet__title">InputStream</span></span><span class="code-snippet__params"> inputStream, </span><span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> environment, </span><span class="code-snippet__params"><span class="code-snippet__title">Properties</span></span><span class="code-snippet__params"> properties</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__title">XMLConfigBuilder</span> parser = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">XMLConfigBuilder</span>(inputStream, environment, properties);</span></code><code><span leaf="">        <span class="code-snippet__title">Configuration</span> config = parser.<span class="code-snippet__title">parse</span>();  <span class="code-snippet__comment">// 解析配置</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">build</span>(config);                    <span class="code-snippet__comment">// 构建 SqlSessionFactory</span></span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">Exception</span> e) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__title">ExceptionFactory</span>.<span class="code-snippet__title">wrapException</span>(<span class="code-snippet__string">"Error building SqlSession."</span>, e);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">SqlSessionFactory</span> <span class="code-snippet__title">build</span>(<span class="code-snippet__params"><span class="code-snippet__title">Configuration</span></span><span class="code-snippet__params"> config</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">DefaultSqlSessionFactory</span>(config);</span></code><code><span leaf="">}</span></code>
```


非常简单：解析完 

Configuration

 后，直接 

new DefaultSqlSessionFactory(config)

。

2.2 DefaultSqlSessionFactory 的结构


```
<code><span leaf=""><span class="code-snippet__comment">// DefaultSqlSessionFactory</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">DefaultSqlSessionFactory</span> <span class="code-snippet__keyword">implements</span> <span class="code-snippet__title">SqlSessionFactory</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> final <span class="code-snippet__title">Configuration</span> configuration;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">DefaultSqlSessionFactory</span>(<span class="code-snippet__title">Configuration</span> configuration) {</span></code><code><span leaf="">        <span class="code-snippet__variable">this</span>.<span class="code-snippet__property">configuration</span> = configuration;</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 各种 openSession 重载方法，最终都调用 openSessionFromDataSource</span></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">SqlSession</span> <span class="code-snippet__title">openSession</span>() {</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">openSessionFromDataSource</span>(configuration.<span class="code-snippet__title">getDefaultExecutorType</span>(), <span class="code-snippet__literal">null</span>, <span class="code-snippet__literal">false</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">SqlSession</span> <span class="code-snippet__title">openSession</span>(<span class="code-snippet__params"><span class="code-snippet__built_in">boolean</span></span><span class="code-snippet__params"> autoCommit</span>) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">openSessionFromDataSource</span>(configuration.<span class="code-snippet__title">getDefaultExecutorType</span>(), <span class="code-snippet__literal">null</span>, autoCommit);</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">SqlSession</span> <span class="code-snippet__title">openSession</span>(<span class="code-snippet__params"><span class="code-snippet__title">ExecutorType</span></span><span class="code-snippet__params"> execType</span>) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">openSessionFromDataSource</span>(execType, <span class="code-snippet__literal">null</span>, <span class="code-snippet__literal">false</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// ... 其他重载</span></span></code><code><span leaf="">}</span></code>
```


关键点

：

DefaultSqlSessionFactory

 只是 

Configuration

 的持有者，不保存任何会话状态，所以是

线程安全的

，可以被多个线程共享。

三、@MapperScan 底层注册流程

3.1 整体设计理念：延迟扫描

在 3.0.x 版本中，

@MapperScan

的设计理念是

延迟扫描 + 职责分离

：

角色

实现类

核心职责

触发者

@MapperScan 注解

声明扫描范围，通过

@Import

导入 Registrar

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

3.2 阶段一：MapperScannerRegistrar — 注册扫描器定义

@MapperScan

 注解通过 

@Import

 导入了 

MapperScannerRegistrar


```
<code><span leaf=""><span class="code-snippet__meta">@Retention(RetentionPolicy.RUNTIME)</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Target(ElementType.TYPE)</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Import(MapperScannerRegistrar.class)</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__meta">@interface</span> MapperScan {</span></code><code><span leaf="">    String[] basePackages() <span class="code-snippet__keyword">default</span> {};</span></code><code><span leaf="">    <span class="code-snippet__comment">// ... 其他属性</span></span></code><code><span leaf="">}</span></code>
```


MapperScannerRegistrar

 实现了 

ImportBeanDefinitionRegistrar

 接口，Spring 启动时会调用其 

registerBeanDefinitions

 方法


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

3.3 阶段二：MapperScannerConfigurer — 触发扫描

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

：


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 1. 处理占位符（如 ${basePackage}）</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (<span class="code-snippet__keyword">this</span>.processPropertyPlaceHolders) {</span></code><code><span leaf="">        processPropertyPlaceHolders();</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 2. 创建 ClassPathMapperScanner</span></span></code><code><span leaf="">    ClassPathMapperScanner scanner = new ClassPathMapperScanner(registry);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 3. 设置各项属性</span></span></code><code><span leaf="">    scanner.setAddToConfig(<span class="code-snippet__keyword">this</span>.addToConfig);</span></code><code><span leaf="">    scanner.setAnnotationClass(<span class="code-snippet__keyword">this</span>.annotationClass);</span></code><code><span leaf="">    scanner.setMarkerInterface(<span class="code-snippet__keyword">this</span>.markerInterface);</span></code><code><span leaf="">    scanner.setSqlSessionFactory(<span class="code-snippet__keyword">this</span>.sqlSessionFactory);</span></code><code><span leaf="">    scanner.setSqlSessionTemplate(<span class="code-snippet__keyword">this</span>.sqlSessionTemplate);</span></code><code><span leaf="">    scanner.setResourceLoader(<span class="code-snippet__keyword">this</span>.applicationContext);</span></code><code><span leaf="">    scanner.setBeanNameGenerator(<span class="code-snippet__keyword">this</span>.nameGenerator);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 4. 注册过滤器（决定哪些接口被扫描）</span></span></code><code><span leaf="">    scanner.registerFilters();</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 5. 执行扫描（核心动作）</span></span></code><code><span leaf="">    scanner.scan(StringUtils.tokenizeToStringArray(<span class="code-snippet__keyword">this</span>.basePackage, </span></code><code><span leaf="">        ConfigurableApplicationContext.CONFIG_LOCATION_DELIMITERS));</span></code><code><span leaf="">}</span></code>
```


执行时机

：此方法在

容器解析完所有 XML 和注解配置之后、任何 Bean 实例化之前

执行，是 Spring 提供的最后添加 BeanDefinition 的地方

3.4 阶段三：ClassPathMapperScanner — 扫描与 BeanDefinition 转换

ClassPathMapperScanner

 继承自 Spring 的 

ClassPathBeanDefinitionScanner

，重写了 

doScan

 方法：


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">ClassPathMapperScanner</span> <span class="code-snippet__keyword">extends</span> <span class="code-snippet__title">ClassPathBeanDefinitionScanner</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__title">Class</span><? <span class="code-snippet__keyword">extends</span> <span class="code-snippet__title">MapperFactoryBean</span>> mapperFactoryBeanClass = <span class="code-snippet__title">MapperFactoryBean</span>.<span class="code-snippet__property">class</span>;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">Set</span><<span class="code-snippet__title">BeanDefinitionHolder</span>> <span class="code-snippet__title">doScan</span>(<span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params">... basePackages</span>) {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 1. 调用父类进行标准组件扫描，得到原始 BeanDefinition（beanClass = 接口本身）</span></span></code><code><span leaf="">        <span class="code-snippet__title">Set</span><<span class="code-snippet__title">BeanDefinitionHolder</span>> beanDefinitions = <span class="code-snippet__variable">super</span>.<span class="code-snippet__title">doScan</span>(basePackages);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (!beanDefinitions.<span class="code-snippet__title">isEmpty</span>()) {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 2. 对扫描到的 BeanDefinition 进行二次处理（关键步骤）</span></span></code><code><span leaf="">            <span class="code-snippet__title">processBeanDefinitions</span>(beanDefinitions);</span></code><code><span leaf="">        }</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> beanDefinitions;</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">processBeanDefinitions</span>(<span class="code-snippet__params"><span class="code-snippet__title">Set</span></span><span class="code-snippet__params"><</span><span class="code-snippet__params"><span class="code-snippet__title">BeanDefinitionHolder</span></span><span class="code-snippet__params">> beanDefinitions</span>) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">for</span> (<span class="code-snippet__title">BeanDefinitionHolder</span> holder : beanDefinitions) {</span></code><code><span leaf="">            <span class="code-snippet__title">BeanDefinition</span> definition = holder.<span class="code-snippet__title">getBeanDefinition</span>();</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">            <span class="code-snippet__comment">// 3. 修改 beanClass：将接口类型改为 MapperFactoryBean</span></span></code><code><span leaf="">            definition.<span class="code-snippet__title">setBeanClass</span>(<span class="code-snippet__variable">this</span>.<span class="code-snippet__property">mapperFactoryBeanClass</span>);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">            <span class="code-snippet__comment">// 4. 添加构造参数：原始 Mapper 接口类型</span></span></code><code><span leaf="">            definition.<span class="code-snippet__title">getConstructorArgumentValues</span>()</span></code><code><span leaf="">                .<span class="code-snippet__title">addGenericArgumentValue</span>(definition.<span class="code-snippet__title">getBeanClassName</span>());</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">            <span class="code-snippet__comment">// 5. 添加属性：sqlSessionFactory 或 sqlSessionTemplate</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (<span class="code-snippet__variable">this</span>.<span class="code-snippet__property">sqlSessionFactory</span> != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">                definition.<span class="code-snippet__title">getPropertyValues</span>().<span class="code-snippet__title">add</span>(<span class="code-snippet__string">"sqlSessionFactory"</span>, <span class="code-snippet__variable">this</span>.<span class="code-snippet__property">sqlSessionFactory</span>);</span></code><code><span leaf="">            }</span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (<span class="code-snippet__variable">this</span>.<span class="code-snippet__property">sqlSessionTemplate</span> != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">                definition.<span class="code-snippet__title">getPropertyValues</span>().<span class="code-snippet__title">add</span>(<span class="code-snippet__string">"sqlSessionTemplate"</span>, <span class="code-snippet__variable">this</span>.<span class="code-snippet__property">sqlSessionTemplate</span>);</span></code><code><span leaf="">            }</span></code><code><span leaf="">        }</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
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

com.example.mapper.UserMapper

（接口）

beanClass =

MapperFactoryBean

无构造参数

构造参数 =

UserMapper.class

3.5 阶段四：MapperFactoryBean — 生成代理对象

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
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">MapperFactoryBean</span><T> <span class="code-snippet__keyword">extends</span> <span class="code-snippet__title">SqlSessionDaoSupport</span> <span class="code-snippet__keyword">implements</span> <span class="code-snippet__title">FactoryBean</span><T> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> Class<T> mapperInterface;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">MapperFactoryBean</span><span class="code-snippet__params">(Class<T> mapperInterface)</span> {</span></code><code><span leaf="">        <span class="code-snippet__built_in">this</span>.mapperInterface = mapperInterface;</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> T <span class="code-snippet__title">getObject</span><span class="code-snippet__params">()</span> <span class="code-snippet__keyword">throws</span> Exception {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 通过 SqlSession 获取 Mapper 代理对象</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> getSqlSession().getMapper(<span class="code-snippet__built_in">this</span>.mapperInterface);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
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

3.6 完整调用链总览


```
<code><span leaf="">启动类 @MapperScan(<span class="code-snippet__string">"com.example.mapper"</span>)</span></code><code><span leaf="">    ↓</span></code><code><span leaf="">@Import(MapperScannerRegistrar.<span class="code-snippet__keyword">class</span>)</span></code><code><span leaf="">    ↓</span></code><code><span leaf="">MapperScannerRegistrar.registerBeanDefinitions()</span></code><code><span leaf="">    → 注册 MapperScannerConfigurer 的 BeanDefinition</span></code><code><span leaf="">    ↓</span></code><code><span leaf=""><span class="code-snippet__function">Spring </span><span class="code-snippet__function"><span class="code-snippet__title">refresh</span></span><span class="code-snippet__function">() → invokeBeanDefinitionRegistryPostProcessors</span></span></code><code><span leaf="">    ↓</span></code><code><span leaf="">MapperScannerConfigurer.<span class="code-snippet__title">postProcessBeanDefinitionRegistry</span>()</span></code><code><span leaf="">    → 创建 ClassPathMapperScanner</span></code><code><span leaf="">    → 调用 scanner.<span class="code-snippet__title">scan</span>(<span class="code-snippet__params">basePackages</span>)</span></code><code><span leaf="">        ↓</span></code><code><span leaf="">    ClassPathMapperScanner.<span class="code-snippet__title">doScan</span>()</span></code><code><span leaf="">        → super.<span class="code-snippet__title">doScan</span>() → 父类扫描包，发现 Mapper 接口</span></code><code><span leaf="">        → <span class="code-snippet__title">processBeanDefinitions</span>()</span></code><code><span leaf="">            → 修改 BeanDefinition：beanClass = MapperFactoryBean</span></code><code><span leaf="">            → 添加构造参数：原始 Mapper 接口类型</span></code><code><span leaf="">        ↓</span></code><code><span leaf="">    MapperFactoryBean.getObject()</span></code><code><span leaf="">        → sqlSession.getMapper(mapperInterface)</span></code><code><span leaf="">            → MapperRegistry.getMapper()</span></code><code><span leaf="">                → MapperProxyFactory.newInstance()</span></code><code><span leaf="">                    → JDK 动态代理 → MapperProxy</span></code><code><span leaf="">        ↓</span></code><code><span leaf="">Spring 容器注入 MapperProxy 代理对象</span></code>
```


四、DefaultSqlSession 核心源码拆解

4.1 核心字段


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__class"><span class="code-snippet__keyword">class</span></span><span class="code-snippet__class"> </span><span class="code-snippet__class"><span class="code-snippet__title">DefaultSqlSession</span></span><span class="code-snippet__class"> </span><span class="code-snippet__class"><span class="code-snippet__keyword">implements</span></span><span class="code-snippet__class"> </span><span class="code-snippet__class"><span class="code-snippet__title">SqlSession</span></span><span class="code-snippet__class"> </span>{</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">final</span> Configuration configuration;  <span class="code-snippet__comment">// 全局配置</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">final</span> Executor executor;            <span class="code-snippet__comment">// 执行器</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">final</span> <span class="code-snippet__keyword">boolean</span> autoCommit;           <span class="code-snippet__comment">// 是否自动提交</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">boolean</span> dirty;                      <span class="code-snippet__comment">// 是否有数据变更（用于判断是否需要提交/回滚）</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> List<Cursor<span class="code-snippet__meta"><?</span>>> cursors;            <span class="code-snippet__comment">// 游标集合，用于 close 时批量关闭</span></span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// ... 其他</span></span></code><code><span leaf="">}</span></code>
```


4.2 查询方法链路

以 

selectOne

 为例：


```
<code><span leaf=""><span class="code-snippet__comment">// DefaultSqlSession</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <T> T <span class="code-snippet__title">selectOne</span>(<span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> statement, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameter</span>) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 委托给 selectList，然后取第一个元素</span></span></code><code><span leaf="">    <span class="code-snippet__title">List</span><T> list = <span class="code-snippet__variable">this</span>.<span class="code-snippet__title">selectList</span>(statement, parameter);</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (list.<span class="code-snippet__title">size</span>() == <span class="code-snippet__number">1</span>) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> list.<span class="code-snippet__title">get</span>(<span class="code-snippet__number">0</span>);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">else</span> <span class="code-snippet__keyword">if</span> (list.<span class="code-snippet__title">size</span>() > <span class="code-snippet__number">1</span>) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">TooManyResultsException</span>(<span class="code-snippet__string">"..."</span>);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <E> <span class="code-snippet__title">List</span><E> <span class="code-snippet__title">selectList</span>(<span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> statement, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameter</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> <span class="code-snippet__variable">this</span>.<span class="code-snippet__title">selectList</span>(statement, parameter, <span class="code-snippet__title">RowBounds</span>.<span class="code-snippet__property">DEFAULT</span>);</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <E> <span class="code-snippet__title">List</span><E> <span class="code-snippet__title">selectList</span>(<span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> statement, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameter, </span><span class="code-snippet__params"><span class="code-snippet__title">RowBounds</span></span><span class="code-snippet__params"> rowBounds</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 1. 从 Configuration 中获取 MappedStatement</span></span></code><code><span leaf="">        <span class="code-snippet__title">MappedStatement</span> ms = configuration.<span class="code-snippet__title">getMappedStatement</span>(statement);</span></code><code><span leaf="">        <span class="code-snippet__comment">// 2. 委托给 Executor 执行</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> executor.<span class="code-snippet__title">query</span>(ms, <span class="code-snippet__title">wrapCollection</span>(parameter), rowBounds, <span class="code-snippet__title">Executor</span>.<span class="code-snippet__property">NO_RESULT_HANDLER</span>);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">Exception</span> e) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__title">ExceptionFactory</span>.<span class="code-snippet__title">wrapException</span>(<span class="code-snippet__string">"Error querying database.  Cause: "</span> + e, e);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">        <span class="code-snippet__title">ErrorContext</span>.<span class="code-snippet__title">instance</span>().<span class="code-snippet__title">reset</span>();</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


关键点

：

selectOne

本质是

selectList

的包装，取第一个元素

statement

参数是 Mapper XML 中的

namespace.methodId

参数如果是集合类型，会被包装（避免参数名解析问题）

4.3 更新方法链路

以 

insert

 / 

update

 / 

delete

 为例，它们都走 

update

 方法：


```
<code><span leaf=""><span class="code-snippet__comment">// DefaultSqlSession</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> int <span class="code-snippet__title">insert</span>(<span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> statement, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameter</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">update</span>(statement, parameter);</span></code><code><span leaf="">}</span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> int <span class="code-snippet__title">update</span>(<span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> statement, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameter</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        dirty = <span class="code-snippet__literal">true</span>;  <span class="code-snippet__comment">// 标记数据已变更</span></span></code><code><span leaf="">        <span class="code-snippet__title">MappedStatement</span> ms = configuration.<span class="code-snippet__title">getMappedStatement</span>(statement);</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> executor.<span class="code-snippet__title">update</span>(ms, <span class="code-snippet__title">wrapCollection</span>(parameter));</span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">Exception</span> e) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__title">ExceptionFactory</span>.<span class="code-snippet__title">wrapException</span>(<span class="code-snippet__string">"Error updating database.  Cause: "</span> + e, e);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">        <span class="code-snippet__title">ErrorContext</span>.<span class="code-snippet__title">instance</span>().<span class="code-snippet__title">reset</span>();</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


关键点

：

dirty

标志用于标记当前

SqlSession

是否执行过任何数据变更操作（

insert

/

update

/

delete

），是事务提交判断的核心依据：

autoCommit = false

时，

commit()

方法会检查

isCommitOrRollbackRequired

方法，若

dirty

为

true

则提交事务并将

dirty

重置为

false

；

close()

方法同理，若

dirty

为

true

则回滚事务。

autoCommit = true

时，

dirty

标志不影响提交/回滚，因为数据库事务由JDBC自动提交管理。

需要注意的是，以上是纯MyBatis原生机制。在Spring整合场景下，事务由Spring的

PlatformTransactionManager

统一管理，不应再手动调用

sqlSession.commit()

。

4.4 事务管理：commit / rollback / close


```
<code><span leaf=""><span class="code-snippet__comment">// DefaultSqlSession</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">commit</span>() {</span></code><code><span leaf="">    <span class="code-snippet__title">commit</span>(<span class="code-snippet__literal">false</span>);</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">commit</span>(<span class="code-snippet__params"><span class="code-snippet__built_in">boolean</span></span><span class="code-snippet__params"> force</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 提交事务，force 参数表示即使不 dirty 也提交</span></span></code><code><span leaf="">        executor.<span class="code-snippet__title">commit</span>(<span class="code-snippet__title">isCommitOrRollbackRequired</span>(force));</span></code><code><span leaf="">        dirty = <span class="code-snippet__literal">false</span>;  <span class="code-snippet__comment">// 提交成功后重置 dirty</span></span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">Exception</span> e) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__title">ExceptionFactory</span>.<span class="code-snippet__title">wrapException</span>(<span class="code-snippet__string">"Error committing transaction.  Cause: "</span> + e, e);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">        <span class="code-snippet__title">ErrorContext</span>.<span class="code-snippet__title">instance</span>().<span class="code-snippet__title">reset</span>();</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">rollback</span>() {</span></code><code><span leaf="">    <span class="code-snippet__title">rollback</span>(<span class="code-snippet__literal">false</span>);</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">rollback</span>(<span class="code-snippet__params"><span class="code-snippet__built_in">boolean</span></span><span class="code-snippet__params"> force</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 回滚事务</span></span></code><code><span leaf="">        executor.<span class="code-snippet__title">rollback</span>(<span class="code-snippet__title">isCommitOrRollbackRequired</span>(force));</span></code><code><span leaf="">        dirty = <span class="code-snippet__literal">false</span>;</span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">Exception</span> e) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__title">ExceptionFactory</span>.<span class="code-snippet__title">wrapException</span>(<span class="code-snippet__string">"Error rolling back transaction.  Cause: "</span> + e, e);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">        <span class="code-snippet__title">ErrorContext</span>.<span class="code-snippet__title">instance</span>().<span class="code-snippet__title">reset</span>();</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">close</span>() {</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 如果有未提交的变更，回滚</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (dirty) {</span></code><code><span leaf="">            executor.<span class="code-snippet__title">rollback</span>(<span class="code-snippet__literal">true</span>);</span></code><code><span leaf="">        }</span></code><code><span leaf="">        <span class="code-snippet__comment">// 关闭 executor（会关闭连接）</span></span></code><code><span leaf="">        executor.<span class="code-snippet__title">close</span>(<span class="code-snippet__literal">true</span>);</span></code><code><span leaf="">        dirty = <span class="code-snippet__literal">false</span>;</span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">Exception</span> e) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__title">ExceptionFactory</span>.<span class="code-snippet__title">wrapException</span>(<span class="code-snippet__string">"Error closing session.  Cause: "</span> + e, e);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">        <span class="code-snippet__title">ErrorContext</span>.<span class="code-snippet__title">instance</span>().<span class="code-snippet__title">reset</span>();</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__comment">// 判断是否需要提交/回滚</span></span></code><code><span leaf=""><span class="code-snippet__keyword">private</span> <span class="code-snippet__built_in">boolean</span> <span class="code-snippet__title">isCommitOrRollbackRequired</span>(<span class="code-snippet__params"><span class="code-snippet__built_in">boolean</span></span><span class="code-snippet__params"> force</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> (!autoCommit && dirty) || force;</span></code><code><span leaf="">}</span></code>
```


事务逻辑总结

：

场景

autoCommit=false（默认）

autoCommit=true

执行更新后

dirty=true，需要手动 commit

自动提交，dirty 变化不影响

close() 时

如果 dirty=true，自动 rollback

直接关闭

commit(force)

正常提交

即使 autoCommit=true 也提交

五、四大对象的初始化时机

5.1 Executor：SqlSession 创建时初始化

在

openSessionFromDataSource

中，通过

configuration.newExecutor()

创建。

5.2 StatementHandler：执行 SQL 时创建


```
<code><span leaf=""><span class="code-snippet__comment">// SimpleExecutor.doQuery</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <E> List<E> <span class="code-snippet__title">doQuery</span><span class="code-snippet__params">(MappedStatement ms, Object parameter, RowBounds rowBounds, </span></span></code><code><span leaf="">                           ResultHandler resultHandler, BoundSql boundSql) <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">    <span class="code-snippet__type">Statement</span> <span class="code-snippet__variable">stmt</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__type">Configuration</span> <span class="code-snippet__variable">configuration</span> <span class="code-snippet__operator">=</span> ms.getConfiguration();</span></code><code><span leaf="">        <span class="code-snippet__comment">// 创建 StatementHandler</span></span></code><code><span leaf="">        <span class="code-snippet__type">StatementHandler</span> <span class="code-snippet__variable">handler</span> <span class="code-snippet__operator">=</span> configuration.newStatementHandler(wrapper, ms, parameter, rowBounds, resultHandler, boundSql);</span></code><code><span leaf="">        <span class="code-snippet__comment">// ...</span></span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```



```
<code><span leaf=""><span class="code-snippet__comment">// Configuration</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">StatementHandler</span> <span class="code-snippet__title">newStatementHandler</span>(<span class="code-snippet__params"><span class="code-snippet__title">Executor</span></span><span class="code-snippet__params"> executor, </span><span class="code-snippet__params"><span class="code-snippet__title">MappedStatement</span></span><span class="code-snippet__params"> ms, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameter, </span></span></code><code><span leaf="">                                             <span class="code-snippet__title">RowBounds</span> rowBounds, <span class="code-snippet__title">ResultHandler</span> resultHandler, <span class="code-snippet__title">BoundSql</span> boundSql) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 创建 RoutingStatementHandler（会根据 SQL 类型路由到对应的 StatementHandler）</span></span></code><code><span leaf="">    <span class="code-snippet__title">StatementHandler</span> statementHandler = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">RoutingStatementHandler</span>(executor, ms, parameter, rowBounds, resultHandler, boundSql);</span></code><code><span leaf="">    <span class="code-snippet__comment">// 插件拦截</span></span></code><code><span leaf="">    statementHandler = (<span class="code-snippet__title">StatementHandler</span>) interceptorChain.<span class="code-snippet__title">pluginAll</span>(statementHandler);</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> statementHandler;</span></code><code><span leaf="">}</span></code>
```


5.3 ParameterHandler 和 ResultSetHandler：在 StatementHandler 创建时初始化


```
<code><span leaf=""><span class="code-snippet__comment">// RoutingStatementHandler 构造方法</span></span></code><code><span leaf=""><span class="code-snippet__function"><span class="code-snippet__keyword">public</span></span><span class="code-snippet__function"> </span><span class="code-snippet__function"><span class="code-snippet__title">RoutingStatementHandler</span></span><span class="code-snippet__function">(</span><span class="code-snippet__function"><span class="code-snippet__params">Executor executor, MappedStatement ms, Object parameter, </span></span></span></code><code><span leaf="">                               RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 根据 MappedStatement 的类型，选择具体的 StatementHandler</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">switch</span> (ms.getStatementType()) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">case</span> STATEMENT:</span></code><code><span leaf="">            <span class="code-snippet__built_in">delegate</span> = <span class="code-snippet__keyword">new</span> SimpleStatementHandler(executor, ms, parameter, rowBounds, resultHandler, boundSql);</span></code><code><span leaf="">            <span class="code-snippet__keyword">break</span>;</span></code><code><span leaf="">        <span class="code-snippet__keyword">case</span> PREPARED:</span></code><code><span leaf="">            <span class="code-snippet__built_in">delegate</span> = <span class="code-snippet__keyword">new</span> PreparedStatementHandler(executor, ms, parameter, rowBounds, resultHandler, boundSql);</span></code><code><span leaf="">            <span class="code-snippet__keyword">break</span>;</span></code><code><span leaf="">        <span class="code-snippet__keyword">case</span> CALLABLE:</span></code><code><span leaf="">            <span class="code-snippet__built_in">delegate</span> = <span class="code-snippet__keyword">new</span> CallableStatementHandler(executor, ms, parameter, rowBounds, resultHandler, boundSql);</span></code><code><span leaf="">            <span class="code-snippet__keyword">break</span>;</span></code><code><span leaf="">        <span class="code-snippet__literal">default</span>:</span></code><code><span leaf="">            <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> RuntimeException(<span class="code-snippet__string">"..."</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


而这些具体的 StatementHandler 的父类 

BaseStatementHandler

 在构造时会创建 ParameterHandler 和 ResultSetHandler


```
<code><span leaf=""><span class="code-snippet__comment">// BaseStatementHandler 构造方法</span></span></code><code><span leaf=""><span class="code-snippet__keyword">protected</span> BaseStatementHandler(Executor executor, MappedStatement ms, Object parameter, </span></code><code><span leaf="">                               RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// ...</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">this</span>.parameterHandler = configuration.newParameterHandler(ms, parameter, boundSql);</span></code><code><span leaf="">    <span class="code-snippet__keyword">this</span>.resultSetHandler = configuration.newResultSetHandler(executor, ms, rowBounds, parameterHandler, resultHandler, boundSql);</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code>
```


总结

：

对象

初始化时机

创建位置

Executor

openSession 时

Configuration.newExecutor()

StatementHandler

执行 SQL 时

Configuration.newStatementHandler()

ParameterHandler

创建 StatementHandler 时

Configuration.newParameterHandler()

ResultSetHandler

创建 StatementHandler 时

Configuration.newResultSetHandler()

六、一级缓存与 SqlSession 的绑定

一级缓存是 SqlSession 级别的，在 Executor 中实现。回顾 

BaseExecutor

：


```
<code><span leaf=""><span class="code-snippet__comment">// BaseExecutor</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">abstract</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">BaseExecutor</span> <span class="code-snippet__keyword">implements</span> <span class="code-snippet__title">Executor</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> <span class="code-snippet__title">PerpetualCache</span> localCache;      <span class="code-snippet__comment">// 一级缓存</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> <span class="code-snippet__title">PerpetualCache</span> localOutputParameterCache;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 查询时先从缓存取</span></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <E> <span class="code-snippet__title">List</span><E> <span class="code-snippet__title">query</span>(<span class="code-snippet__params"><span class="code-snippet__title">MappedStatement</span></span><span class="code-snippet__params"> ms, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameter, </span><span class="code-snippet__params"><span class="code-snippet__title">RowBounds</span></span><span class="code-snippet__params"> rowBounds, </span></span></code><code><span leaf="">                             <span class="code-snippet__title">ResultHandler</span> resultHandler, <span class="code-snippet__title">CacheKey</span> key, <span class="code-snippet__title">BoundSql</span> boundSql) {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 从 localCache 中获取</span></span></code><code><span leaf="">        <span class="code-snippet__title">List</span><E> list = resultHandler == <span class="code-snippet__literal">null</span> ? (<span class="code-snippet__title">List</span><E>) localCache.<span class="code-snippet__title">getObject</span>(key) : <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (list != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 缓存命中</span></span></code><code><span leaf="">            <span class="code-snippet__title">handleLocallyCachedOutputParameters</span>(ms, key, parameter, boundSql);</span></code><code><span leaf="">        } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 缓存未命中，从数据库查询</span></span></code><code><span leaf="">            list = <span class="code-snippet__title">queryFromDatabase</span>(ms, parameter, rowBounds, resultHandler, key, boundSql);</span></code><code><span leaf="">        }</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> list;</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


关键点

：

一级缓存的生命周期 = SqlSession 的生命周期

SqlSession 关闭时，一级缓存随之销毁

执行 update/insert/delete 会清空一级缓存

七、面试高频题

Q1：SqlSessionFactory 是线程安全的吗？SqlSession 呢？

A

：

SqlSessionFactory

是线程安全的，因为它只持有

Configuration

（不可变），多个线程可以共享同一个工厂。

SqlSession

不是线程安全的，每个线程应该有自己的 SqlSession，用完关闭。这也是为什么在 Web 应用中，通常一个请求对应一个 SqlSession。

Q2：openSession() 和不带参数的 openSession() 有什么区别？

A

：

openSession()

：不自动提交，需要手动 commit。

openSession(true)

：自动提交，每次 SQL 执行后自动 commit。

openSession(ExecutorType.BATCH)

：批量执行器，适合批量操作。

Q3：Executor 和 StatementHandler 的区别？

A

：

Executor

是执行器的顶级接口，负责管理一级缓存、事务、批量操作等

粗粒度

的逻辑。

StatementHandler

负责

细粒度

的 JDBC Statement 操作：创建 Statement、设置参数、执行 SQL、处理结果集。

Executor 内部调用 StatementHandler 完成具体的数据库操作。

Q4：DefaultSqlSession 里的 dirty 标志位有什么用？

A

：

dirty

表示自上次 commit/rollback 以来，是否执行过 insert/update/delete 等变更操作。在

close()

时，如果

dirty

为 true 且

autoCommit

为 false，则会自动回滚，防止未提交的变更被意外丢失。

Q5：SqlSession 的 close() 会不会把连接也关了？

A

：会。

close()

会调用

executor.close()

，最终关闭数据库连接（连接会归还给连接池）。这也是为什么每次用完 SqlSession 都要 close 的原因。

八、下篇预告

第 5 篇我们将深入

Executor 执行器三级架构

，详细拆解：

SimpleExecutor、ReuseExecutor、BatchExecutor 的实现差异

CachingExecutor 如何用装饰器模式包装二级缓存

执行器的创建与选择逻辑

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
