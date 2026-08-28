---
title: "MyBatis 源码深度拆解（三）：Mapper 接口动态代理底层原理"
date: "2026-06-14"
domain: "学习"
area: "Java 后端"
module: "MyBatis 源码拆解"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "写在最前面 版本说明 本文主要基于  MyBatis 3.5.10  和  mybatis-spring 3.0.3  …"
tags:
  - "MyBatis"
  - "源码分析"
---

# MyBatis 源码深度拆解（三）：Mapper 接口动态代理底层原理

> 来源：微信公众号（MyBatis 源码深度拆解系列）
> 链接：[http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484015&idx=1&sn=36d33b759a3b1515a22aaac91862d1a4&chksm=c2b81030f5cf9926a3848cc3a03aebd6f9c020ca1169754095bab662bddbbbd8658735c83c6f](http://mp.weixin.qq.com/s?__biz=MzkzNDY5MjY1Ng==&mid=2247484015&idx=1&sn=36d33b759a3b1515a22aaac91862d1a4&chksm=c2b81030f5cf9926a3848cc3a03aebd6f9c020ca1169754095bab662bddbbbd8658735c83c6f)
> 类型：📚 参考资料（非面试题/面经）—— MyBatis 源码深度拆解系列
> 相关：第247题(MyBatis 分页拦截器)、第196题(MyBatis 与 Spring 事务整合)
> 整理时间：2026-08-03

---

写在最前面 版本说明

本文主要基于 

MyBatis 3.5.10

 和 

mybatis-spring 3.0.3

 源码进行分析。不同小版本可能在缓存实现、default 方法处理等方面存在差异，建议读者以自己实际使用的版本源码为准。

一、从一道面试题说起

很多初学者都会问：

我明明只定义了一个

UserMapper

接口，并没有写实现类，为什么 MyBatis 能帮我执行 SQL？

答案：

JDK 动态代理

。MyBatis 在运行时为你的接口生成了一个代理对象，所有的方法调用都会被这个代理对象拦截，然后转发给

SqlSession

去执行。

今天我们就从源码角度，把代理对象的

创建过程

和

调用过程

完整拆解一遍。

二、代理对象的创建时机

2.1 入口：

session.getMapper(UserMapper.class)

我们通常这样获取 Mapper：


```
UserMapper mapper = session.getMapper(UserMapper.class);
```


这个 

session

 实际是 

DefaultSqlSession

，我们跟进去：


```
@Override
public <T> T getMapper(Class<T> type) {
    return configuration.getMapper(type, this);
}
```


继续：


```
// Configuration
public <T> T getMapper(Class<T> type, SqlSession sqlSession) {
    return mapperRegistry.getMapper(type, sqlSession);
}
```


mapperRegistry

是

MapperRegistry

类型，它是

Configuration

中专门管理 Mapper 接口与代理工厂的注册表。

2.2 

MapperRegistry.getMapper()


```
public <T> T getMapper(Class<T> type, SqlSession sqlSession) {
    // 从 knownMappers 中获取该接口对应的 MapperProxyFactory
    final MapperProxyFactory<T> mapperProxyFactory = (MapperProxyFactory<T>) knownMappers.get(type);
    if (mapperProxyFactory == null) {
        throw new BindingException("Type " + type + " is not known to the MapperRegistry.");
    }
    try {
        // 通过工厂创建代理实例
        return mapperProxyFactory.newInstance(sqlSession);
    } catch (Exception e) {
        throw new BindingException("Error getting mapper instance. Cause: " + e, e);
    }
}
```


关键点

：

knownMappers

是一个

Map<Class<?>, MapperProxyFactory<?>>

，在解析配置文件或包扫描时就已经填充好了。

每个 Mapper 接口对应一个

MapperProxyFactory

，专门用来生成该接口的代理对象。

2.3 

MapperProxyFactory.newInstance()


```
public T newInstance(SqlSession sqlSession) {
    // 创建 MapperProxy，它实现了 InvocationHandler
    final MapperProxy<T> mapperProxy = new MapperProxy<>(sqlSession, mapperInterface, methodCache);
    return newInstance(mapperProxy);
}

protected T newInstance(MapperProxy<T> mapperProxy) {
    // 使用 JDK 动态代理生成代理对象
    return (T) Proxy.newProxyInstance(mapperInterface.getClassLoader(),
                                      new Class[] { mapperInterface },
                                      mapperProxy);
}
```


到这里，代理对象就诞生了。

核心三要素

：

类加载器

：

mapperInterface.getClassLoader()

要代理的接口数组

：

new Class[] { mapperInterface }

InvocationHandler

：

mapperProxy

，当代理对象的方法被调用时，会进入它的 

invoke

 方法。

三、代理对象的方法调用链路

当调用

userMapper.selectById(1)

时，实际上进入的是

MapperProxy.invoke()

。

3.1 

MapperProxy.invoke()


```
@Override
public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    try {
        // 如果是 Object 类的方法（如 toString、hashCode），直接调用，不拦截
        if (Object.class.equals(method.getDeclaringClass())) {
            return method.invoke(this, args);
        }
        // 缓存或新建 MapperMethod，然后执行
        return cachedInvoker(method).invoke(proxy, method, args, sqlSession);
    } catch (Throwable t) {
        throw ExceptionUtil.unwrapThrowable(t);
    }
}
```


这里出现了 

MapperMethod

，它是真正干活的类。

3.2

cachedInvoker(method)

与

MapperMethod

cachedInvoker

会从

methodCache

（一个

ConcurrentHashMap<Method, MapperMethodInvoker>

）中获取或创建

MapperMethodInvoker

。

MapperMethodInvoker

是 MyBatis 内部定义的函数式接口，有两个实现类：

PlainMethodInvoker

：内部持有

MapperMethod

对象，负责普通接口方法的 SQL 执行；

DefaultMethodInvoker

：直接调用接口中的

default

方法（Java 8+）。

每次方法调用时，

methodCache

 缓存的是 

MapperMethodInvoker

，而 

MapperMethod

 只是 

PlainMethodInvoker

 的一个成员变量。


```
private MapperMethodInvoker cachedInvoker(Method method) throws Throwable {
    try {
      return MapUtil.computeIfAbsent(methodCache, method, m -> {
        if (!m.isDefault()) {
          return new PlainMethodInvoker(new MapperMethod(mapperInterface, method, sqlSession.getConfiguration()));
        }
        try {
          if (privateLookupInMethod == null) {
            return new DefaultMethodInvoker(getMethodHandleJava8(method));
          }
          return new DefaultMethodInvoker(getMethodHandleJava9(method));
        } catch (IllegalAccessException | InstantiationException | InvocationTargetException
            | NoSuchMethodException e) {
          throw new RuntimeException(e);
        }
      });
    } catch (RuntimeException re) {
      Throwable cause = re.getCause();
      throw cause == null ? re : cause;
    }
  }
```


MapperMethod

构造时会解析：

方法名（对应 Mapper XML 中的 id）

方法的返回类型（是单对象还是集合？）

方法的参数信息（是否使用

@Param

等）

MapperMethod

 中有两个核心字段：


```
public class MapperMethod {
    private final SqlCommand command;   // 封装 SQL 的类型(SELECT/INSERT/UPDATE/DELETE)和 MappedStatement 的 id
    private final MethodSignature method; // 封装方法的签名信息（返回类型、参数等）
}
```


3.3

MapperMethod.execute()

PlainMethodInvoker.invoke()

最终会调用

mapperMethod.execute(sqlSession, args)

：


```
public Object execute(SqlSession sqlSession, Object[] args) {
    Object result;
    switch (command.getType()) {
        case INSERT:
            // 处理 insert
            break;
        case UPDATE:
            // 处理 update
            break;
        case DELETE:
            // 处理 delete
            break;
        case SELECT:
            // 根据返回类型，调用 sqlSession 的不同方法
            if (method.returnsVoid() && method.hasResultHandler()) {
                executeWithResultHandler(sqlSession, args);
                result = null;
            } else if (method.returnsMany()) {
                result = executeForMany(sqlSession, args);
            } else if (method.returnsMap()) {
                result = executeForMap(sqlSession, args);
            } else if (method.returnsCursor()) {
                result = executeForCursor(sqlSession, args);
            } else {
                // 返回单个对象
                Object param = method.convertArgsToSqlCommandParam(args);
                result = sqlSession.selectOne(command.getName(), param);
            }
            break;
        case FLUSH:
            result = sqlSession.flushStatements();
            break;
        default:
            throw new BindingException("Unknown execution method...");
    }
    return result;
}
```


最终，我们看到了我们熟悉的方法：

sqlSession.selectOne()

 或 

selectList()

，后面的流程就回到了第一篇中讲过的 

Executor

 → 

StatementHandler

 → JDBC。

四、

@MapperScan

底
层注册流程（Spring 集成）

4.1 整体设计理念：延迟扫描

@MapperScan

 的设计理念是 

延迟扫描 + 职责分离

：

角色

实现类

核心职责

触发者

@MapperScan

 注解

声明扫描范围，通过

@Import导入 Registrar

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

4.2 阶段一：MapperScannerRegistrar — 注册扫描器定义

@MapperScan

 注解通过 

@Import

 导入了 

MapperScannerRegistrar

：


```
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Import(MapperScannerRegistrar.class)  // 关键：导入了一个 Registrar
public @interface MapperScan {
    String[] value() default {};
    String[] basePackages() default {};
    // ...
}
```


MapperScannerRegistrar

 实现了 

ImportBeanDefinitionRegistrar

 接口，Spring 启动时会调用其 

registerBeanDefinitions

 方法：


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

4.3 阶段二：MapperScannerConfigurer — 触发扫描

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

4.4 阶段三：ClassPathMapperScanner — 扫描与 BeanDefinition 转换

ClassPathMapperScanner

 继承自 Spring 的 

ClassPathBeanDefinitionScanner

，重写了 

doScan

 方法：


```
// ClassPathMapperScanner (mybatis-spring 3.0.3)
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

com.example.mapper.UserMapper（接口）

beanClass =

MapperFactoryBean

无构造参数

构造参数 =

UserMapper.class

4.5 阶段四：MapperFactoryBean — 生成代理对象

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
// MapperFactoryBean (mybatis-spring 3.0.3)
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

4.7 完整调用链总览


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


五、面试高频题

Q1：MyBatis 的 Mapper 接口为什么不需要实现类？

A

：因为 MyBatis 使用了 JDK 动态代理，在运行时为接口生成了一个代理对象。当调用接口方法时，会被

MapperProxy.invoke()

拦截，然后根据方法名找到对应的

MappedStatement

，最终调用

SqlSession

执行 SQL。

Q2：

MapperProxy

中为什么要缓存

MapperMethod

？

A

：

MapperMethod

的构造过程需要解析方法的返回值类型、参数信息等，这些信息是固定的。缓存可以避免每次方法调用都重复解析，提高性能。

Q3：

@MapperScan

的原理是什么？

A

：

@MapperScan

 底层通过 

@Import(MapperScannerRegistrar.class)

 导入了一个 

ImportBeanDefinitionRegistrar

。Spring 启动时，

MapperScannerRegistrar

 会向容器注册一个 

MapperScannerConfigurer

 的 BeanDefinition。

MapperScannerConfigurer

 实现了 

BeanDefinitionRegistryPostProcessor

，所以在 Spring 的 

refresh()

 过程中，它的 

postProcessBeanDefinitionRegistry

 方法会被调用。在这个方法里，会创建一个 

ClassPathMapperScanner

，执行 

doScan

 扫描指定包下的所有 Mapper 接口，然后将每个接口的 BeanDefinition 的 

beanClass

 修改为 

MapperFactoryBean

，并将原始接口类型作为构造参数传入。最终，Spring 实例化 

MapperFactoryBean

 时，会调用其 

getObject()

 方法，通过 

SqlSession.getMapper()

 生成真正的 Mapper 动态代理对象（即 

MapperProxy

）并注入容器。

Q4：

MapperFactoryBean

和

MapperProxyFactory

是什么关系？

A

：

MapperProxyFactory

是 MyBatis 内部用来创建代理对象的工厂，与 Spring 无关。

MapperFactoryBean

是 Spring 集成中的适配器，它实现了

FactoryBean

，内部持有

SqlSession

，并调用

sqlSession.getMapper()

来获取代理对象，而

sqlSession.getMapper()

最终会调用

MapperProxyFactory

创建代理。

六、下篇预告

第 4 篇我们将深入

SqlSession

体系，拆解

DefaultSqlSession

、

SqlSessionFactory

的构建流程，以及

SqlSession

的四大核心对象的初始化时机。

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
