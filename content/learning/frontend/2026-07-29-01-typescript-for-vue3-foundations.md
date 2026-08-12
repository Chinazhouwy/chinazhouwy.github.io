---
title: "TypeScript 极速梳理：Vue 3 开发所需的类型基础"
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
summary: "从类型推断、unknown、对象类型和泛型出发，补齐类型收窄、判别联合、工具类型与 satisfies，建立 Vue 3 开发所需的 TypeScript 基础。"
tags:
  - TypeScript
  - Vue 3
  - 前端
  - 类型系统
  - 尚硅谷
---

# TypeScript 极速梳理：Vue 3 开发所需的类型基础

> **来源说明：** 本文参考尚硅谷《Vue3 快速上手》课程配套的 TypeScript 学习资料，在保留“先概念、再编码、最后总结”的教学结构基础上，结合 TypeScript 官方文档进行了勘误、版本更新和二次编写。原课程及资料版权归尚硅谷及相关作者所有。
>
> **版本基线：** 2026-07-29。示例使用当前稳定版 TypeScript 7.0.2 编译，开启严格模式；后续小版本变化请以 [TypeScript Releases](https://github.com/microsoft/TypeScript/releases) 和 [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) 为准。
>
> **Vue 工程注意：** TypeScript 的最新稳定版不等于 Vue 工具链已经完成兼容。当前 `create-vue 3.23.0` 官方模板仍使用 TypeScript `~6.0.0`；在 `vue-tsc` 明确支持 TypeScript 7 之前，Vue 项目不要只为追新单独升级 TypeScript。本篇语法同时兼容 TypeScript 6.0。

## 0. 这一篇解决什么问题

学习 Vue 3 不需要先学完整个 TypeScript，但至少要能看懂下面这段代码：

```ts
type TaskStatus = 'todo' | 'doing' | 'done'

interface Task {
  id: number
  title: string
  status: TaskStatus
}

function updateTask<T extends keyof Task>(
  task: Task,
  key: T,
  value: Task[T],
): Task {
  return { ...task, [key]: value }
}
```

这里同时出现了：

- 字面量类型与联合类型；
- `interface`；
- 泛型约束；
- `keyof`；
- 索引访问类型 `Task[T]`。

本篇不追求罗列所有语法，而是先搭好 Vue 3 开发真正会用到的类型底盘。

---

## 1. 类型声明与类型推断

### 1.1 类型声明

类型声明用于明确告诉 TypeScript：一个值应该是什么类型。

```ts
let title: string = '学习 Vue 3'
let estimate: number = 30
let completed: boolean = false

function add(a: number, b: number): number {
  return a + b
}
```

如果给变量赋入不兼容的值，错误会在编译阶段出现：

```ts
let estimate: number = 30

// Type 'string' is not assignable to type 'number'
estimate = '四十分钟'
```

### 1.2 类型推断

能让 TypeScript 推断时，不必重复声明。

```ts
let title = '学习 Vue 3' // string
let estimate = 30       // number
const completed = false // false
```

注意 `let` 和 `const` 的差异：

```ts
let status = 'todo'   // string
const mode = 'focus'  // "focus"
```

`status` 以后可以被赋成其他字符串，所以推断为 `string`；`mode` 不会被重新赋值，因此可以保留更精确的字面量类型。

### 1.3 返回值是否需要显式声明

普通函数通常可以交给 TypeScript 推断：

```ts
function total(a: number, b: number) {
  return a + b // 推断为 number
}
```

公共函数、递归函数和重要业务边界建议显式声明返回值：

```ts
function findTask(id: number): Task | undefined {
  return tasks.find((task) => task.id === id)
}
```

这样函数实现即使被修改，公共契约也不会悄悄漂移。

---

## 2. 基础类型、字面量与联合类型

### 2.1 常见基础类型

```ts
const title: string = '完成 TypeScript 学习'
const estimate: number = 45
const completed: boolean = false
const taskId: bigint = 10001n
const token: symbol = Symbol('task')
const empty: null = null
const missing: undefined = undefined
```

正常开发时使用小写的 `string`、`number` 和 `boolean`。大写的 `String`、`Number`、`Boolean` 表示包装对象类型，通常不应拿来声明业务数据。

### 2.2 字面量类型

字面量类型不是“字符串”这么宽，而是“只能是这个字符串”。

```ts
let direction: 'next'

direction = 'next'
// direction = 'previous' // 报错
```

字面量类型单独使用价值有限，和联合类型组合后才真正实用：

```ts
type TaskStatus = 'todo' | 'doing' | 'done'

let status: TaskStatus = 'todo'
status = 'doing'
// status = 'deleted' // 报错
```

它比任意字符串更安全，也比数字常量更容易阅读。

### 2.3 数组与元组

普通数组只限制元素类型：

```ts
const tags: string[] = ['Vue', 'TypeScript']
const scores: Array<number> = [80, 90, 95]
```

元组同时描述每个位置的类型和结构：

```ts
type TaskTuple = [id: number, title: string, completed?: boolean]

const task: TaskTuple = [1, '学习 ref']
const finishedTask: TaskTuple = [2, '学习 reactive', true]
```

注意点：

- 元组可以包含可选元素和剩余元素；
- 元组默认仍是可变数组，不等于不可变数据；
- 需要只读时使用 `readonly` 或 `as const`。

```ts
const route = ['task', 1001] as const
// route[0] = 'user' // 报错
```

---

## 3. any、unknown、never 与 void

这四个类型经常被放在一起讲，但它们表达的是四件完全不同的事。

### 3.1 any：关闭检查

`any` 表示“放弃检查这个值”。

```ts
let payload: any = { title: '学习 Vue' }

payload.notExists.deep.call() // 编译器不会阻止
```

`any` 会像污染源一样向外扩散：

```ts
let unsafe: any = 100
let title: string = unsafe // 不报错，但运行时未必真是 string
```

适用场景：

- 迁移旧 JavaScript 项目时的临时过渡；
- 第三方库确实没有类型声明；
- 有明确边界，并计划尽快收紧类型。

不要把 `any` 当作“我暂时不知道”。暂时不知道应使用 `unknown`。

### 3.2 unknown：先检查，再使用

`unknown` 可以接收任意值，但使用前必须收窄类型。

```ts
function parseTask(input: unknown): string {
  if (
    typeof input === 'object' &&
    input !== null &&
    'title' in input &&
    typeof input.title === 'string'
  ) {
    return input.title
  }

  return '未知任务'
}
```

这非常适合：

- `JSON.parse` 后的数据；
- 本地存储内容；
- 接口响应；
- `catch` 捕获到的错误；
- 来自用户或第三方系统的输入。

### 3.3 never：不可能出现的值

`never` 表示某个位置不存在任何可能值。

函数如果永远不会正常结束，可以返回 `never`：

```ts
function fail(message: string): never {
  throw new Error(message)
}
```

`never` 更重要的用途是穷尽检查：

```ts
type TaskStatus = 'todo' | 'doing' | 'done'

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case 'todo':
      return '待办'
    case 'doing':
      return '进行中'
    case 'done':
      return '已完成'
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}
```

以后给 `TaskStatus` 新增成员却忘记处理时，编译器会在 `never` 这一行报警。

### 3.4 void：不使用函数返回值

`void` 最常用于描述“调用方不使用这个函数的返回值”。

```ts
function logTask(title: string): void {
  console.log(title)
}
```

不要把 `void` 简单理解成“空”或“等于 `undefined`”。它表达的是函数返回值契约，而不是 JavaScript 中又增加了一个空值。

回调中的 `void` 还有一个容易忽略的特点：

```ts
const numbers = [1, 2, 3]

numbers.forEach((item) => numbers.push(item))
```

`forEach` 接受返回 `void` 的回调，但回调实现仍可返回一个值；只是调用方承诺忽略它。具体规则可参考 [More on Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html#return-type-void)。

---

## 4. 对象类型：别只写 object

### 4.1 object 的范围太宽

`object` 只表示“非原始值”，数组和函数也符合：

```ts
let value: object

value = { title: '学习 Vue' }
value = ['Vue', 'TypeScript']
value = () => 'hello'
```

业务开发通常需要描述对象结构，而不是只说“它是个对象”。

```ts
type Task = {
  id: number
  title: string
  completed: boolean
  description?: string
}
```

### 4.2 可选属性、只读属性和索引签名

```ts
interface Task {
  readonly id: number
  title: string
  description?: string
}
```

- `readonly`：禁止通过当前类型修改属性；
- `?`：属性可以不存在；
- 两者都是编译期约束，不会自动冻结运行时对象。

需要动态键时可以使用索引签名：

```ts
interface TaskLabels {
  [name: string]: string
}

const labels: TaskLabels = {
  priority: 'P1',
  owner: 'WY',
}
```

如果键集合是有限的，优先使用联合类型配合 `Record`：

```ts
type TaskStatus = 'todo' | 'doing' | 'done'

const statusLabels: Record<TaskStatus, string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成',
}
```

这样漏写或多写状态都会报错。

---

## 5. type 与 interface 怎么选

### 5.1 它们都能描述对象结构

```ts
type TaskByType = {
  id: number
  title: string
}

interface TaskByInterface {
  id: number
  title: string
}
```

两者都可以约束对象，也都可以被类 `implements`：

```ts
type Named = {
  name: string
}

class User implements Named {
  constructor(public name: string) {}
}
```

所以“只有 interface 能限制类”是不准确的。

### 5.2 主要差异

`interface` 支持声明合并：

```ts
interface WindowConfig {
  theme: string
}

interface WindowConfig {
  locale: string
}

const config: WindowConfig = {
  theme: 'light',
  locale: 'zh-CN',
}
```

`type` 可以直接描述联合类型、元组、条件类型等：

```ts
type TaskStatus = 'todo' | 'doing' | 'done'
type TaskId = number | string
type Coordinate = [x: number, y: number]
```

实用选择：

- 描述可扩展的对象、公共库声明：优先 `interface`；
- 联合、元组、工具类型组合：使用 `type`；
- 项目内部保持一致，比争论谁“更高级”重要。

官方对对象类型的说明见 [Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html)。

---

## 6. 枚举还是 as const

### 6.1 enum 会进入运行时代码

`enum` 是 TypeScript 少数会生成额外 JavaScript 的特性：

```ts
enum TaskStatusEnum {
  Todo = 'todo',
  Doing = 'doing',
  Done = 'done',
}
```

它适合：

- 已经广泛使用枚举的项目；
- 需要运行时枚举对象；
- 与后端生成代码或既有协议保持一致。

### 6.2 对象 + as const

前端业务状态也常写成：

```ts
const TASK_STATUS = {
  TODO: 'todo',
  DOING: 'doing',
  DONE: 'done',
} as const

type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS]
```

现在：

- 运行时可以使用 `TASK_STATUS.DONE`；
- 类型层得到 `'todo' | 'doing' | 'done'`；
- JavaScript 输出就是一个普通对象。

不要机械地认为枚举一定错误。先判断是否需要运行时对象、是否要和既有代码兼容，再选方案。

---

## 7. 类、抽象类与属性修饰符

### 7.1 普通类

```ts
class TaskEntity {
  constructor(
    public readonly id: number,
    public title: string,
    private _completed = false,
  ) {}

  complete(): void {
    this._completed = true
  }

  get completed(): boolean {
    return this._completed
  }
}
```

常见修饰符：

| 修饰符 | 当前类 | 子类 | 类外部 |
|---|---:|---:|---:|
| `public` | 可以 | 可以 | 可以 |
| `protected` | 可以 | 可以 | 不可以 |
| `private` | 可以 | 不可以 | 不可以 |
| `readonly` | 构造后不可重新赋值 | 同左 | 同左 |

### 7.2 抽象类

抽象类不能直接实例化，可以同时包含普通实现和抽象契约：

```ts
abstract class TaskRepository {
  abstract save(task: Task): Promise<void>

  async saveAll(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      await this.save(task)
    }
  }
}

class MemoryTaskRepository extends TaskRepository {
  private tasks: Task[] = []

  async save(task: Task): Promise<void> {
    this.tasks.push(task)
  }
}
```

接口只描述结构，不携带方法实现；抽象类既能约束子类，也能复用实现和状态。

注意：TypeScript 的接口不是 Java 接口的简单复制。它还能描述属性、函数调用签名、构造签名和索引签名。

---

## 8. 泛型：让类型关系跟着输入走

### 8.1 最小泛型函数

```ts
function identity<T>(value: T): T {
  return value
}

const id = identity(100)        // number
const title = identity('Vue')   // string
```

如果改成 `any`，输入和输出之间的类型关系会丢失；泛型保留了这条关系。

### 8.2 泛型约束

```ts
interface WithId {
  id: number
}

function findById<T extends WithId>(
  list: T[],
  id: number,
): T | undefined {
  return list.find((item) => item.id === id)
}
```

`T extends WithId` 不是说 `T` 必须继承某个类，而是说它至少要具备 `id: number` 这个结构。

### 8.3 keyof 与索引访问类型

```ts
function updateTask<K extends keyof Task>(
  task: Task,
  key: K,
  value: Task[K],
): Task {
  return {
    ...task,
    [key]: value,
  }
}

const task: Task = {
  id: 1,
  title: '学习 TypeScript',
  completed: false,
}

updateTask(task, 'title', '学习 Vue 3')
updateTask(task, 'completed', true)
// updateTask(task, 'completed', 'yes') // 报错
```

这里的关系是：

```text
K 是 Task 的某个键
        ↓
value 必须是该键对应的值类型
```

更多组合类型方法见 [Creating Types from Types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)。

---

## 9. 类型收窄与判别联合

### 9.1 为什么要收窄

联合类型表示一个值有多种可能，使用前需要通过控制流排除不可能的分支：

```ts
function normalizeId(id: string | number): string {
  if (typeof id === 'number') {
    return String(id)
  }

  return id.trim()
}
```

常见收窄方式：

- `typeof`；
- `instanceof`；
- `in`；
- 相等判断；
- 自定义类型守卫；
- 判别联合。

### 9.2 判别联合

接口请求至少会经历加载、成功、失败三种状态：

```ts
type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }
```

使用时根据共同的 `status` 字段收窄：

```ts
function stateText(state: LoadState<Task[]>): string {
  switch (state.status) {
    case 'idle':
      return '尚未加载'
    case 'loading':
      return '加载中'
    case 'success':
      return `共 ${state.data.length} 条任务`
    case 'error':
      return state.message
  }
}
```

它比下面这种“多个互相矛盾的布尔值”更可靠：

```ts
interface FragileState {
  loading: boolean
  success: boolean
  error: boolean
}
```

判别联合特别适合 Vue 组件中的请求状态、弹窗状态和工作流节点状态。官方说明见 [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)。

---

## 10. 常用工具类型

TypeScript 内置了一组基于现有类型生成新类型的工具。

```ts
interface Task {
  id: number
  title: string
  status: TaskStatus
  description?: string
}
```

### 10.1 Partial 与 Required

```ts
type TaskPatch = Partial<Task>
type CompleteTask = Required<Task>
```

- `Partial<Task>`：全部属性变成可选，适合局部更新；
- `Required<Task>`：全部属性变成必选。

### 10.2 Pick 与 Omit

```ts
type TaskSummary = Pick<Task, 'id' | 'title'>
type NewTask = Omit<Task, 'id'>
```

- `Pick`：选出一部分属性；
- `Omit`：排除一部分属性。

### 10.3 Record

```ts
const taskCount: Record<TaskStatus, number> = {
  todo: 4,
  doing: 2,
  done: 8,
}
```

### 10.4 ReturnType 与 Awaited

```ts
function createTask() {
  return {
    id: Date.now(),
    title: '新任务',
    status: 'todo' as const,
  }
}

type CreatedTask = ReturnType<typeof createTask>

async function loadTasks(): Promise<Task[]> {
  return []
}

type LoadedTasks = Awaited<ReturnType<typeof loadTasks>>
```

完整列表见 [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)。

---

## 11. as const 与 satisfies

### 11.1 as const 保留字面量

```ts
const defaultTask = {
  status: 'todo',
  priority: 'P1',
} as const
```

此时属性不再被拓宽成普通 `string`，同时变成只读。

### 11.2 satisfies 检查结构但保留推断

```ts
type TaskStatus = 'todo' | 'doing' | 'done'

const statusTheme = {
  todo: { color: 'gray' },
  doing: { color: 'blue' },
  done: { color: 'green' },
} satisfies Record<TaskStatus, { color: string }>

statusTheme.doing.color // 保留对象本身的精确推断
```

和直接使用类型注解相比，`satisfies` 只检查右侧是否满足目标结构，不会粗暴地把右侧表达式改成目标类型。

适用场景：

- 路由配置；
- 状态到文案或颜色的映射；
- 环境配置；
- 组件选项表；
- 需要完整键检查的常量对象。

---

## 12. 严格模式是底线

建议新项目至少启用：

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true
  }
}
```

关键点：

- `strict`：打开一组严格检查；
- `strictNullChecks`：由 `strict` 包含，让 `null`、`undefined` 真正参与类型检查；
- `noUncheckedIndexedAccess`：数组或动态键访问结果会包含 `undefined`；
- `exactOptionalPropertyTypes`：区分“属性不存在”和“属性存在但值是 undefined”；
- `useUnknownInCatchVariables`：捕获到的错误先按未知值处理。

严格模式的价值不是增加报错，而是把“本来会在运行时发生的错误”提前到编辑器里。

---

## 13. 一套可直接复用的任务类型

下面这组类型会贯穿后续 Vue 3 文章：

```ts
export const TASK_STATUS = {
  TODO: 'todo',
  DOING: 'doing',
  DONE: 'done',
} as const

