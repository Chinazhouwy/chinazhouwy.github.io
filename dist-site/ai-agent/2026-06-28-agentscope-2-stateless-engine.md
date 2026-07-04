# AgentScope(Java)2.0 无状态引擎 + AgentState：多租户会话管理

> 来源：AgentScope 官方公众号
> 链接：[https://mp.weixin.qq.com/s/DZZJDHykKvg-e8e2TFnINA](https://mp.weixin.qq.com/s/DZZJDHykKvg-e8e2TFnINA)
> 类型：📚 参考资料（非面试题/面经）—— AgentScope 2.0 多租户状态管理
> 相关：第40题(Harness)、第100题(多Agent协作)、第201-216题(A2A/沙箱/权限)
> 整理时间：2026-06-28

---

## 核心设计：Agent ≠ 会话

**Agent 是无状态引擎，AgentState 才是会话。**

```
一个 HarnessAgent 实例只持有不可变配置：
  - system prompt
  - 模型
  - 工具集
  - 中间件链

所有用户可变数据 → AgentState 对象
按 (userId, sessionId) 二元组索引
```

```java
// 同一个 agent 实例，服务不同用户
agent.call(msg, RuntimeContext.builder()
    .userId("alice").sessionId("s1").build()).block();

agent.call(msg, RuntimeContext.builder()
    .userId("bob").sessionId("s2").build()).block();
// 完全并行，状态不串
```

**不需要注册表，不需要 per-user 实例池。**

---

## AgentState 里装了什么

| 字段 | 说明 | 持久化？ |
|------|------|---------|
| `getContext()` | 当前对话历史（用户输入、assistant回复、工具调用、工具结果） | ✅ |
| `getSummary()` | 上下文压缩后的摘要 | ✅ |
| `getPermissionContext()` | 工具权限规则 | ✅ |
| `getPlanModeContext()` | Plan Mode 是否激活、计划文件路径 | ✅ |
| `getTasksContext()` | todo_write 维护的任务清单 | ✅ |
| `getToolContext()` | 工具组激活状态 | ✅ |
| `InterruptControl` | per-session 中断信号 | ❌ transient，不序列化 |
| `shutdownInterrupted` | 优雅停机中断标记 | ✅ |

**瞬态字段设计考量**：`InterruptControl` 标记 `@JsonIgnore transient`，故障转移时不把上一台机器的中断状态带过去，避免状态漂移。

---

## 一次 call() 的完整链路

```
call(msgs, RuntimeContext(userId, sessionId))
  │
  ├─ per-session 门: 同 (uid, sid) 串行, 不同会话并行
  │
  ▼
  从缓存或 stateStore 加载 AgentState
  │   注入到 RuntimeContext: rc.setAgentState(state)
  │
  ▼
  推理循环
  │   中间件就地改写 state.contextMutable()
  │   (压缩、Plan、todo_write、权限调整……都在改它)
  │
  ▼
  保存 AgentState
  │   stateStore.save(userId, sessionId, "agent_state", state)
  │
  ▼
  返回结果
```

状态存储不在每条消息后落盘，而是 **call 结束时整体写入**，对后端吞吐压力很低。

---

## 状态存储实现

内置四种实现，构造期切换：

| 实现 | 模块 | 适用场景 |
|------|------|---------|
| `InMemoryAgentStateStore` | core | 单测、演示（进程退出全丢） |
| `JsonFileAgentStateStore` | core | 单机开发，文件落盘，不能跨节点 |
| `RedisAgentStateStore` | extensions-redis | **生产首选**，多副本共享 |
| `MysqlAgentStateStore` | extensions-mysql | 需要状态沉淀进关系型库（审计、报表） |

```java
// 单机：默认 JsonFile
HarnessAgent agent = HarnessAgent.builder()
    .name("MyAgent").model(model).workspace(workspace)
    .build();

// 生产：换 Redis
HarnessAgent agent = HarnessAgent.builder()
    .name("MyAgent").model(model).workspace(workspace)
    .distributedStore(RedisDistributedStore.fromJedis(jedis))
    .build();
```

**安全检查**：如果用了分布式文件系统（`SandboxFilesystemSpec`）但状态存储是单机的，`build()` 直接抛 `IllegalStateException`。

---

## 跨机器恢复（故障转移）

只要状态存储用 Redis，故障转移就是自动的：

```java
// 节点 A：Alice 聊了一会儿，节点 A 挂了
// 请求漂到节点 B
// 节点 B 第一次用同样的 (userId, sessionId) call()
// → 自动从 Redis 拉到节点 A 留下的 AgentState
agentB.call(nextMsg, RuntimeContext.builder()
    .sessionId("alice-001").userId("alice").build()).block();
```

用户体验：无感。Web UI 聊到一半切到 CLI 继续聊，`(userId, sessionId)` 一致就能续。

---

## Per-session 中断（精确杀会话）

传统做法 `interrupt()` 无参调用，整个 agent 停掉——多用户场景是灾难。

2.0 的 `InterruptControl` 是 per-session 的：

```java
// 只中断 Alice，Bob 不受影响
agent.interrupt("alice", "session-001");

// 还能注入消息
agent.interrupt("alice", "session-001",
    Msg.userMsg("请停下来做个总结。"));
```

推理循环在每次迭代前检查 `state.interruptControl().isInterrupted()`，被触发后进入 `handleInterrupt` 路径：保存状态、返回部分结果。

---

## 并发规则（三句话）

| 场景 | 行为 |
|------|------|
| 不同 `(userId, sessionId)` | **完全并行** |
| 相同 `(userId, sessionId)` | **per-session 异步门按 FIFO 串行**，无需外部锁 |
| `interrupt(userId, sessionId)` | **精确命中单个 session** |

---

## 面试价值

这个设计在面试里能直接回答两个问题：

**1. "多租户 Agent 怎么设计？"**
→ Agent 无状态 + AgentState 按 (uid, sid) 索引 + 状态存储可切换（Redis 生产级）

**2. "会话隔离怎么保证？"**
→ per-session 异步门 + 状态按 key 隔离 + InterruptControl 精确命中
