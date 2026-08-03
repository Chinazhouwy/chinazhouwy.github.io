---
title: "MyBatis 源码深度拆解（五）：Executor 执行器设计与实现"
date: "2026-06-28"
domain: "学习"
area: "Java 后端"
module: "MyBatis 源码拆解"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "一、回顾与开篇 前几篇我们已经看到， SqlSession 是门面，真正的数据库操作委托给了 Executor 。 Ex…"
tags:
  - "MyBatis"
  - "源码分析"
---

# MyBatis 源码深度拆解（五）：Executor 执行器设计与实现

> 来源：微信公众号（MyBatis 源码深度拆解系列）
> 链接：[http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484033&idx=1&sn=68c71525ef8f4d881c7da1f4159902ab&chksm=c2b810def5cf99c8fa181d67b4486e6ebceeb89ffdf81e9f429022e6427699726a3dc9185efe](http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484033&idx=1&sn=68c71525ef8f4d881c7da1f4159902ab&chksm=c2b810def5cf99c8fa181d67b4486e6ebceeb89ffdf81e9f429022e6427699726a3dc9185efe)
> 类型：📚 参考资料（非面试题/面经）—— MyBatis 源码深度拆解系列
> 相关：第48题(深分页优化)、第235题(百万行导出分页查询)
> 整理时间：2026-08-03

---

一、回顾与开篇

前几篇我们已经看到，

SqlSession

是门面，真正的数据库操作委托给了

Executor

。

Executor

是 MyBatis 执行调度的核心，负责：

SQL 执行

：调用

StatementHandler

完成 JDBC 操作

缓存管理

：一级缓存（

BaseExecutor

实现）

事务控制

：提交、回滚、关闭

批处理

：

BatchExecutor

批量执行

本篇目标

：

拆解Executor三级继承体系：

SimpleExecutor

/

ReuseExecutor

/

BatchExecutor

理解

CachingExecutor

如何用装饰器模式包装二级缓存

追踪 SQL 执行完整链路（从

Executor.query

到 JDBC）

理解事务与执行器的绑定关系

二、Executor 整体概述

关键点

：

BaseExecutor

实现了公共逻辑（一级缓存、事务管理），定义三个抽象模板方法：

doQuery

、

doUpdate

、

doFlushStatements

三个子类实现不同的 Statement 处理策略

CachingExecutor

 装饰任意 

Executor

，添加二级缓存能力

三、Executor 创建与选择时机

回顾第 4 篇提到的 

Configuration.newExecutor()

：


```
<code><span leaf=""><span class="code-snippet__comment">// Configuration</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">Executor</span> <span class="code-snippet__title">newExecutor</span>(<span class="code-snippet__params"><span class="code-snippet__title">Transaction</span></span><span class="code-snippet__params"> transaction, </span><span class="code-snippet__params"><span class="code-snippet__title">ExecutorType</span></span><span class="code-snippet__params"> executorType</span>) {</span></code><code><span leaf="">    executorType = executorType == <span class="code-snippet__literal">null</span> ? defaultExecutorType : executorType;</span></code><code><span leaf="">    <span class="code-snippet__title">Executor</span> executor;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 1. 根据类型创建基础执行器</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (<span class="code-snippet__title">ExecutorType</span>.<span class="code-snippet__property">BATCH</span> == executorType) {</span></code><code><span leaf="">        executor = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">BatchExecutor</span>(<span class="code-snippet__variable">this</span>, transaction);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">else</span> <span class="code-snippet__keyword">if</span> (<span class="code-snippet__title">ExecutorType</span>.<span class="code-snippet__property">REUSE</span> == executorType) {</span></code><code><span leaf="">        executor = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">ReuseExecutor</span>(<span class="code-snippet__variable">this</span>, transaction);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">        executor = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">SimpleExecutor</span>(<span class="code-snippet__variable">this</span>, transaction);</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 2. 如果开启二级缓存，用装饰器模式包装</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (cacheEnabled) {</span></code><code><span leaf="">        executor = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">CachingExecutor</span>(executor);</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 3. 执行插件链（责任链）</span></span></code><code><span leaf="">    executor = (<span class="code-snippet__title">Executor</span>) interceptorChain.<span class="code-snippet__title">pluginAll</span>(executor);</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> executor;</span></code><code><span leaf="">}</span></code>
```


创建时机

：每次

SqlSessionFactory.openSession()

都会创建一个新的

Executor

实例。

Executor

与

SqlSession

生命周期一致。

事务绑定

：

Executor

构造函数接收

Transaction

对象，该对象封装了数据库连接和事务控制方法。同一个

SqlSession

下的所有 Mapper 调用共享同一个

Executor

，也就共享同一个数据库连接和一级缓存。

四、BaseExecutor：模板方法 + 一级缓存

BaseExecutor

是抽象类，实现了公共逻辑，特别是

一级缓存

。

4.1 一级缓存结构


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">abstract</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">BaseExecutor</span> <span class="code-snippet__keyword">implements</span> <span class="code-snippet__title">Executor</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> PerpetualCache localCache;  <span class="code-snippet__comment">// 一级缓存</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> PerpetualCache localOutputParameterCache; <span class="code-snippet__comment">// 存储过程输出参数缓存</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> Transaction transaction;</span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> <span class="code-snippet__type">boolean</span> closed;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">BaseExecutor</span><span class="code-snippet__params">(Configuration configuration, Transaction transaction)</span> {</span></code><code><span leaf="">        <span class="code-snippet__built_in">this</span>.transaction = transaction;</span></code><code><span leaf="">        <span class="code-snippet__built_in">this</span>.localCache = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">PerpetualCache</span>(<span class="code-snippet__string">"LocalCache"</span>);</span></code><code><span leaf="">        <span class="code-snippet__built_in">this</span>.localOutputParameterCache = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">PerpetualCache</span>(<span class="code-snippet__string">"LocalOutputParameterCache"</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


