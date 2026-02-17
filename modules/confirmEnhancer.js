// at top of confirmEnhancer.js
const CACHE_BUCKET_MS = 60_000;
const cacheBust = (u) => u + (u.includes("?") ? "&" : "?") + "_cb=" + Math.floor(Date.now()/CACHE_BUCKET_MS);

// resolve right before use (after DS_ASSETS_BASE is set by bootstrap)
function uiUrl(rel) {
  const base = (window.DS_ASSETS_BASE || "").replace(/\/$/, "");
  return cacheBust(`${base}/ui/${rel}`);
}




// --- kleine Wait-Helper ---
const delay = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(predicate, { timeout=3000, interval=50 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (predicate()) return true; } catch {}
    await delay(interval);
  }
  return false;
}
const waitForUiLib = (ms=3000) =>
  waitFor(() => window.UI_LIB && typeof UI_LIB.createToggleButton === "function",
          { timeout: ms, interval: 50 });

// --- State ---
let sendTimeInit = false;
let autoSendEnabled = false;
let autoSendObserver = null;
const GM_API = (typeof GM !== 'undefined' && GM && typeof GM.setValue === 'function') ? GM : null;
let closeSignalSentFor = null;
const TOKEN_SESSION_KEY = 'ds_auto_token';

function getAutoToken() {
  try {
    const urlToken = (new URL(location.href).searchParams.get('autotoken') || '').trim();
    if (urlToken) {
      sessionStorage.setItem(TOKEN_SESSION_KEY, urlToken);
      return urlToken;
    }
    return (sessionStorage.getItem(TOKEN_SESSION_KEY) || '').trim();
  } catch {
    try { return (sessionStorage.getItem(TOKEN_SESSION_KEY) || '').trim(); } catch { return ''; }
  }
}

function signalAutoCloseSent(delayMs = 2000) {
  if (!GM_API || !isAutoFlow()) return;
  const token = getAutoToken();
  if (!token || closeSignalSentFor === token) return;
  closeSignalSentFor = token;

  GM_API.setValue('auto_close_signal', {
    token,
    status: 'sent',
    delayMs,
    createdAt: Date.now(),
  }).catch(() => {});
}

function isAutoFlow() {
  const u = new URL(location.href);
  const byParam   = u.searchParams.get('auto') === '1';
  const byToken   = !!(u.searchParams.get('autotoken') || '').trim();
  const bySession = sessionStorage.getItem('ds_auto_flow') === '1';
  return byParam || byToken || bySession;
}

// optional: hält auto=1 sichtbar (kosmetisch)
function ensureAutoParamVisible() {
  if (!isAutoFlow()) return;
  const u = new URL(location.href);
  if (u.searchParams.get('auto') !== '1') {
    u.searchParams.set('auto', '1');
    history.replaceState(null, '', u);
  }
}

// UI + Logik wirklich einschalten
function enableAutoSendUI() {
  autoSendEnabled = true;
  const btn = document.getElementById('autoSendToggle');
  if (btn && typeof btn.setState === 'function') {
    btn.setState(true); // neuer Toggle-Button
  } else {
    // Fallback für ganz alten Button (sollte nicht mehr nötig sein)
    const $btn = $('#autoSendToggle');
    if ($btn.length) {
      $btn.text('Automatik: AN').css('background', '#4caf50').css('color', '#fff');
    }
  }
  // Falls Countdown schon existiert, direkt beobachten
  startAutoSendObserver();
}

