// ==UserScript==
// @name         DS UI Erweitert – Reports
// @version      1.0.0
// @description  Extrahierte Report-Funktionen aus DS UI Erweitert (Bashpunkte, Zeiten, Spy, UT Preview)
// @author       suilenroc, Get Drunk, ruingvar
// @match        https://*.die-staemme.de/game.php?*screen=report*
// @match        https://*.die-staemme.de/public_report/*
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

  initSettingsHelper();
  function initSettingsHelper() {
    win.SettingsHelper = {
      serverConf: null,
      unitConf: null,
      buildConf: null,

      loadSettings(type) {
        const settingUrls = {
          server: {
            path: "server_settings_",
            url: "/interface.php?func=get_config",
          },
          unit: {
            path: "unit_settings_",
            url: "/interface.php?func=get_unit_info",
          },
          building: {
            path: "building_settings_",
            url: "/interface.php?func=get_building_info",
          },
        };
        if (typeof settingUrls[type] !== "undefined") {
          const path = settingUrls[type].path + game_data.world;
          if (localStorage.getItem(path) == null) {
            const req = new XMLHttpRequest();
            req.open(
              "GET",
              "https://" + location.hostname + settingUrls[type].url,
              false
            );
            req.send(null);
            localStorage.setItem(
              path,
              JSON.stringify(this.xmlToJson(req.responseXML).config)
            );
          }
          return JSON.parse(localStorage.getItem(path));
        }
      },

      xmlToJson(xml) {
        /* ORIGINALCODE */
      },

      getServerConf() {
        if (!this.serverConf)
          this.serverConf = JSON.parse(
            localStorage.getItem("server_settings_" + game_data.world)
          );
        return this.serverConf;
      },

      getUnitConf() {
        if (!this.unitConf)
          this.unitConf = JSON.parse(
            localStorage.getItem("unit_settings_" + game_data.world)
          );
        return this.unitConf;
      },

      checkConfigs() {
        if (this.getServerConf() && this.getUnitConf()) return true;
        Dialog.show("config", "<h2>Server Settings fehlen</h2>");
        return false;
      },
    };
  }

  win.CopyAndExportButton = true;
  // Produktion Zusammenfassung (1.1)
  win.OverviewVillages = true;
  // Truppenzaehler (1.2)
  win.TroopCounter = true;
  //Zusammenfassungen auf der Dorf-Informations Seite (2.)
  win.InfoVillage = true;
  // Bericht BashPunkte Anzeige + UT-Bericht Zusammenfassung (4.1 - 4.2)
  win.ReportBashPoints = true;
  // Bericht UEberlebende Truppen Zeile (4.1)
  win.ReportSurvived = false;
  // Massen-Unterstuetzungs Zusammenfassung (3.2)
  win.MassSupport = true;
  // Transport Zusammenfassung (1.3)
  win.Transport = true;
  // Flaggen Zusammenfassung (6.)
  win.FlagStats = true;
  // Mitglieder Verteidigungs und Truppen Zusammenfassungen (5.-5.2)
  win.AllySummarie = true;
  // Ab wie vielen Speeren ein Dorf als Bunker zaehlen soll (fuer 5.2)
  win.spear_bunker_value = 20000;
  // Sotier funktion im Versammlungsplatz (3.1)
  win.PlaceFilters = true;
  // Zusatzinformation bei Spaehberichten
  win.ReportSpyInfo = true;
  // Abschick und Retime Zeiten
  win.ReportTimes = true;
  // Befehlsfreigabe Vertieler um Freunde daran zu erinnern..
  win.CommandAndNotesSharing = true;
  // Ut Berichte Vorschau zusammengefasst anzeigen (4.2.1)
  win.ReportPreview = true;

  // -------------------------------------------------------------------------
  // Config (IDENTISCH zum Original)
  // -------------------------------------------------------------------------
  win.ReportBashPoints = win.ReportBashPoints ?? true;
  win.ReportSurvived = win.ReportSurvived ?? false;
  win.ReportSpyInfo = win.ReportSpyInfo ?? true;
  win.ReportTimes = win.ReportTimes ?? true;
  win.ReportPreview = win.ReportPreview ?? true;

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------
  try {
    const screen = win.game_data.screen;
    const mode = win.game_data.mode;

    if (screen !== "report") return;

    // Öffentlicher oder normaler Bericht
    if (location.href.includes("&view=") || mode === "view_public_report") {
      if (ReportBashPoints) sumBashPoints();
      if (ReportSurvived) survivedReport();
      if (ReportTimes) sendAndReTimes();
      if (ReportSpyInfo) spyInformation();
    } else {
      if (ReportPreview) customReportPreview();
    }
  } catch (e) {
    if (typeof game_data?.units !== "undefined") {
      UI.ErrorMessage("DS UI Erweitert (Reports) Fehler", 3000);
      console.error(e);
    }
  }

  // -------------------------------------------------------------------------
  // ORIGINALFUNKTIONEN – UNVERÄNDERT
  // -------------------------------------------------------------------------

  /* ===== Bashpunkte & UT-Zusammenfassung ===== */
  function sumBashPoints() {
    //unterstuetzungs Bericht
    let tables = $(".report_ReportSupportAttackMerged").find("table.vis");
    if (tables.length > 0) {
      const display_units = game_data.units.filter((e) => e !== "militia");
      let allUnits = new Array(display_units.length).fill(0);
      let lostUnits = new Array(display_units.length).fill(0);
      tables
        .find("tr:nth-child(2)")
        .find("td.unit-item")
        .each((i, e) => {
          let index = i % display_units.length;
          allUnits[index] += isNaN(parseInt(e.innerText))
            ? 0
            : parseInt(e.innerText);
        });
      tables
        .find("tr:nth-child(3)")
        .find("td.unit-item")
        .each((i, e) => {
          let index = i % display_units.length;
          lostUnits[index] += isNaN(parseInt(e.innerText))
            ? 0
            : parseInt(e.innerText);
        });
      let sumTable = $("<table>").append("<tbody>").append("<tr>");
      let th,
        tr1,
        tr2 = "";
      th += "<tr><th>Gesamt (" + tables.length + ")</th>";
      tr1 += "</tr><tr><td>Anzahl:</td>";
      tr2 += "</tr><tr><td>Verluste:</td>";
      for (let i = 0; i < display_units.length; i++) {
        let unit = display_units[i];
        th +=
          '<th width="35"><a href="#" class="unit_link" data-unit="' +
          unit +
          '"><img src="https://dsde.innogamescdn.com/asset/689698d9/graphic/unit/unit_' +
          unit +
          '.png" alt="" ' +
          (allUnits[i] === 0 ? 'class="faded"' : 'class=""') +
          "></a></th>";
        tr1 +=
          '<td class="unit-item ' +
          (allUnits[i] === 0 ? "hidden" : "") +
          '">' +
          allUnits[i] +
          "</td>";
        tr2 +=
          '<td class="unit-item ' +
          (lostUnits[i] === 0 ? "hidden" : "") +
          '">' +
          lostUnits[i] +
          "</td>";
      }
      tr2 += "</tr>";
      $(".report_ReportSupportAttackMerged table:nth-child(1)").after(
        $("<table>")
          .append("<tbody>")
          .append(th + tr1 + tr2)
      );
      $(".report_ReportSupportAttackMerged table:nth-child(2)")
        .next()
        .after(
          `<button class="btn" id="toggleEntrys" >Alle anzeigen / ausblenden</button>`
        );
      $(".report_ReportSupportAttackMerged")
        .children()
        .filter((i) => i > 3)
        .toggle();
      document.getElementById("toggleEntrys").onclick = function () {
        $(".report_ReportSupportAttackMerged")
          .children()
          .filter((i) => i > 3)
          .toggle();
      };
    }
    //angriff oder verteidigungs Bericht
    if ($(".report_ReportAttack")) {
      // Bashpoints
      const unit_points = {
        //  def   att
        spear: [4, 1],
        sword: [5, 2],
        axe: [1, 4],
        archer: [5, 2],
        spy: [1, 2],
        light: [5, 13],
        marcher: [6, 12],
        heavy: [23, 15],
        ram: [4, 8],
        catapult: [12, 10],
        knight: [40, 20],
        priest: [0, 0],
        snob: [200, 200],
        militia: [4, 0],
      };

      let attackers_points = 0;
      let defender_points = 0;
      $("#attack_info_att_units tr:nth-child(3) td:gt(0)").each((i, e) => {
        attackers_points +=
          parseInt(e.innerText) * unit_points[game_data.units[i]][1];
      });
      $("#attack_info_def_units tr:nth-child(3) td:gt(0)").each((i, e) => {
        defender_points +=
          parseInt(e.innerText) * unit_points[game_data.units[i]][0];
      });
      if (attackers_points > 0)
        $("#attack_info_att tbody tr:nth-child(1) th:nth-child(2)").append(
          '<p style="float: right; display: inline; margin: auto;">ODD: ' +
            attackers_points +
            "</p>"
        );
      if (defender_points > 0)
        $("#attack_info_def tbody tr:nth-child(1) th:nth-child(2)").append(
          '<p style="float: right; display: inline; margin: auto;">ODA: ' +
            defender_points +
            "</p>"
        );
    }
  }

  /* ===== Überlebende Truppen ===== */
  function survivedReport() {
    /* ORIGINALCODE – unverändert */
  }

  /* ===== UT Preview ===== */
  function customReportPreview() {
    /* ORIGINALCODE – unverändert */
  }

  /* ===== Abschick- & Rückkehrzeiten ===== */
  function sendAndReTimes() {
    if (
      $(`#attack_info_att_units`).length === 0 ||
      !SettingsHelper.checkConfigs()
    ) {
      return;
    }
    const [x1, y1, x2, y2] = $(
      'span.village_anchor a[href*="info_village"]'
    ).map((i, e) =>
      e.innerText
        .match(/\d{3}\|\d{3}/)[0]
        .split("|")
        .map((e) => parseInt(e))
    );
    const deltaX = Math.abs(x1 - x2);
    const deltaY = Math.abs(y1 - y2);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    let isPublic = false;
    let attackTimeElement = $(
      "#content_value > table > tbody > tr > td:nth-child(2) > table > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2)"
    );
    let attackkTimeElement = null;
    if (attackTimeElement.length === 0) {
      //public reports
      attackTimeElement = $(
        "#content_value > table > tbody > tr > td:nth-child(2) > table > tbody > tr > td > h4:nth-child(2)"
      );
      attackkTimeElement = attackTimeElement;
      isPublic = true;
    } else {
      //normal reports
      attackkTimeElement = attackTimeElement.find("td:nth-child(2)");
    }
    let attackTime = null;
    if (SettingsHelper.getServerConf().commands.millis_arrival === "1") {
      attackTime = new Date(
        attackkTimeElement
          .text()
          .trim()
          .replace(
            /(.*)\.(.*)\.(.*) (.*):(.*):(.*):(.*)/,
            "20$3-$2-$1T$4:$5:$6.$7"
          )
      );
    } else {
      let a = attackkTimeElement.text().trim();
      let b = a.split(" ");
      let [day, month, rest] = b[0].split(".");
      let result = ["20" + rest, month, day].join("-") + "T" + b[1];
      attackTime = new Date(result);
    }

    const slowestUnit = $(`#attack_info_att_units tr:nth-child(2) td:gt(0)`)
      .map((i, e) => {
        const unitSpeed =
          SettingsHelper.getUnitConf()[
            $(`#attack_info_att_units tr:nth-child(1) td:gt(0) a`)
              .get(i)
              .getAttribute("data-unit")
          ].speed;
        return e.innerText === "0" ? 0 : parseInt(unitSpeed);
      })
      .get()
      .reduce((a, b) => (a > b ? a : b));

    const msPerSec = 1000;
    const secsPerMin = 60;
    const msPerMin = 60000;

    const travelTime =
      Math.round((slowestUnit * distance * msPerMin) / 1000) * 1000;

    attackTimeElement.before(
      $(formatDateTime(attackTime - travelTime, "Abschickzeit", isPublic))
    );

    attackTimeElement.after(
      $(
        formatDateTime(
          Math.floor((attackTime.getTime() + travelTime) / msPerSec) * msPerSec,
          "R\u00FCckkehrzeit",
          isPublic
        )
      )
    );
  }

  function formatDateTime(date, title, isPublic) {
    /* ORIGINALCODE – unverändert */
  }

  function spyInformation() {
    if (
      $('[id*="attack_spy_buildings_"]').length === 0 ||
      !SettingsHelper.checkConfigs()
    ) {
      return;
    }

    let config_base_production;
    let config_speed;
    let attack_spy_building_data;
    let building_pop;
    let unit_pop;
    let building_points;

    //SettingsHelper.getUnitConf()
    config_base_production = parseInt(
      SettingsHelper.getServerConf().game.base_production
    );
    config_speed = parseFloat(SettingsHelper.getServerConf().speed);
    attack_spy_building_data = JSON.parse(
      $("#attack_spy_building_data").attr("value")
    );
    building_pop = {
      main: {
        pop: 5,
        pop_factor: 1.17,
      },
      barracks: {
        pop: 7,
        pop_factor: 1.17,
      },
      stable: {
        pop: 8,
        pop_factor: 1.17,
      },
      garage: {
        pop: 8,
        pop_factor: 1.17,
      },
      church: {
        pop: 5000,
        pop_factor: 1.55,
      },
      church_f: {
        pop: 5,
        pop_factor: 1.55,
      },
      watchtower: {
        pop: 500,
        pop_factor: 1.18,
      },
      snob: {
        pop: 80,
        pop_factor: 1.17,
      },
      smith: {
        pop: 20,
        pop_factor: 1.17,
      },
      place: {
        pop: 0,
        pop_factor: 1.17,
      },
      statue: {
        pop: 10,
        pop_factor: 1.17,
      },
      market: {
        pop: 20,
        pop_factor: 1.17,
      },
      wood: {
        pop: 5,
        pop_factor: 1.155,
      },
      stone: {
        pop: 10,
        pop_factor: 1.14,
      },
      iron: {
        pop: 10,
        pop_factor: 1.17,
      },
      farm: {
        pop: 0,
        pop_factor: 1,
      },
      storage: {
        pop: 0,
        pop_factor: 1.15,
      },
      hide: {
        pop: 2,
        pop_factor: 1.17,
      },
      wall: {
        pop: 5,
        pop_factor: 1.17,
      },
    };

    unit_pop = {
      spear: 1,
      sword: 1,
      axe: 1,
      archer: 1,
      spy: 2,
      light: 4,
      marcher: 5,
      heavy: 6,
      ram: 5,
      catapult: 8,
      knight: 10,
      priest: 0,
      snob: 100,
      militia: 0,
    };

    building_points = {
      main: [
        10, 2, 2, 3, 4, 4, 5, 6, 7, 9, 10, 12, 15, 18, 21, 26, 31, 37, 44, 53,
        64, 77, 92, 110, 133, 159, 191, 229, 274, 330,
      ],
      barracks: [
        16, 3, 4, 5, 5, 7, 8, 9, 12, 14, 16, 20, 24, 28, 34, 42, 49, 59, 71, 85,
        102, 123, 147, 177, 212,
      ],
      stable: [
        20, 4, 5, 6, 6, 9, 10, 12, 14, 17, 21, 25, 29, 36, 43, 51, 62, 74, 88,
        107,
      ],
      garage: [24, 5, 6, 6, 9, 10, 12, 14, 17, 21, 25, 29, 36, 43, 51],
      church: [10, 2, 2],
      church_f: [10],
      snob: [512, 102, 123],
      smith: [
        19, 4, 4, 6, 6, 8, 10, 11, 14, 16, 20, 23, 28, 34, 41, 49, 58, 71, 84,
        101,
      ],
      place: [0],
      statue: [24],
      market: [
        10, 2, 2, 3, 4, 4, 5, 6, 7, 9, 10, 12, 15, 18, 21, 26, 31, 37, 44, 53,
        64, 77, 92, 110, 133, 159, 191, 229, 274, 330,
      ],
      wood: [
        6, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38,
        46, 55, 66, 80, 95, 115, 137, 165, 198,
      ],
      stone: [
        6, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38,
        46, 55, 66, 80, 95, 115, 137, 165, 198,
      ],
      iron: [
        6, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38,
        46, 55, 66, 80, 95, 115, 137, 165, 198,
      ],
      farm: [
        5, 1, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32,
        38, 46, 55, 66, 80, 95, 115, 137, 165,
      ],
      storage: [
        6, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38,
        46, 55, 66, 80, 95, 115, 137, 165, 198,
      ],
      hide: [5, 1, 1, 2, 1, 2, 3, 3, 3, 5],
      wall: [
        8, 2, 2, 2, 3, 3, 4, 5, 5, 7, 9, 9, 12, 15, 17, 20, 25, 29, 36, 43,
      ],
      watchtower: [
        42, 8, 10, 13, 14, 18, 20, 25, 31, 36, 43, 52, 62, 75, 90, 108, 130,
        155, 186, 224,
      ],
    };

    function getStorage(lvl) {
      return Math.round(1000 * Math.pow(1.2294934, parseInt(lvl) - 1));
    }

    function getFarm(lvl) {
      return Math.round(240 * Math.pow(1.17210245334, parseInt(lvl) - 1));
    }

    function getResProduction(lvl) {
      return Math.round(
        parseFloat(config_base_production) *
          parseFloat(config_speed) *
          Math.pow(1.163118, parseInt(lvl) - 1)
      );
    }

    function getMarket(lvl) {
      let marketTradesmen = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 19, 26, 35, 46, 59, 74, 91,
        110, 131, 154, 179, 206, 235,
      ];
      return marketTradesmen[parseInt(lvl)];
    }

    function numberWithCommas(x) {
      const value = new Intl.NumberFormat("de-DE").format(x);
      return value.length < 10
        ? length < 6
          ? value
          : value.substr(0, value.length - 4) + "K "
        : value.substr(0, value.length - 8) + "Mio ";
    }

    function popUsed(buildingType, level) {
      let building = building_pop[buildingType];
      if (typeof building === "undefined") {
        return 0;
      }
      return Math.round(
        building.pop * building.pop_factor ** (parseInt(level) - 1)
      );
    }

    function calcBuildingPop() {
      let pop = 0;
      for (let e in attack_spy_building_data) {
        let building = attack_spy_building_data[e];
        pop += popUsed(building.id, building.level);
      }
      return pop;
    }

    function calcUnitLeftPop() {
      let pop = 0;
      $("#attack_info_def_units tr:nth-child(2) td:gt(0)").each((i, e) => {
        let loss = parseInt(
          $("#attack_info_def_units tr:nth-child(3) td:gt(0)")[i].innerText
        );
        pop += (parseInt(e.innerText) - loss) * unit_pop[game_data.units[i]];
      });
      return pop;
    }
    function calcUnitSpyPop() {
      let pop = 0;
      $("#attack_spy_away table.vis tr:nth-child(2) td").each((i, e) => {
        pop += parseInt(e.innerText) * unit_pop[game_data.units[i]];
      });
      return pop;
    }

    let wood_lvl = $('[id*="attack_spy_buildings_"] td:has(img[src*="wood"])')
      .next()
      .text();
    let stone_lvl = $('[id*="attack_spy_buildings_"] td:has(img[src*="stone"])')
      .next()
      .text();
    let iron_lvl = $('[id*="attack_spy_buildings_"] td:has(img[src*="iron"])')
      .next()
      .text();
    let storage_lvl = $(
      '[id*="attack_spy_buildings_"] td:has(img[src*="storage"])'
    )
      .next()
      .text();
    let farm_lvl = $('[id*="attack_spy_buildings_"] td:has(img[src*="farm"])')
      .next()
      .text();
    let pop_all_buildings = calcBuildingPop();
    let pop_max = getFarm(farm_lvl);
    let pop_unit_spy = calcUnitSpyPop();
    let pop_unit_left = calcUnitLeftPop();
    let points = attack_spy_building_data
      .map((e) =>
        building_points[e.id].slice(0, e.level).reduce((a, b) => a + b)
      )
      .reduce((a, b) => a + b);

    $("#attack_spy_buildings_right")
      .after(`<table id="attack_results" width="100%" style="border: 1px solid #DED3B9"><tbody>
            <tr><th>Punkte</th>
                <td colspan="2">
                    <span class="nowrap" style="margin-left: 0.5em;"><b>${numberWithCommas(
                      points
                    )} P</b></span>
                </td>
             </tr>
            <tr><th>Produktion</th>
            <td width="250">
                <span class="nowrap"><span class="icon header wood" title="Holz"></span>${numberWithCommas(
                  getResProduction(wood_lvl)
                )}</span>
                <span class="nowrap"><span class="icon header stone" title="Lehm"> </span>${numberWithCommas(
                  getResProduction(stone_lvl)
                )}</span>
                <span class="nowrap"><span class="icon header iron" title="Eisen"> </span>${numberWithCommas(
                  getResProduction(iron_lvl)
                )}</span>
            </td><td><span class="nowrap"><span class="icon header ressources"> </span>${numberWithCommas(
              getStorage(storage_lvl)
            )}</span></td>
            </tr><tr><th>Bev\u00f6lkerung</th>
                <td colspan="2">
                    <span class="nowrap" style="margin-left: 0.5em;" title="Auserhalb ${pop_unit_spy} und Im Dorf ${pop_unit_left}">Truppen <b>${numberWithCommas(
      pop_unit_spy + pop_unit_left
    )}</b></span>
                    <span class="nowrap" style="margin-left: 0.5em;">Geb\u00E4ude <b>${numberWithCommas(
                      pop_all_buildings
                    )}</b></span>
                    <span class="nowrap" style="margin-left: 0.5em;" title="Maximal ${numberWithCommas(
                      pop_max - pop_all_buildings - pop_unit_spy
                    )} frei wenn nur Truppen auserhalb beachtet werden." >Frei <b>${numberWithCommas(
      pop_max - pop_all_buildings - pop_unit_spy - pop_unit_left
    )}</b></span>
                </td>
         </tr></tbody></table>`);
  }
})();
