/* ============================================================
   S24News — وحدة «هام» في لوحة التحكم (admin/js/important.js)
   الإصدار 1.3 — 19 أكتوبر 2026 (الأخبار المنقولة من تبويب العاجل «نقل إلى هام» تظهر هنا بعبارة «منقول من العاجل»؛
     src = 'breaking' وref = معرّف خبر الشريط أو post:<معرّف مقالة *A>، ووقت الخبر = وقته الأصلي في العاجل)
   الإصدار 1.2 — 18 أكتوبر 2026 (قائمة الربط: آخر 20 مقالة من الموقع بأي تصنيف)
   الإصدار 1.1 — 15 أكتوبر 2026 (وقت الخبر يختاره المحرر + النشر المجدول)
   الإصدار 1.0 — 15 أكتوبر 2026
   مبنية على نمط وحدة الخبر العاجل (breaking.js) نفسه، ومستقلة عنها تماماً.

   مستند واحد يقرؤه الموقع: important_news/current
     items.<i_وقت> = { title, url, time, start, end, hidden, src }
        time   «وقت الخبر» الذي يراه القارئ ويُرتَّب به (يختاره المحرر؛ الافتراضي لحظة النشر)
        title  نص الخبر (حتى 300 حرف) كما يظهر في صندوق «هام»
        url    '' = نص غير قابل للضغط، أو رابط مقالة من syria24.news (الربط ممكن لاحقاً)
        start / end  بداية الظهور ونهايته (ms) — وقت خبر في المستقبل = نشر مجدول يبدأ عنده
        hidden احتياطي (الإنهاء يكون بتقديم end إلى الآن)
        src    'panel' من هذه الوحدة، أو 'breaking' من زر «نقل إلى هام» في تبويب العاجل (1.3)
        ref    مع src = 'breaking': معرّف خبر الشريط (b_…) أو post:<معرّف مقالة *A>
     autoMinutes  مدة ظهور مقالات التصنيف *I في الصندوق (افتراضياً 1440 = يوم)
     hiddenPosts  معرّفات مقالات *I المخفاة من الصندوق قبل انتهاء مدتها
     subtitle     عبارة اختيارية بجانب كلمة «هام» في ترويسة الصندوق ('' = «هام» وحدها)

   الموقع (important-news.js 1.0) يعرض: أخبار المستند الجارية + مقالات *I ضمن مدتها،
   الأحدث أولاً، بحد أقصى 5. خبر اللوحة المربوط بمقالة يحجبها فلا يتكرر.
   الصندوق في الصفحة الرئيسية فقط، ويختفي كلياً حين لا يوجد خبر هام.

   التوفير: قراءة المستند = قراءة واحدة عبر smartLoad (المحفوظ أولاً، والخادم بعد دقيقة
   أو عند «تحديث»). مقالات *I تُجلب من خلاصة المدونة (بلا Firestore).
   الأخبار المنتهية منذ أكثر من 7 أيام تُحذف من المستند عند أي حفظ.
   ============================================================ */
import { db, $, esc, clean, fmtDate, fmtAgo, toast, errText, smartLoad, commit, requireOnline,
  collection, doc, setDoc, serverTimestamp } from './core.js';
import { deleteField } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const SITE = 'https://www.syria24.news';
const SITE_RE = /^https?:\/\/(www\.)?syria24\.news(\/[^\s]*)?$/i;   // روابط الموقع فقط
const TEXT_MAX = 300;                         // نفس حد القواعد
const SUB_MAX = 60;                           // أقصى طول للعبارة الفرعية (نفس حد القواعد)
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;      // مدة بقاء المنتهي في القائمة
const MAX_MS = 7 * 24 * 60 * 60 * 1000;       // أقصى مدة ظهور
const DEFAULT_MIN = 1440;                     // المدة الافتراضية: يوم (24 ساعة)
const SHOW_MAX = 5;                           // أقصى عدد يظهر في صندوق الموقع
const LABEL = '*I';
const FEED_MAX = 10;
const PICK_MAX = 20;                          // قائمة الربط: آخر 20 مقالة من الموقع بأي تصنيف                          // مقالات *I المعروضة في اللوحة

// المدد المتاحة بالدقائق (0 = مخصّص)
const DURATIONS = [
  [180, '3 س'], [360, '6 س'], [720, '12 س'], [1440, 'يوم'],
  [2880, 'يومان'], [4320, '3 أيام'], [10080, 'أسبوع'], [0, 'مخصّص']
];
function durLabel(min) {
  const m = Number(min) || 0;
  if (m < 60) return m + ' دقيقة';
  if (m % 1440 === 0) {
    const d = m / 1440;
    return d === 1 ? 'يوم' : d === 2 ? 'يومان' : d === 7 ? 'أسبوع' : d + ' أيام';
  }
  if (m % 60 === 0) return (m / 60 === 1 ? 'ساعة' : (m / 60) + ' ساعات');
  return Math.floor(m / 60) + ' س ' + (m % 60) + ' د';
}

export const importantRef = () => doc(db, 'important_news', 'current');

// توحيد رابط الموقع: https://www.syria24.news/... (القواعد لا تقبل غيره). null = رابط غير مقبول
function normUrl(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (!SITE_RE.test(s)) return null;
  return s.replace(/^https?:\/\/(www\.)?syria24\.news/i, SITE).split('#')[0].replace(/\?m=1$/, '');
}
// مفتاح المقارنة (نفس منطق الموقع)
function urlKey(u) {
  return String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')
    .split('#')[0].split('?')[0].replace(/\/$/, '');
}

