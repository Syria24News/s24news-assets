/* ============================================================
   S24News — نظام الاستطلاع والتصويت (Poll)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

(function() {
    // ⚙️ الإعدادات العامة
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw0gcfY_hhjNpEWFTuY_MBXNNO59k_XZoU7kevKj6_PaBPDO0x2B3K6v6TK0CewvGExNQ/exec"; 
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
        getPollData().then(data => {
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
        
        if (captchaBox) {
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
        
        isCaptchaDone = false;
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
        const voteUrl = SCRIPT_URL + `?action=vote&pollId=${encodeURIComponent(qData.pollId)}&type=${optionNumber}&voterId=${encodeURIComponent(voterId)}`;

        fetch(voteUrl, { 
            signal: controller.signal 
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
                <div class="result-label">${vote.text}</div>
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
