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
summary: "NLP从零基础到Transformer/BERT/LLM大模型训练的187集课程转写精要，含完整代码示例"
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

**深度学习阶段**：
- RNN → LSTM → GRU → Transformer
- 自动学习词向量，告别手工特征工程

---

## 二、文本表示（P6-P25，94KB）

### 2.1 分词（P6-P13）

**BPE算法（Byte Pair Encoding，P008）**：
- 迭代合并高频字符对
- GPT/BERT 使用的分词方式

**中文分词（P011-P013）**：
```python
import jieba
jieba.add_user_file("user_dict.txt")
words = jieba.lcut("我在学习自然语言处理")
```

### 2.2 词表示（P14-P25）

**Word2Vec**：
```python
from gensim.models import Word2Vec

# 训练词向量
model = Word2Vec(sentences, vector_size=100, window=5, min_count=1)

# 获取词向量
vector = model.wv["学习"]

# 语义相似度
model.wv.most_similar("学习", topn=5)
```

---

## 三、传统序列模型（P26-P86）

### 3.1 RNN（P26-P66）

**API使用（P032-P036）**：
```python
import torch.nn as nn

rnn = nn.RNN(input_size=10, hidden_size=20, num_layers=2, batch_first=True)
# 输入: (batch, seq_len, input_size)
# 输出: (batch, seq_len, hidden_size)
# 隐藏状态: (num_layers, batch, hidden_size)
```

### 3.2 案例：输入法预测（P050-P056）⭐

> **项目目标**：基于RNN实现输入法下一个词预测。输入一段拼音序列，模型预测下一个可能的汉字。

#### 3.2.1 超参数配置（config.py）

```python
# config.py
class Config:
    # 路径
    vocab_dir = "./models"
    logs_dir = "./logs"

    # 模型参数
    embedding_dim = 128   # 词向量维度
    hidden_size = 256     # 隐藏层维度（一般比embedding_dim大）

    # 训练参数
    seq_len = 5           # 序列长度（输入法场景固定5）
    epochs = 10
    learning_rate = 1e-3
    batch_size = 50

config = Config()
```

#### 3.2.2 模型定义（model.py）— P050/P051

```python
import torch
import torch.nn as nn
import config


class InputMethodModel(nn.Module):
    """
    输入法预测模型：Embedding → RNN → Linear
    输入：一段拼音ID序列 (batch_size, seq_len)
    输出：下一个词的概率分布 (batch_size, vocab_size)
    """
    def __init__(self, vocab_size):
        super().__init__()

        # 1. Embedding层：将token ID转为向量
        #    方式一：随机初始化 nn.Embedding(vocab_size, embedding_dim)
        #    方式二：预训练词向量 nn.Embedding.from_pretrained(...)
        self.embedding = nn.Embedding(
            num_embeddings=vocab_size,
            embedding_dim=config.embedding_dim
        )

        # 2. RNN层：核心循环结构
        #    input_size = embedding_dim（词向量维度）
        #    hidden_size > embedding_dim（需要容纳多个token的信息）
        self.rnn = nn.RNN(
            input_size=config.embedding_dim,
            hidden_size=config.hidden_size,
            batch_first=True   # 始终设为True，输入形状为(batch, seq, feature)
        )

        # 3. 线性层：将隐藏状态映射到词表大小
        self.linear = nn.Linear(
            in_features=config.hidden_size,
            out_features=vocab_size
        )

    def forward(self, x):
        """
        x 形状: (batch_size, seq_len) — token ID序列
        """
        # Embedding: (batch_size, seq_len) → (batch_size, seq_len, embedding_dim)
        embed = self.embedding(x)

        # RNN: (batch_size, seq_len, embedding_dim) → output (batch_size, seq_len, hidden_size)
        #      h_n不手写循环时用不上，忽略
        output, _ = self.rnn(embed)

        # 取每个样本最后一个时间步的隐藏状态
        # output[:, -1, :] → (batch_size, hidden_size)
        last_hidden_state = output[:, -1, :]

        # 线性层: (batch_size, hidden_size) → (batch_size, vocab_size)
        output = self.linear(last_hidden_state)
        return output
```

**关键点**（讲师口述）：
- `batch_first=True` 后输入输出的形状是 `(batch, seq_len, feature)`
- `hidden_size` 一般比 `embedding_dim` 大，因为它要融合多个token的信息
- 取最后一个时间步：`output[:, -1, :]`，从三维中切片，冒号表示全部取
- 输出 `(batch_size, vocab_size)` = 每个样本对应词表大小的概率分布

#### 3.2.3 数据集（dataset.py）

