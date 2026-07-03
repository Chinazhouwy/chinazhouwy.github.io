# Java单体项目存量HTTP接口暴露为MCP Tool架构方案

**类型：📚 参考资料（非面试题/面经）**
**来源：微信公众号**
**日期：2026-06-13**

---

## 一、背景与问题

项目 `creative-ops-assistant` 是一套运营管理系统，结构如下：

```
creative-ops-assistant
├── ops-agent       # MCP封装
├── ops-common      # 共用模块
├── ops-deploy-app  # 聚合其他模块，统一部署
├── ops-gateway     # 网关
├── ops-microdrama  # 业务模块
└── ops-system      # 权限以及登录模块
```

**技术栈：**
- 后端：Spring Boot 3.5.7 + Spring AI 1.1.2 + Spring AI Alibaba 1.1.2.2
- 网关：Spring Cloud Gateway（WebFlux），通过 Nacos Discovery 做服务发现与负载均衡

**核心诉求：**
- 存量 Service 代码零改动
- 不引入 Higress 等额外网关
- 利用现有 Spring Cloud Gateway + Nacos 架构
- 支持多实例水平扩容

---

## 二、MCP传输协议选型

Spring AI 提供三种 MCP Server 传输模式：

| 传输模式 | 端点 | 会话状态 | 负载均衡 | Security模块 |
|---------|------|---------|---------|-------------|
| SSE（旧版） | `/sse` + `/mcp/message` | 有状态（长连接绑定实例） | 需要 sticky session | 不支持 |
| Streamable HTTP | `/mcp` | 有状态（持久连接） | 需要 sticky session | 支持 |
| **Stateless Streamable HTTP** | `/mcp` | **无状态** | **标准轮询即可** | 支持 |

**结论：选 Stateless**

- **无状态** = 每次请求独立，Spring Cloud Gateway 的 `lb://` 轮询直接可用，不需要 sticky session（即会话粘性，负载均衡让同一客户端在会话期间始终访问同一台后端，避免有状态连接因请求被分到不同机器而失效）
- 单一 `/mcp` 端点，路由配置简单
- 兼容 MCP Security 模块（OAuth 2.0 / API Key）

---

## 三、最终架构：Stateless + Spring Cloud Gateway 统一入口

**关键设计决策：**
- REST 与 MCP 共用网关：统一域名、统一入口
- 鉴权隔离：REST 走 JWT（AuthGlobalFilter + JwtAuthFilter），MCP 走 API Key（McpApiKeyFilter）

---

## 四、Nacos MCP Registry 对比 Spring Cloud Gateway

### 4.1 网关模式
Client 只知道网关地址，不感知后端实例。负载均衡、故障转移由网关 + Nacos Discovery 完成。

### 4.2 Nacos MCP Registry 模式
Client 从 Nacos 发现实例列表，自己做负载均衡，直连后端。无网关、无中间代理、一跳到位。

### 4.3 对比总结

| 维度 | 网关模式 | Nacos MCP Registry |
|-----|---------|-------------------|
| 谁做发现 | 网关（通过 Nacos Discovery） | MCP Client 自己（通过 Nacos MCP Registry） |
| 谁做负载均衡 | 网关 | Client 侧（LoadbalancedMcpSyncClient） |
| Client 连谁 | 网关地址（固定） | 后端实例（动态） |
| 网络跳数 | 两跳（Client → 网关 → 后端） | 一跳（Client → 后端） |
| 统一入口 | 有（REST + MCP 共用网关） | 无 |
| 集中鉴权/限流 | 网关统一处理 | 每个 Server 自行处理 |
| Client 复杂度 | 低（写一个 URL） | 高（集成 Nacos MCP SDK） |
| 适用场景 | 已有网关、需要统一管控 | 内部 Agent 间直调、追求低延迟 |

**结论：** 两者解决的是同一个问题：MCP Server 的发现与负载均衡。Nacos MCP Registry 管内网发现，网关管对外输出，两者可并存。已有 SCG + REST/MCP 统一入口时，对外固定走网关；内网编排 Agent 若追求低延迟，再单独评估是否上 Nacos MCP Registry。

---

## 五、Nacos MCP Registry ≈ Dubbo 的注册发现

如果你熟悉 Dubbo，Nacos MCP Registry 的工作原理一目了然：

```
Dubbo:           Provider 注册到 Nacos → Consumer 从 Nacos 发现 → 直连调用（Dubbo 协议）
MCP Registry:    MCP Server 注册到 Nacos → MCP Client 从 Nacos 发现 → 直连调用（HTTP/MCP 协议）
```

