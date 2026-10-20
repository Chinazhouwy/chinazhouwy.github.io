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
source: "微信公众号「狂热大猩猩的技术宅」"
source_url: "https://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484033&idx=1&sn=68c71525ef8f4d881c7da1f4159902ab&chksm=c2b810def5cf99c8fa181d67b4486e6ebceeb89ffdf81e9f429022e6427699726a3dc9185efe"
published_at: "2026-06-28 20:19:00 +08:00"
---

# MyBatis 源码深度拆解（五）：Executor 执行器设计与实现

> 原作者：狂热大猩猩的技术宅 · 2026年6月28日 20:19
> [阅读微信原文](https://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484033&idx=1&sn=68c71525ef8f4d881c7da1f4159902ab&chksm=c2b810def5cf99c8fa181d67b4486e6ebceeb89ffdf81e9f429022e6427699726a3dc9185efe)
> 原文排版恢复版：保留原作者内容与顺序，仅整理网页显示格式。

<h2><strong>一、回顾与开篇</strong></h2>

<p>前几篇我们已经看到，<code>SqlSession</code>是门面，真正的数据库操作委托给了<code>Executor</code>。<code>Executor</code>是 MyBatis 执行调度的核心，负责：</p>

<ul><li><strong>SQL 执行</strong>：调用<code>StatementHandler</code>完成 JDBC 操作</li><li><strong>缓存管理</strong>：一级缓存（<code>BaseExecutor</code>实现）</li><li><strong>事务控制</strong>：提交、回滚、关闭</li><li><strong>批处理</strong>：<code>BatchExecutor</code>批量执行</li></ul>

<p><strong>本篇目标</strong>：</p>

<ul><li>拆解Executor三级继承体系：<code>SimpleExecutor</code>/<code>ReuseExecutor</code>/<code>BatchExecutor</code></li><li>理解<code>CachingExecutor</code>如何用装饰器模式包装二级缓存</li><li>追踪 SQL 执行完整链路（从<code>Executor.query</code>到 JDBC）</li><li>理解事务与执行器的绑定关系</li></ul>

<h2><strong>二、Executor 整体概述</strong></h2>

<p><strong>关键点</strong>：</p>

<ul><li><code>BaseExecutor</code>实现了公共逻辑（一级缓存、事务管理），定义三个抽象模板方法：<code>doQuery</code>、<code>doUpdate</code>、<code>doFlushStatements</code></li><li>三个子类实现不同的 Statement 处理策略</li><li><code>CachingExecutor</code> 装饰任意 <code>Executor</code>，添加二级缓存能力</li></ul>

<h2><strong>三、Executor 创建与选择时机</strong></h2>

<p>回顾第 4 篇提到的 <code>Configuration.newExecutor()</code>：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">// Configuration
public Executor newExecutor(Transaction transaction, ExecutorType executorType) {
    executorType = executorType == null ? defaultExecutorType : executorType;
    Executor executor;

    // 1. 根据类型创建基础执行器
    if (ExecutorType.BATCH == executorType) {
        executor = new BatchExecutor(this, transaction);
    } else if (ExecutorType.REUSE == executorType) {
        executor = new ReuseExecutor(this, transaction);
    } else {
        executor = new SimpleExecutor(this, transaction);
    }

    // 2. 如果开启二级缓存，用装饰器模式包装
    if (cacheEnabled) {
        executor = new CachingExecutor(executor);
    }

    // 3. 执行插件链（责任链）
    executor = (Executor) interceptorChain.pluginAll(executor);
    return executor;
}</code></pre>

<p><strong>创建时机</strong>：每次<code>SqlSessionFactory.openSession()</code>都会创建一个新的<code>Executor</code>实例。<code>Executor</code>与<code>SqlSession</code>生命周期一致。</p>

<p><strong>事务绑定</strong>：<code>Executor</code>构造函数接收<code>Transaction</code>对象，该对象封装了数据库连接和事务控制方法。同一个<code>SqlSession</code>下的所有 Mapper 调用共享同一个<code>Executor</code>，也就共享同一个数据库连接和一级缓存。</p>

<p><br/></p>

<h2><strong>四、BaseExecutor：模板方法 + 一级缓存</strong></h2>

<p><code>BaseExecutor</code>是抽象类，实现了公共逻辑，特别是<strong>一级缓存</strong>。</p>

<h3><strong>4.1 一级缓存结构</strong></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">public abstract class BaseExecutor implements Executor {
    protected PerpetualCache localCache;  // 一级缓存
    protected PerpetualCache localOutputParameterCache; // 存储过程输出参数缓存
    protected Transaction transaction;
    protected boolean closed;

    public BaseExecutor(Configuration configuration, Transaction transaction) {
        this.transaction = transaction;
        this.localCache = new PerpetualCache("LocalCache");
        this.localOutputParameterCache = new PerpetualCache("LocalOutputParameterCache");
    }
}</code></pre>

