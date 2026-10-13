/* ============================================================
   S24News — وحدة التغطية الحية في لوحة التحكم (admin/js/live.js)
   الإصدار 1.0 — 13 أكتوبر 2026

   ما تديره هذه الوحدة (مستند واحد: coverage_groups/current):
   - groups.grN    اسم التغطية الظاهر في الصفحة وصندوق الرئيسية
   - statuses.grN  active | pinned | inactive | closed
   - since.grN     بداية التغطية الحالية (زر "تغطية جديدة") — الأقدم لا يُعرض
   ولا تلمس lastAt (يكتبه Apps Script وحده بعد كل خبر).

   الأخبار (live_coverage): عرض آخر 50 لكل مجموعة + إخفاء/إظهار (حقل hidden فقط).
   زر "زامن الآن": يستدعي تطبيق الويب لمشروع Syria24_Coverage_Migration (?action=sync).

   التوفير: قراءة المجموعات = مستند واحد، والأخبار تُقرأ عند فتح نافذتها فقط،
   وكلاهما عبر smartLoad (النسخة المحفوظة أولاً، والخادم بعد 5 دقائق أو عند "تحديث").
   ============================================================ */
import { db, $, esc, clean, fmtDate, fmtAgo, toast, errText, smartLoad, commit, callDeferred,
  requireOnline, isOnline, collection, doc, updateDoc, query, where, orderBy, limit, serverTimestamp } from './core.js';

// ⚠️ رابط تطبيق الويب (/exec) لمشروع Syria24_Coverage_Migration — يُلصق هنا بعد النشر
const SYNC_URL = 'https://script.google.com/macros/s/AKfycbzzQPbraQZh-gIaPYgKKYTOFJ7xHyzut1nP-U9W8jJ2tsc4S7Hah-nIh4lNT8Rf7V3UTA/exec';

const SITE = 'https://www.syria24.news';
const WINDOW_MS = 24 * 60 * 60 * 1000;   // نفس نافذة صندوق الرئيسية
const MAX_ITEMS = 50;                      // نفس حد صفحة التغطية

const STATUS_LABEL = { active: 'نشطة', pinned: 'مثبّتة', inactive: 'مخفية', closed: 'منتهية' };
const STATUS_TITLE = {
  active: 'تظهر في الرئيسية إذا وصلها خبر خلال 24 ساعة',
  pinned: 'تظهر في الرئيسية دائماً',
  inactive: 'لا تظهر في الرئيسية (الصفحة تبقى تعمل)',
  closed: 'منتهية: لا تظهر في الرئيسية، والصفحة تعرض عبارة انتهاء التغطية'
};