function formatTimes(epoch) {
  const z = n => (n < 10 ? "0" : "") + n;
  const d = new Date(epoch * 1000);
  return `${z(d.getDate())}.${z(d.getMonth()+1)} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}

function initCommandUI() {
  if (
    (game_data.screen === 'map' || game_data.screen === 'place') &&
    $('#place_confirm_units').length > 0 &&
    $('.sendTime').length === 0 &&
    !sendTimeInit
  ) {
    sendTimeInit = true;
    ensureAutoParamVisible();

    $.get(
      $('.village_anchor').first().find('a').first().attr('href'),
      function (html) {
        let $cc = $(html).find('.commands-container');
        let $commandTable = $('form[action*="action=command"]').find('table').first();
        let w = (game_data.screen === 'map')
          ? '100%'
          : ($('#content_value').width() - $commandTable.width() - 10) + 'px';

        // 1) „Abschick Counter“-Zelle einfügen
        $commandTable
          .css('float', 'left')
          .find('tr').last()
          .after('<tr><td>Abschick Counter:</td><td class="sendTime">-</td></tr>');

        // 2) Ankunftszeit-Eingaben
        $commandTable.find('tr').last().after(`
          <tr>
            <td style="white-space: nowrap;">Ankunftszeit:</td>
            <td style="white-space: nowrap;">
              <input type="number" id="arrivalDay"   min="1" max="31" placeholder="TT" style="width:40px;"> .
              <input type="number" id="arrivalMonth" min="1" max="12" placeholder="MM" style="width:40px;">&nbsp;
              <input type="number" id="arrivalHour"  min="0" max="23" placeholder="HH" style="width:40px;"> :
              <input type="number" id="arrivalMinute"min="0" max="59" placeholder="MM" style="width:40px;"> :
              <input type="number" id="arrivalSecond"min="0" max="59" placeholder="SS" style="width:40px;">
            </td>
          </tr>
        `);

        // 2a) Felder für Tag/Monat sofort mit heutigem Datum befüllen
        const jetzt = new Date();
        $('#arrivalDay').val(jetzt.getDate());
        $('#arrivalMonth').val(jetzt.getMonth() + 1);

        // (Optional) Planner-Übernahme
        pickupArrivalFromPlanner();

        // 3) (Optional) Date+Time-Picker-Container
        $commandTable.find('tr').last().after(`
          <tr>
            <td style="white-space: nowrap;">Datum/ <br> Uhrzeit:</td>
            <td><div id="ds-date-picker"></div></td>
          </tr>
        `);
        if (window.DATEPICKER && typeof DATEPICKER.mount === "function") {
          DATEPICKER.mount({
            container: "#ds-date-picker",
            onApply: () => { if (typeof manualUpdateCountdown === "function") manualUpdateCountdown(); }
          });
        }

        // 4) Auto-Senden-Button (UI-Komponente)
        if ($('#autoSendToggle').length === 0) {
          const $row = $('<tr>');
          $row.append('<td style="white-space: nowrap;">Automatisch <br> abschicken:</td>');
          const $cell = $('<td>');
          $row.append($cell);
          $commandTable.find('tr').last().after($row);

          waitForUiLib(3000).then(async ok => {
            if (!ok) {
              console.warn('UI_LIB nicht verfügbar – versuche später erneut');
              setTimeout(() => { if (!$('#autoSendToggle').length) initCommandUI(); }, 200);
              return;
            }
            try {
const btn = await UI_LIB.createToggleButton({
  id: "autoSendToggle",
  initial: autoSendEnabled,
  onLabel: "Automatik",
  offLabel: "Automatik",
  onState: "AN",
  offState: "AUS",
  cssUrl: uiUrl("toggleButton.css"),
  htmlUrl: uiUrl("toggleButton.html"),
  onChange: (state) => {
    autoSendEnabled = state;
    if (state) startAutoSendObserver(); else stopAutoSendObserver();
  }
});


              $cell[0].appendChild(btn);

              // Auto-Flow: Auto-Senden aktivieren
              if (isAutoFlow() && !autoSendEnabled) enableAutoSendUI();
            } catch (e) {
              console.warn("toggle button failed", e);
              setTimeout(() => { if (!$('#autoSendToggle').length) initCommandUI(); }, 300);
            }
          });
        } else {
          if (isAutoFlow() && !autoSendEnabled) enableAutoSendUI();
        }

        // 5) Listener Ankunftszeit -> Countdown aktualisieren
        $('#arrivalDay, #arrivalMonth, #arrivalHour, #arrivalMinute, #arrivalSecond')
          .on('change', manualUpdateCountdown);

        // 6) Commands-Panel andocken
        if ($cc.length > 0) {
          const $commandPanel = $('<div id="command-panel"></div>').css({
            'float': 'right',
            'width': w,
            'display': 'block',
            'max-height': $commandTable.height(),
            'overflow': 'scroll'
          });

          const $clonedTable = $cc.find('table').clone();
          $commandPanel.append($clonedTable).append('<br><div style="clear:both;"></div>');
          $commandTable.closest('table').after($commandPanel);

          // Rückkehr-Befehle entfernen
          $commandPanel.find('tr.command-row').filter(function () {
            return $(this).find('img[src*="/return_"], img[src*="/back.png"]').length > 0;
          }).remove();

          // Delegierter Click-Handler
          $commandPanel.on('click', 'tr.command-row', function () {
            const $this = $(this);

            // a) Dauer auslesen
            let durationText = $commandTable
              .find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")')
              .next().text().trim();
            let [h, m, s] = durationText.split(':').map(x => parseInt(x, 10) || 0);
            let durationInSeconds = h * 3600 + m * 60 + s;

            // b) Endzeit aus <span class="timer">
            let endTime = parseInt($this.find('span.timer').data('endtime'), 10);
            if (isNaN(endTime) || durationInSeconds === 0) {
              $('.sendTime').html('Keine gültigen Zeitdaten');
              $('#sendCountdown')?.remove();
              clearTabCountdown();
              return;
            }

            // c) Ankunftszeit in Input-Felder schreiben
            let arrivalDate = new Date(endTime * 1000);
            $('#arrivalDay').val(arrivalDate.getDate());
            $('#arrivalMonth').val(arrivalDate.getMonth() + 1);
            $('#arrivalHour').val(arrivalDate.getHours());
            $('#arrivalMinute').val(arrivalDate.getMinutes());
            $('#arrivalSecond').val(arrivalDate.getSeconds());

            // d) Sendepunkt berechnen
            let sendTime = endTime - durationInSeconds;

            // e) Vorherige Timer/Observer stoppen
            clearTabCountdown();

            // f) Abschick Counter anzeigen
            $('.sendTime').html(
              formatTimes(sendTime) +
              ' (<span id="sendCountdown" class="sendTimer" data-endtime="' + sendTime + '">-</span>)'
            );

            // g) Timer starten
            Timing.tickHandlers.timers.initTimers('sendTimer');

            // h) Auto-Send-Observer starten
            if (autoSendEnabled) startAutoSendObserver();

            // i) Zeile hervorheben
            $(this).closest('table').find('td').css('background-color', '');
            $(this).find('td').css('background-color', '#FFF68F');
          });

          // Timer für Standardanzeigen aktivieren
          $('.widget-command-timer').addClass('timer');
          Timing.tickHandlers.timers.initTimers('widget-command-timer');

          // Safety: Auto-Flow
          if (isAutoFlow() && $('#autoSendToggle').length && !autoSendEnabled) {
            enableAutoSendUI();
          }
        } 

        // 7) „Start Ankunfts-Senden“-Button binden
        $('#startArrivalSend').off('click').on('click', function () {
          const heute = new Date();
          const year  = heute.getFullYear();

          const day    = parseInt($('#arrivalDay').val(), 10);
          const month  = parseInt($('#arrivalMonth').val(), 10);
          const hour   = parseInt($('#arrivalHour').val(), 10);
          const minute = parseInt($('#arrivalMinute').val(), 10);
          const second = parseInt($('#arrivalSecond').val(), 10);

          if ([day, month, hour, minute, second].some(x => isNaN(x))) {
            alert('Bitte alle Felder ausfüllen!');
            return;
          }

          const arrivalEpoch = Math.floor(new Date(year, month - 1, day, hour, minute, second).getTime() / 1000);

          const durationText = $commandTable
            .find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")')
            .next().text().trim();
          const [h2, m2, s2] = durationText.split(':').map(x => parseInt(x, 10) || 0);
          const durationInSeconds2 = h2 * 3600 + m2 * 60 + s2;

          const sendEpoch = arrivalEpoch - durationInSeconds2;
          if (sendEpoch < Math.floor(Date.now() / 1000)) {
            alert('Abschickzeit liegt in der Vergangenheit!');
            return;
          }
          scheduleSend(sendEpoch);
        });
      }
    );
  }
}

function manualUpdateCountdown() {
  const heute = new Date();
  const year  = heute.getFullYear();

  let day     = parseInt($('#arrivalDay').val(), 10);   if (isNaN(day))   day = heute.getDate();
  let month   = parseInt($('#arrivalMonth').val(), 10); if (isNaN(month)) month = heute.getMonth()+1;
  const hour   = parseInt($('#arrivalHour').val(), 10);
  const minute = parseInt($('#arrivalMinute').val(), 10);
  const second = parseInt($('#arrivalSecond').val(), 10);
  if ([day, month, hour, minute, second].some(x => isNaN(x))) return;

  const arrivalEpoch = Math.floor(new Date(year, month - 1, day, hour, minute, second).getTime() / 1000);

  const $commandTable = $('form[action*="action=command"]').find('table').first();
  const durationText = $commandTable
    .find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")')
    .next().text().trim();
  const [h, m, s] = durationText.split(':').map(x => parseInt(x, 10) || 0);
  const durationSeconds = h * 3600 + m * 60 + s;

  const sendEpoch = arrivalEpoch - durationSeconds;

  stopAutoSendObserver();
  $('#sendCountdown').remove();

  $('.sendTime').html(
    formatTimes(sendEpoch) +
    ' (<span id="sendCountdown" class="sendTimer" data-endtime="' + sendEpoch + '">-</span>)'
  );

  Timing.tickHandlers.timers.initTimers('sendTimer');
  if (autoSendEnabled) startAutoSendObserver();
}

function scheduleSend(sendEpoch) {
  clearTabCountdown();
  $('.sendTime').html(
    formatTimes(sendEpoch) +
    ' (<span id="sendCountdown" class="sendTimer" data-endtime="' + sendEpoch + '">-</span>)'
  );
  Timing.tickHandlers.timers.initTimers('sendTimer');
  if (autoSendEnabled) startAutoSendObserver();
}

function clearTabCountdown() {
  stopAutoSendObserver();
  $('.sendTimer').remove();
  $('.sendTime').html('-');
  document.title = "Stämme";
}

function startAutoSendObserver() {
  stopAutoSendObserver();
  const countdownElem = document.getElementById('sendCountdown');
  if (!countdownElem) return;

  autoSendObserver = new MutationObserver(function () {
    const text = countdownElem.textContent.trim();
    if (autoSendEnabled && text === "0:00:00") {
      stopAutoSendObserver();
      setTimeout(function () {
        const $btn = $('#troop_confirm_submit');
        if ($btn.length && $btn.is(':visible') && !$btn.prop('disabled')) {
          $btn.click();
          signalAutoCloseSent(1800);
          clearTabCountdown();
        }
      }, Math.random() * (600 - 400) + 400);
    }
  });
  autoSendObserver.observe(countdownElem, { childList: true, characterData: true, subtree: true });
}

function stopAutoSendObserver() {
  if (autoSendObserver) { autoSendObserver.disconnect(); autoSendObserver = null; }
}

function isVisible($el) { return $el.length > 0 && $el.is(':visible'); }

const observer = new MutationObserver(function () {
  const $submit = $('#troop_confirm_submit');
  if (isVisible($submit)) {
    initCommandUI();
  } else {
    sendTimeInit = false;
    clearTabCountdown();
  }
});
observer.observe(document.body, { childList: true, subtree: true });

// Fallback-Init
function tryInitConfirmEnhancer(attempts = 0) {
  const $submit = $('#troop_confirm_submit');
  if (isVisible($submit)) {
    initCommandUI();
    console.log("Confirm Enhancer gestartet (Fallback)");
    return;
  }
  if (attempts < 10) {
    setTimeout(() => tryInitConfirmEnhancer(attempts + 1), 300);
  } else {
    console.warn("Confirm Enhancer konnte nicht initialisiert werden.");
  }
}
document.addEventListener('DOMContentLoaded', () => { tryInitConfirmEnhancer(); });

$(document).on('click', '#troop_confirm_submit', () => {
  signalAutoCloseSent(1800);
});

// --- Planner-Übernahme ---
async function pickupArrivalFromPlanner() {
  try {
    const p = await GM.getValue('pending_arrival', null);
    if (!p) return;

    if (!p.createdAt || (Date.now() - p.createdAt) > 10 * 60 * 1000) {
      await GM.setValue('pending_arrival', null);
      return;
    }

    const u = new URL(location.href);
    const v = u.searchParams.get('village');
    if (p.village && v && p.village !== v) return;

    const ok = () =>
      $('#arrivalDay').length &&
      $('#arrivalMonth').length &&
      $('#arrivalHour').length &&
      $('#arrivalMinute').length &&
      $('#arrivalSecond').length;

    let retries = 0;
    while (!ok() && retries < 100) { await new Promise(r => setTimeout(r, 100)); retries++; }
    if (!ok()) return;

    let parts = p.arrivalParts;
    if (!parts) {
      const m = (p.arrivalStr || '').match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
      if (m) parts = { day:+m[1], month:+m[2], year:+m[3], hour:+m[4], minute:+m[5], second:+m[6] };
    }
    if (!parts) return;

    $('#arrivalDay').val(parts.day);
    $('#arrivalMonth').val(parts.month);
    $('#arrivalHour').val(parts.hour);
    $('#arrivalMinute').val(parts.minute);
    $('#arrivalSecond').val(parts.second);

    if (typeof manualUpdateCountdown === 'function') manualUpdateCountdown();
    await GM.setValue('pending_arrival', null);
  } catch (e) {
    console.warn('pickupArrivalFromPlanner error', e);
  }
}
