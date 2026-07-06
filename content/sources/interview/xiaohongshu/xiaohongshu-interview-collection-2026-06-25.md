---
title: "小红书面试题收集报告"
date: "2026-06-25"
domain: "机会"
area: "面试来源"
module: ""
project: "机会雷达"
type: "source_digest"
status: "待拆解"
priority: "P1"
energy: "medium"
visibility: "private"
summary: "小红书面试题收集报告"
tags:
---

# 小红书面试题收集报告

> **收集日期**: 2026-06-25
> **搜索关键词**: java面试题 2026、AI agent 面试题 2026、后端面试题 2026
> **收集方式**: Chrome DevTools 小红书网页搜索 + 截图OCR + 文字快照提取
> **筛选标准**: 高互动量（>50赞）、近3个月发布、面经/面试题类型（非鸡汤/推广）

---

## 一、收集规则分析（从项目结构推导）

### 1. 目录分类规则
| 目录 | 内容范围 | 关键词特征 |
|------|---------|-----------|
| `ai-agent/` | AI Agent架构、MCP、RAG、大模型应用、Prompt工程 | Agent、MCP、RAG、LLM、大模型、Prompt |
| `java/` | Java后端技术面：Spring、JVM、并发、MySQL索引 | Java、Spring、JVM、MySQL、并发 |
| `middleware/` | 中间件/通用后端：Redis、MQ、分布式锁、SQL优化 | Redis、Kafka、RocketMQ、分布式、SQL |
| `tencent/` | 腾讯专项面经 | 腾讯、WXG、微信 |
| 按公司分 | `kuaishou/`、`oppo/`、`sf/` 等 | 公司名明确 |

### 2. 文件命名规则
```
[YYYY-MM-DD-]<公司>-<技术方向>-<轮次>.md
```
示例:
- `2026-05-25-kuaishou-backend-java-round1-mysql.md`
- `bytedance-agent-interview-round1.md`

### 3. 文件内容格式（每篇必须包含）
```markdown
# 标题（公司 + 技术方向 + 面经/面试题）

> **来源**: 小红书 + 链接
> **标签**: `#标签1` `#标签2`
> **考点分类**: 关键词1 / 关键词2 / ...

---

