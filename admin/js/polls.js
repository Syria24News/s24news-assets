/* ============================================================
   S24News — وحدة الاستطلاعات في لوحة التحكم (admin/js/polls.js)
   الإصدار 2.0 — 10 أكتوبر 2026 (للهاتف أولاً + العمل دون اتصال)
   - تكتب مباشرة إلى polls/{pollId} (الحقول المعدَّلة فقط، لا تلمس العدادات)
   - تستدعي بوابة S24 Polls Gateway (?action=rebuild) لتحديث ما يظهر على الموقع
   - القراءة عبر smartLoad: النسخة المحفوظة فوراً، والخادم فقط عند التقادم أو "تحديث"
   - الكتابة عبر commit: دون اتصال تُحفظ على الجهاز وتُرسل لاحقاً، وطلب rebuild يتأجل تلقائياً
   - التصفير والحذف (يحتاجان سجلات الأصوات من الخادم) لا يعملان إلا مع الاتصال
   ============================================================ */
import { CFG, auth, db, $, esc, clean, toDate, fmtDate, fmtDay, dayKey, partsTZ, toast, errText,
  smartLoad, commit, callDeferred, requireOnline, isOnline,
  collection, getDocs, getDocsFromCache, getDoc, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, limit,
  serverTimestamp, Timestamp } from './core.js';

const GATEWAY = 'https://script.google.com/macros/s/AKfycbx6S27AM5zuftOmha8Zf-QixGfCiUGUbaapLY7qklwXcxDXLInbXDTn4UqdzYs5tT4/exec';
const MAX_OPTIONS = 6;

const MARKUP = `
  <section id="pollsView">
    <div class="kpis" id="kpis"></div>

    <div class="card toolbar">
      <input class="input search" id="fSearch" type="search" placeholder="بحث في الأسئلة والخيارات والمعرّف…">
      <select class="input" id="fStatus" aria-label="تصفية بالحالة">
        <option value="all">كل الحالات</option>
        <option value="live">يظهر الآن على الموقع</option>
        <option value="open">منشور</option>
        <option value="scheduled">مجدول</option>
        <option value="ended">منتهي المدة</option>
        <option value="draft">مسودة</option>
        <option value="closed">مغلق</option>
        <option value="archived">مؤرشف</option>
      </select>
      <select class="input" id="fSort" aria-label="الترتيب">
        <option value="new">الأحدث أولاً</option>
        <option value="old">الأقدم أولاً</option>
        <option value="votes">الأكثر أصواتاً</option>
        <option value="site">ترتيب الموقع</option>
      </select>
      <span class="spacer"></span>
      <button class="btn" id="btnReload" type="button">تحديث</button>
      <button class="btn" id="btnLog" type="button">المرفوضات</button>
      <button class="btn" id="btnCsv" type="button">تصدير CSV</button>
      <button class="btn btn-primary" id="btnNew" type="button">+ استطلاع جديد</button>
    </div>

    <div class="card table-wrap">
      <table class="cards-sm">
        <thead>
          <tr>
            <th>السؤال</th>
            <th>الحالة</th>
            <th>الأصوات</th>
            <th title="رقم أعلى = يظهر أولاً">التثبيت</th>
            <th>تاريخ الإنشاء</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
      <div class="empty" id="emptyMsg" hidden>لا توجد استطلاعات مطابقة.</div>
    </div>
  </section>

<dialog id="pDlgEdit">
  <form method="dialog" id="formEdit" novalidate>
    <div class="dlg-head">
      <h2 id="editTitle">استطلاع جديد</h2>
      <button class="btn btn-sm" value="cancel" type="submit" formnovalidate>إغلاق</button>
    </div>
    <div class="dlg-body">
      <div class="edit-grid">
        <div class="stack">
          <label class="field"><span>السؤال</span>
            <textarea class="input" id="eQ" maxlength="500" required></textarea>
          </label>
          <div class="field">
            <span>الخيارات (من 2 إلى 6)</span>
            <div id="eOpts" class="stack" style="gap:6px"></div>
            <div><button class="btn btn-sm" id="btnAddOpt" type="button">+ خيار</button></div>
            <div class="hint" id="optHint"></div>
          </div>
          <div class="row2">
            <label class="field"><span>الحالة</span>
              <select class="input" id="eStatus">
                <option value="draft">مسودة (لا يظهر)</option>
                <option value="open">منشور</option>
                <option value="closed">مغلق</option>
                <option value="archived">مؤرشف</option>
              </select>
            </label>
            <label class="field"><span>التثبيت (رقم أعلى يظهر أولاً)</span>
              <input class="input" id="eOrder" type="number" step="1" value="0">
            </label>
          </div>
          <div class="row2">
            <label class="field"><span>يبدأ الظهور (اختياري)</span>
              <input class="input" id="eStart" type="datetime-local">
            </label>
            <label class="field"><span>ينتهي (اختياري)</span>
              <input class="input" id="eEnd" type="datetime-local">
            </label>
          </div>
          <label class="field"><span>رابط المقالة المرتبطة (اختياري)</span>
            <input class="input" id="eUrl" type="url" dir="ltr" placeholder="https://www.syria24.news/...">
          </label>
          <div class="hint">التوقيت حسب ساعة جهازك. "منشور" مع تاريخ بدء لاحق = مجدول، ويظهر تلقائياً خلال ساعة من موعده.</div>
        </div>
        <div>
          <div class="hint" style="margin-bottom:6px">معاينة</div>
          <div class="preview" id="preview"></div>
        </div>
      </div>
    </div>
    <div class="dlg-foot">
      <button class="btn btn-primary" id="btnSave" type="button">حفظ</button>
      <button class="btn" value="cancel" type="submit" formnovalidate>إلغاء</button>
      <span class="msg" id="editMsg"></span>
    </div>
  </form>
</dialog>

<!-- نافذة النتائج -->
<dialog id="pDlgResults">
  <div class="dlg-head">
    <h2>النتائج والإحصاء</h2>
    <button class="btn btn-sm" type="button" data-close>إغلاق</button>
  </div>
  <div class="dlg-body" id="resBody"></div>
</dialog>

<!-- نافذة المرفوضات -->
<dialog id="pDlgLog">
  <div class="dlg-head">
    <h2>محاولات التصويت المرفوضة (آخر 100)</h2>
    <button class="btn btn-sm" type="button" data-close>إغلاق</button>
  </div>
  <div class="dlg-body" id="logBody"></div>
</dialog>`;

