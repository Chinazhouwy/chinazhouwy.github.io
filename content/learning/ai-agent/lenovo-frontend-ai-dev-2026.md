---
title: "联想 2026 · 前端开发（AI应用方向）社招面试真题"
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
summary: "联想 2026 · 前端开发（AI应用方向）社招面试真题"
tags:
---

# 联想 2026 · 前端开发（AI应用方向）社招面试真题

> 来源：小红书面经分享
> 标签：`#联想` `#前端` `#AI应用` `#AIPC` `#RAG` `#端云协同`
> 职级：P6/P7 | 业务：天禧AI、AIPC端侧推理、擎天AI办公、多模态智能体

---

## 一、一面（技术基础 · 5题）

### 1.1 React 18 并发渲染与自动批处理

**题目**：阐述 React 18 并发渲染与自动批处理原理，结合联想天禧AI助手对话面板、AIPC办公文档AI摘要流式渲染场景，说明如何优化渲染性能与交互流畅度。

**答案**：

**核心原理**：

| 机制 | 说明 |
|------|------|
| **并发渲染** | 渲染任务拆分为可中断、可恢复的工作单元，基于优先级调度（用户交互 > AI流式渲染 > 数据加载），高优先级可抢占主线程 |
| **自动批处理** | 合并 Promise、setTimeout、原生事件、AI回调中的多次状态更新，仅触发一次重渲染 |

**联想AI场景优化**：

**天禧AI对话面板**：
```javascript
import { useState, startTransition, createRoot } from 'react';

const root = createRoot(document.getElementById('tianxi-chat'));

const TianxiChat = () => {
  const [messages, setMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAIResponse = (newMessage) => {
    // AI逐字回复设为低优先级过渡更新，不阻塞用户输入
    startTransition(() => {
      setMessages(prev => [...prev, newMessage]);
      setIsGenerating(false);
    });
    // 自动批处理合并"消息添加+加载状态变更+滚动到底部"3次更新
  };
};
```

**AIPC文档AI摘要流式渲染**：
- `startTransition` 标记渲染任务，用户滚动/切换页面可立即响应
- 自动批处理合并摘要分段更新、高亮标记、目录同步状态
- 并发渲染拆分长摘要为小片段，利用AIPC多核CPU并行处理，渲染速度提升40%+

### 1.2 端侧/云端大模型流式输出差异

**题目**：前端接入端侧/云端大模型的流式输出有何核心差异？联想天禧AI多模态对话、文档AI生成场景如何选型，实现低延迟、消息有序、可取消、断点续传？

**答案**：

| 对比维度 | 端侧推理（AIPC NPU/GPU） | 云端推理（擎天AI） |
|----------|--------------------------|---------------------|
| **延迟** | 首token延迟高（模型加载），后续低 | 网络延迟波动大 |
| **带宽** | 无网络带宽消耗 | 流式输出占用带宽 |
| **可用性** | 离线可用 | 依赖网络 |
| **模型能力** | 轻量模型（MiniBERT等） | 全量大模型 |
| **流式协议** | 本地WebSocket/共享内存 | SSE / HTTP Chunked |

**选型策略**：
```
强网 → 优先云端（模型能力强）
弱网 → 自动降级端侧
离线 → 纯端侧推理
敏感数据 → 端侧处理（不上云）
```

**实现要点**：
- **低延迟**：端侧预加载模型，云端用 SSE 长连接
- **消息有序**：服务端给每条消息编号，前端按序号排序渲染
- **可取消**：AbortController 中断流式连接
- **断点续传**：记录已接收的 token 数，重连后从断点继续

### 1.3 AI接口请求封装（手写）

**题目**：手写实现联想AIPC前端标准的AI接口请求封装，需支持超时控制、重复请求拦截、失败指数退避重试、Abort取消、端云切换，适配弱网/离线办公场景。

**答案**：