<h3><strong>4.2 查询方法（带一级缓存）</strong></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">// BaseExecutor
@Override
public &lt;E&gt; List&lt;E&gt; query(MappedStatement ms, Object parameter, RowBounds rowBounds,
                         ResultHandler resultHandler, CacheKey key, BoundSql boundSql) {
    if (closed) {
        throw new ExecutorException("Executor was closed.");
    }
    // 1. 清空本地缓存（若配置了 flushCache=true）
    if (queryStack == 0 &amp;&amp; ms.isFlushCacheRequired()) {
        clearLocalCache();
    }
    List&lt;E&gt; list;
    try {
        queryStack++;
        // 2. 从一级缓存获取
        list = resultHandler == null ? (List&lt;E&gt;) localCache.getObject(key) : null;
        if (list != null) {
            // 缓存命中，处理存储过程的输出参数
            handleLocallyCachedOutputParameters(ms, key, parameter, boundSql);
        } else {
            // 3. 未命中，从数据库查询
            list = queryFromDatabase(ms, parameter, rowBounds, resultHandler, key, boundSql);
        }
    } finally {
        queryStack--;
    }
    return list;
}

private &lt;E&gt; List&lt;E&gt; queryFromDatabase(...) {
    List&lt;E&gt; list;
    localCache.putObject(key, EXECUTION_PLACEHOLDER); // 占位符，防止并发重复查询
    try {
        list = doQuery(ms, parameter, rowBounds, resultHandler, boundSql);
    } finally {
        localCache.removeObject(key);
    }
    localCache.putObject(key, list);  // 放入缓存
    return list;
}</code></pre>

<p><strong>一级缓存关键点</strong>：</p>

<ul><li>生命周期 = SqlSession 生命周期，SqlSession 关闭时缓存销毁</li><li>执行<code>update/insert/delete</code>时会<code>clearLocalCache()</code>，保证数据一致性</li><li>默认开启，且不能关闭（除非设置 <code>localCacheScope=STATEMENT</code>，每次查询后清空）</li></ul>

<h3><strong>4.3 更新方法（清空缓存）</strong></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">// BaseExecutor
@Override
public int update(MappedStatement ms, Object parameter) {
    if (closed) {
        throw new ExecutorException("Executor was closed.");
    }
    clearLocalCache();  // 更新操作会清空一级缓存
    return doUpdate(ms, parameter);
}</code></pre>

<h3><strong>4.4 事务与连接管理</strong></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">// BaseExecutor
@Override
public void commit(boolean required) throws SQLException {
    if (closed) {
        throw new ExecutorException("Cannot commit, transaction is already closed");
    }
    clearLocalCache();  // 提交前清空一级缓存
    flushStatements();  // 刷新批处理语句（BatchExecutor 会用到）
    if (required) {
        transaction.commit();  // 提交事务
    }
}

@Override
public void close(boolean forceRollback) {
    try {
        try {
            // 1. 根据 forceRollback 决定提交还是回滚
            rollback(forceRollback);   // 注意：这里调用的就是 rollback，不是 commit！
        } finally {
            // 2. 关闭事务（释放数据库连接）
            if (transaction != null) {
                transaction.close();
            }
        }
    } catch (SQLException e) {
        log.warn("Unexpected exception on closing transaction.  Cause: " + e);
    } finally {
        // 3. 清空所有缓存和引用，标记 closed = true
        transaction = null;
        deferredLoads = null;
        localCache = null;
        localOutputParameterCache = null;
        closed = true;
    }
}

@Override
public void rollback(boolean required) throws SQLException {
    if (!closed) {
        try {
            // 清空一级缓存
            clearLocalCache();
            // 刷新批处理语句（如果有）
            flushStatements(true);
        } finally {
            // 如果 required=true 或者当前连接不是自动提交模式，则执行回滚
            if (required) {
                transaction.rollback();
            }
        }
    }
}</code></pre>

<h2><strong>为什么是 </strong><code><strong>rollback</strong></code><strong> 而不是 </strong><code><strong>commit</strong></code><strong>？</strong></h2>

