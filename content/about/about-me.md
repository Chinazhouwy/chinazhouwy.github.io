---
title: "周维扬｜资深 Java 后端工程师与 AI Agent 实践者"
date: 2026-07-25
domain: "个人"
area: "关于我"
module: ""
project: ""
type: "个人介绍"
status: "持续更新"
priority: "P0"
energy: "low"
visibility: "public"
summary: "11 年 Java 后端与保险金融系统经验，持续实践 Java AI Agent、RAG、工具调用和工程化评测。"
tags:
  - Java
  - 保险金融
  - OceanBase
  - AI Agent
---

## 我是谁

我是一名长期工作在保险金融一线的 Java 后端工程师，目前担任 5 人后端组长。

过去 11 年，我主要负责保险电商、销售提效、业务员管理、客户分析、经营报表和公共技术能力建设。相比追逐框架名，我更关注系统在真实业务中能否长期运行：业务规则能否被准确建模，遗留系统能否平稳升级，迁移过程能否验证，线上故障能否快速定位，复杂链路能否被团队持续维护。

近年我开始将大模型能力接入传统 Java 系统，参与已上线 AI 智能客服建设，同时持续开发自己的面试系统 Agent，尝试把 RAG、工具调用、流式交互、权限审计和评测机制做成可运行、可验证的工程闭环。

## 我的技术主线

### 复杂业务与保险金融

- 熟悉保险销售、电商交易、业务员管理、商机流转、客户画像和经营报表。
- 使用 RBAC、AOP 与 SpEL 设计动态数据权限，将组织、角色和行级数据范围从业务代码中解耦。
- 使用状态模式管理商机创建、分配、跟进、转化和关闭等生命周期节点。
- 在核心资金链路中使用 TCC，在异步订单与渠道链路中使用本地消息表、RocketMQ、幂等消费和重试补偿处理最终一致性。

### 遗留系统现代化

- 参与 Ant 到 Maven、Spring 3 到 Spring Boot、WebLogic 到 Undertow 的升级。
- 接入 Nacos、MDC + ELK、Spring Cloud Gateway，并将部分 Quartz 任务迁移到 XXL-Job。
- 关注的不只是“升级成功”，还包括依赖冲突、容器兼容、配置迁移、发布风险和回退边界。

### OceanBase 信创迁移

- 参与 Oracle 到 OceanBase 的核心应用迁移。
- 处理 ROWNUM、CONNECT BY、空字符串、函数差异、存储过程和批处理等兼容问题。
- 自研 MyBatis 分页拦截器，并建设新旧 SQL 与存储过程结果比对工具。
- 将部分 OGG 或存储过程批处理改造为 Java 服务 + XXL-Job，降低数据库专有能力依赖。

### 性能与稳定性

- 使用执行计划、索引、SQL 改写、物化视图和预聚合优化复杂报表。
- 使用递归 CTE 优化大规模客户关系查询，完成 Neo4j 方案调研和 Demo 验证。
- 使用分页并发查询与 SXSSFWorkbook 流式写入处理百万行 Excel 导出。
- 使用 Arthas、线程堆栈、GC 日志、Heap Dump 和 MAT 排查线上性能、线程和内存问题。
- 使用 RocketMQ、Sentinel、线程池隔离、异步化和消息削峰治理高负载链路。

## AI 工程实践

### 已上线 AI 智能客服

- 基于公司内部大模型建设保险知识问答和业务工具调用能力。
- 使用 RAG 检索保险产品、业务规则和操作手册。
- 使用 Function Calling 接入后端业务 API，使用 SSE 实现流式响应。
- 工具调用链路包含身份鉴权、权限校验、操作审计和敏感数据脱敏。
- 借鉴 MCP 的工具描述与协议解耦思路，降低模型与异构业务系统之间的耦合。

### MiniHarness 面试系统 Agent

[MiniHarness](https://github.com/Chinazhouwy/mini-harness) 是我正在持续开发的 Java AI 项目。目前已经覆盖 Spring AI 基础对话、结构化输出、Chat Memory、Tool Calling、面试出题、答案评测、追问和会话持久化。

接下来会继续完善受控 Tool Loop、题目能力证据、固定评测集、失败恢复、权限边界和可观测性，目标不是再写一个聊天页面，而是形成一个可以真实练习和验证的 Java Agent。

## 公开项目

- [MiniHarness](https://github.com/Chinazhouwy/mini-harness)：基于 Spring AI 的面试系统 Agent。
- [Hermes Agent Plugins](https://github.com/Chinazhouwy/hermes-agent-plugins)：模型与 Token 统计、面试路由、上下文隔离和自动化测试。
- [Jump Plugin](https://github.com/Chinazhouwy/jumpPlugin)：面向 Spring XML 与 Java 类导航的 IntelliJ IDEA 插件。
- [Advanced Java](https://github.com/Chinazhouwy/advancedJava)：Java Agent、并发、IO 和面试特性练习。

## 最近关注

- Java AI Agent 的运行时、工具循环、权限和评测。
- AgentScope Java、Claude Code、Hermes 等 Agent 工程实现。
- Spring MVC SSE、跨层流式传输、取消与断线恢复。
- 遗留 Java 系统如何低侵入接入大模型能力。

## 联系我

可以通过 [GitHub](https://github.com/Chinazhouwy) 查看我的公开项目，也可以在本站文章评论区交流。
