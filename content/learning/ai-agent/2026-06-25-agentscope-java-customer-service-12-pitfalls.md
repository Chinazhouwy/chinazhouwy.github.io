---
title: "我的AgentScope Java 客服项目，挖出12个生产级深坑"
date: "2026-06-25"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "我的AgentScope Java 客服项目，挖出12个生产级深坑"
tags:
---

# 我的AgentScope Java 客服项目，挖出12个生产级深坑

> 来源：微信公众号文章
> 链接：https://mp.weixin.qq.com/s/Ihtqsp68m1h66Ua12yV7kw
> 项目地址：https://github.com/liulangjietou/customer_work
> 类型：📚 参考资料（非面试题/面经）
> 提取日期：2026-06-25

---

## 一句话总结

生产级运行机制代码，隔的不是功能，是框架管不到的那一层：并发安全、内存边界、调用成本、召回质量、密钥与越权。

## 项目概况

基于 AgentScope Java 1.0.12 构建的智能客服系统：流式响应、多轮记忆、RAG知识库、MCP工具调用、HITL人工确认、Nacos提示词热更新、Micrometer可观测，99个Java文件，115个测试，全绿，约6644行代码。

## 🟢 做对了什么

1. **接口抽象分层干净**：Model、Knowledge、LongTermMemory 全部按 AgentScope 框架接口实现，内存版可无缝换成向量库或百炼
2. **重试写法正确**：`Flux.defer(...).retryWhen(Retry.backoff(...))` 每次重试重新发起底层调用，不是重订阅已失败的流
3. **优雅停机**：`GracefulShutdownService` 实现 `SmartLifecycle`，phase 设成 `Integer.MAX_VALUE-100`，晚启动早停止
4. **上下文压缩**：用 `AutoContextMemory` 控制多轮对话的 token 积累
5. **HITL 和可观测都有接入**

---

## 🔴 第一类坑：状态与并发（4个坑）

### P1：同会话 Agent 被并发请求共享，竞态污染上下文
- **位置**：`CustomerServiceService.java:47`、`154-167`、`chat():63-73`
- **问题**：每个 sessionId 对应一个 `ReActAgent` 实例存在 `ConcurrentHashMap` 中，同一 sessionId 的两个并发请求同时调用 `agent.call()`，拿到同一个 Java 对象引用，同时写记忆、改内部状态
- **后果**：记忆交错、上下文拼接、`ConcurrentModificationException`
- **修法**：per-session 串行锁/mailbox，同会话请求串行

### P2：热缓存无界，匿名会话每请求新建，必OOM
- **位置**：`CustomerServiceService.java:47`、Controller `resolveSessionId:142`
- **问题**：`sessionAgents` 无上限无 TTL 无 LRU；匿名会话生成 `anonymous-<UUID>` 每请求一个新 key
- **修法**：Caffeine 有界缓存 + TTL + 落盘回调；匿名会话不进热缓存

### P3：Reactive 线程里做阻塞 IO，吞吐塌方
- **位置**：`CustomerServiceService.java:155`、`AgentFactory.java:212,132`
- **问题**：`resolveAgent` 在 Reactor 链里被同步调用，内部含 `Files.createDirectories`、MCP configure 等阻塞操作，`computeIfAbsent` 还持有桶锁
- **修法**：Agent 创建移至 `subscribeOn(boundedElastic)`

### P4：意图识别污染对话历史（最隐蔽）
- **位置**：`CustomerServiceService.java:110-122`
- **问题**：意图识别调用 `resolveAgent(sessionId)` 拿到同一个会话 agent，分类 prompt 写进了用户真实对话历史
- **修法**：意图识别用独立无状态 agent

### P12：持久化 fire-and-forget，cancel 丢状态，双轨并存
- **位置**：`CustomerServiceService.java:170-178`、`chatStream():95`
- **问题**：异步发射无重试无背压；`doOnComplete` 不覆盖 cancel；`SessionStateManager.java` 未被使用
- **修法**：用 `doFinally` 替 `doOnComplete`，持久化和会话写串行，全项目走单一路径

---

## 💰 第二类坑：模型层的钱和正确性（3个坑）

### P5：流式 fallback 在中途切换，输出重复错乱
- **位置**：`FallbackChatModel.java:36-42`
- **问题**：`onErrorResume` 在错误信号到达时才生效，主模型可能已吐出前半段，用户看到重复错乱文字
- **修法**：`switchOnFirst` — 首 token 到达说明主模型正常，后续不切换

### P6：重试不区分错误类型，4xx 也照重试烧钱
- **位置**：`ResilientChatModel.java:42`
- **问题**：没有 `.filter`，鉴权失败(401)、参数非法(400)全部进入退避重试循环，产生 3 倍 LLM 调用费
- **修法**：`.filter(this::isRetryable)` — 只重试 429/5xx/超时/连接异常

