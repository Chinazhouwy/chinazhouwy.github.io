---
title: "Agent Harness 工程实战指南"
date: "2026-07-06"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "Agent Harness 工程实战指南"
tags:
---

# Agent Harness 工程实战指南

> 类型：📚 参考资料（非面试题/面经）
> 来源：面试讨论整理 + AgentScope/DeepSeek/Hermes Agent 实践
> 日期：2026-07-01

---

## 一、Harness 到底是什么

```
Model + Harness = Agent

Harness = 把模型包起来变成可运行产品的工程外壳
```

模型只是能力内核。Harness 负责让模型"能用、好用、可控、可度量"。

**一句话理解：** 如果模型是发动机，Harness 就是整辆车——方向盘（工具调用）、仪表盘（观测）、安全带（权限）、导航（上下文管理）。

---

## 二、Harness 的八大模块

### 1. 工具管理（Tool Management）

```
之前：Function Calling → 模型自己推理调哪个工具、传什么参数
现在：MCP 协议 → 标准化工具注册和调用
未来：Skills → 不只注册工具，还注册执行流程和坑点
```

**工程实践：**

```java
// 旧方式：工具定义写在 Prompt 里
// 问题：模型经常传错参数、调错工具

// MCP 方式：工具按协议注册
// 问题：模型知道有什么工具，但不知道怎么用

// Skills 方式：工具 + 执行流程 + 坑点
// 比如 Redis 分布式锁的 Skill：
//   触发条件：需要加锁
//   步骤：SET NX EX → 释放前校验 UUID → 用 Redisson WatchDog
//   坑点：主从切换会丢锁、大Key阻塞
//   验证：检查返回值、监控锁持有时间
```

**选型建议：**

| 场景 | 推荐 |
|------|------|
| 工具少、逻辑简单 | Function Calling 够用 |
| 工具多、需要跨平台 | MCP 协议 |
| 工程经验需要沉淀 | Skills（生产推荐） |

### 2. 上下文管理（Context Engineering）

```
核心问题：模型的上下文窗口有限，塞太多会"忘记"关键信息
```

**三层上下文：**

| 层 | 内容 | 策略 |
|----|------|------|
| 系统提示 | 角色定义、规则、工具说明 | 固定，不压缩 |
| 对话历史 | 用户和 Agent 的对话 | 滑动窗口 + 摘要压缩 |
| 工具结果 | 工具返回的数据 | 按相关性裁剪 |

**工程踩坑：**

```
坑1：对话太长导致"注意力稀释"
  → 解决：每 10 轮做一次摘要，保留关键信息

坑2：工具返回结果太大（比如查数据库返回 1000 行）
  → 解决：工具层做裁剪，只返回模型需要的字段

坑3：系统提示太长挤占了对话空间
  → 解决：系统提示精简到 500 token 以内，详细规则放到 Skill 文件里按需加载
```

### 3. 记忆管理（Memory）

```
短期记忆：当前会话的对话历史（Redis / 内存）
长期记忆：跨会话的用户偏好、历史交互（向量库 + SQLite）
摘要记忆：历史对话的压缩版本（定期生成）
```

**工程实践：**

```
// 短期记忆：会话级，自动过期
session_key = f"session:{user_id}:{session_id}"
redis.setex(session_key, 3600, json.dumps(messages))

// 长期记忆：用户级，持久化
// 重要偏好写入 SQLite，不依赖向量检索
INSERT INTO user_preferences (user_id, key, value) ...

// 向量记忆：语义检索用
// 存储对话片段的 embedding，检索时用余弦相似度
vector_store.upsert(embedding, metadata={"user_id": uid, "topic": "redis"})
```

### 4. 权限管理（Auth）

```
三层权限：
  ① 谁能用这个 Agent（接入层：API Key / OAuth）
  ② Agent 能调哪些工具（工具层：白名单 / RBAC）
  ③ Agent 能操作哪些数据（数据层：租户隔离）
```

**工程踩坑：**

```
坑1：Agent 拿到用户的 API Key 去调第三方服务
  → 解决：Agent 不持有用户凭证，通过后端代理调用

坑2：多租户场景下 Agent 读到别人的数据
  → 解决：RuntimeContext 强制注入 tenant_id，查询自动加过滤条件

坑3：Agent 能执行危险操作（删库、发邮件）
  → 解决：高危操作必须人工审批，Agent 只能"建议"
```

### 5. 沙箱（Sandbox）

```
用途：Agent 执行代码、调用外部资源时的隔离环境

方式：
  ① Docker 容器：完全隔离，资源可控
  ② 进程级隔离：轻量，但安全性低
  ③ 语言级沙箱：Python 的 RestrictedPython，Java 的 SecurityManager
```

**工程实践：**

```java
// Agent 执行用户提供的代码
// 必须在沙箱里跑，不能直接 Runtime.exec()

// Docker 沙箱示例
String containerId = dockerClient.createContainer()
    .image("python:3.11-slim")
    .memory(256 * 1024 * 1024)  // 限制 256MB
    .networkDisabled(true)       // 禁用网络
    .build();
dockerClient.exec(containerId, "python", userCode);
```

### 6. 评测（Eval）

```
评测 ≠ 测试
测试：这段代码对不对
评测：这个 Agent 做得好不好
```

**评测指标：**

| 指标 | 怎么测 | 合格线 |
|------|--------|--------|
| 任务成功率 | 给 100 个任务，看完成多少 | > 85% |
| 工具调用准确率 | 该调 A 有没有调 B | > 90% |
| 幻觉率 | 回答中有多少是编的 | < 5% |
| 平均延迟 | 端到端响应时间 | < 3s |
| 用户满意度 | 人工评分 / 投诉率 | > 4.0/5 |

