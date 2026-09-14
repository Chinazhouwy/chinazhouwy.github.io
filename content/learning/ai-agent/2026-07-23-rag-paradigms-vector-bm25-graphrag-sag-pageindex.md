---
title: "RAG 检索范式演进：向量RAG、BM25混合检索、GraphRAG、SAG 与 PageIndex"
date: "2026-07-23"
domain: "学习"
area: "AI Agent"
module: "Agent 工程与源码"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "按检索能力演进整理五种 RAG 范式：向量RAG 的语义召回与三大短板、BM25 混合检索、GraphRAG 的多跳推理与构建成本、SAG 用 SQL 事件-实体表替代全局图、PageIndex 无向量不切片的目录树推理，并逐条核验论文与官方仓库口径。"
tags:
  - RAG
  - 向量检索
  - BM25
  - 混合检索
  - GraphRAG
  - 知识图谱
  - SAG
  - PageIndex
source: "微信公众号「小码AI笔记」"
source_url: "https://mp.weixin.qq.com/s/NQcwdB4JKbPj8c29N1UU_Q"
published_at: "2026-07-23 11:45:12 +08:00"
---

# RAG 检索范式演进：向量RAG、BM25混合检索、GraphRAG、SAG 与 PageIndex

![题图：卡通角色手持地图沿路线依次经过 Vector RAG、BM25、GraphRAG、SAG、PageIndex，标题"RAG 的检索路线"](./2026-07-23-rag-paradigms-images/01.png)

> **类型**：📚 技术文章整理（非面试题 / 面经）
>
> **原文标题**：《RAG入门：一文搞懂向量RAG、BM25、知识图谱(GraphRAG)、SAG、PageIndex工作逻辑、演进》
>
> **来源**：微信公众号「小码AI笔记」
>
> **原文环境**：未注明版本；文中配图为 gpt-image-2 生成的示意图（原文声明），非真实系统截图
>
> **发布时间**：2026-07-23 11:45（北京时间）
>
> **整理时间**：2026-09-14
>
> **核验原则**：原文的"RAG 1.0 / 1.5 / 2.0"代际编号是作者教学框架，不是行业标准命名。本笔记保留其演进主线，对 BM25 由来、GraphRAG / SAG / PageIndex 的官方口径逐条核验（见「勘误与补充」）。
>
> 一手来源：
>
> - arXiv 论文（RAG 原始论文与 SAG 论文）[2][3]
> - 官方 GitHub README（PageIndex 与 GraphRAG）[6][7]
> - Lucene Javadoc 与 Elasticsearch 参考文档 [4][5]

## 一、为什么需要 RAG

LLM 的成品是一个权重文件，知识停留在训练数据截止的那一刻；企业内部文档、私密数据、高时效信息它都不具备，问到了就可能编造事实（幻觉）[1]。RAG（Retrieval-Augmented Generation，检索增强生成）的做法是给 LLM 外挂知识库，问答时先检索、把相关内容"塞小抄"进上下文 [1]。原始论文的定义是"结合预训练的参数化记忆与非参数化记忆"来做知识密集型任务 [2]——注意论文目标是提升知识密集任务表现，"解决幻觉"是工程上的衍生收益且只能缓解、不能根除（见勘误 2）。

原文强调：RAG 三个字母里最难的是 R（检索），做知识库本质上就是在做检索引擎，大部分工作甚至不涉及 LLM [1]。

## 二、RAG 的通用工作逻辑

![RAG 系统工作原理：用户问题 → 问题改写 → 向量检索访问知识库/向量数据库 → 重排 → Prompt 拼装 → LLM 生成答案 → 引用输出](./2026-07-23-rag-paradigms-images/02.png)

G（生成）是配合 LLM 完成问答；检索侧的构建（解析、索引、召回、重排）才是知识库工程的主战场 [1]。下面五种范式，变的基本都是"检索怎么建、怎么召回"这一层。

