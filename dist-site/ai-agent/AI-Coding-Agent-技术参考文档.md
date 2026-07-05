# AI Coding Agent 技术参考文档

> **核心命题**: `Model + Harness = Agent`
> 
> DeepSeek 正在组建 Harness 团队打造对标 Claude Code 的产品。
> 模型只是底座，真正让 AI 进入工作流的，是模型外面的那套系统。
> 
> 以下从**架构设计、核心组件、关键技术、工程挑战、面试考点**五个维度，
> 整理参与 AI Coding Agent 开发所需的技术知识体系。

---

## 一、架构总览

### 1.1 Agent 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                   用户交互层                              │
│   Terminal CLI  ·  IDE Plugin  ·  Web UI  ·  API        │
├─────────────────────────────────────────────────────────┤
│                   编排调度层                              │
│   任务规划 · 工具选择 · 上下文管理 · 执行引擎             │
├─────────────────────────────────────────────────────────┤
│                   能力层（Tool System）                    │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│   │文件  │ │命令  │ │搜索  │ │Git   │ │浏览器│ ...      │
│   │操作  │ │执行  │ │代码  │ │操作  │ │      │        │
│   └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │
├─────────────────────────────────────────────────────────┤
│                   基础设施层                              │
│   沙箱隔离 · 会话管理 · 持久化 · 评测体系 · 监控         │
├─────────────────────────────────────────────────────────┤
│                   模型层                                  │
│   LLM（DeepSeek / Claude / GPT 等）                      │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Claude Code 架构解析（行业标杆）

| 组件 | 作用 | 实现要点 |
|------|------|---------|
| **Task Planning** | 将用户指令拆解为子任务 | ReAct + 任务图谱 |
| **Tool System** | 声明式工具定义（JSON Schema） | 参数校验 + 错误重试 |
| **Context Window** | 管理 200K tokens 上下文 | Token压缩 + 滑动窗口 |
| **Sandbox** | 隔离执行环境 | 容器化 + 权限控制 |
| **Feedback Loop** | 自动修复错误 | 执行→报错→分析→修复 |
| **Memory** | 跨会话持久化 | 项目记忆/会话摘要/向量检索等，具体实现以公开文档为准 |

### 1.3 ACP（Agent Communication Protocol）

这里不要断言“ACP 是 Claude Code 内部协议”。更稳的说法是：AI Coding Agent 通常需要一个 Host ↔ Agent/Tool 的结构化通信层，常见形态包括 JSON-RPC、stdio/WebSocket、MCP 或自定义协议。Claude Code 公开能力里能确认的是工具调用与 MCP 集成，内部 IPC 细节不应当当作确定事实背诵。

```
[Agent] ⟷ ACP [stdio/WebSocket] ⟷ [Host Process]

Request:  {jsonrpc:"2.0", method:"tools/call", params:{name:"read_file", args:{path:"..."}}}
Response: {jsonrpc:"2.0", result:{content:[{type:"text", text:"..."}]}}
```

**为什么用 ACP 而不是 MCP？**
- ACP 是**Agent→工具**的双向通信（Agent 主动调用工具）
- MCP 是**Host→工具**的广播机制
- ACP 支持 Agent 自主决策和编排

---

## 二、核心组件详解

### 2.1 文件系统操作

AI Coding Agent 的核心能力——理解项目结构、读写文件。

```typescript
// 文件操作工具定义（JSON Schema）
interface FileTools {
  read_file: {
    params: { path: string; offset?: number; limit?: number };
    returns: { content: string; total_lines: number };
  };
  write_file: {
    params: { path: string; content: string };
    returns: { bytes_written: number };
  };
  patch: {
    params: { path: string; old_string: string; new_string: string };
    returns: { diff: string };
  };
  search_files: {
    params: { pattern: string; path?: string; file_glob?: string };
    returns: { matches: Array<{ path: string; line: number }> };
  };
}
```

**工程挑战**：
- **大文件分片**：超过 100K tokens 的文件不能一次读完，要分页+offset
- **模糊匹配**：用户指定文件名可能不完全准确，需要模糊匹配+纠错建议
- **并发安全**：多个 Agent 操作同一文件时防止冲突
- **编码检测**：处理 UTF-8/GBK/ISO-8859-1 等不同编码

### 2.2 命令执行系统

```typescript
interface CommandTool {
  params: {
    command: string;
    timeout?: number;      // 默认 180s
    workdir?: string;      // 工作目录
    background?: boolean;   // 后台运行
    pty?: boolean;         // 伪终端模式
  };
  returns: {
    output: string;
    exit_code: number;
    session_id?: string;   // 后台进程ID
  };
}
```

**关键设计**：
- **超时控制**：前台命令限时，超时自动 kill
- **后台进程管理**：支持 start/stop/poll/log 生命周期
- **PTY 模式**：模拟终端运行交互式命令（vim/less/python REPL）
- **输出截断**：超大输出（>50KB）自动截断并告知

### 2.3 搜索系统