// مقالات *I الأخيرة من خلاصة المدونة (JSONP: لا يحتاج إذن CORS)
let feedSeq = 0;
function loadFeed(label, max) {
  return new Promise((resolve, reject) => {
    const cb = '__s24ImFeed' + (++feedSeq);
    const sc = document.createElement('script');
    const t = setTimeout(() => { done(); reject(new Error('انتهت المهلة')); }, 12000);
    function done() { clearTimeout(t); delete window[cb]; sc.remove(); }
    window[cb] = (data) => {
      done();
      resolve(((data.feed && data.feed.entry) || []).map((e) => {
        const alt = (e.link || []).find((l) => l.rel === 'alternate');
        const m = /post-(\d+)/.exec((e.id && e.id.$t) || '');
        return { id: m ? m[1] : '', title: String((e.title && e.title.$t) || '').trim(),
          url: alt ? alt.href : '', time: Date.parse(e.published.$t) };
      }));
    };
    sc.onerror = () => { done(); reject(new Error('تعذّر جلب الخلاصة')); };
    sc.src = SITE + '/feeds/posts/summary' + (label ? '/-/' + encodeURIComponent(label) : '') +
      '?alt=json-in-script&max-results=' + max + '&callback=' + cb + '&cb=' + Date.now();
    document.head.appendChild(sc);
  });
}

