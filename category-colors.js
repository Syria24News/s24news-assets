/* ============================================================
   S24News — ألوان الأقسام: قائمة الأقسام الثمانية + تلوين موحّد
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ملاحظة ترتيب: الجزء 1 يُنشئ window.S24_CATEGORY_COLORS
   والجزء 2 يقرؤه — لا تعكس ترتيبهما
   ============================================================ */

/* ===================== 1) قائمة الأقسام الثمانية ===================== */
/* --- كود تشغيل قائمة الـ 8 أقسام الملونة (النسخة المعدلة للمتغيرات المركزية) --- */
document.addEventListener("DOMContentLoaded", function() {
    function runCategoryList() {
    
    // 1. 🎨 خريطة ألوان موحّدة ومشتركة (مصدر حقيقة واحد لكل الموقع)
    window.S24_CATEGORY_COLORS = window.S24_CATEGORY_COLORS || {
        "عاجل": "var(--color-red)",
        "*SW": "var(--color-red)",
        "وثائق ومذكرات": "var(--sy-docs)",
        "مذكرات سياسية": "var(--sy-docs)",
        "صرف العملات والذهب": "var(--sy-gold)",
        "الدوري الإسباني": "var(--sy-orange)",
        "الدوري الإنجليزي": "var(--sy-orange)",
        "الكرة السورية": "var(--sy-orange)",
        "أسعار الدواء": "var(--sy-health-light)",
        "مشافي": "var(--sy-health-light)",
        "ذهب": "var(--sy-gold)",
        "طاقة": "var(--sy-black)",
        "كرة قدم": "var(--sy-spo-sco)",
        "صحة وطب": "var(--sy-health-light)",
        "علوم وتكنولوجيا": "var(--sy-tech)",
        "اقتصاد": "var(--sy-Econ)",
        "رياضة": "var(--sy-sport)",
        "صحة": "var(--sy-health)",
        "تكنولوجيا": "var(--sy-tech)",
        "تعليم": "var(--sy-education)",
        "فنون": "var(--sy-culture)",
        "ثقافة": "var(--sy-culture)",
        "تاريخ": "var(--sy-history)",
        "متفرقات": "var(--sy-Miscellaneous)",
        "مجتمع": "var(--sy-social)",
        "سياسي": "var(--sy-dark-green)",
        "ميدان": "var(--sy-Arena)",
        "الطقس": "var(--sy-weather)",
        "*L": "var(--sy-light-green)",
        "تقارير": "var(--sy-Reports)",
        
        // ============================================================
        // 🆕 نظام الأكواز الجديد (حرف واحد فقط)
        // ============================================================
        "*WN": "var(--sy-INT)",
        "*S": "var(--sy-sport)",
        "*T": "var(--sy-tech)",
        "*E": "var(--sy-Econ)",
        "*AN": "var(--sy-ArabNews)",
        "*H": "var(--sy-health)",
        "*C": "var(--sy-culture)",
        "*D": "var(--sy-education)",
        "*P": "var(--sy-dark-green)",
        "*L": "var(--sy-light-green)",
        "*Sy": "var(--sy-red)",
        "*M": "var(--sy-Miscellaneous)",
        "*Z": "var(--sy-Reports)",
        "*SW": "var(--color-red)",
        
        // ============================================================
        // النظام القديم (حرفان) - يمكن حذفها لاحقاً
        // ============================================================
        "*WN": "var(--sy-INT)",
        
        "عربي": "var(--sy-ArabNews)",
        "العالم العربي": "var(--sy-ArabNews)",
        "منوعات": "var(--sy-purple)",
        "أستراليا المفتوحة": "var(--sy-orange)",
        "رولان غاروس": "var(--sy-orange)",
        "ويمبلدون": "var(--sy-orange)",
        "أمريكا المفتوحة": "var(--sy-orange)",
        "كأس ديفيز": "var(--sy-orange)",
        "تنس": "var(--sy-orange)",
        "مال وأعمال": "var(--sy-Econ)",
        "اقتصاد محلي": "var(--sy-Econ)",
        "عالم": "var(--sy-INT)"
    };
    const categoryColorMap = window.S24_CATEGORY_COLORS;

    const FALLBACK_IMG = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">' +
        '<rect width="300" height="200" fill="#e9e9e9"/>' +
        '<g fill="none" stroke="#9a9a9a" stroke-width="4">' +
        '<rect x="112" y="70" width="76" height="60" rx="8"/>' +
        '</g>' +
        '<circle cx="134" cy="94" r="7" fill="#9a9a9a"/>' +
        '<path d="M112 130l22-20 18 16 20-24 26 32H112z" fill="#9a9a9a"/>' +
        '<text x="150" y="163" font-family="Arial, sans-serif" font-size="13" fill="#9a9a9a" text-anchor="middle">لا توجد صورة</text>' +
        '</svg>'
    );

    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

        const configList = document.querySelectorAll('#custom-cat-config-list li');
    const targetContainer = document.getElementById('custom-category-container');

    if (!configList.length || !targetContainer) {
        if(targetContainer) targetContainer.innerHTML = ''; 
        return;
    }

    const CACHE_KEY = 's24_cat_list_cache_v1';
    const CACHE_EXPIRY_MS = 60 * 60 * 1000; // ساعة واحدة — عدّلها حسب رغبتك

   

    function buildItemHTML(it) {
    // استخدم window.labelMap لتحويل الرموز إلى أسماء جميلة
    const displayLabel = window.labelMap && window.labelMap[it.safeLabel] 
        ? window.labelMap[it.safeLabel] 
        : it.safeLabel;
    
    return `
                <div class="custom-cat-item" style="order:${it.index};" data-cat-last="${it.isLast ? 'true' : 'false'}">
            <div class="cat-item-content">
                <a class="cat-label-row" href="${it.categoryUrl}">
                    <span class="cat-color-box" aria-hidden="true" style="background-color: ${it.colorCode};"></span>
                    <span>${displayLabel}</span>
                </a>
                <h3 class="cat-item-title">
                    <a href="${it.safeLink}">${it.safeTitle}</a>
                </h3>
            </div>
            <a href="${it.safeLink}" class="cat-item-img">
                <img src="${it.img}" alt="${it.safeTitle}" loading="lazy">
            </a>
        </div>
    `;
}

    function renderItems(items) {
        targetContainer.innerHTML = '';
        if (!items || !items.length) {
            targetContainer.innerHTML = '<div class="cat-list-empty">تعذر تحميل الأقسام حالياً، حاول لاحقاً.</div>';
            return;
        }
        items.forEach(function(it) {
            targetContainer.insertAdjacentHTML('beforeend', buildItemHTML(it));
        });
    }

    const cachedItems = window.S24Cache.get(CACHE_KEY, CACHE_EXPIRY_MS);
    if (cachedItems) {
        renderItems(cachedItems);
        return;
    }

    let renderedCount = 0;
    let settledCount = 0;
    const totalCount = configList.length;
    const collectedItems = [];

    function onRequestSettled() {
        settledCount++;
        if (settledCount === totalCount) {
            if (collectedItems.length > 0) {
                window.S24Cache.set(CACHE_KEY, collectedItems);
            } else if (cachedItems && cachedItems.length > 0) {
                renderItems(cachedItems);
            } else if (renderedCount === 0) {
                targetContainer.innerHTML = '<div class="cat-list-empty">تعذر تحميل الأقسام حالياً، حاول لاحقاً.</div>';
            }
        }
    }

    const fetchCategoryPost = (labelName, colorCode, index) => {
        const cleanLabel = labelName.trim();
        const displayLabel = cleanLabel.startsWith('#') ? cleanLabel.substring(1) : cleanLabel;
        const feedUrl = '/feeds/posts/summary/-/' + encodeURIComponent(cleanLabel) + '?alt=json&max-results=1';
        const categoryUrl = '/search/label/' + encodeURIComponent(cleanLabel);

        fetch(feedUrl)
            .then(response => response.json())
            .then(data => {
                if (data.feed && data.feed.entry && data.feed.entry.length > 0) {
                    const entry = data.feed.entry[0];
                    const title = entry.title.$t;
                    
                    let link = '#';
                    entry.link.forEach(l => { if (l.rel === 'alternate') link = l.href; });

                    let img = FALLBACK_IMG;
                    if (entry.media$thumbnail) {
                        img = entry.media$thumbnail.url.replace(/\/s[0-9]+.*?\//, '/w400-h260-c/');
                    }

                    if (renderedCount === 0) {
                        targetContainer.innerHTML = '';
                    }

                                        const it = {
                        index: index,
                        isLast: (index === totalCount - 1),
                        colorCode: colorCode,
                        categoryUrl: escapeHTML(categoryUrl),
                        safeLabel: escapeHTML(displayLabel),
                        safeTitle: escapeHTML(title),
                        safeLink: escapeHTML(link),
                        img: img
                    };

                    targetContainer.insertAdjacentHTML('beforeend', buildItemHTML(it));
                    collectedItems.push(it);
                    renderedCount++;
                }
                onRequestSettled();
            })
            .catch(err => {
                onRequestSettled();
            });
    };

        configList.forEach((item, index) => {
        const label = item.textContent.trim();
        const color = categoryColorMap[label] || '#2980b9';
        fetchCategoryPost(label, color, index);
    });
    } // نهاية دالة runCategoryList

    const catListTargetEl = document.getElementById('custom-category-container');
    if (catListTargetEl && 'IntersectionObserver' in window) {
        const catListObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) { catListObserver.disconnect(); runCategoryList(); }
            });
        }, { rootMargin: '300px' });
        catListObserver.observe(catListTargetEl);
    } else {
        runCategoryList();
    }
});

