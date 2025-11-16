// ==UserScript==
// @name         DS → Scavenger Calculator (Mini Raubzug-Sender)
// @version      1.1.0
// @description  Rechner + Füll-Logik (Equal Time / Ressourcen pro Stunde). KEIN Auto-Send. Ignoriert laufende Slots bei der Verteilung.
// @author       SpeckMich
// @match        https://*.die-staemme.de/game.php?*&screen=place&mode=scavenge*
// @run-at       document-idle
// ==/UserScript==

/* global game_data, $, jQuery */
(function () {
  'use strict';

    const url = new URL(location.href);
  const params = url.searchParams;
  if (params.get('screen') !== 'place' || params.get('mode') !== 'scavenge') {
    return; // falsche Unterseite -> Script beendet sich sofort
  }
  // Public namespace for other modules (e.g., auto)
  const API = (window.DSScavenger ||= {});

  // --- Settings / constants --------------------------------------------------
  const OPT_KEY = 'dsu_scavenger_opt_mode'; // 'equalTime' | 'perHour'
  let optMode = localStorage.getItem(OPT_KEY) || 'equalTime';

  // common carry values (use only units present on this screen)
  const CARRY = { spear: 25, sword: 15, axe: 10, light: 80, heavy: 50, knight: 100 };
  // scavenge ratios
  const RATIOS = [0.10, 0.25, 0.50, 0.75];

  let storage = localStorage;
  let lastPlan = null;

  // --- Helpers ---------------------------------------------------------------
  function numberOfUnlockedSlots() {
    return 4 - jQuery('.lock').length;
  }

  // (legacy) read checkboxes as indices; may include running ones — we now filter later
  function readEnabledSlots() {
    const max = numberOfUnlockedSlots();
    const out = [];
    for (let i = 0; i < max; i++) {
      if (jQuery(`.checkbox_${i}`).is(':checked')) out.push(i);
    }
    return out;
  }

  function getEnabledFromStorage() {
    const raw = storage.getItem('SelectionScavenger');
    const arr = raw ? JSON.parse(raw) : [1, 1, 1, 1];
    return [0, 1, 2, 3].map(i => (arr[i] ? 1 : 0));
  }

  function isSlotRunning(i) {
    // If the slot shows a return countdown, it's running (ignore for *this* send)
    return jQuery('.scavenge-option')
      .eq(i)
      .find('.active-view .return-countdown').length > 0;
  }

  function isSlotFree(i) {
    // Free = has a visible start button (free or premium) and NOT running
    const $opt = jQuery('.scavenge-option').eq(i);
    const hasStart =
      $opt.find('.free_send_button:visible').length > 0 ||
      $opt.find('.premium_send_button:visible').length > 0;
    return hasStart && !isSlotRunning(i);
  }

  function getEligibleSlots() {
    // Enabled (from storage OR current checkboxes) AND currently free
    // Prefer live checkboxes (so user edits apply immediately)
    const max = numberOfUnlockedSlots();
    const enabledNow = [];
    for (let i = 0; i < Math.min(4, max); i++) {
      enabledNow[i] = jQuery(`.checkbox_${i}`).is(':checked') ? 1 : 0;
    }
    // Fallback to storage if checkboxes missing
    const enabledStorage = getEnabledFromStorage();

    const eligible = [];
    for (let i = 0; i < Math.min(4, max); i++) {
      const enabledFlag = (enabledNow[i] ?? enabledStorage[i]) ? 1 : 0;
      if (enabledFlag && isSlotFree(i)) eligible.push(i);
    }
    return eligible;
  }

  function getTroopAmount() {
    const troopObject = [];
    let value = 0;
    (game_data.units || []).forEach(unit => {
      if (unit !== 'ram' && unit !== 'catapult' && unit !== 'spy') {
        value += 1;
      }
      if (jQuery(`input[unit='${unit}']`).is(':checked')) {
        jQuery('.unitsInput').each(function () {
          if (this.name === unit) {
            const allTxt = jQuery(`.units-entry-all[data-unit='${unit}']`).text() || '';
            const m = allTxt.match(/\d+/);
            if (!m) return;
            let amount = parseInt(m[0], 10);
            const cap = parseInt(jQuery('.maxTroops').val(), 10);
            if (Number.isFinite(cap) && cap < amount) amount = cap;
            const row = { unit, amount, value };
            if (amount > 0) troopObject.push(row);
          }
        });
      }
    });
    return troopObject;
  }

  // Split a unit count by fractions a[0..3], deterministic remainder to last enabled slot
  function splitByFractions(amount, a) {
    const res = [0, 0, 0, 0];
    let assigned = 0;
    for (let i = 0; i < 4; i++) {
      const v = Math.floor((amount || 0) * (a[i] || 0));
      res[i] = v; assigned += v;
    }
    const remainder = (amount || 0) - assigned;
    if (remainder > 0) {
      for (let i = 3; i >= 0; i--) {
        if (a[i] > 0) { res[i] += remainder; break; }
      }
    }
    return res;
  }

  // Equal-time fractions: a_i ∝ 1/ratio_i for target slots
  function computeEqualTimeA(targetIdx) {
    const a = [0, 0, 0, 0];
    if (targetIdx.length === 1) { a[targetIdx[0]] = 1; return a; }
    let sum = 0;
    targetIdx.forEach(i => { a[i] = 1 / RATIOS[i]; sum += a[i]; });
    if (sum) targetIdx.forEach(i => { a[i] /= sum; });
    return a;
  }

  // Resources/hour objective (df cancels for choosing a)
  function revPerHour(iCap, ai, i) {
    if (ai <= 0) return 0;
    const r = RATIOS[i];
    const load = iCap * ai;
    const denom = Math.pow((load * load) * 100 * (r * r), 0.45) + 1800;
    return (load * r) / denom;
  }
  function totalRev(iCap, a, targetIdx) {
    let s = 0;
    for (const i of targetIdx) s += revPerHour(iCap, a[i] || 0, i);
    return s;
  }

  // Simple coordinate-descent optimizer for perHour over targetIdx
  function computeOptimalA_PerHour(iCap, targetIdx) {
    const a = [0, 0, 0, 0];
    if (!targetIdx.length || iCap <= 0) return a;
    if (targetIdx.length === 1) { a[targetIdx[0]] = 1; return a; }

    // init equal over targetIdx
    targetIdx.forEach(i => a[i] = 1 / targetIdx.length);

    let improved = true, guard = 0;
    while (improved && guard++ < 200) {
      improved = false;
      for (let k = 0; k < targetIdx.length - 1; k++) {
        const i = targetIdx[k], j = targetIdx[k + 1];
        const cur = totalRev(iCap, a, targetIdx);

        // move half i → j
        if (a[i] > 0) {
          const di = a[i] * 0.5;
          a[i] -= di; a[j] += di;
          const v1 = totalRev(iCap, a, targetIdx);
          if (v1 <= cur) { a[j] -= di; a[i] += di; } else { improved = true; continue; }
        }
        // move half j → i
        if (a[j] > 0) {
          const dj = a[j] * 0.5;
          a[j] -= dj; a[i] += dj;
          const v2 = totalRev(iCap, a, targetIdx);
          if (v2 <= cur) { a[i] -= dj; a[j] += dj; } else { improved = true; }
        }
      }
    }
    return a;
  }

  // Build SendTroops map { unit: [n0,n1,n2,n3] } using only eligible (enabled+free) slots
  function buildPlan() {
    const targetIdx = getEligibleSlots(); // <-- critical filter
    if (targetIdx.length === 0) return { __none: true };

    const troops = getTroopAmount();
    const totalCap = troops.reduce((s, e) => s + (CARRY[e.unit] || 0) * (+e.amount || 0), 0);

    const a = (optMode === 'perHour')
      ? computeOptimalA_PerHour(totalCap, targetIdx)
      : computeEqualTimeA(targetIdx);

    const plan = {};
    troops.forEach(t => { plan[t.unit] = splitByFractions(t.amount, a); });
    return plan;
  }

  // Fill one next eligible slot (from back to front), reveal buttons
  function fillNextSlot(plan) {
    if (plan && plan.__none) return -1;

    const eligible = getEligibleSlots();
    if (eligible.length === 0) return -1;

    // Iterate from back to front across eligible indices
    for (let p = eligible.length - 1; p >= 0; p--) {
      const index = eligible[p];

      // Double-check right before writing (DOM might have changed)
      if (!isSlotFree(index)) continue;

      const $opt = jQuery('.scavenge-option').eq(index);

      // set inputs for each unit
      const troopsNow = getTroopAmount(); // recalc amounts (in case UI changed)
      troopsNow.forEach(el => {
        const sel = `#scavenge_screen > div > div.candidate-squad-container > table > tbody > tr:nth-child(2) > td:nth-child(${el.value}) > input`;
        const input = document.querySelector(sel);
        if (!input) return;
        input.value = (plan[el.unit] && plan[el.unit][index]) || 0;
        input.dispatchEvent(new Event('change'));
      });

      // reveal buttons (manual click or for auto module)
      if ($opt.find('.premium_send_button').length) {
        $opt.find('.premium_send_button').css('visibility', 'visible');
      }
      if ($opt.find('.free_send_button').length) {
        $opt.find('.free_send_button').css('visibility', 'visible');
      }
      return index;
    }

    return -1;
  }

  // --- Visual hint for running slots (editable checkboxes) -------------------
  const style = document.createElement('style');
  style.textContent = `
    .dsu-slot-running { opacity: .6; outline: 1px dashed #999; }
  `;
  document.head.appendChild(style);

  function refreshSlotRunningBadges() {
    for (let i = 0; i < numberOfUnlockedSlots(); i++) {
      const $prev = jQuery('.preview').eq(i);
      const running = $prev.find('.return-countdown').length > 0;
      const $cb = jQuery(`.checkbox_${i}`);
      if (!$cb.length) continue;
      if (running) {
        $cb.addClass('dsu-slot-running')
           .attr('title', 'Dieser Slot läuft gerade — deine Auswahl gilt für die nächste Runde.');
      } else {
        $cb.removeClass('dsu-slot-running').removeAttr('title');
      }
    }
  }

  // --- UI --------------------------------------------------------------------
  function setupUI() {
    jQuery('.border-frame-gold-red').css('padding-bottom', '10px');
    const $grid = jQuery('.candidate-squad-widget');
    if (!$grid.length) return;

    // Add header + button
    $grid.find('> tbody > tr').eq(0).append('<th>Senden</th>');
    $grid.find('> tbody > tr').eq(1).append('<td><button class="SendScavenger btn">Raubzug senden</button></td>');

    // Options block
    const optionsHtml = `
      <div style="margin:6px 0 10px 0;display:flex;gap:18px;align-items:center;">
        <label>max. Truppen</label>
        <input class="maxTroops" type="number" min="10" max="100000" value="999999">
        <button class="clearLocalStorage btn">Default löschen</button>
        <button class="saveLocalStorage btn">Default speichern</button>
      </div>
      <div style="margin:6px 0 10px 0;display:flex;gap:18px;align-items:center;">
        <strong>Optimierung:</strong>
        <label style="display:inline-flex;gap:6px;align-items:center;cursor:pointer;">
          <input type="checkbox" id="optEqualTime"> Gleiche Dauer
        </label>
        <label style="display:inline-flex;gap:6px;align-items:center;cursor:pointer;">
          <input type="checkbox" id="optPerHour"> Rohstoffe / Stunde
        </label>
        <span style="opacity:.7;font-size:11px">(*wirkt beim Klick auf „Raubzug senden“)</span>
      </div>`;
    $grid.before(optionsHtml);

    // Slot checkboxes (editable even when running)
    for (let i = 0; i < numberOfUnlockedSlots(); i++) {
      const $prev = jQuery('.preview').eq(i);
      if (!$prev.length) continue;
      if (!jQuery(`.checkbox_${i}`).length) {
        const running = $prev.find('.return-countdown').length > 0;
        $prev.before(`<input class="checkbox_${i}" type="checkbox" checked style="margin-left:50%;margin-top:10px;" unit="${i}">`);
        if (running) {
          jQuery(`.checkbox_${i}`)
            .addClass('dsu-slot-running')
            .attr('title', 'Dieser Slot läuft gerade — deine Auswahl gilt für die nächste Runde.');
        } else {
          jQuery(`.checkbox_${i}`).removeClass('dsu-slot-running').removeAttr('title');
        }
      }
    }

    // Unit toggles
    jQuery('.unit_link').each(function () {
      const unit = jQuery(this).attr('data-unit');
      jQuery(this).parent().append(`<input class="checkboxTroops" type="checkbox" checked style="width:20%;" unit="${unit}">`);
    });

    // Restore
    getLocalStorage();

    // Handlers
    jQuery('.saveLocalStorage').on('click', setLocalStorage);
    jQuery('.clearLocalStorage').on('click', () => storage.removeItem('scavenger'));

    // Optimization toggles
    jQuery('#optEqualTime').prop('checked', optMode === 'equalTime');
    jQuery('#optPerHour').prop('checked', optMode === 'perHour');

    jQuery('#optEqualTime').on('change', function () {
      if (jQuery(this).is(':checked')) {
        jQuery('#optPerHour').prop('checked', false);
        optMode = 'equalTime';
      } else {
        optMode = jQuery('#optPerHour').is(':checked') ? 'perHour' : 'equalTime';
      }
      localStorage.setItem(OPT_KEY, optMode);
    });
    jQuery('#optPerHour').on('change', function () {
      if (jQuery(this).is(':checked')) {
        jQuery('#optEqualTime').prop('checked', false);
        optMode = 'perHour';
      } else {
        optMode = jQuery('#optEqualTime').is(':checked') ? 'equalTime' : 'perHour';
      }
      localStorage.setItem(OPT_KEY, optMode);
    });

    // Main “Raubzug senden” — compute + fill one slot (no clicking)
    jQuery('.SendScavenger').on('click', () => {
      lastPlan = buildPlan();
      fillNextSlot(lastPlan);
    });

    // If user manually clicks a free/premium btn and slot becomes free again, allow next fill
    jQuery('.free_send_button').on('click', () => setTimeout(() => {
      lastPlan = buildPlan();
      fillNextSlot(lastPlan);
    }, 200));

    if (jQuery('.premium_send_button').length) {
      jQuery('.premium_send_button').on('click', () => setTimeout(() => {
        jQuery('.evt-confirm-btn').on('click', () => setTimeout(() => {
          lastPlan = buildPlan();
          fillNextSlot(lastPlan);
        }, 200));
      }, 200));
    }

    refreshSlotRunningBadges();
  }

  function readOutRZSlotsCB() {
    // (kept for compatibility; not used for distribution anymore)
    let level = '';
    for (let i = 0; i < numberOfUnlockedSlots(); i++) {
      level += jQuery(`.checkbox_${i}`).is(':checked') ? '1' : '0';
    }
    while (level.length < 4) level += '0';
    return level;
  }

  function getLocalStorage() {
    const data = storage.getItem('scavenger');
    if (data) {
      JSON.parse(data).forEach(e => {
        jQuery(`input[unit='${e.unit}']`).prop('checked', !!e.checked);
      });
    }
    const maxValue = storage.getItem('maxScavenger');
    if (maxValue != null) jQuery('.maxTroops').val(maxValue);

    const selected = storage.getItem('SelectionScavenger');
    if (selected) {
      const arr = JSON.parse(selected);
      for (let i = 0; i < 4; i++) {
        const cb = jQuery(`.checkbox_${i}`);
        cb.prop('checked', arr[i] == 1); // restore regardless of running state
      }
    }
  }

  function setLocalStorage() {
    const temp = [];
    jQuery('.checkboxTroops').each(function () {
      temp.push({ unit: jQuery(this).attr('unit'), checked: jQuery(this).is(':checked') });
    });
    storage.setItem('scavenger', JSON.stringify(temp));
    storage.setItem('maxScavenger', jQuery('.maxTroops').val() || '');

    const sel = [];
    for (let i = 0; i < 4; i++) {
      sel.push(jQuery(`.checkbox_${i}`).is(':checked') ? 1 : 0);
    }
    storage.setItem('SelectionScavenger', JSON.stringify(sel));
  }

  // --- Public API for auto module -------------------------------------------
  API.isReady = () => !!document.querySelector('.candidate-squad-widget');
  API.computeAndFillNext = function () {
    lastPlan = buildPlan();
    return fillNextSlot(lastPlan); // returns slot index or -1
  };

  // --- Boot -----------------------------------------------------------------
  const bootIv = setInterval(() => {
    if (document.querySelector('.candidate-squad-widget')) {
      clearInterval(bootIv);
      setupUI();

      // Optional: keep badges in sync if DOM changes
      const host = document.querySelector('.options-container');
      if (host) {
        const mo = new MutationObserver(() => {
          refreshSlotRunningBadges();
        });
        mo.observe(host, { subtree: true, childList: true, characterData: true });
      }
    }
  }, 50);
})();
