/* ============================================================
   S24News — نواة لوحة التحكم (admin/js/core.js)
   الإصدار 1.0 — 9 أكتوبر 2026
   مشترك بين كل الوحدات: إعداد Firebase، الدخول، الأدوات العامة، التنبيهات.
   كل وحدة جديدة (الخبر العاجل، الخبر الهام، التغطية الحية...) تستورد من هذا الملف فقط.
   ============================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc,
  writeBatch, query, where, orderBy, limit, serverTimestamp, Timestamp }
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
  tz: 'Asia/Damascus'
};

export const app = initializeApp(CFG.firebase);
export const auth = getAuth(app);
export const db = getFirestore(app);

// إعادة تصدير دوال Firebase حتى تستورد الوحدات من مكان واحد
export { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc,
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