4.2 查询方法（带一级缓存）


```
<code><span leaf=""><span class="code-snippet__comment">// BaseExecutor</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <E> <span class="code-snippet__title">List</span><E> <span class="code-snippet__title">query</span>(<span class="code-snippet__params"><span class="code-snippet__title">MappedStatement</span></span><span class="code-snippet__params"> ms, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameter, </span><span class="code-snippet__params"><span class="code-snippet__title">RowBounds</span></span><span class="code-snippet__params"> rowBounds, </span></span></code><code><span leaf="">                         <span class="code-snippet__title">ResultHandler</span> resultHandler, <span class="code-snippet__title">CacheKey</span> key, <span class="code-snippet__title">BoundSql</span> boundSql) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (closed) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">ExecutorException</span>(<span class="code-snippet__string">"Executor was closed."</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__comment">// 1. 清空本地缓存（若配置了 flushCache=true）</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (queryStack == <span class="code-snippet__number">0</span> && ms.<span class="code-snippet__title">isFlushCacheRequired</span>()) {</span></code><code><span leaf="">        <span class="code-snippet__title">clearLocalCache</span>();</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__title">List</span><E> list;</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        queryStack++;</span></code><code><span leaf="">        <span class="code-snippet__comment">// 2. 从一级缓存获取</span></span></code><code><span leaf="">        list = resultHandler == <span class="code-snippet__literal">null</span> ? (<span class="code-snippet__title">List</span><E>) localCache.<span class="code-snippet__title">getObject</span>(key) : <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (list != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 缓存命中，处理存储过程的输出参数</span></span></code><code><span leaf="">            <span class="code-snippet__title">handleLocallyCachedOutputParameters</span>(ms, key, parameter, boundSql);</span></code><code><span leaf="">        } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 3. 未命中，从数据库查询</span></span></code><code><span leaf="">            list = <span class="code-snippet__title">queryFromDatabase</span>(ms, parameter, rowBounds, resultHandler, key, boundSql);</span></code><code><span leaf="">        }</span></code><code><span leaf="">    } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">        queryStack--;</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> list;</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__keyword">private</span> <E> <span class="code-snippet__title">List</span><E> <span class="code-snippet__title">queryFromDatabase</span>(<span class="code-snippet__params">...</span>) {</span></code><code><span leaf="">    <span class="code-snippet__title">List</span><E> list;</span></code><code><span leaf="">    localCache.<span class="code-snippet__title">putObject</span>(key, <span class="code-snippet__variable">EXECUTION_PLACEHOLDER</span>); <span class="code-snippet__comment">// 占位符，防止并发重复查询</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        list = <span class="code-snippet__title">doQuery</span>(ms, parameter, rowBounds, resultHandler, boundSql);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">        localCache.<span class="code-snippet__title">removeObject</span>(key);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    localCache.<span class="code-snippet__title">putObject</span>(key, list);  <span class="code-snippet__comment">// 放入缓存</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> list;</span></code><code><span leaf="">}</span></code>
```


一级缓存关键点

：

生命周期 = SqlSession 生命周期，SqlSession 关闭时缓存销毁

执行

update/insert/delete

时会

clearLocalCache()

，保证数据一致性

默认开启，且不能关闭（除非设置 

localCacheScope=STATEMENT

，每次查询后清空）

4.3 更新方法（清空缓存）


```
<code><span leaf=""><span class="code-snippet__comment">// BaseExecutor</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> int <span class="code-snippet__title">update</span>(<span class="code-snippet__params"><span class="code-snippet__title">MappedStatement</span></span><span class="code-snippet__params"> ms, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameter</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (closed) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">ExecutorException</span>(<span class="code-snippet__string">"Executor was closed."</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__title">clearLocalCache</span>();  <span class="code-snippet__comment">// 更新操作会清空一级缓存</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">doUpdate</span>(ms, parameter);</span></code><code><span leaf="">}</span></code>
```


4.4 事务与连接管理


