---
title: "字节Agent开发三面面经"
date: "2026-05-06"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "字节Agent开发三面面经"
tags:
---

# 字节Agent开发三面面经

> **来源**: [小红书](https://www.xiaohongshu.com/explore/69f4c56a00000000230073de)
> **发布日期**: 2026-05-06
> **作者**: 程序员尺哥
> **标签**: `#字节跳动` `#Agent` `#面试`
> **考点分类**: Agent架构 / Multi-Agent / Memory设计 / 评测体系 / SFT / RL / KV Cache / Continuous Batching / 手撕代码

---

## 背景

刚面完字节Agent开发三面，整理一下这轮被问到的核心问题👇

整体感觉难度比腾讯稍高一点

---

## 面试题目清单（25题）

### Agent架构设计（5题）
1. 介绍一下最近做的Agent项目，主要实现了什么功能
2. 为什么选择Multi-Agent，而不是Single Agent
3. workflow和autonomous agent怎么取舍
4. Agent间怎么通信
5. 怎么避免上下文污染

### Memory系统（5题）
6. 长短期memory怎么设计
7. 记忆冲突怎么处理
8. memory retrieval怎么优化
9. 怎么做记忆压缩
10. Agent的评测体系怎么设计

### 评测与优化（3题）
11. memory benchmark怎么设计
12. 评测指标主要看哪些
13. 怎么定位badcase

### 模型优化（4题）
14. 怎么降低hallucination
15. 什么时候做SFT
16. 什么时候适合RL
17. kv cache碎片化怎么解决
18. continuous batching原理

### 系统设计（3题）
19. 如果设计一个大型Agent系统，整体怎么分层
20. Sub-Agent怎么协作
21. Skill和MCP是什么关系

### 其他（2题）
22. 怎么看Claude Code的memory设计

### 手撕代码（1题）
23. 给定字符串s和整数k，求最长子串长度，要求子串中每个字符出现次数都≥k
