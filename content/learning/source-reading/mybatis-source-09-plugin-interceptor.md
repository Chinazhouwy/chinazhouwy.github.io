---
title: "MyBatis 源码深度拆解（九）：插件 Plugin 拦截器底层原理"
date: "2026-08-03"
domain: "学习"
area: "Java 后端"
module: "MyBatis 源码拆解"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "面试官：MyBatis 的插件是如何实现的？它能在哪些地方进行拦截？分页插件的工作原理是什么？ 一、开篇 MyBatis…"
tags:
  - "MyBatis"
  - "源码分析"
source: "微信公众号「狂热大猩猩的技术宅」"
source_url: "https://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484061&idx=1&sn=cc54c7165c0d484453f9669e763f466e&chksm=c2b810c2f5cf99d4c10cc9c81689e970e150248bfad0b2caa54614b30d003ba7b91dbc9d2425"
published_at: "2026-08-03 20:48:00 +08:00"
---

# MyBatis 源码深度拆解（九）：插件 Plugin 拦截器底层原理

> 原作者：狂热大猩猩的技术宅 · 2026年8月3日 20:48
> [阅读微信原文](https://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484061&idx=1&sn=cc54c7165c0d484453f9669e763f466e&chksm=c2b810c2f5cf99d4c10cc9c81689e970e150248bfad0b2caa54614b30d003ba7b91dbc9d2425)
> 原文排版恢复版：保留原作者内容与顺序，仅整理网页显示格式。

<p>面试官：MyBatis 的插件是如何实现的？它能在哪些地方进行拦截？分页插件的工作原理是什么？<br/></p>

<h2><strong>一、开篇</strong></h2>

<p>MyBatis 的插件机制允许我们在<strong>四大对象</strong>的创建和方法调用过程中插入自定义逻辑，从而实现分页、性能监控、SQL 打印、数据权限控制等功能。</p>

<p><strong>四大拦截点</strong>：</p>

<ul><li><code>Executor</code>：执行器，负责 SQL 执行和一级缓存</li><li><code>StatementHandler</code>：语句处理器，负责 JDBC Statement 的操作</li><li><code>ParameterHandler</code>：参数处理器，负责为 PreparedStatement 设置参数</li><li><code>ResultSetHandler</code>：结果集处理器，负责将 ResultSet 映射成 Java 对象</li></ul>

<p><strong>本篇目标</strong>：</p>

<ul><li>理解插件的加载与注册过程</li><li>剖析<code>Plugin</code>类的动态代理实现（JDK 动态代理）</li><li>学习责任链模式在拦截器链中的应用</li><li>以分页插件为例，分析自定义插件的实现原理</li></ul>

<h2><strong>二、插件核心类</strong></h2>

<ul><li><code>Interceptor</code><strong>(拦截器接口)</strong>：由开发者实现，是插件的<strong>行为定义者</strong>，包含 <code>intercept()</code>、<code>plugin()</code> 和 <code>setProperties()</code> 三个核心方法。</li><li><code>InterceptorChain</code>：拦截器链，持有所有插件的列表。</li><li><code>Plugin</code><strong>(代理工具类)</strong>：MyBatis 内置的工具类，是插件的<strong>实现辅助者</strong>。它<strong>实现了 </strong><code><strong>InvocationHandler</strong></code> 接口，其 <code>wrap()</code> 静态方法用于为目标对象创建 JDK 动态代理，并负责在 <code>invoke()</code> 中根据 <code>@Signature</code> 注解的判断结果，决定是否调用 <code>Interceptor.intercept()</code> 方法</li><li><code>Invocation</code>：封装了目标对象、方法、参数，传递给 <code>intercept</code> 方法。</li></ul>

<h2><strong>三、插件的加载与注册</strong></h2>

<h3><strong>3.1 配置方式</strong></h3>

<p>在 <code>mybatis-config.xml</code> 中：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-xml">&lt;plugins&gt;
    &lt;plugin interceptor="com.example.MyPlugin"&gt;
        &lt;property name="property1" value="value1"/&gt;
    &lt;/plugin&gt;
    &lt;plugin interceptor="com.example.PageInterceptor"/&gt;
&lt;/plugins&gt;</code></pre>

<h3><strong>3.2 解析与注册：</strong><code><strong>XMLConfigBuilder.pluginsElement</strong></code></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-java">private void pluginsElement(XNode context) throws Exception {
    if (context != null) {
      for (XNode child : context.getChildren()) {
        String interceptor = child.getStringAttribute("interceptor");
        Properties properties = child.getChildrenAsProperties();
        Interceptor interceptorInstance = (Interceptor) resolveClass(interceptor).getDeclaredConstructor()
            .newInstance();
        interceptorInstance.setProperties(properties);
        configuration.addInterceptor(interceptorInstance);
      }
    }
  }</code></pre>

