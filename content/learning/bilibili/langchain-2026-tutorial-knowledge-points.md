---
title: "LangChain教程知识点整理（2026版·尚硅谷）"
date: "2026-07-20"
domain: "技术"
area: "AI Agent"
module: ""
project: ""
type: "学习笔记"
status: "可复习"
priority: "P1"
energy: "high"
visibility: "private"
summary: "LangChain从入门到三大项目实战的120集课程知识点梳理"
tags:
  - LangChain
  - AI Agent
  - RAG
  - 大模型
source: "B站"
source_url: "https://www.bilibili.com/video/BV1rv7A6oEeP/"
author: "尚硅谷"
stats: "70万播放 / 1.5万收藏 / 4309投币"
total_episodes: 120
---

# LangChain教程知识点整理（2026版·尚硅谷）

> 来源：B站 · 尚硅谷
> 链接：https://www.bilibili.com/video/BV1rv7A6oEeP/
> 配套资料：关注公众号「尚硅谷教育」回复"大模型"免费获取
> 课程定位：从入门到三大综合项目实战（Agent + RAG + 客服知识库）

---

## 一、课程总览（P1-P6）

### 1.1 课程定位
- LangChain学习一套通，从入门到三大综合项目实战
- 适合有Python基础、想进入AI Agent开发的工程师

### 1.2 为什么需要LangChain
- 大模型本身是无状态的API调用
- LangChain提供标准化的抽象层，解决：
  - 多模型切换（DeepSeek/智谱/阿里云/OpenRouter）
  - 上下文管理（消息历史、对话管理）
  - 工具调用（Function Calling）
  - 记忆系统（短期/长期记忆）
  - RAG（检索增强生成）

### 1.3 大模型相关岗位
- Agent开发工程师
- AI应用开发工程师
- RAG系统架构师
- Prompt工程师

### 1.4 LangChain四大支柱
- **LangChain-Core**：核心抽象层
- **LangChain**：完整应用框架
- **LangGraph**：状态图执行引擎
- **LangSmith**：调试与监控平台

---

## 二、模型调用（P7-P22）

### 2.1 环境准备
- conda虚拟环境配置
- 必要依赖安装

### 2.2 模型调用方式
| 方式 | 示例 | 适用场景 |
|------|------|----------|
| DeepSeek官网 | API直连 | 生产环境 |
| 智谱/阿里云百炼 | 平台API | 国内部署 |
| ChatOpenAI兼容 | 统一接口 | 多模型切换 |
| OpenRouter/CloseAI | 中转平台 | 海外模型 |
| Ollama | 本地部署 | 开发测试 |
| init_chat_model | LangChain 1.x方式 | 新版推荐 |

### 2.3 调用方式
- **invoke()**：单次调用
- **stream()**：流式输出
- **batch()**：批量调用
- **ainvoke()**：异步调用

### 2.4 关键参数
- **model_kwargs**：模型特有参数（temperature、top_p等）
- **extra_body**：额外请求体参数
- **config**：调用配置（超时、重试等）

### 2.5 LangSmith
- 调用链路追踪
- 性能监控
- 成本统计
- 调试与回放

---

## 三、消息与提示词（P25-P32）

### 3.1 消息类型
| 类型 | 作用 | 示例 |
|------|------|------|
| SystemMessage | 系统指令 | "你是一个助手" |
| HumanMessage | 用户输入 | 用户的问题 |
| AIMessage | 模型回复 | 模型的回答 |
| ToolMessage | 工具返回 | 工具执行结果 |

### 3.2 消息格式
- **content**：字符串格式（简单）
- **content_blocks**：结构化块格式（复杂，支持多模态）

### 3.3 对话历史管理
- 消息列表维护
- 上下文窗口限制
- 历史裁剪策略

### 3.4 ChatPromptTemplate
- 两种实例化方式
- 三种调用方式
- 6种参数类型
- 部分变量预填充
- 消息占位符

---

## 四、工具调用（P33-P40）

### 4.1 工具定义方式
```
方式1：不使用@tool（手动定义）
方式2：@tool装饰器 + description + name
方式3：@tool装饰器 + args_schema（Pydantic）
方式4：@tool装饰器 + docstring
```

