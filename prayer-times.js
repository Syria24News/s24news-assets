/* S24News — مواقيت الصلاة
   وظيفتان في ملف واحد:
   1) سطر الصلاة القادمة بجانب التاريخ في الشريط العلوي (.top-date-bar) — في كل الصفحات.
   2) صفحة المواقيت الكاملة — عند وجود العنصر #s24-prayer-page.
   المصدر: Aladhan API — طلب واحد لكل شهر لكل مدينة، مخزَّن محلياً ومشترك بين الوظيفتين. */

(function () {
  'use strict';

  /* ======================= الإعدادات ======================= */

  /* نمط عرض سطر الشريط العلوي — بدّل الكلمة وارفع الملف:
       'text'        تبديل نصّي: «الظهر بعد 4 دقائق» ← «أذان الظهر» ← «مضى أذان الظهر»
       'chip'        النص ثابت، وتظهر حوله رقاقة رمادية خلال النافذة
       'countdown'   عدّاد حيّ بالثواني ينزل حتى الأذان ثم يصعد بعده
       'window-only' السطر مخفيّ تماماً، ولا يظهر إلا داخل النافذة                */
  var STYLE  = 'text';

  var WINDOW = 5;                        // نافذة التمييز بالدقائق، قبل الأذان وبعده
  var METHOD = 3;                        // 3 = رابطة العالم الإسلامي (الفجر 18° / العشاء 17°)
  var SCHOOL = 0;                        // 0 = الجمهور، 1 = الحنفي (يؤخّر العصر)
  var TUNE   = '0,0,0,0,0,0,0,0,0';      // الإمساك,الفجر,الشروق,الظهر,العصر,المغرب,الغروب,العشاء,منتصف الليل
  var TZ     = 'Asia/Damascus';
  var PAGE   = '/p/prayer-times.html';
  var DEFAULT_CITY = 'damascus';

  var CITIES = [
    { id: 'damascus',  name: 'دمشق',      lat: 33.5138, lng: 36.2765 },
    { id: 'douma',     name: 'ريف دمشق',  lat: 33.5714, lng: 36.4021 },
    { id: 'aleppo',    name: 'حلب',       lat: 36.2021, lng: 37.1343 },
    { id: 'homs',      name: 'حمص',       lat: 34.7324, lng: 36.7137 },
    { id: 'hama',      name: 'حماة',      lat: 35.1318, lng: 36.7578 },
    { id: 'latakia',   name: 'اللاذقية',  lat: 35.5196, lng: 35.7915 },
    { id: 'tartus',    name: 'طرطوس',     lat: 34.8890, lng: 35.8866 },
    { id: 'idlib',     name: 'إدلب',      lat: 35.9306, lng: 36.6339 },
    { id: 'deirezzor', name: 'دير الزور', lat: 35.3359, lng: 40.1408 },
    { id: 'raqqa',     name: 'الرقة',     lat: 35.9594, lng: 39.0074 },
    { id: 'hasakah',   name: 'الحسكة',    lat: 36.5024, lng: 40.7477 },
    { id: 'daraa',     name: 'درعا',      lat: 32.6189, lng: 36.1021 },
    { id: 'suwayda',   name: 'السويداء',  lat: 32.7094, lng: 36.5695 },
    { id: 'quneitra',  name: 'القنيطرة',  lat: 33.1256, lng: 35.8244 }
  ];

  var ROWS = [
    { key: 'Imsak',   label: 'الإمساك', prayer: false },
    { key: 'Fajr',    label: 'الفجر',   prayer: true  },
    { key: 'Sunrise', label: 'الشروق',  prayer: false },
    { key: 'Dhuhr',   label: 'الظهر',   prayer: true  },
    { key: 'Asr',     label: 'العصر',   prayer: true  },
    { key: 'Maghrib', label: 'المغرب',  prayer: true  },
    { key: 'Isha',    label: 'العشاء',  prayer: true  }
  ];

  var MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
                'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

  /* ======================= أدوات مشتركة ======================= */

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function clean(t) { return String(t || '').split(' ')[0]; }

  function toMin(t) {
    var p = clean(t).split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  /* صيغة العرض. الشريط العلوي عندك بنظام 12 ساعة مع ص/م، فوحّدنا عليه.
     اجعل HOUR12 = false لتعود المواقيت إلى نظام 24 ساعة. */
  var HOUR12 = true;

  function fmt(t) {
    var s = clean(t);
    if (!HOUR12) return s;
    var p = s.split(':'), h = parseInt(p[0], 10);
    var suffix = h < 12 ? 'ص' : 'م';
    h = h % 12;
    if (h === 0) h = 12;
    return h + ':' + p[1] + ' ' + suffix;
  }

  function damascusNow() {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return {
      y: +o.year, m: +o.month, d: +o.day,
      minutes: (+o.hour) * 60 + (+o.minute),
      seconds: +o.second
    };
  }

  function cityById(id) {
    for (var i = 0; i < CITIES.length; i++) if (CITIES[i].id === id) return CITIES[i];
    return CITIES[0];
  }

  function savedCity() {
    var id = DEFAULT_CITY;
    try { id = localStorage.getItem('s24pt-city') || DEFAULT_CITY; } catch (e) {}
    return cityById(id);
  }

  function findDay(days, d) {
    for (var i = 0; i < days.length; i++) {
      if (parseInt(days[i].date.gregorian.day, 10) === d) return days[i];
    }
    return null;
  }

  /* الصلاة القادمة انطلاقاً من يوم ولحظة.
     يوم الجمعة تُسمّى صلاة الظهر «الجمعة». */
  function nextPrayer(days, d, minutes) {
    var day = findDay(days, d);
    if (!day) return null;
    var friday = day.date.hijri.weekday.ar === 'الجمعة';

    for (var i = 0; i < ROWS.length; i++) {
      var r = ROWS[i];
      if (!r.prayer) continue;
      if (toMin(day.timings[r.key]) > minutes) {
        return {
          key: r.key,
          label: (friday && r.key === 'Dhuhr') ? 'الجمعة' : r.label,
          time: clean(day.timings[r.key]),
          tomorrow: false
        };
      }
    }
    var next = findDay(days, d + 1) || day;   // آخر الشهر: فارق الفجر دون الدقيقة
    return { key: 'Fajr', label: 'الفجر', time: clean(next.timings.Fajr), tomorrow: true };
  }

  /* ---- التخزين المحلي: بيانات الشهر ثابتة، فتُحفظ بلا مدة صلاحية ---- */

  var pending = {};

  function loadMonth(city, y, m) {
    var key = 's24pt:' + city.id + ':' + y + '-' + m;
    if (pending[key]) return pending[key];

    var hit = null;
    try { var v = localStorage.getItem(key); hit = v ? JSON.parse(v) : null; } catch (e) {}
    if (hit) { pending[key] = Promise.resolve(hit); return pending[key]; }

    var url = 'https://api.aladhan.com/v1/calendar/' + y + '/' + m +
              '?latitude=' + city.lat + '&longitude=' + city.lng +
              '&method=' + METHOD + '&school=' + SCHOOL + '&tune=' + TUNE;

    pending[key] = fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || j.code !== 200 || !j.data) throw new Error('bad payload');
      try {
        var keys = [], i, n;
        for (i = 0; i < localStorage.length; i++) {
          n = localStorage.key(i);
          if (n && n.indexOf('s24pt:') === 0) keys.push(n);
        }
        keys.sort();
        while (keys.length >= 6) localStorage.removeItem(keys.shift());
        localStorage.setItem(key, JSON.stringify(j.data));
      } catch (e) { /* الحصّة ممتلئة أو التخزين معطّل */ }
      return j.data;
    }).catch(function (e) { delete pending[key]; throw e; });

    return pending[key];
  }

  /* ======================= 1) الشريط العلوي ======================= */

  var BAR_CSS =
    /* الأساس، مشترك بين الأنماط الأربعة */
    '.s24-next-prayer{text-decoration:none;white-space:nowrap;cursor:pointer;' +
    'transition:opacity .15s ease,background-color .25s ease,border-color .25s ease}' +
    '.s24-next-prayer:empty{display:none}' +
    '.s24-next-prayer::before{content:"|";opacity:.45;margin:0 8px}' +
    '.s24-next-prayer:hover{text-decoration:none;opacity:.7}' +
    '.s24-next-prayer i{font-style:normal;margin-inline-start:6px}' +

    /* التمييز النصّي — يستخدمه text و countdown و window-only */
    '.s24-next-prayer.is-soon{font-weight:700}' +
    '.s24-next-prayer.is-now{font-weight:700;animation:s24npPulse 1.8s ease-in-out infinite}' +
    '@keyframes s24npPulse{0%,100%{opacity:1}50%{opacity:.45}}' +
    '@media(prefers-reduced-motion:reduce){.s24-next-prayer.is-now{animation:none}}' +

    /* الرقاقة — الفاصل | يُلغى لأنه سيقع داخل الرقاقة لا خارجها */
    '.s24-next-prayer.is-chip::before{content:none}' +
    '.s24-next-prayer.is-chip{margin-inline-start:12px;border:1px solid transparent;' +
    'border-radius:999px;padding:2px 10px}' +
    '.s24-next-prayer.chip-soon,.s24-next-prayer.chip-past{' +
    'background:rgba(128,128,128,.10);border-color:rgba(128,128,128,.22)}' +
    '.s24-next-prayer.chip-now{' +
    'background:rgba(128,128,128,.24);border-color:rgba(128,128,128,.45)}';

  /* حالة السطر: داخل نافذة الأذان أولاً، وإلا الصلاة القادمة.
     mode: soon (قبل) | now (اللحظة) | past (بعد) | idle (خارج النافذة)
     at: دقيقة الأذان منذ منتصف الليل — تحتاجها أنماط العدّاد */
  function barState(days, t) {
    var day = findDay(days, t.d);
    if (!day) return null;
    var friday = day.date.hijri.weekday.ar === 'الجمعة';

    for (var i = 0; i < ROWS.length; i++) {
      var r = ROWS[i];
      if (!r.prayer) continue;
      var label = (friday && r.key === 'Dhuhr') ? 'الجمعة' : r.label;
      var at = toMin(day.timings[r.key]);
      var diff = t.minutes - at;

      if (diff === 0) return { mode: 'now',  label: label, time: clean(day.timings[r.key]), at: at };
      if (diff > 0 && diff <= WINDOW)
        return { mode: 'past', label: label, time: clean(day.timings[r.key]), at: at };
      if (diff < 0 && -diff <= WINDOW)
        return { mode: 'soon', label: label, time: clean(day.timings[r.key]), at: at };
    }

    var np = nextPrayer(days, t.d, t.minutes);
    if (!np) return null;
    return { mode: 'idle', label: np.label, time: np.time, at: toMin(np.time) };
  }

  /* ---- المُصيّرات: كل واحد يعيد { html, cls } ---- */

  function plain(s) { return s.label + '<i>' + fmt(s.time) + '</i>'; }

  function renderText(s, t) {
    if (s.mode === 'idle') return { html: plain(s), cls: '' };
    if (s.mode === 'now')  return { html: 'أذان ' + s.label, cls: ' is-now' };
    if (s.mode === 'past') return { html: 'مضى أذان ' + s.label, cls: '' };
    var n = s.at - t.minutes;
    var word = n === 1 ? 'دقيقة' : (n === 2 ? 'دقيقتين' : n + ' دقائق');
    return { html: s.label + ' بعد ' + word, cls: ' is-soon' };
  }

  function renderChip(s) {
    var cls = ' is-chip';
    if (s.mode === 'soon' || s.mode === 'past') cls += ' chip-soon';
    else if (s.mode === 'now') cls += ' chip-now';
    return { html: plain(s), cls: cls };
  }

  function renderCountdown(s, t) {
    if (s.mode === 'idle') return { html: plain(s), cls: '' };
    var diff = (t.minutes * 60 + t.seconds) - (s.at * 60);
    var abs  = Math.abs(diff);
    var clock = Math.floor(abs / 60) + ':' + (abs % 60 < 10 ? '0' : '') + (abs % 60);
    if (diff < 0) return { html: s.label + '<i>' + clock + '</i>', cls: ' is-soon' };
    return {
      html: 'أذان ' + s.label + '<i>' + clock + '</i>',
      cls: diff < 60 ? ' is-now' : ' is-soon'
    };
  }

  function renderWindowOnly(s, t) {
    if (s.mode === 'idle') return { html: '', cls: '' };
    return renderText(s, t);
  }

  function render(s, t) {
    if (STYLE === 'chip')        return renderChip(s);
    if (STYLE === 'countdown')   return renderCountdown(s, t);
    if (STYLE === 'window-only') return renderWindowOnly(s, t);
    return renderText(s, t);
  }

  function initTopBar() {
    var bar = document.querySelector('.top-date-bar');
    if (!bar) return;                         // لا شريط على الموبايل — نخرج بصمت

    var style = el('style');
    style.textContent = BAR_CSS;
    document.head.appendChild(style);

    var link = document.createElement('a');
    link.id = 's24-next-prayer';
    link.className = 's24-next-prayer';
    link.href = PAGE;
    link.title = 'مواقيت الصلاة';

    var days = null, placed = false, tries = 0, baseWeight = '', secTimer = null;

    /* يأخذ الخط واللون من عنصر التاريخ نفسه، فيتطابق الوزن والحجم والعائلة */
    function place() {
      var a = findDateNode(bar);
      if (!a || !a.parentNode) return false;
      var cs = window.getComputedStyle(a);
      baseWeight = cs.fontWeight;
      link.style.fontFamily    = cs.fontFamily;
      link.style.fontSize      = cs.fontSize;
      link.style.fontWeight    = cs.fontWeight;
      link.style.fontStyle     = cs.fontStyle;
      link.style.letterSpacing = cs.letterSpacing;
      link.style.color         = cs.color;
      a.parentNode.insertBefore(link, a.nextSibling);
      return true;
    }

    /* العدّاد وحده يحتاج نبضة كل ثانية، ولا يحتاجها إلا داخل النافذة */
    function manageSeconds(active) {
      if (active && !secTimer) secTimer = setInterval(paint, 1000);
      if (!active && secTimer) { clearInterval(secTimer); secTimer = null; }
    }

    function paint() {
      if (!days) return;
      var t = damascusNow();
      var s = barState(days, t);
      if (!s) return;
      var r = render(s, t);

      link.innerHTML = r.html;
      link.className = 's24-next-prayer' + r.cls;
      /* الوزن المنسوخ سطرياً يتغلّب على الصنف، فنرفعه أثناء التمييز ونعيده بعده */
      link.style.fontWeight = /is-(soon|now)/.test(r.cls) ? '' : baseWeight;

      manageSeconds(STYLE === 'countdown' && s.mode !== 'idle');
    }

    /* محاولات متكرّرة حتى يكتب القالب التاريخ، ثم حارس يعيد الإدراج إن مُحي */
    var timer = setInterval(function () {
      tries++;
      if (!document.getElementById('s24-next-prayer')) placed = false;
      if (!placed) placed = place();
      if (placed) paint();
      if (tries > 60) clearInterval(timer);      // نتوقف بعد 30 ثانية
    }, 500);

    loadMonth(savedCity(), damascusNow().y, damascusNow().m).then(function (d) {
      days = d;
      paint();
    }).catch(function () { /* لا نعرض شيئاً بدل عرض وقت خاطئ */ });

    /* نبضة مضبوطة على رأس الدقيقة، وإلا فاتت لحظة الأذان بما يصل إلى 59 ثانية */
    function tick() {
      if (!document.getElementById('s24-next-prayer')) place();
      paint();
    }
    setTimeout(function () {
      tick();
      setInterval(tick, 60000);
    }, (60 - new Date().getSeconds()) * 1000 + 200);
  }

  /* عنصر التاريخ: أعمق عنصر داخل الشريط يحمل «بتوقيت» أو صيغة ساعة.
     يُبحث عنه متأخراً لأن ui-core.js تكتب التاريخ بعد تحميل القالب. */
  function findDateNode(bar) {
    var nodes = bar.querySelectorAll('*'), i, t;
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].children.length) continue;
      t = nodes[i].textContent || '';
      if (t.indexOf('بتوقيت') !== -1) return nodes[i];
    }
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].children.length) continue;
      t = nodes[i].textContent || '';
      if (/\d{1,2}:\d{2}/.test(t)) return nodes[i];
    }
    return null;
  }

  /* ======================= 2) صفحة المواقيت ======================= */

  var PAGE_CSS = [
    '#s24-prayer-page{direction:rtl;text-align:right;font-family:var(--font-main,inherit);line-height:1.7}',
    '#s24-prayer-page *{box-sizing:border-box}',
    '.s24pt-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding-bottom:14px;border-bottom:1px solid rgba(128,128,128,.28)}',
    '.s24pt-bar select{font:inherit;font-size:15px;color:inherit;background:transparent;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:6px 10px}',
    '.s24pt-dates{font-size:14px;opacity:.85}',
    '.s24pt-dates b{font-weight:600;display:block;font-size:15px;opacity:1}',
    '.s24pt-next{margin:18px 0;padding:14px 16px;border:1px solid rgba(128,128,128,.35);border-radius:8px;font-size:17px;font-weight:600}',
    '.s24pt-next span{font-weight:400;font-size:14px;opacity:.75;margin-inline-start:8px}',
    '.s24pt-today{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px;margin-bottom:26px}',
    '.s24pt-cell{padding:12px 6px;text-align:center;border:1px solid rgba(128,128,128,.22);border-radius:8px}',
    '.s24pt-cell em{display:block;font-style:normal;font-size:13px;opacity:.75;margin-bottom:4px}',
    '.s24pt-cell strong{font-size:17px;font-weight:600;font-variant-numeric:tabular-nums}',
    '.s24pt-cell.is-next{background:rgba(128,128,128,.14);border-color:rgba(128,128,128,.45)}',
    '.s24pt-calbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}',
    '.s24pt-calbar h3{margin:0;font-size:16px;font-weight:600;font-family:var(--font-title,inherit)}',
    '.s24pt-calbar button{font:inherit;font-size:14px;color:inherit;background:transparent;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:5px 12px;cursor:pointer}',
    '.s24pt-calbar button:hover{background:rgba(128,128,128,.12)}',
    '.s24pt-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}',
    '.s24pt-table{width:100%;min-width:520px;border-collapse:collapse;font-size:14px}',
    '.s24pt-table th,.s24pt-table td{padding:8px 6px;text-align:center;border-bottom:1px solid rgba(128,128,128,.22);font-variant-numeric:tabular-nums}',
    '.s24pt-table th{font-weight:600;font-size:13px;opacity:.8;white-space:nowrap}',
    '.s24pt-table td:first-child,.s24pt-table th:first-child{text-align:right;white-space:nowrap}',
    '.s24pt-table tr.is-today td{background:rgba(128,128,128,.14);font-weight:600}',
    '.s24pt-note{margin-top:18px;font-size:13px;opacity:.7}',
    '.s24pt-msg{padding:24px 0;font-size:15px;opacity:.8}',
    '@media(max-width:600px){.s24pt-next{font-size:16px}.s24pt-cell strong{font-size:16px}}'
  ].join('');

  function initPage() {
    var root = document.getElementById('s24-prayer-page');
    if (!root) return;

    var style = el('style');
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);

    var state = { city: savedCity(), y: 0, m: 0, today: null, days: null };
    var n0 = damascusNow();
    state.y = n0.y;
    state.m = n0.m;

    root.innerHTML = '';
    var msg    = el('div', 's24pt-msg', 'جارٍ تحميل المواقيت…');
    var bar    = el('div', 's24pt-bar');
    var next   = el('div', 's24pt-next');
    var today  = el('div', 's24pt-today');
    var calbar = el('div', 's24pt-calbar');
    var scroll = el('div', 's24pt-scroll');
    var table  = el('table', 's24pt-table');
    var note   = el('div', 's24pt-note');

    var select = el('select');
    select.setAttribute('aria-label', 'اختيار المدينة');
    CITIES.forEach(function (c) {
      var o = el('option', null, c.name);
      o.value = c.id;
      if (c.id === state.city.id) o.selected = true;
      select.appendChild(o);
    });
    var dates = el('div', 's24pt-dates');
    bar.appendChild(select);
    bar.appendChild(dates);

    var prev   = el('button', null, 'الشهر السابق');
    var mlabel = el('h3');
    var nxt    = el('button', null, 'الشهر التالي');
    calbar.appendChild(prev);
    calbar.appendChild(mlabel);
    calbar.appendChild(nxt);

    scroll.appendChild(table);
    root.appendChild(msg);

    function mount() {
      if (msg.parentNode) root.removeChild(msg);
      if (bar.parentNode) return;
      root.appendChild(bar);
      root.appendChild(next);
      root.appendChild(today);
      root.appendChild(calbar);
      root.appendChild(scroll);
      root.appendChild(note);
      note.textContent = 'المواقيت محسوبة بطريقة رابطة العالم الإسلامي (الفجر 18°، العشاء 17°) ' +
                         'اعتماداً على إحداثيات مركز كل مدينة، بتوقيت دمشق المحلي. ' +
                         'قد تفترق دقيقة أو دقيقتان عن تقويم بعض المساجد.';
    }

    function renderDates(day) {
      var g = day.date.gregorian, h = day.date.hijri;
      dates.innerHTML = '<b>' + h.weekday.ar + ' ' + parseInt(h.day, 10) + ' ' +
                        h.month.ar + ' ' + h.year + ' هـ</b>' +
                        parseInt(g.day, 10) + ' ' + MONTHS[+g.month.number - 1] + ' ' + g.year + ' م';
    }

    function renderToday() {
      today.innerHTML = '';
      ROWS.forEach(function (r) {
        var c = el('div', 's24pt-cell',
          '<em>' + r.label + '</em><strong>' + fmt(state.today.timings[r.key]) + '</strong>');
        c.setAttribute('data-key', r.key);
        today.appendChild(c);
      });
    }

    function renderNext() {
      if (!state.days) return;
      var t = damascusNow();
      var np = nextPrayer(state.days, t.d, t.minutes);
      if (!np) { next.style.display = 'none'; return; }
      next.style.display = '';

      var left = toMin(np.time) + (np.tomorrow ? 1440 : 0) - t.minutes;
      var h = Math.floor(left / 60), mm = left % 60;
      var rem = h > 0 ? ('بعد ' + h + ' ساعة و' + mm + ' دقيقة') : ('بعد ' + mm + ' دقيقة');

      next.innerHTML = np.label + (np.tomorrow ? ' (غداً)' : '') + ' — ' + fmt(np.time) +
                       '<span>' + rem + '</span>';

      Array.prototype.forEach.call(today.children, function (c) {
        c.classList.toggle('is-next', c.getAttribute('data-key') === np.key && !np.tomorrow);
      });
    }

    function renderTable(days) {
      mlabel.textContent = MONTHS[state.m - 1] + ' ' + state.y;

      var head = '<tr><th>اليوم</th>';
      ROWS.forEach(function (r) { head += '<th>' + r.label + '</th>'; });
      head += '</tr>';

      var body = '', t = damascusNow();
      days.forEach(function (day) {
        var g = day.date.gregorian, h = day.date.hijri;
        var isToday = (+g.day === t.d && +g.month.number === t.m && +g.year === t.y);
        body += '<tr' + (isToday ? ' class="is-today"' : '') + '>';
        body += '<td>' + parseInt(g.day, 10) + ' — ' + h.weekday.ar + '</td>';
        ROWS.forEach(function (r) { body += '<td>' + fmt(day.timings[r.key]) + '</td>'; });
        body += '</tr>';
      });

      table.innerHTML = '<thead>' + head + '</thead><tbody>' + body + '</tbody>';
    }

    function fail() {
      mount();
      next.style.display = 'none';
      today.innerHTML = '';
      table.innerHTML = '';
      dates.textContent = '';
      mlabel.textContent = '';
      if (!msg.parentNode) root.insertBefore(msg, bar.nextSibling);
      msg.textContent = 'تعذّر جلب المواقيت الآن. تحقّق من الاتصال ثم أعد تحميل الصفحة.';
    }

    function loadTable() {
      return loadMonth(state.city, state.y, state.m).then(renderTable);
    }

    function refresh() {
      mount();
      var t = damascusNow();
      return loadMonth(state.city, t.y, t.m).then(function (days) {
        state.days = days;
        state.today = findDay(days, t.d);
        if (!state.today) throw new Error('day not found');
        renderDates(state.today);
        renderToday();
      }).then(loadTable).then(renderNext).catch(fail);
    }

    select.addEventListener('change', function () {
      state.city = cityById(select.value);
      try { localStorage.setItem('s24pt-city', state.city.id); } catch (e) {}
      var t = damascusNow();
      state.y = t.y;
      state.m = t.m;
      refresh();
    });

    prev.addEventListener('click', function () {
      state.m--;
      if (state.m < 1) { state.m = 12; state.y--; }
      loadTable().catch(fail);
    });

    nxt.addEventListener('click', function () {
      state.m++;
      if (state.m > 12) { state.m = 1; state.y++; }
      loadTable().catch(fail);
    });

    refresh();
    setInterval(renderNext, 60000);
  }

  /* ======================= التشغيل ======================= */

  initTopBar();
  initPage();
})();
