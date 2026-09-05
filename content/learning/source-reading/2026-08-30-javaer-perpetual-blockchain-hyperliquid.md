---
title: "Javaer 看永续合约、区块链与 Hyperliquid：把链上交易所拆成熟悉的工程系统"
date: "2026-08-30"
createdAt: "2026-08-30"
publishedAt: "2026-08-30"
domain: "学习"
area: "工程与架构"
module: "源码阅读"
project: "工程源码研究"
type: "技术笔记"
status: "可复习"
priority: "P1"
energy: "high"
visibility: "public"
summary: "从 Java 后端工程师的视角，拆解永续合约的账本与风控、区块链的复制状态机，以及 HyperCore、HyperBFT、HyperEVM 和 API 接入的工程边界。"
tags:
  - "Java"
  - "区块链"
  - "永续合约"
  - "Hyperliquid"
  - "交易系统"
  - "分布式系统"
---

# Javaer 看永续合约、区块链与 Hyperliquid：把链上交易所拆成熟悉的工程系统

> 本文是技术学习笔记，不是投资建议，也不构成交易、法律或税务意见。文中平台能力与参数以 2026-08-30 查阅到的官方文档为准，它们可能继续变化。

## 先给结论

如果你是一个 Java 后端工程师，可以先不管“币圈”那套语言，把 Hyperliquid 看成三个熟悉的系统叠在一起：

1. **交易与清算系统**：订单簿、撮合、仓位、保证金、资金费率和强平。
2. **复制状态机**：多个验证者先对交易顺序达成共识，再执行同一套确定性逻辑，得到一致账本。
3. **可编程平台**：HyperCore 提供原生交易原语，HyperEVM 让 Solidity/EVM 应用能复用这些流动性与状态。

所以这不是“用智能合约写一个网页交易所”。它更像把传统交易所核心的撮合与清算状态机，直接做成一条 L1 的原生执行层。

## 一、区块链到底是什么

### 1. 不要先想“链”，先想复制状态机

一个普通 Java 服务的数据库只有一个权威主库时，请求顺序基本由它决定。区块链的问题更麻烦：

- 谁都可能提交交易；
- 节点之间网络延迟不同；
- 有的节点可能故障，甚至故意作恶；
- 所有正确节点最终还必须对“先执行哪笔”和“执行后的状态”达成一致。

用 Java 类比，可以把它想象成：

```text
用户签名请求
  -> 共识层产生全局有序的命令日志
  -> 每个验证者执行同一个 deterministic apply(command, state)
  -> 得到同一个新状态和可验证结果
```

这和 Raft 复制日志有相似的工程直觉，但 BFT 共识的威胁模型更强：它不只处理宕机节点，还要处理任意错误行为。Hyperliquid 官方将 HyperBFT 描述为受 HotStuff 启发的 BFT 共识。HotStuff 论文的核心是在部分同步模型下做到响应性和线性通信复杂度，但不能因此直接推导 HyperBFT 的全部实现细节。

### 2. 共识和执行是两件事

这个区分很重要：

- **共识**回答“这一批命令按什么顺序成为最终事实”。
- **执行**回答“某条命令对订单簿、仓位和账户产生什么变化”。

如果执行层使用不确定的浮点运算、本地时钟或随机数，即使命令顺序相同，节点也可能算出不同结果。这正是为什么交易系统喜欢固定精度整数，而不是 `double`。

## 二、永续合约在业务上做了什么

### 1. 它不是“借钱买币”这么简单

线性永续合约可以理解为一个没有到期日的价格风险合约。你不一定持有现货，而是持有一个由方向、数量和入场价构成的仓位。

一个最小仓位模型可以写成：

```java
public record Position(
        String account,
        String asset,
        Side side,
        long sizeLots,
        long entryPriceTicks,
        long marginMicros,
        long lastFundingIndex) {
}
```

其中的 `lots` / `ticks` / `micros` 是固定精度整数，不是浮点数。边界层可用 `BigDecimal` 解析协议字符串，进入撮合和风控热路径前再转成统一 scale 的 `long`，并严格检查溢出。

### 2. 为什么没有到期日也能跟住现货价

答案是**资金费率（funding）**。