### P7：多Agent fanout 成本放大，无预算护栏
- **位置**：`MultiAgentOrchestrator.java:94-104`
- **问题**：consult 并行调 3 个专家 Agent，每次至少 3×LLM 调用，每次 consult 都 new 三个 Agent 无复用无超时无预算
- **成本对比**：
  - fanout-all: ≈0.15元/次, ≈1500元/天
  - 路由优先+兜底fanout: ≈0.02-0.06元/次, ≈200-600元/天

---

## 🟠 第三类坑：召回质量与记忆（2个坑）

### P8：RAG 和长期记忆是"字符重合度"伪语义检索
- **位置**：`LongTermMemoryStore.java:72`、`InMemoryKeywordKnowledge.java:101`
- **问题**：打分逻辑是把查询字符串去重统计字符出现次数，中文里单字重合太普遍，近似随机召回；且 O(n) 全量扫描
- **修法**：换向量库/BM25+中文分词；标注仅 demo

### P9：限流和记忆全进程内，多副本形同虚设
- **位置**：`LongTermMemoryStore.java:27`、`RateLimitWebFilter.java:32`
- **问题**：进程内限流 K 个副本 = K 倍额度；`windows` 只增不清无界 Map；固定窗口切换瞬间双倍突刺
- **修法**：限流换 Redis + Bucket4j；长期记忆外置

---

## 🔵 第四类坑：热更新一致性与安全（2个坑）

### P10：Nacos 提示词热更，存量会话不生效，无灰度
- **位置**：`NacosPromptService.java:74-78`、`AgentFactory.java:151`
- **问题**：热更只改 `cachedPrompt`，不触发已缓存 Agent 重建；无版本号、无灰度、无一键回滚
- **修法**：每轮从 `cachedPrompt` 读取 + 灰度比例 + 一键回滚

### P11：鉴权细节与会话越权（IDOR）
- **位置**：`ApiKeyAuthWebFilter.java:40-52`、`Controller:96,128`
- **问题**：5 个独立安全问题：
  1. 每请求 `new HashSet<>(apiKeys)` → GC 压力
  2. `contains` 非常量时间比较 → 时序侧信道
  3. Swagger 默认免鉴权 → 生产暴露 API
  4. interrupt/endSession 仅凭 sessionId → IDOR 越权
  5. 仅 dashscope 支持环境变量取 key → 其他厂商密钥易入库

---

## 📋 12个坑全景总表

| 编号 | 类别 | 核心位置 | 生产后果 | 严重度 |
|------|------|----------|----------|--------|
| P1 | 并发安全 | CustomerServiceService:47 | 上下文错乱、CME | 🔴高 |
| P2 | 内存泄漏 | :47 / Controller:142 | OOM | 🔴高 |
| P3 | 阻塞事件循环 | :155 / AgentFactory:212 | 吞吐断崖 | 🔴高 |
| P4 | 数据污染 | :110-122 | 对话记忆含分类噪声 | 🔴高 |
| P5 | 流式正确性 | FallbackChatModel:36 | 输出重复/错乱 | 🔴高 |
| P6 | 成本/稳定 | ResilientChatModel:42 | 4xx也重试，费用×3 | 🟠中高 |
| P7 | 成本放大 | MultiAgentOrchestrator:94 | 费用≥15× | 🟠中高 |
| P8 | 召回质量 | LongTermMemoryStore:72 | 答非所问+Token浪费 | 🟠中高 |
| P9 | 扩展性 | LongTermMemoryStore:27 | 限流失效、记忆丢失 | 🟡中 |
| P10 | 一致性 | NacosPromptService:74 | 存量用旧prompt | 🟡中 |
| P11 | 安全 | ApiKeyAuthWebFilter:40 | IDOR、Swagger暴露 | 🟡中 |
| P12 | 可靠性 | :170-178 | cancel丢状态 | 🟡中 |

---

## 🧭 上生产的12条 Checklist

1. **并发串行化**：每会话一把锁或单线程 mailbox
2. **缓存必须有界**：Caffeine 替裸 Map，加 maximumSize + expireAfterAccess + removalListener 落盘
3. **阻塞 IO 离开 Reactor 线程**：全部 subscribeOn(boundedElastic)
4. **意图识别用独立 Agent**：绝不复用会话 agent
5. **流式 fallback 只在首 token 前切**：switchOnFirst
6. **重试按错误类型过滤**：只重试 429/5xx/超时
7. **路由优先于 fanout**：先意图路由，命不中再 fanout + Token 预算
8. **生产必须替换伪语义召回**：最低 BM25+分词
9. **限流和记忆外置**：Redis 限流 + 外部存储
10. **提示词热更要灰度和回滚**：版本号 + 灰度比例 + 一键回滚
11. **鉴权和会话归属**：关 Swagger + 校验归属 + 常量时间比较
12. **持久化覆盖 cancel**：doFinally + 单轨 + 串行写
