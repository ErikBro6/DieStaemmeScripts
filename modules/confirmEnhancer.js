

(function confirmEnhancerIIFE(){
  if (window.__CONFIRM_ENHANCER_LOADED__) return; // idempotent bei Doppel-Eval
  window.__CONFIRM_ENHANCER_LOADED__ = true;

    const UI_BASE = (window.DS_ASSETS_BASE || "").replace(/\/$/, "") + "/ui";
    const TOGGLE_CSS  = UI_BASE + "/toggleButton.css";
    const TOGGLE_HTML = UI_BASE + "/toggleButton.html";

  // ---- State
  let sendTimeInit = false;
  let autoSendEnabled = false;
  let autoSendObserver = null;
  let rootObserver = null;

  // ---- Utils
  const $ = window.$;
  const log = (...a) => console.info("[confirmEnhancer]", ...a);

  const q = (sel, ctx=document) => ctx.querySelector(sel);
  const qa = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  const nowEpoch = () => Math.floor(Date.now() / 1000);

  const parseDuration = (text) => {
    // Sucht “hh:mm:ss” in beliebigen Label-Varianten (Dauer/Duur/Duration)
    const m = (text || "").match(/(\d{1,2}):(\d{2}):(\d{2})/);
    if (!m) return 0;
    const [h,mn,s] = [parseInt(m[1],10)||0, parseInt(m[2],10)||0, parseInt(m[3],10)||0];
    return h*3600 + mn*60 + s;
  };

  const fmt2 = (n) => (n<10? "0":"") + n;
  const formatEpoch = (epoch) => {
    const d = new Date(epoch*1000);
    return `${fmt2(d.getDate())}.${fmt2(d.getMonth()+1)} ${fmt2(d.getHours())}:${fmt2(d.getMinutes())}:${fmt2(d.getSeconds())}`;
  };

  const isVisible = ($el) => $el.length > 0 && $el.is(":visible");

  const isAutoFlow = () => {
    const u = new URL(location.href);
    return u.searchParams.get("auto")==="1" || sessionStorage.getItem("ds_auto_flow")==="1";
  };

  const ensureAutoParamVisible = () => {
    if (!isAutoFlow()) return;
    const u = new URL(location.href);
    if (u.searchParams.get("auto") !== "1") {
      u.searchParams.set("auto", "1");
      history.replaceState(null, "", u);
    }
  };

  // ---- DOM pieces (einmal gecacht)
  const dom = {
    get commandTable() { return $('form[action*="action=command"]').find('table').first(); },
    get submitBtn() { return $('#troop_confirm_submit'); },
    get ccHtml() { return $('.village_anchor').first().find('a').first().attr('href'); },
    get countdownEl() { return document.getElementById('sendCountdown'); },
    get durationCellText() {
      return this.commandTable
        .find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")')
        .next().text().trim();
    },
    ensureInputsExist() {
      const $ct = this.commandTable;
      if ($ct.length===0) return false;
      if ($('.sendTime').length===0) {
        $ct.css('float','left')
          .find('tr').last()
          .after('<tr><td>Abschick Counter:</td><td class="sendTime">-</td></tr>');
      }
      if (!$('#arrivalDay').length) {
        $ct.find('tr').last().after(`
          <tr>
            <td style="white-space:nowrap;">Ankunftszeit:</td>
            <td style="white-space:nowrap;">
              <input type="number" id="arrivalDay" min="1" max="31" placeholder="TT" style="width:40px;"> .
              <input type="number" id="arrivalMonth" min="1" max="12" placeholder="MM" style="width:40px;">&nbsp;
              <input type="number" id="arrivalHour" min="0" max="23" placeholder="HH" style="width:40px;"> :
              <input type="number" id="arrivalMinute" min="0" max="59" placeholder="MM" style="width:40px;"> :
              <input type="number" id="arrivalSecond" min="0" max="59" placeholder="SS" style="width:40px;">
            </td>
          </tr>
        `);
        const now = new Date();
        $('#arrivalDay').val(now.getDate());
        $('#arrivalMonth').val(now.getMonth()+1);

        // Change-Listener einmalig
        $('#arrivalDay, #arrivalMonth, #arrivalHour, #arrivalMinute, #arrivalSecond')
          .off('change.confirmEnhancer')
          .on('change.confirmEnhancer', manualUpdateCountdown);
      }
        if (!$('#autoSendToggle').length) {
        // neue Tabellenzeile einfügen mit leerer Zelle
        const $row = $('<tr>');
        $row.append('<td style="white-space:nowrap;">&nbsp;</td>');
        const $cell = $('<td>');
        $row.append($cell);
        $commandTable.find('tr').last().after($row);

        // Button via UI_LIB erstellen und einfügen
        UI_LIB.createToggleButton({
            id: "autoSendToggle",
            initial: autoSendEnabled,
            onLabel: "Auto-Senden",
            offLabel: "Auto-Senden",
            onState: "AN",
            offState: "AUS",
            cssUrl: TOGGLE_CSS,
            htmlUrl: TOGGLE_HTML,
            onChange: (state) => {
            autoSendEnabled = state;
            if (state) startAutoSendObserver();
            else stopAutoSendObserver();
            }
        }).then(btn => {
            $cell[0].appendChild(btn);
        }).catch(e => console.warn("toggle button failed", e));
        }

      return true;
    },
    setSendCountdown(epoch) {
      $('.sendTime').html(
        `${formatEpoch(epoch)} (<span id="sendCountdown" class="sendTimer" data-endtime="${epoch}">-</span>)`
      );
      Timing.tickHandlers.timers.initTimers('sendTimer');
    },
    clearCountdown() {
      stopAutoSendObserver();
      $('.sendTimer').remove();
      $('.sendTime').html('-');
      document.title = "Stämme";
    },
    setArrivalInputs(parts){ // {day,month,hour,minute,second}
      if (parts.day)   $('#arrivalDay').val(parts.day);
      if (parts.month) $('#arrivalMonth').val(parts.month);
      if (parts.hour!=null)   $('#arrivalHour').val(parts.hour);
      if (parts.minute!=null) $('#arrivalMinute').val(parts.minute);
      if (parts.second!=null) $('#arrivalSecond').val(parts.second);
    }
  };

  // ---- Core Handlers
  function manualUpdateCountdown() {
    const now = new Date();
    const year = now.getFullYear();

    const day   = parseInt($('#arrivalDay').val(), 10)    || now.getDate();
    const month = parseInt($('#arrivalMonth').val(), 10)  || (now.getMonth()+1);
    const hour  = parseInt($('#arrivalHour').val(), 10);
    const min   = parseInt($('#arrivalMinute').val(), 10);
    const sec   = parseInt($('#arrivalSecond').val(), 10);
    if ([day,month,hour,min,sec].some(n => Number.isNaN(n))) return;

    const arrivalEpoch = Math.floor(new Date(year, month-1, day, hour, min, sec).getTime()/1000);
    const dur = parseDuration(dom.durationCellText);
    const sendEpoch = arrivalEpoch - dur;

    stopAutoSendObserver();
    $('#sendCountdown').remove();
    dom.setSendCountdown(sendEpoch);
    if (autoSendEnabled) startAutoSendObserver();
  }

  function startAutoSendObserver() {
    stopAutoSendObserver();
    const el = dom.countdownEl;
    if (!el) return;

    autoSendObserver = new MutationObserver(() => {
      const text = el.textContent.trim();
      if (autoSendEnabled && text === "0:00:00") {
        stopAutoSendObserver();
        // leichte Jitter-Zeit
        const jitter = 400 + Math.floor(Math.random()*200);
        setTimeout(() => {
          const $btn = dom.submitBtn;
          if ($btn.length && $btn.is(':visible') && !$btn.prop('disabled')) {
            $btn.click();
            dom.clearCountdown();
          }
        }, jitter);
      }
    });
    autoSendObserver.observe(el, { childList: true, characterData: true, subtree: true });
  }

  function stopAutoSendObserver() {
    if (autoSendObserver) { autoSendObserver.disconnect(); autoSendObserver = null; }
  }

  function bindCommandPanelIfAvailable(targetHtml, $commandTable) {
    if (!targetHtml) { UI?.ErrorMessage?.('Keine Befehle gefunden'); return; }
    const $tmp = $(targetHtml);
    const $cc  = $tmp.find('.commands-container');
    if (!$cc.length) { UI?.ErrorMessage?.('Keine Befehle gefunden'); return; }

    const w = (game_data.screen === 'map')
      ? '100%' : ($('#content_value').width() - $commandTable.width() - 10) + 'px';

    const $panel = $('<div id="command-panel"></div>').css({
      float: 'right', width: w, display: 'block',
      'max-height': $commandTable.height(), overflow: 'auto'
    });

    const $table = $cc.find('table').clone();
    // Rückkehr-Befehle entfernen
    $table.find('tr.command-row').filter(function () {
      return $(this).find('img[src*="/return_"], img[src*="/back.png"]').length > 0;
    }).remove();

    $panel.append($table).append('<br><div style="clear:both;"></div>');
    $commandTable.closest('table').after($panel);

    // Delegierter Click
    $panel.on('click.confirmEnhancer', 'tr.command-row', function () {
      const $row = $(this);

      const dur = parseDuration(dom.durationCellText);
      const endTime = parseInt($row.find('span.timer').data('endtime'), 10);
      if (!endTime || !dur) {
        $('.sendTime').html('Keine gültigen Zeitdaten');
        $('#sendCountdown')?.remove();
        dom.clearCountdown();
        return;
      }

      const arrival = new Date(endTime*1000);
      dom.setArrivalInputs({
        day: arrival.getDate(),
        month: arrival.getMonth()+1,
        hour: arrival.getHours(),
        minute: arrival.getMinutes(),
        second: arrival.getSeconds()
      });

      const sendEpoch = endTime - dur;
      dom.clearCountdown();
      dom.setSendCountdown(sendEpoch);
      if (autoSendEnabled) startAutoSendObserver();

      $row.closest('table').find('td').css('background-color','');
      $row.find('td').css('background-color','#FFF68F');
    });

    // Timer-Klassen normalisieren
    $('.widget-command-timer').addClass('timer');
    Timing.tickHandlers.timers.initTimers('widget-command-timer');
  }

  async function pickupArrivalFromPlanner() {
    try {
      const p = await GM.getValue('pending_arrival', null);
      if (!p) return;
      if (!p.createdAt || (Date.now() - p.createdAt) > 10*60*1000) {
        await GM.setValue('pending_arrival', null);
        return;
      }
      const u = new URL(location.href);
      const v = u.searchParams.get('village');
      if (p.village && v && p.village !== v) return;

      // warten bis inputs existieren
      let tries=0;
      const ok = () => $('#arrivalDay,#arrivalMonth,#arrivalHour,#arrivalMinute,#arrivalSecond').length===5;
      while(!ok() && tries<100){ await new Promise(r=>setTimeout(r,100)); tries++; }
      if(!ok()) return;

      let parts = p.arrivalParts;
      if (!parts) {
        const m = (p.arrivalStr || '').match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
        if (m) parts = { day:+m[1], month:+m[2], year:+m[3], hour:+m[4], minute:+m[5], second:+m[6] };
      }
      if (!parts) return;

      dom.setArrivalInputs(parts);
      manualUpdateCountdown();

      await GM.setValue('pending_arrival', null); // consume once
    } catch(e){ console.warn('pickupArrivalFromPlanner error', e); }
  }

  function scheduleSend(sendEpoch) {
    dom.clearCountdown();
    dom.setSendCountdown(sendEpoch);
    if (autoSendEnabled) startAutoSendObserver();
  }

  function initCommandUI() {
    if (!(game_data.screen === 'map' || game_data.screen === 'place')) return;
    if (!$('#place_confirm_units').length) return;

    if (!dom.ensureInputsExist()) return;
    if (!sendTimeInit) {
      sendTimeInit = true;
      ensureAutoParamVisible();
      pickupArrivalFromPlanner();

      // „Auto aus URL/Session“ -> sofort aktivieren
if (isAutoFlow()) {
  autoSendEnabled = true;
  document.getElementById("autoSendToggle")?.setState(true);
  startAutoSendObserver();
}


      // Button „Start Ankunfts-Senden“
      $('#startArrivalSend').off('click.confirmEnhancer').on('click.confirmEnhancer', () => {
        const now = new Date(), year = now.getFullYear();
        const day   = parseInt($('#arrivalDay').val(), 10);
        const month = parseInt($('#arrivalMonth').val(), 10);
        const hour  = parseInt($('#arrivalHour').val(), 10);
        const min   = parseInt($('#arrivalMinute').val(), 10);
        const sec   = parseInt($('#arrivalSecond').val(), 10);
        if ([day,month,hour,min,sec].some(isNaN)) { alert('Bitte alle Felder ausfüllen!'); return; }

        const arrivalEpoch = Math.floor(new Date(year,month-1,day,hour,min,sec).getTime()/1000);
        const dur = parseDuration(dom.durationCellText);
        const sendEpoch = arrivalEpoch - dur;
        if (sendEpoch < nowEpoch()) { alert('Abschickzeit liegt in der Vergangenheit!'); return; }
        scheduleSend(sendEpoch);
      });

      // Commands-Panel async laden (ein Request)
      const href = dom.ccHtml;
      if (href) {
        $.get(href, (html) => {
          bindCommandPanelIfAvailable(html, dom.commandTable);
        });
      }
    }
  }

  function startRootObserver() {
    if (rootObserver) rootObserver.disconnect();
    rootObserver = new MutationObserver(() => {
      const $submit = dom.submitBtn;
      if (isVisible($submit)) {
        initCommandUI();
      } else {
        sendTimeInit = false;
        dom.clearCountdown();
      }
    });
    rootObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ---- Bootstrap
  document.addEventListener('DOMContentLoaded', () => {
    tryInitConfirmEnhancer();
  });

  function tryInitConfirmEnhancer(attempts = 0) {
    if (isVisible(dom.submitBtn)) {
      initCommandUI();
      startRootObserver();
      log("gestartet");
      return;
    }
    if (attempts < 10) {
      setTimeout(() => tryInitConfirmEnhancer(attempts + 1), 300);
    } else {
      console.warn("Confirm Enhancer konnte nicht initialisiert werden.");
    }
  }
})();
