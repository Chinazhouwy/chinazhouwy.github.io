---
title: "CSS3 新特性笔记：变换、过渡动画、flex 布局、渐变与响应式"
date: "2026-08-09"
domain: "学习"
area: "前端"
module: "HTML/CSS 基础"
project: ""
type: "笔记"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "整理自 32 页《CSS3笔记》PDF：私有前缀、新长度单位、box-sizing/阴影/背景/边框/文本新属性、渐变、Web 字体、2D/3D 变换、过渡与动画、多列布局、flex 伸缩盒、媒体查询与 BFC，全部配可运行示例并勘误过时表述。"
tags:
  - "CSS3"
  - "flex"
  - "动画"
  - "变换"
  - "响应式"
  - "前端"
---

# CSS3 新特性笔记：变换、过渡动画、flex 布局、渐变与响应式

> **来源：** 用户提供的 PDF《CSS3笔记》（32 页，尚硅谷 CSS3 课程笔记），2026-08-09 整理进 Life OS。
> **整理原则：** 保留课程表格化知识结构，为每节补充可运行示例；对过时/不准确的表述做了勘误（见文末"勘误与补充"）。

## 0. 这一篇解决什么问题

CSS3 是 CSS2 的升级版，按**模块化**方式演进（原 PDF 说"未来会按模块化发展"，现在已是现实：CSS 没有"CSS4"，新特性以一个个模块发布，如 Flexbox、Transforms、Animations 各自独立）。看完这篇，你能：

1. 理解私有前缀，用对 box-sizing / box-shadow / opacity 等盒模型新属性
2. 用渐变、文字阴影、省略号、背景多图等视觉效果
3. 用 2D/3D 变换 + 过渡 + 动画做出平滑动效
4. 用 flex 解决 90% 的现代布局问题，会用媒体查询做响应式，理解 BFC

## 1. CSS3 概述与私有前缀

W3C 提出的某个 CSS 特性在被浏览器正式支持前，浏览器厂商会先用**私有前缀**测试：

```css
div {
    width: 400px;
    height: 400px;
    -webkit-border-radius: 20px;  /* Chrome / Safari / Edge / 新 Opera */
    -moz-border-radius: 20px;     /* Firefox */
    -ms-border-radius: 20px;      /* 旧 IE */
    -o-border-radius: 20px;       /* 旧 Opera */
    border-radius: 20px;          /* 标准写法放最后 */
}
```

实际开发不用记前缀：主流 CSS3 特性现代浏览器都支持，需要兼容老浏览器时交给构建工具（Autoprefixer）自动加。兼容性查询：https://caniuse.com/

## 2. 新长度单位与颜色

| 单位 | 含义 |
|---|---|
| rem | 根元素（html）字体大小的倍数，只与根元素有关 |
| vw | 视口宽度的百分比，10vw = 视口宽度 10% |
| vh | 视口高度的百分比 |
| vmax | 视口宽高中较大者的百分比 |
| vmin | 视口宽高中较小者的百分比 |

```css
html { font-size: 16px; }
h1 { font-size: 2rem; }      /* 32px，随根字号缩放 */
.banner { height: 100vh; }   /* 一屏高的横幅 */
/* 响应式字号：vmin 随屏幕缩放 */
.big { font-size: 5vmin; }
```

颜色：rgba / hsl / hsla 三种新方式（已在 CSS2 笔记详述，此处略）。

## 3. 盒模型新属性

### 3.1 box-sizing（怪异盒模型）

| 值 | 含义 |
|---|---|
| content-box | width/height 设置内容区大小（默认值，盒子实际大小 = 内容 + padding + border） |
| border-box | width/height 设置盒子**总大小**（padding/border 向内挤） |

```css
/* 开发中最常见的全局写法：所有元素都按总大小计算，布局不用反复算 */
*,
*::before,
*::after {
    box-sizing: border-box;
}
```

### 3.2 resize / box-shadow / opacity

```css
.box {
    width: 200px;
    height: 100px;
    resize: both;            /* 用户可拖动调整元素大小（需配合 overflow 非 visible） */
    overflow: hidden;

    /* box-shadow: h-shadow v-shadow blur spread color inset（前两个必填，可为负） */
    box-shadow: 10px 10px;                 /* 位移 */
    box-shadow: 10px 10px 10px red;        /* + 模糊 */
    box-shadow: 10px 10px 20px 3px blue inset;  /* + 外延 + 内阴影 */
    box-shadow: 0 0 10px rgba(0,0,0,0.5);  /* 最常用的柔和阴影 */

    opacity: 0.5;   /* 整个元素（含内容）的不透明度 0~1 */
}
```

