---
title: "LangGraph 记忆：线程内、跨线程记忆与裁剪总结"
date: 2026-10-02
domain: "学习"
area: "AI Agent"
module: "Agent 工程与源码"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
lane: agent
summary: "第二章梳理 LangGraph 的记忆机制：从无记忆多轮对话的问题出发，用绑定 thread_id 的线程内记忆与按 user_id 隔离的跨线程记忆解决，并以 trim_messages 裁剪与总结链压缩历史消息来管理上下文。"
tags:
  - LangGraph
  - 记忆机制
  - Agent
  - 多轮对话
  - Checkpointer
  - 上下文管理
source: "微信公众号「Stellula」"
source_url: "https://mp.weixin.qq.com/s?__biz=MzY4MTQxOTkyMQ==&mid=2247484070&idx=1&sn=fee4c1e4ef862c87446183fcff26088b&chksm=f350b758c4273e4e7613d98f51f6cd69343782ebb036a0fb809c7ab4a3116e34d6afb6c50c29"
published_at: "2026-10-02 17:36:02 +08:00"
---

# LangGraph 记忆：线程内、跨线程记忆与裁剪总结

> 来源：微信公众号「Stellula」
> 发布时间：2026-10-02 17:36（北京时间）
> 原文链接：<https://mp.weixin.qq.com/s?__biz=MzY4MTQxOTkyMQ==&mid=2247484070&idx=1&sn=fee4c1e4ef862c87446183fcff26088b&chksm=f350b758c4273e4e7613d98f51f6cd69343782ebb036a0fb809c7ab4a3116e34d6afb6c50c29>
> 配图：16 张原图按原文顺序保留在配套目录（未做逐图转写）。

[ 第二章 | 记忆 ]

## 01 多轮对话（无记忆）

在最简单的多轮对话中，大模型本身并不会自动记住上一轮对话，每次调用模型时，只会传入当前消息，因此前后对话是相互独立的。

无记忆多轮对话的示例及运行结果如下：

![原文配图 01](./2026-10-02-langgraph-memory-images/01.png)

![原文配图 02](./2026-10-02-langgraph-memory-images/02.png)

示例中，第一次告知姓名，第二次询问姓名，大模型无法仅凭第二次请求知道"王小明"是谁。虽然代码中有 while 循环，但其只用于实现连续输入，并不会给模型添加记忆。

关于代码的几点说明：

add_messages 为归约器，LangGraph 会自动调用内部解析器，将含有 "role": "user" 的字典转换为 HumanMessage 对象。

通过 add_messages 可将新的消息追加到列表中，但由于这些历史消息列表并没有再次传递给模型，故该多轮对话本身并没有记忆。

![原文配图 03](./2026-10-02-langgraph-memory-images/03.png)

## 02 多轮对话（有记忆）

要让大模型在多轮对话中具备记忆能力，需在对话时，将历史消息传递给模型。常见记忆方式分为：线程内记忆和跨线程记忆。

### 2.1 线程内记忆

线程内记忆：在 LangGraph 的运行架构中，将 state 与特定的线程 ID（thread_id）绑定并实现持久化。

调用大模型时，可以通过 MessagesPlaceholder 将历史消息插入提示词，与当前问题一起发送给模型。这样，模型就能拥有此前对话的信息，并根据这些信息回答当前问题。

线程内记忆的多轮对话示例及运行结果如下：

![原文配图 04](./2026-10-02-langgraph-memory-images/04.png)

![原文配图 05](./2026-10-02-langgraph-memory-images/05.png)

示例中，第一次对话告知姓名，第二次对话询问姓名，由于两次调用相同的 thread_id，同一线程内消息共享，因此模型可以从历史上下文中找到答案。

关于代码的几点说明：

创建模板，使用 MessagesPlaceholder 接收历史消息时，建议传入整个 BaseMessage 对象列表。若传入的是字符串列表，LangChain 会自动将每个字符串转成 HumanMessage 对象，虽能正常运行，但并不能减少 token 消耗，且可能降低回答的准确度，故不推荐。

