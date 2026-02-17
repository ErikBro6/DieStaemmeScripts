(function () {
  'use strict';

  const PARAM_KEY  = 'auto';
  const PARAM_VAL  = '1';
  const TOKEN_KEY  = 'autotoken';
  const TOKEN_SESSION_KEY = 'ds_auto_token';
  const CLOSE_AFTER_SEND_KEY = 'ds_auto_close_after_send';
  const CLOSE_AFTER_SEND_TS_KEY = 'ds_auto_close_after_send_ts';
  const SCAN_MS    = 300;
  const TIMEOUT_MS = 150_000;
  const CLICK_DELAY_MIN_MS = 450;
  const CLICK_DELAY_MAX_MS = 900;
  const WITHHOLD_CFG_KEY = 'dsu_auto_sender_withhold';

  const url = new URL(location.href);
  const closeAfterSend = sessionStorage.getItem(CLOSE_AFTER_SEND_KEY) === '1';
  const closeAfterSendTs = Number(sessionStorage.getItem(CLOSE_AFTER_SEND_TS_KEY) || '0');
  const closeFlagFresh = Number.isFinite(closeAfterSendTs) && closeAfterSendTs > 0 && (Date.now() - closeAfterSendTs) < 60_000;
  if (closeAfterSend && closeFlagFresh) {
    sessionStorage.removeItem(CLOSE_AFTER_SEND_KEY);
    sessionStorage.removeItem(CLOSE_AFTER_SEND_TS_KEY);
    try { window.close(); } catch {}
    setTimeout(() => {
      try {
        if (!window.closed) {
          location.replace('about:blank');
          window.close();
        }
      } catch {}
    }, 120);
    return;
  }

  const hasParam  = url.searchParams.get(PARAM_KEY) === PARAM_VAL;
  const autoToken = (url.searchParams.get(TOKEN_KEY) || '').trim();
  const tokenFromSession = (sessionStorage.getItem(TOKEN_SESSION_KEY) || '').trim();
  const bySession = sessionStorage.getItem('ds_auto_flow') === '1';
  const cameByRef = !!(document.referrer && /:\/\/(?:www\.)?ds-ultimate\.de\//i.test(document.referrer));
  const isAutoFlow = cameByRef || hasParam || !!autoToken || (bySession && !!tokenFromSession);

  if (!isAutoFlow) {
    return;
  }
  sessionStorage.setItem('ds_auto_flow', '1');
  if (autoToken) sessionStorage.setItem(TOKEN_SESSION_KEY, autoToken);

  const onceKey = 'ds_auto_sent_' + url.pathname + '?' + url.search;
  if (sessionStorage.getItem(onceKey) === '1') return;

  // clean legacy auto=1 from URL to avoid backend method/routing edge cases
  if (hasParam) {
    url.searchParams.delete(PARAM_KEY);
    history.replaceState(null, '', url);
  }

  function prepareFormForAuto(btn) {
    if (!isAutoFlow) return;
    const form = btn.closest('form') || btn.form;
    if (!form) return;

    if (!form.querySelector(`input[name="${PARAM_KEY}"]`)) {
      const h = document.createElement('input');
      h.type = 'hidden';
      h.name = PARAM_KEY;
      h.value = PARAM_VAL;
      form.appendChild(h);
    }

    const token = autoToken || tokenFromSession || '';
    if (token && !form.querySelector(`input[name="${TOKEN_KEY}"]`)) {
      const t = document.createElement('input');
      t.type = 'hidden';
      t.name = TOKEN_KEY;
      t.value = token;
      form.appendChild(t);
    }
  }

  // Konfig fuer Spezialfaelle (wird via DS-Ultimate UI ueberschrieben)
  const DEFAULT_SPECIAL_LIMITS = Object.freeze({
    ram: 5,
    light: 125,
  });
  let specialLimits = { ...DEFAULT_SPECIAL_LIMITS };

  // Einheiten die 9999→alle klicken sollen
  const AUTO_ALL_UNITS = ['axe', 'catapult', 'heavy', 'sword', 'spear'];

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
      if (unit in specialLimits) {
        const reduce = specialLimits[unit];
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

      // Fall 3: Clear if value exceeds available (and not special handling)
      if (val > 0 && val > allCount && val !== 9999) {
        input.value = allCount > 0 ? String(allCount) : '';  // Set Max Amount or Clear the bad value
        allOk = false;     // Need to recheck after DOM updates
        return;
      }

      // Für alle anderen: nichts Besonderes
      unitsApplied[unit] = true;
    });

    return allOk;
  }

  // --- NEW: Decide button based on DS-Ultimate command type ---
  const GM_API = (typeof GM !== 'undefined' && GM && typeof GM.getValue === 'function') ? GM : null;
  let specialLimitsPromise = null;

  const SUPPORT_TYPES = new Set([
    'Unterstützung',
    'Stand Unterstützung',
    'Schnelle Unterstützung',
    'Fake Unterstützung',
  ]);

  // TTL damit ein alter Wert nicht “hängen bleibt”
  const COMMAND_TTL_MS = 5 * 60 * 1000;

  async function getPendingCommandType() {
    if (!GM_API) return null;
    try {
      const v = await GM_API.getValue('pending_command_type', null);
      if (!v || !v.createdAt) return null;
      if ((Date.now() - v.createdAt) > COMMAND_TTL_MS) return null;
      return (v.commandType || null);
    } catch {
      return null;
    }
  }

  let commandTypePromise = null;
  let pendingClickTimer = null;

  function pickButtonSync(commandType) {
    const attackBtn = document.querySelector('#target_attack');
    const supportBtn = document.querySelector('#target_support');

    if (!supportBtn) return attackBtn || null;

    if (commandType && SUPPORT_TYPES.has(commandType)) return supportBtn;
    return attackBtn || supportBtn || null;
  }

  async function pickButton() {
    // einmal laden (nicht bei jedem Tick)
    if (!commandTypePromise) commandTypePromise = getPendingCommandType();
    const commandType = await commandTypePromise;
    return pickButtonSync(commandType);
  }

  function toNonNegativeInt(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
  }

  async function ensureSpecialLimitsLoaded() {
    if (!GM_API) return;
    if (!specialLimitsPromise) {
      specialLimitsPromise = (async () => {
        try {
          const cfg = await GM_API.getValue(WITHHOLD_CFG_KEY, null);
          if (!cfg || typeof cfg !== 'object') return;
          specialLimits.ram = toNonNegativeInt(cfg.ram, DEFAULT_SPECIAL_LIMITS.ram);
          specialLimits.light = toNonNegativeInt(cfg.light, DEFAULT_SPECIAL_LIMITS.light);
        } catch {}
      })();
    }
    await specialLimitsPromise;
  }

  function randomClickDelay() {
    const span = Math.max(0, CLICK_DELAY_MAX_MS - CLICK_DELAY_MIN_MS);
    return CLICK_DELAY_MIN_MS + Math.floor(Math.random() * (span + 1));
  }

  function clearPendingClick() {
    if (!pendingClickTimer) return;
    clearTimeout(pendingClickTimer);
    pendingClickTimer = null;
  }

  async function delayedClick() {
    await ensureSpecialLimitsLoaded();
    if (sessionStorage.getItem(onceKey) === '1') return false;
    if (!ensureUnitsIfNeeded()) return false;

    const btn = await pickButton();
    if (!btn || btn.disabled) return false;

    prepareFormForAuto(btn);
    btn.click();
    sessionStorage.setItem(onceKey, '1');
    return true;
  }

  async function tryClick() {
    if (sessionStorage.getItem(onceKey) === '1') return true;
    await ensureSpecialLimitsLoaded();
    if (!ensureUnitsIfNeeded()) {
      clearPendingClick();
      return false;
    }

    const btn = await pickButton();
    if (!btn || btn.disabled) return false;

    if (pendingClickTimer) return false;

    pendingClickTimer = setTimeout(async () => {
      pendingClickTimer = null;
      await delayedClick();
    }, randomClickDelay());
    return false;
  }

  // async bootstrap
  (async () => {
    if (await tryClick()) return;

    const start = Date.now();
    const iv = setInterval(async () => {
      if (await tryClick()) {
        clearInterval(iv);
      } else if (Date.now() - start > TIMEOUT_MS) {
        clearPendingClick();
        clearInterval(iv);
      }
    }, SCAN_MS);

    const mo = new MutationObserver(() => { tryClick(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => {
      clearPendingClick();
      mo.disconnect();
    }, TIMEOUT_MS);
  })();

})();



