/* ============================================================
   S24News — مشغّل البث المباشر (playFast / loadVideoLibs)
   playFast تُستدعى من onclick داخل HTML القالب — يجب أن تبقى دالة عامة

   الإصدار 2.1 — 30 أكتوبر 2026: شريط القنوات تحت شاشة صفحة البث (الحقل channels)
   الإصدار 2.0 — 18 أكتوبر 2026: إعدادات البث من لوحة 24 (تبويب «البث»)
   المصدر: مستند Firestore واحد live_stream/current عبر S24Feed (utils.js)
     mode      'video' فيديو محدد | 'channel' البث الجاري لقناة
     videoId   رقم فيديو يوتيوب (11 حرفاً)     channelId  معرّف القناة UC...
     onAir     false = البث متوقف: رسالة في صفحة البث وإخفاء المشغّل المصغّر
     title     عنوان اختياري (يظهر في شاشة القفل)   poster  صورة غلاف اختيارية
   المشغّلات الثلاثة هنا: صفحة البث (playFast)، والجانبي في الرئيسية (playSidebarFast —
   نُقل من القالب في 18 أكتوبر)، والمصغّر في الرئيسية (initMiniLive / closeMiniLive —
   نُقل من القالب في 18 أكتوبر أيضاً).
   يُقرأ فقط حيث يوجد مشغّل (صفحة البث والرئيسية)، مع كاش 15 دقيقة في الرئيسية
   ودقيقة في صفحة البث. إن فشل الجلب يبقى LIVE_CONFIG (ودجت القالب أو الاحتياطي أدناه).
   ============================================================ */

/* ============ الاحتياطي: يعمل البث حتى لو حُذف ودجت «إعدادات البث المباشر» ============ */
if (typeof window.LIVE_CONFIG === 'undefined') {
    window.LIVE_CONFIG = {
        videoId: "HQnkyS2u-Ks",
        posterImage: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjqqEGaQfYWvucbm2JGaLWomhFRecJYYSxg7TLtEd-oHcqtuXMjy0IdTThDlp6HIXbTj3G4OmU16eok2yevyNX5PiQa5IJiHyIoHDCgIdb-WBndZmmb11VQksQi45o5W-_BAvBLRe98SrqiROPKSktAf6NlprmChmok1gxKpJctQzG9wgFjfjH_RBDLs7rU/s16000/1000264052.png"
    };
}
if (typeof window.getLiveUrl !== 'function') {
    window.getLiveUrl = function () {
        return "https://www.youtube.com/watch?v=" + window.LIVE_CONFIG.videoId;
    };
}