<p>BaseExecutor 的 close(boolean forceRollback) 方法体现了 MyBatis 对数据安全的谨慎态度：</p>

<ul><li>当调用 close(true) 关闭执行器时，会先执行 rollback(true) 来回滚未提交的事务，而不是尝试提交。</li><li>当调用 close(false) 时，则不会主动回滚，交由事务管理器处理。</li></ul>

<p>这种“宁可回滚也不提交”的设计，避免了在不确定的情况下持久化脏数据。同时，Executor 不直接操作数据库连接，而是通过 Transaction 对象代理，由 TransactionFactory 创建 JdbcTransaction 或 ManagedTransaction，实现了事务与执行器的解耦。</p>

<p><strong>在不确定的情况下，宁可回滚也不提交，避免脏数据持久化。</strong></p>

<p><strong>事务绑定：transaction对象持有数据库连接，由TransactionFactory创建（JdbcTransaction或ManagedTransaction）。Executor不直接操作连接，而是通过transaction代理。</strong></p>

<h2><strong>五、三大基础执行器对比</strong></h2>

<h3><strong>5.1 SimpleExecutor（默认）</strong></h3>

<p>每次执行 SQL 都创建新的 <code>Statement</code>，用完后立即关闭。</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">// SimpleExecutor
@Override
public &lt;E&gt; List&lt;E&gt; doQuery(MappedStatement ms, Object parameter, RowBounds rowBounds,
                           ResultHandler resultHandler, BoundSql boundSql) {
    Statement stmt = null;
    try {
        Configuration configuration = ms.getConfiguration();
        // 1. 创建 StatementHandler
        StatementHandler handler = configuration.newStatementHandler(this, ms, parameter,
                                            rowBounds, resultHandler, boundSql);
        // 2. 预编译 SQL
        stmt = prepareStatement(handler, ms.getStatementLog());
        // 3. 执行查询并映射结果
        return handler.query(stmt, resultHandler);
    } finally {
        closeStatement(stmt);  // 关闭 Statement
    }
}

private Statement prepareStatement(StatementHandler handler, Log statementLog) {
    Statement stmt;
    Connection connection = getConnection(statementLog);
    stmt = handler.prepare(connection, transaction.getTimeout());
    handler.parameterize(stmt);
    return stmt;
}</code></pre>

<p><strong>特点</strong>：简单直接，适合非频繁调用的 SQL。</p>

<h3><strong>5.2 ReuseExecutor</strong></h3>

<p>复用 <code>Statement</code>，避免重复预编译。内部维护一个 <code>Map&lt;String, Statement&gt;</code>，key 是 SQL 字符串。</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">public class ReuseExecutor extends BaseExecutor {
    // 核心缓存：SQL 字符串 -&gt; Statement 对象
    private final Map&lt;String, Statement&gt; statementMap = new HashMap&lt;&gt;();

    @Override
    public &lt;E&gt; List&lt;E&gt; doQuery(MappedStatement ms, Object parameter, RowBounds rowBounds,
                               ResultHandler resultHandler, BoundSql boundSql) throws SQLException {
        Configuration configuration = ms.getConfiguration();
        StatementHandler handler = configuration.newStatementHandler(wrapper, ms, parameter, rowBounds, resultHandler, boundSql);
        Statement stmt = prepareStatement(handler, ms.getStatementLog());
        return handler.query(stmt, resultHandler);
    }

    // 核心复用逻辑在 prepareStatement 方法中
    private Statement prepareStatement(StatementHandler handler, Log statementLog) throws SQLException {
        Statement stmt;
        BoundSql boundSql = handler.getBoundSql();
        String sql = boundSql.getSql();               // 获取 SQL 字符串作为缓存 key
        if (hasStatementFor(sql)) {                  // 检查缓存中是否有该 SQL 对应的 Statement
            stmt = getStatement(sql);                 // 从缓存取
            applyTransactionTimeout(stmt);            // 应用事务超时设置
        } else {
            Connection connection = getConnection(statementLog);
            stmt = handler.prepare(connection, transaction.getTimeout()); // 创建新 Statement
            putStatement(sql, stmt);                  // 放入缓存
        }
        handler.parameterize(stmt);                   // 设置参数（每次都必须重新设参）
        return stmt;
    }
}</code></pre>

<p><strong>适用场景</strong>：同一个会话中多次执行相同 SQL（如循环内重复查询）。可以减少每次创建 <code>Statement</code> 的开销。</p>

