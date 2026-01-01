(function () {
  'use strict';

  const ASSETS = (window.DS_ASSETS_BASE || '').replace(/\/$/, '');
  if (!ASSETS) {
    console.error('[MassScav][FATAL] DS_ASSETS_BASE ist nicht gesetzt.');
    return;
  }

  window.DSTools ||= {};
  window.DSTools.massScavenge ||= {};

  const BASE = `${ASSETS}/modules/massScavenge`;

  // WICHTIG: Reihenfolge = Abhängigkeiten
  const FILES = [
    'constants.js',
    'settings.js',
    'massConfig.js',
    'ui.js',
    'logic.js',
    'autoRunner.js',
    'uiEvents.js',
    'boot.js',
  ];

  function loadScriptTag(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url + (url.includes('?') ? '&' : '?') + '_cb=' + Math.floor(Date.now() / 60000);
      s.async = false;
      s.onload = () => resolve(url);
      s.onerror = (e) => reject({ url, e });
      document.documentElement.appendChild(s);
    });
  }

  (async () => {
    try {
      for (const f of FILES) {
        const url = `${BASE}/${f}`;
        console.log('[MassScav][LOAD]', url);
        await loadScriptTag(url);
        console.log('[MassScav][OK]', url);
      }
      console.log('[MassScav] ALL FILES LOADED');
    } catch (err) {
      console.error('[MassScav] LOAD FAILED', err);
    }
  })();
})();
