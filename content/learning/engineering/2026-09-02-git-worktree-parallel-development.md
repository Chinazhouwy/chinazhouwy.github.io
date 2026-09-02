---
title: "git worktree 实战：一边修 bug 一边写需求"
date: "2026-09-02"
domain: "学习"
area: "工程与架构"
module: ""
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "low"
visibility: "public"
summary: "用 git worktree 在同一仓库并行维护多个工作目录，解决半成品代码没地方搁、切分支靠 stash 来回折腾的问题。"
tags:
  - Git
  - worktree
  - stash
  - 开发工作流
  - 工程效能
source: "微信公众号「左羊公社」"
source_url: "https://mp.weixin.qq.com/s/JqZEvGB5MzGgg1S-Heu_OQ"
published_at: "2026-09-02 22:33:15 +08:00"
---

# git worktree 实战：一边修 bug 一边写需求

> 原文标题：【左羊备忘录】git worktree：一边修 bug 一边写需求，两不误
>
> 来源：微信公众号「左羊公社」
>
> 发布时间：2026-09-02 22:33（北京时间）
>
> 原文链接：<https://mp.weixin.qq.com/s/JqZEvGB5MzGgg1S-Heu_OQ>

## 一、它解决什么问题

正在写一个新功能，代码写了一半还没提交，这时线上出 bug 要紧急修。常见困境：

- **硬切分支**：Git 不让——没提交的改动带不过去，还容易糊一屏冲突；
- **`git stash` 暂存**：切完修完再 `pop` 回来，万一 `pop` 出冲突更难受。

`git worktree` 是 Git 官方的正解：

> 允许你在同一个仓库里，同时检出多个分支，每个分支对应一个独立的文件夹。

即**一个仓库，多个工作区**：A 目录写 feature，B 目录修 bug，互不干扰，不用来回 `stash`。

## 二、对照：git stash 常用命令

理解 worktree 之前先补上 stash 的基本操作：

```bash
# 暂存当前改动（连没跟踪的新文件一起，加 -u）
git stash push -u -m "半成品：支付流程写到一半"

# 看看暂存列表
git stash list

# 恢复并删除该暂存（恢复后列表清空）
git stash pop

# 恢复但保留该暂存（可反复恢复）
git stash apply

# 删除某条暂存
git stash drop
```

`pop` 和 `apply` 的区别：`pop` 恢复后暂存记录被删掉，`apply` 恢复后暂存记录保留。

## 三、worktree 核心命令

### 1. 创建工作区

```bash
# 在 ../my-project-hotfix 目录检出已有的 hotfix 分支
git worktree add ../my-project-hotfix hotfix

# 基于 master 新建分支并同时检出
git worktree add -b fix/login-bug ../my-project-fix master
```

### 2. 列出所有工作区

```bash
git worktree list
```

输出示例（带 `*` 的是当前所在目录）：

```text
/path/to/my-project         abc1234 [feature/pay]
/path/to/my-project-fix     9f8d7e6 [fix/login-bug]
/path/to/my-project-hotfix  3c2b1a0 [hotfix]
```

### 3. 删除工作区

```bash
# 先确认目录里没有未提交的改动，有就先提交
git worktree remove ../my-project-hotfix

# 手动 rm 删目录后，list 里残留幽灵记录，清一下
git worktree prune
```

## 四、踩坑记录

1. **同一个分支不能检出到两个 worktree**。Git 会报错 `fatal: 'hotfix' is already checked out at 'xxx'`。想并行，就用 `-b` 新建独立分支。
2. **`remove` 之前先提交**。默认不带 `--force` 时，目录里有未提交改动会拒绝删除——这是保护机制，别嫌烦。
3. **删了目录别忘 `prune`**。手动 `rm` 掉目录后，`git worktree list` 里还挂着幽灵记录，`prune` 一下清理。

## 五、完整实战流程

场景：正在 `develop` 分支写支付功能，有半成品改动没提交，突然要修线上 hotfix。

```bash
# 步骤1：确认当前状态——develop 分支，有改动没提交
git status

# 步骤2：在隔壁目录建一个 hotfix 工作区（现在的工作区一动没动）
git worktree add ../my-project-hotfix hotfix

# 步骤3：进 hotfix 目录，修 bug、提交
cd ../my-project-hotfix
# ...改代码...
git add .
git commit -m "fix: 修复支付回调超时"

# 步骤4：修完切回原目录，接着写 feature（半成品原封不动）
cd ../my-project

# 步骤5：bug 修完了，删掉 hotfix 工作区
git worktree remove ../my-project-hotfix
```

全程没碰过 `stash`，feature 的半成品一动没动。

## 六、典型用法

- **修线上 bug**：`git worktree add` 一个 hotfix 目录 → 修完提交 → `remove`，原 feature 目录纹丝不动；
- **并行做两个需求**：一个目录一个 worktree，编辑器窗口切过去就行，连 `git switch` 都不用。

## 七、我的补充与勘误

1. **worktree 共享同一个 `.git` 对象库**。多个工作区的提交历史、远程配置、hooks 是共享的，磁盘开销只是各自的工作区文件，比 `git clone` 第二份省得多；但这也意味着一个目录里 `git gc`、改配置会影响所有工作区。
2. **主仓库目录不能删**。`git worktree remove` 只能删附加工作区，不能删主仓库目录；主目录的 `.git` 是全部 worktree 的元数据根。
3. **未跟踪文件不会跟过去**。新 worktree 检出的是分支内容，原目录里未提交、未跟踪的文件（比如本地 `.env`、配置文件）不会自动同步，修完回来可能发现新目录缺本地配置文件，需要自己复制或 `.gitignore` 约定。
4. **和 stash 不冲突**。worktree 适合"多线并行"，`stash` 适合"同一分支临时打断一下"。比如切分支前先 `stash` 半成品、修完再 `pop`，仍是短路径方案；只有当半成品要保留很久、或频繁来回切，worktree 才明显更优。
5. **hotfix 分支别忘了合回去**。原文流程到"修完删工作区"就结束，但实战中 `hotfix` 分支通常还要合并回 `develop`/`master`（或走 PR），否则下个版本又会带着同一个 bug 上线。
6. **IDE 支持**。多数 IDE 把每个 worktree 目录当独立项目打开即可；JetBrains 系也支持在同一个项目窗口里直接关联多个 worktree。

## 八、复习速记

```text
一个仓库，多个工作区，各自一个分支
add：新建并检出（-b 新建分支）
list：看所有工作区，* 是当前位置
remove：删工作区（有未提交改动会拒绝）
prune：清理手动 rm 后的幽灵记录
同分支不能同时检出两处
主仓库 .git 共享：历史/配置/钩子
本地未跟踪文件不跟随
适合：长期半成品 + 紧急插入
短路径打断仍可用：stash push -u / pop
```
