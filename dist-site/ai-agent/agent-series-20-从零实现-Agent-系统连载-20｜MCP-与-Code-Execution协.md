# 《从零实现 Agent 系统》连载 20｜MCP 与 Code Execution：协议、档位与 Sidecar

> **类型**：📚 参考资料（非面试题/面经）
> **来源**：公众号「IchbinDerek」《从零实现 Agent 系统》连载 第20篇
> **核心主题**：MCP/Code Execution/Sidecar

---

对照项目 

Agentium

 的背景：
Agentium 论文与开源项目介绍
。本文图表及核心设计均来自开源项目 Agentium，源码详见 GitHub

连载 11
 讲过 

MCP 怎么进 ToolRegistry

——外部工具也要过契约、租户隔离，执行仍走同一套 execute 管线。
连载 09
 讲过 

沙箱

——路径、出站、超时不能指望模型自觉。真到接 MCP、又让模型写代码去调工具时，还会多出一层：

工具是直接由宿主代调，还是先放进一段 Python，再在隔离环境里间接调 MCP？

工具一多，上下文会爆；把几十个 MCP 端点全塞进 prompt 也不现实。业界常见两条路：

direct-tool

（Agent运行时根据模型识别工具名称和参数并直接执行）和 

code execution with MCP

（模型产出代码，在 sidecar 里跑，代码再通过受控桥回调工具）。Agentium 用 

mcp_execution_tier

 把这条选型写进请求上下文，并和 

消息处置方式

（collect / followup / steer）一起进审计——事后能回答「这一轮到底是直调还是走代码沙箱」。

MCP 在系统里占哪一层

可以把 MCP 理解成：

在 Registry 之外发现工具，上架时仍对齐内置工具的契约与风险标签

。加载器做契约校验、可选签名校验、按租户加前缀，登记后的名字和 capabilities 与内置工具并列；

supply_origin 标成 mcp 也不豁免

策略、预算、沙箱和审批——插件层管「能不能上架」，execute 层管「能不能执行」。

运维侧还有一层 

预设与探测

：仓库里可以版本化管理 MCP Server 的 JSON 预设，控制面提供注册、探测连通性；当前阶段不少部署仍是 

配置落库 + 探测

，真正把远端 MCP 长连接进运行时 Registry 还在逐步打通——别把「能在后台点 Test 成功」等同于「模型已经能稳定调用」，中间还差装配与契约对齐。

本篇焦点不在「怎么写 MCP Server」，而在 

入站之后怎么执行

：档位、处置、代码 sidecar、凭证边界。

两档执行：

direct-tool

 与 

code-exec-mcp

默认是 

direct-tool

：模型通过 tool loop 点名，Agent运行时在 

RequestContext

 里带着租户、trace、档位与处置方式，走 Registry 的 execute 七步——和
连载 05
 一致。

code-exec-mcp

 表示这一轮允许走 

「先代码、再工具」

 的路径：内置的 

code_run_python

 会进入 sidecar 编排——代码体积、超时、stdout/stderr 都有上限；出站探测时，目标主机必须在 allowlist 里，否则直接 

egress_denied

，不偷偷放行。

两档差异不是「MCP 协议不同」，而是 

工具触达点不同

：直调是Agent替模型握手；code-exec 是模型写代码，代码再通过 

受控桥

 回调 Registry 里允许的那几个工具名。

消息处置：collect、followup、steer

除了「怎么调工具」，入站还要记 

这轮用户话在对话里扮演什么角色

（常见的 

collect / followup / steer

 三分法）：

collect

：正常收集一轮输入，默认姿态。

followup

：续写、追问、短句接着聊——时间线语义上更像「接上一段」。

steer

：带纠正、打断、改方向的语气——协调层可以据此调整 steer/collect 策略（具体与连载 25 入站协调衔接）。

用户也可以在请求里显式带上处置与档位；若打开 

auto_ingress

，服务端用规则从正文推断（例如出现 sandbox、python -c 等词 → 倾向 code-exec-mcp；出现 steer 类动词 → 倾向 steer），

不额外烧一轮 LLM

，适合  可控、可测的入口。

连载 28 的 

interaction_mode

 会把档位和处置「打包」：plan 模式工具关、直调；autonomous 模式工具开、默认 code-exec-mcp；agent 模式在请求档位上透传。这和
连载 19
 的 

