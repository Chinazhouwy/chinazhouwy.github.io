# 《从零实现 Agent 系统》连载 21｜工具契约 ACI：写好 Agent 能用的工具

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第21篇
> **核心主题**：工具契约ACI

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目 Agentium，源码详见 GitHub

连载 05
 讲过 

ToolRegistry 与 execute 七步管线

——工具要先登记，再进策略、预算、沙箱与审计。很多团队做到这里就停了：handler 能跑、OpenAI 

tools

 数组里也有名字，模型却老是 

点错工具、参数字段拼错、失败了一次就乱重试

。

问题往往不在模型，而在 

人机接口（ACI，Agent-Computer Interface）

：模型读到的说明书，和运行时真正执行的语义，是不是同一本、够不够「可教」。Anthropic 等工程实践里，

改工具描述往往比换更大模型更划算

——前提是契约可测、失败可归类、迭代可留痕。本篇在 05 之上把 

ToolContract、上架门禁、重叠审计、评测改描述

 讲透。

契约：给模型和给 Registry 的同一本说明书

一份合格的 

ToolContract

 至少说清楚五件事：

名字与版本

——和 ToolSpec 同名，版本进 catalog 与策略绑定，换行为别静默改契约。

描述

——给模型读的自然语言，不是一行占位；系统有 

最小长度门禁

（环境可配，默认十几字量级），空壳和「TODO」过不了注册。

input_schema / output_schema

——参数与返回的 JSON Schema 片段；执行前校验 args，执行后可对照形状做 sanity check。

failure_semantics

——失败能不能重试、是否幂等、要不要补偿、常见错误码有哪些；模型和重试逻辑据此决定「再调一次」还是「换条路」。

examples

——至少一个正例（典型 args + 期望输出轮廓）；人和评测对齐「正常长什么样」，也可按需抽进 prompt（连载 22 的 examples 注入是另一层开关）。

契约字段 

禁止悄悄塞未知键

（schema 收紧），避免「多写一个 typo 字段却没人看见」的漂移。

上架时走 

assert_contract_valid

：缺契约、名字对不上、描述空/太短、

没有 examples

 都会在 

register

 阶段直接失败——fail-closed，不把烂工具混进 catalog。Registry 还可开 

require_contract

 模式：所有工具必须带契约，适合生产与 CI 严格环境。

注册与执行：说明书不能只躺在文档里

ToolSpec

 管运行时：capabilities、风险级别、handler、

supply_origin

（内置 / MCP / 插件等）。

ToolContract

 管可读性与可测性。两者合并登记；重名冲突即失败。

模型在 Chat loop 里看到的，是契约里的 

description + schema

 转成的厂商 tools 载荷（
连载 03
、
18 
的 DSML 附录是另一层格式转换，但 

语义仍来自同一份契约

）。执行时仍走 
05
 那条管线：访问控制 → 策略/审批 → 预算 → 安全预检 → handler → 输出后检 → 审计；日志里带 

supply_origin

，方便对账「这次是谁家的工具」。

连载 20
 的 

code-exec-mcp

 档位下，高风险工具还可被额外拒绝——契约写得再漂亮，也绕不过执行平面的 tier 与角色门禁。

写好 ACI 的几条土法（比堆参数名重要）

一个工具一件事

——名字和描述里别让模型在「搜索」和「发邮件」之间猜。

描述写清边界

——必填/可选、单位、枚举含义、失败时返回什么键；别把业务规则只写在 handler 注释里。

examples 用真实形状

——缺键、错类型在评测里会先爆。

failure_semantics 诚实

——写操作标非幂等，别让 loop 无脑重试出双倍副作用。

大结果要会分页

——契约或描述里说明 limit/cursor（工具实现里真分页更好）；别把万行 JSON 一次塞回模型（
连载 07
 的 context 预算也兜不住）。

capabilities 别撞车

——多个工具挂同一组能力标签，模型更难选；应用审计脚本抓重叠（见下）。

描述宜 

