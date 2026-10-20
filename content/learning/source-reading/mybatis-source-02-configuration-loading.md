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
source: "微信公众号「狂热大猩猩的技术宅」"
source_url: "https://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484010&idx=1&sn=e247ecb5fd6ecfb56cc377337cdc5c05&chksm=c2b81035f5cf9923c3ea5158c50479c8d2cacbb7ae55a3e8fd1c1da8af150aec6c5cc997aeff"
published_at: "2026-06-04 18:30:00 +08:00"
---

# MyBatis 源码深度拆解（二）：核心配置加载原理

> 原作者：狂热大猩猩的技术宅 · 2026年6月4日 18:30
> [阅读微信原文](https://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484010&idx=1&sn=e247ecb5fd6ecfb56cc377337cdc5c05&chksm=c2b81035f5cf9923c3ea5158c50479c8d2cacbb7ae55a3e8fd1c1da8af150aec6c5cc997aeff)
> 原文排版恢复版：保留原作者内容与顺序，仅整理网页显示格式。

<p>面试官：MyBatis 是如何解析 <code>mybatis-config.xml</code> 的？<code>Configuration</code> 对象里到底存了些什么？</p>

<hr/>

<h2><strong>一、回顾与开头</strong></h2>

<p>第 1 篇我们建立了整体架构图，知道<code>SqlSessionFactoryBuilder</code>会读取配置文件并生成<code>Configuration</code>，今天我们就扎根在这一步。</p>

<p>先看一段最简单的启动代码：</p>

<ul><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">String resource = "mybatis-config.xml";
InputStream inputStream = Resources.getResourceAsStream(resource);
SqlSessionFactory sqlSessionFactory =
    new SqlSessionFactoryBuilder().build(inputStream);</code></pre>

<p>这 3 行代码背后，隐藏了 XML 解析、标签处理、注册映射器、构建配置对象等一系列复杂动作。今天我们把它完全拆开。所有源码基于mybatis 3.5.16版本</p>

<hr/>

<h2><strong>二、XML 解析的入口：XMLConfigBuilder</strong></h2>

<p><code>SqlSessionFactoryBuilder.build(inputStream)</code> 最终会调用到：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">// SqlSessionFactoryBuilder
public SqlSessionFactory build(InputStream inputStream, String environment, Properties properties) {
    XMLConfigBuilder parser = new XMLConfigBuilder(inputStream, environment, properties);
    // ⭐ 核心解析方法   parser.parse()
    return build(parser.parse());
}</code></pre>

<p><strong>两个关键角色</strong>：</p>

<ul><li><code>XMLConfigBuilder</code>：专门负责解析<code>mybatis-config.xml</code>的解析器，继承自<code>BaseBuilder</code>。</li><li><code>Configuration</code>：最终的配置载体，贯穿 MyBatis 整个生命周期。</li></ul>

<p>断点小贴士：直接在 <code>XMLConfigBuilder.parse()</code> 方法第一行打断点，然后 step into，就能走进整个解析世界。</p>

<h2><strong>三、parse() 方法：解析总控</strong></h2>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-cs">// XMLConfigBuilder
public Configuration parse() {
    if (parsed) {
        throw new BuilderException("Each XMLConfigBuilder can only be used once.");
    }
    parsed = true;
    // 解析 XML 的根节点 &lt;configuration&gt;
    parseConfiguration(parser.evalNode("/configuration"));
    return configuration;
}</code></pre>

<p><code>parser.evalNode("/configuration")</code> 返回一个 <code>XNode</code> 对象，它封装了 XML 节点以及一些 XPath 操作。<br/>然后进入 <code>parseConfiguration(XNode root)</code>：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">private void parseConfiguration(XNode root) {
    try {
        // 按照 DTD 定义顺序，逐个解析子标签
        // 1. properties
        propertiesElement(root.evalNode("properties"));
        // 2. settings
        Properties settings = settingsAsProperties(root.evalNode("settings"));
        loadCustomVfs(settings);
        loadCustomLogImpl(settings);
        // 3. typeAliases
        typeAliasesElement(root.evalNode("typeAliases"));
        // 4. plugins
        pluginElement(root.evalNode("plugins"));
        objectFactoryElement(root.evalNode("objectFactory"));
        objectWrapperFactoryElement(root.evalNode("objectWrapperFactory"));
        reflectorFactoryElement(root.evalNode("reflectorFactory"));
        // 5. 把 settings 值设置到 Configuration
        settingsElement(settings);
        // 6. environments
        environmentsElement(root.evalNode("environments"));
        databaseIdProviderElement(root.evalNode("databaseIdProvider"));
        // 7. typeHandlers
        typeHandlerElement(root.evalNode("typeHandlers"));
        // 8. mappers ⭐ 最复杂
        mapperElement(root.evalNode("mappers"));
    } catch (Exception e) {
        throw new BuilderException("Error parsing SQL Mapper Configuration. Cause: " + e, e);
    }
}</code></pre>

