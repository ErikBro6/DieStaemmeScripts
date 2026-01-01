(function () {
  'use strict';

  const ROOT = (window.DSTools ||= {});
  const NS = (ROOT.massScavenge ||= {});
  const $ = window.jQuery;

  const { MASS_ITER_LIMIT, MASS_STEP_DELAY_MS } = NS.constants || {
    MASS_ITER_LIMIT: 50,
    MASS_STEP_DELAY_MS: 1500,
  };

  // -----------------------------
  // Auto-Scheduler Settings
  // -----------------------------
  const AUTO_KEY = 'DSMassScavengerAutoEnabled';

  const BTN_SEL = '#scavenge_mass_screen .buttons-container .btn-send';

  const SEND_STEP_DELAY_MS = MASS_STEP_DELAY_MS; // reuse
  const RELOAD_AFTER_END_MS = 1500;
  const RELOAD_RESCHEDULE_DELAY_MS = 3000;
  const AUTO_TICK_MS = 8000;
  const FALLBACK_RELOAD_MS = 10 * 60 * 1000; // wenn keine return_time gefunden

  // Optional: DSGuards nutzen (wenn vorhanden), sonst Fallback
  const DSGuards = window.DSGuards || null;
  const guardAction = DSGuards?.guardAction ? DSGuards.guardAction.bind(DSGuards) : (fn) => fn();
  const gateTimeout = DSGuards?.gateTimeout ? DSGuards.gateTimeout.bind(DSGuards) : (fn, ms) => setTimeout(fn, ms);
  const gateInterval = DSGuards?.gateInterval
    ? (fn, ms) => DSGuards.gateInterval(fn, ms, { jitter: [1000, 3000], requireVisible: false })
    : (fn, ms) => setInterval(fn, ms);

  // -----------------------------
  // State
  // -----------------------------
  let autoEnabled = loadAutoFlag();   // persistenter Auto-Scheduler Toggle
  let manualEnabled = false;          // "Massen-Raubzug senden" Button (einmalig/kurzlaufend)
  let sendingActive = false;
  let refreshScheduled = false;
  let waitingForReload = false;

  let tickHandle = null;
  let uiInstalled = false;

  // -----------------------------
  // Helpers
  // -----------------------------
  function isPlaceScreen() {
    const url = new URL(location.href);
    return url.searchParams.get('screen') === 'place';
  }

  function isMassScavScreen() {
    const url = new URL(location.href);
    return url.searchParams.get('screen') === 'place' && url.searchParams.get('mode') === 'scavenge_mass';
  }

  function jitter(base, spread = 300) {
    const half = spread / 2;
    const delta = (Math.random() * spread) - half;
    return Math.max(0, base + delta);
  }

  function guardedReload() {
    guardAction(() => location.reload());
  }

  function guardedClick(el) {
    if (!el) return;
    guardAction(() => el.click());
  }

  function isReady() {
    const api = window.DSMassScavenger;
    if (api && typeof api.isReady === 'function') return !!api.isReady();

    // Fallback (wie boot.js)
    const root = document.querySelector('#scavenge_mass_screen');
    if (!root) return false;
    if (!root.querySelector('.candidate-squad-widget')) return false;
    if (!root.querySelector('td.option')) return false;
    if (!root.querySelector('input.unitsInput')) return false;
    if (!root.querySelector('.btn-send')) return false;
    return true;
  }

  // -----------------------------
  // Persistenz
  // -----------------------------
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

  // -----------------------------
  // return_time → Reload-Delay
  // -----------------------------
  function getEarliestReturnDelayMsFromJson() {
    if (!isMassScavScreen()) return null;
    if (!NS.massConfig?.parseMassConfig) return null;

    const cfg = NS.massConfig.parseMassConfig();
    if (!cfg || !Array.isArray(cfg.villages)) return null;

    let earliestSec = Infinity;

    cfg.villages.forEach(v => {
      const opts = v?.options || {};
      Object.keys(opts).forEach(k => {
        const o = opts[k];
        const rt = o?.scavenging_squad?.return_time;
        if (rt == null) return;
        const t = Number(rt);
        if (!Number.isFinite(t)) return;
        if (t < earliestSec) earliestSec = t;
      });
    });

    if (!Number.isFinite(earliestSec)) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    const diffSec = Math.max(0, earliestSec - nowSec);

    const baseDelayMs = diffSec * 1000 + RELOAD_AFTER_END_MS;
    return jitter(baseDelayMs, 600);
  }

  function scheduleReloadFromJson() {
    if (!autoEnabled) return;
    if (!isMassScavScreen()) return;
    if (refreshScheduled) return;

    const delayMs = getEarliestReturnDelayMsFromJson();
    const useDelay = delayMs == null ? jitter(FALLBACK_RELOAD_MS, 2000) : delayMs;

    refreshScheduled = true;

    console.log('[DSMassScavengerAuto] Reload geplant in ~', Math.round(useDelay), 'ms',
      delayMs == null ? '(Fallback, keine return_time)' : '(JSON return_time)');

    gateTimeout(() => {
      refreshScheduled = false;

      if (!autoEnabled) return;
      if (!isMassScavScreen()) return;

      console.log('[DSMassScavengerAuto] Reload jetzt.');
      waitingForReload = true;
      guardedReload();
    }, useDelay);
  }

  // -----------------------------
  // Send Cycle (Auto + Manual nutzt denselben Motor)
  // -----------------------------
  function finishRunAndMaybeReload(reason) {
    sendingActive = false;
    manualEnabled = false;

    if (!autoEnabled) {
      waitingForReload = false;
      return;
    }

    waitingForReload = true;

    console.log('[DSMassScavengerAuto] Run beendet:', reason, '→ plane Reload.');
    gateTimeout(() => scheduleReloadFromJson(), jitter(RELOAD_RESCHEDULE_DELAY_MS, 600));
  }

  function sendCycle(iter = 1) {
    if (!sendingActive) return;

    // Wenn User Auto ausmacht oder Seite wechselt → sauber stoppen
    if (!isMassScavScreen()) {
      sendingActive = false;
      manualEnabled = false;
      waitingForReload = false;
      return;
    }

    // Manual-Run: wenn Auto deaktiviert und manualEnabled false → raus
    if (!autoEnabled && !manualEnabled) {
      sendingActive = false;
      waitingForReload = false;
      return;
    }

    if (!NS.logic?.planNextSlot) {
      console.warn('[DSMassScavengerAuto] NS.logic.planNextSlot fehlt.');
      finishRunAndMaybeReload('planNextSlot fehlt');
      return;
    }

    if (!isReady()) {
      console.log('[DSMassScavengerAuto] UI/DOM noch nicht bereit.');
      // Bei Auto: später nochmal probieren
      sendingActive = false;
      if (autoEnabled) {
        waitingForReload = false;
        gateTimeout(() => startSendCycle('dom-not-ready'), jitter(1200, 800));
      }
      return;
    }

    if (iter > Math.max(1, MASS_ITER_LIMIT)) {
      console.warn('[DSMassScavengerAuto] Sicherheitslimit erreicht (', MASS_ITER_LIMIT, ')');
      finishRunAndMaybeReload('iter-limit');
      return;
    }

    const res = NS.logic.planNextSlot();
    if (res !== 0) {
      console.log('[DSMassScavengerAuto] planNextSlot() →', res, '→ nichts mehr zu tun.');
      // Manual: einfach stoppen, Auto: reload planen
      sendingActive = false;
      manualEnabled = false;

      if (autoEnabled) {
        waitingForReload = true;
        gateTimeout(() => scheduleReloadFromJson(), jitter(RELOAD_RESCHEDULE_DELAY_MS, 600));
      } else {
        waitingForReload = false;
      }
      return;
    }

    const btn = document.querySelector(BTN_SEL);
    if (!btn || btn.disabled) {
      console.warn('[DSMassScavengerAuto] Offizieller Senden-Button fehlt/disabled:', BTN_SEL);
      finishRunAndMaybeReload('btn-missing-disabled');
      return;
    }

    console.log('[DSMassScavengerAuto] Klicke offiziellen Senden-Button. Iteration', iter);
    guardedClick(btn);

    gateTimeout(() => sendCycle(iter + 1), jitter(SEND_STEP_DELAY_MS, 500));
  }

  function startSendCycle(source = 'unknown') {
    if (sendingActive) return;
    if (!isMassScavScreen()) return;

    // Auto darf nicht parallel zu "waitingForReload" anfangen
    if (autoEnabled && waitingForReload) return;

    // Manual darf auch starten, wenn Auto aus
    if (!autoEnabled && !manualEnabled) return;

    sendingActive = true;
    console.log('[DSMassScavengerAuto] Start sendCycle (source=', source, ')');
    sendCycle(1);
  }

  // -----------------------------
  // Manual API (bestehend) — wird von uiEvents.js genutzt
  // -----------------------------
  function stop() {
    manualEnabled = false;
    sendingActive = false;
    waitingForReload = false;
  }

  function start() {
    manualEnabled = true;
    waitingForReload = false;
    startSendCycle('manual');
  }

  function toggle() {
    if (sendingActive && manualEnabled) stop();
    else start();
  }

  // -----------------------------
  // Auto Tick Loop
  // -----------------------------
  function autoTick() {
    if (!autoEnabled) return;
    if (!isMassScavScreen()) return;

    // Falls wir auf Reload warten: nichts tun
    if (waitingForReload) return;

    if (!sendingActive) startSendCycle('autoTick');
    if (!refreshScheduled && !sendingActive) scheduleReloadFromJson();
  }

  function ensureTickLoop() {
    if (tickHandle) return;
    tickHandle = gateInterval(() => autoTick(), AUTO_TICK_MS);
  }

  // -----------------------------
  // UI Toggle (Overlay)
  // -----------------------------
  function setUiStatus(text) {
    const el = document.getElementById('ds-mass-scav-auto-status');
    if (el) el.textContent = text;
  }

  function updateUiStatus() {
    if (!autoEnabled) return setUiStatus('aus');
    if (!isMassScavScreen()) return setUiStatus('an (nur aktiv auf Mass-Scavenge)');
    if (waitingForReload) return setUiStatus('wartet auf Reload');
    if (sendingActive) return setUiStatus('sendet…');
    if (refreshScheduled) return setUiStatus('Reload geplant');
    return setUiStatus('bereit');
  }

  function installToggleUI() {
    if (uiInstalled) return;
    uiInstalled = true;

    if (document.getElementById('ds-mass-scav-auto-box')) return;

    const box = document.createElement('div');
    box.id = 'ds-mass-scav-auto-box';
    box.style.cssText = [
      'position:fixed',
      'right:10px',
      'bottom:90px',
      'z-index:9999',
      'background:#222',
      'color:#fff',
      'padding:8px 10px',
      'border-radius:8px',
      'box-shadow:0 4px 18px rgba(0,0,0,.3)',
      'font:12px system-ui',
      'display:flex',
      'align-items:center',
      'gap:10px'
    ].join(';');

    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'dsMassScavAutoEnabled';
    cb.checked = !!autoEnabled;

    const title = document.createElement('span');
    title.textContent = 'Auto Massenraubzug';

    const status = document.createElement('span');
    status.id = 'ds-mass-scav-auto-status';
    status.style.cssText = 'opacity:.75;font-size:11px';

    label.appendChild(cb);
    label.appendChild(title);

    box.appendChild(label);
    box.appendChild(status);

    document.body.appendChild(box);

    cb.addEventListener('change', () => {
      autoEnabled = cb.checked;
      saveAutoFlag(autoEnabled);

      // Reset scheduler flags
      refreshScheduled = false;
      waitingForReload = false;

      console.log('[DSMassScavengerAuto] Auto =', autoEnabled ? 'AN' : 'AUS');

      if (autoEnabled) {
        ensureTickLoop();
        if (isMassScavScreen()) {
          gateTimeout(() => {
            if (!autoEnabled) return;
            startSendCycle('auto-toggle');
            scheduleReloadFromJson();
            updateUiStatus();
          }, jitter(700, 600));
        } else {
          updateUiStatus();
        }
      } else {
        updateUiStatus();
      }
    });

    // Live status updater
    setInterval(updateUiStatus, 1000);
    updateUiStatus();
  }

  // -----------------------------
  // Boot
  // -----------------------------
  function boot() {
    if (!isPlaceScreen()) return;

    installToggleUI();
    ensureTickLoop();

    if (autoEnabled && isMassScavScreen()) {
      gateTimeout(() => {
        if (!autoEnabled) return;
        startSendCycle('boot');
        scheduleReloadFromJson();
        updateUiStatus();
      }, jitter(900, 700));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Export (bestehend) + neue Infos
  NS.autoRunner = {
    start,
    stop,
    toggle,
    isActive: () => sendingActive,

    // optional für Debug/extern
    isAutoEnabled: () => autoEnabled,
  };
})();
