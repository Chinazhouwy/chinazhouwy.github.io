---
title: "MyBatis 源码深度拆解（一）：整体架构 &amp; 核心执行全流程"
date: "2026-05-30"
domain: "学习"
area: "Java 后端"
module: "MyBatis 源码拆解"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "面试官：说说 MyBatis 的核心执行流程？从 SqlSessionFactory 构建到结果映射，每一步都发生了什么…"
tags:
  - "MyBatis"
  - "源码分析"
---

# MyBatis 源码深度拆解（一）：整体架构 &amp; 核心执行全流程

> 来源：微信公众号（MyBatis 源码深度拆解系列）
> 链接：[http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484005&idx=1&sn=ff1e94a3958cdc33c3bb2109f12cbf59&chksm=c2b8103af5cf992c240c863424df2fcadd8e76d03d01dec3fe5d59bdaf38cbaefb2b0aaf5df2](http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484005&idx=1&sn=ff1e94a3958cdc33c3bb2109f12cbf59&chksm=c2b8103af5cf992c240c863424df2fcadd8e76d03d01dec3fe5d59bdaf38cbaefb2b0aaf5df2)
> 类型：📚 参考资料（非面试题/面经）—— MyBatis 源码深度拆解系列
> 相关：第196题(MyBatis 与 Spring 事务整合)、第247题(MyBatis 分页拦截器)、第48题(深分页优化)
> 整理时间：2026-08-03

---

面试官：说说 MyBatis 的核心执行流程？从 SqlSessionFactory 构建到结果映射，每一步都发生了什么？

写在前面

这是 MyBatis 源码系列的第 

1

 篇。在开始逐行啃源码之前，我们必须先建立一张 

“全局地图”

—— 知道 MyBatis 长什么样，核心组件有哪些，一条 SQL 从调用到返回经历了哪些站。（啰嗦一下：最重要的是实践，实践debug走一遍流程基本就能清晰了，比spring清晰太多了）。

本篇目标

：

掌握 MyBatis 的架构分层

理清核心组件之间的关系

完整追踪一条 SQL 的执行主流程

为后续的源码深挖打好基础

一、MyBatis 整体认知

1.1 官方定位

MyBatis 是一款优秀的

持久层框架

，支持自定义 SQL、存储过程以及高级映射。

说人话就是：MyBatis 帮我们解决了 

JDBC 的繁琐问题

（手动注册驱动、创建连接、预编译、设参、取值、异常处理……），同时也把 SQL 的控制权交给开发者。

1.2 架构分层

MyBatis 整体分为 

四层

：官方说法是三层，去掉配置层即可。

┌─────────────────────────────────────────────┐

│           接口层（SqlSession）                │  ← 程序员直接调用的 API

├─────────────────────────────────────────────┤

│ 
核心处理层（Executor、StatementHandler 等）│  ← SQL 执行、参数映射、结果映射

├─────────────────────────────────────────────┤

│           配置层（Configuration）             │  ← 配置文件的加载和解析

├─────────────────────────────────────────────┤

│           存储层（JDBC / 事务）                │  ← 底层数据库交互

└─────────────────────────────────────────────┘

面试切入点

：MyBatis 的分层设计有什么好处？

各层职责单一，可扩展性强（比如插件可以拦截核心处理层的四大对象

Executor、StatementHandler、ParameterHandler、ResultSetHandler

）

配置层和核心处理层分离，支持多种配置来源（XML、注解、代码配置）

二、核心组件关系总览

┌───────────────────────────────────────────┐

│                               应用程序                                                                                               │

└───────────────────────────────────────────┘

                                      │

                                      ▼

┌───────────────────────────────────────────┐

│  SqlSession (DefaultSqlSession)                                                                                                        │

│    ├── Configuration (全局配置，保存所有解析后的信息)                                                                      │

│    └── Executor (执行器，真正做数据库操作)                                                                                      │

