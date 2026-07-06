---
title: "SSE + Redis Stream 渐进式异步数据加载方案（改进版）"
date: "2026-07-06"
domain: "学习"
area: "技术"
module: "参考资料"
project: ""
type: "技术资料"
status: "digested"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "SSE + Redis Stream 渐进式异步数据加载方案（改进版）"
tags:
---

# SSE + Redis Stream 渐进式异步数据加载方案（改进版）

> 适用：Java 21+，Redis 5.0+
> 优于原文章的 Redis List + offset 方案：自动 offset 跟踪、阻塞读取、消费者组、自动清理

---

## 整体架构

```
用户请求 → 创建任务 → 返回 taskId
              │
              ▼
      虚拟线程（生产者）
      每算出一条数据，XADD 到 Redis Stream
              │
              ▼
      ┌───────────────┐
      │ Redis Stream  │ ← 消息持久化，不断连
      │ task:xxx      │
      │ 消费者组      │
      └───────┬───────┘
              │ XREADGROUP BLOCK
              ▼
      虚拟线程（消费者）
      XREADGROUP 阻塞等待新消息
      拿到后 SSE 推送
```

---

## 一、依赖

```xml
<!-- Spring Boot Redis -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

---

## 二、核心代码

### 1. 控制器

```java
@RestController
@RequestMapping("/api/task")
public class TaskController {

    @Autowired
    private TaskService taskService;

    /** 创建异步任务，返回 taskId */
    @GetMapping("/create")
    public String createTask(@RequestParam String userId) {
        return taskService.createTask(userId);
    }

    /** SSE 订阅任务进度 */
    @GetMapping(path = "/stream/{taskId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable String taskId) {
        SseEmitter emitter = new SseEmitter(300_000L); // 5 分钟超时
        taskService.consume(taskId, emitter);
        return emitter;
    }
}
```

### 2. 服务层

```java
@Service
public class TaskService {

    // ==================== Redis Key 常量 ====================
    private static final String STREAM_PREFIX = "task:stream:";
    private static final String STATUS_PREFIX = "task:status:";
    private static final String GROUP_NAME = "sse-consumers";

    @Autowired
    private StringRedisTemplate redis;

    /** 创建任务 */
    public String createTask(String userId) {
        String taskId = UUID.randomUUID().toString().replace("-", "");

        // 初始化状态
        redis.opsForValue().set(STATUS_PREFIX + taskId, "PRODUCING");

        // 创建 Stream 和消费者组（幂等）
        try {
            redis.opsForStream().createGroup(STREAM_PREFIX + taskId, GROUP_NAME);
        } catch (Exception e) {
            // 组已存在是正常情况
        }

        // 异步启动生产者（虚拟线程，Java 21+）
        Thread.startVirtualThread(() -> produce(taskId));

        return taskId;
    }

    // ==================== 生产者 ====================

    /** 虚拟线程异步生产数据 */
    private void produce(String taskId) {
        try {
            int total = queryTotalCount(); // 你的业务：查出总数据量

            for (int i = 0; i < total; i++) {
                // ---- 你的业务逻辑开始 ----
                String data = doExpensiveWork(i); // 慢慢算
                // ---- 你的业务逻辑结束 ----

                // XADD 到 Redis Stream
                redis.opsForStream()
                    .add(STREAM_PREFIX + taskId,
                         Map.of("data", data, "index", String.valueOf(i)));

                // Stream 自动截断，只保留最近 5000 条（防内存泄漏）
                redis.opsForStream()
                    .trim(STREAM_PREFIX + taskId, 5000);

                // 更新总数（可选，用于前端进度条）
                redis.opsForValue()
                    .set(STATUS_PREFIX + taskId + ":total", String.valueOf(total));
            }

            // 标记生产完成
            redis.opsForValue().set(STATUS_PREFIX + taskId, "PRODUCE_DONE");
            // 发送一条特殊的结束消息
            redis.opsForStream()
                .add(STREAM_PREFIX + taskId,
                     Map.of("type", "DONE", "data", ""));

        } catch (Exception e) {
            redis.opsForValue().set(STATUS_PREFIX + taskId, "FAILED:" + e.getMessage());
            log.error("Produce failed: {}", taskId, e);
        }
    }

    // ==================== 消费者 ====================

    /** SSE 消费数据 */
    public void consume(String taskId, SseEmitter emitter) {
        // 虚拟线程异步消费，不阻塞 Tomcat 线程
        Thread.startVirtualThread(() -> {
            try {
                String status = redis.opsForValue().get(STATUS_PREFIX + taskId);

                // 如果任务不存在或已失败
                if (status == null) {
                    emitter.completeWithError(new RuntimeException("Task not found"));
                    return;
                }
                if (status.startsWith("FAILED")) {
                    emitter.send(SseEmitter.event()
                        .name("error")
                        .data(status));
                    emitter.complete();
                    return;
                }

                // 如果是已完成状态（PRODUCE_DONE），且已消费完，直接结束
                if ("PRODUCE_DONE".equals(status) && allConsumed(taskId)) {
                    emitter.send(SseEmitter.event().name("done").data(""));
                    emitter.complete();
                    return;
                }

                // 阻塞消费
                consumeLoop(taskId, emitter);

            } catch (Exception e) {
                emitter.completeWithError(e);
            }
        });
    }

