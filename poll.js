/* ============================================================
   S24News — نظام الاستطلاع والتصويت (Poll)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   v2.0 (9 أكتوبر 2026): القراءة من Firestore + التصويت عبر S24 Polls Gateway
   v2.4 (19 أكتوبر 2026): الجلب حسب النشاط — نسخة قائمة الاستطلاعات على جهاز الزائر (localStorage):
        دقيقتان ما دام في الموقع استطلاع ظاهر، و30 دقيقة حين لا يوجد استطلاع.
        مفتاح السرعة الكاملة: window.S24_SPEED = 'full' في config.js يجعلها دقيقتين دائماً.
   v2.5 (19 أكتوبر 2026): حذف الرجوع إلى مشروع «استطلاع رأي» القديم — عند تعذّر Firestore
        تُعرض آخر نسخة محفوظة على جهاز الزائر إن وُجدت، وإلا «لا توجد استطلاعات».
   v2.6 (26 نوفمبر 2026): صفحة الاستطلاعات /p/polls.html
        - النتائج كما في روسيا اليوم: نسبة مئوية صحيحة لكل خيار (مجموعها 100) + «عدد المشاركين» فقط،
          بلا عدد الأصوات بجانب كل خيار
        - نواة مشتركة window.S24Poll (القراءة، التصويت، النتائج، reCAPTCHA) تستعملها صفحة الاستطلاعات
          (poll-page.js) بلا تكرار للكود
        - نسخة القائمة على الجهاز تحفظ أيضاً خريطة الأرشيف archive (الإصدار 2 من المفتاح)
        - ودجت الرئيسية لا يعمل إلا إن وُجد صندوقه #sy-voting-system
        - يتطلب S24 Polls Gateway 1.4.0 (pollIds في النتائج المجمّعة)
   ============================================================ */

