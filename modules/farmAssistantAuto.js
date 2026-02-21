// ==UserScript==
// @name         DS → AM Farm Auto Clicker
// @namespace    speckmich.amfarm
// @version      0.1.3
// @description  Auto-Klick für Farm-Assistent (A/B) mit UI + DSGuards
// @match        https://*.die-staemme.de/game.php?*&screen=am_farm*
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* -------------------- CONTEXT GATE -------------------- */
  const params = new URL(location.href).searchParams;
  if (params.get('screen') !== 'am_farm') return;

  /* -------------------- DS GUARDS -------------------- */
  const { guardAction } = window.DSGuards || {};

  if (!guardAction) {
    console.warn('[AMFarm] DSGuards fehlen – Script läuft UNGESCHÜTZT.');
  }

  /* -------------------- STATE -------------------- */
  const state = {
    enabled: JSON.parse(localStorage.getItem('amfarm_enabled')) ?? false,
    delay: parseInt(localStorage.getItem('amfarm_delay'), 10) || 300,
    reload: parseInt(localStorage.getItem('amfarm_reload'), 10) || 5000,
    button: localStorage.getItem('amfarm_button') || 'a', // a | b
    fallback: JSON.parse(localStorage.getItem('amfarm_fallback')) ?? true, // use other button if preferred cannot be clicked
  };

  let clickTimer = null;
  let reloadTimer = null;

  function saveState() {
    localStorage.setItem('amfarm_enabled', JSON.stringify(state.enabled));
    localStorage.setItem('amfarm_delay', state.delay);
    localStorage.setItem('amfarm_reload', state.reload);
    localStorage.setItem('amfarm_button', state.button);
    localStorage.setItem('amfarm_fallback', JSON.stringify(state.fallback));
  }

  /* -------------------- CORE -------------------- */
  function isClickable(btn) {
    if (!btn) return false;
    if (btn.offsetParent === null) return false;
    if (btn.classList.contains('farm_icon_disabled')) return false;
    if (btn.getAttribute('aria-disabled') === 'true') return false;
    if (getComputedStyle(btn).pointerEvents === 'none') return false;
    return true;
  }

  async function clickAll() {
    const rows = [...document.querySelectorAll('#plunder_list tr[id^="village_"]')];

    for (const row of rows) {
      if (!state.enabled) return;

      const preferredClass = state.button === 'a' ? 'farm_icon_a' : 'farm_icon_b';
      const fallbackClass = state.button === 'a' ? 'farm_icon_b' : 'farm_icon_a';
      const preferredBtn = row.querySelector(`a.${preferredClass}`);
      const fallbackBtn = row.querySelector(`a.${fallbackClass}`);

      let btnToClick = null;

      if (isClickable(preferredBtn)) {
        btnToClick = preferredBtn;
      } else if (state.fallback && isClickable(fallbackBtn)) {
        btnToClick = fallbackBtn;
      }

      if (!btnToClick) continue;

      if (guardAction) {
        guardAction(() => {
          btnToClick.click();
        });
      } else {
        btnToClick.click();
      }

      await new Promise(r => setTimeout(r, state.delay));
    }
  }

  function start() {
    if (clickTimer) return;

    state.enabled = true;
    saveState();
    updateToggle();

    // Initial run
    clickAll();

    // Click cycle
    clickTimer = setInterval(() => {
      if (!state.enabled) return;
      clickAll();
    }, state.reload);

    // Reload cycle
    reloadTimer = setInterval(() => {
      if (!state.enabled) return;

      if (guardAction) {
        guardAction(() => location.reload());
      } else {
        location.reload();
      }
    }, state.reload);
  }

  function stop() {
    state.enabled = false;
    saveState();
    updateToggle();

    clearInterval(clickTimer);
    clearInterval(reloadTimer);
    clickTimer = null;
    reloadTimer = null;
  }

  /* -------------------- UI -------------------- */
  let toggleBtn;

  function updateToggle() {
    toggleBtn.textContent = state.enabled ? 'AM Farm: ON' : 'AM Farm: OFF';
    toggleBtn.style.backgroundColor = state.enabled ? '#4CAF50' : '#f44336';
  }

  function createUI() {
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed',
      top: '130px',
      right: '20px',
      zIndex: 9999,
      background: '#f9f9f9',
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '10px',
      width: '170px',
      fontSize: '13px',
      boxShadow: '0 0 6px rgba(0,0,0,0.2)',
    });

    const title = document.createElement('div');
    title.textContent = 'Farm-Assistent';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '6px';
    box.appendChild(title);

    toggleBtn = document.createElement('button');
    Object.assign(toggleBtn.style, {
      width: '100%',
      marginBottom: '6px',
      border: 'none',
      color: '#fff',
      padding: '6px',
      cursor: 'pointer',
      fontWeight: 'bold',
    });
    toggleBtn.onclick = () => (state.enabled ? stop() : start());
    box.appendChild(toggleBtn);

    box.appendChild(label('Delay (ms)'));
    box.appendChild(numberInput(state.delay, v => {
      state.delay = v;
      saveState();
    }));

    box.appendChild(label('Reload (ms)'));
    box.appendChild(numberInput(state.reload, v => {
      state.reload = v;
      saveState();
    }));

    box.appendChild(label('Button'));
    const select = document.createElement('select');
    select.style.width = '100%';
    select.innerHTML = `
      <option value="a">A</option>
      <option value="b">B</option>
    `;
    select.value = state.button;
    select.onchange = () => {
      state.button = select.value;
      saveState();
    };
    box.appendChild(select);

    const fallbackWrap = document.createElement('label');
    Object.assign(fallbackWrap.style, {
      display: 'block',
      marginTop: '8px',
      cursor: 'pointer',
      userSelect: 'none',
    });

    const fallbackInput = document.createElement('input');
    fallbackInput.type = 'checkbox';
    fallbackInput.checked = state.fallback;
    fallbackInput.style.marginRight = '6px';
    fallbackInput.onchange = () => {
      state.fallback = fallbackInput.checked;
      saveState();
    };

    fallbackWrap.appendChild(fallbackInput);
    fallbackWrap.appendChild(document.createTextNode('Use other button if blocked'));
    box.appendChild(fallbackWrap);

    document.body.appendChild(box);
    updateToggle();
  }

  function label(text) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.marginTop = '6px';
    return el;
  }

  function numberInput(value, onChange) {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    input.style.width = '100%';
    input.onchange = () => onChange(parseInt(input.value, 10) || 0);
    return input;
  }

  /* -------------------- INIT -------------------- */
  function init() {
    if (window.__amFarmAutoInitialized) return;
    window.__amFarmAutoInitialized = true;

    createUI();
    if (state.enabled) start();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();