**opacity 与 rgba 的区别**：opacity 是属性，作用于整个元素（内容一起透明）；rgba 是颜色写法，只调整颜色的透明度（如背景透明但文字不透明）。

## 4. 背景新属性

| 属性 | 作用 | 值 |
|---|---|---|
| background-origin | 背景图原点 | padding-box（默认）/ border-box / content-box |
| background-clip | 背景裁剪区域 | border-box（默认）/ padding-box / content-box / text（背景只显示在文字上，部分浏览器需 -webkit- 前缀） |
| background-size | 背景图尺寸 | 长度 / 百分比 / auto（默认）/ contain（等比缩放到完整包含）/ cover（等比缩放到完全覆盖，可能显示不全，**常用**） |

复合属性写法：`background: color url repeat position / size origin clip`（size 必须写在 position 后并用 `/` 分隔）。

```css
/* 多背景图：逗号分隔，实现四个角的花纹 */
.box {
    background:
        url(../images/bg-lt.png) no-repeat,
        url(../images/bg-rt.png) no-repeat right top,
        url(../images/bg-lb.png) no-repeat left bottom,
        url(../images/bg-rb.png) no-repeat right bottom;
}

/* 文字渐变填充（background-clip: text） */
.title {
    background-image: linear-gradient(90deg, red, blue);
    -webkit-background-clip: text;   /* 兼容写法 */
    background-clip: text;
    color: transparent;
}
```

## 5. 边框与文本新属性

### 5.1 border-radius 圆角

```css
.box { border-radius: 10px; }                  /* 四角相同 */
.box2 { border-radius: 50%; }                  /* 正圆（配合等宽高） */
/* 椭圆：x/y 半径分别指定（几乎不用） */
.box3 { border-radius: 左上x 右上x 右下x 左下x / 左上y 右上y 右下y 左下y; }
/* 胶囊按钮：圆角 = 高度一半 */
.btn { height: 40px; border-radius: 20px; }
```

**outline 外轮廓（了解）**：outline-width / color / style（none/dotted/dashed/solid/double）+ outline-offset（与边框的距离，独立属性，可负值）。外轮廓不占布局空间。

### 5.2 文本新属性

| 属性 | 作用 | 常用值 |
|---|---|---|
| text-shadow | 文本阴影 | `text-shadow: h-shadow v-shadow blur color` |
| white-space | 换行方式 | normal / pre（原样输出）/ pre-wrap / pre-line / nowrap（强制不换行） |
| text-overflow | 文本溢出呈现 | clip（裁切，默认）/ ellipsis（省略号） |
| text-decoration | 升级为复合属性 | line（none/underline/overline/line-through）+ style（solid/double/dotted/dashed/wavy）+ color |
| -webkit-text-stroke | 文字描边 | width + color（仅 webkit 内核支持） |

**单行省略号三件套**（高频面试题）：

```css
.ellipsis {
    overflow: hidden;        /* 必须：非 visible */
    white-space: nowrap;     /* 必须：不换行 */
    text-overflow: ellipsis; /* 溢出显示 ... */
}
```

## 6. 渐变

### 6.1 线性渐变

```css
.box {
    /* 默认从上到下 */
    background-image: linear-gradient(red, yellow, green);
    /* 关键词方向 */
    background-image: linear-gradient(to top, red, yellow, green);
    background-image: linear-gradient(to right top, red, yellow, green);
    /* 角度方向：0deg 从下到上，顺时针 */
    background-image: linear-gradient(30deg, red, yellow, green);
    /* 指定渐变开始位置 */
    background-image: linear-gradient(red 50px, yellow 100px, green 150px);
}
```

### 6.2 径向渐变

```css
.box {
    background-image: radial-gradient(red, yellow, green);        /* 默认从圆心四散 */
    background-image: radial-gradient(at right top, red, yellow, green);
    background-image: radial-gradient(at 100px 50px, red, yellow, green);
    background-image: radial-gradient(circle, red, yellow, green); /* 正圆 */
    background-image: radial-gradient(100px, red, yellow, green);  /* 半径 */
    background-image: radial-gradient(50px 100px, red, yellow, green); /* 椭圆半径 */
}
```

### 6.3 重复渐变