MemorySaver 是 LangGraph 提供的检查点保存器（Checkpointer），使用后，state 会被保存在 Python 进程的内存中。

由于 state 的内容是与 thread_id 绑定的，故执行图时，必须配置 config 参数。

### 2.2 跨线程记忆

跨线程记忆：大模型系统突破单次对话窗口的限制，在不同的会话之间共享、传递、长期保留。

调用模型时，使用 MemorySaver 保存基于 thread_id 的线程内信息，使用 InMemoryStore 保存基于 user_id 的跨线程信息，从而实现线程内和跨线程的记忆。

跨线程记忆的多轮对话示例及运行结果如下：

![原文配图 06](./2026-10-02-langgraph-memory-images/06.png)

![原文配图 07](./2026-10-02-langgraph-memory-images/07.png)

![原文配图 08](./2026-10-02-langgraph-memory-images/08.jpeg)

示例中，在 user_id=1、thread_id=1 时要求记住姓名，之后即使切换到 thread_id=2，只要 user_id 不变，大模型就能基于从向量库中检索到的相关信息，实现带记忆的回答。

关于代码的几点说明：

在 LangGraph 中，("memories", user_id) 是用于定位和隔离数据的 Namespace，本质为一个由字符串构成的元组，代表跨线程的向量存储库中，数据存储和检索的具体层级路径。

str(uuid.uuid4()) 可以生成一个全局唯一的字符串标识符（UUID），用于在数据库或存储器中作为每条记录的唯一主键（Key）。

## 03 记忆管理

所谓让大模型有"记忆"，本质上是将历史消息重新发给大模型，作为其回答的参考依据。

因此，随着对话不断增加，历史消息会不断占用上下文空间。为了防止历史消息突破上下文窗口，需对其进行裁剪或总结等管理操作。

### 3.1 记忆裁剪

裁剪是最简单的记忆管理方式，即只保留部分最新的历史消息，适合消息重要性随时间下降，或只需保留近期上下文的场景。

裁剪时，推荐使用官方提供的 trim_messages 作为裁剪器，其既能防止单条消息被截断，又能保护工具调用链的完整性。

带记忆裁剪的多轮对话示例及运行结果如下：

![原文配图 09](./2026-10-02-langgraph-memory-images/09.png)

![原文配图 10](./2026-10-02-langgraph-memory-images/10.png)

![原文配图 11](./2026-10-02-langgraph-memory-images/11.png)

示例中，当消息数量超过设定范围，利用 RemoveMessage 可以删除较早的消息。add_messages 会根据删除指令，从 state 中移除对应消息，从而实现记忆裁剪的效果。

关于代码的几点说明：

使用 trim_messages 时，start_on="human" 可能会触发连带删除。

在无工具调用的简单练习中，可用以下简化代码替换 filter_messages 函数。

![原文配图 12](./2026-10-02-langgraph-memory-images/12.png)

### 3.2 记忆总结

总结是先让大模型把历史消息压缩成一段摘要，再用摘要替代原有的历史消息，相比于记忆裁剪，该方法可以保留更多历史信息。

带记忆总结的多轮对话示例及运行结果如下：

![原文配图 13](./2026-10-02-langgraph-memory-images/13.png)

![原文配图 14](./2026-10-02-langgraph-memory-images/14.png)

![原文配图 15](./2026-10-02-langgraph-memory-images/15.png)

示例中，通过单独的总结链获得信息摘要，再将摘要和最新用户消息传递给模型，使其参考作答。这样既可减少上下文长度，又能保留尽可能多的对话关键信息。

在实际应用中，记忆总结可与记忆裁剪相结合，根据不同类型的消息选择合适的记忆管理策略。

END

![原文配图 16](./2026-10-02-langgraph-memory-images/16.png)

中国的命运一经操在人民自己的手里，中国就将如太阳升起在东方那样，以自己的辉煌的光焰普照大地，迅速地荡涤反动政府留下来的污泥浊水，治好战争的创伤，建设起一个崭新的强盛的名副其实的人民共和国。

——《毛泽东传》
