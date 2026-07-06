---
title: "AI 记忆标签体系设计 — 双维度标签解决 consolidation 混乱"
date: "2026-07-06"
domain: "阅读"
area: "参考资料"
module: ""
project: ""
type: "资料"
status: "digested"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "AI 记忆标签体系设计 — 双维度标签解决 consolidation 混乱"
tags:
---

类型：📚 参考资料（非面试题/面经）

# AI 记忆标签体系设计 — 双维度标签解决 consolidation 混乱

> 原文：https://mp.weixin.qq.com/s/STY3IWbIxzTOs6ZmNlrfJg
> 系列：你的 AI 记忆正在腐烂 → 本文 → Hindsight 0.8.0 升级踩坑实录

---

## TL;DR

AI 记忆系统（Hindsight / Mem0 / Zep）中，单维度标签（4 个 topic）无法区分记忆的生命周期，导致 consolidation（记忆合并）越合越乱。解决方案是**双维度标签体系**：topic（7 个）× stage（3 个）= 21 种组合，让 consolidation 能按类型和生命周期隔离合并。

---

## 1. 问题：4 个标签 = 0 区分度

很多 AI 记忆系统的初始配置是这样打标签的：

```json
{
  "tags": ["business", "infra", "dev_tools", "code"]
}
```

**跑一周就崩了**：单维度标签只能回答"这是关于什么的"，不能回答"这条记忆该留多久"。

**核心矛盾**：250 条 `business` 标签的记忆混在一起合并——有的是永久决策，有的是 7 天前的进度，有的是 30 天前的草稿。合并不是越合越清晰，而是越合越糊。

---

## 2. 解决方案：双维度 = topic × stage = 21 种组合

### 2.1 维度一：topic（这是什么）

7 个 topic 覆盖 AI 助手日常所有记忆类型：

| Topic | 说明 |
|-------|------|
| `business` | 商业决策：变现策略、定价、收入方向 |
| `infra` | 基础设施：服务器/网络/Docker 配置、部署计划、架构决策 |
| `dev_tools` | 开发工具：Hermes/Skills/AI 工具配置、规则变更 |
| `code` | 代码：关键设计决策、根因和修复 |
| `content` | 内容：发布策略、跨平台分发决策 |
| `research` | 研究：调研结论、市场分析结果、技术选型决策 |
| `reflection` | 反思：关于 AI 系统自身行为的反思日志 |

**为什么是 7 不是 4**：原来 4 个时，`reflection` 类型的记忆（关于 AI 系统自身行为的反思）没地方放，要么混进 `code` 要么直接丢失。加了 `reflection` + `content` + `research` 后，区分度从"几乎没有"变成"基本够"。

### 2.2 维度二：stage（该留多久）

3 个 stage 控制记忆生命周期：

| Stage | 含义 | 清理策略 |
|-------|------|----------|
| `decision` | 已确认的决策 | 永久保留 |
| `process` | 过程记录、调试步骤 | 7 天后清理 |
| `reference` | 参考资料、外部链接 | 30 天后清理 |

**为什么需要 stage**：没有 stage，consolidation 不知道哪些该合并、哪些该丢弃。一条"6/1 试了 SSH 密钥被拒"和一条"6/1 决定用密钥认证不用密码"——前者是 `process`（7 天后该清理），后者是 `decision`（永久保留）。单维度标签分不出来。

### 2.3 组合效果：21 种区分

7 topics × 3 stages = 21 种组合

consolidation 任务现在可以：
- 按 `topic:business + stage:decision` 合并 → 只合并商业永久决策
- 按 `topic:infra + stage:process` 合并 → 只合并 7 天内的基础设施过程
- 跨 topic 不合并 → business 的绝不混进 infra 的

---

## 3. 配置实现

### 3.1 entity_labels 配置（Hindsight Bank Config）

```json
{
  "updates": {
    "entity_labels": {
      "topic": ["business", "infra", "dev_tools", "code", "content", "research", "reflection"],
      "stage": ["decision", "process", "reference"]
    }
  }
}
```

⚠️ **版本坑**：
- Hindsight **0.7.1** 用平铺格式：`{"entity_labels": {...}}`
- Hindsight **0.8.0+** 必须包 `updates` 层：`{"updates": {"entity_labels": {...}}}`
- 报错信号：`{"detail":[{"type":"missing","loc":["body","updates"]}]}` = 你用了 0.7.1 格式但跑的是 0.8.0。

### 3.2 retain_mission：告诉 LLM 什么时候打什么标签

`entity_labels` 定义了"有哪些标签"，但 LLM 抽记忆时**不会自动打标签**——你需要在 `retain_mission` 里明确告诉它。

```text
You are a memory extractor for an AI assistant. Extract facts worth keeping long-term.

【STORE - worth retaining】
- business: monetization decisions, pricing strategies, finalized revenue directions
- infra: confirmed server/network/Docker configs, deployment plans, architectural decisions
- dev_tools: final Hermes/Skills/AI tool configurations, rule changes
- code: key design decisions, root causes and fixes
- content: publishing strategies, cross-platform distribution decisions
- research: research conclusions, market analysis results, tech selection decisions
- reflection: meta-cognitive errors, reflection journal entries of the form
  '我以为 X / 实际 Y / 根因 Z / 改进 W'

【IGNORE - do not store】
- Any topic intermediate debugging, CLI trial-and-error, SSH attempts
- Draft iteration of articles
- "try this", "how about this", "still broken" mid-process operations
- Repeated troubleshooting steps, transient log output

【Rule】
- Is this turn searching for an answer or has the answer been decided? Former → skip. Latter → store.
- When unsure, skip.
- One fact = one complete conclusion. Do not store the derivation process.

【Fallback for meta-cognitive facts】
- If a fact describes the AI system itself (Hindsight engine, retain behavior, SOUL config,
  bank config, PATCH/DELETE side effects, ambiguity resolution, tag/label system) AND matches
  none of the 7 topics above, DEFAULT-tag it as topic:reflection. Do not skip the topic field.
```

