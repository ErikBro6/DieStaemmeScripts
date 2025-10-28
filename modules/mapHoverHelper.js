// ==UserScript==
// @name         DS → Map Popup: Spy Snippet (Resources + Grid Buildings)
// @namespace    https://github.com/ErikBro6/DieStaemmeScripts
// @version      1.4.0
// @description  Im Karten-Hover: Späh-Rohstoffe + Gebäude als DS-Icon-Gitter (statt Links/Rechts-Tabellen). Sucht den neuesten Bericht automatisch und cached ihn.
// @author       SpeckMich
// @match        https://*.die-staemme.de/game.php?*&screen=map*
// @match        https://*.die-staemme.de/game.php?*&screen=report*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      *.die-staemme.de
// ==/UserScript==

(function () {
  'use strict';
  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const ORIGIN = location.origin;
  const WORLD  = W.game_data?.world || 'world';
  const qsp    = new URLSearchParams(location.search);

  // --------------- Prefs & Cache ---------------
  const PREF_KEY = `ds_lastrep_pref_${WORLD}`;
  function loadPref(){ try{ return JSON.parse(localStorage.getItem(PREF_KEY)||'{}'); }catch{ return {}; } }
  function savePref(p){ localStorage.setItem(PREF_KEY, JSON.stringify(p)); }
  const pref = loadPref();

  function cacheKey(coord){ return `ds_last_report_${WORLD}_${coord}`; }
  function getCache(coord){ try{ return JSON.parse(localStorage.getItem(cacheKey(coord))||'null'); }catch{ return null; } }
  function setCache(coord, data){ localStorage.setItem(cacheKey(coord), JSON.stringify({...data, ts: Date.now()})); }

  function parseCoord(s){ const m=String(s||'').match(/(\d{3})\|(\d{3})/); return m?`${m[1]}|${m[2]}`:null; }

  // =====================================================================
  // A) On report pages: remember group_id + cache single report
  // =====================================================================
  if (/screen=report/.test(location.search)) {
    const gid = qsp.get('group_id');
    if (gid) { pref.group_id = gid; savePref(pref); }

    const viewId = qsp.get('view');
    if (viewId) {
      try {
        const headline = (document.querySelector('#content_value h2, #content_value h3, .report-title, .quickedit-content h2')?.textContent || document.title || '').trim();
        const coordStr = parseCoord(headline) || parseCoord(document.querySelector('#attack_info_def td, #attack_info_att td')?.textContent);
        if (coordStr) {
          const link = `${ORIGIN}/game.php?screen=report&view=${viewId}`;
          setCache(coordStr, { id: viewId, link, title: headline });
        }
      } catch {}
    }
    return;
  }

  // =====================================================================
  // B) On map: inject RESOURCES + GRID BUILDINGS into popup
  // =====================================================================
  if (!/screen=map/.test(location.search)) return;

  const inFlightSearch  = new Map();   // coord -> Promise<{id, link, title} | null>
  const inFlightPreview = new Map();   // id    -> Promise<string HTML>
  const missCooldown    = new Map();   // coord -> timestamp
  const MISS_COOLDOWN_MS = 60_000;

  function reportsListURL(){
    const gid = pref.group_id ? `&group_id=${encodeURIComponent(pref.group_id)}` : '';
    return `${ORIGIN}/game.php?screen=report&mode=all${gid}`;
  }

  function searchLatestReport(coordStr){
    const now = Date.now();
    if ((missCooldown.get(coordStr)||0) > now) return Promise.resolve(null);
    if (inFlightSearch.has(coordStr)) return inFlightSearch.get(coordStr);

    const p = new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: reportsListURL(),
        headers: { 'Accept': 'text/html' },
        withCredentials: true,
        timeout: 10000,
        onload: (res) => {
          try {
            const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
            const links = Array.from(doc.querySelectorAll('a.report-link[data-id], a[href*="screen=report"][href*="view="]'));
            const hit = links.find(a => (a.textContent||'').includes(coordStr));
            if (!hit) { resolve(null); return; }
            const id = hit.getAttribute('data-id') || (new URL(hit.getAttribute('href'), ORIGIN).searchParams.get('view'));
            const title = (hit.textContent||'').trim();
            const link  = `${ORIGIN}/game.php?screen=report&view=${id}`;
            resolve({ id, link, title });
          } catch { resolve(null); }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
      });
    }).then(r => { if (!r) missCooldown.set(coordStr, Date.now()+MISS_COOLDOWN_MS); return r; });

    inFlightSearch.set(coordStr, p);
    p.finally(()=>inFlightSearch.delete(coordStr));
    return p;
  }

  function fetchReportPreviewHTML(id){
    if (inFlightPreview.has(id)) return inFlightPreview.get(id);

    const viaTW = () => new Promise((resolve,reject)=>{
      try {
        if (W.TribalWars?.get) {
          W.TribalWars.get('report', { ajax:'view', id }, (resp)=> resolve(resp?.dialog || ''), ()=>reject());
        } else reject();
      } catch { reject(); }
    });

    const viaXHR = () => new Promise((resolve)=>{
      GM_xmlhttpRequest({
        method:'GET',
        url: `${ORIGIN}/game.php?screen=report&ajax=view&id=${encodeURIComponent(id)}`,
        headers:{ 'Accept':'application/json, text/plain, */*' },
        withCredentials:true,
        timeout:10000,
        onload:(res)=>{
          try {
            const data = JSON.parse(res.responseText);
            resolve(data?.dialog || '');
          } catch { resolve(''); }
        },
        onerror: ()=>resolve(''),
        ontimeout: ()=>resolve(''),
      });
    });

    const p = viaTW().catch(viaXHR);
    inFlightPreview.set(id, p);
    p.finally(()=>inFlightPreview.delete(id));
    return p;
  }

  // --- Build the icon grid table from attack_spy_building_data JSON ---
  const BUILD_ORDER = [
    'main','barracks','stable','garage','snob','smith','place','market',
    'wood','stone','iron','farm','storage','hide','wall'
  ];
  const BUILD_ICON = id => `https://dsde.innogamescdn.com/asset/c02e1dd8/graphic/buildings/${id}.webp`;

  function buildBuildingsGridFromJSON(jsonText) {
    if (!jsonText) return '';
    let arr; try { arr = JSON.parse(jsonText); } catch { return ''; }
    if (!Array.isArray(arr) || !arr.length) return '';

    // Map id -> level
    const lvl = Object.create(null);
    arr.forEach(({id, level}) => { if (id) lvl[id] = String(level ?? '').trim(); });

    // Compose two rows with alternating cell backgrounds like map popup
    const cellsIcons = [];
    const cellsLvls  = [];
    BUILD_ORDER.forEach((id, idx) => {
      if (!(id in lvl)) return; // only render present buildings
      const bg = (idx % 2 === 0) ? '#F8F4E8' : '#DED3B9';
      cellsIcons.push(
        `<td style="padding:2px;background-color:${bg}">
           <img src="${BUILD_ICON(id)}" class="" data-title="">
         </td>`
      );
      cellsLvls.push(
        `<td style="padding:2px;background-color:${bg}" class="center">${lvl[id] || ''}</td>`
      );
    });

    if (!cellsIcons.length) return '';
    return `
      <table style="border:1px solid #DED3B9" width="100%" cellpadding="0" cellspacing="0">
        <tbody>
          <tr class="center">${cellsIcons.join('')}</tr>
          <tr class="center">${cellsLvls.join('')}</tr>
        </tbody>
      </table>
    `;
  }

  // --- Extract our final snippet: resources table + grid buildings ---
  function extractSpySnippet(htmlString) {
    if (!htmlString) return '';
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    doc.querySelectorAll('script').forEach(s => s.remove());

    const res = doc.getElementById('attack_spy_resources');
    const resHTML = res ? res.cloneNode(true).outerHTML : '';

    // Prefer hidden JSON for buildings:
    const hidden = doc.querySelector('#attack_spy_building_data');
    const gridHTML = hidden ? buildBuildingsGridFromJSON(hidden.getAttribute('value')||'') : '';

    if (!resHTML && !gridHTML) return '';

    const style = `
      <style>
        .ds-lastrep-spy:after { content:""; display:block; clear:both; }
        .ds-lastrep-spy table { box-sizing:border-box; }
      </style>
    `;
    return style + `<div class="ds-lastrep-spy">${resHTML}${gridHTML}</div>`;
  }

  // --- Row management in popup ---
  function ensureRow(table, coordStr, innerHTML){
    let row = table.querySelector('#info_last_report_row');
    if (!row) {
      row = table.insertRow(-1);
      row.id = 'info_last_report_row';
      const tdR = row.insertCell(0);
      tdR.innerHTML = innerHTML;
    } else {
      row.cells[0].innerHTML = innerHTML;
    }
    row.dataset.coord = coordStr;
    return row;
  }

  function renderLoading(table, coordStr){
    ensureRow(table, coordStr, `<span class="small grey">Lade …</span>`);
  }
  function renderNone(table, coordStr){
    ensureRow(table, coordStr, `<span class="small grey">Keine Spähdaten gefunden</span>`);
  }
  function renderSpy(table, coordStr, snippetHTML){
    const html = `
      <div class="ds-lastrep-wrap">
        <div class="ds-lastrep-content">${snippetHTML}</div>
      </div>
    `;
    const row = ensureRow(table, coordStr, html);

    // Scale to fit popup width (baseline ≈ 518px)
    try {
      const popup = table.closest('#map_popup');
      const content = row.querySelector('.ds-lastrep-content');
      const wrap = row.querySelector('.ds-lastrep-wrap');
      if (popup && content && wrap) {
        const BASE = 518;
        const w = Math.max(150, popup.clientWidth - 20);
        const scale = Math.max(0.60, Math.min(1.0, w / BASE));
        wrap.style.overflow = 'hidden';
        wrap.style.maxWidth = `${w}px`;
        content.style.transformOrigin = 'top left';
        content.style.transform = `scale(${scale})`;
        content.style.width = `${BASE}px`;
      }
    } catch {}
  }

  function targetCoordFromTable(table){
    const th = table.querySelector('th[colspan="2"]');
    return parseCoord(th?.textContent || '');
  }

  // --- Debounced observer ---
  let debounce = null;
  function scheduleUpdate(){
    if (debounce) return;
    debounce = true;
    requestAnimationFrame(()=> setTimeout(()=>{ debounce = false; update(); }, 50));
  }

  async function update(){
    const popup = document.querySelector('#map_popup');
    if (!popup) return;
    const table = popup.querySelector('#info_content');
    if (!table) return;

    const coordStr = targetCoordFromTable(table);
    if (!coordStr) return;

    const existing = table.querySelector('#info_last_report_row');
    if (existing && existing.dataset.coord === coordStr) return;

    // 1) Cache path
    const cached = getCache(coordStr);
    if (cached?.id) {
      renderLoading(table, coordStr);
      const html = await fetchReportPreviewHTML(cached.id);
      const snippet = extractSpySnippet(html);
      if (snippet) { renderSpy(table, coordStr, snippet); return; }
    } else if (cached?.link) {
      const id = new URL(cached.link, ORIGIN).searchParams.get('view');
      if (id) {
        renderLoading(table, coordStr);
        const html = await fetchReportPreviewHTML(id);
        const snippet = extractSpySnippet(html);
        if (snippet) { setCache(coordStr, {...cached, id}); renderSpy(table, coordStr, snippet); return; }
      }
    }

    // 2) Auto search newest matching report → preview → extract
    renderLoading(table, coordStr);
    const found = await searchLatestReport(coordStr);
    if (!found?.id) { renderNone(table, coordStr); return; }

    setCache(coordStr, found);
    const preview = await fetchReportPreviewHTML(found.id);
    const snippet = extractSpySnippet(preview);
    if (snippet) renderSpy(table, coordStr, snippet);
    else renderNone(table, coordStr);
  }

  function startObserver(){
    const popup = document.querySelector('#map_popup');
    if (!popup) return false;
    const mo = new MutationObserver(() => scheduleUpdate());
    mo.observe(popup, { childList: true, subtree: true }); // attributes off to avoid loops
    update();
    return true;
  }

  const iv = setInterval(()=>{ if (startObserver()) clearInterval(iv); }, 150);

})();