```python
import json
import torch
from torch.utils.data import Dataset, DataLoader


class InputMethodDataset(Dataset):
    def __init__(self, filepath, vocab, seq_len):
        self.seq_len = seq_len
        self.vocab = vocab
        self.data = []
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                self.data.append(json.loads(line.strip()))

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        item = self.data[idx]
        # 输入是序列，标签是最后一个token
        input_ids = item['input_ids']
        target = input_ids[-1]
        input_ids = input_ids[:self.seq_len]  # 截取到seq_len
        return torch.tensor(input_ids, dtype=torch.long), torch.tensor(target, dtype=torch.long)


def get_data_loader(filepath, vocab, seq_len, batch_size, shuffle=True):
    dataset = InputMethodDataset(filepath, vocab, seq_len)
    return DataLoader(dataset, batch_size=batch_size, shuffle=shuffle)
```

#### 3.2.4 训练脚本（train.py）— P052-P056

```python
import torch
import torch.nn as nn
import time
from torch.utils.tensorboard import SummaryWriter
from tqdm import tqdm

import config
from model import InputMethodModel
from dataset import get_data_loader


def train_one_epoch(model, data_loader, loss_fn, optimizer, device):
    """训练一个轮次，返回平均loss"""
    model.train()  # 训练模式（开启dropout等）

    total_loss = 0
    for inputs, targets in tqdm(data_loader, desc="训练"):
        inputs = inputs.to(device)
        targets = targets.to(device)

        # inputs 形状: (batch_size, seq_len)
        # targets 形状: (batch_size,)

        # 前向传播
        outputs = model(inputs)
        # outputs 形状: (batch_size, vocab_size)

        # 计算损失
        # CrossEntropyLoss 要求 input: (N, C) target: (N,)
        loss = loss_fn(outputs, targets)

        # 反向传播
        loss.backward()        # 计算梯度
        optimizer.step()       # 更新参数
        optimizer.zero_grad()  # 梯度清零

        total_loss += loss.item()

    return total_loss / len(data_loader)


def train():
    # 1. 确定设备
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # 2. 加载词表
    vocab_list = []
    with open(f"{config.vocab_dir}/vocab.txt", 'r', encoding='utf-8') as f:
        vocab_list = [line.strip() for line in f.readlines()]  # strip去掉\n
    vocab_size = len(vocab_list)

    # 3. 加载数据
    train_loader = get_data_loader(
        f"{config.data_dir}/train.jsonl", vocab_list,
        config.seq_len, config.batch_size
    )

    # 4. 创建模型
    model = InputMethodModel(vocab_size).to(device)

    # 5. 损失函数和优化器
    loss_fn = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=config.learning_rate)

    # 6. TensorBoard
    writer = SummaryWriter(config.logs_dir)

    # 7. 保存最优模型
    best_loss = float('inf')

    # 8. 开始训练
    for epoch in range(1, config.epochs + 1):
        print(f"{'=' * 10} Epoch {epoch}/{config.epochs} {'=' * 10}")

        epoch_loss = train_one_epoch(model, train_loader, loss_fn, optimizer, device)

        print(f"Loss: {epoch_loss:.4f}")

        # TensorBoard记录
        writer.add_scalar("loss", epoch_loss, epoch)

        # 保存最优模型
        if epoch_loss < best_loss:
            best_loss = epoch_loss
            torch.save(model.state_dict(), f"{config.vocab_dir}/best.pt")
            print("模型保存成功")

    writer.close()


if __name__ == "__main__":
    train()
```

**TensorBoard使用要点**（P055）：
```python
from torch.utils.tensorboard import SummaryWriter

# 创建Writer，写入日志目录
writer = SummaryWriter("./logs/experiment1")

# 每轮记录一个点 (tag, y值, x值)
writer.add_scalar("loss", epoch_loss, epoch)

# 训练结束后关闭
writer.close()
```

```bash
# 启动TensorBoard服务
tensorboard --logdir=./logs
# 在浏览器打开 http://localhost:6006
```

**多次训练对比**：使用层级目录区分不同实验
```python
# 第一次训练
writer = SummaryWriter(f"./logs/{time.strftime('%y%m%d_%H%M%S')}")
# TensorBoard能自动识别子目录，用不同颜色展示
```

**模型保存/加载**（P056）：
```python
# 保存（state_dict存所有参数）
torch.save(model.state_dict(), "best.pt")

# 加载
model = InputMethodModel(vocab_size)
model.load_state_dict(torch.load("best.pt"))
```

#### 3.2.5 预测脚本（predict.py）

```python
import torch
from model import InputMethodModel
from dataset import InputMethodDataset


def predict(model, tokenizer, text, device, seq_len=5):
    """输入拼音序列，预测下一个汉字"""
    model.eval()
    with torch.no_grad():
        # 编码
        input_ids = tokenizer.encode(text)
        input_tensor = torch.tensor([input_ids], dtype=torch.long).to(device)

        # 前向传播
        output = model(input_tensor)
        probs = torch.softmax(output, dim=-1)

        # 取top5
        top5_probs, top5_ids = probs.topk(5, dim=-1)
        return top5_ids[0].tolist(), top5_probs[0].tolist()
```