```
<code><span leaf=""><span class="code-snippet__comment">// BaseExecutor</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">void</span> <span class="code-snippet__title">commit</span><span class="code-snippet__params">(</span><span class="code-snippet__params"><span class="code-snippet__type">boolean</span></span><span class="code-snippet__params"> required)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (closed) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">ExecutorException</span>(<span class="code-snippet__string">"Cannot commit, transaction is already closed"</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    clearLocalCache();  <span class="code-snippet__comment">// 提交前清空一级缓存</span></span></code><code><span leaf="">    flushStatements();  <span class="code-snippet__comment">// 刷新批处理语句（BatchExecutor 会用到）</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (required) {</span></code><code><span leaf="">        transaction.commit();  <span class="code-snippet__comment">// 提交事务</span></span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">void</span> <span class="code-snippet__title">close</span><span class="code-snippet__params">(</span><span class="code-snippet__params"><span class="code-snippet__type">boolean</span></span><span class="code-snippet__params"> forceRollback)</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 1. 根据 forceRollback 决定提交还是回滚</span></span></code><code><span leaf="">            rollback(forceRollback);   <span class="code-snippet__comment">// 注意：这里调用的就是 rollback，不是 commit！</span></span></code><code><span leaf="">        } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 2. 关闭事务（释放数据库连接）</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (transaction != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">                transaction.close();</span></code><code><span leaf="">            }</span></code><code><span leaf="">        }</span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (SQLException e) {</span></code><code><span leaf="">        log.warn(<span class="code-snippet__string">"Unexpected exception on closing transaction.  Cause: "</span> + e);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 3. 清空所有缓存和引用，标记 closed = true</span></span></code><code><span leaf="">        transaction = <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">        deferredLoads = <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">        localCache = <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">        localOutputParameterCache = <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">        closed = <span class="code-snippet__literal">true</span>;</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">void</span> <span class="code-snippet__title">rollback</span><span class="code-snippet__params">(</span><span class="code-snippet__params"><span class="code-snippet__type">boolean</span></span><span class="code-snippet__params"> required)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (!closed) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 清空一级缓存</span></span></code><code><span leaf="">            clearLocalCache();</span></code><code><span leaf="">            <span class="code-snippet__comment">// 刷新批处理语句（如果有）</span></span></code><code><span leaf="">            flushStatements(<span class="code-snippet__literal">true</span>);</span></code><code><span leaf="">        } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 如果 required=true 或者当前连接不是自动提交模式，则执行回滚</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (required) {</span></code><code><span leaf="">                transaction.rollback();</span></code><code><span leaf="">            }</span></code><code><span leaf="">        }</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


为什么是 

rollback

 而不是 

commit

？

BaseExecutor 的 close(boolean forceRollback) 方法体现了 MyBatis 对数据安全的谨慎态度：

当调用 close(true) 关闭执行器时，会先执行 rollback(true) 来回滚未提交的事务，而不是尝试提交。

当调用 close(false) 时，则不会主动回滚，交由事务管理器处理。

这种“宁可回滚也不提交”的设计，避免了在不确定的情况下持久化脏数据。同时，Executor 不直接操作数据库连接，而是通过 Transaction 对象代理，由 TransactionFactory 创建 JdbcTransaction 或 ManagedTransaction，实现了事务与执行器的解耦。

在不确定的情况下，宁可回滚也不提交，避免脏数据持久化。

事务绑定：

transaction

对象持有数据库连接，由

TransactionFactory

创建（

JdbcTransaction或ManagedTransaction

）。

Executor

不直接操作连接，而是通过transaction代理。

五、三大基础执行器对比

5.1 SimpleExecutor（默认）

每次执行 SQL 都创建新的 

Statement

，用完后立即关闭。


```
<code><span leaf=""><span class="code-snippet__comment">// SimpleExecutor</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <E> List<E> <span class="code-snippet__title">doQuery</span><span class="code-snippet__params">(MappedStatement ms, Object parameter, RowBounds rowBounds, </span></span></code><code><span leaf="">                           ResultHandler resultHandler, BoundSql boundSql) {</span></code><code><span leaf="">    <span class="code-snippet__type">Statement</span> <span class="code-snippet__variable">stmt</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__type">Configuration</span> <span class="code-snippet__variable">configuration</span> <span class="code-snippet__operator">=</span> ms.getConfiguration();</span></code><code><span leaf="">        <span class="code-snippet__comment">// 1. 创建 StatementHandler</span></span></code><code><span leaf="">        <span class="code-snippet__type">StatementHandler</span> <span class="code-snippet__variable">handler</span> <span class="code-snippet__operator">=</span> configuration.newStatementHandler(<span class="code-snippet__built_in">this</span>, ms, parameter, </span></code><code><span leaf="">                                            rowBounds, resultHandler, boundSql);</span></code><code><span leaf="">        <span class="code-snippet__comment">// 2. 预编译 SQL</span></span></code><code><span leaf="">        stmt = prepareStatement(handler, ms.getStatementLog());</span></code><code><span leaf="">        <span class="code-snippet__comment">// 3. 执行查询并映射结果</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> handler.query(stmt, resultHandler);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">        closeStatement(stmt);  <span class="code-snippet__comment">// 关闭 Statement</span></span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__keyword">private</span> Statement <span class="code-snippet__title">prepareStatement</span><span class="code-snippet__params">(StatementHandler handler, Log statementLog)</span> {</span></code><code><span leaf="">    Statement stmt;</span></code><code><span leaf="">    <span class="code-snippet__type">Connection</span> <span class="code-snippet__variable">connection</span> <span class="code-snippet__operator">=</span> getConnection(statementLog);</span></code><code><span leaf="">    stmt = handler.prepare(connection, transaction.getTimeout());</span></code><code><span leaf="">    handler.parameterize(stmt);</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> stmt;</span></code><code><span leaf="">}</span></code>
```


特点

：简单直接，适合非频繁调用的 SQL。

5.2 ReuseExecutor

复用 

Statement

，避免重复预编译。内部维护一个 

Map<String, Statement>

，key 是 SQL 字符串。


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">ReuseExecutor</span> <span class="code-snippet__keyword">extends</span> <span class="code-snippet__title">BaseExecutor</span> {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 核心缓存：SQL 字符串 -> Statement 对象</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">final</span> Map<String, Statement> statementMap = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">HashMap</span><>();</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <E> List<E> <span class="code-snippet__title">doQuery</span><span class="code-snippet__params">(MappedStatement ms, Object parameter, RowBounds rowBounds, </span></span></code><code><span leaf="">                               ResultHandler resultHandler, BoundSql boundSql) <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">        <span class="code-snippet__type">Configuration</span> <span class="code-snippet__variable">configuration</span> <span class="code-snippet__operator">=</span> ms.getConfiguration();</span></code><code><span leaf="">        <span class="code-snippet__type">StatementHandler</span> <span class="code-snippet__variable">handler</span> <span class="code-snippet__operator">=</span> configuration.newStatementHandler(wrapper, ms, parameter, rowBounds, resultHandler, boundSql);</span></code><code><span leaf="">        <span class="code-snippet__type">Statement</span> <span class="code-snippet__variable">stmt</span> <span class="code-snippet__operator">=</span> prepareStatement(handler, ms.getStatementLog());</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> handler.query(stmt, resultHandler);</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 核心复用逻辑在 prepareStatement 方法中</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> Statement <span class="code-snippet__title">prepareStatement</span><span class="code-snippet__params">(StatementHandler handler, Log statementLog)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">        Statement stmt;</span></code><code><span leaf="">        <span class="code-snippet__type">BoundSql</span> <span class="code-snippet__variable">boundSql</span> <span class="code-snippet__operator">=</span> handler.getBoundSql();</span></code><code><span leaf="">        <span class="code-snippet__type">String</span> <span class="code-snippet__variable">sql</span> <span class="code-snippet__operator">=</span> boundSql.getSql();               <span class="code-snippet__comment">// 获取 SQL 字符串作为缓存 key</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (hasStatementFor(sql)) {                  <span class="code-snippet__comment">// 检查缓存中是否有该 SQL 对应的 Statement</span></span></code><code><span leaf="">            stmt = getStatement(sql);                 <span class="code-snippet__comment">// 从缓存取</span></span></code><code><span leaf="">            applyTransactionTimeout(stmt);            <span class="code-snippet__comment">// 应用事务超时设置</span></span></code><code><span leaf="">        } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">            <span class="code-snippet__type">Connection</span> <span class="code-snippet__variable">connection</span> <span class="code-snippet__operator">=</span> getConnection(statementLog);</span></code><code><span leaf="">            stmt = handler.prepare(connection, transaction.getTimeout()); <span class="code-snippet__comment">// 创建新 Statement</span></span></code><code><span leaf="">            putStatement(sql, stmt);                  <span class="code-snippet__comment">// 放入缓存</span></span></code><code><span leaf="">        }</span></code><code><span leaf="">        handler.parameterize(stmt);                   <span class="code-snippet__comment">// 设置参数（每次都必须重新设参）</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> stmt;</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


适用场景

：同一个会话中多次执行相同 SQL（如循环内重复查询）。可以减少每次创建 

Statement

 的开销。

关键机制解读

1. Statement 缓存的 Key 是

SQL 字符串


```
<code><span leaf=""><span class="code-snippet__title">String</span> sql = boundSql.<span class="code-snippet__title">getSql</span>();</span></code>
```


注意：这里用的是

BoundSql.getSql()

，即

已经完成

#{}

替换成

?

之后的 SQL 模板

。所以即使参数不同，只要 SQL 模板相同（比如

SELECT * FROM user WHERE id = ?

），就会复用同一个

PreparedStatement

对象。

复用前提

：SQL 模板必须完全相同（包括空格、换行等）。否则会生成新的 Statement。

2. 复用时需要重新设置参数


```
<code><span leaf="">stmt = <span class="code-snippet__title">getStatement</span>(sql);           <span class="code-snippet__comment">// 复用旧的 Statement</span></span></code><code><span leaf=""><span class="code-snippet__title">applyTransactionTimeout</span>(stmt);      <span class="code-snippet__comment">// 刷新超时设置</span></span></code><code><span leaf="">handler.<span class="code-snippet__title">parameterize</span>(stmt);         <span class="code-snippet__comment">// 重新设置参数（重要！）</span></span></code>
```


同一个 PreparedStatement 可以被多次执行，但每次执行前必须重新绑定参数值。在 ReuseExecutor.prepareStatement 中，会通过 

StatementHandler.parameterize(stmt)

 完成参数设置，该方法内部最终调用 

ParameterHandler.setParameters(ps)

 将参数绑定到 PreparedStatement。

3. 缓存生命周期

缓存

statementMap

是

ReuseExecutor

实例级别的，即同一个

ReuseExecutor

对象（对应同一个

SqlSession

）中有效。

当执行

doFlushStatements

（通常在

commit

/

rollback

/

close

时触发）时，所有缓存的 Statement 被关闭并清空。

如果执行了 DML 操作（update/insert/delete），

BaseExecutor

会调用

clearLocalCache()

，但

不会清空

statementMap

。

statementMap

只在

doFlushStatements

或 Executor 关闭时清空。

4. 与 SimpleExecutor 的核心区别

维度

SimpleExecutor

ReuseExecutor

Statement 创建策略

每次 doQuery/doUpdate 都创建新 Statement，用后立即关闭

缓存 Statement，相同 SQL 复用，执行后不关闭（放回缓存）

缓存清除时机

无跨方法缓存

commit/rollback/close 时清空缓存

适用场景

通用，SQL 变化较多

同一 Session 内大量重复 SQL（如循环内相同查询）

资源占用

频繁创建/销毁 Statement

保持 Statement 打开，占用数据库端资源

5.3 BatchExecutor

批量执行，将多条 SQL 累积到一批，一次性发送给数据库。


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">BatchExecutor</span> <span class="code-snippet__keyword">extends</span> <span class="code-snippet__title">BaseExecutor</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">static</span> <span class="code-snippet__keyword">final</span> <span class="code-snippet__type">int</span> <span class="code-snippet__variable">BATCH_UPDATE_RETURN_VALUE</span> <span class="code-snippet__operator">=</span> Integer.MIN_VALUE + <span class="code-snippet__number">1002</span>;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">final</span> List<Statement> statementList = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">ArrayList</span><>();</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">final</span> List<BatchResult> batchResultList = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">ArrayList</span><>();</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> String currentSql;</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> MappedStatement currentStatement;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// doUpdate 核心逻辑</span></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__type">int</span> <span class="code-snippet__title">doUpdate</span><span class="code-snippet__params">(MappedStatement ms, Object parameterObject)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">        <span class="code-snippet__keyword">final</span> <span class="code-snippet__type">Configuration</span> <span class="code-snippet__variable">configuration</span> <span class="code-snippet__operator">=</span> ms.getConfiguration();</span></code><code><span leaf="">        <span class="code-snippet__keyword">final</span> <span class="code-snippet__type">StatementHandler</span> <span class="code-snippet__variable">handler</span> <span class="code-snippet__operator">=</span> configuration.newStatementHandler(<span class="code-snippet__built_in">this</span>, ms, parameterObject, RowBounds.DEFAULT, <span class="code-snippet__literal">null</span>, <span class="code-snippet__literal">null</span>);</span></code><code><span leaf="">        <span class="code-snippet__keyword">final</span> <span class="code-snippet__type">BoundSql</span> <span class="code-snippet__variable">boundSql</span> <span class="code-snippet__operator">=</span> handler.getBoundSql();</span></code><code><span leaf="">        <span class="code-snippet__keyword">final</span> <span class="code-snippet__type">String</span> <span class="code-snippet__variable">sql</span> <span class="code-snippet__operator">=</span> boundSql.getSql();</span></code><code><span leaf="">        <span class="code-snippet__keyword">final</span> Statement stmt;</span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (sql.equals(currentSql) && ms.equals(currentStatement)) {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 相同 SQL 和 MappedStatement：复用当前批次的最后一个 Statement</span></span></code><code><span leaf="">            <span class="code-snippet__type">int</span> <span class="code-snippet__variable">last</span> <span class="code-snippet__operator">=</span> statementList.size() - <span class="code-snippet__number">1</span>;</span></code><code><span leaf="">            stmt = statementList.get(last);</span></code><code><span leaf="">            applyTransactionTimeout(stmt);</span></code><code><span leaf="">            handler.parameterize(stmt);</span></code><code><span leaf="">            <span class="code-snippet__type">BatchResult</span> <span class="code-snippet__variable">batchResult</span> <span class="code-snippet__operator">=</span> batchResultList.get(last);</span></code><code><span leaf="">            batchResult.addParameterObject(parameterObject);</span></code><code><span leaf="">        } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 不同的 SQL 或 MappedStatement：创建新的 Statement，开始新批次</span></span></code><code><span leaf="">            <span class="code-snippet__type">Connection</span> <span class="code-snippet__variable">connection</span> <span class="code-snippet__operator">=</span> getConnection(ms.getStatementLog());</span></code><code><span leaf="">            stmt = handler.prepare(connection, transaction.getTimeout());</span></code><code><span leaf="">            handler.parameterize(stmt);</span></code><code><span leaf="">            currentSql = sql;</span></code><code><span leaf="">            currentStatement = ms;</span></code><code><span leaf="">            statementList.add(stmt);</span></code><code><span leaf="">            batchResultList.add(<span class="code-snippet__keyword">new</span> <span class="code-snippet__title">BatchResult</span>(ms, sql, parameterObject));</span></code><code><span leaf="">        }</span></code><code><span leaf="">        handler.batch(stmt);  <span class="code-snippet__comment">// 将当前参数添加到批处理中</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> BATCH_UPDATE_RETURN_VALUE; <span class="code-snippet__comment">// 占位返回值，实际影响行数在 flush 时获取</span></span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// doQuery 会先 flush 批次</span></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <E> List<E> <span class="code-snippet__title">doQuery</span><span class="code-snippet__params">(MappedStatement ms, Object parameterObject, RowBounds rowBounds,</span></span></code><code><span leaf="">      ResultHandler resultHandler, BoundSql boundSql) <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">        <span class="code-snippet__type">Statement</span> <span class="code-snippet__variable">stmt</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">        <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">            flushStatements();  <span class="code-snippet__comment">// 查询前必须执行已有批次</span></span></code><code><span leaf="">            <span class="code-snippet__type">Configuration</span> <span class="code-snippet__variable">configuration</span> <span class="code-snippet__operator">=</span> ms.getConfiguration();</span></code><code><span leaf="">            <span class="code-snippet__type">StatementHandler</span> <span class="code-snippet__variable">handler</span> <span class="code-snippet__operator">=</span> configuration.newStatementHandler(wrapper, ms, parameterObject, rowBounds, resultHandler, boundSql);</span></code><code><span leaf="">            <span class="code-snippet__type">Connection</span> <span class="code-snippet__variable">connection</span> <span class="code-snippet__operator">=</span> getConnection(ms.getStatementLog());</span></code><code><span leaf="">            stmt = handler.prepare(connection, transaction.getTimeout());</span></code><code><span leaf="">            handler.parameterize(stmt);</span></code><code><span leaf="">            <span class="code-snippet__keyword">return</span> handler.query(stmt, resultHandler);</span></code><code><span leaf="">        } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">            closeStatement(stmt);</span></code><code><span leaf="">        }</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 真正执行批次并返回结果</span></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> List<BatchResult> <span class="code-snippet__title">doFlushStatements</span><span class="code-snippet__params">(</span><span class="code-snippet__params"><span class="code-snippet__type">boolean</span></span><span class="code-snippet__params"> isRollback)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">        <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">            List<BatchResult> results = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">ArrayList</span><>();</span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (isRollback) {</span></code><code><span leaf="">                <span class="code-snippet__keyword">return</span> Collections.emptyList();  <span class="code-snippet__comment">// 回滚时不返回结果</span></span></code><code><span leaf="">            }</span></code><code><span leaf="">            <span class="code-snippet__keyword">for</span> (<span class="code-snippet__type">int</span> <span class="code-snippet__variable">i</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__number">0</span>, n = statementList.size(); i < n; i++) {</span></code><code><span leaf="">                <span class="code-snippet__type">Statement</span> <span class="code-snippet__variable">stmt</span> <span class="code-snippet__operator">=</span> statementList.get(i);</span></code><code><span leaf="">                applyTransactionTimeout(stmt);</span></code><code><span leaf="">                <span class="code-snippet__type">BatchResult</span> <span class="code-snippet__variable">batchResult</span> <span class="code-snippet__operator">=</span> batchResultList.get(i);</span></code><code><span leaf="">                <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">                    batchResult.setUpdateCounts(stmt.executeBatch());  <span class="code-snippet__comment">// 执行批处理</span></span></code><code><span leaf="">                    <span class="code-snippet__comment">// 处理自增主键回填（Jdbc3KeyGenerator）</span></span></code><code><span leaf="">                    <span class="code-snippet__type">MappedStatement</span> <span class="code-snippet__variable">ms</span> <span class="code-snippet__operator">=</span> batchResult.getMappedStatement();</span></code><code><span leaf="">                    List<Object> parameterObjects = batchResult.getParameterObjects();</span></code><code><span leaf="">                    <span class="code-snippet__type">KeyGenerator</span> <span class="code-snippet__variable">keyGenerator</span> <span class="code-snippet__operator">=</span> ms.getKeyGenerator();</span></code><code><span leaf="">                    <span class="code-snippet__keyword">if</span> (Jdbc3KeyGenerator.class.equals(keyGenerator.getClass())) {</span></code><code><span leaf="">                        ((Jdbc3KeyGenerator) keyGenerator).processBatch(ms, stmt, parameterObjects);</span></code><code><span leaf="">                    } <span class="code-snippet__keyword">else</span> <span class="code-snippet__keyword">if</span> (!NoKeyGenerator.class.equals(keyGenerator.getClass())) {</span></code><code><span leaf="">                        <span class="code-snippet__keyword">for</span> (Object parameter : parameterObjects) {</span></code><code><span leaf="">                            keyGenerator.processAfter(<span class="code-snippet__built_in">this</span>, ms, stmt, parameter);</span></code><code><span leaf="">                        }</span></code><code><span leaf="">                    }</span></code><code><span leaf="">                    closeStatement(stmt);  <span class="code-snippet__comment">// 执行完毕后关闭 Statement</span></span></code><code><span leaf="">                } <span class="code-snippet__keyword">catch</span> (BatchUpdateException e) {</span></code><code><span leaf="">                    <span class="code-snippet__comment">// 异常处理：抛出 BatchExecutorException，携带已成功的结果</span></span></code><code><span leaf="">                    <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">BatchExecutorException</span>(..., e, results, batchResult);</span></code><code><span leaf="">                }</span></code><code><span leaf="">                results.add(batchResult);</span></code><code><span leaf="">            }</span></code><code><span leaf="">            <span class="code-snippet__keyword">return</span> results;</span></code><code><span leaf="">        } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 清理所有资源</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">for</span> (Statement stmt : statementList) {</span></code><code><span leaf="">                closeStatement(stmt);</span></code><code><span leaf="">            }</span></code><code><span leaf="">            currentSql = <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">            statementList.clear();</span></code><code><span leaf="">            batchResultList.clear();</span></code><code><span leaf="">        }</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


适用场景

：批量插入、批量更新（如一次性插入 1000 条记录）。

BatchExecutor 通过 JDBC 的 addBatch() / executeBatch() 机制实现批量执行，将多条 DML（INSERT/UPDATE/DELETE）SQL 累积到一批，一次性发送给数据库，减少网络 IO 开销。

注意：

JDBC 批处理不支持 SELECT 查询。BatchExecutor 的 doQuery 方法会调用 flushStatements() 强制刷新前面未提交的批量操作，因此查询操作会打断批处理流程。建议将批量操作与查询操作分开在不同事务或 SqlSession 中执行，否则可能频繁刷新批次，降低批量的性能优势。

六、CachingExecutor：二级缓存装饰器

二级缓存是 Mapper 级别，跨多个 SqlSession 共享。

CachingExecutor

 通过

装饰器模式

包装基础执行器，在不修改原有逻辑的情况下增强缓存能力。


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">CachingExecutor</span> <span class="code-snippet__keyword">implements</span> <span class="code-snippet__title">Executor</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">final</span> Executor delegate;                     <span class="code-snippet__comment">// 被装饰的执行器</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">final</span> <span class="code-snippet__type">TransactionalCacheManager</span> <span class="code-snippet__variable">tcm</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">TransactionalCacheManager</span>();  <span class="code-snippet__comment">// 事务性缓存管理器</span></span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__title">CachingExecutor</span><span class="code-snippet__params">(Executor delegate)</span> {</span></code><code><span leaf="">        <span class="code-snippet__built_in">this</span>.delegate = delegate;</span></code><code><span leaf="">        delegate.setExecutorWrapper(<span class="code-snippet__built_in">this</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <E> List<E> <span class="code-snippet__title">query</span><span class="code-snippet__params">(MappedStatement ms, Object parameterObject, RowBounds rowBounds,</span></span></code><code><span leaf="">                             ResultHandler resultHandler, CacheKey key, BoundSql boundSql) <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">        <span class="code-snippet__type">Cache</span> <span class="code-snippet__variable">cache</span> <span class="code-snippet__operator">=</span> ms.getCache();                     <span class="code-snippet__comment">// 获取 Mapper 对应的二级缓存对象</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (cache != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">            flushCacheIfRequired(ms);                    <span class="code-snippet__comment">// 如果 <select> 配置了 flushCache=true，清空二级缓存</span></span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (ms.isUseCache() && resultHandler == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">                ensureNoOutParams(ms, boundSql);         <span class="code-snippet__comment">// 存储过程调用且包含 OUT 参数时不能使用缓存</span></span></code><code><span leaf="">                <span class="code-snippet__meta">@SuppressWarnings("unchecked")</span></span></code><code><span leaf="">                List<E> list = (List<E>) tcm.getObject(cache, key);   <span class="code-snippet__comment">// 从事务缓存中获取</span></span></code><code><span leaf="">                <span class="code-snippet__keyword">if</span> (list == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">                    list = delegate.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);</span></code><code><span leaf="">                    tcm.putObject(cache, key, list);     <span class="code-snippet__comment">// 放入事务缓存（暂存，待 commit 时真正写入）</span></span></code><code><span leaf="">                }</span></code><code><span leaf="">                <span class="code-snippet__keyword">return</span> list;</span></code><code><span leaf="">            }</span></code><code><span leaf="">        }</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> delegate.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__type">int</span> <span class="code-snippet__title">update</span><span class="code-snippet__params">(MappedStatement ms, Object parameterObject)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">        flushCacheIfRequired(ms);        <span class="code-snippet__comment">// 如果 <update|insert|delete> 配置了 flushCache=true，清空二级缓存</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> delegate.update(ms, parameterObject);</span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">void</span> <span class="code-snippet__title">commit</span><span class="code-snippet__params">(</span><span class="code-snippet__params"><span class="code-snippet__type">boolean</span></span><span class="code-snippet__params"> required)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">        delegate.commit(required);</span></code><code><span leaf="">        tcm.commit();                    <span class="code-snippet__comment">// 提交事务时，将所有暂存的缓存项真正写入二级缓存</span></span></code><code><span leaf="">    }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">void</span> <span class="code-snippet__title">rollback</span><span class="code-snippet__params">(</span><span class="code-snippet__params"><span class="code-snippet__type">boolean</span></span><span class="code-snippet__params"> required)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">        <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">            delegate.rollback(required);</span></code><code><span leaf="">        } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (required) {</span></code><code><span leaf="">                tcm.rollback();          <span class="code-snippet__comment">// 回滚时丢弃暂存的缓存项</span></span></code><code><span leaf="">            }</span></code><code><span leaf="">        }</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">private</span> <span class="code-snippet__keyword">void</span> <span class="code-snippet__title">flushCacheIfRequired</span><span class="code-snippet__params">(MappedStatement ms)</span> {</span></code><code><span leaf="">    <span class="code-snippet__type">Cache</span> <span class="code-snippet__variable">cache</span> <span class="code-snippet__operator">=</span> ms.getCache();</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (cache != <span class="code-snippet__literal">null</span> && ms.isFlushCacheRequired()) {</span></code><code><span leaf="">        tcm.clear(cache);   <span class="code-snippet__comment">// 清空该事务缓存（最终在 commit 时会同步清空底层 cache）</span></span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code><code><span leaf="">}</span></code>
```


