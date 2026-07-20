---
title: "NLP零基础教程知识点整理（尚硅谷187集）"
date: "2026-07-20"
domain: "技术"
area: "AI Agent"
module: ""
project: ""
type: "学习笔记"
status: "可复习"
priority: "P1"
energy: "high"
visibility: "private"
summary: "NLP从零基础到Transformer/BERT/LLM大模型训练的187集课程知识点"
tags:
  - NLP
  - Transformer
  - BERT
  - LSTM
  - Word2Vec
  - 大模型
source: "B站"
source_url: "https://www.bilibili.com/video/BV1k44LzPEhU/"
author: "尚硅谷"
stats: "77万播放 / 1.1万收藏"
total_episodes: 187
---

# NLP零基础教程知识点整理（尚硅谷187集）

> 来源：B站 · 尚硅谷
> 链接：https://www.bilibili.com/video/BV1k44LzPEhU/
> 配套资料：关注公众号「尚硅谷教育」回复"NLP"免费获取
> 课程定位：从NLP基础到Transformer/BERT/LLM大模型训练

---

## 一、NLP导论（P1-P5）

### 1.1 常见NLP任务

| 任务 | 说明 | 示例 |
|------|------|------|
| 文本分类 | 给文本打标签 | 情感分析、垃圾邮件检测 |
| 命名实体识别（NER） | 识别文本中的实体 | 人名、地名、组织名 |
| 机器翻译 | 跨语言翻译 | 中→英 |
| 文本生成 | 自动生成文本 | 对话、摘要、写作 |
| 问答系统 | 回答用户问题 | 智能客服 |
| 语义相似度 | 判断文本相似程度 | 搜索匹配 |

### 1.2 技术演进历史
```
规则方法 → 统计方法 → 深度学习 → 预训练模型 → 大模型
(1950s)    (1990s)    (2013)     (2018)       (2022+)
```

---

## 二、文本表示（P6-P25）

### 2.1 分词

**英文分词**：
- 按空格分割
- 问题：`don't` → `do` + `n't`（需要子词切分）

**BPE算法（Byte Pair Encoding）**：
- 迭代合并高频字符对
- GPT/BERT 使用的分词方式
- 步骤：初始化字符表 → 统计相邻字符频率 → 合并最高频对 → 重复

**中文分词**：
- `jieba` 分词工具
- 三种模式：精确模式、全模式、搜索引擎模式
- 自定义词典：添加专业词汇

### 2.2 词表示

**One-Hot编码**：
```
词表: [我, 爱, 学习, NLP]
"我"  → [1, 0, 0, 0]
"爱"  → [0, 1, 0, 0]
```
- 问题：维度灾难、无法表示语义关系

**Word2Vec（语义化词向量）**：

| 模型 | 输入 | 输出 | 说明 |
|------|------|------|------|
| Skip-Gram | 中心词 | 上下文词 | 用中心词预测上下文 |
| CBOW | 上下文词 | 中心词 | 用上下文预测中心词 |

```python
from gensim.models import Word2Vec

# 训练词向量
model = Word2Vec(sentences, vector_size=100, window=5, min_count=1)

# 获取词向量
vector = model.wv["学习"]

# 相似词
similar = model.wv.most_similar("学习", topn=5)
```

**词向量应用**：
- 语义相似度计算
- 文本分类特征
- 机器翻译

**OOV问题**（Out of Vocabulary）：
- 未登录词无法获取词向量
- 解决方案：子词切分、字符级Embedding

**上下文相关词向量**：
- Word2Vec：静态词向量，一个词只有一个向量
- ELMo/BERT：动态词向量，同一词在不同上下文有不同向量

---

## 三、传统序列模型（P26-P86）

### 3.1 RNN（循环神经网络）

**基础结构**：
```
h_t = tanh(W_hh * h_{t-1} + W_xh * x_t + b)
```
- 隐状态 h_t 编码了历史信息
- 参数共享：所有时间步使用相同权重

**多层RNN**：堆叠多个RNN层，增强表达能力

