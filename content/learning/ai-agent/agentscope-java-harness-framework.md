---
title: "AgentScope Java 1.1.0：Harness Framework 深度解析"
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
summary: "AgentScope Java 1.1.0：Harness Framework 深度解析"
tags:
---

# AgentScope Java 1.1.0：Harness Framework 深度解析

> 来源：微信公众号《阿里云云原生》 | AgentScope Java 官方
> **类型**：📚 参考资料（非面试题/面经）
> 官网：https://java.agentscope.io
> GitHub：https://github.com/agentscope-ai/agentscope-java

## 背景

AgentScope Java 1.1.0 里程碑版本完整实现了 **"Harness Framework"** 规划，将 OpenClaw/Hermes/Claude Code 背后的 Harness Engineering 理念打包成企业级框架。

---

## 核心问题：个人助手 vs 企业级 Agent 是两种工程形态

| 维度 | 个人助手（OpenClaw 类） | 企业级 Agent |
|------|----------------------|-------------|
| **部署形态** | 单用户单进程，状态放一台机器 | 水平扩容、多租户、服务不中断 |
| **安全边界** | 本机工具执行无风险 | 任意 Shell 执行是严重攻击面 |
| **运维可观测** | 自己看日志 | 记忆落盘、会话可审计、状态变更可追踪 |
| **Token 经济** | 对延迟和费用不敏感 | 每次无效上下文重推都是真实成本 |

### 五个落地障碍

1. **多用户、多副本，工作区怎么办？** 本地目录假设崩了
2. **Tool/Skill 不能在宿主机跑，怎么隔离？** 沙箱是必须的
3. **"workspace + 文件系统"怎么搬到分布式？** 远端存储/KV/对象存储接口各异
4. **Multi-Agent 怎么做？** 子任务分发、上下文隔离、异步执行、结果回收、超时取消
5. **上下文压缩和分层记忆有没有开箱即用？** 压缩时机/策略/事实提取/可检索性/恢复

---

## 四项核心能力

| # | 能力 | 说明 |
|---|------|------|
| 1 | **工作区驱动的 Agent 运行环境** | 人格、知识、技能、记忆、子 Agent 规格统一沉淀在结构化工作区，每次运行自动加载上下文，结束后自动回写记忆 |
| 2 | **可插拔的抽象文件系统** | 本机磁盘、远端共享存储、隔离沙箱均通过同一套接口操作，同一份 Agent 逻辑无需修改即可适配个人/企业部署 |
| 3 | **开箱即用的上下文管理** | 内置对话压缩、双层记忆沉淀与全文检索，解决长对话上下文膨胀和跨会话记忆丢失 |
| 4 | **子 Agent 编排与隔离执行** | 声明式定义子 Agent、同步或异步委派子任务；工具执行可配置在隔离沙箱内完成 |

---

## 设计理念：两大核心支柱

### 支柱一：Workspace 作为唯一事实来源（Source of Truth）

```
workspace/
├── AGENTS.md              ← Agent 人格与行为约定，每次推理前自动注入 system prompt
├── MEMORY.md              ← 精炼的长期记忆，由后台自动维护，随使用积累
├── knowledge/             ← 领域知识，随 AGENTS.md 一起注入
├── skills/                ← 可复用技能，自动装配到 Agent 的工具集
├── subagents/             ← 子 Agent 规格声明，自动被发现和加载
└── agents/<agentId>/
    ├── context/           ← 会话状态快照（进程重启后恢复用）
    ├── sessions/          ← 对话 JSONL 与压缩上下文，供审计与检索
    └── memory/            ← 每日记忆流水账
```

**运行流程**：
1. 推理前：`WorkspaceContextHook` 自动注入 AGENTS.md、MEMORY.md、knowledge/ 到 system prompt
2. 推理后：`MemoryFlushHook` 提炼新事实写入记忆文件
3. 后台：`MemoryConsolidator` 周期性合并流水账成精炼长期记忆

### 支柱二：AbstractFilesystem 让工作区运行在任何环境

对上层：Agent 只需调用统一的 `read/write/ls/grep` 接口
对下层：可适配本机磁盘、远端对象存储(OSS)、KV数据库(Redis)、沙箱文件系统

**三种内置实现**：

| 模式 | 适用场景 | 文件系统后端 |
|------|---------|------------|
| **Local** | 个人代理（OpenClaw 类） | 本机磁盘 |
| **Remote** | 企业级数据服务（DataAgent） | 远端共享存储 |
| **Sandbox** | 企业在线服务（交易 Agent） | 隔离沙箱 |

---

## 三大应用场景

### 场景一：个人代理 Agent（OpenClaw 类）

**特点**：单用户、本机运行、需要操作本地文件或执行脚本

**核心能力**：
- **持续记忆**：对话结束后自动提炼新事实写入工作区
- **本地 Shell 执行**：在本机可信环境下直接运行脚本、操作文件
- **工作区即配置**：修改 AGENTS.md 调整人格，skills/ 新增技能，改文件 = 升级 Agent
- **会话跨进程恢复**：关闭再打开，sessionId 不变则状态全部还原

### 场景二：企业级数据服务（DataAgent）

**特点**：多用户、执行 SQL/Python/Shell、任务耗时长、输入来自不可信外部用户

