# 从零开始写 Agent ：给 Agent 加上 Skills 系统

> 来源：微信公众号「IchbinDerek」
> 系列：从零开始写 Agent（10/11）
> 链接：http://mp.weixin.qq.com/s?__biz=MzA4NDI2NzgwNQ==&mid=2454801221&idx=1&sn=8387338a4b9f920994888d3a2d05fee2&chksm=884c2d37bf3ba4210363820dcca017d63475924e307505c8be7aebaa916bffc645cf5ec7ea3a#rd

---

爆火的 Hermes Agent，这个东西最牛逼的地方不是它能做什么，而是它能自己进化。

那 Hermes Agent 是怎么做到的？

说到 Agent 的自我进化，这个话题太大了，我们以后可以单独写一篇文章深入聊。

这里先简单说一下，

自我进化其实就是让 Agent 记住自己做过的事和获取过的信息。通过反思，把做过的事变成会做的事。通过反思，避免犯同样的错误。

这里面把做过的事变成会做的事，就是通过 Skills 系统来实现的。

Skill 是什么？

 说穿了也不复杂，就是把一类任务的目标、流程、工具、规则、异常处理、输出格式封装好的可复用能力单元。

今天的文章就来给 Agent 添加 Skills 系统，让我们的 Agent 能够通过增加 Skill 来扩展能力。

实现技能加载器

首先实现一个技能加载器：

"""

Skills 系统 — 可复用的工作流知识

设计理念：

  - 技能是 markdown 文件 (SKILL.md)，包含 YAML frontmatter + 文档正文

  - 支持分类目录结构：skills/<category>/<skill-name>/SKILL.md

  - 技能可以被 LLM 在 system prompt 中引用作为工作流指导

  - 支持技能之间的相互引用 (related_skills)

文件结构：

  skills/

  ├── software-development/

  │   ├── debugging/

  │   │   └── SKILL.md

  │   └── testing/

  │       └── SKILL.md

  └── research/

      └── literature-review/

          └── SKILL.md

Frontmatter 格式：

  ---

  name: skill-name

  description: "简短描述"

  version: 1.0.0

  author: Your Name

  tags: [tag1, tag2]

  related_skills: [other-skill-1, other-skill-2]

  ---

  # 技能标题

  ## Overview

  ...

  ## When to Use

  ...

  ## Steps

  ...

用法：

    from agent_core import AgentCore

    from skill_loader import SkillLoader

    

    # 创建技能加载器

    loader = SkillLoader(base_path="~/my-agent-skills")

    loader.reload()  # 扫描并加载所有技能

    

    # 在 AgentCore 中使用

    core = AgentCore(

        provider_config=PROVIDERS,

        skill_loader=loader,  # 传入技能加载器

    )

    

    # 运行时会自动将相关技能注入 system prompt

"""

import

 os

import

 re

import

 yaml

from

 pathlib

 import

 Path

from

 typing

 import

 Dict

,

 List

,

 Optional

,

 Any

from

 dataclasses

 import

 dataclass, field

@dataclass

class

 Skill

:

    """单个技能的表示"""

    name:

 str

    description:

 str

    version:

 str

 =

 "1.0.0"

    author:

 str

 =

 ""

    tags:

 List

[

str

] = field(default_factory=

list

)

    related_skills:

 List

[

str

] = field(default_factory=

list

)

    content:

 str

 =

 ""

  # 完整的 markdown 内容

    category:

 str

 =

 ""

    file_path: Path = field(default_factory=Path)

    

    def

 to_dict

(

self

) ->

 Dict

[

str

,

 Any

]:

        """转换为字典"""

        return

 {

            "name"

:

 self

.name,

            "description"

:

 self

.description,

            "version"

:

 self

.version,

            "author"

:

 self

.author,

            "tags"

:

 self

.tags,

            "related_skills"

:

 self

.related_skills,

            "category"

:

 self

.category,

        }

    

    def

 get_summary

(

self, max_length:

 int

 =

 500

) ->

 str

:

        """获取技能的摘要（用于注入 system prompt）"""

        # 提取 frontmatter 之后的主要内容

        match

 = re.search(

r&#x27;\n---\s*\n(.+)&#x27;

,

 self

.content, re.DOTALL)

        if

 not

 match

:

            return

 self

.description

        

        body =

 match

.group(

1

).strip()

        

        # 如果正文太长，只取前几个段落

        if

 len

(body) > max_length:

            # 找到 Overview 和 When to Use 部分

            overview_match = re.search(

r&#x27;## Overview\s*\n(.+?)(?=## |\Z)&#x27;

, body, re.DOTALL)

            when_match = re.search(

r&#x27;## When to Use\s*\n(.+?)(?=## |\Z)&#x27;

, body, re.DOTALL)

            

            summary_parts = []

            if

 overview_match:

                summary_parts.append(

f"## Overview\n

{overview_match.group(

1

).strip()}

"

)

            if

 when_match:

                summary_parts.append(

f"\n## When to Use\n

{when_match.group(

1

).strip()}

"

)

            

            return

 "\n"

.join(summary_parts)[:max_length]

        

        return

 body

