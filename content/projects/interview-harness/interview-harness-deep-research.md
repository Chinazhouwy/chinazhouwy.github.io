---
title: "面试模拟 Harness 系统 — 深度研究与技术方案"
date: 2026-07-06
domain: "项目"
area: "工程"
module: ""
project: "面试模拟 Harness"
type: "设计文档"
status: "draft"
priority: "P1"
energy: "high"
visibility: "private"
summary: "面试模拟 Harness 系统架构设计：可插拔、可扩展、支持多 Agent 协作的智能面试平台"
tags:
  - harness
  - agent
  - interview
  - system-design
  - java
  - python
---

# 面试模拟 Harness 系统 — 深度研究与技术方案

## 一、Harness 五大能力（评估标准）

```
这是系统设计的核心评估维度，每个功能都要回答：
"这个设计是否增强了 Harness 的五大能力？"

┌─────────────────────────────────────────────────┐
│              Harness 五大能力                     │
│                                                  │
│  1. 可运行（Run）                                │
│     → 模型调用、上下文管理、对话状态               │
│     → 类比：发动机能转起来                        │
│                                                  │
│  2. 可扩展（Extend）                             │
│     → MCP、Skills、Agent Framework               │
│     → 类比：可以加装各种配件                      │
│                                                  │
│  3. 可控制（Control）                            │
│     → 沙箱、权限、API Key、数据隔离               │
│     → 类比：有刹车和方向盘                        │
│                                                  │
│  4. 可观测（Observe）                            │
│     → 监控、日志、Trace、评测                    │
│     → 类比：有仪表盘和监控摄像头                  │
│                                                  │
│  5. 可迭代（Iterate）                            │
│     → 反馈闭环、Badcase 收集、持续优化            │
│     → 类比：能根据反馈改进                        │
└─────────────────────────────────────────────────┘
```

---

## 二、项目背景与目标

### 2.1 现状痛点

```
当前模拟面试的局限：
1. 只有题目 + 评分，缺乏真实面试的交互感
2. 评分标准不统一，依赖单次对话判断
3. 无法跟踪长期进步趋势
4. 缺乏个性化出题（基于薄弱点自动调整）
5. 没有复盘机制（错题回顾、知识点关联）
```

### 2.2 目标愿景

```
打造一个"AI 面试官"系统：
  → 像真人面试一样交互（追问、引导、压力测试）
  → 智能追踪知识掌握程度
  → 个性化出题（弱项加强）
  → 完整复盘报告（错题分析、知识图谱、进步曲线）
  → 可扩展架构（支持新题型、新评测方式、新人设）
```

---

## 三、技术架构：Java + Python 混合（简化版）

### 3.1 为什么选择混合架构

```
Java 的优势（后端核心）：
  ✓ 成熟的微服务生态（Spring Boot）
  ✓ 强类型、企业级稳定性
  ✓ 适合：业务逻辑、数据管理、API 接口

Python 的优势（AI 引擎）：
  ✓ AI/ML 生态最丰富（LangChain、LlamaIndex）
  ✓ 适合：Agent 编排、向量检索、模型调用、评测逻辑

混合架构的价值：
  → Java 负责"稳"（业务、数据）
  → Python 负责"智"（AI、评测）
  → 通过 HTTP API 通信（简单够用）
```

### 3.2 简化架构图

```
┌─────────────────────────────────────────────────┐
│                    客户端层                       │
│  ┌─────────┐  ┌─────────┐                      │
│  │ Web 前端 │  │ CLI 工具 │                      │
│  └────┬────┘  └────┬────┘                      │
│       └─────────────┘                          │
└──────────────────────────┬──────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────┴──────────────────────┐
│                Java 服务（Spring Boot）           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 用户服务 │  │ 题库服务 │  │ 面试会话 │        │
│  └─────────┘  └─────────┘  └─────────┘        │
│  ┌─────────┐  ┌─────────┐                      │
│  │ 画像服务 │  │ 报告服务 │                      │
│  └─────────┘  └─────────┘                      │
└──────────────────────────┬──────────────────────┘
                           │ HTTP API
┌──────────────────────────┴──────────────────────┐
│              Python 服务（FastAPI）               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 面试官   │  │ 评测引擎 │  │ 复盘分析 │        │
│  │ Agent   │  │         │  │         │        │
│  └─────────┘  └─────────┘  └─────────┘        │
│  ┌─────────┐  ┌─────────┐                      │
│  │ 记忆管理 │  │ 向量检索 │                      │
│  └─────────┘  └─────────┘                      │
└──────────────────────────┬──────────────────────┘
                           │
┌──────────────────────────┴──────────────────────┐
│                    数据层                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │PostgreSQL│  │  Redis   │  │ Milvus  │        │
│  │ 业务数据 │  │ 缓存/会话 │  │ 向量数据 │        │
│  └─────────┘  └─────────┘  └─────────┘        │
└─────────────────────────────────────────────────┘
```

