# JVM 核心原理与线上排查

> 来源：微信公众号文章整理 · 适用于：Java 高级/架构面试、线上问题排查

---

## 一、JVM 整体结构

```
Java 源代码(.java) → 编译 → 字节码(.class) → 类加载 → 运行时数据区 → 执行引擎
```

**四大核心组件：**

| 组件 | 职责 |
|------|------|
| **类加载子系统** | 加载、验证、准备、解析、初始化 |
| **运行时数据区** | 程序计数器、JVM栈、本地方法栈、堆、方法区 |
| **执行引擎** | 解释器 + JIT编译器 + 垃圾收集器 |
| **本地接口** | JNI 桥接 Java 与 C/C++ 原生代码 |

---

## 二、运行时内存区域（重点）

### 2.1 线程私有

| 区域 | 说明 | 面试要点 |
|------|------|----------|
| **程序计数器** | 当前执行字节码的行号指示器 | 唯一不会 OOM 的区域 |
| **JVM 栈** | 栈帧：局部变量表 + 操作数栈 + 动态链接 + 返回地址 | StackOverflowError（递归过深） |
| **本地方法栈** | Native 方法的栈 | 类似 JVM 栈 |

### 2.2 线程共享

| 区域 | 说明 | 面试要点 |
|------|------|----------|
| **堆 (Heap)** | 对象实例分配区域，GC 主战场 | 新生代 (Eden + S0/S1) + 老年代；大对象进 Humongous 区（G1） |
| **方法区 / 元空间** | 类信息、常量池、静态变量 | JDK 8+ 用 Metaspace（Native Memory），替代永久代；默认无上限，可设 `-XX:MaxMetaspaceSize` |

### 堆内存结构（G1 视角）

```
Heap
├── Young Generation（新生代，默认堆的 40%）
│   ├── Eden（80%）     ← 新对象分配
│   ├── Survivor 0（10%）
│   └── Survivor 1（10%）
├── Old Generation（老年代，默认堆的 60%）
└── Humongous Region    ← 大对象（≥ Region 50%）
```

> 💡 **面试回答**：对象优先在 Eden 分配；Eden 满触发 Minor GC；经过多次 GC 存活的对象晋升老年代。

---

## 三、JMM（Java 内存模型）⭐ 高频

### 3.1 核心概念

```
        主内存 (Main Memory)
            ↕  read/write
  线程 A 工作内存  线程 B 工作内存
     ↕                ↕
   本地变量副本      本地变量副本
```

- **主内存**：所有线程共享的内存区域（对应堆中的实例数据）
- **工作内存**：每个线程私有的内存副本（对应栈帧中的局部变量）

### 3.2 JMM 三大特性

| 特性 | 含义 | 保证机制 |
|------|------|----------|
| **原子性** | 操作不可中断 | `synchronized`、`Lock`、`volatile long/double` |
| **可见性** | 一个线程修改的值，其他线程立即可见 | `volatile`、`synchronized`、`final` |
| **有序性** | 程序执行顺序符合预期 | `volatile`（禁止指令重排）、`happens-before` |

### 3.3 volatile 底层原理

1. **可见性保证**：写操作后立刻刷新到主内存；读操作从主内存加载最新值
2. **有序性保证**：插入内存屏障（Memory Barrier）
   - 写屏障 StoreStore + StoreLoad：禁止写前操作重排到写之后
   - 读屏障 LoadLoad + LoadStore：禁止读后操作重排到读之前

### 3.4 happens-before 规则（8条核心）

| # | 规则 | 说明 |
|---|------|------|
| 1 | **程序顺序规则** | 同一线程内，前面的操作 happens-before 后面的操作 |
| 2 | **volatile 变量规则** | 写 happens-before 读 |
| 3 | **锁规则** | unlock happens-before 同一锁的 lock |
| 4 | **传递性** | A hb B 且 B hb C → A hb C |
| 5 | **线程启动规则** | `thread.start()` hb 线程中的所有操作 |
| 6 | **线程终止规则** | 线程所有操作 hb `thread.join()` 返回 |
| 7 | **线程中断规则** | `interrupt()` hb 检测到中断的代码 |
| 8 | **对象终止规则** | 构造函数结束 hb `finalize()` 开始 |

