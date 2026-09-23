---
title: "再见了EasyExcel，我决定用Apache Fesod"
date: "2026-09-08"
domain: "学习"
area: "Java 后端"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "记录 EasyExcel 停更归档、FastExcel 承接与更名 Apache Fesod 的演进过程，对比主流 Excel 技术方案并给出迁移步骤与选型建议。"
tags:
  - EasyExcel
  - FastExcel
  - Apache Fesod
  - Apache POI
  - Excel
  - Java
source: "掘金「苏三说技术」"
source_url: "https://juejin.cn/post/7682698191628632107"
published_at: "2026-09-08 11:51:38 +08:00"
---

# 再见了EasyExcel，我决定用Apache Fesod

> **来源**：掘金「苏三说技术」
>
> **发布时间**：2026-09-08 11:51（北京时间）
>
> **原文链接**：<https://juejin.cn/post/7682698191628632107>

## 前言

不知道你最近发现了没？

EasyExcel不仅没新功能了，连Bug都没人修了。

GitHub仓库已经在2025年9月被阿里正式归档。

但这个故事没有结束。

EasyExcel的作者在离开阿里之后，做了一个所有人都没想到的事——重新写了一个项目FastExcel。

但最近FastExcel又改名了。

今天这篇文章就专门跟大家一起聊聊这个话题，希望对你会有所帮助。

更多项目实战在Java突击队网：susan.net.cn/project

## 一、EasyExcel是怎么“凉”的？

在聊FastExcel之前，我们先搞清楚EasyExcel是怎么走到这一步的。

EasyExcel是阿里在2018年开源的Java Excel处理库，一度是GitHub上最火的Java项目之一，**累计超过33,000颗Star**。

它最大的突破是把Excel解析方式换成了**SAX流式解析**——不一次性把整个Excel加载进内存，而是一行一行地读。

官方测试数据显示，**仅需16MB内存就可以读取75M（46万行25列）的Excel文件，耗时仅23秒**。

在那个POI动不动就OOM的年代，EasyExcel的出现堪称救星。

但问题出在2023年。

EasyExcel的核心作者（玉箫）从阿里离职了。

之后，EasyExcel进入了**事实上的停更状态**：

- **GitHub Issues响应延迟超过30天**
- **PR合并基本停滞**
- **近半年无正式版本发布**（最新v3.3.2发布于2023年10月）
- **对Spring Boot 3.x、Java 21、Apache POI 5.x的兼容性支持滞后**

2024年11月，阿里正式宣布EasyExcel将停止更新，逐步进入维护模式。

2025年9月，GitHub仓库被正式归档，变成了**只读状态**。

很多人以为故事到这里就结束了。

一个33k Star的项目，就这样“凉”了。

但就在大家一筹莫展之际，原作者站了出来。

## 二、FastExcel来了

2024年12月，EasyExcel原作者玉箫公开了一个新项目——**FastExcel**。

很多人以为FastExcel只是EasyExcel的简单fork。

结果一看代码才发现，**这几乎是一场彻底重构**。

### 2.1 FastExcel和EasyExcel的关系

FastExcel和EasyExcel的关系可以总结为四个字：**无缝承接**。

| 对比维度 | EasyExcel（停更） | FastExcel（活跃） |
| --- | --- | --- |
| **API兼容性** | — | **完全一致** |
| **迁移成本** | — | **换包名就行** |
| **性能** | 基准 | **更好、更稳定** |
| **功能** | 基本功能 | **读取指定行数、Excel转PDF** |
| **维护状态** | ❌ 已归档 | ✅ **持续更新** |
| **开源协议** | Apache 2.0 | **MIT（商业友好）** |

FastExcel做了三件关键的事情：

**第一，性能继续压榨。** 在原有SAX解析基础上，进一步优化了内存和IO处理。实测中，有开发者从EasyExcel切换到FastExcel后，**处理时间从将近1分钟降到了18秒左右，内存峰值控制在800MB以内**。

**第二，支持更多复杂Excel特性。** 1.0.0版本就新增了读取Excel指定行数和将Excel转换为PDF的功能。很多原本需要自己写大量代码的功能，被重新封装进了框架里。

**第三，兼容EasyExcel API。** 这是最关键的一点——从EasyExcel迁移到FastExcel，**只需简单地更换包名和Maven依赖即可完成升级**。很多项目甚至可以一行代码不改，直接迁移。

从EasyExcel到FastExcel，代码几乎不用改：

```xml
<!-- EasyExcel（已停更） -->
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>easyexcel</artifactId>
    <version>4.0.3</version>
</dependency>

<!-- FastExcel（活跃维护） -->
<dependency>
    <groupId>cn.idev.excel</groupId>
    <artifactId>fastexcel</artifactId>
    <version>1.3.0</version>  <!-- 请使用最新版本 -->
</dependency>
```