export type TaskStatus =
  (typeof TASK_STATUS)[keyof typeof TASK_STATUS]

export interface Task {
  readonly id: number
  title: string
  status: TaskStatus
  tags: string[]
  createdAt: string
}

export type NewTask = Pick<Task, 'title' | 'tags'>
export type TaskPatch = Partial<Pick<Task, 'title' | 'status' | 'tags'>>

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === 'string' &&
    Object.values(TASK_STATUS).some((status) => status === value)
  )
}
```

它解决了四类问题：

1. 运行时有 `TASK_STATUS` 常量可用；
2. 编译时有 `TaskStatus` 联合类型；
3. 新建和更新任务使用不同输入类型；
4. 外部数据可以通过类型守卫进入可信边界。

---

## 14. 本篇小结

先记住下面几句话：

1. 能推断就推断，公共边界主动声明。
2. 不知道类型时用 `unknown`，不要用 `any` 逃避检查。
3. `void` 表示不使用函数返回值，`never` 表示不可能有值。
4. 用对象结构描述业务，不要只写宽泛的 `object`。
5. `type` 和 `interface` 都能约束对象和类，按表达能力选择。
6. 泛型的价值是保留输入与输出之间的类型关系。
7. 判别联合很适合描述 Vue 页面状态。
8. 新项目开启严格模式，错误越早暴露越便宜。

下一篇开始把这些类型放进真实 Vue 组件：

[Vue 3 + TypeScript 快速上手（上）：Vite、Composition API 与响应式](#/article/content%2Flearning%2Ffrontend%2F2026-07-29-02-vue3-typescript-reactivity.md)

## 参考资料

- [尚硅谷 Vue3 教程](https://www.atguigu.com/video/284/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html)
- [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
