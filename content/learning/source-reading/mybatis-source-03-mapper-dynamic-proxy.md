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
source: "微信公众号「狂热大猩猩的技术宅」"
source_url: "https://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484015&idx=1&sn=36d33b759a3b1515a22aaac91862d1a4&chksm=c2b81030f5cf9926a3848cc3a03aebd6f9c020ca1169754095bab662bddbbbd8658735c83c6f"
published_at: "2026-06-14 21:24:00 +08:00"
---

# MyBatis 源码深度拆解（三）：Mapper 接口动态代理底层原理

> 原作者：狂热大猩猩的技术宅 · 2026年6月14日 21:24
> [阅读微信原文](https://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484015&idx=1&sn=36d33b759a3b1515a22aaac91862d1a4&chksm=c2b81030f5cf9926a3848cc3a03aebd6f9c020ca1169754095bab662bddbbbd8658735c83c6f)
> 原文排版恢复版：保留原作者内容与顺序，仅整理网页显示格式。

<p><strong>写在最前面 版本说明</strong><br/>本文主要基于 <strong>MyBatis 3.5.10</strong> 和 <strong>mybatis-spring 3.0.3</strong> 源码进行分析。不同小版本可能在缓存实现、default 方法处理等方面存在差异，建议读者以自己实际使用的版本源码为准。</p>

<h2><strong>一、从一道面试题说起</strong></h2>

<p>很多初学者都会问：<strong>我明明只定义了一个</strong><strong></strong><code><strong>UserMapper</strong></code><strong></strong><strong>接口，并没有写实现类，为什么 MyBatis 能帮我执行 SQL？</strong></p>

<p>答案：<strong>JDK 动态代理</strong>。MyBatis 在运行时为你的接口生成了一个代理对象，所有的方法调用都会被这个代理对象拦截，然后转发给<code>SqlSession</code>去执行。</p>

<p>今天我们就从源码角度，把代理对象的<strong>创建过程</strong>和<strong>调用过程</strong>完整拆解一遍。</p>

<h2><strong>二、代理对象的创建时机</strong></h2>

<h3><strong>2.1 入口：</strong><code><strong>session.getMapper(UserMapper.class)</strong></code></h3>

<p>我们通常这样获取 Mapper：</p>

<ul><li></li></ul>

<pre><code class="language-cs">UserMapper mapper = session.getMapper(UserMapper.class);</code></pre>

<p>这个 <code>session</code> 实际是 <code>DefaultSqlSession</code>，我们跟进去：</p>

<ul><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">@Override
public &lt;T&gt; T getMapper(Class&lt;T&gt; type) {
    return configuration.getMapper(type, this);
}</code></pre>

<p>继续：</p>

<ul><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">// Configuration
public &lt;T&gt; T getMapper(Class&lt;T&gt; type, SqlSession sqlSession) {
    return mapperRegistry.getMapper(type, sqlSession);
}</code></pre>

<p><code>mapperRegistry</code>是<code>MapperRegistry</code>类型，它是<code>Configuration</code>中专门管理 Mapper 接口与代理工厂的注册表。</p>

<h3><strong>2.2 </strong><code><strong>MapperRegistry.getMapper()</strong></code></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">public &lt;T&gt; T getMapper(Class&lt;T&gt; type, SqlSession sqlSession) {
    // 从 knownMappers 中获取该接口对应的 MapperProxyFactory
    final MapperProxyFactory&lt;T&gt; mapperProxyFactory = (MapperProxyFactory&lt;T&gt;) knownMappers.get(type);
    if (mapperProxyFactory == null) {
        throw new BindingException("Type " + type + " is not known to the MapperRegistry.");
    }
    try {
        // 通过工厂创建代理实例
        return mapperProxyFactory.newInstance(sqlSession);
    } catch (Exception e) {
        throw new BindingException("Error getting mapper instance. Cause: " + e, e);
    }
}</code></pre>

<p><strong>关键点</strong>：</p>

<ul><li><code>knownMappers</code>是一个<code>Map&lt;Class&lt;?&gt;, MapperProxyFactory&lt;?&gt;&gt;</code>，在解析配置文件或包扫描时就已经填充好了。</li><li>每个 Mapper 接口对应一个<code>MapperProxyFactory</code>，专门用来生成该接口的代理对象。</li></ul>

