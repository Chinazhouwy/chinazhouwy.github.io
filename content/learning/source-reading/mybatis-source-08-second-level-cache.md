---
title: "MyBatis 源码深度拆解（八）：二级缓存机制详解"
date: "2026-07-27"
domain: "学习"
area: "Java 后端"
module: "MyBatis 源码拆解"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "面试官：MyBatis 的二级缓存是什么级别的？如何开启？它与一级缓存有什么区别？为什么二级缓存需要事务提交后才生效？ …"
tags:
  - "MyBatis"
  - "源码分析"
---

# MyBatis 源码深度拆解（八）：二级缓存机制详解

> 来源：微信公众号（MyBatis 源码深度拆解系列）
> 链接：[http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484057&idx=1&sn=6a1425b89e56f10244a4174f7bdf5f41&chksm=c2b810c6f5cf99d03ed7738fa8a3a7434d90989cb10fc14989133205aa5dfe524de9278183af](http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484057&idx=1&sn=6a1425b89e56f10244a4174f7bdf5f41&chksm=c2b810c6f5cf99d03ed7738fa8a3a7434d90989cb10fc14989133205aa5dfe524de9278183af)
> 类型：📚 参考资料（非面试题/面经）—— MyBatis 源码深度拆解系列
> 相关：第235题(百万行导出)
> 整理时间：2026-08-03

---

面试官：MyBatis 的二级缓存是什么级别的？如何开启？它与一级缓存有什么区别？为什么二级缓存需要事务提交后才生效？

一、开篇

二级缓存是 MyBatis 中

跨 SqlSession 共享

的缓存机制，作用范围是

Mapper 的 namespace

（即一个 Mapper 接口或 XML 文件中的所有 SQL 共享同一个二级缓存）。默认关闭，需要手动配置开启。

本篇目标

：

二级缓存的开启与配置方式

理解

CachingExecutor

与

TransactionalCache

的协作

缓存的延迟提交机制（事务提交后才真正写入）

一级缓存与二级缓存的执行顺序

缓存刷新（flush）的时机与作用

二、二级缓存整体架构

核心组件

：

CachingExecutor

：装饰器，为普通 Executor 添加二级缓存能力。

TransactionalCacheManager

：管理每个

Cache

对应的

TransactionalCache

。

TransactionalCache

：事务性缓存包装器，存储当前事务中待提交的缓存条目。

Cache

（通常是 

PerpetualCache

）：真正的缓存存储，本质是 

HashMap

。

三、二级缓存的开启与配置

3.1 全局开关

在 

mybatis-config.xml

 中：


```
<settings>
    <!-- 默认 true，若设为 false，所有二级缓存失效 -->
    <setting name="cacheEnabled" value="true"/>
</settings>
```


3.2 Mapper 级别开启

在 Mapper XML 文件中添加 

<cache>

 标签：


```
<mapper namespace="com.example.mapper.UserMapper">
    <!-- 开启二级缓存 -->
    <cache/>
    <select id="selectById" resultType="User">
        SELECT * FROM user WHERE id = #{id}
    </select>
</mapper>
```


或者使用注解 

@CacheNamespace

注意

：

cacheEnabled

 是二级缓存的全局总开关，默认为 

true

。这意味着

二级缓存在全局是‘可用’的

，但还需要在具体的 Mapper XML 文件中添加 

<cache/>

 标签才能

启用

。因此，‘二级缓存默认是关闭的’这句话，是从

需要手动在 Mapper 中配置

这个角度来说的

3.3 单个 SQL 的二级缓存控制

useCache

：默认

true

，设为

false

时该查询不使用二级缓存。

flushCache

：对于 

<select>

 默认 

false

，对于 

<insert/update/delete>

 默认 

true

。


```
<select id="selectUser" resultType="User" useCache="true" flushCache="false">
    SELECT * FROM user WHERE id = #{id}
</select>
```


当

flushCache=true

时，在执行该 SQL

之前

，会清空对应的缓存区域：

对于 

INSERT

 / 

UPDATE

 / 

DELETE

：清空当前 namespace 的二级缓存。

一级缓存不受影响，它会在同一个 SqlSession 的事务

提交（commit）后

被清空

对于 

SELECT

：

清空当前 namespace 的

二级缓存

（但通常查询不需要清空缓存，默认 false）。一级缓存不受影响。

四、

CachingExecutor

源码分析

CachingExecutor

 是二级缓存的核心入口，它装饰真正的执行器（如 

SimpleExecutor

）。

4.1 装饰器构造


```
// CachingExecutor
public class CachingExecutor implements Executor {
    private final Executor delegate;
    private final TransactionalCacheManager tcm = new TransactionalCacheManager();

    public CachingExecutor(Executor delegate) {
        this.delegate = delegate;
        delegate.setExecutorWrapper(this);
    }
}
```


4.2

query

方法