---

## 四、对象分配与布局

### 4.1 分配流程

```
新对象 → TLAB（线程本地分配缓冲区）→ 成功则直接分配
                                   → 失败则 Eden 分配
                                   → Eden 满 → Minor GC
                                   → 仍然放不下 → 老年代担保/Full GC
```

**TLAB（Thread Local Allocation Buffer）**：
- 每个线程在 Eden 区拥有一小块私有缓冲区，避免多线程竞争锁
- 默认开启：`-XX:+UseTLAB`（JDK 默认开启）

### 4.2 对象内存布局（HotSpot）

| 组成 | 大小 | 说明 |
|------|------|------|
| **对象头 (Header)** | 64bit JVM 为 16B | Mark Word（锁状态/GC年龄/Hash） + 类型指针（Klass） |
| **实例数据 (Instance Data)** | 可变 | 各字段值（按大小排序，padding 对齐 8B） |
| **对齐填充 (Padding)** | 0~7B | 确保总大小是 8 的倍数 |

> 💡 Mark Word 随锁状态变化（无锁→偏向锁→轻量级锁→重量级锁），是 synchronized 优化的基础。

---

## 五、类加载机制

### 5.1 加载流程

```
加载(Loading) → 验证(Verification) → 准备(Preparation) → 解析(Resolution) → 初始化(Initialization)
```

| 阶段 | 关键操作 |
|------|----------|
| **加载** | 通过全限定名获取二进制字节流，生成 Class 对象 |
| **验证** | 文件格式/元数据/字节码/符号引用验证 |
| **准备** | 为**类变量**分配内存并设置零值（`static int a = 10` → a=0） |
| **解析** | 符号引用 → 直接引用 |
| **初始化** | 执行 `<clinit>` 方法（`static` 块 + 类变量赋值） |

### 5.2 双亲委派模型 ⭐

```
Bootstrap ClassLoader（启动类加载器，C++ 实现）
    ↑ 委派
Extension ClassLoader（扩展类加载器）
    ↑ 委派
Application ClassLoader（应用类加载器，加载 classpath）
    ↑ 委派
Custom ClassLoader（自定义加载器）
```

**委派流程**：收到加载请求 → 先委托父加载器 → 父加载器无法完成 → 自己尝试加载

**为什么需要双亲委派？**
1. **防止类重复加载**：避免同一个类被不同加载器加载产生多个 Class 对象
2. **保证核心类安全**：防止用户自定义 `java.lang.String` 替换核心类

**打破双亲委派的场景**：SPI 机制（JDBC）、OSGi 热部署、Tomcat WebApp 类加载

### 5.3 常见类加载异常

| 异常 | 原因 |
|------|------|
| `ClassNotFoundException` | 找不到类的 .class 文件 |
| `NoClassDefFoundError` | 运行时找不到依赖类（编译时有，运行时缺失） |
| `ClassCastException` | 类型转换失败（不同加载器加载的同名类） |
| `NoSuchMethodError` | 找不到方法（JAR 版本冲突） |
| `UnsatisfiedLinkError` | JNI 找不到本地方法 |

---

## 六、GC 基础 ⭐⭐⭐

### 6.1 可达性分析算法

从 **GC Roots** 出发，遍历引用链，不可达的对象判定为可回收。

**GC Roots 包括**：
- 虚拟机栈中引用的对象（局部变量）
- 方法区中静态属性/常量引用的对象
- 本地方法栈中 JNI 引用的对象
- 被同步锁（synchronized）持有的对象

