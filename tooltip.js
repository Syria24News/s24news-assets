/* ============================================================
   S24News — نظام التلميح الذكي (Tooltip)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

/* ===================== 1) محوّل الاختصار ===================== */
/* ============================================================
   🟢 محوّل اختصار شرح الكلمات (Tooltip Shortcode Parser)
   الفكرة: بدل كتابة span/class/data-title يدويًا في كل مرة،
   يكفي كتابة هذا الشكل داخل نص المقالة من محرر Blogger نفسه:

       [[الكلمة أو العبارة|نص الشرح هنا]]

   والسكربت يحوّله تلقائيًا عند تحميل الصفحة إلى:
       <span class="sy-tooltip" data-title="نص الشرح هنا">الكلمة أو العبارة</span>

   ميزته: لا حاجة للـ HTML يدويًا، ولا حاجة لعمل Escape لعلامات
   التنصيص العربية "" داخل نص الشرح (لأن الإدراج يتم عبر
   textContent / setAttribute وليس عبر innerHTML خام).
   ============================================================ */
document.addEventListener("DOMContentLoaded", function() {
    var s24TooltipHost = document.querySelector('[id^="post-body-"]');
    if (!s24TooltipHost) return;

    var walker = document.createTreeWalker(s24TooltipHost, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            var parentTag = node.parentNode.tagName;
            if (parentTag === 'SCRIPT' || parentTag === 'STYLE') return NodeFilter.FILTER_REJECT;
            if (node.parentNode.closest && node.parentNode.closest('.sy-tooltip')) return NodeFilter.FILTER_REJECT;
            return (node.nodeValue.indexOf('[[') > -1) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
    });

    var textNodesToScan = [];
    var walkedNode;
    while (walkedNode = walker.nextNode()) {
        textNodesToScan.push(walkedNode);
    }

    var shortcodeRegex = /\[\[([^|\[\]]+)\|([^\[\]]+)\]\]/g;

    textNodesToScan.forEach(function(textNode) {
        var text = textNode.nodeValue;
        shortcodeRegex.lastIndex = 0;
        if (!shortcodeRegex.test(text)) return;
        shortcodeRegex.lastIndex = 0;

        var frag = document.createDocumentFragment();
        var lastIndex = 0;
        var match;
        while ((match = shortcodeRegex.exec(text)) !== null) {
            var before = text.slice(lastIndex, match.index);
            if (before) frag.appendChild(document.createTextNode(before));

            var span = document.createElement('span');
            span.className = 'sy-tooltip';
            span.setAttribute('data-title', match[2].trim());
            span.textContent = match[1].trim();
            frag.appendChild(span);

            lastIndex = match.index + match[0].length;
        }
        var after = text.slice(lastIndex);
        if (after) frag.appendChild(document.createTextNode(after));

        textNode.parentNode.replaceChild(frag, textNode);
    });



        /* ============================================================
       🔧 تمريرة ثانية: اختصار انكسر بين عقد نصية متعددة
       تحدث حين يُدخل محرر Blogger وسماً داخل [[...|...]]
       مثل <b> أو <i> أو <span style> أو تلوين أو فاصل تلقائي.
       تعمل على الفقرات الآمنة فقط (بلا صور/إطارات/جداول).
       ============================================================ */
    (function () {
        var LEAF_SEL = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, div';
        var UNSAFE   = /<(img|iframe|video|audio|script|style|svg|canvas|table|form|input|button)\b/i;
        var reBroken = /\[\[((?:(?!\]\]|\[\[)[^|]){1,120})\|((?:(?!\]\]|\[\[)[\s\S]){1,600})\]\]/g;

        function clean(str) {
            var tmp = document.createElement('textarea');
            tmp.innerHTML = String(str).replace(/<[^>]*>/g, '');
            return tmp.value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        }

        var leaves = s24TooltipHost.querySelectorAll(LEAF_SEL);
        for (var i = 0; i < leaves.length; i++) {
            var el = leaves[i];

            if (el.querySelector(LEAF_SEL)) continue;               // حاوية وليست ورقة
            if (el.textContent.indexOf('[[') === -1) continue;      // لا اختصار في النص المرئي
            var html = el.innerHTML;
            if (html.indexOf(']]') === -1) continue;
            if (UNSAFE.test(html)) continue;                        // فقرة فيها وسائط → لا نلمسها

            reBroken.lastIndex = 0;
            if (!reBroken.test(html)) continue;
            reBroken.lastIndex = 0;

            var store = [];
            var rebuilt = html.replace(reBroken, function (whole, term, desc) {
                var t = clean(term), d = clean(desc);
                if (!t || !d) return whole;
                store.push([t, d]);
                return '<span class="sy-tooltip" data-s24-tt="' + (store.length - 1) + '"></span>';
            });

            if (!store.length) continue;
            el.innerHTML = rebuilt;
            el.querySelectorAll('span[data-s24-tt]').forEach(function (sp) {
                var rec = store[parseInt(sp.getAttribute('data-s24-tt'), 10)];
                if (!rec) return;
                sp.removeAttribute('data-s24-tt');
                sp.setAttribute('data-title', rec[1]);
                sp.textContent = rec[0];
            });
        }
    })();


    // 🆕 ربط الكلمات بفهرس الموسوعة (يُجلب جاهزاً من Firebase بدل مسح فييد Blogger)
    if (document.querySelectorAll('.sy-tooltip').length > 0) {

        // ⚡ كاش 6 ساعات يمنع إعادة جلب الفهرس في كل تحميل صفحة فيها كلمات موسوعة
        var S24_GLOSSARY_INDEX_CACHE_KEY = 's24_glossary_index_cache';
        var S24_GLOSSARY_INDEX_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 ساعات
        var s24CachedGlossaryIndex = null;
        try {
            var s24IndexRecord = JSON.parse(localStorage.getItem(S24_GLOSSARY_INDEX_CACHE_KEY));
            if (s24IndexRecord && (Date.now() - s24IndexRecord.timestamp) < S24_GLOSSARY_INDEX_CACHE_TTL) {
                s24CachedGlossaryIndex = s24IndexRecord.data;
            } else if (s24IndexRecord) {
                localStorage.removeItem(S24_GLOSSARY_INDEX_CACHE_KEY);
            }
        } catch(e) {}

        (s24CachedGlossaryIndex ? Promise.resolve(s24CachedGlossaryIndex) :
            fetch('https://s24n-views-default-rtdb.firebaseio.com/glossaryIndex.json').then(function(res){ return res.json(); })
                                .then(function(data){
                    if (data && data.length) {
                        try { localStorage.setItem(S24_GLOSSARY_INDEX_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: data })); } catch(e) {}
                    }
                    return data;
                })
        )