orchestration_mode

 仍是两层：一个选流水线，一个选这一轮油门。

Sidecar：默认关、打开也要过桥

code_run_python

 的实现分两层，读者别混：

MVP 默认（fail-closed）

：环境开关未打开时，sidecar 

不执行任意 Python

，只返回结构化信封——代码多大、允许哪些 MCP 端点声明、出站策略是什么、是否因 egress 被拒。便于 UI、E2E 和合规审计先把 

档位与策略线

 接好，再谈真跑代码。

真执行 + 工具桥（需显式打开）

：打开代码执行与 code-MCP 编排后，Registry 在执行 code_run_python 且档位为 code-exec-mcp 时，会注入 

ToolInvokeBridge

：在临时目录写片段，可选生成 

agentium_tools

  shim，子进程通过 

本机url + 一次性 token

 发 JSON 请求，宿主侧 

ToolBridgeServer

 校验 token 后，只允许 

allowlist 内的工具名

 再进 execute——输出 JSON 过大直接拒，避免 sidecar 把巨量 tool 结果灌回模型。

要点就一句：

凭证和全量 Registry 不进沙箱环境变量

；沙箱里只有端口、token 和生成好的 shim，能调哪些工具由宿主 allowlist 决定。桥的生命周期绑在这一轮 execute 上，用完即拆。

这与 Anthropic 等强调的 

code execution with MCP

 同族：减少「每个工具一次往返进上下文」，把过滤、截断留在宿主；Agentium 当前是 

可观测、可门禁的 MVP

，真跑代码仍要运维显式开开关，别默认全网可执行。

和沙箱、治理怎么并联

连载 09
沙箱

：工具 handler 若触达文件/网络，仍走 SafetySandbox 的路径与出站策略；code-exec 多了一层 

片段级

 超时与输出 cap。

连载 12
治理

：高风险工具照样可挂审批；桥回调仍走 execute，不会从子进程绕开 PolicyEngine。

连载 16
可观测

：档位、处置、sidecar 状态（stub / executed / egress_denied / timeout）、是否启用 tool_bridge，都应能进日志与审计，方便对账「为什么这轮没真跑代码」。

开发期还有一个 

MCP 桩工具

：不发起真实 MCP 连接，只按当前档位返回确定性 mock 信封，用来验证 Chat 入站是否把 tier 和 disposition 传进上下文——别把桩当成生产集成验收。

几句容易踩坑的地方

两档不分，什么都直调

——代码类任务无法收束出站与输出大小。

code-exec 默认就开真执行

——未评估 allowlist 就上生产，等于远程代码入口。

把 API Key 写进模型生成的片段

——违背凭证不进沙箱；应走宿主连接器或短期 token 桥。

桥 allowlist 过宽

——子进程能回调高危工具，侧车变提权通道。

桥输出不截断

——一次 tool 结果撑爆上下文。

auto_ingress 当智能路由

——规则推断有误时要允许用户显式覆盖档位。

disposition 与档位不记审计

——出事后无法解释「为何判成 steer / code-exec」。

桩工具结果当真实 MCP 响应

——联调通过但线上未接 Server。

收束一下，下一篇讲什么

接 MCP 时要想清三件事：

上架仍走 Registry 契约

；

执行分 direct-tool 与 code-exec-mcp 两档

，并和 collect / followup / steer 一起写入上下文与审计；

代码路径默认 fail-closed

，真跑也要靠本机 token 桥回宿主 execute，凭证不进沙箱。这样工具变多以后，才有地方做过滤、截断和治理，而不是把端点列表无限塞进 prompt。

下一篇进入 

工具契约 ACI

：description、schema、examples 怎么写模型才用得稳，以及评测驱动改工具描述、CI 门禁怎么挂上去。（连载 21）

你的 Agent 是「工具直调」为主，还是已经上了「模型写代码再调 MCP」？sidecar 和 allowlist 你们怎么收口的？欢迎评论区聊聊。

---

## 原始链接

https://mp.weixin.qq.com/s?src=11&timestamp=1780922888&ver=6770&signature=0b2wbl9aoAD5lzhbJ*q0zA45wmCrOav82ExDkBEhTVMrrR7rZpKF5Fj5gqyWF0rTHpqQe9z55HV-C3FUx96DUjc1sSpMbDsvbPnkDC-loNwWje8gwpNYxl*dKTtJilKu&new=1