### 3.3 RNN问题（P065-P066）
- **梯度消失/爆炸**：长序列难以捕捉远距离依赖
- **顺序计算**：无法并行，效率低

---

## 四、LSTM情感分析案例（P67-P82）⭐

### 4.1 核心思想（P067-P070）
- 引入门控机制：遗忘门、输入门、输出门
- 细胞状态 C_t 作为"传送带"，缓解梯度消失

```python
lstm = nn.LSTM(input_size=10, hidden_size=20, num_layers=2, batch_first=True)
```

### 4.2 案例：电商评论情感分类（P073-P081）

> **项目目标**：基于LSTM对电商评论做二分类（正向/负向）。数据来自中文NLP语料库，6万多条评论。

#### 4.2.1 数据处理流程（P074-P076）

```python
import pandas as pd
from sklearn.model_selection import train_test_split


def process():
    # 1. 读取CSV
    df = pd.read_csv(
        f"{config.raw_data_dir}/reviews.csv",
        usecolumns=["label", "review"],
        encoding="utf-8"
    ).dropna()  # 过滤NaN

    # 2. 分层抽样划分数据集（保证正负样本比例一致）
    train_df, test_df = train_test_split(
        df, test_size=0.2,
        stratify=df["label"]  # 关键：按label分层抽样
    )

    # 3. 构建词表（基于训练集）
    # 需要去掉空格token
    vocab_set = set()
    for sentence in train_df["review"].tolist():
        tokens = [t for t in jieba.cut(sentence) if t.strip()]
        vocab_set.update(tokens)

    # 加入PAD token（放在第一位）
    vocab_list = [config.pad_token] + sorted(vocab_set)
    # 保存词表 ...

    # 4. 编码数据集
    # encode方法：分词 → 转ID → 填充/截断到指定长度
    tokenizer = JiebaTokenizer.from_vocab(vocab_path)
    train_df["review"] = train_df["review"].apply(
        lambda s: tokenizer.encode(s, seq_len=config.seq_len)
    )

    # 5. 保存为JSONL
    train_df.to_json(f"{config.processed_dir}/train.jsonl",
                     lines=True, orient="records")
```

**PAD填充逻辑**（encode方法中）：
```python
def encode(self, text, seq_len=None):
    # 1. 分词
    tokens = list(jieba.cut(text))
    # 2. 转ID
    token_ids = [self.word_to_index.get(t, self.unk_token_id) for t in tokens]
    # 3. 截断或填充
    if seq_len is not None:
        if len(token_ids) > seq_len:
            token_ids = token_ids[:seq_len]        # 截断
        elif len(token_ids) < seq_len:
            token_ids += [self.pad_token_id] * (seq_len - len(token_ids))  # 填充
    return token_ids
```

**统计序列长度**（决定seq_len）：
```python
lengths = train_df["review"].apply(lambda s: len(list(jieba.cut(s))))
print(lengths.quantile(0.95))  # 95%分位数 → 约128
```

#### 4.2.2 模型定义（model.py）— P077-P078

```python
import torch
import torch.nn as nn
import config


class ReviewLSTMModel(nn.Module):
    """
    情感分析模型：Embedding → LSTM → Linear
    输出: (batch_size,) 每个样本一个0~1的值
    """
    def __init__(self, vocab_size, padding_index):
        super().__init__()

        # Embedding（padding位置的向量永远为0，不更新）
        self.embedding = nn.Embedding(
            vocab_size, config.d_model, padding_index=padding_index
        )

        # LSTM
        self.lstm = nn.LSTM(
            input_size=config.d_model,
            hidden_size=config.hidden_size,
            batch_first=True
        )

        # 线性层（输出1维，配合BCEWithLogitsLoss）
        self.linear = nn.Linear(config.hidden_size, 1)

    def forward(self, x):
        # x 形状: (batch_size, seq_len)

        # Embedding → (batch_size, seq_len, d_model)
        embed = self.embedding(x)

        # LSTM → output (batch_size, seq_len, hidden_size)
        output, _ = self.lstm(embed)

        # 获取每个样本真实最后一个token的隐藏状态
        # （处理变长序列，不同样本实际长度不同）
        padding_idx = self.embedding.padding_index
        mask = (x != padding_idx)  # 布尔张量，非PAD为True
        lengths = mask.sum(dim=1)   # 每个样本的真实长度

        # 列表索引取最后一个真实token的隐藏状态
        batch_indexes = torch.arange(x.shape[0])
        last_hidden = output[batch_indexes, lengths - 1, :]
        # 形状: (batch_size, hidden_size)

        # 线性层 + squeeze去掉最后一维
        out = self.linear(last_hidden).squeeze(-1)
        # out 形状: (batch_size,)
        return out
```

