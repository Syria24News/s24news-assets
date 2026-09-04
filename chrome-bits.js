/* ============================================================
   S24News — عناصر الهيدر والفوتر: زر العودة للأعلى،
   أيقونات التواصل العلوية، شريط الأخبار الثابت
   (ثلاث كتل متلاصقة دُمجت بترتيبها الأصلي)
   ============================================================ */

/* ===================== زر العودة للأعلى ===================== */
    document.addEventListener("DOMContentLoaded", function() {
        var progressWrap = document.getElementById('progress-wrap');
        
        if(progressWrap) {
            var offset = 100; // المسافة التي يظهر بعدها الزر (100 بكسل)
            
            window.addEventListener('scroll', function() {
                if (window.scrollY > offset) {
                    progressWrap.classList.add('active-progress');
                } else {
                    progressWrap.classList.remove('active-progress');
                }
            });
        }
    });

    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

/* ===================== أيقونات التواصل العلوية ===================== */
document.addEventListener("DOMContentLoaded", function() {
    // قائمة الأيقونات المعرفة مسبقاً
    const icons = {
        'فيسبوك': '<svg class="top-icon" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
        'تويتر': '<svg class="top-icon" viewBox="0 0 24 24"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>',
        'اكس': '<svg class="top-icon" viewBox="0 0 24 24"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>',
        'يوتيوب': '<svg class="top-icon" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>',
        'انستغرام': '<svg class="top-icon" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>',
        'واتساب': '<svg class="top-icon" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>',
        'تيليجرام': '<svg class="top-icon" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
        'سناب شات': '<svg class="top-icon" viewBox="0 0 24 24"><path d="M16.6 5.82C16.1 5.2 14.82 5 12 5s-4.1.2-4.6.82c-.6.76-.28 2.12.3 2.82.52.62.2 1.48-.3 1.95-.5.44-2.3 1.2-2.3 3.03 0 1.05.62 1.9 1.5 2.5 0 .4-.2 1.05-.6 1.35-.6.44-1.7.5-2 .5-.26 0-.5.2-.5.5 0 .4 1.2 1.4 3 1.4 1.05 0 2-.45 2.5-.6.55-.15 1.1-.05 1.6.2.7.35 1.4.35 2 .35.5 0 1.2 0 1.9-.35.5-.25 1.05-.35 1.6-.2.5.15 1.45.6 2.5.6 1.8 0 3-1 3-1.4 0-.3-.24-.5-.5-.5-.3 0-1.4-.06-2-.5-.4-.3-.6-.95-.6-1.35.88-.6 1.5-1.45 1.5-2.5 0-1.83-1.8-2.59-2.3-3.03-.5-.47-.82-1.33-.3-1.95.58-.7.9-2.06.3-2.82z"/></svg>',
        'تيك توك': '<svg class="top-icon" viewBox="0 0 24 24"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5v4a9 9 0 0 1-5-5v6a8 8 0 1 1-8-8z"/></svg>',

'واتساب': '<svg class="top-icon" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',

        'لينكد إن': '<svg class="top-icon" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>'
    };

    const socialLinks = document.querySelectorAll('.top-social-icons ul.social-list-ul li a');
    socialLinks.forEach(link => {
        const titleSpan = link.querySelector('.social-text-hidden');
        if (titleSpan) {
            const platformName = titleSpan.textContent.trim();
            if (icons[platformName]) {
                link.innerHTML = icons[platformName] + link.innerHTML;
            } else {
                titleSpan.style.display = 'block';
            }
        }
    });
});

/* ===================== شريط الأخبار الثابت (sy-static-box) ===================== */
// =========================================================
// 🟢 1. كود شريط الأخبار (sy-static-box) 🟢
// =========================================================
document.addEventListener("DOMContentLoaded", function() {
    const feedContainer = document.getElementById('sy-static-feed');

    if(feedContainer){
        if(typeof getSkeletonHTML === 'function') {
            feedContainer.innerHTML = getSkeletonHTML('simple');
        } else {
            feedContainer.innerHTML = '<div style="padding:15px; text-align:center;">جاري التحميل...</div>';
        }

        // 🆕 يبحث في دفعات متتالية حتى يجد 7 أخبار حقيقية (غير موسوعية) أو يصل لسقف أمان
        function fetchTickerBatch(startIndex, collected, totalChecked) {
            var batchSize = 15;
            var url = '/feeds/posts/summary?alt=json&max-results=' + batchSize + '&start-index=' + startIndex;
            return fetch(url).then(function(r){ return r.json(); }).then(function(data){
                var entries = (data.feed && data.feed.entry) || [];
                entries.forEach(function(entry){
                    var isGlossary = (entry.category || []).some(function(cat){
                        return cat.term === 'الموسوعة';
                    });
                    if (!isGlossary) collected.push(entry);
                });
                totalChecked += entries.length;
                if (collected.length >= 7 || entries.length === 0 || totalChecked >= 60) {
                    return collected;
                }
                return fetchTickerBatch(startIndex + batchSize, collected, totalChecked);
            });
        }

        fetchTickerBatch(1, [], 0)
        .then(function(finalEntries){
            let html = '';
            finalEntries.slice(0, 7).forEach(function(entry){
                let title = entry.title.$t;
                let link = '';
                for (let i = 0; i < entry.link.length; i++) {
                    if (entry.link[i].rel === 'alternate') {
                        link = entry.link[i].href;
                        break;
                    }
                }
                html += `<a class="sy-news-link" href="${link}">${title}</a>`;
            });
            feedContainer.innerHTML = html || '<div style="padding:15px; text-align:center;">لا توجد أخبار</div>';
        })
        .catch(err => {
            feedContainer.innerHTML = '<div style="padding:15px; text-align:center; color:red;">خطأ في التحميل</div>';
        });
    }
});
