// botGuardNotifier.js
(() => {
  'use strict';

  if (!window.DS_BotGuard || !window.DS_USER_SETTINGS) return;

  let lastNotify = 0;
  const COOLDOWN = 30_000; // 30s Sicherheit gegen Reload-Flapping

  function getPlayerName() {
    return (
      document.querySelector('td.menu-column-item a[href*="info_player"]')
        ?.textContent?.trim() ||
      document.querySelector('#topdisplay a[href*="info_player"]')
        ?.textContent?.trim() ||
      'Unbekannt'
    );
  }

  function getWorld() {
    return location.hostname.match(/^(.*?)\.die-staemme\.de$/)?.[1] || 'Unbekannt';
  }

  function notify() {
    const webhook = window.DS_USER_SETTINGS.incWebhookURL?.trim();
    if (!webhook) return;

    if (Date.now() - lastNotify < COOLDOWN) return;
    lastNotify = Date.now();

    fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'DS-BotGuard',
        avatar_url: 'https://i.imgur.com/4M34hi2.png',
        content:
          `🛑 **Bot-Schutz ausgelöst**\n` +
          `Spieler: **${getPlayerName()}**\n` +
          `Welt: **${getWorld()}**`
      })
    }).catch(() => {});
  }

  // 🔥 exakt ein Hook – keine Logik duplizieren
  window.DS_BotGuard.onChange((active) => {
    if (active) notify();
  });

})();