**关键点**：
- `padding_index` 让PAD位置的词向量永远为0
- 变长序列处理：通过mask找出每个样本真实长度，用列表索引取最后一个token的隐藏状态
- `squeeze(-1)` 去掉维度1，使输出形状为 `(batch_size,)` 匹配target

#### 4.2.3 训练（train.py）— P079

```python
import torch
import torch.nn as nn
from tqdm import tqdm
from torch.utils.tensorboard import SummaryWriter

import config
from model import ReviewLSTMModel
from dataset import get_data_loader


def train_one_epoch(model, data_loader, loss_fn, optimizer, device):
    model.train()
    total_loss = 0

    for inputs, targets in tqdm(data_loader, desc="训练"):
        inputs = inputs.to(device)
        targets = targets.to(device).float()  # BCE需要float

        outputs = model(inputs)
        # outputs 形状: (batch_size,)  targets 形状: (batch_size,)

        loss = loss_fn(outputs, targets)

        loss.backward()
        optimizer.step()
        optimizer.zero_grad()

        total_loss += loss.item()

    return total_loss / len(data_loader)


def train():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    tokenizer = JiebaTokenizer.from_vocab(f"{config.models_dir}/vocab.txt")
    train_loader = get_data_loader(f"{config.processed_dir}/train.jsonl",
                                   config.batch_size)

    model = ReviewLSTMModel(
        vocab_size=tokenizer.vocab_size,
        padding_index=tokenizer.pad_token_id
    ).to(device)

    # 二分类用BCEWithLogitsLoss（自带sigmoid）
    loss_fn = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=config.learning_rate)

    writer = SummaryWriter(f"{config.logs_dir}/{time.strftime('%y%m%d_%H%M%S')}")
    best_loss = float('inf')

    for epoch in range(1, config.epochs + 1):
        print(f"Epoch {epoch}/{config.epochs}")
        epoch_loss = train_one_epoch(model, train_loader, loss_fn, optimizer, device)
        print(f"Loss: {epoch_loss:.4f}")

        writer.add_scalar("loss", epoch_loss, epoch)

        if epoch_loss < best_loss:
            best_loss = epoch_loss
            torch.save(model.state_dict(), f"{config.models_dir}/best.pt")
            print("模型保存成功")

    writer.close()
```

#### 4.2.4 预测与评估（P080-P081）

```python
def predict_batch(model, input_tensor, device):
    """批量预测"""
    model.eval()
    with torch.no_grad():
        outputs = model(input_tensor.to(device))
        # 手动加sigmoid（训练时BCEWithLogitsLoss自带，推理时要手加）
        probs = torch.sigmoid(outputs)
        return probs.tolist()


def evaluate(model, test_loader, device):
    """计算准确率"""
    model.eval()
    correct_count = 0
    total_count = 0

    with torch.no_grad():
        for inputs, targets in test_loader:
            inputs = inputs.to(device)
            targets = targets.to(device).tolist()

            results = predict_batch(model, inputs, device)

            for result, target in zip(results, targets):
                predicted = 1 if result > 0.5 else 0
                if predicted == target:
                    correct_count += 1
                total_count += 1

    accuracy = correct_count / total_count
    print(f"Accuracy: {accuracy:.4f}")
    return accuracy
```

**评估结果**：LSTM在该数据集上准确率约91-92%，BERT可达95%以上。

---

## 五、Seq2Seq翻译案例（P87-P107）⭐

### 5.1 模型结构
- **编码器**：输入序列 → 上下文向量 c
- **解码器**：上下文向量 c → 自回归生成输出序列
- **训练**：Teacher Forcing（用真实标签作为下一步输入）
- **推理**：自回归生成（每步输出作为下一步输入）

### 5.2 数据预处理（P094-P098）

```python
# 特殊token
SOS_TOKEN = "<SOS>"  # 序列开始
EOS_TOKEN = "<EOS>"  # 序列结束
PAD_TOKEN = "<PAD>"  # 填充

class TranslationTokenizer:
    def __init__(self, vocab):
        self.word_to_index = {w: i for i, w in enumerate(vocab)}
        self.index_to_word = {i: w for i, w in enumerate(vocab)}

    def encode(self, text):
        tokens = list(jieba.cut(text))
        ids = [self.word_to_index[t] for t in tokens if t in self.word_to_index]
        return ids

    def decode(self, ids):
        return "".join([self.index_to_word[i] for i in ids
                       if i not in [self.sos_id, self.eos_id, self.pad_id]])
```

### 5.3 模型定义（P099-P101）

