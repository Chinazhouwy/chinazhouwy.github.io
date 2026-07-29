---
title: "Vue 3 + TypeScript 快速上手（中）：Router、Pinia 与组件通信"
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
summary: "用 Vue Router 组织页面、用 Pinia 管理共享状态，并通过 Props、事件、defineModel、provide/inject 和插槽建立清晰的组件通信边界。"
tags:
  - Vue 3
  - TypeScript
  - Vue Router
  - Pinia
  - 组件通信
  - 尚硅谷
---

# Vue 3 + TypeScript 快速上手（中）：Router、Pinia 与组件通信

> **来源说明：** 本文参考尚硅谷《Vue3 快速上手》课程资料，在保留分步骤编码风格的基础上，按当前 Vue Router、Pinia 与 Vue 3.5 API 重新编写。原课程及资料版权归尚硅谷及相关作者所有。
>
> **重写范围：** 不再使用远程随机内容接口；修正旧版 `v-model` 写法；不把函数型 Props、`$parent` 或全局事件总线作为默认通信方案。
>
> **版本基线：** 2026-07-29。核心示例使用 Vue 3.5.40、Vue Router 5.2.0、Pinia 4.0.2 和 `create-vue` 官方模板锁定的 TypeScript 6.0.x 进行编译检查。

系列上一篇：

