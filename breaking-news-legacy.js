/* ============================================================
   S24News — شريط الأخبار العاجلة
   يقرأ الإعدادات (autoConfig / GOOGLE_SHEET_API) من ودجت
   "إعدادات الخبر العاجل" في تخطيط بلوجر — لا تنقلها إلى هنا
   ============================================================ */

document.addEventListener("DOMContentLoaded", function() {
    var containerBox = document.getElementById('breakingNewsContainer');
    if(!containerBox) return;

    if (typeof autoConfig === 'undefined') {
        window.autoConfig = { displayMinutes: 10, labelName: "*A", maxResults: 5 };
    }
    if (typeof GOOGLE_SHEET_API === 'undefined') {
        window.GOOGLE_SHEET_API = "";
    }

    const cleanStyle = "text-decoration: none !important; border: 0 !important; box-shadow: none !important; background: none !important; color: var(--color-white, #ffffff) !important; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; outline: 0 !important;";

    // 🟢 إصلاح رقم 1: مصفوفة موحّدة + فهرس Set لمنع التكرار بين المصادر الثلاثة
    var mergedNews = [];
    var seenKeys = new Set();
    var now = new Date();
    var currentIndex = 0;
    var tickerTimer = null;
    var isFirstRender = true;

    // 🟢 إصلاح رقم 2: تنقية النص قبل إدراجه في الصفحة (حماية من XSS)
    function escapeHTML(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // مفتاح فريد لكل خبر لمنع تكراره (حسب الرابط إن وجد، وإلا حسب النص)
    function getNewsKey(news) {
        if (news.link && news.link !== '#' && !news.link.startsWith('http://#') && !news.link.startsWith('https://#')) {
            return news.link.split('?')[0].split('#')[0];
        }
        return 'text::' + news.title.trim();
    }

    // إضافة أخبار جديدة للمصفوفة الموحّدة دون حذف ما هو موجود ودون تكرار
    function addNewsItems(items) {
        var addedAny = false;
        items.forEach(function(item) {
            var key = getNewsKey(item);
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                mergedNews.push(item);
                addedAny = true;
            }
        });
        return addedAny;
    }

    // 🟢 إصلاح رقم 3: لا يعيد تصفير العداد أو المؤقت عند وصول مصدر جديد
    // فقط يبدأ التشغيل أول مرة، وبعدها يكتفي بإضافة العناصر الجديدة بهدوء
    function startOrUpdateTicker() {
        if (mergedNews.length === 0) return;

        // إظهار الشريط (يعتمد على كلاس is-active مع CSS المعدّل الذي يمنع القفزة البصرية)
        containerBox.classList.add('is-active');
        containerBox.setAttribute('aria-live', 'polite'); // 🟢 إصلاح رقم 4: دعم قارئات الشاشة
        containerBox.setAttribute('role', 'status');

        if (isFirstRender) {
            isFirstRender = false;
            updateDisplay(0);
            if (mergedNews.length > 1) {
                tickerTimer = setInterval(function() {
                    currentIndex = (currentIndex + 1) % mergedNews.length;
                    updateDisplay(currentIndex);
                }, 5000);
            }
        } else if (mergedNews.length > 1 && !tickerTimer) {
            // كان هناك خبر واحد فقط وأصبح هناك أكثر من خبر بعد وصول مصدر جديد
            tickerTimer = setInterval(function() {
                currentIndex = (currentIndex + 1) % mergedNews.length;
                updateDisplay(currentIndex);
            }, 5000);
        }
    }

    function updateDisplay(index) {
        var news = mergedNews[index];
        var safeTitle = escapeHTML(news.title);
        var contentHTML = '';
        if (news.link && news.link !== '#' && news.link !== 'http://#' && news.link !== 'https://#') {
            contentHTML = `<a href="${news.link}" class="breaking-title-animated" style="${cleanStyle}"><span>${safeTitle}</span></a>`;
        } else {
            contentHTML = `<span class="breaking-title-animated" style="${cleanStyle} cursor:default;">${safeTitle}</span>`;
        }
        containerBox.innerHTML = `<div class="widget-content" style="height:100%; border:0 !important;">${contentHTML}</div>`;
    }

    // فحص صيغة التوقيت {تاريخ ساعة:دقيقة} أو {ساعة:دقيقة} وإزالتها من النص المعروض
    function parseExpiry(rawText) {
        var isValid = true;
        var timeMatch = rawText.match(/\{((?:\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+)?(\d{1,2}):(\d{2})\}/);
        if (timeMatch) {
            var expiryDate = new Date();
            var hours = parseInt(timeMatch[2]);
            var minutes = parseInt(timeMatch[3]);
            if (timeMatch[1]) {
                var dateParts = timeMatch[1].trim().split(/[\/\-]/);
                var day = parseInt(dateParts[0]);
                var month = parseInt(dateParts[1]) - 1;
                if (dateParts[2]) {
                    var year = parseInt(dateParts[2]);
                    if (year < 100) year += 2000;
                    expiryDate.setFullYear(year, month, day);
                } else {
                    expiryDate.setMonth(month, day);
                }
            }
            expiryDate.setHours(hours, minutes, 0, 0);
            if (now > expiryDate) isValid = false;
            rawText = rawText.replace(timeMatch[0], '').trim();
        }
        return { text: rawText, valid: isValid };
    }

    // ============================================================
    // 🟢 1. الأخبار اليدوية (LinkList5) - نفس المنطق الأصلي بالضبط
    // ============================================================
    var linkWidget = document.getElementById('LinkList5');
    if (linkWidget) {
        var links = linkWidget.querySelectorAll('li a');
        var manualNews = [];
        links.forEach(function(link) {
            var rawText = (link.textContent || link.innerText).trim();
            var href = link.getAttribute('href');
            var parsed = parseExpiry(rawText);
            if (parsed.valid && parsed.text !== "" && parsed.text !== "Manual_Breaking_News") {
                manualNews.push({ title: parsed.text, link: href });
            }
        });
        if (addNewsItems(manualNews)) startOrUpdateTicker();
    }

    // ============================================================
    // 🟢 2. الأخبار الآلية (تسمية *A في المدونة)
    // ============================================================
    var feedUrl = '/feeds/posts/summary/-/' + encodeURIComponent(autoConfig.labelName) + '?alt=json&max-results=' + autoConfig.maxResults + '&cb=' + Math.random();
    fetch(feedUrl).then(function(response) { return response.json(); }).then(function(data) {
        var autoNews = [];
        if (data.feed && data.feed.entry) {
            data.feed.entry.forEach(function(entry) {
                var pubDate = new Date(entry.published.$t);
                if (Math.abs(now - pubDate) / 60000 <= autoConfig.displayMinutes) {
                    autoNews.push({ title: entry.title.$t, link: entry.link.find(function(l) { return l.rel === 'alternate'; }).href });
                }
            });
        }
        if (addNewsItems(autoNews)) startOrUpdateTicker();
    }).catch(function() {});

    // ============================================================
    // 🟢 3. أخبار جدول جوجل شيت (مع كاش 3 دقائق كما في الأصل)
    // ============================================================
    if (GOOGLE_SHEET_API !== "ضع_رابط_تطبيق_الويب_هنا" && GOOGLE_SHEET_API !== "") {

        function processSheetData(sheetData) {
            var sheetNews = [];
            sheetData.forEach(function(item) {
                var parsed = parseExpiry(item.title);
                if (parsed.valid && parsed.text) {
                    sheetNews.push({ title: parsed.text, link: item.link });
                }
            });
            if (addNewsItems(sheetNews)) startOrUpdateTicker();
        }

        var CACHE_KEY = 's24_sheet_breaking_news';
        var CACHE_TIME = 3 * 60 * 1000;
        var cachedData = window.S24Cache.get(CACHE_KEY, CACHE_TIME);

        if (cachedData) {
            processSheetData(cachedData);
        } else {
            fetch(GOOGLE_SHEET_API).then(function(response) { return response.json(); }).then(function(sheetData) {
                window.S24Cache.set(CACHE_KEY, sheetData);
                processSheetData(sheetData);
            }).catch(function() {});
        }
    }
});