| 对比维度 | Dubbo | Nacos MCP Registry |
|---------|-------|-------------------|
| 注册内容 | 服务接口 + 方法签名 + 实例地址 | MCP Server 名 + Tool 列表 + 实例地址 |
| 注册时机 | Provider 启动时自动注册 | MCP Server 启动时自动注册 |
| 发现方 | Dubbo Consumer | MCP Client（Agent） |
| 调用方式 | Consumer 直连 Provider | Client 直连 Server |
| 负载均衡 | Consumer 侧（轮询/随机/一致性 Hash） | Client 侧（轮询） |
| 故障转移 | Consumer 感知实例下线，自动切换 | Client 感知实例下线，自动切换 |
| 是否需要网关 | 不需要 | 不需要 |

**本质上都是「注册中心 + 客户端负载均衡」模式。** 而用网关做 MCP 路由，更像是 HTTP 版的「网关代理模式」——多了一跳，换来统一入口和集中管控。

---

## 六、核心实现代码

### 6.1 MCP Server 配置

```yaml
# Stateless Streamable HTTP，无会话状态
spring.ai.mcp.server.protocol=STATELESS
spring.ai.mcp.server.name=creative-ops-mcp
spring.ai.mcp.server.version=1.0.0
spring.ai.mcp.server.type=SYNC
spring.ai.mcp.server.stateless.mcp-endpoint=/mcp
```

### 6.2 Tool 包装类（零改动包装存量 Service）

```java
@Component
@RequiredArgsConstructor
public class UserMcpTools {
    private final UserService userService;

    @Tool(description = "分页查询系统用户列表，可按用户名、状态、部门筛选")
    public PageResult<SysUserPo> queryUserList(
        @ToolParam(description = "页码，从 1 开始") int pageNum,
        @ToolParam(description = "每页条数", required = false) Integer pageSize,
        @ToolParam(description = "用户名关键字", required = false) String username,
        @ToolParam(description = "状态：0-正常 1-停用", required = false) String status,
        @ToolParam(description = "部门 ID", required = false) Long deptId) {
        return userService.listPage(pageNum, pageSize != null ? pageSize : 10, username, status, deptId);
    }
}
```

**关键点：** UserService 一行代码不改，`@Tool` 方法只是一层薄包装。

### 6.3 注册 ToolCallbackProvider

```java
@Configuration
public class McpToolsConfig {
    @Bean
    public ToolCallbackProvider opsMcpTools(
        UserMcpTools userMcpTools,
        DeptMcpTools deptMcpTools,
        RoleMcpTools roleMcpTools) {
        return MethodToolCallbackProvider.builder()
            .toolObjects(userMcpTools, deptMcpTools, roleMcpTools)
            .build();
    }
}
```

### 6.4 MCP 端点 API Key 鉴权

```java
@Component
public class McpApiKeyFilter extends OncePerRequestFilter {
    @Value("${ops.mcp.api-key}")
    private String expectedApiKey;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/mcp");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {
        if (expectedApiKey.equals(request.getHeader("X-API-Key"))) {
            filterChain.doFilter(request, response);
            return;
        }
        response.setStatus(401);
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":401,\"msg\":\"MCP API Key 无效\"}");
    }
}
```

Spring Security 中对 `/mcp` 路径 `permitAll()`，由此 Filter 独立鉴权。

### 6.5 网关路由

```yaml
# REST 路由（已有）
spring.cloud.gateway.server.webflux.routes[0].id=creative-ops-assistant-api
spring.cloud.gateway.server.webflux.routes[0].uri=lb://creative-ops-assistant
spring.cloud.gateway.server.webflux.routes[0].predicates[0]=Path=/api/**
spring.cloud.gateway.server.webflux.routes[0].filters[0]=StripPrefix=1

# MCP 路由（新增，Stateless 无状态，标准轮询）
spring.cloud.gateway.server.webflux.routes[1].id=creative-ops-assistant-mcp
spring.cloud.gateway.server.webflux.routes[1].uri=lb://creative-ops-assistant
spring.cloud.gateway.server.webflux.routes[1].predicates[0]=Path=/mcp/**

# 网关鉴权白名单加上 /mcp/**（MCP 有自己的 API Key 鉴权）
gateway.auth.whitelist=...,/mcp/**
```

### 6.6 Cursor IDE 连接配置

`.cursor/mcp.json`：
```json
{
  "mcpServers": {
    "ops-tools": {
      "url": "http://localhost:9002/mcp",
      "headers": {
        "X-API-Key": "ops-mcp-default-key"
      }
    }
  }
}
```

---

## 七、总结

1. **Stateless Streamable HTTP 是关键选型**：无状态让 MCP 可以像普通 REST 一样被标准网关轮询，不需要 sticky session。
2. **有网关就用网关**：Nacos MCP Registry 和网关解决的是同一个问题（发现 + LB），有网关时不需要 Registry。
3. **Nacos MCP Registry ≈ Dubbo 的注册发现**：Provider 注册、Consumer 发现、直连调用，本质是「注册中心 + 客户端负载均衡」模式。
4. **@Tool 包装是最小改动方式**：存量 Service 零改动，只加一层薄包装方法，进程内直调，类型安全。

---

**原始链接：** https://mp.weixin.qq.com/s/fY6R5A-aj-zQAtLlha1ZAg
