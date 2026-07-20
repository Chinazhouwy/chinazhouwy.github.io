---
title: "LangChain 2026教程 转写笔记（尚硅谷120集）"
date: "2026-07-21"
domain: "技术"
area: "AI Agent"
module: ""
project: ""
type: "学习笔记"
status: "可复习"
priority: "P1"
energy: "high"
visibility: "private"
summary: "基于120集视频转写的完整结构化笔记，涵盖环境搭建、模型调用、消息提示词、工具调用、结构化输出、Agent、中间件、Hook、记忆系统、RAG全模块"
tags:
  - LangChain
  - AI Agent
  - RAG
  - 大模型
  - LangGraph
source: "B站"
source_url: "https://www.bilibili.com/video/BV1rv7A6oEeP/"
author: "尚硅谷"
total_episodes: 120
---

# LangChain 2026教程 转写笔记（尚硅谷120集）

> 来源：B站 · 尚硅谷  
> 版本：LangChain 1.2.12  
> 配套资料：关注公众号「尚硅谷教育」回复"大模型"免费获取  
> 课程定位：从入门到三大综合项目实战（Agent + RAG + 客服知识库）

---

## 一、课程总览（P001-P010）

### 1.1 课程定位
- 基于 LangChain 1.2.12 版本讲解，融合最新版本特性
- 适合有 Python 基础、想进入 AI Agent 开发的工程师
- Java 后端开发者可参考，框架设计理念相通

### 1.2 为什么需要 LangChain
大模型三大局限性：
1. **知识受限于训练数据** — 语料有截止日期，无法获取实时信息
2. **无法连接互联网和外部API** — 没有四肢，只能当军师
3. **不具备状态保持能力** — 无上下文记忆，每次交互都是全新开始

LangChain 解决方案：
- 多模型切换（DeepSeek/智谱/阿里云/OpenRouter）
- 上下文管理（消息历史、对话管理）
- 工具调用（Function Calling）
- 记忆系统（短期/长期记忆）
- RAG（检索增强生成）

### 1.3 大模型相关岗位
| 岗位 | 学历要求 | 薪资水平 |
|------|---------|---------|
| 大模型运维/研发工程师 | 一本+ | 中高 |
| 数据开发/清洗工程师 | 一般 | 中等 |
| 基座模型开发/优化 | 博士 | 年薪150-200万 |
| 微调/算法工程师 | 211/985 | 中高 |
| Agent/应用开发工程师 | 无硬性要求 | **需求最多** |

### 1.4 LangChain 四大支柱
| 框架 | 定位 | 解决的问题 |
|------|------|-----------|
| LangChain | 基础能力层 | 快速构建简单智能体 |
| LangGraph | 工作流编排 | 稳定运行复杂智能体 |
| DeepAgent | 执行框架 | 复杂任务多智能体协作 |
| LangSmith | 监控平台 | 调试、监控、评估 |

### 1.5 大模型应用的四个递进场景
```
纯Prompt → Function Calling → RAG → Fine-tuning
（对话）    （工具调用）     （知识库）  （模型微调）
```

---

## 二、环境准备（P007-P010）

### 2.1 前置知识
- Python 基础语法（类、装饰器、异步编程）
- 大语言模型基础概念（token、prompt、embedding）
- 建议先用过豆包/DeepSeek/GPT等产品

### 2.2 虚拟环境方案对比
| 方案 | 工具 | 适用场景 |
|------|------|---------|
| conda | Miniconda | 含非Python依赖（CUDA/PyTorch） |
| uv | uv | 大型纯Python项目 |
| venv | Python内置 | 小型demo |

### 2.3 环境搭建步骤
```bash
# 1. 创建虚拟环境
conda create --name langchain1.2 python=3.13.12
conda activate langchain1.2

# 2. 安装 LangChain
pip install langchain==1.2.12

# 3. 验证安装
python --version
```

### 2.4 必要依赖安装
```bash
# 安装核心依赖
pip install -r requirements.txt

# RAG章节额外依赖
pip install -r requirements_4.txt
```

---

## 三、模型调用（P011-P024）

### 3.1 模型调用三要素
调用任何大模型都需要三个核心参数：
1. **base_url** — 模型平台的URL地址
2. **api_key** — 密钥
3. **model** — 模型名称

### 3.2 调用方式分类

#### 方式一：专用API
```python
# DeepSeek官网
from langchain_deepseek import ChatDeepSeek
model = ChatDeepSeek(model="deepseek-v4-flash")

# 智谱
from langchain_zhipuai import ChatZhipuAI

# 阿里云百炼
from langchain_dashscope import ChatTongyi
```

#### 方式二：ChatOpenAI兼容写法（推荐）
```python
from langchain_openai import ChatOpenAI
model = ChatOpenAI(
    model="deepseek-v4-flash",
    api_key=os.getenv("CLOSEAI_API_KEY"),
    base_url=os.getenv("CLOSEAI_BASE_URL")
)
```

#### 方式三：LangChain 1.x 统一方式（最新推荐）
```python
from langchain.chat_models import init_chat_model
model = init_chat_model(
    model="deepseek-v4-flash",
    model_provider="DeepSeek"
)
```

### 3.3 中转平台
| 平台 | 特点 | 适用场景 |
|------|------|---------|
| OpenRouter | 支持国内外模型，需梯子 | 测试对比不同模型 |
| CloseAI | 中文界面，无需梯子 | 国内开发首选 |
| 阿里云百炼 | 国内平台 | 国内部署 |

### 3.4 .env配置文件
```env
# DeepSeek官网
DEEPSEEK_API_KEY=your_key
DEEPSEEK_BASE_URL=https://api.deepseek.com

# CloseAI平台
CLOSEAI_API_KEY=your_key
CLOSEAI_BASE_URL=https://api.closeai.com/v1

# OpenRouter平台
OPENROUTER_API_KEY=your_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Tavily搜索
TAVILY_API_KEY=your_key

# LangSmith监控
LANGSMITH_API_KEY=your_key
LANGSMITH_TRACING=true
```

### 3.5 四种调用方法
| 方法 | 说明 | 返回类型 |
|------|------|---------|
| invoke() | 单次调用 | AIMessage |
| stream() | 流式输出 | 迭代器 |
| batch() | 批量调用 | 列表 |
| ainvoke() | 异步调用 | 协程 |

### 3.6 完整代码示例：四种调用方法

