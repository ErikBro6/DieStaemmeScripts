// ==UserScript==
// @name         DS → Scavenger Auto (safe timing, split-friendly)
// @version      2.2.0
// @description  Auto plan/fill via DSScavenger + sequential start clicks with safe delays. Robust reload right after returns hit 00:00:00. Bot-Schutz safe.
// @author       SpeckMich
// @match        https://*.die-staemme.de/game.php?*&screen=place&mode=scavenge*
// @run-at       document-idle
// ==/UserScript==

/* global $, jQuery */
(function () {
  'use strict';

  // ---- Requires DSGuards from main.user.js ----
  const { gateInterval, gateTimeout, guardAction } = window.DSGuards || {};
  if (!gateInterval || !gateTimeout || !guardAction) {
    console.warn('[Scavenger Auto] DSGuards not available, aborting (safety).');
    return;
  }

  // --------- Settings ----------
  const AUTO_KEY             = 'dsu_scavenger_auto_enabled';
  const AUTO_INTERVAL_MS     = 30_000;    // run planner every 30s
  const STEP_DELAY_MS        = 1000;      // 1s between start-button clicks
  const POST_FINISH_DELAY_MS = 1500;      // extra wait after 00:00:00 before reload
  const REFRESH_JITTER_MS    = 1200;      // reload ~1.2s after 00:00:00
  const MAX_REASONABLE_MS    = 8 * 3600_000;

  // --------- State ------------
  let autoEnabled = JSON.parse(localStorage.getItem(AUTO_KEY) || 'true');
  let autoBusy    = false;
  let lastClickTs = 0;

  // cancel handle for the “reload when 00:00:00” timer
  let cancelReloadWait = null;

  // --------- Helpers ----------
  const $docReady = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn)
    : fn());

  const now = () => Date.now();

  function parseHMS(text) {
    const m = String(text || '').trim().match(/^(\d+):(\d{2}):(\d{2})$/);
    if (!m) return null;
    const h = +m[1], mi = +m[2], s = +m[3];
    return h*3600 + mi*60 + s;
  }

  function getMinCountdownMs() {
    let minSec = null;
    jQuery('.scavenge-option .active-view .return-countdown').each(function () {
      const sec = parseHMS(jQuery(this).text());
      if (sec == null) return;
      if (minSec == null || sec < minSec) minSec = sec;
    });
    if (minSec == null) return null;
    const ms = (minSec * 1000) + REFRESH_JITTER_MS;
    if (ms <= 0 || ms > MAX_REASONABLE_MS) return null;
    return ms;
  }

  function forceReload(cacheBust = true) {
    guardAction(() => {
      const url = new URL(location.href);
      if (cacheBust) url.searchParams.set('_tmr', Date.now());
      location.replace(url.toString());
    });
  }

  // cancelable, Bot-Schutz-gated “reload after last return hits 00:00:00”
  function scheduleNextReload() {
    // clear previous wait if any
    if (typeof cancelReloadWait === 'function') {
      cancelReloadWait();
      cancelReloadWait = null;
    }

    const ms = getMinCountdownMs();
    if (ms == null) return;

    cancelReloadWait = gateTimeout(() => {
      // re-check just before acting (DOM could have shifted)
      const again = getMinCountdownMs();
      if (again != null && again > 2500) {
        // still some time left → reschedule
        scheduleNextReload();
        return;
      }
      // small safety delay, still gated
      gateTimeout(() => forceReload(true), POST_FINISH_DELAY_MS);
    }, ms);
  }

  function debounce(fn, wait) {
    let cancel = null;
    return () => {
      if (cancel) { cancel(); cancel = null; }
      cancel = gateTimeout(fn, wait);
    };
  }

  function installScavengeObserver() {
    const host = document.querySelector('.options-container');
    if (!host) return;
    const reschedule = debounce(scheduleNextReload, 200);

    const mo = new MutationObserver((mutList) => {
      for (const m of mutList) {
        if (m.type === 'characterData') { reschedule(); return; }
        if (m.type === 'childList') {
          const changed = [...m.addedNodes, ...m.removedNodes].some(n =>
            n.nodeType === 1 && (
              n.matches?.('.active-view, .return-countdown, .free_send_button, .premium_send_button') ||
              n.querySelector?.('.active-view, .return-countdown, .free_send_button, .premium_send_button')
            )
          );
          if (changed) { reschedule(); return; }
        }
        if (m.type === 'attributes' && m.target?.classList?.contains('return-countdown')) {
          reschedule(); return;
        }
      }
    });

    mo.observe(host, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });

    // first schedule + a gated periodic fallback
    scheduleNextReload();
    gateInterval(scheduleNextReload, 30_000, { jitter: [500, 1500] });
  }

  // --------- UI ----------
  function addToggleUI() {
    if (document.getElementById('dsu-auto-toggle')) return;
    const box = jQuery(`
      <div id="dsu-auto-toggle" style="
        position:fixed;right:10px;bottom:50px;z-index:9999;
        background:#222;color:#fff;padding:8px 10px;border-radius:8px;
        box-shadow:0 4px 18px rgba(0,0,0,.3);font:12px system-ui;display:flex;align-items:center;gap:8px;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input id="autoEnabledBox" type="checkbox" ${autoEnabled ? 'checked' : ''}>
          Auto Raubzug
        </label>
        <span id="autoLast" style="opacity:.8"></span>
      </div>
    `);
    jQuery('body').append(box);
    jQuery('#autoEnabledBox').on('change', function () {
      autoEnabled = jQuery(this).is(':checked');
      localStorage.setItem(AUTO_KEY, JSON.stringify(autoEnabled));
    });

    // harmless UI clock; keep it gated anyway so everything pauses uniformly
    gateInterval(() => {
      const sec = lastClickTs ? Math.floor((now() - lastClickTs) / 1000) : '–';
      jQuery('#autoLast').text(sec + 's');
    }, 1000);
  }

  // --------- Auto flow (uses calc module) ----------
  function runAutoOnce() {
    if (!autoEnabled || autoBusy) return;
    const API = window.DSScavenger;
    if (!API || typeof API.isReady !== 'function' || !API.isReady()) return; // wait for calc module

    autoBusy = true;
    try {
      // compute + fill next slot (no clicking done by calc)
      const slotIdx = API.computeAndFillNext?.();
      // If nothing to fill, we’re done
      if (slotIdx == null || slotIdx === -1) { autoBusy = false; return; }

      lastClickTs = now();

      // After a short wait, click all visible free start buttons from bottom to top with spacing
      gateTimeout(() => {
        // collect at firing time
        const $starts = jQuery('.scavenge-option .free_send_button:visible');
        let idx = $starts.length - 1;

        const clickNext = () => {
          if (idx < 0) { autoBusy = false; return; }
          const $btn = $starts.eq(idx);
          guardAction(() => $btn?.trigger('click'));  // last-second bailout if Bot-Schutz toggled
          idx--;
          // space the clicks safely
          gateTimeout(clickNext, STEP_DELAY_MS);
        };

        clickNext();
      }, STEP_DELAY_MS);
    } catch (e) {
      autoBusy = false;
      // console.warn(e);
    }
  }

  // --------- Boot ----------
  $docReady(() => {
    addToggleUI();
    installScavengeObserver();

    // After each run, nudge the reload scheduler to reflect new timings
    const _oldRun = runAutoOnce;
    runAutoOnce = function () {
      _oldRun();
      gateTimeout(scheduleNextReload, 1500);
    };

    // Main loop (Bot-Schutz gated)
    gateInterval(() => runAutoOnce(), AUTO_INTERVAL_MS, {
      jitter: [1000, 3000],         // optional spread
      requireVisible: false
    });

    // One gentle kick on load, still gated
    gateTimeout(() => runAutoOnce(), POST_FINISH_DELAY_MS);
  });
})();
