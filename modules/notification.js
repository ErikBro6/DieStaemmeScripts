// modules/notification.js
/* global Dialog, GM_info, GM */
(() => {
  'use strict';

  // idempotent
  if (window.__dsToolsNotificationLoaded) return;
  window.__dsToolsNotificationLoaded = true;

  const LOG = (...a) => console.info('[DS-Notification]', ...a);

  // Nur im echten TW-Game (game.php)
  if (!location.href.includes('game.php')) {
    LOG('skip: not game.php');
    return;
  }

  // Version ermitteln
  const SCRIPT_VERSION =
    (typeof GM_info !== 'undefined' && GM_info?.script?.version)
      ? GM_info.script.version
      : (window.DS_TOOLS_VERSION || 'unknown');

  // -----------------------------
  // >>> DEIN POPUP-INHALT <<<
  // Ändere hier was -> Digest ändert sich -> Popup erscheint wieder
  // -----------------------------
  const POPUP = {
    id: '2026-01-02-newyear',
    title: 'DS-Tools – Update',
    headline: `Frohes Neues! Neuigkeiten in v${SCRIPT_VERSION}`,
    headerNote: 'Willkommen in SpeckMichs die Stämme Tool Collection. Über dieses neue PopUp informiere ich euch regelmässig über Neuigkeiten und Änderungen an der Tool-Collection.',
    changelog: [
      'Massen Raubzug Automatisierung: Dateistruktur grundlegend überarbeitet. Oberfläche um eine Vorlage auf alle Dörfer anzuwenden hinzugefügt.',
      'Massen Raubzug Rechner: Entfernt. Jetzt nur noch ein Modul: Massen Raubzug Automatisierung.',
      'Notification: Neues Modul, über welches PopUps wie dieses hier angezeigt werden.',
    ],
    links: [
      { label: 'GitHub', href: 'https://github.com/ErikBro6/DieStaemmeScripts' },
      { label: 'Changelog', href: 'https://github.com/ErikBro6/DieStaemmeScripts/commits/master' },
      { label: "Buy Me a Coffee", href: 'https://buymeacoffee.com/emotebot'}
    ],
    footerNote: 'Dieses Popup erscheint nur einmal pro Version/Inhalt.',
  };

  // FNV-1a 32bit
  function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

const TOKEN = String(POPUP.id);               // <-- nur diese ID entscheidet
const STORE_KEY = 'dsTools.notification.lastSeenId';


  async function getSeenToken() {
    try {
      return await GM.getValue(STORE_KEY, '');
    } catch {
      return localStorage.getItem(STORE_KEY) || '';
    }
  }

  async function setSeenToken(token) {
    try {
      await GM.setValue(STORE_KEY, token);
    } catch {
      localStorage.setItem(STORE_KEY, token);
    }
  }

  function buildInnerHtml() {
    const links = POPUP.links
      .map(l => `<a href="${l.href}" target="_blank" rel="noopener noreferrer">${l.label}</a>`)
      .join(' &nbsp;|&nbsp; ');

    const items = POPUP.changelog.map(x => `<li>${x}</li>`).join('');

    return `
      <h2 style="margin:0 0 10px 0;">${POPUP.headline}</h2>
      <div style="font-size:12px; opacity:.85; margin-top:8px;">${POPUP.headerNote}</div>
      <table class="vis" style="width:100%; margin-bottom:12px;">
        <tr><th>Änderungen</th></tr>
        <tr><td><ul style="margin:6px 0 6px 18px; padding:0;">${items}</ul></td></tr>
      </table>
      <div style="margin: 0 0 10px 0;">${links}</div>
      <div style="font-size:12px; opacity:.85; margin-top:8px;">${POPUP.footerNote}</div>
      <div style="text-align:right; margin-top:12px;">
        <a href="#" class="btn" id="ds_notif_ok">OK</a>
      </div>
    `;
  }

  function observeClose(boxId, onClosed) {
    const obs = new MutationObserver(() => {
      if (!document.getElementById(boxId)) {
        obs.disconnect();
        onClosed();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function showViaDialog(onClosed) {
    if (typeof Dialog?.show !== 'function') return false;

    const name = 'ds_tools_notification';
    Dialog.show(name, buildInnerHtml());

    const boxId = `popup_box_${name}`;
    observeClose(boxId, onClosed);

    // OK-Button -> Dialog schließen
    const handler = (ev) => {
      const t = ev.target;
      if (t && t.id === 'ds_notif_ok') {
        ev.preventDefault();
        // close button exists in TW dialogs
        const closeBtn = document.querySelector(`#${boxId} .popup_box_close`);
        if (closeBtn) closeBtn.click();
        else document.getElementById(boxId)?.remove();
      }
    };
    document.addEventListener('click', handler, true);

    // cleanup wenn geschlossen
    observeClose(boxId, () => {
      document.removeEventListener('click', handler, true);
      onClosed();
    });

    return true;
  }

  function showViaPopupDiv(onClosed) {
    const id = 'ds_notification_popup';
    if (document.getElementById(id)) return;

    const wrap = document.createElement('div');
    wrap.id = id;
    wrap.className = 'popup_style';
    wrap.style.cssText = [
      'display:block',
      'position:fixed',
      'top:15%',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:99999',
      'width:560px',
      'max-width:calc(100vw - 40px)',
    ].join(';');

    wrap.innerHTML = `
      <div class="popup_menu">
        <p style="display:inline;">${POPUP.title}</p>
        <a href="#" id="ds_notification_close">Schließen</a>
      </div>
      <div class="popup_content" style="max-height:70vh; overflow:auto;">
        ${buildInnerHtml()}
      </div>
    `;

    document.body.appendChild(wrap);

    const close = (ev) => {
      ev?.preventDefault?.();
      wrap.remove();
      onClosed();
    };

    wrap.querySelector('#ds_notification_close')?.addEventListener('click', close);
    wrap.querySelector('#ds_notif_ok')?.addEventListener('click', close);
  }

  async function run() {
    const seen = await getSeenToken();
    LOG('version=', SCRIPT_VERSION, 'seenToken=', seen);

    if (seen === TOKEN) {
      LOG('skip: already seen');
      return;
    }

    const onClosed = async () => {
      await setSeenToken(TOKEN);
      LOG('marked as seen:', TOKEN);
    };

    const ok = showViaDialog(onClosed);
    if (!ok) showViaPopupDiv(onClosed);
  }

  // Debug/Reset im TM-Menü
  try {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('[DS-Tools] Update-Popup öffnen (force)', async () => {
        await setSeenToken(''); // reset
        run();
      });
      GM_registerMenuCommand('[DS-Tools] Update-Popup Reset', async () => {
        await setSeenToken('');
        LOG('reset done');
      });
    }
  } catch {}

  run();
})();