concise 但信息密度高

：先一句「干什么」，再一句「何时用 / 何时别用」，再列关键参数约束；不必把 OpenAPI 全文贴进 description——schema 已经占 token 了。

重叠审计：工具多了以后先查「长得像」

内置工具按 profile 批量注册后，可用 

重叠度审计脚本

 扫一遍：按 

capabilities 签名

 分组，若多把工具共享同一签名，输出 JSON 报告。CI 加 

--strict

 时，有重叠组就直接失败——逼你在合并工具或拆分能力标签之间做选择，而不是让模型在五个「都能查库」的入口里 roulette。

这是 cheap 的静态门禁，不能替代运行时 ACI 评测，但能拦住「复制粘贴式加工具」。

评测驱动改描述：先度量，再改说明书

tool ACI eval

 的思路很简单：为每个关键工具准备 

固定 args + 期望输出键

；在真实 

RequestContext

 下走一遍 

execute

（策略、预算、审批都会真实触发）。通过则记 pass；失败则归类——缺输出键、policy_denied、approval_required、budget_exceeded、普通 tool_error 等。

失败时生成 

ToolDescriptionPatchSuggestion

：在现有描述末尾 

启发式追加

 提示（例如应包含哪些 output keys、args 里有哪些字段名）——

第一版不自动改 Registry

，只出报告和可导出的 patch JSON，方便 dry-run 和人工审阅。运维可跑 

eval 循环脚本

 把报告落盘，再决定哪些描述要进 PR。

这和「换模型」是正交的：

同一份 eval 集

，改描述前后各跑一遍，用通过率当发布证据（连载 24 发布门会接这条链）。当前建议生成是 

规则拼接

，后续可再接 LLM 改写，但都应 

可追溯、可回滚

（契约 version 别乱跳）。

与相邻连载的接缝

05

：本篇是契约与评测的深化，execute 七步不变。

11
 / 
20

：MCP 工具同样要带 ToolContract 才能上架；supply_origin 区分来源。

22

：工具多了以后 defer_loading、tool_search、examples 进 prompt——在契约合格之后再谈「少塞上下文」。

23

：Skill Creator 的 grader 思路与 ACI eval 同族——都是 

改能力包而不是盲目加模型

。

几句容易踩坑的地方

只有 handler 没有 contract

——开发环境能跑，一开 require_contract 全挂。

examples 敷衍成空对象

——能过门禁但模型仍学不会。

描述与 schema 矛盾

——description 写「必填 user_id」，schema 里却没字段。

failure_semantics 全默认 false

——重试把写操作执行两遍。

高风险的标成 low

——只为进 Chat loop，审计却按低风险放行。

重叠 capabilities 不审计

——工具越多越乱点。

评测失败就手改描述不上 eval

——下周回归又坏。

eval 建议自动写回生产 Registry

——未审阅的 patch 可能把描述撑爆 token。

supply_origin 乱标

——出事后查不清是内置还是 MCP。

以为改工具描述不如换 70B

——在 ACI 没测清之前，换模型常是贵且不确定的赌注。

收束一下，下一篇讲什么

工具系统的分水岭，往往不在「能不能 execute」，而在 

契约是否可教、可测、可迭代

：ToolContract 统一模型与审计的说明书；register 门禁挡住空壳；重叠审计减少「五个工具干一件事」；ACI eval 用固定用例度量失败，并产出可审阅的描述 patch，而不是 silent 改表。

下一篇进入 

Tool Search 与按需加载

：工具注册表变大以后，怎么 defer、怎么搜、怎么把 examples 以可控 token 塞进 prompt——在契约合格的前提下减上下文。（连载 22）

你们改 Agent 工具时，是先写 eval 再改 description，还是反过来？欢迎评论区聊聊。

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922888&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVPQZFokuvtXO1YtLXnQHVyAfdPKQJsTHzIER1ZRniHRFMLtuPfCoPfM1lDhO8jJk*daVvZjMSwChhjYtnQIaD3v&new=1
