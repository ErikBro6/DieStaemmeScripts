(function() {
  'use strict';

  // Event-Delegation auf body, fängt auch dynamische Icons
  document.body.addEventListener('click', async e => {
    // Schau, ob ein Play- oder Redo-Icon geklickt wurde
    const icon = e.target.closest('i.fa-play-circle, i.fa-redo');
    if (!icon) return;

    // Finde die <tr> und ihre ID
    const row = icon.closest('tr');
    if (!row?.id) return;
    const id = row.id;

    // Hole dir den Wert (Promise aufgelöst)
    try {
      const arrival = await GM.getValue(`arrival_${id}`, null);
      console.log(`Ankunftszeit für ID ${id}:`, arrival);
    } catch (err) {
      console.error('Fehler beim Auslesen der Ankunftszeit:', err);
    }
  });

})();

(async function onPageLoad() {
  // ggf. Warte auf vollständiges Parsen
  if (document.readyState !== 'complete') {
    await new Promise(r => window.addEventListener('load', r));
  }
  // Selektiere die aktuelle Zeile (z.B. .selected)
  const row = document.querySelector('tr.selected');
  if (!row?.id) return;
  const id = row.id;
  const arrival = await GM.getValue(`arrival_${id}`, null);
  console.log(`babaFarmer (onload) – ID ${id}:`, arrival);
})();
