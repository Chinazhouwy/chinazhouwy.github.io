# 100 天面试题扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从新增面经中补充 #217～#416 共 200 道不重复题目，并将 #50～#416 分配到 2026-07-04 至 2026-10-11 的 100 天日历。

**Architecture:** 先建立新增来源清单和领域配额，再生成题目；使用独立校验脚本检查题号、来源路径、重复度和领域数量。日历由脚本按工作日、周末、法定节假日和调休规则生成，最终由 Markdown 保存计划，由脚本负责可重复验证。

**Tech Stack:** Python 3 标准库、Markdown、Git、Hermes Skill/cron JSON。

---

### Task 1: 建立新增来源审计清单

**Files:**
- Create: `practice/source-audit-2026-07-04.md`
- Create: `scripts/audit_question_sources.py`

- [ ] **Step 1: 编写来源审计脚本**

脚本接收基线提交 `00cf77fa4354eca3fac184b49d2a7ccf1d707455`，读取新增 Markdown、
排除 `practice/`、`tech-notes/`、`references/`、`hobbies/`、`docs/`，并与
`practice/active-batch-plan.md` 中反引号路径比较，输出：

```text
新增 Markdown 数
候选面试来源数
已进入题池数
尚未进入题池数
按目录分类的遗漏来源
```

- [ ] **Step 2: 运行脚本生成审计清单**

Run:

```bash
python3 scripts/audit_question_sources.py \
  --baseline 00cf77fa4354eca3fac184b49d2a7ccf1d707455 \
  --plan practice/active-batch-plan.md \
  --output practice/source-audit-2026-07-04.md
```

Expected: 输出约 77 个尚未进入题池的候选来源，且每个路径实际存在。

- [ ] **Step 3: 校验清单**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path("practice/source-audit-2026-07-04.md").read_text()
assert "尚未进入题池" in text
assert "ai-agent/" in text
print("source audit PASS")
PY
```

- [ ] **Step 4: 提交来源审计**

```bash
git add scripts/audit_question_sources.py practice/source-audit-2026-07-04.md
git commit -m "chore: 审计新增面试题来源"
```

### Task 2: 生成 #217～#416 新题

**Files:**
- Modify: `practice/active-batch-plan.md`
- Create: `scripts/validate_practice_plan.py`

- [ ] **Step 1: 建立现有题目归一化集合**

校验脚本提取 #1～#216 的题目，移除编号、标点、状态标记和常见停用词，生成用于重复检查的规范化文本。

- [ ] **Step 2: 从遗漏来源抽取 200 道题**

按以下配额追加 #217～#416：

```text
Java/JVM/并发                     40
Spring/微服务                     25
MySQL/Redis/MQ                    40
分布式/系统设计                    30
AI Agent/Harness/MCP/Memory       35
RAG/模型工程/Eval                  20
算法/编码                          10
```

每一行使用：

```markdown
| 217 | 方向 | 可直接用于面试的题目 | `真实/来源文件.md` |
```

优先使用 `practice/source-audit-2026-07-04.md` 中未覆盖来源；同一概念只能保留一个母题，
其他来源合并到来源列。

- [ ] **Step 3: 编写计划校验器**

`scripts/validate_practice_plan.py` 必须检查：

```text
#217～#416 连续且恰好 200 题
每行四列
每个来源路径存在
无重复题号
领域配额与设计一致
归一化题目无完全重复
与 #1～#216 无完全重复
```

- [ ] **Step 4: 运行校验**

Run:

```bash
python3 scripts/validate_practice_plan.py practice/active-batch-plan.md
```

Expected:

```text
new_questions=200
range=217-416
source_errors=0
duplicate_numbers=0
duplicate_questions=0
validation=PASS
```

- [ ] **Step 5: 提交新题池**

```bash
git add practice/active-batch-plan.md scripts/validate_practice_plan.py
git commit -m "feat: 补充200道面试题"
```

### Task 3: 生成 100 天逐日计划

**Files:**
- Create: `practice/100-day-plan.md`
- Create: `scripts/generate_100_day_plan.py`

- [ ] **Step 1: 编写日历生成器**

固定参数：

```python
start = "2026-07-04"
days = 100
question_start = 50
question_end = 416
weekday_quota = 3
rest_day_quota = 5
holidays = ["2026-09-25", "2026-09-26", "2026-09-27",
            "2026-10-01", "2026-10-02", "2026-10-03",
            "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"]
