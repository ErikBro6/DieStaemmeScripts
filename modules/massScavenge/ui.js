(function () {
  'use strict';

  const ROOT = (window.DSTools ||= {});
  const NS = (ROOT.massScavenge ||= {});
  const { getVillageConfig, loadSettings } = NS.settings;

  /* ------------------------------------------------------------------ */
  /* GLOBAL DEFAULT CONFIG (TOP TABLE)                                   */
  /* ------------------------------------------------------------------ */
  function buildGlobalDefaultsUI(unitDefs) {
    if (!unitDefs) return;
    if (document.getElementById('ds-mass-global-units-row')) return;

    const st = loadSettings() || {};
    const gt = st.globalTemplate || { units: null, max: {} };
    const scavengeMode = (st.scavengeMode === 'sameDuration' || st.scavengeMode === 'optimized')
      ? st.scavengeMode
      : 'optimized';

    // enabled === null => default ("all units")
    // enabled === []   => explicitly none
    const enabled =
      Array.isArray(gt.units)
        ? gt.units
        : Array.isArray(st.enabledUnits)
          ? st.enabledUnits
          : null;

    const maxCfg = (gt.max && typeof gt.max === 'object') ? gt.max : {};

    const sendContainer = document.querySelector('#scavenge_mass_screen .buttons-container');
    if (!sendContainer) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'ds-mass-global-units-row';
    wrapper.className = 'ds-mass-global-units-row';
    wrapper.style.marginTop = '6px';

    const modeRow = document.createElement('div');
    modeRow.className = 'ds-mass-mode-row';
    modeRow.style.display = 'flex';
    modeRow.style.alignItems = 'center';
    modeRow.style.gap = '8px';
    modeRow.style.margin = '6px 0 2px 10px';

    const modeLabel = document.createElement('label');
    modeLabel.style.display = 'inline-flex';
    modeLabel.style.alignItems = 'center';
    modeLabel.style.gap = '6px';
    modeLabel.style.cursor = 'pointer';

    const modeCb = document.createElement('input');
    modeCb.type = 'checkbox';
    modeCb.id = 'ds-mass-mode-same-duration';
    modeCb.checked = scavengeMode === 'sameDuration';

    const modeText = document.createElement('span');
    modeText.textContent = 'Gleiche Dauer (sonst optimiert)';

    modeLabel.appendChild(modeCb);
    modeLabel.appendChild(modeText);
    modeRow.appendChild(modeLabel);

    const table = document.createElement('table');
    table.className = 'candidate-squad-widget vis ds-mass-config';
    table.style.width = 'auto';
    table.style.marginLeft = '10px';

    const tbody = document.createElement('tbody');

    /* ---------- HEADER ROW ---------- */
    const headerTr = document.createElement('tr');

    const explainTh = document.createElement('th');
    explainTh.textContent = 'Default-Config';
    explainTh.style.whiteSpace = 'nowrap';
    headerTr.appendChild(explainTh);

    Object.keys(unitDefs).forEach(unit => {
      const def = unitDefs[unit] || {};
      const th = document.createElement('th');
      th.style.width = '48px';
      th.style.textAlign = 'center';

      const a = document.createElement('a');
      a.href = '#';
      a.className = 'unit_link';
      a.dataset.unit = unit;

      const img = document.createElement('img');
      img.src = `/graphic/unit/unit_${unit}.png`;
      img.dataset.title = def.name || unit;

      a.appendChild(img);
      th.appendChild(a);
      headerTr.appendChild(th);
    });

    const actionTh = document.createElement('th');
    actionTh.textContent = 'Aktion';
    actionTh.style.whiteSpace = 'nowrap';
    headerTr.appendChild(actionTh);

    tbody.appendChild(headerTr);

    /* ---------- INPUT ROW ---------- */
    const inputTr = document.createElement('tr');

    const explainTd = document.createElement('td');
    explainTd.textContent = 'Aktiv / Max';
    explainTd.style.fontSize = '11px';
    explainTd.style.whiteSpace = 'nowrap';
    inputTr.appendChild(explainTd);

    Object.keys(unitDefs).forEach(unit => {
      const td = document.createElement('td');
      td.style.width = '48px';
      td.style.textAlign = 'center';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'globalUnitToggle';
      cb.dataset.unit = unit;
      cb.checked = (enabled == null) ? true : enabled.includes(unit);

      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.min = '0';
      maxInput.className = 'input-nicer globalUnitMax';
      maxInput.dataset.unit = unit;
      maxInput.style.width = '55px';

      if (Number.isFinite(maxCfg[unit]) && maxCfg[unit] > 0) {
        maxInput.value = String(maxCfg[unit]);
      }

      td.appendChild(cb);
      td.appendChild(maxInput);
      inputTr.appendChild(td);
    });

    const actionTd = document.createElement('td');
    actionTd.style.textAlign = 'center';

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'btn ds-mass-apply-all';
    applyBtn.textContent = 'Auf alle Dörfer anwenden';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn ds-mass-save';
    saveBtn.textContent = 'Einstellungen speichern';
    saveBtn.style.marginTop = '6px';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn ds-mass-clear';
    clearBtn.textContent = 'Mit allem Farmen';
    clearBtn.style.marginTop = '6px';

    const actionsWrap = document.createElement('div');
    actionsWrap.style.display = 'flex';
    actionsWrap.style.flexDirection = 'column';
    actionsWrap.style.gap = '6px';
    actionsWrap.appendChild(applyBtn);
    actionsWrap.appendChild(saveBtn);
    actionsWrap.appendChild(clearBtn);

    actionTd.appendChild(actionsWrap);
    inputTr.appendChild(actionTd);

    tbody.appendChild(inputTr);

    table.appendChild(tbody);
    wrapper.appendChild(modeRow);
    wrapper.appendChild(table);

    sendContainer.parentElement.insertAdjacentElement('afterend', wrapper);
  }

  /* ------------------------------------------------------------------ */
  /* PER-VILLAGE CONFIG (ROWS BELOW)                                     */
  /* ------------------------------------------------------------------ */
  function buildVillageUnitUI(row, villageId, unitDefs) {
    if (!unitDefs) return;
    if (row.nextSibling?.classList?.contains('ds-mass-village-units-row')) return;

    const vKey = String(villageId);
    const vCfg = getVillageConfig(vKey);
    const enabledForVillage = vCfg.units;
    const maxCfg = vCfg.max || {};

    const outerTr = document.createElement('tr');
    outerTr.className = 'ds-mass-village-units-row';

    const leftTd = document.createElement('td');
    leftTd.style.verticalAlign = 'top';
    leftTd.style.fontWeight = 'bold';
    leftTd.style.whiteSpace = 'nowrap';
    leftTd.style.width = '160px';

    const link = row.cells[0]?.querySelector('a');
    if (link) leftTd.appendChild(link.cloneNode(true));
    outerTr.appendChild(leftTd);

    const rightTd = document.createElement('td');
    rightTd.colSpan = row.cells.length;

    const expl = document.createElement('div');
    expl.textContent = 'Einheiten auswählen & maximale Menge festlegen (gesamt, verteilt auf alle Slots):';
    expl.style.fontSize = '11px';
    expl.style.marginBottom = '4px';
    rightTd.appendChild(expl);

    const table = document.createElement('table');
    table.className = 'candidate-squad-widget vis ds-mass-config';
    table.style.width = 'auto';
    table.style.marginLeft = '10px';

    const tbody = document.createElement('tbody');

    const headerTr = document.createElement('tr');
    const h = document.createElement('th');
    h.textContent = 'Einheit';
    h.style.whiteSpace = 'nowrap';
    headerTr.appendChild(h);

    Object.keys(unitDefs).forEach(unit => {
      const def = unitDefs[unit] || {};
      const th = document.createElement('th');
      th.style.width = '48px';
      th.style.textAlign = 'center';

      const a = document.createElement('a');
      a.href = '#';
      a.className = 'unit_link';
      a.dataset.unit = unit;

      const img = document.createElement('img');
      img.src = `/graphic/unit/unit_${unit}.png`;
      img.dataset.title = def.name || unit;

      a.appendChild(img);
      th.appendChild(a);
      headerTr.appendChild(th);
    });

    tbody.appendChild(headerTr);

    const inputTr = document.createElement('tr');
    const explainCell = document.createElement('td');
    explainCell.textContent = 'Aktiv / Max';
    explainCell.style.fontSize = '11px';
    explainCell.style.whiteSpace = 'nowrap';
    inputTr.appendChild(explainCell);

    Object.keys(unitDefs).forEach(unit => {
      const td = document.createElement('td');
      td.style.width = '48px';
      td.style.textAlign = 'center';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'villageUnitToggle';
      cb.dataset.village = vKey;
      cb.dataset.unit = unit;
      cb.checked = (enabledForVillage == null) ? true : enabledForVillage.includes(unit);

      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.min = '0';
      maxInput.className = 'input-nicer villageUnitMax';
      maxInput.dataset.village = vKey;
      maxInput.dataset.unit = unit;
      maxInput.style.width = '55px';

      if (Number.isFinite(maxCfg[unit]) && maxCfg[unit] > 0) {
        maxInput.value = String(maxCfg[unit]);
      }

      td.appendChild(cb);
      td.appendChild(maxInput);
      inputTr.appendChild(td);
    });

    tbody.appendChild(inputTr);
    table.appendChild(tbody);

    const wrap = document.createElement('div');
    wrap.className = 'ds-mass-village-units';
    wrap.appendChild(table);

    rightTd.appendChild(wrap);
    outerTr.appendChild(rightTd);

    row.parentNode.insertBefore(outerTr, row.nextSibling);
  }

  /* ------------------------------------------------------------------ */
  /* BASE UI INIT                                                        */
  /* ------------------------------------------------------------------ */
  function ensureMassUi() {
    const $ = window.jQuery;
    if (!$) return;

    const $grid = $('#scavenge_mass_screen .candidate-squad-widget')
      .not('.ds-mass-config')
      .first();
    if (!$grid.length || $grid.data('ds-mass-ui-ready')) return;

    $grid.data('ds-mass-ui-ready', true);
  }

  NS.ui = {
    buildVillageUnitUI,
    buildGlobalDefaultsUI,
    ensureMassUi
  };
})();
