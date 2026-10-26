/* ============================================================
   S24News — محرّك الشبكات المميزة (الرئيسية + صفحات الأقسام)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر

   الإصدار 2.0 — 26 أكتوبر 2026: التحكم اليدوي بشبكة الرئيسية من لوحة التحكم المركزية
     - قسم «الشبكة المميزة» في اللوحة (ملف HomeGrid.gs) يكتب اختيارك في home-grid.json
       في هذا المستودع، والرئيسية تقرؤه من GitHub Pages: صفر قراءات Firestore وصفر Apps Script.
     - الخانة 1 = الخبر الكبير، 2–5 = الأربعة تحته. الخانة غير المختارة تُملأ آلياً بأحدث مقالات *Fa
       (بلا تكرار مقالة مثبّتة). ملف فارغ أو تعذّرت قراءته = الشبكة آلية بالكامل كما كانت.
     - شكل الملف: { "v":1, "updated":"…", "slots": { "1": { "t":"العنوان", "u":"الرابط", "img":"الصورة" }, … } }
     - شبكة صفحات الأقسام لا تتأثر: آلية دائماً.
   ============================================================ */

// ==========================================
// 5. Special Grids Engine (مصدر موحّد - الرئيسية + صفحات الأقسام)
// ==========================================
document.addEventListener("DOMContentLoaded", function() {

    // 📋 كل شبكة مميزة (رئيسية أو قسم) = عنصر واحد هنا فقط
    const SPECIAL_GRIDS_CONFIG = [
        {
            // شبكة "مختارات" في الرئيسية
            containerId: 'special-news-grid',
            cacheKey: 's24_special_grid_v2',
            // اختيارك من لوحة التحكم (قسم «الشبكة المميزة»)؛ يُقرأ من GitHub Pages مجاناً
            pinsUrl: 'https://syria24news.github.io/s24news-assets/home-grid.json',
            titleElId: 'grid-label-title',
            getLabel: function() {
                const labelWidget = document.getElementById('Special_Grid_Label');
                let labelName = "*Fa"; // الاسم الافتراضي للشبكة — يعمل حتى بعد حذف ودجت Special_Grid_Label
                if (labelWidget) {
                    const contentDiv = labelWidget.querySelector('.widget-content');
                    if (contentDiv && contentDiv.textContent.trim() !== "") {
                        labelName = contentDiv.textContent.trim();
                    }
                }
                return labelName;
            }
        },
        {
            // شبكة "أهم أخبار القسم" في صفحات التصنيفات
            containerId: 'category-special-grid',
            cacheKey: 's24_special_grid_category_v2',
            wrapperId: 'category-grid-wrapper',
            removeDuplicates: true,
            getLabel: function(el) {
                return el.getAttribute('data-current-label');
            }
        }
    ];

    const CACHE_DURATION = 2 * 60 * 1000; // تحديث كل دقيقتين

    SPECIAL_GRIDS_CONFIG.forEach(initOneGrid);

    function initOneGrid(cfg) {
        const gridContainer = document.getElementById(cfg.containerId);
        if (!gridContainer) return;

        const labelName = cfg.getLabel(gridContainer);
        if (!labelName) return;

        if (cfg.titleElId) {
            const gridTitle = document.getElementById(cfg.titleElId);
            if (gridTitle) gridTitle.textContent = labelName;
        }

        const cachedData = window.S24Cache.get(cfg.cacheKey, CACHE_DURATION);

        function triggerLoad() {
            if (cachedData) {
                renderGrid(cachedData);
                fetchGridData(true);
            } else {
                if (typeof getSkeletonHTML === 'function') gridContainer.innerHTML = getSkeletonHTML('grid');
                fetchGridData(false);
            }
        }

        if ('IntersectionObserver' in window) {
            const gridObserver = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        gridObserver.disconnect();
                        triggerLoad();
                    }
                });
            }, { rootMargin: '300px' });
            gridObserver.observe(gridContainer);
        } else {
            triggerLoad();
        }

        function fetchGridData(isSilent) {
            // مع ملف التثبيت نجلب 10 من *Fa احتياطاً لما يُستبعد منها لأنه مثبّت
            const feedUrl = '/feeds/posts/summary/-/' + encodeURIComponent(labelName) + '?alt=json&max-results=' + (cfg.pinsUrl ? 10 : 5);

            Promise.all([
                // فشل الخلاصة لا يُسقط المثبّت: تُعرض الخانات المثبّتة وحدها
                fetch(feedUrl).then(res => {
                    if (!res.ok) throw new Error("HTTP error " + res.status);
                    return res.json();
                }).catch(err => { console.error(err); return {}; }),
                fetchPins()
            ])
            .then(([data, pins]) => {
                const auto = (data.feed && data.feed.entry ? data.feed.entry : []).map(entryToItem);
                const items = mergeItems(pins, auto);
                if (items.length > 0) {
                    window.S24Cache.set(cfg.cacheKey, items);
                    if (!isSilent || JSON.stringify(items) !== JSON.stringify(cachedData)) {
                         renderGrid(items);
                    }
                } else {
                    handleEmpty(isSilent, 'تأكد من اسم التسمية: ' + labelName);
                }
            })
            .catch(err => {
                console.error(err);
                handleEmpty(isSilent, 'لا توجد مقالات بتسمية (' + labelName + ')');
            });
        }

        // ملف التثبيت: أي فشل (غير موجود، شبكة، صيغة) = لا تثبيت، والشبكة آلية
        // ?t= يتغيّر كل دقيقة فلا يبقى اختيار قديم في كاش المتصفح
        function fetchPins() {
            if (!cfg.pinsUrl) return Promise.resolve({});
            return fetch(cfg.pinsUrl + '?t=' + Math.floor(Date.now() / 60000))
                .then(res => res.ok ? res.json() : {})
                .then(j => (j && j.slots && typeof j.slots === 'object') ? j.slots : {})
                .catch(() => ({}));
        }

        // الخانات 1–5: المثبّت في خانته، والباقي بالترتيب من أحدث *Fa غير المثبّتة
        function mergeItems(pins, auto) {
            const pinned = {}, used = {};
            for (let k = 1; k <= 5; k++) {
                const p = pins[String(k)];
                if (p && p.u && p.t && !used[cleanUrl(p.u)]) {
                    pinned[k] = { title: String(p.t), link: String(p.u), img: String(p.img || '') };
                    used[cleanUrl(p.u)] = true;
                }
            }
            const rest = auto.filter(it => !used[cleanUrl(it.link)]);
            const out = [];
            for (let k = 1; k <= 5; k++) {
                const it = pinned[k] || rest.shift();
                if (it) out.push(it);
            }
            return out;
        }

        function handleEmpty(isSilent, msg) {
            if (isSilent) return;
            if (cfg.wrapperId) {
                const wrapper = document.getElementById(cfg.wrapperId);
                if (wrapper) wrapper.style.display = 'none';
            } else {
                gridContainer.innerHTML = `<div style="padding:40px; text-align:center; color:#888;">${msg}</div>`;
            }
        }

        function renderGrid(items) {
            let htmlMain = '';
            let htmlSub = '<div class="sub-grid">';

            items.forEach((item, i) => {
                const title = esc(item.title);
                const link = esc(item.link);
                const imgRes = (i === 0) ? '/w720-h405-c/' : '/w348-h196-c/';
                const imgSize = (i === 0) ? 'width="720" height="405"' : 'width="348" height="196"';
                const loadingAttr = (i === 0) ? 'fetchpriority="high"' : 'loading="lazy"';

                let img = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e0e0e0"/%3E%3C/svg%3E';
                if (item.img) {
                    img = item.img.replace(/\/s[0-9]+.*?\//, imgRes);
                }

                const itemHTML = `
                    <div class="grid-item ${i === 0 ? 'main-story' : 'small-story'}" onclick="window.location.href='${link}'" role="link" tabindex="0">
                        <img src="${img}" alt="${title}" ${imgSize} ${loadingAttr}>
                        <div class="grid-content">
                            <h3 class="grid-title">${title}</h3>
                        </div>
                    </div>
                `;

                if (i === 0) htmlMain = itemHTML;
                else htmlSub += itemHTML;
            });

            htmlSub += '</div>';
            gridContainer.innerHTML = htmlMain + htmlSub;

            if (cfg.removeDuplicates) {
                removeDuplicatePostsFromList(items);
            }
        }
    }

    // مقالة الخلاصة ← { title, link, img } (الشكل نفسه لمقالات الخلاصة والمثبّتة)
    function entryToItem(entry) {
        const l = (entry.link || []).find(k => k.rel === 'alternate');
        return {
            title: entry.title.$t,
            link: l ? l.href : '#',
            img: entry.media$thumbnail ? entry.media$thumbnail.url : ''
        };
    }

    // العنوان والرابط يُدرجان في HTML: تهريب الرموز الخاصة (علامات الاقتباس خاصة)
    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    }

    function cleanUrl(u) { return String(u || '').split('?')[0].split('#')[0]; }

    // دالة مشتركة: إخفاء المقالات المكررة من القائمة العادية أسفل الصفحة
    function removeDuplicatePostsFromList(items) {
        const featuredLinks = items.map(it => cleanUrl(it.link));

        const regularPosts = document.querySelectorAll('.blog-posts .post-outer');
        regularPosts.forEach(post => {
            const postLinkElement = post.querySelector('.post-title a') || post.querySelector('.item-thumbnail a');
            if (postLinkElement) {
                const postUrl = cleanUrl(postLinkElement.href);
                if (featuredLinks.includes(postUrl)) {
                    post.style.display = 'none';
                }
            }
        });
    }

});
