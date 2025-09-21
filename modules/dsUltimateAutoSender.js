(function () {
  'use strict';

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

async function openAutoTab(href, token) {
  let url = withParam(href, 'auto', '1');
  url = withParam(url, 'autotoken', token);

  try {
    const abs = new URL(href, location.href).toString();
    const h = new URL(href, location.href).hostname; // z.B. de245.die-staemme.de
    const sub = h.split('.')[0];                     // de245

    if (/^de\d+$/.test(sub)) {
      url = withParam(url, 'autoworld', sub);

      // 1) Auto-Click-Hint (für session_expired)
      const FLOW_KEY = 'ds_auto_flow_hints';
      const now = Date.now();
      const TTL_MS = 5 * 60_000; // 5 Minuten
      const flowHint = { world: sub, ts: now, ttl: TTL_MS };

      const flowList = (await GM.getValue(FLOW_KEY, [])) || [];
      const flowFresh = flowList.filter(x => (now - (x.ts || 0)) < (x.ttl || TTL_MS));
      flowFresh.push(flowHint);
      await GM.setValue(FLOW_KEY, flowFresh);

      // 2) Return-Hint (für Redirect nach Login)
      const RETURN_KEY = 'ds_return_hints';
      const retList = (await GM.getValue(RETURN_KEY, [])) || [];
      const retFresh = retList.filter(x => (now - (x.ts || 0)) < (x.ttl || TTL_MS));
      // pro Welt überschreiben statt stapeln
      const others = retFresh.filter(x => x.world !== sub);
      others.push({ world: sub, url: abs, ts: now, ttl: TTL_MS });
      await GM.setValue(RETURN_KEY, others);
    }
  } catch (e) {
    console.warn('[DS-Tools] Hint-Setup fehlgeschlagen:', e);
  }

  const handle = GM_openInTab
    ? GM_openInTab(url, { active: true, insert: true, setParent: true })
    : window.open(url, '_blank', 'noopener,noreferrer');

  if (handle) openedTabs.set(token, handle);
  return handle;
}




async function triggerSend(tr, rowId) {
  const a = findSendAnchor(tr);
  if (!a) { console.warn('Kein Send-Link gefunden für Row:', rowId); return; }
  const href = a.getAttribute('href');
  if (!href) return;

  fired.add(rowId);
  const token = `auto_${rowId}_${Date.now()}`;

  // Wichtig: warten, bis der Hint sicher gespeichert ist
  await openAutoTab(href, token);

  tr.style.outline = '2px solid limegreen';
}


  function checkRow(tr) {
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
    getRows().forEach(checkRow);
  }, SCAN_MS);

  // DOM-Änderungen (keine Vorinitialisierung)
  const mo = new MutationObserver(() => { /* Poll findet neue Rows */ });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
