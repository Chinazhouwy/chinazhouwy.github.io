---
title: "2026-10-30 Java 面试复盘：从 ThreadPoolExecutor 的 Worker 到 BlockingQueue、Condition 与 408 PV"
date: "2026-10-30"
domain: "学习"
area: "Java 后端"
module: "Java 并发与异步"
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "以当天真实问答为主线，从线程池七参数与三类任务队列，深入 Worker/firstTask/runWorker/getTask、ctl、任务交接，再结合 ArrayBlockingQueue 的 count、ReentrantLock、notEmpty/notFull、await/signal 及 408 生产者—消费者 PV 模型解释阻塞、唤醒与 while 防竞态，包含 Java 21 可运行实验与后续 AQS 计划。"
tags:
  - Java
  - ThreadPoolExecutor
  - Worker
  - BlockingQueue
  - ArrayBlockingQueue
  - SynchronousQueue
  - Condition
  - ReentrantLock
  - 操作系统
  - 408
  - 生产者消费者
  - 面试复盘
---

# 2026-10-30 Java 面试复盘：从 ThreadPoolExecutor 的 Worker 到 BlockingQueue、Condition 与 408 PV

> **记录边界**：本文整理 2026-10-30 的 Java 模拟面试与逐步追问。问题与误区依据当日对话重述，**不是外部公司真实面试题**；代码示例均为学习演示，标注“源码节选/教学伪代码”处不应直接当作 OpenJDK 原文件。AQS 详细原理暂不展开，留到下一专题。
>
> 关联阅读：[线程池队列满了会怎样：从拒绝策略看 ThreadPoolExecutor 扩容顺序](./2026-08-29-thread-pool-queue-full-rejection-policies.md)。

## 一、今天真正问过的问题：先保留问题，再给答案

按讨论的先后次序，尽量保留原本的提问语言和思考转折，而不是只写标准答案。

