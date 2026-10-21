/* ============================================================
   S24News — صفحة «فريق سوريا 24» (team.js)
   تُحمَّل من صفحة /p/team.html فقط.
   • تقرأ خلاصة الصفحات الثابتة (/feeds/pages/default) وتعرض كل صفحة يبدأ رابطها بـ /p/team-
   • من كل صفحة: العنوان = الاسم، وأول صورة = الصورة، و.s24p-role = الصفة، وdata-order في .s24p = الترتيب
   • إضافة شخص = صفحة جديدة رابطها team-… بقالب الشخص (لا تعديل هنا ولا في القالب)
   • نسخة على جهاز الزائر ساعة واحدة (s24_team_v1)؛ الخلاصة مجانية ولا تستهلك أي حصة
   • التنسيق في s24-main.css تحت «فريق سوريا 24»
   ============================================================ */
(function () {
  var box = document.getElementById('s24-team');
  if (!box) return;

  var KEY = 's24_team_v1', TTL = 60 * 60 * 1000;

  function status(text) {
    box.innerHTML = '';
    var p = document.createElement('p');
    p.className = 's24team-status';
    p.textContent = text;
    box.appendChild(p);
  }

  // صورة بنسبة 16:9 بعرض مناسب للبطاقة
  function thumb(src) {
    if (!src) return '';
    if (/=[swh]\d+[^/]*$/.test(src)) return src.replace(/=[swh]\d+[^/]*$/, '=w640-h360-c');
    return src.replace(/\/(s\d+|w\d+-h\d+)[^/]*\//, '/w640-h360-c/');
  }

  // استخراج بيانات الأشخاص من خلاصة الصفحات
  function parse(feed) {
    var list = [];
    ((feed.feed || {}).entry || []).forEach(function (e) {
      var url = '';
      (e.link || []).forEach(function (l) { if (l.rel === 'alternate') url = l.href; });
      if (!/\/p\/team-[^\/]+\.html$/.test(url)) return;
      var doc = new DOMParser().parseFromString((e.content || {}).$t || '', 'text/html');
      var card = doc.querySelector('.s24p');
      var pic = doc.querySelector('img');
      var role = doc.querySelector('.s24p-role');
      list.push({
        url: url,
        name: (e.title || {}).$t || '',
        role: role ? role.textContent.trim() : '',
        img: pic ? thumb(pic.getAttribute('src')) : '',
        order: card ? Number(card.getAttribute('data-order')) || 999 : 999
      });
    });
    list.sort(function (a, b) { return a.order - b.order || a.name.localeCompare(b.name, 'ar'); });
    return list;
  }

  function render(list) {
    if (!list.length) { status('لا توجد بطاقات بعد.'); return; }
    box.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 's24team-grid';
    list.forEach(function (p) {
      var a = document.createElement('a');
      a.className = 's24team-card';
      a.href = p.url;
      var ph = document.createElement('div');
      ph.className = 's24team-photo';
      if (p.img) {
        var im = document.createElement('img');
        im.loading = 'lazy';
        im.alt = p.name;
        im.src = p.img;
        im.onerror = function () { im.remove(); };
        ph.appendChild(im);
      }
      a.appendChild(ph);
      var n = document.createElement('span');
      n.className = 's24team-name';
      n.textContent = p.name;
      a.appendChild(n);
      if (p.role) {
        var r = document.createElement('span');
        r.className = 's24team-role';
        r.textContent = p.role;
        a.appendChild(r);
      }
      grid.appendChild(a);
    });
    box.appendChild(grid);
  }

  try {
    var c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && Date.now() - c.t < TTL && Array.isArray(c.d)) { render(c.d); return; }
  } catch (e) {}

  fetch('/feeds/pages/default?alt=json&max-results=150')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (j) {
      var list = parse(j);
      try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: list })); } catch (e) {}
      render(list);
    })
    .catch(function (err) {
      console.error('[S24 Team]', err);
      status('تعذّر تحميل الفريق حالياً.');
    });
})();
