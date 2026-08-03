---
title: "MyBatis 源码深度拆解（二）：核心配置加载原理"
date: "2026-06-04"
domain: "学习"
area: "Java 后端"
module: "MyBatis 源码拆解"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "面试官：MyBatis 是如何解析  mybatis-config.xml  的？ Configuration  对象里…"
tags:
  - "MyBatis"
  - "源码分析"
---

# MyBatis 源码深度拆解（二）：核心配置加载原理

> 来源：微信公众号（MyBatis 源码深度拆解系列）
> 链接：[http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484010&idx=1&sn=e247ecb5fd6ecfb56cc377337cdc5c05&chksm=c2b81035f5cf9923c3ea5158c50479c8d2cacbb7ae55a3e8fd1c1da8af150aec6c5cc997aeff](http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484010&idx=1&sn=e247ecb5fd6ecfb56cc377337cdc5c05&chksm=c2b81035f5cf9923c3ea5158c50479c8d2cacbb7ae55a3e8fd1c1da8af150aec6c5cc997aeff)
> 类型：📚 参考资料（非面试题/面经）—— MyBatis 源码深度拆解系列
> 相关：第196题(MyBatis 与 Spring 事务整合)、第247题(MyBatis 分页拦截器)
> 整理时间：2026-08-03

---

面试官：MyBatis 是如何解析 

mybatis-config.xml

 的？

Configuration

 对象里到底存了些什么？

一、回顾与开头

第 1 篇我们建立了整体架构图，知道

SqlSessionFactoryBuilder

会读取配置文件并生成

Configuration

，今天我们就扎根在这一步。

先看一段最简单的启动代码：


```
<code><span leaf=""><span class="code-snippet__type">String</span> <span class="code-snippet__variable">resource</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__string">"mybatis-config.xml"</span>;</span></code><code><span leaf=""><span class="code-snippet__type">InputStream</span> <span class="code-snippet__variable">inputStream</span> <span class="code-snippet__operator">=</span> Resources.getResourceAsStream(resource);</span></code><code><span leaf=""><span class="code-snippet__type">SqlSessionFactory</span> <span class="code-snippet__variable">sqlSessionFactory</span> <span class="code-snippet__operator">=</span> </span></code><code><span leaf="">    <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">SqlSessionFactoryBuilder</span>().build(inputStream);</span></code>
```


这 3 行代码背后，隐藏了 XML 解析、标签处理、注册映射器、构建配置对象等一系列复杂动作。今天我们把它完全拆开。所有源码基于mybatis 3.5.16版本

二、XML 解析的入口：XMLConfigBuilder

SqlSessionFactoryBuilder.build(inputStream)

 最终会调用到：


```
<code><span leaf=""><span class="code-snippet__comment">// SqlSessionFactoryBuilder</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">SqlSessionFactory</span> <span class="code-snippet__title">build</span>(<span class="code-snippet__params"><span class="code-snippet__title">InputStream</span></span><span class="code-snippet__params"> inputStream, </span><span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> environment, </span><span class="code-snippet__params"><span class="code-snippet__title">Properties</span></span><span class="code-snippet__params"> properties</span>) {</span></code><code><span leaf="">    <span class="code-snippet__title">XMLConfigBuilder</span> parser = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">XMLConfigBuilder</span>(inputStream, environment, properties);</span></code><code><span leaf="">    <span class="code-snippet__comment">// ⭐ 核心解析方法   parser.parse()</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">build</span>(parser.<span class="code-snippet__title">parse</span>());</span></code><code><span leaf="">}</span></code>
```


两个关键角色

：

XMLConfigBuilder

：专门负责解析

mybatis-config.xml

的解析器，继承自

BaseBuilder

。

Configuration

：最终的配置载体，贯穿 MyBatis 整个生命周期。

断点小贴士：直接在 

XMLConfigBuilder.parse()

 方法第一行打断点，然后 step into，就能走进整个解析世界。

三、parse() 方法：解析总控