<h3><strong>3.3</strong><code><strong>Configuration</strong></code><strong>存储拦截器</strong></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">public class Configuration {
    protected final InterceptorChain interceptorChain = new InterceptorChain();

    public void addInterceptor(Interceptor interceptor) {
        interceptorChain.addInterceptor(interceptor);
    }

    public List&lt;Interceptor&gt; getInterceptors() {
        return interceptorChain.getInterceptors();
    }
}</code></pre>

<p><code>InterceptorChain</code> 内部就是一个 <code>List&lt;Interceptor&gt;</code>，按配置顺序存储。<br/></p>

<h2><strong>四、拦截点的生成：InterceptorChain.pluginAll</strong></h2>

<p>当 MyBatis 创建这四大核心对象时，在<strong>对象实例化完成后</strong>，都会<strong>显式调用</strong><code>interceptorChain.pluginAll(target)</code> 方法，用于将配置的拦截器链应用到该对象上，最终返回的可能是一个层层包裹的代理对象。</p>

<h3><strong>4.1</strong><code><strong>Executor</strong></code><strong>创建时</strong></h3>

<p><code>Configuration.newExecutor</code> 方法中：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">public Executor newExecutor(Transaction transaction, ExecutorType executorType) {
    // ... 创建 SimpleExecutor/ReuseExecutor/BatchExecutor
    if (cacheEnabled) {
        executor = new CachingExecutor(executor);
    }
    return (Executor) interceptorChain.pluginAll(executor);
}</code></pre>

<h3><strong>4.2</strong><code><strong>StatementHandler</strong></code><strong>创建时</strong></h3>

<p><code>Configuration.newStatementHandler</code> 方法中：</p>

<ul><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">public StatementHandler newStatementHandler(Executor executor, MappedStatement ms,
        Object parameter, RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql) {
    StatementHandler statementHandler = new RoutingStatementHandler(executor, ms, parameter, rowBounds, resultHandler, boundSql);
    return (StatementHandler) interceptorChain.pluginAll(statementHandler);
}</code></pre>

<h3><strong>4.3</strong><code><strong>ParameterHandler</strong></code><strong>创建时</strong></h3>

<p><code>Configuration.newParameterHandler</code>：</p>

<ul><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">public ParameterHandler newParameterHandler(MappedStatement ms, Object parameter, BoundSql boundSql) {
    ParameterHandler parameterHandler = new DefaultParameterHandler(ms, parameter, boundSql);
    return (ParameterHandler) interceptorChain.pluginAll(parameterHandler);
}</code></pre>

<h3><strong>4.4</strong><code><strong>ResultSetHandler</strong></code><strong>创建时</strong></h3>

<p><code>Configuration.newResultSetHandler</code>：</p>

<ul><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">public ResultSetHandler newResultSetHandler(Executor executor, MappedStatement ms,
        RowBounds rowBounds, ParameterHandler parameterHandler, ResultHandler resultHandler, BoundSql boundSql) {
    ResultSetHandler resultSetHandler = new DefaultResultSetHandler(executor, ms, parameterHandler, resultHandler, boundSql, rowBounds);
    return (ResultSetHandler) interceptorChain.pluginAll(resultSetHandler);
}</code></pre>

<p><code><strong>InterceptorChain.pluginAll</strong></code><strong>实现</strong>：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">public Object pluginAll(Object target) {
    for (Interceptor interceptor : interceptors) {
        target = interceptor.plugin(target);
    }
    return target;
}</code></pre>

<p>每个拦截器可以决定是否对目标对象生成代理（通过 <code>plugin</code> 方法）。通常我们使用 <code>Plugin.wrap</code> 工具方法。</p>

