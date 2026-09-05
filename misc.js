/* ============================================================
   S24News — متفرقات: التحميل الكسول للصور، قائمة اللغات،
   إخفاء وسوم محددة
   (ثلاث كتل متلاصقة دُمجت بترتيبها الأصلي)
   ============================================================ */

/* ===================== التحميل الكسول للصور ===================== */
document.addEventListener("DOMContentLoaded", function() {
    // استهداف جميع الصور داخل الموقع (خاصة داخل المقالات)
    const lazyImages = document.querySelectorAll('.post-body img, .sy-v-img, .main-figure__img, .grid-item img');
    
    if ('IntersectionObserver' in window) {
        let imageObserver = new IntersectionObserver(function(entries, observer) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    let image = entry.target;
                    // تفعيل التحميل فقط عند وصول الزائر للصورة
                    if (image.dataset.src) {
                        image.src = image.dataset.src;
                    }
                    image.setAttribute('loading', 'lazy');
                    imageObserver.unobserve(image);
                }
            });
        }, { rootMargin: "200px 0px" }); // نبدأ التحميل قبل وصول الزائر للصورة بـ 200 بكسل لضمان السلاسة

        lazyImages.forEach(function(image) {
            imageObserver.observe(image);
            // تطبيق السمة الافتراضية للمتصفحات الحديثة
            if (!image.hasAttribute('loading')) {
                image.setAttribute('loading', 'lazy');
            }
        });
    } else {
        // دعم المتصفحات القديمة
        lazyImages.forEach(function(image) {
            image.setAttribute('loading', 'lazy');
        });
    }
});

/* ===================== قائمة اللغات المنسدلة ===================== */
// 🌍 كود تشغيل القائمة المنسدلة للغات
document.addEventListener("DOMContentLoaded", function() {
    const langSelector = document.getElementById('langSelector');
    const langToggler = document.getElementById('langToggler');

    if (langToggler && langSelector) {
        // 1. فتح وإغلاق القائمة عند النقر على الزر
        langToggler.addEventListener('click', function(e) {
            e.preventDefault(); // منع أي سلوك افتراضي
            e.stopPropagation(); // منع إغلاق القائمة فور فتحها
            langSelector.classList.toggle('active');
        });

        // 2. إغلاق القائمة عند النقر في أي مكان آخر بالشاشة
        document.addEventListener('click', function(e) {
            // إذا كانت القائمة مفتوحة والنقرة لم تكن بداخلها، قم بإغلاقها
            if (langSelector.classList.contains('active') && !langSelector.contains(e.target)) {
                langSelector.classList.remove('active');
            }
        });
        
        // 3. إغلاق القائمة عند الضغط على زر ESC في الكيبورد (للحواسيب)
        document.addEventListener('keydown', function(e) {
            if (e.key === "Escape" && langSelector.classList.contains('active')) {
                langSelector.classList.remove('active');
            }
        });
    }
});

/* ===================== إخفاء وسوم محددة ===================== */
document.addEventListener("DOMContentLoaded", function() {
    // --- [منطقة التعديل] ---
    // أضف هنا أسماء التاغات التي تريد إخفاءها بالضبط (بين علامتي تنصيص وفواصل)
    var customHiddenTags = ["WH", "كرة سلة" ,"الطقس" ,"رياضات قتالية" ,"مصارعة" ,"تقارير إنسانية" ,"لاجئون" ,"رياضة جماعية" ,"كرة قدم" ,"إنساني", ];
    // -----------------------

    // استهداف جميع روابط التاغات في الموقع
    var allLabels = document.querySelectorAll('a[rel="tag"], .sy-meta-label, .custom-post-tags a');
    
    allLabels.forEach(function(label) {
        var text = label.innerText.trim();
        
        // التحقق: هل يحتوي على * ؟ أو هل الاسم موجود في القائمة بالأعلى؟
        if (text.indexOf('*') > -1 || customHiddenTags.includes(text)) {
            label.style.display = 'none';
            
            // إخفاء الفاصل بجانب التاغ (إذا وجد)
            if(label.nextElementSibling && label.nextElementSibling.classList.contains('sy-meta-separator')) {
                label.nextElementSibling.style.display = 'none';
            }
        }
    });
});
