---
title: "《从零实现 Agent 系统》连载 11｜插件与 MCP：扩展性与加载边界"
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
summary: "《从零实现 Agent 系统》连载 11｜插件与 MCP：扩展性与加载边界"
tags:
---

# 《从零实现 Agent 系统》连载 11｜插件与 MCP：扩展性与加载边界

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第11篇
> **核心主题**：插件/MCP扩展

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目Agentium，源码详见GitHub。

连载 05《工具系统：契约、注册与安全默认》
 把 

ToolRegistry

 讲成运行时唯一执行表；
连载 10 《多通道（Channels）：同一核心，多种入口》
把通道收成适配器。

本篇回答扩展从哪来

：编排后端、记忆泳道、Wiki、Evolution、外部 MCP 工具——若各写一套「注册 + 执行 + 审计」，核心会膨胀。

plugins/

 管「怎么装配、怎么换实现」；

tools/

 管「名字进表之后怎么过闸门」——边界清楚，加载失败时才有 

安全默认

。

plugins/ 与 tools/：别混成一个目录

目录 / 层

职责

典型内容

tools/

工具契约、注册表、内置 handler、

execute 七步管线

Registry、Contract、builtin_*

plugins/

按配置 

实例化

 可选能力，并向 Registry 

登记

 或 

替换后端

MCP loader、LLM-Wiki、memory/orchestration 工厂

原则：

所有能进模型点名的能力，最终都要 merge 进 ToolRegistry

（或显式 blocklist）；插件代码 

不应

 在 Chat handler 里偷偷 

def my_tool(): ...

 绕过 execute。

MCP 是 

外延

：远程或独立进程暴露 tool 描述 + handler 桥接；LLM-Wiki 是 

产品插件

：

enabled

 时才 

register_llm_wiki_tools

，否则 

no-op

，不留空壳 handler。

插件配置：YAML 单源、启动时校验

企业部署宜有一份 

runtime_plugins.yaml

（名称随项目），用 Pydantic 收成 

PluginsConfig

：

orchestration

：

native

 / 

langgraph

（
连载 08
）；

memory

：

memory

 / 

sqlite

 / 

mem0

、可选 mem0 泳道（
连载 07
）；

evolution

：自学习提案插件是否启用、HTTP 是否暴露；

llm_wiki

：Wiki 管线、存储后端、会话检索门控等。

load_plugins_config

 在 

进程启动

 读盘校验：

extra = forbid

 防 typos 静默忽略；非法组合 

直接 fail fast

，别跑到一半才发现 memory backend 拼错。

解析后生成 

fingerprint

（无密钥字段）打进 telemetry / REPRO——换插件配置等于换行为版本，要能追溯。

PluginRuntime

 一次装配：编排引擎、memory backend、evolution + proposal queue，交给 bootstrap 注入容器——与
连载 01
「薄入口、厚装配」一致。

MCP：外部工具怎么进 Registry

Model Context Protocol

 在工程里落地成：

一组 tool descriptor + 与 Registry 对齐的 contract

。

McpLoader

 负责：

assert_contract_valid

——描述长度、schema、示例等与内置工具同一标准（
连载 05
）；

可选 

require_signature

：缺 

signature_digest

 则 

拒绝注册

 + 审计 

mcp_plugin_unsigned_blocked

；

register ToolSpec

，

supply_origin="mcp"

，capabilities / risk_level 显式声明；

tenant_scope

：若设置，工具名前缀为 

tenant::tool

，

list_tools_for_tenant

 才可见——防 A 租户插件泄漏给 B。

MCP handler 仍是普通 callable；

execute 管线、沙箱、策略

 不因 supply_origin 豁免。插件层只保证「

上架合格

」，不负责「

执行特赦

」。

伪流程：

discover MCP tools → build McpToolDescriptor → loader.register_descriptor → registry 与内置工具并列

。

产品插件示例：LLM-Wiki 的边界

Wiki 类插件典型三步：

配置 

llm_wiki.enabled

；

bootstrap 构建 

LlmWikiPluginService

