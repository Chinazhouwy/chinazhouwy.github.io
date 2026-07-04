const SECTION_LABELS = {
  questions: "题库",
  companies: "公司面经",
  interviews: "模拟面试",
  plans: "计划",
  notes: "技术随记",
};

const ui = {
  app: document.getElementById("app"),
  search: document.getElementById("search-input"),
  navLinks: [...document.querySelectorAll("[data-view]")],
};

const state = {
  articles: [],
  dashboard: {},
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

function matchesSearch(article) {
  if (!state.query) return true;
  const haystack = [
    article.title,
    article.topic,
    article.company,
    article.round,
    article.category,
    ...(article.tags || []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(state.query);
}

function filteredArticles(section) {
  return state.articles.filter(
    (article) => (!section || article.section === section) && matchesSearch(article),
  );
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
  return `
    <a class="article-row" href="${articleHref(article.path)}">
      <span class="article-row-index">${options.index || article.questionNumber || "·"}</span>
      <span class="article-row-main">
        <strong>${escapeHtml(article.title)}</strong>
        <small>
          ${[article.company, article.round, article.topic, article.date]
            .filter(Boolean)
            .map(escapeHtml)
            .join(" · ") || "未分类"}
        </small>
      </span>
      ${
        article.section === "interviews"
          ? `<span class="score ${article.score !== null && article.score < 4 ? "score-low" : ""}">${scoreText(article.score)}</span>`
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
  if (!points.length) return '<div class="chart-empty">完成带日期的练习后，这里会出现趋势。</div>';
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
  const recent = filteredArticles().slice(0, 6);
  const weakTopics = dashboard.weakTopics || [];
  const plans = (dashboard.plans || []).slice(0, 3);
  const dateLabel = formatDate(today.date, { year: "numeric", weekday: "long" });

  ui.app.innerHTML = `
    <section class="dashboard">
      <div class="dashboard-lead reveal">
        <p class="mono-label">${escapeHtml(dateLabel)}</p>
        <h1>今天继续把<br />知识练成能力</h1>
        <p class="lead-copy">${today.count ? `今天已完成 ${today.count} 道题。` : "今天还没有新的练习记录。"} 保持节奏，比偶尔用力更重要。</p>
        <a class="primary-link" href="#/interviews">进入今日模拟 ${iconArrow()}</a>
      </div>

      <aside class="today-panel reveal delay-1">
        <div class="panel-heading">
          <span class="mono-label">TODAY / 今日状态</span>
          <span class="status-dot"></span>
        </div>
        <div class="today-number">
          <strong>${today.count || 0}</strong>
          <span>道题</span>
        </div>
        <dl>
          <div><dt>今日均分</dt><dd>${today.averageScore ?? "—"}</dd></div>
          <div><dt>连续练习</dt><dd>${dashboard.streakDays || 0} 天</dd></div>
          <div><dt>累计记录</dt><dd>${dashboard.totalQuestions || 0} 题</dd></div>
        </dl>
      </aside>

      <div class="metric-strip reveal delay-1">
        <div><span>整体均分</span><strong>${dashboard.averageScore ?? "—"}</strong><small>/ 10</small></div>
        <div><span>已评分</span><strong>${dashboard.scoredQuestions || 0}</strong><small>道</small></div>
        <div><span>知识文章</span><strong>${state.articles.length}</strong><small>篇</small></div>
        <div><span>公司面经</span><strong>${filteredArticles("companies").length}</strong><small>篇</small></div>
      </div>

      <section class="trend-section reveal">
        <div class="section-heading">
          <div><p class="mono-label">PROGRESS / 近 14 天</p><h2>练习趋势</h2></div>
          <div class="chart-legend"><span class="legend-bar">题量</span><span class="legend-line">均分</span></div>
        </div>
        ${lineChart(dashboard.daily || [])}
      </section>

      <section class="focus-section reveal delay-1">
        <div class="section-heading">
          <div><p class="mono-label">FOCUS / 薄弱方向</p><h2>下一步练什么</h2></div>
        </div>
        <div class="weak-list">
          ${
            weakTopics.length
              ? weakTopics
                  .map(
                    (item, index) => `
                      <a href="#/questions?topic=${encodeURIComponent(item.topic)}">
                        <span>${String(index + 1).padStart(2, "0")}</span>
                        <strong>${escapeHtml(item.topic)}</strong>
                        <i style="--level:${Math.max(8, item.averageScore * 10)}%"></i>
                        <em>${item.averageScore}</em>
                      </a>`,
                  )
                  .join("")
              : '<p class="empty-copy">有评分记录后自动生成。</p>'
          }
        </div>
      </section>

      <section class="plan-section reveal">
        <div class="section-heading">
          <div><p class="mono-label">AGENDA / 后续安排</p><h2>今日与下一步</h2></div>
          <a href="#/plans">完整计划 ${iconArrow()}</a>
        </div>
        <div class="plan-list">
          ${
            plans.length
              ? plans
                  .map(
                    (plan, index) => `
                      <a href="${articleHref(plan.path)}">
                        <time>${String(index + 1).padStart(2, "0")}</time>
                        <span><strong>${escapeHtml(plan.title)}</strong><small>打开计划查看今日安排</small></span>
                        ${iconArrow()}
                      </a>`,
                  )
                  .join("")
              : '<p class="empty-copy">暂未找到计划文档。</p>'
          }
        </div>
      </section>

      <section class="recent-section reveal delay-1">
        <div class="section-heading">
          <div><p class="mono-label">LATEST / 最近更新</p><h2>继续阅读</h2></div>
        </div>
        <div class="article-list">${recent.map((item, index) => articleRow(item, { index: String(index + 1).padStart(2, "0") })).join("")}</div>
      </section>
    </section>
  `;
}

function renderQuestions() {
  const items = state.query
    ? state.articles.filter(matchesSearch)
    : filteredArticles("questions").concat(filteredArticles("notes"));
  const groups = groupBy(items, "topic");
  const requestedTopic = new URLSearchParams(location.hash.split("?")[1] || "").get("topic");
  const entries = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  ui.app.innerHTML = `
    <section class="directory-page">
      ${sectionIntro("QUESTION BANK", "题库", "按技术方向重新组织所有知识文章，找到题目，也找到它的上下文。", items.length)}
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
  const items = filteredArticles("companies");
  const groups = Object.entries(groupBy(items, "company", "其他公司")).sort(
    (a, b) => b[1].length - a[1].length,
  );
  ui.app.innerHTML = `
    <section class="directory-page">
      ${sectionIntro("COMPANY FILES", "公司面经", "按公司归档真实面试记录，再按轮次与日期观察不同团队的关注重点。", items.length)}
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
  const items = filteredArticles("interviews");
  const dated = groupBy(items, "date", "日期未记录");
  const days = Object.entries(dated).sort((a, b) => b[0].localeCompare(a[0]));
  ui.app.innerHTML = `
    <section class="directory-page">
      ${sectionIntro("DAILY PRACTICE", "模拟面试", "每次回答、评分和复盘都留下来。这里看见题量，也看见能力曲线。", items.length)}
      <div class="interview-summary reveal delay-1">
        <div><strong>${state.dashboard.averageScore ?? "—"}</strong><span>整体均分</span></div>
        <div><strong>${state.dashboard.scoredQuestions || 0}</strong><span>已评分题目</span></div>
        <div><strong>${days.filter(([day]) => day !== "日期未记录").length}</strong><span>练习日期</span></div>
        <div><strong>${state.dashboard.streakDays || 0}</strong><span>连续天数</span></div>
      </div>
      <div class="interview-days">
        ${days
          .map(([day, articles]) => {
            const dayAverage = average(articles.map((item) => item.score));
            return `
              <section class="interview-day reveal">
                <header>
                  <time>${day === "日期未记录" ? day : formatDate(day, { year: "numeric", weekday: "short" })}</time>
                  <div><strong>${articles.length}</strong><span>题</span><strong>${dayAverage === null ? "—" : dayAverage.toFixed(1)}</strong><span>均分</span></div>
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
  const items = filteredArticles("plans");
  ui.app.innerHTML = `
    <section class="directory-page plan-page">
      ${sectionIntro("ROADMAP", "计划", "把下一道题、下一次复习和下一篇文章放在同一条长期路径上。", items.length)}
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

async function renderArticle(path) {
  const article = state.articles.find((item) => item.path === path);
  if (!article) {
    renderError("没有找到这篇文章", "它可能已被移动，返回总览重新选择。");
    return;
  }
  ui.app.innerHTML = '<div class="loading-state"><span></span><p>正在展开文章…</p></div>';
  try {
    const response = await fetch(`./${article.path}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.text();
    const content = raw.startsWith("---") ? raw.replace(/^---\n[\s\S]*?\n---\n?/, "") : raw;
    const rendered = DOMPurify.sanitize(marked.parse(content));
    ui.app.innerHTML = `
      <section class="reader">
        <aside class="reader-rail">
          <a class="back-link" href="#/${article.section === "interviews" ? "interviews" : article.section === "companies" ? "companies" : article.section === "plans" ? "plans" : "questions"}">← 返回${SECTION_LABELS[article.section] || "题库"}</a>
          <p class="mono-label">CONTENTS</p>
          <nav id="article-toc"></nav>
        </aside>
        <main class="reader-main">
          <header class="reader-header">
            <p class="mono-label">${escapeHtml([SECTION_LABELS[article.section], article.topic].filter(Boolean).join(" / "))}</p>
            <h1>${escapeHtml(article.title)}</h1>
            <div>
              ${article.date ? `<time>${escapeHtml(article.date)}</time>` : ""}
              ${article.company ? `<span>${escapeHtml(article.company)}</span>` : ""}
              ${article.round ? `<span>${escapeHtml(article.round)}</span>` : ""}
              ${article.score !== null ? `<span class="score">${scoreText(article.score)}</span>` : ""}
            </div>
          </header>
          <article id="article-body" class="article-body">${rendered}</article>
        </main>
      </section>
    `;
    document.getElementById("article-toc").innerHTML = createToc(document.getElementById("article-body"));
    document.title = `${article.title} · WY 面试实验室`;
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
  document.title = "WY 面试实验室";
  if (route.view === "article") return renderArticle(route.path);
  const renderers = {
    overview: renderOverview,
    questions: renderQuestions,
    companies: renderCompanies,
    interviews: renderInterviews,
    plans: renderPlans,
  };
  (renderers[route.view] || renderOverview)();
  window.scrollTo({ top: 0, behavior: "instant" });
}

async function loadSite() {
  const response = await fetch("./site-index.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  state.articles = Array.isArray(payload) ? payload : payload.articles || [];
  state.dashboard = payload.dashboard || {};
  await renderRoute();
}

ui.search.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  const route = parseRoute();
  if (route.view === "article" || route.view === "overview") {
    location.hash = "/questions";
  } else {
    renderRoute();
  }
});

window.addEventListener("hashchange", renderRoute);

loadSite().catch((error) => {
  console.error(error);
  renderError("站点索引加载失败", `${error.message}。构建任务可能尚未完成。`, true);
});
