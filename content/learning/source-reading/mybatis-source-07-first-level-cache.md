---
title: "MyBatis 源码深度拆解（七）：一级缓存底层彻底拆解"
date: "2026-07-18"
domain: "学习"
area: "Java 后端"
module: "MyBatis 源码拆解"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "一、回顾与开篇 前面几篇我们走通了 SQL 执行的全流程，也看到了 Executor 的重要性。今天我们把目光聚焦到 一…"
tags:
  - "MyBatis"
  - "源码分析"
---

# MyBatis 源码深度拆解（七）：一级缓存底层彻底拆解

> 来源：微信公众号（MyBatis 源码深度拆解系列）
> 链接：[http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484052&idx=1&sn=123b03bf750192aea2cfaf8562f4ece9&chksm=c2b810cbf5cf99dddf1c05973aeff277df13bdb46e8efd4b82037a1e359aae9d4f2bea2f2cc2](http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484052&idx=1&sn=123b03bf750192aea2cfaf8562f4ece9&chksm=c2b810cbf5cf99dddf1c05973aeff277df13bdb46e8efd4b82037a1e359aae9d4f2bea2f2cc2)
> 类型：📚 参考资料（非面试题/面经）—— MyBatis 源码深度拆解系列
> 相关：第235题(百万行导出)、第48题(深分页优化)
> 整理时间：2026-08-03

---

一、回顾与开篇

前面几篇我们走通了 SQL 执行的全流程，也看到了

Executor

的重要性。今天我们把目光聚焦到

一级缓存

—— 这个默认开启、无法关闭（只能调整行为）的缓存机制。

一级缓存特点

：

默认开启

，作用于

SqlSession

级别

存储结构是

HashMap

（

PerpetualCache

包装）

当执行

INSERT/UPDATE/DELETE

时会被清空

不同

SqlSession

之间的缓存相互隔离

本篇目标

：

拆解一级缓存的存储结构

PerpetualCache

深入

CacheKey

的生成规则（重中之重）

追踪缓存的命中、写入、清空的全流程

分析一级缓存失效的典型场景与原理

二、一级缓存整体架构

核心类

：

BaseExecutor

：维护

localCache

和

localOutputParameterCache

PerpetualCache

：MyBatis 对

HashMap

的简单包装，实现了

Cache

接口

CacheKey

：缓存的键，由多个要素组成，确保唯一性

三、

PerpetualCache

存储结构

PerpetualCache

 是 

BaseExecutor

 中一级缓存的实际存储类：


```
// org.apache.ibatis.cache.impl.PerpetualCache
public class PerpetualCache implements Cache {
    private final String id;
    private final Map<Object, Object> cache = new HashMap<>();

    public PerpetualCache(String id) {
        this.id = id;
    }

    @Override
    public void putObject(Object key, Object value) {
        cache.put(key, value);
    }

    @Override
    public Object getObject(Object key) {
        return cache.get(key);
    }

    @Override
    public Object removeObject(Object key) {
        return cache.remove(key);
    }

    @Override
    public void clear() {
        cache.clear();
    }
    // ... 其他方法
}
```


在

BaseExecutor

中：


```
public abstract class BaseExecutor implements Executor {
    protected PerpetualCache localCache;
    protected PerpetualCache localOutputParameterCache;

    public BaseExecutor(Configuration configuration, Transaction transaction) {
        this.localCache = new PerpetualCache("LocalCache");
        this.localOutputParameterCache = new PerpetualCache("LocalOutputParameterCache");
        // ...
    }
}
```


关键点

：

localCache

：存储普通查询的结果

localOutputParameterCache

：存储存储过程调用后的 OUT 参数（与一级缓存逻辑类似）

底层就是 

HashMap

，没有大小限制，没有过期时间，因此不适合缓存大量数据

四、

CacheKey

的生成规则

CacheKey

用于唯一标识一次查询的结果。它的生成非常严格，确保不同查询不会误命中。

4.1 创建入口

在 

BaseExecutor.createCacheKey

 中：