### 4.2 工具调用流程
1. 模型决定调用哪个工具
2. 框架执行工具函数
3. 结果返回给模型
4. 模型基于结果生成回复

### 4.3 tool_choice参数
- `auto`：模型自动决定
- `required`：强制调用工具
- 指定工具名：强制调用特定工具

### 4.4 实践经验
- 工具描述要清晰准确
- 参数类型要明确
- 避免工具过多（模型选择困难）
- 错误处理要完善

---

## 五、结构化输出（P41-P50）

### 5.1 为什么需要结构化输出
- 模型原始输出是自由文本
- 结构化输出便于程序处理
- 支持类型校验和验证

### 5.2 四种定义格式
| 格式 | 特点 | 适用场景 |
|------|------|----------|
| Pydantic | 功能最全，支持验证 | 复杂数据模型 |
| TypedDict | 轻量，类型提示 | 简单结构 |
| JSON Schema | 标准格式 | 跨语言 |
| @dataclass | Python原生 | 传统项目 |

### 5.3 Pydantic高级特性
- 可选字段（Optional）
- 默认值
- 枚举类型（Enum）
- 列表提取
- 嵌套模型
- 限制条件（ge/le/min_length等）

### 5.4 获取结构化结果
- **with_structured_output()**：直接返回Pydantic对象
- **JSON解析**：模型输出JSON字符串后手动解析

---

## 六、Agent（P51-P63）

### 6.1 Agent核心概念
- Agent = LLM + 工具 + 循环执行
- 模型自主决定调用哪个工具
- 支持多轮工具调用

### 6.2 Agent初始化
- 模型传入方式（直接/配置）
- 工具绑定
- system_prompt设置

### 6.3 Agent调用
- invoke()：单次调用
- stream()：流式输出

### 6.4 Agent结构化输出（4种策略）
| 策略 | 说明 |
|------|------|
| ToolStrategy | 基于工具返回值构建结构 |
| Pydantic Schema | 直接指定输出类型 |
| JSON Schema | JSON格式约束 |
| TypedDict | 类型字典约束 |

### 6.5 Agent错误处理
- 工具执行失败的重试
- 模型调用异常的降级
- 超时处理

### 6.6 实战：多功能智能助手
- 多工具协作
- 用户意图识别
- 回复生成

---

## 七、中间件（P64-P78）

### 7.1 中间件分类
| 中间件 | 功能 | 代码示例 |
|--------|------|----------|
| SummarizationMiddleware | 对话摘要 | 自动总结长对话 |
| HumanInTheLoopMiddleware | 人工介入 | 关键操作需人工确认 |
| PIIMiddleware | 隐私保护 | 自动脱敏个人信息 |
| TodoListMiddleware | 任务管理 | 自动创建待办清单 |
| ModelCallLimitMiddleware | 模型调用限制 | 防止无限循环 |
| ToolCallLimitMiddleware | 工具调用限制 | 控制工具使用次数 |
| ModelFallbackMiddleware | 模型降级 | 主模型失败时切换备用 |
| LLMToolSelectorMiddleware | 工具选择 | 智能筛选可用工具 |
| ToolRetryMiddleware | 工具重试 | 工具失败自动重试 |
| ModelRetryMiddleware | 模型重试 | 模型调用失败重试 |
| LLMToolEmulatorMiddleware | 工具模拟 | 开发测试时模拟工具 |
| ContextEditingMiddleware | 上下文编辑 | 自动裁剪/优化上下文 |
| FilesystemFileSearchMiddleware | 文件搜索 | 本地文件检索 |

### 7.2 中间件执行顺序
- 多个中间件按注册顺序串联执行
- 每个中间件可以修改请求/响应
- 支持条件跳过（can_jump_to）

---

## 八、Hook函数（P79-P85）

### 8.1 Hook概念
- 在Agent执行的关键节点插入自定义逻辑
- 两种定义方式：装饰器 / 类

### 8.2 两种定义方式
| 方式 | 优点 | 缺点 |
|------|------|------|
| 装饰器 | 简洁，声明式 | 复杂逻辑不直观 |
| 类定义 | 灵活，可复用 | 代码量多 |

