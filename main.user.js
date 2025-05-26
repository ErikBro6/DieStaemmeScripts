// ==UserScript==
// @name         SpeckMichs Die Stämme Tool Collection
// @namespace    https://github.com/deinname/ds-tools
// @version      1.0
// @description  Erweitert die Die Stämme Erfahrung mit einigen Tools und Skripten
// @author       SpeckMich
// @match        https://*.die-staemme.de/game.php?*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=die-staemme.de
// @updateURL    https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/main.user.js
// @downloadURL  https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/main.user.js
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const page = new URL(location.href).searchParams.get("screen") || '';

    const modules = {
        'place': 'https://github.com/ErikBro6/DieStaemmeScripts/modules/babaFarmer.js'
    };

    const moduleUrl = modules[page] || (location.pathname.includes('/public_report/') ? modules['public_report'] : null);

    if (moduleUrl) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: moduleUrl,
            onload: function(response) {
                try {
                    eval(response.responseText);
                } catch (e) {
                    console.error('Fehler beim Laden des Moduls:', e);
                }
            },
            onerror: function(err) {
                console.error('Fehler beim Laden des Moduls:', err);
            }
        });
    }
})();