```css
/* 横格纸效果：repeating-linear-gradient */
.notebook {
    background-image: repeating-linear-gradient(
        transparent 0 24px,
        #dce9f9 24px 25px
    );
}
/* 重复径向渐变可做同心圆、立体球等效果 */
```

## 7. Web 字体与字体图标

```css
/* 基本用法 */
@font-face {
    font-family: "情书字体";
    src: url('./方正手迹.ttf');
}

/* 高兼容写法：多种格式依次回退（IE9 以下已死，可简化为 woff2 + ttf） */
@font-face {
    font-family: "atguigu";
    font-display: swap;              /* 字体加载期间先用回退字体，避免白屏 */
    src: url('webfont.woff2') format('woff2'),
         url('webfont.woff') format('woff'),
         url('webfont.ttf') format('truetype');
}
```

```css
/* 使用 */
.title { font-family: "情书字体", sans-serif; }
```

- 中文完整字体文件很大，通常用阿里 Web 字体定制工具只提取需要的字：https://www.iconfont.cn/webfont
- **字体图标**（iconfont.cn 等平台）：比图片清晰、灵活改大小颜色、兼容性好，是图标首选方案

## 8. 2D 变换（transform）

| 函数 | 作用 |
|---|---|
| translateX / translateY / translate | 位移（百分比相对**自身**宽高） |
| scaleX / scaleY / scale | 缩放（1 不缩放，>1 放大，<1 缩小；负值几乎不用） |
| rotate | 旋转（deg，正值顺时针） |
| skewX / skewY / skew | 扭曲（拉扯变形，了解即可） |

```css
.box {
    transform: translateX(30px) translateY(40px);   /* 链式编写 */
    transform: translate(30px, 40px);
    transform: scale(1.5) rotate(45deg);           /* 多重变换建议最后旋转 */
    transform-origin: left top;                     /* 变换原点：默认 50% 50%（中心） */
}
```

注意：位移与相对定位相似，不脱离文档流，不影响其他元素；位移百分比参考**自身**（相对定位参考父元素）；浏览器对位移有优化（GPU 合成），效率高于定位；位移对行内元素无效。

```css
/* 经典：位移 + 定位实现水平垂直居中（无需知道自身宽高） */
.center {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
}
```

## 9. 3D 变换

```css
/* 重要原则：父元素必须先开启 3D 空间 */
.stage {
    transform-style: preserve-3d;   /* flat（默认，2D）/ preserve-3d（3D） */
    perspective: 800px;             /* 景深：观察者到 z=0 平面的距离，不能为负；设置在父元素上 */
    perspective-origin: 400px 300px; /* 透视点位置（观察者位置），默认中心，通常不用调 */
}

.card {
    transform: translateZ(100px);                 /* z 轴位移：正值向屏幕外，不能写百分比 */
    transform: rotateY(45deg);                    /* 绕 y 轴旋转（面对轴正方向，正值顺时针） */
    transform: scaleZ(2);                         /* z 轴缩放（无视觉效果时很少用） */
    transform: translate3d(10px, 20px, 30px);     /* x y z 三参数都不能省略 */
    transform: rotate3d(1, 1, 1, 30deg);          /* 绕任意轴旋转 */
    backface-visibility: hidden;                  /* 背面不可见（做翻转卡片） */
}
```

## 10. 过渡 transition

让元素从一种样式**平滑过渡**到另一种样式（不用 JS）。

| 属性 | 作用 | 常用值 |
|---|---|---|
| transition-property | 哪些属性参与过渡 | none / all / 具体属性（逗号分隔） |
| transition-duration | 持续时间 | s / ms（0 默认无过渡） |
| transition-delay | 延迟 | s / ms |
| transition-timing-function | 过渡曲线 | ease（默认）/ linear / ease-in / ease-out / ease-in-out / steps(n, start|end) / cubic-bezier(x1,y1,x2,y2) |

可过渡的属性：值为数字或可转数字的属性（颜色、长度、百分比、z-index、opacity、变换、阴影）。

```css
.btn {
    background-color: #409eff;
    transition: all 0.3s ease;              /* 复合：duration 在前，delay 在后 */
    /* transition: 0.3s 0.1s linear all;   两个时间：第一个 duration，第二个 delay */
}
.btn:hover {
    background-color: #66b1ff;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
}
```

在线制作贝塞尔曲线：https://cubic-bezier.com

## 11. 动画 animation

一段动画 = 连续播放若干**帧**；**关键帧**是起决定性作用的帧。

