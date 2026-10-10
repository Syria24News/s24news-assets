/* ============================================================
   S24News — عامل الخدمة للوحة التحكم (admin/sw.js)
   الإصدار 2.0.0 — 10 أكتوبر 2026
   نطاقه: مجلد admin/ فقط — لا يمسّ موقع سوريا 24 ولا بقية ملفات المستودع.

   السياسات:
   1) ملفات اللوحة نفسها (HTML/JS/أيقونات): الشبكة أولاً مع مهلة 4 ثوانٍ، ثم النسخة المحفوظة.
      ⇐ مع الاتصال تصل أحدث نسخة من GitHub تلقائياً (لا حاجة لتعديل هذا الملف عند كل وحدة جديدة)،
        ودون اتصال تعمل اللوحة من النسخة المحفوظة.
   2) مكتبات Firebase والخطوط (روابط ثابتة بالإصدار): الكاش أولاً — تُنزَّل مرة واحدة.
   3) طلبات Firestore والدخول وApps Script: لا يتدخل فيها إطلاقاً (Firestore يدير كاشه بنفسه).
   لا مزامنة في الخلفية ولا مؤقتات: صفر استهلاك للبطارية والحصة والتطبيق مغلق.

   متى أغيّر VERSION؟ عند تعديل هذا الملف، أو لإجبار حذف الكاش القديم كاملاً.
   (إضافة وحدة جديدة لا تتطلب ذلك، لكن يُستحسن إضافة ملفها إلى PRECACHE ليعمل دون اتصال من أول مرة.)
   ============================================================ */
const VERSION = '2.0.0';
const SHELL = 's24-admin-shell-' + VERSION;
const LIBS = 's24-admin-libs-v1';

// ملفات تُحفظ عند التثبيت ليعمل التطبيق دون اتصال من أول فتح بعد التثبيت
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/core.js',
  './js/polls.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const PRECACHE_LIBS = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
];
const LIB_HOSTS = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const NET_TIMEOUT = 4000;

const SCOPE = new URL(self.registration.scope).pathname;   // /s24news-assets/admin/

/* ============ التثبيت: حفظ الملفات الأساسية (فشل ملف واحد لا يُفشل التثبيت) ============ */
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await Promise.all(PRECACHE.map((u) =>
      fetch(u, { cache: 'no-cache' }).then((r) => r.ok && shell.put(u, r)).catch(() => {})));
    const libs = await caches.open(LIBS);
    await Promise.all(PRECACHE_LIBS.map((u) =>
      libs.match(u).then((hit) => hit || fetch(u, { mode: 'cors' }).then((r) => r.ok && libs.put(u, r))).catch(() => {})));
  })());
  // لا skipWaiting هنا: النسخة الجديدة تنتظر ضغط "تحديث" في اللوحة حتى لا تنقطع عملية جارية
});

/* ============ التفعيل: حذف كاش الإصدارات القديمة ============ */
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('s24-admin-') && k !== SHELL && k !== LIBS)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// رسالة من اللوحة عند ضغط "تحديث" في شريط النسخة الجديدة
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ============ اعتراض الطلبات ============ */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1) ملفات اللوحة
  if (url.origin === self.location.origin && url.pathname.startsWith(SCOPE)) {
    const work = networkFirst(req, url);
    e.respondWith(work.response);
    e.waitUntil(work.done);      // يُستدعى فوراً (لا بعد await) وإلا رفضه المتصفح
    return;
  }
  // 2) المكتبات والخطوط
  if (LIB_HOSTS.includes(url.hostname) &&
      (url.hostname !== 'www.gstatic.com' || url.pathname.startsWith('/firebasejs/'))) {
    e.respondWith(cacheFirst(req));
  }
  // 3) غير ذلك: يمرّ للشبكة دون تدخل
});

// تُرجع { response: وعد الرد، done: وعد انتهاء تحديث الكاش في الخلفية }
function networkFirst(req, url) {
  const isNav = req.mode === 'navigate';
  // مفتاح الكاش بلا وسم # ولا معاملات (?source=pwa...)
  const key = url.origin + url.pathname;
  const cacheP = caches.open(SHELL);

  // cache:'no-cache' = تحقق سريع من GitHub (304 إن لم يتغير) بدل الاعتماد على كاش المتصفح 10 دقائق
  const net = fetch(key, { cache: 'no-cache', credentials: 'same-origin' });
  const done = net.then(async (res) => {
    if (res.ok) await (await cacheP).put(key, res.clone());
  }).catch(() => {});

  const response = (async () => {
    const cache = await cacheP;
    const cached = (await cache.match(key)) ||
      (isNav ? (await cache.match(SCOPE)) || (await cache.match(SCOPE + 'index.html')) : null);
    if (!cached) {
      return net.catch(() => new Response('اللوحة غير متاحة دون اتصال بعد — افتحها مرة مع الإنترنت.',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
    }
    const timeout = new Promise((r) => setTimeout(() => r(cached), NET_TIMEOUT));
    return Promise.race([net.then((r) => (r.ok ? r.clone() : cached)).catch(() => cached), timeout]);
  })();
  return { response, done };
}

async function cacheFirst(req) {
  const cache = await caches.open(LIBS);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
