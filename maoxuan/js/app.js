/* 读毛选 · 应用逻辑 */
(function () {
  'use strict';

  /* ---------- 数据扁平化 ---------- */
  var VOL_META = {
    vol1: { name: '第一卷', range: '1925—1937.7' },
    vol2: { name: '第二卷', range: '1937.7—1941.5' },
    vol3: { name: '第三卷', range: '1941.5—1945.8' },
    vol4: { name: '第四卷', range: '1945.8—1949.9' },
    vol5: { name: '第五卷', range: '1949.9—1957' }
  };
  var VOLS = Object.keys(window.MAOXUAN);
  var FLAT = [];           // [{id,title,date,intro,blocks,notes,volKey,volName,period,idx}]
  var BY_ID = {};
  VOLS.forEach(function (vk) {
    window.MAOXUAN[vk].forEach(function (period) {
      period.articles.forEach(function (a) {
        var item = Object.assign({}, a, {
          volKey: vk, volName: VOL_META[vk].name, period: period.name
        });
        item.idx = FLAT.length;
        FLAT.push(item);
        BY_ID[a.id] = item;
      });
    });
  });

  /* ---------- 存取 ---------- */
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('mx_' + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem('mx_' + k, JSON.stringify(v)); } catch (e) {}
    }
  };
  var bookmarks = store.get('bm', []);          // [id]
  var readMap = store.get('read', {});          // {id:1}
  var scrollMap = store.get('scroll', {});      // {id:ratio}
  var conf = Object.assign(
    { fs: 19, lh: 2.05, theme: 'light', wide: false },
    store.get('conf', {})
  );

  /* ---------- 工具 ---------- */
  var $ = function (s, el) { return (el || document).querySelector(s); };
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 1600);
  }
  function applyConf() {
    document.body.dataset.theme = conf.theme;
    if (conf.wide) document.body.setAttribute('data-wide', ''); else document.body.removeAttribute('data-wide');
    document.documentElement.style.setProperty('--fs', conf.fs + 'px');
    document.documentElement.style.setProperty('--lh', conf.lh);
    store.set('conf', conf);
  }

  /* ---------- 路由 ---------- */
  var pendingScrollQuery = null;   // 搜索跳转后定位
  var current = null;              // 当前文章

  function route() {
    var h = location.hash || '';
    var m = h.match(/^#\/read\/([\w-]+)/);
    closeOverlays();
    if (m && BY_ID[m[1]]) return renderArticle(BY_ID[m[1]]);
    if (h.indexOf('#/toc') === 0) return renderToc();
    if (h.indexOf('#/about') === 0) return renderAbout();
    // 默认：上次阅读或第一篇
    var last = store.get('last', null);
    if (last && BY_ID[last]) return renderArticle(BY_ID[last]);
    location.replace('#/read/' + FLAT[0].id);
  }

  function setTab(view) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.view === view);
    });
  }

  /* ---------- 视图渲染 ---------- */
  var view = $('#view');

  function renderArticle(a) {
    current = a;
    setTab('read');
    store.set('last', a.id);
    document.title = a.title + ' · 读毛选';

    var html = [];
    html.push('<article data-id="' + a.id + '">');
    html.push('<h1 class="a-title">' + esc(a.title) + '</h1>');
    if (a.date) html.push('<p class="a-sub">' + esc(a.date) + '</p>');

    var star = '';
    var blocks = a.blocks;
    if (blocks.length && blocks[0].type === 'p' && /^[\*＊]/.test(blocks[0].text)) {
      star = blocks[0].text;
      blocks = blocks.slice(1);
    }
    if (star) html.push('<p class="a-star">' + esc(star) + '</p>');
    if (a.intro) html.push('<div class="a-intro"><b class="tag">题 解</b>' + esc(a.intro) + '</div>');

    html.push('<div class="a-body">');
    var pi = 0;
    blocks.forEach(function (b) {
      if (b.type === 'h') {
        html.push('<h3 class="sec">' + esc(b.text) + '</h3>');
      } else {
        pi++;
        html.push('<p class="para" data-pi="' + pi + '">' + paraHtml(b.text) + '</p>');
      }
    });
    html.push('</div>');

    if (a.notes && a.notes.length) {
      html.push('<div class="a-notes"><h4>注 释</h4>');
      a.notes.forEach(function (n) {
        html.push('<div class="note" data-n="' + n.n + '"><b>[' + n.n + ']</b><span>' + esc(n.text) + '</span></div>');
      });
      html.push('</div>');
    }

    var prev = FLAT[a.idx - 1], next = FLAT[a.idx + 1];
    html.push('<div class="a-nav">');
    html.push(prev
      ? '<button class="prev" data-go="' + prev.id + '"><span class="dir">◇ 上一篇</span><span class="name">' + esc(prev.title) + '</span></button>'
      : '<button disabled></button>');
    html.push('<span class="pos">' + (a.idx + 1) + ' / ' + FLAT.length + '</span>');
    html.push(next
      ? '<button class="next" data-go="' + next.id + '"><span class="dir">下一篇 ◇</span><span class="name">' + esc(next.title) + '</span></button>'
      : '<button disabled></button>');
    html.push('</div></article>');

    view.innerHTML = html.join('');
    renderCrumb(a);
    renderTree();
    renderBmButton();
    bindReaderEvents();

    // 滚动恢复 / 搜索定位
    if (pendingScrollQuery && pendingScrollQuery.id === a.id) {
      jumpToQuery(pendingScrollQuery.q);
      pendingScrollQuery = null;
    } else {
      var ratio = scrollMap[a.id];
      var h = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
      window.scrollTo(0, ratio ? ratio * h : 0);
      if (ratio && ratio > 0.02) toast('已恢复到上次阅读位置');
    }
    updateProgress();
  }

  function paraHtml(text) {
    // [N] 脚注标记 -> 可交互上标
    var out = '';
    var last = 0, m;
    var re = /\[(\d{1,3})\]/g;
    while ((m = re.exec(text))) {
      out += esc(text.slice(last, m.index));
      out += '<sup class="ftn" data-n="' + m[1] + '" title="查看注释">[' + m[1] + ']</sup>';
      last = m.index + m[0].length;
    }
    out += esc(text.slice(last));
    return out;
  }

  function jumpToQuery(q) {
    var paras = view.querySelectorAll('.para, .sec, .a-intro');
    q = q.toLowerCase();
    for (var i = 0; i < paras.length; i++) {
      if ((paras[i].textContent || '').toLowerCase().indexOf(q) >= 0) {
        paras[i].scrollIntoView({ block: 'center' });
        paras[i].classList.add('flash');
        setTimeout(function () { paras[i].classList.remove('flash'); }, 2500);
        return;
      }
    }
    window.scrollTo(0, 0);
  }

  function renderCrumb(a) {
    var c = $('#crumbs');
    c.innerHTML = '';
    addSeg(c, '毛泽东选集', '#/toc', false);
    addSep(c);
    addSeg(c, a.volName, '#/toc', false);
    addSep(c);
    addSeg(c, a.period, '#/toc', false);
    addSep(c);
    addSeg(c, a.title, null, true);
    c.title = '毛泽东选集 / ' + a.volName + ' / ' + a.period + ' / ' + a.title;
  }
  function addSeg(c, text, hash, here) {
    var s = document.createElement('span');
    s.className = 'seg' + (here ? ' here' : '');
    s.textContent = text;
    if (hash) s.addEventListener('click', function () { location.hash = hash; });
    c.appendChild(s);
  }
  function addSep(c) {
    var s = document.createElement('span');
    s.className = 'sep'; s.textContent = '/';
    c.appendChild(s);
  }

  /* ---------- 侧栏树 ---------- */
  var treeOpen = store.get('tree', { vol1: true });

  function renderTree() {
    var tree = $('#tree');
    tree.innerHTML = '';
    VOLS.forEach(function (vk) {
      var meta = VOL_META[vk];
      var volEl = document.createElement('div');
      volEl.className = 'vol-block' + (treeOpen[vk] ? ' open' : '');
      var head = document.createElement('button');
      head.className = 'vol-head';
      head.innerHTML = '<svg class="caret" viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M9 6l6 6-6 6z"/></svg><span>' +
        meta.name + '</span><span style="margin-left:auto;font-size:11px;color:var(--text-3);font-weight:400">' + meta.range + '</span>';
      head.addEventListener('click', function () {
        treeOpen[vk] = !treeOpen[vk];
        store.set('tree', treeOpen);
        volEl.classList.toggle('open', treeOpen[vk]);
      });
      volEl.appendChild(head);

      var sub = document.createElement('div');
      sub.className = 'vol-sub';
      window.MAOXUAN[vk].forEach(function (period) {
        var ph = document.createElement('div');
        ph.className = 'period-head';
        ph.textContent = period.name;
        sub.appendChild(ph);
        period.articles.forEach(function (a) {
          var item = document.createElement('button');
          item.className = 'art-item' + (readMap[a.id] ? ' read' : '') +
            (current && current.id === a.id ? ' current' : '');
          item.innerHTML = '<i class="read-dot"></i><span class="t">' + esc(a.title) + '</span>';
          item.addEventListener('click', function () {
            location.hash = '#/read/' + a.id;
            document.body.classList.remove('side-open');
          });
          sub.appendChild(item);
        });
      });
      volEl.appendChild(sub);
      tree.appendChild(volEl);
    });
    renderBmList();
  }

  /* ---------- 书签 ---------- */
  function isBm(id) { return bookmarks.indexOf(id) >= 0; }
  function renderBmButton() {
    var btn = $('#btn-bookmark');
    btn.classList.toggle('on', current && isBm(current.id));
    btn.title = current && isBm(current.id) ? '移出书签' : '加入书签';
  }
  function renderBmList() {
    var wrap = $('#bm-list-wrap'), list = $('#bm-list');
    if (!bookmarks.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    list.innerHTML = '';
    bookmarks.forEach(function (id) {
      var a = BY_ID[id];
      if (!a) return;
      var b = document.createElement('button');
      b.className = 'bm-item';
      b.textContent = a.volName.replace('第', '').replace('卷', '') + '·' + a.title;
      b.title = a.volName + ' · ' + a.title;
      b.addEventListener('click', function () {
        location.hash = '#/read/' + id;
        document.body.classList.remove('side-open');
      });
      list.appendChild(b);
    });
  }
  $('#btn-bookmark').addEventListener('click', function () {
    if (!current) return;
    var i = bookmarks.indexOf(current.id);
    if (i >= 0) { bookmarks.splice(i, 1); toast('已移出书签'); }
    else { bookmarks.unshift(current.id); toast('已加入书签'); }
    store.set('bm', bookmarks);
    renderBmButton(); renderBmList();
  });
  $('#bm-clear').addEventListener('click', function () {
    bookmarks = []; store.set('bm', bookmarks);
    renderBmButton(); renderBmList();
    toast('书签已清空');
  });

  /* ---------- 阅读区交互 ---------- */
  var notePop = $('#note-pop');
  var popPinned = false;

  function bindReaderEvents() {
    view.querySelectorAll('.a-nav button[data-go]').forEach(function (b) {
      b.addEventListener('click', function () {
        location.hash = '#/read/' + b.dataset.go;
      });
    });
  }

  function showNote(sup, pin) {
    var a = current;
    if (!a) return;
    var n = parseInt(sup.dataset.n, 10);
    var note = null;
    (a.notes || []).forEach(function (x) { if (x.n === n) note = x; });
    if (!note) return;
    notePop.innerHTML = '<b>[' + n + ']</b>' + esc(note.text);
    notePop.hidden = false;
    popPinned = pin;
    var r = sup.getBoundingClientRect();
    var top = r.bottom + window.scrollY + 8;
    var left = Math.min(Math.max(r.left + window.scrollX - 12, 12),
      window.scrollX + document.documentElement.clientWidth - 392);
    notePop.style.top = top + 'px';
    notePop.style.left = left + 'px';
  }
  function hideNote(force) {
    if (popPinned && !force) return;
    notePop.hidden = true; popPinned = false;
  }

  document.addEventListener('click', function (e) {
    var sup = e.target.closest && e.target.closest('sup.ftn');
    if (sup) {
      var wasPinned = popPinned;
      if (wasPinned) { hideNote(true); return; }
      showNote(sup, true);
      return;
    }
    if (!notePop.hidden && !e.target.closest('#note-pop')) hideNote(true);
  });
  document.addEventListener('mouseover', function (e) {
    var sup = e.target.closest && e.target.closest('sup.ftn');
    if (sup && !popPinned) showNote(sup, false);
  });

  /* ---------- 滚动：进度 / 已读 / 记忆 ---------- */
  var saveTick = false;
  function updateProgress() {
    var h = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
    var ratio = Math.min(window.scrollY / h, 1);
    $('#progress i').style.width = (ratio * 100).toFixed(1) + '%';
    if (current) {
      if (ratio > 0.85 && !readMap[current.id]) {
        readMap[current.id] = 1;
        store.set('read', readMap);
        renderTree();
      }
      if (!saveTick) {
        saveTick = true;
        setTimeout(function () {
          saveTick = false;
          if (!current) return;
          var hh = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
          scrollMap[current.id] = Math.min(window.scrollY / hh, 1);
          // 只保留最近 60 篇的滚动位置
          var keys = Object.keys(scrollMap);
          if (keys.length > 60) delete scrollMap[keys[0]];
          store.set('scroll', scrollMap);
        }, 400);
      }
    }
  }
  window.addEventListener('scroll', updateProgress, { passive: true });

  /* ---------- 目录页 ---------- */
  function renderToc() {
    current = null;
    setTab('toc');
    document.title = '目录 · 读毛选';
    var html = ['<div class="toc">'];
    VOLS.forEach(function (vk) {
      var meta = VOL_META[vk];
      html.push('<section class="toc-vol" id="toc-' + vk + '">');
      html.push('<h2>' + meta.name + '<small>' + meta.range + '</small></h2>');
      window.MAOXUAN[vk].forEach(function (period) {
        html.push('<div class="toc-period">' + esc(period.name) + '</div>');
        html.push('<div class="toc-grid">');
        period.articles.forEach(function (a) {
          var isCur = false;
          html.push('<div class="toc-item" data-id="' + a.id + '"><span class="t">' + esc(a.title) + '</span>' +
            '<span class="d">' + esc((a.date || '').replace(/[（）\s]/g, '')) + '</span></div>');
        });
        html.push('</div>');
      });
      html.push('</section>');
    });
    html.push('</div>');
    view.innerHTML = html.join('');
    $('#crumbs').innerHTML = '';
    addSeg($('#crumbs'), '毛泽东选集 · 总目', null, true);
    $('#crumbs').title = '';
    view.querySelectorAll('.toc-item').forEach(function (el) {
      el.addEventListener('click', function () { location.hash = '#/read/' + el.dataset.id; });
    });
    renderTree(); renderBmButton();
    window.scrollTo(0, 0);
  }

  /* ---------- 关于页 ---------- */
  function renderAbout() {
    current = null;
    setTab('about');
    document.title = '关于 · 读毛选';
    view.innerHTML = '<div class="about">' +
      '<h1>关于「读毛选」</h1>' +
      '<p>这是一个纯静态的《毛泽东选集》在线阅读站点，版式参考读通鉴：左侧卷目树、面包屑路径、正文注释随手可查、全文检索、书签与阅读进度记忆。</p>' +
      '<h3>收录内容</h3>' +
      '<p>《毛泽东选集》第一卷至第五卷，共 ' + FLAT.length + ' 篇，正文段落与注释依原文收录。第五卷为 1977 年版，供参考阅读。</p>' +
      '<h3>使用技巧</h3>' +
      '<p>· 点击正文中红色的 <sup style="color:var(--accent)">[N]</sup> 序号可查看注释；<br>' +
      '· 顶部搜索支持全文检索，命中后自动跳转到段落；<br>' +
      '· 面包屑下的小旗按钮可加入书签，书签列在左侧栏底部；<br>' +
      '· 右上角可调节字号、行距、主题（浅色 / 羊皮 / 深色）与版心宽度；<br>' +
      '· 键盘 ← → 可切换上一篇 / 下一篇，Ctrl+K 唤起搜索。</p>' +
      '<h3>文本来源</h3>' +
      '<p>正文取自中文马克思主义文库公开电子文本（marxists.org/chinese），经程序解析整理。仅供学习研究使用。</p>' +
      '</div>';
    $('#crumbs').innerHTML = '';
    addSeg($('#crumbs'), '关于本站', null, true);
    renderTree(); renderBmButton();
    window.scrollTo(0, 0);
  }

  /* ---------- 搜索 ---------- */
  var searchIdx = null;   // [{id, hay, text}]
  var searchOverlay = $('#search-overlay');
  var searchInput = $('#search-input');
  var searchResults = $('#search-results');
  var searchMeta = $('#search-meta');
  var srItems = [];
  var srCur = -1;

  function buildIndex() {
    if (searchIdx) return;
    searchIdx = [];
    FLAT.forEach(function (a) {
      var parts = [a.title, a.intro || ''];
      a.blocks.forEach(function (b) { parts.push(b.text); });
      (a.notes || []).forEach(function (n) { parts.push(n.text); });
      searchIdx.push({ a: a, hay: parts.join('\n').toLowerCase() });
    });
  }

  function openSearch() {
    buildIndex();
    searchOverlay.hidden = false;
    searchInput.value = '';
    searchMeta.textContent = '检索 ' + FLAT.length + ' 篇全文 · 输入关键词，回车定位';
    searchResults.innerHTML = '<div class="sr-empty">输入关键词开始检索</div>';
    srItems = []; srCur = -1;
    setTimeout(function () { searchInput.focus(); }, 30);
  }
  function closeSearch() { searchOverlay.hidden = true; }

  function doSearch() {
    var q = searchInput.value.trim();
    if (!q) {
      searchResults.innerHTML = '<div class="sr-empty">输入关键词开始检索</div>';
      searchMeta.textContent = ''; srItems = []; return;
    }
    var ql = q.toLowerCase();
    var hits = [];
    for (var i = 0; i < searchIdx.length && hits.length < 60; i++) {
      var it = searchIdx[i];
      var titleHit = it.a.title.toLowerCase().indexOf(ql) >= 0;
      if (!titleHit && it.hay.indexOf(ql) < 0) continue;
      // 取首个命中片段
      var pos = it.hay.indexOf(ql);
      var source = '';
      if (pos >= 0) {
        // 找到命中文本所属原文（hay 与原文同序，直接用原文近似切片）
        source = it.a.intro || (it.a.blocks[0] ? it.a.blocks[0].text : '');
      }
      // 在原文中精确定位片段
      var snippet = findSnippet(it.a, q);
      hits.push({ a: it.a, titleHit: titleHit, snippet: snippet, count: countHits(it.hay, ql) });
    }
    hits.sort(function (x, y) { return (y.titleHit - x.titleHit) || (y.count - x.count); });
    renderResults(q, hits);
  }
  function countHits(hay, q) {
    var c = 0, i = 0;
    while ((i = hay.indexOf(q, i)) >= 0) { c++; i += q.length; }
    return c;
  }
  function findSnippet(a, q) {
    var ql = q.toLowerCase();
    var sources = [a.intro || ''].concat(a.blocks.map(function (b) { return b.type === 'p' ? b.text : '§' + b.text; }));
    for (var i = 0; i < sources.length; i++) {
      var low = sources[i].toLowerCase();
      var p = low.indexOf(ql);
      if (p >= 0) {
        var s = Math.max(0, p - 42);
        var frag = sources[i].slice(s, p + q.length + 62);
        return (s > 0 ? '……' : '') + frag + (p + q.length + 62 < sources[i].length ? '……' : '');
      }
    }
    return '';
  }
  function hlSnippet(text, q) {
    var out = '';
    var low = text.toLowerCase(), ql = q.toLowerCase();
    var last = 0, p;
    while ((p = low.indexOf(ql, last)) >= 0) {
      out += esc(text.slice(last, p)) + '<mark>' + esc(text.substr(p, q.length)) + '</mark>';
      last = p + q.length;
    }
    out += esc(text.slice(last));
    return out;
  }
  function renderResults(q, hits) {
    searchMeta.textContent = '共 ' + hits.length + ' 篇命中' + (hits.length >= 60 ? '（显示前 60）' : '');
    searchResults.innerHTML = '';
    srItems = [];
    if (!hits.length) {
      searchResults.innerHTML = '<div class="sr-empty">未找到「' + esc(q) + '」相关内容</div>';
      return;
    }
    hits.forEach(function (h) {
      var el = document.createElement('button');
      el.className = 'sr-item';
      el.innerHTML = '<span class="sr-title">' + esc(h.a.title) +
        '<span class="vol">' + h.a.volName + ' · ' + esc(h.a.period) + ' · 命中 ' + h.count + ' 处</span></span>' +
        (h.snippet ? '<span class="sr-snippet">' + hlSnippet(h.snippet, q) + '</span>' : '');
      el.addEventListener('click', function () {
        closeSearch();
        pendingScrollQuery = { id: h.a.id, q: q };
        if (current && current.id === h.a.id) {
          renderArticle(h.a);
        } else {
          location.hash = '#/read/' + h.a.id;
        }
      });
      searchResults.appendChild(el);
      srItems.push(el);
    });
    srCur = -1;
  }

  $('#btn-search').addEventListener('click', openSearch);
  $('#search-close').addEventListener('click', closeSearch);
  searchOverlay.addEventListener('click', function (e) {
    if (e.target === searchOverlay) closeSearch();
  });
  searchInput.addEventListener('input', doSearch);
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!srItems.length) return;
      srCur = e.key === 'ArrowDown' ? Math.min(srCur + 1, srItems.length - 1) : Math.max(srCur - 1, 0);
      srItems.forEach(function (el, i) { el.classList.toggle('cur', i === srCur); });
      srItems[srCur].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (srCur >= 0) srItems[srCur].click();
      else if (srItems.length) srItems[0].click();
    }
  });

  /* ---------- 设置 ---------- */
  var settings = document.createElement('div');
  settings.id = 'settings';
  settings.innerHTML =
    '<h5>字 号</h5><div class="seg-row" data-k="fs">' +
    [16, 19, 22, 25].map(function (v) { return '<button data-v="' + v + '">' + (v === 16 ? '小' : v === 19 ? '标准' : v === 22 ? '大' : '特大') + '</button>'; }).join('') +
    '</div>' +
    '<h5>行 距</h5><div class="seg-row" data-k="lh">' +
    [[1.85, '紧凑'], [2.05, '标准'], [2.3, '疏朗']].map(function (p) { return '<button data-v="' + p[0] + '">' + p[1] + '</button>'; }).join('') +
    '</div>' +
    '<h5>主 题</h5><div class="theme-dots" data-k="theme">' +
    [['light', '#ffffff', '浅色'], ['sepia', '#f1e6cd', '羊皮'], ['dark', '#202226', '夜间']].map(function (p) {
      return '<button data-v="' + p[0] + '"><i class="dot" style="background:' + p[1] + '"></i>' + p[2] + '</button>';
    }).join('') +
    '</div>' +
    '<h5>版 心</h5><div class="seg-row" data-k="wide">' +
    '<button data-v="0">居中</button><button data-v="1">加宽</button>' +
    '</div>';
  document.body.appendChild(settings);

  function renderSettings() {
    settings.querySelectorAll('.seg-row, .theme-dots').forEach(function (row) {
      var k = row.dataset.k;
      row.querySelectorAll('button').forEach(function (b) {
        var v = b.dataset.v;
        var cur = conf[k];
        b.classList.toggle('on', k === 'wide'
          ? ((conf.wide ? '1' : '0') === v)
          : String(cur) === v);
      });
    });
  }
  settings.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var row = b.closest('[data-k]');
    var k = row.dataset.k, v = b.dataset.v;
    if (k === 'fs') conf.fs = parseInt(v, 10);
    else if (k === 'lh') conf.lh = parseFloat(v);
    else if (k === 'theme') conf.theme = v;
    else if (k === 'wide') conf.wide = v === '1';
    applyConf(); renderSettings();
  });
  $('#btn-settings').addEventListener('click', function (e) {
    e.stopPropagation();
    renderSettings();
    settings.classList.toggle('open');
  });
  document.addEventListener('click', function (e) {
    if (settings.classList.contains('open') &&
        !e.target.closest('#settings') && !e.target.closest('#btn-settings')) {
      settings.classList.remove('open');
    }
  });

  /* ---------- 顶栏 / 侧栏 ---------- */
  $('#tabs').addEventListener('click', function (e) {
    var t = e.target.closest('.tab');
    if (!t) return;
    if (t.dataset.view === 'toc') location.hash = '#/toc';
    else if (t.dataset.view === 'about') location.hash = '#/about';
    else if (current) location.hash = '#/read/' + current.id;
  });
  $('#brand').addEventListener('click', function () {
    var last = store.get('last', null);
    location.hash = last && BY_ID[last] ? '#/read/' + last : '#/read/' + FLAT[0].id;
  });
  $('#btn-sidebar').addEventListener('click', function () {
    if (innerWidth <= 900) document.body.classList.toggle('side-open');
    else document.body.toggleAttribute('data-side-hidden');
  });
  $('#scrim').addEventListener('click', function () {
    document.body.classList.remove('side-open');
  });
  // 桌面端收起侧栏
  var sideStyle = document.createElement('style');
  sideStyle.textContent = 'body[data-side-hidden] #sidebar{display:none}';
  document.head.appendChild(sideStyle);

  /* ---------- 键盘 ---------- */
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchOverlay.hidden) openSearch(); else closeSearch();
      return;
    }
    if (e.key === 'Escape') {
      if (!searchOverlay.hidden) return closeSearch();
      if (!$('#note-pop').hidden) return hideNote(true);
      settings.classList.remove('open');
      document.body.classList.remove('side-open');
      return;
    }
    if (!searchOverlay.hidden) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!current) return;
    if (e.key === 'ArrowLeft' && FLAT[current.idx - 1]) location.hash = '#/read/' + FLAT[current.idx - 1].id;
    if (e.key === 'ArrowRight' && FLAT[current.idx + 1]) location.hash = '#/read/' + FLAT[current.idx + 1].id;
  });

  function closeOverlays() {
    closeSearch();
    hideNote(true);
    settings.classList.remove('open');
    if (innerWidth <= 900) document.body.classList.remove('side-open');
  }

  /* ---------- 启动 ---------- */
  applyConf();
  window.addEventListener('hashchange', route);
  route();
})();