```python
import torch
import torch.nn as nn
import config


class TranslationEncoder(nn.Module):
    """编码器：Embedding + GRU，返回最后一个时间步的隐藏状态"""
    def __init__(self, vocab_size, padding_index):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, config.d_model, padding_index=padding_index)
        self.gru = nn.GRU(config.d_model, config.hidden_size, batch_first=True)

    def forward(self, x):
        # x: (batch_size, seq_len)
        embed = self.embedding(x)  # (batch_size, seq_len, d_model)
        output, hidden = self.gru(embed)

        # 取每个序列真实最后一个token的隐藏状态
        padding_idx = self.embedding.padding_index
        mask = (x != padding_idx)
        lengths = mask.sum(dim=1)
        batch_indexes = torch.arange(x.shape[0])
        hidden_state = output[batch_indexes, lengths - 1, :]
        # hidden_state: (batch_size, hidden_size)
        return hidden_state


class TranslationDecoder(nn.Module):
    """解码器：每次处理一个时间步（token）"""
    def __init__(self, vocab_size, padding_index):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, config.d_model, padding_index=padding_index)
        self.gru = nn.GRU(config.d_model, config.hidden_size, batch_first=True)
        self.linear = nn.Linear(config.hidden_size, vocab_size)

    def forward(self, x, hidden):
        """
        x: (batch_size, 1) — 当前时间步的token
        hidden: (1, batch_size, hidden_size) — 上一步的隐藏状态
        """
        embed = self.embedding(x)       # (batch_size, 1, d_model)
        output, hidden_n = self.gru(embed, hidden)
        prediction = self.linear(output) # (batch_size, 1, vocab_size)
        return prediction, hidden_n


class TranslationModel(nn.Module):
    """完整Seq2Seq模型"""
    def __init__(self, zh_vocab_size, en_vocab_size, zh_pad_idx, en_pad_idx):
        super().__init__()
        self.encoder = TranslationEncoder(zh_vocab_size, zh_pad_idx)
        self.decoder = TranslationDecoder(en_vocab_size, en_pad_idx)
```

### 5.4 训练逻辑（P102-P103）

```python
def train_one_epoch(model, data_loader, loss_fn, optimizer, device):
    model.train()
    total_loss = 0

    for inputs, targets in data_loader:
        inputs = inputs.to(device)   # (batch_size, src_seq_len) 中文
        targets = targets.to(device) # (batch_size, tgt_seq_len) 英文（含SOS/EOS/PAD）

        # ---- 编码阶段 ----
        context_vector = model.encoder(inputs)
        # context_vector: (batch_size, hidden_size)

        # ---- 解码阶段（Teacher Forcing）----
        # decoder输入 = targets[:, :-1]（去掉最后一个EOS）
        # decoder目标 = targets[:, 1:]  （去掉第一个SOS）
        decoder_inputs = targets[:, :-1]   # (batch_size, seq_len-1)
        decoder_targets = targets[:, 1:]   # (batch_size, seq_len-1)

        # 初始隐藏状态需reshape: (batch_size, hidden) → (1, batch_size, hidden)
        hidden = context_vector.unsqueeze(0)

        # 逐时间步解码
        all_outputs = []
        seq_len = decoder_inputs.shape[1]

        for i in range(seq_len):
            # 取第i个token: (batch_size, 1)
            step_input = decoder_inputs[:, i:i+1]

            prediction, hidden = model.decoder(step_input, hidden)
            all_outputs.append(prediction)

        # 拼接: (batch_size, seq_len, vocab_size)
        all_outputs = torch.cat(all_outputs, dim=1)

        # 计算损失（需要reshape）
        loss = loss_fn(
            all_outputs.reshape(-1, all_outputs.shape[-1]),
            decoder_targets.reshape(-1)
        )

        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
        total_loss += loss.item()

    return total_loss / len(data_loader)
```

### 5.5 推理（自回归生成）（P104）

```python
def predict_batch(model, input_tensor, en_tokenizer, device, max_len=128):
    """自回归生成翻译结果"""
    model.eval()
    batch_size = input_tensor.shape[0]

    with torch.no_grad():
        # 编码
        context_vector = model.encoder(input_tensor.to(device))
        hidden = context_vector.unsqueeze(0)

        # 初始输入：一批SOS token
        decoder_input = torch.full(
            (batch_size, 1), en_tokenizer.sos_token_id,
            dtype=torch.long, device=device
        )

        generated = []
        is_finished = torch.zeros(batch_size, dtype=torch.bool, device=device)

        for _ in range(max_len):
            prediction, hidden = model.decoder(decoder_input, hidden)
            # prediction: (batch_size, 1, vocab_size)

            next_token = prediction.argmax(dim=-1)  # (batch_size, 1)
            generated.append(next_token)

            # 更新输入
            decoder_input = next_token

            # 判断是否结束（所有样本都生成了EOS）
            is_finished |= (next_token.squeeze(-1) == en_tokenizer.eos_token_id)
            if is_finished.all():
                break

        # 整理结果
        generated_tensor = torch.cat(generated, dim=1)  # (batch_size, max_len)
        generated_list = generated_tensor.tolist()

        # 去掉EOS之后的内容
        for i, sentence in enumerate(generated_list):
            if en_tokenizer.eos_token_id in sentence:
                pos = sentence.index(en_tokenizer.eos_token_id)
                generated_list[i] = sentence[:pos]

        return generated_list
```