```
@Override
public <E> List<E> query(MappedStatement ms, Object parameterObject, RowBounds rowBounds,
                         ResultHandler resultHandler, CacheKey key, BoundSql boundSql) throws SQLException {
    Cache cache = ms.getCache();                     // 获取 Mapper 关联的 Cache
    if (cache != null) {
        flushCacheIfRequired(ms);                    // 若需要清空缓存，则清空
        if (ms.isUseCache() && resultHandler == null) {
            ensureNoOutParams(ms, boundSql);         // 存储过程 OUT 参数不支持二级缓存
            @SuppressWarnings("unchecked")
            List<E> list = (List<E>) tcm.getObject(cache, key);
            if (list == null) {
                list = delegate.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);
                tcm.putObject(cache, key, list);     // 存入事务缓存
            }
            return list;
        }
    }
    return delegate.query(ms, parameterObject, rowBounds, resultHandler, key, boundSql);
}
```


流程

：

检查当前

MappedStatement

是否配置了二级缓存（

ms.getCache()

）。

执行

flushCacheIfRequired

：如果该查询标签设置了

flushCache=true

，清空整个二级缓存。

如果

useCache=true

且没有使用

ResultHandler

，且不是存储过程带 OUT 参数，则进入二级缓存逻辑。

从

TransactionalCacheManager

中尝试获取缓存结果。

若未命中，调用

delegate.query

（进入一级缓存 + 数据库查询），然后将结果存入

TransactionalCache

。

若未配置二级缓存或不满足条件，直接委托给

delegate.query

。

4.3 

update

 方法


```
@Override
public int update(MappedStatement ms, Object parameterObject) throws SQLException {
    flushCacheIfRequired(ms);
    return delegate.update(ms, parameterObject);
}
```


更新操作会调用

flushCacheIfRequired

，根据

flushCache

配置（默认

true

）决定是否清空二级缓存。

4.4 

commit

 和 

rollback

 方法


```
@Override
public void commit(boolean required) throws SQLException {
    delegate.commit(required);
    tcm.commit();                   // 提交所有暂存的缓存项
}
@Override
public void rollback(boolean required) throws SQLException {
    try {
        delegate.rollback(required);
    } finally {
        if (required) {
            tcm.rollback();         // 回滚时丢弃暂存的缓存项
        }
    }
}
```


关键

：二级缓存并非立即写入，而是等到事务提交时才真正刷新。这保证了缓存与事务的一致性。

五、TransactionalCacheManager与TransactionalCache

5.1 

TransactionalCacheManager


```
public class TransactionalCacheManager {
    private final Map<Cache, TransactionalCache> transactionalCaches = new HashMap<>();

    public void putObject(Cache cache, CacheKey key, Object value) {
        getTransactionalCache(cache).putObject(key, value);
    }

    public Object getObject(Cache cache, CacheKey key) {
        return getTransactionalCache(cache).getObject(key);
    }

    public void commit() {
        for (TransactionalCache txCache : transactionalCaches.values()) {
            txCache.commit();
        }
    }

    public void rollback() {
        for (TransactionalCache txCache : transactionalCaches.values()) {
            txCache.rollback();
        }
    }
}
```


5.2

TransactionalCache

核心逻辑


```
public class TransactionalCache implements Cache {
    private final Cache delegate;                       // 真正的缓存对象（如 PerpetualCache）
    private final Map<Object, Object> entriesToAddOnCommit;   // 待提交的缓存条目
    private final Set<Object> entriesMissedInCache;           // 本次事务中未命中缓存的 key
    private boolean clearOnCommit;                            // 提交时是否清空缓存

    @Override
    public void putObject(Object key, Object value) {
        // 暂存到待提交列表，不立即写入 delegate
        entriesToAddOnCommit.put(key, value);
    }

    @Override
    public Object getObject(Object key) {
        // 先从 delegate 中获取
        Object object = delegate.getObject(key);
        if (object == null) {
            entriesMissedInCache.add(key);
        }
        return object;
    }

    public void commit() {
        if (clearOnCommit) {
            delegate.clear();
        }
        // 将暂存的所有条目刷新到真正的缓存中
        flushPendingEntries();
        reset();
    }

    public void rollback() {
        unlockMissedEntries();
        // 回滚：丢弃待提交的条目，不清空 delegate 中已有的缓存
        reset();
    }

    private void flushPendingEntries() {
        for (Map.Entry<Object, Object> entry : entriesToAddOnCommit.entrySet()) {
            delegate.putObject(entry.getKey(), entry.getValue());
        }
    }
    private void unlockMissedEntries() {
        for (Object key : entriesMissedInCache) {
            try {
                delegate.getObject(key);   // 触发缓存实体的解锁（如果底层缓存实现了锁机制）
            } catch (Exception e) {
                // ignore
            }
        }
        entriesMissedInCache.clear();
    }
}
```


延迟提交机制

：

事务内查询的结果先存入

entriesToAddOnCommit

，不写入

delegate

。

事务提交时（

commit()

