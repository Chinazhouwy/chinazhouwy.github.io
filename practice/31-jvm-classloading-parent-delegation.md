---
schema_version: 1
question_id: 31
question: "JVM 类加载机制、双亲委派和打破双亲委派"
date: 2026-06-14
sources:
  - middleware/2026-06-01-jvm-core-principles-troubleshooting.md
  - java/eleme-java-backend-round1.md
  - java/baidu-java-backend-round2-concurrency.md
score: "4.5/10"
round: R0
next_review: unknown
session_id: unknown
status: completed
---
# 第 31 题：JVM 类加载机制、双亲委派和打破双亲委派

> **得分：4.5 / 10**
> **来源：** `middleware/2026-06-01-jvm-core-principles-troubleshooting.md`、`java/eleme-java-backend-round1.md`、`java/baidu-java-backend-round2-concurrency.md`

---

## 核心概念

### 类加载五个阶段

```
加载(Loading) → 验证(Verification) → 准备(Preparation) → 解析(Resolution) → 初始化(Initialization)
```

| 阶段 | 关键操作 | 面试要点 |
|------|----------|----------|
| **加载** | 通过全限定类名找到 `.class` 文件的二进制字节流，生成 `Class` 对象 | 加载源可以是 jar、网络、动态代理 |
| **验证** | 检查字节码是否合法（文件格式、元数据、字节码、符号引用） | 安全性兜底 |
| **准备** | 为**类变量**（static）分配内存并设零值 | `static int a = 10` → a=0，不是10 |
| **解析** | 符号引用 → 直接引用 | 把类名字符串变成指向内存的指针 |
| **初始化** | 执行 `<clinit>` 方法（static 块 + static 变量赋值） | 这时 a 才变成 10 |

### 双亲委派模型

```
收到加载请求
  → 先委托父加载器加载
    → 父加载器再往上委托，直到 Bootstrap
      → Bootstrap 加载不了，往下返回
        → 子加载器自己尝试加载
```

| 加载器 | 加载什么 | 实现 |
|--------|----------|------|
| **Bootstrap ClassLoader** | `rt.jar`（`java.lang.String` 等核心类） | C++，返回 null |
| **Extension ClassLoader** | `/jdk/jre/lib/ext/` 目录下的扩展类 | Java |
| **Application ClassLoader** | classpath 下的应用类 | Java，最常用 |

### 打破双亲委派的场景

| 场景 | 原因 | 怎么打破 |
|------|------|----------|
| **Tomcat** | 同一 JVM 跑多个 Web 应用，依赖同一类的不同版本 | 每个 WebApp 有独立 ClassLoader，优先自己加载 |
| **SPI（JDBC）** | Driver Manager 在 rt.jar，驱动在 classpath | 线程上下文类加载器反向委托 |
| **OSGi** | 模块热替换 | 模块间网状类加载 |

---

## 用户回答记录

### 初始回答

**五个阶段：** 只记得"装载"和"运行卸载"，其余忘了。

**双亲委派：** 核心流程方向对——先委托父加载器，一直往上导，父类不能加载再自己加载。但缺乏细节和层次。

**打破双亲委派：** 说对了 Tomcat 场景——要兼容多 class 版本，类版本不一样也能兼容运行。

**评分：4.5 / 10**

---

## 追问 + 纠正记录

### 追问 1：解析阶段在干什么？rt.jar 和 ext 是什么？类加载器怎么判断这个类自己能否加载？

**用户理解偏差：** 对「解析」概念模糊，不清楚 rt.jar 和 ext 目录的含义，也不理解 ClassLoader 如何判断加载范围。

**纠正：**

1. **解析阶段** = 把符号引用（类名字符串）变成直接引用（内存指针）
   ```
   符号引用: "com.example.OrderService.save"
       ↓ 解析
   直接引用: 0x7f8b3c004a20（内存地址）
   ```

2. **rt.jar = Runtime JAR**，Java 运行时核心类库，`java.lang.String`、`java.util.HashMap` 全在里面

3. **每个 ClassLoader 负责固定目录**：
   - Bootstrap → `/jdk/jre/lib/`（rt.jar 等）
   - Extension → `/jdk/jre/lib/ext/`
   - Application → classpath（项目 jar、编译后的 class）
   
   目录里有就加载，没有就返回 null，交给子加载器去试。

---

### 追问 2：类加载器的目的就是初始化类对吧？为什么不能都用一个 ClassLoader？

**用户理解偏差：** 把类加载器的职责等同于「初始化」；质疑双亲委派的必要性。

**纠正：**

1. **类加载器的职责不是初始化**，而是「找到文件 → 读字节码 → 生成 Class 对象」。初始化只是五个阶段中的最后一个。

2. **为什么不用一个 ClassLoader**：
   - 一个 ClassLoader 只能加载一个版本的同名类
   - 如果 App-A 用 fastjson 1.2.83，App-B 用 fastjson 2.0.40，同一个 ClassLoader 只能加载一个版本
   - 会导致 `ClassCastException` / `NoSuchMethodError`

---

### 追问 3：Tomcat 怎么控制版本？

**用户疑问：** 想理解 Tomcat 具体怎么用不同 ClassLoader 实现版本隔离。

**纠正：**

Tomcat 的 ClassLoader 结构：

```
Bootstrap ClassLoader
  ↓
Extension ClassLoader
  ↓
Application ClassLoader
  ↓
Common ClassLoader（Tomcat 公共类）
  ↓                    ↓
WebappA ClassLoader   WebappB ClassLoader
路径：/webapps/A/      路径：/webapps/B/
WEB-INF/classes       WEB-INF/classes
WEB-INF/lib/*.jar     WEB-INF/lib/*.jar
```

**根本原理**：不同的 ClassLoader 实例，各自负责不同的目录，各自加载各自的版本，互不干扰。

```java
// Tomcat 源码简化
public class WebappClassLoader extends ClassLoader {
    private String webappPath;
    // WebappA 实例：webappPath = "/webapps/A/WEB-INF/classes"
    // WebappB 实例：webappPath = "/webapps/B/WEB-INF/classes"
}
```

---

## 最终结论

| 用户问题 | 结论 |
|---------|------|
| 类加载器是不是初始化类？ | 不是，是「找到文件→读字节码→生成 Class 对象」 |
| 为什么不用一个 ClassLoader？ | 一个 ClassLoader 只能加载一个版本的同名类，会冲突 |
| Tomcat 怎么控制版本？ | 每个应用一个独立的 ClassLoader 实例，各自扫自己的目录 |

---

## 这次讨论的收获

1. **五个阶段是固定顺序**：加载→验证→准备→解析→初始化，死记也要记住
2. **「准备」≠「初始化」**：static 变量的零值赋值在准备阶段，真正的赋值在初始化阶段
3. **双亲委派不只是说流程**：面试官想听「为什么」和「什么时候打破」
4. **SPI 是打破双亲委派最高频的考点**：Tomcat 反而是第二位
5. **类加载器的核心是隔离**：不同的 ClassLoader 实例负责不同目录，实现版本隔离
