// ==UserScript==
// @name         SpeckMichs Die Stämme Tool Collection
// @namespace    https://github.com/deinname/ds-tools
// @version      3.0.9
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
   *  Preferences (per module id, fallback to url)
   *  --------------------------------------*/
  const PREFS_KEY = "dsToolsModulePrefsV2"; // { [id:string]: boolean } ; true/undefined = enabled, false = disabled
  const LEGACY_PREFS_KEY = "dsToolsModulePrefs"; // old url-based

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
    try { await GM.setValue(PREFS_KEY, p || {}); } catch {}
  }

  // Decide enable/disable. `entry` is a normalized module (has id/url)
  async function isEnabledByPrefsEntry(entry){
    const id = entry.id;
    const prefs = await GM.getValue(PREFS_KEY, {});
    if (Object.prototype.hasOwnProperty.call(prefs, id)) return prefs[id] !== false;

    // Fallback to legacy URL-based pref if present
    const legacy = await GM.getValue(LEGACY_PREFS_KEY, {});
    if (Object.prototype.hasOwnProperty.call(legacy, entry.url)) {
      return legacy[entry.url] !== false;
    }
    // default from entry or ON
    return entry.defaultEnabled !== false;
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
    try { return new URL(a.href, location.origin).searchParams.get("village"); }
    catch { return null; }
  }
  function dsToolsUrl() {
    const v = getVillageIdFallback() || "";
    const u = new URL(location.origin + "/game.php");
    if (v) u.searchParams.set("village", v);
    u.searchParams.set("screen", "dstools");   // our dedicated settings “screen”
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
    const settingsTd = children.find(el => el.matches(".menu-item") && /screen=settings/.test(el.innerHTML));
    const lastSide  = [...children].reverse().find(el => el.matches(".menu-side"));

    if (lastSide) {
      row.insertBefore(td, lastSide);          // keep loader cell on the far right
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
      (out[screen] ||= []);
      // de-dup by id (preferred) then by url
      const exists = out[screen].some(e => e.id === entry.id || e.url === entry.url);
      if (!exists) out[screen].push(entry);
    };

    for (const [screen, val] of Object.entries(mods || {})) {
      if (typeof val === "string" || (val && typeof val === "object" && !Array.isArray(val) && 'url' in val)) {
        push(screen, val);
        continue;
      }
      if (Array.isArray(val)) {
        val.forEach(v => push(screen, v));
        continue;
      }
      if (val && typeof val === "object") {
        // nested map (e.g. market: { resource_balancer: ..., default: ... })
        for (const sub of Object.values(val)) {
          if (Array.isArray(sub)) sub.forEach(v => push(screen, v));
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

    // DS-Tools settings page: load nothing
    if (isDsToolsSettingsScreen(ctx)) return [];

    async function filterAndExtract(screen, list){
      const normalized = (list || []).map(normalizeModuleEntry).filter(Boolean);
      const keep = [];
      for (const entry of normalized) {
        if (await isEnabledByPrefsEntry(entry)) keep.push(entry.url);
      }
      return keep;
    }

    if (ctx.host.endsWith("ds-ultimate.de") &&
        /^\/tools\/attackPlanner\/\d+\/edit\/[A-Za-z0-9_-]+/.test(ctx.path)) {
      return filterAndExtract("attackPlannerEdit", MODULES.attackPlannerEdit);
    }

    if (ctx.screen === "market" && MODULES.market) {
      const key = ctx.mode && MODULES.market[ctx.mode] ? ctx.mode : "default";
      return filterAndExtract("market", toArray(MODULES.market[key]));
    }

    if (ctx.screen === "place") {
      const urls = toArray(MODULES.place);
const scoped = (ctx.mode !== "call")
  ? urls.filter(u => {
      const s = (typeof u === "string") ? u : u?.url;
      return !/\/massSupporter\.js(\?|$)/.test(s || "");
    })
  : urls;

      return filterAndExtract("place", scoped);
    }

    if (ctx.screen === "main") {
      return filterAndExtract("main", MODULES.main);
    }

    return filterAndExtract(ctx.screen, MODULES[ctx.screen]);
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




  /** ---------------------------------------
   *  Module metadata + IDs
   *  --------------------------------------*/

  // If a manifest (or CONFIG) provides strings, we’ll wrap them into objects.
  // Normalized entry shape:
  // { url: string, id: string, title: string, desc?: string, defaultEnabled?: boolean }
  function fileNameFromUrl(u){ try{ return (u.split('?')[0]||'').split('/').pop()||u; }catch{ return u; } }
  function defaultIdFromUrl(u){ return fileNameFromUrl(u).replace(/\.[a-z]+$/i,''); }
  function defaultTitleFromUrl(u){
    const f = defaultIdFromUrl(u).replace(/[-_]/g,' ');
    return f.charAt(0).toUpperCase()+f.slice(1);
  }

  function normalizeModuleEntry(v){
    if (!v) return null;
    if (typeof v === "string") {
      const url = v;
      return { url, id: defaultIdFromUrl(url), title: defaultTitleFromUrl(url) };
    }
    if (typeof v === "object" && typeof v.url === "string") {
      const url = v.url;
      return {
        url,
        id: v.id || defaultIdFromUrl(url),
        title: v.title || defaultTitleFromUrl(url),
        desc: v.desc || "",
        defaultEnabled: v.defaultEnabled !== false // default ON
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

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <h2 class="vis" style="padding:8px 10px;margin-bottom:8px;">DS-Tools — Module verwalten</h2>
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
      rows.push(`<tr><th colspan="3" style="text-align:left;background:#f4f4f4">${screen}</th></tr>`);
      for (const entry of flat[screen]) {
        const enabled =
          (Object.prototype.hasOwnProperty.call(prefs, entry.id) ? prefs[entry.id] !== false :
            Object.prototype.hasOwnProperty.call(legacy, entry.url) ? legacy[entry.url] !== false :
              entry.defaultEnabled !== false);
        const idAttr = "m_" + entry.id.replace(/[^a-z0-9_:-]/gi,'_');
        rows.push(`
          <tr>
            <td style="width:1%;white-space:nowrap;vertical-align:top;">
              <input type="checkbox" id="${idAttr}" data-id="${entry.id}" ${enabled ? "checked":""}>
            </td>
            <td style="vertical-align:top;">
              <label for="${idAttr}" style="font-weight:600">${entry.title}</label>
              ${entry.desc ? `<div class="grey" style="font-size:11px;margin-top:2px">${entry.desc}</div>` : ""}
            </td>
            <td style="width:1%;white-space:nowrap;vertical-align:top;">
              <a href="#" data-toggle-url="${idAttr}" style="font-size:11px">Details</a>
              <div id="${idAttr}_url" class="hidden" style="display:none;font-size:11px;color:#888;margin-top:2px"><code>${entry.url.replace(/\?.*$/,'')}</code></div>
            </td>
          </tr>
        `);
      }
    }
    tbody.innerHTML = rows.join("");

    // tiny toggle for "Details"
    tbody.addEventListener("click", (e)=>{
      const a = e.target.closest('a[data-toggle-url]');
      if (!a) return;
      e.preventDefault();
      const id = a.getAttribute('data-toggle-url');
      const box = document.getElementById(id+"_url");
      if (box) box.style.display = box.style.display === "none" ? "block" : "none";
    });

    function collectPrefsFromUI() {
      const next = {};
      tbody.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
        const id = cb.getAttribute("data-id");
        if (!cb.checked) next[id] = false; // only persist disabled
      });
      return next;
    }

    const status = wrap.querySelector("#ds-tools-status");
wrap.querySelector("#ds-tools-save").addEventListener("click", async (e) => {
  e.preventDefault();
  const next = collectPrefsFromUI();
  await savePrefs(next);
  const status = wrap.querySelector("#ds-tools-status");
  if (status) status.textContent = "Gespeichert. Lade Seite neu …";
  reloadWithCacheBust(); // uses _ds_cb, preserves game's `t`
});

    wrap.querySelector("#ds-tools-enable-all").addEventListener("click", () => {
      tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
      status.textContent = "Alle aktiviert (noch nicht gespeichert)";
    });
    wrap.querySelector("#ds-tools-disable-all").addEventListener("click", () => {
      tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      status.textContent = "Alle deaktiviert (noch nicht gespeichert)";
    });
  }



  // Start
  bootstrap();
})();