步骤

操作

说明

1

CachingExecutor.query

 开始

入口

2

从 MappedStatement 获取二级缓存 Cache

若没有则直接跳到步骤 6

3

从

TransactionalCacheManager

 中尝试获取缓存结果（

tcm.getObject

）

查事务缓存区（可能已暂存）

4

若未命中（缓存不存在），调用

delegate.query

（进入 

BaseExecutor

）

进入一级缓存逻辑

5

BaseExecutor

查询一级缓存，未命中则查询数据库，结果存入一级缓存

与二级缓存无关

6

返回结果给

CachingExecutor

7

CachingExecutor

 调用 

tcm.putObject

 将结果

存入事务缓存区

仅暂存，不写入底层二级缓存

8

事务提交时（

commit

），

tcm.commit

 将暂存的数据

真正写入

二级缓存（如 

PerpetualCache

）

此时其他事务才能看到缓存数据

关键机制解读

1.

TransactionalCacheManager

：延迟提交机制

TransactionalCacheManager 实现了延迟提交机制，每个 CachingExecutor 维护一个 TransactionalCacheManager 实例，管理多个 TransactionalCache（每个 Cache 对象对应一个）。

TransactionalCache 内部维护了两个临时容器：

entriesToAddOnCommit：暂存待提交时写入二级缓存的结果