Java代码层面，把`com.alibaba.excel`改成`cn.idev.excel`就行。

API几乎一模一样，迁移成本极低。

FastExcel上线短短一个月，GitHub星标就突破了1.8K。

## 三、FastExcel又“消失”了？

如果你最近去GitHub搜FastExcel，可能会发现搜不到原来的项目了。

**别慌。不是项目死了，是它“毕业”了——进入了Apache软件基金会。**

2025年底到2026年初，FastExcel的作者把项目**整套捐给了Apache软件基金会**，成为Apache POI的子项目，更名为**Apache Fesod (Incubating)**。

“Fesod”的全称是**“Fast. Easy. Spreadsheet and Other Documents”**——Fast、Easy、Spreadsheet和其他文档。

2026年1月21日，Fesod发布了第一个孵化版本**2.0.0-incubating**。

2026年2月11日，**2.0.1-incubating**正式发布。

**这意味着什么？**

代码所有权从个人/公司转给了Apache基金会——**跟Apache POI、Maven、Tomcat一个待遇**。

这意味着长期维护有了保障，版本节奏会跟Apache其他项目一样稳定，不会再出现“原作者离职就停更”的情况。

这不是“FastExcel死了”，而是**“FastExcel拿到了Apache终身保障”**。

## 四、FastExcel vs Fesod 现在该用哪个？

很多人可能会懵：“上个月刚改完import，怎么又换名字了？”

**别紧张。这次不是停更，是升级。**

| 对比维度 | FastExcel | Apache Fesod |
| --- | --- | --- |
| **groupId** | `cn.idev.excel` | `org.apache.fesod` |
| **artifactId** | `fastexcel` | `fesod` |
| **状态** | 过渡命名，新项目别用 | Apache孵化中 |
| **最新版本** | 1.3.0 | 2.0.1-incubating |
| **维护保障** | 个人维护 | **Apache基金会长期保障** |

**判断很简单**：

- **新项目** → 直接上**Apache Fesod**，少一次后续迁移
- **现有EasyExcel/FastExcel项目** → 切Fesod，**三步走**

## 五、代码实战

如果你现在在用FastExcel，迁移到Fesod其实非常简单。

核心就是换坐标、改import、换入口类。

### 5.1 第一步：替换Maven依赖

```xml
<!-- 旧的FastExcel -->
<dependency>
    <groupId>cn.idev.excel</groupId>
    <artifactId>fastexcel</artifactId>
    <version>1.3.0</version>
</dependency>

<!-- 新的Apache Fesod -->
<dependency>
    <groupId>org.apache.fesod</groupId>
    <artifactId>fesod</artifactId>
    <version>2.0.1-incubating</version>
</dependency>
```

### 5.2 第二步：修改导入包

把`cn.idev.excel`改成`org.apache.fesod`：

```java
// 旧的导入
import cn.idev.excel.EasyExcel;
import cn.idev.excel.annotation.ExcelProperty;

// 新的导入
import org.apache.fesod.Fesod;
import org.apache.fesod.annotation.ExcelProperty;
```

### 5.3 第三步：换入口类

```java
// 旧的FastExcel写法
EasyExcel.write(response.getOutputStream(), User.class)
    .sheet("用户列表")
    .doWrite(users);

// 新的Fesod写法（API几乎一致）
Fesod.write(response.getOutputStream(), User.class)
    .sheet("用户列表")
    .doWrite(users);
```

### 5.4 完整示例：百万行数据导出

```java
@RestController
@RequestMapping("/api/export")
public class ExportController {

    @GetMapping("/orders")
    public void exportOrders(HttpServletResponse response) throws IOException {
        // 设置响应头
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setCharacterEncoding("utf-8");
        String fileName = URLEncoder.encode("订单报表", "UTF-8").replaceAll("\\+", "%20");
        response.setHeader("Content-disposition", "attachment;filename*=utf-8''" + fileName + ".xlsx");

        // 流式写入——边查边写，不OOM
        try (ExcelWriter writer = Fesod.write(response.getOutputStream(), OrderExportVO.class)
                .sheet("订单数据")
                .build()) {

            int page = 1;
            int pageSize = 10000;
            while (true) {
                List<OrderExportVO> pageData = orderService.pageOrders(page, pageSize);
                if (pageData.isEmpty()) {
                    break;
                }
                writer.write(pageData);
                page++;
            }
        }
    }
}
```

这就是Fesod的核心优势——**流式写入，百万行数据也不会OOM**。

有物流企业使用FastExcel（现Fesod）后，**报表生成时间从4小时缩短至20分钟，服务器资源占用减少60%**。

## 六、5种技术方案对比

