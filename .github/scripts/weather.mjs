/* ============================================================
   S24News — مولّد weather.json (حالة الطقس في المحافظات السورية)
   يعمل في GitHub Actions (.github/workflows/weather.yml) أربع مرات يومياً.

   المصدر: المعهد النرويجي للأرصاد MET Norway — api.met.no (Locationforecast 2.0 compact)
   - مجاني ويسمح بالاستخدام التجاري بشرط ذكر المصدر (CC BY 4.0 / NLOD).
   - شرطه: كل طلب يعرّف بنفسه في ترويسة User-Agent (اسم الموقع + وسيلة تواصل)،
     وإلا حُجب. لهذا يعمل الجلب من GitHub لا من Apps Script (Apps Script لا يسمح بتغيير User-Agent).
   - الإحداثيات بأربع خانات عشرية على الأكثر (شرط الخدمة).

   المخرجات: weather.json في جذر المستودع، يقرؤه weather.js في صفحة /p/weather.html.
   - إن فشل جلب محافظة تبقى بياناتها السابقة من الملف القديم (لا تُمحى بسبب خطأ عابر).
   - إن فشلت كل المحافظات لا يُكتب الملف، وتفشل المهمة فتظهر حمراء في تبويب Actions.

   الاستهلاك: 14 طلباً في الدورة × 4 دورات = 56 طلباً يومياً. لا Apps Script ولا Firestore.
   ============================================================ */

import { readFile, writeFile } from 'node:fs/promises';

const OUT = 'weather.json';
const API = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const UA  = 'Syria24News/1.0 (+https://www.syria24.news/p/contact.html)';

const TZ_OFFSET_H = 3;   // توقيت سوريا الدائم UTC+3
const HOURS = 36;        // الساعات المحفوظة لكل محافظة (الصفحة تختار منها «الآن» حسب وقت الزائر)
const DAYS  = 5;         // أيام التوقعات

/* المحافظات الأربع عشرة — الترتيب هنا هو ترتيب العرض في الصفحة */
const CITIES = [
  { id: 'damascus',  name: 'دمشق',      lat: 33.5138, lon: 36.2765 },
  { id: 'rif',       name: 'ريف دمشق',  lat: 33.5711, lon: 36.4019 },  // دوما
  { id: 'aleppo',    name: 'حلب',       lat: 36.2021, lon: 37.1343 },
  { id: 'homs',      name: 'حمص',       lat: 34.7324, lon: 36.7137 },
  { id: 'hama',      name: 'حماة',      lat: 35.1318, lon: 36.7578 },
  { id: 'latakia',   name: 'اللاذقية',  lat: 35.5317, lon: 35.7915 },
  { id: 'tartus',    name: 'طرطوس',     lat: 34.8890, lon: 35.8866 },
  { id: 'idlib',     name: 'إدلب',      lat: 35.9306, lon: 36.6339 },
  { id: 'raqqa',     name: 'الرقة',     lat: 35.9594, lon: 39.0081 },
  { id: 'deir',      name: 'دير الزور', lat: 35.3359, lon: 40.1408 },
  { id: 'hasakah',   name: 'الحسكة',    lat: 36.5024, lon: 40.7477 },
  { id: 'daraa',     name: 'درعا',      lat: 32.6189, lon: 36.1021 },
  { id: 'sweida',    name: 'السويداء',  lat: 32.7090, lon: 36.5695 },
  { id: 'quneitra',  name: 'القنيطرة',  lat: 33.1259, lon: 35.8244 }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r1 = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 10) / 10 : null);

/* تاريخ اليوم بتوقيت سوريا: '2026-11-01' */
function localDate(iso) {
  const d = new Date(new Date(iso).getTime() + TZ_OFFSET_H * 3600000);
  return d.toISOString().slice(0, 10);
}