const MARKUP = `
  <section id="liveView">
    <style>
      #liveView .lv-id{font-size:12px;opacity:.7;direction:ltr;text-align:right}
      #liveView .lv-name{width:100%;min-width:150px;margin-top:4px}
      #liveView .lv-why{font-size:12px;opacity:.75;margin-top:4px}
      #liveView .lv-guide summary{cursor:pointer;font-weight:700;list-style-position:inside}
      #liveView .lv-guide ol{margin:12px 0 0;padding-inline-start:22px;line-height:2}
      #liveView code,#lvDlgNews code{direction:ltr;unicode-bidi:isolate;font-family:ui-monospace,Consolas,monospace;
        background:rgba(119,189,29,.14);padding:1px 6px;border-radius:4px;font-size:.92em}
      #lvDlgNews .lv-item{padding:12px 0;border-bottom:1px solid rgba(127,127,127,.22)}
      #lvDlgNews .lv-item:last-child{border-bottom:0}
      #lvDlgNews .lv-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;opacity:.85;margin-bottom:4px}
      #lvDlgNews .lv-title{font-weight:600;line-height:1.7;margin-bottom:8px;overflow-wrap:anywhere}
      #lvDlgNews .lv-item.is-hidden .lv-title,#lvDlgNews .lv-item.is-old .lv-title{opacity:.5}
      #lvDlgNews .lv-item.is-hidden .lv-title{text-decoration:line-through}
    </style>

    <div class="kpis" id="lvKpis"></div>

    <details class="card lv-guide">
      <summary>دليل الكاتب: نشر خبر في التغطية الحية</summary>
      <ol>
        <li>اكتب الخبر في بلوغر. <b>العنوان وحده</b> يظهر في الخط الزمني، فاجعله خبراً كاملاً قصيراً.</li>
        <li>انتقل إلى وضع HTML والصق وسم المجموعة، مثل <code>&lt;!-- COVERAGE: gr1 --&gt;</code> (زر «نسخ الوسم» في كل مجموعة أدناه).</li>
        <li>للعاجل: أضف التصنيف (Label) <code>*A</code>. كتابة <code>*A</code> في بداية العنوان ما زالت تعمل أيضاً.</li>
        <li>انشر. يظهر الخبر خلال 5 دقائق، أو فوراً بزر «زامن الآن».</li>
        <li>لتصحيح خبر: عدّله في بلوغر. لإخفائه من الصفحة دون حذف المقالة: زر «الأخبار» في مجموعته.</li>
        <li>لبدء تغطية جديدة في الخانة نفسها: زر «تغطية جديدة» (الأخبار السابقة تختفي من صفحتها وتبقى محفوظة).</li>
      </ol>
    </details>

    <div class="card toolbar">
      <span class="hint" id="lvSyncInfo"></span>
      <span class="spacer"></span>
      <button class="btn" id="lvReload" type="button">تحديث</button>
      <button class="btn" id="lvAdd" type="button">+ مجموعة</button>
      <button class="btn btn-primary" id="lvSync" type="button">زامن الآن</button>
    </div>

    <div class="card table-wrap">
      <table class="cards-sm">
        <thead>
          <tr>
            <th>المجموعة</th>
            <th>الحالة</th>
            <th>في الرئيسية</th>
            <th>آخر خبر</th>
            <th>بداية التغطية</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody id="lvBody"></tbody>
      </table>
      <div class="empty" id="lvEmpty" hidden>لا توجد مجموعات بعد — شغّل migrateGroupsToFirestore مرة واحدة من Apps Script.</div>
    </div>
  </section>

  <dialog id="lvDlgNews">
    <div class="dlg-head">
      <h2 id="lvNewsTitle">الأخبار</h2>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm" type="button" id="lvNewsReload">تحديث</button>
        <button class="btn btn-sm" type="button" data-close>إغلاق</button>
      </div>
    </div>
    <div class="dlg-body">
      <p class="hint">آخر ${MAX_ITEMS} خبراً. «إخفاء» يزيل الخبر من صفحة التغطية فوراً ولا يمسّ المقالة في بلوغر.</p>
      <div id="lvNewsBody"></div>
    </div>
  </dialog>`;

/* ============ أدوات مساعدة ============ */
const groupsRef = () => doc(db, 'coverage_groups', 'current');
const num = (v) => Number(v) || 0;
const tagOf = (id) => '<!-- COVERAGE: ' + id + ' -->';

// ترتيب gr1، gr2 … gr10 رقمياً
function sortIds(ids) {
  return ids.sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0));
}

// نفس منطق صندوق الرئيسية تماماً — ما تراه هنا هو ما يراه القارئ
function homeState(id, d, now) {
  const st = (d.statuses || {})[id] || 'active';
  if (st === 'pinned') return { show: true };
  if (st === 'closed') return { show: false, why: 'منتهية' };
  if (st === 'inactive') return { show: false, why: 'مخفية يدوياً' };
  const last = num((d.lastAt || {})[id]);
  const start = num((d.since || {})[id]);
  if (!last || last < start) return { show: false, why: 'لا أخبار في التغطية الحالية' };
  if (last < now - WINDOW_MS) return { show: false, why: 'لا أخبار خلال 24 ساعة' };
  return { show: true };
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('نُسخ: ' + text); }
  catch (e) { prompt('انسخ النص:', text); }
}

let mounted = false;
let reload = () => {};

