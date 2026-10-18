/* ============================================================
   S24News — وحدة البث المباشر في لوحة التحكم (admin/js/stream.js)
   الإصدار 1.0 — 18 أكتوبر 2026

   مستند واحد يقرؤه الموقع: live_stream/current
     mode       'video' فيديو محدد (بث من قنوات أخرى) | 'channel' البث الجاري لقناتي
     videoId    رقم فيديو يوتيوب (11 حرفاً) — يُستخرج تلقائياً من أي رابط يُلصق
     channelId  معرّف القناة (UC + 22 حرفاً) — يُحفظ مرة واحدة
     onAir      على الهواء / متوقف
     title      عنوان اختياري (شاشة القفل في الهاتف)
     poster     صورة غلاف اختيارية (فارغ = الغلاف الحالي في الموقع)
     recent     آخر 8 أرقام مستخدمة [{ id, title, at }]

   الموقع (live-player.js 2.0 عبر S24Feed في utils.js) يغذّي منه صفحة البث
   والمشغّل المصغّر، ويعود إلى LIVE_CONFIG إن فشل الجلب.
   التوفير: قراءة واحدة عبر smartLoad (المحفوظ أولاً، والخادم بعد 5 دقائق أو «تحديث»).
   ============================================================ */
import { db, $, esc, clean, fmtDate, toast, errText, smartLoad, commit,
  collection, doc, setDoc, serverTimestamp } from './core.js';

const SITE = 'https://www.syria24.news';
const LIVE_PAGE = SITE + '/p/live.html';
const RECENT_MAX = 8;
const TITLE_MAX = 120;
const streamRef = () => doc(db, 'live_stream', 'current');