/* ============ S24Live: جلب إعدادات اللوحة وتطبيقها على المشغّلات ============ */
window.S24Live = (function () {
    var state = { mode: 'video', onAir: true, channelId: '', title: '' };
    var ready = null;
    var isLivePage = window.location.pathname === "/p/live.html";

    // رابط التضمين المباشر (iframe) للمصغّر ولوضع القناة في صفحة البث
    function embedUrl(extra) {
        var base = state.mode === 'channel' && state.channelId
            ? "https://www.youtube.com/embed/live_stream?channel=" + encodeURIComponent(state.channelId) + "&"
            : "https://www.youtube.com/embed/" + encodeURIComponent(window.LIVE_CONFIG.videoId) + "?";
        return base + extra;
    }
    var MINI_PARAMS = "autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1";

    function apply(d) {
        if (!d || !d.mode) return;                       // لا مستند أو فشل = يبقى LIVE_CONFIG كما هو
        state.mode = d.mode === 'channel' && d.channelId ? 'channel' : 'video';
        state.onAir = d.onAir !== false;
        state.channelId = d.channelId || '';
        state.title = d.title || '';
        if (d.videoId) window.LIVE_CONFIG.videoId = d.videoId;
        if (d.poster) window.LIVE_CONFIG.posterImage = d.poster;

        // صورة الغلاف في صفحة البث (ما دام المشغّل لم يبدأ)
        var poster = document.getElementById('main-fake-poster');
        if (poster && !isPlayerActive && window.LIVE_CONFIG.posterImage) poster.src = window.LIVE_CONFIG.posterImage;

        // المشغّل الجانبي في الرئيسية: الغلاف، أو الإخفاء حين يكون البث متوقفاً
        var side = document.querySelector('.live-tv-widget');
        if (side) {
            if (!state.onAir) side.style.display = 'none';
            var sp = document.getElementById('fake-poster-img');
            if (sp && !sidebarPlayerActive && window.LIVE_CONFIG.posterImage) sp.src = window.LIVE_CONFIG.posterImage;
        }

        // المشغّل المصغّر في الرئيسية
        var mini = document.getElementById('miniLiveWidget');
        if (mini) {
            if (!state.onAir) {
                if (typeof window.closeMiniLive === 'function') window.closeMiniLive();
                else mini.style.display = 'none';
            } else {
                var ifr = document.getElementById('mini-live-iframe');
                if (ifr && ifr.src && ifr.src !== 'about:blank') {
                    var u = embedUrl(MINI_PARAMS);
                    if (ifr.src !== u) ifr.src = u;
                }
            }
        }

        // صفحة البث: رسالة بدل زر التشغيل حين يكون البث متوقفاً
        if (isLivePage && !state.onAir) showOffAir();

        // صفحة البث: شريط القنوات تحت الشاشة (من المستند نفسه، بلا قراءة إضافية)
        if (isLivePage) renderStrip(d);

        try { document.dispatchEvent(new CustomEvent('s24:live-config', { detail: state })); } catch (e) {}
    }

    function showOffAir() {
        var overlay = document.getElementById('btn-overlay');
        if (!overlay || document.getElementById('s24-live-offair')) return;
        overlay.style.display = 'flex';
        overlay.innerHTML = '<div class="s24-live-offair" id="s24-live-offair" role="status">' +
            '<strong>البث متوقف حالياً</strong><span>تابعونا، سيعود البث المباشر قريباً</span></div>';
    }

    /* ============ شريط القنوات (صفحة البث فقط) ============
       channels: [{ name, kind 'video'|'channel', id, logo }] — حتى 10 قنوات.
       الضغط على قناة يبدّل المشغّل داخل متصفح الزائر فقط، ولا يقرأ من Firestore. */
    var ID_RE = { video: /^[\w-]{11}$/, channel: /^UC[\w-]{22}$/ };
    var strip = { items: [], active: -1 };

    function escTxt(v) {
        return String(v || '').replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
    }
    // صورة المصغّر: الشعار إن وُجد، وإلا صورة الفيديو من يوتيوب (القناة بلا شعار = الحرف الأول من اسمها)
    function thumbOf(c) {
        if (c.logo && /^https:\/\/[^\s"'<>]+$/i.test(c.logo)) return c.logo;
        return c.kind === 'video' ? 'https://i.ytimg.com/vi/' + c.id + '/mqdefault.jpg' : '';
    }

    function renderStrip(d) {
        var host = document.getElementById('main-video-placeholder');
        if (!host) return;
        var list = (Array.isArray(d.channels) ? d.channels : []).filter(function (c) {
            return c && ID_RE[c.kind] && ID_RE[c.kind].test(c.id || '');
        }).slice(0, 10);
        var box = document.getElementById('s24-ch-strip');
        if (!list.length) { if (box) box.remove(); return; }

        // البث الرئيسي أولاً (ما لم يكن متوقفاً)، ثم القنوات بلا تكرار
        var main = {
            name: state.title || 'البث الرئيسي', kind: state.mode,
            id: state.mode === 'channel' ? state.channelId : window.LIVE_CONFIG.videoId,
            logo: window.LIVE_CONFIG.posterImage
        };
        strip.items = state.onAir ? [main] : [];
        list.forEach(function (c) { if (!(c.kind === main.kind && c.id === main.id)) strip.items.push(c); });
        strip.active = state.onAir ? 0 : -1;

        if (!box) {
            box = document.createElement('div');
            box.id = 's24-ch-strip';
            box.className = 's24-ch-strip';
            box.setAttribute('role', 'group');
            box.setAttribute('aria-label', 'القنوات');
            host.insertAdjacentElement('afterend', box);
            // موضع الشريط المثبّت = موضع تثبيت الشاشة + ارتفاعها، يُقاس لحظياً
            // (يتغيّر مع حجم النافذة وظهور شريط العاجل)
            var pending = false;
            var setTop = function () {
                pending = false;
                var t = parseFloat(getComputedStyle(host).top) || 0;
                box.style.top = (t + host.offsetHeight) + 'px';
            };
            var queue = function () { if (!pending) { pending = true; requestAnimationFrame(setTop); } };
            setTop();
            if (window.ResizeObserver) new ResizeObserver(queue).observe(host);
            window.addEventListener('resize', queue);
            window.addEventListener('scroll', queue, { passive: true });
            box.addEventListener('click', function (e) {
                var b = e.target.closest('.s24-ch');
                if (b) switchTo(+b.getAttribute('data-i'));
            });
        }
        box.innerHTML = strip.items.map(function (c, i) {
            var t = thumbOf(c), on = i === strip.active;
            return '<button type="button" class="s24-ch' + (on ? ' is-active' : '') + '" data-i="' + i + '" aria-pressed="' + on + '">' +
                '<span class="s24-ch-thumb">' + (t ? '<img src="' + escTxt(t) + '" alt="" loading="lazy">' : '<b>' + escTxt((c.name || '؟').charAt(0)) + '</b>') + '</span>' +
                '<span class="s24-ch-name">' + escTxt(c.name || 'قناة') + '</span></button>';
        }).join('');
    }

    function switchTo(i) {
        var c = strip.items[i];
        if (!c || i === strip.active) return;
        strip.active = i;
        state.mode = c.kind;
        state.onAir = true;                       // اختيار الزائر لقناة = تشغيلها حتى لو كان الرئيسي متوقفاً
        state.title = c.name || '';
        if (c.kind === 'channel') state.channelId = c.id;
        else window.LIVE_CONFIG.videoId = c.id;
        var bs = document.querySelectorAll('#s24-ch-strip .s24-ch');
        for (var k = 0; k < bs.length; k++) {
            bs[k].classList.toggle('is-active', k === i);
            bs[k].setAttribute('aria-pressed', String(k === i));
        }
        restartMain();
    }

    function load() {
        var needed = isLivePage || document.getElementById('miniLiveWidget') || document.querySelector('.live-tv-widget');
        if (!needed || !window.S24Feed) { ready = Promise.resolve(); return; }
        ready = window.S24Feed.get('live_stream/current', {
            key: 's24_live_v1',
            ttl: isLivePage ? 60 * 1000 : 15 * 60 * 1000
        }).then(apply, function () {});
    }

    // ينتظر الإعدادات 3 ثوانٍ على الأكثر ثم ينفّذ (لا يتعطل التشغيل أبداً)
    function whenReady(fn) {
        var done = false;
        function go() { if (!done) { done = true; fn(); } }
        (ready || Promise.resolve()).then(go, go);
        setTimeout(go, 3000);
    }

    document.addEventListener("DOMContentLoaded", load);
    return { state: state, whenReady: whenReady, embedUrl: embedUrl, MINI_PARAMS: MINI_PARAMS, switchTo: switchTo };
})();

document.addEventListener("DOMContentLoaded", function() {
    // 1. تفعيل وضع صفحة البث عند الدخول لرابط البث
    // يقتصر وضع البث على صفحة /p/live.html وحدها (كان أي رابط فيه الحروف live يفعّله)
    if (window.location.pathname === "/p/live.html") {
        document.body.classList.add('live-page-mode'); 
        loadVideoLibs();
    }
    // المشغّل المصغّر في الرئيسية (الموبايل)
    initMiniLive();
    // المشغّل الجانبي في الرئيسية: الغلاف المبدئي وتحميل المكتبات مسبقاً
    if (document.querySelector('.live-tv-widget')) {
        var sp = document.getElementById('fake-poster-img');
        if (sp && window.LIVE_CONFIG.posterImage) sp.src = window.LIVE_CONFIG.posterImage;
        loadVideoLibs();
    }
});

// دوال تحميل المكتبات
function loadVideoLibs() {
    const VJS_CSS = "https://vjs.zencdn.net/7.20.3/video-js.css";
    const VJS_JS = "https://vjs.zencdn.net/7.20.3/video.min.js";
    const VJS_YT = "https://cdnjs.cloudflare.com/ajax/libs/videojs-youtube/2.6.1/Youtube.min.js";

    if (!document.querySelector(`link[href="${VJS_CSS}"]`)) {
        let link = document.createElement("link");
        link.rel = "stylesheet"; link.href = VJS_CSS;
        document.head.appendChild(link);
    }
    
    if(typeof LIVE_CONFIG !== 'undefined' && document.getElementById('main-fake-poster')) {
         document.getElementById('main-fake-poster').src = LIVE_CONFIG.posterImage;
    }

    if (!document.querySelector(`script[src="${VJS_JS}"]`)) {
        let s1 = document.createElement("script");
        s1.src = VJS_JS; s1.async = true;
        s1.onload = function() {
            let s2 = document.createElement("script");
            s2.src = VJS_YT; s2.async = true;
            document.head.appendChild(s2);
        };
        document.head.appendChild(s1);
    }
}

// ===== مظهر المشغّل (s24-skin): زرّا رجوع/تقديم 10 ثوانٍ وتعريب «مباشر» =====
function s24Skin(player) {
    player.addClass('s24-skin');
    if (window.videojs && videojs.addLanguage) videojs.addLanguage('ar', { 'LIVE': 'مباشر', 'Play': 'تشغيل', 'Pause': 'إيقاف', 'Mute': 'كتم', 'Unmute': 'صوت', 'Fullscreen': 'ملء الشاشة', 'Non-Fullscreen': 'خروج من ملء الشاشة' });
    var bar = player.getChild('controlBar');
    if (!bar || bar.getChild('s24Back')) return;
    [[-10, 'رجوع 10 ثوانٍ', 1], [10, 'تقديم 10 ثوانٍ', 2]].forEach(function (s) {
        var b = bar.addChild('button', { name: s[0] < 0 ? 's24Back' : 's24Fwd' }, s[2]);
        b.addClass('s24-seek');
        b.controlText(s[1]);
        // سهم دائري مع الرقم 10 (يُعكس السهم فقط للتقديم)
        b.el().insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 24 24" aria-hidden="true"><g' + (s[0] > 0 ? ' transform="matrix(-1 0 0 1 24 0)"' : '') +
            '><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 3.5v4h4"/></g><text x="12" y="15.3" text-anchor="middle">10</text></svg>');
        b.on('click', function () {
            var t = player.currentTime() + s[0], d = player.duration();
            if (d && isFinite(d)) t = Math.min(t, d);
            player.currentTime(Math.max(0, t));
        });
    });
}

// دوال التشغيل
var isPlayerActive = false;

// إعادة تشغيل الشاشة الرئيسية بالمصدر الجديد بعد اختيار قناة من الشريط
function restartMain() {
    var overlay = document.getElementById('btn-overlay');
    if (overlay && document.getElementById('s24-live-offair')) {
        // إزالة رسالة «البث متوقف» وإعادة زر التشغيل
        overlay.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>';
    }
    if (!isPlayerActive) { playFast(); return; }
    var old = window.videojs && videojs.getPlayer && videojs.getPlayer('rt-live-page-player');
    if (old) old.dispose();
    document.getElementById('main-real-player-target').innerHTML = '';
    document.getElementById('fast-loader').style.display = 'block';
    launchPlayer();
}
function playFast() {
    if(isPlayerActive) return;
    if (!S24Live.state.onAir) return;   // البث متوقف من اللوحة
    isPlayerActive = true;
    var oldError = document.getElementById('main-load-error');
    if (oldError) oldError.remove();
    document.getElementById('btn-overlay').style.display = 'none';
    document.getElementById('fast-loader').style.display = 'block';

    var mainAttempts = 0;
    var mainMaxAttempts = 100; // 🟢 إصلاح: 100 × 100ms = مهلة 10 ثوانٍ كحد أقصى بدل الانتظار للأبد
    let checkInterval = setInterval(function() {
        if (typeof videojs !== 'undefined') {
            clearInterval(checkInterval);
            S24Live.whenReady(launchPlayer);
        } else if (++mainAttempts >= mainMaxAttempts) {
            clearInterval(checkInterval);
            var loader = document.getElementById('fast-loader');
            if (loader) {
                loader.style.display = 'none';
                loader.insertAdjacentHTML('afterend', '<div class="video-load-error" id="main-load-error">تعذّر تحميل المشغّل، اضغط للمحاولة مجدداً</div>');
            }
            var btn = document.getElementById('btn-overlay');
            if (btn) btn.style.display = 'flex';
            isPlayerActive = false; // للسماح بإعادة المحاولة عند الضغط مجدداً
        }
    }, 100);
}

function launchPlayer() {
    const target = document.getElementById('main-real-player-target');

    // وضع القناة: البث الجاري للقناة لا رقم له، فيُعرض بمشغّل يوتيوب المضمّن بدل VideoJS
    if (S24Live.state.mode === 'channel') {
        target.innerHTML = '<iframe id="rt-live-page-iframe" src="' + S24Live.embedUrl('autoplay=1&rel=0&modestbranding=1&playsinline=1') +
            '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen frameborder="0" title="البث المباشر"></iframe>';
        target.querySelector('iframe').addEventListener('load', function () {
            document.getElementById('fast-loader').style.display = 'none';
            document.getElementById('main-fake-poster').style.display = 'none';
        });
        return;
    }
    target.innerHTML = `<video id="rt-live-page-player" class="video-js vjs-default-skin vjs-big-play-centered" controls autoplay preload="auto" disablePictureInPicture playsinline webkit-playsinline></video>`;

    var player = videojs('rt-live-page-player', {
        techOrder: ["youtube"],
        sources: [{ "type": "video/youtube", "src": getLiveUrl() }],
        youtube: { 
            "iv_load_policy": 3, 
            "modestbranding": 1, 
            "rel": 0, 
            "autoplay": 1,
            "playsinline": 1, // مهم جداً للموبايل
            "fs": 0 // منع ملء الشاشة التلقائي
        },
        controlBar: { pictureInPictureToggle: false, liveDisplay: true },
        liveui: true,
        language: 'ar'
    });

    player.ready(function() {
        s24Skin(player);
        player.play();
        
        // --- 🟢 كود Media Session للتحكم من شاشة القفل 🟢 ---
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: S24Live.state.title || 'Syria24News Live',
                artist: 'بث مباشر',
                album: 'S24News',
                artwork: [
                    { src: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgeuurJSEqv95Xbqa7rYRACLNXO6YFHA1YhWsH_3pb57sA_g01cDkD44MGxWQNDTJNeO4Ol2tRAOOBMVWPKoahUXss3sbQMmHQu3GzRmE3FpAK7r6NDzRx3joLDgGgkduyZU0vmx1AoZinzDhehul5DDuR_9J30CnAAS9hyE1AekqBKk2nynpp2UlqZT7Hf/s16000/logo24sn.png', sizes: '96x96', type: 'image/png' },
                    { src: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgeuurJSEqv95Xbqa7rYRACLNXO6YFHA1YhWsH_3pb57sA_g01cDkD44MGxWQNDTJNeO4Ol2tRAOOBMVWPKoahUXss3sbQMmHQu3GzRmE3FpAK7r6NDzRx3joLDgGgkduyZU0vmx1AoZinzDhehul5DDuR_9J30CnAAS9hyE1AekqBKk2nynpp2UlqZT7Hf/s16000/logo24sn.png', sizes: '192x192', type: 'image/png' }
                ]
            });

            // تفعيل أزرار شاشة القفل
            navigator.mediaSession.setActionHandler('play', function() { player.play(); });
            navigator.mediaSession.setActionHandler('pause', function() { player.pause(); });
            navigator.mediaSession.setActionHandler('stop', function() { player.pause(); });
        }

        player.on('playing', function() {
            document.getElementById('fast-loader').style.display = 'none';
            document.getElementById('main-fake-poster').style.display = 'none';
        });
        
        // --- 🟢 محاولة فرض التشغيل عند إطفاء الشاشة 🟢 ---
        // هذا الكود يراقب حالة الصفحة، إذا تم إخفاؤها يحاول إعادة التشغيل
        document.addEventListener("visibilitychange", function() {
            if (player.isDisposed() || !document.hidden) return; // مشغّل قديم بعد تبديل القناة
            if (!player.paused()) { // لا يُستأنف البث إن كان المستخدم قد أوقفه بنفسه
                // إذا أطفأ المستخدم الشاشة، نحاول الاستمرار في التشغيل
                setTimeout(function(){
                    if(player.paused()) {
                        player.play().catch(function(e){});
                    }
                }, 300);
            }
        });
    });

    // تحديث شريط الوقت والنقطة الحمراء
    player.on('timeupdate', function() {
        var isLive = false;
        if (player.liveTracker && player.liveTracker.atLiveEdge()) { isLive = true; } 
        else {
            var duration = player.duration();
            var currentTime = player.currentTime();
            if (duration > 0 && (duration - currentTime) < 20) { isLive = true; }
        }
        if (isLive) player.addClass('is-at-live-edge');
        else player.removeClass('is-at-live-edge');
        
        // تحديث حالة التشغيل لشاشة القفل
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = player.paused() ? 'paused' : 'playing';
        }
    });
}

