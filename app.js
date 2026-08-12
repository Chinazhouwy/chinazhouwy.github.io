const SECTION_LABELS = {
  tasks: "行动摘要",
  timeline: "时光轴",
  projects: "项目",
  learning: "学习",
  opportunity: "机会",
  reading: "阅读",
  columns: "专栏",
  links: "三方链接",
  about: "关于我",
  questions: "能力复盘",
  companies: "机会记录",
  interviews: "表达演练",
  plans: "阶段路线",
};

const LEARNING_PREVIEW_COUNT = 5;

const GISCUS_CONFIG = {
  repo: "Chinazhouwy/chinazhouwy.github.io",
  repoId: "R_kgDOOzTMhA",
  category: "Announcements",
  categoryId: "DIC_kwDOOzTMhM4DBhIz",
};

const GISCUS_RETURN_HASH_KEY = "wy_giscus_return_hash";

function restoreGiscusArticleRoute() {
  const hasGiscusToken = new URLSearchParams(location.search).has("giscus");
  if (!hasGiscusToken) return;

  try {
    const returnHash = sessionStorage.getItem(GISCUS_RETURN_HASH_KEY);
    if (!returnHash?.startsWith("#/article/")) return;

    const keepArticleRoute = () => {
      if (!location.hash) {
        history.replaceState(null, "", `${location.pathname}${location.search}${returnHash}`);
      }
    };

    keepArticleRoute();

    // Giscus removes the OAuth query asynchronously and may also drop the SPA hash.
    let checks = 0;
    const routeGuard = window.setInterval(() => {
      checks += 1;
      keepArticleRoute();

      const tokenConsumed = !new URLSearchParams(location.search).has("giscus");
      if (tokenConsumed || checks >= 100) {
        window.clearInterval(routeGuard);
        if (tokenConsumed) sessionStorage.removeItem(GISCUS_RETURN_HASH_KEY);
      }
    }, 100);
  } catch {
    // Session storage may be unavailable in strict privacy modes.
  }
}

restoreGiscusArticleRoute();

const ui = {
  app: document.getElementById("app"),
  search: document.getElementById("search-input"),
  themeToggle: document.getElementById("theme-toggle"),
  themeLabel: document.querySelector(".theme-toggle-label"),
  themeColor: document.querySelector('meta[name="theme-color"]'),
  navLinks: [...document.querySelectorAll("[data-view]")],
};

const THEME_STORAGE_KEY = "wy_theme_v1";

function applyTheme(theme, { persist = false } = {}) {
  const isInk = theme === "ink";
  document.documentElement.dataset.theme = isInk ? "ink" : "editorial";

  if (ui.themeToggle) {
    const nextThemeLabel = isInk ? "切换到原色主题" : "切换到水墨主题";
    ui.themeToggle.setAttribute("aria-pressed", String(isInk));
    ui.themeToggle.setAttribute("aria-label", nextThemeLabel);
    ui.themeToggle.title = nextThemeLabel;
  }

  if (ui.themeLabel) ui.themeLabel.textContent = isInk ? "原色" : "水墨";
  if (ui.themeColor) ui.themeColor.content = isInk ? "#eee4cf" : "#f3efe7";

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isInk ? "ink" : "editorial");
    } catch {
      // Theme switching still works when storage is blocked.
    }
  }
}

applyTheme(document.documentElement.dataset.theme);

ui.themeToggle?.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "ink" ? "editorial" : "ink";
  applyTheme(nextTheme, { persist: true });
});

