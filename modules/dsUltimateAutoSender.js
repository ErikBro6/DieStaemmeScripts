// modules/dsUltimateAutoSender.js
(function () {
  'use strict';

  // --- ON/OFF-Toggle --------------------------------------------------------
  const STORAGE_KEY = 'dsu_auto_sender_enabled';
  const TOGGLE_ID   = 'dsu-auto-sender-toggle';

  let autoEnabled = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'false') autoEnabled = false;
  } catch (e) { /* ignore */ }

  function styleToggle(btn, isOn) {
    btn.style.position     = 'fixed';
    btn.style.bottom       = '20px';
    btn.style.right        = '20px';
    btn.style.zIndex       = '9999';
    btn.style.padding      = '6px 10px';
    btn.style.borderRadius = '6px';
    btn.style.border       = '0';
    btn.style.fontSize     = '12px';
    btn.style.fontWeight   = 'bold';
    btn.style.cursor       = 'pointer';
    btn.style.color        = '#fff';
    btn.style.boxShadow    = '0 2px 8px rgba(0,0,0,.3)';
    btn.style.background   = isOn ? '#4CAF50' : '#f44336';
  }

  function updateToggleButton() {
    const btn = document.getElementById(TOGGLE_ID);
    if (!btn) return;
    btn.textContent = autoEnabled ? 'Auto-Sender: ON' : 'Auto-Sender: OFF';
    btn.style.background = autoEnabled ? '#4CAF50' : '#f44336';
  }

  function setAutoEnabled(on) {
    autoEnabled = !!on;
    try {
      localStorage.setItem(STORAGE_KEY, autoEnabled ? 'true' : 'false');
    } catch (e) { /* ignore */ }
    updateToggleButton();
  }

  function createToggleButton() {
    if (document.getElementById(TOGGLE_ID)) return;
    const btn = document.createElement('button');
    btn.id = TOGGLE_ID;
    btn.type = 'button';
    btn.textContent = autoEnabled ? 'Auto-Sender: ON' : 'Auto-Sender: OFF';
    styleToggle(btn, autoEnabled);
    btn.addEventListener('click', () => {
      setAutoEnabled(!autoEnabled);
    });
    document.body.appendChild(btn);
  }

  function bootToggle() {
    if (document.body) {
      createToggleButton();
    } else {
      // Fallback, falls sehr früh geladen
      const iv = setInterval(() => {
        if (document.body) {
          clearInterval(iv);
          createToggleButton();
        }
      }, 100);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    bootToggle();
  } else {
    window.addEventListener('DOMContentLoaded', bootToggle, { once: true });
  }

  // --- Bestehende Auto-Sender-Logik ----------------------------------------

  const TRIGGER_SEC = 10;     // Kante: >10 -> ==10
  const SCAN_MS = 200;
  const SAFETY_MS = 0;

  const fired = new Set();
  const lastSeenSec = new Map();
  const nowMs = () => Date.now();

  function getRows() {
    return Array.from(document.querySelectorAll('tr[id]'))
      .filter(tr => tr.querySelector('countdown[date]'));
  }

  function findSendAnchor(tr) {
    let a = tr.querySelector('a.text-success i.fa-redo');
    if (a) a = a.closest('a');
    if (!a) a = tr.querySelector('a[href*="game.php"][href*="screen=place"]');
    return a || null;
  }

  function withParam(u, k, v) {
    const x = new URL(u, location.href);
    x.searchParams.set(k, v);
    return x.toString();
  }

  // ---- Tab-Handle-Registry & Close-Signal ----
  const openedTabs = new Map(); // token -> handle

  GM.addValueChangeListener('auto_close_signal', (name, oldVal, newVal, remote) => {
    if (!remote || !newVal) return;
    const { token, delayMs } = newVal;
    const handle = openedTabs.get(token);
    if (handle && typeof handle.close === 'function') {
      setTimeout(() => {
        try { handle.close(); } catch {}
        openedTabs.delete(token);
      }, delayMs ?? 3000);
    }
  });

  function openAutoTab(href, token) {
    // nur im automatischen Pfad auto=1 + autotoken anhängen
    let url = withParam(href, 'auto', '1');
    url = withParam(url, 'autotoken', token);

    const handle = GM_openInTab
      ? GM_openInTab(url, { active: true, insert: true, setParent: true })
      : window.open(url, '_blank', 'noopener,noreferrer');

    // nur speichern, wenn wir wirklich ein Handle bekommen haben
    if (handle) openedTabs.set(token, handle);
    return handle;
  }

  async function triggerSend(tr, rowId) {
    if (!autoEnabled) return; // hart stoppen, wenn OFF

    const a = findSendAnchor(tr);
    if (!a) {
      console.warn('Kein Send-Link gefunden für Row:', rowId);
      return;
    }
    const href = a.getAttribute('href');
    if (!href) return;

    // Doppel-Trigger sofort verhindern
    fired.add(rowId);

    // eindeutiger Token pro Öffnung
    const token = `auto_${rowId}_${Date.now()}`;

    // neuen Tab öffnen (Auto-Flow → auto=1 & autotoken)
    openAutoTab(href, token);

    // Feedback
    tr.style.outline = '2px solid limegreen';
  }

  function checkRow(tr) {
    if (!autoEnabled) return; // wenn OFF, nichts beobachten

    const rowId = tr.getAttribute('id');
    if (!rowId || fired.has(rowId)) return;

    const cd = tr.querySelector('countdown[date]');
    if (!cd) return;

    const ts = Number(cd.getAttribute('date')); // Unix Sekunden
    if (!Number.isFinite(ts)) return;

    const msLeft = (ts * 1000) - nowMs() - SAFETY_MS;
    const secLeft = Math.max(-1, Math.floor(msLeft / 1000));

    const prev = lastSeenSec.get(rowId);
    if (prev === undefined) {
      lastSeenSec.set(rowId, secLeft);
      return;
    }

    // Edge-Trigger: Übergang >TRIGGER_SEC -> ==TRIGGER_SEC
    if (prev > TRIGGER_SEC && secLeft === TRIGGER_SEC) {
      triggerSend(tr, rowId); // async not needed
    }

    lastSeenSec.set(rowId, secLeft);
  }

  // Poll
  setInterval(() => {
    if (!autoEnabled) return;
    getRows().forEach(checkRow);
  }, SCAN_MS);

  // DOM-Änderungen (keine Vorinitialisierung)
  const mo = new MutationObserver(() => {
    if (!autoEnabled) return;
    // Poll findet neue Rows
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