<h2>关键机制解读</h2>

<h3><strong>1. Statement 缓存的 Key 是</strong><strong>SQL 字符串</strong></h3>

<ul><li></li></ul>

<pre><code class="language-javascript">String sql = boundSql.getSql();</code></pre>

<p>注意：这里用的是<code>BoundSql.getSql()</code>，即<strong>已经完成</strong><code><strong>#{}</strong></code><strong>替换成</strong><code><strong>?</strong></code><strong>之后的 SQL 模板</strong>。所以即使参数不同，只要 SQL 模板相同（比如<code>SELECT * FROM user WHERE id = ?</code>），就会复用同一个<code>PreparedStatement</code>对象。</p>

<p><strong>复用前提</strong>：SQL 模板必须完全相同（包括空格、换行等）。否则会生成新的 Statement。</p>

<h3><strong>2. 复用时需要重新设置参数</strong></h3>

<ul><li></li><li></li><li></li></ul>

<pre><code class="language-javascript">stmt = getStatement(sql);           // 复用旧的 Statement
applyTransactionTimeout(stmt);      // 刷新超时设置
handler.parameterize(stmt);         // 重新设置参数（重要！）</code></pre>

<p>同一个 PreparedStatement 可以被多次执行，但每次执行前必须重新绑定参数值。在 ReuseExecutor.prepareStatement 中，会通过 <code>StatementHandler.parameterize(stmt)</code> 完成参数设置，该方法内部最终调用 <code>ParameterHandler.setParameters(ps)</code> 将参数绑定到 PreparedStatement。</p>

<h3><strong>3. 缓存生命周期</strong></h3>

<ul><li>缓存<code>statementMap</code>是<code>ReuseExecutor</code>实例级别的，即同一个<code>ReuseExecutor</code>对象（对应同一个<code>SqlSession</code>）中有效。</li><li>当执行<code>doFlushStatements</code>（通常在<code>commit</code>/<code>rollback</code>/<code>close</code>时触发）时，所有缓存的 Statement 被关闭并清空。</li><li>如果执行了 DML 操作（update/insert/delete），<code>BaseExecutor</code>会调用<code>clearLocalCache()</code>，但<strong>不会清空</strong><code><strong>statementMap</strong></code>。<code>statementMap</code>只在<code>doFlushStatements</code>或 Executor 关闭时清空。</li></ul>

<h3><strong>4. 与 SimpleExecutor 的核心区别</strong></h3>

<table><tbody><tr><td><p>维度</p></td><td><p>SimpleExecutor</p></td><td><p>ReuseExecutor</p></td></tr><tr><td><p>Statement 创建策略</p></td><td><p>每次 doQuery/doUpdate 都创建新 Statement，用后立即关闭</p></td><td><p>缓存 Statement，相同 SQL 复用，执行后不关闭（放回缓存）</p></td></tr><tr><td><p>缓存清除时机</p></td><td><p>无跨方法缓存</p></td><td><p>commit/rollback/close 时清空缓存</p></td></tr><tr><td><p>适用场景</p></td><td><p>通用，SQL 变化较多</p></td><td><p>同一 Session 内大量重复 SQL（如循环内相同查询）</p></td></tr><tr><td><p>资源占用</p></td><td><p>频繁创建/销毁 Statement</p></td><td><p>保持 Statement 打开，占用数据库端资源</p></td></tr></tbody></table>

<h3><strong>5.3 BatchExecutor</strong></h3>

