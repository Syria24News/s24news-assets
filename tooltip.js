/* ============================================================
   S24News — نظام التلميح الذكي (Tooltip)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   🆕 مع البحث الذكي والتصحيح الإملائي والـ aliases
   ============================================================ */

/* ============================================================
   🆕 توحيد الرسم العربي + البحث الذكي مع Aliases
   ============================================================ */
function s24Normalize(text) {
  return String(text || '')
    .replace(/[\u064B-\u0652\u0640]/g, '') // تشكيل
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627') // ألف
    .replace(/\u0649/g, '\u064A') // ألف مقصورة
    .replace(/\u0629/g, '\u0647') // تاء مربوطة
    .trim()
    .toLowerCase();
}

function s24LevenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

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


    // 🆕 ربط الكلمات بفهرس الموسوعة (يُجلب جاهزاً من Firestore مع الـ aliases)
    if (document.querySelectorAll('.sy-tooltip').length > 0) {

        // ⚡ كاش 6 ساعات يمنع إعادة جلب الفهرس في كل تحميل صفحة فيها كلمات موسوعة
        var S24_GLOSSARY_INDEX_CACHE_KEY = 's24_glossary_index_cache';
        var S24_GLOSSARY_ALIASES_CACHE_KEY = 's24_glossary_aliases_cache';
        var S24_GLOSSARY_INDEX_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 ساعات
        var s24CachedGlossaryIndex = null;
        var s24CachedAliasesMap = null;
        
        try {
            var s24IndexRecord = JSON.parse(localStorage.getItem(S24_GLOSSARY_INDEX_CACHE_KEY));
            if (s24IndexRecord && (Date.now() - s24IndexRecord.timestamp) < S24_GLOSSARY_INDEX_CACHE_TTL) {
                s24CachedGlossaryIndex = s24IndexRecord.data;
            } else if (s24IndexRecord) {
                localStorage.removeItem(S24_GLOSSARY_INDEX_CACHE_KEY);
            }
        } catch(e) {}

        try {
            var s24AliasesRecord = JSON.parse(localStorage.getItem(S24_GLOSSARY_ALIASES_CACHE_KEY));
            if (s24AliasesRecord && (Date.now() - s24AliasesRecord.timestamp) < S24_GLOSSARY_INDEX_CACHE_TTL) {
                s24CachedAliasesMap = s24AliasesRecord.data;
            } else if (s24AliasesRecord) {
                localStorage.removeItem(S24_GLOSSARY_ALIASES_CACHE_KEY);
            }
        } catch(e) {}

        (s24CachedGlossaryIndex ? Promise.resolve({ index: s24CachedGlossaryIndex, aliases: s24CachedAliasesMap }) :
            // الفهرس من Firestore (مستند واحد = قراءة واحدة)
            fetch('https://firestore.googleapis.com/v1/projects/s24n-views/databases/(default)/documents/glossary/index?mask.fieldPaths=json&mask.fieldPaths=aliases')
                .then(function(res){ 
                    if (!res.ok) { throw new Error('fs'); } 
                    return res.json(); 
                })
                .then(function(doc){ 
                    var index = JSON.parse(doc.fields.json.stringValue);
                    var aliases = doc.fields.aliases ? JSON.parse(doc.fields.aliases.stringValue) : {};
                    return { index: index, aliases: aliases };
                })
                .catch(function(){
                    // رجوع تلقائي إلى Realtime عند أي فشل
                    return fetch('https://s24n-views-default-rtdb.firebaseio.com/glossaryIndex.json')
                        .then(function(res){ 
                            return res.json(); 
                        })
                        .then(function(data){
                            return { index: data, aliases: {} };
                        });
                })
        )
        .then(function(result){
            var list = result.index;
            var aliasesMap = result.aliases || {};
            
            var map = {};
            (list || []).forEach(function(item){
                if (item && item.term) { 
                    map[item.term] = item.url; 
                }
            });

            // حفظ في الـ cache
            try { 
                localStorage.setItem(S24_GLOSSARY_INDEX_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: list })); 
                localStorage.setItem(S24_GLOSSARY_ALIASES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: aliasesMap }));
            } catch(e) {}

            // معالجة كل التلميحات
            document.querySelectorAll('.sy-tooltip').forEach(function(el){
                var word = el.textContent.trim();
                var normalized = s24Normalize(word);
                var foundUrl = null;

                // المرحلة 1️⃣: مطابقة دقيقة
                if (map[word]) {
                    foundUrl = map[word];
                } else {
                    // المرحلة 2️⃣: بحث مع تطبيع عربي موحّد
                    for (var key in map) {
                        if (s24Normalize(key) === normalized) {
                            foundUrl = map[key];
                            break;
                        }
                    }
                }

                // المرحلة 3️⃣: بحث في الـ aliases
                if (!foundUrl && aliasesMap) {
                    for (var mainTerm in aliasesMap) {
                        var aliases = aliasesMap[mainTerm];
                        if (Array.isArray(aliases)) {
                            for (var i = 0; i < aliases.length; i++) {
                                if (s24Normalize(aliases[i]) === normalized) {
                                    // أوجد المصطلح الأصلي في الخريطة
                                    foundUrl = map[mainTerm];
                                    break;
                                }
                            }
                            if (foundUrl) break;
                        }
                    }
                }

                // المرحلة 4️⃣: تصحيح إملائي ذكي (Levenshtein Distance ≤ 1)
                if (!foundUrl) {
                    for (var key in map) {
                        if (s24LevenshteinDistance(normalized, s24Normalize(key)) <= 1) {
                            foundUrl = map[key];
                            break;
                        }
                    }
                }

                // إذا وجدنا رابط، حوّل span إلى رابط
                if (foundUrl && el.tagName !== 'A') {
                    var a = document.createElement('a');
                    a.className = el.className;
                    a.setAttribute('data-title', 'اضغط لقراءة المقالة كاملة');
                    a.href = foundUrl;
                    // داخل الموسوعة: تصفّح في نفس الصفحة. خارجها: تبويب جديد
                    if (!document.body.classList.contains('s24-glossary-article')) {
                        a.target = '_blank';
                        a.rel = 'noopener';
                    }
                    a.textContent = el.textContent;
                    el.parentNode.replaceChild(a, el);
                }
            });
        })
        .catch(function(err){
            console.warn('⚠️ فشل جلب فهرس الموسوعة:', err);
        });
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
    var BOX_HALF    = 150;  // نصف أقصى عرض للصندوق + هامش
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
