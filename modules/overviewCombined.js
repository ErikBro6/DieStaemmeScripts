

(function () {
  const TABLE_ID = "combined_table";
  const ONLY_UNIT_CELLS = true; // nur .unit-item summieren, sonst alles rechts der Farm

  const debounce = (fn, ms=150) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

  function parseIntStrict(text) {
    if (!text) return 0;
    const cleaned = String(text).replace(/\./g, "").replace(/\s+/g, "").trim();
    if (!/^-?\d+$/.test(cleaned)) return 0;
    return parseInt(cleaned, 10) || 0;
  }
  function parseFirstInt(text) {
    if (!text) return 0;
    const m = String(text).replace(/\u00A0/g, " ").match(/-?\d{1,3}(?:\.\d{3})*|-?\d+/);
    if (!m) return 0;
    const cleaned = m[0].replace(/\./g, "");
    return parseInt(cleaned, 10) || 0;
  }

  function findFarmColIndex(table) {
    const tbody = table.tBodies[0];
    if (!tbody) return -1;
    const row = [...tbody.rows].find(r => r.querySelector("td"));
    if (!row) return -1;
    const idx = [...row.cells].findIndex(td => td.querySelector('a[href*="screen=farm"]'));
    return idx;
  }

  function computeSums(table) {
    const tbody = table.tBodies[0];
    if (!tbody) return;

    const dataRows = [...tbody.rows].filter(r => r.querySelector("td"));
    if (!dataRows.length) return;

    const colCount = dataRows[0].cells.length;
    const farmIdx = findFarmColIndex(table);
    if (farmIdx < 0) return;

    const sums = new Array(colCount).fill(0);

    for (const row of dataRows) {
      for (let c = farmIdx + 1; c < colCount; c++) {
        const cell = row.cells[c];
        if (!cell) continue;
        if (ONLY_UNIT_CELLS && !cell.classList.contains("unit-item")) continue;
        if (cell.classList.contains("hidden")) continue;
        const val = cell.classList.contains("unit-item") ? parseIntStrict(cell.textContent) : parseFirstInt(cell.textContent);
        sums[c] += val;
      }
    }

    // Summen in die Headerzeile schreiben
    const headerRow = [...tbody.rows].find(r => r.querySelector("th"));
    if (!headerRow) return;

    for (let c = 0; c < colCount; c++) {
      const th = headerRow.cells[c];
      if (!th) continue;
      if (c > farmIdx && sums[c] > 0) {
        // Falls schon Zahl vorhanden → Zeilenumbruch + neue Summe
        const existing = th.innerHTML;
        th.innerHTML = existing.replace(/<br>.*$/, ""); // alten Summenteil entfernen
        th.innerHTML += "<br><span style='font-weight:bold;color:#d33;'>" + sums[c].toLocaleString("de-DE") + "</span>";
      }
    }
  }

  function init() {
    const table = document.getElementById(TABLE_ID);
    if (!table) return;
    const recompute = debounce(() => computeSums(table), 100);
    computeSums(table);
    const obs = new MutationObserver(recompute);
    obs.observe(table.tBodies[0], { childList: true, subtree: true, characterData: true });
  }

  const ready = setInterval(() => {
    if (document.getElementById(TABLE_ID)) {
      clearInterval(ready);
      init();
    }
  }, 100);
})();
