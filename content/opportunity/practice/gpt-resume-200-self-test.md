---
title: "GPT 资深 Java 面试 200 题：自测与已有答案对照"
date: "2026-09-11"
domain: "机会"
area: "机会雷达"
module: "Java 后端"
project: "面试准备"
type: "自测题单"
status: "待自测"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "保留 GPT 给出的 200 道面试题和原始提示，逐题定位已有题库答案，区分部分覆盖、资料缺口与个人经历题。"
tags:
  - Java
  - 自测
  - 面试准备
---

# GPT 资深 Java 面试 200 题：自测与已有答案对照

这份题单用来检查自己能不能回答 GPT 提出的面试问题。先读题独立回答，再展开原提示和已有资料核对。它不属于招银面经，也不是重新生成的简历画像。

[GPT 原始出题材料](../../sources/gpt-resume-interview-200-original.md)保留原题与提示。本文保留原编号 1～200；它们不是 practice 的历史题号，例如“自测 70”不等于“练习第70题”。

## 怎么看对照结果

| 标记 | 含义 | 题数 |
|---|---|---:|
| 已有回答要点 | 正文里已有可回答本题的核心要点，不代表所有追问都齐全 | 100 |
| 部分覆盖 | 只有一部分机制、背景或模板；每题另写缺少什么 | 68 |
| 未找到直接解答 | 本次检索未定位到直接解答，原题自带提示仍可参考 | 9 |
| 需要个人作答 | 主要问你的选择、经历或管理案例；参考资料不能代替你的回答 | 23 |

以上统计的是资料覆盖，不是你的掌握程度。所有题都保持“待自测”，不会据此创建完成记录、评分或每日任务。

检索基线：远程 `/root/interview`，2026-09-11，提交 `18f6206403cfd2931f3f1103ae47f0560d77b59e`。检索范围包含 practice、公司面经、学习文章与专栏；日程、候选清单、个人介绍中的技术名词不算现成答案。按题意检查候选正文后作保守匹配；“未找到”不是断言全库绝不存在。

已有文档中仍有历史模板和旧结论，本次是答案位置与覆盖对照，不是全库技术正确性认证。优先读 `GPT 纠错`、`最终修正版` 和最新追问；原 GPT 提示单独标明，不能将它计入“之前题库已有答案”。

## 容易误用的旧答案

- 自我介绍 #227 含 AI 代写经历；可以参考结构，不直接背成自己的经历。
- 迁移 #232、#233 的回退模板还需核对数据兼容、写入和反向同步条件，不能只凭网关切流宣称可回退。
- SQL #234 存在“一见全表扫描就优化”等偏绝对口径；结合 #23 的实际执行计划讨论使用。
- 锁 #237 已指出故障窗口，但 fencing token 的产生方与下游校验也需要满足故障场景下的正确性，不能只背 INCR。
- 事务 #9 的示例与选型口诀不能等同于生产框架全部保证；Seata 的全局锁、脏写校验等在对应题中标成缺口。

## 分组目录

