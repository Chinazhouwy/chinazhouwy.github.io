---
title: "《从零实现 Agent 系统》连载 18｜DeepSeek V4 网关适配：Model Gate、Thinking 与 DSML"
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
summary: "《从零实现 Agent 系统》连载 18｜DeepSeek V4 网关适配：Model Gate、Thinking 与 DSML"
tags:
---

# 《从零实现 Agent 系统》连载 18｜DeepSeek V4 网关适配：Model Gate、Thinking 与 DSML

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第18篇
> **核心主题**：DeepSeek V4网关适配

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。

连载 06 《AI 网关：路由、限流、内容与成本》
讲 generic 

网关管线

（限流 → 安全 → 路由 → 调用）。

DeepSeek-V4 系列

（如 

deepseek-v4-flash

、

deepseek-v4-pro

）在官方报告里另有 

Thinking 信封、Think Max 系统 augmentation、DSML 工具块

 等约定——若与 legacy DeepSeek 或 OpenAI 工具 JSON 混用，会出现「模型不调用工具 / 推理字段丢失 / 非 V4 误开 DSML」一类问题。

本篇讲厂商适配子包

：用 

model gate

 决定何时启用 V4 路径，把差异关在 

网关 + Chat 组 prompt

 两处，不污染 tool loop 与 Registry。

为什么单独做 V4 适配层

原则与 
06
、
11
 一致：

协调层

只关心「这一轮用什么 model id、要不要 tools、thinking 开关」；

厂商格式

（DSML 附录、reasoning 字段解析）放在 

ai_gateway/deepseek_v4_agent/

 + 

deepseek_chat

 客户端

；

非 V4 模型 id

（不以 

deepseek-v4

 开头）

不启用

 DSML appendix、Think Max 注入、thinking HTTP 信封、DSML tool-call 合成——避免误伤旧模型路径。

这是典型的 

Vendor Adapter 子包 + Model Gate

 模式，换厂商时复制「gate + 格式转换」，不动 

ToolRegistry.execute

。

Model Gate：一行判定

is_deepseek_v4_series_model(model_id) :=

    normalize(model_id).startsWith(

"deepseek-v4"

)

有效 model 来自请求 override 或默认 

chat_completion_model

。ChatTurnService 在组装 Turn 前算 

effective_completion_model

，得到 

use_v4_adapter

 布尔值——后续 thinking、DSML、Think Max 都挂在这个 flag 上。

Thinking 模式与 Think Max

Thinking

（DeepSeek HTTP）：当开启时，请求体带 

thinking: {type: enabled}

 与 

reasoning_effort

（如 

high

 / 

max

）；

不再发送 temperature

（厂商忽略）。客户端侧把 

reasoning_content

 从响应里拆出，与 assistant 

content

 一并进消息链与 SSE。

reasoning_effort 归一化

：产品侧 

low/medium

 映射为 API 

high

，

xhigh

 映射为 

max

，未知 token 默认 

high

 以免硬失败。

Think Max

：当 V4 + thinking + effort=

max

 + 配置允许时，在 

system 后缀

 注入固定 

THINK_MAX_SYSTEM_INSTRUCTION

（报告 Table 3 原文风格）——要求完整 deliberation、穷举中间步骤与反证，

不是

普通「请一步步思考」一句带过。

非 V4 模型：

thinking_opts 置空

，不走 V4 thinking 信封。

DSML：工具描述进 system，而不是只信 OpenAI tools 参数

V4 报告 

Table 4

 规定模型用 

<|DSML|tool_calls>

 块点名工具，参数用 

<|DSML|parameter name=… string=true|false>

 包裹。

适配策略：

组 prompt 时

（仅 

use_v4_adapter && enable_tools && 配置开启

）：把 Registry 暴露的工具 schema 转成 Markdown 附录，拼进 

system suffix

（

build_dsml_tool_system_addon

 + 格式化 schema 列表）；

Completion 返回后

：若 native 

tool_calls

 为空

 但正文含 DSML 块，则 

fallback 解析

 DSML → 合成 OpenAI 形状的 

tool_calls

，供现有 tool loop 

无感执行

（

extract_dsml_tool_block

 → 

dsml_tool_calls_to_openai_tool_calls

）。

这样 

execute 管线、沙箱、策略

 仍走连载 05 同一条路；变的只是 

模型表面协议

。