| 方案 | 维护状态 | 适用规模 | 内存模型 | 致命短板 |
| --- | --- | --- | --- | --- |
| **Apache POI** | 活跃 | 任意 | DOM（重） | 十万行级写入容易OOM |
| **POI SXSSF** | 活跃 | 大文件 | 流式 | **写还行，读不擅长** |
| **HuTool Excel** | 活跃 | <1万行 | 简单 | 高级特性受限 |
| **EasyExcel** | ❌ **2024年停更** | 任意 | 流式 | 不再有新功能/bug修复 |
| **FastExcel** | ⚠️ **过渡命名** | 任意 | 流式 | 已是过渡命名，新项目别用 |
| **Apache Fesod** | ✅ **Apache孵化** | 任意 | 流式 | 仍在Incubating阶段 |

**性能数据对比**（50万行写入）：

| 方案 | 写入速度 | GC次数 | GC暂停 | 峰值内存 | 综合评价 |
| --- | --- | --- | --- | --- | --- |
| dhatim/FastExcel | 13s | 18次 | 285ms | 1.68GB | 速度最快，内存效率差 |
| **Apache Fesod** | 21s | **7次** | **68ms** | - | **综合最优** |
| EasyExcel/FastExcel | 相当 | 相当 | 42-55ms | - | 性能一致 |

Apache Fesod速度与其他流式框架在同一量级（差异<10%），但**内存效率遥遥领先——GC次数仅为其他框架的40%**。

高并发场景下，**内存效率比原始速度更重要——一个GC暂停可能抵消所有速度优势**。

## 七、优缺点

### 优点

**1. API无缝迁移**<br>
从EasyExcel到FastExcel再到Fesod，API几乎完全一致。迁移成本极低，换包名就能用。

**2. 流式处理，百万行不OOM**<br>
继承EasyExcel的SAX流式解析基因，百万行数据边读边处理，内存占用始终控制在MB级。

**3. 持续迭代，功能不断增强**<br>
读取指定行数、Excel转PDF等实用功能，底层流式处理逻辑持续优化。

**4. Apache基金会保障**<br>
项目进入Apache孵化器后，**代码所有权从个人/公司转给基金会**，长期维护有保障。

**5. MIT协议，商业友好**<br>
MIT协议允许商业场景免费使用、二次开发。

**6. 内存效率行业领先**<br>
Fesod的GC效率比EasyExcel/FastExcel高2.5倍，GC次数仅为其他框架的40%。

### 缺点

**1. 还在孵化阶段**<br>
Apache Fesod目前还在Incubating阶段，2.x API有微调。

**2. 命名变迁有点乱**<br>
一年三连跳——EasyExcel → FastExcel → Apache Fesod。很多人刚换了FastExcel，又得换Fesod。

**3. FastExcel已停更**<br>
FastExcel 1.3.0之后不会再更新了。还用FastExcel意味着不会有新功能和bug修复。

**4. 需要改代码**<br>
从FastExcel迁移到Fesod需要换坐标、改import、换入口类。虽然工作量不大，但还是要改。

## 八、选型建议

| 场景 | 推荐 | 理由 |
| --- | --- | --- |
| **新项目** | ✅ **Apache Fesod** | 少一次后续迁移 |
| **在用EasyExcel** | ✅ **迁移到Fesod** | 换依赖+改import |
| **在用FastExcel** | ✅ **迁移到Fesod** | 换坐标+改import+换入口类 |
| **极简场景（几行Excel）** | HuTool一行调用 | 别上重武器 |
| **需要Excel转PDF** | ✅ **Fesod** | 内置该能力 |

更多项目实战在Java突击队网：susan.net.cn/project

## 九、写在最后

回到最初的问题：**EasyExcel凉了？FastExcel又改名了？**

EasyExcel确实凉了。

2025年9月阿里正式归档了GitHub仓库，不再有任何维护。

FastExcel没有凉，它只是“毕业”了——**从个人项目升级成了Apache顶级开源项目**，改名叫Apache Fesod。

从EasyExcel到FastExcel再到Apache Fesod，这个Excel处理库完成了一次罕见的**“一年三连跳”**。

这其实是开源项目能拿到的最好结局——从个人维护变成了Apache基金会长期保障。

对于开发者来说，现状其实很简单：

- **新项目直接上Apache Fesod**
- **老项目逐步迁移，从EasyExcel/FastExcel换到Fesod**

别因为“又要改代码”就犹豫。

这次迁移换来的，是Apache基金会级的长期维护保障、持续的功能迭代、以及更优的内存效率。

Fesod还处于孵化阶段，但已经有很多企业开始在真实场景中使用了。

对于需要处理大规模Excel的企业来说，这是目前最值得选择的方案。