/* ============ استخراج المعرّفات من الروابط ============ */
// يقبل: youtu.be/ID · watch?v=ID · /live/ID · /embed/ID · /shorts/ID · أو الرقم وحده
export function parseVideoId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/live\/|\/embed\/|\/shorts\/)([\w-]{11})(?![\w-])/);
  return m ? m[1] : '';
}
// يقبل: UC... وحده أو youtube.com/channel/UC...
export function parseChannelId(input) {
  const s = String(input || '').trim();
  const m = s.match(/(?:^|\/channel\/)(UC[\w-]{22})(?![\w-])/);
  return m ? m[1] : '';
}
const thumb = (id) => 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
const isHttps = (u) => /^https:\/\/[^\s"'<>]+$/i.test(u);

const MARKUP = `
  <section id="stView">
    <style>
      #stView .st-form{padding:16px;margin-bottom:14px;display:flex;flex-direction:column;gap:14px}
      #stView .st-row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}
      #stView .st-row .field{flex:1 1 240px;min-width:0}
      #stView .st-chips{display:flex;flex-wrap:wrap;gap:6px}
      #stView .st-chip{position:relative;cursor:pointer}
      #stView .st-chip input{position:absolute;opacity:0;pointer-events:none}
      #stView .st-chip span{display:inline-block;padding:7px 14px;border-radius:999px;border:1px solid var(--border,rgba(127,127,127,.35));font-size:14px;user-select:none}
      #stView .st-chip input:checked + span{background:var(--brand,#77bd1d);border-color:var(--brand,#77bd1d);color:var(--brand-ink,#fff);font-weight:600}
      #stView .st-chip input:focus-visible + span{outline:2px solid var(--brand,#77bd1d);outline-offset:2px}
      #stView .st-chip.off input:checked + span{background:#E71414;border-color:#E71414;color:#fff}
      #stView .st-preview{display:flex;gap:12px;align-items:center;min-height:68px}
      #stView .st-preview img{width:120px;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:rgba(127,127,127,.15);flex:none}
      #stView .st-ok{color:var(--brand,#77bd1d);font-weight:600}
      #stView .st-bad{color:#E71414}
      #stView .st-recent{display:flex;flex-direction:column;gap:8px}
      #stView .st-rec{display:flex;gap:10px;align-items:center;padding:8px 12px}
      #stView .st-rec img{width:80px;aspect-ratio:16/9;object-fit:cover;border-radius:6px;flex:none}
      #stView .st-rec .st-meta{flex:1;min-width:0;overflow-wrap:anywhere}
      #stView .st-rec .st-sub{font-size:12px;opacity:.75}
      #stView .st-h{font-size:17px;margin:22px 0 8px}
      #stView .st-guide{margin-bottom:14px;overflow:hidden}
      #stView .st-guide summary{cursor:pointer;font-weight:700;list-style:none;min-height:54px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px}
      #stView .st-guide summary::-webkit-details-marker{display:none}
      #stView .st-guide summary::after{content:'';flex:none;width:8px;height:8px;margin:0 4px 4px;border-left:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-45deg);transition:transform .2s}
      #stView .st-guide[open] summary::after{transform:rotate(135deg);margin:4px 4px 0}
      #stView .st-guide[open] summary{border-bottom:1px solid var(--border,rgba(127,127,127,.25))}
      #stView .st-guide ol{margin:0;padding:14px 44px 18px 20px;line-height:2}
      #stView code{direction:ltr;unicode-bidi:isolate;font-family:ui-monospace,Consolas,monospace;background:rgba(119,189,29,.14);padding:1px 6px;border-radius:4px;font-size:.92em}
    </style>

    <div class="kpis" id="stKpis"></div>

    <details class="card st-guide">
      <summary>دليل الاستخدام: البث المباشر</summary>
      <ol>
        <li><b>بث من قناة أخرى:</b> اختر «فيديو محدد»، والصق رابط البث من يوتيوب كما هو، فيُستخرج الرقم وتظهر صورته للتأكد، ثم «حفظ».</li>
        <li><b>بث من قناتك:</b> اختر «قناتي» وأدخل معرّف القناة مرة واحدة (يبدأ بـ <code>UC</code>). بعدها يعرض الموقع بثّك الجاري تلقائياً دون تغيير أي رقم.</li>
        <li>معرّف القناة تجده في يوتيوب: الإعدادات ← الإعدادات المتقدمة ← «معرّف القناة»، أو في رابط القناة بعد <code>/channel/</code>.</li>
        <li><b>متوقف:</b> يُخفي المشغّل المصغّر في الرئيسية، وتعرض صفحة البث رسالة «البث متوقف حالياً».</li>
        <li>يصل التغيير إلى صفحة البث خلال دقيقة، وإلى الرئيسية خلال 15 دقيقة على الأكثر (كاش الزوار لتوفير الحصة).</li>
        <li>«آخر الأرقام المستخدمة» تعيد بثاً سابقاً بضغطة.</li>
      </ol>
    </details>

    <div class="card st-form">
      <div class="field"><span>الحالة</span>
        <div class="st-chips">
          <label class="st-chip"><input type="radio" name="stAir" value="on"><span>على الهواء</span></label>
          <label class="st-chip off"><input type="radio" name="stAir" value="off"><span>متوقف</span></label>
        </div>
      </div>
      <div class="field"><span>المصدر</span>
        <div class="st-chips">
          <label class="st-chip"><input type="radio" name="stMode" value="video"><span>فيديو محدد</span></label>
          <label class="st-chip"><input type="radio" name="stMode" value="channel"><span>قناتي</span></label>
        </div>
      </div>

      <div id="stVideoBox" class="st-row">
        <label class="field"><span>رابط البث من يوتيوب أو رقمه</span>
          <input class="input" id="stVideo" dir="ltr" placeholder="https://www.youtube.com/watch?v=...">
        </label>
      </div>
      <div id="stChannelBox" class="st-row" hidden>
        <label class="field"><span>معرّف قناتي على يوتيوب</span>
          <input class="input" id="stChannel" dir="ltr" placeholder="UCxxxxxxxxxxxxxxxxxxxxxx">
        </label>
      </div>
      <div class="st-preview" id="stPreview"></div>

      <div class="st-row">
        <label class="field"><span>العنوان (اختياري)</span>
          <input class="input" id="stTitle" maxlength="${TITLE_MAX}" placeholder="مثال: البث المباشر لقناة الإخبارية السورية">
          <!-- ملاحظة: أين يظهر العنوان -->
          <small class="hint">يظهر في شاشة قفل الهاتف أثناء التشغيل، وفي قائمة «آخر الأرقام» هنا. لا يظهر داخل صفحات الموقع.</small>
        </label>
        <label class="field"><span>صورة الغلاف (اختياري)</span>
          <input class="input" id="stPoster" type="url" dir="ltr" placeholder="فارغ = الغلاف الحالي في الموقع">
          <!-- ملاحظة: مواصفات الغلاف وطريقة الحصول على رابطه -->
          <small class="hint">رابط مباشر لصورة (لا رفع ملف). المقاس 1280×720 (16:9)، بصيغة JPG أو WebP، وأقل من 200 كيلوبايت. للحصول على الرابط: ارفع الصورة في مسودة Blogger وانسخ رابطها، ثم استبدل /s320/ بـ /s1280/.</small>
        </label>
      </div>

      <div class="st-row" style="align-items:center">
        <button class="btn btn-primary" id="stSave" type="button">حفظ</button>
        <span class="hint" id="stMsg"></span>
      </div>
    </div>

    <div class="card toolbar">
      <span class="hint" id="stInfo"></span>
      <span class="spacer"></span>
      <button class="btn" id="stReload" type="button">تحديث</button>
      <a class="btn" href="${LIVE_PAGE}" target="_blank" rel="noopener">صفحة البث</a>
    </div>

    <h3 class="st-h">آخر الأرقام المستخدمة</h3>
    <div class="st-recent" id="stRecent"></div>
  </section>
`;

let mounted = false, reload = () => {};

export default {
  id: 'stream',
  title: 'البث',
  // أيقونة الشريط السفلي (شاشة بث)
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="13" rx="2"/><path d="m10 9 5 2.5-5 2.5z"/><path d="M8 21h8"/></svg>',

  mount(root) {
    if (mounted) return reload();
    mounted = true;
    root.innerHTML = MARKUP;

    let data = {};          // محتوى live_stream/current كما في الخادم
    let loadedAt = 0;
    let dirty = false;      // تعديلات في النموذج لم تُحفظ (لا يُستبدل النموذج عند التحديث)

    const radio = (name) => (root.querySelector('input[name="' + name + '"]:checked') || {}).value;
    const setRadio = (name, v) => { const el = root.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (el) el.checked = true; };

    /* ============ التحميل ============ */
    async function load(force) {
      try {
        await smartLoad(collection(db, 'live_stream'), 'stream', (snap) => {
          const d = snap.docs.find((x) => x.id === 'current');
          data = d ? d.data() : {};
          loadedAt = Date.now();
          if (!dirty) fillForm();
          render();
        }, { force: force === true });
      } catch (e) {
        toast('تعذّر تحميل إعدادات البث: ' + errText(e), true);
      }
    }

    /* ============ النموذج ============ */
    function fillForm() {
      setRadio('stAir', data.onAir === false ? 'off' : 'on');
      setRadio('stMode', data.mode === 'channel' ? 'channel' : 'video');
      $('stVideo').value = data.videoId || '';
      $('stChannel').value = data.channelId || '';
      $('stTitle').value = data.title || '';
      $('stPoster').value = data.poster || '';
      syncMode();
    }

    function syncMode() {
      const ch = radio('stMode') === 'channel';
      $('stVideoBox').hidden = ch;
      $('stChannelBox').hidden = !ch;
      preview();
    }

    // معاينة: صورة الفيديو للتأكد قبل الحفظ، أو صحة معرّف القناة
    function preview() {
      const box = $('stPreview');
      if (radio('stMode') === 'channel') {
        const raw = $('stChannel').value.trim();
        const id = parseChannelId(raw);
        box.innerHTML = !raw ? '' : id
          ? '<span class="st-ok">معرّف صحيح:</span> <code>' + esc(id) + '</code>'
          : '<span class="st-bad">المعرّف غير صحيح: يبدأ بـ UC ويتكوّن من 24 حرفاً. رابط القناة بالاسم (@...) لا يصلح.</span>';
        return;
      }
      const raw = $('stVideo').value.trim();
      const id = parseVideoId(raw);
      box.innerHTML = !raw ? '' : id
        ? '<img src="' + thumb(id) + '" alt="" loading="lazy"><div><span class="st-ok">الرقم:</span> <code>' + esc(id) + '</code>' +
          '<div class="hint">تأكد من الصورة أنها البث المطلوب.</div></div>'
        : '<span class="st-bad">لم أجد رقم فيديو في هذا الرابط.</span>';
    }

    /* ============ العرض ============ */
    function kpi(label, value) {
      return '<div class="card kpi"><div class="label">' + label + '</div><div class="value">' + esc(String(value)) + '</div></div>';
    }
    function render() {
      const exists = !!data.mode;
      $('stKpis').innerHTML =
        kpi('الحالة', !exists ? 'لم يُضبط بعد' : (data.onAir === false ? 'متوقف' : 'على الهواء')) +
        kpi('المصدر', !exists ? '—' : (data.mode === 'channel' ? 'قناتي' : 'فيديو محدد')) +
        kpi('آخر تعديل', data.updatedAt ? fmtDate(data.updatedAt) : '—');
      $('stInfo').textContent = !exists
        ? 'لم يُحفظ شيء بعد: الموقع يعمل الآن بالرقم المكتوب في القالب.'
        : 'آخر تحميل: ' + fmtDate(loadedAt);

      const rec = Array.isArray(data.recent) ? data.recent : [];
      $('stRecent').innerHTML = rec.length ? rec.map((r) =>
        '<div class="card st-rec">' +
          '<img src="' + thumb(esc(r.id)) + '" alt="" loading="lazy">' +
          '<div class="st-meta"><div>' + esc(r.title || 'بلا عنوان') + '</div>' +
          '<div class="st-sub"><code>' + esc(r.id) + '</code> · ' + esc(fmtDate(r.at)) +
          (r.id === data.videoId && data.mode !== 'channel' ? ' · <b>الحالي</b>' : '') + '</div></div>' +
          '<button class="btn btn-sm" type="button" data-id="' + esc(r.id) + '" data-title="' + esc(r.title || '') + '">استخدام</button>' +
        '</div>').join('')
        : '<div class="card empty">لا أرقام محفوظة بعد.</div>';
    }

    /* ============ الحفظ ============ */
    async function save() {
      const mode = radio('stMode') === 'channel' ? 'channel' : 'video';
      const onAir = radio('stAir') !== 'off';
      const title = clean($('stTitle').value, TITLE_MAX);
      const poster = $('stPoster').value.trim();
      const videoId = parseVideoId($('stVideo').value) || (mode === 'channel' ? (data.videoId || '') : '');
      const channelId = parseChannelId($('stChannel').value) || (mode === 'video' ? (data.channelId || '') : '');
      const msg = $('stMsg');

      if (mode === 'video' && !videoId) { msg.textContent = 'الصق رابط بث صحيحاً من يوتيوب.'; return; }
      if (mode === 'channel' && !channelId) { msg.textContent = 'أدخل معرّف قناة صحيحاً (يبدأ بـ UC).'; return; }
      if (poster && !isHttps(poster)) { msg.textContent = 'رابط الغلاف يجب أن يبدأ بـ https://'; return; }

      // آخر الأرقام: الرقم الحالي في الأعلى بلا تكرار
      let recent = Array.isArray(data.recent) ? data.recent.slice() : [];
      if (mode === 'video') {
        recent = recent.filter((r) => r.id !== videoId);
        recent.unshift({ id: videoId, title, at: Date.now() });
        recent = recent.slice(0, RECENT_MAX);
      }

      const payload = { mode, onAir, videoId, channelId, title, poster, recent, updatedAt: serverTimestamp() };
      const btn = $('stSave');
      btn.disabled = true; msg.textContent = 'جارٍ الحفظ…';
      try {
        const r = await commit(setDoc(streamRef(), payload));
        data = Object.assign({}, data, payload, { updatedAt: new Date() });
        dirty = false;
        render();
        msg.textContent = r.queued ? 'حُفظ على الجهاز، ويُرسل عند عودة الاتصال.' : 'تم الحفظ. يصل إلى صفحة البث خلال دقيقة.';
        toast(onAir ? 'حُفظت إعدادات البث' : 'البث متوقف الآن');
      } catch (e) {
        msg.textContent = '';
        toast('تعذّر الحفظ: ' + errText(e), true);
      } finally {
        btn.disabled = false;
      }
    }

    /* ============ الأحداث ============ */
    root.addEventListener('change', (e) => {
      if (e.target.name === 'stMode') syncMode();
      if (e.target.name === 'stMode' || e.target.name === 'stAir') dirty = true;
    });
    ['stVideo', 'stChannel'].forEach((id) => $(id).addEventListener('input', () => { dirty = true; preview(); }));
    ['stTitle', 'stPoster'].forEach((id) => $(id).addEventListener('input', () => { dirty = true; }));
    $('stSave').addEventListener('click', save);
    $('stReload').addEventListener('click', () => { dirty = false; load(true); });
    $('stRecent').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      setRadio('stMode', 'video');
      $('stVideo').value = b.dataset.id;
      $('stTitle').value = b.dataset.title || '';
      dirty = true;
      syncMode();
      $('stMsg').textContent = 'اضغط «حفظ» لاعتماده.';
      $('stSave').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    reload = () => load(false);
    load(false);
  }
};