Thinking 与 DSML 可并存：DSML 附录里写明 thinking 模式下须先输出 

<think>…</think>

 再 tool_calls。

协议之外：把网关从「能用」做到「会省」

上面解决的是 

协议正确性

；同一套 V4 适配层在 

成本 / 时延 / 鲁棒性

 上还有几手同样要紧：逐轮选档、前缀缓存友好、真实缓存成本、流式 idle、动态 max_tokens、多 provider。它们都做成 

默认安全的开关

，既有 V4 适配语义一律不动。

1）逐轮 auto 路由（off / heuristic / llm）

。既有实现按 env 固定 

model + thinking

，一条「你好」也可能跑 pro+max。auto 路由在 

无显式 override

 时按结构化特征选档：短问→

flash + thinking off

；带 tools / 代码块 / 多步关键词 / 近期工具报错→

pro + high

，更硬的调试/长推理→

pro + max

。

llm

 模式额外用 

一次廉价 

flash + thinking off

 预调用

 返回 

{"model","thinking"}

 小 JSON，解析失败或异常 

回退 heuristic

。

显式 override 永远赢

，决策落 

chat_auto_route

 审计（model/thinking/source/reason）。这是 

网关层

 的选档，与连载 08 的 

orchestration_mode

（模式路由）正交，所以单独放 

ai_gateway/deepseek_v4_agent/auto_route.py

 而非 

coordination/turn_router.py

。

2）前缀缓存友好布局

。DeepSeek 等会缓存 

稳定前缀

。原来 recall（每轮变）拼进 

system

，等于每轮把可缓存前缀打花。改法：第 1 条 system 只放 

稳定前缀

（base + skill + persona + DSML/ThinkMax 后缀，字节级每轮一致），recall 放 

第 2 条 system 消息

 紧随其后、对话之前，并打 

_cache_stable=False

 标记——

_derive_prompt_cache_key

 据此 

排除

 recall，缓存键与服务端真实可缓存前缀对齐。该内部标记在出网前由 

_serialize_body

 剥除，不会发给厂商。

3）真实 cache hit/miss token

。不再只本地估算「省了多少」，而是解析 

usage

 里的 

prompt_cache_hit_tokens

 / 

prompt_cache_miss_tokens

（也兼容 

prompt_tokens_details.cached_tokens

，miss 缺失时按 

prompt_tokens - hit

 推导），写进 

deepseek_completion_response

 日志，

成本可对账

。

4）流式 idle 超时

。流式原来只有整体超时，服务端「半挂」会一直占着会话租约。利用 urllib 的 

socket 超时即 per-read idle

 特性，

readline()

 抛 

socket.timeout

 时转成 

DeepSeekChatCompletionError("stream_idle_timeout")

，

快速失败可重试

。

5）动态 max_tokens

。不设上限时长输入容易截断或超额。按 

hard_limit - 估算输入 - 安全余量

 算可用额度，clamp 到 

[256, 上限]

，随 round/stream 调用透传。

6）多 provider / 自定义 headers

。

deepseek_base_url

 早可改端点，再加 

extra_headers

（

k=v;k=v

）注入到每个请求，即可指向 

vLLM / SGLang / OpenRouter

 等 OpenAI 兼容服务；不设则就是纯 DeepSeek。

“

当轮对话压缩裁剪仍以连载 07/17 为准，本篇不展开；这里只强调 recall 的 

位置

 影响前缀缓存。

配置旋钮（运维向）

典型环境开关（名称以部署为准）：

意图

说明

默认 completion model

设为 

deepseek-v4-*

 才走 V4 路径

Think Max 注入

控制是否在 effort=max 时追加 Table 3 系统 augmentation

DSML tool prompt

控制是否在 V4+tools 时追加 DSML system 附录

DSML fallback 解析

客户端是否在无 native tool_calls 时解析 DSML 块

AGENTIUM_DEEPSEEK_AUTO_ROUTE

off

（默认）/ 

heuristic

 / 

llm

，逐轮选 model+thinking；override 优先

AGENTIUM_DEEPSEEK_AUTO_ROUTE_FLASH/PRO_MODEL

auto 路由两档 model id（默认 

deepseek-v4-flash

 / 

-pro

）

AGENTIUM_PROMPT_CACHE_STABLE_PREFIX

默认 1：recall 改独立 system 消息，稳定前缀可缓存