// معرّف جديد ثابت يُحفظ مرة واحدة: yyyyMMddHHmmss + 5 أرقام عشوائية (نفس صيغة النظام القديم)
function newPollId() {
  const p = partsTZ(new Date());
  return p.year + p.month + p.day + p.hour + p.minute + p.second + String(Math.floor(Math.random() * 90000) + 10000);
}
// datetime-local ⇄ Date (حسب ساعة الجهاز)
function toLocalInput(v) {
  const d = toDate(v); if (!d) return '';
  const z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes());
}
function fromLocalInput(s) { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d; }
function countsOf(p) {
  const c = p.counts || {}, arr = [];
  for (let i = 1; i <= MAX_OPTIONS; i++) arr.push(Math.max(0, Number(c['o' + i]) || 0));
  return arr;
}
function totalOf(p) { return countsOf(p).reduce((a, b) => a + b, 0); }
function optionsOf(p) {
  const arr = [];
  for (let i = 1; i <= MAX_OPTIONS; i++) if (p['opt' + i]) arr.push({ slot: i, text: p['opt' + i] });
  return arr;
}
// الحالة الظاهرة: open + بدء لاحق = مجدول، open + انتهاء ماضٍ = منتهي المدة
function viewStatus(p, now = new Date()) {
  if (p.status === 'open') {
    const s = toDate(p.startAt), e = toDate(p.endAt);
    if (s && s > now) return 'scheduled';
    if (e && e <= now) return 'ended';
    return 'open';
  }
  return p.status || 'draft';
}
const STATUS_LABEL = { open: 'منشور', scheduled: 'مجدول', ended: 'منتهي المدة', draft: 'مسودة', closed: 'مغلق', archived: 'مؤرشف' };
const REASON_LABEL = {
  duplicate: 'تصويت مكرر', closed: 'استطلاع مغلق', not_found: 'استطلاع غير موجود', invalid_option: 'خيار غير صالح',
  recaptcha_missing: 'بلا رمز reCAPTCHA', recaptcha_fail: 'فشل reCAPTCHA', recaptcha_low: 'درجة reCAPTCHA منخفضة',
  recaptcha_action: 'إجراء reCAPTCHA خاطئ', recaptcha_host: 'نطاق غير مطابق'
};

let mounted = false;
let reload = () => {};

