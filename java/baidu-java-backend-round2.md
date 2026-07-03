# 百度后端 Java 二面面经

> 来源：小红书（OCR 提取）| 提取日期：2026-05-23
> 侧重 Spring 生态核心原理 + 分布式中间件
> 面试时长：55 分钟 | 面试形式：线上面试（腾讯会议）

---

## 面试问题清单

### 1. 自我介绍（3 分钟）

重点突出 Spring 相关项目经验，以及分布式组件的使用场景。

### 2. 核心技术提问

#### (1) Spring AOP 的运行原理是什么？JDK 动态代理和 CGLIB 动态代理的区别，Spring 默认使用哪种代理方式？

**AOP 原理：**
- Spring AOP 基于代理模式实现，在运行时动态生成代理对象
- 核心流程：解析 @Aspect → 生成 Advisor（Pointcut + Advice）→ 创建代理对象 → 方法调用时拦截执行增强逻辑

**JDK 动态代理 vs CGLIB：**

| 维度 | JDK 动态代理 | CGLIB 动态代理 |
|------|-------------|---------------|
| 原理 | 基于接口，通过 `InvocationHandler` + `Proxy.newProxyInstance()` 生成代理类 | 基于继承，通过 ASM 生成目标类的子类，重写非 final 方法 |
| 要求 | 目标类必须实现接口 | 目标类不能是 final，方法不能是 final |
| 性能（早期） | 创建慢，调用快 | 创建快，调用慢（CGLIB 会缓存 FastClass） |
| 性能（现代） | JDK8+ 大幅优化，差距缩小 | 通常比 JDK 代理略慢约 10-20% |

**Spring 默认策略：**
- 如果目标类实现了接口 → **JDK 动态代理**
- 如果目标类没有实现接口 → **CGLIB 代理**
- Spring Boot 2.x+ 默认强制使用 CGLIB（`spring.aop.proxy-target-class=true`）

**踩坑：**
- JDK 代理只能拦截接口方法，非接口方法不生效
- CGLIB 不能代理 final 方法，且需要 CGLIB 依赖（Spring Boot 已内置）
- 同类中的方法自调用（this.method()）不会触发 AOP 增强，需要注入自身代理对象

---

#### (2) Spring MVC 的请求处理全流程 — DispatcherServlet 到视图渲染的详细步骤

**完整流程（9步）：**

```
请求 → DispatcherServlet → HandlerMapping → HandlerAdapter（含拦截器）
→ 执行 Controller → 返回 ModelAndView → ViewResolver → 视图渲染 → 响应
```

**详细步骤：**

1. **用户发送请求** → 到达 DispatcherServlet（前端控制器）
2. **HandlerMapping 查找处理器**：根据请求 URL 匹配对应的 Handler（Controller 方法）
3. **HandlerAdapter 执行拦截器前置方法**：preHandle()
4. **HandlerAdapter 调用 Controller 方法**：参数绑定（@RequestParam/@RequestBody/@PathVariable 等）、数据校验、执行业务逻辑
5. **Controller 返回 ModelAndView** 或 @ResponseBody 直接写响应
6. **HandlerAdapter 执行拦截器后置方法**：postHandle()
7. **ViewResolver 解析视图**：根据视图名找到具体的 View 实现（JSP/Thymeleaf/Freemarker）
8. **视图渲染**：将 Model 数据填充到视图模板
9. **返回响应**：渲染后的 HTML

**@ResponseBody 的消息转换机制（追问）：**
- @ResponseBody 搭配 `HttpMessageConverter` 工作
- 流程：DispatcherServlet → RequestMappingHandlerAdapter → 选择合适的 MessageConverter（如 MappingJackson2HttpMessageConverter）→ 将 Java 对象序列化为 JSON/XML → 写入 HTTP Response Body
- 选择策略：根据请求头 `Accept` + 返回值类型自动匹配

---

#### (3) Spring 事务的传播机制有哪些？说说你在项目中如何使用 Spring事务，有没有遇到过事务失效的情况，如何解决的？