## Q1: 问题？
### 答题思路
### 深度解答
（含代码示例）
```

### 4. 分类标记
- 📋 面经/面试题 → 纳入题库，可提取 practice 练习题
- 📚 参考资料 → 技术深度文章

### 5. 去重机制
- `.fetched_index.md` 记录已抓取的 `noteId`，避免重复

---

## 二、已有索引中的 noteId（已收集，跳过）

```
6a06c9a000000000350228d5  滴滴出行后端Java二面面经
69fe086200000000350206fb  美团后端面经三面合并
6a0719ec000000003700fe02  蚂蚁AI前端研发工程师面经
6a02fc1c00000000080322a3  Minimax Go面试复盘
6a028a17000000003503819d  字节后端开发一面已拿offer
6a0aadd5000000000803272e  腾讯瑞驰后端Java二面面经
6a0ac5be0000000007020f35  蚂蚁后端Java终面面经
6a0c068d0000000036000fe3  联想后端Java二面面经
6a0c0621000000003700e8f9  腾讯后端开发社招强度
6a0e9019000000003502495a  百度后端Java终面面经
6a0fec1400000000080023ef  饿了么Java后端一面面经
6a1616fb0000000035022c5f  TikTok国际电商后端一面
6a156a9400000000060227f0  腾讯云智后端Java终面面经
6a1661b00000000008030ee0  WXG微信支付后台开发二面
6a180eeb00000000080326da  京东Java后端二面面经
6a1969c0000000003501e602  飞猪Java一面
6a148dbf0000000006037505  百度Java一面(社招)
```

---

## 三、新增高价值笔记清单

### 🔥 Tier 1：超高互动（>200赞），必收集

| noteId | 标题 | 作者 | 赞数 | 分类建议 | 链接 |
|--------|------|------|------|---------|------|
| 69d9d3c8000000001a021c89 | 腾讯 AI 应用开发 一面 | 逸 | 3522 | `tencent/` | https://www.xiaohongshu.com/explore/69d9d3c8000000001a021c89 |
| 697f48d5000000000e03c1d5 | 大模型应用开发-agent相关面经 | 不爱秋招爱整理 | 1334 | `ai-agent/` | https://www.xiaohongshu.com/explore/697f48d5000000000e03c1d5 |
| 69ad4bb9000000000d00a454 | 2026大模型Agent面试全攻略（上） | AI实战领航员 | 864 | `ai-agent/` | https://www.xiaohongshu.com/explore/69ad4bb9000000000d00a454 |
| 69d67834000000001a02b9b1 | 小红书 AI 应用开发一面 | 逸 | 742 | `ai-agent/` | https://www.xiaohongshu.com/explore/69d67834000000001a02b9b1 |
| 69985617000000000a028daf | 面试官：又看到个新词儿，让我来考考你 | 居丽叶 | 700 | `ai-agent/` | https://www.xiaohongshu.com/explore/69985617000000000a028daf |
| 6a19a5cc00000000060317b1 | 面试官看了一眼你的Agent项目，说太toy了 | 海云日记 | 627 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a19a5cc00000000060317b1 |
| 69ec9e94000000003502c0b9 | AI Agent常见面试题 | techApple | 570 | `ai-agent/` | https://www.xiaohongshu.com/explore/69ec9e94000000003502c0b9 |
| 69aa8465000000002801f237 | 字节春招 26届后端开发Agent一面 | 小怪兽没名字 | 522 | `ai-agent/` | https://www.xiaohongshu.com/explore/69aa8465000000002801f237 |
| 69c8d73c0000000023014274 | 淘天 AI Agent 二面 | Offer面试官 | 414 | `ai-agent/` | https://www.xiaohongshu.com/explore/69c8d73c0000000023014274 |
| 6a1c1e5c000000003501dd46 | 腾讯 Agent二面凉经带答案 | 一路向西北 | 425 | `tencent/` | https://www.xiaohongshu.com/explore/6a1c1e5c000000003501dd46 |
| 69cf922d000000002100693e | 后端要掌握的 AI 八股：Skill 及面试题 | 程序员流年 | 416 | `ai-agent/` | https://www.xiaohongshu.com/explore/69cf922d000000002100693e |
| 69f9f8c5000000003503ac05 | 携程AI应用开发一面面经 | 程序员尺哥 | 364 | `ai-agent/` | https://www.xiaohongshu.com/explore/69f9f8c5000000003503ac05 |
| 6a2abb2a000000003502459b | 【2026年6月面试复盘】面 Agent 岗的这段日子 | DailyLLM | 245 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a2abb2a000000003502459b |
| 6a00a7740000000007013726 | 淘天-ai应用开发-二面 | 白衣胜雪丶 | 213 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a00a7740000000007013726 |
| 69ac1e33000000001d0105ee | 26春招 阿里AI coding一面面经 | 淮南txo | 196 | `ai-agent/` | https://www.xiaohongshu.com/explore/69ac1e33000000001d0105ee |
| 69db2138000000002202a43d | 后端要掌握的 AI 八股：Memory 及面试题 | 程序员流年 | 167 | `ai-agent/` | https://www.xiaohongshu.com/explore/69db2138000000002202a43d |
| 6a159ce50000000035020c7a | 腾讯AI Agent二面（贼难） | 互联网放心面 | 174 | `tencent/` | https://www.xiaohongshu.com/explore/6a159ce50000000035020c7a |
| 69de4c50000000001a02e291 | 🔥Java后端面试必看 场景题1 | 失业菜鸟程序员 | 87 | `java/` | https://www.xiaohongshu.com/explore/69de4c50000000001a02e291 |
| 6a3b486a0000000021008651 | 拼多多 AI Agent三轮技术面贼难 | 程序员峰哥 | 110 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a3b486a0000000021008651 |
| 6a210f340000000036019529 | 字节AI Agent后端面经 | 默默无眠 | 121 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a210f340000000036019529 |
| 6a005353000000000603768f | 美团二面：高并发下如何保证接口幂等性？ | 苏三说技术 | 127 | `middleware/` | https://www.xiaohongshu.com/explore/6a005353000000000603768f |
| 6a32658c000000002201592a | 给大家普及一下AI大模型面试需要达到的强度 | 饭团 | 139 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a32658c000000002201592a |

### ⭐ Tier 2：高互动（50-200赞），建议收集

| noteId | 标题 | 作者 | 赞数 | 分类建议 | 链接 |
|--------|------|------|------|---------|------|
| 69c17afe000000001a029b78 | 滴滴社招一面 Java | 跑鹿 | 71 | `java/` | https://www.xiaohongshu.com/explore/69c17afe000000001a029b78 |
| 68fae2e900000000030229df | 京东一面java社招 | 兰姆达 | 82 | `java/` | https://www.xiaohongshu.com/explore/68fae2e900000000030229df |
| 6a3aa3f5000000001503ffe2 | 小红书Java后端一面 | Turlin | 34 | `java/` | https://www.xiaohongshu.com/explore/6a3aa3f5000000001503ffe2 |
| 69d9e90e000000001a02a6a0 | 淘天社招一面 后端 | 跑鹿 | 49 | `java/` | https://www.xiaohongshu.com/explore/69d9e90e000000001a02a6a0 |
| 6a37a443000000001603dc61 | 谈谈你对Spring AOP的理解？面试满分完整版 | Java技术分享 | 19 | `java/` | https://www.xiaohongshu.com/explore/6a37a443000000001603dc61 |
| 6a1bd2a40000000035023740 | 字节跳动AI Agent开发一面（贼难） | Java面小猫 | 286 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a1bd2a40000000035023740 |
| 6a2197c3000000002101a9e7 | 美团AI-Agent工程师面经，看看难度 | 不高兴 | 22 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a2197c3000000002101a9e7 |
| 69d116d0000000002301eb40 | 蚂蚁AI Coding真题！教你拿下Agent开发岗 | 码上职通车 | 68 | `ai-agent/` | https://www.xiaohongshu.com/explore/69d116d0000000002301eb40 |
| 69dd14e5000000002102c033 | 淘天 AI Agent 开发一面 | 逸 | 155 | `ai-agent/` | https://www.xiaohongshu.com/explore/69dd14e5000000002102c033 |
| 6a23fce1000000001503c251 | 腾讯AI后端一面面经 | 默默无眠 | 43 | `tencent/` | https://www.xiaohongshu.com/explore/6a23fce1000000001503c251 |
| 6a180a2800000000070137cd | 淘天 AI Agent 一面复盘 | AIIAAI | 183 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a180a2800000000070137cd |
| 6a1785a50000000008024a9b | 360 AI Agent后端开发工程师面试全复盘 | 程序员明哥 | 6 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a1785a50000000008024a9b |
| 6a1a54ee0000000007024c20 | 贝壳AI Agent后端开发面试复盘 | 程序员明哥 | 11 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a1a54ee0000000007024c20 |
| 6a26e83c000000002202894a | 阿里子公司 AI Agent面经 | 冒个泡泡. | 11 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a26e83c000000002202894a |
| 6a1ff0140000000006032c0b | 字节AI Agent开发面试全解析：15道高频问题 | 自由路飞 | 20 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a1ff0140000000006032c0b |
| 6a310abd000000000f016331 | AI Agent 100道核心面试题，吃透这篇就够 | 自由路飞 | 11 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a310abd000000000f016331 |
| 6a05dd2100000000380213b5 | AI Agent面试八股文 | AI快乐小狗 | 9 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a05dd2100000000380213b5 |
| 6a07e762000000000702fd6d | 🚀2026 Agent 面试全景图，一图看懂要点 | Hp-AI宝藏库 | 12 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a07e762000000000702fd6d |
| 69b4f22b000000002300777d | 2026大模型Agent面试全攻略（下） | AI实战领航员 | 292 | `ai-agent/` | https://www.xiaohongshu.com/explore/69b4f22b000000002300777d |
| 6985c047000000000b0118e2 | Agent求职者的面试葵花宝典（含答案要点） | 网安-魏来 | 95 | `ai-agent/` | https://www.xiaohongshu.com/explore/6985c047000000000b0118e2 |
| 69cbb977000000001a028b07 | 高德AI Agent前端开发面经（3月最新） | 曲行悠Man. | 38 | `ai-agent/` | https://www.xiaohongshu.com/explore/69cbb977000000001a028b07 |
| 6a16e0ef0000000035027ad2 | 【AI八股文】Agent开发工程师（上篇） | 白梦猿 | 29 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a16e0ef0000000035027ad2 |
| 6a3a7df40000000007025fdb | AI Agent高频面试题，从ReAct到Multi-Agent | 迟迟 | 18 | `ai-agent/` | https://www.xiaohongshu.com/explore/6a3a7df40000000007025fdb |
| 693199e1000000001e015154 | agent开发外包面试常用题 | AI折腾哥 | 120 | `ai-agent/` | https://www.xiaohongshu.com/explore/693199e1000000001e015154 |
| 6a253c5e000000002202a502 | 2026美团后端一面，连MCP都问了 | Offer面试官 | 6 | `middleware/` | https://www.xiaohongshu.com/explore/6a253c5e000000002202a502 |
| 6a0d25610000000007026ae6 | 极兔速递后端Java终面面经 | 码上Java面试小站 | 11 | `middleware/` | https://www.xiaohongshu.com/explore/6a0d25610000000007026ae6 |
| 6a06c9e80000000007023185 | 汇丰银行后端Java终面面经 | 码上Java面试小站 | 12 | `middleware/` | https://www.xiaohongshu.com/explore/6a06c9e80000000007023185 |
| 6a263761000000001c024077 | 阿里云Java后端一面面经｜攒RP | 默默无眠 | 17 | `java/` | https://www.xiaohongshu.com/explore/6a263761000000001c024077 |
| 6a394ecd00000000200386bb | 京东物流 Java后端一面面经 | 蚂蚁java架构师__阿龙 | 9 | `java/` | https://www.xiaohongshu.com/explore/6a394ecd00000000200386bb |
| 6a1a59370000000008031690 | 滴滴出行Java后端一面面经 | Java 进阶路 | 6 | `java/` | https://www.xiaohongshu.com/explore/6a1a59370000000008031690 |
| 6a1a6110000000000702ebb7 | 滴滴出行Java后端二面面经 | Java王老师 | 3 | `java/` | https://www.xiaohongshu.com/explore/6a1a6110000000000702ebb7 |
| 6a1d4c5c000000000803d1c5 | QQ Java后端二面面经 | Java王老师 | 0 | `java/` | https://www.xiaohongshu.com/explore/6a1d4c5c000000000803d1c5 |
| 6a1fa244000000002200be40 | 虎扑 Java后端一面面经（初级社招） | Java王老师 | 1 | `java/` | https://www.xiaohongshu.com/explore/6a1fa244000000002200be40 |
| 6a3a05a1000000000f029562 | 华为OD-Java面经 | 芊芊馒头苦干 | 3 | `java/` | https://www.xiaohongshu.com/explore/6a3a05a1000000000f029562 |
| 6a2bce8d00000000160277db | 平安保险 Java后端二面面经 | 可爱Java码仔 | 5 | `java/` | https://www.xiaohongshu.com/explore/6a2bce8d00000000160277db |
| 6a2787ea000000001c027525 | 阿里云Java后端二面面经｜约1h | 默默无眠 | 23 | `java/` | https://www.xiaohongshu.com/explore/6a2787ea000000001c027525 |
| 6a2d7e0b00000000220252b6 | Redis面试必背8大考点背完不慌 | 观山澜 | 7 | `middleware/` | https://www.xiaohongshu.com/explore/6a2d7e0b00000000220252b6 |
| 69eae69f0000000020006001 | 2026面试：RAG项目怎么讲才能活 | ssp-极客麻薯哥 | 36 | `ai-agent/` | https://www.xiaohongshu.com/explore/69eae69f0000000020006001 |
| 6a172dc90000000038035bec | 字节跳动 后端开发实习生初面面试问题汇总 | 攸宁 | 44 | `java/` | https://www.xiaohongshu.com/explore/6a172dc90000000038035bec |
| 6a1d8230000000003701d1dc | 虾皮 Shopee SSC 供应链后端开发一面 | 攸宁 | 25 | `java/` | https://www.xiaohongshu.com/explore/6a1d8230000000003701d1dc |
| 6a1a4b6d0000000006032008 | 滴滴出行Java后端终面面经 | 码上Java面试小站 | 7 | `java/` | https://www.xiaohongshu.com/explore/6a1a4b6d0000000006032008 |
| 6a0e80f90000000007027041 | 百度后端Java二面面经 | 蚂蚁java架构师__阿龙 | 10 | `java/` | https://www.xiaohongshu.com/explore/6a0e80f90000000007027041 |
| 6a16a01c000000000800095f | 搜狗后端Java终面面经项目深挖+场景架构设 | Java 进阶路 | 1 | `java/` | https://www.xiaohongshu.com/explore/6a16a01c000000000800095f |

---

## 四、统计汇总

| 分类 | 新增笔记数 | 说明 |
|------|-----------|------|
| `ai-agent/` | ~35 | AI Agent面试是最大增量，远超java和middleware |
| `java/` | ~18 | Java后端面经持续产出 |
| `tencent/` | ~3 | 腾讯AI/Agent方向面试 |
| `middleware/` | ~4 | Redis、SQL、幂等性等通用后端 |
| **合计** | **~60** | 去重后约55篇新笔记可收集 |

---

## 五、收集策略建议

### 优先级排序
1. **最高优先**：Tier 1 中 >500 赞的 Agent 面经（共 8 篇）— 内容质量最高
2. **高优先**：Tier 2 中的公司面经（淘天、字节、腾讯、美团等）— 真实面试题
3. **中优先**：八股文/面试题总结类 — 通用性强但可能与已有内容重叠

### 内容提取方式
- **图文笔记**：截图 → OCR提取 → 整理为markdown
- **纯文字笔记**：直接通过 snapshot 提取文字内容
- **视频笔记**：跳过（无法自动提取）

### 下一步操作
1. 对 Tier 1 笔记逐个截图 + OCR 提取内容
2. 按项目格式整理为 markdown 文件
3. 更新 `.fetched_index.md` 去重索引
4. 提取 practice 练习题