- 永续价格长期高于指数/现货价时，资金费率通常为正，多头向空头支付。
- 永续价格长期低于指数/现货价时，通常反过来。
- 这种支付会改变做多/做空的持仓成本，驱动套利者把合约价拉回指数价附近。

Hyperliquid 当前文档中，资金费用每小时结算，支付在多空双方之间进行。具体计算由利率项、premium index、impact price 与 oracle price 组成，工程实现不能只写一个“合约价减现货价”。

### 3. 为什么不用最新成交价直接强平

因为一笔小额成交就能瞬间操纵最新价。交易系统通常会区分：

- **Oracle price**：来自多个外部市场或验证者聚合的参考现货价。
- **Mark price**：用于未实现盈亏、保证金、强平与 TP/SL 触发的稳健价格。
- **Book/last price**：真实订单簿和最新成交状态，对短时流动性更敏感。

Hyperliquid 的 mark price 将 oracle、Hyperliquid 自身订单簿/成交状态与外部永续市场信息组合为稳健价格。对 Javaer 来说，这就像一个多源数据的风控聚合器：每个输入有时效性、可用性和抗操纵边界，不能将任意一个源当作绝对真相。

### 4. 保证金与强平是一个实时风控状态机

每次下单与成交都不只改订单簿，还要检查：

```text
可用抵押品
+ 已实现盈亏
+ 未实现盈亏
- 已占用初始保证金
- 资金费/手续费
>= 新订单或当前仓位需要的保证金
```

Hyperliquid 默认支持 cross margin，也支持 isolated margin。前者让多个仓位共享账户抵押品，资金效率高，但风险传播面更大；后者把损失边界限制在某个仓位的独立保证金中。

当账户权益低于维持保证金时，强平系统会尝试在订单簿中平仓。当订单簿无法充分消化且风险继续恶化时，才进入官方文档描述的 backstop liquidation 路径。这不是一个普通的 `if (price < liqPrice) close()`，而是一个同时依赖账户权益、仓位名义价值、维持保证金和市场流动性的状态转移。

## 三、Hyperliquid 的技术架构

### 1. HyperCore：不是合约库，而是原生交易执行层

HyperCore 的状态包含：

- 每个市场的订单簿；
- 价格优先、时间优先的撮合状态；
- 永续合约清算所中的余额、仓位、保证金和资金费；
- 现货账户余额与挂单占用；
- 订单、撤单、成交和强平对账本的确定性更新。

官方订单簿文档还描述了一个很值得 Javaer 研究的点：内存池和共识逻辑能理解 HyperCore 交易语义，区块内会先处理不往订单簿发 GTC/IOC 的动作，再处理撤单，最后处理会发送 GTC/IOC 的动作。这说明它不是把所有交易当成无语义字节流，而是围绕交易负载优化整个 L1。

### 2. HyperBFT：把撮合前的命令顺序变成全网事实

传统交易所可以用一个中心化 sequencer 为订单排序。Hyperliquid 需要让验证者对区块中的动作顺序达成共识，然后所有验证者用 HyperCore 执行相同命令。

官方文档当前声称 HyperCore 支持约 20 万 orders/s，并给出地理位置接近服务端时中位约 0.2 秒、P99 约 0.9 秒的端到端延迟。这里应当保持工程审慎：这是官方口径，不是本文独立压测结果；真实客户端还会受地域、API 节点、网络、订单类型和拥塞影响。

### 3. HyperEVM：和 HyperCore 共享同一个共识与链状态

HyperEVM 不是另一条独立侧链。它与 HyperCore 都由 HyperBFT 保护，使通用 EVM 合约可以通过系统能力读取或交互 HyperCore 的状态。

用微服务类比：

```text
HyperCore = 高性能、强约束的交易领域核心
HyperEVM  = 通用扩展平台
预编译/系统合约 = 受控的跨边界 API
HyperBFT = 两者共享的事实顺序与最终性基础
```

这种架构的价值是组合性，但也引入新边界：HyperCore 和 HyperEVM 交互能力仍在演进，读预编译、写系统合约、大区块与 JSON-RPC 能力都应按当前官方文档确认，不能把 testnet 或未上线能力当成 mainnet 事实。

## 四、用 Java 设计一个类似的交易核心

