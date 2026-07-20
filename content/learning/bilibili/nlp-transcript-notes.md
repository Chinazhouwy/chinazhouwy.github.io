---
title: "NLP零基础教程·转写笔记（尚硅谷187集）"
date: "2026-07-21"
domain: "技术"
area: "AI Agent"
type: "学习笔记"
status: "可复习"
priority: "P1"
energy: "high"
visibility: "private"
summary: "NLP从零基础到Transformer/BERT/LLM大模型训练的187集课程转写精要"
tags:
  - NLP
  - Transformer
  - BERT
  - GPT
  - LSTM
  - Word2Vec
  - HuggingFace
source: "B站"
source_url: "https://www.bilibili.com/video/BV1k44LzPEhU/"
author: "尚硅谷"
stats: "77万播放 / 1.1万收藏"
total_episodes: 187
---

# NLP零基础教程·转写笔记（尚硅谷187集）

> 来源：B站 · 尚硅谷
> 链接：https://www.bilibili.com/video/BV1k44LzPEhU/
> 转写文件：/tmp/bili_transcripts/NLP零基础教程/

---

## 一、NLP导论（P1-P5，32KB）

### 1.1 课程定位
- NLP（Natural Language Processing）自然语言处理
- 从零基础到 Transformer/BERT/LLM 大模型训练

### 1.2 常见NLP任务（P003）
| 任务 | 说明 | 示例 |
|------|------|------|
| 文本分类 | 给文本打标签 | 情感分析、垃圾邮件检测 |
| 命名实体识别（NER） | 识别文本中的实体 | 人名、地名、组织名 |
| 机器翻译 | 跨语言翻译 | 中→英 |
| 文本生成 | 自动生成文本 | 对话、摘要、写作 |
| 问答系统 | 回答用户问题 | 智能客服 |
| 语义相似度 | 判断文本相似程度 | 搜索匹配 |

### 1.3 技术演进历史（P004，重点）
```
规则方法 → 统计方法 → 机器学习 → 深度学习 → 预训练模型
(1950s)    (1990s)    (2000s)    (2015)     (2018+)
```

**规则阶段**：
- 人工编写 if-else 规则 + 正则表达式
- 代表：1954年乔治城-IBM实验（60个俄→英翻译）、ELIZA聊天机器人（1966，模拟心理咨询师）
- 优点：可解释性强；缺点：扩展性差

**统计阶段**：
- N-gram 语言模型：根据前 n-1 个词预测下一个词
- Bigram 示例：从语料统计"我爱""我想"等二元组频率，按概率预测
- 从专家经验→数据驱动

**机器学习阶段**：
- 逻辑回归、SVM、决策树、条件随机场
- 特征工程成为关键（词袋模型 Bag of Words）
- 词袋模型问题：完全忽略语序（"猫吃鱼"和"鱼吃猫"向量相同）
- 解决：引入 N-gram 作为特征单元

**深度学习阶段**：
- RNN → LSTM → GRU → Transformer
- 自动学习词向量，告别手工特征工程

---

## 二、文本表示（P6-P25，94KB）

### 2.1 分词（P6-P13）

**英文分词**：
- 按空格分割；问题：`don't` → `do` + `n't`

**BPE算法（Byte Pair Encoding，P008）**：
- 迭代合并高频字符对
- GPT/BERT 使用的分词方式
- 步骤：初始化字符表 → 统计相邻字符频率 → 合并最高频对 → 重复

**中文分词**：
- `jieba` 分词工具（P011-P013）
- 三种模式：精确模式、全模式、搜索引擎模式
- 自定义词典：添加专业词汇
```python
import jieba
jieba.add_user_file("user_dict.txt")
words = jieba.lcut("我在学习自然语言处理")
```

### 2.2 词表示（P14-P25）

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
| Skip-Gram（P016） | 中心词 | 上下文词 | 用中心词预测上下文 |
| CBOW（P017） | 上下文词 | 中心词 | 用上下文预测中心词 |

```python
from gensim.models import Word2Vec

# 训练词向量
model = Word2Vec(sentences, vector_size=100, window=5, min_count=1)

# 获取词向量
vector = model.wv["学习"]

# 语义相似度
model.wv.most_similar("学习", topn=5)
```

**公开词向量（P018-P019）**：
- 腾讯词向量、搜狗词向量等
- 加载方式：KeyedVectors.load_word2vec_format()

**训练词向量（P020-P021）**：
- 使用 Gensim 自定义训练
- 参数：vector_size（维度）、window（窗口大小）、min_count（最小词频）

**应用（P022-P023）**：
- 语义相似度计算
- 词向量运算：king - man + woman ≈ queen