<h3><strong>2.3 </strong><code><strong>MapperProxyFactory.newInstance()</strong></code></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">public T newInstance(SqlSession sqlSession) {
    // 创建 MapperProxy，它实现了 InvocationHandler
    final MapperProxy&lt;T&gt; mapperProxy = new MapperProxy&lt;&gt;(sqlSession, mapperInterface, methodCache);
    return newInstance(mapperProxy);
}

protected T newInstance(MapperProxy&lt;T&gt; mapperProxy) {
    // 使用 JDK 动态代理生成代理对象
    return (T) Proxy.newProxyInstance(mapperInterface.getClassLoader(),
                                      new Class[] { mapperInterface },
                                      mapperProxy);
}</code></pre>

<p>到这里，代理对象就诞生了。</p>

<p><strong>核心三要素</strong>：</p>

<ul><li><strong>类加载器</strong>：<code>mapperInterface.getClassLoader()</code></li><li><strong>要代理的接口数组</strong>：<code>new Class[] { mapperInterface }</code></li><li><strong>InvocationHandler</strong>：<code>mapperProxy</code>，当代理对象的方法被调用时，会进入它的 <code>invoke</code> 方法。</li></ul>

<h2><strong>三、代理对象的方法调用链路</strong></h2>

<p>当调用<code>userMapper.selectById(1)</code>时，实际上进入的是<code>MapperProxy.invoke()</code>。</p>

<h3><strong>3.1 </strong><code><strong>MapperProxy.invoke()</strong></code></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-perl">@Override
public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    try {
        // 如果是 Object 类的方法（如 toString、hashCode），直接调用，不拦截
        if (Object.class.equals(method.getDeclaringClass())) {
            return method.invoke(this, args);
        }
        // 缓存或新建 MapperMethod，然后执行
        return cachedInvoker(method).invoke(proxy, method, args, sqlSession);
    } catch (Throwable t) {
        throw ExceptionUtil.unwrapThrowable(t);
    }
}</code></pre>

<p>这里出现了 <code>MapperMethod</code>，它是真正干活的类。</p>

<h3><strong>3.2</strong><code><strong>cachedInvoker(method)</strong></code><strong>与</strong><code><strong>MapperMethod</strong></code></h3>

<p><code>cachedInvoker</code>会从<code>methodCache</code>（一个<code>ConcurrentHashMap&lt;Method, MapperMethodInvoker&gt;</code>）中获取或创建<code><strong>MapperMethodInvoker</strong></code>。<code>MapperMethodInvoker</code>是 MyBatis 内部定义的函数式接口，有两个实现类：</p>

<ul><li><code>PlainMethodInvoker</code>：内部持有<code>MapperMethod</code>对象，负责普通接口方法的 SQL 执行；</li><li><code>DefaultMethodInvoker</code>：直接调用接口中的<code>default</code>方法（Java 8+）。</li></ul>

<p>每次方法调用时，<code>methodCache</code> 缓存的是 <code>MapperMethodInvoker</code>，而 <code>MapperMethod</code> 只是 <code>PlainMethodInvoker</code> 的一个成员变量。</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-perl">private MapperMethodInvoker cachedInvoker(Method method) throws Throwable {
    try {
      return MapUtil.computeIfAbsent(methodCache, method, m -&gt; {
        if (!m.isDefault()) {
          return new PlainMethodInvoker(new MapperMethod(mapperInterface, method, sqlSession.getConfiguration()));
        }
        try {
          if (privateLookupInMethod == null) {
            return new DefaultMethodInvoker(getMethodHandleJava8(method));
          }
          return new DefaultMethodInvoker(getMethodHandleJava9(method));
        } catch (IllegalAccessException | InstantiationException | InvocationTargetException
            | NoSuchMethodException e) {
          throw new RuntimeException(e);
        }
      });
    } catch (RuntimeException re) {
      Throwable cause = re.getCause();
      throw cause == null ? re : cause;
    }
  }</code></pre>

<p><code>MapperMethod</code>构造时会解析：</p>

