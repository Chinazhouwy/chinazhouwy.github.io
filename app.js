const SECTION_LABELS = {
  tasks: "行动摘要",
  timeline: "时光轴",
  projects: "项目",
  learning: "知识库",
  opportunity: "机会",
  reading: "阅读",
  columns: "系列与专题",
  links: "资源导航",
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

const THEME_STORAGE_KEY = "wy_theme_v2";

function themeName(theme) {
  return theme === "nova" ? "深色" : "浅色";
}

function giscusTheme(theme) {
  const base = "https://zhouwy.top/assets/giscus/";
  return theme === "nova" ? base + "wy-dark.css" : base + "wy-light.css";
}

function applyTheme(theme, { persist = false } = {}) {
  const isDark = theme === "nova";
  const currentTheme = isDark ? "nova" : "light";
  const nextTheme = isDark ? "light" : "nova";
  document.documentElement.dataset.theme = currentTheme;

  const toggle = document.getElementById("theme-toggle");
  const themeColor = document.querySelector('meta[name="theme-color"]');

  if (toggle) {
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute("aria-label", `当前为${themeName(currentTheme)}主题，点击切换到${themeName(nextTheme)}主题`);
    toggle.title = `当前：${themeName(currentTheme)}主题；点击切换到${themeName(nextTheme)}主题`;
  }
  if (themeColor) themeColor.content = isDark ? "#152629" : "#f6f8fa";

  document.querySelector("iframe.giscus-frame")?.contentWindow?.postMessage(
    { giscus: { setConfig: { theme: giscusTheme(currentTheme) } } },
    "https://giscus.app",
  );

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? "nova" : "light");
    } catch {
      // Theme switching still works when storage is blocked.
    }
  }
}

applyTheme(document.documentElement.dataset.theme === "nova" ? "nova" : "light");

const ui = {
  app: document.getElementById("app"),
  search: document.getElementById("search-input"),
  themeToggle: document.getElementById("theme-toggle"),
  navLinks: [...document.querySelectorAll("[data-view]")],
};

ui.themeToggle?.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "nova" ? "light" : "nova";
  applyTheme(nextTheme, { persist: true });
});

const state = {
  articles: [],
  dashboard: {},
  columns: [],
  projects: [],
  githubProfile: null,
  quickLinks: [],
  thirdPartyLinks: [],
  learningAreas: [],
  aliases: {},
  searchIndex: new Map(),
  searchIndexLoaded: false,
  searchIndexPromise: null,
  query: "",
  timelineFilter: "all",
  learningGroupBy: "area",
  pointsIndex: [],
  learningPointSel: null,
  pointPageSel: null,
  timelineVisibleDays: 12,
};
let readHistory;

function decorateReadLinks() {
  if (!readHistory) return;
  ui.app.querySelectorAll('a[href^="#/article/"]').forEach((link) => {
    if (link.dataset.readingBadge === "off") return;
    const path = link.getAttribute("href").slice(10).split("?")[0];
    let decoded;
    try { decoded = decodeURIComponent(path); } catch { return; }
    if (!readHistory.has(decoded) || link.querySelector(".read-badge")) return;
    const badge = document.createElement("span");
    badge.className = "read-badge";
    badge.textContent = "已访问";
    badge.title = "这台设备曾打开，不代表已经读完或掌握";
    const label = link.querySelector(".article-row-main small, .exam-note-caption span, .roadmap-item small, .nova-signal-card > p, .contribution-readout-item > span") || link.querySelector("time, small, p, h3") || link;
    label.prepend(badge);
  });
}

const SYNTAX_HIGHLIGHTER_URL = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.12.0/highlight.min.js";
const CODE_LANGUAGE_ALIASES = Object.freeze({
  conf: "ini",
  dotenv: "ini",
  env: "ini",
  html: "xml",
  mermaid: "plaintext",
  plain: "plaintext",
  properties: "ini",
  redis: "plaintext",
  sh: "bash",
  shell: "bash",
  text: "plaintext",
  ts: "typescript",
  txt: "plaintext",
  vue: "xml",
});

let markdownLibrariesPromise = null;
let syntaxHighlighterPromise = null;

function loadExternalScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.library = globalName;
    script.addEventListener(
      "load",
      () => {
        if (window[globalName]) {
          resolve(window[globalName]);
        } else {
          reject(new Error(`${globalName} 加载完成但未暴露全局对象`));
        }
      },
      { once: true },
    );
    script.addEventListener("error", () => reject(new Error(`${globalName} 加载失败`)), { once: true });
    document.head.appendChild(script);
  });
}

function ensureMarkdownLibraries() {
  if (window.marked && window.DOMPurify) {
    window.marked.setOptions({ breaks: true, gfm: true });
    return Promise.resolve();
  }

  if (!markdownLibrariesPromise) {
    markdownLibrariesPromise = Promise.all([
      loadExternalScript("https://cdn.jsdelivr.net/npm/marked/marked.min.js", "marked"),
      loadExternalScript("https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js", "DOMPurify"),
    ])
      .then(() => {
        if (!window.marked || !window.DOMPurify) throw new Error("Markdown 渲染依赖未就绪");
        window.marked.setOptions({ breaks: true, gfm: true });
      })
      .catch((error) => {
        markdownLibrariesPromise = null;
        throw error;
      });
  }

  return markdownLibrariesPromise;
}

function ensureSyntaxHighlighter() {
  if (window.hljs) return Promise.resolve(window.hljs);

  if (!syntaxHighlighterPromise) {
    syntaxHighlighterPromise = loadExternalScript(SYNTAX_HIGHLIGHTER_URL, "hljs")
      .then(() => window.hljs || null)
      .catch(() => {
        syntaxHighlighterPromise = null;
        return null;
      });
  }

  return syntaxHighlighterPromise;
}

function codeLanguage(code, highlighter) {
  const languageClass = Array.from(code.classList).find((name) => name.startsWith("language-"));
  const requested = languageClass ? languageClass.slice("language-".length).toLowerCase() : "plaintext";
  const normalized = CODE_LANGUAGE_ALIASES[requested] || requested;
  return highlighter.getLanguage(normalized) ? normalized : "plaintext";
}

