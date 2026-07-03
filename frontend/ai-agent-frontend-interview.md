# AI Agent 前端开发工程师 面经

> 来源：小红书面经 | 标签：前端、AI Agent、SSE、Generative UI、Node.js BFF

## 面试概况

- **岗位**: AI Agent 前端开发工程师
- **轮次**: 三面
- **特点**: 聚焦 AI 应用场景下的前端挑战（流式数据、动态 UI、性能优化、安全）

---

## 第一面（5 题）

### 1. H5 移动端丝滑视觉生成加载态与复杂转场动画

**动画实现选型**：
- CSS Animation/Transition：只触发合成（transform + opacity），不触发 Layout/Paint
- JavaScript 动画库（GSAP）：复杂序列、物理效果、精确时间轴控制
- View Transitions API：路由级转场，`document.startViewTransition()`

**加载态设计**：
- 骨架屏（纯 CSS 骨架 + 渐变模糊）
- 微交互动画（流动光晕、呼吸球，用 animation-delay 错开）
- 渐进加载（LQIP 低质量占位图 → 高清图 + blur 动画）

**防抖与降级**：
- 帧预算监控（FPS < 30 自动关闭非必要动画）
- `prefers-reduced-motion` 用户偏好
- 动画可被用户手势打断

### 2. 对话场景 SSE 长连接断开重连、粘包与片段解析

**断开重连机制**：
- 弃用原生 EventSource，改用 `fetch` + `ReadableStream` 完全掌控
- 指数退避 + 最大超时时间
- 记录 `Last-Event-ID`，重连时携带实现断点续传
- `navigator.onLine` 监听网络状态

**粘包与片段解析（流式解码器）**：
```
Fetch Stream → TextDecoder(stream: true) → LineBuffer → SSE Event Parser → JSON Fragment Parser
```
- `TextDecoder({ stream: true })`：自动处理多字节 UTF-8 被 TCP 分包切断
- `LineBuffer`：按 `

` 切分 SSE 事件，不完整块保留至下次
- 流式 JSON 解析器（partial-json）：不完整 JSON 仍能提取已出现内容

### 3. 防范 AI 返回不可控 HTML 富文本的 XSS

**纵深防御方案**：
1. **DOMPurify 前端净化**：白名单过滤，只允许 `<p>`, `<b>`, `<i>`, `<a>` 等安全标签
2. **CSP（Content-Security-Policy）**：`script-src 'self'` 阻止内联脚本
3. **沙箱 iframe**：`<iframe sandbox="allow-same-origin">` 隔离渲染
4. **后端清洗**：后端同样执行 HTML 净化，双重保障

### 4. 复杂创作画布（数百图层/分镜节点）的渲染降级与性能调优

**渲染架构**：Canvas 2D / WebGL + 懒加载 + 分层缓存
- React-Konva / Vue-Konva（声明式 Canvas 节点操作）
- PixiJS (WebGL)（更底层控制，GPU 高性能图层变换）

**核心优化手段**：
1. **视口裁剪（Culling）**：R-Tree/四叉树快速查询可见节点
2. **图层缓存与合并**：不常变化的节点绘制到离屏 Canvas 缓存
3. **多线程计算**：Web Worker 处理布局、图层排序、滤镜计算
4. **渲染降级**：缩放自适应、拖拽时仅移动线框、`requestIdleCallback` 分帧绘制
5. **框架配合**：React/Vue 仅管理轻量数据层，不直接渲染每个图层 DOM

### 5. 突破浏览器并发连接限制，优化大批量资产并行加载

1. **升级到 HTTP/2 / HTTP/3**：多路复用天然消除并发限制
2. **域名分片（Domain Sharding）**：2-4 个子域名突破单域限制（HTTP/1.1 限制 6 个）
3. **智能优先级队列**：视口可见→立即加载；近视口→预加载；画布外→低优先级 + AbortController 控制并发池
4. **Service Worker 缓存**：IndexedDB/Cache Storage 拦截请求
5. **Range 请求分段并行下载**：大文件（视频）并发分段下载，3-4 段即可
6. **资源压缩**：WebP/AVIF 图片，H.264 硬件解码视频

---

## 第二面（6 题）

### 1. Generative UI：根据 JSON Schema 实时动态渲染编辑面板

**CUI+GUI 融合场景**：大模型流式返回描述 UI 结构的 JSON Schema，前端即时渲染

**实现架构**：
1. **流式 Schema 累积与解析**：从 SSE 片段实时提取 Schema
2. **动态表单引擎**：Schema → Form 映射（react-jsonschema-form 基础 + 重度自定义）
3. **增量更新与保留状态**：按字段路径 reconcile，不销毁已有组件
4. **错误与缺省处理**：ErrorBoundary 包裹，缺失 type 默认 text input
5. **交互闭环**：用户修改参数 → 操作参数 JSON 发回模型 → 生成-交互-反馈循环

### 2. Node.js BFF 高效透传大模型流式接口与权限、CORS

- Next.js Route Handler 代理大模型流式接口
- 不缓冲完整 Response，直接流式转发
- 同步完成 CORS 处理和权限拦截

### 3. Agent 插件注册与动态表单校验机制（参考 Dify 架构）

### 4. 长耗时异步任务：Node.js + 外部队列 + WebSocket 推送链路

- 视频/复杂长图生成耗时极长
- Node.js 结合外部队列设计可靠的异步任务状态轮询
- WebSocket 推送链路实时更新进度

### 5. 全局状态树设计：支持跨组件数据穿透、撤销/重做

- "剧本-分镜-成片"一站式工作流
- Store 设计支持跨组件数据穿透
- 撤销/重做机制（Undo/Redo）

### 6. 浏览器本地缓存：IndexedDB 建立视觉素材存储池

- 高命中率缓存降低后续相同 Agent 任务的冷启动时间

---

## 第三面（4 题）

### 1. Agentic 工作流拖拽引擎架构

- 自定义一键执行的工作流拖拽引擎
- 技术选型、模块边界划分、底层数据模型设计

### 2. Web Worker 剥离高耗时图像处理

- 智能裁剪、滤镜预览等像素级预处理从主事件循环剥离

### 3. 防腐层设计：应对多模态大模型 API 高频迭代

- Node.js 基础框架层设计严密的防腐层与错误兜底策略
- 保障前端 UI 的高可用

### 4. 协同编辑冲突解决（数十万创作者场景）

- 前端与 Node.js 服务端配合解决长内容的协同编辑冲突（竞态条件）

---

## 经验总结

1. **AI 前端 ≠ 传统前端**：聚焦流式数据处理、动态 UI 渲染、安全防御
2. **SSE 是核心技能**：fetch + ReadableStream + 指数退避重连 + 流式 JSON 解析
3. **XSS 纵深防御**：DOMPurify + CSP + 沙箱 iframe + 后端清洗
4. **性能优化三板斧**：视口裁剪 + 图层缓存 + Web Worker 多线程
5. **Generative UI 是趋势**：JSON Schema → 动态表单 → 增量更新
6. **Node.js BFF 是标配**：流式透传 + 权限 + CORS + 队列 + WebSocket
7. **AI Coding 能力**：面试官关注候选人使用 AI 工具辅助开发的经验

---

*整理时间: 2026-05-18*