const state = {
  articles: [],
  dashboard: {},
  columns: [],
  projects: [],
  quickLinks: [],
  thirdPartyLinks: [],
  learningAreas: [],
  aliases: {},
  query: "",
  timelineFilter: "all",
  timelineVisibleDays: 12,
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

function uniqueTextParts(values) {
  const seen = new Set();
  return values
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function normalizedHeading(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[·:：—\-_|]/g, "")
    .toLowerCase();
}

function stripDuplicateLeadingTitle(html, title) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const first = template.content.firstElementChild;
  if (
    first?.tagName === "H1" &&
    normalizedHeading(first.textContent) === normalizedHeading(title)
  ) {
    first.remove();
  }
  return template.innerHTML;
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

const TIMELINE_FILTERS = [
  ["all", "全部"],
  ["questions", "练习"],
  ["learning", "学习"],
  ["projects", "项目"],
  ["reading", "阅读"],
  ["opportunity", "机会"],
];

function timelineCategory(article) {
  const section = normalizeSection(getArticleSection(article));
  if (["questions", "interviews", "plans"].includes(section)) return "questions";
  if (["projects", "tasks"].includes(section)) return "projects";
  if (["opportunity", "companies"].includes(section)) return "opportunity";
  if (section === "columns") return "learning";
  if (["learning", "reading"].includes(section)) return section;
  return "";
}

function timelineDate(article) {
  const category = timelineCategory(article);
  if (category === "questions") return article.practicedAt || article.date;
  return article.publishedAt || article.createdAt || article.date;
}

function timelineDateParts(value) {
  const parsed = new Date(`${value}T00:00:00`);
  return {
    short: value.slice(5).replace("-", "."),
    year: value.slice(0, 4),
    weekday: new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(parsed),
  };
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

    about: "about",
    profile: "about",
    "关于我": "about",
    "个人": "about",
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
  if (normalizedPath.includes("content/about/")) return "about";

  return "";
}

// ---- reading area normalization ----
function normalizeReadingArea(article) {
  const raw = String(article.area || article.category || article.folder || article.path || "").toLowerCase();

  if (raw.includes("politics") || raw.includes("society") || raw.includes("policy") || raw.includes("world")) return "世界观察";
  if (raw.includes("finance") || raw.includes("market") || raw.includes("industry") || raw.includes("business")) return "市场笔记";
  if (raw.includes("history")) return "历史";
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
    article.searchText,
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
        options.actionLabel
          ? `<span class="article-row-action">${escapeHtml(options.actionLabel)}</span>`
          : article.score !== null && article.score !== undefined
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
  if (
    !points.length ||
    !points.some((item) => item.count > 0 || typeof item.averageScore === "number")
  ) {
    return '<div class="chart-empty">当前视图暂无可展示的练习记录。</div>';
  }
  const width = 720;
  const height = 210;
  const padding = 28;
  const maxCount = Math.max(...points.map((item) => item.count), 1);
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const positionedScores = points.map((item, index) => {
    if (typeof item.averageScore !== "number") return null;
    const x = padding + index * step;
    const y = height - padding - (item.averageScore / 10) * (height - padding * 2);
    return { x, y };
  });
  const scoreSegments = [];
  let currentSegment = [];
  positionedScores.forEach((point) => {
    if (point) {
      currentSegment.push(point);
    } else if (currentSegment.length) {
      scoreSegments.push(currentSegment);
      currentSegment = [];
    }
  });
  if (currentSegment.length) scoreSegments.push(currentSegment);
  const scoreLines = scoreSegments
    .filter((segment) => segment.length > 1)
    .map(
      (segment) =>
        `<polyline class="chart-line" points="${segment.map((point) => `${point.x},${point.y}`).join(" ")}"></polyline>`,
    )
    .join("");
  const scoreDots = positionedScores
    .filter(Boolean)
    .map((point) => `<circle class="chart-score-dot" cx="${point.x}" cy="${point.y}" r="4"></circle>`)
    .join("");
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
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="最近十四个自然日的练习题量与平均分趋势">
      <line class="chart-axis" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
      <g class="chart-bars">${bars}</g>
      <g class="chart-scores">${scoreLines}${scoreDots}</g>
      <g class="chart-labels">${labels}</g>
    </svg>
  `;
}

function renderOverview() {
  const publicArticles = state.articles.filter(canShowOnHome).filter(matchesSearch);
  const latestWriting = publicArticles
    .filter((article) => !["about", "reading", "questions", "companies", "interviews", "plans"].includes(getArticleSection(article)))
    .slice(0, 7);
  const readingItems = state.articles
    .filter((a) => canShowOnHome(a) && normalizeSection(getArticleSection(a)) === "reading")
    .filter(matchesSearch)
    .slice(0, 3);
  const featuredArticle = latestWriting[0];
  const writingList = latestWriting.slice(1);
  const projectRoute = (project) => ({
    "opportunity-radar": "#/opportunity",
    "source-code-research": "#/learning",
    "reading-life": "#/reading",
  })[project.id] || "#/projects";
  const nowProjects = state.projects.slice(0, 3);
  const contentAreas = new Set(publicArticles.map((article) => getArticleSection(article)).filter(Boolean));

  ui.app.innerHTML = `
    <section class="home-page">
      <header class="home-hero">
        <div class="home-edition reveal">
          <span class="editorial-edition">WY / PERSONAL ARCHIVE</span>
          <span class="ink-edition">WY 手记 · 岁在丙午</span>
          <span>SHANGHAI · 2026</span>
        </div>

        <div class="home-hero-grid">
          <div class="home-intro reveal">
            <h1 class="editorial-hero-title">人间尚有春风在，<br /><em>何妨从头再少年。</em></h1>
            <h1 class="ink-hero-title" aria-label="人间尚有春风在，何妨从头再少年。"><span>人间尚有春风在</span><em>何妨从头再少年</em><i aria-hidden="true">WY</i></h1>
            <p class="home-deck">这里记录我正在建设的项目、读过的源码、形成的方法，以及对技术与生活的长期思考。不是简历，也不只是博客，而是一份持续更新的个人档案。</p>
            <div class="home-actions">
              <a class="home-button home-button-primary" href="#latest-writing">最近写作 ${iconArrow()}</a>
              <a class="home-button" href="#/about">认识我</a>
            </div>
          </div>

          <aside class="now-card reveal delay-1">
            <header><span>NOW / 此刻</span><time>${escapeHtml(formatDate(new Date().toISOString().slice(0, 10), { year: "numeric" }))}</time></header>
            <h2>正在把想法<br />变成长期作品。</h2>
            <ol>
              ${nowProjects
                .map(
                  (project, index) => `
                    <li>
                      <span>${String(index + 1).padStart(2, "0")}</span>
                      <a href="${projectRoute(project)}"><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.summary || "持续推进")}</small></a>
                    </li>`,
                )
                .join("") || '<li><span>01</span><p>正在整理下一阶段方向。</p></li>'}
            </ol>
            <a class="now-link" href="#/projects">查看全部项目 ${iconArrow()}</a>
          </aside>
        </div>

        <a class="ink-art-credit" href="https://www.metmuseum.org/art/collection/search/49157" target="_blank" rel="noopener noreferrer">卷首取意 · 王翚《仿巨然燕文贵山水图》· 1713 · The Met Open Access</a>

        <div class="home-facts reveal delay-2" aria-label="站点概览">
          <div><strong>${publicArticles.length}</strong><span>公开记录</span></div>
          <div><strong>${state.projects.length}</strong><span>长期项目</span></div>
          <div><strong>${contentAreas.size}</strong><span>内容领域</span></div>
          <p>以文件为底座，以项目为主线，持续更新。</p>
        </div>
      </header>

      <section class="home-projects reveal">
        <div class="home-section-label"><span>01</span><p><b class="editorial-section-title">SELECTED PROJECTS / 长期建设</b><b class="ink-section-title">所作 · 长期建设</b></p><a href="#/projects">全部项目 ${iconArrow()}</a></div>
        <div class="project-cards">
          ${state.projects
            .map(
              (project, index) => `
                <a class="project-card" href="${projectRoute(project)}">
                  <span class="project-card-index">${String(index + 1).padStart(2, "0")}</span>
                  <div><p>${escapeHtml(project.priority || "ONGOING")}</p><h2>${escapeHtml(project.name)}</h2><small>${escapeHtml(project.summary || "持续建设")}</small></div>
                  <footer><em>${escapeHtml(project.status || "进行中")}</em>${iconArrow()}</footer>
                </a>`,
            )
            .join("") || '<p class="empty-copy">项目清单等待补充。</p>'}
        </div>
      </section>

      <section class="home-editorial reveal" id="latest-writing">
        <div class="home-section-label"><span>02</span><p><b class="editorial-section-title">RECENT WRITING / 最近写作</b><b class="ink-section-title">新札 · 最近写作</b></p><a href="#/timeline">完整时光轴 ${iconArrow()}</a></div>
        <div class="editorial-grid">
          ${featuredArticle
            ? `<a class="featured-writing" href="${articleHref(featuredArticle.path)}">
                <p>${escapeHtml(SECTION_LABELS[getArticleSection(featuredArticle)] || getArticleSection(featuredArticle))} / ${escapeHtml(featuredArticle.date || "持续更新")}</p>
                <h2>${escapeHtml(featuredArticle.title)}</h2>
                <span>${escapeHtml(featuredArticle.summary || "打开阅读全文")}</span>
                <strong>阅读全文 ${iconArrow()}</strong>
              </a>`
            : '<div class="featured-writing"><p>WRITING</p><h2>下一篇文章正在形成。</h2></div>'}
          <div class="writing-index">
            ${writingList
              .map(
                (article, index) => `
                  <a href="${articleHref(article.path)}">
                    <span>${String(index + 2).padStart(2, "0")}</span>
                    <div><strong>${escapeHtml(article.title)}</strong><small>${escapeHtml(SECTION_LABELS[getArticleSection(article)] || getArticleSection(article))} · ${escapeHtml(article.date || "持续更新")}</small></div>
                    ${iconArrow()}
                  </a>`,
              )
              .join("") || '<p class="empty-copy">更多写作正在整理。</p>'}
          </div>
        </div>
      </section>

      <section class="home-reading reveal">
        <div class="home-section-label"><span>03</span><p><b class="editorial-section-title">READING &amp; THINKING / 阅读与思考</b><b class="ink-section-title">读卷 · 阅读与思考</b></p><a href="#/reading">进入阅读 ${iconArrow()}</a></div>
        <div class="reading-shelf">
          ${readingItems
            .map(
              (article, index) => `
                <a href="${articleHref(article.path)}">
                  <span>${String(index + 1).padStart(2, "0")}</span>
                  <h2>${escapeHtml(article.title)}</h2>
                  <p>${escapeHtml(article.summary || "阅读沉淀")}</p>
                  <footer><small>${escapeHtml(article.date || "持续更新")}</small>${iconArrow()}</footer>
                </a>`,
            )
            .join("") || '<p class="empty-copy">阅读栏目已建立，等待第一篇沉淀。</p>'}
        </div>
      </section>

      <footer class="home-closing reveal">
        <div class="daily-note">
          <p class="mono-label" id="daily-tip-source">DAILY NOTE / 正在加载</p>
          <blockquote id="hero-title">博观而约取，<br />厚积而薄发。</blockquote>
          <button id="tip-refresh" type="button">换一句</button>
        </div>
        <div class="home-closing-copy">
          <p>ARCHIVE, NOT FEED</p>
          <h2>记录不是为了堆积，<br />而是为了看见自己的方向。</h2>
          <a href="#/timeline">沿时间继续阅读 ${iconArrow()}</a>
        </div>
      </footer>
    </section>
  `;
}

function renderTimeline() {
  const datedArticles = state.articles
    .filter(canShowInSection)
    .filter(matchesSearch)
    .filter((article) => timelineCategory(article))
    .map((article) => ({ ...article, timelineDate: timelineDate(article) }))
    .filter((article) => /^\d{4}-\d{2}-\d{2}$/.test(article.timelineDate || ""));
  const filtered =
    state.timelineFilter === "all"
      ? datedArticles
      : datedArticles.filter((article) => timelineCategory(article) === state.timelineFilter);
  const days = Object.entries(groupBy(filtered, "timelineDate"))
    .sort(([left], [right]) => right.localeCompare(left));
  const filterCounts = Object.fromEntries(
    TIMELINE_FILTERS.map(([id]) => [
      id,
      id === "all"
        ? datedArticles.length
        : datedArticles.filter((article) => timelineCategory(article) === id).length,
    ]),
  );
  const latestDate = days[0]?.[0] || "";
  const visibleDays = days.slice(0, state.timelineVisibleDays);

  ui.app.innerHTML = `
    <section class="directory-page timeline-page">
      ${sectionIntro("CONTENT ARCHIVE", "内容时光轴", "按练习或内容记录日期归档；批量迁移日期不代表当天实际完成量。", filtered.length)}

      <div class="timeline-toolbar reveal delay-1">
        <div class="timeline-filters" role="group" aria-label="筛选每日进度">
          ${TIMELINE_FILTERS.map(
            ([id, label]) => `
              <button
                type="button"
                data-timeline-filter="${id}"
                class="${state.timelineFilter === id ? "active" : ""}"
                aria-pressed="${state.timelineFilter === id}"
              >
                <span>${label}</span><strong>${filterCounts[id]}</strong>
              </button>`,
          ).join("")}
        </div>
        <dl class="timeline-stats">
          <div><dt>归档日期</dt><dd>${days.length}</dd></div>
          <div><dt>归档内容</dt><dd>${filtered.length}</dd></div>
          <div><dt>最近更新</dt><dd>${latestDate ? latestDate.slice(5).replace("-", ".") : "—"}</dd></div>
        </dl>
      </div>

      <div class="timeline-list">
        ${
          visibleDays.length
            ? visibleDays
                .map(([date, articles], dayIndex) => {
                  const dateParts = timelineDateParts(date);
                  const categoryCounts = TIMELINE_FILTERS.slice(1)
                    .map(([id, label]) => ({
                      id,
                      label,
                      count: articles.filter((article) => timelineCategory(article) === id).length,
                    }))
                    .filter((item) => item.count);
                  const visible = articles.slice(0, 6);
                  const remaining = articles.slice(6);

                  return `
                    <section class="timeline-day reveal" style="--delay:${Math.min(dayIndex, 6) * 45}ms">
                      <header class="timeline-date">
                        <time datetime="${date}">
                          <strong>${dateParts.short}</strong>
                          <span>${dateParts.weekday}</span>
                          <small>${dateParts.year}</small>
                        </time>
                      </header>
                      <div class="timeline-day-content">
                        <header>
                          <div class="timeline-day-summary">
                            ${categoryCounts
                              .map(
                                (item) =>
                                  `<span data-category="${item.id}">${item.label} ${item.count}</span>`,
                              )
                              .join("")}
                          </div>
                          <strong>${articles.length} 项</strong>
                        </header>
                        <div class="article-list">
                          ${visible
                            .map((article, index) =>
                              articleRow(article, { index: String(index + 1).padStart(2, "0") }),
                            )
                            .join("")}
                        </div>
                        ${
                          remaining.length
                            ? `<details class="timeline-more">
                                <summary data-timeline-date="${date}">展开其余 ${remaining.length} 项</summary>
                                <div class="article-list" data-timeline-more-list></div>
                              </details>`
                            : ""
                        }
                      </div>
                    </section>`;
                })
                .join("")
            : '<p class="empty-copy timeline-empty">当前筛选下还没有每日记录。</p>'
        }
      </div>
      ${
        visibleDays.length < days.length
          ? `<button class="timeline-load-more" type="button" data-timeline-load-more>
              加载更早的 ${Math.min(12, days.length - visibleDays.length)} 个日期
            </button>`
          : ""
      }
    </section>
  `;

  document.querySelectorAll("[data-timeline-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.timelineFilter = button.dataset.timelineFilter;
      state.timelineVisibleDays = 12;
      renderTimeline();
    });
  });

  document.querySelectorAll(".timeline-more").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open || details.dataset.loaded === "true") return;
      const date = details.querySelector("[data-timeline-date]")?.dataset.timelineDate;
      const articles = days.find(([day]) => day === date)?.[1] || [];
      const remaining = articles.slice(6);
      details.querySelector("[data-timeline-more-list]").innerHTML = remaining
        .map((article, index) =>
          articleRow(article, { index: String(index + 7).padStart(2, "0") }),
        )
        .join("");
      details.dataset.loaded = "true";
    });
  });

  document.querySelector("[data-timeline-load-more]")?.addEventListener("click", () => {
    state.timelineVisibleDays += 12;
    renderTimeline();
  });
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

function setLearningGroupExpanded(group, expanded) {
  const toggle = group.querySelector("[data-learning-toggle]");
  if (!toggle) return;

  const total = Number(toggle.dataset.total || 0);
  const label = toggle.querySelector("[data-learning-toggle-label]");
  group.classList.toggle("is-collapsed", !expanded);
  toggle.setAttribute("aria-expanded", String(expanded));
  label.textContent = expanded
    ? `收起至最近 ${LEARNING_PREVIEW_COUNT} 篇`
    : `展开全部 ${total} 篇`;
}

function renderLearning() {
  const items = filteredArticles("learning");
  const areaOrder = new Map(state.learningAreas.map((area, index) => [area.name, index]));
  const groups = Object.entries(groupBy(items, "area", "综合")).sort(
    ([left], [right]) =>
      (areaOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (areaOrder.get(right) ?? Number.MAX_SAFE_INTEGER) ||
      left.localeCompare(right, "zh-CN"),
  );
  const compactGroupCount = groups.filter(([, articles]) => articles.length > LEARNING_PREVIEW_COUNT).length;

  ui.app.innerHTML = `
    <section class="directory-page learning-page">
      ${sectionIntro("LEARNING", "学习", "技术知识、源码笔记与可复习内容。", items.length)}
      ${
        compactGroupCount
          ? `<div class="learning-directory-tools reveal delay-1">
              <p><strong>${compactGroupCount}</strong> 个长主题默认展示最近 ${LEARNING_PREVIEW_COUNT} 篇</p>
              <div class="learning-directory-actions" role="group" aria-label="学习主题显示方式">
                <button type="button" data-learning-action="expand">全部展开</button>
                <button type="button" data-learning-action="collapse">全部收起</button>
              </div>
            </div>`
          : ""
      }
      <div class="directory-groups">
        ${
          groups.length
            ? groups
                .map(([area, articles], index) => {
                  const collapsible = articles.length > LEARNING_PREVIEW_COUNT;
                  const listId = `learning-topic-${index}`;
                  return `
                    <section class="directory-group learning-group reveal${collapsible ? " is-collapsed" : ""}" data-learning-group>
                      <header class="learning-group-header">
                        <div class="learning-group-title">
                          <h2>${escapeHtml(area)}</h2>
                          <span>${articles.length} 篇</span>
                        </div>
                        ${
                          collapsible
                            ? `<button
                                class="learning-group-toggle"
                                type="button"
                                data-learning-toggle
                                data-total="${articles.length}"
                                aria-expanded="false"
                                aria-controls="${listId}"
                              >
                                <span data-learning-toggle-label>展开全部 ${articles.length} 篇</span>
                                <i class="learning-group-toggle-icon" aria-hidden="true"></i>
                              </button>`
                            : ""
                        }
                      </header>
                      <div class="article-list" id="${listId}">${articles.map((article) => articleRow(article)).join("")}</div>
                    </section>`;
                })
                .join("")
            : '<p class="empty-copy">栏目已建立，等待内容沉淀。</p>'
        }
      </div>
    </section>`;

  ui.app.querySelectorAll("[data-learning-toggle]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const group = toggle.closest("[data-learning-group]");
      setLearningGroupExpanded(group, toggle.getAttribute("aria-expanded") !== "true");
    });
  });

  ui.app.querySelectorAll("[data-learning-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const expanded = button.dataset.learningAction === "expand";
      ui.app
        .querySelectorAll("[data-learning-group]")
        .forEach((group) => setLearningGroupExpanded(group, expanded));
    });
  });
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
      <div class="directory-groups">
        ${
          groups.length
            ? groups
                .map(
                  ([area, articles]) => `
                    <section class="directory-group reveal">
                      <header><h2>${escapeHtml(area)}</h2><span>${articles.length} 篇</span></header>
                      <div class="article-list">${articles.map((article) => articleRow(article, { actionLabel: "阅读全文 / 留言" })).join("")}</div>
                    </section>`,
                )
                .join("")
            : '<p class="empty-copy">栏目已建立，等待内容沉淀。</p>'
        }
      </div>
    </section>`;
}

function renderThirdPartyLinks() {
  const links = state.thirdPartyLinks;
  const totalLinks = links.length + state.quickLinks.length;

  ui.app.innerHTML = `
    <section class="directory-page third-party-page">
      ${sectionIntro("THIRD-PARTY LINKS", "三方链接", "值得长期收藏的外部项目、在线书籍、原典数据库与开放知识资源。链接会跳转到第三方网站。", totalLinks)}
      <div class="third-party-grid">
        ${
          links.length
            ? links
                .map(
                  (link, index) => `
                    <a class="third-party-card reveal" style="--delay:${index * 60}ms" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
                      <div>
                        <span>${escapeHtml(link.category || "外部资源")}</span>
                        <em>${String(index + 1).padStart(2, "0")}</em>
                      </div>
                      <h2>${escapeHtml(link.title)}</h2>
                      <p>${escapeHtml(link.description)}</p>
                      <footer>
                        <small>${(link.tags || []).map(escapeHtml).join(" / ")}</small>
                        <strong>打开网站 ↗</strong>
                      </footer>
                    </a>`,
                )
                .join("")
            : '<p class="empty-copy">等待添加第一个三方链接。</p>'
        }
      </div>
      ${renderQuickLinks()}
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

      <section class="practice-pulse reveal delay-2">
        <div class="section-heading">
          <div><p class="mono-label">PRACTICE PULSE / 近 14 天</p><h2>表达训练脉冲</h2></div>
          <div class="chart-legend"><span class="legend-bar">题量</span><span class="legend-line">平均分</span></div>
        </div>
        <div class="practice-pulse-grid">
          <div class="practice-pulse-chart">${lineChart(state.dashboard.daily || [])}</div>
          <dl>
            <div><dt>累计练习</dt><dd>${state.dashboard.totalQuestions || 0}<small>项</small></dd></div>
            <div><dt>已评分</dt><dd>${state.dashboard.scoredQuestions || 0}<small>项</small></dd></div>
            <div><dt>平均分</dt><dd>${state.dashboard.averageScore ?? "—"}<small>/ 10</small></dd></div>
            <div><dt>连续练习</dt><dd>${state.dashboard.streakDays || 0}<small>天</small></dd></div>
          </dl>
        </div>
      </section>

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
  const items = filteredArticles("columns");
  const groups = Object.entries(groupBy(items, "area", "未分类"));

  ui.app.innerHTML = `
    <section class="directory-page column-page">
      ${sectionIntro("COLUMNS", "专栏", "围绕长期主题持续整理的系列文章。", items.length)}
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
            : '<p class="empty-copy">专栏已建立，等待第一篇系列文章。</p>'
        }
      </div>
    </section>
  `;
}

function createToc(container, routeHash) {
  const headings = [...container.querySelectorAll("h2, h3")];
  const html = headings
    .map((heading, index) => {
      heading.id ||= `section-${index + 1}`;
      const href = `${routeHash}?section=${encodeURIComponent(heading.id)}`;
      return `<a class="${heading.tagName === "H3" ? "toc-sub" : ""}" href="${escapeHtml(href)}" data-toc-target="${escapeHtml(heading.id)}">${escapeHtml(heading.textContent)}</a>`;
    })
    .join("");
  return { html, count: headings.length };
}

function bindTocLinks(container, routeHash) {
  container.querySelectorAll("[data-toc-target]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.dataset.tocTarget;
      const target = document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      history.replaceState(null, "", `${routeHash}?section=${encodeURIComponent(targetId)}`);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      link.closest("details")?.removeAttribute("open");
    });
  });
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

async function renderAbout() {
  const profilePath = "content/about/about-me.md";
  ui.app.innerHTML = '<div class="loading-state"><span></span><p>正在整理个人介绍…</p></div>';

  try {
    const response = await fetch(`./${profilePath}?v=${BUILD_VERSION}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    const content = raw.startsWith("---") ? raw.replace(/^---\n[\s\S]*?\n---\n?/, "") : raw;
    const rendered = DOMPurify.sanitize(marked.parse(content));

    ui.app.innerHTML = `
      <section class="about-page">
        <header class="about-hero reveal">
          <div class="about-lead">
            <p class="mono-label">ABOUT / WY</p>
            <h1>Java 工程、AI Agent，<br />与持续写作。</h1>
            <p>资深 Java 后端工程师、5 人后端组长。长期深耕保险金融系统，持续实践 Java AI Agent。</p>
            <div class="about-actions">
              <a href="https://github.com/Chinazhouwy" target="_blank" rel="noreferrer">GitHub ${iconArrow()}</a>
              <a href="https://github.com/Chinazhouwy/mini-harness" target="_blank" rel="noreferrer">MiniHarness ${iconArrow()}</a>
            </div>
          </div>
          <aside class="about-signal" aria-label="职业概况">
            <p class="mono-label">PROFILE / 2026</p>
            <div><strong>11</strong><span>年 Java 后端</span></div>
            <div><strong>10</strong><span>年保险金融</span></div>
            <div><strong>5</strong><span>人后端团队</span></div>
          </aside>
        </header>
        <article class="article-body about-body">${rendered}</article>
      </section>
    `;
    document.title = "关于 WY · 写作与项目";
  } catch (error) {
    renderError("个人介绍加载失败", `${error.message}。请检查文件权限或稍后重试。`, true);
  }
}

