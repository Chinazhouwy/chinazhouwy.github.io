---
title: "SSE + Redis 渐进式异步数据加载方案"
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
summary: "SSE + Redis 渐进式异步数据加载方案"
tags:
---

# SSE + Redis 渐进式异步数据加载方案

> 来源：微信公众号
> 链接：[https://mp.weixin.qq.com/s/ggVC1-UTd6v7Nw3hgNdk5w](https://mp.weixin.qq.com/s/ggVC1-UTd6v7Nw3hgNdk5w)
> 类型：📚 参考资料（非面试题/面经）—— SSE + Redis 异步数据处理系统设计
> 相关：第106题(SSE/WebSocket/流式输出)、第92题(日志高并发落盘)、第33题(秒杀系统)
> 整理时间：2026-06-28

---

## 核心特性

- **异步任务生成**：虚拟线程异步生产数据
- **实时流式传输**：SSE 协议逐行推送数据
- **断点重连**：基于 offset 的消费位点记录
- **状态机管理**：生产/消费双状态机精确控制
- **Redis 持久化**：任务状态、消息队列、消费进度全持久化

---

## 架构设计

### 核心组件

| 组件 | 职责 |
|------|------|
| SseController | 提供 REST API：创建任务、建立 SSE 连接 |
| TaskStateService | 管理任务生命周期、操作 Redis、协调生产消费 |
| TaskStateMachine | 定义生产/消费/任务三种状态枚举 |
| Redis | 持久化消息队列、状态标识、消费位点、统计数据 |

---

## 状态机设计

### 生产者状态机

| 状态 | 说明 | 触发条件 |
|------|------|---------|
| INIT | 未开始生产 | 任务创建前 |
| PRODUCING | 生产中，可追加数据 | `createTask()` 后 |
| PRODUCE_DONE | 生产完成，不再有新数据 | 所有数据写入完成后 |

### 消费者状态机

| 状态 | 说明 | 触发条件 |
|------|------|---------|
| INIT | 未开始消费 | 任务创建时初始化 |
| CONSUMING | 消费中 | 客户端连接并读取数据 |
| CONSUME_DONE | 消费完成 | offset >= totalCount 且生产已完成 |

### 任务整体状态

| 状态 | 判定逻辑 |
|------|---------|
| ACTIVE | 生产或消费进行中 |
| COMPLETED | 生产完成 && 消费完成 |
| FAILED | 生产完成但消费者超过 5 分钟无活动 |

---

## 断点重连机制

核心原理：消费位点（offset）持久化在 Redis 中，客户端重连时从上次位置继续。

```java
// 1. 获取当前消费位点
long offset = stateService.getCurrentOffset(taskId);

// 2. 只消费未读数据
while (offset < total) {
    List<String> messages = stateService.consumeMessages(taskId, 100);
    // ... 发送消息并更新 offset
}

// 3. 消费方法内部自动更新 offset
redisTemplate.opsForValue().set(CONSUME_OFFSET_KEY + taskId, String.valueOf(newOffset));
```

---

## Redis 数据结构设计

| Key 模式 | 类型 | 说明 | 示例 |
|----------|------|------|------|
| `task:produce:status:{taskId}` | String | 生产者状态 | PRODUCING |
| `task:consume:status:{taskId}` | String | 消费者状态 | CONSUMING |
| `task:queue:{taskId}` | List | 消息队列 | ["msg-0", "msg-1"] |
| `task:consume:offset:{taskId}` | String | 当前消费位点 | "50" |
| `task:total:count:{taskId}` | String | 总数据量 | "100" |
| `task:produce:time:{taskId}` | String | 最后生产时间戳 | "1717747200000" |
| `task:consume:time:{taskId}` | String | 最后消费时间戳 | "1717747201000" |

### 数据流转示意

```
初始状态:
  task:queue:abc123          → []
  task:produce:status:abc123 → "PRODUCING"
  task:consume:offset:abc123 → "0"
  task:total:count:abc123    → "0"

生产 3 条消息后:
  task:queue:abc123          → ["msg-0", "msg-1", "msg-2"]
  task:total:count:abc123    → "3"

消费 2 条后:
  task:consume:offset:abc123 → "2"

生产完成:
  task:produce:status:abc123 → "PRODUCE_DONE"

消费完成:
  task:consume:status:abc123 → "CONSUME_DONE"
  (触发 completeTask 清理所有 key)
```

---

## API 设计

### 创建任务
```
GET /api/task/create?userId=user123
响应: {"taskId": "a1b2c3d4-..."}
```

### SSE 数据流
```
GET /api/task/stream?taskId=xxx
Accept: text/event-stream

响应:
id: 0
data: message-0

id: 1
data: message-1
...
data: [DONE]
```

---

## 异常处理

| 场景 | 超时时间 | 处理方式 |
|------|---------|---------|
| SSE 连接超时 | 300 秒 | new SseEmitter(300_000L) |
| 等待数据超时 | 60 秒 (30次×2秒) | 重置计数器，继续等待 |
| 消费停滞检测 | 300 秒 | 标记任务为 FAILED |

### 幂等性保证

- **消费位点更新**：每次消费后立即更新 offset，即使客户端未收到消息也不会重复消费
- **状态转换**：使用枚举状态机，避免非法状态转换
- **生产锁**：addMessage 检查 PRODUCING 状态，防止生产完成后继续写入

---

## 性能优化建议

| 问题 | 影响 | 优化方案 |
|------|------|---------|
| 轮询间隔 2 秒 | 延迟较高 | 改为 Redis BLPOP 阻塞读取 |
| 批量大小固定 | 小数据量浪费，大数据量慢 | 动态调整 batchSize |
| 虚拟线程无限制 | 可能耗尽资源 | 添加线程池限流 |
| 无消息过期 | Redis 内存泄漏 | 设置 TTL 或定期清理 |

**使用 Redis 阻塞读取替代轮询：**
```java
String msg = redisTemplate.opsForList()
    .leftPop(MESSAGE_QUEUE_PREFIX + taskId, 5, TimeUnit.SECONDS);
if (msg != null) {
    emitter.send(SseEmitter.event().data(msg));
}
```

---

## 适用场景

**✅ 适合：**
- 大数据量导出（Excel/CSV）
- 日志实时查看
- AI 流式响应
- 报表渐进式加载

**❌ 不适合：**
- 需要客户端主动推送数据（应选 WebSocket）
- 超低延迟要求（<100ms，应选 UDP 或专用协议）
- 二进制大数据传输（应选分片下载）