## 三、RAG 1.0：向量 RAG（Vector RAG）

![RAG 1.0 向量检索流程：文档解析 → 分块 → 向量化 → 存入向量数据库；用户问题向量化后做相似度检索，相关 Chunk 与问题一起注入 LLM 生成答案](./2026-07-23-rag-paradigms-images/03.png)

最经典、应用最广的范式，构建流程：**文档解析 → 文本分片 → 向量化（Embedding）→ 存入向量数据库 → 相似度召回** [1]。

原理：嵌入模型把词句转为高维数字向量（如 1024 维），语义相近的内容在向量空间里距离近——"苹果"和"香蕉"近、和"电脑"远，用空间距离度量语义相似度 [1]。向量数据库（Milvus、Pinecone、LanceDB 等）把索引与检索封装成 SDK/API [1]。

向量检索的三大短板 [1]：

1. **缺多跳推理**："张三在李四的公司做过什么项目？"需要先跳关系再找答案，单次相似度召回做不到（→ GraphRAG）；
2. **做不了条件筛选**："找出 2025 年之后、关于 Agent 企业落地、大于 5000 字的调研报告"这类结构化过滤是 SQL 的强项；
3. **语义噪音**：向量近 ≠ 意思对，"我去年买了台苹果电脑"与"我昨天吃了个苹果"会被判高相关，无关内容混进上下文拉低回答质量。

一句话：向量只擅长语义"模糊匹配" [1]。

## 四、RAG 1.5：混合检索（向量 + BM25）

![RAG 1.5 混合检索：用户问题同时走向量检索（语义相近）与 BM25 关键词检索（精确匹配），两路结果融合得到更完整的相关资料](./2026-07-23-rag-paradigms-images/04.png)

为弥补纯语义检索，把传统关键词算法 BM25 请回来：用户查"编号9527""苹果16 Pro Max"这类精确目标时，关键词匹配是强项 [1]。BM25 的核心逻辑是看关键词在文中的**出现次数**与**稀有度**：次数越高、越稀有，文档权重越高 [1]。

它是 Elasticsearch 的默认相似度算法 [4]，Lucene 实现默认参数 k1=1.2、b=0.75 [5]。

实践中向量 + BM25 组成混合检索（Hybrid Search），原文称其"成了主流知识库的标配"，并举例 Milvus 内置 BM25 与混合检索模式 [1]（Milvus 该能力未能从本机核验，见勘误 4）。两路结果如何融合排序（RRF、加权等），仓库已有专篇：[RAG混合检索：MeiliSearch vs Milvus](./rag-hybrid-search-meilisearch.md)。

## 五、RAG 2.0：GraphRAG（知识图谱 + 多跳推理）

![RAG 2.0 GraphRAG：原始文档经 LLM 提取实体与关系构建知识图谱，查询时沿边多跳（张三 → 腾讯 → ima 知识库），并标注构建成本与准确性问题](./2026-07-23-rag-paradigms-images/05.png)

针对复杂关系的多跳查询，把知识组织成图：**节点 = 实体**（人物、地点、事件、公司），**边 = 关系**（任职于、发生在、推出了）[1]。微软开源的 GraphRAG 项目做了示范 [1][7]。

官方 README 的定位是"用 LLM 从未结构化文本中提取有意义的结构化数据"的数据管线与转换套件，并明确"本仓库展示的是一种方法论……不是微软官方支持的产品" [7]。

构建流程（LLM 提取，不靠人力）[1]：

```text
文档解析 → 文本分片 ─┬→ LLM 提取实体关系 → 全局融合(合并去重) → 存入图数据库(Graph)
                     └→ 计算文本向量化 → 存入向量数据库(Vector)   ← 为后续混合检索保留
```

检索模式是"顺着边爬"：问"张三的公司做了什么产品？"，向量检索可能连不上"张三"和"产品"，图检索则 张三 →(加入) 腾讯 →(拥有产品) ima，两跳拿到答案，这就是**多跳推理**；数据再大，关系检索也很快 [1]。

