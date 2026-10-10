# لوحة تحكم سوريا 24 — تطبيق PWA

الرابط: `https://syria24news.github.io/s24news-assets/admin/`
الإصدار 2.0 — 10 أكتوبر 2026

## الملفات

| الملف | الدور |
|---|---|
| `index.html` | الغلاف: الدخول، الشريط السفلي للوحدات، شارة الاتصال، شريط النسخة الجديدة، زر التثبيت |
| `js/core.js` | النواة المشتركة: Firebase، كاش Firestore الدائم، `smartLoad`، `commit`، `callDeferred` |
| `js/polls.js` | وحدة الاستطلاعات |
| `sw.js` | عامل الخدمة (العمل دون اتصال) — نطاقه مجلد `admin/` فقط |
| `manifest.webmanifest` | بيانات التثبيت (الاسم، الأيقونات، الاختصارات) |
| `icons/` | أيقونات التطبيق |

## التثبيت على الهاتف

- **أندرويد (Chrome):** افتح الرابط ← زر «تثبيت» في الرأس، أو قائمة ⋮ ← «تثبيت التطبيق».
- **iPhone (Safari):** زر المشاركة ← «إضافة إلى الشاشة الرئيسية».
- الدخول بحساب Google مرة واحدة مع الإنترنت، وبعدها يفتح التطبيق حتى دون اتصال.

## قواعد التوفير (الحصة المجانية)

- لا مستمعات دائمة ولا استعلامات دورية ولا مزامنة في الخلفية: صفر قراءة والتطبيق مغلق.
- عند فتح قسم: تُعرض النسخة المحفوظة فوراً، ولا يُقرأ من الخادم إلا إذا مرّ أكثر من 5 دقائق
  (`CFG.defaultMaxAge`) أو ضُغط «تحديث».
- بعد الحفظ تُعاد قراءة القائمة من الكاش المحلي (0 قراءة) لأن التعديل موجود فيه أصلاً.
- دون اتصال: الكتابات تُحفظ على الجهاز وتُرسل تلقائياً، وطلبات البوابات (مثل rebuild) تتأجل
  وتُرسل مرة واحدة بعد اكتمال المزامنة.

## إضافة وحدة جديدة

1. أنشئ `js/<اسم>.js` بهذا القالب:

```js
import { db, $, toast, errText, smartLoad, commit, callDeferred, requireOnline,
  collection, doc, setDoc, updateDoc, serverTimestamp } from './core.js';

let mounted = false, reload = () => {};

export default {
  id: 'breaking',                 // يظهر في الرابط: #breaking
  title: 'العاجل',                // اسم التبويب
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">…</svg>',
  mount(root) {                   // تُستدعى عند الفتح والعودة وعودة الاتصال — اجعلها رخيصة
    if (mounted) return reload();
    mounted = true;
    root.innerHTML = `…`;         // اجعل الجداول <table class="cards-sm"> و<td data-label="…">

    async function load(force) {
      await smartLoad(collection(db, 'breaking_news'), 'breaking',
        (snap) => { /* ارسم من snap.docs */ }, { force });
    }
    // الحفظ: await commit(setDoc(doc(db, 'breaking_news', id), {...}));
    // العمليات التي تحتاج الخادم: if (!requireOnline('الحذف')) return;
    reload = load;
    load();
  }
};
```

2. في `index.html`: `import breaking from './js/breaking.js';` ثم أضفه إلى `MODULES`.
3. في `sw.js`: أضف `'./js/breaking.js'` إلى `PRECACHE` وارفع `VERSION` (مثلاً 2.1.0)
   حتى يظهر شريط «نسخة جديدة» على الهاتف ويعمل القسم دون اتصال من أول مرة.
4. في `manifest.webmanifest` (اختياري): أضف اختصاراً `./?source=shortcut#breaking`.
5. إن كانت الوحدة تكتب على مجموعة جديدة: أضف قاعدتها في Firestore Rules بدالة `isAdmin()`.

## التحديثات

- ملفات اللوحة تُجلب «من الشبكة أولاً»: أي تعديل على GitHub يصل للهاتف عند الفتح التالي مع الاتصال.
- تعديل `sw.js` نفسه (ورفع `VERSION`) يُظهر شريط «نسخة جديدة — تحديث الآن».
