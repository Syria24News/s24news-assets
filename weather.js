/* S24News — صفحة حالة الطقس في سوريا (/p/weather.html)
   تعمل فقط عند وجود العنصر #s24-wx-page في الصفحة، ولا تلمس أي شيء آخر في الموقع.
   المصدر: weather.json في المستودع نفسه، تكتبه مهمة GitHub Actions (.github/workflows/weather.yml)
   أربع مرات يومياً من المعهد النرويجي للأرصاد MET Norway.
   «الآن» يُختار من التوقعات الساعية حسب ساعة الزائر، فيبقى صحيحاً بين تحديث وآخر.
   على نمط exchange-rates.js: نسخة محلية لنصف ساعة ثم طلب واحد. لا Firestore ولا Apps Script. */

(function () {
  'use strict';

  var root = document.getElementById('s24-wx-page');
  if (!root) return;

  /* ======================= الإعدادات ======================= */

  var DATA_URL  = 'https://syria24news.github.io/s24news-assets/weather.json';
  var CACHE_MIN = 30;          // مدة الاحتفاظ بالنسخة المحلية بالدقائق
  var STALE_H   = 24;          // بعدها يظهر تنبيه «لم تُحدَّث»
  var STRIP_H   = 12;          // عدد الساعات في شريط «الساعات القادمة»
  var DEFAULT   = 'damascus';  // المحافظة الافتراضية
  var TZ        = 'Asia/Damascus';
  var CACHE_KEY = 's24wx:v1';
  var CITY_KEY  = 's24wx:city';

  /* ======================= أدوات ======================= */

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* «24°» باتجاه يسار←يمين حتى لا تنقلب العلامة إلى «°24» داخل النص العربي */
  function deg(v) { return v == null ? '—' : '<span dir="ltr">' + Math.round(v) + '°</span>'; }

  function fmtTime(iso, opts) {
    try {
      return new Intl.DateTimeFormat('ar-SY-u-nu-latn', Object.assign({ timeZone: TZ }, opts)).format(new Date(iso));
    } catch (e) { return ''; }
  }

  function ageHours(iso) {
    var t = new Date(iso).getTime();
    return isFinite(t) ? (Date.now() - t) / 3600000 : Infinity;
  }

  /* تاريخ اليوم بتوقيت سوريا بصيغة YYYY-MM-DD (لمطابقة أيام weather.json) */
  function todayLocal(offsetH) {
    return new Date(Date.now() + (offsetH || 3) * 3600000).toISOString().slice(0, 10);
  }

  /* ---- رموز MET Norway ← وصف عربي ----
     الرمز مثل: partlycloudy_day، lightrainshowersandthunder_night، heavysnow */
  function describe(code) {
    if (!code) return '';
    var c = String(code).replace(/_(day|night|polartwilight)$/, '');
    var thunder = /andthunder$/.test(c);
    c = c.replace(/andthunder$/, '');
    var T = {
      clearsky: 'صحو', fair: 'غيوم قليلة', partlycloudy: 'غائم جزئياً', cloudy: 'غائم', fog: 'ضباب',
      lightrain: 'مطر خفيف', rain: 'مطر', heavyrain: 'مطر غزير',
      lightrainshowers: 'زخات مطر خفيفة', rainshowers: 'زخات مطر', heavyrainshowers: 'زخات مطر غزيرة',
      lightsleet: 'مطر خفيف ممزوج بالثلج', sleet: 'مطر ممزوج بالثلج', heavysleet: 'مطر غزير ممزوج بالثلج',
      lightsleetshowers: 'زخات خفيفة من المطر والثلج', sleetshowers: 'زخات من المطر والثلج', heavysleetshowers: 'زخات غزيرة من المطر والثلج',
      lightsnow: 'ثلج خفيف', snow: 'ثلج', heavysnow: 'ثلج كثيف',
      lightsnowshowers: 'زخات ثلج خفيفة', snowshowers: 'زخات ثلج', heavysnowshowers: 'زخات ثلج كثيفة'
    };
    return (T[c] || 'متقلب') + (thunder ? ' مع رعد' : '');
  }

  /* ---- أيقونات SVG ثابتة (بلا حركة) ---- */
  var SUN   = '<circle cx="12" cy="12" r="4.2" fill="#f5a623"/><g stroke="#f5a623" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/></g>';
  var MOON  = '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.8A7 7 0 0 1 15.5 3.5z" fill="#c9b458"/>';
  var CLOUD = function (y, fill) { return '<path d="M7 ' + (19 + y) + 'h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.2A4.6 4.6 0 0 0 7 ' + (19 + y) + 'z" fill="' + fill + '"/>'; };
  var DROPS = '<g stroke="#3d8bd9" stroke-width="1.8" stroke-linecap="round"><path d="M8.5 20.5l-1 2M12.5 20.5l-1 2M16.5 20.5l-1 2"/></g>';
  var FLAKES = '<g fill="#7fb3e0"><circle cx="8" cy="21.5" r="1.2"/><circle cx="12" cy="22.5" r="1.2"/><circle cx="16" cy="21.5" r="1.2"/></g>';
  var BOLT  = '<path d="M12.8 15.5l-2.6 4h2.2l-1.2 3.5 3.6-4.6h-2.2l1.4-2.9z" fill="#f5a623"/>';
  var FOG   = '<g stroke="#9aa3ad" stroke-width="1.8" stroke-linecap="round"><path d="M4 10h16M3 14h18M5 18h14"/></g>';

  function icon(code, size) {
    var c = String(code || '');
    var night = /_night$/.test(c);
    var b = c.replace(/_(day|night|polartwilight)$/, '');
    var body;
    if (b === 'clearsky') body = night ? MOON : SUN;
    else if (b === 'fog') body = FOG;
    else if (b === 'fair' || b === 'partlycloudy') {
      body = '<g transform="translate(-3 -4) scale(.8)">' + (night ? MOON : SUN) + '</g>' + CLOUD(-1, b === 'fair' ? '#dfe4ea' : '#c3cad3');
    } else if (b === 'cloudy') body = CLOUD(-2, '#aab3bd');
    else {
      var wet = /snow/.test(b) ? FLAKES : /sleet/.test(b) ? DROPS + FLAKES : DROPS;
      body = CLOUD(-5, '#9aa3ad') + wet + (/thunder/.test(b) ? BOLT : '');
    }
    var s = size || 28;
    return '<svg class="s24wx-ico" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
  }

  /* اتجاه الرياح (القادمة من) */
  function windDir(d) {
    if (d == null) return '';
    var names = ['شمالية', 'شمالية شرقية', 'شرقية', 'جنوبية شرقية', 'جنوبية', 'جنوبية غربية', 'غربية', 'شمالية غربية'];
    return names[Math.round(((d % 360) + 360) % 360 / 45) % 8];
  }

  /* أقرب ساعة إلى وقت الزائر، ثم الساعات التالية */
  function nowIndex(hours) {
    var now = Date.now(), best = 0;
    for (var i = 0; i < hours.length; i++) {
      if (new Date(hours[i].t).getTime() <= now + 30 * 60000) best = i; else break;
    }
    return best;
  }

  /* ---- جلب البيانات: نسخة محلية لنصف ساعة، ثم طلب واحد ---- */
  function loadWeather() {
    var hit = null;
    try { var raw = localStorage.getItem(CACHE_KEY); hit = raw ? JSON.parse(raw) : null; } catch (e) {}
    if (hit && hit.at && (Date.now() - hit.at) < CACHE_MIN * 60000 && hit.data) return Promise.resolve(hit.data);

    var bucket = Math.floor(Date.now() / (CACHE_MIN * 60000));
    return fetch(DATA_URL + '?t=' + bucket).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || j.v !== 1 || !j.cities || !j.cities.length) throw new Error('bad payload');
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: j })); } catch (e) {}
      return j;
    }).catch(function (e) {
      if (hit && hit.data) return hit.data;   // عند فشل الشبكة: آخر نسخة محفوظة مهما كان عمرها
      throw e;
    });
  }

  /* ======================= التنسيق ======================= */

  var CSS = [
    '#s24-wx-page{direction:rtl;text-align:right;font-family:var(--font-main,inherit);line-height:1.7}',
    '#s24-wx-page *{box-sizing:border-box}',
    '#s24-wx-page [hidden]{display:none!important}',
    '.s24wx-meta{font-size:14px;opacity:.8;margin-bottom:14px}',
    '.s24wx-meta b{font-weight:600}',
    '.s24wx-warn{margin-bottom:14px;padding:10px 12px;border-radius:6px;font-size:14px;background:rgba(217,48,37,.08);border:1px solid rgba(217,48,37,.3)}',
    '.s24wx-cities{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}',
    '.s24wx-cities button{font:inherit;font-size:14px;color:inherit;background:transparent;border:1px solid rgba(128,128,128,.35);border-radius:999px;padding:4px 14px;cursor:pointer;transition:background .15s ease,border-color .15s ease}',
    '.s24wx-cities button:hover{border-color:rgba(128,128,128,.6)}',
    '.s24wx-cities button[aria-pressed="true"]{background:var(--sy-green,#77bd1d);border-color:var(--sy-green,#77bd1d);color:#fff}',
    '.s24wx-cities button:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(119,189,29,.35)}',
    '.s24wx-hero{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px;border:1px solid var(--sy-green,#77bd1d);border-radius:8px;background-image:linear-gradient(rgba(119,189,29,.08),rgba(119,189,29,.08));margin-bottom:18px}',
    '.s24wx-hero .s24wx-ico{flex:0 0 auto}',
    '.s24wx-now{flex:0 0 auto}',
    '.s24wx-now strong{display:block;font-size:40px;line-height:1.1;font-weight:700;font-family:var(--font-title,inherit);font-variant-numeric:tabular-nums}',
    '.s24wx-now>span{font-size:15px}',
    '.s24wx-facts{flex:1 1 220px;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px 14px;font-size:14px}',
    '.s24wx-facts em{font-style:normal;opacity:.7;margin-inline-end:4px}',
    '.s24wx-facts b{font-weight:600;font-variant-numeric:tabular-nums}',
    '.s24wx-h{margin:22px 0 10px;font-size:17px;font-weight:600;font-family:var(--font-title,inherit)}',
    '.s24wx-strip{display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:6px}',
    '.s24wx-hr{flex:0 0 66px;text-align:center;padding:8px 4px;border:1px solid rgba(128,128,128,.22);border-radius:8px;font-size:13px}',
    '.s24wx-hr b{display:block;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}',
    '.s24wx-hr .s24wx-ico{display:block;margin:2px auto}',
    '.s24wx-scroll{overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid rgba(128,128,128,.22);border-radius:8px}',
    '.s24wx-table{width:100%;border-collapse:separate;border-spacing:0;font-size:15px}',
    '.s24wx-table th,.s24wx-table td{padding:9px 8px;text-align:center;border-bottom:1px solid rgba(128,128,128,.22);font-variant-numeric:tabular-nums;vertical-align:middle}',
    '.s24wx-table tr:last-child td{border-bottom:0}',
    '.s24wx-table th{font-weight:600;font-size:13px;white-space:nowrap;background-image:linear-gradient(rgba(119,189,29,.14),rgba(119,189,29,.14))}',
    '.s24wx-table td:first-child,.s24wx-table th:first-child{text-align:right;white-space:nowrap}',
    '.s24wx-table td.s24wx-cond{text-align:right}',
    '.s24wx-table .s24wx-ico{vertical-align:middle;margin-inline-end:6px}',
    '.s24wx-table tbody tr.is-pick td{background-image:linear-gradient(rgba(119,189,29,.10),rgba(119,189,29,.10))}',
    '.s24wx-table tbody tr[data-city]{cursor:pointer}',
    '.s24wx-table tbody tr[data-city]:hover td{background-color:rgba(128,128,128,.06)}',
    '.s24wx-hi{color:#d35400;font-weight:600}.s24wx-lo{color:#2e86c1;font-weight:600}',
    '.s24wx-note{margin-top:20px;margin-bottom:24px;padding:12px 14px;border-inline-start:3px solid var(--sy-green,#77bd1d);background:rgba(128,128,128,.08);border-radius:6px;font-size:13.5px;line-height:1.8}',
    '.s24wx-note p{margin:0 0 6px}.s24wx-note p:last-child{margin:0}',
    '.s24wx-note a{color:inherit;text-decoration:underline}',
    '.s24wx-msg{padding:24px 0;font-size:15px;opacity:.8}',
    /* الموبايل: تبقى الأعمدة كلها ظاهرة بلا تمرير أفقي، وتكفي الأيقونة عن نص الحالة */
    '@media(max-width:600px){.s24wx-now strong{font-size:34px}.s24wx-table{font-size:14px}.s24wx-table th,.s24wx-table td{padding:8px 5px}.s24wx-ctext{display:none}.s24wx-table td.s24wx-cond{text-align:center}.s24wx-table .s24wx-ico{margin:0}}'
  ].join('');

  /* ======================= البناء ======================= */

  var style = el('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  root.innerHTML = '';
  var meta   = el('div', 's24wx-meta');
  var warn   = el('div', 's24wx-warn');
  var chips  = el('div', 's24wx-cities');
  var hero   = el('div', 's24wx-hero');
  var hStrip = el('div', 's24wx-strip');
  var daysT  = el('div', 's24wx-scroll');
  var allT   = el('div', 's24wx-scroll');
  var note   = el('div', 's24wx-note');
  var msg    = el('div', 's24wx-msg', 'جارٍ تحميل حالة الطقس…');
  var hHours = el('h2', 's24wx-h', 'الساعات القادمة');
  var hDays  = el('h2', 's24wx-h');
  var hAll   = el('h2', 's24wx-h', 'المحافظات السورية اليوم');
  warn.hidden = true;
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'اختر المحافظة');

  [meta, warn, chips, hero, hHours, hStrip, hDays, daysT, hAll, allT, note].forEach(function (n) { n.hidden = true; root.appendChild(n); });
  root.appendChild(msg);
  warn.hidden = true;

  loadWeather().then(function (d) {
    msg.remove();
    var cities = d.cities;
    var byId = {};
    cities.forEach(function (c) { byId[c.id] = c; });
    var today = todayLocal(d.tzOffset);

    [meta, chips, hero, hHours, hStrip, hDays, daysT, hAll, allT, note].forEach(function (n) { n.hidden = false; });

    meta.innerHTML = 'آخر تحديث للتوقعات: <b>' + (fmtTime(d.updated, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true }) || '—') + '</b> بتوقيت دمشق';
    if (ageHours(d.updated) > STALE_H) {
      warn.hidden = false;
      warn.textContent = 'تنبيه: لم تُحدَّث هذه التوقعات منذ أكثر من يوم، وقد لا تعكس الحالة الحالية.';
    }

    /* المحافظة المختارة: من الرابط (#aleppo) ثم آخر اختيار للزائر ثم دمشق */
    function initial() {
      var h = (location.hash || '').replace('#', '');
      if (byId[h]) return h;
      try { var s = localStorage.getItem(CITY_KEY); if (byId[s]) return s; } catch (e) {}
      return byId[DEFAULT] ? DEFAULT : cities[0].id;
    }

    cities.forEach(function (c) {
      var b = el('button', '', c.name);
      b.type = 'button';
      b.setAttribute('data-city', c.id);
      b.addEventListener('click', function () { pick(c.id, true); });
      chips.appendChild(b);
    });

    function dayOf(c, date) {
      for (var i = 0; i < (c.days || []).length; i++) if (c.days[i].d === date) return c.days[i];
      return null;
    }

    var tomorrow = new Date(new Date(today + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
    function dayName(date) {
      if (date === today) return 'اليوم';
      if (date === tomorrow) return 'غداً';
      return fmtTime(date + 'T09:00:00Z', { weekday: 'long' });
    }

    function renderCity(id) {
      var c = byId[id];
      var hrs = c.hours || [];
      var i0 = nowIndex(hrs);
      var h = hrs[i0] || {};
      var td = dayOf(c, today) || (c.days || [])[0] || {};

      hero.innerHTML =
        icon(h.s, 64) +
        '<div class="s24wx-now"><strong>' + deg(h.c) + '</strong><span>' + (describe(h.s) || '—') + ' — ' + c.name + '</span></div>' +
        '<div class="s24wx-facts">' +
          '<div><em>العظمى</em><b class="s24wx-hi">' + deg(td.hi) + '</b></div>' +
          '<div><em>الصغرى</em><b class="s24wx-lo">' + deg(td.lo) + '</b></div>' +
          '<div><em>الرياح</em><b>' + (h.w != null ? h.w + ' كم/س' : '—') + '</b>' + (h.d != null ? ' ' + windDir(h.d) : '') + '</div>' +
          '<div><em>الرطوبة</em><b>' + (h.h != null ? h.h + '%' : '—') + '</b></div>' +
        '</div>';

      var strip = '';
      hrs.slice(i0, i0 + STRIP_H).forEach(function (x, k) {
        strip += '<div class="s24wx-hr">' + (k === 0 ? 'الآن' : fmtTime(x.t, { hour: 'numeric', hour12: true })) +
                 icon(x.s, 28) + '<b>' + deg(x.c) + '</b></div>';
      });
      hStrip.innerHTML = strip;
      hHours.hidden = hStrip.hidden = !strip;

      hDays.textContent = 'توقعات الأيام القادمة — ' + c.name;
      var rows = '';
      (c.days || []).forEach(function (x) {
        rows += '<tr><td>' + dayName(x.d) + '</td><td class="s24wx-cond" title="' + describe(x.s) + '">' + icon(x.s, 26) + '<span class="s24wx-ctext">' + describe(x.s) + '</span></td>' +
                '<td class="s24wx-hi">' + deg(x.hi) + '</td><td class="s24wx-lo">' + deg(x.lo) + '</td>' +
                '<td>' + (x.p != null && x.p >= 0.1 ? x.p + ' مم' : '—') + '</td></tr>';
      });
      daysT.innerHTML = '<table class="s24wx-table"><thead><tr><th>اليوم</th><th>الحالة</th><th>العظمى</th><th>الصغرى</th><th>الهطول</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    /* جدول كل المحافظات: الحالة الآن، وعظمى اليوم وصغراه — الضغط على صف يختار المحافظة */
    var allRows = '';
    cities.forEach(function (c) {
      var hrs = c.hours || [];
      var h = hrs[nowIndex(hrs)] || {};
      var td = dayOf(c, today) || {};
      allRows += '<tr data-city="' + c.id + '"><td>' + c.name + '</td><td class="s24wx-cond" title="' + describe(h.s) + '">' + icon(h.s, 24) + '<span class="s24wx-ctext">' + describe(h.s) + '</span></td>' +
                 '<td>' + deg(h.c) + '</td><td class="s24wx-hi">' + deg(td.hi) + '</td><td class="s24wx-lo">' + deg(td.lo) + '</td></tr>';
    });
    allT.innerHTML = '<table class="s24wx-table"><thead><tr><th>المحافظة</th><th>الحالة الآن</th><th>الآن</th><th>العظمى</th><th>الصغرى</th></tr></thead><tbody>' + allRows + '</tbody></table>';
    allT.addEventListener('click', function (e) {
      var tr = e.target.closest && e.target.closest('tr[data-city]');
      if (tr) { pick(tr.getAttribute('data-city'), true); hero.scrollIntoView({ block: 'nearest' }); }
    });

    function pick(id, save) {
      if (!byId[id]) return;
      Array.prototype.forEach.call(chips.children, function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-city') === id ? 'true' : 'false');
      });
      Array.prototype.forEach.call(allT.querySelectorAll('tr[data-city]'), function (tr) {
        tr.classList.toggle('is-pick', tr.getAttribute('data-city') === id);
      });
      renderCity(id);
      if (save) {
        try { localStorage.setItem(CITY_KEY, id); } catch (e) {}
        try { history.replaceState(null, '', '#' + id); } catch (e) {}
      }
    }
    window.addEventListener('hashchange', function () { var h = location.hash.replace('#', ''); if (byId[h]) pick(h, false); });
    pick(initial(), false);

    /* ---- الملاحظة الثابتة: المصدر والترخيص (شرط MET Norway) والمرجع الرسمي ---- */
    note.innerHTML =
      '<p>التوقعات تُحدَّث آلياً أربع مرات يومياً، ودرجات الحرارة بالدرجة المئوية لمراكز المحافظات. قيم العظمى والصغرى تقريبية من التوقعات الساعية.</p>' +
      '<p>مصدر البيانات: <a href="https://www.met.no/en" target="_blank" rel="noopener">المعهد النرويجي للأرصاد الجوية (MET Norway)</a>، ' +
      'بترخيص <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>، وعرضها بالعربية من سوريا 24.</p>' +
      '<p>النشرات والتحذيرات الرسمية تصدر عن المركز الوطني للأرصاد الجوية في سوريا، وهو المرجع المعتمد عند الحالات الجوية الخطرة.</p>';
  }).catch(function () {
    msg.textContent = 'تعذّر جلب حالة الطقس الآن. تحقّق من الاتصال ثم أعد تحميل الصفحة.';
  });
})();
