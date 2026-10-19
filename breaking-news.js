/* ============================================================
   S24News — شريط الأخبار العاجلة (breaking-news.js)
   الإصدار 2.1 — 19 أكتوبر 2026: الجلب حسب النشاط (فكرة حسان)
     - يوجد عاجل في الشريط: نسخة دقيقة، والصفحة المفتوحة تقرأ اللوحة كل 3 دقائق.
     - لا عاجل: نسخة 5 دقائق، والصفحة المفتوحة تقرأ اللوحة كل 10 دقائق.
     - مقالات *A تأتي من خلاصة المدونة (مجانية، خارج حصة Firestore)، فتُفحص كل دقيقتين
       دائماً؛ وظهور مقالة *A يحوّل الشريط فوراً إلى وضع النشاط.
     - لا جلب إجباري بعد اليوم: كل الفحوص تحترم النسخة المحفوظة، فتتشاركها
       التبويبات المفتوحة بدل أن يقرأ كل تبويب لنفسه.
     - عودة التبويب إلى الظهور تفحص فوراً (من النسخة إن كانت صالحة).
   الإصدار 2.0 — 14 أكتوبر 2026: لوحة التحكم مصدر الإدارة الوحيد
   (النسخة السابقة محفوظة باسم breaking-news-legacy.js للتراجع)

   المصدران:
   1) أخبار اللوحة — مستند Firestore واحد: breaking_news/current
        items.<b_وقت> = { title, url, start, end, hidden, src, ref }
        autoMinutes     = مدة ظهور مقالات *A بالدقائق (افتراضياً 60)
        hiddenPosts     = معرّفات مقالات *A المخفاة من الشريط من اللوحة
      يُقرأ بطلب REST واحد بلا مكتبة Firebase، مع كاش على جهاز الزائر مدته حسب النشاط
      (التنقل بين الصفحات لا يكلّف قراءات إضافية).
   2) مقالات التصنيف *A في المدونة — تظهر autoMinutes دقيقة من وقت نشرها.

   منع التكرار: خبر اللوحة المربوط بمقالة يحجب المقالة نفسها إن كانت *A
   (المقارنة بالرابط بعد توحيده)، فيظهر الخبر مرة واحدة بنص اللوحة ومدّتها،
   ولا تعود المقالة إلى الشريط بعد انتهاء خبر اللوحة أو إنهائه يدوياً.
   الترتيب: الأحدث أولاً. الصفحة المفتوحة تتحدّث ما دامت ظاهرة، بفاصل حسب النشاط (انظر 2.1).

   ⚠️ أُلغي مصدرا LinkList5 وورقة Google (AppSheet): لم يعد السكربت يقرأهما.
   autoConfig في ودجت HTML3 لم يعد لازماً؛ إن وُجد يُؤخذ منه maxResults و labelName فقط.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  var box = document.getElementById('breakingNewsContainer');
  if (!box) return;

  var DOC_URL = 'https://firestore.googleapis.com/v1/projects/s24n-views/databases/(default)/documents/breaking_news/current';
  var CACHE_KEY = 's24_breaking_v2';
  // ⚙️ الجلب حسب النشاط — لتغيير السرعة مستقبلاً عدّل هذه القيم فقط
  var CACHE_ACTIVE_MS = 60 * 1000;         // عاجل نشط: عمر نسخة اللوحة على جهاز الزائر
  var REFRESH_ACTIVE_MS = 3 * 60 * 1000;   // عاجل نشط: قراءة اللوحة في الصفحة المفتوحة
  var CACHE_IDLE_MS = 5 * 60 * 1000;       // لا عاجل: عمر النسخة
  var REFRESH_IDLE_MS = 10 * 60 * 1000;    // لا عاجل: قراءة اللوحة في الصفحة المفتوحة
  var FEED_MS = 2 * 60 * 1000;             // فحص مقالات *A (خلاصة المدونة، مجاني)
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

  // هل في مستند اللوحة خبر ظاهر الآن؟ (بلا شبكة)
  function panelHasLive(panel) {
    var items = (panel && panel.items) || {}, now = Date.now();
    return Object.keys(items).some(function (k) {
      var it = items[k] || {};
      if (it.hidden === true || !it.title) return false;
      var start = Number(it.start) || 0, end = Number(it.end) || 0;
      return end && now >= start && now < end;
    });
  }

  // النشاط = خبر ظاهر في الشريط الآن، أو خبر ظاهر في آخر نسخة محفوظة من اللوحة
  function isActive() {
    if (list.length) return true;
    try {
      var rec = JSON.parse(localStorage.getItem(CACHE_KEY));
      return !!(rec && panelHasLive(rec.data));
    } catch (e) { return false; }
  }

  // مستند اللوحة: من الكاش إن كان حديثاً (مدته حسب النشاط)، وإلا طلب واحد
  function loadPanelDoc() {
    var ttl = isActive() ? CACHE_ACTIVE_MS : CACHE_IDLE_MS;
    // طبقة القراءة الموحّدة (utils.js) — والكود أدناه احتياط إن لم تُحمَّل بعد
    if (window.S24Feed) {
      return window.S24Feed.get('breaking_news/current', { key: CACHE_KEY, ttl: ttl })
        .then(function (d) { return d || {}; });
    }
    var c = window.S24Cache ? window.S24Cache.get(CACHE_KEY, ttl) : null;
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

  var panelCache = null, autoCache = null, nextT = null;
  function refresh() {
    Promise.all([loadPanelDoc(), loadAutoPosts()]).then(function (r) {
      panelCache = r[0] || {};
      autoCache = r[1] || [];
      render(build(panelCache, autoCache));
      schedule();
    });
  }

  // الفحص التالي للصفحة المفتوحة: أسرع ما دام في الشريط عاجل، وأبطأ في الهدوء
  function schedule() {
    clearTimeout(nextT);
    nextT = setTimeout(function () {
      if (document.hidden) { schedule(); return; }  // التبويب المخفي لا يقرأ
      refresh();
    }, isActive() ? REFRESH_ACTIVE_MS : REFRESH_IDLE_MS);
  }

  refresh();

  // العودة إلى التبويب بعد غياب: فحص فوري (لا يكلّف قراءة إن كانت النسخة صالحة)
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) refresh();
  });

  // مقالات *A: فحص الخلاصة المجانية وحدها، بلا قراءة من Firestore.
  // إن ظهرت مقالة عاجلة والشريط كان هادئاً، تُقرأ اللوحة فوراً ويبدأ وضع النشاط.
  setInterval(function () {
    if (document.hidden) return;
    loadAutoPosts().then(function (posts) {
      var wasActive = list.length > 0;
      autoCache = posts;
      render(build(panelCache || {}, autoCache));
      if (!wasActive && list.length) refresh();
    });
  }, FEED_MS);

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

  // إعادة فحص الصلاحية كل دقيقة بلا طلبات (انتهاء خبر، أو بدء خبر مجدول)
  setInterval(function () {
    if (!document.hidden && panelCache) render(build(panelCache, autoCache || []));
  }, 60 * 1000);
});