GraphRAG 的代价（原文自己点破，且与官方一致）[1][7]：

- **构建即引入幻觉**：实体关系靠 LLM 提取，LLM 自身有幻觉——"本想用 RAG 解决幻觉，构建 RAG 时先引入了幻觉" [1]；
- **token 消耗巨大、维护又慢又贵**：一个文件更新可能要重算整个图关系 [1]；官方 README 同样警告"GraphRAG 索引可能是昂贵的操作，请通读文档理解流程与成本，从小规模开始" [7]。

## 六、演进方向：SAG（结构化 RAG / SQL-RAG）

![SAG 架构：文档分片后一路向量化入向量库，另一路由 LLM 提取事件与实体写入 SQL 库（事件表、实体关联表）；查询时向量召回种子 Chunk，再用 SQL 沿实体扩展关联事件，合并注入 LLM 上下文](./2026-07-23-rag-paradigms-images/06.png)

换思路：不建全局图，只把分片抽成**事件**与**实体**存进 SQL 库，提问时用 SQL 动态拼接关联事件 [1]。对应论文《SAG: SQL-Retrieval Augmented Generation with Query-Time Dynamic Hyperedges》（arXiv:2606.15971）与开源仓库 Zleap-AI/SAG [1][3]。

论文口径：SAG 是"把文档组织成事件-实体索引、不构建全局知识图谱"的结构化检索架构，每个 Chunk 表示为一个语义完整的事件及其关联实体，形成**隐式超边（latent hyperedge）**，无需拆成三元组即可保留 n 元关系 [3]。

构建与查询 [1]：

```text
构建：文档解析 → 文本分片 ─┬→ LLM 提取事件/实体 → 存入 SQL（事件表 + 实体关联表）
                           └→ 向量化 → 存入向量数据库
查询：向量语义检索拿"种子"Chunk → 映射到 SQL 记录找实体/事件
      → 拿实体到 SQL 精确查询扩展相关事件（可多轮，即多跳）
      → 原始 Chunk + 拼出的事件一起注入 LLM 上下文
```

原文例子："2026年加入腾讯的那个谁，他以前在阿里做什么？"——向量命中含"腾讯"的 Chunk，映射出实体"腾讯"，SQL 查到事件"张三 2026 入职腾讯"，从事件行里发现新实体"张三"，再拿"张三"回 SQL 查全部经历，两跳完成，效果类似图数据库的多跳查询 [1]。**向量依然是 C 位**：SAG 本质是在向量 RAG 上加一层 SQL 结构查询；事件在系统里既是检索桥梁，也作为高纯度"小抄"注入上下文 [1]。

对原文的一个补充：论文的核心贡献是"查询时动态超边"——事件作为超边同时连接多个实体，保留 n 元关系 [3]；原文简化成"两张表 + SQL 拼接"，把最有区分度的超边表述丢掉了，读论文时注意对齐。原文对 SAG 的态度也很克制："所谓 SAG 依然是 RAG，能不能替换 GraphRAG 不敢下结论，但思想值得学习。" [1]

## 七、另一条路：PageIndex（无向量、不切片）

![PageIndex 架构：LLM 为长文档构建目录树（JsonTree），检索时由 LLM 沿树推理定位相关章节，读取对应原文注入上下文生成答案，全程无向量数据库、无分片](./2026-07-23-rag-paradigms-images/07.png)

Vectify AI 提出的 PageIndex 与前几种都不同：**不用向量、不切片** [1][6]。官方 README 的口号就是 "Vectorless, Reasoning-based RAG / No Vector DB, No Chunking"，思路受 AlphaGo 启发：用层级目录树索引替代向量索引，让 LLM 像人类专家翻报告一样"推理着走"到正确章节 [6]。

