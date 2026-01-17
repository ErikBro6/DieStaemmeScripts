(function () {
  'use strict';

  const ROOT = (window.DSTools ||= {});
  const NS = (ROOT.massScavenge ||= {});
  const $ = window.jQuery;
const DSGuards = window.DSGuards || null;
const guardAction = DSGuards?.guardAction ? DSGuards.guardAction.bind(DSGuards) : (fn) => fn();

  function bindOnce() {
    const root = document.querySelector('#scavenge_mass_screen');
    if (!root || root.dataset.dsMassEventsBound === '1') return;
    root.dataset.dsMassEventsBound = '1';

    // Änderungen an Dorf-Checkboxen direkt speichern
    root.addEventListener('change', ev => {
      const target = ev.target;
      if (!target?.classList?.contains('villageUnitToggle')) return;

      const vId = target.dataset.village;
      const unit = target.dataset.unit;
      if (!vId || !unit) return;

      const st = NS.settings.loadSettings();
      st.perVillage ||= {};
      let raw = st.perVillage[vId];

      if (!raw) raw = { units: [], max: {} };
      else if (Array.isArray(raw)) raw = { units: raw.slice(), max: {} };
      else {
        if (!Array.isArray(raw.units)) raw.units = [];
        if (!raw.max || typeof raw.max !== 'object') raw.max = {};
      }

      if (target.checked) {
        if (!raw.units.includes(unit)) raw.units.push(unit);
      } else {
        raw.units = raw.units.filter(u => u !== unit);
      }

      st.perVillage[vId] = raw;
      NS.settings.saveSettings(st);
    });

    // Global-Template: Checkboxen
    root.addEventListener('change', ev => {
      const target = ev.target;
      if (!target?.classList?.contains('globalUnitToggle')) return;
      const unit = target.dataset.unit;
      if (!unit) return;

      const st = NS.settings.loadSettings();
      st.globalTemplate ||= { units: null, max: {} };

      let units = Array.isArray(st.globalTemplate.units) ? st.globalTemplate.units.slice() : [];
      if (target.checked) {
        if (!units.includes(unit)) units.push(unit);
      } else {
        units = units.filter(u => u !== unit);
      }

      // Speichern wie ausgewählt:
      //   null => default/all (wenn wirklich alle angehakt)
      //   []   => ausdrücklich keine
      const total = document.querySelectorAll('#ds-mass-global-units-row input.globalUnitToggle').length;
      st.globalTemplate.units = (total && units.length === total) ? null : units;
      NS.settings.saveSettings(st);
    });

    // Änderungen an Max-Inputs direkt speichern
    root.addEventListener('input', ev => {
      const target = ev.target;
      if (!target?.classList?.contains('villageUnitMax')) return;

      const vId = target.dataset.village;
      const unit = target.dataset.unit;
      if (!vId || !unit) return;

      const st = NS.settings.loadSettings();
      st.perVillage ||= {};
      let raw = st.perVillage[vId];

      if (!raw) raw = { units: [], max: {} };
      else if (Array.isArray(raw)) raw = { units: raw.slice(), max: {} };
      else {
        if (!Array.isArray(raw.units)) raw.units = [];
        if (!raw.max || typeof raw.max !== 'object') raw.max = {};
      }

      const val = parseInt(target.value, 10);
      if (Number.isFinite(val) && val > 0) raw.max[unit] = val;
      else delete raw.max[unit];

      st.perVillage[vId] = raw;
      NS.settings.saveSettings(st);
    });

    // Global-Template: Max-Inputs
    root.addEventListener('input', ev => {
      const target = ev.target;
      if (!target?.classList?.contains('globalUnitMax')) return;

      const unit = target.dataset.unit;
      if (!unit) return;

      const st = NS.settings.loadSettings();
      st.globalTemplate ||= { units: null, max: {} };
      st.globalTemplate.max ||= {};

      const val = parseInt(target.value, 10);
      if (Number.isFinite(val) && val > 0) st.globalTemplate.max[unit] = val;
      else delete st.globalTemplate.max[unit];

      NS.settings.saveSettings(st);
    });

    // jQuery Events (Grid)
    if ($) {
      const $grid = $('#scavenge_mass_screen .candidate-squad-widget').not('.ds-mass-config').first();
      if ($grid.length) {
        const $inputRow = $grid.find('> tbody > tr').eq(1);

        // Fill-All
        $grid.on('click', 'a.fill-all', function (e) {
          e.preventDefault();
          const enabledUnits = NS.logic.collectEnabledUnitsForFillAll();
          enabledUnits.forEach(unit => {
            const $allLink = $inputRow.find(`a.units-entry-all[data-unit="${unit}"]`).first();
            if ($allLink.length) guardAction(() => $allLink.trigger('click'));

          });
        });

        // Auto Start/Stop
        $grid.on('click', 'button.SendMassScav', function (e) {
          e.preventDefault();
          NS.autoRunner.toggle();
        });
      }

      // Defaults speichern (Units + Max pro Dorf)
      $(document).on('click', '.ds-mass-save', function (e) {
        e.preventDefault();

        const st = NS.settings.loadSettings();
        const perVillage = {};

        document.querySelectorAll('.ds-mass-village-units input.villageUnitToggle').forEach(cb => {
          const vId = cb.dataset.village;
          const unit = cb.dataset.unit;
          if (!vId || !unit) return;

          const cell = cb.closest('td');
          const maxInput = cell ? cell.querySelector('.villageUnitMax') : null;

          if (!perVillage[vId]) perVillage[vId] = { units: [], max: {} };

          if (cb.checked && !perVillage[vId].units.includes(unit)) perVillage[vId].units.push(unit);

          if (maxInput) {
            const val = parseInt(maxInput.value, 10);
            if (Number.isFinite(val) && val > 0) perVillage[vId].max[unit] = val;
          }
        });

        st.perVillage = perVillage;
        st.enabledUnits = null; // ab jetzt pro Dorf
        NS.settings.saveSettings(st);

        try {
          if (window.UI && typeof window.UI.SuccessMessage === 'function') {
            window.UI.SuccessMessage('Einstellungen gespeichert.');
          }
        } catch { /* ignore */ }

        console.log('[DSMassScavenger] Defaults pro Dorf gespeichert:', st);
      });

      // Defaults löschen
      $(document).on('click', '.ds-mass-clear', function (e) {
        e.preventDefault();
        localStorage.removeItem(NS.constants.LS_KEY_SETTINGS);

        // Per-Dorf UI reset
        document.querySelectorAll('.ds-mass-village-units input.villageUnitToggle').forEach(cb => { cb.checked = true; });
        document.querySelectorAll('.ds-mass-village-units input.villageUnitMax').forEach(inp => { inp.value = ''; });

        // Global UI reset
        document.querySelectorAll('#ds-mass-global-units-row input.globalUnitToggle').forEach(cb => { cb.checked = true; });
        document.querySelectorAll('#ds-mass-global-units-row input.globalUnitMax').forEach(inp => { inp.value = ''; });

        console.log('[DSMassScavenger] Defaults gelöscht, alle Units aktiviert & Max-Werte zurückgesetzt.');
      });

      // Apply-to-all
      $(document).on('click', '.ds-mass-apply-all', function (e) {
        e.preventDefault();

        const rootRow = document.getElementById('ds-mass-global-units-row');
        if (!rootRow) return;

        const selectedUnits = [];
        rootRow.querySelectorAll('input.globalUnitToggle:checked').forEach(cb => {
          const u = cb.dataset.unit;
          if (u) selectedUnits.push(u);
        });

        const maxCfg = {};
        rootRow.querySelectorAll('input.globalUnitMax').forEach(inp => {
          const u = inp.dataset.unit;
          if (!u) return;
          const val = parseInt(inp.value, 10);
          if (Number.isFinite(val) && val > 0) maxCfg[u] = val;
        });

        // Semantik:
        //   null => default/all (wenn wirklich alle angehakt)
        //   []   => ausdrücklich keine
        const total = rootRow.querySelectorAll('input.globalUnitToggle').length;
        const unitsVal = (total && selectedUnits.length === total) ? null : selectedUnits;

        // alle Dörfer einsammeln
        const villageIds = new Set();
        document.querySelectorAll('.ds-mass-village-units input.villageUnitToggle').forEach(cb => {
          const v = cb.dataset.village;
          if (v) villageIds.add(v);
        });

        // UI updaten + Settings in einem Rutsch schreiben
        const st = NS.settings.loadSettings();
        st.perVillage ||= {};

        villageIds.forEach(vId => {
          st.perVillage[vId] = {
            units: unitsVal === null ? null : unitsVal.slice(),
            max: { ...maxCfg },
          };

          // UI spiegeln
          root.querySelectorAll(`.ds-mass-village-units input.villageUnitToggle[data-village="${CSS.escape(vId)}"]`).forEach(cb => {
            const u = cb.dataset.unit;
            cb.checked = unitsVal === null ? true : unitsVal.includes(u);
          });
          root.querySelectorAll(`.ds-mass-village-units input.villageUnitMax[data-village="${CSS.escape(vId)}"]`).forEach(inp => {
            const u = inp.dataset.unit;
            inp.value = (maxCfg[u] && maxCfg[u] > 0) ? String(maxCfg[u]) : '';
          });
        });

        st.enabledUnits = null; // ab jetzt pro Dorf
        st.globalTemplate = { units: unitsVal === null ? null : unitsVal.slice(), max: { ...maxCfg } };
        NS.settings.saveSettings(st);

        try {
          if (window.UI && typeof window.UI.SuccessMessage === 'function') {
            window.UI.SuccessMessage('Defaults applied to all villages.');
          }
        } catch { /* ignore */ }

        console.log('[DSMassScavenger] Apply-to-all:', { units: unitsVal, max: maxCfg, villages: villageIds.size });
      });
    }
  }

  NS.uiEvents = { bindOnce };
})();
