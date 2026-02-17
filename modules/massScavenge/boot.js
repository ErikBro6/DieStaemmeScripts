(function () {
  'use strict';

  const ROOT = (window.DSTools ||= {});
  const NS = (ROOT.massScavenge ||= {});
  const DS_BotGuard = window.DS_BotGuard || null;
  const isBotGuardActive = () => !!DS_BotGuard?.isActive?.();

  function isCorrectPage() {
    const url = new URL(location.href);
    return (
      url.searchParams.get('screen') === 'place' &&
      url.searchParams.get('mode') === 'scavenge_mass'
    );
  }

  function exposeLegacyApiOnce() {
    if (window.DSMassScavenger) return;
    if (!NS.logic || typeof NS.logic.planNextSlot !== 'function') return;

    window.DSMassScavenger = {
      planNextSlot: NS.logic.planNextSlot,

      isReady: () => {
        const root = document.querySelector('#scavenge_mass_screen');
        if (!root) return false;

        // 1) Haupt-Widget da
        if (!root.querySelector('.candidate-squad-widget')) return false;

        // 2) Slots existieren
        if (!root.querySelector('td.option')) return false;

        // 3) Unit-Inputs existieren
        if (!root.querySelector('input.unitsInput')) return false;

        // 4) Send-Button existiert
        if (!root.querySelector('.btn-send')) return false;

        return true;
      }
    };

    console.log('[MassScav] Legacy DSMassScavenger API exposed & ready-check armed');
  }

  function boot() {
    if (!isCorrectPage()) return;

    const iv = setInterval(() => {
      if (isBotGuardActive()) return;
      const widget = document.querySelector(
        '#scavenge_mass_screen .candidate-squad-widget'
      );
      if (!widget) return;

      // Prereqs
      if (!NS.ui?.ensureMassUi || !NS.massConfig?.parseMassConfig || !NS.uiEvents?.bindOnce) return;

      clearInterval(iv);

      // 1) UI Basis
      NS.ui.ensureMassUi();

      // 2) MassConfig
      const cfg = NS.massConfig.parseMassConfig();
      if (!cfg || !cfg.unitDefs || !cfg.villages?.length) return;

      // 2.1) Globales Defaults-UI (Apply-to-all)
      NS.ui.buildGlobalDefaultsUI?.(cfg.unitDefs);

      // 3) Pro-Dorf UI
      document
        .querySelectorAll(
          '#scavenge_mass_screen .mass-scavenge-table tr[id^="scavenge_village_"]'
        )
        .forEach(row => {
          const villageId =
            row.getAttribute('data-id') ||
            row.id.replace('scavenge_village_', '');
          NS.ui.buildVillageUnitUI(row, String(villageId), cfg.unitDefs);
        });

      // 4) Events
      NS.uiEvents.bindOnce();

      // 5) Legacy API
      exposeLegacyApiOnce();
    }, 50);
  }

  boot();
})();
