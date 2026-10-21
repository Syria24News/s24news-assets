/* ============================================================
   S24News — متفرقات صغيرة (ست كتل مستقلة)
   قائمة «معلومات عامة» بمجموعاتها الفرعية · سنة الحقوق · صندوق الكوكيز
   صنف صفحة الموسوعة · زر العودة للبث · زر «انسخ الرابط» لصفحات الفريق
   ============================================================ */

/* ============ 1) قائمة «معلومات عامة» (LinkList3) — طيّ + مجموعات فرعية ============
   • زر «معلومات عامة» يفتح القائمة ويغلقها (toggleLinkList3 كما كان)
   • أي رابط في الأداة عنوانه URL هو «#» يصبح رأس مجموعة
   • الرابط الذي يبدأ اسمه بشرطة «-» يدخل تحت أقرب رأس مجموعة فوقه (وتُحذف الشرطة من العرض)
   • الرابط بلا شرطة يبقى مستقلاً في القائمة الرئيسية، ويُنهي المجموعة التي قبله
     (تُدار كلها من «التنسيق» ← أداة «معلومات عامة»، والفرز «بلا فرز»)
   • فتح مجموعة يغلق الأخرى، والمجموعة التي فيها الصفحة الحالية تُفتح تلقائياً وتُميَّز الصفحة */
