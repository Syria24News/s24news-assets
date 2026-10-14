/* ============================================================
   S24News — وحدة التغطية الحية في لوحة التحكم (admin/js/live.js)
   الإصدار 1.3 — 14 أكتوبر 2026 (الربط بشريط العاجل breaking_news — القاعدة: كل خبر أحمر في التغطية يظهر في الشريط
     • الخبر السريع العاجل يُضاف إلى الشريط ساعة (اختيارياً)، وتعديله أو حذفه ينتقل إليه
     • إخفاؤه أو إزالة «عاجل» عنه يُنهيه في الشريط
     • إخفاء مقالة عاجلة (*A) أو إظهارها في التغطية يخفيها أو يعيدها في الشريط)
   الإصدار 1.2 — 14 أكتوبر 2026 (الخبر السريع: خبر من اللوحة مباشرة دون مقالة، مع ربط اختياري بمقالة لاحقاً)
   الإصدار 1.1 — 14 أكتوبر 2026 (أرشيف التغطيات السابقة لصفحة /p/coverages.html)

   ما تديره هذه الوحدة (مستند واحد: coverage_groups/current):
   - groups.grN    اسم التغطية الظاهر في الصفحة وصندوق الرئيسية
   - statuses.grN  active | pinned | inactive | closed
   - since.grN     بداية التغطية الحالية (زر "تغطية جديدة") — الأقدم لا يُعرض
   - archive.<grN_ms>  التغطيات السابقة: { gid, name, from, to, last, hidden }
                       يُضاف تلقائياً عند "تغطية جديدة" إن كان للتغطية السابقة أخبار
   ولا تلمس lastAt (يكتبه Apps Script وحده بعد كل خبر).

   الأخبار (live_coverage): عرض آخر 50 لكل مجموعة + إخفاء/إظهار (حقل hidden فقط).
   الخبر السريع: مستند live_coverage/q_<وقت> بالحقل quick: true، تكتبه اللوحة وحدها
     { postId, title, content:'', timestamp, url, groupId, groupName, isUrgent, hidden, quick, linkedPostId, createdAt }
     - ينشر فوراً ويحدّث lastAt.grN (ليظهر في صندوق الرئيسية) في دفعة كتابة واحدة.
     - الربط بمقالة: url = رابطها؛ وإن كانت المقالة نفسها خبراً في التغطية تُخفى (hidden) حتى لا يتكرر الخبر،
       ويصبح الخبر السريع قابلاً للضغط في وقته الأصلي. فك الربط أو حذف الخبر السريع يعيد إظهارها.
     - Apps Script لا يحذفه في التنظيف (معرّف يبدأ بـ q_).
   زر "زامن الآن": يستدعي تطبيق الويب لمشروع Syria24_Coverage_Migration (?action=sync).

   التوفير: قراءة المجموعات = مستند واحد، والأخبار تُقرأ عند فتح نافذتها فقط،
   وكلاهما عبر smartLoad (النسخة المحفوظة أولاً، والخادم بعد 5 دقائق أو عند "تحديث").
   ============================================================ */
import { db, $, esc, clean, fmtDate, fmtAgo, toast, errText, smartLoad, commit, callDeferred,
  requireOnline, isOnline, collection, doc, updateDoc, deleteDoc, writeBatch, query, where, orderBy, limit,
  serverTimestamp } from './core.js';
import { addBreakingToBatch, quickBreakingId, syncQuickToBreaking, removeQuickFromBreaking,
  endQuickInBreaking, setPostHiddenInBreaking } from './breaking.js';

// ⚠️ رابط تطبيق الويب (/exec) لمشروع Syria24_Coverage_Migration — يُلصق هنا بعد النشر
const SYNC_URL = 'https://script.google.com/macros/s/AKfycbzzQPbraQZh-gIaPYgKKYTOFJ7xHyzut1nP-U9W8jJ2tsc4S7Hah-nIh4lNT8Rf7V3UTA/exec';