），将所有暂存条目真正写入底层缓存。

事务回滚时，直接丢弃暂存条目。

如果事务中执行了更新且配置了

flushCache=true

，会标记

clearOnCommit

，提交时清空整个缓存。

这样设计保证了

缓存与数据库事务的隔离性

：一个事务中查询的数据不会被其他事务看到，直到该事务提交。

六、二级缓存与一级缓存的执行顺序

一次带二级缓存的查询完整调用链：


```
CachingExecutor.query
    ↓
检查二级缓存（ms.getCache()）
    ↓
从 TransactionalCache 获取结果
    ↓ 未命中
delegate.query（即 BaseExecutor.query）
    ↓
一级缓存 localCache.getObject(key)
    ↓ 未命中
数据库查询 → 写入一级缓存
    ↓
返回结果给 CachingExecutor
    ↓
tcm.putObject(cache, key, list) → 存入事务缓存
    ↓
事务提交时，tcm.commit() → 刷新到真正的二级缓存
```


顺序总结

：

一次带二级缓存的查询完整调用链的最终顺序是：

一级缓存 → 二级缓存 → 数据库

。原因是：CachingExecutor 在逻辑上先处理二级缓存，但实际查询时会委托给 BaseExecutor，后者会优先检查一级缓存。

七、缓存清空（Flush）机制

7.1 清空时机

执行

INSERT/UPDATE/DELETE

且该标签的

flushCache

属性为

true

（默认

true

）。

执行

<select flushCache="true">

的查询。

手动调用

sqlSession.clearCache()

（仅清空一级缓存，不清二级）。

二级缓存可设置

flushInterval

，定时清空。

缓存回收策略（如

LRU

）达到容量上限时清除。

7.2 源码中的清空流程

CachingExecutor.flushCacheIfRequired

 方法：


```
private void flushCacheIfRequired(MappedStatement ms) {
    Cache cache = ms.getCache();
    if (cache != null && ms.isFlushCacheRequired()) {
        tcm.clear(cache);
    }
}
```


TransactionalCacheManager.clear

→

TransactionalCache.clear

：


```
public void clear() {
    clearOnCommit = true;
    entriesToAddOnCommit.clear();
}
```


提交时，若 

clearOnCommit

 为 

true

，会先执行 

delegate.clear()

，清空整个缓存。

八、面试高频题

Q1：二级缓存是 Mapper 级别还是 namespace 级别？

A

：每个 Mapper XML 文件（或注解的

@CacheNamespace

）对应一个独立的

Cache

实例，同一个 namespace 下的所有 SQL 共享该缓存。如果多个 Mapper 共享同一个 namespace（如通过

cache-ref

），则它们共用同一个缓存。

Q2：为什么二级缓存需要事务提交后才写入？

A

：为了防止脏读。如果事务内查询的数据立即写入缓存，其他事务就能读到这些未提交的数据，违反了事务隔离性。通过

TransactionalCache

延迟提交机制，只有当事务提交成功后才将缓存可见，如果事务回滚，这些缓存条目会被丢弃，避免了脏数据传播。

Q3：二级缓存能否跨不同的 SqlSession 共享数据？

A

：可以。二级缓存的

Cache

实例是 Mapper namespace 级别的，所有

SqlSession

共享同一个

Cache

对象。只要事务提交后，缓存数据就会被其他

SqlSession

读到。

Q4：什么时候不应该使用二级缓存？

A

：

数据更新频繁的 Mapper，缓存经常被清空，收益不大。

查询结果涉及多个 Mapper 关联的数据，若其中一个 Mapper 更新了数据，其他 Mapper 的缓存可能无法感知（可通过

cache-ref

共享缓存来缓解，但复杂场景仍然容易产生脏数据）。

对实时性要求极高的场景（缓存延迟导致读到旧数据）。

Q5：如何清空二级缓存？

A

：

执行任意

INSERT/UPDATE/DELETE

（默认

flushCache=true

）会清空对应 namespace 的二级缓存。

通过配置

<select flushCache="true">

。

通过

<cache flushInterval="60000"/>

定时刷新。

手动调用

Cache

的

clear()

方法（可通过插件或代码获取

Configuration

中的

Cache

实例）。

Q6：一级缓存和二级缓存有什么区别？

维度

一级缓存

二级缓存

作用范围

SqlSession

级别

Mapper namespace 级别

默认状态

开启

关闭

生命周期

SqlSession

打开到关闭

全局，除非主动清空或超时

是否跨会话

否

是

实现类

PerpetualCache

PerpetualCache

（通过

TransactionalCache

包装）

事务提交影响

无特殊处理

延迟提交

九、下篇预告

第 9 篇我们将深入

MyBatis 插件（Interceptor）底层原理

，包括：

责任链模式 + 装饰器模式的源码实现

四大拦截点：

Executor

、

StatementHandler

、

ParameterHandler

、

ResultSetHandler

自定义分页插件的实现原理

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