工作逻辑 [1][6]：

1. 构建：LLM 给文档生成可索引的目录树（JsonTree），记录章节、节点、定位（页码/行数），可为节点生成摘要；
2. 检索：LLM 先看目录树，推理出答案所在章节；
3. 回源：按定位取回完整原文段落注入上下文。

原文点出的局限（与官方定位一致）[1][6]：**每一步都强依赖 LLM**——建树、摘要、检索全靠模型推理，小尺寸模型很难玩转（能力不足、幻觉严重，目录树都建不好）；**海量文档场景存疑**：单篇 100 页的文档问答很好，100 篇、1000 篇怎么办？原文给了两个思路：先用向量检索缩小命中范围再逐篇注入 JsonTree；或给全部文档建文件级目录树，让 AI 像人浏览文件夹一样逐级打开 [1]。

## 八、五种范式对照速查

| 范式 | 索引形态 | 强项 | 短板 | 依赖 |
|---|---|---|---|---|
| 向量 RAG | 向量库 | 语义模糊匹配、通用 | 多跳、条件筛选、语义噪音 [1] | Embedding 模型 |
| 混合检索（+BM25） | 向量库 + 倒排 | 语义 + 精确关键词互补 [1][4] | 融合排序要调 | 两路引擎 |
| GraphRAG | 图数据库 | 多跳关系推理 [1] | 构建贵、LLM 提取带幻觉、更新重算 [1][7] | LLM 重度 |
| SAG | 向量库 + SQL 事件/实体表 | 轻量获得类图多跳能力 [1][3] | 事件抽取质量仍靠 LLM | LLM 中度 |
| PageIndex | 目录树 JSON | 无向量无切片、长文档定位准 [1][6] | 全程强依赖 LLM、海量文档难扩展 [1] | LLM 极重度 |

原文结论：**没有最好的单一选择，通常是多种模式混合使用**；向量 RAG + BM25 是企业知识库最扎实、性价比最高的路径，GraphRAG 补全多跳关系检索，SAG 值得尝试用来轻量实现图能力 [1]。

## 勘误与补充

### 1. BM25 的"第 25 次调整"是坊间说法（口径核验）

- **原文表述**：""BM"是 Best Match（最佳匹配），"25"是第 25 次算法调整的版本（前 24 次都不太行），它在上个世纪 90 年代就诞生了" [1]。
- **更准确**："BM = Best Match"与"90 年代诞生（Okapi 系统）"是通行说法，但"第 25 次调整、前 24 次都不太行"的编号故事没有找到一手文献佐证，按趣闻对待 [unverified]。工程上可核验的事实是：BM25 是 Elasticsearch 的默认相似度算法 [4]；Lucene `BM25Similarity` 默认参数 k1=1.2、b=0.75、discountOverlaps=true [5]。
- **验证方式**：Elasticsearch 官方参考文档、Lucene 9.11.1 Javadoc（本机直连抓取）。

### 2. "RAG 解决幻觉"应收敛为"缓解知识缺失型幻觉"（论文口径）

- **原文表述**："RAG 存在的目的就是为了解决大模型上下文受限、幻觉问题" [1]。
- **更准确**：原始论文（Lewis et al., 2020）把 RAG 定义为"结合参数化与非参数化记忆"以改进**知识密集型 NLP 任务** [2]；幻觉缓解是衍生收益。且 RAG 只能覆盖"模型不知道"这类幻觉——检索内容本身有错、或模型不按检索内容作答时，幻觉照样发生（GraphRAG 一节"构建时先引入幻觉"正是原文自己给出的反例 [1]）。
- **验证方式**：arXiv:2005.11401 摘要页。

### 3. GraphRAG 是"方法论演示仓库"，且官方自己警告成本（核验属实 + 补充）

