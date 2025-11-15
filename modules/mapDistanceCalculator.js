// ==UserScript==
// @name         Village Distance Calculator
// @namespace    https://github.com/LegendaryB/tw-userscripts
// @version      0.4
// @author       LegendaryB
// @include      https://de*.die-staemme.de/game.php*screen=map*
// @require      https://raw.githubusercontent.com/LegendaryB/tw-framework/main/dist/framework.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=die-staemme.de
// @grant        none
// ==/UserScript==

;(function (win) {
    "use strict";

    console.log("[VDC] loaded");

    // --- Guards: nur auf Map-Screen sinnvoll ---------------------------------
    if (!win.location.href.includes("screen=map")) {
        console.log("[VDC] not on map screen, abort");
        return;
    }

    // --- Message helper ------------------------------------------------------
    function getUI() {
        // In DS-Tools-Modulen ist "UI" direkt global, window.UI ist oft undefined
        if (typeof UI !== "undefined") return UI;
        if (win.UI) return win.UI;
        return null;
    }

    class Msg {
        static InfoMessage(msg) {
            const ui = getUI();
            if (!ui || typeof ui.InfoMessage !== "function") {
                console.warn("[VDC] UI.InfoMessage not available", ui);
                return;
            }
            ui.InfoMessage(msg);
        }
        static SuccessMessage(msg) {
            const ui = getUI();
            if (!ui || typeof ui.SuccessMessage !== "function") {
                console.warn("[VDC] UI.SuccessMessage not available", ui);
                return;
            }
            ui.SuccessMessage(msg);
        }
        static ErrorMessage(msg) {
            const ui = getUI();
            if (!ui || typeof ui.ErrorMessage !== "function") {
                console.warn("[VDC] UI.ErrorMessage not available", ui);
                return;
            }
            ui.ErrorMessage(msg);
        }
    }

    // --- Translation helper (unverändert, nur auf win.game_data.locale) ------
    let TClass;
    class Translator {
        static registerTranslationProvider(locale, map) {
            this.translationProviderMap.set(locale, map);
        }

        static unregisterTranslationProvider(locale) {
            this.translationProviderMap.delete(locale);
        }

        static getPropertyKeyByHandlebar(str) {
            return str.replace("{{", "").replace("}}", "");
        }
    }

    TClass = Translator;
    Translator.translationProviderMap = new Map();

    Translator.translate = key => {
        const locale = (win.game_data && win.game_data.locale) || "de_DE";
        const map = TClass.translationProviderMap.get(locale);
        return map ? map[key] : "ERROR! NO TRANSLATION!";
    };

    Translator.translateAndReplace = text => {
        let matches = text.match(/{{{?(#[a-z]+ )?[a-z]+.[a-z]*}?}}/gi);
        if (!matches) return text;

        for (const h of matches) {
            let propertyKey = TClass.getPropertyKeyByHandlebar(h);
            let value = TClass.translate(propertyKey);
            text = text.replace(h, value);
        }
        return text;
    };

    new Translator();

    // --- Storage helper (Prefix über world) -----------------------------------
    const getStoragePrefix = () => {
        const world = (win.game_data && win.game_data.world) || "default";
        return `tw-framework_${world}`;
    };

    class Storage {
        static getItem(key) {
            key = this.makeKey(key);
            return win.localStorage.getItem(key);
        }

        static setItem(key, value) {
            key = this.makeKey(key);
            win.localStorage.setItem(key, value);
        }

        static setRawItem(key, value) {
            key = this.makeKey(key);
            let json = JSON.stringify(value);
            win.localStorage.setItem(key, json);
        }

        static removeItem(key) {
            key = this.makeKey(key);
            win.localStorage.removeItem(key);
        }

        static makeKey(key) {
            return `${getStoragePrefix()}_${key}`;
        }
    }

    // --- Utils ----------------------------------------------------------------
    const upperAt = (str, idx) =>
        str.substring(0, idx) + str.charAt(idx).toUpperCase() + str.substr(idx + 1);

    const camelize = str => {
        let indexes = ((e, t) => {
            let n = [], a = -1;
            for (; (a = e.indexOf("_", a + 1)) >= 0;) n.push(a);
            return n;
        })(str);

        str = upperAt(str, 0);
        for (const i of indexes) str = upperAt(str, i + 1);
        return str.replaceAll("_", "");
    };

    // async helper
    const __awaiter = function (thisArg, _arguments, P, generator) {
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }
            function rejected(value) {
                try {
                    step(generator.throw(value));
                } catch (e) {
                    reject(e);
                }
            }
            function step(result) {
                result.done
                    ? resolve(result.value)
                    : Promise.resolve(result.value).then(fulfilled, rejected);
            }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };

    // --- Zugriff auf TWMap / mapHandler (über win) ---------------------------
    const getTW = () => {
        // Direktes TWMap wie in lineMap.js, Fallback auf win.TWMap
        if (typeof TWMap !== "undefined") return TWMap;
        if (win.TWMap) return win.TWMap;
        return null;
    };

    const getHandler = () => {
        const tw = getTW();
        return tw && tw.mapHandler ? tw.mapHandler : null;
    };

    // --- Game spezifische Helpers --------------------------------------------
    const calcTime = (fromVillage, toVillage, unitInfo) => {
        let distance = ((e, t) => {
            let n = e.xy.toString(),
                a = t.xy.toString();
            return ((x1, y1, x2, y2) => {
                let dx = x1 - x2,
                    dy = y1 - y2;
                return Math.sqrt(dx * dx + dy * dy);
            })(Number(n.slice(0, 3)), Number(n.slice(3, 6)), Number(a.slice(0, 3)), Number(a.slice(3, 6)));
        })(fromVillage, toVillage);

        return distance * unitInfo.Speed;
    };

    let active = false;
    let selectedVillages = [];

    const addSelectionIndicator = (village, imgEl) => {
        let html = `
    <div class="SelectionIndicator" id="SelectionIndicator_${village.id}"
        style="outline: 2px dashed gold; width:52px; height:37px; position: absolute; z-index: 50; left: ${imgEl.style.left}; top: ${imgEl.style.top};">
    </div>
`;
        imgEl.insertAdjacentHTML("afterend", html);
    };

    const addUnitHeader = unit => {
        const headerRow = win.document.getElementById("VillageDistanceCalculatorHeaders");
        if (!headerRow) return;
        const html = `
    <th style="text-align: center;">
        <a href="#" class="unit_link">
            <img src="https://dsde.innogamescdn.com/asset/f6f54c14/graphic/unit/unit_${unit.toLowerCase()}.png"/>
        </a>
    </th>
`;
        headerRow.insertAdjacentHTML("beforeend", html);
    };

    const addUnitCell = (unit, text) => {
        const bodyRow = win.document.getElementById("VillageDistanceCalculatorBody");
        if (!bodyRow) return;
        const html = `
    <td style="text-align: center;" data-unit="${unit}">${text}</td>
`;
        bodyRow.insertAdjacentHTML("beforeend", html);
    };

    const buildResultTable = async () => {
        const unitInfo = await __awaiter(void 0, void 0, void 0, function* () {
            let e = yield (url = "interface.php?func=get_unit_info",
                key = "unitInfo",
                __awaiter(void 0, void 0, void 0, function* () {
                    let cached = Storage.getItem(key);
                    if (cached) return JSON.parse(cached);

                    let text = yield (u => __awaiter(void 0, void 0, void 0, function* () {
                        let fullUrl = `${new URL(win.location.origin)}/${u}`;
                        let res = yield fetch(fullUrl);
                        return yield res.text();
                    }))(url);

                    let parsed = (xml => {
                        let result = {},
                            cfg = (new win.DOMParser()).parseFromString(xml, "text/xml").querySelector("config");
                        for (const child of cfg.children) {
                            let name = camelize(upperAt(child.localName, 0));
                            if (result[name] = {}, child.children.length !== 0) {
                                for (const c of child.children) {
                                    let keyName = camelize(c.localName);
                                    result[name][keyName] = Number(c.innerHTML);
                                }
                            } else {
                                result[name] = Number(child.innerHTML);
                            }
                        }
                        return result;
                    })(text);

                    Storage.setRawItem(key, parsed);
                    return parsed;
                }));

            var url, key;
            delete e.Militia;
            return e;
        });

        let fromVillage = selectedVillages[0],
            toVillage = selectedVillages[1];

        const mapWhole = win.document.getElementById("map_whole");
        if (!mapWhole) return;

        mapWhole.insertAdjacentHTML("afterend", `
    <table id="VillageDistanceCalculatorTable" class="vis"
        style="border-spacing: 0px; border-collapse: collapse; table-layout: fixed;" width="100%">
        <thead>
            <tr id="VillageDistanceCalculatorHeaders"></tr>
        </thead>
        <tbody>
            <tr id="VillageDistanceCalculatorBody"></tr>
        </tbody>
    </table>
`);

        for (const unitName in unitInfo) {
            const t = calcTime(fromVillage, toVillage, unitInfo[unitName]);
            addUnitHeader(unitName);
            addUnitCell(unitName, formatTravelTime(t));
        }
    };

    const spawnSectorOverride = (sub, sector) => {
        const handler = getHandler();
        if (!handler) return;

        // ursprüngliche Spawn-Funktion ausführen
        if (typeof handler.integratedSpawnSector === "function") {
            handler.integratedSpawnSector(sub, sector);
        } else if (typeof handler._spawnSector === "function") {
            // fallback wie andere Scripts
            handler._spawnSector(sub, sector);
        } else if (typeof handler.spawnSector === "function") {
            handler.spawnSector(sub, sector);
        }

        // Markierungen setzen
        for (const v of selectedVillages) {
            let img = win.document.getElementById(`map_village_${v.id}`);
            if (img) addSelectionIndicator(v, img);
        }
    };

    const onClickOverride = (x, y, event) => {
        const TW = getTW();
        if (!TW || !TW.villages) return false;

        (async (x, y) => {
            let village = TW.villages[1000 * x + y];
            if (!village) return;

            if (selectedVillages.length === 2) clearSelection();

            Msg.SuccessMessage(`Selected village: ${x}|${y}`);

            let idx = selectedVillages.findIndex(v => v.id == village.id);
            if (idx !== -1) {
                selectedVillages.splice(idx, 1);
            } else {
                selectedVillages.push(village);
            }

            if (typeof TW.reload === "function") {
                TW.reload();
            }

            if (selectedVillages.length === 2) {
                await buildResultTable();
            }
        })(x, y);

        return false;
    };

    const clearSelection = () => {
        selectedVillages = [];
        removeResultTable();

        const TW = getTW();
        if (TW && typeof TW.reload === "function") {
            TW.reload();
        }
    };

    const removeResultTable = () => {
        let table = win.document.getElementById("VillageDistanceCalculatorTable");
        if (table) table.remove();
    };

    const pad2 = n => (n < 10 ? `0${n}` : n);

    const formatTravelTime = timeInHours => {
        let totalSeconds = Math.round(60 * timeInHours),
            seconds = totalSeconds % 60,
            totalMinutes = Math.floor(totalSeconds / 60),
            minutes = totalMinutes % 60,
            totalHours = Math.floor(totalMinutes / 60),
            hours = totalHours % 24,
            days = Math.floor(totalHours / 24);

        if (days > 0) hours += 24 * days;

        return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
    };

    // --- Hotkey toggle (x) ---------------------------------------------------
    win.document.addEventListener("keydown", ev => {
        if (ev.isComposing || ev.key !== "x") return;

        const TW = getTW();
        const handler = getHandler();

        if (!TW || !handler) {
            console.warn("[VDC] TWMap or mapHandler not available", { TW, handler });
            return;
        }

        if (active) {
            Msg.InfoMessage("VillageDistanceCalculator inactive");
            active = false;

            // ursprüngliche Funktionen wiederherstellen
            if (handler.integratedSpawnSector) {
                handler.spawnSector = handler.integratedSpawnSector;
            }
            if (handler.integratedClickFunction) {
                handler.onClick = handler.integratedClickFunction;
            }

            clearSelection();
        } else {
            Msg.InfoMessage("VillageDistanceCalculator active");
            active = true;

            // Originalfunktionen sichern (nur einmal)
            if (!handler.integratedSpawnSector) {
                handler.integratedSpawnSector = handler.spawnSector;
            }
            if (!handler.integratedClickFunction) {
                handler.integratedClickFunction = handler.onClick;
            }

            handler.spawnSector = spawnSectorOverride;
            handler.onClick = onClickOverride;

            if (typeof TW.reload === "function") {
                TW.reload();
            }
        }
    });

})(typeof unsafeWindow !== "undefined" ? unsafeWindow : window);
