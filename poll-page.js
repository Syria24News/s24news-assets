/* ============================================================
   S24News — صفحة الاستطلاعات /p/polls.html (poll-page.js)
   v1.1 — 27 نوفمبر 2026: «استطلاعات سابقة» مقسّمة بعنوان لكل شهر (تشرين الثاني 2026…) — بلا أي قراءة إضافية
   v1.0 — 26 نوفمبر 2026
   - على نسق صفحة استطلاعات روسيا اليوم: بطاقة لكل استطلاع، النسبة لكل خيار، و«عدد المشاركين»
   - «مفتوحة الآن»: التصويت من الصفحة، والنتائج بعد التصويت فقط (كما في ودجت الرئيسية)
   - «استطلاعات سابقة»: المغلقة ومنتهية المدة بنتائجها النهائية للجميع، وتاريخ انتهائها، ورابط الخبر
     (المسودة و«مخفي» لا تصل إلى الصفحة أصلاً — البوابة لا تكتبها في الأرشيف)
   - يعتمد على النواة window.S24Poll في poll.js (يُحمَّل قبله في الصفحة نفسها) — لا تكرار لكود التصويت
   الحصص (لكل زيارة):
   - مستند active: نفس نسخة الودجت على جهاز الزائر (دقيقتان / 30 دقيقة) — غالباً صفر قراءة إضافية
   - أرشيف الشهر: يُقرأ فقط إذا تغيّر (خريطة archive في active)، والأشهر الماضية محفوظة على الجهاز دائماً
   - شهر أقدم لا يُقرأ إلا عند «عرض المزيد»
   - نتائج المفتوحة لمن صوّت: طلب واحد للبوابة للصفحة كلها (نسخة جلسة دقيقتان)
   ============================================================ */
