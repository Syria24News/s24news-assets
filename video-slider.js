/* ============================================================
   S24News — سلايدر الفيديو في الصفحة الرئيسية (rt-video-track)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

document.addEventListener("DOMContentLoaded", function() {
    const VIDEO_LABEL = "*V"; 
    const POSTS_COUNT = 8; 
    const CLONES_COUNT = 3; 

    const track = document.getElementById('rt-video-track');
    const dotsContainer = document.getElementById('rt-dots-container');
    const btnLeft = document.getElementById('rt-btn-left'); 
    const btnRight = document.getElementById('rt-btn-right');
    
    let cards = []; 
    let totalSlides = 0;
    let currentIndex = CLONES_COUNT; 
    let isTransitioning = false;
    let cardWidth = 0;

    fetch('/feeds/posts/summary/-/' + encodeURIComponent(VIDEO_LABEL) + '?alt=json&orderby=published&max-results=' + POSTS_COUNT)
    .then(res => res.json())
    .then(data => {
        track.innerHTML = ''; 
        dotsContainer.innerHTML = ''; 

        if (data.feed && data.feed.entry) {
            cards = data.feed.entry;
            totalSlides = cards.length;
            
            let displayHTML = '';
            for (let i = totalSlides - CLONES_COUNT; i < totalSlides; i++) {
                displayHTML += createCardHTML(cards[i], 'clone-last');
            }
            cards.forEach((entry, index) => {
                displayHTML += createCardHTML(entry, 'original');
                let dot = document.createElement('button');
                dot.className = index === 0 ? 'play-slider__dot-button active' : 'play-slider__dot-button';
                dot.onclick = () => {
                    if(isTransitioning) return;
                    currentIndex = index + CLONES_COUNT;
                    updateSlide(true);
                };
                dotsContainer.appendChild(dot);
            });
            for (let i = 0; i < CLONES_COUNT; i++) {
                displayHTML += createCardHTML(cards[i], 'clone-first');
            }
            track.innerHTML = displayHTML;
            setTimeout(() => { recalcWidthAndPos(false); }, 100);
        } else {
            track.innerHTML = '<div style="padding:20px; width:100%; text-align:center;">لا توجد فيديوهات</div>';
        }
    });

    function createCardHTML(entry, type) {
        let title = entry.title.$t;
        let link = entry.link.find(l => l.rel === 'alternate').href;
        let postIdMatch = (entry.id.$t || '').match(/post-(\d+)/);
        let shortsLink = postIdMatch ? '/p/shorts.html?id=' + postIdMatch[1] : link;
        let img = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e0e0e0'/%3E%3C/svg%3E";
        if (entry.media$thumbnail) {
            img = entry.media$thumbnail.url.replace(/\/s[0-9]+.*?\//, '/w400-h225-c/');
        }
        return `
            <a href="${shortsLink}" class="rt-video-card ${type}">
                <div class="rt-video-thumb-box">
                    <img src="${img}" alt="${title}" loading="lazy">
                    <div class="rt-play-overlay">
                        <svg class="rt-play-icon-svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                    </div>
                </div>
                <h4 class="rt-video-title">${title}</h4>
            </a>
        `;
    }

    function updateSlide(animate = true) {
        if (!track.querySelector('.rt-video-card')) return;
        let firstCard = track.querySelector('.rt-video-card');
        cardWidth = firstCard.offsetWidth + 15; 
        if (animate) {
            isTransitioning = true;
            track.style.scrollBehavior = 'smooth';
        } else {
            track.style.scrollBehavior = 'auto';
        }
        track.scrollLeft = currentIndex * cardWidth;
        let realIndex = currentIndex - CLONES_COUNT;
        if (realIndex < 0) realIndex = totalSlides - 1;
        if (realIndex >= totalSlides) realIndex = 0;
        updateDotsClass(realIndex);
        if (animate) {
            setTimeout(() => { checkIndex(); isTransitioning = false; }, 400); 
        }
    }

    function checkIndex() {
        track.style.scrollBehavior = 'auto'; 
        let firstCard = track.querySelector('.rt-video-card');
        cardWidth = firstCard.offsetWidth + 15;
        if (currentIndex >= totalSlides + CLONES_COUNT) {
            currentIndex = CLONES_COUNT;
            track.scrollLeft = currentIndex * cardWidth;
        }
        else if (currentIndex < CLONES_COUNT) {
            currentIndex = totalSlides + CLONES_COUNT - 1; 
            track.scrollLeft = currentIndex * cardWidth;
        }
    }

    window.addEventListener('resize', () => { recalcWidthAndPos(false); });
    function recalcWidthAndPos(animate) {
        let firstCard = track.querySelector('.rt-video-card');
        if(firstCard) {
            cardWidth = firstCard.offsetWidth + 15;
            if (!animate) track.style.scrollBehavior = 'auto';
            track.scrollLeft = currentIndex * cardWidth;
        }
    }

    if(btnLeft) {
        btnLeft.addEventListener('click', () => {
            if(isTransitioning) return;
            currentIndex++;
            updateSlide(true);
        });
    }
    if(btnRight) {
        btnRight.addEventListener('click', () => {
            if(isTransitioning) return;
            currentIndex--;
            updateSlide(true);
        });
    }
    function updateDotsClass(index) {
        let dots = document.querySelectorAll('.play-slider__dot-button');
        dots.forEach(d => d.classList.remove('active'));
        if(dots[index]) {
            dots[index].classList.add('active');
        }
    }
});
