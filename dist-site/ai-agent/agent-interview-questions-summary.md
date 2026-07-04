# Agent面试题总结（深度版）

> **来源**: 小红书 — http://xhslink.com/o/5iNCFrVlMu5 (内容为图片，经OCR提取)
> **标题**: Agent面试题总结 — 详解Agent架构、决策流程与多Agent协作，解析记忆机制及规划能力提升策略
> **标签**: `#Agent` `#面试技巧` `#大模型应用开发` `#求职辅导` `#大模型`
> **考点分类**: Agent架构 / 推理范式 / 记忆机制 / 多Agent协作 / 规划能力 / 反思机制

---

## Q1: 什么是Agent？与大模型有什么本质不同？

### 答题思路

这道题是Agent面试的**开场必考题**，面试官想看你是把Agent当成"套了壳的ChatGPT"还是真正理解了Agent的本质。回答要抓住三个核心差异点：**自主规划、行动能力、闭环反馈**。

### 深度解答

Agent和普通LLM有三个本质区别：

**1. 自主规划能力**：给Agent一个复杂目标，它能自己拆解成多步执行计划。普通LLM收到问题直接生成答案，是"一次性的"；Agent会思考"这个问题需要分几步、每步用什么工具、步骤之间怎么衔接"。

**2. 行动能力**：Agent通过工具调用和外部世界真实交互——搜索、执行代码、调API、读写文件。普通LLM只能生成文本，不能真正"做事"。

**3. 闭环反馈**：每步的执行结果会反馈回来指导下一步，而不是一次性生成完就结束。这是Agent最核心的机制——**感知 → 规划 → 行动 → 再感知**的循环，才是Agent区别于普通LLM的核心。

**工程视角**：在Java里，Agent的核心是一个**循环控制器**：

```java
// Agent核心循环（Spring AI + LangChain4j）
public class AgentLoop {
    
    private final ChatClient llm;
    private final List<Tool> tools;
    private final int maxIterations;
    
    public AgentResponse run(String goal) {
        List<Message> history = new ArrayList<>();
        history.add(new UserMessage(goal));
        
        for (int i = 0; i < maxIterations; i++) {
            // 1. LLM决策：思考 + 选择行动
            ChatResponse response = llm.prompt()
                .messages(history)
                .tools(tools)
                .call()
                .chatResponse();
            
            // 2. 判断是否完成
            if (response.hasFinishReason()) {
                return new AgentResponse(response.getContent());
            }
            
            // 3. 执行工具调用
            for (ToolCall call : response.getToolCalls()) {
                Object result = toolExecutor.execute(call);
                history.add(new ToolResponseMessage(call.id(), result));
            }
            
            // 4. 把结果喂回LLM，继续循环
            history.add(new AssistantMessage(response.getContent()));
        }
        
        return AgentResponse.maxIterationsExceeded();
    }
}
```

### 工程踩坑

- **maxIterations必须设**：不设上限的Agent循环在生产环境是定时炸弹。经验值：简单任务5轮、复杂任务15-20轮。
- **区分finish_reason**：LLM说"我做完了"（stop）和"我需要调工具"（tool_calls）是两种完全不同的状态，处理逻辑不同。

---

## Q2: Agent的基本架构由哪些核心组件构成？

### 答题思路

不要只列名词，要讲清楚每个组件**解决什么问题**、**为什么缺了不行**。

### 深度解答

四大核心组件：

**1. LLM（大脑）**：负责理解任务和做决策。选型考虑：大模型（GPT-4/Qwen-72B）做复杂推理，小模型（Qwen-7B）做简单分类和路由。**生产环境通常大小模型混用**——规划用大模型、执行用小模型，成本降60%以上。

**2. 工具（双手）**：让Agent能跟外部世界交互。搜索、执行代码、调API、读写数据库都靠它。工具设计的关键是**接口清晰**——每个Tool要有明确的输入Schema、输出Schema、描述（让LLM知道什么时候该用它）。

**3. 记忆（记忆）**：让Agent在任务执行过程中保持状态，不会"失忆"。分短期记忆（当前对话）、长期记忆（跨会话）、摘要记忆（压缩历史）三层。

