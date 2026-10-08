/**
 * =========================================================================
 * Syria24News — نظام "مقالات ذات صلة" (Backlinks) — backlinks.js v1
 * =========================================================================
 * يُحمَّل من القالب بسطر واحد فقط، ولا يحتاج أي HTML أو CSS داخل القالب.
 *
 * مصدر البيانات: مجموعة glossary_relations في Firestore
 *   - معرّف كل مستند = مسار المقال المصدر، مثال:
 *       /2026/09/Camp-Bucca.html  ←→  2026_09_Camp-Bucca
 *   - الحقل json = مصفوفة روابط المقال: [{ t: "الاسم", k: "bio|place|enc", u: "الرابط" }]
 *
 * ما يعرضه:
 *   1) الروابط الصادرة: المصطلحات التي يذكرها المقال الحالي (من مستنده مباشرة)
 *   2) الروابط الواردة: المقالات الأخرى التي تذكر المقال الحالي
 *   يُدمج الاثنان بلا تكرار، ويُستثنى المقال نفسه. إن لم توجد نتائج لا يظهر شيء.
 *
 * الأداء: نسخة كاملة من العلاقات تُخزَّن في localStorage لمدة 6 ساعات
 *         (طلب Firestore واحد لكل زائر كل 6 ساعات).
 * =========================================================================
 */