│          ├── StatementHandler (处理 JDBC Statement)                                                                        │

│          ├── ParameterHandler (参数设置)                                                                                            │

│          └── ResultSetHandler (结果集封装)                                                                                          │

└───────────────────────────────────────────┘

                                      │

                                      ▼

┌───────────────────────────────────────────┐

│                             Database                             						                      │

└───────────────────────────────────────────┘

一句话概括

：

SqlSession

是门面，提供增删改查方法

Configuration

是配置中心，保存所有映射信息

Executor

 是真正的执行者，调用 StatementHandler 等完成 SQL 操作

三、完整执行主流程（从配置加载到结果返回）

我们以一个最简单的查询为例，代码通常是这样写的：


```
// 1. 加载配置文件
InputStream in = Resources.getResourceAsStream("mybatis-config.xml");
// 2. 构建 SqlSessionFactory
SqlSessionFactory factory = new SqlSessionFactoryBuilder().build(in);
// 3. 打开 SqlSession
SqlSession session = factory.openSession();
// 4. 获取 Mapper 接口的代理对象
UserMapper mapper = session.getMapper(UserMapper.class);
// 5. 执行查询
User user = mapper.selectById(1);
// 6. 关闭会话
session.close();
```


mapper.java


```
public interface UserMapper {
    @Select("SELECT * FROM user WHERE id = #{id}")
    User selectById(@Param("id") int i);
    // User 包含 id  userName password email
    @Update("UPDATE user SET user_name = #{userName}, password = #{password}, email = #{email} WHERE id = #{id}")
    void update(User user);

    @Select("SELECT * FROM user")
    List<User> selectAll();
}
```


mybatis-config.xml


```
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE configuration
        PUBLIC "-//mybatis.org//DTD Config 3.0//EN"
        "https://mybatis.org/dtd/mybatis-3-config.dtd">
<configuration>
    <!-- 1. 外部化配置 -->
    <properties resource="jdbc.properties"/>
    <!-- 2. 全局行为设置 -->
    <settings>
        <setting name="mapUnderscoreToCamelCase" value="true"/>
        <setting name="logImpl" value="STDOUT_LOGGING"/>
        <setting name="lazyLoadingEnabled" value="true"/>
    </settings>
    <!-- 3. 别名 -->
    <typeAliases>
        <package name="com.example.entity"/>
    </typeAliases>
    <!-- 4. 数据库环境 -->
    <environments default="development">
        <environment id="development">
            <transactionManager type="JDBC"/>
            <dataSource type="POOLED">
                <property name="driver" value="${jdbc.driver}"/>
                <property name="url" value="${jdbc.url}"/>
                <property name="username" value="${jdbc.username}"/>
                <property name="password" value="${jdbc.password}"/>
            </dataSource>
        </environment>
    </environments>
    <!-- 5. Mapper 注册 -->
    <mappers>
        <package name="com.example.mapper"/>
    </mappers>
</configuration>
```


jdbc.properties


```
# MySQL 8.x 驱动配置
jdbc.driver=com.mysql.cj.jdbc.Driver
jdbc.url=jdbc:mysql://localhost:3306/test?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8
jdbc.username=root
jdbc.password=123456
```


部分pom.xml


```
 <!-- MyBatis 核心依赖 -->
        <dependency>
            <groupId>org.mybatis</groupId>
            <artifactId>mybatis</artifactId>
            <version>3.5.16</version>
        </dependency>
        <!-- MySQL 驱动依赖 -->
        <dependency>
            <groupId>mysql</groupId>
            <artifactId>mysql-connector-java</artifactId>
            <version>8.0.33</version>
        </dependency>
```


3.1 阶段一：配置文件加载 → Configuration

入口：

SqlSessionFactoryBuilder.build(inputStream)