**简化点：**
- ❌ 去掉 RabbitMQ（用 Python 内置的后台任务）
- ❌ 去掉 Elasticsearch（用 PostgreSQL 全文搜索）
- ❌ 去掉 gRPC（用 HTTP API，够用）
- ✅ 保留核心：Java 业务 + Python AI + 3 个数据库

---

## 四、Java 服务设计

### 4.1 技术栈

```
核心框架：
  → Java 17 + Spring Boot 3.2
  → Spring Security（JWT 鉴权）

数据库：
  → PostgreSQL 16（主数据库）
  → Redis 7（缓存、会话）

搜索：
  → PostgreSQL 全文搜索（够用）

构建工具：
  → Maven（多模块项目）
```

### 4.2 模块划分

```
harness-java/
├── harness-gateway/          # API 网关（认证、路由）
├── harness-user/             # 用户服务
├── harness-question/         # 题库服务
├── harness-session/          # 面试会话服务
├── harness-profile/          # 用户画像服务
├── harness-report/           # 报告服务
└── harness-common/           # 公共模块
```

### 4.3 核心表结构

```sql
-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(100),
    target_position VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 题库表
CREATE TABLE questions (
    id VARCHAR(50) PRIMARY KEY,
    title TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    content TEXT,
    tags TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- 标准答案表
CREATE TABLE reference_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id VARCHAR(50) REFERENCES questions(id),
    answer_text TEXT NOT NULL,
    key_points TEXT[],
    scoring_rubric JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 面试会话表
CREATE TABLE interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    total_score DECIMAL(3,1),
    question_count INT DEFAULT 0,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 面试题目表
CREATE TABLE interview_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES interview_sessions(id),
    question_id VARCHAR(50) REFERENCES questions(id),
    user_answer TEXT,
    score DECIMAL(3,1),
    evaluation JSONB,
    follow_ups JSONB,
    asked_at TIMESTAMP
);

-- 用户画像表
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id),
    topic_scores JSONB,
    weak_points TEXT[],
    strong_points TEXT[],
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4.4 API 设计

```
用户：
  POST /api/v1/users/register
  POST /api/v1/users/login
  GET  /api/v1/users/me

题库：
  GET  /api/v1/questions
  GET  /api/v1/questions/:id

面试：
  POST /api/v1/interviews/start
  POST /api/v1/interviews/:id/answer
  POST /api/v1/interviews/:id/end

画像：
  GET  /api/v1/profiles/me

报告：
  GET  /api/v1/reports
  GET  /api/v1/reports/:id
```

---

## 五、Python AI 层设计

### 5.1 技术栈

```
核心框架：
  → Python 3.11+
  → FastAPI（API 服务）
  → LangGraph（Agent 编排）
  → LangChain（LLM 工具链）

向量数据库：
  → Milvus 2.x（向量检索）

LLM 支持：
  → OpenAI GPT-4o / GPT-4o-mini
  → Claude Sonnet / Haiku

异步任务：
  → FastAPI BackgroundTasks（简单够用）
  → 或 APScheduler（定时任务）
```

### 5.2 Agent 设计（LangGraph）

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, List

class InterviewState(TypedDict):
    user_id: str
    session_id: str
    current_question: dict
    user_answer: str
    score: float
    follow_ups: List[dict]
    status: str

# 构建状态机
workflow = StateGraph(InterviewState)

workflow.add_node("select_question", select_question)
workflow.add_node("ask_question", ask_question)
workflow.add_node("evaluate_answer", evaluate_answer)
workflow.add_node("decide_follow_up", decide_follow_up)
workflow.add_node("generate_report", generate_report)

workflow.set_entry_point("select_question")
workflow.add_edge("select_question", "ask_question")
workflow.add_edge("ask_question", "evaluate_answer")
workflow.add_edge("evaluate_answer", "decide_follow_up")

app = workflow.compile()
```

### 5.3 评测引擎

```python
EVALUATION_PROMPT = """
你是一个专业的面试评测专家。请评估用户的回答：

题目：{question}
标准答案：{reference_answer}
用户回答：{user_answer}

请评分（0-10分）并返回 JSON：
{
    "score": 8,
    "comments": "评语",
    "suggestions": ["建议"]
}
"""
```

### 5.4 通信方式

```
Python → Java：
  HTTP 调用 Java API（获取用户画像、题目、保存结果）

Java → Python：
  HTTP 调用 Python API（开始面试、提交回答、获取评测）

示例流程：
  1. Java 接收用户请求，调用 Python 开始面试
  2. Python 选择题目，返回给 Java
  3. Java 推送题目给用户
  4. 用户回答，Java 调用 Python 评测
  5. Python 返回评分，Java 保存结果
  6. 重复 2-5 直到面试结束
```

---

## 六、三阶段实施计划

### Phase 1：MVP 核心（2 周）