const SITE = 'https://www.syria24.news';
const WINDOW_MS = 24 * 60 * 60 * 1000;   // نفس نافذة صندوق الرئيسية
const MAX_ITEMS = 50;                      // نفس حد صفحة التغطية
const QUICK_MAX = 300;                     // أقصى طول لنص الخبر السريع (نفس حد القواعد)
const SITE_RE = /^https?:\/\/(www\.)?syria24\.news(\/[^\s]*)?$/i;   // روابط الموقع فقط

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
      #liveView .lv-arc-h{font-size:17px;margin:22px 0 4px}
      /* دليل الكاتب: إطار بمسافات داخلية مريحة، وفاصل عن شريط الأدوات تحته */
      #liveView .lv-guide{margin-bottom:14px;overflow:hidden}
      #liveView .lv-guide summary{cursor:pointer;font-weight:700;list-style:none;min-height:54px;
        padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px}
      #liveView .lv-guide summary:hover{background:rgba(119,189,29,.06)}
      #liveView .lv-guide summary::-webkit-details-marker{display:none}
      /* سهم الفتح في نهاية السطر: للأسفل مغلقاً، وللأعلى مفتوحاً */
      #liveView .lv-guide summary::after{content:'';flex:none;width:8px;height:8px;margin:0 4px 4px;
        border-left:2px solid currentColor;border-bottom:2px solid currentColor;
        transform:rotate(-45deg);transition:transform .2s}
      #liveView .lv-guide[open] summary::after{transform:rotate(135deg);margin:4px 4px 0}
      #liveView .lv-guide[open] summary{border-bottom:1px solid var(--border,rgba(127,127,127,.25))}
      #liveView .lv-guide ol{margin:0;padding:14px 44px 18px 20px;line-height:2}
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
        <li>للعاجل: أضف التصنيف (Label) <code>*A</code> فقط (لا تكتبه في العنوان). يظهر الخبر أحمر في التغطية وفي شريط العاجل تحت الهيدر معاً.</li>
        <li>انشر. يظهر الخبر خلال 5 دقائق، أو فوراً بزر «زامن الآن».</li>
        <li>لتصحيح خبر: عدّله في بلوغر. لإخفائه من الصفحة دون حذف المقالة: زر «الأخبار» في مجموعته.</li>
        <li>لبدء تغطية جديدة في الخانة نفسها: زر «تغطية جديدة» (الأخبار السابقة تختفي من صفحتها وتبقى محفوظة).</li>
        <li><b>خبر سريع عاجل:</b> يصل إلى شريط العاجل تحت الهيدر لمدة ساعة (يُلغى من نافذته)، ويُدار هناك من قسم «الخبر العاجل».</li>
        <li><b>خبر سريع بلا مقالة:</b> زر «+ خبر سريع» في المجموعة. يظهر فوراً دون مزامنة، ونصه غير قابل للضغط.
          حين تنشر مقالته لاحقاً: «الأخبار» ← «تعديل» على الخبر السريع ← اختر المقالة، فيصبح قابلاً للضغط ولا يتكرر.</li>
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
      <div class="empty" id="lvEmpty" hidden>لا توجد مجموعات بعد.</div>
    </div>

    <h3 class="lv-arc-h">الأرشيف: التغطيات السابقة</h3>
    <p class="hint">تظهر في صفحة <a href="https://www.syria24.news/p/coverages.html" target="_blank" rel="noopener">التغطيات</a>. تُضاف تلقائياً عند الضغط على «تغطية جديدة»، والمجموعات المنتهية تظهر هناك أيضاً ما دام فيها أخبار.</p>
    <div class="card table-wrap">
      <table class="cards-sm">
        <thead>
          <tr>
            <th>التغطية</th>
            <th>الفترة</th>
            <th>في صفحة التغطيات</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody id="lvArcBody"></tbody>
      </table>
      <div class="empty" id="lvArcEmpty" hidden>لا توجد تغطيات مؤرشفة بعد.</div>
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
  </dialog>

  <dialog id="lvDlgQuick">
    <form method="dialog" novalidate>
      <div class="dlg-head">
        <h2 id="lvQTitle">خبر سريع</h2>
        <button class="btn btn-sm" value="cancel" type="submit" formnovalidate>إغلاق</button>
      </div>
      <div class="dlg-body">
        <div class="stack" style="display:flex;flex-direction:column;gap:14px">
          <label class="field"><span id="lvQGroup">نص الخبر</span>
            <textarea class="input" id="lvQText" maxlength="${QUICK_MAX}" rows="3"
              placeholder="مثال: انفجار في حي الميدان بدمشق، والتفاصيل تتبع"></textarea>
          </label>
          <div class="hint"><span id="lvQCount">0</span> / ${QUICK_MAX} — يظهر النص كما هو في الخط الزمني.</div>
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer">
            <input type="checkbox" id="lvQUrgent"> <b>عاجل</b> <span class="hint">(إطار ولون أحمر)</span>
          </label>
          <label id="lvQBarWrap" style="display:flex;gap:8px;align-items:center;cursor:pointer" hidden>
            <input type="checkbox" id="lvQBar" checked> يظهر أيضاً في شريط العاجل تحت الهيدر لمدة ساعة
          </label>
          <label class="field"><span>ربط بمقالة من التغطية (اختياري)</span>
            <select class="input" id="lvQPick"></select>
          </label>
          <label class="field"><span>أو الصق رابط مقالة من الموقع (اختياري)</span>
            <input class="input" id="lvQUrl" type="url" dir="ltr" placeholder="https://www.syria24.news/...">
          </label>
          <div class="hint">بلا ربط: يظهر الخبر نصاً غير قابل للضغط. مع الربط: يصبح قابلاً للضغط ويبقى في وقته الأصلي،
            وإن كانت المقالة المختارة خبراً في التغطية تُخفى تلقائياً حتى لا يتكرر الخبر.</div>
        </div>
      </div>
      <div class="dlg-foot">
        <button class="btn btn-primary" id="lvQSave" type="button">نشر</button>
        <button class="btn" value="cancel" type="submit" formnovalidate>إلغاء</button>
        <span class="msg" id="lvQMsg"></span>
      </div>
    </form>
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
      renderArchive();
    }

    /* ============================================================
       الأرشيف: التغطيات السابقة
       ============================================================ */
    function renderArchive() {
      const arc = data.archive || {};
      const keys = Object.keys(arc).filter((k) => arc[k] && arc[k].gid)
        .sort((a, b) => num(arc[b].to) - num(arc[a].to));
      const tb = $('lvArcBody');
      tb.innerHTML = '';
      $('lvArcEmpty').hidden = keys.length > 0;
      keys.forEach((k) => {
        const a = arc[k];
        const hidden = a.hidden === true;
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td class="q-cell"><div class="lv-id"></div><input class="input lv-name" maxlength="80" aria-label="اسم التغطية السابقة"></td>' +
          '<td data-label="الفترة" style="white-space:nowrap"></td>' +
          '<td data-label="في الصفحة">' + (hidden ? '<span class="badge b-draft">مخفية</span>' : '<span class="badge b-open">ظاهرة</span>') + '</td>' +
          '<td><div class="actions">' +
            '<button class="btn btn-sm" data-act="view" type="button">عرض</button>' +
            '<button class="btn btn-sm' + (hidden ? '' : ' btn-danger') + '" data-act="hide" type="button">' + (hidden ? 'إظهار' : 'إخفاء') + '</button>' +
          '</div></td>';
        tr.querySelector('.lv-id').textContent = a.gid;
        tr.children[1].textContent = (num(a.from) ? fmtDate(num(a.from)) + ' ← ' : '') + fmtDate(num(a.last) || num(a.to));
        const inp = tr.querySelector('.lv-name');
        inp.value = a.name || '';
        inp.addEventListener('change', () => {
          const v = clean(inp.value, 80);
          if (!v) { inp.value = a.name || ''; return toast('الاسم لا يُترك فارغاً', true); }
          if (v === a.name) return;
          save({ ['archive.' + k + '.name']: v }, 'حُفظ اسم التغطية السابقة');
        });
        tr.querySelector('.actions').addEventListener('click', (e) => {
          const act = e.target && e.target.getAttribute('data-act');
          if (act === 'view') window.open(SITE + '/p/lbs24n.html?arc=' + encodeURIComponent(k), '_blank', 'noopener');
          if (act === 'hide') save({ ['archive.' + k + '.hidden']: !hidden }, hidden ? 'ظهرت في صفحة التغطيات' : 'أُخفيت من صفحة التغطيات');
        });
        tb.appendChild(tr);
      });
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
          '<button class="btn btn-sm btn-primary" data-act="quick" type="button">+ خبر سريع</button>' +
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
        if (act === 'quick') openQuick(id, null);
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
        const parts = k.split('.');
        let o = data;
        parts.slice(0, -1).forEach((p) => {
          o[p] = Object.assign({}, o[p] || {});
          o = o[p];
        });
        o[parts[parts.length - 1]] = fields[k];
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
        '\nالتغطية الحالية تنتقل إلى الأرشيف (صفحة التغطيات) وتبقى أخبارها محفوظة.\n\nعنوان التغطية الجديدة:', cur);
      if (ans == null) return;
      const n = clean(ans, 80);
      if (!n) return toast('العنوان مطلوب', true);
      const now = Date.now();
      const fields = { ['groups.' + id]: n, ['statuses.' + id]: 'active', ['since.' + id]: now };
      // أرشفة التغطية السابقة إن كان فيها أخبار (تظهر في صفحة التغطيات)
      const prevSince = num((data.since || {})[id]);
      const prevLast = num((data.lastAt || {})[id]);
      if (prevLast && prevLast >= prevSince) {
        fields['archive.' + id + '_' + now] = { gid: id, name: cur, from: prevSince, to: now, last: prevLast, hidden: false };
      }
      save(fields, 'بدأت تغطية جديدة: ' + n + (fields['archive.' + id + '_' + now] ? '، وأُرشفت السابقة' : ''));
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
      const merged = linkedIds();   // مقالات مدمجة في أخبار سريعة

      news.forEach((n) => {
        const hidden = n.hidden === true;
        const old = start && num(n.timestamp) < start;
        const quick = n.quick === true;
        const item = document.createElement('div');
        item.className = 'lv-item' + (hidden ? ' is-hidden' : '') + (old ? ' is-old' : '');
        item.innerHTML =
          '<div class="lv-meta"><span class="lv-time"></span>' +
            (quick ? '<span class="badge b-open">خبر سريع' + (n.url ? ' · مرتبط' : '') + '</span>' : '') +
            (n.isUrgent ? '<span class="badge b-closed">عاجل</span>' : '') +
            (hidden ? '<span class="badge b-draft">مخفي</span>' : '') +
            (merged[n.id] ? '<span class="badge b-archived">مدمجة في خبر سريع</span>' : '') +
            (old ? '<span class="badge b-archived">تغطية سابقة</span>' : '') +
          '</div>' +
          '<div class="lv-title"></div>' +
          '<div class="actions">' +
            (quick ? '<button class="btn btn-sm" type="button" data-act="edit">تعديل / ربط</button>' : '') +
            '<button class="btn btn-sm' + (hidden ? '' : ' btn-danger') + '" type="button" data-act="hide">' +
              (hidden ? 'إظهار' : 'إخفاء') + '</button>' +
            (quick ? '<button class="btn btn-sm btn-danger" type="button" data-act="del">حذف</button>' : '') +
            (n.url ? '<a class="btn btn-sm" target="_blank" rel="noopener">المقالة</a>' : '') +
          '</div>';
        item.querySelector('.lv-time').textContent = fmtDate(num(n.timestamp));
        item.querySelector('.lv-title').textContent = n.title || n.content || '';
        const a = item.querySelector('a');
        if (a) a.href = n.url;
        item.querySelector('[data-act="hide"]').addEventListener('click', () => toggleHidden(n));
        if (quick) {
          item.querySelector('[data-act="edit"]').addEventListener('click', () => openQuick(n.groupId || newsFor, n));
          item.querySelector('[data-act="del"]').addEventListener('click', () => deleteQuick(n));
        }
        body.appendChild(item);
      });
    }

    /* ============================================================
       الخبر السريع: إضافة، تعديل، ربط بمقالة، حذف
       ============================================================ */
    // { postId: true } للمقالات المدمجة في أخبار سريعة (من الأخبار المحمّلة)
    function linkedIds() {
      const m = {};
      news.forEach((x) => { if (x.quick === true && x.linkedPostId) m[x.linkedPostId] = true; });
      return m;
    }

    // توحيد رابط الموقع: https://www.syria24.news/... (القواعد لا تقبل غيره)
    function normUrl(v) {
      const s = String(v || '').trim();
      if (!s) return '';
      if (!SITE_RE.test(s)) return null;
      return s.replace(/^https?:\/\/(www\.)?syria24\.news/i, 'https://www.syria24.news');
    }

    let qGroup = null;   // المجموعة في نافذة الخبر السريع
    let qItem = null;    // الخبر قيد التعديل (null = جديد)

    async function openQuick(id, item) {
      qGroup = id; qItem = item;
      // المقالات المرشحة للربط = أخبار هذه المجموعة (من النسخة المحفوظة غالباً، بلا قراءة إضافية)
      if (newsFor !== id || !news.length) {
        newsFor = id;
        try { await loadNews(id, false); } catch (e) { /* القائمة تبقى فارغة */ }
      }
      $('lvQTitle').textContent = item ? 'تعديل خبر سريع' : 'خبر سريع جديد';
      $('lvQGroup').textContent = 'نص الخبر في: ' + ((data.groups || {})[id] || id);
      $('lvQText').value = item ? (item.title || '') : '';
      $('lvQCount').textContent = $('lvQText').value.length;
      $('lvQUrgent').checked = !!(item && item.isUrgent);
      // خيار شريط العاجل للخبر الجديد فقط (تعديل الخبر لاحقاً يحدّث نصه ورابطه في الشريط تلقائياً)
      $('lvQBar').checked = true;
      $('lvQBarWrap').hidden = !!item || !$('lvQUrgent').checked;
      $('lvQSave').textContent = item ? 'حفظ' : 'نشر';
      $('lvQMsg').textContent = '';

      // قائمة المقالات: أخبار بلوغر في التغطية الحالية (الأحدث أولاً)
      const start = num((data.since || {})[id]);
      const merged = linkedIds();
      const sel = $('lvQPick');
      sel.innerHTML = '<option value="">— بلا ربط —</option>';
      news.filter((x) => x.quick !== true && x.url &&
          (num(x.timestamp) >= start || (item && item.linkedPostId === x.id)) &&
          (!merged[x.id] || (item && item.linkedPostId === x.id)))
        .forEach((x) => {
          const o = document.createElement('option');
          o.value = x.id;
          const t = String(x.title || x.content || '');
          o.textContent = fmtDate(num(x.timestamp)) + ' — ' + (t.length > 70 ? t.slice(0, 70) + '…' : t);
          sel.appendChild(o);
        });
      const linkedInList = item && item.linkedPostId && [...sel.options].some((o) => o.value === item.linkedPostId);
      sel.value = linkedInList ? item.linkedPostId : '';
      $('lvQUrl').value = item && item.url && !linkedInList ? item.url : '';

      $('lvDlgQuick').showModal();
      setTimeout(() => $('lvQText').focus(), 50);
    }

    $('lvQText').addEventListener('input', () => { $('lvQCount').textContent = $('lvQText').value.length; });
    $('lvQUrgent').addEventListener('change', () => { $('lvQBarWrap').hidden = !!qItem || !$('lvQUrgent').checked; });
    // اختيار مقالة من القائمة يُفرغ حقل الرابط، والعكس
    $('lvQPick').addEventListener('change', () => { if ($('lvQPick').value) $('lvQUrl').value = ''; });
    $('lvQUrl').addEventListener('input', () => { if ($('lvQUrl').value.trim()) $('lvQPick').value = ''; });

    $('lvQSave').addEventListener('click', async () => {
      const msg = $('lvQMsg');
      const title = clean($('lvQText').value, QUICK_MAX);
      if (!title) { msg.textContent = 'اكتب نص الخبر'; return; }
      const pickId = $('lvQPick').value;
      const picked = pickId ? news.find((x) => x.id === pickId) : null;
      let url = picked ? normUrl(picked.url) : normUrl($('lvQUrl').value);
      if (url === null) { msg.textContent = 'الرابط يجب أن يكون من موقع syria24.news'; return; }
      const linkedPostId = picked ? picked.id : '';
      const isUrgent = $('lvQUrgent').checked;
      const gid = qGroup;
      const now = Date.now();
      const old = qItem;

      const b = writeBatch(db);
      let qid, fields;
      if (!old) {
        qid = 'q_' + now;
        fields = { postId: qid, title, content: '', timestamp: now, url: url || '', groupId: gid,
          groupName: (data.groups || {})[gid] || gid, isUrgent, hidden: false, quick: true,
          linkedPostId, createdAt: now };
        b.set(doc(db, 'live_coverage', qid), fields);
        // العاجل ← شريط العاجل أيضاً (في الدفعة نفسها)
        if (isUrgent && $('lvQBar').checked) {
          addBreakingToBatch(b, { id: quickBreakingId(qid), title, url: url || '', minutes: 60, src: 'live', ref: qid });
        }
        // آخر خبر = الآن ← تظهر التغطية في صندوق الرئيسية وصفحة التغطيات فوراً
        b.update(groupsRef(), { ['lastAt.' + gid]: now, updatedAt: serverTimestamp() });
      } else {
        qid = old.id;
        fields = { title, isUrgent, url: url || '', linkedPostId, updatedAt: now };
        b.update(doc(db, 'live_coverage', qid), fields);
        // المقالة المرتبطة سابقاً تعود للظهور إن تغيّر الربط (وكانت محمّلة = موجودة)
        if (old.linkedPostId && old.linkedPostId !== linkedPostId && news.some((x) => x.id === old.linkedPostId)) {
          b.update(doc(db, 'live_coverage', old.linkedPostId), { hidden: false });
        }
      }
      // المقالة المختارة تُخفى حتى لا يتكرر الخبر في الخط الزمني
      if (picked && picked.hidden !== true) b.update(doc(db, 'live_coverage', picked.id), { hidden: true });

      $('lvQSave').disabled = true;
      try {
        const w = commit(b.commit());
        // تحديث العرض فوراً
        if (!old) {
          news.unshift({ id: qid, ...fields });
          applyLocal({ ['lastAt.' + gid]: now });
          render();
        } else {
          const prev = old.linkedPostId;
          Object.assign(old, fields);
          const back = prev && prev !== linkedPostId && news.find((x) => x.id === prev);
          if (back) back.hidden = false;
        }
        if (picked) picked.hidden = true;
        $('lvDlgQuick').close();
        if ($('lvDlgNews').open) renderNews();
        const r = await w;
        toast(r.queued ? 'حُفظ على الجهاز — يُنشر عند عودة الاتصال'
          : (old ? 'حُفظ الخبر السريع' : 'نُشر الخبر السريع') + (url ? ' (مرتبط بمقالة)' : ''));
        // تعديل النص أو الربط ← تحديثه في شريط العاجل إن كان فيه (قراءة واحدة)
        if (old && isOnline()) {
          syncQuickToBreaking(qid, { title, url: url || '', isUrgent }).catch((e) =>
            toast('حُفظ الخبر، وتعذّر تحديثه في شريط العاجل: ' + errText(e), true));
        }
      } catch (e) {
        toast('تعذّر الحفظ: ' + errText(e), true);
        loadNews(gid, true);
      } finally {
        $('lvQSave').disabled = false;
      }
    });

    async function deleteQuick(n) {
      if (!confirm('حذف هذا الخبر السريع نهائياً من التغطية؟' +
        (n.linkedPostId ? '\nالمقالة المرتبطة به تعود للظهور في التغطية.' : ''))) return;
      if (!requireOnline('الحذف')) return;
      try {
        await deleteDoc(doc(db, 'live_coverage', n.id));
        news = news.filter((x) => x.id !== n.id);
        // حذفه من شريط العاجل أيضاً إن كان فيه
        removeQuickFromBreaking(n.id).catch((e) => toast('تعذّر حذفه من شريط العاجل: ' + errText(e), true));
        const art = n.linkedPostId && news.find((x) => x.id === n.linkedPostId);
        if (art && art.hidden === true) {
          try { await updateDoc(doc(db, 'live_coverage', art.id), { hidden: false }); art.hidden = false; }
          catch (e) { toast('حُذف الخبر، وتعذّر إظهار المقالة: ' + errText(e), true); }
        }
        renderNews();
        toast('حُذف الخبر السريع');
      } catch (e) {
        toast('تعذّر الحذف: ' + errText(e), true);
      }
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
        // الخبر العاجل: ما يُخفى من التغطية يُخفى من شريط العاجل أيضاً
        if (n.isUrgent && isOnline()) {
          const job = n.quick === true
            ? (v ? endQuickInBreaking(n.id) : null)        // الخبر السريع: الإخفاء يُنهيه (الإظهار لا يعيده)
            : setPostHiddenInBreaking(n.id, v);            // مقالة *A: إخفاء أو إعادة في الشريط
          if (job) job.catch((e) => toast('تعذّر تحديث شريط العاجل: ' + errText(e), true));
        }
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
