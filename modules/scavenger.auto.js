// ==UserScript==
// @name         DS → Scavenger Auto (Button only, safe delay)
// @version      1.2.0
// @description  Ein einziger Auto-Button: periodisch planen+füllen+klicken (free) mit harter 1 s Sicherheits-Delay zwischen ALLEN Aktionen. Benötigt DS → Scavenger Calculator.
// @author       SpeckMich
// @match        https://*.die-staemme.de/game.php?*&screen=place&mode=scavenge*
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ---------- config ---------- */
  const AUTO_KEY          = 'dsu_scavenger_auto_enabled';
  const AUTO_INTERVAL_MS  = 30_000;   // periodische Runde
  const STEP_DELAY_MS     = 1000;     // Harter Delay zwischen JEDEM Aktionsschritt
  const POST_FINISH_DELAY = 1500;     // kleiner Sicherheitspuffer vor Reload
  const MAX_REASONABLE_MS = 8 * 3600_000;

  /* ---------- tiny utils ---------- */
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.opacity !== '0';
  }

  function parseHMS(t) {
    const m = String(t||'').trim().match(/^(\d+):(\d{2}):(\d{2})$/);
    if (!m) return null;
    return (+m[1])*3600 + (+m[2])*60 + (+m[3]);
  }

  function getMinCountdownMs() {
    let min=null;
    document.querySelectorAll('.scavenge-option .active-view .return-countdown').forEach(el=>{
      const sec=parseHMS(el.textContent);
      if(sec==null)return;
      if(min==null||sec<min)min=sec;
    });
    if(min==null)return null;
    const ms=(min*1000)+STEP_DELAY_MS;
    if(ms<=0||ms>MAX_REASONABLE_MS)return null;
    return ms;
  }

  function forceReload() {
    try {
      const url = new URL(location.href);
      url.searchParams.set('_tmr', Date.now());
      location.replace(url.toString());
    } catch {
      location.href = location.href;
    }
  }

  /* ---------- global action queue (1 s between ALL actions) ---------- */
  let queue = Promise.resolve();
  function perform(label, fn) {
    // every action waits STEP_DELAY_MS from the previous action, then runs, then waits again
    queue = queue
      .then(() => sleep(STEP_DELAY_MS))
      .then(async () => {
        try { await fn(); } catch (e) { console.warn('[ScavengerAuto]', label, 'error:', e); }
      })
      .then(() => sleep(STEP_DELAY_MS));
    return queue;
  }

  /* ---------- state ---------- */
  let autoEnabled = JSON.parse(localStorage.getItem(AUTO_KEY) || 'false');
  let runningLoop = false;
  let cancelLoop  = false;
  let reloadTmo   = null;

  function scheduleNextReload() {
    if (reloadTmo) clearTimeout(reloadTmo);
    const ms = getMinCountdownMs();
    if (ms == null) return;

    reloadTmo = setTimeout(async () => {
      const recheck = getMinCountdownMs();
      if (recheck != null && recheck > 2500) { scheduleNextReload(); return; }
      await sleep(POST_FINISH_DELAY);
      // reload also goes through the queue → 1s spacing is honored
      await perform('reload', () => forceReload());
    }, ms);
  }

  /* ---------- core ---------- */
  async function clickVisibleFreeButtonsBackToFront() {
    const all = Array.from(document.querySelectorAll('.scavenge-option .free_send_button'));
    const visible = all.filter(isVisible);

    for (let i = visible.length - 1; i >= 0; i--) {
      const btn = visible[i];
      if (!isVisible(btn)) continue;
      await perform('click send', () => btn.click());
    }
  }

  async function runAutoOnce() {
    if (!autoEnabled) return;
    if (!window.DSScavenger || !window.DSScavenger.isReady()) return;

    // compute + fill next slot (queued)
    await perform('computeAndFillNext', () => window.DSScavenger.computeAndFillNext());

    // click visible send buttons (each click queued with 1s gap)
    await clickVisibleFreeButtonsBackToFront();

    // re-schedule reload (queued gap included)
    await perform('scheduleNextReload', () => scheduleNextReload());
  }

  async function loop() {
    if (runningLoop) return;
    runningLoop = true;
    cancelLoop  = false;

    // do an immediate cycle first
    await runAutoOnce();

    while (!cancelLoop && autoEnabled) {
      // Wait the cycle interval in queue to avoid overlapping with other actions
      await perform('cycle-wait', () => Promise.resolve());
      await sleep(AUTO_INTERVAL_MS);
      if (!autoEnabled || cancelLoop) break;
      await runAutoOnce();
    }

    runningLoop = false;
  }

  /* ---------- UI ---------- */
  function ensureButton() {
    if (document.getElementById('dsu-auto-toggle')) return;

    const btn = document.createElement('button');
    btn.id = 'dsu-auto-toggle';
    btn.textContent = autoEnabled ? 'Auto Raubzug: AN' : 'Auto Raubzug: AUS';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '20px',
      bottom: '50px',
      zIndex: 9999,
      padding: '8px 12px',
      fontWeight: 'bold',
      borderRadius: '8px',
      border: '0',
      color: '#fff',
      background: autoEnabled ? '#4CAF50' : '#f44336',
      boxShadow: '0 2px 10px rgba(0,0,0,.2)',
      cursor: 'pointer'
    });

    btn.addEventListener('click', async () => {
      autoEnabled = !autoEnabled;
      localStorage.setItem(AUTO_KEY, JSON.stringify(autoEnabled));
      btn.textContent = autoEnabled ? 'Auto Raubzug: AN' : 'Auto Raubzug: AUS';
      btn.style.background = autoEnabled ? '#4CAF50' : '#f44336';

      if (autoEnabled) {
        cancelLoop = false;
        loop(); // fire-and-forget
      } else {
        cancelLoop = true;
      }
    });

    document.body.appendChild(btn);
  }

  /* ---------- boot ---------- */
  function boot() {
    ensureButton();
    if (autoEnabled) loop();
    scheduleNextReload();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot();
  } else {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  }
})();
