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
<code><span leaf=""><span class="code-snippet__comment">// 1. 加载配置文件</span></span></code><code><span leaf=""><span class="code-snippet__type">InputStream</span> <span class="code-snippet__variable">in</span> <span class="code-snippet__operator">=</span> Resources.getResourceAsStream(<span class="code-snippet__string">"mybatis-config.xml"</span>);</span></code><code><span leaf=""><span class="code-snippet__comment">// 2. 构建 SqlSessionFactory</span></span></code><code><span leaf=""><span class="code-snippet__type">SqlSessionFactory</span> <span class="code-snippet__variable">factory</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">SqlSessionFactoryBuilder</span>().build(in);</span></code><code><span leaf=""><span class="code-snippet__comment">// 3. 打开 SqlSession</span></span></code><code><span leaf=""><span class="code-snippet__type">SqlSession</span> <span class="code-snippet__variable">session</span> <span class="code-snippet__operator">=</span> factory.openSession();</span></code><code><span leaf=""><span class="code-snippet__comment">// 4. 获取 Mapper 接口的代理对象</span></span></code><code><span leaf=""><span class="code-snippet__type">UserMapper</span> <span class="code-snippet__variable">mapper</span> <span class="code-snippet__operator">=</span> session.getMapper(UserMapper.class);</span></code><code><span leaf=""><span class="code-snippet__comment">// 5. 执行查询</span></span></code><code><span leaf=""><span class="code-snippet__type">User</span> <span class="code-snippet__variable">user</span> <span class="code-snippet__operator">=</span> mapper.selectById(<span class="code-snippet__number">1</span>);</span></code><code><span leaf=""><span class="code-snippet__comment">// 6. 关闭会话</span></span></code><code><span leaf="">session.close();</span></code>
```


mapper.java


```
<code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__keyword">interface</span> <span class="code-snippet__title">UserMapper</span> {</span></code><code><span leaf="">    <span class="code-snippet__meta">@Select("SELECT * FROM user WHERE id = #{id}")</span></span></code><code><span leaf="">    User <span class="code-snippet__title">selectById</span><span class="code-snippet__params">(</span><span class="code-snippet__params"><span class="code-snippet__meta">@Param("id")</span></span><span class="code-snippet__params"> </span><span class="code-snippet__params"><span class="code-snippet__type">int</span></span><span class="code-snippet__params"> i)</span>;</span></code><code><span leaf="">    <span class="code-snippet__comment">// User 包含 id  userName password email</span></span></code><code><span leaf="">    <span class="code-snippet__meta">@Update("UPDATE user SET user_name = #{userName}, password = #{password}, email = #{email} WHERE id = #{id}")</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">void</span> <span class="code-snippet__title">update</span><span class="code-snippet__params">(User user)</span>;</span></code><code><span leaf=""><br  /></span></code><code><span leaf="">    <span class="code-snippet__meta">@Select("SELECT * FROM user")</span></span></code><code><span leaf="">    List<User> <span class="code-snippet__title">selectAll</span><span class="code-snippet__params">()</span>;</span></code><code><span leaf="">}</span></code>
```


mybatis-config.xml


```
<code><span leaf=""><span class="code-snippet__meta"><?xml version=</span><span class="code-snippet__meta"><span class="code-snippet__string">"1.0"</span></span><span class="code-snippet__meta"> encoding=</span><span class="code-snippet__meta"><span class="code-snippet__string">"UTF-8"</span></span><span class="code-snippet__meta"> ?></span></span></code><code><span leaf=""><span class="code-snippet__meta"><!DOCTYPE </span><span class="code-snippet__meta"><span class="code-snippet__keyword">configuration</span></span></span></code><code><span leaf="">        <span class="code-snippet__keyword">PUBLIC</span> <span class="code-snippet__string">"-//mybatis.org//DTD Config 3.0//EN"</span></span></code><code><span leaf="">        <span class="code-snippet__string">"https://mybatis.org/dtd/mybatis-3-config.dtd"</span>></span></code><code><span leaf=""><span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">configuration</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">    <span class="code-snippet__comment"><!-- 1. 外部化配置 --></span></span></code><code><span leaf="">    <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">properties</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">resource</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"jdbc.properties"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf="">    <span class="code-snippet__comment"><!-- 2. 全局行为设置 --></span></span></code><code><span leaf="">    <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">settings</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">        <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">setting</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">name</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"mapUnderscoreToCamelCase"</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">value</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"true"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf="">        <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">setting</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">name</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"logImpl"</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">value</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"STDOUT_LOGGING"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf="">        <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">setting</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">name</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"lazyLoadingEnabled"</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">value</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"true"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf="">    <span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">settings</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">    <span class="code-snippet__comment"><!-- 3. 别名 --></span></span></code><code><span leaf="">    <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">typeAliases</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">        <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">package</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">name</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"com.example.entity"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf="">    <span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">typeAliases</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">    <span class="code-snippet__comment"><!-- 4. 数据库环境 --></span></span></code><code><span leaf="">    <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">environments</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">default</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"development"</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">        <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">environment</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">id</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"development"</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">            <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">transactionManager</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">type</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"JDBC"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf="">            <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">dataSource</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">type</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"POOLED"</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">                <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">property</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">name</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"driver"</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">value</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"${jdbc.driver}"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf="">                <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">property</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">name</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"url"</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">value</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"${jdbc.url}"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf="">                <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">property</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">name</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"username"</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">value</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"${jdbc.username}"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf="">                <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">property</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">name</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"password"</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">value</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"${jdbc.password}"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf="">            <span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">dataSource</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">        <span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">environment</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">    <span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">environments</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">    <span class="code-snippet__comment"><!-- 5. Mapper 注册 --></span></span></code><code><span leaf="">    <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">mappers</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">        <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">package</span></span><span class="code-snippet__tag"> </span><span class="code-snippet__tag"><span class="code-snippet__attr">name</span></span><span class="code-snippet__tag">=</span><span class="code-snippet__tag"><span class="code-snippet__string">"com.example.mapper"</span></span><span class="code-snippet__tag">/></span></span></code><code><span leaf="">    <span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">mappers</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf=""><span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">configuration</span></span><span class="code-snippet__tag">></span></span></code>
```


jdbc.properties


```
<code><span leaf=""><span class="code-snippet__comment"># MySQL 8.x 驱动配置</span></span></code><code><span leaf=""><span class="code-snippet__attr">jdbc.driver</span>=com.mysql.cj.jdbc.Driver</span></code><code><span leaf=""><span class="code-snippet__attr">jdbc.url</span>=jdbc:mysql://localhost:<span class="code-snippet__number">3306</span>/test?useSSL=<span class="code-snippet__literal">false</span>&serverTimezone=Asia/Shanghai&characterEncoding=utf8</span></code><code><span leaf=""><span class="code-snippet__attr">jdbc.username</span>=root</span></code><code><span leaf=""><span class="code-snippet__attr">jdbc.password</span>=<span class="code-snippet__number">123456</span></span></code>
```


部分pom.xml


```
<code><span leaf=""> <span class="code-snippet__comment"><!-- MyBatis 核心依赖 --></span></span></code><code><span leaf="">        <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">dependency</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">            <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">groupId</span></span><span class="code-snippet__tag">></span>org.mybatis<span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">groupId</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">            <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">artifactId</span></span><span class="code-snippet__tag">></span>mybatis<span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">artifactId</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">            <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">version</span></span><span class="code-snippet__tag">></span>3.5.16<span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">version</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">        <span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">dependency</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">        <span class="code-snippet__comment"><!-- MySQL 驱动依赖 --></span></span></code><code><span leaf="">        <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">dependency</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">            <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">groupId</span></span><span class="code-snippet__tag">></span>mysql<span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">groupId</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">            <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">artifactId</span></span><span class="code-snippet__tag">></span>mysql-connector-java<span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">artifactId</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">            <span class="code-snippet__tag"><</span><span class="code-snippet__tag"><span class="code-snippet__name">version</span></span><span class="code-snippet__tag">></span>8.0.33<span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">version</span></span><span class="code-snippet__tag">></span></span></code><code><span leaf="">        <span class="code-snippet__tag"></</span><span class="code-snippet__tag"><span class="code-snippet__name">dependency</span></span><span class="code-snippet__tag">></span></span></code>
```


3.1 阶段一：配置文件加载 → Configuration

入口：

SqlSessionFactoryBuilder.build(inputStream)


```
<code><span leaf=""><span class="code-snippet__comment">// SqlSessionFactoryBuilder 部分源码</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">SqlSessionFactory</span> <span class="code-snippet__title">build</span>(<span class="code-snippet__params"><span class="code-snippet__title">InputStream</span></span><span class="code-snippet__params"> inputStream</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">build</span>(inputStream, <span class="code-snippet__literal">null</span>, <span class="code-snippet__literal">null</span>);</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__comment">//把有些内容简化了下哈  如果感观不好，可以去看看源码哈</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <span class="code-snippet__title">SqlSessionFactory</span> <span class="code-snippet__title">build</span>(<span class="code-snippet__params"><span class="code-snippet__title">InputStream</span></span><span class="code-snippet__params"> inputStream, </span><span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> environment, </span><span class="code-snippet__params"><span class="code-snippet__title">Properties</span></span><span class="code-snippet__params"> properties</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 1. 创建 XMLConfigBuilder，专门解析 mybatis-config.xml</span></span></code><code><span leaf="">        <span class="code-snippet__title">XMLConfigBuilder</span> parser = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">XMLConfigBuilder</span>(inputStream, environment, properties);</span></code><code><span leaf="">        <span class="code-snippet__comment">// 2. 解析配置文件，返回 Configuration 对象</span></span></code><code><span leaf="">        <span class="code-snippet__title">Configuration</span> config = parser.<span class="code-snippet__title">parse</span>();</span></code><code><span leaf="">        <span class="code-snippet__comment">// 3. 构建 DefaultSqlSessionFactory</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">build</span>(config);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">Exception</span> e) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__title">ExceptionFactory</span>.<span class="code-snippet__title">wrapException</span>(<span class="code-snippet__string">"Error building SqlSession."</span>, e);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
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
<code><span leaf=""><span class="code-snippet__comment">// DefaultSqlSessionFactory 部分源码  没有百分百还原哈</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> SqlSession <span class="code-snippet__title">openSession</span><span class="code-snippet__params">()</span> {</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> openSessionFromDataSource(configuration.getDefaultExecutorType(), <span class="code-snippet__literal">null</span>, <span class="code-snippet__literal">false</span>);</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__keyword">private</span> SqlSession <span class="code-snippet__title">openSessionFromDataSource</span><span class="code-snippet__params">(ExecutorType execType, TransactionIsolationLevel level, </span><span class="code-snippet__params"><span class="code-snippet__type">boolean</span></span><span class="code-snippet__params"> autoCommit)</span> {</span></code><code><span leaf="">    <span class="code-snippet__type">Transaction</span> <span class="code-snippet__variable">tx</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 1. 从 Configuration 中获取 Environment</span></span></code><code><span leaf="">        <span class="code-snippet__type">Environment</span> <span class="code-snippet__variable">environment</span> <span class="code-snippet__operator">=</span> configuration.getEnvironment();</span></code><code><span leaf="">        <span class="code-snippet__comment">// 2. 创建 TransactionFactory 和 Transaction</span></span></code><code><span leaf="">        <span class="code-snippet__type">TransactionFactory</span> <span class="code-snippet__variable">transactionFactory</span> <span class="code-snippet__operator">=</span> getTransactionFactoryFromEnvironment(environment);</span></code><code><span leaf="">        tx = transactionFactory.newTransaction(environment.getDataSource(), level, autoCommit);</span></code><code><span leaf="">        <span class="code-snippet__comment">// 3. 创建 Executor</span></span></code><code><span leaf="">        <span class="code-snippet__type">Executor</span> <span class="code-snippet__variable">executor</span> <span class="code-snippet__operator">=</span> configuration.newExecutor(tx, execType);</span></code><code><span leaf="">        <span class="code-snippet__comment">// 4. 包装成 DefaultSqlSession</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">DefaultSqlSession</span>(configuration, executor, autoCommit);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (Exception e) {</span></code><code><span leaf="">        closeTransaction(tx);</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> ExceptionFactory.wrapException(<span class="code-snippet__string">"Error opening session.  Cause: "</span> + e, e);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code>
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
<code><span leaf=""><span class="code-snippet__comment">// DefaultSqlSession 部分源码</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <T> T <span class="code-snippet__title">getMapper</span>(<span class="code-snippet__params"><span class="code-snippet__title">Class</span></span><span class="code-snippet__params"><T> </span><span class="code-snippet__params"><span class="code-snippet__keyword">type</span></span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> configuration.<span class="code-snippet__title">getMapper</span>(<span class="code-snippet__keyword">type</span>, <span class="code-snippet__variable">this</span>);</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__comment">// Configuration 部分源码</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <T> T <span class="code-snippet__title">getMapper</span>(<span class="code-snippet__params"><span class="code-snippet__title">Class</span></span><span class="code-snippet__params"><T> </span><span class="code-snippet__params"><span class="code-snippet__keyword">type</span></span><span class="code-snippet__params">, </span><span class="code-snippet__params"><span class="code-snippet__title">SqlSession</span></span><span class="code-snippet__params"> sqlSession</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> mapperRegistry.<span class="code-snippet__title">getMapper</span>(<span class="code-snippet__keyword">type</span>, sqlSession);</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__comment">// MapperRegistry 部分源码</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <T> T <span class="code-snippet__title">getMapper</span>(<span class="code-snippet__params"><span class="code-snippet__title">Class</span></span><span class="code-snippet__params"><T> </span><span class="code-snippet__params"><span class="code-snippet__keyword">type</span></span><span class="code-snippet__params">, </span><span class="code-snippet__params"><span class="code-snippet__title">SqlSession</span></span><span class="code-snippet__params"> sqlSession</span>) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 从 knownMappers 中获取 MapperProxyFactory</span></span></code><code><span leaf="">    final <span class="code-snippet__title">MapperProxyFactory</span><T> mapperProxyFactory = (<span class="code-snippet__title">MapperProxyFactory</span><T>) knownMappers.<span class="code-snippet__title">get</span>(<span class="code-snippet__keyword">type</span>);</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (mapperProxyFactory == <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">BindingException</span>(<span class="code-snippet__string">"Type "</span> + <span class="code-snippet__keyword">type</span> + <span class="code-snippet__string">" is not known to the MapperRegistry."</span>);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 通过工厂创建动态代理</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> mapperProxyFactory.<span class="code-snippet__title">newInstance</span>(sqlSession);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">Exception</span> e) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">throw</span> <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">BindingException</span>(<span class="code-snippet__string">"Error getting mapper instance. Cause: "</span> + e, e);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__comment">// MapperProxyFactory 部分源码</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> T <span class="code-snippet__title">newInstance</span>(<span class="code-snippet__params"><span class="code-snippet__title">SqlSession</span></span><span class="code-snippet__params"> sqlSession</span>) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// MapperProxy 实现了 InvocationHandler </span></span></code><code><span leaf="">    final <span class="code-snippet__title">MapperProxy</span><T> mapperProxy = <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">MapperProxy</span><>(sqlSession, mapperInterface, methodCache);</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">newInstance</span>(mapperProxy);</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__keyword">protected</span> T <span class="code-snippet__title">newInstance</span>(<span class="code-snippet__params"><span class="code-snippet__title">MapperProxy</span></span><span class="code-snippet__params"><T> mapperProxy</span>) {</span></code><code><span leaf="">    <span class="code-snippet__comment">// JDK 动态代理</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> (T) <span class="code-snippet__title">Proxy</span>.<span class="code-snippet__title">newProxyInstance</span>(mapperInterface.<span class="code-snippet__title">getClassLoader</span>(), <span class="code-snippet__keyword">new</span> <span class="code-snippet__title">Class</span>[] { mapperInterface }, mapperProxy);</span></code><code><span leaf="">}</span></code>
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
<code><span leaf="">// MapperProxy.invoke 核心逻辑（简化版）</span></code><code><span leaf=""><span class="code-snippet__variable">@Override</span></span></code><code><span leaf="">public Object invoke(Object proxy, Method <span class="code-snippet__function"><span class="code-snippet__keyword">method</span></span><span class="code-snippet__function">, </span><span class="code-snippet__function"><span class="code-snippet__title">Object</span></span><span class="code-snippet__function">[] </span><span class="code-snippet__function"><span class="code-snippet__title">args</span></span><span class="code-snippet__function">) </span><span class="code-snippet__function"><span class="code-snippet__title">throws</span></span><span class="code-snippet__function"> </span><span class="code-snippet__function"><span class="code-snippet__title">Throwable</span></span><span class="code-snippet__function"> </span>{</span></code><code><span leaf="">    // 如果是 Object 类的方法（toString等）直接执行</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (Object.class.equals(method.getDeclaringClass())) {</span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> method.invoke(this, args);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    // 核心：从缓存或新建 MapperMethod，然后执行</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> cachedInvoker(<span class="code-snippet__function"><span class="code-snippet__keyword">method</span></span><span class="code-snippet__function">).</span><span class="code-snippet__function"><span class="code-snippet__title">invoke</span></span>(proxy, <span class="code-snippet__keyword">method</span>, args, sqlSession);</span></code><code><span leaf="">}</span></code>
```


最终会调用到

SqlSession

的

selectOne

/

selectList

等：


```
<code><span leaf=""><span class="code-snippet__comment">// DefaultSqlSession 部分源码</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <E> <span class="code-snippet__title">List</span><E> <span class="code-snippet__title">selectList</span>(<span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> statement, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameter, </span><span class="code-snippet__params"><span class="code-snippet__title">RowBounds</span></span><span class="code-snippet__params"> rowBounds</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> <span class="code-snippet__title">selectList</span>(statement, parameter, rowBounds, <span class="code-snippet__title">Executor</span>.<span class="code-snippet__property">NO_RESULT_HANDLER</span>);</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__keyword">private</span> <E> <span class="code-snippet__title">List</span><E> <span class="code-snippet__title">selectList</span>(<span class="code-snippet__params"><span class="code-snippet__title">String</span></span><span class="code-snippet__params"> statement, </span><span class="code-snippet__params"><span class="code-snippet__title">Object</span></span><span class="code-snippet__params"> parameter, </span><span class="code-snippet__params"><span class="code-snippet__title">RowBounds</span></span><span class="code-snippet__params"> rowBounds, </span><span class="code-snippet__params"><span class="code-snippet__title">ResultHandler</span></span><span class="code-snippet__params"> handler</span>) {</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 1. 从 Configuration 中获取 MappedStatement</span></span></code><code><span leaf="">      <span class="code-snippet__title">MappedStatement</span> ms = configuration.<span class="code-snippet__title">getMappedStatement</span>(statement);</span></code><code><span leaf="">      dirty |= ms.<span class="code-snippet__title">isDirtySelect</span>();</span></code><code><span leaf="">        <span class="code-snippet__comment">// 2. 交给 Executor 执行</span></span></code><code><span leaf="">      <span class="code-snippet__keyword">return</span> executor.<span class="code-snippet__title">query</span>(ms, <span class="code-snippet__title">wrapCollection</span>(parameter), rowBounds, handler);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">catch</span> (<span class="code-snippet__title">Exception</span> e) {</span></code><code><span leaf="">      <span class="code-snippet__keyword">throw</span> <span class="code-snippet__title">ExceptionFactory</span>.<span class="code-snippet__title">wrapException</span>(<span class="code-snippet__string">"Error querying database.  Cause: "</span> + e, e);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">      <span class="code-snippet__title">ErrorContext</span>.<span class="code-snippet__title">instance</span>().<span class="code-snippet__title">reset</span>();</span></code><code><span leaf="">    }</span></code><code><span leaf="">  }</span></code>
```


Executor.query()

是核心：


```
<code><span leaf=""><span class="code-snippet__comment">// CachingExecutor 部分源码</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <E> List<E> <span class="code-snippet__title">query</span><span class="code-snippet__params">(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 1. 获取 BoundSql（解析 #{} 后的 SQL，带 ? 占位符）</span></span></code><code><span leaf="">    <span class="code-snippet__type">BoundSql</span> <span class="code-snippet__variable">boundSql</span> <span class="code-snippet__operator">=</span> ms.getBoundSql(parameter);</span></code><code><span leaf="">    <span class="code-snippet__comment">// 2. 生成缓存 Key</span></span></code><code><span leaf="">    <span class="code-snippet__type">CacheKey</span> <span class="code-snippet__variable">key</span> <span class="code-snippet__operator">=</span> createCacheKey(ms, parameter, rowBounds, boundSql);</span></code><code><span leaf="">    <span class="code-snippet__comment">// 3. 后续深入追踪会继续调用executo的query方法</span></span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> query(ms, parameter, rowBounds, resultHandler, key, boundSql);</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__comment">// 实际执行  BaseExecutor 部分源码</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <E> List<E> <span class="code-snippet__title">query</span><span class="code-snippet__params">(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler, CacheKey key, BoundSql boundSql)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">    <span class="code-snippet__comment">// 1. 一级缓存</span></span></code><code><span leaf="">    List<E> list = resultHandler == <span class="code-snippet__literal">null</span> ? (List<E>) localCache.getObject(key) : <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">    <span class="code-snippet__keyword">if</span> (list != <span class="code-snippet__literal">null</span>) {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 缓存命中，处理存储过程 OUT 参数</span></span></code><code><span leaf="">        handleLocallyCachedOutputParameters(ms, key, parameter, boundSql);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">else</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 未命中，从数据库查询</span></span></code><code><span leaf="">        list = queryFromDatabase(ms, parameter, rowBounds, resultHandler, key, boundSql);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> list;</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__keyword">private</span> <E> List<E> <span class="code-snippet__title">queryFromDatabase</span><span class="code-snippet__params">(MappedStatement ms, Object parameter, RowBounds rowBounds,</span></span></code><code><span leaf="">      ResultHandler resultHandler, CacheKey key, BoundSql boundSql) {</span></code><code><span leaf="">    List<E> list;</span></code><code><span leaf="">    localCache.putObject(key, EXECUTION_PLACEHOLDER);</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__comment">// 调用 doQuery 真正执行 JDBC</span></span></code><code><span leaf="">        list = doQuery(ms, parameter, rowBounds, resultHandler, boundSql);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">        localCache.removeObject(key);</span></code><code><span leaf="">    }</span></code><code><span leaf="">    localCache.putObject(key, list);</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> list;</span></code><code><span leaf="">}</span></code>
```


doQuery

最终会调用

SimpleExecutor

：


```
<code><span leaf=""><span class="code-snippet__comment">// SimpleExecutor 部分源码</span></span></code><code><span leaf=""><span class="code-snippet__meta">@Override</span></span></code><code><span leaf=""><span class="code-snippet__keyword">public</span> <E> List<E> <span class="code-snippet__title">doQuery</span><span class="code-snippet__params">(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler, BoundSql boundSql)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">    <span class="code-snippet__type">Statement</span> <span class="code-snippet__variable">stmt</span> <span class="code-snippet__operator">=</span> <span class="code-snippet__literal">null</span>;</span></code><code><span leaf="">    <span class="code-snippet__keyword">try</span> {</span></code><code><span leaf="">        <span class="code-snippet__type">Configuration</span> <span class="code-snippet__variable">configuration</span> <span class="code-snippet__operator">=</span> ms.getConfiguration();</span></code><code><span leaf="">        <span class="code-snippet__comment">// 1. 创建 StatementHandler</span></span></code><code><span leaf="">        <span class="code-snippet__type">StatementHandler</span> <span class="code-snippet__variable">handler</span> <span class="code-snippet__operator">=</span> configuration.newStatementHandler(wrapper, ms, parameter, rowBounds, resultHandler, boundSql);</span></code><code><span leaf="">        <span class="code-snippet__comment">// 2. 预编译 SQL</span></span></code><code><span leaf="">        stmt = prepareStatement(handler, ms.getStatementLog());</span></code><code><span leaf="">        <span class="code-snippet__comment">// 3. 执行并处理结果集</span></span></code><code><span leaf="">        <span class="code-snippet__keyword">return</span> handler.query(stmt, resultHandler);</span></code><code><span leaf="">    } <span class="code-snippet__keyword">finally</span> {</span></code><code><span leaf="">        closeStatement(stmt);</span></code><code><span leaf="">    }</span></code><code><span leaf="">}</span></code><code><span leaf=""><br  /></span></code><code><span leaf=""><span class="code-snippet__keyword">private</span> Statement <span class="code-snippet__title">prepareStatement</span><span class="code-snippet__params">(StatementHandler handler, Log statementLog)</span> <span class="code-snippet__keyword">throws</span> SQLException {</span></code><code><span leaf="">    Statement stmt;</span></code><code><span leaf="">    <span class="code-snippet__comment">// 获取数据库连接</span></span></code><code><span leaf="">    <span class="code-snippet__type">Connection</span> <span class="code-snippet__variable">connection</span> <span class="code-snippet__operator">=</span> getConnection(statementLog);</span></code><code><span leaf="">    <span class="code-snippet__comment">// 创建 Statement</span></span></code><code><span leaf="">    stmt = handler.prepare(connection, transaction.getTimeout());</span></code><code><span leaf="">    <span class="code-snippet__comment">// 设置参数（#{} 占位符被替换成 ? 后，这里设置实际参数值）</span></span></code><code><span leaf="">    handler.parameterize(stmt);</span></code><code><span leaf="">    <span class="code-snippet__keyword">return</span> stmt;</span></code><code><span leaf="">}</span></code>
```


StatementHandler里继续调用ParameterHandler和 ResultSetHandler

，最终用 JDBC 执行 SQL 并返回结果。

四、总结：一条 SQL 的完整旅程


```
<code><span leaf=""><span class="code-snippet__bullet">1.</span> 加载 mybatis-config.xml → 生成 Configuration（全局配置）</span></code><code><span leaf=""><span class="code-snippet__bullet">2.</span> SqlSessionFactoryBuilder.build() → 创建 DefaultSqlSessionFactory</span></code><code><span leaf=""><span class="code-snippet__bullet">3.</span> factory.openSession() → 创建 SqlSession（持有 Configuration + Executor）</span></code><code><span leaf=""><span class="code-snippet__bullet">4.</span> session.getMapper() → JDK 动态代理 → MapperProxy</span></code><code><span leaf=""><span class="code-snippet__bullet">5.</span> 调用 mapper 方法 → MapperProxy.invoke() → MapperMethod.execute()</span></code><code><span leaf=""><span class="code-snippet__bullet">6.</span> MapperMethod 调用 SqlSession.selectOne/selectList</span></code><code><span leaf=""><span class="code-snippet__bullet">7.</span> SqlSession 从 Configuration 获取 MappedStatement</span></code><code><span leaf=""><span class="code-snippet__bullet">8.</span> Executor 处理缓存（一级缓存），然后调用 doQuery</span></code><code><span leaf=""><span class="code-snippet__bullet">9.</span> StatementHandler 创建 Statement、预编译 SQL</span></code><code><span leaf=""><span class="code-snippet__bullet">10.</span> ParameterHandler 设置参数</span></code><code><span leaf=""><span class="code-snippet__bullet">11.</span> 执行 SQL (JDBC)</span></code><code><span leaf=""><span class="code-snippet__bullet">12.</span> ResultSetHandler 处理结果集 → 返回 List/对象</span></code><code><span leaf=""><span class="code-snippet__bullet">13.</span> 层层返回，最终拿到结果</span></code>
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
