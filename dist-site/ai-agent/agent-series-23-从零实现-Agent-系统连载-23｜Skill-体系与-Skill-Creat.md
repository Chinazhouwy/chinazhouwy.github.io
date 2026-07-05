# 《从零实现 Agent 系统》连载 23｜Skill 体系与 Skill Creator：能力打包与迭代

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第23篇
> **核心主题**：Skill体系/Skill Creator

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目 Agentium，源码详见 GitHub

连载 05
 的 

Tool

 是「注册表里能 execute 的一行行能力」；
连载 11
 的 

MCP

 是「外部工具上架进同一张表」。

Skill

 又是第三种东西：不是又多一个 HTTP handler，而是一整包 

可版本化的操作说明

——

SKILL.md

、附带脚本与资源、触发语义、可选的记忆策略覆盖。

可以把 Skill 想成 

给 Agent 的 SOP 压缩包

：模型先知道「什么时候该用这份 SOP」，再在需要时把正文（或脚本）拉进上下文或沙箱。Agentium 仓库里的 

skills/

 目录就是运行时技能树；

Skill Creator

 则是一套 

写 SOP → 跑 eval → 改描述 → 再打包

 的迭代环。本篇讲清 Skill 与 Tool / Persona 的边界、怎么路由与绑定会话，以及 creator 怎么落地；控制面 CRUD 的 Admin 细节留到连载 30。

Skill、Tool、Persona：别混成一张表

概念

是什么

典型落点

Tool

可被模型点名、走 execute 七步的注册项

ToolRegistry

Skill

目录 + 

SKILL.md

（frontmatter + 正文）+ 可选脚本

skills/

 资源树，经内置工具 

materialize

Persona

角色/语气/组织语境 overlay

连载 31；与「能干哪类活」的 Skill 正交

Skill 不会自动变成 Tool

。运行时靠两个内置桥：

skill_run

（按 query 路由，返回排序与 

skill_body

 正文）和 

skill_invoke

（在技能包内跑 

allowlist 里的脚本

，过沙箱与策略）。Chat 的自动 tool loop 里通常 

不暴露

 skill_run / skill_invoke（blocklist），更常见是 

会话绑定 skill tag

，把节选正文拼进 

system

（

Bound skill: …

 + 有预算的 markdown 节选）。

这样分工的好处：

工具表

管原子能力（查库、发消息、跑代码）；

技能包

管领域流程（怎么做 deep research、怎么写 docx）；

Persona

 管「你是谁」而不是「步骤怎么排」。

一棵技能树：

SKILL.md

 与合并发现

每个技能一个子目录，根文件 **

SKILL.md

**：YAML frontmatter 里至少 **

name

、

description

**（

name

 与目录名一致，小写连字符）。正文是给人和模型读的长说明；还可放 

examples/

、参考文档、Creator 自带的 grader 说明等。

发现时扫描多个根，按优先级合并：

项目内 

skills/

 > 用户目录 

~/.agentium/skills

 > 环境指定的配置根

。同名 skill 

先出现的赢

——方便企业把「标准包」放仓库、个人实验放用户目录而不改主树。

frontmatter 里还可带 **

memory_profile

 / 

memory_rules

**（
连载 17
）：按会话上绑定的 skill 顺序 

后绑定的覆盖先绑定的

，合并进 EffectiveMemoryProfile——例如 deep-research 打开 MID 语义抽取、关掉 data_context 自动捕获，而不改全局默认。

Query → Skill：路由、绑定、注入

路由（v1）

 是确定性的：对用户 query 与每个技能的 

name

+

description

 做分词重叠，名字命中加权，再叠加少量 

同义词/扩展名

 规则（例如 query 里出现 mcp 时抬高 

mcp-builder

）。产出排序列表；

skill_run

 取 Top 1 作为 primary，附带 ranked 列表与可截断的 

skill_body

。

会话绑定

 更常用在 Chat：创建或更新 session 时指定 

skill tag

（如 

deep-research

），Turn 组装 system 时追加 

Bound skill

 行，并通过 

build_skill_addon_text

 把该包 

SKILL.md

 正文（去掉 frontmatter）以 

字符上限

 截断后拼进去——超预算会标明 truncated，避免一份 10 万字 SOP 打穿 context。

skill_invoke

 是「真动手」路径：脚本路径必须在包内 

agentium_script_allowlist.txt

 里，解析后不能逃出技能目录；策略上 

decide_skill_use

 / 

decide_skill_script

 与通用 

decide_tool_call

 分开；执行走 

SafetySandbox

 的 subprocess capability。没 allowlist 就别指望「任意 bash」——这是刻意的 fail-closed。

Skill Creator：把「写技能」做成可评测环

仓库自带 

skill-creator

 技能包：目录与 