```javascript
import { getEnterpriseToken, getApcDeviceId } from '@/utils/device';

// 全局请求锁：防止重复请求
const requestLockMap = new Map();

// 指数退避重试延迟 (ms)
const RETRY_DELAYS = [1000, 2000, 4000];

export async function requestLenovoAI(options) {
  const {
    method = 'POST',
    data = {},
    timeout = 30000,
    requestId,
    retryTimes = 2,
    isEdgePriority = true,
    edgeModelConfig,
  } = options;

  // 1. 重复请求拦截
  if (requestLockMap.has(requestId)) {
    const existingController = requestLockMap.get(requestId);
    existingController.abort('Duplicate request cancelled');
  }

  const controller = new AbortController();
  requestLockMap.set(requestId, controller);

  // 2. 端云切换逻辑
  let baseUrl;
  if (isEdgePriority && navigator.onLine === false) {
    // 离线模式 → 端侧
    baseUrl = 'http://localhost:8080/api/edge';
  } else if (isEdgePriority) {
    // 尝试端侧，失败降级云端
    try {
      return await doRequest({
        ...options,
        baseUrl: 'http://localhost:8080/api/edge',
        signal: controller.signal,
        timeout,
      });
    } catch (e) {
      // 端侧失败，降级云端
      baseUrl = 'https://ai.lenovo.com/api/cloud';
    }
  } else {
    baseUrl = 'https://ai.lenovo.com/api/cloud';
  }

  // 3. 指数退避重试
  for (let attempt = 0; attempt <= retryTimes; attempt++) {
    try {
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${baseUrl}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getEnterpriseToken()}`,
          'X-Device-Id': getApcDeviceId(),
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      requestLockMap.delete(requestId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();

    } catch (error) {
      if (error.name === 'AbortError') {
        requestLockMap.delete(requestId);
        throw error;
      }

      // 指数退避
      if (attempt < retryTimes) {
        await new Promise(resolve =>
          setTimeout(resolve, RETRY_DELAYS[attempt])
        );
      } else {
        requestLockMap.delete(requestId);
        throw error;
      }
    }
  }
}

// 取消请求
export function cancelRequest(requestId) {
  const controller = requestLockMap.get(requestId);
  if (controller) {
    controller.abort('User cancelled');
    requestLockMap.delete(requestId);
  }
}
```

### 1.4 长列表虚拟滚动

**题目**：联想企业控制台、AIPC文件管理器采用长列表虚拟滚动，说明其核心原理，以及如何解决动态高度、WebGPU渲染冲突、大文件列表卡顿、虚拟滚动与AI预览联动问题？

**答案**：

**核心原理**：
```
可视区域 = container高度
只渲染可视区域内的 item + 缓冲区（上下各2-3个）
用 padding/transform 撑开总高度
滚动时动态计算可见 range，更新渲染列表
```

**关键公式**：
```javascript
const startIndex = Math.floor(scrollTop / itemHeight) - buffer;
const endIndex = Math.min(
  startIndex + Math.ceil(containerHeight / itemHeight) + buffer * 2,
  totalItems
);
```

**问题与解决方案**：

| 问题 | 解决方案 |
|------|----------|
| **动态高度** | 先渲染占位，测量实际高度后缓存到 Map，后续用缓存高度计算 |
| **WebGPU冲突** | WebGPU 渲染在独立 Canvas，虚拟滚动只管理 DOM 节点，两者不冲突 |
| **大文件列表卡顿** | 结合 Web Worker 计算可见范围，主线程只负责渲染 |
| **AI预览联动** | 虚拟滚动 item 进入可视区时触发 AI 预览请求，离开时取消 |

### 1.5 浏览器存储方案选型

**题目**：localStorage / sessionStorage / IndexedDB / OPFS 的区别？联想AI场景下，天禧对话历史、AIPC端侧模型缓存、办公文档AI摘要、离线任务队列分别如何存储？

**答案**：

| 存储方案 | 容量 | 异步 | 结构化 | 适用场景 |
|----------|------|------|--------|----------|
| localStorage | ~5MB | 同步 | 字符串 | 简单配置 |
| sessionStorage | ~5MB | 同步 | 字符串 | 会话级数据 |
| IndexedDB | 大容量 | 异步 | 对象/索引 | 对话历史、向量缓存 |
| OPFS | 大容量 | 异步 | 文件流 | 大文档、模型文件 |

**联想AI场景存储方案**：

| 数据类型 | 存储方案 | 原因 |
|----------|----------|------|
| 天禧对话历史 | IndexedDB（按 sessionId 分表） | 结构化查询、历史回溯 |
| AIPC端侧模型缓存 | OPFS | 大文件、流式读写 |
| 办公文档AI摘要 | IndexedDB（元数据）+ OPFS（原文） | 元数据需查询，原文需流式 |
| 离线任务队列 | IndexedDB | 需事务保证、支持索引 |

---

## 二、二面（深入原理 + 项目实战 · 5题）

### 2.1 RAG前端链路与企业文档助手

**题目**：基于天禧大模型+RAG+向量检索构建企业文档助手与智能客服，说明前端RAG链路、端侧向量计算、文档Embedding缓存、上下文窗口压缩、本地知识库检索的实现方案。

**答案**：

**前端RAG完整链路（端云协同）**：

```
用户提问/文档上传
  ↓
