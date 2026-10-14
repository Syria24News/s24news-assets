/* ============================================================
   S24News — شريط الأخبار العاجلة (breaking-news.js)
   الإصدار 2.0 — 14 أكتوبر 2026: لوحة التحكم مصدر الإدارة الوحيد
   (النسخة السابقة محفوظة باسم breaking-news-legacy.js للتراجع)

   المصدران:
   1) أخبار اللوحة — مستند Firestore واحد: breaking_news/current
        items.<b_وقت> = { title, url, start, end, hidden, src, ref }
        autoMinutes     = مدة ظهور مقالات *A بالدقائق (افتراضياً 60)
        hiddenPosts     = معرّفات مقالات *A المخفاة من الشريط من اللوحة
      يُقرأ بطلب REST واحد بلا مكتبة Firebase، مع كاش دقيقة على جهاز الزائر
      (التنقل بين الصفحات لا يكلّف قراءات إضافية).
   2) مقالات التصنيف *A في المدونة — تظهر autoMinutes دقيقة من وقت نشرها.

   منع التكرار: خبر اللوحة المربوط بمقالة يحجب المقالة نفسها إن كانت *A
   (المقارنة بالرابط بعد توحيده)، فيظهر الخبر مرة واحدة بنص اللوحة ومدّتها،
   ولا تعود المقالة إلى الشريط بعد انتهاء خبر اللوحة أو إنهائه يدوياً.
   الترتيب: الأحدث أولاً. الصفحة المفتوحة طويلاً تتحدّث كل 5 دقائق ما دامت ظاهرة.

   ⚠️ أُلغي مصدرا LinkList5 وورقة Google (AppSheet): لم يعد السكربت يقرأهما.
   autoConfig في ودجت HTML3 لم يعد لازماً؛ إن وُجد يُؤخذ منه maxResults و labelName فقط.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  var box = document.getElementById('breakingNewsContainer');
  if (!box) return;

  var DOC_URL = 'https://firestore.googleapis.com/v1/projects/s24n-views/databases/(default)/documents/breaking_news/current';
  var CACHE_KEY = 's24_breaking_v2';
  var CACHE_MS = 60 * 1000;          // كاش مستند اللوحة على جهاز الزائر
  var REFRESH_MS = 5 * 60 * 1000;    // تحديث الصفحة المفتوحة
  var ROTATE_MS = 5000;              // تبديل الخبر في الشريط
  var DEFAULT_AUTO_MIN = 60;         // مدة *A إن لم يُضبط في اللوحة

  var cfg = window.autoConfig || {};
  var LABEL = cfg.labelName || '*A';
  var MAX_AUTO = cfg.maxResults || 5;

  var cleanStyle = 'text-decoration: none !important; border: 0 !important; box-shadow: none !important; background: none !important; color: var(--color-white, #ffffff) !important; display: flex; align-items: center; justify-content: center; width: 100%; outline: 0 !important;';

  var list = [];        // الأخبار المعروضة حالياً
  var index = 0;
  var timer = null;
  var lastHtml = '';

  // تنقية النص قبل إدراجه (حماية من XSS)
  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // توحيد الرابط للمقارنة: بلا بروتوكول ولا www ولا ?m=1 ولا #
  function normUrl(u) {
    if (!u || u === '#' || /^https?:\/\/#?$/.test(u)) return '';
    return String(u).trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^www\./, '')
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
    }).catch(function () { return {}; });           // الفشل = لا أخبار من اللوحة (ويبقى *A)
  }

  // مقالات *A الأخيرة من خلاصة المدونة
  function loadAutoPosts() {
    var url = '/feeds/posts/summary/-/' + encodeURIComponent(LABEL) + '?alt=json&max-results=' + MAX_AUTO + '&cb=' + Date.now();
    return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      return ((data.feed && data.feed.entry) || []).map(function (e) {
        var alt = (e.link || []).find(function (l) { return l.rel === 'alternate'; });
        var m = /post-(\d+)/.exec((e.id && e.id.$t) || '');
        return {
          id: m ? m[1] : '',
          title: String((e.title && e.title.$t) || '').replace(/^\s*\*A\s*/i, '').trim(),
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
      out.push({ title: it.title, link: it.url || '', time: start });
    });

    posts.forEach(function (p) {
      if (!p.title || hiddenPosts[p.id]) return;
      if (!(now - p.time < autoMs && p.time <= now + 60000)) return;
      var key = normUrl(p.link);
      if (key && seen[key]) return;                 // خبر اللوحة المربوط بها يكفي
      if (key) seen[key] = true;
      out.push({ title: p.title, link: p.link, time: p.time });
    });

    out.sort(function (a, b) { return b.time - a.time; });
    return out;
  }

  var barMin = 0;   // ارتفاع أطول خبر في القائمة الحالية (بالبكسل) — يثبّت الشريط أثناء التبديل

  function show(i) {
    var n = list[i];
    if (!n) return;
    var t = escapeHTML(n.title);
    var inner = n.link
      ? '<a href="' + escapeHTML(n.link) + '" class="breaking-title-animated" style="' + cleanStyle + '"><span>' + t + '</span></a>'
      : '<span class="breaking-title-animated" style="' + cleanStyle + ' cursor:default;">' + t + '</span>';
    box.innerHTML = '<div class="widget-content" style="border:0 !important;' +
      (barMin ? ' min-height:' + barMin + 'px;' : '') + '">' + inner + '</div>';
  }

  // الارتفاع المرن (s24-main.css: 56px على الأقل ويتمدد مع الخبر الطويل):
  // نقيس كل أخبار القائمة ونثبّت الشريط على أطولها، فلا يقفز المحتوى تحته كل 5 ثوانٍ
  // بين خبر من سطر وخبر من سطرين. ونُعلن الارتفاع في المتغير --s24-breaking-h
  // كي ينزل تحته ما يلتصق بالمكان نفسه (مشغّل البث في صفحة البث المباشر).
  function measure() {
    barMin = 0;
    var maxH = 0;
    for (var i = 0; i < list.length; i++) {
      show(i);
      var el = box.firstChild;
      if (el && el.offsetHeight > maxH) maxH = el.offsetHeight;
    }
    barMin = maxH;
    setBarVar(maxH ? maxH + 1 : 0);   // + خط الحد السفلي (1px)
  }
  function setBarVar(px) {
    try { document.documentElement.style.setProperty('--s24-breaking-h', px + 'px'); } catch (e) {}
  }

  // عرض القائمة: إظهار الشريط أو إخفاؤه، وتشغيل التبديل عند وجود أكثر من خبر
  function render(newList) {
    var html = JSON.stringify(newList);
    if (html === lastHtml) return;                  // لا تغيير = لا وميض
    lastHtml = html;
    list = newList;
    if (timer) { clearInterval(timer); timer = null; }

    if (!list.length) {
      box.classList.remove('is-active');
      box.innerHTML = '';
      barMin = 0;
      setBarVar(0);
      return;
    }
    box.classList.add('is-active');
    box.setAttribute('aria-live', 'polite');      // دعم قارئات الشاشة
    box.setAttribute('role', 'status');
    measure();
    index = 0;
    show(0);
    if (list.length > 1) {
      timer = setInterval(function () {
        index = (index + 1) % list.length;
        show(index);
      }, ROTATE_MS);
    }
  }

  var panelCache = null, autoCache = null;
  function refresh(force) {
    Promise.all([loadPanelDoc(force), loadAutoPosts()]).then(function (r) {
      panelCache = r[0] || {};
      autoCache = r[1] || [];
      render(build(panelCache, autoCache));
    });
  }

  refresh(false);

  // تغيّر عرض الشاشة (تدوير الهاتف مثلاً) يغيّر عدد السطور: نعيد القياس
  var resizeT = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      if (!list.length) return;
      measure();
      show(index);
    }, 200);
  });

  // الصفحة المفتوحة طويلاً: تحديث دوري ما دامت ظاهرة، وإعادة فحص الصلاحية كل دقيقة بلا طلبات
  setInterval(function () { if (!document.hidden) refresh(true); }, REFRESH_MS);
  setInterval(function () {
    if (!document.hidden && panelCache) render(build(panelCache, autoCache || []));
  }, 60 * 1000);
});