.then(function(list){
        var map = {};
        (list || []).forEach(function(item){
            if (item && item.term) { map[item.term] = item.url; }
        });
                document.querySelectorAll('.sy-tooltip').forEach(function(el){
                    var word = el.textContent.trim();
                    if (map[word] && el.tagName !== 'A') {
                        var a = document.createElement('a');
                        a.className = el.className;
                        a.setAttribute('data-title', 'اضغط لقراءة المقالة كاملة');
                        a.href = map[word];
                        a.target = '_blank';
                        a.rel = 'noopener';
                        a.textContent = el.textContent;
                        el.parentNode.replaceChild(a, el);
                    }
                });
            })
            .catch(function(err){});
    }

});

/* ============ 2) محاذاة وفتح التلميح (بالتفويض) ============ */
/* ============================================================
   🟢 محاذاة وفتح التلميح الذكي — نسخة بالتفويض (Delegation)
   تعمل على أي عنصر .sy-tooltip حتى لو أُنشئ بعد تحميل الصفحة
   (مثل روابط الموسوعة التي تصل من Firebase بشكل غير متزامن)
   ============================================================ */
(function () {
    var HEADER_SAFE = 90;   // ارتفاع الهيدر الثابت + هامش أمان
    var BOX_HALF    = 110;  // نصف أقصى عرض للصندوق + هامش
    var openEl      = null;

    function place(el) {
        var r  = el.getBoundingClientRect();
        var vw = window.innerWidth;

        el.classList.remove('pos-left', 'pos-right', 'pos-below');

        if (vw - r.right < BOX_HALF)  el.classList.add('pos-right');
        else if (r.left < BOX_HALF)   el.classList.add('pos-left');

        // لا مساحة كافية فوق الكلمة → افتح للأسفل بدل الاختفاء خلف الهيدر
        if (r.top < HEADER_SAFE + 70) el.classList.add('pos-below');
    }

    function close() {
        if (openEl) { openEl.classList.remove('is-open'); openEl = null; }
    }

    // الماوس: يُحسب الموضع قبل ظهور الصندوق
    document.addEventListener('mouseover', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('.sy-tooltip') : null;
        if (el) place(el);
    }, true);

    // اللمس/النقر: فتح وإغلاق صريح لا يعتمد على :hover
    document.addEventListener('click', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('.sy-tooltip') : null;
        if (!el) { close(); return; }

        var isTouch = window.matchMedia('(hover: none)').matches;

        // على الأجهزة المكتبية تبقى روابط الموسوعة بسلوكها الطبيعي
        if (el.tagName === 'A' && !isTouch) return;

        if (el === openEl) {                 // نقرة ثانية على نفس الكلمة
            close();
            return;
        }

        close();
        place(el);
        el.classList.add('is-open');
        openEl = el;
    });

    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
