---
title: "SSE + Redis Stream：基于事件 ID 的断线续传方案"
date: "2026-07-06"
createdAt: "2026-06-28"
importedAt: "2026-07-06"
domain: "学习"
area: "工程与架构"
module: "参考资料"
project: ""
type: "技术资料"
status: "digested"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "使用 Redis Stream ID 对齐 SSE Last-Event-ID，实现可重放、可过期的单向流式任务；说明消费者组不适合浏览器广播的原因。"
tags:
  - "SSE"
  - "Redis Stream"
  - "断线重连"
  - "Spring Boot"
---

# SSE + Redis Stream：基于事件 ID 的断线续传方案

> 适用：Java 21+、Spring Boot 3、Redis 5.0+
>
> 核心原则：Redis Stream 负责保存事件，SSE 的 `id` 直接使用 Redis Stream ID。

---

## 一、先纠正一个常见误区

消费者组适合“多个后端 Worker 竞争处理一批消息”，不适合“多个浏览器都要看到同一条
任务流”：

- 同一消费者组会在消费者之间分摊消息，而不是广播。
- `ReadOffset.lastConsumed()` 表示组级消费进度，不等于某个浏览器已经渲染到哪里。
- 未确认消息会进入 Pending Entries List，重连后还涉及原消费者、`XAUTOCLAIM`
  和重复处理。
- 多个连接共用固定 consumer 名称，会让连接之间相互影响。

浏览器断线续传更直接的做法是：

1. 生产者把事件写入 Redis Stream。
2. 服务端把 Redis Stream ID 写入 SSE 的 `id` 字段。
3. 浏览器断线重连时发送 `Last-Event-ID`。
4. 服务端从该 ID 之后继续 `XREAD`。

这是一条“每个订阅者都有独立游标”的广播式读取链路，不需要 `XACK`。

---

## 二、整体链路

```text
POST /api/tasks
  └─ 创建 taskId，异步执行任务
       └─ XADD task:stream:{taskId} data=...
       └─ XADD task:stream:{taskId} type=DONE

GET /api/tasks/{taskId}/events
  ├─ 首次连接：从 0-0 开始读
  ├─ 断线重连：从 Last-Event-ID 之后读
  └─ 每条 SSE：id = Redis Stream ID
```

Redis Stream 是有限保留的重放日志，不是永久消息仓库。任务结果如果需要长期保存，
仍应写数据库或对象存储。

---

## 三、接口设计

### 1. 创建任务

创建任务属于有副作用的操作，应使用 `POST`，不要用可被缓存或预取的 `GET`。

```java
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping
    public Map<String, String> create(@RequestBody CreateTaskRequest request) {
        String taskId = taskService.create(request);
        return Map.of("taskId", taskId);
    }

    @GetMapping(
        path = "/{taskId}/events",
        produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter events(
        @PathVariable String taskId,
        @RequestHeader(value = "Last-Event-ID", required = false)
        String lastEventId
    ) {
        return taskService.subscribe(taskId, lastEventId);
    }
}
```

生产环境还必须校验“当前用户是否有权读取该 taskId”，随机 ID 不能代替鉴权。

### 2. 生产事件

```java
private static final String STREAM_PREFIX = "task:stream:";
private static final String STATUS_PREFIX = "task:status:";

private void produce(String taskId) {
    String streamKey = STREAM_PREFIX + taskId;
    try {
        for (int index = 0; index < queryTotalCount(); index++) {
            String data = doExpensiveWork(index);
            redis.opsForStream().add(
                streamKey,
                Map.of(
                    "type", "DATA",
                    "index", Integer.toString(index),
                    "data", data
                )
            );
        }

        redis.opsForValue().set(STATUS_PREFIX + taskId, "DONE");
        redis.opsForStream().add(
            streamKey,
            Map.of("type", "DONE", "data", "")
        );
        expireTask(taskId, Duration.ofHours(24));
    } catch (Exception ex) {
        redis.opsForValue().set(STATUS_PREFIX + taskId, "FAILED");
        redis.opsForStream().add(
            streamKey,
            Map.of("type", "ERROR", "message", safeMessage(ex))
        );
        expireTask(taskId, Duration.ofHours(24));
    }
}
```

`DONE` 和 `ERROR` 也要进入 Stream。只写一个独立状态键会产生竞态：客户端可能看到
任务已完成，却还没读到最后一批事件。

### 3. 从游标后继续读取

