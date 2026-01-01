(function () {
  'use strict';

  const ROOT = (window.DSTools ||= {});
  const NS = (ROOT.massScavenge ||= {});
  const { LS_KEY_SETTINGS } = NS.constants;

  const DEFAULT_SETTINGS = {
    enabledUnits: null, // legacy global
    perVillage: {},     // { [villageId]: { units: string[]|null, max: { [unit]: number } } }
    // Globales Template (für "Apply to all villages")
    globalTemplate: { units: null, max: {} },
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(LS_KEY_SETTINGS);
      if (!raw) return { ...DEFAULT_SETTINGS };

      const parsed = JSON.parse(raw);

      const enabledUnits = Array.isArray(parsed.enabledUnits) ? parsed.enabledUnits : null;
      const perVillage =
        parsed.perVillage && typeof parsed.perVillage === 'object'
          ? parsed.perVillage
          : {};

      const globalTemplate = (() => {
        const gt = parsed.globalTemplate;
        if (!gt || typeof gt !== 'object') return { ...DEFAULT_SETTINGS.globalTemplate };
        const units = Array.isArray(gt.units) && gt.units.length ? gt.units.slice() : null;
        const max = gt.max && typeof gt.max === 'object' ? { ...gt.max } : {};
        return { units, max };
      })();

      return { enabledUnits, perVillage, globalTemplate };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(st) {
    try {
      const safe = {
        enabledUnits: Array.isArray(st.enabledUnits) && st.enabledUnits.length ? st.enabledUnits : null,
        perVillage: st.perVillage && typeof st.perVillage === 'object' ? st.perVillage : {},
        globalTemplate: (() => {
          const gt = st.globalTemplate;
          if (!gt || typeof gt !== 'object') return { ...DEFAULT_SETTINGS.globalTemplate };
          const units = Array.isArray(gt.units) && gt.units.length ? gt.units : null;
          const max = gt.max && typeof gt.max === 'object' ? gt.max : {};
          return { units, max };
        })(),
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

    const cfg = { units: null, max: {} };

    if (!raw) {
      cfg.units = Array.isArray(st.enabledUnits) ? st.enabledUnits.slice() : null;
      return cfg;
    }

    // Legacy: perVillage[vId] war direkt Array
    if (Array.isArray(raw)) {
      cfg.units = raw.slice();
      return cfg;
    }

    // Neu: Objekt
    if (typeof raw === 'object') {
      if (Array.isArray(raw.units)) cfg.units = raw.units.slice();
      else if (Array.isArray(st.enabledUnits)) cfg.units = st.enabledUnits.slice();
      else cfg.units = null;

      if (raw.max && typeof raw.max === 'object') cfg.max = { ...raw.max };
    }

    return cfg;
  }

  NS.settings = {
    DEFAULT_SETTINGS,
    loadSettings,
    saveSettings,
    getVillageConfig,
  };
})();
