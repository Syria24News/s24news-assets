/* ============================================================
   S24News — محرّك الشبكات المميزة (الرئيسية + صفحات الأقسام)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
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
            cacheKey: 's24_special_grid_v1',
            titleElId: 'grid-label-title',
            getLabel: function() {
                const labelWidget = document.getElementById('Special_Grid_Label');
                let labelName = "مختارات";
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
            cacheKey: 's24_special_grid_category',
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
            const feedUrl = '/feeds/posts/summary/-/' + encodeURIComponent(labelName) + '?alt=json&max-results=5';

            fetch(feedUrl)
            .then(res => {
                if (!res.ok) throw new Error("HTTP error " + res.status);
                return res.json();
            })
            .then(data => {
                if (data.feed && data.feed.entry && data.feed.entry.length > 0) {
                    window.S24Cache.set(cfg.cacheKey, data.feed.entry);
                    if (!isSilent || JSON.stringify(data.feed.entry) !== JSON.stringify(cachedData)) {
                         renderGrid(data.feed.entry);
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

        function handleEmpty(isSilent, msg) {
            if (isSilent) return;
            if (cfg.wrapperId) {
                const wrapper = document.getElementById(cfg.wrapperId);
                if (wrapper) wrapper.style.display = 'none';
            } else {
                gridContainer.innerHTML = `<div style="padding:40px; text-align:center; color:#888;">${msg}</div>`;
            }
        }

        function renderGrid(entries) {
            let htmlMain = '';
            let htmlSub = '<div class="sub-grid">';

            entries.forEach((entry, i) => {
                const title = entry.title.$t;
                const link = getEntryLink(entry.link);
                const imgRes = (i === 0) ? '/w720-h405-c/' : '/w348-h196-c/';
                const imgSize = (i === 0) ? 'width="720" height="405"' : 'width="348" height="196"';
                const loadingAttr = (i === 0) ? 'fetchpriority="high"' : 'loading="lazy"';

                let img = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e0e0e0"/%3E%3C/svg%3E';
                if (entry.media$thumbnail) {
                    img = entry.media$thumbnail.url.replace(/\/s[0-9]+.*?\//, imgRes);
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
                removeDuplicatePostsFromList(entries);
            }
        }

        function getEntryLink(links) {
            const l = links.find(k => k.rel === 'alternate');
            return l ? l.href : '#';
        }
    }

    // دالة مشتركة: إخفاء المقالات المكررة من القائمة العادية أسفل الصفحة
    function removeDuplicatePostsFromList(entries) {
        const featuredLinks = entries.map(entry => {
            let link = '';
            entry.link.forEach(l => { if (l.rel === 'alternate') link = l.href; });
            return link.split('?')[0].split('#')[0];
        });

        const regularPosts = document.querySelectorAll('.blog-posts .post-outer');
        regularPosts.forEach(post => {
            const postLinkElement = post.querySelector('.post-title a') || post.querySelector('.item-thumbnail a');
            if (postLinkElement) {
                const postUrl = postLinkElement.href.split('?')[0].split('#')[0];
                if (featuredLinks.includes(postUrl)) {
                    post.style.display = 'none';
                }
            }
        });
    }

});
