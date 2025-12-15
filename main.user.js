// ==UserScript==
// @name         SpeckMichs Die Stämme Tool Collection
// @namespace    https://github.com/ErikBro6
// @version      3.2.12
// @description  Erweitert die Die Stämme Erfahrung mit einigen Tools und Skripten
// @author       SpeckMich
// @connect      raw.githubusercontent.com
// @connect      localhost
// @connect      cdn.jsdelivr.net
// @match        https://*.die-staemme.de/game.php?*
// @match        https://*ds-ultimate.de/tools/attackPlanner/*
// @icon         https://pbs.twimg.com/profile_images/1456997417807716357/oX-R0v9l_400x400.png
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
      place: [
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/config/assetsBase.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/ui/toggleButton.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/confirmEnhancer.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/autoSender.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/massSupporter.js",
      ],
      map: [
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/config/assetsBase.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/ui/toggleButton.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/confirmEnhancer.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/lineMap.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/tooltip.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/pickVillages.js",
      ],
      overview_villages:
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/overviewCombined.js",
      market: {
        resource_balancer:
          "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/resBalancer.js",
        default:
          "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/menu/resBalancerMenuPoint.js",
      },
      attackPlannerEdit: [
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/dsUltimateTimingSaver.js",
        "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/<commit>/modules/dsUltimateAutoSender.js",
      ],
    },
  };

  // --- Global BotGuard (top-level hard stop) -----------------------------------
  // --- Global BotGuard (top-level, cross-tab) ---------------------------------
  const DS_BotGuard = (() => {
    const D = document;

    const SELECTORS = [
      ".bot-protection-row",
      ".bot-protection-blur",
      "#content_value .captcha",
      "#welcome-page",
      "#welcome-page-footer-right .btn-confirm-yes",
    ];

    const isVisible = (el) =>
      !!el &&
      (el.offsetParent !== null || el.getBoundingClientRect().height > 0);
    const anyVisible = () => {
      for (const sel of SELECTORS) {
        const nodes = D.querySelectorAll(sel);
        for (const n of nodes) if (isVisible(n)) return true;
      }
      return false;
    };

    // cross-tab state
    const LS_KEY = "ds_tools_bot_active";
    const LS_STAMP = "ds_tools_bot_stamp";
    let bc = null;
    try {
      bc = new BroadcastChannel("ds-tools-botguard");
    } catch {}

    // initial state (prefer persisted)
    let active = false;
    try {
      active = JSON.parse(localStorage.getItem(LS_KEY) || "false");
    } catch {}
    if (!active) active = anyVisible();

    const listeners = new Set();

    function broadcast(next) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(!!next));
        localStorage.setItem(LS_STAMP, String(Date.now())); // force storage event
      } catch {}
      if (bc)
        try {
          bc.postMessage({ type: "botguard", active: !!next });
        } catch {}
    }

    function emit(next) {
      if (next === active) return;
      active = next;
      broadcast(active);
      for (const fn of listeners) {
        try {
          fn(active);
        } catch {}
      }
      if (active)
        console.warn("[DS-Tools] Bot-Schutz erkannt → alle Module pausiert.");
      else console.info("[DS-Tools] Bot-Schutz vorbei → Fortsetzen möglich.");
    }

    // Observe DOM for appearing/disappearing protection
    let t = 0;
    const mo = new MutationObserver(() => {
      const now = performance.now();
      if (now - t < 100) return; // throttled
      t = now;
      emit(anyVisible());
    });
    mo.observe(D.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // React to other tabs
    window.addEventListener("storage", (e) => {
      if (e.key === LS_KEY || e.key === LS_STAMP) {
        const val = JSON.parse(localStorage.getItem(LS_KEY) || "false");
        if (val !== active) emit(!!val);
      }
    });
    if (bc)
      bc.onmessage = (e) => {
        if (e?.data?.type === "botguard") emit(!!e.data.active);
      };

    // Optional banner
    function mountBanner() {
      if (D.getElementById("ds-botguard-banner")) return;
      const div = D.createElement("div");
      div.id = "ds-botguard-banner";
      div.style.cssText =
        "position:fixed;left:12px;bottom:12px;z-index:99999;padding:8px 10px;border-radius:10px;background:#b91c1c;color:#fff;font:12px/1.35 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25)";
      div.textContent =
        "Bot-Schutz aktiv – DS-Tools pausiert. Bitte Prüfung abschließen.";
      D.body.appendChild(div);
    }
    function unmountBanner() {
      const el = D.getElementById("ds-botguard-banner");
      if (el) el.remove();
    }
    if (active) mountBanner();

    return {
      isActive: () => active,
      onChange: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      mountBanner,
      unmountBanner,
    };
  })();

  // --- Global pause helpers for modules ---------------------------------------
  window.DSGuards = (() => {
    const timers = new Set(); // track active timers for cleanup

    function nowPlusJitter(ms, jitterRange) {
      if (!jitterRange) return ms;
      const [minJ, maxJ] = jitterRange;
      const j = Math.floor(Math.random() * (maxJ - minJ + 1)) + minJ;
      return ms + j;
    }

    function guardAction(fn) {
      if (DS_BotGuard?.isActive()) return false;
      try {
        fn();
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    }

    function gateInterval(
      fn,
      baseMs,
      { jitter = null, requireVisible = false } = {}
    ) {
      let id = null;

      const start = () => {
        if (id) return;
        const tick = () => {
          if (DS_BotGuard?.isActive()) return; // paused
          if (requireVisible && document.hidden) return; // optional niceness
          try {
            fn();
          } catch (e) {
            console.error(e);
          }
        };
        id = setInterval(tick, nowPlusJitter(baseMs, jitter));
        timers.add(id);
      };

      const stop = () => {
        if (!id) return;
        clearInterval(id);
        timers.delete(id);
        id = null;
      };

      const ensure = (active) => (active ? stop() : start());
      ensure(DS_BotGuard?.isActive());
      DS_BotGuard?.onChange(ensure);
      document.addEventListener("visibilitychange", () => {
        if (!requireVisible) return;
        if (document.hidden) stop();
        else if (!DS_BotGuard?.isActive()) start();
      });

      return stop;
    }

    function gateTimeout(fn, delayMs) {
      // schedules once; if Bot-Schutz is active when due, it silently skips
      const id = setTimeout(() => {
        timers.delete(id);
        if (DS_BotGuard?.isActive()) return;
        try {
          fn();
        } catch (e) {
          console.error(e);
        }
      }, delayMs);
      timers.add(id);
      return () => {
        clearTimeout(id);
        timers.delete(id);
      };
    }

    // When Bot-Schutz flips on: clear all pending timeouts (and intervals via onChange)
    DS_BotGuard?.onChange((active) => {
      if (!active) return;
      for (const t of Array.from(timers)) {
        clearTimeout(t);
        clearInterval(t);
        timers.delete(t);
      }
    });

    return { gateInterval, gateTimeout, guardAction };
  })();

  /** ---------------------------------------
   *  Environments & Manifest
   *  --------------------------------------*/
  const ENV_KEY = "dsToolsEnv";
  const DEFAULT_ENV = "prod";
  const MANIFEST_URLS = {
    prod: "https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/config/manifest.prod.json",
    dev: "http://localhost:8123/config/manifest.dev.json",
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
    const nowMin = Math.floor(
      Date.now() / (CONFIG.cacheBustIntervalSec * 1000)
    );
    return url + (url.includes("?") ? "&" : "?") + "_cb=" + nowMin;
  };

  function deepFreeze(o) {
    Object.freeze(o);
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v);
    }
    return o;
  }

  /** ---------------------------------------
   *  Preferences (per module id, fallback to url)
   *  --------------------------------------*/
  const PREFS_KEY = "dsToolsModulePrefsV2"; // { [id:string]: boolean } ; true = enabled, false = disabled, missing = defaultEnabled
  const USER_SETTINGS_KEY = "dsToolsUserSettings"; // freie Settings
  const LEGACY_PREFS_KEY = "dsToolsModulePrefs"; // old url-based

  async function loadUserSettings() {
    return await GM.getValue(USER_SETTINGS_KEY, {});
  }

  async function saveUserSettings(obj) {
    await GM.setValue(USER_SETTINGS_KEY, obj || {});
  }

  window.DS_USER_SETTINGS = {}; // wird nach bootstrap() gefüllt

  async function loadPrefs() {
    // migrate once from legacy URL-based => id-based (best-effort)
    const current = await GM.getValue(PREFS_KEY, null);
    if (current) return current;

    const legacy = await GM.getValue(LEGACY_PREFS_KEY, null);
    if (!legacy) return {};

    // Keep as-is until we can map URLs to IDs on the fly (at evaluation time).
    // We'll consult legacy inside isEnabledByPrefs if no id entry exists.
    return {};
  }

  async function savePrefs(p) {
    try {
      await GM.setValue(PREFS_KEY, p || {});
    } catch {}
  }

  async function isModuleEnabled(entry) {
    const prefs = await GM.getValue(PREFS_KEY, {});
    if (Object.prototype.hasOwnProperty.call(prefs, entry.id)) {
      return prefs[entry.id] === true;
    }

    const legacy = await GM.getValue(LEGACY_PREFS_KEY, {});
    if (Object.prototype.hasOwnProperty.call(legacy, entry.url)) {
      return legacy[entry.url] !== false;
    }

    return entry.defaultEnabled === true;
  }

  /** ---------------------------------------
   *  Menu injection + routing helpers
   *  --------------------------------------*/
  function getVillageIdFallback() {
    const qp = new URL(location.href).searchParams;
    const v = qp.get("village");
    if (v) return v;
    // fallback: sniff a link that contains ?village=
    const a = document.querySelector('a[href*="screen=overview_villages"]');
    if (!a) return null;
    try {
      return new URL(a.href, location.origin).searchParams.get("village");
    } catch {
      return null;
    }
  }
  function dsToolsUrl() {
    const v = getVillageIdFallback() || "";
    const u = new URL(location.origin + "/game.php");
    if (v) u.searchParams.set("village", v);
    u.searchParams.set("screen", "dstools"); // our dedicated settings “screen”
    return u.toString();
  }

  function injectTopbarLink() {
    try {
      const row = document.querySelector("#menu_row");
      if (!row || row.querySelector("td[data-ds-tools]")) return;

      const td = document.createElement("td");
      td.className = "menu-item";
      td.setAttribute("data-ds-tools", "1");
      td.innerHTML = `
      <a href="${dsToolsUrl()}">
        <span class="icon header settings"></span>
        DS-Tools
      </a>
    `;

      const children = Array.from(row.children);
      const settingsTd = children.find(
        (el) => el.matches(".menu-item") && /screen=settings/.test(el.innerHTML)
      );
      const lastSide = [...children]
        .reverse()
        .find((el) => el.matches(".menu-side"));

      if (lastSide) {
        row.insertBefore(td, lastSide); // keep loader cell on the far right
      } else if (settingsTd && settingsTd.nextSibling) {
        row.insertBefore(td, settingsTd.nextSibling);
      } else {
        row.appendChild(td);
      }
    } catch {}
  }

  function isDsToolsSettingsScreen(ctx) {
    return ctx.screen === "dstools";
  }

  // Returns: { [screen]: Array<NormalizedEntry> }
  function flattenModules(mods) {
    const out = {};
    const push = (screen, raw) => {
      const entry = normalizeModuleEntry(raw);
      if (!entry) return;
      out[screen] ||= [];
      // de-dup by id (preferred) then by url
      const exists = out[screen].some(
        (e) => e.id === entry.id || e.url === entry.url
      );
      if (!exists) out[screen].push(entry);
    };

    for (const [screen, val] of Object.entries(mods || {})) {
      if (
        typeof val === "string" ||
        (val && typeof val === "object" && !Array.isArray(val) && "url" in val)
      ) {
        push(screen, val);
        continue;
      }
      if (Array.isArray(val)) {
        val.forEach((v) => push(screen, v));
        continue;
      }
      if (val && typeof val === "object") {
        // nested map (e.g. market: { resource_balancer: ..., default: ... })
        for (const sub of Object.values(val)) {
          if (Array.isArray(sub)) sub.forEach((v) => push(screen, v));
          else push(screen, sub);
        }
      }
    }
    return out;
  }

  /** ---------------------------------------
   *  Kontext & Routing
   *  --------------------------------------*/
  function getContext() {
    const url = new URL(location.href);
    const screen = url.searchParams.get("screen") || "";
    const mode = url.searchParams.get("mode") || "";
    return { url, host: url.hostname, path: url.pathname, screen, mode };
  }

  async function resolveModuleUrls(ctx) {
    const MODULES = window.modules || {};
    const flat = flattenModules(MODULES);

    // DS-Tools Settings Screen → keine Module laden
    if (isDsToolsSettingsScreen(ctx)) return [];

    async function filterAndExtract(screen, list) {
      const normalized = toArray(list)
        .map(normalizeModuleEntry)
        .filter(Boolean);
      const keep = [];
      for (const entry of normalized) {
        if (await isModuleEnabled(entry)) keep.push(entry.url);
      }
      return keep;
    }

    async function getGlobalUrls() {
      return filterAndExtract("global", MODULES.global || []);
    }

    // 1) DS-Ultimate planner edit page
    if (
      ctx.host.endsWith("ds-ultimate.de") &&
      /^\/tools\/attackPlanner\/\d+\/edit\/[A-Za-z0-9_-]+/.test(ctx.path)
    ) {
      return [
        ...(await filterAndExtract(
          "attackPlannerEdit",
          MODULES.attackPlannerEdit
        )),
        ...(await getGlobalUrls()),
      ];
    }

    // 2) Market
    if (ctx.screen === "market" && MODULES.market) {
      const key = ctx.mode && MODULES.market[ctx.mode] ? ctx.mode : "default";
      return [
        ...(await filterAndExtract("market", toArray(MODULES.market[key]))),
        ...(await getGlobalUrls()),
      ];
    }

    // 3) Place
    if (ctx.screen === "place") {
      const urls = toArray(MODULES.place);
      const scoped =
        ctx.mode !== "call"
          ? urls.filter((u) => {
              const s = typeof u === "string" ? u : u?.url;
              return !/\/massSupporter\.js(\?|$)/.test(s || "");
            })
          : urls;

      return [
        ...(await filterAndExtract("place", scoped)),
        ...(await getGlobalUrls()),
      ];
    }

    // 4) Main
    if (ctx.screen === "main") {
      return [
        ...(await filterAndExtract("main", MODULES.main)),
        ...(await getGlobalUrls()),
      ];
    }

    // 5) Fallback (alle anderen Screens: info_player, report, snob, overview_villages, map, etc.)
    return [
      ...(await filterAndExtract(ctx.screen, MODULES[ctx.screen])),
      ...(await getGlobalUrls()),
    ];
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
      urls = urls.filter(
        (u) =>
          isString(u) && !this._loaded.has(u) && (this._loaded.add(u), true)
      );

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
              if (DS_BotGuard.isActive()) {
                console.warn(
                  "[DS-Tools] Bot-Schutz aktiv – eval übersprungen:",
                  url
                );
                return resolve(); // skip executing this module
              }

              eval(code + "\n//# sourceURL=" + url);
            } catch (e) {
              log.error("Fehler beim Ausführen des Moduls:", url, e);
            } finally {
              resolve();
            }
          },
          onerror: (err) => {
            if (attempt < MAX_ATTEMPTS) {
              log.warn(
                `Fehler beim Laden (Versuch ${attempt}) -> Retry:`,
                url,
                err
              );
              resolve(this._fetchAndEval(url, attempt + 1));
            } else {
              log.error(
                "Fehler beim Laden des Moduls (abgebrochen):",
                url,
                err
              );
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
   *  Module metadata + IDs
   *  --------------------------------------*/

  // --- Title helpers ----------------------------------------------------------
  function fileNameFromUrl(u) {
    try {
      return (u.split("?")[0] || "").split("/").pop() || u;
    } catch {
      return u;
    }
  }
  function defaultIdFromUrl(u) {
    return fileNameFromUrl(u).replace(/\.[a-z0-9]+$/i, "");
  }
  function prettyFromId(id) {
    // drop common prefixes
    let s = id.replace(/^(dsu(?:ltimate)?|ds|tw)/i, "");
    // split camelCase and dashes/underscores
    s = s
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .trim();
    // compact multiple spaces
    s = s.replace(/\s{2,}/g, " ");
    // capitalize
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function defaultTitleFromUrl(u) {
    return prettyFromId(defaultIdFromUrl(u));
  }
  function sanitizeTitle(maybeTitle, url) {
    // If a title accidentally contains a URL/host, ignore it and derive from filename
    if (!maybeTitle || /^(?:[a-z]+:)?\/\//i.test(maybeTitle)) {
      return defaultTitleFromUrl(url);
    }
    return maybeTitle;
  }

  function normalizeModuleEntry(v) {
    if (!v) return null;

    // helper: explicit boolean with backward compat
    const normalizeDefaultEnabled = (obj) =>
      obj && Object.prototype.hasOwnProperty.call(obj, "defaultEnabled")
        ? !!obj.defaultEnabled
        : true;

    const normalizeCompliance = (obj) => {
      const raw =
        obj && obj.compliance ? String(obj.compliance).toLowerCase() : "legal";
      return raw === "illegal" ? "illegal" : "legal";
    };

    if (typeof v === "string") {
      const url = v;
      return {
        url,
        id: defaultIdFromUrl(url),
        title: defaultTitleFromUrl(url),
        desc: "",
        defaultEnabled: true,
        compliance: "legal",
      };
    }

    if (typeof v === "object" && typeof v.url === "string") {
      const url = v.url;
      const rawTitle = v.title || "";
      const title = sanitizeTitle(rawTitle, url);

      return {
        url,
        id: v.id || defaultIdFromUrl(url),
        title,
        desc: v.desc || "",
        defaultEnabled: normalizeDefaultEnabled(v),
        compliance: normalizeCompliance(v),
      };
    }

    return null;
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
    ["prod", "dev"].forEach((env) => {
      GM_registerMenuCommand(
        `[DS-Tool-Collection] Environment: ${env}${
          env === current ? " ✓" : ""
        }`,
        async () => {
          await GM.setValue(ENV_KEY, env);
          location.reload();
        }
      );
    });
  }

  function gmFetchJson(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: 15000,
        onload: (r) => {
          try {
            resolve(JSON.parse(r.responseText));
          } catch (e) {
            reject(e);
          }
        },
        onerror: reject,
        ontimeout: () => reject(new Error("timeout")),
      });
    });
  }

  function modulesFromManifest(manifest) {
    if (manifest.modules) return manifest.modules;

    if (manifest.baseUrl && manifest.routes) {
      const base = manifest.baseUrl.replace(/\/$/, "");

      const mapVal = (key, val) => {
        if (Array.isArray(val)) return val.map((v) => mapVal(key, v));
        if (val && typeof val === "object") {
          return Object.fromEntries(
            Object.entries(val).map(([k, v]) => [k, mapVal(k, v)])
          );
        }
        if (typeof val === "string") {
          // Only prefix the actual module URL field
          if (key === "url") return base + "/" + val.replace(/^\//, "");
          return val; // titles/descriptions stay untouched
        }
        return val;
      };

      return mapVal(null, manifest.routes);
    }

    throw new Error("Ungültiges Manifest");
  }

  async function bootstrap() {
    const env = await getEnv();
    registerEnvMenu(env);

    let modules = CONFIG.modules; // Fallback
    let assetsBase = "";

    try {
      const manifestUrl = MANIFEST_URLS[env];
      const manifest = await gmFetchJson(cacheBust(manifestUrl));
      modules = modulesFromManifest(manifest);
      assetsBase = manifest.assetsBase || manifest.baseUrl || "";
      log.info(`Manifest (${env}) geladen. DS_ASSETS_BASE=`, assetsBase);
    } catch (e) {
      log.warn("Manifest laden fehlgeschlagen, nutze CONFIG.modules.", e);
    }

    // Expose
    window.DS_ASSETS_BASE = assetsBase;
    window.modules = deepFreeze(modules);

    // Always add the topbar entry
    injectTopbarLink();
    window.DS_USER_SETTINGS = await loadUserSettings();

    // Route: if DS-Tools screen, render and stop
    const ctx = getContext();
    if (isDsToolsSettingsScreen(ctx)) {
      await renderSettingsPage(modules, assetsBase);
      return; // do NOT proceed to module loading
    }

    // Normal: load filtered modules
    window.loadModules = async function loadModules() {
      const moduleUrls = await resolveModuleUrls(getContext()); // await (changed)
      if (!moduleUrls.length) return;
      const loader = new ModuleLoader();
      loader.loadAll(moduleUrls);
    };

    // kick it off
    await window.loadModules();
  }

  function reloadWithCacheBust(param = "_ds_cb") {
    const u = new URL(location.href);
    // DO NOT touch the game's own `t` param
    u.searchParams.set(param, Date.now().toString());
    location.assign(u.toString());
  }

  async function renderSettingsPage(mods, assetsBase) {
    const container = document.querySelector("#content_value") || document.body;
    container.innerHTML = "";

    const flat = flattenModules(mods);
    // build id → entry map (settings only)
    window.__DS_ENTRY_BY_ID__ = {};
    for (const list of Object.values(flat)) {
      for (const entry of list) {
        window.__DS_ENTRY_BY_ID__[entry.id] = entry;
      }
    }

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <h2 class="vis" style="padding:8px 10px;margin-bottom:8px;">DS-Tools — Module verwalten</h2>
      <div class="vis" style="margin-bottom:15px;padding:10px;">
    <h3 style="margin-top:0;margin-bottom:8px;">Benutzer-Einstellungen</h3>

    <table class="vis" width="100%">
        <tr>
            <td style="width:220px;font-weight:bold;">Inc DC Webhook URL:</td>
            <td>
                <input id="ds-setting-incWebhookURL"
                       type="text"
                       class="vis input"
                       style="width:100%;"
                       value="${window.DS_USER_SETTINGS.incWebhookURL || ""}">
            </td>
        </tr>
    </table>
</div>

      <table class="vis" width="100%" id="ds-tools-table">
        <tbody id="ds-tools-rows"></tbody>
      </table>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center;">
<button class="btn" id="ds-tools-save" type="button">Speichern</button>
<button class="btn" id="ds-tools-enable-all" type="button">Alle aktivieren</button>
<button class="btn" id="ds-tools-disable-all" type="button">Alle deaktivieren</button>

        <span id="ds-tools-status" class="grey" style="margin-left:8px;"></span>
      </div>
    `;
    container.appendChild(wrap);

    const tbody = wrap.querySelector("#ds-tools-rows");

    // Build rows grouped by screen
    const prefs = await GM.getValue(PREFS_KEY, {});
    const legacy = await GM.getValue(LEGACY_PREFS_KEY, {});

    const rows = [];
    for (const screen of Object.keys(flat).sort()) {
      rows.push(
        `<tr><th colspan="3" style="text-align:left;background:#f4f4f4">${screen}</th></tr>`
      );
      for (const entry of flat[screen]) {
        const enabled = await isModuleEnabled(entry);

        const isIllegal = entry.compliance === "illegal";
        const badgeBg = isIllegal ? "#7f1d1d" : "#14532d"; // dark red / dark green
        const badgeTx = "#fff";
        const rowBg = isIllegal ? "rgba(127,29,29,.08)" : "rgba(20,83,45,.08)";

        const idAttr = "m_" + entry.id.replace(/[^a-z0-9_:-]/gi, "_");

        rows.push(`
  <tr style="background:${rowBg}">
    <td style="width:1%;white-space:nowrap;vertical-align:top;">
      <input type="checkbox" id="${idAttr}" data-id="${entry.id}" ${
          enabled ? "checked" : ""
        }>
    </td>
    <td style="vertical-align:top;">
      <label for="${idAttr}" style="font-weight:600">${entry.title}</label>
      <span style="margin-left:6px;padding:2px 6px;border-radius:999px;background:${badgeBg};color:${badgeTx};font-size:10px;vertical-align:middle;">
        ${isIllegal ? "illegal" : "legal"}
      </span>
      ${
        entry.desc
          ? `<div class="grey" style="font-size:11px;margin-top:2px">${entry.desc}</div>`
          : ""
      }
    </td>
    <td style="width:1%;white-space:nowrap;vertical-align:top;">
      <a href="#" data-toggle-url="${idAttr}" style="font-size:11px">Details</a>
      <div id="${idAttr}_url" class="hidden" style="display:none;font-size:11px;color:#888;margin-top:2px"><code>${entry.url.replace(
          /\?.*$/,
          ""
        )}</code></div>
    </td>
  </tr>
`);
      }
    }
    tbody.innerHTML = rows.join("");

    // tiny toggle for "Details"
    tbody.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-toggle-url]");
      if (!a) return;
      e.preventDefault();
      const id = a.getAttribute("data-toggle-url");
      const box = document.getElementById(id + "_url");
      if (box)
        box.style.display = box.style.display === "none" ? "block" : "none";
    });

    function collectPrefsFromUI() {
      const next = {};
      tbody
        .querySelectorAll('input[type="checkbox"][data-id]')
        .forEach((cb) => {
          const id = cb.getAttribute("data-id");
          const entry = window.__DS_ENTRY_BY_ID__[id];
          if (!entry) return;

          if (cb.checked !== entry.defaultEnabled) {
            next[id] = cb.checked;
          }
        });
      return next;
    }

    const status = wrap.querySelector("#ds-tools-status");
    wrap
      .querySelector("#ds-tools-save")
      .addEventListener("click", async (e) => {
        e.preventDefault();

        const next = collectPrefsFromUI();

        const nextUserSettings = {
          ...window.DS_USER_SETTINGS,
          incWebhookURL: document
            .getElementById("ds-setting-incWebhookURL")
            .value.trim(),
        };
        await saveUserSettings(nextUserSettings);
        window.DS_USER_SETTINGS = nextUserSettings;

        await savePrefs(next);
        status.textContent = "Gespeichert. Lade Seite neu …";

        reloadWithCacheBust();
      });

    wrap.querySelector("#ds-tools-enable-all").addEventListener("click", () => {
      tbody
        .querySelectorAll('input[type="checkbox"]')
        .forEach((cb) => (cb.checked = true));
      status.textContent = "Alle aktiviert (noch nicht gespeichert)";
    });
    wrap
      .querySelector("#ds-tools-disable-all")
      .addEventListener("click", () => {
        tbody
          .querySelectorAll('input[type="checkbox"]')
          .forEach((cb) => (cb.checked = false));
        status.textContent = "Alle deaktiviert (noch nicht gespeichert)";
      });
  }

  // Start (gated by BotGuard)
  (function startOnce() {
    // Avoid running bootstrap twice if Bot-Schutz clears quickly
    if (window.__DS_BOOTSTRAPPED__) return;

    const run = async () => {
      if (window.__DS_BOOTSTRAPPED__) return;
      window.__DS_BOOTSTRAPPED__ = true;
      await bootstrap();
    };

    if (DS_BotGuard.isActive()) {
      DS_BotGuard.mountBanner();
      // Re-arm when protection disappears
      const off = DS_BotGuard.onChange((active) => {
        if (!active) {
          off();
          DS_BotGuard.unmountBanner();
          run();
        }
      });
      // Do nothing else while active.
    } else {
      run();
    }
  })();
})();
