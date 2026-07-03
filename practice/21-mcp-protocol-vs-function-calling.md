# 第21题 — MCP 协议 vs Function Calling vs Tool

> **题目**：MCP、Function Calling、Tool 三者的关系和区别是什么？
> **方向**：AI Agent ⭐
> **练习日期**：2026-06-07
> **来源**：用户讨论纠正（非标准面经，属于深度理解型讨论）

---

## 得分：8.5/10（经用户纠正后达到）

### ✅ 答对的部分
- MCP 是协议标准，Function Calling 是模型调用机制，Tool 是能力本身 ✓
- Function Calling 是模型自主决策——调不调、调哪个、传什么参数 ✓
- 以 Agent 为中心的架构（模型掌握决策权） ✓
- MCP 比 "tool schema registry" 更宽——还有 Resources 和 Prompts ✓

### ❌ 问题（被用户纠正）
1. **MCP 不只是"统一工具描述格式"** — 漏了 Resources 和 Prompts
2. **LLM 不直接连 MCP Server** — 中间还有 Host + MCP Client
3. **Tool vs Function Calling 概念混淆** — 初始例子没拆清楚两者区别

---

## 一、三者定义

### MCP（Model Context Protocol，模型上下文协议）
- Anthropic（AI 公司）提出的**开放协议标准**
- 解决：AI 应用和外部能力之间用统一协议交互
- **不只是工具**，MCP Server 暴露三类能力：
  - **Tools**：可执行的动作（查天气、发邮件、调 API）
  - **Resources**：给模型提供上下文的数据（文件、数据库、知识库）
  - **Prompts**：模板或交互指令（预设的对话流程）
- 参考：https://modelcontextprotocol.io/specification/2025-06-18/server/index

### Function Calling / Tool Calling
- LLM 原生的**工具调用机制**
- 模型输出结构化 JSON（tool name + arguments），表示"我要调用这个工具"
- 应用层负责真正执行、权限控制、结果回填
- 现在很多地方也叫 Tool Calling（OpenAI 文档）

### Tool
- **可被调用的外部能力本身**
- 查天气、查数据库、发邮件、写文件、调业务 API
- 通过 MCP 或其他方式暴露给 AI 应用

---

## 二、架构链路

```
LLM  ↔  AI应用/Host  ↔  MCP Client  ↔  MCP Server  ↔  外部系统
       (Claude桌面端)                    (天气/邮件/数据库)
       ↑
       负责路由、权限、上下文管理
```

关键点：
- LLM **不直接**连 MCP Server
- Host（宿主应用）是中间人——模型说"我想调这个工具"，Host 负责路由到正确的 MCP Server、执行、权限控制、把结果塞回上下文
- MCP 文档强调它不规定 AI 应用如何使用 LLM 或管理上下文

---

## 三、具体例子

### 例1：查天气+写邮件
```
MCP Server 暴露：
  - get_weather(city) → Tool
  - send_email(to, subject, body) → Tool

用户："帮我查下北京今天天气，然后写封邮件给老板"

LLM 通过 Function Calling 输出：
  → get_weather(city="北京")
  → 拿到结果 "晴，25°C"
  → send_email(to="boss@company.com", subject="今日天气", body="...")
```

### 例2：读取数据源（Resources）
```
MCP Server 暴露：
  - read_file(path) → Resource（读取数据，不是执行动作）
  - query(sql) → Resource（查数据库）

用户："帮我看下 /tmp/report.csv 里的数据，算平均销售额"

LLM 调用 read_file → 拿到 CSV 内容 → 自己计算 → 回复
```

### 例3：三者分工类比

| 概念 | 类比 | 做什么 |
|------|------|--------|
| **MCP** | 餐厅菜单标准 | 统一暴露能力（Tools + Resources + Prompts） |
| **Function Calling** | 顾客点菜 | 模型输出结构化调用请求 |
| **Tool** | 厨师/菜品 | 实际干活的能力 |

---

## 四、MCP 的三种典型用途

| 用途 | 数据流向 | 例子 |
|------|---------|------|
| **读数据（Resources）** | 数据源 → LLM | 读文件、查数据库、搜文档 |
| **写数据（Tools）** | LLM → 数据源 | 创建文件、写数据库、发消息 |
| **执行动作（Tools）** | LLM → 外部服务 | 发邮件、调 API、触发工作流 |

---

## 五、这次讨论的收获

1. **MCP 比想象中更宽** — 不只是 tool schema registry，还包括 Resources（数据上下文）和 Prompts（交互模板）
2. **架构链路不能简化** — LLM ↔ Host ↔ MCP Client ↔ MCP Server ↔ 外部系统，Host 承担了路由/权限/上下文管理的关键职责
3. **概念层次要分清** — Tool 是能力本身，Function Calling 是触发机制，MCP 是接入标准，三者是不同层面的配合关系
