---
title: "《从零实现 Agent 系统》连载 13｜安全防线：注入、社工、DLP、密钥与宪法式约束"
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
summary: "《从零实现 Agent 系统》连载 13｜安全防线：注入、社工、DLP、密钥与宪法式约束"
tags:
---

# 《从零实现 Agent 系统》连载 13｜安全防线：注入、社工、DLP、密钥与宪法式约束

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第13篇
> **核心主题**：安全防线/注入防护

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目Agentium，源码详见GitHub。

连载 12 《治理平面：策略引擎、审批与审计血缘》
的 

PolicyEngine

 回答「这个 tenant 能不能调这个 tool」。

本篇是并联的纵深防御

：用户粘贴的网页、模型吐出的回复、工具返回的 JSON、通道出站邮件——都可能有注入、密钥、社工话术。

策略管授权；scanner 管内容

——两件事都要，且每一道闸应知道自己在流水线的 

哪一 stage

，审计里写清楚。

纵深防御：与策略并联，不是替代

Policy 说 

ALLOW

 只代表「规则允许尝试」；内容仍可能有毒。安全模块宜 

确定性、可单测、可审计

——首版多用规则/regex/熵，而不是再堆一个黑盒模型（以后可换实现，

API 形状

保持稳定）。

Agentium 里同一套 probe/guard 会出现在 

AI 网关 ContentSafetyPipeline

（
连载 06
）与 

ToolRegistry 预检/后检

（
连载 05
），以及 

OutboundOrchestrator 出站

（
连载 10
）。

别只装一处

——模型表面、工具边界、通道边界各守一遍。

五条链路：stage 放哪

产品文档里常画 

ingress → pre_context → pre_tool → post_llm → egress

。实现可以分步落地，但 

审计 event 应标 stage

，避免「做了 DLP 却说不清扫的是 tool 还是 LLM 输出」。

Stage

典型位置

常见 scanner

ingress / 入站

通道 normalize、Chat API 进门

注入 probe（未信任用户文本）

pre_llm / 模型前

网关 

evaluate_inbound

PromptInjectionProbe

pre_tool / 工具前

Registry execute 预检

注入、MisuseDetector、评测污染 guard

post_tool / 工具后

Registry handler 返回后

DLP、SecretLeak、SocialEngineering（入/出双向）

post_llm / 模型后

网关 

evaluate_outbound

DLP、SecretLeak、ConstitutionalGuard

egress / 出站

OutboundOrchestrator

DLP + SecretLeak + SocialEngineering

工具后检在审计里可标 

tool_output_post

，与未来的 

post_llm

、

egress

 区分——

诚实标注覆盖范围

 比夸大「全链路已防护」更重要。

提示注入探测（PromptInjectionProbe）

针对 

不可信文本

（用户消息、爬进 prompt 的外部内容、工具参数里的字符串）：关键词/模式分档 

high / medium / low

。

high

（如 instruction override、exfiltration、privilege escalation）→ 

blocked

；

medium

（社工 urgency、tool hijack 话术）→ 可告警不拦，或按产品升级；

结果带 

indicators

 列表，写入 

prompt_injection_blocked

 审计。

网关 inbound 与 tool 预检 

复用同一 Probe 类

，source 字段区分 

ai_gateway

 / 

tool_args

——规则迭代一处生效。

社工与滥用（SocialEngineeringGuard / MisuseDetector）

SocialEngineeringGuard

：credential phishing、urgency pressure、authority impersonation、policy bypass、转账话术等；规则带 

severity

，累计超阈值 

block

。工具后检对 

inbound 参数与 outbound 结果各扫一遍

——防止模型帮写「请把 OTP 发我」类 outbound。

MisuseDetector

：credential abuse、fraud pattern、bot orchestration 等 

滥用信号

；命中写 

misuse_signal_detected

，动作为 

manual_review

 / 

rate_limit

 等——可与
连载 04
 背压、
连载 12
 审批联动，而不一定当场 hard block。

DLP 与密钥：模式 + 熵，互补

DLPClassifier

：regex/规则库，动作分 

mask

（邮箱、电话打 

[REDACTED]

）与 

block

（SSN、AWS AKIA、PEM 私钥、Bearer token）。结构化 payload 

遍历字符串叶子

 扫描。

SecretLeakGuard

：补 DLP 盲区——对 

