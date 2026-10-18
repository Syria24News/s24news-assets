/* ============================================================
   S24News — الإعدادات العامة (يُحمَّل أولاً قبل كل شيء)
   إعدادات Firebase · formatArabicDate · labelMap وتنظيف العناوين
   ⚠️ سطر استدعاء هذا الملف يجب أن يبقى الأول في القالب
   ============================================================ */

/* ============ 1) إعدادات Firebase + تنسيق التاريخ ============ */
  window.S24_FIREBASE_CONFIG = {
    apiKey: "AIzaSyBD8sDOnDXtWnzLGbGZI-w45OqTKJ6M5KI",
    authDomain: "s24n-views.firebaseapp.com",
    databaseURL: "https://s24n-views-default-rtdb.firebaseio.com",
    projectId: "s24n-views",
    storageBucket: "s24n-views.firebasestorage.app",
    messagingSenderId: "535339260420",
    appId: "1:535339260420:web:11e4d95694df6cc4def351"
  };
 
  // ================================================================================
  // 📅 نظام تحويل التاريخ إلى عربي جميل
  // ================================================================================
    window.formatArabicDate = function(isoDate, includeTime) {
    if (!isoDate || isoDate.trim() === '') return 'غير متوفر';
    
    try {
        const date = new Date(isoDate);
        if (isNaN(date.getTime())) return 'تاريخ غير صحيح';

        const parts = new Intl.DateTimeFormat('en-GB', {
            day: 'numeric', month: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false,
            timeZone: 'Asia/Damascus'
        }).formatToParts(date);

        const get = (type) => parts.find(p => p.type === type).value;
        const dateStr = `${get('day')}/${get('month')}/${get('year')}`;

        if (!includeTime) return dateStr;
        return `${dateStr} ${get('hour')}:${get('minute')} (دمشق)`;
    } catch(e) {
        return isoDate;
    }
};
 
  // ملء التواريخ عند تحميل الصفحة
  document.addEventListener('DOMContentLoaded', function() {
      const pubElement = document.getElementById('pub-iso');
      const updElement = document.getElementById('upd-iso');
      
      if (pubElement) {
          const pubDate = pubElement.textContent.trim();
                    const formattedPub = window.formatArabicDate(pubDate, false);
          const pubDisplay = document.getElementById('published-date');
          if (pubDisplay) {
              pubDisplay.textContent = formattedPub;
              pubDisplay.style.fontWeight = '600';
          }
      }
      
      if (updElement) {
          const updDate = updElement.textContent.trim();
                    const formattedUpd = window.formatArabicDate(updDate, true);
          const updDisplay = document.getElementById('updated-date');
          if (updDisplay) {
              updDisplay.textContent = formattedUpd;
              updDisplay.style.fontWeight = '600';
          }
      }
  });
  // ================================================================================

/* ============ 2) قاموس الوسوم — المصدر الوحيد لأسماء الأقسام ============
   كل وسم: [الاسم القصير (شارة المقال ومسار التنقل), الاسم الكامل (رأس صفحة القسم وعنوان التبويب وقائمة الأقسام)]
   أي تعديل على اسم قسم يكون هنا فقط — category-colors.js وlabel-header.js يقرآن من هذا القاموس.
   (18 أكتوبر 2026: توحيد الأسماء بعد أن كانت مكررة ومتضاربة في ثلاثة ملفات)
   الألوان لا تُعرَّف هنا: مصدرها متغيرات القالب cat.xxx ← --sy-xxx */
window.S24_TAGS = window.S24_TAGS || {
  '*Sy': ['سوريا',          'أخبار سوريا'],
  '*L':  ['محلي',           'الشأن المحلي'],
  '*P':  ['سياسي',          'سياسة'],
  '*SW': ['سوريا والعالم',  'سوريا والعالم'],
  '*AN': ['عربي',           'العالم العربي'],
  '*WN': ['عالمي',          'أخبار العالم'],
  '*E':  ['اقتصاد',         'اقتصاد'],
  '*S':  ['رياضة',          'الرياضة والألعاب'],
  '*M':  ['منوعات',         'منوعات'],
  '*Z':  ['تقارير',         'تقارير وتحقيقات'],
  '*C':  ['ثقافة',          'الصحيفة الثقافية'],
  '*D':  ['تعليم',          'تربية وتعليم'],
  '*H':  ['صحة',            'الصحة والعلوم'],
  '*T':  ['تكنولوجيا',      'علوم وتكنولوجيا'],
  '*U':  ['وثائق',          'وثائق ومذكرات'],
  '*DF': ['وثائقي',         'أفلام وثائقية'],
  '*A':  ['عاجل',           'الأخبار العاجلة']
};
// خريطة الاسم القصير أو الكامل: S24TagNames('short') أو S24TagNames('full') ← { '*S': 'رياضة', ... }
window.S24TagNames = function (kind) {
  var i = kind === 'short' ? 0 : 1, out = {};
  Object.keys(window.S24_TAGS).forEach(function (k) { out[k] = window.S24_TAGS[k][i]; });
  return out;
};
// الأسماء الكاملة متاحة فوراً لكل الأسكريبتات (قائمة الأقسام في category-colors.js تستخدمها)
window.labelMap = window.S24TagNames('full');

/* ============ 3) تنظيف العناوين ============ */
document.addEventListener("DOMContentLoaded", function() {
  
  
  // ══════════════════════════════════════════════════════════════
  // 1️⃣ تنظيف العناصر في الصفحة
  // ══════════════════════════════════════════════════════════════
  var titles = document.querySelectorAll('.sy-section-title-text .sy-clean-text');
  titles.forEach(function(title) {
    var text = title.innerText.trim();
    if (window.labelMap[text]) {
      title.innerText = window.labelMap[text];
    }
  });
  
  // ══════════════════════════════════════════════════════════════
  // 2️⃣ تنظيف عنوان الصفحة في المتصفح
  // ══════════════════════════════════════════════════════════════
  var pageTitle = document.title;
  
  Object.keys(window.labelMap).sort(function(a, b) { return b.length - a.length; }).forEach(function(symbol) {
    if (pageTitle.includes(symbol)) {
      pageTitle = pageTitle.replace(symbol, window.labelMap[symbol]);
    }
  });
  
  document.title = pageTitle;
  
});
