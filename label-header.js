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
            
            // 🔴 جديد: قاموس الترجمة
            var labelTranslations = {
                "*A": "البث التلقائي",
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
                "*Sy": "سوريا",
                "*M": "منوعات",
                "*Z": "تقارير",
                "*SW": "سوريا والعالم"
            };
            
            // 🔴 جديد: قاموس الألوان
            var colorMap = {
                "*A": "--color-red",
                "*WN": "--sy-INT",
                "*S": "--sy-sport",
                "*T": "--sy-tech",
                "*E": "--sy-Econ",
                "*AN": "--sy-ArabNews",
                "*H": "--sy-health",
                "*C": "--sy-culture",
                "*D": "--sy-education",
                "*P": "--sy-dark-green",
                "*L": "--sy-light-green",
                "*Sy": "--sy-red",
                "*M": "--sy-Miscellaneous",
                "*Z": "--sy-Reports",
                "*SW": "--color-red"
            };
            
            // 🔴 جديد: قاموس الأوصاف
            var descriptionMap = {
                "*A": "آخر الأخبار العاجلة والمستجدات المهمة",
                "*W": "تغطية شاملة لأبرز الأحداث في العالم",
                "*S": "آخر أخبار الرياضة والدوريات والبطولات",
                "*T": "أخبار التكنولوجيا والابتكارات الحديثة",
                "*E": "متابعة الأسواق والاقتصاد والاستثمارات",
                "*AN": "أخبار العالم العربي والقضايا العربية",
                "*H": "أخبار الصحة والطب والعافية",
                "*C": "أخبار الثقافة والفنون والآداب",
                "*D": "أخبار التعليم والدراسة والمناهج",
                "*P": "تحليل الأحداث السياسية والقرارات",
                "*L": "أخبار محلية ومستجدات الساحة السورية",
                "*Sy": "جميع أخبار سوريا المحلية والدولية",
                "*M": "موضوعات متنوعة ومتفرقة مهمة",
                "*Z": "تقارير شاملة وتحقيقات استقصائية",
                "*SW": "تغطية شاملة لسوريا والعالم"
            };
            
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