#### invoke —— 阻塞式同步调用
```python
import os
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from rich import print as rprint

load_dotenv(override=True)

# 初始化模型（推荐 init_chat_model 统一方式）
model = init_chat_model(
    model="deepseek-v4-flash",
    model_provider="DeepSeek"
)

# --- 场景1：字符串输入（最简单）---
response = model.invoke("用一句话介绍 LangChain")
print(response.content)
# 'LangChain 是一个用于构建大语言模型应用的开源框架。'

# --- 场景2：字典列表输入（推荐写法，支持多角色）---
messages = [
    {"role": "system", "content": "你是一个专业的Python导师"},
    {"role": "user", "content": "帮我解释一下什么是斐波那契数列"}
]
response = model.invoke(messages)
print(response.content)
# '斐波那契数列是指从0和1开始，后面每一项都是前两项之和的数列...'

# --- 场景3：消息对象列表输入（类型最明确）---
from langchain_core.messages import HumanMessage, SystemMessage

messages = [
    SystemMessage(content="你是一个专业的Python导师"),
    HumanMessage(content="帮我解释一下什么是斐波那契数列")
]
response = model.invoke(messages)
print(response.content)

# --- 场景4：多轮对话 + 记忆传递 ---
conversation = [
    {"role": "user", "content": "我叫小明"},
]
# 第一轮对话
response1 = model.invoke(conversation)
print(f"AI回复1: {response1.content}")

# 添加记忆：将AI回复追加到对话历史
conversation.append({"role": "assistant", "content": response1.content})
conversation.append({"role": "user", "content": "我叫什么名字"})

# 第二轮对话（模型能记住你叫小明）
response2 = model.invoke(conversation)
print(f"AI回复2: {response2.content}")
# '你叫小明。'

# --- 查看返回值的完整信息 ---
rprint(response2)  # 美化输出 AIMessage 的所有字段

# 提取关键字段
print("内容:", response2.content)
print("Token消耗:", response2.response_metadata.get("token_usage", {}))
print("模型:", response2.response_metadata.get("model_name", ""))
print("结束原因:", response2.response_metadata.get("finish_reason", ""))
```

#### stream —— 流式输出（打字机效果）
```python
# 流式输出：逐 token 返回，体验更流畅
stream = model.stream("帮我解释一下什么是人工智能")

for chunk in stream:
    print(chunk.content, end="", flush=True)
# 人工智能（Artificial Intelligence，简称AI）是指...

# 流式输出配合消息列表
messages = [
    {"role": "system", "content": "你是一个简洁的助手，回答控制在50字以内"},
    {"role": "user", "content": "什么是量子计算？"}
]

print("回答: ", end="")
for chunk in model.stream(messages):
    print(chunk.content, end="", flush=True)
print()  # 换行
```

#### batch —— 批量调用（并发处理，效率更高）
```python
# 一次性发送多个请求，模型在后台并行处理
questions = [
    "Python是什么？",
    "Java是什么？",
    "JavaScript是什么？",
    "Rust是什么？",
    "Go是什么？"
]

# 批量调用：比逐个 invoke 更高效（减少网络往返）
responses = model.batch(questions)

for q, r in zip(questions, responses):
    print(f"Q: {q}")
    print(f"A: {r.content[:80]}...")
    print()

# 带 config 的 batch（控制最大并发数，避免压力过大）
responses = model.batch(
    questions,
    config={"max_concurrency": 3}  # 最多同时处理3个请求
)
```

#### ainvoke —— 异步调用（配合 async/await）
```python
import asyncio
from langchain.chat_models import init_chat_model

model = init_chat_model(model="deepseek-v4-flash", model_provider="DeepSeek")

async def main():
    # 单个异步调用
    response = await model.ainvoke("你好，请自我介绍")
    print(response.content)
    
    # 异步批量调用
    tasks = [model.ainvoke(q) for q in ["问题1", "问题2", "问题3"]]
    results = await asyncio.gather(*tasks)
    for r in results:
        print(r.content)

asyncio.run(main())
```

### 3.7 关键参数
```python
# temperature：控制输出随机性（0.0-2.0，默认0.7）
# 数学运算/数据提取 → 低值（0.0-0.3）
# 创意文案/头脑风暴 → 高值（1.0-1.5）
# 注意：接近2.0可能出现幻觉

# max_tokens：限制输出最大token数
# token：基本语义单位，中文约1-1.8个汉字/token，英文约3-4字符/token

# timeout：超时时间（秒）
# max_retries：最大重试次数（默认6）
```

### 3.8 LangSmith 监控
```env
# 配置.env
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your_key
LANGSMITH_PROJECT="langchain_1.2_tutorial"
```

主要功能：
- **Tracing**：调用链路追踪（最核心）
- **Monitoring**：性能监控（token花费、调用次数）
- **Playground**：提示词测试
- **Dataset**：数据集管理
- **Evaluation**：自动评估

---

## 四、消息与提示词（P025-P032）

### 4.1 四种消息类型
| 类型 | 角色 | 用途 |
|------|------|------|
| SystemMessage | system | 系统指令，定义模型行为 |
| HumanMessage | user | 用户输入的问题 |
| AIMessage | assistant | 模型的回复 |
| ToolMessage | tool | 工具执行结果 |

### 4.2 消息格式
```python
# 字符串格式（简单）
HumanMessage(content="你好")

# 结构化块格式（复杂，支持多模态）
HumanMessage(content=[
    {"type": "text", "text": "描述这张图片"},
    {"type": "image_url", "image_url": {"url": "..."}}
])
```

### 4.3 消息对象字段
```python
# SystemMessage
SystemMessage(content="你是一个助手")

# HumanMessage - 支持metadata
HumanMessage(
    content="问题内容",
    metadata={"name": "用户A", "id": "msg_001"}
)

# AIMessage - 包含tool_calls
AIMessage(
    content="",
    tool_calls=[{"name": "get_weather", "args": {"city": "北京"}}]
)
```

### 4.4 ChatPromptTemplate
```python
from langchain_core.prompts import ChatPromptTemplate

# 实例化方式1：from_messages
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个{role}"),
    ("human", "{question}")
])

# 调用方式
messages = prompt.invoke({"role": "数学老师", "question": "1+1=?"})

# 部分变量预填充
partial_prompt = prompt.partial(role="数学老师")

# 消息占位符
from langchain_core.prompts import MessagesPlaceholder
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个助手"),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}")
])
```

### 4.5 对话历史管理
```python
# 基础对话历史
messages = []
messages.append(HumanMessage(content="你好"))
messages.append(AIMessage(content="你好！"))
# 下次调用时传入完整messages列表
response = model.invoke(messages)
```

---

## 五、工具调用（P033-P040）

### 5.1 四种工具定义方式
```python
# 方式1：手动定义
def get_weather(city: str) -> str:
    """查询天气"""
    return f"{city}天气晴朗"

# 方式2：@tool装饰器 + description
from langchain_core.tools import tool

@tool(description="查询指定城市的天气")
def get_weather(city: str) -> str:
    return f"{city}天气晴朗"

# 方式3：@tool + args_schema（Pydantic）
from pydantic import BaseModel, Field

class WeatherInput(BaseModel):
    city: str = Field(description="城市名称")

@tool(args_schema=WeatherInput)
def get_weather(city: str) -> str:
    return f"{city}天气晴朗"

# 方式4：@tool + docstring（Google style）
@tool
def get_weather(city: str) -> str:
    """查询天气。

    Args:
        city: 城市名称
    """
    return f"{city}天气晴朗"
```