(function () {
  'use strict';

  // يعمل فقط في صفحة مقال مفرد (مسار بصيغة /YYYY/MM/slug.html)
  var PATH_RE = /^\/(\d{4})\/(\d{2})\/([^\/]+)\.html$/;
  if (!PATH_RE.test(location.pathname)) return;

  // ===== الإعدادات =====
  var API = 'https://firestore.googleapis.com/v1/projects/s24n-views/databases/(default)/documents/glossary_relations?pageSize=300&mask.fieldPaths=json';
  var CACHE_KEY = 's24_backlinks_v1';
  var CACHE_TTL = 6 * 60 * 60 * 1000; // 6 ساعات
  var MAX_ITEMS = 8;
  var ICONS = { bio: '👤', place: '📍', enc: '📚' };

  // ===== أدوات مساعدة =====

  // تحويل أي رابط إلى مسار موحّد للمقارنة (يُسقط النطاق و ?m=1 و #)
  function toPath(url) {
    try { return new URL(url, location.origin).pathname; } catch (e) { return ''; }
  }

  // تحويل معرّف المستند إلى مسار: 2026_09_Camp-Bucca → /2026/09/Camp-Bucca.html
  function docIdToPath(id) {
    var m = /^(\d{4})_(\d{2})_(.+)$/.exec(id);
    return m ? '/' + m[1] + '/' + m[2] + '/' + m[3] + '.html' : '';
  }

  // ===== الكاش =====
  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && c.ts && Date.now() - c.ts < CACHE_TTL && c.map) return c.map;
    } catch (e) {}
    return null;
  }
  function writeCache(map) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), map: map })); } catch (e) {}
  }

  // ===== جلب العلاقات: { "/2026/09/x.html": { title, links:[...] } } =====
  function loadRelations() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);

    return fetch(API)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var map = {};
        (data.documents || []).forEach(function (doc) {
          var id = doc.name.split('/').pop();
          var path = docIdToPath(id);
          if (!path) return;
          var links = [];
          try {
            var raw = doc.fields && doc.fields.json && doc.fields.json.stringValue;
            links = raw ? JSON.parse(raw) : [];
          } catch (e) { links = []; }
          map[path] = Array.isArray(links) ? links : [];
        });
        writeCache(map);
        return map;
      });
  }

  // ===== بناء قائمة النتائج للمقال الحالي =====
  function buildItems(map) {
    var here = location.pathname;
    var seen = {};
    var items = [];
    seen[here] = true; // استثناء المقال نفسه

    function add(title, url, kind) {
      var p = toPath(url);
      if (!p || seen[p] || !title) return;
      seen[p] = true;
      items.push({ t: title, u: url, k: kind });
    }

    // 1) الروابط الصادرة من هذا المقال
    (map[here] || []).forEach(function (l) { add(l.t, l.u, l.k); });

    // 2) الروابط الواردة: كل مقال يحتوي رابطاً إلى هذا المقال
    Object.keys(map).forEach(function (srcPath) {
      var hit = map[srcPath].some(function (l) { return toPath(l.u) === here; });
      if (!hit) return;
      // عنوان المقال المصدر غير مخزّن في البيانات، فنأخذه من آخر جزء في المسار مؤقتاً
      // ثم نستبدله بالعنوان الحقيقي إن ذكره مقال آخر بالاسم
      var title = null;
      Object.keys(map).some(function (p) {
        return map[p].some(function (l) {
          if (toPath(l.u) === srcPath) { title = l.t; return true; }
          return false;
        });
      });
      add(title || decodeURIComponent(srcPath.split('/').pop().replace('.html', '')).replace(/[-_]/g, ' '),
          location.origin + srcPath, 'in');
    });

    return items.slice(0, MAX_ITEMS);
  }

  // ===== التنسيق (يُحقن مرة واحدة) =====
  function injectCSS() {
    if (document.getElementById('s24-bl-css')) return;
    var css =
      '.s24-bl{margin:30px 0;padding:18px 20px;background:var(--s24-bg-card,#fff);border:1px solid var(--s24-border,#e5e5e5);border-right:4px solid #77bd1d;border-radius:8px;direction:rtl;font-family:var(--font-main,"Readex Pro",sans-serif)}' +
      '.s24-bl-title{margin:0 0 14px;font-family:var(--font-title,"IBM Plex Sans Arabic",sans-serif);font-size:18px;font-weight:700;color:var(--s24-text-main,#222);display:flex;align-items:center;gap:8px}' +
      '.s24-bl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}' +
      '.s24-bl-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:12px 8px;border:1.5px solid var(--s24-border,#ddd);border-radius:6px;background:transparent;color:inherit!important;text-decoration:none!important;text-align:center;font-size:13px;font-weight:500;line-height:1.35;word-break:break-word;transition:border-color .2s,color .2s,background-color .2s}' +
      '.s24-bl-item:hover{border-color:#77bd1d;color:#77bd1d!important;background:rgba(119,189,29,.08)}' +
      '.s24-bl-ico{font-size:20px;line-height:1}' +
      '[data-theme="dark"] .s24-bl{background:#1e1e1e;border-color:#333}' +
      '[data-theme="dark"] .s24-bl-title{color:#fff}' +
      '[data-theme="dark"] .s24-bl-item{border-color:#444;color:#e0e0e0!important}' +
      '@media(max-width:480px){.s24-bl{padding:14px}.s24-bl-grid{grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}}';
    var s = document.createElement('style');
    s.id = 's24-bl-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ===== العرض =====
  function render(items) {
    if (!items.length) return; // لا نتائج = لا يظهر القسم إطلاقاً

    var body = document.querySelector('.post-body.entry-content');
    if (!body || document.getElementById('s24-backlinks')) return;

    injectCSS();

    var box = document.createElement('section');
    box.className = 's24-bl';
    box.id = 's24-backlinks';
    box.setAttribute('aria-label', 'مقالات ذات صلة');

    var h = document.createElement('h3');
    h.className = 's24-bl-title';
    h.textContent = '🔗 مقالات ذات صلة';
    box.appendChild(h);

    var grid = document.createElement('div');
    grid.className = 's24-bl-grid';

    items.forEach(function (it) {
      var a = document.createElement('a');
      a.className = 's24-bl-item';
      a.href = it.u;
      a.title = it.t;

      var ico = document.createElement('span');
      ico.className = 's24-bl-ico';
      ico.textContent = ICONS[it.k] || '📄';

      var name = document.createElement('span');
      name.textContent = it.t; // textContent = حماية من حقن HTML

      a.appendChild(ico);
      a.appendChild(name);
      grid.appendChild(a);
    });

    box.appendChild(grid);
    // يوضع مباشرة بعد متن المقال
    body.parentNode.insertBefore(box, body.nextSibling);
  }

  // ===== التشغيل =====
  function start() {
    loadRelations()
      .then(function (map) { render(buildItems(map)); })
      .catch(function (err) { console.warn('[S24 Backlinks]', err); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // واجهة صغيرة للاختبار من الكونسول: S24_Backlinks.clearCache()
  window.S24_Backlinks = {
    clearCache: function () { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} }
  };
})();