<p><strong>顺序必须与 DTD 一致</strong>，否则 MyBatis 会抛出解析异常 —— 这也是为什么我们在第一篇强调标签顺序的原因。</p>

<h2><strong>四、Configuration 核心数据结构</strong></h2>

<p>在逐步解析之前，我们先看一眼 <code>Configuration</code> 这个类里到底装着什么（字段非常多，捡重点的）：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">public class Configuration {
    // 环境（数据源、事务工厂）
    protected Environment environment;

    // 重要：所有 MappedStatement（每个 SQL 对应一个）
    protected final Map&lt;String, MappedStatement&gt; mappedStatements = new StrictMap&lt;&gt;("Mapped Statements collection");

    // 缓存：二级缓存 namespace -&gt; Cache
    protected final Map&lt;String, Cache&gt; caches = new StrictMap&lt;&gt;("Caches collection");

    // 结果映射
    protected final Map&lt;String, ResultMap&gt; resultMaps = new StrictMap&lt;&gt;("Result Maps collection");

    // 参数映射
    protected final Map&lt;String, ParameterMap&gt; parameterMaps = new StrictMap&lt;&gt;("Parameter Maps collection");

    // 全局设置 (settings 标签解析后的结果)
    protected boolean useGeneratedKeys = false;
    protected boolean mapUnderscoreToCamelCase = false;
    protected ExecutorType defaultExecutorType = ExecutorType.SIMPLE;
    // ... 还有几十个
}</code></pre>

<p><code>StrictMap</code>是 MyBatis 自定义的 Map，在 put 时对 key 是否重复做了严格校验（比如两个 Mapper 里有相同 id 的 statement 会报错）。</p>

<p>解析每个标签的目的，就是把 XML 里的信息填充到<code>Configuration</code>的这些字段中。</p>

<hr/>

<h2><strong>五、逐标签源码拆解</strong></h2>

<h3><strong>5.1 </strong><code><strong>&lt;properties&gt;</strong></code><strong>：外部化配置</strong></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">private void propertiesElement(XNode context) throws Exception {
    if (context != null) {
        // 收集标签内子标签 &lt;property name="key" value="value"/&gt;
        Properties defaults = context.getChildrenAsProperties();
        String resource = context.getStringAttribute("resource");
        String url = context.getStringAttribute("url");
        if (resource != null) {
            // 从类路径加载 .properties 文件
            defaults.putAll(Resources.getResourceAsProperties(resource));
        }
        if (url != null) {
            defaults.putAll(Resources.getUrlAsProperties(url));
        }
        Properties vars = configuration.getVariables();
        if (vars != null) {
          defaults.putAll(vars);
        }
        parser.setVariables(defaults);
        // 合并到 Configuration 的 variables 变量中
        configuration.setVariables(defaults);
    }
}</code></pre>

<p><strong>加载顺序：</strong>先加载、后覆盖。具体顺序为：</p>

<ol><li>首先读取<code>&lt;properties&gt;</code>标签体中的<code>&lt;property&gt;</code>；</li><li>然后读取<code>resource</code>/<code>url</code>属性指定的外部属性文件，覆盖同名属性；</li><li>最后读取<code>build()</code>方法传入的<code>Properties</code>，优先级最高，覆盖前面所有同名属性。</li></ol>

<p>例如：方法参数 <code>properties</code> 中的 <code>username</code> 会覆盖配置文件中任何同名的 <code>username</code> 定义。</p>

<h3><strong>5.2 </strong><code><strong>&lt;settings&gt;</strong></code><strong>：全局配置</strong></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">private Properties settingsAsProperties(XNode context) {
    if (context == null) return new Properties();
    Properties props = context.getChildrenAsProperties();
    // 校验每个属性名是否在 Configuration 中存在对应的 setter（反射校验）
    MetaClass metaConfig = MetaClass.forClass(Configuration.class, reflectorFactory);
    for (Object key : props.keySet()) {
        if (!metaConfig.hasSetter(String.valueOf(key))) {
            throw new BuilderException("The setting " + key + " is not known.  Make sure you spelled it correctly.");
        }
    }
    return props;
}</code></pre>

