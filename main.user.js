// ==UserScript==
// @name         SpeckMichs Die Stämme Tool Collection
// @namespace    https://github.com/deinname/ds-tools
// @version      3.0.1
// @description  Erweitert die Die Stämme Erfahrung mit einigen Tools und Skripten
// @author       SpeckMich
// @connect      raw.githubusercontent.com
// @connect      localhost
// @connect      cdn.jsdelivr.net
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
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(() => {
  "use strict";

  /** ---------------------------------------
   *  Basis-Konfiguration (Fallback)
   *  --------------------------------------*/
  const CONFIG = {
    cacheBustIntervalSec: 60,
    modules: {
            "place": [
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/config/assetsBase.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/ui/toggleButton.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/confirmEnhancer.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/autoSender.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/massSupporter.js"
      ],
      "map": [
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/config/assetsBase.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/ui/toggleButton.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/confirmEnhancer.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/lineMap.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/tooltip.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/pickVillages.js"
      ],
      "overview_villages": "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/overviewCombined.js",
      "market": {
        "resource_balancer": "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/resBalancer.js",
        "default": "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/menu/resBalancerMenuPoint.js"
      },
      "attackPlannerEdit": [
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/dsUltimateTimingSaver.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/dsUltimateAutoSender.js"
      ]
    },
  };

  /** ---------------------------------------
   *  Environments & Manifest
   *  --------------------------------------*/
  const ENV_KEY = "dsToolsEnv";
  const DEFAULT_ENV = "prod";
  const MANIFEST_URLS = {
    prod: "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/config/manifest.prod.json",
    dev:  "http://localhost:8123/config/manifest.dev.json",
  };

  /** ---------------------------------------
   *  Utils / Logging
   *  --------------------------------------*/
  const LOG_NS = "[DS-Tools]";
  const log = {
    info: (...a) => console.info(LOG_NS, ...a),
    warn: (...a) => console.warn(LOG_NS, ...a),
    error: (...a) => console.error(LOG_NS, ...a),
  };

  const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const isString = (v) => typeof v === "string";

  const cacheBust = (url) => {
    const nowMin = Math.floor(Date.now() / (CONFIG.cacheBustIntervalSec * 1000));
    return url + (url.includes("?") ? "&" : "?") + "_cb=" + nowMin;
  };

  function deepFreeze(o){Object.freeze(o);for (const k of Object.keys(o)){const v=o[k];if(v&&typeof v==="object"&&!Object.isFrozen(v))deepFreeze(v);}return o;}

  /** ---------------------------------------
   *  Kontext & Routing
   *  --------------------------------------*/
  function getContext() {
    const url = new URL(location.href);
    const screen = url.searchParams.get("screen") || "";
    const mode = url.searchParams.get("mode") || "";
    return { url, host: url.hostname, path: url.pathname, screen, mode };
  }

  function resolveModuleUrls(ctx) {
    const MODULES = window.modules || {};

    if (ctx.host.endsWith("ds-ultimate.de") &&
        /^\/tools\/attackPlanner\/\d+\/edit\/[A-Za-z0-9_-]+/.test(ctx.path)) {
      return toArray(MODULES.attackPlannerEdit);
    }

    if (ctx.screen === "market" && MODULES.market) {
      const key = ctx.mode && MODULES.market[ctx.mode] ? ctx.mode : "default";
      return toArray(MODULES.market[key]);
    }

    if (ctx.screen === "place") {
      const urls = toArray(MODULES.place);
      if (ctx.mode !== "call") {
        return urls.filter(u => !/\/massSupporter\.js(\?|$)/.test(u));
      }
      return urls;
    }


    if (ctx.screen === "main") {
      return toArray(MODULES.main); // keep your assetsBase first if you use it
    }


    return toArray(MODULES[ctx.screen]);
  }


  /** ---------------------------------------
   *  Loader (idempotent)
   *  --------------------------------------*/
  class ModuleLoader {
    constructor() {
      this._concurrency = 4;
      this._queue = [];
      this._active = 0;
      this._loaded = new Set(); // idempotenz
    }

    loadAll(urls) {
      // nur Strings & noch nicht geladene
      urls = urls.filter(u => isString(u) && !this._loaded.has(u) && (this._loaded.add(u), true));

      return new Promise((resolve) => {
        if (!urls.length) {
          log.info("Keine (neuen) Module für diesen Kontext.");
          return resolve();
        }
        let completed = 0;
        const total = urls.length;

        const next = () => {
          if (!this._queue.length && this._active === 0) return resolve();
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
        urls.forEach((u) => this._queue.push(() => this._fetchAndEval(u)));
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

  function loadModules() {
    const ctx = getContext();
    const moduleUrls = resolveModuleUrls(ctx);
    if (!moduleUrls.length) return;
    const loader = new ModuleLoader();
    loader.loadAll(moduleUrls);
  }

  /** ---------------------------------------
   *  Manifest & Bootstrap
   *  --------------------------------------*/
  async function getEnv() {
    try {
      const qp = new URL(location.href).searchParams;
      const forced = qp.get("dstools_env");
      if (forced) {
        await GM.setValue(ENV_KEY, forced);
        return forced;
      }
      return (await GM.getValue(ENV_KEY, DEFAULT_ENV)) || DEFAULT_ENV;
    } catch {
      return DEFAULT_ENV;
    }
  }

  function registerEnvMenu(current) {
    if (typeof GM_registerMenuCommand !== "function") return;
    ["prod", "dev"].forEach(env => {
      GM_registerMenuCommand(
        `[DS-Tool-Collection] Environment: ${env}${env === current ? " ✓" : ""}`,
        async () => { await GM.setValue(ENV_KEY, env); location.reload(); }
      );
    });
  }

  function gmFetchJson(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET", url, timeout: 15000,
        onload: r => { try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(e); } },
        onerror: reject, ontimeout: () => reject(new Error("timeout"))
      });
    });
  }

  function modulesFromManifest(manifest) {
    if (manifest.modules) return manifest.modules;
    if (manifest.baseUrl && manifest.routes) {
      const base = manifest.baseUrl.replace(/\/$/, "");
      const mapVal = v => Array.isArray(v) ? v.map(mapVal)
        : (typeof v === "string"
            ? (base + "/" + v.replace(/^\//, ""))
            : (v && typeof v === "object"
                ? Object.fromEntries(Object.entries(v).map(([k, val]) => [k, mapVal(val)]))
                : v));
      return mapVal(manifest.routes);
    }
    throw new Error("Ungültiges Manifest");
  }

async function bootstrap() {
  const env = await getEnv();
  registerEnvMenu(env);

  let modules = CONFIG.modules; // Fallback
  let assetsBase = "";          // <- Standard, falls Manifest fehlt

  try {
    const manifestUrl = MANIFEST_URLS[env];
    const manifest = await gmFetchJson(cacheBust(manifestUrl));

    // 1) Modules aus Manifest übernehmen (prod: manifest.modules, dev: baseUrl+routes)
    modules = modulesFromManifest(manifest);

    // 2) Assets-Base setzen (für CSS/HTML der UI-Komponenten)
    //    Priorität: manifest.assetsBase > manifest.baseUrl > ""
    assetsBase = manifest.assetsBase || manifest.baseUrl || "";

    log.info(`Manifest (${env}) geladen. DS_ASSETS_BASE=`, assetsBase);
  } catch (e) {
    log.warn("Manifest laden fehlgeschlagen, nutze CONFIG.modules.", e);
    // optional: hier könntest du für PROD einen sinnvollen Default setzen:
    // assetsBase = "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>";
  }

  // 3) Global verfügbar machen, damit confirmEnhancer.js die UI-Dateien findet
  window.DS_ASSETS_BASE = assetsBase;

  // 4) Rest wie gehabt
  window.modules = deepFreeze(modules);
  window.loadModules = loadModules;
  loadModules();
}


  // Start
  bootstrap();
})();
