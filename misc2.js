/* ============================================================
   S24News — متفرقات صغيرة (خمس كتل مستقلة)
   قائمة الروابط · سنة الحقوق · صندوق الكوكيز
   صنف صفحة الموسوعة · زر العودة للبث
   ============================================================ */

/* ============ 1) طيّ قائمة الروابط ============ */
      function toggleLinkList3(btn) {
        var content = document.getElementById('linklist3-content');
        if (content.style.display === 'block') {
          content.style.display = 'none';
          btn.classList.remove('active');
        } else {
          content.style.display = 'block';
          btn.classList.add('active');
        }
      }

/* ============ 2) تحديث سنة الحقوق ============ */
  // كود تحديث السنة تلقائياً في الحقوق
  document.addEventListener("DOMContentLoaded", function() {
      var yearSpan = document.getElementById('currentYear');
      if (yearSpan) {
          yearSpan.textContent = new Date().getFullYear();
      }
  });

/* ============ 3) صندوق الكوكيز ============ */
document.addEventListener("DOMContentLoaded", function() {
    const cookieBox = document.getElementById('s24n-cookie-box');
    const acceptBtn = document.getElementById('s24n-accept-btn');
    const STORAGE_KEY = 's24n_cookie_consent_vars'; // مفتاح جديد

    if (!localStorage.getItem(STORAGE_KEY)) {
        cookieBox.style.display = 'block';
        setTimeout(() => {
            cookieBox.classList.add('show');
        }, 1000);
    }

    if(acceptBtn) {
        acceptBtn.addEventListener('click', function() {
            localStorage.setItem(STORAGE_KEY, 'true');
            cookieBox.classList.remove('show');
            setTimeout(() => {
                cookieBox.style.display = 'none';
            }, 400);
        });
    }
});

/* ============ 4) صنف صفحة الموسوعة ============ */
document.addEventListener("DOMContentLoaded", function() {
    if (window.location.pathname.indexOf('glossary') > -1) {
        document.body.classList.add('glossary-index-page');
    }
});

/* ============ 5) زر العودة للبث المباشر ============ */
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === "updates") {
        const container = document.getElementById("live-return-container");
        const returnUrl = "/p/lbs24n.html";

        if (container) {
            container.innerHTML = `
                <a class='live-return-pill' href='${returnUrl}' id='stickyLiveBtn'>
                    <div class='live-indicator-dot'></div>
                    <span>العودة للبث المباشر</span>
                    <svg fill='none' height='18' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='18'>
                        <path d='M19 12H5M12 19l-7-7 7-7'/>
                    </svg>
                </a>`;

            setTimeout(() => {
                const btn = document.getElementById("stickyLiveBtn");
                if(btn) btn.classList.add("visible");
            }, 800);
        }
    }
});
