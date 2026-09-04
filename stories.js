/* ============================================================
   S24News — نظام القصص (Stories) وعارض الشاشة الكاملة
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

document.addEventListener("DOMContentLoaded", function() { 
    var overlay = document.getElementById('story-overlay');
    var fullImg = document.getElementById('storyFullImg');
    var fullVideo = document.getElementById('storyFullVideo');
    var fullIframe = document.getElementById('storyFullIframe');
    var muteBtn = document.getElementById('storyMuteBtn');
    var watermarkEl = document.getElementById('storyWatermark');
    var titleEl = document.getElementById('storyFullTitle');
    var catEl = document.getElementById('storyCategoryText');
    var iconEl = document.getElementById('storyHeaderIcon');
    var btnEl = document.getElementById('storyLinkBtn');
    var segmentsContainer = document.getElementById('progressSegments');
    var loader = document.getElementById('storyLoader');
    var cardWrapper = document.getElementById('storyCardWrapper'); 
    var peekPrev = document.getElementById('peekPrevCard');
    var peekNext = document.getElementById('peekNextCard');
    var peekPrevIcon = document.getElementById('peekPrevIcon');
    var peekPrevCat = document.getElementById('peekPrevCat');
    var peekPrevImage = document.getElementById('peekPrevImage');
    var peekPrevTitle = document.getElementById('peekPrevTitle');
    var peekNextIcon = document.getElementById('peekNextIcon');
    var peekNextCat = document.getElementById('peekNextCat');
    var peekNextImage = document.getElementById('peekNextImage');
    var peekNextTitle = document.getElementById('peekNextTitle');
    var peekPrev2 = document.getElementById('peekPrev2Card');
    var peekNext2 = document.getElementById('peekNext2Card');
    var peekPrev2Icon = document.getElementById('peekPrev2Icon');
    var peekPrev2Cat = document.getElementById('peekPrev2Cat');
    var peekPrev2Image = document.getElementById('peekPrev2Image');
    var peekPrev2Title = document.getElementById('peekPrev2Title');
    var peekNext2Icon = document.getElementById('peekNext2Icon');
    var peekNext2Cat = document.getElementById('peekNext2Cat');
    var peekNext2Image = document.getElementById('peekNext2Image');
    var peekNext2Title = document.getElementById('peekNext2Title');
    var peekPrevViews = document.getElementById('peekPrevViews');
    var peekNextViews = document.getElementById('peekNextViews');
    var peekPrev2Views = document.getElementById('peekPrev2Views');
    var peekNext2Views = document.getElementById('peekNext2Views');
    var footerBar = document.getElementById('storyFooterBar');
    var viewsCountEl = document.getElementById('storyViewsCount');
    var shareBtn = document.getElementById('storyShareBtn');
    var saveBtn = document.getElementById('storySaveBtn');

    var posts = [];
    var currentIndex = 0;
    var currentGroupIndex = 0;
    var progressInterval;
    var STORY_DURATION = 5000;
    var isPaused = false, isHoveringCard = false, currentLoadTicket = 0;
    var isVideoMuted = true;
    var storyYtPlayer = null;
    var storyItemsArray = []; // ✅ متغير عام

    var storyYtApiReady = false;
    var storyYtApiPendingQueue = [];
    (function loadStoryYouTubeApi() {
        if (window.YT && window.YT.Player) { storyYtApiReady = true; return; }
        if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
            var tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
        }
        var prevCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
            if (typeof prevCallback === 'function') prevCallback();
            storyYtApiReady = true;
            storyYtApiPendingQueue.forEach(function (fn) { fn(); });
            storyYtApiPendingQueue = [];
        };
    })();
    function whenStoryYtApiReady(fn) {
        if (storyYtApiReady) fn(); else storyYtApiPendingQueue.push(fn);
    }
    let seenStories = JSON.parse(sessionStorage.getItem('s24_seen_stories') || '{}');

    var groupDataCache = {};
    var STORY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
    var STORY_GROUP_MAX_RESULTS = 40;
    var GROUP_CACHE_TTL_MS = 60 * 60 * 1000;
    
    function isWithin24h(dateStr) {
        if (!dateStr) return false;
        var postTime = new Date(dateStr).getTime();
        if (isNaN(postTime)) return false;
        return (Date.now() - postTime) <= STORY_MAX_AGE_MS;
    }

    // ============================================================
    // ✅ دالة attachStoryClickHandlers - معرّفة هنا
    // ============================================================
    function attachStoryClickHandlers() {
        storyItemsArray = Array.from(document.querySelectorAll('#main-stories-grid .story-item'));
        
        document.removeEventListener('click', storyClickHandler);
        document.addEventListener('click', storyClickHandler);
    }

    function storyClickHandler(e) {
        var targetLink = e.target.closest('#main-stories-grid a');
        if (!targetLink) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        var idx = storyItemsArray.indexOf(targetLink);
        if (idx === -1) return;
        
        openOverlay();
        loadStoryGroup(idx);
    }

    // ============================================================
    // 0. بناء دوائر الستوريز ديناميكيًا من ودجت الإعدادات
    // ============================================================
    (function buildAndSortStoryItemsFromConfig_Option1() {
        var grid = document.getElementById('main-stories-grid');
        var configItems = document.querySelectorAll('#s24-story-labels-config li a');
        
        if (!grid || !configItems.length) return;

        var storiesMetadata = [];
        
        configItems.forEach(function (cfg, index) {
            var caption = cfg.textContent.trim();
            var label = cfg.getAttribute('href');
            
            if (!label || !caption) return;
            
            storiesMetadata.push({
                caption: caption,
                label: label,
                configIndex: index,
                lastPostDate: null,
                postCount: 0,
                domElement: null
            });
        });

        var fetchedCount = 0;
        var totalToFetch = storiesMetadata.length;
        
        storiesMetadata.forEach(function (item) {
            fetch('/feeds/posts/summary/-/' + encodeURIComponent(item.label) + '?alt=json&max-results=40')
                .then(res => res.json())
                .then(data => {
                    if (data.feed && data.feed.entry && data.feed.entry.length > 0) {
                        var validPosts = data.feed.entry.filter(entry => 
                            isWithin24h(entry.published && entry.published.$t)
                        );
                        
                        if (validPosts.length > 0) {
                            item.lastPostDate = new Date(validPosts[0].published.$t).getTime();
                            item.postCount = validPosts.length;
                        }
                    }
                    
                    fetchedCount++;
                    if (fetchedCount === totalToFetch) {
                        sortAndRenderStories_Option1(storiesMetadata);
                    }
                })
                .catch(() => {
                    fetchedCount++;
                    if (fetchedCount === totalToFetch) {
                        sortAndRenderStories_Option1(storiesMetadata);
                    }
                });
        });
        
        function sortAndRenderStories_Option1(items) {
            items.sort((a, b) => {
                if (a.lastPostDate !== b.lastPostDate) {
                    return (b.lastPostDate || 0) - (a.lastPostDate || 0);
                }
                
                if (a.postCount !== b.postCount) {
                    return b.postCount - a.postCount;
                }
                
                return a.caption.localeCompare(b.caption, 'ar');
            });
            
            grid.innerHTML = '';
            
            items.forEach(function (metadata) {
                var a = document.createElement('a');
                a.setAttribute('href', metadata.label);
                a.className = 'story-item';
                
                var img = document.createElement('img');
                img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e0e0e0"/%3E%3C/svg%3E';
                img.alt = metadata.caption;
                
                var span = document.createElement('span');
                span.className = 'story-caption';
                span.textContent = metadata.caption;
                
                a.appendChild(img);
                a.appendChild(span);
                
                metadata.domElement = a;
                grid.appendChild(a);
            });
            
            reinitializeStoryItemsArray();
        }
    })();

    // ============================================================
    // 1. تحديث دوائر الدخول
    // ============================================================
    function reinitializeStoryItemsArray() {
        const storyItems = document.querySelectorAll('#main-stories-grid .story-item');
        storyItemsArray = Array.from(storyItems);
        
        storyItemsArray.forEach(item => {
            const label = item.getAttribute('href');
            const imgElement = item.querySelector('img');
            if (!label || label === '#' || !imgElement) return;
            
            fetch('/feeds/posts/summary/-/' + encodeURIComponent(label) + '?alt=json&max-results=1')
                .then(res => res.json()).then(data => {
                    const entry = (data.feed && data.feed.entry && data.feed.entry.length > 0) ? data.feed.entry[0] : null;

                    if (!entry || !isWithin24h(entry.published && entry.published.$t)) {
                        item.style.display = 'none';
                        return;
                    }
                    item.style.display = '';

                    let imgUrl = "";
                    if (entry.media$thumbnail) imgUrl = entry.media$thumbnail.url.replace(/\/s[0-9]+.*?\//, '/s150-c/');
                    else if (entry.content && entry.content.$t.match(/<img.+?src="([^"]+)"/)) imgUrl = entry.content.$t.match(/<img.+?src="([^"]+)"/)[1];
                    if (imgUrl) { imgElement.src = imgUrl; imgElement.style.animation = "fadeIn 0.5s ease-in"; }
                    let latestPostUrl = entry.link.find(l => l.rel === 'alternate').href;
                    item.setAttribute('data-latest-post', latestPostUrl);
                    
                    let seenStories = JSON.parse(sessionStorage.getItem('s24_seen_stories') || '{}');
                    if (seenStories[label] === latestPostUrl) item.classList.add('story-seen');
                    else item.classList.remove('story-seen');
                })
                .catch(() => {});
        });
        
        // ✅ تحديث الـ listeners
        setTimeout(function() {
            attachStoryClickHandlers();
        }, 100);
    }

    // ============================================================
    // 2. كشف الفيديو داخل محتوى المقال
    // ============================================================
    function extractVideoInfo(entry) {
        var contentHtml = (entry.content && entry.content.$t) || (entry.summary && entry.summary.$t) || '';
        var ytMatch = contentHtml.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
        if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
        var directMatch = contentHtml.match(/<video[^>]*src=["']([^"']+)["']/i) || contentHtml.match(/<source[^>]*src=["']([^"']+\.mp4[^"']*)["']/i);
        if (directMatch) return { type: 'direct', url: directMatch[1] };
        return null;
    }

    // ============================================================
    // 3. جلب بيانات مجموعة كاملة
    // ============================================================
    function getGroupData(groupIndex, callback) {
        if (groupIndex < 0 || groupIndex >= storyItemsArray.length) { callback(null); return; }
        if (groupDataCache[groupIndex] && (Date.now() - groupDataCache[groupIndex].fetchedAt) < GROUP_CACHE_TTL_MS) { callback(groupDataCache[groupIndex]); return; }

        var targetLink = storyItemsArray[groupIndex];
        var label = targetLink.getAttribute('href');
        var sectionName = targetLink.querySelector('.story-caption').innerText;
        var sectionIcon = targetLink.querySelector('img').src;

        fetch('/feeds/posts/default/-/' + encodeURIComponent(label) + '?alt=json&max-results=' + STORY_GROUP_MAX_RESULTS)
            .then(res => res.json()).then(data => {
                var groupPosts = [];
                if (data.feed && data.feed.entry) {
                    data.feed.entry.forEach(entry => {
                        if (!isWithin24h(entry.published && entry.published.$t)) return;
                        var img = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e0e0e0'/%3E%3C/svg%3E";
                        if (entry.media$thumbnail) img = entry.media$thumbnail.url.replace(/\/s[0-9]+.*?\//, '/s1600/');
                        var link = entry.link.find(l => l.rel === 'alternate').href;
                        var cleanTitle = entry.title.$t.replace(/^[^:]*:\s*/, '');
                        var videoInfo = extractVideoInfo(entry);
                        groupPosts.push({ title: cleanTitle, img: img, link: link, views: null, video: videoInfo });
                    });
                }
                var groupData = { label: label, sectionName: sectionName, sectionIcon: sectionIcon, posts: groupPosts, targetLink: targetLink, fetchedAt: Date.now() };
                groupDataCache[groupIndex] = groupData;
                callback(groupData);
            }).catch(() => callback(null));
    }

    // ============================================================
    // 4. تحميل مجموعة كاملة
    // ============================================================
    function loadStoryGroup(groupIndex, direction) {
        direction = (direction === undefined) ? 1 : direction;
        if (groupIndex < 0 || groupIndex >= storyItemsArray.length) {
            closeOverlay();
            return;
        }
        loader.style.display = 'block';
        segmentsContainer.innerHTML = '';
        currentGroupIndex = groupIndex;

        getGroupData(groupIndex, function(groupData) {
            if (!groupData || groupData.posts.length === 0) {
                loadStoryGroup(groupIndex + direction, direction);
                return;
            }

            groupData.targetLink.classList.add('story-seen');
            var latestPostUrl = groupData.targetLink.getAttribute('data-latest-post');
            if (latestPostUrl) {
                seenStories[groupData.label] = latestPostUrl;
                sessionStorage.setItem('s24_seen_stories', JSON.stringify(seenStories));
            }

            posts = groupData.posts;
            catEl.innerText = groupData.sectionName;
            iconEl.src = groupData.sectionIcon;
            createSegments(posts.length);
            currentIndex = 0;
            showSlide();

            prefetchAdjacentGroups(groupIndex);
        });
    }

    function createSegments(count) {
        let html = '';
        for (let i = 0; i < count; i++) html += `<div class="story-segment" id="segwrap-${i}"><div class="story-segment-fill" id="seg-${i}"></div></div>`;
        segmentsContainer.innerHTML = html;
    }

    // ============================================================
    // 5. بطاقات المعاينة
    // ============================================================
    function prefetchAdjacentGroups(groupIndex) {
        getGroupData(groupIndex - 1, function(data) {
            renderPeekCard(peekPrev, peekPrevIcon, peekPrevCat, peekPrevImage, peekPrevTitle, peekPrevViews, data);
        });
        getGroupData(groupIndex + 1, function(data) {
            renderPeekCard(peekNext, peekNextIcon, peekNextCat, peekNextImage, peekNextTitle, peekNextViews, data);
        });
        getGroupData(groupIndex - 2, function(data) {
            renderPeekCard(peekPrev2, peekPrev2Icon, peekPrev2Cat, peekPrev2Image, peekPrev2Title, peekPrev2Views, data);
        });
        getGroupData(groupIndex + 2, function(data) {
            renderPeekCard(peekNext2, peekNext2Icon, peekNext2Cat, peekNext2Image, peekNext2Title, peekNext2Views, data);
        });
    }

    function renderPeekCard(card, iconEl2, catEl2, imageEl, titleEl2, viewsEl, groupData) {
        if (groupData && groupData.posts.length > 0) {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
            iconEl2.src = groupData.sectionIcon;
            catEl2.innerText = groupData.sectionName;
            imageEl.style.backgroundImage = `url(${groupData.posts[0].img})`;
            titleEl2.innerText = groupData.posts[0].title;
            if (viewsEl) fetchPeekViewsCount(groupData.posts[0].link, viewsEl);
        } else {
            card.style.opacity = '0';
            card.style.pointerEvents = 'none';
        }
    }

    function fetchPeekViewsCount(postUrl, viewsEl) {
        try {
            if (typeof firebase === 'undefined') { viewsEl.innerText = '0'; return; }
            if (!firebase.apps.length) {
                firebase.initializeApp(window.S24_FIREBASE_CONFIG);
            }
            var urlObj = new URL(postUrl);
            var cleanPath = urlObj.pathname.replace(/\./g, '_').replace(/\//g, '-');
            firebase.database().ref('views/' + cleanPath).once('value').then(function(snapshot) {
                viewsEl.innerText = snapshot.val() || 0;
            }).catch(function() { viewsEl.innerText = '0'; });
        } catch(e) { viewsEl.innerText = '0'; }
    }

    function updateFooterBar() {
        var p = posts[currentIndex];
        if (!p) return;
        footerBar.style.display = 'flex';
        viewsCountEl.innerText = '...';
        if (typeof isPostSaved === 'function' && isPostSaved(p.link)) saveBtn.classList.add('saved');
        else saveBtn.classList.remove('saved');
        fetchRealViewsCount(p.link, currentIndex, currentGroupIndex);
    }

    function fetchRealViewsCount(postUrl, requestedIndex, requestedGroup) {
        try {
            if (typeof firebase === 'undefined') { viewsCountEl.innerText = '0'; return; }
            if (!firebase.apps.length) {
                firebase.initializeApp(window.S24_FIREBASE_CONFIG);
            }
            var urlObj = new URL(postUrl);
            var cleanPath = urlObj.pathname.replace(/\./g, '_').replace(/\//g, '-');
            var dbRef = firebase.database().ref('views/' + cleanPath);
            dbRef.once('value').then(function(snapshot) {
                if (currentIndex !== requestedIndex || currentGroupIndex !== requestedGroup) return;
                viewsCountEl.innerText = snapshot.val() || 0;
            }).catch(function() {
                if (currentIndex === requestedIndex && currentGroupIndex === requestedGroup) viewsCountEl.innerText = '0';
            });
        } catch (err) { viewsCountEl.innerText = '0'; }
    }

    // ============================================================
    // 6. عرض القصة
    // ============================================================
    function stopCurrentMedia() {
        try { fullVideo.pause(); fullVideo.removeAttribute('src'); fullVideo.load(); } catch (e) {}
        fullIframe.src = 'about:blank';
    }

    function updateMuteIcon() {
        document.getElementById('muteIconOn').style.display = isVideoMuted ? 'block' : 'none';
        document.getElementById('muteIconOff').style.display = isVideoMuted ? 'none' : 'block';
    }

    function finalizeSlideUI(p) {
        titleEl.innerText = p.title;
        btnEl.href = p.link;
        updateFooterBar();
        updateNavArrows();
        isPaused = isHoveringCard;
    }

    function updateNavArrows() {
        var atStart = currentGroupIndex === 0 && currentIndex === 0;
        var atEnd = currentGroupIndex === storyItemsArray.length - 1 && currentIndex === posts.length - 1;
        document.getElementById('prevStoryBtn').classList.toggle('is-disabled', atStart);
        document.getElementById('nextStoryBtn').classList.toggle('is-disabled', atEnd);
    }

    function showSlide() {
        if (posts.length === 0) return;
        clearInterval(progressInterval);
        loader.style.display = 'block';
        stopCurrentMedia();
        fullImg.style.display = 'none';
        fullVideo.style.display = 'none';
        fullIframe.style.display = 'none';
        muteBtn.classList.remove('show');
        watermarkEl.classList.remove('show');

        for (let i = 0; i < posts.length; i++) {
            let seg = document.getElementById(`seg-${i}`);
            if (seg) seg.style.width = (i < currentIndex) ? '100%' : '0%';
        }
        segmentsContainer.querySelectorAll('.story-segment').forEach((el, i) => el.classList.toggle('is-current', i === currentIndex));

        var p = posts[currentIndex];
        var myTicket = ++currentLoadTicket;
        isVideoMuted = true;
        updateMuteIcon();

        if (p.video && p.video.type === 'youtube') {
            loader.style.display = 'none';
            fullIframe.src = 'https://www.youtube.com/embed/' + p.video.id + '?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=' + p.video.id + '&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
            fullIframe.style.display = 'block';
            muteBtn.classList.add('show');
            watermarkEl.classList.add('show');
            storyYtPlayer = null;
            whenStoryYtApiReady(function () {
                if (myTicket !== currentLoadTicket) return;
                storyYtPlayer = new YT.Player(fullIframe, {
                    events: { 'onReady': function (e) { e.target.mute(); e.target.playVideo(); } }
                });
            });
            finalizeSlideUI(p);
            startProgress();
        } else if (p.video && p.video.type === 'direct') {
            loader.style.display = 'none';
            fullVideo.src = p.video.url;
            fullVideo.muted = true;
            fullVideo.style.display = 'block';
            fullVideo.play().catch(() => {});
            muteBtn.classList.add('show');
            watermarkEl.classList.add('show');
            finalizeSlideUI(p);
            startProgress();
        } else {
            fullImg.style.opacity = '0';
            var imgLoader = new Image();
            imgLoader.onload = function() {
                if (myTicket !== currentLoadTicket) return;
                fullImg.src = p.img;
                fullImg.style.display = 'block';
                fullImg.style.opacity = '1';
                loader.style.display = 'none';
                finalizeSlideUI(p);
                startProgress();
            };
            imgLoader.onerror = function() { if (myTicket === currentLoadTicket) nextSlide(); };
            imgLoader.src = p.img;
        }
    }

    function startProgress() {
        clearInterval(progressInterval);
        var width = 0, step = 50, widthStep = 100 / (STORY_DURATION / step);
        var currentSeg = document.getElementById(`seg-${currentIndex}`);
        progressInterval = setInterval(function() {
            if (!isPaused) {
                width += widthStep;
                if (currentSeg) currentSeg.style.width = width + '%';
                if (width >= 100) { clearInterval(progressInterval); nextSlide(); }
            }
        }, step);
    }

    // ============================================================
    // 7. الانتقال بين المواضيع
    // ============================================================
    function nextSlide() {
        if (currentIndex < posts.length - 1) {
            currentIndex++;
            showSlide();
        } else {
            loadStoryGroup(currentGroupIndex + 1, 1);
        }
    }
    function prevSlide() {
        if (currentIndex > 0) {
            currentIndex--;
            showSlide();
        } else if (currentGroupIndex > 0) {
            loadStoryGroup(currentGroupIndex - 1, -1);
        } else {
            showSlide();
        }
    }
    window.nextSlide = nextSlide; window.prevSlide = prevSlide;

    function openOverlay() { overlay.style.display = 'flex'; setTimeout(() => overlay.classList.add('active'), 10); document.body.style.overflow = 'hidden'; }
    function closeOverlay() {
        currentLoadTicket++;
        overlay.classList.remove('active');
        setTimeout(() => { overlay.style.display = 'none'; footerBar.style.display = 'none'; }, 300);
        clearInterval(progressInterval);
        stopCurrentMedia();
        fullImg.src = '';
        document.body.style.overflow = '';
        isHoveringCard = false;
    }

    // ============================================================
    // 8. زر كتم/تشغيل الصوت
    // ============================================================
    if (muteBtn) muteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        isVideoMuted = !isVideoMuted;
        updateMuteIcon();
        var p = posts[currentIndex];
        if (!p || !p.video) return;
        if (p.video.type === 'direct') {
            fullVideo.muted = isVideoMuted;
        } else if (p.video.type === 'youtube' && storyYtPlayer && typeof storyYtPlayer.mute === 'function') {
            if (isVideoMuted) storyYtPlayer.mute(); else storyYtPlayer.unMute();
        }
    });

    // ============================================================
    // 9. أزرار المشاركة والحفظ
    // ============================================================
    if (shareBtn) shareBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var p = posts[currentIndex]; if (!p) return;
        if (navigator.share) navigator.share({ title: p.title, url: p.link }).catch(() => {});
        else if (typeof performCopy === 'function') performCopy(p.link);
    });
    if (saveBtn) saveBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var p = posts[currentIndex]; if (!p || typeof isPostSaved !== 'function') return;
        if (isPostSaved(p.link)) { removePost(p.link); saveBtn.classList.remove('saved'); if (typeof showToast === 'function') showToast('تمت الإزالة'); }
        else { savePost(p.link); saveBtn.classList.add('saved'); if (typeof showToast === 'function') showToast('تم الحفظ'); }
    });

    peekPrev.addEventListener('click', () => loadStoryGroup(currentGroupIndex - 1, -1));
    peekNext.addEventListener('click', () => loadStoryGroup(currentGroupIndex + 1, 1));
    peekPrev2.addEventListener('click', () => loadStoryGroup(currentGroupIndex - 2, -1));
    peekNext2.addEventListener('click', () => loadStoryGroup(currentGroupIndex + 2, 1));

    // ============================================================
    // 10. التحكم بالسحب واللمس والنقر
    // ============================================================
    let touchStartX = 0, holdTimer, isDragging = false, isTouchDevice = false;
    if (cardWrapper) {
        cardWrapper.addEventListener('mouseenter', function() { if (isTouchDevice) return; isHoveringCard = true; isPaused = true; });
        cardWrapper.addEventListener('mouseleave', function() { if (isTouchDevice) return; isHoveringCard = false; isPaused = false; });
        cardWrapper.addEventListener('click', function(e) {
            if (e.target.closest('.stories-card__main-button') || e.target.closest('.close-story-btn') || e.target.closest('.story-mute-btn') || e.target.closest('.nav-story-btn')) return;
            if (isDragging) return;
            var rect = cardWrapper.getBoundingClientRect();
            var x = e.clientX - rect.left;
            if (x > rect.width / 2) prevSlide(); else nextSlide();
        });
        cardWrapper.addEventListener('touchstart', function(e) {
            isTouchDevice = true;
            if (e.target.closest('.stories-card__main-button') || e.target.closest('.close-story-btn') || e.target.closest('.story-mute-btn') || e.target.closest('.nav-story-btn')) return;
            touchStartX = e.changedTouches[0].screenX; isDragging = false;
            holdTimer = setTimeout(function() { isPaused = true; }, 150);
        }, { passive: true });
        cardWrapper.addEventListener('touchmove', function(e) {
            let currentX = e.changedTouches[0].screenX;
            if (Math.abs(currentX - touchStartX) > 10) { isDragging = true; clearTimeout(holdTimer); }
        }, { passive: true });
        cardWrapper.addEventListener('touchend', function(e) {
            if (e.target.closest('.stories-card__main-button') || e.target.closest('.close-story-btn') || e.target.closest('.story-mute-btn') || e.target.closest('.nav-story-btn')) return;
            clearTimeout(holdTimer); isPaused = false;
            let touchEndX = e.changedTouches[0].screenX;
            let swipeDistance = touchEndX - touchStartX;
            if (isDragging && Math.abs(swipeDistance) > 40) { if (swipeDistance < -40) nextSlide(); else if (swipeDistance > 40) prevSlide(); }
            setTimeout(() => { isDragging = false; }, 50);
        });
    }

    document.getElementById('closeStoryBtn').onclick = closeOverlay;
    document.getElementById('nextStoryBtn').onclick = (e) => { e.stopPropagation(); nextSlide(); };
    document.getElementById('prevStoryBtn').onclick = (e) => { e.stopPropagation(); prevSlide(); };
    overlay.onclick = (e) => { if (e.target === overlay) closeOverlay(); };

    // ============================================================
    // 11. سحب شريط الدوائر بالماوس
    // ============================================================
    const slider = document.querySelector('.stories-grid');
    if (slider) {
        let isDown = false, startX, scrollLeft;
        slider.style.cursor = 'grab';
        slider.addEventListener('mousedown', (e) => { isDown = true; slider.style.cursor = 'grabbing'; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
        slider.addEventListener('mouseleave', () => { isDown = false; slider.style.cursor = 'grab'; });
        slider.addEventListener('mouseup', () => { isDown = false; slider.style.cursor = 'grab'; });
        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return; e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2;
            slider.scrollLeft = scrollLeft - walk;
        });
    }

    // ✅ تهيئة الـ listeners عند البدء
    attachStoryClickHandlers();
});