function highlightCodeBlocks(root) {
  const blocks = Array.from(root?.querySelectorAll("pre code") || []);
  if (!blocks.length) return Promise.resolve();

  return ensureSyntaxHighlighter().then((highlighter) => {
    if (!highlighter || !root.isConnected) return;

    blocks.forEach((code) => {
      if (code.dataset.highlighted === "yes") return;

      const languageClass = Array.from(code.classList).find((name) => name.startsWith("language-"));
      const requested = languageClass ? languageClass.slice("language-".length).toLowerCase() : "plaintext";
      const language = codeLanguage(code, highlighter);
      if (languageClass && requested !== language) code.classList.remove(languageClass);
      code.classList.add(`language-${language}`);

      try {
        highlighter.highlightElement(code);
      } catch {
        code.classList.add("hljs");
      }
    });
  });
}

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
  if (article.path?.includes("english-reads")) return "reading";
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
  return ContentTaxonomy.normalizeReadingCategory(article);
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
async function ensureSearchIndex() {
  if (state.searchIndexLoaded) return;
  if (!state.searchIndexPromise) {
    state.searchIndexPromise = fetch(`./search-index.json?v=${BUILD_VERSION}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        const entries = Array.isArray(payload) ? payload : payload.entries || [];
        state.searchIndex = new Map(
          entries
            .filter((entry) => entry && (entry.path || entry.url))
            .map((entry) => [entry.path || entry.url, String(entry.searchText || "")]),
        );
        state.searchIndexLoaded = true;
      })
      .catch((error) => {
        state.searchIndexPromise = null;
        throw error;
      });
  }
  return state.searchIndexPromise;
}

function matchesSearch(article) {
  if (!state.query) return true;

  const indexedText = state.searchIndex.get(article.path) || state.searchIndex.get(article.url) || "";

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
    indexedText,
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
  const rowIndex = options.index || article.questionNumber || "";
  const rowClasses = [
    "article-row",
    rowIndex ? "" : "article-row--no-index",
    refPath ? "" : "article-row--static",
  ].filter(Boolean).join(" ");
  const rowIndexMarkup = rowIndex
    ? `<span class="article-row-index">${escapeHtml(rowIndex)}</span>`
    : "";
  const rowMeta = [article.company, article.round, article.readingTopic || article.topic || article.module || article.area, article.contentKind, article.date]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ") || "未分类";
  const inlineActionMarkup = options.actionLabel
    ? `<span class="article-row-action">${escapeHtml(options.actionLabel)}</span>`
    : "";
  if (!refPath) {
    return `
      <div class="${rowClasses}">
        ${rowIndexMarkup}
        <span class="article-row-main">
          <strong>${escapeHtml(article.title)}</strong>
          <small>路径缺失</small>
        </span>
      </div>
    `;
  }
  return `
    <a class="${rowClasses}" href="${articleHref(refPath)}">
      ${rowIndexMarkup}
      <span class="article-row-main">
        <strong>${escapeHtml(article.title)}</strong>
        <small>
          ${rowMeta}${inlineActionMarkup}
        </small>
      </span>
      ${
        options.actionLabel
          ? ""
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

const { KNOWLEDGE_LANES, KNOWLEDGE_LANE_MAP, READING_CATEGORIES } = ContentTaxonomy;

function knowledgeRecordDate(article) {
  return article.publishedAt || article.createdAt || article.practicedAt || article.date || "";
}

function inferKnowledgeLane(article) {
  const section = normalizeSection(getArticleSection(article));
  return ContentTaxonomy.inferKnowledgeLane(article, section);
}

function knowledgeLane(article) {
  if (article.lane && KNOWLEDGE_LANE_MAP[article.lane]) {
    return KNOWLEDGE_LANE_MAP[article.lane];
  }
  return inferKnowledgeLane(article);
}

let knowledgeContributionDays = new Map();

function contributionDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function parseContributionDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || contributionDateKey(date) !== value ? null : date;
}

function addContributionDays(date, amount) {
  return new Date(date.getTime() + amount * 86400000);
}

function contributionLevel(count, distinctCounts) {
  if (!count) return 0;
  if (distinctCounts.length === 1) return 2;
  const rank = distinctCounts.indexOf(count) + 1;
  return Math.max(1, Math.ceil((rank / distinctCounts.length) * 4));
}

function contributionLaneMarkup(records) {
  const laneOrder = new Map(KNOWLEDGE_LANES.map((lane, index) => [lane.id, index]));
  const lanes = [...new Map(records.map(({ lane }) => [lane.id, lane])).values()]
    .sort((left, right) => laneOrder.get(left.id) - laneOrder.get(right.id));

  return lanes
    .map((lane) => `<span data-lane="${lane.id}">${escapeHtml(lane.label)}</span>`)
    .join("");
}

function contributionArticleMarkup(records) {
  return records
    .map(
      ({ article, lane }) => `
        <a class="contribution-readout-item" href="${articleHref(article.path)}">
          <span>${escapeHtml(lane.label)}</span>
          <strong>${escapeHtml(article.title)}</strong>
          ${iconArrow()}
        </a>`,
    )
    .join("");
}

function renderContributionMap(articles) {
  const datedArticles = articles
    .map((article) => ({ article, date: knowledgeRecordDate(article), lane: knowledgeLane(article) }))
    .filter(({ date }) => parseContributionDate(date))
    .sort((left, right) => left.date.localeCompare(right.date) || left.article.title.localeCompare(right.article.title, "zh-CN"));

  if (!datedArticles.length) {
    knowledgeContributionDays = new Map();
    return '<p class="nova-empty">还没有足够的日期数据来绘制贡献图。</p>';
  }

  knowledgeContributionDays = new Map();
  datedArticles.forEach((record) => {
    if (!knowledgeContributionDays.has(record.date)) knowledgeContributionDays.set(record.date, []);
    knowledgeContributionDays.get(record.date).push(record);
  });

  const firstArticleDate = parseContributionDate(datedArticles[0].date);
  const lastArticleDate = parseContributionDate(datedArticles.at(-1).date);
  const firstWeekday = (firstArticleDate.getUTCDay() + 6) % 7;
  const lastWeekday = (lastArticleDate.getUTCDay() + 6) % 7;
  const rangeStart = addContributionDays(firstArticleDate, -firstWeekday);
  const rangeEnd = addContributionDays(lastArticleDate, 6 - lastWeekday);
  const dayCount = Math.round((rangeEnd - rangeStart) / 86400000) + 1;
  const days = Array.from({ length: dayCount }, (_, index) => addContributionDays(rangeStart, index));
  const weekCount = dayCount / 7;
  const distinctCounts = [...new Set([...knowledgeContributionDays.values()].map((records) => records.length))]
    .sort((left, right) => left - right);
  const latestDate = datedArticles.at(-1).date;
  const initialRecords = knowledgeContributionDays.get(latestDate);

  const monthLabels = [{ week: 1, label: `${firstArticleDate.getUTCMonth() + 1}月` }];
  days.forEach((date, index) => {
    if (date <= firstArticleDate || date > lastArticleDate || date.getUTCDate() !== 1) return;
    monthLabels.push({ week: Math.floor(index / 7) + 1, label: `${date.getUTCMonth() + 1}月` });
  });

  const cells = days
    .map((date) => {
      const dateKey = contributionDateKey(date);
      const records = knowledgeContributionDays.get(dateKey) || [];
      const count = records.length;
      const level = contributionLevel(count, distinctCounts);
      const description = `${dateKey}，${count} 篇公开文章`;

      if (!count) {
        return `<span class="contribution-day contribution-day--level-0" aria-label="${description}" title="${description}"></span>`;
      }

      const isSelected = dateKey === latestDate;
      return `
        <button
          type="button"
          class="contribution-day contribution-day--level-${level}${isSelected ? " is-selected" : ""}"
          data-contribution-date="${dateKey}"
          aria-label="${description}"
          aria-pressed="${isSelected}"
          title="${description}"
        ></button>`;
    })
    .join("");

  return `
    <div class="knowledge-map-shell contribution-map-shell" data-contribution-map>
      <div class="knowledge-map-panel contribution-map-panel">
        <div class="knowledge-map-scroll contribution-scroll" tabindex="0" aria-label="公开文章贡献图，手机端可横向滑动">
          <div class="contribution-chart" style="--contribution-weeks: ${weekCount}">
            <div class="contribution-months" aria-hidden="true">
              ${monthLabels.map(({ week, label }) => `<span style="grid-column: ${week}">${label}</span>`).join("")}
            </div>
            <div class="contribution-weekdays" aria-hidden="true">
              ${["一", "二", "三", "四", "五", "六", "日"].map((weekday) => `<span>${weekday}</span>`).join("")}
            </div>
            <div class="contribution-grid" aria-label="按周排列的每日公开文章数量">${cells}</div>
          </div>
        </div>
        <div class="contribution-scale" aria-label="文章数量颜色图例">
          <span>少</span>
          ${[0, 1, 2, 3, 4].map((level) => `<i class="contribution-day contribution-day--level-${level}"></i>`).join("")}
          <span>多</span>
        </div>
      </div>
      <aside class="knowledge-readout" aria-live="polite">
        <span>所选日期</span>
        <p><time data-contribution-date-value>${latestDate}</time><b data-contribution-count>${initialRecords.length} 篇</b></p>
        <div class="contribution-readout-lanes" data-contribution-lanes>${contributionLaneMarkup(initialRecords)}</div>
        <div class="contribution-readout-list" data-contribution-list>${contributionArticleMarkup(initialRecords)}</div>
        <small>悬停、点击或使用 Tab 选择日期；点击标题打开文章</small>
      </aside>
    </div>`;
}

function bindContributionMap() {
  const map = ui.app.querySelector("[data-contribution-map]");
  if (!map) return;

  const updateReadout = (button) => {
    const dateValue = button.dataset.contributionDate;
    const records = knowledgeContributionDays.get(dateValue) || [];
    const date = map.querySelector("[data-contribution-date-value]");
    const count = map.querySelector("[data-contribution-count]");
    const lanes = map.querySelector("[data-contribution-lanes]");
    const list = map.querySelector("[data-contribution-list]");
    if (!date || !count || !lanes || !list || !records.length) return;

    map.querySelectorAll("[data-contribution-date]").forEach((day) => {
      const isSelected = day === button;
      day.classList.toggle("is-selected", isSelected);
      day.setAttribute("aria-pressed", String(isSelected));
    });
    date.textContent = dateValue;
    count.textContent = `${records.length} 篇`;
    lanes.innerHTML = contributionLaneMarkup(records);
    list.innerHTML = contributionArticleMarkup(records);
  };

  const selectDay = (event) => {
    const button = event.target.closest?.("[data-contribution-date]");
    if (button) updateReadout(button);
  };

  map.addEventListener("pointerover", selectDay);
  map.addEventListener("focusin", selectDay);
  map.addEventListener("click", selectDay);

  const scroller = map.querySelector(".contribution-scroll");
  if (scroller) scroller.scrollLeft = scroller.scrollWidth;
}

function githubUpdatedLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "近期更新";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(date);
}

function renderGithubPulse(profile) {
  if (!profile?.profileUrl || !profile?.username) return "";
  const repositories = Array.isArray(profile.repositories) ? profile.repositories.slice(0, 3) : [];
  const profileBio = /^https?:\/\//i.test(profile.bio || "")
    ? "公开代码与持续构建"
    : profile.bio || "公开代码与持续构建";

  return `
    <section class="nova-panel nova-panel--github reveal">
      <header class="nova-panel-heading">
        <div><span>代码近况</span><h2>GitHub 近况</h2></div>
        <a href="${escapeHtml(profile.profileUrl)}" target="_blank" rel="noreferrer">打开 GitHub ${iconArrow()}</a>
      </header>
      <div class="github-pulse">
        <a class="github-profile-card" href="${escapeHtml(profile.profileUrl)}" target="_blank" rel="noreferrer">
          <img src="${escapeHtml(profile.avatarUrl)}" alt="${escapeHtml(profile.username)} 的 GitHub 头像" loading="lazy" />
          <div>
            <p>GITHUB / @${escapeHtml(profile.username)}</p>
            <h3>${escapeHtml(profile.displayName || profile.username)}</h3>
            <span>${escapeHtml(profileBio)}</span>
          </div>
          ${iconArrow()}
        </a>
        <dl class="github-metrics" aria-label="GitHub 公开资料">
          <div><dt>REPOS</dt><dd>${Number(profile.publicRepos) || 0}</dd></div>
          <div><dt>FOLLOWERS</dt><dd>${Number(profile.followers) || 0}</dd></div>
          <div><dt>FOLLOWING</dt><dd>${Number(profile.following) || 0}</dd></div>
        </dl>
        <div class="github-repository-list">
          ${repositories.length
            ? repositories.map((repository) => `
                <a href="${escapeHtml(repository.url)}" target="_blank" rel="noreferrer">
                  <span>${escapeHtml(repository.language || "CODE")}</span>
                  <strong>${escapeHtml(repository.name)}</strong>
                  <small>${escapeHtml(repository.description || "公开仓库")}</small>
                  <time>UPDATED ${escapeHtml(githubUpdatedLabel(repository.updatedAt)).toUpperCase()}</time>
                </a>`).join("")
            : '<p class="nova-empty">最近的公开仓库正在同步。</p>'}
        </div>
      </div>
      <p class="github-sync-note">公开快照 · ${escapeHtml(githubUpdatedLabel(profile.fetchedAt))} 同步</p>
    </section>`;
}

function collectionCards(collections) {
  return `<div class="collection-directory">${collections.map(c=>`<a class="collection-directory-card" href="#/collection/${encodeURIComponent(c.id)}" data-reading-badge="off"><span>${escapeHtml(c.area)} · ${c.articles.length} 篇${c.ordered===false?" · 按问题选读":" · 按顺序阅读"}</span><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.description)}</p></a>`).join("")}</div>`;
}
function renderCollection(id) {
  const c=ContentOrganization.collections(state.articles).find(c=>c.id===id);
  if(!c){renderError("没有找到这个专题","可以从专题目录重新选择。");return;}
  updateActiveNav("learning");
  ui.app.innerHTML=`<section class="directory-page collection-detail"><a class="back-link" href="#/columns">← 全部专题</a>${sectionIntro("",c.title,c.description,c.articles.length)}<p class="directory-guidance">${c.ordered===false?"按关心的问题选读。":"从第一篇开始，也可以直接进入需要的章节。"}</p><${c.ordered===false?"ul":"ol"} class="series-chapters">${c.articles.map((a,i)=>`<li><a href="${articleHref(a.path)}">${c.ordered!==false?`<span>${i+1}</span>`:""}<div><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(a.summary)}</p><small>${escapeHtml(a.contentKind||a.type||"文章")}</small></div></a></li>`).join("")}</${c.ordered===false?"ul":"ol"}></section>`;
  document.title=`${c.title} · 观澜`;
}
function seriesNavigation(article) {
  if(!article)return "";
  const groups=article.path.startsWith(ENGLISH_PASSAGE_PREFIX)?[{id:"english",title:"English Reads",ordered:true,articles:englishReadings()}]:ContentOrganization.collectionFor(article.path,state.articles);
  if(!groups.length)return "";
  return groups.map(c=>{
    const i=c.articles.findIndex(a=>a.path===article.path),previous=c.articles[i-1],next=c.articles[i+1];
    const href=c.id==="english"?articleHref(ENGLISH_COLLECTION_PATH):`#/collection/${c.id}`;
    return `<nav class="series-navigation" aria-label="${escapeHtml(c.title)}续读"><header><a href="${href}">${escapeHtml(c.title)} · 查看目录</a><span>${i+1} / ${c.articles.length}</span></header>${c.ordered!==false?`<div>${previous?`<a href="${articleHref(previous.path)}"><small>上一篇</small><strong>${escapeHtml(previous.title)}</strong></a>`:"<span></span>"}${next?`<a href="${articleHref(next.path)}"><small>下一篇</small><strong>${escapeHtml(next.title)}</strong></a>`:`<a href="${href}"><small>已到本系列最后一篇</small><strong>返回目录，选择其他内容</strong></a>`}</div>`:""}</nav>`;
  }).join("");
}