### 5.6 BLEU评估（P105-P106）

```python
from nltk.translate.bleu_score import corpus_bleu

# BLEU评分需要：
# predictions: 二维列表 [[token_id, ...], ...]
# references:  三维列表 [[[ref_token_ids]], ...]  （每个预测对应多个参考译文）

references = []
predictions = []

for inputs, targets in test_loader:
    batch_result = predict_batch(model, inputs, en_tokenizer, device)

    predictions.extend(batch_result)

    # targets需要去掉SOS/EOS/PAD
    for target in targets.tolist():
        # 去SOS(第一个), 去EOS及之后
        clean = target[1:]  # 去SOS
        if en_tokenizer.eos_token_id in clean:
            clean = clean[:clean.index(en_tokenizer.eos_token_id)]
        references.append([clean])  # 包一层列表（支持多参考译文）

# 计算BLEU
score = corpus_bleu(references, predictions)
print(f"BLEU Score: {score:.4f}")
```

**注意**：
- 基础Seq2Seq（无Attention）BLEU分数约0.05-0.1
- 加Attention后约0.2+
- 使用Transformer后约0.3+
- 商用翻译模型BLEU约0.3-0.5

---

## 六、Attention机制（P108-P115）

### 6.1 核心思想
- Seq2Seq的问题：所有信息压缩成固定长度的上下文向量c
- Attention：每步动态选择相关信息

### 6.2 注意力评分函数
```
点积注意力：score = Q · K^T
加性注意力：score = v^T · tanh(W1·Q + W2·K)
缩放点积注意力：score = (Q · K^T) / sqrt(d_k)
```

---

## 七、Transformer（P116-P149）⭐⭐

### 7.1 核心思想（P117）
- "Attention is All You Need"
- Attention完全取代RNN
- 优势：并行计算 + 长距离依赖

### 7.2 位置编码实现（P143-P145）

#### 7.2.1 简易实现

```python
import math
import torch
import torch.nn as nn


class PositionalEncoding(nn.Module):
    """
    位置编码：用正弦/余弦函数为每个位置生成固定编码
    PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
    PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
    """
    def __init__(self, d_model, max_len=100):
        super().__init__()

        # 预计算位置编码矩阵 (max_len, d_model)
        pe = torch.zeros(max_len, d_model)

        position = torch.arange(0, max_len).unsqueeze(1).float()  # (max_len, 1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )  # 10000^(2i/d_model) 的倒数

        pe[:, 0::2] = torch.sin(position * div_term)  # 偶数维用sin
        pe[:, 1::2] = torch.cos(position * div_term)  # 奇数维用cos

        pe = pe.unsqueeze(0)  # (1, max_len, d_model)
        self.register_buffer('pe', pe)  # 不参与梯度更新

    def forward(self, x):
        """
        x: (batch_size, seq_len, d_model) — embedding之后的结果
        返回: 同形状，加上了位置编码
        """
        seq_len = x.shape[1]
        # 取出前seq_len个位置编码，通过广播加到每个batch
        return x + self.pe[:, :seq_len, :]
```

**关键点**：
- 位置编码无需训练（`register_buffer` 不参与梯度）
- 广播机制：`(1, seq_len, d_model)` 自动广播到 `(batch_size, seq_len, d_model)`
- `d_model` 必须与 embedding_dim 一致

#### 7.2.2 哈佛版源码（P145）

```python
class PositionalEncoding_Harvard(nn.Module):
    """哈佛版实现，使用exp+log优化计算性能"""
    def __init__(self, d_model, dropout=0.1, max_len=5000):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)

        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len).unsqueeze(1)  # (max_len, 1)

        # 用 exp(log(...)) 代替直接幂运算，性能更好
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )

        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)  # (1, max_len, d_model)

        self.register_buffer('pe', pe)

    def forward(self, x):
        x = x + self.pe[:, :x.size(1)]
        return self.dropout(x)
```

### 7.3 完整Transformer翻译模型（P146）