```
// SqlSessionFactoryBuilder 部分源码
public SqlSessionFactory build(InputStream inputStream) {
    return build(inputStream, null, null);
}

//把有些内容简化了下哈  如果感观不好，可以去看看源码哈
public SqlSessionFactory build(InputStream inputStream, String environment, Properties properties) {
    try {
        // 1. 创建 XMLConfigBuilder，专门解析 mybatis-config.xml
        XMLConfigBuilder parser = new XMLConfigBuilder(inputStream, environment, properties);
        // 2. 解析配置文件，返回 Configuration 对象
        Configuration config = parser.parse();
        // 3. 构建 DefaultSqlSessionFactory
        return build(config);
    } catch (Exception e) {
        throw ExceptionFactory.wrapException("Error building SqlSession.", e);
    }
}
```


关键点

：

XMLConfigBuilder.parse()

会逐标签解析：

<properties>

、

<settings>

、

<typeAliases>

、

<environments>

、

<mappers>

等

解析完成后，所有配置都封装在

Configuration

对象中，这是 MyBatis 的

全局唯一配置中心

Configuration

里核心字段我们后面会逐个拆解，先记住几个：

protected Environment environment;

数据源和事务工厂

protected Map<String, MappedStatement> mappedStatements;

每个 SQL 对应的 MappedStatement

protected Map<String, Cache> caches;

二级缓存

protected Map<String, ParameterMap> parameterMaps;

protected Map<String, ResultMap> resultMaps;

3.2 阶段二：打开 SqlSession

入口：

factory.openSession()


```
// DefaultSqlSessionFactory 部分源码  没有百分百还原哈
@Override
public SqlSession openSession() {
    return openSessionFromDataSource(configuration.getDefaultExecutorType(), null, false);
}

private SqlSession openSessionFromDataSource(ExecutorType execType, TransactionIsolationLevel level, boolean autoCommit) {
    Transaction tx = null;
    try {
        // 1. 从 Configuration 中获取 Environment
        Environment environment = configuration.getEnvironment();
        // 2. 创建 TransactionFactory 和 Transaction
        TransactionFactory transactionFactory = getTransactionFactoryFromEnvironment(environment);
        tx = transactionFactory.newTransaction(environment.getDataSource(), level, autoCommit);
        // 3. 创建 Executor
        Executor executor = configuration.newExecutor(tx, execType);
        // 4. 包装成 DefaultSqlSession
        return new DefaultSqlSession(configuration, executor, autoCommit);
    } catch (Exception e) {
        closeTransaction(tx);
        throw ExceptionFactory.wrapException("Error opening session.  Cause: " + e, e);
    }
}
```


关键点

：

每次

openSession

都会新建一个

SqlSession

SqlSession

持有

Configuration

和

Executor

Executor

的类型由配置决定：

SIMPLE

（默认）、

REUSE

（复用 Statement）、

BATCH

（批量执行）

3.3 阶段三：获取 Mapper 代理对象

入口：

session.getMapper(UserMapper.class)


```
// DefaultSqlSession 部分源码
@Override
public <T> T getMapper(Class<T> type) {
    return configuration.getMapper(type, this);
}

// Configuration 部分源码
public <T> T getMapper(Class<T> type, SqlSession sqlSession) {
    return mapperRegistry.getMapper(type, sqlSession);
}

// MapperRegistry 部分源码
public <T> T getMapper(Class<T> type, SqlSession sqlSession) {
    // 从 knownMappers 中获取 MapperProxyFactory
    final MapperProxyFactory<T> mapperProxyFactory = (MapperProxyFactory<T>) knownMappers.get(type);
    if (mapperProxyFactory == null) {
        throw new BindingException("Type " + type + " is not known to the MapperRegistry.");
    }
    try {
        // 通过工厂创建动态代理
        return mapperProxyFactory.newInstance(sqlSession);
    } catch (Exception e) {
        throw new BindingException("Error getting mapper instance. Cause: " + e, e);
    }
}

// MapperProxyFactory 部分源码
public T newInstance(SqlSession sqlSession) {
    // MapperProxy 实现了 InvocationHandler
    final MapperProxy<T> mapperProxy = new MapperProxy<>(sqlSession, mapperInterface, methodCache);
    return newInstance(mapperProxy);
}

protected T newInstance(MapperProxy<T> mapperProxy) {
    // JDK 动态代理
    return (T) Proxy.newProxyInstance(mapperInterface.getClassLoader(), new Class[] { mapperInterface }, mapperProxy);
}
```


