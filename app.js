const SECTION_LABELS = {
  tasks: "行动摘要",
  projects: "项目",
  learning: "学习",
  opportunity: "机会",
  reading: "阅读",
  columns: "知识地图",
  questions: "能力复盘",
  companies: "机会记录",
  interviews: "表达演练",
  plans: "阶段路线",
};

const GISCUS_CONFIG = {
  repo: "Chinazhouwy/chinazhouwy.github.io",
  repoId: "R_kgDOOzTMhA",
  category: "Announcements",
  categoryId: "DIC_kwDOOzTMhM4DBhIz",
};

const GISCUS_RETURN_HASH_KEY = "wy_giscus_return_hash";

function restoreGiscusArticleRoute() {
  const hasGiscusToken = new URLSearchParams(location.search).has("giscus");
  if (!hasGiscusToken || location.hash) return;

  try {
    const returnHash = sessionStorage.getItem(GISCUS_RETURN_HASH_KEY);
    if (!returnHash?.startsWith("#/article/")) return;
    sessionStorage.removeItem(GISCUS_RETURN_HASH_KEY);
    history.replaceState(null, "", `${location.pathname}${location.search}${returnHash}`);
  } catch {
    // Session storage may be unavailable in strict privacy modes.
  }
}

restoreGiscusArticleRoute();

const ui = {
  app: document.getElementById("app"),
  search: document.getElementById("search-input"),
  navLinks: [...document.querySelectorAll("[data-view]")],
};

const state = {
  articles: [],
  dashboard: {},
  columns: [],
  projects: [],
  quickLinks: [],
  aliases: {},
  query: "",
};

marked.setOptions({ breaks: true, gfm: true });

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function articleHref(path) {
  return `#/article/${encodeURIComponent(path)}`;
}

function formatDate(value, options = {}) {
  if (!value) return "日期未记录";
  const parsed = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    ...options,
  }).format(parsed);
}

function scoreText(score) {
  return score === null || score === undefined ? "未评分" : `${score}/10`;
}