文档预处理（端侧）
  ├─ 解析为文本（Word/PDF/PPT）
  ├─ 拆分 chunk（512 token/块）
  └─ 端侧 MiniBERT 生成向量
  ↓
向量存储
  ├─ 端侧：IndexedDB（私有文档，不上云）
  └─ 云端：Milvus（公共知识库）
  ↓
相似度检索（本地优先）
  ├─ 本地：IndexedDB 余弦相似度，Top5
  └─ 云端：本地无结果时调用擎天向量接口，Top10
  ↓
上下文压缩（端侧）
  ├─ 合并去重、过滤低相关内容
  ├─ 压缩至 4k token
  └─ 长文档用端侧小模型摘要
  ↓
Prompt构建 + 天禧大模型流式生成
  ↓
结果渲染 + LRU缓存
  ├─ 本地缓存：1小时
  └─ 云端缓存：6小时
```

**联想优化方案**：
- **私有文档不上云**：全程端侧处理，符合数据合规
- **端侧模型轻量化**：MiniBERT（12M参数），NPU推理 <50ms/条
- **知识库增量更新**：仅新增 chunk 向量化，无需全量重建

### 2.2 React Hooks 在AI场景的逻辑复用

**题目**：React Hooks在联想AI场景（天禧对话、AIPC文档处理、擎天AI办公、智能体编排）中如何实现逻辑复用、状态隔离、端云状态同步？相比Vue3 Composables有哪些适配端侧AI的优势？

**答案**：

**自定义 Hooks 设计**：

```javascript
// useAIChat - 天禧对话逻辑复用
function useAIChat(sessionId) {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // 状态隔离：每个 sessionId 独立实例
  // 逻辑复用：流式处理、消息排序、取消机制全部封装
  const { sendMessage, cancel, retry } = useAIStream({
    sessionId,
    onToken: (token) => setMessages(prev => appendToken(prev, token)),
  });
  
  return { messages, isStreaming, sendMessage, cancel, retry };
}

// useAIDoc - AIPC文档AI处理
function useAIDoc(docId) {
  const [doc, setDoc] = useState(null);
  const [summary, setSummary] = useState(null);
  const [progress, setProgress] = useState(0);
  
  // 端云状态同步：IndexedDB ↔ 云端
  useSyncState({
    key: `doc:${docId}`,
    local: () => getFromIndexedDB(docId),
    remote: () => fetchDocFromCloud(docId),
    onSync: (data) => setDoc(data),
  });
  
  return { doc, summary, progress, generateSummary };
}