高 Shannon 熵

 的长 token 告警（新生成的随机 secret 没命中已知 pattern 也能拦）。返回 

redacted_preview

 供审计，别把原 secret 写进日志。

二者关系：

DLP 认形状，SecretLeak 认随机性

；网关 outbound 与 tool post、channel egress 

宜都挂

。

宪法式 guard（ConstitutionalGuard）

对 

input + output 成对

 评估有害类别（malware、credential_theft、violent_harm 等 baseline 关键词）。输出 

policy_label

 与 

fallback_mode

：

输出有毒 → 

deny

；

仅输入有毒 → 可 

hitl_required

；

否则 

safe_rewrite

 等。

在网关 

post_llm

 与 tool 链路可并联；

不能替代

 PolicyEngine 的 tenant/tool 规则，而是兜 

内容安全

 底。

可运维：block、redact、pass 都要留证

每个 stage 统一形状：

verdict = scan(stage, payload)

if

 verdict.blocked:

    audit(stage, verdict, block)

    raise PolicyDenied / 

return

 blocked

if

 verdict.redacted:

    audit(stage, verdict, redact)

    payload = verdict.redacted

return

 pass

要点：

Domain pack

 可追加 

dlp_rules.yaml

（
连载 12
），与默认规则 merge；

规则变更走发布/回滚，别 hot-patch 生产 regex；

medium 风险宜 

metrics 可见

（blocked 率突增 = 误杀或攻击）；

单测用 

fixture 句子

 锁行为，避免「改一条 regex 全库 silent」。

一张流水线图

伪代码：pipeline_stage

function

 PipelineStage(stage, ctx, payload) -> Payload | Error:

    

if

 stage 

in

 {ingress, pre_llm, pre_tool}:

        inj := PromptInjectionProbe.Scan(payload.text)

        

if

 inj.blocked:

            Audit(

"prompt_injection_blocked"

, stage, inj)

            

return

 Blocked

    

if

 stage == pre_tool:

        

for

 sig 

in

 MisuseDetector.Detect(payload.text):

            Audit(

"misuse_signal_detected"

, stage, sig)

    output := RunInner(stage, payload)   

# LLM / tool handler / channel

    

if

 stage 

in

 {post_tool, post_llm, egress}:

        dlp := DLPClassifier.Classify(output)

        

if

 dlp.blocked:

            Audit(

"dlp_blocked"

, stage, dlp.labels)

            

return

 Blocked

        output := dlp.masked_or_original

        leak := SecretLeakGuard.Scan(output)

        

if

 leak.blocked:

            Audit(

"secret_leak_blocked"

, stage, leak.redacted_preview)

            

return

 Blocked

        se := SocialEngineeringGuard.Classify(output.text)

        

if

 se.blocked:

            Audit(

"social_engineering_blocked"

, stage, se)

            

return

 Blocked

    

if

 stage == post_llm:

        cg := ConstitutionalGuard.EvaluateExchange(input, output.text)

        

if

 cg.output_blocked:

            Audit(

"constitutional_blocked"

, stage, cg.policy_label)

            

return

 Blocked

    Audit(

"stage_pass"

, stage)

    

return

 output

几句容易踩坑的地方

只有 Policy 没有 scanner

——ALLOW 了带私钥的工具输出。

scanner 只挂网关不挂 tool post

——RAG/工具脏数据直进 loop。

DLP 只 mask 不 block 私钥

——PEM 必须 block。

SecretLeak 阈值过低

——误杀正常 hash。

社工 guard 只扫 outbound

——用户 prompt 钓鱼进不来也拦不住 inbound。

审计不写 dlp_stage

——合规问「哪一段漏了」无法答。

Constitutional 替代审批

——HITL 与内容 deny 语义不同，别混。

规则改完不跑回归测试

——上线后才发现整站不可用。

收束一下，下一篇讲什么

本篇应能在流水线上 

标注

 注入、DLP、密钥、社工、宪法 guard 的位置，并说清 

block / redact / pass

 与审计 stage 的关系。

下一篇进入 

后台平面（Background）

：定时/事件触发、守护进程、与前台 Chat 共用核心但权限与存储怎么分。（连载 14）

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922964&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVOr9Xr7ZWfN3cBS*003UvEIOVPvRM0-gqPSqILA*Q92PSsxkjO1TXYiSpSS7p6BO5EYIEF2OXItdyr7qryTejdB&new=1
