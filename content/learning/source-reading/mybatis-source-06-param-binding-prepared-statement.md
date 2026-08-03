---
title: "MyBatis 源码深度拆解（六）：#{} 与 ${} 底层解析 &amp; SQL 预编译"
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
---

# MyBatis 源码深度拆解（六）：#{} 与 ${} 底层解析 &amp; SQL 预编译

> 来源：微信公众号（MyBatis 源码深度拆解系列）
> 链接：[http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484040&idx=1&sn=99900e58e886497ad1b5cd83b1d8eb3d&chksm=c2b810d7f5cf99c19626001222ba87e9791f079642d707d36cc59789f409675efa6d28514478](http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484040&idx=1&sn=99900e58e886497ad1b5cd83b1d8eb3d&chksm=c2b810d7f5cf99c19626001222ba87e9791f079642d707d36cc59789f409675efa6d28514478)
> 类型：📚 参考资料（非面试题/面经）—— MyBatis 源码深度拆解系列
> 相关：第48题(深分页优化)、第247题(MyBatis 分页拦截器)
> 整理时间：2026-08-03

---

面试官：

#{}

 和 

${}

 有什么区别？为什么 

#{}

 能防 SQL 注入？MyBatis 是在哪一步把 

#{}

 替换成 

?

 的？

一、开篇：一个最常见的问题

在 MyBatis 的 Mapper 文件或注解中，我们经常这样写：


```
<code><span leaf=""><span class="code-snippet__built_in">SELECT</span> * FROM user <span class="code-snippet__built_in">WHERE</span> id = <span class="code-snippet__comment">#{id}</span></span></code><code><span leaf=""><span class="code-snippet__built_in">SELECT</span> * FROM user <span class="code-snippet__built_in">WHERE</span> name like <span class="code-snippet__string">'%${keyword}%'</span></span></code>
```


两种占位符，一个用

#{}

，一个用

${}

，它们到底有什么本质区别？源码中是如何处理的？

本篇目标

：

深入

BoundSql

构建过程，看清

#{}

如何变成

?

对比

${}

的直接拼接逻辑，解释 SQL 注入风险

追踪 PreparedStatement 预编译和参数设置的全过程

二、整体流程概述

核心角色

：

SqlSource

：负责解析动态 SQL，生成

BoundSql

BoundSql

：封装最终 SQL（带

?

）和参数映射信息

ParameterHandler

：负责将参数设置到 

PreparedStatement

 中

三、

BoundSql

的构建入口

3.1 从 MappedStatement 获取 BoundSql

当执行查询时，

Executor

 需要获取 

BoundSql

：


```
<code><span leaf=""><span class="code-snippet__comment">// MappedStatement</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">BoundSql</span> <span class="code-snippet__title">getBoundSql</span>(<span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameterObject</span>) {</span></code><code><span leaf="">    <span class="code-snippet__title">BoundSql</span> boundSql = sqlSource.<span class="code-snippet__title">getBoundSql</span>(parameterObject);</span></code><code><span leaf="">    <span class="code-snippet__comment">// 处理 parameterMappings 中可能缺失的参数</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> boundSql;</span></code><code><span leaf="">}</span></code>
```


sqlSource

接口的实现类有多种，如：

StaticSqlSource

：静态 SQL（没有

${}

或动态标签）

DynamicSqlSource

：包含

${}

或

<if>

等动态元素的 SQL

RawSqlSource

：用于封装在 XML 解析阶段就能确定下来的 SQL，可能含有 #{} 占位符，但不包含 ${} 或任何动态 SQL 标签（如 

<if>

、

<where>

 等），在构建时就会完成对 #{} 的解析

对于大多数动态 SQL，使用的是

DynamicSqlSource

。

3.2 

DynamicSqlSource.getBoundSql