```
@Override
public CacheKey createCacheKey(MappedStatement ms, Object parameterObject, RowBounds rowBounds, BoundSql boundSql) {
    if (closed) {
        throw new ExecutorException("Executor was closed.");
    }
    CacheKey cacheKey = new CacheKey();
    // 1. MappedStatement 的 id（namespace + id）
    cacheKey.update(ms.getId());
    // 2. RowBounds 的 offset 和 limit
    cacheKey.update(rowBounds.getOffset());
    cacheKey.update(rowBounds.getLimit());
    // 3. SQL 字符串（已替换 #{} 为 ?）
    cacheKey.update(boundSql.getSql());
    // 4. 参数值（按顺序）
    List<ParameterMapping> parameterMappings = boundSql.getParameterMappings();
    TypeHandlerRegistry typeHandlerRegistry = ms.getConfiguration().getTypeHandlerRegistry();
    MetaObject metaObject = null;
    for (ParameterMapping parameterMapping : parameterMappings) {
        // 存储过程的 OUT 参数不参与缓存 Key 计算
        if (parameterMapping.getMode() != ParameterMode.OUT) {
            Object value;
            String propertyName = parameterMapping.getProperty();
            if (boundSql.hasAdditionalParameter(propertyName)) {
                // 优先从附加参数中获取（如 <bind> 定义的变量）
                value = boundSql.getAdditionalParameter(propertyName);
            } else if (parameterObject == null) {
                value = null;
            } else if (typeHandlerRegistry.hasTypeHandler(parameterObject.getClass())) {
                // 参数本身是简单类型，直接使用
                value = parameterObject;
            } else {
                // 通过反射获取 POJO 的属性值
                if (metaObject == null) {
                    metaObject = configuration.newMetaObject(parameterObject);
                }
                value = metaObject.getValue(propertyName);
            }
            cacheKey.update(value);
        }
    }
    if (configuration.getEnvironment() != null) {
        // 5. 环境 id（若存在多环境）
        cacheKey.update(configuration.getEnvironment().getId());
    }
    return cacheKey;
}
```


4.2

CacheKey

内部结构


```
public class CacheKey implements Cloneable, Serializable {
    private static final int DEFAULT_MULTIPLYER = 37;
    private static final int DEFAULT_HASHCODE = 17;
    private final int multiplier = DEFAULT_MULTIPLYER;
    private int hashcode = DEFAULT_HASHCODE;
    private long checksum = 0;
    private int count = 0;
    private List<Object> updateList = new ArrayList<>();

    public void update(Object object) {
        int baseHashCode = object == null ? 1 : ArrayUtil.hashCode(object);
        count++;
        checksum += baseHashCode;
        baseHashCode *= count;
        hashcode = multiplier * hashcode + baseHashCode;
        updateList.add(object);
    }

    @Override
    public boolean equals(Object object) {
        // 比较 hashcode、checksum、count 以及 updateList 中的每个元素
        // 只有当所有要素都相等时，才认为两个 CacheKey 相等
    }
}
```


总结

：

CacheKey

的相等性取决于：

ms.getId()

（接口全限定名 + 方法名）

RowBounds.offset

和

RowBounds.limit

boundSql.getSql()

（带

?

的 SQL 模板）

每一个参数的实际值

（按顺序）

环境 id（若存在）

只要上述任何一个要素不同，缓存就无法命中。

五、一级缓存的命中与写入

5.1 

BaseExecutor.query

 中的缓存逻辑


```
@Override
  public <E> List<E> query(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler,
      CacheKey key, BoundSql boundSql) throws SQLException {
    // 用于记录当前执行的 SQL 资源信息，便于调试和错误报告
    ErrorContext.instance().resource(ms.getResource()).activity("executing a query").object(ms.getId());
    if (closed) {
      throw new ExecutorException("Executor was closed.");
    }
    // 1. 如果 flushCacheRequired 为 true（如 <select flushCache="true">），清空本地缓存
    if (queryStack == 0 && ms.isFlushCacheRequired()) {
      clearLocalCache();
    }
    List<E> list;
    try {
      queryStack++;
      // 2. 尝试从一级缓存获取
      list = resultHandler == null ? (List<E>) localCache.getObject(key) : null;
      if (list != null) {
        // 缓存命中，处理存储过程的输出参数（如果存在）
        handleLocallyCachedOutputParameters(ms, key, parameter, boundSql);
      } else {
        // 3. 未命中，从数据库查询
        list = queryFromDatabase(ms, parameter, rowBounds, resultHandler, key, boundSql);
      }
    } finally {
      queryStack--;
    }
    if (queryStack == 0) {
      // 延迟加载（Lazy Load） 的核心
      for (DeferredLoad deferredLoad : deferredLoads) {
        deferredLoad.load();
      }
      // issue #601
      deferredLoads.clear();
      if (configuration.getLocalCacheScope() == LocalCacheScope.STATEMENT) {
        // issue #482
        clearLocalCache();
      }
    }
    return list;
  }
```


5.2 从数据库查询并写入缓存