function average(values) {
  const valid = values.filter((value) => typeof value === "number");
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

// ---- visibility helpers ----
function isHidden(article) {
  return article.visibility === "hidden";
}

function canShowOnHome(article) {
  return !isHidden(article) && article.visibility !== "private";
}

function canShowInSection(article) {
  return !isHidden(article);
}

// ---- section normalization ----
function normalizeSection(value) {
  const raw = String(value || "").trim().toLowerCase();

  const map = {
    questions: "questions",
    question: "questions",
    practice: "questions",
    "ability-review": "questions",
    "能力复盘": "questions",

    companies: "companies",
    company: "companies",
    "company-records": "companies",
    "company_records": "companies",
    "机会记录": "companies",
    "公司记录": "companies",

    interviews: "interviews",
    interview: "interviews",
    "mock-interviews": "interviews",
    "mock_interviews": "interviews",
    mock: "interviews",
    "模拟面试": "interviews",

    plans: "plans",
    plan: "plans",
    tasks: "tasks",
    "阶段计划": "plans",

    notes: "learning",
    learning: "learning",
    study: "learning",
    "学习": "learning",

    opportunity: "opportunity",
    career: "opportunity",
    "机会": "opportunity",

    projects: "projects",
    project: "projects",
    "项目": "projects",

    reading: "reading",
    read: "reading",
    "阅读": "reading",

    columns: "columns",
    column: "columns",
    "专栏": "columns",
  };

  return map[raw] || raw;
}

function getArticleSection(article) {
  return normalizeSection(
    article.section ||
    article.domain ||
    inferSectionByPath(article.path || article.url || "") ||
    article.category ||
    article.type
  );
}

// ---- path-based section inference ----
function inferSectionByPath(path = "") {
  const normalizedPath = String(path).toLowerCase();

  if (normalizedPath.includes("content/opportunity/practice/")) return "questions";
  if (normalizedPath.includes("content/opportunity/companies/")) return "companies";
  if (normalizedPath.includes("content/opportunity/mock-interviews/")) return "interviews";
  if (normalizedPath.includes("content/opportunity/interviews/")) return "interviews";
  if (normalizedPath.includes("content/opportunity/plans/")) return "plans";

  if (normalizedPath.includes("/practice/")) return "questions";
  if (normalizedPath.includes("/companies/")) return "companies";
  if (normalizedPath.includes("/interviews/")) return "interviews";
  if (normalizedPath.includes("/plans/")) return "plans";

  if (normalizedPath.includes("content/learning/")) return "learning";
  if (normalizedPath.includes("content/reading/")) return "reading";
  if (normalizedPath.includes("content/projects/")) return "projects";
  if (normalizedPath.includes("content/columns/")) return "columns";

  return "";
}

// ---- reading area normalization ----
function normalizeReadingArea(article) {
  const raw = String(article.area || article.category || article.folder || article.path || "").toLowerCase();

  if (raw.includes("politics") || raw.includes("society") || raw.includes("policy") || raw.includes("world")) return "世界观察";
  if (raw.includes("finance") || raw.includes("market") || raw.includes("industry") || raw.includes("business")) return "市场笔记";
  if (raw.includes("history")) return "历史纵深";
  if (raw.includes("book") || raw.includes("books")) return "读书札记";
  if (raw.includes("hobbies") || raw.includes("life") || raw.includes("personal") || raw.includes("chayanyuese")) return "生活审美";
  if (raw.includes("clips") || raw.includes("clip")) return "剪藏箱";

  return article.area || "剪藏箱";
}

// ---- section-specific article getters ----
function getQuestionArticles() {
  return state.articles
    .filter(canShowInSection)
    .filter((article) => getArticleSection(article) === "questions")
    .filter(matchesSearch);
}

function getCompanyArticles() {
  return state.articles
    .filter(canShowInSection)
    .filter((article) => getArticleSection(article) === "companies")
    .filter(matchesSearch);
}

function getInterviewArticles() {
  return state.articles
    .filter(canShowInSection)
    .filter((article) => {
      const sec = getArticleSection(article);
      // Include both standalone interview articles and practice articles with scores
      return sec === "interviews" || (sec === "questions" && (article.score !== null || article.questionNumber !== null));
    })
    .filter(matchesSearch);
}

function getPlanArticles() {
  return state.articles
    .filter(canShowInSection)
    .filter((article) => getArticleSection(article) === "plans")
    .filter(matchesSearch);
}

// ---- search ----
function matchesSearch(article) {
  if (!state.query) return true;

  const haystack = [
    article.title,
    article.summary,
    article.topic,
    article.company,
    article.round,
    article.category,
    article.column,
    article.domain,
    article.section,
    article.area,
    article.module,
    article.project,
    article.type,
    article.question,
    ...(article.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(state.query);
}

// ---- filtered articles ----
function filteredArticles(section, { includePrivate = true } = {}) {
  const target = normalizeSection(section);

  return state.articles
    .filter((article) => {
      if (isHidden(article)) return false;
      if (!includePrivate && article.visibility === "private") return false;

      const articleSection = getArticleSection(article);
      return articleSection === target;
    })
    .filter(matchesSearch);
}

function groupBy(items, key, fallback = "其他") {
  return items.reduce((groups, item) => {
    const value = item[key] || fallback;
    groups[value] ||= [];
    groups[value].push(item);
    return groups;
  }, {});
}

function iconArrow() {
  return `
    <svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6"></path>
    </svg>
  `;
}

function articleRow(article, options = {}) {
  const refPath = article.path || article.url;
  if (!refPath) {
    return `
      <div class="article-row">
        <span class="article-row-index">${options.index || article.questionNumber || "·"}</span>
        <span class="article-row-main">
          <strong>${escapeHtml(article.title)}</strong>
          <small>路径缺失</small>
        </span>
      </div>
    `;
  }
  return `
    <a class="article-row" href="${articleHref(refPath)}">
      <span class="article-row-index">${options.index || article.questionNumber || "·"}</span>
      <span class="article-row-main">
        <strong>${escapeHtml(article.title)}</strong>
        <small>
          ${[article.company, article.round, article.topic || article.module || article.area, article.date]
            .filter(Boolean)
            .map(escapeHtml)
            .join(" · ") || "未分类"}
        </small>
      </span>
      ${
        article.score !== null && article.score !== undefined
          ? `<span class="score ${article.score < 4 ? "score-low" : ""}">${scoreText(article.score)}</span>`
          : iconArrow()
      }
    </a>
  `;
}

function sectionIntro(kicker, title, description, count) {
  return `
    <header class="page-intro reveal">
      <div>
        <p class="mono-label">${escapeHtml(kicker)}</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </div>
      ${count === undefined ? "" : `<div class="page-count"><strong>${count}</strong><span>篇记录</span></div>`}
    </header>
  `;
}

function lineChart(daily) {
  const points = daily.slice(-14);
  if (!points.length) return '<div class="chart-empty">持续记录后，这里会出现阶段趋势。</div>';
  const width = 720;
  const height = 210;
  const padding = 28;
  const maxCount = Math.max(...points.map((item) => item.count), 1);
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const scorePoints = points
    .map((item, index) => {
      const x = padding + index * step;
      const score = item.averageScore ?? 0;
      const y = height - padding - (score / 10) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const bars = points
    .map((item, index) => {
      const x = padding + index * step - 9;
      const barHeight = (item.count / maxCount) * 74;
      return `<rect x="${x}" y="${height - padding - barHeight}" width="18" height="${barHeight}" rx="3"></rect>`;
    })
    .join("");
  const labels = points
    .map((item, index) => {
      if (points.length > 8 && index % 2) return "";
      return `<text x="${padding + index * step}" y="${height - 6}" text-anchor="middle">${item.date.slice(5)}</text>`;
    })
    .join("");

  return `
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="近十四天题量与平均分趋势">
      <line class="chart-axis" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
      <g class="chart-bars">${bars}</g>
      <polyline class="chart-line" points="${scorePoints}"></polyline>
      <g class="chart-labels">${labels}</g>
    </svg>
  `;
}

function renderOverview() {
  const dashboard = state.dashboard;
  const today = dashboard.today || {};
  const recent = state.articles
    .filter(canShowOnHome)
    .filter(matchesSearch)
    .slice(0, 6);
  const weakTopics = dashboard.weakTopics || [];

  // Focus items: prefer projects over weakTopics
  const focusItems = state.projects.length
    ? state.projects.map((item) => ({
        name: item.name,
        status: item.status || item.priority || "进行中",
      }))
    : weakTopics.map((item) => ({
        name: item.topic,
        status: item.averageScore ? `${item.averageScore}` : "待复盘",
      }));

  // Reading section uses canShowOnHome
  const readingItems = state.articles
    .filter((a) => canShowOnHome(a) && normalizeSection(getArticleSection(a)) === "reading")
    .filter(matchesSearch)
    .slice(0, 3);

  ui.app.innerHTML = `
    <section class="dashboard">
      <div class="dashboard-lead reveal">
        <p class="mono-label" id="daily-tip-source">每日摘句 / 正在加载</p>
        <h1 id="hero-title">正在加载<br />每日摘句</h1>
        <p class="lead-copy">${escapeHtml(formatDate(today.date, { year: "numeric", weekday: "long" }))}</p>
        <a class="primary-link" href="#/projects">查看当前方向 ${iconArrow()}</a>
      </div>

      <aside class="today-panel reveal delay-1">
        <div class="panel-heading">
          <span class="mono-label">TODAY / 今日状态</span>
          <span class="status-dot"></span>
        </div>
        <div class="today-number">
          <strong>${today.count || 0}</strong>
          <span>项记录</span>
        </div>
        <dl>
          <div><dt>今日状态</dt><dd>${today.averageScore ?? "—"}</dd></div>
          <div><dt>连续记录</dt><dd>${dashboard.streakDays || 0} 天</dd></div>
          <div><dt>累计沉淀</dt><dd>${dashboard.totalQuestions || 0} 项</dd></div>
        </dl>
      </aside>

      <div class="metric-strip reveal delay-1">
        <div><span>整体评分</span><strong>${dashboard.averageScore ?? "—"}</strong><small>/ 10</small></div>
        <div><span>已复盘</span><strong>${dashboard.scoredQuestions || 0}</strong><small>道</small></div>
        <div><span>内容沉淀</span><strong>${state.articles.length}</strong><small>篇</small></div>
        <div><span>当前项目</span><strong>${state.projects.length}</strong><small>项</small></div>
      </div>

      <div class="overview-grid">
        <section class="trend-section reveal">
          <div class="section-heading">
            <div><p class="mono-label">PROGRESS / 近 14 天</p><h2>阶段趋势</h2></div>
            <div class="chart-legend"><span class="legend-bar">记录</span><span class="legend-line">状态</span></div>
          </div>
          ${lineChart(dashboard.daily || [])}
        </section>

        <section class="focus-section reveal delay-1">
          <div class="section-heading">
            <div><p class="mono-label">FOCUS / 当前方向</p><h2>正在推进</h2></div>
          </div>
          <div class="weak-list">
            ${
              focusItems.length
                ? focusItems
                    .map(
                      (item, index) => `
                        <a href="#/projects">
                          <span>${String(index + 1).padStart(2, "0")}</span>
                          <strong>${escapeHtml(item.name)}</strong>
                          <i style="--level:${Math.max(18, 90-index*15)}%"></i>
                          <em>${escapeHtml(item.status)}</em>
                        </a>`,
                    )
                    .join("")
                : '<p class="empty-copy">持续记录后，这里会出现当前方向。</p>'
            }
          </div>
        </section>
      </div>

      <section class="project-strip reveal">
        <div class="section-heading">
          <div><p class="mono-label">PROJECTS / 当前项目</p><h2>长期建设</h2></div>
          <a href="#/projects">查看项目 ${iconArrow()}</a>
        </div>
        <div class="quiet-list">
          ${state.projects
            .map(
              (project) => `
                <a class="quiet-row" href="#/projects">
                  <span><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.summary || "")}</small></span>
                  <em class="public-pill">${escapeHtml(project.status || "进行中")}</em>
                </a>`,
            )
            .join("") || '<p class="empty-copy">项目清单等待补充。</p>'}
        </div>
      </section>

      <section class="plan-section reveal">
        <div class="section-heading">
          <div><p class="mono-label">READING / 阅读流</p><h2>最近阅读</h2></div>
          <a href="#/reading">进入阅读 ${iconArrow()}</a>
        </div>
        <div class="plan-list">
          ${
            readingItems.length
              ? readingItems
                  .map(
                    (plan, index) => `
                      <a href="${articleHref(plan.path)}">
                        <time>${String(index + 1).padStart(2, "0")}</time>
                        <span><strong>${escapeHtml(plan.title)}</strong><small>${escapeHtml(plan.summary || "阅读沉淀")}</small></span>
                        ${iconArrow()}
                      </a>`,
                  )
                  .join("")
              : '<p class="empty-copy">阅读栏目已建立，等待第一篇沉淀。</p>'
          }
        </div>
      </section>

      <details class="private-summary reveal">
        <summary>内部任务摘要</summary>
        <div class="quiet-list">
          ${state.projects
            .map(
              (project) => `
                <div class="quiet-row">
                  <span><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.next_public_step || "按当前节奏继续推进")}</small></span>
                </div>`,
            )
            .join("") || '<p class="empty-copy">暂无待办摘要。</p>'}
        </div>
      </details>

      <section class="recent-section reveal delay-1">
        <div class="section-heading">
          <div><p class="mono-label">LATEST / 最近沉淀</p><h2>继续阅读</h2></div>
        </div>
        <div class="article-list">${recent.map((item, index) => articleRow(item, { index: String(index + 1).padStart(2, "0") })).join("")}</div>
      </section>
    </section>
  `;
}

function renderProjects() {
  const articles = filteredArticles("projects");
  ui.app.innerHTML = `
    <section class="directory-page">
      ${sectionIntro("PROJECTS", "项目", "自研项目、工程源码研究和长期建设。", state.projects.length)}
      <div class="project-strip reveal delay-1">
        <div class="quiet-list">
          ${state.projects
            .map(
              (project) => `
                <div class="quiet-row">
                  <span>
                    <strong>${escapeHtml(project.name)}</strong>
                    <small>${escapeHtml(project.summary || "")}</small>
                    ${project.next_public_step ? `<small>下一步：${escapeHtml(project.next_public_step)}</small>` : ""}
                  </span>
                  <em class="public-pill">${escapeHtml(project.status || "进行中")}</em>
                </div>`,
            )
            .join("") || '<p class="empty-copy">项目清单等待补充。</p>'}
        </div>
      </div>
      ${
        articles.length
          ? `<section class="directory-group reveal"><header><h2>项目记录</h2><span>${articles.length} 篇</span></header><div class="article-list">${articles.map((article) => articleRow(article)).join("")}</div></section>`
          : ""
      }
    </section>`;
}

function renderDomain(section, title, description, { groupKey } = {}) {
  const items = filteredArticles(section);
  const effectiveGroupKey = groupKey || "area";
  const groups = Object.entries(
    typeof effectiveGroupKey === "function"
      ? items.reduce((acc, item) => {
          const key = effectiveGroupKey(item);
          acc[key] ||= [];
          acc[key].push(item);
          return acc;
        }, {})
      : groupBy(items, effectiveGroupKey, "综合")
  );
  ui.app.innerHTML = `
    <section class="directory-page">
      ${sectionIntro(section.toUpperCase(), title, description, items.length)}
      <div class="directory-groups">
        ${groups.length ? groups.map(([area, articles]) => `
          <section class="directory-group reveal">
            <header><h2>${escapeHtml(area)}</h2><span>${articles.length} 篇</span></header>
            <div class="article-list">${articles.map((article) => articleRow(article)).join("")}</div>
          </section>`).join("") : '<p class="empty-copy">栏目已建立，等待内容沉淀。</p>'}
      </div>
    </section>`;
}

function quickLinkCard(link) {
  return `
    <a class="quick-link-card" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
      <span>${escapeHtml(link.group)}</span>
      <strong>${escapeHtml(link.shortName || link.name)}</strong>
      <p>${escapeHtml(link.description)}</p>
      <em>打开资源 ↗</em>
    </a>
  `;
}

function renderQuickLinks() {
  const links = state.quickLinks;
  if (!links.length) return "";

  const featured = links.filter((link) => link.featured).slice(0, 12);
  const groups = Object.entries(groupBy(links, "group"));

  return `
    <section class="quick-links-section reveal delay-1">
      <div class="section-heading">
        <div><p class="mono-label">QUICK LINKS / 快速连接</p><h2>原典与开放知识入口</h2></div>
        <span class="quick-link-count">${links.length} 个站点</span>
      </div>
      <p class="quick-links-intro">从原典、人物与地理数据库开始，再进入哲学解释、数学史和开放课程。</p>
      <div class="quick-link-grid">${featured.map(quickLinkCard).join("")}</div>
      <details class="quick-link-directory">
        <summary>查看全部 ${links.length} 个资源</summary>
        <div class="quick-link-groups">
          ${groups
            .map(
              ([group, groupLinks]) => `
                <section>
                  <h3>${escapeHtml(group)}</h3>
                  <div>
                    ${groupLinks
                      .map(
                        (link) => `
                          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
                            ${escapeHtml(link.shortName || link.name)} <span>↗</span>
                          </a>`,
                      )
                      .join("")}
                  </div>
                </section>`,
            )
            .join("")}
        </div>
      </details>
    </section>
  `;
}

function renderReading() {
  const items = filteredArticles("reading");
  const groups = Object.entries(
    items.reduce((acc, item) => {
      const key = normalizeReadingArea(item);
      acc[key] ||= [];
      acc[key].push(item);
      return acc;
    }, {}),
  );

  ui.app.innerHTML = `
    <section class="directory-page">
      ${sectionIntro("READING", "阅读", "闲暇输入、网页剪藏、读书札记和个人观察。这里不追求每篇都成体系，先保留思考痕迹。", items.length)}
      ${renderQuickLinks()}
      <div class="directory-groups">
        ${
          groups.length
            ? groups
                .map(
                  ([area, articles]) => `
                    <section class="directory-group reveal">
                      <header><h2>${escapeHtml(area)}</h2><span>${articles.length} 篇</span></header>
                      <div class="article-list">${articles.map((article) => articleRow(article)).join("")}</div>
                    </section>`,
                )
                .join("")
            : '<p class="empty-copy">栏目已建立，等待内容沉淀。</p>'
        }
      </div>
    </section>`;
}

function renderQuestions() {
  const items = getQuestionArticles();
  const groups = groupBy(items, "topic");
  const requestedTopic = new URLSearchParams(location.hash.split("?")[1] || "").get("topic");
  const entries = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  ui.app.innerHTML = `
    <section class="directory-page">
      ${sectionIntro("ABILITY REVIEW", "能力复盘", "按技术方向整理具体题目、场景题、系统设计题和待复盘项。点击每一道题可以查看完整详情。", items.length)}
      <div class="topic-index reveal delay-1">
        ${entries
          .map(
            ([topic, articles]) => `
              <a href="#topic-${encodeURIComponent(topic)}" class="${requestedTopic === topic ? "active" : ""}">
                <strong>${escapeHtml(topic)}</strong><span>${articles.length}</span>
              </a>`,
          )
          .join("")}
      </div>
      <div class="directory-groups">
        ${entries
          .map(
            ([topic, articles]) => `
              <section id="topic-${encodeURIComponent(topic)}" class="directory-group reveal">
                <header><h2>${escapeHtml(topic)}</h2><span>${articles.length} 篇</span></header>
                <div class="article-list">${articles.map((article) => articleRow(article)).join("")}</div>
              </section>`,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderCompanies() {
  const items = getCompanyArticles();
  const groups = Object.entries(groupBy(items, "company", "其他公司")).sort(
    (a, b) => b[1].length - a[1].length,
  );
  ui.app.innerHTML = `
    <section class="directory-page">
      ${sectionIntro("OPPORTUNITY FILES", "机会记录", "按来源、公司、轮次归档具体记录，用于复盘不同团队的关注点。", items.length)}
      <div class="company-grid">
        ${groups
          .map(([company, articles], index) => {
            const rounds = new Set(articles.map((item) => item.round).filter(Boolean));
            return `
              <section class="company-block reveal" style="--delay:${Math.min(index, 5) * 45}ms">
                <header>
                  <span>${String(index + 1).padStart(2, "0")}</span>
                  <div><h2>${escapeHtml(company)}</h2><p>${articles.length} 篇记录 · ${rounds.size || "多"} 个轮次</p></div>
                </header>
                <div class="article-list">${articles.slice(0, 8).map((article) => articleRow(article)).join("")}</div>
                ${articles.length > 8 ? `<button class="expand-list" type="button" data-company="${escapeHtml(company)}">展开全部 ${articles.length} 篇</button>` : ""}
              </section>`;
          })
          .join("")}
      </div>
    </section>
  `;

  document.querySelectorAll("[data-company]").forEach((button) => {
    button.addEventListener("click", () => {
      const company = button.dataset.company;
      const block = button.closest(".company-block");
      block.querySelector(".article-list").innerHTML = groups
        .find(([name]) => name === company)[1]
        .map((article) => articleRow(article))
        .join("");
      button.remove();
    });
  });
}

function renderInterviews() {
  const items = getInterviewArticles();
  const dated = groupBy(items, "date", "日期未记录");
  const days = Object.entries(dated).sort((a, b) => b[0].localeCompare(a[0]));
  ui.app.innerHTML = `
    <section class="directory-page">
      ${sectionIntro("EXPRESSION DRILL", "表达演练", "问答表达、回答质量、评分和改进记录。", items.length)}
      <div class="interview-summary reveal delay-1">
        <div><strong>${state.dashboard.averageScore ?? "—"}</strong><span>整体评分</span></div>
        <div><strong>${state.dashboard.scoredQuestions || 0}</strong><span>已复盘题目</span></div>
        <div><strong>${days.filter(([day]) => day !== "日期未记录").length}</strong><span>复盘日期</span></div>
        <div><strong>${state.dashboard.streakDays || 0}</strong><span>连续记录</span></div>
      </div>
      <div class="interview-days">
        ${days
          .map(([day, articles]) => {
            const dayAverage = average(articles.map((item) => item.score));
            return `
              <section class="interview-day reveal">
                <header>
                  <time>${day === "日期未记录" ? day : formatDate(day, { year: "numeric", weekday: "short" })}</time>
                  <div><strong>${articles.length}</strong><span>记录</span><strong>${dayAverage === null ? "—" : dayAverage.toFixed(1)}</strong><span>状态</span></div>
                </header>
                <div class="article-list">${articles.map((article) => articleRow(article)).join("")}</div>
              </section>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderPlans() {
  const items = getPlanArticles();
  ui.app.innerHTML = `
    <section class="directory-page plan-page">
      ${sectionIntro("STAGE ROUTE", "阶段路线", "阶段路线、复盘节奏和下一步行动沉淀。", items.length)}
      <div class="roadmap-line">
        ${items
          .map(
            (article, index) => `
              <a href="${articleHref(article.path)}" class="roadmap-item reveal" style="--delay:${index * 55}ms">
                <span>${String(index + 1).padStart(2, "0")}</span>
                <div><p>${escapeHtml(article.topic)}</p><h2>${escapeHtml(article.title)}</h2><small>${article.date ? formatDate(article.date, { year: "numeric" }) : "持续更新"}</small></div>
                ${iconArrow()}
              </a>`,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSearch() {
  const results = state.articles
    .filter(canShowInSection)
    .filter(matchesSearch);

  const sectionOrder = ["questions", "companies", "interviews", "plans", "learning", "reading", "columns", "opportunity", "projects", "tasks"];
  const grouped = {};
  results.forEach((article) => {
    const sec = getArticleSection(article);
    grouped[sec] ||= [];
    grouped[sec].push(article);
  });

  // Sort groups by predefined order, remaining sections at end
  const sortedGroups = Object.entries(grouped).sort((a, b) => {
    const ia = sectionOrder.indexOf(a[0]);
    const ib = sectionOrder.indexOf(b[0]);
    if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  ui.app.innerHTML = `
    <section class="directory-page">
      ${sectionIntro("SEARCH", "搜索结果", state.query ? `"${escapeHtml(state.query)}" 的匹配结果` : "输入关键词搜索全站内容。", results.length)}
      <div class="directory-groups">
        ${sortedGroups.length
          ? sortedGroups.map(([section, articles]) => `
            <section class="directory-group reveal">
              <header><h2>${escapeHtml(SECTION_LABELS[section] || section)}</h2><span>${articles.length} 篇</span></header>
              <div class="article-list">${articles.map((article) => articleRow(article)).join("")}</div>
            </section>`).join("")
          : '<p class="empty-copy">没有找到匹配的内容。</p>'}
      </div>
    </section>
  `;
}

function renderOpportunity() {
  const questionsCount = state.articles.filter((a) => canShowInSection(a) && getArticleSection(a) === "questions").length;
  const companiesCount = state.articles.filter((a) => canShowInSection(a) && getArticleSection(a) === "companies").length;
  const interviewsCount = state.articles.filter((a) => canShowInSection(a) && (getArticleSection(a) === "interviews" || (getArticleSection(a) === "questions" && a.score !== null))).length;
  const plansCount = state.articles.filter((a) => canShowInSection(a) && getArticleSection(a) === "plans").length;

  ui.app.innerHTML = `
    <section class="directory-page">
      <header class="page-intro reveal">
        <div>
          <p class="mono-label">OPPORTUNITY / 机会工作台</p>
          <h1>机会工作台</h1>
          <p>这里收纳能力复盘、机会记录、表达演练和阶段路线。</p>
        </div>
      </header>

      <div class="opportunity-grid reveal delay-1">
        <article>
          <p class="mono-label">REVIEW</p>
          <h3>能力复盘</h3>
          <p>具体题目、场景题、系统设计题和待复盘项。</p>
          <a href="#/questions">进入 <small>${questionsCount} 项</small> ${iconArrow()}</a>
        </article>

        <article>
          <p class="mono-label">FILES</p>
          <h3>机会记录</h3>
          <p>按来源、轮次和反馈归档外部机会样本。</p>
          <a href="#/companies">进入 <small>${companiesCount} 项</small> ${iconArrow()}</a>
        </article>

        <article>
          <p class="mono-label">DRILL</p>
          <h3>表达演练</h3>
          <p>问答表达、回答质量、评分和改进记录。</p>
          <a href="#/interviews">进入 <small>${interviewsCount} 项</small> ${iconArrow()}</a>
        </article>

        <article>
          <p class="mono-label">ROUTE</p>
          <h3>阶段路线</h3>
          <p>阶段路线、复盘节奏和下一步安排。</p>
          <a href="#/plans">进入 <small>${plansCount} 项</small> ${iconArrow()}</a>
        </article>
      </div>

      <section class="recent-section reveal delay-2" style="margin-top:66px">
        <div class="section-heading">
          <div><p class="mono-label">LATEST / 最近机会</p><h2>最新记录</h2></div>
        </div>
        <div class="article-list">
          ${state.articles
            .filter((a) => canShowInSection(a) && ["questions", "companies", "interviews", "plans"].includes(getArticleSection(a)))
            .slice(0, 10)
            .map((item, index) => articleRow(item, { index: String(index + 1).padStart(2, "0") }))
            .join("") || '<p class="empty-copy">等待第一次记录。</p>'}
        </div>
      </section>
    </section>
  `;
}

function renderColumns() {
  const readable = state.articles.filter(
    (article) =>
      ["questions", "notes"].includes(article.section) && matchesSearch(article),
  );
  const definitions = state.columns.length
    ? state.columns
    : [
        ["technology", "工程技术", "Java、JVM、Redis、数据库、分布式、系统设计。"],
        ["ai-agent", "AI Agent", "Agent、工具系统、RAG、MCP、上下文、源码研究。"],
        ["business-finance", "金融市场", "宏观、资产配置、基金、股票、行业观察。"],
        ["society-humanities", "历史社会", "历史、政治、制度、社会结构、国际关系。"],
        ["career-life", "职业成长", "能力表达、机会复盘、学习计划、长期路线。"],
        ["projects", "项目沉淀", "自研项目、网站、工具产品、工程实践。"],
      ].map(([id, name, description]) => ({ id, name, description, count: 0 }));

  ui.app.innerHTML = `
    <section class="directory-page column-page">
      ${sectionIntro("KNOWLEDGE MAP", "知识地图", "把零散题目、阅读、项目和复盘连接成长期结构，逐步形成自己的知识坐标。", readable.length)}
      <div class="column-directory">
        ${definitions
          .map((column, index) => {
            const articles = readable.filter((article) => article.column === column.id);
            return `
              <section class="column-group reveal" style="--delay:${index * 45}ms">
                <header>
                  <span>${String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h2>${escapeHtml(column.name)}</h2>
                    <p>${escapeHtml(column.description)}</p>
                  </div>
                  <strong>${articles.length} 篇</strong>
                </header>
                ${
                  articles.length
                    ? `<div class="article-list">${articles.map((article) => articleRow(article)).join("")}</div>`
                    : '<p class="column-empty">栏目已经建立，等待第一篇文章。</p>'
                }
              </section>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function createToc(container) {
  const headings = [...container.querySelectorAll("h2, h3")];
  return headings
    .slice(0, 16)
    .map((heading, index) => {
      heading.id ||= `section-${index + 1}`;
      return `<a class="${heading.tagName === "H3" ? "toc-sub" : ""}" href="#${heading.id}">${escapeHtml(heading.textContent)}</a>`;
    })
    .join("");
}

function mountComments(articlePath) {
  const container = document.getElementById("article-comments");
  if (!container) return;

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.dataset.repo = GISCUS_CONFIG.repo;
  script.dataset.repoId = GISCUS_CONFIG.repoId;
  script.dataset.category = GISCUS_CONFIG.category;
  script.dataset.categoryId = GISCUS_CONFIG.categoryId;
  script.dataset.mapping = "specific";
  script.dataset.term = `article:${articlePath}`;
  script.dataset.strict = "1";
  script.dataset.reactionsEnabled = "1";
  script.dataset.emitMetadata = "0";
  script.dataset.inputPosition = "top";
  script.dataset.theme = "noborder_light";
  script.dataset.lang = "zh-CN";
  script.dataset.loading = "lazy";
  script.crossOrigin = "anonymous";
  script.async = true;
  container.appendChild(script);
}

function rememberGiscusArticleRoute(articlePath) {
  try {
    sessionStorage.setItem(GISCUS_RETURN_HASH_KEY, articleHref(articlePath));
  } catch {
    // The comments still render; only OAuth route restoration is unavailable.
  }
}

async function renderArticle(rawPath) {
  // Resolve aliases
  const resolvedPath = state.aliases[rawPath] || rawPath;

  // Find article in index - try multiple matching strategies
  const article =
    state.articles.find((item) => item.path === resolvedPath || item.url === resolvedPath) ||
    state.articles.find((item) => item.path === rawPath || item.url === rawPath);

  // Determine the actual file path to fetch
  const fetchPath = article?.path || article?.url || resolvedPath;

  if (!fetchPath) {
    renderError("没有找到这篇文章", "路径缺失，无法打开详情。");
    return;
  }

  ui.app.innerHTML = '<div class="loading-state"><span></span><p>正在展开文章…</p></div>';

  try {
    const response = await fetch(`./${fetchPath}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    const content = raw.startsWith("---") ? raw.replace(/^---\n[\s\S]*?\n---\n?/, "") : raw;
    const rendered = DOMPurify.sanitize(marked.parse(content));

    const backSection = article ? getArticleSection(article) : "learning";
    const backLabel = SECTION_LABELS[backSection] || "学习";
    const displayTitle = article?.title || fetchPath.split("/").pop() || "文章详情";

    ui.app.innerHTML = `
      <section class="reader">
        <aside class="reader-rail">
          <a class="back-link" href="#/${backSection}">← 返回${backLabel}</a>
          <p class="mono-label">CONTENTS</p>
          <nav id="article-toc"></nav>
        </aside>
        <main class="reader-main">
          <header class="reader-header">
            <p class="mono-label">${escapeHtml([backLabel, article?.topic, article?.module, article?.area].filter(Boolean).join(" / ") || "文章")}</p>
            <h1>${escapeHtml(displayTitle)}</h1>
            <div>
              ${article?.date ? `<time>${escapeHtml(article.date)}</time>` : ""}
              ${article?.company ? `<span>${escapeHtml(article.company)}</span>` : ""}
              ${article?.round ? `<span>${escapeHtml(article.round)}</span>` : ""}
              ${article?.score !== null && article?.score !== undefined ? `<span class="score">${scoreText(article.score)}</span>` : ""}
            </div>
          </header>
          <article id="article-body" class="article-body">${rendered}</article>
          <section class="comments-section" aria-labelledby="comments-title">
            <header>
              <div>
                <p class="mono-label">DISCUSSION</p>
                <h2 id="comments-title">留言与讨论</h2>
              </div>
              <p>使用 GitHub 账号参与讨论，留言会公开保存在 GitHub Discussions。</p>
            </header>
            <div id="article-comments" class="comments-container"></div>
          </section>
        </main>
      </section>
    `;
    document.getElementById("article-toc").innerHTML = createToc(document.getElementById("article-body"));
    rememberGiscusArticleRoute(fetchPath);
    mountComments(fetchPath);
    document.title = `${displayTitle} · WY 工作台`;
    window.scrollTo({ top: 0, behavior: "instant" });
  } catch (error) {
    renderError("文章加载失败", `${error.message}。请检查文件权限或稍后重试。`, true);
  }
}

function renderError(title, detail, retry = false) {
  ui.app.innerHTML = `
    <section class="error-state">
      <span>!</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p>
      ${retry ? '<button type="button" onclick="location.reload()">重新加载</button>' : '<a href="#/overview">返回总览</a>'}
    </section>`;
}

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  if (!hash) return { view: "overview" };
  if (hash.startsWith("article/")) {
    return { view: "article", path: decodeURIComponent(hash.slice(8)) };
  }
  if (hash.endsWith(".md") || decodeURIComponent(hash).endsWith(".md")) {
    return { view: "article", path: decodeURIComponent(hash) };
  }
  return { view: hash.split("?")[0] };
}

function updateActiveNav(view) {
  ui.navLinks.forEach((link) => link.classList.toggle("active", link.dataset.view === view));
}

async function renderRoute() {
  const route = parseRoute();
  updateActiveNav(route.view);
  document.title = "WY 工作台 · Life OS";
  if (route.view === "article") return renderArticle(route.path);
  const renderers = {
    overview: renderOverview,
    tasks: () => renderDomain("tasks", "任务", "今日行动摘要与待复盘项。"),
    projects: renderProjects,
    learning: () => renderDomain("learning", "学习", "技术知识、源码笔记与可复习内容。"),
    opportunity: renderOpportunity,
    reading: renderReading,
    columns: () => renderDomain("columns", "知识地图", "把零散题目、阅读、项目和复盘连接成长期结构，逐步形成自己的知识坐标。"),

    // Old route compatibility
    questions: renderQuestions,
    companies: renderCompanies,
    interviews: renderInterviews,
    plans: renderPlans,

    // Search
    search: renderSearch,
  };
  (renderers[route.view] || renderOverview)();
  window.scrollTo({ top: 0, behavior: "instant" });

  // Hydrate daily tip on overview
  if (route.view === "overview" || !renderers[route.view]) {
    hydrateDailyTip();
  }
}

const BUILD_VERSION = "20260719-2";

async function loadSite() {
  const [response, quickLinks] = await Promise.all([
    fetch(`./site-index.json?v=${BUILD_VERSION}`),
    fetch(`./data/quick-links.json?v=${BUILD_VERSION}`)
      .then((result) => (result.ok ? result.json() : []))
      .catch(() => []),
  ]);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  state.articles = Array.isArray(payload) ? payload : payload.articles || [];
  state.dashboard = payload.dashboard || {};
  state.columns = payload.columns || [];
  state.projects = payload.projects || [];
  state.quickLinks = Array.isArray(quickLinks) ? quickLinks : [];
  state.aliases = payload.aliases || {};
  await renderRoute();
}

// ---- daily tip caching ----
const DAILY_TIP_CACHE_KEY = "wy_daily_tip_v1";

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readDailyTipCache() {
  try {
    const raw = localStorage.getItem(DAILY_TIP_CACHE_KEY);
    if (!raw) return null;

    const cache = JSON.parse(raw);
    if (!cache || cache.date !== getLocalDateKey()) return null;
    if (!cache.text) return null;

    return cache;
  } catch {
    return null;
  }
}

function writeDailyTipCache(text, source) {
  try {
    localStorage.setItem(
      DAILY_TIP_CACHE_KEY,
      JSON.stringify({
        date: getLocalDateKey(),
        text,
        source,
        savedAt: Date.now(),
      })
    );
  } catch {
    // ignore localStorage errors
  }
}

function normalizeTip(item) {
  if (typeof item === "string") {
    return {
      text: item,
      source: "本地摘句",
    };
  }

  return {
    text: item?.text || item?.content || "博观而约取，厚积而薄发。",
    source: item?.source || item?.author || "本地摘句",
  };
}

function renderDailyTip(text, source) {
  const heroTitle = document.getElementById("hero-title");
  const tipSource = document.getElementById("daily-tip-source");

  if (!heroTitle || !tipSource) return;

  const safeText = String(text || "博观而约取，厚积而薄发。")
    .trim()
    .replace(/[，。！？；：,.!?;:]$/, "");

  const shortText = safeText.length > 18 ? safeText.slice(0, 18) : safeText;
  const cut = Math.ceil(shortText.length / 2);

  heroTitle.innerHTML = `${escapeHtml(shortText.slice(0, cut))}<br />${escapeHtml(shortText.slice(cut))}`;
  tipSource.textContent = `每日摘句 / ${source || "本地摘句"}`;
}

async function loadFallbackDailyTip({ random = false } = {}) {
  const tips = await fetch("./data/tips.json")
    .then((response) => response.json())
    .catch(() => ["博观而约取，厚积而薄发。"]);

  const index = random
    ? Math.floor(Math.random() * tips.length)
    : new Date().getDate() % tips.length;

  const tip = normalizeTip(tips[index]);

  renderDailyTip(tip.text, tip.source);
  writeDailyTipCache(tip.text, tip.source);
}

function fetchPoemDailyTip() {
  return new Promise((resolve, reject) => {
    if (!window.jinrishici || !window.jinrishici.load) {
      reject(new Error("jinrishici sdk not available"));
      return;
    }

    window.jinrishici.load(
      (result) => {
        const data = result?.data;
        const origin = data?.origin;

        if (!data?.content) {
          reject(new Error("empty poem content"));
          return;
        }

        const source = origin
          ? `${origin.dynasty ? `〖${origin.dynasty}〗` : ""}${origin.author || ""}${origin.title ? `《${origin.title}》` : ""}`
          : "今日诗词";

        resolve({
          text: data.content,
          source: source || "今日诗词",
        });
      },
      (error) => reject(error || new Error("jinrishici failed"))
    );
  });
}

async function hydrateDailyTip({ force = false, randomFallback = false } = {}) {
  if (!force) {
    const cache = readDailyTipCache();

    if (cache) {
      renderDailyTip(cache.text, cache.source);
      return;
    }
  }

  try {
    const tip = await Promise.race([
      fetchPoemDailyTip(),
      new Promise((_, reject) =>
        window.setTimeout(() => reject(new Error("jinrishici timeout")), 2500)
      ),
    ]);

    renderDailyTip(tip.text, tip.source);
    writeDailyTipCache(tip.text, tip.source);
  } catch {
    await loadFallbackDailyTip({ random: randomFallback });
  }
}

ui.search.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  const route = parseRoute();
  if (route.view === "article" || route.view === "overview") {
    location.hash = "/search";
  } else {
    renderRoute();
  }
});

// "换一句" button support
document.addEventListener("click", (event) => {
  if (event.target.closest("#tip-refresh")) {
    hydrateDailyTip({ force: true, randomFallback: true });
  }
});

window.addEventListener("hashchange", () => {
  const hash = location.hash;
  // 页面内锚点跳转（如文章 TOC 的 #section-1、刷题页话题索引的 #topic-java），
  // 这类 hash 不含 "/"，不是路由，直接滚动到对应元素即可。
  if (hash.startsWith("#") && !hash.includes("/")) {
    const target = document.querySelector(hash);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  renderRoute();
});

loadSite().catch((error) => {
  console.error(error);
  renderError("站点索引加载失败", `${error.message}。构建任务可能尚未完成。`, true);
});
