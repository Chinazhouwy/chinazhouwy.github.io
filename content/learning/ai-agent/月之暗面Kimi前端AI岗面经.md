---
title: "月之暗面（Kimi）前端AI岗面经"
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
summary: "月之暗面（Kimi）前端AI岗面经"
tags:
---

# 月之暗面（Kimi）前端AI岗面经

> **来源**: 小红书
> **链接**: http://xhslink.com/o/9DMs66L7qrF
> **公司**: 月之暗面（Moonshot AI）— Kimi
> **标签**: #前端 #AI #面经 #Kimi #AGI

---

## 💡 面试感悟

> 在 Kimi，"快"不是标准，"稳"才是底线。
> 面试官最后问："你能保证你的代码在 128K 上下文下不崩吗？"
> 想去搞 AGI 的勇士们，先把 **Canvas** 和 **Web Worker** 焊死在脑子里！

---

## 🟢 一面：长文本渲染与流式交互（核心基建）

### Q1: 百万字文本的"零卡顿"渲染

**问题**：用户上传一本50万字的小说，Kimi 需要全文展示并支持实时高亮（AI读到哪高亮到哪）。直接 innerHTML 会导致浏览器卡死。如何设计？

**深度解析**：考察浏览器渲染极限与内存管理

**✅ 满分答案**：

**双虚拟滚动**：不仅虚拟行（Lines），还要虚拟字符（Characters）
- 将文本切成 Chunk（每1KB一个块）
- 只渲染可视区内的块

```javascript
// 虚拟字符渲染核心思路
class VirtualTextRenderer {
  constructor(text, containerWidth) {
    this.text = text;
    this.chunks = this.splitIntoChunks(text, 1024); // 每1KB一块
    this.visibleChunks = new Set();
  }

  // 仅渲染视口内的chunk
  render(viewportTop, viewportHeight) {
    const startChunk = this.getChunkAtOffset(viewportTop);
    const endChunk = this.getChunkAtOffset(viewportTop + viewportHeight);
    
    for (let i = startChunk; i <= endChunk; i++) {
      if (!this.visibleChunks.has(i)) {
        this.renderChunk(i); // Canvas绘制
        this.visibleChunks.add(i);
      }
    }
    // 销毁离开视口的chunk
    this.cleanupChunks(startChunk, endChunk);
  }
}
```

**Canvas/WebGL 渲染**：放弃 DOM，使用 Canvas 绘制文本
- `measureText` 计算换行
- 只绘制可视区的文字
- 内存占用极低（百万字字符串丢进 ArrayBuffer < 50MB）

```javascript
// Canvas 文本渲染
const canvas = document.getElementById('text-canvas');
const ctx = canvas.getContext('2d');
ctx.font = '16px sans-serif';

// 只计算并绘制可视区文本
function renderVisibleText(text, startOffset, endOffset) {
  const visibleText = text.slice(startOffset, endOffset);
  const lines = wrapText(ctx, visibleText, canvas.width);
  lines.forEach((line, i) => {
    ctx.fillText(line, 10, 20 + i * 20);
  });
}
```

**懒 Hydration**：文本先以纯字符串形式存在内存中
- 只有用户选中或 AI 高亮时，才将对应区域转换为 DOM 节点
- 离开即销毁，DOM 节点永远不超过几百个

### Q2: SSE 流式的"防抖"与"断点续传"

**问题**：AI 回复速度极快（每秒50个字），前端界面出现明显的打字机卡顿。且网络中断后如何保证不重复生成？

**深度解析**：考察网络层优化与状态一致性

**✅ 满分答案**：

**Buffer 缓冲池 + requestAnimationFrame 节流**：

```javascript
class StreamBuffer {
  constructor() {
    this.buffer = [];
    this.isRendering = false;
  }

  // SSE 来的 Token 先存进 buffer
  push(token) {
    this.buffer.push(token);
    if (!this.isRendering) {
      this.isRendering = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  // 每16ms取一批更新 UI
  flush() {
    const batch = this.buffer.splice(0, this.buffer.length);
    if (batch.length > 0) {
      this.updateUI(batch.join(''));
    }
    this.isRendering = false;
    if (this.buffer.length > 0) {
      this.isRendering = true;
      requestAnimationFrame(() => this.flush());
    }
  }
}
```

**断点续传（Last-Event-ID）**：