<ul><li>方法名（对应 Mapper XML 中的 id）</li><li>方法的返回类型（是单对象还是集合？）</li><li>方法的参数信息（是否使用<code>@Param</code>等）</li></ul>

<p><code>MapperMethod</code> 中有两个核心字段：</p>

<ul><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-perl">public class MapperMethod {
    private final SqlCommand command;   // 封装 SQL 的类型(SELECT/INSERT/UPDATE/DELETE)和 MappedStatement 的 id
    private final MethodSignature method; // 封装方法的签名信息（返回类型、参数等）
}</code></pre>

<h3><strong>3.3</strong><code><strong>MapperMethod.execute()</strong></code></h3>

<p>PlainMethodInvoker.invoke()</p>

<p>最终会调用mapperMethod.execute(sqlSession, args)：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-cs">public Object execute(SqlSession sqlSession, Object[] args) {
    Object result;
    switch (command.getType()) {
        case INSERT:
            // 处理 insert
            break;
        case UPDATE:
            // 处理 update
            break;
        case DELETE:
            // 处理 delete
            break;
        case SELECT:
            // 根据返回类型，调用 sqlSession 的不同方法
            if (method.returnsVoid() &amp;&amp; method.hasResultHandler()) {
                executeWithResultHandler(sqlSession, args);
                result = null;
            } else if (method.returnsMany()) {
                result = executeForMany(sqlSession, args);
            } else if (method.returnsMap()) {
                result = executeForMap(sqlSession, args);
            } else if (method.returnsCursor()) {
                result = executeForCursor(sqlSession, args);
            } else {
                // 返回单个对象
                Object param = method.convertArgsToSqlCommandParam(args);
                result = sqlSession.selectOne(command.getName(), param);
            }
            break;
        case FLUSH:
            result = sqlSession.flushStatements();
            break;
        default:
            throw new BindingException("Unknown execution method...");
    }
    return result;
}</code></pre>

<p>最终，我们看到了我们熟悉的方法：<code>sqlSession.selectOne()</code> 或 <code>selectList()</code>，后面的流程就回到了第一篇中讲过的 <code>Executor</code> → <code>StatementHandler</code> → JDBC。</p>

<h2><strong>四、</strong><code><strong>@MapperScan</strong></code><strong>底</strong>层注册流程（Spring 集成）</h2>

<h3><strong>4.1 整体设计理念：延迟扫描</strong></h3>

<p><code>@MapperScan</code> 的设计理念是 <strong>延迟扫描 + 职责分离</strong>：</p>

<table><tbody><tr><td><p>角色</p></td><td><p>实现类</p></td><td><p>核心职责</p></td></tr><tr><td><p><strong>触发者</strong></p></td><td><p><code>@MapperScan</code> 注解</p></td><td><p>声明扫描范围，通过<code>@Import导入 Registrar</code></p></td></tr><tr><td><p><strong>定义注册者</strong></p></td><td><p><code>MapperScannerRegistrar</code></p></td><td><p>注册<code>MapperScannerConfigurer</code></p><p>的 BeanDefinition</p></td></tr><tr><td><p><strong>扫描执行者</strong></p></td><td><p><code>MapperScannerConfigurer</code></p></td><td><p>实现<code>BeanDefinitionRegistryPostProcessor</code></p><p>，在 Spring 生命周期中触发扫描</p></td></tr><tr><td><p><strong>核心扫描器</strong></p></td><td><p><code>ClassPathMapperScanner</code></p></td><td><p>执行真正的包扫描和 BeanDefinition 转换</p></td></tr></tbody></table>

<h3><strong>4.2 阶段一：MapperScannerRegistrar — 注册扫描器定义</strong></h3>

<p><code>@MapperScan</code> 注解通过 <code>@Import</code> 导入了 <code>MapperScannerRegistrar</code>：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Import(MapperScannerRegistrar.class)  // 关键：导入了一个 Registrar
public @interface MapperScan {
    String[] value() default {};
    String[] basePackages() default {};
    // ...
}</code></pre>