<p>解析后得到的 Properties 暂存，然后调用<code>settingsElement(Properties)</code>挨个设置到<code>Configuration</code>：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">private void settingsElement(Properties props) {
    configuration.setAutoMappingBehavior(AutoMappingBehavior.valueOf(props.getProperty("autoMappingBehavior", "PARTIAL")));
    configuration.setCacheEnabled(booleanValueOf(props.getProperty("cacheEnabled"), true));
    configuration.setLazyLoadingEnabled(booleanValueOf(props.getProperty("lazyLoadingEnabled"), false));
    configuration.setMapUnderscoreToCamelCase(booleanValueOf(props.getProperty("mapUnderscoreToCamelCase"), false));
    // ... 省略几十行
}</code></pre>

<h3><strong>5.3</strong><code><strong>&lt;typeAliases&gt;</strong></code><strong>：别名注册</strong></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">private void typeAliasesElement(XNode context) {
    if (context == null) {
      return;
    }
    for (XNode child : context.getChildren()) {
      if ("package".equals(child.getName())) {
        String typeAliasPackage = child.getStringAttribute("name");
        configuration.getTypeAliasRegistry().registerAliases(typeAliasPackage);
      } else {
        String alias = child.getStringAttribute("alias");
        String type = child.getStringAttribute("type");
        try {
          Class&lt;?&gt; clazz = Resources.classForName(type);
          if (alias == null) {
            typeAliasRegistry.registerAlias(clazz);
          } else {
            typeAliasRegistry.registerAlias(alias, clazz);
          }
        } catch (ClassNotFoundException e) {
          throw new BuilderException("Error registering typeAlias for '" + alias + "'. Cause: " + e, e);
        }
      }
    }
  }</code></pre>

<p><code>TypeAliasRegistry</code> 内部维护一个 <code>Map&lt;String, Class&lt;?&gt;&gt;</code>，用于存储别名到类对象的映射关系。后续在 Mapper XML 中写返回类型时，就可以用别名代替全限定类名。</p>

<h3><strong>5.4 </strong><code><strong>&lt;environments&gt;</strong></code><strong>：环境配置</strong></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">private void environmentsElement(XNode context) throws Exception {
    if (context == null) {
      return;
    }
    if (environment == null) {
      environment = context.getStringAttribute("default");
    }
    for (XNode child : context.getChildren()) {
      String id = child.getStringAttribute("id");
      // 关键点：通过 isSpecifiedEnvironment 方法，精准匹配最终选中的 environment
      if (isSpecifiedEnvironment(id)) {
        // 解析 &lt;transactionManager&gt;
        TransactionFactory txFactory = transactionManagerElement(child.evalNode("transactionManager"));
        // 解析 &lt;dataSource&gt;
        DataSourceFactory dsFactory = dataSourceElement(child.evalNode("dataSource"));
        DataSource dataSource = dsFactory.getDataSource();
        // 构建 Environment
        Environment.Builder environmentBuilder = new Environment.Builder(id).transactionFactory(txFactory)
            .dataSource(dataSource);
        configuration.setEnvironment(environmentBuilder.build());
        break;
      }
    }
  }</code></pre>

<p><code>Environment</code>对象保存了事务工厂和数据源，后续<code>SqlSessionFactory</code>创建<code>SqlSession</code>时要用到。</p>

<h3><strong>5.5 </strong><code><strong>&lt;mappers&gt;</strong></code><strong>：映射器注册（最关键）</strong></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">private void mappersElement(XNode context) throws Exception {
    if (context == null) {
      return;
    }
    for (XNode child : context.getChildren()) {
      if ("package".equals(child.getName())) {
        // 处理包扫描的方式
        String mapperPackage = child.getStringAttribute("name");
        configuration.addMappers(mapperPackage);
      } else {
        // 以下是处理单个 mapper 的三种方式
        String resource = child.getStringAttribute("resource");
        String url = child.getStringAttribute("url");
        String mapperClass = child.getStringAttribute("class");
        // 分支1: 通过 resource 指定 XML 文件
        if (resource != null &amp;&amp; url == null &amp;&amp; mapperClass == null) {
          ErrorContext.instance().resource(resource);
          try (InputStream inputStream = Resources.getResourceAsStream(resource)) {
            XMLMapperBuilder mapperParser = new XMLMapperBuilder(inputStream, configuration, resource,
                configuration.getSqlFragments());
            mapperParser.parse();
          }
        }
        // 分支2: 通过 url 指定 XML 文件
        else if (resource == null &amp;&amp; url != null &amp;&amp; mapperClass == null) {
          ErrorContext.instance().resource(url);
          try (InputStream inputStream = Resources.getUrlAsStream(url)) {
            XMLMapperBuilder mapperParser = new XMLMapperBuilder(inputStream, configuration, url,
                configuration.getSqlFragments());
            mapperParser.parse();
          }
        }
        // 分支3: 通过 class 属性指定 Mapper 接口类，这主要适用于纯注解的方式
        else if (resource == null &amp;&amp; url == null &amp;&amp; mapperClass != null) {
          Class&lt;?&gt; mapperInterface = Resources.classForName(mapperClass);
          configuration.addMapper(mapperInterface);
        } else {
          throw new BuilderException(
              "A mapper element may only specify a url, resource or class, but not more than one.");
        }
      }
    }
  }</code></pre>

