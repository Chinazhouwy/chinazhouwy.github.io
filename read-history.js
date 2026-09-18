(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ReadHistory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const key = "wy_read_articles_v1";

  function createReadHistory(storage, aliases = {}) {
    let saved = [];
    try {
      const parsed = JSON.parse(storage?.getItem(key) || "[]");
      if (Array.isArray(parsed)) saved = parsed.filter((path) => typeof path === "string");
    } catch {
      // Private browsing and disabled storage still allow this session to work.
    }
    const paths = new Set(saved);
    const canonical = (path) => aliases[path] || path;
    return {
      has(path) { return paths.has(canonical(path)); },
      mark(path) {
        const resolved = canonical(path);
        if (!resolved) return;
        paths.add(resolved);
        try { storage?.setItem(key, JSON.stringify([...paths])); } catch { /* Session-only fallback. */ }
      },
    };
  }

  return { createReadHistory };
});