async function renderArticle(rawPath, requestedSection = "") {
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
    const response = await fetch(`./${fetchPath}?v=${BUILD_VERSION}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    const content = raw.startsWith("---") ? raw.replace(/^---\n[\s\S]*?\n---\n?/, "") : raw;
    const sanitized = DOMPurify.sanitize(marked.parse(content));

    const backSection = article ? getArticleSection(article) : "learning";
    const backLabel = SECTION_LABELS[backSection] || "学习";
    const displayTitle = article?.title || fetchPath.split("/").pop() || "文章详情";
    const rendered = stripDuplicateLeadingTitle(sanitized, displayTitle);
    const headerTrail = uniqueTextParts([
      backLabel,
      article?.topic,
      article?.module,
      article?.area,
    ]);
    const articleRoute = articleHref(fetchPath);

    ui.app.innerHTML = `
      <section class="reader">
        <aside class="reader-rail">
          <a class="back-link" href="#/${backSection}">← 返回${backLabel}</a>
          <p class="mono-label">CONTENTS</p>
          <nav id="article-toc"></nav>
        </aside>
        <main class="reader-main">
          <header class="reader-header">
            <p class="mono-label">${escapeHtml(headerTrail.join(" / ") || "文章")}</p>
            <h1>${escapeHtml(displayTitle)}</h1>
            <div>
              ${article?.date ? `<time>${escapeHtml(article.date)}</time>` : ""}
              ${article?.company ? `<span>${escapeHtml(article.company)}</span>` : ""}
              ${article?.round ? `<span>${escapeHtml(article.round)}</span>` : ""}
              ${article?.score !== null && article?.score !== undefined ? `<span class="score">${scoreText(article.score)}</span>` : ""}
            </div>
            <button id="comment-jump" class="comment-jump" type="button">
              <span>留言</span>
              跳到文章评论区 ↓
            </button>
          </header>
          <details class="mobile-toc">
            <summary><span>文章目录</span><strong id="mobile-toc-count"></strong></summary>
            <nav id="mobile-article-toc"></nav>
          </details>
          <article id="article-body" class="article-body">${rendered}</article>
          <section id="comments-section" class="comments-section" aria-labelledby="comments-title">
            <header>
              <div>
                <p class="mono-label">DISCUSSION</p>
                <h2 id="comments-title">留言与讨论</h2>
              </div>
              <p>点击“使用 GitHub 登录”完成授权，输入内容后点击“评论”。留言会公开保存在 GitHub Discussions。</p>
            </header>
            <ol class="comment-steps" aria-label="留言步骤">
              <li><span>1</span>使用 GitHub 登录</li>
              <li><span>2</span>输入留言内容</li>
              <li><span>3</span>点击“评论”发布</li>
            </ol>
            <div id="article-comments" class="comments-container"></div>
          </section>
        </main>
      </section>
    `;
    const toc = createToc(document.getElementById("article-body"), articleRoute);
    const desktopToc = document.getElementById("article-toc");
    const mobileToc = document.getElementById("mobile-article-toc");
    desktopToc.innerHTML = toc.html;
    mobileToc.innerHTML = toc.html;
    document.getElementById("mobile-toc-count").textContent = `${toc.count} 项`;
    if (!toc.count) {
      document.querySelector(".reader")?.classList.add("has-no-toc");
      document.querySelector(".mobile-toc").hidden = true;
    }
    bindTocLinks(desktopToc, articleRoute);
    bindTocLinks(mobileToc, articleRoute);
    document.getElementById("comment-jump").addEventListener("click", () => {
      document.getElementById("comments-section").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    rememberGiscusArticleRoute(fetchPath);
    mountComments(fetchPath);
    document.title = `${displayTitle} · WY`;
    window.scrollTo({ top: 0, behavior: "instant" });
    if (requestedSection) {
      window.requestAnimationFrame(() => {
        document.getElementById(requestedSection)?.scrollIntoView({ block: "start" });
      });
    }
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
  const queryIndex = hash.indexOf("?");
  const routePath = queryIndex >= 0 ? hash.slice(0, queryIndex) : hash;
  const params = new URLSearchParams(queryIndex >= 0 ? hash.slice(queryIndex + 1) : "");
  if (routePath.startsWith("article/")) {
    return { view: "article", path: decodeURIComponent(routePath.slice(8)), params };
  }
  if (routePath.endsWith(".md") || decodeURIComponent(routePath).endsWith(".md")) {
    return { view: "article", path: decodeURIComponent(routePath), params };
  }
  return { view: routePath, params };
}

function updateActiveNav(view) {
  ui.navLinks.forEach((link) => link.classList.toggle("active", link.dataset.view === view));
}

async function renderRoute() {
  const route = parseRoute();
  updateActiveNav(route.view);
  document.title = "WY · 写作与项目";
  if (route.view === "article") {
    return renderArticle(route.path, route.params.get("section") || "");
  }
  if (route.view === "search") {
    state.query = (route.params.get("q") || "").trim().toLowerCase();
    ui.search.value = route.params.get("q") || "";
  } else {
    state.query = "";
    ui.search.value = "";
  }
  const renderers = {
    overview: renderOverview,
    timeline: renderTimeline,
    tasks: () => renderDomain("tasks", "任务", "今日行动摘要与待复盘项。"),
    projects: renderProjects,
    learning: renderLearning,
    opportunity: renderOpportunity,
    reading: renderReading,
    columns: renderColumns,
    links: renderThirdPartyLinks,
    about: renderAbout,

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

const BUILD_VERSION = "20260812-3";

async function loadSite() {
  const [response, quickLinks, thirdPartyLinks, learningTaxonomy] = await Promise.all([
    fetch(`./site-index.json?v=${BUILD_VERSION}`),
    fetch(`./data/quick-links.json?v=${BUILD_VERSION}`)
      .then((result) => (result.ok ? result.json() : []))
      .catch(() => []),
    fetch(`./data/third-party-links.json?v=${BUILD_VERSION}`)
      .then((result) => (result.ok ? result.json() : []))
      .catch(() => []),
    fetch(`./data/learning-taxonomy.json?v=${BUILD_VERSION}`)
      .then((result) => (result.ok ? result.json() : {}))
      .catch(() => ({})),
  ]);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  state.articles = Array.isArray(payload) ? payload : payload.articles || [];
  state.dashboard = payload.dashboard || {};
  state.columns = payload.columns || [];
  state.projects = payload.projects || [];
  state.quickLinks = Array.isArray(quickLinks) ? quickLinks : [];
  state.thirdPartyLinks = Array.isArray(thirdPartyLinks) ? thirdPartyLinks : [];
  state.learningAreas = Array.isArray(learningTaxonomy.areas) ? learningTaxonomy.areas : [];
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
  const rawQuery = event.target.value.trim();
  state.query = rawQuery.toLowerCase();
  const route = parseRoute();
  const nextHash = `#/search${rawQuery ? `?q=${encodeURIComponent(rawQuery)}` : ""}`;
  if (route.view !== "search") {
    location.hash = nextHash;
  } else {
    history.replaceState(null, "", nextHash);
    renderSearch();
  }
});

// "换一句" button support
document.addEventListener("click", (event) => {
  if (event.target.closest("#tip-refresh")) {
    hydrateDailyTip({ force: true, randomFallback: true });
  }

  if (event.target.closest(".nav-more a, .mobile-menu a")) {
    document.querySelectorAll(".nav-more[open], .mobile-menu[open]").forEach((menu) => {
      menu.removeAttribute("open");
    });
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