```css
/* 第一步：定义关键帧 */
@keyframes bounce {
    0%   { transform: translateY(0); }
    50%  { transform: translateY(-30px); }
    100% { transform: translateY(0); }
}

/* 第二步：应用动画 */
.ball {
    animation-name: bounce;            /* 指定动画 */
    animation-duration: 1s;            /* 时长 */
    animation-delay: 0.5s;             /* 延迟 */
    animation-timing-function: ease;   /* 曲线，同 transition */
    animation-iteration-count: infinite;   /* 次数：number / infinite */
    animation-direction: alternate;    /* normal / reverse / alternate（正反交替）/ alternate-reverse */
    animation-fill-mode: forwards;     /* forwards 保持结束状态 / backwards 回到开始状态 */
    animation-play-state: running;     /* running / paused（一般单独写，配合 hover 暂停） */
}

/* 复合写法：duration delay 两个时间分辨，其余无顺序要求 */
.ball2 {
    animation: bounce 1s 0.5s ease-in-out 2 alternate forwards;
}
.ball2:hover {
    animation-play-state: paused;      /* 悬停暂停 */
}
```

## 12. 多列布局

专门实现报纸式分栏：

```css
.news {
    column-count: 3;              /* 列数 */
    column-width: 200px;          /* 列宽 */
    column-gap: 30px;             /* 列间距 */
    column-rule: 1px solid #ccc;  /* 列分隔线（style/width/color 复合） */
}
.news h2 {
    column-span: all;             /* 标题跨所有列（none / all） */
}
```

## 13. 伸缩盒模型（flex）

2009 年 W3C 提出的新盒模型，轻松控制元素分布、对齐、视觉顺序。**flex 布局是现代布局首选**（移动端尤其适用）。

### 13.1 容器与项目

- **伸缩容器**：设置 `display: flex`（或 inline-flex，很少用）的元素
- **伸缩项目**：容器**所有子元素**自动成为伸缩项目（孙子不是）；项目无论原来是块/行内/行内块，都会"块状化"
- **主轴**：项目排列方向，默认水平从左到右；**侧轴**：与主轴垂直，默认垂直从上到下

### 13.2 容器属性

| 属性 | 作用 | 常用值 |
|---|---|---|
| flex-direction | 主轴方向 | row（默认）/ row-reverse / column / column-reverse（改变主轴，侧轴随之改变） |
| flex-wrap | 换行 | nowrap（默认）/ wrap / wrap-reverse |
| flex-flow | 复合 | `flex-flow: row wrap;`（direction + wrap，无顺序要求） |
| justify-content | 主轴对齐 | flex-start（默认）/ flex-end / center / space-between（两端对齐，最常用）/ space-around / space-evenly |
| align-items | 侧轴对齐（单行） | stretch（默认，未设高度占满）/ flex-start / flex-end / center / baseline |
| align-content | 侧轴对齐（多行） | stretch（默认）/ flex-start / flex-end / center / space-between / space-around / space-evenly |

### 13.3 项目属性

| 属性 | 作用 |
|---|---|
| flex-basis | 主轴方向基准长度（会让 width/height 失效），默认 auto |
| flex-grow | 放大比例，默认 0（不放大）；都设为 1 则等分剩余空间；1:2:3 则按 1/6:2/6:3/6 瓜分 |
| flex-shrink | 压缩比例，默认 1（空间不足时收缩） |
| flex | 复合：grow shrink basis，默认 `0 1 auto`；`flex: 1` = `1 1 0%`；`flex: auto` = `1 1 auto`；`flex: none` = `0 0 auto` |
| order | 排序，数值越小越靠前，默认 0 |
| align-self | 单独对齐某项目，默认 auto（继承 align-items） |

**flex-shrink 收缩计算示例**：三个项目宽 200/300/200，flex-shrink 1/2/3，容器只有 400px（差 300px）。
分母 = 200×1 + 300×2 + 200×3 = 1400；各项目按 (宽×shrink)/分母 的比例分担 300px 的收缩量。

### 13.4 flex 实现水平垂直居中（高频面试题）

```css
/* 方法一：容器 justify-content + align-items */
.outer {
    display: flex;
    justify-content: center;
    align-items: center;
}

/* 方法二：容器开 flex，子元素 margin: auto（自动吸收剩余空间） */
.outer2 { display: flex; }
.inner2 { margin: auto; }
```

