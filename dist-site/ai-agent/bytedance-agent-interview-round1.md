# 字节跳动 Agent开发一面面经（深度版）

> **来源**: [小红书](http://xhslink.com/o/36LqhXIfcn8)
> **发布日期**: 2026-05
> **标签**: `字节跳动` `Agent开发` `一面` `MCP` `Skill` `Claude Code` `工具协议`
> **考点分类**: Agent系统工程化 / 工具协议 / 记忆架构 / 代码检索 / 系统设计

---

## 面试结构

- **Agent工程化理解**（Q1-Q7）：开发流程、模型与Agent边界、工具分工、MCP与Skill关系、记忆架构、代码检索策略
- **手撕设计题**（Q8）：Skill系统设计（注册→发现→调用完整链路）

---

## Q1: Agent开发流程为什么这样设计？有没有借鉴现有产品？

**答题思路**：不要只说"先调研再开发"，要讲清楚流程的工程合理性——为什么每一步存在、去掉会怎样、借鉴了哪些成熟产品。

**深度解答**：

Agent开发流程通常分为：需求定义 → 工具设计 → Prompt工程 → 测试评估 → 迭代优化。这个流程不是凭空设计的，核心借鉴了三个产品：

1. **Claude Code**：Claude的Agent流程是"理解意图→选择工具→执行→观察→调整"，这本质上是ReAct范式的工程化。借鉴点在于它的**工具注册机制**——每个工具都有明确的schema描述，模型通过工具描述来决策调用。
2. **AutoGPT**：早期AutoGPT的失败教训很重要——纯自主Agent容易陷入死循环。这启发了现代Agent流程中加入**人工审批节点**（Human-in-the-loop）。
3. **LangChain的LCEL**：LangChain Expression Language把Agent流程抽象为可组合的Runnable链，借鉴点是**声明式编排**优于命令式编排。

关键设计原则：
- **工具先行**：先定义工具能力边界，再写Prompt，避免模型"幻觉调用"不存在的工具
- **评估驱动**：每个迭代都要有量化指标（工具调用成功率、任务完成率），不做"感觉更好了"的优化
- **渐进自主**：从Human-in-the-loop开始，逐步放开自主度，而不是一开始就让Agent全自主

```java
// Spring AI: Agent开发流程的工程化实现
@Component
public class AgentDevelopmentWorkflow {

    private final ChatClient chatClient;
    private final List<ToolCallback> registeredTools;
    private final AgentEvaluator evaluator;

    // 阶段1: 工具注册——先定义能力边界
    public ToolRegistry designTools(AgentRequirement requirement) {
        ToolRegistry registry = new ToolRegistry();
        for (String capability : requirement.getCapabilities()) {
            // 每个工具必须有明确的schema，模型据此决策
            ToolCallback tool = ToolCallback.builder()
                .name(capability)
                .description(requirement.getToolDescription(capability))
                .inputSchema(requirement.getToolSchema(capability))
                .requiresApproval(requireability.needsHumanApproval(capability))
                .build();
            registry.register(tool);
        }
        return registry;
    }

    // 阶段2: Prompt工程——基于工具能力设计
    public PromptTemplate designPrompt(ToolRegistry registry, AgentRequirement req) {
        return PromptTemplate.builder()
            .system(req.getSystemPrompt())
            .tools(registry.getToolDescriptions()) // 注入工具描述
            .strategy(ReActStrategy.INSTANCE)       // ReAct推理策略
            .maxIterations(req.getMaxIterations())   // 防死循环
            .build();
    }

    // 阶段3: 评估——量化指标驱动迭代
    public EvaluationResult evaluate(Agent agent, List<TestCase> cases) {
        double toolCallAccuracy = cases.stream()
            .mapToDouble(c -> agent.execute(c.getInput()).isToolCallCorrect() ? 1.0 : 0.0)
            .average().orElse(0);
        double taskCompletionRate = cases.stream()
            .mapToDouble(c -> agent.execute(c.getInput()).isTaskCompleted() ? 1.0 : 0.0)
            .average().orElse(0);
        return new EvaluationResult(toolCallAccuracy, taskCompletionRate);
    }
}
```

**工程踩坑点**：
- 很多团队先写Prompt再设计工具，导致模型频繁"幻觉调用"——工具描述缺失时模型会自己编造参数
- 评估指标不要只看"答案正确率"，要加上"工具调用链路正确率"——Agent可能绕了10步才到正确答案
- Human-in-the-loop不是永远加，要设定graduation threshold：当Agent在审批节点的通过率>95%时，自动放开

---

## Q2: 模型和Agent的边界是什么？

**答题思路**：这道题考的是你对Agent本质的理解——不是所有用LLM的场景都是Agent。边界在"自主决策+工具使用+循环迭代"。

**深度解答**：

| 维度 | 模型（LLM） | Agent |
|------|------------|-------|
| 执行模式 | 单次推理，请求-响应 | 循环推理，观察-行动-反思 |
| 工具使用 | 无/Function Call但无自主选择 | 自主选择工具、组合调用、处理异常 |
| 状态管理 | 无状态 | 有状态（记忆、上下文、历史） |
| 错误处理 | 返回错误结果 | 检测错误→调整策略→重试 |
| 目标达成 | 生成文本 | 完成任务 |

核心判断标准：**有没有自主决策循环**。

- ChatGPT问答 = 模型（单次推理，无循环）
- ChatGPT + Function Call = 半Agent（有工具但无自主循环，用户每次触发一次）
- Claude Code = 完整Agent（自主选择工具→执行→观察结果→决定下一步，循环直到任务完成）

```java
// LangChain4j: 模型 vs Agent 的代码边界
// 模型：单次推理
public class ModelOnly {
    private final ChatLanguageModel model;

    public String ask(String question) {
        return model.generate(question); // 单次，无循环
    }
}

// Agent：自主决策循环
public class FullAgent {
    private final ChatLanguageModel model;
    private final List<ToolProvider> tools;
    private final AgentMemory memory;

    public String execute(String task) {
        String observation = task;
        for (int i = 0; i < MAX_ITERATIONS; i++) {
            // 1. 思考：基于当前观察+记忆，决定下一步
            AgentAction action = model.decide(observation, memory, tools);

            if (action.isFinish()) {
                return action.getFinalAnswer();
            }

            // 2. 行动：执行工具调用
            ToolResult result = executeTool(action.getToolName(), action.getToolInput());

            // 3. 观察：更新记忆，进入下一轮
            memory.add(new Step(i, action, result));
            observation = result.getOutput();
        }
        throw new AgentMaxIterationException();
    }
}
```

**工程踩坑点**：
- 很多产品把"带Function Call的聊天"叫Agent，但本质还是模型——因为没有自主循环，用户每次手动触发
- 真正的Agent需要有**终止条件**——最大迭代次数、目标达成检测、异常中断，否则会无限循环
- Agent的"自主"不等于"无约束"——需要在Prompt中明确约束（不要做什么）和在代码中硬编码安全边界（禁止调用的工具、最大成本限制）

---

## Q3: 本地工具、MCP Tools、Skill 三者怎么分工？

**答题思路**：三层工具体系，各有定位——本地工具是基础能力，MCP是跨进程协议，Skill是面向业务的高层抽象。

**深度解答**：

```
┌─────────────────────────────────────────┐
│  Skill Layer（业务层）                    │
│  - 面向用户/开发者的高层能力描述           │
│  - YAML定义 + 代码实现                    │
│  - 例："代码审查"、"数据库迁移"            │
├─────────────────────────────────────────┤
│  MCP Tools Layer（协议层）                │
│  - 跨进程的标准工具调用协议                │
│  - JSON-RPC 2.0，stdio/SSE传输           │
│  - 例：filesystem.read_file, github.*    │
├─────────────────────────────────────────┤
│  Local Tools Layer（基础层）              │
│  - 进程内的原生工具                       │
│  - 最快、最直接、无网络开销               │
│  - 例：grep, shell, file_read/write      │
└─────────────────────────────────────────┘
```

| 维度 | 本地工具 | MCP Tools | Skill |
|------|---------|-----------|-------|
| 进程位置 | 同进程 | 跨进程（独立Server） | 跨层（可调本地+MCP） |
| 通信方式 | 直接函数调用 | JSON-RPC over stdio/SSE | YAML描述 + 脚本/代码执行 |
| 定义方式 | 代码注册 | MCP Server声明 | YAML frontmatter + 实现 |
| 典型场景 | 文件读写、Shell执行 | GitHub API、数据库查询 | "部署服务"、"代码审查" |
| 延迟 | 最低 | 有IPC开销 | 取决于底层工具 |
| 安全性 | 进程级 | 需认证/鉴权 | 可定义权限约束 |

核心分工逻辑：
- **本地工具**：高频、低延迟、无外部依赖——grep搜索、文件操作、Shell命令
- **MCP Tools**：需要外部服务、跨Agent共享、需要独立生命周期管理——数据库、API、第三方服务
- **Skill**：多个工具的组合编排 + 业务知识——一个Skill可能调用3个本地工具 + 2个MCP工具

```java
// Spring AI: 三层工具体系的实现
@Configuration
public class ToolArchitecture {

    // 1. 本地工具：同进程，直接注册
    @Bean
    public ToolCallback localGrepTool() {
        return ToolCallback.builder()
            .name("grep_search")
            .description("搜索文件内容，比RAG更适合精确模式匹配")
            .inputType(GrepRequest.class)
            .execute(req -> {
                // 直接调用本地grep，无IPC开销
                Process p = Runtime.getRuntime().exec(
                    new String[]{"grep", "-rn", req.pattern(), req.path()});
                return new String(p.getInputStream().readAllBytes());
            })
            .build();
    }

    // 2. MCP Tools：跨进程，通过MCP协议调用
    @Bean
    public McpClient mcpGithubTool() {
        return McpClient.builder()
            .transport(new StdioTransport("github-mcp-server"))
            .build();
        // 工具列表由MCP Server声明，客户端自动发现
    }

    // 3. Skill：业务编排，组合本地+MCP工具
    public class CodeReviewSkill {
        private final ToolCallback grep;      // 本地
        private final McpClient github;       // MCP
        private final ChatClient llm;

        @SkillDef(
            name = "code_review",
            desc = "审查PR代码变更，检查安全漏洞和代码质量",
            tools = {"grep_search", "github.pr_diff", "github.pr_comments"}
        )
        public String execute(String prUrl) {
            // Step 1: 用MCP获取PR diff
            String diff = github.callTool("pr_diff", Map.of("url", prUrl));
            // Step 2: 用本地grep检查相关上下文
            String context = grep.execute(new GrepRequest(diff.getChangedFiles()));
            // Step 3: LLM分析
            return llm.prompt("审查以下代码变更...").call();
        }
    }
}
```

**工程踩坑点**：
- 不要把所有工具都做成MCP——本地能解决的不走MCP，IPC开销在热路径上会累积
- Skill和MCP的边界容易混淆——判断标准：如果需要"组合多个工具+业务逻辑"，做Skill；如果只是单一原子能力，做MCP Tool
- MCP Server的生命周期管理是坑——用stdio模式时Server随Agent启停，用SSE模式时需要独立运维

---

## Q4: 为什么有了MCP还要做Skill？

**答题思路**：MCP解决的是"工具怎么调用"，Skill解决的是"工具怎么组合使用"。不在一个抽象层次。

**深度解答**：

MCP和Skill的关系，类似"HTTP API"和"业务流程编排"的关系：

- **MCP = 原子能力**：`read_file`、`search_code`、`create_issue`——每个做一件事
- **Skill = 业务流程**：`代码审查` = read_diff + search_pattern + analyze + create_comment——多个原子能力的编排

为什么不能只有MCP：
1. **组合爆炸**：一个复杂任务可能需要调用5-10个MCP工具，让模型自己编排，出错率极高
2. **领域知识**：Skill封装了"怎么做"的经验——比如代码审查要先看diff，再grep上下文，最后看历史提交——这些知识放在Prompt里不如固化在Skill里
3. **可复用性**：MCP工具是通用的，Skill是面向场景的。同一个`read_file` MCP工具，在"部署"Skill和"审查"Skill中用法完全不同
4. **可靠性**：Skill可以预定义执行流程，减少模型决策步数→减少出错概率

```java
// LangChain4j: Skill vs MCP的关系
// MCP: 原子工具，只管"怎么做一件事"
@McpServer(name = "filesystem")
public class FileSystemMcpServer {
    @Tool(description = "读取文件内容")
    public String readFile(String path) { /* ... */ }

    @Tool(description = "搜索文件内容")
    public List<SearchResult> grep(String pattern, String path) { /* ... */ }
}

// Skill: 业务编排，管"怎么组合工具完成一个任务"
@Skill(
    name = "safe_refactor",
    description = "安全重构：搜索→分析→修改→验证",
    requires = {"filesystem.read_file", "filesystem.grep", "shell.execute"}
)
public class SafeRefactorSkill {

    // 固化的业务流程——不靠模型自己编排
    public RefactorResult execute(RefactorRequest req) {
        // Step 1: grep找到所有引用点（模型可能遗漏）
        var references = grepTool.execute(req.getSymbol(), req.getProjectPath());

        // Step 2: 分析每个引用的上下文
        var analysis = references.stream()
            .map(ref -> readFileTool.execute(ref.getFilePath()))
            .map(content -> llm.analyze(content, req.getRefactorRule()))
            .toList();

        // Step 3: 执行修改
        var modifications = analysis.stream()
            .filter(Analysis::isSafe)
            .map(this::applyModification)
            .toList();

        // Step 4: 验证（跑测试）
        var testResult = shellTool.execute("mvn test");

        return new RefactorResult(modifications, testResult);
    }
}
```

**工程踩坑点**：
- 新手常见错误：把Skill做成"大号MCP工具"——一个Skill只调一个MCP，这没有价值
- Skill的粒度：太细（一个Skill只做一步）= 没有编排价值；太粗（一个Skill做10步）= 失去灵活性。3-7步是合理区间
- Skill的描述（YAML里的description）非常关键——模型根据描述决定是否调用，描述不好会导致错误调用

---

## Q5: Claude Code 的记忆架构是什么？

**答题思路**：Claude Code有三层记忆——会话内上下文、CLAUDE.md项目记忆、跨会话持久化。这是面试高频题，要讲清层次和工程取舍。

**深度解答**：

Claude Code的记忆架构分为三层：

| 层次 | 机制 | 生命周期 | 容量 | 用途 |
|------|------|---------|------|------|
| L1: 会话上下文 | 对话历史（滑动窗口） | 单次会话 | ~200K tokens | 当前任务的完整上下文 |
| L2: 项目记忆 | CLAUDE.md文件 | 跨会话（项目级） | 几KB | 项目约定、编码规范、架构决策 |
| L3: 持久记忆 | ~/.claude/记忆文件 | 跨会话（全局） | 几KB | 用户偏好、通用经验 |

**L1 会话上下文**：
- 就是普通的对话历史，模型能"看到"本次会话的所有对话
- 问题是上下文窗口有限，长对话会被截断
- Claude Code的优化：关键信息（如错误信息、重要决策）会被"重提"而非依赖窗口滚动

**L2 CLAUDE.md（核心创新）**：
- 放在项目根目录的markdown文件，每次会话自动加载
- 记录：项目架构、编码规范、常见错误、已知限制
- 本质是把"项目wiki"变成"模型可读的上下文"
- 比RAG更可靠——不用检索，直接注入系统Prompt

**L3 全局记忆**：
- `~/.claude/` 目录下的文件，记录跨项目的通用知识
- 比如"用户偏好用TypeScript"、"测试用vitest不用jest"

```java
// Spring AI: 仿Claude Code的三层记忆架构
public class ClaudeCodeMemoryArchitecture {

    // L1: 会话上下文——ChatMemory实现滑动窗口
    @Bean
    public ChatMemory sessionMemory() {
        return WindowChatMemory.builder()
            .maxMessages(50)  // 保留最近50轮对话
            .build();
    }

    // L2: 项目记忆——类似CLAUDE.md
    public static class ProjectMemory {
        private final Path claudeMdPath;  // 项目根目录的CLAUDE.md

        public String load() {
            if (Files.exists(claudeMdPath)) {
                return Files.readString(claudeMdPath);
            }
            return "";
        }

        // Agent完成任务后，可以自主更新CLAUDE.md
        public void append(String knowledge) {
            String current = load();
            String updated = current + "\n## " + LocalDate.now() + "\n" + knowledge;
            Files.writeString(claudeMdPath, updated);
        }
    }

    // L3: 全局记忆——跨项目持久化
    public static class GlobalMemory {
        private final Path memoryDir = Path.of(System.getProperty("user.home"), ".agent", "memory");

        public void save(String key, String value) {
            Files.writeString(memoryDir.resolve(key + ".md"), value);
        }

        public Map<String, String> loadAll() {
            return Files.list(memoryDir)
                .filter(p -> p.toString().endsWith(".md"))
                .collect(Collectors.toMap(
                    p -> p.getFileName().toString().replace(".md", ""),
                    p -> Files.readString(p)
                ));
        }
    }

    // 组合三层记忆注入到Prompt
    public Prompt buildPrompt(String userMessage) {
        return Prompt.builder()
            .system(globalMemory.loadAll().values())  // L3
            .system(projectMemory.load())              // L2
            .messages(sessionMemory.getMessages())     // L1
            .user(userMessage)
            .build();
    }
}
```

**工程踩坑点**：
- CLAUDE.md不是越大越好——内容太多会挤占有效上下文，3-5KB最佳，超过10KB就要考虑精简
- L1的滑动窗口截断是静默的——模型不会告诉你"我忘了前面的对话"，关键信息要在L2/L3备份
- L2的自动更新很危险——如果Agent写了错误的CLAUDE.md，后续所有会话都会受影响。建议加人工审核

---

## Q6: 为什么代码检索很多时候更适合 grep 而不是直接上 RAG？

**答题思路**：这是反直觉题——大家都以为RAG更先进，但代码场景grep往往更好。考的是对两种技术适用场景的深度理解。

**深度解答**：

| 维度 | grep | RAG |
|------|------|-----|
| 精确匹配 | ✅ 完美（正则表达式） | ❌ 语义匹配，精确度差 |
| 速度 | ✅ 毫秒级 | ❌ 向量检索+重排序，秒级 |
| 符号查找 | ✅ `grep -rn "class UserService"` | ❌ "找到UserService"可能返回无关类 |
| 语义搜索 | ❌ 找不到"用户认证相关代码" | ✅ 自然语言→相关代码 |
| 上下文理解 | ❌ 只看匹配行 | ✅ 返回相关代码片段 |
| 基础设施 | ✅ 无需额外部署 | ❌ 需要Embedding模型+向量库 |

**为什么代码场景grep更合适**：

1. **代码是结构化文本**：变量名、函数名、类名都是精确标识符，grep精确匹配比语义搜索更准
2. **代码检索的需求大多是精确的**：`"这个函数在哪里定义的？" "谁调用了这个方法？"`——这些是精确查找，不是语义搜索
3. **RAG的chunking对代码破坏性大**：把一个函数切成两半，Embedding就失去了语义完整性
4. **速度差异巨大**：grep在百万行代码库中搜索<100ms，RAG需要先Embedding再检索>1s

**什么时候用RAG**：
- "这个功能是怎么实现的？"——需要理解多个文件的关联
- "有没有类似的实现可以参考？"——语义相似度搜索
- "这段代码在做什么？"——代码理解

```java
// LangChain4j: 混合检索策略——grep优先，RAG补充
@Component
public class HybridCodeSearch {

    private final GrepSearcher grepSearcher;   // 本地grep
    private final EmbeddingStore<TextSegment> ragStore;  // 向量库
    private final EmbeddingModel embeddingModel;

    public List<SearchResult> search(String query) {
        // 策略1: 如果query包含精确标识符，优先grep
        if (isIdentifierQuery(query)) {
            String identifier = extractIdentifier(query);
            var grepResults = grepSearcher.search(identifier);
            if (!grepResults.isEmpty()) {
                return grepResults;  // grep找到就直接返回，不走RAG
            }
        }

        // 策略2: 语义查询走RAG
        var embedding = embeddingModel.embed(query).content();
        var ragResults = ragStore.findRelevant(embedding, 5);

        // 策略3: 结果合并+去重
        return merge(grepResults, ragResults);
    }

    private boolean isIdentifierQuery(String query) {
        // 包含驼峰/下划线命名 → 大概率是精确标识符查找
        return query.matches(".*[a-z][A-Z][a-z].*")  // 驼峰
            || query.matches(".*_[a-z].*")             // 下划线
            || query.matches(".*\\b(class|def|func|interface)\\b.*"); // 定义关键词
    }
}
```

**工程踩坑点**：
- 不要在代码检索场景全量上RAG——先分析查询模式，80%的代码查询是精确查找，grep足够
- RAG的chunking策略对代码很关键——按函数/类切分，不要按固定token数切分
- grep的局限：跨文件追踪调用链（call graph）时，需要组合grep + AST解析，不能只靠grep

---

## Q7: 这些问题本质上在考什么？（面试官视角分析）

**答题思路**：这是总结性题目，展示你对Agent系统工程化的全局理解。

**深度解答**：

这7道题表面分散，本质考的是**三个维度的工程化能力**：

**维度1：架构抽象能力**
- Q1(开发流程) + Q2(模型vs Agent) = 你能不能区分"什么是模型能力，什么是工程能力"？
- 陷阱：很多人把Prompt Engineering当成Agent的全部，但Agent的核心是**工程架构**——工具系统、记忆系统、错误恢复、安全边界

**维度2：协议与分层设计**
- Q3(三层工具) + Q4(MCP vs Skill) = 你能不能做合理的抽象分层？
- 陷阱：过度设计（所有工具都走MCP）或欠设计（全放本地），考的是分层判断力

**维度3：务实决策**
- Q5(记忆架构) + Q6(grep vs RAG) = 你能不能在"先进技术"和"实用方案"之间做正确取舍？
- 陷阱：技术选型不是越新越好，考的是对场景的判断力

总结：Agent开发不是"写Prompt + 调API"，而是**系统工程**——架构、协议、取舍，这三道题考的全是工程化。

---

## Q8: 手撕题——设计一个Skill系统，完成注册、发现和调用

**答题思路**：这不是算法题，是系统设计+实现题。要把目录扫描、YAML解析、元数据注册、脚本执行、错误处理和边界条件讲完整。

**深度解答**：

完整设计思路：

```
skills/
├── code-review/
│   ├── SKILL.md          # YAML frontmatter + 描述
│   └── execute.sh        # 实现脚本
├── deploy/
│   ├── SKILL.md
│   └── execute.py
└── safe-refactor/
    ├── SKILL.md
    └── execute.java
```

SKILL.md格式：
```yaml
---
name: code-review
description: 审查PR代码变更，检查安全漏洞和代码质量
tools:
  - filesystem.read_file
  - github.pr_diff
  - github.pr_comments
parameters:
  - name: pr_url
    type: string
    required: true
    description: PR的URL
  - name: check_security
    type: boolean
    default: true
---
```

```java
// 完整的Skill系统实现
public class SkillSystem {

    private final Path skillsRoot;          // skills/目录
    private final Map<String, SkillMeta> registry;  // 注册表
    private final ToolResolver toolResolver;        // 工具解析器

    // ========== 1. 注册：目录扫描 + YAML解析 ==========
    public void registerAll() {
        try (Stream<Path> dirs = Files.list(skillsRoot)) {
            dirs.filter(Files::isDirectory)
                .filter(dir -> Files.exists(dir.resolve("SKILL.md")))
                .forEach(this::registerSkill);
        }
    }

    private void registerSkill(Path skillDir) {
        Path skillMd = skillDir.resolve("SKILL.md");

        // 解析YAML frontmatter
        SkillMeta meta = parseFrontmatter(skillMd);

        // 验证工具依赖是否满足
        for (String tool : meta.getRequiredTools()) {
            if (!toolResolver.isAvailable(tool)) {
                throw new SkillRegistrationException(
                    meta.getName(), "缺少工具: " + tool);
            }
        }

        // 验证执行脚本存在
        Path script = findExecutable(skillDir, meta);
        if (script == null) {
            throw new SkillRegistrationException(
                meta.getName(), "未找到执行脚本");
        }
        meta.setScriptPath(script);

        // 注册到内存
        registry.put(meta.getName(), meta);
    }

    private SkillMeta parseFrontmatter(Path mdFile) {
        String content = Files.readString(mdFile);
        // 提取 --- 之间的YAML
        Matcher m = Pattern.compile("---\\n([\\s\\S]*?)\\n---")
            .matcher(content);
        if (!m.find()) throw new IllegalArgumentException("无YAML frontmatter");

        Yaml yaml = new Yaml();
        Map<String, Object> data = yaml.load(m.group(1));

        return SkillMeta.builder()
            .name((String) data.get("name"))
            .description((String) data.get("description"))
            .requiredTools((List<String>) data.getOrDefault("tools", List.of()))
            .parameters(parseParameters((List<Map>) data.get("parameters")))
            .build();
    }

    // ========== 2. 发现：按描述/标签匹配 ==========
    public List<SkillMeta> discover(String query) {
        return registry.values().stream()
            .filter(meta -> matchesQuery(meta, query))
            .sorted(Comparator.comparingDouble(
                meta -> relevanceScore(meta, query)).reversed())
            .toList();
    }

    private boolean matchesQuery(SkillMeta meta, String query) {
        String q = query.toLowerCase();
        return meta.getDescription().toLowerCase().contains(q)
            || meta.getName().toLowerCase().contains(q)
            || meta.getRequiredTools().stream()
                .anyMatch(t -> t.toLowerCase().contains(q));
    }

    // ========== 3. 调用：参数校验 + 脚本执行 + 错误处理 ==========
    public SkillResult execute(String skillName, Map<String, Object> params) {
        // 3.1 发现
        SkillMeta meta = registry.get(skillName);
        if (meta == null) {
            // 模糊匹配尝试
            var candidates = discover(skillName);
            if (candidates.isEmpty()) {
                throw new SkillNotFoundException(skillName);
            }
            meta = candidates.get(0);
        }

        // 3.2 参数校验
        validateParams(meta, params);

        // 3.3 工具依赖检查
        for (String tool : meta.getRequiredTools()) {
            if (!toolResolver.isAvailable(tool)) {
                throw new ToolUnavailableException(tool);
            }
        }

        // 3.4 执行脚本
        try {
            ProcessBuilder pb = new ProcessBuilder(
                resolveInterpreter(meta.getScriptPath()),
                meta.getScriptPath().toString());
            pb.environment().putAll(flattenParams(params));
            pb.redirectErrorStream(true);

            Process p = pb.start();
            String output = new String(p.getInputStream().readAllBytes());

            // 3.5 边界条件处理
            boolean timedOut = !p.waitFor(30, TimeUnit.SECONDS);
            if (timedOut) {
                p.destroyForcibly();
                return SkillResult.timeout(skillName, "执行超时30s");
            }

            int exitCode = p.exitValue();
            if (exitCode != 0) {
                return SkillResult.error(skillName,
                    "脚本退出码=" + exitCode + ", output=" + output);
            }

            return SkillResult.success(skillName, output);

        } catch (IOException | InterruptedException e) {
            return SkillResult.error(skillName, e.getMessage());
        }
    }

    // 边界条件：超时、权限、依赖缺失
    private String resolveInterpreter(Path script) {
        String name = script.getFileName().toString();
        return switch (name.substring(name.lastIndexOf('.'))) {
            case ".sh" -> "/bin/bash";
            case ".py" -> "python3";
            case ".java" -> "java";
            default -> throw new UnsupportedScriptException(name);
        };
    }
}

// 元数据类
@Data @Builder
class SkillMeta {
    private String name;
    private String description;
    private List<String> requiredTools;
    private List<SkillParameter> parameters;
    private Path scriptPath;
}

// 结果类
class SkillResult {
    private final String skillName;
    private final boolean success;
    private final String output;
    private final String error;
    private final Duration duration;

    static SkillResult success(String name, String output) { /* ... */ }
    static SkillResult error(String name, String error) { /* ... */ }
    static SkillResult timeout(String name, String msg) { /* ... */ }
}
```

**面试时手撕的精简版**（10分钟写完）：

```java
public class SimpleSkillSystem {
    Map<String, Skill> registry = new HashMap<>();

    // 注册
    void register(Path skillDir) {
        String yaml = Files.readString(skillDir.resolve("SKILL.md"));
        Skill skill = parseYaml(yaml);
        skill.script = findScript(skillDir);
        registry.put(skill.name, skill);
    }

    // 发现
    List<Skill> discover(String query) {
        return registry.values().stream()
            .filter(s -> s.description.contains(query) || s.name.contains(query))
            .toList();
    }

    // 调用
    String execute(String name, Map<String,String> params) {
        Skill skill = registry.get(name);
        Process p = new ProcessBuilder(skill.script.toString()).start();
        params.forEach((k,v) -> p.environment().put("SKILL_"+k, v));
        p.waitFor(30, TimeUnit.SECONDS);
        return new String(p.getInputStream().readAllBytes());
    }
}
```

**工程踩坑点**：
- 注册时要校验工具依赖——运行时才发现工具不可用，用户体验很差
- 发现不能只做字符串匹配——生产环境需要embedding语义匹配，但面试手撕用字符串匹配就行
- 执行必须有超时——Skill脚本可能有bug导致无限循环
- 错误处理要区分：Skill未找到 / 工具不可用 / 脚本报错 / 超时——不同错误给用户不同提示

---

## 总结：一面考察的核心能力

| 能力维度 | 对应题目 | 关键词 |
|---------|---------|--------|
| 架构抽象 | Q1, Q2 | 流程设计、模型vs Agent边界、ReAct |
| 分层设计 | Q3, Q4 | 本地/MCP/Skill分层、MCP vs Skill取舍 |
| 务实决策 | Q5, Q6 | 记忆架构、grep vs RAG、技术选型判断 |
| 代码实现 | Q8 | Skill系统全链路设计、YAML解析、进程管理 |

**一句话总结**：这面考的是你能不能在"业务逻辑、系统设计、工具协议和代码实现"之间切换自如——纯理论会吃亏，纯代码会缺深度，要两者兼备。