**4. 规划模块（策略）**：负责把复杂目标拆解成可执行步骤。这是Agent区别于"聊天机器人"的关键——聊天机器人只回答问题，Agent会**规划怎么解决问题**。

```
┌──────────────────────────────────────┐
│              规划模块                  │
│    拆解目标 → 生成步骤 → 排序执行      │
├──────┬──────────┬───────────┬────────┤
│ LLM  │   工具    │   记忆     │  反馈  │
│(大脑) │ (双手)    │ (记忆)     │ (修正) │
└──────┴──────────┴───────────┴────────┘
```

### 工程踩坑

- **组件之间的通信协议**：早期用Map<String, Object>传数据，类型不安全、调试困难。后来定义了统一的`AgentMessage`协议，每个组件输入输出都有明确的Java类。
- **LLM不是万能的**：别什么决策都交给LLM。能用规则判断的（比如"该调用哪个工具"这种确定性场景），用规则更快更准。

---

## Q3: Workflow、Agent、Tools这三个概念和区别？

### 答题思路

面试官考的是你对**Agent技术栈的分层理解**——这三个概念分别在不同抽象层级，要讲清楚各自的角色和边界。

### 深度解答

**三者从底层到上层**：

**Tools**：最小的能力单元，封装好的可调用函数。比如搜索、执行代码、发邮件——它只负责"执行"，本身没有任何决策能力。Tools是**被动**的，等别人来调用。

**Agent**：完整的决策系统，内部用LLM做大脑，自己判断什么时候调哪个Tool、要不要继续、什么时候结束。Agent是**主动**的——给它一个目标，它自己决定怎么做。

**Workflow**：更上层的编排框架，把Agent、LLM、Tools组织成一条确定性流程。每个节点做什么、按什么顺序流转——都是开发者事先写死的。

**一句话总结**：Tools不做决策只执行，Agent自己做决策，Workflow是开发者替所有节点把决策提前写好。

| 维度 | Tools | Agent | Workflow |
|------|-------|-------|----------|
| 决策能力 | ❌ 无 | ✅ 自主 | ❌ 开发者预设 |
| 灵活性 | 固定功能 | 高度灵活 | 流程固定 |
| 可控性 | 完全可控 | 不可控 | 完全可控 |
| 适合场景 | 封装原子能力 | 不确定路径任务 | 流程确定的业务 |

### 工程踩坑

- **不要在Workflow里混入Agent逻辑**：Workflow节点应该是确定性的，如果某个节点需要Agent自主决策，把它抽成独立的Agent服务，Workflow只负责调度。

---

## Q4: 了解哪些其他的Agent设计范式？

### 深度解答

三大主流设计范式：

**1. ReAct**（Reasoning + Acting）：边想边干，走一步看一步。每步输出Thought（思考）+ Action（行动），然后获取Observation（观察），再循环。

**2. Plan-and-Execute**：先规划再执行。LLM先生成完整的执行计划，然后逐步执行每个步骤。适合长流程复杂任务，不容易跑偏。

**3. Reflection**：不是独立流程，而是给前两者加的"检查修改buff"——Agent完成一步后自我评估，不达标就重试或调整策略。

### 工程踩坑

- **ReAct的循环漂移**：长链路任务中Agent容易越跑越偏。解决：设置goal reminder，每隔几轮把原始目标重新注入prompt。
- **Plan-and-Execute的规划质量不稳定**：LLM生成的计划可能不合理。解决：加一层plan validation——用规则或另一个LLM验证计划可行性。
- **Reflection的token成本**：每步都反思=LLM调用次数翻倍。解决：只在关键节点启用反思（比如工具调用后、最终输出前）。

---

## Q5: Agent和Workflow的区别是什么？

### 深度解答

核心区别在**决策权归属**：

- **Workflow**：决策权在开发者。每一步怎么走都是固定的，确定性高、好控制，但不灵活。
- **Agent**：决策权在LLM。让LLM自己决定下一步做什么，灵活但不可控。

**生产环境的选择**：不是二选一，而是**混合使用**——主干流程用Workflow保证确定性，关键节点嵌入Agent做灵活决策。