### 1. 先定义命令和事件，不要先写 Controller

```java
public sealed interface ExchangeCommand
        permits PlaceOrder, CancelOrder, ApplyFunding, PublishOracle {
    String account();
    long nonce();
}

public record PlaceOrder(
        String account,
        long nonce,
        String clientOrderId,
        int assetId,
        Side side,
        long priceTicks,
        long sizeLots,
        TimeInForce tif,
        boolean reduceOnly) implements ExchangeCommand {
}
```

一个命令的执行结果不应是到处改对象，而应产生显式事件：

```text
OrderAccepted
OrderRested
OrderMatched
OrderPartiallyFilled
OrderCanceled
MarginReserved
PositionChanged
FundingApplied
LiquidationStarted
```

这样做有三个好处：

- 可重放：用同一批命令验证新版撮合/风控引擎。
- 可审计：可以回答某个仓位为什么变成现在这样。
- 可对账：账户、仓位、费用和资金费都能从事件汇总重建。

### 2. 热路径用单写者和固定精度

传统 Java 业务系统喜欢给每个方法加锁，交易核心更常见的做法是：

- 按市场或确定性分片路由命令；
- 每个分片只有一个写者顺序修改订单簿；
- 跨市场的保证金和账户更新由更高层状态机统一定序；
- 读模型通过快照或事件投影异步构建。

这和 Disruptor、Actor、CQRS 与事件溯源有直觉上的交集，但不必为了追名词把系统复杂化。真正要守的是：**同一命令序列在任何节点必须得到相同结果**。

### 3. 把账本不变式写成测试

最小不变式包括：

```text
一笔成交的 buyerFilled == sellerFilled
所有资金费收付之和 == 0（不含独立协议费用）
可用余额 + 占用保证金 + 费用/盈亏调整 == 可解释的账户总额
reduceOnly 不得增加绝对仓位
重放同一串命令得到完全相同的 state hash
```

这些适合用 jqwik/QuickTheories 做属性测试，比手写几个 happy path 更容易找出边界错误。

## 五、Java 如何接入 Hyperliquid

### 1. 先做只读客户端

Hyperliquid 对外的三个主要入口是：

| 入口 | 用途 | Mainnet |
|---|---|---|
| Info REST | 市场元数据、订单簿快照、账户、仓位、成交等查询 | `POST https://api.hyperliquid.xyz/info` |
| Exchange REST | 下单、撤单、调整杠杆和其他签名动作 | `POST https://api.hyperliquid.xyz/exchange` |
| WebSocket | 订单簿、成交、用户状态等实时订阅 | `wss://api.hyperliquid.xyz/ws` |

先不碰私钥，只用 JDK `HttpClient` 读 `metaAndAssetCtxs`：

```java
public final class HyperliquidInfoClient {
    private static final URI INFO = URI.create("https://api.hyperliquid.xyz/info");

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    private final ObjectMapper json = new ObjectMapper();

    public List<PerpSnapshot> fetchPerps() throws Exception {
        var request = HttpRequest.newBuilder(INFO)
                .timeout(Duration.ofSeconds(5))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("""
                        {"type":"metaAndAssetCtxs"}
                        """))
                .build();

        var response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            throw new IOException("Hyperliquid info HTTP " + response.statusCode());
        }

        JsonNode root = json.readTree(response.body());
        JsonNode universe = root.get(0).get("universe");
        JsonNode contexts = root.get(1);
        if (universe.size() != contexts.size()) {
            throw new IOException("meta/context size mismatch");
        }

        var result = new ArrayList<PerpSnapshot>(universe.size());
        for (int i = 0; i < universe.size(); i++) {
            result.add(new PerpSnapshot(
                    i,
                    universe.get(i).get("name").asText(),
                    universe.get(i).get("szDecimals").asInt(),
                    new BigDecimal(contexts.get(i).get("markPx").asText()),
                    new BigDecimal(contexts.get(i).get("oraclePx").asText()),
                    new BigDecimal(contexts.get(i).get("funding").asText())));
        }
        return List.copyOf(result);
    }
}
```

这段代码的重点不是 HTTP，而是协议边界：