**OOV问题（P024）**：
- Out Of Vocabulary：新词不在词表中
- 解决：子词切分、字符级嵌入

**上下文相关词向量（P025）**：
- Word2Vec 是静态的（每个词一个固定向量）
- ELMo 引入上下文相关词向量

---

## 三、传统序列模型（P26-P86，311KB）

### 3.1 RNN（P26-P66，210KB）

**基础结构（P027）**：
- 循环神经网络：隐藏状态 h_t = tanh(W_h * h_{t-1} + W_x * x_t + b)
- 每个时间步共享参数

**多层结构（P029）**：
- 堆叠多个 RNN 层，增加模型容量

**双向结构（P030）**：
- 同时从前向后和从后向前计算
- 每个位置的输出融合上下文信息
- `bidirectional=True`

**API使用（P032-P036）**：
```python
import torch.nn as nn

rnn = nn.RNN(input_size=10, hidden_size=20, num_layers=2, batch_first=True)
# 输入: (batch, seq_len, input_size)
# 输出: (batch, seq_len, hidden_size)
# 隐藏状态: (num_layers, batch, hidden_size)
```

**案例：输入法预测（P037-P064）**：
- 数据预处理：读取JSON、构建词表、编码
- 模型定义：Embedding + RNN + Linear
- 训练循环、TensorBoard 可视化
- 预测脚本、评估脚本

**RNN存在问题（P065-P066）**：
- 梯度消失/爆炸：长序列难以捕捉远距离依赖
- 顺序计算：无法并行，效率低

### 3.2 LSTM（P67-P82，91KB）

**核心思想（P067-P070）**：
- 引入门控机制：遗忘门、输入门、输出门
- 细胞状态 C_t 作为"传送带"，缓解梯度消失

**三个门**：
- 遗忘门 f_t：决定丢弃哪些信息
- 输入门 i_t：决定更新哪些信息
- 输出门 o_t：决定输出哪些信息

```python
lstm = nn.LSTM(input_size=10, hidden_size=20, num_layers=2, batch_first=True)
# 输入输出与 RNN 类似
```

**LSTM vs RNN（P082）**：
- LSTM 通过门控机制缓解梯度消失
- 但计算量更大，训练更慢

### 3.3 GRU（P83-P86，10KB）

**简化版 LSTM（P083）**：
- 只有两个门：重置门、更新门
- 参数更少，训练更快

**三者对比（P086）**：
| 模型 | 门数量 | 参数量 | 适用场景 |
|------|--------|--------|----------|
| RNN | 0 | 最少 | 简单任务 |
| LSTM | 3 | 较多 | 长序列 |
| GRU | 2 | 中等 | 平衡效率与效果 |

---

## 四、Seq2Seq（P87-P107，140KB）

### 4.1 模型结构（P087-P091）

**编码器（P088）**：
- 接收输入序列，输出上下文向量 c
- 使用双向 RNN 效果更好

**解码器（P089）**：
- 接收上下文向量 c，自回归生成输出序列
- 每个时间步输出一个 token

**训练机制（P090）**：
- Teacher Forcing：训练时用真实标签作为下一步输入
- 损失函数：交叉熵

**推理机制（P091）**：
- 自回归生成：每步输出作为下一步输入
- 需要处理 <EOS> 结束标记

### 4.2 案例：中英翻译（P092-P107）

**数据预处理（P094-P098）**：
- 读取平行语料
- 自定义 Tokenizer（加入 <SOS>、<EOS>、<PAD>）
- 构建词表、编码数据集
- DataLoader 封装

**模型定义（P099-P101）**：
```python
class Encoder(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers):
        super().__init__()
        self.embedding = nn.Embedding(input_size, hidden_size)
        self.rnn = nn.GRU(hidden_size, hidden_size, num_layers, batch_first=True)
    
    def forward(self, src):
        embedded = self.embedding(src)
        outputs, hidden = self.rnn(embedded)
        return outputs, hidden

class Decoder(nn.Module):
    def __init__(self, output_size, hidden_size, num_layers):
        super().__init__()
        self.embedding = nn.Embedding(output_size, hidden_size)
        self.rnn = nn.GRU(hidden_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, output_size)
    
    def forward(self, tgt, hidden):
        embedded = self.embedding(tgt)
        output, hidden = self.rnn(embedded, hidden)
        prediction = self.fc(output)
        return prediction, hidden
```

**训练脚本（P102-P103）**：
- Teacher Forcing 训练
- PAD token 处理逻辑

**预测与评估（P104-P106）**：
- 自回归生成
- BLEU 评分评估翻译质量

---

