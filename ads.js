/* ============================================================
   S24News — نظام الإعلانات (ads.js) — الإصدار 1.0 — 1 نوفمبر 2026
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر

   الفكرة (قرار حسان، 1 نوفمبر 2026):
   - «التنسيق» في بلوجر يحدد الأماكن: كل مكان أداة HTML تطبع حاوية
       <div class="s24-ad" data-slot="معرّف الأداة"> … </div>
     (المعرّف يُترجم إلى اسم المكان في WIDGET_SLOTS أدناه)
     والأداة المخفية أو المحذوفة في «التنسيق» = لا مكان.
   - اللوحة المركزية تحدد المحتوى: ملف ads.json في هذا المستودع
     (تكتبه اللوحة، ويقرؤه هذا السكربت من GitHub Pages).
   - كود مكتوب يدوياً داخل الأداة في بلوجر (حاوية .s24-ad-manual) يغلب اللوحة
     في مكانه — طريق الطوارئ إن تعطلت اللوحة أو مفتاح GitHub.

   الأماكن الستة المعتمدة:
     home-top       الرئيسية، تحت الشبكة المميزة            (HTML101)
     home-bottom    الرئيسية، قبل قسم الفيديو              (HTML102)
     article-mid    وسط نص المقالة — فقط إن بلغت minWords كلمة (400)   (HTML198)
     article-end    آخر نص المقالة                          (HTML199)
     article-under  تحت المقال، قبل «إقرأ المزيد»           (HTML888)
     list-mid       صفحات الأقسام والبحث، بعد البطاقة الخامسة (HTML197)
   أماكن المقالة الثلاثة لا تظهر في مقالات الموسوعة ما دام glossary = false.
   أي صفحة تظهر فيها الحاوية يحدده شرط الأداة في القالب (isPost / isHomepage / isSearch).

   شكل ads.json:
   {
     "v": 1, "updated": "…",
     "label": "إعلان",          ← نص صغير فوق كل إعلان؛ فارغ = بلا نص
     "minWords": 400,           ← حد إعلان وسط المقالة
     "glossary": false,         ← إعلانات الموسوعة (مطفأة)
     "slots": {
       "home-top": { "on": true, "type": "adsense", "adSlot": "1234567890", "format": "auto" },
       "article-mid": { "on": true, "type": "adsense", "adSlot": "…", "format": "in-article" },
       "article-end": { "on": true, "type": "house", "name": "حملة…", "img": "رابط الصورة",
                        "url": "رابط الصفحة", "alt": "وصف", "from": "2026-11-05", "to": "2026-12-01" }
     }
   }
   المكان غير المذكور، أو on=false، أو خارج تاريخيه = لا شيء (تُحذف حاويته).

   الاستهلاك: صفر من Firestore وApps Script. طلب واحد لملف ثابت (GitHub Pages)،
   ويتجدد كل دقيقة. الصفحة التي لا حاوية إعلان فيها لا تطلب الملف أصلاً.
   المعاينة: أضف ?ads=preview إلى رابط أي صفحة فتظهر الأماكن مربعات مسمّاة (لك وحدك).
   الإحصاء: نقرة الإعلان الخاص تُرسل حدث s24_ad_click إلى Google Analytics (مجاناً).
   ============================================================ */