**为什么要写 Fallback 段**：实测发现 LLM 在抽记忆时，对"关于 AI 系统自身行为"的记忆会漏标 `topic:reflection`——因为 LLM 做语义推理时把这些当"系统噪声"跳过了。加了 Fallback 段 + 显式列举后，漏标问题消失。

### 3.3 observations_mission：consolidation 按 topic 隔离

```text
Group consolidation strictly by topic. Observations from different topics must never be merged.
Prefer many narrow observations over few broad ones.
```

**这一句话的作用**：`business` 的记忆绝不混进 `infra` 的记忆合并。没有这句话，consolidation 会把 250 条标签的记忆揉成一坨。

---

## 4. 安全修改配置：PATCH 前后必做基线对比

**血泪教训**：修改 Hindsight Bank Config 时，PATCH 操作可能**静默触发内部数据重建**，导致大量旧记忆被清空。

**安全 PATCH 三步法**：

```bash
# Step 1: PATCH 前抓基线
BEFORE=$(curl -s http://localhost:8888/v1/default/banks/hermes/stats | \
  python3 -c 'import json,sys; print(json.load(sys.stdin)["total_nodes"])')
echo "before: $BEFORE"

# Step 2: 执行 PATCH
curl -s -X PATCH http://localhost:8888/v1/default/banks/hermes/config \
  -H 'Content-Type: application/json' \
  --data @/tmp/patch.json

# Step 3: PATCH 后立即验证
AFTER=$(curl -s http://localhost:8888/v1/default/banks/hermes/stats | \
  python3 -c 'import json,sys; print(json.load(sys.stdin)["total_nodes"])')
echo "after: $AFTER delta=$((AFTER - BEFORE))"

# ✅ 期望：delta=0 或 delta>0（只增不减）
# ❌ 如果 delta<0 → 立即停手，检查原因
```

---

## 5. tag 格式版本切换的坑

Hindsight 0.8.0 升级后，tag 字符串格式从 `=` 切到了 `:`：

| 版本 | 格式 | 示例 |
|------|------|------|
| 0.7.x | `topic=infra` | `topic=infra` |
| 0.8.0+ | `topic:infra` | `topic:infra` |

**旧数据不会自动转换**。如果你的记忆系统里同时存在两种格式：
- 搜 `topic:infra` → 只能命中 0.8.0+ 的新数据
- 搜 `topic=infra` → 只能命中 0.7.x 的旧数据

**解决方案**：搜索时两种格式都试，不要单凭一种格式 0 命中就判"没数据"。

---

## 6. 可复用的配置模板

以下配置可以直接复制到你的 Hindsight Bank Config PATCH 请求里（0.8.0+ 格式）：

```json
{
  "updates": {
    "entity_labels": {
      "topic": ["business", "infra", "dev_tools", "code", "content", "research", "reflection"],
      "stage": ["decision", "process", "reference"]
    },
    "retain_mission": "You are a memory extractor for an AI assistant. Extract facts worth keeping long-term.\n\n【STORE - worth retaining】\n- business: monetization decisions, pricing strategies, finalized revenue directions\n- infra: confirmed server/network/Docker configs, deployment plans, architectural decisions\n- dev_tools: final Hermes/Skills/AI tool configurations, rule changes\n- code: key design decisions, root causes and fixes\n- content: publishing strategies, cross-platform distribution decisions\n- research: research conclusions, market analysis results, tech selection decisions\n- reflection: meta-cognitive errors, reflection journal entries of the form '我以为 X / 实际 Y / 根因 Z / 改进 W'\n\n【IGNORE - do not store】\n- Intermediate debugging, CLI trial-and-error, SSH attempts\n- Draft iteration of articles\n- \"try this\", \"how about this\", \"still broken\" mid-process operations\n- Repeated troubleshooting steps, transient log output\n\n【Rule】\n- Is this turn searching for an answer or has the answer been decided? Former → skip. Latter → store.\n- When unsure, skip.\n- One fact = one complete conclusion. Do not store the derivation process.\n\n【Fallback for meta-cognitive facts】\n- If a fact describes the AI system itself (Hindsight engine, retain behavior, SOUL config, bank config, PATCH/DELETE side effects) AND matches none of the 7 topics above, DEFAULT-tag it as topic:reflection. Do not skip the topic field.",
    "observations_mission": "Group consolidation strictly by topic. Observations from different topics must never be merged. Prefer many narrow observations over few broad ones."
  }
}
```

---

## 7. 总结

**核心原则**：标签不是越多越好，而是要**回答两个独立问题**——"这是什么"（topic）和"该留多久"（stage）。两个独立维度正交组合，才能得到有效的区分度。

---

## 关键 takeaway

1. **单维度标签的致命缺陷**：只能分类，不能控制生命周期，consolidation 必然混乱
2. **双维度正交设计**：topic × stage = 21 种组合，覆盖 AI 助手所有记忆场景
3. **retain_mission 的关键作用**：定义哪些该存、哪些该丢，比 entity_labels 本身更重要
4. **observations_mission 的隔离作用**：一句话决定 consolidation 是否跨 topic 合并
5. **PATCH 操作的安全风险**：Hindsight 的 PATCH 可能静默触发数据重建，必须做基线对比
6. **版本迁移的兼容性**：tag 格式从 `=` 切到 `:`，旧数据不会自动转换
