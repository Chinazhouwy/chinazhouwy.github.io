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
String resource = "mybatis-config.xml";
InputStream inputStream = Resources.getResourceAsStream(resource);
SqlSessionFactory sqlSessionFactory =
    new SqlSessionFactoryBuilder().build(inputStream);
```


这 3 行代码背后，隐藏了 XML 解析、标签处理、注册映射器、构建配置对象等一系列复杂动作。今天我们把它完全拆开。所有源码基于mybatis 3.5.16版本

二、XML 解析的入口：XMLConfigBuilder

SqlSessionFactoryBuilder.build(inputStream)

 最终会调用到：


```
// SqlSessionFactoryBuilder
public SqlSessionFactory build(InputStream inputStream, String environment, Properties properties) {
    XMLConfigBuilder parser = new XMLConfigBuilder(inputStream, environment, properties);
    // ⭐ 核心解析方法   parser.parse()
    return build(parser.parse());
}
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
// XMLConfigBuilder
public Configuration parse() {
    if (parsed) {
        throw new BuilderException("Each XMLConfigBuilder can only be used once.");
    }
    parsed = true;
    // 解析 XML 的根节点 <configuration>
    parseConfiguration(parser.evalNode("/configuration"));
    return configuration;
}
```


parser.evalNode("/configuration")

 返回一个 

XNode

 对象，它封装了 XML 节点以及一些 XPath 操作。

然后进入 

parseConfiguration(XNode root)

：


```
private void parseConfiguration(XNode root) {
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
}
```


顺序必须与 DTD 一致

，否则 MyBatis 会抛出解析异常 —— 这也是为什么我们在第一篇强调标签顺序的原因。

四、Configuration 核心数据结构

在逐步解析之前，我们先看一眼 

Configuration

 这个类里到底装着什么（字段非常多，捡重点的）：


```
public class Configuration {
    // 环境（数据源、事务工厂）
    protected Environment environment;

    // 重要：所有 MappedStatement（每个 SQL 对应一个）
    protected final Map<String, MappedStatement> mappedStatements = new StrictMap<>("Mapped Statements collection");

    // 缓存：二级缓存 namespace -> Cache
    protected final Map<String, Cache> caches = new StrictMap<>("Caches collection");

    // 结果映射
    protected final Map<String, ResultMap> resultMaps = new StrictMap<>("Result Maps collection");

    // 参数映射
    protected final Map<String, ParameterMap> parameterMaps = new StrictMap<>("Parameter Maps collection");

    // 全局设置 (settings 标签解析后的结果)
    protected boolean useGeneratedKeys = false;
    protected boolean mapUnderscoreToCamelCase = false;
    protected ExecutorType defaultExecutorType = ExecutorType.SIMPLE;
    // ... 还有几十个
}
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
private void propertiesElement(XNode context) throws Exception {
    if (context != null) {
        // 收集标签内子标签 <property name="key" value="value"/>
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
}
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
private Properties settingsAsProperties(XNode context) {
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
}
```


解析后得到的 Properties 暂存，然后调用

settingsElement(Properties)

挨个设置到

Configuration

：


```
private void settingsElement(Properties props) {
    configuration.setAutoMappingBehavior(AutoMappingBehavior.valueOf(props.getProperty("autoMappingBehavior", "PARTIAL")));
    configuration.setCacheEnabled(booleanValueOf(props.getProperty("cacheEnabled"), true));
    configuration.setLazyLoadingEnabled(booleanValueOf(props.getProperty("lazyLoadingEnabled"), false));
    configuration.setMapUnderscoreToCamelCase(booleanValueOf(props.getProperty("mapUnderscoreToCamelCase"), false));
    // ... 省略几十行
}
```


5.3

<typeAliases>

：别名注册


```
private void typeAliasesElement(XNode context) {
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
          Class<?> clazz = Resources.classForName(type);
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
  }
```


TypeAliasRegistry

 内部维护一个 

Map<String, Class<?>>

，用于存储别名到类对象的映射关系。后续在 Mapper XML 中写返回类型时，就可以用别名代替全限定类名。

5.4 

<environments>

：环境配置


```
private void environmentsElement(XNode context) throws Exception {
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
        // 解析 <transactionManager>
        TransactionFactory txFactory = transactionManagerElement(child.evalNode("transactionManager"));
        // 解析 <dataSource>
        DataSourceFactory dsFactory = dataSourceElement(child.evalNode("dataSource"));
        DataSource dataSource = dsFactory.getDataSource();
        // 构建 Environment
        Environment.Builder environmentBuilder = new Environment.Builder(id).transactionFactory(txFactory)
            .dataSource(dataSource);
        configuration.setEnvironment(environmentBuilder.build());
        break;
      }
    }
  }
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
private void mappersElement(XNode context) throws Exception {
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
        if (resource != null && url == null && mapperClass == null) {
          ErrorContext.instance().resource(resource);
          try (InputStream inputStream = Resources.getResourceAsStream(resource)) {
            XMLMapperBuilder mapperParser = new XMLMapperBuilder(inputStream, configuration, resource,
                configuration.getSqlFragments());
            mapperParser.parse();
          }
        }
        // 分支2: 通过 url 指定 XML 文件
        else if (resource == null && url != null && mapperClass == null) {
          ErrorContext.instance().resource(url);
          try (InputStream inputStream = Resources.getUrlAsStream(url)) {
            XMLMapperBuilder mapperParser = new XMLMapperBuilder(inputStream, configuration, url,
                configuration.getSqlFragments());
            mapperParser.parse();
          }
        }
        // 分支3: 通过 class 属性指定 Mapper 接口类，这主要适用于纯注解的方式
        else if (resource == null && url == null && mapperClass != null) {
          Class<?> mapperInterface = Resources.classForName(mapperClass);
          configuration.addMapper(mapperInterface);
        } else {
          throw new BuilderException(
              "A mapper element may only specify a url, resource or class, but not more than one.");
        }
      }
    }
  }
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
