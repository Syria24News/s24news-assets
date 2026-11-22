// S24News — فحص النظافة الأسبوعي (cleanliness.yml)
// يقارن المستودع بالموقع الحي (الرئيسية، أقسام، آخر المقالات، كل الصفحات الثابتة) ويكتب:
//   cleanliness-report.md  — التقرير بالعربية، والجديد منذ الفحص السابق معلَّم 🆕
//   cleanliness.json       — القوائم الخام (للمقارنة في الأسبوع التالي)
// كل بند «مرشّح» لا حكم: لا يُحذف شيء إلا بعد مراجعة يدوية وموافقة حسان.
// بلا أي مكتبة خارجية. التشغيل المحلي: node .github/scripts/cleanliness.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const SITE = 'https://www.syria24.news';
const ASSETS = 'syria24news.github.io/s24news-assets/';
const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', 'panel-icons', 'icons']);
// كلاسات تولّدها مكتبات أو بلوجر أو تُكتب داخل صفحات ثابتة — لا تُعدّ ميتة
const LIB_PREFIX = /^(vjs-|swiper-|comment|thread-|avatar-|s24p-|twitter-|blogger-|widget|goog-|g-|gsc-|is-|has-)/;

// ---------- قراءة المستودع ----------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out;
}
const files = walk(ROOT);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const isText = (f) => /\.(js|mjs|html|css|json|yml|xml)$/.test(f);
const REPORT_FILES = new Set(['cleanliness-report.md', 'cleanliness.json']);
// ملفات حيّة يستدعيها ما لا يصل إليه الفحص: الموقع الإنجليزي، اللوحة المركزية (Apps Script)، أداة الآيات (مستودع خاص)
const KNOWN_ALIVE = new Set(['s24-en.css', 'tools/photo-editor.html', 'uthmanic-hafs.woff2']);
const codeFiles = files.filter((f) => /\.(js|mjs|html)$/.test(f));
const cssFiles = files.filter((f) => /\.css$/.test(f));

// ---------- جلب الموقع الحي ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// بلوجر يرفض الطلبات المتلاحقة من خوادم GitHub (429): طلب واحد في كل مرة، وإعادة المحاولة بمهلة متزايدة
async function get(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (s24-cleanliness-bot)' } });
      if (r.ok) return await r.text();
      if (r.status === 404) return '';
      console.log(r.status + ' ' + url);
    } catch (e) { console.log('err ' + url); }
    await sleep(3000 * (i + 1));
  }
  return '';
}
async function livePages() {
  const urls = new Set([SITE + '/', SITE + '/search/label/' + encodeURIComponent('*Sy'), SITE + '/search/label/' + encodeURIComponent('*M'),
    SITE + '/search/label/' + encodeURIComponent('الموسوعة'), SITE + '/search?q=' + encodeURIComponent('سوريا')]);
  const sm = await get(SITE + '/sitemap-pages.xml');
  for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(m[1].trim());
  const feed = await get(SITE + '/feeds/posts/summary?alt=json&max-results=25');
  try {
    for (const e of JSON.parse(feed).feed.entry || []) {
      const l = (e.link || []).find((x) => x.rel === 'alternate'); if (l) urls.add(l.href);
    }
  } catch {}
  const list = [...urls], html = [];
  for (const u of list) { html.push(await get(u)); await sleep(700); }
  return { count: html.filter(Boolean).length, total: list.length, text: html.join('\n') };
}

// ---------- أدوات ----------
const tokens = (s) => new Set(s.match(/[\w؀-ۿ-]+/g) || []);
function cssNames(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const cls = new Set(), ids = new Set();
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    const sel = m[1].trim();
    if (sel.startsWith('@')) continue;
    const s = sel.replace(/\[[^\]]*\]/g, '').replace(/url\([^)]*\)/g, '');
    for (const c of s.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) cls.add(c[1]);
    for (const c of s.matchAll(/#([A-Za-z_][\w-]*)/g)) ids.add(c[1]);
  }
  return { cls, ids };
}
// فحص ذاتي صغير لمستخرج المحددات
{
  const t = cssNames('/* .x */ .a .b-c:hover, #d > .e[data-x=".f"] { color:#fff } @media (max-width:1px){ .g{} }');
  console.assert(['a', 'b-c', 'e', 'g'].every((x) => t.cls.has(x)) && !t.cls.has('x') && !t.cls.has('f') && t.ids.has('d') && !t.ids.has('fff'), 'cssNames');
}

// ---------- الفحص ----------
const live = await livePages();
const repoText = files.filter((f) => isText(f) && !cssFiles.includes(f) && !REPORT_FILES.has(f)).map(read).join('\n');
const hay = tokens(repoText + '\n' + live.text);
const result = { cssUnused: [], filesUnused: [], filesMissing: [], syntax: [], dupFunctions: [], fnUnused: [] };

