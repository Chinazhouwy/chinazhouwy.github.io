---
title: "Vue 3 + TypeScript 快速上手（下）：高级响应式与工程化"
date: "2026-07-29"
domain: "学习"
area: "前端"
module: "Vue 3 + TypeScript"
project: ""
type: "教程"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "掌握 shallowRef、readonly、markRaw、customRef、Teleport 与异步组件，并补齐性能、安全、测试、迁移和生产构建的工程实践。"
tags:
  - Vue 3
  - TypeScript
  - 响应式
  - 前端工程化
  - 前端安全
  - 尚硅谷
---

# Vue 3 + TypeScript 快速上手（下）：高级响应式与工程化

> **来源说明：** 本文参考尚硅谷《Vue3 快速上手》课程资料，对高级响应式 API、Teleport、Suspense 和全局 API 部分进行了勘误、重组和二次编写，并补充测试、安全与生产构建。原课程及资料版权归尚硅谷及相关作者所有。
>
> **版本说明：** 示例使用当前 `create-vue` 稳定组合验证：Vue 3.5.40、TypeScript 6.0.x、Vite 8.1.x。`<Suspense>` 在当前官方文档中仍标记为实验性能力，不能把它当作稳定公共 API 无条件使用。

系列上一篇：

[Vue 3 + TypeScript 快速上手（中）：Router、Pinia 与组件通信](#/article/content%2Flearning%2Ffrontend%2F2026-07-29-03-vue3-router-pinia-communication.md)

## 0. 先建立工程判断

高级 API 不是“学得越多，用得越多”。

正确顺序是：

```text
先写清楚的数据流
      ↓
出现真实问题
      ↓
测量问题在哪
      ↓
选择最小 API
      ↓
增加测试与边界说明
```

例如：

- 大对象深度代理有成本，再考虑 `shallowRef`；
- 第三方实例不应代理，再考虑 `markRaw`；
- 弹窗被祖先层叠上下文遮挡，再考虑 `Teleport`；
- 输入确实需要防抖，再封装 `customRef`；
- 首屏包确实过大，再拆异步组件。

不要先用高级 API，再给它寻找理由。

---

## 1. shallowRef 与 shallowReactive

### 1.1 shallowRef

`shallowRef` 只追踪 `.value` 的替换，不深度代理内部对象。

```ts
import { shallowRef } from 'vue'

interface BoardSnapshot {
  version: number
  tasks: Task[]
}

const snapshot = shallowRef<BoardSnapshot>({
  version: 1,
  tasks: [],
})
```

直接修改内部属性不会触发依赖更新：

```ts
snapshot.value.tasks.push(newTask)
```

整体替换会触发：

```ts
snapshot.value = {
  ...snapshot.value,
  version: snapshot.value.version + 1,
  tasks: [...snapshot.value.tasks, newTask],
}
```

适用场景：

- 数据量很大的不可变快照；
- 外部状态系统返回的新引用；
- 大型 JSON，只关心整体替换；
- 第三方库负责内部变更。

如果业务一直原地修改深层字段，`shallowRef` 反而容易制造“不更新”的问题。

### 1.2 triggerRef

确实需要原地修改后手动通知：

```ts
import { shallowRef, triggerRef } from 'vue'

const snapshot = shallowRef<BoardSnapshot>({
  version: 1,
  tasks: [],
})

snapshot.value.tasks.push(newTask)
triggerRef(snapshot)
```

这是一种明确的手动协议。使用方必须知道什么时候触发，通常不应成为普通表单状态的默认方案。

### 1.3 shallowReactive

```ts
import { shallowReactive } from 'vue'

const board = shallowReactive({
  title: '学习看板',
  settings: {
    compact: false,
  },
})

board.title = 'Vue 3 看板'       // 顶层变化可追踪
board.settings.compact = true   // 深层对象不是自动深度代理
```

不要在同一棵状态树里随意混合深层响应式和浅层响应式，否则调试成本会明显增加。

---

## 2. readonly 与 shallowReadonly

### 2.1 readonly

```ts
import { reactive, readonly } from 'vue'

const internalState = reactive({
  tasks: [] as Task[],
  loading: false,
})

const publicState = readonly(internalState)
```

外部读取：

```ts
console.log(publicState.tasks)
```

外部修改会在开发环境收到警告：

```ts
// 不应这样修改
publicState.loading = true
```

注意：`readonly` 创建的是只读代理，不是深冻结后的不可变快照。原始响应式对象从内部更新时，只读视图仍会同步变化。

### 2.2 shallowReadonly

```ts
import { shallowReadonly } from 'vue'

const config = shallowReadonly({
  theme: 'light',
  features: {
    timeline: true,
  },
})
```

只有顶层是只读的。适用场景比 `readonly` 少，使用时应明确说明内部对象是否允许修改。

### 2.3 推荐模式

组合式函数或 provide/inject 可以这样暴露：

```ts
function useTaskState() {
  const tasks = ref<Task[]>([])

  function addTask(task: Task) {
    tasks.value.push(task)
  }

  return {
    tasks: readonly(tasks),
    addTask,
  }
}
```

读取者拿到只读状态，通过明确动作修改：

```text
状态读取  -> readonly
状态修改  -> 有业务名称的方法
```

---

## 3. toRaw 与 markRaw

### 3.1 toRaw

`reactive` 返回 Proxy，某些只接受普通对象的库需要原始对象：

```ts
import { reactive, toRaw } from 'vue'

const task = reactive<Task>({
  id: 1,
  title: '学习 toRaw',
  status: 'todo',
  tags: [],
  createdAt: '2026-07-29',
})

const rawTask = toRaw(task)
```

适合：

- 临时传给不认识 Proxy 的库；
- 调试对象身份；
- 避免某次只读访问触发代理跟踪。

注意点：

- 不要长期保存 `toRaw` 返回的引用；
- 不要同时修改原始对象和代理对象；
- `toRaw` 不是“关闭响应式”的常规状态管理方案。

### 3.2 markRaw

一个第三方引擎实例通常不应该进入 Vue 深度代理：

```ts
import { markRaw, reactive } from 'vue'

class BoardEngine {
  render(): void {
    console.log('render board')
  }
}

const state = reactive({
  engine: markRaw(new BoardEngine()),
})

state.engine.render()
```

适合 `markRaw` 的对象：

- Canvas、地图、富文本编辑器实例；
- 大型第三方类实例；
- 不应被代理的不可变数据；
- Vue 组件对象需要放入响应式配置时。

不要把普通业务对象全部 `markRaw` 来“优化性能”。这会让本该更新的视图失去响应。

---

## 4. customRef：自己控制追踪与触发

### 4.1 防抖输入

`src/composables/useDebouncedRef.ts`：

```ts
import { customRef, type Ref } from 'vue'

export function useDebouncedRef<T>(
  initialValue: T,
  delay = 300,
): Ref<T> {
  let value = initialValue
  let timer: ReturnType<typeof setTimeout> | undefined

  return customRef<T>((track, trigger) => ({
    get() {
      track()
      return value
    },
    set(nextValue) {
      if (timer) {
        clearTimeout(timer)
      }

      timer = setTimeout(() => {
        value = nextValue
        trigger()
      }, delay)
    },
  }))
}
```

组件中使用：

```vue
<script setup lang="ts">
import { useDebouncedRef } from '@/composables/useDebouncedRef'

const keyword = useDebouncedRef('', 300)
</script>

<template>
  <input v-model="keyword" placeholder="输入后 300ms 生效" />
  <p>搜索词：{{ keyword }}</p>
</template>
```

`track()` 表示读取时建立依赖，`trigger()` 表示值真正生效时通知依赖更新。

### 4.2 什么时候不要用

如果只需要“输入值立即显示，接口请求延迟发送”，普通 `ref + watch` 往往更清楚：

```ts
const keyword = ref('')

watch(keyword, (value, _oldValue, onCleanup) => {
  const timer = window.setTimeout(() => {
    search(value)
  }, 300)

  onCleanup(() => {
    window.clearTimeout(timer)
  })
})
```

两种方案语义不同：

- `customRef`：响应式值本身延迟更新；
- `ref + watch`：值立即更新，副作用延迟执行。

搜索框通常更适合第二种，因为用户输入应立即显示。

---

## 5. Teleport：把 DOM 渲染到别处

### 5.1 为什么需要

弹窗组件虽然写在某个深层组件里，但它的 DOM 如果也留在深层位置，可能受到祖先元素影响：

- `overflow: hidden` 导致裁剪；
- `transform` 创建新的定位上下文；
- `z-index` 被局部层叠上下文限制。

`Teleport` 可以保留组件逻辑关系，同时把 DOM 渲染到 `body` 或指定容器。

### 5.2 弹窗示例

```vue
<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'

const open = defineModel<boolean>({ required: true })
const closeButton = useTemplateRef<HTMLButtonElement>('close-button')

watch(open, async (visible) => {
  if (visible) {
    await nextTick()
    closeButton.value?.focus()
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="dialog-backdrop"
      @click.self="open = false"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        class="dialog"
      >
        <header>
          <h2 id="dialog-title">
            <slot name="title">确认操作</slot>
          </h2>
          <button
            ref="close-button"
            type="button"
            aria-label="关闭"
            @click="open = false"
          >
            关闭
          </button>
        </header>

        <slot />
      </section>
    </div>
  </Teleport>
</template>
```

Teleport 只改变渲染位置：

- Props、Emits、provide/inject 关系不变；
- 事件仍按 Vue 组件树工作；
- 样式和 DOM 查询要考虑新的实际位置。

完整说明见 [Teleport](https://vuejs.org/guide/built-ins/teleport.html)。

---

## 6. 异步组件与代码分割

### 6.1 路由级懒加载

页面级组件通常直接使用动态导入：

```ts
{
  path: '/reports',
  name: 'reports',
  component: () => import('@/views/ReportView.vue'),
}
```

构建工具会为其生成独立 chunk，在访问页面时加载。

### 6.2 defineAsyncComponent

非路由组件可以使用：

```ts
import { defineAsyncComponent } from 'vue'

const TaskChart = defineAsyncComponent({
  loader: () => import('@/components/TaskChart.vue'),
  loadingComponent: () => import('@/components/LoadingBlock.vue'),
  errorComponent: () => import('@/components/ErrorBlock.vue'),
  delay: 150,
  timeout: 10_000,
})
```

适合拆分：

- 很重的图表；
- 富文本编辑器；
- 低频打开的设置面板；
- 大型弹窗；
- 特定权限才会显示的功能。

不要把每个小组件都异步化。请求数量、加载闪烁和错误处理也有成本。

### 6.3 Suspense

```vue
<Suspense>
  <template #default>
    <AsyncTaskReport />
  </template>

  <template #fallback>
    <p>报告加载中...</p>
  </template>
</Suspense>
```

当前官方文档仍将 `<Suspense>` 标记为实验性能力：[Suspense](https://vuejs.org/guide/built-ins/suspense.html)。

工程建议：

- 可以在可控项目中使用；
- 不要把公共组件库的稳定契约完全押在它上面；
- 评估升级风险；
- 同时处理异步错误，而不只提供 loading；
- 简单场景使用显式 `loading/error/data` 状态更透明。

---

## 7. 应用实例与全局 API

Vue 3 把许多全局操作收敛到应用实例：

```ts
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)

app.component('BaseButton', BaseButton)
app.directive('focus', focusDirective)
app.provide(apiClientKey, apiClient)
app.use(router)
app.use(pinia)

app.config.errorHandler = (error, instance, info) => {
  console.error('Vue error', {
    error,
    instance,
    info,
  })
}

app.mount('#app')
```

常见 API：

| API | 用途 |
|---|---|
| `app.use` | 安装插件 |
| `app.component` | 注册全局组件 |
| `app.directive` | 注册全局指令 |
| `app.provide` | 提供应用级依赖 |
| `app.config` | 配置错误处理等行为 |
| `app.mount` | 挂载应用 |
| `app.unmount` | 卸载应用 |

全局注册会扩大隐式依赖。基础设计组件可以全局注册，业务组件更推荐显式导入。

---

## 8. 错误、加载与空状态

请求状态不要只用一个 `loading`：

```ts
type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }
```

组件：

```vue
<template>
  <p v-if="state.status === 'idle'">
    尚未加载
  </p>

  <p v-else-if="state.status === 'loading'">
    加载中...
  </p>

  <TaskList
    v-else-if="state.status === 'success'"
    :tasks="state.data"
  />

  <ErrorBlock
    v-else
    :message="state.message"
    @retry="loadTasks"
  />
</template>
```

还要区分：

- 成功但列表为空；
- 网络不可用；
- 请求被主动取消；
- 无权限；
- 服务端错误；
- 数据结构不合法。

错误处理的目标不是“控制台打印一下”，而是给用户明确下一步，并给开发者留下可定位的信息。

---

## 9. 性能优化

### 9.1 先测量

优先使用：

- Vue DevTools；
- Chrome Performance；
- Network；
- Lighthouse；
- 构建产物分析；
- 真实用户监控。

没有测量结果时，“这里可能慢”只是猜测。

### 9.2 更新性能

让 Props 尽量稳定：

```vue
<!-- 每个子组件只接收最终布尔值 -->
<TaskItem
  v-for="task in tasks"
  :key="task.id"
  :task="task"
  :active="task.id === activeId"
/>
```

而不是让所有子组件都接收 `activeId` 后自行比较。

适合时使用：

- `computed` 缓存派生结果；
- `v-once` 渲染永不变化内容；
- `v-memo` 跳过满足条件的子树更新；
- 虚拟列表渲染超长列表；
- Web Worker 处理重 CPU 任务；
- `shallowRef` 管理大型不可变数据。

### 9.3 加载性能

- 路由和重型组件按需加载；
- 图片设置合适尺寸和懒加载；
- 避免把整个工具库打进首屏；
- 检查重复依赖；
- 使用 CDN 前先评估缓存、可用性和供应链风险；
- 对核心静态资源设置正确缓存策略。

### 9.4 不要做无效优化

常见无效优化：

- 把所有状态换成浅层响应式；
- 组件越拆越碎；
- 每个函数都手动缓存；
- 在没有大列表时引入虚拟滚动；
- 为几十 KB 的包建立复杂微前端。

官方建议见 [Vue Performance](https://vuejs.org/guide/best-practices/performance.html)。

---

## 10. 前端安全

### 10.1 模板插值默认转义

```vue
<p>{{ userInput }}</p>
```

Vue 会把文本按文本内容插入，不会把字符串直接执行成 HTML。

### 10.2 谨慎使用 v-html

```vue
<!-- 只有内容来源完全可信或经过可靠清洗时才能使用 -->
<article v-html="trustedHtml" />
```

不要把用户输入、AI 输出或第三方接口返回值直接交给 `v-html`。

风险不止 `<script>`：

- 事件属性；
- 危险 URL；
- SVG 与 MathML；
- CSS 注入；
- DOM clobbering；
- 链接诱导和钓鱼内容。

需要展示富文本时：

```text
服务端内容策略
      +
成熟清洗器白名单
      +
前端只渲染清洗结果
      +
CSP 等浏览器防线
```

### 10.3 URL 与模板来源

- 不允许用户提供 Vue 模板；
- 动态链接要校验协议；
- `javascript:` 等危险协议必须拒绝；
- 敏感 Token 不放在 URL；
- 前端权限控制不能替代服务端鉴权。

### 10.4 依赖安全

- 提交 lockfile；
- 审核新依赖是否真的必要；
- 关注依赖安全公告；
- 不从不可信 CDN 加载可执行脚本；
- 不把密钥写进 `VITE_*` 环境变量。

所有 `VITE_*` 变量都会被打包到客户端，用户可以读取。它们只能保存公开配置，不能保存服务端密钥。

更多说明见 [Vue Security](https://vuejs.org/guide/best-practices/security.html)。

---

## 11. 测试

### 11.1 组合式函数测试

```ts
import { describe, expect, it, vi } from 'vitest'
import { useDebouncedRef } from '@/composables/useDebouncedRef'

describe('useDebouncedRef', () => {
  it('delays value updates', () => {
    vi.useFakeTimers()

    const keyword = useDebouncedRef('', 300)
    keyword.value = 'Vue'

    expect(keyword.value).toBe('')

    vi.advanceTimersByTime(300)
    expect(keyword.value).toBe('Vue')

    vi.useRealTimers()
  })
})
```

### 11.2 组件测试

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TaskTitleInput from './TaskTitleInput.vue'

describe('TaskTitleInput', () => {
  it('emits the new model value', async () => {
    const wrapper = mount(TaskTitleInput, {
      props: {
        modelValue: '',
        'onUpdate:modelValue': (value: string) =>
          wrapper.setProps({ modelValue: value }),
      },
    })

    await wrapper.get('input').setValue('学习 Vue')

    expect(wrapper.emitted('update:modelValue')).toEqual([
      ['学习 Vue'],
    ])
  })
})
```

### 11.3 测试优先级

优先覆盖：

- 用户能看到的行为；
- Store Action 的业务规则；
- Router 关键跳转；
- 错误和空状态；
- 复杂组合式函数；
- 曾经出现过的缺陷。

不要把测试写成组件内部实现的镜像。重构内部代码后，用户行为没变，测试通常也不应大面积失败。

运行：

```bash
npm run test:unit
npm run type-check
npm run build
```

---

## 12. 生产构建与环境配置

### 12.1 环境变量

`.env.development`：

```dotenv
VITE_API_BASE_URL=/api
```

读取：

```ts
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
```

为变量补类型：

```ts
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

再次强调：客户端环境变量不是秘密。

### 12.2 构建检查

```bash
npm run type-check
npm run test:unit
npm run build
```

仅仅 `vite build` 成功不代表类型一定正确。很多 Vue 项目把转译和类型检查拆开，因此要显式运行 `vue-tsc` 对应的脚本。

### 12.3 部署检查

上线前检查：

1. `base` 是否匹配部署子路径；
2. Router History 是否有服务器回退；
3. 静态资源缓存是否合理；
4. Source Map 是否按安全策略发布；
5. 接口地址是否指向正确环境；
6. CSP、HTTPS 和安全响应头是否配置；
7. 刷新深层路由是否正常；
8. 错误监控是否收到版本信息；
9. 移动端布局和键盘操作是否可用；
10. 构建产物中是否误带密钥或内部地址。

---

## 13. Vue 2 迁移时要检查什么

Vue 3 不能只理解成“Vue 2 写法全部照搬”。

高频变化包括：

- 创建应用改为 `createApp`；
- 全局 API 移到应用实例；
- `v-model` 契约调整；
- `.sync` 被新的 `v-model` 参数替代；
- 移除 `$on`、`$off`、`$once`；
- 移除过滤器；
- 移除 `$children`；
- `v-if` 与 `v-for` 优先级变化；
- 过渡类名变化；
- Router 使用 Vue Router 4；
- 推荐 Pinia 替代新的 Vuex 项目。

迁移步骤建议：

```text
锁定现有行为与测试
      ↓
检查依赖是否支持 Vue 3
      ↓
阅读 Breaking Changes
      ↓
逐模块迁移并验证
      ↓
最后移除兼容层
```

不要在迁移框架的同时重写全部业务。框架升级和业务重构叠加后，问题很难定位。

---

## 14. 推荐目录结构

```text
src/
├── assets/              # 本地静态资源
├── components/          # 可复用组件
│   ├── base/            # 基础 UI
│   └── task/            # 任务领域组件
├── composables/         # 组合式函数
├── context/             # InjectionKey 与局部上下文
├── router/              # 路由定义与守卫
├── stores/              # Pinia Store
├── types/               # 共享类型
├── views/               # 路由页面
├── App.vue
└── main.ts
```

目录结构不是越细越专业。判断标准是：

- 能否快速找到一个业务能力；
- 跨目录跳转是否过多；
- 领域代码是否被技术类型打散；
- 公共层是否真的公共；
- 删除一个功能时能否清楚找到相关文件。

小项目可以更扁平，项目增长后再按领域拆分。

---

## 15. 一份工程检查清单

### 类型

- 开启 `strict`；
- 接口响应先当作未知数据校验；
- 不用 `any` 掩盖错误；
- Props、Emits、Store Action 有明确类型；
- URL 和本地存储做运行时校验。

### 响应式

- 派生值使用 `computed`；
- 副作用使用 `watch`；
- 异步副作用能清理；
- 不盲目使用深度 watch；
- 浅层 API 有真实性能理由。

### 组件

- Props 向下、事件向上；
- `defineModel` 只用于明确双向绑定；
- 避免 `$parent`；
- `defineExpose` 只暴露最小命令；
- 插槽有合理默认内容。

### 路由与状态

- URL 可以表达可分享的页面状态；
- Router 不承担全部业务状态；
- Store 不吞掉全部局部输入状态；
- 服务端处理前端路由回退；
- 导航守卫不是后端权限校验。

### 安全与质量

- 不直接渲染不可信 HTML；
- 客户端不包含密钥；
- 第三方依赖经过评估；
- 核心行为有测试；
- 类型检查、测试、构建全部通过；
- 生产环境有错误监控。

---

## 16. 系列总复习

四篇文章构成了一条连续路线：

```text
TypeScript 类型基础
        ↓
Vue 响应式与组件
        ↓
Router + Pinia + 通信
        ↓
性能 + 安全 + 测试 + 部署
```

真正需要掌握的不是 API 数量，而是下面五个判断：

1. 数据的所有者是谁？
2. 当前值是原始状态、派生状态，还是副作用？
3. 状态应该留在组件、组件树上下文，还是应用 Store？
4. 这个优化解决了哪一个已测量的问题？
5. 外部输入在什么位置进入可信边界？

把这五个问题答清楚，Vue 3 项目通常不会因为组件数量增加就立刻失控。

## 参考资料

- [尚硅谷 Vue3 教程](https://www.atguigu.com/video/284/)
- [Reactivity API: Advanced](https://vuejs.org/api/reactivity-advanced.html)
- [Teleport](https://vuejs.org/guide/built-ins/teleport.html)
- [Async Components](https://vuejs.org/guide/components/async.html)
- [Suspense](https://vuejs.org/guide/built-ins/suspense.html)
- [Vue Performance](https://vuejs.org/guide/best-practices/performance.html)
- [Vue Security](https://vuejs.org/guide/best-practices/security.html)
- [Vue Testing Guide](https://vuejs.org/guide/scaling-up/testing.html)
- [Vue 3 Migration Guide](https://v3-migration.vuejs.org/)