```java
public SseEmitter subscribe(String taskId, String lastEventId) {
    verifyTaskOwner(taskId);

    SseEmitter emitter = new SseEmitter(5 * 60_000L);
    AtomicBoolean closed = new AtomicBoolean(false);
    emitter.onCompletion(() -> closed.set(true));
    emitter.onTimeout(() -> closed.set(true));
    emitter.onError(error -> closed.set(true));

    String cursor = normalizeCursor(lastEventId); // 首次连接返回 "0-0"
    Thread.startVirtualThread(
        () -> consumeFromCursor(taskId, cursor, emitter, closed)
    );
    return emitter;
}

private void consumeFromCursor(
    String taskId,
    String initialCursor,
    SseEmitter emitter,
    AtomicBoolean closed
) {
    String streamKey = STREAM_PREFIX + taskId;
    String cursor = initialCursor;

    try {
        while (!closed.get()) {
            List<MapRecord<String, Object, Object>> records =
                redis.opsForStream().read(
                    StreamReadOptions.empty()
                        .block(Duration.ofSeconds(15))
                        .count(100),
                    StreamOffset.create(
                        streamKey,
                        ReadOffset.from(cursor)
                    )
                );

            if (records == null || records.isEmpty()) {
                continue;
            }

            for (MapRecord<String, Object, Object> record : records) {
                cursor = record.getId().getValue();
                Map<Object, Object> value = record.getValue();
                String type = String.valueOf(value.get("type"));

                emitter.send(
                    SseEmitter.event()
                        .id(cursor)
                        .name(type.toLowerCase(Locale.ROOT))
                        .data(value)
                );

                if ("DONE".equals(type) || "ERROR".equals(type)) {
                    emitter.complete();
                    return;
                }
            }
        }
    } catch (IOException clientDisconnected) {
        closed.set(true);
    } catch (Exception ex) {
        if (!closed.get()) {
            emitter.completeWithError(ex);
        }
    }
}
```

Spring Data Redis 的 `ReadOffset.from(cursor)` 表示读取该 ID 之后的消息。不要在独立
读取模式里使用 `ReadOffset.latest()` 轮询，否则两次读取之间到达的消息可能被跳过。

---

## 四、浏览器端

```javascript
const response = await fetch("/api/tasks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ reportDate: "2026-07-31" }),
});
const { taskId } = await response.json();

const source = new EventSource(`/api/tasks/${taskId}/events`);

source.addEventListener("data", (event) => {
  console.log("stream id:", event.lastEventId);
  render(JSON.parse(event.data));
});

source.addEventListener("done", () => {
  source.close();
});

source.addEventListener("error", () => {
  // EventSource 会自动重连；服务端会收到 Last-Event-ID。
  // 这里不要主动创建第二个 EventSource，避免重复连接。
});
```

服务端必须给每条事件设置 `id`，否则浏览器没有可靠游标，自动重连只能重新建立连接，
不能保证从正确位置继续。

---

## 五、保留、截断与“游标过旧”

Stream 必须设置保留策略，但不能在每次写入后无条件截断为很小的长度：

- 慢客户端还没读到的事件可能被删掉。
- 重连携带的 `Last-Event-ID` 可能早于当前第一条消息。
- 一旦发生截断，就不能再声称“无损续传”。

建议按任务设置 TTL，并结合容量上限：

```java
private void expireTask(String taskId, Duration retention) {
    redis.expire(STREAM_PREFIX + taskId, retention);
    redis.expire(STATUS_PREFIX + taskId, retention);
}
```

若需要 `MAXLEN` 控制内存，应在订阅前比较客户端游标与 Stream 的首条 ID。游标过旧时
返回明确的 `reset` 事件，让客户端重新拉取数据库快照，而不是静默漏数据。

---

## 六、生产检查清单

| 风险 | 处理方式 |
|---|---|
| 越权订阅 | taskId 绑定 userId，每次订阅都鉴权 |
| 重复渲染 | 前端按 Stream ID 去重，业务写入本身保持幂等 |
| 客户端断开后线程未停 | `onCompletion/onTimeout/onError` 置关闭标记，阻塞读取设置有限超时 |
| 服务重启 | 事件仍在 Redis，重连按 `Last-Event-ID` 继续 |
| Stream 被截断 | 检测游标是否早于首条记录，触发快照重置 |
| 任务取消 | 状态机标记 `CANCELLED`，生产者定期检查并写终止事件 |
| 代理缓冲 | Nginx 关闭 `proxy_buffering`，禁用会聚合响应的压缩或包装器 |
| 连接数过高 | 容量评估、心跳、超时、用户级连接上限 |

---

## 七、什么时候才使用消费者组

消费者组用于以下语义：

- 多个 Worker 分摊图片转码、账单计算、索引构建等后台任务。
- 需要 `XACK`、Pending Entries List、失败接管和重试。
- 每条消息只需要由组内一个消费者处理。

如果处理结果还要广播给浏览器，可以拆成两条 Stream：

```text
command stream --consumer group--> workers
result stream  --independent cursor--> browsers
```

不要用一个消费者组同时承担“后台竞争消费”和“前端每人都要收到全部事件”这两种相反语义。

---

## 八、结论

SSE 断线续传的关键不是“用了 Redis Stream”，而是把三个游标对齐：

```text
Redis Stream ID
      =
SSE event id
      =
浏览器 Last-Event-ID
```

只要保留窗口仍覆盖该 ID，服务端就能从断点后继续读取。消费者组解决的是后端工作分配，
不是浏览器广播；两种模型应从设计阶段分开。

## 参考

- [Spring Data Redis：Redis Streams](https://docs.spring.io/spring-data/redis/reference/redis/redis-streams.html)
- [MDN：Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