SKILL.md

 frontmatter 

对齐 Anthropic Agent Skills 的打包规范

，但 

不依赖其 runtime

——在 Agentium 里仍走本项目的技能发现、路由与沙箱。包内正文写清一条产品化流程：

定意图 → 写草稿 → 写测试 prompt → 执行 eval → 人审 + 定量指标 → 改 SKILL → 扩大测试集

。

两条用法，别混：

对话内（在线）

：用户提出新能力需求时，会话可绑定或路由到 

skill-creator

；Agent 在 Creator 的 SOP 引导下访谈、写 

SKILL.md

、补用例，产出目录后落入用户技能根或仓库 

skills/

，再像普通技能一样绑定使用。

CLI（离线）

：CI 或开发者本地 

非交互

 执行评测与打包，与 Chat Turn 热路径解耦。

Creator 侧重 

触发召回率（trigger accuracy）

 与 

步骤完备性（step soundness）

——前者测「用户这么说时会不会选中这份技能」，后者靠人工审阅与包内 grader 看流程是否缺步。这与
连载 21
 的 

tool ACI eval

 互补：

ACI 管参数 schema、输出键与执行正确性

；Creator 

不管

 Tool 说明书是否合规。

Agentium 在 CLI 上 

收敛为稳定入口

：

**

agentium skill-creator eval --skill PATH --cases FILE

**：对指定技能目录执行 

trigger/描述

 评测（内部调用 bundled 

scripts/run_eval.py

）。用例 JSON 为 

对象数组

，每项至少含 **

query

**（用户句）与 

should_trigger

（bool）；脚本按阈值统计触发率并输出 pass/fail 摘要，

进程退出码非 0 即失败

，适合挂进 CI。

**

agentium skill-creator package --skill PATH [--output DIR]

**：把技能目录打成 

.skill

 分发包

，便于拷贝到用户技能根或走 Admin 导入。

默认工作目录为仓库内 

skills/skill-creator

；

支持通过 

AGENTIUM_SKILL_CREATOR_ROOT

 覆盖工作目录

。包内 

agents/

、

references/

 放评测用 grader、comparator 说明——

仅用于离线评估，不随 skill runtime 加载进 Chat

。

实践上建议：**

description

 写清「何时触发」

（包内也可单独跑 description improver）；

eval 未通过时，优先迭代 description 与 frontmatter，避免在触发尚未稳定的阶段引入新 Tool**。通过后再考虑挂 

memory_profile

 与是否允许 

skill_invoke

 脚本。

和相邻连载的接缝

17 记忆

：

memory_profile

 按 skill 合并，决定各层写/Recall 行为。

21 ACI

：工具说明书；Skill 的「说明书」是 

SKILL.md

，触发准确率靠 Creator eval + 路由分。

22 defer

：Skill 不替代 tool_search；领域 SOP 进 system，原子能力仍走 Registry。

30 Admin

：HTTP 技能目录 CRUD、探测——运维向，本篇不展开。

几句容易踩坑的地方

把 Skill 当 Tool 注册进 Chat loop

——skill_run 被 blocklist，应靠 session 绑定或显式 turn。

description 写成人话小作文但不写触发条件

——路由分低，Creator eval 也过不了。

三个技能根优先级搞反

——以为改了用户目录，实际被项目内同名覆盖。

SKILL.md 无 frontmatter

——发现直接失败。

skill_invoke 无 allowlist

——只能看文档，不能跑脚本。

脚本路径不在 allowlist 或路径穿越

——必须拒绝。

memory_profile 合并顺序理解反

——后绑 skill 覆盖先绑，不是「先挂优先」。

整包正文塞进 prompt 不做截断

——

chat_skill_body_max_chars

 存在就是为了防这个。

Creator eval 通过就上大流量

——先小集 eval，再扩用例集（Creator 原文也强调 scale up）。

收束一下，下一篇讲什么

Skill 是 

版本化的能力包

：

SKILL.md

 定名、触发语义与可选记忆策略；多根合并发现；会话绑定把节选送进 system，

skill_run / skill_invoke

 负责路由正文与 allowlist 脚本。迭代靠 

Skill Creator

 的 eval/package CLI，与 tool ACI、defer 分工明确。

下一篇进入 

评测与发布门

：eval runner、污染隔离、leak baseline、发布门如何把「能跑」变成「证据够才发」。（连载 24。）

你们领域知识是做成 Skill 包、还是拆成一堆 Tool？触发评测做过吗？欢迎评论区聊聊。

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922964&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVOTwUhfsp18u3Q1J4RTQFyX*xcD2r9sGc5a4JPpwf3QEER6VZZYgnnaQQBuEfxTaWDaWVBjGiHiSqgeTELU48Ot&new=1