class

 SkillLoader

:

    """

    技能加载器 — 从文件系统加载和管理技能

    

    用法：

        loader = SkillLoader(base_path="~/.agent-skills")

        loader.reload()  # 扫描并加载所有技能

        

        # 获取所有技能

        all_skills = loader.get_all_skills()

        

        # 按名称获取技能

        skill = loader.get_skill("debugging")

        

        # 按标签搜索

        dev_skills = loader.search_by_tag("development")

        

        # 获取相关技能（含依赖）

        related = loader.get_related_skills("debugging", include_deps=True)

    """

    

    def

 __init__

(

self, base_path:

 Optional

[

str

] =

 None

):

        """

        Args:

            base_path: 技能根目录 (默认 ~/.agent-skills/)

        """

        if

 base_path

 is

 None

:

            base_path = os.path.expanduser(

"~/.agent-skills"

)

        else

:

            base_path = os.path.expanduser(base_path)

        

        self

.base_path = Path(base_path)

        self

._skills:

 Dict

[

str

, Skill] = {}

        self

._skills_by_tag:

 Dict

[

str

,

 List

[

str

]] = {}

        self

._skills_by_category:

 Dict

[

str

,

 List

[

str

]] = {}

    

    def

 reload

(

self

) ->

 int

:

        """

        重新扫描并加载所有技能。

        

        Returns:

            加载的技能数量

        """

        self

._skills = {}

        self

._skills_by_tag = {}

        self

._skills_by_category = {}

        

        if

 not

 self

.base_path.exists():

            print

(

f"  ⚠️ 技能目录不存在：

{self.base_path}

"

)

            return

 0

        

        # 递归扫描所有 SKILL.md 文件

        for

 skill_dir

 in

 self

.base_path.rglob(

"*/"

):

            skill_file = skill_dir /

 "SKILL.md"

            if

 not

 skill_file.exists():

                continue

            

            try

:

                skill =

 self

._load_skill_file(skill_file)

                if

 skill:

                    self

._skills[skill.name] = skill

                    

                    # 索引标签

                    for

 tag

 in

 skill.tags:

                        if

 tag

 not

 in

 self

._skills_by_tag:

                            self

._skills_by_tag[tag] = []

                        self

._skills_by_tag[tag].append(skill.name)

                    

                    # 索引分类

                    if

 skill.category:

                        if

 skill.category

 not

 in

 self

._skills_by_category:

                            self

._skills_by_category[skill.category] = []

                        self

._skills_by_category[skill.category].append(skill.name)

                        

            except

 Exception

 as

 e:

                print

(

f"  ⚠️ 加载技能失败

 {skill_file}

:

 {e}

"

)

        

        print

(

f"  ✅ 加载了

 {

len

(self._skills)}

 个技能"

)

        return

 len

(

self

._skills)

    

    def

 _load_skill_file

(

self, file_path: Path

) ->

 Optional

[Skill]:

        """从文件加载单个技能"""

        content = file_path.read_text(encoding=

"utf-8"

)

        

        # 解析 frontmatter

        if

 not

 content.startswith(

"---"

):

            raise

 ValueError(

"SKILL.md 必须以 &#x27;---&#x27; 开头"

)

        

        # 找到 frontmatter 结束 ---

        end_match = re.search(

r&#x27;\n---\s*\n&#x27;

, content)

        if

 not

 end_match:

            raise

 ValueError(

"SKILL.md frontmatter 没有正确关闭"

)

        

        # 提取 frontmatter 内容 (不包括开头的 --- 和结尾的 ---)

        frontmatter_str = content[:end_match.start()]

        frontmatter = yaml.safe_load(frontmatter_str)

        

        # 验证必需字段

        if

 "name"

 not

 in

 frontmatter:

            raise

 ValueError(

"缺少必需的 &#x27;name&#x27; 字段"

)

        if

 "description"

 not

 in

 frontmatter:

            raise

 ValueError(

"缺少必需的 &#x27;description&#x27; 字段"

)

        

        # 确定分类（从目录路径中提取）

        relative_path = file_path.parent.relative_to(

self

.base_path)

        category = relative_path.parts[

0

]

 if

 relative_path.parts

 else

 ""

        

        return

 Skill(

            name=frontmatter[

"name"

],

            description=frontmatter[

"description"

],

            version=frontmatter.get(

"version"

,

 "1.0.0"

),

            author=frontmatter.get(

"author"

,

 ""

),

            tags=frontmatter.get(

"tags"

, []),

            related_skills=frontmatter.get(

"related_skills"

, []),

            content=content,

            category=category,

            file_path=file_path,

        )

    

    def

 get_skill

(

self, name:

 str

) ->

 Optional

[Skill]:

        """按名称获取技能"""

        return

 self

._skills.get(name)

    

    def

 get_all_skills

(

self

) ->

 List

[Skill]:

        """获取所有技能"""

        return

 list

(

self

._skills.values())

    

    def

 search_by_tag

(

self, tag:

 str

) ->

 List

[Skill]:

        """按标签搜索技能"""

        skill_names =

 self