### 5.2 tool_choice参数
```python
# auto：模型自动决定是否调用工具
# required：强制调用工具
# 指定工具名：强制调用特定工具
model.bind_tools(tools, tool_choice="auto")
```

### 5.3 实践经验
- 错误处理要完善

### 5.4 完整代码示例：工具调用的两种方式

#### 方式一：直接调用工具（不经过模型）
```python
from langchain_core.tools import tool
from langchain_core.utils import convert_to_openai_tool
from rich import print as rprint

# 定义工具（@tool 装饰器方式）
@tool(description="查询指定城市的天气情况")
def get_weather(city: str) -> str:
    """查询天气。"""
    return f"{city}天气晴朗，气温25°C"

# 查看工具转换后的JSON Schema（模型看到的工具描述）
rprint(convert_to_openai_tool(get_weather))
# {
#   "type": "function",
#   "function": {
#     "name": "get_weather",
#     "description": "查询指定城市的天气情况",
#     "parameters": {
#       "type": "object",
#       "properties": {"city": {"type": "string"}},
#       "required": ["city"]
#     }
#   }
# }

# 直接调用工具（不经过模型）
result = get_weather.invoke({"city": "北京"})
print(result)  # '北京天气晴朗，气温25°C'
```

#### 方式二：基于模型调用工具（模型决定是否调用）
```python
import os
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from rich import print as rprint

load_dotenv(override=True)

# 1. 创建模型
model = init_chat_model(model="deepseek-v4-flash", model_provider="DeepSeek")

# 2. 定义工具
@tool(description="查询指定城市的天气情况")
def get_weather(city: str) -> str:
    """查询天气。"""
    return f"{city}天气晴朗，气温25°C"

# 3. 【关键步骤】将工具绑定到模型（模型才知道有哪些工具可用）
model_with_tools = model.bind_tools([get_weather])

# 4. 发送请求 —— 模型分析后决定是否调用工具
response = model_with_tools.invoke("北京今天天气如何？")
rprint(response)
# AIMessage(
#   content='',
#   tool_calls=[{'name': 'get_weather', 'args': {'city': '北京'}, 'id': '...'}]
# )

# 5. 检查模型是否决定调用工具
if response.tool_calls:
    # 有工具调用 → 手动执行工具（大模型只能分析，不能直接调用）
    messages = [HumanMessage(content="北京今天天气如何？")]
    messages.append(response)  # 添加 AIMessage
    
    for tool_call in response.tool_calls:
        # 执行工具
        tool_result = get_weather.invoke(tool_call["args"])
        
        # 创建 ToolMessage 添加到消息列表
        messages.append(ToolMessage(
            content=tool_result,
            tool_call_id=tool_call["id"]  # 必须匹配 tool_call 的 id
        ))
    
    # 6. 将工具结果再次发给模型，让模型整合最终回复
    final_response = model_with_tools.invoke(messages)
    print(final_response.content)
    # '北京今天天气晴朗，气温25°C。'
else:
    # 无工具调用 → 直接返回模型回复
    print(response.content)

# 打印消息流转过程
print("\n--- 消息流转过程 ---")
for msg in messages:
    print(f"{type(msg).__name__}: {msg.content[:50] if msg.content else msg.tool_calls}")
# HumanMessage: 北京今天天气如何？
# AIMessage: [{'name': 'get_weather', ...}]
# ToolMessage: 北京天气晴朗，气温25°C
# AIMessage: 北京今天天气晴朗，气温25°C。
```

#### 完整示例：4种工具定义方式对比
```python
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from langchain_core.utils import convert_to_openai_tool
from typing import Literal

# ===== 方式1：手动定义（传统方式，不推荐）=====
def get_weather_v1(city: str) -> str:
    """查询天气"""
    return f"{city}天气晴朗"

# ===== 方式2：@tool + description（简洁，推荐）=====
@tool(description="查询指定城市的天气情况")
def get_weather_v2(city: str) -> str:
    return f"{city}天气晴朗"

# ===== 方式3：@tool + args_schema（Pydantic，参数复杂时推荐）=====
class WeatherInput(BaseModel):
    """天气查询参数"""
    city: str = Field(description="城市名称，如：北京")
    unit: Literal["摄氏", "华氏"] = Field(default="摄氏", description="温度单位")
    include_forecast: bool = Field(default=False, description="是否包含未来5天预报")

@tool(args_schema=WeatherInput)
def get_weather_v3(city: str, unit: str = "摄氏", include_forecast: bool = False) -> str:
    return f"{city}天气晴朗，{unit}25度" + ("，含预报" if include_forecast else "")

# ===== 方式4：@tool + Google风格docstring（最简洁）=====
@tool
def get_weather_v4(city: str) -> str:
    """查询天气。

    Args:
        city: 城市名称
    """
    return f"{city}天气晴朗"

# 验证每种方式的工具描述
for i, tool_obj in enumerate([get_weather_v1, get_weather_v2, get_weather_v3, get_weather_v4], 1):
    schema = convert_to_openai_tool(tool_obj)
    print(f"方式{i}: {schema['function']['description'][:40]}")
    print(f"  参数: {list(schema['function']['parameters']['properties'].keys())}")
    print()
```
- 工具描述要清晰准确，直接影响模型选择
- 参数类型要明确
- 工具数量建议2-5个，过多会导致选择困难
- 错误处理要完善

---

## 六、结构化输出（P041-P050）

### 6.1 四种结构化输出格式
| 格式 | 返回类型 | 校验强度 | 推荐度 |
|------|---------|---------|--------|
| Pydantic | Schema实例 | 强（类型不匹配抛异常） | ⭐⭐⭐⭐⭐ |
| TypedDict | 字典 | 弱（仅警告） | ⭐⭐⭐ |
| JSON Schema | 字典 | 弱 | ⭐⭐ |
| @dataclass | 字典 | 弱 | ⭐⭐ |

### 6.2 Pydantic基本用法（首选）
```python
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI

# 定义结构
class Person(BaseModel):
    """人物信息"""
    name: str = Field(description="姓名")
    age: int = Field(description="年龄")
    occupation: str = Field(description="职业")

# 绑定结构化输出
model = ChatOpenAI(model="gpt-5.4-mini")
structured_model = model.with_structured_output(Person)

# 调用
result = structured_model.invoke("张三是一名30岁的软件工程师")
print(result.name)  # 张三
print(result.age)    # 30
```

### 6.3 Pydantic高级特性
```python
from typing import Optional
from enum import Enum

class Priority(str, Enum):
    LOW = "低"
    MEDIUM = "中"
    HIGH = "高"

class CustomerInfo(BaseModel):
    """客户信息"""
    name: str = Field(description="姓名")
    email: Optional[str] = Field(default=None, description="邮箱")
    priority: Priority = Field(description="紧急程度")
    tags: list[str] = Field(default_factory=list, description="标签列表")
```

