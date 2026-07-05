# AgentScope(Java)2.0 的记忆系统

> 来源：AgentScope 官方公众号
> 链接：https://mp.weixin.qq.com/s/6r8xg4YlUgnbaYhNP6tA1Q
> 类型：📚 参考资料（非面试题/面经）—— AgentScope Java 2.0 记忆系统架构详解
> 相关：第32题 Agent Memory Design
> 整理时间：2026-06-28

---

用 Agent 做对话的时候有个绕不开的问题：聊久了上下文越来越长，模型要么报错，要么记不住前面的内容。一旦服务重启之前聊的全丢了。

AgentScope 2.0 用一套"记忆系统"解决这个问题。

---

## 一、记忆到底存在哪？

**存在文件里。**

拆成两个文件：

| 文件 | 路径 | 特性 | 比喻 |
|------|------|------|------|
| **日流水账** | `memory/YYYY-MM-DD.md` | 每天一个文件，只追加不改，不去重 | 草稿纸 |
| **长期记忆** | `MEMORY.md` | 定期用 LLM 合并去重，重写整个文件，注入 system prompt | 笔记本 |

**草稿纸只加不改，笔记本定期整理。两层互不干扰。**

Agent 自带的两个记忆工具：
- `memory_search` — 按关键词搜索
- `memory_get` — 按行号读取

---

## 二、三次 LLM 调用

这是最容易搞混的地方。

### 第一次：Flush（提取事实）

每次 `call()` 结束后，LLM 从对话里抽取值得长期记住的信息，追加到当天的日流水账。异步执行，不阻塞响应返回。

**节流配置：**
```java
.memory(MemoryConfig.builder()
    .flushTrigger(MemoryConfig.FlushTrigger
        .throttled(Duration.ofMinutes(10)))
    .build())
```
默认每次 call 结束都跑。`.never()` 可彻底关闭。

**三个触发时机：**
1. 每次 `call()` 结束（默认）
2. 对话压缩之前（压缩会丢细节，先 flush 确保关键信息已写入）
3. 上下文溢出兜底（模型报 `context_length_exceeded`，框架紧急压缩，顺带 flush）

三处用的是同一份 prompt，改一处三处都生效。

### 第二次：Consolidation（合并整理）

后台任务，默认每 30 分钟最多跑一次。把多天的日流水账合并去重，整体重写 `MEMORY.md`。归 `MemoryConfig` 管。

### 第三次：Compaction（对话压缩）

跟前两个不一样——它不是沉淀长期记忆，是**压缩当前对话**。消息太多了，把前面的历史蒸馏成一条摘要，尾部保留最近几条原文。

归 `CompactionConfig` 管，是两个独立的配置类。

---

## 三、模型分离配置

三次调用默认共享 agent 的主模型。flush 和 consolidation 不需要那么强的模型，可以单独指定便宜的：

```java
HarnessAgent
    .builder()
    .model("openai:o3")
    .memory(MemoryConfig.builder()
        .model("openai:gpt-4.1-mini")
        .build())
    .compaction(CompactionConfig.builder()
        .model("openai:gpt-4.1-mini")
        .build())
    .build();
```

---

## 四、上下文压缩配置

```java
.compaction(CompactionConfig.builder()
    .triggerMessages(30)     // 消息到 30 条触发
    .keepMessages(10)        // 压缩后保留最近 10 条
    .build())
```

默认值：50 条触发、保留 20 条。

**不走 LLM 的小技巧**：工具调用参数超过 2000 字符的直接截断。比如 `write_file` 写了 5 万字进去，写完就没人看了，没必要占着上下文。

**崩溃恢复**：模型报 `context_length_exceeded`，框架自动做一轮强制压缩然后重试。前提是配了 `compaction(...)`，没配的话错误直接抛回去。

---

## 五、工具结果卸载

某个工具返回超过 **80K 字符**，框架自动卸载——上下文里只留首尾各约 2K + 一行 `"完整内容见 {path}"`。Agent 需要全文就自己调 `read_file`。

```java
.toolResultEviction(ToolResultEvictionConfig.defaults())
```

**细节**：`read_file` 默认不参与卸载。不然读出来又被卸载，白读了。

---

## 六、审计日志

对话被压缩之前，原始消息会另存一份到 `sessions/<id>.log.jsonl`，**永不压缩**。事后审计或排查问题时可以翻这个文件。

---

## 七、总结

| 机制 | 触发时机 | 用途 | 配置类 |
|------|----------|------|--------|
| Flush | call 结束 / 压缩前 / 溢出时 | 提取事实到流水账 | MemoryConfig |
| Consolidation | 每 30 分钟 | 合并流水账到长期记忆 | MemoryConfig |
| Compaction | 消息数达阈值 | 压缩当前对话上下文 | CompactionConfig |
| 工具结果卸载 | > 80K 字符 | 释放上下文空间 | ToolResultEvictionConfig |
| 审计日志 | 压缩前 | 保存原始对话 | 默认开启 |

**原则**：大部分用默认值就行。先跑起来，等遇到具体问题了再调——flush 太频繁就加节流，上下文老溢出就配压缩。
