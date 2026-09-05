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

/* ============ 2) خريطة الرموز وتنظيف العناوين ============ */
document.addEventListener("DOMContentLoaded", function() {
  
  // جعل labelMap عام في window ليتمكن كل الأسكريبتات من استخدامه
  window.labelMap = {
    '*Sy': 'سوريا',
    '*L': 'محلي',
    '*P': 'سياسي',
    '*SW':'سوريا والعالم',
    '*AN':'العالم العربي',
    '*WN':'أخبار العالم',
    '*E': 'اقتصاد',
    '*S': 'الرياضة والألعاب',
    '*M': 'منوعات',
    '*Z': 'تقارير',
    '*C': 'الصحيفة الثقافية',
    '*D': 'تربية وتعليم',
    '*DF': 'أفلام وثائقية',
    '*H': 'الصحة والعلوم',
    '*U': 'وثائق ومذكرات',
    // ملاحظة: 'P' مكررة في الأصل، التأكد من القيم الصحيحة
  };
  
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
  
  Object.keys(window.labelMap).forEach(function(symbol) {
    if (pageTitle.includes(symbol)) {
      pageTitle = pageTitle.replace(symbol, window.labelMap[symbol]);
    }
  });
  
  document.title = pageTitle;
  
});
