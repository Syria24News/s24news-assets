/* ============================================================
   S24News — صفحة الخطأ 404 (error-404.js)
   تُحمَّل من فرع data:view.isError داخل أداة Blog1 في القالب فقط.
   • تملأ #s24-404-latest بأحدث 6 أخبار تحت رسالة الخطأ، كي لا تكون الصفحة طريقاً مسدوداً
   • المصدر: خلاصة بلوغر نفسها (/feeds/posts/summary) — مجانية ولا تستهلك أي حصة من Firestore أو Apps Script
   • تُستثنى مداخل الموسوعة (وسم «الموسوعة») لأنها ليست أخباراً
   • البطاقات بتنسيق «إقرأ المزيد» نفسه (.sy-related-*) في s24-main.css — لا تنسيق جديد للبطاقات
   • تصميم الصفحة نفسها (الرقم، الرسالة، البحث، الروابط) في s24-main.css تحت «صفحة الخطأ 404»
   ============================================================ */
(function () {
  var box = document.getElementById('s24-404-latest');
  if (!box) return;

  var COUNT = 6;
  var PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23e0e0e0'/%3E%3C/svg%3E";

  // رابط المقالة من مصفوفة روابط الخلاصة
  function postLink(entry) {
    var links = entry.link || [];
    for (var i = 0; i < links.length; i++) if (links[i].rel === 'alternate') return links[i].href;
    return '';
  }

  // صورة مصغّرة بقياس 16:9 من خوادم بلوغر
  function postImage(entry) {
    if (!entry.media$thumbnail) return PLACEHOLDER;
    return entry.media$thumbnail.url
      .replace(/\/s[0-9]+(-c)?\//, '/w400-h225-c/')
      .replace(/=s[0-9]+(-c)?$/, '=w400-h225-c');
  }

  function isEncyclopedia(entry) {
    return (entry.category || []).some(function (c) { return c.term === 'الموسوعة'; });
  }

  // بناء البطاقة بالـ DOM (العنوان نص صرف، لا HTML)
  function card(entry) {
    var a = document.createElement('a');
    a.className = 'sy-related-card';
    a.href = postLink(entry);

    var thumb = document.createElement('div');
    thumb.className = 'sy-related-thumb';
    var img = document.createElement('img');
    img.src = postImage(entry);
    img.alt = entry.title.$t;
    img.loading = 'lazy';
    thumb.appendChild(img);

    var info = document.createElement('div');
    info.className = 'sy-related-info';
    var h = document.createElement('h3');
    h.className = 'sy-related-card-title';
    h.textContent = entry.title.$t;
    info.appendChild(h);

    a.appendChild(thumb);
    a.appendChild(info);
    return a;
  }

  fetch('/feeds/posts/summary?alt=json&max-results=' + (COUNT + 6))
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      var list = ((data.feed || {}).entry || [])
        .filter(function (e) { return postLink(e) && !isEncyclopedia(e); })
        .slice(0, COUNT);
      if (!list.length) return;

      var title = document.createElement('h2');
      title.className = 'sy-related-main-title';
      title.textContent = 'أحدث الأخبار';

      var grid = document.createElement('div');
      grid.className = 'sy-related-grid';
      list.forEach(function (e) { grid.appendChild(card(e)); });

      box.appendChild(title);
      box.appendChild(grid);
      box.hidden = false;
    })
    .catch(function (err) { console.error('[S24 404]', err); });
})();
