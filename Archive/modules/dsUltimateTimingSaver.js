// Datei: modules/dsuClickCapture.js
(function () {
  'use strict';

  const TABLE_SELECTOR = '#data1'; // ggf. anpassen
  const ARRIVAL_COL_INDEX = 9;     // Spalte "Ankunftszeit"
  const ROW_HIGHLIGHT_TOKEN = 'limegreen'; // wie im Auto-Sender gesetzt
  const SCAN_MS = 100;             // leichtes Polling

  const processed = new Set();

  function getArrivalStr(tr) {
    const td = tr?.querySelector(`td:nth-child(${ARRIVAL_COL_INDEX})`);
    return td ? td.textContent.replace(/\s+/g, ' ').trim().replace(/\.$/, '') : null;
  }

  function parseDeArrival(str) {
    const m = str?.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?$/);
    if (!m) return null;
    const [, dd, MM, yyyy, HH, mm, ss] = m;
    return { day:+dd, month:+MM, year:+yyyy, hour:+HH, minute:+mm, second:+ss };
  }

  function findPlaceAnchor(tr) {
    let a = tr.querySelector('a.text-success i.fa-redo');
    if (a) a = a.closest('a');
    if (!a) a = tr.querySelector('a[href*="game.php"][href*="screen=place"]');
    return a || null;
  }

  async function storePayload(tr, href) {
    try {
      const arrivalStr = getArrivalStr(tr);
      if (!arrivalStr) return;
      const u = new URL(href, location.origin);
      const payload = {
        createdAt: Date.now(),
        source: 'ds-ultimate',
        arrivalStr,
        arrivalParts: parseDeArrival(arrivalStr),
        village: u.searchParams.get('village') || null,
        target:  u.searchParams.get('target')  || null
      };
      await GM.setValue('pending_arrival', payload);
    } catch (e) {
      // still
    }
  }

  // 1) Manuelle Klicks früh abfangen
  document.addEventListener('mousedown', (ev) => {
    const icon = ev.target.closest('i.fa-play-circle, i.fa-redo');
    const anchor = icon ? icon.closest('a[href*="screen=place"]')
                        : ev.target.closest('a[href*="screen=place"]');
    if (!anchor) return;
    const tr = anchor.closest('tr');
    if (!tr || !tr.closest(TABLE_SELECTOR)) return;
    storePayload(tr, anchor.href);
  }, true);

  // 2) Auto-Sender: Zeilen-Highlight erkennen und speichern
  setInterval(() => {
    const rows = document.querySelectorAll(`${TABLE_SELECTOR} tr[id]`);
    rows.forEach(tr => {
      const id = tr.id;
      if (!id || processed.has(id)) return;
      const s = (tr.getAttribute('style') || '').toLowerCase();
      if (s.includes(ROW_HIGHLIGHT_TOKEN)) {
        const a = findPlaceAnchor(tr);
        if (a) storePayload(tr, a.href);
        processed.add(id);
      }
    });
  }, SCAN_MS);
})();
