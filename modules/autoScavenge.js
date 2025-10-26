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
  const POST_FINISH_DELAY_MS = 1500;   // extra wait after 00:00:00 before reloading
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
// Robust reload that works on Firefox/containers too
function forceReload(cacheBust = true) {
  try {
    const url = new URL(location.href);
    if (cacheBust) url.searchParams.set('_tmr', Date.now());
    // replace() avoids polluting history
    location.replace(url.toString());
  } catch {
    // Fallback
    location.href = location.href;
  }
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
    if (recheck != null && recheck > 2500) {
      // Noch nicht ganz fertig, neu planen
      scheduleNextReload();
      return;
    }
     setTimeout(() => {
      forceReload(true);
    }, POST_FINISH_DELAY_MS);
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

// OLD:
// arrayUseableTroops.forEach(element => {
//   SendTroops[element.unit] = splitByFractions(element.amount, a);
// });

// NEW:
const plan = buildSlotPlans(arrayUseableTroops, a, enabledIdx);
for (const {unit} of arrayUseableTroops) {
  SendTroops[unit] = plan[unit];
}


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
              let eInput = document.querySelector(
  `.candidate-squad-container input.unitsInput[name="${element.unit}"]`
);
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
  const wants  = a.map(x => (amount||0)*(x||0));
  const res    = wants.map(Math.floor);
  let rem      = (amount||0) - res.reduce((s,v)=>s+v,0);
  const order  = [0,1,2,3].sort((i,j)=>(wants[j]-res[j])-(wants[i]-res[i]));
  for (let t=0; t<rem; t++) res[order[t % order.length]]++;
  return res;
}



    // [ADD] Equal-time fractions: a_i ∝ 1/ratio_i for enabled slots
function computeEqualTimeA(enabled) {
  const a = [0,0,0,0];
  let sum = 0;
  enabled.forEach(i => { a[i] = 1 / RATIOS[i]; sum += a[i]; });
  if (sum) enabled.forEach(i => a[i] /= sum);
  return a;
}




function revPerHour(iCap, ai, i) {
  if (ai <= 0) return 0;
  const r = RATIOS[i];
  const load  = iCap * ai;
  const denom = Math.pow((load*load) * 100 * (r*r), 0.45) + 1800; // df cancels for choosing a
  return (load * r) / denom;
}

function totalRev(iCap, a) {
  let s = 0; for (let i=0;i<4;i++) s += revPerHour(iCap, a[i]||0, i); return s;
}


    // [ADD] Optimize a over enabled by simple coordinate-descent (adjacent transfers)
   function computeOptimalA_PerHour(iCap, enabled) {
  const a = [0,0,0,0];
  if (!enabled.length || iCap <= 0) return a;
  enabled.forEach(i => a[i] = 1/enabled.length);

  const pairs = [];
  for (let x=0;x<enabled.length;x++)
    for (let y=x+1;y<enabled.length;y++)
      pairs.push([enabled[x], enabled[y]]);

  let step = 0.5, guard = 0;
  while (step > 1e-4 && guard++ < 400) {
    let improved = false, cur = totalRev(iCap, a);
    for (const [i,j] of pairs) {
      if (a[i] > 0) {
        const di = Math.min(a[i], step);
        a[i]-=di; a[j]+=di;
        const v = totalRev(iCap, a);
        if (v > cur) { cur = v; improved = true; continue; }
        a[i]+=di; a[j]-=di; // revert
      }
      if (a[j] > 0) {
        const dj = Math.min(a[j], step);
        a[j]-=dj; a[i]+=dj;
        const v = totalRev(iCap, a);
        if (v > cur) { cur = v; improved = true; continue; }
        a[j]+=dj; a[i]-=dj;
      }
    }
    if (!improved) step *= 0.5;
  }
  return a;
}

// Build per-slot unit plan that matches desired capacity per slot
function buildSlotPlans(arrayUseableTroops, a, enabledIdx) {
  // --- targets (capacity) per slot from a[i] ---
  const totalCap = arrayUseableTroops.reduce(
    (s,e)=> s + (CARRY[e.unit]||0) * (+(e.amount)||0), 0
  );
  const targets = [0,0,0,0];
  enabledIdx.forEach(i => targets[i] = Math.round((a[i]||0) * totalCap));
  const remCap = targets.slice();

  // --- plan init ---
  const plan = {}; // plan[unit] = [n0,n1,n2,n3]
  arrayUseableTroops.forEach(e => plan[e.unit] = [0,0,0,0]);

  // --- deterministic orders to mimic calculator style ---
  // slots: lowest ratio first (FF=0, BB=1, SS=2, RR=3)
  const slotOrder = enabledIdx.slice().sort((i,j)=> RATIOS[i] - RATIOS[j]);
  // units: lowest carry first (sword 15 before spear 25, etc.)
  const unitList = arrayUseableTroops.slice().sort(
    (a,b)=> (CARRY[a.unit]||0) - (CARRY[b.unit]||0)
  );

  // --- primary assignment: push low-carry into low-ratio first ---
  for (const {unit, amount} of unitList) {
    const c = CARRY[unit] || 0;
    let left = +amount || 0;
    // cycle through slots in slotOrder, always picking the one with the biggest remaining need
    while (left > 0) {
      // choose the lowest-ratio slot with the highest remaining capacity need
      let best = -1, bestNeed = -1;
      for (const i of slotOrder) {
        if (remCap[i] > bestNeed) { bestNeed = remCap[i]; best = i; }
      }
      if (best < 0 || bestNeed <= 0) break;
      plan[unit][best] += 1;
      remCap[best] -= c;
      left -= 1;
    }
    // if we still have leftovers (all remCap <= 0), just place them in the best-fitting low-ratio slot
    while (left > 0) {
      const i = slotOrder[0];
      plan[unit][i] += 1;
      remCap[i] -= c;
      left -= 1;
    }
  }

  // --- gentle balancing: move one unit from the most negative to the most positive if it reduces error ---
  let guard = 0;
  while (guard++ < 200) {
    let p=-1,n=-1,pv=-Infinity,nv=Infinity;
    for (const i of enabledIdx) { if (remCap[i]>pv){pv=remCap[i];p=i;} if (remCap[i]<nv){nv=remCap[i];n=i;} }
    if (pv <= 0 || nv >= 0) break;
    let improved = false;

    // try moving a unit that exists in 'n' to 'p'
    // prefer moving higher-carry units first (to adjust capacity quickly)
    for (const {unit} of arrayUseableTroops.slice().sort((a,b)=> (CARRY[b.unit]||0)-(CARRY[a.unit]||0))) {
      const c = CARRY[unit]||0;
      if (plan[unit][n] > 0) {
        const before = Math.abs(remCap[p]) + Math.abs(remCap[n]);
        const after  = Math.abs(remCap[p]-c) + Math.abs(remCap[n]+c);
        if (after < before) {
          plan[unit][n]--; plan[unit][p]++;
          remCap[p]-=c; remCap[n]+=c;
          improved = true; break;
        }
      }
    }
    if (!improved) break;
  }

  return plan; // { unit: [FF,BB,SS,RR] counts }
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
            Auto Raubzug
          </label>
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
