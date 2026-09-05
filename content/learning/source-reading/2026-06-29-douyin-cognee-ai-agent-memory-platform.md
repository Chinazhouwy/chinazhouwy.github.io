---
title: "🎬 赛博吴同学：开源AI Agent记忆平台cognee"
date: "2026-06-29"
domain: "学习"
area: "AI Agent"
module: "源码阅读"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "8 秒短视频提及 Cognee；结合官方文档核验其图、向量和关系存储，以及 remember/recall/improve/forget 记忆流程。"
tags:
  - "Cognee"
  - "Agent Memory"
  - "知识图谱"
  - "向量检索"
---

# 🎬 赛博吴同学：开源AI Agent记忆平台cognee

> 来源：抖音
> 链接：https://www.douyin.com/video/7656381761270931886
> 作者：赛博吴同学（3474粉丝，6.9万获赞）
> 发布时间：2026-06-28 09:51
> 时长：00:08
> 数据：562赞 / 12评论 / 854分享 / 122收藏

---

## 视频主题

开源 AI Agent 记忆平台 **cognee**，基于知识图谱实现持久化长时记忆。

## 标签

- #赛博吴同学
- #AI
- #科技
- #前沿科技
- #知识图谱

## 核心特点

- 官方文档将 Cognee 定义为开源的 AI Memory 工具与平台。
- 永久记忆会经过摄取、切分、实体/关系抽取、图构建、向量化和增强。
- 存储并非只有知识图谱，还包括关系存储、向量存储和图存储。
- v1.0 的主要操作是 `remember`、`recall`、`improve` 和 `forget`。
- 会话记忆可先写缓存，再按配置桥接到永久图记忆。

## 核验边界

短视频只有 8 秒，无法独立证明“多场景部署”“与主流开发工具无缝集成”等宽泛宣传。
这些描述不应直接当作架构结论。实际选型前至少要验证：

1. 当前版本支持的数据库、缓存和模型提供方。
2. 多用户数据集的权限隔离与删除语义。
3. 图抽取、Embedding 和 Improve 流程的成本与延迟。
4. 自有数据集上的召回质量，而不是只看项目演示指标。

## 备注

- 视频为 8 秒的简短介绍/演示，无完整讲解
- 建议结合官方文档和本地最小实验判断能力边界
- 视频下方推荐列表中有多条 AI Agent 相关的高质量视频

## 官方资料

- [Cognee 核心概念](https://docs.cognee.ai/core-concepts/overview)
- [Cognee Remember](https://docs.cognee.ai/core-concepts/main-operations/remember)
