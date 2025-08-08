// ==UserScript==
// @name         SpeckMichs Die Stämme Tool Collection
// @namespace    https://github.com/deinname/ds-tools
// @version      2.0
// @description  Erweitert die Die Stämme Erfahrung mit einigen Tools und Skripten
// @author       SpeckMich
// @connect      raw.githubusercontent.com
// @match        https://*.die-staemme.de/game.php?*
// @match        https://*ds-ultimate.de/tools/attackPlanner/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=die-staemme.de
// @updateURL    https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/main.user.js
// @downloadURL  https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/main.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_xmlhttpRequest
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.addValueChangeListener
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==


(function() {
    'use strict';
    window.modules = {
        place: "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/babaFarmer.js",
        map: [
            "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/confirmEnhancer.js",
            "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/lineMap.js",
            "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/tooltip.js",
            "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/pickVillages.js",
        ],
        market: {
            resource_balancer: "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/resBalancer.js",
            default: "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/menu/resBalancerMenuPoint.js"
        },
        attackPlannerEdit: "https://raw.githubusercontent.com/DeinRepo/DeinScript/master/modules/numberSaver.js"
    };



    function cacheBust(url) {
        return url + (url.includes('?') ? '&' : '?') + '_cb=' + Date.now();
    }


    window.loadModules = function() {
        const url = new URL(location.href);
        const urlParams = new URL(location.href).searchParams;
        const host = url.hostname;
        const path = url.pathname;
        const screen = urlParams.get("screen") || '';
        const mode = urlParams.get("mode") || '';
        let moduleUrls = [];

        if (
            host.endsWith("ds-ultimate.de")
            && /^\/tools\/attackPlanner\/\d+\/edit\/[A-Za-z0-9_-]+/.test(path)
        ) {
            moduleUrls.push(window.modules.attackPlannerEdit);
        }

        let moduleUrl = null;
        switch (screen) {
            case "market":
                if (window.modules.market[mode]) {
                    moduleUrls = [window.modules.market[mode]];
                } else if (window.modules.market.default) {
                    moduleUrls = [window.modules.market.default];
                }
                break;
            case "map":
                if (Array.isArray(window.modules.map)) {
                    moduleUrls = window.modules.map;
                } else if (window.modules.map) {
                    moduleUrls = [window.modules.map];
                }
                break;
            default:
                if (window.modules[screen]) {
                    moduleUrls = [window.modules[screen]];
                }
        }


        if (moduleUrls.length > 0) {
            moduleUrls.forEach(moduleUrl => {
                GM_xmlhttpRequest({
                method: 'GET',
                url: cacheBust(moduleUrl),
                onload(response) {
                    try {
                    const code = response.responseText;
                    // Injection der GM-APIs
                    const fn = new Function(
                        'GM', 'GM_setValue', 'GM_getValue', 'GM_addValueChangeListener',
                        code
                    );
                    fn(
                        GM,
                        GM.setValue.bind(GM),
                        GM.getValue.bind(GM),
                        GM.addValueChangeListener.bind(GM)
                    );
                    } catch (e) {
                    console.error('Fehler beim Laden des Moduls:', e);
                    }
                },
                onerror(err) {
                    console.error('Fehler beim Laden des Moduls:', err);
                }
                });
            });
        }
    };
})();

if (typeof window.loadModules === "function") {
    window.loadModules();
}
