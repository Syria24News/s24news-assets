/* ============================================================
   S24News — صفحة الأكثر قراءة (most-read)
   يُحمَّل داخل <b:if> لصفحات most-read / saved-news / live فقط
   ============================================================ */

document.addEventListener("DOMContentLoaded", function() {
    // 1. إضافة كلاس للصفحة لتمييزها وتطبيق الـ CSS
    document.body.classList.add('most-read-page');
    
    const container = document.getElementById('most-read-renderer');
    
    // 2. البحث عن أداة المشاركات الشائعة (مصدر البيانات)
    let popWidget = document.getElementById('PopularPosts1');
    if (!popWidget) popWidget = document.getElementById('PopularPosts2');

    if (popWidget && container) {
        
        // 🟢 [التغيير هنا]: عرض الهيكل العظمي فوراً قبل البدء بالمعالجة
        container.innerHTML = getSkeletonHTML('list');

        // 3. استخراج العناصر من الأداة المخفية
        const items = popWidget.querySelectorAll('.item-content, li, .widget-content .post');
        
        // نستخدم setTimeout بسيط جداً (اختياري) لضمان ظهور التأثير ولو للحظة لجمالية العرض
        // أو يمكنك إزالة setTimeout وتشغيل الكود مباشرة
        setTimeout(() => {
            if (items.length > 0) {
                let html = '';
                // عرض أول 10 مقالات فقط
                const maxItems = Math.min(items.length, 10);

                for (let i = 0; i < maxItems; i++) {
                    const item = items[i];
                    
                    // استخراج الصورة وتحسين جودتها
                    let imgEl = item.querySelector('img');
                    let img = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e0e0e0'/%3E%3C/svg%3E";
                    if (imgEl) {
                        // استبدال كود الحجم الصغير (s72) بكود حجم كبير (w720-h405)
                        img = imgEl.src.replace(/\/s[0-9]+.*?\//, '/w720-h405-c/').replace(/\/w[0-9]+.*?\//, '/w720-h405-c/');
                    }

                    // استخراج العنوان والرابط
                    let linkEl = item.querySelector('a');
                    if (!linkEl || !linkEl.innerText.trim()) {
                          const allLinks = item.querySelectorAll('a');
                          for(let a of allLinks) {
                              if(a.innerText.trim().length > 0) { linkEl = a; break; }
                          }
                          if(!linkEl && allLinks.length > 0) linkEl = allLinks[0];
                    }

                    let title = linkEl ? linkEl.innerText.trim() : "بدون عنوان";
                    let link = linkEl ? linkEl.href : "#";
                    
                    // استخراج المقتطف (إن وجد)
                    let snippetEl = item.querySelector('.item-snippet, .post-summary');
                    let snippet = snippetEl ? snippetEl.innerText : "";

                    // 4. بناء هيكل HTML الجديد لكل مقال
                    html += `
                    <div class="post-outer">
                        <div class="post hentry">
                            <h3 class="post-title entry-title added-title">
                                <a href="${link}">${title}</a>
                            </h3>
                            <div class="post-header"><div class="post-header-line-1"></div></div>
                            
                            <div class="post-body entry-content">
                                <div class="separator" style="clear: both; text-align: center; margin-bottom: 15px;">
                                    <a href="${link}">
                                        <img src="${img}" alt="${title}" loading="${i === 0 ? 'eager' : 'lazy'}">
                                    </a>
                                </div>
                                ${snippet ? '<div class="post-snippet" style="margin-top:10px;">' + snippet + '</div>' : ''}
                            </div>
                        </div>
                    </div>`;
                }
                // ضخ الكود النهائي في الحاوية (سيستبدل الهيكل العظمي بالمحتوى الحقيقي)
                container.innerHTML = html;
                
                // استدعاء دالة الفوتر (الأيقونات) لتظهر على المقالات الجديدة
                if(typeof generateCustomFooters === 'function') {
                    generateCustomFooters();
                }

            } else {
                container.innerHTML = '<div style="padding:50px; text-align:center;">لم يتم العثور على مقالات شائعة.</div>';
            }
        }, 100); // تأخير بسيط جداً (0.1 ثانية) للسلاسة
    } else {
        container.innerHTML = '<div style="padding:50px; text-align:center; color:var(--color-red);">تنبيه: أداة المشاركات الشائعة غير موجودة.</div>';
    }
});