**Badcase 闭环：**

```
收集 → 分类 → 修复 → 验证 → 沉淀

① 收集：线上日志自动标记 + 人工抽检
② 分类：检索问题 / 推理问题 / 工具问题 / Prompt 问题
③ 修复：针对性优化（改 Prompt、更新 Skill、调整检索策略）
④ 验证：修复后的 Badcase 重新跑一遍
⑤ 沉淀：写入 Skill（下次同类问题自动处理）+ 加入评测集
```

### 7. 观测（Observability）

```
Agent 的黑盒问题：模型输出不确定，出了问题很难排查

观测三件套：
  Trace：完整调用链路（哪个工具被调了、传了什么参数、返回了什么）
  Metrics：延迟、token 消耗、工具调用成功率
  Logs：关键节点的日志
```

**工程实践：**

```java
// 每次请求生成 trace_id，贯穿全链路
String traceId = UUID.randomUUID().toString();

// 工具调用记录
log.info("[{}] tool={} input={} output={} latency={}ms",
    traceId, toolName, input, output, latency);

// LangSmith 自动采集（如果用 LangChain/LangGraph）
// 环境变量即可
// LANGSMITH_TRACING=true
// LANGSMITH_API_KEY=xxx
// LANGSMITH_PROJECT=my-agent
```

### 8. 反馈闭环（Feedback Loop）

```
Agent 不是一次性产品，需要持续迭代

反馈来源：
  ① 用户显式反馈（点赞/点踩）
  ② 用户隐式反馈（重新提问 = 不满意、放弃对话 = 失望）
  ③ 系统自动检测（响应超时、工具失败、幻觉标记）

闭环流程：
  收集反馈 → 分析原因 → 优化（Prompt/Skill/工具）→ 发布 → 监控效果
```

---

## 三、Harness 架构选型

### 方案 A：全用 Framework（适合快速验证）

```
Spring AI / AgentScope / LangGraph
  + 框架内置的工具管理、上下文管理
  + 自定义 Eval
  + 云服务观测（LangSmith / Langfuse）

优点：开发快，框架帮你处理很多底层问题
缺点：定制性差，框架升级可能破坏兼容性
```

### 方案 B：半自建（适合生产环境）

```
Agent Framework（执行引擎）+ 自建模块
  + 上下文管理自己做（RuntimeContext 隔离）
  + 记忆用 Redis + 向量库
  + 权限在网关层统一拦截
  + 评测用自定义框架
  + 观测用 LangSmith / ELK

优点：灵活，各模块可以独立演进
缺点：开发量大，需要团队有工程能力
```

### 方案 C：全自建（适合大厂/核心业务）

```
完全自研 Harness
  + 自研执行引擎
  + 自研工具协议
  + 自研评测平台
  + 自研观测系统

优点：完全可控，深度优化
缺点：投入巨大，需要专门团队
```

---

## 四、MCP → Skills 演进实战

### 阶段 1：Function Calling（纯模型推理）

```java
// 工具定义写在 Prompt 里
String systemPrompt = """
你可以使用以下工具：
1. search(query) - 搜索信息
2. calculate(expression) - 计算
请根据用户问题选择合适的工具。
""";

// 问题：模型经常传错参数、调错工具、不知道执行顺序
```

### 阶段 2：MCP 协议（标准化工具连接）

```java
// 工具按 MCP 协议注册
ServerMcpTransport transport = new StdioServerTransport();
McpServer.builder(transport)
    .tool(new Tool("redis_set", "设置Redis键值", schema))
    .tool(new Tool("redis_get", "获取Redis值", schema))
    .build();

// 改善：工具描述更标准化
// 问题：模型还是不知道执行顺序和踩坑点
```

### 阶段 3：Skills（流程+坑点+最佳实践）

```markdown
# Redis 分布式锁 Skill

## 触发条件
需要并发控制、防止超卖、订单防重复

## 执行步骤
1. 加锁：SET lock:{key} {uuid} NX EX 30
2. 执行业务逻辑
3. 释放锁：Lua 脚本校验 uuid 后再删除

## 坑点
- 主从切换可能丢锁 → 业务必须做幂等
- 不要用 SETNX + EXPIRE 两条命令 → 不原子
- Redisson WatchDog 只解决锁过期，不解决主从切换

## 验证
- 检查加锁返回值
- 监控锁持有时间
- 业务唯一索引兜底
```

**效果：** Badcase 从 15% 降到 3%

---

## 五、生产环境 Checklist

```
□ 工具管理：MCP/Skills 注册完毕，工具描述准确
□ 上下文：系统提示 < 500 token，对话有摘要压缩
□ 记忆：短期/长期/摘要分层，用户偏好持久化
□ 权限：三层权限（接入/工具/数据），高危操作需审批
□ 沙箱：代码执行在 Docker 容器内，资源有限制
□ 评测：任务成功率 > 85%，幻觉率 < 5%
□ 观测：全链路 Trace，关键节点有日志
□ 反馈闭环：Badcase 收集 → 分类 → 修复 → 沉淀为 Skill
□ 灰度发布：新版本先 10% 流量验证
□ 告警：响应超时、工具失败率、幻觉率异常告警
```

---

## 六、一句话总结

> **Harness 不是某一个技术，而是"让模型能用、好用、可控、可度量"的所有工程工作的总和。** 生产环境不要只盯着模型能力，Harness 才是 Agent 能不能落地的关键。