```
目标：跑通最小闭环

Harness 能力覆盖：
  ✅ 可运行：能发起面试、获取题目、提交回答
  ✅ 可观测：有基础评分

Java 端（第 1 周）：
  ✅ 项目初始化（Spring Boot）
  ✅ 用户服务（注册、登录）
  ✅ 题库服务（导入现有 54 道题）
  ✅ 面试会话服务（创建、结束）
  ✅ HTTP API 调用 Python

Python 端（第 1 周）：
  ✅ FastAPI 服务
  ✅ 面试官 Agent（LangGraph）
  ✅ 简单评测（单维度评分）
  ✅ HTTP 接口

数据层（第 1 周）：
  ✅ PostgreSQL + Redis
  ✅ 导入现有题库

前端（第 2 周）：
  ✅ 简单面试界面（对话式）
  ✅ 评分展示

交付物：
  → 可用的 MVP
  → 支持基础面试流程
  → 单维度评分
```

### Phase 2：增强体验（2 周）

```
目标：提升面试真实感

Harness 能力覆盖：
  ✅ 可运行：追问链、多人设
  ✅ 可扩展：支持自定义人设
  ✅ 可控制：难度调整
  ✅ 可观测：多维度评测
  ✅ 可迭代：用户画像更新

Java 端（第 1 周）：
  ✅ 用户画像服务
  ✅ 报告服务
  ✅ 统计服务

Python 端（第 1 周）：
  ✅ 多维度评测
  ✅ 追问链逻辑
  ✅ 动态难度调整
  ✅ 记忆管理

前端（第 2 周）：
  ✅ 人设选择
  ✅ 实时评分
  ✅ 复盘报告

交付物：
  → 多人设面试官
  → 追问链交互
  → 多维度评测
  → 完整复盘报告
```

### Phase 3：智能化升级（2 周）

```
目标：真正的 AI 面试官

Harness 能力覆盖：
  ✅ 可运行：多 Agent 协作
  ✅ 可扩展：知识图谱、推荐
  ✅ 可观测：进步趋势分析
  ✅ 可迭代：智能推荐、个性化

Java 端（第 1 周）：
  ✅ 知识图谱服务
  ✅ 推荐服务

Python 端（第 1 周）：
  ✅ 知识图谱构建
  ✅ 智能出题算法
  ✅ 长期追踪

前端（第 2 周）：
  ✅ 知识图谱可视化
  ✅ 进步曲线

交付物：
  → 知识图谱
  → 智能推荐
  → 长期追踪
```

---

## 七、开发环境搭建

### 7.1 Docker Compose（简化版）

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: interview_harness
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  milvus:
    image: milvusdb/milvus:v2.3.0
    ports:
      - "19530:19530"
```

**只有 3 个服务，够用！**

### 7.2 启动命令

```bash
# 启动数据库
docker-compose up -d

# 启动 Java 服务
cd harness-java
mvn spring-boot:run

# 启动 Python 服务
cd harness-ai
uvicorn main:app --reload --port 8000
```

---

## 八、与现有系统集成

### 8.1 导入现有题库

```
当前题库：
  ~/interview/content/opportunity/practice/
  → 54 道已完成的面试题

导入方式：
  ① 编写 Python 导入脚本
  ② 解析 markdown 文件，提取题目、答案、评分
  ③ 存入 PostgreSQL
  ④ 一次性导入，后续新题手动添加
```

### 8.2 与 Hermes 集成

```
方式1：通过 Skill 封装
  → 创建 interview-harness Skill
  → Hermes 可以直接调用面试功能

方式2：通过 API 调用
  → Hermes 调用 Java/Python API
  → 获取面试结果、生成报告
```

---

## 九、风险与对策

```
风险1：你一个人开发，资源有限
  → 对策：Phase 1 聚焦核心，2 周出 MVP
  → 对策：利用现有 54 道题库
  → 对策：前端用模板，不追求完美

风险2：AI 模型成本
  → 对策：用 GPT-4o-mini（便宜）
  → 对策：缓存常见问题的评测结果

风险3：系统复杂度
  → 对策：只有 3 个数据库，够用
  → 对策：HTTP API 通信，简单够用
  → 对策：模块化，逐步迭代
```

---

## 十、总结

### Harness 五大能力评估表

| 能力 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| 可运行 | ✅ 基础面试 | ✅ 追问链 | ✅ 多 Agent |
| 可扩展 | ❌ | ✅ 自定义人设 | ✅ 知识图谱 |
| 可控制 | ❌ | ✅ 难度调整 | ✅ 个性化 |
| 可观测 | ⚠️ 单维度 | ✅ 多维度 | ✅ 进步趋势 |
| 可迭代 | ❌ | ✅ 画像更新 | ✅ 智能推荐 |

### 技术栈总结

```
Java 端：
  → Spring Boot 3.2
  → PostgreSQL + Redis
  → 用户、题库、会话、画像、报告

Python 端：
  → FastAPI + LangGraph
  → Milvus 向量数据库
  → Agent、评测、记忆、推荐

通信：HTTP API（简单够用）
```

---

*文档版本：v3.0（简化版）*
*创建日期：2026-07-06*
*作者：Hermes Agent*
