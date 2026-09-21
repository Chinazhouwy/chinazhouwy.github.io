---
title: "Hermes Agent 实践入门：Dashboard、记忆、Skill 与多 Agent 协作"
date: "2026-08-31"
createdAt: "2026-08-31"
publishedAt: "2026-08-31"
domain: "学习"
area: "AI Agent"
module: "Hermes Agent"
project: "工程源码研究"
type: "技术笔记"
status: "可复习"
priority: "P0"
energy: "high"
visibility: "public"
lane: "agent"
summary: "从 Dashboard 开始体验 Hermes 的工具、经验积累、多 Agent 分工与持续任务，再用简短流程说明 Java、MCP 和插件接在哪里。"
tags:
  - "Hermes Agent"
  - "Agent"
  - "Dashboard"
  - "Multi-Agent"
  - "Memory"
  - "Java"
  - "MCP"
  - "Skills"
  - "Hooks"
  - "Plugins"
---

# Hermes Agent 实践入门：Dashboard、记忆、Skill 与多 Agent 协作

第一次用 Hermes，先别急着写 MCP Server。把 Dashboard 打开，完成一个任务，看看它用了哪些工具、留下了什么记录，再试试让几个 Agent 分工。这比先写一堆接入代码更容易理解 Hermes。

本文围绕一个例子展开：**平时练 Java 面试题，周末整理薄弱项。** 主要体验 Hermes 自带功能，最后用简短代码说明 Java 服务可以接在哪里，不搭建完整业务项目。

> 按 2026-09-08 官方文档及源码快照核对。操作步骤供读者体验；面试助手部分是设计示意，不代表已经实现或部署了该项目。

## 1. Hermes 值得体验的是什么？

它既能在终端完成任务，也能通过网页、桌面和消息平台使用。同一套工具、记忆和 Skill，不必为每个入口重新实现。

其中最值得动手试的几件事：

- **Dashboard**：查看会话、工具记录、模型用量，管理 Skill、MCP 和定时任务。
- **记忆与经验积累**：记住稳定偏好，还能把做成一件事的方法整理为 Skill，以后再用。
- **多 Agent**：临时拆任务交给子 Agent，或保留几个有不同配置和职责的长期角色。
- **持续工作**：定时执行任务、追踪当前进展、围绕目标继续做；任务多了可以用 Kanban 看板管理。
- **多入口**：电脑上做配置，手机上提问或接收任务结果，工作仍在 Hermes 所在机器上执行。