**双向RNN**：同时从前向后和从后向前编码
```
→ h_t: 从前向后
← h_t: 从后向前
h_t = [→h_t; ←h_t]  # 拼接
```

**RNN API**：
```python
import torch.nn as nn

rnn = nn.RNN(
    input_size=100,   # 输入维度
    hidden_size=256,  # 隐藏层维度
    num_layers=2,     # 层数
    batch_first=True, # 输入格式
    bidirectional=True # 双向
)

# 输入: (batch, seq_len, input_size)
# 输出: (batch, seq_len, hidden_size * num_directions)
```

**RNN存在问题**：
- **梯度消失**：长序列难以学习远距离依赖
- **梯度爆炸**：训练不稳定

### 3.2 LSTM（长短期记忆网络）

**核心思想**：引入门控机制，选择性遗忘/记忆

**三个门**：
| 门 | 作用 | 公式 |
|------|------|------|
| 遗忘门 | 决定丢弃哪些信息 | f = σ(W_f · [h_{t-1}, x_t]) |
| 输入门 | 决定存储哪些新信息 | i = σ(W_i · [h_{t-1}, x_t]) |
| 输出门 | 决定输出哪些信息 | o = σ(W_o · [h_{t-1}, x_t]) |

**细胞状态**：
```
C_t = f * C_{t-1} + i * tanh(W_C · [h_{t-1}, x_t])
```
- 遗忘门控制旧记忆的保留
- 输入门控制新信息的写入
- 细胞状态像传送带，信息可以无损传播

**LSTM为什么能缓解梯度消失**：
- 细胞状态的加法操作（不是乘法）
- 梯度可以通过细胞状态直接传播

### 3.3 GRU（门控循环单元）

**简化版LSTM**：
- 只有两个门：更新门、重置门
- 参数更少，训练更快

```python
# GRU API
gru = nn.GRU(input_size=100, hidden_size=256)
```

### 3.4 LSTM/GRU/RNN对比

| 模型 | 门数量 | 参数量 | 长距离依赖 | 速度 |
|------|--------|--------|------------|------|
| RNN | 0 | 最少 | 差 | 最快 |
| GRU | 2 | 中等 | 好 | 中等 |
| LSTM | 3 | 最多 | 最好 | 最慢 |

### 3.5 RNN/LSTM案例实战

**项目结构**：
```
data/          # 数据集
model/         # 模型定义
train.py       # 训练脚本
predict.py     # 预测脚本
evaluate.py    # 评估脚本
tokenizer.py   # 分词器
```

**数据预处理**：
1. 读取JSON数据
2. 构建词表（Word2Idx）
3. 文本转索引序列
4. 填充/截断到固定长度
5. 划分训练集/测试集

**模型定义**：
```python
class SentimentModel(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, num_classes):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, num_classes)
    
    def forward(self, x):
        embed = self.embedding(x)
        output, (h_n, c_n) = self.lstm(embed)
        return self.fc(h_n[-1])
```

**训练流程**：
```python
for epoch in range(num_epochs):
    for batch in train_loader:
        optimizer.zero_grad()
        output = model(batch.text)
        loss = criterion(output, batch.label)
        loss.backward()
        optimizer.step()
```

---

## 四、Seq2Seq模型（P87-P107）

### 4.1 模型结构

```
编码器（Encoder）：输入序列 → 隐状态向量（上下文）
                            ↓
解码器（Decoder）：上下文向量 → 输出序列
```

### 4.2 编码器
- 使用RNN/LSTM/GRU
- 最后一个时间步的隐状态作为上下文向量

### 4.3 解码器
- 以编码器的最终隐状态为初始状态
- 逐词生成输出序列
- Teacher Forcing：训练时用真实标签作为下一时刻输入

### 4.4 训练机制
```
输入: "我爱学习"
编码: LSTM → context_vector
解码: LSTM(context) → "I" → LSTM("I") → "love" → ... 
```