选型判断：如果你能把所有分支都提前想清楚→Workflow；如果分支太多写不完→Agent；如果主干能想清楚但细节不确定→混合模式。

---

## Q6: Agent推理模式有哪些？

### 深度解答

重点讲ReAct，因为它是最常用的：

**ReAct的本质**是**【思考→行动→观察】的循环**：
- 推理过程显式化（Thought可追溯）
- 能动态调用外部工具（解决了CoT只能纯文字推理的局限）
- 循环由代码框架驱动——模型每次只输出Thought+Action，你的代码负责解析、执行工具、把Observation填回历史，再把完整历史传给模型进行下一轮

**ReAct的两个实战局限**：
1. **循环漂移**：长链路中Agent忘了原始目标，越跑越偏
2. **错误传播**：前面一步出错，后面所有步骤都受影响

**Plan-and-Execute怎么解决ReAct的漂移问题**：先把完整计划定下来（规划阶段），再分步执行（执行阶段）。执行阶段不会偏离计划，因为目标在规划阶段就锁定了。

**实际项目中的做法**：两者经常**混合使用**——规划用大模型（一次生成高质量计划）、执行用小模型（降低成本），Plan-and-Execute做框架、ReAct做节点内的细节决策。

```java
// Plan-and-Execute + ReAct混合模式
public class PlanExecuteAgent {
    
    private final ChatClient plannerModel;   // 大模型做规划
    private final ChatClient executorModel;  // 小模型做执行
    
    public Response run(String goal) {
        // Phase 1: 规划 — 用大模型生成步骤
        Plan plan = plannerModel.prompt()
            .user("将以下目标拆解为可执行步骤：\n" + goal)
            .call()
            .entity(Plan.class);
        
        // Phase 2: 逐步执行 — 每步用ReAct
        List<StepResult> results = new ArrayList<>();
        for (Step step : plan.getSteps()) {
            ReActAgent executor = ReActAgent.builder()
                .chatClient(executorModel)
                .tools(step.getRequiredTools())
                .maxIterations(5)
                .context(results)  // 把前面步骤的结果传进去
                .build();
            
            StepResult result = executor.run(step.getDescription());
            results.add(result);
            
            // 可选：Reflection检查
            if (step.isCritical()) {
                boolean passed = reflector.check(result, step.getCriteria());
                if (!passed) {
                    result = executor.run(step.getDescription()); // 重试
                }
            }
        }
        
        return aggregate(results);
    }
}
```

---

## Q7: ReAct、Plan-and-Execute、Reflection三种范式有什么核心区别？实际项目中该如何选型？

### 深度解答

**核心区别在于"决策和执行的关系"**：

| 范式 | 决策-执行关系 | 特点 | 适合场景 |
|------|-------------|------|---------|
| ReAct | 边想边干 | 单步迭代实时调整，灵活度最高 | 短流程、需要实时反馈 |
| Plan-and-Execute | 先想完再干 | 先定完整计划再分步执行 | 长流程复杂任务 |
| Reflection | 检查修正buff | 不独立，给前两者加质量保障 | 高质量要求场景 |

**选型三维度**：
1. **任务复杂度**：简单→ReAct，复杂→Plan-and-Execute
2. **流程确定性**：确定性高→Workflow，不确定→Agent
3. **输出质量要求**：高要求→加Reflection

**新手入门首选ReAct**，因为实现最简单、效果够用。复杂任务用Plan-and-Execute，高要求场景再加Reflection。

### 工程踩坑

- **不要每步都加Reflection**：token成本翻倍、延迟翻倍。只在关键节点（最终输出、重要工具调用后）启用。
- **Plan-and-Execute的计划不是一成不变的**：执行过程中发现计划不合理，要允许重新规划（Re-Planning）。

---

## Q8: 复杂任务怎么做的任务拆分？为什么要拆分？效果如何提升？

### 深度解答

**三层回答框架**：

**第一层：怎么拆**
- **静态拆分**：适合流程固定的场景，直接写死步骤。比如客服工单处理：1)分类→2)检索→3)回复→4)评价
- **动态拆分**：用Plan-and-Execute让LLM自己规划，灵活但规划质量不稳定。需要加plan validation