// أزرار المدد (مجموعة اختيار واحد)
function durChips(name, def) {
  return '<div class="im-durs" role="radiogroup">' + DURATIONS.map(([m, l]) =>
    '<label class="im-dur"><input type="radio" name="' + name + '" value="' + m + '"' + (m === def ? ' checked' : '') +
    '><span>' + l + '</span></label>').join('') + '</div>';
}
// قيمة datetime-local من وقت (بتوقيت الجهاز)
function toLocalInput(ms) {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

const MARKUP = `
  <section id="imView">
    <style>
      #imView .im-h{font-size:17px;margin:22px 0 4px}
      #imView .im-form{padding:16px;margin-bottom:14px;display:flex;flex-direction:column;gap:12px}
      #imView .im-row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}
      #imView .im-row .field{flex:1 1 240px;min-width:0}
      .im-durs{display:flex;flex-wrap:wrap;gap:6px}
      .im-dur{position:relative;cursor:pointer}
      .im-dur input{position:absolute;opacity:0;pointer-events:none}
      .im-dur span{display:inline-block;padding:6px 12px;border-radius:999px;border:1px solid var(--border,rgba(127,127,127,.35));
        font-size:13px;min-width:44px;text-align:center;user-select:none}
      .im-dur input:checked + span{background:var(--brand,#77bd1d);border-color:var(--brand,#77bd1d);color:var(--brand-ink,#fff);font-weight:600}
      .im-dur input:focus-visible + span{outline:2px solid var(--brand,#77bd1d);outline-offset:2px}
      #imView .im-title{font-weight:600;line-height:1.7;overflow-wrap:anywhere}
      #imView tr.is-off .im-title{opacity:.55}
      #imView tr.is-over .im-title{opacity:.75}
      #imView .im-sub{font-size:12px;opacity:.75;margin-top:2px}
      #imView .im-act{display:flex;flex-wrap:wrap;gap:6px}
      /* دليل الاستخدام: نفس شكل دليل الكاتب في التغطية الحية والعاجل */
      #imView .im-guide{margin-bottom:14px;overflow:hidden}
      #imView .im-guide summary{cursor:pointer;font-weight:700;list-style:none;min-height:54px;
        padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px}
      #imView .im-guide summary:hover{background:rgba(119,189,29,.06)}
      #imView .im-guide summary::-webkit-details-marker{display:none}
      #imView .im-guide summary::after{content:'';flex:none;width:8px;height:8px;margin:0 4px 4px;
        border-left:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-45deg);transition:transform .2s}
      #imView .im-guide[open] summary::after{transform:rotate(135deg);margin:4px 4px 0}
      #imView .im-guide[open] summary{border-bottom:1px solid var(--border,rgba(127,127,127,.25))}
      #imView .im-guide ol{margin:0;padding:14px 44px 18px 20px;line-height:2}
      /* معاينة ترويسة الصندوق كما تظهر في الموقع */
      #imView .im-prev{display:inline-flex;align-items:center;gap:10px;font-weight:700}
      #imView .im-prev b{background:var(--brand,#77bd1d);color:#fff;padding:3px 12px;border-radius:4px}
      #imView .im-prev span{font-weight:500;opacity:.8}
      #imView code{direction:ltr;unicode-bidi:isolate;font-family:ui-monospace,Consolas,monospace;
        background:rgba(119,189,29,.14);padding:1px 6px;border-radius:4px;font-size:.92em}
    </style>

    <div class="kpis" id="imKpis"></div>

    <details class="card im-guide">
      <summary>دليل الاستخدام: هام</summary>
      <ol>
        <li><b>خبر من اللوحة:</b> اكتب النص، اختر المدة (الافتراضية يوم)، ثم «نشر». يظهر في صندوق «هام» في الصفحة الرئيسية: فوراً لمن يفتحها الآن، وخلال 5 دقائق لمن يتصفح الموقع، و10 دقائق لمن ترك الرئيسية مفتوحة. وإن كان في الصندوق خبر آخر يظهر أسرع (دقيقتان إلى 5 دقائق). الإنهاء يختفي خلال دقيقتين إلى 5 دقائق.</li>
        <li>بلا رابط يظهر نصاً غير قابل للضغط. حين تنشر مقالته: «تعديل / ربط» ← اختر المقالة أو الصق رابطها.</li>
        <li><b>مقالة من بلوغر:</b> أضف لها التصنيف (Label) <code>*I</code>، فتظهر في الصندوق مدة «مقالات *I» أدناه من وقت نشرها.</li>
        <li>خبر اللوحة المربوط بمقالة <code>*I</code> يظهر مرة واحدة بنص اللوحة ومدّتها.</li>
        <li>الصندوق يعرض أحدث ${SHOW_MAX} أخبار فقط، ويختفي كلياً حين لا يوجد خبر هام.</li>
        <li><b>وقت الخبر:</b> اختر أي وقت عند النشر أو في «تعديل / ربط». وقت سابق يظهر فوراً به، ووقت لاحق يُجدوَل.</li>
        <li>«إنهاء» يزيل الخبر من الصندوق فوراً (يبقى في القائمة 7 أيام)، و«تمديد» يضيف مدة جديدة.</li>
        <li><b>من العاجل إلى هنا:</b> زر «نقل إلى هام» في تبويب «عاجل» ينقل الخبر بنص تعيد صياغته ووقته الأصلي، ويُنهيه في الشريط. يظهر هنا بعبارة «منقول من العاجل». لا يوجد نقل معاكس: تطوّر جديد لخبر هام يُكتب عاجلاً جديداً.</li>
      </ol>
    </details>

    <div class="card im-form">
      <label class="field"><span>نص الخبر الهام</span>
        <textarea class="input" id="imText" maxlength="${TEXT_MAX}" rows="2"
          placeholder="مثال: الحكومة تعلن رفع الرواتب 50% اعتباراً من الشهر المقبل"></textarea>
      </label>
      <div class="hint"><span id="imCount">0</span> / ${TEXT_MAX}</div>
      <div class="im-row">
        <label class="field"><span>ربط بمقالة من الموقع (اختياري)</span>
          <select class="input" id="imPick"></select>
        </label>
        <label class="field"><span>أو الصق رابطاً من الموقع (اختياري)</span>
          <input class="input" id="imUrl" type="url" dir="ltr" placeholder="https://www.syria24.news/...">
        </label>
      </div>
      <div class="im-row">
        <label class="field"><span>وقت الخبر (اختياري — فارغ = الآن)</span>
          <input class="input" id="imTime" type="datetime-local">
        </label>
        <button class="btn" id="imTimeNow" type="button">الآن</button>
      </div>
      <div class="hint">وقت سابق: يظهر الخبر فوراً بهذا الوقت ومرتَّباً به. وقت لاحق: يُجدوَل ولا يظهر إلا عند حلوله. المدة تُحسب من لحظة ظهوره.</div>
      <div class="field"><span>مدة الظهور</span>${durChips('imDur', DEFAULT_MIN)}</div>
      <label class="field" id="imCustomWrap" hidden><span>ينتهي في (بتوقيت جهازك)</span>
        <input class="input" id="imCustom" type="datetime-local">
      </label>
      <div class="im-row" style="align-items:center">
        <button class="btn btn-primary" id="imPublish" type="button">نشر في «هام»</button>
        <span class="hint" id="imMsg"></span>
      </div>
    </div>

    <div class="card toolbar">
      <span class="hint" id="imInfo"></span>
      <span class="spacer"></span>
      <button class="btn" id="imReload" type="button">تحديث</button>
      <a class="btn" href="${SITE}/" target="_blank" rel="noopener">الموقع</a>
    </div>

    <h3 class="im-h">أخبار اللوحة</h3>
    <div class="card table-wrap">
      <table class="cards-sm">
        <thead><tr><th>الخبر</th><th>الحالة</th><th>المدة</th><th>الرابط</th><th>إجراءات</th></tr></thead>
        <tbody id="imBody"></tbody>
      </table>
      <div class="empty" id="imEmpty" hidden>لا أخبار هامة خلال الأيام السبعة الماضية.</div>
    </div>

    <h3 class="im-h">مقالات <code>*I</code> من بلوغر</h3>
    <div class="card toolbar">
      <label class="field" style="flex-direction:row;align-items:center;gap:8px">
        <span>مدة ظهورها في الصندوق:</span>
        <select class="input" id="imAutoMin"></select>
      </label>
      <span class="spacer"></span>
      <span class="hint">آخر ${FEED_MAX} مقالات بالتصنيف <code>*I</code></span>
    </div>
    <div class="card table-wrap">
      <table class="cards-sm">
        <thead><tr><th>المقالة</th><th>نُشرت</th><th>في الصندوق</th><th>إجراءات</th></tr></thead>
        <tbody id="imFeedBody"></tbody>
      </table>
      <div class="empty" id="imFeedEmpty" hidden>لا مقالات بالتصنيف *I.</div>
    </div>

    <h3 class="im-h">ترويسة الصندوق</h3>
    <div class="card im-form">
      <div class="im-prev" id="imPrev"></div>
      <div class="im-row">
        <label class="field"><span>عبارة بجانب «هام» (اختيارية — اتركها فارغة لتظهر «هام» وحدها)</span>
          <input class="input" id="imSub" maxlength="${SUB_MAX}" placeholder="مثال: لا يفوتك">
        </label>
        <button class="btn" id="imSubSave" type="button">حفظ العبارة</button>
      </div>
    </div>
  </section>

  <dialog id="imDlgEdit">
    <form method="dialog" novalidate>
      <div class="dlg-head">
        <h2>تعديل / ربط</h2>
        <button class="btn btn-sm" value="cancel" type="submit" formnovalidate>إغلاق</button>
      </div>
      <div class="dlg-body">
        <div style="display:flex;flex-direction:column;gap:14px">
          <label class="field"><span>نص الخبر</span>
            <textarea class="input" id="imEText" maxlength="${TEXT_MAX}" rows="3"></textarea>
          </label>
          <div class="hint"><span id="imECount">0</span> / ${TEXT_MAX}</div>
          <label class="field"><span>ربط بمقالة من الموقع</span>
            <select class="input" id="imEPick"></select>
          </label>
          <label class="field"><span>أو الصق رابطاً من الموقع</span>
            <input class="input" id="imEUrl" type="url" dir="ltr" placeholder="https://www.syria24.news/...">
          </label>
          <div class="hint">امسح الحقلين لفك الربط. المدة لا تتغير هنا: استخدم «تمديد» أو «إنهاء».</div>
          <label class="field"><span>وقت الخبر (بتوقيت جهازك)</span>
            <input class="input" id="imETime" type="datetime-local">
          </label>
          <div class="hint" id="imETimeHint"></div>
        </div>
      </div>
      <div class="dlg-foot">
        <button class="btn btn-primary" id="imESave" type="button">حفظ</button>
        <button class="btn" value="cancel" type="submit" formnovalidate>إلغاء</button>
        <span class="msg" id="imEMsg"></span>
      </div>
    </form>
  </dialog>

  <dialog id="imDlgExt">
    <form method="dialog" novalidate>
      <div class="dlg-head">
        <h2>تمديد الظهور</h2>
        <button class="btn btn-sm" value="cancel" type="submit" formnovalidate>إغلاق</button>
      </div>
      <div class="dlg-body">
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="hint" id="imXNow"></div>
          <div class="field"><span>أضف</span>${durChips('imXDur', DEFAULT_MIN)}</div>
          <label class="field" id="imXCustomWrap" hidden><span>ينتهي في (بتوقيت جهازك)</span>
            <input class="input" id="imXCustom" type="datetime-local">
          </label>
        </div>
      </div>
      <div class="dlg-foot">
        <button class="btn btn-primary" id="imXSave" type="button">تمديد</button>
        <button class="btn" value="cancel" type="submit" formnovalidate>إلغاء</button>
        <span class="msg" id="imXMsg"></span>
      </div>
    </form>
  </dialog>`;

let mounted = false;
let reload = () => {};

export default {
  id: 'important',
  title: 'هام',
  // أيقونة الشريط السفلي (علامة تعجّب داخل دائرة)
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6"/><path d="M12 17h.01"/></svg>',

  mount(root) {
    if (mounted) return reload();
    mounted = true;
    root.innerHTML = MARKUP;

    let data = {};       // محتوى important_news/current
    let feed = [];       // مقالات *I
    let feedErr = '';
    let recent = [];     // آخر مقالات الموقع (أي تصنيف) لقائمة الربط
    let loadedAt = 0;
    let editId = null, extId = null;

    const items = () => data.items || {};
    const timeOf = (it) => Number(it.time) || Number(it.start) || 0;   // وقت الخبر الظاهر
    const autoMin = () => Number(data.autoMinutes) || DEFAULT_MIN;
    const hiddenPosts = () => data.hiddenPosts || [];

    /* ============ التحميل ============ */
    async function load(force) {
      try {
        // المجموعة فيها مستند واحد (current) = قراءة واحدة فقط
        await smartLoad(collection(db, 'important_news'), 'important', (snap) => {
          const d = snap.docs.find((x) => x.id === 'current');
          data = d ? d.data() : {};
          loadedAt = Date.now();
          render();
          $('imSub').value = data.subtitle || '';
        }, { force: force === true, maxAge: 60 * 1000 });
      } catch (e) {
        toast('تعذّر تحميل الأخبار الهامة: ' + errText(e), true);
      }
    }
    async function loadAuto() {
      const [a, r] = await Promise.allSettled([loadFeed(LABEL, FEED_MAX), loadFeed('', PICK_MAX)]);
      if (a.status === 'fulfilled') { feed = a.value; feedErr = ''; }
      else feedErr = (a.reason && a.reason.message) || 'تعذّر الجلب';
      if (r.status === 'fulfilled') recent = r.value;
      render();
    }

    /* ============ الحالة كما يراها القارئ ============ */
    function itemState(it, now) {
      if (it.hidden === true) return { on: false, label: 'مخفي', cls: 'b-draft' };
      if (now >= Number(it.end)) return { on: false, label: 'منتهٍ', cls: 'b-archived' };
      if (now < Number(it.start)) return { on: false, label: 'مجدول', cls: 'b-scheduled' };
      return { on: true, label: 'في الصندوق', cls: 'b-open' };
    }
    // مقالات *I المحجوبة بخبر من اللوحة مربوط بها
    function linkedKeys() {
      const m = {};
      Object.values(items()).forEach((it) => { const k = urlKey(it.url); if (k) m[k] = true; });
      return m;
    }
    function postState(p, now) {
      if (hiddenPosts().includes(p.id)) return { on: false, label: 'مخفية', cls: 'b-draft' };
      if (linkedKeys()[urlKey(p.url)]) return { on: false, label: 'عبر خبر اللوحة', cls: 'b-scheduled' };
      const end = p.time + autoMin() * 60000;
      if (now >= end) return { on: false, label: 'انتهت', cls: 'b-archived' };
      return { on: true, label: 'حتى ' + fmtDate(end), cls: 'b-open', end };
    }

    // ما يظهر فعلاً في الموقع: الجاري من المصدرين، الأحدث أولاً، أول 5 فقط
    function visibleKeys(now) {
      const all = [];
      Object.entries(items()).forEach(([id, it]) => {
        if (itemState(it, now).on) all.push({ k: 'i:' + id, t: timeOf(it) });
      });
      feed.forEach((p) => { if (postState(p, now).on) all.push({ k: 'p:' + p.id, t: p.time }); });
      all.sort((a, b) => b.t - a.t);
      const shown = new Set(all.slice(0, SHOW_MAX).map((x) => x.k));
      return { shown, total: all.length };
    }

    function remaining(ms) {
      const m = Math.max(0, Math.round(ms / 60000));
      if (m < 60) return m + ' د';
      const h = Math.floor(m / 60);
      if (h < 48) return h + ' س' + (m % 60 ? ' ' + (m % 60) + ' د' : '');
      return Math.floor(h / 24) + ' يوم ' + (h % 24 ? (h % 24) + ' س' : '');
    }

    /* ============ العرض ============ */
    function render() {
      const now = Date.now();
      const list = Object.entries(items())
        .map(([id, it]) => ({ id, ...it }))
        .sort((a, b) => timeOf(b) - timeOf(a));
      const activePanel = list.filter((it) => itemState(it, now).on).length;
      const activePosts = feed.filter((p) => postState(p, now).on).length;
      const vis = visibleKeys(now);

      $('imKpis').innerHTML =
        kpi('في الصندوق الآن', Math.min(vis.total, SHOW_MAX) + (vis.total > SHOW_MAX ? ' من ' + vis.total : '')) +
        kpi('من اللوحة', activePanel) +
        kpi('مقالات *I', activePosts) +
        kpi('مدة *I', durLabel(autoMin()));

      $('imInfo').textContent = loadedAt ? 'آخر تحديث: ' + fmtAgo(loadedAt) : '';

      // معاينة الترويسة
      $('imPrev').innerHTML = '<b>هام</b>' + (data.subtitle ? '<span>' + esc(data.subtitle) + '</span>' : '');

      // جدول أخبار اللوحة
      const body = $('imBody');
      body.innerHTML = '';
      $('imEmpty').hidden = list.length > 0;
      list.forEach((it) => {
        const st = itemState(it, now);
        const over = st.on && !vis.shown.has('i:' + it.id);   // جارٍ لكنه خارج أحدث 5
        const tr = document.createElement('tr');
        if (!st.on) tr.className = 'is-off';
        else if (over) tr.className = 'is-over';
        const sched = !st.on && it.hidden !== true && now < Number(it.start);
        const timeTxt = sched
          ? 'يبدأ ' + esc(fmtDate(Number(it.start))) + '<div class="im-sub">إلى ' + esc(fmtDate(Number(it.end))) + '</div>'
          : st.on
          ? 'متبقٍ ' + remaining(Number(it.end) - now) + '<div class="im-sub">حتى ' + esc(fmtDate(Number(it.end))) + '</div>'
          : esc(fmtDate(Number(it.start))) + '<div class="im-sub">إلى ' + esc(fmtDate(Number(it.end))) + '</div>';
        tr.innerHTML =
          '<td data-label="الخبر"><div class="im-title">' + esc(it.title) + '</div>' +
            '<div class="im-sub">وقت الخبر: ' + esc(fmtDate(timeOf(it))) + '</div>' +
            (it.src === 'breaking' ? '<div class="im-sub">منقول من العاجل</div>' : '') +
            (over ? '<div class="im-sub">لا يظهر الآن: الصندوق يعرض أحدث ' + SHOW_MAX + ' فقط</div>' : '') + '</td>' +
          '<td data-label="الحالة"><span class="badge ' + st.cls + '">' + st.label + '</span></td>' +
          '<td data-label="المدة">' + timeTxt + '</td>' +
          '<td data-label="الرابط">' + (it.url
            ? '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">مربوط</a>'
            : '<span class="hint">بلا رابط</span>') + '</td>' +
          '<td data-label="إجراءات"><div class="im-act">' +
            '<button class="btn btn-sm" data-act="edit" type="button">تعديل / ربط</button>' +
            '<button class="btn btn-sm" data-act="ext" type="button">' + (st.on || sched ? 'تمديد' : 'إعادة نشر') + '</button>' +
            (st.on || sched ? '<button class="btn btn-sm btn-danger" data-act="end" type="button">إنهاء</button>' : '') +
            '<button class="btn btn-sm btn-danger" data-act="del" type="button">حذف</button>' +
          '</div></td>';
        tr.addEventListener('click', (e) => {
          const act = e.target && e.target.getAttribute('data-act');
          if (act === 'edit') openEdit(it.id);
          else if (act === 'ext') openExt(it.id);
          else if (act === 'end') endNow(it.id);
          else if (act === 'del') delItem(it.id);
        });
        body.appendChild(tr);
      });

      // مدة *I
      const sel = $('imAutoMin');
      const opts = DURATIONS.filter(([m]) => m > 0).map(([m]) => m);
      if (!opts.includes(autoMin())) opts.push(autoMin());
      sel.innerHTML = opts.sort((a, b) => a - b)
        .map((m) => '<option value="' + m + '"' + (m === autoMin() ? ' selected' : '') + '>' + durLabel(m) + '</option>').join('');

      // جدول مقالات *I
      const fb = $('imFeedBody');
      fb.innerHTML = '';
      $('imFeedEmpty').hidden = feed.length > 0 && !feedErr;
      $('imFeedEmpty').textContent = feedErr ? 'تعذّر جلب المقالات: ' + feedErr : 'لا مقالات بالتصنيف *I.';
      feed.forEach((p) => {
        const st = postState(p, now);
        const hidden = hiddenPosts().includes(p.id);
        const tr = document.createElement('tr');
        if (!st.on) tr.className = 'is-off';
        tr.innerHTML =
          '<td data-label="المقالة"><a class="im-title" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.title) + '</a></td>' +
          '<td data-label="نُشرت">' + esc(fmtDate(p.time)) + '</td>' +
          '<td data-label="في الصندوق"><span class="badge ' + st.cls + '">' + esc(st.label) + '</span></td>' +
          '<td data-label="إجراءات"><div class="im-act">' +
            (p.id ? '<button class="btn btn-sm' + (hidden ? '' : ' btn-danger') + '" data-act="hide" type="button">' +
              (hidden ? 'إظهار في الصندوق' : 'إخفاء من الصندوق') + '</button>' : '') +
          '</div></td>';
        const hb = tr.querySelector('[data-act="hide"]');
        if (hb) hb.addEventListener('click', () => togglePost(p.id));
        fb.appendChild(tr);
      });

      fillPick($('imPick'), '');
    }
    function kpi(label, value) {
      return '<div class="card kpi"><div class="label">' + label + '</div><div class="value">' + esc(String(value)) + '</div></div>';
    }
    // قائمة الربط: آخر 20 مقالة من الموقع بأي تصنيف (احتياطاً: مقالات *I إن تعذّر جلبها)
    function fillPick(sel, currentUrl) {
      const keep = sel.value;
      sel.innerHTML = '<option value="">— بلا ربط —</option>' + (recent.length ? recent : feed).map((p) =>
        '<option value="' + esc(p.url) + '">' + esc(fmtDate(p.time) + ' — ' +
          (p.title.length > 70 ? p.title.slice(0, 70) + '…' : p.title)) + '</option>').join('');
      const want = currentUrl !== undefined && currentUrl !== '' ? currentUrl : keep;
      const match = [...sel.options].find((o) => o.value && urlKey(o.value) === urlKey(want));
      sel.value = match ? match.value : '';
      return !!match;
    }

    /* ============ قراءة المدة المختارة ============ */
    function chosenEnd(name, customId, base) {
      const v = Number((root.querySelector('input[name="' + name + '"]:checked') || {}).value);
      if (v > 0) return base + v * 60000;
      const t = Date.parse($(customId).value);
      return isNaN(t) ? null : t;
    }
    function wireChips(name, wrapId, inputId) {
      root.querySelectorAll('input[name="' + name + '"]').forEach((r) => r.addEventListener('change', () => {
        const custom = r.value === '0' && r.checked;
        $(wrapId).hidden = !custom;
        if (custom && !$(inputId).value) $(inputId).value = toLocalInput(Date.now() + 24 * 3600000);
      }));
    }
    wireChips('imDur', 'imCustomWrap', 'imCustom');
    wireChips('imXDur', 'imXCustomWrap', 'imXCustom');

    // حذف المنتهي منذ أكثر من 7 أيام — يُضاف إلى أي كتابة
    function pruneFields(now) {
      const f = {};
      Object.entries(items()).forEach(([id, it]) => {
        if (Number(it.end) < now - KEEP_MS) f['items.' + id] = deleteField();
      });
      return f;
    }
    function applyPrune(f) {
      Object.keys(f).forEach((k) => { if (data.items) delete data.items[k.slice(6)]; });
    }

    // حفظ حقول محددة في المستند (ينشئه إن لم يوجد)
    async function save(fields, okMsg, undo) {
      const now = Date.now();
      const prune = pruneFields(now);
      try {
        // set مع دمج: يُنشئ المستند في أول كتابة، ويدمج الحقول المتداخلة بعدها دون مسح غيرها
        const p = setDoc(importantRef(), { ...expand({ ...fields, ...prune }), updatedAt: serverTimestamp() }, { merge: true });
        applyPrune(prune);
        render();
        const r = await commit(p);
        toast(r.queued ? 'حُفظ على الجهاز — يُنشر عند عودة الاتصال' : okMsg);
        return true;
      } catch (e) {
        if (undo) undo();
        render();
        toast('تعذّر الحفظ: ' + errText(e), true);
        return false;
      }
    }
    // 'items.i_1.title' → { items: { i_1: { title } } }
    function expand(fields) {
      const o = {};
      Object.entries(fields).forEach(([k, v]) => {
        const parts = k.split('.');
        let cur = o;
        parts.forEach((p, i) => {
          if (i === parts.length - 1) cur[p] = v;
          else cur = cur[p] = cur[p] || {};
        });
      });
      return o;
    }

    /* ============ نشر خبر جديد ============ */
    $('imText').addEventListener('input', () => { $('imCount').textContent = $('imText').value.length; });
    $('imPick').addEventListener('change', () => { if ($('imPick').value) $('imUrl').value = ''; });
    $('imUrl').addEventListener('input', () => { if ($('imUrl').value.trim()) $('imPick').value = ''; });

    $('imPublish').addEventListener('click', async () => {
      const msg = $('imMsg');
      msg.textContent = '';
      const title = clean($('imText').value, TEXT_MAX);
      if (!title) { msg.textContent = 'اكتب نص الخبر'; return; }
      const url = normUrl($('imPick').value || $('imUrl').value);
      if (url === null) { msg.textContent = 'الرابط يجب أن يكون من موقع syria24.news'; return; }
      const now = Date.now();
      // وقت الخبر: فارغ = الآن. لاحق = نشر مجدول يبدأ عنده، والمدة تُحسب منه
      const tIn = $('imTime').value ? Date.parse($('imTime').value) : now;
      if (isNaN(tIn)) { msg.textContent = 'وقت الخبر غير صحيح'; return; }
      const sched = tIn > now + 60000;
      if (sched && tIn > now + MAX_MS) { msg.textContent = 'أقصى جدولة 7 أيام من الآن'; return; }
      const start = sched ? tIn : now;
      const end = chosenEnd('imDur', 'imCustom', start);
      if (!end || end <= start + 60000) { msg.textContent = 'اختر وقت انتهاء بعد بداية الظهور بدقيقة على الأقل'; return; }
      if (end - start > MAX_MS) { msg.textContent = 'أقصى مدة ظهور 7 أيام'; return; }

      const id = 'i_' + now;
      const it = { title, url: url || '', time: tIn, start, end, hidden: false, src: 'panel' };
      // الموقع يجلب حسب النشاط (important-news.js 1.2): خبر آخر ظاهر = وصول أسرع
      const busy = Object.values(items()).some(x => x && !x.hidden && x.title && Number(x.start) <= now && Number(x.end) > now);
      data.items = { ...items(), [id]: it };
      $('imPublish').disabled = true;
      const ok = await save({ ['items.' + id]: it },
        sched ? 'جُدول — يظهر ' + fmtDate(start)
          : busy ? 'نُشر في «هام» — يظهر للقراء خلال دقيقتين إلى 5 دقائق'
          : 'نُشر في «هام» — يظهر فوراً لمن يفتح الرئيسية الآن، وخلال 5 إلى 10 دقائق لمن يتصفح',
        () => { delete data.items[id]; });
      $('imPublish').disabled = false;
      if (ok) {
        $('imText').value = ''; $('imUrl').value = ''; $('imPick').value = ''; $('imTime').value = '';
        $('imCount').textContent = '0';
      }
    });

    $('imTimeNow').addEventListener('click', () => { $('imTime').value = toLocalInput(Date.now()); });

    /* ============ تعديل / ربط ============ */
    $('imEText').addEventListener('input', () => { $('imECount').textContent = $('imEText').value.length; });
    $('imEPick').addEventListener('change', () => { if ($('imEPick').value) $('imEUrl').value = ''; });
    $('imEUrl').addEventListener('input', () => { if ($('imEUrl').value.trim()) $('imEPick').value = ''; });

    function openEdit(id) {
      const it = items()[id];
      if (!it) return;
      editId = id;
      $('imEText').value = it.title || '';
      $('imECount').textContent = $('imEText').value.length;
      const inList = fillPick($('imEPick'), it.url || '');
      $('imEUrl').value = it.url && !inList ? it.url : '';
      $('imETime').value = toLocalInput(timeOf(it));
      $('imETimeHint').textContent = Date.now() < Number(it.start)
        ? 'هذا الخبر مجدول: تغيير وقته إلى وقت لاحق ينقل موعد ظهوره معه (بنفس المدة).'
        : 'يغيّر الوقت الظاهر وترتيب الخبر فقط، لا مدة ظهوره.';
      $('imEMsg').textContent = '';
      $('imDlgEdit').showModal();
    }
    $('imESave').addEventListener('click', async () => {
      const it = items()[editId];
      if (!it) return $('imDlgEdit').close();
      const title = clean($('imEText').value, TEXT_MAX);
      if (!title) { $('imEMsg').textContent = 'اكتب نص الخبر'; return; }
      const url = normUrl($('imEPick').value || $('imEUrl').value);
      if (url === null) { $('imEMsg').textContent = 'الرابط يجب أن يكون من موقع syria24.news'; return; }
      const now = Date.now();
      const t = Date.parse($('imETime').value);
      if (isNaN(t)) { $('imEMsg').textContent = 'وقت الخبر غير صحيح'; return; }
      const prev = { title: it.title, url: it.url, time: it.time, start: it.start, end: it.end };
      const f = { ['items.' + editId + '.title']: title, ['items.' + editId + '.url']: url || '',
        ['items.' + editId + '.time']: t };
      // خبر ظاهر الآن أو منتهٍ لا يأخذ وقتاً لاحقاً (سيرى القارئ وقتاً لم يأتِ بعد)
      if (now >= Number(it.start) && t > now + 60000) {
        $('imEMsg').textContent = 'هذا الخبر ظهر فعلاً، فوقته لا يكون لاحقاً. لجدولته: «إنهاء» ثم انشره من جديد بوقت لاحق.';
        return;
      }
      // خبر مجدول لم يبدأ بعد + وقت جديد لاحق: ينتقل موعد ظهوره معه بنفس المدة
      if (now < Number(it.start) && t > now + 60000) {
        if (t > now + MAX_MS) { $('imEMsg').textContent = 'أقصى جدولة 7 أيام من الآن'; return; }
        const dur = Number(it.end) - Number(it.start);
        f['items.' + editId + '.start'] = t; f['items.' + editId + '.end'] = t + dur;
        it.start = t; it.end = t + dur;
      }
      it.title = title; it.url = url || ''; it.time = t;
      $('imDlgEdit').close();
      await save(f,
        url ? 'حُفظ الخبر (مرتبط بمقالة)' : 'حُفظ الخبر', () => Object.assign(it, prev));
    });

    /* ============ تمديد / إعادة نشر ============ */
    function openExt(id) {
      const it = items()[id];
      if (!it) return;
      extId = id;
      const now = Date.now();
      const on = itemState(it, now).on;
      const sched = !on && it.hidden !== true && now < Number(it.start);
      $('imXNow').textContent = on || sched
        ? 'ينتهي حالياً ' + fmtDate(Number(it.end)) + ' — المدة المختارة تُضاف إلى ذلك.'
        : 'منتهٍ — سيعود إلى الصندوق من الآن للمدة المختارة، بوقت الآن.';
      $('imXMsg').textContent = '';
      $('imDlgExt').showModal();
    }
    $('imXSave').addEventListener('click', async () => {
      const it = items()[extId];
      if (!it) return $('imDlgExt').close();
      const now = Date.now();
      const on = itemState(it, now).on;
      const sched = !on && it.hidden !== true && now < Number(it.start);
      const base = on || sched ? Number(it.end) : now;
      const end = chosenEnd('imXDur', 'imXCustom', base);
      if (!end || end <= now + 60000) { $('imXMsg').textContent = 'اختر وقت انتهاء بعد دقيقة على الأقل من الآن'; return; }
      if (end - Math.max(now, Number(it.start)) > MAX_MS && !(!on && !sched)) { $('imXMsg').textContent = 'أقصى مدة ظهور 7 أيام'; return; }
      if (!on && !sched && end > now + MAX_MS) { $('imXMsg').textContent = 'أقصى مدة 7 أيام من الآن'; return; }
      const prev = { start: it.start, end: it.end, hidden: it.hidden, time: it.time };
      const f = { ['items.' + extId + '.end']: end, ['items.' + extId + '.hidden']: false };
      it.end = end; it.hidden = false;
      // إعادة نشر المنتهي تجعله «جديداً»: يبدأ الآن ووقته الآن فيصعد إلى أعلى الصندوق (والوقت قابل للتعديل بعدها)
      if (!on && !sched) {
        it.start = now; it.time = now;
        f['items.' + extId + '.start'] = now; f['items.' + extId + '.time'] = now;
      }
      $('imDlgExt').close();
      await save(f, 'يظهر حتى ' + fmtDate(end), () => Object.assign(it, prev));
    });

    /* ============ إنهاء / حذف ============ */
    async function endNow(id) {
      const it = items()[id];
      if (!it) return;
      const prev = it.end;
      const now = Date.now();
      it.end = now;
      await save({ ['items.' + id + '.end']: now }, 'أُزيل من الصندوق (يختفي عند القراء خلال دقيقتين إلى 5 دقائق)',
        () => { it.end = prev; });
    }
    async function delItem(id) {
      const it = items()[id];
      if (!it) return;
      if (!confirm('حذف هذا الخبر نهائياً من القائمة؟')) return;
      if (!requireOnline('الحذف')) return;
      const copy = { ...it };
      delete data.items[id];
      await save({ ['items.' + id]: deleteField() }, 'حُذف الخبر', () => { data.items[id] = copy; });
    }

    /* ============ مقالات *I: المدة والإخفاء ============ */
    $('imAutoMin').addEventListener('change', async () => {
      const prev = data.autoMinutes;
      const v = Number($('imAutoMin').value) || DEFAULT_MIN;
      data.autoMinutes = v;
      await save({ autoMinutes: v }, 'مدة مقالات *I: ' + durLabel(v), () => { data.autoMinutes = prev; });
    });
    async function togglePost(pid) {
      const prev = hiddenPosts().slice();
      const hide = !prev.includes(pid);
      // نُبقي المعرّفات الموجودة في الخلاصة الحالية فقط (+ الجديد) كي لا تكبر القائمة
      const inFeed = new Set(feed.map((p) => p.id));
      let next = prev.filter((x) => x !== pid && inFeed.has(x));
      if (hide) next.push(pid);
      data.hiddenPosts = next;
      await save({ hiddenPosts: next }, hide ? 'أُخفيت المقالة من الصندوق' : 'أُعيد إظهار المقالة في الصندوق',
        () => { data.hiddenPosts = prev; });
    }

    /* ============ عبارة الترويسة ============ */
    $('imSub').addEventListener('input', () => {
      const v = $('imSub').value.trim();
      $('imPrev').innerHTML = '<b>هام</b>' + (v ? '<span>' + esc(v) + '</span>' : '');
    });
    $('imSubSave').addEventListener('click', async () => {
      const prev = data.subtitle;
      const v = clean($('imSub').value, SUB_MAX);
      data.subtitle = v;
      await save({ subtitle: v }, v ? 'العبارة: ' + v : 'الترويسة: «هام» وحدها', () => { data.subtitle = prev; });
    });

    $('imReload').addEventListener('click', () => {
      if (!requireOnline('التحديث من الخادم')) return;
      load(true); loadAuto();
    });

    // تحديث العدادات والحالات كل دقيقة ما دامت الوحدة مفتوحة (بلا قراءات)
    setInterval(() => { if (!document.hidden && root.isConnected) render(); }, 60 * 1000);

    reload = () => { load(); loadAuto(); };
    load();
    loadAuto();
  }
};