// نص رسالة الحفظ بحسب نتيجة إعادة بناء الموقع (رقم / مؤجّل / فشل سبق التنبيه عنه)
function savedMsg(base, n) {
  if (n === null) return;                       // rebuildSite نبّهت بالخطأ بنفسها
  if (n === 'later') return toast(base + ' على الجهاز — يُحدَّث الموقع تلقائياً عند عودة الاتصال');
  toast(base + (typeof n === 'number' ? ' — يظهر الآن على الموقع: ' + n : ''));
}

export default {
  id: 'polls',
  title: 'الاستطلاعات',
  // أيقونة الشريط السفلي (أعمدة نتائج)
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 20V11M12 20V4M19 20v-6"/></svg>',
  // يُبنى المحتوى أول مرة يُفتح فيها التبويب، وبعدها يُعاد التحميل فقط
  mount(root) {
    if (mounted) return reload();
    mounted = true;
    root.innerHTML = MARKUP;

    let polls = [];            // [{ id, ...data }]
    let editing = null;        // { id, orig, opts: [{ text, slot }] } أو { id: null, ... }

    // إعادة بناء ما يظهر على الموقع (المكان الوحيد للبناء هو البوابة)
    // تُرجع عدد الظاهر على الموقع، أو 'later' إن تأجّل الطلب لعدم الاتصال، أو null عند الفشل
    async function rebuildSite() {
      try {
        const r = await callDeferred(GATEWAY + '?action=rebuild');
        if (r.deferred) return 'later';
        return r.data.count;
      } catch (e) {
        toast('حُفظ التغيير، لكن تعذّر تحديث الموقع الآن (سيتحدّث تلقائياً خلال ساعة): ' + errText(e), true);
        return null;
      }
    }

    /* ============================================================
       التحميل والعرض
       ============================================================ */
    // force=true (زر "تحديث") يطلب الخادم دائماً؛ غير ذلك تُعرض النسخة المحفوظة
    // ولا يُقرأ من الخادم إلا إذا مرّ أكثر من 5 دقائق على آخر مزامنة.
    async function loadPolls(force) {
      try {
        await smartLoad(collection(db, 'polls'), 'polls', (snap) => {
          polls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          render();
        }, { force: force === true });
      } catch (e) {
        toast('تعذّر تحميل الاستطلاعات: ' + errText(e), true);
      }
    }

    function render() {
      const now = new Date();
      const today = dayKey(now);

      // المؤشرات
      const live = polls.filter((p) => viewStatus(p, now) === 'open').length;
      const votes = polls.reduce((a, p) => a + totalOf(p), 0);
      const todayVotes = polls.reduce((a, p) => a + (Number((p.daily || {})[today]) || 0), 0);
      $('kpis').innerHTML = [
        ['عدد الاستطلاعات', polls.length],
        ['تظهر الآن على الموقع', live],
        ['إجمالي الأصوات', votes],
        ['أصوات اليوم', todayVotes]
      ].map(([l, v]) => '<div class="card kpi"><div class="label">' + l + '</div><div class="value">' +
        v.toLocaleString('en-US') + '</div></div>').join('');

      // التصفية
      const q = $('fSearch').value.trim().toLowerCase();
      const st = $('fStatus').value;
      let list = polls.filter((p) => {
        const vs = viewStatus(p, now);
        if (st === 'live' && vs !== 'open') return false;
        if (st !== 'all' && st !== 'live' && vs !== st) return false;
        if (!q) return true;
        const hay = [p.q, p.id].concat(optionsOf(p).map((o) => o.text)).join(' ').toLowerCase();
        return hay.includes(q);
      });

      // الترتيب
      const created = (p) => (toDate(p.createdAt) || new Date(0)).getTime();
      const sort = $('fSort').value;
      list.sort((a, b) => {
        if (sort === 'old') return created(a) - created(b);
        if (sort === 'votes') return totalOf(b) - totalOf(a);
        if (sort === 'site') return ((Number(b.order) || 0) - (Number(a.order) || 0)) || (created(b) - created(a));
        return created(b) - created(a);
      });

      // الجدول
      const tb = $('tbody');
      tb.innerHTML = '';
      $('emptyMsg').hidden = list.length > 0;
      list.forEach((p) => tb.appendChild(rowFor(p, now)));
    }

    function rowFor(p, now) {
      const vs = viewStatus(p, now);
      const tr = document.createElement('tr');
      const statusOpts = ['draft', 'open', 'closed', 'archived']
        .map((s) => '<option value="' + s + '"' + (p.status === s ? ' selected' : '') + '>' + STATUS_LABEL[s] + '</option>').join('');
      tr.innerHTML =
        '<td class="q-cell"><div class="q-text"></div><div class="q-id"></div></td>' +
        '<td data-label="الحالة"><div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">' +
          '<span class="badge b-' + vs + '">' + STATUS_LABEL[vs] + '</span>' +
          '<select class="input status-sel btn-sm" aria-label="تغيير الحالة">' + statusOpts + '</select></div></td>' +
        '<td class="num" data-label="الأصوات">' + totalOf(p).toLocaleString('en-US') + '</td>' +
        '<td class="num" data-label="التثبيت"><input class="input order-in" type="number" step="1" aria-label="التثبيت" value="' + (Number(p.order) || 0) + '"></td>' +
        '<td style="white-space:nowrap" data-label="الإنشاء">' + esc(fmtDate(p.createdAt)) + '</td>' +
        '<td><div class="actions">' +
          '<button class="btn btn-sm" data-act="results" type="button">النتائج</button>' +
          '<button class="btn btn-sm" data-act="edit" type="button">تعديل</button>' +
          '<button class="btn btn-sm" data-act="dup" type="button">نسخ</button>' +
          '<button class="btn btn-sm btn-danger" data-act="reset" type="button">تصفير</button>' +
          '<button class="btn btn-sm btn-danger" data-act="del" type="button">حذف</button>' +
        '</div></td>';
      tr.querySelector('.q-text').textContent = p.q || '';
      tr.querySelector('.q-id').textContent = p.id;

      // تعديل مباشر: الحالة
      tr.querySelector('.status-sel').addEventListener('change', (e) => quickUpdate(p, { status: e.target.value }));
      // تعديل مباشر: التثبيت
      tr.querySelector('.order-in').addEventListener('change', (e) => {
        const v = parseInt(e.target.value, 10);
        quickUpdate(p, { order: isNaN(v) ? 0 : v });
      });
      tr.querySelector('.actions').addEventListener('click', (e) => {
        const act = e.target && e.target.getAttribute('data-act');
        if (act === 'results') openResults(p);
        if (act === 'edit') openEditor(p);
        if (act === 'dup') duplicatePoll(p);
        if (act === 'reset') resetVotes(p);
        if (act === 'del') deletePoll(p);
      });
      return tr;
    }

    ['fSearch', 'fStatus', 'fSort'].forEach((id) => $(id).addEventListener('input', render));
    $('btnReload').addEventListener('click', async () => {
      if (!requireOnline('التحديث من الخادم')) return;
      const b = $('btnReload'); b.disabled = true;
      await loadPolls(true);
      b.disabled = false;
      toast('حُدّثت البيانات من الخادم');
    });

    /* ============================================================
       تعديل سريع من الجدول (حقل واحد) — لا يلمس العدادات
       ============================================================ */
    async function quickUpdate(p, fields) {
      try {
        const w = commit(updateDoc(doc(db, 'polls', p.id), { ...fields, updatedAt: serverTimestamp() }));
        Object.assign(p, fields);
        render();
        await w;
        savedMsg('حُفظ', await rebuildSite());
      } catch (e) {
        toast('تعذّر الحفظ: ' + errText(e), true);
        loadPolls();
      }
    }

    /* ============================================================
       نافذة الإنشاء والتعديل
       ============================================================ */
    function openEditor(p) {
      const isNew = !p;
      const total = isNew ? 0 : totalOf(p);
      const counts = isNew ? [0, 0, 0, 0, 0, 0] : countsOf(p);
      editing = {
        id: isNew ? null : p.id,
        orig: p || null,
        hasVotes: total > 0,
        opts: isNew ? [{ text: '', slot: 1 }, { text: '', slot: 2 }] :
          optionsOf(p).map((o) => ({ text: o.text, slot: o.slot, votes: counts[o.slot - 1] }))
      };
      $('editTitle').textContent = isNew ? 'استطلاع جديد' : 'تعديل الاستطلاع';
      $('eQ').value = isNew ? '' : (p.q || '');
      $('eStatus').value = isNew ? 'draft' : (p.status || 'draft');
      $('eOrder').value = isNew ? 0 : (Number(p.order) || 0);
      $('eStart').value = isNew ? '' : toLocalInput(p.startAt);
      $('eEnd').value = isNew ? '' : toLocalInput(p.endAt);
      $('eUrl').value = isNew ? '' : (p.postUrl || '');
      $('editMsg').textContent = '';
      renderOptEditor();
      renderPreview();
      $('pDlgEdit').showModal();
      $('eQ').focus();
    }

    function renderOptEditor() {
      const box = $('eOpts');
      box.innerHTML = '';
      const locked = editing.hasVotes;
      editing.opts.forEach((o, i) => {
        const row = document.createElement('div');
        row.className = 'opt-row';
        const last = i === editing.opts.length - 1;
        // الحذف: بلا أصوات = أي خيار؛ مع أصوات = الأخير فقط وإن لم يكن عليه أصوات
        const canRemove = editing.opts.length > 2 && (!locked || (last && !o.votes));
        row.innerHTML =
          '<span class="n">' + (i + 1) + '</span>' +
          '<input class="input" maxlength="100" placeholder="نص الخيار">' +
          (locked ? '<span class="votes">' + (o.votes || 0) + ' صوت</span>' : '') +
          (!locked ? '<button class="btn btn-sm" type="button" data-m="up" title="أعلى"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
                     '<button class="btn btn-sm" type="button" data-m="down" title="أسفل"' + (last ? ' disabled' : '') + '>▼</button>' : '') +
          '<button class="btn btn-sm btn-danger" type="button" data-m="del" title="حذف"' + (canRemove ? '' : ' disabled') + '>✕</button>';
        const inp = row.querySelector('input');
        inp.value = o.text;
        inp.addEventListener('input', () => { o.text = inp.value; renderPreview(); });
        row.addEventListener('click', (e) => {
          const m = e.target.getAttribute && e.target.getAttribute('data-m');
          if (!m || e.target.disabled) return;
          if (m === 'up' && i > 0) [editing.opts[i - 1], editing.opts[i]] = [editing.opts[i], editing.opts[i - 1]];
          if (m === 'down' && !last) [editing.opts[i + 1], editing.opts[i]] = [editing.opts[i], editing.opts[i + 1]];
          if (m === 'del') editing.opts.splice(i, 1);
          renderOptEditor(); renderPreview();
        });
        box.appendChild(row);
      });
      $('btnAddOpt').disabled = editing.opts.length >= MAX_OPTIONS;
      $('optHint').className = 'hint' + (locked ? ' warn' : '');
      $('optHint').textContent = locked
        ? 'على هذا الاستطلاع أصوات: يمكن تعديل نصوص الخيارات وإضافة خيارات جديدة، ولا يمكن حذف خيار عليه أصوات أو تغيير الترتيب.'
        : 'يمكن الترتيب والحذف بحرية ما دام الاستطلاع بلا أصوات.';
    }

    $('btnAddOpt').addEventListener('click', () => {
      if (editing.opts.length >= MAX_OPTIONS) return;
      editing.opts.push({ text: '', slot: null, votes: 0 });
      renderOptEditor(); renderPreview();
      const inputs = $('eOpts').querySelectorAll('input');
      inputs[inputs.length - 1].focus();
    });

    function renderPreview() {
      const box = $('preview');
      box.innerHTML = '<h3></h3>';
      box.querySelector('h3').textContent = $('eQ').value.trim() || 'نص السؤال';
      editing.opts.forEach((o, i) => {
        const d = document.createElement('div');
        d.className = 'pv-opt';
        d.innerHTML = '<span class="pv-dot"></span><span></span>';
        d.lastChild.textContent = o.text.trim() || ('الخيار ' + (i + 1));
        box.appendChild(d);
      });
    }
    $('eQ').addEventListener('input', renderPreview);

    $('btnSave').addEventListener('click', saveEditor);

    async function saveEditor() {
      const msg = $('editMsg');
      msg.textContent = '';
      const q = clean($('eQ').value, 500);
      const opts = editing.opts.map((o) => ({ ...o, text: clean(o.text, 100) }));
      const startAt = fromLocalInput($('eStart').value);
      const endAt = fromLocalInput($('eEnd').value);
      const status = $('eStatus').value;
      const order = parseInt($('eOrder').value, 10) || 0;
      const postUrl = $('eUrl').value.trim();

      // التحقق
      if (!q) return (msg.textContent = 'اكتب السؤال');
      if (opts.length < 2) return (msg.textContent = 'خياران على الأقل');
      if (opts.some((o) => !o.text)) return (msg.textContent = 'لا يُترك خيار فارغاً — احذفه أو اكتب نصه');
      if (startAt && endAt && endAt <= startAt) return (msg.textContent = 'تاريخ الانتهاء يجب أن يكون بعد البدء');
      if (postUrl && !/^https?:\/\//i.test(postUrl)) return (msg.textContent = 'رابط المقالة يجب أن يبدأ بـ https://');

      const btn = $('btnSave');
      btn.disabled = true;
      try {
        // توزيع الخيارات على الخانات 1–6
        const slots = {};
        if (editing.hasVotes) {
          // مع أصوات: كل خيار قديم يبقى في خانته، والجديد يأخذ الخانة التالية
          let next = Math.max(0, ...opts.filter((o) => o.slot).map((o) => o.slot)) + 1;
          opts.forEach((o) => { slots[o.slot || next++] = o.text; });
        } else {
          // بلا أصوات: ترتيب متصل بحسب الشاشة
          opts.forEach((o, i) => { slots[i + 1] = o.text; });
        }
        const optFields = {};
        for (let i = 1; i <= MAX_OPTIONS; i++) optFields['opt' + i] = slots[i] || '';

        const base = {
          q, ...optFields, status, order, postUrl,
          startAt: startAt ? Timestamp.fromDate(startAt) : null,
          endAt: endAt ? Timestamp.fromDate(endAt) : null,
          updatedAt: serverTimestamp()
        };

        if (!editing.id) {
          // إنشاء: معرّف ثابت يُولَّد مرة واحدة
          const id = newPollId();
          await commit(setDoc(doc(db, 'polls', id), {
            ...base,
            pollId: id,
            counts: { o1: 0, o2: 0, o3: 0, o4: 0, o5: 0, o6: 0 },
            total: 0,
            daily: {},
            resultsVisibility: 'after_vote',
            createdAt: serverTimestamp(),
            createdBy: (auth.currentUser && auth.currentUser.email) || '',
            source: 'dashboard'
          }));
        } else {
          const ref = doc(db, 'polls', editing.id);
          // فُتحت النافذة والاستطلاع بلا أصوات (فسُمح بالترتيب والحذف): نتأكد أنه ما زال بلا أصوات الآن
          // (يتخطى دون اتصال: الفحص يحتاج الخادم)
          if (!editing.hasVotes && isOnline()) {
            const fresh = await getDoc(ref);
            if (fresh.exists() && totalOf(fresh.data()) > 0) {
              msg.textContent = 'وصلت أصوات لهذا الاستطلاع أثناء التعديل — أغلق النافذة وأعد فتحها';
              return;
            }
          }
          // الحقول المعدّلة فقط (لا تُلمس counts وtotal وdaily)
          const o = editing.orig, upd = {};
          Object.keys(base).forEach((k) => {
            if (k === 'updatedAt') return;
            const a = base[k], b = o[k];
            const same = (a && a.toMillis && b && b.toMillis) ? a.toMillis() === b.toMillis()
              : (a == null && (b == null || b === '')) ? true : a === b;
            if (!same) upd[k] = a;
          });
          if (!Object.keys(upd).length) { $('pDlgEdit').close(); toast('لا تغييرات'); btn.disabled = false; return; }
          upd.updatedAt = serverTimestamp();
          await commit(updateDoc(ref, upd));
        }

        $('pDlgEdit').close();
        await loadPolls();
        savedMsg('حُفظ الاستطلاع', await rebuildSite());
      } catch (e) {
        msg.textContent = 'تعذّر الحفظ: ' + errText(e);
      } finally {
        btn.disabled = false;
      }
    }

    $('btnNew').addEventListener('click', () => openEditor(null));

    /* ============================================================
       الإجراءات: نسخ، تصفير، حذف
       ============================================================ */
    async function duplicatePoll(p) {
      if (!confirm('إنشاء نسخة "مسودة" من هذا الاستطلاع بلا أصوات؟')) return;
      try {
        const id = newPollId();
        const optFields = {};
        optionsOf(p).forEach((o, i) => { optFields['opt' + (i + 1)] = o.text; });
        for (let i = 1; i <= MAX_OPTIONS; i++) if (!optFields['opt' + i]) optFields['opt' + i] = '';
        await commit(setDoc(doc(db, 'polls', id), {
          pollId: id, q: p.q || '', ...optFields,
          counts: { o1: 0, o2: 0, o3: 0, o4: 0, o5: 0, o6: 0 }, total: 0, daily: {},
          status: 'draft', order: 0, startAt: null, endAt: null, postUrl: p.postUrl || '',
          resultsVisibility: 'after_vote', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          createdBy: (auth.currentUser && auth.currentUser.email) || '', source: 'dashboard_copy'
        }));
        await loadPolls();
        toast('أُنشئت نسخة مسودة');
      } catch (e) { toast('تعذّر النسخ: ' + errText(e), true); }
    }

    // حذف كل مستندات الأصوات لاستطلاع (دفعات من 450)
    async function deleteVotes(id) {
      const snap = await getDocs(collection(db, 'polls', id, 'votes'));
      const refs = snap.docs.map((d) => d.ref);
      for (let i = 0; i < refs.length; i += 450) {
        const b = writeBatch(db);
        refs.slice(i, i + 450).forEach((r) => b.delete(r));
        await b.commit();
      }
      return refs.length;
    }

    async function resetVotes(p) {
      if (!requireOnline('تصفير الأصوات')) return;
      const total = totalOf(p);
      const ans = prompt('تصفير ' + total + ' صوتاً من:\n«' + (p.q || '') + '»\n\nلا يمكن التراجع. للتأكيد اكتب: تصفير');
      if (ans == null || ans.trim() !== 'تصفير') return;
      try {
        const n = await deleteVotes(p.id);
        await updateDoc(doc(db, 'polls', p.id), {
          counts: { o1: 0, o2: 0, o3: 0, o4: 0, o5: 0, o6: 0 }, total: 0, daily: {}, updatedAt: serverTimestamp()
        });
        await loadPolls();
        await rebuildSite();
        toast('صُفّرت الأصوات (' + n + ' سجل)');
      } catch (e) { toast('تعذّر التصفير: ' + errText(e), true); }
    }

    async function deletePoll(p) {
      if (!requireOnline('حذف الاستطلاع')) return;
      const ans = prompt('حذف الاستطلاع نهائياً مع ' + totalOf(p) + ' صوتاً:\n«' + (p.q || '') + '»\n\nلا يمكن التراجع. للتأكيد اكتب: حذف');
      if (ans == null || ans.trim() !== 'حذف') return;
      try {
        await deleteVotes(p.id);
        await deleteDoc(doc(db, 'polls', p.id));
        await loadPolls();
        await rebuildSite();
        toast('حُذف الاستطلاع');
      } catch (e) { toast('تعذّر الحذف: ' + errText(e), true); }
    }

    /* ============================================================
       النتائج والإحصاء اليومي
       ============================================================ */
    function openResults(p) {
      const counts = countsOf(p);
      const total = totalOf(p);
      const body = $('resBody');
      body.innerHTML = '<h3 id="rQ" style="font-size:17px;margin-bottom:14px"></h3><div id="rItems"></div>' +
        '<div class="hint" id="rTotal"></div><dl class="meta" id="rMeta"></dl>' +
        '<div class="chart-wrap"><h3>الأصوات اليومية (آخر 30 يوماً)</h3><div id="rChart"></div></div>';
      $('rQ').textContent = p.q || '';
      const items = $('rItems');
      optionsOf(p).forEach((o) => {
        const c = counts[o.slot - 1];
        const pct = total ? (c / total * 100) : 0;
        const d = document.createElement('div');
        d.className = 'res-item';
        d.innerHTML = '<div class="res-label"><span></span><b>' + c.toLocaleString('en-US') + ' · ' + pct.toFixed(1) + '%</b></div>' +
          '<div class="bar"><i style="width:' + pct.toFixed(2) + '%"></i></div>';
        d.querySelector('span').textContent = o.text;
        items.appendChild(d);
      });
      $('rTotal').textContent = 'المجموع: ' + total.toLocaleString('en-US') + ' صوت';

      const meta = [
        ['المعرّف', p.id],
        ['الحالة', STATUS_LABEL[viewStatus(p)]],
        ['أُنشئ', fmtDate(p.createdAt)],
        ['آخر تعديل', fmtDate(p.updatedAt)],
        ['يبدأ', fmtDate(p.startAt)],
        ['ينتهي', fmtDate(p.endAt)],
        ['المقالة', p.postUrl || '—']
      ];
      const dl = $('rMeta');
      meta.forEach(([k, v]) => {
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        dl.appendChild(dt); dl.appendChild(dd);
      });
      $('rChart').innerHTML = dailyChart(p.daily || {});
      $('pDlgResults').showModal();
    }

    // رسم أعمدة SVG لآخر 30 يوماً من خريطة daily (بلا مكتبات)
    function dailyChart(daily) {
      const days = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        days.push({ d, v: Number(daily[dayKey(d)]) || 0 });
      }
      const max = Math.max(1, ...days.map((x) => x.v));
      const W = 600, H = 160, pad = 22, bw = (W - pad) / days.length;
      let bars = '', labels = '';
      days.forEach((x, i) => {
        const h = (x.v / max) * (H - pad - 14);
        // RTL: اليوم الأحدث على اليسار؟ نبقي الزمن من اليمين إلى اليسار ليتسق مع القراءة العربية
        const xPos = W - (i + 1) * bw;
        bars += '<rect class="bar-r" x="' + (xPos + 2).toFixed(1) + '" y="' + (H - pad - h).toFixed(1) +
          '" width="' + Math.max(1, bw - 4).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"><title>' +
          fmtDay.format(x.d) + ': ' + x.v + '</title></rect>';
        if (i % 5 === 0 || i === days.length - 1) {
          labels += '<text x="' + (xPos + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + fmtDay.format(x.d) + '</text>';
        }
      });
      return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="الأصوات اليومية">' +
        '<line class="axis" x1="0" x2="' + W + '" y1="' + (H - pad) + '" y2="' + (H - pad) + '"/>' + bars + labels +
        '<text x="4" y="12">' + max + '</text></svg>';
    }

    /* ============================================================
       سجل المرفوضات
       ============================================================ */
    $('btnLog').addEventListener('click', async () => {
      const body = $('logBody');
      body.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
      $('pDlgLog').showModal();
      try {
        const lq = query(collection(db, 'polls_log'), orderBy('createdAt', 'desc'), limit(100));
        const snap = await (isOnline() ? getDocs(lq) : getDocsFromCache(lq));   // دون اتصال: آخر نسخة محفوظة
        if (snap.empty) { body.innerHTML = '<p class="hint">لا توجد محاولات مرفوضة.</p>'; return; }
        const byId = {};
        polls.forEach((p) => { byId[p.id] = p.q; byId[p.pollId] = p.q; });
        const tbl = document.createElement('table');
        tbl.className = 'log-table';
        tbl.innerHTML = '<thead><tr><th>الوقت</th><th>السبب</th><th>الدرجة</th><th>الاستطلاع</th></tr></thead><tbody></tbody>';
        const tb = tbl.querySelector('tbody');
        snap.docs.forEach((d) => {
          const x = d.data();
          const tr = document.createElement('tr');
          tr.innerHTML = '<td style="white-space:nowrap"></td><td></td><td class="num"></td><td></td>';
          tr.children[0].textContent = fmtDate(x.createdAt);
          tr.children[1].textContent = REASON_LABEL[x.reason] || x.reason || '';
          tr.children[2].textContent = (typeof x.score === 'number') ? x.score.toFixed(1) : '—';
          tr.children[3].textContent = byId[x.pollId] || x.pollId || '';
          tb.appendChild(tr);
        });
        body.innerHTML = '';
        const wrap = document.createElement('div'); wrap.className = 'table-wrap'; wrap.appendChild(tbl);
        body.appendChild(wrap);
      } catch (e) {
        body.innerHTML = '';
        const p = document.createElement('p'); p.className = 'hint warn'; p.textContent = 'تعذّر التحميل: ' + errText(e);
        body.appendChild(p);
      }
    });

    /* ============================================================
       تصدير CSV (UTF-8 مع BOM ليفتح العربية في Excel)
       ============================================================ */
    $('btnCsv').addEventListener('click', () => {
      const head = ['pollId', 'السؤال', 'الحالة',
        'الخيار 1', 'الخيار 2', 'الخيار 3', 'الخيار 4', 'الخيار 5', 'الخيار 6',
        'عدد 1', 'عدد 2', 'عدد 3', 'عدد 4', 'عدد 5', 'عدد 6', 'المجموع', 'التثبيت', 'تاريخ الإنشاء', 'المقالة'];
      const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const lines = [head.map(q).join(',')];
      polls.forEach((p) => {
        const c = countsOf(p);
        const row = [p.id, p.q, STATUS_LABEL[viewStatus(p)]];
        for (let i = 1; i <= 6; i++) row.push(p['opt' + i] || '');
        row.push(...c, totalOf(p), Number(p.order) || 0, fmtDate(p.createdAt), p.postUrl || '');
        lines.push(row.map(q).join(','));
      });
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 's24-polls-' + dayKey(new Date()).slice(1) + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });

    // إغلاق نوافذ الوحدة
    root.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => b.closest('dialog').close()));

    reload = loadPolls;
    loadPolls();
  }
};