```
<code><span leaf=""><span class="code-snippet__comment">// DynamicSqlSource</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> BoundSql <span class="code-snippet__title">getBoundSql</span><span class="code-snippet__params">(Object parameterObject)</span> {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 1. 使用 Context 解析动态 SQL，生成最终 SQL 字符串（包含 ${} 的直接拼接和静态文本）</span></span></code><code><span leaf="">    <span class="code-snippet__type">DynamicContext</span> <span class="code-snippet__variable">context</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">DynamicContext</span>(configuration, parameterObject);</span></code><code><span leaf="">    <span class="code-snippet__comment">// 在这里，${} 被替换，<if>、<foreach> 等动态标签被处理</span></span></code><code><span leaf="">    rootSqlNode.apply(context);      <span class="code-snippet__comment">// rootSqlNode 是动态 SQL 的根节点</span></span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 2. 处理 ${} 替换后，得到包含 #{} 的 SQL</span></span></code><code><span leaf="">    <span class="code-snippet__type">String</span> <span class="code-snippet__variable">sql</span> <span class="code-snippet__operator">=</span> context.getSql();</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 3. 解析 #{}，生成 ParameterMapping 列表，同时将 #{} 替换为 ?</span></span></code><code><span leaf="">    <span class="code-snippet__type">SqlSourceBuilder</span> <span class="code-snippet__variable">sqlSourceParser</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">SqlSourceBuilder</span>(configuration);</span></code><code><span leaf="">    Class<?> parameterType = parameterObject == <span class="code-snippet__literal">null</span> ? Object.class : parameterObject.getClass();</span></code><code><span leaf="">    <span class="code-snippet__type">SqlSource</span> <span class="code-snippet__variable">sqlSource</span> <span class="code-snippet__operator">=</span> sqlSourceParser.parse(sql, parameterType, context.getBindings());</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 4. 获取最终的 BoundSql（此时 sql 已经是带 ? 的）</span></span></code><code><span leaf="">    <span class="code-snippet__type">BoundSql</span> <span class="code-snippet__variable">boundSql</span> <span class="code-snippet__operator">=</span> sqlSource.getBoundSql(parameterObject);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__comment">// 5. 将 DynamicContext 中的额外的参数（如 _parameter）复制到 BoundSql 中</span></span></code><code><span leaf="">    context.getBindings().forEach(boundSql::setAdditionalParameter);</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> boundSql;</span></code><code><span leaf="">}</span></code>
```


关键步骤在第 3 步：

SqlSourceBuilder.parse

 负责 

将 

#{}

 替换成 

?

，并提取参数映射

。

四、

#{}

的底层解析：

SqlSourceBuilder

4.1 

SqlSourceBuilder.parse

 方法


```
<code><span leaf=""><span class="code-snippet__comment">// SqlSourceBuilder</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">SqlSource</span> <span class="code-snippet__title">parse</span>(<span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> originalSql, </span><span class="code-snippet__params"><span class="code-snippet__title">Class</span></span><span class="code-snippet__params"><?> parameterType, </span><span class="code-snippet__params"><span class="code-snippet__title">Map</span></span><span class="code-snippet__params"><</span><span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params">, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params">> additionalParameters</span>) {</span></code><code><span leaf="">    <span class="code-snippet__title">ParameterMappingTokenHandler</span> handler = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">ParameterMappingTokenHandler</span>(configuration, parameterType, additionalParameters);</span></code><code><span leaf="">    <span class="code-snippet__title">GenericTokenParser</span> parser = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">GenericTokenParser</span>(<span class="code-snippet__string">"#{"</span>, <span class="code-snippet__string">"}"</span>, handler);</span></code><code><span leaf="">    <span class="code-snippet__title">String</span> sql;</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (configuration.<span class="code-snippet__title">isShrinkWhitespacesInSql</span>()) {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 可选：压缩多余空白字符，使 SQL 规范化，提高缓存命中率</span></span></code><code><span leaf="">        sql = parser.<span class="code-snippet__title">parse</span>(<span class="code-snippet__title">removeExtraWhitespaces</span>(originalSql));</span></code><code><span leaf="">    } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">        sql = parser.<span class="code-snippet__title">parse</span>(originalSql);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">StaticSqlSource</span>(configuration, sql, handler.<span class="code-snippet__title">getParameterMappings</span>());</span></code><code><span leaf="">}</span></code>
```


