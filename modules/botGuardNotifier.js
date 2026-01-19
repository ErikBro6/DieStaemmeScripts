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

  // ✅ Hard cap: maximal alle 30 Minuten (persistiert über Reloads)
  const HARD_CAP_MS = 30 * 60_000;
  const LAST_SENT_KEY = 'ds_botguard_last_notify_ts';

  function nowTs() {
    return Date.now();
  }

  async function getLastSentTs() {
    // Prefer GM storage (works across reloads, usually per-script)
    try {
      if (typeof GM !== 'undefined' && typeof GM.getValue === 'function') {
        const v = await GM.getValue(LAST_SENT_KEY, 0);
        return Number(v) || 0;
      }
    } catch {}

    // Fallback: localStorage
    try {
      const v = localStorage.getItem(LAST_SENT_KEY);
      return v ? Number(v) || 0 : 0;
    } catch {}

    return 0;
  }

  async function setLastSentTs(ts) {
    try {
      if (typeof GM !== 'undefined' && typeof GM.setValue === 'function') {
        await GM.setValue(LAST_SENT_KEY, ts);
        return;
      }
    } catch {}

    try {
      localStorage.setItem(LAST_SENT_KEY, String(ts));
    } catch {}
  }

  function getPlayerName() {
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

  async function notify() {
    const webhook = await getWebhook();
    if (!webhook) return;

    // ✅ Hard cap (persistiert)
    const lastSent = await getLastSentTs();
    const now = nowTs();
    if (now - lastSent < HARD_CAP_MS) return;

    // bestehender kurzer Flap-Cooldown (nur in-memory)
    if (now - lastNotify < COOLDOWN) return;
    lastNotify = now;

    // wichtig: erst timestamp setzen, damit bei Reload-Spam sofort gedeckelt ist
    await setLastSentTs(now);

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