<h2>五、<code>Plugin</code>类：JDK 动态代理的核心</h2>

<p><code>Plugin</code> 类实现了 <code>InvocationHandler</code>，是 MyBatis 提供的便利代理工厂。</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">public class Plugin implements InvocationHandler {
    private final Object target;
    private final Interceptor interceptor;
    private final Map&lt;Class&lt;?&gt;, Set&lt;Method&gt;&gt; signatureMap;

    private Plugin(Object target, Interceptor interceptor, Map&lt;Class&lt;?&gt;, Set&lt;Method&gt;&gt; signatureMap) {
        this.target = target;
        this.interceptor = interceptor;
        this.signatureMap = signatureMap;
    }

    public static Object wrap(Object target, Interceptor interceptor) {
        // 从 @Intercepts 和 @Signature 注解中提取要拦截的接口和方法
        Map&lt;Class&lt;?&gt;, Set&lt;Method&gt;&gt; signatureMap = getSignatureMap(interceptor);
        Class&lt;?&gt; type = target.getClass();
        Class&lt;?&gt;[] interfaces = getAllInterfaces(type, signatureMap);
        if (interfaces.length &gt; 0) {
            return Proxy.newProxyInstance(type.getClassLoader(), interfaces, new Plugin(target, interceptor, signatureMap));
        }
        return target;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        try {
            // 判断当前方法是否需要被拦截
            Set&lt;Method&gt; methods = signatureMap.get(method.getDeclaringClass());
            if (methods != null &amp;&amp; methods.contains(method)) {
                // 需要拦截，调用拦截器的 intercept 方法
                return interceptor.intercept(new Invocation(target, method, args));
            }
            // 不需要拦截，直接调用目标对象的方法
            return method.invoke(target, args);
        } catch (Exception e) {
            throw ExceptionUtil.unwrapThrowable(e);
        }
    }
}</code></pre>

<h3><strong>5.1 注解：</strong><code><strong>@Intercepts</strong></code><strong>和</strong><code><strong>@Signature</strong></code></h3>

<p>自定义插件需要指定拦截的目标和方法签名：</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-perl">@Intercepts({
    @Signature(
        type = Executor.class,
        method = "query",
        args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class}
    )
})
public class MyPlugin implements Interceptor {
    // ...
}</code></pre>

<ul><li><code>type</code>：四大接口之一<br/>（Executor,<code>StatementHandler</code>,<code>ParameterHandler</code>,<code>ResultSetHandler)。</code></li><li><code>method</code>：接口中的方法名。</li><li><code>args</code> 属性用于<strong>精确匹配接口中的重载方法</strong>。因为在 <code>Executor</code> 等接口中，可能存在方法名相同但参数列表不同的情况，通过指定 <code>args</code> 参数类型数组，MyBatis 才能准确定位到开发者想要拦截的具体方法。</li></ul>

<p><code>Plugin.getSignatureMap</code> 会解析这些注解，构建一个 <code>Map&lt;Class&lt;?&gt;, Set&lt;Method&gt;&gt;</code>，用于 <code>invoke</code> 时判断是否拦截。</p>

<h3><strong>5.2 </strong><code><strong>Invocation</strong></code><strong> 类</strong></h3>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-cpp">public class Invocation {
    private final Object target;
    private final Method method;
    private final Object[] args;

    public Object proceed() throws InvocationTargetException, IllegalAccessException {
        return method.invoke(target, args);
    }
    // getters...
}</code></pre>

<p>在自定义插件的<code>intercept</code>方法中，拿到<code>Invocation</code>对象后，可以：</p>

<ul><li>执行前置逻辑</li><li>调用<code>invocation.proceed()</code>继续执行原方法</li><li>执行后置逻辑</li><li>甚至完全修改返回值</li></ul>

<h2><strong>六、自定义插件示例：分页插件核心逻辑</strong></h2>

<p>以下代码来自开源的 PageHelper 分页插件，展示了真实插件如何处理分页逻辑，包括参数个数判断、异步 count、缓存 key 处理等细节。</p>

<ul><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li></ul>