### 6.2 四种引用类型

| 引用类型 | 回收时机 | 场景 |
|----------|----------|------|
| **强引用** | 永不回收（除非置 null） | `Object obj = new Object()` |
| **软引用** | 内存不足时回收 | 缓存（如图片缓存） |
| **弱引用** | 下次 GC 一定回收 | `WeakHashMap`、ThreadLocal |
| **虚引用** | 随时回收，无法通过虚引用获取对象 | 跟踪对象回收（`PhantomReference`） |

### 6.3 四种 GC 算法

| 算法 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| **标记-清除** | 标记存活对象 → 清除未标记 | 简单 | 内存碎片、停顿时间长 |
| **标记-复制** | 内存分两块，存活对象复制到另一半 | 无碎片、速度快 | 内存浪费 50% |
| **标记-整理** | 标记 → 存活对象向一端移动 → 清除边界外 | 无碎片 | 移动开销大 |
| **分代收集** | 新生代（复制）+ 老年代（标记-清除/整理） | 针对不同生命周期优化 | 需要更复杂的内存管理 |

### 6.4 关键 GC 指标

| 指标 | 含义 |
|------|------|
| **STW (Stop-The-World)** | GC 时暂停所有用户线程，影响延迟 |
| **吞吐量** | 运行用户代码时间 / (用户代码时间 + GC 时间) |
| **GC 频率** | Minor GC 频繁 → Eden 太小；Full GC 频繁 → 老年代泄漏 |

---

## 七、Java 17 垃圾收集器 ⭐⭐⭐

### 7.1 常用收集器对比

| 收集器 | 代 | 算法 | STW | 适用场景 |
|--------|-----|------|-----|----------|
| **Serial** | 单线程 | 新生代复制 + 老年代标记整理 | 长 | 客户端/嵌入式 |
| **Parallel** | 多线程 | 新生代复制 + 老年代标记整理 | 较长 | 吞吐量优先（**JDK 8 默认**） |
| **CMS** | 并发 | 标记-清除 | 短 | 低延迟（已废弃） |
| **G1** | 并发 | Region 化 + 混合回收 | 可控 | **JDK 17 默认**，通用 |
| **ZGC** | 并发 | 染色指针 + 读屏障 | <1ms | 超低延迟 |
| **Shenandoah** | 并发 | 转发指针 + Brooks Pointer | <10ms | 超低延迟 |

### 7.2 G1 收集器（JDK 17 默认）⭐⭐

**核心思想**：将堆划分为等大的 Region（默认 1~32MB），优先回收垃圾最多的 Region（Garbage First）

**回收阶段**：
```
Young GC → 并发标记 → 混合回收 (Mixed GC) → Full GC（兜底）
```

**关键参数**：
```bash
# 设置堆大小
-Xmx4g -Xms4g

# G1 相关
-XX:+UseG1GC
-XX:G1HeapRegionSize=8m          # Region 大小（1~32MB，2的幂）
-XX:MaxGCPauseMillis=200         # 目标最大停顿时间（毫秒）
-XX:G1NewSizePercent=5           # 新生代最小比例
-XX:G1MaxNewSizePercent=60       # 新生代最大比例
-XX:InitiatingHeapOccupancyPercent=45  # 触发并发标记的堆占用阈值
```

### 7.3 ZGC（JDK 17 生产可用）⭐

**核心技术**：
- **染色指针 (Colored Pointers)**：在指针中存储 GC 元数据（Marked0/Marked1/Remapped/Finalizable）
- **读屏障 (Load Barrier)**：对象引用被读取时触发，确保一致性
- **并发整理**：几乎全程并发，STW < 1ms

```bash
# 开启 ZGC
-XX:+UseZGC
-XX:+ZGenerational               # JDK 21+ 分代 ZGC（推荐）
```

