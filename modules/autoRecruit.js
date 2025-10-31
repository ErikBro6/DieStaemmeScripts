// ==UserScript==
// @name         SpeckMichs Auto Recruiter v1 (Bot-Schutz safe)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Automatisiert Masseneinheitenrekrutierung mit UI-Kontrolle (gated by DSGuards) in Die Stämme (DE)
// @author       SpeckMich
// @match        https://*.die-staemme.de/game.php?village=*&screen=train*
// @match        https://*.die-staemme.de/game.php?screen=train*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Require DSGuards from main.user.js for Bot-Schutz safety
  const { gateInterval, gateTimeout, guardAction } = window.DSGuards || {};
  if (!gateInterval || !gateTimeout || !guardAction) {
    console.warn('[AutoRecruit] DSGuards not available → aborting for safety.');
    return;
  }

  // ---- State / Settings -----------------------------------------------------
  let recruitingEnabled = JSON.parse(localStorage.getItem('recruitingEnabled') || 'true');
  let recruitDelaySeconds = parseInt(localStorage.getItem('recruitDelaySeconds'), 10);
  if (!Number.isFinite(recruitDelaySeconds) || recruitDelaySeconds < 1) recruitDelaySeconds = 5;

  let cancelRecruitLoop = null;   // canceller returned by gateInterval
  let cancelOneShotKick = null;   // canceller returned by gateTimeout
  let cancelReturnTmo = null;     // canceller for the "return" navigation

  // ---- UI -------------------------------------------------------------------
  function styleLikeAutoScavenge(btn, isOn) {
    btn.style.padding = '8px 12px';
    btn.style.fontWeight = 'bold';
    btn.style.borderRadius = '8px';
    btn.style.border = '0';
    btn.style.color = '#fff';
    btn.style.background = isOn ? '#4CAF50' : '#f44336';
    btn.style.boxShadow = '0 2px 10px rgba(0,0,0,.2)';
    btn.style.cursor = 'pointer';
  }

  function createControlPanel() {
    if (document.getElementById('dsu-auto-recruit')) return;

    const container = document.createElement('div');
    container.id = 'dsu-auto-recruit';
    container.style.position = 'fixed';
    container.style.top = '120px';
    container.style.right = '20px';
    container.style.zIndex = 9999;
    container.style.backgroundColor = '#f9f9f9';
    container.style.padding = '10px';
    container.style.border = '1px solid #ccc';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 0 5px rgba(0,0,0,0.2)';
    container.style.fontSize = '14px';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '8px';

    const toggleButton = document.createElement('button');
    toggleButton.textContent = recruitingEnabled ? 'Recruiting: ON' : 'Recruiting: OFF';
    styleLikeAutoScavenge(toggleButton, recruitingEnabled);

    toggleButton.addEventListener('click', () => {
      recruitingEnabled = !recruitingEnabled;
      localStorage.setItem('recruitingEnabled', JSON.stringify(recruitingEnabled));
      toggleButton.textContent = recruitingEnabled ? 'Recruiting: ON' : 'Recruiting: OFF';
      styleLikeAutoScavenge(toggleButton, recruitingEnabled);
      if (recruitingEnabled) startRecruiting(); else stopRecruiting();
    });

    const delayLabel = document.createElement('label');
    delayLabel.textContent = 'Delay (s): ';

    const delayInput = document.createElement('input');
    delayInput.type = 'number';
    delayInput.min = '1';
    delayInput.value = String(recruitDelaySeconds);
    delayInput.style.width = '56px';

    delayInput.addEventListener('change', () => {
      const v = parseInt(delayInput.value, 10);
      recruitDelaySeconds = Number.isFinite(v) && v >= 1 ? v : 5;
      localStorage.setItem('recruitDelaySeconds', String(recruitDelaySeconds));
      if (recruitingEnabled) {
        stopRecruiting();
        startRecruiting();
      }
    });

    container.appendChild(toggleButton);
    container.appendChild(delayLabel);
    container.appendChild(delayInput);
    document.body.appendChild(container);
  }

  // ---- Core actions (all gated) --------------------------------------------
  async function clickRecruitButtons() {
    // 1) Fill rows: click all "Truppen einfügen" buttons (staggered & guarded)
    const fillButtons = Array.from(document.querySelectorAll('input[type="button"][value="Truppen einfügen"]'));
    if (fillButtons.length) {
      for (let i = 0; i < fillButtons.length; i++) {
        const btn = fillButtons[i];
        guardAction(() => btn?.click());
        // gentle stagger to avoid burst traffic
        await new Promise(r => gateTimeout(r, 120));
      }
    }

    // 2) Small wait to allow DOM to update (still gated)
    await new Promise(r => gateTimeout(r, 500));

    // 3) Click all "Rekrutieren" submit buttons (staggered & guarded)
    const recruitButtons = Array.from(document.querySelectorAll('input[type="submit"][value="Rekrutieren"]'));
    if (recruitButtons.length) {
      for (let i = 0; i < recruitButtons.length; i++) {
        const btn = recruitButtons[i];
        guardAction(() => btn?.click());
        await new Promise(r => gateTimeout(r, 140));
      }
      // Done
      console.log('[AutoRecruit] ✅ Rekrutierung ausgeführt.');
    } else if (!fillButtons.length) {
      console.log('[AutoRecruit] ⚠️ Keine Rekrutierungsfelder gefunden.');
    }
  }

  function startRecruiting() {
    if (cancelRecruitLoop) return;

    // One immediate (but gated) kick so it starts without waiting a full interval
    cancelOneShotKick = gateTimeout(() => {
      if (recruitingEnabled) clickRecruitButtons();
    }, 300);

    // Main loop—completely Bot-Schutz–aware
    cancelRecruitLoop = gateInterval(() => {
      if (recruitingEnabled) clickRecruitButtons();
    }, recruitDelaySeconds * 1000, {
      jitter: [250, 750],       // small jitter to de-sync across tabs
      requireVisible: false     // keep running even if tab is background; DSGuards still pauses on Bot-Schutz
    });

    // Also schedule a safe return (below)
    scheduleReturnToMass();
    console.log('[AutoRecruit] 🔁 Recruiting gestartet.');
  }

  function stopRecruiting() {
    if (typeof cancelRecruitLoop === 'function') cancelRecruitLoop();
    cancelRecruitLoop = null;

    if (typeof cancelOneShotKick === 'function') cancelOneShotKick();
    cancelOneShotKick = null;

    if (typeof cancelReturnTmo === 'function') cancelReturnTmo();
    cancelReturnTmo = null;

    console.log('[AutoRecruit] ⛔ Recruiting gestoppt.');
  }

  // After acting on a subpage, try to navigate back to the “mass” page (gated)
  function scheduleReturnToMass() {
    if (typeof cancelReturnTmo === 'function') cancelReturnTmo();

    const stored = parseInt(localStorage.getItem('recruitDelaySeconds'), 10);
    const fallbackMs = (Number.isFinite(stored) ? stored : 5) * 1000;

    cancelReturnTmo = gateTimeout(() => {
      const backLink =
        document.querySelector('a[href*="screen=train"][href*="mode=mass"][href*="page=0"]') ||
        document.querySelector('a[href*="screen=train"][href*="mode=mass"]') ||
        document.querySelector('a[href*="screen=train"]');

      if (backLink) {
        guardAction(() => location.assign(backLink.href));
      } else {
        // try again briefly; still gated so it auto-pauses on Bot-Schutz
        scheduleReturnToMass();
      }
    }, fallbackMs);
  }

  // ---- Boot -----------------------------------------------------------------
  function boot() {
    createControlPanel();
    if (recruitingEnabled) startRecruiting();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot();
  } else {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  }

})();