```
// BaseExecutor
private <E> List<E> queryFromDatabase(MappedStatement ms, Object parameter, RowBounds rowBounds,
                                      ResultHandler resultHandler, CacheKey key, BoundSql boundSql) {
    List<E> list;
    // 先放入占位符，防止并发查询时重复查库（实际是避免递归查询死循环）
    localCache.putObject(key, EXECUTION_PLACEHOLDER);
    try {
        list = doQuery(ms, parameter, rowBounds, resultHandler, boundSql);
    } finally {
        localCache.removeObject(key);
    }
    // 将真实结果存入缓存
    localCache.putObject(key, list);
    //对这步感兴趣的小伙伴可以去研究研究O(∩_∩)O哈~  为什么要缓存参数？
    if (ms.getStatementType() == StatementType.CALLABLE) {
      localOutputParameterCache.putObject(key, parameter);
    }
    return list;
}
```


EXECUTION_PLACEHOLDER

是一个特殊对象（

static final Object

），用于标记该 key 正在被查询。作用是防止递归调用时（例如 SQL 中又调用同一个 Mapper 方法）导致死循环，如果再次遇到同一个 key 且值为占位符，MyBatis 会抛出

ExecutorException

。

5.3 命中缓存后的处理

当缓存命中时，除了直接返回结果，还需要处理存储过程的 OUT 参数：


```
// BaseExecutor
private void handleLocallyCachedOutputParameters(MappedStatement ms, CacheKey key, Object parameter, BoundSql boundSql) {
    if (ms.getStatementType() == StatementType.CALLABLE) {
        // 从 localOutputParameterCache 中取出之前缓存的 OUT 参数
        final Object cachedOutputParameter = localOutputParameterCache.getObject(key);
        // 将缓存的 OUT 参数值设置回 parameter 对象中
        // 具体实现省略...
    }
}
```


因为存储过程执行后，OUT 参数的值会改变，

localOutputParameterCache

 专门缓存这些 OUT 参数值，确保从缓存命中时也能恢复它们。

六、一级缓存的清空（失效）场景

6.1 执行 

INSERT

 / 

UPDATE

 / 

DELETE


```
// BaseExecutor
@Override
public int update(MappedStatement ms, Object parameter) {
    ErrorContext.instance().resource(ms.getResource()).activity("executing an update").object(ms.getId());
    if (closed) {
        throw new ExecutorException("Executor was closed.");
    }
    clearLocalCache();   // 任何更新操作都会清空一级缓存
    return doUpdate(ms, parameter);
}
```


原因

：为了保证缓存数据与数据库一致，只要发生了数据变更，整个

SqlSession

的一级缓存全部清空。

6.2 手动清空


```
// SqlSession 接口方法
void clearCache();
```


在

DefaultSqlSession

中：


```
@Override
public void clearCache() {
    executor.clearLocalCache();
}
```


6.3

localCacheScope

设置为

STATEMENT

在 

mybatis-config.xml

 中配置：


```
<setting name="localCacheScope" value="STATEMENT"/>
```


默认是

SESSION

（整个会话共享）。当设置为

STATEMENT

时，每次查询结束后会清空一级缓存：


```
// BaseExecutor.query 方法最后
if (configuration.getLocalCacheScope() == LocalCacheScope.STATEMENT) {
    clearLocalCache();
}
```


6.4

flushCache=true

的查询

在 

<select>

 标签中设置 

flushCache="true"

，表示执行该查询前先清空一级缓存（和二级缓存）：


```
<select id="selectUser" resultType="User" flushCache="true">
    SELECT * FROM user WHERE id = #{id}
</select>
```


这时在

BaseExecutor.query

开头就会清空缓存：


```
if (queryStack == 0 && ms.isFlushCacheRequired()) {
    clearLocalCache();
}
```


6.5 关闭

SqlSession

当调用

sqlSession.close()

时，

Executor

会关闭并释放资源，

localCache

随之被丢弃（不再可用）。

6.6 不同

SqlSession

之间不共享

一级缓存是 

SqlSession

 级别的，不同 

SqlSession

 拥有不同的 

Executor

 实例，因此各自维护独立的 

localCache

。这会导致“

缓存与数据库数据不一致

”现象：一个会话修改了数据并提交，另一个会话的一级缓存中仍然是旧数据。

6.7 

Spring 整合环境下一级缓存的行为差异

在 MyBatis 与 Spring 整合的场景中，默认情况下 Spring 通过

SqlSessionTemplate

管理 SqlSession，

每次 DAO 方法调用可能会创建新的 SqlSession

，导致一级缓存看似“不生效”，但这并非一级缓存本身失效，而是因为不同调用使用了不同的 SqlSession。

要使一级缓存生效，需要

开启 Spring 事务管理

。当方法被 

@Transactional

 标记时，Spring 会在整个事务范围内复用同一个 SqlSession，此时一级缓存即可正常命中。

6.8 关于线程安全

一级缓存底层使用 HashMap 实现，