**ZGC vs G1**：
| 维度 | G1 | ZGC |
|------|-----|-----|
| 停顿时间 | 100~500ms（可控） | <1ms |
| 吞吐量 | 较高 | 略低于 G1 |
| 内存开销 | 低 | 较高（染色指针占额外空间） |
| 适用场景 | 通用 | 超低延迟/大堆（8GB+） |

---

## 八、GC 日志配置（Java 17）⭐

### 8.1 统一日志框架

Java 9+ 使用统一日志框架 `Xlog`，替代旧的 `-XX:+PrintGCDetails`：

```bash
# 基础 GC 日志
-Xlog:gc*

# 输出到文件
-Xlog:gc*:file=gc.log:time,uptime,level,tags

# 详细 GC 日志（推荐）
-Xlog:gc*,gc+age=trace,gc+phases=debug:file=gc.log:time,uptime,level,tags:filecount=5,filesize=100m

# GC 专用于排障
-Xlog:gc*,gc+heap=debug,gc+phases=debug,gc+humongous=debug:file=gc.log:time,uptime,level,tags
```

### 8.2 日志关键字段

| 字段 | 含义 |
|------|------|
| `GC pause` | STW 停顿时间 |
| `GC pause (G1 Evacuation Pause)` | 新生代回收停顿 |
| `Heap Region` | 被回收的 Region 数量 |
| `Humongous` | 大对象分配/回收 |
| `Allocation Spacing` | 对象分配速率 |

---

## 九、线上问题排查实战 ⭐⭐⭐

### 9.1 常见 JVM 问题与排查命令

#### 问题一：CPU 飙高

```bash
# 1. 找到 Java 进程 PID
jps -l

# 2. 找到 CPU 最高的线程
top -Hp <pid>
# 记下线程号（如 12345）

# 3. 转换为十六进制
printf "%x\n" 12345  # → 0x3039

# 4. 在 jstack 中查找该线程
jstack <pid> | grep "0x3039" -A 30

# 或使用 Arthas
thread -n 3          # 找出 CPU 占用最高的 3 个线程
thread <id>          # 查看线程堆栈
```

#### 问题二：内存溢出 (OOM)

```bash
# 1. 查看堆内存使用
jmap -heap <pid>

# 2. dump 堆内存
jmap -dump:format=b,file=heap.hprof <pid>

# 3. 分析 dump 文件
jhat heap.hprof                    # 浏览器查看
jvisualvm                           # GUI 分析
MAT (Eclipse Memory Analyzer)      # 专业工具

# 4. 常见 OOM 类型排查
# OutOfMemoryError: Java heap space → 堆溢出，检查内存泄漏
# OutOfMemoryError: Metaspace → 类加载过多，检查动态代理/反射
# OutOfMemoryError: GC overhead → GC 耗时超过 98% 但回收不到 2% 内存
```

#### 问题三：频繁 Full GC

```bash
# 1. 查看 GC 统计
jstat -gcutil <pid> 1000 10     # 每 1 秒打印一次，共 10 次

# 2. 关注 FGC 次数和 FGCT 时间
#    FGC 频繁 → 老年代对象过多 → 内存泄漏 or 参数不合理

# 3. 查看 GC 详情
jstat -gc <pid> 1000

# 4. Arthas 排查
dashboard                          # 实时查看堆内存使用
heapdump /tmp/dump.hprof          # Arthas dump
```

#### 问题四：类加载失败

```bash
# 1. 查看类加载信息
jinfo -flags <pid>                # 查看 JVM 参数
jcmd <pid> VM.classloader_stats   # 类加载统计

# 2. Arthas 查看
sc -d com.example.MyClass        # 查看类加载信息
sc -d *MyClass                   # 模糊搜索
classloader                       # 查看类加载器层级

# 3. 常见原因
# ClassNotFoundException → classpath 缺失
# NoClassDefFoundError → 运行时依赖缺失
# ClassCastException → 不同加载器加载了同名类（如 Tomcat WebApp 隔离）
```