// useEdgeCloudSync - 端云状态同步
function useEdgeCloudSync({ key, local, remote, onSync }) {
  useEffect(() => {
    // 优先读本地，再同步云端
    local().then(data => {
      if (data) onSync(data);
      else remote().then(data => {
        if (data) { local_save(key, data); onSync(data); }
      });
    });
  }, [key]);
}
```

**React Hooks vs Vue3 Composables**：

| 对比项 | React Hooks | Vue3 Composables |
|--------|-------------|------------------|
| 状态管理 | useState/useReducer，显式 | ref/reactive，自动追踪 |
| 逻辑复用 | 自定义 Hook，组合灵活 | Composable 函数，类似 |
| 端侧AI适配 | startTransition 天然适合流式 | watchEffect 需手动控制频率 |
| 并发渲染 | startTransition 原生支持 | 需手动调度 |
| 生态 | React Native 跨端，Taro小程序 | uni-app 跨端 |

**React Hooks 在端侧AI的优势**：
- `startTransition` 天然适配流式渲染的低优先级更新
- React 18 Concurrent Mode 可中断渲染，适合AIPC多任务调度
- React Native + Expo 可快速开发AIPC移动端

### 2.3 AI应用安全性

**题目**：前端接入端侧/云端大模型的安全风险（Prompt注入、企业文档泄露、AIPC模型越权、接口滥用、隐私数据窃取）有哪些？联想端侧沙箱隔离+云端擎天防火墙+企业权限校验+文档脱敏四维防护体系如何落地？

**答案**：

**安全风险矩阵**：

| 风险类型 | 说明 | 影响 |
|----------|------|------|
| **Prompt注入** | 恶意文档嵌入隐藏Prompt指令 | 模型执行非预期操作 |
| **企业文档泄露** | 敏感文档上传云端被截获 | 数据泄露 |
| **AIPC模型越权** | 未授权访问端侧模型API | 模型被滥用 |
| **接口滥用** | 恶意调用AI接口消耗资源 | 服务不可用 |
| **隐私数据窃取** | XSS/CSRF窃取用户数据 | 隐私泄露 |

**四维防护体系落地**：

```javascript
// 1. 端侧沙箱隔离
class AISandbox {
  constructor() {
    // Web Worker 隔离AI推理
    this.worker = new Worker('ai-inference.js');
    // CSP 限制外部请求
    this.csp = "default-src 'self'; connect-src 'self' localhost:8080";
  }
  
  async runInference(prompt) {
    // 输入过滤：检测恶意Prompt
    const sanitized = this.sanitizePrompt(prompt);
    return this.worker.postMessage({ type: 'infer', data: sanitized });
  }
  
  sanitizePrompt(input) {
    // 移除隐藏字符、检测注入模式
    return input.replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/ignore previous instructions/gi, '[FILTERED]');
  }
}

// 2. 云端擎天防火墙
// 后端接口层：限流 + 鉴权 + 内容过滤
const firewall = {
  rateLimit: { max: 100, window: '1m' },
  auth: ['userToken', 'enterpriseId', 'deviceFingerprint', 'npusign'],
  contentFilter: {
    input: /恶意prompt模式/,
    output: /敏感信息模式/,
  }
};

// 3. 企业权限校验
function checkEnterprisePermission(user, resource, action) {
  // RBAC + ABAC 双重校验
  const role = getUserRole(user.enterpriseId, user.userId);
  const policy = getPolicy(resource, action);
  return role.permissions.includes(policy);
}

// 4. 文档脱敏
function sanitizeDocument(doc) {
  // 识别并脱敏：手机号、邮箱、身份证号、银行卡号
  const patterns = {
    phone: /1[3-9]\d{9}/g,
    email: /\w+@\w+\.\w+/g,
    idCard: /\d{17}[\dXx]/g,
  };
  return doc.replace(patterns.phone, '***')
            .replace(patterns.email, '***@***.***');
}
```

### 2.4 端侧AI推理（WebGPU + OpenVINO）

**题目**：联想AIPC基于WebGPU+OpenVINO+联想推理加速引擎实现端侧AI推理，说明前端如何对接端侧模型、推理任务调度、GPU显存管理、模型轻量化适配、离线推理降级方案？

**答案**：

**端侧推理架构**：

```
前端应用层
  ↓
联想推理加速引擎（封装层）
  ↓
TensorFlow.js / WebGPU / OpenVINO（推理引擎）
  ↓
