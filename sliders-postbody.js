/* ============================================================
   S24News — سلايدرات الأسهم الأفقية + تنسيق متن المقالة
   (كتلتان متلاصقتان دُمجتا بترتيبهما الأصلي)
   ============================================================ */

/* =============== 1) سلايدرات الأسهم الأفقية =============== */
document.addEventListener("DOMContentLoaded", function() {

    // دالة موحدة لتشغيل الأسهم فقط (بدون سحب بالماوس)
    function setupScrollSlider(containerId, rightBtnId, leftBtnId) {
        const container = document.getElementById(containerId);
        const btnRight = document.getElementById(rightBtnId);
        const btnLeft = document.getElementById(leftBtnId);

        if (container) {

            // دالة لحساب مسافة التحرك بذكاء
            function getStepSize() {
                const item = container.querySelector('.sy-standard-pill');
                // التحرك بمقدار عرض عنصر واحد + المسافة، أو 150 بكسل كبديل
                return item ? item.offsetWidth + 15 : 150;
            }
            
            // تفعيل أزرار الأسهم (للكمبيوتر وللقوائم التي تظهر فيها الأسهم)
            if (btnLeft && btnRight) {
                
                // السهم الأيسر: يحرك لليمين (للمحتوى العربي)
                btnLeft.onclick = function() {
                    container.scrollBy({ left: getStepSize(), behavior: 'smooth' });
                };
                
                // السهم الأيمن: يحرك لليسار
                btnRight.onclick = function() {
                    container.scrollBy({ left: -getStepSize(), behavior: 'smooth' });
                };
            }
            
            // ❌ تم حذف كود السحب بالماوس (mousedown, mousemove...) من هنا
            // ✅ التمرير باللمس في الموبايل يعمل تلقائياً بفضل CSS (overflow-x: auto)
        }
    }

    // === تشغيل الأقسام ===
    
    // 1. القائمة العلوية
    setupScrollSlider('topMenuScrollContainer', 'topMenuBtnRight', 'topMenuBtnLeft');

    // 2. شريط الرياضة
    setupScrollSlider('sportScrollContainer', 'sportBtnRight', 'sportBtnLeft');

});

/* =============== 2) تنسيق متن المقالة =============== */
document.addEventListener("DOMContentLoaded", function() {
    // 1. التأكد أننا داخل صفحة تعرض محتوى
    if (!document.body.classList.contains('item-page')) return;

    // ============================================================
    // 🚀 الفلتر الجذري: استثناء الصفحات الثابتة (مثل: من نحن، اتصل بنا)
    // ============================================================
    // جميع الصفحات الثابتة في بلوجر تحتوي على "/p/" في الرابط الخاص بها
    if (window.location.pathname.indexOf('/p/') > -1) {
        return; // ⛔ خروج: هذه صفحة ثابتة، لا تضف المعين الأخضر
    }

    // ============================================================
    // 🛑 الفلتر الذكي: استثناء صفحات الطقس والعملات
    // ============================================================
    var bannedWords = [
        "الطقس", 
        "صرف العملات والذهب"
    ];

    var pageContent = document.title + " " + decodeURIComponent(window.location.href);

    var specialElements = document.querySelectorAll('.post-labels a, .sy-post-meta a, .sy-clean-text, .sy-section-title-text');
    specialElements.forEach(function(el) {
        pageContent += " " + el.textContent.trim();
    });

    for (var i = 0; i < bannedWords.length; i++) {
        if (pageContent.indexOf(bannedWords[i]) > -1) {
            return; // ⛔ خروج: هذه صفحة مستثناة، لن يتم إضافة المعين
        }
    }
    // ============================================================

    // 2. كود إضافة المعين
    const postBody = document.querySelector('[id^="post-body-"]');
    if (!postBody) return;

    function addShapeToLastText(node) {
        const children = Array.from(node.childNodes).reverse();

        for (let child of children) {
            if (child.nodeType === 1) { // عنصر HTML
                const tagName = child.tagName.toLowerCase();
                const classList = child.className.toLowerCase();
                
                // استثناء العناصر غير النصية
                const isMediaOrSocial = 
                    ['script', 'style', 'iframe', 'video', 'object', 'embed', 'noscript', 'blockquote', 'canvas', 'img', 'button', 'table', 'ul', 'ol'].includes(tagName) ||
                    classList.includes('twitter-tweet') || 
                    classList.includes('instagram-media') || 
                    classList.includes('tiktok-embed') || 
                    classList.includes('fb-post') || 
                    classList.includes('fb-video') ||
                    child.classList.contains('post-footer') ||
                    child.classList.contains('rt-album-parent') || 
                    child.classList.contains('rt-album-wrapper') || 
                    child.classList.contains('thumb-nav-btn');

                if (isMediaOrSocial) continue;

                if (addShapeToLastText(child)) return true;
            } 
            else if (child.nodeType === 3) { // نص (Text Node)
                if (child.nodeValue.trim().length > 0) {
                    const diamond = document.createElement('span');
                    diamond.className = 'sy-end-diamond';
                    
                    if (child.nextSibling) {
                        child.parentNode.insertBefore(diamond, child.nextSibling);
                    } else {
                        child.parentNode.appendChild(diamond);
                    }
                    return true; 
                }
            }
        }
        return false;
    }

    if (!document.body.classList.contains('s24-glossary-article')) {
        addShapeToLastText(postBody);
    }
});
