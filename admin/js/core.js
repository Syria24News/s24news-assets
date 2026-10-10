/* ============================================================
   S24News — نواة لوحة التحكم (admin/js/core.js)
   الإصدار 2.0 — 10 أكتوبر 2026 (تطبيق PWA للهاتف + العمل دون اتصال)
   مشترك بين كل الوحدات: إعداد Firebase، الدخول، الأدوات العامة، التنبيهات،
   وطبقة الاتصال الموفّرة (قراءة ذكية، كتابة لا تتجمّد دون اتصال، طابور مؤجَّل).
   كل وحدة جديدة (الخبر العاجل، الخبر الهام، التغطية الحية...) تستورد من هذا الملف فقط.

   مبدأ التوفير (للبقاء ضمن الحصة المجانية Spark):
   - لا مستمعات دائمة ولا استعلامات دورية: البيانات تُقرأ عند فتح القسم فقط.
   - تُعرض النسخة المحفوظة على الجهاز فوراً (0 قراءة)، ولا يُطلب الخادم إلا إذا
     تقادمت النسخة (maxAge) أو ضغط المستخدم "تحديث".
   - الكتابة دون اتصال تُحفظ على الجهاز وتُرسل تلقائياً عند عودة الشبكة (Firestore نفسه).
   ============================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, getDocs, getDocsFromCache, getDocsFromServer, getDoc, doc, setDoc, updateDoc, deleteDoc,
  writeBatch, query, where, orderBy, limit, serverTimestamp, Timestamp, waitForPendingWrites }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const CFG = {
  firebase: {
    apiKey: 'AIzaSyBD8sDOnDXtWnzLGbGZI-w45OqTKJ6M5KI',
    authDomain: 's24n-views.firebaseapp.com',
    projectId: 's24n-views',
    storageBucket: 's24n-views.firebasestorage.app',
    messagingSenderId: '535339260420',
    appId: '1:535339260420:web:11e4d95694df6cc4def351'
  },
  admin: 'hassanalduvayhi@gmail.com',   // نفس البريد في قواعد Firestore
  tz: 'Asia/Damascus',
  defaultMaxAge: 5 * 60 * 1000,         // عمر النسخة المحفوظة قبل طلب الخادم (5 دقائق)
  writeWait: 6000                       // بعدها تُعدّ الكتابة "بانتظار المزامنة" بدل تجميد الواجهة
};

export const app = initializeApp(CFG.firebase);
export const auth = getAuth(app);

// Firestore مع كاش دائم على الجهاز (IndexedDB): يتيح القراءة والكتابة دون اتصال
// ويحفظ الكتابات المعلّقة حتى بعد إغلاق التطبيق. إن تعذّر (متصفح خاص مثلاً) نعود للوضع العادي.
let _db;
try {
  _db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  console.warn('[S24 admin] تعذّر تفعيل الكاش الدائم، العمل بالذاكرة فقط', e);
  _db = getFirestore(app);
}
export const db = _db;

// إعادة تصدير دوال Firebase حتى تستورد الوحدات من مكان واحد
export { GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged,
  collection, getDocs, getDocsFromCache, getDocsFromServer, getDoc, doc, setDoc, updateDoc, deleteDoc,
  writeBatch, query, where, orderBy, limit, serverTimestamp, Timestamp };

export const $ = (id) => document.getElementById(id);

export function isAdmin(user) {
  return !!user && String(user.email || '').toLowerCase() === CFG.admin;
}

/* ============ النصوص ============ */
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// تنظيف النص: بلا وسوم ولا < >
export function clean(s, max) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, max);
}

/* ============ التواريخ (بتوقيت دمشق) ============ */
export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
}
const fmt = new Intl.DateTimeFormat('ar-u-nu-latn', { timeZone: CFG.tz, dateStyle: 'medium', timeStyle: 'short' });
const fmtTime = new Intl.DateTimeFormat('ar-u-nu-latn', { timeZone: CFG.tz, timeStyle: 'short' });
export const fmtDay = new Intl.DateTimeFormat('ar-u-nu-latn', { timeZone: CFG.tz, day: 'numeric', month: 'numeric' });
export function fmtDate(v) { const d = toDate(v); return d ? fmt.format(d) : '—'; }

