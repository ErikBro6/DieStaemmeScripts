// ==UserScript==
// @name         Raubzug schicken + Auto Toggle
// @version      1.5
// @description  Rechnet/Fügt die Truppen ein und sendet automatisch alle 30s mit Toggle & sequentiellen Startklicks (von hinten nach vorne) + 2 Optimierungsoptionen
// @author       TheHebel97, Osse (+auto by you)
// @match        https://*.die-staemme.de/game.php?*&screen=place&mode=scavenge*
// @run-at       document-idle
// ==/UserScript==

var api = typeof unsafeWindow != 'undefined' ? unsafeWindow.ScriptAPI : window.ScriptAPI;
api.register('470-Raubzug schicken', true, 'osse, TheHebel97', 'support-nur-im-forum@die-staemme.de');

(function () {
  'use strict';

  // ---- Auto Config ----
  const AUTO_INTERVAL_MS = 30_000;
  const AUTO_KEY = 'dsu_scavenger_auto_enabled';
  let autoEnabled = JSON.parse(localStorage.getItem(AUTO_KEY) || 'true');
  let autoIv = null;
  let autoBusy = false;
  let lastClickTs = 0;

  // [ADD] Optimization (only two modes)
  const OPT_KEY = 'dsu_scavenger_opt_mode'; // 'equalTime' | 'perHour'
  let optMode = localStorage.getItem(OPT_KEY) || 'equalTime';

  // [ADD] Carry map (common TW values; only units present on this screen)
  const CARRY = { spear: 25, sword: 15, axe: 10, light: 80, heavy: 50, knight: 100 };

  // [ADD] Scavenge ratios
  const RATIOS = [0.10, 0.25, 0.50, 0.75];

  setTimeout(function () {
    setupUI();
// ---- Auto-Refresh nach Scavenge-Ende ---------------------------------------
const REFRESH_JITTER_MS = 1200;      // ~1.2s nach 00:00:00 neu laden
const MAX_REASONABLE_MS = 8 * 3600_000; // Safety: >8h ignorieren
let refreshTmo = null;

// "H:MM:SS" -> Sekunden
function parseHMS(t) {
  if (!t) return null;
  const m = String(t).trim().match(/^(\d+):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), mi = parseInt(m[2], 10), s = parseInt(m[3], 10);
  return (h * 3600) + (mi * 60) + s;
}

// Liefert die kleinste Restzeit aller aktiven Countdowns in ms (oder null)
function getMinCountdownMs() {
  let minSec = null;
  $('.scavenge-option .active-view .return-countdown').each(function () {
    const sec = parseHMS($(this).text());
    if (sec == null) return;
    if (minSec == null || sec < minSec) minSec = sec;
  });
  if (minSec == null) return null;
  const ms = (minSec * 1000) + REFRESH_JITTER_MS;
  if (ms <= 0 || ms > MAX_REASONABLE_MS) return null;
  return ms;
}

// Plant den nächsten Reload neu
function scheduleNextReload() {
  if (refreshTmo) { clearTimeout(refreshTmo); refreshTmo = null; }
  const ms = getMinCountdownMs();
  if (ms == null) return;           // nichts aktiv -> kein Reload nötig
  refreshTmo = setTimeout(() => {
    // Falls inzwischen neue Countdowns hinzugekommen sind, prüfe sofort nochmal
    // (verhindert verfrühten Reload, wenn DOM sich gerade geändert hat)
    const recheck = getMinCountdownMs();
    if (recheck != null && recheck > 1500) {
      // Noch nicht ganz fertig, neu planen
      scheduleNextReload();
      return;
    }
    // Alles gut: neu laden
    location.reload();
  }, ms);
}

// Debounce-Helfer für Observer
function debounce(fn, wait) {
  let t = null;
  return function () {
    if (t) clearTimeout(t);
    t = setTimeout(fn, wait);
  };
}

// Beobachtet Änderungen an Countdowns / Status-Wechseln
function installScavengeObserver() {
  const host = document.querySelector('.options-container');
  if (!host) return;
  const reschedule = debounce(scheduleNextReload, 200);

  const mo = new MutationObserver((mutList) => {
    // Nur reagieren, wenn Text/Nodes im relevanten Bereich sich ändern
    for (const m of mutList) {
      if (m.type === 'characterData') { reschedule(); return; }
      if (m.type === 'childList') {
        // Neue/entfernte .active-view / .return-countdown / Buttons
        if ([...m.addedNodes, ...m.removedNodes].some(n => {
          return (n.nodeType === 1) && (
            n.matches?.('.active-view, .return-countdown, .free_send_button, .premium_send_button') ||
            n.querySelector?.('.active-view, .return-countdown, .free_send_button, .premium_send_button')
          );
        })) { reschedule(); return; }
      }
      if (m.type === 'attributes' && (m.target?.classList?.contains('return-countdown'))) {
        reschedule(); return;
      }
    }
  });

  mo.observe(host, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class'] // schlank halten
  });

  // Initial planen
  scheduleNextReload();

  // Fail-safe: alle 30s neu berechnen (falls Observer Events verpassen sollte)
  setInterval(scheduleNextReload, 30_000);
}

// Initialisierung sofort nach UI-Aufbau
installScavengeObserver();

// Optional: nach Auto-Send neu planen (falls Sie unmittelbar Buttons klicken)
const _oldRunAutoOnce = runAutoOnce;
runAutoOnce = function () {
  _oldRunAutoOnce();
  // nach Klicks/Dispatch leicht verzögert neu planen
  setTimeout(scheduleNextReload, 1500);
};

    let storage = localStorage;
    getLocalStorage();

    $(".saveLocalStorage").on("click", function () {
      setLocalStorage();
    });

    $(".clearLocalStorage").on("click", function () {
      storage.removeItem("scavenger");
    });

    let Start = 0;
    let rzSlots;
    let Truppenarray = [];

    $(".SendScavenger").on("click", function () {
      Start = 1;
      rzSlots = readOutRZSlotsCB();
      let arrayUseableTroops = getTroopAmount(); // [{unit, amount, value}, ...]
      let SendTroops = [];

      // [ADD] Build enabled slot indices
      const enabledIdx = [];
      for (let i = 0; i < 4; i++) if (rzSlots.charAt(i) === '1') enabledIdx.push(i);

      // [ADD] Compute GLOBAL fractional split 'a' (sum to 1 over enabled)
      const totalCap = arrayUseableTroops.reduce((s, e) => s + (CARRY[e.unit] || 0) * (parseInt(e.amount) || 0), 0);
      const a = (optMode === 'perHour')
        ? computeOptimalA_PerHour(totalCap, enabledIdx)
        : computeEqualTimeA(enabledIdx);

      // [ADD] Split each *unit count* according to 'a' (minimal change)
      arrayUseableTroops.forEach(element => {
        SendTroops[element.unit] = splitByFractions(element.amount, a);
      });

      Truppenarray = SendTroops;
      startScavenger();
    });

    $(".free_send_button").on("click", function () {
      if (Start === 1) {
        $(".SendScavenger").css('visibility', "hidden");
        startScavenger();
      }
    });

    if ($('.premium_send_button').length > 0) {
      $(".premium_send_button").on("click", function () {
        setTimeout(() => { sendPremium(); }, 200);
      });
    }

    function sendPremium() {
      $(".evt-confirm-btn").on("click", function () {
        if (Start === 1) {
          $(".SendScavenger").css('visibility', "hidden");
          startScavenger();
        }
      });
    }

    String.prototype.replaceAt = function (index, replacement) {
      return this.substr(0, index) + replacement + this.substr(index + replacement.length);
    }

    function startScavenger() {
      setTimeout(function () {
        let Scaveng = 0;
        for (let index = 3; index > -1; index--) {
          const element = rzSlots.charAt(index)
          if (element === "1" && Scaveng === 0) {
            Scaveng = 1;
            if ($('.scavenge-option').eq(index).find('.premium_send_button').length > 0) {
              $('.scavenge-option').eq(index).find('.premium_send_button').css('visibility', "visible");
            }
            if ($('.scavenge-option').eq(index).find('.free_send_button').length > 0) {
              $('.scavenge-option').eq(index).find('.free_send_button').css('visibility', "visible");
            }
            getTroopAmount().forEach(element => {
              let eInput = document.querySelector("#scavenge_screen > div > div.candidate-squad-container > table > tbody > tr:nth-child(2) > td:nth-child(" + element["value"] + ") > input")
              eInput.value = Truppenarray[element["unit"]][index];
              let event = new Event('change');
              eInput.dispatchEvent(event);
            });
            rzSlots = rzSlots.replaceAt(index, "0");
          } else {
            if ($('.scavenge-option').eq(index).find('.premium_send_button').length > 0) {
              $('.scavenge-option').eq(index).find('.premium_send_button').css('visibility', "hidden");
            }
            if ($('.scavenge-option').eq(index).find('.free_send_button').length > 0) {
              $('.scavenge-option').eq(index).find('.free_send_button').css('visibility', "hidden");
            }
          }
        }
      }, 200);
    }

    function getNumberOfUnlockedScavengeSlots() {
      return 4 - $(".lock").length;
    }

    function getTroopAmount() {
      let troopObject = [];
      let value = 0;
      game_data.units.forEach(element => {
        if (element != "ram" && element != "catapult" && element != "spy") {
          value += 1;
        }
        if ($("input[unit='" + element + "']").is(":checked")) {
          $(".unitsInput").each(function () {
            if (this.name === element) {
              let amount = $(".units-entry-all[data-unit='" + element + "']").text().match(/\d+/)[0];
              if (parseInt($('.maxTroops').val()) < amount) {
                amount = parseInt($('.maxTroops').val());
              }
              let temparray = { unit: element, amount: amount, value: value };
              if (parseInt(amount) > 0) troopObject.push(temparray)
            }
          })
        }
      });
      return troopObject
    }

    // [ADD] Distribute a unit count by fractions a[0..3]
    function splitByFractions(amount, a) {
      const res = [0,0,0,0];
      let assigned = 0;
      for (let i = 0; i < 4; i++) {
        const v = Math.floor((amount || 0) * (a[i] || 0));
        res[i] = v;
        assigned += v;
      }
      // put any remainder into the last enabled slot (if any)
      const remainder = (amount || 0) - assigned;
      if (remainder > 0) {
        for (let i = 3; i >= 0; i--) {
          if (a[i] > 0) { res[i] += remainder; break; }
        }
      }
      return res;
    }

    // [ADD] Equal-time fractions: a_i ∝ 1/ratio_i for enabled slots
    function computeEqualTimeA(enabledIdx) {
      const a = [0,0,0,0];
      let sum = 0;
      enabledIdx.forEach(i => { a[i] = 1 / RATIOS[i]; sum += a[i]; });
      if (sum <= 0) return a;
      enabledIdx.forEach(i => { a[i] = a[i] / sum; });
      return a;
    }

    // [ADD] Resources/hour objective (df cancels for optimization)
    function revPerHour(iCap, ai, i) {
      if (ai <= 0) return 0;
      const r = RATIOS[i];
      // revenue = (iCap*ai*r) / ( ((iCap*ai)^2 * 100 * r^2) ^0.45 + 1800 )
      const load = iCap * ai;
      const denom = Math.pow((load*load) * 100 * (r*r), 0.45) + 1800;
      return (load * r) / denom;
    }

    // [ADD] Evaluate total revenue for vector a
    function totalRev(iCap, a) {
      let s = 0;
      for (let i = 0; i < 4; i++) s += revPerHour(iCap, a[i] || 0, i);
      return s;
    }

    // [ADD] Optimize a over enabled by simple coordinate-descent (adjacent transfers)
    function computeOptimalA_PerHour(iCap, enabledIdx) {
      const a = [0,0,0,0];
      if (!enabledIdx.length || iCap <= 0) return a;

      // init equal over enabled
      enabledIdx.forEach(i => a[i] = 1 / enabledIdx.length);

      let improved = true;
      let guard = 0;
      while (improved && guard++ < 200) {
        improved = false;
        for (let k = 0; k < enabledIdx.length - 1; k++) {
          const i = enabledIdx[k], j = enabledIdx[k+1];

          const cur = totalRev(iCap, a);

          // move half of i -> j
          if (a[i] > 0) {
            const di = a[i] * 0.5;
            a[i] -= di; a[j] += di;
            const v1 = totalRev(iCap, a);
            // revert if worse
            if (v1 <= cur) { a[j] -= di; a[i] += di; } else { improved = true; continue; }
          }

          // move half of j -> i
          if (a[j] > 0) {
            const dj = a[j] * 0.5;
            a[j] -= dj; a[i] += dj;
            const v2 = totalRev(iCap, a);
            if (v2 <= cur) { a[i] -= dj; a[j] += dj; } else { improved = true; }
          }
        }
      }
      return a;
    }

    function setupUI() {
      $(".border-frame-gold-red").css("padding-bottom", "10px");
      $(".candidate-squad-widget > tbody > tr").eq(0).append("<th>Senden</th>");
      $(".candidate-squad-widget > tbody > tr").eq(1).append('<td><button class="SendScavenger btn">Raubzug senden</button></td>');
      let Options = `<label>max. Truppen</label><input class="maxTroops" type="number" min="10" max="10000" checked><button class="clearLocalStorage btn">Default löschen</button><button class="saveLocalStorage btn">Default speichern</button>`;
      $(".candidate-squad-widget").before(Options);

      for (let index = 0; index < getNumberOfUnlockedScavengeSlots(); index++) {
        $(".preview").eq(index).before('<input class="checkbox_' + index + '" type="checkbox" checked style="margin-left: 50%;margin-top: 10px;" unit="' + index + '">');
        if ($(".preview").eq(index).find(".return-countdown").length) {
          $(".checkbox_" + index).prop('disabled', true);
          $(".checkbox_" + index).removeAttr("checked");
        }
      }
      $(".unit_link").each(function () {
        let unit = $(this).attr("data-unit");
        $(this).parent().append('<input class="checkboxTroops" type="checkbox" checked="" style="width:20%;" unit="' + unit + '"></input>');
      });

      // ---- Auto-Toggle UI ----
      addToggleUI();

      // [ADD] Two-option optimization UI (mutually exclusive)
      addOptimizationUI();

      // ---- Start Auto Timer ----
      if (!autoIv) {
        autoIv = setInterval(runAutoOnce, AUTO_INTERVAL_MS);
        setTimeout(runAutoOnce, 800);
      }
    }

    function addToggleUI() {
      if ($('#dsu-auto-toggle').length) return;
      const box = $(`
        <div id="dsu-auto-toggle" style="
          position:fixed;right:10px;bottom:50px;z-index:9999;
          background:#222;color:#fff;padding:8px 10px;border-radius:8px;
          box-shadow:0 4px 18px rgba(0,0,0,.3);font:12px system-ui;display:flex;align-items:center;gap:8px;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input id="autoEnabledBox" type="checkbox" ${autoEnabled ? 'checked' : ''}>
            Auto Raubzug (30s)
          </label>
          <span style="opacity:.8">⏱️ <span id="autoLast">–</span></span>
        </div>
      `);
      $('body').append(box);
      $('#autoEnabledBox').on('change', function () {
        autoEnabled = $(this).is(':checked');
        localStorage.setItem(AUTO_KEY, JSON.stringify(autoEnabled));
      });

      setInterval(() => {
        const sec = lastClickTs ? Math.floor((Date.now() - lastClickTs) / 1000) : '–';
        $('#autoLast').text(sec + 's');
      }, 1000);
    }

    // [ADD] Two checkboxes right above the table
    function addOptimizationUI() {
      if ($('#dsu-opt-box').length) return;

      const optBox = $(`
        <div id="dsu-opt-box" style="margin:6px 0 10px 0;display:flex;gap:18px;align-items:center;">
          <strong>Optimierung:</strong>
          <label style="display:inline-flex;gap:6px;align-items:center;cursor:pointer;">
            <input type="checkbox" id="optEqualTime">
            Gleiche Dauer
          </label>
          <label style="display:inline-flex;gap:6px;align-items:center;cursor:pointer;">
            <input type="checkbox" id="optPerHour">
            Rohstoffe / Stunde
          </label>
          <span style="opacity:.7;font-size:11px">(*wirkt beim Klick auf "Raubzug senden")</span>
        </div>
      `);

      $(".candidate-squad-widget").before(optBox);

      // restore
      $('#optEqualTime').prop('checked', optMode === 'equalTime');
      $('#optPerHour').prop('checked', optMode === 'perHour');

      // mutual exclusivity + persist
      $('#optEqualTime').on('change', function () {
        if ($(this).is(':checked')) {
          $('#optPerHour').prop('checked', false);
          optMode = 'equalTime';
        } else {
          optMode = $('#optPerHour').is(':checked') ? 'perHour' : 'equalTime';
        }
        localStorage.setItem(OPT_KEY, optMode);
      });
      $('#optPerHour').on('change', function () {
        if ($(this).is(':checked')) {
          $('#optEqualTime').prop('checked', false);
          optMode = 'perHour';
        } else {
          optMode = $('#optEqualTime').is(':checked') ? 'equalTime' : 'perHour';
        }
        localStorage.setItem(OPT_KEY, optMode);
      });
    }

    function readOutRZSlotsCB() {
      let level = "";
      for (let index = 0; index < getNumberOfUnlockedScavengeSlots(); index++) {
        if ($('.checkbox_' + index).is(":checked")) {
          level += "1";
        } else {
          level += "0";
        }
      }
      if (level.length < 4) {
        for (let index = level.length; index < 4; index++) {
          level += "0";
        }
      }
      return level;
    }

    function getLocalStorage() {
      let data = storage.getItem("scavenger")
      if (data != null) {
        data = JSON.parse(data);
        data.forEach(element => {
          $("input[unit='" + element.unit + "']").prop('checked', element.checked);
        });
      }
      let maxValue = storage.getItem("maxScavenger")
      if (data != null) {
        $(".maxTroops").val(maxValue);
      }
      let selectedScavenger = storage.getItem("SelectionScavenger")
      if (selectedScavenger != null) {
        selectedScavenger = JSON.parse(selectedScavenger);
        for (let index = 0; index < 4; index++) {
          if (selectedScavenger[index] == 1 && $(".checkbox_" + index).attr('disabled') == undefined) {
            $(".checkbox_" + index).prop("checked", true);
          } else {
            $(".checkbox_" + index).prop("checked", false);
          }
        }
      }
    }

    function setLocalStorage() {
      let tempArray = [];
      $(".checkboxTroops").each(function () {
        let tempObject = { unit: $(this).attr("unit"), checked: $(this).is(":checked") }
        tempArray.push(tempObject)
      })
      storage.setItem("scavenger", JSON.stringify(tempArray))
      let maxValue = $(".maxTroops").val();
      storage.setItem("maxScavenger", maxValue)
      tempArray = [];
      for (let index = 0; index <= 4; index++) {
        if ($(".checkbox_" + index).is(':checked')) { tempArray.push(1); } else { tempArray.push(0); }
      }
      storage.setItem("SelectionScavenger", JSON.stringify(tempArray))
    }

    // ---- Auto Flow (unchanged) ----
    function runAutoOnce() {
      if (!autoEnabled || autoBusy) return;
      const $send = $('.SendScavenger.btn:visible');
      if (!$send.length) return;

      autoBusy = true;
      try {
        $send.first().trigger('click');
        lastClickTs = Date.now();

        setTimeout(() => {
          const $starts = $('.scavenge-option .free_send_button:visible');
          let idx = $starts.length - 1;
          function clickNext() {
            if (idx < 0) { autoBusy = false; return; }
            const $btn = $starts.eq(idx);
            if ($btn && $btn.length) $btn.trigger('click');
            idx--;
            setTimeout(clickNext, 1000);
          }
          clickNext();
        }, 1000);
      } catch (e) {
        autoBusy = false;
      }
    }

  }, 50);
})();
