---
title: "手机 Codex App 远程连接打通记：代理排障与 systemd 加固"
date: "2026-08-09"
domain: "学习"
area: "AI Agent"
module: "Agent 工程与源码"
project: ""
type: "文章"
status: "可复习"
priority: "P1"
energy: "medium"
visibility: "public"
summary: "手机 Codex App 通过服务器中转连接 OpenAI 的完整排障记录：app-server 缺代理环境变量导致直连 OpenAI 卡死（SYN-SENT）、pkill 误杀插曲、systemd 服务化加固，附排查命令与配置。"
tags:
  - "Codex"
  - "代理"
  - "systemd"
  - "网络排障"
  - "OpenAI"
---

# 手机 Codex App 远程连接打通记：代理排障与 systemd 加固

## 背景

手机上的 Codex App 支持「远程连接到自己的服务器」（会话来源 `codex_chatgpt_ios_remote`）：对话请求通过服务器上的 `codex app-server` 中转，再转发给 OpenAI。好处是手机端零算力压力、会话与配置统一在服务器，随时能跑 max 推理的重活。

整体架构：

```
手机 Codex App
   │ 虚拟网卡 / 隧道（手机端必须，见下文）
   ▼
服务器 codex app-server（监听 unix socket）
   │ HTTP_PROXY=http://127.0.0.1:7890
   ▼
mihomo 代理（rule 分流）
   │
   ▼
OpenAI API
```

## 症状

App 里发了一句「你好」，一直卡在「正在思考...」，最后弹「Codex 运行已停止」。会话文件生成了，但没有任何模型输出。

## 排查过程

### 1. 先排除服务器侧常规项

mihomo 代理进程活着（127.0.0.1:7890 + 9090），`codex` CLI 本地正常，OpenAI 登录态正常。问题只可能在「中转链路」上。

### 2. 看进程环境变量 —— 发现关键差异

`ps` 定位到 app-server 进程，读它的环境变量：

```bash
tr '\0' '\n' < /proc/<pid>/environ | grep -i proxy
```

结果只有 `AGENT_BROWSER_PROXY` 和 `ANTHROPIC_BASE_URL`，**没有 `HTTP_PROXY` / `HTTPS_PROXY`**。

也就是说：这个进程启动时没继承代理环境变量，它根本不知道要走代理。

### 3. 看连接状态 —— 实锤卡死

```bash
ss -tnp | grep 199.16
```

看到一条 `SYN-SENT` 连接：`10.2.0.2 → 199.16.156.75:443`（OpenAI）。

`SYN-SENT` 表示 TCP 三次握手的第一个包发出去了，但永远等不到回应——国内直连 OpenAI 就是这个下场。请求全部堵在握手阶段，对外表现就是「正在思考...」无限期。

### 4. 根因

服务器访问外网靠的是**环境变量代理（应用层自觉）**，而不是网络层强制（没开 TUN）。手动启动 app-server 时漏带了代理变量 → 进程裸连 OpenAI → 握手卡死。

## 修复：带代理重启

杀掉旧进程，带代理环境变量重启（第一版用 `setsid + nohup` 脱离会话守护）：

```bash
HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 \
NO_PROXY=localhost,127.0.0.1 \
setsid nohup codex app-server --listen unix:// \
    > /root/.codex/log/app-server.log 2>&1 < /dev/null &
```

验证（这一步比「进程活着」更硬核）：

```bash
ss -tnp | grep codex
# 出现 codex → 127.0.0.1:7890 ESTABLISHED
```

进程通过代理与 OpenAI 建立连接，手机 App 重发消息即恢复。

## 排障插曲：pkill -f 误杀自己

中途用 `pkill -f "app-server --listen"` 想杀掉旧进程，结果把**正在执行这条命令的 bash 自己也杀了**——因为 `pkill -f` 会匹配完整命令行，而当前命令行的文本里恰好包含这个模式。

教训：`pkill -f` 慎用。稳妥做法是先 `pgrep -f` 拿到精确 pid 再 `kill`，或者用能区分自身的锚点（如 `pgrep -f "codex app-server"` 并排除 `$$`）。

## 加固：systemd 服务化

手工 nohup 的隐患：服务器重启后不会自动拉起，又得手动跑脚本。一劳永逸的做法是交给 systemd：

```ini
[Unit]
Description=Codex app-server (phone relay, with proxy env)
After=mihomo.service network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/root
Environment=HTTP_PROXY=http://127.0.0.1:7890
Environment=HTTPS_PROXY=http://127.0.0.1:7890
Environment=http_proxy=http://127.0.0.1:7890
Environment=https_proxy=http://127.0.0.1:7890
Environment=NO_PROXY=localhost,127.0.0.1
Environment=no_proxy=localhost,127.0.0.1
ExecStart=/root/.local/bin/codex app-server --listen unix://
Restart=on-failure
RestartSec=5
StandardOutput=append:/root/.codex/log/app-server.log
StandardError=append:/root/.codex/log/app-server.log

[Install]
WantedBy=multi-user.target
```

要点：

- `After=mihomo.service`：保证代理先于 app-server 启动（mihomo 本身就是 systemd 服务，开机自启）
- `Environment=`：代理变量声明式注入，不再依赖启动者的 shell 环境——这次事故的根因被配置化消灭
- `Restart=on-failure`：进程崩溃自动拉起
- 日志同时进 journald 和文件，排查有据

启用与验证：

```bash
systemctl daemon-reload
systemctl enable --now codex-app-server
systemctl is-active codex-app-server   # active
tr '\0' '\n' < /proc/$(systemctl show -p MainPID --value codex-app-server)/environ | grep -c proxy   # 4
```

## 为什么不开 TUN？

服务器刻意不用 TUN/虚拟网卡做全局流量劫持，而是「环境变量代理 + NO_PROXY 白名单」：

- 国内流量（微信 iLink、DeepSeek、通义、火山等）走直连白名单，不绕代理，延迟低、链路稳
- 代理进程挂了最多「外网不通」，不会像 TUN 那样把全服务器流量带走、一崩全断
- 手机端没有「环境变量」这个概念，所以手机必须开虚拟网卡（VPN/TUN）；服务器相反。两边各用各的方案，不能套用

## 经验清单

1. **SYN-SENT = 网络不通的典型信号**。看到卡死先 `ss -tnp` 看连接状态，比瞎猜快得多。
2. **环境变量代理是「应用层自觉」**。手动起进程漏带 `HTTP(S)_PROXY`，进程就裸连；`/proc/<pid>/environ` 一查一个准。
3. **服务化优先于手工进程**。声明式环境变量、崩溃自愈、开机自启，三个手工方案做不到的点，systemd 全包。
4. **`pkill -f` 会匹配自己的命令行**，批量杀进程前先 `pgrep` 确认目标。
5. **验证修复要看连接**：`ss -tnp` 出现到代理的 `ESTABLISHED`，而不是只看进程活着。