export function partsTZ(d) {
  const p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: CFG.tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  return p;
}
export function dayKey(d) { const p = partsTZ(d); return 'd' + p.year + p.month + p.day; }

// "منذ 3 د" — لعرض عمر آخر مزامنة
export function fmtAgo(ms) {
  if (!ms) return 'لم تُزامَن بعد';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return 'الآن';
  if (s < 3600) return 'منذ ' + Math.round(s / 60) + ' د';
  if (s < 86400) return 'منذ ' + Math.round(s / 3600) + ' س';
  return fmtDate(ms);
}

/* ============ التنبيهات والأخطاء ============ */
let toastTimer = null;
export function toast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg; t.className = isErr ? 'err' : ''; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, isErr ? 7000 : 3500);
}
export function errText(e) {
  const code = (e && e.code) || '';
  if (code.includes('permission-denied')) return 'الصلاحيات مرفوضة — تأكد من الحساب ومن قواعد Firestore';
  if (code.includes('unavailable')) return 'تعذّر الاتصال بـ Firestore';
  return (e && e.message) || String(e);
}

/* ============================================================
   حالة الاتصال — يشترك بها الغلاف (شارة الحالة) وأي وحدة
   ============================================================ */
const listeners = new Set();
let pending = 0;                 // كتابات أُرسلت ولم يؤكّدها الخادم بعد

export function isOnline() { return navigator.onLine !== false; }
export function status() {
  return { online: isOnline(), pending, deferred: readDeferred().length, lastSync: lastSyncAny() };
}
// fn(status) — تُستدعى فوراً ثم عند كل تغيير. تُرجع دالة لإلغاء الاشتراك.
export function onStatus(fn) { listeners.add(fn); fn(status()); return () => listeners.delete(fn); }
function emit() { const s = status(); listeners.forEach((fn) => { try { fn(s); } catch (e) {} }); }

/* ============ ذاكرة آخر مزامنة لكل مفتاح (localStorage) ============ */
const SYNC_PREFIX = 's24_admin_sync_';
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
export function lastSync(key) { return Number(lsGet(SYNC_PREFIX + key)) || 0; }
function setLastSync(key) { lsSet(SYNC_PREFIX + key, String(Date.now())); emit(); }
function lastSyncAny() {
  let m = 0;
  try { for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(SYNC_PREFIX)) m = Math.max(m, Number(localStorage.getItem(k)) || 0);
  } } catch (e) {}
  return m;
}

/* ============================================================
   القراءة الذكية — smartLoad(q, key, onData, { maxAge, force })
   1) تعرض النسخة المحفوظة على الجهاز فوراً (بلا أي قراءة مدفوعة).
   2) تطلب الخادم فقط إذا: force، أو تقادمت النسخة أكثر من maxAge، أو لا توجد نسخة.
   3) دون اتصال: تكتفي بالنسخة المحفوظة.
   onData(snapshot, { fromCache, at }) قد تُستدعى مرتين (محفوظ ثم حديث).
   تُرجع 'cache' | 'server' | 'offline'.
   ============================================================ */
export async function smartLoad(q, key, onData, opts = {}) {
  const maxAge = opts.maxAge == null ? CFG.defaultMaxAge : opts.maxAge;
  const at = lastSync(key);
  let hadCache = false;
  try {
    const c = await getDocsFromCache(q);
    if (!c.empty || at) { hadCache = true; onData(c, { fromCache: true, at }); }
  } catch (e) { /* لا كاش بعد */ }

  const fresh = at && (Date.now() - at) < maxAge;
  if (!opts.force && hadCache && fresh) return 'cache';
  if (!isOnline()) {
    if (!hadCache) onData({ docs: [], empty: true }, { fromCache: true, at: 0 });
    return 'offline';
  }
  try {
    const s = await getDocsFromServer(q);
    setLastSync(key);
    onData(s, { fromCache: false, at: Date.now() });
    return 'server';
  } catch (e) {
    if (!hadCache) throw e;
    toast('تُعرض النسخة المحفوظة — تعذّر الوصول للخادم: ' + errText(e), true);
    return 'cache';
  }
}

