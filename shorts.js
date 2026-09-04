/* ============================================================
   S24News — شريط الفيديوهات القصيرة (Shorts Rail)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

(function () {
    'use strict';

    var VIDEO_LABEL = "*V";
    var PAGE_SIZE = 10;

    var rail = document.getElementById('s24ShortsRail');
    var loadingEl = document.getElementById('s24ShortsLoading');
    var prevBtn = document.getElementById('s24ShortsPrev');
    var nextBtn = document.getElementById('s24ShortsNext');
    if (!rail) return;

    var nextStartIndex = 1;
    var isFetching = false;
    var reachedEnd = false;
    var seenPostIds = {};
    var seenViews = {};
    var items = [];
    var activeItem = null;

    // 🟢 إصلاح: تحميل YouTube IFrame API مرة واحدة لتفعيل تحكم فعلي (تشغيل/إيقاف/كتم)
    // بفيديوهات يوتيوب المضمَّنة بدل أزرار بصرية بلا وظيفة
    var ytApiReady = false;
    var ytApiPendingQueue = [];
    (function loadYouTubeApi() {
        if (window.YT && window.YT.Player) { ytApiReady = true; return; }
        var tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
    })();
    window.onYouTubeIframeAPIReady = (function (prevCallback) {
        return function () {
            if (typeof prevCallback === 'function') prevCallback();
            ytApiReady = true;
            ytApiPendingQueue.forEach(function (fn) { fn(); });
            ytApiPendingQueue = [];
        };
    })(window.onYouTubeIframeAPIReady);
    function whenYtApiReady(fn) {
        if (ytApiReady) fn(); else ytApiPendingQueue.push(fn);
    }

    var FIREBASE_CFG = window.S24_FIREBASE_CONFIG;
    function ensureFirebase() {
        try {
            if (typeof firebase === 'undefined') return false;
            if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CFG);
            return true;
        } catch (e) { return false; }
    }
    function cleanPathFromUrl(url) {
        try {
            var u = new URL(url);
            return u.pathname.replace(/\./g, '_').replace(/\//g, '-');
        } catch (e) { return ''; }
    }
    function fetchViews(cleanUrl, el) {
        if (!ensureFirebase()) { el.textContent = '0'; return; }
        firebase.database().ref('views/' + cleanPathFromUrl(cleanUrl)).once('value').then(function (s) {
            el.textContent = s.val() || 0;
        }).catch(function () { el.textContent = '0'; });
    }
    function incrementViews(cleanUrl, el) {
        if (seenViews[cleanUrl] || !ensureFirebase()) return;
        seenViews[cleanUrl] = true;
        var ref = firebase.database().ref('views/' + cleanPathFromUrl(cleanUrl));
        ref.transaction(function (c) { return (c || 0) + 1; }).then(function () {
            if (el) fetchViews(cleanUrl, el);
        });
    }


function extractVideoInfo(entry) {
    var contentHtml = (entry.content && entry.content.$t) || (entry.summary && entry.summary.$t) || '';
    var ytMatch = contentHtml.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
    if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
    var bloggerMatch = contentHtml.match(/https:\/\/www\.blogger\.com\/video\.g\?token=[^"'<\s]+/);
    if (bloggerMatch) return { type: 'blogger', url: bloggerMatch[0].replace(/&amp;/g, '&') };
    var directMatch = contentHtml.match(/<video[^>]*src=["']([^"']+)["']/i)
        || contentHtml.match(/<source[^>]*src=["']([^"']+\.mp4[^"']*)["']/i);
    if (directMatch) return { type: 'direct', url: directMatch[1] };
    return null;
}



    function extractPostId(entry) {
        var m = ((entry.id && entry.id.$t) || '').match(/post-(\d+)/);
        return m ? m[1] : null;
    }
    function extractThumb(entry) {
        if (entry.media$thumbnail) return entry.media$thumbnail.url.replace(/\/s\d+(-c)?\//, '/w700-h1244-c/');
        var html = (entry.content && entry.content.$t) || '';
        var m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        return m ? m[1] : '';
    }

    var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    var ICON_VOLUME_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M19 5a10 10 0 0 1 0 14M15.5 8.5a5 5 0 0 1 0 7"/></svg>';
    var ICON_VOLUME_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
    var ICON_EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    var ICON_SAVE = function (active) {
        return '<svg width="22" height="22" viewBox="0 0 24 24" fill="' + (active ? '#6db200' : 'none') + '" stroke="' + (active ? '#6db200' : 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
    };
    var ICON_SHARE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';

    function shareLinksHtml(url, title) {
        var clean = url.split('?')[0];
        var encUrl = encodeURIComponent(clean);
        var encTitle = encodeURIComponent(title);
        return '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encUrl + '" target="_blank" class="share-icon-link si-fb"><svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></a>'
            + '<a href="https://twitter.com/intent/tweet?url=' + encUrl + '&text=' + encTitle + '" target="_blank" class="share-icon-link si-x"><svg viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg></a>'
            + '<a href="https://api.whatsapp.com/send?text=' + encTitle + '%20' + encUrl + '" target="_blank" class="share-icon-link si-wa"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></a>'
            + '<a href="https://t.me/share/url?url=' + encUrl + '&text=' + encTitle + '" target="_blank" class="share-icon-link si-tg"><svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></a>';
    }

    function buildItem(entry) {
        var video = extractVideoInfo(entry);
        if (!video) return null;
        var postId = extractPostId(entry);
        if (postId && seenPostIds[postId]) return null;
        if (postId) seenPostIds[postId] = true;

        var linkObj = (entry.link || []).filter(function (l) { return l.rel === 'alternate'; })[0];
        var url = linkObj ? linkObj.href : '#';
        var cleanUrl = url.split('?')[0];
        var title = entry.title ? entry.title.$t : '';
        var thumb = extractThumb(entry);
        var isSaved = (typeof isPostSaved === 'function' && isPostSaved(cleanUrl));





var mediaHtml;
        if (video.type === 'youtube') {
            // 🟢 إصلاح: enablejsapi=1 + origin يفتحان قناة تحكم برمجية حقيقية عبر YouTube IFrame API
            mediaHtml = '<iframe class="s24-shorts-frame" data-src="https://www.youtube.com/embed/' + video.id + '?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=' + video.id + '&enablejsapi=1&origin=' + encodeURIComponent(location.origin) + '" allow="autoplay; encrypted-media" frameborder="0"></iframe>';
        } else if (video.type === 'blogger') {
            mediaHtml = '<iframe class="s24-shorts-frame" data-src="' + video.url + '" allow="autoplay; encrypted-media" frameborder="0"></iframe>';
        } else {
            mediaHtml = '<video class="s24-shorts-video" data-src="' + video.url + '" muted loop playsinline preload="metadata"></video>';
        }



        var item = document.createElement('div');
        item.className = 's24-shorts-item';
        if (postId) item.setAttribute('data-post-id', postId);

        item.innerHTML =
            '<article class="s24-shorts-player">' +
            '<div class="s24-shorts-media">' + mediaHtml +
            '<img class="s24-shorts-poster" src="' + thumb + '" alt="" loading="lazy">' +
            '</div>' +
            '<div class="s24-shorts-tap-area"></div>' +
            '<div class="s24-shorts-center-play">' + ICON_PLAY + '</div>' +
            '<div class="s24-shorts-overlay">' +
            '<div class="s24-shorts-block s24-shorts-block--top">' +
            '<button class="s24-shorts-btn s24-shorts-btn--mute" type="button" aria-label="كتم/تشغيل الصوت">' + ICON_VOLUME_OFF + '</button>' +
            '</div>' +
            '<div class="s24-shorts-block s24-shorts-block--bottom">' +
            '<h2 class="s24-shorts-title"><a href="' + url + '">' + title + '</a></h2>' +
            '</div>' +
            '</div>' +
            '<div class="s24-shorts-block--right">' +
            '<div class="rt-icon-group" style="cursor:default">' + ICON_EYE +
            '<span class="s24-shorts-views" data-clean-url="' + cleanUrl + '">…</span></div>' +
            '<div class="rt-icon-group save-btn ' + (isSaved ? 'saved' : '') + '" data-btn="save" data-url="' + cleanUrl + '">' + ICON_SAVE(isSaved) + '</div>' +
            '<div class="share-btn-wrapper">' +
            '<div class="rt-icon-group share-trigger" data-btn="share-toggle">' + ICON_SHARE + '</div>' +
            '<div class="mini-share-menu">' + shareLinksHtml(url, title) + '</div>' +
            '</div>' +
            '</div>' +
            '</article>';

        var viewsEl = item.querySelector('.s24-shorts-views');
        fetchViews(cleanUrl, viewsEl);





        wireItemBehavior(item, cleanUrl, video.type);
        return item;
    }

    function wireItemBehavior(item, cleanUrl, videoType) {
        var player = item.querySelector('.s24-shorts-player');
        var video = item.querySelector('.s24-shorts-video');
        var frame = item.querySelector('.s24-shorts-frame');
        var isYoutube = videoType === 'youtube';
        var muteBtn = item.querySelector('.s24-shorts-btn--mute');
        var tapArea = item.querySelector('.s24-shorts-tap-area');

        // 🟢 إصلاح: إخفاء زر الكتم لفيديو بلوجر المضمَّن — لا واجهة تحكم برمجية عامة له كيوتيوب،
        // فإبقاء زر لا يعمل أسوأ من عدم وجوده إطلاقاً
        if (frame && !isYoutube && muteBtn) {
            muteBtn.style.display = 'none';
        }

        function togglePlay() {
            if (video) {
                if (video.paused) { video.play().catch(function () {}); item.classList.remove('s24-shorts-item--paused'); }
                else { video.pause(); item.classList.add('s24-shorts-item--paused'); }
            } else if (isYoutube && item.s24YtPlayer && typeof item.s24YtPlayer.getPlayerState === 'function') {
                // 🟢 إصلاح: تشغيل/إيقاف فعلي لفيديو يوتيوب عبر YouTube IFrame API
                if (item.s24YtPlayer.getPlayerState() === 1) {
                    item.s24YtPlayer.pauseVideo();
                    item.classList.add('s24-shorts-item--paused');
                } else {
                    item.s24YtPlayer.playVideo();
                    item.classList.remove('s24-shorts-item--paused');
                }
            }
        }
        if (tapArea) tapArea.addEventListener('click', togglePlay);

        if (muteBtn) {
            muteBtn.addEventListener('click', function () {
                if (video) {
                    video.muted = !video.muted;
                    muteBtn.innerHTML = video.muted ? ICON_VOLUME_OFF : ICON_VOLUME_ON;
                } else if (isYoutube && item.s24YtPlayer && typeof item.s24YtPlayer.isMuted === 'function') {
                    // 🟢 إصلاح: كتم/تشغيل فعلي لصوت يوتيوب عبر YouTube IFrame API
                    if (item.s24YtPlayer.isMuted()) {
                        item.s24YtPlayer.unMute();
                        muteBtn.innerHTML = ICON_VOLUME_ON;
                    } else {
                        item.s24YtPlayer.mute();
                        muteBtn.innerHTML = ICON_VOLUME_OFF;
                    }
                }
            });
        }

        item.s24Activate = function () {
            player.classList.add('s24-shorts-player--active');
            if (video && !video.getAttribute('src')) {
                video.setAttribute('src', video.getAttribute('data-src'));
                video.load();
            }
            if (frame && !frame.getAttribute('src')) {
                frame.setAttribute('src', frame.getAttribute('data-src'));
                // 🟢 إصلاح: إنشاء كائن تحكم YouTube فعلي عند أول تفعيل لهذا العنصر فقط
                if (isYoutube) {
                    whenYtApiReady(function () {
                        if (!item.s24YtPlayer) {
                            item.s24YtPlayer = new YT.Player(frame, {
                                events: { 'onReady': function (e) { e.target.playVideo(); } }
                            });
                        }
                    });
                }
            } else if (isYoutube && item.s24YtPlayer && typeof item.s24YtPlayer.playVideo === 'function') {
                // 🟢 إصلاح: استئناف التشغيل الفعلي عند العودة لعنصر يوتيوب سبق تفعيله
                item.s24YtPlayer.playVideo();
            }
            if (video) { video.play().catch(function () {}); item.classList.remove('s24-shorts-item--paused'); }
            incrementViews(cleanUrl, item.querySelector('.s24-shorts-views'));
        };
        item.s24Deactivate = function () {
            player.classList.remove('s24-shorts-player--active');
            if (video) video.pause();
            // 🟢 إصلاح: إيقاف فيديو يوتيوب فعلياً عند الابتعاد عنه بدل بقائه يعمل بالخلفية بصوت محتمل
            if (isYoutube && item.s24YtPlayer && typeof item.s24YtPlayer.pauseVideo === 'function') {
                item.s24YtPlayer.pauseVideo();
            }
        };
    }





    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting && e.intersectionRatio >= 0.6) {
                if (activeItem && activeItem !== e.target) activeItem.s24Deactivate();
                activeItem = e.target;
                activeItem.s24Activate();
                updateNavButtons();
            }
        });
    }, { threshold: [0, 0.6, 1] });

    function updateNavButtons() {
        if (!activeItem) return;
        if (prevBtn) prevBtn.disabled = !activeItem.previousElementSibling;
        if (nextBtn) nextBtn.disabled = !activeItem.nextElementSibling || activeItem.nextElementSibling.id === 's24ShortsSentinel';
    }

    function appendItems(entries) {
        entries.forEach(function (entry) {
            var node = buildItem(entry);
            if (!node) return;
            rail.insertBefore(node, sentinel);
            observer.observe(node);
            items.push(node);
        });
    }

    function fetchPage() {
        if (isFetching || reachedEnd) return;
        isFetching = true;
        if (loadingEl) loadingEl.style.display = 'block';
       fetch('/feeds/posts/default/-/' + encodeURIComponent(VIDEO_LABEL) +
           '?alt=json&orderby=published&max-results=' + PAGE_SIZE + '&start-index=' + nextStartIndex)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var entries = (data.feed && data.feed.entry) || [];
                if (entries.length < PAGE_SIZE) reachedEnd = true;
                nextStartIndex += PAGE_SIZE;
                appendItems(entries);
            })
            .catch(function () { reachedEnd = true; })
            .then(function () {
                isFetching = false;
                if (loadingEl) loadingEl.style.display = 'none';
            });
    }

    function fetchTargetPost(postId) {
        return fetch('/feeds/posts/default/' + encodeURIComponent(postId) + '?alt=json')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.feed && data.feed.entry && data.feed.entry.length) {
                    appendItems([data.feed.entry[0]]);
                }
            }).catch(function () {});
    }

    var sentinel = document.createElement('div');
    sentinel.className = 's24-shorts-sentinel';
    sentinel.id = 's24ShortsSentinel';
    rail.appendChild(sentinel);
    new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) fetchPage();
    }, { root: rail, threshold: 0.01 }).observe(sentinel);

    if (prevBtn) prevBtn.addEventListener('click', function () {
        if (activeItem && activeItem.previousElementSibling) {
            activeItem.previousElementSibling.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
        if (activeItem && activeItem.nextElementSibling && activeItem.nextElementSibling.id !== 's24ShortsSentinel') {
            activeItem.nextElementSibling.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    var params = new URLSearchParams(window.location.search);
    var targetId = params.get('id');
    var startPromise = targetId ? fetchTargetPost(targetId) : Promise.resolve();
    startPromise.then(function () {
        fetchPage();
    });
})();
