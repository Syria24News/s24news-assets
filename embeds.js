/* ============================================================
   S24News — تحميل المكتبات الخارجية وتضمينات التواصل
   (Swiper — تويتر/X — فيسبوك) مع مطابقة الوضع الليلي
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

document.addEventListener("DOMContentLoaded", function() {
     function loadSwiperIfNeeded() {
        // 🆕 نبني حاوية المعرض التلقائي (إن وُجدت) فوراً هنا بدل انتظار مؤقّت الثانية —
        // الدالة معرّفة عالمياً بحلول وقت التنفيذ الفعلي رغم وجودها بسكربت لاحق بالملف
        if (typeof s24AutoWrapAlbumFromMarker === 'function') s24AutoWrapAlbumFromMarker();
        var needsSwiper = document.querySelector('.swiper, .swiper-container, [class*="swiper"], .rt-album-source')
            || (document.body.textContent && document.body.textContent.indexOf('منطقة الألبوم') > -1);
        if (needsSwiper) {


            if (!document.querySelector('link[href*="swiper-bundle"]')) {
                var link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
                document.head.appendChild(link);
            }
            if (!window.Swiper && !document.querySelector('script[src*="swiper-bundle"]')) {
                var script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
                document.head.appendChild(script);
            }
        }
    }
 
    // 📏 مراقبة ارتفاع حاوية التغريدة: إن تجاوز الحد المسموح (نفس قيمة max-height في الـ CSS)
    // نطويها تلقائياً ونضيف زر "عرض التغريدة كاملة". تُستدعى عند أول عرض وأيضاً بعد كل إعادة رسم
    function watchTweetHeight(wrapper) {
        var COLLAPSE_THRESHOLD = 380; // يجب أن يطابق max-height في s24n-tweet-collapsed بالـ CSS
        var SAFETY_MARGIN = 40;       // هامش أمان لتفادي طي تغريدات قصيرة قريبة من الحد

        // تصفير أي حالة سابقة (مهم عند إعادة الرسم بعد تبديل الوضع الليلي)
        wrapper.classList.remove('s24n-tweet-collapsed');
        if (wrapper._s24nResizeObserver) {
            wrapper._s24nResizeObserver.disconnect();
        }
        var oldBtn = wrapper.nextElementSibling;
        if (oldBtn && oldBtn.classList.contains('s24n-tweet-expand-btn')) {
            oldBtn.remove();
        }

        if (typeof ResizeObserver === 'undefined') return; // دعم احتياطي للمتصفحات القديمة جداً

        var applied = false;
        var ro = new ResizeObserver(function() {
            if (applied) return;
            if (wrapper.scrollHeight > COLLAPSE_THRESHOLD + SAFETY_MARGIN) {
                applied = true;
                wrapper.classList.add('s24n-tweet-collapsed');

                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 's24n-tweet-expand-btn';
                btn.textContent = 'عرض التغريدة كاملة';
                btn.addEventListener('click', function() {
                    wrapper.classList.remove('s24n-tweet-collapsed');
                    btn.remove();
                });
                wrapper.insertAdjacentElement('afterend', btn);

                ro.disconnect();
            }
        });
        ro.observe(wrapper);
        wrapper._s24nResizeObserver = ro;
    }

    // 🌙 تجهيز كل تغريدة قبل أي معالجة من تويتر: ضبط ثيمها حسب الوضع الليلي الحالي
    // وتغليفها بحاوية ثابتة (تبقى في الـ DOM حتى بعد استبدال تويتر لمحتواها بـ iframe)
    // لنتمكن لاحقاً من إعادة رسمها فوراً عند تبديل الوضع الليلي/النهاري
    function prepareTweetsForTheme() {
        var newTweets = document.querySelectorAll('blockquote.twitter-tweet:not([data-s24n-ready])');
        if (!newTweets.length) return;

        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        newTweets.forEach(function(bq) {
            bq.setAttribute('data-s24n-ready', '1');
            bq.setAttribute('data-theme', isDark ? 'dark' : 'light');

            // استخراج رقم التغريدة من آخر رابط status/ داخل البلوكوت
            var links = bq.querySelectorAll('a[href*="/status/"]');
            var lastLink = links[links.length - 1];
            var idMatch = lastLink ? lastLink.href.match(/status\/(\d+)/) : null;

            var wrapper = document.createElement('div');
            wrapper.className = 's24n-tweet-wrapper';
            if (idMatch) wrapper.setAttribute('data-tweet-id', idMatch[1]);
            bq.parentNode.insertBefore(wrapper, bq);
            wrapper.appendChild(bq);

            watchTweetHeight(wrapper);
        });
    }

    function loadTwitterIfNeeded() {
        prepareTweetsForTheme();
        if (document.querySelector('.s24n-tweet-wrapper')) {
            if (!document.querySelector('script[src*="platform.twitter.com"]')) {
                var script = document.createElement('script');
                script.src = 'https://platform.twitter.com/widgets.js';
                script.async = true;
                script.charset = 'utf-8';
                document.body.appendChild(script);
            } else if (window.twttr && window.twttr.widgets) {
                // السكربت محمّل مسبقاً (مثلاً بعد تحميل ديناميكي جديد) - أعد فحص الصفحة يدوياً
                window.twttr.widgets.load();
            }
        }
    }

    // 🌙 إعادة رسم كل تغريدات الصفحة فوراً لتطابق الوضع الليلي/النهاري الجديد عند التبديل
    window.S24N_refreshTwitterTheme = function() {
        var wrappers = document.querySelectorAll('.s24n-tweet-wrapper[data-tweet-id]');
        if (!wrappers.length || !window.twttr || !window.twttr.widgets) return;

        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var newTheme = isDark ? 'dark' : 'light';

        wrappers.forEach(function(wrapper) {
            var tweetId = wrapper.getAttribute('data-tweet-id');
            var oldContent = wrapper.innerHTML;
            wrapper.innerHTML = '';
            window.twttr.widgets.createTweet(tweetId, wrapper, {
                theme: newTheme,
                dnt: true
            }).then(function(el) {
                if (!el) {
                    // فشل إعادة الإنشاء (تغريدة محذوفة مثلاً) - استرجاع المحتوى السابق كحل احتياطي
                    wrapper.innerHTML = oldContent;
                }
                watchTweetHeight(wrapper);
            });
        });
    };

    // 🟢 إصلاح: مزامنة فعلية للوضع الليلي مع تضمينات فيسبوك (Page/Post Plugin) عبر معامل
    // colorscheme الرسمي المدعوم في رابط iframe نفسه — بخلاف تويتر لا حاجة لإعادة بناء العنصر،
    // فقط تعديل رابط src فيُعيد فيسبوك رسم البطاقة بألوان داكنة مطابقة من عندهم مباشرة.
    // ملاحظة: لا يوجد معامل رسمي موثّق مكافئ لهذا لتضمينات انستغرام أو تيك توك القياسية، فتبقى
    // هذه المنصتان بلا حل ممكن حالياً ضمن حدود التضمين العام (قيد خارج عن إرادة القالب).
    window.S24N_refreshFacebookTheme = function() {
        var frames = document.querySelectorAll('iframe[src*="facebook.com/plugins"]');
        if (!frames.length) return;
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var wanted = isDark ? 'dark' : 'light';
        frames.forEach(function (frame) {
            var src = frame.getAttribute('src');
            if (!src) return;
            var hasParam = /[?&]colorscheme=/.test(src);
            var newSrc = hasParam
                ? src.replace(/([?&]colorscheme=)(light|dark)/, '$1' + wanted)
                : src + (src.indexOf('?') > -1 ? '&' : '?') + 'colorscheme=' + wanted;
            if (newSrc !== src) frame.setAttribute('src', newSrc);
        });
    };

    // 🟢 إصلاح: فيديوهات فيسبوك ريلز (عمودية 9:16) تنكسر عند فرض قالب أفقي عليها.
    // رابط الإطار (plugins/video.php?width=265&height=476...) يجعل فيسبوك يبني محتوى المشغّل
    // داخلياً بحجم عمودي ثابت، فإذا مدّدنا الإطار الخارجي أفقياً عبر CSS (كما نفعل للفيديو
    // الأفقي العادي) يبقى المحتوى الداخلي بحجمه الصغير الأصلي داخل صندوق أكبر فارغ/أسود.
    // الحل: نقرأ خاصيتي width/height الفعليتين من كود الإطار نفسه (يضعهما فيسبوك دائماً)،
    // وإن كان الفيديو عمودياً (الارتفاع أكبر من العرض) نطبّق حجماً عمودياً يحترم نسبته
    // الأصلية بدل تجاهلها بالكامل عبر aspect-ratio:unset الموجودة في القاعدة العامة.
    function fixFacebookVerticalVideos() {
        var frames = document.querySelectorAll(
            'body.item-page .post-body iframe[src*="facebook.com/plugins/video"]:not([data-s24n-fb-sized])'
        );
        frames.forEach(function (frame) {
            frame.setAttribute('data-s24n-fb-sized', '1');
            var w = parseInt(frame.getAttribute('width'), 10);
            var h = parseInt(frame.getAttribute('height'), 10);
            if (!w || !h || h <= w) return; // بلا أبعاد صالحة أو فيديو أفقي/مربع: اترك CSS العام كما هو

            frame.style.setProperty('width', w + 'px', 'important');
            frame.style.setProperty('max-width', '90%', 'important');
            frame.style.setProperty('aspect-ratio', w + ' / ' + h, 'important');
            frame.style.setProperty('height', 'auto', 'important');
            frame.style.setProperty('min-height', '0', 'important');
            frame.style.setProperty('max-height', 'none', 'important');
            frame.style.setProperty('margin', '25px auto', 'important');
            frame.style.setProperty('display', 'block', 'important');
        });
    }

    window.S24N_refreshFacebookTheme(); // تطبيق فوري عند تحميل الصفحة (يغطي حالة فتح الصفحة والوضع الليلي مفعّل مسبقاً)
    fixFacebookVerticalVideos();
    loadSwiperIfNeeded();
    loadTwitterIfNeeded();
 
    // إعادة فحص بعد ثانية لضمان تغطية العناصر التي تُبنى ديناميكياً (مثل المعرض والتغطية الحية)
    setTimeout(function() {
        loadSwiperIfNeeded();
        loadTwitterIfNeeded();
        fixFacebookVerticalVideos();
    }, 1000);
});