<p>批量执行，将多条 SQL 累积到一批，一次性发送给数据库。</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">public class BatchExecutor extends BaseExecutor {
    public static final int BATCH_UPDATE_RETURN_VALUE = Integer.MIN_VALUE + 1002;

    private final List&lt;Statement&gt; statementList = new ArrayList&lt;&gt;();
    private final List&lt;BatchResult&gt; batchResultList = new ArrayList&lt;&gt;();
    private String currentSql;
    private MappedStatement currentStatement;

    // doUpdate 核心逻辑
    @Override
    public int doUpdate(MappedStatement ms, Object parameterObject) throws SQLException {
        final Configuration configuration = ms.getConfiguration();
        final StatementHandler handler = configuration.newStatementHandler(this, ms, parameterObject, RowBounds.DEFAULT, null, null);
        final BoundSql boundSql = handler.getBoundSql();
        final String sql = boundSql.getSql();
        final Statement stmt;
        if (sql.equals(currentSql) &amp;&amp; ms.equals(currentStatement)) {
            // 相同 SQL 和 MappedStatement：复用当前批次的最后一个 Statement
            int last = statementList.size() - 1;
            stmt = statementList.get(last);
            applyTransactionTimeout(stmt);
            handler.parameterize(stmt);
            BatchResult batchResult = batchResultList.get(last);
            batchResult.addParameterObject(parameterObject);
        } else {
            // 不同的 SQL 或 MappedStatement：创建新的 Statement，开始新批次
            Connection connection = getConnection(ms.getStatementLog());
            stmt = handler.prepare(connection, transaction.getTimeout());
            handler.parameterize(stmt);
            currentSql = sql;
            currentStatement = ms;
            statementList.add(stmt);
            batchResultList.add(new BatchResult(ms, sql, parameterObject));
        }
        handler.batch(stmt);  // 将当前参数添加到批处理中
        return BATCH_UPDATE_RETURN_VALUE; // 占位返回值，实际影响行数在 flush 时获取
    }

    // doQuery 会先 flush 批次
    @Override
    public &lt;E&gt; List&lt;E&gt; doQuery(MappedStatement ms, Object parameterObject, RowBounds rowBounds,
      ResultHandler resultHandler, BoundSql boundSql) throws SQLException {
        Statement stmt = null;
        try {
            flushStatements();  // 查询前必须执行已有批次
            Configuration configuration = ms.getConfiguration();
            StatementHandler handler = configuration.newStatementHandler(wrapper, ms, parameterObject, rowBounds, resultHandler, boundSql);
            Connection connection = getConnection(ms.getStatementLog());
            stmt = handler.prepare(connection, transaction.getTimeout());
            handler.parameterize(stmt);
            return handler.query(stmt, resultHandler);
        } finally {
            closeStatement(stmt);
        }
    }

    // 真正执行批次并返回结果
    @Override
    public List&lt;BatchResult&gt; doFlushStatements(boolean isRollback) throws SQLException {
        try {
            List&lt;BatchResult&gt; results = new ArrayList&lt;&gt;();
            if (isRollback) {
                return Collections.emptyList();  // 回滚时不返回结果
            }
            for (int i = 0, n = statementList.size(); i &lt; n; i++) {
                Statement stmt = statementList.get(i);
                applyTransactionTimeout(stmt);
                BatchResult batchResult = batchResultList.get(i);
                try {
                    batchResult.setUpdateCounts(stmt.executeBatch());  // 执行批处理
                    // 处理自增主键回填（Jdbc3KeyGenerator）
                    MappedStatement ms = batchResult.getMappedStatement();
                    List&lt;Object&gt; parameterObjects = batchResult.getParameterObjects();
                    KeyGenerator keyGenerator = ms.getKeyGenerator();
                    if (Jdbc3KeyGenerator.class.equals(keyGenerator.getClass())) {
                        ((Jdbc3KeyGenerator) keyGenerator).processBatch(ms, stmt, parameterObjects);
                    } else if (!NoKeyGenerator.class.equals(keyGenerator.getClass())) {
                        for (Object parameter : parameterObjects) {
                            keyGenerator.processAfter(this, ms, stmt, parameter);
                        }
                    }
                    closeStatement(stmt);  // 执行完毕后关闭 Statement
                } catch (BatchUpdateException e) {
                    // 异常处理：抛出 BatchExecutorException，携带已成功的结果
                    throw new BatchExecutorException(..., e, results, batchResult);
                }
                results.add(batchResult);
            }
            return results;
        } finally {
            // 清理所有资源
            for (Statement stmt : statementList) {
                closeStatement(stmt);
            }
            currentSql = null;
            statementList.clear();
            batchResultList.clear();
        }
    }
}</code></pre>

<p><strong>适用场景</strong>：批量插入、批量更新（如一次性插入 1000 条记录）。</p>

<p>BatchExecutor 通过 JDBC 的 addBatch() / executeBatch() 机制实现批量执行，将多条 DML（INSERT/UPDATE/DELETE）SQL 累积到一批，一次性发送给数据库，减少网络 IO 开销。</p>

<p><strong>注意：</strong>JDBC 批处理不支持 SELECT 查询。BatchExecutor 的 doQuery 方法会调用 flushStatements() 强制刷新前面未提交的批量操作，因此查询操作会打断批处理流程。建议将批量操作与查询操作分开在不同事务或 SqlSession 中执行，否则可能频繁刷新批次，降低批量的性能优势。</p>

