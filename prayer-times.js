/* S24News — صفحة مواقيت الصلاة
   يعمل فقط عند وجود العنصر #s24-prayer-page في الصفحة.
   المصدر: Aladhan API — طلب واحد لكل شهر لكل مدينة، مخزَّن محلياً. */

(function () {
  'use strict';

  var root = document.getElementById('s24-prayer-page');
  if (!root) return;

  /* ======================= الإعدادات ======================= */

  var METHOD = 3;                        // 3 = رابطة العالم الإسلامي (الفجر 18° / العشاء 17°)
  var SCHOOL = 0;                        // 0 = الجمهور، 1 = الحنفي (يؤخّر العصر)
  var TUNE   = '0,0,0,0,0,0,0,0,0';      // الإمساك,الفجر,الشروق,الظهر,العصر,المغرب,الغروب,العشاء,منتصف الليل
  var TZ     = 'Asia/Damascus';
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

  /* ======================= التنسيق ======================= */

  var CSS = [
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

  /* ======================= أدوات ======================= */

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

  function damascusNow() {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return {
      y: +o.year, m: +o.month, d: +o.day,
      minutes: (+o.hour) * 60 + (+o.minute)
    };
  }

  function cityById(id) {
    for (var i = 0; i < CITIES.length; i++) if (CITIES[i].id === id) return CITIES[i];
    return CITIES[0];
  }

  /* ---- التخزين المحلي: بيانات الشهر ثابتة، فتُحفظ بلا مدة صلاحية ---- */

  function cacheKey(city, y, m) { return 's24pt:' + city.id + ':' + y + '-' + m; }

  function cacheRead(k) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }

  function cacheWrite(k, data) {
    try {
      var keys = [], i;
      for (i = 0; i < localStorage.length; i++) {
        var n = localStorage.key(i);
        if (n && n.indexOf('s24pt:') === 0) keys.push(n);
      }
      keys.sort();
      while (keys.length >= 6) localStorage.removeItem(keys.shift());
      localStorage.setItem(k, JSON.stringify(data));
    } catch (e) { /* الحصّة ممتلئة أو التخزين معطّل — نتجاهل */ }
  }

  function loadMonth(city, y, m) {
    var key = cacheKey(city, y, m);
    var hit = cacheRead(key);
    if (hit) return Promise.resolve(hit);

    var url = 'https://api.aladhan.com/v1/calendar/' + y + '/' + m +
              '?latitude=' + city.lat + '&longitude=' + city.lng +
              '&method=' + METHOD + '&school=' + SCHOOL + '&tune=' + TUNE;

    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || j.code !== 200 || !j.data) throw new Error('bad payload');
      cacheWrite(key, j.data);
      return j.data;
    });
  }

  /* ======================= الحالة ======================= */

  var state = {
    city: cityById(localStorage.getItem('s24pt-city') || DEFAULT_CITY),
    y: 0, m: 0,          // الشهر المعروض في الجدول
    today: null,         // يوم اليوم من مصفوفة الشهر
    tomorrow: null,      // يوم الغد، للفجر بعد العشاء
    tickHandle: null
  };

  var now = damascusNow();
  state.y = now.y;
  state.m = now.m;

  /* ======================= البناء ======================= */

  var style = el('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  root.innerHTML = '';
  var msg      = el('div', 's24pt-msg', 'جارٍ تحميل المواقيت…');
  var bar      = el('div', 's24pt-bar');
  var next     = el('div', 's24pt-next');
  var today    = el('div', 's24pt-today');
  var calbar   = el('div', 's24pt-calbar');
  var scroll   = el('div', 's24pt-scroll');
  var table    = el('table', 's24pt-table');
  var note     = el('div', 's24pt-note');

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

  var prev = el('button', null, 'الشهر السابق');
  var mlabel = el('h3');
  var nxt = el('button', null, 'الشهر التالي');
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
    note.innerHTML = 'المواقيت محسوبة بطريقة رابطة العالم الإسلامي (الفجر 18°، العشاء 17°) ' +
                     'اعتماداً على إحداثيات مركز كل مدينة، بتوقيت دمشق المحلي. ' +
                     'قد تفترق دقيقة أو دقيقتان عن تقويم بعض المساجد.';
  }

  /* ======================= العرض ======================= */

  function findDay(days, d) {
    for (var i = 0; i < days.length; i++) {
      if (parseInt(days[i].date.gregorian.day, 10) === d) return days[i];
    }
    return null;
  }

  function renderDates(day) {
    var g = day.date.gregorian, h = day.date.hijri;
    dates.innerHTML = '<b>' + h.weekday.ar + ' ' + parseInt(h.day, 10) + ' ' +
                      h.month.ar + ' ' + h.year + ' هـ</b>' +
                      parseInt(g.day, 10) + ' ' + MONTHS[+g.month.number - 1] + ' ' + g.year + ' م';
  }

  function nextPrayer() {
    if (!state.today) return null;
    var t = damascusNow().minutes, i, r;
    for (i = 0; i < ROWS.length; i++) {
      r = ROWS[i];
      if (!r.prayer) continue;
      if (toMin(state.today.timings[r.key]) > t) {
        return { label: r.label, key: r.key, time: clean(state.today.timings[r.key]), tomorrow: false };
      }
    }
    if (state.tomorrow) {
      return { label: 'الفجر', key: 'Fajr', time: clean(state.tomorrow.timings.Fajr), tomorrow: true };
    }
    return null;
  }

  function renderNext() {
    var n = nextPrayer();
    if (!n) { next.textContent = ''; next.style.display = 'none'; return; }
    next.style.display = '';

    var t = damascusNow().minutes;
    var target = toMin(n.time) + (n.tomorrow ? 24 * 60 : 0);
    var left = target - t;
    var h = Math.floor(left / 60), mm = left % 60;
    var rem = h > 0 ? ('بعد ' + h + ' ساعة و' + mm + ' دقيقة') : ('بعد ' + mm + ' دقيقة');

    next.innerHTML = 'الصلاة القادمة: ' + n.label + (n.tomorrow ? ' (غداً)' : '') +
                     ' — ' + n.time + '<span>' + rem + '</span>';

    Array.prototype.forEach.call(today.children, function (c) {
      c.classList.toggle('is-next', c.getAttribute('data-key') === n.key && !n.tomorrow);
    });
  }

  function renderToday() {
    today.innerHTML = '';
    ROWS.forEach(function (r) {
      var c = el('div', 's24pt-cell',
        '<em>' + r.label + '</em><strong>' + clean(state.today.timings[r.key]) + '</strong>');
      c.setAttribute('data-key', r.key);
      today.appendChild(c);
    });
  }

  function renderTable(days) {
    mlabel.textContent = MONTHS[state.m - 1] + ' ' + state.y;

    var head = '<tr><th>اليوم</th>';
    ROWS.forEach(function (r) { head += '<th>' + r.label + '</th>'; });
    head += '</tr>';

    var body = '', n = damascusNow();
    days.forEach(function (day) {
      var g = day.date.gregorian, h = day.date.hijri;
      var isToday = (+g.day === n.d && +g.month.number === n.m && +g.year === n.y);
      body += '<tr' + (isToday ? ' class="is-today"' : '') + '>';
      body += '<td>' + parseInt(g.day, 10) + ' — ' + h.weekday.ar + '</td>';
      ROWS.forEach(function (r) { body += '<td>' + clean(day.timings[r.key]) + '</td>'; });
      body += '</tr>';
    });

    table.innerHTML = '<thead>' + head + '</thead><tbody>' + body + '</tbody>';
  }

  function fail(e) {
    mount();
    next.style.display = 'none';
    today.innerHTML = '';
    table.innerHTML = '';
    dates.textContent = '';
    mlabel.textContent = '';
    if (!msg.parentNode) root.insertBefore(msg, bar.nextSibling);
    msg.textContent = 'تعذّر جلب المواقيت الآن. تحقّق من الاتصال ثم أعد تحميل الصفحة.';
  }

  /* ======================= التشغيل ======================= */

  function loadTable() {
    return loadMonth(state.city, state.y, state.m).then(renderTable);
  }

  function loadToday() {
    var n = damascusNow();
    return loadMonth(state.city, n.y, n.m).then(function (days) {
      state.today = findDay(days, n.d);
      state.tomorrow = findDay(days, n.d + 1);
      if (!state.today) throw new Error('day not found');
      renderDates(state.today);
      renderToday();

      if (state.tomorrow) return;
      var ny = n.m === 12 ? n.y + 1 : n.y;
      var nm = n.m === 12 ? 1 : n.m + 1;
      return loadMonth(state.city, ny, nm).then(function (d2) {
        state.tomorrow = findDay(d2, 1);
      }).catch(function () { /* الغد غير متاح — يظهر سطر الصلاة القادمة فارغاً بعد العشاء */ });
    });
  }

  function refresh() {
    mount();
    return loadToday()
      .then(loadTable)
      .then(renderNext)
      .catch(fail);
  }

  select.addEventListener('change', function () {
    state.city = cityById(select.value);
    try { localStorage.setItem('s24pt-city', state.city.id); } catch (e) {}
    var n = damascusNow();
    state.y = n.y;
    state.m = n.m;
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
  state.tickHandle = setInterval(renderNext, 60000);
})();
