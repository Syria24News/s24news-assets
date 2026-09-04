/* ============================================================
   S24News — فوتر البطاقات (مشاركة/حفظ/نسخ) وعدّاد المشاهدات
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

// ============================================================
// 1. إعدادات قاعدة بيانات Firebase
// ============================================================
const firebaseConfig = window.S24_FIREBASE_CONFIG;

// تهيئة التطبيق (Singleton Pattern)
let app = null;
try {
    if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
        app = firebase.initializeApp(firebaseConfig);
    } else if (typeof firebase !== 'undefined') {
        app = firebase.app();
    }
} catch (e) { console.error("Firebase Init Error", e); }

// ============================================================
// 2. الدوال الأساسية (المشاركة، النسخ، الحفظ)
// ============================================================

// أ. دالة النسخ الشاملة
window.performCopy = function(text) {
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('تم نسخ الرابط بنجاح');
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
};

function fallbackCopy(text) {
    try {
        var textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        var successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) showToast('تم نسخ الرابط');
        else showToast('فشل النسخ');
    } catch (err) {
        console.error('Copy failed', err);
        showToast('فشل النسخ');
    }
}


// ============================================================
// 3. دالة توليد الفوتر (بناء HTML فقط)
// ============================================================
function generateCustomFooters() {
    var allPosts = document.querySelectorAll('.post-outer');
    
    allPosts.forEach(function(post) {
        if (post.querySelector('.rt-footer')) return;
        if (document.body.classList.contains('s24-glossary-article')) return;

        var postBody = post.querySelector('.post-body');
        if (!postBody) return;

        var titleLink = post.querySelector('h1.post-title a, h3.post-title a');
        var postUrl = titleLink ? titleLink.href : window.location.href;
        var postTitle = titleLink ? titleLink.innerText : document.title;
        
        var cleanUrl = postUrl.split('?')[0];
        var encUrl = encodeURIComponent(cleanUrl);
        var encTitle = encodeURIComponent(postTitle);
        
        var isSingleArticle = document.body.classList.contains('item-page');

        var footer = document.createElement('div');
        footer.className = 'rt-footer';
        var html = '<div class="rt-footer-right">';

        // 1. أيقونة المشاهدات
        if (isSingleArticle) {
            html += '<div class="rt-icon-group" title="مشاهدات" style="cursor:default">';
            html += '<span id="real_page_view" style="margin-left:6px; font-weight:900">...</span>';
            html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            html += '</div>';
            setTimeout(initFirebaseCounter, 1000); 
        }

        // 2. زر الحفظ (تم إصلاح شكل الأيقونة هنا)
        var isSaved = (typeof isPostSaved === 'function' && isPostSaved(cleanUrl));
        var fill = isSaved ? '#6db200' : 'none';
        var stroke = isSaved ? '#6db200' : 'currentColor';
        var savedCls = isSaved ? 'saved' : '';
        
        html += `<div class="rt-icon-group save-btn ${savedCls}" data-btn="save" data-url="${cleanUrl}">`;
        // تمت إضافة stroke-linecap و stroke-linejoin لتنعيم الحواف
        html += `<svg width="20" height="20" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
        html += '</div>';

        // 3. زر المشاركة
        html += '<div class="share-btn-wrapper">';
        html += `<div class="rt-icon-group share-trigger" data-btn="share-toggle">`;
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>';
        html += '</div>';
        
        // القائمة المصغرة
        html += '<div class="mini-share-menu">';
        html += `<a href="https://www.facebook.com/sharer/sharer.php?u=${encUrl}" target="_blank" class="share-icon-link si-fb"><svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></a>`;
        html += `<a href="https://twitter.com/intent/tweet?url=${encUrl}&text=${encTitle}" target="_blank" class="share-icon-link si-x"><svg viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg></a>`;
        html += `<a href="https://api.whatsapp.com/send?text=${encTitle}%20${encUrl}" target="_blank" class="share-icon-link si-wa"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></a>`;
        html += `<a href="https://t.me/share/url?url=${encUrl}&text=${encTitle}" target="_blank" class="share-icon-link si-tg"><svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></a>`;
        html += `<a href="https://www.linkedin.com/shareArticle?mini=true&url=${encUrl}&title=${encTitle}" target="_blank" class="share-icon-link si-li"><svg viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg></a>`;
        html += `<a href="https://vk.com/share.php?url=${encUrl}&title=${encTitle}" target="_blank" class="share-icon-link si-vk"><svg viewBox="0 0 24 24"><path d="M21.547 7.351c.211-.69.014-1.201-.988-1.201h-2.646c-.83 0-1.229.439-1.439.923 0 0-1.348 3.284-3.255 5.405-.623.623-.906.818-1.322.818-.208 0-.518-.195-.518-.952V7.351c0-.829-.239-1.201-.939-1.201h-3.413c-.516 0-.826.382-.826.745 0 .779 1.168.96 1.287 3.167v4.774c0 1.054-.19 1.246-.605 1.246-1.121 0-3.844-3.32-5.46-7.13-.314-.881-.628-1.241-1.464-1.241H.313c-.934 0-1.12.439-1.12.923 0 .868 1.116 5.215 5.201 10.84 2.721 3.901 6.549 6.002 10.024 6.002 2.083 0 2.339-.467 2.339-1.272v-2.946c0-.94.198-1.13.846-1.13.477 0 1.306.241 3.228 2.083 2.195 2.195 2.564 3.194 3.811 3.194h2.646c.934 0 1.402-.467 1.139-1.393-.298-1.042-1.378-2.348-2.809-3.904-.757-.818-1.89-1.713-2.244-2.18-.477-.623-.336-.896 0-1.442 0 0 3.953-5.586 4.359-7.518z"/></svg></a>`;

        html += '</div></div>';

        // 4. زر النسخ
        html += `<div class="rt-icon-group copy-btn" title="نسخ" data-btn="copy" data-url="${cleanUrl}">`;
        html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
        html += '</div>';

        html += '</div><div class="rt-footer-left"></div>';
        
        footer.innerHTML = html;
        postBody.parentNode.insertBefore(footer, postBody.nextSibling);
    });
}

// ============================================================
// 4. نظام الاستماع للأحداث (Event Delegation)
// ============================================================
document.addEventListener('click', function(e) {
    // إغلاق القوائم المفتوحة عند النقر خارجها
    if (!e.target.closest('.share-btn-wrapper')) {
        document.querySelectorAll('.mini-share-menu.active').forEach(m => m.classList.remove('active'));
    }

    // البحث عن أقرب عنصر يحمل data-btn
    var target = e.target.closest('[data-btn]');
    if (!target) return;

    var type = target.getAttribute('data-btn');
    var url = target.getAttribute('data-url');

    if (type === 'save') {
        e.preventDefault();
        window.performSave(target, url);
    } 
    else if (type === 'copy') {
        e.preventDefault();
        window.performCopy(url);
    }
    else if (type === 'share-toggle') {
        e.preventDefault();
        var menu = target.nextElementSibling;
        if (menu) menu.classList.toggle('active');
    }
});

// ============================================================
// 5. نظام Firebase
// ============================================================
function initFirebaseCounter() {
    try {
        if (typeof firebase === 'undefined') return;
        
        if (!firebase.apps.length) {
            firebase.initializeApp(window.S24_FIREBASE_CONFIG);
        }
        
        var cleanPath = window.location.pathname.replace(/\./g, '_').replace(/\//g, '-');
        var dbRef = firebase.database().ref('views/' + cleanPath);
        
        dbRef.transaction(function(curr) { return (curr || 0) + 1; })
             .then(function(res) { 
                 if(!res.committed) dbRef.once('value').then(s => updateViewUI(s.val()));
             });
             
        dbRef.on('value', function(s) { updateViewUI(s.val()); });
        
    } catch(err) { 
        console.warn('Firebase Error', err); 
    }
}

function updateViewUI(val) {
    var el = document.getElementById('real_page_view');
    if(el) el.innerText = val || 0;
}

// التشغيل عند التحميل
document.addEventListener("DOMContentLoaded", generateCustomFooters);
