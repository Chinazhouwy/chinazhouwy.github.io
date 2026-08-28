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
// 1. 构建 SqlSessionFactory
SqlSessionFactory factory = new SqlSessionFactoryBuilder().build(inputStream);
// 2. 打开 SqlSession
SqlSession session = factory.openSession();
// 3. 获取 Mapper 并执行
UserMapper mapper = session.getMapper(UserMapper.class);
User user = mapper.selectById(1);
// 4. 关闭会话
session.close();
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
// SqlSessionFactoryBuilder
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
}
```


非常简单：解析完 

Configuration

 后，直接 

new DefaultSqlSessionFactory(config)

。

2.2 DefaultSqlSessionFactory 的结构


```
// DefaultSqlSessionFactory
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
}
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
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Import(MapperScannerRegistrar.class)
public @interface MapperScan {
    String[] basePackages() default {};
    // ... 其他属性
}
```


MapperScannerRegistrar

 实现了 

ImportBeanDefinitionRegistrar

 接口，Spring 启动时会调用其 

registerBeanDefinitions

 方法


```
@Override
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
}
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
public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) {
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
}
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
public class ClassPathMapperScanner extends ClassPathBeanDefinitionScanner {
    private Class<? extends MapperFactoryBean> mapperFactoryBeanClass = MapperFactoryBean.class;

    @Override
    public Set<BeanDefinitionHolder> doScan(String... basePackages) {
        // 1. 调用父类进行标准组件扫描，得到原始 BeanDefinition（beanClass = 接口本身）
        Set<BeanDefinitionHolder> beanDefinitions = super.doScan(basePackages);

        if (!beanDefinitions.isEmpty()) {
            // 2. 对扫描到的 BeanDefinition 进行二次处理（关键步骤）
            processBeanDefinitions(beanDefinitions);
        }
        return beanDefinitions;
    }

    private void processBeanDefinitions(Set<BeanDefinitionHolder> beanDefinitions) {
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
}
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
public class MapperFactoryBean<T> extends SqlSessionDaoSupport implements FactoryBean<T> {
    private Class<T> mapperInterface;

    public MapperFactoryBean(Class<T> mapperInterface) {
        this.mapperInterface = mapperInterface;
    }
    @Override
    public T getObject() throws Exception {
        // 通过 SqlSession 获取 Mapper 代理对象
        return getSqlSession().getMapper(this.mapperInterface);
    }
}
```


getSqlSession().getMapper()

的调用链最终进入 MyBatis 核心：


```
SqlSessionTemplate.getMapper()
    → Configuration.getMapper()
        → MapperRegistry.getMapper()
            → MapperProxyFactory.newInstance()
                → Proxy.newProxyInstance() → 生成 MapperProxy
```


最终，Spring 容器中存入的是 

MapperProxy

 动态代理对象

，这就是为什么我们可以直接用 

@Autowired

 注入一个接口的原因。

3.6 完整调用链总览


```
启动类 @MapperScan("com.example.mapper")
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
Spring 容器注入 MapperProxy 代理对象
```


四、DefaultSqlSession 核心源码拆解

4.1 核心字段


```
public class DefaultSqlSession implements SqlSession {
    private final Configuration configuration;  // 全局配置
    private final Executor executor;            // 执行器
    private final boolean autoCommit;           // 是否自动提交
    private boolean dirty;                      // 是否有数据变更（用于判断是否需要提交/回滚）
    private List<Cursor<?>> cursors;            // 游标集合，用于 close 时批量关闭

    // ... 其他
}
```


4.2 查询方法链路

以 

selectOne

 为例：


```
// DefaultSqlSession
@Override
public <T> T selectOne(String statement, Object parameter) {
    // 委托给 selectList，然后取第一个元素
    List<T> list = this.selectList(statement, parameter);
    if (list.size() == 1) {
        return list.get(0);
    } else if (list.size() > 1) {
        throw new TooManyResultsException("...");
    } else {
        return null;
    }
}

@Override
public <E> List<E> selectList(String statement, Object parameter) {
    return this.selectList(statement, parameter, RowBounds.DEFAULT);
}

@Override
public <E> List<E> selectList(String statement, Object parameter, RowBounds rowBounds) {
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
}
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
// DefaultSqlSession
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
}
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
// DefaultSqlSession
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
    return (!autoCommit && dirty) || force;
}
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
// SimpleExecutor.doQuery
public <E> List<E> doQuery(MappedStatement ms, Object parameter, RowBounds rowBounds,
                           ResultHandler resultHandler, BoundSql boundSql) throws SQLException {
    Statement stmt = null;
    try {
        Configuration configuration = ms.getConfiguration();
        // 创建 StatementHandler
        StatementHandler handler = configuration.newStatementHandler(wrapper, ms, parameter, rowBounds, resultHandler, boundSql);
        // ...
    }
}
```



```
// Configuration
public StatementHandler newStatementHandler(Executor executor, MappedStatement ms, Object parameter,
                                             RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) {
    // 创建 RoutingStatementHandler（会根据 SQL 类型路由到对应的 StatementHandler）
    StatementHandler statementHandler = new RoutingStatementHandler(executor, ms, parameter, rowBounds, resultHandler, boundSql);
    // 插件拦截
    statementHandler = (StatementHandler) interceptorChain.pluginAll(statementHandler);
    return statementHandler;
}
```


5.3 ParameterHandler 和 ResultSetHandler：在 StatementHandler 创建时初始化


```
// RoutingStatementHandler 构造方法
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
}
```


而这些具体的 StatementHandler 的父类 

BaseStatementHandler

 在构造时会创建 ParameterHandler 和 ResultSetHandler


```
// BaseStatementHandler 构造方法
protected BaseStatementHandler(Executor executor, MappedStatement ms, Object parameter,
                               RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) {
    // ...
    this.parameterHandler = configuration.newParameterHandler(ms, parameter, boundSql);
    this.resultSetHandler = configuration.newResultSetHandler(executor, ms, rowBounds, parameterHandler, resultHandler, boundSql);
}

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
// BaseExecutor
public abstract class BaseExecutor implements Executor {
    protected PerpetualCache localCache;      // 一级缓存
    protected PerpetualCache localOutputParameterCache;

    // 查询时先从缓存取
    @Override
    public <E> List<E> query(MappedStatement ms, Object parameter, RowBounds rowBounds,
                             ResultHandler resultHandler, CacheKey key, BoundSql boundSql) {
        // 从 localCache 中获取
        List<E> list = resultHandler == null ? (List<E>) localCache.getObject(key) : null;
        if (list != null) {
            // 缓存命中
            handleLocallyCachedOutputParameters(ms, key, parameter, boundSql);
        } else {
            // 缓存未命中，从数据库查询
            list = queryFromDatabase(ms, parameter, rowBounds, resultHandler, key, boundSql);
        }
        return list;
    }
}
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