entriesMissedInCache：记录本次事务中缓存未命中的 key（用于在提交时同步处理）

当调用 tcm.putObject 时，结果被存入 entriesToAddOnCommit，而非直接写入底层 Cache。只有当事务提交（commit）时，tcm.commit() 才会将临时 Map 中的所有条目真正刷新到二级缓存。若事务回滚（rollback），这些临时条目被丢弃。这种设计保证了二级缓存与事务的一致性——一个事务内查询的数据不会被其他事务立即看到，只有提交后才对外可见。

2.

flushCacheIfRequired(ms)

对于

query

方法：检查

@Select

或

<select>

标签的

flushCache

属性（默认为

false

）。如果为

true

，则调用

clearCache(cache)

清空整个二级缓存区域。

对于 

update

 方法：检查 

@Update

 / 

@Insert

 / 

@Delete

 或对应 XML 标签的 

flushCache

 属性（默认为 

true

）。如果为 

true

，清空二级缓存。

七、事务与执行器绑定机制

7.1 事务的来源

在 

openSessionFromDataSource

 中：


```
<code><span leaf=""><span class="code-snippet__comment">// DefaultSqlSessionFactory</span></span></code><code><span leaf=""><span class="code-snippet__type">Transaction</span> <span class="code-snippet__variable">tx</span> <span class="code-snippet__operator">=</span> transactionFactory.newTransaction(environment.getDataSource(), level, autoCommit);</span></code><code><span leaf=""><span class="code-snippet__type">Executor</span> <span class="code-snippet__variable">executor</span> <span class="code-snippet__operator">=</span> configuration.newExecutor(tx, executorType);</span></code>
```