<p><code>MapperScannerRegistrar</code> 实现了 <code>ImportBeanDefinitionRegistrar</code> 接口，Spring 启动时会调用其 <code>registerBeanDefinitions</code> 方法：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">@Override
public void registerBeanDefinitions(AnnotationMetadata importingClassMetadata,
                                    BeanDefinitionRegistry registry) {
    // 1. 获取 @MapperScan 注解的所有属性
    AnnotationAttributes mapperScanAttrs = AnnotationAttributes.fromMap(
        importingClassMetadata.getAnnotationAttributes(MapperScan.class.getName()));

    if (mapperScanAttrs != null) {
        // 2. 调用重载方法，传入生成的基名
        this.registerBeanDefinitions(importingClassMetadata, mapperScanAttrs, registry,
                                     generateBaseBeanName(importingClassMetadata, 0));
    }
}

private void registerBeanDefinitions(AnnotationMetadata importingClassMetadata,
                                     AnnotationAttributes mapperScanAttrs,
                                     BeanDefinitionRegistry registry, String beanName) {
    // 3. 创建 MapperScannerConfigurer 的 BeanDefinitionBuilder
    BeanDefinitionBuilder builder = BeanDefinitionBuilder
        .genericBeanDefinition(MapperScannerConfigurer.class);

    // 4. 设置 basePackage（扫描路径）
    builder.addPropertyValue("basePackage",
        StringUtils.collectionToCommaDelimitedString(basePackages));

    // 5. 其他属性设置（sqlSessionFactoryBeanName、annotationClass 等）

    // 6. 注册到 Spring 容器，此时扫描尚未执行
    registry.registerBeanDefinition(beanName, builder.getBeanDefinition());
}</code></pre>

<p><strong>核心要点</strong>：</p>

<ul><li><code>MapperScannerRegistrar</code><strong>只注册 </strong><code><strong>MapperScannerConfigurer</strong></code><strong> 的 BeanDefinition</strong>，不执行扫描</li><li>扫描动作被推迟到 Spring 后续的生命周期中执行</li></ul>

<h3><strong>4.3 阶段二：MapperScannerConfigurer — 触发扫描</strong></h3>

<p><code>MapperScannerConfigurer</code> 实现了 <code>BeanDefinitionRegistryPostProcessor</code> 接口，这是 Spring 提供的核心扩展点，允许在 Bean 实例化之前修改或新增 BeanDefinition。</p>

<p>Spring 在 <code>refresh()</code> 容器的 <code>invokeBeanDefinitionRegistryPostProcessors</code> 阶段，会回调 <code>postProcessBeanDefinitionRegistry</code> 方法</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-kotlin">public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) {
    // 1. 处理占位符（如 ${basePackage}）
    if (this.processPropertyPlaceHolders) {
        processPropertyPlaceHolders();
    }

    // 2. 创建 ClassPathMapperScanner
    ClassPathMapperScanner scanner = new ClassPathMapperScanner(registry);

    // 3. 设置各项属性
    scanner.setAddToConfig(this.addToConfig);
    scanner.setAnnotationClass(this.annotationClass);
    scanner.setMarkerInterface(this.markerInterface);
    scanner.setSqlSessionFactory(this.sqlSessionFactory);
    scanner.setSqlSessionTemplate(this.sqlSessionTemplate);
    scanner.setResourceLoader(this.applicationContext);
    scanner.setBeanNameGenerator(this.nameGenerator);

    // 4. 注册过滤器（决定哪些接口被扫描）
    scanner.registerFilters();

    // 5. 执行扫描（核心动作）
    scanner.scan(StringUtils.tokenizeToStringArray(this.basePackage,
        ConfigurableApplicationContext.CONFIG_LOCATION_DELIMITERS));
}</code></pre>

<p><strong>执行时机</strong>：此方法在<strong>容器解析完所有 XML 和注解配置之后、任何 Bean 实例化之前</strong>执行，是 Spring 提供的最后添加 BeanDefinition 的地方</p>

<h3><strong>4.4 阶段三：ClassPathMapperScanner — 扫描与 BeanDefinition 转换</strong></h3>

<p><code>ClassPathMapperScanner</code> 继承自 Spring 的 <code>ClassPathBeanDefinitionScanner</code>，重写了 <code>doScan</code> 方法：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">// ClassPathMapperScanner (mybatis-spring 3.0.3)
public class ClassPathMapperScanner extends ClassPathBeanDefinitionScanner {
    private Class&lt;? extends MapperFactoryBean&gt; mapperFactoryBeanClass = MapperFactoryBean.class;