```python
import torch
import torch.nn as nn
import config
from position_encoding import PositionalEncoding


class TransformerTranslationModel(nn.Module):
    """
    基于nn.Transformer的翻译模型
    组件: Embedding + PositionEncoding + Transformer + Linear
    """
    def __init__(self, zh_vocab_size, en_vocab_size, zh_pad_idx, en_pad_idx):
        super().__init__()

        # 中文/英文各自的Embedding（词表不同，无法共用）
        self.zh_embedding = nn.Embedding(zh_vocab_size, config.d_model, padding_index=zh_pad_idx)
        self.en_embedding = nn.Embedding(en_vocab_size, config.d_model, padding_index=en_pad_idx)

        # 位置编码（中英文共用一份）
        self.position_encoding = PositionalEncoding(config.d_model, max_len=100)

        # Transformer核心（PyTorch内置）
        self.transformer = nn.Transformer(
            d_model=config.d_model,          # 模型维度
            nhead=config.num_heads,          # 注意力头数（512/8=64每头）
            num_encoder_layers=config.num_encoder_layers,  # 编码器层数
            num_decoder_layers=config.num_decoder_layers,  # 解码器层数
            dim_feedforward=config.dim_feedforward,         # FFN隐藏维度
            dropout=config.dropout
        )

        # 输出线性层
        self.linear = nn.Linear(config.d_model, en_vocab_size)

    def forward(self, src, tgt, src_mask=None, tgt_mask=None):
        """
        src: (batch_size, src_seq_len) 中文token ID
        tgt: (batch_size, tgt_seq_len) 英文token ID
        """
        # 编码器输入
        src_embed = self.position_encoding(
            self.zh_embedding(src) * math.sqrt(config.d_model)
        )

        # 解码器输入
        tgt_embed = self.position_encoding(
            self.en_embedding(tgt) * math.sqrt(config.d_model)
        )

        # Transformer前向传播
        output = self.transformer(src_embed, tgt_embed, src_mask, tgt_mask)
        # output: (batch_size, tgt_seq_len, d_model)

        # 映射到词表
        return self.linear(output)  # (batch_size, tgt_seq_len, vocab_size)
```

**配置参数**：
```python
# config.py 中的模型参数
d_model = 128           # 模型维度（原始论文512，小语料用128）
num_heads = 4           # 注意力头数（512/8=64，128/4=32每头）
num_encoder_layers = 2  # 编码器层数（原始6层）
num_decoder_layers = 2  # 解码器层数
dim_feedforward = 512   # FFN隐藏维度
dropout = 0.1
```

### 7.4 哈佛版多头注意力源码解读（P149）

```python
class MultiHeadAttention(nn.Module):
    """
    哈佛版多头注意力实现（核心源码）
    注意：q/k/v参数是原始输入，不是QKV向量
    内部通过Linear层计算真正的QKV
    """
    def __init__(self, h, d_model, dropout=0.1):
        super().__init__()
        assert d_model % h == 0  # d_model必须能被头数整除
        self.d_k = d_model // h  # 每头维度 = 512/8 = 64
        self.h = h

        # 4个线性层：3个算QKV，1个算输出
        self.linears = nn.ModuleList([
            nn.Linear(d_model, d_model) for _ in range(4)
        ])
        self.attn = None
        self.dropout = nn.Dropout(p=dropout)

    def forward(self, query, key, value, mask=None):
        """
        query/key/value: 原始输入 (batch, seq_len, d_model)
        注意：编码器自注意力三者相同，交叉注意力query来自解码器，key/value来自编码器
        """
        if mask is not None:
            mask = mask.unsqueeze(1)  # 扩展head维度

        # 1. 线性映射得到QKV（多头一起算！）
        #    QKV各自通过一个Linear，输出d_model = h * d_k
        Q, K, V = [
            lin(x).view(batch_size, -1, self.h, self.d_k).transpose(1, 2)
            for lin, x in zip(self.linears[:3], (query, key, value))
        ]
        # Q/K/V 形状: (batch_size, num_heads, seq_len, d_k)

        # 2. 计算注意力得分
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(self.d_k)
        # scores: (batch_size, num_heads, seq_len, seq_len)

        if mask is not None:
            scores = scores.masked_fill(mask == 0, -1e9)

        p_attn = torch.softmax(scores, dim=-1)

        # 3. 加权求和
        x = torch.matmul(p_attn, V)
        # x: (batch_size, num_heads, seq_len, d_k)

        # 4. 多头拼接（通过view实现，不是真的concat）
        x = x.transpose(1, 2).contiguous().view(batch_size, -1, self.h * self.d_k)
        # x: (batch_size, seq_len, d_model)

        # 5. 最终线性映射
        return self.linears[-1](x)
```

**多头注意力一起算的原理**：
- 每个Linear的输入输出都是 `d_model`
- 但输出实际含义是 `h × d_k`
- 通过 `view` 变形拆分成多头
- 效率比一头一头算高很多

**register_buffer的作用**：
- 将张量注册为buffer，不参与梯度更新
- 会随模型一起保存/加载
- 适合存储位置编码这种固定不变的值

---

## 八、预训练模型（P150-P161）

### 8.1 三大范式
| 类型 | 代表 | 架构 | 预训练任务 |
|------|------|------|------------|
| 自编码 | BERT | Encoder | 完形填空(MLM) + NSP |
| 自回归 | GPT | Decoder | 预测下一个token |
| Seq2Seq | T5 | Encoder-Decoder | 文本到文本 |

