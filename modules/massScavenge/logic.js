(function () {
  'use strict';

  const DSGuards = window.DSGuards || null;
  const guardAction = DSGuards?.guardAction ? DSGuards.guardAction.bind(DSGuards) : (fn) => fn();

  const ROOT = (window.DSTools ||= {});
  const NS = (ROOT.massScavenge ||= {});
  const $ = window.jQuery;

  const { parseMassConfig, getVillageById } = NS.massConfig;
  const { getVillageConfig, loadSettings } = NS.settings;
  const { DEBUG } = NS.constants;
  const logDebug = (...args) => {
    if (DEBUG) console.log(...args);
  };

  const villagePools = new Map(); // key: village_id -> { unit: remaining }

  function collectEnabledUnitsForVillage(villageId) {
    const cfg = parseMassConfig();
    if (!cfg || !cfg.unitDefs) return [];

    const allUnits = Object.keys(cfg.unitDefs);
    const vCfg = getVillageConfig(villageId);
    let result = vCfg.units;

    // Semantik:
    //   null/undefined => default (global/all)
    //   []             => ausdrücklich keine
    if (!Array.isArray(result)) {
      const st = loadSettings();
      if (Array.isArray(st.enabledUnits) && st.enabledUnits.length) result = st.enabledUnits.slice();
      else result = allUnits;
    }

    return result.filter(u => allUnits.includes(u));
  }

  function getMaxConfigForVillage(villageId) {
    return getVillageConfig(villageId).max || {};
  }

  function findAllInactiveCells() {
    if (DEBUG) console.group('[DSMassScavenger][DEBUG] findAllInactiveCells()');

    const cells = [];
    const rows = document.querySelectorAll('#scavenge_mass_screen .mass-scavenge-table tr[id^="scavenge_village_"]');

    rows.forEach(row => {
      const villageId = row.getAttribute('data-id') || row.id.replace('scavenge_village_', '');
      const optCells = row.querySelectorAll('td.option[data-id]');

      if (DEBUG) console.log(`\n▶ Dorf ${villageId}: Prüfe ${optCells.length} Slots`);

      optCells.forEach(cell => {
        const optId = parseInt(cell.getAttribute('data-id'), 10);
        if (!Number.isFinite(optId)) return;

        const inactive = cell.classList.contains('option-inactive');
        const locked = cell.classList.contains('option-locked');

        if (DEBUG) console.log(`  Slot ${optId}: inactive=${inactive}, locked=${locked}, classes="${cell.className}"`);

        if (!inactive) return;
        if (locked) return;

        cells.push({ row, cell, villageId: String(villageId), optionId: optId });
      });
    });

    if (DEBUG) {
      console.log(`\nErgebnis → ${cells.length} echte freie Slots`);
      cells.forEach(c => console.log(`  ✔ Dorf ${c.villageId}, Slot ${c.optionId}`));
      console.groupEnd();
    }

    return cells;
  }

  function getVillagePool(village, enabledUnits, maxCfg) {
    const key = String(village.village_id);
    let pool = villagePools.get(key);

    if (!pool) {
      pool = {};
      enabledUnits.forEach(unit => {
        const home = (village.unit_counts_home && village.unit_counts_home[unit]) || 0;
        const maxVal = maxCfg && typeof maxCfg[unit] === 'number' && maxCfg[unit] > 0 ? maxCfg[unit] : null;
        const cap = maxVal != null ? Math.min(home, maxVal) : home;
        pool[unit] = cap;
      });
      villagePools.set(key, pool);
    }

    return pool;
  }

  function getTemplateInputs() {
    if (!$) return null;
    const inputs = $('#scavenge_mass_screen .candidate-squad-widget').not('.ds-mass-config')
      .find('input.unitsInput[name]');
    return inputs && inputs.length ? inputs : null;
  }

  function getInputUnits(inputs) {
    const units = [];
    inputs.each(function () {
      const unit = $(this).attr('name');
      if (unit) units.push(unit);
    });
    return units;
  }

  function computePerUnitForVillage(village, enabledUnits, freeSlotsForVillage, totalSlotsForVillage, villageId) {
    const maxCfg = getMaxConfigForVillage(villageId);
    const pool = getVillagePool(village, enabledUnits, maxCfg);

    const divFree = freeSlotsForVillage > 0 ? freeSlotsForVillage : 1;
    const slotCount = totalSlotsForVillage > 0 ? totalSlotsForVillage : 1;

    const perUnit = {};
    let total = 0;

    enabledUnits.forEach(unit => {
      const remaining = pool[unit] || 0;
      const maxVal = maxCfg && typeof maxCfg[unit] === 'number' && maxCfg[unit] > 0 ? maxCfg[unit] : null;

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
      total += amount;
    });

    return { perUnit, total, pool, maxCfg, slotCount };
  }

  function normalizePerUnit(perUnit, enabledUnits, inputUnits) {
    const normalized = {};
    inputUnits.forEach(unit => {
      if (enabledUnits.includes(unit)) normalized[unit] = perUnit[unit] || 0;
      else normalized[unit] = 0;
    });
    return normalized;
  }

  function buildTemplateKey(perUnit, inputUnits) {
    return inputUnits.map(u => `${u}:${perUnit[u] || 0}`).join('|');
  }

  function applyTemplateInputs(perUnit, inputs) {
    if (!inputs) return;
    inputs.each(function () {
      const $inp = $(this);
      const unit = $inp.attr('name');
      if (!unit) return;

      const val = perUnit[unit] || 0;
      $inp.val(val > 0 ? String(val) : '');
      $inp.trigger('input').trigger('keyup').trigger('change');
    });
  }

  function clearAllSelections() {
    if (!$) return;
    const $tbl = $('#scavenge_mass_screen .mass-scavenge-table');

    $tbl.find('input.status-inactive:checked').each(function () {
      guardAction(() => this.click());
    });
    $tbl.find('input.select-all-col:checked').each(function () {
      guardAction(() => this.click());
    });
    $tbl.find('input.select-all-row:checked').each(function () {
      guardAction(() => this.click());
    });
  }

  function selectCell(cellObj) {
    const { cell } = cellObj;
    const cb = cell.querySelector('input.status-inactive');

    if (cb) {
      if (!cb.checked) guardAction(() => cb.click());
      return cb.checked;
    }

    guardAction(() => cell.click());
    return true;
  }

  function collectEnabledUnitsForFillAll() {
    const st = loadSettings();

    // Legacy global
    if (Array.isArray(st.enabledUnits) && st.enabledUnits.length) return [...st.enabledUnits];

    const units = new Set();
    const allVillageToggles = document.querySelectorAll('.ds-mass-village-units input.villageUnitToggle');

    document.querySelectorAll('.ds-mass-village-units input.villageUnitToggle:checked').forEach(cb => {
      const u = cb.dataset.unit;
      if (u) units.add(u);
    });

    // Wenn UI noch nicht da ist, fall back auf alle Units.
    if (!allVillageToggles.length) {
      const cfgLocal = parseMassConfig();
      if (cfgLocal && cfgLocal.unitDefs) return Object.keys(cfgLocal.unitDefs);
    }

    // Wenn UI existiert und nichts angehakt ist: wirklich "keine".
    return Array.from(units);
  }

  function planNextSlot() {
    const cfg = parseMassConfig();
    if (!cfg) {
      console.warn('[DSMassScavenger] keine Config → Abbruch');
      return -1;
    }

    const inactiveCells = findAllInactiveCells();
    if (!inactiveCells.length) {
      logDebug('[DSMassScavenger] keine option-inactive Zellen gefunden');
      return -1;
    }

    const inputs = getTemplateInputs();
    if (!inputs) {
      console.warn('[DSMassScavenger] keine Template-Inputs gefunden → Abbruch');
      return -1;
    }

    const inputUnits = getInputUnits(inputs);
    if (!inputUnits.length) {
      console.warn('[DSMassScavenger] keine Unit-Inputs gefunden → Abbruch');
      return -1;
    }

    const cellsByVillage = new Map();
    inactiveCells.forEach(c => {
      const key = String(c.villageId);
      const arr = cellsByVillage.get(key) || [];
      arr.push(c);
      cellsByVillage.set(key, arr);
    });

    const groups = new Map();

    for (const [villageId, cells] of cellsByVillage.entries()) {
      const village = getVillageById(villageId);
      if (!village) {
        console.warn('[DSMassScavenger] Dorf nicht in JSON gefunden:', villageId);
        continue;
      }

      const enabledUnits = collectEnabledUnitsForVillage(villageId);
      if (!enabledUnits.length) {
        logDebug('[DSMassScavenger] Dorf', villageId, 'hat keine aktivierten Units → übersprungen.');
        continue;
      }

      const totalSlotsForVillage = cells[0]?.row?.querySelectorAll('td.option[data-id]').length || 1;
      const freeForVillage = cells.length || 1;

      const { perUnit, total, pool, maxCfg, slotCount } = computePerUnitForVillage(
        village,
        enabledUnits,
        freeForVillage,
        totalSlotsForVillage,
        villageId
      );

      if (total <= 0) {
        logDebug('[DSMassScavenger] keine sendbaren Units für Dorf', village.village_id, '→ übersprungen.');
        continue;
      }

      logDebug('[DSMassScavenger] perUnit (Pool/Slots/Max) für Dorf', village.village_id, {
        freeSlotsForVillage: freeForVillage,
        totalSlotsForVillage: slotCount,
        pool: { ...pool },
        maxCfg: { ...maxCfg },
        perUnit,
      });

      const perUnitAll = normalizePerUnit(perUnit, enabledUnits, inputUnits);
      const key = buildTemplateKey(perUnitAll, inputUnits);

      const group = groups.get(key) || { perUnitAll, cells: [] };
      group.cells.push(...cells);
      groups.set(key, group);
    }

    if (!groups.size) {
      logDebug('[DSMassScavenger] kein geeigneter Slot mit aktivierten Units gefunden.');
      return -1;
    }

    const groupList = Array.from(groups.values()).sort((a, b) => b.cells.length - a.cells.length);
    const chosen = groupList[0];

    applyTemplateInputs(chosen.perUnitAll, inputs);
    clearAllSelections();

    let selectedCount = 0;
    chosen.cells.forEach(cellObj => {
      if (selectCell(cellObj)) selectedCount += 1;
    });

    if (!selectedCount) {
      console.warn('[DSMassScavenger] keine Zelle selektiert → Abbruch.');
      return -1;
    }

    chosen.cells.forEach(cellObj => {
      const vId = String(cellObj.villageId);
      const pool = villagePools.get(vId);
      if (!pool) return;

      inputUnits.forEach(unit => {
        const used = chosen.perUnitAll[unit] || 0;
        if (used <= 0) return;
        if (!(unit in pool)) return;
        pool[unit] = Math.max(0, (pool[unit] || 0) - used);
      });
    });

    if ($) {
      const $btn = $('#scavenge_mass_screen .buttons-container .btn-send');
      if ($btn.length) $btn.removeAttr('disabled');
    }

    return 0;
  }

  NS.logic = {
    villagePools,
    collectEnabledUnitsForVillage,
    getMaxConfigForVillage,
    collectEnabledUnitsForFillAll,
    planNextSlot,
    clearAllSelections,
  };


})();
