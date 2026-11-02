/* ============================================================
   S24News — مولّد feed.xml (خلاصة RSS بصور كاملة الحجم)
   يعمل في GitHub Actions (.github/workflows/feed.yml) كل 20 دقيقة تقريباً.

   لماذا: خلاصة بلوجر لا تحمل إلا صورة مصغّرة 72×72 (s72-c) ومقتطفاً خاماً
   يدخل فيه نص صندوق المعلومات، فتظهر الصور مموّهة في Inoreader وFeedly وغيرهما.

   ما يفعله:
   1. يقرأ آخر 25 مقالة من خلاصة بلوجر (alt=json).
   2. يحوّل رابط الصورة المصغّرة إلى نسخة بعرض 1200 بكسل (w1200) — نفس صورة twitter:image في القالب.
   3. يأخذ الوصف من «وصف البحث» في صفحة المقالة (meta description) — نظيف ومكتوب يدوياً.
      تُجلب صفحة المقالة مرة واحدة فقط (ثم تُحفظ في feed-cache.json) ويُعاد جلبها إن عُدّلت المقالة.
   4. يكتب feed.xml (RSS 2.0) فيه media:content وenclosure وصورة كبيرة داخل content:encoded.

   الاستهلاك: طلب واحد للخلاصة + طلب لكل مقالة جديدة أو معدّلة فقط. لا Apps Script ولا Firestore.
   إن فشل جلب خلاصة بلوجر لا يُمسّ الملف القديم وتفشل المهمة (تظهر حمراء في Actions).
   ============================================================ */

import { readFile, writeFile } from 'node:fs/promises';

const SITE   = 'https://www.syria24.news';
const SRC    = `${SITE}/feeds/posts/default?alt=json&max-results=25`;
const OUT    = 'feed.xml';
const CACHE  = 'feed-cache.json';
const SELF   = 'https://syria24news.github.io/s24news-assets/feed.xml';
const UA     = 'Syria24News-Feed/1.0 (+https://www.syria24.news/p/contact.html)';
const TITLE  = 'سوريا 24 — أخبار سوريا والعالم';
const DESC   = 'منصة سوريا 24 الإخبارية — وحدة الحقيقة';
const LOGO   = 'https://syria24news.github.io/s24news-assets/s24-panel.png';

/* ---------- أدوات ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* فك ترميز كيانات HTML الشائعة في meta */
const unent = (s) => String(s ?? '')
  .replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&amp;/g, '&');

/* نص خام من HTML (احتياط إن لم يوجد وصف بحث) */
const plain = (html) => unent(String(html ?? '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const cut = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s);

/* تكبير صورة بلوجر/يوتيوب المصغّرة */
function bigImage(url) {
  if (!url) return '';
  if (/img\.youtube\.com|i\.ytimg\.com/.test(url)) return url.replace(/\/(default|mqdefault)\.jpg$/, '/hqdefault.jpg');
  // .../s72-c/name.webp  أو  .../s72-c-rw/...  ←  .../w1200/name.webp
  return url.replace(/\/s\d+(-[a-z0-9-]+)?\/([^/]+)$/i, '/w1200/$2')
            .replace(/=s\d+(-[a-z0-9-]+)?$/i, '=w1200');
}

const mimeOf = (url) => /\.webp(\?|$)/i.test(url) ? 'image/webp'
  : /\.png(\?|$)/i.test(url) ? 'image/png'
  : /\.gif(\?|$)/i.test(url) ? 'image/gif' : 'image/jpeg';

async function get(url, type) {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return type === 'json' ? await r.json() : await r.text();
    } catch (e) {
      if (i === 3) throw e;
      await sleep(2000 * i);
    }
  }
}

/* وصف البحث وog:image من صفحة المقالة */
async function pageMeta(url) {
  const html = await get(url, 'text');
  // بلوجر يكتب السمات بعلامات مفردة ' وبترتيب متغيّر — نقرأ كل وسم meta وسماته أياً كان شكلها
  const metas = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[m[1].toLowerCase()] = m[3] ?? m[4];
    const key = (attrs.name || attrs.property || '').toLowerCase();
    if (key && attrs.content != null && !(key in metas)) metas[key] = unent(attrs.content).trim();
  }
  return {
    desc: metas['description'] || metas['og:description'] || '',
    image: metas['twitter:image'] || metas['og:image'] || ''
  };
}