```typescript
interface SearchTool {
  params: {
    pattern: string;       // 正则/文本模式
    target: "content" | "files";
    path?: string;
    file_glob?: string;    // *.py, *.java 等
    context?: number;      // 上下文行数
    output_mode: "content" | "files_only" | "count";
  };
}
```

**为什么 Agent 需要专门的搜索工具？**
- Agent 在修改代码前需要全局搜索理解项目结构
- 找符号定义、引用关系、配置项
- 比人类更快地遍历项目

### 2.4 Git 集成

```typescript
interface GitTool {
  params: {
    action: "status" | "diff" | "commit" | "branch" | "log";
    options?: Record<string, string>;
  };
}
```

**Agent 的 Git 工作流**：
```
Plan → Execute → Verify → Commit
  ↑                        ↓
  └────── Fix ←───── Review
```

- 自动创建分支 → 修改代码 → 跑测试 → 通过后 commit
- 测试失败 → 分析报错 → 修复 → 重跑

### 2.5 上下文管理（核心难点）

AI Coding Agent 面临的最大挑战：**如何在大项目中保持上下文不丢失**

```python
# 上下文管理策略
class ContextManager:
    def __init__(self, max_tokens=200000):
        self.max_tokens = max_tokens
        self.current_tokens = 0
        self.message_buffer = []
    
    def add_message(self, msg):
        """添加消息，超出上限时压缩"""
        tokens = count_tokens(msg)
        while self.current_tokens + tokens > self.max_tokens:
            # 策略1：移除最早的非关键消息
            oldest = self.message_buffer.pop(0)
            self.current_tokens -= count_tokens(oldest)
        self.message_buffer.append(msg)
        self.current_tokens += tokens
    
    def compress_history(self):
        """压缩历史：合并连续工具调用，摘要化长对话"""
        # 把多轮工具调用压缩为"查看了3个文件，修改了2个"
        pass
```

**压缩策略对比**：

| 策略 | 效果 | 代价 |
|------|------|------|
| 滑动窗口（丢弃最早） | 简单 | 可能丢失关键上下文 |
| 摘要压缩 | 保留语义 | 额外 LLM 调用 |
| KV-Cache 复用 | 保留所有信息 | 显存占用大 |
| 分层摘要 | 按时间/模块分层压缩 | 实现复杂 |

### 2.6 持久化记忆系统

```sql
-- Agent 记忆系统 Schema
CREATE TABLE memories (
  id INTEGER PRIMARY KEY,
  content TEXT,           -- 记忆内容
  embedding BLOB,         -- 向量（用于语义检索）
  category TEXT,          -- 分类：user_prefs / project_info / skills
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_category ON memories(category);
```

**三层记忆架构**：
1. **短期记忆**：当前会话上下文（滑动窗口）
2. **长期记忆**：SQLite 持久化，保存用户偏好、项目约定
3. **技能记忆**：可复用的工作流模板（Skill System）

### 2.7 工具系统设计（Skill System）

```yaml
# Skill 定义格式
name: github-code-review
description: Review code changes via git diff
triggers:
  - "review my code"
  - "check the PR"
steps:
  - name: get_diff
    tool: terminal
    params: { command: "git diff HEAD~1" }
  - name: analyze
    tool: llm
    params: { prompt: "Review the following diff..." }
```

**Skill 系统核心设计**：
- **声明式**：用 YAML/JSON 定义工作流
- **可组合**：Skill 可以嵌套调用其他 Skill
- **可共享**：版本管理，分发给多个 Agent 实例

---

## 三、关键技术挑战

### 3.1 工具调用可靠性

**问题**：LLM 生成的工具调用参数可能格式错误、类型不匹配、遗漏必填字段

**解决方案**：
```python
# 1. 严格模式：强制 JSON Schema 校验
# 2. 模糊匹配：参数名拼写纠错（"pah" → "path"）
# 3. 重试机制：失败后自动纠正并重试（最多3次）
# 4. 回退策略：工具调用失败后通知 LLM 调整方案
```

### 3.2 错误恢复与反馈循环

```python
class FeedbackLoop:
    """Agent 自愈循环"""
    def execute_with_retry(self, task, max_attempts=3):
        for attempt in range(max_attempts):
            result = task.execute()
            if result.success:
                return result
            
            # 分析错误
            error_msg = result.error
            if "SyntaxError" in error_msg:
                # 自动修复语法错误
                self.fix_syntax(task)
            elif "ImportError" in error_msg:
                # 自动安装缺失依赖
                self.install_dependency(task)
            elif "Timeout" in error_msg:
                # 优化并发或增加超时
                self.optimize_timeout(task)
        
        return result  # 返回最后一次尝试的结果
```

### 3.3 安全沙箱

| 风险 | 防护措施 |
|------|---------|
| 命令注入 | 参数参数化，禁止拼接 |
| 文件越权 | 沙箱隔离（容器/chroot） |
| 无限循环 | 最大迭代次数（如50轮） |
| 敏感信息泄露 | 输出过滤（API Key/密码正则匹配） |
| 资源耗尽 | 单次最大内存/磁盘/网络限制 |

### 3.4 成本控制

Agent 运行一个任务可能产生 50-200+ 次 LLM 调用。

