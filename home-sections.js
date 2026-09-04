/* ============================================================
   S24News — أقسام المحتوى في الصفحة الرئيسية
   يعتمد على window.S24Cache المعرَّف في أعلى القالب
   ============================================================ */

document.addEventListener("DOMContentLoaded", function() {

    // ⚡ إعدادات التسريع والتخزين
    const CACHE_TIME = 15 * 60 * 1000; // مدة التخزين: 15 دقيقة (بالمللي ثانية)
    const MAX_POSTS = 4; // عدد المقالات

    // إعدادات الأقسام
    const configThemes = [
        { id: 'theme-col-1', label: '*E', displayTitle: 'اقتصاد' },
        { id: 'theme-col-2', label: '*M', displayTitle: 'منوعات' },
        { id: 'theme-col-3', label: '*H', displayTitle: 'صحة وطب' },
        { id: 'theme-col-4', label: '*D', displayTitle: 'تعليم' }
    ];

    // ⚡ تأجيل التحميل حتى تقترب الأقسام الأربعة من الشاشة بدل تحميلها فوراً
    const themesWrapper = document.querySelector('.news-themes__wrapper');
    if (themesWrapper && 'IntersectionObserver' in window) {
        const themesObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    themesObserver.disconnect();
                    configThemes.forEach(processSection);
                }
            });
        }, { rootMargin: '300px' });
        themesObserver.observe(themesWrapper);
    } else {
        configThemes.forEach(processSection);
    }

    function processSection(conf) {
        const container = document.getElementById(conf.id);
        if(!container) return;

        // تحديث العنوان فوراً
        const titleEl = container.querySelector('.theme-title-text');
        if(titleEl) titleEl.textContent = conf.displayTitle;

        // 1. محاولة الجلب من الذاكرة (للسرعة القصوى)
        const cacheKey = 's24_theme_' + conf.id;
        const cachedData = window.S24Cache.get(cacheKey, CACHE_TIME);

        if (cachedData) {
            // ✅ وجدنا بيانات مخزنة -> ارسمها فوراً
            renderSectionHTML(container, conf, cachedData);
        } else {
            // ❌ لا يوجد تخزين -> اطلب من السيرفر
            fetchDataFromServer(container, conf, cacheKey);
        }
    }

    // دالة جلب البيانات من السيرفر
    function fetchDataFromServer(container, conf, cacheKey) {
        const feedUrl = '/feeds/posts/summary/-/' + encodeURIComponent(conf.label) + '?alt=json&max-results=' + MAX_POSTS;

        fetch(feedUrl)
        .then(res => res.json())
        .then(data => {
            if(data.feed && data.feed.entry) {
                // حفظ البيانات في الذاكرة للمرة القادمة
                window.S24Cache.set(cacheKey, data.feed.entry);
                // رسم البيانات
                renderSectionHTML(container, conf, data.feed.entry);
            } else {
                renderError(container, 'لا توجد مقالات');
            }
        })
        .catch(err => {
            console.error(err);
            renderError(container, 'خطأ في الاتصال');
        });
    }

    // دالة بناء HTML (محسنة للصور)
    function renderSectionHTML(container, conf, entries) {
        const contentArea = container.querySelector('.theme-content-area');
        let html = '';

        // 1. الخبر الرئيسي
        const mainPost = entries[0];
        const mainTitle = mainPost.title.$t;
        const mainLink = getLink(mainPost.link);
        let mainImg = getImgUrl(mainPost, '/w500-h280-c/'); // حجم محسن

        html += `
            <a href="${mainLink}" class="theme-main-post" aria-label="${mainTitle}">
                <img src="${mainImg}" class="theme-main-img" alt="${mainTitle}" loading="lazy" width="500" height="280">
                <h3 class="theme-main-title">${mainTitle}</h3>
            </a>
        `;

        // 2. القائمة الجانبية
        if(entries.length > 1) {
            html += '<ul class="theme-sub-list">';
            for(let i = 1; i < entries.length; i++) {
                const subPost = entries[i];
                html += `
                    <li class="theme-sub-item">
                        <a href="${getLink(subPost.link)}" class="theme-sub-link">${subPost.title.$t}</a>
                    </li>
                `;
            }
            html += '</ul>';
        }

        // 3. الزر
        html += `
            <div class="theme-section__button-block">
                <a href="/search/label/${encodeURIComponent(conf.label)}" class="main-button" style="background-color: #77bd1d !important; color: #fff !important; display:flex !important;">
                    المزيد من الأخبار
                </a>
            </div>
        `;

        // حقن الكود دفعة واحدة لتقليل إعادة الرسم
        requestAnimationFrame(() => {
            contentArea.innerHTML = html;
        });
    }

    // --- دوال مساعدة ---

    function getLink(links) {
        if (!links) return '#';
        const linkObj = links.find(l => l.rel === 'alternate');
        return linkObj ? linkObj.href : '#';
    }

    function getImgUrl(entry, sizeParams) {
        if (entry.media$thumbnail) {
            return entry.media$thumbnail.url.replace(/\/s[0-9]+.*?\//, sizeParams);
        }
        return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e0e0e0"/%3E%3C/svg%3E';
    }

    function renderError(container, msg) {
        container.querySelector('.theme-content-area').innerHTML = `<div style="padding:20px; text-align:center; color:#777;">${msg}</div>`;
    }

});
