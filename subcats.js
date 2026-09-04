/* ============================================================
   S24News — الأقسام الفرعية المدمجة (subcats-wrapper)
   ملف خارجي — لا يُعدَّل داخل قالب بلوجر
   ============================================================ */

  document.addEventListener("DOMContentLoaded", function() {
      const wrapper = document.getElementById('subcats-wrapper');
      if (!wrapper) return;

      // 📌 إعدادات الأقسام الفرعية المدمجة
      const subCats = [
          { tag: "فنون", title: "فنون ومشاهير" },
          { tag: "سيرة ذاتية", title: "سير ذاتية" }, // إضافة قسم السير الذاتية
          { tag: "متفرقات", title: "متفرقات" },
          { tag: "صحة وطب", title: "صحة" },
          { tag: "تكنولوجيا", title: "علوم وتكنولوجيا" },
          { tag: "مجتمع", title: "مجتمع" }
      ];

      subCats.forEach(sub => {
          const sectionDiv = document.createElement('div');
          sectionDiv.className = 'theme-section';
          sectionDiv.innerHTML = `
              <div class='theme-section-header'>
                  <div class='theme-title-text'>${sub.title}</div>
              </div>
              <div class='theme-content-area' id='sub-area-${sub.tag.replace(/\s+/g, '-')}'>
                  <div style='padding:40px; text-align:center; color:var(--text-sec);'>جاري التحميل...</div>
              </div>
          `;
          wrapper.appendChild(sectionDiv);

          // جلب البيانات من خلاصة بلوجر
          const feedUrl = '/feeds/posts/summary/-/' + encodeURIComponent(sub.tag) + '?alt=json&max-results=4';
          
          fetch(feedUrl)
          .then(res => res.json())
          .then(data => {
              const contentArea = document.getElementById('sub-area-' + sub.tag.replace(/\s+/g, '-'));              
              if (data.feed && data.feed.entry && data.feed.entry.length > 0) {
                  let html = '';
                  const entries = data.feed.entry;                  
                  const mainPost = entries[0];
                  const mainTitle = mainPost.title.$t;
                  let mainLink = '#';
                  mainPost.link.forEach(l => { if(l.rel === 'alternate') mainLink = l.href; });                 
                  
                  let mainImg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e0e0e0"/%3E%3C/svg%3E';
                  if (mainPost.media$thumbnail) {
                      mainImg = mainPost.media$thumbnail.url.replace(/\/s[0-9]+.*?\//, '/w500-h280-c/');
                  }

                  html += `
                      <a href="${mainLink}" class="theme-main-post">
                          <img src="${mainImg}" class="theme-main-img" alt="${mainTitle}" loading="lazy" style="width:100%; height:auto; aspect-ratio: 16 / 9; object-fit:cover;">
                          <h3 class="theme-main-title">${mainTitle}</h3>
                      </a>
                  `;

                  if (entries.length > 1) {
                      html += '<ul class="theme-sub-list">';
                      for (let i = 1; i < entries.length; i++) {
                          const subTitle = entries[i].title.$t;
                          let subLink = '#';
                          entries[i].link.forEach(l => { if(l.rel === 'alternate') subLink = l.href; });
                          html += `
                              <li class="theme-sub-item">
                                  <a href="${subLink}" class="theme-sub-link">${subTitle}</a>
                              </li>
                          `;
                      }
                      html += '</ul>';
                  }

                  html += `
                      <div class="theme-section__button-block">
                          <a href="/search/label/${encodeURIComponent(sub.tag)}" class="main-button">
                              المزيد من ${sub.title}
                          </a>
                      </div>
                  `;                  
                  contentArea.innerHTML = html;
              } else {
                  sectionDiv.style.display = 'none'; // إخفاء القسم إذا كان فارغاً
              }
          })
          .catch(err => {
              sectionDiv.style.display = 'none';
          });
      });
  });
  //]]>
