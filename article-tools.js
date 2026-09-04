/* ============================================================
   S24News — شريط أدوات المقال + شريط تقدّم القراءة
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

document.addEventListener("DOMContentLoaded", function() {
    // 1. التأكد أننا داخل صفحة مقال فقط
    if (!document.body.classList.contains('item-page')) return;

    // =========================================================
    // 🛑 الفلتر الذكي الشامل: إخفاء الشريط من صفحات محددة
    // =========================================================
    if (window.location.href.includes('/p/') || 
        document.querySelector('.weather-post-container') || 
        document.querySelector('.currency-post-container') ||
        document.body.classList.contains('s24-glossary-article')) {
        return; // توقف هنا ولا تقم بتشغيل شريط الأدوات أو شريط القراءة أبداً
    }
    // =========================================================

    // 🆕 معرض الصور: أخفِ الشريط فقط لو كان معرضاً "لوحده" بلا أي كتابة حقيقية —
    //    أما لو وُجدت كتابة فعلية (تحت المعرض، أو المعرض جزء من مقال أطول) فيبقى الشريط ظاهراً
    if (document.body.classList.contains('s24-gallery-article')) {
        var s24GalleryPostBody = document.querySelector('[id^="post-body-"]');
        var s24GalleryTextLen = 0;
        if (s24GalleryPostBody) {
            // 🔧 نسخة مؤقتة بلا وسوم <script>/<style> — كودها البرمجي كان يُحتسب
            // بالخطأ "نصاً حقيقياً" فيتجاوز العتبة دائماً مهما كان المقال فارغاً من الكتابة
            var s24GalleryClone = s24GalleryPostBody.cloneNode(true);
            var s24GalleryJunk = s24GalleryClone.querySelectorAll('script, style');
            for (var s24J = 0; s24J < s24GalleryJunk.length; s24J++) {
                s24GalleryJunk[s24J].remove();
            }
            s24GalleryTextLen = (s24GalleryClone.textContent || '').trim().length;
        }
        if (s24GalleryTextLen < 60) {
            return; // معرض صور لوحده بلا كتابة حقيقية: أخفِ شريط الأدوات
        }
        // خلاف ذلك توجد كتابة حقيقية — لا نتوقف هنا، الشريط سيظهر بشكل طبيعي أدناه
    }
    // =========================================================

    var postBody = document.querySelector('[id^="post-body-"]');
    if (!postBody) return;

    // =========================================================
    // ✅ دالة محسّنة: عد كلمات النص الفعلي فقط (تتجاهل الوسائط)
    // =========================================================
    function s24CountRealWords(postBody) {
        var realText = '';
        var nodes = postBody.childNodes;
        
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            
            // النصوص المباشرة
            if (node.nodeType === 3) { // TEXT_NODE
                realText += node.textContent;
            }
            // عناصر HTML (تجاهل الوسائط والعناصر الفارغة)
            else if (node.nodeType === 1) { // ELEMENT_NODE
                var tagName = node.tagName.toUpperCase();
                
                // تجاهل الوسائط والعناصر غير المرغوبة
                if (['IFRAME', 'VIDEO', 'IMG', 'SCRIPT', 'STYLE', 'FIGURE', 'AUDIO', 'OBJECT', 'EMBED'].includes(tagName)) {
                    continue; // تجاهل هذا العنصر
                }
                
                // أضف نصوص العنصر
                var text = node.innerText || node.textContent || '';
                if (text.trim().length > 0) {
                    realText += text;
                    realText += ' ';
                }
            }
        }
        
        // حساب كلمات فعلية (تجاهل المسافات الزائدة)
        var wordCount = realText.trim().split(/\s+/).filter(function(word) {
            return word.length > 0;
        }).length;
        
        return wordCount;
    }

    // 2. حساب وقت القراءة (باستخدام الدالة المحسّنة)
    const wordCount = s24CountRealWords(postBody);
    let readTime = Math.ceil(wordCount / 200);
    if (readTime < 1) readTime = 1;

    // ✅ فحص الكتابة (الآن صحيح 100% - يعتمد على نصوص فعلية فقط)
    if (wordCount < 50) {
        return;  // لا توجد كتابة فعلية → توقف، لا تنشئ شريط
    }

    // 3. إنشاء الهيكل للشريط المدمج
    var toolsBar = document.createElement('div');
    toolsBar.className = 'sy-article-tools';
    toolsBar.innerHTML = `
        <div class="sy-tools-group">
            
            <div class="sy-audio-capsule" id="audio-capsule">
                <button id="btn-read-aloud" title="استماع للمقال">
                    <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                </button>
                <div class="sy-capsule-divider"></div>
                <button id="btn-tts-speed" title="سرعة القراءة">
                    <span id="tts-speed-text">1x</span>
                </button>
            </div>

            <button class="sy-tool-btn" id="btn-print-article" title="طباعة المقال">
                <svg viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
                <span class="hide-mobile">طباعة</span>
            </button>
            <div class="s24-read-time" title="وقت القراءة التقريبي">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span class="hide-mobile">يقرأ في ${readTime} دقيقة</span>
                <span class="show-mobile-only">${readTime} د</span>
            </div>
        </div>
        <div class="sy-tools-group">
            <button class="sy-tool-btn" id="btn-font-plus" title="تكبير الخط"><span>A+</span></button>
            <button class="sy-tool-btn" id="btn-font-reset" title="الخط الافتراضي"><span>A</span></button>
            <button class="sy-tool-btn" id="btn-font-minus" title="تصغير الخط"><span>A-</span></button>
        </div>
    `;

    // 4. وضع الشريط تحت الصورة الأولى مباشرة
    var firstImageContainer = postBody.querySelector('.separator') || postBody.querySelector('img');
    
        // ابحث عن الفيديو (بسيط وفعال) — فقط لو كان هذا فعلاً "مقال فيديو" محسوماً مسبقاً
    // عبر s24DetectArticleType، تفادياً لالتصاق الشريط بأي تضمين فيسبوك/يوتيوب ثانوي
    // وسط المقال (ريلز، منشور مُرفق بفيديو...) ليس هو الفيديو القائد الفعلي للمقال
    var videoElement = document.body.classList.contains('s24-video-article')
        ? (postBody.querySelector('iframe') || postBody.querySelector('video'))
        : null;

    // إذا وجدنا فيديو → ضع الشريط بعده مباشرة
    if (videoElement) {
        if (videoElement.nextSibling) {
            videoElement.parentNode.insertBefore(toolsBar, videoElement.nextSibling);
        } else {
            // إذا لم يكن هناك عنصر بعد الفيديو → أضفه في النهاية
            videoElement.parentNode.appendChild(toolsBar);
        }
    }
    // وإلا إذا كانت هناك صورة → ضع الشريط بعدها
    else if (firstImageContainer) {
        // اطلع لفوق بسلسلة الآباء
        while (firstImageContainer && firstImageContainer.parentNode !== postBody) {
            firstImageContainer = firstImageContainer.parentNode;
        }
        
        if (firstImageContainer && firstImageContainer !== postBody && firstImageContainer.nextSibling) {
            postBody.insertBefore(toolsBar, firstImageContainer.nextSibling);
        } else if (firstImageContainer && firstImageContainer !== postBody) {
            postBody.appendChild(toolsBar);
        } else {
            postBody.insertBefore(toolsBar, postBody.firstChild);
        }
    }
    // وإلا ضع الشريط في البداية
    else {
        postBody.insertBefore(toolsBar, postBody.firstChild);
    }

    // =========================================================
    // 5. برمجة التحكم بالخط (الحقن الإجباري مع الذاكرة)
    // =========================================================
    let dynamicStyle = document.createElement('style');
    document.head.appendChild(dynamicStyle);
    let currentFontSize = parseInt(localStorage.getItem('s24_font_size')) || 19;
    
    function applyFontSize(size) {
        dynamicStyle.innerHTML = `
            .item-page .post-body, 
            .item-page .post-body p, 
            .item-page .post-body span:not(.sy-article-tools *), 
            .item-page .post-body div:not(.sy-article-tools):not(.sy-article-tools *), 
            .item-page .post-body a:not(.sy-article-tools *), 
            .item-page .post-body li { 
                font-size: ${size}px !important; 
                line-height: 1.9 !important; 
            }
            
            .item-page .post-body .sy-article-tools,
            .item-page .post-body .sy-article-tools div,
            .item-page .post-body .sy-article-tools span,
            .item-page .post-body .sy-article-tools button {
                font-size: 13px !important;
                line-height: normal !important;
            }
        `;
    }
    applyFontSize(currentFontSize);

    document.getElementById('btn-font-plus').addEventListener('click', function() {
        if(currentFontSize < 30) {
            currentFontSize += 2;
            applyFontSize(currentFontSize);
            localStorage.setItem('s24_font_size', currentFontSize);
        }
    });
    
    // الزر الخاص بالعودة للخط الافتراضي
    document.getElementById('btn-font-reset').addEventListener('click', function() {
        currentFontSize = 19; // الحجم الافتراضي لقالبك
        applyFontSize(currentFontSize);
        localStorage.setItem('s24_font_size', currentFontSize);
    });

    document.getElementById('btn-font-minus').addEventListener('click', function() {
        if(currentFontSize > 14) {
            currentFontSize -= 2;
            applyFontSize(currentFontSize);
            localStorage.setItem('s24_font_size', currentFontSize);
        }
    });

    // 6. الطباعة
    document.getElementById('btn-print-article').addEventListener('click', function() { window.print(); });

    // =========================================================
    // 7. المحرك الصوتي المتقدم (الكبسولة + السرعة + استكمال القراءة) 🟢
    // =========================================================
    var btnReadAloud = document.getElementById('btn-read-aloud');
    var audioCapsule = document.getElementById('audio-capsule'); 
    var btnTtsSpeed = document.getElementById('btn-tts-speed'); 
    var ttsSpeedText = document.getElementById('tts-speed-text'); 
    
    var synth = window.speechSynthesis;
    var isSpeaking = false;
    
    // متغيرات جديدة لتعقب مكان القراءة
    var textChunks = [];
    var currentChunkIndex = 0; 
    
    // إعدادات السرعات المتاحة
    var speedOptions = [1, 1.5, 2];
    var currentSpeedIndex = 0;

    // 1. وظيفة زر تغيير السرعة
    btnTtsSpeed.addEventListener('click', function() {
        currentSpeedIndex = (currentSpeedIndex + 1) % speedOptions.length;
        var selectedSpeed = speedOptions[currentSpeedIndex];
        ttsSpeedText.innerText = selectedSpeed + 'x';
        
        // إذا كان الصوت يعمل، نوقفه ونستكمل من نفس الجملة بالسرعة الجديدة
        if (isSpeaking) {
            synth.cancel(); // إيقاف فوري
            setTimeout(function() {
                playFromCurrentIndex(); // استكمال من حيث توقف
            }, 100);
        }
    });

    // 2. إعادة ضبط شكل الزر وإرجاع العداد للصفر
    function resetTTSUI() {
        isSpeaking = false;
        currentChunkIndex = 0; // تصفير العداد
        audioCapsule.classList.remove('active-tts'); 
        btnReadAloud.querySelector('svg').innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
    }

    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = function() { synth.getVoices(); };
    }

    // 3. دالة التشغيل الذكية (تبدأ من حيث توقفت)
    function playFromCurrentIndex() {
        if (textChunks.length === 0) return;
        
        synth.cancel(); // تنظيف أي أوامر سابقة معلقة       

        var voices = synth.getVoices();
        var arabicVoice = voices.find(function(v) { return v.lang.startsWith('ar'); });
        var activeSpeed = speedOptions[currentSpeedIndex];

        // نُرسل الجمل المتبقية للمتصفح ليقرأها
        for (let i = currentChunkIndex; i < textChunks.length; i++) {
            var cleanChunk = textChunks[i].trim();
            if (cleanChunk.length === 0) continue;

            let utterance = new SpeechSynthesisUtterance(cleanChunk);
            utterance.lang = 'ar-SA';
            if (arabicVoice) utterance.voice = arabicVoice;
            
            utterance.rate = activeSpeed; // السرعة المختارة
            utterance.pitch = 1.1;          // صوت أعلى قليلاً فقط
            utterance.volume = 1;           // مستوى الصوت كامل

            // 🟢 السر هنا: تحديث رقم الجملة الحالية عند بدء نطقها
            utterance.onstart = function() {
                currentChunkIndex = i;
            };

            // إرجاع الزر لشكله الطبيعي عند انتهاء آخر جملة
            if (i === textChunks.length - 1) {
                utterance.onend = function() { resetTTSUI(); };
            }

            utterance.onerror = function(e) { console.warn("TTS Error:", e); };

            synth.speak(utterance);
        }

        isSpeaking = true;
        audioCapsule.classList.add('active-tts'); // إضاءة الكبسولة
        btnReadAloud.querySelector('svg').innerHTML = '<path d="M6 6h12v12H6z"/>';
    }

    // 4. وظيفة زر التشغيل/الإيقاف الرئيسي
    btnReadAloud.addEventListener('click', function() {
        // إذا كان يقرأ، أوقفه تماماً وصفر العداد
        if (isSpeaking || synth.speaking) {
            synth.cancel();
            resetTTSUI();
            return;
        }

        // إذا كانت هذه بداية القراءة، نجهز النص
        var tempClone = postBody.cloneNode(true);
        var toolsInClone = tempClone.querySelector('.sy-article-tools');
        if (toolsInClone) toolsInClone.remove();

        // حذف العنوان
        var titleInClone = tempClone.querySelector('h1.post-title, h3.post-title, .post-title');
        if (titleInClone) titleInClone.remove();

        // حذف جميع العناصر غير المرغوبة
        var unwanted = tempClone.querySelectorAll('script, style, .sy-article-tools, [class*="widget"], [class*="meta"], [id*="ad"]');
        unwanted.forEach(function(el) { el.remove(); });

        var articleText = tempClone.innerText;
        articleText = articleText.trim();
        
        if (articleText.length === 0) return;

        // تقسيم المقال إلى جمل - محسّن
        // تنظيف النص أولاً من المسافات الزائدة
        articleText = articleText.replace(/\s+/g, ' ').trim();
        
        // تقسيم أفضل للجمل
        var chunks = articleText.match(/[^.،؟!]+[.،؟!]*/g) || [];
        
        // تنظيف وتصفية الجمل الفارغة والقصيرة جداً
        chunks = chunks.map(function(chunk) { 
            return chunk.trim(); 
        }).filter(function(chunk) { 
            return chunk.length > 3; // تجاهل الجمل الأقل من 3 أحرف
        });
        
        textChunks = chunks.length > 0 ? chunks : [articleText];
        currentChunkIndex = 0; // نبدأ من الصفر

        playFromCurrentIndex();
    });
    
    // إيقاف الصوت فوراً إذا غادر الزائر الصفحة
    window.addEventListener('beforeunload', function() {
        if(synth.speaking) synth.cancel();
    });

    // ==========================================
    // 8. شريط تقدم القراءة (العلوي)
    // ==========================================
    const progressContainer = document.createElement('div');
    progressContainer.id = 's24-progress-container';
    progressContainer.innerHTML = '<div id="s24-progress-bar"></div>';
    document.body.appendChild(progressContainer);

    const progressBar = document.getElementById('s24-progress-bar');

    // 🟢 إصلاح: تجميع القراءة والتحديث في دالة واحدة تُنفَّذ عبر requestAnimationFrame
    // بدل التنفيذ الفوري في كل حدث scroll (يتكرر عشرات المرات بالثانية ويُجبر إعادة حساب التخطيط)
    let progressTicking = false;
    function updateReadingProgress() {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        // 🟢 إصلاح: حماية من القسمة على صفر/سالب في المقالات القصيرة التي لا تحتاج تمريراً إطلاقاً
        let scrolled = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        progressBar.style.width = scrolled + '%';
        progressTicking = false;
    }

    window.addEventListener('scroll', () => {
        if (!progressTicking) {
            window.requestAnimationFrame(updateReadingProgress);
            progressTicking = true;
        }
    }, { passive: true });
});
