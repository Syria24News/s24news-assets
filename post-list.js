/* ============================================================
   S24News — قائمة المقالات: تحميل المزيد + استبعاد الموسوعة
   يعتمد على window.S24Cache المعرَّف في أعلى القالب
   ============================================================ */

document.addEventListener("DOMContentLoaded", function() {

    var MIN_VISIBLE_POSTS = 7;
    var s24GlossaryUrls = new Set();
    var S24_GLOSSARY_SUMMARY_CACHE_KEY = 's24_glossary_summary_cache';
    var S24_GLOSSARY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 ساعة

    // 1️⃣ استخدام الكاش العام للقالب بدلاً من إعادة اختراع العجلة
    var s24CachedGlossarySummary = window.S24Cache ? window.S24Cache.get(S24_GLOSSARY_SUMMARY_CACHE_KEY, S24_GLOSSARY_CACHE_TTL) : null;

    var s24GlossaryUrlsReady = (s24CachedGlossarySummary ? Promise.resolve(s24CachedGlossarySummary) :
        fetch('/feeds/posts/summary/-/' + encodeURIComponent('الموسوعة') + '?alt=json&max-results=500')
            .then(function(r){ return r.json(); })
            .then(function(data){
                if(window.S24Cache) window.S24Cache.set(S24_GLOSSARY_SUMMARY_CACHE_KEY, data);
                return data;
            })
            .catch(function(){ return null; })
    ).then(function(data){
        if (!data || !data.feed || !data.feed.entry) return;
        data.feed.entry.forEach(function(entry){
            entry.link.forEach(function(l){
                if (l.rel === 'alternate') s24GlossaryUrls.add(l.href.split('?')[0]);
            });
        });
    });

    var activeNextLink = null;
    // تبسيط اختيار الرابط
    var initialLink = document.querySelector('.blog-pager-older-link') || document.getElementById('blog-pager-older-link');
    if(initialLink) activeNextLink = initialLink.href;

    if (activeNextLink) {

        var loadMoreHTML = `
            <div id="load-more-container" style="width: 100%; display: block; clear: both; margin-top: 20px; margin-bottom: 20px;">
                <button id="load-more-btn">
                    <span>تحميل المزيد</span>
                    <div class="loading-spinner-btn"></div>
                </button>
            </div>
        `;

        var postsArea = document.querySelector('.blog-posts');
        if(postsArea) postsArea.insertAdjacentHTML('beforeend', loadMoreHTML);

        var pager = document.getElementById('blog-pager');
        if(pager) pager.style.display = 'none';

        var btn = document.getElementById('load-more-btn');
        var spinner = btn.querySelector('.loading-spinner-btn');
        var btnText = btn.querySelector('span');
        var container = document.getElementById('load-more-container');

        function countVisiblePosts() {
            return [].slice.call(postsArea.querySelectorAll('.post-outer')).filter(function(p){
                return getComputedStyle(p).display !== 'none';
            }).length;
        }

        function isGlossaryPost(post) {
            if (post.innerHTML.indexOf('s24-glossary-marker') > -1) return true;
            var linkEl = post.querySelector('h3.post-title a, .post-title a');
            var href = linkEl ? linkEl.href.split('?')[0] : '';
            return href && s24GlossaryUrls.has(href);
        }

        // 2️⃣ دالة مركزية للتحكم بحالة الزر (تقضي على 80% من التكرار)
        function setBtnState(state) {
            if (state === 'loading') {
                btn.setAttribute('disabled', 'true');
                btn.style.opacity = '0.7';
                btnText.innerText = 'جاري التحميل...';
                spinner.style.display = 'inline-block';
            } else if (state === 'ready') {
                btn.removeAttribute('disabled');
                btn.style.opacity = '1';
                btnText.innerText = 'تحميل المزيد';
                spinner.style.display = 'none';
            } else if (state === 'error') {
                btn.removeAttribute('disabled');
                btn.style.opacity = '1';
                btnText.innerText = 'حدث خطأ، كرر المحاولة';
                spinner.style.display = 'none';
            } else if (state === 'end') {
                btn.style.display = 'none';
                container.innerHTML = '<div style="padding:15px; color:#999;">انتهت الأخبار</div>';
            }
        }

        function fetchOneBatch() {
            return s24GlossaryUrlsReady.then(function(){
                return fetch(activeNextLink);
            })
            .then(function(response){ return response.text(); })
            .then(function(data){
                var parser = new DOMParser();
                var doc = parser.parseFromString(data, 'text/html');
                var newPosts = doc.querySelectorAll('.post-outer');

                if(newPosts.length > 0) {
                    newPosts.forEach(function(post){
                        if (isGlossaryPost(post)) return;
                        post.style.opacity = '0';
                        postsArea.insertBefore(post, container);
                        setTimeout(function(){
                            post.style.opacity = '1';
                            post.style.transition = 'opacity 0.5s';
                        }, 100);
                    });
                    
                    setTimeout(function() {
                        if (typeof s24MarkListThumbnail === 'function') s24MarkListThumbnail();
                    }, 150);
                }

                var nextLinkTag = doc.querySelector('.blog-pager-older-link');
                if (nextLinkTag && nextLinkTag.href) {
                    activeNextLink = nextLinkTag.href;
                    return true;
                } else {
                    activeNextLink = null;
                    return false;
                }
            });
        }

        // 3️⃣ دالة مركزية لتنفيذ الجلب (تجمع بين التحميل التلقائي واليدوي)
        function executeFetch(isAuto) {
            setBtnState('loading');
            fetchOneBatch().then(function(hasMore){
                if (hasMore) {
                    if (isAuto) autoTopUp(); // إذا كان تلقائياً، استمر حتى تكتفي الشاشة
                    else setBtnState('ready'); // إذا كان يدوياً، أعد الزر لوضعه الطبيعي
                } else {
                    setBtnState('end');
                }
            }).catch(function(err){
                setBtnState('error');
            });
        }

        function autoTopUp() {
            if (countVisiblePosts() >= MIN_VISIBLE_POSTS || !activeNextLink) {
                activeNextLink ? setBtnState('ready') : setBtnState('end');
                return;
            }
            executeFetch(true);
        }

        // بدء التحميل التلقائي عند أول فتح للصفحة
        autoTopUp();

        // حدث النقر اليدوي
        btn.addEventListener('click', function() {
            if(btn.getAttribute('disabled') === 'true') return;
            executeFetch(false);
        });
    }
});
