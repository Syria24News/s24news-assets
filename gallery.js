/* ============================================================
   S24News — نظام معرض الصور الذكي (Swiper Gallery)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

// 🟢 نظام المعرض الذكي المطور النهائي (يعالج أخطاء بلوجر وتأخير التحميل)

// 🆕 يبني تلقائياً حاوية "rt-album-source" — إما من النص المرجعي "📷 منطقة الألبوم" (وضع يدوي، له الأولوية دائماً إن وُجد)
//    أو تلقائياً بالكشف عن أي تتابع كافٍ من الصور الحقيقية دون كتابة أي شيء في المقال (وضع تلقائي)
//    وفي كل الحالات (بما فيها وجود حاوية قديمة مبنية يدوياً من قبل) يُفحص إخفاء الغلاف بشكل مستقل عبر s24HideCoverIfGalleryIsLead
function s24AutoWrapAlbumFromMarker() {
    if (!document.body.classList.contains('item-page')) return;
    var postBody = document.querySelector('[id^="post-body-"]');
    if (!postBody) return;

    var existingSource = postBody.querySelector('.rt-album-source');
    if (existingSource) {
        // 🆕 الحاوية موجودة مسبقاً (سواء من مقال قديم مبني يدوياً، أو من تشغيل سابق) — لا حاجة لبنائها من جديد،
        //    لكن هذا لا يعني أن الغلاف الثابت يجب أن يبقى ظاهراً، فنفحص إخفاءه بشكل مستقل تماماً هنا
        s24HideCoverIfGalleryIsLead(postBody, existingSource);
        return;
    }

    var MIN_AUTO_GALLERY_IMAGES = 2; // 🆕 الحد الأدنى لعدد الصور المتتالية ليُعتبر "معرضاً" تلقائياً — غيّرها إلى 3 لو أردت تشدداً أكثر
    var MARKER_TEXT = 'منطقة الألبوم';

    // 🆕 تفكيك غلاف <div dir="rtl"> الذي يضع كل الفقرات والصور بداخله كعنصر واحد،
    //    حتى تصبح الصور عناصر مباشرة قابلة للفحص بدل أن تكون مدفونة بداخله
    function s24FlattenRtlWrapper(list) {
        var out = [];
        list.forEach(function(el) {
            if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return; // 🆕 نفس إصلاح كشف نوع المقال
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

    // 🆕 معرّف صورة الغلاف الكبيرة (إن وُجدت) — نتجاهله عند العدّ لمنع ظهور نفس الصورة مرتين (غلافاً بالأعلى، ثم أول صورة داخل المعرض)
    var coverId = null;
    var coverEl = postBody.querySelector('.s24-cover-injected');
    if (coverEl) {
        var coverSrc = coverEl.getAttribute('data-cover-src') || '';
        var cm = coverSrc.match(/AVvXsE[\w-]+/);
        coverId = cm ? cm[0] : coverSrc.split('?')[0].split('/').pop();
    }
    function isCoverImg(img) {
        if (!coverId || !img) return false;
        var s = img.getAttribute('src') || '';
        var m = s.match(/AVvXsE[\w-]+/);
        var id = m ? m[0] : s.split('?')[0].split('/').pop();
        return id === coverId;
    }

    var markerIndex = children.findIndex(function(el) {
        return el.textContent && el.textContent.indexOf(MARKER_TEXT) > -1;
    });

    var startIndex = -1;
    var markerEl = null;

    if (markerIndex !== -1) {
        // ✅ الوضع اليدوي: النص المرجعي موجود، فله الأولوية دائماً كتحكم دقيق عند الحاجة
        startIndex = markerIndex + 1;
        markerEl = children[markerIndex];
    } else {
        // 🆕 الوضع التلقائي: ابحث عن أول تتابع كافٍ من الصور الحقيقية (غير صورة الغلاف المكررة)
        var runStart = -1, runCount = 0;
        for (var i = 0; i < children.length; i++) {
            var el = children[i];
            var img = el.tagName === 'IMG' ? el : el.querySelector('img');
            var textLen = (el.textContent || '').trim().length;

            if (img && !isCoverImg(img)) {
                if (runStart === -1) runStart = i;
                runCount++;
            } else if (textLen > 0) {
                if (runCount >= MIN_AUTO_GALLERY_IMAGES) break; // وجدنا معرضاً كافياً قبل هذا النص، توقف هنا فوراً
                runStart = -1; runCount = 0; // نص حقيقي بلا معرض كافٍ قبله: صفّر التتابع وابحث من جديد
            }
            // عنصر فارغ تماماً، أو صورة الغلاف المكررة: تجاهله ولا تكسر التتابع القائم
        }
        if (runCount < MIN_AUTO_GALLERY_IMAGES) return; // لا يوجد معرض تلقائي كافٍ في هذا المقال أصلاً
        startIndex = runStart;
    }

    // 🆕 مدّ نقطة البداية للخلف لتشمل أي عناصر فارغة تماماً (بلا صورة ولا نص) تسبق أول صورة —
    // هذه كانت تبقى ظاهرة كما هي فتُسبب فراغاً بصرياً بين العنوان/الغلاف وبداية المعرض
    var wrapStart = startIndex;
    while (wrapStart > 0) {
        var prevEl = children[wrapStart - 1];
        if (prevEl === coverEl) break; // لا نتجاوز الغلاف المُحقن نفسه؛ إخفاؤه مسؤولية دالة أخرى لاحقاً
        var prevImg = prevEl.tagName === 'IMG' ? prevEl : prevEl.querySelector('img');
        var prevTextLen = (prevEl.textContent || '').trim().length;
        if (prevImg && !isCoverImg(prevImg)) break; // صورة حقيقية أخرى: توقف هنا
        if (!prevImg && prevTextLen > 0) break; // نص حقيقي: توقف هنا
        wrapStart--; // فارغ تماماً، أو صورة الغلاف المكررة (ستُستبعد لاحقاً رغم ذلك): تجاوزه واستمر للخلف
    }

    var collected = [];
    var MAX_LOOKAHEAD = 200;

    for (var i = wrapStart; i < children.length && collected.length < MAX_LOOKAHEAD; i++) {
        var el = children[i];
        var img = el.tagName === 'IMG' ? el : el.querySelector('img');
        var textLen = (el.textContent || '').trim().length;

        if (img && isCoverImg(img)) { continue; } // 🆕 صورة الغلاف المكررة: تجاهلها كلياً، لا تُسحب كشريحة معرض
        if (img) { collected.push(el); continue; }
        if (textLen > 0) break; // نص حقيقي بلا صورة = انتهى المعرض وعاد المقال لسياقه
        collected.push(el); // 🆕 عنصر فارغ تماماً (فقرة فارغة، أو <br> منفرد): اسحبه أيضاً بدل تركه ظاهراً يسبب فراغاً
    }

    if (collected.length === 0) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'rt-album-source';
    collected[0].parentNode.insertBefore(wrapper, collected[0]);
    collected.forEach(function(el) { wrapper.appendChild(el); });

    if (markerEl) markerEl.style.display = 'none'; // إخفاء سطر التعليمات نفسه عن القارئ (وضع يدوي فقط)

    s24HideCoverIfGalleryIsLead(postBody, wrapper); // 🆕 فحص موحّد لإخفاء الغلاف — بنفس المنطق تماماً الذي يُستخدم مع الحاويات الموجودة مسبقاً
}

// 🆕 يفحص: هل تسبق حاوية المعرض (سواء بُنيت حديثاً أو كانت موجودة أصلاً بالمقال) صورةُ الغلاف الثابتة مباشرة بلا أي محتوى حقيقي بينهما؟
//    لو نعم، فالمقال بأكمله معرض صور، فنُخفي الغلاف الثابت ليحل المعرض محله مباشرة (بلا تكرار للصورة 3 مرات: غلاف، صورة كبيرة، مصغرة)
function s24HideCoverIfGalleryIsLead(postBody, galleryEl) {
    var coverEl = postBody.querySelector('.s24-cover-injected');
    if (!coverEl || !galleryEl) return;

    var coverSrc = coverEl.getAttribute('data-cover-src') || '';
    var cm = coverSrc.match(/AVvXsE[\w-]+/);
    var coverId = cm ? cm[0] : coverSrc.split('?')[0].split('/').pop();

    function isCoverImg(img) {
        if (!coverId || !img) return false;
        var s = img.getAttribute('src') || '';
        var m = s.match(/AVvXsE[\w-]+/);
        var id = m ? m[0] : s.split('?')[0].split('/').pop();
        return id === coverId;
    }

    var node = galleryEl.previousElementSibling;
    var guard = 0;
    while (node && guard < 30) {
                        if (node === coverEl) { // وصلنا للغلاف مباشرة بلا أي محتوى حقيقي بينهما فعلاً
            coverEl.style.setProperty('display', 'none', 'important');
            galleryEl.classList.add('s24-lead-source'); // 🆕 علامة محلية: هذا المعرض بالذات هو القائد
            return;
        }
        if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') { // 🆕 تجاهل السكربتات الفاصلة كلياً —
            // كود الجافاسكريبت بداخلها نص طويل تقنياً، لكنه ليس محتوى حقيقياً، فلا يجوز أن يوقف البحث
            node = node.previousElementSibling;
            guard++;
            continue;
        }
        var img = node.tagName === 'IMG' ? node : node.querySelector('img');
        var textLen = (node.textContent || '').trim().length;
        var isHiddenAlready = !!(node.style && node.style.display === 'none'); // مخفي أصلاً (صورة مكررة أو سطر ماركر) — لا يُحتسب كمحتوى
        if (!isHiddenAlready && ((img && !isCoverImg(img)) || (!img && textLen > 0))) {
            return; // وجدنا محتوى حقيقياً (نصاً أو صورة مختلفة) قبل المعرض — لا نُخفي الغلاف
        }
        node = node.previousElementSibling;
        guard++;
    }
}

function initS24SwiperGallery() {
    if (!document.body.classList.contains('item-page')) return;

    s24AutoWrapAlbumFromMarker();

    const sources = document.querySelectorAll('.rt-album-source');
    if (sources.length === 0) return;

    // ⏳ انتظر حتى يتم تحميل مكتبة Swiper بالكامل
    if (typeof Swiper === 'undefined') {
        setTimeout(initS24SwiperGallery, 200); // أعد المحاولة بعد أجزاء من الثانية
        return;
    }

    sources.forEach((source, index) => {
        try {
            const images = source.querySelectorAll('img');
            if (images.length === 0) return;

            const mainId = `s24-main-swiper-${Date.now()}-${index}`;
            const thumbId = `s24-thumb-swiper-${Date.now()}-${index}`;

            let slidesHTML = '';
            let thumbsHTML = '';

            images.forEach((img) => {
                let parentLink = img.closest('a');
                if(parentLink) {
                    parentLink.removeAttribute('href');
                    parentLink.onclick = function(e) { e.preventDefault(); };
                }

                let src = img.getAttribute('data-src') || img.getAttribute('src') || img.src;
                if (!src) return;

                let alt = img.getAttribute('alt') || 'S24News Image';
                
                let bigImg = src;
                let thumbImg = src;
                
                if (src.match(/\/(s[0-9]+|w[0-9]+-h[0-9]+.*?)\//)) {
                    bigImg = src.replace(/\/(s[0-9]+|w[0-9]+-h[0-9]+.*?)\//, '/w1000-h563-c/');
                    thumbImg = src.replace(/\/(s[0-9]+|w[0-9]+-h[0-9]+.*?)\//, '/w150-h100-c/');
                }

                slidesHTML += `<div class="swiper-slide"><img src="${bigImg}" alt="${alt}" loading="lazy"/></div>`;
                thumbsHTML += `<div class="swiper-slide"><img src="${thumbImg}" alt="thumb" loading="lazy"/></div>`;
            });

            if (slidesHTML === '') return;

                        const isLead = source.classList.contains('s24-lead-source'); // 🆕 هل هذا المعرض بالذات قائد المقال؟
            const galleryHTML = `
                <div class="s24-gallery-wrapper${isLead ? ' s24-gallery-lead' : ''}" dir="rtl">
                    <div class="swiper ${mainId} s24-main-swiper">
                        <div class="swiper-wrapper">${slidesHTML}</div>
                        <div class="swiper-button-next"></div>
                        <div class="swiper-button-prev"></div>
                        <div class="swiper-pagination custom-fraction"></div>
                    </div>
                    <div class="swiper ${thumbId} s24-thumb-swiper">
                        <div class="swiper-wrapper">${thumbsHTML}</div>
                    </div>
                </div>`;

            source.insertAdjacentHTML('beforebegin', galleryHTML);
            source.style.cssText = "display: none !important; height: 0; visibility: hidden; opacity: 0;";

            var thumbSwiper = new Swiper(`.${thumbId}`, {
                spaceBetween: 10,
                slidesPerView: 4,
                freeMode: true,
                watchSlidesProgress: true,
                breakpoints: { 768: { slidesPerView: 6 } }
            });

            new Swiper(`.${mainId}`, {
                spaceBetween: 10,
                navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
                pagination: { el: '.swiper-pagination', type: "fraction" },
                thumbs: { swiper: thumbSwiper },
                effect: 'slide',
                grabCursor: true
            });

        } catch (error) {
            console.error("Error creating gallery: ", error);
        }
    });
}
document.addEventListener("DOMContentLoaded", initS24SwiperGallery);