```python
# 成本优化策略
class CostOptimizer:
    def __init__(self):
        self.cheap_model = "deepseek-chat"    # 简单任务
        self.expensive_model = "deepseek-r1"  # 复杂推理
    
    def select_model(self, task):
        if task.complexity < 3:
            return self.cheap_model    # 文件读写、搜索等
        else:
            return self.expensive_model # 代码生成、架构设计
```

---

## 四、面试考点（核心题库）

### 4.1 系统设计题

**Q: 设计一个 AI Coding Agent 的工具调用系统**

要点：
- 工具注册机制（反射/注解扫描）
- 参数校验（JSON Schema）
- 执行隔离（线程池隔离）
- 超时熔断（Hystrix-like）
- 调用链追踪（TraceId）

**Q: Agent 如何保证在大项目中不丢失上下文？**

要点：
- 滑动窗口 + Token 计数
- 关键信息摘要化
- 向量检索历史会话
- 文件级上下文保留（当前修改的文件权重高）

**Q: Agent 执行失败后如何自愈？**

要点：
- 错误分类（语法/逻辑/运行时/环境）
- 针对性修复策略（修复语法/安装依赖/重试）
- 兜底策略：实在不行就回退并告诉用户

### 4.2 技术深挖题

**Q: Claude Code 的 ACP 协议设计思路**

要点：
- JSON-RPC 2.0 实现
- stdio 通信 vs WebSocket
- 双向通信（Agent→工具，工具→Agent）
- 与 MCP 的定位差异

**Q: 如果让你实现 Agent 的 Git 操作，怎么设计？**

要点：
- 安全策略：禁止 push 到 main 分支
- 自动生成有意义的 commit message
- 冲突处理：SSH key 验证
- 历史回溯：允许用户撤销 Agent 的修改

### 4.3 相关技术栈知识点

| 领域 | 知识点 | 重要性 |
|------|--------|--------|
| **LLM** | Prompt Engineering、Function Calling、Tool Use | ⭐⭐⭐⭐⭐ |
| **分布式** | 服务发现、负载均衡、超时重试、降级熔断 | ⭐⭐⭐⭐ |
| **存储** | SQLite、Redis、Vector DB | ⭐⭐⭐⭐ |
| **通信** | SSE、WebSocket、JSON-RPC 2.0 | ⭐⭐⭐⭐ |
| **安全** | 沙箱隔离、CSP、输入净化、权限控制 | ⭐⭐⭐⭐ |
| **Java** | 线程池设计、ConcurrentHashMap、CompletableFuture | ⭐⭐⭐ |
| **Docker** | 容器化、资源限制、镜像管理 | ⭐⭐⭐ |

---

## 五、学习路径与资源

### 5.1 开源项目参考

| 项目 | 考察重点 |
|------|---------|
| **Claude Code** (Anthropic) | ACP协议、Tool System、上下文管理 |
| **OpenCode** (SGLang) | 开源Coding Agent，MCP集成 |
| **Codex CLI** (OpenAI) | 全套 Agent CLI 设计 |
| **DeepSeek-TUI** (社区) | 终端 UI + Agent 整合 |
| **Hermes Agent** (Nous) | 记忆系统、Skill 管理、多平台集成 |

### 5.2 核心技术栈

```
核心必修：
  - LLM Function Calling / Tool Use
  - JSON-RPC 2.0 协议
  - 沙箱隔离（Docker / Firecracker）
  - SQLite + 向量数据库

语言选择：
  - Python（生态最成熟，主流 Agent 框架用得多）
  - TypeScript（CLI 工具友好，VSCode 插件必用）
  - Java（Spring AI / LangChain4j 生态）

框架：
  - LangChain / LangGraph（Agent 编排）
  - Spring AI（Java 生态）
  - MCP SDKs（工具协议实现）
```

---

## 六、总结

### AI Coding Agent 竞争本质

```
不是谁的聊天框回答更漂亮
而是谁能更稳定地进入开发者的真实项目
把"写一段代码"变成"完成一个任务"
```

### DeepSeek Code Harness 的机遇

1. **模型优势**：DeepSeek 的高性价比+长上下文
2. **补啥**：从"会写代码"到"能完成工程任务"的中间层
3. **关键**：建立模型训练 ↔ 真实开发任务的反馈闭环
4. **竞争**：与 Claude Code / Cursor / Codex 争夺开发者工作流入口

### 参与开发需要掌握的技能图谱

```
┌─────────────────────────────────────────────────┐
│  LLM 能力        │  工程能力        │  产品能力   │
├─────────────────────────────────────────────────┤
│  Prompt Engineering │  系统架构设计   │  开发者体验  │
│  Function Calling   │  高性能 IO      │  CLI/IDE 设计│
│  Agent Pattern      │  安全沙箱       │  错误恢复 UX│
│  RAG / Memory       │  分布式系统     │  反馈闭环   │
│  Tool Use           │  可观测性       │  成本优化   │
└─────────────────────────────────────────────────┘
```

> 写于 2026-05-20 | 灵感来源：弦冰66道、京东终面、月之暗面Kimi、极兔速递、DeepSeek Code Harness
