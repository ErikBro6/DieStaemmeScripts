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

  const villagePools = new Map(); // key: village_id -> { unit: remaining }

  function collectEnabledUnitsForVillage(villageId) {
    const cfg = parseMassConfig();
    if (!cfg || !cfg.unitDefs) return [];

    const allUnits = Object.keys(cfg.unitDefs);
    const vCfg = getVillageConfig(villageId);
    let result = vCfg.units;

    if (!Array.isArray(result) || !result.length) {
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

  function fillTemplateForVillage(village, enabledUnits, freeSlotsForVillage, totalSlotsForVillage, villageId) {
    if (!$) return false;

    const inputs = $('#scavenge_mass_screen .candidate-squad-widget').not('.ds-mass-config')
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
    });

    console.log('[DSMassScavenger] perUnit (Pool/Slots/Max) für Dorf', village.village_id, {
      freeSlotsForVillage,
      totalSlotsForVillage: slotCount,
      pool: { ...pool },
      maxCfg: { ...maxCfg },
      perUnit,
    });

    let total = 0;

    inputs.each(function () {
      const $inp = $(this);
      const unit = $inp.attr('name');
      if (!unit) return;

      if (!enabledUnits.includes(unit)) {
        $inp.val('');
        $inp.trigger('input').trigger('keyup').trigger('change');
        return;
      }

      const val = perUnit[unit] || 0;
      total += val;

      $inp.val(val > 0 ? String(val) : '');
      $inp.trigger('input').trigger('keyup').trigger('change');
    });

    enabledUnits.forEach(unit => {
      const used = perUnit[unit] || 0;
      if (used > 0) pool[unit] = Math.max(0, (pool[unit] || 0) - used);
    });

    return total > 0;
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

  function collectEnabledUnitsForFillAll() {
    const st = loadSettings();

    // Legacy global
    if (Array.isArray(st.enabledUnits) && st.enabledUnits.length) return [...st.enabledUnits];

    const units = new Set();
    document.querySelectorAll('.ds-mass-village-units input.villageUnitToggle:checked').forEach(cb => {
      const u = cb.dataset.unit;
      if (u) units.add(u);
    });

    const cfgLocal = parseMassConfig();
    if (!units.size && cfgLocal && cfgLocal.unitDefs) return Object.keys(cfgLocal.unitDefs);

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
      console.log('[DSMassScavenger] keine option-inactive Zellen gefunden');
      return -1;
    }

    for (const target of inactiveCells) {
      const village = getVillageById(target.villageId);
      if (!village) {
        console.warn('[DSMassScavenger] Dorf nicht in JSON gefunden:', target.villageId);
        continue;
      }

      const enabledUnits = collectEnabledUnitsForVillage(target.villageId);
      if (!enabledUnits.length) {
        console.log('[DSMassScavenger] Dorf', target.villageId, 'hat keine aktivierten Units → Slot übersprungen.');
        continue;
      }

      const totalSlotsForVillage = target.row.querySelectorAll('td.option[data-id]').length || 1;
      const freeForVillage = inactiveCells.filter(c => c.villageId === target.villageId).length || 1;

      console.log('[DSMassScavenger] Nutze Dorf', village.village_id, `"${village.village_name}"`,
        'für Slot', target.optionId,
        '– freie Slots:', freeForVillage,
        '– Gesamt-Slots:', totalSlotsForVillage
      );

      const hasUnits = fillTemplateForVillage(
        village,
        enabledUnits,
        freeForVillage,
        totalSlotsForVillage,
        target.villageId
      );

      if (!hasUnits) {
        console.log('[DSMassScavenger] keine sendbaren Units für Dorf', village.village_id, '→ Slot übersprungen.');
        continue;
      }

      clearAllSelections();

      const ok = selectCell(target);
      if (!ok) {
        console.warn('[DSMassScavenger] konnte Slot nicht selektieren → Slot übersprungen.');
        continue;
      }

      if ($) {
        const $btn = $('#scavenge_mass_screen .buttons-container .btn-send');
        if ($btn.length) $btn.removeAttr('disabled');
      }

      return 0;
    }

    console.log('[DSMassScavenger] kein geeigneter Slot mit aktivierten Units gefunden.');
    return -1;
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