Transaction

对象封装了：

DataSource

：获取数据库连接

autoCommit

：是否自动提交

level

：事务隔离级别

7.2 连接获取时机

Executor

 并不立即获取连接，而是在第一次执行 SQL（

prepareStatement

）时才从 

transaction

 中获取：


```
<code><span leaf=""><span class="code-snippet__comment">// BaseExecutor</span></span></code><code><span leaf=""><span class="code-snippet__keyword">protected</span> <span class="code-snippet__title">Connection</span> <span class="code-snippet__title">getConnection</span>(<span class="code-snippet__params"><span class="code-snippet__title">Log</span></span><span class="code-snippet__params"> statementLog</span>) {</span></code><code><span leaf="">    <span class="code-snippet__title">Connection</span> connection = transaction.<span class="code-snippet__title">getConnection</span>();</span></code><code><span leaf="">    <span class="code-snippet__comment">// 设置日志</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> connection;</span></code><code><span leaf="">}</span></code>
```


JdbcTransaction.getConnection()

实现：


```
<code><span leaf=""><span class="code-snippet__comment">// JdbcTransaction</span></span></code><code><span leaf=""><span class="code-snippet__function"><span class="code-snippet__keyword">public</span></span><span class="code-snippet__function"> Connection </span><span class="code-snippet__function"><span class="code-snippet__title">getConnection</span></span><span class="code-snippet__function">()</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (connection == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">        connection = dataSource.getConnection();</span></code><code><span leaf="">        connection.setAutoCommit(autoCommit);</span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (level != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">            connection.setTransactionIsolation(level);</span></code><code><span leaf="">        }</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> connection;</span></code><code><span leaf="">}</span></code>
```


