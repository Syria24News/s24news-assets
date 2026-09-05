/* ============================================================
   S24News — المقالات ذات الصلة + وضع كتل الإعلانات
   (كتلتان متلاصقتان دُمجتا بترتيبهما الأصلي)
   ============================================================ */

/* =============== 1) المقالات ذات الصلة =============== */
document.addEventListener("DOMContentLoaded", function() {
    if (!document.body.classList.contains('item-page')) return;   
    let label = "";
    const customLabel = document.querySelector('.sy-meta-label .sy-label-text');
    if (customLabel) {
        label = customLabel.innerText.trim();
    } else {
        const standardLabel = document.querySelector('a[rel="tag"]');
        if (standardLabel) {
            label = standardLabel.innerText.trim();
        }
    }  
    if (!label) return;    
    fetch('/feeds/posts/summary/-/' + encodeURIComponent(label) + '?alt=json&max-results=6')
    .then(res => res.json())
    .then(data => {
        if (data.feed && data.feed.entry) {
            const currentUrl = window.location.href.split('?')[0].split('#')[0];   
            const relatedPosts = data.feed.entry.filter(entry => {
                let link = "";
                entry.link.forEach(l => { if (l.rel === 'alternate') link = l.href; });
                const isGlossary = (entry.category || []).some(cat => cat.term === 'الموسوعة');
                return link && !link.includes(window.location.pathname) && !isGlossary; 
            });   
            const finalPosts = relatedPosts.slice(0, 3);    
            if (finalPosts.length > 0) {         
                let cardsHTML = '';
                finalPosts.forEach(post => {
                    const title = post.title.$t;
                    let link = "";
                    post.link.forEach(l => { if (l.rel === 'alternate') link = l.href; });       
                    
                    let img = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e0e0e0'/%3E%3C/svg%3E";
                    if (post.media$thumbnail) {
                        img = post.media$thumbnail.url
                            .replace(/\/s[0-9]+.*?\//, '/w400-h225-c/')
                            .replace(/\/w[0-9]+.*?\//, '/w400-h225-c/');
                    }                  
                    cardsHTML += `
                        <a href="${link}" class="sy-related-card">
                            <div class="sy-related-thumb">
                                <img src="${img}" alt="${title}" loading="lazy">
                            </div>
                            <div class="sy-related-info">
                                <h3 class="sy-related-card-title">${title}</h3>
                            </div>
                        </a>
                    `;
                });        
                const sectionHTML = `
                    <div class="sy-related-posts-container">
                        <h3 class="sy-related-main-title">إقرأ المزيد</h3>
                        <div class="sy-related-grid">
                            ${cardsHTML}
                        </div>
                    </div>
                `;        
              // التقسيم الذكي وترتيب الصناديق:
                const mainEntry = document.querySelector('.post.hentry'); 
                const adUnderPost = document.getElementById('ad-under-post-container'); 

                // الترتيب الصارم: المقال ثم الإعلان ثم إقرأ المزيد
                if (adUnderPost) {
                    // إذا وجد صندوق الإعلان، يضع "إقرأ المزيد" تحته
                    adUnderPost.insertAdjacentHTML('afterend', sectionHTML);
                } else if (mainEntry) {
                    // إذا لم يجد إعلاناً، يضع "إقرأ المزيد" تحت المقال
                    mainEntry.insertAdjacentHTML('afterend', sectionHTML);
                }
            }
        }
    })
    .catch(err => {});
});

/* =============== 2) وضع كتل الإعلانات داخل المقال =============== */
document.addEventListener("DOMContentLoaded",function(){var e=document.getElementById("in-article-ad-wrapper"),t=document.querySelector('[id^="post-body-"]');e&&t&&t.appendChild(e);var n=document.getElementById("ad-under-post-container"),d=document.querySelector(".post.hentry");d&&n&&d.parentNode.insertBefore(n,d.nextSibling)});
