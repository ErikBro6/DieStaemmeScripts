// ==UserScript==
// @name         DS → Mass Scavenger Calculator (Simple Auto)
// @version      0.3.1
// @description  Nutzt die Units aus dem Massenraubzug-Snippet, teilt ausgewählte Units durch Anzahl freier Scavenges im Dorf und füllt immer den nächsten freien Slot. Auto-Loop mit Senden. Mit gespeicherten Default-Units.
// @author       SpeckMich
// @match        https://*.die-staemme.de/game.php?*&screen=place&mode=scavenge_mass*
// @run-at       document-idle
// ==/UserScript==

/* global $, jQuery */
(function () {
  'use strict';

  const url = new URL(location.href);
  const params = url.searchParams;
  if (params.get('screen') !== 'place' || params.get('mode') !== 'scavenge_mass') return;

  const API = (window.DSMassScavenger ||= {});

  // ---------------------------------------------------------------------------
  // Settings (nur aktivierte Units)
  // ---------------------------------------------------------------------------

  const LS_KEY_SETTINGS = 'DSMassScavengerSettings';
  const DEFAULT_SETTINGS = {
    enabledUnits: null  // null = alle an
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(LS_KEY_SETTINGS);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return {
        enabledUnits: Array.isArray(parsed.enabledUnits) ? parsed.enabledUnits : null
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(st) {
    try {
      localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(st));
    } catch {
      // ignore
    }
  }

  // ---------------------------------------------------------------------------
  // ScavengeMassScreen-Config aus Inline-Script ziehen
  // ---------------------------------------------------------------------------

  let cachedConfig = null;
  let villageById = null;

  function extractScavengeMassArgs(txt) {
    const marker = 'new ScavengeMassScreen';
    let idx = txt.indexOf(marker);
    if (idx === -1) return null;

    idx = txt.indexOf('(', idx);
    if (idx === -1) return null;

    let i = idx + 1;
    let depth = 1;
    let inStr = false;
    let esc = false;

    for (; i < txt.length; i++) {
      const ch = txt[i];

      if (inStr) {
        if (esc) {
          esc = false;
          continue;
        }
        if (ch === '\\') {
          esc = true;
          continue;
        }
        if (ch === '"') {
          inStr = false;
          continue;
        }
        continue;
      }

      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === '(') {
        depth++;
        continue;
      }
      if (ch === ')') {
        depth--;
        if (depth === 0) {
          return txt.slice(idx + 1, i);
        }
      }
    }

    return null;
  }

  function parseMassConfig() {
    if (cachedConfig && villageById) return cachedConfig;

    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const txt = s.textContent || '';
      if (!txt.includes('ScavengeMassScreen')) continue;

      const argsSrc = extractScavengeMassArgs(txt);
      if (!argsSrc) continue;

      try {
        const wrapped = '[' + argsSrc + ']';
        const arr = JSON.parse(wrapped);
        const options  = arr[0];
        const unitDefs = arr[1];
        const speed    = arr[2];
        const villages = arr[3];

        cachedConfig = { options, unitDefs, speed, villages };

        villageById = new Map();
        (villages || []).forEach(v => {
          if (v && v.village_id != null) {
            villageById.set(String(v.village_id), v);
          }
        });

        return cachedConfig;
      } catch (e) {
        console.error('[DSMassScavenger] Fehler beim Parsen von ScavengeMassScreen:', e);
      }
    }

    console.warn('[DSMassScavenger] Konnte ScavengeMassScreen-Config nicht finden.');
    return null;
  }

  // ---------------------------------------------------------------------------
  // UI: vorhandene candidate-squad-widget Tabelle + Settingsleisten
  // ---------------------------------------------------------------------------

  function ensureMassUi() {
    const $grid = jQuery('#scavenge_mass_screen .candidate-squad-widget');
    if (!$grid.length) return;

    const $tbody = $grid.find('> tbody');
    if (!$tbody.length) return;

    const $headerRow = $tbody.find('> tr').eq(0);
    const $inputRow  = $tbody.find('> tr').eq(1);

    if (!$headerRow.length || !$inputRow.length) return;
    if ($grid.data('ds-mass-ui-ready')) return;

    const settings = loadSettings();

    // --- Header: Unit-Icons + CheckboxTroops ---

    $headerRow.find('a.unit_link').each(function () {
      const unit = jQuery(this).attr('data-unit');
      if (!unit) return;
      const $th = jQuery(this).parent();

      if ($th.find('input.checkboxTroops[unit]').length) return;

      const checked =
        !settings.enabledUnits || settings.enabledUnits.includes(unit);

      $th.append(
        `<input class="checkboxTroops" type="checkbox" ${checked ? 'checked' : ''} style="width:20%;" unit="${unit}">`
      );
    });

    // zusätzliche Spalten (wie in deinem Ziel-HTML)
    if (!$headerRow.find('th.squad-village-required').length) {
      $headerRow.append('<th class="squad-village-required">Alle</th>');
    }
    if ($headerRow.find('th:has(.icon.header.res)').length === 0) {
      $headerRow.append('<th><span class="icon header res"></span></th>');
    }
    if ($headerRow.find('th:contains("Senden")').length === 0) {
      $headerRow.append('<th>Senden</th>');
    }

    // Input-Zeile: Fill-All, carry-max, Button
    if ($inputRow.find('a.fill-all').length === 0) {
      $inputRow.append(
        '<td class="squad-village-required"><a class="fill-all" href="#">Alle Truppen</a></td>'
      );
    }
    if ($inputRow.find('td.carry-max').length === 0) {
      $inputRow.append('<td class="carry-max">0</td>');
    }
    if ($inputRow.find('button.SendMassScav').length === 0) {
      $inputRow.append(
        '<td><button class="SendMassScav btn">Massen-Raubzug senden</button></td>'
      );
    }
    if ($inputRow.find('button.infoSendMassScav').length === 0) {
      $inputRow.append(
        '<td>Achtung! Die Raubzüge werden direkt gesendet, prüfe ob die Unit-Checks links korrekt gesetzt sind</td>'
      );
    }

    // Settings-Leiste: Default speichern / löschen
    if (!document.getElementById('ds-mass-scav-settings')) {
      const controlsHtml = `
        <div id="ds-mass-scav-settings" style="margin:6px 0 10px 0;display:flex;gap:10px;align-items:center;">
          <span style="font-weight:bold;">Mass-Scav Settings:</span>
          <button class="ds-mass-save btn">Default speichern</button>
          <button class="ds-mass-clear btn">Default löschen</button>
          <span style="font-size:11px;opacity:.7;">(merkt sich, welche Units-Checkboxen aktiv sind)</span>
        </div>`;
      $grid.before(controlsHtml);
    }

    // --- Events --------------------------------------------------------------

    // Fill-All: nur aktivierte Units füllen
    $grid.on('click', 'a.fill-all', function (e) {
      e.preventDefault();
      const enabledUnits = collectEnabledUnits();
      enabledUnits.forEach(unit => {
        const $allLink =
          $inputRow.find(`a.units-entry-all[data-unit="${unit}"]`).first();
        if ($allLink.length) $allLink.trigger('click');
      });
    });

    // Auto-Sequenz starten/stoppen
    $grid.on('click', 'button.SendMassScav', function (e) {
      e.preventDefault();

      if (MASS_RUN_ACTIVE) {
        console.log('[DSMassScavenger] Stoppe Auto-Sequenz.');
        MASS_RUN_ACTIVE = false;
        return;
      }

      console.log('[DSMassScavenger] Starte Auto-Sequenz.');
      MASS_RUN_ACTIVE = true;
      MASS_ITER = 0;
      runMassSequence();
    });

    // Defaults speichern
    jQuery(document).on('click', '.ds-mass-save', function (e) {
      e.preventDefault();
      const enabled = collectEnabledUnits();
      const st = { enabledUnits: enabled.length ? enabled : null };
      saveSettings(st);
      console.log('[DSMassScavenger] Defaults gespeichert:', st);
    });

    // Defaults löschen → alle Units aktiv
    jQuery(document).on('click', '.ds-mass-clear', function (e) {
      e.preventDefault();
      localStorage.removeItem(LS_KEY_SETTINGS);
      jQuery('#scavenge_mass_screen .candidate-squad-widget input.checkboxTroops[unit]')
        .prop('checked', true);
      console.log('[DSMassScavenger] Defaults gelöscht, alle Units aktiviert.');
    });

    $grid.data('ds-mass-ui-ready', true);
  }

  function collectEnabledUnits() {
    const units = [];
    jQuery('#scavenge_mass_screen .candidate-squad-widget input.checkboxTroops[unit]').each(function () {
      const $cb = jQuery(this);
      if ($cb.is(':checked')) {
        const unit = $cb.attr('unit');
        if (unit) units.push(unit);
      }
    });
    return units;
  }

  // ---------------------------------------------------------------------------
  // Kernlogik: freie Slots finden → Units (home / #freieSlots) → Inputs füllen → Slot selektieren
  // ---------------------------------------------------------------------------
function findAllInactiveCells() {
  console.group('[DSMassScavenger][DEBUG] findAllInactiveCells()');

  const cells = [];
  const rows = document.querySelectorAll(
    '#scavenge_mass_screen .mass-scavenge-table tr[id^="scavenge_village_"]'
  );

  rows.forEach(row => {
    const villageId = row.getAttribute('data-id') || row.id.replace('scavenge_village_', '');
    const optCells = row.querySelectorAll('td.option[data-id]');

    console.log(`\n▶ Dorf ${villageId}: Prüfe ${optCells.length} Slots`);

    optCells.forEach(cell => {
      const optId = parseInt(cell.getAttribute('data-id'), 10);
      if (!Number.isFinite(optId)) return;

      const inactive = cell.classList.contains('option-inactive');
      const locked   = cell.classList.contains('option-locked');

      console.log(
        `  Slot ${optId}: inactive=${inactive}, locked=${locked}, classes="${cell.className}"`
      );

      if (!inactive) {
        console.log("    ✘ ausgeschlossen → nicht inactive");
        return;
      }
      if (locked) {
        console.log("    ✘ ausgeschlossen → locked");
        return;
      }

      console.log("    ✔ akzeptiert → freier Slot");

      cells.push({
        row,
        cell,
        villageId: String(villageId),
        optionId: optId
      });
    });
  });

  console.log(`\nErgebnis → ${cells.length} echte freie Slots`);
  cells.forEach(c => console.log(`  ✔ Dorf ${c.villageId}, Slot ${c.optionId}`));
  console.groupEnd();

  return cells;
}


  // virtueller Rest-Pool pro Dorf, damit die Truppen fair auf alle freien Slots verteilt werden
const villagePools = new Map(); // key: village_id (string) -> { unit: remainingCount }

function getVillagePool(village, enabledUnits) {
  const key = String(village.village_id);
  let pool = villagePools.get(key);

  if (!pool) {
    pool = {};
    enabledUnits.forEach(unit => {
      const home = (village.unit_counts_home && village.unit_counts_home[unit]) || 0;
      pool[unit] = home;
    });
    villagePools.set(key, pool);
  }

  return pool;
}

function fillTemplateForVillage(village, enabledUnits, freeSlotsForVillage) {
  const inputs = jQuery('#scavenge_mass_screen .candidate-squad-widget input.unitsInput[name]');
  if (!inputs.length) return false;

  const pool = getVillagePool(village, enabledUnits);
  const div = freeSlotsForVillage > 0 ? freeSlotsForVillage : 1;

  const perUnit = {};
  enabledUnits.forEach(unit => {
    const remaining = pool[unit] || 0;
    // fairer Split: verteile den verbleibenden Pool auf die noch freien Slots
    const amount = Math.floor(remaining / div);
    perUnit[unit] = amount;
  });

  console.log('[DSMassScavenger] perUnit (pool / freieSlots) für Dorf', village.village_id, {
    freeSlotsForVillage,
    pool: { ...pool },
    perUnit
  });

  let total = 0;

  inputs.each(function () {
    const $inp = jQuery(this);
    const unit = $inp.attr('name');
    if (!unit) return;
    const val = perUnit[unit] || 0;
    total += val;
    if (val > 0) {
      $inp.val(String(val));
    } else {
      $inp.val('');
    }
    $inp.trigger('input').trigger('keyup').trigger('change');
  });

  // jetzt den Pool tatsächlich reduzieren, damit nächste Slots weniger bekommen
  enabledUnits.forEach(unit => {
    const used = perUnit[unit] || 0;
    if (used > 0) {
      pool[unit] = Math.max(0, (pool[unit] || 0) - used);
    }
  });

  return total > 0;
}


  function clearAllSelections() {
    const $tbl = jQuery('#scavenge_mass_screen .mass-scavenge-table');

    $tbl.find('input.status-inactive:checked').each(function () {
      this.click();
    });
    $tbl.find('input.select-all-col:checked').each(function () {
      this.click();
    });
    $tbl.find('input.select-all-row:checked').each(function () {
      this.click();
    });
  }

  function selectCell(cellObj) {
    const { cell } = cellObj;
    const cb = cell.querySelector('input.status-inactive');
    if (cb) {
      if (!cb.checked) cb.click();
      return cb.checked;
    }
    cell.click();
    return true;
  }

  function planNextSlot() {
    const cfg = parseMassConfig();
    if (!cfg || !villageById) {
      console.warn('[DSMassScavenger] keine Config → Abbruch');
      return -1;
    }

    const enabledUnits = collectEnabledUnits();
    if (!enabledUnits.length) {
      console.warn('[DSMassScavenger] keine Units aktiviert → Abbruch');
      return -1;
    }

    const inactiveCells = findAllInactiveCells();
    if (!inactiveCells.length) {
      console.log('[DSMassScavenger] keine option-inactive Zellen gefunden');
      return -1;
    }

    const target = inactiveCells[0];
    const village = villageById.get(String(target.villageId));
    if (!village) {
      console.warn('[DSMassScavenger] Dorf nicht in JSON gefunden:', target.villageId);
      return -1;
    }

// Anzahl freier Slots in DIESEM Dorf als Divisor
const freeForVillage = inactiveCells.filter(
  c => c.villageId === target.villageId
).length || 1;

console.log(
  '[DSMassScavenger] Nutze Dorf',
  village.village_id,
  `"${village.village_name}"`,
  'für Slot',
  target.optionId,
  '– freie Slots in diesem Dorf:',
  freeForVillage
);

const hasUnits = fillTemplateForVillage(village, enabledUnits, freeForVillage);

    if (!hasUnits) {
      console.log('[DSMassScavenger] keine sendbaren Units → Abbruch');
      return -1;
    }

    clearAllSelections();

    const ok = selectCell(target);
    if (!ok) {
      console.warn('[DSMassScavenger] konnte Slot nicht selektieren → Abbruch');
      return -1;
    }

    const $btn = jQuery('#scavenge_mass_screen .buttons-container .btn-send');
    if ($btn.length) $btn.removeAttr('disabled');

    return 0;
  }

  // ---------------------------------------------------------------------------
  // Auto-Sequenz
  // ---------------------------------------------------------------------------

  let MASS_RUN_ACTIVE = false;
  let MASS_ITER = 0;
  const MASS_ITER_LIMIT = 50;
  const MASS_DELAY_MS = 900;
  const MASS_STEP_DELAY_MS = 1500; // 1.5s Pause zwischen zwei Mass-Sends


  function runMassSequence() {
    if (!MASS_RUN_ACTIVE) {
      console.log('[DSMassScavenger] MASS_RUN_ACTIVE=false → Sequenz beendet.');
      return;
    }

    MASS_ITER++;
    if (MASS_ITER > MASS_ITER_LIMIT) {
      console.warn('[DSMassScavenger] Sicherheitslimit erreicht → Sequenz gestoppt.');
      MASS_RUN_ACTIVE = false;
      return;
    }

    console.group(`[DSMassScavenger] Iteration #${MASS_ITER}`);

    const res = planNextSlot();
    if (res !== 0) {
      console.log('[DSMassScavenger] planNextSlot() →', res, '→ nichts mehr zu tun, stoppe.');
      MASS_RUN_ACTIVE = false;
      console.groupEnd();
      return;
    }

    const $btn = jQuery('#scavenge_mass_screen .buttons-container .btn-send');
    const btnEl = $btn.get(0);
    console.log('Senden-Button:', btnEl);

    if (!$btn.length || btnEl.disabled) {
      console.warn('[DSMassScavenger] Senden-Button fehlt/disabled → Sequenz gestoppt.');
      MASS_RUN_ACTIVE = false;
      console.groupEnd();
      return;
    }

    console.log('[DSMassScavenger] Klicke offiziellen Senden-Button.');
    $btn.click();

    console.groupEnd();

    // kleine Pause, damit DS Slot/DOM aktualisieren kann und der Server etwas "Luft" hat
setTimeout(() => runMassSequence(iter + 1), MASS_STEP_DELAY_MS);

  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  API.isReady = () => !!document.querySelector('#scavenge_mass_screen .candidate-squad-widget');
  API.planNextSlot = planNextSlot;

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  const bootIv = setInterval(() => {
    if (document.querySelector('#scavenge_mass_screen .candidate-squad-widget')) {
      clearInterval(bootIv);
      ensureMassUi();
    }
  }, 50);
})();