### 4.5 推理机制
- 没有Teacher Forcing
- 用模型自己的输出作为下一时刻输入
- 直到生成EOS（结束符）

### 4.6 BLEU评估
```python
from nltk.translate.bleu_score import corpus_bleu

# BLEU分数：0~1，越高越好
references = [["我", "爱", "学习"]]
hypotheses = [["I", "love", "learning"]]
score = corpus_bleu(references, hypotheses)
```

---

## 五、Attention机制（P108-P115）

### 5.1 为什么需要Attention
- Seq2Seq的问题：所有信息压缩到一个固定长度的向量
- 长序列信息丢失严重
- Attention：解码器可以"关注"编码器的任意位置

### 5.2 工作原理
```
解码器每一步：
1. 计算当前隐状态与所有编码器隐状态的相似度（注意力分数）
2. 用softmax归一化得到注意力权重
3. 加权求和编码器隐状态得到上下文向量
4. 结合上下文向量生成输出
```

### 5.3 注意力评分函数

| 函数 | 公式 | 特点 |
|------|------|------|
| 点积 | score = Q · K^T | 简单高效 |
| 加性 | score = v^T · tanh(W_1·Q + W_2·K) | 参数多，表达力强 |
| 缩放点积 | score = Q · K^T / √d_k | Transformer使用 |

### 5.4 Attention代码实现
```python
class Attention(nn.Module):
    def __init__(self, hidden_dim):
        super().__init__()
        self.W_q = nn.Linear(hidden_dim, hidden_dim)
        self.W_k = nn.Linear(hidden_dim, hidden_dim)
        self.W_v = nn.Linear(hidden_dim, hidden_dim)
    
    def forward(self, query, key, value):
        Q = self.W_q(query)
        K = self.W_k(key)
        V = self.W_v(value)
        
        scores = torch.bmm(Q, K.transpose(1, 2))
        weights = F.softmax(scores / math.sqrt(K.size(-1)), dim=-1)
        context = torch.bmm(weights, V)
        return context, weights
```

---

## 六、Transformer（P116-P149）

### 6.1 核心思想
- **完全基于Attention**，抛弃RNN
- **自注意力（Self-Attention）**：序列内部元素互相注意
- **并行计算**：比RNN快得多

### 6.2 模型结构

```
┌─────────────────────────────────────┐
│           Transformer               │
│  ┌─────────────┐  ┌─────────────┐  │
│  │   Encoder   │  │   Decoder   │  │
│  │  ┌───────┐  │  │  ┌───────┐  │  │
│  │  │Self-  │  │  │  │Masked │  │  │
│  │  │Attn   │  │  │  │Self-  │  │  │
│  │  └───────┘  │  │  │Attn   │  │  │
│  │  ┌───────┐  │  │  └───────┘  │  │
│  │  │FFN    │  │  │  ┌───────┐  │  │
│  │  └───────┘  │  │  │Cross- │  │  │
│  │             │  │  │Attn   │  │  │
│  │  + Add&Norm │  │  └───────┘  │  │
│  └─────────────┘  │  ┌───────┐  │  │
│                    │  │FFN    │  │  │
│                    │  └───────┘  │  │
│                    │  + Add&Norm │  │
│                    └─────────────┘  │
└─────────────────────────────────────┘
```

### 6.3 编码器详解

**自注意力子层**：
```
1. 生成Q、K、V向量：
   Q = X · W_Q
   K = X · W_K
   V = X · W_V

2. 计算注意力分数：
   scores = Q · K^T / √d_k

3. Softmax归一化：
   weights = softmax(scores)

4. 加权求和：
   output = weights · V
```

**多头注意力**：
```python
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        self.d_k = d_model // num_heads
        self.num_heads = num_heads
        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)
    
    def forward(self, Q, K, V, mask=None):
        batch_size = Q.size(0)
        
        # 线性变换 + 多头拆分
        Q = self.W_q(Q).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        K = self.W_k(K).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        V = self.W_v(V).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        
        # 缩放点积注意力
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(self.d_k)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, -1e9)
        weights = F.softmax(scores, dim=-1)
        output = torch.matmul(weights, V)
        
        # 多头合并 + 线性变换
        output = output.transpose(1, 2).contiguous().view(batch_size, -1, self.d_model)
        return self.W_o(output)
```

