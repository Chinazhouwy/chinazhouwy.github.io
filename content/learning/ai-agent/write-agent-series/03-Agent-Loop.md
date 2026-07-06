---
title: "从零开始写 Agent(三) - Agent Loop"
date: "2026-07-06"
domain: "学习"
area: "技术"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "从零开始写 Agent(三) - Agent Loop"
tags:
---

# 从零开始写 Agent(三) - Agent Loop

> 来源：微信公众号「IchbinDerek」
> 系列：从零开始写 Agent（3/11）
> 链接：http://mp.weixin.qq.com/s?__biz=MzA4NDI2NzgwNQ==&mid=2454801136&idx=1&sn=bb8118537fe207ad3d40c0d4fb7f66af&chksm=884c2c82bf3ba594bb960f17d2df90731f7a5a9e5562a16bcea52c051ebdd4dec6da8524275c#rd

---

从零开始写 Agent(三) - Agent Loop

上一篇我们聊了如何让模型调用工具。

但你要想让 Agent 能帮你完成更复杂的事儿，光会调用一次工具还不够。你得给它一个循环，让它能持续调用模型，直到任务真正完成。

你看市面上那些 Agent，像龙虾、Hermes 这些，内部逻辑其实都差不多。

说多了没用，还是直接看代码吧。

iteration =

 0

max_iterations =

 5

while

 iteration < max_iterations:

    iteration +=

 1

    print

(

f"\n📤 第

 {iteration}

 轮对话..."

)

    

    try

:

        # 调用模型（带重试）

        response = call_model_with_retry(messages, tools,

 "auto"

)

    except

 Exception

 as

 e:

        print

(

f"\n❌ 模型调用失败：

{

str

(e)}

"

)

        continue

    message = response.choices[

0

].message

    finish_reason = response.choices[

0

].finish_reason

    # 情况 1: 模型直接给出答案

    if

 finish_reason ==

 &#x27;stop&#x27;

:

        content = message.content

 if

 message.content

 else

 "(无响应)"

        print

(

f"\n✅ AI 最终回答："

)

        print

(

f"

   {content}

"

)

        return

 content

    

    # 情况 2: 模型要求调用工具

    elif

 finish_reason ==

 &#x27;tool_calls&#x27;

 and

 message.tool_calls:

        tool_count =

 len

(message.tool_calls)

        print

(

f"\n🛠️  AI 决定调用

 {tool_count}

 个工具"

)

        

        # 添加 assistant 消息到历史

        # 这部分放在 上下文工程 再讲

    

        # 顺序执行所有工具调用

        result = execute_tool(tool_call)

就这么点代码，不到 20 行，就是 Agent Loop 循环的核心。

看到这儿，你应该能感受到我在第一篇文章里说的那种新编程范式的不同了吧。

对，面向智能编程范式。

以前写程序，你得把每一步控制逻辑都想清楚，都安排好。

现在不需要了。你只需要想清楚你要完成什么任务。

控制逻辑？模型自己决定。

举个例子。

假设我想要一个智能旅游规划 Agent。

基于这个循环，我给模型提供三个工具。

tools = [

    {

        "type"

:

 "function"

,

        "function"

: {

            "name"

:

 "get_weather"

,

            "description"

:

 "查询指定城市的实时天气情况，包括温度、天气状况等"

,

            "parameters"

: {

                "type"

:

 "object"

,

                "properties"

: {

                    "city"

: {

                        "type"

:

 "string"

,

                        "description"

:

 "要查询天气的城市名称，如北京、上海等"

                    }

                },

                "required"

: [

"city"

]

            }

        }

    },

    {

        "type"

:

 "function"

,

        "function"

: {

            "name"

:

 "recommend_places"

,

            "description"

:

 "推荐指定城市的热门旅游景点和必去打卡地"

,

            "parameters"

: {

                "type"

:

 "object"

,

                "properties"

: {

                    "city"

: {

                        "type"

:

 "string"

,

                        "description"

:

 "要推荐景点的城市名称"

                    }

                },

                "required"

: [

"city"

]

            }

        }

    },

    {

        "type"

:

 "function"

,

        "function"

: {

            "name"

:

 "calculate_budget"

,

            "description"

:

 "计算指定天数和城市的旅行预算"

,

            "parameters"

: {

                "type"

:

 "object"

,

                "properties"

: {

                    "days"

: {

                        "type"

:

 "integer"

,

                        "description"

:

 "旅行天数"

                    },

                    "city"

: {

                        "type"

:

 "string"

,

                        "description"

:

 "目的地城市"

                    }

                },

                "required"

: [

"days"

,

 "city"

]

            }

        }

    }

]

现在我们就可以让这个 Agent 帮我们规划行程了。

======================================================================

👤 用户：我计划去成都玩 3 天，帮我规划一下，包括天气、景点推荐和预算

----------------------------------------------------------------------

📤 第 1 轮对话...

🛠️  AI 决定调用 3 个工具

   📊 累计：5 次工具调用，2 次并行，0 次错误

📤 第 2 轮对话...

✅ AI 最终回答：

   好的，这是为您规划的成都 3 日游：

**天气情况**

- 当前成都天气为阴天，温度舒适宜人，约 20°C。

**推荐景点**

- 大熊猫基地：近距离观看国宝大熊猫

- 宽窄巷子：体验成都老城文化与美食

- 锦里：古色古香的商业街，适合购物和小吃

- 武侯祠：了解三国文化

- 都江堰：世界文化遗产，古代水利工程

**旅行预算**

- 总预算：约 1500 元

- 日均消费：约 500 元（含食宿交通）

建议您安排参观大熊猫基地时选择上午，因为熊猫通常在上午比较活跃。都江堰距离市区较远，建议安排一天专门前往。宽窄巷子和锦里可以安排在同一天游览，体验成都的市井文化。希望您在成都玩得愉快！

📊 本次会话：3 次工具调用，2 轮迭代

要是放在以前，要实现这么一个旅行规划助手，得是个多复杂的程序啊。

得写天气查询模块、景点推荐模块、预算计算模块，还得把它们串起来，控制好流程，处理各种异常情况。

现在好了，你只需要把工具给它，然后说一声"我要去成都玩 3 天，帮我规划一下"。

剩下的，模型自己来。

从零开始写 Agent 的第三篇就聊到这里。

下一篇文章，我会跟你聊怎么让我们的 Agent 做更复杂的任务---让我们的 Agent 会读财报写研报