```html
<div class="outer" style="width:400px;height:200px;border:1px solid #ccc;">
    <div class="inner" style="width:100px;height:50px;background:orange;"></div>
</div>
```

## 14. 响应式布局与媒体查询

### 14.1 媒体类型

| 值 | 含义 |
|---|---|
| all | 所有设备 |
| screen | 电子屏幕（电脑、平板、手机）—— 最常用 |
| print | 打印机 |
| aural / braille / embossed / handheld / projection / tty / tv | 均已废弃，只留历史认知 |

### 14.2 媒体特性与运算符

特性：width / max-width / min-width / height / orientation（portrait 竖屏 / landscape 横屏）等，完整列表见 [MDN @media](https://developer.mozilla.org/zh-CN/docs/Web/CSS/@media)。
运算符：`and`（并且）、`,` 或 `or`（或）、`not`（否定）、`only`（肯定，防旧浏览器误读）。

### 14.3 常用写法（含常用断点）

```css
/* 用法一：外部样式 + 媒体查询条件 */
<link rel="stylesheet" media="screen and (max-width: 768px)" href="mobile.css">

/* 用法二：CSS 内部媒体查询 */
/* 常用断点（参考 Bootstrap）：<768 手机 / 768~992 平板 / 992~1200 桌面 / >1200 大屏 */
@media screen and (max-width: 768px) {
    .sidebar { display: none; }        /* 手机上隐藏侧边栏 */
}
@media screen and (min-width: 768px) and (max-width: 1200px) {
    .container { width: 100%; }
}
@media screen and (min-width: 1200px) {
    .container { width: 1200px; margin: 0 auto; }
}
```

## 15. BFC（块级格式化上下文）

**定义**：BFC（Block Formatting Context）是 Web 页面可视化 CSS 渲染的一部分，是块盒子布局发生的区域，也是浮动元素与其他元素交互的区域。通俗理解：元素的一个"特异功能"，默认关闭，满足条件时开启。

**开启 BFC 的条件**：根元素（html）；浮动元素；绝对/固定定位元素；行内块元素；表格单元格；overflow 非 visible 的块元素；伸缩项目；多列容器；`display: flow-root`（最干净的开启方式）。

**开启 BFC 能解决**：
1. 子元素不再产生 margin 塌陷
2. 自己不会被其他浮动元素覆盖
3. 子元素浮动时，自身高度不塌陷

```css
/* 用 display: flow-root 干净地开启 BFC（比 overflow: hidden 副作用小） */
.parent {
    display: flow-root;
}
```

## 16. 勘误与补充（相对原 PDF）

1. **模块化发展已是现实**：原 PDF 说"CSS3 在未来会按照模块化的方式去发展"——这不是未来时。CSS 早已模块化演进，没有"CSS4"，新特性以模块（Flexbox、Grid、Animations、Custom Properties 等）独立发布。
2. **vmin/vmax**：原 PDF 标注"了解即可"——vmin 在响应式字号（如移动端弹窗标题）中很常用，建议掌握。
3. **background-clip: text**：原 PDF 称"必须加 -webkit- 前缀"——Chrome 115+、Safari 15.4+ 已支持无前缀写法，但为兼容旧版本仍建议保留 -webkit- 前缀（先写带前缀的，再写标准属性）。
4. **flex: 1 的精确含义**：原 PDF 写 `flex: 1 1 0` 简写为 `flex: 1`——规范上是 `1 1 0%`（0% 与 0 有细微差别，写作 0% 更严谨）。
5. **媒体类型废弃项**：原 PDF 罗列 aural/braille/tv 等九种媒体类型——这些在 Media Queries Level 4 中已废弃，实际只用 all/screen/print。
6. **@font-face 格式**：原 PDF 的高兼容写法含 eot/svg（IE9 以下及 iOS 4.1）——2026 年只需 woff2（+ woff/ttf 兜底）即可，eot/svg 纯属历史。
7. **补充常用断点**：原 PDF 只画了区间图没给数值，本笔记补充了 Bootstrap 风格断点（768/992/1200）。

## 备注

- 原 PDF 共 32 页，以表格罗列为主；本笔记已为每节补充可运行示例（代码块存成 .html + .css 即可运行）。
- 3D 变换、多列布局在业务中相对少见，但面试/炫技场景会用；flex 与媒体查询是必会内容。
- 原 PDF 临时副本位于 /root/.hermes/cache/documents/doc_9ace049cc61f_CSS3笔记.pdf。