// 1) كلاسات ومعرّفات CSS لا أثر لها في المستودع ولا في الصفحات الحية
for (const f of cssFiles) {
  const { cls, ids } = cssNames(read(f));
  for (const c of cls) if (!LIB_PREFIX.test(c) && !hay.has(c)) result.cssUnused.push(f + ' .' + c);
  for (const c of ids) if (!hay.has(c)) result.cssUnused.push(f + ' #' + c);
}

// 2) ملفات لا يذكرها أحد، وملفات تستدعيها الصفحات وهي غير موجودة
const allText = repoText + '\n' + live.text;
for (const f of files) {
  if (!/\.(js|css|json|png|jpg|svg|webp|woff2|html|xml)$/.test(f) || f.startsWith('.github/') || REPORT_FILES.has(f) || KNOWN_ALIVE.has(f)) continue;
  if (!allText.includes(path.basename(f))) result.filesUnused.push(f);
}
for (const m of live.text.matchAll(new RegExp(ASSETS.replace(/\./g, '\\.') + '([\\w./-]+)', 'g'))) {
  const f = m[1].replace(/[?#].*$/, '');
  if (f && !files.includes(f) && !result.filesMissing.includes(f)) result.filesMissing.push(f);
}

// 3) أخطاء الصياغة في JavaScript (الوحدات import/export تُفحص كـ .mjs)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 's24c-'));
for (const f of codeFiles.filter((x) => /\.(js|mjs)$/.test(x))) {
  const src = read(f);
  let target = path.join(ROOT, f);
  if (/^\s*(import|export)\s/m.test(src) && !f.endsWith('.mjs')) { target = path.join(tmp, 'm.mjs'); fs.writeFileSync(target, src); }
  try { execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' }); }
  catch (e) { result.syntax.push(f + ': ' + String(e.stderr || e.message).split('\n').find((l) => /Error/.test(l)) || f); }
}

// 4) دوال معرّفة في أكثر من ملف، ودوال لا تُستدعى في أي مكان
const defs = {};
for (const f of codeFiles.filter((x) => /\.(js|mjs)$/.test(x))) {
  for (const m of read(f).matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) (defs[m[1]] ||= new Set()).add(f);
}
const callCount = (name) => (allText.match(new RegExp('(?<![\\w$])' + name.replace(/\$/g, '\\$') + '(?![\\w$])', 'g')) || []).length;
for (const [name, where] of Object.entries(defs)) {
  if (where.size > 1) result.dupFunctions.push(name + ' ← ' + [...where].join('، '));
  else if (callCount(name) <= 1) result.fnUnused.push(name + ' (' + [...where][0] + ')');
}

// ---------- المقارنة بالفحص السابق والكتابة ----------
let prev = {};
try { prev = JSON.parse(read('cleanliness.json')); } catch {}
const TITLES = {
  cssUnused: 'CSS: كلاسات ومعرّفات بلا أثر في المستودع ولا في الصفحات الحية',
  filesUnused: 'ملفات في المستودع لا يذكرها أحد',
  filesMissing: 'ملفات تستدعيها الصفحات الحية وهي غير موجودة في المستودع',
  syntax: 'أخطاء صياغة في JavaScript',
  dupFunctions: 'دوال معرّفة في أكثر من ملف (تكرار)',
  fnUnused: 'دوال معرّفة ولا تُستدعى في أي مكان'
};
for (const k in result) result[k].sort();
const today = new Date().toISOString().slice(0, 10);
let md = `# تقرير النظافة — ${today}\n\n` +
  `- الصفحات الحية المفحوصة: ${live.count} من ${live.total} (الرئيسية، أقسام، بحث، آخر 25 مقالة، كل الصفحات الثابتة).\n` +
  `- كل بند **مرشّح** يحتاج مراجعة يدوية قبل الحذف (قد يُستعمل في مقالة قديمة أو يُركَّب نصه في JavaScript).\n` +
  `- 🆕 = لم يكن في الفحص السابق.\n\n| البند | العدد | الجديد |\n|---|---|---|\n`;
for (const k in TITLES) md += `| ${TITLES[k]} | ${result[k].length} | ${result[k].filter((x) => !(prev[k] || []).includes(x)).length} |\n`;
for (const k in TITLES) {
  md += `\n## ${TITLES[k]} (${result[k].length})\n\n`;
  md += result[k].length ? result[k].map((x) => `- ${(prev[k] || []).includes(x) ? '' : '🆕 '}\`${x}\``).join('\n') + '\n' : 'لا شيء ✓\n';
}
if (live.count < live.total * 0.8) md = `> ⚠ جُلبت ${live.count} صفحة فقط من ${live.total}: النتائج أقل دقة هذا الأسبوع.\n\n` + md;
fs.writeFileSync(path.join(ROOT, 'cleanliness-report.md'), md);
fs.writeFileSync(path.join(ROOT, 'cleanliness.json'), JSON.stringify({ date: today, pages: live.count, ...result }, null, 1));
console.log(Object.entries(result).map(([k, v]) => k + '=' + v.length).join(' '));
