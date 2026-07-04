# 面试知识库 RAG 系统设计方案

> **日期**：2026-06-06
> **状态**：待定（用户后续确认后实施）
> **目标**：把 ~/interview/ 下的面试资料做成可问答的RAG系统

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    离线索引（一次性）                       │
│                                                         │
│  ~/interview/**/*.md  →  文档解析  →  分块(Chunking)     │
│       ↓                                                 │
│  Embedding模型(BGE)  →  向量存入Chroma                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    在线查询（每次提问）                     │
│                                                         │
│  用户问题  →  Embedding  →  向量检索Top-5                 │
│       ↓                                                 │
│  BM25关键词检索  →  混合融合(RRF)                         │
│       ↓                                                 │
│  拼接上下文  →  LLM生成答案(DeepSeek API)                 │
└─────────────────────────────────────────────────────────┘
```

---

## 二、技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| **文档解析** | 直接读md | 你全是markdown，不需要PDF解析 |
| **分块** | RecursiveCharacterTextSplitter | 按段落→句子→词逐级切，保持语义完整 |
| **Embedding** | BGE-base-zh-v1.5 | 中文效果好，本地运行，免费 |
| **向量库** | Chroma | 轻量级，pip install 就能用，无需部署 |
| **关键词检索** | jieba + BM25 | 中文分词 + 经典关键词匹配 |
| **混合融合** | RRF（Reciprocal Rank Fusion） | 简单有效，不需要调权重 |
| **生成** | DeepSeek API | 已有API，1M上下文 |

---

## 三、文件结构

```
~/rag-interview/
├── index.py          # 离线索引脚本（扫描md → 分块 → 向量化 → 存Chroma）
├── query.py          # 查询脚本（提问 → 检索 → 生成答案）
├── web.py            # Web界面（可选，Streamlit）
├── chroma_db/        # Chroma向量库（自动生成）
└── requirements.txt  # 依赖
```

---

## 四、核心代码概览

### 4.1 分块策略

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,       # 每块500字符
    chunk_overlap=100,    # 相邻块重叠100字符
    separators=["\n\n", "\n", "。", "，", " "]
)

chunks = splitter.split_text(document)
```

### 4.2 混合检索

```python
def hybrid_search(query, top_k=5):
    # 稠密检索（向量相似度）
    query_embedding = embed_model.encode(query)
    dense_results = collection.query(query_embedding, n_results=10)
    
    # 稀疏检索（BM25关键词）
    query_tokens = jieba.cut(query)
    sparse_results = bm25.get_top_n(query_tokens, documents, n=10)
    
    # RRF融合
    final_results = reciprocal_rank_fusion([dense_results, sparse_results])
    return final_results[:top_k]
```

### 4.3 RRF 融合算法

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

### 4.4 查询流程

```python
def query(question):
    # 1. 检索
    context = hybrid_search(question, top_k=5)
    
    # 2. 拼接prompt
    prompt = f"""基于以下面试资料回答问题。要求用中文回答，包含具体例子和代码。

资料：
{context}

问题：{question}
"""
    
    # 3. 调用LLM
    answer = call_deepseek(prompt)
    return answer
```

---

## 五、效果预估

| 指标 | 预估 |
|------|------|
| 索引时间 | ~2分钟（130+个md文件） |
| 向量库大小 | ~50MB |
| 单次查询延迟 | <1秒（本地Embedding + Chroma） |
| 准确率 | 80%+（混合检索比纯向量高10-15%） |

---

## 六、踩坑预判

| 坑 | 应对 |
|---|---|
| md文件格式不统一 | 先统一清洗（去掉代码块标记、统一标题格式） |
| 分块切断表格 | 表格整体作为一个chunk，不切割 |
| 中文分词不准 | 用jieba分词，BM25效果比英文差但够用 |
| 检索到但答案不对 | 加Reranker精排，或增加top_k |
| 代码块被切割 | 用自定义separator，遇到```就不切 |

---

## 七、待确认项

1. **Embedding模型**：本地BGE（免费，~400MB） vs API（如DeepSeek Embedding，按量付费）
2. **Web界面**：Streamlit简单页面 vs 纯命令行
3. **实施时间**：用户确认后开干，预计30分钟

---

## 八、与AI编程工具的本地搜索对比

| 工具 | 搜索方式 | 说明 |
|------|---------|------|
| Claude Code | ripgrep (rg) | 文本搜索，不是向量搜索 |
| Codex CLI | ripgrep (rg) | 同上 |
| OpenCode | ripgrep (rg) | 同上 |
| Cursor | ripgrep + Codebase Indexing | 可选向量索引 |

**为什么AI编程工具不用向量搜索？**
1. 代码搜索需要精确匹配（函数名、变量名），语义搜索反而不准
2. ripgrep 够快，毫秒级返回
3. 向量搜索需要预建索引，代码经常改，索引要维护

**Cursor的Codebase Indexing是例外**：用向量嵌入做跨文件语义搜索，适合"这个功能在哪个文件实现的"这类问题。
