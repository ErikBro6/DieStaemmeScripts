// botGuardNotifier.js
(() => {
  'use strict';

  // If the core script already installed a notifier, don't double-fire.
  if (window.__DS_BOTGUARD_NOTIFIER_INSTALLED__) return;
  window.__DS_BOTGUARD_NOTIFIER_INSTALLED__ = true;

  if (!window.DS_BotGuard) return;

  const USER_SETTINGS_KEY = 'dsToolsUserSettings';

  // ✅ One-shot: genau 1 Nachricht pro Page-Load
  let sentThisSession = false;

  function getPlayerName() {
    // game_data ist in DS meist vorhanden; fallback auf DOM
    try {
      if (window.game_data?.player?.name) return String(window.game_data.player.name);
    } catch {}

    const el =
      document.querySelector('td.menu-column-item a[href*="screen=info_player"]') ||
      document.querySelector('#topdisplay a[href*="info_player"]');
    return el ? el.textContent.trim() : 'Unbekannt';
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

  async function notifyOnce() {
    // ✅ Hard stop after first send attempt in this session
    if (sentThisSession) return;
    sentThisSession = true;

    const webhook = await getWebhook();
    if (!webhook) return;

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
  // Optional: wenn onChange ein unsubscribe zurückgibt, nutzen wir das.
  const unsub = window.DS_BotGuard.onChange((active) => {
    if (!active) return;
    notifyOnce();
    if (typeof unsub === 'function') unsub(); // sauber "abschalten" falls unterstützt
  });

  // In case the page loads with BotGuard already active
  if (window.DS_BotGuard.isActive()) notifyOnce();
})();