## 五、Attention机制（P108-P115，31KB）

### 5.1 核心思想（P108-P111）

**为什么需要 Attention**：
- Seq2Seq 的问题：所有信息压缩成固定长度的上下文向量 c
- 长序列信息丢失严重

**工作原理（P109-P110）**：
1. 计算相关性（点积）
2. 算评分（归一化）
3. 算上下文向量（加权求和）
4. 融合信息

**注意力评分函数（P111）**：
- 点积注意力：score = Q · K^t
- 加性注意力：score = v^t · tanh(W1·Q + W2·K)
- 缩放点积注意力：score = (Q · K^t) / sqrt(d_k)

### 5.2 案例实现（P112-P115）
- 在 Seq2Seq 基础上添加 Attention
- 编码器输出所有时间步的隐藏状态
- 解码器每步计算注意力权重，动态选择相关信息

---

## 六、Transformer（P116-P149，195KB）⭐

### 6.1 核心思想（P117）

**"Attention is All You Need"**：
- RNN 和 Attention 本质都在建模 token 间的依赖关系
- Attention 可以完全取代 RNN

**Attention vs RNN 优势**：
1. **并行计算**：无需顺序计算，效率提升巨大
2. **长距离依赖**：任意位置直接建立联系，梯度路径与序列长度无关

**关键对比**：
- 编码器：对标双向 RNN（每个位置融合全部上下文）
- 解码器：对标单向 RNN（只能看到前文，预测下一个 token）

### 6.2 模型结构（P118-P133）

**整体结构（P118）**：
```
Input → [Encoder × N] → Context Vector
Output → [Decoder × N] → Prediction

Encoder Layer = Self-Attention + Feed-Forward
Decoder Layer = Masked Self-Attention + Cross-Attention + Feed-Forward
```

**编码器详解（P119-P129）**：

**自注意力子层（P120-P122）**：
- QKV 向量生成：
  ```
  Q = X · W_Q  (查询向量，发起匹配)
  K = X · W_K  (键向量，接收匹配)
  V = X · W_V  (值向量，提供内容信息)
  ```
- 核心思想：将原来一个向量的职责单一化，每个向量只学一个规律
- 计算过程：Q · K^t → softmax → 加权求和 V
- 原始论文：输入 512 维，QKV 64 维

**多头注意力（P122）**：
- 多组 W_Q/W_K/W_V 并行计算
- 拼接后线性变换
- 捕捉不同子空间的关系

**前馈神经网络（P123）**：
- 两层全连接：FFN(x) = max(0, x·W1 + b1)·W2 + b2
- 维度先扩大再缩小

**残差连接 & 层归一化（P124-P126）**：
- 残差：输出 = x + Sublayer(x)
- LayerNorm：稳定训练

**位置编码（P127）**：
- Transformer 无循环结构，需显式编码位置信息
- 正弦/余弦编码：
  ```
  PE(pos, 2i) = sin(pos / 10000^(2i/d_model))
  PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
  ```

**解码器（P130-P133）**：
- Masked Self-Attention：屏蔽未来位置，防止信息泄露
- Cross-Attention：Q 来自解码器，K/V 来自编码器输出

### 6.3 实现细节（P134-P141）

**缩放点积注意力（P134）**：
- 为什么要除以 sqrt(d_k)：防止点积值过大导致 softmax 梯度消失

**nn.Transformer API（P137-P141）**：
```python
import torch.nn as nn

transformer = nn.Transformer(
    d_model=512,
    nhead=8,
    num_encoder_layers=6,
    num_decoder_layers=6,
    dim_feedforward=2048,
    dropout=0.1
)

# forward 方法
output = transformer(src, tgt, src_mask=..., tgt_mask=...)
```

### 6.4 案例实战（P142-P149）

**模型定义（P143-P146）**：
- 位置编码实现（简易版 + 哈弗版）
- 前向传播逻辑

**训练与评估（P147-P148）**：
- 训练脚本、预测脚本、评估脚本

**哈佛版本源码解读（P149，重点）**：
- 完整的 Transformer 实现
- 各组件详解

---

## 七、预训练模型（P150-P161，54KB）

### 7.1 概述（P150-P151）

**预训练范式**：
1. 预训练（Pre-training）：大规模无标注数据，学习通用语言表示
2. 微调（Fine-tuning）：少量标注数据，适配下游任务

**分类**：
- 自编码（Autoencoding）：BERT，完形填空
- 自回归（Autoregressive）：GPT，预测下一个词
- Seq2Seq（Encoder-Decoder）：T5，统一框架

### 7.2 GPT（P152-P155）

