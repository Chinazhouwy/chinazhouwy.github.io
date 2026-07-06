---
title: "Spring Boot接入AgentScope Java 2.0后，如何实现动态路由？"
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
summary: "Spring Boot接入AgentScope Java 2.0后，如何实现动态路由？"
tags:
---

# Spring Boot接入AgentScope Java 2.0后，如何实现动态路由？

> 类型：📚 参考资料（非面试题/面经）
> 来源：微信公众号
> 原文链接：https://mp.weixin.qq.com/s/f15qm0JuxQtBGXxXoCFSDw
> 提取日期：2026-07-01

---

❝

AgentScope Java 2.0 在"动态路由"这块其实给了

两层能力

：框架自带的 

RouterService

 / 

RoutingGraphService

（配置驱动，开箱即用），以及你自己用 

AgentFactory

 + 自定义 Router Agent 拼（更灵活，SB 场景更常见）。下面按"SB + AS 2.0"这个组合拆开说。

点关注

不迷路

🧭 先理清：AS 2.0 动态路由的两种内置形态

官方 examples 里 

multiagent-patterns/routing

 给了两个 demo：

形态

入口

流程

Simple

RouterService.run(query)

分类 → 并行多个专家 Agent → 框架 merge → 可选 RouterService 合成

Graph

RoutingGraphService.run(query)

预处理 → 路由子图 → 后处理

启动开关在 

application.yml

：

routing:

  

runner:

    

enabled:

 

true

      

# 跑 Simple 演示

routing-graph:

  

runner:

    

enabled:

 

true

      

# 跑 Graph 演示

配置好 

AI_DASHSCOPE_API_KEY

（或 

spring.ai.dashscope.api-key

）就能直接 

./mvnw spring-boot:run

 跑起来。这是**最省事的"动态路由"**——分类那一步由框架内置的 Router Agent 用 LLM 判意图，决定丢给哪些专家并行跑。

🔧 SB 集成的前置坑（2.0 没 starter 了）

❝

2.0 砍掉了 

agentscope-spring-boot-starter

，原因三个：HarnessAgent.build() 不便宜（eager 初始化浪费）、多用户要靠 RuntimeContext 隔离、streamEvents() 返回 Flux 天然配 WebFlux。

所以 SB 项目里推荐 

手动 

@Configuration

 + 工厂方法 + WebFlux

，把 Agent 当"按需创建的单例"管起来：

@Component

public

class

 

AgentFactory

 

{

    

private

final

 Model model;

    

private

final

 ConcurrentHashMap<String, HarnessAgent> cache = 

new

 ConcurrentHashMap<>();

    

public

 HarnessAgent 

get

(String name)

 

{

        

return

 cache.computeIfAbsent(name, id -> 

            HarnessAgent.builder()

                .name(id)

                .model(model)

                .workspace(Path.of(

"./workspace"

))

                .build());

    }

}

🚀 落地方案 A：直接用框架的 RouterService（推荐先试这个）

如果你要的就是"用户一句话 → 自动分给不同专家 Agent"，Simple 模式基本够用，分类那步是 LLM 做的，属于

动态路由

。

@Service

public

class

 

RoutingService

 

{

    

private

final

 RouterService routerService;

    

public

 

RoutingService

(AgentFactory factory)

 

{

        

// expert 们从工厂拿

        

var

 weather = factory.get(

"weather"

);

        

var

 logistics = factory.get(

"logistics"

);

        

this

.routerService = RouterService.builder()

                .experts(List.of(weather, logistics))

                .build();

    }

    

public

 Flux<AgentEvent> 

handle

(String query, RuntimeContext ctx)

 

{

        

return

 Mono.fromFuture(

            routerService.run(query, ctx).toFuture()

        ).flatMapMany(flux -> flux);

    }

}

Controller 层挂 WebFlux SSE 抛出去就行。这种方案的动态性来自 

Router Agent 的 LLM 分类

——你不用写 if-else，换专家只改 

experts(List)

。

🛠 落地方案 B：自己写 Router（规则 / LLM 分类，更可控）

当"分类逻辑要连数据库 / 灰度 / 权限"时，框架的 RouterService 不够，得自己包一层。常见两种子策略：

① 规则路由

（意图已由上游 NLU 算好，或关键词就能分）：

@Service

public

class

 

RuleRouter

 

{

    

private

final

 AgentFactory factory;

    

private

final

 Map<String, String> intentToAgent = Map.of(

        

"退款"

, 

"refund-agent"

,

        

"物流"

, 

"logistics-agent"

,

        

"天气"

, 

"weather-agent"

    );

    

public

 HarnessAgent 

route

(WorkflowState state)

 

{

        

return

 factory.get(

            intentToAgent.getOrDefault(state.getIntent(), 

"general-agent"

)

        );

    }

}

零 LLM 开销，行为可预测，问题是 default 兜底容易失控。

② LLM 路由

（把 agent 清单+能力描述喂给一个小模型判）：

