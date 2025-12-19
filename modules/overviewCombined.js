(function () {
  "use strict";

  const debounce = (fn, ms = 100) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

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

    const farmIdx = [...rows[0].cells].findIndex((td) =>
      td.querySelector('a[href*="screen=farm"]')
    );
    if (farmIdx === -1) return;

    const sums = [];

    rows.forEach((row) => {
      row.querySelectorAll("td.unit-item:not(.hidden)").forEach((td, i) => {
        const col = farmIdx + 1 + i;
        const v = parseInt(td.textContent.replace(/\./g, ""), 10) || 0;
        sums[col] = (sums[col] || 0) + v;
      });
    });

    const headerRow = table.querySelector("tbody tr:first-child");
    if (!headerRow) return;

    sums.forEach((val, col) => {
      if (!val) return;
      const th = headerRow.cells[col];
      if (!th) return;

      th.innerHTML = th.innerHTML.replace(/<br>.*$/, "");
      th.innerHTML += `<br><strong style="color:#d33">${val.toLocaleString(
        "de-DE"
      )}</strong>`;
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
      <span class="res wood">${wood.toLocaleString("de-DE")}</span>
      <span class="res stone">${stone.toLocaleString("de-DE")}</span>
      <span class="res iron">${iron.toLocaleString("de-DE")}</span>
    `;
  }
})();
