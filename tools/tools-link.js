/*!
 * tools-link.js — ربط أدوات غرفة الأخبار المعزولة بخادم اللوحة المركزية، وشاشة القفل (22 نوفمبر 2026)
 * ─────────────────────────────────────────────────────────────────────────────
 * يُحمَّل في <head> كل أداة في tools/ قبل أي سكربت آخر:
 *   <script src="tools-link.js" data-tool="اسم الأداة"></script>
 *
 * ما يفعله:
 *  1) يستقبل الربط القادم من مربّع الأداة في اللوحة بعد «#pe=» (رابط الخادم /exec + مفتاح الأدوات)،
 *     فيحفظه في هذا المتصفح باسم sy_pe_api ثم يمحوه من شريط العنوان فوراً.
 *     لا يُقبل إلا رابط خادم Google Apps Script، كي لا يوجّه رابطٌ مصطنع بيانات الأداة إلى خادم غريب.
 *  2) يعرض window.S24ToolsLink.get() — الربط المحفوظ أو null — لتستعمله الأداة في طلباتها إلى البوابة.
 *  3) شاشة القفل: إن لم يكن المتصفح مربوطاً، تُخفى الأداة كلها وتظهر رسالة «افتحها من مربّعها في اللوحة».
 *
 * القفل تنظيمي لا سرّي: الحماية الحقيقية على الخادم (مفتاح البوابة PE_API_KEY، ومفتاح Gemini في خصائص السكربت).
 * الصفحة لا تحمل أي مفتاح، والقفل يضمن أن الأدوات لا تُستعمل إلا من داخل اللوحة.
 * إن نُقلت واجهة اللوحة كلها إلى GitHub يوماً، تصير هذه الشاشة شاشة تسجيل الدخول نفسها.
 */
(function () {
  'use strict';
  var LS = 'sy_pe_api';
  var URL_RX = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/(exec|dev)$/;
  var me = document.currentScript;
  var toolName = (me && me.getAttribute('data-tool')) || 'هذه الأداة';

  /* 1) استقبال الربط من اللوحة */
  var m = /[#&]pe=([^&]+)/.exec(location.hash || '');
  if (m) {
    try {
      var inc = JSON.parse(decodeURIComponent(m[1]));
      if (inc && inc.key && URL_RX.test(String(inc.url)))
        localStorage.setItem(LS, JSON.stringify({ url: String(inc.url), key: String(inc.key) }));
    } catch (e) {}
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
  }

  /* 2) الربط المحفوظ (أو null) */
  function get() {
    try {
      var c = JSON.parse(localStorage.getItem(LS) || 'null');
      return (c && c.key && URL_RX.test(String(c.url))) ? c : null;
    } catch (e) { return null; }
  }
  window.S24ToolsLink = { get: get };

  if (get()) return;

  /* 3) شاشة القفل: تُخفى الأداة قبل أن تُرسم، ثم تُضاف الرسالة حين يجهز الجسم */
  document.documentElement.classList.add('s24-locked');
  var css = document.createElement('style');
  css.textContent =
    'html.s24-locked body>*:not(#s24-lock){display:none!important}' +
    'html.s24-locked body{margin:0;background:#16161f}' +
    '#s24-lock{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;' +
      'font-family:"IBM Plex Sans Arabic","Readex Pro",system-ui,sans-serif;color:#e8e8ee;direction:rtl;text-align:center}' +
    '#s24-lock .card{max-width:420px;background:#1f1f2b;border:1px solid #2e2e3e;border-top:4px solid #77bd1d;border-radius:14px;padding:28px 24px}' +
    '#s24-lock .ico{font-size:40px;line-height:1;margin-bottom:12px}' +
    '#s24-lock h1{font-size:20px;margin:0 0 10px;font-weight:800}' +
    '#s24-lock p{font-size:14px;line-height:1.9;margin:0;color:#b8b8c6}' +
    '#s24-lock .brand{margin-top:16px;font-size:12px;color:#77bd1d;font-weight:700}' +
    '@media(prefers-color-scheme:light){html.s24-locked body{background:#f0f2f5}' +
      '#s24-lock{color:#1a1a2e}#s24-lock .card{background:#fff;border-color:#d0d5dd;border-top-color:#77bd1d}#s24-lock p{color:#555}}';
  document.head.appendChild(css);

  function showLock() {
    if (document.getElementById('s24-lock')) return;
    var box = document.createElement('div');
    box.id = 's24-lock';
    box.innerHTML =
      '<div class="card"><div class="ico">🔒</div><h1></h1>' +
      '<p>أداة داخلية لغرفة الأخبار. افتحها من مربّعها في اللوحة المركزية،' +
      ' وبعدها تعمل على هذا الجهاز مباشرة.</p>' +
      '<div class="brand">Syria24.News</div></div>';
    box.querySelector('h1').textContent = toolName;
    document.body.insertBefore(box, document.body.firstChild);
  }
  if (document.body) showLock();
  else document.addEventListener('DOMContentLoaded', showLock);
})();
