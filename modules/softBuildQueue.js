// modules/softQueue.js
(function () {
  'use strict';
  if (!/[\?&]screen=main\b/.test(location.search)) return;

  const $ = window.jQuery || window.$;
  if (!$) return;

  // --------- FAST BOOT GUARD ----------
  function onReady(fn, tries = 120) {
    const ok = () => window.BuildingMain && BuildingMain.buildings && $('#build_queue #buildqueue').length;
    if (ok()) return void fn();
    const t = setInterval(() => { if (ok() || --tries <= 0) { clearInterval(t); fn(); } }, 50);
  }

  // --------- CONFIG ----------
  const GREY_BG = '#eef0f1';
  const GREY_TXT = '#6c6c6c';
  const TICK_MIN_MS = 5000;      // low, only as a fallback; most triggers are event/observer based
  const STORAGE_KEY = (vid => `DSU:softQueue:v${vid}`)((window.game_data && game_data.village && game_data.village.id) || (location.search.match(/village=(\d+)/) || [])[1] || '0');
  const SOFT_ROW = 'dsu-soft-row';
  const SOFT_PROG = 'dsu-soft-prog';
  const ADD_BTN = 'dsu-soft-add';

  // --------- STATE I/O ----------
  const loadQ = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
  const saveQ = q => localStorage.setItem(STORAGE_KEY, JSON.stringify(q || []));
  const B = () => (window.BuildingMain && BuildingMain.buildings) || {};

  // --------- HELPERS ----------
  const curLv = id => parseInt(B()?.[id]?.level ?? 0, 10) || 0;

  function realQueuedCount(id) {
    const $rows = $('#build_queue #buildqueue tr[class*="buildorder_"]');
    let n = 0;
    $rows.each(function () {
      const cls = this.className || '';
      if (cls.includes(SOFT_ROW)) return;           // ignore our own
      const m = cls.match(/buildorder_([a-z_]+)/i);
      if (m && m[1] === id) n++;
    });
    return n;
  }

  function computeTargets(queue) {
    const softAdds = Object.create(null);
    return queue.map(item => {
      const id = item.id;
      softAdds[id] = (softAdds[id] || 0) + 1;
      const target = curLv(id) + realQueuedCount(id) + softAdds[id];
      return { ...item, targetLevel: target };
    });
  }

  function buildImgUrl(id, targetLevel) {
    try {
      const b = B()[id];
      const levels = b.image_levels || [5, 15];
      const idx = targetLevel >= (levels[1] ?? 9e9) ? 2 : (targetLevel >= (levels[0] ?? 5) ? 2 : 1);
      return `https://dsde.innogamescdn.com/asset/28bd5527/graphic/buildings/mid/${id}${idx}.webp`;
    } catch { return `https://dsde.innogamescdn.com/asset/28bd5527/graphic/buildings/main.png`; }
  }

  const fmtDur = s => {
    if (!s || s <= 0) return '—';
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
  };

  // rough per-level time estimate using factor; good enough for display
  function estNextTime(id, targetLevel) {
    const b = B()[id]; if (!b) return null;
    const base = +b.build_time || 0;
    const factor = +b.build_time_factor || 1;
    const nextIdx = targetLevel - (parseInt(b.level,10)||0);
    return Math.round(base * Math.max(1, Math.pow(factor, Math.max(0, nextIdx - 1))));
  }

  // --------- UI: "+ Soft" per building row (no prompt; +1) ----------
  function injectAddButtons() {
    $('#buildings tr[id^="main_buildrow_"]').each(function () {
      const id = this.id.replace('main_buildrow_', '');
      const $opts = $(this).find('.build_options');
      if (!$opts.length) return;
      if ($opts.find(`.${ADD_BTN}[data-building="${id}"]`).length) return;

      const $btn = $(`<a href="#" class="btn ${ADD_BTN}" data-building="${id}" title="Soft-Queue: +1">+ Soft</a>`).css({ marginLeft: 6 });
      $btn.on('click', e => { e.preventDefault(); const q = loadQ(); q.push({ id, at: Date.now() }); saveQ(q); renderInline(); scheduleTickSoon(); });
      const $anchor = $opts.find('.inactive.center');
      $anchor.length ? $anchor.after($btn) : $opts.append($btn);
    });
  }

  // --------- RENDER: inside normal queue ----------
  function clearSoftRows() {
    $('#build_queue #buildqueue').find(`tr.${SOFT_ROW}, tr.${SOFT_PROG}`).remove();
  }

  function renderInline() {
    const $tbody = $('#build_queue #buildqueue'); if (!$tbody.length) return;
    clearSoftRows();

    const q = loadQ();
    if (!q.length) return;

    const enriched = computeTargets(q);
    enriched.forEach((item, idx) => {
      const id = item.id;
      const b = B()[id] || {};
      const name = b.name || id;
      const lvl = item.targetLevel;
      const img = buildImgUrl(id, lvl);
      const dur = fmtDur(estNextTime(id, lvl));

      const tr1 = document.createElement('tr');
      tr1.className = `lit nodrag buildorder_${id} ${SOFT_ROW}`;
      Object.assign(tr1.style, { background: GREY_BG, color: GREY_TXT });

      tr1.innerHTML = `
        <td class="lit-item">
          <img src="${img}" class="bmain_list_img" data-title="${name}">
          ${name}<br>Stufe ${lvl}
        </td>
        <td class="nowrap lit-item"><span>${dur}</span></td>
        <td class="lit-item"></td>
        <td class="lit-item">—</td>
        <td class="lit-item">
          <a href="#" class="btn btn-cancel dsu-soft-cancel" data-i="${idx}">Abbrechen</a>
          <a href="#" class="btn dsu-soft-up" data-i="${idx}" style="margin-left:6px">↑</a>
          <a href="#" class="btn dsu-soft-dn" data-i="${idx}" style="margin-left:2px">↓</a>
        </td>
      `;

      const tr2 = document.createElement('tr');
      tr2.className = `lit ${SOFT_PROG}`;
      tr2.innerHTML = `
        <td colspan="5" style="padding:0;background:${GREY_BG}">
          <div class="order-progress">
            <div class="anim" style="width: 10%; background-color: #bdbdbd;"></div>
          </div>
        </td>
      `;

      $tbody.append(tr1);
      $tbody.append(tr2);
    });

    // bind handlers (cheap)
    $('#build_queue').off('click.dsu').on('click.dsu', 'a.dsu-soft-cancel', function (e) {
      e.preventDefault();
      const i = +this.dataset.i;
      const q = loadQ(); q.splice(i,1); saveQ(q); renderInline();
    }).on('click.dsu', 'a.dsu-soft-up', function (e) {
      e.preventDefault();
      const i = +this.dataset.i; const q = loadQ(); if (i>0){ const x=q[i]; q.splice(i,1); q.splice(i-1,0,x); saveQ(q); renderInline(); }
    }).on('click.dsu', 'a.dsu-soft-dn', function (e) {
      e.preventDefault();
      const i = +this.dataset.i; const q = loadQ(); if (i<q.length-1){ const x=q[i]; q.splice(i,1); q.splice(i+1,0,x); saveQ(q); renderInline(); }
    });
  }

  // --------- ENGINE (build when possible) ----------
  let tickTimeout = null;

  function scheduleTickAtFinish() {
    const $spans = $('#build_queue [data-endtime]');
    if (!$spans.length) return;
    const next = Math.min(...$spans.map((_, s) => +s.getAttribute('data-endtime') || 0).get());
    const delay = Math.max(0, (next - Math.floor(Date.now()/1000) + 1) * 1000);
    if (tickTimeout) clearTimeout(tickTimeout);
    tickTimeout = setTimeout(tick, delay);
  }

  function scheduleTickSoon() {
    if (tickTimeout) return; // one pending is enough
    tickTimeout = setTimeout(() => { tickTimeout = null; tick(); }, 400);
  }

  function queueFull() {
    // server-side authoritative count is exposed as BuildingMain.order_count
    return (window.BuildingMain?.order_count ?? 0) >= 2; // premium extends this; order_count reflects it automatically
  }

  async function tryBuildHead() {
    const q = loadQ(); if (!q.length) return false;
    if (queueFull()) return false;

    const head = q[0];
    const b = B()[head.id];
    if (!b) return false;

    // rely on server truth; client hint:
    // if (!b.can_build || b.error) keep trying later (resources/prereqs)
    const link = window.BuildingMain?.upgrade_building_link;
    if (!link) return false;

    try {
      // The game expects { building: id }
      const resp = await $.post(link, { building: head.id });
      // If the server accepted, remove the head and refresh inline view
      if (resp && (resp.success !== false)) {
        const q2 = loadQ(); q2.shift(); saveQ(q2);
        renderInline();
        // The page often updates queue automatically via returned scripts; still, re-scan images/rows:
        setTimeout(() => {
          // After backend accepts, ds updates order_count; re-render to show new target levels
          injectAddButtons(); renderInline(); scheduleTickAtFinish();
        }, 150);
        return true;
      }
    } catch (e) {
      // not enough resources / unmet prereqs – keep for later
    }
    return false;
  }

  async function tick() {
    tickTimeout = null;
    injectAddButtons(); // cheap and idempotent
    renderInline();

    if (!queueFull()) {
      await tryBuildHead();
    }
    // schedule smart next wake
    scheduleTickAtFinish();
    // also keep a low-frequency fallback
    setTimeout(() => !tickTimeout && (tickTimeout = setTimeout(() => { tickTimeout = null; tick(); }, TICK_MIN_MS)), 0);
  }

  // --------- OBSERVERS & HOOKS (fast, event-driven) ----------
  function hookAjax() {
    $(document).off('ajaxComplete.dsuSoft').on('ajaxComplete.dsuSoft', (_e, _xhr, settings) => {
      const url = settings?.url || '';
      if (url.includes('ajaxaction=upgrade_building') ||
          url.includes('ajaxaction=cancel_order') ||
          url.includes('screen=main')) {
        // queue likely changed
        injectAddButtons(); renderInline(); scheduleTickSoon();
      }
    });
  }

  function observeQueue() {
    const $tbody = $('#build_queue #buildqueue');
    if (!$tbody.length) return;
    const mo = new MutationObserver(() => { // only on real changes
      injectAddButtons(); renderInline(); scheduleTickSoon();
    });
    mo.observe($tbody[0], { childList: true, subtree: true });
  }

  // --------- BOOT ----------
  onReady(() => {
    // tiny CSS touch so our rows look native but slightly greyed
    const css = `
      #build_queue tr.${SOFT_ROW} td, #build_queue tr.${SOFT_PROG} td { color: ${GREY_TXT}; }
      #build_queue tr.${SOFT_ROW} { background: ${GREY_BG}; }
      #build_queue tr.${SOFT_PROG} { background: ${GREY_BG}; }
      .${ADD_BTN} { filter: grayscale(.2); }
    `;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    injectAddButtons();
    renderInline();
    hookAjax();
    observeQueue();
    tick(); // immediate first run
  });
})();
