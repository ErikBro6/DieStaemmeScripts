// ==UserScript Module==
// Runs on: game.php?screen=info_player
(function () {
  'use strict';

  const sp = new URL(location.href).searchParams;
  if (sp.get('screen') !== 'info_player') return;

  const table = document.querySelector('#villages_list');
  if (!table) return;

  // Button nur einmal anlegen
  if (document.getElementById('copy-player-coords')) return;

  const btn = document.createElement('a');
  btn.href = '#';
  btn.id = 'copy-player-coords';
  btn.className = 'btn';
  btn.textContent = 'Koordinaten kopieren';

  table.parentElement.insertBefore(btn, table);

function extractCoords() {
  const rows = table.querySelectorAll('tbody > tr');
  const out = [];

  rows.forEach(tr => {
    const cells = tr.querySelectorAll('td');
    cells.forEach(td => {
      const m = td.textContent.match(/\b\d{3}\|\d{3}\b/);
      if (m) out.push(m[0]);
    });
  });

  return out;
}


  async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  btn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    const coords = extractCoords();

    if (!coords.length) {
      UI?.ErrorMessage
        ? UI.ErrorMessage('Keine Koordinaten gefunden.')
        : alert('Keine Koordinaten gefunden.');
      return;
    }

    await copyToClipboard(coords.join('\n'));
    UI?.SuccessMessage && UI.SuccessMessage(`${coords.length} Koordinaten kopiert`);
  });

  // 🔁 Beobachtet AJAX-Nachladen der Dörfer
  const mo = new MutationObserver(() => {
    if (table.querySelector('tbody > tr')) {
      mo.disconnect();
    }
  });

  mo.observe(table.tBodies[0], { childList: true });
})();
