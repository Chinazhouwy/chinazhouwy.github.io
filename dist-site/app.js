const CATEGORY_ORDER = [
  "ai-agent",
  "java",
  "middleware",
  "practice",
  "frontend",
  "industry",
  "tencent",
  "kuaishou",
  "oppo",
  "sf",
  "tiktok",
  "three-squirrels",
  "chayanyuese",
  "references",
  "tech-notes",
];

const ui = {
  nav: document.getElementById("category-nav"),
  recent: document.getElementById("recent-list"),
  title: document.getElementById("article-title"),
  meta: document.getElementById("article-meta"),
  category: document.getElementById("article-category"),
  body: document.getElementById("article-body"),
  search: document.getElementById("search-input"),
  toggle: document.getElementById("toggle-nav"),
  sidebar: document.querySelector(".sidebar"),
};

let siteIndex = [];

marked.setOptions({
  breaks: true,
  gfm: true,
});

function humanizeCategory(name) {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) {
    return { meta: {}, content: raw };
  }
  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    return { meta: {}, content: raw };
  }
  const frontmatter = raw.slice(3, end).trim();
  const content = raw.slice(end + 4).trimStart();
  const meta = {};
  let currentListKey = null;

  for (const line of frontmatter.split("\n")) {
    const listItem = line.match(/^\s*-\s*(.+)$/);
    if (listItem && currentListKey) {
      meta[currentListKey] ||= [];
      meta[currentListKey].push(listItem[1].trim().replace(/^["']|["']$/g, ""));
      continue;
    }

    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) {
      continue;
    }

    const [, key, rawValue] = pair;
    const value = rawValue.trim();

    if (!value) {
      currentListKey = key;
      meta[key] = [];
      continue;
    }

    currentListKey = null;
    meta[key] = value.replace(/^["']|["']$/g, "");
  }

  return { meta, content };
}

function getArticleId(item) {
  return encodeURIComponent(item.path);
}

function getHashPath() {
  return decodeURIComponent(location.hash.replace(/^#/, ""));
}

function setHashPath(path) {
  if (getHashPath() === path) {
    return;
  }
  location.hash = encodeURIComponent(path);
}

function renderNav(items) {
  const query = ui.search.value.trim().toLowerCase();
  const grouped = new Map();

  for (const item of items) {
    if (query) {
      const haystack = `${item.title} ${item.category} ${(item.tags || []).join(" ")}`.toLowerCase();
      if (!haystack.includes(query)) {
        continue;
      }
    }

    if (!grouped.has(item.category)) {
      grouped.set(item.category, []);
    }
    grouped.get(item.category).push(item);
  }

  const orderedCategories = [...grouped.keys()].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  ui.nav.innerHTML = orderedCategories
    .map((category) => {
      const links = grouped
        .get(category)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .map((item) => {
          const active = getHashPath() === item.path ? "active" : "";
          return `<a class="nav-link ${active}" href="#${getArticleId(item)}" data-path="${item.path}">${item.title}</a>`;
        })
        .join("");
      return `
        <details class="nav-group" open>
          <summary>${humanizeCategory(category)} <span>${grouped.get(category).length}</span></summary>
          <div class="nav-items">${links}</div>
        </details>
      `;
    })
    .join("");

  if (!ui.nav.innerHTML) {
    ui.nav.innerHTML = '<div class="empty-state">没有匹配到文章。</div>';
  }
}

function renderRecent(items) {
  ui.recent.innerHTML = items
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 10)
    .map((item) => `<a class="recent-link" href="#${getArticleId(item)}">${item.title}</a>`)
    .join("");
}

async function renderArticle(path) {
  const current = siteIndex.find((item) => item.path === path) || siteIndex[0];
  if (!current) {
    ui.title.textContent = "没有可展示的文章";
    ui.meta.textContent = "";
    ui.category.textContent = "";
    ui.body.innerHTML = '<div class="empty-state">当前没有找到 Markdown 内容。</div>';
    return;
  }

  const response = await fetch(`./${current.path}`);
  const raw = await response.text();
  const { meta, content } = parseFrontmatter(raw);
  const title = meta.title || current.title;
  const tags = Array.isArray(meta.tags) ? meta.tags : current.tags || [];
  const date = meta.date || current.date || "";

  ui.title.textContent = title;
  ui.category.textContent = humanizeCategory(current.category);
  ui.meta.textContent = [date, tags.length ? `标签：${tags.join(" / ")}` : ""].filter(Boolean).join(" · ");
  ui.body.innerHTML = marked.parse(content);
  document.title = `${title} · WY 阅读站`;
  setHashPath(current.path);
  renderNav(siteIndex);
}

async function loadSiteIndex() {
  const response = await fetch("./site-index.json");
  siteIndex = await response.json();
  renderRecent(siteIndex);
  renderNav(siteIndex);
  await renderArticle(getHashPath() || siteIndex[0]?.path);
}

ui.search.addEventListener("input", () => renderNav(siteIndex));
ui.toggle.addEventListener("click", () => ui.sidebar.classList.toggle("open"));
window.addEventListener("hashchange", () => renderArticle(getHashPath()));

loadSiteIndex().catch((error) => {
  console.error(error);
  ui.title.textContent = "加载失败";
  ui.body.innerHTML = `<div class="empty-state">站点索引加载失败：${error.message}</div>`;
});