关键点

：

我们调用 

getMapper

 返回的是一个基于 JDK 动态代理生成的代理对象，它实现了 UserMapper 接口，所有方法调用都会被 MapperProxy 的 invoke 方法拦截处理

真正干活的是 

MapperProxy

 的 

invoke

 方法，这是 MyBatis 最巧妙的设计之一

3.4 阶段四：执行 SQL → 结果返回

入口：

mapper.selectById(1)

由于 

mapper

 是代理对象，调用任何方法都会进入 

MapperProxy.invoke()

：


```
// MapperProxy.invoke 核心逻辑（简化版）
@Override
public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    // 如果是 Object 类的方法（toString等）直接执行
    if (Object.class.equals(method.getDeclaringClass())) {
        return method.invoke(this, args);
    }
    // 核心：从缓存或新建 MapperMethod，然后执行
    return cachedInvoker(method).invoke(proxy, method, args, sqlSession);
}
```


最终会调用到

SqlSession

的

selectOne

/

selectList

等：


```
// DefaultSqlSession 部分源码
@Override
public <E> List<E> selectList(String statement, Object parameter, RowBounds rowBounds) {
    return selectList(statement, parameter, rowBounds, Executor.NO_RESULT_HANDLER);
}

private <E> List<E> selectList(String statement, Object parameter, RowBounds rowBounds, ResultHandler handler) {
    try {
        // 1. 从 Configuration 中获取 MappedStatement
      MappedStatement ms = configuration.getMappedStatement(statement);
      dirty |= ms.isDirtySelect();
        // 2. 交给 Executor 执行
      return executor.query(ms, wrapCollection(parameter), rowBounds, handler);
    } catch (Exception e) {
      throw ExceptionFactory.wrapException("Error querying database.  Cause: " + e, e);
    } finally {
      ErrorContext.instance().reset();
    }
  }
```


Executor.query()

是核心：


```
// CachingExecutor 部分源码
@Override
public <E> List<E> query(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler) throws SQLException {
    // 1. 获取 BoundSql（解析 #{} 后的 SQL，带 ? 占位符）
    BoundSql boundSql = ms.getBoundSql(parameter);
    // 2. 生成缓存 Key
    CacheKey key = createCacheKey(ms, parameter, rowBounds, boundSql);
    // 3. 后续深入追踪会继续调用executo的query方法
    return query(ms, parameter, rowBounds, resultHandler, key, boundSql);
}

// 实际执行  BaseExecutor 部分源码
@Override
public <E> List<E> query(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler, CacheKey key, BoundSql boundSql) throws SQLException {
    // 1. 一级缓存
    List<E> list = resultHandler == null ? (List<E>) localCache.getObject(key) : null;
    if (list != null) {
        // 缓存命中，处理存储过程 OUT 参数
        handleLocallyCachedOutputParameters(ms, key, parameter, boundSql);
    } else {
        // 未命中，从数据库查询
        list = queryFromDatabase(ms, parameter, rowBounds, resultHandler, key, boundSql);
    }
    return list;
}

private <E> List<E> queryFromDatabase(MappedStatement ms, Object parameter, RowBounds rowBounds,
      ResultHandler resultHandler, CacheKey key, BoundSql boundSql) {
    List<E> list;
    localCache.putObject(key, EXECUTION_PLACEHOLDER);
    try {
        // 调用 doQuery 真正执行 JDBC
        list = doQuery(ms, parameter, rowBounds, resultHandler, boundSql);
    } finally {
        localCache.removeObject(key);
    }
    localCache.putObject(key, list);
    return list;
}
```