关键类

GenericTokenParser

：一个通用的标记解析器，用开放标记（如

#{

）和闭合标记（

}

），每找到一个标记对，就调用 handler 的

handleToken

方法处理。

shrinkWhitespacesInSql

是一个全局配置，若开启，会在解析

#{}

之前先对原始 SQL 进行空白压缩（将连续空白替换为单个空格，去除首尾空白等）。

这样做的好处是：即使 Mapper XML 中 SQL 格式不同（如换行、空格数量差异），最终生成的 

BoundSql.sql

 字符串相同，可以共享 

MappedStatement

 的缓存，提高命中率。

4.2 

ParameterMappingTokenHandler.handleToken


```
<code><span leaf=""><span class="code-snippet__comment">// ParameterMappingTokenHandler   将实际内容简单整合了下  看源码时注意下</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">String</span> <span class="code-snippet__title">handleToken</span>(<span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> content</span>) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// content 是 #{...} 里面的内容，例如 "id", "user.name", "param1"}</span></span></code><code><span leaf="">    <span class="code-snippet__comment">// 1. 解析参数名、javaType、jdbcType、typeHandler 等</span></span></code><code><span leaf="">    <span class="code-snippet__title">ParameterMapping</span>.<span class="code-snippet__property">Builder</span> builder = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">ParameterMapping</span>.<span class="code-snippet__title">Builder</span>(configuration, content, parameterType);</span></code><code><span leaf="">    <span class="code-snippet__comment">// ... 解析属性（javaType, jdbcType, mode, numericScale, resultMapId, typeHandler 等）</span></span></code><code><span leaf="">    <span class="code-snippet__title">ParameterMapping</span> mapping = builder.<span class="code-snippet__title">build</span>();</span></code><code><span leaf="">    <span class="code-snippet__comment">// 2. 添加到参数映射列表</span></span></code><code><span leaf="">    parameterMappings.<span class="code-snippet__title">add</span>(mapping);</span></code><code><span leaf="">    <span class="code-snippet__comment">// 3. 替换为 ? 占位符</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> <span class="code-snippet__string">"?"</span>;</span></code><code><span leaf="">}</span></code>
```


举例

：

输入 SQL：

SELECT * FROM user WHERE id = #{id} AND name = #{name}

输出 SQL：

SELECT * FROM user WHERE id = ? AND name = ?

parameterMappings

：

[ParameterMapping{property='id'}, ParameterMapping{property='name'}]

4.3

GenericTokenParser

