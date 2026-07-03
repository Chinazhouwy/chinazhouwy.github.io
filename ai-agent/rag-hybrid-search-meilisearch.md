# RAG混合检索：MeiliSearch vs Milvus（技术文章整理）

> **来源**: 微信公众号 — JAVA架构日记
> **原文链接**: https://mp.weixin.qq.com/s/kIMygGAxfXU3H92XfBB96w
> **标签**: `#RAG` `#混合检索` `#MeiliSearch` `#Milvus` `#向量数据库`
> **考点关联**: RAG系统设计、检索策略选型、向量数据库选型

---

## 核心观点

### 为什么纯向量搜索不够？

- **语义搜索的短板**：理解意图，但精确匹配差。搜错误码、API方法名、产品序列号时，召回大量"语义相关但实际无用"的结果
- **BM25的短板**：精确匹配，但不懂同义词和上下文。搜"如何优化数据库性能"会漏掉讨论"提升查询效率"的文档

### 混合搜索 = 取长补短

- **向量搜索**：语义理解 + 意图识别
- **BM25**：精确匹配 + 关键词锚定
- **两者结合**：高召回率 + 高准确率

---

## MeiliSearch：轻量级混合检索引擎

### 核心特点

| 特性 | 说明 |
|------|------|
| 语言 | Rust开发 |
| 架构 | 单体二进制文件，无外部依赖 |
| 存储 | 基于LMDB存储引擎 |
| 向量算法 | HNSW |
| 部署 | 5分钟Docker启动，2核4GB即可运行 |
| 混合检索 | 原生支持，开箱即用 |
| 向量模型 | 支持OpenAI、Hugging Face、Ollama等 |

### semanticRatio 参数（核心设计）

控制向量搜索和BM25的权重比例，取值0.0~1.0：

| 值 | 模式 | 适用场景 |
|----|------|----------|
| 0.0 | 纯关键字 | 精确匹配（API文档、错误码查询） |
| 0.5 | 平衡模式 | 知识库问答 |
| 1.0 | 纯语义 | 客服问答、内容推荐 |

底层并行执行向量检索和BM25检索，按semanticRatio加权融合，返回统一排序列表。

---

## MeiliSearch vs Milvus 对比

| 维度 | MeiliSearch | Milvus |
|------|------------|--------|
| **架构** | 单体二进制文件 | 云原生微服务集群 |
| **部署** | 5分钟Docker启动 | 需要K8s + etcd + MinIO + Kafka |
| **资源占用** | 2核4GB可运行 | 最低8核16GB，生产推荐16核32GB |
| **数据规模** | 适合百万级文档 | 适合亿级以上向量 |
| **混合检索** | 原生支持，开箱即用 | 需要额外配置BM25 |
| **学习曲线** | 低，API简洁 | 高，需要分布式经验 |
| **适用场景** | 中小规模RAG、快速原型 | 大规模企业级、海量数据 |
| **ANN算法** | HNSW | HNSW、IVF、DiskANN等 |
| **GPU加速** | 不支持 | 深度集成NVIDIA CAGRA |

### Milvus的"重量级"代价

**部署依赖**：
- etcd（元数据存储）
- MinIO或S3（对象存储）
- Kafka或Pulsar（消息队列）
- 配置文件超过500个参数

**资源占用**：
- 单节点最低：8核16GB内存
- 生产环境推荐：16核32GB起步
- 对象存储和消息队列额外占用资源

### 选型建议

- **百万级以下文档** → MeiliSearch（轻量、快速上手、原生混合检索）
- **亿级以上向量** → Milvus（云原生、水平扩展、GPU加速）
- **MeiliSearch不是要取代Milvus**，而是为中小规模场景提供更轻量、更易用的选择
- 相比PGVector、SeekDB等基于传统关系库的向量扩展，MeiliSearch的全文搜索+向量搜索能力更强、更稳定

---

## Java实战代码

### 1. Maven依赖

```xml
<dependency>
    <groupId>com.meilisearch.sdk</groupId>
    <artifactId>meilisearch-java</artifactId>
    <version>0.20.0</version>
</dependency>
```

### 2. 初始化客户端

```java
import com.meilisearch.sdk.Client;
import com.meilisearch.sdk.Config;
import com.meilisearch.sdk.Index;

Client client = new Client(new Config(
    "http://localhost:7700",
    "MASTER_KEY"  // 替换为你的API密钥
));
Index index = client.index("Docs");
```

### 3. 插入文档

```java
String documents = """
    [
      {"id": 1, "title": "Spring Boot性能优化指南", 
       "content": "本文介绍如何通过连接池、缓存和异步处理提升Spring Boot应用性能", 
       "category": "后端开发"},
      {"id": 2, "title": "MySQL索引优化实战", 
       "content": "深入讲解B+树索引原理,以及如何通过explain分析查询性能", 
       "category": "数据库"},
      {"id": 3, "title": "Redis缓存设计模式", 
       "content": "介绍缓存穿透、缓存雪崩的解决方案,以及分布式锁的实现", 
       "category": "缓存"}
    ]
    """;

TaskInfo taskInfo = index.addDocuments(documents);
client.waitForTask(taskInfo.getTaskUid());
```

### 4. 基础关键字搜索

```java
SearchResult result = (SearchResult) index.search("性能优化");
result.getHits().forEach(hit -> {
    HashMap<?, ?> doc = (HashMap<?, ?>) hit;
    System.out.println("标题: " + doc.get("title"));
});
```

### 5. 混合搜索（关键字+语义）

```java
import com.meilisearch.sdk.SearchRequest;
import com.meilisearch.sdk.model.Hybrid;

// semanticRatio=0.5, 关键字和语义各占50%
SearchRequest searchRequest = SearchRequest.builder()
    .q("如何提升数据库查询效率")
    .hybrid(Hybrid.builder()
        .embedder("Ollama")        // 使用Ollama本地模型
        .semanticRatio(0.5)         // 50%语义 + 50%关键字
        .build())
    .build();

Searchable result = index.search(searchRequest);
result.getHits().forEach(hit -> {
    HashMap<?, ?> doc = (HashMap<?, ?>) hit;
    System.out.println("-> " + doc.get("title"));
});
```

---

## 面试应用

### 面试官问"RAG检索方案怎么选"时的回答思路

1. **先说策略**：混合检索（向量+BM25）是当前RAG的最佳实践，纯向量或纯关键词都有明显短板
2. **再说选型**：
   - 中小规模（百万级以下）→ MeiliSearch，轻量、原生混合检索、5分钟部署
   - 大规模（亿级以上）→ Milvus，云原生、水平扩展、GPU加速
   - 已有PG基础设施 → PGVector可作为兜底方案
3. **最后说细节**：semanticRatio参数调优——精确匹配场景偏BM25，语义理解场景偏向量

### 与面经题目的关联

| 面经题目 | 本文提供的关键信息 |
|----------|-------------------|
| 携程Q17: 为什么要搞混合检索？ | 向量=语义理解，BM25=精确匹配，取长补短 |
| 携程Q18: TopK怎么定？ | semanticRatio调优比单纯调TopK更有效 |
| 淘天Q13: RAG问答整体流程？ | 混合检索是检索环节的核心设计 |
| 喜茶Q9: RAG怎么设计的？ | MeiliSearch vs Milvus选型是实际工程决策 |
| 淘天Q5: 主流框架怎么做上下文管理？ | MeiliSearch的semanticRatio是一种简洁的检索策略管理方式 |