**七种传播机制：**

| 传播行为 | 说明 | 应用场景 |
|---------|------|---------|
| REQUIRED（默认） | 支持当前事务，不存在则新建 | 大部分业务方法 |
| SUPPORTS | 支持当前事务，不存在则以非事务执行 | 查询方法 |
| MANDATORY | 必须在事务中执行，否则抛异常 | 不允许独立执行的操作 |
| REQUIRES_NEW | 挂起当前事务，新建独立事务 | 操作日志记录（不随主事务回滚） |
| NOT_SUPPORTED | 以非事务方式执行，挂起当前事务 | 发送通知/邮件 |
| NEVER | 以非事务方式执行，有事务则抛异常 | 纯查询/校验 |
| NESTED | 嵌套事务，JDBC 3.0 Savepoint 机制 | 批量处理中部分回滚 |

**事务失效的常见场景及解决：**

| 失效场景 | 原因 | 解决方案 |
|----------|------|----------|
| 同类方法自调用 | `this.method()` 不走代理对象 | 注入自己/拆类/AopContext.currentProxy() |
| 方法非 public | CGLIB/JDK 代理只拦截 public 方法 | 改为 public |
| 异常被 catch 未抛出 | 事务拦截器检测不到异常 | 抛异常或手动 TransactionAspectSupport |
| 异常类型不匹配 | 默认只回滚 RuntimeException | @Transactional(rollbackFor = Exception.class) |
| 数据库引擎不支持 | MyISAM 不支持事务 | 改用 InnoDB |
| 传播机制配置错误 | REQUIRES_NEW 在新线程中无效 | 确保在同一个线程中 |

---

#### (4) Redis 分布式锁的实现方式，如何保证锁的可靠性？Redission 的看门狗机制是如何工作的？

**实现方式：**

```java
// 方式1：SETNX + EXPIRE（基本方案，有原子性问题）
// 方式2：SET key value NX EX 30（原子化一条命令，推荐）
// 方式3：Redission 框架（功能最全）
```

**保证锁的可靠性：**

1. **原子性**：SET NX EX 单命令保证加锁+过期原子性
2. **唯一标识**：value 使用 UUID+threadId，防止误删其他线程的锁
3. **自动续期**：看门狗机制防止业务未完成锁先过期
4. **可重入**：Redission 用 Hash 结构实现，field=线程标识，value=重入计数
5. **主从切换**：RedLock 算法（向多数节点同时加锁）

**Redission 看门狗机制：**
- 加锁成功后，启动一个后台定时任务（netty 的 Timeout）
- 每隔 `lockWatchdogTimeout/3`（默认 10 秒）检查锁是否还持有
- 如果持有，自动续期 `lockWatchdogTimeout` 毫秒（默认 30 秒）
- 业务完成后释放锁，看门狗停止

**追问：服务宕机后，分布式锁如何释放？**
- 服务宕机 → 看门狗停止续期 → 锁自然过期自动释放
- 关键：必须设置合理的过期时间（不能无限期持有）
- 注意：宕机那一刻到锁过期之间有窗口期，其他线程可能获取到锁

---

#### (5) Dubbo 的底层实现原理，服务从发布到被消费的详细过程

**完整过程（10步）：**

```
Provider 启动 → 导出 Service → 注册到 Registry
                                    ↓
Consumer 启动 → 订阅 Service ← 从 Registry 获取 Provider 列表
                                    ↓
                Registry 通知变更 → Consumer 缓存 Provider 列表
                                    ↓
                Consumer 调用 → 负载均衡 → 选一个 Provider
                                    ↓
                Proxy 代理 → 网络传输 → Provider 端执行 → 返回结果
```

**关键组件：**

| 组件 | 职责 |
|------|------|
| Provider | 服务提供者，暴露服务 |
| Consumer | 服务消费者，远程调用 |
| Registry | 服务注册中心（Zookeeper/Nacos） |
| Monitor | 监控中心，统计调用次数和耗时 |
| Container | 服务运行容器（Spring 容器） |

