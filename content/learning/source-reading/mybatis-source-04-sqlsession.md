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
source: "微信公众号「狂热大猩猩的技术宅」"
source_url: "https://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484020&idx=1&sn=9bc9313a8519fc01ce47e9636d9e6d49&chksm=c2b8102bf5cf993d184926d0688326a62f77a47598413fadd5d302db34a93e1da26b9507a035"
published_at: "2026-06-21 11:55:00 +08:00"
---

# MyBatis 源码深度拆解（四）：SqlSession 体系深度拆解

> 原作者：狂热大猩猩的技术宅 · 2026年6月21日 11:55
> [阅读微信原文](https://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484020&idx=1&sn=9bc9313a8519fc01ce47e9636d9e6d49&chksm=c2b8102bf5cf993d184926d0688326a62f77a47598413fadd5d302db34a93e1da26b9507a035)
> 原文排版恢复版：保留原作者内容与顺序，仅整理网页显示格式。

<p>面试官：SqlSession 是什么？它和 SqlSessionFactory 是什么关系？SqlSession 里的四大对象是什么时候创建的？</p>

<hr/>

<h2><strong>一、回顾与开篇</strong></h2>

<p>前几篇我们走通了整体架构，也看了配置加载和 Mapper 代理。今天我们把目光聚焦到<strong>SqlSession</strong>这个“门面”上。</p>

<p>先看一段最熟悉的代码：</p>



<pre><code class="language-java">// 1. 构建 SqlSessionFactory
SqlSessionFactory factory = new SqlSessionFactoryBuilder().build(inputStream);
// 2. 打开 SqlSession
SqlSession session = factory.openSession();
// 3. 获取 Mapper 并执行
UserMapper mapper = session.getMapper(UserMapper.class);
User user = mapper.selectById(1);
// 4. 关闭会话
session.close();</code></pre>

<p>第 2 步和第 4 步就是今天的主角：<strong>SqlSession 的创建与销毁</strong>。</p>

<p><strong>本篇目标</strong>：</p>

<ul><li>搞清楚<code>SqlSessionFactory</code>的构建过程</li><li>深入<code>DefaultSqlSession</code>的核心实现</li><li>理清四大对象（Executor、StatementHandler、ParameterHandler、ResultSetHandler）的初始化时机</li><li>理解一级缓存与 SqlSession 的绑定关系</li></ul>

<p><strong>一句话总结</strong>：</p>

<ul><li><code>SqlSessionFactory</code>是生产<code>SqlSession</code>的工厂</li><li><code>SqlSession</code>是MyBatis的门面接口，对外提供统一的数据库操作API。具体执行时，<code>SqlSession</code>将操作委托给<code>Executor</code>执行器，由<code>Executor</code>统一调度<code>StatementHandler</code>、<code>ParameterHandler</code>和<code>ResultSetHandler</code>三大组件完成SQL执行与结果映射。</li><li><code>DefaultSqlSession</code> 是 MyBatis 原生提供的默认实现类，也是最常用的实现。除此之外，MyBatis 还提供了 <code>SqlSessionManager</code> 实现。在 Spring 整合环境中，核心实现则是 <code>SqlSessionTemplate</code></li></ul>

<p><br/></p>

<p>本文主要分析MyBatis原生框架中SqlSession的核心设计与实现。第3章补充说明在Spring整合环境下的额外机制（Mapper扫描、<code>SqlSessionTemplate</code>等），阅读时请注意区分纯MyBatis原生逻辑与Spring整合层逻辑</p>

<h2><strong>二、SqlSessionFactory 构建流程</strong></h2>

<h3><strong>2.1 从 builder.build() 说起</strong></h3>



<pre><code class="language-typescript">// SqlSessionFactoryBuilder
public SqlSessionFactory build(InputStream inputStream, String environment, Properties properties) {
    try {
        XMLConfigBuilder parser = new XMLConfigBuilder(inputStream, environment, properties);
        Configuration config = parser.parse();  // 解析配置
        return build(config);                    // 构建 SqlSessionFactory
    } catch (Exception e) {
        throw ExceptionFactory.wrapException("Error building SqlSession.", e);
    }
}

public SqlSessionFactory build(Configuration config) {
    return new DefaultSqlSessionFactory(config);
}</code></pre>

<p>非常简单：解析完 <code>Configuration</code> 后，直接 <code>new DefaultSqlSessionFactory(config)</code>。</p>

<h3><strong>2.2 DefaultSqlSessionFactory 的结构</strong></h3>



<pre><code class="language-typescript">// DefaultSqlSessionFactory
public class DefaultSqlSessionFactory implements SqlSessionFactory {
    private final Configuration configuration;

    public DefaultSqlSessionFactory(Configuration configuration) {
        this.configuration = configuration;
    }

    // 各种 openSession 重载方法，最终都调用 openSessionFromDataSource
    @Override
    public SqlSession openSession() {
        return openSessionFromDataSource(configuration.getDefaultExecutorType(), null, false);
    }

    @Override
    public SqlSession openSession(boolean autoCommit) {
        return openSessionFromDataSource(configuration.getDefaultExecutorType(), null, autoCommit);
    }

    @Override
    public SqlSession openSession(ExecutorType execType) {
        return openSessionFromDataSource(execType, null, false);
    }

    // ... 其他重载
}</code></pre>

<h3><strong>关键点</strong>：<code>DefaultSqlSessionFactory</code> 只是 <code>Configuration</code> 的持有者，不保存任何会话状态，所以是<strong>线程安全的</strong>，可以被多个线程共享。</h3>

<h2><strong>三、@MapperScan 底层注册流程</strong></h2>

<h3><strong>3.1 整体设计理念：延迟扫描</strong></h3>

<p>在 3.0.x 版本中，<code>@MapperScan</code>的设计理念是<strong>延迟扫描 + 职责分离</strong>：</p>

<table><tbody><tr><td><p>角色</p></td><td><p>实现类</p></td><td><p>核心职责</p></td></tr><tr><td><p><strong>触发者</strong></p></td><td><p><code>@MapperScan 注解</code></p></td><td><p>声明扫描范围，通过<code>@Import</code></p><p>导入 Registrar</p></td></tr><tr><td><p><strong>定义注册者</strong></p></td><td><p><code>MapperScannerRegistrar</code></p></td><td><p>注册<code>MapperScannerConfigurer</code></p><p>的 BeanDefinition</p></td></tr><tr><td><p><strong>扫描执行者</strong></p></td><td><p><code>MapperScannerConfigurer</code></p></td><td><p>实现<code>BeanDefinitionRegistryPostProcessor</code></p><p>，在 Spring 生命周期中触发扫描</p></td></tr><tr><td><p><strong>核心扫描器</strong></p></td><td><p><code>ClassPathMapperScanner</code></p></td><td><p>执行真正的包扫描和 BeanDefinition 转换</p></td></tr></tbody></table>

<h3><strong>3.2 阶段一：MapperScannerRegistrar — 注册扫描器定义</strong></h3>

<p><code>@MapperScan</code> 注解通过 <code>@Import</code> 导入了 <code>MapperScannerRegistrar</code></p>



<pre><code class="language-java">@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Import(MapperScannerRegistrar.class)
public @interface MapperScan {
    String[] basePackages() default {};
    // ... 其他属性
}</code></pre>

<p><code>MapperScannerRegistrar</code> 实现了 <code>ImportBeanDefinitionRegistrar</code> 接口，Spring 启动时会调用其 <code>registerBeanDefinitions</code> 方法</p>



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

<h3><strong>3.3 阶段二：MapperScannerConfigurer — 触发扫描</strong></h3>

<p><code>MapperScannerConfigurer</code> 实现了 <code>BeanDefinitionRegistryPostProcessor</code> 接口，这是 Spring 提供的核心扩展点，允许在 Bean 实例化之前修改或新增 BeanDefinition。</p>

<p>Spring 在 <code>refresh()</code> 容器的 <code>invokeBeanDefinitionRegistryPostProcessors</code> 阶段，会回调 <code>postProcessBeanDefinitionRegistry</code> 方法：</p>



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

<h3><strong>3.4 阶段三：ClassPathMapperScanner — 扫描与 BeanDefinition 转换</strong></h3>

<p><code>ClassPathMapperScanner</code> 继承自 Spring 的 <code>ClassPathBeanDefinitionScanner</code>，重写了 <code>doScan</code> 方法：</p>



<pre><code class="language-typescript">public class ClassPathMapperScanner extends ClassPathBeanDefinitionScanner {
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

<table><tbody><tr><td><p>转换前</p></td><td><p>转换后</p></td></tr><tr><td><p>beanName =<code>userMapper</code></p></td><td><p>beanName =<code>userMapper</code></p><p>（不变）</p></td></tr><tr><td><p>beanClass =<code>com.example.mapper.UserMapper</code></p><p>（接口）</p></td><td><p>beanClass =<code>MapperFactoryBean</code></p></td></tr><tr><td><p>无构造参数</p></td><td><p>构造参数 =<code>UserMapper.class</code></p></td></tr></tbody></table>

<h3><strong>3.5 阶段四：MapperFactoryBean — 生成代理对象</strong></h3>

<p>经过上述转换，Spring 容器中每个 Mapper 接口都对应一个<code>MapperFactoryBean</code>的 BeanDefinition。</p>

<p><code>MapperFactoryBean</code> 实现了 <code>FactoryBean</code> 接口，Spring 实例化时会调用 <code>getObject()</code> 方法获取真正的 Mapper 代理对象：</p>



<pre><code class="language-java">public class MapperFactoryBean&lt;T&gt; extends SqlSessionDaoSupport implements FactoryBean&lt;T&gt; {
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



<pre><code class="language-javascript">SqlSessionTemplate.getMapper()
    → Configuration.getMapper()
        → MapperRegistry.getMapper()
            → MapperProxyFactory.newInstance()
                → Proxy.newProxyInstance() → 生成 MapperProxy</code></pre>

<p>最终，Spring 容器中存入的是 <code><strong>MapperProxy</strong></code><strong> 动态代理对象</strong>，这就是为什么我们可以直接用 <code>@Autowired</code> 注入一个接口的原因。</p>

<h3><strong>3.6 完整调用链总览</strong></h3>



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

<h2><strong>四、DefaultSqlSession 核心源码拆解</strong></h2>

<h3><strong>4.1 核心字段</strong></h3>



<pre><code class="language-php">public class DefaultSqlSession implements SqlSession {
    private final Configuration configuration;  // 全局配置
    private final Executor executor;            // 执行器
    private final boolean autoCommit;           // 是否自动提交
    private boolean dirty;                      // 是否有数据变更（用于判断是否需要提交/回滚）
    private List&lt;Cursor&lt;?&gt;&gt; cursors;            // 游标集合，用于 close 时批量关闭

    // ... 其他
}</code></pre>

<h3><strong>4.2 查询方法链路</strong></h3>

<p>以 <code>selectOne</code> 为例：</p>



<pre><code class="language-typescript">// DefaultSqlSession
@Override
public &lt;T&gt; T selectOne(String statement, Object parameter) {
    // 委托给 selectList，然后取第一个元素
    List&lt;T&gt; list = this.selectList(statement, parameter);
    if (list.size() == 1) {
        return list.get(0);
    } else if (list.size() &gt; 1) {
        throw new TooManyResultsException("...");
    } else {
        return null;
    }
}

@Override
public &lt;E&gt; List&lt;E&gt; selectList(String statement, Object parameter) {
    return this.selectList(statement, parameter, RowBounds.DEFAULT);
}

@Override
public &lt;E&gt; List&lt;E&gt; selectList(String statement, Object parameter, RowBounds rowBounds) {
    try {
        // 1. 从 Configuration 中获取 MappedStatement
        MappedStatement ms = configuration.getMappedStatement(statement);
        // 2. 委托给 Executor 执行
        return executor.query(ms, wrapCollection(parameter), rowBounds, Executor.NO_RESULT_HANDLER);
    } catch (Exception e) {
        throw ExceptionFactory.wrapException("Error querying database.  Cause: " + e, e);
    } finally {
        ErrorContext.instance().reset();
    }
}</code></pre>

<p><strong>关键点</strong>：</p>

<ul><li><code>selectOne</code>本质是<code>selectList</code>的包装，取第一个元素</li><li><code>statement</code>参数是 Mapper XML 中的<code>namespace.methodId</code></li><li>参数如果是集合类型，会被包装（避免参数名解析问题）</li></ul>

<h3><strong>4.3 更新方法链路</strong></h3>

<p>以 <code>insert</code> / <code>update</code> / <code>delete</code> 为例，它们都走 <code>update</code> 方法：</p>



<pre><code class="language-typescript">// DefaultSqlSession
@Override
public int insert(String statement, Object parameter) {
    return update(statement, parameter);
}
@Override
public int update(String statement, Object parameter) {
    try {
        dirty = true;  // 标记数据已变更
        MappedStatement ms = configuration.getMappedStatement(statement);
        return executor.update(ms, wrapCollection(parameter));
    } catch (Exception e) {
        throw ExceptionFactory.wrapException("Error updating database.  Cause: " + e, e);
    } finally {
        ErrorContext.instance().reset();
    }
}</code></pre>

<p><strong>关键点</strong>：<code>dirty</code>标志用于标记当前<code>SqlSession</code>是否执行过任何数据变更操作（<code>insert</code>/<code>update</code>/<code>delete</code>），是事务提交判断的核心依据：</p>

<ul><li><code>autoCommit = false</code>时，<code>commit()</code>方法会检查<code>isCommitOrRollbackRequired</code>方法，若<code>dirty</code>为<code>true</code>则提交事务并将<code>dirty</code>重置为<code>false</code>；<code>close()</code>方法同理，若<code>dirty</code>为<code>true</code>则回滚事务。</li><li><code>autoCommit = true</code>时，<code>dirty</code>标志不影响提交/回滚，因为数据库事务由JDBC自动提交管理。</li></ul>

<p>需要注意的是，以上是纯MyBatis原生机制。在Spring整合场景下，事务由Spring的<code>PlatformTransactionManager</code>统一管理，不应再手动调用<code>sqlSession.commit()</code>。</p>

<h3><strong>4.4 事务管理：commit / rollback / close</strong></h3>



<pre><code class="language-typescript">// DefaultSqlSession
@Override
public void commit() {
    commit(false);
}

@Override
public void commit(boolean force) {
    try {
        // 提交事务，force 参数表示即使不 dirty 也提交
        executor.commit(isCommitOrRollbackRequired(force));
        dirty = false;  // 提交成功后重置 dirty
    } catch (Exception e) {
        throw ExceptionFactory.wrapException("Error committing transaction.  Cause: " + e, e);
    } finally {
        ErrorContext.instance().reset();
    }
}

@Override
public void rollback() {
    rollback(false);
}

@Override
public void rollback(boolean force) {
    try {
        // 回滚事务
        executor.rollback(isCommitOrRollbackRequired(force));
        dirty = false;
    } catch (Exception e) {
        throw ExceptionFactory.wrapException("Error rolling back transaction.  Cause: " + e, e);
    } finally {
        ErrorContext.instance().reset();
    }
}

@Override
public void close() {
    try {
        // 如果有未提交的变更，回滚
        if (dirty) {
            executor.rollback(true);
        }
        // 关闭 executor（会关闭连接）
        executor.close(true);
        dirty = false;
    } catch (Exception e) {
        throw ExceptionFactory.wrapException("Error closing session.  Cause: " + e, e);
    } finally {
        ErrorContext.instance().reset();
    }
}

// 判断是否需要提交/回滚
private boolean isCommitOrRollbackRequired(boolean force) {
    return (!autoCommit &amp;&amp; dirty) || force;
}</code></pre>

<p><strong>事务逻辑总结</strong>：</p>

<table><tbody><tr><td><p>场景</p></td><td><p>autoCommit=false（默认）</p></td><td><p>autoCommit=true</p></td></tr><tr><td><p>执行更新后</p></td><td><p>dirty=true，需要手动 commit</p></td><td><p>自动提交，dirty 变化不影响</p></td></tr><tr><td><p>close() 时</p></td><td><p>如果 dirty=true，自动 rollback</p></td><td><p>直接关闭</p></td></tr><tr><td><p>commit(force)</p></td><td><p>正常提交</p></td><td><p>即使 autoCommit=true 也提交</p></td></tr></tbody></table>

<h2><strong>五、四大对象的初始化时机</strong></h2>

<h3><strong>5.1 Executor：SqlSession 创建时初始化</strong></h3>

<p>在<code>openSessionFromDataSource</code>中，通过<code>configuration.newExecutor()</code>创建。</p>

<h3><strong>5.2 StatementHandler：执行 SQL 时创建</strong></h3>



<pre><code class="language-java">// SimpleExecutor.doQuery
public &lt;E&gt; List&lt;E&gt; doQuery(MappedStatement ms, Object parameter, RowBounds rowBounds,
                           ResultHandler resultHandler, BoundSql boundSql) throws SQLException {
    Statement stmt = null;
    try {
        Configuration configuration = ms.getConfiguration();
        // 创建 StatementHandler
        StatementHandler handler = configuration.newStatementHandler(wrapper, ms, parameter, rowBounds, resultHandler, boundSql);
        // ...
    }
}</code></pre>



<pre><code class="language-typescript">// Configuration
public StatementHandler newStatementHandler(Executor executor, MappedStatement ms, Object parameter,
                                             RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) {
    // 创建 RoutingStatementHandler（会根据 SQL 类型路由到对应的 StatementHandler）
    StatementHandler statementHandler = new RoutingStatementHandler(executor, ms, parameter, rowBounds, resultHandler, boundSql);
    // 插件拦截
    statementHandler = (StatementHandler) interceptorChain.pluginAll(statementHandler);
    return statementHandler;
}</code></pre>

<h3><strong>5.3 ParameterHandler 和 ResultSetHandler：在 StatementHandler 创建时初始化</strong></h3>



<pre><code class="language-cs">// RoutingStatementHandler 构造方法
public RoutingStatementHandler(Executor executor, MappedStatement ms, Object parameter,
                               RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) {
    // 根据 MappedStatement 的类型，选择具体的 StatementHandler
    switch (ms.getStatementType()) {
        case STATEMENT:
            delegate = new SimpleStatementHandler(executor, ms, parameter, rowBounds, resultHandler, boundSql);
            break;
        case PREPARED:
            delegate = new PreparedStatementHandler(executor, ms, parameter, rowBounds, resultHandler, boundSql);
            break;
        case CALLABLE:
            delegate = new CallableStatementHandler(executor, ms, parameter, rowBounds, resultHandler, boundSql);
            break;
        default:
            throw new RuntimeException("...");
    }
}</code></pre>

<p>而这些具体的 StatementHandler 的父类 <code>BaseStatementHandler</code> 在构造时会创建 ParameterHandler 和 ResultSetHandler</p>



<pre><code class="language-kotlin">// BaseStatementHandler 构造方法
protected BaseStatementHandler(Executor executor, MappedStatement ms, Object parameter,
                               RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) {
    // ...
    this.parameterHandler = configuration.newParameterHandler(ms, parameter, boundSql);
    this.resultSetHandler = configuration.newResultSetHandler(executor, ms, rowBounds, parameterHandler, resultHandler, boundSql);
}
</code></pre>

<p><strong>总结</strong>：</p>

<table><tbody><tr><td><p>对象</p></td><td><p>初始化时机</p></td><td><p>创建位置</p></td></tr><tr><td><p>Executor</p></td><td><p>openSession 时</p></td><td><p>Configuration.newExecutor()</p></td></tr><tr><td><p>StatementHandler</p></td><td><p>执行 SQL 时</p></td><td><p>Configuration.newStatementHandler()</p></td></tr><tr><td><p>ParameterHandler</p></td><td><p>创建 StatementHandler 时</p></td><td><p>Configuration.newParameterHandler()</p></td></tr><tr><td><p>ResultSetHandler</p></td><td><p>创建 StatementHandler 时</p></td><td><p>Configuration.newResultSetHandler()</p></td></tr></tbody></table>

<h2><strong>六、一级缓存与 SqlSession 的绑定</strong></h2>

<p>一级缓存是 SqlSession 级别的，在 Executor 中实现。回顾 <code>BaseExecutor</code>：</p>



<pre><code class="language-typescript">// BaseExecutor
public abstract class BaseExecutor implements Executor {
    protected PerpetualCache localCache;      // 一级缓存
    protected PerpetualCache localOutputParameterCache;

    // 查询时先从缓存取
    @Override
    public &lt;E&gt; List&lt;E&gt; query(MappedStatement ms, Object parameter, RowBounds rowBounds,
                             ResultHandler resultHandler, CacheKey key, BoundSql boundSql) {
        // 从 localCache 中获取
        List&lt;E&gt; list = resultHandler == null ? (List&lt;E&gt;) localCache.getObject(key) : null;
        if (list != null) {
            // 缓存命中
            handleLocallyCachedOutputParameters(ms, key, parameter, boundSql);
        } else {
            // 缓存未命中，从数据库查询
            list = queryFromDatabase(ms, parameter, rowBounds, resultHandler, key, boundSql);
        }
        return list;
    }
}</code></pre>

<p><strong>关键点</strong>：</p>

<ul><li>一级缓存的生命周期 = SqlSession 的生命周期</li><li>SqlSession 关闭时，一级缓存随之销毁</li><li>执行 update/insert/delete 会清空一级缓存</li></ul>

<hr/>

<h2><strong>七、面试高频题</strong></h2>

<h3>Q1：SqlSessionFactory 是线程安全的吗？SqlSession 呢？</h3>

<p><strong>A</strong>：</p>

<ul><li><code>SqlSessionFactory</code>是线程安全的，因为它只持有<code>Configuration</code>（不可变），多个线程可以共享同一个工厂。</li><li><code>SqlSession</code>不是线程安全的，每个线程应该有自己的 SqlSession，用完关闭。这也是为什么在 Web 应用中，通常一个请求对应一个 SqlSession。</li></ul>

<h3>Q2：openSession() 和不带参数的 openSession() 有什么区别？</h3>

<p><strong>A</strong>：</p>

<ul><li><code>openSession()</code>：不自动提交，需要手动 commit。</li><li><code>openSession(true)</code>：自动提交，每次 SQL 执行后自动 commit。</li><li><code>openSession(ExecutorType.BATCH)</code>：批量执行器，适合批量操作。</li></ul>

<h3>Q3：Executor 和 StatementHandler 的区别？</h3>

<p><strong>A</strong>：</p>

<ul><li><code>Executor</code>是执行器的顶级接口，负责管理一级缓存、事务、批量操作等<strong>粗粒度</strong>的逻辑。</li><li><code>StatementHandler</code>负责<strong>细粒度</strong>的 JDBC Statement 操作：创建 Statement、设置参数、执行 SQL、处理结果集。</li><li>Executor 内部调用 StatementHandler 完成具体的数据库操作。</li></ul>

<h3>Q4：DefaultSqlSession 里的 dirty 标志位有什么用？</h3>

<p><strong>A</strong>：<code>dirty</code>表示自上次 commit/rollback 以来，是否执行过 insert/update/delete 等变更操作。在<code>close()</code>时，如果<code>dirty</code>为 true 且<code>autoCommit</code>为 false，则会自动回滚，防止未提交的变更被意外丢失。</p>

<h3>Q5：SqlSession 的 close() 会不会把连接也关了？</h3>

<p><strong>A</strong>：会。<code>close()</code>会调用<code>executor.close()</code>，最终关闭数据库连接（连接会归还给连接池）。这也是为什么每次用完 SqlSession 都要 close 的原因。</p>

<hr/>

<h2><strong>八、下篇预告</strong></h2>

<p>第 5 篇我们将深入<strong>Executor 执行器三级架构</strong>，详细拆解：</p>

<ul><li>SimpleExecutor、ReuseExecutor、BatchExecutor 的实现差异</li><li>CachingExecutor 如何用装饰器模式包装二级缓存</li><li>执行器的创建与选择逻辑</li></ul>

<p>如果觉得有帮助，欢迎<strong>点赞、在看、转发</strong>支持！</p>

<p>系列持续更新，关注不走丢 👇</p>

<br/>

<p></p>