async function fetchCity(c) {
  const url = `${API}?lat=${c.lat.toFixed(4)}&lon=${c.lon.toFixed(4)}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' } });
    if (res.ok) return res.json();
    // 429 = تجاوز أو هوية ناقصة، 5xx = عطل مؤقت: محاولة ثانية واحدة بعد مهلة
    if (attempt === 1 && (res.status === 429 || res.status >= 500)) { await sleep(5000); continue; }
    throw new Error(`${c.id}: HTTP ${res.status}`);
  }
}

/* تحويل استجابة met.no إلى الصيغة المختصرة للصفحة */
function shape(c, j) {
  const ts = (j && j.properties && j.properties.timeseries) || [];
  if (!ts.length) throw new Error(`${c.id}: empty timeseries`);

  // 1) الساعات: نقاط ساعية متتالية (فيها next_1_hours)
  const hours = [];
  for (const e of ts) {
    const n1 = e.data.next_1_hours;
    if (!n1) break;                       // انتهى الجزء الساعي
    const i = e.data.instant.details;
    hours.push({
      t: e.time.slice(0, 16) + 'Z',
      c: r1(i.air_temperature),
      s: n1.summary.symbol_code,
      w: i.wind_speed != null ? Math.round(i.wind_speed * 3.6) : null,   // كم/س
      d: i.wind_from_direction != null ? Math.round(i.wind_from_direction) : null,
      h: i.relative_humidity != null ? Math.round(i.relative_humidity) : null
    });
    if (hours.length >= HOURS) break;
  }

  // 2) الأيام: الصغرى والعظمى من القراءات اللحظية، والحالة من فترة النهار (09:00–15:00 بتوقيت سوريا)،
  //    والهطول مجموع فترات 6 ساعات التي تبدأ عند 00 و06 و12 و18 UTC
  const byDay = new Map();
  for (const e of ts) {
    const day = localDate(e.time);
    if (!byDay.has(day)) byDay.set(day, { d: day, lo: null, hi: null, s: null, sAny: null, p: 0, pN: 0 });
    const g = byDay.get(day);
    const t = e.data.instant.details.air_temperature;
    if (typeof t === 'number') {
      g.lo = g.lo == null ? t : Math.min(g.lo, t);
      g.hi = g.hi == null ? t : Math.max(g.hi, t);
    }
    const n6 = e.data.next_6_hours;
    const hUtc = Number(e.time.slice(11, 13));
    if (n6) {
      if (hUtc === 6) g.s = n6.summary.symbol_code;
      if (!g.sAny) g.sAny = n6.summary.symbol_code;
      if (hUtc % 6 === 0 && n6.details && typeof n6.details.precipitation_amount === 'number') {
        g.p += n6.details.precipitation_amount; g.pN++;
      }
    }
    if (!g.sAny && e.data.next_12_hours) g.sAny = e.data.next_12_hours.summary.symbol_code;
  }
  const days = [...byDay.values()].slice(0, DAYS).map((g) => ({
    // رمز اليوم بصيغة النهار دائماً (أيقونة شمس لا قمر في جدول الأيام)
    d: g.d, lo: r1(g.lo), hi: r1(g.hi), s: (g.s || g.sAny || '').replace(/_night$/, '_day') || null,
    p: g.pN ? r1(g.p) : null
  }));

  return { id: c.id, name: c.name, hours, days };
}

async function main() {
  let old = null;
  try { old = JSON.parse(await readFile(OUT, 'utf8')); } catch (e) { /* أول تشغيل */ }
  const oldById = new Map(((old && old.cities) || []).map((x) => [x.id, x]));

  const cities = [];
  let ok = 0, modelUpdated = null;
  for (const c of CITIES) {
    try {
      const j = await fetchCity(c);
      cities.push(shape(c, j));
      if (!modelUpdated) modelUpdated = j.properties.meta && j.properties.meta.updated_at;
      ok++;
    } catch (e) {
      console.error('⚠', e.message);
      if (oldById.has(c.id)) cities.push(Object.assign({}, oldById.get(c.id), { stale: true }));
    }
    await sleep(400);   // تهدئة بين الطلبات (شرط الخدمة: لا ضغط على الخادم)
  }

  if (!ok) { console.error('❌ فشل جلب كل المحافظات — لم يُكتب الملف'); process.exit(1); }

  const out = {
    v: 1,
    updated: new Date().toISOString(),
    model: modelUpdated || null,
    source: 'met.no',
    tzOffset: TZ_OFFSET_H,
    cities
  };
  await writeFile(OUT, JSON.stringify(out) + '\n');
  console.log(`✅ ${ok}/${CITIES.length} محافظة — ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
