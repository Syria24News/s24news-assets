/* ============================================================
   S24News — صندوق "مقالات ذات صلة" في مقالات الموسوعة
   يقرأ عقدة glossaryRelations المبنية مسبقاً في Apps Script
   ============================================================ */
(function () {
  if (!document.body.classList.contains('s24-glossary-article')) return;

  var host = document.querySelector('[id^="post-body-"]');
  if (!host) return;

  var refs   = host.querySelector('.s24-enc-refs');
  var ending = host.querySelector('.s24-ending');
  if (!refs && !ending) return;

  var SRC   = 'https://s24n-views-default-rtdb.firebaseio.com/glossaryRelations.json';
  var KEY   = 's24_glossary_relations_cache';
  var TTL   = 6 * 60 * 60 * 1000;
  var ICONS = { bio: '👤', place: '📍', enc: '📄' };

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = String(str == null ? '' : str);
    return d.innerHTML;
  }

  function safePath(u) {
    try {
      var o = new URL(u, location.href);
      if (o.protocol !== 'http:' && o.protocol !== 'https:') return null;
      return o.pathname;
    } catch (e) { return null; }
  }

  function render(list) {
    var here = location.pathname;
    var rec  = null;
    (list || []).forEach(function (x) {
      if (!rec && x && x.u && safePath(x.u) === here) rec = x;
    });
    if (!rec || !rec.r || rec.r.length < 3) return;

    var html = '';
    rec.r.forEach(function (it) {
      if (!it || !it.u || !it.t || !safePath(it.u)) return;
      html += '<li><span class="s24-rel-ico">' + (ICONS[it.k] || ICONS.enc) + '</span>' +
              '<a href="' + esc(it.u) + '">' + esc(it.t) + '</a></li>';
    });
    if (!html) return;

    var box = document.createElement('div');
    box.className = 's24-enc-related';
    box.innerHTML = '<span class="s24-enc-box-title">مقالات ذات صلة</span><ul>' + html + '</ul>';

    if (refs) refs.parentNode.insertBefore(box, refs.nextSibling);
    else ending.parentNode.insertBefore(box, ending);
  }

  var cached = null;
  try {
    var rec = JSON.parse(localStorage.getItem(KEY));
    if (rec && (Date.now() - rec.timestamp) < TTL) cached = rec.data;
    else if (rec) localStorage.removeItem(KEY);
  } catch (e) {}

  if (cached) { render(cached); return; }

  fetch(SRC)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data && data.length) {
        try { localStorage.setItem(KEY, JSON.stringify({ timestamp: Date.now(), data: data })); } catch (e) {}
      }
      render(data);
    })
    .catch(function () {});
})();