doQuery

最终会调用

SimpleExecutor

：


```
// SimpleExecutor 部分源码
@Override
public <E> List<E> doQuery(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) throws SQLException {
    Statement stmt = null;
    try {
        Configuration configuration = ms.getConfiguration();
        // 1. 创建 StatementHandler
        StatementHandler handler = configuration.newStatementHandler(wrapper, ms, parameter, rowBounds, resultHandler, boundSql);
        // 2. 预编译 SQL
        stmt = prepareStatement(handler, ms.getStatementLog());
        // 3. 执行并处理结果集
        return handler.query(stmt, resultHandler);
    } finally {
        closeStatement(stmt);
    }
}

private Statement prepareStatement(StatementHandler handler, Log statementLog) throws SQLException {
    Statement stmt;
    // 获取数据库连接
    Connection connection = getConnection(statementLog);
    // 创建 Statement
    stmt = handler.prepare(connection, transaction.getTimeout());
    // 设置参数（#{} 占位符被替换成 ? 后，这里设置实际参数值）
    handler.parameterize(stmt);
    return stmt;
}
```


StatementHandler里继续调用ParameterHandler和 ResultSetHandler

，最终用 JDBC 执行 SQL 并返回结果。

四、总结：一条 SQL 的完整旅程


```
1. 加载 mybatis-config.xml → 生成 Configuration（全局配置）
2. SqlSessionFactoryBuilder.build() → 创建 DefaultSqlSessionFactory
3. factory.openSession() → 创建 SqlSession（持有 Configuration + Executor）
4. session.getMapper() → JDK 动态代理 → MapperProxy
5. 调用 mapper 方法 → MapperProxy.invoke() → MapperMethod.execute()
6. MapperMethod 调用 SqlSession.selectOne/selectList
7. SqlSession 从 Configuration 获取 MappedStatement
8. Executor 处理缓存（一级缓存），然后调用 doQuery
9. StatementHandler 创建 Statement、预编译 SQL
10. ParameterHandler 设置参数
11. 执行 SQL (JDBC)
12. ResultSetHandler 处理结果集 → 返回 List/对象
13. 层层返回，最终拿到结果
```


五、面试高频题（附回答思路）

Q1：MyBatis 的核心组件有哪些？它们是如何协作的？

回答思路

：

Configuration：配置中心，保存解析后的所有配置

SqlSession：对外 API 门面

Executor：执行器，负责缓存和 SQL 执行调度

StatementHandler：处理 JDBC Statement

ParameterHandler：设置参数

ResultSetHandler：封装结果集

MapperProxy：接口的动态代理入口

Q2：MyBatis 为什么可以做到只写接口不写实现类？

回答思路

：

MyBatis 使用 JDK 动态代理，在

getMapper

时返回

MapperProxy

代理对象

调用接口方法时，

MapperProxy.invoke()

拦截并解析方法名、参数

根据方法名找到对应的

MappedStatement

，调用

SqlSession

去执行

Q3：MyBatis 和 JDBC 的关系是什么？

回答思路

：

MyBatis 底层仍然基于 JDBC 操作数据库

MyBatis 做了封装：自动注册驱动、获取连接、预编译、设参、结果映射、异常处理、资源关闭

同时提供了动态 SQL、缓存、插件等高级特性

六、下篇预告

第 2 篇我们会深入

Configuration

的创建过程，逐行分析

mybatis-config.xml 的加载和解析

，包括：

properties 加载顺序

settings 各个配置项的作用

typeAliases 别名注册

environments 数据源解析

mappers 映射文件注册

以及

XMLConfigBuilder

、

XPathParser

等源码级的细节。

如果觉得有帮助，欢迎点赞、在看、转发支持！

系列持续更新中，关注不走丢 

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