```javascript
// 前端：带 Last-Event-ID 重连
const eventSource = new EventSource('/api/chat/stream');

eventSource.addEventListener('message', (e) => {
  const token = JSON.parse(e.data);
  buffer.push(token.text);
  lastEventId = e.lastEventId; // 记录最后ID
});

// 网络断开重连时
function reconnect() {
  if (lastEventId) {
    // 带上 Last-Event-ID，后端从 checkpoint 继续生成
    new EventSource(`/api/chat/stream?lastEventId=${lastEventId}`);
  }
}

// diff-match-patch 合并新旧文本，避免闪烁
// 前端用 diff-match-patch 库做文本差异合并
```

---

## 🟡 二面：多模态与复杂状态（AI 工程化）

### Q1: 200MB PDF 解析的"进度欺骗"与真实渲染

**问题**：用户上传200MB PDF，前端需要展示解析进度，且解析完成后要能预览。

**深度解析**：考察 Web Worker 与 PDF.js 底层

**✅ 满分答案**：

**Web Worker 分流**：
```javascript
// 主线程
const worker = new Worker('pdf-worker.js');
worker.postMessage({ file: pdfFile });

// Worker 内
self.onmessage = async (e) => {
  const pdf = await pdfjsLib.getDocument(e.data.file).promise;
  // 逐页解析
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    self.postMessage({ type: 'progress', page: i, total: pdf.numPages });
  }
};
```

**虚假进度（Skeleton）**：真实的解析进度很难精确获取
- 前端先展示基于文件大小的"预估进度条"
- 解析完成后瞬间替换为真实内容

**分片加载**：利用 `IntersectionObserver` 配合 PDF.js 的 `getPage` 实现滚动加载

### Q2: 联网搜索的"竞态消除"

**问题**：用户提问后 Kimi 先搜10条网页再总结，UI 状态极其复杂（Loading→搜索中→总结中→完成）。

**深度解析**：考察复杂异步状态管理

**✅ 满分答案**：

**XState 状态机**：
```javascript
import { createMachine } from 'xstate';

const searchMachine = createMachine({
  id: 'search',
  initial: 'idle',
  states: {
    idle: { on: { SEARCH: 'searching' } },
    searching: { 
      on: { 
        RESULTS: 'summarizing',
        ABORT: 'idle',
        ERROR: 'error'
      } 
    },
    summarizing: {
      on: {
        DONE: 'completed',
        ABORT: 'idle',
        ERROR: 'error'
      }
    },
    completed: { on: { SEARCH: 'searching' } },
    error: { on: { RETRY: 'searching' } }
  }
});
```

**AbortController 竞态处理**：
```javascript
let currentAbortController = null;

async function search(query) {
  // 取消上一次请求
  if (currentAbortController) {
    currentAbortController.abort();
  }
  
  currentAbortController = new AbortController();
  
  try {
    // 带 signal 的 fetch，自动取消
    const response = await fetch('/api/search', {
      signal: currentAbortController.signal
    });
    // 处理结果...
  } catch (err) {
    if (err.name === 'AbortError') {
      // 被取消，忽略
      return;
    }
    // 其他错误处理
  }
}
```

---

## 🔴 三面：CTO 的安全与未来拷问

### Q1: 黑客输入"忽略以上指令"，前端怎么防？

**✅ 答案**：
1. **输入净化**：前端建敏感词库拦截 prompt 注入模式
2. **CSP 锁死**：Content-Security-Policy 严格限制脚本执行
3. **不可见字符注入**：在 prompt 中插入 Zero-width chars（零宽字符），增加构造攻击语句成本

```javascript
// CSP 策略示例
// <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
```

### Q2: API 全挂了，千万用户怎么办？

**✅ 答案**：**Service Worker 兜底**

```javascript
// Service Worker 拦截请求，缓存兜底
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // 有缓存用缓存，没缓存走网络
      return cached || fetch(event.request).catch(() => {
        // 网络也挂了，返回历史记录
        return caches.match('/history');
      });
    })
  );
});

// 历史记录全塞 IndexedDB
// 服务器炸了，用户至少能看历史聊天记录，不能丢数据
```

---

## 📊 面试总结

| 轮次 | 考察重点 | 核心技能 |
|------|---------|---------|
| 一面 | 长文本渲染、SSE流式 | Canvas/WebGL、虚拟滚动、requestAnimationFrame |
| 二面 | PDF解析、状态管理 | Web Worker、XState、AbortController |
| 三面 | 安全、容灾 | CSP、Service Worker、IndexedDB |

> 💡 **Kimi 面试核心**：不考核框架API（React/Vue），考核的是**浏览器底层能力**和**AI场景工程化思维**。
> - Canvas/WebGL 代替 DOM 渲染
> - Web Worker 做计算密集型任务
> - 状态机管理复杂异步流程
> - Service Worker 做容灾兜底