    @Override
    public Set&lt;BeanDefinitionHolder&gt; doScan(String... basePackages) {
        // 1. 调用父类进行标准组件扫描，得到原始 BeanDefinition（beanClass = 接口本身）
        Set&lt;BeanDefinitionHolder&gt; beanDefinitions = super.doScan(basePackages);

        if (!beanDefinitions.isEmpty()) {
            // 2. 对扫描到的 BeanDefinition 进行二次处理（关键步骤）
            processBeanDefinitions(beanDefinitions);
        }
        return beanDefinitions;
    }

    private void processBeanDefinitions(Set&lt;BeanDefinitionHolder&gt; beanDefinitions) {
        for (BeanDefinitionHolder holder : beanDefinitions) {
            BeanDefinition definition = holder.getBeanDefinition();

            // 3. 修改 beanClass：将接口类型改为 MapperFactoryBean
            definition.setBeanClass(this.mapperFactoryBeanClass);

            // 4. 添加构造参数：原始 Mapper 接口类型
            definition.getConstructorArgumentValues()
                .addGenericArgumentValue(definition.getBeanClassName());

            // 5. 添加属性：sqlSessionFactory 或 sqlSessionTemplate
            if (this.sqlSessionFactory != null) {
                definition.getPropertyValues().add("sqlSessionFactory", this.sqlSessionFactory);
            }
            if (this.sqlSessionTemplate != null) {
                definition.getPropertyValues().add("sqlSessionTemplate", this.sqlSessionTemplate);
            }
        }
    }
}</code></pre>

<p><strong>关键转换</strong>：</p>

<table><tbody><tr><td><p>转换前</p></td><td><p>转换后</p></td></tr><tr><td><p>beanName =<code>userMapper</code></p></td><td><p>beanName =<code>userMapper</code></p><p>（不变）</p></td></tr><tr><td><p>beanClass =<code>com.example.mapper.UserMapper（接口）</code></p></td><td><p>beanClass =<code>MapperFactoryBean</code></p></td></tr><tr><td><p>无构造参数</p></td><td><p>构造参数 =<code>UserMapper.class</code></p></td></tr></tbody></table>

<h3><strong>4.5 阶段四：MapperFactoryBean — 生成代理对象</strong></h3>

<p>经过上述转换，Spring 容器中每个 Mapper 接口都对应一个<code>MapperFactoryBean</code>的 BeanDefinition。</p>

<p><code>MapperFactoryBean</code> 实现了 <code>FactoryBean</code> 接口，Spring 实例化时会调用 <code>getObject()</code> 方法获取真正的 Mapper 代理对象：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">// MapperFactoryBean (mybatis-spring 3.0.3)
public class MapperFactoryBean&lt;T&gt; extends SqlSessionDaoSupport implements FactoryBean&lt;T&gt; {
    private Class&lt;T&gt; mapperInterface;

    public MapperFactoryBean(Class&lt;T&gt; mapperInterface) {
        this.mapperInterface = mapperInterface;
    }

    @Override
    public T getObject() throws Exception {
        // 通过 SqlSession 获取 Mapper 代理对象
        return getSqlSession().getMapper(this.mapperInterface);
    }
}</code></pre>

<p><code>getSqlSession().getMapper()</code>的调用链最终进入 MyBatis 核心：</p>

<ul><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-javascript">SqlSessionTemplate.getMapper()
    → Configuration.getMapper()
        → MapperRegistry.getMapper()
            → MapperProxyFactory.newInstance()
                → Proxy.newProxyInstance() → 生成 MapperProxy</code></pre>

<p>最终，Spring 容器中存入的是 <code><strong>MapperProxy</strong></code><strong> 动态代理对象</strong>，这就是为什么我们可以直接用 <code>@Autowired</code> 注入一个接口的原因。</p>

<h3><strong>4.7 完整调用链总览</strong></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-cs">启动类 @MapperScan("com.example.mapper")
    ↓
@Import(MapperScannerRegistrar.class)
    ↓
MapperScannerRegistrar.registerBeanDefinitions()
    → 注册 MapperScannerConfigurer 的 BeanDefinition
    ↓