**模型结构（P153）**：
- 纯 Decoder 架构（带 Masked Self-Attention）
- 单向：只能看到前文

**预训练（P154）**：
- 目标：预测下一个 token
- 自回归语言建模

**微调（P155）**：
- 在顶部添加任务头
- 支持：文本分类、文本蕴含、语义相似度、多项选择
- 冻结部分层 + 微调顶层

### 7.3 BERT（P156-P159）

**模型结构（P157）**：
- 纯 Encoder 架构
- 双向：可以看到完整上下文
- BERT-Base：12层，768维，12头
- BERT-Large：24层，1024维，16头

**微调（P158，重点）**：
1. **句子对分类**：CLS + Sentence1 + SEP + Sentence2 + SEP → 取 CLS 输出 → 线性层
2. **单句分类**：CLS + Sentence + SEP → 取 CLS 输出 → 线性层
3. **问答任务**：CLS + Question + SEP + Context + SEP → 每个 token 预测起始/结束位置（两个线性层，输出维度=1）
4. **序列标注**：CLS + Sentence + SEP → 每个 token 独立分类

**预训练（P159）**：
- MLM（Masked Language Model）：随机遮盖 15% 的 token，预测被遮盖的词
- NSP（Next Sentence Prediction）：预测两个句子是否相邻

### 7.4 T5（P160-P161）
- Encoder-Decoder 架构
- 统一的文本到文本框架
- 所有任务都转化为文本生成

---

## 八、HuggingFace 生态（P162-P187，151KB）

### 8.1 模型加载（P162-P165）

**AutoModel（P163）**：
```python
from transformers import AutoModel

# 在线加载
model = AutoModel.from_pretrained("bert-base-chinese")

# 本地加载
model = AutoModel.from_pretrained("./pretrained/bert-base-chinese")
```

**加载流程**：
1. 下载模型资源（config.json + model.safetensors）
2. 根据 config.json 创建模型结构
3. 加载权重参数

**镜像配置**：
```bash
export HF_ENDPOINT=https://hf-mirror.com
```

**AutoModelForXXX（P164）**：
```python
from transformers import AutoModelForSequenceClassification

# 自带分类头
model = AutoModelForSequenceClassification.from_pretrained(
    "bert-base-chinese", num_labels=2
)
```

### 8.2 Tokenizer（P166-P168）

**加载与使用（P166-P167）**：
```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("bert-base-chinese")

# 编码
encoded = tokenizer("我在学习NLP", return_tensors="pt")
# {'input_ids': tensor([[101, 2769, 3221, 2629, 3698, 102]]),
#  'token_type_ids': tensor([[0, 0, 0, 0, 0, 0]]),
#  'attention_mask': tensor([[1, 1, 1, 1, 1, 1]])}

# 解码
decoded = tokenizer.decode(encoded['input_ids'][0])
```

**特殊 token**：
- `[CLS]`：分类 token（ID=101）
- `[SEP]`：分隔 token（ID=102）
- `[PAD]`：填充 token（ID=0）
- `[UNK]`：未知 token（ID=100）

### 8.3 Datasets（P169-P178）

**加载数据集（P170-P172）**：
```python
from datasets import load_dataset

# 加载本地数据
dataset = load_dataset("csv", data_files="data.csv")

# 加载在线数据集
dataset = load_dataset("glue", "sst2")
```

**数据预处理（P173-P176）**：
```python
# 过滤
dataset = dataset.filter(lambda x: x["label"] == 1)

# 划分
dataset = dataset.train_test_split(test_size=0.2)

# map 批量处理
def tokenize(examples):
    return tokenizer(examples["text"], padding="max_length", truncation=True)

dataset = dataset.map(tokenize, batched=True)
```

**保存与加载（P177）**：
```python
dataset.save_to_disk("./processed_dataset")
```

**集成 Dataloader（P178）**：
```python
from torch.utils.data import DataLoader

dataloader = DataLoader(dataset["train"], batch_size=32, shuffle=True)
```

### 8.4 案例实战（P179-P187）
- 数据预处理完整流程
- DataLoader 封装
- 模型定义、训练、推理、评估
- 带任务头的预训练模型

---

## 课程路径总结

```
NLP基础 → 分词/词向量 → RNN/LSTM/GRU → Seq2Seq → Attention
    → Transformer → GPT/BERT/T5 → HuggingFace 生态
```

**核心能力链**：
1. 文本如何变成向量（分词 → 词向量 → 上下文表示）
2. 序列如何建模（RNN → LSTM → Transformer）
3. 注意力如何工作（Attention → Self-Attention → Multi-Head）
4. 预训练如何微调（GPT/BERT/T5 → HuggingFace 工具链）