**核心能力**：
- **隔离沙箱执行**：所有代码与命令在隔离环境运行，宿主服务不受影响
- **多轮沙箱状态恢复**：每轮对话结束自动保存沙箱状态，下轮原位恢复
- **分布式记忆共享**：长期记忆存放在共享存储，多节点部署体验一致
- **子 Agent 并行编排**：长任务拆解为多个子 Agent 并发执行
- **多租户隔离**：按会话或用户维度隔离工作区与执行环境

### 场景三：企业在线服务（淘天交易 Agent）

**特点**：调用业务 API 完成任务（下单/查询/审批），不需要 Shell 执行

**核心能力**：
- **默认安全边界**：不开启沙箱时框架不暴露 Shell 工具，安全策略由配置决定
- **多实例共享记忆**：会话状态与用户记忆落到远端存储，多实例间切换无感知
- **会话跨请求连续**：每次请求携带相同用户标识，自动恢复上次对话状态
- **并行子任务支持**：子任务委派给子 Agent 并行执行，结果汇总后统一回复

---

## 快速开始（三步）

### 1. 引入依赖

```xml
<dependency>
    <groupId>io.agentscope</groupId>
    <artifactId>agentscope-harness</artifactId>
    <version>${agentscope.version}</version>
</dependency>
```

### 2. 准备工作区

在磁盘上选一个目录作为 workspace，创建 `AGENTS.md`（Agent 人格与行为约定）

### 3. 构建 HarnessAgent 并调用

```java
HarnessAgent agent = HarnessAgent.builder()
    .name("my-agent")
    .model(model)
    .workspace(Paths.get(".agentscope/workspace"))
    .compaction(CompactionConfig.builder()
        .triggerMessages(50)
        .keepMessages(20)
        .build())
    .build();

RuntimeContext ctx = RuntimeContext.builder()
    .sessionId("user-session-001")  // 相同 sessionId 自动续接上下文
    .userId("alice")                // 多用户场景必传，命名空间隔离
    .build();

Msg reply = agent.call(userMessage, ctx).block();
```

---

## 六大核心概念

| 概念 | 定义 | 解决的问题 | 使用建议 |
|------|------|-----------|---------|
| **HarnessAgent** | 基于 ReActAgent 的工程化封装入口 | "不想从零拼装压缩、记忆、会话、子任务、文件系统" | 业务代码只与 builder() 和 call() 打交道 |
| **workspace** | Agent 工作目录，承载全部持久化内容 | "人格、知识、记忆、状态放哪、如何持续演化" | 先规划工作区结构再写 prompt |
| **filesystem** | 文件读写的统一接口 | "同一套 Agent 逻辑如何在本地/共享存储/沙箱间切换" | 优先从三种声明式模式选型 |
| **RuntimeContext** | 单次 call() 的身份上下文 | "这一轮是谁、状态读写到哪、多租户如何隔离" | 必须稳定传 sessionId；多租户必传 userId |
| **sandbox** | 隔离执行环境 | "如何在不信任输入下安全执行工具与脚本" | 有代码执行需求时优先启用 |
| **memory** | 双层记忆系统 | "长对话不丢事实、上下文不爆、历史可检索" | 开启对话压缩并观察记忆文件变化 |

**总纲**：HarnessAgent 负责编排，workspace 负责沉淀，filesystem 负责落点，RuntimeContext 负责身份，sandbox 负责边界，memory 负责长期演化。

---

## 记忆管理：双层分离架构

### 第一层：每日流水账
- 每次对话结束后，LLM 提炼"新增事实"，以 bullet point 追加到 `memory/YYYY-MM-DD.md`
- 只追加、不修改，保证任何新事实都不会丢失

### 第二层：长期记忆
- 后台调度器周期性读取近期日流水账，用 LLM 与现有 MEMORY.md 合并、去重、精炼
- 输出在 Token 预算内的"可注入版"写回 MEMORY.md
- 每轮推理注入到 system prompt

### 对话压缩
- 当消息数超过阈值（如 50 条），保留最近 20 条 + 压缩后的历史摘要
- 避免上下文膨胀导致 Token 成本飙升

---

## 会话持久化：两条并行路径

| 路径 | 存储位置 | 用途 |
|------|---------|------|
| **状态快照**（context/） | agents/{agentId}/context/{sessionId}/ | 进程重启后恢复到上次结束位置 |
| **对话日志**（sessions/） | {sessionId}.log.jsonl（永不压缩） | 审计和 session_search 工具使用 |
| **压缩上下文** | {sessionId}.jsonl | 模型实际"看到"的版本 |

**开发者唯一需要做的是**：每次调用时稳定传入相同的 sessionId

---

## 对 Java 开发者的启示

1. **Harness Engineering 是企业级 Agent 的标配**：OpenClaw/Hermes/Claude Code 验证了这套理念
2. **工作区即配置**：改文件 = 升级 Agent，不需要重新编译部署
3. **AbstractFilesystem 是关键抽象**：同一套 Agent 逻辑在本地/分布式/沙箱间无缝切换
4. **双层记忆解决 Token 经济**：流水账保证不丢事实，长期记忆保证不爆上下文
5. **安全边界由配置决定**：不开沙箱就不暴露 Shell，不是靠开发者自律
6. **Java 生态终于有企业级 Agent框架**：AgentScope Java 1.1.0 是里程碑

---

## 参考链接

- [Harness 概览](https://github.com/agentscope-ai/agentscope-java/blob/main/docs/zh/harness/overview.md)
- [Filesystem 文档](https://github.com/agentscope-ai/agentscope-java/blob/main/docs/zh/harness/filesystem.md)
- [官网文档](https://java.agentscope.io)

---

*整理时间: 2026-05-18*
