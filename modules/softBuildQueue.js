// ==UserScript==
// @name         DSU Soft Build — Safe (Top Soft Queue + Exact Promote)
// @namespace    dsu
// @match        *://*.die-staemme.de/game.php*screen=main*
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  //temporarily deactivated
  return;
  // ---------- DEBUG ----------
  var DEBUG = true;
  var PFX = '[DSU-SoftBuild]';
  function log(){ if (DEBUG) try { console.log.apply(console, [PFX].concat([].slice.call(arguments))); } catch(_){ } }
  function warn(){ if (DEBUG) try { console.warn.apply(console, [PFX].concat([].slice.call(arguments))); } catch(_){ } }

  // ---------- ENV ----------
  var wrap = document.querySelector('#building_wrapper');
  if (!wrap) { return; }
  function getQueueBody() { return document.querySelector('#buildqueue'); }

  // ---------- STORAGE ----------
  function getParam(name){ try { return new URL(location.href).searchParams.get(name); } catch(_){ return null; } }
  var VILLAGE_ID = getParam('village') || 'global';
  function KEY(v){ return 'dsu_soft_queue_' + v; }
  function load(){
    try {
      var arr = JSON.parse(localStorage.getItem(KEY(VILLAGE_ID)) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch(_){ return []; }
  }
  function save(arr){ try { localStorage.setItem(KEY(VILLAGE_ID), JSON.stringify(arr)); } catch(_){ } }
  function sanitizeQueue(arr){
    arr = arr || load();
    var out = [];
    for (var i=0;i<arr.length;i++){
      var j = arr[i];
      if (!j || !j.building) continue;
      if (!(typeof j.levelNext === 'number' && isFinite(j.levelNext))) continue;
      // normalize snap
      j.snap = j.snap || {};
      if (!j.snap.name) j.snap.name = j.building;
      if (!j.snap.imgSrc) j.snap.imgSrc = guessImg(j.building);
      j.snap.secs = (Number(j.snap.secs) > 0) ? Number(j.snap.secs) : 60;
      out.push(j);
      if (out.length >= 30) break; // hard cap for safety
    }
    return out;
  }

  // ---------- FALLBACKS ----------
  var FALLBACK = {
    main:{name:'Hauptgebäude',img:'main1.webp'}, barracks:{name:'Kaserne',img:'barracks1.webp'},
    stable:{name:'Stall',img:'stable1.webp'}, garage:{name:'Werkstatt',img:'garage1.webp'},
    smith:{name:'Schmiede',img:'smith1.webp'}, market:{name:'Marktplatz',img:'market1.webp'},
    storage:{name:'Speicher',img:'storage1.webp'}, farm:{name:'Bauernhof',img:'farm1.webp'},
    wall:{name:'Wall',img:'wall1.webp'}, timber_camp:{name:'Holzfäller',img:'wood1.webp'},
    clay_pit:{name:'Lehmgrube',img:'stone1.webp'}, iron_mine:{name:'Eisenmine',img:'iron1.webp'},
    rally_point:{name:'Versammlungsplatz',img:'place1.webp'}, statue:{name:'Statue',img:'statue1.webp'},
    hiding_place:{name:'Versteck',img:'hide1.webp'}
  };
  var CDN_BASE = 'https://dsde.innogamescdn.com/asset/4b78fa77/graphic/buildings/mid/';
  function guessImg(b){ var f = FALLBACK[b]; return CDN_BASE + (f ? f.img : (b + '1.webp')); }

  // ---------- UTILS ----------
  function now(){ return (Date.now()/1000)|0; }
  function fmtHMS(secs){
    secs = Math.max(0, secs|0);
    var h = (secs/3600)|0, m = ((secs%3600)/60)|0, s = secs%60;
    return (h? h + ':' : '') + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }
  function fmtTodayTime(unix){
    var d = new Date(unix*1000);
    return 'heute um ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
  }
  function isVisible(el){
    if (!el) return false;
    if (el.offsetParent === null) return false;
    var cs = getComputedStyle(el);
    return cs && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  }

  // Try to extract a snapshot next to a real button
  function snapshotFromDom(btn, building){
    var row = btn.closest('tr') || document.querySelector('#main_buildrow_' + building);
    var name = building;
    if (row){
      var n1 = row.querySelector('.bmain_name');
      if (n1 && n1.textContent) name = n1.textContent.trim();
      else {
        var n2 = row.querySelector('strong');
        if (n2 && n2.textContent) name = n2.textContent.trim();
      }
    }
    if (FALLBACK[building] && (!name || name === building)) name = FALLBACK[building].name;

    var imgSrc = (row && row.querySelector('img.bmain_list_img') && row.querySelector('img.bmain_list_img').getAttribute('src')) || guessImg(building);

    // duration: try data attrs, then text like 1:23:45 or 12:34
    var secs = NaN;
    var ds = btn.dataset || {};
    secs = Number(ds.duration || ds.buildtime || ds.time);
    if (!isFinite(secs) || secs <= 0){
      var tcell = row && (row.querySelector('td:nth-child(2) span') || row.querySelector('.build_duration') || row.querySelector('.build_time'));
      var txt = tcell && tcell.textContent || '';
      var m = txt.match(/(?:(\d+):)?(\d{1,2}):(\d{2})/);
      if (m){
        secs = ((Number(m[1]||0)*60 + Number(m[2]))*60 + Number(m[3]))|0;
      }
    }
    if (!isFinite(secs) || secs <= 0) secs = 60;

    return { name: name || building, imgSrc: imgSrc, secs: secs };
  }

  function parseFromBtn(btn){
    var building = btn.getAttribute('data-building') || '';
    var levelNext = btn.getAttribute('data-level-next') || '';
    if (!building || !levelNext){
      var m = (btn.id || '').match(/^main_buildlink_([a-z_]+)_(\d+)$/);
      if (m){ if (!building) building = m[1]; if (!levelNext) levelNext = m[2]; }
    }
    return { building: building, levelNext: Number(levelNext) };
  }

  // ---------- ADD JOB ----------
  function addSoft(building, levelNext, snap){
    var q = sanitizeQueue(load());
    var job = {
      building: building,
      levelNext: levelNext,
      created: now(),
      status: 'pending',
      snap: {
        name: (snap && snap.name) || (FALLBACK[building] && FALLBACK[building].name) || building,
        imgSrc: (snap && snap.imgSrc) || guessImg(building),
        secs: (snap && Number(snap.secs) > 0 ? Number(snap.secs) : 60)
      }
    };
    q.unshift(job);
    save(q);
    try { if (window.UI && typeof UI.SuccessMessage === 'function') UI.SuccessMessage(job.snap.name + ' (Soft) hinzugefügt.'); } catch(_){}
    renderSoftOnTop();
    tryPromote();
  }

  // ---------- INJECT TWIN BUTTONS ----------
  function injectTwins(){
    var btns = document.querySelectorAll('a.btn.btn-build');
    for (var i=0;i<btns.length;i++){
      var btn = btns[i];
      if (btn.dataset.dsuTwinAdded === '1') continue;

      var parsed = parseFromBtn(btn);
      if (!parsed.building || !isFinite(parsed.levelNext)) continue;

      var twin = document.createElement('a');
      twin.className = 'btn dsu-soft-build';
      twin.href = '#';
      twin.textContent = (btn.textContent || '').trim();
      twin.style.marginLeft = '6px';
      twin.title = 'Soft in die Bauschleife einreihen';

      twin.addEventListener('click', function(sourceBtn){
        return function(e){
          e.preventDefault();
          var p = parseFromBtn(sourceBtn);
          if (!p.building || !isFinite(p.levelNext)){ warn('Twin click: cannot parse from', sourceBtn.id); return; }
          var snap = snapshotFromDom(sourceBtn, p.building);
          log('Twin clicked:', p, snap);
          addSoft(p.building, p.levelNext, snap);
        };
      }(btn));

      btn.insertAdjacentElement('afterend', twin);
      btn.dataset.dsuTwinAdded = '1';
      log('Injected twin for', btn.id || parsed.building);
    }
  }
  injectTwins();

  // Keep twins alive if DOM changes
  var moTwins = new MutationObserver(function(){
    try { injectTwins(); } catch(e){ warn('injectTwins() failed:', e); }
  });
  moTwins.observe(wrap, { childList:true, subtree:true });

  // ---------- RENDERER ----------
  var renderScheduled = false;
  function clearSoftRows(){
    var nodes = document.querySelectorAll('#buildqueue .dsu-soft-top, #buildqueue .dsu-soft-progress-top');
    for (var i=0;i<nodes.length;i++) nodes[i].remove();
  }

function findLastNativeRow(queueBody){
  var rows = queueBody.querySelectorAll('tr');
  var last = null;
  for (var i = rows.length - 1; i >= 0; i--) {
    var tr = rows[i];
    // skip header and our own soft rows
    if (tr.querySelector('th')) break;
    if (!tr.classList.contains('dsu-soft-top') &&
        !tr.classList.contains('dsu-soft-progress-top')) {
      last = tr;
      break;
    }
  }
  // if no native rows, fall back to header
  return last || queueBody.querySelector('tr');
}


  function renderSoftOnTop(){
    if (renderScheduled){ return; }
    renderScheduled = true;
    setTimeout(function(){
      renderScheduled = false;
      var queueBody = getQueueBody();
      if (!queueBody) { log('render: #buildqueue not present, skip draw'); return; }

      clearSoftRows();
      var jobs = sanitizeQueue(load()).filter(function(j){ return j.status !== 'done'; });
      if (!jobs.length) return;

      var header = queueBody.querySelector('tr');
      if (!header){ log('render: header row missing, skip'); return; }

      var anchor = findLastNativeRow(queueBody);   // <— instead of: var anchor = header;
var startT = now();

// We store with unshift (newest first). For FIFO display, render oldest→newest.
// Build a view with original indexes preserved for “Abbrechen”.
var jobsRaw = sanitizeQueue(load()).filter(function(j){ return j.status !== 'done'; });
if (!jobsRaw.length) return;

var jobsView = [];
for (var j = 0; j < jobsRaw.length; j++) jobsView.push({ job: jobsRaw[j], idx: j });
jobsView.reverse(); // oldest first

for (var v=0; v<jobsView.length; v++){
  var job = jobsView[v].job;
  var arrIdx = jobsView[v].idx; // original index in storage

  var name = job.snap && job.snap.name || job.building;
  var imgSrc = job.snap && job.snap.imgSrc || guessImg(job.building);
  var secs = (job.snap && Number(job.snap.secs) > 0) ? Number(job.snap.secs) : 60;
  var eta = startT + secs;

  var trp = document.createElement('tr');
  trp.className = 'lit dsu-soft-progress-top';
  trp.innerHTML = '<td colspan="5" style="padding:0"><div class="order-progress"><div class="anim" style="width:0%; background-color:#bbb"></div></div></td>';

  var tr = document.createElement('tr');
  tr.className = 'lit nodrag dsu-soft-top buildorder_' + job.building;
  tr.style.background = '#eee';
  tr.innerHTML =
    '<td class="lit-item">' +
      '<img src="'+ imgSrc +'" class="bmain_list_img" data-title="'+ name.replace(/"/g,'&quot;') +'">' +
      name + '<br>Stufe ' + job.levelNext +
    '</td>' +
    '<td class="nowrap lit-item"><span>'+ fmtHMS(secs) +'</span></td>' +
    '<td class="lit-item"></td>' +
    '<td class="lit-item">'+ fmtTodayTime(eta) +'</td>' +
    '<td class="lit-item"><a class="btn dsu-cancel-soft" data-i="'+ arrIdx +'" href="javascript:void(0)">Abbrechen</a></td>'

  anchor.after(trp);
  trp.after(tr);
  anchor = tr;
  startT = eta;
}


var cancels = queueBody.querySelectorAll('.dsu-cancel-soft');
for (var c = 0; c < cancels.length; c++) {
  (function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      e.stopPropagation();

      var idx = Number(a.getAttribute('data-i'));
      var arr = sanitizeQueue(load());
      if (idx >= 0 && idx < arr.length) {
        arr.splice(idx, 1);
        save(arr);
        renderSoftOnTop();
      }
      return false;
    }, true); // <-- capture phase
  })(cancels[c]);
}


    }, 50);
  }

  // re-render when the native queue changes
  var qb = getQueueBody();
  if (qb){
    var moQueue = new MutationObserver(function(){ try { renderSoftOnTop(); } catch(e){ warn('renderSoftOnTop failed:', e); } });
    moQueue.observe(qb, { childList:true, subtree:true });
  }

  // ---------- AUTO-PROMOTE ----------
  var promoteLock = false;
  function findExactButton(building, levelNext){
    var id = 'main_buildlink_' + building + '_' + levelNext;
    var el = document.getElementById(id);
    if (el && isVisible(el)) return el;
    return null;
  }
  function confirmPopupOpen(){
    // super-safe: check a few common containers/ids without :has()
    return !!(document.getElementById('confirm_popup') ||
              document.querySelector('.popup_box_container #confirm_popup') ||
              document.querySelector('.popup_box_container .confirmation') ||
              document.querySelector('#fpopup'));
  }
  function tryPromote(){
    if (promoteLock) return;
    var arr = sanitizeQueue(load());
    if (!arr.length) return;

    var job = arr[0];
    if (confirmPopupOpen()) return;

    var btn = findExactButton(job.building, job.levelNext);
    if (!btn) return;

    promoteLock = true;
    log('Promote (click real):', btn.id, job);
    try { btn.click(); } catch(e){ warn('btn.click failed:', e); }
    arr.shift();
    save(arr);
    renderSoftOnTop();
    setTimeout(function(){ promoteLock = false; }, 700);
  }

  // observe main wrapper to react to enable/disable of buttons
  var moPromote = new MutationObserver(function(){
    try { tryPromote(); } catch(e){ warn('tryPromote() failed:', e); }
  });
  moPromote.observe(wrap, { childList:true, subtree:true });

  var iv = setInterval(function(){ try { tryPromote(); } catch(e){ warn('tryPromote interval failed:', e); } }, 1800);
  window.addEventListener('beforeunload', function(){ try { clearInterval(iv); } catch(_){ } });

  // ---------- STYLE ----------
  var style = document.createElement('style');
  style.textContent =
    'a.dsu-soft-build{opacity:.95} a.dsu-soft-build:hover{opacity:1}' +
    '#buildqueue .dsu-soft-top td,#buildqueue .dsu-soft-progress-top td{background:#eee!important}' +
    '#buildqueue .dsu-soft-top .btn-cancel{background:#d5d5d5;border-color:#c2c2c2}' +
    '#buildqueue .dsu-soft-top img.bmain_list_img{filter:grayscale(.3)}';
  document.head.appendChild(style);

  // ---------- BOOT ----------
  renderSoftOnTop();

  // external API (optional)
  window.addEventListener('dsu:softqueue:add', function(ev){
    var d = (ev && ev.detail) || {};
    if (!d.building || !isFinite(d.levelNext)) return;
    addSoft(d.building, d.levelNext, null);
  });
})();
