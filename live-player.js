/* ============================================================
   S24News — مشغّل البث المباشر (playFast / loadVideoLibs)
   playFast تُستدعى من onclick داخل HTML القالب — يجب أن تبقى دالة عامة

   الإصدار 2.7 — 2 نوفمبر 2026: المشغّل المرافق يتبع القارئ بين الصفحات (الكمبيوتر)، و?ch= لفتح صفحة البث على قناة
                (سطر القنوات تحت المشغّل الجانبي في الرئيسية حُذف بقرار حسان)
   الإصدار 2.6 — 1 نوفمبر 2026: التغطية المباشرة النشطة (آخر 5 أخبار) تحت الشاشة فوق «أحدث الأخبار»
   الإصدار 2.5 — 1 نوفمبر 2026: المشغّل العائم على الكمبيوتر (يُسحب ويُحفظ موضعه) حين يخرج الصندوق من الصورة
   الإصدار 2.4 — 1 نوفمبر 2026: «أحدث الأخبار» أولاً ثم «شاهد أيضاً» تحتها؛ وتثبيت الشاشة فوق الأخبار على الموبايل
   الإصدار 2.3 — 1 نوفمبر 2026: «شاهد أيضاً» تحت صندوق البث (فيديوهات *V)، و«أحدث الأخبار» احتياطاً
   الإصدار 2.2 — 1 نوفمبر 2026: على الشاشات العريضة (≥1450px) الشاشة يميناً والقنوات يساراً
                داخل العمود الأوسط، و«أحدث الأخبار» تحت صندوق البث (خلاصة بلوغر)
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
        lastDoc = d;
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

    /* ============ تخطيط صفحة البث (2.2) ============
       غلاف .s24-live-split يجمع الشاشة وشريط القنوات: على الشاشات العريضة (≥1450px) صف واحد
       مثبّت، الشاشة يميناً والقنوات يساراً؛ وتحت ذلك display: contents فيبقى الشريط تحت الشاشة.
       يُبنى عند تحميل الصفحة قبل تشغيل أي مشغّل، لأن نقل إطار يوتيوب بعد تشغيله يعيد تحميله. */
    function ensureSplit() {
        var host = document.getElementById('main-video-placeholder');
        if (!host) return null;
        var split = host.parentElement;
        if (split && split.classList.contains('s24-live-split')) return split;
        split = document.createElement('div');
        split.className = 's24-live-split';
        host.insertAdjacentElement('beforebegin', split);
        split.appendChild(host);
        return split;
    }

    /* تحت صندوق البث، في موضع «إقرأ المزيد» نفسه في المقالات (بعد .post.hentry) — 2.4:
       أولاً «أحدث الأخبار» (3 بطاقات .sy-related-*)، ثم تحتها «شاهد أيضاً»: شريط أفقي من فيديوهات
       الموقع (الوسم *V، كسلايدر الرئيسية والشورتس)، كل بطاقة تفتح الفيديو في مشغّل الشورتس.
       يُحجز موضع القسمين فوراً بالترتيب، فلا يتبدّل ترتيبهما مهما سبق أحد الطلبين الآخر.
       المصدر خلاصة بلوغر في الحالتين: بلا أي كلفة على Firestore. */
    var VIDEO_LABEL = '*V', VIDEO_COUNT = 8, LATEST_COUNT = 3;
    var THUMB_PH = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23222'/%3E%3C/svg%3E";
    function feedLink(e) {
        var l = (e.link || []).filter(function (x) { return x.rel === 'alternate'; })[0];
        return l ? l.href : '';
    }
    function feedThumb(e) {
        return e.media$thumbnail ? e.media$thumbnail.url
            .replace(/\/s[0-9]+(-c)?\//, '/w400-h225-c/')
            .replace(/=s[0-9]+(-c)?$/, '=w400-h225-c') : '';
    }
    function getFeed(url) {
        return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (d) { return ((d.feed || {}).entry || []).filter(feedLink); });
    }
    // قسم فارغ مخفي يُملأ حين تصل بياناته
    function section(id) {
        var box = document.createElement('div');
        box.id = id;
        box.className = 'sy-related-posts-container';
        box.hidden = true;
        return box;
    }
    function fill(box, title, body) {
        var h = document.createElement('h3');
        h.className = 'sy-related-main-title';
        h.textContent = title;
        box.appendChild(h);
        box.appendChild(body);
        box.hidden = false;
    }
    /* ============ التغطية المباشرة تحت الشاشة (2.6) ============
       إن كانت هناك تغطية ظاهرة (بمنطق صندوق الرئيسية نفسه: مثبّتة، أو نشطة وفيها خبر خلال 24 ساعة)
       يظهر فوق «أحدث الأخبار» آخر 5 أخبار منها مع رابط التغطية كاملة؛ وإلا لا يظهر شيء.
       القراءات: مستند coverage_groups/current (عبر S24Feed) + استعلام واحد حتى 8 أخبار، وكلاهما
       مخبّأ 5 دقائق على جهاز الزائر؛ ويُحدَّث كل 5 دقائق ما دامت الصفحة ظاهرة والتغطية قائمة. */
    var COV_TTL = 5 * 60 * 1000, COV_SHOW = 5, COV_WINDOW = 24 * 60 * 60 * 1000;
    var FS_QUERY = 'https://firestore.googleapis.com/v1/projects/s24n-views/databases/(default)/documents:runQuery';
    function covNum(v) { return Number(v) || 0; }
    function covShown(id, d, now) {
        var st = (d.statuses || {})[id] || 'active';
        if (st === 'pinned') return true;
        if (st === 'closed' || st === 'inactive') return false;
        var last = covNum((d.lastAt || {})[id]), start = covNum((d.since || {})[id]);
        return !!last && last >= start && last >= now - COV_WINDOW;
    }
    function covPick(d) {
        var now = Date.now(), best = null;
        Object.keys(d.groups || {}).forEach(function (id) {
            if (!covShown(id, d, now)) return;
            var pinned = (d.statuses || {})[id] === 'pinned';
            var last = covNum((d.lastAt || {})[id]);
            if (!best || (pinned && !best.pinned) || (pinned === best.pinned && last > best.last))
                best = { id: id, name: d.groups[id], pinned: pinned, last: last, since: covNum((d.since || {})[id]) };
        });
        return best;
    }
    function covItems(g) {
        var key = 's24_live_cov_' + g.id;
        var c = window.S24Cache && window.S24Cache.get(key, COV_TTL);
        if (c && c.last === g.last) return Promise.resolve(c.items);
        return fetch(FS_QUERY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ structuredQuery: {
                from: [{ collectionId: 'live_coverage' }],
                where: { fieldFilter: { field: { fieldPath: 'groupId' }, op: 'EQUAL', value: { stringValue: g.id } } },
                orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }],
                limit: 8
            } })
        }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function (rows) {
              var items = (rows || []).filter(function (x) { return x.document; }).map(function (x) {
                  return window.S24Feed.fsVal({ mapValue: { fields: x.document.fields || {} } }) || {};
              }).filter(function (n) {
                  return !n.hidden && n.title && covNum(n.timestamp) >= g.since;   // كما في lbs24n: الأقدم من بداية التغطية لا يُعرض
              }).slice(0, COV_SHOW).map(function (n) {
                  return { t: covNum(n.timestamp), title: n.title, url: n.url || '', urgent: !!n.isUrgent };
              });
              if (window.S24Cache) window.S24Cache.set(key, { last: g.last, items: items });
              return items;
          });
    }
    var covFmt = null;
    function covTime(ms) {
        try {
            covFmt = covFmt || new Intl.DateTimeFormat('ar-u-nu-latn', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Damascus' });
            return covFmt.format(new Date(ms));
        } catch (e) { return ''; }
    }
    function renderCoverage(box) {
        if (!window.S24Feed) return;
        var draw = function () {
            if (document.hidden) return;
            window.S24Feed.get('coverage_groups/current', { key: 's24_live_cov_groups', ttl: COV_TTL }).then(function (d) {
                var g = d && covPick(d);
                if (!g) { box.hidden = true; box.innerHTML = ''; return null; }
                return covItems(g).then(function (items) {
                    if (!items.length) { box.hidden = true; box.innerHTML = ''; return; }
                    box.innerHTML = '';
                    var head = document.createElement('div');
                    head.className = 's24-cov-head';
                    head.innerHTML = '<h3 class="sy-related-main-title"><span class="pulse-dot" aria-hidden="true"></span> تغطية مباشرة: <span class="s24-cov-name"></span></h3>' +
                        '<a class="s24-cov-all">التغطية كاملة &rsaquo;</a>';
                    head.querySelector('.s24-cov-name').textContent = g.name || '';
                    head.querySelector('.s24-cov-all').href = '/p/lbs24n.html?tab=' + encodeURIComponent(g.id);
                    var list = document.createElement('ol');
                    list.className = 's24-cov-list';
                    items.forEach(function (n) {
                        var li = document.createElement('li');
                        li.className = 's24-cov-item' + (n.urgent ? ' is-urgent' : '');
                        var el = document.createElement(n.url ? 'a' : 'span');
                        el.className = 's24-cov-link';
                        if (n.url) el.href = n.url;
                        el.innerHTML = '<time class="s24-cov-time"></time><span class="s24-cov-title"></span>';
                        el.querySelector('time').textContent = covTime(n.t);
                        el.querySelector('time').setAttribute('datetime', new Date(n.t).toISOString());
                        el.querySelector('.s24-cov-title').textContent = n.title;
                        li.appendChild(el);
                        list.appendChild(li);
                    });
                    box.appendChild(head);
                    box.appendChild(list);
                    box.hidden = false;
                });
            }).catch(function () {});
        };
        draw();
        setInterval(draw, COV_TTL);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) draw(); });
    }

    function renderMore() {
        var host = document.getElementById('main-video-placeholder');
        var anchor = host && (host.closest('.post.hentry') || host.closest('.live-stream-wrapper'));
        if (!anchor || document.getElementById('s24-live-latest')) return;
        var cov = section('s24-live-cov'), latest = section('s24-live-latest'), watch = section('s24-live-watch');
        anchor.insertAdjacentElement('afterend', cov);
        cov.insertAdjacentElement('afterend', latest);
        latest.insertAdjacentElement('afterend', watch);

        // 0) التغطية المباشرة النشطة (إن وُجدت) فوق كل شيء — 2.6
        renderCoverage(cov);

        // 1) أحدث الأخبار (بلا مقالات الموسوعة)
        getFeed('/feeds/posts/summary?alt=json&max-results=' + (LATEST_COUNT + 6)).then(function (all) {
            var list = all.filter(function (e) {
                return !(e.category || []).some(function (c) { return c.term === 'الموسوعة'; });
            }).slice(0, LATEST_COUNT);
            if (!list.length) return;
            var grid = document.createElement('div');
            grid.className = 'sy-related-grid';
            list.forEach(function (e) {
                var a = document.createElement('a');
                a.className = 'sy-related-card';
                a.href = feedLink(e);
                a.innerHTML = '<div class="sy-related-thumb"><img loading="lazy" alt=""></div>' +
                    '<div class="sy-related-info"><h3 class="sy-related-card-title"></h3></div>';
                var src = feedThumb(e);
                if (src) a.querySelector('img').src = src;
                a.querySelector('h3').textContent = e.title.$t;
                grid.appendChild(a);
            });
            fill(latest, 'أحدث الأخبار', grid);
        }).catch(function () {});

        // 2) شاهد أيضاً (لا يظهر إن لم توجد فيديوهات)
        getFeed('/feeds/posts/summary/-/' + encodeURIComponent(VIDEO_LABEL) +
                '?alt=json&orderby=published&max-results=' + VIDEO_COUNT).then(function (list) {
            if (!list.length) return;
            var row = document.createElement('div');
            row.className = 's24-watch-row';
            list.forEach(function (e) {
                var m = (e.id.$t || '').match(/post-(\d+)/);
                var a = document.createElement('a');
                a.className = 's24-watch-card';
                a.href = m ? '/p/shorts.html?id=' + m[1] : feedLink(e);
                a.innerHTML = '<span class="s24-watch-thumb"><img loading="lazy" alt="">' +
                    '<span class="s24-watch-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' +
                    '<span class="s24-watch-tag">فيديو</span></span>' +
                    '<span class="s24-watch-title"></span>';
                a.querySelector('img').src = feedThumb(e) || THUMB_PH;
                a.querySelector('.s24-watch-title').textContent = e.title.$t;
                row.appendChild(a);
            });
            fill(watch, 'شاهد أيضاً', row);
        }).catch(function () {});
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
        strip.hasMain = state.onAir;
        list.forEach(function (c) { if (!(c.kind === main.kind && c.id === main.id)) strip.items.push(c); });
        strip.active = state.onAir ? 0 : -1;

        // القناة المطلوبة (2.7): ?ch= من سطر الرئيسية، أو القناة التي يتبعها المشغّل المرافق — تُختار دون تشغيل
        if (!strip.picked) {
            strip.picked = true;
            var want = '';
            try { want = new URLSearchParams(location.search).get('ch') || ''; } catch (e) {}
            if (!want) { var f = followGet(); if (f && !f.main) want = f.id; }
            for (var w = 0; want && w < strip.items.length; w++) {
                if (strip.items[w].id === want) { if (w !== strip.active) select(w); break; }
            }
        }

        if (!box) {
            box = document.createElement('div');
            box.id = 's24-ch-strip';
            box.className = 's24-ch-strip';
            box.setAttribute('role', 'group');
            box.setAttribute('aria-label', 'القنوات');
            ensureSplit().appendChild(box);
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
        ss(FOLLOW_OFF, null);                     // اختيار قناة = عودة للمتابعة إن كان القارئ قد أغلق المرافق
        select(i);
        restartMain();
    }

    // اختيار قناة في الشريط دون تشغيل (2.7)
    function select(i) {
        var c = strip.items[i];
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
        var poster = document.getElementById('main-fake-poster');
        if (poster && !window.isPlayerActive && c.kind === 'video') poster.src = 'https://i.ytimg.com/vi/' + c.id + '/hqdefault.jpg';
    }

    /* ============ المشغّل العائم (2.5) — الكمبيوتر فقط (≥1024px) ============
       حين يخرج صندوق البث من الصورة أثناء التمرير، ينتقل المشغّل نفسه إلى نافذة صغيرة عائمة
       (position: fixed — لا يُنقل العنصر في الصفحة، فلا يُعاد تحميل إطار يوتيوب). يسحبها القارئ
       من شريطها الأسود إلى أي مكان ويُحفظ موضعها؛ ⤒ يعيد للشاشة، ✕ يغلقها حتى يعود للصندوق.
       لا تظهر إلا بعد تشغيل البث. على الموبايل الشاشة مثبّتة أصلاً (2.4)، فلا عائم. */
    function initFloat() {
        var host = document.getElementById('main-video-placeholder');
        var box = host && host.closest('.live-stream-wrapper');
        if (!host || !box || document.querySelector('.s24-float-bar')) return;
        // الحجم مشترك مع المرافق (3 نوفمبر 2026): أساسي 380، من 240 إلى 640 بالسحب من المقبض
        var W = pSize(), H = 0, BAR = 30, FOOT = 14, KEY = 's24_float_pos';
        var mq = window.matchMedia('(min-width: 1024px)');

        var bar = document.createElement('div');
        bar.className = 's24-float-bar';
        bar.innerHTML = '<span><span class="s24-float-dot">●</span> مباشر</span><span>' +
            '<button type="button" data-a="up" title="العودة إلى الشاشة" aria-label="العودة إلى الشاشة">⤒</button>' +
            '<button type="button" data-a="x" title="إغلاق" aria-label="إغلاق">✕</button></span>';
        // شريط سفلي رفيع للمقبض حين يكون المشغّل في النصف الأعلى من الشاشة (لا شيء فوق الفيديو)
        var foot = document.createElement('div');
        foot.className = 's24-float-foot';
        var rs = document.createElement('span');
        rs.className = 's24-follow-rs s24-float-rs';
        rs.title = 'اسحب لتكبير المشغّل أو تصغيره';
        rs.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 10 L10 2 M2 14 L14 2"/></svg>';
        document.body.appendChild(bar);
        document.body.appendChild(foot);

        var pos = null;
        try { pos = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
        if (!pos || typeof pos.x !== 'number') pos = { x: 20, y: window.innerHeight - Math.round(W * 9 / 16) - BAR - 90 };

        // الحاويات المثبّتة (sticky) حول الشاشة تصنع طبقة أدنى من الهيدر (z-index 10000)، فكان الهيدر يغطي
        // الفيديو في صفحة البث وحدها (3 نوفمبر 2026). ما دام عائماً تُرفع طبقاتها فوق الهيدر ثم تُعاد.
        var lifted = [];
        function lift(on) {
            if (!on) { lifted.forEach(function (el) { el.style.removeProperty('z-index'); }); lifted = []; return; }
            for (var el = host.parentElement; el && el !== document.body; el = el.parentElement) {
                var cs = getComputedStyle(el);
                if (cs.position !== 'static' && cs.zIndex !== 'auto') { el.style.setProperty('z-index', '10001', 'important'); lifted.push(el); }
            }
        }
        var gripB = false, gripR = false;
        function size() {
            var iw = document.documentElement.clientWidth;
            var w = Math.min(Math.max(W, P_MIN), Math.max(P_MIN, Math.min(P_MAX, iw - 32)));
            H = Math.round(w * 9 / 16);
            [host, bar, foot].forEach(function (el) { el.style.setProperty('--s24-fw', w + 'px'); });
            host.style.setProperty('--s24-fh', H + 'px');
            return w;
        }
        function extra() { return BAR + H + (gripB ? FOOT : 0); }
        // المقبض في الزاوية المقابلة قُطرياً لربع الشاشة الذي فيه المشغّل (كالمرافق)
        function gripSide(w) {
            gripR = pos.x + w / 2 < document.documentElement.clientWidth / 2;
            gripB = pos.y + (BAR + H) / 2 < window.innerHeight / 2;
            (gripB ? foot : bar).appendChild(rs);
            bar.classList.toggle('grip-r', gripR); foot.classList.toggle('grip-r', gripR);
            bar.classList.toggle('grip-b', gripB);
            foot.classList.toggle('on', floating && gripB);
        }
        // الموضع يُكتب بأولوية important ليغلب قواعد التثبيت (top !important) في s24-main.css
        function draw(w) {
            bar.style.left = pos.x + 'px';
            bar.style.top = pos.y + 'px';
            host.style.setProperty('left', pos.x + 'px', 'important');
            host.style.setProperty('top', (pos.y + BAR) + 'px', 'important');
            foot.style.left = pos.x + 'px';
            foot.style.top = (pos.y + BAR + H) + 'px';
        }
        function place() {
            var w = size();
            gripSide(w);
            pos.x = Math.min(Math.max(0, pos.x), Math.max(0, document.documentElement.clientWidth - w));
            pos.y = Math.min(Math.max(0, pos.y), Math.max(0, window.innerHeight - extra()));
            draw(w);
        }
        var floating = false, dismissed = false;
        function started() { return !!host.querySelector('.video-js, iframe'); }
        function setFloat(on) {
            if (on === floating) return;
            floating = on;
            if (on) { box.style.minHeight = box.offsetHeight + 'px'; lift(true); place(); }   // حجز المكان فلا تقفز الصفحة
            else { box.style.minHeight = ''; lift(false); host.style.removeProperty('left'); host.style.removeProperty('top'); }
            host.classList.toggle('s24-float', on);
            bar.classList.toggle('on', on);
            foot.classList.toggle('on', on && gripB);
        }
        function check() {
            if (!mq.matches) return setFloat(false);
            var top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-top-offset')) || 0;
            var out = box.getBoundingClientRect().bottom < top + 60;
            if (!out) dismissed = false;
            setFloat(out && !dismissed && started());
        }
        var queued = false;
        window.addEventListener('scroll', function () {
            if (queued) return;
            queued = true;
            requestAnimationFrame(function () { queued = false; check(); });
        }, { passive: true });
        window.addEventListener('resize', function () { if (floating) place(); check(); });

        // السحب من الشريط إلى أي مكان، فوق كل شيء حتى الهيدر (لا من الفيديو، كي تبقى أزرار المشغّل تعمل)
        var drag = null;
        bar.addEventListener('pointerdown', function (e) {
            if (e.target.closest('button') || e.target.closest('.s24-float-rs')) return;
            drag = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
            bar.setPointerCapture(e.pointerId);
            bar.classList.add('drag');
            document.body.classList.add('s24-dragging');
        });
        bar.addEventListener('pointermove', function (e) {
            if (!drag) return;
            var w = size();
            pos.x = Math.min(Math.max(0, e.clientX - drag.dx), Math.max(0, document.documentElement.clientWidth - w));
            pos.y = Math.min(Math.max(0, e.clientY - drag.dy), Math.max(0, window.innerHeight - extra()));
            draw(w);
        });
        function endDrag() {
            if (!drag) return;
            drag = null;
            bar.classList.remove('drag');
            document.body.classList.remove('s24-dragging');
            place();
            try { localStorage.setItem(KEY, JSON.stringify(pos)); } catch (e) {}
        }
        bar.addEventListener('pointerup', endDrag);
        bar.addEventListener('pointercancel', endDrag);

        // تغيير الحجم: الحافة المقابلة للمقبض ثابتة
        var rz = null;
        rs.addEventListener('pointerdown', function (e) {
            var w = size();
            rz = { x: e.clientX, w: w, right: pos.x + w, bottom: pos.y + extra(), fromLeft: gripR, fromTop: gripB };
            rs.setPointerCapture(e.pointerId);
            document.body.classList.add('s24-dragging');
            e.preventDefault();
            e.stopPropagation();
        });
        rs.addEventListener('pointermove', function (e) {
            if (!rz) return;
            var dx = e.clientX - rz.x;
            W = Math.min(Math.max(rz.w + (rz.fromLeft ? dx : -dx), P_MIN), P_MAX);
            var w = size();
            if (!rz.fromLeft) pos.x = rz.right - w;
            if (!rz.fromTop) pos.y = rz.bottom - extra();
            draw(w);
        });
        function endResize() {
            if (!rz) return;
            rz = null;
            document.body.classList.remove('s24-dragging');
            W = size();
            pSave(W);
            place();
            try { localStorage.setItem(KEY, JSON.stringify(pos)); } catch (e) {}
        }
        rs.addEventListener('pointerup', endResize);
        rs.addEventListener('pointercancel', endResize);

        bar.addEventListener('click', function (e) {
            var b = e.target.closest('button');
            if (!b) return;
            if (b.getAttribute('data-a') === 'x') { dismissed = true; setFloat(false); ss(FOLLOW_OFF, '1'); ss(FOLLOW, null); }
            else box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    /* ============ المشغّل المرافق (2.7) — يتبع القارئ بين الصفحات، الكمبيوتر فقط (≥1024px) ============
       يبدأ حين يغادر القارئ صفحة البث والبث يعمل: تُحفظ القناة التي يشاهدها في هذا التبويب (sessionStorage)،
       وفي كل صفحة بعدها يظهر مشغّل يوتيوب عائم بالقناة نفسها بعد اكتمال تحميل الصفحة، إلى أن يضغط ✕.
       - مكتوم في البداية (شرط المتصفحات ويوتيوب)؛ إن شغّل القارئ الصوت مرة يعود وحده مع أول نقرة في الصفحة.
       - الموضع والحجم يُحفظان؛ يلتصق بأقرب زاوية، وينزاح عن أماكن الإعلانات (سياسة أدسنس).
       - الحجم بين 330 بكسل (عرض المشغّل الجانبي في الرئيسية، بقرار حسان) و640 أو ثلث الشاشة، بمقبض في الشريط.
       - زر «–» يوقف البث ويطوي المشغّل إلى شريط «● مباشر · القناة ▶ مشاهدة» (2.7.1).
       - مشغّل واحد يعمل: إن شغّل القارئ فيديو آخر يتوقف المرافق، ويعود بزر «▶ متابعة» في الشريط.
       - لا شيء فوق إطار يوتيوب (شرط يوتيوب): المقبض والأزرار كلها في الشريط الأسود (2.7.2).
       - القناة المحذوفة من الشريط تعود إلى البث الرئيسي، والبث الرئيسي المتوقف من اللوحة يخفي المرافق.
       - Google Analytics: الحدث s24_live_follow (show / close / unmute / minimize / resume). */
    var FOLLOW = 's24_follow', FOLLOW_OFF = 's24_follow_off', FOLLOW_SND = 's24_follow_snd',
        FOLLOW_MIN = 's24_follow_min', FPOS = 's24_float_pos';
    var desk = window.matchMedia('(min-width: 1024px)');
    // حجم المشغّل العائم والمرافق معاً (3 نوفمبر 2026): أساسي 380، من 240 إلى 640، ويُحفظ اختيار القارئ
    var PSIZE = 's24_player_w', P_BASE = 380, P_MIN = 240, P_MAX = 640;
    function pSize() { var v = 0; try { v = Number(localStorage.getItem(PSIZE)); } catch (e) {} return v >= P_MIN && v <= P_MAX ? v : P_BASE; }
    function pSave(w) { try { localStorage.setItem(PSIZE, String(Math.round(w))); } catch (e) {} }
    var lastDoc = null, follow = null;

    function ss(k, v) {
        try {
            if (v === undefined) return sessionStorage.getItem(k);
            if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v);
        } catch (e) {}
        return null;
    }
    function followGet() { try { return JSON.parse(ss(FOLLOW) || 'null'); } catch (e) { return null; } }
    function track(action, name) {
        try { if (window.gtag) window.gtag('event', 's24_live_follow', { follow_action: action, channel: name || '' }); } catch (e) {}
    }

    // صفحة البث: ما يشاهده القارئ الآن { kind, id, name, main }
    function currentSource() {
        var c = strip.active >= 0 ? strip.items[strip.active] : null;
        if (c) return { kind: c.kind, id: c.id, name: c.name || '', main: !!(strip.hasMain && strip.active === 0) };
        return { kind: state.mode, id: state.mode === 'channel' ? state.channelId : window.LIVE_CONFIG.videoId,
                 name: state.title || '', main: true };
    }

    // صفحة البث: عند المغادرة والبث يعمل (لا متوقفاً مؤقتاً) تُحفظ القناة ليتبع المرافق القارئ
    function recordOnLeave() {
        window.addEventListener('pagehide', function () {
            if (!window.isPlayerActive || !desk.matches || ss(FOLLOW_OFF)) return;
            var p = window.videojs && videojs.getPlayer && videojs.getPlayer('rt-live-page-player');
            if (p && p.paused && p.paused()) { ss(FOLLOW, null); return; }   // أوقفه القارئ بنفسه
            try {
                if (p && p.muted && !p.muted() && p.volume() > 0) {   // كان الصوت يعمل في صفحة البث
                    ss(FOLLOW_SND, '1');
                    ss('s24_follow_vol', String(Math.round(p.volume() * 100)));
                }
            } catch (e) {}
            var s = currentSource();
            if (s.id && ID_RE[s.kind] && ID_RE[s.kind].test(s.id)) ss(FOLLOW, JSON.stringify(s));
        });
    }

    // المصدر الذي يُعرض فعلاً بعد مطابقته بإعدادات اللوحة؛ null = لا يُعرض
    function resolveSource(src) {
        var d = lastDoc;
        var main = { kind: state.mode, id: state.mode === 'channel' ? state.channelId : window.LIVE_CONFIG.videoId,
                     name: state.title || src.name || 'البث المباشر', main: true };
        if (!src.main && d) {
            var still = (Array.isArray(d.channels) ? d.channels : []).some(function (c) {
                return c && c.kind === src.kind && c.id === src.id;
            });
            if (!still) src = main;                       // حُذفت القناة من الشريط ← البث الرئيسي
        }
        if (src.main) {
            if (d && d.onAir === false) return null;     // البث الرئيسي متوقف من اللوحة
            src = main;
        }
        return src.id && ID_RE[src.kind] && ID_RE[src.kind].test(src.id) ? src : null;
    }

    function initFollow() {
        if (isLivePage || !desk.matches || ss(FOLLOW_OFF) || /^\/p\/shorts\.html/.test(location.pathname)) return;
        var saved = followGet();
        if (!saved || !saved.id) return;
        // بعد اكتمال الصفحة كلها، فلا يبطئ إطار يوتيوب فتح المقالة
        var go = function () { setTimeout(function () { whenReady(function () { showFollow(saved); }); }, 400); };
        if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
    }

    function showFollow(saved) {
        if (follow || !desk.matches || document.getElementById('s24-follow')) return;
        var src = resolveSource(saved);
        if (!src) { ss(FOLLOW, null); return; }
        if (!src.main || saved.main !== src.main) ss(FOLLOW, JSON.stringify(src));

        var base = src.kind === 'channel'
            ? 'https://www.youtube.com/embed/live_stream?channel=' + encodeURIComponent(src.id) + '&'
            : 'https://www.youtube.com/embed/' + encodeURIComponent(src.id) + '?';
        var url = base + 'autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=' +
            encodeURIComponent(location.origin);

        // الحجم (3 نوفمبر 2026، بقرار حسان): الأساسي 380، ويُصغَّر حتى 240 أو يُكبَّر حتى 640 بالسحب من المقبض،
        // والحجم المختار مشترك مع العائم في صفحة البث (PSIZE). حسان يعلم أن ما دون 200×200 يخالف شرط يوتيوب
        var BAR = 30, FOOT = 28, MIN = P_MIN, GAP = 16;
        function maxW() { return Math.max(MIN, Math.min(P_MAX, document.documentElement.clientWidth - 2 * GAP)); }
        var W = pSize(), H = 0, mini = ss(FOLLOW_MIN) === '1';
        var upper = false;   // المشغّل في النصف الأعلى من الشاشة: يكبر نحو الأسفل، وإلا نحو الأعلى
        function extra() { return mini ? 36 : H + BAR + FOOT; }   // ارتفاع المشغّل كاملاً
        var pos = null;
        try { pos = JSON.parse(localStorage.getItem(FPOS)); } catch (e) {}

        var box = document.createElement('div');
        box.id = 's24-follow';
        box.className = 's24-follow';
        box.setAttribute('role', 'region');
        box.setAttribute('aria-label', 'البث المباشر');
        box.innerHTML =
            '<div class="s24-follow-bar">' +
              '<span class="s24-follow-ttl"><span class="s24-float-dot">●</span> مباشر' +
                (src.name ? ' · <b>' + escTxt(src.name) + '</b>' : '') + '</span>' +
              '<span class="s24-follow-btns">' +
                '<button type="button" data-a="resume" class="s24-follow-resume" title="متابعة البث" hidden>▶ متابعة</button>' +
                '<button type="button" data-a="min" title="طيّ المشغّل" aria-label="طيّ المشغّل">–</button>' +
                '<button type="button" data-a="open" class="s24-follow-open" title="مشاهدة البث">▶ مشاهدة</button>' +
                '<button type="button" data-a="live" title="صفحة البث" aria-label="صفحة البث">⤢</button>' +
                '<button type="button" data-a="x" title="إغلاق" aria-label="إغلاق">✕</button>' +
              '</span></div>' +
            '<div class="s24-follow-video"><iframe src="' + (mini ? 'about:blank' : escTxt(url)) + '" title="البث المباشر" ' +
              'allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' +
            // الشريط السفلي (3 نوفمبر 2026، بطلب حسان): الصوت أفقياً في الأسفل كمشغّل صفحة البث، تحت الفيديو لا فوقه.
            // يوتيوب يضع صوته في الأعلى وشريطاً عمودياً قصيراً حين يُحمَّل المشغّل صغيراً، ولا نملك تغيير ذلك
            '<div class="s24-follow-foot">' +
              '<span class="s24-follow-vol is-muted"><button type="button" data-a="mute" title="الصوت" aria-label="تشغيل الصوت أو كتمه">' +
                '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="w" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>' +
                '<path class="m" d="M16 9l5 6M21 9l-5 6"/></svg></button>' +
                '<input type="range" min="0" max="100" step="1" value="0" dir="ltr" aria-label="مستوى الصوت"></span>' +
              // المقبض في الزاوية السفلية المقابلة لجهة المشغّل من الشاشة — لا شيء فوق إطار يوتيوب
              '<span class="s24-follow-rs" title="اسحب لتكبير المشغّل أو تصغيره"><svg viewBox="0 0 16 16" width="16" height="16">' +
                '<path d="M2 10 L10 2 M2 14 L14 2"/></svg></span>' +
            '</div>';
        document.body.appendChild(box);
        follow = box;
        var bar = box.querySelector('.s24-follow-bar'), ifr = box.querySelector('iframe');
        var resumeBtn = box.querySelector('.s24-follow-resume'), minBtn = box.querySelector('[data-a="min"]');

        function cmd(fn) {
            try { ifr.contentWindow.postMessage(JSON.stringify({ event: 'command', func: fn, args: [] }), '*'); } catch (e) {}
        }
        // الطيّ (2.7.1): «–» يوقف البث ويطوي المشغّل إلى شريط صغير «● مباشر · القناة ▶ مشاهدة»؛
        // لا يبقى صوت بلا صورة (شرط يوتيوب)، والإطار لا يُحمَّل في الصفحات التالية ما دام مطويّاً
        function size() {
            box.classList.toggle('is-collapsed', mini);
            if (mini) {
                H = 0;
                box.style.width = '';
                return box.getBoundingClientRect().width || 220;
            }
            var w = Math.min(Math.max(W, MIN), maxW());
            H = Math.round(w * 9 / 16);
            box.style.width = w + 'px';
            ifr.style.height = H + 'px';
            box.classList.toggle('is-narrow', w < 300);
            return w;
        }
        // الحركة حرّة (3 نوفمبر 2026، بقرار حسان): يبقى المشغّل حيث يتركه القارئ تماماً، فوق كل شيء
        // حتى الهيدر — لا التصاق بالزوايا ولا ابتعاد عن الإعلانات. يُحصر فقط داخل حدود النافذة.
        // المقبض دائماً في الشريط السفلي، في الزاوية المقابلة لجهة المشغّل من الشاشة:
        //   المشغّل في النصف الأيسر ← المقبض أسفل يمين، وفي النصف الأيمن ← أسفل يسار
        var x = 0, y = 0;
        function gripSide() {
            var iw = document.documentElement.clientWidth, ih = window.innerHeight, w = box.offsetWidth;
            box.classList.toggle('grip-r', x + w / 2 < iw / 2);
            upper = y + extra() / 2 < ih / 2;
        }
        function place() {
            if (drag || rz) return;
            var w = size();
            gripSide();
            var iw = document.documentElement.clientWidth, ih = window.innerHeight;
            x = Math.min(Math.max(0, x), Math.max(0, iw - w));
            y = Math.min(Math.max(0, y), Math.max(0, ih - extra()));
            box.style.left = Math.round(x) + 'px';
            box.style.top = Math.round(y) + 'px';
        }
        function savePos() { try { localStorage.setItem(FPOS, JSON.stringify({ x: Math.round(x), y: Math.round(y) })); } catch (e) {} }

        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') { x = pos.x; y = pos.y; }
        else { size(); x = GAP; y = window.innerHeight - extra() - GAP; }   // افتراضياً أسفل يسار
        place();
        requestAnimationFrame(function () { box.classList.add('is-ready'); });

        var queued = false;
        function queue() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; place(); }); }
        window.addEventListener('resize', queue);

        // السحب من الشريط إلى أي مكان
        var drag = null;
        bar.addEventListener('pointerdown', function (e) {
            if (e.target.closest('button, input')) return;
            drag = { dx: e.clientX - x, dy: e.clientY - y };
            bar.setPointerCapture(e.pointerId);
            box.classList.add('is-drag');
            document.body.classList.add('s24-dragging');
        });
        bar.addEventListener('pointermove', function (e) {
            if (!drag) return;
            var iw = document.documentElement.clientWidth, ih = window.innerHeight;
            x = Math.min(Math.max(0, e.clientX - drag.dx), Math.max(0, iw - box.offsetWidth));
            y = Math.min(Math.max(0, e.clientY - drag.dy), Math.max(0, ih - extra()));
            box.style.left = Math.round(x) + 'px';
            box.style.top = Math.round(y) + 'px';
        });
        function endDrag() {
            if (!drag) return;
            drag = null;
            box.classList.remove('is-drag');
            document.body.classList.remove('s24-dragging');
            place();
            savePos();
        }
        bar.addEventListener('pointerup', endDrag);
        bar.addEventListener('pointercancel', endDrag);

        // تغيير الحجم: الحافة المقابلة للمقبض ثابتة، فيكبر المشغّل ويصغر من جهة المقبض
        var rs = box.querySelector('.s24-follow-rs'), rz = null;
        rs.addEventListener('pointerdown', function (e) {
            rz = { x: e.clientX, w: box.offsetWidth, right: x + box.offsetWidth, bottom: y + extra(),
                   fromLeft: box.classList.contains('grip-r'), fromTop: upper };
            rs.setPointerCapture(e.pointerId);
            box.classList.add('is-drag');
            document.body.classList.add('s24-dragging');
            e.preventDefault();
        });
        rs.addEventListener('pointermove', function (e) {
            if (!rz) return;
            var dx = e.clientX - rz.x;
            W = Math.min(Math.max(rz.w + (rz.fromLeft ? dx : -dx), MIN), maxW());
            var w = size();
            if (!rz.fromLeft) x = rz.right - w;
            if (!rz.fromTop) y = rz.bottom - extra();
            box.style.left = Math.round(x) + 'px';
            box.style.top = Math.round(y) + 'px';
        });
        function endResize() {
            if (!rz) return;
            rz = null;
            box.classList.remove('is-drag');
            document.body.classList.remove('s24-dragging');
            pSave(W);
            place();
            savePos();
        }
        rs.addEventListener('pointerup', endResize);
        rs.addEventListener('pointercancel', endResize);

        // الصوت (3 نوفمبر 2026): يُحفظ أيضاً حين يشغّله القارئ من زر يوتيوب نفسه، ومعه مستوى الصوت
        var soundOn = false;
        var volBox = box.querySelector('.s24-follow-vol'), volIn = volBox.querySelector('input'), volDrag = false;
        function vol() { var v = Number(ss('s24_follow_vol')); return v > 0 && v <= 100 ? v : 0; }
        function setVol(v) { try { ifr.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [v] }), '*'); } catch (e) {} }
        // مكتوم: سمّاعة بعلامة الكتم والشريط عند الصفر؛ النقر على أيّهما يشغّل الصوت
        function showVol(muted) {
            volBox.classList.toggle('is-muted', !!muted);
            if (!volDrag) volIn.value = muted ? 0 : (vol() || 100);
        }
        function unmute() {
            cmd('unMute');
            if (vol()) setVol(vol());
            cmd('playVideo');
            showVol(false);
            ss(FOLLOW_SND, '1');
        }
        volIn.addEventListener('pointerdown', function () { volDrag = true; });
        volIn.addEventListener('pointerup', function () { volDrag = false; });
        volIn.addEventListener('input', function () {
            var v = Number(volIn.value);
            if (v > 0) {
                if (volBox.classList.contains('is-muted')) { cmd('playVideo'); track('unmute', src.name); }
                cmd('unMute'); setVol(v); ss('s24_follow_vol', String(v)); ss(FOLLOW_SND, '1'); volBox.classList.remove('is-muted');
            }
            else { cmd('mute'); volBox.classList.add('is-muted'); }
        });
        volIn.addEventListener('change', function () { volDrag = false; });
        // أحداث مشغّل يوتيوب (IFrame API): كتمه ومستوى صوته
        function listen() { try { ifr.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (e) {} }
        ifr.addEventListener('load', function () { listen(); setTimeout(listen, 1500); });
        window.addEventListener('message', function (e) {
            if (!follow || e.source !== ifr.contentWindow || !/youtube/.test(e.origin)) return;
            var d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
            var info = d && d.info;
            if (!info || typeof info !== 'object') return;
            if (typeof info.volume === 'number' && info.volume > 0) {
                ss('s24_follow_vol', String(Math.round(info.volume)));
                if (soundOn && !volDrag && !volBox.classList.contains('is-muted')) volIn.value = Math.round(info.volume);
            }
            if (info.muted === false && !soundOn) { soundOn = true; showVol(false); ss(FOLLOW_SND, '1'); }
            else if (info.muted === true && soundOn) { soundOn = false; showVol(true); ss(FOLLOW_SND, null); }
        });
        // أول نقرة أو ضغطة زر خارج المشغّل تعيد الصوت (والنقرة داخله لا تُلغي الانتظار)
        if (ss(FOLLOW_SND)) {
            var once = function (e) {
                if (!follow) return;
                if (box.contains(e.target)) return;
                window.removeEventListener('pointerdown', once, true);
                window.removeEventListener('keydown', once, true);
                unmute();
                setTimeout(unmute, 800);   // إن لم يكن المشغّل جاهزاً بعد
            };
            window.addEventListener('pointerdown', once, true);
            window.addEventListener('keydown', once, true);
        }

        // مشغّل واحد يعمل: فيديو آخر في الصفحة يوقف المرافق
        function pause() {
            if (!follow || mini) return;
            cmd('pauseVideo');
            resumeBtn.hidden = false;
        }
        api.followPause = pause;
        document.addEventListener('play', function (e) {
            if (e.target && e.target.tagName === 'VIDEO' && !box.contains(e.target)) pause();
        }, true);
        window.addEventListener('blur', function () {
            setTimeout(function () {
                var a = document.activeElement;
                if (a && a.tagName === 'IFRAME' && a !== ifr && !box.contains(a)) pause();
            }, 0);
        });

        box.addEventListener('click', function (e) {
            var b = e.target.closest('button');
            if (!b) return;
            var a = b.getAttribute('data-a');
            if (a === 'mute') {
                if (volBox.classList.contains('is-muted')) { unmute(); track('unmute', src.name); }
                else { cmd('mute'); showVol(true); }
            }
            else if (a === 'resume') { cmd('playVideo'); resumeBtn.hidden = true; track('resume', src.name); }
            else if (a === 'min') {
                cmd('pauseVideo');
                mini = true;
                ss(FOLLOW_MIN, '1');
                place();
                track('minimize', src.name);
            }
            else if (a === 'open') {
                mini = false;
                ss(FOLLOW_MIN, null);
                if (!ifr.src || ifr.src === 'about:blank') ifr.src = url;   // أول فتح في هذه الصفحة
                else cmd('playVideo');
                resumeBtn.hidden = true;
                place();
                track('resume', src.name);
            }
            else if (a === 'live') { location.href = '/p/live.html'; }
            else if (a === 'x') {
                ss(FOLLOW, null); ss(FOLLOW_SND, null); ss(FOLLOW_MIN, null); ss(FOLLOW_OFF, '1');
                track('close', src.name);
                window.removeEventListener('resize', queue);
                box.remove();
                follow = null;
                api.followPause = null;
            }
        });
        track('show', src.name);
    }

    var api = { state: state, whenReady: whenReady, embedUrl: embedUrl, MINI_PARAMS: MINI_PARAMS, switchTo: switchTo, followPause: null };

    function load() {
        if (isLivePage) { ensureSplit(); renderMore(); initFloat(); recordOnLeave(); }
        initFollow();
        var wantsFollow = !isLivePage && desk.matches && !!ss(FOLLOW) && !ss(FOLLOW_OFF);
        var needed = isLivePage || wantsFollow || document.getElementById('miniLiveWidget') || document.querySelector('.live-tv-widget');
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
    return api;
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
    try { sessionStorage.removeItem('s24_follow_off'); } catch (e) {}   // تشغيل البث = المرافق يتبع القارئ من جديد (2.7)
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
    if (S24Live.followPause) S24Live.followPause();   // مشغّل واحد يعمل (2.7)
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