makeup_workdays = ["2026-09-20", "2026-10-10"]
```

逐日表格字段：

```markdown
| Day | 日期 | 类型 | 新题配额 | 题号 | 实际完成 | 备注 |
```

第 100 天分配完 #416，剩余 1 个容量标记为机动位。

- [ ] **Step 2: 生成日历**

Run:

```bash
python3 scripts/generate_100_day_plan.py \
  --output practice/100-day-plan.md
```

- [ ] **Step 3: 验证容量和日期**

Run:

```bash
python3 scripts/generate_100_day_plan.py --check practice/100-day-plan.md
```

Expected:

```text
date_range=2026-07-04..2026-10-11
workdays=66
rest_days=34
capacity=368
assigned_questions=367
buffer_slots=1
validation=PASS
```

- [ ] **Step 4: 提交日历**

```bash
git add practice/100-day-plan.md scripts/generate_100_day_plan.py
git commit -m "feat: 增加100天面试学习计划"
```

### Task 4: 接入 Hermes Skill 与定时任务

**Files:**
- Modify remote: `/root/.hermes/skills/research/interview-preparation-curator/SKILL.md`
- Modify remote: `/root/.hermes/cron/jobs.json`

- [ ] **Step 1: 更新中文版 Skill**

增加 `practice/100-day-plan.md` 的职责：

```text
实时面试完成题目后更新实际完成列
早间计划读取当天行
晚间整理只核实当天实际完成，不重排整个日历
跳过题保留为空，不伪造完成
复习仍由 review-schedule 到期队列管理
```

- [ ] **Step 2: 更新四个面试 cron**

```text
早间：读取当天日期行，展示题号和优先复习项
中午：只读提醒
晚间：核实 actual completion，更新日历和复习队列
周报：按实际完成列统计，不按计划配额统计
```

继续保留：

```text
禁止 git add -A
禁止修改标准答案
禁止把计划当作完成
```

- [ ] **Step 3: 备份并部署**

```bash
TS=$(date +%Y%m%d-%H%M%S)
cp SKILL.md "SKILL.md.bak-$TS"
cp jobs.json "jobs.json.bak-$TS"
```

- [ ] **Step 4: 校验 Hermes 配置**

检查四个面试任务均加载 `interview-preparation-curator`，Prompt 均引用
`practice/100-day-plan.md`，JSON 可被 `jq` 正常解析。

### Task 5: 同步、验收和双推

**Files:**
- Verify: `practice/active-batch-plan.md`
- Verify: `practice/100-day-plan.md`
- Verify: `practice/review-schedule.md`

- [ ] **Step 1: 运行全部校验**

```bash
python3 scripts/audit_question_sources.py --check practice/source-audit-2026-07-04.md
python3 scripts/validate_practice_plan.py practice/active-batch-plan.md
python3 scripts/generate_100_day_plan.py --check practice/100-day-plan.md
git diff --check
```

- [ ] **Step 2: 检查 Git 范围**

`git status --short` 中不得包含站点、部署脚本或无关文件。

- [ ] **Step 3: 提交最终接入**

```bash
git add practice scripts
git commit -m "chore: 接入100天面试执行计划"
```

- [ ] **Step 4: 同步双远端**

先拉取 Gitee 与 GitHub 最新提交并合并，再将同一 `master` 推送到两个远端。

- [ ] **Step 5: 同步服务器正式工作区**

仅允许 fast-forward；保留服务器现有未提交站点文件。最终确认：

```text
Gitee/GitHub 分叉 0/0
服务器 HEAD 等于远端 master
Hermes Skill 为中文版
四个面试 cron 校验通过
```
