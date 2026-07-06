---
title: "阿里国际 AI Agent 面经（深度版）"
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
summary: "阿里国际 AI Agent 面经（深度版）"
tags:
---

# 阿里国际 AI Agent 面经（深度版）

> **来源**: [小红书](http://xhslink.com/o/AELHUBXEkv5)
> **发布日期**: 2026-05
> **标签**: `阿里国际` `AI Agent` `RAG` `Agent框架` `MCP` `LangGraph` `记忆系统` `Prompt工程`
> **考点分类**: RAG核心技术 / Agent框架与工具 / 网络通信 / Prompt工程 / 记忆系统 / 工程实现 / 计算机基础

---

## 面试结构

- **一、RAG核心技术**（Q1-Q5）：检索索引、重排序、多路融合、文档切分、向量化模型
- **二、Agent框架与工具开发**（Q6-Q9）：MCP Server、LangGraph状态流转、多Agent重试、Function Calling
- **三、网络与基础通信**（Q10）：SSE vs WebSocket
- **四、Prompt工程**（Q11）：Prompt设计原则
- **五、上下文&记忆系统**（Q12-Q16）：上下文压缩、记忆设计、异步工程、短期记忆存储
- **六、工程实现与兜底方案**（Q17-Q18）：兜底机制、数据库选型
- **七、计算机基础&数据库**（Q19-Q21）：LRU、Redis数据类型与场景
- **八、个人流程类**（Q22-Q23）：成绩、其他流程

---

## 一、RAG核心技术（一面高频）

### Q1: RAG的检索索引有哪些？

**答题思路**：不要只说"向量索引"，要从索引类型→适用场景→工程选型三个层次讲。

**深度解答**：

RAG系统中常用的检索索引分为三大类：

| 索引类型 | 代表实现 | 适用场景 | 特点 |
|---------|---------|---------|------|
| **稠密向量索引** | FAISS/HNSW/Milvus | 语义相似搜索 | 需Embedding模型，语义理解强 |
| **稀疏向量索引** | BM25/Elasticsearch | 关键词精确匹配 | 不需要模型，经典IR方法 |
| **混合索引** | Elasticsearch+Milvus | 生产环境标配 | 兼顾精确+语义 |

**向量索引内部实现**：
- **FAISS IVF**：倒排索引，先聚类再搜索，适合大数据量，但需要调nlist参数
- **FAISS HNSW**：层次导航小世界图，召回率高，内存占用大，适合<1M数据
- **Milvus**：分布式向量库，支持IVF_FLAT/IVF_PQ/HNSW，适合生产部署

```java
// Spring AI + Milvus: 向量索引创建与检索
@Configuration
public class RagIndexConfig {

    // 1. 稠密向量索引——Milvus HNSW
    @Bean
    public MilvusVectorStore denseVectorStore(MilvusServiceClient milvusClient,
                                               EmbeddingModel embeddingModel) {
        return MilvusVectorStore.builder(milvusClient, embeddingModel)
            .collectionName("rag_dense_docs")
            .indexType(IndexType.HNSW)           // HNSW图索引
            .metricType(MetricType.COSINE)        // 余弦相似度
            .embeddingDimension(1536)             // OpenAI ada-002维度
            .build();
    }

    // 2. 稀疏向量索引——Elasticsearch BM25
    @Bean
    public ElasticsearchVectorStore sparseVectorStore(RestHighLevelClient esClient) {
        // Elasticsearch天然支持BM25，无需额外配置
        return ElasticsearchVectorStore.builder(esClient)
            .collectionName("rag_sparse_docs")
            .build();
    }
}

// 3. 混合检索——合并两路结果
@Component
public class HybridRetriever {
    private final MilvusVectorStore denseStore;
    private final ElasticsearchVectorStore sparseStore;

    public List<Document> hybridSearch(String query, int topK) {
        // 稠密检索：语义相似
        var denseResults = denseStore.similaritySearch(
            SearchRequest.builder().query(query).topK(topK).build());

        // 稀疏检索：关键词匹配
        var sparseResults = sparseStore.similaritySearch(
            SearchRequest.builder().query(query).topK(topK).build());

        // Reciprocal Rank Fusion合并
        return reciprocalRankFusion(denseResults, sparseResults, topK);
    }

    private List<Document> reciprocalRankFusion(
            List<Document> dense, List<Document> sparse, int topK) {
        Map<String, Double> scores = new HashMap<>();
        double k = 60.0; // RRF常数

        for (int i = 0; i < dense.size(); i++) {
            String id = dense.get(i).getId();
            scores.merge(id, 1.0 / (k + i + 1), Double::sum);
        }
        for (int i = 0; i < sparse.size(); i++) {
            String id = sparse.get(i).getId();
            scores.merge(id, 1.0 / (k + i + 1), Double::sum);
        }

        return scores.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .limit(topK)
            .map(e -> findDoc(e.getKey(), dense, sparse))
            .toList();
    }
}
```

**工程踩坑点**：
- FAISS单机版不要用在生产——不支持持久化、不支持分布式，重启丢数据
- HNSW的efConstruction参数影响建索引速度和质量，efConstruction=256是性价比平衡点
- 混合检索的关键不是"怎么搜"，而是"怎么融合"——RRF比加权求和更鲁棒

---

### Q2: RAG的重排序知道吗？有哪些重排方法？

**答题思路**：重排序是RAG效果提升的关键步骤，要讲清为什么需要重排、有哪些方法、怎么选。

**深度解答**：

**为什么需要重排序？**
- 初筛（向量检索/BM25）是"快速粗选"，Top-K里可能混入不相关文档
- 重排序用更精细的模型做"二次打分"，把真正相关的提到前面

| 重排方法 | 原理 | 延迟 | 效果 | 适用场景 |
|---------|------|------|------|---------|
| **Cross-Encoder** | Query+Doc拼接输入BERT，输出相关性分数 | 高（每对都要过模型） | 最好 | 离线/小规模 |
| **ColBERT** | 延迟交互，Token级别相似度 | 中 | 好 | 需要精细化匹配 |
| **Cohere Rerank** | API调用，无需部署 | 低（API延迟） | 好 | 快速集成 |
| **BGE-Reranker** | 开源Cross-Encoder | 中 | 好 | 自部署、中文场景 |
| **LLM Rerank** | 让LLM给文档打分 | 很高 | 不稳定 | 实验性 |

```java
// LangChain4j: BGE-Reranker集成
@Component
public class BgeReranker implements DocumentReranker {

    private final ChatLanguageModel rerankModel; // BGE-reranker-large

    @Override
    public List<Document> rerank(String query, List<Document> documents, int topK) {
        // 对每个文档计算相关性分数
        List<ScoredDocument> scored = documents.parallelStream()
            .map(doc -> {
                String prompt = String.format(
                    "判断以下文档与查询的相关性，只回复0-10的分数：\n查询：%s\n文档：%s",
                    query, doc.getText().substring(0, Math.min(500, doc.getText().length())));
                String score = rerankModel.generate(prompt);
                return new ScoredDocument(doc, parseScore(score));
            })
            .sorted(Comparator.comparingDouble(ScoredDocument::score).reversed())
            .limit(topK)
            .toList();

        return scored.stream().map(ScoredDocument::doc).toList();
    }
}

// Spring AI: 更规范的Reranker集成
@Component
public class CrossEncoderReranker {
    private final CrossEncoderModel crossEncoder; // ONNX Runtime加载BGE-reranker

    public List<Document> rerank(String query, List<Document> candidates, int topK) {
        return candidates.stream()
            .map(doc -> Map.entry(doc, crossEncoder.score(query, doc.getText())))
            .sorted(Map.Entry.<Document, Float>comparingByValue().reversed())
            .limit(topK)
            .map(Map.Entry::getKey)
            .toList();
    }
}
```

**工程踩坑点**：
- Cross-Encoder不能替代初筛——它的计算量是O(N)，N=所有文档，必须先用向量检索Top-K再重排
- BGE-Reranker有多个版本：bge-reranker-base（轻量）、bge-reranker-large（平衡）、bge-reranker-v2-m3（多语言），中文用v2-m3
- 重排序的topK不要太大——20→10比50→10效果好，因为噪声少了

---

### Q3: 多路检索怎么融合？

**答题思路**：多路融合是生产RAG的标配。核心方法是RRF和加权融合，要讲清原理和调参。

**深度解答**：

多路检索融合的三个层次：

**1. 简单加权融合**
```
final_score = α × dense_score + (1-α) × sparse_score
```
- 问题：稠密和稀疏的分数尺度不同（余弦0-1 vs BM25 0-30），直接加权不公平
- 需要先做MinMax归一化

**2. Reciprocal Rank Fusion（RRF）——最推荐**
```
final_score(d) = Σ 1/(k + rank_i(d))   // k=60是经验值
```
- 不需要分数归一化，只用排名
- 对单路检索的"噪声"鲁棒——偶尔排名异常不影响太多
- 是Elasticsearch 8.x默认的混合检索融合方法

**3. 学习型融合（Learned Fusion）**
- 训练一个小模型，输入多路分数，输出最终分数
- 效果最好但需要标注数据，工程成本高

```java
// Spring AI: RRF融合实现
public class ReciprocalRankFusion {

    private static final double K = 60.0;

    public List<ScoredDocument> fuse(List<List<ScoredDocument>> rankedLists, int topK) {
        Map<String, Double> rrfScores = new HashMap<>();
        Map<String, Document> docCache = new HashMap<>();

        for (List<ScoredDocument> rankedList : rankedLists) {
            for (int rank = 0; rank < rankedList.size(); rank++) {
                ScoredDocument sd = rankedList.get(rank);
                String docId = sd.getDocument().getId();

                // RRF公式：Σ 1/(k + rank + 1)
                rrfScores.merge(docId, 1.0 / (K + rank + 1), Double::sum);
                docCache.putIfAbsent(docId, sd.getDocument());
            }
        }

        return rrfScores.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .limit(topK)
            .map(e -> new ScoredDocument(docCache.get(e.getKey()), e.getValue()))
            .toList();
    }
}

// 使用示例：三路检索融合
@Component
public class ThreeWayRetriever {
    private final VectorStore denseStore;      // 向量检索
    private final ElasticsearchService bm25;    // BM25检索
    private final KeywordService keywordStore;  // 关键词精确匹配

    public List<Document> search(String query, int topK) {
        var denseResults = denseStore.similaritySearch(query, 20);
        var bm25Results = bm25.search(query, 20);
        var keywordResults = keywordStore.exactMatch(query, 20);

        var fusion = new ReciprocalRankFusion();
        return fusion.fuse(
            List.of(denseResults, bm25Results, keywordResults), topK);
    }
}
```

**工程踩坑点**：
- RRF的k值（默认60）不是越大越好——k太大所有文档分数趋同，k太小只看排名前几的文档。60是经验最优值
- 多路检索的路数不是越多越好——3路（向量+BM25+关键词）是性价比最优，超过5路收益递减
- 每路返回的候选数要一致——不然某路返回100个，另一路只返回5个，排名不公平

---

### Q4: 文档切分方法能说出来几种？当前最主流的切分方式是哪个？

**答题思路**：切分是RAG效果的基础，切不好后面全白搭。要讲清5种以上方法，并指出当前主流。

**深度解答**：

| 切分方法 | 原理 | 优点 | 缺点 | 适用场景 |
|---------|------|------|------|---------|
| **固定长度切分** | 按token数/字符数切 | 最简单、最稳定 | 语义断裂 | 兜底方案 |
| **递归字符切分** | 按分隔符层级切（\n\n→\n→。→空格） | 平衡长度和语义 | 分隔符不够时退化 | **当前最主流** |
| **语义切分** | Embedding相邻句子，相似度骤降处切 | 语义最完整 | 需要模型、慢 | 高质量需求 |
| **文档结构切分** | 按Markdown标题/HTML标签/代码函数切 | 结构保留好 | 非结构化文档无效 | Markdown/代码 |
| **句级切分** | NLP分句后按句切分 | 最细粒度 | 上下文不足 | 精确问答 |

**当前最主流：递归字符切分（RecursiveCharacterTextSplitter）**

为什么主流：
1. 不需要额外模型（语义切分需要Embedding模型）
2. 比固定长度好得多（尊重自然段落边界）
3. LangChain默认切分器，生态最完善
4. 对中文/英文/代码都有较好的分隔符策略

```java
// Spring AI: 递归字符切分实现
@Component
public class RecursiveTextSplitter implements DocumentSplitter {

    // 分隔符层级：从粗到细
    private static final List<String> SEPARATORS = List.of(
        "\n\n",    // 段落
        "\n",      // 行
        "。",      // 中文句号
        ".",       // 英文句号
        "；",      // 中文分号
        "；",      // 英文分号
        " ",       // 空格
        ""         // 兜底：逐字符
    );

    private final int chunkSize;
    private final int overlapSize;

    public RecursiveTextSplitter(int chunkSize, int overlapSize) {
        this.chunkSize = chunkSize;       // 目标chunk大小
        this.overlapSize = overlapSize;   // 重叠大小（保持上下文）
    }

    @Override
    public List<Document> split(Document document) {
        return splitRecursive(document.getText(), SEPARATORS);
    }

    private List<Document> splitRecursive(String text, List<String> separators) {
        if (text.length() <= chunkSize) {
            return List.of(Document.from(text));
        }

        String separator = separators.get(0);
        List<String> splits = List.of(text.split(Pattern.quote(separator)));

        List<Document> result = new ArrayList<>();
        StringBuilder currentChunk = new StringBuilder();

        for (String split : splits) {
            if (currentChunk.length() + split.length() > chunkSize) {
                if (currentChunk.length() > 0) {
                    result.add(Document.from(currentChunk.toString().strip()));
                    // 重叠：保留末尾overlapSize字符
                    String tail = currentChunk.substring(
                        Math.max(0, currentChunk.length() - overlapSize));
                    currentChunk = new StringBuilder(tail);
                }
                // 单个split超过chunkSize，用下一级分隔符
                if (split.length() > chunkSize && separators.size() > 1) {
                    result.addAll(splitRecursive(split, separators.subList(1, separators.size())));
                } else {
                    currentChunk.append(split).append(separator);
                }
            } else {
                currentChunk.append(split).append(separator);
            }
        }

        if (currentChunk.length() > 0) {
            result.add(Document.from(currentChunk.toString().strip()));
        }
        return result;
    }
}

// 语义切分（高级方案）
@Component
public class SemanticTextSplitter {
    private final EmbeddingModel embeddingModel;

    public List<Document> split(Document doc) {
        // 1. 按句子切分
        List<String> sentences = splitIntoSentences(doc.getText());

        // 2. 计算相邻句子的Embedding相似度
        List<Double> similarities = new ArrayList<>();
        for (int i = 1; i < sentences.size(); i++) {
            float[] emb1 = embeddingModel.embed(sentences.get(i - 1));
            float[] emb2 = embeddingModel.embed(sentences.get(i));
            similarities.add(cosineSimilarity(emb1, emb2));
        }

        // 3. 找到相似度骤降点（主题切换点）
        double threshold = calculateThreshold(similarities);
        List<Document> chunks = new ArrayList<>();
        StringBuilder chunk = new StringBuilder(sentences.get(0));

        for (int i = 1; i < sentences.size(); i++) {
            if (similarities.get(i - 1) < threshold) {
                // 相似度骤降 → 主题切换 → 切分
                chunks.add(Document.from(chunk.toString()));
                chunk = new StringBuilder();
            }
            chunk.append(sentences.get(i));
        }

        return chunks;
    }
}
```

**工程踩坑点**：
- 切分chunkSize不是越大越好——太大导致检索不精准（召回噪声），太小丢失上下文。512-1024 tokens是经验最优区间
- overlap（重叠）很关键——没有overlap，跨chunk的信息会丢失。10-20%的重叠是标配
- Markdown文档一定要用结构切分而非递归字符——否则一个函数定义可能被切成两半
- 中文切分的分隔符要加"。"和"；"——只按\n切中文效果很差

---

### Q5: 知道哪些向量化模型？

**答题思路**：按时间线+适用场景分类回答，突出中文场景的选型。

**深度解答**：

| 模型 | 维度 | 特点 | 适用场景 |
|------|------|------|---------|
| **OpenAI text-embedding-3-small** | 1536 | 通用、API调用 | 快速集成、英文为主 |
| **OpenAI text-embedding-3-large** | 3072 | 更高维度、效果更好 | 高精度需求 |
| **BGE-large-zh-v1.5** | 1024 | 中文最强开源 | **中文RAG首选** |
| **BGE-M3** | 1024 | 多语言+多功能（稠密+稀疏+ColBERT） | 多语言、混合检索 |
| **M3E-large** | 1024 | 中文优秀、轻量 | 资源受限场景 |
| **GTE-Qwen2-7B** | 3584 | Qwen2基座、效果最强 | GPU充足、极致效果 |
| **Cohere embed-v3** | 1024 | API调用、多语言 | 不想自部署 |
| **Jina-embeddings-v3** | 2048 | 长文本支持好 | 长文档检索 |

**选型建议**：
- 中文场景：BGE-large-zh-v1.5（自部署）或 BGE-M3（多语言+混合检索）
- 英文场景：OpenAI text-embedding-3-small（API）或 GTE（自部署）
- 多语言：BGE-M3 或 Cohere embed-v3
- 混合检索：BGE-M3（同时输出稠密+稀疏向量）

```java
// Spring AI: 向量化模型配置
@Configuration
public class EmbeddingConfig {

    // 方案1: 本地BGE模型（ONNX Runtime）
    @Bean
    @ConditionalOnProperty(name = "embedding.provider", havingValue = "local")
    public EmbeddingModel localBgeModel() {
        return new OnnxEmbeddingModel(
            Paths.get("models/bge-large-zh-v1.5.onnx"),
            Paths.get("models/bge-large-zh-v1.5-tokenizer.json")
        );
    }

    // 方案2: OpenAI API
    @Bean
    @ConditionalOnProperty(name = "embedding.provider", havingValue = "openai")
    public EmbeddingModel openaiEmbeddingModel() {
        return new OpenAiEmbeddingModel(
            OpenAiApi.builder()
                .apiKey(System.getenv("OPENAI_API_KEY"))
                .modelName("text-embedding-3-small")
                .build()
        );
    }

    // 方案3: 阿里百炼（中文场景推荐）
    @Bean
    @ConditionalOnProperty(name = "embedding.provider", havingValue = "bailian")
    public EmbeddingModel bailianEmbeddingModel() {
        return new DashScopeEmbeddingModel(
            DashScopeApi.builder()
                .apiKey(System.getenv("DASHSCOPE_API_KEY"))
                .modelName("text-embedding-v3")  // 百炼最新模型
                .build()
        );
    }
}
```

**工程踩坑点**：
- 不同模型的向量维度不同——换模型需要重建整个向量库
- BGE模型需要加指令前缀——`"为这个句子生成表示以用于检索相关文章："`，不加前缀效果差15%
- 向量化是最耗时的步骤——批量建索引用GPU加速，在线查询用CPU即可

---

## 二、Agent框架与工具开发

### Q6: 怎么把一个工具变成MCP Server？

**答题思路**：不是"怎么写MCP代码"，而是讲清MCP Server的架构、协议、生命周期。

**深度解答**：

MCP Server的本质：一个通过JSON-RPC 2.0通信的独立进程，向Agent暴露工具能力。

**把工具变成MCP Server的步骤**：

1. **定义工具Schema**：每个工具声明名称、描述、参数类型
2. **实现JSON-RPC处理**：处理`tools/list`和`tools/call`两种请求
3. **选择传输方式**：stdio（子进程模式）或 SSE（HTTP长连接模式）
4. **配置Agent连接**：在Agent侧声明MCP Server的启动命令

```java
// Spring AI MCP Server 实现（SSE模式）
@SpringBootApplication
@RestController
public class GithubMcpServer {

    // 1. 声明工具列表
    @GetMapping("/mcp/tools")
    public List<ToolDefinition> listTools() {
        return List.of(
            ToolDefinition.builder()
                .name("create_issue")
                .description("在GitHub仓库创建Issue")
                .inputSchema("""
                    {
                        "type": "object",
                        "properties": {
                            "repo": {"type": "string", "description": "仓库路径 owner/repo"},
                            "title": {"type": "string", "description": "Issue标题"},
                            "body": {"type": "string", "description": "Issue内容"}
                        },
                        "required": ["repo", "title"]
                    }
                    """)
                .build(),
            ToolDefinition.builder()
                .name("search_code")
                .description("搜索GitHub代码")
                .inputSchema("""
                    {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "搜索关键词"},
                            "language": {"type": "string", "description": "编程语言"}
                        },
                        "required": ["query"]
                    }
                    """)
                .build()
        );
    }

    // 2. 处理工具调用
    @PostMapping("/mcp/call")
    public ToolResult callTool(@RequestBody ToolCallRequest request) {
        return switch (request.getName()) {
            case "create_issue" -> createIssue(request.getArguments());
            case "search_code" -> searchCode(request.getArguments());
            default -> ToolResult.error("未知工具: " + request.getName());
        };
    }

    private ToolResult createIssue(Map<String, Object> args) {
        String repo = (String) args.get("repo");
        String title = (String) args.get("title");
        String body = (String) args.getOrDefault("body", "");

        // 调用GitHub API
        HttpResponse<String> resp = httpClient.send(
            HttpRequest.newBuilder()
                .uri(URI.create("https://api.github.com/repos/" + repo + "/issues"))
                .header("Authorization", "Bearer " + githubToken)
                .POST(HttpRequest.BodyPublishers.ofString(
                    "{\"title\":\"" + title + "\",\"body\":\"" + body + "\"}"))
                .build(),
            HttpResponse.BodyHandlers.ofString()
        );

        if (resp.statusCode() == 201) {
            return ToolResult.success("Issue创建成功: " + extractUrl(resp.body()));
        }
        return ToolResult.error("创建失败: " + resp.body());
    }
}

// 3. Agent侧配置连接
@Configuration
public class AgentMcpConfig {
    @Bean
    public McpSyncClient githubMcpClient() {
        // stdio模式：Agent启动时自动拉起MCP Server子进程
        ServerParameters params = ServerParameters.builder("java")
            .args("-jar", "github-mcp-server.jar")
            .build();

        return McpClient.using(new StdioServerTransport(params))
            .requestTimeout(Duration.ofSeconds(30))
            .sync();
    }
}
```

**工程踩坑点**：
- stdio模式的MCP Server生命周期由Agent管理——Agent退出时Server也被kill，注意资源释放
- SSE模式需要独立部署MCP Server——适合多个Agent共享同一个Server
- MCP工具描述决定了模型是否正确调用——描述不清=模型乱调，花时间写好描述比写代码更重要

---

### Q7: LangGraph状态流转，这个状态是什么类型？

**答题思路**：LangGraph的核心是状态图，要讲清State的Schema定义、更新机制、和状态持久化。

**深度解答**：

LangGraph中的State是一个**TypedDict**（Python）或等价的类型化字典，定义了图的"共享内存"。

**State的三个关键特性**：
1. **Schema定义**：声明状态有哪些字段、类型
2. **更新策略**：每个字段的更新方式——覆盖（默认）还是追加（annotation）
3. **持久化**：State Checkpoint，支持断点续跑和人工审批

```python
# Python: LangGraph State定义（LangGraph目前只有Python版）
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph
import operator

# 1. 定义State Schema
class AgentState(TypedDict):
    messages: Annotated[list, operator.add]  # 追加模式：新消息追加到列表
    current_tool: str                         # 覆盖模式：新值覆盖旧值
    tool_result: str                          # 覆盖模式
    iteration: int                            # 覆盖模式
    error_count: Annotated[int, operator.add] # 追加模式：错误计数累加

# 2. 构建状态图
graph = StateGraph(AgentState)

# 添加节点
graph.add_node("think", think_node)
graph.add_node("act", act_node)
graph.add_node("observe", observe_node)

# 添加边（状态流转）
graph.add_edge("think", "act")
graph.add_edge("act", "observe")
graph.add_conditional_edges("observe", should_continue, {
    True: "think",    # 继续循环
    False: END        # 结束
})

# 3. 编译+持久化
from langgraph.checkpoint.memory import MemorySaver
app = graph.compile(checkpointer=MemorySaver())
```

```java
// Java等价实现：用Spring AI + 自定义状态机模拟LangGraph
public class LangGraphStyleAgent {

    // State定义：类型化状态容器
    @Data
    public static class AgentState {
        private List<Message> messages = new ArrayList<>();  // 追加
        private String currentTool;                          // 覆盖
        private String toolResult;                           // 覆盖
        private int iteration = 0;                           // 覆盖
        private int errorCount = 0;                          // 追加

        // 追加式更新
        public void appendMessage(Message msg) {
            messages.add(msg);
        }

        // 覆盖式更新
        public void setTool(String tool, String result) {
            this.currentTool = tool;
            this.toolResult = result;
            this.iteration++;
        }
    }

    // 状态持久化（Checkpoint）
    public class StateCheckpoint {
        private final Map<String, AgentState> checkpoints = new ConcurrentHashMap<>();

        public String save(String threadId, AgentState state) {
            checkpoints.put(threadId, deepCopy(state));
            return threadId;
        }

        public AgentState load(String threadId) {
            return checkpoints.get(threadId);
        }
    }

    // 图执行
    public AgentState run(AgentState initialState) {
        AgentState state = initialState;
        while (state.getIteration() < MAX_ITERATIONS) {
            // think → act → observe
            state = think(state);
            state = act(state);
            state = observe(state);
            if (shouldEnd(state)) break;
        }
        return state;
    }
}
```

**工程踩坑点**：
- State字段要区分"追加"和"覆盖"——messages追加（保留历史），current_tool覆盖（只关心当前），搞反了会出bug
- LangGraph目前只有Python版本——Java项目可以用Spring AI的StatefulChatClient模拟，但功能不如LangGraph完整
- Checkpoint在内存里不安全——生产环境要用Redis/DB持久化，否则重启丢状态

---

### Q8: 多Agent协同的重试机制？

**答题思路**：多Agent场景下，单个Agent失败不能让整个流程挂掉。重试要讲清策略、退避、降级。

**深度解答**：

多Agent重试的四个层次：

| 层次 | 策略 | 场景 |
|------|------|------|
| **单步重试** | 指数退避 + 最大次数 | 工具调用超时/API限流 |
| **降级重试** | 失败后换备选Agent | 主Agent不可用→备用Agent |
| **子图重试** | 重新执行整个子流程 | 子任务整体失败 |
| **全局回滚** | 放弃当前路径，换策略 | 所有重试耗尽 |

```java
// Spring AI: 多Agent重试机制
@Component
public class ResilientMultiAgent {

    // 1. 单步重试：指数退避
    public <T> T retryWithBackoff(Supplier<T> action, int maxRetries) {
        for (int i = 0; i < maxRetries; i++) {
            try {
                return action.get();
            } catch (Exception e) {
                if (i == maxRetries - 1) throw new AgentRetryExhaustedException(e);
                long delay = (long) Math.pow(2, i) * 1000 + random.nextLong(500);
                Thread.sleep(delay);
            }
        }
        throw new AgentRetryExhaustedException();
    }

    // 2. 降级重试：主Agent失败→备用Agent
    public AgentResult executeWithFallback(
            List<Agent> agents, String task) {
        for (Agent agent : agents) {
            try {
                return retryWithBackoff(
                    () -> agent.execute(task), 3);
            } catch (AgentRetryExhaustedException e) {
                log.warn("Agent {} 失败，尝试下一个", agent.getName());
            }
        }
        // 所有Agent都失败→返回兜底结果
        return AgentResult.fallback("所有Agent不可用，返回默认结果");
    }

    // 3. 子图重试：重新编排子流程
    public AgentResult retrySubGraph(SubGraph subGraph, AgentState state, int maxRetries) {
        for (int i = 0; i < maxRetries; i++) {
            try {
                return subGraph.execute(state);
            } catch (SubGraphException e) {
                log.warn("子图执行失败(第{}次)，重置状态重试", i + 1);
                state.resetToCheckpoint(); // 回退到检查点
            }
        }
        return AgentResult.error("子图重试耗尽");
    }

    // 4. 熔断器：防止级联失败
    @Bean
    public CircuitBreaker agentCircuitBreaker() {
        return CircuitBreaker.ofDefaults("agent-cb");
    }
}
```

**工程踩坑点**：
- 重试次数不能无限——多Agent场景下，一个Agent无限重试会阻塞整条链路
- 退避要加随机抖动（jitter）——否则多个请求同时重试，再次打爆下游
- 降级Agent的结果要标注"降级产出"——方便后续评估是否需要人工介入
- 熔断器是必须的——Agent A失败导致Agent B请求堆积→B也失败→级联崩溃

---

### Q9: 项目中怎么实现Function Calling的？

**答题思路**：Function Calling不是"传个工具列表"那么简单，要讲清注册→选择→调用→验证→错误处理完整链路。

**深度解答**：

Function Calling的完整工程实现：

1. **工具注册**：声明工具Schema（名称、描述、参数JSON Schema）
2. **模型选择**：模型根据用户意图 + 工具描述，决定调用哪个工具
3. **参数校验**：校验模型输出的参数是否符合Schema
4. **工具执行**：调用实际工具，获取结果
5. **结果回注**：将工具结果返回给模型，模型决定下一步

```java
// Spring AI: Function Calling完整实现
@Service
public class FunctionCallingEngine {

    private final ChatClient chatClient;
    private final ToolRegistry toolRegistry;

    // 1. 工具注册
    @PostConstruct
    public void registerTools() {
        toolRegistry.register(ToolDefinition.builder()
            .name("query_order")
            .description("查询订单信息，输入订单号返回订单详情")
            .inputSchema("""
                {
                    "type": "object",
                    "properties": {
                        "order_id": {"type": "string", "description": "订单号"},
                        "include_items": {"type": "boolean", "description": "是否包含商品明细", "default": true}
                    },
                    "required": ["order_id"]
                }
                """)
            .executor(this::doQueryOrder)
            .build());
    }

    // 2-5. 完整的Function Calling循环
    public String execute(String userMessage) {
        List<Message> messages = new ArrayList<>();
        messages.add(new UserMessage(userMessage));

        for (int i = 0; i < 5; i++) { // 最多5轮工具调用
            // 调用模型，传入可用工具列表
            ChatResponse response = chatClient.prompt()
                .messages(messages)
                .functions(toolRegistry.getToolNames()) // 注册工具
                .call()
                .chatResponse();

            // 检查模型是否要调用工具
            if (response.hasToolCalls()) {
                for (ToolCall toolCall : response.toolCalls()) {
                    // 3. 参数校验
                    Map<String, Object> args = parseAndValidate(
                        toolCall.arguments(), toolCall.name());

                    // 4. 工具执行
                    String result;
                    try {
                        result = toolRegistry.execute(toolCall.name(), args);
                    } catch (Exception e) {
                        result = "工具执行失败: " + e.getMessage();
                    }

                    // 5. 结果回注
                    messages.add(new AssistantMessage(toolCall.toString()));
                    messages.add(new ToolResultMessage(result, toolCall.id()));
                }
            } else {
                // 模型生成最终回答
                return response.getResult().getOutput().getText();
            }
        }

        return "抱歉，工具调用次数超限";
    }

    private Map<String, Object> parseAndValidate(String argsJson, String toolName) {
        Map<String, Object> args = jsonParser.parse(argsJson);
        ToolDefinition def = toolRegistry.get(toolName);

        // 校验必填参数
        for (String required : def.getRequiredParams()) {
            if (!args.containsKey(required)) {
                throw new ToolParameterException(
                    "缺少必填参数: " + required);
            }
        }
        return args;
    }

    private String doQueryOrder(Map<String, Object> args) {
        String orderId = (String) args.get("order_id");
        // 实际业务逻辑：查询数据库
        return orderService.queryOrder(orderId);
    }
}
```

**工程踩坑点**：
- 模型可能一次返回多个ToolCall——要全部执行完再回注，不能只执行第一个
- 工具执行可能失败——必须把错误信息回注给模型，让它决定是重试还是换工具
- Function Calling不要和纯文本回答混淆——模型有时会在不该调工具时调工具（幻觉调用），要在Prompt中约束

---

## 三、网络与基础通信

### Q10: SSE和WebSocket的区别？

**答题思路**：这是Agent流式输出的核心考点，要讲清协议差异和AI场景选型。

**深度解答**：

| 维度 | SSE (Server-Sent Events) | WebSocket |
|------|-------------------------|-----------|
| 通信方向 | 服务端→客户端（单向） | 双向 |
| 协议 | HTTP/1.1+ | 独立协议（ws://） |
| 断线重连 | 浏览器自动重连 | 需要手动实现 |
| 数据格式 | 纯文本 | 文本+二进制 |
| 兼容性 | 天然支持HTTP基础设施 | 需要网关/代理支持 |
| 代理/CDN | 友好（标准HTTP） | 不友好（长连接穿透） |
| 典型场景 | LLM流式输出、实时通知 | 聊天、游戏、协作编辑 |

**AI场景选型**：
- **LLM流式输出**：SSE——只需要服务端→客户端推流，不需要双向
- **Agent交互**：SSE——用户发请求，Agent流式返回结果
- **聊天应用**：WebSocket——用户和Agent双向实时通信
- **MCP协议**：两种都支持——stdio模式用标准输入输出，远程模式用SSE

```java
// Spring AI: SSE流式输出实现
@RestController
public class StreamChatController {

    private final ChatClient chatClient;

    @GetMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> streamChat(@RequestParam String message) {
        return chatClient.prompt()
            .user(message)
            .stream()                           // 流式调用
            .chatResponse()
            .map(resp -> ServerSentEvent.<String>builder()
                .id(resp.getId())
                .event("delta")                 // SSE event type
                .data(resp.getResult().getOutput().getText())
                .build())
            .concatWith(Flux.just(
                ServerSentEvent.<String>builder()
                    .event("done")              // 结束标记
                    .data("[DONE]")
                    .build()));
    }
}

// 前端消费SSE
// const evtSource = new EventSource("/chat/stream?message=你好");
// evtSource.addEventListener("delta", (e) => { appendText(e.data); });
// evtSource.addEventListener("done", () => { evtSource.close(); });
```

```java
// WebSocket实现（双向通信场景）
@Component
@ServerEndpoint("/ws/agent")
public class AgentWebSocket {

    @OnOpen
    public void onOpen(Session session) {
        // 建立连接
    }

    @OnMessage
    public void onMessage(String message, Session session) {
        // 收到用户消息 → 调用Agent → 流式返回
        chatClient.prompt().user(message).stream()
            .chatResponse()
            .subscribe(resp -> session.getAsyncRemote()
                .sendText(resp.getResult().getOutput().getText()));
    }
}
```

**工程踩坑点**：
- SSE的Nginx配置要加`proxy_buffering off`——否则Nginx会缓冲SSE数据，用户看不到实时输出
- WebSocket在K8s环境下需要sticky session——否则重连可能到不同Pod
- MCP的SSE传输有会话管理问题——长时间空闲连接可能被中间件断开

---

## 四、Prompt工程

### Q11: 良好的Prompt工程应该具备哪几方面内容？

**答题思路**：不是"写好提示词"，而是讲Prompt工程的**系统性方法**——结构化、可控性、可评估。

**深度解答**：

良好Prompt工程的六个维度：

| 维度 | 内容 | 示例 |
|------|------|------|
| **角色定义** | 明确AI的身份和能力边界 | "你是一个代码审查专家" |
| **任务描述** | 清晰、具体、无歧义 | "审查以下PR的安全漏洞和代码质量" |
| **约束条件** | 明确不能做什么 | "不要修改任何代码，只给出审查意见" |
| **输出格式** | 指定输出的结构和格式 | "按JSON格式输出：{severity, file, line, suggestion}" |
| **示例（Few-shot）** | 提供输入输出样例 | "示例输入：... 示例输出：..." |
| **思维链（CoT）** | 引导分步推理 | "先分析变更范围，再检查安全问题，最后评估代码质量" |

```java
// Spring AI: 工程化Prompt模板
@Component
public class PromptEngineering {

    // 结构化Prompt模板
    private static final String CODE_REVIEW_PROMPT = """
        # 角色
        你是一个资深代码审查专家，擅长发现安全漏洞和代码质量问题。

        # 任务
        审查以下代码变更，给出专业意见。

        # 约束
        - 只审查给定的代码变更，不要评价整体架构
        - 安全问题必须标为CRITICAL
        - 不要给出"看起来不错"这样无意义的评论

        # 输出格式
        按以下JSON格式输出：
        ```json
        {
            "issues": [
                {
                    "severity": "CRITICAL|WARNING|INFO",
                    "file": "文件路径",
                    "line": 行号,
                    "description": "问题描述",
                    "suggestion": "修改建议"
                }
            ],
            "summary": "总体评价"
        }
        ```

        # 示例
        输入：password = request.getParameter("pwd"); String sql = "SELECT * FROM users WHERE pwd='" + password + "'";
        输出：{"issues":[{"severity":"CRITICAL","file":"LoginServlet.java","line":42,"description":"SQL注入漏洞","suggestion":"使用PreparedStatement"}]}

        # 代码变更
        {diff}
        """;

    // Prompt版本管理
    @Repository
    public class PromptRepository {
        // A/B测试不同版本的Prompt
        public PromptTemplate getPrompt(String task, String version) {
            return promptStore.get(task, version);
        }

        // 记录Prompt执行效果
        public void recordResult(String promptVersion, String input,
                                  String output, double qualityScore) {
            // 用于后续评估哪个Prompt版本效果更好
        }
    }
}
```

**工程踩坑点**：
- Prompt不是"一次性写好"的——需要版本管理、A/B测试、效果评估，像代码一样维护
- Few-shot示例要覆盖典型场景和边缘case——只给"正常"示例，模型遇到异常输入就乱输出
- 输出格式约束要强——用JSON Schema比自然语言描述"请输出JSON"可靠得多

---

## 五、上下文&记忆系统（二面问题）

### Q12: 上下文压缩办法？

**答题思路**：LLM上下文窗口有限，长对话必须压缩。要讲清压缩策略和工程取舍。

**深度解答**：

| 压缩方法 | 原理 | 信息损失 | 延迟 | 适用场景 |
|---------|------|---------|------|---------|
| **滑动窗口** | 只保留最近N轮对话 | 高（直接丢弃） | 无 | 简单聊天 |
| **摘要压缩** | LLM对历史对话生成摘要 | 中 | 高（需LLM调用） | 多轮对话 |
| **关键信息提取** | 只保留实体/决策/数字 | 低（定向保留） | 中 | 业务对话 |
| **向量检索回填** | 历史存向量库，按需检索 | 低 | 中（向量检索） | 长期记忆 |
| **Token级别剪枝** | 删除注意力权重低的token | 中 | 低 | 紧急压缩 |

```java
// Spring AI: 摘要压缩实现
@Component
public class ContextCompressor {

    private final ChatClient summaryModel;

    // 滑动窗口：最简单，直接截断
    public List<Message> slidingWindow(List<Message> messages, int maxRounds) {
        int start = Math.max(0, messages.size() - maxRounds * 2);
        return messages.subList(start, messages.size());
    }

    // 摘要压缩：LLM生成历史摘要
    public List<Message> summaryCompress(List<Message> messages, int maxTokens) {
        if (estimateTokens(messages) <= maxTokens) return messages;

        // 分割：保留最近3轮 + 压缩更早的历史
        List<Message> recent = messages.subList(
            messages.size() - 6, messages.size());
        List<Message> history = messages.subList(0, messages.size() - 6);

        // LLM生成摘要
        String summary = summaryModel.prompt()
            .user("请简洁总结以下对话的关键信息（实体、决策、数字）：\n"
                + formatMessages(history))
            .call()
            .content();

        // 返回：摘要 + 最近对话
        List<Message> compressed = new ArrayList<>();
        compressed.add(new SystemMessage("历史对话摘要：\n" + summary));
        compressed.addAll(recent);
        return compressed;
    }

    // 关键信息提取：保留结构化数据
    public List<Message> keyInfoCompress(List<Message> messages) {
        String allText = messages.stream()
            .map(Message::getText)
            .collect(Collectors.joining("\n"));

        // 提取实体、数字、决策
        String keyInfo = summaryModel.prompt()
            .user("""
                从以下对话中提取关键信息，只保留：
                1. 用户提到的实体（人名、公司、产品）
                2. 做出的决策
                3. 具体数字（金额、日期、数量）
                以列表形式输出。
                
                对话内容：
                %s
                """.formatted(allText))
            .call()
            .content();

        return List.of(new SystemMessage("关键信息：\n" + keyInfo));
    }
}
```

**工程踩坑点**：
- 摘要压缩的LLM调用本身也消耗token——如果历史很短，压缩的token消耗比直接保留还多
- 滑动窗口是最安全的兜底——即使压缩算法有bug，至少最近几轮是完整的
- 压缩要保留System Prompt——不要把角色定义和约束条件也压缩掉了

---

### Q13: 知不知道其他的上下文机制？

**答题思路**：除了压缩，还有上下文窗口管理、RAG回填、并行上下文等机制。

**深度解答**：

- **上下文窗口管理**：根据模型能力动态调整输入长度，GPT-4=128K，Claude=200K
- **RAG回填**：历史对话存向量库，根据当前问题检索相关历史，按需注入
- **并行上下文**：多文档并行输入（如Anthropic的citations功能），各文档独立标注来源
- **渐进式上下文**：先给模型摘要，需要细节时再展开（就像网页的"展开更多"）
- **上下文缓存**：Claude的Prompt Caching功能，相同前缀的Prompt不重复计算token

---

### Q14: 记忆怎么设计？

**答题思路**：三层记忆架构是标准答案，但要加工程细节——存储方式、触发机制、遗忘策略。

**深度解答**：

| 记忆类型 | 存储方式 | 生命周期 | 触发机制 |
|---------|---------|---------|---------|
| **短期记忆** | 会话内存（ChatMemory） | 单次会话 | 自动（对话历史） |
| **工作记忆** | 当前任务上下文 | 单次任务 | 提取自短期记忆 |
| **长期记忆** | 向量库/数据库 | 永久 | 主动存储+被动检索 |

```java
// Spring AI: 三层记忆架构
@Component
public class ThreeLayerMemory {

    // 短期记忆：会话内对话历史
    private final ChatMemory shortTermMemory;

    // 长期记忆：向量库
    private final VectorStore longTermMemory;

    // 工作记忆：当前任务的关键信息
    private final ThreadLocal<Map<String, Object>> workingMemory = new ThreadLocal<>();

    // 存入长期记忆：对话结束后，提取关键信息持久化
    @Scheduled(fixedDelay = 60000) // 每分钟检查
    public void persistImportantMemories() {
        List<Message> recentMessages = shortTermMemory.getRecent(10);

        // 判断是否有值得长期记住的信息
        String importance = chatClient.prompt()
            .user("以下对话中有没有值得长期记住的信息？只回复YES或NO：\n"
                + formatMessages(recentMessages))
            .call()
            .content();

        if ("YES".equalsIgnoreCase(importance)) {
            String summary = chatClient.prompt()
                .user("提取以下对话中值得长期记住的关键信息：\n"
                    + formatMessages(recentMessages))
                .call()
                .content();

            // 存入向量库
            longTermMemory.add(List.of(
                new Document(summary, Map.of("timestamp", Instant.now().toString()))));
        }
    }

    // 检索长期记忆：根据当前问题，检索相关历史
    public String recallLongTerm(String query) {
        List<Document> relevant = longTermMemory.similaritySearch(
            SearchRequest.builder().query(query).topK(3).build());

        return relevant.stream()
            .map(Document::getText)
            .collect(Collectors.joining("\n"));
    }

    // 遗忘策略：长期记忆也要清理
    @Scheduled(cron = "0 0 3 * * ?") // 每天凌晨3点
    public void forgetStaleMemories() {
        // 删除90天未被检索的记忆
        longTermMemory.delete(
            FilterExpressionBuilder.builder()
                .and("timestamp").lt(Instant.now().minus(90, ChronoUnit.DAYS).toString())
                .build());
    }
}
```

**工程踩坑点**：
- 短期记忆不要无限增长——加滑动窗口限制，否则上下文太长模型推理变慢
- 长期记忆的"重要性判断"要简单——太复杂的判断逻辑本身消耗大量token
- 遗忘策略很重要——不清理长期记忆，向量库会越来越大，检索质量下降

---

### Q15: 怎么让用户感受不到压缩记忆带来的时间开销？同步还是异步？

**答题思路**：这是工程深度题——压缩需要LLM调用，有延迟。要区分场景选同步/异步。

**深度解答**：

| 方案 | 实现方式 | 用户感知 | 复杂度 |
|------|---------|---------|--------|
| **异步预压缩** | 后台线程定期压缩 | 无感知 | 中 |
| **流式压缩** | 压缩和生成并行 | 低感知 | 高 |
| **本地小模型压缩** | 用小模型替代大模型做摘要 | 无感知 | 低 |
| **惰性压缩** | 快到窗口上限时才压缩 | 偶尔卡顿 | 低 |

**最佳方案：异步预压缩**

```java
// Spring AI: 异步预压缩实现
@Component
public class AsyncContextCompressor {

    private final ChatClient compressionModel; // 用小模型做压缩，节省token
    private final ChatMemory memory;
    private final BlockingQueue<CompressionTask> queue = new LinkedBlockingQueue<>();

    @PostConstruct
    public void startCompressorThread() {
        // 后台线程：异步处理压缩任务
        Thread.ofVirtual().start(() -> {
            while (true) {
                CompressionTask task = queue.take();
                compressAsync(task);
            }
        });
    }

    // 发起压缩：不阻塞主流程
    public void scheduleCompression(String sessionId, List<Message> history) {
        queue.offer(new CompressionTask(sessionId, history));
    }

    private void compressAsync(CompressionTask task) {
        String summary = compressionModel.prompt()
            .user("简洁总结以下对话的关键信息：\n" + formatMessages(task.history()))
            .call()
            .content();

        // 更新记忆：摘要替换历史
        memory.replaceHistory(task.sessionId(), summary);
    }

    // 在对话过程中判断是否需要压缩
    public void checkAndCompress(String sessionId) {
        List<Message> messages = memory.get(sessionId);
        if (estimateTokens(messages) > CONTEXT_LIMIT * 0.8) {
            // 到达80%阈值，异步压缩，不阻塞当前对话
            scheduleCompression(sessionId, messages);
        }
    }
}
```

**核心原则**：
- **压缩用异步**——不要在用户等待回复时做压缩
- **检索用同步**——用户提问时检索相关记忆，必须等结果
- **压缩用小模型**——用Qwen-1.5B做摘要，比用Qwen-72B快10倍、便宜100倍

**工程踩坑点**：
- 异步压缩有竞态条件——压缩完成前用户又发了消息，要处理好新旧记忆的合并
- 预压缩的阈值不能太高——到95%再压缩可能来不及，80%是安全阈值
- 压缩结果要缓存——不要每次对话都重新压缩

---

### Q16: 短期记忆你会用什么方式存放？

**答题思路**：不是简单回答"内存"或"Redis"，要根据场景分析。

**深度解答**：

| 存储方式 | 适用场景 | 优点 | 缺点 |
|---------|---------|------|------|
| **内存（List/Deque）** | 单机、短会话 | 最快 | 重启丢失 |
| **Redis** | 分布式、中等会话 | 快、持久化可选 | 内存成本 |
| **Redis Stream** | 需要消息顺序 | 天然有序、消费者组 | 复杂度稍高 |
| **数据库** | 需要审计/回放 | 持久化、可查询 | 延迟高 |

```java
// 短期记忆的多种实现
// 方案1: 内存（最简单）
public class InMemoryShortTerm implements ChatMemory {
    private final Map<String, LinkedList<Message>> store = new ConcurrentHashMap<>();
    private final int maxSize;

    @Override
    public void add(String conversationId, List<Message> messages) {
        store.computeIfAbsent(conversationId, k -> new LinkedList<>())
            .addAll(messages);
        // 滑动窗口：超过maxSize就移除最早的
        var list = store.get(conversationId);
        while (list.size() > maxSize) list.removeFirst();
    }
}

// 方案2: Redis（生产环境推荐）
public class RedisShortTerm implements ChatMemory {
    private final RedisTemplate<String, Message> redisTemplate;
    private final int maxSize;

    @Override
    public void add(String conversationId, List<Message> messages) {
        String key = "chat:memory:" + conversationId;
        for (Message msg : messages) {
            redisTemplate.opsForList().rightPush(key, msg);
        }
        // 保持窗口大小
        redisTemplate.opsForList().trim(key, -maxSize, -1);
        // 设置TTL：24小时后自动清理
        redisTemplate.expire(key, 24, TimeUnit.HOURS);
    }

    @Override
    public List<Message> get(String conversationId, int lastN) {
        String key = "chat:memory:" + conversationId;
        return redisTemplate.opsForList().range(key, -lastN, -1);
    }
}
```

**工程踩坑点**：
- 生产环境用Redis——单机内存重启丢数据，多实例不共享
- Redis的TTL很重要——不及时清理过期会话，内存会爆
- 短期记忆要设置上限——不限制长度，一个超长对话就能把内存/Redis打满

---

## 六、工程实现与兜底方案

### Q17: 如何在工程上实现兜底机制？具体到代码上，用什么包？

**答题思路**：Agent系统必须有兜底——模型挂了、工具超时、返回乱码，都要有fallback。

**深度解答**：

兜底机制的三个层次：

1. **模型层兜底**：主模型失败→备用模型→规则引擎
2. **工具层兜底**：工具超时→降级结果→跳过
3. **输出层兜底**：输出不合法→重试→模板回复

```java
// Spring AI + Resilience4j: 完整兜底方案
@Configuration
public class FallbackConfig {

    // 1. 模型层兜底：主模型→备用模型→模板回复
    @Bean
    public ChatClient resilientChatClient() {
        return ChatClient.builder()
            .defaultModel("doubao-pro")        // 主模型
            .fallbackModel("qwen-plus")        // 备用模型
            .templateFallback("抱歉，服务暂时不可用，请稍后重试") // 兜底回复
            .build();
    }

    // 2. Resilience4j: 熔断+降级
    @Bean
    public CircuitBreaker llmCircuitBreaker() {
        return CircuitBreakerConfig.custom()
            .failureRateThreshold(50)          // 50%失败率触发熔断
            .waitDurationInOpenState(Duration.ofSeconds(30)) // 熔断30秒
            .slidingWindowSize(10)             // 滑动窗口10次
            .build();
    }

    @Bean
    public Retry llmRetry() {
        return RetryConfig.custom()
            .maxAttempts(2)                    // 最多重试2次
            .waitDuration(Duration.ofSeconds(1))
            .retryOn(Exception.class)
            .build();
    }
}

@Service
public class ResilientAgentService {

    private final ChatClient primaryModel;
    private final ChatClient fallbackModel;
    private final CircuitBreaker circuitBreaker;

    // 模型层兜底
    @CircuitBreaker(name = "llm", fallbackMethod = "modelFallback")
    @Retry(name = "llm")
    public String chat(String message) {
        return primaryModel.prompt().user(message).call().content();
    }

    // 降级方法：主模型熔断后走备用模型
    public String modelFallback(String message, Exception e) {
        log.warn("主模型不可用，降级到备用模型", e);
        try {
            return fallbackModel.prompt().user(message).call().content();
        } catch (Exception ex) {
            // 备用模型也挂了→模板回复
            return "抱歉，AI服务暂时不可用。您可以尝试：1. 稍后重试 2. 联系客服 400-xxx-xxxx";
        }
    }

    // 工具层兜底：超时→降级结果
    public ToolResult executeToolSafely(String toolName, Map<String, Object> args) {
        try {
            return CompletableFuture.supplyAsync(() -> toolRegistry.execute(toolName, args))
                .get(5, TimeUnit.SECONDS);  // 5秒超时
        } catch (TimeoutException e) {
            return ToolResult.fallback("工具" + toolName + "超时，已跳过");
        } catch (Exception e) {
            return ToolResult.error("工具执行失败: " + e.getMessage());
        }
    }

    // 输出层兜底：校验输出合法性
    public String validateOutput(String output) {
        // 检查是否为有效JSON（如果要求JSON输出）
        if (outputFormat.equals("json")) {
            try {
                JsonParser.parseString(output);
                return output;
            } catch (JsonParseException e) {
                // 输出不合法→重试一次
                String retryOutput = chatClient.prompt()
                    .user("请将以下内容转为合法JSON：\n" + output)
                    .call().content();
                return retryOutput;
            }
        }
        return output;
    }
}
```

**常用Python包**（面试官问的"用什么包"）：
- **Resilience4j**（Java）：熔断、重试、限流、降级——生产标配
- **Tenacity**（Python）：重试+退避——Python版Resilience4j
- **CircuitBreaker**（Python）：pybreaker库——Python熔断器

**工程踩坑点**：
- 兜底回复要"有用"——不能只说"出错了"，要给用户具体替代方案
- 熔断器的waitDuration不能太短——刚恢复就涌入流量，再次打挂
- 降级到小模型时，输出质量会下降——要标注"降级产出"，方便后续分析

---

### Q18: 如果让你改进项目，设计数据库的东西，你会用什么数据库？

**答题思路**：Agent系统涉及多种数据类型，不是选一个数据库，而是选一组。

**深度解答**：

| 数据类型 | 推荐数据库 | 原因 |
|---------|-----------|------|
| **对话历史** | Redis + PostgreSQL | Redis做短期热数据，PG做持久化 |
| **向量索引** | Milvus / Qdrant | 专业向量库，支持HNSW/IVF |
| **工具注册/配置** | PostgreSQL | 关系型，事务一致性 |
| **用户会话** | Redis | 低延迟读写 |
| **审计日志** | ClickHouse | 列存，适合大量写入+时序查询 |
| **文档原文** | MongoDB / OSS | 文档存JSON，附件存对象存储 |

```java
// Spring AI: 多数据源配置
@Configuration
public class DataSourceConfig {

    @Bean
    @Primary
    public DataSource pgDataSource() {
        // PostgreSQL：工具注册、用户数据、持久化记忆
        return DataSourceBuilder.create()
            .url("jdbc:postgresql://localhost:5432/agent_db")
            .build();
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate() {
        // Redis：短期记忆、会话管理、缓存
        return new RedisTemplate<>();
    }

    @Bean
    public MilvusVectorStore vectorStore() {
        // Milvus：向量索引、长期记忆
        return MilvusVectorStore.builder().build();
    }
}
```

---

## 七、计算机基础&数据库

### Q19: LRU怎么实现？用什么数据结构？说一下get和put的整体使用

**答题思路**：经典题，但要在Agent场景下加分——比如LRU用在记忆管理、缓存淘汰。

**深度解答**：

LRU = Least Recently Used，核心数据结构：**HashMap + 双向链表**

- HashMap：O(1)查找
- 双向链表：O(1)移动到头部/删除尾部

```java
public class LRUCache<K, V> {
    private final int capacity;
    private final Map<K, Node<K, V>> cache;  // HashMap: O(1)查找
    private final Node<K, V> head, tail;     // 哨兵节点：简化边界处理

    private static class Node<K, V> {
        K key; V value;
        Node<K, V> prev, next;
        Node(K key, V value) { this.key = key; this.value = value; }
    }

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.cache = new HashMap<>();
        head = new Node<>(null, null);
        tail = new Node<>(null, null);
        head.next = tail;
        tail.prev = head;
    }

    // GET: 查找+移到头部
    public V get(K key) {
        Node<K, V> node = cache.get(key);
        if (node == null) return null;  // 未命中
        moveToHead(node);               // 命中→移到头部（最近使用）
        return node.value;
    }

    // PUT: 插入+淘汰
    public void put(K key, V value) {
        Node<K, V> node = cache.get(key);
        if (node != null) {
            // 已存在→更新值+移到头部
            node.value = value;
            moveToHead(node);
        } else {
            // 不存在→新建节点+插入头部
            Node<K, V> newNode = new Node<>(key, value);
            cache.put(key, newNode);
            addToHead(newNode);

            // 超容量→淘汰尾部（最久未使用）
            if (cache.size() > capacity) {
                Node<K, V> lru = removeTail();
                cache.remove(lru.key);
            }
        }
    }

    // 辅助方法
    private void moveToHead(Node<K, V> node) {
        removeNode(node);
        addToHead(node);
    }

    private void addToHead(Node<K, V> node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    private void removeNode(Node<K, V> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    private Node<K, V> removeTail() {
        Node<K, V> lru = tail.prev;
        removeNode(lru);
        return lru;
    }
}
```

**Agent场景应用**：LRU Cache用在短期记忆管理——会话过多时淘汰最久未访问的会话。

---

### Q20: Redis是什么？

**简答**：Redis是基于内存的键值存储，支持持久化，常用作缓存、消息队列、会话存储。在Agent系统中主要用于短期记忆存储、会话管理、分布式锁。

### Q21: Redis的数据类型以及使用场景

| 类型 | 场景 | Agent系统应用 |
|------|------|--------------|
| **String** | 缓存、计数器 | Agent输出缓存 |
| **List** | 消息队列、时间线 | 对话历史（LPUSH+LRANGE） |
| **Hash** | 对象存储 | Agent配置、工具元数据 |
| **Set** | 去重、标签 | 已调用的工具集合 |
| **ZSet** | 排行榜、延迟队列 | 记忆重要性排序 |
| **Stream** | 消息流 | 多Agent消息传递 |

---

## 八、个人流程类问题

### Q22: 在学校里的学习成绩怎么样？

如实回答，突出与岗位相关的课程成绩。

### Q23: 阿里还有其他流程吗？

如实回答。注意：面试官说"看不到流程"可能是内部系统问题，不影响面试结果。

---

## 总结：考点分布

| 类别 | 题目数 | 核心考点 |
|------|--------|---------|
| RAG核心技术 | 5 | 检索索引、重排序、多路融合、切分、向量化 |
| Agent框架 | 4 | MCP Server、LangGraph、多Agent重试、Function Calling |
| 网络通信 | 1 | SSE vs WebSocket |
| Prompt工程 | 1 | Prompt六维度设计 |
| 记忆系统 | 5 | 压缩、存储、异步工程、三层架构 |
| 工程实现 | 2 | 兜底机制、数据库选型 |
| 计算机基础 | 3 | LRU、Redis类型与场景 |
| 个人流程 | 2 | 学习成绩、其他流程 |

**一面核心**：RAG全链路 + Agent工具开发（MCP/Function Calling）
**二面核心**：记忆系统 + 工程兜底 + 计算机基础
