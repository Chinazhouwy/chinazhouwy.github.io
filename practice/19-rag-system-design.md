---
schema_version: 1
question_id: 19
question: "请设计一个完整的 RAG（Retrieval-Augmented Generation，检索增强生成）系统。"
date: 2026-06-06
sources:
  - unknown
score: "5/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
# 第19题 — RAG 系统设计（检索增强生成全流程）

> **题目**：请设计一个完整的 RAG（Retrieval-Augmented Generation，检索增强生成）系统。
> **方向**：AI ⭐
> **练习日期**：2026-06-06
> **来源**：active-batch-plan.md 计划题

---

## 得分：5/10

### ✅ 答对的部分
- 分块策略：语义分块、标点符号分块、固定大小分块 ✓
- 分块大小权衡：太大有错误信息，太小分割重点 ✓
- Overlap 重叠切割：前后带冗余重叠 ✓
- RAG vs Fine-tuning 有基本方向：RAG适合外部知识动态更新；Fine-tuning更适合风格、格式、任务行为适配，不建议简单理解成“固定知识就微调” ✓/⚠️

### ❌ 问题
- 没有说明整体架构和数据流
- 文档处理流程只提了分块，缺少解析、Embedding（向量化）等步骤
- 检索策略（稠密/稀疏/混合检索）完全没提
- 生成阶段如何利用检索结果没说
- 评估和优化RAG效果没提

---

## 一、RAG 整体架构

### 数据流（两条主线）

```
┌─────────────────────────────────────────────────────────────┐
│                      离线索引流程                              │
│  文档 → 解析 → 分块(Chunking) → Embedding → 向量存储        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      在线查询流程                              │
│  用户问题 → Query Embedding → 向量检索 → 重排序 → LLM生成    │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 作用 | 技术选型 |
|------|------|----------|
| 文档解析器 | 提取文本/表格/图片 | Apache Tika、PyMuPDF、Unstructured |
| 分块器（Chunker） | 将长文档切成合适大小 | LangChain TextSplitter、LlamaIndex |
| Embedding 模型 | 文本→向量 | OpenAI text-embedding-3、BGE、GTE |
| 向量数据库 | 存储和检索向量 | Milvus、Qdrant、Weaviate、Chroma |
| 重排序（Reranker） | 精排检索结果 | Cohere Rerank、BGE-Reranker |
| LLM 生成器 | 基于检索结果生成答案 | GPT-4、Claude、本地模型 |

---

## 二、文档处理流程详解

### 步骤1：文档解析

```python
# 示例：PDF解析
import pymupdf

doc = pymupdf.open("document.pdf")
for page in doc:
    text = page.get_text()  # 提取纯文本
```

### 步骤2：分块（Chunking）

**分块策略对比**：

| 策略 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| 固定大小 | 按字符数切割 | 简单快速 | 可能切断语义 |
| 按语义 | 用Embedding计算语义相似度，在语义断裂处切割 | 保持语义完整 | 计算开销大 |
| 按标点/段落 | 在句号、换行处切割 | 自然分界 | 块大小不均匀 |
| 递归分割 | 先按段落→句子→词逐级细分 | 灵活 | 实现复杂 |

**Overlap（重叠）的作用**：

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,      # 每块500字符
    chunk_overlap=100,   # 相邻块重叠100字符
    separators=["\n\n", "\n", "。", "，", " "]  # 优先按这些分隔
)

chunks = splitter.split_text(long_document)
```

**重叠比例建议**：10%~20%，太少会丢失上下文，太多会增加冗余。

### 步骤3：Embedding（向量化）

```python
from openai import OpenAI

client = OpenAI()
response = client.embeddings.create(
    input="什么是RAG系统？",
    model="text-embedding-3-small"  # 1536维向量
)

vector = response.data[0].embedding  # [0.012, -0.034, ...]
```

### 步骤4：向量存储

```python
from pymilvus import Collection, FieldSchema, DataType

fields = [
    FieldSchema("id", DataType.INT64, is_primary=True),
    FieldSchema("embedding", DataType.FLOAT_VECTOR, dim=1536),
    FieldSchema("content", DataType.VARCHAR, max_length=2000),
    FieldSchema("metadata", DataType.JSON)
]

collection.insert([ids, embeddings, contents, metadatas])
```