AGENTIUM_DEEPSEEK_STREAM_IDLE_TIMEOUT_SECS

流式 per-read idle 超时，默认 300，clamp 1..3600

AGENTIUM_CHAT_DYNAMIC_MAX_TOKENS

 + 

AGENTIUM_CHAT_MAX_OUTPUT_TOKENS

动态 max_tokens 开关与上限（默认开 / 8000）

AGENTIUM_LLM_EXTRA_HEADERS

k=v;k=v

 透传额外 header（vLLM/SGLang/OpenRouter）

Quick Instruction

（Table 5 模板：

<|query|>

、

<|read_url|>

 等）在子包中作 

文档/预留 hook

；主 Chat 路径以 Thinking + DSML 为主，Quick 格式按产品需要再接。

一张白板图：V4 在 Turn 中的位置

伪代码：一轮 V4 Chat completion

function

 AssembleChatTurn(model_id, tools_enabled, thinking_user_prefs):

    use_v4 := IsDeepSeekV4Series(model_id)

    thinking := use_v4 ? ResolveThinking(thinking_user_prefs) : None

    system_suffix := []

    

if

 use_v4 and thinking.reasoning_effort == 

"max"

 and Config.ThinkMax:

        system_suffix.append(THINK_MAX_INSTRUCTION)

    

if

 use_v4 and tools_enabled and Config.DsmlToolPrompt:

        specs := ToolRegistry.OpenAiToolsToSpecs(allowlist)

        system_suffix.append(BuildDsmlToolSystemAddon(specs))

    messages := BuildMessages(persona, skill, dialogue, compaction, budget, system_suffix)

    

return

 messages, thinking

function

 CompleteRound(client, messages, thinking):

    round := client.CompletionWithTools(messages, thinking=thinking, dsml_fallback=

true

)

    

if

 round.tool_calls empty and Config.DsmlFallback:

        inner := ExtractDsmlToolBlock(round.text)

        

if

 inner:

            round.tool_calls := DsmlToOpenAiToolCalls(inner)

    

return

 round

与相邻连载的接缝

06 网关

：V4 客户端是 

ProviderClient

 的一种实现；content safety 仍在 complete 管线前后。

05 工具

：DSML 只改 

模型如何点名

；execute 七步不变。

03 loop

：

reasoning_content

 应写入 assistant 消息/metadata，便于 regenerate 与审计。

16 可观测

：completion span 宜带 

model_id

、

thinking_enabled

、

dsml_fallback_used

。

几句容易踩坑的地方

所有 DeepSeek 模型都开 DSML

——非 V4 工具调用全崩。

只发 OpenAI tools 不传 DSML 附录

——V4 不按 schema 块输出。

thinking 开着仍传 temperature

——与厂商契约冲突。

不解析 reasoning_content

——前端/日志看不到推理链。

DSML fallback 关死

——模型只吐 DSML 文本、loop 以为无工具。

Think Max 对非 max effort 也注入

——prompt 膨胀、行为漂移。

把 DSML 解析塞进 Registry

——厂商逻辑泄漏进 execute。

把 recall 拼回第 1 条 system

——每轮击穿前缀缓存（auto 省的钱又花回去）。

auto 路由覆盖了用户显式选档

——务必让 override 优先。**

_cache_stable

 标记忘了出网前剥除

——OpenAI 兼容端会因未知字段报错。

多系统消息下预算/压缩只保护 

messages[0]

**——recall 被当对话折叠/丢弃（本实现按 

system_count

 保护全部前导 system 消息）。

收束一下，下一篇讲什么

本篇应能说清：

model gate

、Thinking/Think Max、

DSML system 附录 + fallback 解析

 如何与现有 tool loop 衔接，以及 

非 V4 必须走 legacy 路径

。

下一篇进入 

Workflow vs Agent 与 Harness 三元

：编排选型、Session/Harness/Sandbox 接口，以及 Agentium 里 

orchestration_mode

 如何落地。（连载 19）

你的模型是固定一个、还是按任务复杂度动态切档，recall 又怎么摆才不砸前缀缓存？欢迎在评论区聊聊你的做法。

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922888&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVMZFt07ByNQwUnyrQ60CcEVSczRoaBYmy5ZkeUAAAEc8X9oU0LJsQYkZr9jY8GqHVZO0FNz-BpWtnqa8opgShrM&new=1
