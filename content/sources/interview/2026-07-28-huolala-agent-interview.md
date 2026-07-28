---
title: "货拉拉 Agent 开发日常实习二面面经（已过）"
date: 2026-07-28
domain: "面试"
area: "AI Agent"
module: ""
project: ""
type: "面经"
status: "待整理"
priority: "P0"
energy: "medium"
visibility: "private"
summary: "货拉拉 Agent 开发日常实习二面面经，涵盖 RAG 知识库设计、Agent 评估、记忆压缩、Function Call/MCP/Skill 演进、LoRA vs RAG 等 13 道面试题"
tags:
  - 面经
  - 货拉拉
  - AI Agent
  - RAG
  - MCP
  - 面试
source: "小红书"
source_url: "http://xhslink.cn/o/AElqCFNtdIu"
author: "Alexis"
round: "二面"
result: "已通过"
---

# 货拉拉 Agent 开发日常实习二面面经

> **来源**: 小红书 @Alexis
> **链接**: http://xhslink.cn/o/AElqCFNtdIu
> **标签**: #实习 #面试 #面经 #互联网大厂 #货拉拉 #Agent
> **考点分类**: RAG知识库 | Agent评估 | 记忆管理 | 工具调用演进 | 提示词工程 | 模型部署

---

## 面试流程

1. 首先自我介绍
2. 问项目，结合项目问了八股
3. 反问环节

---

## 面试题汇总（共 13 题）

### RAG & 知识库（Q1-Q7）

**Q1: 工程上怎么样去选择 embedding 模型？**

**Q2: 怎么样实现 BM25 和向量检索的混合策略，为什么要这么做？**

**Q3: 如果一个知识库要换 embedding 模型应该怎么换？**

**Q4: 如果要修改一个 chunk 的内容要怎么修改？**

**Q5: 比如我有一个员工手册知识库，有部分条款更新了，怎么保证相关的全部 chunk 全部被修改了？**

**Q6: 如果重新设计知识库考虑到上面的情况要怎么设计？**

**Q7: RAG 系统要实现对原文档的追溯要怎么做？**

### Agent 评估与记忆（Q8-Q9）

**Q8: Agent 设计好后要怎么评价性能，有什么指标？**

**Q9: 处理记忆和记忆压缩有没有什么办法？**

### 工具调用与提示词工程（Q10-Q11）

**Q10: function call 到 mcp 到 skill 的进化过程为什么会这么进化，这三个之间有什么区别？**

**Q11: ReAct、Plan and Execute、Reflection 的 Agent 怎么设计提示词？**

### 模型部署与策略选择（Q12-Q13）

**Q12: 模型 API 调用怎么实现的是否开启思考以及思考强度？**

**Q13: 什么时候使用 LoRA 微调，什么时候使用 RAG？**

---

## 考点分析

| 考点类别 | 题数 | 重点 |
|----------|------|------|
| RAG 知识库设计与运维 | 7 | embedding 选型、混合检索、chunk 更新、文档追溯、知识库架构设计 |
| Agent 评估与记忆 | 2 | 性能指标、记忆压缩策略 |
| 工具调用演进 | 1 | Function Call → MCP → Skill 的技术演进逻辑 |
| 提示词工程 | 1 | ReAct / Plan-and-Execute / Reflection 范式 |
| 模型部署策略 | 2 | 思考模式控制、LoRA vs RAG 选择 |
