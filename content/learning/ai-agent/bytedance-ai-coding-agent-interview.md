---
title: "字节跳动 AI Coding Agent 社招面经"
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
summary: "字节跳动 AI Coding Agent 社招面经"
tags:
---

# 字节跳动 AI Coding Agent 社招面经

> **来源**: 小红书 @只星星  
> **链接**: http://xhslink.com/o/8gT6VONpiCR  
> **标签**: #字节跳动 #AI Coding Agent #社招 #面经  
> **日期**: 2026-05-14  
> **考点分类**: Agent工程化、质量评估体系、SSE长连接、Redis状态管理、代码生成质量保障

---

## 面试概述

字节跳动 AI Coding Agent 岗位社招面经，共14道题，涵盖项目深挖、系统设计、基础原理、编程题。面试兼顾了基础问题和项目深挖，每场都有编程题。

---

## Q1. 自我介绍 & 当前在做什么

**考点**: 项目经验概述、表达能力

**答题思路**: 简洁清晰地说明当前角色、核心项目、技术栈，重点突出与AI Coding Agent相关的经验。

---

## Q2. 你做 Cloud Code 封装的项目，解决了什么问题？

**考点**: Agent工程化封装、降低业务团队使用门槛

**参考答案**:

核心问题：传统数据分析团队想用AI排查报表波动，需要自己搭Agent框架（ReAct循环）、上下文管理、上下文超限压缩、记忆功能、工具规划调试，门槛太高。

**方案**: 把 Cloud Code 部署到远端作为Agent封装层。业务团队只需要写 Skill（定义查问题的流程）和配置 MCP（访问日志的接口），Cloud Code 自动处理规划、工具调用、上下文管理。相当于把Agent的复杂度封装掉，业务团队只关注"查什么问题"。

**深度延伸 — Java工程实现**:

```java
// 基于 Spring AI 的 Agent 封装层设计
@Service
public class CloudCodeAgentService {
    
    private final ChatClient chatClient;
    private final SkillRegistry skillRegistry;
    private final McpToolManager mcpToolManager;
    
    public CloudCodeAgentService(ChatClient chatClient, 
                                  SkillRegistry skillRegistry,
                                  McpToolManager mcpToolManager) {
        this.chatClient = chatClient;
        this.skillRegistry = skillRegistry;
        this.mcpToolManager = mcpToolManager;
    }
    
    /**
     * 核心封装：业务方只需提供 skillId，Agent自动处理
     * 1. 加载对应的Skill定义（Prompt模板+工具链）
     * 2. 注册MCP工具
     * 3. 执行ReAct循环
     * 4. 管理上下文窗口（超限自动压缩）
     */
    public AgentResponse execute(String skillId, String userQuery, 
                                  Map<String, Object> context) {
        // 1. 加载Skill定义
        SkillDefinition skill = skillRegistry.getSkill(skillId);
        
        // 2. 构建Agent执行上下文
        AgentExecutionContext execContext = AgentExecutionContext.builder()
            .systemPrompt(skill.getSystemPrompt())
            .userQuery(userQuery)
            .tools(mcpToolManager.resolveTools(skill.getRequiredMcpServers()))
            .maxRetries(3)
            .contextWindowStrategy(new SlidingWindowStrategy(8000)) // 上下文超限压缩
            .build();
        
        // 3. 执行ReAct循环
        return chatClient.prompt()
            .system(execContext.getSystemPrompt())
            .user(execContext.getUserQuery())
            .tools(execContext.getTools())
            .call()
            .entity(AgentResponse.class);
    }
}

// Skill定义 —— 业务方只需编写这个
@SkillDefinition(id = "report-anomaly", 
    description = "排查报表波动异常",
    requiredMcpServers = {"log-query", "metric-query"})
public class ReportAnomalySkill {
    
    public String getSystemPrompt() {
        return """
            你是一个报表异常排查助手。按照以下步骤排查：
            1. 确认异常时间窗口和指标
            2. 查询相关服务日志
            3. 对比正常时段的指标差异
            4. 定位根因并给出建议
            """;
    }
}
```

