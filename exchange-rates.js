/* S24News — أسعار صرف العملات والذهب
   وظيفتان في ملف واحد (على نمط prayer-times.js):
   1) خانة بجانب سطر الصلاة في الشريط العلوي (.top-date-bar) تتناوب بين الدولار وطقس دمشق،
      وسطر الصلاة ثابت لا يختفي (1 نوفمبر 2026) — الشاشات الكبيرة فقط.
   2) صفحة الأسعار الكاملة (العملات + الذهب) — عند وجود العنصر #s24-fx-page.
   المصدر: rates.json في المستودع نفسه، يكتبه Rates.gs في لوحة التحكم (آلياً أو يدوياً)،
   وweather-bar.json تكتبه مهمة «حالة الطقس» في GitHub Actions.
   لا يعدّل هذا الملف prayer-times.js ولا ui-core.js، ولا يلمس أصنافهما. */

(function () {
  'use strict';

  /* ======================= الإعدادات ======================= */

  var DATA_URL  = 'https://syria24news.github.io/s24news-assets/rates.json';
  var PAGE      = '/p/exchange.html';
  var ROTATE_MS = 6000;               // مدة ظهور الدولار أو الطقس قبل التبديل
  var CACHE_MIN = 30;                 // مدة الاحتفاظ بالنسخة المحلية بالدقائق
  var STALE_H   = 72;                 // بعدها يُخفى السعر من الشريط وتظهر ملاحظة في الصفحة (أسعار قديمة جداً)
  var BAR_UNIT  = 'new';              // 'new' = الليرة الجديدة (142.50) | 'old' = القديمة (14,250)

  /* ترتيب العملات وأسماؤها — الرمز يظهر شارةً بدل الأعلام (ويندوز لا يرسم أعلام الإيموجي) */
  var CURRENCIES = [
    { code: 'USD', name: 'الدولار الأمريكي' },
    { code: 'EUR', name: 'اليورو' },
    { code: 'TRY', name: 'الليرة التركية' },
    { code: 'SAR', name: 'الريال السعودي' },
    { code: 'AED', name: 'الدرهم الإماراتي' },
    { code: 'EGP', name: 'الجنيه المصري' },
    { code: 'JOD', name: 'الدينار الأردني' },
    { code: 'GBP', name: 'الجنيه الإسترليني' }
  ];

  var KARATS = [
    { key: '24', name: 'عيار 24' },
    { key: '21', name: 'عيار 21' },
    { key: '18', name: 'عيار 18' },
    { key: '14', name: 'عيار 14' }
  ];

  /* ======================= أدوات مشتركة ======================= */

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function num(v) { v = parseFloat(v); return isFinite(v) && v > 0 ? v : null; }

  /* أرقام لاتينية بفواصل الآلاف، كبقية الموقع */
  function fmt(v, dec) {
    if (v == null) return '—';
    return Number(v).toLocaleString('en-US', {
      minimumFractionDigits: dec, maximumFractionDigits: dec
    });
  }

  /* الليرة الجديدة بخانتين، والقديمة (×100) بلا كسور */
  function fmtNew(v) { return fmt(v, v != null && v < 1000 ? 2 : 0); }
  function fmtOld(v) { return v == null ? '—' : fmt(Math.round(v * 100), 0); }

  /* وقت آخر تحديث بتوقيت دمشق — يُستخدم في الصفحة فقط، لا في الشريط
     (prayer-times.js يبحث في الشريط عن أي نص بصيغة ساعة ليلتصق به) */
  function damascusTime(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return new Intl.DateTimeFormat('ar-SY-u-nu-latn', {
        timeZone: 'Asia/Damascus', weekday: 'long', day: 'numeric', month: 'long',
        hour: 'numeric', minute: '2-digit', hour12: true
      }).format(d);
    } catch (e) { return ''; }
  }

  function ageHours(iso) {
    var t = new Date(iso).getTime();
    return isFinite(t) ? (Date.now() - t) / 3600000 : Infinity;
  }

  /* ---- جلب البيانات: نسخة محلية لنصف ساعة، ثم طلب واحد ----
     معامل t يتغيّر كل نصف ساعة فقط، فيبقى الطلب قابلاً للتخزين المؤقت */

  var CACHE_KEY = 's24fx:v1';
  var pending = null;

  function loadRates() {
    if (pending) return pending;

    var hit = null;
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      hit = raw ? JSON.parse(raw) : null;
    } catch (e) {}
    if (hit && hit.at && (Date.now() - hit.at) < CACHE_MIN * 60000 && hit.data) {
      pending = Promise.resolve(hit.data);
      return pending;
    }

    var bucket = Math.floor(Date.now() / (CACHE_MIN * 60000));
    pending = fetch(DATA_URL + '?t=' + bucket).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || j.v !== 1) throw new Error('bad payload');
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: j })); } catch (e) {}
      return j;
    }).catch(function (e) {
      pending = null;
      /* عند فشل الشبكة نعود إلى آخر نسخة محفوظة مهما كان عمرها */
      if (hit && hit.data) return hit.data;
      throw e;
    });
    return pending;
  }

  function usd(data) {
    var m = data && data.market && data.market.USD;
    return m && num(m.buy) && num(m.sell) ? m : null;
  }

  /* ======================= 1) الشريط العلوي ======================= */

  /* 1 نوفمبر 2026: سطر الصلاة ثابت لا يختفي، وبجانبه خانة واحدة تتناوب كل ROTATE_MS
     بين الدولار وطقس دمشق. أي عنصر غير متاح (فشل الجلب أو بيانات قديمة) يغيب وحده،
     والآخر يبقى ثابتاً بلا تناوب. طقس دمشق من weather-bar.json (نحو 2 كيلوبايت) الذي
     تكتبه مهمة «حالة الطقس» في GitHub مع weather.json. */
  var WX_BAR_URL = 'https://syria24news.github.io/s24news-assets/weather-bar.json';
  var WX_PAGE    = '/p/weather.html#damascus';
  var WX_STALE_H = 12;   // بعدها لا يظهر الطقس في الشريط
  var WX_KEY     = 's24wxbar:v1';

  var BAR_CSS =
    '.s24-fx-bar{display:inline;text-decoration:none;white-space:nowrap;cursor:pointer}' +
    '.s24-fx-bar::before{content:"|";opacity:.45;margin:0 8px}' +
    '.s24-fx-bar:hover{text-decoration:none;opacity:.7}' +
    '.s24-fx-bar i{font-style:normal;margin-inline-start:6px;font-variant-numeric:tabular-nums}' +
    '.s24-fx-bar b{font-weight:inherit;font-size:.85em;margin-inline-start:6px}' +
    '.s24-fx-bar b.up{color:#2e9e3f}.s24-fx-bar b.down{color:#d93025}' +
    /* تبديل المحتوى بتلاشٍ لوني فقط، بلا حركة */
    '.s24-fx-bar.is-in{animation:s24fxIn .35s ease}' +
    '@keyframes s24fxIn{from{opacity:0}to{opacity:1}}' +
    '@media(prefers-reduced-motion:reduce){.s24-fx-bar.is-in{animation:none}}';

  /* طقس دمشق: نسخة محلية لنصف ساعة ثم طلب واحد (مثل loadRates) */
  function loadWxBar() {
    var hit = null;
    try { var raw = localStorage.getItem(WX_KEY); hit = raw ? JSON.parse(raw) : null; } catch (e) {}
    if (hit && hit.at && (Date.now() - hit.at) < CACHE_MIN * 60000 && hit.data) return Promise.resolve(hit.data);
    var bucket = Math.floor(Date.now() / (CACHE_MIN * 60000));
    return fetch(WX_BAR_URL + '?t=' + bucket).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || j.v !== 1 || !j.hours || !j.hours.length) throw new Error('bad payload');
      try { localStorage.setItem(WX_KEY, JSON.stringify({ at: Date.now(), data: j })); } catch (e) {}
      return j;
    }).catch(function (e) {
      if (hit && hit.data) return hit.data;
      throw e;
    });
  }

  /* حرارة الساعة الأقرب إلى وقت الزائر (القيمة تبقى صحيحة بين تحديث وآخر) */
  function wxNow(j) {
    if (!j || ageHours(j.updated) > WX_STALE_H) return null;
    var now = Date.now(), best = null;
    for (var i = 0; i < j.hours.length; i++) {
      if (new Date(j.hours[i].t).getTime() <= now + 30 * 60000) best = j.hours[i]; else break;
    }
    return best && typeof best.c === 'number' ? best : null;
  }

  function initTopBar() {
    var bar = document.querySelector('.top-date-bar');
    if (!bar) return;

    var items = [];          // [{ key:'fx'|'wx', href, title, html }]
    var idx = 0;
    var hovered = false;

    var style = el('style');
    style.textContent = BAR_CSS;
    document.head.appendChild(style);

    var slot = document.createElement('a');
    slot.id = 's24-fx-bar';
    slot.className = 's24-fx-bar';

    /* الشريط مخفي بـ CSS على الموبايل (s24-main.css) — لا تناوب عندها */
    function barVisible() {
      return window.getComputedStyle(bar).display !== 'none';
    }

    function prayerLink() {
      var l = document.getElementById('s24-next-prayer');
      return l && bar.contains(l) ? l : null;
    }

    /* نص الدولار: «الدولار 142.50 ▲» — بلا أي وقت بصيغة ساعة
       (prayer-times.js يبحث في الشريط عن أي نص بصيغة ساعة ليلتصق به) */
    function fxHtml(data) {
      var m = usd(data);
      var v = BAR_UNIT === 'old' ? fmtOld(m.sell) : fmtNew(m.sell);
      var chg = parseFloat(m.chg), arrow = '';
      if (isFinite(chg) && chg > 0) arrow = '<b class="up">▲</b>';
      else if (isFinite(chg) && chg < 0) arrow = '<b class="down">▼</b>';
      /* ارتفاع الدولار = تراجع الليرة؛ اللون يصف حركة الدولار كما في جداول الصرف المعتادة */
      return 'الدولار<i>' + v + '</i>' + arrow;
    }

    /* نص الطقس: «طقس دمشق 21°» — الدرجة باتجاه يسار←يمين حتى لا تنقلب إلى «°21» */
    function wxHtml(h) {
      return 'طقس دمشق<i dir="ltr">' + Math.round(h.c) + '°</i>';
    }

    /* نسخ الخط واللون من رابط الصلاة نفسه، فيتطابق الشكل تماماً */
    function copyLook() {
      var l = prayerLink();
      var src = l || document.getElementById('hijri-gregorian-date');
      if (!src) return;
      var cs = window.getComputedStyle(src);
      slot.style.fontFamily    = cs.fontFamily;
      slot.style.fontSize      = cs.fontSize;
      slot.style.letterSpacing = cs.letterSpacing;
      slot.style.color         = cs.color;
      slot.style.fontWeight    = l ? (l.style.fontWeight || cs.fontWeight) : cs.fontWeight;
    }

    function show(i, animate) {
      var it = items[i];
      if (!it) return;
      slot.href = it.href;
      slot.title = it.title;
      slot.innerHTML = it.html;
      if (animate) { slot.classList.remove('is-in'); void slot.offsetWidth; slot.classList.add('is-in'); }
    }

    /* ui-core.js يعيد كتابة #hijri-gregorian-date كل دقيقة فيمحو العنصر؛
       prayer-times.js يعيد رابط الصلاة، وهذه الدالة تعيد الخانة بعده مباشرة.
       لا تحريك إلا إذا كان الموضع خاطئاً — تجنّباً لحلقة بين المراقبَين */
    var restoring = false;
    function ensure() {
      if (restoring || !items.length) return;
      var l = prayerLink();
      var anchorParent, anchorNext;
      if (l) {
        if (l.nextSibling === slot) return;
        anchorParent = l.parentNode; anchorNext = l.nextSibling;
      } else {
        var d = document.getElementById('hijri-gregorian-date');
        if (!d) return;
        if (slot.parentNode === d && !slot.nextSibling) return;
        anchorParent = d; anchorNext = null;
      }
      restoring = true;
      anchorParent.insertBefore(slot, anchorNext);
      copyLook();
      restoring = false;
    }

    function rotate() {
      if (items.length < 2 || hovered || document.hidden || !barVisible()) return;
      idx = (idx + 1) % items.length;
      copyLook();
      show(idx, true);
    }

    /* الإيقاف عند مرور الفأرة فوق الخانة */
    slot.addEventListener('mouseenter', function () { hovered = true; });
    slot.addEventListener('mouseleave', function () { hovered = false; });

    /* العنصران يُجلبان معاً؛ فشل أحدهما لا يمنع الآخر */
    function settle(p) { return p.then(function (v) { return v; }, function () { return null; }); }
    Promise.all([settle(loadRates()), settle(loadWxBar())]).then(function (res) {
      var fx = res[0], wx = res[1];
      if (fx && usd(fx) && ageHours(fx.updated) <= STALE_H)
        items.push({ key: 'fx', href: PAGE, title: 'أسعار صرف العملات والذهب', html: fxHtml(fx) });
      var h = wxNow(wx);
      if (h) items.push({ key: 'wx', href: WX_PAGE, title: 'حالة الطقس في سوريا', html: wxHtml(h) });
      if (!items.length) return;   // لا شيء صالح للعرض: الشريط كما هو

      show(0, false);
      ensure();

      if (window.MutationObserver) {
        /* أي تغيير في الشريط (إعادة كتابة التاريخ أو سطر الصلاة) يُفحص فوراً */
        new MutationObserver(function () { ensure(); })
          .observe(bar, { childList: true, subtree: true });
      }
      setInterval(function () { ensure(); rotate(); }, ROTATE_MS);
    });
  }

  /* ======================= 2) صفحة الأسعار ======================= */

  var PAGE_CSS = [
    '#s24-fx-page{direction:rtl;text-align:right;font-family:var(--font-main,inherit);line-height:1.7}',
    '#s24-fx-page *{box-sizing:border-box}',
    '#s24-fx-page [hidden]{display:none!important}',
    '.s24fx-note:empty,.s24fx-meta:empty{display:none}',
    '.s24fx-tabs{display:flex;gap:8px;padding-bottom:14px;border-bottom:1px solid rgba(128,128,128,.28);margin-bottom:16px}',
    '.s24fx-tabs button{font:inherit;font-size:15px;font-weight:600;color:inherit;background:transparent;border:1px solid rgba(128,128,128,.35);border-radius:999px;padding:6px 18px;cursor:pointer;transition:background .15s ease,border-color .15s ease}',
    '.s24fx-tabs button:hover{border-color:rgba(128,128,128,.6)}',
    '.s24fx-tabs button[aria-selected="true"]{background:var(--sy-green,#77bd1d);border-color:var(--sy-green,#77bd1d);color:#fff}',
    '.s24fx-tabs button:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(119,189,29,.35)}',
    '.s24fx-meta{font-size:14px;opacity:.8;margin-bottom:14px}',
    '.s24fx-meta b{font-weight:600}',
    '.s24fx-hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:22px}',
    '.s24fx-card{padding:14px 12px;border:1px solid rgba(128,128,128,.25);border-radius:8px}',
    '.s24fx-card em{display:block;font-style:normal;font-size:13px;opacity:.75;margin-bottom:4px}',
    '.s24fx-card strong{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;font-family:var(--font-title,inherit)}',
    '.s24fx-card small{display:block;font-size:12px;opacity:.65;font-variant-numeric:tabular-nums}',
    '.s24fx-card.is-main{border-color:var(--sy-green,#77bd1d);background-image:linear-gradient(rgba(119,189,29,.09),rgba(119,189,29,.09))}',
    '.s24fx-h{margin:22px 0 10px;font-size:17px;font-weight:600;font-family:var(--font-title,inherit)}',
    '.s24fx-scroll{overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid rgba(128,128,128,.22);border-radius:8px}',
    '.s24fx-table{width:100%;min-width:440px;border-collapse:separate;border-spacing:0;font-size:15px}',
    '.s24fx-table th,.s24fx-table td{padding:10px 8px;text-align:center;border-bottom:1px solid rgba(128,128,128,.22);font-variant-numeric:tabular-nums}',
    '.s24fx-table tr:last-child td{border-bottom:0}',
    '.s24fx-table th{font-weight:600;font-size:13px;white-space:nowrap;background-image:linear-gradient(rgba(119,189,29,.14),rgba(119,189,29,.14))}',
    '.s24fx-table td:first-child,.s24fx-table th:first-child{text-align:right;white-space:nowrap}',
    '.s24fx-table td small{display:block;font-size:12px;opacity:.6}',
    '.s24fx-code{display:inline-block;min-width:42px;margin-inline-end:8px;padding:1px 6px;border-radius:4px;font-size:12px;font-weight:700;text-align:center;letter-spacing:.04em;background:rgba(128,128,128,.14)}',
    '.s24fx-up{color:#2e9e3f}.s24fx-down{color:#d93025}.s24fx-flat{opacity:.6}',
    '.s24fx-note{margin-top:20px;margin-bottom:24px;padding:12px 14px;border-inline-start:3px solid var(--sy-green,#77bd1d);background:rgba(128,128,128,.08);border-radius:6px;font-size:13.5px;line-height:1.8}',
    '.s24fx-note p{margin:0 0 6px}.s24fx-note p:last-child{margin:0}',
    '.s24fx-note a{color:inherit;text-decoration:underline}',
    '.s24fx-msg{padding:24px 0;font-size:15px;opacity:.8}',
    '.s24fx-warn{margin-bottom:14px;padding:10px 12px;border-radius:6px;font-size:14px;background:rgba(217,48,37,.08);border:1px solid rgba(217,48,37,.3)}',
    '@media(max-width:600px){.s24fx-card strong{font-size:19px}.s24fx-table{font-size:14px}}'
  ].join('');

  var SOURCES = {
    sptoday: { name: 'موقع الليرة اليوم', url: 'https://sp-today.com/' },
    manual:  { name: 'رصد سوريا 24',      url: '' },
    cb:      { name: 'مصرف سوريا المركزي', url: 'https://cb.gov.sy/' }
  };

  function sourceHtml(id) {
    var s = SOURCES[id];
    if (!s) return '';
    return s.url ? '<a href="' + s.url + '" target="_blank" rel="noopener">' + s.name + '</a>' : s.name;
  }

  function chgCell(v) {
    v = parseFloat(v);
    if (!isFinite(v) || v === 0) return '<span class="s24fx-flat">0%</span>';
    var cls = v > 0 ? 's24fx-up' : 's24fx-down';
    return '<span class="' + cls + '">' + (v > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(v), 2) + '%</span>';
  }

  /* خلية السعر: الليرة الجديدة، وتحتها المكافئ بالقديمة */
  function priceCell(v) {
    v = num(v);
    if (v == null) return '—';
    return fmtNew(v) + '<small>' + fmtOld(v) + ' قديمة</small>';
  }

  function initPage() {
    var root = document.getElementById('s24-fx-page');
    if (!root) return;

    var style = el('style');
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);

    root.innerHTML = '';

    var tabs = el('div', 's24fx-tabs');
    tabs.setAttribute('role', 'tablist');
    var bCur  = el('button', '', 'العملات');
    var bGold = el('button', '', 'الذهب');
    [bCur, bGold].forEach(function (b) { b.type = 'button'; b.setAttribute('role', 'tab'); tabs.appendChild(b); });

    var meta  = el('div', 's24fx-meta');
    var warn  = el('div', 's24fx-warn');
    var pCur  = el('section');
    var pGold = el('section');
    pGold.id = 'gold';
    var note  = el('div', 's24fx-note');
    var msg   = el('div', 's24fx-msg', 'جارٍ تحميل الأسعار…');
    warn.hidden = true;

    root.appendChild(tabs);
    root.appendChild(meta);
    root.appendChild(warn);
    root.appendChild(pCur);
    root.appendChild(pGold);
    root.appendChild(note);
    root.appendChild(msg);

    /* التبويب يُحفظ في الرابط: /p/exchange.html#gold يفتح الذهب مباشرة */
    function select(which) {
      var gold = which === 'gold';
      bCur.setAttribute('aria-selected', gold ? 'false' : 'true');
      bGold.setAttribute('aria-selected', gold ? 'true' : 'false');
      pCur.hidden = gold;
      pGold.hidden = !gold;
    }
    bCur.addEventListener('click', function () {
      select('cur');
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    });
    bGold.addEventListener('click', function () {
      select('gold');
      try { history.replaceState(null, '', '#gold'); } catch (e) {}
    });
    window.addEventListener('hashchange', function () { select(location.hash === '#gold' ? 'gold' : 'cur'); });
    select(location.hash === '#gold' ? 'gold' : 'cur');

    loadRates().then(function (d) {
      /* ملف فارغ (قبل أول تحديث من اللوحة): رسالة بدل جداول خاوية */
      if (!usd(d) && !(d.gold && Object.keys(d.gold).length)) {
        msg.textContent = 'الأسعار قيد الإعداد، وستظهر هنا قريباً.';
        tabs.hidden = true;
        return;
      }
      msg.remove();
      var src = (d.source && d.source.market) || 'manual';

      meta.innerHTML = 'آخر تحديث: <b>' + (damascusTime(d.updated) || '—') + '</b> بتوقيت دمشق';
      if (ageHours(d.updated) > STALE_H) {
        warn.hidden = false;
        warn.textContent = 'تنبيه: هذه الأسعار لم تُحدَّث منذ أكثر من ثلاثة أيام، وقد لا تعكس السوق الحالية.';
      }

      /* ---- العملات ---- */
      var m = d.market || {};
      var u = usd(d);
      var off = d.official && d.official.USD;
      var hero = el('div', 's24fx-hero');
      if (u) {
        hero.appendChild(el('div', 's24fx-card is-main',
          '<em>الدولار — سعر المبيع في السوق</em><strong>' + fmtNew(u.sell) + '</strong><small>' + fmtOld(u.sell) + ' ليرة قديمة</small>'));
        hero.appendChild(el('div', 's24fx-card',
          '<em>الدولار — سعر الشراء في السوق</em><strong>' + fmtNew(u.buy) + '</strong><small>' + fmtOld(u.buy) + ' ليرة قديمة</small>'));
      }
      if (off && num(off.sell)) {
        hero.appendChild(el('div', 's24fx-card',
          '<em>الدولار — السعر الرسمي (المصرف المركزي)</em><strong>' + fmtNew(off.sell) + '</strong><small>' + fmtOld(off.sell) + ' ليرة قديمة</small>'));
      }
      pCur.appendChild(hero);

      var rows = '';
      CURRENCIES.forEach(function (c) {
        var r = m[c.code];
        if (!r || (!num(r.buy) && !num(r.sell))) return;
        rows += '<tr><td><span class="s24fx-code">' + c.code + '</span>' + c.name + '</td>' +
                '<td>' + priceCell(r.buy) + '</td><td>' + priceCell(r.sell) + '</td><td>' + chgCell(r.chg) + '</td></tr>';
      });
      if (rows) {
        pCur.appendChild(el('h2', 's24fx-h', 'أسعار العملات مقابل الليرة السورية في السوق'));
        var sc = el('div', 's24fx-scroll');
        sc.appendChild(el('table', 's24fx-table',
          '<thead><tr><th>العملة</th><th>شراء</th><th>مبيع</th><th>التغيّر</th></tr></thead><tbody>' + rows + '</tbody>'));
        pCur.appendChild(sc);
      }

      /* النشرة الرسمية إن وُجدت */
      var offRows = '';
      CURRENCIES.forEach(function (c) {
        var r = d.official && d.official[c.code];
        if (!r || (!num(r.buy) && !num(r.sell))) return;
        offRows += '<tr><td><span class="s24fx-code">' + c.code + '</span>' + c.name + '</td>' +
                   '<td>' + priceCell(r.buy) + '</td><td>' + priceCell(r.sell) + '</td></tr>';
      });
      if (offRows) {
        pCur.appendChild(el('h2', 's24fx-h', 'النشرة الرسمية — مصرف سوريا المركزي'));
        var sc2 = el('div', 's24fx-scroll');
        sc2.appendChild(el('table', 's24fx-table',
          '<thead><tr><th>العملة</th><th>شراء</th><th>مبيع</th></tr></thead><tbody>' + offRows + '</tbody>'));
        pCur.appendChild(sc2);
      }

      /* ---- الذهب ---- */
      var g = d.gold || {};
      var gRows = '';
      KARATS.forEach(function (k) {
        var r = g[k.key];
        if (!r || (!num(r.buy) && !num(r.sell))) return;
        gRows += '<tr><td>' + k.name + '</td><td>' + priceCell(r.buy) + '</td><td>' + priceCell(r.sell) + '</td></tr>';
      });
      var gHero = el('div', 's24fx-hero');
      if (g['21'] && num(g['21'].sell)) {
        gHero.appendChild(el('div', 's24fx-card is-main',
          '<em>غرام الذهب عيار 21 — مبيع</em><strong>' + fmtNew(g['21'].sell) + '</strong><small>' + fmtOld(g['21'].sell) + ' ليرة قديمة</small>'));
      }
      if (num(d.ounceUsd)) {
        gHero.appendChild(el('div', 's24fx-card',
          '<em>الأونصة عالمياً</em><strong>' + fmt(d.ounceUsd, 2) + '</strong><small>دولار أمريكي</small>'));
      }
      pGold.appendChild(gHero);
      if (gRows) {
        pGold.appendChild(el('h2', 's24fx-h', 'أسعار غرام الذهب في سوريا بالليرة السورية'));
        var sc3 = el('div', 's24fx-scroll');
        sc3.appendChild(el('table', 's24fx-table',
          '<thead><tr><th>العيار</th><th>شراء</th><th>مبيع</th></tr></thead><tbody>' + gRows + '</tbody>'));
        pGold.appendChild(sc3);
      } else {
        pGold.appendChild(el('div', 's24fx-msg', 'أسعار الذهب غير متاحة حالياً.'));
      }

      /* ---- الملاحظة الثابتة: المصرف المركزي ومصدر السوق ---- */
      var goldSrc = (d.source && d.source.gold) || src;
      note.innerHTML =
        '<p>الأسعار بالليرة السورية الجديدة، وتحت كل سعر ما يعادله بالليرة القديمة (الليرة الجديدة = 100 ليرة قديمة).</p>' +
        '<p>السعر الرسمي الموحّد يصدر في النشرة الرسمية لـ' + sourceHtml('cb') +
        '، وهو المرجع المعتمد للمصارف ومؤسسات الصرافة المرخّصة.</p>' +
        '<p>أسعار السوق تقريبية وللاستئناس، وقد تختلف بين المحافظات ومحال الصرافة. مصدرها: ' + sourceHtml(src) +
        (goldSrc !== src ? '، والذهب: ' + sourceHtml(goldSrc) : '') + '.</p>';
    }).catch(function () {
      msg.textContent = 'تعذّر جلب الأسعار الآن. تحقّق من الاتصال ثم أعد تحميل الصفحة.';
    });
  }

  /* ======================= التشغيل ======================= */

  function boot() {
    initTopBar();
    initPage();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
