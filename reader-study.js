/* Optional translations and sentence notes for the existing English reader. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ReaderStudy = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const ENGLISH_PREFIX = "content/columns/english-reads/";
  const AUX_CLASS = "reader-study-aux";
  const cleanText = value => typeof value === "string" ? value.trim() : "";
  let active = null;
  let instance = 0;

  function normalizeText(value) {
    return cleanText(value).replace(/\s+/gu, " ");
  }

  function safePath(value) {
    return typeof value === "string" && /^content\/columns\/english-reads\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(value) ? value : "";
  }

  function studyUrl(path, version = "") {
    const safe = safePath(path);
    if (!safe) return "";
    const stem = safe.slice(ENGLISH_PREFIX.length, -3);
    return `./content/columns/english-reads-study/${stem}.json?v=${encodeURIComponent(String(version))}`;
  }

  function normalizeStudy(value, expectedPath) {
    if (!value || value.schemaVersion !== 1 || !safePath(value.path) || value.path !== expectedPath) {
      throw new Error("学习辅助文件版本或文章路径不匹配");
    }
    if (!Array.isArray(value.paragraphs) || !Array.isArray(value.sentenceNotes)) {
      throw new Error("学习辅助文件缺少段落或解析列表");
    }
    const paragraphs = value.paragraphs.map(paragraph => {
      if (!paragraph || !normalizeText(paragraph.english) ||
          (paragraph.chinese != null && typeof paragraph.chinese !== "string")) {
        throw new Error("学习辅助文件包含无效段落");
      }
      return { english: cleanText(paragraph.english), chinese: cleanText(paragraph.chinese) };
    });
    const sentenceNotes = value.sentenceNotes.filter(note => note && normalizeText(note.sentence)).map(note => ({
      sentence: cleanText(note.sentence), mainClause: cleanText(note.mainClause),
      structure: cleanText(note.structure), translation: cleanText(note.translation), tip: cleanText(note.tip),
    }));
    return { schemaVersion: 1, title: cleanText(value.title), path: value.path, paragraphs, sentenceNotes };
  }

  // Only unique, complete paragraph text matches are safe to attach. Never use a
  // positional fallback: an omitted or edited paragraph must not shift a translation.
  function matchParagraphs(bodyTexts, paragraphs) {
    const indexes = new Map();
    bodyTexts.forEach((value, index) => {
      const text = normalizeText(value);
      if (!indexes.has(text)) indexes.set(text, []);
      indexes.get(text).push(index);
    });
    const counts = new Map();
    paragraphs.forEach(paragraph => {
      const text = normalizeText(paragraph.english);
      counts.set(text, (counts.get(text) || 0) + 1);
    });
    const matches = [], unmatched = [], ambiguous = [];
    paragraphs.forEach((paragraph, sourceIndex) => {
      const text = normalizeText(paragraph.english);
      const positions = indexes.get(text) || [];
      if (!text || !positions.length) unmatched.push(sourceIndex);
      else if (positions.length !== 1 || counts.get(text) !== 1) ambiguous.push(sourceIndex);
      else matches.push({ bodyIndex: positions[0], sourceIndex, ...paragraph });
    });
    return { matches, unmatched, ambiguous };
  }

  function collectParagraphs(body) {
    return Array.from(body.children).filter(node => {
      if (node.tagName !== "P" || node.hasAttribute("data-reader-study-aux")) return false;
      if (!normalizeText(node.textContent)) return false;
      // Archive disclaimers are single italic paragraphs; the footer is links
      // separated by arrows/dots rather than an English prose paragraph.
      if (node.children.length === 1 && node.firstElementChild.tagName === "EM" &&
          normalizeText(node.firstElementChild.textContent) === normalizeText(node.textContent)) return false;
      if (node.querySelector("a")) {
        const copy = node.cloneNode(true);
        copy.querySelectorAll("a").forEach(link => link.remove());
        if (!/[\p{L}\p{N}]/u.test(copy.textContent)) return false;
      }
      return true;
    });
  }

  function node(session, tag, text = "", className = "") {
    const result = session.body.ownerDocument.createElement(tag);
    if (text) result.textContent = text;
    if (className) result.className = className;
    return result;
  }

  function auxiliary(session, tag, className) {
    const result = node(session, tag, "", `${AUX_CLASS} ${className}`);
    result.setAttribute("data-reader-study-aux", "");
    result.lang = "zh-CN";
    return result;
  }

  function isCurrent(session, generation) {
    return active === session && !session.controller.signal.aborted &&
      session.generation === generation && session.body.isConnected;
  }

  function updateControls(session) {
    const allOpen = session.translations.length > 0 && session.translations.every(item => !item.translation.hidden);
    const all = session.all;
    all.hidden = session.translations.length === 0;
    all.disabled = session.translations.length === 0;
    all.setAttribute("aria-pressed", String(allOpen));
    all.setAttribute("aria-expanded", String(allOpen));
    all.textContent = allOpen ? "收起全部译文" : session.translations.length < session.paragraphs.length ? "显示已有译文" : "显示全文翻译";
    if (session.translations.length) all.setAttribute("aria-controls", session.translations.map(item => item.translation.id).join(" "));
    else all.removeAttribute("aria-controls");
    session.translations.forEach(({ button, translation }) => {
      button.textContent = translation.hidden ? "显示本段翻译" : "收起本段翻译";
      button.setAttribute("aria-expanded", String(!translation.hidden));
      button.setAttribute("aria-pressed", String(!translation.hidden));
    });
  }

  function renderStudy(session, data) {
    const texts = session.paragraphs.map(paragraph => paragraph.textContent);
    const matched = matchParagraphs(texts, data.paragraphs);
    const byIndex = new Map(matched.matches.map(match => [match.bodyIndex, match]));
    session.paragraphs.forEach((paragraph, index) => {
      const match = byIndex.get(index);
      const wrapper = auxiliary(session, "div", "reader-study-paragraph");
      session.nodes.push(wrapper);
      if (match?.chinese) {
        const id = `reader-study-${session.id}-translation-${index + 1}`;
        const button = node(session, "button", "显示本段翻译", "reader-study-button reader-study-paragraph-button");
        button.type = "button";
        button.setAttribute("aria-controls", id);
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-pressed", "false");
        const translation = node(session, "div", match.chinese, "reader-study-translation");
        translation.id = id;
        translation.lang = "zh-CN";
        translation.hidden = true;
        button.addEventListener("click", () => {
          translation.hidden = !translation.hidden;
          updateControls(session);
        });
        wrapper.append(button, translation);
        session.translations.push({ button, translation });
      } else {
        wrapper.append(node(session, "span", "本段译文待补充", "reader-study-missing"));
      }
      paragraph.after(wrapper);
    });

    // Article-level notes must quote a sentence actually present in the body.
    const notes = data.sentenceNotes.filter(note => texts.some(text => normalizeText(text).includes(normalizeText(note.sentence))));
    if (notes.length) {
      const details = auxiliary(session, "details", "reader-study-notes");
      details.open = false;
      details.append(node(session, "summary", `长难句解析 · ${notes.length} 句`));
      notes.forEach(note => {
        const panel = node(session, "section", "", "reader-study-note");
        const sentence = node(session, "blockquote", note.sentence);
        sentence.lang = "en";
        const list = node(session, "dl");
        for (const [field, label] of [["mainClause", "句子主干"], ["structure", "结构拆解"], ["translation", "参考译文"], ["tip", "阅读提示"]]) {
          if (note[field]) list.append(node(session, "dt", label), node(session, "dd", note[field]));
        }
        panel.append(sentence, list);
        details.append(panel);
      });
      session.body.append(details);
      session.nodes.push(details);
    }
    const available = session.translations.length;
    const skipped = matched.unmatched.length + matched.ambiguous.length;
    const messages = [available ? `已有 ${available}/${session.paragraphs.length} 段译文，默认收起。` : "暂无可匹配的译文，英文仍可阅读。"];
    if (skipped) messages.push(`${skipped} 段辅助原文不匹配或重复，已跳过，未附加译文。`);
    if (notes.length < data.sentenceNotes.length) messages.push(`${data.sentenceNotes.length - notes.length} 条解析原句未匹配，已跳过。`);
    session.status.textContent = messages.join(" ");
    updateControls(session);
    return { status: "ready", matched: matched.matches.length, available, total: session.paragraphs.length, skipped, notes: notes.length };
  }

  async function loadStudy(session) {
    if (active !== session || !session.body.isConnected) return { status: "cancelled" };
    session.controller.abort();
    session.controller = new AbortController();
    const generation = ++session.generation;
    session.retry.hidden = true;
    session.status.textContent = "正在加载翻译与解析，英文可先阅读。";
    try {
      const response = await fetch(session.url, { signal: session.controller.signal, credentials: "same-origin" });
      if (!isCurrent(session, generation)) return { status: "cancelled" };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!isCurrent(session, generation)) return { status: "cancelled" };
      const data = normalizeStudy(payload, session.path);
      return renderStudy(session, data);
    } catch (error) {
      if (!isCurrent(session, generation)) return { status: "cancelled" };
      session.status.textContent = "翻译与解析暂未加载，英文仍可正常阅读。";
      session.retry.hidden = false;
      session.retry.disabled = false;
      return { status: "error", reason: error.message };
    }
  }

  function detach() {
    if (!active) return;
    const previous = active;
    active = null;
    previous.controller.abort();
    previous.nodes.forEach(element => element.remove());
  }

  async function mountReader(body, { path, version = "" } = {}) {
    detach();
    const url = studyUrl(path, version);
    if (!body || !url || !body.isConnected) return { status: "skipped" };
    const session = {
      body, path, url, id: ++instance, generation: 0, controller: new AbortController(),
      nodes: [], translations: [], paragraphs: collectParagraphs(body),
    };
    active = session;
    const toolbar = auxiliary(session, "div", "reader-study-toolbar");
    const status = node(session, "p", "", "reader-study-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const all = node(session, "button", "显示全文翻译", "reader-study-button reader-study-all");
    all.type = "button";
    all.hidden = true;
    all.setAttribute("aria-pressed", "false");
    all.setAttribute("aria-expanded", "false");
    all.addEventListener("click", () => {
      const hide = session.translations.every(item => !item.translation.hidden);
      session.translations.forEach(item => { item.translation.hidden = hide; });
      updateControls(session);
    });
    const retry = node(session, "button", "重新加载翻译与解析", "reader-study-button reader-study-retry");
    retry.type = "button";
    retry.hidden = true;
    retry.addEventListener("click", () => { void loadStudy(session); });
    toolbar.append(status, all, retry);
    body.before(toolbar);
    session.nodes.push(toolbar);
    Object.assign(session, { status, all, retry });
    return loadStudy(session);
  }

  return { mountReader, detach, normalizeText, safePath, studyUrl, normalizeStudy, matchParagraphs };
});