的解析逻辑


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> String <span class="code-snippet__title">parse</span><span class="code-snippet__params">(String text)</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (text == <span class="code-snippet__literal">null</span> || text.isEmpty()) <span class="code-snippet__keyword">return</span> <span class="code-snippet__string">""</span>;</span></code><code><span leaf="">    <span class="code-snippet__type">int</span> <span class="code-snippet__variable">start</span> <span class="code-snippet__operator">=</span> text.indexOf(openToken);</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (start == -<span class="code-snippet__number">1</span>) <span class="code-snippet__keyword">return</span> text;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__type">char</span>[] src = text.toCharArray();</span></code><code><span leaf="">    <span class="code-snippet__type">int</span> <span class="code-snippet__variable">offset</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__number">0</span>;</span></code><code><span leaf="">    <span class="code-snippet__type">StringBuilder</span> <span class="code-snippet__variable">builder</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">StringBuilder</span>();</span></code><code><span leaf="">    <span class="code-snippet__type">StringBuilder</span> <span class="code-snippet__variable">expression</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__literal">null</span>;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">do</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 1. 检查开放标记前是否有转义符 '\'</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">if</span> (start > <span class="code-snippet__number">0</span> && src[start - <span class="code-snippet__number">1</span>] == <span class="code-snippet__string">'\\'</span>) {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 遇到转义：去掉反斜杠，原样输出 openToken，继续</span></span></code><code><span leaf="">            builder.append(src, offset, start - offset - <span class="code-snippet__number">1</span>).append(openToken);</span></code><code><span leaf="">            offset = start + openToken.length();</span></code><code><span leaf="">        } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 2. 找到有效开放标记</span></span></code><code><span leaf="">            builder.append(src, offset, start - offset);</span></code><code><span leaf="">            offset = start + openToken.length();</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">            <span class="code-snippet__comment">// 3. 寻找闭合标记，处理转义</span></span></code><code><span leaf="">            <span class="code-snippet__type">int</span> <span class="code-snippet__variable">end</span> <span class="code-snippet__operator">=</span> text.indexOf(closeToken, offset);</span></code><code><span leaf="">            <span class="code-snippet__keyword">while</span> (end > -<span class="code-snippet__number">1</span>) {</span></code><code><span leaf="">                <span class="code-snippet__keyword">if</span> (src[end - <span class="code-snippet__number">1</span>] != <span class="code-snippet__string">'\\'</span>) {</span></code><code><span leaf="">                    <span class="code-snippet__comment">// 未转义的闭合标记</span></span></code><code><span leaf="">                    expression.append(src, offset, end - offset);</span></code><code><span leaf="">                    <span class="code-snippet__keyword">break</span>;</span></code><code><span leaf="">                }</span></code><code><span leaf="">                <span class="code-snippet__comment">// 转义的闭合标记：去掉反斜杠，保留 closeToken，继续查找</span></span></code><code><span leaf="">                expression.append(src, offset, end - offset - <span class="code-snippet__number">1</span>).append(closeToken);</span></code><code><span leaf="">                offset = end + closeToken.length();</span></code><code><span leaf="">                end = text.indexOf(closeToken, offset);</span></code><code><span leaf="">            }</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">            <span class="code-snippet__keyword">if</span> (end == -<span class="code-snippet__number">1</span>) {</span></code><code><span leaf="">                <span class="code-snippet__comment">// 闭合标记未找到：将剩余部分原样输出</span></span></code><code><span leaf="">                builder.append(src, start, src.length - start);</span></code><code><span leaf="">                offset = src.length;</span></code><code><span leaf="">            } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">                <span class="code-snippet__comment">// 4. 调用 handler 处理内容，并替换为处理结果</span></span></code><code><span leaf="">                builder.append(handler.handleToken(expression.toString()));</span></code><code><span leaf="">                offset = end + closeToken.length();</span></code><code><span leaf="">            }</span></code><code><span leaf="">        }</span></code><code><span leaf="">        start = text.indexOf(openToken, offset);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">while</span> (start > -<span class="code-snippet__number">1</span>);</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (offset < src.length) {</span></code><code><span leaf="">        builder.append(src, offset, src.length - offset);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> builder.toString();</span></code><code><span leaf="">}</span></code>
```


关键点

：

转义支持

：

\#{...}

会被解析为文本

#{...}

，而非占位符。这允许在 SQL 中输出

#{}

字面量。

性能优化

：使用

char[]

和手动偏移，避免重复创建子串。

鲁棒性

：处理闭合标记缺失、嵌套转义等情况。


```
<code><span leaf=""><span class="code-snippet__comment">// 示例：输入 SQL 中包含转义占位符</span></span></code><code><span leaf=""><span class="code-snippet__title">String</span> sql = <span class="code-snippet__string">"SELECT * FROM user WHERE name = '\\#{value}' AND id = #{id}"</span>;</span></code><code><span leaf=""><span class="code-snippet__comment">// 解析结果：</span></span></code><code><span leaf=""><span class="code-snippet__comment">// SELECT * FROM user WHERE name = '#{value}' AND id = ?</span></span></code><code><span leaf=""><span class="code-snippet__comment">// 注：\\#{value} 转义后变为 #{value} 字面文本，不会被处理</span></span></code>
```


五、

${}

的底层解析：

VariableTokenHandler

与 

#{}

 使用专门的 

ParameterMappingTokenHandler

 不同，

${}

 的处理发生在 

动态 SQL 解析阶段

，由对应的 TokenHandler 实现进行直接字符串替换，不产生 ?，也不收集 ParameterMapping。

5.1

GenericTokenParser

配合

VariableTokenHandler

在 

DynamicSqlSource

 解析动态 SQL 时，会使用 

TextSqlNode

 处理文本节点，其中就包含 

${}

 的解析：


```
<code><span leaf=""><span class="code-snippet__comment">// TextSqlNode</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__built_in">boolean</span> <span class="code-snippet__title">apply</span>(<span class="code-snippet__params"><span class="code-snippet__title">DynamicContext</span></span><span class="code-snippet__params"> context</span>) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 创建 GenericTokenParser，使用 ${} 标记  稍微合并了一下</span></span></code><code><span leaf="">    <span class="code-snippet__title">GenericTokenParser</span> parser = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">GenericTokenParser</span>(<span class="code-snippet__string">"${"</span>, <span class="code-snippet__string">"}"</span>, <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">BindingTokenParser</span>(context, injectionFilter));</span></code><code><span leaf="">    context.<span class="code-snippet__title">appendSql</span>(parser.<span class="code-snippet__title">parse</span>(text));</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> <span class="code-snippet__literal">true</span>;</span></code><code><span leaf="">}</span></code>
```


BindingTokenParser.handleToken

的实现：


```
<code><span leaf=""><span class="code-snippet__comment">// BindingTokenParser</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">String</span> <span class="code-snippet__title">handleToken</span>(<span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> content</span>) {</span></code><code><span leaf="">    <span class="code-snippet__title">Object</span> parameter = context.<span class="code-snippet__title">getBindings</span>().<span class="code-snippet__title">get</span>(<span class="code-snippet__string">"_parameter"</span>);</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (parameter == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">        context.<span class="code-snippet__title">getBindings</span>().<span class="code-snippet__title">put</span>(<span class="code-snippet__string">"value"</span>, <span class="code-snippet__literal">null</span>);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">else</span> <span class="code-snippet__keyword">if</span> (<span class="code-snippet__title">SimpleTypeRegistry</span>.<span class="code-snippet__title">isSimpleType</span>(parameter.<span class="code-snippet__title">getClass</span>())) {</span></code><code><span leaf="">        context.<span class="code-snippet__title">getBindings</span>().<span class="code-snippet__title">put</span>(<span class="code-snippet__string">"value"</span>, parameter);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__comment">// 使用 OGNL 或反射从参数对象中获取 property 的值</span></span></code><code><span leaf="">    <span class="code-snippet__title">Object</span> value = <span class="code-snippet__title">OgnlCache</span>.<span class="code-snippet__title">getValue</span>(content, context.<span class="code-snippet__title">getBindings</span>());</span></code><code><span leaf="">    <span class="code-snippet__comment">// 直接返回 value 的字符串形式（null 会转为空字符串）</span></span></code><code><span leaf="">    <span class="code-snippet__title">String</span> srtValue = value == <span class="code-snippet__literal">null</span> ? <span class="code-snippet__string">""</span> : <span class="code-snippet__title">String</span>.<span class="code-snippet__title">valueOf</span>(value);</span></code><code><span leaf="">    <span class="code-snippet__title">checkInjection</span>(srtValue);</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> srtValue;</span></code><code><span leaf="">}</span></code>
```


关键差异

：

${}

：直接获取参数值，转成字符串拼接到 SQL 中，

不产生

?

，也不收集

ParameterMapping

#{}

：替换为 

?

，收集参数映射，后续通过 

PreparedStatement

 设置参数

在 MyBatis 解析 SQL 时，

SqlSourceBuilder.parse

 会将 

#{}

 占位符替换为 

?

，同时通过 

ParameterMappingTokenHandler

 收集每个 

#{}

 的参数属性（如参数名、Java 类型、JDBC 类型等），生成 

ParameterMapping

 列表并存入 

BoundSql

。

需要强调的是，这个阶段 

MyBatis 不会在 SQL 字符串里给参数值加任何引号

，只是单纯地替换成 

?

。

到了执行阶段，

PreparedStatementHandler或

DefaultParameterHandler

会依据 

ParameterMapping

 的顺序，通过 

PreparedStatement

 的 

setXxx

 方法为每个 

?

 设置具体的参数值。此时，

JDBC 驱动会根据参数的 

java.sql.Types

 类型来决定如何格式化值

（例如对字符串类型自动加上单引号并进行转义）。

所以，“自动加引号”实际上是 

JDBC 预编译机制 + 驱动实现

 带来的结果，而不是 MyBatis 在 SQL 文本拼接阶段的行为。这也正是 

#{}

 能够安全传递参数、避免 SQL 注入的根本原因。

六、

PreparedStatement

预编译和参数设置

经过

SqlSourceBuilder

处理后，SQL 已经变成带

?

的形式。接下来到

PreparedStatementHandler

中执行。

6.1 预编译：

StatementHandler.prepare


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">abstract</span> <span class="code-snippet__keyword">class</span> <span class="code-snippet__title">BaseStatementHandler</span> <span class="code-snippet__keyword">implements</span> <span class="code-snippet__title">StatementHandler</span> {</span></code><code><span leaf="">    <span class="code-snippet__meta">@Override</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">public</span> Statement <span class="code-snippet__title">prepare</span><span class="code-snippet__params">(Connection connection, Integer transactionTimeout)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">        ErrorContext.instance().sql(boundSql.getSql()); <span class="code-snippet__comment">// 记录即将执行的SQL</span></span></code><code><span leaf="">        <span class="code-snippet__type">Statement</span> <span class="code-snippet__variable">statement</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">        <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">            <span class="code-snippet__comment">// 1. 关键步骤：调用子类实现的instantiateStatement()来创建具体的Statement对象</span></span></code><code><span leaf="">            statement = instantiateStatement(connection);</span></code><code><span leaf="">            setStatementTimeout(statement, transactionTimeout);</span></code><code><span leaf="">            setFetchSize(statement);</span></code><code><span leaf="">            <span class="code-snippet__keyword">return</span> statement;</span></code><code><span leaf="">        } <span class="code-snippet__keyword">catch</span> (SQLException e) {</span></code><code><span leaf="">            closeStatement(statement);</span></code><code><span leaf="">            <span class="code-snippet__keyword">throw</span> e;</span></code><code><span leaf="">        } <span class="code-snippet__keyword">catch</span> (Exception e) {</span></code><code><span leaf="">            closeStatement(statement);</span></code><code><span leaf="">            <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">ExecutorException</span>(<span class="code-snippet__string">"Error preparing statement.  Cause: "</span> + e, e);</span></code><code><span leaf="">        }</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__comment">// 抽象方法，留给子类去实现，用于创建具体的Statement</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">protected</span> <span class="code-snippet__keyword">abstract</span> Statement <span class="code-snippet__title">instantiateStatement</span><span class="code-snippet__params">(Connection connection)</span> <span class="code-snippet__keyword">throws</span> SQLException;</span></code><code><span leaf="">}</span></code>
```


这里获得的

PreparedStatement

已经完成了 SQL 预编译，数据库会保存该 SQL 的执行计划。

6.2 参数设置：

ParameterHandler.setParameters


```
<code><span leaf=""><span class="code-snippet__comment">// DefaultParameterHandler</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">void</span> <span class="code-snippet__title">setParameters</span><span class="code-snippet__params">(PreparedStatement ps)</span> {</span></code><code><span leaf="">    List<ParameterMapping> parameterMappings = boundSql.getParameterMappings();</span></code><code><span leaf="">    <span class="code-snippet__keyword">for</span> (<span class="code-snippet__type">int</span> <span class="code-snippet__variable">i</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__number">0</span>; i < parameterMappings.size(); i++) {</span></code><code><span leaf="">        <span class="code-snippet__type">ParameterMapping</span> <span class="code-snippet__variable">mapping</span> <span class="code-snippet__operator">=</span> parameterMappings.get(i);</span></code><code><span leaf="">        <span class="code-snippet__type">String</span> <span class="code-snippet__variable">propertyName</span> <span class="code-snippet__operator">=</span> mapping.getProperty();</span></code><code><span leaf="">        <span class="code-snippet__type">Object</span> <span class="code-snippet__variable">value</span> <span class="code-snippet__operator">=</span> 从参数对象中获取 propertyName 的值;</span></code><code><span leaf="">        <span class="code-snippet__comment">// 根据 jdbcType 和 typeHandler 设置参数</span></span></code><code><span leaf="">        typeHandler.setParameter(ps, i + <span class="code-snippet__number">1</span>, value, jdbcType);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
```


#{}

 产生的 

ParameterMapping

 告诉 MyBatis：第 i+1 个 

?

 应该填入什么值，使用什么类型处理器。

七、

#{}

 与 

${}

 完整对比

维度

#{}

${}

处理时机

SQL 解析阶段（

SqlSourceBuilder

）

动态 SQL 解析阶段（

TextSqlNode

）

处理方式

替换为 

?

，收集 

ParameterMapping

直接拼接参数值的字符串表示

预编译

是（

PreparedStatement

）

否（普通 

Statement

，或拼接后再预编译）

SQL 注入风险

无

（参数值与 SQL 结构分离）

有

（参数值改变 SQL 结构）

适用场景

几乎所有参数传递

表名、列名、ORDER BY 字段等无法使用占位符的地方

缓存影响

相同的 SQL 模板可缓存（参数不同不影响）

SQL 字符串直接变化，不易命中缓存

SQL 注入示例

：


```
<code><span leaf=""><span class="code-snippet__literal">--</span> 使用 <span class="code-snippet__variable">$</span>{}</span></code><code><span leaf=""><span class="code-snippet__built_in">SELECT</span> * FROM user <span class="code-snippet__built_in">WHERE</span> name = <span class="code-snippet__string">'${name}'</span></span></code><code><span leaf=""><span class="code-snippet__literal">--</span> 如果 name 传入 <span class="code-snippet__string">' OR '</span><span class="code-snippet__number">1</span><span class="code-snippet__string">'='</span><span class="code-snippet__number">1</span>，SQL 变为：</span></code><code><span leaf=""><span class="code-snippet__built_in">SELECT</span> * FROM user <span class="code-snippet__built_in">WHERE</span> name = <span class="code-snippet__string">''</span> OR <span class="code-snippet__string">'1'</span>=<span class="code-snippet__string">'1'</span>   <span class="code-snippet__literal">--</span> 永远为真，返回所有用户</span></code><code><span leaf=""><span class="code-snippet__literal">--</span> 使用 <span class="code-snippet__comment">#{}</span></span></code><code><span leaf=""><span class="code-snippet__built_in">SELECT</span> * FROM user <span class="code-snippet__built_in">WHERE</span> name = <span class="code-snippet__comment">#{name}</span></span></code><code><span leaf=""><span class="code-snippet__literal">--</span> 传入同样的值，预编译后：</span></code><code><span leaf=""><span class="code-snippet__built_in">SELECT</span> * FROM user <span class="code-snippet__built_in">WHERE</span> name = ?</span></code><code><span leaf=""><span class="code-snippet__literal">--</span> 参数值被当作字符串字面量，<span class="code-snippet__string">' OR '</span><span class="code-snippet__number">1</span><span class="code-snippet__string">'='</span><span class="code-snippet__number">1</span> 不会改变 SQL 结构</span></code>
```


八、源码级风险验证：

${}

的危险性

在 MyBatis 源码中，如果错误使用 

${}

，会导致 SQL 注入。例如在 Mapper XML 中：


```
<code><span leaf=""><span class="code-snippet__operator"><</span><span class="code-snippet__keyword">select</span> id<span class="code-snippet__operator">=</span>"findUser" resultType<span class="code-snippet__operator">=</span>"User"<span class="code-snippet__operator">></span></span></code><code><span leaf="">    <span class="code-snippet__keyword">SELECT</span> <span class="code-snippet__operator">*</span> <span class="code-snippet__keyword">FROM</span> <span class="code-snippet__keyword">user</span> <span class="code-snippet__keyword">WHERE</span> name <span class="code-snippet__operator">=</span> <span class="code-snippet__string">'${name}'</span></span></code><code><span leaf=""><span class="code-snippet__operator"></</span><span class="code-snippet__keyword">select</span><span class="code-snippet__operator">></span></span></code>
```


当

name = "xxx' OR '1'='1"

时，最终生成的 SQL 为：


```
<code><span leaf=""><span class="code-snippet__keyword">SELECT</span> <span class="code-snippet__operator">*</span> <span class="code-snippet__keyword">FROM</span> <span class="code-snippet__keyword">user</span> <span class="code-snippet__keyword">WHERE</span> name <span class="code-snippet__operator">=</span> <span class="code-snippet__string">'xxx'</span> <span class="code-snippet__keyword">OR</span> <span class="code-snippet__string">'1'</span><span class="code-snippet__operator">=</span><span class="code-snippet__string">'1'</span></span></code>
```


这是因为 

${}

 处理时，只是简单调用 

String.valueOf(value)

，不做任何转义，直接拼接到 SQL 字符串中。

九、面试高频题

Q1：

#{}

是如何防止 SQL 注入的？

A

：

#{}

在解析阶段被替换成

?

，后续使用

PreparedStatement

设置参数。

PreparedStatement

会将参数值进行

转义

或

类型安全处理

，确保参数值不会改变 SQL 结构。例如字符串参数中的单引号会被自动转义，从而避免了 SQL 注入。

Q2：

${}

在什么场景下必须使用？

A

：当需要动态传入

数据库对象名

（如表名、列名、排序字段）时，不能使用

#{}

，因为

?

占位符只能用于值，不能用于标识符。例如：

SELECT * FROM ${tableName}

ORDER BY ${columnName} ${orderType}

Q3：MyBatis 如何处理动态 SQL 中的

${}

嵌套

#{}

？

A

：解析顺序是先处理

${}

（在

DynamicSqlSource

阶段），再处理

#{}

（在

SqlSourceBuilder

阶段）。所以

${}

中可以包含

#{}

？这通常不推荐，因为

${}

替换后可能破坏

#{}

的结构，造成解析错误。

Q4：

BoundSql

中的

parameterMappings

是如何生成的？

A

：由

ParameterMappingTokenHandler

在解析

#{}

时依次收集。每一个

#{}

产生一个

ParameterMapping

，记录属性名、javaType、jdbcType、typeHandler 等信息，用于后续设置参数。

Q5：使用

#{}

时，参数值为 null 会怎么办？

A

：MyBatis 会使用

jdbcType

决定如何处理。如果配置了

jdbcType

（如

#{name, jdbcType=VARCHAR}

），则按指定类型设置 null；如果没有指定，某些数据库驱动可能报错（如 Oracle 需要明确

jdbcType

）。一般建议设置全局配置

jdbcTypeForNull=NULL

。

十、下篇预告

第 7 篇我们将深入

一级缓存

，彻底拆解：

一级缓存的存储结构（

PerpetualCache

+

HashMap

）

缓存 Key 的生成规则（

CacheKey

的组成）

一级缓存何时命中、何时失效

为什么一级缓存是 SqlSession 级别

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
