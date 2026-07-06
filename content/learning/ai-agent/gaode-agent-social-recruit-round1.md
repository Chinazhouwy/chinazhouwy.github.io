---
title: "高德 Agent 社招一面面经"
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
summary: "高德 Agent 社招一面面经"
tags:
---

# 高德 Agent 社招一面面经

> **来源**：小红书 xhslink.com/o/7cpnaLZcVxl
> **抓取时间**：2026-06-07
> **结果**：一面聊得愉快，但二面鸽了两次，主动终止流程
> **特点**：深度考察 Agent 架构设计、记忆系统、Harness 工程

---

## 一面（16题，全围绕 Agent 项目）

### 记忆系统
1. 猫猫的整体架构设计除了 Multi-Agent（多智能体）还有什么技术亮点？记忆系统能讲讲吗？
2. 记忆里用的向量是什么？优点？为什么用向量？
3. 猫猫的记忆为什么要设计成五层架构？
4. MenOS（操作系统）的亮点是什么？市面上 Hermes Agent、Claude Code、OpenClaw 的记忆怎么做的？

### 自进化 & 评测
5. 自进化是如何做的？针对 Tracing 对 A2A（Agent-to-Agent，智能体间通信）以及记忆做了 Eval（评估）和自进化，都是如何做的？Eval 为什么不做每天的曲线？

### 系统设计
6. 能力市场是什么？
7. 对接飞书等的安全管理和凭证是如何做的？
8. 猫猫的演进方向是什么？Agentic Work OS（智能体工作操作系统）是什么？

### Agent 定位
9. 这个 Agent 是通用行业 Agent 还是 Coding（编程）？
10. 用框架还是裸模型还是 Claude Code 那些 Agent？
11. 讲讲你对每个模型的 taste（偏好），每个模型的优势和劣势？
12. 这个项目的 API 哪来的？

### Agent 工程化
13. Agent Harness（执行框架）的未来发展方向？
14. 你希望未来的 Agent 是用来干嘛的？
15. 事故驱动护栏是什么？

---

## 覆盖知识点

| 方向 | 考点 |
|------|------|
| **Agent 架构** | Multi-Agent、五层记忆架构、能力市场 |
| **记忆系统** | 向量检索、短期/长期记忆、Hermes/OpenClaw 对比 |
| **自进化** | Tracing、Eval 评估、A2A 协议 |
| **模型认知** | 多模型对比、API 来源、框架选型 |
| **工程化** | Harness 框架、安全凭证、Agentic Work OS |
| **行业理解** | Agent 未来方向、事故驱动护栏 |

---

## 面试特点

这是一场**纯 Agent 项目深挖**，几乎不问传统八股，全程围绕：
- 你的 Agent 系统怎么设计的？
- 为什么这么设计？
- 未来怎么演进？

需要对自研 Agent 项目有**极深的理解**，不是背概念能应付的。