/* ---------- التشغيل ---------- */
const data = await get(SRC, 'json');           // إن فشل: تتوقف المهمة ويبقى feed.xml القديم
const entries = data?.feed?.entry || [];
if (!entries.length) throw new Error('خلاصة بلوجر فارغة — لم يُكتب شيء');

let cache = {};
try { cache = JSON.parse(await readFile(CACHE, 'utf8')); } catch { /* أول تشغيل */ }
const newCache = {};

const items = [];
for (const e of entries) {
  const id      = e.id?.$t || '';
  const updated = e.updated?.$t || '';
  const link    = (e.link || []).find((l) => l.rel === 'alternate')?.href;
  if (!link) continue;                         // مسودة/صفحة بلا رابط

  // الوصف والصورة من الذاكرة إن لم تُعدَّل المقالة، وإلا من صفحتها
  // (ذاكرة بلا وصف ولا صورة تُعدّ فاشلة ويُعاد الجلب)
  let meta = cache[id] && cache[id].updated === updated && (cache[id].desc || cache[id].image) ? cache[id] : null;
  if (!meta) {
    try {
      const m = await pageMeta(link);
      meta = { updated, desc: m.desc, image: m.image };
      await sleep(300);                        // تهذيب مع خادم بلوجر
    } catch (err) {
      console.warn('تعذّر جلب', link, err.message);
      meta = { updated: '', desc: '', image: '' };   // updated فارغ ← يُعاد المحاولة في الدورة التالية
    }
  }
  newCache[id] = meta;

  const image = meta.image || bigImage(e.media$thumbnail?.url) || '';
  const desc  = meta.desc || cut(plain(e.content?.$t || e.summary?.$t), 280);

  items.push({
    title: e.title?.$t || '',
    link,
    guid: id,
    pub: new Date(e.published?.$t || updated).toUTCString(),
    author: e.author?.[0]?.name?.$t || 'سوريا 24',
    cats: (e.category || []).map((c) => c.term).filter((t) => t && !/^\*/.test(t)),  // إخفاء الوسوم الفنية مثل *A
    image,
    desc
  });
}

/* ---------- كتابة RSS ---------- */
const itemXml = items.map((it) => {
  const body = (it.image ? `<p><img src="${esc(it.image)}" alt="${esc(it.title)}" width="1200" /></p>` : '')
    + `<p>${esc(it.desc)}</p><p><a href="${esc(it.link)}">اقرأ المقالة كاملة على سوريا 24</a></p>`;
  return `  <item>
    <title>${esc(it.title)}</title>
    <link>${esc(it.link)}</link>
    <guid isPermaLink="false">${esc(it.guid)}</guid>
    <pubDate>${it.pub}</pubDate>
    <dc:creator>${esc(it.author)}</dc:creator>
${it.cats.map((c) => `    <category>${esc(c)}</category>`).join('\n')}
    <description>${esc(it.desc)}</description>
    <content:encoded><![CDATA[${body.replace(/]]>/g, ']]&gt;')}]]></content:encoded>${it.image ? `
    <enclosure url="${esc(it.image)}" type="${mimeOf(it.image)}" length="0" />
    <media:content url="${esc(it.image)}" medium="image" type="${mimeOf(it.image)}" width="1200" />
    <media:thumbnail url="${esc(it.image)}" width="1200" />` : ''}
  </item>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${esc(TITLE)}</title>
  <link>${SITE}/</link>
  <atom:link href="${SELF}" rel="self" type="application/rss+xml" />
  <description>${esc(DESC)}</description>
  <language>ar</language>
  <image><url>${LOGO}</url><title>${esc(TITLE)}</title><link>${SITE}/</link></image>
  <ttl>20</ttl>
${itemXml}
</channel>
</rss>
`;

/* لا يُكتب الملف إن لم تتغير المقالات (تجنّب التزامات ونشر بلا داعٍ) */
let old = '';
try { old = await readFile(OUT, 'utf8'); } catch { /* أول تشغيل */ }
if (old === xml) {
  console.log('لا تغيير في الخلاصة');
} else {
  await writeFile(OUT, xml);
  console.log(`كُتب ${OUT}: ${items.length} مقالة`);
}
await writeFile(CACHE, JSON.stringify(newCache, null, 0) + '\n');
