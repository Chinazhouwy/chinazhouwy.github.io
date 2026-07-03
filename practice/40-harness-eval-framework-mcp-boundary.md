# 第40题：AI Agent — Harness 是什么？和 Eval、Agent Framework、MCP 的边界

> 日期：2026-07-01
> 来源：`ai-agent/alibaba-fliggy-backend-interview.md`; `industry/2026-05-25-deepseek-agent-harness-hiring.md`; `codex gpt 修复点.md`

---

## 第一轮：初始回答

**得分：4/10** 😐

Harness 说了个大概，Eval 完全不知道，MCP 方向对但边界模糊。

**问题：**
1. Harness 只提到了"管理思想"，没说清楚它是"工程外壳"
2. Eval 完全没听说过
3. MCP 和 Agent Framework 的边界没分清

---

## 核心概念

### Harness = 把模型包起来变成可运行产品的工程外壳

```
Model + Harness = Agent
```

**Harness 包含什么：**

| 模块 | 职责 |
|------|------|
| 工具管理 | 发现、调用、参数校验 |
| 上下文 | 压缩、窗口管理、相关性过滤 |
| 记忆 | 短期（会话）、长期（持久化）、摘要 |
| 权限 | API Key、操作授权、数据隔离 |
| 沙箱 | 代码执行隔离、资源限制 |
| 评测 | 任务成功率、幻觉率、工具准确率 |
| 观测 | Trace、日志、延迟监控 |
| 反馈闭环 | Badcase 收集 → 修复 → 验证 → 沉淀 |

### Eval = Agent 评测体系

```
不是"评估模型好不好"，而是"评估 Agent 做得好不好"
```

**评测维度：**
- 任务成功率：给一个任务，Agent 能不能完成
- 工具调用准确率：该调 A 工具时有没有调 B
- 幻觉率：Agent 有没有瞎编
- 延迟：响应时间是否可接受
- 成本：token 消耗是否合理

**常见框架：** lm-evaluation-harness、LangSmith、自定义框架

### Agent Framework = Harness 的一种实现方式

LangGraph、AgentScope、Spring AI、CrewAI 等。定义 Agent 执行流程（ReAct、State Machine、DAG），管理工具调用链路，提供状态管理和记忆。

### MCP → Skills 的演进

```
MCP = 工具说明书（模型自己看着办）
Skills = 操作手册（流程、坑点、最佳实践都写好了）
```

MCP 只告诉模型"有什么工具"，Skills 还告诉"怎么用、注意什么"。

### 四者关系

```
Harness（最大的圈）
  ├── Agent Framework（执行引擎）
  ├── MCP / Skills（工具连接层）
  ├── Eval（评测体系）
  └── 其他：上下文、记忆、权限、沙箱、观测...
```

---

## 用户追问纠正记录

1. Harness 不是"管理思想"，是"工程外壳"——把模型变成产品的所有工程工作
2. Eval 是 Harness 的重要组成部分，不是独立概念
3. MCP 是协议不是服务，是 Harness 里的工具连接层
4. Skills 比 MCP 更先进：不只描述工具，还包含执行流程和坑点

---

## 这次讨论的收获

- Harness = Model + 工程外壳，包含工具、上下文、记忆、权限、沙箱、评测、观测、反馈闭环
- Eval 是 Agent 评测，评估任务成功率、工具准确率、幻觉率
- MCP 是工具连接协议，Skills 是更高级形态（流程+坑点+最佳实践）
- 四者关系：Harness 是最大的圈，Framework/MCP/Eval 都是它的组成部分
