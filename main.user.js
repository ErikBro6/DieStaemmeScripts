// ==UserScript==
// @name         SpeckMichs Die Stämme Tool Collection
// @namespace    https://github.com/deinname/ds-tools
// @version      1.3
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

    window.modules = {
        place: "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/babaFarmer.js",
        map: "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/confirmEnhancer.js",
        market: {
            resource_balancer: "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/resBalancer.js",
            default: "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/menu/resBalancerMenuPoint.js"
        }
    };

    window.loadModules = function() {
        const urlParams = new URL(location.href).searchParams;
        const screen = urlParams.get("screen") || '';
        const mode = urlParams.get("mode") || '';

        let moduleUrl = null;
        if (screen === "market") {
            if (window.modules.market[mode]) {
                moduleUrl = window.modules.market[mode];
            } else if (window.modules.market.default) {
                moduleUrl = window.modules.market.default;
            }
        } else if (window.modules[screen]) {
            moduleUrl = window.modules[screen];
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
    };
})();