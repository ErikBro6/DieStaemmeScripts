(function () {
  'use strict';

  const ROOT = (window.DSTools ||= {});
  const NS = (ROOT.massScavenge ||= {});

  let cachedConfig = null;
  let villageById = null;

  function extractScavengeMassArgs(txt) {
    const marker = 'new ScavengeMassScreen';
    let idx = txt.indexOf(marker);
    if (idx === -1) return null;

    idx = txt.indexOf('(', idx);
    if (idx === -1) return null;

    let i = idx + 1;
    let depth = 1;
    let inStr = false;
    let esc = false;

    for (; i < txt.length; i++) {
      const ch = txt[i];

      if (inStr) {
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = false; continue; }
        continue;
      }

      if (ch === '"') { inStr = true; continue; }
      if (ch === '(') { depth++; continue; }
      if (ch === ')') {
        depth--;
        if (depth === 0) return txt.slice(idx + 1, i);
      }
    }

    return null;
  }

  function parseMassConfig() {
    if (cachedConfig && villageById) return cachedConfig;

    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const txt = s.textContent || '';
      if (!txt.includes('ScavengeMassScreen')) continue;

      const argsSrc = extractScavengeMassArgs(txt);
      if (!argsSrc) continue;

      try {
        const arr = JSON.parse('[' + argsSrc + ']');
        const options = arr[0];
        const unitDefs = arr[1];
        const speed = arr[2];
        const villages = arr[3];

        cachedConfig = { options, unitDefs, speed, villages };

        villageById = new Map();
        (villages || []).forEach(v => {
          if (v && v.village_id != null) villageById.set(String(v.village_id), v);
        });

        return cachedConfig;
      } catch (e) {
        console.error('[DSMassScavenger] Fehler beim Parsen von ScavengeMassScreen:', e);
      }
    }

    console.warn('[DSMassScavenger] Konnte ScavengeMassScreen-Config nicht finden.');
    return null;
  }

  NS.massConfig = {
    parseMassConfig,
    getVillageById(id) {
      return villageById?.get(String(id)) || null;
    },
  };
})();