/* ============================================================
   الكتابة الآمنة — commit(promise)
   وعد Firestore لا ينتهي إلا بعد تأكيد الخادم، فيتجمّد دون اتصال.
   هذه الدالة تنتظره حتى CFG.writeWait فقط؛ بعدها تعدّه "محفوظاً على الجهاز
   بانتظار المزامنة" وتكمل الواجهة. تُرجع { queued: boolean }.
   الأخطاء الحقيقية (صلاحيات...) تُرمى كما هي إن وصلت قبل المهلة.
   ============================================================ */
export function commit(p) {
  pending++; emit();
  const done = p.then(() => { pending--; emit(); return { queued: false }; },
    (e) => { pending--; emit(); throw e; });
  let timer;
  const wait = new Promise((res) => {
    timer = setTimeout(() => res({ queued: true }), isOnline() ? CFG.writeWait : 0);
  });
  return Promise.race([done, wait]).then((r) => {
    clearTimeout(timer);
    if (r.queued) {
      // تنبيه لاحق عند وصول التأكيد أو الرفض
      done.then(() => toast('تمت مزامنة تغيير محفوظ'),
        (e) => toast('رُفض تغيير محفوظ عند المزامنة: ' + errText(e), true));
    }
    return r;
  });
}

// للعمليات التي لا تصح دون اتصال (التصفير، الحذف الجماعي...)
export function requireOnline(what) {
  if (isOnline()) return true;
  toast((what || 'هذه العملية') + ' تحتاج اتصالاً بالإنترنت', true);
  return false;
}

/* ============================================================
   الطابور المؤجَّل — لطلبات الويب (بوابات Apps Script مثل ?action=rebuild)
   callDeferred(url): ينفّذ الآن إن أمكن، وإلا يحفظ الرابط ويعيد المحاولة عند
   عودة الاتصال — بعد انتهاء مزامنة كتابات Firestore المعلّقة (ليُبنى الموقع على الجديد).
   الروابط المكررة تُدمج (طلب rebuild واحد يكفي عن عشرة).
   ============================================================ */
const DEFER_KEY = 's24_admin_deferred';
function readDeferred() { try { return JSON.parse(lsGet(DEFER_KEY) || '[]'); } catch (e) { return []; } }
function writeDeferred(a) { lsSet(DEFER_KEY, JSON.stringify(a)); emit(); }
function addDeferred(url) { const a = readDeferred(); if (!a.includes(url)) { a.push(url); writeDeferred(a); } }

// انتظار مزامنة الكتابات المعلّقة بحدّ أقصى (حتى لا يتعلّق الطلب على شبكة ضعيفة)
function settleWrites(ms) {
  return Promise.race([waitForPendingWrites(db), new Promise((r) => setTimeout(r, ms || 10000))]);
}

async function fetchJson(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (j && j.error) throw new Error(j.error);
  return j;
}

// تُرجع { ok: true, data } أو { deferred: true }
export async function callDeferred(url) {
  if (!isOnline()) { addDeferred(url); return { deferred: true }; }
  try {
    if (pending) await settleWrites();
    return { ok: true, data: await fetchJson(url) };
  } catch (e) {
    if (e instanceof TypeError) { addDeferred(url); return { deferred: true }; }   // خطأ شبكة
    throw e;                                                                         // خطأ من البوابة نفسها
  }
}

let flushing = false;
export async function flushDeferred() {
  if (flushing || !isOnline()) return;
  const list = readDeferred();
  if (!list.length) return;
  flushing = true;
  try {
    await settleWrites(20000);
    for (const url of list) {
      try { await fetchJson(url); writeDeferred(readDeferred().filter((u) => u !== url)); }
      catch (e) { if (e instanceof TypeError) break; writeDeferred(readDeferred().filter((u) => u !== url)); }
    }
    if (!readDeferred().length) toast('اكتملت المزامنة المؤجلة');
  } finally { flushing = false; }
}

window.addEventListener('online', () => { emit(); flushDeferred(); });
window.addEventListener('offline', emit);
// محاولة عند بدء التطبيق (لما بقي من جلسة سابقة)
setTimeout(flushDeferred, 1500);