/* ============================================================
   المشغّل الجانبي في الرئيسية (.live-tv-widget)
   نُقل من القالب (18 أكتوبر 2026). playSidebarFast تُستدعى من onclick في القالب.
   ============================================================ */
var sidebarPlayerActive = false;

function playSidebarFast() {
    if (sidebarPlayerActive) return;
    if (!S24Live.state.onAir) return;   // البث متوقف من اللوحة
    sidebarPlayerActive = true;
    var oldError = document.getElementById('sidebar-load-error');
    if (oldError) oldError.remove();
    document.getElementById('sidebar-play-btn').style.display = 'none';
    document.getElementById('sidebar-loader').style.display = 'block';

    var sbAttempts = 0;
    var sbMaxAttempts = 100; // 100 × 100ms = مهلة 10 ثوانٍ كحد أقصى
    var checkInterval = setInterval(function () {
        if (typeof videojs !== 'undefined' || S24Live.state.mode === 'channel') {
            clearInterval(checkInterval);
            S24Live.whenReady(launchSidebarPlayer);
        } else if (++sbAttempts >= sbMaxAttempts) {
            clearInterval(checkInterval);
            var loader = document.getElementById('sidebar-loader');
            if (loader) {
                loader.style.display = 'none';
                loader.insertAdjacentHTML('afterend', '<div class="video-load-error" id="sidebar-load-error">تعذّر تحميل المشغّل، اضغط للمحاولة مجدداً</div>');
            }
            var btn = document.getElementById('sidebar-play-btn');
            if (btn) btn.style.display = 'flex';
            sidebarPlayerActive = false; // للسماح بإعادة المحاولة عند الضغط مجدداً
        }
    }, 100);
}