<pre><code class="language-typescript">@Intercepts(
    @Signature(type = Executor.class, method = "query",
        args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class}
    )
)
public class PageInterceptor implements Interceptor {
    private Dialect dialect;
    // ... 其他字段

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        try {
            Object[] args = invocation.getArgs();
            MappedStatement ms = (MappedStatement) args[0];
            Object parameter = args[1];
            RowBounds rowBounds = (RowBounds) args[2];
            ResultHandler resultHandler = (ResultHandler) args[3];
            Executor executor = (Executor) invocation.getTarget();
            CacheKey cacheKey;
            BoundSql boundSql;

            // 重要：query 方法有两种重载：4 参数和 6 参数（带 CacheKey 和 BoundSql）
            if (args.length == 4) {
                // 4 个参数时：动态创建 BoundSql 和 CacheKey
                boundSql = ms.getBoundSql(parameter);
                cacheKey = executor.createCacheKey(ms, parameter, rowBounds, boundSql);
            } else {
                // 6 个参数时：直接从参数中获取
                cacheKey = (CacheKey) args[4];
                boundSql = (BoundSql) args[5];
            }

            checkDialectExists();
            // 如果 dialect 实现了 BoundSqlInterceptor 链，则处理 boundSql
            if (dialect instanceof BoundSqlInterceptor.Chain) {
                boundSql = ((BoundSqlInterceptor.Chain) dialect).doBoundSql(
                    BoundSqlInterceptor.Type.ORIGINAL, boundSql, cacheKey);
            }
            List resultList;

            // 判断是否需要分页
            if (!dialect.skip(ms, parameter, rowBounds)) {
                // 调试堆栈日志（用于检查分页使用是否正确）
                debugStackTraceLog();
                Future&lt;Long&gt; countFuture = null;
                // 是否需要执行 count 查询
                if (dialect.beforeCount(ms, parameter, rowBounds)) {
                    if (dialect.isAsyncCount()) {
                        // 异步查询总数
                        countFuture = asyncCount(ms, boundSql, parameter, rowBounds);
                    } else {
                        // 同步查询总数
                        Long count = count(executor, ms, parameter, rowBounds, null, boundSql);
                        if (!dialect.afterCount(count, parameter, rowBounds)) {
                            // 总数为 0，直接返回空列表
                            return dialect.afterPage(new ArrayList(), parameter, rowBounds);
                        }
                    }
                }
                // 执行分页查询
                resultList = ExecutorUtil.pageQuery(dialect, executor,
                        ms, parameter, rowBounds, resultHandler, boundSql, cacheKey);
                if (countFuture != null) {
                    Long count = countFuture.get();
                    dialect.afterCount(count, parameter, rowBounds);
                }
            } else {
                // 不需要分页，直接执行原始查询（但仍使用已有的 boundSql 和 cacheKey）
                resultList = executor.query(ms, parameter, rowBounds, resultHandler, cacheKey, boundSql);
            }
            return dialect.afterPage(resultList, parameter, rowBounds);
        } finally {
            if (dialect != null) {
                dialect.afterAll();  // 清理 ThreadLocal 等资源
            }
        }
    }

    @Override
    public Object plugin(Object target) {
        // 只对 Executor 类型的对象进行代理
        if (target instanceof Executor) {
            return Plugin.wrap(target, this);
        }
        return target;
    }

    @Override
    public void setProperties(Properties properties) {
        // 初始化 dialect 等
    }
}</code></pre>

<p><strong>关键点解读</strong>：</p>

<ul><li><strong>参数个数判断</strong>：<code>Executor.query</code>有两个重载，4 参数版本（无<code>CacheKey</code>和<code>BoundSql</code>）和 6 参数版本。插件必须兼容两种调用方式。</li><li><code><strong>CacheKey</strong></code><strong>和</strong><code><strong>BoundSql</strong></code><strong>的处理</strong>：如果是从 4 参数进入，需要自己创建；如果是从 6 参数进入，直接使用已有对象。</li><li><strong>异步 count</strong>：某些场景下可异步获取总记录数，提高性能。</li><li><code><strong>dialect</strong></code><strong>策略模式</strong>：不同数据库分页方言实现不同，通过<code>dialect</code>接口解耦。</li><li><strong>资源清理</strong>：<code>finally</code> 块中调用 <code>dialect.afterAll()</code>，确保 <code>ThreadLocal</code> 被清理，避免内存泄漏或线程安全问题。</li></ul>