(function () {
  'use strict';
  var P = window.S24Poll;
  if (!P) return;

  var PAGE_SIZE = 10;                       // عدد الاستطلاعات السابقة في كل دفعة
  var ARCH_KEY = 's24_polls_arch_';         // نسخة كل شهر على الجهاز: { t: زمن آخر تغيير من الخريطة، d: العناصر }
  var esc = P.esc;
  var fmtDay = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Damascus' });
  var fmtMonth = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { month: 'long', year: 'numeric', timeZone: 'Asia/Damascus' });

  var PAGE_CSS = [
    '#s24-polls-page{display:flex;flex-direction:column;gap:18px;direction:rtl}',
    '.s24pl-h{font-family:var(--font-title);font-size:20px;font-weight:700;margin:10px 0 0;padding-bottom:8px;border-bottom:2px solid var(--sy-green,#77bd1d);color:var(--text-main,#111)}',
    '.s24pl-card{background:var(--card-bg,#fff);border:1px solid #e6e6e6;border-radius:8px;padding:20px;display:flex;flex-direction:column;gap:14px}',
    '.s24pl-badge{align-self:flex-start;font-size:12px;font-weight:700;padding:3px 10px;border-radius:12px;background:#f1f1f1;color:#666}',
    '.s24pl-badge.is-open{background:#eef7e1;color:#4f7d14}',
    '.s24pl-month{font-family:var(--font-title);font-size:16px;font-weight:700;color:#666;margin:8px 0 0}',
    '.s24pl-q{font-family:var(--font-title);font-size:18px;font-weight:700;line-height:1.6;margin:0;color:var(--text-main,#111)}',
    '.s24pl-card .poll__options{margin-bottom:6px}',
    '.s24pl-results{display:flex;flex-direction:column;gap:18px}',
    '.s24pl-results[hidden],.s24pl-form[hidden]{display:none}',
    '.s24pl-msg{font-size:14px;color:#c0392b;margin:0}',
    '.s24pl-msg:empty{display:none}',
    '.s24pl-link{align-self:flex-start;font-size:14px;font-weight:700;color:var(--sy-green,#77bd1d);text-decoration:none}',
    '.s24pl-link:hover{text-decoration:underline}',
    '.s24pl-more{align-self:center;min-width:200px;padding:11px 22px;border:1px solid var(--sy-green,#77bd1d);background:transparent;color:var(--sy-green,#77bd1d);border-radius:6px;font:inherit;font-weight:700;cursor:pointer}',
    '.s24pl-more:hover{background:var(--sy-green,#77bd1d);color:#fff}',
    '.s24pl-more[disabled]{opacity:.6;cursor:default}',
    '.s24pl-empty{text-align:center;color:#888;padding:24px 0}',
    '[data-theme="dark"] .s24pl-card{background:#1e1e1e;border-color:#333}',
    '[data-theme="dark"] .s24pl-q,[data-theme="dark"] .s24pl-h{color:#fff}',
    '[data-theme="dark"] .s24pl-month{color:#aaa}',
    '[data-theme="dark"] .s24pl-badge{background:#2a2a2a;color:#bbb}',
    '[data-theme="dark"] .s24pl-badge.is-open{background:#26330f;color:#b6dc7a}',
    '@media (max-width:768.98px){.s24pl-card{padding:15px}.s24pl-q{font-size:17px}}'
  ].join('\n');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // نصوص الخيارات 1…6 الموجودة فعلاً (مع رقم الخانة)
  function optionsOf(x) {
    var res = [];
    for (var i = 1; i <= 6; i++) if (x['opt' + i]) res.push({ slot: i, text: x['opt' + i] });
    return res;
  }

  // صندوق النتائج: الصفوف + «عدد المشاركين»
  function fillResults(box, x, counts, total) {
    var opts = optionsOf(x);
    box.innerHTML = P.resultRows(opts.map(function (o) { return o.text; }),
                                 opts.map(function (o) { return counts[o.slot] || 0; })) +
      '<div class="total-votes-container"><span class="total-label">عدد المشاركين</span>' +
      '<span class="total-number">' + P.fmtNum(total) + '</span></div>';
    box.hidden = false;
  }

  /* ---------------- الاستطلاعات المفتوحة ---------------- */
  function openCard(x, idx) {
    var card = el('article', 's24pl-card');
    card.appendChild(el('span', 's24pl-badge is-open', 'مفتوح للتصويت'));
    card.appendChild(el('h3', 's24pl-q', x.q));

    var form = el('div', 's24pl-form');
    var opts = el('div', 'poll__options');
    optionsOf(x).forEach(function (o) {
      var label = el('label', 'poll-label');
      label.appendChild(el('span', 'poll-text', o.text));
      var input = el('input');
      input.type = 'radio';
      input.name = 's24pl_' + idx;
      input.value = String(o.slot);
      label.appendChild(input);
      opts.appendChild(label);
    });
    var btn = el('button', 'poll__submit-button', 'صوّت');
    btn.type = 'button';
    btn.disabled = true;
    var msg = el('p', 's24pl-msg');
    form.appendChild(opts);
    form.appendChild(btn);
    form.appendChild(msg);
    card.appendChild(form);

    var res = el('div', 's24pl-results');
    res.hidden = true;
    card.appendChild(res);

    opts.addEventListener('change', function () { P.loadRecaptcha(); btn.disabled = false; });
    btn.addEventListener('click', function () {
      var sel = opts.querySelector('input:checked');
      if (!sel) return;
      btn.disabled = true;
      btn.textContent = 'جاري الإرسال...';
      msg.textContent = '';
      P.vote(x.pollId, parseInt(sel.value, 10)).then(function (data) {
        btn.textContent = 'صوّت';
        if (data.error && !data.already_voted) { msg.textContent = data.error; btn.disabled = false; return; }
        showCounts(card, x, data);
      }).catch(function (err) {
        btn.textContent = 'صوّت';
        btn.disabled = false;
        msg.textContent = (err && err.name === 'AbortError') ? 'انتهت المهلة الزمنية. تأكد من اتصالك بالإنترنت.'
          : 'حدث خطأ في إرسال التصويت. يرجى المحاولة مرة أخرى.';
      });
    });
    card._form = form;
    card._res = res;
    return card;
  }

  // أعداد من رد البوابة (opt1Count…، total) ← صندوق النتائج مكان النموذج
  function showCounts(card, x, data) {
    var counts = {};
    for (var i = 1; i <= 6; i++) counts[i] = Number(data['opt' + i + 'Count']) || 0;
    card._form.hidden = true;
    fillResults(card._res, x, counts, Number(data.total) || 0);
  }

  // من صوّت سابقاً (في الرئيسية أو هنا): طلب نتائج واحد لكل المفتوحة التي صوّت فيها
  function loadVotedResults(cards) {
    var voted = cards.filter(function (c) { return P.isVoted(c.x.pollId); });
    if (!voted.length) return;
    voted.forEach(function (c) {
      c.card._form.hidden = true;
      c.card._res.hidden = false;
      c.card._res.innerHTML = '<p class="s24pl-empty">جاري تحميل النتائج...</p>';
    });
    P.results(voted.map(function (c) { return c.x.pollId; })).then(function (map) {
      voted.forEach(function (c) {
        var r = map[c.x.pollId] || {};
        if (typeof r.total === 'number') return showCounts(c.card, c.x, r);
        c.card._res.hidden = true;          // لا صوت مسجّل لهذا الجهاز أو تعذّر الطلب: يعود النموذج
        c.card._form.hidden = false;
        if (r.error && !r.not_voted) c.card.querySelector('.s24pl-msg').textContent = 'تعذّر تحميل النتائج حالياً';
      });
    }).catch(function () {
      voted.forEach(function (c) { c.card._res.innerHTML = '<p class="s24pl-empty">تعذّر تحميل النتائج حالياً</p>'; });
    });
  }

  /* ---------------- الاستطلاعات السابقة (الأرشيف) ---------------- */
  function closedCard(x) {
    var card = el('article', 's24pl-card');
    card.appendChild(el('span', 's24pl-badge', 'انتهى التصويت · ' + fmtDay.format(new Date(Number(x.closedAt) || 0))));
    card.appendChild(el('h3', 's24pl-q', x.q));
    var res = el('div', 's24pl-results');
    var counts = {};
    for (var i = 1; i <= 6; i++) counts[i] = Number(x['c' + i]) || 0;
    fillResults(res, x, counts, Number(x.total) || 0);
    card.appendChild(res);
    if (/^https:\/\/www\.syria24\.news\//.test(String(x.postUrl || ''))) {
      var a = el('a', 's24pl-link', 'اقرأ الخبر المرتبط');
      a.href = x.postUrl;
      card.appendChild(a);
    }
    return card;
  }

  // عناصر شهر من الأرشيف: من الجهاز إن لم يتغيّر، وإلا من Firestore (قراءة واحدة)
  function loadMonth(m, t) {
    var key = ARCH_KEY + m, cached = null;
    try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
    if (cached && cached.t === t && Array.isArray(cached.d)) return Promise.resolve(cached.d);
    return P.fetchDoc(P.FS_DOCS + 'archive_' + m).then(function (doc) {
      // البوابة 1.4.0 تكتب العناصر نصاً واحداً بصيغة JSON في الحقل json (تنزيل أصغر)
      var items = [];
      try { items = JSON.parse((doc && doc.json) || '[]'); } catch (e) {}
      items = (Array.isArray(items) ? items : []).filter(function (x) { return x && x.pollId && x.q; });
      try { localStorage.setItem(key, JSON.stringify({ t: t, d: items })); } catch (e) {}
      return items;
    }).catch(function () {
      return (cached && Array.isArray(cached.d)) ? cached.d : [];   // دون اتصال: آخر نسخة مهما كان عمرها
    });
  }

  // حذف نسخ الأشهر التي لم تعد في الخريطة (أُخفي كل ما فيها)
  function pruneMonths(keep) {
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf(ARCH_KEY) === 0 && !keep[k.slice(ARCH_KEY.length)]) localStorage.removeItem(k);
      }
    } catch (e) {}
  }

  function initArchive(root, archive) {
    var months = Object.keys(archive || {})
      .filter(function (k) { return /^m\d{4}_\d{2}$/.test(k) && archive[k] && archive[k].n > 0; })
      .map(function (k) { return k.slice(1); })
      .sort().reverse();
    var keep = {};
    months.forEach(function (m) { keep[m] = true; });
    pruneMonths(keep);
    if (!months.length) return false;

    root.appendChild(el('h2', 's24pl-h', 'استطلاعات سابقة'));
    var list = el('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:18px';
    root.appendChild(list);
    var more = el('button', 's24pl-more', 'عرض المزيد');
    more.type = 'button';
    root.appendChild(more);

    var queue = [], next = 0, busy = false, lastMonth = '';
    function showMore() {
      if (busy) return;
      busy = true;
      more.disabled = true;
      // اجلب أشهراً حتى يكتمل عدد الدفعة أو تنتهي الأشهر
      (function fill() {
        if (queue.length >= PAGE_SIZE || next >= months.length) return Promise.resolve();
        var m = months[next++];
        return loadMonth(m, archive['m' + m].t).then(function (items) { queue = queue.concat(items); return fill(); });
      })().then(function () {
        queue.splice(0, PAGE_SIZE).forEach(function (x) {
          // عنوان الشهر قبل أول استطلاع منه (الترتيب الأحدث أولاً)
          var mt = fmtMonth.format(new Date(Number(x.closedAt) || 0));
          if (mt !== lastMonth) { lastMonth = mt; list.appendChild(el('h3', 's24pl-month', mt)); }
          list.appendChild(closedCard(x));
        });
        busy = false;
        more.disabled = false;
        more.hidden = !queue.length && next >= months.length;
        if (!list.querySelector('.s24pl-card')) { more.hidden = true; list.appendChild(el('p', 's24pl-empty', 'لا توجد استطلاعات سابقة.')); }
      });
    }
    more.addEventListener('click', showMore);
    showMore();
    return true;
  }

  /* ---------------- التشغيل ---------------- */
  function init() {
    var root = document.getElementById('s24-polls-page');
    if (!root) return;
    var style = el('style');
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
    root.innerHTML = '';
    var loading = el('p', 's24pl-empty', 'جاري تحميل الاستطلاعات...');
    root.appendChild(loading);

    P.getState().then(function (state) {
      root.removeChild(loading);
      var open = state.d || [];
      if (open.length) {
        root.appendChild(el('h2', 's24pl-h', 'مفتوحة الآن'));
        var cards = open.map(function (x, i) {
          var card = openCard(x, i);
          root.appendChild(card);
          return { x: x, card: card };
        });
        // نص الإسناد الذي تشترطه Google مرة واحدة تحت آخر استطلاع مفتوح
        var anchor = el('div');
        root.appendChild(anchor);
        P.addRecaptchaNote(anchor);
        loadVotedResults(cards);
      }
      var hasArchive = initArchive(root, state.a);
      if (!open.length && !hasArchive) root.appendChild(el('p', 's24pl-empty', 'لا توجد استطلاعات حالياً.'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
