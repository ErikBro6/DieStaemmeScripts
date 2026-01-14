(function () {
  "use strict";

  const debounce = (fn, ms = 100) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  function formatShort(n) {
    if (n >= 1_000_000)
      return (n / 1_000_000).toFixed(1).replace(".", ",") + " M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".", ",") + " K";
    return n.toString();
  }

  function ready(fn) {
    const i = setInterval(() => {
      if (fn()) clearInterval(i);
    }, 100);
  }

  ready(() => {
    if (document.getElementById("production_table")) {
      initProduction();
      return true;
    }
    if (document.getElementById("combined_table")) {
      initCombined();
      return true;
    }
    return false;
  });

  function initCombined() {
    const table = document.getElementById("combined_table");
    if (!table || !table.tBodies[0]) return;

    const recompute = debounce(() => sumCombined(table), 100);
    sumCombined(table);

    new MutationObserver(recompute).observe(table.tBodies[0], {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function sumCombined(table) {
    const tbody = table.tBodies[0];
    const rows = [...tbody.rows].filter((r) => r.querySelector("td"));
    if (!rows.length) return;

    // Header-Zeile ist die erste tbody-Zeile (mit <th>)
    const headerRow = tbody.rows[0];
    if (!headerRow) return;

    const sums = [];

    rows.forEach((row) => {
      // über ALLE unit-item Zellen gehen, aber hidden überspringen
      row.querySelectorAll("td.unit-item").forEach((td) => {
        if (td.classList.contains("hidden")) return;

        const col = td.cellIndex; // <- entscheidend: echte Spalte in der Tabelle
        const v = parseInt(td.textContent.replace(/\./g, ""), 10) || 0;

        sums[col] = (sums[col] || 0) + v;
      });
    });

    sums.forEach((val, col) => {
      if (!val) return;
      const th = headerRow.cells[col];
      if (!th) return;

      let box = th.querySelector(".dsu-sum-wrap");
      if (!box) {
        box = document.createElement("span");
        box.className = "dsu-sum-wrap";
        box.style.display = "block"; // statt <br>
        box.style.marginTop = "2px";
        th.appendChild(box);
      }

      box.textContent = formatShort(val);
      box.style.color = "#d33";
      box.style.fontWeight = "700";
    });
  }

  function initProduction() {
    const table = document.getElementById("production_table");
    if (!table || !table.tBodies[0]) return;

    sumProduction(table);
  }

  function sumProduction(table) {
    let wood = 0,
      stone = 0,
      iron = 0;

    table.querySelectorAll("tbody tr").forEach((tr) => {
      const cell = tr.querySelector("td:nth-child(4)");
      if (!cell) return;

      const p = (t) => parseInt(t.replace(/\./g, ""), 10) || 0;
      const w = cell.querySelector(".res.wood");
      const s = cell.querySelector(".res.stone");
      const i = cell.querySelector(".res.iron");

      if (w) wood += p(w.textContent);
      if (s) stone += p(s.textContent);
      if (i) iron += p(i.textContent);
    });

    const th = table.querySelector("thead th:nth-child(4)");
    if (!th) return;

    th.innerHTML = `
      Rohstoffe<br>
<span class="res wood">${formatShort(wood)}</span>
<span class="res stone">${formatShort(stone)}</span>
<span class="res iron">${formatShort(iron)}</span>

    `;
  }
})();