**第二层：为什么拆**
- LLM的context window有上限，任务越大中间状态越多、越容易出错
- 拆开后每步可以**独立验证和重试**——某步失败只重试这一步，不用全部重来
- 拆分后可以做**并行优化**——没有依赖关系的步骤同时执行

**第三层：拆完还要做的事**
- **分析步骤依赖关系**：画DAG图，找到关键路径
- **把能并行的步骤并发跑**：关键路径时间可以降40%-60%
- **粒度把控**：以原子操作为标准，既不能太细（管理成本高）也不能太粗（失去拆分意义）

```java
// DAG依赖分析 + 并行执行
public class TaskDAG {
    
    public ExecutionPlan analyzeAndOptimize(List<Step> steps) {
        // 1. 构建依赖图
        DAG dag = buildDAG(steps);
        
        // 2. 拓扑排序找关键路径
        List<Step> criticalPath = dag.findCriticalPath();
        
        // 3. 找出可并行的步骤组
        List<Set<Step>> parallelGroups = dag.findParallelGroups();
        
        return new ExecutionPlan(criticalPath, parallelGroups);
    }
    
    public Result execute(ExecutionPlan plan) {
        List<CompletableFuture<StepResult>> futures = new ArrayList<>();
        
        for (Set<Step> group : plan.getParallelGroups()) {
            // 每组内的步骤并行执行
            List<CompletableFuture<StepResult>> groupFutures = group.stream()
                .map(step -> CompletableFuture.supplyAsync(
                    () -> agent.execute(step)))
                .collect(toList());
            
            // 等待当前组全部完成
            CompletableFuture.allOf(groupFutures.toArray(new CompletableFuture[0]))
                .join();
            
            futures.addAll(groupFutures);
        }
        
        return aggregate(futures);
    }
}
```

---

## Q9: 请你介绍一下AI Agent的记忆机制，并说明在实际开发中应该如何设计记忆模块？

### 答题思路

这道题是Agent记忆的**综合大题**，面试官想看你的知识广度和工程深度。回答结构：**四层分类→三个工程核心问题→三阶段闭环**。

### 深度解答

**四层分类**：

| 层级 | 内容 | 生命周期 | 信息密度 |
|------|------|----------|---------|
| 感知记忆 | 当次调用的原始输入 | 最短暂 | 最低 |
| 短期记忆 | Context Window里的messages | 单次会话 | 中等 |
| 长期记忆 | 向量/关系数据库，跨任务持久化 | 永久 | 高 |
| 实体记忆 | 从对话中提炼的结构化事实 | 永久 | 最高 |

**三个工程核心问题**：

**1. 存什么（Write策略）**：
- 只存对下次任务有价值的内容，过滤噪音
- 实体/关系偏好用关系数据库（PostgreSQL），文档知识用向量数据库（Milvus）
- 混合存储是主流——不同类型记忆用不同存储引擎

**2. 取什么（Read策略）**：
- 每次最多注入3-5条最相关的长期记忆
- 用语义检索+规则过滤组合，不能只靠相似度
- 检索结果要做相关性验证，不相关的不要注入（会干扰LLM）

**3. 什么时候存取（When策略）**：
- 任务开始时：加载用户画像摘要
- 任务执行中：按需检索特定知识
- 任务结束时：做记忆压缩和持久化

**三阶段闭环**：**读→用→写**
1. **读**：会话开始时加载相关记忆
2. **用**：把记忆注入prompt辅助决策
3. **写**：任务结束后压缩+持久化新记忆