function renderOverview() {
 const articles=state.articles.filter(canShowOnHome).filter(matchesSearch);
 const recent=ContentOrganization.updates(articles,7);
 const collections=ContentOrganization.collections(articles);
 const visited=(readHistory?.recent?.()||[]).map(path=>articles.find(a=>a.path===path)).filter(a=>a&&a.path!==ENGLISH_COLLECTION_PATH).slice(0,3);
 const reading=articles.filter(a=>a.section==="reading"&&!a.path.startsWith(ENGLISH_PASSAGE_PREFIX)&&a.path!==ENGLISH_COLLECTION_PATH).slice(0,3);
 const mapArticles=articles.filter(a=>a.section!=="about");
 ui.app.innerHTML=`<section class="nova-home">
 <header class="nova-masthead"><div class="studio-home-hero"><div><p class="studio-home-kicker">WY 的读书与实践</p><h1>观澜</h1><blockquote class="studio-motto"><p>观水有术，必观其澜。</p><cite><a href="https://ctext.org/mengzi/jin-xin-i/zh" target="_blank" rel="noopener noreferrer">《孟子·尽心上》</a></cite></blockquote><div class="studio-home-actions"><a href="#/learning">浏览知识库 ${iconArrow()}</a><a href="#/reading">开始阅读</a></div></div>
 <nav class="studio-bookshelf" aria-label="从书架进入内容"><a class="studio-book studio-book--english" href="${articleHref(ENGLISH_COLLECTION_PATH)}" data-reading-badge="off"><strong lang="en">English<br>Reads</strong><span>${englishReadings().length} 篇短文</span></a><a class="studio-book studio-book--code" href="#/columns"><strong>专题研读</strong><span>从目录开始</span></a><a class="studio-book studio-book--practice" href="#/projects"><strong>项目实践</strong><span>方案与记录</span></a></nav></div></header>
 <div class="home-editorial">
 ${visited.length?`<section class="home-section"><header><h2>最近访问</h2><span>本浏览器的阅读足迹</span></header><div class="recent-visits">${visited.map(a=>`<a href="${articleHref(a.path)}" data-reading-badge="off">${escapeHtml(a.title)}</a>`).join("")}</div></section>`:""}
 <section class="home-section"><header><h2>沿一个主题读下去</h2><a href="#/columns">全部专题 ${iconArrow()}</a></header>${collectionCards(collections.slice(0,4))}</section>
 <section class="home-section"><header><h2>近期更新</h2><a href="#/timeline">全部记录 ${iconArrow()}</a></header><div class="update-list">${recent.map(a=>`<a href="${a.collectionLink||articleHref(a.path)}" data-reading-badge="off"><div><small>${escapeHtml(a.updateLabel)}</small><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.summary)}</p></div><time>${escapeHtml(a.date)}</time></a>`).join("")}</div></section>
 <section class="home-section"><header><h2>项目与实践</h2><a href="#/projects">查看项目 ${iconArrow()}</a></header><div class="project-records">${articles.filter(a=>a.section==="projects").map(a=>`<a href="${articleHref(a.path)}"><small>${escapeHtml(a.contentKind)}</small><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.summary)}</p></a>`).join("")}</div></section>
 <section class="nova-panel nova-panel--references"><header class="nova-panel-heading"><h2>阅读与参考</h2><a href="#/reading">进入阅读 ${iconArrow()}</a></header><div class="nova-reference-strip">${reading.map(a=>`<a href="${articleHref(a.path)}"><div><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.summary)}</p></div><time>${escapeHtml(a.date)}</time></a>`).join("")}</div></section>
 <details class="archive-details"><summary>公开档案与代码近况 <span>${articles.length} 条公开记录</span></summary><p>包含文章、资料与集合入口；收录数量不代表写作量或学习完成量。</p><div class="nova-dashboard"><section class="nova-panel nova-panel--map"><header class="nova-panel-heading"><h2>公开内容收录记录</h2><a href="#/timeline">按时间回看</a></header><p>按记录日期展示；同批导入的内容会集中出现。</p>${renderContributionMap(mapArticles)}</section>${renderGithubPulse(state.githubProfile)}</div></details>
 </div></section>`;
 bindContributionMap();
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

      <div class="timeline-shell reveal delay-1">
        <aside class="timeline-rail">
          <p class="mono-label">ORBIT INDEX</p>
          <div class="timeline-rail-count">
            <strong>${days.length}</strong><span>个归档日期</span>
          </div>
          <nav class="timeline-day-index" aria-label="日期索引">
            ${
              visibleDays.length
                ? visibleDays
                    .map(([date, articles]) => {
                      const dateParts = timelineDateParts(date);
                      return `
                        <a href="#day-${date}">
                          <time>${dateParts.short}</time>
                          <span>${articles.length} 项</span>
                        </a>`;
                    })
                    .join("")
                : '<span class="timeline-rail-empty">暂无日期</span>'
            }
          </nav>
          <small>点击日期可跳转到对应轨道</small>
        </aside>

        <div class="timeline-body">
          <div class="timeline-toolbar">
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
                        <section id="day-${date}" class="timeline-day reveal" style="--delay:${Math.min(dayIndex, 6) * 45}ms">
                          <header class="timeline-date">
                            <time datetime="${date}">
                              <strong>${dateParts.short}</strong>
                              <span>${dateParts.weekday}</span>
                              <small>${dateParts.year}</small>
                            </time>
                            <div class="timeline-day-summary">
                              ${categoryCounts
                                .map(
                                  (item) =>
                                    `<span data-category="${item.id}"><b>${item.label}</b><em>${item.count} 篇</em></span>`,
                                )
                                .join("")}
                            </div>
                          </header>
                          <div class="timeline-day-content">
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
        </div>
      </div>
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
 const articles=filteredArticles("projects");
 ui.app.innerHTML=`<section class="directory-page project-directory-page">${sectionIntro("","项目","具体方案、实践记录，以及长期关注的方向。",articles.length)}<section class="home-section"><header><h2>方案与实践记录</h2></header><div class="project-records">${articles.map(a=>`<a href="${articleHref(a.path)}"><small>${escapeHtml(a.contentKind||"实践记录")}</small><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(a.summary)}</p><time>${escapeHtml(a.date)}</time></a>`).join("")}</div></section><section class="home-section"><header><h2>长期方向</h2><span>持续关注的领域</span></header><div class="direction-list">${state.projects.map(a=>`<div><h3>${escapeHtml(a.name)}</h3><p>${escapeHtml(a.summary)}</p></div>`).join("")}</div></section></section>`;
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

