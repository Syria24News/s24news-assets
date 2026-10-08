/**
 * =========================================================================
 * Syria24News — الاقتراحات الذكية لصفحة الموسوعة (v2_predictive.js)
 * =========================================================================
 * ملف مستقل بالكامل: يحقن تنسيقه، وينشئ قائمة الاقتراحات تحت مربع البحث
 * (#s24-glossary-search)، ويجلب بياناته بنفسه. لا يحتاج أي HTML أو CSS
 * داخل الصفحة، ولا يعدّل سكربت البحث الأصلي.
 *
 * الإضافة في صفحة الموسوعة: سطر واحد بعد سكربت البحث:
 *   <script src="https://syria24news.github.io/s24news-assets/v2_predictive.js"></script>
 *
 * طريقة الترتيب (مع تطبيع عربي: تشكيل، أ/إ/آ، ى، ة):
 *   100 مطابقة تامة · 90 يبدأ بالنص · 75 كلمة داخله تبدأ بالنص
 *    60 يحتوي النص · 40 خطأ إملائي بحرف واحد (للكلمات من 4 أحرف فأكثر)
 *   يُجمع الاسم الأصلي وأسماؤه البديلة في اقتراح واحد بأعلى درجة.
 *
 * البيانات: نفس فهرس Firestore (glossary/index) بكاش مستقل 6 ساعات.
 * =========================================================================
 */