```java
// 完整的记忆读写闭环
@Service
public class MemoryService {
    
    private final ShortTermMemory shortTerm;    // 当前对话
    private final SummaryMemory summaryMemory;  // Redis摘要
    private final LongTermMemory longTerm;      // Milvus向量库
    private final EntityMemory entityMemory;    // PostgreSQL
    
    // 读：会话开始时加载
    public MemoryContext loadContext(String userId, String query) {
        MemoryContext ctx = new MemoryContext();
        ctx.setUserProfile(entityMemory.getUserProfile(userId));
        ctx.setRecentSummary(summaryMemory.getRecent(userId, 3));
        ctx.setRelevantKnowledge(longTerm.search(query, 5));
        return ctx;
    }
    
    // 写：任务结束后持久化
    public void persist(String userId, Conversation conv) {
        // 1. 提取实体
        List<Entity> entities = entityExtractor.extract(conv);
        entityMemory.save(userId, entities);
        
        // 2. 生成摘要
        String summary = summarizer.summarize(conv);
        summaryMemory.save(userId, summary);
        
        // 3. 关键片段写入长期记忆
        List<String> keyInsights = insightExtractor.extract(conv);
        longTerm.add(userId, keyInsights);
    }
}
```

---

## Q10: Agent的长短期记忆系统怎么做的？记忆是怎么存的？粒度是多少？

### 深度解答

**短期记忆**：Context Window里的对话历史，存当前任务的中间状态，任务结束就清掉。

**长期记忆**：向量数据库存，信息embedding后写入，用的时候做语义检索拿回来注入prompt。

**存储粒度**：按"一次完整交互"或"一个关键事件"为单位存。
- 太细碎→检索噪音大（每句话都存，检索出来的都是碎片）
- 太粗→丢失细节（整个对话存一条，检索出来信息太多又太杂）
- **经验值**：一条记忆约200-500字，对应一次有意义的交互

### 工程踩坑

- **短期记忆的滑动窗口**：Context Window有限，对话超过20轮就需要裁剪。但直接裁剪会丢失上下文——所以裁剪前先做摘要，摘要注入system prompt，然后再裁剪旧消息。
- **长期记忆的更新**：用户的偏好会变，长期记忆不能只增不减。给每条记忆加`last_accessed`和`access_count`，长时间没访问的记忆降权或过期清理。

---

## Q11: 什么是Multi-Agent？

### 深度解答

多智能体系统（Multi-Agent）就是**多个Agent协作完成任务**，每个Agent各有分工——有的负责搜索、有的负责写代码、有的负责做评审。

**为什么需要Multi-Agent？** 单个Agent有两个核心限制：
1. **Context窗口大小**：复杂任务信息量一多就撑爆了
2. **单点能力**：什么都让一个Agent做，每件事都是"泛才"而不是"专才"

Multi-Agent通过**专业分工**和**并行执行**，能处理更复杂、更长流程的任务——这是选择多智能体方案的核心原因。

---

## Q12: 说说Single-Agent和Multi-Agent的设计方案？

### 深度解答

**Single-Agent**：适合任务流程清晰、复杂度适中的场景。实现简单、好维护。

**Multi-Agent架构上主要有两种拓扑**：

**1. 中心化Orchestrator模式**：一个主Agent统一调度各个Worker。优点是好控制、好调试，出问题链路清晰。**我在工程里用中心化用得更多**。

**2. 去中心化Peer-to-Peer模式**：Agent之间直接通信。优点是灵活无单点。缺点是调试困难，可能出现死循环。

```java
// 中心化Orchestrator模式
@Service
public class Orchestrator {
    
    private final Map<String, Agent> agents;  // name -> agent
    
    public Response execute(String goal) {
        // 1. 主Agent拆解任务
        TaskPlan plan = plannerAgent.plan(goal);
        
        // 2. 分发给Worker Agent
        List<CompletableFuture<TaskResult>> futures = new ArrayList<>();
        for (Task task : plan.getTasks()) {
            Agent worker = agents.get(task.getAssignedAgent());
            futures.add(CompletableFuture.supplyAsync(
                () -> worker.execute(task)));
        }
        
        // 3. 收集结果
        List<TaskResult> results = futures.stream()
            .map(CompletableFuture::join)
            .collect(toList());
        
        // 4. 主Agent整合
        return aggregatorAgent.aggregate(results);
    }
}
```

### 工程踩坑

- **Agent之间的数据格式**：不同Agent输出格式不同，Orchestrator要做格式转换。定义统一的`AgentOutput`协议比用Map传数据安全得多。
- **错误隔离**：一个Worker失败不应该拖垮整个系统。每个Worker设超时和fallback。

---

## Q13: Agent记忆压缩通常有哪些方法？

### 深度解答