这些机制不一定由 Hermes 独有；值得学习的是，它把它们放进了一个可以实际使用的助手中。[官方介绍](https://hermes-agent.nousresearch.com/docs/)

## 2. 跑起来，然后直接打开 Dashboard

### 安装与第一次对话

以下以 macOS、Linux 或 WSL2 为例。需要 Git 和网络；Linux 还需 curl、xz-utils，其余依赖由官方安装器处理。

```bash
# 下载后先查看脚本，再执行。已有Hermes的人跳过安装。
curl -fsSL https://hermes-agent.nousresearch.com/install.sh -o install-hermes.sh
less install-hermes.sh
bash install-hermes.sh

# 重新打开终端后，选择模型服务并配置自己的凭据。
hermes setup
hermes
```

在对话里输入：

```text
我想用你复习 Java。先出一道 JVM 基础题，等我回答后再讲解。
```

这一步只验证模型连接。文件、搜索、浏览器和 MCP 是否可用，要分别体验。以后只换模型用 `hermes model`，不必重走全部安装流程。[安装说明](https://hermes-agent.nousresearch.com/docs/getting-started/installation)

### Dashboard 不只是一个聊天窗口

在终端运行：

```bash
# 默认打开本机 http://127.0.0.1:9119。
hermes dashboard
```

如果提示缺少依赖，按提示在 **Hermes 自己的虚拟环境** 中补装 `web`、`pty` extra；首次启动还可能构建前端。不要装进无关项目的 Python 环境。

先按这个顺序逛一遍：

1. **Chat**：在浏览器里发起任务，查看工具调用和审批提示。当前实现内嵌 Hermes TUI，不是另造一个简化聊天后端。
2. **Sessions**：找到刚才的会话，读历史、恢复对话。
3. **Analytics / Logs**：查看用量和运行记录，遇到错误时从这里定位。
4. **Skills / MCP / Cron**：看它学会了什么、接了哪些工具、安排了哪些任务。

有多个 Profile 时，先看侧栏选中的是谁，再改配置。Dashboard 的 Profile 切换不等于自动启动了相应 Gateway。

如果 Hermes 在服务器，先在服务器运行 `hermes dashboard --no-open`，再从电脑建立 SSH 隧道：

```bash
# user@your-server 换成自己的SSH地址，不开放服务器的9119公网端口。
ssh -N -L 9119:127.0.0.1:9119 user@your-server
```

随后访问电脑上的 `http://127.0.0.1:9119`。管理面板能改凭据和工具配置，不要裸露到公网。[Dashboard 文档](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard)

## 3. 做三个任务，看清它如何使用工具

在自己的练习项目目录启动 Hermes，或者在 Dashboard 的 Chat 中明确给出项目绝对路径。先做这三个小实验：

| 输入 | 观察什么 |
|---|---|
| “读取 pom.xml 和 src，找出入口类，不修改文件。” | `read_file`、`search_files` 等调用是否指向真实文件 |
| “运行 mvn test，报告测试数和失败原因，不修代码。” | `terminal` 输出、退出码；长任务的后续进程状态 |
| “搜索 Spring 官方网站，确认当前稳定版本并给出处。” | `web_search` / `web_extract` 与可打开的来源链接 |

浏览器也可以单独试：“用浏览器打开 example.com，读出页面标题和主要链接。”它适合需要页面渲染、点击和交互的任务；只读网页文本，不一定需要浏览器。

工具看不到或不能用时，运行 `hermes tools` 检查后端。模型凭据不自动包含搜索和浏览器所需的服务。Maven 会执行项目代码，只在可信仓库中运行。

一次执行大致如此：

```text
你的请求 → 模型选择工具 → Hermes执行工具 → 工具结果交回模型
                                             ↓
                              继续调用工具，或生成最终回答
```

在 Dashboard 中回看这一轮，重点分清：**哪些是模型说的，哪些有工具结果支持。** [工具说明](https://hermes-agent.nousresearch.com/docs/user-guide/features/tools)

## 4. Skill：不仅能加载手册，还能积累做事方法

先写一个小 Skill，固定面试节奏。在当前 Profile 的 `skills/java-interview/SKILL.md` 中放入：

```markdown
---
name: java-interview
description: 用户要求进行Java面试练习时使用，一次只问一道题并等待回答。
---

# Java 面试练习

1. 先问用户今天想练哪个主题，只出一道题，不提前给答案。
2. 等待回答，再分开写：答对的部分、遗漏点、纠错、一个追问。
3. 保留用户原回答，不用标准答案替换它。
4. 用户确认后才保存复习记录；未成功保存时必须明确说明。
5. 不确定的技术结论先查官方资料，不为了打分强行下结论。
```

默认 Profile 的完整路径是 `~/.hermes/skills/java-interview/SKILL.md`。开新会话后输入：

```text
/java-interview 今天练线程池。
```

观察它是否先提问、等待回答，再反馈，而不是一口气把题目和答案都倒出来。Skill 可以在 Dashboard 中查看；Agent 也可以通过 `skill_view` 按需读取。

Hermes 还有值得体验的一步：**让它把一次有效的方法保存下来。** 例如你纠正了反馈格式后说：

```text
刚才这种“先指出错误，再用具体例子追问”的方式更适合我。
请把这条通用做法加入 java-interview Skill，不保存本轮题目和聊天流水。
```

Hermes 可以用 `skill_manage` 更新 Skill；后台复盘也可以建议或暂存修改，是否直接写入取决于审批配置。随后去看文件差异，再开新会话验证。

所谓“越用越懂你”，在这里有可检查的落点：**一条方法写进了文件，下次被读出来。** 不意味着模型权重被重新训练，也不保证每次自动整理都正确。[Skills 与 Agent 自维护](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills)

## 5. Memory：把偏好和聊天记录分开

在普通会话中告诉 Hermes：

```text
请记住：我是在职 Java 开发者，每天只有十五分钟练习。
解释时优先用 Java 示例，不要一次给十道题。
```

确认 Memory 工具保存成功后，用 `/new` 开新会话，再问“今天怎么安排练习”。同时检查默认 Profile 下的 `~/.hermes/memories/USER.md`，看偏好是否真的写入。

几个文件的用途不用想复杂：

- **USER.md / MEMORY.md**：少量稳定偏好、环境事实和长期经验。
- **Session History**：具体聊过什么；过去的细节可以用 `session_search` 找。
- **AGENTS.md 等项目文件**：这个仓库怎么构建、有哪些约定。
- **Skill**：一类任务应该怎么做。

内置 Memory 在会话开始时读入；本轮写入会落盘，但已有系统提示中的快照不会立刻重建。因此跨会话实验比在同一轮问“你记住了吗”更有意义。

面试偏好适合放 Memory；几十次答题的原文和成绩应放文件或数据库。需要更大的记忆系统时，再了解外部 Memory Provider。[Memory 文档](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)

## 6. Multi-Agent：临时分工、长期角色和任务看板

这三种用法解决的问题不同，不要统称为“多开几个聊天框”。

### 6.1 Delegation：这次任务，分给几个助手做

在 Hermes 中试一个只读任务：

```text
请用三个子Agent分别检查 /absolute/path/to/java-lab：
A：只看线程池和共享数据的并发问题。
B：只看异常处理和资源关闭。
C：只看已有测试遗漏了什么。
三个都不要修改文件。完成后你合并结果，去重并列出最值得处理的三项。
```

Hermes 的 `delegate_task` 会创建子 Agent。下面展示工具参数的样子，**不是让你在 Python 终端调用一个全局函数**：

```json
{
  "tasks": [
    {"goal": "检查并发问题", "context": "项目 /absolute/path/to/java-lab；只读；给文件位置"},
    {"goal": "检查异常与资源关闭", "context": "项目 /absolute/path/to/java-lab；只读；给触发条件"},
    {"goal": "检查测试遗漏", "context": "项目 /absolute/path/to/java-lab；只读；不运行构建"}
  ]
}
```

子 Agent 有各自的对话和终端会话，不会自动拿到主 Agent 的整段聊天历史；主 Agent 必须把路径、目标和限制传过去。项目上下文文件可以被带入，但不能因此省略具体任务说明。

主 Agent 通常接收子 Agent 的结果摘要，不把每一步工具输出都塞回自己的对话。当前顶层委派在后台执行，先返回任务句柄，完成后再投递结果。可以观察进度，不需要每秒催问。

适合并行读资料、按方面审查和独立分析。多个子 Agent 仍可能访问同一个工作目录，**对话隔离不等于文件隔离**；需要同时改代码时，先安排独立 worktree。更多 Agent 也意味着更多模型调用。[Delegation 文档](https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation)

### 6.2 Profile / Bot：保留几个长期使用的角色

如果每天都需要“面试教练”和“源码阅读助手”，用独立 Profile 更合适：

```bash
# 新建独立配置与记忆目录；setup为这个角色单独配置模型。
hermes profile create interview
hermes -p interview setup
hermes -p interview chat
```

你可以给 interview 放面试 Skill，另一个 researcher 放源码阅读 Skill，各自选择模型和工具。它们的会话、记忆和配置不会因为使用同一个 Hermes 安装就自动混在一起。

**创建多个 Profile 本身不会让它们合作。** 想临时分工用 Delegation；想给长期角色分配任务，再用 Bot Mode 或 Kanban。

当前官方桌面端的 **Bot Mode** 把 Profile 展示为有名字和职责的 Bot，支持各自的聊天、定时例程、群聊与相互发消息。在桌面端 Bots 面板点 New Agent，可以先建“面试教练”“资料核查”两个角色，再试协作。它属于桌面端体验，不要把它和 Web Dashboard 的 Profile 下拉选择混为一谈。[Profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles)、[Bot Mode](https://hermes-agent.nousresearch.com/docs/user-guide/bot-mode)

### 6.3 Kanban：事情多了，用看板管理分工和依赖

例如周末要完成：

```text
A：汇总本周原回答 ──→ B：找出薄弱主题 ──→ D：生成下周计划
C：检查题目来源 ──────────────────────→ D
```

这种有依赖、有执行状态、需要跨角色交接的工作，比一次 `delegate_task` 更适合 Kanban。

```bash
# 初始化看板，然后在Dashboard侧栏打开Kanban。
hermes kanban init
hermes dashboard
```

从一张只读任务卡开始，写清项目目录、负责人和完成标准，再看它如何进入 Ready、In progress、Blocked 或 Done。任务卡能保留评论、结果和附件；worker 在自己的进程和会话里执行。

**看板是人管理任务的地方，Dispatcher 才负责启动 worker。** 当前调度通常由 Gateway 承载；只打开 Dashboard，不代表卡片就会自动执行。首次尝试先检查调度状态，并使用手动模式，避免把一批想法立即变成付费任务。[Kanban 教程](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban-tutorial)

## 7. Cron、Heartbeat、Loop、Goal：什么时候让它继续？

先按日常需求区分，不用背名词。

**每天固定时间做一次：Cron。** 在准备接收消息的会话里说：

```text
每天北京时间21:30，读取我的复习记录，汇总今天的薄弱项并提醒明天练习。
不要修改记录。创建后给我任务ID、实际时区、下次运行时间和投递目标。
```

然后去 Dashboard 的 Cron 页面核对任务，试运行一次。Cron 通常以新会话执行，所以要给出记录的实际路径或工具，不能只说“按刚才那些内容”。调度进程也必须持续运行。

**在当前对话里定期回来看看：Heartbeat。**

```text
/heartbeat every 10m 检查刚才的CI任务，只在完成、失败或需要我处理时通知。
```

结束时 `/heartbeat clear`。它保留当前会话的上下文，适合短期追踪。

**按节奏重复，顺便设次数或停止条件：Loop。**

```text
/loop 5m 检查刚才的构建是否完成，状态未变化就不重复汇报 --times 3
```

Loop 的第一次唤醒会尽快触发，后续按间隔执行；用 `/loop stop` 停止。不要同时给同一个检查开 Heartbeat 和 Loop。

**围绕一个目标接着做：Goal。**

```text
/goal 阅读练习项目现有测试，生成一份遗漏清单。只读文件，不修改代码；写完清单即结束。
```

Hermes 会判断是否完成，必要时继续下一轮；用 `/goal pause` 暂停。判断仍可能出错，因此“完成标准”要具体。Goal 不会自动创建 Kanban 卡片，也不等于多 Agent 分工。

这些继续执行的动作都会消耗模型用量。先试一个有明确终点的小任务，再安排长期工作。[Cron](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron)、[Heartbeat](https://hermes-agent.nousresearch.com/docs/user-guide/features/heartbeat)、[Loop](https://hermes-agent.nousresearch.com/docs/user-guide/features/loops)、[Goal](https://hermes-agent.nousresearch.com/docs/user-guide/features/goals)

## 8. Gateway：电脑上配置，手机上使用

完成前面的实验后，再接消息平台。以 Telegram 为例：

```bash
# 向导中设置Bot Token和允许使用的用户，随后前台启动Gateway。
hermes gateway setup
hermes gateway
```

在手机上发：“今天练一道 JVM 题。”如果使用 interview Profile，配置和启动都带 `-p interview`，保证加载同一份 Skill 和 Memory。

```text
手机消息 → Gateway → Hermes执行任务 → 结果发回手机
                              ↓
                   Host上的文件、工具、记忆
```

任务在 Host 上执行，不在手机上。Gateway 和 Dashboard 是不同的服务：前者接消息与承担相关后台调度，后者提供管理界面。开着网页不代表手机机器人在线。

先限制允许使用的用户，再接真实仓库；不要让陌生人通过机器人调用你机器上的终端。[消息平台说明](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram)

## 9. 面试助手：用少量代码看懂 MCP 接在哪里

现在才需要讨论自己的业务。第一版甚至可以只用 Skill 配合文件工具读写 Markdown；记录多了、需要查询统计，再接 Java。

整个过程只需看这张图：

```text
Skill规定练习流程，Memory记录“每天十五分钟”
                  ↓
Hermes通过MCP取题 → 等待用户回答 → 评价并请求确认
                                      ↓
                            MCP保存原回答与反馈
                                      ↓
                             下次查询薄弱主题
```

Java 侧可以只有三个操作。下面是**业务流程示意，不是可运行项目，也不是 Hermes Java SDK**；Repository 的查询和保存省略：

```java
class InterviewService {
    Question getNextQuestion() {
        // Java查询持久化记录后选题；Hermes负责把题目问给用户。
        return questions.pickNext(reviews.weakTopics());
    }

    void submitAnswer(Review review) {
        // 分开保存原回答、模型反馈和用户确认后的建议分数。
        // 这里不再调用模型，避免两边都控制面试流程。
        reviews.save(review);
    }

    List<String> getWeakTopics() {
        // 返回已保存记录的统计，不让模型凭聊天印象猜进度。
        return reviews.weakTopics();
    }
}
```

真正接入时，由 MCP Server 把这些方法暴露成 Tool；Hermes 根据工具说明发起请求，Java 返回结果，Hermes 再组织回答。普通 Java 方法并不会因为名字出现在文章里就成为 MCP 工具。

因此分工很清楚：**Skill 管方法，Memory 管偏好，Java 管记录，Hermes 管对话与工具调用。** 这里没有已经建好的面试系统，本文也不展开 Maven、数据库和 Controller 的完整实现。[Hermes MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)、[官方 Java MCP SDK](https://github.com/modelcontextprotocol/java-sdk)

## 10. Hook、Plugin、Provider：需要时再往下扩展

### Hook：在指定时机做检查或记录

比如拦截某类终端操作，或者记录每次工具调用耗时：

```text
pre_tool_call → 检查参数 → 允许或拒绝
工具执行完成 → post_tool_call → 记录结果、耗时
```

`pre_tool_call` 可以返回 `{"action":"block","message":"拒绝原因"}`；`post_tool_call` 主要观察已经发生的执行。Shell Hook 可以指向独立脚本，原生 Plugin Hook 用 Python 回调注册。

想把事件发给 Java，用 Outbound Webhook；它只能通知，不能靠接收器的响应撤销工具操作。不要把仅在 Gateway 中触发的 `HOOK.yaml` 回调，当成所有工具调用的拦截器。[Hook 文档](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks)

### Plugin：把这些扩展装到 Hermes 里

一个只记录工具名和状态的最小原生插件：

```text
~/.hermes/plugins/tool-audit/
├── plugin.yaml
└── __init__.py
```

`plugin.yaml`：

```yaml
name: tool-audit
version: 1.0.0
description: 记录工具执行状态，不记录参数和结果正文
provides_hooks: [post_tool_call]
```

`__init__.py`：

```python
import logging

log = logging.getLogger(__name__)

def after_tool(tool_name, status="unknown", duration_ms=0, **kwargs):
    # Hermes在工具调用结束后调用；不写参数，避免把密钥和用户正文记进日志。
    log.info("tool=%s status=%s duration_ms=%s", tool_name, status, duration_ms)

def register(ctx):
    # 加载时注册回调，执行任务时才触发after_tool。
    ctx.register_hook("post_tool_call", after_tool)
```

用 `hermes plugins list` 确认发现后，执行 `hermes plugins enable tool-audit`，开新会话跑一个只读工具，再到 Logs 查看。日志级别需允许 INFO。

这是原生 Python 插件 API；Java 业务不必为此重写，继续通过 MCP 或 HTTP 接入即可。Plugin 还能注册工具、命令和其他扩展，先从一个小功能开始。[插件教程](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins)

### Provider：替换已有功能的后端

换模型先用 `hermes model`；接业务先用 MCP。只有你要实现自己的模型后端、记忆存储、上下文处理，或搜索、浏览器、终端后端时，才需要研究对应 Provider。

例如新增“查询复习成绩”是加 Tool；让现有 `web_search` 改用内部搜索服务是换 Provider。两者不是同一件事。[搜索 Provider 示例](https://hermes-agent.nousresearch.com/docs/developer-guide/web-search-provider-plugin)

## 11. HTTP API 和 ACP：从其他程序使用 Hermes

MCP 的方向是 Hermes 调外部工具。反过来，如果自己的 Java 程序想让 Hermes 执行整个任务，可以用 HTTP API。

在当前 Profile 的 `.env` 中配置：

```dotenv
# KEY换成自己的随机密钥，仅在本机监听；不是模型服务商的API Key。
API_SERVER_ENABLED=true
API_SERVER_HOST=127.0.0.1
API_SERVER_KEY=replace-with-a-long-random-secret
```

启动相应 Gateway 后，先用一个请求理解交互：

```bash
# 当前终端需设置与服务端相同的API_SERVER_KEY。
curl http://127.0.0.1:8642/v1/chat/completions \
  -H "Authorization: Bearer $API_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"hermes-agent","messages":[{"role":"user","content":"只回复你好，不调用工具"}]}'
```

Java 用 HttpClient 发同样的请求即可。`stream:true` 使用 SSE；Chat Completions 的多轮消息由客户端维护。API 可以执行 Agent 工具，不要把密钥放进公开网页。[API Server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server)

**ACP 则面向 IDE / Agent Client**，用于展示对话、工具活动、文件变更和审批。装好 ACP extra 后先运行 `hermes acp --check`，客户端的启动命令配置为 `hermes`、参数为 `["acp"]`。它不是 MCP Server，也不是普通 HTTP 聊天端点。[ACP 接入](https://hermes-agent.nousresearch.com/docs/user-guide/features/acp)

## 12. 按这个顺序体验就够了

1. 打开 Dashboard，完成一次读文件或测试任务，回看工具结果。
2. 写一个小 Skill；纠正它一次，再检查是否把有效做法保存下来。
3. 记住一条偏好，换会话验证；分清 Memory 和历史记录。
4. 用 Delegation 做一次三方面只读审查，再看是否需要长期 Profile / Bot。
5. 安排一个 Cron，检查实际执行与投递；任务有依赖时再用 Kanban。
6. 确实需要自己的业务数据，再接 MCP；不要为练一道题先搭一套系统。

本文依据 [2026-09-08 源码快照](https://github.com/NousResearch/hermes-agent/tree/9fd44b4dfc44138b9e5d5689acb56c438364ff7b)及对应官方资料整理；你的安装版本可能尚未包含最新界面或命令。文中的 Java 段落明确是流程示意，Dashboard、多 Agent 和消息平台步骤没有冒充本次真实运行记录。
