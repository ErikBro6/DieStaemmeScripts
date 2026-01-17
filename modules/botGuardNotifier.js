// botGuardNotifier.js
(() => {
  'use strict';

  // If the core script already installed a notifier, don't double-fire.
  if (window.__DS_BOTGUARD_NOTIFIER_INSTALLED__) return;
  window.__DS_BOTGUARD_NOTIFIER_INSTALLED__ = true;

  if (!window.DS_BotGuard) return;

  const USER_SETTINGS_KEY = 'dsToolsUserSettings';

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

  async function getWebhook() {
    try {
      const fromWindow = window.DS_USER_SETTINGS?.incWebhookURL;
      if (fromWindow && String(fromWindow).trim()) return String(fromWindow).trim();

      if (typeof GM === 'undefined' || typeof GM.getValue !== 'function') return '';
      const s = await GM.getValue(USER_SETTINGS_KEY, {});
      return s?.incWebhookURL ? String(s.incWebhookURL).trim() : '';
    } catch {
      return '';
    }
  }

  async function notify() {
    const webhook = await getWebhook();
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

  // In case the page loads with BotGuard already active
  if (window.DS_BotGuard.isActive()) notify();

})();
