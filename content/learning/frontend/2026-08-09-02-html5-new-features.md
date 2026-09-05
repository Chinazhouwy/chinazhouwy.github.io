---
title: "HTML5 核心新特性笔记：语义化标签、表单、多媒体与全局属性"
date: "2026-08-09"
domain: "学习"
area: "前端"
module: "前端"
project: ""
type: "笔记"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "整理自 8 页《HTML5笔记》PDF：语义化布局/状态/列表/文本标签、表单新属性与新 type、video/audio、全局属性与兼容性处理；全部配可运行示例并勘误过时表述。"
tags:
  - "HTML5"
  - "语义化标签"
  - "表单"
  - "多媒体"
  - "前端"
---

# HTML5 核心新特性笔记：语义化标签、表单、多媒体与全局属性

> **来源：** 用户提供的 PDF《HTML5笔记》（8 页），2026-08-09 整理进 Life OS。
> **整理原则：** 原 PDF 以表格罗列为主，本笔记为每个知识点补上可运行示例（每个代码块存成 .html 双击即可运行），并对过时/有误表述做了勘误（见文末"勘误与补充"）。

## 0. 这一篇解决什么问题

前端面试常问"HTML5 相比 HTML4 新增了什么"，实际开发里也常纠结布局到底用哪个标签。看完这篇，你能：

1. 说出 HTML5 五大类新特性：语义化标签、表单、多媒体、全局属性、JS API
2. 写出一个语义化页面骨架，知道 article / section 怎么选
3. 会用 datalist / details / ruby / meter / progress 这些"冷门但有用"的标签
4. 避开原 PDF 里的过时知识点（hgroup 已恢复、contextmenu 已移除、IE 已死）

## 1. HTML5 简介

- **定义**：新一代 HTML 标准，2014 年 10 月由 W3C 完成标准制定；现行规范以 WHATWG 的 HTML Living Standard 为准
- **狭义**：新的 HTML 标准；**广义**：整个前端
- **规范地址**：W3C https://www.w3.org/TR/html/ ；WHATWG https://html.spec.whatwg.org/multipage/

**优势：**
1. 为 JavaScript 新增了大量可操作接口（如 video.play()、拖放 API、Web Storage）
2. 新增语义化标签与全局属性
3. 新增多媒体标签，可替代 Flash
4. 更侧重语义化，对 SEO 友好
5. 可移植性好，大量应用于移动端

**兼容性**：Chrome / Safari / Opera / Firefox 全部支持；IE 需 9+ 且仅支持部分新特性（IE 已停止维护，2026 年无需考虑）。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HTML5 文档骨架</title>
</head>
<body>
  <p>存成 .html 双击打开即可运行。</p>
</body>
</html>
```

## 2. 新增语义化标签

### 2.1 布局标签

| 标签 | 语义 | 单/双 |
|---|---|---|
| header | 整个页面或部分区域的头部 | 双 |
| footer | 整个页面或部分区域的底部 | 双 |
| nav | 导航 | 双 |
| article | 文章、帖子、杂志、新闻、博客、评论等独立内容 | 双 |
| section | 页面中的某段/分块内容（通常包含标题） | 双 |
| aside | 侧边栏 | 双 |
| main | 文档的主要内容（原 PDF 称"WHATWG 没有语义"，不准确，见勘误） | 双 |
| hgroup | 包裹连续的标题（主标题+副标题组合；原 PDF 称"W3C 将其删除"，已过时，见勘误） | 双 |

**article 与 section 怎么选：**
- article 强调**独立性、完整性**：一篇文章、一条评论、一个帖子
- section 强调**分段分块**：想把一块内容分成几段时用
- article 里面可以有多个 section，section 里也可以有 article

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>语义化布局示例</title>
</head>
<body>
  <header>
    <hgroup>
      <h1>我的博客</h1>
      <h2>副标题：记录前端学习</h2>
    </hgroup>
    <nav>
      <a href="/">首页</a> | <a href="/about">关于</a>
    </nav>
  </header>

  <main>
    <article>
      <h2>第一篇：HTML5 语义化</h2>
      <section>
        <h3>为什么要语义化</h3>
        <p>利于 SEO 与无障碍阅读。</p>
      </section>
      <section>
        <h3>article 与 section 的区别</h3>
        <p>article 更强调独立完整，section 强调分段分块。</p>
      </section>
    </article>
  </main>

  <aside>侧边栏：热门文章</aside>
  <footer>© 2026</footer>
</body>
</html>
```

### 2.2 状态标签：meter / progress

**meter**：定义已知范围内的标量测量（gauge），如电量、磁盘用量。双标签。
属性：min / max / low / high / optimum / value

