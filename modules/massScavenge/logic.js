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

  const DEFAULT_RATIOS = [0.10, 0.25, 0.50, 0.75];
  const FALLBACK_CARRY = {
    spear: 25,
    sword: 15,
    axe: 10,
    archer: 10,
    scout: 0,
    light: 80,
    heavy: 50,
    marcher: 50,
    knight: 100,
    ram: 0,
    catapult: 0,
    snob: 0,
  };

  function getScavengeMode() {
    const st = loadSettings();
    if (st?.scavengeMode === 'sameDuration') return 'sameDuration';
    if (st?.scavengeMode === 'evenSplit') return 'evenSplit';
    return 'optimized';
  }

  function getOptionById(cfg, optionId) {
    if (!cfg || !Array.isArray(cfg.options)) return null;
    const id = Number(optionId);
    let opt = cfg.options.find(o =>
      o && (o.id === id || o.option_id === id || o.scavenge_option_id === id)
    );
    if (opt) return opt;
    if (Number.isFinite(id)) {
      if (cfg.options[id]) return cfg.options[id];
      if (id > 0 && cfg.options[id - 1]) return cfg.options[id - 1];
    }
    return null;
  }

  function getOptionBase(opt) {
    return opt?.base || opt || null;
  }

  function getOptionRatio(cfg, optionId) {
    const opt = getOptionById(cfg, optionId);
    const base = getOptionBase(opt);
    const candidates = [
      opt?.ratio, opt?.scavenge_factor, opt?.loot_factor,
      base?.ratio, base?.scavenge_factor, base?.loot_factor, base?.factor,
    ];
    for (const v of candidates) {
      if (Number.isFinite(v) && v > 0) return v;
    }
    const idx = Number(optionId);
    if (Number.isFinite(idx)) {
      if (idx >= 1 && idx <= DEFAULT_RATIOS.length && DEFAULT_RATIOS[idx - 1] != null) return DEFAULT_RATIOS[idx - 1];
      if (idx >= 0 && idx < DEFAULT_RATIOS.length && DEFAULT_RATIOS[idx] != null) return DEFAULT_RATIOS[idx];
    }
    return 1;
  }

  function getOptionDurationParams(cfg, optionId) {
    const opt = getOptionById(cfg, optionId);
    const base = getOptionBase(opt);
    return {
      duration_factor: base?.duration_factor,
      duration_exponent: base?.duration_exponent,
      duration_initial_seconds: base?.duration_initial_seconds,
    };
  }

  function getUnitCarry(unitDefs, unit) {
    const def = unitDefs?.[unit] || {};
    const candidates = [def.carry, def.carry_capacity, def.capacity, def.carrying_capacity];
    for (const v of candidates) {
      if (Number.isFinite(v) && v >= 0) return v;
    }
    if (FALLBACK_CARRY[unit] != null) return FALLBACK_CARRY[unit];
    return 0;
  }

  function computeTotalCarry(pool, enabledUnits, unitDefs) {
    let total = 0;
    enabledUnits.forEach(unit => {
      const amount = pool[unit] || 0;
      if (amount <= 0) return;
      const carry = getUnitCarry(unitDefs, unit);
      total += amount * carry;
    });
    return total;
  }

  function computeEqualTimeFractions(optionIds, ratioByOption) {
    const weights = optionIds.map(id => {
      const r = ratioByOption[id] || 1;
      return r > 0 ? (1 / r) : 0;
    });
    const sum = weights.reduce((s, v) => s + v, 0) || 1;
    const out = {};
    optionIds.forEach((id, i) => { out[id] = weights[i] / sum; });
    return out;
  }

  function computeEvenSplitFractions(optionIds) {
    const count = optionIds.length || 1;
    const out = {};
    optionIds.forEach(id => { out[id] = 1 / count; });
    return out;
  }

  function computeSameDurationFractions(totalCarry, optionIds, cfg, ratioByOption) {
    if (!Number.isFinite(totalCarry) || totalCarry <= 0) {
      return computeEqualTimeFractions(optionIds, ratioByOption);
    }

    const paramsByOption = {};
    let allParamsOk = true;
    optionIds.forEach(id => {
      const p = getOptionDurationParams(cfg, id);
      paramsByOption[id] = p;
      if (!Number.isFinite(p.duration_factor) || !Number.isFinite(p.duration_exponent) || !Number.isFinite(p.duration_initial_seconds)) {
        allParamsOk = false;
      }
    });

    if (!allParamsOk) return computeEqualTimeFractions(optionIds, ratioByOption);

    const initials = optionIds.map(id => paramsByOption[id].duration_initial_seconds || 0);
    let lo = Math.max(0, ...initials);
    let hi = Math.max(lo + 60, 3600);
    let guard = 0;

    const carryForTime = (id, timeSeconds) => {
      const p = paramsByOption[id];
      const ratio = ratioByOption[id] || 1;
      if (ratio <= 0 || !Number.isFinite(p.duration_factor) || !Number.isFinite(p.duration_exponent)) return 0;
      if (p.duration_factor <= 0 || p.duration_exponent <= 0) return 0;
      const t = timeSeconds - (p.duration_initial_seconds || 0);
      if (t <= 0) return 0;
      const base = t / p.duration_factor;
      if (base <= 0) return 0;
      const haul = Math.pow(base, 1 / p.duration_exponent) / 100;
      return haul / ratio;
    };

    const sumCarryAt = (timeSeconds) => {
      let sum = 0;
      optionIds.forEach(id => { sum += carryForTime(id, timeSeconds); });
      return sum;
    };

    while (sumCarryAt(hi) < totalCarry && guard++ < 40) {
      hi *= 2;
      if (hi > 1e8) break;
    }

    if (sumCarryAt(hi) <= 0) return computeEqualTimeFractions(optionIds, ratioByOption);

    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (sumCarryAt(mid) >= totalCarry) hi = mid;
      else lo = mid;
    }

    const sum = sumCarryAt(hi) || 1;
    const out = {};
    optionIds.forEach(id => {
      out[id] = carryForTime(id, hi) / sum;
    });
    return out;
  }

  function computeOptimalFractions(totalCarry, optionIds, ratioByOption) {
    if (!Number.isFinite(totalCarry) || totalCarry <= 0) {
      return computeEqualTimeFractions(optionIds, ratioByOption);
    }

    if (optionIds.length === 1) return { [optionIds[0]]: 1 };

    const ratios = optionIds.map(id => ratioByOption[id] || 1);
    const a = optionIds.map(() => 1 / optionIds.length);

    const revPerHour = (cap, ai, ratio) => {
      if (ai <= 0) return 0;
      const load = cap * ai;
      const denom = Math.pow((load * load) * 100 * (ratio * ratio), 0.45) + 1800;
      return (load * ratio) / denom;
    };

    const totalRev = () => {
      let s = 0;
      for (let i = 0; i < optionIds.length; i++) {
        s += revPerHour(totalCarry, a[i] || 0, ratios[i] || 1);
      }
      return s;
    };

    let improved = true;
    let guard = 0;
    while (improved && guard++ < 200) {
      improved = false;
      for (let k = 0; k < optionIds.length - 1; k++) {
        const cur = totalRev();
        if (a[k] > 0) {
          const d = a[k] * 0.5;
          a[k] -= d; a[k + 1] += d;
          const v1 = totalRev();
          if (v1 <= cur) { a[k + 1] -= d; a[k] += d; } else { improved = true; continue; }
        }
        if (a[k + 1] > 0) {
          const d = a[k + 1] * 0.5;
          a[k + 1] -= d; a[k] += d;
          const v2 = totalRev();
          if (v2 <= cur) { a[k] -= d; a[k + 1] += d; } else { improved = true; }
        }
      }
    }

    const sum = a.reduce((s, v) => s + v, 0) || 1;
    const out = {};
    optionIds.forEach((id, i) => { out[id] = a[i] / sum; });
    return out;
  }

  function splitByFractions(amount, optionIds, fractionsByOption) {
    const res = {};
    let assigned = 0;
    optionIds.forEach(id => {
      const f = fractionsByOption[id] || 0;
      const v = Math.floor((amount || 0) * f);
      res[id] = v;
      assigned += v;
    });
    let remainder = (amount || 0) - assigned;
    if (remainder > 0) {
      for (let i = optionIds.length - 1; i >= 0; i--) {
        const id = optionIds[i];
        if ((fractionsByOption[id] || 0) > 0) {
          res[id] += remainder;
          break;
        }
      }
    }
    return res;
  }

  function buildPerOptionUnitDistribution(pool, enabledUnits, optionIds, fractionsByOption) {
    const perOption = {};
    optionIds.forEach(id => { perOption[id] = {}; });

    enabledUnits.forEach(unit => {
      const amount = pool[unit] || 0;
      const split = splitByFractions(amount, optionIds, fractionsByOption);
      optionIds.forEach(id => { perOption[id][unit] = split[id] || 0; });
    });

    return perOption;
  }

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

  function collectActiveScavengeUnits(village, enabledUnits) {
    const out = {};
    enabledUnits.forEach(u => { out[u] = 0; });

    const opts = village?.options;
    if (!opts) return out;

    const entries = Array.isArray(opts) ? opts : Object.values(opts);
    entries.forEach(o => {
      const squad = o?.scavenging_squad || o?.squad || o?.scavenge_squad;
      if (!squad) return;

      const unitsObj =
        squad.units ||
        squad.unit_counts ||
        squad.unitCounts ||
        squad.unit_counts_home ||
        squad.unitCountsHome;

      if (!unitsObj || typeof unitsObj !== 'object') return;

      enabledUnits.forEach(unit => {
        const n = unitsObj[unit];
        if (Number.isFinite(n) && n > 0) out[unit] += n;
      });
    });

    return out;
  }

  function getVillagePool(village, enabledUnits, maxCfg) {
    const key = String(village.village_id);
    let pool = villagePools.get(key);

    if (!pool) {
      const active = collectActiveScavengeUnits(village, enabledUnits);
      pool = {};
      enabledUnits.forEach(unit => {
        const home = (village.unit_counts_home && village.unit_counts_home[unit]) || 0;
        const maxVal = maxCfg && typeof maxCfg[unit] === 'number' && maxCfg[unit] > 0 ? maxCfg[unit] : null;
        const used = active[unit] || 0;
        const remainingCap = (maxVal != null) ? Math.max(0, maxVal - used) : null;
        const cap = remainingCap != null ? Math.min(home, remainingCap) : home;
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

      const maxCfg = getMaxConfigForVillage(villageId);
      const pool = getVillagePool(village, enabledUnits, maxCfg);
      const totalUnits = enabledUnits.reduce((s, u) => s + (pool[u] || 0), 0);

      if (totalUnits <= 0) {
        logDebug('[DSMassScavenger] keine sendbaren Units für Dorf', village.village_id, '→ übersprungen.');
        continue;
      }

      const optionIds = Array.from(new Set(cells.map(c => c.optionId))).sort((a, b) => a - b);
      const ratioByOption = {};
      optionIds.forEach(id => { ratioByOption[id] = getOptionRatio(cfg, id); });

      const totalCarry = computeTotalCarry(pool, enabledUnits, cfg.unitDefs);
      const mode = getScavengeMode();
      const fractionsByOption = (mode === 'sameDuration')
        ? computeSameDurationFractions(totalCarry, optionIds, cfg, ratioByOption)
        : (mode === 'evenSplit')
          ? computeEvenSplitFractions(optionIds)
          : computeOptimalFractions(totalCarry, optionIds, ratioByOption);

      const perOptionUnit = buildPerOptionUnitDistribution(pool, enabledUnits, optionIds, fractionsByOption);

      logDebug('[DSMassScavenger] perOption (Pool/Mode) für Dorf', village.village_id, {
        mode,
        pool: { ...pool },
        maxCfg: { ...maxCfg },
        ratios: { ...ratioByOption },
        fractions: { ...fractionsByOption },
      });

      cells.forEach(cellObj => {
        const perUnit = perOptionUnit[cellObj.optionId] || {};
        const totalForCell = enabledUnits.reduce((s, u) => s + (perUnit[u] || 0), 0);
        if (totalForCell <= 0) return;
        const perUnitAll = normalizePerUnit(perUnit, enabledUnits, inputUnits);
        const key = buildTemplateKey(perUnitAll, inputUnits);

        const group = groups.get(key) || { perUnitAll, cells: [] };
        group.cells.push({ ...cellObj, perUnitAll });
        groups.set(key, group);
      });
    }

    if (!groups.size) {
      logDebug('[DSMassScavenger] kein geeigneter Slot mit aktivierten Units gefunden.');
      return -1;
    }

    const groupList = Array.from(groups.values()).sort((a, b) => b.cells.length - a.cells.length);
    const chosen = groupList[0];

    // Avoid sending multiple slots from the same village in one batch.
    // The input values apply per selected slot, so multiple slots would multiply.
    const seenVillages = new Set();
    const filteredCells = [];
    chosen.cells.forEach(cellObj => {
      const vId = String(cellObj.villageId);
      if (seenVillages.has(vId)) return;
      seenVillages.add(vId);
      filteredCells.push(cellObj);
    });
    chosen.cells = filteredCells;

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

      const perUnit = cellObj.perUnitAll || chosen.perUnitAll;
      inputUnits.forEach(unit => {
        const used = perUnit[unit] || 0;
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