function launchSidebarPlayer() {
    var container = document.getElementById('real-player-container');
    function hideCover() {
        document.getElementById('sidebar-loader').style.display = 'none';
        document.getElementById('fake-poster-img').style.display = 'none';
    }

    // وضع القناة: مشغّل يوتيوب المضمّن (البث الجاري للقناة لا رقم له)
    if (S24Live.state.mode === 'channel') {
        container.innerHTML = '<iframe id="rt-sidebar-iframe" src="' + S24Live.embedUrl('autoplay=1&rel=0&modestbranding=1&playsinline=1') +
            '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen frameborder="0" title="البث المباشر"></iframe>';
        container.querySelector('iframe').addEventListener('load', hideCover);
        return;
    }

    container.innerHTML = '<video id="rt-sidebar-player" class="video-js vjs-default-skin" controls autoplay preload="auto" disablePictureInPicture></video>';
    var player = videojs('rt-sidebar-player', {
        techOrder: ["youtube"],
        sources: [{ "type": "video/youtube", "src": getLiveUrl() }],
        youtube: { "iv_load_policy": 3, "modestbranding": 1, "rel": 0, "autoplay": 1 },
        controlBar: { pictureInPictureToggle: false, liveDisplay: true },
        liveui: true,
        language: 'ar'
    });

    player.ready(function () {
        s24Skin(player);
        player.play();
        player.on('playing', hideCover);
    });

    // النقطة الحمراء عند حافة البث
    player.on('timeupdate', function () {
        var isLive = false;
        if (player.liveTracker && player.liveTracker.atLiveEdge()) { isLive = true; }
        else {
            var duration = player.duration();
            var currentTime = player.currentTime();
            if (duration > 0 && (duration - currentTime) < 20) { isLive = true; }
        }
        if (isLive) player.addClass('is-at-live-edge');
        else player.removeClass('is-at-live-edge');
    });
}

