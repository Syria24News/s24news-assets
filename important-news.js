/* ============================================================
   S24News — صندوق «هام» في الصفحة الرئيسية (important-news.js)
   الإصدار 1.0 — 15 أكتوبر 2026: لوحة التحكم مصدر الإدارة الوحيد
   (يحلّ محل ودجت HTML777 «شريط هام» الذي يُحذف من التنسيق)

   الحاوية في القالب (الرئيسية فقط):  <div id="s24ImportantBox" hidden></div>
   والصندوق يبقى مخفياً كلياً حين لا يوجد خبر هام (لا ترويسة فارغة).

   المصدران:
   1) أخبار اللوحة — مستند Firestore واحد: important_news/current
        items.<i_وقت> = { title, url, start, end, hidden, src }
        autoMinutes     = مدة ظهور مقالات *I بالدقائق (افتراضياً 1440 = يوم)
        hiddenPosts     = معرّفات مقالات *I المخفاة من الصندوق من اللوحة
        subtitle        = عبارة اختيارية بجانب «هام» ('' = «هام» وحدها)
      يُقرأ بطلب REST واحد بلا مكتبة Firebase، مع كاش دقيقة على جهاز الزائر.
   2) مقالات التصنيف *I في المدونة — تظهر autoMinutes دقيقة من وقت نشرها.

   منع التكرار: خبر اللوحة المربوط بمقالة يحجب المقالة نفسها إن كانت *I
   (المقارنة بالرابط بعد توحيده)، فيظهر الخبر مرة واحدة بنص اللوحة ومدّتها.
   الترتيب: الأحدث أولاً، وأقصى عدد 5. الصفحة المفتوحة طويلاً تتحدّث كل 5 دقائق ما دامت ظاهرة.
   التنسيق في s24-main.css (قسم «صندوق هام»).
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  var box = document.getElementById('s24ImportantBox');
  if (!box) return;

  var DOC_URL = 'https://firestore.googleapis.com/v1/projects/s24n-views/databases/(default)/documents/important_news/current';
  var LABEL = '*I';
  var CACHE_KEY = 's24_important_v1';
  var CACHE_MS = 60 * 1000;          // كاش مستند اللوحة على جهاز الزائر
  var REFRESH_MS = 5 * 60 * 1000;    // تحديث الصفحة المفتوحة
  var DEFAULT_AUTO_MIN = 1440;       // مدة *I إن لم تُضبط في اللوحة
  var SHOW_MAX = 5;                  // أقصى عدد أخبار في الصندوق
  var FEED_MAX = 10;                 // مقالات *I المجلوبة (احتياط لما يُحجب منها)

  // الوقت بتوقيت دمشق (ساعة:دقيقة) بأرقام لاتينية كبقية الموقع
  var fmtTime;
  try {
    fmtTime = new Intl.DateTimeFormat('ar-u-nu-latn', { timeZone: 'Asia/Damascus', hour: 'numeric', minute: '2-digit' });
  } catch (e) { fmtTime = null; }

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // روابط الموقع فقط (حماية من رابط خارجي أو javascript:)
  function safeLink(u) {
    var s = String(u || '').trim();
    return /^https?:\/\/(www\.)?syria24\.news(\/|$)/i.test(s) ? s : '';
  }
  // مفتاح المقارنة بين رابط خبر اللوحة ورابط المقالة
  function normUrl(u) {
    return String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')
      .split('#')[0].split('?')[0].replace(/\/$/, '');
  }

  // فك قيم Firestore REST ({stringValue}، {integerValue}، {mapValue}...) إلى قيم عادية
  function fsVal(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return Date.parse(v.timestampValue);
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsVal);
    if ('mapValue' in v) {
      var o = {}, f = v.mapValue.fields || {};
      for (var k in f) o[k] = fsVal(f[k]);
      return o;
    }
    return null;
  }

  // مستند اللوحة: من الكاش إن كان حديثاً، وإلا طلب واحد
  function loadPanelDoc(force) {
    var c = !force && window.S24Cache ? window.S24Cache.get(CACHE_KEY, CACHE_MS) : null;
    if (c) return Promise.resolve(c);
    return fetch(DOC_URL).then(function (r) {
      if (r.status === 404) return {};             // لم يُنشأ المستند بعد
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json().then(function (j) { return fsVal({ mapValue: { fields: j.fields || {} } }) || {}; });
    }).then(function (d) {
      if (window.S24Cache) window.S24Cache.set(CACHE_KEY, d);
      return d;
    }).catch(function () { return {}; });           // الفشل = لا أخبار من اللوحة (ويبقى *I)
  }

  // مقالات *I الأخيرة من خلاصة المدونة
  function loadAutoPosts() {
    var url = '/feeds/posts/summary/-/' + encodeURIComponent(LABEL) + '?alt=json&max-results=' + FEED_MAX + '&cb=' + Date.now();
    return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      return ((data.feed && data.feed.entry) || []).map(function (e) {
        var alt = (e.link || []).find(function (l) { return l.rel === 'alternate'; });
        var m = /post-(\d+)/.exec((e.id && e.id.$t) || '');
        return {
          id: m ? m[1] : '',
          title: String((e.title && e.title.$t) || '').trim(),
          link: alt ? alt.href : '',
          time: Date.parse(e.published.$t)
        };
      });
    }).catch(function () { return []; });
  }

  // دمج المصدرين في قائمة واحدة صالحة الآن
  function build(panel, posts) {
    var now = Date.now();
    var out = [], seen = {};
    var items = panel.items || {};
    var hiddenPosts = {};
    (panel.hiddenPosts || []).forEach(function (id) { hiddenPosts[String(id)] = true; });
    var autoMs = (Number(panel.autoMinutes) || DEFAULT_AUTO_MIN) * 60000;

    Object.keys(items).forEach(function (k) {
      var it = items[k] || {};
      // خبر اللوحة المربوط بمقالة يتحكم بظهورها كلياً، حتى بعد انتهائه أو إخفائه
      var key = normUrl(it.url);
      if (key) seen[key] = true;
      if (it.hidden === true || !it.title) return;
      var start = Number(it.start) || 0, end = Number(it.end) || 0;
      if (!end || now < start || now >= end) return;
      out.push({ title: it.title, link: safeLink(it.url), time: start });
    });

    posts.forEach(function (p) {
      if (!p.title || hiddenPosts[p.id]) return;
      if (!(now - p.time < autoMs && p.time <= now + 60000)) return;
      var key = normUrl(p.link);
      if (key && seen[key]) return;                 // خبر اللوحة المربوط بها يكفي
      if (key) seen[key] = true;
      out.push({ title: p.title, link: safeLink(p.link), time: p.time });
    });

    out.sort(function (a, b) { return b.time - a.time; });
    return out.slice(0, SHOW_MAX);
  }

  var lastHtml = '';
  function render(list, subtitle) {
    var html = '';
    if (list.length) {
      html =
        '<div class="s24-imp-head">' +
          '<span class="s24-imp-badge">هام</span>' +
          (subtitle ? '<span class="s24-imp-sub">' + escapeHTML(subtitle) + '</span>' : '') +
        '</div>' +
        '<ul class="s24-imp-list">' + list.map(function (n) {
          var t = escapeHTML(n.title);
          var time = fmtTime && n.time ? '<time class="s24-imp-time">' + escapeHTML(fmtTime.format(new Date(n.time))) + '</time>' : '';
          return n.link
            ? '<li><a class="s24-imp-item" href="' + escapeHTML(n.link) + '">' + time + '<span class="s24-imp-title">' + t + '</span></a></li>'
            : '<li><span class="s24-imp-item is-static">' + time + '<span class="s24-imp-title">' + t + '</span></span></li>';
        }).join('') + '</ul>';
    }
    if (html === lastHtml) return;                  // لا تغيير = لا وميض
    lastHtml = html;
    box.innerHTML = html;
    box.hidden = !list.length;                      // لا خبر هام = لا صندوق إطلاقاً
  }

  var panelCache = null, autoCache = null;
  function refresh(force) {
    Promise.all([loadPanelDoc(force), loadAutoPosts()]).then(function (r) {
      panelCache = r[0] || {};
      autoCache = r[1] || [];
      render(build(panelCache, autoCache), String(panelCache.subtitle || '').trim());
    });
  }

  refresh(false);

  // الصفحة المفتوحة طويلاً: تحديث دوري ما دامت ظاهرة، وإعادة فحص الصلاحية كل دقيقة بلا طلبات
  setInterval(function () { if (!document.hidden) refresh(true); }, REFRESH_MS);
  setInterval(function () {
    if (!document.hidden && panelCache) render(build(panelCache, autoCache || []), String(panelCache.subtitle || '').trim());
  }, 60 * 1000);
});
