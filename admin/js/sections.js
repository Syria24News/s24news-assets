/* ============================================================
   S24News — وحدة الأقسام في لوحة التحكم (admin/js/sections.js)
   الإصدار 1.1 — 26 أكتوبر 2026 (اختيار أي متغيّر قالب للأقسام والفروع)

   إضافة قسم رئيسي (وسم نجمة *X) أو فرع (تسمية عادية) وتعديلهما وإيقافهما
   دون GitHub ودون القالب.

   مستند واحد يقرؤه الموقع: site_settings/sections
     tags.<رمز>     = { short, full, color, desc, order, active }   ← أقسام رئيسية (*X)
     branches.<اسم> = { color, parent, order, active }               ← فروع (تسميات عادية)
     updatedAt
   color: لون مخصص بصيغة #RRGGBB، أو اسم متغيّر القالب ('--sy-sport') للإبقاء على لون «تخصيص» بلوغر.

   الأقسام الافتراضية تُقرأ من القاموس في ../config.js (window.S24_TAGS)، واللوحة لا تحفظ
   إلا ما عدّلته أو أضفته؛ «استعادة الافتراضي» تحذف التعديل فيعود القسم كما في config.js.
   الموقع (config.js) يطبّق المستند فوق القاموس من كاش الزائر، ويحدّثه كل 6 ساعات.
   ============================================================ */
import { db, $, esc, clean, fmtDate, toast, errText, smartLoad, commit,
  collection, doc, setDoc, serverTimestamp } from './core.js';

const sectionsRef = () => doc(db, 'site_settings', 'sections');
const CODE_RE = /^\*[A-Za-z]{1,4}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const NAME_MAX = 40, DESC_MAX = 140;

// القاموس الافتراضي من config.js على الموقع نفسه (GitHub Pages) — قراءة النص لا تشغيله
let defaultsPromise = null;
function loadDefaults() {
  if (defaultsPromise) return defaultsPromise;
  defaultsPromise = fetch('../config.js', { cache: 'no-cache' }).then((r) => r.text()).then((t) => {
    const m = t.match(/window\.S24_TAGS\s*=\s*window\.S24_TAGS\s*\|\|\s*(\{[\s\S]*?\n\});/);
    if (!m) throw new Error('لم أجد القاموس في config.js');
    // مصفوفات نصية فقط: [قصير، كامل، لون، وصف]
    const obj = Function('"use strict"; return (' + m[1] + ');')();
    const out = {};
    Object.keys(obj).forEach((k, i) => {
      const a = obj[k] || [];
      out[k] = { short: a[0] || '', full: a[1] || '', color: a[2] || '', desc: a[3] || '', order: (i + 1) * 10 };
    });
    return out;
  }).catch((e) => { defaultsPromise = null; throw e; });
  return defaultsPromise;
}