._skills_by_tag.get(tag.lower(), [])

        return

 [

self

._skills[name]

 for

 name

 in

 skill_names

 if

 name

 in

 self

._skills]

    

    def

 search_by_category

(

self, category:

 str

) ->

 List

[Skill]:

        """按分类搜索技能"""

        skill_names =

 self

._skills_by_category.get(category, [])

        return

 [

self

._skills[name]

 for

 name

 in

 skill_names

 if

 name

 in

 self

._skills]

    

    def

 get_related_skills

(

self, skill_name:

 str

, include_deps:

 bool

 =

 True

, max_depth:

 int

 =

 2

) ->

 List

[Skill]:

        """

        获取与指定技能相关的技能（包括它引用的 related_skills）。

        

        Args:

            skill_name: 技能名称

            include_deps: 是否递归包含依赖技能的 related_skills

            max_depth: 递归深度限制

        

        Returns:

            相关技能列表

        """

        result = []

        visited =

 set

()

        

        def

 collect

(

name:

 str

, depth:

 int

):

            if

 depth <=

 0

 or

 name

 in

 visited:

                return

            visited.add(name)

            

            skill =

 self

._skills.get(name)

            if

 not

 skill:

                return

            

            # 添加此技能的所有 related_skills

            for

 related_name

 in

 skill.related_skills:

                if

 related_name

 not

 in

 visited

 and

 related_name

 in

 self

._skills:

                    result.append(

self

._skills[related_name])

                    if

 include_deps:

                        collect(related_name, depth -

 1

)

        

        collect(skill_name, max_depth)

        return

 result

    

    def

 format_skills_for_prompt

(

self, skills:

 List

[Skill], max_total_chars:

 int

 =

 3000

) ->

 str

:

        """

        将技能列表格式化为适合注入 system prompt 的文本。

        

        Args:

            skills: 技能列表

            max_total_chars: 最大总字符数

        

        Returns:

            格式化的技能文本

        """

        if

 not

 skills:

            return

 ""

        

        parts = []

        current_length =

 0

        

        for

 skill

 in

 skills:

            # 使用简要描述

            skill_text =

 f"###

 {skill.name}

\n

{skill.description}

"

            if

 current_length +

 len

(skill_text) > max_total_chars:

                break

            

            parts.append(skill_text)

            current_length +=

 len

(skill_text)

        

        separator =

 "\n\n"

        return

 separator.join(parts)

# 全局默认加载器（可选）

_default_loader:

 Optional

[SkillLoader] =

 None

def

 get_default_skill_loader

() -> SkillLoader:

    """获取或创建全局默认技能加载器"""

    global

 _default_loader

    if

 _default_loader

 is

 None

:

        _default_loader = SkillLoader()

        _default_loader.reload()

    return

 _default_loader

集成到 AgentCore

接下来，在 AgentCore 中将 SkillLoader 加载的 Skill 注入到 Agent 的系统提示词中：

    def

 _default_system_prompt

(

self, active_skills:

 Optional

[

List

[Skill]] =

 None

) ->

 str

:

        """构建默认通用系统提示词 (含记忆注入和技能注入)"""

        mgr =

 self

.get_tool_manager()

        registry = get_global_registry()

        tool_names = mgr.get_tool_names()

        

        tool_desc = []

        for

 name

 in

 tool_names:

            meta = registry.get(name)

            if

 meta:

                tool_desc.append(

f"  -

 {name}

:

 {meta.description}

"

)

        

        tools_section =

 "\n"

.join(tool_desc)

 if

 tool_desc

 else

 "(无可用工具)"

        

        # ── 记忆注入 ───────────────

        memory_injection =

 ""

        if

 self

.enable_memory

 and

 self

._memory_store:

            memory_injection =

 self

._memory_store.format_for_system_prompt()

        

        # ── 技能注入 ───────────────

        skills_section =

 ""

        if

 self

.enable_skills

 and

 active_skills

 and

 self

._skill_loader

 is

 not

 None

:

            try

:

                loader =

 self

.get_skill_loader()

                skills_section = loader.format_skills_for_prompt(active_skills, max_total_chars=

2500

)

                skills_section =

 f"\n\n## 相关技能参考\n\n

{skills_section}

"

            except

 Exception

 as

 e:

                logger.warning(

f"技能注入失败：

{e}

"

)

                skills_section =

 ""

        

        base_prompt =

 f"""你是一个智能助手。

{memory_injection}

可用工具：

{tools_section}

{skills_section}

重要规则：

1. 如果需要多个信息，请按需调用多个工具

2. 回答要简洁实用

3. 如果发现值得长期记住的信息，请使用 memory 工具保存到持久化记忆"""

        

        return

 base_prompt 

总结与展望

到这里，我们就已经实现了 Agent 的 Skills 系统。

文章最后再补充一点，

Skills 系统，是一种很好的扩展 Agent 能力的方式。

而且，

Skill 是可以积累的。

• 今天你写了一个写邮件的 Skill，

• 明天你写了一个数据分析的 Skill，

• 后天你写了一个画图的 Skill。

这些 Skill 积累起来，你的 Agent 就越来越强大。
