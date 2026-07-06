---
title: "后端开发转Agent开发学习路线"
date: "2026-07-06"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "后端开发转Agent开发学习路线"
tags:
---

# 后端开发转Agent开发学习路线

> **来源**: 小红书（字节Agent开发暑期实习 offer 经验）
> **背景**: 作者有一段后端开发实习经验，从2月底开始准备Agent开发，边准备边面试约2个月拿到字节offer

---

## 一、核心理念

**面试占比**: Agent > 后端 > 算法

**准备节奏**: 3个部分同时推进，但优先级：后端基础 > Agent知识 > 算法基础

---

## 二、后端部分

Agent开发本质上还是**开发岗**，后端基础是根基。和后端面试不同的是，Agent开发面试**不太问语言强相关的八股**（JVM、SpringBoot这些），更多是**通用的后端八股**：

| 模块 | 重点 | 建议 |
|------|------|------|
| **Redis** | 数据类型、分布式锁、缓存三大问题、集群 | ⭐⭐⭐⭐⭐ |
| **MySQL** | 索引（B+树）、事务、锁、SQL优化 | ⭐⭐⭐⭐⭐ |
| **消息队列** | Kafka/RocketMQ 选型、消息可靠性、堆积处理 | ⭐⭐⭐⭐ |
| **操作系统** | 进程线程、IO模型、内存管理 | ⭐⭐⭐ |
| **计算机网络** | TCP/UDP、HTTP/HTTPS、DNS | ⭐⭐⭐ |
| **JVM/Spring** | 后端面试重点，但Agent面**问得少** | ⭐⭐ |

> **编程语言**：有熟悉的即可，不用太担心语言问题。Java、Go、Python 都行。

---

## 三、Agent 部分（核心）

### 3.1 学习路径

```
Step 1: Agent基础概念
    ↓
Step 2: RAG（检索增强生成）
    ↓
Step 3: Harness Engineering（核心难点）
    ↓
Step 4: Agent框架概览
    ↓
Step 5: 深入记忆/上下文机制（面试高频）
    ↓
Step 6: 前沿研究追踪
    ↓
Step 7: 动手项目（仿 Claude Code / 参赛）
```

### 3.2 每步详解

#### Step 1: Agent 基础概念

