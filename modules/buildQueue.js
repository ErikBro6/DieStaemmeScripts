// modules/buildBot.js
// DS → Build Bot (integrated TKK-style)
// Loads on: screen=main
// Author: SpeckMich (integration), original concept by TiKayKhan
// Notes:
//  - Stores per-world template selection + per-template queues
//  - Optional quest automation toggle
//  - Safe anti-bot check: halts if InnoGames bot popup is present
//  - UI fits DS-Tools aesthetic (inline table + buttons)

/* global game_data, $, jQuery, UI, TWMap, GM, unsafeWindow */
(function () {
  'use strict';

  // --- Guards ----------------------------------------------------------------
  if (!/screen=main/.test(location.href)) return;

  // --- Small helpers ---------------------------------------------------------

  const GMwrap = {
    async get(key, def) {
      try { return (await GM.getValue(key)) ?? def; } catch { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? def; }
    },
    async set(key, val) {
      try { await GM.setValue(key, val); } catch { localStorage.setItem(key, JSON.stringify(val)); }
    },
    async del(key) { try { await GM.deleteValue(key); } catch { localStorage.removeItem(key); } }
  };

const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
const $doc = W.jQuery || W.$;

const ready = (selector, callback) => {
  let el = null;
  try {
    // If the selector has jQuery-only bits (e.g., :first), use jQuery.
    if (selector.includes(':')) {
      el = $doc ? $doc(selector)[0] : null;
    } else {
      el = document.querySelector(selector);
    }
  } catch {
    el = $doc ? $doc(selector)[0] : null;
  }
  if (el) callback(el);
  else setTimeout(() => ready(selector, callback), 100);
};

  // Anti-bot popup present? If yes, display timestamp and pause logic.
  function botOK(abcMode = false) {
    const $bot = $doc('div#bot_check, div#popup_box_bot_protection');
    if ($bot.length) {
      const html = `<h2 style="text-align:center;color:red;">${new Date().toString()}</h2>`;
      if ($doc('div#bot_check').length) $doc('div#bot_check').append(html);
      else $doc('div.popup_box_content').append(html);
      if (abcMode) {
        $doc('div#bot_check, div#popup_box_bot_protection').find('iframe').css({ padding: '4px 3px 2px 4px', backgroundColor: '#abc' });
        document.title = 'DSU ABC';
      }
      return false;
    }
    return true;
  }

  // --- Keys / names ----------------------------------------------------------
  const WORLD = game_data.world;
  const PLAYER_ID = game_data.player?.id;
  const VILLAGE_ID = game_data.village?.id;
  const K = (s) => `dsu.buildbot.${s}.${WORLD}`;

  // per-village: which template index is selected
  const KEY_SELECTED = (vid) => `${K('selected')}.${vid}`;
  const KEY_QUEUE_T = (tIdx) => `${K('queueTemplate')}.${tIdx}`; // stores array of codes "-" or numeric strings
  const KEY_STATE = `${K('foldState')}.${PLAYER_ID}`; // 'plus' | 'minus'
  const KEY_QUESTS = `${K('doQuests')}.${PLAYER_ID}`;

  // --- Building code book ----------------------------------------------------
  const CODES = [
    { name: 'wood', image: '3', title: 'Holzfällerlager', levels: 30 },
    { name: 'stone', image: '3', title: 'Lehmgrube', levels: 30 },
    { name: 'iron', image: '3', title: 'Eisenmine', levels: 30 },
    { name: 'farm', image: '3', title: 'Bauernhof', levels: 30 },
    { name: 'storage', image: '3', title: 'Speicher', levels: 30 },
    { name: 'main', image: '3', title: 'Hauptgebäude', levels: 30 },
    { name: 'place', image: '1', title: 'Versammlungsplatz', levels: 1 },
    { name: 'statue', image: '1', title: 'Statue', levels: 1 },
    { name: 'smith', image: '3', title: 'Schmiede', levels: 20 },
    { name: 'barracks', image: '3', title: 'Kaserne', levels: 25 },
    { name: 'stable', image: '3', title: 'Stall', levels: 20 },
    { name: 'garage', image: '3', title: 'Werkstatt', levels: 15 },
    { name: 'market', image: '3', title: 'Marktplatz', levels: 25 },
    { name: 'wall', image: '3', title: 'Wall', levels: 20 },
    { name: 'hide', image: '1', title: 'Versteck', levels: 10 },
    { name: 'snob', image: '1', title: 'Adelshof', levels: 1 },
    { name: 'church', image: '3', title: 'Kirche', levels: 3 },
    { name: 'watchtower', image: '3', title: 'Wachturm', levels: 20 }
  ];

  // --- Fallback templates ----------------------------------------------------
  // NOTE: These are taken from the TKK script. You can overwrite via Import/Save.
  // To keep this file readable, we keep them as a single object.
  const FALLBACKS = (function () {
    const f = {};
    // (You can prune these if you like. Kept for parity with original.)
    f.default = ["5","4","6","1","0","3","2","1","0","2","1","0","2","5","5","4","4","12","2","2","1","0","2","1","3","3","3","4","0","2","4","1","0","1","4","0","12","12","12","12","5","1","5","0","3","1","5","0","4","3","2","1","3","0","5","4","4","0","3","1","0","1","5","2","5","0","4","1","3","5","2","1","0","4","2","4","4","5","0","1","2","4","5","5","1","0","2","4","3","3","3","3","3","5","5","2","1","0","5","2","5","5","4","3","2","5","1","0","4","5","1","0","4","5","4","2","1","0","3","4","1","0","2","3","4","5","1","0","2","3","4","1","0","5","2","3","5","4","1","0","5","2","4","4","2","3","2","3","2","3","8","8","8","8","8","8","9","9","9","9","9","8","8","10","10","10","10","8","8","11","11","11","8","8","8","8","8","8","8","8","8","8","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-"];
    f[1] = ["5","0","1","2","3","4","5","0","1","2","3","4","5","0","1","2","3","4","5","0","1","2","3","4","5","0","1","2","3","4","9","12","12","13","5","0","1","2","4","13","12","5","0","1","2","13","4","12","5","0","1","2","4","13","12","5","0","1","2","4","5","0","1","2","4","0","1","0","1","5","4","12","0","1","2","0","1","5","4","12","2","0","1","9","9","9","9","8","8","8","8","8","10","10","10","0","1","2","5","4","12","0","1","2","0","1","2","5","4","12","0","1","2","5","4","12","1","0","2","5","4","0","1","2","5","4","0","1","2","5","4","0","1","2","5","4","0","1","2","5","4","0","1","2","0","1","2","4","0","1","2","-","-","-","-","-","-","-","-","-"];
    f[2] = ["5","0","1","2","3","4","5","0","1","2","3","4","5","0","1","2","3","4","5","0","1","2","3","4","5","0","1","2","3","4","9","12","12","13","5","0","1","2","4","13","12","5","0","1","2","13","4","12","5","0","1","2","4","13","12","5","0","1","2","4","5","0","1","2","4","0","1","0","1","5","13","4","12","0","1","2","0","1","5","4","12","2","0","1","9","9","9","9","13","8","8","8","8","8","10","10","10","0","1","2","5","4","12","0","1","2","0","1","2","5","4","12","0","1","2","5","4","12","1","0","2","5","4","0","1","2","5","4","0","1","2","5","4","0","1","2","5","4","0","1","2","5","4","0","1","2","0","1","2","4","0","1","2","-","-","-","-","-","-","-"];
    // (Keeping 3..18 as in the original for parity)
    f[3] = f.default.slice();
    f[4] = f.default.slice();
    f[5] = f.default.slice();
    f[6] = f.default.slice();
    f[7] = f.default.slice();
    f[8] = f.default.slice();
    f[9] = f.default.slice();
    f[10] = ["13","13","13","13","13","13","13","13","13","13","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-"];
    f[11] = f[10].concat();
    f[12] = f[10].concat('13');
    f[13] = ["5","5","5","5","5","9","9","9","9","8","8","8","8","8","9","5","5","5","5","5","9","10","10","10","9","9","9","9","10","10","8","8","8","9","10","8","8","9","10","11","11","11","11","11","9","9","10","9","10","10","9","10","9","10","9","10","11","11","11","9","9","10","10","9","9","9","10","10","9","9","10","10","10","11","11","11","11","11","11","11","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-"];
    f[14] = ["5","5","5","5","5","5","5","5","5","5","5","5","5","5","5","5","5","5","5","5","9","9","9","9","9","8","8","8","8","8","8","8","12","12","12","12","12","12","12","12","12","12","8","8","8","8","8","8","8","8","8","8","8","8","8","15","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-","-"];
    // 15-18 mirror default to keep code short; you can replace via UI buttons or import.
    f[15] = f.default.slice();
    f[16] = f.default.slice();
    f[17] = f.default.slice();
    f[18] = f.default.slice();
    return f;
  })();

  // --- State -----------------------------------------------------------------
  let TEMPLATES_COUNT = 5; // visible selectable templates (can be increased)
  let selectedT = 1;
  let stateFold = 'minus';
  let doQuests = false;
  let disableStart = false;
  const COLS = 20;
  const RERUN_SEC = 5;

  // --- UI builders -----------------------------------------------------------
  const iconHtml = (code) => `<i class="icon building-${CODES[code].name}" style="height:16px;vertical-align:-3px;"></i><b>00</b>`;
  const cell = (code) => {
    const isNum = !isNaN(code);
    return `<td role="tkk-element"${isNum ? ` data-code="${code}"` : ''} style="text-align:center;white-space:nowrap;">${isNum ? iconHtml(code) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</td>`;
  };

  function levelPaint(content) {
    const colors = { default: '', built: '#5a09', building: '#5af9', unbuildable: '#aaa9', error: '#a009' };
    const levels = {};
    document.querySelectorAll('td[role="tkk-element"]').forEach(td => {
      const code = parseInt(td.getAttribute('data-code'));
      if (Number.isNaN(code)) return;
      const level = (levels[code] || 1);
      const current = parseInt(game_data.village?.buildings?.[CODES[code].name] || '0');
      let next = $doc(`a.btn-build[data-building="${CODES[code].name}"]`).data('level-next');
      if (!next && document.querySelector(`tr.buildorder_${CODES[code].name}`)) next = CODES[code].levels + 1;
      if (content) td.querySelector('b').textContent = (`0${level}`).slice(-2);
      let bg = colors.default;
      if (!current) bg = colors.unbuildable;
      else if (current >= level) bg = colors.built;
      else if (level > CODES[code].levels) bg = colors.error;
      else if (next && level < next) bg = colors.building;
      td.style.backgroundColor = bg;
      levels[code] = level + 1;
    });
  }

  async function getQueue() {
    const q = await GMwrap.get(KEY_QUEUE_T(selectedT), null);
    return q || FALLBACKS.default.slice();
  }

  async function setQueue(arr) {
    await GMwrap.set(KEY_QUEUE_T(selectedT), arr);
  }

  function toolbarRow() {
    const btnT = (id, label, width = '10%') => `<input type="button" id="${id}" value="${label}" class="btn" style="width:${width};${stateFold === 'plus' ? ' display:none;' : ''}"/>`;
    return [
      '<tr>\n<td colspan="' + COLS + '" style="text-align:center;">',
      btnT('bauvorlage1', 'Vorlage 1'),
      btnT('bauvorlage2', 'Vorlage 2'),
      btnT('bauvorlage3', 'Vorlage 3'),
      btnT('wall10', 'Wall 10'),
      btnT('wall15', 'Wall 15'),
      btnT('wall20', 'Wall 20'),
      btnT('kaserne_stall_werkstadt', 'Kaserne/Stall/Werkstatt', '20%'),
      btnT('AHpush', 'AHpush'),
      '</td></tr>'
    ].join('');
  }

  async function draw() {
    const queue = await getQueue();
    $doc('#tkk-queue').remove();
    let html = `<div id="tkk-queue"><br/><table class="vis" style="width:100%;"><tr>`;
    html += `<th colspan="${COLS}" style="text-align:center;background-color:#c1a264;">Bauvorlagen</th></tr>`;
    html += toolbarRow();
    html += `<tr><th colspan="${COLS}"><img id="tkk-toggle" src="graphic/${stateFold}.png" style="vertical-align:-4px;"/>[DSU] Build Bot</th></tr>`;

    // Queue grid
    html += `<tr role="tkk-row"${stateFold === 'plus' ? ' style="display:none;"' : ''}>`;
    if (queue.length) {
      for (let i = 0; i < queue.length; i++) {
        const code = queue[i];
        if (i && i % COLS === 0) html += `</tr><tr role="tkk-row"${stateFold === 'plus' ? ' style=\"display:none;\"' : ''}>`;
        html += isNaN(code) ? cell() : cell(code);
        if (i + 1 === queue.length) html += cell().repeat(COLS - ((i + 1) % COLS || COLS));
      }
    } else {
      html += cell().repeat(COLS);
    }
    html += `</tr><tr id="tkk-separator"${stateFold === 'plus' ? ' style="display:none;"' : ''}><td colspan="${COLS}" style="text-align:center;background-color:#c1a264;">↕ DK: Herausnehmen • DK+STRG: Entfernen</td></tr>`;

    // Palette rows
    for (let r = 0; r < Math.ceil(CODES.length / COLS); r++) {
      html += `<tr${stateFold === 'plus' ? ' style="display:none;"' : ''}>`;
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        if (CODES[idx]) {
          html += `<td id="tkk-drag-${idx}" data-code="${idx}" title="${CODES[idx].title}" style="text-align:center;" draggable="true"><img src="https://dsde.innogamescdn.com/asset/f1821a7a/graphic/buildings/mid/${CODES[idx].name}${CODES[idx].image}.png" style="max-width:25px;max-height:25px;"/></td>`;
        } else html += '<td></td>';
      }
      html += '</tr>';
    }

    // Footer controls
    html += `<tr${stateFold === 'plus' ? ' style="display:none;"' : ''}><td colspan="${COLS}" style="text-align:center;background-color:#c1a264;">↕ DK: Hinzufügen • D&D: Dazwischenschieben • D&D+STRG: Ersetzen</td></tr>`;
    html += `<tr><td colspan="${COLS}" style="text-align:center;">`;
    html += `<select id="tkk-template" style="margin-right:3px;vertical-align:1px;">`;
    for (let i = 1; i <= TEMPLATES_COUNT; i++) html += `<option value="${i}"${selectedT === i ? ' selected' : ''}>Vorlage ${i}</option>`;
    html += `</select>`;
    html += `<input type="button" id="tkk-add" value="+" class="btn" style="width:3%;${stateFold === 'plus' ? ' display:none;' : ''}"/>`;
    html += `<input type="button" id="tkk-remove" value="-" class="btn" style="width:3%;${stateFold === 'plus' ? ' display:none;' : ''}"/>`;
    html += `<input type="button" id="tkk-clear" value="X" class="btn" style="width:3%;${stateFold === 'plus' ? ' display:none;' : ''}"/>`;
    html += `<input type="file" id="tkk-file" style="width:13%;margin-left:3px;vertical-align:1px;${stateFold === 'plus' ? ' display:none;' : ''}"/>`;
    html += `<input type="button" id="tkk-import" value="↑" class="btn" style="width:3%;${stateFold === 'plus' ? ' display:none;' : ''}"/>`;
    html += `<a id="tkk-export" href="#" class="btn" style="width:2%;${stateFold === 'plus' ? ' display:none;' : ''}">↓</a>`;
    html += `<label style="margin-left:8px;"><input type="checkbox" id="tkk-quests"${doQuests ? ' checked' : ''}/> Quests</label>`;
    html += `<input type="button" id="tkk-save" value="Speichern" class="btn" style="width:10%;${stateFold === 'plus' ? ' display:none;' : ''}"/>`;
    html += `<input type="button" id="tkk-start" value="Starten" class="btn" style="width:10%;"${disableStart ? ' disabled' : ''}/>`;
    html += `</td></tr></table></div>`;

    const container = document.getElementById('content_value') || document.querySelector('td#content_value') || document.body;
const firstTable = container.querySelector('table');
if (firstTable) {
  firstTable.insertAdjacentHTML('afterend', html);
} else {
  container.insertAdjacentHTML('beforeend', html);
}
levelPaint(true);


    // Prepare export link content
    const dataHref = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(queue));
    $doc('#tkk-export').attr('download', 'queue.json').attr('href', dataHref);
  }

  // --- Event wiring ----------------------------------------------------------
  function wireHandlers() {
    const $b = $doc('body');

    // Fold/expand
    $b.on('click', 'img#tkk-toggle', async function () {
      stateFold = /minus/.test(this.getAttribute('src')) ? 'plus' : 'minus';
      this.setAttribute('src', `graphic/${stateFold}.png`);
      await GMwrap.set(KEY_STATE, stateFold);
      draw();
    });

    // Remove / shift on double-click cell
    $b.on('dblclick', 'td[role="tkk-element"]', function (ev) {
      if (ev.ctrlKey) {
        this.outerHTML = cell();
        levelPaint(true);
        return;
      }
      const html = this;
      let skip = true, last = null;
      this.closest('table').querySelectorAll('td[role="tkk-element"]').forEach(td => {
        if (td === html) skip = false;
        if (skip) return;
        if (last) last.outerHTML = td.outerHTML;
        last = td;
      });
      if (last) last.outerHTML = cell();
      levelPaint(true);
    });

    // Palette double-click to append
    $b.on('dblclick', 'td[id^="tkk-drag"]', function () {
      const code = parseInt(this.getAttribute('data-code'));
      let $last = $doc('td[role="tkk-element"]:has(i):last');
      let $next = $last.next('td[role="tkk-element"]');
      if (!$next.length) $next = $last.parent().next('tr[role="tkk-row"]').children(':first');
      if (!$next.length) $next = $doc('td[role="tkk-element"]:first:not(:has(i))');
      $next.replaceWith(cell(code));
      levelPaint(true);
    });

    // Drag & drop from palette
    $b.on('dragstart', 'td[id^="tkk-drag"]', function (ev) {
      ev.originalEvent.dataTransfer.setData('id', this.id);
    });
    $b.on('dragenter dragover drop', 'td[role="tkk-element"]', function (ev) {
      ev.preventDefault();
      if (ev.type !== 'drop') return;
      const id = ev.originalEvent.dataTransfer.getData('id');
      const code = parseInt(document.getElementById(id).getAttribute('data-code'));
      if (ev.ctrlKey) {
        this.outerHTML = cell(code);
        levelPaint(true);
        return;
      }
      const html = this;
      let skip = true, last = null;
      this.closest('table').querySelectorAll('td[role="tkk-element"]').forEach(td => {
        if (td === html) skip = false;
        if (skip) return;
        const repl = (last === null) ? cell(code) : last.outerHTML;
        last = td.cloneNode(true);
        td.outerHTML = repl;
      });
      levelPaint(true);
    });

    // Template switch
    $b.on('change', '#tkk-template', async function () {
      selectedT = parseInt(this.value);
      await GMwrap.set(KEY_SELECTED(VILLAGE_ID), selectedT);
      draw();
    });

    // Row add/remove/clear
    $b.on('click', '#tkk-add', () => $doc('tr#tkk-separator').before(`<tr role="tkk-row">${cell().repeat(COLS)}</tr>`));
    $b.on('click', '#tkk-remove', () => $doc('tr[role="tkk-row"]:last').remove());
    $b.on('click', '#tkk-clear', () => $doc('td[role="tkk-element"]').replaceWith(cell()));

    // Import/Export
    $b.on('click', '#tkk-import', async () => {
      const file = $doc('#tkk-file')[0]?.files?.[0];
      if (!file) return;
      const txt = await file.text();
      let arr; try { arr = JSON.parse(txt) || []; } catch { arr = []; }
      await setQueue(arr);
      draw();
    });

    // Quests toggle
    $b.on('click', '#tkk-quests', async function () {
      doQuests = this.checked;
      await GMwrap.set(KEY_QUESTS, doQuests);
    });

    // Save current grid into template
    $b.on('click', '#tkk-save', async () => {
      const data = [];
      document.querySelectorAll('td[role="tkk-element"]').forEach(td => {
        const code = parseInt(td.getAttribute('data-code'));
        data.push(Number.isNaN(code) ? '-' : String(code));
      });
      await setQueue(data);
      draw();
    });

    // Start
    $b.on('click', '#tkk-start', async function () {
      this.disabled = true; disableStart = true; run();
    });

    // Quick buttons mapping
    const setFB = async (arr) => { await setQueue(arr); draw(); };
    $b.on('click', '#bauvorlage1', () => setFB(FALLBACKS[1]));
    $b.on('click', '#bauvorlage2', () => setFB(FALLBACKS[2]));
    $b.on('click', '#bauvorlage3', () => setFB(FALLBACKS[3]));
    $b.on('click', '#wall10', () => setFB(FALLBACKS[10]));
    $b.on('click', '#wall15', () => setFB(FALLBACKS[11]));
    $b.on('click', '#wall20', () => setFB(FALLBACKS[12]));
    $b.on('click', '#kaserne_stall_werkstadt', () => setFB(FALLBACKS[13]));
    $b.on('click', '#AHpush', () => setFB(FALLBACKS[14]));
  }

  // --- Core bot --------------------------------------------------------------
  function click($el) { $el.mousedown().click().mouseup(); }

  function handleFreeComplete() {
    const $free = $doc('a.btn-instant-free:visible');
    if ($free.length) click($free);
  }

  function denyBrowserNotif() {
    if ($doc('input#browser_notification_enable').length) {
      $doc('input#browser_notification_enable').prop('checked', false);
      click($doc('a#browser_notification_enabled_button'));
    }
  }

  function tryBuildFromQueue(queue) {
    // number of parallel slots available
    const additional = game_data.features?.Premium?.active ? 4 : 1;
    if ($doc('tr.sortable_row').length >= additional) return false;

    const levels = {};
    for (let i = 0; i < queue.length; i++) {
      const code = queue[i];
      if (isNaN(code)) continue;
      const lvl = (levels[code] || 1);
      const sel = `a#main_buildlink_${CODES[code].name}_${lvl}`;
      const $b = $doc(sel);
      if ($b.length) { if ($b.filter(':visible').length) click($b); return true; }

      // unmet reqs and building not present — wait until requirements are met
      const unmet = document.querySelector(`#buildings_unmet a[href$='${CODES[code].name}']`);
      const current = game_data.village?.buildings?.[CODES[code].name];
      if (!current && unmet) return false;
      levels[code] = lvl + 1;
    }
    return false;
  }

  async function run() {
    if (!botOK(true)) return; // pause when bot check up
    handleFreeComplete();
    denyBrowserNotif();

    if (doQuests && $doc('div#questlog > div.quest').length) {
      // Keep this minimal – original TKK has a very long quest flow.
      // We just auto-close reward popup if open.
      const $popup = $doc('div#popup_box_quest');
      if ($popup.length) {
        const $btn = $popup.find('a.btn-confirm-yes');
        click($btn.length ? $btn : $popup.find('a.popup_box_close'));
        setTimeout(run, 1000);
        return;
      }
    }

    const q = await getQueue();
    tryBuildFromQueue(q);
    setTimeout(run, RERUN_SEC * 1000);
  }

(async function init() {
  selectedT = parseInt(await GMwrap.get(KEY_SELECTED(VILLAGE_ID), 1));
  if (selectedT > TEMPLATES_COUNT) selectedT = 1;
  stateFold = await GMwrap.get(KEY_STATE, 'minus');
  doQuests  = await GMwrap.get(KEY_QUESTS, false);

  // Render once the main content exists
  ready('#content_value', async () => {
    await draw();
    wireHandlers();

    // Periodic repaint / presence check
    const iv = setInterval(() => {
      if (!botOK(false)) { clearInterval(iv); return; }
      if (document.getElementById('tkk-queue')) {
        levelPaint(false);
      } else {
        draw();
      }
    }, 1000);
  });
})();

})();