### 6.4 TypedDict用法
```python
from typing import TypedDict, Annotated

class MovieDict(TypedDict):
    """电影信息"""
    title: Annotated[str, "电影名称"]
    year: Annotated[int, "上映年份"]
    director: Annotated[str, "导演"]
    rating: Annotated[float, "评分"]

structured_model = model.with_structured_output(MovieDict)
```

### 6.5 两种获取结构化结果的方式
```python
# 方式1：with_structured_output（推荐）
result = structured_model.invoke("介绍星际穿越")

# 方式2：包含原始AIMessage
result = model.with_structured_output(MovieDict, include_raw=True)
# result包含：raw（原始AIMessage）、parsed（解析结果）、parsing_error
```

---

## 七、Agent（P051-P063）

### 7.1 Agent核心公式
```
Agent = LLM + Tools + Planning + Memory + Action
```

### 7.2 Agent创建
```python
from langchain.agents import create_agent

# 创建Agent
agent = create_agent(
    model=model,                    # 模型
    tools=[get_weather, get_news],  # 工具列表
    system_prompt="你是一个天气助手",  # 系统提示词
    name="weather_assistant"        # Agent名称
)
```

### 7.3 Agent调用
```python
# invoke调用
response = agent.invoke({
    "messages": [
        {"role": "user", "content": "北京天气如何"}
    ]
})

# stream流式调用
for chunk in agent.stream({"messages": [...]}):
    print(chunk)
```

### 7.4 Agent工具调用流程（ReAct模式）
```
HumanMessage → AI Message(思考+tool_calls) → Tool Message(工具执行) → AI Message(最终回复)
```
- 思考(Reasoning)：模型分析是否需要工具
- 行动(Action)：执行工具
- 观察(Observation)：获取工具结果
- 循环：直到不再需要工具调用

### 7.5 Agent结构化输出（4种策略）
| 策略 | 说明 | 适用场景 |
|------|------|---------|
| Provider Strategy | 使用模型原生结构化输出 | OpenAI/Claude等支持原生的模型 |
| **Tool Strategy** | 通过工具调用实现（推荐） | **绝大多数模型，通用性最强** |
| Auto Strategy | 自动选择策略 | 不确定时使用 |
| None | 无结构化输出 | 不需要结构化时 |

```python
# Tool Strategy（推荐）
agent = create_agent(
    model=model,
    tools=[...],
    response_format=ToolStrategy(schema=ContactInfo)
)
```

### 7.6 错误处理（handle_errors）
```python
# true：自动重试（默认）
# false：直接抛异常
# 自定义字符串：返回固定提示
# 指定异常类型：只捕获特定异常
# 自定义函数：精细化处理

### 7.7 完整代码示例：Agent 创建、调用与流式输出

#### 基础用法：创建Agent并调用
```python
import os
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage
from rich import print as rprint

load_dotenv(override=True)

# 1. 创建模型（两种传入方式均可）
# 方式A：传字符串（简洁）
agent = create_agent(
    model="deepseek-v4-flash",                    # 字符串方式
    model_provider="DeepSeek",                    # 指明provider，避免自动推断错误
    tools=[get_weather],                           # 工具列表
    system_prompt="你是一个天气助手，回答要简洁",   # 系统提示词
    name="weather_assistant"                       # Agent名称（可选）
)

# 方式B：传模型对象（灵活，可自定义参数）
model = init_chat_model(
    model="deepseek-v4-flash",
    model_provider="DeepSeek",
    temperature=0.7
)

agent = create_agent(
    model=model,                                   # 传模型实例
    tools=[get_weather],
    system_prompt="你是一个天气助手"
)

# 2. 调用Agent —— invoke（同步阻塞）
response = agent.invoke({
    "messages": [HumanMessage(content="北京天气如何")]
})
rprint(response)
# {'messages': [HumanMessage, AIMessage, ToolMessage, AIMessage]}

# 提取最终回复
for msg in reversed(response["messages"]):
    if isinstance(msg, AIMessage) and msg.content:
        print(f"Agent回复: {msg.content}")
        break

# 3. 查看Agent底层图结构（LangGraph）
graph = agent.get_graph()
print(graph.draw_mermaid())  # 输出 Mermaid 格式的流程图
```

#### 流式输出（7种模式）
```python
# --- 模式1：updates（默认）—— 每步输出增量变化 ---
for chunk in agent.stream(
    {"messages": [HumanMessage(content="北京天气如何")]},
    stream_mode="updates"
):
    print(chunk)
# {'model': {'messages': [AIMessage(...)]}}
# {'tools': {'messages': [ToolMessage(...)]}}
# {'model': {'messages': [AIMessage(...)]}}

# --- 模式2：messages —— 逐token输出（打字机效果，最常用）---
print("回答: ", end="")
for chunk, metadata in agent.stream(
    {"messages": [HumanMessage(content="用三句话介绍人工智能")]},
    stream_mode="messages"
):
    content = chunk.content
    if content:
        print(content, end="", flush=True)
print()

# --- 模式3：values —— 每步输出完整状态 ---
for chunk in agent.stream(
    {"messages": [HumanMessage(content="北京天气如何")]},
    stream_mode="values"
):
    # chunk 包含完整状态：messages列表等
    messages = chunk["messages"]
    print(f"当前消息数: {len(messages)}")

# --- 其他模式 ---
# "tasks"    —— 输出任务生命周期
# "debug"    —— 增加步骤和时间戳
# "checkpoints" —— 检查点触发输出
# "custom"   —— 自定义writer输出

# 限制Agent调用次数（防止无限循环）
response = agent.invoke(
    {"messages": [HumanMessage(content="你好")]},
    config={"recursion_limit": 5}  # 最多执行5步
)
```

#### 完整实战：多功能智能助手
```python
import os
from datetime import datetime
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv(override=True)

# 定义多个工具
@tool(description="查询指定城市的天气")
def get_weather(city: str) -> str:
    """查询天气。"""
    return f"{city}天气晴朗，气温25°C"

@tool(description="进行数学计算，支持加减乘除")
def calculate(expression: str) -> str:
    """计算数学表达式。

    Args:
        expression: 数学表达式，如 '2+3*4'
    """
    try:
        result = eval(expression)  # 生产环境应使用安全的计算库
        return f"{expression} = {result}"
    except Exception as e:
        return f"计算错误: {e}"