**底层实现原理：**
1. **代理层**：Consumer 通过 Javassist/JDK Proxy 生成接口的代理对象，调用时拦截
2. **协议层**：Dubbo 协议（默认）基于 Netty + Hessian 序列化
3. **集群层**：负载均衡（Random/RoundRobin/LeastActive）+ 容错策略（Failover/Failfast/Failsafe）
4. **调用过程**：Proxy → Invoker → 负载均衡 → 网络传输 → 反序列化 → Provider Invoker → 真实执行

**Dubbo 服务治理手段（追问）：**
- **负载均衡**：随机/轮询/最少活跃/一致性哈希
- **容错策略**：失败重试（Failover）/快速失败（Failfast）/安全失败（Failsafe）/并行调用（Forking）
- **服务降级**：mock 降级、屏蔽非关键服务
- **流量控制**：限流（ExecuteLimit）+ 熔断（Sentinel 集成）
- **服务路由**：条件路由、标签路由
- **动态配置**：通过注册中心动态调整超时/重试次数/权重

---

### 3. 项目深挖

#### (1) 项目中使用 Spring Boot 的核心优势是什么？如何自定义一个 Spring Boot Starter？

**核心优势：**
- **自动配置**：基于条件注解（@ConditionalOnClass/@ConditionalOnMissingBean）实现零 XML 配置
- **起步依赖**：一站式引入，版本管理（spring-boot-starter-xxx）
- **嵌入式容器**：内置 Tomcat/Jetty/Undertow，jar 包直接运行
- **生产就绪**：Actuator（健康检查/指标/审计）+ 外部化配置
- **生态集成**：与 Spring Cloud/安全/数据等无缝集成

**自定义 Starter 步骤：**

```
1. 创建自动配置类：@Configuration + @ConditionalOnXxx
2. 定义属性类：@ConfigurationProperties(prefix = "xxx")
3. 创建 spring.factories：org.springframework.boot.autoconfigure.EnableAutoConfiguration=xxxAutoConfiguration
4. 打包引用：引入 Starter 依赖即可
```

**示例：**
```java
// 1. 属性类
@ConfigurationProperties(prefix = "my.redis")
public class MyRedisProperties {
    private String host = "localhost";
    private int port = 6379;
}

// 2. 自动配置类
@Configuration
@ConditionalOnClass(RedisClient.class)
@EnableConfigurationProperties(MyRedisProperties.class)
public class MyRedisAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    public RedisClient redisClient(MyRedisProperties props) {
        return new RedisClient(props.getHost(), props.getPort());
    }
}

// 3. spring.factories
// org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
// com.xxx.MyRedisAutoConfiguration
```

---

#### (2) 项目中用到了消息队列，说说你为什么选择该消息队列？如何解决消息丢失、消息重复消费的问题？

**选型对比（以选择的 MQ 为例）：**

| 维度 | RabbitMQ | Kafka | RocketMQ |
|------|----------|-------|----------|
| 适用场景 | 业务消息，低延迟 | 日志/大数据/流处理 | 交易/削峰/事务 |
| 吞吐量 | 万级 | 十万~百万级 | 十万级 |
| 消息可靠性 | 高（Confirm+持久化） | 高（ACK+副本） | 极高（事务消息） |
| 路由能力 | 丰富（Direct/Topic/Header） | 弱（Topic+Partition） | 强（Tag+SQL过滤） |
| 运维复杂度 | 低（Erlang 成熟） | 中（依赖 ZK） | 中 |

**选择理由（举例）：** 选择了 RocketMQ，因为：①业务需要事务消息（分布式事务 2PC）②需要消息回溯能力 ③需要延迟消息（定时/延时 ④阿里系技术栈兼容

**消息丢失的解决方案：**

