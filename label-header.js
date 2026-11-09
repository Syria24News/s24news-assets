/* ============================================================
   S24News — رأس صفحة التسمية (عنوان القسم في صفحات /search/label/)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   يميّز أيضاً زر الصفحة الحالية في الترويسة (.sy-mosaic-item و.sy-related-btn) في كل الأقسام:
   خلفية بلون الزر، والنص أبيض أو داكن تلقائياً حسب وضوحه على ذلك اللون
   ويضيف علم كل دولة إلى أزرار قائمة الدول العربية (أصناف .flag-* في s24-main.css)
   ============================================================ */

// تمييز زر الصفحة الحالية. يُستدعى قبل حدث load لأن config.js يبدّل بعده الرابط الظاهر إلى الاسم العربي
function s24MarkActiveButton(header) {
    function clean(p) { try { return decodeURIComponent(p).replace(/\/$/, ''); } catch (e) { return p; } }
    var here = clean(location.pathname);
    header.querySelectorAll('a.sy-mosaic-item, a.sy-related-btn').forEach(function (a) {
        if (clean(a.pathname) !== here) return;
        a.classList.add('is-active');
        a.setAttribute('aria-current', 'page');
        var varName = a.classList.contains('sy-mosaic-item') ? '--mosaic-color' : '--sy-green';
        var hex = getComputedStyle(a).getPropertyValue(varName).trim();
        if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
        // اللمعان النسبي: فوق 0.179 يكون النص الداكن أوضح من الأبيض
        var l = [1, 3, 5].map(function (i) {
            var c = parseInt(hex.substr(i, 2), 16) / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        if (0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] > 0.179) a.classList.add('is-active-dark');
    });
}

// علم الدولة قبل اسمها في أزرار قائمة الدول العربية (اسم الزر = اسم الوسم)
function s24AddCountryFlags(header) {
    var flags = {
    'مصر': 'egypt', 'السعودية': 'saudi', 'الإمارات العربية المتحدة': 'uae', 'الأردن': 'jordan',
    'لبنان': 'lebanon', 'العراق': 'iraq', 'فلسطين': 'palestine', 'الكويت': 'kuwait',
    'قطر': 'qatar', 'البحرين': 'bahrain', 'سلطنة عمان': 'oman', 'اليمن': 'yemen',
    'الجزائر': 'algeria', 'المغرب': 'morocco', 'تونس': 'tunisia', 'ليبيا': 'libya',
    'السودان': 'sudan', 'موريتانيا': 'mauritania', 'الصومال': 'somalia', 'جيبوتي': 'djibouti',
    'جزر القمر': 'comoros'
    };
    header.querySelectorAll('a.sy-related-btn').forEach(function (a) {
        var flag = flags[a.textContent.trim()];
        if (!flag) return;
        var icon = document.createElement('span');
        icon.className = 'sy-btn-flag flag-' + flag;
        icon.setAttribute('aria-hidden', 'true');
        a.insertBefore(icon, a.firstChild);
    });
}

document.addEventListener("DOMContentLoaded", function() {
    if (window.location.href.indexOf("/search/label/") > -1) {  
        try {
            var storiesSection = document.getElementById("Stories_Section") || document.querySelector(".stories-container");
            var blogPostsArea = document.querySelector(".main-container");           
            var existingHeader = document.querySelector('.sy-section-header');
            
            if (existingHeader) {
                s24MarkActiveButton(existingHeader);
                s24AddCountryFlags(existingHeader);
                if (storiesSection) {
                    storiesSection.insertAdjacentElement('afterend', existingHeader);
                } else if (blogPostsArea) {
                    blogPostsArea.insertAdjacentElement("afterbegin", existingHeader);
                }
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
            }
        } catch (e) {}
    }
});