NPU / GPU / CPU（异构算力）
```

**关键实现**：

```javascript
// 异构算力调度
class AIPUScheduler {
  constructor() {
    this.capabilities = {
      NPU: this.checkNPU(),
      GPU: this.checkWebGPU(),
      CPU: true,
    };
  }
  
  async selectBackend(modelSize) {
    if (modelSize < 50 && this.capabilities.NPU) return 'NPU';
    if (this.capabilities.GPU) return 'WebGPU';
    return 'CPU';
  }
  
  async checkWebGPU() {
    return 'gpu' in navigator && await navigator.gpu.requestAdapter() !== null;
  }
}

// GPU显存管理
class GPUMemoryManager {
  constructor() {
    this.allocated = 0;
    this.maxMemory = 2048; // MB
    this.models = new Map();
  }
  
  async loadModel(modelId, modelSize) {
    if (this.allocated + modelSize > this.maxMemory) {
      await this.evictLeastUsed();
    }
    const buffer = await navigator.gpu.device.createBuffer({
      size: modelSize * 1024 * 1024,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    this.models.set(modelId, { buffer, size: modelSize, lastUsed: Date.now() });
    this.allocated += modelSize;
  }
  
  async evictLeastUsed() {
    let minTime = Infinity, minId = null;
    for (const [id, info] of this.models) {
      if (info.lastUsed < minTime) {
        minTime = info.lastUsed;
        minId = id;
      }
    }
    if (minId) {
      this.models.get(minId).buffer.destroy();
      this.allocated -= this.models.get(minId).size;
      this.models.delete(minId);
    }
  }
}

// 离线降级方案
async function getAIResponse(prompt) {
  // 优先端侧
  if (!navigator.onLine) {
    return edgeInference(prompt);
  }
  // 在线时尝试云端
  try {
    return await cloudInference(prompt);
  } catch {
    // 云端失败，降级端侧
    return edgeInference(prompt);
  }
}
```

### 2.5 内存泄漏排查与修复

**题目**：常见内存泄漏场景（流式连接未关闭、WebGPU资源未释放、端侧模型实例未销毁、对话/文档数据无限堆积、NPU任务残留）有哪些？如何定位与修复？

**答案**：

| 泄漏场景 | 原因 | 修复方案 |
|----------|------|----------|
| 流式连接未关闭 | SSE/WebSocket 组件卸载未取消 | useEffect cleanup 中 abort |
| WebGPU资源未释放 | buffer/texture 未 destroy | 组件卸载时显式 destroy |
| 模型实例未销毁 | unload 未调用 | 路由切换时 unload 模型 |
| 对话数据无限堆积 | 历史消息不限制数量 | 限制最大消息数，旧消息归档 |
| NPU任务残留 | 推理任务未 cancel | 切换任务时 cancel 旧任务 |

**定位工具**：
- Chrome DevTools → Memory → Heap Snapshot 对比
- Performance Monitor → JS Heap Size 趋势
- WebGPU Developer Tools → 资源追踪

**修复示例**：
```javascript
function AIChatPanel({ sessionId }) {
  const streamRef = useRef(null);
  
  useEffect(() => {
    // 建立流式连接
    streamRef.current = createAIStream(sessionId);
    
    return () => {
      // cleanup：关闭流式连接
      streamRef.current?.abort();
    };
  }, [sessionId]);
  
  // 限制消息数量
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    if (messages.length > 100) {
      // 保留最近100条，旧消息归档到 IndexedDB
      archiveMessages(messages.slice(0, -100));
      setMessages(messages.slice(-100));
    }
  }, [messages]);
}
```

---

## 三、三面（架构设计 + 综合能力 · 3题）

### 3.1 端云协同AI全栈前端架构设计

**题目**：设计联想端云协同AI全栈前端架构，覆盖多端适配、端侧推理引擎对接、大模型通信、RAG知识库、智能体编排、状态管理、安全监控、异构算力调度九大模块。

**答案**：

**整体分层架构（9层，端云一体化）**：

```
┌─────────────────────────────────────────────────────┐
│                  9. 业务应用层                        │
│    天禧对话 / AIPC文档 / 擎天AI办公 / 智能体编排       │
├─────────────────────────────────────────────────────┤
│              8. AI业务逻辑层（场景层）                  │
│    对话管理 / 文档处理 / 知识库检索 / 智能体编排         │
├─────────────────────────────────────────────────────┤
│         7. 企业知识库RAG层（数据层）                    │
│    IndexedDB / OPFS / 擎天知识库 / 向量检索             │
├─────────────────────────────────────────────────────┤
│       6. 端侧推理引擎层（AIPC特有）                     │
│    TensorFlow.js / OpenVINO / 联想加速引擎              │
│    NPU / GPU / CPU 异构调度                            │
├─────────────────────────────────────────────────────┤
│         5. 端云AI通信层（核心枢纽）                     │
│    LenovoAIStream / SSE / WebSocket / 四重鉴权          │
├─────────────────────────────────────────────────────┤
│           4. 多模态交互层（感知层）                     │
│    LEVA-AI组件库 / 文本语音图片文档采集                   │
├─────────────────────────────────────────────────────┤
│            3. 状态管理层                              │
│    Redux Toolkit（全局）+ Zustand（模块级）              │
├─────────────────────────────────────────────────────┤
│            2. 安全监控层                              │
│    沙箱隔离 / 防火墙 / 权限校验 / 文档脱敏                │
├─────────────────────────────────────────────────────┤
│           1. 多端适配层（接入层）                       │
│    React 18 / RN / Taro / Electron                    │
└─────────────────────────────────────────────────────┘
```

**各层核心能力**：

| 层级 | 技术栈 | 核心能力 |
|------|--------|----------|
| **多端适配** | React 18 + RN + Taro + Electron | 一套逻辑多端复用，适配AIPC异构算力 |
| **多模态交互** | LEVA-AI 组件库 | 文本/语音/图片/文档统一采集处理 |
| **端云通信** | LenovoAIStream | SSE/WebSocket，取消/重试/断点续传 |
| **端侧推理** | TF.js + OpenVINO | NPU/GPU/CPU异构调度，模型管理 |
| **RAG知识库** | IndexedDB + OPFS + Milvus | 文档解析/chunk/Embedding/检索 |
| **状态管理** | Redux Toolkit + Zustand | 全局+模块级状态，持久化同步 |
| **安全监控** | 沙箱+防火墙+权限+脱敏 | 四维防护体系 |
| **异构算力** | 自适应调度 | CPU/GPU/NPU动态分配 |
| **业务应用** | 天禧/AIPC/擎天 | 对话/文档/办公/智能体 |

### 3.2 状态管理与会话持久化

**题目**：设计前端状态管理与会话持久化方案，解决跨场景状态同步、文档/会话历史回溯、端云数据一致性、多设备协同。

**答案**：

**技术选型**：

| 技术 | 用途 |
|------|------|
| Redux Toolkit | 全局AI状态（用户信息、企业配置、设备列表、网络/算力状态） |
| Zustand | 模块级状态（对话会话、文档处理、知识库检索、智能体编排） |
| IndexedDB | 持久化会话历史、对话消息、文档元数据、向量缓存 |
| OPFS | 持久化AIPC大文档、端侧模型、离线生成结果 |

**分片策略**：按 sessionId / docId / enterpriseId / deviceId 分片，严格隔离。

**核心状态模块**：

```javascript
// 1. 全局AI状态（Redux Toolkit）
const aiGlobalSlice = createSlice({
  name: 'aiGlobal',
  initialState: {
    userInfo: null,
    enterpriseId: null,
    deviceInfo: null,
    computeState: { NPU: false, GPU: false, CPU: true },
    networkState: 'online',
    aiEnabled: true,
    fallbackMode: false,
  },
  reducers: { /* ... */ },
});