[Vue 3 + TypeScript 快速上手（上）：Vite、Composition API 与响应式](#/article/content%2Flearning%2Ffrontend%2F2026-07-29-02-vue3-typescript-reactivity.md)

## 0. 这一篇解决什么问题

上一节的任务看板只有一个组件。真实应用很快会遇到三个问题：

1. 首页、任务列表、任务详情如何切换？
2. 多个页面如何共享任务数据？
3. 父子、祖孙和跨页面组件如何通信？

对应方案是：

```text
URL 与页面关系       -> Vue Router
跨页面业务状态       -> Pinia
局部组件协作         -> Props / Emits / v-model / provide
内容结构的控制权     -> Slots
```

---

## 1. Vue Router 基础

### 1.1 路由是什么

单页应用中，浏览器通常只加载一次主 HTML。之后 URL 变化由前端路由器解释，再渲染对应组件：

```text
/tasks          -> TaskListView
/tasks/1001     -> TaskDetailView
/settings       -> SettingsView
```

路由不只是“切组件”，还负责：

- URL 与页面状态映射；
- 前进、后退历史；
- 动态参数；
- 嵌套路由；
- 导航守卫；
- 懒加载；
- 页面级权限入口。

### 1.2 安装与注册

如果创建项目时没有选择 Router：

```bash
npm install vue-router
```

`src/router/index.ts`：

```ts
import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: { name: 'tasks' },
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('@/views/TaskListView.vue'),
  },
  {
    path: '/tasks/:id',
    name: 'task-detail',
    component: () => import('@/views/TaskDetailView.vue'),
    props: true,
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
  },
] satisfies RouteRecordRaw[]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
```

`satisfies RouteRecordRaw[]` 会检查路由配置结构，同时尽量保留配置对象自身的精确推断。

`src/main.ts`：

```ts
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

createApp(App)
  .use(router)
  .mount('#app')
```

`App.vue`：

```vue
<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header>
    <nav aria-label="主导航">
      <RouterLink :to="{ name: 'tasks' }">
        任务
      </RouterLink>
      <RouterLink :to="{ name: 'settings' }">
        设置
      </RouterLink>
    </nav>
  </header>

  <main>
    <RouterView />
  </main>
</template>
```

---

## 2. 路由跳转的两种方式

### 2.1 声明式导航

```vue
<RouterLink to="/tasks">
  任务列表
</RouterLink>
```

使用命名路由更适合重构：

```vue
<RouterLink
  :to="{
    name: 'task-detail',
    params: { id: task.id },
  }"
>
  {{ task.title }}
</RouterLink>
```

### 2.2 编程式导航

```ts
import { useRouter } from 'vue-router'

const router = useRouter()

async function openTask(id: number) {
  await router.push({
    name: 'task-detail',
    params: { id },
  })
}
```

常见方法：

```ts
router.push({ name: 'tasks' })
router.replace({ name: 'tasks' })
router.back()
router.forward()
router.go(-2)
```

- `push`：增加一条历史记录；
- `replace`：替换当前记录；
- 登录跳转、无意义中间页通常适合 `replace`。

---

## 3. params、query 与 props

### 3.1 动态 params

路由定义：

```ts
{
  path: '/tasks/:id',
  name: 'task-detail',
  component: () => import('@/views/TaskDetailView.vue'),
}
```

读取参数：

```ts
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const taskId = computed(() => {
  const rawId = route.params.id
  const value = Array.isArray(rawId) ? rawId[0] : rawId
  const parsed = Number(value)

  return Number.isInteger(parsed) ? parsed : null
})
```

URL 参数来自外部输入，不能因为 TypeScript 写了 `number` 就跳过运行时校验。

### 3.2 query 参数

```ts
router.push({
  name: 'tasks',
  query: {
    status: 'doing',
    keyword: 'Vue',
  },
})
```

适合放在 query 中的状态：

- 搜索关键词；
- 筛选条件；
- 排序方式；
- 页码；
- 可以被复制和分享的页面视图状态。

敏感数据、复杂对象和体积很大的状态不应塞进 URL。

### 3.3 使用 props 降低组件耦合

路由：

```ts
{
  path: '/tasks/:id',
  name: 'task-detail',
  component: () => import('@/views/TaskDetailView.vue'),
  props: (route) => ({
    taskId: Number(route.params.id),
  }),
}
```

页面组件：

```vue
<script setup lang="ts">
defineProps<{
  taskId: number
}>()
</script>
```

这样组件只依赖 `taskId`，不直接依赖整个 Router，测试和复用更容易。

---

## 4. 嵌套路由

任务详情下面还有概览和活动记录：

```ts
{
  path: '/tasks/:id',
  component: () => import('@/views/TaskLayout.vue'),
  props: true,
  children: [
    {
      path: '',
      name: 'task-detail',
      component: () => import('@/views/TaskOverviewView.vue'),
    },
    {
      path: 'activity',
      name: 'task-activity',
      component: () => import('@/views/TaskActivityView.vue'),
    },
  ],
}
```

父级 `TaskLayout.vue` 必须提供子路由出口：

```vue
<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <section>
    <nav aria-label="任务详情导航">
      <RouterLink
        :to="{
          name: 'task-detail',
          params: { id: route.params.id },
        }"
      >
        概览
      </RouterLink>
      <RouterLink
        :to="{
          name: 'task-activity',
          params: { id: route.params.id },
        }"
      >
        活动
      </RouterLink>
    </nav>

    <RouterView />
  </section>
</template>
```

嵌套路由表达的是页面布局关系，不要只为了少写几个 URL 就强行嵌套。

---

## 5. History 模式

### 5.1 HTML5 History

```ts
createWebHistory(import.meta.env.BASE_URL)
```

URL 更自然：

```text
https://example.com/tasks/1001
```

但服务器必须把未知前端路由回退到 `index.html`。否则直接刷新 `/tasks/1001` 会得到 404。

Nginx 常见配置：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 5.2 Hash History

```ts
createWebHashHistory(import.meta.env.BASE_URL)
```

URL：

```text
https://example.com/#/tasks/1001
```

`#` 后面的内容不会作为普通路径发送给服务器，因此静态托管配置更简单。

选择原则：

- 能控制服务器回退规则：优先 HTML5 History；
- 纯静态文件且无法配置回退：Hash History 更稳妥。

---

## 6. 导航守卫

给需要认证的路由加元信息：

```ts
{
  path: '/settings',
  name: 'settings',
  component: () => import('@/views/SettingsView.vue'),
  meta: {
    requiresAuth: true,
  },
}
```

全局守卫：

```ts
router.beforeEach((to) => {
  const signedIn = Boolean(localStorage.getItem('access_token'))

  if (to.meta.requiresAuth && !signedIn) {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath,
      },
    }
  }
})
```

注意：

- 前端守卫只改善用户体验，不是安全边界；
- 服务端仍必须校验身份和权限；
- 不要在守卫里堆积全部数据加载逻辑；
- 异步守卫应明确处理异常和取消。

完整规则见 [Vue Router Guide](https://router.vuejs.org/guide/)。

---

## 7. Pinia 基础

### 7.1 Pinia 解决什么问题

当状态只属于一个组件时，留在组件里最简单。

需要 Pinia 的典型信号：

- 多个路由页面共享任务；
- 多个远距离组件读写同一状态；
- 状态有明确业务动作；
- 需要 DevTools、订阅、插件或统一测试。

不要因为“项目用了 Vue”就把每个输入框都放进全局 Store。

### 7.2 安装与注册

```bash
npm install pinia
```

`src/main.ts`：

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
```

---

## 8. 定义任务 Store

### 8.1 Setup Store

`src/stores/task.ts`：

```ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { NewTask, Task, TaskStatus } from '@/types/task'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([
    {
      id: 1,
      title: '学习 Vue Router',
      status: 'doing',
      tags: ['Vue'],
      createdAt: '2026-07-29',
    },
  ])

  const completedCount = computed(
    () => tasks.value.filter((task) => task.status === 'done').length,
  )

  function addTask(input: NewTask): Task {
    const task: Task = {
      id: Date.now(),
      title: input.title.trim(),
      status: 'todo',
      tags: [...input.tags],
      createdAt: new Date().toISOString(),
    }

    tasks.value.push(task)
    return task
  }

  function changeStatus(id: number, status: TaskStatus): void {
    const task = tasks.value.find((item) => item.id === id)

    if (task) {
      task.status = status
    }
  }

  function removeTask(id: number): void {
    tasks.value = tasks.value.filter((task) => task.id !== id)
  }

  function findTask(id: number): Task | undefined {
    return tasks.value.find((task) => task.id === id)
  }

  return {
    tasks,
    completedCount,
    addTask,
    changeStatus,
    removeTask,
    findTask,
  }
})
```

对应关系：

```text
ref / reactive     -> state
computed           -> getter
function           -> action
```

### 8.2 组件中使用

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTaskStore } from '@/stores/task'

const taskStore = useTaskStore()
const { tasks, completedCount } = storeToRefs(taskStore)

function remove(id: number) {
  taskStore.removeTask(id)
}
</script>
```

