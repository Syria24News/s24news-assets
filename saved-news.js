/* ============================================================
   S24News — نظام الأخبار المحفوظة
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

/* ============================================================
   💾 نظام الأخبار المحفوظة الشامل - مرتب حسب الأحدث
   ============================================================ */

document.addEventListener("DOMContentLoaded", function() {
    // 1. تفعيل وضع صفحة المحفوظات
    if (window.location.href.indexOf("saved-news") > -1) {
        document.body.classList.add('saved-page-mode'); 
        document.body.classList.add('most-read-page'); 
        renderSavedPage();
    }

    // 2. تفعيل أزرار الحفظ في الموقع
    setupSaveButtons();
});

/* --- دوال التخزين (Local Storage) --- */
function getSavedPosts() {
    try { return JSON.parse(localStorage.getItem('savedPosts') || '[]'); } catch (e) { return []; }
}

function savePost(postUrl) {
    let cleanUrl = getCleanUrl(postUrl);
    let saved = getSavedPosts();
    if (!saved.includes(cleanUrl)) {
        saved.push(cleanUrl);
        localStorage.setItem('savedPosts', JSON.stringify(saved));
    }
}

function removePost(postUrl) {
    let cleanUrl = getCleanUrl(postUrl);
    let saved = getSavedPosts();
    saved = saved.filter(url => url !== cleanUrl);
    localStorage.setItem('savedPosts', JSON.stringify(saved));
}

function isPostSaved(postUrl) {
    let cleanUrl = getCleanUrl(postUrl);
    return getSavedPosts().includes(cleanUrl);
}

function getCleanUrl(url) {
    if(!url) return "";
    try {
        let urlObj = new URL(url);
        return urlObj.origin + urlObj.pathname;
    } catch (e) {
        return url.split('?')[0].split('#')[0];
    }
}