| 序号 | 当天的问题／困惑 | 核心结论 | 当天理解变化 |
|---|---|---|---|
| Q1 | 核心线程 2、最大线程 4、队列容量 2，连续提交 7 个阻塞任务会怎样？ | 1–2 创建核心线程，3–4 入队，5–6 新增线程，7 触发拒绝 | 纠正误把 AbortPolicy 当成静默丢弃 |
| Q2 | 改成 \`new LinkedBlockingQueue<>()\`，1000 个长任务有几个线程？“无限长”吗？ | 通常 2 个工作线程；默认容量 \`Integer.MAX_VALUE\`，不是数学意义无限 | 已能判断不会因为积压扩到 4 |
| Q3 | \`SynchronousQueue\` 容量 0，为什么还有意义？5 个任务怎样执行？ | **直接交接而非缓存**；无空闲接收者才尝试扩容，5 号任务在给定场景中拒绝 | 从“队列存储”转向“线程交接” |
| Q4 | \`SynchronousQueue.size()/peek()/remainingCapacity()\` 输出？ | \`0/null/0\` | 辨清 \`null\` 和整数 0 |
| Q5 | \`ctl\` 是什么？为什么把状态和工作线程数写进同一个 int？ | 高 3 位运行状态，低 29 位 workerCount；原子读取与 CAS | 联想到 408 指令字的位字段编码 |
| Q6 | 入队成功还要 \`recheck\`？\`shutdown()\` 期间怎么办？ | 检查与入队不原子，必须复查关闭状态、必要时移除拒绝 | 认识并发竞态 |
| Q7 | Worker 是什么？“创建时携带首任务”什么意思？最后不还是 \`task.run()\`？ | Worker 是线程池管理对象；\`firstTask\` 是引用；\`runWorker()\` 不断取任务，最终确实 \`task.run()\` | 从 Runnable、Thread、Worker 三者混淆中理清 |
| Q8 | \`workQueue\` 是什么类型，跟线程池七参数有关吗？ | 第五参数 \`BlockingQueue<Runnable>\`，接口多态；具体可用数组、链表、零容量交接 | 理清接口和实现的数据结构 |
| Q9 | \`BlockingQueue\` 底层是死循环还是 \`wait()\`？ | 具体实现决定；ArrayBlockingQueue 主要用 ReentrantLock+Condition.await/signal，不忙等 | 与 408 阻塞/唤醒建立联系 |
| Q10 | \`offer/poll\`、\`put/take\` 怎么对应？满队列 \`put\` 会异常吗？ | \`offer/poll\` 立即返回；\`put/take\` 可阻塞；队列满的 \`put\` 等待而不是因满抛异常 | 纠正超时、失败、异常混淆 |
| Q11 | Condition 与 Object.wait/notify 有何区别与优势？ | 同一把 ReentrantLock 可建多个条件等待集合，区分生产者、消费者 | 重点从“等谁”转向“通知谁” |
| Q12 | \`notFull\` 和 \`notEmpty\` 是生产者消费者都有的变量吗？满队列消费一个元素该 signal 哪个？ | 它们是队列持有的两个 Condition；出队通知 \`notFull\`，入队通知 \`notEmpty\` | 纠正“看有没有元素就发 notEmpty” |
| Q13 | signal 与 signalAll；三个消费者与三个连续 put 能否一一匹配？ | signal 通知一个等待者；不保证消费者 A 得到元素 1，B 得到 2 | 区分信号、锁竞争与执行顺序 |
| Q14 | 为什么 \`await()\` 必须放 \`while\` 里，不能放 \`if\`？ | 被唤醒不代表条件仍成立；可能其他线程抢先消费/占位，且允许虚假唤醒 | 最后已自己推导：A 生产、B 消费、C 抢先生产，可能队列超额 |

**今天停留在 Q14；AQS 明天再讲。**

## 二、Q1–Q4：线程池七参数与三类队列，如何影响扩容？

### 2.1 先会读七参数

\`\`\`java
ThreadPoolExecutor executor = new ThreadPoolExecutor(
    2,                                  // corePoolSize
    4,                                  // maximumPoolSize
    60,                                 // keepAliveTime
    TimeUnit.SECONDS,                   // unit
    new ArrayBlockingQueue<>(2),        // workQueue（第五个参数）
    Executors.defaultThreadFactory(),   // threadFactory
    new ThreadPoolExecutor.AbortPolicy() // handler
);
\`\`\`

\`keepAliveTime\` 是符合超时回收规则的**空闲线程**等待新任务的时间，不是任务最大运行时长。核心线程默认不超时，但调用 \`allowCoreThreadTimeOut(true)\` 可以改变这个规则。

\`AbortPolicy\` 抛 \`RejectedExecutionException\`；\`DiscardPolicy\` 才是静默丢弃。早先对两者的混淆要彻底纠正。

### 2.2 提交 7 个不会完成的任务

假设提交期间执行的任务一直阻塞，不存在工作线程提前取走排队任务：

\`\`\`text
task 1 → Worker-1 (核心)
task 2 → Worker-2 (核心)
task 3 → workQueue 第一个槽位
task 4 → workQueue 第二个槽位
task 5 → Worker-3 (非核心)
task 6 → Worker-4 (非核心)
task 7 → 队列已满且线程数为 4 → AbortPolicy 拒绝
\`\`\`

注意，“任务 5 比任务 3 先开始执行”是可能的；**线程池的入队先后不是全部任务的执行先后保证**。

\`LinkedBlockingQueue<>()\` 默认容量 \`Integer.MAX_VALUE\`。因此两个核心线程已存在时，后续任务往往一直 \`offer\` 成功；1000 个任务的稳定场景下是 2 个 Worker 执行、998 个任务等待。它是“近似无界”而不是严格无限；千万不要说 \`maximumPoolSize\` 在所有情况下绝对不可能生效。

\`SynchronousQueue\` 没有数据存储容量，\`size() == 0\`、\`peek() == null\`、\`remainingCapacity() == 0\`。它的 \`offer(e)\` 只有在当时能够与等待的消费者成功交接时才成功；没有空闲 Worker 接手时，线程池会尝试扩容到最大线程数。这是 \`newCachedThreadPool\` 的典型机制，**高并发、长阻塞任务可能令线程数迅速增长**。

### 2.3 四种方法与一种容易忽略的混用

| 行为 | 立即尝试 | 阻塞等待 | 带超时 |
|---|---|---|---|
| 放元素 | \`offer(e)\` | \`put(e)\` | \`offer(e, timeout, unit)\` |
| 取元素 | \`poll()\` | \`take()\` | \`poll(timeout, unit)\` |

\`add(e)\` 在无法插入（如有界队列已满）时一般抛 \`IllegalStateException\`，和 \`offer\` 的 \`false\` 不同。\`put\` 在队列满时阻塞，可因中断抛 \`InterruptedException\`。

**这些不是强制成对的 API**，生产者可以用 \`offer()\`、消费者用 \`take()\`。线程池正是一个例子：提交端用 \`offer()\` 及时决定扩容/拒绝；Worker 从队列取任务时则可能用 \`take()\` 或带超时的 \`poll()\`。

## 三、Q5–Q8：Runnable、Thread、Worker、workQueue 到底怎么串起来？

### 3.1 先把 408 的线程调度和 Java 任务管理分开

| 层次 | 实体 | 谁管理它 |
|---|---|---|
| JVM 应用层 | \`Runnable\` 任务对象 | 线程池提交、排队与分配 |
| JVM 应用层 | \`Worker\` 工作线程管理对象 | \`ThreadPoolExecutor\` |
| Java 平台线程 | \`Thread\` | JVM 与操作系统协作 |
| OS 调度层 | 底层可调度线程 | 操作系统调度器 |
| CPU | 机器指令执行 | 硬件 |

\`Runnable C\` 在 \`workQueue\` 里排队时，不等于 OS 的就绪队列中存在一个“线程 C”。**操作系统调度的是工作线程，不是每一个 Runnable。**

\`\`\`java
Runnable taskA = () -> System.out.println("A");
taskA.run();             // 当前线程普通方法调用
new Thread(taskA).start(); // 创建/启动新平台线程，异步执行任务
\`\`\`

### 3.2 Worker 创建时“携带首任务”究竟是什么意思？

教学简化代码：

\`\`\`java
final class Worker implements Runnable {
    final Thread thread;
    Runnable firstTask;
    long completedTasks;

    Worker(Runnable firstTask) {
        this.firstTask = firstTask;      // 保存对象引用，并非立即执行
        this.thread = new Thread(this); // Thread 的执行目标是 Worker
    }

    @Override
    public void run() {
        runWorker(this);
    }

    void runWorker(Worker w) {
        // 教学伪代码，展示循环结构
    }
}
\`\`\`

真实 OpenJDK 中 \`Worker\` 是 \`ThreadPoolExecutor\` 的内部类，继承 AQS 并实现 Runnable；构造时通过 ThreadFactory 创建 \`Thread(this)\`，实际 \`run()\` 调用外围线程池的 \`runWorker(this)\`。上面的独立类只用来说明引用关系。

\`\`\`text
executor.execute(taskA)
    → addWorker(taskA, true)
    → new Worker(taskA)
         firstTask = taskA
         thread = threadFactory.newThread(worker)
    → thread.start()
    → Worker.run()
    → ThreadPoolExecutor.runWorker(worker)
    → taskA.run()
    → getTask() → taskC.run()
    → getTask() → taskD.run() ...
\`\`\`

**最终当然是 \`task.run()\`，但同一个 Thread 持续处于 runWorker 循环里，不必每次 new Thread。**

### 3.3 runWorker 为什么需要 Worker 参数？

仅有 \`task.run()\` 无法回答“谁记录完成任务数、谁持有首任务、谁支持工作中断控制、谁退出时需要清理”。

保留关键路径的教学版：

\`\`\`java
void runWorker(Worker w) {
    Thread current = Thread.currentThread();
    Runnable task = w.firstTask;
    w.firstTask = null;

    try {
        while (task != null || (task = getTask()) != null) {
            w.lock();
            try {
                beforeExecute(current, task);
                task.run();                  // 真正执行业务代码
                afterExecute(task, null);   // 实际异常处理更复杂
            } finally {
                task = null;
                w.completedTasks++;
                w.unlock();
            }
        }
    } finally {
        processWorkerExit(w, /* 实际需计算退出原因 */ true);
    }
}
\`\`\`

此处 \`w.lock()\` 不是业务 Runnable 自带的锁；真实 Worker 使用 AQS 实现内部锁。以上只保留结构，不完整处理异常、执行前中断状态和异常退出判定。

\`getTask()\` 根据线程池状态和空闲超时策略，可能调用：

\`\`\`java
Runnable task = timed
    ? workQueue.poll(keepAliveTime, TimeUnit.NANOSECONDS)
    : workQueue.take();
\`\`\`

队列空时，\`take()\` 会阻塞等待，而不是忙等死循环。若已满足退出条件，\`getTask()\` 可以返回 \`null\`，Worker 随后退出。

### 3.4 第五参数究竟是什么结构？

\`\`\`java
private final BlockingQueue<Runnable> workQueue;
private final HashSet<Worker> workers = new HashSet<>();
\`\`\`

两者不是一回事：

- \`workers\` 是已创建的 **Worker 管理对象集合**；
- \`workQueue\` 是 **等待执行的 Runnable 队列**。

类型继承：

\`\`\`text
Iterable<E>
    ↑
Collection<E>
    ↑
Queue<E>
    ↑
BlockingQueue<E> （接口）
    ├── ArrayBlockingQueue<E>  固定容量循环数组
    ├── LinkedBlockingQueue<E> 链式节点
    └── SynchronousQueue<E>    不保存元素，直接交接
\`\`\`

\`BlockingQueue\` 是接口，不是确定的底层数据结构；由构造方法的第五参数注入具体实现。线程池统一依赖 \`offer/take/poll\`，靠接口多态适配不同队列。

### 3.5 ctl：位字段与 408 指令字

\`ThreadPoolExecutor\` 把运行状态（高 3 位）与工作线程计数（低 29 位）编码到一个 \`AtomicInteger ctl\`：

\`\`\`java
static final int COUNT_BITS = Integer.SIZE - 3;
static final int COUNT_MASK = (1 << COUNT_BITS) - 1;

static int runStateOf(int c)    { return c & ~COUNT_MASK; }
static int workerCountOf(int c) { return c & COUNT_MASK; }
static int ctlOf(int rs, int wc) { return rs | wc; }
\`\`\`

与 408 中 32 位指令的“操作码 + 寄存器字段 + 立即数字段”类似：不同位负责不同语义。但 \`ctl\` 额外承担原子读、CAS 更新等并发状态维护职责。Worker ≠ workerCount，前者是对象，后者是一个数字。

### 3.6 为什么入队成功还要 recheck？

\`\`\`java
if (isRunning(c) && workQueue.offer(command)) {
    int recheck = ctl.get();

    if (!isRunning(recheck) && remove(command))
        reject(command);
    else if (workerCountOf(recheck) == 0)
        addWorker(null, false);
}
\`\`\`

因为“检查仍在 RUNNING”与“把任务 offer 进去”并非一个原子动作。另一个线程可能恰好调用 \`shutdown()\`。重新读取 \`ctl\` 可以检查这段时间发生的状态变化；若关闭且任务仍在队列中，撤回并拒绝。若 \`remove(command)\` 失败，可能已经被 Worker 取走，也可能因其他并发操作不在队列内，**不能据此断言任务成功完成**。

\`shutdown()\` 不接受新任务，但通常允许此前已提交的执行中/排队任务完成；\`shutdownNow()\` 尝试中断执行中任务并移除返回尚未开始的队列任务，不能保证任务一定终止。

## 四、Q9–Q12：ArrayBlockingQueue 源码，Condition 如何模拟 PV 问题？

### 4.1 关键字段——Condition 不是 boolean，也不是计数信号量

\`\`\`java
final Object[] items;
int takeIndex, putIndex, count;
final ReentrantLock lock;
private final Condition notEmpty;
private final Condition notFull;
\`\`\`

构造时：

\`\`\`java
lock = new ReentrantLock();
notEmpty = lock.newCondition(); // 等待“非空”的消费者
notFull  = lock.newCondition(); // 等待“未满”的生产者
\`\`\`

\`count\` 才是真正的元素计数：\`count==0\` 空，\`count==items.length\` 满。两个 Condition 提供不同的**等待集合**，不保存“是否满足”的布尔值，也没有 \`Semaphore\` 的许可累计。

### 4.2 put / take 源码关键控制流

下面保留 OpenJDK 实际关键结构，省略空值校验、数组索引等细节：

\`\`\`java
public void put(E e) throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        while (count == items.length) {
            notFull.await(); // 满了：等待空位
        }
        enqueue(e);
    } finally {
        lock.unlock();
    }
}

public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        while (count == 0) {
            notEmpty.await(); // 空了：等待元素
        }
        return dequeue();
    } finally {
        lock.unlock();
    }
}
\`\`\`

入队、出队关键逻辑：

\`\`\`java
// 概念节选：真实实现还维护数组索引及引用清理
void enqueue(E e) {
    // items[putIndex] = e; putIndex 前进/回绕;
    count++;
    notEmpty.signal(); // 放进来了 → 通知可能有元素可取
}

E dequeue() {
    // E e = items[takeIndex]; 清理槽位; takeIndex 前进/回绕;
    count--;
    notFull.signal();  // 取走了 → 通知可能有空位可放
    return null;       // 仅伪代码占位：真实实现返回取出的元素
}
\`\`\`

**注意**：这一段的 \`return null\` 仅是展示信号位置的伪代码，绝不是实际 \`dequeue()\` 行为，实际方法返回移除的那个元素。完整实现在文末 OpenJDK 源码链接。

### 4.3 一个容量为 2 的生产者—消费者时间线

| 时刻 | 动作 | count | 等待/通知 |
|---|---|---:|---|
| T0 | 空队列 | 0 | 无 |
| T1 | \`put(1)\` | 1 | \`notEmpty.signal()\` |
| T2 | \`put(2)\` | 2 | \`notEmpty.signal()\` |
| T3 | A 执行 \`put(3)\` | 2 | 满，A \`notFull.await()\`，释放锁 |
| T4 | B 执行 \`take()\` | 1 | B 取走 1，\`notFull.signal()\` |
| T5 | A 重新取得锁并复查 | 1 | 条件成立，A 放入 3，count=2 |

\`await()\` 不是“高 CPU 忙等循环”：它释放关联锁并进入等待；\`signal()\` 使等待线程进入后续的锁竞争过程，**不保证立即执行**。收到 signal 后，线程仍需重新获得 \`ReentrantLock\`。

对于 \`ArrayBlockingQueue\`，正常成功入队会通知 \`notEmpty\`，正常成功出队会通知 \`notFull\`。这不代表每次都会实际唤醒线程——如果没人等待，信号不积累。

### 4.4 为什么只有一个锁，却有两个 Condition？

\`Object.wait/notify\` 必须在相应对象的 \`synchronized\` 监视器内调用，其等待集合与对象监视器关联。与之相比：

\`\`\`java
ReentrantLock lock = new ReentrantLock();
Condition notEmpty = lock.newCondition();
Condition notFull  = lock.newCondition();
\`\`\`

可以把“等待新元素的消费者”与“等待空位的生产者”分别放入不同等待集合，通知时选择正确的一组。比较：

| Object Monitor | Lock + Condition |
|---|---|
| \`synchronized(lock)\` | \`lock.lock()/unlock()\` |
| \`lock.wait()\` | \`condition.await()\` |
| \`lock.notify()\` | \`condition.signal()\` |
| \`lock.notifyAll()\` | \`condition.signalAll()\` |
| 一个监视器关联一个等待集合 | 一把锁可建多个独立 Condition |

不要认为 \`Condition.await()\` 就是直接委托给 \`Object.wait()\`；它们 API 与实现不同。使用 \`Condition\` 时也必须先持有**关联的锁**；调用 \`await()\` 会释放锁，返回前重新获取。

### 4.5 与 408 PV 模型逐一对应（但不是同一个实现）

408 有界缓冲区经典模型：

\`\`\`text
初始 empty = N, full = 0, mutex = 1

Producer:
    P(empty)
    P(mutex)
    放元素
    V(mutex)
    V(full)

Consumer:
    P(full)
    P(mutex)
    取元素
    V(mutex)
    V(empty)
\`\`\`

Java ArrayBlockingQueue 对应的思路：

\`\`\`text
Producer:
    lock
    while (count == N) notFull.await()
    放元素; count++
    notEmpty.signal()
    unlock

Consumer:
    lock
    while (count == 0) notEmpty.await()
    取元素; count--
    notFull.signal()
    unlock
\`\`\`

**重要差异**：PV 中 \`empty/full\` 是计数信号量，\`V\` 累计许可；\`Condition.signal()\` 不累计许可。Condition 管理等待，队列中的 \`count\` 表达真实状态。\`mutex\` 互斥保护的职责，在 Java 版本中由 \`ReentrantLock\` 承担。

## 五、Q13–Q14：signal、signalAll，以及为什么必须用 while 而不是 if

### 5.1 signal / signalAll

- \`signal()\`：通知一个在该 Condition 上等待的线程。
- \`signalAll()\`：通知该 Condition 上全部等待线程。
- 唤醒 ≠ 获得锁 ≠ 获得 CPU ≠ 必然取得数据。

假设 A、B、C 三个消费者都等待，生产者连续 \`put(1)\`、\`put(2)\`、\`put(3)\`，各次入队会执行 \`notEmpty.signal()\`，三人通常都能得到被通知的机会，但**不保证 A 取 1、B 取 2、C 取 3**。元素出队整体遵守 FIFO，而哪一个线程获得哪一个元素受线程调度和锁竞争影响。

如队列只有一个元素而有 100 个消费者，直接 \`signalAll()\` 可能唤醒大量线程争夺锁，其中绝大多数又回去等待，形成额外竞争（常称“惊群”）。所以入队使用 \`signal()\` 很常见；并非 \`signalAll()\` 在语义上永远错误。

### 5.2 被 signal 的消费者仍可能取不到元素

\`\`\`text
初始 count=0
A: take() → notEmpty.await()，释放锁
B: put(100) → count=1 → notEmpty.signal()
A: 收到通知，但尚未重新获得锁
C: 抢先拿到锁，take() 取走 100 → count=0
A: 获得锁，若仅 if 检查会错误地往下 dequeue()
A: 若 while(count==0) 则继续 await()
\`\`\`

所以：

\`\`\`java
// 错误：醒来后不复查，存在竞态
if (count == 0) notEmpty.await();
return dequeue();

// 正确：唤醒后仍需检查共享状态
while (count == 0) notEmpty.await();
return dequeue();
\`\`\`

即使没有线程 C 抢先取走元素，\`Condition.await()\` 的规范也允许**虚假唤醒（spurious wakeup）**，所以仍然要循环检查。

### 5.3 今天用户自己给出的正确推理：生产者同样要 while

当时的问题是：

> 如果生产者改成 \`if (count == items.length) notFull.await(); enqueue(e);\` 会怎样？

最终回答是“**A 生产，B 消费，C 生产，容易队列超额**”。这正是关键并发竞态。

\`\`\`text
初始：队列满，count=N
A: put(3) → notFull.await()
B: take() → count=N-1，notFull.signal()，通知 A
A: 尚未抢到锁
C: 抢先 put(4) → count=N（又满了）
A: 重新获得锁
    if 写法：直接 enqueue(3) → 违反容量约束
    while 写法：发现 count==N → 再次 await()
\`\`\`

所以两边必须用循环：

\`\`\`java
while (count == 0)            notEmpty.await(); // 消费者
while (count == items.length) notFull.await();  // 生产者
\`\`\`

**一个面试中的标准句式**：Condition 的通知是“状态可能发生变化”，而不是“资源已经独占分配给被唤醒线程”；线程恢复后必须持锁重新检查条件。

## 六、自己手写两个 Java 21 实验：别只停在八股

### 实验 A：观察 Worker 复用、队列满与 AbortPolicy（可运行）

\`\`\`java
import java.util.concurrent.*;

public class ThreadPoolWorkerLab {
    public static void main(String[] args) throws Exception {
        CountDownLatch release = new CountDownLatch(1);
        ThreadPoolExecutor pool = new ThreadPoolExecutor(
            2, 4, 60, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(2),
            Executors.defaultThreadFactory(),
            new ThreadPoolExecutor.AbortPolicy()
        );
        try {
            for (int i = 1; i <= 6; i++) {
                int id = i;
                pool.execute(() -> {
                    System.out.printf("start task=%d thread=%s%n",
                        id, Thread.currentThread().getName());
                    try {
                        release.await(); // 让开始执行的任务持续占住线程
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                });
            }

            System.out.printf("workers=%d, queued=%d%n",
                pool.getPoolSize(), pool.getQueue().size());
            try {
                pool.execute(() -> System.out.println("task 7"));
            } catch (RejectedExecutionException e) {
                System.out.println("task 7 rejected: " + e.getClass().getSimpleName());
            }
        } finally {
            release.countDown();
            pool.shutdown();
            pool.awaitTermination(5, TimeUnit.SECONDS);
        }
    }
}
\`\`\`

预期提交路径：4 个 Worker、2 个排队任务、任务 7 被拒绝；但任务实际开始打印的时间和顺序不保证一致。注意 \`getPoolSize()\` 为提交时刻的快照，实际运行中的瞬时观察受并发调度影响。

**动手改动**：将队列换成 \`new LinkedBlockingQueue<>()\`，观察线程数与队列长度；再试 \`new SynchronousQueue<>()\`，记录在有空闲 Worker 与无空闲 Worker 时的差别。

### 实验 B：用自己的 Condition 实现容量为 2 的缓冲区（可运行）

这个实验可直接把 408 生产者—消费者模型转成 Java：

\`\`\`java
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

public class ConditionBufferLab {
    static final class BoundedBuffer {
        private final int capacity = 2;
        private final Deque<Integer> q = new ArrayDeque<>();
        private final ReentrantLock lock = new ReentrantLock();
        private final Condition notEmpty = lock.newCondition();
        private final Condition notFull = lock.newCondition();

        void put(int value) throws InterruptedException {
            lock.lockInterruptibly();
            try {
                while (q.size() == capacity) {
                    System.out.println("queue full, producer awaits");
                    notFull.await();
                }
                q.addLast(value);
                System.out.printf("put %d, count=%d%n", value, q.size());
                notEmpty.signal();
            } finally {
                lock.unlock();
            }
        }

        int take() throws InterruptedException {
            lock.lockInterruptibly();
            try {
                while (q.isEmpty()) {
                    notEmpty.await();
                }
                int value = q.removeFirst();
                System.out.printf("take %d, count=%d%n", value, q.size());
                notFull.signal();
                return value;
            } finally {
                lock.unlock();
            }
        }
    }

    public static void main(String[] args) throws Exception {
        BoundedBuffer buffer = new BoundedBuffer();
        Thread producer = new Thread(() -> {
            try {
                buffer.put(1);
                buffer.put(2);
                buffer.put(3); // 在这里等消费者拿走一个
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }, "producer");

        producer.start();
        Thread.sleep(200); // 教学上便于观察等待；不是生产级线程协调
        System.out.println("main takes: " + buffer.take());
        producer.join();
    }
}
\`\`\`

**建议逐行调试**：在 \`notFull.await()\`、\`take()\` 取元素之后、\`notFull.signal()\`、\`put()\` 恢复之后分别打断点，观察 \`q.size()\` 和当前线程名称。先理解一个等待者，再加第二个生产者模拟“被 signal 后空位被抢”的竞态；不要仅凭少量运行未复现就认为 \`if\` 安全。

## 七、生产环境延伸：哪些地方要特别小心？

1. **无界任务堆积**：默认 \`LinkedBlockingQueue\` 大量排队不等于安全，需关注等待任务占用的内存、响应时间与任务取消能力。
2. **线程数不是越多越好**：\`SynchronousQueue\` 促使线程池在无空闲接收者时扩容，若任务长期阻塞，须限制最大线程数和提交速率。
3. **拒绝策略是业务语义**：\`AbortPolicy\` 明确抛异常，\`CallerRunsPolicy\` 可能把提交端也阻塞，静默丢弃不适合重要业务。
4. **等待和执行要分清**：\`keepAliveTime\` 管空闲等待，不替业务 \`Runnable\` 设置执行超时；外部 I/O 超时、中断响应需要任务自身配合。
5. **线程池内部不是持久任务队列**：\`workQueue\` 是内存队列，线程池关闭或进程崩溃不等于任务自动持久化；需要可靠投递时应引入持久队列、幂等与补偿。
6. **别把 Condition signal 等同于 PV 的 V 操作**：前者不积累信号，后者维护计数；实际条件在共享状态中，并由锁保护。

## 八、复习结论与明日衔接

今天最终明确的概念链：

\`\`\`text
Runnable 是任务，不是线程
Thread 是执行体（这里讨论 Java 平台线程）
Worker 是管理工作线程与任务循环的对象
ThreadPoolExecutor.workers 是 Worker 集合
workQueue 是 BlockingQueue<Runnable>，即待执行任务队列

execute() 决定创建 Worker / 入队 / 扩容 / 拒绝
runWorker() 循环执行 task.run()，再调用 getTask()
getTask() 可能使用 BlockingQueue.take()/poll(timeout)
ArrayBlockingQueue 内部用 ReentrantLock + notEmpty/notFull
await() 释放锁并等待，signal() 通知等待者参与锁竞争
醒来后用 while 复查 count，防止资源被其他线程抢走
\`\`\`

**今天自评**：从能背线程池七参数但不清楚 Worker 到底是什么，推进到可以用 Producer A、Consumer B、Producer C 自己解释 \`while\` 防止队列超额。这属于从记忆概念到理解执行时序的实质进步；但还**没有**手动在 OpenJDK 源码中逐步调试，不能据此声称掌握了 AQS 实现。

**下一专题（未学习）**：\`ReentrantLock\` 重入计数；AQS 的 state、CLH 变体同步队列；Condition 的条件等待队列与同步队列转移；signal 后为何必须重新争锁。先画线程状态变化，再读源码。

## 源码与校验资料

- [OpenJDK 21 ThreadPoolExecutor.java](https://github.com/openjdk/jdk21u/blob/master/src/java.base/share/classes/java/util/concurrent/ThreadPoolExecutor.java)
- [OpenJDK 21 ArrayBlockingQueue.java](https://github.com/openjdk/jdk21u/blob/master/src/java.base/share/classes/java/util/concurrent/ArrayBlockingQueue.java)
- [OpenJDK 21 LinkedBlockingQueue.java](https://github.com/openjdk/jdk21u/blob/master/src/java.base/share/classes/java/util/concurrent/LinkedBlockingQueue.java)
- [OpenJDK 21 SynchronousQueue.java](https://github.com/openjdk/jdk21u/blob/master/src/java.base/share/classes/java/util/concurrent/SynchronousQueue.java)
- [Java 21 BlockingQueue Javadoc](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/BlockingQueue.html)
- [Java 21 Condition Javadoc](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/Condition.html)
