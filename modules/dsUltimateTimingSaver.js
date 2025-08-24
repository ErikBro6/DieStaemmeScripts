// Datei: modules/dsuClickCapture.js
(function () {
  'use strict';

  console.log("Ds Ultimate")
  const TABLE_SELECTOR = '#data1'; // deine Tabelle
  const ARRIVAL_COL_INDEX = 9;     // Ankunftszeit lt. thead

  function getArrivalStr(tr) {
    const td = tr?.querySelector(`td:nth-child(${ARRIVAL_COL_INDEX})`);
    // textContent nimmt die Millisekunden aus <small> mit, Trim + Whitespace normalisieren
    return td ? td.textContent.replace(/\s+/g, ' ').trim().replace(/\.$/, '') : null;
  }

  // dd.MM.yyyy HH:mm:ss(.SSS) -> {day,month,year,hour,minute,second}
  function parseDeArrival(arrivalStr) {
    const m = arrivalStr.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?$/);
    if (!m) return null;
    const [, dd, MM, yyyy, HH, mm, ss] = m;
    return {
      day: +dd, month: +MM, year: +yyyy,
      hour: +HH, minute: +mm, second: +ss
    };
  }

  document.addEventListener('click', (ev) => {
    // akzeptiere Klicks auf i-Icon ODER direkt auf den <a>
    const icon = ev.target.closest('i.fa-play-circle, i.fa-redo');
    const anchor = icon ? icon.closest('a[href*="screen=place"]')
                        : ev.target.closest('a[href*="screen=place"]');
    if (!anchor) return;

    // nur innerhalb unserer Tabelle reagieren (robust falls mehrere Tabellen existieren)
    if (!anchor.closest(TABLE_SELECTOR)) return;

    const tr = anchor.closest('tr');
    const arrivalStr = getArrivalStr(tr);
    if (!arrivalStr) return;

    const url = new URL(anchor.href, location.origin);
    const village = url.searchParams.get('village') || null;
    const target  = url.searchParams.get('target')  || null;

    const parts = parseDeArrival(arrivalStr);

    const payload = {
      createdAt: Date.now(),
      source: 'ds-ultimate',
      arrivalStr,
      arrivalParts: parts, // direkt verwendbar im Confirm-Tab
      village, target
    };

    // kein await – Tab öffnet i. d. R. in _blank, aber setValue ist schnell genug
    try { GM.setValue('pending_arrival', payload); } catch (e) { /* ignore */ }
  }, true); // capture: true -> wir laufen früh
})();