- API 金额和价格常以字符串返回，要用 `BigDecimal` 解析，不用 `double`。
- `assetId` 来自 `meta` 中 universe 的索引，不要将币名硬编码成数字。
- 价格和数量受 `szDecimals`、有效数字与协议精度限制，发单前必须规范化并去掉多余尾零。
- 返回顺序是协议契约的一部分，必须检查数组长度和必填字段，不能静默错位。

### 2. WebSocket 不只是“连上就收消息”

一个能用的 Java WebSocket 客户端至少需要：

- 连接与订阅确认状态机；
- ping/pong 和读超时；
- 指数退避 + jitter 重连；
- 断线后用快照重建本地订单簿，而不是在旧状态上盲目续增量；
- 有界队列和背压，消费跟不上时快速报错并重建，不能无限堆内存；
- 逐通道理解时间戳/快照语义，不要自行假设所有消息共享一个全局 sequence。

官方 WebSocket 文档明确要求自动用户处理服务端断开与重连，并指出重连后可通过快照确认或 Info 查询补回缺失数据。这和你做 SSE 断线重连时的问题本质相同：不是“自动重连”四个字，而是重建一个可信状态。

### 3. 下单最难的不是 JSON，而是签名与 nonce

截至本文日期，Hyperliquid API 文档主要引导开发者参考官方 Python SDK，官方 GitHub 组织也维护 Rust SDK，文档没有给出官方 Java SDK。Java 接入不应从“自己猜签名”开始。

官方 Signing 文档列出了常见错误：

- Hyperliquid 存在两类签名方案，L1 action 和 user-signed action 不能混用。
- L1 action 的 msgpack 字段顺序会影响待签名字节。
- 数字尾零和地址大小写都可以让服务端恢复出另一个 signer。
- 本地 `recover` 出自己的地址，不代表你构造的待签名 payload 与服务端相同。

EIP-712 只规定类型化结构数据的域分离、编码、哈希和签名方式，**它本身不提供重放保护**。Hyperliquid 通过自己的 nonce 规则防重放。当前文档描述为：每个 signer 保留较高的 100 个 nonce，新 nonce 不得重复且要高于当前集合的最小值，同时要落在链上时间的允许窗口内。这为并发发单留出了乱序窗口，但也要求 Java 客户端用单 signer 级原子计数器管理 nonce。

一个稳妥的 Java 实现路线是：

1. 将官方 Python SDK 当成行为规格，固定某个 commit/tag。
2. 用同一组 action、nonce、vaultAddress 与私钥生成 golden fixtures。
3. Java 端逐字节对比 msgpack、action hash、EIP-712 typed data 和最终 `r/s/v`。
4. 先在 testnet 跑下单、撤单、部分成交、重连和重试故障注入。
5. 签名器独立成最小权限模块，业务日志永远不记录私钥、完整签名输入或可重放请求。

### 4. API wallet 不等于业务账户

Hyperliquid 的 API wallet（文档也称 agent wallet）是被主账户授权的签名者。它用于签名，查询仓位和余额时仍要传真正的主账户/子账户地址。

从服务化角度，推荐：

- 主钱包不放在交易进程中；
- 每个交易进程/子账户分配独立 API wallet，减少 nonce 冲突和爆炸半径；
- 用 KMS/HSM 或最小权限的签名 sidecar 保管密钥；
- 撤销或过期后不重用旧 API wallet 地址，避免 nonce 状态被剪枝后出现重放窗口。

## 六、真正值得 Javaer 练手的项目

不要第一天就写真金白银交易机器人。可以做一个三阶段项目：**PerpLab-Java**。

### 阶段 A：只读市场数据录制器

```text
Info REST 获取市场元数据与快照
+ WebSocket 订阅 l2Book / trades / activeAssetCtx
+ 断线重建快照
+ 本地持久化原始事件
+ 可观测性（延迟、重连、丢弃、队列深度）
```

验收不是“能打印 BTC 价格”，而是：拔网 30 秒后恢复，本地订单簿能通过新快照回到一致状态，内存不无限增长。

### 阶段 B：确定性永续模拟器

自己实现：

- 价格时间优先订单簿；
- cross/isolated margin；
- 未实现 PnL 与 funding 结算；
- 维持保证金检查；
- 订单簿强平和 backstop 接口；
- 命令重放后的 state hash 一致性。

