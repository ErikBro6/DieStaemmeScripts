/* ============================================================
 * ResourceSenderSingle – Shinko to Kuma (DS-like rewrite)
 * - full functionality
 * - one button
 * - in-page UI
 * - no popup
 * ============================================================ */
(function () {
  "use strict";

  /* ============================================================
   * HELPERS
   * ============================================================ */
  function getTargetCoordFromPage() {
    const row = jQuery("#content_value")
      .find("td")
      .filter(function () {
        return jQuery(this).text().trim() === "Koordinaten:";
      })
      .next("td")
      .text()
      .match(/\d{3}\|\d{3}/);

    if (row) return row[0];

    const fallback = jQuery("#content_value")
      .text()
      .match(/\b\d{3}\|\d{3}\b/);
    return fallback ? fallback[0] : null;
  }

  function numberWithCommas(x) {
    return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function distance(x1, y1, x2, y2) {
    return Math.round(Math.hypot(x1 - x2, y1 - y2));
  }

  /* ============================================================
   * MAIN
   * ============================================================ */
  function runResourceSender() {
    /* ================= STATE ================= */
    let villagesData = [];
    let sendBack = null;

    let totalWoodSent = 0;
    let totalStoneSent = 0;
    let totalIronSent = 0;

    let resLimit = parseInt(sessionStorage.getItem("resLimit") || "0", 10);

    const woodPercentage = 28000 / 83000;
    const stonePercentage = 30000 / 83000;
    const ironPercentage = 25000 / 83000;

    const coordinate = getTargetCoordFromPage();
    if (!coordinate) {
      UI.ErrorMessage("Zielkoordinate nicht gefunden.");
      return;
    }

    /* ================= DS-LIKE CSS ================= */
    const css = `
<style>
#rs_container { margin:10px 0; max-width:950px; }
#rs_container table.vis { width:100%; }
#rs_container th { text-align:center; }
#rs_container td { text-align:center; }
#rs_container input { width:90%; }
#rs_target img { max-width:64px; }
</style>`;
    jQuery("#contentContainer,#mobileHeader").prepend(css);

    /* ================= LOAD OVERVIEW ================= */
    const URL =
      game_data.player.sitter > 0
        ? `game.php?t=${game_data.player.id}&screen=overview_villages&mode=prod&page=-1`
        : `game.php?screen=overview_villages&mode=prod&page=-1`;

    jQuery.get(URL).done(function (page) {
      const mobile = jQuery("#mobileHeader").length > 0;

      const woodEls = jQuery(page).find(mobile ? ".res.mwood" : ".res.wood");
      const clayEls = jQuery(page).find(mobile ? ".res.mstone" : ".res.stone");
      const ironEls = jQuery(page).find(mobile ? ".res.miron" : ".res.iron");
      const villages = jQuery(page).find(".quickedit-vn");

      villagesData = [];

      villages.each(function (i) {
        const ironTd = ironEls[i]?.parentElement;
        const whTxt = ironTd?.nextElementSibling?.innerText || "0";
        const merchTxt =
          ironTd?.nextElementSibling?.nextElementSibling?.innerText || "0/0";

        const wh = parseInt(whTxt.replace(/\D/g, ""), 10);
        const m = merchTxt.match(/(\d+)\s*\/\s*(\d+)/);
        const availMerchants = m ? parseInt(m[1], 10) : 0;

        villagesData.push({
          id: this.dataset.id,
          name: this.innerText.trim(),
          coord: this.innerText.match(/\d+\|\d+/)[0],
          url: this.querySelector("a").href,
          wood: parseInt(woodEls[i].textContent.replace(/\D/g, ""), 10),
          stone: parseInt(clayEls[i].textContent.replace(/\D/g, ""), 10),
          iron: parseInt(ironEls[i].textContent.replace(/\D/g, ""), 10),
          warehouse: wh,
          merchants: availMerchants,
        });
      });

      resolveTarget();
    });

    /* ================= TARGET ================= */
    function resolveTarget() {
      const url =
        game_data.player.sitter > 0
          ? `game.php?t=${game_data.player.id}&screen=api&ajax=target_selection&input=${coordinate}&type=coord`
          : `game.php?screen=api&ajax=target_selection&input=${coordinate}&type=coord`;

      jQuery.get(url).done(function (data) {
        if (typeof data === "string") data = JSON.parse(data);
        const v = data.villages[0];
        sendBack = v;
        renderUI();
      });
    }

    /* ================= CALC ================= */
    function calcRes(v) {
      const merchants = parseInt(v.merchants, 10);
      if (!Number.isFinite(merchants) || merchants <= 0) {
        return null;
      }

      const carry = merchants * 1000;
      const leave = Math.floor((v.warehouse / 100) * resLimit);

      // verfügbare Ressourcen
      let lw = Math.max(0, v.wood - leave);
      let ls = Math.max(0, v.stone - leave);
      let li = Math.max(0, v.iron - leave);

      // Zielverteilung
      let w = carry * woodPercentage;
      let s = carry * stonePercentage;
      let i = carry * ironPercentage;

      // Begrenzen durch vorhandene Ressourcen
      let p = 1;
      if (w > lw) p = Math.min(p, lw / w);
      if (s > ls) p = Math.min(p, ls / s);
      if (i > li) p = Math.min(p, li / i);

      w = Math.floor(w * p);
      s = Math.floor(s * p);
      i = Math.floor(i * p);

      // 🔒 HARTE HÄNDLER-KAPPE (entscheidend)
      const total = w + s + i;
      if (total > carry) {
        const scale = carry / total;
        w = Math.floor(w * scale);
        s = Math.floor(s * scale);
        i = Math.floor(i * scale);
      }

      // finaler Guard
      if (w + s + i <= 0) return null;

      return { wood: w, stone: s, iron: i };
    }

    /* ================= UI ================= */
    function renderUI() {
      jQuery("#rs_container").remove();

      let html = `
<div id="rs_container">

<table class="vis">
<tr>
  <th>Ziel</th>
  <th>WH % behalten</th>
</tr>
<tr>
  <td><input id="rs_coord" value="${coordinate}"></td>
  <td><input id="rs_limit" value="${resLimit}" size="3">%</td>
</tr>
</table>

<table class="vis" id="rs_target">
<tr>
  <th colspan="5">${sendBack.name} (${sendBack.x}|${sendBack.y})</th>
</tr>
<tr>
  <td rowspan="3"><img src="${sendBack.image}"></td>
  <td>Gesendet</td>
  <td><span class="icon header wood"></span> <span id="rs_w">0</span></td>
  <td><span class="icon header stone"></span> <span id="rs_s">0</span></td>
  <td><span class="icon header iron"></span> <span id="rs_i">0</span></td>
</tr>
</table>

<table class="vis" id="rs_table">
<tr>
  <th>Dorf</th>
  <th>Distanz</th>
  <th>Holz</th>
  <th>Lehm</th>
  <th>Eisen</th>
  <th></th>
</tr>`;

      villagesData.forEach((v, idx) => {
        if (v.coord === `${sendBack.x}|${sendBack.y}`) return;
        const res = calcRes(v);
        if (!res || res.wood + res.stone + res.iron === 0) return;

        html += `
<tr data-idx="${idx}">
  <td><a href="${v.url}">${v.name}</a></td>
  <td>${distance(
    sendBack.x,
    sendBack.y,
    v.coord.substr(0, 3),
    v.coord.substr(4, 3)
  )}</td>
  <td>${res.wood}</td>
  <td>${res.stone}</td>
  <td>${res.iron}</td>
  <td>
    <button class="btn btn-confirm-yes rs_send"
      data-source="${v.id}"
      data-wood="${res.wood}"
      data-stone="${res.stone}"
      data-iron="${res.iron}">
      Senden
    </button>
  </td>
</tr>`;
      });

      html += "</table></div>";

      jQuery("#contentContainer").prepend(html);
    }

    /* ================= SEND ================= */
    jQuery(document)
      .off("click.rs")
      .on("click.rs", ".rs_send", function () {
        const btn = jQuery(this);
        const tr = btn.closest("tr");

        jQuery(".rs_send").prop("disabled", true);

        TribalWars.post(
          "market",
          { ajaxaction: "map_send", village: btn.data("source") },
          {
            target_id: sendBack.id,
            wood: btn.data("wood"),
            stone: btn.data("stone"),
            iron: btn.data("iron"),
          },
          function (resp) {
            UI.SuccessMessage(resp.message);

            totalWoodSent += btn.data("wood");
            totalStoneSent += btn.data("stone");
            totalIronSent += btn.data("iron");

            jQuery("#rs_w").text(numberWithCommas(totalWoodSent));
            jQuery("#rs_s").text(numberWithCommas(totalStoneSent));
            jQuery("#rs_i").text(numberWithCommas(totalIronSent));

            tr.remove();
            jQuery(".rs_send").prop("disabled", false);

            if (!jQuery(".rs_send").length) {
              UI.SuccessMessage("Finished sending!");
            }
          },
          false
        );
      });
  }

  /* ============================================================
   * BUTTON
   * ============================================================ */
  function insertButton() {
    if (document.getElementById("rs-single-btn")) return;
    const h2 = document.querySelector("#content_value > h2");
    if (!h2) return;

    const btn = document.createElement("a");
    btn.id = "rs-single-btn";
    btn.className = "btn";
    btn.innerHTML = `<img src="/graphic/buildings/market.webp" style="height:14px"> Resource-Sender`;
    btn.onclick = (e) => {
      e.preventDefault();
      runResourceSender();
    };

    h2.insertAdjacentElement("afterend", btn);
  }

  let tries = 0;
  (function wait() {
    if (++tries > 200) return;
    insertButton();
    setTimeout(wait, 100);
  })();
})();