**前馈神经网络（FFN）**：
```python
class FeedForward(nn.Module):
    def __init__(self, d_model, d_ff):
        super().__init__()
        self.linear1 = nn.Linear(d_model, d_ff)
        self.linear2 = nn.Linear(d_ff, d_model)
    
    def forward(self, x):
        return self.linear2(F.relu(self.linear1(x)))
```

**残差连接 & 层归一化**：
```python
# 残差连接：解决梯度消失
output = layer(x) + x

# 层归一化：稳定训练
output = LayerNorm(output)
```

**位置编码**：
- Transformer没有位置信息（不像RNN有顺序）
- 需要额外注入位置编码

```python
# 正弦位置编码
PE(pos, 2i) = sin(pos / 10000^(2i/d_model))
PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
```

### 6.4 解码器详解

**Masked Self-Attention**：
- 防止解码器看到未来位置
- 只能注意到当前位置之前的信息

```python
# 创建mask
mask = torch.triu(torch.ones(seq_len, seq_len), diagonal=1).bool()
scores = scores.masked_fill(mask, -1e9)
```

**Cross-Attention**：
- Q来自解码器，K和V来自编码器
- 解码器关注编码器的输出

### 6.5 为什么注意力需要缩放
- Q·K^T 的值可能很大
- softmax梯度会很小（饱和区）
- 除以 √d_k 使方差稳定

### 6.6 位置编码如何感知相对位置
- 正弦编码的差值只依赖相对位置
- PE(pos+k) 可以表示为 PE(pos) 的线性函数

### 6.7 训练与推理
- **训练**：Teacher Forcing，并行计算所有位置
- **推理**：自回归生成，逐个token生成

### 6.8 nn.Transformer API
```python
transformer = nn.Transformer(
    d_model=512,
    nhead=8,
    num_encoder_layers=6,
    num_decoder_layers=6,
    dim_feedforward=2048,
    dropout=0.1
)

# forward
output = transformer(src, tgt, src_mask=src_mask, tgt_mask=tgt_mask)
```

---

## 七、预训练模型（P150-P187）

### 7.1 预训练模型分类

| 类型 | 代表 | 特点 |
|------|------|------|
| 仅编码器 | BERT | 双向注意力，适合理解任务 |
| 仅解码器 | GPT | 单向注意力，适合生成任务 |
| 编码器-解码器 | T5 | 全能型，理解+生成 |

### 7.2 GPT系列

**模型结构**：
- 仅解码器Transformer
- 因果注意力掩码（Causal Mask）
- 参数规模：117M → 175B → ...

**预训练**：
- 目标：预测下一个token（自回归）
- 数据：大规模文本语料

**微调**：
- 在下游任务上 fine-tune
- 冻结大部分层，只微调顶层

### 7.3 BERT系列

**模型结构**：
- 仅编码器Transformer
- 双向注意力
- 参数：110M（Base）/ 340M（Large）

**预训练任务**：
1. **MLM（Masked Language Modeling）**：随机遮盖15%的token，预测被遮盖的
2. **NSP（Next Sentence Prediction）**：判断两个句子是否相邻

**微调**：
```python
from transformers import BertForSequenceClassification

model = BertForSequenceClassification.from_pretrained(
    'bert-base-chinese', num_labels=2)

# 添加分类头
outputs = model(input_ids, attention_mask=attention_mask)
logits = outputs.logits
```

### 7.4 T5系列
- 编码器-解码器架构
- 把所有任务统一为"文本到文本"格式
- 翻译：`translate English to French: Hello` → `Bonjour`
- 分类：`sst2 sentence: This movie is great` → `positive`

### 7.5 HuggingFace生态