// درجات ألوان القالب للعرض في اللوحة (اللوحة لا ترى «تخصيص» بلوغر مباشرة):
// 1) liveColors: المزامنة التلقائية — اللوحة المركزية تقرأ ألوان الصفحة الرئيسية كل ساعة
//    وتحفظها في site_settings/theme (themeColorsSync_ في Syria24News-Control-Panel.gs)
// 2) THEME_COLORS: نسخة احتياطية ثابتة (18 أكتوبر 2026) إن لم تتم المزامنة بعد
let liveColors = {}, liveAt = 0;
const THEME_COLORS = {
  '--sy-green': '#77bd1d', '--color-red': '#e71414', '--sy-red': '#e71414',
  '--sy-Econ': '#e01010', '--sy-sport': '#ff8c00', '--sy-ArabNews': '#ebdf09', '--sy-INT': '#0000ff',
  '--sy-purple': '#d53ef7', '--sy-light-green': '#0bfa02', '--sy-dark-green': '#1b6950',
  '--sy-health-light': '#34eb7d', '--sy-tech': '#c2fff6', '--sy-docs': '#2c3e50', '--sy-gold': '#f1c40f',
  '--sy-docfilms': '#5E35B1', '--sy-syworld': '#8E1B2E',
  '--sy-Arena': '#556B2F', '--sy-syria': '#C0392B', '--sy-black': '#000000', '--sy-Reports': '#800080',
  '--sy-Miscellaneous': '#ff9800', '--sy-weather': '#3498db', '--sy-education': '#7986cb',
  '--sy-health': '#2ecc71', '--sy-social': '#caa6c6', '--sy-culture': '#8d6e63', '--sy-history': '#8e5431',
  '--sy-spo-sco': '#a3e08e', '--sy-orange': '#e67e22',
  // فروع الاقتصاد (26 أكتوبر 2026) — متغيرات cat.econXxx في «تخصيص» بلوغر
  '--sy-econ-syria': '#00838F', '--sy-econ-markets': '#1E8449', '--sy-econ-fx': '#16A085',
  '--sy-econ-metals': '#D4AF37', '--sy-econ-crypto': '#5B2C6F', '--sy-econ-world': '#1A5276',
  '--sy-econ-energy': '#D35400', '--sy-econ-analysis': '#800020', '--sy-econ-opinion': '#5D6D7E'
};
const varName = (color) => (String(color || '').match(/--[\w-]+/) || [''])[0];
// لون قابل للعرض في اللوحة: hex كما هو، أو درجة متغيّر القالب، أو اللون الاحتياطي داخل '--x, #hex'
function swatchOf(color) {
  const c = String(color || '');
  if (HEX_RE.test(c)) return c;
  const v = varName(c);
  if (v && liveColors[v]) return liveColors[v];
  if (v && THEME_COLORS[v]) return THEME_COLORS[v];
  const m = c.match(/#[0-9a-fA-F]{6}/);
  return m ? m[0] : '';
}

const MARKUP = `
  <section id="scView">
    <style>
      #scView .sc-list{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
      #scView .sc-item{display:flex;align-items:center;gap:12px;padding:12px 14px}
      #scView .sc-sw{width:28px;height:28px;border-radius:7px;flex:none;border:1px solid rgba(127,127,127,.3);
        background:repeating-linear-gradient(45deg,rgba(127,127,127,.25) 0 4px,transparent 4px 8px)}
      #scView .sc-main{flex:1;min-width:0}
      #scView .sc-name{font-weight:700;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
      #scView .sc-sub{color:var(--muted);font-size:13px;margin-top:2px;overflow-wrap:anywhere}
      #scView .sc-code{direction:ltr;unicode-bidi:isolate;font-family:monospace;font-size:13px;color:var(--muted)}
      #scView .sc-acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      #scView .sc-off{opacity:.55}
      #scView .b-new{background:rgba(119,189,29,.15);color:#4a7c12}
      #scView .b-edit{background:rgba(52,152,219,.15);color:#2471a3}
      #scView .b-def{background:rgba(127,127,127,.15);color:var(--muted)}
      #scView .b-off{background:rgba(231,20,20,.12);color:#c0392b}
      #scView h3{margin:6px 0 10px;font-size:17px}
      #scView .sc-color{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      #scView .sc-color input[type=color]{width:56px;height:40px;padding:2px;border-radius:8px;border:1px solid var(--border);background:none}
      #scView .sc-two{display:flex;gap:10px;flex-wrap:wrap}
      #scView .sc-two .field{flex:1 1 200px;min-width:0}
      @media (max-width:640px){#scView .sc-item{flex-wrap:wrap}#scView .sc-acts{width:100%;justify-content:flex-start}}
    </style>

    <div class="kpis" id="scKpis"></div>

    <div class="card toolbar">
      <button class="btn btn-primary" id="scAddTag" type="button">+ قسم رئيسي</button>
      <button class="btn btn-primary" id="scAddBr" type="button">+ فرع</button>
      <span class="spacer"></span>
      <button class="btn" id="scReload" type="button">تحديث</button>
    </div>

    <div class="card" style="padding:12px 14px;margin-bottom:14px">
      <div class="hint">
        <b>قسم رئيسي:</b> وسم يبدأ بنجمة مثل <code>*S</code> — له اسم قصير (الشارة) واسم كامل (رأس صفحة القسم) ووصف.<br>
        <b>فرع:</b> تسمية عادية مثل «طاقة وموارد» — تأخذ لوناً، وتغلب شارتها شارة قسمها الأم.<br>
        التغيير يصل إلى الزوار خلال 6 ساعات كحد أقصى (وفوراً عندك بعد مسح بيانات الموقع).
        رابط القسم في القائمة العلوية يُضاف من «التنسيق» في بلوغر.
      </div>
    </div>

    <h3>الأقسام الرئيسية</h3>
    <div class="sc-list" id="scTags"></div>

    <h3>الفروع المضافة من اللوحة</h3>
    <div class="sc-list" id="scBranches"></div>
    <div class="hint" style="margin-bottom:12px">الفروع المكتوبة في الكود (مثل فروع الاقتصاد «عملات وصرف» و«طاقة وموارد») تعمل كما هي ولا تظهر هنا. إن أضفت فرعاً بالاسم نفسه هنا، يغلب إعداد اللوحة.</div>
    <div class="hint" id="scInfo"></div>
  </section>

  <dialog id="scDlg">
    <form method="dialog" novalidate>
      <div class="dlg-head">
        <h2 id="scDlgTitle">قسم</h2>
        <button class="btn btn-sm" value="cancel" type="submit" formnovalidate>إغلاق</button>
      </div>
      <div class="dlg-body">
        <div style="display:flex;flex-direction:column;gap:14px">
          <div id="scTagFields" style="display:flex;flex-direction:column;gap:14px">
            <label class="field"><span>الرمز (يبدأ بنجمة ثم 1–4 أحرف لاتينية، مثل <code>*N</code>)</span>
              <input class="input" id="scCode" dir="ltr" maxlength="5" placeholder="*N">
            </label>
            <div class="sc-two">
              <label class="field"><span>الاسم القصير (الشارة)</span>
                <input class="input" id="scShort" maxlength="${NAME_MAX}" placeholder="بيئة">
              </label>
              <label class="field"><span>الاسم الكامل (رأس صفحة القسم)</span>
                <input class="input" id="scFull" maxlength="${NAME_MAX}" placeholder="البيئة والمناخ">
              </label>
            </div>
            <label class="field"><span>الوصف (تحت رأس صفحة القسم)</span>
              <input class="input" id="scDesc" maxlength="${DESC_MAX}" placeholder="أخبار البيئة والمناخ والطاقة النظيفة">
            </label>
          </div>
          <div id="scBrFields" style="display:flex;flex-direction:column;gap:14px">
            <label class="field"><span>اسم التسمية كما تكتبها في بلوغر</span>
              <input class="input" id="scBrName" maxlength="${NAME_MAX}" placeholder="سيارات">
            </label>
            <label class="field"><span>القسم الأم</span>
              <select class="input" id="scParent"></select>
            </label>
          </div>
          <div class="field">
            <span>اللون</span>
            <div class="sc-color">
              <input type="color" id="scColor" value="#77bd1d">
              <label id="scThemeWrap" style="display:flex;gap:6px;align-items:center">
                <input type="checkbox" id="scUseTheme"> <span>متغيّر القالب</span>
                <select class="input" id="scVar" style="width:auto"></select>
                <span>(يُغيَّر من «تخصيص» بلوغر)</span>
              </label>
              <button class="btn btn-sm" id="scInherit" type="button">لون القسم الأم</button>
            </div>
          </div>
          <label class="field"><span>الترتيب (الأصغر يظهر أولاً، ويغلب عند تعدد الوسوم على مقالة واحدة)</span>
            <input class="input" id="scOrder" type="number" min="0" max="999" step="1">
          </label>
          <label style="display:flex;gap:8px;align-items:center">
            <input type="checkbox" id="scActive" checked> <span>مفعّل</span>
          </label>
        </div>
      </div>
      <div class="dlg-foot">
        <button class="btn btn-primary" id="scSave" type="button">حفظ</button>
        <button class="btn" value="cancel" type="submit" formnovalidate>إلغاء</button>
        <span class="msg" id="scMsg"></span>
      </div>
    </form>
  </dialog>
`;

let mounted = false, reload = () => {};

export default {
  id: 'sections',
  title: 'الأقسام',
  // أيقونة الشريط السفلي (وسم)
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',

  mount(root) {
    if (mounted) return reload();
    mounted = true;
    root.innerHTML = MARKUP;

    let data = { tags: {}, branches: {} };   // ما في الخادم (التعديلات والإضافات فقط)
    let defs = {};                            // القاموس الافتراضي من config.js
    let defsErr = '';
    let edit = null;                          // { kind: 'tag'|'branch', key, isNew }

    /* ============ القراءة ============ */
    async function load(force) {
      try { defs = await loadDefaults(); defsErr = ''; }
      catch (e) { defsErr = errText(e); }
      try {
        await smartLoad(collection(db, 'site_settings'), 'sections', (snap) => {
          const d = snap.docs.find((x) => x.id === 'sections');
          const th = snap.docs.find((x) => x.id === 'theme');
          if (th) { const tv = th.data(); liveColors = tv.colors || {}; liveAt = tv.at && tv.at.toMillis ? tv.at.toMillis() : 0; }
          const v = d ? d.data() : {};
          data = { tags: v.tags || {}, branches: v.branches || {}, updatedAt: v.updatedAt };
          render();
        }, { force: force === true });
      } catch (e) {
        render();
        toast('تعذّر تحميل الأقسام: ' + errText(e), true);
      }
    }

    // القسم كما يراه الموقع: الافتراضي + تعديل اللوحة
    function mergedTags() {
      const out = {};
      Object.keys(defs).forEach((k) => { out[k] = Object.assign({ active: true }, defs[k], { _def: true }); });
      Object.keys(data.tags).forEach((k) => {
        out[k] = Object.assign({ active: true }, out[k] || {}, data.tags[k], { _def: !!defs[k], _ovr: true });
      });
      return out;
    }
    const sortBy = (obj) => Object.keys(obj).sort((a, b) => (Number(obj[a].order) || 0) - (Number(obj[b].order) || 0));

    /* ============ العرض ============ */
    function kpi(label, value) {
      return '<div class="card kpi"><div class="label">' + label + '</div><div class="value">' + esc(String(value)) + '</div></div>';
    }
    function swHTML(color) {
      const s = swatchOf(color);
      return '<span class="sc-sw"' + (s ? ' style="background:' + s + '"' : ' title="لون القالب ' + esc(varName(color)) + '"') + '></span>';
    }
    function render() {
      const tags = mergedTags();
      const br = data.branches;
      const nTags = Object.keys(tags).length, nNew = Object.keys(data.tags).filter((k) => !defs[k]).length;
      $('scKpis').innerHTML =
        kpi('أقسام رئيسية', nTags) + kpi('أُضيفت من اللوحة', nNew) +
        kpi('فروع اللوحة', Object.keys(br).length) +
        kpi('آخر تعديل', data.updatedAt ? fmtDate(data.updatedAt) : '—');

      $('scTags').innerHTML = defsErr && !nTags
        ? '<div class="card empty">تعذّر قراءة الأقسام الافتراضية: ' + esc(defsErr) + '</div>'
        : sortBy(tags).map((k) => {
          const t = tags[k];
          const badge = t.active === false ? '<span class="badge b-off">موقوف</span>'
            : !t._def ? '<span class="badge b-new">جديد</span>'
            : t._ovr ? '<span class="badge b-edit">معدّل</span>' : '<span class="badge b-def">افتراضي</span>';
          return '<div class="card sc-item' + (t.active === false ? ' sc-off' : '') + '">' + swHTML(t.color) +
            '<div class="sc-main"><div class="sc-name">' + esc(t.short || k) + ' <span class="sc-code">' + esc(k) + '</span> ' + badge + '</div>' +
            '<div class="sc-sub">' + esc(t.full || '') + (t.desc ? ' — ' + esc(t.desc) : '') + '</div></div>' +
            '<div class="sc-acts">' +
              '<button class="btn btn-sm" type="button" data-act="edit" data-kind="tag" data-key="' + esc(k) + '">تعديل</button>' +
              '<button class="btn btn-sm" type="button" data-act="toggle" data-kind="tag" data-key="' + esc(k) + '">' + (t.active === false ? 'تشغيل' : 'إيقاف') + '</button>' +
              (t._ovr ? '<button class="btn btn-sm btn-danger" type="button" data-act="reset" data-kind="tag" data-key="' + esc(k) + '">' + (t._def ? 'استعادة الافتراضي' : 'حذف') + '</button>' : '') +
            '</div></div>';
        }).join('');

      const bk = sortBy(br);
      $('scBranches').innerHTML = bk.length ? bk.map((k) => {
        const b = br[k], parent = tags[b.parent];
        return '<div class="card sc-item' + (b.active === false ? ' sc-off' : '') + '">' + swHTML(b.color) +
          '<div class="sc-main"><div class="sc-name">' + esc(k) + (b.active === false ? ' <span class="badge b-off">موقوف</span>' : '') + '</div>' +
          '<div class="sc-sub">' + (b.parent ? 'فرع من: ' + esc(parent ? parent.short : b.parent) : 'بلا قسم أم') + '</div></div>' +
          '<div class="sc-acts">' +
            '<button class="btn btn-sm" type="button" data-act="edit" data-kind="branch" data-key="' + esc(k) + '">تعديل</button>' +
            '<button class="btn btn-sm" type="button" data-act="toggle" data-kind="branch" data-key="' + esc(k) + '">' + (b.active === false ? 'تشغيل' : 'إيقاف') + '</button>' +
            '<button class="btn btn-sm btn-danger" type="button" data-act="reset" data-kind="branch" data-key="' + esc(k) + '">حذف</button>' +
          '</div></div>';
      }).join('') : '<div class="card empty">لا فروع مضافة من اللوحة بعد.</div>';

      $('scInfo').textContent = (defsErr ? 'تنبيه: تعذّر قراءة القاموس الافتراضي (' + defsErr + '). ' : '') +
        (liveAt ? 'ألوان القالب مزامَنة من بلوغر تلقائياً — آخر تغيير رُصد: ' + fmtDate(liveAt) + '.'
          : 'ألوان القالب: لم تتم المزامنة التلقائية بعد، فتُعرض الدرجات المحفوظة في اللوحة.');
    }

    /* ============ الحفظ (المستند كاملاً — مستخدم واحد) ============ */
    async function persist(next, okMsg) {
      const payload = { tags: next.tags, branches: next.branches, updatedAt: serverTimestamp() };
      const r = await commit(setDoc(sectionsRef(), payload));
      data = { tags: next.tags, branches: next.branches, updatedAt: new Date() };
      render();
      toast(r.queued ? 'حُفظ على الجهاز، ويُرسل عند عودة الاتصال' : okMsg);
    }
    const copy = () => ({ tags: Object.assign({}, data.tags), branches: Object.assign({}, data.branches) });

    /* ============ النموذج ============ */
    function fillParents(sel) {
      const tags = mergedTags();
      $('scParent').innerHTML = '<option value="">— بلا قسم أم —</option>' + sortBy(tags).map((k) =>
        '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc((tags[k].short || k) + ' (' + k + ')') + '</option>').join('');
    }
    // fallback: متغيّر القالب الافتراضي للقسم، كي يبقى خيار «لون القالب» متاحاً بعد اختيار لون مخصص
    function setColor(color, fallback) {
      const v = varName(color) || varName(fallback), sw = swatchOf(color) || swatchOf(fallback);
      // كل متغيرات القالب المعروفة متاحة لأي قسم أو فرع (1.1 — 26 أكتوبر 2026)
      const vars = Object.keys(Object.assign({}, THEME_COLORS, liveColors)).filter((k) => /^--sy-|^--color-/.test(k)).sort();
      if (v && vars.indexOf(v) === -1) vars.unshift(v);
      $('scVar').innerHTML = '<option value="">— اختر —</option>' + vars.map((k) =>
        '<option value="' + esc(k) + '"' + (k === v ? ' selected' : '') + '>' + esc(k) + '</option>').join('');
      $('scThemeWrap').hidden = false;
      $('scUseTheme').checked = !!v && !HEX_RE.test(String(color));
      $('scColor').value = sw || '#77bd1d';
      $('scColor').disabled = $('scUseTheme').checked;
    }
    function openForm(kind, key) {
      const tags = mergedTags();
      const isNew = !key;
      edit = { kind, key, isNew };
      $('scTagFields').hidden = kind !== 'tag';
      $('scBrFields').hidden = kind !== 'branch';
      $('scInherit').hidden = kind !== 'branch';
      $('scMsg').textContent = '';
      if (kind === 'tag') {
        const t = isNew ? { order: maxOrder(tags) + 10, active: true } : tags[key];
        $('scDlgTitle').textContent = isNew ? 'قسم رئيسي جديد' : 'تعديل ' + (t.short || key);
        $('scCode').value = isNew ? '*' : key;
        $('scCode').disabled = !isNew;
        $('scShort').value = t.short || '';
        $('scFull').value = t.full || '';
        $('scDesc').value = t.desc || '';
        setColor(isNew ? '' : t.color, defs[key] && defs[key].color);
        $('scOrder').value = t.order != null ? t.order : '';
        $('scActive').checked = t.active !== false;
      } else {
        const b = isNew ? { order: maxOrder(data.branches) + 10, active: true } : data.branches[key];
        $('scDlgTitle').textContent = isNew ? 'فرع جديد' : 'تعديل ' + key;
        $('scBrName').value = isNew ? '' : key;
        $('scBrName').disabled = !isNew;
        fillParents(b.parent || '');
        setColor(isNew ? '' : b.color);
        $('scOrder').value = b.order != null ? b.order : '';
        $('scActive').checked = b.active !== false;
      }
      $('scDlg').showModal();
    }
    function maxOrder(obj) {
      return Object.keys(obj).reduce((m, k) => Math.max(m, Number(obj[k].order) || 0), 0);
    }
    function chosenColor() {
      if ($('scUseTheme').checked && $('scVar').value) return $('scVar').value;
      const c = $('scColor').value;
      return HEX_RE.test(c) ? c.toUpperCase() : '';
    }

    async function save() {
      const msg = $('scMsg');
      const order = Math.max(0, Math.min(999, parseInt($('scOrder').value, 10) || 0));
      const active = $('scActive').checked;
      const color = chosenColor();
      if (!color) { msg.textContent = 'اختر لوناً.'; return; }
      const next = copy();

      if (edit.kind === 'tag') {
        const code = edit.isNew ? $('scCode').value.trim() : edit.key;
        const short = clean($('scShort').value, NAME_MAX);
        const full = clean($('scFull').value, NAME_MAX) || short;
        const desc = clean($('scDesc').value, DESC_MAX);
        if (!CODE_RE.test(code)) { msg.textContent = 'الرمز يبدأ بنجمة ثم 1–4 أحرف لاتينية (مثل *N).'; return; }
        if (edit.isNew && mergedTags()[code]) { msg.textContent = 'هذا الرمز موجود. اختر «تعديل» من القائمة.'; return; }
        if (!short) { msg.textContent = 'اكتب الاسم القصير.'; return; }
        next.tags[code] = { short, full, desc, color, order, active };
      } else {
        const name = edit.isNew ? clean($('scBrName').value, NAME_MAX) : edit.key;
        if (!name) { msg.textContent = 'اكتب اسم التسمية.'; return; }
        if (name.charAt(0) === '*') { msg.textContent = 'الوسم الذي يبدأ بنجمة قسم رئيسي: أضفه من «+ قسم رئيسي».'; return; }
        if (edit.isNew && next.branches[name]) { msg.textContent = 'هذا الفرع موجود.'; return; }
        next.branches[name] = { color, parent: $('scParent').value || '', order, active };
      }

      const btn = $('scSave');
      btn.disabled = true; msg.textContent = 'جارٍ الحفظ…';
      try {
        await persist(next, 'حُفظ. يصل إلى الزوار خلال 6 ساعات كحد أقصى.');
        $('scDlg').close();
      } catch (e) {
        msg.textContent = '';
        toast('تعذّر الحفظ: ' + errText(e), true);
      } finally { btn.disabled = false; }
    }

    async function toggle(kind, key) {
      const next = copy();
      if (kind === 'tag') {
        const cur = mergedTags()[key];
        const base = next.tags[key] || { short: cur.short, full: cur.full, desc: cur.desc, color: cur.color, order: cur.order };
        next.tags[key] = Object.assign({}, base, { active: cur.active === false });
      } else {
        next.branches[key] = Object.assign({}, next.branches[key], { active: next.branches[key].active === false });
      }
      try { await persist(next, 'تم.'); } catch (e) { toast('تعذّر الحفظ: ' + errText(e), true); }
    }

    async function reset(kind, key) {
      const isDef = kind === 'tag' && defs[key];
      if (!confirm(isDef ? 'استعادة «' + key + '» كما في الإعداد الافتراضي؟' : 'حذف «' + key + '» من اللوحة؟')) return;
      const next = copy();
      if (kind === 'tag') delete next.tags[key]; else delete next.branches[key];
      try { await persist(next, isDef ? 'استُعيد الافتراضي.' : 'حُذف.'); } catch (e) { toast('تعذّر الحفظ: ' + errText(e), true); }
    }

    /* ============ الأحداث ============ */
    $('scAddTag').addEventListener('click', () => openForm('tag'));
    $('scAddBr').addEventListener('click', () => openForm('branch'));
    $('scReload').addEventListener('click', () => load(true));
    $('scSave').addEventListener('click', save);
    $('scUseTheme').addEventListener('change', () => { $('scColor').disabled = $('scUseTheme').checked; });
    $('scVar').addEventListener('change', () => {
      const v = $('scVar').value;
      $('scUseTheme').checked = !!v;
      $('scColor').disabled = !!v;
      if (v && swatchOf(v)) $('scColor').value = swatchOf(v);
    });
    $('scInherit').addEventListener('click', () => {
      const p = mergedTags()[$('scParent').value];
      if (!p) { $('scMsg').textContent = 'اختر القسم الأم أولاً.'; return; }
      setColor(p.color);
      $('scMsg').textContent = '';
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const { act, kind, key } = b.dataset;
      if (act === 'edit') openForm(kind, key);
      else if (act === 'toggle') toggle(kind, key);
      else if (act === 'reset') reset(kind, key);
    });

    reload = () => load(false);
    load(false);
  }
};