<h2><strong>六、CachingExecutor：二级缓存装饰器</strong></h2>

<p>二级缓存是 Mapper 级别，跨多个 SqlSession 共享。<code>CachingExecutor</code> 通过<strong>装饰器模式</strong>包装基础执行器，在不修改原有逻辑的情况下增强缓存能力。</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">public class CachingExecutor implements Executor {
    private final Executor delegate;                     // 被装饰的执行器
    private final TransactionalCacheManager tcm = new TransactionalCacheManager();  // 事务性缓存管理器

    public CachingExecutor(Executor delegate) {
        this.delegate = delegate;
        delegate.setExecutorWrapper(this);
    }

    @Override
    public &lt;E&gt; List&lt;E&gt; query(MappedStatement ms, Object parameterObject, RowBounds rowBounds,
                             ResultHandler resultHandler, CacheKey key, BoundSql boundSql) throws SQLException {
        Cache cache = ms.getCache();                     // 获取 Mapper 对应的二级缓存对象
        if (cache != null) {
            flushCacheIfRequired(ms);                    // 如果 &lt;select&gt; 配置了 flushCache=true，清空二级缓存
            if (ms.isUseCache() &amp;&amp; resultHandler == null) {
                ensureNoOutParams(ms, boundSql);         // 存储过程调用且包含 OUT 参数时不能使用缓存
                @SuppressWarnings("unchecked")
                List&lt;E&gt; list = (List&lt;E&gt;) tcm.getObject(cache, key);   // 从事务缓存中获取
                if (list == null) {
                    list = delegate.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);
                    tcm.putObject(cache, key, list);     // 放入事务缓存（暂存，待 commit 时真正写入）
                }
                return list;
            }
        }
        return delegate.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);
    }

    @Override
    public int update(MappedStatement ms, Object parameterObject) throws SQLException {
        flushCacheIfRequired(ms);        // 如果 &lt;update|insert|delete&gt; 配置了 flushCache=true，清空二级缓存
        return delegate.update(ms, parameterObject);
    }

    @Override
    public void commit(boolean required) throws SQLException {
        delegate.commit(required);
        tcm.commit();                    // 提交事务时，将所有暂存的缓存项真正写入二级缓存
    }

    @Override
    public void rollback(boolean required) throws SQLException {
        try {
            delegate.rollback(required);
        } finally {
            if (required) {
                tcm.rollback();          // 回滚时丢弃暂存的缓存项
            }
        }
    }
    private void flushCacheIfRequired(MappedStatement ms) {
    Cache cache = ms.getCache();
    if (cache != null &amp;&amp; ms.isFlushCacheRequired()) {
        tcm.clear(cache);   // 清空该事务缓存（最终在 commit 时会同步清空底层 cache）
    }
}
}</code></pre>

<table></table>

<table><caption><br/></caption><tfoot><tr><td></td></tr></tfoot></table>

<table><tbody><tr><td><p>步骤</p></td><td><p>操作</p></td><td><p>说明</p></td></tr><tr><td><p>1</p></td><td><p><code>CachingExecutor.query</code> 开始</p></td><td><p>入口</p></td></tr><tr><td><p>2</p></td><td><p>从 MappedStatement 获取二级缓存 Cache</p></td><td><p>若没有则直接跳到步骤 6</p></td></tr><tr><td><p>3</p></td><td><p>从<code>TransactionalCacheManager</code></p><p> 中尝试获取缓存结果（<code>tcm.getObject</code>）</p></td><td><p>查事务缓存区（可能已暂存）</p></td></tr><tr><td><p>4</p></td><td><p>若未命中（缓存不存在），调用<code>delegate.query</code></p><p>（进入 <code>BaseExecutor</code>）</p></td><td><p>进入一级缓存逻辑</p></td></tr><tr><td><p>5</p></td><td><p><code>BaseExecutor</code></p><p>查询一级缓存，未命中则查询数据库，结果存入一级缓存</p></td><td><p>与二级缓存无关</p></td></tr><tr><td><p>6</p></td><td><p>返回结果给<code>CachingExecutor</code></p></td><td><br/></td></tr><tr><td><p>7</p></td><td><p><code>CachingExecutor</code> 调用 <code>tcm.putObject</code> 将结果<strong>存入事务缓存区</strong></p></td><td><p>仅暂存，不写入底层二级缓存</p></td></tr><tr><td><p>8</p></td><td><p>事务提交时（<code>commit</code>），<code>tcm.commit</code> 将暂存的数据<strong>真正写入</strong>二级缓存（如 <code>PerpetualCache</code>）</p></td><td><p>此时其他事务才能看到缓存数据</p></td></tr></tbody></table>