**progress**：显示任务完成进度的指示器（进度条）。双标签。
属性：max / value

**面试区分点**：电量用 meter（已知区间的度量），下载进度用 progress（进行中的进度）。

```html
<p>磁盘用量：<meter min="0" max="100" low="20" high="80" optimum="50" value="65">65%</meter></p>
<p>电量：<meter min="0" max="100" value="15">15%</meter></p>

<p>任务进度：<progress max="100" value="70">70%</progress></p>

<script>
  // 模拟下载进度，运行后数字会自己涨
  const p = document.querySelector('progress')
  const timer = setInterval(() => {
    p.value = Math.min(100, p.value + 5)
    if (p.value >= 100) clearInterval(timer)
  }, 500)
</script>
```

### 2.3 列表标签：datalist / details / summary

- **datalist**：搜索框的关键字提示，配合 input 的 list 属性使用。双标签
- **details**：展示问题和答案、或对专有名词解释，可折叠。双标签
- **summary**：写在 details 里面，作为折叠标题。双标签

```html
<!-- datalist：输入提示（原 PDF 示例整理） -->
<input type="text" list="mydata" placeholder="输入名字试试">
<datalist id="mydata">
  <option value="周冬雨">周冬雨</option>
  <option value="周杰伦">周杰伦</option>
  <option value="温兆伦">温兆伦</option>
  <option value="马冬梅">马冬梅</option>
</datalist>

<!-- details/summary：手风琴式问答 -->
<details>
  <summary>如何走上人生巅峰？</summary>
  <p>一步一步走呗</p>
</details>
```

### 2.4 文本标签：ruby / rt（注音）、mark（标记）

- **ruby**：包裹需要注音的文字；**rt** 写在 ruby 里面写注音
- **mark**：标记高亮文本，W3C 建议用于标记搜索结果中的关键字

```html
<p><ruby>魑魅魍魉<rt>chī mèi wǎng liǎng</rt></ruby></p>

<p>搜索 <mark>HTML5</mark> 共找到 100 条结果</p>
```

补充：ruby 里还可写 rp 标签，给不支持 ruby 的旧浏览器提供回退括号（现代浏览器均支持，可忽略）。

## 3. 新增表单功能

### 3.1 表单控件新增属性

| 属性 | 功能 | 注意 |
|---|---|---|
| placeholder | 提示文字 | 不是默认值，value 才是默认值；适用于文字输入类控件 |
| required | 必填 | 适用于除按钮外的表单控件 |
| autofocus | 自动获取焦点 | 适用于所有表单控件 |
| autocomplete | 自动完成 on / off | 密码框、多行输入框不可用 |
| pattern | 正则表达式校验 | 文本输入类；空输入不验证，常与 required 配合 |

```html
<form action="#" method="post">
  <p>用户名：<input type="text" name="user" placeholder="6-12 位字母数字"
         pattern="[A-Za-z0-9]{6,12}" required autofocus></p>
  <p>邮箱：<input type="email" name="email" placeholder="xxx@example.com" required></p>
  <p>密码：<input type="password" name="pwd" placeholder="请输入密码" autocomplete="off" required></p>
  <button>注册</button>
</form>
```

### 3.2 input 新增 type

| type | 功能 | 提交时验证 |
|---|---|---|
| email | 邮箱输入框 | 空则不验证，非空验证格式 |
| url | URL 输入框 | 同上 |
| number | 数字输入框 | 同上 |
| search | 搜索框 | 不验证 |
| tel | 电话输入框（移动端唤起数字键盘） | 不验证 |
| range | 范围选择框，默认值 50 | 不验证 |
| color | 颜色选择框，默认黑色 | 不验证 |
| date | 日期选择框，默认空 | 不验证 |
| month | 月份选择框，默认空 | 不验证 |
| week | 周选择框，默认空 | 不验证 |
| time | 时间选择框，默认空 | 不验证 |
| datetime-local | 日期+时间选择框，默认空 | 不验证 |

```html
<form action="#" method="post" novalidate>
  <!-- novalidate：跳过全部格式验证，方便只看 UI -->
  <p>email: <input type="email" name="e"></p>
  <p>url: <input type="url" name="u"></p>
  <p>number: <input type="number" name="n" min="0" max="10" step="1"></p>
  <p>tel: <input type="tel" name="t"></p>
  <p>range: <input type="range" name="r" min="0" max="100"></p>
  <p>color: <input type="color" name="c"></p>
  <p>date: <input type="date" name="d"></p>
  <p>datetime-local: <input type="datetime-local" name="dt"></p>
  <p>time: <input type="time" name="tm"></p>
  <p>month: <input type="month" name="m"></p>
  <p>week: <input type="week" name="w"></p>
  <button>提交</button>
</form>
```

