(function exposeContentTaxonomy(root, factory) {
  const taxonomy = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = taxonomy;
  }
  if (root) {
    root.ContentTaxonomy = taxonomy;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createContentTaxonomy() {
  "use strict";

  const KNOWLEDGE_LANES = Object.freeze([
    Object.freeze({ id: "agent", code: "A", label: "AGENT / AI" }),
    Object.freeze({ id: "systems", code: "S", label: "SYSTEMS / JAVA" }),
    Object.freeze({ id: "interface", code: "I", label: "INTERFACE / WEB" }),
    Object.freeze({ id: "security", code: "R", label: "SECURITY / RELIABILITY" }),
    Object.freeze({ id: "theory", code: "T", label: "THEORY / MATH" }),
    Object.freeze({ id: "reading", code: "L", label: "READING / LIFE" }),
  ]);
  const KNOWLEDGE_LANE_MAP = Object.freeze(
    Object.fromEntries(KNOWLEDGE_LANES.map((lane) => [lane.id, lane])),
  );

  const READING_CATEGORIES = Object.freeze([
    Object.freeze({ id: "world", label: "世界观察" }),
    Object.freeze({ id: "market", label: "市场与商业" }),
    Object.freeze({ id: "history", label: "历史与文明" }),
    Object.freeze({ id: "books", label: "书与长文" }),
    Object.freeze({ id: "life", label: "生活与审美" }),
    Object.freeze({ id: "clips", label: "剪藏箱" }),
  ]);
  const READING_CATEGORY_MAP = Object.freeze(
    Object.fromEntries(READING_CATEGORIES.map((category) => [category.id, category])),
  );
  const READING_CATEGORY_LABEL_MAP = Object.freeze(
    Object.fromEntries(READING_CATEGORIES.map((category) => [category.label, category])),
  );

  const READING_PATTERNS = Object.freeze({
    history: ["history", "历史", "文明", "古代", "史学", "朝代"],
    world: [
      "politics", "society", "policy", "world", "geopolit", "management", "organization",
      "社会", "政治", "政策", "世界", "地缘", "管理", "组织", "公共治理", "国际关系",
    ],
    market: [
      "finance", "market", "industry", "business", "econom", "investment", "stock", "fund",
      "金融", "市场", "行业", "商业", "经济", "投资", "股票", "基金", "货币", "宏观",
    ],
    books: ["book", "booklist", "essay", "paper", "读书", "书单", "书籍", "长文", "论文", "札记", "文集"],
    life: [
      "hobbies", "life", "personal", "health", "career", "aesthetic",
      "生活", "个人", "健康", "养生", "职业", "审美", "随笔", "远程工作",
    ],
    clips: ["clip", "clipping", "剪藏", "摘录"],
  });

  function textFrom(values) {
    return values
      .flat(Infinity)
      .filter((value) => value !== undefined && value !== null && String(value).trim())
      .join(" ")
      .toLowerCase();
  }

  function matchesReadingCategory(source, categoryId) {
    return READING_PATTERNS[categoryId].some((term) => source.includes(term));
  }

  function firstReadingCategory(source, categoryIds) {
    const id = categoryIds.find((categoryId) => matchesReadingCategory(source, categoryId));
    return id ? READING_CATEGORY_MAP[id].label : "";
  }

  function resolveReadingCategory(value = "") {
    const explicit = String(value || "").trim();
    return READING_CATEGORY_MAP[explicit] || READING_CATEGORY_LABEL_MAP[explicit] || null;
  }

  function normalizeReadingCategory(article = {}) {
    const explicit = resolveReadingCategory(article.readingCategory);
    if (explicit) return explicit.label;

    const articlePath = String(article.path || "");
    const pathDirectory = articlePath.includes("/")
      ? articlePath.slice(0, articlePath.lastIndexOf("/") + 1)
      : "";
    const structural = textFrom([
      article.area,
      article.category,
      article.folder,
      pathDirectory,
    ]);
    const semantic = textFrom([articlePath, article.title, article.tags]);

    // Strong path/area signals win. Broad personal-note paths are delayed so
    // a title such as "书单" can still be classified as long-form reading.
    const structuralCategory = firstReadingCategory(
      structural,
      ["history", "world", "market", "books", "clips"],
    );
    if (structuralCategory) return structuralCategory;

    const semanticCategory = firstReadingCategory(
      semantic,
      ["history", "books", "world", "market", "life", "clips"],
    );
    if (semanticCategory) return semanticCategory;

    if (matchesReadingCategory(structural, "life")) return READING_CATEGORY_MAP.life.label;
    return READING_CATEGORY_MAP.clips.label;
  }

  function inferKnowledgeLane(article = {}, section = "") {
    const normalizedSection = String(section || article.section || "").toLowerCase();
    const terms = textFrom([
      article.path,
      article.area,
      article.module,
      article.topic,
      article.category,
      article.title,
      article.tags,
    ]);

    if (normalizedSection === "reading" || terms.includes("content/reading/")) {
      return KNOWLEDGE_LANE_MAP.reading;
    }
    if (/security|secure|xss|csrf|攻击|安全|注入|越权|漏洞|可靠性|故障/.test(terms)) {
      return KNOWLEDGE_LANE_MAP.security;
    }
    if (/theory|math|calculus|algebra|probability|statistics|formal methods|computation theory|physics|高数|高等数学|线代|线性代数|概率|统计|数学|算法理论|形式化|计算理论|物理/.test(terms)) {
      return KNOWLEDGE_LANE_MAP.theory;
    }
    if (/agent|llm|claude|hermes|mcp|codex|openai|大模型|语言模型|智能体/.test(terms)) {
      return KNOWLEDGE_LANE_MAP.agent;
    }
    if (/frontend|html|css|vue|react|typescript|javascript|前端|浏览器/.test(terms)) {
      return KNOWLEDGE_LANE_MAP.interface;
    }
    return KNOWLEDGE_LANE_MAP.systems;
  }

  function resolveKnowledgeLane(article = {}, section = "") {
    const explicit = String(article.lane || "").trim();
    return KNOWLEDGE_LANE_MAP[explicit] || inferKnowledgeLane(article, section);
  }

  function validateTaxonomyMetadata(meta = {}) {
    const errors = [];
    const lane = String(meta.lane || "").trim();
    const readingCategory = String(meta.readingCategory || "").trim();

    if (lane && !KNOWLEDGE_LANE_MAP[lane]) {
      errors.push(`lane 必须是 ${KNOWLEDGE_LANES.map((item) => item.id).join("/")}，实际为 ${lane}`);
    }
    if (readingCategory && !resolveReadingCategory(readingCategory)) {
      errors.push(
        `readingCategory 必须是 ${READING_CATEGORIES.map((item) => item.id).join("/")}（兼容已有中文标签），实际为 ${readingCategory}`,
      );
    }
    return errors;
  }

  return Object.freeze({
    KNOWLEDGE_LANES,
    KNOWLEDGE_LANE_MAP,
    READING_CATEGORIES,
    inferKnowledgeLane,
    normalizeReadingCategory,
    resolveReadingCategory,
    resolveKnowledgeLane,
    validateTaxonomyMetadata,
  });
});