/* --- دالة جلب تفاصيل المقال (مع تاريخ النشر) --- */
const fetchPostDetails = (postUrl) => {
    return new Promise((resolve) => {
        let path = postUrl;
        try { 
            const urlObj = new URL(postUrl); 
            path = urlObj.pathname; 
        } catch(e) {
            path = postUrl.replace(/^(?:https?:\/\/[^\/]+)?(\/.*)/, '$1').split('?')[0];
        }

        const feedUrl = '/feeds/posts/summary?alt=json&path=' + encodeURIComponent(path);

        fetch(feedUrl)
            .then(response => {
                if (!response.ok) {
                    // 🟢 إصلاح: نميّز 404 الحقيقي (المقال محذوف فعلياً من الموقع) عن أي استجابة فاشلة أخرى
                    var httpErr = new Error("HTTP " + response.status);
                    httpErr.isConfirmedNotFound = (response.status === 404);
                    throw httpErr;
                }
                return response.json();
            })
            .then(data => {
                if (data.feed && data.feed.entry && data.feed.entry.length > 0) {
                    const entry = data.feed.entry[0];
                    const title = entry.title.$t;
                    const publishedDate = entry.published.$t; // تاريخ النشر للترتيب
                    
                    let img = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgeuurJSEqv95Xbqa7rYRACLNXO6YFHA1YhWsH_3pb57sA_g01cDkD44MGxWQNDTJNeO4Ol2tRAOOBMVWPKoahUXss3sbQMmHQu3GzRmE3FpAK7r6NDzRx3joLDgGgkduyZU0vmx1AoZinzDhehul5DDuR_9J30CnAAS9hyE1AekqBKk2nynpp2UlqZT7Hf/s16000/logo24sn.png";
                    if (entry.media$thumbnail) {
                        img = entry.media$thumbnail.url
                            .replace(/\/s[0-9]+.*?\//, '/w720-h405-c/')
                            .replace(/\/w[0-9]+.*?\//, '/w720-h405-c/');
                    }
                    
                    let snippet = "";
                    if (entry.summary) {
                        snippet = entry.summary.$t.replace(/<[^>]*>?/gm, '').substring(0, 120) + "...";
                    }

                    let finalLink = postUrl;
                    if(entry.link) {
                         entry.link.forEach(l => { if(l.rel === 'alternate') finalLink = l.href; });
                    }

                    resolve({ title, img, snippet, url: finalLink, published: publishedDate, valid: true });
                } else {
                    // 🟢 استجابة ناجحة لكن بلا أي مقال ضمن الخلاصة = المقال غير موجود فعلياً
                    resolve({ valid: false, notFound: true, url: postUrl });
                }
            })
            .catch(err => {
                // 🟢 إصلاح: خطأ شبكة/انقطاع اتصال/فشل تحليل ≠ مقال محذوف. لا نُسقط الرابط من القائمة إلا
                // إذا تأكدنا فعلياً أنه 404 — أي سبب آخر يُبقي الرابط ليُعاد جلبه في زيارة لاحقة
                resolve({ valid: false, notFound: !!(err && err.isConfirmedNotFound), url: postUrl });
            });
    });
};

/* --- دالة رسم الصفحة (الترتيب: الأحدث للأقدم) --- */
async function renderSavedPage() {
    const container = document.getElementById('saved-posts-renderer');
    if (!container) return;

    const savedUrls = getSavedPosts();

    if (savedUrls.length === 0) {
        container.innerHTML = `
            <div style="padding:80px 20px; text-align:center;">
                <h3 style="margin-bottom:10px; font-size:20px;">القائمة فارغة</h3>
                <p style="color:var(--text-sec); margin-bottom:20px;">لم تقم بحفظ أي أخبار بعد.</p>
                <a href="/" style="display:inline-block; padding:10px 25px; background:#6db200; color:#fff; text-decoration:none; border-radius:30px; font-weight:bold;">تصفح الأخبار الآن</a>
            </div>`;
        return;
    }

    // عرض الهيكل العظمي (إذا كانت دالة getSkeletonHTML موجودة في قالبك)
    if(typeof getSkeletonHTML === 'function') {
        container.innerHTML = getSkeletonHTML('list');
    } else {
        container.innerHTML = '<div style="padding:50px; text-align:center;">جاري التحميل...</div>';
    }
const promises = savedUrls.map(url => fetchPostDetails(url));
    const postsData = await Promise.all(promises);
    let validPosts = postsData.filter(p => p.valid);

    // 🟢 إصلاح: نحذف من القائمة المحفوظة فقط الروابط المؤكَّد أنها 404 حقيقي (مقال محذوف فعلياً من الموقع)،
    // لا أي رابط فشل جلبه بسبب انقطاع شبكة أو عطل مؤقت — تلك الروابط تبقى في القائمة لإعادة المحاولة لاحقاً
    const confirmedGoneUrls = postsData.filter(p => !p.valid && p.notFound).map(p => p.url);
    if (confirmedGoneUrls.length > 0) {
        const stillSaved = savedUrls.filter(u => confirmedGoneUrls.indexOf(u) === -1);
        localStorage.setItem('savedPosts', JSON.stringify(stillSaved));
    }

    // تنظيف الروابط التالفة
    if (savedUrls.length > 0 && validPosts.length === 0) {
         if (confirmedGoneUrls.length === savedUrls.length) {
             // 🟢 كل المقالات المحفوظة تأكَّد حذفها فعلياً من الموقع
             container.innerHTML = '<div style="padding:50px; text-align:center;">تم تحديث البيانات. القائمة فارغة.</div>';
         } else {
             // 🟢 إصلاح: فشل مؤقت (شبكة/اتصال) — لا نحذف القائمة، فقط نُعلم الزائر ونتيح إعادة المحاولة
             container.innerHTML = `
                <div style="padding:80px 20px; text-align:center;">
                    <h3 style="margin-bottom:10px; font-size:20px;">تعذّر تحميل مقالاتك المحفوظة</h3>
                    <p style="color:var(--text-sec); margin-bottom:20px;">تحقّق من اتصالك بالإنترنت ثم حاول مجدداً — قائمتك المحفوظة لم تُحذف.</p>
                    <button onclick="renderSavedPage()" style="display:inline-block; padding:10px 25px; background:#6db200; color:#fff; border:none; border-radius:30px; font-weight:bold; cursor:pointer;">إعادة المحاولة</button>
                </div>`;
         }
         return;
    }

    // 🟢 الترتيب الزمني: الأحدث أولاً
    validPosts.sort((a, b) => {
        return new Date(b.published) - new Date(a.published);
    });

    let html = '';
    validPosts.forEach((post, idx) => {
        html += `
        <div class="post-outer saved-item-wrapper" style="position:relative;">
            <div class="post hentry">
                <h3 class="post-title entry-title added-title">
                    <a href="${post.url}">${post.title}</a>
                </h3>
                <div class="post-header"><div class="post-header-line-1"></div></div>
                <div class="post-body entry-content">
                    <div class="separator" style="clear: both; text-align: center; margin-bottom: 15px;">
                        <a href="${post.url}">
                            <img src="${post.img}" alt="${post.title}" loading="${idx === 0 ? 'eager' : 'lazy'}" style="display:block; width:100%; height:auto; max-height:405px; aspect-ratio:16/9; object-fit:cover; border-radius:0;">
                        </a>
                    </div>
                    <div class="post-snippet" style="margin-top:10px; font-size:14px; color:var(--text-sec);">${post.snippet}</div>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;

    // إعادة تشغيل الفوتر والأزرار
    setTimeout(() => {
        if(typeof generateCustomFooters === 'function') {
            generateCustomFooters();
        }
        setupSaveButtons();
    }, 200);
}

/* --- إعداد الأزرار في الموقع --- */
function setupSaveButtons() {
    const saveButtons = document.querySelectorAll('.rt-icon-group.save-btn');
    saveButtons.forEach(button => {
        let postUrl = "";
        const onclickAttr = button.getAttribute('onclick'); 
        const dataUrl = button.getAttribute('data-url');

        if(dataUrl) postUrl = dataUrl;
        else if(onclickAttr && onclickAttr.includes("toggleSave")) {
             const match = onclickAttr.match(/'([^']+)'/);
             if(match) postUrl = match[1];
        }

        if (!postUrl) return;
        const cleanUrl = getCleanUrl(postUrl);
        const svg = button.querySelector('svg');

        if (isPostSaved(cleanUrl)) {
            button.classList.add('saved');
            if(svg) { svg.style.fill = '#6db200'; svg.style.stroke = '#6db200'; }
        } else {
            button.classList.remove('saved');
            if(svg) { svg.style.fill = 'none'; svg.style.stroke = 'currentColor'; }
        }
    });
}

/* --- دالة التفاعل (للاستخدام في HTML) --- */
window.performSave = function(btnElement, url) {
    if (typeof isPostSaved === 'function' && isPostSaved(url)) {
        removePost(url);
        updateSaveIcon(btnElement, false);
        if(typeof showToast === 'function') showToast('تمت الإزالة');
        
        // الحذف الفوري إذا كنا في صفحة المحفوظات
        if (window.location.href.indexOf("saved-news") > -1) {
             var wrapper = btnElement.closest('.post-outer');
             if(wrapper) {
                 wrapper.style.transition = '0.3s';
                 wrapper.style.opacity = '0';
                 setTimeout(() => {
                     wrapper.remove();
                     if(document.querySelectorAll('.saved-item-wrapper').length === 0) renderSavedPage();
                 }, 300);
             }
        }
    } else {
        savePost(url);
        updateSaveIcon(btnElement, true);
        if(typeof showToast === 'function') showToast('تم الحفظ');
    }
};

function updateSaveIcon(btn, saved) {
    var svg = btn.querySelector('svg');
    if(svg) {
        svg.style.fill = saved ? '#6db200' : 'none';
        svg.style.stroke = saved ? '#6db200' : 'currentColor';
    }
    if(saved) btn.classList.add('saved');
    else btn.classList.remove('saved');
}