<br/>

<strong>关键机制解读</strong>

<h3><strong>1.</strong><code><strong>TransactionalCacheManager</strong></code><strong>：延迟提交机制</strong></h3>

<p>TransactionalCacheManager 实现了延迟提交机制，每个 CachingExecutor 维护一个 TransactionalCacheManager 实例，管理多个 TransactionalCache（每个 Cache 对象对应一个）。</p>

<p>TransactionalCache 内部维护了两个临时容器：</p>

<ul><li>entriesToAddOnCommit：暂存待提交时写入二级缓存的结果</li><li>entriesMissedInCache：记录本次事务中缓存未命中的 key（用于在提交时同步处理）</li></ul>

<p>当调用 tcm.putObject 时，结果被存入 entriesToAddOnCommit，而非直接写入底层 Cache。只有当事务提交（commit）时，tcm.commit() 才会将临时 Map 中的所有条目真正刷新到二级缓存。若事务回滚（rollback），这些临时条目被丢弃。这种设计保证了二级缓存与事务的一致性——一个事务内查询的数据不会被其他事务立即看到，只有提交后才对外可见。</p>

<h3><strong>2.</strong><code><strong>flushCacheIfRequired(ms)</strong></code></h3>

<ul><li>对于<code>query</code>方法：检查<code>@Select</code>或<code>&lt;select&gt;</code>标签的<code>flushCache</code>属性（默认为<code>false</code>）。如果为<code>true</code>，则调用<code>clearCache(cache)</code>清空整个二级缓存区域。</li><li>对于 <code>update</code> 方法：检查 <code>@Update</code> / <code>@Insert</code> / <code>@Delete</code> 或对应 XML 标签的 <code>flushCache</code> 属性（默认为 <code>true</code>）。如果为 <code>true</code>，清空二级缓存。</li></ul>

<h2><strong>七、事务与执行器绑定机制</strong></h2>

<h3><strong>7.1 事务的来源</strong></h3>

<p>在 <code>openSessionFromDataSource</code> 中：</p>

<ul><li></li><li></li><li></li></ul>

<pre><code class="language-java">// DefaultSqlSessionFactory
Transaction tx = transactionFactory.newTransaction(environment.getDataSource(), level, autoCommit);
Executor executor = configuration.newExecutor(tx, executorType);</code></pre>

<p><code>Transaction</code>对象封装了：</p>

<ul><li><code>DataSource</code>：获取数据库连接</li><li><code>autoCommit</code>：是否自动提交</li><li><code>level</code>：事务隔离级别</li></ul>

<h3><strong>7.2 连接获取时机</strong></h3>

<p><code>Executor</code> 并不立即获取连接，而是在第一次执行 SQL（<code>prepareStatement</code>）时才从 <code>transaction</code> 中获取：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">// BaseExecutor
protected Connection getConnection(Log statementLog) {
    Connection connection = transaction.getConnection();
    // 设置日志
    return connection;
}</code></pre>

<p><code>JdbcTransaction.getConnection()</code>实现：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-cs">// JdbcTransaction
public Connection getConnection() {
    if (connection == null) {
        connection = dataSource.getConnection();
        connection.setAutoCommit(autoCommit);
        if (level != null) {
            connection.setTransactionIsolation(level);
        }
    }
    return connection;
}</code></pre>

<p><strong>连接延迟获取</strong>：直到执行 SQL 时才从数据源获取连接，减少资源占用。</p>

<h3><strong>7.3 事务传播（Spring 集成场景）</strong></h3>

<p>在 Spring 集成时，<code>SpringManagedTransaction</code>从<code>DataSourceUtils</code>中获取当前线程绑定的连接（同事务共享），不是每次都新建。<code>Executor</code>仍然被创建，但<code>transaction</code>中的连接是从 Spring 事务同步器中获取的。</p>

<h2><strong>八、面试高频题</strong></h2>

<h3><strong>Q1：MyBatis 有几种 Executor？各自特点是什么？</strong></h3>

<p><strong>A</strong>：</p>