(function () {
    'use strict';

    var DATA_URL = 'https://syria24news.github.io/s24news-assets/ads.json';
    var CLIENT = 'ca-pub-7116158255667846';
    var ARTICLE_SLOTS = ['article-mid', 'article-end', 'article-under'];

    // أدوات بلوجر تطبع data-slot = معرّف الأداة (data:widget.instanceId) فيبقى كودها واحداً؛
    // هنا يُترجم المعرّف إلى اسم المكان. أداة جديدة لمكان جديد = سطر هنا.
    var WIDGET_SLOTS = {
        HTML101: 'home-top',
        HTML102: 'home-bottom',
        HTML198: 'article-mid',
        HTML199: 'article-end',
        HTML888: 'article-under',
        HTML197: 'list-mid'
    };

    var slots = document.querySelectorAll('.s24-ad[data-slot]');
    if (!slots.length) return; // لا مكان إعلان في هذه الصفحة: لا طلب ولا عمل
    Array.prototype.forEach.call(slots, function (el) {
        var mapped = WIDGET_SLOTS[el.getAttribute('data-slot')];
        if (mapped) el.setAttribute('data-slot', mapped);
    });

    function slotEl(name) { return document.querySelector('.s24-ad[data-slot="' + name + '"]'); }

    // جلب الإعدادات؛ عند الفشل تُعامل كأنها فارغة فتعمل الأكواد اليدوية وحدها
    function loadConfig() {
        return fetch(DATA_URL + '?t=' + Math.floor(Date.now() / 60000))
            .then(function (r) { return r.ok ? r.json() : {}; })
            .catch(function () { return {}; });
    }

    /* ---------- عدّ الكلمات واختيار وسط المقالة ---------- */

    // عناصر النص المباشرة في جسم المقالة، بعد تفكيك غلاف <div dir="rtl"> (نفس منطق المعرض)
    function flatBlocks(body) {
        var out = [];
        Array.prototype.forEach.call(body.children, function (el) {
            if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
            if (el.classList.contains('s24-ad') || el.classList.contains('sy-article-tools') ||
                el.classList.contains('s24-cover-injected') || el.classList.contains('s24-toc')) return;
            var plainRtl = el.tagName === 'DIV' && el.getAttribute('dir') === 'rtl' &&
                !el.classList.contains('separator') && !el.classList.contains('rt-album-source');
            if (plainRtl) out = out.concat(flatBlocks(el));
            else out.push(el);
        });
        return out;
    }

    function words(el) {
        var t = (el.textContent || '').trim();
        return t ? t.split(/\s+/).length : 0;
    }

    // فقرة نصية خالصة: <p> فيها كلام، ولا صورة ولا إطار فيها
    function isTextPara(el) {
        return !!el && el.tagName === 'P' && words(el) > 0 && !el.querySelector('img, iframe, video, script');
    }

    // يعيد الفقرة التي يُوضع الإعلان بعدها، أو null
    function midAnchor(body, minWords) {
        var blocks = flatBlocks(body);
        var total = 0;
        blocks.forEach(function (b) { total += words(b); });
        if (total < minWords) return null;

        var half = total / 2, sum = 0;
        for (var i = 0; i < blocks.length - 1; i++) {
            sum += words(blocks[i]);
            // بعد منتصف الكلام، وبين فقرتين نصيتين — لا بجوار صورة أو معرض أو تضمين
            if (sum >= half && isTextPara(blocks[i]) && isTextPara(blocks[i + 1])) return blocks[i];
        }
        return null;
    }

    /* ---------- وضع الحاويات في أماكنها ---------- */

    function place(cfg) {
        var body = document.querySelector('[id^="post-body-"]');
        var entry = document.querySelector('.post.hentry');
        var noArticleAds = document.body.classList.contains('s24-glossary-article') && cfg.glossary !== true;

        if (noArticleAds) {
            ARTICLE_SLOTS.forEach(function (n) { var el = slotEl(n); if (el) el.remove(); });
        } else {
            var end = slotEl('article-end');
            if (end) { if (body) body.appendChild(end); else end.remove(); }

            var under = slotEl('article-under');
            if (under) { if (entry) entry.parentNode.insertBefore(under, entry.nextSibling); else under.remove(); }

            var mid = slotEl('article-mid');
            if (mid) {
                var anchor = body ? midAnchor(body, Number(cfg.minWords) || 400) : null;
                if (anchor) anchor.parentNode.insertBefore(mid, anchor.nextSibling); else mid.remove();
            }
        }

        var list = slotEl('list-mid');
        if (list) {
            var cards = document.querySelectorAll('.blog-posts .post-outer');
            if (cards.length >= 6) cards[4].parentNode.insertBefore(list, cards[4].nextSibling);
            else list.remove();
        }
    }

    /* ---------- ملء الحاويات ---------- */

    function inDates(s) {
        var now = Date.now();
        if (s.from) { var f = new Date(s.from + 'T00:00:00').getTime(); if (!isNaN(f) && now < f) return false; }
        if (s.to) { var t = new Date(s.to + 'T00:00:00').getTime(); if (!isNaN(t) && now >= t + 86400000) return false; }
        return true;
    }

    function addLabel(el, cfg) {
        var text = cfg.label === undefined ? 'إعلان' : String(cfg.label || '');
        if (!text || el.querySelector('.s24-ad-label')) return;
        var lab = document.createElement('span');
        lab.className = 's24-ad-label';
        lab.textContent = text;
        el.insertBefore(lab, el.firstChild);
    }

    function isInternal(url) {
        return /^\//.test(url) || /^https?:\/\/(www\.)?syria24\.news(\/|$)/i.test(url);
    }

    function adsenseUnit(s) {
        var ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        ins.setAttribute('data-ad-client', CLIENT);
        ins.setAttribute('data-ad-slot', String(s.adSlot));
        if (s.format === 'in-article') {
            ins.style.textAlign = 'center';
            ins.setAttribute('data-ad-layout', 'in-article');
            ins.setAttribute('data-ad-format', 'fluid');
        } else {
            ins.setAttribute('data-ad-format', 'auto');
            ins.setAttribute('data-full-width-responsive', 'true');
        }
        return ins;
    }

    function houseUnit(s, name) {
        var img = document.createElement('img');
        img.src = s.img;
        img.alt = s.alt || s.name || 'إعلان';
        img.loading = 'lazy';
        img.decoding = 'async';

        // رابط إلى ملف صورة يعطّله سكربت «إصلاح صور المقالات» في القالب، فلا يُربط
        var url = String(s.url || '');
        if (!url || /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url)) return img;

        var a = document.createElement('a');
        a.href = url;
        if (!isInternal(url)) { a.target = '_blank'; a.rel = 'sponsored noopener'; }
        a.appendChild(img);
        a.addEventListener('click', function () {
            if (typeof window.gtag === 'function') {
                window.gtag('event', 's24_ad_click', { ad_slot: name, ad_name: s.name || '' });
            }
        });
        return a;
    }

    // وضع المعاينة: أضف ?ads=preview إلى رابط أي صفحة لترى كل الأماكن مربعات مسمّاة —
    // لك وحدك، ولا يتأثر به الزوار ولا ads.json
    var PREVIEW = /[?&]ads=preview\b/.test(location.search);
    var SLOT_NAMES = {
        'home-top': 'الرئيسية: تحت الشبكة المميزة', 'home-bottom': 'الرئيسية: قبل الفيديو',
        'article-mid': 'وسط نص المقالة', 'article-end': 'آخر نص المقالة',
        'article-under': 'تحت المقال', 'list-mid': 'صفحات الأقسام: بعد البطاقة الخامسة'
    };

    function fill(el, cfg) {
        if (!el.isConnected) return; // حُذفت عند الوضع
        var name = el.getAttribute('data-slot');

        if (PREVIEW) {
            var box = document.createElement('div');
            box.className = 's24-ad-inner s24-ad-preview';
            box.textContent = 'مكان إعلان: ' + (SLOT_NAMES[name] || name) + ' (' + name + ')';
            el.appendChild(box);
            addLabel(el, cfg);
            el.classList.add('is-on');
            return;
        }

        // كود يدوي في أداة بلوجر يغلب اللوحة
        var manual = el.querySelector('.s24-ad-manual');
        if (manual && manual.innerHTML.trim()) {
            addLabel(el, cfg);
            el.classList.add('is-on');
            return;
        }

        var s = (cfg.slots || {})[name];
        if (!s || s.on !== true || !inDates(s)) { el.remove(); return; }

        var inner = document.createElement('div');
        inner.className = 's24-ad-inner';

        if (s.type === 'adsense' && s.adSlot) {
            inner.appendChild(adsenseUnit(s));
            el.appendChild(inner);
            addLabel(el, cfg);
            el.classList.add('is-on');
            try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* أدسنس غير محمّل */ }
        } else if (s.type === 'house' && s.img) {
            inner.appendChild(houseUnit(s, name));
            el.appendChild(inner);
            addLabel(el, cfg);
            el.classList.add('is-on');
        } else {
            el.remove();
        }
    }

    function run() {
        loadConfig().then(function (cfg) {
            cfg = cfg || {};
            place(cfg);
            Array.prototype.forEach.call(document.querySelectorAll('.s24-ad[data-slot]'), function (el) { fill(el, cfg); });
        });
    }

    // بعد اكتمال بناء الصفحة (المعرض وجدول المحتويات يُبنيان عند DOMContentLoaded)
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();