@tool(description="获取当前时间")
def get_time() -> str:
    """获取当前时间。"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# 创建多功能Agent
agent = create_agent(
    model="deepseek-v4-flash",
    model_provider="DeepSeek",
    tools=[get_weather, calculate, get_time],
    system_prompt="你是一个多功能智能助手，可以查询天气、做数学计算、查看时间。回答要简洁。"
)

# 交互式对话（带记忆）
class SmartAssistant:
    def __init__(self):
        self.messages = []
    
    def chat(self, user_input: str) -> str:
        self.messages.append(HumanMessage(content=user_input))
        result = agent.invoke({"messages": self.messages})
        self.messages = result["messages"]
        # 取最后一条AI消息
        for msg in reversed(self.messages):
            if isinstance(msg, AIMessage) and msg.content:
                return msg.content
        return "抱歉，无法回答"
    
    def reset(self):
        self.messages = []

# 使用示例
assistant = SmartAssistant()
print(assistant.chat("北京天气怎么样？"))
print(assistant.chat("上海呢？"))        # 能记住上下文
print(assistant.chat("(3+5)*12等于多少？"))
print(assistant.chat("现在几点了？"))
assistant.reset()  # 清空记忆
```
agent = create_agent(
    model=model,
    tools=[...],
    response_format=ToolStrategy(
        schema=ContactInfo,
        handle_errors=True  # 默认值
    )
)
```

### 7.8 流式输出模式（7种）
| 模式 | 说明 | 适用场景 |
|------|------|---------|
| values | 每步输出完整状态 | 状态持久化 |
| **updates** | 每步输出增量变化（默认） | 监控执行进度 |
| **messages** | 逐token输出（打字机效果） | 实时对话 |
| tasks | 输出任务生命周期 | 任务监控 |
| debug | 增加步骤和时间戳 | 调试 |
| checkpoints | 检查点触发输出 | 状态持久化 |
| custom | 自定义writer输出 | 业务进度 |

```python
# 实时对话场景
for chunk in agent.stream(
    {"messages": [...]},
    stream_mode="messages"
):
    content = chunk[0].content
    print(content, end="", flush=True)
```

### 7.9 限制Agent调用次数
```python
response = agent.invoke(
    {"messages": [...]},
    config={"recursion_limit": 5}
)
```

### 7.10 实战：多功能智能助手
```python
class SmartAssistant:
    def __init__(self):
        self.model = init_chat_model(model="gpt-5.4-mini", model_provider="OpenAI")
        self.tools = [get_weather, calculate, get_time, convert_currency, search_info]
        self.messages = []
        self.agent = create_agent(
            model=self.model,
            tools=self.tools,
            system_prompt="你是一个多功能智能助手"
        )
    
    def chat(self, user_input: str) -> str:
        self.messages.append(HumanMessage(content=user_input))
        result = self.agent.invoke({"messages": self.messages})
        self.messages = result["messages"]
        # 取最后一条AI消息
        for msg in reversed(self.messages):
            if isinstance(msg, AIMessage):
                return msg.content
        return "抱歉，无法回答"
    
    def reset(self):
        self.messages = []
```

---

## 八、中间件（P064-P078）

### 8.1 中间件概述
中间件是Agent执行链路上的拦截器，可修改请求/响应。

### 8.2 16个内置中间件

#### 常用4个（重点掌握）
| 中间件 | 功能 | 关键参数 |
|--------|------|---------|
| **SummarizationMiddleware** | 对话摘要压缩 | model_in, token_threshold |
| **HumanInTheLoopMiddleware** | 人工审核 | interrupt_on, allowed_decisions |
| **PIIMiddleware** | 隐私保护/脱敏 | pii_type, strategy |
| **TodoListMiddleware** | 任务规划追踪 | - |

#### PII脱敏策略
```python
# redact：完全隐藏（替换为字符串）
# mask：部分遮掩（保留后几位）
# hash：哈希处理（匿名追踪）
# block：抛异常（绝不允许）
PIIMiddleware(
    pii_type="email",
    strategy="redact",
    apply_to_input=True
)
```

#### 其他12个中间件
| 中间件 | 功能 |
|--------|------|
| ModelCallLimitMiddleware | 模型调用次数限制 |
| ToolCallLimitMiddleware | 工具调用次数限制 |
| ModelFallbackMiddleware | 模型降级（备用模型） |
| LLMToolSelectorMiddleware | 智能工具筛选 |
| ToolRetryMiddleware | 工具重试（指数退避） |
| ModelRetryMiddleware | 模型重试 |
| LLMToolEmulatorMiddleware | 工具模拟器（开发测试） |
| ContextEditingMiddleware | 上下文编辑/裁剪 |
| FilesystemFileSearchMiddleware | 本地文件搜索 |

### 8.3 工具重试策略（指数退避）
```python
ToolRetryMiddleware(
    max_retries=6,           # 最大重试次数
    backoff_factor=2,        # 退避因子（每次乘2）
    initial_delay=1,         # 初始延迟1秒
    max_delay=10,            # 最大延迟10秒
    jitter=True,             # 加入随机抖动（推荐开启）
    retry_on=(TimeoutError,), # 触发重试的异常类型
    on_failure="continue"    # 达到上限后继续执行
)
```

### 8.4 多中间件执行顺序
```
before: 1 → 2 → 3（按声明顺序）
wrap:   1 → 2 → 3（剥洋葱进入）→ 3 → 2 → 1（剥洋葱退出）
after:  3 → 2 → 1（与声明顺序相反）
```

---

## 九、Hook函数/自定义中间件（P079-P085）

### 9.1 两种定义方式
| 方式 | 优点 | 缺点 | 推荐场景 |
|------|------|------|---------|
| 装饰器 | 简洁声明式 | 复杂逻辑不直观 | 单钩子函数 |
| 类定义 | 灵活可复用 | 代码量多 | 多钩子函数/复杂配置 |

### 9.2 Node-style钩子函数
```python
# 装饰器方式
from langchain.agents import before_model, after_model

@before_model
def my_before_model(state: AgentState, runtime: Runtime):
    # 模型调用前执行
    messages = state["messages"]
    messages[-1].content += " [before_model]"
    return None  # 不修改状态

@after_model
def my_after_model(state: AgentState, runtime: Runtime):
    # 模型调用后执行
    return None
```

```python
# 类方式
from langchain.agents import AgentMiddleware

class MyMiddleware(AgentMiddleware):
    def before_model(self, state, runtime):
        return None
    
    def after_model(self, state, runtime):
        return None
    
    def before_agent(self, state, runtime):
        return None
    
    def after_agent(self, state, runtime):
        return None
```

### 9.3 can_jump_to参数
```python
@before_model(can_jump_to=["end", "tools", "model"])
def check_context_overflow(state, runtime):
    # 上下文溢出时直接结束Agent
    if token_count > limit:
        return {"jump_to": "end"}
    return None
```

### 9.4 Wrap-style钩子函数
```python
from langchain.agents import wrap_model_call

@wrap_model_call
def cache_model_call(request, handler):
    # 调用前：检查缓存
    cached = check_cache(request)
    if cached:
        return cached
    
    # 调用模型
    response = handler(request)
    
    # 调用后：保存缓存
    save_cache(request, response)
    return response
```

### 9.5 使用场景
- **重试逻辑**：模型调用失败时自动重试
- **响应缓存**：减少重复调用，降低成本
- **修改系统提示**：在请求前添加时间、位置等上下文
- **敏感词过滤**：在响应后过滤不当内容

---

## 十、记忆系统（P086-P101）

### 10.1 记忆分类
| 类型 | 作用域 | 存储位置 | 生命周期 |
|------|--------|---------|---------|
| **短期记忆** | 单个会话（thread） | 内存/数据库 | 会话期间 |
| **长期记忆** | 跨会话 | 向量数据库/内存 | 永久 |

> ⚠️ 重要：短期记忆 ≠ 内存存储，长期记忆 ≠ 数据库存储。区分标准是会话作用域。

### 10.2 上下文工程
- **动态运行时上下文**：会话内不断变化的数据 → State对象
- **跨会话上下文**：多个会话共享的数据 → Store对象
- **静态运行时上下文**：短期不变的数据 → Context对象

### 10.3 短期记忆实现

#### 基于内存（InMemorySaver）
```python
from langgraph.checkpoint.memory import InMemorySaver

# 1. 创建检查点
checkpointer = InMemorySaver()

# 2. 传入Agent
agent = create_agent(model=model, tools=[], checkpointer=checkpointer)

# 3. 调用时指定thread_id
config = {"configurable": {"thread_id": "1"}}
response1 = agent.invoke({"messages": [HumanMessage(content="我叫张三")]}, config=config)
response2 = agent.invoke({"messages": [HumanMessage(content="我叫什么")]}, config=config)
# response2 知道你叫张三
```

#### 基于PostgreSQL（生产推荐）
```python
from langgraph.checkpoint.postgres import PostgresSaver

DB_URL = "postgresql://langchain_user:abcd1234@localhost:5432/langchain_db"

with PostgresSaver.from_connection_string(DB_URL) as checkpointer:
    checkpointer.setup()  # 初始化表结构
    
    agent = create_agent(model=model, tools=[], checkpointer=checkpointer)
    # 后续调用方式同上
```

#### 两种方式对比
| 特性 | InMemorySaver | PostgresSaver |
|------|--------------|---------------|
| 持久性 | 进程结束即丢失 | 持久化存储 |
| 重启后 | 数据清空 | 数据保留 |
| 跨进程 | 不支持 | 支持 |
| 适用场景 | 开发测试 | 生产环境 |

### 10.4 消息治理策略
```python
# 消息裁剪：模型调用前，保留最近N条
@before_model
def trim_messages(state, runtime):
    messages = state["messages"]
    if len(messages) > MAX_MESSAGES:
        state["messages"] = messages[-MAX_MESSAGES:]
    return None

# 消息删除：模型调用后，删除多余消息
@after_model
def delete_old_messages(state, runtime):
    messages = state["messages"]
    if len(messages) > 5:
        to_delete = messages[:len(messages) - 5]
        for msg in to_delete:
            remove_message(msg.id)
    return None

# 消息摘要：旧消息压缩为摘要
from langchain.agents import SummarizationMiddleware
# 使用SummarizationMiddleware自动实现
```

### 10.5 长期记忆

#### 基础API
```python
from langgraph.store.memory import InMemoryStore

store = InMemoryStore()

# 写入
store.put(("users", "bob"), "profile", {"name": "Bob", "age": 25})

# 读取
item = store.get(("users", "bob"), "profile")
print(item.value)  # {"name": "Bob", "age": 25}

# 搜索
results = store.search(("users",), query="书店")  # 语义搜索
results = store.search(("users",), filter={"name": "Bob"})  # 过滤搜索
```

#### 在Agent工具中访问长期记忆
```python
from langgraph.store.postgres import PostgresStore

# 自定义State添加字段
class CustomState(AgentState):
    user_id: str  # 自定义字段

# 工具中通过runtime访问store
@tool
def save_user_info(name: str, runtime: ToolRuntime):
    """保存用户信息到长期记忆"""
    store = runtime.store
    user_id = runtime.state["user_id"]
    store.put(("users",), user_id, {"name": name})
    return "saved"

# 创建Agent时传入store
with PostgresStore.from_connection_string(DB_URL) as store:
    store.setup()
    agent = create_agent(
        model=model,
        tools=[save_user_info, get_user_info],
        store=store,
        state_schema=CustomState
    )
    
    # 调用时传入自定义字段
    agent.invoke(
        {"messages": [...], "user_id": "user-1"}
    )
```

---

## 十一、RAG（P102-P120）

### 11.1 RAG工作流程
```
文档加载 → 文档切分 → 向量化 → 存入向量库
                                    ↓
用户查询 → 查询向量化 → 相似度搜索 → 上下文增强 → LLM生成回答
```

### 11.2 文档加载器
| 加载器 | 适用格式 | 关键参数 |
|--------|---------|---------|
| TextLoader | .txt | encoding |
| CSVLoader | .csv | csv_args |
| JSONLoader | .json | jq_schema |
| PyPDFLoader | .pdf | - |
| MinerU | 复杂PDF（表格/图片） | - |

```python
# TextLoader
from langchain_community.document_loaders import TextLoader
loader = TextLoader("knowledge.txt", encoding="utf-8")
docs = loader.load()

# CSVLoader
from langchain_community.document_loaders import CSVLoader
loader = CSVLoader("data.csv", csv_args={"delimiter": ","})
docs = loader.load()

# JSONLoader（使用jq解析）
from langchain_community.document_loaders import JSONLoader
loader = JSONLoader(
    "data.json",
    jq_schema=".[]",  # 提取所有元素
    text_content=False
)
docs = loader.load()
```

### 11.3 切分策略
| 切分器 | 特点 | 推荐度 |
|--------|------|--------|
| **RecursiveCharacterTextSplitter** | 递归按分隔符切分 | ⭐⭐⭐⭐⭐ |
| CharacterTextSplitter | 按字符数切分 | ⭐⭐⭐ |
| MarkdownHeaderTextSplitter | 按Markdown标题切分 | ⭐⭐⭐ |
| TokenTextSplitter | 按Token数切分 | ⭐⭐⭐ |

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,      # 每个切片最大字符数
    chunk_overlap=50,    # 切片间重叠字符数
    separators=["\n\n", "\n", "。", "！", "？", "，", " "]
)

# 三个核心方法
chunks = splitter.split_text(text)           # 切分文本
chunks = splitter.split_documents(docs)      # 切分文档
docs = splitter.create_documents([text])     # 从文本创建文档
```

### 11.4 嵌入模型
```python
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",  # 1536维
    # model="text-embedding-3-large", # 3072维
)

# 文档向量化
vectors = embeddings.embed_documents(["文档1", "文档2"])

# 查询向量化
query_vector = embeddings.embed_query("查询内容")
```

### 11.5 向量数据库：Milvus
```bash
# Docker安装
docker pull milvusdb/milvus:latest
docker run -d --name milvus \
  -p 19530:19530 \
  -p 9091:9091 \
  milvusdb/milvus:latest
```

```python
from langchain_milvus import Milvus

# 连接Milvus
vectorstore = Milvus(
    embedding_function=embeddings,
    collection_name="langchain_demo",
    connection_args={"host": "localhost", "port": 19530}
)

# 写入文档
vectorstore.add_documents(documents=docs)

# 相似度搜索
results = vectorstore.similarity_search("查询内容", k=5)
```

### 11.6 Milvus数据库操作
```python
from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType

# DDL操作
connections.connect("default", host="localhost", port="19530")

# 创建集合
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
    FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=2000),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1536)
]
schema = CollectionSchema(fields, description="LangChain文档")
collection = Collection("langchain_docs", schema)

# DML操作
collection.insert([texts, embeddings])

# DQL操作
collection.load()
results = collection.search(
    data=[query_embedding],
    anns_field="embedding",
    param={"metric_type": "L2", "params": {"nprobe": 10}},
    limit=5
)
```

### 11.7 完整代码示例：RAG 全链路

#### 第一步：文档加载（TextLoader + CSVLoader + JSONLoader + PDFLoader）
```python
import os
from dotenv import load_dotenv
from langchain_community.document_loaders import TextLoader, CSVLoader, JSONLoader
from langchain_community.document_loaders import PyPDFLoader

load_dotenv(override=True)

# --- 1. TextLoader：加载 .txt 文件 ---
loader = TextLoader("knowledge.txt", encoding="utf-8")
docs = loader.load()
print(f"加载了 {len(docs)} 个文档片段")
print(f"第一个片段前100字: {docs[0].page_content[:100]}")

# --- 2. CSVLoader：加载 .csv 文件 ---
loader = CSVLoader("data.csv", csv_args={"delimiter": ","})
docs = loader.load()
print(f"加载了 {len(docs)} 行数据")

# --- 3. JSONLoader：加载 .json 文件（需要 jq 库）---
loader = JSONLoader(
    "data.json",
    jq_schema=".[]",          # 提取所有元素
    text_content=False         # 提取的不是纯字符串时设为 False
)
docs = loader.load()
print(f"加载了 {len(docs)} 个文档片段")

# --- 4. PyPDFLoader：加载 PDF 文件 ---
loader = PyPDFLoader("document.pdf")
docs = loader.load()
print(f"加载了 {len(docs)} 页PDF内容")

# 查看每个文档的元数据
for doc in docs[:3]:
    print(f"来源: {doc.metadata.get('source', 'N/A')}")
    print(f"内容: {doc.page_content[:80]}...")
    print()
```

#### 第二步：文档切分（RecursiveCharacterTextSplitter，最常用）
```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

# 初始化切分器
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,       # 每个切片最大字符数
    chunk_overlap=50,     # 切片间重叠字符数（保证语义连续性）
    separators=[          # 递归切分的分隔符优先级
        "\n\n",           # 1. 先按段落切
        "\n",             # 2. 再按换行切
        "。", "！", "？",  # 3. 再按中文标点切
        "，", " ",        # 4. 最后按逗号和空格切
    ]
)

# 三个核心方法
# 方法1：切分字符串 → 返回字符串列表
text = "LangChain是一个大模型应用开发框架。\n\n它支持多种模型。\n\n包括GPT、Claude等。"
chunks = splitter.split_text(text)
for i, chunk in enumerate(chunks):
    print(f"片段{i+1} ({len(chunk)}字): {chunk}")
    print("---")

# 方法2：切分文档列表 → 返回 Document 列表
docs = loader.load()
chunks = splitter.split_documents(docs)
print(f"切分前: {len(docs)} 个文档 → 切分后: {len(chunks)} 个片段")

# 方法3：从文本创建文档 → 返回 Document 列表
docs = splitter.create_documents([text])
print(f"创建了 {len(docs)} 个文档对象")
```

#### 第三步：文档向量化（Embedding）
```python
from langchain_openai import OpenAIEmbeddings
from langchain.chat_models import init_chat_model

# 初始化嵌入模型（推荐 init_embeddings 或直接 OpenAIEmbeddings）
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",  # 1536维，性价比高
    # model="text-embedding-3-large",  # 3072维，更精细但更贵
)

# 或使用 init_embeddings（LangChain 1.x 统一方式）
# from langchain.chat_models import init_embeddings
# embeddings = init_embeddings(
#     model="text-embedding-3-small",
#     model_provider="OpenAI"
# )

# 文档向量化：将切分后的 chunk 转为向量
chunks = splitter.split_documents(docs)
vectors = embeddings.embed_documents([doc.page_content for doc in chunks])
print(f"向量化了 {len(vectors)} 个片段，每个向量维度: {len(vectors[0])}")

# 查询向量化：将用户问题转为向量
query_vector = embeddings.embed_query("什么是LangChain？")
print(f"查询向量维度: {len(query_vector)}")
```

#### 第四步：存入向量数据库（Milvus）
```python
from langchain_milvus import Milvus

# 连接 Milvus 并创建集合（首次）
vectorstore = Milvus(
    embedding_function=embeddings,
    collection_name="langchain_docs",
    connection_args={"host": "localhost", "port": 19530},
    # 自动创建集合（如果不存在）
    auto_id=True,
    index_params={"metric_type": "COSINE", "index_type": "FLAT", "params": {}}
)

# 写入文档（自动向量化 + 存储）
vectorstore.add_documents(documents=chunks)
print(f"已存入 {len(chunks)} 个文档片段到 Milvus")

# 如果已有向量库，直接连接
# vectorstore = Milvus(
#     embedding_function=embeddings,
#     collection_name="langchain_docs",
#     connection_args={"host": "localhost", "port": 19530}
# )
```

#### 第五步：检索（相似度搜索 + 带评分的检索）
```python
# 基础相似度检索
results = vectorstore.similarity_search("LangChain是什么", k=3)
print("=== 相似度搜索结果 ===")
for i, doc in enumerate(results):
    print(f"结果{i+1} (来源: {doc.metadata.get('source', 'N/A')}):")
    print(f"  {doc.page_content[:100]}...")
    print()

# 带评分的检索（返回相似度分数）
results_with_score = vectorstore.similarity_search_with_score("LangChain是什么", k=3)
print("=== 带评分的检索结果 ===")
for doc, score in results_with_score:
    print(f"相似度分数: {score:.4f}")
    print(f"  {doc.page_content[:80]}...")
    print()

# 高级检索：过滤特定来源
results = vectorstore.similarity_search(
    "工具调用",
    k=3,
    filter={"source": "knowledge.txt"}  # 只从特定文件检索
)
```

#### 第六步：完整RAG链（检索 + 上下文增强 + 生成）
```python
from langchain.chat_models import init_chat_model
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

# 1. 初始化LLM
llm = init_chat_model(model="deepseek-v4-flash", model_provider="DeepSeek")

# 2. 创建检索器
retriever = vectorstore.as_retriever(
    search_type="similarity",  # 相似度检索
    search_kwargs={"k": 3}     # 返回最相关的3个片段
)

# 3. 创建提示词模板（RAG专用）
RAG_PROMPT = """你是一个专业的知识助手。请根据以下上下文信息回答用户的问题。
如果上下文中没有相关信息，请坦诚说"我没有找到相关信息"，不要编造答案。

