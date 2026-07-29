---
title: "Vue 3 + TypeScript 快速上手（上）：Vite、Composition API 与响应式"
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
summary: "从 create-vue 创建工程，系统掌握 script setup、ref、reactive、computed、watch、Props、模板引用、生命周期与组合式函数。"
tags:
  - Vue 3
  - TypeScript
  - Vite
  - Composition API
  - 响应式
  - 尚硅谷
---

# Vue 3 + TypeScript 快速上手（上）：Vite、Composition API 与响应式

> **来源说明：** 本文参考尚硅谷《Vue3 快速上手》课程资料，在保留“概述、具体编码、注意点、小结”的讲解方式基础上，按 Vue 3.5 和当前官方工具链重新编写。原课程及资料版权归尚硅谷及相关作者所有。
>
> **版本说明：** 本文不再使用 Vue CLI、旧 Volar 名称、第三方组件命名插件或远程演示 API。Vue 3.6 在本文整理时仍处于预发布阶段，因此示例使用 `create-vue 3.23.0` 当前稳定组合验证：Vue 3.5.40、TypeScript 6.0.x、Vite 8.1.x。版本状态可查看 [Vue Releases](https://github.com/vuejs/core/releases)。

## 0. 学习目标

这一篇继续使用“任务看板”作为示例。完成后应该能够：

- 使用 `create-vue` 创建 Vue 3 + TypeScript 工程；
- 理解 Options API 与 Composition API 的差异；
- 正确使用 `ref`、`reactive` 和 `computed`；
- 知道什么时候使用 `watch`、`watchEffect`；
- 编写类型安全的 Props、事件和模板引用；
- 把可复用逻辑提取成组合式函数。

系列上一篇：

[TypeScript 极速梳理：Vue 3 开发所需的类型基础](#/article/content%2Flearning%2Ffrontend%2F2026-07-29-01-typescript-for-vue3-foundations.md)

---

## 1. Vue 3 简介

### 1.1 Vue 是什么

Vue 是一个渐进式 JavaScript 框架：

- 可以只在传统页面中增强一个局部区域；
- 可以使用单文件组件构建 SPA；
- 可以配合 Router、Pinia 管理大型前端应用；
- 需要 SSR、SSG 时可以使用 Nuxt 等上层框架。

“渐进式”不是说一定要从简单写到复杂，而是说你可以按项目需要选择使用范围。

### 1.2 Vue 3 的几个核心变化

相对 Vue 2，Vue 3 的主要变化包括：

1. 使用 Proxy 构建新的响应式系统；
2. 引入 Composition API；
3. 更完整地支持 TypeScript；
4. 支持多个根节点、Teleport、Fragments 等能力；
5. 全局 API 转移到应用实例；
6. 官方构建工具转向 Vite；
7. 推荐 Pinia 作为状态管理方案。

注意：Vue 3 不是对 Vue 2 的完全语法兼容版本。迁移旧项目应逐项检查 [Vue 3 Breaking Changes](https://v3-migration.vuejs.org/breaking-changes/)。

---

## 2. 创建 Vue 3 工程

### 2.1 环境准备

当前 `create-vue 3.23.0` 生成项目的环境要求是：

- Node.js `^22.18.0 || >=24.12.0`；
- 使用 `create-vue` 创建项目；
- 使用 Vite 作为构建工具；
- VS Code 安装 `Vue - Official` 扩展。

工具链变化很快，以新建项目生成的 `package.json#engines`、[create-vue](https://github.com/vuejs/create-vue) 和 [Vue Quick Start](https://vuejs.org/guide/quick-start.html) 为准，不要只依赖旧教程中的 Node 版本。

先检查环境：

```bash
node -v
npm -v
```

### 2.2 创建项目

```bash
npm create vue@latest
```

建议初学时选择：

```text
Project name: task-board
Add TypeScript: Yes
Add JSX Support: No
Add Vue Router: Yes
Add Pinia: Yes
Add Vitest: Yes
Add an End-to-End Testing Solution: No
Add ESLint: Yes
Add Prettier: Yes
```

进入项目并启动：

```bash
cd task-board
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

构建产物默认位于 `dist/`。

### 2.3 为什么不再从 Vue CLI 开始

Vue CLI 已进入维护模式，新项目官方推荐 `create-vue + Vite`。旧项目仍可维护，但没有必要让新手先学习一套不再推荐的新建流程。

Vite 的开发体验来自：

```text
浏览器原生 ESM
      +
按需转换当前请求模块
      +
依赖预构建与高效 HMR
```

它并不是“完全不打包”。开发阶段和生产构建阶段的工作方式不同。

---

## 3. 一个最小单文件组件

Vue 单文件组件通常由三部分组成：

```vue
<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <button type="button" @click="count++">
    已点击 {{ count }} 次
  </button>
</template>

<style scoped>
button {
  border: 1px solid #1f6f5f;
  border-radius: 8px;
  padding: 8px 12px;
}
</style>
```

- `<script setup>`：声明组件逻辑；
- `<template>`：声明视图结构；
- `<style scoped>`：声明当前组件样式。

模板里使用 `ref` 时不需要写 `.value`；脚本里需要：

```ts
count.value++
```

---

## 4. Options API 与 Composition API

### 4.1 Options API

Options API 按选项类型组织代码：

```ts
export default {
  data() {
    return {
      keyword: '',
    }
  },
  computed: {
    normalizedKeyword(): string {
      return this.keyword.trim().toLowerCase()
    },
  },
  methods: {
    clearKeyword() {
      this.keyword = ''
    },
  },
}
```

它直观、稳定，小组件完全可以继续使用。

### 4.2 Composition API

Composition API 按业务能力组织代码：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

const keyword = ref('')

const normalizedKeyword = computed(() =>
  keyword.value.trim().toLowerCase(),
)

function clearKeyword() {
  keyword.value = ''
}
</script>
```

优势主要体现在：

- 同一功能的状态、计算和操作可以放在一起；
- 逻辑可以提取成组合式函数；
- TypeScript 推断更直接；
- 大组件拆分更自然。

不要把它理解成“Options API 已被废弃”。两套 API 都是 Vue 3 的正式能力，只是新项目和课程示例通常优先使用 Composition API。

---

## 5. setup 与 script setup

### 5.1 传统 setup

```ts
import { defineComponent, ref } from 'vue'

export default defineComponent({
  setup() {
    const count = ref(0)

    function increment() {
      count.value++
    }

    return {
      count,
      increment,
    }
  },
})
```

只有返回的内容才能在模板中使用。

### 5.2 script setup

```vue
<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)

function increment() {
  count.value++
}
</script>
```

顶层声明会自动暴露给模板，不需要手动 `return`。

### 5.3 组件名称

大多数时候，组件名称可以从文件名推断。如果确实需要显式名称，可使用：

```vue
<script setup lang="ts">
defineOptions({
  name: 'TaskBoard',
})
</script>
```

不需要再安装只为设置名称存在的第三方插件。`defineOptions` 的说明见 [`<script setup>` API](https://vuejs.org/api/sfc-script-setup.html#defineoptions)。

---

## 6. ref：基本类型和可替换对象

### 6.1 基本类型

```ts
import { ref } from 'vue'

const keyword = ref('')
const page = ref(1)
const loading = ref(false)

keyword.value = 'TypeScript'
page.value++
loading.value = true
```

`ref` 返回的是带 `.value` 的响应式容器：

```ts
interface Ref<T> {
  value: T
}
```

模板会自动解包：

```vue
<template>
  <p>关键词：{{ keyword }}</p>
  <button @click="page++">下一页</button>
</template>
```

### 6.2 对象类型

```ts
interface TaskDraft {
  title: string
  tags: string[]
}

const draft = ref<TaskDraft>({
  title: '',
  tags: [],
})

draft.value.title = '学习 computed'
draft.value = {
  title: '学习 watch',
  tags: ['Vue'],
}
```

`ref` 包裹对象时，内部对象默认也会被深度转换为响应式对象。

适合使用 `ref` 的场景：

- 基本类型；
- 需要整体替换引用的对象；
- 需要在组合式函数之间传递统一容器；
- 模板引用。

---

## 7. reactive：对象状态

### 7.1 创建响应式对象

```ts
import { reactive } from 'vue'

const filter = reactive({
  keyword: '',
  status: 'todo' as TaskStatus,
  tags: [] as string[],
})

filter.keyword = 'Vue'
filter.tags.push('TypeScript')
```

`reactive` 返回原对象的 Proxy。

### 7.2 不要随意整体替换

下面的代码会让变量指向另一个普通对象：

```ts
let filter = reactive({
  keyword: '',
  status: 'todo',
})

// 不推荐：旧 Proxy 上的订阅关系不会跟着变量走
filter = {
  keyword: 'Vue',
  status: 'doing',
}
```

可以使用 `Object.assign` 更新：

```ts
Object.assign(filter, {
  keyword: 'Vue',
  status: 'doing',
})
```

如果业务上经常整体替换对象，直接使用 `ref` 更清晰。

### 7.3 ref 与 reactive 怎么选

| 情况 | 建议 |
|---|---|
| 字符串、数字、布尔值 | `ref` |
| 需要整体替换对象 | `ref` |
| 一组稳定存在的表单字段 | `reactive` |
| 组合式函数需要返回单个状态 | `ref` |
| Pinia Setup Store | 两者都可，按语义选择 |

不要为了“统一风格”强迫所有数据只用其中一个。

---

## 8. toRef 与 toRefs

### 8.1 解构 reactive 会发生什么

```ts
const filter = reactive({
  keyword: '',
  page: 1,
})

const { keyword, page } = filter
```

这里得到的是当前值，普通解构不会自动建立新的 ref 联系。

### 8.2 使用 toRefs

```ts
import { reactive, toRefs } from 'vue'

const filter = reactive({
  keyword: '',
  page: 1,
})

const { keyword, page } = toRefs(filter)

keyword.value = 'Vue'
page.value++
```

### 8.3 使用 toRef

```ts
import { toRef } from 'vue'

const keyword = toRef(filter, 'keyword')
```

`toRef` 适合只提取一个属性，`toRefs` 适合批量暴露一个响应式对象。

---

## 9. computed：从已有状态推导新状态

### 9.1 只读计算属性

```ts
import { computed, ref } from 'vue'

const firstName = ref('Wei')
const lastName = ref('Yang')

const fullName = computed(() =>
  `${firstName.value} ${lastName.value}`,
)
```

计算属性具有缓存：

- 依赖没有变化时，多次访问复用结果；
- 依赖变化后，下次访问重新计算。

适合：

- 列表过滤与排序；
- 状态文案；
- 表单校验结果；
- 汇总数字；
- 从 Store 派生页面数据。

### 9.2 可写计算属性

```ts
const fullName = computed({
  get() {
    return `${firstName.value} ${lastName.value}`
  },
  set(value: string) {
    const [first = '', last = ''] = value.split(' ')
    firstName.value = first
    lastName.value = last
  },
})
```

可写计算属性适合在“一个显示值对应多个底层状态”时建立双向映射。不要在只读场景中为了少写一个函数而滥用 setter。

### 9.3 任务过滤示例

```ts
const tasks = ref<Task[]>([])
const keyword = ref('')
const selectedStatus = ref<TaskStatus | 'all'>('all')

const visibleTasks = computed(() => {
  const normalized = keyword.value.trim().toLowerCase()

  return tasks.value.filter((task) => {
    const matchesKeyword =
      !normalized || task.title.toLowerCase().includes(normalized)
    const matchesStatus =
      selectedStatus.value === 'all' ||
      task.status === selectedStatus.value

    return matchesKeyword && matchesStatus
  })
})
```

计算属性的 getter 应保持纯净，不要在里面发请求、写本地存储或修改其他状态。

---

## 10. watch：明确观察一个来源

### 10.1 观察 ref

```ts
import { ref, watch } from 'vue'

const keyword = ref('')

watch(keyword, (newValue, oldValue) => {
  console.log({ newValue, oldValue })
})
```

### 10.2 观察 reactive 的属性

```ts
const filter = reactive({
  keyword: '',
  page: 1,
})

watch(
  () => filter.page,
  (page) => {
    console.log('当前页：', page)
  },
)
```

不要直接写 `watch(filter.page, ...)`，因为传进去的只是当前数字，不是响应式来源。

### 10.3 观察多个来源

```ts
watch(
  [keyword, selectedStatus],
  ([newKeyword, newStatus], [oldKeyword, oldStatus]) => {
    console.log({
      newKeyword,
      newStatus,
      oldKeyword,
      oldStatus,
    })
  },
)
```

### 10.4 立即、一次与深度观察

```ts
watch(
  keyword,
  () => {
    // ...
  },
  {
    immediate: true,
    once: false,
  },
)
```

Vue 3.5 还允许给 `deep` 传数字，限制最大遍历深度：

```ts
watch(
  () => filter,
  () => {
    // ...
  },
  { deep: 2 },
)
```

深度观察需要遍历对象，数据量大时应谨慎。很多场景观察明确 getter 比 `deep: true` 更便宜。

### 10.5 清理过期副作用

关键词连续变化时，旧定时任务应该取消：

```ts
import { onWatcherCleanup, watch } from 'vue'

watch(keyword, (value) => {
  const timer = window.setTimeout(() => {
    console.log('开始搜索：', value)
  }, 300)

  onWatcherCleanup(() => {
    window.clearTimeout(timer)
  })
})
```

如果是本地接口请求，可以用同样方式取消旧请求：

```ts
watch(keyword, async (value) => {
  const controller = new AbortController()

  onWatcherCleanup(() => {
    controller.abort()
  })

  const response = await fetch(
    `/api/tasks?keyword=${encodeURIComponent(value)}`,
    { signal: controller.signal },
  )

  tasks.value = await response.json()
})
```

`onWatcherCleanup` 必须在同步执行阶段注册，不能放到 `await` 之后。详见 [Watchers](https://vuejs.org/guide/essentials/watchers.html#side-effect-cleanup)。

---

## 11. watchEffect：自动收集依赖

```ts
import { watchEffect } from 'vue'

watchEffect(() => {
  document.title =
    `${visibleTasks.value.length} 条任务 - ${keyword.value || '全部'}`
})
```

和 `watch` 的区别：

| 能力 | `watch` | `watchEffect` |
|---|---|---|
| 依赖来源 | 显式声明 | 同步执行时自动收集 |
| 默认执行 | 依赖变化后 | 立即执行一次 |
| 新旧值 | 可以获取 | 不直接提供 |
| 控制精度 | 更高 | 更简洁 |

选择原则：

- 需要明确来源、新旧值、触发选项：`watch`；
- 副作用使用的依赖就是需要观察的依赖：`watchEffect`；
- 可以用 `computed` 表达的派生值，不要用 watcher 手动同步。

异步 `watchEffect` 只会收集第一个 `await` 之前读取的依赖。

---

## 12. Props 与事件

### 12.1 类型化 Props

子组件 `TaskItem.vue`：

```vue
<script setup lang="ts">
import type { Task } from '@/types/task'

interface Props {
  task: Task
  compact?: boolean
}

const { task, compact = false } = defineProps<Props>()
</script>

<template>
  <article :class="{ compact }">
    <strong>{{ task.title }}</strong>
    <span>{{ task.status }}</span>
  </article>
</template>
```

Vue 3.5 中，`<script setup>` 内直接解构 `defineProps` 得到的变量会保持响应性，并可使用 JavaScript 原生默认值。旧项目在 Vue 3.4 及以前需要使用 `withDefaults` 或保留 `props.xxx` 访问。详见 [Props](https://vuejs.org/guide/components/props.html#reactive-props-destructure)。

Props 是单向下行数据：

- 父组件拥有数据；
- 子组件读取 Props；
- 子组件不应直接修改父组件的对象状态；
- 修改意图通过事件上报。

### 12.2 类型化事件

```vue
<script setup lang="ts">
import type { Task, TaskStatus } from '@/types/task'

defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  remove: [id: number]
  'status-change': [id: number, status: TaskStatus]
}>()
</script>

<template>
  <button type="button" @click="emit('remove', task.id)">
    删除
  </button>
</template>
```

父组件监听：

```vue
<TaskItem
  v-for="task in tasks"
  :key="task.id"
  :task="task"
  @remove="removeTask"
  @status-change="changeStatus"
/>
```

子传父优先使用自定义事件，而不是把父组件函数塞进 Props。事件能更清楚地表达“子组件发出了什么”，并降低组件耦合。

---

## 13. 模板引用 useTemplateRef

Vue 的声明式渲染可以覆盖大部分场景，但聚焦输入框、测量 DOM 或调用子组件公开方法时仍需要模板引用。

```vue
<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'

const titleInput = useTemplateRef<HTMLInputElement>('title-input')

onMounted(() => {
  titleInput.value?.focus()
})
</script>

<template>
  <input ref="title-input" aria-label="任务标题" />
</template>
```

`useTemplateRef` 在 Vue 3.5 引入，配合当前 `Vue - Official` 和 `vue-tsc` 可以获得更好的类型推断。详见 [Template Refs](https://vuejs.org/guide/essentials/template-refs.html)。

子组件默认不会把 `<script setup>` 内部状态全部暴露给父组件。确实需要时显式声明：

```vue
<script setup lang="ts">
function focusTitle() {
  // ...
}

defineExpose({
  focusTitle,
})
</script>
```

只暴露最小能力，不要把整个子组件变成父组件可随意操作的对象。

---

## 14. 生命周期

常用生命周期：

```ts
import {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
} from 'vue'

onBeforeMount(() => {
  console.log('挂载前')
})

onMounted(() => {
  console.log('DOM 已挂载')
})

onBeforeUpdate(() => {
  console.log('组件更新前')
})

onUpdated(() => {
  console.log('组件更新后')
})

onBeforeUnmount(() => {
  console.log('卸载前')
})

onUnmounted(() => {
  console.log('已卸载')
})
```

常见用途：

- `onMounted`：需要真实 DOM 的初始化；
- `onUnmounted`：清理定时器、事件监听和第三方实例；
- `onUpdated`：更新后读取 DOM，但应避免在里面继续无条件修改状态。

在 `<script setup>` 中不要机械地把所有初始化都塞进 `onMounted`。不依赖 DOM 的同步状态可以直接声明，异步业务应由明确函数或组合式函数管理。

---

## 15. 自定义组合式函数

组合式函数以 `use` 开头，用来封装有状态的可复用逻辑。

### 15.1 useTaskFilter

```ts
import { computed, ref, type Ref } from 'vue'
import type { Task, TaskStatus } from '@/types/task'

export function useTaskFilter(tasks: Ref<Task[]>) {
  const keyword = ref('')
  const status = ref<TaskStatus | 'all'>('all')

  const visibleTasks = computed(() => {
    const normalized = keyword.value.trim().toLowerCase()

    return tasks.value.filter((task) => {
      const matchesKeyword =
        !normalized ||
        task.title.toLowerCase().includes(normalized)
      const matchesStatus =
        status.value === 'all' ||
        task.status === status.value

      return matchesKeyword && matchesStatus
    })
  })

  function resetFilter() {
    keyword.value = ''
    status.value = 'all'
  }

  return {
    keyword,
    status,
    visibleTasks,
    resetFilter,
  }
}
```

组件中使用：

```ts
const tasks = ref<Task[]>([])

const {
  keyword,
  status,
  visibleTasks,
  resetFilter,
} = useTaskFilter(tasks)
```

### 15.2 好的组合式函数具备什么

1. 名称表达能力，而不是表达技术细节；
2. 输入和输出类型清楚；
3. 副作用有明确生命周期和清理；
4. 不偷偷依赖某个页面全局变量；
5. 返回 ref 时保留响应性，不随意解包成普通值。

---

## 16. 完整组件：任务筛选面板

```vue
<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { Task, TaskStatus } from '@/types/task'

const tasks = ref<Task[]>([
  {
    id: 1,
    title: '学习 TypeScript 类型收窄',
    status: 'done',
    tags: ['TypeScript'],
    createdAt: '2026-07-29',
  },
  {
    id: 2,
    title: '学习 Vue computed',
    status: 'doing',
    tags: ['Vue'],
    createdAt: '2026-07-29',
  },
])

const keyword = ref('')
const status = ref<TaskStatus | 'all'>('all')
const keywordInput = useTemplateRef<HTMLInputElement>('keyword-input')

const visibleTasks = computed(() => {
  const normalized = keyword.value.trim().toLowerCase()

  return tasks.value.filter((task) => {
    const keywordMatched =
      task.title.toLowerCase().includes(normalized)
    const statusMatched =
      status.value === 'all' || task.status === status.value

    return keywordMatched && statusMatched
  })
})

function reset() {
  keyword.value = ''
  status.value = 'all'
  keywordInput.value?.focus()
}
</script>

<template>
  <section>
    <h2>任务看板</h2>

    <label>
      搜索
      <input
        ref="keyword-input"
        v-model.trim="keyword"
        placeholder="输入任务标题"
      />
    </label>

    <label>
      状态
      <select v-model="status">
        <option value="all">全部</option>
        <option value="todo">待办</option>
        <option value="doing">进行中</option>
        <option value="done">已完成</option>
      </select>
    </label>

    <button type="button" @click="reset">
      重置
    </button>

    <p>共 {{ visibleTasks.length }} 条</p>

    <ul>
      <li v-for="task in visibleTasks" :key="task.id">
        {{ task.title }} - {{ task.status }}
      </li>
    </ul>
  </section>
</template>
```

这个组件已经覆盖：

- `ref`；
- `computed`；
- 模板自动解包；
- `v-model`；
- `useTemplateRef`；
- TypeScript 联合类型；
- 列表渲染与稳定 `key`。

---

## 17. 本篇小结

1. 新项目使用 `create-vue + Vite`，不再从 Vue CLI 开始。
2. Options API 没有废弃，Composition API 更适合组织复杂业务。
3. 脚本里访问 `ref` 使用 `.value`，模板会自动解包。
4. 稳定对象字段可用 `reactive`，需要整体替换时优先 `ref`。
5. 派生值使用 `computed`，副作用才使用 `watch` 或 `watchEffect`。
6. Props 向下、事件向上，不直接修改父组件状态。
7. Vue 3.5 使用响应式 Props 解构和 `useTemplateRef`。
8. 可复用的有状态逻辑提取成组合式函数。

下一篇把任务看板扩展成多页面应用，并加入集中状态管理和组件通信：

[Vue 3 + TypeScript 快速上手（中）：Router、Pinia 与组件通信](#/article/content%2Flearning%2Ffrontend%2F2026-07-29-03-vue3-router-pinia-communication.md)

## 参考资料

- [尚硅谷 Vue3 教程](https://www.atguigu.com/video/284/)
- [Vue Quick Start](https://vuejs.org/guide/quick-start.html)
- [create-vue](https://github.com/vuejs/create-vue)
- [Reactivity Fundamentals](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)
- [Computed Properties](https://vuejs.org/guide/essentials/computed.html)
- [Watchers](https://vuejs.org/guide/essentials/watchers.html)
- [Props](https://vuejs.org/guide/components/props.html)
- [Template Refs](https://vuejs.org/guide/essentials/template-refs.html)
- [Composables](https://vuejs.org/guide/reusability/composables.html)
