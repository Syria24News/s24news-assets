/* ============================================================
   S24News — رأس صفحة التسمية (عنوان القسم في صفحات /search/label/)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

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
                return;
            }
            
            // أسماء الأقسام الكاملة من القاموس الموحد في config.js
            var labelTranslations = window.S24TagNames ? window.S24TagNames('full') : {};
            
            // ألوان الأقسام وأوصافها من القاموس الموحد في config.js
            var colorMap = window.S24TagNames ? window.S24TagNames('color') : {};
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