故障注入：

- oracle 迟到或某个价格源异常；
- 同一 client order id 的超时重试；
- 成交事件写入后，投影更新前进程崩溃；
- funding 结算到一半重启；
- `long` 乘法溢出和精度边界。

### 阶段 C：Testnet 交易网关

只在 testnet 做：

- API wallet 签名 sidecar；
- signer 级原子 nonce；
- client order id 与本地订单状态机；
- 超时后先查询 order status，再决定是否重试；
- 全链路审计日志，但不记录密钥与敏感待签名数据；
- 限额、kill switch、只减仓模式和一键撤单。

这个项目的价值不在“赚到钱”，而在于你会被迫同时面对：精度、撮合、账本、幂等、有序性、WebSocket 恢复、密钥安全、风控和可观测性。这比再写一个 CRUD 商城更能训练高级 Java 工程能力。

## 七、容易讲错的几个点

### 1. “链上”不等于没有信任与风险

你仍然要信任或评估：

- 验证者集与共识安全性；
- 节点软件、升级和应急机制；
- oracle 数据源与聚合方法；
- 跨链充提与外部桥接路径；
- HyperEVM 合约、预编译/系统合约与应用自身的漏洞；
- API 节点、前端、钱包与私钥保管。

上链主要改变了事实记录、验证和执行权限的方式，没有消除软件故障、经济攻击和人为错误。

### 2. 高杠杆不是一个纯技术玩具

永续合约会把小幅价格变动放大为保证金的大幅变动，还叠加资金费、滑点、强平和流动性风险。系统做对了，不代表交易决策就正确。

### 3. 不要把 Hyperliquid 说成“完全开源的 Java 交易所”

可以审阅的是官方文档、SDK、节点运行资料和部分工具仓库。不能因为有 GitHub 组织，就假设核心共识与 HyperCore 的完整生产实现都能通过 Java 源码阅读获得。做源码研究时必须区分：文档声明、公开代码事实、API 实测和自己的架构推断。

## 八、面试时可以怎么讲

### 60 秒版

> 我会把 Hyperliquid 理解成一个为交易负载定制的复制状态机。HyperBFT 让验证者对订单、撤单和清算动作的顺序达成共识；HyperCore 用确定性逻辑维护订单簿、仓位、保证金、资金费和强平；HyperEVM 则在同一条链上提供通用 EVM 扩展。Java 接入的难点不是调 REST，而是固定精度、WebSocket 断线状态重建、订单幂等、msgpack/EIP-712 签名、nonce 并发和私钥隔离。

### 追问时要守住的边界

- 永续合约靠 funding 驱动价格向现货靠拢，不是完全锁定。
- 强平依赖 mark price 和账户保证金状态，不是只看最新成交价。
- HyperEVM 不是独立链，但 HyperCore/EVM 交互的具体可用能力要看当前网络阶段。
- EIP-712 不自带重放保护，还要有协议 nonce。
- 没有官方 Java SDK 时，要用官方 SDK 作为 golden reference，不靠猜测实现签名。

## 官方资料

- [Hyperliquid 技术概览](https://hyperliquid.gitbook.io/hyperliquid-docs)
- [HyperCore 概览](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/overview)
- [HyperCore 订单簿](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/order-book)
- [Clearinghouse](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/clearinghouse)
- [Funding](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding)
- [Oracle 与稳健价格](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/oracle)
- [Mark price 计算原则](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/robust-price-indices)
- [Margining](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/margining)
- [Liquidations](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/liquidations)
- [HyperEVM](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperevm)
- [Info endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals)
- [Exchange endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint)
- [WebSocket](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket)
- [Signing](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing)
- [Nonces and API wallets](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets)
- [Rate limits](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits)
- [Tick and lot size](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size)
- [Hyperliquid 官方 GitHub 组织](https://github.com/hyperliquid-dex)
- [Hyperliquid Python SDK](https://github.com/hyperliquid-dex/hyperliquid-python-sdk)
- [EIP-712：Typed structured data hashing and signing](https://eips.ethereum.org/EIPS/eip-712)
- [HotStuff 论文](https://arxiv.org/abs/1803.05069)
