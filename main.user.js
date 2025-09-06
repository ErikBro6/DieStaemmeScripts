// ==UserScript==
// @name         SpeckMichs Die Stämme Tool Collection
// @namespace    https://github.com/deinname/ds-tools
// @version      2.8.0
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
// @grant        GM_openInTab
// @run-at       document-end
// ==/UserScript==

(() => {
  "use strict";

  /** ---------------------------------------
   *  Konfiguration
   *  --------------------------------------*/
  const CONFIG = {
    cacheBustIntervalSec: 60,
    modules: {
      place: [
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/confirmEnhancer.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/autoSender.js",
      ],
      map: [
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/confirmEnhancer.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/lineMap.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/tooltip.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/pickVillages.js",
      ],
      overview_villages:
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/overviewCombined.js",
      market: {
        resource_balancer:
          "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/resBalancer.js",
        default:
          "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/menu/resBalancerMenuPoint.js",
      },
      attackPlannerEdit: [
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/dsUltimateTimingSaver.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/modules/dsUltimateAutoSender.js",
      ],
    },
  };

  /** ---------------------------------------
   *  Utilities
   *  --------------------------------------*/
  const LOG_NS = "[DS-Tools]";

  const log = {
    info: (...a) => console.info(LOG_NS, ...a),
    warn: (...a) => console.warn(LOG_NS, ...a),
    error: (...a) => console.error(LOG_NS, ...a),
  };

  const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  const cacheBust = (url) => {
    const nowMin = Math.floor(Date.now() / (CONFIG.cacheBustIntervalSec * 1000));
    return url + (url.includes("?") ? "&" : "?") + "_cb=" + nowMin;
  };

  const isString = (v) => typeof v === "string";

  /** ---------------------------------------
   *  Kontext & Routing
   *  --------------------------------------*/
  function getContext() {
    const url = new URL(location.href);
    const screen = url.searchParams.get("screen") || "";
    const mode = url.searchParams.get("mode") || "";
    return {
      url,
      host: url.hostname,
      path: url.pathname,
      screen,
      mode,
    };
  }

  /**
   * Routing-Regeln:
   * - 1) Externe DS-Ultimate-Edit-URL
   * - 2) Ingame per screen (+ Sonderfall market:mode)
   */
  function resolveModuleUrls(ctx) {
    // Regel 1: ds-ultimate attackPlanner Edit
    if (
      ctx.host.endsWith("ds-ultimate.de") &&
      /^\/tools\/attackPlanner\/\d+\/edit\/[A-Za-z0-9_-]+/.test(ctx.path)
    ) {
      return toArray(CONFIG.modules.attackPlannerEdit);
    }

    // Regel 2: Ingame Routing anhand von "screen" (+ Sonderfall market)
    if (ctx.screen === "market" && CONFIG.modules.market) {
      const key = ctx.mode && CONFIG.modules.market[ctx.mode] ? ctx.mode : "default";
      return toArray(CONFIG.modules.market[key]);
    }

    const direct = CONFIG.modules[ctx.screen];
    return toArray(direct);
  }

  /** ---------------------------------------
   *  Loader
   *  --------------------------------------*/
  class ModuleLoader {
    constructor() {
      this._concurrency = 4; // leicht drosseln, vermeidet Rate-/Netzprobleme
      this._queue = [];
      this._active = 0;
    }

    loadAll(urls) {
      return new Promise((resolve) => {
        if (!urls.length) {
          log.info("Keine Module für diesen Kontext.");
          return resolve();
        }
        let completed = 0;
        const total = urls.length;

        const next = () => {
          if (!this._queue.length && this._active === 0) {
            resolve();
            return;
          }
          while (this._active < this._concurrency && this._queue.length) {
            const job = this._queue.shift();
            this._active++;
            job().finally(() => {
              this._active--;
              completed++;
              log.info(`Module geladen/versucht: ${completed}/${total}`);
              next();
            });
          }
        };

        // Jobs anlegen
        urls.forEach((u) => {
          if (!isString(u)) {
            this._queue.push(async () => {
              log.warn("Unerwarteter Modultyp, ignoriert:", u);
            });
            return;
          }
          this._queue.push(() => this._fetchAndEval(u));
        });

        next();
      });
    }

    _fetchAndEval(url, attempt = 1) {
      const MAX_ATTEMPTS = 2;
      const urlWithCb = cacheBust(url);

      return new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: urlWithCb,
          timeout: 15000,
          onload: (res) => {
            try {
              const code = res.responseText;
              // eval für maximale Kompatibilität mit existierenden Modulen
              // SourceURL hilft beim Debuggen im DevTools-Stacktrace
              // eslint-disable-next-line no-eval
              eval(code + "\n//# sourceURL=" + url);
            } catch (e) {
              log.error("Fehler beim Ausführen des Moduls:", url, e);
            } finally {
              resolve();
            }
          },
          onerror: (err) => {
            if (attempt < MAX_ATTEMPTS) {
              log.warn(`Fehler beim Laden (Versuch ${attempt}) -> Retry:`, url, err);
              resolve(this._fetchAndEval(url, attempt + 1));
            } else {
              log.error("Fehler beim Laden des Moduls (abgebrochen):", url, err);
              resolve();
            }
          },
          ontimeout: () => {
            if (attempt < MAX_ATTEMPTS) {
              log.warn(`Timeout (Versuch ${attempt}) -> Retry:`, url);
              resolve(this._fetchAndEval(url, attempt + 1));
            } else {
              log.error("Timeout beim Laden des Moduls (abgebrochen):", url);
              resolve();
            }
          },
        });
      });
    }
  }

  /** ---------------------------------------
   *  Öffentliche API (minimiert)
   *  --------------------------------------*/
  function loadModules() {
    const ctx = getContext();
    const moduleUrls = resolveModuleUrls(ctx);
    if (!moduleUrls.length) return;

    const loader = new ModuleLoader();
    loader.loadAll(moduleUrls).then(() => {
      // Intentionally no-op; Module sind evaluiert.
    });
  }

  // Nur die minimal benötigte API exportieren
  // (Kompatibel mit vorhandenem Aufrufmuster)
  window.loadModules = loadModules;

  // Autostart am Dokumentende
  loadModules();
})();
