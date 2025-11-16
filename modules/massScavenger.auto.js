// ==UserScript==
// @name         DS → Hinweis Massenraubzug Auto
// @version      1.0
// @description  Warnhinweis über dem Massenraubzug-Widget einblenden
// @match        https://*.die-staemme.de/game.php?*screen=place&mode=scavenge_mass*
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const widget = document.querySelector('.scavenge-screen-main-widget');
  if (!widget) return;

  const box = document.createElement('div');
  box.textContent = 'Achtung! Automatik für Massenraubzug noch nicht funktional!';
  box.style.marginBottom = '8px';
  box.style.padding = '6px 8px';
  box.style.border = '1px solid #a00';
  box.style.background = '#300';
  box.style.color = '#fff';
  box.style.fontWeight = 'bold';
  box.style.textAlign = 'center';

  widget.parentNode.insertBefore(box, widget);
})();