function toggleLinkList3(btn) {
  var content = document.getElementById('linklist3-content');
  if (content.style.display === 'block') {
    content.style.display = 'none';
    btn.classList.remove('active');
  } else {
    content.style.display = 'block';
    btn.classList.add('active');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  var box = document.getElementById('linklist3-content');
  var list = box && box.querySelector('ul');
  if (!list) return;

  var CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  var here = location.pathname.replace(/\/$/, '');
  var items = Array.prototype.slice.call(list.children);
  var group = null, groups = [], currentGroup = null;

  function isHeader(a) {
    var h = a ? (a.getAttribute('href') || '') : '';
    return h === '#' || /\/#$/.test(h);
  }

  items.forEach(function (li) {
    var a = li.querySelector('a');
    if (isHeader(a)) {
      // تحويل الرابط إلى رأس مجموعة قابلة للفتح
      var head = document.createElement('button');
      head.type = 'button';
      head.className = 's24m-head';
      head.setAttribute('aria-expanded', 'false');
      head.innerHTML = '<span></span>' + CHEVRON;
      head.firstChild.textContent = a.textContent.trim();
      var sub = document.createElement('ul');
      sub.className = 's24m-sub';
      li.className = 's24m-group';
      li.innerHTML = '';
      li.appendChild(head);
      li.appendChild(sub);
      group = { li: li, head: head, sub: sub };
      groups.push(group);
      head.addEventListener('click', function () { toggle(li); });
      return;
    }
    // تمييز رابط الصفحة الحالية
    if (a) {
      try {
        if (new URL(a.href, location.href).pathname.replace(/\/$/, '') === here) {
          a.classList.add('s24m-current');
          if (group) currentGroup = group.li;
        }
      } catch (e) {}
    }
    // الشرطة (- أو – أو —) أو الشرطة السفلية (_ أو ـ) في أول الاسم أو آخره = تابع لأقرب مجموعة فوقه؛
    // بلا شرطة = رابط مستقل يُنهي المجموعة. تُحذف العلامة من الاسم الظاهر
    // (آخر الاسم أيضاً لأن المحرر قد يضعها هناك في الكتابة من اليمين لليسار)
    var isChild = /^\s*[-_\u2013\u2014\u0640]|[-_\u2013\u2014\u0640]\s*$/;
    var dash = /^\s*[-_\u2013\u2014\u0640]+\s*|\s*[-_\u2013\u2014\u0640]+\s*$/g;
    if (a && isChild.test(a.textContent) && group) {
      a.textContent = a.textContent.replace(dash, '');
      group.sub.appendChild(li);
    } else {
      if (a) a.textContent = a.textContent.replace(dash, '');
      if (a && a.classList.contains('s24m-current')) currentGroup = null;
      group = null;
    }
  });

  function toggle(li) {
    var open = !li.classList.contains('is-open');
    groups.forEach(function (g) {
      var on = open && g.li === li;
      g.li.classList.toggle('is-open', on);
      g.head.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
  }

  // فتح القائمة والمجموعة تلقائياً إذا كانت الصفحة الحالية من روابطها
  if (currentGroup) {
    toggle(currentGroup);
    var btn = document.querySelector('.custom-dropdown-container .dropdown-btn');
    if (btn && box.style.display !== 'block') toggleLinkList3(btn);
  }
});

/* ============ 2) تحديث سنة الحقوق ============ */
  // كود تحديث السنة تلقائياً في الحقوق
  document.addEventListener("DOMContentLoaded", function() {
      var yearSpan = document.getElementById('currentYear');
      if (yearSpan) {
          yearSpan.textContent = new Date().getFullYear();
      }
  });

/* ============ 3) صندوق الكوكيز ============ */
document.addEventListener("DOMContentLoaded", function() {
    const cookieBox = document.getElementById('s24n-cookie-box');
    const acceptBtn = document.getElementById('s24n-accept-btn');
    const STORAGE_KEY = 's24n_cookie_consent_vars'; // مفتاح جديد

    if (!localStorage.getItem(STORAGE_KEY)) {
        cookieBox.style.display = 'block';
        setTimeout(() => {
            cookieBox.classList.add('show');
        }, 1000);
    }

    if(acceptBtn) {
        acceptBtn.addEventListener('click', function() {
            localStorage.setItem(STORAGE_KEY, 'true');
            cookieBox.classList.remove('show');
            setTimeout(() => {
                cookieBox.style.display = 'none';
            }, 400);
        });
    }
});

/* ============ 4) صنف صفحة الموسوعة ============ */
document.addEventListener("DOMContentLoaded", function() {
    if (window.location.pathname.indexOf('glossary') > -1) {
        document.body.classList.add('glossary-index-page');
    }
});

/* ============ 5) زر العودة للبث المباشر ============ */
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
     // يظهر الزر مع الصيغة القديمة (source=updates) أو الجديدة (lc=gr1)
    // arc=gr1_<وقت> يعني أن القارئ جاء من تغطية سابقة (أرشيف) فيعود إليها نفسها
    const lc = params.get("lc");
    const arc = params.get("arc");
    const validLc = lc && /^gr[0-9]+$/.test(lc);
    const validArc = arc && /^gr[0-9]+_[0-9]+$/.test(arc);
    if (params.get("source") === "updates" || validLc || validArc) {
        const container = document.getElementById("live-return-container");
        // العودة إلى نفس التغطية التي جاء منها القارئ (الحالية أو السابقة)
        const returnUrl = "/p/lbs24n.html" + (validArc ? "?arc=" + arc : (validLc ? "?tab=" + lc : ""));

        if (container) {
            container.innerHTML = `
                <a class='live-return-pill' href='${returnUrl}' id='stickyLiveBtn'>
                    <div class='live-indicator-dot'></div>
                    <span>${validArc ? 'العودة للتغطية' : 'العودة للتغطية الحية'}</span>
                    <svg fill='none' height='18' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='18'>
                        <path d='M19 12H5M12 19l-7-7 7-7'/>
                    </svg>
                </a>`;

            setTimeout(() => {
                const btn = document.getElementById("stickyLiveBtn");
                if(btn) btn.classList.add("visible");
            }, 800);
        }
    }
});

/* ============ 6) زر «انسخ الرابط» في صفحات أعضاء الفريق (/p/team-…) ============
   في قالب الشخص: <a class="s24p-copy" href="#">انسخ الرابط</a> — بلا سكربت داخل الصفحة نفسها */
document.addEventListener('click', function (e) {
  var btn = e.target.closest && e.target.closest('.s24p-copy');
  if (!btn) return;
  e.preventDefault();
  var url = location.origin + location.pathname;
  var old = btn.getAttribute('data-label') || btn.textContent;
  btn.setAttribute('data-label', old);
  var done = function () { btn.textContent = 'تم النسخ ✓'; setTimeout(function () { btn.textContent = old; }, 2000); };
  try { navigator.clipboard.writeText(url).then(done, function () { window.prompt('', url); }); }
  catch (err) { window.prompt('', url); }
});
