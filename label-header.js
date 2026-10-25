/* ============================================================
   S24News — رأس صفحة التسمية (عنوان القسم في صفحات /search/label/)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

/* ------------------------------------------------------------
   تجربة «ترويسة البطاقة» — مؤقتة، لا تعمل إلا بالمعامل ?sh=
   أمثلة:  ?sh=in   ?sh=out   ?sh=in-24   ?sh=out-24-bar   ?sh=off (إلغاء)
   تُحفظ في الجلسة فتبقى أثناء التنقل بين الأقسام والصفحات.
   ------------------------------------------------------------ */
function s24HeaderTest(header) {
    try {
        var m = location.search.match(/[?&]sh=([^&]*)/);
        var v = m ? decodeURIComponent(m[1]).toLowerCase() : null;
        if (v === 'off') { sessionStorage.removeItem('s24_sh'); v = null; }
        else if (v) { sessionStorage.setItem('s24_sh', v); }
        else { v = sessionStorage.getItem('s24_sh'); }
        if (!v || !header) return;

        var t = v.split(/[-_,+ ]/);
        var root = document.documentElement;
        root.setAttribute('data-sh', t.indexOf('out') > -1 ? 'out' : 'in');
        if (t.indexOf('24') > -1) root.setAttribute('data-sh-size', '24');
        if (t.indexOf('bar') > -1) {
            root.setAttribute('data-sh-bar', '1');
            // لون الشريط = لون المربع الفعلي (الأعلام والشعار تبقى بالأخضر الافتراضي)
            var sq = header.querySelector('.sy-generic-square');
            var c = sq ? getComputedStyle(sq).backgroundColor : '';
            if (c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') header.style.setProperty('--sh-color', c);
        }
    } catch (e) {}
}

document.addEventListener("DOMContentLoaded", function() {
    if (window.location.href.indexOf("/search/label/") > -1) {
        try {
            var storiesSection = document.getElementById("Stories_Section") || document.querySelector(".stories-container");
            var blogPostsArea = document.querySelector(".main-container");
            var existingHeader = document.querySelector('.sy-section-header');

            if (existingHeader) {
                if (storiesSection) {
                    storiesSection.insertAdjacentElement('afterend', existingHeader);
                } else if (blogPostsArea) {
                    blogPostsArea.insertAdjacentElement("afterbegin", existingHeader);
                }
                s24HeaderTest(existingHeader);
                return;
            }
            
            // أسماء الأقسام الكاملة من القاموس الموحد في config.js
            var labelTranslations = window.S24TagNames ? window.S24TagNames('full') : {};
            
            // ألوان الأقسام وأوصافها من القاموس الموحد في config.js
            var colorMap = window.S24TagNames ? window.S24TagNames('color') : {};
            // فروع لوحة 24 (تبويب «الأقسام»): لون رأس صفحة التسمية
            var panelBr = window.S24_BRANCHES || {};
            Object.keys(panelBr).forEach(function (k) { colorMap[k] = panelBr[k].color; });
            var descriptionMap = window.S24TagNames ? window.S24TagNames('desc') : {};
            
            var urlParts = window.location.href.split("/search/label/");
            if (urlParts[1]) {
                var tagRaw = urlParts[1].split("?")[0];
                var tagName = decodeURIComponent(tagRaw).replace(/\+/g, " "); 
                var cleanTagName = tagName.replace(/#/g, "");
                
                // 🔴 جديد: ترجمة إذا كان كوداً
                var displayName = labelTranslations[cleanTagName] || cleanTagName;
                var pageColor = colorMap[cleanTagName] || "--sy-green";
                var description = descriptionMap[cleanTagName] || 
                    ("أنت تتصفح آخر الأخبار والمستجدات الخاصة بـ " + displayName);
                
                var headerHTML = `
                    <div class="sy-section-header" id="dynamic-tag-header">
                        <div class="sy-section-title-row">
                            <span class="sy-generic-square" style="--page-color: var(${pageColor});"></span>
                            <h2 class="sy-section-title-text">${displayName}</h2>
                        </div>
                        <div class="sy-section-desc">
                            ${description}
                        </div>
                    </div>
                `;
                
                if (storiesSection) {
                    storiesSection.insertAdjacentHTML('afterend', headerHTML);
                } else if (blogPostsArea) {
                    blogPostsArea.insertAdjacentHTML("afterbegin", headerHTML);
                }
                s24HeaderTest(document.getElementById('dynamic-tag-header'));
            }
        } catch (e) {}
    }
});