const EXAM_NOTE_VISUALS = {
  "exam-math-map": {
    kicker: "数学 / MAP",
    title: "三条主线，先找研究对象",
    question: "看到题目，先判断它在研究变化、空间还是随机性。",
    diagram: "math-map",
    tone: "blue",
    blocks: [["高数", "变化 / 累积"], ["线代", "空间 / 变换"], ["概率", "随机 / 分布"]],
    answer: "不要从公式开始，从对象开始。",
  },
  "exam-math-limit-continuity": {
    kicker: "极限 / LIMIT",
    title: "先判对象，再选方法",
    question: "极限题真正考的是趋近过程，不是把数直接代进表达式。",
    diagram: "limit",
    tone: "yellow",
    blocks: [["信号", "0 / 无穷 / 单侧"], ["动作", "等价 / 夹逼 / 泰勒"]],
    answer: "洛必达是工具，不是起手式。",
  },
  "exam-math-derivative-mean-value": {
    kicker: "导数 / DERIVATIVE",
    title: "局部斜率如何变成区间结论",
    question: "只看一阶、二阶导数，为什么能判断函数的整体走向？",
    diagram: "derivative",
    tone: "blue",
    blocks: [["一阶导", "单调 / 极值"], ["二阶导", "凹凸 / 拐点"], ["中值定理", "把局部连到区间"]],
    answer: "先找定义域，再划分可导区间。",
  },
  "exam-math-integral": {
    kicker: "积分 / INTEGRAL",
    title: "把微小变化累计起来",
    question: "面积、路程、功和总量，为什么最后都落到同一种运算？",
    diagram: "integral",
    tone: "red",
    blocks: [["定积分", "区间上的总量"], ["换元", "换一个更自然的变量"], ["分部", "把乘积拆成两部分"]],
    answer: "先找累计对象，再确定边界和变量。",
  },
  "exam-math-linear-algebra": {
    kicker: "线性代数 / RANK",
    title: "秩：矩阵丢掉了多少维",
    question: "一个数字，为什么能同时判断方程组、相关性和可逆性？",
    diagram: "matrix",
    tone: "green",
    blocks: [["一致性", "r(A) = r(A|b)"], ["自由度", "n - r(A)"], ["变换", "像空间的维数"]],
    answer: "秩不是计算结果，是空间信息。",
  },
  "exam-math-probability": {
    kicker: "概率 / RANDOM VARIABLE",
    title: "分布是随机变量的说明书",
    question: "从一次随机试验到期望、方差，中间到底压缩了什么？",
    diagram: "probability",
    tone: "purple",
    blocks: [["分布", "X 取什么值"], ["期望", "长期平均位置"], ["方差", "围绕平均的波动"]],
    answer: "独立不等于不相关，先看联合分布。",
  },
  "pack-nine-lectures": {
    kicker: "算法 / KNAPSACK",
    title: "状态转移，怎样把选择题做成表",
    question: "背包问题的核心不是背模板，而是定义状态、决策和边界。",
    diagram: "knapsack",
    tone: "red",
    blocks: [["状态", "前 i 件 / 容量 v"], ["决策", "选 or 不选"], ["优化", "滚动数组降空间"]],
    answer: "先说清状态含义，再写转移方程。",
  },
  "exam-408-map": {
    kicker: "计算机基础 / MAP",
    title: "四门课，其实是一条机器链",
    question: "数据如何组织、执行、被管理，最后穿过网络？",
    diagram: "computer-map",
    tone: "blue",
    blocks: [["数据结构", "组织数据"], ["组成原理", "执行指令"], ["操作系统", "管理资源"], ["计算机网络", "传递字节"]],
    answer: "计算机基础不是四本书的并列背诵，而是一台机器的四个观察面。",
  },
  "exam-408-data-structure": {
    kicker: "数据结构 / GRAPH",
    title: "先看关系，再选遍历",
    question: "树题和图题，为什么不能只背 DFS、BFS 的顺序？",
    diagram: "tree",
    tone: "yellow",
    blocks: [["树", "无环 / 有层次"], ["图", "关系 / 路径"], ["搜索", "状态 + 访问标记"]],
    answer: "遍历只是动作，关系才是题目的骨架。",
  },
  "exam-408-computer-organization-cache": {
    kicker: "组成原理 / CACHE",
    title: "局部性如何变成速度",
    question: "Cache 不是更快的内存，它利用的是程序访问地址的规律。",
    diagram: "cache",
    tone: "red",
    blocks: [["时间局部性", "刚用过，可能再用"], ["空间局部性", "附近地址一起用"], ["命中", "少付一次主存代价"]],
    answer: "Cache 的速度来自命中，不是容量本身。",
  },
  "exam-408-operating-system": {
    kicker: "操作系统 / OS",
    title: "进程是边界，线程是执行流",
    question: "进程、线程、虚拟内存分别在管理什么？",
    diagram: "os",
    tone: "green",
    blocks: [["进程", "地址空间 / 资源"], ["线程", "执行流 / 栈"], ["虚拟内存", "连续的错觉"]],
    answer: "先分清资源归属，再谈切换开销。",
  },
  "exam-408-network-tcp": {
    kicker: "计算机网络 / TCP",
    title: "丢包后，TCP 如何补回来",
    question: "序号、确认、窗口、重传，四条线如何共同完成可靠传输？",
    diagram: "network",
    tone: "purple",
    blocks: [["序号", "给字节排位置"], ["确认", "报告连续收到哪里"], ["重传", "补回缺失数据"]],
    answer: "可靠性、流量控制、拥塞控制不是一个概念。",
  },
  "exam-408-program-to-packet": {
    kicker: "计算机基础 / CROSSOVER",
    title: "一次请求穿过四门课",
    question: "从用户态的一行代码，到网卡上的一个数据包，中间发生了什么？",
    diagram: "request",
    tone: "blue",
    blocks: [["用户态", "构造数据 / 调系统调用"], ["内核态", "缓冲区 / 协议栈"], ["硬件", "CPU / 网卡 / 链路"]],
    answer: "沿着数据真正经过的路径复习，四科就连上了。",
  },
};

function examNoteVisual(article) {
  const slug = (article.path || article.url || "").split("/").pop().replace(/\.md$/, "");
  const matched = Object.entries(EXAM_NOTE_VISUALS).find(([key]) => slug.includes(key));
  return matched?.[1] || {
    kicker: `${article.area || "学习"} / NOTE`,
    title: article.title,
    question: article.summary || "把一个知识点拆成对象、关系、方法和结论。",
    diagram: "",
    tone: "blue",
    blocks: [["识别", "先找题目对象"], ["推导", "再找不变量"], ["复盘", "最后记录易错点"]],
    answer: "先看结构，再做计算。",
  };
}