### 8.3 核心Hook
- **wrap_model_call**：模型调用前后拦截
- **wrap_tool_call**：工具调用前后拦截

### 8.4 参数can_jump_to
- 控制Hook执行后的跳转行为
- 支持条件分支

---

## 九、记忆系统（P86-P101）

### 9.1 记忆分类
| 类型 | 存储位置 | 生命周期 |
|------|----------|----------|
| 短期记忆（内存） | 进程内存 | 会话期间 |
| 短期记忆（PostgreSQL） | 数据库 | 持久化 |
| 长期记忆 | 向量数据库 | 永久 |

### 9.2 短期记忆实现
- **内存持久化器**：InMemorySaver
- **PostgreSQL持久化**：PostgresSaver
- 工作原理：消息列表 + checkpoint

### 9.3 消息治理策略
- **消息裁剪**：保留最近N条
- **消息删除**：删除过早的消息
- **消息摘要**：将旧消息压缩为摘要

### 9.4 长期记忆
- **put()**：存储记忆
- **get()**：读取记忆
- **search()**：搜索记忆
- 基于InMemoryStore（开发）
- 基于PostgresStore（生产）

### 9.5 长期记忆访问
- 在工具中访问
- 在中间件中访问

---

## 十、RAG（P102-P120）

### 10.1 RAG工作流程
```
文档加载 → 文档切分 → 向量化 → 存入向量库
                                    ↓
用户查询 → 查询向量化 → 相似度搜索 → 上下文增强 → LLM生成回答
```

### 10.2 文档加载器
| 加载器 | 适用格式 |
|--------|----------|
| TextLoader | .txt文件 |
| CSVLoader | .csv文件 |
| JSONLoader | .json文件 |
| PyPDFLoader | .pdf文件 |
| MinerU | 复杂PDF（表格/图片） |

### 10.3 切分策略
| 切分器 | 特点 |
|--------|------|
| CharacterTextSplitter | 按字符数切分 |
| RecursiveCharacterTextSplitter | 递归按分隔符切分（推荐） |
| MarkdownHeaderTextSplitter | 按Markdown标题切分 |
| TokenTextSplitter | 按Token数切分 |

**三个核心方法**：
- split_text()：切分文本
- split_documents()：切分文档
- create_documents()：从文本创建文档

### 10.4 嵌入模型
- 初始化与配置
- 文档向量化
- 查询向量化

### 10.5 向量数据库：Milvus
- Docker安装与配置
- 数据模型说明
- DDL操作（集合创建/删除）
- DML操作（插入/更新/删除）
- DQL操作（查询/搜索）

### 10.6 项目实战：客服知识库
1. **全局配置**：初始化Milvus连接
2. **文档处理**：切分 → 向量化 → 写入Milvus
3. **Agent初始化**：绑定检索工具
4. **检索与生成**：检索函数 → 上下文增强 → 回答生成

---

## 十一、关键概念速查

| 概念 | 一句话解释 |
|------|-----------|
| LangChain | 大模型应用开发框架 |
| LangGraph | 基于状态图的Agent执行引擎 |
| LangSmith | 调试、监控、评估平台 |
| Agent | LLM + 工具 + 循环的智能体 |
| Tool | 模型可调用的外部函数 |
| RAG | 检索增强生成，让LLM引用外部知识 |
| Middleware | Agent执行链路上的拦截器 |
| Hook | Agent关键节点的自定义逻辑 |
| Memory | 对话历史和长期记忆管理 |
| Structured Output | 模型输出的结构化约束 |
| Embedding | 文本向量化，用于语义搜索 |
| Vector Store | 向量数据库，存储文档嵌入 |

---

## 十二、三大综合项目

| 项目 | 核心技术 | 对应章节 |
|------|----------|----------|
| 多功能智能助手 | Agent + 多工具协作 | P51-P63 |
| RAG知识库问答 | 文档加载 + 切分 + 向量化 + 检索 | P102-P116 |
| 客服知识库系统 | 全流程实战：配置→文档→Agent→生成 | P117-P120 |
