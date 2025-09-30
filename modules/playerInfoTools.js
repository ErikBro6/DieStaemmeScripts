// ==UserScript Module==
// Runs on: game.php?screen=info_player
(function () {
  'use strict';

  const sp = new URL(location.href).searchParams;
  if (sp.get('screen') !== 'info_player') return;

  const table = document.querySelector('#villages_list');
  if (!table) return;

  // Create the button
  const btn = document.createElement('a');
  btn.href = '#';
  btn.className = 'btn';
  btn.textContent = 'Koordinaten kopieren';

  // Place it right above the table
  table.parentElement.insertBefore(btn, table);

  // Extract and copy coords from the table
  function extractCoords() {
    const rows = table.querySelectorAll('tbody > tr');
    const out = [];
    rows.forEach(tr => {
      // “Koordinaten” is the 2nd column in your markup
      const td = tr.children[1];
      if (!td) return;
      const m = td.textContent.match(/\b\d{3}\|\d{3}\b/);
      if (m) out.push(m[0]);
    });
    return out;
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.style.position = 'fixed';
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch (e) {
      (window.UI && UI.ErrorMessage) ? UI.ErrorMessage('Kopieren fehlgeschlagen.') : alert('Kopieren fehlgeschlagen.');
      console.error('[playerCopyCoords]', e);
    }
  }

  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    const coords = extractCoords();
    if (!coords.length) {
      (window.UI && UI.ErrorMessage) ? UI.ErrorMessage('Keine Koordinaten gefunden.') : alert('Keine Koordinaten gefunden.');
      return;
    }
    copyToClipboard(coords.join('\n'));
  });
})();