(function() {
    // ⚙️ الإعدادات العامة
    // 🆕 البوابة الجديدة: كل الأصوات تذهب إليها
    const GATEWAY_URL = "https://script.google.com/macros/s/AKfycbx6S27AM5zuftOmha8Zf-QixGfCiUGUbaapLY7qklwXcxDXLInbXDTn4UqdzYs5tT4/exec";
    // مستندات العرض العام في Firestore (قراءة عامة — القواعد: polls_public/{doc})
    const FS_DOCS = "https://firestore.googleapis.com/v1/projects/s24n-views/databases/(default)/documents/polls_public/";
    const PUBLIC_DOC_URL = FS_DOCS + "active";
    // 🆕 مفتاح موقع reCAPTCHA v3 (عام وليس سرياً). فارغ = التحقق معطّل
    const RECAPTCHA_SITE_KEY = "6LdBaIAtAAAAAJSkw_tfRgJWp2Rm9kfVcaDBj8Q-";
    // نسخة القائمة على جهاز الزائر — عمرها حسب النشاط
    // v2.6: المفتاح الثاني يحفظ القائمة d وخريطة الأرشيف a معاً (الأول يُحذف)
    const CACHE_KEY = 's24_polls_public_v2';
    const OLD_CACHE_KEY = 's24_polls_public_v1';
    const CACHE_TTL = 2 * 60 * 1000;          // يوجد استطلاع ظاهر (وكذلك نسخة النتائج)
    const CACHE_TTL_IDLE = 30 * 60 * 1000;    // لا استطلاع ظاهر: نسخة 30 دقيقة
    // عمر نسخة القائمة: السرعة الكاملة أو وجود استطلاع = دقيقتان، وإلا 30 دقيقة
    function listTtl(list) {
        if (window.S24_SPEED === 'full') return CACHE_TTL;
        return (list && list.length) ? CACHE_TTL : CACHE_TTL_IDLE;
    }
    const FETCH_TIMEOUT = 15000;
    const SUBMIT_TIMEOUT = 15000;
    const RESULTS_CACHE_PREFIX = 's24_poll_res_';   // نتائج من صوّت (جلسة، دقيقتان)
    const DEBUG = false;

    try { localStorage.removeItem(OLD_CACHE_KEY); } catch (e) {}

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

    // تحويل قيمة Firestore REST إلى قيمة JavaScript عادية (v2.6: والمصفوفات لمستندات الأرشيف)
    function fsv(v) {
        if (!v) return null;
        if ('stringValue' in v) return v.stringValue;
        if ('integerValue' in v) return Number(v.integerValue);
        if ('doubleValue' in v) return v.doubleValue;
        if ('booleanValue' in v) return v.booleanValue;
        if ('timestampValue' in v) return new Date(v.timestampValue).getTime();
        if ('mapValue' in v) {
            const o = {}, f = v.mapValue.fields || {};
            Object.keys(f).forEach(k => { o[k] = fsv(f[k]); });
            return o;
        }
        if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsv);
        return null;
    }

    // جلب مستند عام من polls_public بمهلة — null إن لم يوجد
    async function fetchDoc(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`Firestore HTTP ${res.status}`);
            const doc = await res.json();
            return fsv({ mapValue: { fields: doc.fields || {} } });
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // قراءة البولات النشطة من Firestore (مستند واحد) مع نسخة على جهاز الزائر حسب النشاط
    // تُرجع { d: القائمة المرتبة، a: خريطة الأرشيف { m2026_11: { t, n } } }
    async function getFromFirestore() {
        try {
            const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            if (c && Array.isArray(c.d) && (Date.now() - c.t) < listTtl(c.d)) return c;
        } catch (e) {}

        const doc = await fetchDoc(PUBLIC_DOC_URL);   // لا يوجد مستند بعد = لا استطلاعات
        const polls = (doc && doc.polls) || {};
        const list = Object.keys(polls).map(k => polls[k])
            .filter(x => x && x.pollId && x.q && x.opt1)
            .sort((a, b) => ((Number(b.order) || 0) - (Number(a.order) || 0)) ||
                            ((Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)));
        const c = { t: Date.now(), d: list, a: (doc && doc.archive) || {} };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {}
        return c;
    }

    // المصدر الوحيد Firestore؛ عند تعذّر الاتصال تُعرض آخر نسخة محفوظة على الجهاز (مهما كان عمرها)
    async function getState() {
        try {
            const c = await getFromFirestore();
            log("Firestore: " + c.d.length + " استطلاع");
            return c;
        } catch (err) {
            console.error("Poll Firestore Error:", err);
            try {
                const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
                if (c && Array.isArray(c.d)) return c;
            } catch (e) {}
            return { t: 0, d: [], a: {} };
        }
    }
    async function getPolls() { return (await getState()).d; }

    // تحميل reCAPTCHA عند أول تفاعل مع الاستطلاع فقط (لا يُحمَّل في كل صفحة)
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

    // رمز reCAPTCHA لعملية التصويت (نص فارغ إن كان معطّلاً أو فشل التحميل)
    function getRecaptchaToken() {
        return loadRecaptcha().then(ok => {
            if (!ok || !window.grecaptcha) return '';
            return window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'vote' }).catch(() => '');
        });
    }

    // نص الإسناد الذي تشترطه Google بدل الشارة العائمة — يوضع قبل العنصر المعطى
    let badgeHidden = false;
    function addRecaptchaNote(beforeEl) {
        if (!RECAPTCHA_SITE_KEY || !beforeEl) return;
        const note = document.createElement('p');
        note.className = 's24-recaptcha-note';
        note.style.cssText = 'font-size:11px;color:#888;margin:10px 0 14px;line-height:1.6;text-align:center';
        note.innerHTML = 'هذا الاستطلاع محمي بـ reCAPTCHA، وتنطبق عليه <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">سياسة الخصوصية</a> و<a href="https://policies.google.com/terms" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">شروط الخدمة</a> من Google.';
        beforeEl.insertAdjacentElement('beforebegin', note);
        if (!badgeHidden) {
            badgeHidden = true;
            const badgeCss = document.createElement('style');
            badgeCss.textContent = '.grecaptcha-badge{visibility:hidden!important}'; // visibility لا display حتى يبقى التحقق عاملاً
            document.head.appendChild(badgeCss);
        }
    }

    // حماية النص قبل إدراجه في HTML — الدالة المشتركة من utils.js (يُحمَّل قبل هذا الملف)
    const escapeHTML = window.S24Util.esc;

    function isVoted(pollId) {
        try { return !!localStorage.getItem('voted_' + pollId); } catch (e) { return false; }
    }
    function setVoted(pollId, on) {
        try {
            if (on) localStorage.setItem('voted_' + pollId, 'true');
            else localStorage.removeItem('voted_' + pollId);
        } catch (e) {}
    }

    // الأعداد { opt1Count…, total } من رد البوابة (أرقام فقط)
    function pickCounts(data) {
        const c = { total: data.total };
        for (let i = 1; i <= 6; i++) {
            if (typeof data[`opt${i}Count`] === 'number') c[`opt${i}Count`] = data[`opt${i}Count`];
        }
        return c;
    }
    function cacheResults(pollId, counts) {
        try { sessionStorage.setItem(RESULTS_CACHE_PREFIX + pollId, JSON.stringify({ t: Date.now(), d: counts })); } catch (e) {}
    }
    function cachedResults(pollId) {
        try {
            const c = JSON.parse(sessionStorage.getItem(RESULTS_CACHE_PREFIX + pollId) || 'null');
            if (c && (Date.now() - c.t) < CACHE_TTL && c.d && typeof c.d.total === 'number') return c.d;
        } catch (e) {}
        return null;
    }

    // 🗳️ التصويت عبر البوابة (GET لتجنب CORS) مع رمز reCAPTCHA
    // يُرجع رد البوابة كما هو؛ ويحفظ علامة التصويت والنتائج عند النجاح أو التكرار
    function vote(pollId, optionNumber) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT);
        log("إرسال التصويت", { pollId, option: optionNumber, voterId });
        return getRecaptchaToken()
            .then(token => {
                const voteUrl = GATEWAY_URL + `?action=vote&pollId=${encodeURIComponent(pollId)}&type=${optionNumber}&voterId=${encodeURIComponent(voterId)}&token=${encodeURIComponent(token || '')}`;
                return fetch(voteUrl, { signal: controller.signal });
            })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (!data.error || data.already_voted) {
                    setVoted(pollId, true);
                    if (typeof data.total === 'number') cacheResults(pollId, pickCounts(data));
                }
                if (!data.error) {
                    try { localStorage.removeItem(CACHE_KEY); } catch (e) {}  // لتظهر الأرقام المحدّثة في الصفحة التالية
                }
                return data;
            })
            .finally(() => clearTimeout(timeoutId));
    }

    // 📊 نتائج من صوّت — طلب واحد للبوابة مهما كان عدد الاستطلاعات
    // يُرجع { pollId: { total, opt1Count… } | { not_voted: true } | { error } }
    // ما في نسخة الجلسة (دقيقتان) لا يُطلب من جديد
    async function results(pollIds) {
        const out = {}, need = [];
        pollIds.forEach(id => {
            const c = cachedResults(id);
            if (c) out[id] = c; else need.push(id);
        });
        if (!need.length) return out;
        // استطلاع واحد بالشكل القديم (pollId)، وأكثر من واحد مجمّعاً (pollIds)
        const url = GATEWAY_URL + '?action=results&voterId=' + encodeURIComponent(voterId) +
            (need.length === 1 ? '&pollId=' + encodeURIComponent(need[0]) : '&pollIds=' + need.map(encodeURIComponent).join(','));
        const data = await (await fetch(url)).json();
        const map = need.length === 1 ? { [need[0]]: data } : ((data && data.results) || {});
        need.forEach(id => {
            const r = map[id] || (data && data.error ? { error: data.error } : { error: 'no_data' });
            if (r.not_voted) setVoted(id, false);   // لا صوت مسجّل لهذا الجهاز: يعود نموذج التصويت
            else if (!r.error && typeof r.total === 'number') { const c = pickCounts(r); cacheResults(id, c); out[id] = c; return; }
            out[id] = r;
        });
        return out;
    }

    // نسب مئوية صحيحة مجموعها 100 بالضبط (طريقة أكبر باقٍ) — كما تعرضها روسيا اليوم
    function percents(counts) {
        const total = counts.reduce((a, b) => a + b, 0);
        if (!total) return counts.map(() => 0);
        const raw = counts.map(c => c * 100 / total);
        const res = raw.map(Math.floor);
        let left = 100 - res.reduce((a, b) => a + b, 0);
        raw.map((r, i) => ({ i, f: r - Math.floor(r) }))
            .sort((a, b) => (b.f - a.f) || (a.i - b.i))
            .forEach(x => { if (left > 0 && counts[x.i] > 0) { res[x.i]++; left--; } });
        return res;
    }

    // صفوف النتائج: اسم الخيار، الشريط، النسبة — تُستعمل في الودجت وفي صفحة الاستطلاعات
    function resultRows(texts, counts) {
        const p = percents(counts);
        return texts.map((text, i) => `
                <div class="result-item">
                    <div class="result-label">${escapeHTML(text)}</div>
                    <div class="result-bar-row">
                        <div class="result-stats">
                            <span class="stat-perc">${p[i]}%</span>
                        </div>
                        <div class="progress-bg">
                            <div class="progress-bar" style="width:${p[i]}%"></div>
                        </div>
                    </div>
                </div>`).join('');
    }

    function fmtNum(n) { return Number(n || 0).toLocaleString('en-US'); }

    // 🧩 النواة المشتركة — تستعملها صفحة الاستطلاعات poll-page.js
    window.S24Poll = {
        FS_DOCS, voterId, getState, fetchDoc, vote, results, percents, resultRows,
        isVoted, loadRecaptcha, addRecaptchaNote, fmtNum, esc: escapeHTML
    };

    /* ============================================================
       ودجت الرئيسية «شاركنا برأيك» — يعمل فقط إن وُجد صندوقه في الصفحة
       ============================================================ */
    let allQuestions = [];
    let currentQIndex = 0;
    let isSubmitting = false;

    document.addEventListener("DOMContentLoaded", function() {
        if (!document.getElementById('sy-voting-system')) return;
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
            console.error("Poll init error:", err);
        });
    });

    // 🎯 إعداد المستمعين للأحداث
    function setupEventListeners() {
        const submitBtn = document.getElementById('submit-vote-btn');

        // reCAPTCHA الحقيقي: نص الإسناد فوق زر التصويت، ويُحمَّل التحقق عند أول اختيار
        addRecaptchaNote(submitBtn);

        if (submitBtn) {
            submitBtn.addEventListener('click', submitVote);
        }

        document.addEventListener('change', function(e) {
            if (e.target.name !== 'vote') return;
            loadRecaptcha();
            if (submitBtn) submitBtn.disabled = false;
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

        const submitBtn = document.getElementById('submit-vote-btn');
        if(submitBtn) submitBtn.disabled = true;

        // ✅ تحقق من التصويت السابق
        if (isVoted(qData.pollId)) showResultsUI(qData, optionsCount);

        updatePaginationUI();
    }

    // 🗳️ إرسال التصويت من الودجت
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

        const btn = document.getElementById('submit-vote-btn');
        if (!btn) return;

        isSubmitting = true;
        const optionNumber = parseInt(selectedRadio.value);
        const originalText = btn.textContent;
        btn.textContent = 'جاري الإرسال...';
        btn.disabled = true;

        vote(qData.pollId, optionNumber)
        .then(data => {
            btn.textContent = originalText;
            if(data.error) {
                log("التصويت مرفوض: " + data.error);
                alert(data.error);
                if(data.already_voted) {
                    Object.assign(qData, pickCounts(data));
                    showResultsUI(qData, getOptionsCount(qData));
                } else {
                    btn.disabled = false;
                }
                return;
            }
            Object.assign(qData, pickCounts(data));
            showResultsUI(qData, getOptionsCount(qData));
            log("التصويت أُرسل بنجاح", data);
        })
        .catch(err => {
            console.error("Vote error:", err);
            btn.textContent = originalText;
            btn.disabled = false;
            if (err.name === 'AbortError') {
                alert('انتهت المهلة الزمنية. تأكد من اتصالك بالإنترنت.');
            } else {
                alert('حدث خطأ في إرسال التصويت. يرجى المحاولة مرة أخرى.');
            }
        })
        .finally(() => {
            isSubmitting = false;
        });
    }

    function showFormUI() {
        const formSection = document.getElementById('p-form-section');
        const resultsSection = document.getElementById('p-results-section');
        if(formSection) formSection.style.display = 'block';
        if(resultsSection) resultsSection.style.display = 'none';
    }

    // النتائج لا تأتي مع المستند العام؛ تُطلب من البوابة لمن صوّت فقط
    function loadResults(qData, optionsCount) {
        const formSection = document.getElementById('p-form-section');
        const resultsSection = document.getElementById('p-results-section');
        const rc = document.getElementById('results-container');
        const totalEl = document.getElementById('total-votes-count');
        if (formSection) formSection.style.display = 'none';
        if (resultsSection) resultsSection.style.display = 'flex';
        if (rc) rc.innerHTML = "<div style='text-align:center;padding:16px;color:#888;'>جاري تحميل النتائج...</div>";
        if (totalEl) totalEl.textContent = '—';

        const failMsg = () => {
            if (rc && allQuestions[currentQIndex] === qData) {
                rc.innerHTML = "<div style='text-align:center;padding:16px;color:#888;'>تعذّر تحميل النتائج حالياً</div>";
            }
        };
        results([qData.pollId])
            .then(map => {
                if (allQuestions[currentQIndex] !== qData) return; // انتقل الزائر إلى استطلاع آخر
                const r = map[qData.pollId] || {};
                if (r.not_voted) { showFormUI(); return; }
                if (r.error || typeof r.total !== 'number') return failMsg();
                Object.assign(qData, r);
                showResultsUI(qData, optionsCount);
            })
            .catch(failMsg);
    }

    // عرض النتائج كما في روسيا اليوم: النسبة لكل خيار + عدد المشاركين
    function showResultsUI(qData, optionsCount) {
        if (typeof qData.total !== 'number') { loadResults(qData, optionsCount); return; }
        const formSection = document.getElementById('p-form-section');
        const resultsSection = document.getElementById('p-results-section');
        if(formSection) formSection.style.display = 'none';
        if(resultsSection) resultsSection.style.display = 'flex';

        const texts = [], counts = [];
        for (let i = 1; i <= optionsCount; i++) {
            texts.push(qData[`opt${i}`] || `الخيار ${i}`);
            counts.push(qData[`opt${i}Count`] || 0);
        }
        const resultsContainer = document.getElementById('results-container');
        if(resultsContainer) resultsContainer.innerHTML = resultRows(texts, counts);

        const totalEl = document.getElementById('total-votes-count');
        if(totalEl) totalEl.textContent = fmtNum(qData.total);
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
