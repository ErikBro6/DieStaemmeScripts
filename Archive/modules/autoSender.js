(function () {
  'use strict';

  const PARAM_KEY  = 'auto';
  const PARAM_VAL  = '1';
  const BTN_SEL    = '#target_attack';
  const SCAN_MS    = 300;
  const TIMEOUT_MS = 150_000;

  const url = new URL(location.href);
  const hasParam  = url.searchParams.get(PARAM_KEY) === PARAM_VAL;
  const cameByRef = !!(document.referrer && /:\/\/(?:www\.)?ds-ultimate\.de\//i.test(document.referrer));

  if (!(cameByRef || hasParam)) {
    sessionStorage.removeItem('ds_auto_flow');
    return;
  }
  sessionStorage.setItem('ds_auto_flow', '1');

  const onceKey = 'ds_auto_sent_' + url.pathname + '?' + url.search;
  if (sessionStorage.getItem(onceKey) === '1') return;

  if (cameByRef && !hasParam) {
    url.searchParams.set(PARAM_KEY, PARAM_VAL);
    history.replaceState(null, '', url);
  }

  function withParam(u, key, val) {
    const x = new URL(u, location.href);
    x.searchParams.set(key, val);
    return x.toString();
  }

  function prepareFormForAuto(btn) {
    if (!(cameByRef || hasParam)) return;
    const form = btn.closest('form') || btn.form;
    if (!form) return;

    if (!form.querySelector(`input[name="${PARAM_KEY}"]`)) {
      const h = document.createElement('input');
      h.type = 'hidden';
      h.name = PARAM_KEY;
      h.value = PARAM_VAL;
      form.appendChild(h);
    }
    if (form.action) form.action = withParam(form.action, PARAM_KEY, PARAM_VAL);
  }

  // Konfig für Spezialfälle
  const SPECIAL_LIMITS = {
    ram:   5,    // max -5
    light: 125,  // max -125
  };

  // Einheiten die 9999→alle klicken sollen
  const AUTO_ALL_UNITS = ['axe'];

  const unitsApplied = {};

  function ensureUnitsIfNeeded() {
    let allOk = true;

    // Allgemeine Behandlung für alle Inputs die wir kennen
    const unitInputs = document.querySelectorAll('input.unitsInput[id^="unit_input_"]');

    unitInputs.forEach(input => {
      const unit = input.name;
      if (unitsApplied[unit]) return;

      const val = Number((input.value || '').trim());
      const allCount = Number(input.dataset.allCount || '0');

      // Fall 1: Spezial-Limit (ram, light)
      if (unit in SPECIAL_LIMITS) {
        const reduce = SPECIAL_LIMITS[unit];
        if (val > allCount) {
          const newVal = Math.max(allCount - reduce, 0);
          input.value = newVal;
        }
        unitsApplied[unit] = true;
        return;
      }

      // Fall 2: 9999 → "Alle"-Link klicken
      if (AUTO_ALL_UNITS.includes(unit) && val === 9999) {
        const allLink =
          document.getElementById(`units_entry_all_${unit}`) ||
          document.querySelector(`.units-entry-all[data-unit="${unit}"]`);

        if (allLink) {
          allLink.click();
          unitsApplied[unit] = true;
          allOk = false; // einen Tick warten, bis DOM aktualisiert ist
        } else {
          allOk = false;
        }
        return;
      }

      // Für alle anderen: nichts Besonderes
      unitsApplied[unit] = true;
    });

    return allOk;
  }

  function tryClick() {
    if (!ensureUnitsIfNeeded()) return false;

    const btn = document.querySelector(BTN_SEL);
    if (!btn || btn.disabled) return false;

    prepareFormForAuto(btn);
    btn.click();
    sessionStorage.setItem(onceKey, '1');
    return true;
  }

  if (tryClick()) return;

  const start = Date.now();
  const iv = setInterval(() => {
    if (tryClick()) {
      clearInterval(iv);
    } else if (Date.now() - start > TIMEOUT_MS) {
      clearInterval(iv);
    }
  }, SCAN_MS);

  const mo = new MutationObserver(() => { tryClick(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), TIMEOUT_MS);

})();