<table><tbody><tr><td><p>类型</p></td><td><p>类名</p></td><td><p>Statement 管理</p></td><td><p>适用场景</p></td></tr><tr><td><p>SIMPLE</p></td><td><p>SimpleExecutor</p></td><td><p>每次新建，用完关闭</p></td><td><p>默认，适合大多数场景</p></td></tr><tr><td><p>REUSE</p></td><td><p>ReuseExecutor</p></td><td><p>缓存 Statement，相同 SQL 复用</p></td><td><p>相同 SQL 多次执行</p></td></tr><tr><td><p>BATCH</p></td><td><p>BatchExecutor</p></td><td><p>批量累积，一次性提交</p></td><td><p>批量插入/更新</p></td></tr></tbody></table>

<p></p>

<p><strong>另附 CachingExecutor 说明</strong>（虽然不属于 ExecutorType 枚举选项）：</p>

<table><tbody><tr><td>类型</td><td>说明</td></tr><tr><td><p>CachingExecutor</p></td><td><p>装饰器模式实现，为任意基础执行器增加二级缓存功能。当 <code>cacheEnabled=true</code> 时，MyBatis 会用 CachingExecutor 包装基础执行器</p><br/></td></tr></tbody></table>

<h3><strong>Q2：一级缓存和二级缓存的区别？</strong></h3>

<p><strong>A</strong>：</p>

<table><tbody><tr><td><p>对比项</p></td><td><p>一级缓存</p></td><td><p>二级缓存</p></td></tr><tr><td><p>作用范围</p></td><td><p>SqlSession 级别（会话级），同一 SqlSession 内共享</p></td><td><p>Mapper 级别（应用级/全局），可跨多个 SqlSession 共享</p></td></tr><tr><td><p>默认状态</p></td><td><p>开启（不可关闭）</p></td><td><p>关闭（需在 mybatis-config.xml 中设置 cacheEnabled=true，并在 Mapper 中添加 cache 标签）</p></td></tr><tr><td><p>实现机制</p></td><td><p>BaseExecutor.localCache（PerpetualCache）</p></td><td><p>CachingExecutor + 底层 Cache 实现（PerpetualCache 等）</p></td></tr><tr><td><p>失效条件</p></td><td><p>update/insert/delete 操作触发<code>clearLocalCache()</code></p></td><td><p>update/insert/delete 操作清空对应 namespace 的缓存</p></td></tr><tr><td><p>缓存作用域配置</p></td><td><p>可通过<code>localCacheScope</code></p><p>配置为 SESSION 或 STATEMENT</p></td><td><p>可通过 Mapper 的 cache 标签配置回收策略（LRU、FIFO 等）</p></td></tr></tbody></table>

<h3><strong>Q3：CachingExecutor 和 BaseExecutor 的关系？</strong></h3>

<p><strong>A</strong>：<code>CachingExecutor</code>不继承<code>BaseExecutor</code>，它实现<code>Executor</code>接口并持有另一个<code>Executor</code>引用（delegate）。这是一种<strong>装饰器模式</strong>，在原有执行器行为之上增加二级缓存功能，不影响原有执行器代码。</p>

<h3><strong>Q4：Executor 在执行 update 时为什么总是清空一级缓存？</strong></h3>

<p><strong>A</strong>：因为 update 操作会改变数据库数据，为了保证缓存数据与数据库一致，必须清空缓存。一级缓存是 SqlSession 级别，该 SqlSession 后续查询会重新从数据库获取最新数据。如果不清空，可能会读到脏数据。</p>

<h3><strong>Q5：BatchExecutor 的</strong><code><strong>doQuery</strong></code><strong>会刷新批次吗？</strong></h3>

<p><strong>A</strong>：会。<code>BatchExecutor</code>重写的<code>doQuery</code>方法会调用<code>flushStatements()</code>，因为查询前必须确保前面的批量操作已经执行完毕，否则会影响查询结果。所以批量操作不要和查询混用，否则可能频繁刷新，失去批量的优势。</p>

<hr/>

<h2><strong>九、下篇预告</strong></h2>

<p>第 6 篇我们将深入<code><strong>#{}</strong></code><strong>与</strong><code><strong>${}</strong></code><strong>底层解析 &amp; SQL 预编译</strong>，拆解：</p>

<ul><li><code>BoundSql</code>的构建过程</li><li><code>#{}</code>如何转为<code>?</code>并安全设参</li><li><code>${}</code>直接拼接的风险源码级证明</li><li>SQL 注入防御原理</li></ul>

<p>如果觉得有帮助，欢迎<strong>点赞、在看、转发</strong>支持！</p>

<p>系列持续更新，关注不走丢 👇</p>

<p><br/></p>

<br/>

<p></p>