**工程踩坑**:
- 上下文超限问题：业务日志可能很长，需要在Agent循环中实现滑动窗口或摘要压缩，否则Token溢出
- Skill版本管理：Skill定义要有版本号，上线后灰度发布，避免一次性替换影响线上
- MCP连接池：多个MCP Server的连接需要池化管理，避免频繁建连

---

## Q3. 这套方案部署到企业级会遇到什么问题？

**考点**: 企业级部署痛点、Agent可观测性

**参考答案**:

主要四个问题：

1. **并发瓶颈**: Cloud Code CLI 基于终端Session，多用户并发时Session是瓶颈
2. **黑盒问题**: Agent中间决策过程不可见，出了bug没法排查日志
3. **质量评估缺失**: 用户问完回答得对不对，没有自动化评估管线
4. **安全脱敏**: 日志可能包含敏感信息，返回给前端前需要脱敏

其中**黑盒问题最棘手**。如果做重一点，可以把Cloud Code编译一下，注入自己的日志埋点，把Agent的决策过程暴露出来。

**深度延伸 — Agent可观测性方案**:

```java
// 基于 OpenTelemetry 的 Agent 决策链路追踪
@Service
public class ObservableAgentExecutor {
    
    private final Tracer tracer; // OpenTelemetry Tracer
    
    public AgentResponse executeWithTrace(AgentRequest request) {
        // 创建根Span —— 整个Agent执行过程
        Span rootSpan = tracer.spanBuilder("agent.execute")
            .setAttribute("skill.id", request.getSkillId())
            .setAttribute("user.query", request.getQuery())
            .startSpan();
        
        try {
            // Planning阶段
            Span planSpan = tracer.spanBuilder("agent.planning").startSpan();
            Plan plan = planningService.generatePlan(request);
            planSpan.setAttribute("plan.steps", plan.getSteps().size());
            planSpan.end();
            
            // 每个Tool Call创建子Span
            for (ToolCall toolCall : plan.getToolCalls()) {
                Span toolSpan = tracer.spanBuilder("agent.tool." + toolCall.getToolName())
                    .setAttribute("tool.input", sanitize(toolCall.getInput())) // 脱敏
                    .startSpan();
                try {
                    ToolResult result = toolExecutor.execute(toolCall);
                    toolSpan.setAttribute("tool.output", sanitize(result.getOutput()));
                    toolSpan.setAttribute("tool.success", result.isSuccess());
                } finally {
                    toolSpan.end();
                }
            }
            
            return generateResponse(plan);
        } finally {
            rootSpan.end();
        }
    }
    
    // 安全脱敏：正则替换敏感信息
    private String sanitize(String input) {
        return input.replaceAll("(password|token|key|secret)\\s*[:=]\\s*\\S+", "$1=***");
    }
}
```

**工程踩坑**:
- 并发瓶颈解决方案：用容器化（Docker/K8s）为每个用户创建独立Agent实例，通过消息队列排队
- 黑盒问题的轻量方案：不一定要重新编译，可以在Agent框架层通过事件回调机制记录决策日志
- 脱敏规则需要可配置：不同企业敏感字段定义不同，脱敏规则做成配置而非硬编码

---

## Q4. 评估用例（验证集）是怎么构建的？

**考点**: 评估数据集构建方法

**答题思路**: 验证集的构建是Agent质量保障的核心。需要说明：
1. 数据来源（真实用户问题 vs 人工构造）
2. 标注方法（人工标注 vs LLM辅助标注）
3. 覆盖度保证（按场景分类确保覆盖）
4. 迭代更新机制（从bad case反向补充）

---

## Q5. 评估分数从83做到92，实际用户反馈怎么样？

**考点**: 评估指标与用户体感的对齐

**参考答案**:

评估分数提升后，用户反馈有正向趋势：点踩数量明显减少，点赞略有增加。

关键验证方法：每天分析所有点踩案例，区分**工程问题**（网络波动、链路断裂）和**内容质量问题**。只有内容质量问题才纳入验证集重新跑分。这样保证了评估体系的针对性——不会因为工程bug导致分数虚低。

**深度延伸**:

