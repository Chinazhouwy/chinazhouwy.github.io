---
title: "未知标题"
date: "2026-07-06"
domain: "学习"
area: "技术"
module: "参考资料"
project: ""
type: "技术资料"
status: "digested"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "未知标题"
tags:
---

# 未知标题

**类型：📚 参考资料（非面试题/面经）**

**作者：** 六道轮回菠萝
**来源：** [微信公众号](https://mp.weixin.qq.com/s/8fBOJo2er0H1mN58XZft1Q)
**原始链接：** https://mp.weixin.qq.com/s/8fBOJo2er0H1mN58XZft1Q

---

Java FFM API(Project Panama)（1）

Foreign Function & Memory API（简称 FFM API）是 Java 

Project Panama（巴拿马项目）

 的核心产物。在JDK 22 中就已经正式转正，但是由于JDK25是最近的一个LTS，所以可以认为是JDK25的一个新特性：https://openjdk.org/jeps/454

FFM API由两大部分组成，一个是

Foreign Function Interface

，另一个是

Memory API

。前者是外部函数接口，简称FFI，用它来实现Java代码和外部代码之间相互操作；后者是内存接口，用于安全地管理堆外内存。我们整体介绍分为两篇，第一篇介绍

Memory API

，第二篇介绍

Foreign Function Interface

，两篇的顺序都是这个东西是什么？它没有出现之前是如何做的？老的实现方法有什么问题？新的东西是怎么做的以及他是怎么解决这些问题的，最后和底层实现原理，大概就是这个顺序

1、什么是Memory API

简单来说Memory API就是用来控制外部内存的分配与释放，要清楚Memory API的作用我们就要先知道什么是堆外内存

2、什么是堆外内存

堆外内存（Off-Heap Memory），是指在 Java 虚拟机（JVM）堆（Heap）之外、直接向操作系统申请的内存空间。这部分内存空间不受

xmx

、

xms

等参数限制也不参与GC，所以只能手动管理生命周期，笔者之前的文章
字符串常量池真的在堆上吗？
 中介绍了本地内存（Native Memory） ，事实上本地内存就包含了堆外内存，堆外内存包含了如下部分：

元空间（Metaspace）

：存放类的元数据（Class Definitions）、方法信息、常量池等。在 JDK 8 之前叫持久代（PermGen）且在堆内，JDK 8 之后移到了本地内存中。

线程栈（Thread Stacks）

：每个 Java 线程运行时创建的栈。每个线程默认占用 1MB（可通过 

-Xss

 调整）的本地内存。如果有 1000 个线程，这里就要吃掉 1GB 的本地内存。

JVM 内部代码与数据结构

：JVM 本身是用 C++ 写的，它运行也需要内存。比如 JIT 编译器编译代码、GC 运行时自身维护的标记位、垃圾回收算法运行时的临时数据等。

堆外内存（Off-Heap Memory）

：本地内存中

专门划出来给 Java 应用程序存放业务数据

的区域

而堆外内存之所以特殊，是因为它是本地内存中唯一允许 Java 代码直接读写数据的区域

那么堆外内存在哪些场景下可以用呢？

大容量本地缓存：比如上百GB的内存缓存，如果你放堆里那么GC的STW时间会几何级增长，增加GC的CPU使用率，拖累系统，这个时候放堆外内存就非常合适，既还是在内存里但是又不会影响到堆

网络通信与 I/O 缓冲区：当网卡收到数据，操作系统直接将数据写入堆外内存，Java 层的网络框架（如 Netty）直接在原位进行解析，实现零拷贝，诸如Netty、Kafka等高性能Java框架和中间件都是利用了堆外内存来实现高性能

超大数据集的内存计算与大数据处理：和第一个一样，都是大对象在内存的存放，只是这里涉及到计算，为了避免减少影响GC和堆所以可以把这部分数据放到堆外内存中，在堆外内存中进行计算，Spark和Flink都有自己的堆外内存管理器来实现大数据高性能计算

跨进程共享内存（IPC）：不同的进程交换内存数据，就可以在本地内存中开辟一块由操作系统映射的共享区域，两个进程同时挂载它。一个写、一个读，延迟可以低至纳秒级。

总结一下，凡是不想放在堆中的但是又想在代码里面读写操作的东西都可以放到堆外内存里

当然了除了一些以上的业务需求之外，在调用外部C语言的库的时候，Java和C交互的数据就是在堆外内存上，因为外部C语言库不可能直接来堆里取吧，所以

Memory API

和

Foreign Function API

FFI是放一起的

3、不用Memory API如何使用堆外内存

现在我们回到JDK22之前，如果我们不用Memory API这个新特性，我们如何使用堆外内存

3.1、ByteBuffer

这是JDK自己的堆外内存工具，在JDK1.4的时候和NIO一起发布：

ByteBuffer buffer = ByteBuffer.allocateDirect(

1024

);

buffer.putInt(

100

);

buffer.flip();

int

 value = buffer.getInt();

System.out.println(value);

缺点很明显，最大只能放2GB的数据，多了的话自己写多个buffer管理，也没有显式的 

close()

 方法，内存的释放依赖于 JVM 的 GC 机制去回收包装它的 Java 对象（通过 Cleaner / 虚引用）。如果堆内很空闲没触发 GC，堆外哪怕满了也会直接报 

OOM: Direct buffer memory

，对了只能放基础数据类型，复杂的对象不能直接通过API存放，如果需要放对象的话就要使用序列化工具手动序列化（不过堆外内存最终都只能存放基本数据类型）。

3.2、Netty ByteBuf

刚刚说过的Netty也有自己的堆外内存管理工具，这个工具就是：ByteBuf

//从对象池中获取一块堆外内存

ByteBuf pooledBuffer = PooledByteBufAllocator.DEFAULT.directBuffer(

1024

);

//计数 +1（传递给其他线程使用）

pooledBuffer.retain();

// 读写操作、读写指针分离

pooledBuffer.writeInt(

123

);

int

 value = pooledBuffer.readInt();

//计数 -1，降到 0 时堆外内存瞬间被回收

pooledBuffer.release();

System.out.println(value);

可以看作是JDK 

ByteBuffer

的升级版，他解决了

ByteBuffer

的核心两大痛点：大小限制和不能显式回收，如果你忘记回收release的话 Netty还自带了内存泄漏检测器

ResourceLeakDetector

 ，可以在日志里精准打印出这块堆外内存在哪里被申请、在哪里被遗忘的堆栈信息。并且Netty还借鉴了 C 语言中著名的 

jemalloc

内存分配算法，在堆外开辟了一大块连续内存作为“内存池”，避免频繁向操作系统申请和销毁堆外内存。

不过还是只能放基础类型，想放对象的话还是得自己序列化，不过Netty自带了一个

ObjectEncoder

的处理器，但是底层用的是Java原生的序列化，原声序列化性能差且有安全漏洞，生产环境几乎没人用。

3.3、OHC (Off-Heap Cache)

分布式数据库 

Apache Cassandra

 的底层核心组件，后来独立作为开源项目，是专门用来存放海量 Key-Value 数据的堆外缓存库：

   

// 构建缓存：容量2GB，LRU淘汰，开启TTL过期

        

try

 (OHCache<String, String> cache = OHCacheBuilder.<String, String>newBuilder().keySerializer(StringSerializer.INSTANCE)

                .valueSerializer(StringSerializer.INSTANCE)

                

// 最大堆外容量(字节)

                .capacity(

2L

 * 

1024

 * 

1024

 * 

1024

).eviction(Eviction.LRU)

                

// 开启TTL过期

                .timeouts(

true

)

                

// 分段数，建议CPU核数*2

                .segmentCount(

64

).build()) {

            

// 写入（10秒过期）

            cache.put(

"key1"

, 

"value_ohc_test"

, 

10_000

);

            

// 查询

            String val = cache.get(

"key1"

);

            System.out.println(val);

        }

不过需要自己实现序列化：

public

 

class

 

StringSerializer

 

implements

 

CacheSerializer

<

String

> 

{

    

public

static

final

 StringSerializer INSTANCE = 

new

 StringSerializer();

    

@Override

    

public

 

void

 

serialize

(String s, ByteBuffer buf)

 

{

        

byte

[] bytes = s.getBytes(StandardCharsets.UTF_8);

        buf.putInt(bytes.length);

        buf.put(bytes);

    }

    

@Override

    

public

 String 

deserialize

(ByteBuffer buf)

 

{

        

int

 len = buf.getInt();

        

byte

[] bytes = 

new

byte

[len];

        buf.get(bytes);

        

return

new

 String(bytes, StandardCharsets.UTF_8);

    }

    

@Override

    

public

 

int

 

serializedSize

(String s)

 

{

        

return

 Integer.BYTES + s.getBytes(StandardCharsets.UTF_8).length;

    }

}

比较简单主流的就这些，另外还有

OpenHFT

开发的

Chronicle-Bytes & Chronicle-Map

 和

Agrona (Real Logic)

由于堆外内存不是本文重点所以就不赘述了。

4、Memory API如何使用堆外内存

好，到了本文的主角——

Memory API

了，经过前面章节的介绍相信大家对堆外内存和如何使用堆外内存有了一个大概认识，也知道了原生JDK的

ByteBuffer

有哪些痛点和三方是如何优化的，那么我们来看看时隔数十年JDK又推出的

Memory API

是如何做的吧

Memory API

操作堆外内存需要先划分出一区域这决定了堆外内存的生命周期，然后决定内存排布并分配这也会决定如何访问读写这个堆外内存：

划分区域：

//手动控制生命周期，单线程访问

Arena arena = Arena.ofConfined();

//手动控制生命周期，多线程访问

Arena arena = Arena.ofShared();

//生命周期和整个JVM进程一致，多线程访问

Arena arena = Arena.global();

//GC管理生命周期，多线程访问

Arena arena = Arena.ofAuto();

划分堆外内存

Arena

有四个方法，

ofConfined

和

ofShared

是

closeable

的也就是说可以放在

try-with-resource

中，生命周期就是调用

close

之前可以访问调用之后就没了，

global

就是不回收的，跟着整个JVM进程，适合放一些静态数据，但是注意了调用

global

的话建议大小还是不要太大，因为不能回收，到时候达到容器的内存max限制导致容器被重启了就是另外一个故事了。

ofAuto

就是整个生命周期交给了 GC，当 Java 堆内的 Arena 对象和它分配的 Segment 对象都没有引用时，GC 会在某个无法预知的时间点顺便把堆外内存收走(这里GC只会扫描

Areana

生成的

MemorySegment

对象而不会去扫描堆外内存的数据，所以对GC的影响很小)

虽然 FFM 提供了多种 Arena，但生产环境建议优先使用 

ofConfined

 或 

ofShared

 并配合 

try-with-resources

，以获得最确定的内存释放时机

分配内存：

//申请一块 100 字节的堆外内存

MemorySegment data = arena.allocate(

100

)

//结构化分配，自己定义内存布局

StructLayout userLayout = MemoryLayout.structLayout(ValueLayout.JAVA_LONG.withName(

"id"

), ValueLayout.JAVA_INT.withName(

"age"

),

                MemoryLayout.paddingLayout(

4

), ValueLayout.JAVA_DOUBLE.withName(

"score"

));

MemorySegment data = arena.allocate(userLayout)

可以看到分配内存有两种方式，一种是简单粗暴的直接传入大小分配，如果大小比较大可以配合

SegmentAllocator

做切片管理

另外一种是自己定义内存布局分配，第二种可以单独说说。之前在上文中笔者不是说以前的堆外内存的方法都不好存对象吗？无论是jdk自带的

ByteBuffer

还是Netty的

ByteBuf

或者

OHC

这种第三方库，只要你要保存对象都需要把对象序列化然后放到堆外内存里，这样做有一个很大的缺点，就是在修改的场景下，你如果只用修改对象的一个字段，你就得把整个序列化之后的内容都读取出来然后反序列化为对象再操作，然后再序列化回去，众所周知序列化本身就是一个耗费资源的操作，但是如果使用

StructLayout

来自己定义内存布局那么就可以实现单个属性的读写更新了（这里的对象在

Memory API

中不是真正的“Java 堆内对象”，在行为和性能上，变成了一个 “C 语言结构体（C-style Struct）”——也就是一个无包装的“虚拟对象”）

读写数据:

读写数据有两种方式，1如果是简单粗暴的直接申请堆外内存，那么就直接使用

get/set

方法就行了:

//申请一块 100 字节的堆外内存,GC管理生命周期

MemorySegment data = Arena.ofAuto().allocate(

100

);

// 在第 0 字节处，写入一个 4 字节的 int

data.set(ValueLayout.JAVA_INT, 

0

, 

999

); 

// 在第 8 字节处，写入一个 8 字节的 long

data.set(ValueLayout.JAVA_LONG, 

8

, 

123456L

); 

// 在第 16 字节处，写入一个 8 字节的 double 

data.set(ValueLayout.JAVA_DOUBLE, 

16

, 

88.8

); 

//以上要小心内存对齐

// 读取数据

int

 myInt = data.get(ValueLayout.JAVA_INT, 

0

);

long

 myLong = data.get(ValueLayout.JAVA_LONG, 

4

);

如果是使用了自定义内存布局那么就得使用

VarHandle

来读写:

 StructLayout userLayout = MemoryLayout.structLayout(ValueLayout.JAVA_LONG.withName(

"id"

), ValueLayout.JAVA_INT.withName(

"age"

),

                MemoryLayout.paddingLayout(

4

), ValueLayout.JAVA_DOUBLE.withName(

"score"

));

        

try

 (Arena arena = Arena.ofConfined()) {

            MemorySegment userSegment = arena.allocate(userLayout);

            

// 3. 通过自定义中的布局中的路径（Path），生成直达 age 和 score 字段的变量句柄

            VarHandle idHandle = userLayout.varHandle(MemoryLayout.PathElement.groupElement(

"id"

));

            VarHandle ageHandle = userLayout.varHandle(MemoryLayout.PathElement.groupElement(

"age"

));

            VarHandle scoreHandle = userLayout.varHandle(MemoryLayout.PathElement.groupElement(

"score"

));

            

//假设我们需要保存这个Java对象Student到堆外内存中

            Student student = 

new

 Student(

6324L

, 

18

, 

99.50

);

            

// 4. 直接在堆外内存原位（In-place）写入数据

            

// 在 id 对应的位置写入 6324

            idHandle.set(userSegment, 

0L

, student.id());

            

// 在 age 对应的位置写入 18

            ageHandle.set(userSegment, 

0L

, student.age());

            

// 在 score 对应的位置写入 99.5

            scoreHandle.set(userSegment, 

0L

, student.score);

            

// 从堆外内存直接读取数据

            

long

 id = (

long

) idHandle.get(userSegment, 

0L

);

            

int

 age = (

int

) ageHandle.get(userSegment, 

0L

);

            

double

 score = (

double

) scoreHandle.get(userSegment, 

0L

);

            Student offHeapStudent = 

new

 Student(id, age, score);

            

//修改堆外内存中的age的值

            ageHandle.set(userSegment, 

0L

, 

19

);

        }

这样我们就不用去序列化我们的对象了，笔者个人觉得这个有点像逃逸分析中的标量替换（用途不一样，但是有点那种去对象化的思想）

这里是单个对象的例子，如果是对象集合的话可以用

SequenceLayout

搞成堆外数组

VarHandle

 不仅仅是读写工具，它是 FFM API 实现

类型安全

和硬件亲和性（内存对齐）的关键桥梁

简单总结一下，

Memory API

其实解决了以前使用堆外内存的时候的很多痛点1了

5、Memory API底层原理

介绍了如何使用之后，按照笔者的习惯就要深入源码看看这东西的底层原理了

这里我们可以关注的是如何分配和如何管理生命周期的，篇幅原因如何读写这里不介绍了，知道了怎么分配管理的那么如何读写的就自然而然明白了

新建一个

Arena

上文说了有四种方式，然后可以分成两种类型，一种是自动控制周期的第二种是手动控制的，我们每一种选一个来看，首先看

Arena.ofAuto()

:

static

 Arena 

ofAuto

()

 

{

    

return

 MemorySessionImpl.createImplicit(CleanerFactory.cleaner()).asArena();

}

这里

asArena

就是返回一个

Arena

的实现类：

    

public

 ArenaImpl 

asArena

()

 

{

        

return

 

new

 ArenaImpl(

this

);

    }

这也是

Arena.ofAuto

最后的返回值：

public

 

static

 MemorySessionImpl 

createImplicit

(Cleaner cleaner)

 

{

    

return

 

new

 ImplicitSession(cleaner);

}

createImplicit

其实很简单就是返回一个

ImplicitSession

实例，

MemorySessionImpl

就是一个内存管家，负责记录这块内存是否已经关闭、是不是还在被使用，

asArena

主要是包装成

Arena

便于外部使用，这里的重点主要是

CleanerFactory.cleaner()

，这正是

ofAuto

的精髓，因为

ofAuto

是会自动回收清除，的那么一定会有一个清理的逻辑:

public

 

final

class

 

CleanerFactory

 

{

    

/* The common Cleaner. */

    

private

static

final

 Cleaner commonCleaner = Cleaner.create(

new

 ThreadFactory() {

        

@Override

        

public

 Thread 

newThread

(Runnable r)

 

{

            

return

 InnocuousThread.newSystemThread(

"Common-Cleaner"

,

                    r, Thread.MAX_PRIORITY - 

2

);

        }

    });

    

/**

     * Cleaner for use within system modules.

     *

     * This Cleaner will run on a thread whose context class loader

     * is {

@code

 null}. The system cleaning action to perform in

     * this Cleaner should handle a {

@code

 null} context class loader.

     *

     * 

@return

 a Cleaner for use within system modules

     */

    

public

 

static

 Cleaner 

cleaner

()

 

{

        

return

 commonCleaner;

    }

}

这里是在

static

里面新建了一个无害线程来进行清理工作，所谓无害线程就是 JVM 的一种设计模式，这种线程没有 Context ClassLoader，也不会被应用层的框架（如 Spring 的 ThreadLocal）所污染。这保证了不管应用代码写得多么复杂、ThreadLocal 塞了多少数据，这个清理线程永远是纯净的，不会因为 ThreadLocal 的遗留问题导致内存泄漏。

自动清理是这个

ofAuto

的精髓，我们可以深入看下如何自动清理的，外层是新建线程工厂，重点还是

Cleaner.create

一个静态新建方法：

public

 

static

 Cleaner 

create

(ThreadFactory threadFactory)

 

{

    Objects.requireNonNull(threadFactory, 

"threadFactory"

);

    Cleaner cleaner = 

new

 Cleaner();

    cleaner.impl.start(cleaner, threadFactory);

    

return

 cleaner;

}

这里就是新建了一个

Cleaner

的实例，然后调用了

start

方法：

public

 

void

 

start

(Cleaner cleaner, ThreadFactory threadFactory)

 

{

    

if

 (getCleanerImpl(cleaner) != 

this

) {

        

throw

new

 AssertionError(

"wrong cleaner"

);

    }

    

// schedule a nop cleaning action for the cleaner, so the associated thread

    

// will continue to run at least until the cleaner is reclaimable.

    

new

 CleanerCleanable(cleaner);

    

if

 (threadFactory == 

null

) {

        threadFactory = CleanerImpl.InnocuousThreadFactory.factory();

    }

    

// now that there's at least one cleaning action, for the cleaner,

    

// we can start the associated thread, which runs until

    

// all cleaning actions have been run.

    Thread thread = threadFactory.newThread(

this

);

    thread.setDaemon(

true

);

    thread.start();

}

这里就是启动清理线程了，可以看到传入的

runable

参数是

this

，就说明这个

CleanerImpl

肯定是实现了

Runnable

接口的，所以直接看

run

方法：

@Override

public

 

void

 

run

()

 

{

    Thread t = Thread.currentThread();

    InnocuousThread mlThread = (t 

instanceof

 InnocuousThread)

            ? (InnocuousThread) t

            : 

null

;

   

//周期性的检查是否有存活的数据

    

while

 (!activeList.isEmpty()) {

        

if

 (mlThread != 

null

) {

            

// Clear the thread locals

           

//清理数据

            mlThread.eraseThreadLocals();

        }

        

try

 {

            

// Wait for a Ref, with a timeout to avoid a potential hang.

            

// The Cleaner may become unreachable and its cleanable run,

            

// while there are registered cleanables for other objects.

            

// If the application explicitly calls clean() on all remaining

            

// Cleanables, there won't be any references enqueued to unblock

            

// this.  Using a timeout is simpler than unblocking this by

            

// having cleaning of the last registered cleanable enqueue a

            

// dummy reference.

            

//看注释就够了，就是一个生产消费者模型，GC线程把没有引用了的放到队列里，这里消费

            Cleanable ref = (Cleanable) queue.remove(

60

 * 

1000L

);

            

if

 (ref != 

null

) {

              

//清理

                ref.clean();

            }

        } 

catch

 (Throwable e) {

            

// ignore exceptions from the cleanup action

            

// (including interruption of cleanup thread)

          

//忽略异常，不影响清理线程

        }

    }

}

就是一个简单的生产消费者模式，GC线程扫描然后放到队列，清理线程消费然后clean，这里非常精妙的点在于最后的

catch

，之所以这样设计是因为如果它因为某个资源的清理失败而挂掉，那么整个 JVM 的堆外内存清理机制就会停摆，后续所有申请的堆外内存都将永久泄露。因此，它被设计成“不论发生什么，都必须继续工作”，也就是说目的是为了让清理线程不死掉。

看了源码之后其实就可以发现

ofAuto

的一个隐藏的坑，即清理是单线程在做，如果创建多了，清理的速度就跟不上了，清理的就会很慢，会造成一种堆外内存泄露的“假象”，所以我们还需要用到

ofConfined

来自己手动管理：

    

static

 Arena 

ofConfined

()

 

{

        

return

 MemorySessionImpl.createConfined(Thread.currentThread()).asArena();

    }

    ...

    

public

 

static

 MemorySessionImpl 

createConfined

(Thread thread)

 

{

        

return

 

new

 ConfinedSession(thread);

    }

这里

ofConfined

就简单很多了，就是新建了一个

ConfinedSession

，然后传入当前线程作为owner，之所以这样是因为

ofConfined

只能单线程读写，所以要给每个

ofConfined

对应的堆外内存区域一个所有者，完成无锁化，这样读写的时候就直接判断当前线程是不是所有者就行了；

ConfinedSession

是

MemorySessionImpl

的一个子类，他在内部实现了一套可重入、多引用的情况下如何安全释放堆外内存的逻辑，即：如何让一段堆外内存同时被多个逻辑块安全持有，且互不干扰地销毁，简单来说就是在内部用了两个计数器，一个是被同线程下其他方法引用的次数，第二个是被其他线程引用的次数（虽然 

ofConfined

 强制要求在读写数据时必须由 Owner 线程执行，但其生命周期（即何时 Close）可能会被更高级别的容器（如 

SharedSession

）所代理，因此它需要通过原子计数器来保证在复杂的嵌套引用下依然安全），只有这两个次数都是0了才会去回收关闭这段内存，这种计数器机制并非单纯的加锁，而是通过轻量级的原子操作与分支预测友好的判断，实现了内存安全与无锁并发的平衡。它让 JVM 既不用实时监控内存引用（避免 GC 压力），又能通过显式的租约管理，确保开发者在使用这块内存时，它永远处于‘已分配’状态，从而在 JIT 编译后消除了所有不必要的运行时开销。

所以对于新建简单总结一下，

Arena.ofAuto

通过一个回收线程来进行回收而什么时候回收是GC来决定的实现原理就是一个生产消费者模式，GC把需要回收的放入队列里，回收线程消费。而

ofConfined

则是在区域内自行关闭，关闭前会检查引用情况，确保不会错误的关闭这段堆外内存。

不过这两方法都算只是声明了一个堆外内存在Java里，并没有实际上去使用堆外的内存，

allocate

才是去分配一块内存，

Arena

只是一个堆外内存的声明，负责生命周期管理，

allocate

 返回的 

MemorySegment

才是一片堆外内存，之所以要分开，是因为在一个生命周期内，万一需要多次分配堆外内存呢？（其实这也是一个好处，多次分配一次close避免泄露）

allocate

有两种最常见的重载，一个是传入具体的

byteSize

来手动圈定一个大小的区域，第二个传入

StructLayout

也就是手动定义一个布局，这里为了简单我们只看第一个固定大小的：

default

 MemorySegment 

allocate

(

long

 byteSize)

 

{

     

return

 allocate(byteSize, 

1

);

 }

 ...

@Override

public

 NativeMemorySegmentImpl 

allocate

(

long

 byteSize, 

long

 byteAlignment)

 

{

    

return

 SegmentFactories.allocateNativeSegment(byteSize, byteAlignment, session, shouldReserveMemory, 

true

);

}

...

public

 

static

 NativeMemorySegmentImpl 

allocateNativeSegment

(

long

 byteSize, 

long

 byteAlignment, MemorySessionImpl sessionImpl,

                                                                

boolean

 shouldReserve, 

boolean

 init)

 

{

        

long

 address = SegmentFactories.allocateNativeInternal(byteSize, byteAlignment, sessionImpl, shouldReserve, init);

        

return

new

 NativeMemorySegmentImpl(address, byteSize, 

false

, sessionImpl);

    }

一顿跳转，最后是到了

SegmentFactories.allocateNativeInternal

中去分配的，然后返回内存地址，封装成

NativeMemorySegmentImpl

返回，所以我们看

SegmentFactories.allocateNativeInternal

:

private

 

static

 

long

 

allocateNativeInternal

(

long

 byteSize, 

long

 byteAlignment, MemorySessionImpl sessionImpl,

                                           

boolean

 shouldReserve, 

boolean

 init)

 

{

   

//预检查与对齐规范化

    ensureInitialized();

    Utils.checkAllocationSizeAndAlign(byteSize, byteAlignment);

    sessionImpl.checkValidState();

    

if

 (VM.isDirectMemoryPageAligned()) {

        byteAlignment = Math.max(byteAlignment, AbstractMemorySegmentImpl.NIO_ACCESS.pageSize());

    }

    

// Align the allocation size up to a multiple of 8 so we can init the memory with longs

    

long

 alignedSize = init ? Utils.alignUp(byteSize, Long.BYTES) : byteSize;

    

// Check for wrap around

    

if

 (alignedSize < 

0

) {

        

throw

new

 OutOfMemoryError();

    }

    

// Always allocate at least some memory so that zero-length segments have distinct

    

// non-zero addresses.

    alignedSize = Math.max(

1

, alignedSize);

    

long

 allocationSize;

    

long

 allocationBase;

    

long

 result;

    

//计算分配空间，因为对齐可能会多申请空间

    

if

 (byteAlignment > MAX_MALLOC_ALIGN) {

        allocationSize = alignedSize + byteAlignment - MAX_MALLOC_ALIGN;

        

if

 (shouldReserve) {

            AbstractMemorySegmentImpl.NIO_ACCESS.reserveMemory(allocationSize, byteSize);

        }

        allocationBase = allocateMemoryWrapper(allocationSize);

        result = Utils.alignUp(allocationBase, byteAlignment);

    } 

else

 {

        allocationSize = alignedSize;

        

if

 (shouldReserve) {

            AbstractMemorySegmentImpl.NIO_ACCESS.reserveMemory(allocationSize, byteSize);

        }

        allocationBase = allocateMemoryWrapper(allocationSize);

        result = allocationBase;

    }

    

//核心分配内存

    

if

 (init) {

        initNativeMemory(result, alignedSize);

      ...

        

private

 

static

 

void

 

initNativeMemory

(

long

 address, 

long

 byteSize)

 

{

        

for

 (

long

 i = 

0

; i < byteSize; i += Long.BYTES) {

            UNSAFE.putLongUnaligned(

null

, address + i, 

0

);

        }

      ...

    }

    }

//注册自动清理

    sessionImpl.addOrCleanupIfFail(

new

 MemorySessionImpl.ResourceList.ResourceCleanup() {

        

@Override

        

public

 

void

 

cleanup

()

 

{

            UNSAFE.freeMemory(allocationBase);

            

if

 (shouldReserve) {

                AbstractMemorySegmentImpl.NIO_ACCESS.unreserveMemory(allocationSize, byteSize);

            }

        }

    });

    

return

 result;

}

这里除了内存对齐和计算空间做必要的校验之外，其实核心清除内存和分配内存用的都是

unsafe

这其实和老版本JDK的堆外内存使用的底层原理是一致，只是

Memory API

现在做了很多处理，比如生命周期管理、内存对齐等等，来完善老版本的缺点，

所以

Memory API

在堆外内存的使用上底层原理和原来的没有区别只是额外做了很多安全性防御性的工作俗称的包了一层

6、总结

我们可以对比一下包含

Memory API

在内的主流堆外内存管理器：

特性

ByteBuffer (JDK 1.4)

Netty ByteBuf

Memory API (FFM)

生命周期管理

依赖 GC (Cleaner)

引用计数 (手动)

显式作用域 (Arena)

内存释放

延迟/不可控

及时/精确

及时/确定性

读写安全

无校验 (易 Crash)

有越界校验

类型安全 + 内存边界校验

内存结构

扁平字节流

扁平字节流 (支持池化)

支持结构化布局 (StructLayout)

并发支持

有限

优秀 (EventLoop 模式)

卓越 (无锁线程封闭/安全共享)

适用场景

基础 I/O

网络中间件、高性能通信

系统级编程、高性能计算、FFI

从上表可以看出，

Memory API

并非单纯为了“分配内存”而生，它通过引入 

Arena（作用域）

 解决了内存释放的确定性难题，通过 

StructLayout（内存布局）

 解决了手动计算偏移量的复杂度和安全性问题。它不仅承接了 

Netty ByteBuf

 在高性能计算领域的优势，还通过 JVM 原生支持，消除了三方库在序列化和类型安全上的痛点，是 Java 走向底层高性能编程的必然选择

          

            var first_sceen__time = (+new Date());
            if ("" == 1 && document.getElementById('js_content')) {
              document.getElementById('js_content').addEventListener("selectstart",function(e){ e.preventDefault(); });
            }