Spring refresh() → invokeBeanDefinitionRegistryPostProcessors
    ↓
MapperScannerConfigurer.postProcessBeanDefinitionRegistry()
    → 创建 ClassPathMapperScanner
    → 调用 scanner.scan(basePackages)
        ↓
    ClassPathMapperScanner.doScan()
        → super.doScan() → 父类扫描包，发现 Mapper 接口
        → processBeanDefinitions()
            → 修改 BeanDefinition：beanClass = MapperFactoryBean
            → 添加构造参数：原始 Mapper 接口类型
        ↓
    MapperFactoryBean.getObject()
        → sqlSession.getMapper(mapperInterface)
            → MapperRegistry.getMapper()
                → MapperProxyFactory.newInstance()
                    → JDK 动态代理 → MapperProxy
        ↓
Spring 容器注入 MapperProxy 代理对象</code></pre>

<h2><strong>五、面试高频题</strong></h2>

<h3>Q1：MyBatis 的 Mapper 接口为什么不需要实现类？</h3>

<p><strong>A</strong>：因为 MyBatis 使用了 JDK 动态代理，在运行时为接口生成了一个代理对象。当调用接口方法时，会被<code>MapperProxy.invoke()</code>拦截，然后根据方法名找到对应的<code>MappedStatement</code>，最终调用<code>SqlSession</code>执行 SQL。</p>

<h3>Q2：<code>MapperProxy</code>中为什么要缓存<code>MapperMethod</code>？</h3>

<p><strong>A</strong>：<code>MapperMethod</code>的构造过程需要解析方法的返回值类型、参数信息等，这些信息是固定的。缓存可以避免每次方法调用都重复解析，提高性能。</p>

<h3>Q3：<code>@MapperScan</code>的原理是什么？</h3>

<p><strong>A</strong>：<code>@MapperScan</code> 底层通过 <code>@Import(MapperScannerRegistrar.class)</code> 导入了一个 <code>ImportBeanDefinitionRegistrar</code>。Spring 启动时，<code>MapperScannerRegistrar</code> 会向容器注册一个 <code>MapperScannerConfigurer</code> 的 BeanDefinition。<code>MapperScannerConfigurer</code> 实现了 <code>BeanDefinitionRegistryPostProcessor</code>，所以在 Spring 的 <code>refresh()</code> 过程中，它的 <code>postProcessBeanDefinitionRegistry</code> 方法会被调用。在这个方法里，会创建一个 <code>ClassPathMapperScanner</code>，执行 <code>doScan</code> 扫描指定包下的所有 Mapper 接口，然后将每个接口的 BeanDefinition 的 <code>beanClass</code> 修改为 <code>MapperFactoryBean</code>，并将原始接口类型作为构造参数传入。最终，Spring 实例化 <code>MapperFactoryBean</code> 时，会调用其 <code>getObject()</code> 方法，通过 <code>SqlSession.getMapper()</code> 生成真正的 Mapper 动态代理对象（即 <code>MapperProxy</code>）并注入容器。</p>

<h3>Q4：<code>MapperFactoryBean</code>和<code>MapperProxyFactory</code>是什么关系？</h3>

<p><strong>A</strong>：</p>

<ul><li><code>MapperProxyFactory</code>是 MyBatis 内部用来创建代理对象的工厂，与 Spring 无关。</li><li><code>MapperFactoryBean</code>是 Spring 集成中的适配器，它实现了<code>FactoryBean</code>，内部持有<code>SqlSession</code>，并调用<code>sqlSession.getMapper()</code>来获取代理对象，而<code>sqlSession.getMapper()</code>最终会调用<code>MapperProxyFactory</code>创建代理。</li></ul>

<hr/>

<h2><strong>六、下篇预告</strong></h2>

<p>第 4 篇我们将深入<code>SqlSession</code>体系，拆解<code>DefaultSqlSession</code>、<code>SqlSessionFactory</code>的构建流程，以及<code>SqlSession</code>的四大核心对象的初始化时机。</p>

<p>如果觉得有帮助，欢迎<strong>点赞、在看、转发</strong>支持！</p>

<p>系列持续更新，关注不走丢 👇</p>

<p><br/></p>

<br/>

<p></p>