```java
// Bad Case 分类管线
@Service
public class BadCaseAnalyzer {
    
    private final ChatClient classifier;
    
    public BadCaseCategory classify(ThumbDownCase badCase) {
        String prompt = """
            分析以下用户点踩案例，判断问题类型：
            - ENGINEERING: 网络波动、超时、链路断裂等工程问题
            - CONTENT: 回答不准确、不完整、格式错误等内容质量问题
            
            用户问题: %s
            Agent回答: %s
            错误信息: %s
            """.formatted(badCase.getQuery(), badCase.getResponse(), 
                         badCase.getErrorMessage());
        
        return classifier.prompt().user(prompt).call()
            .entity(BadCaseCategory.class);
    }
    
    // 每日定时分析
    @Scheduled(cron = "0 2 * * *")
    public void dailyBadCaseAnalysis() {
        List<ThumbDownCase> cases = fetchYesterdayThumbDowns();
        Map<BadCaseCategory, List<ThumbDownCase>> grouped = cases.stream()
            .collect(Collectors.groupingBy(this::classify));
        
        // 只有内容质量问题纳入验证集
        List<ThumbDownCase> contentIssues = grouped.get(BadCaseCategory.CONTENT);
        validationSetService.addToValidationSet(contentIssues);
        
        // 工程问题转给SRE团队
        List<ThumbDownCase> engIssues = grouped.get(BadCaseCategory.ENGINEERING);
        alertService.notifySRE(engIssues);
    }
}
```

**工程踩坑**:
- 工程问题和内容问题边界模糊：超时可能是工程问题，也可能是Agent循环过多导致，需要结合重试次数判断
- 验证集漂移：长期运行后验证集可能偏离真实分布，定期用新数据替换旧数据

---

## Q6. 会不会用用户的点踩数据去优化验证集和评估Prompt？

**考点**: 数据飞轮闭环设计

**参考答案**:

会的，整个闭环是：

1. **全链路记录**: 每个问题的规划、检索、摘要、生成结果都留了日志
2. **RCA（根因分析）**: 点踩的案例先看是工程问题还是内容问题，再定位是哪个环节出的问题
3. **反向优化**: 如果发现"模型打分很高但用户踩"，说明评估Prompt的维度或权重有偏差，调整评估Agent的Prompt
4. **回归测试**: 优化完后重新跑验证集，确认指标有改善

---

## Q7. 如果让你做AI Coding的质量评估，你会从哪些维度设计？

**考点**: AI Coding评估体系设计（重点题）

**参考答案**:

分两个层面设计：

### 工程层面（Pipeline质量）

| 维度 | 说明 |
|------|------|
| 检索覆盖率 | Agent是否找到了所有相关的代码文件和依赖 |
| 编译通过率 | 生成的代码能否编译通过 |
| 测试通过率 | Agent自动生成的测试用例是否通过 |
| Retry成功率 | 失败后自我修复的成功率和次数 |

### 代码层面（生成质量）

| 维度 | 说明 |
|------|------|
| 功能完整性 | 用户需求是否全部实现 |
| 边界Case覆盖 | 超时、并发、空输入等异常路径是否处理 |
| 代码规范性 | 是否遵循项目的lint规则、命名约定 |
| 安全性 | 是否有注入风险、敏感信息泄露 |

**评估方式**: 自动化（Lint + 编译 + 测试）为主，人工抽检为辅。同样需要 **LLM-as-Judge 打分 + 人工校准**的机制，确保自动化评估与工程师体感一致。

**深度延伸 — SWE-bench评估框架**:

```java
// AI Coding 质量评估管线
@Service
public class CodingQualityPipeline {
    
    private final BuildService buildService;
    private final TestRunner testRunner;
    private final LintService lintService;
    private final ChatClient judgeClient;
    
    public QualityReport evaluate(CodeGenerationResult result, String requirement) {
        QualityReport.QualityReportBuilder report = QualityReport.builder();
        
        // 1. 编译通过率
        BuildResult build = buildService.compile(result.getProjectPath());
        report.compilePassed(build.isSuccess());
        
        // 2. Lint检查
        LintResult lint = lintService.check(result.getProjectPath());
        report.lintScore(lint.getScore());
        
        // 3. 测试通过率
        TestResult test = testRunner.run(result.getProjectPath());
        report.testPassRate(test.getPassRate());
        
        // 4. LLM-as-Judge 评估代码质量
        String judgePrompt = """
            评估以下AI生成的代码：
            需求: %s
            代码: %s
            
            从以下维度打分(1-10):
            1. 功能完整性
            2. 边界Case处理
            3. 代码规范性
            4. 安全性
            """.formatted(requirement, result.getGeneratedCode());
        
        JudgeScore score = judgeClient.prompt().user(judgePrompt)
            .call().entity(JudgeScore.class);
        report.llmJudgeScore(score);
        
        return report.build();
    }
}
```