    /** 阻塞消费循环 */
    private void consumeLoop(String taskId, SseEmitter emitter) throws IOException {
        while (true) {
            // XREADGROUP BLOCK 5 秒，阻塞等待新消息
            List<MapRecord<String, Object, Object>> records = redis
                .opsForStream()
                .read(
                    Consumer.from(GROUP_NAME, "consumer-1"),
                    StreamReadOptions.empty()
                        .block(Duration.ofSeconds(5))   // 阻塞 5 秒
                        .count(10),                      // 一次最多取 10 条
                    StreamOffset.create(
                        STREAM_PREFIX + taskId,
                        ReadOffset.lastConsumed())       // 从上次断点继续
                );

            if (records == null || records.isEmpty()) {
                // 没新数据，检查是否生产已完成
                String status = redis.opsForValue()
                    .get(STATUS_PREFIX + taskId);
                if ("PRODUCE_DONE".equals(status) && allConsumed(taskId)) {
                    emitter.send(SseEmitter.event().name("done").data(""));
                    emitter.complete();
                    return;
                }
                continue; // 还有数据，继续等
            }

            for (var record : records) {
                Map<Object, Object> value = record.getValue();

                // 检查结束消息
                if ("DONE".equals(value.get("type"))) {
                    emitter.send(SseEmitter.event().name("done").data(""));
                    emitter.complete();
                    // XACK 确认消费
                    redis.opsForStream()
                        .acknowledge(GROUP_NAME, record);
                    return;
                }

                // 推送数据到 SSE
                emitter.send(SseEmitter.event()
                    .name("message")
                    .data(value.get("data").toString()));

                // XACK 确认：只有推送成功才确认消费
                redis.opsForStream()
                    .acknowledge(GROUP_NAME, record);
            }
        }
    }

    /** 检查是否所有消息都已消费 */
    private boolean allConsumed(String taskId) {
        StreamInfo.XInfoStream info = redis.opsForStream()
            .info(STREAM_PREFIX + taskId);
        StreamInfo.XInfoGroup group = redis.opsForStream()
            .groups(STREAM_PREFIX + taskId)
            .stream()
            .filter(g -> GROUP_NAME.equals(g.groupName()))
            .findFirst()
            .orElse(null);
        if (group == null) return true;
        return group.pendingCount() == 0 && group.streamSize() == 0;
    }

    // ==================== 你的业务逻辑 ====================

    private int queryTotalCount() {
        // TODO: 你的数据查询
        return 100;
    }

    private String doExpensiveWork(int index) {
        // TODO: 你的耗时操作
        return "data-" + index;
    }
}
```

### 3. 前端示例（JavaScript）

```javascript
// 1. 创建任务
const res = await fetch('/api/task/create?userId=user123');
const taskId = await res.text();

// 2. SSE 接收
const evtSource = new EventSource(`/api/task/stream/${taskId}`);

evtSource.addEventListener('message', (e) => {
    console.log('收到数据:', e.data);
    // 更新 UI
});

evtSource.addEventListener('done', () => {
    console.log('全部完成');
    evtSource.close();
});

evtSource.addEventListener('error', (e) => {
    console.error('SSE 错误', e);
    // 3 秒后自动重连（浏览器自带 EventSource 重连）
});
```

---

## 三、跟原文章的对比

| 维度 | 原方案（List + offset） | 改进方案（Stream） |
|------|----------------------|------------------|
| 读取方式 | `Thread.sleep(2000)` 轮询 | `XREADGROUP BLOCK 5s` **阻塞等** |
| 消费进度 | 手动维护 offset `set("consume:offset", ...)` | Redis **自动跟踪** |
| 断点续传 | 重连读 offset，可能重复 | `lastConsumed()` **精确续传** |
| 消息确认 | 更新 offset 就算确认（可能丢） | `XACK` **确认后才算消费** |
| 消息清理 | 从不清理（内存泄漏） | `XTRIM` **自动截断** |
| 多消费者 | 自己实现 | **原生消费者组** |

---

## 四、生产注意事项

### 4.1 Stream 清理

```java
// 生产完成后，延迟清理 Stream
produceDone(taskId);
redis.expire(STREAM_PREFIX + taskId, Duration.ofHours(24));
redis.expire(STATUS_PREFIX + taskId, Duration.ofHours(24));
```

### 4.2 超时与重试

```java
// SSE 超时断开后，浏览器 EventSource 会自动重连
// 服务端在 consumeLoop 中通过 lastConsumed() 从断点续传

// 如果消费者挂了，XACK 未确认的消息会变成 Pending
// 可以通过 XPENDING 检查并重新分配
```

### 4.3 取消任务

```java
// 提供一个取消接口
@GetMapping("/cancel/{taskId}")
public void cancel(@PathVariable String taskId) {
    redis.opsForValue().set(STATUS_PREFIX + taskId, "CANCELLED");
    // 生产者线程需定期检查状态
}
```

---

## 五、什么时候用这个方案

**✅ 适合：**
- 数据导出（Excel/CSV/PDF）
- 批量处理（批量导入/审核）
- AI Agent 流式输出（RAG 检索结果逐步推）
- 报表渐进式加载
- 任何超过 5 秒的耗时操作

**❌ 不适合：**
- 需要双向通信（用 WebSocket）
- 超低延迟 <100ms（用 TCP 直连）
- 大文件传输（用分片下载）
