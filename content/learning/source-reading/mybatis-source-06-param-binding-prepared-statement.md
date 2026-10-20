---
title: "MyBatis 源码深度拆解（六）：#{} 与 ${} 底层解析 & SQL 预编译"
date: "2026-07-05"
domain: "学习"
area: "Java 后端"
module: "MyBatis 源码拆解"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "面试官： #{}  和  ${}  有什么区别？为什么  #{}  能防 SQL 注入？MyBatis 是在哪一步把  …"
tags:
  - "MyBatis"
  - "源码分析"
source: "微信公众号「狂热大猩猩的技术宅」"
source_url: "https://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484040&idx=1&sn=99900e58e886497ad1b5cd83b1d8eb3d&chksm=c2b810d7f5cf99c19626001222ba87e9791f079642d707d36cc59789f409675efa6d28514478"
published_at: "2026-07-05 17:13:00 +08:00"
---

# MyBatis 源码深度拆解（六）：#{} 与 ${} 底层解析 & SQL 预编译

> 原作者：狂热大猩猩的技术宅 · 2026年7月5日 17:13
> [阅读微信原文](https://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484040&idx=1&sn=99900e58e886497ad1b5cd83b1d8eb3d&chksm=c2b810d7f5cf99c19626001222ba87e9791f079642d707d36cc59789f409675efa6d28514478)
> 原文排版恢复版：保留原作者内容与顺序，仅整理网页显示格式。

<p>面试官：<code>#{}</code> 和 <code>${}</code> 有什么区别？为什么 <code>#{}</code> 能防 SQL 注入？MyBatis 是在哪一步把 <code>#{}</code> 替换成 <code>?</code> 的？</p>

<h2><strong>一、开篇：一个最常见的问题</strong></h2>

<p>在 MyBatis 的 Mapper 文件或注解中，我们经常这样写：</p>



<pre><code class="language-powershell">SELECT * FROM user WHERE id = #{id}
SELECT * FROM user WHERE name like '%${keyword}%'</code></pre>

<p>两种占位符，一个用<code>#{}</code>，一个用<code>${}</code>，它们到底有什么本质区别？源码中是如何处理的？</p>

<p><strong>本篇目标</strong>：</p>

<ul><li>深入<code>BoundSql</code>构建过程，看清<code>#{}</code>如何变成<code>?</code></li><li>对比<code>${}</code>的直接拼接逻辑，解释 SQL 注入风险</li><li>追踪 PreparedStatement 预编译和参数设置的全过程</li></ul>

<h2><strong>二、整体流程概述</strong></h2>

<p><strong>核心角色</strong>：</p>

<ul><li><code>SqlSource</code>：负责解析动态 SQL，生成<code>BoundSql</code></li><li><code>BoundSql</code>：封装最终 SQL（带<code>?</code>）和参数映射信息</li><li><code>ParameterHandler</code>：负责将参数设置到 <code>PreparedStatement</code> 中</li></ul>

<h2><strong>三、</strong><code><strong>BoundSql</strong></code><strong>的构建入口</strong></h2>

<h3><strong>3.1 从 MappedStatement 获取 BoundSql</strong></h3>

<p>当执行查询时，<code>Executor</code> 需要获取 <code>BoundSql</code>：</p>



<pre><code class="language-typescript">// MappedStatement
public BoundSql getBoundSql(Object parameterObject) {
    BoundSql boundSql = sqlSource.getBoundSql(parameterObject);
    // 处理 parameterMappings 中可能缺失的参数
    return boundSql;
}</code></pre>

<p><code>sqlSource</code>接口的实现类有多种，如：</p>

<ul><li><code>StaticSqlSource</code>：静态 SQL（没有<code>${}</code>或动态标签）</li><li><code>DynamicSqlSource</code>：包含<code>${}</code>或<code>&lt;if&gt;</code>等动态元素的 SQL</li><li><code>RawSqlSource</code>：用于封装在 XML 解析阶段就能确定下来的 SQL，可能含有 #{} 占位符，但不包含 ${} 或任何动态 SQL 标签（如 <code>&lt;if&gt;</code>、<code>&lt;where&gt;</code> 等），在构建时就会完成对 #{} 的解析</li></ul>

<p>对于大多数动态 SQL，使用的是<code>DynamicSqlSource</code>。</p>

<h3><strong>3.2 </strong><code><strong>DynamicSqlSource.getBoundSql</strong></code></h3>



<pre><code class="language-java">// DynamicSqlSource
public BoundSql getBoundSql(Object parameterObject) {
    // 1. 使用 Context 解析动态 SQL，生成最终 SQL 字符串（包含 ${} 的直接拼接和静态文本）
    DynamicContext context = new DynamicContext(configuration, parameterObject);
    // 在这里，${} 被替换，&lt;if&gt;、&lt;foreach&gt; 等动态标签被处理
    rootSqlNode.apply(context);      // rootSqlNode 是动态 SQL 的根节点

    // 2. 处理 ${} 替换后，得到包含 #{} 的 SQL
    String sql = context.getSql();

    // 3. 解析 #{}，生成 ParameterMapping 列表，同时将 #{} 替换为 ?
    SqlSourceBuilder sqlSourceParser = new SqlSourceBuilder(configuration);
    Class&lt;?&gt; parameterType = parameterObject == null ? Object.class : parameterObject.getClass();
    SqlSource sqlSource = sqlSourceParser.parse(sql, parameterType, context.getBindings());

    // 4. 获取最终的 BoundSql（此时 sql 已经是带 ? 的）
    BoundSql boundSql = sqlSource.getBoundSql(parameterObject);

    // 5. 将 DynamicContext 中的额外的参数（如 _parameter）复制到 BoundSql 中
    context.getBindings().forEach(boundSql::setAdditionalParameter);
    return boundSql;
}</code></pre>

<p>关键步骤在第 3 步：<code>SqlSourceBuilder.parse</code> 负责 <strong>将 </strong><code><strong>#{}</strong></code><strong> 替换成 </strong><code><strong>?</strong></code><strong>，并提取参数映射</strong>。<br/></p>

<h2><strong>四、</strong><code><strong>#{}</strong></code><strong>的底层解析：</strong><code><strong>SqlSourceBuilder</strong></code></h2>

<h3><strong>4.1 </strong><code><strong>SqlSourceBuilder.parse</strong></code><strong> 方法</strong></h3>



<pre><code class="language-typescript">// SqlSourceBuilder
public SqlSource parse(String originalSql, Class&lt;?&gt; parameterType, Map&lt;String, Object&gt; additionalParameters) {
    ParameterMappingTokenHandler handler = new ParameterMappingTokenHandler(configuration, parameterType, additionalParameters);
    GenericTokenParser parser = new GenericTokenParser("#{", "}", handler);
    String sql;
    if (configuration.isShrinkWhitespacesInSql()) {
        // 可选：压缩多余空白字符，使 SQL 规范化，提高缓存命中率
        sql = parser.parse(removeExtraWhitespaces(originalSql));
    } else {
        sql = parser.parse(originalSql);
    }
    return new StaticSqlSource(configuration, sql, handler.getParameterMappings());
}</code></pre>

<p><strong>关键类</strong><code><strong>GenericTokenParser</strong></code>：一个通用的标记解析器，用开放标记（如<code>#{</code>）和闭合标记（<code>}</code>），每找到一个标记对，就调用 handler 的<code>handleToken</code>方法处理。</p>

<ul><li><code>shrinkWhitespacesInSql</code>是一个全局配置，若开启，会在解析<code>#{}</code>之前先对原始 SQL 进行空白压缩（将连续空白替换为单个空格，去除首尾空白等）。</li><li>这样做的好处是：即使 Mapper XML 中 SQL 格式不同（如换行、空格数量差异），最终生成的 <code>BoundSql.sql</code> 字符串相同，可以共享 <code>MappedStatement</code> 的缓存，提高命中率。</li></ul>

<h3><strong>4.2 </strong><code><strong>ParameterMappingTokenHandler.handleToken</strong></code></h3>



<pre><code class="language-typescript">// ParameterMappingTokenHandler   将实际内容简单整合了下  看源码时注意下
public String handleToken(String content) {
    // content 是 #{...} 里面的内容，例如 "id", "user.name", "param1"}
    // 1. 解析参数名、javaType、jdbcType、typeHandler 等
    ParameterMapping.Builder builder = new ParameterMapping.Builder(configuration, content, parameterType);
    // ... 解析属性（javaType, jdbcType, mode, numericScale, resultMapId, typeHandler 等）
    ParameterMapping mapping = builder.build();
    // 2. 添加到参数映射列表
    parameterMappings.add(mapping);
    // 3. 替换为 ? 占位符
    return "?";
}</code></pre>

<p><strong>举例</strong>：<br/>输入 SQL：<code>SELECT * FROM user WHERE id = #{id} AND name = #{name}</code><br/>输出 SQL：<code>SELECT * FROM user WHERE id = ? AND name = ?</code><br/><code>parameterMappings</code>：<code>[ParameterMapping{property='id'}, ParameterMapping{property='name'}]</code></p>

<h3><strong>4.3</strong><code><strong>GenericTokenParser</strong></code><strong>的解析逻辑</strong></h3>



<pre><code class="language-java">public String parse(String text) {
    if (text == null || text.isEmpty()) return "";
    int start = text.indexOf(openToken);
    if (start == -1) return text;

    char[] src = text.toCharArray();
    int offset = 0;
    StringBuilder builder = new StringBuilder();
    StringBuilder expression = null;

    do {
        // 1. 检查开放标记前是否有转义符 '\'
        if (start &gt; 0 &amp;&amp; src[start - 1] == '\\') {
            // 遇到转义：去掉反斜杠，原样输出 openToken，继续
            builder.append(src, offset, start - offset - 1).append(openToken);
            offset = start + openToken.length();
        } else {
            // 2. 找到有效开放标记
            builder.append(src, offset, start - offset);
            offset = start + openToken.length();

            // 3. 寻找闭合标记，处理转义
            int end = text.indexOf(closeToken, offset);
            while (end &gt; -1) {
                if (src[end - 1] != '\\') {
                    // 未转义的闭合标记
                    expression.append(src, offset, end - offset);
                    break;
                }
                // 转义的闭合标记：去掉反斜杠，保留 closeToken，继续查找
                expression.append(src, offset, end - offset - 1).append(closeToken);
                offset = end + closeToken.length();
                end = text.indexOf(closeToken, offset);
            }

            if (end == -1) {
                // 闭合标记未找到：将剩余部分原样输出
                builder.append(src, start, src.length - start);
                offset = src.length;
            } else {
                // 4. 调用 handler 处理内容，并替换为处理结果
                builder.append(handler.handleToken(expression.toString()));
                offset = end + closeToken.length();
            }
        }
        start = text.indexOf(openToken, offset);
    } while (start &gt; -1);

    if (offset &lt; src.length) {
        builder.append(src, offset, src.length - offset);
    }
    return builder.toString();
}</code></pre>

<p><strong>关键点</strong>：</p>

<ul><li><strong>转义支持</strong>：<code>\#{...}</code>会被解析为文本<code>#{...}</code>，而非占位符。这允许在 SQL 中输出<code>#{}</code>字面量。</li><li><strong>性能优化</strong>：使用<code>char[]</code>和手动偏移，避免重复创建子串。</li><li><strong>鲁棒性</strong>：处理闭合标记缺失、嵌套转义等情况。</li></ul>



<pre><code class="language-javascript">// 示例：输入 SQL 中包含转义占位符
String sql = "SELECT * FROM user WHERE name = '\\#{value}' AND id = #{id}";
// 解析结果：
// SELECT * FROM user WHERE name = '#{value}' AND id = ?
// 注：\\#{value} 转义后变为 #{value} 字面文本，不会被处理</code></pre>

<h2><strong>五、</strong><code><strong>${}</strong></code><strong>的底层解析：</strong><code><strong>VariableTokenHandler</strong></code></h2>

<p>与 <code>#{}</code> 使用专门的 <code>ParameterMappingTokenHandler</code> 不同，<code>${}</code> 的处理发生在 <strong>动态 SQL 解析阶段</strong>，由对应的 TokenHandler 实现进行直接字符串替换，不产生 ?，也不收集 ParameterMapping。</p>

<h3><strong>5.1</strong><code><strong>GenericTokenParser</strong></code><strong>配合</strong><code><strong>VariableTokenHandler</strong></code></h3>

<p>在 <code>DynamicSqlSource</code> 解析动态 SQL 时，会使用 <code>TextSqlNode</code> 处理文本节点，其中就包含 <code>${}</code> 的解析：</p>



<pre><code class="language-typescript">// TextSqlNode
public boolean apply(DynamicContext context) {
    // 创建 GenericTokenParser，使用 ${} 标记  稍微合并了一下
    GenericTokenParser parser = new GenericTokenParser("${", "}", new BindingTokenParser(context, injectionFilter));
    context.appendSql(parser.parse(text));
    return true;
}</code></pre>

<p><code>BindingTokenParser.handleToken</code>的实现：</p>



<pre><code class="language-typescript">// BindingTokenParser
@Override
public String handleToken(String content) {
    Object parameter = context.getBindings().get("_parameter");
    if (parameter == null) {
        context.getBindings().put("value", null);
    } else if (SimpleTypeRegistry.isSimpleType(parameter.getClass())) {
        context.getBindings().put("value", parameter);
    }
    // 使用 OGNL 或反射从参数对象中获取 property 的值
    Object value = OgnlCache.getValue(content, context.getBindings());
    // 直接返回 value 的字符串形式（null 会转为空字符串）
    String srtValue = value == null ? "" : String.valueOf(value);
    checkInjection(srtValue);
    return srtValue;
}</code></pre>

<p><strong>关键差异</strong>：</p>

<ul><li><code>${}</code>：直接获取参数值，转成字符串拼接到 SQL 中，<strong>不产生</strong><code><strong>?</strong></code><strong>，也不收集</strong><code><strong>ParameterMapping</strong></code></li><li><code>#{}</code>：替换为 <code>?</code>，收集参数映射，后续通过 <code>PreparedStatement</code> 设置参数</li></ul>

<p>在 MyBatis 解析 SQL 时，<code>SqlSourceBuilder.parse</code> 会将 <code>#{}</code> 占位符替换为 <code>?</code>，同时通过 <code>ParameterMappingTokenHandler</code> 收集每个 <code>#{}</code> 的参数属性（如参数名、Java 类型、JDBC 类型等），生成 <code>ParameterMapping</code> 列表并存入 <code>BoundSql</code>。<br/>需要强调的是，这个阶段 <strong>MyBatis 不会在 SQL 字符串里给参数值加任何引号</strong>，只是单纯地替换成 <code>?</code>。<br/>到了执行阶段，<code>PreparedStatementHandler或</code></p>

<p><code>DefaultParameterHandler</code>会依据 <code>ParameterMapping</code> 的顺序，通过 <code>PreparedStatement</code> 的 <code>setXxx</code> 方法为每个 <code>?</code> 设置具体的参数值。此时，<strong>JDBC 驱动会根据参数的 </strong><code><strong>java.sql.Types</strong></code><strong> 类型来决定如何格式化值</strong>（例如对字符串类型自动加上单引号并进行转义）。<br/>所以，“自动加引号”实际上是 <strong>JDBC 预编译机制 + 驱动实现</strong> 带来的结果，而不是 MyBatis 在 SQL 文本拼接阶段的行为。这也正是 <code>#{}</code> 能够安全传递参数、避免 SQL 注入的根本原因。</p>

<h2><strong>六、</strong><code><strong>PreparedStatement</strong></code><strong>预编译和参数设置</strong></h2>

<p>经过<code>SqlSourceBuilder</code>处理后，SQL 已经变成带<code>?</code>的形式。接下来到<code>PreparedStatementHandler</code>中执行。</p>

<h3><strong>6.1 预编译：</strong><code><strong>StatementHandler.prepare</strong></code></h3>



<pre><code class="language-java">public abstract class BaseStatementHandler implements StatementHandler {
    @Override
    public Statement prepare(Connection connection, Integer transactionTimeout) throws SQLException {
        ErrorContext.instance().sql(boundSql.getSql()); // 记录即将执行的SQL
        Statement statement = null;
        try {
            // 1. 关键步骤：调用子类实现的instantiateStatement()来创建具体的Statement对象
            statement = instantiateStatement(connection);
            setStatementTimeout(statement, transactionTimeout);
            setFetchSize(statement);
            return statement;
        } catch (SQLException e) {
            closeStatement(statement);
            throw e;
        } catch (Exception e) {
            closeStatement(statement);
            throw new ExecutorException("Error preparing statement.  Cause: " + e, e);
        }
    }
    // 抽象方法，留给子类去实现，用于创建具体的Statement
    protected abstract Statement instantiateStatement(Connection connection) throws SQLException;
}</code></pre>

<p>这里获得的<code>PreparedStatement</code>已经完成了 SQL 预编译，数据库会保存该 SQL 的执行计划。</p>

<h3><strong>6.2 参数设置：</strong><code><strong>ParameterHandler.setParameters</strong></code></h3>



<pre><code class="language-java">// DefaultParameterHandler
public void setParameters(PreparedStatement ps) {
    List&lt;ParameterMapping&gt; parameterMappings = boundSql.getParameterMappings();
    for (int i = 0; i &lt; parameterMappings.size(); i++) {
        ParameterMapping mapping = parameterMappings.get(i);
        String propertyName = mapping.getProperty();
        Object value = 从参数对象中获取 propertyName 的值;
        // 根据 jdbcType 和 typeHandler 设置参数
        typeHandler.setParameter(ps, i + 1, value, jdbcType);
    }
}</code></pre>

<p><code>#{}</code> 产生的 <code>ParameterMapping</code> 告诉 MyBatis：第 i+1 个 <code>?</code> 应该填入什么值，使用什么类型处理器。</p>

<h2><strong>七、</strong><code><strong>#{}</strong></code><strong> 与 </strong><code><strong>${}</strong></code><strong> 完整对比</strong></h2>

<table></table>

<table><caption></caption></table>

<table><caption><br/></caption><tfoot><tr><td></td></tr></tfoot></table>

<table><tfoot><tr><td></td></tr></tfoot></table>

<table><caption></caption><tbody><tr><td><p>维度</p></td><td><p><code>#{}</code></p></td><td><p><code>${}</code></p></td></tr><tr><td><p>处理时机</p></td><td><p>SQL 解析阶段（<code>SqlSourceBuilder</code>）</p></td><td><p>动态 SQL 解析阶段（<code>TextSqlNode</code>）</p></td></tr><tr><td><p>处理方式</p></td><td><p>替换为 <code>?</code>，收集 <code>ParameterMapping</code></p></td><td><p>直接拼接参数值的字符串表示</p></td></tr><tr><td><p>预编译</p></td><td><p>是（<code>PreparedStatement</code>）</p></td><td><p>否（普通 <code>Statement</code>，或拼接后再预编译）</p></td></tr><tr><td><p>SQL 注入风险</p></td><td><p><strong>无</strong>（参数值与 SQL 结构分离）</p></td><td><p><strong>有</strong>（参数值改变 SQL 结构）</p></td></tr><tr><td><p>适用场景</p></td><td><p>几乎所有参数传递</p></td><td><p>表名、列名、ORDER BY 字段等无法使用占位符的地方</p></td></tr><tr><td><p>缓存影响</p></td><td><p>相同的 SQL 模板可缓存（参数不同不影响）</p></td><td><p>SQL 字符串直接变化，不易命中缓存</p></td></tr></tbody></table>

<h2><br/><p><strong>SQL 注入示例</strong>：</p><pre><code class="language-powershell">-- 使用 ${}
SELECT * FROM user WHERE name = '${name}'
-- 如果 name 传入 ' OR '1'='1，SQL 变为：
SELECT * FROM user WHERE name = '' OR '1'='1'   -- 永远为真，返回所有用户
-- 使用 #{}
SELECT * FROM user WHERE name = #{name}
-- 传入同样的值，预编译后：
SELECT * FROM user WHERE name = ?
-- 参数值被当作字符串字面量，' OR '1'='1 不会改变 SQL 结构</code></pre></h2>

<h2><strong>八、源码级风险验证：</strong><code><strong>${}</strong></code><strong>的危险性</strong></h2>

<p>在 MyBatis 源码中，如果错误使用 <code>${}</code>，会导致 SQL 注入。例如在 Mapper XML 中：</p>



<pre><code class="language-sql">&lt;select id="findUser" resultType="User"&gt;
    SELECT * FROM user WHERE name = '${name}'
&lt;/select&gt;</code></pre>

<p>当<code>name = "xxx' OR '1'='1"</code>时，最终生成的 SQL 为：</p>



<pre><code class="language-sql">SELECT * FROM user WHERE name = 'xxx' OR '1'='1'</code></pre>

<p>这是因为 <code>${}</code> 处理时，只是简单调用 <code>String.valueOf(value)</code>，不做任何转义，直接拼接到 SQL 字符串中。</p>

<h2><strong>九、面试高频题</strong></h2>

<h3>Q1：<code>#{}</code>是如何防止 SQL 注入的？</h3>

<p><strong>A</strong>：<code>#{}</code>在解析阶段被替换成<code>?</code>，后续使用<code>PreparedStatement</code>设置参数。<code>PreparedStatement</code>会将参数值进行<strong>转义</strong>或<strong>类型安全处理</strong>，确保参数值不会改变 SQL 结构。例如字符串参数中的单引号会被自动转义，从而避免了 SQL 注入。</p>

<h3>Q2：<code>${}</code>在什么场景下必须使用？</h3>

<p><strong>A</strong>：当需要动态传入<strong>数据库对象名</strong>（如表名、列名、排序字段）时，不能使用<code>#{}</code>，因为<code>?</code>占位符只能用于值，不能用于标识符。例如：</p>

<ul><li><code>SELECT * FROM ${tableName}</code></li><li><code>ORDER BY ${columnName} ${orderType}</code></li></ul>

<h3>Q3：MyBatis 如何处理动态 SQL 中的<code>${}</code>嵌套<code>#{}</code>？</h3>

<p><strong>A</strong>：解析顺序是先处理<code>${}</code>（在<code>DynamicSqlSource</code>阶段），再处理<code>#{}</code>（在<code>SqlSourceBuilder</code>阶段）。所以<code>${}</code>中可以包含<code>#{}</code>？这通常不推荐，因为<code>${}</code>替换后可能破坏<code>#{}</code>的结构，造成解析错误。</p>

<h3>Q4：<code>BoundSql</code>中的<code>parameterMappings</code>是如何生成的？</h3>

<p><strong>A</strong>：由<code>ParameterMappingTokenHandler</code>在解析<code>#{}</code>时依次收集。每一个<code>#{}</code>产生一个<code>ParameterMapping</code>，记录属性名、javaType、jdbcType、typeHandler 等信息，用于后续设置参数。</p>

<h3>Q5：使用<code>#{}</code>时，参数值为 null 会怎么办？</h3>

<p><strong>A</strong>：MyBatis 会使用<code>jdbcType</code>决定如何处理。如果配置了<code>jdbcType</code>（如<code>#{name, jdbcType=VARCHAR}</code>），则按指定类型设置 null；如果没有指定，某些数据库驱动可能报错（如 Oracle 需要明确<code>jdbcType</code>）。一般建议设置全局配置<code>jdbcTypeForNull=NULL</code>。</p>

<hr/>

<h2><strong>十、下篇预告</strong></h2>

<p>第 7 篇我们将深入<strong>一级缓存</strong>，彻底拆解：</p>

<ul><li>一级缓存的存储结构（<code>PerpetualCache</code>+<code>HashMap</code>）</li><li>缓存 Key 的生成规则（<code>CacheKey</code>的组成）</li><li>一级缓存何时命中、何时失效</li><li>为什么一级缓存是 SqlSession 级别</li></ul>

<p>如果觉得有帮助，欢迎<strong>点赞、在看、转发</strong>支持！</p>

<p>系列持续更新，关注不走丢 👇</p>

<br/>

<p></p>
