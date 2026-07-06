---
title: "从司机变乘客：这就是 Agent 编程的范式革命"
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
summary: "从司机变乘客：这就是 Agent 编程的范式革命"
tags:
---

# 从司机变乘客：这就是 Agent 编程的范式革命

> 来源：微信公众号「IchbinDerek」
> 系列：从零开始写 Agent（1/11）
> 链接：http://mp.weixin.qq.com/s?__biz=MzA4NDI2NzgwNQ==&mid=2454801126&idx=1&sn=10d5081208d3feaf9d3c95b00fda368e&chksm=884c2c94bf3ba5828f9b5cc1a837a71332790d715da46bb106e48b65b02e4fdf870fe9b658b8#rd

---

以前写程序，脑子里想的都是，这个数据从哪来，经过哪些处理，存到哪里去，if-else 怎么写，循环怎么绕。

现在呢，我就是把东西甩给模型，它自己决定下一步该干嘛。

我给你看一段最简单的代码，只有几十行。

from

 openai

 import

 OpenAI

import

 os

import

 json

from

 dotenv

 import

 load_dotenv

load_dotenv()

NVIDIA_API_KEY = os.environ.get(

"NVIDIA_API_KEY"

)

NVIDIA_MODEL_NAME = os.environ.get(

"NVIDIA_MODEL_NAME"

)

client = OpenAI(

    base_url=

"https://integrate.api.nvidia.com/v1"

,

    api_key=NVIDIA_API_KEY

)

try

:

    response = client.chat.completions.create(

        model=NVIDIA_MODEL_NAME,

        messages=[

            {

"role"

:

 "user"

,

 "content"

:

 "你好"

}

        ],

    )

    print

(

"\n✅ 模型响应成功！"

)

    print

(response)

    print

(

"="

*

50

)

    # 获取响应内容

    message = response.choices[

0

].message

    content = message.content

 if

 message.content

 else

 "(无文本响应)"

    print

(

f"\n📝 模型回复：

{content}

"

)

except

 Exception

 as

 e:

    print

(

f"Error:

 {e}

"

)

    exit(

1

)

运行一下，你会看到这样的输出。

📝 模型回复：你好！很高兴见到你。有什么我可以帮助你的吗？

就这么简单。

一个巨大的变化

不就是调个 API 嘛, 单看这段代码，可能没什么感觉

但仔细想想，这里面藏着一个巨大的变化。

以前我们写程序的公式是这样的。

程序 = 数据 + 控制逻辑 + 业务逻辑

我们要想清楚数据结构，要设计控制流，要写业务规则，每一步都得自己安排得明明白白。

现在呢，我们只需要想清楚一件事，怎么调用模型。

剩下的控制逻辑，模型自己会决定。

你想想这意味着什么。

你不用再操心 if-else 怎么分支了，不用再想循环什么时候终止了，不用再设计复杂的状态机了。

你只需要告诉模型你想要什么，它会自己把路走通。

从司机到乘客

这不是简化了编程，这是换了一个维度在编程。

以前你是司机，要自己握方向盘踩油门看路。

现在你是乘客，告诉司机去哪，剩下的交给他。

说真的，这种感觉挺奇妙的。

一开始会有点不适应，总觉得心里不踏实，好像控制权交出去了。

但是用多了就会发现，这种不踏实感，其实是对新范式的恐惧。

一旦你习惯了把控制权交出去

你不用再纠结那些琐碎的实现细节，你可以把精力放在更重要的事情上，比如你到底想要什么。

当然，不是说传统编程就没用了，不是的。

模型也不是万能的，该写的代码还是要写，该做的工程化还是要做。

但是核心逻辑变了。

以前是你告诉计算机每一步该怎么走。

现在是你告诉计算机你想去哪。

这就是这个系列的第一篇，最简单的模型调用逻辑。

就从这几十行代码开始，我们一起看看，Agent 到底是怎么写出来的。