export default {
  id: 'live',
  title: 'التغطية الحية',
  // أيقونة الشريط السفلي (بث)
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2"/><path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8"/></svg>',

  mount(root) {
    if (mounted) return reload();
    mounted = true;
    root.innerHTML = MARKUP;

    let data = {};          // محتوى coverage_groups/current
    let syncInfo = null;    // آخر نتيجة مزامنة من Apps Script
    let newsFor = null;     // المجموعة المفتوحة في نافذة الأخبار
    let news = [];

    /* ============================================================
       التحميل
       ============================================================ */
    async function load(force) {
      try {
        // المجموعة فيها مستند واحد (current) = قراءة واحدة فقط
        await smartLoad(collection(db, 'coverage_groups'), 'live_groups', (snap) => {
          const d = snap.docs.find((x) => x.id === 'current');
          data = d ? d.data() : {};
          render();
        }, { force: force === true });
      } catch (e) {
        toast('تعذّر تحميل التغطيات: ' + errText(e), true);
      }
    }

    // آخر مزامنة (من خصائص Apps Script — لا قراءة من Firestore)
    async function loadSyncStatus() {
      if (!SYNC_URL || !isOnline()) return renderSyncInfo();
      try {
        const r = await fetch(SYNC_URL + '?action=status');
        syncInfo = await r.json();
      } catch (e) { /* غير حرج */ }
      renderSyncInfo();
    }

    function syncText() {
      if (!SYNC_URL) return 'غير مربوطة';
      if (!syncInfo || !syncInfo.at) return '—';
      return (syncInfo.error ? '⚠️ ' : '') + fmtAgo(syncInfo.at);
    }

    function renderSyncInfo() {
      const el = $('lvSyncInfo');
      if (!SYNC_URL) { el.textContent = 'زر المزامنة غير مربوط بعد (SYNC_URL).'; }
      else if (syncInfo && syncInfo.error) { el.textContent = '⚠️ آخر مزامنة فشلت: ' + syncInfo.error; }
      else if (syncInfo && syncInfo.at) {
        el.textContent = 'آخر مزامنة ' + fmtAgo(syncInfo.at) + ' — كُتب ' + num(syncInfo.processed) + ' خبر';
      } else { el.textContent = ''; }
      renderKpis();
    }

    /* ============================================================
       العرض
       ============================================================ */
    function renderKpis() {
      const now = Date.now();
      const ids = Object.keys(data.groups || {});
      const visible = ids.filter((id) => homeState(id, data, now).show).length;
      const maxLast = Math.max(0, ...ids.map((id) => num((data.lastAt || {})[id])));
      $('lvKpis').innerHTML = [
        ['المجموعات', ids.length],
        ['ظاهرة في الرئيسية', visible],
        ['آخر خبر', maxLast ? fmtAgo(maxLast) : '—'],
        ['آخر مزامنة', syncText()]
      ].map(([l, v]) => '<div class="card kpi"><div class="label">' + esc(l) + '</div><div class="value">' +
        esc(String(v)) + '</div></div>').join('');
    }

    function render() {
      renderKpis();
      const now = Date.now();
      const ids = sortIds(Object.keys(data.groups || {}));
      const tb = $('lvBody');
      tb.innerHTML = '';
      $('lvEmpty').hidden = ids.length > 0;
      ids.forEach((id) => tb.appendChild(rowFor(id, now)));
    }

    function rowFor(id, now) {
      const name = (data.groups || {})[id] || '';
      const st = (data.statuses || {})[id] || 'active';
      const last = num((data.lastAt || {})[id]);
      const start = num((data.since || {})[id]);
      const hs = homeState(id, data, now);

      const opts = Object.keys(STATUS_LABEL).map((s) =>
        '<option value="' + s + '"' + (s === st ? ' selected' : '') + ' title="' + esc(STATUS_TITLE[s]) + '">' +
        STATUS_LABEL[s] + '</option>').join('');

      const badge = hs.show
        ? '<span class="badge b-open">ظاهرة</span>'
        : '<span class="badge ' + (st === 'closed' ? 'b-closed' : 'b-draft') + '">غير ظاهرة</span>' +
          '<div class="lv-why">' + esc(hs.why || '') + '</div>';

      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="q-cell"><div class="lv-id"></div><input class="input lv-name" maxlength="80" aria-label="اسم التغطية"></td>' +
        '<td data-label="الحالة"><select class="input btn-sm lv-st" aria-label="الحالة" title="' + esc(STATUS_TITLE[st]) + '">' + opts + '</select></td>' +
        '<td data-label="في الرئيسية">' + badge + '</td>' +
        '<td data-label="آخر خبر" style="white-space:nowrap">' + (last ? esc(fmtAgo(last)) : '—') + '</td>' +
        '<td data-label="البداية" style="white-space:nowrap">' + (start ? esc(fmtDate(start)) : 'منذ البداية') + '</td>' +
        '<td><div class="actions">' +
          '<button class="btn btn-sm" data-act="tag" type="button">نسخ الوسم</button>' +
          '<button class="btn btn-sm" data-act="news" type="button">الأخبار</button>' +
          '<button class="btn btn-sm" data-act="new" type="button">تغطية جديدة</button>' +
          '<button class="btn btn-sm" data-act="open" type="button">الصفحة</button>' +
        '</div></td>';
      tr.querySelector('.lv-id').textContent = id;
      const inp = tr.querySelector('.lv-name');
      inp.value = name;

      // تعديل الاسم: يُحفظ عند مغادرة الحقل (لا يبدأ تغطية جديدة)
      inp.addEventListener('change', () => {
        const v = clean(inp.value, 80);
        if (!v) { inp.value = name; return toast('الاسم لا يُترك فارغاً', true); }
        if (v === name) return;
        save({ ['groups.' + id]: v }, 'حُفظ الاسم — يظهر على الموقع فوراً');
      });
      // تغيير الحالة
      tr.querySelector('.lv-st').addEventListener('change', (e) =>
        save({ ['statuses.' + id]: e.target.value }, 'الحالة: ' + STATUS_LABEL[e.target.value]));

      tr.querySelector('.actions').addEventListener('click', (e) => {
        const act = e.target && e.target.getAttribute('data-act');
        if (act === 'tag') copyText(tagOf(id));
        if (act === 'news') openNews(id);
        if (act === 'new') newCoverage(id);
        if (act === 'open') window.open(SITE + '/p/lbs24n.html?tab=' + encodeURIComponent(id), '_blank', 'noopener');
      });
      return tr;
    }

    /* ============================================================
       الحفظ (مستند المجموعات) — حقول بنقطة: groups.gr1 …
       ============================================================ */
    function applyLocal(fields) {
      Object.keys(fields).forEach((k) => {
        const [top, key] = k.split('.');
        data[top] = Object.assign({}, data[top] || {});
        data[top][key] = fields[k];
      });
    }

    async function save(fields, okMsg) {
      try {
        const w = commit(updateDoc(groupsRef(), { ...fields, updatedAt: serverTimestamp() }));
        applyLocal(fields);
        render();
        const r = await w;
        toast(r.queued ? 'حُفظ على الجهاز — يُرسل تلقائياً عند عودة الاتصال' : (okMsg || 'حُفظ'));
      } catch (e) {
        toast('تعذّر الحفظ: ' + errText(e), true);
        load(true);
      }
    }

    // بدء تغطية جديدة في الخانة نفسها: اسم جديد + since = الآن
    function newCoverage(id) {
      const cur = (data.groups || {})[id] || '';
      const ans = prompt('تغطية جديدة في الخانة ' + id +
        '\nالأخبار السابقة لن تظهر بعد الآن في صفحتها ولا في الرئيسية (تبقى محفوظة).\n\nعنوان التغطية الجديدة:', cur);
      if (ans == null) return;
      const n = clean(ans, 80);
      if (!n) return toast('العنوان مطلوب', true);
      save({ ['groups.' + id]: n, ['statuses.' + id]: 'active', ['since.' + id]: Date.now() },
        'بدأت تغطية جديدة: ' + n + ' — تظهر في الرئيسية مع أول خبر');
    }

    // إضافة خانة جديدة (gr8، gr9 …)
    $('lvAdd').addEventListener('click', () => {
      const ids = Object.keys(data.groups || {});
      let n = 1;
      while (ids.includes('gr' + n)) n++;
      const id = 'gr' + n;
      const ans = prompt('مجموعة جديدة: ' + id + '\nاسم التغطية:');
      if (ans == null) return;
      const name = clean(ans, 80);
      if (!name) return toast('الاسم مطلوب', true);
      save({ ['groups.' + id]: name, ['statuses.' + id]: 'active', ['since.' + id]: Date.now() },
        'أُضيفت ' + id + ' — وسمها: ' + tagOf(id));
    });

    $('lvReload').addEventListener('click', async () => {
      if (!requireOnline('التحديث من الخادم')) return;
      const b = $('lvReload'); b.disabled = true;
      await Promise.all([load(true), loadSyncStatus()]);
      b.disabled = false;
      toast('حُدّثت البيانات من الخادم');
    });

    /* ============================================================
       زامن الآن
       ============================================================ */
    $('lvSync').addEventListener('click', async () => {
      if (!SYNC_URL) return toast('ألصق رابط تطبيق الويب في SYNC_URL داخل live.js أولاً', true);
      const b = $('lvSync');
      b.disabled = true; b.textContent = 'جارٍ المزامنة…';
      try {
        const r = await callDeferred(SYNC_URL + '?action=sync');
        if (r.deferred) {
          toast('لا اتصال — تُرسل المزامنة تلقائياً عند عودة الشبكة');
        } else {
          const j = r.data || {};
          syncInfo = j.last || j;
          if (j.throttled) toast('زُومنت قبل لحظات — انتظر نصف دقيقة');
          else if (j.busy) toast('مزامنة أخرى تعمل الآن — حاول بعد قليل');
          else toast('تمت المزامنة: كُتب ' + num(j.processed) + ' خبر' + (j.removed ? '، وحُذف ' + j.removed : ''));
          renderSyncInfo();
          await load(true);
          if (newsFor && $('lvDlgNews').open) loadNews(newsFor, true);
        }
      } catch (e) {
        toast('تعذّرت المزامنة: ' + errText(e), true);
      } finally {
        b.disabled = false; b.textContent = 'زامن الآن';
      }
    });

    /* ============================================================
       نافذة الأخبار + الإخفاء
       ============================================================ */
    function openNews(id) {
      newsFor = id;
      news = [];
      $('lvNewsTitle').textContent = 'أخبار: ' + ((data.groups || {})[id] || id);
      $('lvNewsBody').innerHTML = '<p class="hint">جارٍ التحميل…</p>';
      $('lvDlgNews').showModal();
      loadNews(id, false);
    }

    async function loadNews(id, force) {
      // نفس استعلام صفحة التغطية (يستخدم الفهرس المركّب groupId + timestamp)
      const q = query(collection(db, 'live_coverage'), where('groupId', '==', id),
        orderBy('timestamp', 'desc'), limit(MAX_ITEMS));
      try {
        await smartLoad(q, 'live_news_' + id, (snap) => {
          if (newsFor !== id) return;
          news = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          renderNews();
        }, { force: force === true });
      } catch (e) {
        $('lvNewsBody').innerHTML = '';
        const p = document.createElement('p');
        p.className = 'hint warn';
        p.textContent = 'تعذّر التحميل: ' + errText(e);
        $('lvNewsBody').appendChild(p);
      }
    }

    function renderNews() {
      const body = $('lvNewsBody');
      body.innerHTML = '';
      if (!news.length) { body.innerHTML = '<p class="hint">لا توجد أخبار في هذه المجموعة.</p>'; return; }
      const start = num((data.since || {})[newsFor]);

      news.forEach((n) => {
        const hidden = n.hidden === true;
        const old = start && num(n.timestamp) < start;
        const item = document.createElement('div');
        item.className = 'lv-item' + (hidden ? ' is-hidden' : '') + (old ? ' is-old' : '');
        item.innerHTML =
          '<div class="lv-meta"><span class="lv-time"></span>' +
            (n.isUrgent ? '<span class="badge b-closed">عاجل</span>' : '') +
            (hidden ? '<span class="badge b-draft">مخفي</span>' : '') +
            (old ? '<span class="badge b-archived">تغطية سابقة</span>' : '') +
          '</div>' +
          '<div class="lv-title"></div>' +
          '<div class="actions">' +
            '<button class="btn btn-sm' + (hidden ? '' : ' btn-danger') + '" type="button" data-act="hide">' +
              (hidden ? 'إظهار' : 'إخفاء') + '</button>' +
            (n.url ? '<a class="btn btn-sm" target="_blank" rel="noopener">المقالة</a>' : '') +
          '</div>';
        item.querySelector('.lv-time').textContent = fmtDate(num(n.timestamp));
        item.querySelector('.lv-title').textContent = n.title || n.content || '';
        const a = item.querySelector('a');
        if (a) a.href = n.url;
        item.querySelector('[data-act="hide"]').addEventListener('click', () => toggleHidden(n));
        body.appendChild(item);
      });
    }

    async function toggleHidden(n) {
      const v = !(n.hidden === true);
      try {
        const w = commit(updateDoc(doc(db, 'live_coverage', n.id), { hidden: v }));
        n.hidden = v;
        renderNews();
        const r = await w;
        toast(r.queued ? 'حُفظ على الجهاز — يُرسل عند عودة الاتصال'
          : (v ? 'أُخفي الخبر من صفحة التغطية' : 'أُعيد إظهار الخبر'));
      } catch (e) {
        n.hidden = !v;
        renderNews();
        toast('تعذّر الحفظ: ' + errText(e), true);
      }
    }

    $('lvNewsReload').addEventListener('click', () => {
      if (!requireOnline('التحديث من الخادم')) return;
      if (newsFor) loadNews(newsFor, true);
    });

    // إغلاق نوافذ الوحدة
    root.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => b.closest('dialog').close()));

    reload = () => { load(); loadSyncStatus(); };
    load();
    loadSyncStatus();
  }
};
