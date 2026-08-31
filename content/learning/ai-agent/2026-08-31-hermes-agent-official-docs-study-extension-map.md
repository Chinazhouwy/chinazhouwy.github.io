---
title: "Hermes Agent 官方文档全景研读：从 429 个源码文档到可扩展运行时"
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
summary: "基于 Hermes Agent 官方文档、中文翻译树、用户故事和固定源码提交，梳理运行时架构、状态边界、Skills/MCP/Hooks/Plugins 扩展层级，并给出适合 Java 开发者的源码阅读与实战路线。"
tags:
  - "Hermes Agent"
  - "Agent"
  - "源码阅读"
  - "Plugins"
  - "Hooks"
  - "Skills"
  - "MCP"
  - "Java"
---

# Hermes Agent 官方文档全景研读：从 429 个源码文档到可扩展运行时

这篇不是把官方文档重新翻译一遍，也不是罗列命令。目标是回答三个更有用的问题：

1. Hermes 到底由哪些运行时部件组成，一条消息如何穿过这些部件？
2. Skill、Memory、MCP、Hook、Plugin、Provider、Platform Adapter 分别应该解决什么问题？
3. 作为 Java 开发者，应该从哪里接入，才能真正练到 Agent Harness 的工程能力？

## 1. 本次快照的证据边界

| 项目 | 本次快照 |
|---|---|
| 快照日期 | 2026-08-31 |
| 官方源码提交 | `d63f996a757f6255fc1454239616ab4b4435e0f5` |
| `llms.txt` 机器推荐页 | 208 页 |
| `website/docs/` 源码文档 | 429 个 Markdown/MDX 文件 |
| `zh-Hans` 简体中文文档 | 315 个 Markdown/MDX 文件 |
| 208 个主文档中已有中文翻译 | 165 个 |
| 208 个主文档中尚无中文翻译 | 43 个 |
| 官方用户故事 | 326 条，15 类，11 个来源 |

仓库中同时保存了结构化快照 `data/hermes-docs-catalog.json`。它记录：

- 208 个机器推荐页面的 URL、源码路径、简介、完整二三级标题、行数和字节数；
- 429 个源码文档与 208 个推荐页面之间的差集；
- 简体中文翻译覆盖情况；
- 用户故事的分类和来源聚合；
- 三份上游输入的 SHA-256，防止以后把不同版本的资料混在一起分析。

生成脚本是 `scripts/build-hermes-docs-catalog.js`。它不会把约 4 MB 官方全文复制进本站，只保存可检索、可复核的结构信息。以后更新 Hermes 时，应重新拉取官方仓库并生成新快照，而不是在旧结论上继续打补丁。

```bash
# 先把官方仓库拉到任意独立目录，再从本站仓库执行：
node scripts/build-hermes-docs-catalog.js \
  --source-root /path/to/hermes-agent/website/docs \
  --zh-source-root /path/to/hermes-agent/website/i18n/zh-Hans/docusaurus-plugin-content-docs/current \
  --source-commit "$(git -C /path/to/hermes-agent rev-parse HEAD)"
```

脚本会在线读取官方 `llms.txt`、`llms-full.txt` 和用户故事数据；也可以用 `--index`、`--full`、`--stories` 指向本地快照，做完全可重复的离线生成。

官方入口：