(function () {
  'use strict';

  // ===== الإعدادات =====
  var INDEX_URL = 'https://firestore.googleapis.com/v1/projects/s24n-views/databases/(default)/documents/glossary/index?mask.fieldPaths=json';
  var CACHE_KEY = 's24_predictive_raw_v1';
  var CACHE_TTL = 6 * 60 * 60 * 1000;
  var MAX_ITEMS = 8;
  var MIN_CHARS = 2;

  // ===== التطبيع العربي =====
  function norm(s) {
    return String(s || '')
      .replace(/[ً-ْـ]/g, '')      // التشكيل والتطويل
      .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ ← ا
      .replace(/ى/g, 'ي')               // ى ← ي
      .replace(/ة/g, 'ه')               // ة ← ه
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // ===== مسافة ليفنشتاين (لتصحيح خطأ إملائي بحرف واحد) =====
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  // هل بداية النص s قريبة من q بفارق حرف واحد؟
  function near(s, q) {
    for (var d = -1; d <= 1; d++) {
      if (lev(s.slice(0, q.length + d), q) <= 1) return true;
    }
    return false;
  }

  // ===== درجة تطابق مصطلح واحد مع النص المكتوب =====
  function score(term, q) {
    if (term === q) return 100;
    if (term.indexOf(q) === 0) return 90;
    var words = term.split(' ');
    for (var i = 0; i < words.length; i++) {
      if (words[i].indexOf(q) === 0) return 75;
    }
    if (term.indexOf(q) > -1) return 60;
    if (q.length >= 4) {
      // يقارن النص المكتوب ببداية المصطلح وبكل كلمة فيه
      // نجرّب أطوال البداية (الطول ±1) حتى يُكتشف الحرف الناقص أو الزائد
      if (near(term, q)) return 40;
      for (var k = 0; k < words.length; k++) {
        if (near(words[k], q)) return 40;
      }
    }
    return 0;
  }

  /**
   * حساب الاقتراحات
   * @param {Array} list  مصفوفة الفهرس الخام [{term, url}] — أول مدخل لكل رابط هو العنوان الأصلي
   * @param {string} query النص المكتوب
   * @param {number} max   الحد الأقصى
   * @returns {Array} [{title, url, via, score}] — via = الاسم البديل الذي طابق (إن لم يكن العنوان)
   */
  function getSuggestions(list, query, max) {
    var q = norm(query);
    if (q.length < MIN_CHARS || !Array.isArray(list)) return [];

    var byUrl = {}, order = [];
    list.forEach(function (it) {
      if (!it || !it.term || !it.url) return;
      var u = it.url;
      if (!byUrl[u]) { byUrl[u] = { title: it.term, url: u, via: '', score: 0 }; order.push(u); }
      var s = score(norm(it.term), q);
      if (s > byUrl[u].score) {
        byUrl[u].score = s;
        byUrl[u].via = (it.term === byUrl[u].title) ? '' : it.term;
      }
    });

    return order
      .map(function (u) { return byUrl[u]; })
      .filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score || a.title.length - b.title.length; })
      .slice(0, max || MAX_ITEMS);
  }

  // واجهة عامة (مفيدة للاختبار من الكونسول)
  window.S24_Predictive = { getSuggestions: getSuggestions, normalize: norm };

  // ===== من هنا: الربط بالصفحة — يعمل فقط إن وُجد مربع بحث الموسوعة =====
  var input = document.getElementById('s24-glossary-search');
  if (!input) return;

  // ----- البيانات (مع كاش) -----
  var data = null;

  function loadData() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && c.ts && Date.now() - c.ts < CACHE_TTL && Array.isArray(c.list)) {
        data = c.list;
        return;
      }
    } catch (e) {}

    fetch(INDEX_URL)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        var list = JSON.parse(d.fields.json.stringValue);
        data = list;
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), list: list })); } catch (e) {}
        if (document.activeElement === input) update(); // إن كان الزائر يكتب أثناء التحميل
      })
      .catch(function (err) { console.warn('[S24 Predictive]', err); });
  }

  // ----- التنسيق -----
  var css =
    '.s24-pred{position:relative;direction:rtl;margin:-6px 0 12px}' +
    '.s24-pred ul{display:none;list-style:none;margin:0;padding:0;background:var(--s24-bg-card,#fff);border:2px solid #77bd1d;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.12);max-height:320px;overflow-y:auto}' +
    '.s24-pred.open ul{display:block}' +
    '.s24-pred li{display:flex;align-items:baseline;gap:8px;padding:10px 12px;border-bottom:1px solid var(--s24-border,#eee);cursor:pointer;font-size:14px;line-height:1.4;color:var(--s24-text-main,#000)}' +
    '.s24-pred li:last-child{border-bottom:none}' +
    '.s24-pred li.on,.s24-pred li:hover{background:rgba(119,189,29,.12);color:#77bd1d}' +
    '.s24-pred .via{font-size:12px;color:var(--s24-text-sec,#777)}' +
    '.s24-pred mark{background:none;color:#77bd1d;font-weight:700}' +
    '[data-theme="dark"] .s24-pred ul{background:#1e1e1e}' +
    '[data-theme="dark"] .s24-pred li{color:#e0e0e0;border-color:#333}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  // ----- عناصر القائمة -----
  var wrap = document.createElement('div');
  wrap.className = 's24-pred';
  var ul = document.createElement('ul');
  ul.id = 's24-pred-list';
  ul.setAttribute('role', 'listbox');
  wrap.appendChild(ul);
  input.parentNode.insertBefore(wrap, input.nextSibling);

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-controls', 's24-pred-list');
  input.setAttribute('aria-expanded', 'false');

  var items = [], active = -1;

  function close() {
    wrap.classList.remove('open');
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  }

  function go(url) {
    try {
      var u = new URL(url, location.href);
      if (u.protocol === 'http:' || u.protocol === 'https:') location.href = u.href;
    } catch (e) {}
  }

  function setActive(i) {
    var lis = ul.children;
    for (var k = 0; k < lis.length; k++) lis[k].classList.toggle('on', k === i);
    active = i;
    if (lis[i]) lis[i].scrollIntoView({ block: 'nearest' });
  }

  function render(list) {
    ul.innerHTML = '';
    items = list;
    if (!list.length) { close(); return; }

    list.forEach(function (s, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');

      var t = document.createElement('span');
      t.textContent = s.title; // textContent = حماية من حقن HTML
      li.appendChild(t);

      if (s.via) {
        var v = document.createElement('span');
        v.className = 'via';
        v.textContent = '← ' + s.via;
        li.appendChild(v);
      }

      // mousedown بدل click حتى لا يسبق blur الضغطة
      li.addEventListener('mousedown', function (e) { e.preventDefault(); go(s.url); });
      li.addEventListener('mouseenter', function () { setActive(i); });
      ul.appendChild(li);
    });

    wrap.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
    active = -1;
  }

  function update() {
    if (!data) return;
    render(getSuggestions(data, input.value, MAX_ITEMS));
  }

  // ----- الأحداث -----
  var timer;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(update, 150);
  });

  input.addEventListener('keydown', function (e) {
    if (!wrap.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && active > -1) { e.preventDefault(); go(items[active].url); }
    else if (e.key === 'Escape') { close(); }
  });

  input.addEventListener('blur', function () { setTimeout(close, 120); });
  input.addEventListener('focus', function () { if (input.value) update(); });

  loadData();
})();