不是线程安全的

。SqlSession 本身也非线程安全，不应在多个线程间共享同一个 SqlSession 实例。在高并发场景下，多个线程共享同一个 SqlSession 会导致缓存数据混乱，建议每个线程维护独立的 SqlSession，或通过 Spring 的事务管理机制确保正确的线程绑定。

七、一级缓存与二级缓存的交互顺序

回顾第 5 篇中 

CachingExecutor

 的装饰模式：


```
// CachingExecutor.query
Cache cache = ms.getCache();
if (cache != null) {
    // 先尝试从二级缓存获取（实际是 TransactionalCache）
    list = tcm.getObject(cache, key);
    if (list == null) {
        // 二级缓存未命中，调用 delegate.query（即 BaseExecutor.query）
        list = delegate.query(...);
        // 将结果存入事务缓存
        tcm.putObject(cache, key, list);
    }
    return list;
}
// 没有二级缓存，直接走 BaseExecutor
return delegate.query(...);
```


因此完整顺序是：

CachingExecutor 先检查二级缓存（transactionalCache）是否命中；

若二级缓存未命中，则调用底层 Executor（如 BaseExecutor）查询一级缓存；

若一级缓存未命中，则查询数据库，并将结果写入一级缓存；

返回给 CachingExecutor 后，查询结果会写入事务缓存（TransactionalCache），

只有当 SqlSession 执行 commit 时，事务缓存中的内容才会真正刷新到二级缓存

；若执行 rollback，事务缓存中的内容将被丢弃。

八、面试高频题

Q1：一级缓存的 Key 是如何生成的？能举个例子吗？

A

：

CacheKey

由以下要素组成（按顺序）：

MappedStatement.id

（如

com.example.mapper.UserMapper.selectById

）

RowBounds.offset

和

RowBounds.limit

BoundSql.sql

（带

?

的 SQL 模板）

每个参数的实际值（按

ParameterMapping

顺序）

环境 id（可选）

例如，调用

userMapper.selectById(1)

时：

ms.id

=

"com.example.mapper.UserMapper.selectById"

offset

= 0,

limit

=

Integer.MAX_VALUE

sql

=

"SELECT * FROM user WHERE id = ?"

参数值 =

1

最终生成的

CacheKey

包含这些内容。如果传入

id=2

，参数值不同，

CacheKey

就不同，无法命中之前

id=1

的缓存。

Q2：一级缓存是否可能产生脏读？为什么？

A

：会。因为一级缓存是

SqlSession

级别的，不跨会话共享。会话 A 查询后缓存了数据，会话 B 修改并提交了数据库，会话 A 再次查询时仍然从自己的缓存中读取，导致读取到已过期的数据。这是 MyBatis 为了性能做出的权衡，如果要求强一致性，可以：

在查询上设置

flushCache=true

使用二级缓存并配置合适的刷新策略

在事务边界内避免长会话

Q3：一级缓存能关闭吗？

A

：不能完全关闭，但可以将

localCacheScope

设置为

STATEMENT

，这样每次查询后都会清空缓存，效果上相当于“每次查库”，但

localCache

对象仍然存在，只是不跨查询共享。如果想彻底禁用缓存逻辑，除非修改源码。

一级缓存之所以无法关闭，是因为 MyBatis 的级联映射、循环引用避免、嵌套查询加速等核心特性均高度依赖 CacheKey 机制和一级缓存架构，关闭会破坏这些功能的正常运行。

Q4：为什么更新操作会清空所有一级缓存，而不是只清空相关的缓存条目？

A

：因为 MyBatis 不知道哪些缓存条目会受到当前更新操作的影响（关联表、联合查询等复杂情况下很难精确判断）。为了简化并保证数据一致性，采取了最保守的策略：清空整个

SqlSession

的一级缓存。这也是 MyBatis 设计上的一处权衡，开发者需要根据业务场景考虑是否使用二级缓存或手动管理缓存。

Q5：

EXECUTION_PLACEHOLDER

的作用是什么？

A

：它是一个占位对象，在

queryFromDatabase

中先存入

localCache

，然后才执行

doQuery

。如果在

doQuery

执行过程中（例如动态 SQL 递归调用）再次触发了同一个 key 的查询，会因为

localCache.getObject(key)

返回

EXECUTION_PLACEHOLDER

而不是

null

，从而可以被检测到并抛出异常（

ExecutorException

），防止无限递归或死循环。

九、下篇预告

第 8 篇我们将深入

二级缓存

，包括：

二级缓存的开启与配置

CachingExecutor

与

TransactionalCache

的协作细节

一级缓存与二级缓存的执行顺序

缓存的刷新时机和事务边界

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