连接延迟获取

：直到执行 SQL 时才从数据源获取连接，减少资源占用。

7.3 事务传播（Spring 集成场景）

在 Spring 集成时，

SpringManagedTransaction

从

DataSourceUtils

中获取当前线程绑定的连接（同事务共享），不是每次都新建。

Executor

仍然被创建，但

transaction

中的连接是从 Spring 事务同步器中获取的。

八、面试高频题

Q1：MyBatis 有几种 Executor？各自特点是什么？

A

：

类型

类名

Statement 管理

适用场景

SIMPLE

SimpleExecutor

每次新建，用完关闭

默认，适合大多数场景

REUSE

ReuseExecutor

缓存 Statement，相同 SQL 复用

相同 SQL 多次执行

BATCH

BatchExecutor

批量累积，一次性提交

批量插入/更新

另附 CachingExecutor 说明

（虽然不属于 ExecutorType 枚举选项）：

类型

说明

CachingExecutor

装饰器模式实现，为任意基础执行器增加二级缓存功能。当 

cacheEnabled=true

 时，MyBatis 会用 CachingExecutor 包装基础执行器

Q2：一级缓存和二级缓存的区别？

A

：

对比项

一级缓存

二级缓存

作用范围

SqlSession 级别（会话级），同一 SqlSession 内共享