<p><strong>两种映射器注册方式：</strong></p>

<ol><li><strong>包扫描（</strong><code><strong>&lt;package name="..."/&gt;</strong></code><strong>）</strong>：会递归扫描包下所有 Mapper 接口，对每个接口调用<code>configuration.addMapper()</code>。最终走到<code>MapperRegistry.addMapper()</code>，内部会为接口创建一个<code>MapperProxyFactory</code>并存入<code>knownMappers</code>，同时在解析过程中找到对应的 XML 映射文件进行处理。</li><li><strong>资源指定（</strong><code><strong>&lt;mapper resource="..."/&gt;</strong></code><strong>）</strong>：直接指定具体的 XML 映射文件，由<code>XMLMapperBuilder.parse()</code>解析，为每个 SQL 语句生成<code>MappedStatement</code>对象，存入<code>configuration.mappedStatements</code>中。</li></ol>

<p>理解这两种方式的联系与区别，有助于更灵活地配置 MyBatis 映射器扫描策略。</p>

<h2><strong>六、面试高频题</strong></h2>

<h3>Q1：MyBatis 解析配置文件时，如果标签顺序错了会怎样？</h3>

<p><strong>A</strong>：会抛出 <code>BuilderException</code>。原因在于 MyBatis 的配置文件遵循特定的 DTD 约束，规定了标签的严格顺序（如 <code>properties</code>, <code>settings</code>, <code>typeAliases</code>, <code>typeHandlers</code> 等标签必须按顺序出现）。如果不遵守这个顺序，XML 解析器在验证阶段就会失败并抛出异常</p>

<h3>Q2：<code>Configuration</code>中的<code>mappedStatements</code>为什么用<code>StrictMap</code>而不是普通<code>HashMap</code>？</h3>

<p><strong>A</strong>：<code>StrictMap</code>继承<code>HashMap</code>，在<code>put</code>时检查 key 是否已存在，如果存在且不允许覆盖则会报错，避免了 Mapper XML 中<code>id</code>重复导致的隐蔽错误。</p>

<h3>Q3：<code>XMLConfigBuilder</code>为什么要设计成只能<code>parse()</code>一次？</h3>

<p><strong>A</strong>：通过<code>parsed</code>布尔标志控制，防止重复解析同一个配置流导致重复注册、状态错乱。这种设计在框架内部很常见（如 Spring 的<code>AbstractBeanDefinitionReader</code>）。</p>

<h3>Q4：<code>&lt;package&gt;</code>扫描 Mapper 接口和<code>&lt;mapper resource="..."&gt;</code>的区别？</h3>

<p><strong>A</strong>：</p>

<ul><li><code><strong>&lt;package&gt;</strong></code><strong></strong><strong>包扫描</strong>：自动注册包下所有 Mapper 接口，MyBatis 会根据 Mapper 接口的全限定名自动查找对应路径下的 XML 文件（要求 XML 文件与接口同包同名或以注解方式定义 SQL）。适合需要批量注册 Mapper 的场景。</li><li><code><strong>&lt;mapper resource&gt;</strong></code><strong> 资源指定</strong>：精确指定单个 XML 映射文件，XML 文件可以放在任意符合类路径规则的位置，无需与 Mapper 接口同包。适合需要灵活管理 XML 文件位置或 XML 文件与接口分离存放的场景。</li></ul>

<hr/>

<h2><strong>七、下篇预告</strong></h2>

<p>第 3 篇我们会深入<strong>Mapper 接口动态代理底层</strong>，解答“为什么没有实现类也能调用方法”——<code>MapperProxy</code>如何将接口调用转换成<code>SqlSession</code>操作，以及<code>@MapperScan</code>在 Spring 中的注册流程。</p>

<p>如果觉得有帮助，欢迎<strong>点赞、在看、转发</strong>支持！</p>

<p>系列持续更新，关注不走丢 👇</p>

<br/>

<p></p>
