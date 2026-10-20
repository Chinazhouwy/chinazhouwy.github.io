/* English reading dictionary and private server-synced wordbook with an offline cache. Dictionary: ECDICT (MIT). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ReaderVocabulary = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const STORAGE_KEY = "wy.english-wordbook.v1";
  const MAX_WORDS = 5000;
  const WORD = /^[a-z]+(?:['-][a-z]+)*(?:\.[a-z]+)*\.?$/;
  const TOKEN = /[A-Za-z]+(?:[’'\-][A-Za-z]+)*(?:\.[A-Za-z]+)*\.?/g;
  const clip = (value, size) => typeof value === "string" ? value.slice(0, size) : "";
  function normalizeWord(value) {
    if (typeof value !== "string" || /[0-9_<>{}:\/]/.test(value)) return "";
    const word = clip(value, 100).trim().toLowerCase().replace(/’/g, "'").replace(/[‐‑–]/g, "-").replace(/^[^a-z]+|[^a-z.]+$/g, "").replace(/\.$/, "");
    return word.length <= 64 && WORD.test(word) ? word : "";
  }
  function normalizeTerm(value) {
    if (typeof value !== "string" || value.length > 200 || /[0-9_<>{}:\/]/.test(value)) return "";
    const term = value.trim().toLowerCase().replace(/’/g, "'").replace(/[‐‑–]/g, "-")
      .replace(/^[“”"'‘’([{]+|[“”"'‘’).,;:!?\]}]+$/g, "").trim().replace(/\s+/g, " ");
    const parts = term.split(" ");
    return term.length <= 160 && parts.length <= 12 && parts.every(part => part.length <= 64 && WORD.test(part)) ? term : "";
  }
  function safePath(value) {
    return typeof value === "string" && /^content\/columns\/english-reads\/[a-z0-9-]+\.md$/.test(value) ? value : "";
  }
  function cleanEntry(value) {
    if (!value || typeof value !== "object") return null;
    const word = normalizeTerm(value.word);
    if (!word) return null;
    return {
      word, lemma: normalizeTerm(value.lemma) || word,
      phonetic: clip(value.phonetic, 200), meaning: clip(value.meaning, 3000),
      sentence: clip(value.sentence, 1500), articleTitle: clip(value.articleTitle, 300), path: safePath(value.path),
      createdAt: Number.isFinite(value.createdAt) && value.createdAt > 0 ? value.createdAt : Date.now()
    };
  }
  function mergeEntries(existing, incoming) {
    const map = new Map();
    for (const candidate of [...existing, ...incoming]) {
      const entry = cleanEntry(candidate);
      if (entry && !map.has(entry.word)) map.set(entry.word, entry);
    }
    if (map.size > MAX_WORDS) throw new Error(`最多保存 ${MAX_WORDS} 个词条，请先导出备份并整理。`);
    return [...map.values()];
  }
  function parseImport(text) {
    if (typeof text !== "string" || text.length > 32 * 1024 * 1024) throw new Error("文件超过 32 MB，无法导入。");
    let value;
    try { value = JSON.parse(text); } catch { throw new Error("文件不是有效的 JSON 生词本。"); }
    if (!value || value.schemaVersion !== 1 || !Array.isArray(value.words) || value.words.length > MAX_WORDS) throw new Error("生词本格式或版本不支持。");
    if (value.words.some((entry) => !cleanEntry(entry))) throw new Error("生词本含有无效词条，未导入，请检查文件。");
    return mergeEntries([], value.words);
  }
  function createStore(storage) {
    let words = [], warning = "";
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) words = parseImport(raw);
    } catch { warning = "本机生词本无法读取。新收藏暂存本页，请先导出备份。"; }
    const save = (next) => {
      words = next;
      // Do not overwrite an unreadable existing book without an explicit recovery action.
      if (!warning) {
        try { storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, words })); }
        catch { warning = "浏览器未能保存。收藏暂存本页，离开前请导出备份。"; }
      }
      return { count: words.length, warning };
    };
    return {
      entries: () => words.map((entry) => ({ ...entry })),
      warning: () => warning,
      has: (word) => words.some((entry) => entry.word === normalizeTerm(word)),
      add: (entry) => save(mergeEntries(words, [entry])),
      remove: (word) => save(words.filter((entry) => entry.word !== normalizeTerm(word))),
      import: (text) => save(mergeEntries(words, parseImport(text))),
      replace: (entries) => save(mergeEntries([], entries)),
      export: () => JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), words }, null, 2)
    };
  }
  if (typeof document === "undefined") return { normalizeWord, normalizeTerm, safePath, cleanEntry, mergeEntries, parseImport, createStore, STORAGE_KEY };

  let store;
  function getStore() {
    if (!store) {
      let storage;
      try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error("Storage disabled"); } }; }
      store = createStore(storage);
    }
    return store;
  }
  let cloud, redrawBook;
  async function cloudRequest(url, options={}) {
    const headers={};
    if(options.body)headers["Content-Type"]="application/json";
    if(options.csrf)headers["X-CSRF-Token"]=options.csrf;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    let response;
    try{response=await fetch(url,{method:options.method||"GET",credentials:"same-origin",cache:"no-store",headers,body:options.body?JSON.stringify(options.body):undefined,signal:controller.signal});}finally{clearTimeout(timer);}
    const result=await response.json().catch(()=>({error:"同步服务暂不可用"}));
    if(!response.ok){const error=new Error(result.error||"同步请求失败");error.status=response.status;throw error;}
    return result;
  }
  function getCloud(){
    if(!cloud){
      let storage;try{storage=localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw new Error("Storage disabled");}};}
      cloud=WordbookSync.createSync({local:getStore(),storage,request:cloudRequest,enabled:["zhouwy.top","localhost","127.0.0.1"].includes(location.hostname),onChange:()=>{notifyCounts();refreshCloudUI();redrawBook?.();}});
    }
    return cloud;
  }
  function refreshCloudUI(){
    if(!cloud)return;
    const s=cloud.status();
    const text={local:"本机收藏 · 等待服务器同步",syncing:"正在同步到服务器…",synced:"已同步到服务器 · 其他设备登录后可查看",login:"本机收藏 · 登录后同步到服务器",offline:"本机收藏 · 有待同步内容",mirror:"当前为镜像站 · 云端生词本请在主站使用"}[s.kind];
    document.querySelectorAll(".rv-sync-state").forEach(e=>e.textContent=[text,s.message,s.warning,s.pending?`${s.pending} 条变更待同步`:""].filter(Boolean).join("；"));
    document.querySelectorAll(".rv-cloud-hint").forEach(e=>e.textContent=text);
  }
  function syncPanel(){
    const panel=element("section","rv-sync-panel"),status=element("p","rv-sync-state");status.setAttribute("role","status");panel.append(status);
    const actions=element("div","rv-sync-actions");
    if(!["zhouwy.top","localhost","127.0.0.1"].includes(location.hostname)){
      const link=element("a","rv-button","前往主站生词本");link.href="https://zhouwy.top/#/reading";
      actions.append(link);panel.append(actions,element("p","rv-muted","本镜像已有收藏可先导出，再到主站导入合并。"));return panel;
    }
    const form=element("form","rv-sync-login");form.hidden=true;
    const password=element("input");password.type="password";password.autocomplete="current-password";password.placeholder="管理工作台密码";password.setAttribute("aria-label","管理工作台密码");password.required=true;
    const submit=element("button","rv-button","登录并同步");submit.type="submit";form.append(password,submit);
    actions.append(button("立即同步",()=>void getCloud().sync()),button("登录服务器",()=>{form.hidden=!form.hidden;if(!form.hidden)password.focus();}));
    form.addEventListener("submit",async e=>{e.preventDefault();submit.disabled=true;try{const value=password.value;password.value="";const ok=await getCloud().login(value);if(ok)form.hidden=true;}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}});
    panel.append(actions,form);return panel;
  }
  let dictionaryPromise, popup, dialog, selected, anchor, anchorRect, selectionTools, lookupId = 0, cleanupReader;
  function hideSelectionTools() { selectionTools?.remove(); selectionTools = null; }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, action, className = "rv-button") {
    const node = element("button", className, text); node.type = "button";
    node.addEventListener("click", action); return node;
  }
  function notifyCounts() {
    document.querySelectorAll(".rv-book-trigger").forEach((node) => { node.textContent = `生词本（${getStore().entries().length}）`; });
  }
  function closePopup(restoreFocus = false) {
    lookupId++; anchorRect = null;
    popup?.remove(); popup = null;
    selected?.classList.remove("rv-word-selected"); selected = null;
    if (restoreFocus && anchor?.isConnected) {
      const focusTarget = anchor.matches("button") ? anchor : document.querySelector(".rv-lookup-trigger");
      focusTarget?.focus();
    }
  }
  function placePopup() {
    if (!popup || !anchor) return;
    if (window.innerWidth <= 600) { popup.style.left = ""; popup.style.top = ""; return; }
    const rect = anchorRect || anchor.getBoundingClientRect();
    const box = popup.getBoundingClientRect();
    popup.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - box.width - 12))}px`;
    popup.style.top = `${Math.max(12, Math.min(rect.bottom + 10, window.innerHeight - box.height - 12))}px`;
  }
  async function dictionary() {
    if (!dictionaryPromise) {
      dictionaryPromise = fetch("./assets/english-vocabulary/lexicon.json?v=20261016-1")
        .then((response) => { if (!response.ok) throw new Error("词典加载失败"); return response.json(); })
        .catch((error) => { dictionaryPromise = null; throw error; });
    }
    return dictionaryPromise;
  }
  function contextFor(node, article) {
    const paragraph = node.closest("p, li, blockquote, h1, h2, h3") || node.parentElement;
    const text = (paragraph?.textContent || "").replace(/\s+/g, " ").trim();
    const range = document.createRange();
    range.selectNodeContents(paragraph); range.setEndBefore(node);
    const wordIndex = range.toString().replace(/\s+/g, " ").trimStart().length;
    const start = Math.max(0, wordIndex - 300);
    return { path: article.path, articleTitle: article.title, sentence: text.slice(start, start + 1000) };
  }
  function openLookup(word, target, context = {}, rect = null) {
    closePopup(); hideSelectionTools(); anchor = target; anchorRect = rect;
    if (!word.includes(" ") && target.classList.contains("rv-word")) { selected = target; selected.classList.add("rv-word-selected"); }
    popup = element("section", "rv-popup"); popup.setAttribute("role", "dialog"); popup.setAttribute("aria-label", "单词与词组释义");
    const head = element("div", "rv-popup-head");
    head.append(element("span", "rv-eyebrow", "词语查询"), button("关闭 ×", () => closePopup(true), "rv-close"));
    const form = element("form", "rv-lookup-form");
    const input = element("input"); input.type = "search"; input.value = word; input.placeholder = "输入单词或词组"; input.setAttribute("aria-label", "要查询的单词或词组"); input.maxLength = 160; input.autocomplete = "off";
    const submit = element("button", "rv-button", "查词"); submit.type = "submit";
    form.append(input, submit);
    const result = element("div", "rv-result"); result.setAttribute("aria-live", "polite");
    popup.append(head, form, result); document.body.append(popup);
    form.addEventListener("submit", (event) => { event.preventDefault(); void lookup(input.value, result, {}); });
    if (word) void lookup(word, result, context); else result.append(element("p", "rv-muted", "点击单词或划选词组查询，也可在这里输入。"));
    placePopup();
    if (!word) input.focus();
  }
  async function lookup(raw, result, context) {
    const word = normalizeTerm(raw), id = ++lookupId;
    result.replaceChildren();
    if (!word) { result.append(element("p", "rv-muted", "请输入英文单词或不超过12词、160字符的词组。")); placePopup(); return; }
    result.append(element("p", "rv-muted", "正在查词…"));
    let entry, failed = false;
    try { const data = await dictionary(); entry = Object.hasOwn(data.entries, word) ? data.entries[word] : null; }
    catch { failed = true; }
    if (id !== lookupId || !result.isConnected) return;
    result.replaceChildren();
    const title = element("h3", "rv-word-title", word); title.lang = "en"; result.append(title);
    if (entry?.phonetic) result.append(element("p", "rv-phonetic", `/${entry.phonetic}/`));
    if (entry?.lemma && entry.lemma !== word) result.append(element("p", "rv-muted", `原形：${entry.lemma}`));
    result.append(element("p", "rv-meaning", entry?.meaning || (failed ? "词典暂时无法加载，可重试。仍可先收藏词条。" : "词典暂未收录此词语，可先收藏，或前往有道查释义。")));
    if (failed) result.append(button("重试加载词典", () => void lookup(word, result, context)));
    const online = element("a", "rv-online-lookup", "到有道查释义 ↗");
    online.href = `https://www.youdao.com/result?word=${encodeURIComponent(word)}&lang=en`;
    online.target = "_blank"; online.rel = "noopener noreferrer";
    result.append(online);
    const actions = element("div", "rv-popup-actions");
    const save = button(getStore().has(word) ? "已收藏" : "＋ 加入生词本", () => {
      try {
        const status = getCloud().add({ word, lemma: entry?.lemma || word, meaning: entry?.meaning || "", phonetic: entry?.phonetic || "", ...context });
        save.textContent = "已收藏"; save.disabled = true; notice.textContent = status.warning || "已收藏；登录后自动同步到服务器"; notifyCounts();
      } catch (error) { notice.textContent = error.message; }
    }); save.disabled = getStore().has(word);
    actions.append(save, button("查看生词本", openBook)); result.append(actions);
    const notice = element("p", "rv-notice", getStore().warning()); notice.setAttribute("role", "status"); result.append(notice);
    const source = element("a", "rv-dictionary-source", "释义：ECDICT · MIT"); source.href = "https://github.com/skywind3000/ECDICT"; source.target = "_blank"; source.rel = "noopener noreferrer";
    result.append(source, element("p", "rv-muted", "通用词典释义，请结合原文语境判断。")); placePopup();
  }
  function openBook() {
    closePopup();
    if (dialog?.open) { dialog.focus(); return; }
    dialog?.remove();
    dialog = element("dialog", "rv-book"); dialog.setAttribute("aria-labelledby", "rv-book-title");
    const header = element("header", "rv-book-header");
    const heading = element("div"); const title = element("h2", "", "我的生词本"); title.id = "rv-book-title";
    heading.append(title, element("p", "rv-muted", "登录后保存到你的服务器；未登录或断网时先保存在本机。单词、词组和原句一并保留。"));
    header.append(heading, button("关闭 ×", () => dialog.close(), "rv-close"));
    const tools = element("div", "rv-book-tools");
    const search = element("input"); search.type = "search"; search.placeholder = "搜索单词、词组或释义"; search.setAttribute("aria-label", "搜索生词本");
    const file = element("input"); file.type = "file"; file.accept = ".json,application/json"; file.hidden = true;
    const status = element("p", "rv-notice", getStore().warning()); status.setAttribute("role", "status");
    tools.append(search, button("导出备份", () => {
      const url = URL.createObjectURL(new Blob([getStore().export()], { type: "application/json" }));
      const link = element("a"); link.href = url; link.download = `english-wordbook-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = "备份下载已发起，请确认文件已保存。";
    }), button("导入合并", () => file.click()), file);
    const count = element("p", "rv-muted"); const list = element("div", "rv-book-list");
    const draw = () => {
      const query = search.value.trim().toLowerCase(); const all = getStore().entries();
      const words = all.filter((entry) => `${entry.word} ${entry.meaning}`.toLowerCase().includes(query)).reverse();
      count.textContent = `显示 ${words.length} / 共 ${all.length} 个词条`; list.replaceChildren();
      if (!words.length) list.append(element("p", "rv-book-empty", all.length ? "没有匹配的单词。" : "还没有收藏。打开英文文章，点单词或划选词组后加入生词本。"));
      for (const entry of words) {
        const row = element("article", "rv-book-entry"); const top = element("div", "rv-entry-top");
        const label = element("h3", "", entry.word); label.lang = "en";
        top.append(label, button("移除", () => { const saved = getCloud().remove(entry.word); status.textContent = saved.warning || `已移除 ${entry.word}`; draw(); notifyCounts(); }, "rv-remove"));
        row.append(top);
        if (entry.phonetic) row.append(element("p", "rv-phonetic", `/${entry.phonetic}/`));
        row.append(element("p", "rv-meaning", entry.meaning || "暂无释义"));
        if (entry.sentence) { const quote = element("blockquote", "rv-context", entry.sentence); quote.lang = "en"; row.append(quote); }
        if (entry.path) { const source = element("a", "rv-article-source", entry.articleTitle || "返回原文"); source.href = `#/article/${encodeURIComponent(entry.path)}`; source.dataset.readingBadge = "off"; source.addEventListener("click", () => dialog.close()); row.append(source); }
        list.append(row);
      }
    };
    search.addEventListener("input", draw);
    file.addEventListener("change", async () => {
      const selectedFile = file.files[0]; if (!selectedFile) return;
      try {
        if (selectedFile.size > 32 * 1024 * 1024) throw new Error("文件超过 32 MB，无法导入。");
        const saved = getCloud().import(await selectedFile.text()); status.textContent = saved.warning || `导入完成，共 ${saved.count} 个词条；重复词条已合并。`; draw(); notifyCounts();
      } catch (error) { status.textContent = error.message; }
      file.value = "";
    });
    dialog.append(header, syncPanel(), tools, status, count, list);
    redrawBook=draw;dialog.addEventListener("close",()=>{redrawBook=null;});
    dialog.addEventListener("click", (event) => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
    document.body.append(dialog); draw(); dialog.showModal(); refreshCloudUI(); void getCloud().sync();
  }
  function bookButton() { return button(`生词本（${getStore().entries().length}）`, openBook, "rv-button rv-book-trigger"); }
  function mountCollection(root) {
    if (!root || root.querySelector(".rv-collection-tools")) return;
    const toolbar = element("div", "rv-collection-tools"); toolbar.append(bookButton(),element("span","rv-cloud-hint")); const heading = root.querySelector(".english-collection-heading"); if (heading) heading.after(toolbar); else root.append(toolbar); void getCloud().sync();
  }
  function mountReader(body, article) {
    if (!body || body.dataset.vocabularyMounted) return;
    body.dataset.vocabularyMounted = "true";
    const toolbar = element("div", "rv-toolbar");
    const manual = button("手动查词", () => openLookup("", manual), "rv-button rv-lookup-trigger");
    toolbar.append(element("span", "rv-hint", "点单词 / 划选词组 · 收藏保留原文语境"), manual, bookButton()); body.before(toolbar); void getCloud().sync();
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, { acceptNode(node) {
      return node.parentElement.closest("a, pre, code, button, script, style, .rv-word, .reader-study-aux, [data-reader-study-aux]") || !/[A-Za-z]/.test(node.textContent) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    } });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.textContent, fragment = document.createDocumentFragment(); let offset = 0;
      for (const match of text.matchAll(TOKEN)) {
        const raw = match[0].replace(/\.$/, "");
        fragment.append(document.createTextNode(text.slice(offset, match.index)));
        const span = element("span", "rv-word", raw); span.dataset.word = normalizeWord(raw); fragment.append(span); offset = match.index + raw.length;
      }
      fragment.append(document.createTextNode(text.slice(offset))); node.replaceWith(fragment);
    }
    const click = (event) => {
      const target = event.target.closest(".rv-word");
      if (!target || !body.contains(target) || window.getSelection()?.toString().trim()) return;
      openLookup(target.dataset.word, target, contextFor(target, article));
    };
    let frame = 0;
    const updateSelection = () => {
      frame = 0; hideSelectionTools();
      const selection = window.getSelection();
      if (popup || !selection || selection.isCollapsed || selection.rangeCount !== 1) return;
      const range = selection.getRangeAt(0);
      if (!body.contains(range.startContainer) || !body.contains(range.endContainer)) return;
      const term = normalizeTerm(selection.toString());
      if (!term || !term.includes(" ")) return;
      const rect = range.getBoundingClientRect();
      if (!rect.width || rect.bottom < 0 || rect.top > innerHeight) return;
      const startNode = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
      const endNode = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement;
      if (startNode.closest("a, pre, code, button, .reader-study-aux, [data-reader-study-aux]") || endNode.closest("a, pre, code, button, .reader-study-aux, [data-reader-study-aux]")) return;
      const context = contextFor(startNode.closest(".rv-word") || startNode, article);
      const snapshot = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      selectionTools = element("div", "rv-selection-tools");
      const query = button("查词组", () => openLookup(term, startNode, context, snapshot), "rv-button rv-selection-query");
      query.setAttribute("aria-label", "查询所选词组");
      query.addEventListener("pointerdown", event => event.preventDefault());
      selectionTools.append(query); document.body.append(selectionTools);
      const box = selectionTools.getBoundingClientRect();
      selectionTools.style.left = `${Math.max(12, Math.min(rect.right - box.width, innerWidth - box.width - 12))}px`;
      selectionTools.style.top = `${Math.max(12, rect.top - box.height - 8 < 12 ? Math.min(rect.bottom + 8, innerHeight - box.height - 90) : rect.top - box.height - 8)}px`;
    };
    const selectionChanged = () => { if (!frame) frame = requestAnimationFrame(updateSelection); };
    body.addEventListener("click", click); document.addEventListener("selectionchange", selectionChanged);
    cleanupReader = () => {
      body.removeEventListener("click", click); document.removeEventListener("selectionchange", selectionChanged);
      if (frame) cancelAnimationFrame(frame); hideSelectionTools();
    };
  }
  function detach() { hideSelectionTools(); closePopup(); cleanupReader?.(); cleanupReader = null; if (dialog?.open) dialog.close(); }
  document.addEventListener("pointerdown", (event) => { if (popup && !popup.contains(event.target) && !event.target.closest(".rv-word, .rv-lookup-trigger, .rv-selection-tools")) closePopup(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { hideSelectionTools(); if (popup) { closePopup(true); event.preventDefault(); } } });
  window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY) { store = createStore(window.localStorage); cloud = null; notifyCounts(); redrawBook?.(); } });
  window.addEventListener("resize", () => { hideSelectionTools(); placePopup(); });
  window.addEventListener("scroll", () => { hideSelectionTools(); if (popup && window.innerWidth > 600) closePopup(); }, { passive: true });
  window.addEventListener("online",()=>{if(cloud)void cloud.sync();});
  window.addEventListener("focus",()=>{if(cloud)void cloud.sync();});
  return { mountReader, mountCollection, detach };
});