---

## Q8. 让AI生成技术方案时，需要给它哪些上下文？

**考点**: Prompt工程中的上下文设计

**参考答案**:

技术方案生成需要分三层上下文：

1. **代码上下文**: 目标文件、调用方、被调用方、相关依赖、项目规范文档
2. **业务上下文**: 需求描述、约束条件（性能要求、兼容性要求、上线时间窗口）
3. **历史上下文**: 已有的类似实现参考（避免重复造轮子）、技术债务信息

**关键 — 边界控制**: Agent不应该自作主张做需求以外的修改。做法是在Prompt中明确约束（"只修改X，不要动Y"），并且在生成的Plan阶段让人类Review确认后再执行。

**深度延伸 — 上下文窗口管理**:

```java
// 技术方案生成的上下文组装器
@Service
public class TechSpecContextAssembler {
    
    private final CodeIndexService codeIndex;  // 代码索引服务
    private final ProjectConfigService configService;
    
    public String assembleContext(TechSpecRequest request) {
        StringBuilder context = new StringBuilder();
        
        // Layer 1: 代码上下文
        List<CodeFile> relatedFiles = codeIndex.findRelatedFiles(
            request.getTargetModule(), 
            request.getDescription(),
            5  // top-5 相关文件
        );
        context.append("## 代码上下文\n");
        for (CodeFile file : relatedFiles) {
            context.append("### ").append(file.getPath()).append("\n");
            context.append(file.getContent()).append("\n\n");
        }
        
        // Layer 2: 业务上下文
        context.append("## 业务约束\n");
        context.append("- 性能要求: ").append(request.getPerfRequirement()).append("\n");
        context.append("- 兼容性: ").append(request.getCompatibility()).append("\n");
        context.append("- 上线窗口: ").append(request.getReleaseWindow()).append("\n\n");
        
        // Layer 3: 历史上下文
        List<SimilarImpl> refs = codeIndex.findSimilarImplementations(
            request.getDescription(), 3);
        context.append("## 历史参考实现\n");
        for (SimilarImpl ref : refs) {
            context.append("- ").append(ref.getDescription())
                   .append(" (").append(ref.getFilePath()).append(")\n");
        }
        
        // 边界约束
        context.append("\n## 约束\n");
        context.append("- 只修改 ").append(request.getScope()).append(" 相关代码\n");
        context.append("- 不要修改 ").append(request.getExcludedScope()).append("\n");
        
        return context.toString();
    }
}
```

---

## Q9. SSE 底层长连接机制是什么样的？

**考点**: SSE原理、与WebSocket区别

**参考答案**:

SSE（Server-Sent Events）基于HTTP协议，是服务端向客户端的单向流式推送。

- 客户端发起一个普通的HTTP GET请求，服务端保持连接不关闭，持续推送 `text/event-stream` 格式的数据
- 客户端用 `EventSource` API 监听，每条消息以 `\n\n` 分隔
- 支持 `Last-Event-ID` 实现断线重连时的消息续传
- 与服务端到模型的流式不同，SSE本身没有 `finish_reason` 概念，这是上层协议定义的
- **与WebSocket的区别**: SSE是单向的、基于HTTP、自动重连；WebSocket是双向的、独立协议

**深度延伸 — Spring WebFlux SSE实现**:

