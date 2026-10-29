/* ============================================================
   S24News — نظام معرض الصور الذكي (Swiper Gallery) — الإصدار 2.0
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر

   ما الجديد في 2.0 (29 أكتوبر 2026):
   1. تحجيم الصور يفهم صيغة بلوجر الحالية (s16000-rw) — كانت المصغّرات
      150px تحمّل الصورة الأصلية كاملة لأن التعبير القديم لا يطابقها
   2. الشريحة الكبيرة بلا قص من الخادم (w1200-rw)، والعرض بـ contain:
      الصورة العمودية تظهر كاملة على خلفية داكنة بدل قص رأسها وقدميها
   3. تعليق الصورة وحقوق المصوّر (tr-caption) يظهران أسفل الشريحة
   4. لا يُسحب إلى المعرض عنصرٌ فيه صورة ونص حقيقي معاً (كان النص يختفي)
   5. إن تعذّر تحميل Swiper خلال 10 ثوانٍ تظهر الصور عادية بدل اختفائها
   6. الشريحة الأولى في المعرض القائد تُحمَّل فوراً (تحسين LCP)
   7. نص بديل صحيح ومُهرَّب للصور، وتنقّل بأسهم لوحة المفاتيح
   ============================================================ */

/* ---------- أدوات مشتركة ---------- */

// 🔑 مفتاح الصورة: يميّز الصورة نفسها مهما اختلف حجمها في الرابط (لمقارنة الغلاف بصور المعرض)
function s24ImgKey(src) {
    src = src || '';
    var m = src.match(/AVvXsE[\w-]+/);
    return m ? m[0] : src.split('?')[0].split('/').pop();
}

// 📝 طول النص الحقيقي في العنصر — بلا تعليقات الصور (tr-caption) وبلا السكربتات والأنماط،
//    لأن التعليق جزء من الصورة نفسها، لا كتابة تُنهي المعرض
function s24RealTextLen(el) {
    if (!el || el.tagName === 'IMG') return 0;
    var hasJunk = el.querySelector && el.querySelector('.tr-caption, script, style');
    if (!hasJunk) return (el.textContent || '').trim().length;
    var clone = el.cloneNode(true);
    clone.querySelectorAll('.tr-caption, script, style').forEach(function(n) { n.remove(); });
    return (clone.textContent || '').trim().length;
}

