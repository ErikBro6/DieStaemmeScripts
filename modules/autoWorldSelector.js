// modules/autoWorldSelector.js
(() => {
  "use strict";

  const logNs = "[DS-Tools:autoWorldSelector]";
  const q = new URL(location.href).searchParams;

  // Nur im Auto-Flow aktiv werden
  if (q.get("auto") !== "1") {
    // still bleiben – manuell nichts tun
    return;
  }

  // Zielwelt ermitteln (z.B. "de245" oder "245")
  const raw = (q.get("autoworld") || "").trim().toLowerCase();
  if (!raw) {
    console.warn(logNs, "autoworld fehlt – kein Auto-Click.");
    return;
  }
  const want = raw.startsWith("de") ? raw : ("de" + raw.replace(/\D+/g, ""));
  if (!/^de\d+$/.test(want)) {
    console.warn(logNs, "autoworld ungültig:", raw);
    return;
  }

  // Container & Weltlinks suchen
  const container = document.querySelector(".worlds-container");
  if (!container) {
    console.warn(logNs, "worlds-container nicht gefunden.");
    return;
  }

  const links = Array.from(container.querySelectorAll("a.world-select[href]"));
  if (!links.length) {
    console.warn(logNs, "Keine world-select Links gefunden.");
    return;
  }

  // Im href steht typischerweise /page/play/de245
  const matchLink = links.find(a => {
    try {
      const href = new URL(a.getAttribute("href"), location.origin).pathname.toLowerCase();
      // Match exakt oder Zahlenteil
      return href.includes("/page/play/" + want)
          || href.match(/\/page\/play\/de(\d+)/)?.[1] === want.replace(/^de/, "");
    } catch {
      return false;
    }
  });

  if (!matchLink) {
    console.warn(logNs, `Keine passende Welt gefunden für ${want}.`);
    return;
  }

  // Leichten Delay, damit eventuelle DOM-Reflows/Tracking fertig sind
  setTimeout(() => {
    console.info(logNs, "Klicke Welt:", matchLink.href);
    // visuelles Feedback
    const btn = matchLink.querySelector("span.world_button_active") || matchLink;
    btn.style.outline = "2px solid limegreen";

    // echter Klick
    matchLink.click();
  }, 200);
})();