上下文信息：
{context}

用户问题：{question}

请给出准确、有条理的回答："""

prompt = ChatPromptTemplate.from_template(RAG_PROMPT)

# 4. 格式化检索结果为上下文
def format_docs(docs):
    """将检索到的文档格式化为上下文字符串"""
    formatted = []
    for i, doc in enumerate(docs):
        source = doc.metadata.get("source", "未知来源")
        formatted.append(f"[文档{i+1}] (来源: {source})\n{doc.page_content}")
    return "\n\n".join(formatted)

# 5. 构建RAG链（使用 LCEL 管道语法）
rag_chain = (
    {
        "context": retriever | format_docs,  # 检索 + 格式化
        "question": RunnablePassthrough()     # 直接传递用户问题
    }
    | prompt      # 填充提示词
    | llm         # 调用大模型
    | StrOutputParser()  # 提取字符串输出
)

# 6. 使用RAG链
answer = rag_chain.invoke("LangChain是什么？它有哪些核心功能？")
print("=== RAG回答 ===")
print(answer)

# 带流式输出的RAG
print("=== 流式RAG回答 ===")
for chunk in rag_chain.stream("LangChain的工具调用是怎么工作的？"):
    print(chunk, end="", flush=True)
print()
```

#### 第七步：封装为Agent工具（RAG作为知识库检索工具）
```python
from langchain.agents import create_agent
from langchain_core.tools import tool

# 将RAG检索封装为工具
@tool(description="从知识库中检索相关信息，回答关于LangChain的问题")
def knowledge_base_search(query: str) -> str:
    """检索知识库获取相关信息。

    Args:
        query: 用户的查询问题
    """
    # 检索相关文档
    docs = retriever.invoke(query)
    context = format_docs(docs)
    
    # 使用LLM基于上下文生成回答
    response = llm.invoke(
        f"根据以下上下文回答问题：\n\n{context}\n\n问题：{query}"
    )
    return response.content

# 创建带知识库的Agent
knowledge_agent = create_agent(
    model="deepseek-v4-flash",
    model_provider="DeepSeek",
    tools=[knowledge_base_search, get_weather],
    system_prompt="你是一个智能助手，可以查询知识库和天气。回答要准确。"
)

# 调用
response = knowledge_agent.invoke({
    "messages": [HumanMessage(content="LangChain的RAG是怎么工作的？")]
})
for msg in reversed(response["messages"]):
    if isinstance(msg, AIMessage) and msg.content:
        print(f"Agent回复: {msg.content}")
        break
```

---

## 十二、项目实战

### 12.1 项目一：多功能智能助手（P063）
- **核心技术**：Agent + 多工具协作
- **功能**：天气查询、数学计算、时间查询、货币转换、信息搜索
- **对应章节**：第七章Agent

### 12.2 项目二：RAG知识库问答（P102-P116）
- **核心技术**：文档加载 + 切分 + 向量化 + 检索
- **流程**：
  1. 加载不同格式文档
  2. 切分为小chunk
  3. 嵌入向量化
  4. 存入Milvus
  5. 查询时检索相似内容
  6. 上下文增强后回答

### 12.3 项目三：客服知识库系统（P117-P120）
- **全流程实战**：配置 → 文档 → Agent → 生成
- **技术栈**：Milvus + Agent + 工具检索
- **步骤**：
  1. 全局配置：初始化Milvus连接
  2. 文档处理：切分 → 向量化 → 写入Milvus
  3. Agent初始化：绑定检索工具
  4. 检索与生成：检索函数 → 上下文增强 → 回答生成

---

## 十三、关键概念速查

| 概念 | 一句话解释 |
|------|-----------|
| LangChain | 大模型应用开发框架 |
| LangGraph | 基于状态图的Agent执行引擎 |
| LangSmith | 调试、监控、评估平台 |
| DeepAgent | 复杂多智能体协作框架 |
| Agent | LLM + 工具 + 循环的智能体 |
| Tool | 模型可调用的外部函数 |
| RAG | 检索增强生成，让LLM引用外部知识 |
| Middleware | Agent执行链路上的拦截器 |
| Hook | Agent关键节点的自定义逻辑 |
| Memory | 对话历史和长期记忆管理 |
| Structured Output | 模型输出的结构化约束 |
| Embedding | 文本向量化，用于语义搜索 |
| Vector Store | 向量数据库，存储文档嵌入 |
| Checkpointer | 短期记忆的检查点/快照 |
| Store | 长期记忆的存储对象 |
| Thread ID | 会话线程标识，区分不同会话 |
| Temperature | 控制输出随机性（0.0-2.0） |
| Token | 基本语义单位，也是计费单位 |
| ReAct | 推理+行动的Agent执行模式 |

---

## 十四、版本演进

| 版本 | 时间 | 特点 |
|------|------|------|
| 0.3 | 2025上半年前 | API频繁废弃，"版本碎钞机" |
| 1.0 | 2025下半年 | 重大重构，引入中间件、结构化输出 |
| 1.2 | 当前版本 | 稳定版，推荐使用 |

### 1.0重要新特性
- ✅ 结构化输出（Pydantic/TypedDict/JSON Schema/@dataclass）
- ✅ 16个内置中间件
- ✅ Hook函数（自定义中间件）
- ✅ Agent结构化输出（4种策略）
- ✅ 流式输出模式（7种）
- ✅ 短期记忆与长期记忆
- ✅ init_chat_model统一初始化
- ✅ LangSmith深度集成

---

## 十五、学习路线建议

### 第一阶段：基础（P001-P040）
1. 了解LangChain四大支柱
2. 搭建开发环境
3. 掌握模型调用（推荐init_chat_model）
4. 理解消息系统和提示词模板
5. 学会工具定义和调用

### 第二阶段：进阶（P041-P085）
6. 掌握结构化输出（首选Pydantic）
7. 构建Agent（create_agent）
8. 使用中间件增强Agent能力
9. 编写自定义Hook函数

### 第三阶段：实战（P086-P120）
10. 实现短期记忆（InMemorySaver/PostgresSaver）
11. 实现长期记忆（Store）
12. 构建RAG知识库
13. 完成三大项目实战

### Java开发者特别提示
- LangChain是Python/JS框架，但设计模式通用
- Agent = LLM + Tools + Loop 的理念适用于任何语言
- LangGraph的状态图思想与工作流引擎相似
- RAG的文档加载→切分→向量化→检索流程是通用的
- 可参考Java生态的LangChain4j框架