// 🖼️ تغيير حجم صورة بلوجر من الرابط نفسه — يدعم الصيغتين:
//    المسار: .../s16000-rw/name.jpg  أو  .../w640-h360/name.jpg
//    اللاحقة: ...=s1600  أو  ...=w640-h360-rw
//    إن لم يُعرف الحجم في الرابط يبقى كما هو
function s24ResizeBlogger(src, size) {
    var pathRe = /\/[swh]\d+(?:-[\w-]*)?\/(?=[^\/]+$)/;
    if (pathRe.test(src)) return src.replace(pathRe, '/' + size + '/');
    var suffixRe = /=[swh]\d+[^\/?#]*$/;
    if (suffixRe.test(src)) return src.replace(suffixRe, '=' + size);
    return src;
}

// 🛡️ تهريب النص قبل وضعه داخل HTML (النص البديل والتعليق قد يحويان " أو <)
function s24EscAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------- 1. بناء حاوية المصدر ---------- */

// يبني تلقائياً حاوية "rt-album-source" — إما من النص المرجعي "📷 منطقة الألبوم" (وضع يدوي، له الأولوية دائماً إن وُجد)
// أو تلقائياً بالكشف عن أي تتابع كافٍ من الصور الحقيقية دون كتابة أي شيء في المقال (وضع تلقائي)
// وفي كل الحالات (بما فيها وجود حاوية قديمة مبنية يدوياً من قبل) يُفحص إخفاء الغلاف بشكل مستقل عبر s24HideCoverIfGalleryIsLead
function s24AutoWrapAlbumFromMarker() {
    if (!document.body.classList.contains('item-page')) return;
    var postBody = document.querySelector('[id^="post-body-"]');
    if (!postBody) return;

    var existingSource = postBody.querySelector('.rt-album-source');
    if (existingSource) {
        // الحاوية موجودة مسبقاً (مقال قديم مبني يدوياً، أو تشغيل سابق) — لا تُبنى من جديد،
        // لكن إخفاء الغلاف يُفحص بشكل مستقل
        s24HideCoverIfGalleryIsLead(postBody, existingSource);
        return;
    }

    var MIN_AUTO_GALLERY_IMAGES = 2; // الحد الأدنى لعدد الصور المتتالية ليُعتبر "معرضاً" تلقائياً
    var MARKER_TEXT = 'منطقة الألبوم';
    var MARKER_MAX_LEN = 60; // سطر الماركر قصير؛ عنصر أطول من هذا فيه كتابة حقيقية فلا يُخفى كله

    // تفكيك غلاف <div dir="rtl"> الذي يضع كل الفقرات والصور بداخله كعنصر واحد،
    // حتى تصبح الصور عناصر مباشرة قابلة للفحص بدل أن تكون مدفونة بداخله
    function s24FlattenRtlWrapper(list) {
        var out = [];
        list.forEach(function(el) {
            if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
            var isPlainRtlWrapper = el.tagName === 'DIV' && el.getAttribute('dir') === 'rtl' &&
                !el.classList.contains('separator') && !el.classList.contains('rt-album-source');
            if (isPlainRtlWrapper) {
                out = out.concat(Array.from(el.children));
            } else {
                out.push(el);
            }
        });
        return out;
    }
    var children = s24FlattenRtlWrapper(Array.from(postBody.children));

    // معرّف صورة الغلاف الكبيرة (إن وُجدت) — يُتجاهل عند العدّ لمنع ظهور نفس الصورة مرتين
    var coverEl = postBody.querySelector('.s24-cover-injected');
    var coverId = coverEl ? s24ImgKey(coverEl.getAttribute('data-cover-src')) : null;
    function isCoverImg(img) {
        return !!(coverId && img && s24ImgKey(img.getAttribute('src')) === coverId);
    }

    var markerIndex = children.findIndex(function(el) {
        var t = (el.textContent || '').trim();
        return t.indexOf(MARKER_TEXT) > -1 && t.length <= MARKER_MAX_LEN;
    });

    var startIndex = -1;
    var markerEl = null;

    if (markerIndex !== -1) {
        // ✅ الوضع اليدوي: النص المرجعي موجود، فله الأولوية دائماً
        startIndex = markerIndex + 1;
        markerEl = children[markerIndex];
    } else {
        // الوضع التلقائي: أول تتابع كافٍ من الصور الحقيقية (غير صورة الغلاف المكررة)
        var runStart = -1, runCount = 0;
        for (var i = 0; i < children.length; i++) {
            var el = children[i];
            var img = el.tagName === 'IMG' ? el : el.querySelector('img');
            var textLen = s24RealTextLen(el);

            if (img && !isCoverImg(img) && textLen === 0) {
                if (runStart === -1) runStart = i;
                runCount++;
            } else if (textLen > 0) {
                if (runCount >= MIN_AUTO_GALLERY_IMAGES) break; // معرض كافٍ قبل هذا النص
                runStart = -1; runCount = 0; // نص حقيقي بلا معرض كافٍ قبله: صفّر التتابع
            }
            // عنصر فارغ تماماً، أو صورة الغلاف المكررة: لا يكسر التتابع
        }
        if (runCount < MIN_AUTO_GALLERY_IMAGES) return;
        startIndex = runStart;
    }

    // مدّ نقطة البداية للخلف لتشمل العناصر الفارغة التي تسبق أول صورة (كانت تسبب فراغاً بصرياً)
    var wrapStart = startIndex;
    while (wrapStart > 0) {
        var prevEl = children[wrapStart - 1];
        if (prevEl === coverEl) break; // لا نتجاوز الغلاف المُحقن نفسه
        var prevImg = prevEl.tagName === 'IMG' ? prevEl : prevEl.querySelector('img');
        if (prevImg && !isCoverImg(prevImg)) break; // صورة حقيقية أخرى
        if (s24RealTextLen(prevEl) > 0) break;      // نص حقيقي
        wrapStart--;
    }

    var collected = [];
    var MAX_LOOKAHEAD = 200;

    for (var j = wrapStart; j < children.length && collected.length < MAX_LOOKAHEAD; j++) {
        var node = children[j];
        var nImg = node.tagName === 'IMG' ? node : node.querySelector('img');
        var nText = s24RealTextLen(node);

        // 🔧 عنصر فيه نص حقيقي (حتى لو فيه صورة) = انتهى المعرض — لا يُسحب أبداً،
        //    وإلا اختفت كتابته داخل الحاوية المخفية
        if (nText > 0) break;
        if (nImg && isCoverImg(nImg)) { continue; } // صورة الغلاف المكررة: لا تُسحب كشريحة
        collected.push(node); // صورة (مع تعليقها إن وُجد) أو عنصر فارغ تماماً
    }

    // لا معرض بلا صورة واحدة على الأقل (قد يكون كل ما جُمع عناصر فارغة)
    if (!collected.some(function(n) { return n.tagName === 'IMG' || n.querySelector('img'); })) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'rt-album-source';
    collected[0].parentNode.insertBefore(wrapper, collected[0]);
    collected.forEach(function(n) { wrapper.appendChild(n); });

    if (markerEl) markerEl.style.display = 'none'; // إخفاء سطر التعليمات عن القارئ (وضع يدوي فقط)

    s24HideCoverIfGalleryIsLead(postBody, wrapper);
}

/* ---------- 2. هل المعرض قائد المقال؟ ---------- */

// يفحص: هل تسبق حاوية المعرض صورةُ الغلاف الثابتة مباشرة بلا أي محتوى حقيقي بينهما؟
// لو نعم، فالمقال يبدأ بالمعرض، فيُخفى الغلاف ليحل المعرض محله (بلا تكرار الصورة)
function s24HideCoverIfGalleryIsLead(postBody, galleryEl) {
    var coverEl = postBody.querySelector('.s24-cover-injected');
    if (!coverEl || !galleryEl) return;

    var coverId = s24ImgKey(coverEl.getAttribute('data-cover-src'));
    function isCoverImg(img) {
        return !!(coverId && img && s24ImgKey(img.getAttribute('src')) === coverId);
    }

    var node = galleryEl.previousElementSibling;
    var guard = 0;
    while (node && guard < 30) {
        if (node === coverEl) { // وصلنا للغلاف بلا أي محتوى حقيقي بينهما
            coverEl.style.setProperty('display', 'none', 'important');
            galleryEl.classList.add('s24-lead-source'); // علامة محلية: هذا المعرض بالذات هو القائد
            return;
        }
        if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') { // السكربتات الفاصلة ليست محتوى
            node = node.previousElementSibling;
            guard++;
            continue;
        }
        var img = node.tagName === 'IMG' ? node : node.querySelector('img');
        var isHiddenAlready = !!(node.style && node.style.display === 'none'); // مخفي أصلاً — لا يُحتسب
        if (!isHiddenAlready && ((img && !isCoverImg(img)) || (!img && s24RealTextLen(node) > 0))) {
            return; // محتوى حقيقي قبل المعرض — لا نُخفي الغلاف
        }
        node = node.previousElementSibling;
        guard++;
    }
}