@Service

public

 

class

 

LLMRouter

 

{

    

private

 

final

 ChatModel routerModel;   

// 用小模型，别用主力

    

private

 

final

 AgentFactory factory;

    

public

 Mono<HarnessAgent> 

route

(String query)

 

{

        String prompt = 

""

"

            可选 Agent: weather(天气查询), translator(中英互译), refund(退款)

            用户问题: %s

            只返回 agent 名

            "

""

.formatted(query);

        

return

 routerModel.call(prompt)

            .map(name -> factory.get(name.trim()));

    }

}

然后 Controller 里 

router.route(q).flatMap(agent -> agent.streamEvents(...))

 串起来就是完整链路。

🎯 Graph 模式：路由变成"子图跳转"

如果流程不是"一问→多专家并行"，而是"预处理 → 判定 → 跳 A/B/C 子图 → 后处理"，用 

RoutingGraphService

。这一块 AS 2.0 的 Graph DSL 还在迭代，SB 项目里一般做法是：

子图 = 一组 Agent + 自己的 memory/tool

路由节点 = 一个 

FunctionCallAgent

 或 

Router Agent

，返回下一个子图 ID

后处理 = 合成 / 审计 / 写日志

这种形态更接近"工作流引擎里的排他网关"，动态性在

图跳转

而不在并行。

⚠️ SB 场景下几个容易忘的点

RuntimeContext 多租户

：SB 默认"每请求一线程"，但 AS 2.0 的 session 靠 

RuntimeContext.sessionId/userId/traceId

 隔离，Controller 里务必每次 new 一个，别复用。

WebFlux 不是可选

：2.0 的 

streamEvents()

 → 

Flux<AgentEvent>

，用 MVC 硬包会变成阻塞，官方推 WebFlux。

Agent 别直接 

@Bean

 成 singleton

：

HarnessAgent.build()

 建 model client + tool registry + workspace，放 Spring 容器 eager 初始化很浪费，用 

AgentFactory.cache

 按需才是 2.0 推荐姿势。

Router 本身也要单例但轻量

：分类用的小 model client 可以注册成 

@Bean

，真正的业务 Agent 走工厂。

选型一句话

：只想"一句话分专家"→ 直接用 

RouterService

（Simple）；流程有分支/收敛/后处理 → 

RoutingGraphService

；要连业务规则、灰度、权限 → 自己写 

RuleRouter

 / 

LLMRouter

 套 

AgentFactory

。

最佳实践："多专家并行"的场景（Spring Boot + AgentScope Java 2.0）

🧩 核心思路：利用 RouterService 的内置并行机制

AgentScope 2.0 的 

RouterService

 天然支持多专家并行：

分类阶段

：Router Agent 用 LLM 判断用户意图，返回一个或多个专家名称。

并行阶段

：框架根据返回的名称，

并发地

调用所有匹配的专家 Agent（每个专家独立运行自己的 pipeline）。

合并阶段

：所有专家完成后，由 

MergeAgent

（默认 

ConcatMergeAgent

）将结果拼接成一个最终回复。

这个流程完全符合“多专家并行”的需求，且无需手写并发控制。

1. 定义专家 Agent（每个都是一个独立的 HarnessAgent）

@Component

public

class

 

WeatherExpert

 

{

    

private

final

 AgentFactory factory;

    

public

 

WeatherExpert

(AgentFactory factory)

 

{

        

// 工厂创建，避免 eager 初始化

    }

    

public

 HarnessAgent 

build

()

 

{

        

return

 factory.get(

"weather-expert"

);

    }

}

// 同理定义 LogisticsExpert、RefundExpert 等

2. 配置 RouterService（指定专家列表和合并策略）

@Configuration

public

class

 

MultiExpertConfig

 

{

    

@Bean

    

public

 RouterService 

multiExpertRouter

(AgentFactory factory)

 

{

        

// 从工厂获取所有专家实例

        List<HarnessAgent> experts = List.of(

            factory.get(

"weather-expert"

),

            factory.get(

"logistics-expert"

),

            factory.get(

"refund-expert"

)

        );

        

return

 RouterService.builder()

                .experts(experts)                     

// 注册专家

                .mergeAgent(

new

 ConcatMergeAgent())   

// 默认即可，也可自定义

                .build();

    }

}

3. Controller 暴露 SSE 端点

@RestController

@RequestMapping

(

"/api/chat"

)

public

class

 

MultiExpertController

 

