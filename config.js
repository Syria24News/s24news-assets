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

/* ============ 2) قاموس الوسوم — المصدر الوحيد لكل ما يخص الأقسام ============
   كل وسم: [الاسم القصير, الاسم الكامل, متغيّر اللون, الوصف]
     • القصير: شارة المقال ومسار التنقل
     • الكامل: رأس صفحة القسم وعنوان التبويب وقائمة الأقسام
     • اللون: متغيّر CSS من القالب (cat.xxx ← --sy-xxx)، ودرجته تُغيَّر من «تخصيص» بلوغر.
       المتغيّر مع لون احتياطي («--sy-docfilms, #5E35B1») يعمل حتى قبل إضافة المتغيّر إلى القالب.
     • الوصف: السطر تحت رأس صفحة القسم
   أي تعديل على اسم قسم أو لونه أو وصفه يكون هنا فقط —
   category-colors.js وlabel-header.js يقرآن من هذا القاموس.
   (18 أكتوبر 2026: توحيد بعد أن كانت الأسماء والألوان مكررة ومتضاربة في ثلاثة ملفات) */
window.S24_TAGS = window.S24_TAGS || {
  '*Sy': ['سوريا',         'أخبار سوريا',      '--sy-red',                 'جميع أخبار سوريا المحلية والدولية'],
  '*L':  ['محلي',          'الشأن المحلي',     '--sy-light-green',         'أخبار محلية ومستجدات الساحة السورية'],
  '*P':  ['سياسي',         'سياسة',            '--sy-dark-green',          'تحليل الأحداث السياسية والقرارات'],
  '*SW': ['سوريا والعالم', 'سوريا والعالم',    '--sy-syworld, #8E1B2E',    'تغطية شاملة لسوريا والعالم'],
  '*AN': ['عربي',          'العالم العربي',    '--sy-ArabNews',            'أخبار العالم العربي والقضايا العربية'],
  '*WN': ['عالمي',         'أخبار العالم',     '--sy-INT',                 'تغطية شاملة لأبرز الأحداث في العالم'],
  '*E':  ['اقتصاد',        'اقتصاد',           '--sy-Econ',                'متابعة الأسواق والاقتصاد والاستثمارات'],
  '*S':  ['رياضة',         'الرياضة والألعاب', '--sy-sport',               'آخر أخبار الرياضة والدوريات والبطولات'],
  '*M':  ['منوعات',        'منوعات',           '--sy-purple',              'موضوعات متنوعة ومتفرقة مهمة'],
  '*Z':  ['تقارير',        'تقارير وتحقيقات',  '--sy-Reports',             'تقارير شاملة وتحقيقات استقصائية'],
  '*C':  ['ثقافة',         'الصحيفة الثقافية', '--sy-culture',             'أخبار الثقافة والفنون والآداب'],
  '*D':  ['تعليم',         'تربية وتعليم',     '--sy-education',           'أخبار التعليم والدراسة والمناهج'],
  '*H':  ['صحة',           'الصحة والعلوم',    '--sy-health',              'أخبار الصحة والطب والعافية'],
  '*T':  ['تكنولوجيا',     'علوم وتكنولوجيا',  '--sy-tech',                'أخبار التكنولوجيا والابتكارات الحديثة'],
  '*U':  ['وثائق',         'وثائق ومذكرات',    '--sy-docs',                'وثائق تاريخية ومذكرات وشهادات سياسية'],
  '*DF': ['وثائقي',        'أفلام وثائقية',    '--sy-docfilms, #5E35B1',   'أفلام وثائقية مختارة عن سوريا والعالم'],
  '*A':  ['عاجل',          'الأخبار العاجلة',  '--color-red',              'آخر الأخبار العاجلة والمستجدات المهمة']
};
// خريطة حقل واحد لكل الوسوم: S24TagNames('short' | 'full' | 'color' | 'desc') ← { '*S': ..., ... }
// ('color' يُرجع اسم المتغيّر كما هو، مثل '--sy-sport'؛ يُلفّ بـ var() عند الاستخدام)
window.S24TagNames = function (kind) {
  var i = { short: 0, full: 1, color: 2, desc: 3 }[kind];
  if (i === undefined) i = 1;
  var out = {};
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