- [自测 1～10：项目与个人贡献](#gpt-group-1)
- [自测 11～17：保险金融业务](#gpt-group-11)
- [自测 18～25：遗留系统现代化](#gpt-group-18)
- [自测 26～45：Oracle 与 OceanBase](#gpt-group-26)
- [自测 46～63：SQL、报表与导出](#gpt-group-46)
- [自测 64～69：关系数据与图查询](#gpt-group-64)
- [自测 70～82：Redis](#gpt-group-70)
- [自测 83～93：消息与异步架构](#gpt-group-83)
- [自测 94～107：线程池与并发](#gpt-group-94)
- [自测 108～118：Spring](#gpt-group-108)
- [自测 119～127：RBAC、AOP 与 SpEL](#gpt-group-119)
- [自测 128～134：Gateway、Nacos 与 Sentinel](#gpt-group-128)
- [自测 135～139：定时任务与批处理](#gpt-group-135)
- [自测 140～152：JVM 与 Arthas](#gpt-group-140)
- [自测 153～158：Seata](#gpt-group-153)
- [自测 159～177：AI 工程](#gpt-group-159)
- [自测 178～186：团队管理](#gpt-group-178)
- [自测 187～200：架构思考](#gpt-group-187)

## 待补资料索引

- [自测 25：老代码没人敢删怎么办？](#gpt-q-25)
- [自测 30：怎么改递归CTE？](#gpt-q-30)
- [自测 42：如果迁移过程中两边都发生写入怎么办？](#gpt-q-42)
- [自测 66：查“我的三度人脉”怎么实现？](#gpt-q-66)
- [自测 67：BFS和DFS哪个更适合查最短关系？](#gpt-q-67)
- [自测 124：SpEL ExpressionParser什么时候创建？](#gpt-q-124)
- [自测 127：如果管理员拥有全量数据权限，SQL怎么避免生成巨大IN？](#gpt-q-127)
- [自测 143：shallow heap和retained heap区别？](#gpt-q-143)
- [自测 198：什么是指数退避？](#gpt-q-198)

<a id="gpt-group-1"></a>

## 项目与个人贡献（自测 1～10）

<a id="gpt-q-1"></a>

### 自测 1：你11年里最能代表你技术水平的项目是什么？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

不要讲6个项目，选1个。背景、规模、你的职责、最难问题、方案、结果，3分钟讲完

**已有题库对照**

- [第227题：自我介绍与主线串联（简历专项 01）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/227-self-introduction-90s-3min.md)

**覆盖与缺口：**自我介绍有结构，但最强项目仍需自己选择并口述。

</details>

<a id="gpt-q-2"></a>

### 自测 2：这个项目里哪些方案是你提出的，哪些是团队已有的？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

明确“我做的”和“团队做的”，不能全部归自己

**已有题库对照**

- [第227题：自我介绍与主线串联（简历专项 01）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/227-self-introduction-90s-3min.md)

**覆盖与缺口：**可回看用户原始回答；AI 模板不能证明个人分工。

</details>

<a id="gpt-q-3"></a>

### 自测 3：你做过最错误的一个技术决策是什么？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

真问题、真后果、怎么改，不要说“参数配小了”这种假失败

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未检索到你的错误决策复盘；按原提示回忆一个案例。

</details>

<a id="gpt-q-4"></a>

### 自测 4：你主导的方案被否掉过吗？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

为什么被否、谁提出异议、最后怎么决策

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未检索到方案被否的具体经历。

</details>

<a id="gpt-q-5"></a>

### 自测 5：你怎么证明某个优化真有效？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

基线、指标、压测/生产数据、前后对比，而不是“用户反馈变快了”

**已有题库对照**

- [第234题：报表性能优化（简历专项 08）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/234-report-performance-optimization.md)

**覆盖与缺口：**有执行计划、压测和前后验证；缺对应项目的基线数据。

</details>

<a id="gpt-q-6"></a>

### 自测 6：线上出了问题，你怎么确定是不是自己的改动？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

时间窗口、traceId、变更记录、指标、日志、回滚验证

**已有题库对照**

- [第236题：JVM 故障排查（简历专项 10）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/236-jvm-full-gc-troubleshooting.md)

**覆盖与缺口：**有排障与灰度验证链路，缺关联发布变更的完整案例。

</details>

<a id="gpt-q-7"></a>

### 自测 7：如果让你删掉简历里一半技术栈，你会留下哪些？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

最好能体现你的真实主线，而不是“全都会”

**已有题库对照**

- [第227题：自我介绍与主线串联（简历专项 01）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/227-self-introduction-90s-3min.md)

**覆盖与缺口：**已有技术主线，可自行选择保留哪些。

</details>

<a id="gpt-q-8"></a>

### 自测 8：你11年和一个5年Java开发相比，优势究竟是什么？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

不能回答“经验丰富”。应该是业务抽象、系统演进、风险意识、决策边界、交付能力

**已有题库对照**

- [第227题：自我介绍与主线串联（简历专项 01）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/227-self-introduction-90s-3min.md)

**覆盖与缺口：**有经历叙事，资深度需要用自己的决策实例说明。

</details>

<a id="gpt-q-9"></a>

### 自测 9：你有哪件事情是 junior 工程师很难独立完成的？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

迁移、灰度、稳定性治理、跨系统改造之类

**已有题库对照**

- [第232题：架构升级与技术迁移（简历专项 06）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)
- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)

**覆盖与缺口：**有迁移方法，个人承担的难点需要自己回答。

</details>

<a id="gpt-q-10"></a>

### 自测 10：如果今天让你重新设计你最熟悉的系统，你会推翻什么？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

体现反思，不要把以前所有设计都说成正确

**已有题库对照**

- [第232题：架构升级与技术迁移（简历专项 06）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)
- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)

**覆盖与缺口：**有演进与稳定性框架，推翻哪项设计没有现成个人答案。

</details>


<a id="gpt-group-11"></a>

## 保险金融业务（自测 11～17）

<a id="gpt-q-11"></a>

### 自测 11：一张保险保单从销售到最终生效，大致经历哪些核心状态？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**你最好能说出你实际业务中的：**
**商机** → **报价**/**方案** → **投保** → **核保** → **承保** → **出单** → **收费** → **保全** → **理赔**/**续期**
**不要求照教科书，但要能说明你的系统负责哪一段，系统边界在哪里。**

**已有题库对照**

- [第228题：保险销售领域建模与系统边界（简历专项 02）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/228-insurance-domain-boundary-modeling.md)

**覆盖与缺口：**已有投保、保单、支付状态表；不代表所有险种统一流程。

</details>

<a id="gpt-q-12"></a>

### 自测 12：为什么保险系统特别强调幂等？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**要能结合：**
* **重复投保；**
* **重复扣款；**
* MQ**重复消费；**
* **渠道重试；**
* **回调重复；**
* **批量任务重跑。**

**已有题库对照**

- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)
- [第230题：商机状态机与防非法流转（简历专项 04）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/230-state-machine-opportunity-flow.md)

**覆盖与缺口：**可查资金链路、重复消息、业务幂等。

</details>

<a id="gpt-q-13"></a>

### 自测 13：金融系统和普通互联网系统最大的技术差异是什么？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**高质量答案：**
**金额、状态和流水必须可追溯；错误不能简单覆盖；很多操作需要审计；外部渠道状态存在不确定性；最终必须通过对账收敛。**

**已有题库对照**

- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)
- [第228题：保险销售领域建模与系统边界（简历专项 02）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/228-insurance-domain-boundary-modeling.md)

**覆盖与缺口：**覆盖资金一致性和系统边界；审计、流水需结合原提示补齐。

</details>

<a id="gpt-q-14"></a>

### 自测 14：什么叫“业务正确性”和“技术正确性”？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**比如：**
**数据库事务全部提交成功：**
**技术上成功。**
**但金额算错：**
**业务仍然错误。**

**已有题库对照**

- [第228题：保险销售领域建模与系统边界（简历专项 02）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/228-insurance-domain-boundary-modeling.md)
- [第230题：商机状态机与防非法流转（简历专项 04）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/230-state-machine-opportunity-flow.md)

**覆盖与缺口：**有业务规则和状态约束，未单独展开技术成功但业务错误。

</details>

<a id="gpt-q-15"></a>

### 自测 15：为什么金融系统一般不推荐直接修改历史交易数据？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**应该想到：**
* **审计；**
* **流水不可变；**
* **冲正；**
* **补偿；**
* **可追溯性。**

**已有题库对照**

- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)

**覆盖与缺口：**有补偿路径，缺历史流水不可变与冲正专题。

</details>

<a id="gpt-q-16"></a>

### 自测 16：如果保单状态和收费状态不一致怎么办？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不要回答“事务回滚”。**
**应该先判断：**
**是否同库、是否跨系统、是否同步、是否已经发生外部副作用。**
**再考虑：**
**状态机** + **幂等** + **重试** + **对账** + **补偿。**

**已有题库对照**

- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)
- [第230题：商机状态机与防非法流转（简历专项 04）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/230-state-machine-opportunity-flow.md)

**覆盖与缺口：**有跨系统状态、幂等、回调、重试和补偿要点。

</details>

<a id="gpt-q-17"></a>

### 自测 17：什么是资损？你真正经历过什么资损风险？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这个你必须准备真实案例。**


⸻

**已有题库对照**

- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)

**覆盖与缺口：**可以借助资金链路复习；资损经历没有现成答案。

</details>


<a id="gpt-group-18"></a>

## 遗留系统现代化（自测 18～25）

<a id="gpt-q-18"></a>

### 自测 18：为什么要从 Spring3 升 Spring Boot？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不能回答：**
Boot**更方便、自动配置。**
**要讲真正痛点：**
* XML**配置膨胀；**
* **依赖管理；**
* **容器耦合；**
* **配置环境管理；**
* **部署方式；**
* **日志、监控；**
* **后续生态升级。**

**已有题库对照**

- [第232题：架构升级与技术迁移（简历专项 06）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)

**覆盖与缺口：**有迁移阶段，升级动机没有充分展开。

</details>

<a id="gpt-q-19"></a>

### 自测 19：这是“大版本升级”还是“重写”？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**解释：**
**为什么不能** Big Bang Rewrite**。**
**好的方案通常：**
**兼容** → **模块迁移** → **双轨**/**灰度** → **验证** → **收口。**

**已有题库对照**

- [第232题：架构升级与技术迁移（简历专项 06）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)

**覆盖与缺口：**有分阶段、灰度、旧集群保留和回退的回答骨架。

</details>

<a id="gpt-q-20"></a>

### 自测 20：Spring3 → Boot 最大的兼容问题是什么？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少准备**3**个真实问题：**
* Bean**加载差异；**
* XML**与**Java Config**；**
* **依赖冲突；**
* Servlet**版本；**
* Jackson**；**
* **日志框架；**
* Filter**；**
* Spring MVC**；**
* **数据源；**
* **老**SDK**。**
**不要一次背十几个，准备真实遇到的3个。**

**已有题库对照**

- [第232题：架构升级与技术迁移（简历专项 06）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)

**覆盖与缺口：**只有接口、Session、数据库兼容表，缺三个具体兼容故障。

</details>

<a id="gpt-q-21"></a>

### 自测 21：Ant → Maven到底解决了什么？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**别只说“依赖管理”。**
**讲：**
**构建生命周期、依赖传递、版本统一、插件化、**CI**接入、可重复构建。**

**已有题库对照**

- [第232题：架构升级与技术迁移（简历专项 06）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)

**覆盖与缺口：**只写构建迁移和 pom.xml，生命周期与依赖传递要补。

</details>

<a id="gpt-q-22"></a>

### 自测 22：WebLogic → Undertow为什么要换？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**可能追问：**
* **容器职责发生什么变化？**
* JNDI**怎么办？**
* classloader**差异？**
* session**怎么办？**
* datasource**怎么办？**
* **应用服务器提供的功能谁接管？**

**已有题库对照**

- [第232题：架构升级与技术迁移（简历专项 06）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)
- [JVM 类加载机制、双亲委派和打破双亲委派](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/31-jvm-classloading-parent-delegation.md)

**覆盖与缺口：**有容器迁移和类加载背景，JNDI、数据源接管缺专项答案。

</details>

<a id="gpt-q-23"></a>

### 自测 23：怎么证明切 Undertow 之后没有功能问题？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**应该有：**
**回归** + **流量验证** + **核心接口指标** + **错误率** + JVM + **数据一致性。**

**已有题库对照**

- [第232题：架构升级与技术迁移（简历专项 06）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)
- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)

**覆盖与缺口：**有灰度和观测；功能回归、数据验证需补成验收清单。

</details>

<a id="gpt-q-24"></a>

### 自测 24：如果升级当天大量接口500，你第一步干什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**期待：**
**止血，而不是直接在线**Debug**。**
**顺序类似：**
**限流**/**回滚** → **确认影响** → **对比变更** → **定位** → **修复** → **验证。**

**已有题库对照**

- [第232题：架构升级与技术迁移（简历专项 06）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)
- [第236题：JVM 故障排查（简历专项 10）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/236-jvm-full-gc-troubleshooting.md)

**覆盖与缺口：**可组合回切和先止血的处理步骤。

</details>

<a id="gpt-q-25"></a>

### 自测 25：老代码没人敢删怎么办？

资料：**未找到直接解答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这是很好的实际题。**
**你可以讲：**
**日志埋点** → **调用统计** → **一段观察期** → **灰度拦截** → **最终删除。**
**这就是资深工程实践。**


⸻

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到旧代码下线观察期、拦截验证的专门解答。

</details>


<a id="gpt-group-26"></a>

## Oracle 与 OceanBase（自测 26～45）

<a id="gpt-q-26"></a>

### 自测 26：为什么迁 OceanBase？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不能只说信创。**
**最好：**
**外部合规**/**信创要求** + Oracle**兼容成本** + **运维体系** + **国产化战略。**
**技术层面不要乱编商业理由。**

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)

**覆盖与缺口：**有租户模式与兼容成本，真实迁移动机需自己补。

</details>

<a id="gpt-q-27"></a>

### 自测 27：Oracle 和 OceanBase 最大的兼容问题是什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**你简历已经自己列了：**
* **分页；**
* CONNECT BY**；**
* **空字符串；**
* **函数；**
* **存储过程。**
**必须逐个能讲。**

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)

**覆盖与缺口：**先读 GPT 纠错，再读模式选型和差异清单。

</details>

<a id="gpt-q-28"></a>

### 自测 28：Oracle 的 ROWNUM 为什么不能简单机械替换？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**比如分页：**
```
ROWNUM

```
**与：**
```
LIMIT offset, size

```
**执行语义和排序位置可能不同。**
**至少知道：**
ORDER BY **与分页先后关系会影响结果。**

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)
- [MySQL · 深分页优化](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/48-deep-pagination-optimization.md)

**覆盖与缺口：**有分页与模式边界，缺 ROWNUM 排序语义的对比示例。

</details>

<a id="gpt-q-29"></a>

### 自测 29：CONNECT BY 是什么？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**必须能解释：**
Oracle**层次查询。**
**典型：**
```
START WITH ...
CONNECT BY PRIOR ...

```

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)

**覆盖与缺口：**仅介绍层级查询兼容与待验证写法，缺完整语法示例。

</details>

<a id="gpt-q-30"></a>

### 自测 30：怎么改递归CTE？

资料：**未找到直接解答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少自己能手写：**
```
WITH RECURSIVE org_tree AS (
    SELECT ...
    FROM org
    WHERE id = ?

    UNION ALL

    SELECT o.*
    FROM org o
    JOIN org_tree t
      ON o.parent_id = t.id
)
SELECT *
FROM org_tree;

```
**然后面试官会问：**
**怎么防环？**
**你至少想到：**
* **数据保证；**
* **深度限制；**
* path**记录；**
* visited**思想。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到可直接复用的递归 CTE 加防环完整解答；原题自带示例。

</details>

<a id="gpt-q-31"></a>

### 自测 31：Oracle空字符串为什么是坑？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这个一定准备。**
Oracle**中：**
```
'' ≈ NULL

```
**而不同数据库语义可能不同。**
**于是：**
```
column = ''

```
**以及程序：**
```
"".equals(value)

```
**迁移后可能出现业务差异。**

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)

**覆盖与缺口：**有两种租户模式的空字符串差异；原文的等号表示语义类比，不能照抄成 SQL 判断式。

</details>

<a id="gpt-q-32"></a>

### 自测 32：怎么批量找出不兼容SQL？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**高质量答案：**
**静态扫描** Mapper/XML + SQL**日志采样** + **关键字规则** + **生产**SQL**统计** + **人工**review**。**

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)

**覆盖与缺口：**有 OMA 兼容评估、SQL/对象清单与逐项验证。

</details>

<a id="gpt-q-33"></a>

### 自测 33：MyBatis分页拦截器到底怎么写？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这是你的高风险点。**

**至少知道拦截：**
```
Executor
StatementHandler
ParameterHandler
ResultSetHandler

```
**分页通常关注：**
StatementHandler / SQL**构造链路。**

**已有题库对照**

- [MyBatis 源码深度拆解（九）：插件 Plugin 拦截器底层原理](<../../learning/source-reading/mybatis-source-09-plugin-interceptor.md>)

**覆盖与缺口：**插件文章有四大拦截点、代理链和 PageInterceptor 示例。

</details>

<a id="gpt-q-34"></a>

### 自测 34：你怎么拿到原SQL？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**需要知道：**
BoundSql**。**

**已有题库对照**

- [MyBatis 源码深度拆解（六）：#{} 与 ${} 底层解析 &amp; SQL 预编译](<../../learning/source-reading/mybatis-source-06-param-binding-prepared-statement.md>)
- [MyBatis 源码深度拆解（九）：插件 Plugin 拦截器底层原理](<../../learning/source-reading/mybatis-source-09-plugin-interceptor.md>)

**覆盖与缺口：**有 MappedStatement 获取 BoundSql 和动态 SQL 参数绑定链路。

</details>

<a id="gpt-q-35"></a>

### 自测 35：怎么防止误改SQL？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**例如：**
* **已有分页不重复加；**
* count**查询；**
* UNION**；**
* **子查询；**
* FOR UPDATE**；**
* **动态**SQL**。**
**如果你完全没有真正实现过，这里建议简历降级。**

**已有题库对照**

- [MyBatis 源码深度拆解（九）：插件 Plugin 拦截器底层原理](<../../learning/source-reading/mybatis-source-09-plugin-interceptor.md>)

**覆盖与缺口：**有分页方言、count、CacheKey、两种 query 重载；缺完整复杂 SQL 回归矩阵。

</details>

<a id="gpt-q-36"></a>

### 自测 36：为什么不用现成PageHelper？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**必须能回答：**
**自研的必要性是什么？**
**如果只是“公司没用”，那就别把自研写太重。**

**已有题库对照**

- [MyBatis 源码深度拆解（九）：插件 Plugin 拦截器底层原理](<../../learning/source-reading/mybatis-source-09-plugin-interceptor.md>)

**覆盖与缺口：**可读 PageHelper 实现比较成本，自研理由须来自实际约束。

</details>

<a id="gpt-q-37"></a>

### 自测 37：如何验证迁移前后结果一致？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不要只说：**
count**一样。**
**需要：**
* **行数；**
* **主键集合；**
* **字段级比较；**
* **金额汇总；**
* **排序；**
* NULL**；**
* **时间精度；**
* **小数精度。**

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)

**覆盖与缺口：**有行数、分批校验、精度时区；业务语义比对仍需补。

</details>

<a id="gpt-q-38"></a>

### 自测 38：千万级表怎么比对？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不能全量一次拉**JVM**。**
**考虑：**
**分片** / **主键区间** / hash / aggregate checksum / **分页流式比对。**

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)
- [MySQL · 深分页优化](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/48-deep-pagination-optimization.md)

**覆盖与缺口：**可复用分批校验和游标分页；缺千万级一致快照比对方案。

</details>

<a id="gpt-q-39"></a>

### 自测 39：比对发现1000条差异怎么办？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**要分类：**
**真差异** / NULL**语义** / **时间精度** / **数据延迟** / **顺序差异** / **浮点**/decimal**。**

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)

**覆盖与缺口：**列出类型、精度、时区差异，缺逐层缩小差异范围的过程。

</details>

<a id="gpt-q-40"></a>

### 自测 40：迁移过程中怎么灰度？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**理想思路：**
**双写**/**双读不是唯一答案。**
**根据系统情况：**
**影子流量、读校验、应用分批切换、新旧结果对比。**

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)
- [第232题：架构升级与技术迁移（简历专项 06）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)

**覆盖与缺口：**有影子库、渠道灰度和切流骨架；需区分应用灰度与数据库写入切换。

</details>

<a id="gpt-q-41"></a>

### 自测 41：怎么回滚？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**必须提前设计：**
**应用版本回退** ≠ **数据回退。**

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)

**覆盖与缺口：**提到反向同步回退，缺追平检查、写入封口和演练条件。

</details>

<a id="gpt-q-42"></a>

### 自测 42：如果迁移过程中两边都发生写入怎么办？

资料：**未找到直接解答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这是深题。**
**需要明确：**
**谁是** source of truth**。**
**不能双主随便写。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到双边写入冲突、写入权转移的完整解答。

</details>

<a id="gpt-q-43"></a>

### 自测 43：OGG原来干什么？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**如果你写了**OGG**，就必须知道：**
CDC / **数据同步。**

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)

**覆盖与缺口：**只有增量同步类比，未充分解释 OGG 链路。

</details>

<a id="gpt-q-44"></a>

### 自测 44：为什么部分OGG/存储过程改Java + XXL-Job？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**你要讲** trade-off**：**
**优点：**
* **可维护；**
* **可测试；**
* Java**团队掌控；**
* **监控；**
* **发布。**
**缺点：**
* **网络**IO**；**
* **性能；**
* **数据库内计算可能更快；**
* **分布式失败场景增加。**

**已有题库对照**

- [Spring Batch 入门到实战：从定时循环到可恢复的批处理系统](<../../learning/java/2026-09-04-spring-batch-guide.md>)

**覆盖与缺口：**批处理文章提供可靠重跑背景，缺 OGG/存储过程改造取舍。

</details>

<a id="gpt-q-45"></a>

### 自测 45：OceanBase“分布式并行查询”到底是什么？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**你简历写了这个。**

**如果答不出：**
**删掉这句话。**
**因为一问执行计划、并行度、分区裁剪，很容易穿。**


⸻

**已有题库对照**

- [MySQL EXPLAIN 执行计划 + Oracle 执行计划](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/23-mysql-explain-execution-plan.md)

**覆盖与缺口：**有 OceanBase 执行计划入口，缺并行查询执行机制专题。

</details>


<a id="gpt-group-46"></a>

## SQL、报表与导出（自测 46～63）

<a id="gpt-q-46"></a>

### 自测 46：讲一个真实慢SQL。

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**必须准备：**
**原**SQL → EXPLAIN → **根因** → **改法** → **数据量** → **优化前** → **优化后。**
**这比背**100**道**MySQL**强。**

**已有题库对照**

- [MySQL · 慢SQL排查](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/12-mysql-slow-sql.md)
- [第234题：报表性能优化（简历专项 08）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/234-report-performance-optimization.md)

**覆盖与缺口：**有慢 SQL 方法和旧回答；具体 SQL、基线与结果仍需你提供。

</details>

<a id="gpt-q-47"></a>

### 自测 47：EXPLAIN主要看什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少：**
* type**；**
* possible_keys**；**
* key**；**
* key_len**；**
* rows**；**
* filtered**；**
* Extra**。**

**已有题库对照**

- [MySQL EXPLAIN 执行计划 + Oracle 执行计划](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/23-mysql-explain-execution-plan.md)

**覆盖与缺口：**直接读 MySQL EXPLAIN 的四个核心字段与实际计划。

</details>

<a id="gpt-q-48"></a>

### 自测 48：type有哪些？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**典型优先顺序大致知道：**
```
system
const
eq_ref
ref
range
index
ALL

```
**不要像另一位受访者那样把** where **当** type**。**

**已有题库对照**

- [MySQL EXPLAIN 执行计划 + Oracle 执行计划](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/23-mysql-explain-execution-plan.md)

**覆盖与缺口：**有 type 详解及 const、eq_ref 区别。

</details>

<a id="gpt-q-49"></a>

### 自测 49：Using filesort 一定不好吗？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

```
Using filesort

```
一定不好吗？
**不是。**
**关键：**
**数据量、内存、排序字段、索引、业务成本。**

**已有题库对照**

- [MySQL EXPLAIN 执行计划 + Oracle 执行计划](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/23-mysql-explain-execution-plan.md)

**覆盖与缺口：**有 filesort 机制与优化，结合原提示说明不应一见排序就否定。

</details>

<a id="gpt-q-50"></a>

### 自测 50：Using temporary 一定必须优化吗？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

```
Using temporary

```
一定必须优化吗？
**也不是绝对。**
**资深回答不能机械：**
**出现**=**坏。**

**已有题库对照**

- [MySQL EXPLAIN 执行计划 + Oracle 执行计划](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/23-mysql-explain-execution-plan.md)

**覆盖与缺口：**有 temporary 场景与优化，缺必须优化与否的成本判断。

</details>

<a id="gpt-q-51"></a>

### 自测 51：联合索引顺序怎么决定？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不要只背最左匹配。**
**考虑：**
* **等值；**
* **范围；**
* **过滤性；**
* ORDER BY**；**
* GROUP BY**；**
* **覆盖索引；**
* **查询频率。**

**已有题库对照**

- [MySQL · 联合索引设计](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/11-mysql-composite-index.md)
- [MySQL EXPLAIN 执行计划 + Oracle 执行计划](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/23-mysql-explain-execution-plan.md)

**覆盖与缺口：**可复用联合索引与 WHERE、排序、覆盖索引的讨论。

</details>

<a id="gpt-q-52"></a>

### 自测 52：为什么不能“选择性最高字段永远放第一位”？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**因为索引设计是：**
workload-driven**。**

**已有题库对照**

- [MySQL · 联合索引设计](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/11-mysql-composite-index.md)

**覆盖与缺口：**有最左前缀和选择性，需结合查询组合解释而非背排序口诀。

</details>

<a id="gpt-q-53"></a>

### 自测 53：什么是覆盖索引？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**必须能讲：**
**避免回表。**

**已有题库对照**

- [MySQL · 联合索引设计](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/11-mysql-composite-index.md)
- [MySQL EXPLAIN 执行计划 + Oracle 执行计划](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/23-mysql-explain-execution-plan.md)

**覆盖与缺口：**有覆盖索引及 Using index。

</details>

<a id="gpt-q-54"></a>

### 自测 54：什么是回表？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

InnoDB**：**
**二级索引叶子存主键，再回聚簇索引查完整行。**

**已有题库对照**

- [MySQL · 联合索引设计](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/11-mysql-composite-index.md)
- [MySQL EXPLAIN 执行计划 + Oracle 执行计划](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/23-mysql-explain-execution-plan.md)

**覆盖与缺口：**有二级索引回表解释。

</details>

<a id="gpt-q-55"></a>

### 自测 55：为什么 %abc 通常不好走 B+Tree 索引？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

```
%abc

```
通常不好走B+Tree索引？
**左侧无法确定有序范围。**

**已有题库对照**

- [MySQL · 联合索引设计](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/11-mysql-composite-index.md)
- [MySQL · 慢SQL排查](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/12-mysql-slow-sql.md)

**覆盖与缺口：**有前导模糊匹配和索引使用边界。

</details>

<a id="gpt-q-56"></a>

### 自测 56：为什么子查询改JOIN可能更快？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**但不要回答：**
JOIN**一定更快。**

**已有题库对照**

- [第234题：报表性能优化（简历专项 08）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/234-report-performance-optimization.md)
- [MySQL · 慢SQL排查](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/12-mysql-slow-sql.md)

**覆盖与缺口：**有 SQL 改写和 JOIN 方向，缺两种计划的实测对比。

</details>

<a id="gpt-q-57"></a>

### 自测 57：为什么把JOIN拆到Java里不一定更好？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这个我前面特别提醒过。**
**缺点：**
* RTT**；**
* **传输；**
* JVM**内存；**
* **优化器能力丢失。**

**已有题库对照**

- [第234题：报表性能优化（简历专项 08）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/234-report-performance-optimization.md)
- [第235题：大数据导出（简历专项 09）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/235-million-row-excel-export.md)

**覆盖与缺口：**有拆批合并和并发限流，但不能照搬旧文中偏绝对的优化结论。

</details>

<a id="gpt-q-58"></a>

### 自测 58：什么是物化视图？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**你写了，就得知道：**
**预计算结果。**
**然后追：**
**刷新机制？实时性？一致性？**

**已有题库对照**

- [第234题：报表性能优化（简历专项 08）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/234-report-performance-optimization.md)

**覆盖与缺口：**有物化视图应用场景，刷新机制与一致性需补。

</details>

<a id="gpt-q-59"></a>

### 自测 59：报表为什么适合预聚合？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**典型：**
**写少读多、指标重复计算、实时性允许一定延迟。**

**已有题库对照**

- [第234题：报表性能优化（简历专项 08）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/234-report-performance-optimization.md)

**覆盖与缺口：**有预聚合、刷新延迟与查询成本取舍。

</details>

<a id="gpt-q-60"></a>

### 自测 60：为什么百万Excel不能用XSSFWorkbook？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**因为：**
**大量对象驻留内存。**

**已有题库对照**

- [第235题：大数据导出（简历专项 09）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/235-million-row-excel-export.md)

**覆盖与缺口：**直接读 XSSFWorkbook 全量对象与 OOM 原因。

</details>

<a id="gpt-q-61"></a>

### 自测 61：SXSSFWorkbook为什么省内存？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**窗口机制：**
**旧**row**刷到临时文件，不全部常驻**heap**。**

**已有题库对照**

- [第235题：大数据导出（简历专项 09）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/235-million-row-excel-export.md)

**覆盖与缺口：**滚动窗口、临时文件、刷出行限制已有要点。

</details>

<a id="gpt-q-62"></a>

### 自测 62：SXSSFWorkbook还有什么坑？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

* **临时文件；**
* dispose**；**
* **样式对象；**
* shared strings**；**
* IO**；**
* **文件大小。**

**已有题库对照**

- [第235题：大数据导出（简历专项 09）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/235-million-row-excel-export.md)

**覆盖与缺口：**先看 GPT 纠错，再看临时磁盘、取消、清理与线程安全。

</details>

<a id="gpt-q-63"></a>

### 自测 63：分页并发查数据库为什么可能把DB打死？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**很重要。**
Java**线程变快** ≠ **整体系统变快。**
DB**连接池只有**20**，你开**100**线程基本没意义。**


⸻

**已有题库对照**

- [第235题：大数据导出（简历专项 09）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/235-million-row-excel-export.md)
- [Java 并发 · CompletableFuture 异步编程](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/47-completable-future-async-programming.md)

**覆盖与缺口：**有有界队列背压和限制查询并发的说明。

</details>


<a id="gpt-group-64"></a>

## 关系数据与图查询（自测 64～69）

<a id="gpt-q-64"></a>

### 自测 64：千万级是什么意思？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**一定别回答：**
**一次查询**1000**万节点。**
**正确表述最好：**
**表总体千万级，单次从一个节点出发查询有限深度关联子集。**

**已有题库对照**

- [第234题：报表性能优化（简历专项 08）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/234-report-performance-optimization.md)

**覆盖与缺口：**可参考真实数据量验证；你项目的数据维度与规模须自己说。

</details>

<a id="gpt-q-65"></a>

### 自测 65：关系数据表怎么设计？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**典型：**
```
source_id
target_id
relation_type
create_time

```
**然后索引。**

**已有题库对照**

- [第228题：保险销售领域建模与系统边界（简历专项 02）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/228-insurance-domain-boundary-modeling.md)

**覆盖与缺口：**有业务对象表，缺图关系边表和索引设计。

</details>

<a id="gpt-q-66"></a>

### 自测 66：查“我的三度人脉”怎么实现？

资料：**未找到直接解答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**面试官可能让你画：**
BFS / **递归**CTE**。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到三度关系查询的专门答案。

</details>

<a id="gpt-q-67"></a>

### 自测 67：BFS和DFS哪个更适合查最短关系？

资料：**未找到直接解答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

BFS**。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到 BFS/DFS 最短关系对比的专门答案。

</details>

<a id="gpt-q-68"></a>

### 自测 68：如何避免循环关系？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

A→B→C→A**。**
**需要：**
visited/path**。**

**已有题库对照**

- [第233题：数据库迁移（简历专项 07）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/233-oracle-oceanbase-migration.md)

**覆盖与缺口：**提及层级查询防环相关写法，缺通用图遍历实现。

</details>

<a id="gpt-q-69"></a>

### 自测 69：Neo4j为什么最后没上？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这是很好的资深题。**
**不要说：**
Neo4j**不好。**
**应该：**
**当前关系深度、访问模式、运维成本、已有数据库能力、团队维护成本综合下来收益不足。**
**这体现技术选型能力。**


⸻

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到 Neo4j 未上线的决策记录；公开介绍只有调研结论。

</details>


<a id="gpt-group-70"></a>

## Redis（自测 70～82）

<a id="gpt-q-70"></a>

### 自测 70：Redis分布式锁最简单怎么实现？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

```
SET key value NX PX 30000

```

**已有题库对照**

- [Redis 分布式锁怎么实现？Redisson 的看门狗（Watchdog）机制是什么？Redis 单节点和 Redis Cluster 下的分布式锁有什么区别？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/14-redis-distributed-lock-deep.md)
- [第237题：Redis 分布式锁组件（简历专项 11）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/237-redis-distributed-lock-component.md)

**覆盖与缺口：**有 SET NX PX 与租约、持有者标识。

</details>

<a id="gpt-q-71"></a>

### 自测 71：value为什么不能随便写1？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**必须标识** owner/request**。**
**否则：**
A**锁过期，**B**获取，**A**执行完把**B**的锁删了。**

**已有题库对照**

- [第237题：Redis 分布式锁组件（简历专项 11）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/237-redis-distributed-lock-component.md)

**覆盖与缺口：**有旧持有者误删新锁的具体时序。

</details>

<a id="gpt-q-72"></a>

### 自测 72：为什么解锁需要Lua？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**保证：**
compare value + delete
**原子执行。**

**已有题库对照**

- [第237题：Redis 分布式锁组件（简历专项 11）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/237-redis-distributed-lock-component.md)

**覆盖与缺口：**有校验与删除的 Lua 原子脚本。

</details>

<a id="gpt-q-73"></a>

### 自测 73：锁过期了业务还没结束怎么办？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**锁续期** / watchdog**。**

**已有题库对照**

- [第237题：Redis 分布式锁组件（简历专项 11）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/237-redis-distributed-lock-component.md)

**覆盖与缺口：**有续期、租约过期与下游 fencing 边界。

</details>

<a id="gpt-q-74"></a>

### 自测 74：watchdog怎么设计？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**需要考虑：**
* **周期；**
* owner**；**
* **续期失败；**
* JVM**暂停；**
* Redis**异常。**

**已有题库对照**

- [第237题：Redis 分布式锁组件（简历专项 11）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/237-redis-distributed-lock-component.md)

**覆盖与缺口：**有 owner 校验、有界续期与失败边界；按实际组件版本回答。

</details>

<a id="gpt-q-75"></a>

### 自测 75：怎么实现可重入？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少知道：**
owner + count**。**
**例如**Hash**：**
```
lockKey
  threadId -> count

```

**已有题库对照**

- [第237题：Redis 分布式锁组件（简历专项 11）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/237-redis-distributed-lock-component.md)

**覆盖与缺口：**有 Hash 持有者、计数与加解锁脚本。

</details>

<a id="gpt-q-76"></a>

### 自测 76：Redis主从切换为什么可能丢锁？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

Redis replication**通常异步。**
```
Master SET成功
↓
尚未复制Replica
↓
Master挂
↓
Replica晋升

```
**新**Master**没有这个锁。**

**已有题库对照**

- [第237题：Redis 分布式锁组件（简历专项 11）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/237-redis-distributed-lock-component.md)
- [Redis — Cluster 和 Sentinel 区别 + 主从切换一致性风险](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/38-redis-cluster-sentinel-consistency.md)

**覆盖与缺口：**有异步复制升主导致双持有者的故障窗口。

</details>

<a id="gpt-q-77"></a>

### 自测 77：那Redis分布式锁还能不能用？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**成熟回答：**
**看业务容错等级。**
**一般业务可以。**
**强金融互斥：**
DB**约束** / fencing token / **业务状态** / **幂等可能更可靠。**

**已有题库对照**

- [第237题：Redis 分布式锁组件（简历专项 11）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/237-redis-distributed-lock-component.md)

**覆盖与缺口：**有 DB 约束、幂等与不适用场景。

</details>

<a id="gpt-q-78"></a>

### 自测 78：Redlock解决什么问题？有什么争议？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**如果你要写“自研锁”，最好至少知道。**

**已有题库对照**

- [Redis 分布式锁怎么实现？Redisson 的看门狗（Watchdog）机制是什么？Redis 单节点和 Redis Cluster 下的分布式锁有什么区别？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/14-redis-distributed-lock-deep.md)
- [第237题：Redis 分布式锁组件（简历专项 11）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/237-redis-distributed-lock-component.md)

**覆盖与缺口：**有争议提示；Redlock 前提与完整故障推演需补。

</details>

<a id="gpt-q-79"></a>

### 自测 79：什么是 fencing token？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这是资深加分题。**
**每次获取锁得到单调递增**token**，下游拒绝旧**token**操作。**

**已有题库对照**

- [第237题：Redis 分布式锁组件（简历专项 11）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/237-redis-distributed-lock-component.md)

**覆盖与缺口：**有旧 token 被下游拒绝的例子；旧文 Redis INCR 方案还需审查故障切换下单调性。

</details>

<a id="gpt-q-80"></a>

### 自测 80：缓存穿透、击穿、雪崩分别是什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**基础必须稳。**

**已有题库对照**

- [缓存穿透、缓存击穿、缓存雪崩分别是什么？它们的成因和解决方案有哪些？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/13-redis-cache-penetration-breakdown-avalanche.md)

**覆盖与缺口：**缓存穿透、击穿、雪崩有专门解答。

</details>

<a id="gpt-q-81"></a>

### 自测 81：缓存和数据库一致性怎么做？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**经典：**
**先更新**DB**，再删缓存。**
**然后追：**
**删除缓存失败怎么办？**
MQ/**重试**/CDC/**最终一致性。**

**已有题库对照**

- [更新数据库后删缓存（Cache Aside Pattern）为什么比“先删缓存再更新 DB”推荐？极端情况下（如并发读写）仍然会不一致，怎么兜底？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/24-cache-aside-pattern.md)

**覆盖与缺口：**Cache Aside 更新和一致性边界有专门讨论。

</details>

<a id="gpt-q-82"></a>

### 自测 82：为什么不建议先删缓存再更新DB？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**并发下可能把旧值重新写回。**


⸻

**已有题库对照**

- [更新数据库后删缓存（Cache Aside Pattern）为什么比“先删缓存再更新 DB”推荐？极端情况下（如并发读写）仍然会不一致，怎么兜底？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/24-cache-aside-pattern.md)

**覆盖与缺口：**可读删除缓存与更新数据库的并发时序。

</details>


<a id="gpt-group-83"></a>

## 消息与异步架构（自测 83～93）

<a id="gpt-q-83"></a>

### 自测 83：为什么用MQ？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不要只背：**
**解耦、异步、削峰。**
**每一个都给真实业务案例。**

**已有题库对照**

- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)
- [RocketMQ vs Kafka：事务、原子写入、有序性](<../../learning/middleware/rocketmq-kafka-transaction-ordering.md>)

**覆盖与缺口：**有解耦、异步、削峰和可靠投递场景。

</details>

<a id="gpt-q-84"></a>

### 自测 84：什么情况下不应该用MQ？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这是资深题。**
**例如：**
**强同步响应、链路极简单、运维成本大于收益。**

**已有题库对照**

- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)
- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)

**覆盖与缺口：**有非核心异步与资金链路区别，需补同步结果约束的反例。

</details>

<a id="gpt-q-85"></a>

### 自测 85：消息重复怎么办？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**答案不是：**
MQ**保证不重复。**
**正确：**
Consumer**必须业务幂等。**

**已有题库对照**

- [RocketMQ vs Kafka：事务、原子写入、有序性](<../../learning/middleware/rocketmq-kafka-transaction-ordering.md>)
- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)

**覆盖与缺口：**有重复投递、幂等与重试补偿。

</details>

<a id="gpt-q-86"></a>

### 自测 86：怎么做业务幂等？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

* **唯一业务号；**
* DB**唯一约束；**
* **状态机；**
* **去重表。**

**已有题库对照**

- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)
- [第230题：商机状态机与防非法流转（简历专项 04）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/230-state-machine-opportunity-flow.md)

**覆盖与缺口：**有业务状态、唯一键和回调幂等；短期缓存去重不能替代持久业务约束。

</details>

<a id="gpt-q-87"></a>

### 自测 87：Consumer业务执行成功但offset没提交，发生什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**重复消费。**

**已有题库对照**

- [RocketMQ vs Kafka：事务、原子写入、有序性](<../../learning/middleware/rocketmq-kafka-transaction-ordering.md>)
- [Kafka 消费者组 + Rebalance（重平衡）机制 + 消息丢失/重复消费排查](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/22-kafka-consumer-group-rebalance.md)

**覆盖与缺口：**有 offset、重复消费与业务幂等边界。

</details>

<a id="gpt-q-88"></a>

### 自测 88：offset提交成功，业务还没完成机器挂了呢？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**可能业务丢失。**

**已有题库对照**

- [RocketMQ vs Kafka：事务、原子写入、有序性](<../../learning/middleware/rocketmq-kafka-transaction-ordering.md>)

**覆盖与缺口：**有提交顺序与业务丢处理风险。

</details>

<a id="gpt-q-89"></a>

### 自测 89：RocketMQ事务消息解决什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**典型：**
```
发送half message
→ 本地事务
→ commit/rollback
→ broker事务回查

```

**已有题库对照**

- [MQ — RocketMQ 事务消息、延时消息、顺序消息](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/39-rocketmq-transaction-delay-ordered.md)
- [RocketMQ vs Kafka：事务、原子写入、有序性](<../../learning/middleware/rocketmq-kafka-transaction-ordering.md>)

**覆盖与缺口：**有半消息、本地事务、回查机制。

</details>

<a id="gpt-q-90"></a>

### 自测 90：它是不是分布式事务强一致？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不是。**

**已有题库对照**

- [MQ — RocketMQ 事务消息、延时消息、顺序消息](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/39-rocketmq-transaction-delay-ordered.md)

**覆盖与缺口：**可读事务消息的作用范围和最终一致性边界。

</details>

<a id="gpt-q-91"></a>

### 自测 91：MQ削峰到底削什么峰？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**关键：**
**把瞬时生产速度和下游消费速度解耦。**

**已有题库对照**

- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)

**覆盖与缺口：**有生产消费速率、非实时动作与削峰。

</details>

<a id="gpt-q-92"></a>

### 自测 92：消息积压怎么办？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少：**
* **判断生产**/**消费速率；**
* **增消费者；**
* **增**partition/queue**；**
* **批处理；**
* **降级非核心消息；**
* **临时扩容。**

**已有题库对照**

- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)
- [RocketMQ vs Kafka：事务、原子写入、有序性](<../../learning/middleware/rocketmq-kafka-transaction-ordering.md>)

**覆盖与缺口：**有堆积和最旧消息监控；分区瓶颈、扩容与重放操作需补。

</details>

<a id="gpt-q-93"></a>

### 自测 93：Kafka为什么吞吐高？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少知道：**
* **顺序写；**
* page cache**；**
* batching**；**
* partition**；**
* zero-copy**相关机制。**


⸻

**已有题库对照**

- [RocketMQ vs Kafka：事务、原子写入、有序性](<../../learning/middleware/rocketmq-kafka-transaction-ordering.md>)

**覆盖与缺口：**已有 Kafka 架构背景，需汇总顺序 I/O、批量、压缩与分区。

</details>


<a id="gpt-group-94"></a>

## 线程池与并发（自测 94～107）

<a id="gpt-q-94"></a>

### 自测 94：ThreadPoolExecutor七个参数。

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这个不允许不会。**

**已有题库对照**

- [Java 并发 · 线程池核心参数与执行流程](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/01-thread-pool-core-params.md)

**覆盖与缺口：**七个核心参数表。

</details>

<a id="gpt-q-95"></a>

### 自测 95：新任务进入线程池完整流程是什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

```
core未满 → 新线程
core满 → queue
queue满且 < max → 新线程
max也满 → reject

```

**已有题库对照**

- [Java 并发 · 线程池核心参数与执行流程](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/01-thread-pool-core-params.md)

**覆盖与缺口：**正确流程与 execute 源码。

</details>

<a id="gpt-q-96"></a>

### 自测 96：为什么不是先扩到max再入队？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这是设计取舍。**

**已有题库对照**

- [Java 并发 · 线程池核心参数与执行流程](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/01-thread-pool-core-params.md)

**覆盖与缺口：**执行顺序完整，为什么这样设计的取舍需结合原提示展开。

</details>

<a id="gpt-q-97"></a>

### 自测 97：execute和submit异常区别？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**非常重要。**
execute()**：**
**未捕获异常可能导致**worker**线程退出，线程池按需补充。**
submit()**：**
**异常封装在**Future**中，**get**时抛**ExecutionException**。**

**已有题库对照**

- [Java 并发 · CompletableFuture 异步编程](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/47-completable-future-async-programming.md)

**覆盖与缺口：**有 Future 异常处理，缺 execute/submit 的完整对照。

</details>

<a id="gpt-q-98"></a>

### 自测 98：CallerRunsPolicy为什么能产生反压？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**提交线程自己执行：**
producer**被迫变慢。**

**已有题库对照**

- [Java 并发 · 线程池核心参数与执行流程](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/01-thread-pool-core-params.md)

**覆盖与缺口：**有拒绝策略，反压如何传回提交线程需补解释。

</details>

<a id="gpt-q-99"></a>

### 自测 99：线程池怎么估算大小？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

CPU**密集：**
**约**CPU**核数附近。**
IO**密集：**
**根据等待**/**计算比例和下游能力。**
**但必须补一句：**
**最终以压测和下游容量为准。**

**已有题库对照**

- [Java 并发 · 线程池核心参数与执行流程](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/01-thread-pool-core-params.md)
- [Java 并发 · CompletableFuture 异步编程](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/47-completable-future-async-programming.md)

**覆盖与缺口：**有线程池参数和隔离，容量估算须结合任务类型、下游与压测。

</details>

<a id="gpt-q-100"></a>

### 自测 100：为什么连接池20，线程池200没有意义？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**下游资源成为瓶颈。**

**已有题库对照**

- [第235题：大数据导出（简历专项 09）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/235-million-row-excel-export.md)

**覆盖与缺口：**有控制查询并发和背压，可用于说明下游连接池瓶颈。

</details>

<a id="gpt-q-101"></a>

### 自测 101：什么叫线程池隔离？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**例如：**
**报表、核心交易、外部**RPC**使用不同池。**
**防止：**
**一个慢业务占满所有线程。**

**已有题库对照**

- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)
- [Java 并发 · CompletableFuture 异步编程](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/47-completable-future-async-programming.md)

**覆盖与缺口：**有按业务拆线程池与共享池风险。

</details>

<a id="gpt-q-102"></a>

### 自测 102：CompletableFuture默认线程池是什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**通常：**
ForkJoinPool.commonPool**。**

**已有题库对照**

- [Java 并发 · CompletableFuture 异步编程](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/47-completable-future-async-programming.md)

**覆盖与缺口：**有 commonPool 及默认线程池讨论。

</details>

<a id="gpt-q-103"></a>

### 自测 103：为什么业务系统不建议大量阻塞RPC都扔commonPool？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**共享、不可隔离、阻塞导致资源竞争。**

**已有题库对照**

- [Java 并发 · CompletableFuture 异步编程](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/47-completable-future-async-programming.md)

**覆盖与缺口：**有公共线程池阻塞、业务隔离和自定义执行器。

</details>

<a id="gpt-q-104"></a>

### 自测 104：volatile保证什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

* **可见性；**
* **有序性。**
**不能保证：**
i++ **原子性。**

**已有题库对照**

- [volatile、synchronized、CAS 和 JMM 的关系](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/26-volatile-synchronized-cas-jmm.md)

**覆盖与缺口：**volatile 的可见性、有序性与非原子性。

</details>

<a id="gpt-q-105"></a>

### 自测 105：CAS是什么？ABA是什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**你最近重点在补，这部分资深**Java**必须守住。**

**已有题库对照**

- [volatile、synchronized、CAS 和 JMM 的关系](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/26-volatile-synchronized-cas-jmm.md)

**覆盖与缺口：**有 CAS、ABA 与版本标记。

</details>

<a id="gpt-q-106"></a>

### 自测 106：synchronized和ReentrantLock区别？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不要只背功能。**
**结合：**
* **可中断；**
* tryLock**；**
* fairness**；**
* Condition**；**
* JVM**优化。**

**已有题库对照**

- [synchronized` 和 `ReentrantLock` 的区别是什么？各自适用什么场景？ReentrantLock 的公平锁和非公平锁在源码层面有什么区别？为什么默认用非公平锁？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/02-synchronized-vs-reentrantlock.md)

**覆盖与缺口：**有 synchronized 和 ReentrantLock 专门对比。

</details>

<a id="gpt-q-107"></a>

### 自测 107：AQS是什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**最低：**
state + CLH**风格等待队列** + CAS + acquire/release**模板。**


⸻

**已有题库对照**

- [第35题：AQS 的 state、同步队列与独占共享模式](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/35-aqs-state-clh-exclusive-shared.md)
- [并发编程 · lock() vs tryLock()](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/07-lock-vs-trylock-aqs.md)

**覆盖与缺口：**有 state、等待队列、独占共享和获取释放流程。

</details>


<a id="gpt-group-108"></a>

## Spring（自测 108～118）

<a id="gpt-q-108"></a>

### 自测 108：Filter / Interceptor / AOP区别？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**你最好直接画：**
```
Request
 ↓
Filter
 ↓
DispatcherServlet
 ↓
Interceptor.preHandle
 ↓
Controller
 ↓
Service / AOP

```

**已有题库对照**

- [Spring Boot 并发限流拦截器 ConcurrencyThrottleInterceptor 实战](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/learning/java/spring-concurrency-throttle-interceptor.md)
- [Spring AOP 代理原理是什么？JDK 动态代理（Dynamic Proxy）和 CGLIB 怎么选？事务为什么会失效？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/27-spring-aop-proxy-transaction.md)

**覆盖与缺口：**有拦截器与 AOP 背景，但缺 Filter/Interceptor/AOP 完整对照。

</details>

<a id="gpt-q-109"></a>

### 自测 109：哪个适合做登录token？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

Filter**或**Interceptor**，看架构。**

**已有题库对照**

- [Spring Boot 并发限流拦截器 ConcurrencyThrottleInterceptor 实战](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/learning/java/spring-concurrency-throttle-interceptor.md)

**覆盖与缺口：**有拦截机制，缺认证过滤链与登录 Token 放置位置的专门答案。

</details>

<a id="gpt-q-110"></a>

### 自测 110：Controller方法注解权限为什么Interceptor更方便？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**因为：**
HandlerMethod**。**

**已有题库对照**

- [Spring Boot 并发限流拦截器 ConcurrencyThrottleInterceptor 实战](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/learning/java/spring-concurrency-throttle-interceptor.md)

**覆盖与缺口：**有拦截器文章，但缺 HandlerMethod 读取权限注解的直接解答。

</details>

<a id="gpt-q-111"></a>

### 自测 111：Service耗时为什么AOP合适？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

Bean**方法级横切关注点。**

**已有题库对照**

- [Spring AOP 代理原理是什么？JDK 动态代理（Dynamic Proxy）和 CGLIB 怎么选？事务为什么会失效？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/27-spring-aop-proxy-transaction.md)

**覆盖与缺口：**代理与横切逻辑可支撑 Service 耗时统计。

</details>

<a id="gpt-q-112"></a>

### 自测 112：@Transactional 为什么会失效？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

```
@Transactional

```
为什么会失效？
**至少：**
* self invocation**；**
* **非**Spring Bean**；**
* **异常被吃；**
* checked exception**默认；**
* **新线程；**
* **方法代理边界。**

**已有题库对照**

- [Spring AOP 代理原理是什么？JDK 动态代理（Dynamic Proxy）和 CGLIB 怎么选？事务为什么会失效？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/27-spring-aop-proxy-transaction.md)
- [Spring 事务传播机制是什么？挂起事务的底层实现？为什么 checked exception 默认不回滚？NESTED 事务的 savepoint 机制？JTA 是什么？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/16-spring-transaction-propagation-internals.md)

**覆盖与缺口：**有代理失效、异常回滚规则和事务边界。

</details>

<a id="gpt-q-113"></a>

### 自测 113：this.xxx()为什么事务可能失效？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**因为：**
**没经过**proxy**。**

**已有题库对照**

- [Spring AOP 代理原理是什么？JDK 动态代理（Dynamic Proxy）和 CGLIB 怎么选？事务为什么会失效？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/27-spring-aop-proxy-transaction.md)

**覆盖与缺口：**有 this 自调用不经过代理的解释。

</details>

<a id="gpt-q-114"></a>

### 自测 114：Spring事务传播机制。

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少掌握：**
REQUIRED**、**REQUIRES_NEW**、**NESTED**。**

**已有题库对照**

- [Spring 事务传播机制是什么？挂起事务的底层实现？为什么 checked exception 默认不回滚？NESTED 事务的 savepoint 机制？JTA 是什么？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/16-spring-transaction-propagation-internals.md)

**覆盖与缺口：**有传播机制、事务拦截和场景分析。

</details>

<a id="gpt-q-115"></a>

### 自测 115：REQUIRES_NEW做什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**挂起外层事务，创建新事务。**

**已有题库对照**

- [Spring 事务传播机制是什么？挂起事务的底层实现？为什么 checked exception 默认不回滚？NESTED 事务的 savepoint 机制？JTA 是什么？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/16-spring-transaction-propagation-internals.md)

**覆盖与缺口：**有挂起外层与独立事务。

</details>

<a id="gpt-q-116"></a>

### 自测 116：A调用B，B异常被A catch，事务怎么走？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**一定结合传播级别分析，不能机械回答。**

**已有题库对照**

- [Spring 事务传播机制是什么？挂起事务的底层实现？为什么 checked exception 默认不回滚？NESTED 事务的 savepoint 机制？JTA 是什么？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/16-spring-transaction-propagation-internals.md)

**覆盖与缺口：**可按传播行为与 rollback-only 分析，不能只看外层 catch。

</details>

<a id="gpt-q-117"></a>

### 自测 117：Spring Bean生命周期。

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**资深不需要背到每个**Processor**名字，但必须理解：**
**实例化** → **属性注入** → aware → BPP before → init → BPP after/proxy**。**

**已有题库对照**

- [Spring Bean 的完整生命周期是怎样的？三级缓存如何解决循环依赖问题？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/15-spring-ioc-bean-lifecycle-circular-dependency.md)

**覆盖与缺口：**Bean 生命周期完整流程。

</details>

<a id="gpt-q-118"></a>

### 自测 118：Spring循环依赖怎么解决？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少知道：**
singleton**三级缓存与提前暴露引用。**
**再追：**
**构造器循环依赖为什么解决不了？**


⸻

**已有题库对照**

- [Spring Bean 的完整生命周期是怎样的？三级缓存如何解决循环依赖问题？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/15-spring-ioc-bean-lifecycle-circular-dependency.md)

**覆盖与缺口：**三级缓存与循环依赖限制。

</details>


<a id="gpt-group-119"></a>

## RBAC、AOP 与 SpEL（自测 119～127）

<a id="gpt-q-119"></a>

### 自测 119：RBAC有哪些核心模型？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少：**
```
User
Role
Permission
Organization
DataScope

```

**已有题库对照**

- [第229题：RBAC + AOP + SpEL 权限设计（简历专项 03）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/229-rbac-aop-spel-permission.md)

**覆盖与缺口：**用户、角色、权限模型。

</details>

<a id="gpt-q-120"></a>

### 自测 120：功能权限和数据权限有什么区别？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**例如：**
**能不能看客户列表**
vs
**能看哪些客户。**

**已有题库对照**

- [第229题：RBAC + AOP + SpEL 权限设计（简历专项 03）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/229-rbac-aop-spel-permission.md)

**覆盖与缺口：**涉及方法与行级权限，但示例不能替代查询结果的行级过滤。

</details>

<a id="gpt-q-121"></a>

### 自测 121：为什么数据权限比功能权限难？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**因为通常要影响：**
Query**条件。**

**已有题库对照**

- [第229题：RBAC + AOP + SpEL 权限设计（简历专项 03）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/229-rbac-aop-spel-permission.md)

**覆盖与缺口：**有组织树和越权风险，分页、聚合、导出的一致覆盖需补。

</details>

<a id="gpt-q-122"></a>

### 自测 122：AOP怎么知道当前方法需要什么权限？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**典型：**
**自定义**Annotation**。**

**已有题库对照**

- [第229题：RBAC + AOP + SpEL 权限设计（简历专项 03）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/229-rbac-aop-spel-permission.md)
- [Spring AOP 代理原理是什么？JDK 动态代理（Dynamic Proxy）和 CGLIB 怎么选？事务为什么会失效？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/27-spring-aop-proxy-transaction.md)

**覆盖与缺口：**有注解切面和权限表达式读取。

</details>

<a id="gpt-q-123"></a>

### 自测 123：SpEL用来干什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**比如：**
```
@DataPermission("#userId")

```
**从方法参数里计算数据范围。**

**已有题库对照**

- [第229题：RBAC + AOP + SpEL 权限设计（简历专项 03）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/229-rbac-aop-spel-permission.md)

**覆盖与缺口：**有动态表达式评估用途与示例。

</details>

<a id="gpt-q-124"></a>

### 自测 124：SpEL ExpressionParser什么时候创建？

资料：**未找到直接解答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**性能上是否缓存**Expression**？**
**这是很好的一道实战追问。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到 ExpressionParser 生命周期和缓存边界的专门解答。

</details>

<a id="gpt-q-125"></a>

### 自测 125：数据权限最终怎么落到SQL？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**可能方案：**
* MyBatis**拦截器；**
* service query builder**；**
* DAO**参数注入。**
**你必须说你的真实方案。**

**已有题库对照**

- [第229题：RBAC + AOP + SpEL 权限设计（简历专项 03）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/229-rbac-aop-spel-permission.md)
- [MyBatis 源码深度拆解（九）：插件 Plugin 拦截器底层原理](<../../learning/source-reading/mybatis-source-09-plugin-interceptor.md>)

**覆盖与缺口：**有参数化追加条件思路，缺 JOIN、别名、count 等完整实现。

</details>

<a id="gpt-q-126"></a>

### 自测 126：AOP self invocation怎么办？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**如果权限切面被绕过，这是安全问题。**

**已有题库对照**

- [Spring AOP 代理原理是什么？JDK 动态代理（Dynamic Proxy）和 CGLIB 怎么选？事务为什么会失效？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/27-spring-aop-proxy-transaction.md)

**覆盖与缺口：**可复用 self invocation 与代理边界。

</details>

<a id="gpt-q-127"></a>

### 自测 127：如果管理员拥有全量数据权限，SQL怎么避免生成巨大IN？

资料：**未找到直接解答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这是资深业务题。**


⸻

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到管理员全范围权限避免巨大 IN 的专项答案。

</details>


<a id="gpt-group-128"></a>

## Gateway、Nacos 与 Sentinel（自测 128～134）

<a id="gpt-q-128"></a>

### 自测 128：Nacos配置中心和注册中心分别干什么？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**基础。**

**已有题库对照**

- [Sentinel 限流熔断实战指南：接入、规则、持久化与生产实践](<../../learning/middleware/2026-08-07-sentinel-usage-guide.md>)
- [Java单体项目存量HTTP接口暴露为MCP Tool架构方案](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/learning/source-reading/java-mcp-tool-exposure-spring-cloud-gateway.md)

**覆盖与缺口：**分别有配置持久化和服务发现实例，缺两类职责的完整对比。

</details>

<a id="gpt-q-129"></a>

### 自测 129：配置动态更新怎么传播？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**你至少知道客户端监听机制的基本概念。**

**已有题库对照**

- [Sentinel 限流熔断实战指南：接入、规则、持久化与生产实践](<../../learning/middleware/2026-08-07-sentinel-usage-guide.md>)

**覆盖与缺口：**有 Nacos 规则数据源，缺版本相关推送机制与生效范围。

</details>

<a id="gpt-q-130"></a>

### 自测 130：Gateway灰度发布怎么做？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**你简历写了灰度。**

**可能：**
Header / Cookie / **用户**ID hash / version metadata → route**。**

**已有题库对照**

- [第232题：架构升级与技术迁移（简历专项 06）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)

**覆盖与缺口：**有 Header 灰度到新集群的实际讨论。

</details>

<a id="gpt-q-131"></a>

### 自测 131：为什么不能只靠随机10%流量做所有灰度？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**因为：**
**用户请求可能跨版本导致状态不一致。**

**已有题库对照**

- [第232题：架构升级与技术迁移（简历专项 06）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/232-ant-maven-springboot-weblogic-migration.md)

**覆盖与缺口：**有用户白名单定向路由，随机灰度造成会话不稳定等需补。

</details>

<a id="gpt-q-132"></a>

### 自测 132：Sentinel限流和熔断区别？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**限流：**
**控制流量。**
**熔断：**
**下游异常时快速失败。**

**已有题库对照**

- [Sentinel 限流熔断实战指南：接入、规则、持久化与生产实践](<../../learning/middleware/2026-08-07-sentinel-usage-guide.md>)
- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)

**覆盖与缺口：**有流控与熔断的不同规则。

</details>

<a id="gpt-q-133"></a>

### 自测 133：限流算法有哪些？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少：**
* fixed window**；**
* sliding window**；**
* token bucket**；**
* leaky bucket**。**

**已有题库对照**

- [Spring · Spring Boot 限流拦截器](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/50-spring-boot-rate-limiting-interceptor.md)
- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)

**覆盖与缺口：**限流算法与 Sentinel 模式已有比较；先读纠错。

</details>

<a id="gpt-q-134"></a>

### 自测 134：为什么令牌桶允许突发流量？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**桶可以积累**token**。**


⸻

**已有题库对照**

- [Spring · Spring Boot 限流拦截器](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/50-spring-boot-rate-limiting-interceptor.md)

**覆盖与缺口：**令牌桶容量与令牌补充可支撑突发流量解释。

</details>


<a id="gpt-group-135"></a>

## 定时任务与批处理（自测 135～139）

<a id="gpt-q-135"></a>

### 自测 135：Quartz为什么要迁XXL-Job？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不要说**XXL-Job**“更先进”。**
**从：**
* **运维；**
* **可视化；**
* **调度中心；**
* **执行日志；**
* **分布式任务管理；**
* **告警。**
**解释。**

**已有题库对照**

- [Spring Batch 入门到实战：从定时循环到可恢复的批处理系统](<../../learning/java/2026-09-04-spring-batch-guide.md>)

**覆盖与缺口：**有调度平台与批处理职责，缺 Quartz/XXL-Job 迁移对比。

</details>

<a id="gpt-q-136"></a>

### 自测 136：分布式部署时定时任务怎么避免多实例重复执行？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

Quartz**：**
cluster / DB lock**。**
XXL-Job**：**
**调度中心选执行器。**

**已有题库对照**

- [Redis 分布式锁怎么实现？Redisson 的看门狗（Watchdog）机制是什么？Redis 单节点和 Redis Cluster 下的分布式锁有什么区别？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/14-redis-distributed-lock-deep.md)
- [Spring Batch 入门到实战：从定时循环到可恢复的批处理系统](<../../learning/java/2026-09-04-spring-batch-guide.md>)

**覆盖与缺口：**有锁与任务实例控制，缺调度平台多实例运行的端到端解答。

</details>

<a id="gpt-q-137"></a>

### 自测 137：如果Job执行10分钟，下次5分钟后又调度怎么办？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**需要：**
**阻塞策略** / **并发策略。**

**已有题库对照**

- [Spring Batch 入门到实战：从定时循环到可恢复的批处理系统](<../../learning/java/2026-09-04-spring-batch-guide.md>)

**覆盖与缺口：**有任务实例、重复启动和恢复背景，缺调度阻塞策略对比。

</details>

<a id="gpt-q-138"></a>

### 自测 138：Job失败怎么补偿？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**幂等** + retry**。**

**已有题库对照**

- [Spring Batch 入门到实战：从定时循环到可恢复的批处理系统](<../../learning/java/2026-09-04-spring-batch-guide.md>)
- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)

**覆盖与缺口：**有重试、重启、幂等和补偿背景。

</details>

<a id="gpt-q-139"></a>

### 自测 139：为什么定时任务必须幂等？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**因为：**
**重跑是正常能力，不是异常能力。**


⸻

**已有题库对照**

- [Spring Batch 入门到实战：从定时循环到可恢复的批处理系统](<../../learning/java/2026-09-04-spring-batch-guide.md>)
- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)

**覆盖与缺口：**可复用失败重跑、外部副作用和业务去重。

</details>


<a id="gpt-group-140"></a>

## JVM 与 Arthas（自测 140～152）

<a id="gpt-q-140"></a>

### 自测 140：你遇到的内存问题到底是什么？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**必须准备一个真实案例。**
**不要只讲理论。**

**已有题库对照**

- [第236题：JVM 故障排查（简历专项 10）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/236-jvm-full-gc-troubleshooting.md)

**覆盖与缺口：**已有你的原回答和排查方法；真实内存事故仍需自己讲。

</details>

<a id="gpt-q-141"></a>

### 自测 141：怎么发现内存泄漏？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**例如：**
Old Gen**持续上涨** → Full GC**后不明显下降。**

**已有题库对照**

- [第236题：JVM 故障排查（简历专项 10）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/236-jvm-full-gc-troubleshooting.md)
- [Java并发 · ThreadLocal 原理/内存泄漏/线程池复用](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/46-threadlocal-memory-leak-threadpool.md)

**覆盖与缺口：**有持有链、增长趋势和 ThreadLocal 案例；GC 后不降只是线索。

</details>

<a id="gpt-q-142"></a>

### 自测 142：jmap / Heap Dump 拿到以后看什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

```
jmap

```
/Heap Dump拿到以后看什么？
MAT**：**
* Histogram**；**
* Dominator Tree**；**
* Path to GC Roots**；**
* retained heap**。**

**已有题库对照**

- [第236题：JVM 故障排查（简历专项 10）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/236-jvm-full-gc-troubleshooting.md)
- [Arthas Java 诊断工具完全指南](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/learning/java/arthas-diagnostic-guide.md)

**覆盖与缺口：**MAT 分析路径及取 dump 风险已有说明。

</details>

<a id="gpt-q-143"></a>

### 自测 143：shallow heap和retained heap区别？

资料：**未找到直接解答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**资深加分。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到 shallow heap 与 retained heap 的直接对比。

</details>

<a id="gpt-q-144"></a>

### 自测 144：什么是GC Root？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少：**
* thread stack**；**
* static reference**；**
* JNI**；**
* system class**等。**

**已有题库对照**

- [JVM 垃圾回收核心概念：GC Roots、并发标记、浮动垃圾、写屏障、SATB vs Incremental Update](<../../learning/middleware/2026-07-05-jvm-gc-concepts-gc-roots-cms-g1-zgc.md>)

**覆盖与缺口：**GC Roots 专题有定义与类型。

</details>

<a id="gpt-q-145"></a>

### 自测 145：为什么对象还在堆里不代表泄漏？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**可能只是：**
**正常长生命周期对象。**

**已有题库对照**

- [第236题：JVM 故障排查（简历专项 10）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/236-jvm-full-gc-troubleshooting.md)
- [JVM 垃圾回收核心概念：GC Roots、并发标记、浮动垃圾、写屏障、SATB vs Incremental Update](<../../learning/middleware/2026-07-05-jvm-gc-concepts-gc-roots-cms-g1-zgc.md>)

**覆盖与缺口：**可结合可达性与存活集；不能只看对象还在堆里就断定泄漏。

</details>

<a id="gpt-q-146"></a>

### 自测 146：G1基本结构是什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

Region**。**

**已有题库对照**

- [JVM · G1/ZGC/CMS 区别与适用场景](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/51-g1-zgc-cms-garbage-collectors.md)
- [JVM 垃圾回收核心概念：GC Roots、并发标记、浮动垃圾、写屏障、SATB vs Incremental Update](<../../learning/middleware/2026-07-05-jvm-gc-concepts-gc-roots-cms-g1-zgc.md>)

**覆盖与缺口：**有 G1 Region 与回收机制。

</details>

<a id="gpt-q-147"></a>

### 自测 147：Young GC、Mixed GC、Full GC有什么区别？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**必须能讲大概。**

**已有题库对照**

- [JVM · G1/ZGC/CMS 区别与适用场景](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/51-g1-zgc-cms-garbage-collectors.md)
- [JVM 垃圾回收核心概念：GC Roots、并发标记、浮动垃圾、写屏障、SATB vs Incremental Update](<../../learning/middleware/2026-07-05-jvm-gc-concepts-gc-roots-cms-g1-zgc.md>)

**覆盖与缺口：**有 Young、Mixed、Full GC 的区别。

</details>

<a id="gpt-q-148"></a>

### 自测 148：G1为什么有Remembered Set？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**跨**Region**引用跟踪。**

**已有题库对照**

- [JVM 垃圾回收核心概念：GC Roots、并发标记、浮动垃圾、写屏障、SATB vs Incremental Update](<../../learning/middleware/2026-07-05-jvm-gc-concepts-gc-roots-cms-g1-zgc.md>)

**覆盖与缺口：**有 RSet 记录跨 Region 引用的说明；历史文中的固定比例不能当通用结论。

</details>

<a id="gpt-q-149"></a>

### 自测 149：Arthas你真正用过哪些命令？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少准备：**
```
dashboard
thread
jvm
watch
trace
stack
tt
jad

```
**不需要全部真用过。**
**但写“**Arthas**诊断”，至少**3~4**个得熟练。**

**已有题库对照**

- [Arthas Java 诊断工具完全指南](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/learning/java/arthas-diagnostic-guide.md)

**覆盖与缺口：**命令教程可查；真正用过哪些以自己经历作答。

</details>

<a id="gpt-q-150"></a>

### 自测 150：trace和watch区别？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**一个偏调用链耗时，一个观察方法参数**/**返回**/**异常。**

**已有题库对照**

- [Arthas Java 诊断工具完全指南](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/learning/java/arthas-diagnostic-guide.md)

**覆盖与缺口：**trace、watch 有用法和定位场景。

</details>

<a id="gpt-q-151"></a>

### 自测 151：CPU 100%怎么排？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**经典：**
```
top
→ 找PID
→ 找线程
→ thread dump
→ nid
→ stack

```
Arthas**：**
```
thread -n

```

**已有题库对照**

- [JVM 核心原理与线上排查](<../../learning/middleware/2026-06-01-jvm-core-principles-troubleshooting.md>)
- [Arthas Java 诊断工具完全指南](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/learning/java/arthas-diagnostic-guide.md)

**覆盖与缺口：**有线程 CPU、线程 ID、线程栈的定位步骤。

</details>

<a id="gpt-q-152"></a>

### 自测 152：接口突然变慢怎么排？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**系统化回答：**
CPU → GC → **线程池** → DB → Redis → RPC → MQ → **网络。**


⸻

**已有题库对照**

- [第236题：JVM 故障排查（简历专项 10）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/236-jvm-full-gc-troubleshooting.md)
- [Arthas Java 诊断工具完全指南](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/learning/java/arthas-diagnostic-guide.md)
- [MySQL · 慢SQL排查](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/12-mysql-slow-sql.md)

**覆盖与缺口：**可组合应用调用链、GC 和数据库排障。

</details>


<a id="gpt-group-153"></a>

## Seata（自测 153～158）

<a id="gpt-q-153"></a>

### 自测 153：Seata AT原理是什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少：**
TC / TM / RM**。**

**已有题库对照**

- [分布式事务有哪些解决方案？Seata 的 AT 模式底层是怎么实现的？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/09-distributed-transaction.md)

**覆盖与缺口：**有 AT 原理和模拟示例，示例不是生产完整实现。

</details>

<a id="gpt-q-154"></a>

### 自测 154：一阶段做什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**业务**SQL + undo_log **本地事务提交。**

**已有题库对照**

- [分布式事务有哪些解决方案？Seata 的 AT 模式底层是怎么实现的？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/09-distributed-transaction.md)

**覆盖与缺口：**有 before/after image 与本地事务提交。

</details>

<a id="gpt-q-155"></a>

### 自测 155：二阶段commit为什么快？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**主要清理**undo**。**

**已有题库对照**

- [分布式事务有哪些解决方案？Seata 的 AT 模式底层是怎么实现的？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/09-distributed-transaction.md)

**覆盖与缺口：**有二阶段提交清理 undo log 的说明。

</details>

<a id="gpt-q-156"></a>

### 自测 156：rollback怎么做？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**根据**before image / after image**恢复。**

**已有题库对照**

- [分布式事务有哪些解决方案？Seata 的 AT 模式底层是怎么实现的？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/09-distributed-transaction.md)

**覆盖与缺口：**有反向恢复示例，但生产脏写校验和全局锁需另补。

</details>

<a id="gpt-q-157"></a>

### 自测 157：AT有什么限制？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

* **依赖数据库；**
* SQL**限制；**
* **全局锁；**
* **性能；**
* **脏写等。**

**已有题库对照**

- [分布式事务有哪些解决方案？Seata 的 AT 模式底层是怎么实现的？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/09-distributed-transaction.md)

**覆盖与缺口：**有成本比较，SQL 支持、隔离边界和热点锁仍需补。

</details>

<a id="gpt-q-158"></a>

### 自测 158：为什么金融核心现在不一定优先用Seata？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**真正资深要知道：**
**分布式事务框架不是银弹。**
**很多金融场景倾向：**
Saga/TCC/**本地消息**/**状态机**/**对账。**
**如果这几个完全答不出来，把简历从：**
**使用**Seata AT**保障**……
**降成：**
**参与基于**Seata**的分布式事务项目。**


⸻

**已有题库对照**

- [分布式事务有哪些解决方案？Seata 的 AT 模式底层是怎么实现的？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/09-distributed-transaction.md)
- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)

**覆盖与缺口：**可比较 TCC、消息表与 AT，不能套金融场景固定选型口诀。

</details>


<a id="gpt-group-159"></a>

## AI 工程（自测 159～177）

<a id="gpt-q-159"></a>

### 自测 159：普通LLM调用和Agent有什么本质区别？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**高质量：**
Agent**不是“多调几次**LLM**”，核心是模型处于一个观察**→**决策**→**调用工具**→**获得结果**→**继续决策的闭环。**

**已有题库对照**

- [第70题：Agent 与普通 LLM 调用的区别](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/70-agent-vs-llm-calling.md)
- [请设计一个 AI Agent 系统。](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/20-agent-architecture-react.md)

**覆盖与缺口：**普通模型调用与 Agent 控制循环已有专门答案。

</details>

<a id="gpt-q-160"></a>

### 自测 160：Function Calling是什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**模型生成：**
tool name + arguments**。**
**真正执行的是宿主程序。**
**这一句话非常重要：**
**模型不会自己调用你的Java方法。**

**已有题库对照**

- [MCP、Function Calling、Tool 三者的关系和区别是什么？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/21-mcp-protocol-vs-function-calling.md)

**覆盖与缺口：**有工具 schema、模型提议、宿主执行与回填。

</details>

<a id="gpt-q-161"></a>

### 自测 161：MCP解决什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**你最好答：**
**标准化模型**/Agent**客户端和外部能力提供者之间的能力发现、描述和调用协议。**

**已有题库对照**

- [MCP、Function Calling、Tool 三者的关系和区别是什么？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/21-mcp-protocol-vs-function-calling.md)
- [AI Agent · MCP、RAG、Skill 三者区别和组合方式](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/56-mcp-rag-skill-differences.md)

**覆盖与缺口：**有 MCP 的工具接入与协议职责。

</details>

<a id="gpt-q-162"></a>

### 自测 162：MCP和Function Calling区别？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**非常容易问。**
Function Calling**偏：**
**模型**API**能力。**
MCP**偏：**
**外部工具**/**资源暴露的标准协议。**
**二者可以组合。**

**已有题库对照**

- [MCP、Function Calling、Tool 三者的关系和区别是什么？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/21-mcp-protocol-vs-function-calling.md)

**覆盖与缺口：**有 MCP 与 Function Calling 专门对比。

</details>

<a id="gpt-q-163"></a>

### 自测 163：Tool和Skill有什么区别？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**没有绝对统一定义，但大致：**
Tool**：**
**原子能力。**
Skill**：**
**带流程、说明、最佳实践、甚至多个工具组合的可复用能力。**

**已有题库对照**

- [AI Agent · MCP、RAG、Skill 三者区别和组合方式](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/56-mcp-rag-skill-differences.md)

**覆盖与缺口：**有 Tool、Skill、MCP、RAG 的职责区分。

</details>

<a id="gpt-q-164"></a>

### 自测 164：RAG完整流程是什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**至少：**
```
Document
→ Chunk
→ Embedding
→ Vector Store
→ Query Embedding
→ Retrieval
→ Rerank
→ Context
→ LLM

```

**已有题库对照**

- [请设计一个完整的 RAG（Retrieval-Augmented Generation，检索增强生成）系统。](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/19-rag-system-design.md)
- [RAG 系统中的检索索引有哪些类型？稠密向量索引和稀疏向量索引分别适合什么场景？生产环境中通常会怎么做检索？为什么单独用一种索引不够？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/04-rag-retrieval-indices.md)

**覆盖与缺口：**有 RAG 索引、召回、生成的完整链路。

</details>

<a id="gpt-q-165"></a>

### 自测 165：Chunk是不是越小越好？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不是。**
trade-off**：**
**精准度** vs **上下文完整性。**

**已有题库对照**

- [请设计一个完整的 RAG（Retrieval-Augmented Generation，检索增强生成）系统。](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/19-rag-system-design.md)

**覆盖与缺口：**有切块和上下文取舍。

</details>

<a id="gpt-q-166"></a>

### 自测 166：topK越大越好吗？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不是。**
**噪声增加、**token**增加。**

**已有题库对照**

- [请设计一个完整的 RAG（Retrieval-Augmented Generation，检索增强生成）系统。](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/19-rag-system-design.md)
- [RAG — 评测和优化：召回率、精排、幻觉率](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/42-rag-evaluation-optimization.md)

**覆盖与缺口：**有召回与评测，topK 的噪声、成本、窗口取舍需汇总。

</details>

<a id="gpt-q-167"></a>

### 自测 167：什么是rerank？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**召回后用更强模型重新排序。**

**已有题库对照**

- [请设计一个完整的 RAG（Retrieval-Augmented Generation，检索增强生成）系统。](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/19-rag-system-design.md)
- [RAG — 评测和优化：召回率、精排、幻觉率](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/42-rag-evaluation-optimization.md)

**覆盖与缺口：**有重排位置和检索优化。

</details>

<a id="gpt-q-168"></a>

### 自测 168：RAG最大的两个问题？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**例如：**
* recall**不够；**
* context**不准确；**
* hallucination**；**
* stale knowledge**。**

**已有题库对照**

- [RAG — 评测和优化：召回率、精排、幻觉率](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/42-rag-evaluation-optimization.md)

**覆盖与缺口：**有检索与生成两层评价，但不宜把所有问题固定为两个。

</details>

<a id="gpt-q-169"></a>

### 自测 169：如何评价RAG？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不要只说：**
**看回答好不好。**
**至少：**
* retrieval recall**；**
* precision**；**
* answer correctness**；**
* groundedness**。**

**已有题库对照**

- [RAG — 评测和优化：召回率、精排、幻觉率](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/42-rag-evaluation-optimization.md)
- [AI Agent — 评测体系设计：任务成功率、工具调用准确率、幻觉率](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/57-agent-evaluation-system.md)

**覆盖与缺口：**有检索、答案和端到端评测要点。

</details>

<a id="gpt-q-170"></a>

### 自测 170：Tool调用最大的风险是什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**金融系统重点：**
* **越权；**
* **参数错误；**
* **重复执行；**
* prompt injection**；**
* **敏感数据泄露。**

**已有题库对照**

- [请设计一个 AI Agent 系统。](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/20-agent-architecture-react.md)
- [第60题：Interview Harness 两层架构拆分](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/60-interview-harness-two-layer-architecture.md)

**覆盖与缺口：**有工具执行控制与 Harness 边界。

</details>

<a id="gpt-q-171"></a>

### 自测 171：AI为什么不能直接调用“退保/批改”接口？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**必须经过：**
authentication → authorization → **参数验证** → **风控** → **幂等** → audit**。**

**已有题库对照**

- [第60题：Interview Harness 两层架构拆分](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/60-interview-harness-two-layer-architecture.md)
- [第229题：RBAC + AOP + SpEL 权限设计（简历专项 03）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/229-rbac-aop-spel-permission.md)

**覆盖与缺口：**可借用执行器和权限控制；退保、批改业务确认链路要自己补。

</details>

<a id="gpt-q-172"></a>

### 自测 172：SSE为什么适合LLM？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**单向**Server→Client**流式。**

**已有题库对照**

- [SSE 跨层流式系统：从 Spring flush 到浏览器渲染](<../../learning/middleware/2026-07-21-sse-cross-layer-streaming-system.md>)

**覆盖与缺口：**有 SSE 的流式返回和链路说明。

</details>

<a id="gpt-q-173"></a>

### 自测 173：SSE和WebSocket区别？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

SSE**：**
HTTP**、单向、自动重连相对简单。**
WebSocket**：**
**双向长连接。**

**已有题库对照**

- [TCP — 三次握手、四次挥手、WebSocket vs HTTP 轮询](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/58-tcp-three-way-handshake-websocket.md)
- [SSE 跨层流式系统：从 Spring flush 到浏览器渲染](<../../learning/middleware/2026-07-21-sse-cross-layer-streaming-system.md>)

**覆盖与缺口：**有 SSE 与 WebSocket 对比。

</details>

<a id="gpt-q-174"></a>

### 自测 174：LLM生成一半网络断了怎么办？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**你最近公司**SSE**正好有实践。**
**准备：**
* request/session id**；**
* reconnect**；**
* server-side state**；**
* **是否重放；**
* **幂等。**

**已有题库对照**

- [SSE 跨层流式系统：从 Spring flush 到浏览器渲染](<../../learning/middleware/2026-07-21-sse-cross-layer-streaming-system.md>)

**覆盖与缺口：**有生成任务、事件存储与订阅生命周期分离；缺可运行的断点续传实现。

</details>

<a id="gpt-q-175"></a>

### 自测 175：Agent怎么防无限循环？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

* max steps**；**
* timeout**；**
* token budget**；**
* termination condition**。**

**已有题库对照**

- [第71题：ReAct 原理和循环失败](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/71-react-principle-loop-failure.md)
- [请设计一个 AI Agent 系统。](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/20-agent-architecture-react.md)

**覆盖与缺口：**有循环失败和退出控制。

</details>

<a id="gpt-q-176"></a>

### 自测 176：Memory和RAG有什么区别？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

Memory**：**
**个人**/**任务历史。**
RAG**：**
**外部知识检索。**

**已有题库对照**

- [Agent Memory 怎么设计](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/32-agent-memory-design.md)
- [AI Agent · MCP、RAG、Skill 三者区别和组合方式](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/56-mcp-rag-skill-differences.md)

**覆盖与缺口：**有 Memory 与 RAG 的职责和存储区别。

</details>

<a id="gpt-q-177"></a>

### 自测 177：为什么AI输出不能作为金融核心系统最终事实来源？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**因为：**
nondeterministic + hallucination**。**
AI**负责：**
recommendation / interpretation**。**
**确定性系统负责：**
execution / validation**。**
**这一题你如果答漂亮，很符合你资深金融**+AI**的定位。**


⸻

**已有题库对照**

- [第60题：Interview Harness 两层架构拆分](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/60-interview-harness-two-layer-architecture.md)
- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)

**覆盖与缺口：**有执行结果和资金状态背景，需组织成权威账务与模型建议的区别。

</details>


<a id="gpt-group-178"></a>

## 团队管理（自测 178～186）

<a id="gpt-q-178"></a>

### 自测 178：5个人怎么分任务？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不要回答：**
**按能力分。**
**需要讲：**
**任务依赖、风险、成长、关键路径、**backup**。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到你给五人分工的完整案例；原提示可作答题检查点。

</details>

<a id="gpt-q-179"></a>

### 自测 179：一个需求估5天，开发做了8天怎么办？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**考的是：**
**提前识别，不是第**8**天问责。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到延期复盘和调整承诺的个人案例。

</details>

<a id="gpt-q-180"></a>

### 自测 180：junior写的代码明显不行怎么办？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

Code Review**：**
**指问题** → **解释原则** → **给修改方向，而不是自己全部重写。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到辅导开发者的个人案例。

</details>

<a id="gpt-q-181"></a>

### 自测 181：两个高级开发方案吵起来怎么办？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**目标、约束、数据、**PoC**，而不是“我拍板”。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到方案冲突决策的个人案例。

</details>

<a id="gpt-q-182"></a>

### 自测 182：产品强推一个技术风险极高的上线怎么办？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**量化：**
risk / impact / fallback**。**
**不是一句：**
**技术不同意。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到你处理高风险上线分歧的案例。

</details>

<a id="gpt-q-183"></a>

### 自测 183：核心开发离职怎么办？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**暴露：**
bus factor**。**
**通过：**
* **文档；**
* Review**；**
* pair**；**
* ownership rotation**。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到核心开发离职的交接方案记录。

</details>

<a id="gpt-q-184"></a>

### 自测 184：你为什么还写核心代码？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**技术负责人不是完全不编码。**
**应该：**
**关键链路、难点、基础能力自己抓；普通任务适当分出去。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到你保留核心编码职责的个人决策说明。

</details>

<a id="gpt-q-185"></a>

### 自测 185：Code Review主要看什么？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不要只看：**
**规范。**
**至少：**
* correctness**；**
* **并发；**
* transaction**；**
* security**；**
* performance**；**
* readability**；**
* backward compatibility**；**
* observability**。**

**已有题库对照**

- [字节跳动 AI Agent 三轮技术面拿下2-2](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/learning/ai-agent/bytedance-ai-agent-2-2-interview.md)

**覆盖与缺口：**有技术管理与评审方向，缺可直接执行的完整审查清单。

</details>

<a id="gpt-q-186"></a>

### 自测 186：怎么评价一个开发做得好不好？

资料：**需要个人作答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**资深管理：**
**交付结果** + **质量** + ownership + **协作** + **成长。**
**不是：**
**写了多少代码。**


⸻

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到你评价团队成员的具体维度和案例。

</details>


<a id="gpt-group-187"></a>

## 架构思考（自测 187～200）

<a id="gpt-q-187"></a>

### 自测 187：什么情况下你会拆微服务？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不能回答：**
**业务复杂就拆。**
**考虑：**
* **团队边界；**
* **独立扩缩；**
* **独立发布；**
* **数据所有权；**
* **故障隔离。**

**已有题库对照**

- [第228题：保险销售领域建模与系统边界（简历专项 02）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/228-insurance-domain-boundary-modeling.md)

**覆盖与缺口：**有领域划分与边界，缺拆分微服务的成本收益判断。

</details>

<a id="gpt-q-188"></a>

### 自测 188：什么情况下不应该拆？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**如果：**
* **团队很小；**
* **系统不复杂；**
* **发布一致；**
* **强事务很多。**
**模块化单体可能更好。**

**已有题库对照**

- [第228题：保险销售领域建模与系统边界（简历专项 02）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/228-insurance-domain-boundary-modeling.md)

**覆盖与缺口：**可作为边界讨论背景，缺不拆微服务的反例。

</details>

<a id="gpt-q-189"></a>

### 自测 189：微服务最大的成本是什么？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**网络不是唯一问题。**
**还有：**
* distributed transaction**；**
* observability**；**
* deployment**；**
* version compatibility**；**
* debugging**；**
* ops**。**

**已有题库对照**

- [分布式事务有哪些解决方案？Seata 的 AT 模式底层是怎么实现的？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/09-distributed-transaction.md)
- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)

**覆盖与缺口：**有分布式事务、稳定性成本，部署治理等成本需补。

</details>

<a id="gpt-q-190"></a>

### 自测 190：什么叫系统边界？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**数据所有权** + **业务职责** + API contract**。**

**已有题库对照**

- [第228题：保险销售领域建模与系统边界（简历专项 02）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/228-insurance-domain-boundary-modeling.md)

**覆盖与缺口：**有外部协作域、核心对象与本系统职责。

</details>

<a id="gpt-q-191"></a>

### 自测 191：什么叫最终一致性？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**不是：**
**最后肯定一样。**
**而是：**
**在允许的时间窗口内，通过可靠机制最终达到目标状态。**

**已有题库对照**

- [分布式事务有哪些解决方案？Seata 的 AT 模式底层是怎么实现的？](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/09-distributed-transaction.md)
- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)

**覆盖与缺口：**有最终一致性与补偿链路。

</details>

<a id="gpt-q-192"></a>

### 自测 192：什么叫幂等？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**数学意义：**
f(f(x))=f(x)
**业务：**
**同一业务请求重复执行，结果与执行一次等价。**

**已有题库对照**

- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)
- [第230题：商机状态机与防非法流转（简历专项 04）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/230-state-machine-opportunity-flow.md)

**覆盖与缺口：**有重复请求与业务幂等设计。

</details>

<a id="gpt-q-193"></a>

### 自测 193：重试为什么危险？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**因为：**
**上一次可能已经成功，只是**response**丢了。**
**尤其金融。**

**已有题库对照**

- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)
- [RocketMQ vs Kafka：事务、原子写入、有序性](<../../learning/middleware/rocketmq-kafka-transaction-ordering.md>)

**覆盖与缺口：**有重复副作用与幂等、补偿边界。

</details>

<a id="gpt-q-194"></a>

### 自测 194：timeout代表失败吗？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**绝对不能回答“是”。**
**它代表：**
unknown**。**
**这是金融后端非常关键的思想。**

**已有题库对照**

- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)

**覆盖与缺口：**有回调丢失和结果不确定的处理背景。

</details>

<a id="gpt-q-195"></a>

### 自测 195：怎么设计一个可靠的外部支付调用？

资料：**部分覆盖**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**大致：**
```
生成业务流水
→ 本地保存PROCESSING
→ 调支付
→ SUCCESS明确成功
→ FAIL明确失败
→ TIMEOUT保持UNKNOWN/PROCESSING
→ query / callback
→ reconcile

```

**已有题库对照**

- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)

**覆盖与缺口：**有状态、消息表、回调与补偿，查单和完整支付状态机需补。

</details>

<a id="gpt-q-196"></a>

### 自测 196：为什么所有外部调用都应该有业务流水号？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**追踪** + **幂等** + **对账。**

**已有题库对照**

- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)

**覆盖与缺口：**有业务关联、去重和回调补偿依据。

</details>

<a id="gpt-q-197"></a>

### 自测 197：为什么不能无限重试？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**可能：**
* **雪崩；**
* **重复副作用；**
* **下游持续故障。**
**需要：**
backoff + max retries + DLQ/manual intervention**。**

**已有题库对照**

- [第231题：资金划扣与分布式事务（简历专项 05）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/231-tcc-local-message-table-distributed-tx.md)
- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)

**覆盖与缺口：**有有界重试、人工处理和稳定性约束。

</details>

<a id="gpt-q-198"></a>

### 自测 198：什么是指数退避？

资料：**未找到直接解答**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**例如：**
```
1s
2s
4s
8s
...

```
**通常加入** jitter**。**

**已有题库对照**

本次未定位到可直接引用的对应解答。

**覆盖与缺口：**未找到指数退避与 jitter 的直接解答；原题保留了公式提示。

</details>

<a id="gpt-q-199"></a>

### 自测 199：限流、熔断、降级、隔离分别解决什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这是你“稳定性治理”必须能讲清的。**

**已有题库对照**

- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)
- [Sentinel 限流熔断实战指南：接入、规则、持久化与生产实践](<../../learning/middleware/2026-08-07-sentinel-usage-guide.md>)

**覆盖与缺口：**有四类治理手段与各自用途。

</details>

<a id="gpt-q-200"></a>

### 自测 200：一个系统真正的稳定性靠什么？

资料：**已有回答要点**。自测状态：待自测。

<details>
<summary>答完后展开：原提示与已有答案入口</summary>

**GPT 原材料给的提示（原有内容，未计入旧题库覆盖）**

**这题我会期待你答：**
**不是靠某个中间件。**
**而是：**
```
容量评估
+ 超时
+ 重试
+ 幂等
+ 隔离
+ 限流
+ 熔断
+ 降级
+ 监控
+ 告警
+ 灰度
+ 回滚
+ 对账
+ 故障演练

```


⸻

**已有题库对照**

- [第238题：稳定性治理（简历专项 12）](https://github.com/Chinazhouwy/interviewProblems/blob/master/content/opportunity/practice/238-stability-governance.md)

**覆盖与缺口：**事前容量、事中治理、事后对账复盘的骨架。

</details>