/* ============================================================
   المشغّل المصغّر في الرئيسية (#miniLiveWidget) — للشاشات حتى 768px
   نُقل من القالب (18 أكتوبر 2026). closeMiniLive تُستدعى من onclick في القالب.
   يُحمَّل الإطار بعد وصول إعدادات اللوحة، فيبدأ بالبث الصحيح من أول مرة.
   ============================================================ */
function initMiniLive() {
    var widget = document.getElementById('miniLiveWidget');
    var iframe = document.getElementById('mini-live-iframe');
    if (!widget || !iframe) return;

    function start() {
        if (!S24Live.state.onAir || widget.style.display === 'none') return;
        if (iframe.src && iframe.src !== 'about:blank') return;
        iframe.src = S24Live.embedUrl(S24Live.MINI_PARAMS);
    }
    S24Live.whenReady(function () {
        if (window.innerWidth <= 768) start();
        else window.addEventListener('resize', function () {
            if (window.innerWidth <= 768) start();
        });
    });
}

function closeMiniLive() {
    var widget = document.getElementById('miniLiveWidget');
    if (!widget) return;
    widget.style.display = 'none';
    var iframe = document.getElementById('mini-live-iframe');
    if (iframe) iframe.src = 'about:blank';
    // إعادة زر العودة للأعلى إلى مكانه بعد إغلاق المصغّر
    var arrow = document.querySelector('.progress-wrap');
    if (arrow) arrow.style.setProperty('bottom', '20px', 'important');
}