为什么不直接解构：

```ts
// 不推荐：普通解构会丢失 state/getter 的响应式连接
const { tasks, completedCount } = taskStore
```

规则：

- state 和 getter 使用 `storeToRefs`；
- action 直接从 Store 调用或解构，函数本身不需要转成 ref。

---

## 9. 修改 Store 数据

### 9.1 调用 Action

```ts
taskStore.changeStatus(1, 'done')
```

业务修改优先放在有语义的 Action 中，便于复用、测试和记录。

### 9.2 直接修改

```ts
taskStore.tasks.push(newTask)
```

Pinia 允许直接修改 State。简单局部操作可以这样做，但复杂业务规则仍应收敛到 Action。

### 9.3 $patch

对象形式：

```ts
taskStore.$patch({
  tasks: [],
})
```

函数形式适合多个变更：

```ts
taskStore.$patch((state) => {
  state.tasks.push(newTask)
  state.tasks.sort((a, b) => b.id - a.id)
})
```

不要为了使用 `$patch` 把清晰的业务动作改成一堆无语义字段更新。

---

## 10. Store 订阅与本地持久化

```ts
const taskStore = useTaskStore()

const unsubscribe = taskStore.$subscribe(
  (_mutation, state) => {
    localStorage.setItem(
      'task-board.tasks',
      JSON.stringify(state.tasks),
    )
  },
  { detached: true },
)
```

恢复数据时，先把本地存储当作 `unknown`：

```ts
function loadStoredTasks(): Task[] {
  const raw = localStorage.getItem('task-board.tasks')

  if (!raw) {
    return []
  }

  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter(isTask) : []
  } catch {
    return []
  }
}
```

本地持久化注意点：

- 数据结构需要版本号和迁移策略；
- 不存 access token、密码等敏感信息；
- `localStorage` 不是服务端真相；
- SSR 环境不能在模块顶层直接访问 `window`；
- 复杂持久化可以使用 Pinia 插件，但要先理解恢复时机。