```java
@RestController
@RequestMapping("/api/agent")
public class AgentSseController {
    
    private final AgentService agentService;
    
    /**
     * SSE流式返回Agent执行结果
     * 关键点：
     * 1. 返回类型 Flux<ServerSentEvent> 实现SSE
     * 2. 每个event携带event type + data + id
     * 3. 客户端断线后可用Last-Event-ID续传
     */
    @GetMapping(value = "/execute/{taskId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<AgentChunk>> streamResult(@PathVariable String taskId,
                                                           @RequestHeader(value = "Last-Event-ID", 
                                                                          required = false) String lastEventId) {
        // 断线重连：从lastEventId之后继续推送
        long fromSeq = lastEventId != null ? Long.parseLong(lastEventId) + 1 : 0;
        
        return agentService.streamChunks(taskId, fromSeq)
            .map(chunk -> ServerSentEvent.<AgentChunk>builder()
                .id(String.valueOf(chunk.getSequence()))
                .event(chunk.getEventType()) // planning / tool_call / generate / done
                .data(chunk)
                .build())
            .onErrorResume(e -> Flux.just(
                ServerSentEvent.<AgentChunk>builder()
                    .event("error")
                    .data(new AgentChunk("error", e.getMessage()))
                    .build()
            ));
    }
}
```

**工程踩坑**:
- SSE连接超时：Nginx默认60s超时，需要配置 `proxy_read_timeout 300s`
- 跨域问题：EventSource不支持自定义Header，认证需要走Cookie或URL参数
- 浏览器并发限制：HTTP/1.1下同域最多6个SSE连接，HTTP/2无此限制

---

## Q10. 网络断了，前后端如何保证消息不丢？

**考点**: 断线恢复机制设计

**参考答案**:

断线恢复基于 **Task ID + Redis中间状态**：

1. 任务启动生成Task ID，每个环节（Planning、Retrieve、Summary、Generate）完成后，结果连同环节标记一起写入Redis
2. 流式生成过程中，已生成的Block也实时写入Redis
3. 前端断线重连时携带Task ID，服务端检测到已有任务：
   - 如果还在流式生成：把已生成的Block全量推送，并继续后续流式输出
   - 如果已完成：把所有结果一次性推送
   - Redis设置30分钟过期时间，过期后需要重新发起请求

**深度延伸 — 断线恢复实现**:

```java
@Service
public class AgentRecoveryService {
    
    private final RedisTemplate<String, Object> redisTemplate;
    private static final long TASK_TTL = Duration.ofMinutes(30).getSeconds();
    
    /**
     * 任务每个环节完成后持久化到Redis
     */
    public void persistStage(String taskId, AgentStage stage, Object result) {
        String key = "agent:task:" + taskId;
        
        // 原子更新：覆盖式写入同一TaskID的状态
        TaskState state = (TaskState) redisTemplate.opsForValue().get(key);
        if (state == null) {
            state = new TaskState(taskId, TaskStatus.RUNNING);
        }
        state.getStages().put(stage, result);
        state.setLastUpdated(Instant.now());
        
        redisTemplate.opsForValue().set(key, state, TASK_TTL, TimeUnit.SECONDS);
    }
    
    /**
     * 流式Block实时写入Redis
     */
    public void persistBlock(String taskId, int sequence, String content) {
        String key = "agent:blocks:" + taskId;
        redisTemplate.opsForHash().put(key, String.valueOf(sequence), content);
        redisTemplate.expire(key, TASK_TTL, TimeUnit.SECONDS);
    }
    
    /**
     * 断线重连恢复
     */
    public RecoveryResult recover(String taskId) {
        TaskState state = (TaskState) redisTemplate.opsForValue()
            .get("agent:task:" + taskId);
        
        if (state == null) {
            return RecoveryResult.expired(); // 30分钟已过，需重新发起
        }
        
        // 获取已生成的所有Block
        Map<Object, Object> blocks = redisTemplate.opsForHash()
            .entries("agent:blocks:" + taskId);
        
        if (state.getStatus() == TaskStatus.COMPLETED) {
            return RecoveryResult.completed(blocks); // 全量推送
        } else {
            return RecoveryResult.resuming(blocks); // 已有Block + 继续流式
        }
    }
}
```

---

## Q11. Redis 的数据一致性怎么保证？失效策略是什么？数据会不会过时？

**考点**: Redis缓存策略、数据一致性

**参考答案**:

Redis在这个场景里是中间状态的临时存储，最终结果持久化到MySQL。

**一致性保证**：

