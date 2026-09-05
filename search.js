/* ============================================================
   S24News — البحث الفوري (ajax-search-results)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

document.addEventListener("DOMContentLoaded", function() {
    const searchInputs = document.querySelectorAll("input[name='q']");
    
    searchInputs.forEach(input => {
        // إنشاء القائمة
        let resultsBox = document.createElement("div");
        resultsBox.className = "ajax-search-results";
        
        // ضبط موضع العنصر الأب
        if(input.parentNode) {
            input.parentNode.style.position = "relative";
            input.parentNode.appendChild(resultsBox);
        }

                let typingTimer;
        let searchRequestId = 0;
        
        input.addEventListener("keyup", function() {
            clearTimeout(typingTimer);
            let query = this.value.trim();
            
            if (query.length < 2) {
                resultsBox.style.display = "none";
                searchRequestId++;
                return;
            }

                        typingTimer = setTimeout(() => {
                const currentRequestId = ++searchRequestId;
                resultsBox.style.display = "block";
                resultsBox.innerHTML = '<div class="ajax-loading">...</div>';
                
                fetch('/feeds/posts/summary?alt=json&max-results=6&orderby=published&q=' + encodeURIComponent(query))
                .then(res => res.json())
                .then(data => {
                    if (currentRequestId !== searchRequestId) return;
                    resultsBox.innerHTML = "";
                    if (data.feed.entry) {
                        data.feed.entry.slice(0, 4).forEach(entry => {
                            let title = entry.title.$t;
                            let link = entry.link.find(l => l.rel == "alternate").href;
                                                        let img = entry.media$thumbnail ? entry.media$thumbnail.url.replace("s72-c", "s100-c") : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'%3E%3Crect width='60' height='60' fill='%23e0e0e0'/%3E%3C/svg%3E";
                            
                            let item = `
                                <a href="${link}" class="ajax-result-item">
                                    <img src="${img}" class="ajax-result-img" loading="lazy">
                                    <div class="ajax-result-info">
                                        <span class="ajax-result-title">${title}</span>
                                    </div>
                                </a>`;
                            resultsBox.insertAdjacentHTML('beforeend', item);
                        });
                        // زر عرض الكل
                        resultsBox.insertAdjacentHTML('beforeend', `<a href="/search?q=${encodeURIComponent(query)}" class="ajax-view-all">عرض كافة النتائج لـ "${query}"</a>`);
                    } else {
                        resultsBox.innerHTML = '<div class="ajax-no-result">لا توجد نتائج</div>';
                    }
                });
            }, 300);
        });

        // إخفاء عند النقر في الخارج
        document.addEventListener("click", (e) => {
            if (e.target !== input && !resultsBox.contains(e.target)) resultsBox.style.display = "none";
        });
    });
});