#### 问题五：线程死锁

```bash
# 1. jstack 查看死锁
jstack <pid> | grep -A 20 "deadlock"

# 2. Arthas
thread -b                          # 找出阻塞线程
thread -a                          # 所有线程堆栈
```

### 9.2 排查工具汇总

| 工具 | 用途 |
|------|------|
| **jps** | 列出 Java 进程 |
| **jstat** | GC 统计监控 |
| **jstack** | 线程堆栈（死锁/阻塞） |
| **jmap** | 堆 dump / 内存映射 |
| **jcmd** | 综合诊断（替代上面多个工具） |
| **jinfo** | 查看/修改 JVM 参数 |
| **Arthas** | 阿里开源，在线诊断（推荐） |
| **MAT** | 堆 dump 分析 |
| **VisualVM** | 可视化监控 |

### 9.3 常用 JVM 启动参数

```bash
# 内存设置
-Xms4g -Xmx4g                     # 堆大小（建议设置一样避免扩容）
-Xss512k                           # 线程栈大小
-XX:MetaspaceSize=256m             # 元空间初始值
-XX:MaxMetaspaceSize=256m          # 元空间最大值

# GC 收集器
-XX:+UseG1GC                       # 使用 G1（JDK 17 默认）
-XX:MaxGCPauseMillis=200           # G1 目标停顿时间

# GC 日志
-Xlog:gc*:file=gc.log:time,uptime:filecount=5,filesize=50m

# OOM 处理
-XX:+HeapDumpOnOutOfMemoryError    # OOM 时自动 dump
-XX:HeapDumpPath=/tmp/heapdump.hprof  # dump 路径

# 紧急恢复
-XX:+UseGCOverheadLimit            # GC 开销限制（默认开启）
-XX:+ExitOnOutOfMemoryError        # OOM 时直接退出进程
```

---

## 十、面试高频问题速查

| 问题 | 一句话答案 |
|------|-----------|
| 堆和栈的区别？ | 堆存对象（共享），栈存局部变量/方法调用（线程私有） |
| JMM 是什么？ | 定义线程间通信的抽象模型，保证原子性/可见性/有序性 |
| volatile 的作用？ | 保证可见性（刷新主存）+ 有序性（禁止重排），不保证原子性 |
| synchronized 锁升级？ | 无锁→偏向锁→轻量级锁（CAS）→重量级锁（Monitor） |
| 为什么用 G1？ | Region 化内存、可预测停顿、适合大堆 |
| ZGC 原理？ | 染色指针+读屏障，STW < 1ms，适合超低延迟场景 |
| 双亲委派为什么重要？ | 防止核心类被篡改，避免类重复加载 |
| Minor GC 触发条件？ | Eden 区满时触发 |
| Full GC 触发条件？ | 老年代满、方法区满、System.gc()、空间担保失败 |
| OOM 排查思路？ | jmap dump → MAT 分析 → 找大对象/内存泄漏点 |
| TLAB 是什么？ | 线程本地分配缓冲区，减少 Eden 分配时的锁竞争 |
| 对象头包含什么？ | Mark Word（锁状态/GC年龄/Hash）+ 类型指针 |

---

## 十一、实战配置模板（Java 17 生产）

```bash
# 推荐的 JVM 启动参数（8GB 内存服务器）
java \
  -Xms8g -Xmx8g \
  -Xss512k \
  -XX:MetaspaceSize=256m \
  -XX:MaxMetaspaceSize=512m \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -XX:G1HeapRegionSize=8m \
  -XX:InitiatingHeapOccupancyPercent=45 \
  -Xlog:gc*,gc+heap=debug,gc+phases=debug:file=/var/log/app/gc.log:time,uptime,level,tags:filecount=5,filesize=50m \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/var/log/app/heapdump.hprof \
  -jar app.jar
```

---

*最后更新：2026-06-01*
