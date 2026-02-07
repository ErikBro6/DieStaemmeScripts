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
    scavengeMode: 'evenSplit', // 'optimized' | 'sameDuration' | 'evenSplit'
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(LS_KEY_SETTINGS);
      if (!raw) return { ...DEFAULT_SETTINGS };

      const parsed = JSON.parse(raw);

      // enabledUnits (legacy global): keep array as-is (including empty) so "no units" can be expressed.
      const enabledUnits = Array.isArray(parsed.enabledUnits) ? parsed.enabledUnits : null;
      const perVillage =
        parsed.perVillage && typeof parsed.perVillage === 'object'
          ? parsed.perVillage
          : {};

      const globalTemplate = (() => {
        const gt = parsed.globalTemplate;
        if (!gt || typeof gt !== 'object') return { ...DEFAULT_SETTINGS.globalTemplate };
        // units: null => default/all units, [] => explicitly none
        const units = Array.isArray(gt.units) ? gt.units.slice() : null;
        const max = gt.max && typeof gt.max === 'object' ? { ...gt.max } : {};
        return { units, max };
      })();

      const scavengeMode = (parsed.scavengeMode === 'sameDuration' || parsed.scavengeMode === 'optimized' || parsed.scavengeMode === 'evenSplit')
        ? parsed.scavengeMode
        : DEFAULT_SETTINGS.scavengeMode;

      return { enabledUnits, perVillage, globalTemplate, scavengeMode };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(st) {
    try {
      const safe = {
        // allow [] to mean "no units"
        enabledUnits: Array.isArray(st.enabledUnits) ? st.enabledUnits : null,
        perVillage: st.perVillage && typeof st.perVillage === 'object' ? st.perVillage : {},
        globalTemplate: (() => {
          const gt = st.globalTemplate;
          if (!gt || typeof gt !== 'object') return { ...DEFAULT_SETTINGS.globalTemplate };
          const units = Array.isArray(gt.units) ? gt.units : null;
          const max = gt.max && typeof gt.max === 'object' ? gt.max : {};
          return { units, max };
        })(),
        scavengeMode: (st.scavengeMode === 'sameDuration' || st.scavengeMode === 'optimized' || st.scavengeMode === 'evenSplit')
          ? st.scavengeMode
          : DEFAULT_SETTINGS.scavengeMode,
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
