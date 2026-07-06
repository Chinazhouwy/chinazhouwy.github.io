---
title: "字节跳动 Agent 开发岗 二面（贼难）"
date: "2026-05-30"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "字节跳动 Agent 开发岗 二面（贼难）"
tags:
---

# 字节跳动 Agent 开发岗 二面（贼难）

> **来源**: [小红书](https://www.xiaohongshu.com/explore/6a1ab93a0000000035029e6f)
> **发布日期**: 2026-05-30
> **作者**: Java面小猫🐱
> **标签**: `#字节跳动` `#Agent` `#二面` `#面试`
> **考点分类**: Agent架构选型 / 多Agent分工 / 路由设计 / 提示词模板 / 查询改写 / 并行意图 / Skills体系 / 效果评估 / Badcase定位 / Prompt调优 / SFT / LLM推理优化

---

## 面试题目清单（12题）

### 一、Agent架构与设计（3题）
1. 你之前做的Agent项目用的是什么架构？LangGraph还是自研？整体是master+sub Agent还是workflow形式？为什么这么选型？
2. 项目中是单Agent还是多Agent架构？各个子Agent的核心任务和分工是什么？
3. 首次生成和多轮补充的链路路由是怎么区分和实现的？

### 二、提示词与上下文工程（2题）
4. 你是怎么构建提示词模板的？在上下文工程方面有哪些实践经验？比如有没有做过to do list这类优化，为什么它能让模型更聚焦？
5. 项目中有没有做过查询改写？多维度的查询改写具体是什么？当改写需要用户补充信息时，你是怎么设计交互和技术实现的？

### 三、Agent核心能力（3题）
6. 并行化意图识别是什么？为什么要并行化？你是如何实现的？
7. Agent的skills功能原理是什么？你是怎么设计和实现skills体系的？
8. Agent系统的整体效果怎么评估？在没有用户反馈的情况下，如何进行有效的抽检？

### 四、问题定位与优化（4题）
9. 当出现Badcase时，你怎么快速定位到具体是哪个Agent环节出了问题？如何判断应该对哪个Agent做SFT优化？
10. Prompt调优过程中，经常会遇到"修好一类、坏了另一类"的问题，你是怎么解决的？
11. 当Prompt调优到极限后，你会优先选择换模型、调参数还是上SFT？为什么？
12. 你在LLM推理优化方面做了哪些工作？有没有用到continuous batching、KV Cache、vLLM等技术？线上高峰吞吐量大概是多少？