Mapper 级别（应用级/全局），可跨多个 SqlSession 共享

默认状态

开启（不可关闭）

关闭（需在 mybatis-config.xml 中设置 cacheEnabled=true，并在 Mapper 中添加 cache 标签）

实现机制

BaseExecutor.localCache（PerpetualCache）

CachingExecutor + 底层 Cache 实现（PerpetualCache 等）

失效条件

update/insert/delete 操作触发

clearLocalCache()

update/insert/delete 操作清空对应 namespace 的缓存

缓存作用域配置

可通过

localCacheScope

配置为 SESSION 或 STATEMENT

可通过 Mapper 的 cache 标签配置回收策略（LRU、FIFO 等）

Q3：CachingExecutor 和 BaseExecutor 的关系？

A

：

CachingExecutor

不继承

BaseExecutor

，它实现

Executor

接口并持有另一个

Executor

引用（delegate）。这是一种

装饰器模式

，在原有执行器行为之上增加二级缓存功能，不影响原有执行器代码。

Q4：Executor 在执行 update 时为什么总是清空一级缓存？

A

：因为 update 操作会改变数据库数据，为了保证缓存数据与数据库一致，必须清空缓存。一级缓存是 SqlSession 级别，该 SqlSession 后续查询会重新从数据库获取最新数据。如果不清空，可能会读到脏数据。

Q5：BatchExecutor 的

doQuery

会刷新批次吗？

A

：会。

BatchExecutor

重写的

doQuery

方法会调用

flushStatements()

，因为查询前必须确保前面的批量操作已经执行完毕，否则会影响查询结果。所以批量操作不要和查询混用，否则可能频繁刷新，失去批量的优势。

九、下篇预告

第 6 篇我们将深入

#{}

与

${}

底层解析 & SQL 预编译

，拆解：

BoundSql

的构建过程

#{}

如何转为

?

并安全设参

${}

直接拼接的风险源码级证明

SQL 注入防御原理

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
