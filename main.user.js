// ==UserScript==
// @name         SpeckMichs Die Stämme Tool Collection
// @namespace    https://github.com/deinname/ds-tools
// @version      2.2
// @description  Erweitert die Die Stämme Erfahrung mit einigen Tools und Skripten
// @author       SpeckMich
// @connect      raw.githubusercontent.com
// @match        https://*.die-staemme.de/game.php?*
// @match        https://*ds-ultimate.de/tools/attackPlanner/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=die-staemme.de
// @updateURL    https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/main.user.js
// @downloadURL  https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/main.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.addValueChangeListener
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    window.modules = {
        place: [
            "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/confirmEnhancer.js"
        ],
        map: [
            "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/confirmEnhancer.js",
            "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/lineMap.js",
            "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/tooltip.js",
            "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/pickVillages.js",
        ],
        overview_villages: "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/overviewCombined.js",
        market: {
            resource_balancer: "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/resBalancer.js",
            default: "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/menu/resBalancerMenuPoint.js"
        },
        attackPlannerEdit: "https://raw.githubusercontent.com/DeinRepo/DeinScript/master/modules/numberSaver.js"
    };

    function cacheBust(url) {
        const now = Math.floor(Date.now() / 60000); // Nur alle 60 Sekunden neuer Cache-Buster
        return url + (url.includes('?') ? '&' : '?') + '_cb=' + now;
    }

    function toArray(val) {
        if (!val) return [];
        return Array.isArray(val) ? val : [val];
    }

    window.loadModules = function() {
        const url = new URL(location.href);
        const urlParams = url.searchParams;
        const host = url.hostname;
        const path = url.pathname;
        const screen = urlParams.get("screen") || '';
        const mode = urlParams.get("mode") || '';
        let moduleUrls = [];

        if (
            host.endsWith("ds-ultimate.de")
            && /^\/tools\/attackPlanner\/\d+\/edit\/[A-Za-z0-9_-]+/.test(path)
        ) {
            moduleUrls = toArray(window.modules.attackPlannerEdit);
        } else {
            // allgemeine Module anhand von "screen"
            let moduleKey = window.modules[screen];

            if (screen === "market" && window.modules.market) {
                moduleKey = window.modules.market[mode] || window.modules.market.default;
            }

            moduleUrls = toArray(moduleKey);
        }

        // Lade und führe Module aus
        if (moduleUrls.length) {
            moduleUrls.forEach((u) => {
                if (typeof u !== "string") {
                    console.warn("Unerwarteter Modultyp, wird ignoriert:", u);
                    return;
                }

                GM_xmlhttpRequest({
                    method: "GET",
                    url: cacheBust(u),
                    onload(res) {
                        try {
                            const code = res.responseText;
                            // eval statt new Function für bessere Debuggability mit SourceURL
                            eval(code + "\n//# sourceURL=" + u);
                        } catch (e) {
                            console.error("Fehler beim Ausführen des Moduls:", u, e);
                        }
                    },
                    onerror(err) {
                        console.error("Fehler beim Laden des Moduls:", u, err);
                    }
                });
            });
        }
    };
})();

// Hauptaufruf
if (typeof window.loadModules === "function") {
    window.loadModules();
}
