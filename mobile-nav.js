/* ============================================================
   S24News — الشريط الجانبي للموبايل + بحث الهيدر
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

document.addEventListener("DOMContentLoaded", function() {
    
    // 1. نقل محتويات القائمة اليسرى للموبايل (بدون نسخ أيقونات)
    function moveSidebarForMobile() {
        const leftSidebar = document.getElementById('force-left-sidebar'); 
        const rightSidebar = document.getElementById('main-right-sidebar'); 

        if (window.innerWidth <= 1023) {
            if (leftSidebar && rightSidebar && !leftSidebar.classList.contains('moved-to-mobile')) {
                const mobileContainer = document.createElement('div');
                mobileContainer.className = 'mobile-moved-sidebar';
                mobileContainer.id = 'mobile-left-content';
                
                // نقل كل شيء بما في ذلك أداة التواصل الجديدة
                while (leftSidebar.childNodes.length > 0) {
                    mobileContainer.appendChild(leftSidebar.childNodes[0]);
                }
                rightSidebar.appendChild(mobileContainer);
                leftSidebar.classList.add('moved-to-mobile');
            }
        } else {
            // إعادة العناصر لمكانها في الكمبيوتر
            const mobileContainer = document.getElementById('mobile-left-content');
            if (leftSidebar && mobileContainer) {
                while (mobileContainer.childNodes.length > 0) {
                    leftSidebar.appendChild(mobileContainer.childNodes[0]);
                }
                mobileContainer.remove();
                leftSidebar.classList.remove('moved-to-mobile');
            }
        }
    }

    moveSidebarForMobile();
    window.addEventListener('resize', moveSidebarForMobile);

    // 2. تحويل نصوص القائمة الجديدة إلى أيقونات
    const socialIconsMap = {
        'فيسبوك': '<svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
        'تويتر': '<svg viewBox="0 0 24 24"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>',
        'واتساب': '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
        'تيليجرام': '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
        'انستغرام': '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>',
        'يوتيوب': '<svg viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>'
    };

    // تطبيق الأيقونات على القائمة الجديدة فقط
    const mobileLinks = document.querySelectorAll('.mobile-social-custom a');
    mobileLinks.forEach(link => {
        const textSpan = link.querySelector('.social-text-hidden');
        if (textSpan) {
            const name = textSpan.textContent.trim();
            if (socialIconsMap[name]) {
                link.innerHTML = socialIconsMap[name]; // استبدال النص بالأيقونة
            }
        }
    });

    // 3. تفعيل الأزرار (القائمة + البحث)
    var sidebarBtn = document.getElementById('sidebar-toggle-btn');
    if(sidebarBtn) {
        sidebarBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            document.body.classList.toggle('sidebar-toggled');
        });
    }
    
   document.addEventListener('click', function(e) {
        if (window.innerWidth <= 1200 && document.body.classList.contains('sidebar-toggled')) {
            var sidebar = document.querySelector('.main-layout__column');
            if (sidebar && !sidebar.contains(e.target) && !sidebarBtn.contains(e.target)) {
                document.body.classList.remove('sidebar-toggled');
            }
        }
    });

    const searchBtn = document.getElementById('mobile-search-btn');
    const overlay = document.getElementById('mobile-search-overlay');
    const searchInput = overlay ? overlay.querySelector('.search-form__input') : null; // 🛡️ تحصين: تفادي خطأ Uncaught TypeError لو غاب العنصر مستقبلاً

    if (searchBtn && overlay) {
        // 1. فتح وإغلاق الشريط عند النقر على العدسة العلوية
        searchBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // منع إغلاق الشريط فوراً
            overlay.classList.toggle('main-header__block--search-active');
            
            // 2. التركيز تلقائياً على حقل الكتابة ليظهر الكيبورد
            if (overlay.classList.contains('main-header__block--search-active') && searchInput) {
                setTimeout(() => searchInput.focus(), 100);
            }
        });

        // 3. إغلاق الشريط عند النقر في أي مكان فارغ بالشاشة
        document.addEventListener('click', function(e) {
            if (overlay.classList.contains('main-header__block--search-active') && 
                !overlay.contains(e.target) && 
                !searchBtn.contains(e.target)) {
                overlay.classList.remove('main-header__block--search-active');
            }
        });
        
        // 4. منع انغلاق الشريط إذا قام المستخدم بالنقر بداخله
        overlay.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        // 5. (الكود الجديد 🌟) إغلاق الشريط عند الضغط على زر Escape في لوحة المفاتيح
        document.addEventListener('keydown', function(e) {
            if (e.key === "Escape" && overlay.classList.contains('main-header__block--search-active')) {
                overlay.classList.remove('main-header__block--search-active');
            }
        });
    }
});