function examNoteDiagram(kind) {
  const diagrams = {
    "math-map": `
      <div class="exam-diagram exam-diagram-flow">
        <span class="diagram-node diagram-node-blue">高数<small>变化</small></span><i>→</i>
        <span class="diagram-node diagram-node-yellow">线代<small>空间</small></span><i>→</i>
        <span class="diagram-node diagram-node-red">概率<small>随机</small></span>
      </div>`,
    knapsack: `
      <div class="exam-diagram exam-diagram-knapsack">
        <div class="knapsack-items"><span>物品 1</span><span>物品 2</span><span>物品 3</span></div>
        <i>↓ 选 / 不选</i>
        <div class="knapsack-table"><b>F[i, v]</b><span>F[i - 1, v]</span><span>F[i - 1, v - Cᵢ] + Wᵢ</span></div>
        <small>状态 = 前 i 件物品 + 容量 v</small>
      </div>`,
    limit: `
      <div class="exam-diagram exam-diagram-axis">
        <svg viewBox="0 0 280 112" role="img" aria-label="极限曲线示意图">
          <path class="diagram-grid-line" d="M18 88H264M44 14V96" />
          <path class="diagram-curve" d="M52 80C88 74 94 52 126 54S160 78 180 42 218 28 254 22" />
          <circle class="diagram-dot" cx="126" cy="54" r="5" />
        </svg>
        <b>lim x → x₀</b><span>先判断趋近对象</span>
      </div>`,
    derivative: `
      <div class="exam-diagram exam-diagram-axis">
        <svg viewBox="0 0 280 112" role="img" aria-label="导数与切线示意图">
          <path class="diagram-grid-line" d="M18 92H264M48 12V98" />
          <path class="diagram-curve" d="M44 88C78 78 92 36 126 46S170 94 218 30 240 18 260 12" />
          <path class="diagram-tangent" d="M92 78L166 28" />
          <circle class="diagram-dot" cx="126" cy="55" r="5" />
        </svg>
        <b>f′(x) = 局部斜率</b><span>中值定理把点连成段</span>
      </div>`,
    integral: `
      <div class="exam-diagram exam-diagram-axis">
        <svg viewBox="0 0 280 112" role="img" aria-label="积分面积示意图">
          <path class="diagram-grid-line" d="M18 92H264M44 12V98" />
          <path class="diagram-fill" d="M48 84C78 72 94 40 126 46S178 80 228 28L228 92H48Z" />
          <path class="diagram-curve" d="M48 84C78 72 94 40 126 46S178 80 228 28" />
          <path class="diagram-bar" d="M78 92V70M110 92V47M142 92V56M174 92V67" />
        </svg>
        <b>∫ f(x) dx = 累计量</b><span>边界决定答案</span>
      </div>`,
    matrix: `
      <div class="exam-diagram exam-diagram-matrix">
        <span class="matrix-bracket">[ A ]</span><i>→</i><span class="matrix-space"><b>像空间</b><small>r(A)</small></span>
        <div class="matrix-dots"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </div>`,
    probability: `
      <div class="exam-diagram exam-diagram-bars">
        <div class="probability-axis"><i style="height:28%"></i><i style="height:52%"></i><i style="height:86%"></i><i style="height:64%"></i><i style="height:38%"></i><i style="height:20%"></i></div>
        <b>X → F(x) → E(X)</b><span>分布逐步压缩成特征</span>
      </div>`,
    "computer-map": `
      <div class="exam-diagram exam-diagram-flow exam-diagram-four">
        <span class="diagram-node diagram-node-blue">数据结构</span><i>→</i><span class="diagram-node diagram-node-yellow">组成</span><i>→</i><span class="diagram-node diagram-node-green">OS</span><i>→</i><span class="diagram-node diagram-node-red">网络</span>
      </div>`,
    tree: `
      <div class="exam-diagram exam-diagram-tree">
        <span class="tree-node tree-root">关系</span><div class="tree-branches"><span>树 / 层次</span><span>图 / 路径</span></div><div class="tree-leaves"><i>DFS</i><i>BFS</i><i>标记</i></div>
      </div>`,
    cache: `
      <div class="exam-diagram exam-diagram-pipeline"><span>CPU</span><i>→</i><b>Cache</b><i>→</i><span>主存</span><div class="cache-pulse"></div><small>命中率 × 访问规律 = 速度</small></div>`,
    os: `
      <div class="exam-diagram exam-diagram-layers"><span class="layer-process">进程 / 资源边界</span><span class="layer-thread">线程 / 执行流</span><span class="layer-memory">虚拟内存 / 地址空间</span><small>调度器在层之间切换</small></div>`,
    network: `
      <div class="exam-diagram exam-diagram-packets"><div><span>SEQ</span><span>ACK</span><span>WIN</span></div><i>→</i><div><span>丢失</span><span>超时</span><span>重传</span></div><small>连续确认 + 在途窗口</small></div>`,
    request: `
      <div class="exam-diagram exam-diagram-request"><span>程序</span><i>↓</i><span>系统调用</span><i>↓</i><span>协议栈</span><i>↓</i><span>数据包</span></div>`,
  };
  return diagrams[kind] || diagrams["computer-map"];
}

function examNoteCard(article, index) {
  const refPath = article.path || article.url;
  if (!refPath) return articleRow(article, { index: String(index + 1).padStart(2, "0") });

  const visual = examNoteVisual(article);
  const tags = (article.tags || []).slice(0, 3).join(" / ");
  return `
    <a class="exam-note-post" href="${articleHref(refPath)}" aria-label="打开 ${escapeHtml(article.title)}">
      <article class="exam-note-sheet exam-note-tone-${visual.tone}">
        <header class="exam-note-sheet-head">
          <span>${escapeHtml(visual.kicker)}</span>
          <b>${String(index + 1).padStart(2, "0")}</b>
        </header>
        <h3>${escapeHtml(visual.title)}</h3>
        <p class="exam-note-question">${escapeHtml(visual.question)}</p>
        ${visual.diagram ? examNoteDiagram(visual.diagram) : ""}
        <div class="exam-note-blocks">
          ${visual.blocks.map(([label, value], blockIndex) => `
            <div class="exam-note-block">
              <b>${String(blockIndex + 1).padStart(2, "0")}</b>
              <span><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>
            </div>`).join("")}
        </div>
        <footer class="exam-note-answer"><span>一句话</span><strong>${escapeHtml(visual.answer)}</strong></footer>
      </article>
      <div class="exam-note-caption">
        <strong>${escapeHtml(article.title)}</strong>
        <span>${escapeHtml(tags || article.module || "学习卡片")} <em>↗</em></span>
      </div>
    </a>`;
}

function examNoteStudio(groups) {
  const total = groups.reduce((count, [, articles]) => count + articles.length, 0);
  return `
    <section class="exam-note-studio reveal" data-exam-studio>
      <header class="exam-studio-profile">
        <div class="exam-studio-avatar">WY</div>
        <div>
          <p class="exam-studio-kicker">PERSONAL STUDY NOTES / 2026</p>
          <h2>数学 · 计算机基础</h2>
          <span>把公式、结构和题型画成可以反复打开的笔记。</span>
        </div>
        <div class="exam-studio-stat"><strong>${total}</strong><span>张笔记</span></div>
      </header>
      <div class="exam-studio-tabs"><b>笔记</b><span>数学与计算机基础</span><span>${groups.length} 个专题</span></div>
      ${groups.map(([area, articles], index) => `
        <section class="exam-note-field" data-exam-area="${escapeHtml(area)}">
          <header><div><small>NOTE FIELD / ${String(index + 1).padStart(2, "0")}</small><h3>${escapeHtml(area)}</h3></div><span>${articles.length} 张</span></header>
          <div class="exam-note-grid">${articles.map((article, articleIndex) => examNoteCard(article, articleIndex)).join("")}</div>
        </section>`).join("")}
    </section>`;
}