### 3.3 form 新增属性：novalidate

form 上加 `novalidate` 后，提交时不再做任何验证（上面示例已演示）。补充：只想让某几个控件不参与验证时，可在对应提交按钮上加 `formnovalidate`。

## 4. 新增多媒体标签

### 4.1 video

属性：src（视频地址）、width / height（播放器宽高）、controls（显示控件）、muted（静音）、autoplay（自动播放）、loop（循环）、poster（封面）、preload（auto / metadata / none；使用 autoplay 时忽略 preload）

```html
<video src="https://www.w3schools.com/html/mov_bbb.mp4"
       controls muted autoplay loop
       poster="poster.jpg" width="480" height="270">
  您的浏览器不支持 video 标签。
</video>
```

注意：现代浏览器要求 autoplay 必须配合 muted，有声自动播放会被拦截。

### 4.2 audio

属性：src（音频地址）、controls、autoplay、muted、loop、preload（auto / metadata / none）

```html
<audio src="https://www.w3schools.com/html/horse.mp3" controls loop>
  您的浏览器不支持 audio 标签。
</audio>
```

补充：video / audio 内部可写多个 `<source src="..." type="...">` 提供多格式回退。

## 5. 新增全局属性（了解）

| 属性 | 功能 |
|---|---|
| contenteditable | 元素是否可编辑：true / false |
| draggable | 元素可否拖动：true / false |
| hidden | 隐藏元素 |
| spellcheck | 拼写和语法检查：true / false |
| data-* | 存储页面私有定制数据（通过 dataset 读取） |
| contextmenu | 原 PDF 有列，但已从规范移除、浏览器不支持，不要使用（见勘误） |

```html
<p contenteditable="true">点击我，可以直接编辑这段文字</p>
<p draggable="true">我可以被拖动（配合拖放 API）</p>
<p hidden>我是隐藏的</p>

<div id="card" data-user-id="42" data-role="admin">用户卡片</div>
<script>
  const card = document.getElementById('card')
  console.log(card.dataset.userId, card.dataset.role) // "42" "admin"
</script>
```

## 6. HTML5 兼容性处理（历史遗留，了解）

- 添加 meta 元信息，让浏览器处于最优渲染模式
- 使用 html5shiv 让低版本浏览器认识 H5 语义化标签
- 条件注释语法：lt 小于 / lte 小于等于 / gt 大于 / gte 大于等于 / ! 逻辑非

```html
<!-- 设置 IE 总是使用最新文档模式渲染 -->
<meta http-equiv="X-UA-Compatible" content="IE=Edge">
<!-- 优先使用 webkit (Chromium) 内核渲染，针对 360 等双核壳浏览器 -->
<meta name="renderer" content="webkit">

<!--[if lt IE 9]>
<script src="../sources/js/html5shiv.js"></script>
<![endif]-->

<!-- 条件注释仅 IE9 及以下识别，IE 已停止维护，纯历史知识 -->
<!--[if IE 8]>仅 IE8 可见<![endif]-->
<!--[if gt IE 8]>仅 IE8 以上可见<![endif]-->
<!--[if lte IE 8]>IE8 及以下可见<![endif]-->
<!--[if !IE 8]>非 IE8 的 IE 可见<![endif]-->
```

## 7. 勘误与补充（相对原 PDF）

1. **hgroup**：原 PDF 称"W3C 将其删除"——准确说法是 hgroup 曾在 HTML5.1 被移除、HTML 5.2 又恢复，现代浏览器均支持，可放心用于主标题+副标题组合。
2. **main**：原 PDF 称"WHATWG 没有语义"——不准确。main 表示文档主体内容（landmark 地标），WHATWG 与 W3C 均有定义，所有现代浏览器支持；仅 IE 不支持（IE 已停止维护，可忽略）。
3. **contextmenu**：该全局属性已从 HTML 规范移除、主流浏览器不支持，不要使用。
4. **autoplay**：现代浏览器要求 video/audio 自动播放必须静音（muted），否则被拦截。
5. **datetime**：旧 type=datetime 已废弃，应使用 datetime-local。
6. **IE9**：2026 年 IE 已无市场份额，兼容性段落仅作历史参考。

## 备注

- 原 PDF 共 8 页，以表格罗列为主；本笔记已为每节补充可运行示例（每个代码块存成 .html 双击即可运行）。
- 原 PDF 临时副本位于 /root/.hermes/cache/documents/doc_3d14ba89af81_HTML5笔记.pdf，如不需要可删除。