### 8.2 BERT微调任务
1. **句子对分类**：`[CLS] + S1 + [SEP] + S2 + [SEP]` → 取CLS输出 → 线性层
2. **单句分类**：`[CLS] + S + [SEP]` → 取CLS输出 → 线性层
3. **问答**：`[CLS] + Q + [SEP] + C + [SEP]` → 每个token预测起始/结束位置
4. **序列标注**：`[CLS] + S + [SEP]` → 每个token独立分类

---

## 九、HuggingFace生态（P162-P187）⭐

### 9.1 AutoModel加载模型（P163-P165）

```python
from transformers import AutoModel, AutoModelForSequenceClassification

# 基础模型（只有编码器，没有任务头）
model = AutoModel.from_pretrained("bert-base-chinese")

# 带任务头的模型（自带分类头）
model = AutoModelForSequenceClassification.from_pretrained(
    "bert-base-chinese", num_labels=2
)

# 本地加载
model = AutoModel.from_pretrained("./pretrained/bert-base-chinese")
```

**加载流程**：
1. 下载模型资源（config.json + model.safetensors）
2. 根据 config.json 创建模型结构
3. 加载权重参数

**镜像配置**（国内加速）：
```bash
export HF_ENDPOINT=https://hf-mirror.com
```

### 9.2 Tokenizer使用（P166-P167）

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
# '我 在 学习 NLP'

# 批量编码（自动padding+截断）
batch = tokenizer(
    ["我喜欢你", "今天天气真好"],
    padding=True,         # 自动填充到最长
    truncation=True,      # 超长截断
    max_length=128,
    return_tensors="pt"
)

# 特殊token
# [CLS] ID=101  分类token
# [SEP] ID=102  分隔token
# [PAD] ID=0    填充token
# [UNK] ID=100  未知token
```

### 9.3 Datasets使用（P169-P178）

```python
from datasets import load_dataset

# 加载数据集
dataset = load_dataset("csv", data_files="data.csv")
dataset = load_dataset("glue", "sst2")  # 在线数据集

# 数据预处理
dataset = dataset.filter(lambda x: x["label"] == 1)
dataset = dataset.train_test_split(test_size=0.2)

def tokenize(examples):
    return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=128)

dataset = dataset.map(tokenize, batched=True)

# 保存
dataset.save_to_disk("./processed_dataset")

# 集成DataLoader
from torch.utils.data import DataLoader
dataloader = DataLoader(dataset["train"], batch_size=32, shuffle=True)
```

### 9.4 完整微调示例（P179-P187）

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from torch.utils.data import DataLoader
from datasets import load_dataset
import torch

# 1. 加载模型和tokenizer
model_name = "bert-base-chinese"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)

# 2. 加载和预处理数据
dataset = load_dataset("csv", data_files="train.csv")
dataset = dataset.train_test_split(test_size=0.2)

def preprocess(examples):
    return tokenizer(examples["text"], padding="max_length",
                     truncation=True, max_length=128)

dataset = dataset.map(preprocess, batched=True)
dataset.set_format("torch", columns=["input_ids", "attention_mask", "label"])

# 3. 创建DataLoader
train_loader = DataLoader(dataset["train"], batch_size=16, shuffle=True)
test_loader = DataLoader(dataset["test"], batch_size=16)

# 4. 训练
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=2e-5)

for epoch in range(3):
    model.train()
    for batch in train_loader:
        batch = {k: v.to(device) for k, v in batch.items()}
        outputs = model(**batch)
        loss = outputs.loss
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()

# 5. 推理
model.eval()
with torch.no_grad():
    inputs = tokenizer("这部电影真好看", return_tensors="pt").to(device)
    outputs = model(**inputs)
    prediction = torch.argmax(outputs.logits, dim=-1)
    print("正面" if prediction.item() == 1 else "负面")
```

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

**关键API速查**：
| 模块 | API | 用途 |
|------|-----|------|
| RNN | `nn.RNN(input, hidden, batch_first)` | 基础循环 |
| LSTM | `nn.LSTM(...)` | 门控循环 |
| GRU | `nn.GRU(...)` | 简化门控 |
| Transformer | `nn.Transformer(d_model, nhead)` | 注意力模型 |
| Embedding | `nn.Embedding(vocab, dim, padding_index)` | 词→向量 |
| Linear | `nn.Linear(in, out)` | 线性变换 |
| CrossEntropy | `nn.CrossEntropyLoss()` | 多分类损失 |
| BCE | `nn.BCEWithLogitsLoss()` | 二分类损失 |
| AutoModel | `AutoModel.from_pretrained(name)` | 加载预训练 |
| AutoTokenizer | `AutoTokenizer.from_pretrained(name)` | 分词器 |