- [Hermes Agent 文档](https://hermes-agent.nousresearch.com/docs/)
- [机器可读目录 llms.txt](https://hermes-agent.nousresearch.com/docs/llms.txt)
- [机器可读全文 llms-full.txt](https://hermes-agent.nousresearch.com/docs/llms-full.txt)
- [简体中文用户故事](https://hermes-agent.nousresearch.com/docs/zh-Hans/user-stories)
- [本次固定源码提交](https://github.com/NousResearch/hermes-agent/tree/d63f996a757f6255fc1454239616ab4b4435e0f5)

## 2. 先给结论：Hermes 不是聊天机器人，而是 Agent 运行时

把 Hermes 只理解为“接上微信或 Telegram 的聊天机器人”，会错过大半设计。更准确的结构是：

```text
交互入口
  CLI / TUI / Desktop / Gateway / ACP / HTTP API / Batch
        |
        v
统一 Agent 内核
  Prompt 组装 -> 模型解析 -> Agent Loop -> Tool 调度
        |
        +--> Session / Memory / Context / Skills
        +--> Terminal / Browser / Web / MCP / 文件工具
        +--> Cron / Goal / Loop / Heartbeat / Kanban / Delegate
        +--> Hook / Plugin / Provider / Platform Adapter
        |
        v
结果流与持久化
  流式事件 / 审批 / 消息投递 / SQLite / 日志 / 外部 Webhook
```

它真正的价值不只在模型回答，而在下面六个能力同时存在：

1. **统一执行循环**：同一个 `AIAgent` 服务 CLI、网关、ACP、批处理和 API。
2. **真实工具环境**：文件、终端、浏览器、Web、MCP 与不同沙箱后端进入同一工具注册和调度链。
3. **长期运行入口**：网关、Cron、Heartbeat、Goal、Loop、Kanban 让 Agent 不必依赖一个终端窗口存活。
4. **状态分层**：会话、用户画像、长期记忆、项目上下文、Skill 和配置不是一个“大记忆文件”。
5. **安全与人机协作**：授权、配对、危险命令审批、Hook 拦截、隔离环境、回滚与审计共同构成边界。
6. **扩展层次完整**：从一份 Markdown Skill，到外部 MCP，再到进程内插件、Provider 和 Platform Adapter，复杂度逐层上升。

这也是学习 Hermes 的正确姿势：不要先改模型提示词，先把“入口、状态、循环、工具、扩展、持久化”六条链路跑明白。

## 3. 官方文档地图

### 3.1 208 个机器推荐页面

| 官方栏目 | 页数 | 重点问题 |
|---|---:|---|
| Getting Started | 7 | 安装、更新、平台支持、Nix、Termux |
| Using Hermes | 27 | CLI、TUI、配置、模型、Session、Profile、Desktop、安全与 Secrets |
| Core Features | 31 | Tools、Skills、Memory、Context、Plugins、Heartbeat、Loop、Dashboard |
| Automation | 8 | Cron、Delegation、Kanban、Goal、Code Execution、Hooks、Batch |
| Media & Web | 5 | Voice、Browser、Vision、Image、TTS/STT |
| Messaging Platforms | 35 | 微信、Telegram、Discord、Slack、Webhook、API Server、A2A 等入口 |
| Integrations | 11 | 外部服务和云环境集成 |
| Guides & Tutorials | 35 | 部署、安全、模型接入、工作流和故障排查 |
| Developer Guide | 35 | Agent Loop、Prompt、Provider、Tools、Storage、Gateway、Plugin、ACP |
| Reference | 13 | CLI、配置、环境变量、Skill 目录和自动化蓝图 |
| More | 1 | 用户故事 |

### 3.2 为什么源码里有 429 个文档

208 不是仓库全部文档，而是官方 `llms.txt` 选择的主阅读面。源码树还有 221 个未进入机器目录的页面，主要来自单个 bundled/optional Skill 的说明页。源码文档按一级目录统计如下：

| 源码目录 | 文档数 |
|---|---:|
| `user-guide/` | 333 |
| `developer-guide/` | 35 |
| `guides/` | 35 |
| `reference/` | 13 |
| `getting-started/` | 7 |
| `integrations/` | 4 |
| 根级首页和用户故事 | 2 |

因此学习时应该分两层：

- **主干层**：先读 208 个机器推荐页里的关键页面，建立架构。
- **能力目录层**：需要某个具体 Skill 或集成时，再查额外 221 个源码页。

简体中文路由也不是“全部已经翻译”。本次固定提交中，208 个主页面有 43 个没有对应中文文件，访问 `zh-Hans` 时可能看到英文回退内容。遇到中文说明与源码不一致时，应回到同一提交的英文文档和代码核对。

## 4. 326 条用户故事真正说明了什么

### 4.1 分类分布

| 类别 | 数量 | 类别 | 数量 |
|---|---:|---|---:|
| Dev Workflow | 77 | Personal Assistant | 49 |
| Integrations | 32 | Creative | 26 |
| Business Ops | 23 | Meta & Ecosystem | 23 |
| Cost Optimization | 20 | Privacy & Self-Hosted | 13 |
| Content Creation | 12 | Enterprise | 12 |
| Research | 12 | Messaging | 11 |
| General | 9 | Trading & Markets | 5 |
| Marketing | 2 |  |  |

来源分布为 Discord 116、X 61、Reddit 60、GitHub 38、Blog 20、YouTube 17，其余来自 Gist、Hacker News、LinkedIn、Podcast 和 Product Hunt。

### 4.2 我的归纳，不是官方承诺

**第一，开发工作流和个人助理占绝对多数。**

社区最常用的不是复杂的多 Agent 学术架构，而是让一个长期运行的 Agent 接管重复的开发、检索、整理、通知和跨应用操作。这说明产品价值首先来自“能接触真实环境并持续工作”。

**第二，消息平台通常只是薄客户端。**

手机上的微信、Telegram 或 Discord 负责输入、审批和接收结果；真正的代码、会话、记忆、工具和凭据仍在用户控制的 Hermes Host 上。把通道层和执行层分开，才便于隔离权限、切换模型和迁移入口。

**第三，稳定自动化依赖外部事实源。**

靠谱的模式通常是：脚本、数据库、Git 仓库或 API 提供确定事实，Agent 负责理解、决策和解释。把任务状态只放在对话历史或 Memory 里，迟早会发生漏记、重复和自我发挥。

**第四，多角色更适合用 Profile 隔离。**

面试、日常助理、发布维护、研究等角色对模型、记忆、Skill、工具权限和会话长度的要求不同。Profile 是状态和权限边界；往一个全局 Skill 里不断追加特例，不是隔离。

**第五，收益故事只能当灵感，不能当验证。**

用户故事是社区提交的帖子、Issue、视频或讨论，不是统一实验条件下的测评。特别是交易收益、成本下降和“完全自治”一类表述，必须回到代码、日志、费用和失败样本重新验证。

## 5. 一条消息如何穿过 Hermes

以消息网关为例，主链路可以压缩成九步：

1. 平台 Adapter 把微信、Telegram 等原始事件归一化成 `MessageEvent`。
2. `GatewayRunner` 做内部事件过滤、用户授权、配对和命令分发。
3. 网关根据平台、用户、群组或线程解析 Session Key。
4. Session Store 从 SQLite 恢复对话历史和会话元数据。
5. `AIAgent` 组装系统提示词，解析 Profile、Provider、Model、Tools 和 Context。
6. 模型返回文本或 Tool Call；工具调度器进行 schema 校验、审批、执行和错误包装。
7. 如果有工具结果，结果重新进入 Agent Loop，直到模型停止、预算耗尽、被中断或触发失败处理。
8. 流式输出、工具事件、审批请求和最终答复经 Adapter 投递回原平台。
9. 消息、Token 使用、Session 状态和必要的生命周期事件被持久化或推送。

```text
MessageEvent
  -> Gateway auth / pairing / command guard
  -> Session key + SQLite history
  -> AIAgent
       -> PromptBuilder
       -> Runtime Provider
       -> LLM
       -> Tool Registry / Dispatcher
       -> Hook / Approval / Environment
       -> loop
  -> Platform delivery
  -> Session persistence / metrics / webhooks
```

源码阅读时要刻意区分三类状态：

- **请求内状态**：本轮模型消息、Tool Call、临时回调、取消信号。
- **会话状态**：消息历史、标题、分支、压缩谱系、Token 使用，主要在 SQLite。
- **跨会话状态**：Profile、配置、Memory、USER、SOUL、Skills 和项目上下文。

把这三层混在一个提示词或 Markdown 文件里，就是许多“Agent 越用越乱”的根源。

## 6. Hermes 的文件和状态边界

| 载体 | 职责 | 谁写 | 何时生效 |
|---|---|---|---|
| `config.yaml` | 模型、工具、网关、插件、Hook、内存策略等运行配置 | 用户或管理工具 | 通常重启进程/新会话后 |
| `.env`、`auth.json`、Secret Provider | 凭据和 Provider 授权 | 用户或认证流程 | Provider 解析时 |
| `SOUL.md` | Agent 身份、语气和长期行为风格 | 用户 | 新会话组装 Prompt 时 |
| `USER.md` | 用户画像和偏好 | Agent 的 memory tool 或用户审校 | 新会话的冻结快照 |
| `MEMORY.md` | 环境事实、长期经验、关键约定 | Agent 的 memory tool 或用户审校 | 新会话的冻结快照 |
| `.hermes.md` / `AGENTS.md` | 项目规则、命令、架构和仓库约定 | 项目维护者 | 在项目中启动新会话时 |
| `skills/**/SKILL.md` | 按需加载的专业流程和知识 | 用户、Agent 或 Skill Hub | 被发现后，按需 `skill_view` |
| `plugins/<name>/` | 进程内代码扩展 | 插件开发者 | 插件启用并重启后 |
| `state.db` | Session、消息、搜索和运行状态 | Hermes | 实时持久化 |
| Cron/Kanban 数据 | 计划任务和耐久任务状态 | Hermes 与任务工具 | 调度器读取时 |

当前固定提交的内置 Memory 很小：`MEMORY.md` 默认上限 2200 字符，`USER.md` 默认上限 1375 字符。它们是每次新会话都要携带的“高价值常驻索引”，不是知识库，也不是任务明细仓库。

历史细节应放在 SQLite Session 中，通过 FTS5 的 `session_search` 按需检索；项目规则应放项目上下文；复杂流程应放 Skill；结构化进度应放仓库、数据库或任务板。这个分工比“定期让模型自己整理所有记忆”可靠得多。

还要注意冻结快照：会话中途写入 Memory 虽然会立即落盘，但系统提示词里的 Memory 不会在本会话内刷新。新开会话后才会重新注入。配置存在、文件写入成功，也不等于当前运行中的 Gateway 已经加载。

## 7. Skill、MCP、Hook、Plugin 到底怎么选

### 7.1 一条从轻到重的扩展阶梯

| 层级 | 机制 | 改变什么 | 最适合 | 主要风险 |
|---:|---|---|---|---|
| 1 | Profile / Config | 模型、工具、权限、网关和独立状态 | 隔离面试、日常助理、发布维护 | 多 Profile 配置漂移 |
| 2 | SOUL / Project Context | 身份、项目约定、固定规则 | 沟通风格、仓库命令、验收规范 | 塞入任务明细导致 Prompt 膨胀 |
| 3 | Skill | 按需加载的流程和知识 | 可重复 SOP、输出模板、领域检查清单 | 写成特例垃圾场；没有运行时强制力 |
| 4 | MCP | 进程外工具和结构化数据能力 | Java 服务、数据库、企业 API、受控写操作 | Schema、超时、权限和幂等性 |
| 5 | Hook / Outbound Webhook | 生命周期观察、拦截、变换和事件推送 | 审计、通知、策略门、上下文注入 | 热路径延迟、失败策略和敏感数据泄露 |
| 6 | General Plugin | 进程内工具、Hook、命令、状态和 UI 扩展 | 深度接入 Hermes 生命周期 | Python 代码与宿主同权限，升级兼容性 |
| 7 | Provider Plugin | 替换模型、记忆、上下文、浏览器等后端 | 企业 Provider、本地模型、外部 Memory | 契约复杂，通常单选或影响全局行为 |
| 8 | Platform Adapter | 新消息平台和投递通道 | 企业 IM、私有协议、移动端桥接 | 授权、线程语义、回调与媒体兼容 |
| 9 | ACP / TUI RPC / HTTP API | 从外部程序驱动完整 Agent | IDE、Java Host、自定义控制台 | 会话、流式事件和审批协议 |
| 10 | 修改 Core | 改 Agent Loop、Tool Runtime 或 Session 内核 | 官方扩展面确实无法满足的底层创新 | 最大维护成本和合并成本 |

选择原则很简单：**能用更轻的公开扩展契约解决，就不要碰更重的内部状态。**

### 7.2 Skill 不是代码插件

Skill 的本质是按需加载的 Markdown 能力包。官方采用三级渐进披露：

```text
Level 0: skills_list()                 只看名称、描述和分类
Level 1: skill_view(name)              加载 SKILL.md
Level 2: skill_view(name, path)        加载某个 references/templates/scripts 文件
```

Skill 适合表达：

- 什么时候触发；
- 具体步骤；
- 常见失败；
- 固定输出格式；
- 如何验证；
- 需要哪些工具、环境变量和参考文件。

Skill 不适合表达：

- 每次请求都必须执行的安全策略；
- 并发锁、幂等、事务和重试；
- 运行时模型切换的底层状态；
- 大量每日任务和历史对话；
- 不能依赖模型自觉遵守的强约束。

因此“强制每天记录固定字段”如果只写在 Skill 里，仍然可能漏。更可靠的做法是：Skill 规定流程，Java/MCP 或校验脚本保存和校验结构化数据，Hook 在生命周期边界做审计。

### 7.3 MCP 是 Java 最自然的边界

MCP 将外部服务的工具 Schema 动态注册进 Hermes。它既可以是本地 stdio 进程，也可以是 HTTP 服务，并支持工具白名单、黑名单、环境变量替换、OAuth、mTLS 和按服务器过滤。

对 Java 开发者而言，MCP 的好处是：

- Hermes 保持 Python，不需要为了接入 Spring Boot 去 Fork Agent 内核；
- Java 服务拥有数据库、事务、鉴权、幂等和领域模型；
- LLM 只看到有限、清晰、可审计的工具；
- 同一个 Java MCP 还可以被 Codex、Claude Code 或其他 MCP Client 复用。

## 8. Hermes 里其实有四套 Hook

官方 Hook 文档明确区分四个系统：

| 系统 | 注册方式 | 运行位置 | 能否改变流程 | 典型用途 |
|---|---|---|---|---|
| Gateway Hook | `~/.hermes/hooks/<name>/HOOK.yaml + handler.py` | 仅 Gateway | 主要观察，不拦截 Agent 工具 | 网关启动、Session、Agent 步数、命令日志 |
| Plugin Hook | `ctx.register_hook()` | CLI + Gateway，进程内 | 可以拦截、变换、注入或观察 | 工具策略、模型上下文、指标、生命周期 |
| Shell Hook | `config.yaml` 的 `hooks:` | CLI + Gateway，子进程 | `pre_tool_call` 可阻止或修改 | Bash/Python 审计脚本、格式化、秘密扫描 |
| Outbound Webhook | `hooks.outbound:` | 后台 HTTP 投递 | 不回写本次流程 | CI、监控、外部 Java 服务、另一个 Agent |

### 8.1 失败策略比 Hook 名称更重要

- Gateway Hook 的异常被隔离和记录，不应击穿 Agent 主链路。
- Python Plugin Hook 与 Agent 同进程，热路径回调必须足够快。
- Shell Hook 默认 fail-open；安全门必须在 `pre_tool_call` 上显式配置 `fail_closed: true`。
- Shell Hook 首次使用有命令级同意机制，非 TTY Gateway 要提前批准，否则新 Hook 不会注册。
- Outbound Webhook 在后台线程投递，支持 HMAC 签名；接收端仍要按 `delivery_id` 去重并检查时间戳。

### 8.2 文档和源码已经出现漂移

在本次固定提交中：

- `website/docs/user-guide/features/plugins.md` 仍写“当前接受 26 个生命周期事件”；
- 同一提交的 `hermes_cli/plugins.py` 中，`VALID_HOOKS` 实际登记了 37 个 Hook 名称；
- 新增项包括流式事件、审批、转录、Kanban Worker 和平台边界事件。

这说明扩展开发不能只抄文档里的数字。正确顺序是：

1. 固定源码 commit；
2. 先看用户文档理解语义；
3. 再看 `VALID_HOOKS`、`PluginContext` 和具体 fire site；
4. 用最小插件在真实 CLI 与 Gateway 各跑一次；
5. 给契约写自动化测试。

## 9. Python Plugin 的公开契约

一个普通插件的最小结构是：

```text
~/.hermes/plugins/my-plugin/
├── plugin.yaml
├── __init__.py        # register(ctx)
├── schemas.py         # 模型看到的工具 Schema
└── tools.py           # 实际 Handler
```

第三方普通插件默认需要进入 `plugins.enabled` 才会执行。项目内 `.hermes/plugins/` 还要显式开启项目插件，并且只应信任自己审过的仓库。

本次源码里的 `PluginContext` 已经提供大量公开入口：

- `register_tool`、`register_hook`、`register_command`、`register_cli_command`；
- `register_skill`、`register_system_prompt_section`、`register_middleware`；
- `get_config`、`set_config`、`state`、`profile_name`；
- `llm.complete`、`llm.complete_structured`；
- `call_mcp`、`dispatch_tool`、`inject_message`；
- `register_platform`、`register_platform_handler`；
- Context、Memory、Image、Video、Web Search、Browser、Terminal、Secret、TTS、STT 等 Provider 注册面；
- `on_unload` 和受宿主管理的后台任务。

插件应该优先使用这些公开面。直接访问 `gateway._session_model_overrides` 一类下划线字段，虽然短期能跑，但没有升级兼容保证，也容易绕开锁、校验和清理生命周期。

### 9.1 Provider Plugin 不是普通 Tool Plugin

几类 Provider 有独立的发现和选择方式：

- Model Provider 可以同时注册多个，由配置或请求选择；
- Memory Provider 通常发现多个、激活一个；
- Context Engine 通常发现多个、激活一个；
- Browser、Web Search、Image、Video、Terminal Environment 等由对应配置选择；
- Platform Plugin 注册一个消息通道，但实际启用还需要网关配置。

写 Provider 前要先回答：它是“增加一个能力”，还是“替换全局运行后端”？前者通常是 Tool/MCP，后者才是 Provider。

## 10. Java 开发者最值得做的三个项目

### 项目一：Hermes Java Practice Bridge

这是最适合当前面试资料系统的实战项目，也能真正练到 Harness，而不是再做一遍聊天 Demo。

```text
微信 / CLI
   -> Hermes 的 interview Profile
   -> 面试流程 Skill
   -> Spring Boot MCP Server
        -> 题库索引
        -> 练习记录
        -> 评分与追问事实
        -> Git 提交点
   -> Markdown 归档 / GitHub Pages
```

建议工具契约：

| Tool | 作用 | 写权限 |
|---|---|---|
| `practice_plan_next` | 按未完成题目、优先级和复习债务返回候选题 | 只读 |
| `practice_get_question` | 返回题目、来源、标准答案证据和已知追问 | 只读 |
| `practice_start_round` | 建立一次答题 Attempt，返回稳定 ID | 幂等写 |
| `practice_append_turn` | 追加用户回答、追问和模型反馈 | 只追加 |
| `practice_finalize` | 固化评分、纠错、复习级别和下一次日期 | 条件写 |
| `practice_validate` | 校验 front matter、日期、编号和必填章节 | 只读 |
| `practice_publish` | 触发受控构建，不直接让模型任意执行 Git | 需审批 |

关键设计：

- 一道题可以一个新 Session，但 Attempt 状态必须在 Java/仓库里，不依赖会话历史；
- 用户原回答和模型标准答案分字段保存，纠错只追加，不能悄悄改写历史；
- 每个写接口带 `attemptId` 和幂等键；
- Tool 返回结构化错误，让 Agent 能纠正，而不是吞掉异常；
- 发布动作与内容写入分开审批；
- 用固定 Fixture 模型测试追问状态机，不让单元测试依赖真实 LLM。

这个项目会逼你实践 Tool Contract、Session 隔离、持久化、幂等、Human-in-the-loop、Eval 和发布链路，正好覆盖 Agent Harness 的核心能力。

### 项目二：Hermes Event Auditor

让 Hermes 原生 Outbound Webhook 把生命周期事件发给 Spring Boot：

```text
Hermes Outbound Webhook
  -> HMAC 验签
  -> delivery_id 去重
  -> Kafka 或数据库
  -> 每 Session/模型/工具的耗时与 Token 聚合
  -> SSE 推送到前端
```

先用原生 Outbound Webhook，不要一上来写插件。只有当你需要 Hermes 没有提供的字段、需要在 Tool 前阻断，或需要实时改变上下文时，再加一个极薄的 Python Plugin。

验收至少包括：签名错误、重放、乱序、超时、重复投递、敏感字段脱敏、Gateway 重启和接收端不可用。

### 项目三：公开契约版 Model Routing

不要让 Skill 直接改宿主私有字典。更稳的实现顺序是：

1. 用 Profile 隔离默认模型、Memory、Skills 和 Toolset；
2. 入口明确选择 Profile；
3. 需要临时切换时，通过 `/model`、TUI RPC 的 `command.dispatch`，或 HTTP API 的 `model` 字段；
4. 只有公开扩展面确实缺少能力时，才提炼最小插件，并为 Hermes 升级写兼容测试。

“按 Skill 自动选模型”听起来方便，但 Skill 是按需知识，不是运行时路由权威。真正的路由依据应是 Profile、任务类型、成本预算、上下文长度和工具权限，并且要记录每次决策。

## 11. 三周可执行学习路线

### 第 1 周：把主链路跑通

| 天 | 阅读与实验 | 必须产物 |
|---:|---|---|
| 1 | Architecture + Agent Loop | 画一张 CLI 与 Gateway 共用 AIAgent 的时序图 |
| 2 | Prompt Assembly + Provider Runtime | 打印一次完整 Prompt 分层；切换两个 Provider 对比解析结果 |
| 3 | Tools Runtime + Approval | 新增一个只读 Tool；制造 schema 错误和危险命令审批 |
| 4 | Session Storage + Memory | 创建、恢复、分叉、搜索 Session；验证 Memory 冻结快照 |
| 5 | Gateway Internals | 从微信消息追到 Session Key、AIAgent 和投递 Adapter |
| 6 | Cron + Goal + Heartbeat + Loop | 分别跑一次，写出生命周期和历史继承差异 |
| 7 | 总结 | 用自己的话回答“什么状态属于 Session，什么属于 Profile” |

### 第 2 周：逐层扩展

| 天 | 实验 | 验收 |
|---:|---|---|
| 1 | 写一个最小 Skill | 只在命中场景时加载，输出可验证 |
| 2 | 写一个本地 MCP Server | 白名单只暴露两个只读工具 |
| 3 | 写 Gateway Hook | 能记录 Session 生命周期，不阻塞消息 |
| 4 | 写 Shell Hook | 默认失败开放；再切到安全门失败关闭，比较行为 |
| 5 | 写 Python Plugin Hook | 同时在 CLI 和 Gateway 验证，测试卸载与重启 |
| 6 | 调用 OpenAI-compatible API | Java 客户端接 SSE、Tool 事件和 Session Header |
| 7 | 故障演练 | 超时、重复事件、插件异常、Gateway 重启、Provider 失败 |

### 第 3 周：完成 Java Practice Bridge

1. 先实现只读题库和 `practice_plan_next`。
2. 再实现 Attempt、Turn 和 Finalization 状态机。
3. 接入 Hermes MCP，并让 Skill 只描述面试流程。
4. 增加 HMAC 审计和发布前校验。
5. 使用 Fake LLM、固定题目和故障注入做回归。
6. 最后才接真实微信会话和真实模型。

每个阶段都要保存四类证据：输入、模型决策、Tool 调用、最终状态。只保存最终回答，无法判断问题出在模型、提示词、工具还是状态机。

## 12. 源码阅读地图

| 顺序 | 文件 | 重点 |
|---:|---|---|
| 1 | `run_agent.py` | `AIAgent`、循环、预算、回调、压缩、持久化 |
| 2 | `agent/prompt_builder.py`、`agent/system_prompt.py` | stable/context/volatile Prompt 分层 |
| 3 | `hermes_cli/runtime_provider.py` | Provider、Model、API Mode、凭据解析 |
| 4 | `tools/registry.py` | Tool 注册、可用性和元数据 |
| 5 | `model_tools.py`、`toolsets.py` | Schema 收集、Toolset 选择和调用分发 |
| 6 | `hermes_state.py` | SQLite、FTS5、Session 和消息持久化 |
| 7 | `gateway/run.py` | 消息授权、Session 路由、Agent 创建和投递 |
| 8 | `gateway/session.py` | 网关 Session Store 与跨平台隔离 |
| 9 | `hermes_cli/plugins.py` | PluginContext、PluginManager、VALID_HOOKS、失败策略 |
| 10 | `agent/shell_hooks.py` | Shell Hook 注册、同意、JSON 协议和 fail-closed |
| 11 | `gateway/hooks.py` | `HOOK.yaml + handler.py` 的网关生命周期 Hook |
| 12 | `tools/mcp_tool.py` | MCP 发现、过滤、调用和结果清洗 |
| 13 | `cron/jobs.py`、`cron/scheduler.py` | 调度、状态、投递和独立 Agent 生命周期 |
| 14 | `gateway/platform_registry.py`、`plugins/platforms/` | 平台注册与 Adapter 插件化 |
| 15 | `gateway/platforms/api_server.py`、`tui_gateway/server.py`、`acp_adapter/` | 三种外部驱动协议 |

建议每读一个文件，都回答五个问题：谁调用它、输入契约是什么、状态存在哪里、失败怎样传播、有哪些公开扩展点。这样读源码才会转化成自己的系统设计能力。

## 13. 常见误区和纠偏

| 误区 | 正确理解 |
|---|---|
| “记忆越多越聪明” | 常驻 Memory 应短小；历史放 Session Search，流程放 Skill，事实放外部系统 |
| “Skill 能强制所有行为” | Skill 是按需提示，不是事务、安全门或运行时 Hook |
| “一道题开新 Session 会丢进度” | 只有把进度放在对话里才会丢；外部 Attempt 状态可以跨 Session |
| “有 Cron 就是长期自治” | 还需要事实源、幂等、失败重试、可观测、审批和积压策略 |
| “Plugin 是唯一扩展方式” | 配置、Skill、MCP、四类 Hook、Provider、Adapter 和协议接口都可扩展 |
| “配置文件正确就代表运行正确” | 还要验证进程加载、真实请求、状态落盘和最终投递 |
| “用户故事证明方案有效” | 它们是线索，不是统一测评和收益证明 |
| “文档数字就是源码事实” | 快速演进项目会漂移；固定 commit 后核对常量、注册表和 fire site |

## 14. 扩展前的检查清单

1. 这个需求是知识流程、外部工具、生命周期策略、后端替换，还是新消息平台？
2. 谁是事实权威：Markdown、SQLite、Git、数据库、第三方 API，还是内存？
3. 是否能用 Profile 隔离，而不是把特例塞进全局 Skill？
4. 写操作是否具备幂等键、版本检查和回滚？
5. Hook 失败应该开放还是关闭？超时发生时谁负责？
6. 插件是否只使用公开 `PluginContext` 契约？
7. 哪些字段包含消息正文、路径、Token、用户 ID 或凭据？
8. CLI、Gateway、Cron、非 TTY 环境下是否都验证过？
9. 是否记录了上游 commit、配置版本和测试证据？
10. 升级 Hermes 后，哪组回归测试能最快发现契约变化？

## 15. 推荐阅读顺序

不要从 429 个页面第一页读到最后一页。按下面顺序，效率更高：

1. [Architecture](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture)
2. [Agent Loop Internals](https://hermes-agent.nousresearch.com/docs/developer-guide/agent-loop)
3. [Prompt Assembly](https://hermes-agent.nousresearch.com/docs/developer-guide/prompt-assembly)
4. [Provider Runtime Resolution](https://hermes-agent.nousresearch.com/docs/developer-guide/provider-runtime)
5. [Tools Runtime](https://hermes-agent.nousresearch.com/docs/developer-guide/tools-runtime)
6. [Session Storage](https://hermes-agent.nousresearch.com/docs/developer-guide/session-storage)
7. [Gateway Internals](https://hermes-agent.nousresearch.com/docs/developer-guide/gateway-internals)
8. [Which File Does What](https://hermes-agent.nousresearch.com/docs/user-guide/which-file-does-what)
9. [Persistent Memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)
10. [Skills System](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills)
11. [MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)
12. [Event Hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks)
13. [Plugins](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins)
14. [Programmatic Integration](https://hermes-agent.nousresearch.com/docs/developer-guide/programmatic-integration)
15. 最后按项目需要读 Model、Memory、Context、Terminal 或 Platform Provider 专题。

最终目标不是“看完文档”，而是能在一个真实故障前判断：问题属于模型、Prompt、Session、Memory、Tool、Gateway、Hook 还是外部事实源；然后选择最小、最稳定的扩展面把它修掉。
