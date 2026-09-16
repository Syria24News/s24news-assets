/* ══════════════════════════════════════════════════════════════
   encyclopedia.js — سلوك نظام الموسوعة في Syria24News
   يُستدعى من ودجت HTML930 في القالب:
   <script defer='defer' src='https://syria24news.github.io/s24news-assets/encyclopedia.js'></script>

   يشمل: حساب العمر الحي، مبدّل الخط القرآني، البحث داخل نص السورة،
   علامة القراءة، مشغّل التلاوة آية آية، تصنيف مقالات الفيديو، إخفاء الغلاف.
   ══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded',function(){
  function calcLiveAge(birthStr){
    var p=birthStr.split('-').map(Number);
    var birth=new Date(p[0],p[1]-1,p[2]);
    var today=new Date();
    var age=today.getFullYear()-birth.getFullYear();
    var had=(today.getMonth()>birth.getMonth())||
            (today.getMonth()===birth.getMonth()&&today.getDate()>=birth.getDate());
    if(!had)age--;
    return age;
  }
  document.querySelectorAll('.s24-live-age[data-birth]').forEach(function(el){
    var age=calcLiveAge(el.getAttribute('data-birth'));
    if(!isNaN(age))el.textContent=age;
  });

  /* ═══ حاوية أدوات القراءة الموحّدة ═══
     شريط واحد بثلاث أيقونات: بحث، خط، تلاوة.
     على الحاسوب فوق النص، وعلى الجوال ملتصق بأسفل الشاشة ويختفي مع التمرير. */
  var quranHost=document.querySelector('.s24-quran-text');
  var S24Tools=null;

  /* تنظيف وقائي: أي صفحة بلا نص قرآني تُزيل عنها آثار صفحات سابقة
     (قد ترثها من ذاكرة الرجوع في المتصفح فتخفي صور القوائم) */
  if(!quranHost){
    document.body.classList.remove('s24-quran-text-page','s24-has-enc-video');
  }

  if(quranHost){
    S24Tools=(function(){
      var wrap=document.createElement('div');
      wrap.className='s24-tools';
      var tabs=document.createElement('div'); tabs.className='s24-tools-tabs';
      var panels=document.createElement('div'); panels.className='s24-tools-panels';
      wrap.appendChild(panels); wrap.appendChild(tabs);

      var anchor=document.querySelector('.s24-quran-basmala')||quranHost;
      anchor.parentNode.insertBefore(wrap,anchor);

      var items=[];
      function open(id){
        items.forEach(function(it){
          var on=(it.id===id);
          it.btn.classList.toggle('on',on);
          it.panel.classList.toggle('on',on);
        });
        wrap.classList.toggle('is-open', !!id);
      }
      var ORDER={audio:1,search:2,font:3};
      function add(id,icon,label,panel){
        panel.classList.add('s24-tools-panel');
        panels.appendChild(panel);
        var b=document.createElement('button');
        b.type='button'; b.className='s24-tools-btn';
        b.setAttribute('aria-label',label);
        b.innerHTML='<span class="ico">'+icon+'</span><span class="lbl">'+label+'</span>';
        b.addEventListener('click',function(){
          open(b.classList.contains('on')?null:id);
        });
        b.style.order=ORDER[id]||9;
        tabs.appendChild(b);
        items.push({id:id,btn:b,panel:panel});
      }

      /* الجوال: إخفاء الشريط عند التمرير لأسفل وإظهاره عند التمرير لأعلى */
      var lastY=window.pageYOffset, ticking=false;
      window.addEventListener('scroll',function(){
        if(ticking) return; ticking=true;
        requestAnimationFrame(function(){
          var y=window.pageYOffset, d=y-lastY;
          if(Math.abs(d)>6 && !wrap.classList.contains('is-open')){
            wrap.classList.toggle('is-hidden', d>0 && y>160);
          }
          lastY=y; ticking=false;
        });
      },{passive:true});

      /* الحاسوب: إخفاء الشريط تدريجياً بمجرد تجاوز نهاية المقال،
         بدل تركه عائماً فوق الفوتر أو محاولة تثبيته هناك. */
      var dockContainer=document.querySelector('.s24-enc-body');
      function checkArticleEnd(){
        if(window.innerWidth<769 || !dockContainer) return;
        var past=dockContainer.getBoundingClientRect().bottom<=window.innerHeight;
        wrap.classList.toggle('s24-tools-past-end',past);
      }
      checkArticleEnd();
      window.addEventListener('scroll',checkArticleEnd,{passive:true});
      window.addEventListener('resize',checkArticleEnd);

      /* الحاسوب: محاذاة عرض وموضع الشريط ليبقى ضمن حدود العمود الأوسط
         (main-container) بمسافة عن حافتيه، بدل الامتداد فوق الشريطين الجانبيين. */
      var mainCol=document.querySelector('.main-container');
      var TOOLS_INSET=28;
      function alignDesktop(){
        if(window.innerWidth<769 || !mainCol){
          wrap.style.left=''; wrap.style.width=''; wrap.style.transform='';
          return;
        }
        var r=mainCol.getBoundingClientRect();
        var w=r.width-TOOLS_INSET*2;
        if(w<280) w=280;
        wrap.style.left=(r.left+TOOLS_INSET)+'px';
        wrap.style.width=w+'px';
        wrap.style.transform='none';
      }
      alignDesktop();
      window.addEventListener('resize',alignDesktop);

      return {add:add, open:open, wrap:wrap, tabs:tabs};
    })();
  }

  /* مبدّل الخط القرآني */
  if(quranHost){
    var FONTS=[['amiri','أميري'],['scheherazade','شهرزاد'],['naskh','نسخ'],['lateef','لطيف'],['system','تقليدي']];
    var saved=null;
    try{ saved=localStorage.getItem('s24_quran_font'); }catch(e){}
    if(!saved) saved='amiri';

    function applyFont(id){
      FONTS.forEach(function(f){ document.body.classList.remove('s24-font-'+f[0]); });
      document.body.classList.add('s24-font-'+id);
      try{ localStorage.setItem('s24_quran_font',id); }catch(e){}
      box.querySelectorAll('button').forEach(function(b){
        b.classList.toggle('on', b.getAttribute('data-font')===id);
      });
    }

    var box=document.createElement('div');
    box.className='s24-font-switch';
    box.innerHTML='<b>الخط:</b>';
    FONTS.forEach(function(f){
      var b=document.createElement('button');
      b.type='button';
      b.setAttribute('data-font',f[0]);
      b.textContent=f[1];
      b.addEventListener('click',function(){ applyFont(f[0]); });
      box.appendChild(b);
    });
    S24Tools.add('font','\u0623','الخط',box);
    applyFont(saved);
  }

  /* البحث في النص وحفظ موضع القراءة */
  if(quranHost){
    document.body.classList.add('s24-quran-text-page');
    window.addEventListener('pagehide',function(){
      document.body.classList.remove('s24-quran-text-page','s24-has-enc-video');
    });
    /* إخفاء الغلاف مباشرة على العنصر — أقوى من أي CSS */
    (function(){
      function hideCover(){
        /* الإخفاء محصور في جسم المقالة وحدها، فلا يمسّ صور القوائم */
        var scope=(quranHost.closest && quranHost.closest('.post-body'))||quranHost.parentNode;
        if(!scope) return;
        scope.querySelectorAll('.s24-cover-injected').forEach(function(el){
          el.style.setProperty('display','none','important');
        });
      }
      hideCover();
      setTimeout(hideCover,300);
      setTimeout(hideCover,1200);
    })();
    var ayas=[].slice.call(quranHost.querySelectorAll('.s24-aya'));
    if(ayas.length){
      var KEY='s24_quran_pos_'+location.pathname;

      function norm(t){
        return (t||'')
          .replace(/[\u064B-\u0652\u0670\u0653-\u0655\u06D6-\u06ED\u0640]/g,'')
          .replace(/[\u0622\u0623\u0625\u0671]/g,'\u0627')
          .replace(/\u0649/g,'\u064A')
          .replace(/\u0629/g,'\u0647')
          .replace(/\s+/g,' ').trim();
      }
      ayas.forEach(function(a){
        var c=a.cloneNode(true);
        var n=c.querySelector('.s24-ayanum'); if(n) n.remove();
        a.setAttribute('data-plain', norm(c.textContent));
      });

      var bar=document.createElement('div');
      bar.className='s24-quran-bar';
      bar.innerHTML='<input type="search" placeholder="ابحث في نص السورة…"/>'
                  + '<button type="button" data-a="prev">السابق</button>'
                  + '<button type="button" data-a="next">التالي</button>'
                  + '<span class="s24-hit-count"></span>';
      S24Tools.add('search','\u2315','البحث',bar);

      var inp=bar.querySelector('input');
      var cnt=bar.querySelector('.s24-hit-count');
      var btnNext=bar.querySelector('[data-a="next"]');
      var btnPrev=bar.querySelector('[data-a="prev"]');
      var hits=[], idx=-1;

      function arNum(n){ return String(n).replace(/[0-9]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'[d];}); }

      function updateCount(){
        if(!hits.length){ cnt.textContent = (inp.value||'').trim().length>1 ? 'لا نتائج' : ''; }           
        else{ cnt.textContent = (idx+1)+' من '+hits.length; }      
        btnNext.disabled = btnPrev.disabled = hits.length<2;
      }
      function goTo(el){
        if(!el) return;
        ayas.forEach(function(a){ a.classList.remove('is-current'); });
        el.classList.add('is-current');
        el.scrollIntoView({behavior:'smooth',block:'center'});
      }
      function clearAll(){
        ayas.forEach(function(a){ a.classList.remove('is-hit','is-current'); });
      }
      function runSearch(){
        var q=norm(inp.value);
        clearAll();
        hits=[]; idx=-1;
        if(q.length<2){ updateCount(); return; }
        ayas.forEach(function(a){
          if(a.getAttribute('data-plain').indexOf(q)>-1){
            a.classList.add('is-hit');
            hits.push(a);
          }
        });
        if(hits.length){ idx=0; goTo(hits[0]); }
        updateCount();
      }
      function step(d){
        if(!hits.length) return;
        idx=(idx+d+hits.length)%hits.length;
        goTo(hits[idx]);
        updateCount();
      }
      var tmr;
      inp.addEventListener('input',function(){ clearTimeout(tmr); tmr=setTimeout(runSearch,250); });
      inp.addEventListener('keydown',function(e){
        if(e.key==='Enter'){ e.preventDefault(); step(e.shiftKey?-1:1); }
        if(e.key==='Escape'){ inp.value=''; runSearch(); inp.blur(); }
      });
      btnNext.addEventListener('click',function(){ step(1); });
      btnPrev.addEventListener('click',function(){ step(-1); });
      document.addEventListener('keydown',function(e){
        if(!hits.length) return;
        if(document.activeElement===inp) return;
        if(e.key==='ArrowLeft'){ step(1); }
        if(e.key==='ArrowRight'){ step(-1); }
      });
      updateCount();

      /* ═══ مشغّل التلاوة آية آية ═══ */
      (function(){
        var sura = parseInt(quranHost.getAttribute('data-sura'),10);
        if(!sura) return;                       /* يحتاج data-sura على الحاوية */

        var RECITERS=[
          ['Alafasy_128kbps','مشاري العفاسي'],
          ['Husary_128kbps','محمود خليل الحصري'],
          ['Abdul_Basit_Murattal_192kbps','عبد الباسط عبد الصمد (مرتّل)'],
          ['Minshawy_Murattal_128kbps','محمد صديق المنشاوي'],
          ['Abdurrahmaan_As-Sudais_192kbps','عبد الرحمن السديس'],
          ['Saood_ash-Shuraym_128kbps','سعود الشريم']
        ];
        var REPEAT_OPTIONS=[
          ['0','بلا تكرار'],
          ['2','تكرار الآية مرتين'],
          ['3','تكرار الآية ٣ مرات'],
          ['5','تكرار الآية ٥ مرات'],
          ['99','تكرار الآية بلا حد'],
          ['sura','إعادة السورة عند انتهائها']
        ];
        var RKEY='s24_quran_reciter';
        var reciter=null;
        try{ reciter=localStorage.getItem(RKEY); }catch(e){}
        if(!reciter||!RECITERS.some(function(r){return r[0]===reciter;})) reciter=RECITERS[0][0];

        var pad=function(n,l){ n=String(n); while(n.length<l) n='0'+n; return n; };
        function url(a){ return 'https://everyayah.com/data/'+reciter+'/'+pad(sura,3)+pad(a,3)+'.mp3'; }

        var au=new Audio();
        au.preload='auto';
        var pre=new Audio(); pre.preload='auto';
        var cur=0, playing=false, retryLeft=0;

        var abar=document.createElement('div');
        abar.className='s24-audio-bar';
        var opts=RECITERS.map(function(r){
          return '<li role="option" data-value="'+r[0]+'" aria-selected="'+(r[0]===reciter?'true':'false')+'" tabindex="-1">'+r[1]+'</li>';
        }).join('');
        var curReciter=(RECITERS.filter(function(r){return r[0]===reciter;})[0]||RECITERS[0]);
        var repOpts=REPEAT_OPTIONS.map(function(r){
          return '<li role="option" data-value="'+r[0]+'" aria-selected="'+(r[0]==='0'?'true':'false')+'" tabindex="-1">'+r[1]+'</li>';
        }).join('');
        abar.innerHTML='<button type="button" class="main" data-a="play">▶ تشغيل</button>'
                     + '<button type="button" data-a="prev">السابقة</button>'
                     + '<button type="button" data-a="next">التالية</button>'
                     + '<div class="s24-reciter-dd">'
                     +   '<button type="button" class="s24-reciter-dd-btn" aria-haspopup="listbox" aria-expanded="false">'
                     +     '<span class="s24-reciter-dd-label">'+curReciter[1]+'</span>'
                     +     '<span class="s24-reciter-dd-arrow">\u25BE</span>'
                     +   '</button>'
                     +   '<ul class="s24-reciter-dd-list" role="listbox" aria-label="اختيار القارئ" hidden>'+opts+'</ul>'
                     + '</div>'
                     + '<select class="s24-repeat" hidden>'
                     +   '<option value="0">بلا تكرار</option>'
                     +   '<option value="2">تكرار الآية مرتين</option>'
                     +   '<option value="3">تكرار الآية ٣ مرات</option>'
                     +   '<option value="5">تكرار الآية ٥ مرات</option>'
                     +   '<option value="99">تكرار الآية بلا حد</option>'
                     +   '<option value="sura">إعادة السورة عند انتهائها</option>'
                     + '</select>'
                     + '<div class="s24-repeat-dd">'
                     +   '<button type="button" class="s24-repeat-dd-btn" aria-haspopup="listbox" aria-expanded="false">'
                     +     '<span class="s24-repeat-dd-label">بلا تكرار</span>'
                     +     '<span class="s24-repeat-dd-arrow">\u25BE</span>'
                     +   '</button>'
                     +   '<ul class="s24-repeat-dd-list" role="listbox" aria-label="عدد مرات التكرار" hidden>'+repOpts+'</ul>'
                     + '</div>'
                     + '<span class="s24-audio-vol">'
                     +   '<button type="button" data-a="mute" title="كتم/تشغيل الصوت">\uD83D\uDD0A</button>'
                     +   '<input type="range" min="0" max="100" step="5" value="100" aria-label="مستوى الصوت"/>'
                     + '</span>'
                     + '<span class="s24-audio-state"></span>'
                     + '<span class="s24-audio-credit">التلاوة من <a href="https://everyayah.com" rel="nofollow" target="_blank">everyayah.com</a> — الحقوق لأصحابها، والاستعمال لغرض التلاوة والحفظ.</span>';
        S24Tools.add('audio','\u25B6','التلاوة',abar);

        /* مستوى الصوت — يُحفظ في متصفح القارئ */
        var VKEY='s24_quran_vol';
        var vol=100, muted=false;
        try{ var sv=localStorage.getItem(VKEY); if(sv!==null) vol=Math.max(0,Math.min(100,+sv)); }catch(e){}

        var bPlay=abar.querySelector('[data-a="play"]');
        var ddBtn=abar.querySelector('.s24-reciter-dd-btn');
        var ddLabel=abar.querySelector('.s24-reciter-dd-label');
        var ddList=abar.querySelector('.s24-reciter-dd-list');
        var ddItems=Array.prototype.slice.call(abar.querySelectorAll('.s24-reciter-dd-list li'));
        var rep=abar.querySelector('.s24-repeat');
        var repLeft=0;
        var bMute=abar.querySelector('[data-a="mute"]');
        var rngVol=abar.querySelector('.s24-audio-vol input');

        function applyVol(){
          au.volume = muted ? 0 : (vol/100);
          if(rngVol) rngVol.value = muted ? 0 : vol;
          if(bMute) bMute.textContent = (muted||vol===0) ? '\uD83D\uDD07' : (vol<50 ? '\uD83D\uDD09' : '\uD83D\uDD0A');
        }
        if(rngVol) rngVol.addEventListener('input',function(){
          vol=+this.value; muted=(vol===0);
          try{ localStorage.setItem(VKEY,vol); }catch(e){}
          applyVol();
        });
        if(bMute) bMute.addEventListener('click',function(){
          muted=!muted;
          if(!muted && vol===0){ vol=70; try{ localStorage.setItem(VKEY,vol); }catch(e){} }
          applyVol();
        });
        applyVol();
        var st=abar.querySelector('.s24-audio-state');

        function mark(n){
          ayas.forEach(function(a){ a.classList.remove('is-playing'); });
          var el=document.getElementById('aya-'+n);
          if(el){
            el.classList.add('is-playing');
            var r=el.getBoundingClientRect();
            if(r.top<120||r.bottom>window.innerHeight-80){
              el.scrollIntoView({behavior:'smooth',block:'center'});
            }
          }
        }
        function session(n){
          if(!('mediaSession' in navigator)) return;
          var nm=RECITERS.filter(function(r){return r[0]===reciter;})[0];
          try{
            navigator.mediaSession.metadata=new MediaMetadata({
              title:'الآية '+n,
              artist:nm?nm[1]:'',
              album:document.title.replace(' (النص الكامل)',''),
            });
            navigator.mediaSession.setActionHandler('play',function(){ play(cur); });
            navigator.mediaSession.setActionHandler('pause',pause);
            navigator.mediaSession.setActionHandler('previoustrack',function(){ play(Math.max(1,cur-1)); });
            navigator.mediaSession.setActionHandler('nexttrack',function(){ play(cur+1); });
          }catch(e){}
        }
        function last(){ return ayas.length?+ayas[ayas.length-1].getAttribute('data-n'):1; }

        function play(n,keepRepeat,isRetry){
          if(n<1) n=1;
          if(n>last()){ stop(); return; }
          if(!keepRepeat){
            var m=rep.value;
            repLeft=(m==='0'||m==='sura')?0:parseInt(m,10);
          }
          cur=n;
          if(!isRetry) retryLeft=3;   /* عدد محاولات إعادة الاتصال عند انقطاع الشبكة */
          au.src=url(n);
          applyVol();
          au.play().then(function(){
            retryLeft=3;
            playing=true; bPlay.textContent='⏸ إيقاف';
            st.textContent='الآية '+n+' / '+last()+(repLeft>1?' — تكرار '+repLeft:'');
            mark(n); session(n);
            if(n<last()){ pre.src=url(n+1); }   /* تحميل مسبق للآية التالية */
          }).catch(function(){
            retryFail();
          });
        }
        function retryFail(){
          if(retryLeft>0){
            retryLeft--;
            st.textContent='انقطع الاتصال — إعادة المحاولة...';
            setTimeout(function(){ play(cur,true,true); },1200);
          }else{
            st.textContent='تعذّر التشغيل — تحقق من اتصال الإنترنت';
          }
        }
        function pause(){ au.pause(); playing=false; bPlay.textContent='▶ تشغيل'; }
        function stop(){
          pause(); cur=0; st.textContent='انتهت السورة';
          ayas.forEach(function(a){ a.classList.remove('is-playing'); });
        }
        au.addEventListener('ended',function(){
          var mode=rep.value;
          if(mode!=='0' && mode!=='sura'){
            if(repLeft>1){ repLeft--; play(cur,true); return; }
          }
          if(cur>=last() && mode==='sura'){ play(1); return; }
          play(cur+1);
        });
        au.addEventListener('error',function(){
          retryFail();
        });

        bPlay.addEventListener('click',function(){
          if(playing) pause();
          else play(cur||1);
        });
        abar.querySelector('[data-a="next"]').addEventListener('click',function(){ play((cur||0)+1); });
        abar.querySelector('[data-a="prev"]').addEventListener('click',function(){ play(Math.max(1,(cur||2)-1)); });
        rep.addEventListener('change',function(){
          var m=this.value;
          repLeft=(m==='0'||m==='sura')?0:parseInt(m,10);
        });

        /* القائمة المخصّصة لعدد مرات التكرار — نفس معالجة قائمة القارئ،
           مع إبقاء select الأصلي مخفياً كمخزن للقيمة فقط (rep.value) كي لا
           يتطلّب الأمر تعديل بقية الكود الذي يقرأ منه مباشرة. */
        var repDdBtn=abar.querySelector('.s24-repeat-dd-btn');
        var repDdLabel=abar.querySelector('.s24-repeat-dd-label');
        var repDdList=abar.querySelector('.s24-repeat-dd-list');
        var repDdItems=Array.prototype.slice.call(abar.querySelectorAll('.s24-repeat-dd-list li'));
        function repDdClose(){
          repDdList.hidden=true;
          repDdBtn.setAttribute('aria-expanded','false');
          S24Tools.wrap.classList.remove('s24-dd-open');
        }
        function repDdOpen(){
          if(typeof ddClose==='function') ddClose();
          repDdList.hidden=false;
          repDdBtn.setAttribute('aria-expanded','true');
          S24Tools.wrap.classList.add('s24-dd-open');
          var active=repDdItems.filter(function(li){return li.getAttribute('aria-selected')==='true';})[0]||repDdItems[0];
          if(active) active.focus();
        }
        function selectRepeat(value){
          rep.value=value;
          repLeft=(value==='0'||value==='sura')?0:parseInt(value,10);
          repDdItems.forEach(function(li){
            var on=(li.getAttribute('data-value')===value);
            li.setAttribute('aria-selected',on?'true':'false');
            if(on) repDdLabel.textContent=li.textContent;
          });
        }
        repDdBtn.addEventListener('click',function(){
          if(repDdList.hidden) repDdOpen(); else repDdClose();
        });
        repDdItems.forEach(function(li){
          li.addEventListener('click',function(){
            selectRepeat(li.getAttribute('data-value'));
            repDdClose(); repDdBtn.focus();
          });
        });
        repDdList.addEventListener('keydown',function(e){
          var idx=repDdItems.indexOf(document.activeElement);
          if(e.key==='ArrowDown'){ e.preventDefault(); (repDdItems[(idx+1)%repDdItems.length]||repDdItems[0]).focus(); }
          else if(e.key==='ArrowUp'){ e.preventDefault(); (repDdItems[(idx-1+repDdItems.length)%repDdItems.length]||repDdItems[0]).focus(); }
          else if(e.key==='Enter'||e.key===' '){ e.preventDefault(); selectRepeat(document.activeElement.getAttribute('data-value')); repDdClose(); repDdBtn.focus(); }
          else if(e.key==='Escape'){ repDdClose(); repDdBtn.focus(); }
        });
        document.addEventListener('click',function(e){
          if(!repDdList.hidden && !abar.contains(e.target)) repDdClose();
        });
        /* القائمة المخصّصة لاختيار القارئ — بديل عن select الأصلية لضمان
           التحكم الكامل بلون التظليل (بدل الأزرق الافتراضي للمتصفح) */
        function ddClose(){
          ddList.hidden=true;
          ddBtn.setAttribute('aria-expanded','false');
          S24Tools.wrap.classList.remove('s24-dd-open');   /* استعادة overflow:hidden الأصلي */
        }
        function ddOpen(){
          if(typeof repDdClose==='function') repDdClose();
          ddList.hidden=false;
          ddBtn.setAttribute('aria-expanded','true');
          S24Tools.wrap.classList.add('s24-dd-open');   /* تعطيل overflow:hidden مؤقتاً كي لا تُقصّ القائمة */
          var active=ddItems.filter(function(li){return li.getAttribute('aria-selected')==='true';})[0]||ddItems[0];
          if(active) active.focus();
        }
        function selectReciter(value){
          reciter=value;
          ddItems.forEach(function(li){
            var on=(li.getAttribute('data-value')===value);
            li.setAttribute('aria-selected',on?'true':'false');
            if(on) ddLabel.textContent=li.textContent;
          });
          try{ localStorage.setItem(RKEY,reciter); }catch(e){}
          if(playing) play(cur); else st.textContent='القارئ: '+ddLabel.textContent;
        }
        ddBtn.addEventListener('click',function(){
          if(ddList.hidden) ddOpen(); else ddClose();
        });
        ddItems.forEach(function(li){
          li.addEventListener('click',function(){
            selectReciter(li.getAttribute('data-value'));
            ddClose(); ddBtn.focus();
          });
        });
        ddList.addEventListener('keydown',function(e){
          var idx=ddItems.indexOf(document.activeElement);
          if(e.key==='ArrowDown'){ e.preventDefault(); (ddItems[(idx+1)%ddItems.length]||ddItems[0]).focus(); }
          else if(e.key==='ArrowUp'){ e.preventDefault(); (ddItems[(idx-1+ddItems.length)%ddItems.length]||ddItems[0]).focus(); }
          else if(e.key==='Enter'||e.key===' '){ e.preventDefault(); selectReciter(document.activeElement.getAttribute('data-value')); ddClose(); ddBtn.focus(); }
          else if(e.key==='Escape'){ ddClose(); ddBtn.focus(); }
        });
        document.addEventListener('click',function(e){
          if(!ddList.hidden && !abar.contains(e.target)) ddClose();
        });
        /* الضغط على أي آية يبدأ التلاوة منها */
        ayas.forEach(function(a){
          a.addEventListener('click',function(){
            play(+a.getAttribute('data-n'));
          });
        });
        st.textContent='عدد الآيات: '+last();
      })();

      /* علامة القراءة — حفظ آلي أثناء التمرير */
      function topAya(){
        var cur=ayas[0];
        for(var i=0;i<ayas.length;i++){
          if(ayas[i].getBoundingClientRect().top>140) break;
          cur=ayas[i];
        }
        return cur;
      }
      function markSaved(n){
        ayas.forEach(function(a){ a.classList.remove('is-marked'); });
        var el=document.getElementById('aya-'+n);
        if(el) el.classList.add('is-marked');
      }

      var resumeBtn=null;
      function buildResume(n){
        if(resumeBtn){ resumeBtn.remove(); resumeBtn=null; }
        if(!n || +n<2) return;
        resumeBtn=document.createElement('button');
        resumeBtn.type='button'; resumeBtn.className='s24-resume';
        resumeBtn.style.order=0;
        resumeBtn.innerHTML='<span class="ico">\u21A9</span><span class="num">'+n+'</span>';
        resumeBtn.title='متابعة القراءة من الآية '+n;
        resumeBtn.addEventListener('click',function(){
          var el=document.getElementById('aya-'+n);
          if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
        });
        S24Tools.tabs.appendChild(resumeBtn);
      }

      var savedPos=null;
      try{ savedPos=localStorage.getItem(KEY); }catch(e){}
      if(savedPos){ markSaved(savedPos); buildResume(savedPos); }

      var saveTmr;
      window.addEventListener('scroll',function(){
        clearTimeout(saveTmr);
        saveTmr=setTimeout(function(){
          var r=quranHost.getBoundingClientRect();
          if(r.top>200 || r.bottom<200) return;   // خارج النص: لا نحفظ
          var n=topAya().getAttribute('data-n');
          try{ localStorage.setItem(KEY,n); }catch(e){}
          markSaved(n);
        },600);
      },{passive:true});
    }
  }

  var encVideo=document.querySelector('.s24-enc-video');
  if(encVideo){
    document.body.classList.add('s24-has-enc-video');
    document.body.classList.add('s24-video-article');
    encVideo.classList.add('separator','s24-lead-video-wrapper');
    var ifr=encVideo.querySelector('iframe');
    if(ifr && /youtube\.com\/embed/.test(ifr.getAttribute('src')||'')){
      ifr.classList.add('s24-lead-video-iframe');
    }
  }
});