```
<code><span leaf=""><span class="code-snippet__comment">// XMLConfigBuilder</span></span></code><code><span leaf=""><span class="code-snippet__function"><span class="code-snippet__keyword">public</span></span><span class="code-snippet__function"> Configuration </span><span class="code-snippet__function"><span class="code-snippet__title">parse</span></span><span class="code-snippet__function">()</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (parsed) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> BuilderException(<span class="code-snippet__string">"Each XMLConfigBuilder can only be used once."</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    parsed = <span class="code-snippet__literal">true</span>;</span></code><code><span leaf="">    <span class="code-snippet__comment">// 解析 XML 的根节点 <configuration></span></span></code><code><span leaf="">    parseConfiguration(parser.evalNode(<span class="code-snippet__string">"/configuration"</span>));</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> configuration;</span></code><code><span leaf="">}</span></code>
```


parser.evalNode("/configuration")

 返回一个 

XNode

 对象，它封装了 XML 节点以及一些 XPath 操作。

然后进入 

parseConfiguration(XNode root)

：


```
<code><span leaf=""><span class="code-snippet__keyword">private</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">parseConfiguration</span>(<span class="code-snippet__params"><span class="code-snippet__title">XNode</span></span><span class="code-snippet__params"> root</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 按照 DTD 定义顺序，逐个解析子标签</span></span></code><code><span leaf="">        <span class="code-snippet__comment">// 1. properties</span></span></code><code><span leaf="">        <span class="code-snippet__title">propertiesElement</span>(root.<span class="code-snippet__title">evalNode</span>(<span class="code-snippet__string">"properties"</span>));    </span></code><code><span leaf="">        <span class="code-snippet__comment">// 2. settings</span></span></code><code><span leaf="">        <span class="code-snippet__title">Properties</span> settings = <span class="code-snippet__title">settingsAsProperties</span>(root.<span class="code-snippet__title">evalNode</span>(<span class="code-snippet__string">"settings"</span>)); </span></code><code><span leaf="">        <span class="code-snippet__title">loadCustomVfs</span>(settings);</span></code><code><span leaf="">        <span class="code-snippet__title">loadCustomLogImpl</span>(settings);</span></code><code><span leaf="">        <span class="code-snippet__comment">// 3. typeAliases</span></span></code><code><span leaf="">        <span class="code-snippet__title">typeAliasesElement</span>(root.<span class="code-snippet__title">evalNode</span>(<span class="code-snippet__string">"typeAliases"</span>));  </span></code><code><span leaf="">        <span class="code-snippet__comment">// 4. plugins</span></span></code><code><span leaf="">        <span class="code-snippet__title">pluginElement</span>(root.<span class="code-snippet__title">evalNode</span>(<span class="code-snippet__string">"plugins"</span>));           </span></code><code><span leaf="">        <span class="code-snippet__title">objectFactoryElement</span>(root.<span class="code-snippet__title">evalNode</span>(<span class="code-snippet__string">"objectFactory"</span>));</span></code><code><span leaf="">        <span class="code-snippet__title">objectWrapperFactoryElement</span>(root.<span class="code-snippet__title">evalNode</span>(<span class="code-snippet__string">"objectWrapperFactory"</span>));</span></code><code><span leaf="">        <span class="code-snippet__title">reflectorFactoryElement</span>(root.<span class="code-snippet__title">evalNode</span>(<span class="code-snippet__string">"reflectorFactory"</span>));</span></code><code><span leaf="">        <span class="code-snippet__comment">// 5. 把 settings 值设置到 Configuration</span></span></code><code><span leaf="">        <span class="code-snippet__title">settingsElement</span>(settings);                         </span></code><code><span leaf="">        <span class="code-snippet__comment">// 6. environments</span></span></code><code><span leaf="">        <span class="code-snippet__title">environmentsElement</span>(root.<span class="code-snippet__title">evalNode</span>(<span class="code-snippet__string">"environments"</span>));</span></code><code><span leaf="">        <span class="code-snippet__title">databaseIdProviderElement</span>(root.<span class="code-snippet__title">evalNode</span>(<span class="code-snippet__string">"databaseIdProvider"</span>));</span></code><code><span leaf="">        <span class="code-snippet__comment">// 7. typeHandlers</span></span></code><code><span leaf="">        <span class="code-snippet__title">typeHandlerElement</span>(root.<span class="code-snippet__title">evalNode</span>(<span class="code-snippet__string">"typeHandlers"</span>)); </span></code><code><span leaf="">        <span class="code-snippet__comment">// 8. mappers ⭐ 最复杂</span></span></code><code><span leaf="">        <span class="code-snippet__title">mapperElement</span>(root.<span class="code-snippet__title">evalNode</span>(<span class="code-snippet__string">"mappers"</span>));           </span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">Exception</span> e) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">BuilderException</span>(<span class="code-snippet__string">"Error parsing SQL Mapper Configuration. Cause: "</span> + e, e);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


顺序必须与 DTD 一致

，否则 MyBatis 会抛出解析异常 —— 这也是为什么我们在第一篇强调标签顺序的原因。

四、Configuration 核心数据结构

在逐步解析之前，我们先看一眼 

Configuration

 这个类里到底装着什么（字段非常多，捡重点的）：


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">Configuration</span> {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 环境（数据源、事务工厂）</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> <span class="code-snippet__title">Environment</span> environment;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 重要：所有 MappedStatement（每个 SQL 对应一个）</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> final <span class="code-snippet__title">Map</span><<span class="code-snippet__title">String</span>, <span class="code-snippet__title">MappedStatement</span>> mappedStatements = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">StrictMap</span><>(<span class="code-snippet__string">"Mapped Statements collection"</span>);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 缓存：二级缓存 namespace -> Cache</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> final <span class="code-snippet__title">Map</span><<span class="code-snippet__title">String</span>, <span class="code-snippet__title">Cache</span>> caches = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">StrictMap</span><>(<span class="code-snippet__string">"Caches collection"</span>);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 结果映射</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> final <span class="code-snippet__title">Map</span><<span class="code-snippet__title">String</span>, <span class="code-snippet__title">ResultMap</span>> resultMaps = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">StrictMap</span><>(<span class="code-snippet__string">"Result Maps collection"</span>);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 参数映射</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> final <span class="code-snippet__title">Map</span><<span class="code-snippet__title">String</span>, <span class="code-snippet__title">ParameterMap</span>> parameterMaps = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">StrictMap</span><>(<span class="code-snippet__string">"Parameter Maps collection"</span>);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 全局设置 (settings 标签解析后的结果)</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> <span class="code-snippet__built_in">boolean</span> useGeneratedKeys = <span class="code-snippet__literal">false</span>;</span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> <span class="code-snippet__built_in">boolean</span> mapUnderscoreToCamelCase = <span class="code-snippet__literal">false</span>;</span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> <span class="code-snippet__title">ExecutorType</span> defaultExecutorType = <span class="code-snippet__title">ExecutorType</span>.<span class="code-snippet__property">SIMPLE</span>;</span></code><code><span leaf="">    <span class="code-snippet__comment">// ... 还有几十个</span></span></code><code><span leaf="">}</span></code>
```