// 持久化：localStorage加密 + IndexedDB备份

// 2. 天禧对话状态（Zustand）
const useAIChatStore = create((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: {},  // sessionId → Message[]
  streaming: new Map(),
  
  addMessage: (sessionId, message) => set(state => {
    const msgs = state.messages[sessionId] || [];
    return {
      messages: { ...state.messages, [sessionId]: [...msgs, message] }
    };
  }),
  
  // IndexedDB 持久化
  persistSession: async (sessionId) => {
    const msgs = get().messages[sessionId];
    await db.messages.add({ sessionId, messages: msgs, timestamp: Date.now() });
  },
  
  // 历史回溯
  loadHistory: async (sessionId) => {
    const cached = await db.messages.get(sessionId);
    if (cached) set(state => ({
      messages: { ...state.messages, [sessionId]: cached.messages }
    }));
  },
}));

// 3. AIPC文档AI状态（Zustand）
const useAIDocStore = create((set, get) => ({
  docs: {},
  summaries: {},
  vectors: {},
  
  // IndexedDB 存储元数据/摘要/向量
  // OPFS 存储原始文档/大摘要
  saveDoc: async (docId, doc) => {
    await db.docs.add({ docId, ...doc });
    // 大文件写入 OPFS
    const fh = await navigator.storage.getDirectory();
    const file = await fh.getFileHandle(`${docId}.doc`);
    const writable = await file.createWritable();
    await writable.write(doc.content);
    await writable.close();
  },
}));
```

**端云数据一致性**：
```
本地修改 → 写入 IndexedDB → 标记 dirty → 网络恢复时同步云端
云端推送 → 冲突检测（CRDT/LSN）→ 合并 → 更新本地
```

### 3.3 高并发与全链路性能优化

**题目**：亿级AIPC用户、企业办公高峰/行业大促高并发场景下，从网络、渲染、内存、异构算力（CPU/GPU/NPU）四维度，说明联想AI前端全链路性能与高可用优化方案，需兼顾端侧离线可用与云端弹性扩容。

**答案**：

| 维度 | 优化方案 |
|------|----------|
| **网络** | CDN静态资源 + SSE长连接复用 + 请求合并 + 弱网降级端侧 + PWA离线缓存 |
| **渲染** | React 18并发渲染 + 虚拟滚动 + Web Worker计算 + 防抖节流 + 骨架屏 |
| **内存** | 消息数量限制 + WebGPU资源释放 + 模型按需加载/卸载 + IndexedDB定期清理 |
| **异构算力** | NPU优先（低功耗）→ GPU补充 → CPU兜底 + 任务队列 + 优先级调度 |

**高可用保障**：
```
端侧：PWA离线可用 + 本地模型推理 + IndexedDB数据持久化
云端：弹性扩容 + 负载均衡 + 熔断降级 + 多区域容灾
协同：端云自动切换 + 数据最终一致 + 冲突解决
```

---

## 四、面试要点总结

### 4.1 核心知识体系

| 方向 | 必考知识点 |
|------|------------|
| **React** | 并发渲染、自动批处理、Hooks逻辑复用、虚拟DOM调度 |
| **AI工程化** | 流式输出、端云切换、AI接口封装、超时/重试/取消 |
| **RAG** | 文档解析、chunk拆分、Embedding、向量检索、上下文压缩 |
| **端侧AI** | WebGPU、OpenVINO、NPU调度、模型量化、显存管理 |
| **存储** | IndexedDB、OPFS、分片策略、数据持久化 |
| **安全** | Prompt注入防护、数据脱敏、四重鉴权、沙箱隔离 |
| **架构** | 端云协同、多端适配、状态管理、异构算力调度 |

### 4.2 面试准备建议

1. **深入理解 React 18 并发机制**，能结合AI流式场景说明 startTransition 的应用
2. **手写AI接口封装**，掌握超时/重试/取消/端云切换的完整实现
3. **RAG前端链路**要能画出完整架构图，说明每步的技术选型
4. **端侧AI**了解 WebGPU/OpenVINO 基本原理，知道异构算力调度思路
5. **架构设计题**先分层再展开，从接入层→通信层→数据层→应用层逐层说明

---

*整理时间：2026-05-17*
*来源：小红书面经分享*
