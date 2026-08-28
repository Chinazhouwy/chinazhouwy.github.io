const SECTION_LABELS = {
  tasks: "行动摘要",
  timeline: "时光轴",
  projects: "项目",
  learning: "学习",
  opportunity: "机会",
  reading: "阅读",
  columns: "专栏",
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
  return theme === "nova" ? "深空" : "亮色";
}

function giscusTheme(theme) {
  return theme === "nova" ? "noborder_dark" : "light";
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
  if (themeColor) themeColor.content = isDark ? "#05070f" : "#f4f8ff";

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
  quickLinks: [],
  thirdPartyLinks: [],
  learningAreas: [],
  aliases: {},
  searchIndex: new Map(),
  searchIndexLoaded: false,
  searchIndexPromise: null,
  query: "",
  timelineFilter: "all",
  timelineVisibleDays: 12,
};

let markdownLibrariesPromise = null;

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
  const rowMeta = [article.company, article.round, article.topic || article.module || article.area, article.date]
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
        <span>当前日期</span>
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

function renderOverview() {
  const newestFirst = (left, right) => knowledgeRecordDate(right).localeCompare(knowledgeRecordDate(left));
  const publicArticles = state.articles.filter(canShowOnHome).filter(matchesSearch).sort(newestFirst);
  const latestWriting = publicArticles
    .filter((article) => !["about", "reading", "questions", "companies", "interviews", "plans"].includes(getArticleSection(article)))
    .slice(0, 7);
  const readingItems = publicArticles
    .filter((article) => normalizeSection(getArticleSection(article)) === "reading")
    .slice(0, 3);
  const featuredArticle = latestWriting[0];
  const writingList = latestWriting.slice(1);
  const projectRoute = (project) => ({
    "opportunity-radar": "#/opportunity",
    "source-code-research": "#/learning",
    "reading-life": "#/reading",
  })[project.id] || "#/projects";
  const datedValues = publicArticles
    .map(knowledgeRecordDate)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  const dateSpan = datedValues.length
    ? Math.max(1, Math.round((Date.parse(`${datedValues.at(-1)}T00:00:00Z`) - Date.parse(`${datedValues[0]}T00:00:00Z`)) / 86400000) + 1)
    : 0;
  const mapArticles = publicArticles.filter((article) => normalizeSection(getArticleSection(article)) !== "about");
  const activeLanes = new Set(mapArticles.map((article) => knowledgeLane(article).id));

  ui.app.innerHTML = `
    <section class="nova-home">
      <header class="nova-masthead reveal">
        <div class="nova-system-line">
          <span>WY / NEBULA ARCHIVE</span>
          <span>LIVE SIGNALS · 2026</span>
        </div>

        <div class="nova-hero">
          <div class="nova-hero-copy">
            <p class="nova-coordinate">ORBITAL LOG / 001 · CONTINUOUS NOTES</p>
            <h1><span>星云</span><em>档案</em></h1>
            <p class="nova-deck">把项目、源码、阅读与每一次练习，标记成一条可以回望的轨道。每一篇记录，都是一颗被点亮的星体。</p>
            <div class="nova-actions">
              <a href="#/timeline">进入时间轨道 ${iconArrow()}</a>
              <a href="#/learning">浏览知识星域</a>
            </div>
          </div>

          <div class="nova-orbit-visual" aria-hidden="true">
            <div class="nova-orbit nova-orbit--one"><i></i><i></i></div>
            <div class="nova-orbit nova-orbit--two"><i></i><i></i><i></i></div>
            <div class="nova-orbit nova-orbit--three"><i></i><i></i></div>
            <div class="nova-orbit-core"><span>WY</span><small>ORIGIN</small></div>
            <p class="nova-orbit-quote">人间尚有春风在，<br />何妨从头再少年。</p>
          </div>
        </div>

        <dl class="nova-stats" aria-label="公开知识库概览">
          <div><dt>SIGNALS / 公开记录</dt><dd>${publicArticles.length}</dd></div>
          <div><dt>FIELDS / 知识域</dt><dd>${activeLanes.size}</dd></div>
          <div><dt>SPAN / 日跨度</dt><dd>${dateSpan}</dd></div>
          <div><dt>ORBITS / 长期项目</dt><dd>${state.projects.length}</dd></div>
        </dl>
      </header>

      <div class="nova-dashboard">
        <section class="nova-panel nova-panel--map reveal delay-1">
          <header class="nova-panel-heading">
            <div><span>01 / CONTRIBUTION GRID</span><h2>公开文章贡献图</h2></div>
            <p>每格 = 1 天 · 颜色越深 = 当天公开文章越多</p>
          </header>
          <div class="nova-panel-body">${renderContributionMap(mapArticles)}</div>
        </section>

        <aside class="nova-panel nova-panel--now reveal delay-1">
          <header class="nova-panel-heading">
            <div><span>02 / LIVE SIGNAL</span><h2>最新信号</h2></div>
            <a href="${featuredArticle ? articleHref(featuredArticle.path) : "#/timeline"}">打开 ${iconArrow()}</a>
          </header>
          <div class="nova-now-card">
            ${
              featuredArticle
                ? `
                  <p>${escapeHtml(knowledgeLane(featuredArticle).label)} · ${escapeHtml(knowledgeRecordDate(featuredArticle) || "持续更新")}</p>
                  <h3>${escapeHtml(featuredArticle.title)}</h3>
                  <em>${escapeHtml(featuredArticle.summary || "打开阅读全文")}</em>
                  <a href="${articleHref(featuredArticle.path)}">阅读全文 ${iconArrow()}</a>`
                : `<span>SIGNAL</span><h3>下一条信号正在生成。</h3>`
            }
          </div>
          <dl class="nova-mini-metrics">
            <div><dt>LAST SEEN</dt><dd>${(datedValues.at(-1) || "—").replaceAll("-", ".")}</dd></div>
            <div><dt>READING</dt><dd>${readingItems.length}</dd></div>
            <div><dt>ACTIVE LANES</dt><dd>${activeLanes.size}</dd></div>
          </dl>
        </aside>

        <section class="nova-panel nova-panel--orbits reveal">
          <header class="nova-panel-heading">
            <div><span>03 / ACTIVE ORBITS</span><h2>正在推进的轨道</h2></div>
            <a href="#/projects">全部项目 ${iconArrow()}</a>
          </header>
          <div class="nova-orbit-list">
            ${state.projects
              .map(
                (project, index) => `
                  <a class="nova-orbit-row" href="${projectRoute(project)}">
                    <span class="nova-orbit-index">${String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>${escapeHtml(project.name)}</h3>
                      <p>${escapeHtml(project.summary || "持续建设")}</p>
                    </div>
                    <dl>
                      <div><dt>priority</dt><dd>${escapeHtml(project.priority || "P1")}</dd></div>
                      <div><dt>state</dt><dd>${escapeHtml(project.status || "进行中")}</dd></div>
                    </dl>
                    ${iconArrow()}
                  </a>`,
              )
              .join("") || '<p class="nova-empty">项目轨道等待补充。</p>'}
          </div>
        </section>

        <section class="nova-panel nova-panel--signals reveal">
          <header class="nova-panel-heading">
            <div><span>04 / SIGNAL STREAM</span><h2>最近信号</h2></div>
            <a href="#/timeline">完整时光轴 ${iconArrow()}</a>
          </header>
          <div class="nova-signal-grid">
            ${
              writingList.length
                ? writingList
                    .map(
                      (article, index) => `
                        <a class="nova-signal-card" href="${articleHref(article.path)}">
                          <span>${String(index + 2).padStart(3, "0")}</span>
                          <p>${escapeHtml(knowledgeLane(article).label)} · ${escapeHtml(knowledgeRecordDate(article) || "持续更新")}</p>
                          <h3>${escapeHtml(article.title)}</h3>
                          <em>${escapeHtml(article.summary || "打开阅读全文")}</em>
                          ${iconArrow()}
                        </a>`,
                    )
                    .join("")
                : '<p class="nova-empty">更多信号正在整理。</p>'
            }
          </div>
        </section>

        <section class="nova-panel nova-panel--references reveal">
          <header class="nova-panel-heading">
            <div><span>05 / REFERENCES</span><h2>阅读与参考</h2></div>
            <a href="#/reading">进入阅读 ${iconArrow()}</a>
          </header>
          <div class="nova-reference-strip">
            ${
              readingItems.length
                ? readingItems
                    .map(
                      (article, index) => `
                        <a href="${articleHref(article.path)}">
                          <span>[R${index + 1}]</span>
                          <div><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.summary || "阅读沉淀")}</p></div>
                          <time>${escapeHtml(knowledgeRecordDate(article) || "持续更新")}</time>
                        </a>`,
                    )
                    .join("")
                : '<p class="nova-empty">阅读星域已建立，等待第一篇沉淀。</p>'
            }
          </div>
        </section>
      </div>

      <footer class="nova-closing reveal">
        <span>END / CURRENT SIGNAL</span>
        <p>索引会随记录更新，贡献图也会随之改变。</p>
        <a href="#/timeline">继续查看全部记录 ${iconArrow()}</a>
      </footer>
    </section>
  `;

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
  const articles = filteredArticles("projects");
  ui.app.innerHTML = `
    <section class="directory-page project-directory-page">
      ${sectionIntro("PROJECTS", "项目", "自研项目、工程源码研究和长期建设。", state.projects.length)}
      <div class="project-signal-grid reveal delay-1">
        ${state.projects
          .map((project, index) => {
            const priority = String(project.priority || "P2").toLowerCase();
            return `
              <article class="project-signal-card" data-priority="${escapeHtml(priority)}">
                <header>
                  <span class="project-signal-index">PRJ / ${String(index + 1).padStart(2, "0")}</span>
                  <em class="project-signal-state"><i aria-hidden="true"></i>${escapeHtml(project.status || "进行中")}</em>
                </header>
                <div class="project-signal-body">
                  <small>${escapeHtml(project.priority || "P2")} · ACTIVE ORBIT</small>
                  <h2>${escapeHtml(project.name)}</h2>
                  <p>${escapeHtml(project.summary || "等待补充项目说明。")}</p>
                </div>
                <footer>
                  <span>NEXT SIGNAL</span>
                  <strong>${escapeHtml(project.next_public_step || "继续建设")}</strong>
                </footer>
              </article>`;
          })
          .join("") || '<p class="empty-copy">项目清单等待补充。</p>'}
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
    diagram: "computer-map",
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
        ${examNoteDiagram(visual.diagram)}
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
  const items = filteredArticles("learning");
  const noteAreas = new Set(["数学", "计算机基础"]);
  const areaOrder = new Map(state.learningAreas.map((area, index) => [area.name, index]));
  const groups = Object.entries(groupBy(items, "area", "综合")).sort(
    ([left], [right]) =>
      (areaOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (areaOrder.get(right) ?? Number.MAX_SAFE_INTEGER) ||
      left.localeCompare(right, "zh-CN"),
  );
  const noteGroups = groups.filter(([area]) => noteAreas.has(area));
  const standardGroups = groups.filter(([area]) => !noteAreas.has(area));
  const compactGroupCount = standardGroups.filter(([, articles]) => articles.length > LEARNING_PREVIEW_COUNT).length;

  ui.app.innerHTML = `
    <section class="directory-page learning-page">
      ${sectionIntro("LEARNING", "学习", "技术知识、源码笔记与可复习内容。", items.length)}
      ${noteGroups.length ? examNoteStudio(noteGroups) : ""}
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
      <div class="learning-board">
        ${
          standardGroups.length
            ? standardGroups
                .map(([area, articles], index) => {
                  const collapsible = articles.length > LEARNING_PREVIEW_COUNT;
                  const listId = `learning-topic-${index}`;
                  return `
                    <section class="learning-card learning-group reveal${collapsible ? " is-collapsed" : ""}" data-learning-group data-learning-area="${escapeHtml(area)}">
                      <header class="learning-card-header">
                        <div class="learning-card-title">
                          <p>LEARNING FIELD / ${String(index + 1).padStart(2, "0")}</p>
                          <h2>${escapeHtml(area)}</h2>
                          <span>${articles.length} 篇记录</span>
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
  const categoryOrder = new Map(
    READING_CATEGORIES.map((category, index) => [category.label, index]),
  );
  const groups = Object.entries(
    items.reduce((acc, item) => {
      const key = normalizeReadingArea(item);
      acc[key] ||= [];
      acc[key].push(item);
      return acc;
    }, {}),
  ).sort((left, right) => {
    return (categoryOrder.get(left[0]) ?? Number.MAX_SAFE_INTEGER) -
      (categoryOrder.get(right[0]) ?? Number.MAX_SAFE_INTEGER);
  });

  ui.app.innerHTML = `
    <section class="directory-page reading-directory-page">
      ${sectionIntro("READING", "阅读", "闲暇输入、网页剪藏、读书札记和个人观察。这里不追求每篇都成体系，先保留思考痕迹。", items.length)}
      <div class="directory-groups">
        ${
          groups.length
            ? groups
                .map(
                  ([area, articles], index) => `
                    <section class="directory-group reading-group reveal" style="--delay:${index * 45}ms">
                      <header>
                        <small class="reading-group-code">FIELD / ${String(index + 1).padStart(2, "0")}</small>
                        <h2>${escapeHtml(area)}</h2>
                        <span>${articles.length} 篇记录</span>
                      </header>
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
    return;
  }

  const requestedQuery = state.query;
  ui.app.innerHTML = '<div class="loading-state"><span></span><p>正在加载搜索索引…</p></div>';
  try {
    await ensureSearchIndex();
    if (parseRoute().view !== "search" || state.query !== requestedQuery) return;
    renderSearch();
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
    document.title = "关于 WY · 星云档案";
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
    const markdownLibraries = ensureMarkdownLibraries();
    const response = await fetch(`./${fetchPath}?v=${BUILD_VERSION}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    const content = raw.startsWith("---") ? raw.replace(/^---\n[\s\S]*?\n---\n?/, "") : raw;
    await markdownLibraries;
    const sanitized = window.DOMPurify.sanitize(window.marked.parse(content));

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
          <p class="mono-label">ON THIS ORBIT</p>
          <nav id="article-toc"></nav>
          <small class="reader-rail-hint">TOC / ${fetchPath.split("/").pop() || "ARTICLE"}</small>
        </aside>
        <main class="reader-main">
          <div class="reading-progress" aria-hidden="true"><span id="reading-progress-bar"></span></div>
          <header class="reader-context">
            <a class="back-link reader-context-back" href="#/${backSection}">← ${backLabel}</a>
            <span><i></i>READING SIGNAL</span>
          </header>
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
    bindReadingProgress();
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
  document.title = "WY · 星云档案 / Nebula Archive";
  if (route.view === "article") {
    return renderArticle(route.path, route.params.get("section") || "");
  }
  if (route.view === "search") {
    state.query = (route.params.get("q") || "").trim().toLowerCase();
    ui.search.value = route.params.get("q") || "";
    await renderSearchRoute();
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
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
  };
  (renderers[route.view] || renderOverview)();
  window.scrollTo({ top: 0, behavior: "instant" });

}

const BUILD_VERSION = "20260828-4";

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
