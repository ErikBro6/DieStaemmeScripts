// ==UserScript==
// @name         SpeckMichs Die Stämme Tool Collection
// @namespace    https://github.com/deinname/ds-tools
// @version      1.2
// @description  Erweitert die Die Stämme Erfahrung mit einigen Tools und Skripten
// @author       SpeckMich
// @connect      raw.githubusercontent.com
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

    const useLocal = false; // auf true stellen für lokale Entwicklung
    // Webserver starten mit:   python3 -m http.server 8123

    const modules = {
        place: useLocal
            ? "http://localhost:8123/modules/babaFarmer.js"
            : "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/babaFarmer.js",        
        map: useLocal
            ? "http://localhost:8123/modules/confirmEnhancer.js"
            : "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/confirmEnhancer.js",
        market: {
            resource_balancer: useLocal
                ? "http://localhost:8123/modules/resBalancer.js"
                : "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/resBalancer.js",
        
            default: useLocal
                ? "http://localhost:8123/menu/resBalancerMenuPoint.js"
                : "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/menu/resBalancerMenuPoint.js"
        }
    };



    const urlParams = new URL(location.href).searchParams;
    const screen = urlParams.get("screen") || '';
    const mode = urlParams.get("mode") || '';

    let moduleUrl = null;

    if (screen === "market") {
        // Prüfe auf spezifische Modes
        if (modules.market[mode]) {
            moduleUrl = modules.market[mode];
        }
        // Optional: Fallback für alle anderen Market-Modes
        else if (modules.market.default) {
            moduleUrl = modules.market.default;
        }
    } else if (modules[screen]) {
        moduleUrl = modules[screen];
    }

    // Optional: public_report usw. wie gehabt
    if (!moduleUrl && location.pathname.includes('/public_report/')) {
        moduleUrl = modules['public_report'];
    }


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