---

## 三、检索策略

### 三种检索方式对比

| 类型 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| **稠密检索**（Dense） | 向量相似度（余弦/内积） | 语义理解强 | 对精确关键词匹配弱 |
| **稀疏检索**（Sparse） | BM25/TF-IDF 关键词匹配 | 精确匹配强 | 不理解语义 |
| **混合检索**（Hybrid） | 两者结合（加权融合） | 兼顾语义和精确匹配 | 需要调权重 |

### 混合检索的融合方式（RRF）

```python
def reciprocal_rank_fusion(results_list, k=60):
    """
    k=60 是论文推荐值，平滑参数
    """
    fused_scores = {}
    for results in results_list:
        for rank, item in enumerate(results):
            if item not in fused_scores:
                fused_scores[item] = 0
            fused_scores[item] += 1 / (k + rank + 1)
    
    return sorted(fused_scores.items(), key=lambda x: x[1], reverse=True)
```

### 重排序（Reranker）

检索出 Top-K（如20条）后，用更精确的模型重排序，选出 Top-N（如3-5条）送给LLM：

```python
import cohere

co = cohere.Client("API_KEY")
results = co.rerank(
    query="RAG系统怎么设计？",
    documents=retrieved_docs,
    top_n=5,
    model="rerank-english-v3.0"
)
```

---

## 四、生成阶段

### Prompt 模板设计

```python
SYSTEM_PROMPT = """你是一个专业的技术顾问。请基于以下检索到的文档内容回答问题。

规则：
1. 只基于提供的文档内容回答，不要编造
2. 如果文档中没有相关信息，明确说"根据现有资料无法回答"
3. 引用具体文档来源（如[1]、[2]）

检索到的文档：
{context}

用户问题：{question}
"""
```

---

## 五、评估和优化RAG效果

### 评估指标

| 维度 | 指标 | 说明 |
|------|------|------|
| **检索质量** | Recall@K | Top-K中包含正确文档的比例 |
| | MRR（Mean Reciprocal Rank） | 正确文档的排名倒数均值 |
| **生成质量** | Faithfulness（忠实度） | 答案是否基于检索结果，不编造 |
| | Relevance（相关性） | 答案是否回答了用户问题 |

### 优化方向

| 问题 | 优化方案 |
|------|----------|
| 检索不到相关文档 | 优化分块策略、换Embedding模型、加Hybrid检索 |
| 检索到了但答案不对 | 加Reranker、优化Prompt模板 |
| 答案有幻觉（编造） | 强调"只基于文档回答"、加Faithfulness检测 |

---

## 六、用户追问+纠正记录

### 追问1：分块大小如何选择？
**用户回答**：分块大小按照语义、标点符号、或者固定块。太大容易有错误信息，太小容易分割了重点信息。
**最终结论**：✓ 正确。分块策略的选择取决于文档类型，递归分割（先段落→句子→词）是最灵活的方案。

### 追问2：如何处理跨Chunk的上下文丢失？
**用户回答**：前后都带点冗余的进行文档切割，这样都有重叠。
**最终结论**：✓ 正确。Overlap（重叠）比例建议10%~20%，太少会丢失上下文，太多会增加冗余。

### 追问3：RAG vs Fine-tuning 在什么场景下选哪个？
**用户回答**：文档用RAG就好，可以自动调节更新。微调是要进入到模型端的，固定不变的可以进行微调。
**最终结论**：✓ 基本正确。补充：RAG适合知识库问答（动态更新），Fine-tuning适合特定风格/格式/领域适配（固定知识）。两者也可以结合。

---

## 七、最终结论

### 骨架答案（一句话核心）
> RAG = 离线索引（文档→分块→向量化→存储）+ 在线查询（问题→检索→融合→生成）。核心是混合检索（稠密+稀疏）+ RRF融合 + Reranker精排。

---

## 八、这次讨论的收获

- RAG系统分两条线：离线索引和在线查询
- 分块策略：递归分割最灵活，Overlap保持上下文连贯
- 检索策略：混合检索（稠密+稀疏）通常比纯向量更稳，但具体提升要靠评测集验证，不能背固定百分比
- RRF融合简单有效，不需要调权重
- RAG vs Fine-tuning：知识经常更新用RAG，特定风格适配用微调
