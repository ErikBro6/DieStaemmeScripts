(function() {
  'use strict';

  document.body.addEventListener('click', async e => {
    // Finde das nächste <a>, nicht nur das <i>
    const a = e.target.closest('a[target="_blank"]');
    if (!a) return;

    // Hat dieses <a> eins unserer Icons drin?
    const icon = a.querySelector('i.fa-play-circle, i.fa-redo');
    if (!icon) return;

    // Verhindere kurz das Standard-Öffnen, damit wir die Konsole im selben Tab sehen
    e.preventDefault();
    e.stopImmediatePropagation();

    // Finde die Zeile und deren ID
    const row = a.closest('tr');
    if (!row?.id) {
      console.warn("Keine row.id gefunden");
      return;
    }
    const id = row.id;

    // Hole und logge den gespeicherten Wert
    try {
      const arrival = await GM.getValue(`arrival_${id}`, null);
      console.log(`Ankunftszeit für ID ${id}:`, arrival);
    } catch (err) {
      console.error('Fehler beim Auslesen der Ankunftszeit:', err);
    }
    // ... innerhalb deines click-Handlers, kurz vor window.open()
    // 1) Arrival-Element finden (hier: <abbr data-ts="…">)
    const abbr = row.querySelector('abbr[data-ts]');
    if (abbr) {
    const ts = parseInt(abbr.getAttribute('data-ts'), 10) * 1000;  // ms
    await GM.setValue(`arrival_${id}`, ts);
    console.log(`→ Arrival für ${id} gespeichert:`, new Date(ts).toLocaleString());
    }

    // Und erst jetzt das Link-Ziel aufmachen
    window.open(a.href, "_blank");
  });

})();