<h2><strong>七、责任链模式：多个插件的执行顺序</strong></h2>

<ul><li>拦截器按配置顺序添加到<code>InterceptorChain.interceptors</code>列表。</li><li><code>pluginAll</code>遍历列表，对目标对象依次调用<code>interceptor.plugin(target)</code>。</li><li>每个插件都可能返回一个代理对象，pluginAll方法会遍历拦截器列表，后配置的拦截器会包装先配置的拦截器生成的代理，形成<strong>洋葱模型</strong>。当方法被调用时，<strong>从最外层代理（后配置的插件）开始向内执行</strong>，内层插件执行完后，再逐层返回到最外层。。</li><li>当方法被调用时，<strong>从最外层代理开始，层层向内</strong>，如果插件都拦截同一个方法，执行顺序为：配置<strong>最后</strong>的插件先执行<code>intercept</code>，然后<code>invocation.proceed()</code>调用内一层代理。</li></ul>

<p><strong>示例</strong>：两个插件 A（先配置）、B（后配置），都拦截 Executor.query。</p>

<ul><li>包装后：<code>B 代理 包装 A 代理 包装 真实 Executor</code>。</li><li>调用顺序：<code>B.intercept</code>→<code>invocation.proceed()</code>→<code>A.intercept</code>→<code>invocation.proceed()</code>→ 真实 Executor.query。</li><li>返回时逆序。</li></ul>

<h2><strong>八、面试高频题</strong></h2>

<h3>Q1：MyBatis 插件能拦截哪些对象和方法？</h3>

<p><strong>A</strong>：四大对象：<code>Executor</code>、<code>StatementHandler</code>、<code>ParameterHandler</code>、<code>ResultSetHandler</code>。具体拦截的方法通过<code>@Signature</code>注解指定，只要这些类中声明的方法都可以拦截。</p>

<h3>Q2：MyBatis 插件使用什么技术实现？为什么能拦截接口方法？</h3>

<p><strong>A</strong>：使用<strong>JDK 动态代理</strong>。四大对象都是<strong>接口</strong>（<code>Executor</code>、<code>StatementHandler</code>、<code>ParameterHandler</code>、<code>ResultSetHandler</code>），JDK 动态代理可以对这些接口生成代理对象，在<code>invoke</code>方法中判断是否执行拦截逻辑。</p>

<h3>Q3：多个插件执行顺序是怎样的？</h3>

<p><strong>A</strong>：按<code>mybatis-config.xml</code>中<code>&lt;plugin&gt;</code>配置的顺序，<strong>后配置的插件包装先配置的插件</strong>。执行时，最外层的插件（后配置）最先执行<code>intercept</code>，调用<code>proceed()</code>后进入内层插件，最后才到达真实对象。</p>

<h3>Q4：自定义插件需要注意什么？</h3>

<p><strong>A</strong>：</p>

<ul><li>实现<code>Interceptor</code>接口，并使用<code>@Intercepts</code>和<code>@Signature</code>注解。</li><li>在<code>plugin</code>方法中通常使用<code>Plugin.wrap(target, this)</code>生成代理。</li><li>不要忘记调用<code>invocation.proceed()</code>放行原方法，否则可能导致业务中断。</li><li>注意线程安全问题（如分页插件使用<code>ThreadLocal</code>传递分页参数，用完后必须清理）。</li></ul>

<h3>Q5：<code>Plugin.wrap</code>方法中，如何判断一个接口方法是否需要拦截？</h3>

<p><strong>A</strong>：通过解析<code>@Intercepts</code>注解生成<code>signatureMap</code>，<code>invoke</code>时根据当前<code>method</code>的 declaring class 和 method 本身是否在<code>signatureMap</code>中决定。</p>

<h2><strong>九、下篇预告</strong></h2>

<p>第 10 篇我们将深入<strong>TypeHandler 类型转换体系</strong>，包括：</p>

<ul><li>JDBC 类型与 Java 类型的映射关系</li><li>内置类型处理器全集</li><li>自定义 TypeHandler 的开发与注册</li><li>参数赋值和结果集封装底层调用时机</li></ul>

<p>如果觉得有帮助，欢迎<strong>点赞、在看、转发</strong>支持！</p>

<p>系列持续更新，关注不走丢 👇</p>

<br/>

<p></p>
