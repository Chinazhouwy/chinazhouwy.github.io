---
title: "Agentium MCP 工具执行机制解析"
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
summary: "Agentium MCP 工具执行机制解析"
tags:
---

# Agentium MCP 工具执行机制解析

> **来源**：微信公众号（Agentium 连载 30）
> **日期**：2026-06-05
> **分类**：AI Agent / MCP / 工具执行
> **关联**：连载 11（MCP 进 Registry）、连载 09（沙箱）

---

## 一、MCP 在系统中占哪一层

**核心理解**：
> MCP = 在 Registry 之外发现工具，上架时仍对齐内置工具的契约与风险标签

```
工具上架流程：
1. 加载器做契约校验、可选签名校验、按租户加前缀
2. 登记后的名字和 capabilities 与内置工具并列
3. supply_origin 标成 mcp 也不豁免策略、预算、沙箱和审批

两层管控：
- 插件层：管「能不能上架」
- execute 层：管「能不能执行」
```

**常见误区**：
- ❌ 把「能在后台点 Test 成功」等同于「模型已经能稳定调用」
- ✅ 中间还差装配与契约对齐

---

## 二、两档执行：direct-tool 与 code-exec-mcp

| 档位 | 执行方式 | 适用场景 |
|------|----------|----------|
| **direct-tool** | 宿主按模型点名直接执行 | 默认档位，简单工具调用 |
| **code-exec-mcp** | 模型产出代码，在 sidecar 里跑，代码再通过受控桥回调工具 | 复杂任务、需要编排多个工具 |

### direct-tool（默认）

```
用户输入 → LLM 决定调用哪个工具 → 宿主直接执行 → 结果回传 LLM
```

- 模型通过 tool loop 点名
- 宿主在 RequestContext 里带着租户、trace、档位与处置方式
- 走 Registry 的 execute 七步

### code-exec-mcp

```
用户输入 → LLM 生成 Python 代码 → sidecar 执行代码 → 代码通过受控桥回调工具 → 结果回传
```

- 内置的 `code_run_python` 进入 sidecar 编排
- 代码体积、超时、stdout/stderr 都有上限
- 出站探测时，目标主机必须在 allowlist 里

**关键区别**：
> 两档差异不是「MCP 协议不同」，而是**工具触达点不同**：直调是宿主替模型握手；code-exec 是模型写片段，片段里再通过受控桥回调 Registry 里允许的那几个工具名。

---

## 三、消息处置：collect、followup、steer

除了「怎么调工具」，入站还要记**这轮用户话在对话里扮演什么角色**：

| 处置方式 | 含义 | 协调层行为 |
|----------|------|------------|
| **collect** | 正常收集一轮输入 | 默认姿态 |
| **followup** | 续写、追问、短句接着聊 | 时间线语义上更像「接上一段」 |
| **steer** | 带纠正、打断、改方向的语气 | 调整 steer/collect 策略 |

**auto_ingress**：服务端用规则从正文推断处置方式，不额外烧一轮 LLM：
- 出现 `sandbox`、`python -c` 等词 → 倾向 code-exec-mcp
- 出现 steer 类动词 → 倾向 steer

---

## 四、Sidecar：代码执行机制

### 两层实现（读者别混）

**1. MVP 默认（fail-closed）**
- 环境开关未打开时，sidecar 不执行任意 Python
- 只返回结构化信封：代码多大、允许哪些 MCP 端点、出站策略是什么
- 便于 UI、E2E 和合规审计先把档位与策略线接好

**2. 真执行 + 工具桥（需显式打开）**
- 打开代码执行与 code-MCP 编排后，Registry 注入 `ToolInvokeBridge`
- 在临时目录写片段，可选生成 `agentium_tools` shim
- 子进程通过**本机回环地址 + 一次性 token** 发 JSON 请求
- 宿主侧 `ToolBridgeServer` 校验 token 后，只允许 allowlist 内的工具名再进 execute

### 安全要点

```
凭证和全量 Registry 不进沙箱环境变量
沙箱里只有：端口、token 和生成好的 shim
能调哪些工具由宿主 allowlist 决定
桥的生命周期绑在这一轮 execute 上，用完即拆
```

---

## 五、和沙箱、治理的并联

| 组件 | 职责 |
|------|------|
| **沙箱（连载 09）** | 工具 handler 触达文件/网络，走 SafetySandbox 的路径与出站策略 |
| **治理（连载 12）** | 高风险工具挂审批；桥回调仍走 execute，不会从子进程绕开 PolicyEngine |
| **可观测（连载 16）** | 档位、处置、sidecar 状态（stub/executed/egress_denied/timeout）都进日志与审计 |

---

## 六、常见踩坑点

| 坑 | 说明 |
|----|------|
| 把 MCP 预设探测成功当成工具已进 loop | 配置在库、Registry 未 merge，模型仍点不到 |
| 两档不分，什么都直调 | 代码类任务无法收束出站与输出大小 |
| code-exec 默认就开真执行 | 未评估 allowlist 就上生产，等于远程代码入口 |
| 把 API Key 写进模型生成的片段 | 违背凭证不进沙箱；应走宿主连接器或短期 token 桥 |
| 桥 allowlist 过宽 | 子进程能回调高危工具，侧车变提权通道 |
| 桥输出不截断 | 一次 tool 结果撑爆上下文 |
| auto_ingress 当智能路由 | 规则推断有误时要允许用户显式覆盖档位 |
| disposition 与档位不记审计 | 出事后无法解释「为何判成 steer / code-exec」 |
| 桩工具结果当真实 MCP 响应 | 联调通过但线上未接 Server |

---

## 七、面试关联点

这篇文章和以下面试方向高度相关：

### 1. MCP 协议（第 21 题计划）
- MCP 在 Agent 架构中的位置
- direct-tool vs code-exec 两种执行模式
- 工具发现、上架、执行的完整流程

### 2. Agent 安全治理
- 沙箱隔离：代码执行不能直接访问宿主资源
- 凭证管理：API Key 不进沙箱，走 token 桥
- allowlist 控制：子进程只能回调允许的工具

### 3. 工具调用性能优化
- 减少「每个工具一次往返进上下文」
- 把过滤、截断留在宿主
- 桥输出截断避免上下文爆炸

---

## 八、核心总结

> **接 MCP 时要想清三件事**：
> 1. 上架仍走 Registry 契约
> 2. 执行分 direct-tool 与 code-exec-mcp 两档，并和 collect/followup/steer 一起写入上下文与审计
> 3. 代码路径默认 fail-closed，真跑也要靠本机 token 桥回宿主 execute，凭证不进沙箱