（存储、ingest、search）；

register_llm_wiki_tools(registry, service)

——service 为 

None

 时 

整段跳过

。

handler 内仍走 

precheck

（例如 session 有 pending ingest job 时 deny search），再调宿主 search——业务规则在 plugin service，

门禁形状

与 Registry 一致。

这说明：

plugins/ 可以很大

，但对外暴露面仍应 

收敛为少量 ToolSpec

，别把整个 Wiki HTTP 堆进 tool loop。

加载失败与安全默认

场景

宜采取

YAML 校验失败

启动拒绝，不 partial boot

MCP 无签名且开启 require_signature

单工具拒绝，审计

mem0 泳道可选实例化失败

打 warning，禁用外联泳道，native 可用则继续

llm_wiki 未 enabled

不注册 wiki 工具，API 路由也可不挂

orchestration backend 未知

ValueError，不 silent fallback

插件 HTTP 子服务

默认 

http_enabled=false

，显式打开

默认拒绝

：新 MCP 工具不是「自动全员可见」；tenant_scope、signature、risk_level 与 blocklist（
连载 05
Chat 暴露子集）叠加。

插件进程崩溃或 MCP 断连：

已注册 handler 调用失败

 应走 ToolRegistry 错误通路，而不是让 loop 挂死——超时与 cancel 仍由
连载 04
/
09
 兜底。

一张白板图：从配置到 Registry

伪代码：load 与 merge

function

 LoadPlugins(config_path) -> PluginRuntime:

    cfg := ParseAndValidateYaml(config_path)   

# Pydantic, extra=forbid

    fingerprint := NonSecretFingerprint(cfg)

    orch := BuildOrchestration(cfg.orchestration)   

# native | langgraph

    mem := BuildMemoryBackend(cfg.memory)

    evo := BuildEvolution(cfg.evolution)

    

return

 PluginRuntime(orch, mem, evo, fingerprint)

function

 MergeMcpIntoRegistry(registry, mcp_server, opts):

    loader := McpLoader(registry, require_signature=opts.require_signature)

    

for

 tool 

in

 mcp_server.ListTools():

        desc := ToDescriptor(tool, contract=BuildContract(tool))

        try:

            loader.register_descriptor(desc)

        catch UnsignedError:

            AuditBlocked(desc.name)

            

if

 opts.fail_closed:

                raise

            

continue

    

return

 loader

function

 BootstrapTools(registry, plugin_runtime, settings):

    RegisterBuiltinTools(registry, settings)

    

if

 settings.llm_wiki.enabled:

        svc := BuildLlmWikiService(settings)

        RegisterLlmWikiTools(registry, svc)

    MergeMcpFromConfiguredServers(registry, settings)

几句容易踩坑的地方

MCP 工具不经 Contract 直接 register

——描述与 schema 漂移，评测不可复现。

plugins 里直接 subprocess

——绕过 sandbox（
连载 09
）。

配置 secret 写进 YAML

——应 

*_from_env

 引用。

一个插件改全局 PolicyEngine

——应用 domain pack 显式 merge，别 import 副作用。

加载失败仍 half-start

——半套 MCP + 半套内置，audit 对不上。

tenant_scope 只做命名前缀不做 list 过滤

——跨租户工具泄露。

Wiki 开 enabled 但不 gate pending job

——检索与 ingest 竞态，用户看到空结果或脏结果。

收束一下，下一篇讲什么

本篇应能说清：

plugins/ 装配与 tools/ 执行的分界

、YAML 校验与 fingerprint、

McpLoader merge Registry

 的 contract/签名/租户 scope，以及 

加载失败时的 fail-fast 与 no-op

。

下一篇进入 

治理平面

：策略引擎、审批闸口、审计血缘——高敏操作如何必须过 gate。（连载 12）

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922925&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVO*gX-7QQ7fsm3hbFXX1ZSdyO8N2Xm0c0sUkC9Ks-ibm27SlxFYHNbu8AshXLc*ZEGaLqt*KI0F6zWUlMrBV-Ur&new=1
