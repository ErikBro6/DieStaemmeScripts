// ==UserScript==
// @name         DS → Mass Scavenger Calculator (Simple Auto + Per-Village Max)
// @version      0.5.1
// @description  Nutzt die Units aus dem Massenraubzug-Snippet, teilt ausgewählte Units durch Anzahl Scavenges im Dorf und füllt immer den nächsten freien Slot. Auto-Loop mit Senden. Pro Dorf: aktivierbare Units + Max je Unit (Max wird auf alle Slots des Dorfs verteilt, z.B. 200/4=50).
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
  // Settings (pro Dorf: Units + Max je Unit)
  // ---------------------------------------------------------------------------

  const LS_KEY_SETTINGS = 'DSMassScavengerSettings';
  const DEFAULT_SETTINGS = {
    enabledUnits: null,   // legacy: globale Units (Fallback)
    perVillage: {}        // { [villageId]: { units: string[]|null, max: { [unit]: number } } }
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(LS_KEY_SETTINGS);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);

      const enabledUnits =
        Array.isArray(parsed.enabledUnits) ? parsed.enabledUnits : null;

      const perVillage =
        parsed.perVillage && typeof parsed.perVillage === 'object'
          ? parsed.perVillage
          : {};

      return {
        enabledUnits,
        perVillage
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(st) {
    try {
      const safe = {
        enabledUnits: Array.isArray(st.enabledUnits) && st.enabledUnits.length ? st.enabledUnits : null,
        perVillage: st.perVillage && typeof st.perVillage === 'object' ? st.perVillage : {}
      };
      localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(safe));
    } catch {
      // ignore
    }
  }

  function getVillageConfig(villageId) {
    const vKey = String(villageId);
    const st = loadSettings();
    const perVillage = st.perVillage || {};
    const raw = perVillage[vKey];

    const cfg = {
      units: null,
      max: {}
    };

    if (!raw) {
      // kein Dorf-spezifisches Setting: Units ggf. aus globalen
      cfg.units = Array.isArray(st.enabledUnits) ? st.enabledUnits.slice() : null;
      return cfg;
    }

    // Legacy: perVillage[vId] war direkt ein Array
    if (Array.isArray(raw)) {
      cfg.units = raw.slice();
      return cfg;
    }

    // Neue Struktur: Objekt
    if (typeof raw === 'object') {
      if (Array.isArray(raw.units)) {
        cfg.units = raw.units.slice();
      } else if (Array.isArray(st.enabledUnits)) {
        cfg.units = st.enabledUnits.slice();
      } else {
        cfg.units = null;
      }

      if (raw.max && typeof raw.max === 'object') {
        cfg.max = { ...raw.max };
      }
    }

    return cfg;
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

  function buildVillageUnitUI(row, villageId, unitDefs) {
    if (!unitDefs) return;
    if (row.nextSibling && row.nextSibling.classList && row.nextSibling.classList.contains('ds-mass-village-units-row')) {
      return; // schon gebaut
    }

    const vKey = String(villageId);
    const vCfg = getVillageConfig(vKey);
    const enabledForVillage = vCfg.units;
    const maxCfg = vCfg.max || {};

const outerTr = document.createElement('tr');
outerTr.className = 'ds-mass-village-units-row';

// LEFT COLUMN
const leftTd = document.createElement('td');
leftTd.style.verticalAlign = "top";
leftTd.style.fontWeight = "bold";
leftTd.style.whiteSpace = "nowrap";
leftTd.style.width = "160px";
const link = row.cells[0].querySelector("a");
leftTd.appendChild(link.cloneNode(true));

outerTr.appendChild(leftTd);

// RIGHT COLUMN
const rightTd = document.createElement('td');
rightTd.colSpan = row.cells.length;


// EXPLANATION ABOVE TABLE
const expl = document.createElement('div');
expl.textContent = "Einheiten auswählen & maximale Menge festlegen (gesamt, verteilt auf alle Slots):";
expl.style.fontSize = "11px";
expl.style.marginBottom = "4px";
rightTd.appendChild(expl);

// NOW CREATE THE TABLE
const table = document.createElement('table');
table.className = 'candidate-squad-widget vis ds-mass-config';
table.style.width = "auto";
table.style.marginLeft = "10px";

const tbody = document.createElement('tbody');

// HEADER
const headerTr = document.createElement('tr');

// NEW: Explanation column header
const explainHeader = document.createElement('th');
explainHeader.textContent = "Einheit";
explainHeader.style.whiteSpace = "nowrap";
headerTr.appendChild(explainHeader);

// THEN the unit-icon headers
Object.keys(unitDefs).forEach(unit => {

    const def = unitDefs[unit] || {};
    const name = def.name || unit;

    const th = document.createElement('th');
    th.style.width = "48px";
th.style.textAlign = "center";

    const a = document.createElement('a');
    a.href = "#";
    a.className = "unit_link";
    a.dataset.unit = unit;

    const img = document.createElement('img');
    img.src = `/graphic/unit/unit_${unit}.png`;
    img.dataset.title = name;

    a.appendChild(img);
    th.appendChild(a);
    headerTr.appendChild(th);
});
tbody.appendChild(headerTr);

// SECOND ROW → check + max
const inputTr = document.createElement('tr');

// NEW: Explanation cell for row
const explainCell = document.createElement('td');
explainCell.textContent = "Aktiv / Max";
explainCell.style.fontSize = "11px";
explainCell.style.whiteSpace = "nowrap";
inputTr.appendChild(explainCell);

// THEN the actual unit input cells
Object.keys(unitDefs).forEach(unit => {

    const def = unitDefs[unit] || {};
    const name = def.name || unit;

    const tdCell = document.createElement('td');
tdCell.style.width = "48px";
tdCell.style.textAlign = "center";

    const cb = document.createElement('input');
    cb.type = "checkbox";
    cb.className = "villageUnitToggle";
    cb.dataset.village = vKey;
    cb.dataset.unit = unit;
    cb.disabled = false;


    const isEnabledDefault =
        !enabledForVillage || !enabledForVillage.length || enabledForVillage.includes(unit);
    if (isEnabledDefault) cb.checked = true;

    const maxInput = document.createElement('input');
    maxInput.type = "number";
    maxInput.min = "0";
    maxInput.className = "input-nicer villageUnitMax";
    maxInput.dataset.village = vKey;
    maxInput.dataset.unit = unit;
    maxInput.style.width = "55px";

    const maxVal = maxCfg[unit];
    if (Number.isFinite(maxVal) && maxVal > 0) maxInput.value = String(maxVal);

    tdCell.appendChild(cb);
    tdCell.appendChild(maxInput);
    inputTr.appendChild(tdCell);
});
tbody.appendChild(inputTr);

table.appendChild(tbody);

// WRAP + ATTACH
const wrap = document.createElement('div');
wrap.className = "ds-mass-village-units";
wrap.appendChild(table);

rightTd.appendChild(wrap);
outerTr.appendChild(rightTd);

// INSERT ROW BELOW VILLAGE ROW
row.parentNode.insertBefore(outerTr, row.nextSibling);

  }

  function ensureMassUi() {
    // Nur das "offizielle" candidate-squad-widget benutzen, nicht die pro-Dorf-Config-Widgets
    const $grid = jQuery('#scavenge_mass_screen .candidate-squad-widget').not('.ds-mass-config').first();
    if (!$grid.length) return;

    const $tbody = $grid.find('> tbody');
    if (!$tbody.length) return;

    const $headerRow = $tbody.find('> tr').eq(0);
    const $inputRow  = $tbody.find('> tr').eq(1);

    if (!$headerRow.length || !$inputRow.length) return;
    if ($grid.data('ds-mass-ui-ready')) return;

    const settings = loadSettings();

    // zusätzliche Spalten (wie gewohnt)
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
    if ($inputRow.find('td:contains("Raubzüge werden direkt gesendet")').length === 0) {
      $inputRow.append(
        '<td>Achtung! Die Raubzüge werden direkt gesendet, prüfe ob die Unit- und Max-Settings unter den Dörfern korrekt gesetzt sind.</td>'
      );
    }

    // Settings-Leiste: Default speichern / löschen (pro Dorf)
    if (!document.getElementById('ds-mass-scav-settings')) {
      const controlsHtml = `
        <div id="ds-mass-scav-settings" style="margin:6px 0 10px 0;display:flex;gap:10px;align-items:center;">
          <span style="font-weight:bold;">Mass-Scav Settings:</span>
          <button class="ds-mass-save btn">Defaults speichern</button>
          <button class="ds-mass-clear btn">Defaults löschen</button>
          <span style="font-size:11px;opacity:.7;">(merkt sich aktivierte Units & Max-Werte pro Dorf)</span>
        </div>`;
      $grid.before(controlsHtml);
    }

    // Pro-Dorf-Config-Widgets bauen
    const cfg = parseMassConfig();
    if (cfg && cfg.villages && cfg.villages.length) {
      const rows = document.querySelectorAll(
        '#scavenge_mass_screen .mass-scavenge-table tr[id^="scavenge_village_"]'
      );
      rows.forEach(row => {
        const villageId =
          row.getAttribute('data-id') ||
          row.id.replace('scavenge_village_', '');
        buildVillageUnitUI(row, String(villageId), cfg.unitDefs);
      });
    }

    // --- Events --------------------------------------------------------------

    function collectEnabledUnitsForFillAll() {
      const st = loadSettings();

      // wenn legacy enabledUnits konfiguriert → nutze diese
      if (Array.isArray(st.enabledUnits) && st.enabledUnits.length) {
        return [...st.enabledUnits];
      }

      const units = new Set();
      document
        .querySelectorAll('.ds-mass-village-units input.villageUnitToggle:checked')
        .forEach(cb => {
          const u = cb.dataset.unit;
          if (u) units.add(u);
        });

      const cfgLocal = parseMassConfig();
      if (!units.size && cfgLocal && cfgLocal.unitDefs) {
        return Object.keys(cfgLocal.unitDefs);
      }

      return Array.from(units);
    }

    // Fill-All: nutzt die aktuell aktivierten Units (DOM)
    $grid.on('click', 'a.fill-all', function (e) {
      e.preventDefault();
      const enabledUnits = collectEnabledUnitsForFillAll();
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

    // Defaults speichern (Units + Max pro Dorf)
    jQuery(document).on('click', '.ds-mass-save', function (e) {
      e.preventDefault();
      const st = loadSettings();
      const perVillage = {};

      document
        .querySelectorAll('.ds-mass-village-units input.villageUnitToggle')
        .forEach(cb => {
          const vId = cb.dataset.village;
          const unit = cb.dataset.unit;
          if (!vId || !unit) return;

          const cell = cb.closest('td');
          const maxInput = cell ? cell.querySelector('.villageUnitMax') : null;

          if (!perVillage[vId]) {
            perVillage[vId] = { units: [], max: {} };
          }

          if (cb.checked && !perVillage[vId].units.includes(unit)) {
            perVillage[vId].units.push(unit);
          }

          if (maxInput) {
            const val = parseInt(maxInput.value, 10);
            if (Number.isFinite(val) && val > 0) {
              perVillage[vId].max[unit] = val;
            }
          }
        });

      st.perVillage = perVillage;
      st.enabledUnits = null; // wir arbeiten ab jetzt pro Dorf

      saveSettings(st);
      console.log('[DSMassScavenger] Defaults pro Dorf gespeichert:', st);
    });

    // Defaults löschen → alle Units aktiv + Max-Werte löschen
    jQuery(document).on('click', '.ds-mass-clear', function (e) {
      e.preventDefault();
      localStorage.removeItem(LS_KEY_SETTINGS);

      document
        .querySelectorAll('.ds-mass-village-units input.villageUnitToggle')
        .forEach(cb => { cb.checked = true; });

      document
        .querySelectorAll('.ds-mass-village-units input.villageUnitMax')
        .forEach(inp => { inp.value = ''; });

      console.log('[DSMassScavenger] Defaults gelöscht, alle Units in allen Dörfern aktiviert & Max-Werte zurückgesetzt.');
    });

    // Änderungen an Dorf-Checkboxen direkt speichern
    document.addEventListener('change', ev => {
      const target = ev.target;
      if (!target.classList || !target.classList.contains('villageUnitToggle')) return;

      const vId = target.dataset.village;
      const unit = target.dataset.unit;
      if (!vId || !unit) return;

      const st = loadSettings();
      st.perVillage ||= {};
      let raw = st.perVillage[vId];

      if (!raw) {
        raw = { units: [], max: {} };
      } else if (Array.isArray(raw)) {
        raw = { units: raw.slice(), max: {} };
      } else if (typeof raw === 'object') {
        if (!Array.isArray(raw.units)) raw.units = [];
        if (!raw.max || typeof raw.max !== 'object') raw.max = {};
      }

      if (target.checked) {
        if (!raw.units.includes(unit)) raw.units.push(unit);
      } else {
        raw.units = raw.units.filter(u => u !== unit);
      }

      st.perVillage[vId] = raw;
      saveSettings(st);
    });

    // Änderungen an Max-Inputs direkt speichern
    document.addEventListener('input', ev => {
      const target = ev.target;
      if (!target.classList || !target.classList.contains('villageUnitMax')) return;

      const vId = target.dataset.village;
      const unit = target.dataset.unit;
      if (!vId || !unit) return;

      const st = loadSettings();
      st.perVillage ||= {};
      let raw = st.perVillage[vId];

      if (!raw) {
        raw = { units: [], max: {} };
      } else if (Array.isArray(raw)) {
        raw = { units: raw.slice(), max: {} };
      } else if (typeof raw === 'object') {
        if (!Array.isArray(raw.units)) raw.units = [];
        if (!raw.max || typeof raw.max !== 'object') raw.max = {};
      }

      const val = parseInt(target.value, 10);
      if (Number.isFinite(val) && val > 0) {
        raw.max[unit] = val;
      } else {
        delete raw.max[unit];
      }

      st.perVillage[vId] = raw;
      saveSettings(st);
    });

    $grid.data('ds-mass-ui-ready', true);
  }

  // ---------------------------------------------------------------------------
  // Helpers für aktivierte Units
  // ---------------------------------------------------------------------------

  function collectEnabledUnitsForVillage(villageId) {
    const cfg = parseMassConfig();
    if (!cfg || !cfg.unitDefs) return [];

    const allUnits = Object.keys(cfg.unitDefs);
    const vCfg = getVillageConfig(villageId);

    let result = vCfg.units;

    if (!Array.isArray(result) || !result.length) {
      const st = loadSettings();
      if (Array.isArray(st.enabledUnits) && st.enabledUnits.length) {
        result = st.enabledUnits.slice();
      } else {
        result = allUnits;
      }
    }

    return result.filter(u => allUnits.includes(u));
  }

  function getMaxConfigForVillage(villageId) {
    const vCfg = getVillageConfig(villageId);
    return vCfg.max || {};
  }

  // ---------------------------------------------------------------------------
  // Kernlogik: freie Slots finden → Units → Inputs füllen → Slot selektieren
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
          console.log('    ✘ ausgeschlossen → nicht inactive');
          return;
        }
        if (locked) {
          console.log('    ✘ ausgeschlossen → locked');
          return;
        }

        console.log('    ✔ akzeptiert → freier Slot');

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

  const villagePools = new Map(); // key: village_id (string) -> { unit: remainingCount }

  function getVillagePool(village, enabledUnits, maxCfg) {
    const key = String(village.village_id);
    let pool = villagePools.get(key);

    if (!pool) {
      pool = {};
      enabledUnits.forEach(unit => {
        const home = (village.unit_counts_home && village.unit_counts_home[unit]) || 0;
        const maxVal = maxCfg && typeof maxCfg[unit] === 'number' && maxCfg[unit] > 0
          ? maxCfg[unit]
          : null;
        const cap = maxVal != null ? Math.min(home, maxVal) : home;
        pool[unit] = cap;
      });
      villagePools.set(key, pool);
    }

    return pool;
  }

  function fillTemplateForVillage(village, enabledUnits, freeSlotsForVillage, totalSlotsForVillage, villageId) {
    const inputs = jQuery('#scavenge_mass_screen .candidate-squad-widget').not('.ds-mass-config')
      .find('input.unitsInput[name]');
    if (!inputs.length) return false;
    if (!enabledUnits || !enabledUnits.length) return false;

    const maxCfg = getMaxConfigForVillage(villageId);
    const pool = getVillagePool(village, enabledUnits, maxCfg);

    const divFree = freeSlotsForVillage > 0 ? freeSlotsForVillage : 1;
    const slotCount = totalSlotsForVillage > 0 ? totalSlotsForVillage : 1;

    const perUnit = {};
    enabledUnits.forEach(unit => {
      const remaining = pool[unit] || 0;
      const maxVal = maxCfg && typeof maxCfg[unit] === 'number' && maxCfg[unit] > 0
        ? maxCfg[unit]
        : null;

      let amount = 0;

      if (maxVal != null) {
        const perSlotFromMax = Math.floor(maxVal / slotCount);
        const fairByPool = Math.floor(remaining / divFree);
        amount = Math.min(perSlotFromMax, fairByPool);
      } else {
        amount = Math.floor(remaining / divFree);
      }

      if (!Number.isFinite(amount) || amount < 0) amount = 0;
      perUnit[unit] = amount;
    });

    console.log('[DSMassScavenger] perUnit (Pool/Slots/Max) für Dorf', village.village_id, {
      freeSlotsForVillage,
      totalSlotsForVillage: slotCount,
      pool: { ...pool },
      maxCfg: { ...maxCfg },
      perUnit
    });

    let total = 0;

    inputs.each(function () {
      const $inp = jQuery(this);
      const unit = $inp.attr('name');
      if (!unit) return;

      if (!enabledUnits.includes(unit)) {
        $inp.val('');
        $inp.trigger('input').trigger('keyup').trigger('change');
        return;
      }

      const val = perUnit[unit] || 0;
      total += val;
      if (val > 0) {
        $inp.val(String(val));
      } else {
        $inp.val('');
      }
      $inp.trigger('input').trigger('keyup').trigger('change');
    });

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

    const inactiveCells = findAllInactiveCells();
    if (!inactiveCells.length) {
      console.log('[DSMassScavenger] keine option-inactive Zellen gefunden');
      return -1;
    }

    for (const target of inactiveCells) {
      const village = villageById.get(String(target.villageId));
      if (!village) {
        console.warn('[DSMassScavenger] Dorf nicht in JSON gefunden:', target.villageId);
        continue;
      }

      const enabledUnits = collectEnabledUnitsForVillage(target.villageId);
      if (!enabledUnits.length) {
        console.log(
          '[DSMassScavenger] Dorf',
          target.villageId,
          'hat keine aktivierten Units → Slot wird übersprungen.'
        );
        continue;
      }

      const totalSlotsForVillage =
        target.row.querySelectorAll('td.option[data-id]').length || 1;

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
        freeForVillage,
        '– Gesamt-Slots in diesem Dorf:',
        totalSlotsForVillage
      );

      const hasUnits = fillTemplateForVillage(
        village,
        enabledUnits,
        freeForVillage,
        totalSlotsForVillage,
        target.villageId
      );

      if (!hasUnits) {
        console.log(
          '[DSMassScavenger] keine sendbaren Units für Dorf',
          village.village_id,
          '→ Slot wird übersprungen.'
        );
        continue;
      }

      clearAllSelections();

      const ok = selectCell(target);
      if (!ok) {
        console.warn('[DSMassScavenger] konnte Slot nicht selektieren → Slot wird übersprungen.');
        continue;
      }

      const $btn = jQuery('#scavenge_mass_screen .buttons-container .btn-send');
      if ($btn.length) $btn.removeAttr('disabled');

      return 0;
    }

    console.log('[DSMassScavenger] kein geeigneter Slot mit aktivierten Units gefunden.');
    return -1;
  }

  // ---------------------------------------------------------------------------
  // Auto-Sequenz
  // ---------------------------------------------------------------------------

  let MASS_RUN_ACTIVE = false;
  let MASS_ITER = 0;
  const MASS_ITER_LIMIT = 50;
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

    setTimeout(() => runMassSequence(), MASS_STEP_DELAY_MS);
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