/* ---------- 3. بناء المعرض ---------- */

var S24_GALLERY_MAX_TRIES = 50; // 50 × 200ms = 10 ثوانٍ انتظاراً لمكتبة Swiper، ثم البديل

function initS24SwiperGallery(tries) {
    if (!document.body.classList.contains('item-page')) return;
    tries = tries || 0;

    if (tries === 0) s24AutoWrapAlbumFromMarker(); // مرة واحدة فقط، لا مع كل إعادة محاولة

    var sources = document.querySelectorAll('.rt-album-source');
    if (sources.length === 0) return;

    // ⏳ انتظر حتى تُحمَّل مكتبة Swiper (embeds.js يحمّلها من jsDelivr)
    if (typeof Swiper === 'undefined') {
        if (tries < S24_GALLERY_MAX_TRIES) {
            setTimeout(function() { initS24SwiperGallery(tries + 1); }, 200);
        } else {
            // 🛟 البديل: المكتبة لم تصل — أظهر الصور كما في مقال عادي بدل اختفائها
            sources.forEach(function(s) { s.classList.add('s24-album-fallback'); });
            console.warn('S24 Gallery: تعذّر تحميل Swiper، عُرضت الصور بلا معرض');
        }
        return;
    }

    var titleEl = document.querySelector('h1.post-title, h3.post-title');
    var defaultAlt = titleEl ? titleEl.textContent.trim() : 'سوريا 24';

    sources.forEach(function(source) {
        try {
            if (source.previousElementSibling && source.previousElementSibling.classList.contains('s24-gallery-wrapper')) return; // مبني مسبقاً

            var images = source.querySelectorAll('img');
            if (images.length === 0) return;

            var isLead = source.classList.contains('s24-lead-source'); // هل هذا المعرض بالذات قائد المقال؟
            var slidesHTML = '';
            var thumbsHTML = '';
            var n = 0;

            images.forEach(function(img) {
                var parentLink = img.closest('a');
                if (parentLink) {
                    parentLink.removeAttribute('href');
                    parentLink.onclick = function(e) { e.preventDefault(); };
                }

                var src = img.getAttribute('data-src') || img.getAttribute('src') || img.src;
                if (!src) return;

                // التعليق وحقوق المصوّر من جدول بلوجر (tr-caption-container) إن وُجد
                var capTable = img.closest('table.tr-caption-container');
                var capEl = capTable ? capTable.querySelector('.tr-caption') : null;
                var caption = capEl ? capEl.textContent.trim() : '';

                var alt = (img.getAttribute('alt') || '').trim() || caption || defaultAlt;
                var bigImg = s24ResizeBlogger(src, 'w1200-rw');        // بلا قص: الصورة كاملة
                var thumbImg = s24ResizeBlogger(src, 'w150-h100-c-rw'); // المصغّرة مقصوصة على مقاسها

                // الشريحة الأولى في المعرض القائد هي أول ما يراه القارئ: تُحمَّل فوراً
                var loadAttr = (isLead && n === 0) ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';

                slidesHTML += '<div class="swiper-slide"><img src="' + s24EscAttr(bigImg) + '" alt="' + s24EscAttr(alt) + '" ' + loadAttr + '/>' +
                    (caption ? '<div class="s24-slide-caption">' + s24EscAttr(caption) + '</div>' : '') + '</div>';
                thumbsHTML += '<div class="swiper-slide"><img src="' + s24EscAttr(thumbImg) + '" alt="' + s24EscAttr(alt) + '" loading="lazy"/></div>';
                n++;
            });

            if (slidesHTML === '') return;

            var galleryHTML =
                '<div class="s24-gallery-wrapper' + (isLead ? ' s24-gallery-lead' : '') + '" dir="rtl">' +
                    '<div class="swiper s24-main-swiper">' +
                        '<div class="swiper-wrapper">' + slidesHTML + '</div>' +
                        '<div class="swiper-button-next"></div>' +
                        '<div class="swiper-button-prev"></div>' +
                        '<div class="swiper-pagination custom-fraction"></div>' +
                    '</div>' +
                    '<div class="swiper s24-thumb-swiper">' +
                        '<div class="swiper-wrapper">' + thumbsHTML + '</div>' +
                    '</div>' +
                '</div>';

            source.insertAdjacentHTML('beforebegin', galleryHTML);
            source.style.cssText = 'display: none !important; height: 0; visibility: hidden; opacity: 0;';

            // العناصر تُمرَّر مباشرة (لا محددات عامة) حتى لا يتداخل معرضان في مقال واحد
            var wrapperEl = source.previousElementSibling;
            var mainEl = wrapperEl.querySelector('.s24-main-swiper');

            var thumbSwiper = new Swiper(wrapperEl.querySelector('.s24-thumb-swiper'), {
                spaceBetween: 10,
                slidesPerView: 4,
                freeMode: true,
                watchSlidesProgress: true,
                breakpoints: { 768: { slidesPerView: 6 } }
            });

            new Swiper(mainEl, {
                spaceBetween: 10,
                navigation: { nextEl: mainEl.querySelector('.swiper-button-next'), prevEl: mainEl.querySelector('.swiper-button-prev') },
                pagination: { el: mainEl.querySelector('.swiper-pagination'), type: 'fraction' },
                thumbs: { swiper: thumbSwiper },
                keyboard: { enabled: true, onlyInViewport: true }, // التنقل بأسهم لوحة المفاتيح
                effect: 'slide',
                grabCursor: true
            });

        } catch (error) {
            // فشل البناء: احذف المعرض الناقص (إن أُدرج) وأظهر الصور عادية
            var broken = source.previousElementSibling;
            if (broken && broken.classList.contains('s24-gallery-wrapper')) broken.remove();
            source.style.cssText = '';
            source.classList.add('s24-album-fallback');
            console.error('Error creating gallery: ', error);
        }
    });
}
document.addEventListener('DOMContentLoaded', function() { initS24SwiperGallery(0); });
