/* ============================================================
   S24News — نظام الاستطلاع والتصويت (Poll)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   v2.0 (9 أكتوبر 2026): القراءة من Firestore + التصويت عبر S24 Polls Gateway
   ============================================================ */

(function() {
    // ⚙️ الإعدادات العامة
    // البوابة القديمة: تُستخدم للقراءة فقط عند تعذّر الوصول إلى Firestore (مدة المراقبة)
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw0gcfY_hhjNpEWFTuY_MBXNNO59k_XZoU7kevKj6_PaBPDO0x2B3K6v6TK0CewvGExNQ/exec";
    // 🆕 البوابة الجديدة: كل الأصوات تذهب إليها
    const GATEWAY_URL = "https://script.google.com/macros/s/AKfycbx6S27AM5zuftOmha8Zf-QixGfCiUGUbaapLY7qklwXcxDXLInbXDTn4UqdzYs5tT4/exec";
    // 🆕 مستند العرض العام في Firestore (قراءة واحدة لكل زيارة)
    const PUBLIC_DOC_URL = "https://firestore.googleapis.com/v1/projects/s24n-views/databases/(default)/documents/polls_public/active";
    // 🆕 مفتاح موقع reCAPTCHA v3 (عام وليس سرياً). فارغ = التحقق معطّل ويبقى مربع الكابتشا القديم
    const RECAPTCHA_SITE_KEY = "6LdBaIAtAAAAAJSkw_tfRgJWp2Rm9kfVcaDBj8Q-";
    // 🆕 كاش القراءة في الجلسة (دقيقتان) لتقليل القراءات عند التنقل بين الصفحات
    const CACHE_KEY = 's24_polls_public_v1';
    const CACHE_TTL = 2 * 60 * 1000;
    const FETCH_TIMEOUT = 15000;  
    const SUBMIT_TIMEOUT = 15000; 
    const DEBUG = false;
    const MAX_RETRIES = 3;  
    
    let allQuestions = [];
    let currentQIndex = 0;
    let isCaptchaDone = false;
    let isSubmitting = false;
    let isLoadingPolls = false;  // ✅ منع طلبات متزامنة

    // 🛡️ توليد معرف فريد للمصوت (محسّن)
    function getVoterId() {
        try {
            let vid = localStorage.getItem('sy_voter_id');
            if (!vid) {
                vid = 'voter_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
                localStorage.setItem('sy_voter_id', vid);
            }
            return vid;
        } catch(e) {
            // ✅ في حالة private browsing أو أي مشكلة
            return 'voter_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        }
    }
    const voterId = getVoterId();

    function log(msg, data = null) {
        if(DEBUG) console.log(`[SY-Poll] ${msg}`, data || '');
    }

    // ✅ التحقق من صحة البيانات
    function validatePollData(data) {
        if (!Array.isArray(data)) return false;
        
        return data.every(item => {
            // تحقق من الحقول الأساسية
            if (!item.pollId || !item.q || !item.opt1) return false;
            
            // تحقق من أن عدادات الأصوات رقمية
            for (let i = 1; i <= 6; i++) {
                const countKey = `opt${i}Count`;
                if (item[countKey] !== undefined && typeof item[countKey] !== 'number') {
                    return false;
                }
            }
            
            return true;
        });
    }

    // 🆕 تحويل قيمة Firestore REST إلى قيمة JavaScript عادية
    function fsv(v) {
        if (!v) return null;
        if ('stringValue' in v) return v.stringValue;
        if ('integerValue' in v) return Number(v.integerValue);
        if ('doubleValue' in v) return v.doubleValue;
        if ('booleanValue' in v) return v.booleanValue;
        if ('mapValue' in v) {
            const o = {}, f = v.mapValue.fields || {};
            Object.keys(f).forEach(k => { o[k] = fsv(f[k]); });
            return o;
        }
        return null;
    }

    // 🆕 قراءة البولات النشطة من Firestore (مستند واحد) مع كاش الجلسة
    async function getFromFirestore() {
        try {
            const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
            if (c && (Date.now() - c.t) < CACHE_TTL && Array.isArray(c.d)) return c.d;
        } catch (e) {}

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        try {
            const res = await fetch(PUBLIC_DOC_URL, { signal: controller.signal });
            if (res.status === 404) return [];           // لا يوجد مستند بعد = لا استطلاعات
            if (!res.ok) throw new Error(`Firestore HTTP ${res.status}`);
            const doc = await res.json();
            const polls = fsv((doc.fields || {}).polls) || {};
            const list = Object.keys(polls).map(k => polls[k])
                .filter(x => x && x.pollId && x.q && x.opt1)
                .sort((a, b) => ((Number(b.order) || 0) - (Number(a.order) || 0)) ||
                                ((Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)));
            try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: list })); } catch (e) {}
            return list;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // 🆕 المصدر الأول Firestore؛ والبوابة القديمة فقط عند فشل الاتصال (لا عند غياب الاستطلاعات)
    async function getPolls() {
        try {
            const list = await getFromFirestore();
            log("Firestore: " + list.length + " استطلاع");
            return list;
        } catch (err) {
            console.error("Poll Firestore Error, fallback to legacy:", err);
            return getPollData();
        }
    }

    // 🆕 تحميل reCAPTCHA عند أول تفاعل مع الاستطلاع فقط (لا يُحمَّل في كل صفحة)
    let recaptchaPromise = null;
    function loadRecaptcha() {
        if (!RECAPTCHA_SITE_KEY) return Promise.resolve(false);
        if (recaptchaPromise) return recaptchaPromise;
        recaptchaPromise = new Promise(resolve => {
            const s = document.createElement('script');
            s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(RECAPTCHA_SITE_KEY);
            s.async = true;
            s.onload = () => window.grecaptcha.ready(() => resolve(true));
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });
        return recaptchaPromise;
    }

    // 🆕 رمز reCAPTCHA لعملية التصويت (نص فارغ إن كان معطّلاً أو فشل التحميل)
    function getRecaptchaToken() {
        return loadRecaptcha().then(ok => {
            if (!ok || !window.grecaptcha) return '';
            return window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'vote' }).catch(() => '');
        });
    }

    // 🆕 حماية النص قبل إدراجه في HTML
    function escapeHTML(t) {
        return String(t == null ? '' : t)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // 🔄 جلب البيانات مع GET (بدل POST لتجنب CORS)
    const getPollData = async (attempt = 0) => {
        try {
            // ✅ منع طلبات متزامنة
            if (isLoadingPolls) return null;
            isLoadingPolls = true;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
            
            log(`جلب البيانات (المحاولة ${attempt + 1}/${MAX_RETRIES + 1})`);
            
            // ✅ استخدم GET بدل POST (تجنب CORS)
            const res = await fetch(SCRIPT_URL + "?action=getAll", { 
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
            
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            
            // ✅ تحقق من صحة البيانات
            if (!validatePollData(data)) {
                throw new Error("Invalid poll data structure");
            }
            
            log("البيانات جُلبت بنجاح", data.length + " استطلاع");
            return data;
        } catch (err) {
            console.error("Poll Fetch Error (attempt " + (attempt + 1) + "):", err);
            
            if (attempt < MAX_RETRIES) {
                const delay = 1000 * (attempt + 1); 
                log(`إعادة محاولة بعد ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));
                return getPollData(attempt + 1);
            }
            
            return null;
        } finally {
            isLoadingPolls = false;  // ✅ امسح الـ flag
        }
    };

    // 🚀 تشغيل النظام عند اكتمال تحميل الصفحة
    document.addEventListener("DOMContentLoaded", function() {
        getPolls().then(data => {
            const loadingEl = document.getElementById('poll-loading');      
            const contentArea = document.getElementById('poll-content-area'); 
            
            if (data && data.length > 0) {
                allQuestions = data;
                renderPoll(0); 
                createPagination();
                setupEventListeners();
                
                if(loadingEl) loadingEl.style.display = 'none'; 
                if(contentArea) {
                    contentArea.style.display = 'block'; 
                    requestAnimationFrame(() => { contentArea.style.opacity = '1'; });
                }
                log("الواجهة تم رسمها بنجاح");
            } else {
                if(loadingEl) {
                    loadingEl.innerHTML = "<div style='text-align:center; padding:20px; color:#888;'>لا توجد استطلاعات متاحة حالياً</div>";
                }
                log("❌ لم يتم جلب استطلاعات");
            }
        }).catch(err => {
            console.error("Error in getPollData:", err);
        });
    });

    // 🎯 إعداد المستمعين للأحداث
    function setupEventListeners() {
        const captchaBox = document.querySelector('.captcha-box');
        const submitBtn = document.getElementById('submit-vote-btn');
        
        // 🆕 مع reCAPTCHA الحقيقي يُخفى المربع الشكلي ويُحمَّل التحقق عند أول اختيار
        if (RECAPTCHA_SITE_KEY) {
          const fake = document.querySelector('.fake-recaptcha');
            if (fake) fake.style.display = 'none';
            // إخفاء شارة reCAPTCHA العائمة واستبدالها بنص الإسناد الذي تشترطه Google داخل صندوق الاستطلاع
            const noteAnchor = fake || submitBtn;
            if (noteAnchor) {
                const note = document.createElement('p');
                note.className = 's24-recaptcha-note';
                note.style.cssText = 'font-size:11px;color:#888;margin:10px 0 14px;line-height:1.6;text-align:center';
                note.innerHTML = 'هذا الاستطلاع محمي بـ reCAPTCHA، وتنطبق عليه <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">سياسة الخصوصية</a> و<a href="https://policies.google.com/terms" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">شروط الخدمة</a> من Google.';
                noteAnchor.insertAdjacentElement('afterend', note);
                const badgeCss = document.createElement('style');
                badgeCss.textContent = '.grecaptcha-badge{visibility:hidden!important}'; // visibility لا display حتى يبقى التحقق عاملاً
                document.head.appendChild(badgeCss);
            }
            document.addEventListener('change', function(e) {
                if (e.target.name === 'vote') loadRecaptcha();
            });
        }

        if (captchaBox && !RECAPTCHA_SITE_KEY) {
            captchaBox.addEventListener('click', function() {
                isCaptchaDone = true;
                this.setAttribute('data-checked', 'true');
                this.innerHTML = '✔';
                this.style.background = '#6db200'; 
                this.style.color = '#fff';
                if(submitBtn && document.querySelector('input[name="vote"]:checked')) {
                    submitBtn.disabled = false;
                }
            });
        }
        
        if (submitBtn) {
            submitBtn.addEventListener('click', submitVote);
        }
        
        document.addEventListener('change', function(e) {
            if (e.target.name === 'vote' && isCaptchaDone) {
                if(submitBtn) submitBtn.disabled = false;
            }
        });
    }

    function getOptionsCount(qData) {
        if (!qData) return 2;
        
        for (let i = 6; i >= 1; i--) {
            if (qData[`opt${i}`]) return i;
        }
        return 2;
    }

    // ✅ بناء خيارات الاستطلاع ديناميكياً
    function generatePollOptions(qData, optionsCount) {
        const container = document.getElementById('poll-options-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        for (let i = 1; i <= optionsCount; i++) {
            const label = document.createElement('label');
            label.className = 'poll-label'; 
            
            const span = document.createElement('span');
            span.className = 'poll-text';
            span.innerText = qData[`opt${i}`] || `الخيار ${i}`;
            
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'vote';
            input.value = i.toString();
            
            label.appendChild(span);
            label.appendChild(input);
            container.appendChild(label);
        }
    }

    function renderPoll(index) {
        if (index >= allQuestions.length) return;
        currentQIndex = index;
        const qData = allQuestions[index];
        
        // ✅ تحقق من صحة البيانات
        if (!qData || !qData.pollId) {
            console.error("Invalid poll data at index", index);
            return;
        }
        
        const optionsCount = getOptionsCount(qData);
        
        const titleEl = document.getElementById('p-question');
        if(titleEl) titleEl.innerText = qData.q;
        
        generatePollOptions(qData, optionsCount);
        showFormUI();
        
        isCaptchaDone = !!RECAPTCHA_SITE_KEY;
        const captchaBox = document.querySelector('.captcha-box');
        if(captchaBox) {
            captchaBox.removeAttribute('data-checked');
            captchaBox.innerHTML = '';
            captchaBox.style.background = '#fff';
        }
        
        const submitBtn = document.getElementById('submit-vote-btn');
        if(submitBtn) submitBtn.disabled = true;

        // ✅ تحقق من التصويت السابق
        try {
            const storageKey = 'voted_' + qData.pollId;
            if(localStorage.getItem(storageKey)) { 
                showResultsUI(qData, optionsCount);
            }
        } catch(e) {
            // تجاهل أخطاء localStorage
        }
        
        updatePaginationUI();
    }

    // 🗳️ إرسال التصويت عبر GET
    function submitVote() {
        if(isSubmitting) return;
        
        const qData = allQuestions[currentQIndex];
        
        // ✅ تحقق من صحة البيانات
        if (!qData || !qData.pollId) {
            alert("خطأ: لم يتم تحميل الاستطلاع بشكل صحيح");
            return;
        }
        
        const selectedRadio = document.querySelector('input[name="vote"]:checked');
        
        if (!selectedRadio) { 
            alert("الرجاء اختيار إجابة"); 
            return; 
        }
        
        isSubmitting = true;
        const optionNumber = parseInt(selectedRadio.value);
        const btn = document.getElementById('submit-vote-btn');
        if (!btn) {
            isSubmitting = false;
            return;
        }
        
        const originalText = btn.innerText;
        btn.innerHTML = 'جاري الإرسال...'; 
        btn.disabled = true;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT);
        
        log("إرسال التصويت", { pollId: qData.pollId, option: optionNumber, voterId });
        
        // ✅ استخدم GET بدل POST (تجنب CORS)
        // 🆕 التصويت عبر البوابة الجديدة مع رمز reCAPTCHA (فارغ إن لم يُفعَّل)
        getRecaptchaToken()
        .then(token => {
            const voteUrl = GATEWAY_URL + `?action=vote&pollId=${encodeURIComponent(qData.pollId)}&type=${optionNumber}&voterId=${encodeURIComponent(voterId)}&token=${encodeURIComponent(token || '')}`;
            return fetch(voteUrl, { signal: controller.signal });
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            if(data.error) {
                log("التصويت مرفوض: " + data.error);
                alert(data.error);
                
                if(data.already_voted) {
                    try {
                        localStorage.setItem('voted_' + qData.pollId, 'true');
                    } catch(e) {}
                    
                    const optionsCount = getOptionsCount(qData);
                    showResultsUI(qData, optionsCount);
                }
                return;
            }
            
            // ✅ تحقق من البيانات قبل استخدامها
            for(let i = 1; i <= 6; i++) {
                const countKey = `opt${i}Count`;
                if(data[countKey] !== undefined && typeof data[countKey] === 'number') {
                    allQuestions[currentQIndex][countKey] = data[countKey];
                }
            }
            if(data.total !== undefined && typeof data.total === 'number') {
                allQuestions[currentQIndex].total = data.total;
            }
            
            try {
                localStorage.setItem('voted_' + qData.pollId, 'true');
            } catch(e) {}
            try { sessionStorage.removeItem(CACHE_KEY); } catch(e) {}  // 🆕 لتظهر الأرقام المحدّثة في الصفحة التالية
            
            btn.innerText = originalText; 
            const optionsCount = getOptionsCount(qData);
            showResultsUI(qData, optionsCount);
            log("التصويت أُرسل بنجاح", data);
        })
        .catch(err => {
            console.error("Vote error:", err);
            log("خطأ في التصويت", err.message);
            btn.innerHTML = originalText; 
            btn.disabled = false;
            
            if (err.name === 'AbortError') {
                alert('انتهت المهلة الزمنية. تأكد من اتصالك بالإنترنت.');
            } else {
                alert('حدث خطأ في إرسال التصويت. يرجى المحاولة مرة أخرى.');
            }
        })
        .finally(() => {
            clearTimeout(timeoutId);  // ✅ امسح الـ timeout دائماً
            isSubmitting = false;
        });
    }

    function showFormUI() {
        const formSection = document.getElementById('p-form-section');
        const resultsSection = document.getElementById('p-results-section');
        if(formSection) formSection.style.display = 'block';
        if(resultsSection) resultsSection.style.display = 'none';
    }

    function showResultsUI(qData, optionsCount) {
        const formSection = document.getElementById('p-form-section');
        const resultsSection = document.getElementById('p-results-section');
        if(formSection) formSection.style.display = 'none';
        if(resultsSection) resultsSection.style.display = 'flex';

        const resultsContainer = document.getElementById('results-container');
        if(resultsContainer) resultsContainer.innerHTML = '';

        let total = 0;
        const votes = [];
        
        for (let i = 1; i <= optionsCount; i++) {
            const count = qData[`opt${i}Count`] || 0;
            votes.push({ count, text: qData[`opt${i}`] });
            total += count;
        }
        if(total === 0) total = 1;
        
        votes.forEach((vote) => {
            const perc = ((vote.count / total) * 100).toFixed(1);
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.innerHTML = `
                <div class="result-label">${escapeHTML(vote.text)}</div>
                <div class="result-bar-row">
                    <div class="result-stats">
                        <span class="stat-count">${vote.count}</span>
                        <span class="stat-perc">${perc}%</span>
                    </div>
                    <div class="progress-bg">
                        <div class="progress-bar" style="width:${perc}%"></div>
                    </div>
                </div>`;
            if(resultsContainer) resultsContainer.appendChild(resultItem);
        });
        
        const totalEl = document.getElementById('total-votes-count');
        if(totalEl) totalEl.innerText = qData.total || total;
    }

    function createPagination() {
        const container = document.getElementById('poll-pagination');
        if(!container) return;
        
        allQuestions.forEach((q, idx) => {
            let btn = document.createElement('div');
            btn.className = 'page-btn'; 
            btn.innerText = idx + 1;
            btn.setAttribute('data-index', idx);
            container.appendChild(btn);
        });
        
        container.addEventListener('click', (e) => {
            if(e.target.classList.contains('page-btn')) {
                const index = parseInt(e.target.getAttribute('data-index'));
                if (!isNaN(index)) renderPoll(index);
            }
        });
    }

    function updatePaginationUI() {
        const btns = document.querySelectorAll('.page-btn');
        btns.forEach((btn, idx) => {
            if(idx === currentQIndex) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }
})();