{

    

private

final

 RouterService routerService;

    

public

 

MultiExpertController

(RouterService routerService)

 

{

        

this

.routerService = routerService;

    }

    

@PostMapping

(value = 

"/parallel"

, produces = MediaType.TEXT_EVENT_STREAM_VALUE)

    

public

 Flux<ServerSentEvent<String>> parallelChat(

@RequestBody

 ChatRequest request) {

        

// 每次请求创建独立的 RuntimeContext（多租户隔离）

        RuntimeContext ctx = RuntimeContext.builder()

                .sessionId(UUID.randomUUID().toString())

                .userId(request.userId())

                .traceId(request.traceId())

                .build();

        

// 调用 RouterService，返回 Flux<AgentEvent>

        

return

 Mono.fromFuture(

                routerService.run(request.query(), ctx).toFuture()

        )

        .flatMapMany(flux -> flux)          

// 展开内层 Flux

        .map(event -> ServerSentEvent.<String>builder()

                .data(event.getContent())

                .event(

"message"

)

                .build());

    }

}

🧪 自定义合并逻辑（关键点）

默认 

ConcatMergeAgent

 只是简单拼接，但很多场景需要更智能的合并（如投票、去重、优先级排序）。你可以实现自己的 

MergeAgent

：

public

 

class

 

VotingMergeAgent

 

implements

 

MergeAgent

 

{

    

@Override

    

public

 CompletableFuture<AgentEvent> 

merge

(

            List<CompletableFuture<AgentEvent>> expertFutures,

            RuntimeContext context)

 

{

        

// 等待所有专家完成

        

return

 CompletableFuture.allOf(expertFutures.toArray(

new

 CompletableFuture[

0

]))

                .thenApply(v -> {

                    

// 收集所有专家的输出文本

                    List<String> answers = expertFutures.stream()

                            .map(f -> f.join().getContent())

                            .collect(Collectors.toList());

                    

// 这里可以做投票逻辑（例如调用小模型判断哪个答案最合理）

                    String finalAnswer = vote(answers); 

                    

return

 AgentEvent.builder()

                            .content(finalAnswer)

                            .from(

"merge-agent"

)

                            .build();

                });

    }

    

private

 String 

vote

(List<String> answers)

 

{

        

// 简单示例：取第一个非空答案

        

return

 answers.stream()

                .filter(a -> a != 

null

 && !a.isBlank())

                .findFirst()

                .orElse(

"无法确定"

);

    }

}

然后在 

RouterService.builder().mergeAgent(new VotingMergeAgent())

 替换即可。

⚙️ 性能与稳定性注意事项

关注点

建议

并行度

默认所有专家同时跑，如果专家数 > 5，建议用 

Semaphore

 或 

ThreadPoolTaskExecutor

 限制并发数（在专家 Agent 内部控制）。

超时

为每个专家 Agent 设置超时，防止一个慢专家拖垮整个响应。可在 

HarnessAgent.builder().timeout(Duration.ofSeconds(10))

 配置。

错误隔离

某个专家失败不应导致整体失败。可以在 

MergeAgent

 中捕获异常，用 

null

 或占位符替代。

RuntimeContext

每个请求必须新建，不能复用。尤其注意 sessionId 的唯一性。

WebFlux 线程

确保 Controller 返回 

Flux

，不要阻塞。专家内部的 IO 操作应保持异步（如 WebClient）。

🧠 高级技巧：动态增减专家（运行时热更新）

如果专家列表需要在运行时变更（如根据租户配置），可以将 

RouterService

 包装为一个可刷新 bean：

@Component

@RefreshScope

public

class

 

DynamicRouterService

 

{

    

    

private

volatile

 RouterService current;

    

@Value

(

"${app.experts}"

)

    

private

 List<String> expertNames;

    

public

 

void

 

refresh

(AgentFactory factory)

 

{

        List<HarnessAgent> experts = expertNames.stream()

                .map(factory::get)

                .collect(Collectors.toList());

        

this

.current = RouterService.builder()

                .experts(experts)

                .build();

    }

    

public

 CompletableFuture<Flux<AgentEvent>> run(String query, RuntimeContext ctx) {

        

return

 current.run(query, ctx);

    }

}

配合 Spring Cloud Config 或 Apollo 可实现配置中心推送更新。

✅ 总结

开箱即用

：

RouterService

 + 多个 

HarnessAgent

 即可实现多专家并行。

合并自定义

：重写 

MergeAgent

 满足投票、排序等复杂需求。

Spring Boot 集成

：工厂模式管理 Agent，WebFlux 暴露 SSE，注意 RuntimeContext 隔离。

生产级增强

：超时、熔断、动态配置、错误隔离。

          

            var first_sceen__time = (+new Date());
            if ("" == 1 && document.getElementById('js_content')) {
              document.getElementById('js_content').addEventListener("selectstart",function(e){ e.preventDefault(); });
            }
          

        

                

       
       
        if ("0" == 1) {
          document.addEventListener("keydown",function(e){
            if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X' || e.key === 'a' || e.key === 'A')) {
              if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') { return; }
              e.preventDefault();
            }
          });
          document.addEventListener("copy",function(e){
            var sel = window.getSelection();
            var content = document.getElementById('js_content');
            if (sel && sel.rangeCount > 0 && content && content.contains(sel.getRangeAt(0).commonAncestorContainer)) {
              e.preventDefault();
            }
          });
        }