function renderLearning() {
 const items=filteredArticles("learning"),params=parseRoute().params||new URLSearchParams();
 const order=["AI Agent","Java 后端","数据与中间件","工程与架构","前端","安全","计算机基础","数学","物理","英语","政治"];
 const groups=Object.entries(groupBy(items,"area","待归类")).sort(([a],[b])=>(order.indexOf(a)<0?99:order.indexOf(a))-(order.indexOf(b)<0?99:order.indexOf(b)));
 const selected=params.get("area"),group=groups.find(([name])=>name===selected),mode=params.get("view");
 const collections=ContentOrganization.collections(state.articles);
 let body="";
 if(mode==="series")body=collectionCards(collections);
 else if(group){
  const modules=[...new Set(group[1].map(a=>a.module).filter(Boolean))];
  const module=params.get("module"),list=module?group[1].filter(a=>a.module===module):group[1];
  body=`<a class="back-link" href="#/learning">← 全部领域</a><h2 class="field-title">${escapeHtml(group[0])}</h2>${collectionCards(collections.filter(c=>c.area===selected))}<label class="field-filter">细分主题 <select id="library-module"><option value="">全部内容（${group[1].length}）</option>${modules.map(m=>`<option value="${escapeHtml(m)}"${m===module?' selected':''}>${escapeHtml(m)}</option>`).join("")}</select></label><div class="article-list library-articles">${list.map(a=>articleRow(a)).join("")||'<p>这个领域没有匹配内容。</p>'}</div>`;
 }else body=`<div class="knowledge-fields">${groups.map(([name,list])=>`<a href="#/learning?area=${encodeURIComponent(name)}"><h2>${escapeHtml(name)}</h2><p>${escapeHtml(state.learningAreas.find(a=>a.name===name)?.description||"概念、方法与参考资料")}</p><span>${list.length} 篇内容</span></a>`).join("")}</div>`;
 ui.app.innerHTML=`<section class="directory-page learning-page">${sectionIntro("","知识库","先选领域，再按主题查找；连续内容可以从专题目录开始。",items.length)}<nav class="library-views" aria-label="知识库浏览方式"><a href="#/learning"${mode!=="series"?' class="active"':''}>按领域</a><a href="#/learning?view=series"${mode==="series"?' class="active"':''}>系列与专题</a><a href="#/points">查知识点</a></nav>${body}</section>`;
 document.getElementById("library-module")?.addEventListener("change",e=>{location.hash=`#/learning?area=${encodeURIComponent(selected)}${e.target.value?'&module='+encodeURIComponent(e.target.value):''}`;});
}