/* ============ 2) التلوين الموحّد لبقية الموقع ============ */
document.addEventListener("DOMContentLoaded", function() {

    // ============================================================
    // 🎨 خريطة الألوان الموحدة (ربط الأقسام بمتغيرات CSS)
    // ملاحظة: تأكد أن كل وسم ستضعه في الأولويات موجود هنا وله لون
    // ============================================================
    const sectionColors = window.S24_CATEGORY_COLORS || {};

   // ============================================================
    // 📝 قاموس ترجمة الأكواز إلى أسماء واضحة (حرف واحد فقط)
    // ============================================================
    const labelTranslations = {
        "*WN": "أخبار العالم",
        "*S": "رياضة",
        "*T": "تكنولوجيا",
        "*E": "اقتصاد",
        "*AN": "عربي",
        "*H": "صحة",
        "*C": "ثقافة",
        "*D": "تعليم",
        "*P": "سياسي",
        "*L": "محلي",
        "*SW": "سوريا والعالم",
        "*Sy": "سوريا",
        "*M": "منوعات",
        "*Z": "تقارير",
        "*DF":"أفلام وثائقية",
        "الطقس":"الطقس اليوم",
"العملات والذهب":"سعر صرف العملات والذهب",

    };

    /* --- دالة تنظيف النصوص العربية --- */
    function normalizeArabic(text) {
        if (!text) return "";
        return text.trim()
            .replace(/[#_\-\*]/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي');
    }

    /* --- دالة تلوين واختيار الأيقونة الموحدة (6 مستويات) --- */
    function applyUnifiedColors() {
        const allLabels = document.querySelectorAll('.sy-post-meta .sy-meta-label');
        if (allLabels.length === 0) return;

        // 🟢 مصفوفة الأولويات (6 مستويات)
        // الترتيب هنا هو القانون: من الأعلى (1) إلى الأسفل (6)
        const priorityList = [
            
            // 🔥 المستوى 1: عاجل وخطير (يغلب أي شيء)
           
            // 📂 المستوى 2: وثائق ومناطق جغرافية محددة
 
            // 🎯 المستوى 3: تخصصات دقيقة (نيش)
 
            // ⚽ المستوى 4: فروع الأقسام (Broad Sub-categories)
            "أستراليا المفتوحة",
            "ويمبلدون",
            "أمريكا المفتوحة",
            "كأس ديفيز",
            "فنون",
            "نفط",
            "الكرة السورية",
            "مجتمع",
            "العملات والذهب",
 
            // 🏛️ المستوى 5: الأقسام الرئيسية (Main Pillars)
            // ============================================================
            // 🆕 نظام الأكواز الجديد (حرف واحد فقط)
            // ============================================================
            "عربي",
            "*AN",
            "*WN",
            "رياضة",
            "*S",
            "تكنولوجيا",
            "*T",
            "اقتصاد",
            "*E",
            "صحة",
            "*H",
            "صحة وطب",
            "تعليم",
            "*D",
            "ثقافة",
            "*C",
            "سياسي",
            "*P",
            "محلي",
            "*L",
            "سوريا والعالم",
            "*SW",
            "الطقس",
            
            "سوريا",
            "*Sy",
            "منوعات",
            "*M",
            "تقارير",
            "*Z",
            "مال وأعمال",
 
            // 🌍 المستوى 6: تصنيفات عامة وشاملة (الأضعف)
            // ============================================================
            "سياسي",
            "محلي",
            "سوريا والعالم",
            "تقارير",
            "عالم",
            "رياضة",
            "تعليم",
            "اقتصاد",
            "صحة",
            
            "منوعات"
        ];

        let selectedLabel = null;
        let finalColor = "var(--sy-INT)"; 

        // تنفيذ البحث بناءً على المستويات الستة
        for (let priorityKey of priorityList) {
            for (let label of allLabels) {
                const textElement = label.querySelector('.sy-label-text');
                if (!textElement) continue;
                const currentText = normalizeArabic(textElement.innerText);

                // المطابقة
                if (normalizeArabic(priorityKey) === currentText) {
                    selectedLabel = label;
                    
                    // جلب اللون
                    for (let [key, color] of Object.entries(sectionColors)) {
                        if (normalizeArabic(key) === currentText) {
                             finalColor = color;
                        }
                    }
                    break; 
                }
            }
            if (selectedLabel) break; // وجدنا الأولوية الأعلى.. توقف فوراً
        }

        // خطة احتياطية: إذا لم نجد أي وسم من القائمة، خذ أي وسم ملون متوفر
        if (!selectedLabel) {
            for (let label of allLabels) {
                const textElement = label.querySelector('.sy-label-text');
                if (!textElement) continue;
                const currentText = normalizeArabic(textElement.innerText);

                for (let [key, color] of Object.entries(sectionColors)) {
                    if (normalizeArabic(key) === currentText) {
                        selectedLabel = label;
                        finalColor = color;
                        break;
                    }
                }
                if (selectedLabel) break;
            }
        }

        // تطبيق التغييرات
        if (selectedLabel) {
            selectedLabel.style.removeProperty('display');
            selectedLabel.style.setProperty('display', 'flex', 'important'); 
            
            const genericSquare = selectedLabel.querySelector('.sy-generic-square');
            if (genericSquare && 
                !genericSquare.classList.contains('country-flag') && 
                !genericSquare.classList.contains('syria-flag-icon') && 
                !genericSquare.classList.contains('all-news-logo')) {
                
                genericSquare.style.setProperty('--page-color', finalColor);
                genericSquare.style.setProperty('background-color', finalColor, 'important');
                genericSquare.style.setProperty('border-color', finalColor, 'important');
            }

             // ترجمة الوسم من الأكواز إلى الأسماء الواضحة
             const labelTextEl = selectedLabel.querySelector('.sy-label-text');
             if (labelTextEl) {
            const originalText = labelTextEl.innerText.trim();
            const translatedText = labelTranslations[originalText] || originalText;
            labelTextEl.innerText = translatedText;
            }

            const bcName = document.getElementById('bc-category-name');
            const bcLink = document.getElementById('bc-category-link');
            if (bcName && bcLink) {
                const labelTextEl = selectedLabel.querySelector('.sy-label-text');
                if (labelTextEl) bcName.innerText = labelTextEl.innerText.trim();
                bcLink.href = selectedLabel.getAttribute('href');
            }
        }
    }

        // التنفيذ
    applyUnifiedColors();
});
