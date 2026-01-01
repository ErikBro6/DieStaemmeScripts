// ==UserScript==
// @name         DS → Mass Scavenger Auto
// @version      0.3.4
// @description  Liest Scavenge-Endzeiten aus dem ScavengeMassScreen-JSON (return_time), lädt ~1,5s nach dem frühesten Ende neu und nutzt DSMassScavenger.planNextSlot() zum automatischen Wieder-Senden – alle Aktionen durch DSGuards gepaced und geschützt. Toggle auf allen place-Seiten sichtbar, aktiv nur auf scavenge_mass.
// @author       SpeckMich
// @match        https://*.die-staemme.de/game.php?*&screen=place*
// @run-at       document-idle
// ==/UserScript==

/* global $, jQuery */
(function () {
  'use strict';

  const url = new URL(location.href);
  const params = url.searchParams;

  const isPlaceScreen      = params.get('screen') === 'place';
  const isMassScavScreen   = params.get('mode') === 'scavenge_mass';

  if (!isPlaceScreen) return; // Script nur auf place-Seiten

  const { DSGuards } = window;
  if (!DSGuards || !DSGuards.gateTimeout || !DSGuards.guardAction || !DSGuards.gateInterval) {
    console.warn('[DSMassScavengerAuto] DSGuards nicht verfügbar – Auto deaktiviert.');
    return;
  }

  const { gateTimeout, guardAction, gateInterval } = DSGuards;

  const AUTO_KEY = 'DSMassScavengerAutoEnabled';
  const BTN_SEL  = '#scavenge_mass_screen .buttons-container .btn-send';

  const SEND_STEP_DELAY_MS        = 900;
  const RELOAD_AFTER_END_MS       = 1500;
  const RELOAD_RESCHEDULE_DELAY_MS = 3000;
  const AUTO_TICK_MS              = 8000;

  let autoEnabled      = false;
  let sendingActive    = false;
  let refreshScheduled = false;
  let waitingForReload = false;

  // ---------------------------------------------------------------------------
  // Helper
  // ---------------------------------------------------------------------------

  function jitter(base, spread = 300) {
    const half = spread / 2;
    const delta = (Math.random() * spread) - half;
    return Math.max(0, base + delta);
  }

  function guardedReload() {
    guardAction(() => {
      location.reload();
    });
  }

  function guardedClick(el) {
    if (!el) return;
    guardAction(() => el.click());
  }

  // ---------------------------------------------------------------------------
  // ScavengeMassScreen-JSON
  // ---------------------------------------------------------------------------

  let cachedConfig = null;

  function extractScavengeMassArgs(txt) {
    const marker = 'new ScavengeMassScreen';
    let idx = txt.indexOf(marker);
    if (idx === -1) return null;
    idx = txt.indexOf('(', idx);
    if (idx === -1) return null;

    let i = idx + 1;
    let depth = 1;
    let inStr = false;
    let esc = false;

    for (; i < txt.length; i++) {
      const ch = txt[i];

      if (inStr) {
        if (esc) {
          esc = false;
          continue;
        }
        if (ch === '\\') {
          esc = true;
          continue;
        }
        if (ch === '"') {
          inStr = false;
          continue;
        }
        continue;
      }

      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === '(') {
        depth++;
        continue;
      }
      if (ch === ')') {
        depth--;
        if (depth === 0) {
          return txt.slice(idx + 1, i);
        }
      }
    }

    return null;
  }

  function parseMassConfig() {
    if (!isMassScavScreen) return null;   // nur auf scavenge_mass relevant
    if (cachedConfig) return cachedConfig;

    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const txt = s.textContent || '';
      if (!txt.includes('ScavengeMassScreen')) continue;

      const argsSrc = extractScavengeMassArgs(txt);
      if (!argsSrc) continue;

      try {
        const wrapped = '[' + argsSrc + ']';
        const arr = JSON.parse(wrapped);
        const options  = arr[0];
        const unitDefs = arr[1];
        const speed    = arr[2];
        const villages = arr[3];

        cachedConfig = { options, unitDefs, speed, villages };
        console.log('[DSMassScavengerAuto] ScavengeMassScreen-Config geparst.');
        return cachedConfig;
      } catch (e) {
        console.error('[DSMassScavengerAuto] Fehler beim Parsen von ScavengeMassScreen:', e);
      }
    }

    console.warn('[DSMassScavengerAuto] Konnte ScavengeMassScreen-Config nicht finden.');
    return null;
  }

  function getEarliestReturnDelayMsFromJson() {
    const cfg = parseMassConfig();
    if (!cfg || !Array.isArray(cfg.villages)) return null;

    let earliestSec = Infinity;

    cfg.villages.forEach(v => {
      const opts = v.options || {};
      Object.keys(opts).forEach(k => {
        const o = opts[k];
        if (!o || !o.scavenging_squad) return;
        const rt = o.scavenging_squad.return_time;
        if (rt == null) return;
        const t = Number(rt);
        if (!Number.isFinite(t)) return;
        if (t < earliestSec) earliestSec = t;
      });
    });

    if (!Number.isFinite(earliestSec)) {
      console.log('[DSMassScavengerAuto] Keine return_time im JSON gefunden – scheinbar keine laufenden Scavenges.');
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    let diffSec = earliestSec - nowSec;
    if (diffSec < 0) diffSec = 0;

    const baseDelayMs = diffSec * 1000 + RELOAD_AFTER_END_MS;
    const delayMs = jitter(baseDelayMs, 600);

    console.log('[DSMassScavengerAuto] Frühester return_time:', earliestSec,
      '→ diffSek:', diffSec, '→ DelayMs (inkl. Puffer+Jitter):', Math.round(delayMs));

    return delayMs;
  }

  function scheduleReloadFromJson() {
    if (!autoEnabled) return;
    if (!isMassScavScreen) return;   // nur auf Massen-Raubzug-Seite
    if (refreshScheduled) return;

    const delayMs = getEarliestReturnDelayMsFromJson();
    if (delayMs == null) {
      console.log('[DSMassScavengerAuto] Kein Reload geplant (kein laufender Scavenge im JSON).');
      return;
    }

    refreshScheduled = true;
    console.log('[DSMassScavengerAuto] Reload geplant in ~', Math.round(delayMs), 'ms (JSON return_time).');

    gateTimeout(() => {
      refreshScheduled = false;
      if (!autoEnabled) {
        console.log('[DSMassScavengerAuto] Auto deaktiviert – Reload wird verworfen.');
        return;
      }

      console.log('[DSMassScavengerAuto] JSON-Timer abgelaufen → Seite wird neu geladen.');
      guardedReload();
    }, delayMs);
  }

  // ---------------------------------------------------------------------------
  // Auto-Send
  // ---------------------------------------------------------------------------

  function sendCycle(iter = 1) {
    if (!autoEnabled) {
      sendingActive = false;
      return;
    }
    if (!isMassScavScreen) {
      sendingActive = false;
      return;
    }

    const API = window.DSMassScavenger;
    if (!API || typeof API.planNextSlot !== 'function' || typeof API.isReady !== 'function' || !API.isReady()) {
      console.log('[DSMassScavengerAuto] DSMassScavenger API nicht bereit.');
      sendingActive = false;
      return;
    }

    if (iter > 50) {
      console.warn('[DSMassScavengerAuto] Sicherheitslimit erreicht (50 Sends) – Stop.');
      sendingActive = false;
      return;
    }

    try {
      const res = API.planNextSlot();
      if (res == null || res === -1) {
        console.log('[DSMassScavengerAuto] planNextSlot() → keine weiteren Slots, Send-Cycle beendet.');
        sendingActive = false;
        waitingForReload = true;

        gateTimeout(() => scheduleReloadFromJson(), jitter(RELOAD_RESCHEDULE_DELAY_MS, 500));
        return;
      }

      const btn = document.querySelector(BTN_SEL);
      if (!btn || btn.disabled) {
        console.warn('[DSMassScavengerAuto] Senden-Button fehlt/disabled – Send-Cycle beendet.');
        sendingActive = false;
        waitingForReload = true;

        gateTimeout(() => scheduleReloadFromJson(), jitter(RELOAD_RESCHEDULE_DELAY_MS, 500));
        return;
      }

      console.log('[DSMassScavengerAuto] Sende Scavenge – Iteration', iter);
      guardedClick(btn);

      gateTimeout(() => sendCycle(iter + 1), jitter(SEND_STEP_DELAY_MS, 500));
    } catch (e) {
      console.error('[DSMassScavengerAuto] Fehler im Send-Cycle:', e);
      sendingActive = false;
      waitingForReload = true;

      gateTimeout(() => scheduleReloadFromJson(), jitter(RELOAD_RESCHEDULE_DELAY_MS, 500));
    }
  }

  function startSendCycle() {
    if (!autoEnabled) return;
    if (!isMassScavScreen) return;  // nur auf scavenge_mass
    if (sendingActive) return;
    if (waitingForReload) return;

    sendingActive = true;
    sendCycle(1);
  }

  // ---------------------------------------------------------------------------
  // Auto-Flag + UI
  // ---------------------------------------------------------------------------

  function loadAutoFlag() {
    try {
      const raw = localStorage.getItem(AUTO_KEY);
      if (!raw) return false;
      return !!JSON.parse(raw);
    } catch {
      return false;
    }
  }

  function saveAutoFlag(v) {
    try {
      localStorage.setItem(AUTO_KEY, JSON.stringify(!!v));
    } catch {
      // ignore
    }
  }

function installToggleUI() {
  if (document.getElementById('ds-mass-scav-auto-box')) return;

  autoEnabled = loadAutoFlag();

  const box = jQuery(`
    <div id="ds-mass-scav-auto-box" style="
      position:fixed;
      right:10px;
      bottom:90px;
      z-index:9999;
      background:#222;
      color:#fff;
      padding:8px 10px;
      border-radius:8px;
      box-shadow:0 4px 18px rgba(0,0,0,.3);
      font:12px system-ui;
      display:flex;
      align-items:center;
      gap:8px;
    ">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
        <input id="dsMassScavAutoEnabled" type="checkbox" ${autoEnabled ? 'checked' : ''}>
        Auto Massenraubzug
      </label>
    </div>
  `);

  jQuery('body').append(box);

  jQuery('#dsMassScavAutoEnabled').on('change', function () {
    autoEnabled = jQuery(this).is(':checked');
    saveAutoFlag(autoEnabled);

    if (autoEnabled) {
      console.log('[DSMassScavengerAuto] Auto aktiviert.');
      gateTimeout(() => {
        if (!autoEnabled) return;
        startSendCycle();
        scheduleReloadFromJson();
      }, jitter(500, 400));
    } else {
      console.log('[DSMassScavengerAuto] Auto deaktiviert.');
    }
  });
}


  // ---------------------------------------------------------------------------
  // Periodischer Auto-Check
  // ---------------------------------------------------------------------------

  function autoTick() {
    if (!autoEnabled) return;
    if (!isMassScavScreen) return;  // auf anderen place-Modi nur Toggle anzeigen

    if (!sendingActive && !waitingForReload) {
      startSendCycle();
    }

    if (!refreshScheduled && !waitingForReload) {
      scheduleReloadFromJson();
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  jQuery(() => {
    installToggleUI();

    if (autoEnabled && isMassScavScreen) {
      console.log('[DSMassScavengerAuto] Auto war bereits aktiv → starte Auto-Tick-Loop.');
      gateTimeout(() => {
        if (!autoEnabled || !isMassScavScreen) return;
        startSendCycle();
        scheduleReloadFromJson();
      }, jitter(800, 600));
    }

    gateInterval(() => autoTick(), AUTO_TICK_MS, {
      jitter: [1000, 3000],
      requireVisible: false
    });
  });
})();