1. **过期策略**: 设置TTL（30分钟），超时自动清理，避免脏数据堆积
2. **原子性**: 同一TaskID的状态更新是覆盖式的，不会因为并发写入导致数据不一致
3. **最终一致性**: Redis是中间缓存，真正权威的是MySQL。如果Redis数据过期或丢失，从MySQL恢复最终结果
4. **防脏读**: 任务状态有明确标记（pending/running/completed/failed），只有completed状态的数据才会推给前端

**工程踩坑**:
- Redis和MySQL双写的一致性：先写MySQL再删Redis缓存（Cache Aside Pattern），而不是先删缓存再写DB
- 大Key问题：如果一个任务生成的Block很多，Redis Hash可能变成大Key，需要控制单个Hash的Field数量或分片

---

## Q12. 要做一个好用的AI Coding产品，核心瓶颈是什么？

**考点**: AI Coding产品战略思考

**参考答案**:

核心瓶颈按优先级（1+0比喻）：

1. **代码生成质量（那个1）**: 上下文理解是否到位、生成的代码能不能用、边界case有没有覆盖。这是基础，质量不过关其他都是0
2. **延迟（第一个0）**: Agent loop不能无限循环，需要设定超时和终止条件，否则用户体验差
3. **Token成本（第二个0）**: 合理设计缓存策略——System Prompt缓存、不变的代码片段用cache，减少重复调用成本
4. **扩展性/并发（进阶）**: 复杂任务拆成多Agent并行处理，但这建立在前面三个都做好的基础上

---

## Q13. 如何保证和提升AI生成代码的质量？

**考点**: 代码生成质量保障三阶段（重点题）

**参考答案**:

质量保障分三阶段：

### 生成前 — Plan阶段

- Agent先输出详细的执行Plan，人类Review确认后再执行
- Plan中明确每一步的输入输出、依赖关系、验证标准

### 生成中 — ReAct循环

- 每一步：思考 → 生成代码 → 验证（Lint + 编译）→ 如果失败把错误日志反馈给Agent → 重新生成
- 每个子步骤分开编译，确保局部正确性
- 设定最大retry次数（如3次），超过后降级为Suggestion模式

### 生成后 — 整体验证

- Lint + 运行测试用例
- 输出代码的同时附带Plan、diff links，方便人类Review

> 这样保证用户拿到的不是"看起来对"的代码，而是"编译通过、测试通过"的可运行代码。

**深度延伸 — ReAct循环实现**:

```java
@Service
public class ReactLoopExecutor {
    
    private static final int MAX_RETRY = 3;
    private final ChatClient codeAgent;
    private final BuildService buildService;
    private final LintService lintService;
    
    public CodeGenResult executeWithQualityGuard(CodeGenRequest request) {
        // Phase 1: 生成Plan
        Plan plan = generatePlan(request);
        if (!request.isAutoApprove()) {
            plan = humanReviewService.awaitApproval(plan); // 人类Review
        }
        
        // Phase 2: ReAct循环执行每个步骤
        for (PlanStep step : plan.getSteps()) {
            int retry = 0;
            boolean success = false;
            
            while (retry < MAX_RETRY && !success) {
                // 生成代码
                String code = codeAgent.prompt()
                    .system(STEP_PROMPT)
                    .user(step.toPrompt())
                    .call()
                    .content();
                
                // 验证：Lint + 编译
                LintResult lint = lintService.check(code);
                BuildResult build = buildService.compile(code);
                
                if (lint.isSuccess() && build.isSuccess()) {
                    step.setCode(code);
                    success = true;
                } else {
                    // 失败：把错误反馈给Agent重试
                    retry++;
                    step.setLastError(lint.getErrors() + "\n" + build.getErrors());
                    if (retry >= MAX_RETRY) {
                        // 降级为Suggestion模式
                        step.setMode(PlanStepMode.SUGGESTION);
                        step.setCode(code); // 不直接应用，只做建议
                    }
                }
            }
        }
        
        // Phase 3: 整体验证
        BuildResult finalBuild = buildService.compileFull(request.getProjectPath());
        TestResult testResult = testRunner.runAll(request.getProjectPath());
        
        return CodeGenResult.builder()
            .plan(plan)
            .compilePassed(finalBuild.isSuccess())
            .testPassed(testResult.isAllPassed())
            .diffLinks(generateDiffLinks(plan))
            .build();
    }
}
```

