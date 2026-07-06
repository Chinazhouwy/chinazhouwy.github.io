---
title: "Embabel：Spring 之父打造的 Java AI Agent 框架"
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
summary: "Embabel：Spring 之父打造的 Java AI Agent 框架"
tags:
---

类型：📚 参考资料（非面试题/面经）

# Embabel：Spring 之父打造的 Java AI Agent 框架

> 来源：微信公众号文章
> 原始链接：https://mp.weixin.qq.com/s/bdNkd_xSkMfQlhJ2619PUg

---

## 背景

最近被 InfoQ 推送了一篇关于 Java Agent 框架 Embabel 的文章。这个框架是 Spring 之父 Rod Johnson 主导开发的，旨在解决当前 Agent 框架在企业实际业务中的不确定性问题。

## 核心问题：谁来负责规划？

### 主流框架的做法

大多数 LLM Agent 框架的思路：
1. 把目标和可用工具告诉 LLM
2. 让 LLM 生成执行计划
3. 按计划执行，遇到问题再让 LLM 重新规划

**根本问题**：规划由 LLM 完成，而 LLM 本质是概率采样，不是逻辑推理。同样的任务可能今天生成 A 方案，明天生成 B 方案。在企业环境中，这种不确定性是定时炸弹。

### Embabel 的解法：让传统 AI 算法来规划

Embabel 把"规划"从 LLM 手里拿走，交给了经典的 AI 规划算法——**GOAP（目标导向行动规划，Goal-Oriented Action Planning）**。

这类算法在状态空间里搜索路径：
- 给定一个目标状态
- 反向推理：要达到这个目标，需要哪些前置条件？
- 这些前置条件又依赖哪些动作来满足？
- 一直推到系统的初始状态

### 与 Java 类型系统的结合

Embabel 的聪明之处在于把这个算法和 Java 的类型系统结合在一起：
- **每个 @Action 方法的参数类型** = 前置条件
- **返回值类型** = 后置效应
- 框架启动时扫描所有动作，构建依赖图
- 运行时根据依赖图动态搜索执行路径

## 官方示例：星座新闻 Agent

```java
@Agent(description = "Find news based on a person's star sign")
public class StarNewsFinder {

    @Action
    public StarPerson extractStarPerson(UserInput userInput, OperationContext context) {
        return context.ai()
            .withLlm(OpenAiModels.GPT_41)
            .createObject("从用户输入中提取名字和星座: " + userInput.getContent(), StarPerson.class);
    }

    @Action
    public Horoscope retrieveHoroscope(StarPerson starPerson) {
        // 普通 Spring 服务，不调 LLM
        return new Horoscope(horoscopeService.dailyHoroscope(starPerson.sign()));
    }

    @Action
    public RelevantNewsStories findNewsStories(
            StarPerson person, Horoscope horoscope, OperationContext context) {
        // 用 LLM + 网络搜索工具
        return context.ai().withDefaultLlm()
            .withToolGroup(CoreToolGroups.WEB)
            .createObject(buildPrompt(person, horoscope), RelevantNewsStories.class);
    }

    @AchievesGoal(description = "Write an amusing writeup based on horoscope and news")
    @Action
    public Writeup writeup(
            StarPerson person, RelevantNewsStories stories, 
            Horoscope horoscope, OperationContext context) {
        // 最终目标动作
        return context.ai().withLlm(llmOptions).createObject(finalPrompt, Writeup.class);
    }
}
```

**关键点**：`retrieveHoroscope` 调用的是普通 Spring 服务，完全不涉及 LLM，但在框架眼里和其他 LLM 动作没有区别，都是"输入 StarPerson，输出 Horoscope"的动作节点。这就是"混合"的含义。

## 规划器的推理过程

```
目标：生成 Writeup
  └─ 需要 writeup() 动作
      ├─ 需要 StarPerson
      │   └─ extractStarPerson() → 需要 UserInput（用户提供）
      ├─ 需要 Horoscope
      │   └─ retrieveHoroscope() → 需要 StarPerson（已可得）
      └─ 需要 RelevantNewsStories
          └─ findNewsStories() → 需要 StarPerson + Horoscope（均可得）

执行顺序：
UserInput → extractStarPerson → StarPerson
                                    ↓
                              retrieveHoroscope → Horoscope
                                                    ↓
                                           findNewsStories → RelevantNewsStories
                                                               ↓
                                                        writeup → Writeup ✓
```

这个计划是框架自动推导的，不需要开发者手动定义工作流，不需要像 LangGraph 那样定义条件边，也不需要 LLM 来"想"下一步做什么。

## 方法名无关，类型才是契约

**重要细节**：规划器压根不读方法名，只看三件事：
1. 参数类型（前置条件）
2. 返回值类型（后置效应）
3. 注解（如 @AchievesGoal 标记终点）

**意味着**：代码重构非常友好——可以随意改方法名、提取子类、重新组织包结构。只要类型签名不变，Agent 的行为就不会变。

## 适用场景

### ✅ 非常适合
- 流程相对清晰、步骤可以预先建模的企业场景
- 对可靠性、可测试性、可审计性要求高的环境
- 已有大量 Spring 代码需要和 AI 能力结合的项目
- 需要混用 LLM 和传统业务逻辑的场景

### ❌ 不太适合
- 完全开放式的探索任务（如"自主研究某个陌生领域"）
- 输出类型在运行前完全未知的任务
- 需要 Agent 自己决定"下一步要做什么新动作"的场景

## 设计哲学

> **LLM 负责"怎么做"，算法负责"做什么"**

- 动作内部：LLM 自由发挥，生成文本、调用工具、进行创意输出
- 动作外部：整个流程的调度是确定性的、可预测的、可测试的

## 总结

Embabel 没有去复制 Python 框架那套"让 LLM 全权决策"的路子，而是思考：在一个企业环境里，AI Agent 需要的到底是什么。

**核心优势**：类型安全、Spring 集成、确定性规划、混合 LLM 调用

**本质定位**：已知步骤的可靠组合，而不是自主探索未知。

如果你需要的是"已知步骤的可靠组合"，Embabel 是目前 Java 生态里设计最清晰的选择之一。

---

**标签**：#AI-Agent #Java #Embabel #GOAP #Spring #规划算法 #企业级