StrictMap

是 MyBatis 自定义的 Map，在 put 时对 key 是否重复做了严格校验（比如两个 Mapper 里有相同 id 的 statement 会报错）。

解析每个标签的目的，就是把 XML 里的信息填充到

Configuration

的这些字段中。

五、逐标签源码拆解

5.1 

<properties>

：外部化配置


```
<code><span leaf=""><span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">void</span> <span class="code-snippet__title">propertiesElement</span><span class="code-snippet__params">(XNode context)</span> <span class="code-snippet__keyword">throws</span> Exception {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (context != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 收集标签内子标签 <property name="key" value="value"/></span></span></code><code><span leaf="">        <span class="code-snippet__type">Properties</span> <span class="code-snippet__variable">defaults</span> <span class="code-snippet__operator">=</span> context.getChildrenAsProperties();</span></code><code><span leaf="">        <span class="code-snippet__type">String</span> <span class="code-snippet__variable">resource</span> <span class="code-snippet__operator">=</span> context.getStringAttribute(<span class="code-snippet__string">"resource"</span>);</span></code><code><span leaf="">        <span class="code-snippet__type">String</span> <span class="code-snippet__variable">url</span> <span class="code-snippet__operator">=</span> context.getStringAttribute(<span class="code-snippet__string">"url"</span>);</span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (resource != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 从类路径加载 .properties 文件</span></span></code><code><span leaf="">            defaults.putAll(Resources.getResourceAsProperties(resource));</span></code><code><span leaf="">        }</span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (url != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">            defaults.putAll(Resources.getUrlAsProperties(url));</span></code><code><span leaf="">        }</span></code><code><span leaf="">        <span class="code-snippet__type">Properties</span> <span class="code-snippet__variable">vars</span> <span class="code-snippet__operator">=</span> configuration.getVariables();</span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (vars != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">          defaults.putAll(vars);</span></code><code><span leaf="">        }</span></code><code><span leaf="">        parser.setVariables(defaults);</span></code><code><span leaf="">        <span class="code-snippet__comment">// 合并到 Configuration 的 variables 变量中</span></span></code><code><span leaf="">        configuration.setVariables(defaults);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


加载顺序：

先加载、后覆盖。具体顺序为：

首先读取

<properties>

标签体中的

<property>

；

然后读取

resource

/

url

属性指定的外部属性文件，覆盖同名属性；

最后读取

build()

方法传入的

Properties

，优先级最高，覆盖前面所有同名属性。

例如：方法参数 

properties

 中的 

username

 会覆盖配置文件中任何同名的 

username

 定义。

5.2 

<settings>

：全局配置


```
<code><span leaf=""><span class="code-snippet__keyword">private</span> <span class="code-snippet__title">Properties</span> <span class="code-snippet__title">settingsAsProperties</span>(<span class="code-snippet__params"><span class="code-snippet__title">XNode</span></span><span class="code-snippet__params"> context</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (context == <span class="code-snippet__literal">null</span>) <span class="code-snippet__keyword">return</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">Properties</span>();</span></code><code><span leaf="">    <span class="code-snippet__title">Properties</span> props = context.<span class="code-snippet__title">getChildrenAsProperties</span>();</span></code><code><span leaf="">    <span class="code-snippet__comment">// 校验每个属性名是否在 Configuration 中存在对应的 setter（反射校验）</span></span></code><code><span leaf="">    <span class="code-snippet__title">MetaClass</span> metaConfig = <span class="code-snippet__title">MetaClass</span>.<span class="code-snippet__title">forClass</span>(<span class="code-snippet__title">Configuration</span>.<span class="code-snippet__property">class</span>, reflectorFactory);</span></code><code><span leaf="">    <span class="code-snippet__keyword">for</span> (<span class="code-snippet__title">Object</span> key : props.<span class="code-snippet__title">keySet</span>()) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (!metaConfig.<span class="code-snippet__title">hasSetter</span>(<span class="code-snippet__title">String</span>.<span class="code-snippet__title">valueOf</span>(key))) {</span></code><code><span leaf="">            <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">BuilderException</span>(<span class="code-snippet__string">"The setting "</span> + key + <span class="code-snippet__string">" is not known.  Make sure you spelled it correctly."</span>);</span></code><code><span leaf="">        }</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> props;</span></code><code><span leaf="">}</span></code>
```


解析后得到的 Properties 暂存，然后调用

settingsElement(Properties)

挨个设置到

Configuration

：


```
<code><span leaf=""><span class="code-snippet__keyword">private</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">settingsElement</span>(<span class="code-snippet__params"><span class="code-snippet__title">Properties</span></span><span class="code-snippet__params"> props</span>) {</span></code><code><span leaf="">    configuration.<span class="code-snippet__title">setAutoMappingBehavior</span>(<span class="code-snippet__title">AutoMappingBehavior</span>.<span class="code-snippet__title">valueOf</span>(props.<span class="code-snippet__title">getProperty</span>(<span class="code-snippet__string">"autoMappingBehavior"</span>, <span class="code-snippet__string">"PARTIAL"</span>)));</span></code><code><span leaf="">    configuration.<span class="code-snippet__title">setCacheEnabled</span>(<span class="code-snippet__title">booleanValueOf</span>(props.<span class="code-snippet__title">getProperty</span>(<span class="code-snippet__string">"cacheEnabled"</span>), <span class="code-snippet__literal">true</span>));</span></code><code><span leaf="">    configuration.<span class="code-snippet__title">setLazyLoadingEnabled</span>(<span class="code-snippet__title">booleanValueOf</span>(props.<span class="code-snippet__title">getProperty</span>(<span class="code-snippet__string">"lazyLoadingEnabled"</span>), <span class="code-snippet__literal">false</span>));</span></code><code><span leaf="">    configuration.<span class="code-snippet__title">setMapUnderscoreToCamelCase</span>(<span class="code-snippet__title">booleanValueOf</span>(props.<span class="code-snippet__title">getProperty</span>(<span class="code-snippet__string">"mapUnderscoreToCamelCase"</span>), <span class="code-snippet__literal">false</span>));</span></code><code><span leaf="">    <span class="code-snippet__comment">// ... 省略几十行</span></span></code><code><span leaf="">}</span></code>
```


5.3

<typeAliases>

：别名注册


```
<code><span leaf=""><span class="code-snippet__keyword">private</span> <span class="code-snippet__built_in">void</span> <span class="code-snippet__title">typeAliasesElement</span>(<span class="code-snippet__params"><span class="code-snippet__title">XNode</span></span><span class="code-snippet__params"> context</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (context == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">      <span class="code-snippet__keyword">return</span>;</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">for</span> (<span class="code-snippet__title">XNode</span> child : context.<span class="code-snippet__title">getChildren</span>()) {</span></code><code><span leaf="">      <span class="code-snippet__keyword">if</span> (<span class="code-snippet__string">"package"</span>.<span class="code-snippet__title">equals</span>(child.<span class="code-snippet__title">getName</span>())) {</span></code><code><span leaf="">        <span class="code-snippet__title">String</span> typeAliasPackage = child.<span class="code-snippet__title">getStringAttribute</span>(<span class="code-snippet__string">"name"</span>);</span></code><code><span leaf="">        configuration.<span class="code-snippet__title">getTypeAliasRegistry</span>().<span class="code-snippet__title">registerAliases</span>(typeAliasPackage);</span></code><code><span leaf="">      } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">        <span class="code-snippet__title">String</span> alias = child.<span class="code-snippet__title">getStringAttribute</span>(<span class="code-snippet__string">"alias"</span>);</span></code><code><span leaf="">        <span class="code-snippet__title">String</span> <span class="code-snippet__keyword">type</span> = child.<span class="code-snippet__title">getStringAttribute</span>(<span class="code-snippet__string">"type"</span>);</span></code><code><span leaf="">        <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">          <span class="code-snippet__title">Class</span><?> clazz = <span class="code-snippet__title">Resources</span>.<span class="code-snippet__title">classForName</span>(<span class="code-snippet__keyword">type</span>);</span></code><code><span leaf="">          <span class="code-snippet__keyword">if</span> (alias == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">            typeAliasRegistry.<span class="code-snippet__title">registerAlias</span>(clazz);</span></code><code><span leaf="">          } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">            typeAliasRegistry.<span class="code-snippet__title">registerAlias</span>(alias, clazz);</span></code><code><span leaf="">          }</span></code><code><span leaf="">        } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">ClassNotFoundException</span> e) {</span></code><code><span leaf="">          <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">BuilderException</span>(<span class="code-snippet__string">"Error registering typeAlias for '"</span> + alias + <span class="code-snippet__string">"'. Cause: "</span> + e, e);</span></code><code><span leaf="">        }</span></code><code><span leaf="">      }</span></code><code><span leaf="">    }</span></code><code><span leaf="">  }</span></code>
```


TypeAliasRegistry

 内部维护一个 

Map<String, Class<?>>

，用于存储别名到类对象的映射关系。后续在 Mapper XML 中写返回类型时，就可以用别名代替全限定类名。

5.4 

<environments>

：环境配置


```
<code><span leaf=""><span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">void</span> <span class="code-snippet__title">environmentsElement</span><span class="code-snippet__params">(XNode context)</span> <span class="code-snippet__keyword">throws</span> Exception {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (context == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">      <span class="code-snippet__keyword">return</span>;</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (environment == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">      environment = context.getStringAttribute(<span class="code-snippet__string">"default"</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">for</span> (XNode child : context.getChildren()) {</span></code><code><span leaf="">      <span class="code-snippet__type">String</span> <span class="code-snippet__variable">id</span> <span class="code-snippet__operator">=</span> child.getStringAttribute(<span class="code-snippet__string">"id"</span>);</span></code><code><span leaf="">      <span class="code-snippet__comment">// 关键点：通过 isSpecifiedEnvironment 方法，精准匹配最终选中的 environment</span></span></code><code><span leaf="">      <span class="code-snippet__keyword">if</span> (isSpecifiedEnvironment(id)) {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 解析 <transactionManager></span></span></code><code><span leaf="">        <span class="code-snippet__type">TransactionFactory</span> <span class="code-snippet__variable">txFactory</span> <span class="code-snippet__operator">=</span> transactionManagerElement(child.evalNode(<span class="code-snippet__string">"transactionManager"</span>));</span></code><code><span leaf="">        <span class="code-snippet__comment">// 解析 <dataSource></span></span></code><code><span leaf="">        <span class="code-snippet__type">DataSourceFactory</span> <span class="code-snippet__variable">dsFactory</span> <span class="code-snippet__operator">=</span> dataSourceElement(child.evalNode(<span class="code-snippet__string">"dataSource"</span>));</span></code><code><span leaf="">        <span class="code-snippet__type">DataSource</span> <span class="code-snippet__variable">dataSource</span> <span class="code-snippet__operator">=</span> dsFactory.getDataSource();</span></code><code><span leaf="">        <span class="code-snippet__comment">// 构建 Environment</span></span></code><code><span leaf="">        Environment.<span class="code-snippet__type">Builder</span> <span class="code-snippet__variable">environmentBuilder</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">Environment</span>.Builder(id).transactionFactory(txFactory)</span></code><code><span leaf="">            .dataSource(dataSource);</span></code><code><span leaf="">        configuration.setEnvironment(environmentBuilder.build());</span></code><code><span leaf="">        <span class="code-snippet__keyword">break</span>;</span></code><code><span leaf="">      }</span></code><code><span leaf="">    }</span></code><code><span leaf="">  }</span></code>
```


Environment

对象保存了事务工厂和数据源，后续

SqlSessionFactory

创建

SqlSession

时要用到。

5.5 

<mappers>

：映射器注册（最关键）


```
<code><span leaf=""><span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">void</span> <span class="code-snippet__title">mappersElement</span><span class="code-snippet__params">(XNode context)</span> <span class="code-snippet__keyword">throws</span> Exception {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (context == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">      <span class="code-snippet__keyword">return</span>;</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">for</span> (XNode child : context.getChildren()) {</span></code><code><span leaf="">      <span class="code-snippet__keyword">if</span> (<span class="code-snippet__string">"package"</span>.equals(child.getName())) {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 处理包扫描的方式</span></span></code><code><span leaf="">        <span class="code-snippet__type">String</span> <span class="code-snippet__variable">mapperPackage</span> <span class="code-snippet__operator">=</span> child.getStringAttribute(<span class="code-snippet__string">"name"</span>);</span></code><code><span leaf="">        configuration.addMappers(mapperPackage);</span></code><code><span leaf="">      } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 以下是处理单个 mapper 的三种方式</span></span></code><code><span leaf="">        <span class="code-snippet__type">String</span> <span class="code-snippet__variable">resource</span> <span class="code-snippet__operator">=</span> child.getStringAttribute(<span class="code-snippet__string">"resource"</span>);</span></code><code><span leaf="">        <span class="code-snippet__type">String</span> <span class="code-snippet__variable">url</span> <span class="code-snippet__operator">=</span> child.getStringAttribute(<span class="code-snippet__string">"url"</span>);</span></code><code><span leaf="">        <span class="code-snippet__type">String</span> <span class="code-snippet__variable">mapperClass</span> <span class="code-snippet__operator">=</span> child.getStringAttribute(<span class="code-snippet__string">"class"</span>);</span></code><code><span leaf="">        <span class="code-snippet__comment">// 分支1: 通过 resource 指定 XML 文件</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (resource != <span class="code-snippet__literal">null</span> && url == <span class="code-snippet__literal">null</span> && mapperClass == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">          ErrorContext.instance().resource(resource);</span></code><code><span leaf="">          <span class="code-snippet__keyword">try</span> (<span class="code-snippet__type">InputStream</span> <span class="code-snippet__variable">inputStream</span> <span class="code-snippet__operator">=</span> Resources.getResourceAsStream(resource)) {</span></code><code><span leaf="">            <span class="code-snippet__type">XMLMapperBuilder</span> <span class="code-snippet__variable">mapperParser</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">XMLMapperBuilder</span>(inputStream, configuration, resource,</span></code><code><span leaf="">                configuration.getSqlFragments());</span></code><code><span leaf="">            mapperParser.parse();</span></code><code><span leaf="">          }</span></code><code><span leaf="">        }</span></code><code><span leaf="">        <span class="code-snippet__comment">// 分支2: 通过 url 指定 XML 文件</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">else</span> <span class="code-snippet__keyword">if</span> (resource == <span class="code-snippet__literal">null</span> && url != <span class="code-snippet__literal">null</span> && mapperClass == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">          ErrorContext.instance().resource(url);</span></code><code><span leaf="">          <span class="code-snippet__keyword">try</span> (<span class="code-snippet__type">InputStream</span> <span class="code-snippet__variable">inputStream</span> <span class="code-snippet__operator">=</span> Resources.getUrlAsStream(url)) {</span></code><code><span leaf="">            <span class="code-snippet__type">XMLMapperBuilder</span> <span class="code-snippet__variable">mapperParser</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">XMLMapperBuilder</span>(inputStream, configuration, url,</span></code><code><span leaf="">                configuration.getSqlFragments());</span></code><code><span leaf="">            mapperParser.parse();</span></code><code><span leaf="">          }</span></code><code><span leaf="">        }</span></code><code><span leaf="">        <span class="code-snippet__comment">// 分支3: 通过 class 属性指定 Mapper 接口类，这主要适用于纯注解的方式</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">else</span> <span class="code-snippet__keyword">if</span> (resource == <span class="code-snippet__literal">null</span> && url == <span class="code-snippet__literal">null</span> && mapperClass != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">          Class<?> mapperInterface = Resources.classForName(mapperClass);</span></code><code><span leaf="">          configuration.addMapper(mapperInterface);</span></code><code><span leaf="">        } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">          <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">BuilderException</span>(</span></code><code><span leaf="">              <span class="code-snippet__string">"A mapper element may only specify a url, resource or class, but not more than one."</span>);</span></code><code><span leaf="">        }</span></code><code><span leaf="">      }</span></code><code><span leaf="">    }</span></code><code><span leaf="">  }</span></code>
```


两种映射器注册方式：

包扫描（

<package name="..."/>

）

：会递归扫描包下所有 Mapper 接口，对每个接口调用

configuration.addMapper()

。最终走到

MapperRegistry.addMapper()

，内部会为接口创建一个

MapperProxyFactory

并存入

knownMappers

，同时在解析过程中找到对应的 XML 映射文件进行处理。

资源指定（

<mapper resource="..."/>

）

：直接指定具体的 XML 映射文件，由

XMLMapperBuilder.parse()

解析，为每个 SQL 语句生成

MappedStatement

对象，存入

configuration.mappedStatements

中。

理解这两种方式的联系与区别，有助于更灵活地配置 MyBatis 映射器扫描策略。

六、面试高频题

Q1：MyBatis 解析配置文件时，如果标签顺序错了会怎样？

A

：会抛出 

BuilderException

。原因在于 MyBatis 的配置文件遵循特定的 DTD 约束，规定了标签的严格顺序（如 

properties

, 

settings

, 

typeAliases

, 

typeHandlers

 等标签必须按顺序出现）。如果不遵守这个顺序，XML 解析器在验证阶段就会失败并抛出异常

Q2：

Configuration

中的

mappedStatements

为什么用

StrictMap

而不是普通

HashMap

？

A

：

StrictMap

继承

HashMap

，在

put

时检查 key 是否已存在，如果存在且不允许覆盖则会报错，避免了 Mapper XML 中

id

重复导致的隐蔽错误。

Q3：

XMLConfigBuilder

为什么要设计成只能

parse()

一次？

A

：通过

parsed

布尔标志控制，防止重复解析同一个配置流导致重复注册、状态错乱。这种设计在框架内部很常见（如 Spring 的

AbstractBeanDefinitionReader

）。

Q4：

<package>

扫描 Mapper 接口和

<mapper resource="...">

的区别？

A

：

<package>

包扫描

：自动注册包下所有 Mapper 接口，MyBatis 会根据 Mapper 接口的全限定名自动查找对应路径下的 XML 文件（要求 XML 文件与接口同包同名或以注解方式定义 SQL）。适合需要批量注册 Mapper 的场景。

<mapper resource>

 资源指定

：精确指定单个 XML 映射文件，XML 文件可以放在任意符合类路径规则的位置，无需与 Mapper 接口同包。适合需要灵活管理 XML 文件位置或 XML 文件与接口分离存放的场景。

七、下篇预告

第 3 篇我们会深入

Mapper 接口动态代理底层

，解答“为什么没有实现类也能调用方法”——

MapperProxy

如何将接口调用转换成

SqlSession

操作，以及

@MapperScan

在 Spring 中的注册流程。

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
