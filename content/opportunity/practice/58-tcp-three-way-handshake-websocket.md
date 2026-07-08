---
title: "TCP — 三次握手、四次挥手、WebSocket vs HTTP 轮询"
date: "2026-07-08"
domain: "机会"
area: "机会雷达"
module: ""
project: "机会雷达"
type: "题目"
status: "completed"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "TCP — 三次握手、四次挥手、WebSocket vs HTTP 轮询"
tags:
  - "tcp"
  - "network"
  - "websocket"
schema_version: "1"
question_id: "58"
question: "TCP — 三次握手、WebSocket vs HTTP 轮询怎么讲？"
sources:
  - "tencent/2026-06-07-tencent-ai-backend-round1-xhs.md"
  - "java/baidu-java-backend-round1-shezhao.md"
  - "tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md"
score: "6/10"
round: "R0"
next_review: "2026-07-11"
session_id: "unknown"
---

# 第58题：TCP — 三次握手、四次挥手、WebSocket vs HTTP 轮询

> 日期：2026-07-08
> 来源：`tencent/2026-06-07-tencent-ai-backend-round1-xhs.md`; `java/baidu-java-backend-round1-shezhao.md`; `tiktok/2026-06-07-bytedance-ai-agent-backend-round1.md`

---

## 第一轮：初始回答

**得分：6/10**

用户回答要点：
- 三次握手：A 发起连接，B 回应确认，A 再确认 ✓
- 四次挥手：A 说结束，B 确认，B 发完剩余数据，A 等待后关闭 ✓
- 理解了基本流程，但术语混乱（seq/ack 混淆）

漏掉的：
- WebSocket vs HTTP 轮询未回答
- TCP 标志位（SYN/ACK/FIN）含义不清晰
- TIME_WAIT 的作用未说明

---

## 核心概念

### TCP 标志位

```
SYN = Synchronize（同步）
  → "我要建立连接，同步序列号"

ACK = Acknowledgment（确认）
  → "我确认收到了"

FIN = Finish（结束）
  → "我这边数据发完了，要关闭"

SEQ = Sequence（序列号）
  → "这个包的编号是多少"

RST = Reset（重置）
  → "连接异常，强制断开"

PSH = Push（推送）
  → "别等了，立即把数据交给应用层"
```

### 三次握手

```
① A → B：SYN, seq=x
   "我要连接，我的初始序列号是 x"

② B → A：SYN+ACK, seq=y, ack=x+1
   "同意，我的初始序列号是 y，确认你的 x"

③ A → B：ACK, seq=x+1, ack=y+1
   "确认你的 y"
```

**为什么要三次？**
```
防止历史连接重复建立
如果只有两次：B 不知道 A 是否收到自己的 SYN+ACK
```

### 四次挥手

```
① A → B：FIN
   "我要关闭发送"

② B → A：ACK
   "收到，但我还有数据要发"

③ B → A：FIN（数据发完后）
   "我也关闭发送"

④ A → B：ACK
   "确认"

⑤ A 等待 2MSL（约60秒）才真正关闭
   → 防止最后一个 ACK 丢失
   → 等 B 重发 FIN
```

**为什么是四次？**
```
TCP 是全双工，双方各自关闭
A 关闭发送 → B 确认 → B 关闭发送 → A 确认
```

### WebSocket vs HTTP 轮询

| 维度 | HTTP 轮询 | WebSocket |
|------|-----------|-----------|
| 连接方式 | 短连接，每次重建 | 长连接，一次建立 |
| 通信方向 | 客户端主动请求 | 服务端可主动推送 |
| 延迟 | 高（等轮询间隔） | 低（实时推送） |
| 资源消耗 | 高（重复建立连接） | 低（复用连接） |
| 适用场景 | 低频更新 | 实时聊天、游戏、股票 |

```
HTTP 轮询：
  客户端每隔 N 秒请求一次
  → 服务端有新数据也得等客户端来问
  → 延迟 = N 秒

WebSocket：
  客户端发起升级请求，建立长连接
  → 服务端有新数据直接推
  → 延迟 ≈ 0
```

---

## 用户追问纠正记录

1. ACK = Acknowledgment，不是"第0个ACK"
2. SEQ = Sequence，是序列号
3. SYN = Synchronize，用于建立连接
4. FIN = Finish，用于关闭连接
5. TIME_WAIT 等待 2MSL，确保最后 ACK 到达

---

## 这次讨论的收获

- 三次握手：SYN → SYN+ACK → ACK
- 四次挥手：FIN → ACK → FIN → ACK
- TCP 是全双工，所以挥手要四次
- WebSocket 比 HTTP 轮询延迟低、资源消耗少
- TIME_WAIT 等待 2MSL，防止最后 ACK 丢失