---

## Q14. 编程题：最长回文子串

**考点**: 字符串算法、中心扩展法

**表现**: 完成。中心扩展法（奇数/偶数分别处理），思路正确。

**参考答案 — Java实现**:

```java
public class LongestPalindrome {
    
    /**
     * 中心扩展法
     * 思路：
     * 1. 遍历字符串，以每个字符为中心向外扩展
     * 2. 处理两种情况：
     *    - 奇数长度回文：中心是单个字符，初始 left = i-1, right = i+1
     *    - 偶数长度回文：中心是两个相同字符，初始 left = i, right = i+1
     * 3. 每次扩展时 left-- 和 right++，如果 s[left] == s[right] 则更新最长回文
     * 4. 边界条件：left >= 0 且 right < n
     * 
     * 时间复杂度 O(n²)，空间复杂度 O(1)
     * 更优解法：Manacher算法 O(n)，但面试中中心扩展法通常足够
     */
    public String longestPalindrome(String s) {
        if (s == null || s.length() < 2) return s;
        
        int start = 0, maxLen = 1;
        
        for (int i = 0; i < s.length(); i++) {
            // 奇数长度回文
            int len1 = expandAroundCenter(s, i - 1, i + 1);
            // 偶数长度回文
            int len2 = expandAroundCenter(s, i, i + 1);
            
            int len = Math.max(len1, len2);
            if (len > maxLen) {
                maxLen = len;
                // 计算起始位置：奇数时中心是i，偶数时中心偏左是i
                start = i - (len - 1) / 2;
            }
        }
        
        return s.substring(start, start + maxLen);
    }
    
    private int expandAroundCenter(String s, int left, int right) {
        while (left >= 0 && right < s.length() && s.charAt(left) == s.charAt(right)) {
            left--;
            right++;
        }
        return right - left - 1; // 回文长度
    }
    
    // Manacher算法 O(n) — 面试加分项
    public String longestPalindromeManacher(String s) {
        // 预处理：插入#统一奇偶，如 "abc" -> "^#a#b#c#$"
        StringBuilder sb = new StringBuilder("^#");
        for (char c : s.toCharArray()) {
            sb.append(c).append('#');
        }
        sb.append('$');
        String t = sb.toString();
        
        int n = t.length();
        int[] p = new int[n]; // p[i] = 以i为中心的回文半径
        int center = 0, right = 0;
        
        for (int i = 1; i < n - 1; i++) {
            int mirror = 2 * center - i;
            if (i < right) {
                p[i] = Math.min(right - i, p[mirror]);
            }
            while (t.charAt(i + p[i] + 1) == t.charAt(i - p[i] - 1)) {
                p[i]++;
            }
            if (i + p[i] > right) {
                center = i;
                right = i + p[i];
            }
        }
        
        int maxLen = 0, centerIndex = 0;
        for (int i = 1; i < n - 1; i++) {
            if (p[i] > maxLen) {
                maxLen = p[i];
                centerIndex = i;
            }
        }
        
        int start = (centerIndex - maxLen) / 2;
        return s.substring(start, start + maxLen);
    }
}
```

---

## 面试考点总结

| 类别 | 题目 | 核心考点 |
|------|------|---------|
| 项目深挖 | Q2-Q6 | Agent封装、企业级部署、评估体系、数据飞轮 |
| 系统设计 | Q7-Q8 | 质量评估维度、上下文工程 |
| 基础原理 | Q9-Q11 | SSE机制、断线恢复、Redis一致性 |
| 产品思考 | Q12-Q13 | 瓶颈优先级、质量保障三阶段 |
| 编程题 | Q14 | 最长回文子串 |

**核心考察方向**: 字节AI Coding Agent岗重点关注——
1. **Agent工程化能力**：能否把Agent从demo做到生产级
2. **质量评估思维**：对评估体系的设计思路是否成熟
3. **系统设计能力**：SSE、Redis等基础设施的理解深度
4. **代码能力**：每轮必考编程题
