/* ============================================================
   S24News — أدوات مشتركة (تُحمَّل قبل كل الملفات الأخرى)
   S24Cache · showToast · getSkeletonHTML · s24MarkListThumbnail
   ⚠️ سطر استدعاء هذا الملف يجب أن يبقى الأول في القالب
   ============================================================ */

/* ===================== 1) الكاش المشترك ===================== */
  window.S24Cache = {
    get: function(key, ttlMs) {
      try {
        var record = JSON.parse(localStorage.getItem(key));
        if (!record) return null;
        if ((Date.now() - record.ts) >= ttlMs) { localStorage.removeItem(key); return null; }
        return record.data;
      } catch(e) { return null; }
    },
    set: function(key, data) {
      try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data })); } catch(e) {}
    }
  };

/* ===================== 2) الإشعار المؤقت ===================== */
// دالة عرض الإشعار المؤقت
function showToast(message) {
    // 1. البحث عن عنصر الإشعار، وإذا لم يوجد نقوم بإنشائه
    var toast = document.getElementById("rt-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "rt-toast";
        document.body.appendChild(toast);
    }

    // 2. وضع الرسالة وإظهار الإشعار
    toast.textContent = message;
    toast.className = "show";

    // 3. إخفاء الإشعار بعد 3 ثوانٍ (3000 ملي ثانية)
    setTimeout(function(){ 
        toast.className = toast.className.replace("show", ""); 
    }, 3000);
}

/* ===================== 3) الهيكل العظمي ===================== */
// دالة لتوليد كود الهيكل العظمي حسب النوع
function getSkeletonHTML(type) {
    let html = '';
    // 1. النوع: شبكة (للقسم المميز في الرئيسية)
    if (type === 'grid') {
        html += '<div class="sy-sk-grid-wrapper">';
        html += '  <div class="sy-skeleton sy-sk-image sy-sk-main-img"></div>'; // صورة كبيرة
        html += '  <div class="sy-skeleton sy-sk-title" style="width:60%"></div>'; // عنوان
        html += '  <div class="sy-sk-sub-grid">';
        html += '    <div class="sy-skeleton sy-sk-sub-item"></div>'; // مربع صغير يمين
        html += '    <div class="sy-skeleton sy-sk-sub-item"></div>'; // مربع صغير يسار
        html += '  </div>';
        html += '</div>';
    }
    // 2. النوع: قائمة (للأكثر قراءة + المحفوظات + نتائج البحث)
    else if (type === 'list') {
        // نكرر العنصر 3 مرات ليوحي بالامتلاء
        for(let i=0; i<3; i++) {
            html += '<div class="rt-sk-list-item">';
            html += '  <div class="rt-skeleton rt-sk-image" style="height:180px;"></div>';
            html += '  <div class="rt-skeleton rt-sk-title"></div>';
            html += '  <div class="rt-skeleton rt-sk-line"></div>';
            html += '</div>';
        }
    }
    // 3. النوع: بسيط (للأقسام الجانبية أو القصص)
    else if (type === 'simple') {
        html += '<div class="rt-skeleton rt-sk-title" style="width:100%; height:40px; margin-bottom:10px;"></div>';
        html += '<div class="rt-skeleton rt-sk-title" style="width:100%; height:40px; margin-bottom:10px;"></div>';
        html += '<div class="rt-skeleton rt-sk-title" style="width:100%; height:40px;"></div>';
    }

    return html;
}

/* =============== 4) تحديد صورة القائمة الأولى =============== */
// 🆕 يحدد أول صورة حقيقية فعلية (وليس أول عنصر separator فقط، فقد يكون فارغاً)
// داخل .post-body في صفحات القوائم فقط، ويمنحها كلاساً ثابتاً
function s24MarkListThumbnail() {
    if (document.body.classList.contains('item-page')) return;
    document.querySelectorAll('.post-body').forEach(function(postBody) {
        var children = Array.from(postBody.children);
        if (children.length === 1 && children[0].tagName === 'DIV' && children[0].getAttribute('dir') === 'rtl') {
            children = Array.from(children[0].children);
        }
        for (var i = 0; i < children.length; i++) {
            var el = children[i];
            var img = el.tagName === 'IMG' ? el : el.querySelector('img');
            var textLen = (el.textContent || '').trim().length;
            if (img) {
                var target = (el.classList && el.classList.contains('separator')) ? el : (img.closest('.separator') || el);
                target.classList.add('s24-list-thumb');
                break;
            }
            if (textLen > 0) break; // نص حقيقي بلا صورة قبل أي صورة = لا صورة غلاف لهذا المنشور
            // عنصر فارغ تماماً (فقرة فارغة، أو separator بلا صورة): تجاهله واستمر بالبحث
        }
    });
}
document.addEventListener('DOMContentLoaded', s24MarkListThumbnail);