function renderPointsView(items) {
  const hitPoints = state.pointsIndex
    .filter((point) => point.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
  if (!hitPoints.length) return '<p class="empty-copy">暂无知识点数据，等待重新构建索引。</p>';
  const sel = state.learningPointSel && hitPoints.some((p) => p.name === state.learningPointSel)
    ? state.learningPointSel
    : hitPoints[0].name;
  const topics = [];
  hitPoints.forEach((point) => {
    let bucket = topics.find(([topic]) => topic === point.topic);
    if (!bucket) { bucket = [point.topic, []]; topics.push(bucket); }
    bucket[1].push(point);
  });
  const selectedItems = items.filter((article) => Array.isArray(article.points) && article.points.includes(sel));
  return `
    <div class="points-board reveal delay-1">
      ${topics.map(([topic, points]) => `
        <div class="points-topic">
          <p class="points-topic-label">${escapeHtml(topic)}</p>
          <div class="points-chips" role="group" aria-label="${escapeHtml(topic)}知识点">
            ${points.map((point) => `
              <button type="button" data-point-sel="${escapeHtml(point.name)}"${point.name === sel ? ' class="is-active"' : ""}>
                ${escapeHtml(point.name)}<em>${point.count}</em>
              </button>`).join("")}
          </div>
        </div>`).join("")}
    </div>
    <div class="learning-board">
      <section class="learning-card learning-group">
        <header class="learning-card-header">
          <div class="learning-card-title">
            <p>KNOWLEDGE POINT</p>
            <h2>${escapeHtml(sel)}</h2>
            <span>${selectedItems.length} 篇相关内容</span>
          </div>
        </header>
        <div class="article-list">${selectedItems.map((article) => articleRow(article)).join("")}</div>
      </section>
    </div>`;
}

function masteryLevel(point) {
  if (!point.avgScore) return point.practice ? "unrated" : "new";
  if (point.avgScore >= 7) return "good";
  if (point.avgScore >= 5) return "mid";
  return "weak";
}

function pointDetailCard(label, items) {
  if (!items.length) return "";
  return `
    <section class="learning-card learning-group">
      <header class="learning-card-header">
        <div class="learning-card-title">
          <p>KNOWLEDGE POINT / ${escapeHtml(label)}</p>
          <h2>${escapeHtml(label)} · ${items.length}</h2>
        </div>
      </header>
      <div class="article-list">${items.map((article) => articleRow(article)).join("")}</div>
    </section>`;
}

function renderPointsPage(params) {
  const requested = params ? params.get("point") : null;
  if (requested) state.pointPageSel = requested;
  const hitPoints = state.pointsIndex
    .filter((point) => point.count + point.interview + point.practice > 0)
    .sort(
      (a, b) =>
        b.count + b.interview + b.practice - (a.count + a.interview + a.practice) ||
          a.name.localeCompare(b.name, "zh-CN"),
    );
  if (!hitPoints.length) {
    ui.app.innerHTML = `
      <section class="directory-page">
        ${sectionIntro("KNOWLEDGE MAP", "知识点", "按细节知识点聚合学习文章、面经实录与练习台账。", 0)}
        <p class="empty-copy">知识点索引尚未生成，等待构建。</p>
      </section>`;
    return;
  }
  const sel = state.pointPageSel && hitPoints.some((point) => point.name === state.pointPageSel)
    ? state.pointPageSel
    : hitPoints[0].name;
  if (requested === null) history.replaceState(null, "", "#/points?point=" + encodeURIComponent(sel));
  const topics = [];
  hitPoints.forEach((point) => {
    let bucket = topics.find(([topic]) => topic === point.topic);
    if (!bucket) { bucket = [point.topic, []]; topics.push(bucket); }
    bucket[1].push(point);
  });
  const related = state.articles.filter(
    (article) => !isHidden(article) && Array.isArray(article.points) && article.points.includes(sel),
  );
  const learningItems = related.filter((article) => getArticleSection(article) === "learning");
  const interviewItems = related.filter((article) => article.path.includes("/companies/"));
  const practiceItems = related.filter((article) => article.path.includes("/practice/"));
  ui.app.innerHTML = `
    <section class="directory-page points-page">
      ${sectionIntro("KNOWLEDGE MAP", "知识点", "按细节知识点聚合学习文章、面经实录与练习台账。", hitPoints.length)}
      <div class="points-board reveal delay-1">
        ${topics.map(([topic, points]) => `
          <div class="points-topic">
            <p class="points-topic-label">${escapeHtml(topic)}</p>
            <div class="points-chips" role="group" aria-label="${escapeHtml(topic)}知识点">
              ${points.map((point) => {
                const total = point.count + point.interview + point.practice;
                const mastery = masteryLevel(point);
                return `<button type="button" data-point-page-sel="${escapeHtml(point.name)}"${point.name === sel ? ' class="is-active"' : ""}>
                  <i class="mastery-dot mastery-${mastery}" aria-hidden="true"></i>${escapeHtml(point.name)}<em>${total}${point.gap ? " ⚠" : ""}</em>
                </button>`;
              }).join("")}
            </div>
          </div>`).join("")}
      </div>
      ${hitPoints.find((point) => point.name === sel)?.gap
        ? `<div class="point-gap-callout reveal delay-1">⚠ 该知识点面经里被问过 <strong>${hitPoints.find((point) => point.name === sel).interview}</strong> 次，但练习台账还是 0 题——该练了。</div>`
        : ""}
      <div class="point-summary reveal delay-1">
        <p class="point-summary-label">AI 速览</p>
        <p>${escapeHtml(hitPoints.find((point) => point.name === sel)?.summary || "该知识点的总结待补充。")}</p>
      </div>
      <div class="learning-board">
        ${pointDetailCard("面试题 · 练习台账", practiceItems)}
        ${pointDetailCard("整理文章", learningItems)}
        ${pointDetailCard("面经实录", interviewItems)}
      </div>
    </section>`;
  ui.app.querySelectorAll("[data-point-page-sel]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.pointPageSel === button.dataset.pointPageSel) return;
      state.pointPageSel = button.dataset.pointPageSel;
      history.replaceState(null, "", "#/points?point=" + encodeURIComponent(state.pointPageSel));
      renderPointsPage(new URLSearchParams({ point: state.pointPageSel }));
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
 const items=filteredArticles("reading").filter(a=>!a.path.startsWith(ENGLISH_PASSAGE_PREFIX)&&a.path!==ENGLISH_COLLECTION_PATH);
 const groups=Object.entries(groupBy(items,"readingTopic","其他阅读"));
 ui.app.innerHTML=`<section class="directory-page reading-directory-page">${sectionIntro("","阅读","英文短文、中文长文，以及读书时留下的记录。",items.length+englishReadings().length)}<section class="reading-entrances"><a class="reading-english-entry" href="${articleHref(ENGLISH_COLLECTION_PATH)}" data-reading-badge="off"><span>${englishReadings().length} 篇 · 划词与词组查询</span><h2>English Reads</h2><p>按主题选一篇英文短文，边读边积累。</p><strong>进入英文阅读 ${iconArrow()}</strong></a><div class="reading-tools"><h2>生词本</h2><p>保存阅读中遇到的单词和词组，随时查阅。</p><div id="reading-vocabulary"></div></div></section><header class="home-section-heading"><h2>中文阅读</h2></header><div class="directory-groups">${groups.map(([name,list])=>`<section class="directory-group reading-group"><header><h2>${escapeHtml(name)}</h2><span>${list.length} 篇</span></header><div class="article-list">${list.map(a=>articleRow(a)).join("")}</div></section>`).join("")}</div></section>`;
 window.ReaderVocabulary?.mountCollection(document.getElementById("reading-vocabulary"));
}


function renderThirdPartyLinks() {
  const links = state.thirdPartyLinks;
  const totalLinks = links.length + state.quickLinks.length;

  ui.app.innerHTML = `
    <section class="directory-page third-party-page">
      ${sectionIntro("RESOURCE DIRECTORY", "资源导航", "值得长期收藏的外部项目、在线书籍、原典数据库与开放知识资源。链接会跳转到第三方网站。", totalLinks)}
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
            : '<p class="empty-copy">等待添加第一个外部资源。</p>'
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

async function renderSearchRoute() {
  if (!state.query) {
    renderSearch();
    decorateReadLinks();
    return;
  }

  const requestedQuery = state.query;
  ui.app.innerHTML = '<div class="loading-state"><span></span><p>正在加载搜索索引…</p></div>';
  try {
    await ensureSearchIndex();
    if (parseRoute().view !== "search" || state.query !== requestedQuery) return;
    renderSearch();
    decorateReadLinks();
  } catch (error) {
    if (parseRoute().view !== "search" || state.query !== requestedQuery) return;
    renderError("搜索索引加载失败", `${error.message}。请稍后重试。`, true);
  }
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
  document.querySelectorAll(".opportunity-grid > article").forEach(card=>{if(parseInt(card.querySelector("small")?.textContent||"0",10)===0)card.remove();});
  if (!questionsCount && !interviewsCount) document.querySelector(".practice-pulse")?.remove();

}

const ENGLISH_COLLECTION_PATH = "content/columns/english-reads.md";
const ENGLISH_PASSAGE_PREFIX = "content/columns/english-reads/";

function englishReadings() {
  return state.articles
    .filter((article) => article.path?.startsWith(ENGLISH_PASSAGE_PREFIX) && article.visibility === "public")
    .sort((a, b) => {
      const editionA = a.path.slice(ENGLISH_PASSAGE_PREFIX.length, ENGLISH_PASSAGE_PREFIX.length + 4);
      const editionB = b.path.slice(ENGLISH_PASSAGE_PREFIX.length, ENGLISH_PASSAGE_PREFIX.length + 4);
      return editionB.localeCompare(editionA) || a.path.localeCompare(b.path);
    });
}

function englishTopics(article) {
  return (article.tags || []).filter((tag) => tag !== "English Reading");
}

function renderColumns() {
 const collections=ContentOrganization.collections(state.articles);
 ui.app.innerHTML=`<section class="columns-overview"><header class="columns-heading"><h1>系列与专题</h1><p>有顺序的内容从第一篇开始，主题阅读按问题选读。</p></header>${collectionCards(collections)}<a class="collection-card" href="${articleHref(ENGLISH_COLLECTION_PATH)}" data-reading-badge="off"><div><span class="collection-eyebrow">英文阅读集合</span><h2>English Reads</h2><p>${englishReadings().length} 篇短文，按主题与年份选读。</p></div><span>进入阅读 ${iconArrow()}</span></a></section>`;
 document.title="系列与专题 · 观澜";
}


function renderEnglishReads() {
  updateActiveNav("reading");
  const articles = englishReadings();
  const topics = ContentOrganization.ENGLISH_TOPICS.map(t=>t.label);
  const years = [...new Set(articles.map((article) => article.path.slice(ENGLISH_PASSAGE_PREFIX.length, ENGLISH_PASSAGE_PREFIX.length + 4)))].sort().reverse();
  const params = parseRoute().params || new URLSearchParams();
  const previous = state.englishReadingFilters || {};
  const filters = {
    query: params.get("q") ?? previous.query ?? "",
    topic: params.get("topic") ?? previous.topic ?? "",
    year: params.get("year") ?? previous.year ?? "",
  };
  if (!topics.includes(filters.topic)) filters.topic = ContentOrganization.ENGLISH_TOPICS.find(g=>g.tags.includes(filters.topic))?.label || "";
  if (!years.includes(filters.year)) filters.year = "";
  ui.app.innerHTML = `
    <section class="english-collection">
      <a class="collection-back" href="#/reading">← 阅读</a>
      <header class="english-collection-heading">
        <div><p class="mono-label">短篇英文阅读</p><h1 lang="en">English Reads</h1>
          <p lang="en" class="english-collection-lede">Ideas for a changing world.</p>
          <p class="english-collection-description">科技、社会、教育与生活，在短篇阅读中发现新的视角。</p></div>
        <span class="collection-total">${articles.length} <small>篇文章</small></span>
      </header>
      <form class="english-filters" role="search" aria-label="筛选英文文章">
        <label class="english-search"><span>搜索文章</span><input id="english-query" type="search" value="${escapeHtml(filters.query)}" placeholder="搜索标题、主题或关键词" autocomplete="off"></label>
        <label><span>主题</span><select id="english-topic"><option value="">全部主题</option>${topics.map((topic) => `<option value="${escapeHtml(topic)}"${topic === filters.topic ? " selected" : ""}>${escapeHtml(topic)}</option>`).join("")}</select></label>
        <label><span>收录来源年份</span><select id="english-year"><option value="">全部年份</option>${years.map((year) => `<option value="${year}"${year === filters.year ? " selected" : ""}>${year}</option>`).join("")}</select></label>
        <button id="english-reset" type="button">重置</button>
      </form>
      <div class="english-results-heading"><p id="english-result-count" role="status" aria-live="polite"></p><span>选择标题，开始阅读</span></div>
      <div id="english-reading-list" class="english-reading-grid"></div>
    </section>`;
  const queryInput = document.getElementById("english-query");
  const topicInput = document.getElementById("english-topic");
  const yearInput = document.getElementById("english-year");
  const update = (persist = false) => {
    const query = queryInput.value.trim().toLowerCase();
    const topic = topicInput.value;
    const year = yearInput.value;
    const matching = articles.filter((article) => {
      const text = `${article.title} ${article.summary || ""} ${englishTopics(article).join(" ")}`.toLowerCase();
      return (!query || text.includes(query)) && (!topic || ContentOrganization.englishTopic(article)?.label === topic) && (!year || article.path.startsWith(ENGLISH_PASSAGE_PREFIX + year + "-"));
    });
    state.englishReadingFilters = { query: queryInput.value, topic, year };
    document.getElementById("english-result-count").textContent = `${matching.length} 篇文章${matching.length !== articles.length ? ` / 共 ${articles.length} 篇` : ""}`;
    document.getElementById("english-reading-list").innerHTML = matching.length ? matching.map((article) => `
      <a class="english-reading-card" data-reading-badge="off" href="${articleHref(article.path)}">
        <div class="english-card-meta"><span class="english-card-topics">${englishTopics(article).slice(0, 2).map(escapeHtml).join(" / ")}</span><span class="english-card-year">${article.path.slice(ENGLISH_PASSAGE_PREFIX.length, ENGLISH_PASSAGE_PREFIX.length + 4)}</span></div>
        <h2 lang="en">${escapeHtml(article.title)}</h2><p>${escapeHtml(article.summary || "")}</p>
        <span class="english-card-open">开始阅读 <span aria-hidden="true">↗</span></span>
      </a>`).join("") : '<p class="english-empty">没有找到匹配的文章，试试其他关键词或重置筛选。</p>';
    if (persist) {
      const next = new URLSearchParams();
      if (queryInput.value.trim()) next.set("q", queryInput.value.trim());
      if (topic) next.set("topic", topic);
      if (year) next.set("year", year);
      history.replaceState(null, "", articleHref(ENGLISH_COLLECTION_PATH) + (next.size ? `?${next}` : ""));
    }
  };
  document.querySelector(".english-filters").addEventListener("submit", (event) => event.preventDefault());
  queryInput.addEventListener("input", () => update(true));
  topicInput.addEventListener("change", () => update(true));
  yearInput.addEventListener("change", () => update(true));
  document.getElementById("english-reset").addEventListener("click", () => {
    queryInput.value = ""; topicInput.value = ""; yearInput.value = ""; update(true);
  });
  update();
  window.ReaderVocabulary?.mountCollection(ui.app.querySelector(".english-collection"));
  document.title = "English Reads · 观澜";
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
  script.dataset.theme = giscusTheme(document.documentElement.dataset.theme);
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
    const markdownLibraries = ensureMarkdownLibraries();
    const response = await fetch(`./${profilePath}?v=${BUILD_VERSION}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    const content = raw.startsWith("---") ? raw.replace(/^---\n[\s\S]*?\n---\n?/, "") : raw;
    await markdownLibraries;
    const rendered = window.DOMPurify.sanitize(window.marked.parse(content));

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
    void highlightCodeBlocks(document.querySelector(".about-body"));
    document.title = "关于 WY · 观澜";
  } catch (error) {
    renderError("个人介绍加载失败", `${error.message}。请检查文件权限或稍后重试。`, true);
  }
}

function updateReadingProgress() {
  const bar = document.getElementById("reading-progress-bar");
  const body = document.getElementById("article-body");
  if (!bar || !body) return;
  const total = body.scrollHeight - window.innerHeight;
  const progress = total > 0 ? Math.min(100, Math.max(0, (window.scrollY / total) * 100)) : 100;
  bar.style.width = `${progress}%`;
}

let readingProgressBound = false;
function bindReadingProgress() {
  updateReadingProgress();
  if (readingProgressBound) return;
  readingProgressBound = true;
  window.addEventListener("scroll", updateReadingProgress, { passive: true });
}

// Hash routes do not provide a document directory for Markdown image URLs.
function resolveArticleImageUrl(src, articlePath, baseUrl) {
  if (!src || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(src)) return src;
  return new URL(src, new URL(articlePath, baseUrl)).href;
}

function resolveArticleImages(html, articlePath) {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("img[src]").forEach((image) => {
    image.setAttribute("src", resolveArticleImageUrl(image.getAttribute("src"), articlePath, document.baseURI));
  });
  return template.innerHTML;
}

async function renderArticle(rawPath, requestedSection = "") {
  // Resolve aliases
  const resolvedPath = state.aliases[rawPath] || rawPath;

  if (resolvedPath === ENGLISH_COLLECTION_PATH) return renderEnglishReads();

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
    const markdownLibraries = ensureMarkdownLibraries();
    const response = await fetch(`./${fetchPath}?v=${BUILD_VERSION}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    const content = raw.startsWith("---") ? raw.replace(/^---\n[\s\S]*?\n---\n?/, "") : raw;
    await markdownLibraries;
    const sanitized = window.DOMPurify.sanitize(window.marked.parse(content));

    const backSection = article ? getArticleSection(article) : "learning";
    const isEnglishReading = fetchPath.startsWith(ENGLISH_PASSAGE_PREFIX);
    const backLabel = isEnglishReading ? "English Reads" : SECTION_LABELS[backSection] || "学习";
    const backHref = isEnglishReading ? articleHref(ENGLISH_COLLECTION_PATH) : `#/${backSection}`;
    const displayTitle = article?.title || fetchPath.split("/").pop() || "文章详情";
    const rendered = resolveArticleImages(stripDuplicateLeadingTitle(sanitized, displayTitle), fetchPath);
    const headerTrail = uniqueTextParts([
      backLabel,
      article?.topic,
      article?.module,
      article?.area,
    ]);
    const articleRoute = articleHref(fetchPath);

    ui.app.innerHTML = `
      <section class="reader${isEnglishReading ? " english-reader" : ""}">
        <aside class="reader-rail">
          <a class="back-link" href="${backHref}">← 返回${backLabel}</a>
          <p class="mono-label">文章目录</p>
          <nav id="article-toc"></nav>
          <small class="reader-rail-hint">TOC / ${fetchPath.split("/").pop() || "ARTICLE"}</small>
        </aside>
        <main class="reader-main">
          <div class="reading-progress" aria-hidden="true"><span id="reading-progress-bar"></span></div>
          <header class="reader-context">
            <a class="back-link reader-context-back" href="${backHref}">← ${backLabel}</a>
            <span><i></i>文章正文</span>
          </header>
          <header class="reader-header">
            <p class="mono-label">${escapeHtml(headerTrail.join(" / ") || "文章")}</p>
            <h1>${escapeHtml(displayTitle)}</h1>
            <div>
              ${article?.date && !isEnglishReading ? `<time>${escapeHtml(article.date)}</time>` : ""}
              ${article?.company ? `<span>${escapeHtml(article.company)}</span>` : ""}
              ${article?.round ? `<span>${escapeHtml(article.round)}</span>` : ""}
              ${article?.score !== null && article?.score !== undefined ? `<span class="score">${scoreText(article.score)}</span>` : ""}
            </div>
            <button id="comment-jump" class="comment-jump" type="button">
              <span>留言</span>
              跳到文章评论区 ↓
            </button>
          </header>
          <p class="reader-provenance">${escapeHtml(article?.contentKind || article?.type || "文章")}${article?.status === "待核验" ? " · 待核验" : ""}${article?.sourceTitle ? ` · 来源：${escapeHtml(article.sourceTitle)}` : ""}${article?.sourceUrl && /^https?:\/\//.test(article.sourceUrl) ? ` · <a href="${escapeHtml(article.sourceUrl)}" target="_blank" rel="noopener noreferrer">原始出处</a>` : ""}${article?.importedAt ? ` · 收录于 ${escapeHtml(article.importedAt)}` : ""}${article?.sourcePublishedAt ? ` · 原文发布 ${escapeHtml(String(article.sourcePublishedAt).slice(0,10))}` : ""}</p>
          <details class="mobile-toc">
            <summary><span>文章目录</span><strong id="mobile-toc-count"></strong></summary>
            <nav id="mobile-article-toc"></nav>
          </details>
          <article id="article-body" class="article-body" lang="${fetchPath.startsWith("content/columns/english-reads/") ? "en" : "zh-CN"}">${rendered}</article>
          ${seriesNavigation(article)}
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
    updateActiveNav(isEnglishReading || fetchPath === ENGLISH_COLLECTION_PATH ? "reading" : backSection);
    const articleBody = document.getElementById("article-body");
    if (isEnglishReading) window.ReaderVocabulary?.mountReader(articleBody, { path: fetchPath, title: displayTitle });
    void highlightCodeBlocks(articleBody);
    const toc = createToc(articleBody, articleRoute);
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
    bindReadingProgress();
    readHistory?.mark(fetchPath);
    rememberGiscusArticleRoute(fetchPath);
    mountComments(fetchPath);
    document.title = `${displayTitle} · 观澜`;
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
  const primary = ["columns","points"].includes(view)||view.startsWith("collection/") ? "learning" : view;
  ui.navLinks.forEach((link) => link.classList.toggle("active", link.dataset.view === primary));
}

async function renderRoute() {
  window.ReaderVocabulary?.detach();
  const route = parseRoute();
  if (route.view !== "search") {
    if (document.activeElement === ui.search) ui.search.blur();
    ui.search.value = "";
  }
  document.body.dataset.view = route.view;
  updateActiveNav(route.view);
  document.title = "观澜 · WY 的读书与实践";
  if (route.view === "article") {
    return renderArticle(route.path, route.params.get("section") || "");
  }
  if (route.view === "search") {
    state.query = (route.params.get("q") || "").trim().toLowerCase();
    ui.search.value = route.params.get("q") || "";
    await renderSearchRoute();
    decorateReadLinks();
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  } else {
    state.query = "";
    ui.search.value = "";
  }
  if (route.view.startsWith("collection/")) { renderCollection(decodeURIComponent(route.view.slice(11))); decorateReadLinks(); window.scrollTo({top:0,behavior:"instant"}); return; }
  const renderers = {
    overview: renderOverview,
    timeline: renderTimeline,
    tasks: () => renderDomain("tasks", "任务", "今日行动摘要与待复盘项。"),
    projects: renderProjects,
    learning: renderLearning,
    points: () => renderPointsPage(parseRoute().params),
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
  };
  (renderers[route.view] || renderOverview)();
  decorateReadLinks();
  window.scrollTo({ top: 0, behavior: "instant" });

}

const BUILD_VERSION = "20261020-1";

async function loadSite() {
  const [response, quickLinks, thirdPartyLinks, learningTaxonomy, githubProfile] = await Promise.all([
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
    fetch(`./data/github-profile.json?v=${BUILD_VERSION}`)
      .then((result) => (result.ok ? result.json() : null))
      .catch(() => null),
  ]);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  state.articles = (Array.isArray(payload) ? payload : payload.articles || []).map(ContentOrganization.organizeArticle);
  state.dashboard = payload.dashboard || {};
  state.columns = payload.columns || [];
  state.projects = payload.projects || [];
  state.githubProfile = githubProfile;
  state.quickLinks = Array.isArray(quickLinks) ? quickLinks : [];
  state.thirdPartyLinks = Array.isArray(thirdPartyLinks) ? thirdPartyLinks : [];
  state.learningAreas = Array.isArray(learningTaxonomy.areas) ? learningTaxonomy.areas : [];
  state.pointsIndex = Array.isArray(payload.pointsIndex) ? payload.pointsIndex : [];
  state.aliases = payload.aliases || {};
  let storage = null;
  try { storage = window.localStorage; } catch { /* Browsing still works without storage. */ }
  readHistory = ReadHistory.createReadHistory(storage, state.aliases);
  await renderRoute();
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
    void renderSearchRoute();
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".nav-more a, .mobile-menu a")) {
    document.querySelectorAll(".nav-more[open], .mobile-menu[open]").forEach((menu) => {
      menu.removeAttribute("open");
    });
    if (event.target.closest(".mobile-search-entry")) ui.search.focus();
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