四种常见方法：

**1. 摘要压缩**：把长对话总结成简短摘要。适合token消耗大但信息密度低的对话。
**2. 滑动窗口**：只保留最近N轮对话。最简单有效，但会丢早期信息。
**3. 重要性过滤**：给每条消息打分，只留重要的。分数来源：LLM评分、规则评分（是否包含关键决策、实体等）。
**4. 结构化抽取**：把关键信息抽成结构化数据（JSON/表）存起来，不存原始文本。信息密度最高。

**实际项目中最常用的组合**：**滑动窗口 + 摘要压缩**——滑动窗口丢弃前先做一次摘要，尽量不丢重要信息。

```java
// 滑动窗口 + 摘要压缩组合
public class CompressingMemory {
    
    private static final int WINDOW_SIZE = 10;
    
    public List<Message> compress(List<Message> messages) {
        if (messages.size() <= WINDOW_SIZE) {
            return messages;  // 不需要压缩
        }
        
        // 1. 把超出窗口的旧消息做摘要
        List<Message> oldMessages = messages.subList(0, messages.size() - WINDOW_SIZE);
        String summary = summarizer.summarize(oldMessages);
        
        // 2. 摘要作为system message保留
        Message summaryMsg = new SystemMessage("对话摘要：" + summary);
        
        // 3. 只保留窗口内的最近消息
        List<Message> recentMessages = messages.subList(
            messages.size() - WINDOW_SIZE, messages.size());
        
        return Stream.concat(Stream.of(summaryMsg), recentMessages.stream())
            .collect(toList());
    }
}
```

---

## Q14: 在工程实践中，为什么有时选择"手搓"Agent，而不是直接用成熟框架？

### 深度解答

**三个核心原因**：

**1. 抽象层太多，调试困难**：成熟框架（LangChain、CrewAI等）做了很多封装，调试时不知道哪步出了问题，得一层层往下扒。手搓的代码每一行都在自己掌控之内，可观测性好、出问题好排查。

**2. 版本升级的破坏性变更**：框架升级经常有breaking change，线上稳定性难保证。手搓代码不受框架版本约束。

**3. 通用设计vs业务需求的偏差**：框架的通用设计和具体业务需求经常有偏差，定制起来反而更费劲。手搓可以完全贴合业务。

**但不是全部手搓**：核心逻辑手写，边缘功能用框架工具。比如：
- Agent循环、记忆管理、编排逻辑 → 手写
- 工具调用封装、Prompt模板 → 可以用LangChain4j的工具注解
- 向量检索 → 可以用Spring AI的VectorStore抽象

### 工程踩坑

- **手搓不等于重复造轮子**：用成熟的底层库（Spring AI、LangChain4j的Tool/Model抽象），只是不用它们的Agent框架层。
- **一定要写好日志和trace**：手搓代码没有框架自带的trace功能，需要自己加MDC和链路ID。

---

## Q15: 如何赋予LLM规划能力？

### 深度解答

三种思路，按复杂度递增：

**1. CoT（Chain of Thought）**：让LLM把推理步骤写出来，线性一步步推导到答案。**最常用**，因为实现成本最低——就是改prompt。效果已经能满足大部分场景。

**2. ToT（Tree of Thought）**：让LLM同时探索多条推理路径，选最优的继续深入。效果比CoT好，但调用次数多，**成本大概是3-5倍**。适合需要探索多种可能性的场景。

**3. GoT（Graph of Thought）**：图结构推理，推理节点可以复用和合并。适合更复杂的任务。但目前**还比较学术**，生产环境没见过真正落地的。

**工程选择**：CoT用最多，ToT在特定场景（比如需要评估多种方案的决策）用，GoT暂不考虑。

```java
// CoT实现 — prompt中加入思考链引导
public class CoTAgent {
    
    private final ChatClient llm;
    
    public Response plan(String goal) {
        return llm.prompt()
            .user("""
                你是一个任务规划专家。请按以下格式规划任务：
                
                目标：{goal}
                
                请按步骤思考：
                1. 思考：分析目标，识别关键子任务
                2. 思考：确定子任务之间的依赖关系
                3. 思考：为每个子任务选择最合适的工具
                4. 输出最终执行计划（JSON格式）
                
                执行计划格式：
                {{
                  "steps": [
                    {{"id": 1, "task": "...", "tool": "...", "depends_on": []}},
                    ...
                  ]
                }}
                """.formatted(goal))
            .call()
            .entity(Plan.class);
    }
}
```