- 课程推荐：[hello-agent](https://github.com/...)
- 核心概念：Agent、Tool Use、ReAct Loop、Multi-Agent、Planning
- 要搞懂：什么是 Agent？Agent 和 LLM chat 的区别是什么？

#### Step 2: RAG（检索增强生成）

- 课程推荐：[all-in-rag](https://github.com/...)
- 虽然有人说 RAG 有点过时了，但**实际生产上还是大量用到 RAG**
- 重点：文档解析 → 切分策略（chunking） → Embedding → 向量检索 → 混合检索 → Rerank

#### Step 3: Harness Engineering（重中之重 ⭐⭐⭐⭐⭐）

- 课程推荐：[learn-claude-code](https://github.com/...)
- Harness 是什么？AI Coding Agent 中模型外面的那套系统——工具调用、上下文管理、文件操作、命令执行等

**需要掌握的核心知识点**：

```
Harness Engineering 核心能力:
├── 上下文压缩（Context Compression）
│   ├── Token 计数与窗口管理
│   ├── 关键信息摘要化
│   └── 滑动窗口策略
├── Tool Calling（工具调用）
│   ├── JSON Schema 定义
│   ├── 参数校验与错误重试
│   └── 工具注册与发现
└── Multi-Agent 编排
    ├── 子Agent 生命周期管理
    ├── 任务分派与结果汇总
    └── 通信协议（ACP / MCP）
```

#### Step 4: Agent 框架概览

- **LangChain** / **LangGraph**：了解基本语法即可，面试不会深挖细节
- 重点是理解框架的设计思想：Chain → Graph → Agent 的演进路线
- 实际生产中的 Agent 大多是自己写的，不依赖特定框架

#### Step 5: 记忆与上下文机制（面试高频 ⭐⭐⭐⭐）

**推荐阅读**：
- [OpenClaw 记忆系统深度解析](https://snowan.gitbook.io/study-notes/ai-blogs/openclaw---memory-system-deep-dive)
- Claude Code 的上下文管理机制

**需要掌握**：
```
记忆架构三层：
├── 短期记忆（当前会话，滑动窗口）
│   ├── Token 预算分配
│   ├── 关键消息保留策略（当前文件/报错/用户指令优先）
│   └── 压缩/丢弃非关键信息
├── 长期记忆（跨会话持久化）
│   ├── SQLite / 向量数据库
│   ├── 用户偏好 / 项目约定 / 技能模板
│   └── 语义检索 + 关键词检索
└── 技能记忆（可复用工作流）
    ├── Skill 声明式定义（YAML/JSON）
    ├── 触发条件匹配
    └── 多步骤工作流编排
```

#### Step 6: 前沿研究追踪

Agent 技术迭代极快，每周都有新概念，面试可能会问**最近的新技术有没有了解**。

**必读文章**：

| 文章 | 内容 | 来源 |
|------|------|------|
| Managed Agents | 多Agent编排实践 | [Anthropic Engineering](https://www.anthropic.com/engineering/managed-agents) |
| Building Multi-Agent Systems | 何时及如何用多Agent | [Claude Blog](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them) |
| Harness Engineering | OpenAI Codex 的 Harness 设计 | [OpenAI](https://openai.com/index/harness-engineering) |
| Unrolling the Codex Agent Loop | Codex Agent 循环拆解 | [OpenAI](https://openai.com/zh-Hans-CN/index/unrolling-the-codex-agent-loop/) |
| Context Engineering | 为 AI Agent 做上下文工程 | [Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) |
| Seeing AI Agent as... | 社区对Agent的深度解读 | [tw93](https://tw93.fun/2026-03-21/agent.html) |
| Claude Code 解析 | Claude Code 的深度分析 | [tw93](https://tw93.fun/2026-03-12/claude.html) |

#### Step 7: 动手项目

**推荐方案一：仿 Claude Code 项目**
- GitHub 上搜 clone code 有很多开源实现
- 从零实现一个简单的 AI Coding Agent
- 面试时可以结合项目讲自己对 Harness 的理解

**推荐方案二（更推荐）：字节 AI 全栈挑战赛**
- 课题都是**真实的业务需求**，做出来不会像 toy project
- 课题要求清晰，上手快
- 即使报名结束了，可以找报上的同学要课题自己做

---

## 四、算法部分

不是面试重点，但需要**稍微准备**，可能被问到但不会像算法岗那么深入。

| 重点 | 程度 |
|------|------|
| **Transformer 原理** | 了解 Self-Attention、Multi-Head Attention |
| **Embedding** | 理解什么是向量表示、相似度计算 |
| **LeetCode Hot 100** | 刷一遍，面试会考 |

课程推荐：[Dive into Deep Learning](https://d2l.ai/) — 看 Transformer 和 Embedding 部分即可

---

## 五、面试感受总结

### 5.1 Agent 面试 vs 后端面试的核心差异

| 维度 | 后端面试 | Agent 面试 |
|------|----------|------------|
| 八股重心 | JVM/Spring/Java 语言细节 | Redis/MySQL/MQ/OS/网络 |
| 项目拷打 | 业务系统设计 | Agent 架构设计 + Harness 理解 |
| AI 使用 | 不问或略问 | **必问**：你怎么用AI给自己提效？ |
| 系统设计 | 高并发/秒杀/分布式 | Agent 设计 / Skill 设计 |
| 技术热点 | 跟进相对慢 | 每周都有新概念，必须及时了解 |

### 5.2 面试高频题

1. **对 Agent 你自己的理解是什么？**
2. **设计一个 Agent 系统**（系统设计题）
3. **设计一个 Skill 系统**（声明式定义 + 触发 + 执行）
4. **记忆系统怎么设计？**（三层记忆架构）
5. **上下文窗口满了怎么办？**（压缩/摘要/滑动窗口）
6. **你平时怎么用 AI Coding 工具的？**（不只是 Chat，要体现出独特的见解）
7. **最近的 xx 新技术你有没有了解？**（紧跟前沿）
8. **LeetCode 算法题**（Hot 100 难度）

### 5.3 加分项

```
面试官希望你：
✅ 不只是把 AI 当 ChatBot 用
✅ 有自己独特的 AI 提效方法论
✅ 有自己的 Agent 实践项目
✅ 能深入理解 Harness 设计
✅ 保持对前沿技术的关注
```

---

## 六、推荐学习资源汇总

### 课程
| 资源 | 用途 |
|------|------|
| hello-agent | Agent 基础概念入门 |
| all-in-rag | RAG 学习（生产必备） |
| learn-claude-code | Harness Engineering（核心） |
| Dive into Deep Learning | Transformer/Embedding（算法基础） |

### 必读文章
| 文章 | URL |
|------|-----|
| Managed Agents | https://www.anthropic.com/engineering/managed-agents |
| Building Multi-Agent Systems | https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them |
| OpenClaw Memory System | https://snowan.gitbook.io/study-notes/ai-blogs/openclaw---memory-system-deep-dive |
| Harness Engineering | https://openai.com/index/harness-engineering |
| Seeing AI Agent as... | https://tw93.fun/2026-03-21/agent.html |
| Unrolling Codex Agent Loop | https://openai.com/zh-Hans-CN/index/unrolling-the-codex-agent-loop/ |
| Claude Code 解析 | https://tw93.fun/2026-03-12/claude.html |
| Context Engineering | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents |

---

## 七、一句话总结

> **后端转 Agent = 后端基础稳住（Redis/MySQL/MQ） + Agent 核心吃透（Harness/记忆/上下文） + 项目实战（仿 Claude Code/参赛） + 前沿追踪（每周新文章）**

> 关键不在于背了多少八股，而在于**对 Agent 有没有自己的理解**