- **原文表述**："微软也开源了个 GraphRAG 项目，给大家做了示范"；"基于 LLM 提取实体关系还有巨大的 token 消耗，维护成本又高又慢" [1]。
- **核验**：成本警告与官方一致——README 明言"GraphRAG indexing can be an expensive operation" [7]。补充一个原文没提的边界：该仓库自述"presented as a methodology … not an officially supported Microsoft offering"，即方法论演示而非微软官方支持产品，生产选型时不能按"微软背书"理解 [7]。
- **验证方式**：github.com/microsoft/graphrag README（本机直连抓取）。

### 4. "Milvus 内置 BM25"未能核验（来源不可达）

- **原文表述**："向量数据库 Milvus 内置 BM25 和混合检索模式，使用起来非常方便" [1]。
- **核验结果**：milvus.io 文档站从本机不可达（HTTP 403），该能力的版本与形态未独立核验 [unverified]。仓库旧篇对 Milvus 混合检索的记录是"需要额外配置 BM25"（见 [RAG混合检索：MeiliSearch vs Milvus](./rag-hybrid-search-meilisearch.md)），两说并存，落地前查对应版本官方文档。
- **附注**：原文结尾推荐的腾讯 WeKnora"1.8 万 Star"同样无法核验（GitHub API 本机不可达）[unverified]。

### 5. SAG 的"超边"核心被原文简化（论文补充）

- **原文表述**：SAG = "向量 RAG 上增加一层 SQL 结构查询"，事件表 + 实体关联表两张表 [1]。
- **更准确**：论文标题即点出核心机制 Query-Time Dynamic Hyperedges——每个 Chunk 是"语义完整的事件 + 关联实体"，构成隐式超边，**不拆三元组**就能保留 n 元关系（这正是它对 GraphRAG 三元组化建图的差异化）[3]。只记"两张表"会丢掉这个设计动机。
- **验证方式**：arXiv:2606.15971 标题与摘要（本机直连抓取）。

### 6. "RAG 1.0 / 1.5 / 2.0"是作者的教学编号

代际编号是原文自己的叙事框架，方便记忆演进主线，但业界没有统一的"RAG 版本"标准命名；GraphRAG、SAG、PageIndex 是并行出现的不同路线，不是严格的版本迭代关系 [unverified]。

## 关联本仓库资料

- 混合检索落地对比（semanticRatio、RRF 融合）：[RAG混合检索：MeiliSearch vs Milvus](./rag-hybrid-search-meilisearch.md)
- 向量检索底层（ANN 索引学术前沿）：[ICDE 2026 CCD 向量近似最近邻](./xiaohongshu-icde2026-ccd-vector-ann.md)
- 代码检索场景的"检索 vs 推理"之争：[Claude Code 用 grep 而非 RAG 做代码检索](./claude-code-grep-vs-rag-code-retrieval.md)

## 原始链接

https://mp.weixin.qq.com/s/NQcwdB4JKbPj8c29N1UU_Q

## Sources

[1] https://mp.weixin.qq.com/s/NQcwdB4JKbPj8c29N1UU_Q — RAG入门：向量RAG、BM25、GraphRAG、SAG、PageIndex（公众号：小码AI笔记）
[2] https://arxiv.org/abs/2005.11401 — RAG原始论文（Lewis et al., 2020）
[3] https://arxiv.org/abs/2606.15971 — SAG论文：SQL-Retrieval Augmented Generation with Query-Time Dynamic Hyperedges
[4] https://www.elastic.co/guide/en/elasticsearch/reference/current/index-modules-similarity.html — Elasticsearch 参考文档：Similarity module（BM25 为默认）
[5] https://lucene.apache.org/core/9_11_1/core/org/apache/lucene/search/similarities/BM25Similarity.html — Lucene Javadoc: BM25Similarity
[6] https://github.com/VectifyAI/PageIndex — PageIndex GitHub README（Vectorless, Reasoning-based RAG）
[7] https://github.com/microsoft/graphrag — Microsoft GraphRAG GitHub README