完整概念见 [Pinia Core Concepts](https://pinia.vuejs.org/core-concepts/)。

---

## 11. 组件通信先做选择

| 关系 | 首选方式 | 说明 |
|---|---|---|
| 父传子 | Props | 子组件读取父组件数据 |
| 子传父 | Emits | 子组件上报发生的事件 |
| 父子双向表单 | `defineModel` | 明确的双向绑定契约 |
| 祖先传后代 | provide / inject | 避免多层 Props 透传 |
| 跨页面共享业务状态 | Pinia | 明确 Store 与 Action |
| 父组件控制内容结构 | Slots | 数据与渲染结构解耦 |
| 透传 HTML 属性 | `$attrs` | 包装组件透传属性和事件 |
| 直接操作 DOM/子组件能力 | Template Ref | 仅作为命令式逃生口 |

通信方式不是越多越好。先判断数据归谁拥有，再决定如何传递。

---

## 12. Props 与 Emits

父组件拥有任务：

```vue
<TaskItem
  v-for="task in tasks"
  :key="task.id"
  :task="task"
  @remove="removeTask"
  @status-change="changeStatus"
/>
```

子组件声明契约：

```vue
<script setup lang="ts">
import type { Task, TaskStatus } from '@/types/task'

const { task } = defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  remove: [id: number]
  'status-change': [id: number, status: TaskStatus]
}>()
</script>

<template>
  <article>
    <strong>{{ task.title }}</strong>

    <button
      type="button"
      @click="emit('status-change', task.id, 'done')"
    >
      完成
    </button>

    <button
      type="button"
      @click="emit('remove', task.id)"
    >
      删除
    </button>
  </article>
</template>
```

父组件不要把 `removeTask` 当作 Props 传下去让子组件直接调用。事件更清楚地表达子组件的职责边界。

---

## 13. defineModel 与组件 v-model

### 13.1 基本用法

输入组件 `TaskTitleInput.vue`：

```vue
<script setup lang="ts">
const title = defineModel<string>({
  required: true,
})
</script>

<template>
  <input
    v-model.trim="title"
    maxlength="80"
    placeholder="输入任务标题"
  />
</template>
```

父组件：

```vue
<TaskTitleInput v-model="draft.title" />
```

从 Vue 3.4 开始，`defineModel` 是组件双向绑定的推荐写法。

### 13.2 底层契约

默认 `v-model` 本质上对应：

```text
Prop:  modelValue
Event: update:modelValue
```

旧写法仍然需要理解：

```vue
<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <input
    :value="props.modelValue"
    @input="
      emit(
        'update:modelValue',
        ($event.target as HTMLInputElement).value,
      )
    "
  />
</template>
```

注意事件名是 `update:modelValue`。模板属性可以使用 kebab-case，但 TypeScript 声明和底层契约不要写错。

### 13.3 多个 v-model

```vue
<script setup lang="ts">
const title = defineModel<string>('title', { required: true })
const status = defineModel<TaskStatus>('status', { required: true })
</script>
```

父组件：

```vue
<TaskEditor
  v-model:title="draft.title"
  v-model:status="draft.status"
/>
```

完整规则见 [Component v-model](https://vuejs.org/guide/components/v-model.html)。

---

## 14. provide 与 inject

### 14.1 定义类型安全的注入键

`src/context/task-context.ts`：

```ts
import type { InjectionKey, Ref } from 'vue'
import type { Task } from '@/types/task'

export interface TaskContext {
  tasks: Readonly<Ref<Task[]>>
  removeTask: (id: number) => void
}

export const taskContextKey: InjectionKey<TaskContext> =
  Symbol('task-context')
```

### 14.2 祖先组件提供能力

```ts
import { readonly, ref, provide } from 'vue'
import { taskContextKey } from '@/context/task-context'

const tasks = ref<Task[]>([])

function removeTask(id: number) {
  tasks.value = tasks.value.filter((task) => task.id !== id)
}

provide(taskContextKey, {
  tasks: readonly(tasks),
  removeTask,
})
```

### 14.3 后代组件注入

```ts
import { inject } from 'vue'
import { taskContextKey } from '@/context/task-context'

const taskContext = inject(taskContextKey)

if (!taskContext) {
  throw new Error('TaskContext is not provided')
}
```

设计原则：

- 状态尽量由提供方修改；
- 注入方通过暴露的方法表达意图；
- 使用 `InjectionKey` 避免字符串冲突并获得类型；
- 局部组件树上下文用 provide/inject；
- 全应用共享业务状态通常使用 Pinia。

---

## 15. Slots：把数据交给使用者渲染

### 15.1 默认插槽

`Panel.vue`：

```vue
<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <section class="panel">
    <h2>{{ title }}</h2>
    <slot />
  </section>
</template>
```

使用：

```vue
<Panel title="今日任务">
  <TaskList :tasks="tasks" />
</Panel>
```

### 15.2 具名插槽

```vue
<template>
  <section class="panel">
    <header>
      <h2>{{ title }}</h2>
      <slot name="actions" />
    </header>

    <slot />
  </section>
</template>
```

```vue
<Panel title="今日任务">
  <template #actions>
    <button type="button">新建任务</button>
  </template>

  <TaskList :tasks="tasks" />
</Panel>
```

### 15.3 作用域插槽

数据属于子组件，渲染方式由父组件决定：

```vue
<!-- TaskCollection.vue -->
<script setup lang="ts">
import type { Task } from '@/types/task'

defineProps<{
  tasks: Task[]
}>()
</script>

<template>
  <ul>
    <li v-for="task in tasks" :key="task.id">
      <slot name="task" :task="task">
        {{ task.title }}
      </slot>
    </li>
  </ul>
</template>
```

父组件：

```vue
<TaskCollection :tasks="tasks">
  <template #task="{ task }">
    <strong>{{ task.title }}</strong>
    <small>{{ task.status }}</small>
  </template>
</TaskCollection>
```

作用域插槽的核心关系：

```text
数据所有权：子组件
结构决定权：父组件
```

---

## 16. $attrs：包装组件的属性透传

`BaseInput.vue`：

```vue
<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

const model = defineModel<string>({ required: true })
</script>

<template>
  <label class="field">
    <span><slot name="label" /></span>
    <input v-model="model" v-bind="$attrs" />
  </label>
</template>
```

使用：

```vue
<BaseInput
  v-model="keyword"
  name="keyword"
  autocomplete="off"
  aria-describedby="keyword-help"
  @blur="validateKeyword"
>
  <template #label>搜索任务</template>
</BaseInput>
```

`$attrs` 包含没有被组件 Props 和 Emits 消费的属性与监听器。它适合包装原生控件，但不应被当作任意跨层数据通道。

---

## 17. 为什么不推荐 $parent 和随意暴露 $refs

`$parent` 让子组件直接知道父组件内部结构：

- 父组件一重构，子组件可能失效；
- 数据流变得难以追踪；
- 单元测试需要构造特定父组件；
- 组件无法独立复用。

模板引用也应只用于明确命令：

```ts
editorRef.value?.focus()
dialogRef.value?.open()
```

不要通过引用直接修改子组件的任意内部状态。优先级建议：

```text
Props / Emits / v-model
        ↓
provide / inject 或 Pinia
        ↓
最小化的 Template Ref 命令
        ↓
避免 $parent 式内部穿透
```

---

## 18. Router、Pinia 和组件边界如何配合

任务详情页可以这样组织：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/task'

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const { tasks } = storeToRefs(taskStore)

const taskId = computed(() => Number(route.params.id))
const task = computed(() =>
  tasks.value.find((item) => item.id === taskId.value),
)

async function removeCurrentTask() {
  if (!task.value) {
    return
  }

  taskStore.removeTask(task.value.id)
  await router.replace({ name: 'tasks' })
}
</script>

<template>
  <article v-if="task">
    <h1>{{ task.title }}</h1>
    <p>状态：{{ task.status }}</p>
    <button type="button" @click="removeCurrentTask">
      删除任务
    </button>
  </article>

  <p v-else>任务不存在</p>
</template>
```

边界关系：

- Router 提供“当前访问哪个任务”；
- Pinia 提供任务集合和业务动作；
- computed 把路由参数和 Store 状态组合成页面数据；
- 组件事件处理用户意图；
- 删除后由 Router 更新页面位置。

---

## 19. 本篇小结

1. Router 管理 URL 与页面的关系，不负责所有业务状态。
2. URL 参数是外部输入，读取后要做运行时校验。
3. HTML5 History 需要服务器回退到 `index.html`。
4. Pinia 用于真正需要跨组件、跨页面共享的状态。
5. State 和 Getter 用 `storeToRefs`，Action 保持普通函数。
6. 父传子用 Props，子传父用 Emits。
7. Vue 3.4+ 的双向组件绑定优先使用 `defineModel`。
8. provide/inject 适合局部组件树上下文，Pinia 适合应用级业务状态。
9. Slots 解耦数据与渲染结构，`$attrs` 适合包装组件。
10. `$parent` 和任意内部引用是高耦合逃生口，不是常规通信方案。

下一篇处理性能、浅层响应式、第三方对象、Teleport、异步组件、安全、测试与生产构建：

[Vue 3 + TypeScript 快速上手（下）：高级响应式与工程化](#/article/content%2Flearning%2Ffrontend%2F2026-07-29-04-vue3-advanced-engineering.md)

## 参考资料

- [尚硅谷 Vue3 教程](https://www.atguigu.com/video/284/)
- [Vue Router Guide](https://router.vuejs.org/guide/)
- [Pinia Core Concepts](https://pinia.vuejs.org/core-concepts/)
- [Component Events](https://vuejs.org/guide/components/events.html)
- [Component v-model](https://vuejs.org/guide/components/v-model.html)
- [Provide / Inject](https://vuejs.org/guide/components/provide-inject.html)
- [Slots](https://vuejs.org/guide/components/slots.html)
- [Fallthrough Attributes](https://vuejs.org/guide/components/attrs.html)