```
发送端丢失 → 事务消息 / Confirm 回调 / 重试机制
Broker 丢失 → 同步刷盘 / 主从同步（Leader-Follower ACK）
消费端丢失 → 手动 ACK（消费成功后才确认）
```

| 阶段 | 方案 | 具体实现 |
|------|------|----------|
| 生产端 | Confirm 机制 | 发送后等待 Broker ACK，失败重试 |
| 生产端 | 事务消息（RocketMQ） | 半消息→执行本地事务→Commit/Rollback |
| Broker | 同步刷盘 | `flushDiskType=SYNC_FLUSH` |
| Broker | 主从同步 | 写成功到多数副本才算成功 |
| 消费端 | 手动 ACK | `ackMode=MANUAL`，处理完才 ACK |

**消息重复消费的解决方案（幂等性）：**

- **方案 1：业务主键去重** — 数据库唯一索引（如 orderId 作为唯一键）
- **方案 2：Redis 去重** — `SET msgId NX EX 60`，已存在则跳过
- **方案 3：状态机** — 消费前检查业务状态（如订单已支付则跳过）
- **方案 4：乐观锁** — 版本号 + CAS 更新

**核心原则：** 消费端做好幂等性，而不是期望消息队列本身去重（MQ 保证 at-least-once，无法保证 exactly-once）

---

### 4. 算法题（15 分钟）：最长无重复子数组 — 滑动窗口

```java
public int lengthOfLongestSubstring(String s) {
    // 滑动窗口 + 哈希表记录字符最后出现位置
    Map<Character, Integer> map = new HashMap<>();
    int maxLen = 0;
    int left = 0; // 窗口左边界

    for (int right = 0; right < s.length(); right++) {
        char c = s.charAt(right);
        // 如果字符已存在且在窗口内，移动左边界
        if (map.containsKey(c) && map.get(c) >= left) {
            left = map.get(c) + 1;
        }
        map.put(c, right);
        maxLen = Math.max(maxLen, right - left + 1);
    }
    return maxLen;
}
```

**时间复杂度：** O(n) — 每个元素最多左右指针各遍历一次
**空间复杂度：** O(min(m, n)) — m 为字符集大小，n 为字符串长度

**变体（扩展思路）**:
- 如果要求返回最长子串本身？维护 `startIndex` 记录
- 如果只有小写字母？用 `int[26]` 代替 HashMap 优化性能
- 如果是子数组（整数数组）？同样滑动窗口，HashMap<Integer, Integer>

---

### 5. 反问环节

#### (1) 团队在分布式系统架构上有哪些优化方向？
> 加分项：结合面试官团队的业务场景来问，不要问太泛
> 示例：当前团队在微服务拆分粒度、服务网格、可观测性上的实践和下一步规划

#### (2) 平时开发中如何进行代码评审和质量控制？
> 示例：有没有引入 SonarQube/静态扫描？Code Review 的流程是怎样的？有没有自动化测试覆盖率指标？

---

## 面试总结

| 考察维度 | 重点 | 比重 |
|----------|------|------|
| Spring 生态（AOP/MVC/事务/Starter） | 原理深度 + 踩坑经验 | 40% |
| 分布式中间件（Redis 锁/Dubbo/MQ） | 选型考量 + 可靠性保证 | 35% |
| 项目实战 | 框架使用细节 + 问题解决能力 | 15% |
| 算法（滑动窗口） | 基础数据结构应用 | 10% |

**核心策略：**
- Spring 问题不要停留在"怎么用"，要讲"原理 + 源码实现 + 踩坑"
- 中间件问题要能讲出**对比分析**（为什么选A不选B）+ **异常场景处理**（宕机/丢失/重复）
- 算法要讲清楚**思路推导过程**，不要闷头直接写

**已有相关面试资料：**
- [百度后端 Java 终面面经](./baidu-java-backend-final-round.md)（高并发/短链接/分布式定时任务/Kafka/Spring Cloud）— 二面偏 Spring 原理，终面偏系统设计，互补复习