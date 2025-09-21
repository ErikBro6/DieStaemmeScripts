// modules/returnRedirector.js
(() => {
  'use strict';
  const NS = '[DS-Tools:returnRedirector]';

  // Nur auf Subdomains wie de245.die-staemme.de arbeiten
  const host = location.hostname;
  const sub = host.split('.')[0] || '';
  if (!/^de\d+$/.test(sub)) return;

  // Bereits auf der gewünschten URL? Dann nichts tun.
  // (Nur grob prüfen: gleiche path+query reicht hier.)
  function sameUrl(a, b) {
    try {
      const ua = new URL(a, location.origin);
      const ub = new URL(b, location.origin);
      return ua.pathname === ub.pathname && ua.search === ub.search;
    } catch { return false; }
  }

  // Simple Loop-Guard pro Welt
  const LOOP_KEY = `ds_return_loop_${sub}`;
  const maxTries = 3;
  const tries = Number(sessionStorage.getItem(LOOP_KEY) || '0');

  (async () => {
    try {
      const HINT_KEY = 'ds_return_hints';
      const now = Date.now();
      const TTL_MS_DEFAULT = 120_000;

      const list = (await GM.getValue(HINT_KEY, [])) || [];
      const fresh = list.filter(x => (now - (x.ts||0)) < (x.ttl||TTL_MS_DEFAULT));

      // passenden Hint für diese Welt holen
      const idx = fresh.findIndex(x => x && x.world === sub && typeof x.url === 'string');
      if (idx === -1) return;

      const hint = fresh[idx];
      const target = hint.url;

      if (!target || sameUrl(location.href, target)) {
        // konsumieren, wenn gleich; sonst einfach stehen lassen
        fresh.splice(idx, 1);
        await GM.setValue(HINT_KEY, fresh);
        return;
      }

      if (tries >= maxTries) {
        console.warn(NS, 'Maximale Redirect-Versuche erreicht. Breche ab.');
        // konsumieren, um nicht ewig zu versuchen
        fresh.splice(idx, 1);
        await GM.setValue(HINT_KEY, fresh);
        return;
      }

      // Hint konsumieren, bevor wir umleiten (um Loops zu vermeiden)
      fresh.splice(idx, 1);
      await GM.setValue(HINT_KEY, fresh);

      sessionStorage.setItem(LOOP_KEY, String(tries + 1));
      console.info(NS, 'Redirect zu gespeicherter Ziel-URL:', target);
      location.replace(target);
    } catch (e) {
      console.warn(NS, 'Fehler beim Redirect:', e);
    }
  })();
})();