**AutoModel加载**：
```python
from transformers import AutoModel, AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("bert-base-chinese")
model = AutoModel.from_pretrained("bert-base-chinese")
```

**AutoModelForXXX**：
```python
from transformers import AutoModelForSequenceClassification

model = AutoModelForSequenceClassification.from_pretrained(
    "bert-base-chinese", num_labels=2)
```

**Tokenizer使用**：
```python
# 分词
tokens = tokenizer("我爱学习", return_tensors="pt")

# 编码
encoded = tokenizer.encode("我爱学习")

# 解码
decoded = tokenizer.decode([101, 2769, 4263, 2340, 102])
```

**Datasets库**：
```python
from datasets import load_dataset

# 加载数据集
dataset = load_dataset("imdb")

# 预处理
def preprocess(examples):
    return tokenizer(examples["text"], truncation=True, padding=True)

tokenized = dataset.map(preprocess, batched=True)

# 划分训练集/测试集
split = tokenized.train_test_split(test_size=0.2)
```

### 7.6 预训练模型案例

**数据预处理**：
1. 加载原始数据
2. Tokenizer编码
3. 截断/填充
4. 创建Dataset和DataLoader

**模型定义**：
```python
class TextClassifier(nn.Module):
    def __init__(self, model_name, num_classes):
        super().__init__()
        self.bert = AutoModel.from_pretrained(model_name)
        self.classifier = nn.Linear(self.bert.config.hidden_size, num_classes)
    
    def forward(self, input_ids, attention_mask):
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        pooled = outputs.pooler_output  # [CLS] token
        return self.classifier(pooled)
```

**训练与评估**：
```python
# 训练
for batch in train_loader:
    outputs = model(batch["input_ids"], batch["attention_mask"])
    loss = criterion(outputs, batch["labels"])
    loss.backward()
    optimizer.step()

# 评估
accuracy = evaluate(model, test_loader)
```

---

## 八、关键概念速查

| 概念 | 一句话解释 |
|------|-----------|
| Word2Vec | 通过上下文学习词向量的模型 |
| BPE | 字节对编码，子词切分算法 |
| RNN | 循环神经网络，处理序列数据 |
| LSTM | 长短期记忆网络，缓解梯度消失 |
| GRU | 门控循环单元，简化版LSTM |
| Seq2Seq | 编码器-解码器结构 |
| Attention | 注意力机制，动态聚焦重要信息 |
| Self-Attention | 自注意力，序列内部元素互相注意 |
| Multi-Head Attention | 多头注意力，多个注意力头并行 |
| Position Encoding | 位置编码，注入位置信息 |
| Transformer | 纯注意力架构，抛弃RNN |
| BERT | 双向预训练模型，适合理解任务 |
| GPT | 自回归预训练模型，适合生成任务 |
| T5 | 编码器-解码器预训练模型 |
| MLM | 掩码语言模型，BERT的预训练任务 |
| Fine-tuning | 在预训练模型基础上针对特定任务微调 |

---

## 九、面试高频问题

### Q1：Transformer为什么比RNN好？
- **并行计算**：RNN必须按时间步顺序计算，Transformer可以并行
- **长距离依赖**：Self-Attention直接建立任意位置间的连接
- **表达能力**：多头注意力可以捕捉不同类型的依赖关系

### Q2：Self-Attention的时间复杂度？
- O(n² · d)，n是序列长度，d是维度
- 长序列效率低，催生了FlashAttention等优化

### Q3：BERT和GPT的区别？
- **BERT**：双向编码器，理解任务（分类、NER）
- **GPT**：单向解码器，生成任务（对话、写作）
- BERT用MLM预训练，GPT用CLM预训练

### Q4：LSTM如何缓解梯度消失？
- 细胞状态的加法操作（不是乘法）
- 遗忘门控制信息保留
- 梯度可以沿细胞状态直接传播

### Q5：位置编码的作用？
- Transformer没有位置感知能力
- 位置编码注入序列顺序信息
- 正弦编码可以泛化到训练时未见过的长度