---

## Q16: 讲讲Agent的反思机制？为什么要用反思？具体怎么实现？

### 深度解答

**反思机制**：让Agent在完成一个步骤或整个任务后，自我评估输出质量，判断有没有问题，不达标就重试或调整策略。

**为什么要反思**：
- LLM第一次输出不一定是最优的
- 加一轮自我检查能显著提升质量
- 相当于人写完东西自己再看一遍

**代价**：多至少一次LLM调用，token消耗和延迟都会增加。所以**通常只在质量要求高的关键节点启用反思，不是每步都做**。

**实现方式**：
```java
// 反思机制实现
public class ReflectionWrapper {
    
    private final ChatClient llm;
    
    public Response executeWithReflection(String task, Agent agent) {
        // 第一次执行
        Response firstAttempt = agent.run(task);
        
        // 反思：让LLM自我评估
        ReflectionResult reflection = llm.prompt()
            .user("""
                请评估以下回答的质量：
                
                问题：%s
                回答：%s
                
                评估维度：准确性、完整性、相关性（各1-5分）
                如果总分<12分，请给出改进建议。
                
                输出JSON：{{
                  "scores": {{"accuracy": N, "completeness": N, "relevance": N}},
                  "passed": true/false,
                  "suggestion": "..."
                }}
                """.formatted(task, firstAttempt))
            .call()
            .entity(ReflectionResult.class);
        
        if (reflection.isPassed()) {
            return firstAttempt;
        }
        
        // 不通过，带建议重试
        return agent.run(task + "\n改进建议：" + reflection.getSuggestion());
    }
}
```

### 工程踩坑

- **反思不要超过2轮**：2轮反思后质量提升已经边际递减，但token成本持续增加。设置`maxReflections=2`。
- **反思模型可以和执行模型不同**：执行用小模型（快），反思用大模型（准），效果更好成本可控。

---

## Q17: 如何设计多Agent的协作与动态切换机制？

### 深度解答

**协作靠两件事**：

**1. 消息传递**：Agent完成自己的工作后把结果发出去，下一个Agent取用。实现方式：消息队列（Kafka/Redis Pub-Sub）或共享数据库。

**2. 共享状态**：所有Agent共同读写一个状态对象，记录任务进展和中间结果。实现方式：Redis Hash或数据库表。

**动态切换靠Orchestrator，两种方式**：

**1. 静态路由**：提前写好规则——"任务类型A → Agent X"。简单可靠，但不够灵活。

**2. LLM动态决策**：根据当前情况实时判断该把任务交给谁。灵活但不可控。

**实践策略：两种混用**——主流程用静态路由保证稳定，边缘情况才交给LLM动态判断。

```java
// 混合路由策略
public class HybridRouter {
    
    private final Map<String, Agent> staticRoutes;  // 静态路由表
    private final ChatClient dynamicRouter;          // LLM动态路由
    private final AgentRegistry registry;
    
    public Agent route(Task task) {
        // 1. 先查静态路由
        Agent staticAgent = staticRoutes.get(task.getType());
        if (staticAgent != null) {
            return staticAgent;
        }
        
        // 2. 静态路由没命中，走LLM动态决策
        String agentName = dynamicRouter.prompt()
            .user("""
                根据以下任务描述，选择最合适的Agent：
                
                任务：%s
                可用Agent：%s
                
                只输出Agent名称。
                """.formatted(task.getDescription(), 
                             registry.getAgentDescriptions()))
            .call()
            .content();
        
        return registry.getAgent(agentName);
    }
}
```

### 工程踩坑

- **动态路由的兜底**：LLM可能选一个不存在的Agent。必须加fallback——动态路由失败时，走默认的通用Agent。
- **共享状态的并发控制**：多个Agent同时写共享状态，需要加锁或用CAS。否则数据会互相覆盖。
