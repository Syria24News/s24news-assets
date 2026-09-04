/* ============================================================
   S24News — واجهة عامة: التاريخ/الوقت، الوضع الليلي،
   وضع الصيانة، أيقونات القائمة الجانبية
   (أربع كتل متلاصقة دُمجت في ملف واحد بترتيبها الأصلي)
   ============================================================ */

/* ===================== شريط التاريخ والوقت ===================== */
// ==========================================
// 1. DATE BAR (التاريخ والوقت - بتوقيت دمشق)
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    function toEnglishDigits(str) { 
        return str.replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]); 
    }

    function updateDateTime() {
        const now = new Date();
        
        // ضبط التوقيت حصراً على دمشق
        const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', calendar: 'gregory', timeZone: 'Asia/Damascus' };
        const timeOptions = { hour: 'numeric', minute: 'numeric', hour12: true, timeZone: 'Asia/Damascus' };
        
        const dateString = new Intl.DateTimeFormat('ar-EG', dateOptions).format(now);
        const timeString = new Intl.DateTimeFormat('ar-SA', timeOptions).format(now);
        
        // تحويل الأرقام إلى الإنجليزية لضمان تناسق الخط
        const cleanDate = toEnglishDigits(dateString);
        const cleanTime = toEnglishDigits(timeString);
        
        const dateElement = document.getElementById('hijri-gregorian-date');
        if (dateElement) {
            // دمج الوقت مع التصميم الأنيق لكلمة (بتوقيت دمشق)
            dateElement.innerHTML = `${cleanDate} | ${cleanTime} <span style="font-size: 11px; opacity: 0.7; margin-right: 6px; font-weight: normal;">بتوقيت دمشق</span>`;
        }
    }
    
    updateDateTime();
    // تحديث الوقت كل دقيقة (60000 مللي ثانية) لتسريع الموقع
    setInterval(updateDateTime, 60000);
});

/* ===================== الوضع الليلي ===================== */
// ==========================================
// 1. Dark Mode (الوضع الليلي)
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    const toggleBtn = document.getElementById('themeToggle');
    const htmlElement = document.documentElement;

    function toggleTheme() {
        const isDark = htmlElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        htmlElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        // 🌙 إعادة رسم تضمينات تويتر/X المعروضة حالياً لتطابق الثيم الجديد فوراً
        if (window.S24N_refreshTwitterTheme) {
            window.S24N_refreshTwitterTheme();
        }
        // 🟢 إصلاح: نفس الشيء لتضمينات فيسبوك عبر معامل colorscheme
        if (window.S24N_refreshFacebookTheme) {
            window.S24N_refreshFacebookTheme();
        }
    }

    if(toggleBtn) {
        toggleBtn.addEventListener('click', toggleTheme);
        // ⌨️ وصولية: العنصر <div role="button"> وليس <button> حقيقي، فلازم نفعّله يدويًا بالكيبورد (Enter / Space)
        toggleBtn.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                toggleTheme();
            }
        });
    }
});

/* ===================== وضع الصيانة ===================== */
// ==========================================
// 2. Maintenance Mode V2 (وضع الصيانة)
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    var urlParams = new URLSearchParams(window.location.search);
    var isAdmin = urlParams.get('MySecretPass77') === '1';
    var configDiv = document.getElementById('maintenance-config');

    if (!isAdmin && configDiv) {
        var status = configDiv.getAttribute('data-status');
        var dateStr = configDiv.getAttribute('data-date');
        var timeStr = configDiv.getAttribute('data-time') || '00:00:00';
        var customTitle = configDiv.getAttribute('data-title');
        var customDesc = configDiv.getAttribute('data-desc');

        if (status === 'on' && dateStr) {
            var dateTimeStr = dateStr + 'T' + timeStr;
            var targetDate = new Date(dateTimeStr).getTime();
            var now = new Date().getTime();

            if (targetDate > now) {
                var overlay = document.getElementById('maintenance-overlay');
                var titleEl = document.querySelector('.m-title');
                var descEl = document.getElementById('m-desc-text');
                
                if (customTitle && titleEl) titleEl.textContent = customTitle;
                if (customDesc && descEl) descEl.textContent = customDesc;
                
                if (overlay) {
                    overlay.style.display = 'flex';
                    document.body.classList.add('maintenance-active');
                }

                var timerInterval = setInterval(function() {
                    var cTime = new Date().getTime();
                    var d = targetDate - cTime;

                    if (d < 0) { 
                        clearInterval(timerInterval);
                        if (overlay) overlay.style.display = 'none'; 
                        document.body.classList.remove('maintenance-active'); 
                        return; 
                    }

                    var days = Math.floor(d / (1000 * 60 * 60 * 24));
                    var hours = Math.floor((d % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    var minutes = Math.floor((d % (1000 * 60 * 60)) / (1000 * 60));
                    var seconds = Math.floor((d % (1000 * 60)) / 1000);

                    if(document.getElementById('m-days')) document.getElementById('m-days').textContent = days;
                    if(document.getElementById('m-hours')) document.getElementById('m-hours').textContent = hours;
                    if(document.getElementById('m-minutes')) document.getElementById('m-minutes').textContent = minutes;
                    if(document.getElementById('m-seconds')) document.getElementById('m-seconds').textContent = seconds;
                }, 1000);
            }
        }
    }
});

/* ===================== أيقونات القائمة الجانبية ===================== */
// ==========================================
// 3. Sidebar Icons (أيقونات وألوان القائمة الجانبية)
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    var sidebarTop = document.getElementById('Right_Sidebar_Top');
    if (sidebarTop) {
        var links = sidebarTop.querySelectorAll('a');
        var icons = [
                        '<svg viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>',
            '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
            '<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>',
            '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
            '<svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>'

        ];
        links.forEach(function(link, index) {
            if (icons[index]) {
                var iconSpan = document.createElement('span');
                iconSpan.className = 'sy-sidebar-icon';
                iconSpan.innerHTML = icons[index];
                link.insertBefore(iconSpan, link.firstChild);
            }
        });
    }

    var sidebarBottom = document.getElementById('Right_Sidebar_Bottom');
    if (sidebarBottom) {
        var linksB = sidebarBottom.querySelectorAll('a');
        
        // مصفوفة الألوان
        var colors = [
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 100'%3E%3Ctext x='50%25' y='70%25' font-size='70' fill='red' text-anchor='middle'%3E★★★%3C/text%3E%3C/svg%3E\") center / contain no-repeat, linear-gradient(to bottom, var(--color-JadeGreen) 33%, var( --color-white) 33%, #FFFFFF 66%, var(--color-black) 66%)", 
            'var(--sy-ArabNews)', 
            'var(--sy-INT)', 
            'var(--sy-Econ)', 
            'var(--sy-sport)', 
            'var(--sy-purple)', 
            'var(--sy-Reports)', 
            'var(--sy-docs)', 
            'var(--sy-video)', 
            '#1b6b66',
            '#34495e'
        ];

        linksB.forEach(function(link, index) {
            if (colors[index]) {
                var colorSpan = document.createElement('span');
                colorSpan.className = 'sy-color-box';
                
                colorSpan.style.background = colors[index];
                
                if(index === 0 || index === 1) {
                    colorSpan.style.border = "1px solid #ddd";
                }
                
                link.insertBefore(colorSpan, link.firstChild);
                
                var arrow = document.createElement('span');
                arrow.innerHTML = '&#9662;'; 
                arrow.style.marginRight = 'auto'; 
                arrow.style.fontSize = '0px';
                
                link.appendChild(arrow);
            }
        });
    }
});
