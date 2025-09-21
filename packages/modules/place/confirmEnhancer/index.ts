// packages/modules/place/confirmEnhancer/index.ts
import type { DsModule, ModuleContext } from '../../../types/module';

// Tampermonkey/Loader injiziert "defineModule" als Global (über loader.ts)
declare function defineModule(m: DsModule): void;

const mod: DsModule = {
  id: 'place/confirmEnhancer',
  // Läuft auf place + map (wie früher)
  when: (ctx) => ctx.screen === 'place' || ctx.screen === 'map',
  run: async (ctx: ModuleContext) => {
    try {
      console.info('[DST][confirmEnhancer] run start', ctx.screen, location.href);
      const controller = new ConfirmEnhancerController(ctx);
      await controller.init();
      window.addEventListener('unload', () => controller.dispose());
      console.info('[DST][confirmEnhancer] init done');
    } catch (e) {
      console.error('[DST][confirmEnhancer] run error', e);
    }
  }
};

defineModule(mod);

/**
 * Die komplette, ehemals "prozedurale" Logik ist hier in eine Klasse
 * gegossen – 1:1 Verhalten wie dein altes confirmEnhancer.js.
 */
class ConfirmEnhancerController {
  private ctx: ModuleContext;
  private autoSendEnabled = false;
  private sendTimeInit = false;
  private autoSendObserver: MutationObserver | null = null;
  private pageObserver: MutationObserver | null = null;

  constructor(ctx: ModuleContext) {
    this.ctx = ctx;
  }

  async init() {
    // State laden
    const s = await this.ctx.storage.get<any>('confirm_state', { autoSendEnabled: false, sendTimeInit: false });
    this.autoSendEnabled = !!s.autoSendEnabled;
    this.sendTimeInit    = !!s.sendTimeInit;

    // Warte bis jQuery da ist (wichtig für try=confirm)
    const okJq = await this.waitFor(() => !!(window as any).jQuery, { timeout: 5000, interval: 50 });
    if (!okJq) {
      console.warn('[DST][confirmEnhancer] jQuery not available – abort');
      return;
    }

    // auto=1 kosmetisch sichtbar halten
    this.ensureAutoParamVisible();

    // Body beobachten – exakt wie vorher: sobald Submit sichtbar → init UI
    this.pageObserver = new MutationObserver(() => this.tryInitUiBySubmitVisible());
    this.pageObserver.observe(document.body, { childList: true, subtree: true });

    // Fallback-Init (wie früher tryInitConfirmEnhancer)
    this.tryInitUiBySubmitVisible(true);
  }

  dispose() {
    this.stopAutoSendObserver();
    this.pageObserver?.disconnect();
    this.pageObserver = null;
  }

  // ========= alte Hilfsfunktionen (1:1) =========

  private isAutoFlow() {
    const u = new URL(location.href);
    const byParam   = u.searchParams.get('auto') === '1';
    const bySession = sessionStorage.getItem('ds_auto_flow') === '1';
    return byParam || bySession;
  }

  private ensureAutoParamVisible() {
    if (!this.isAutoFlow()) return;
    const u = new URL(location.href);
    if (u.searchParams.get('auto') !== '1') {
      u.searchParams.set('auto', '1');
      history.replaceState(null, '', u);
    }
  }

  private formatTimes(epoch: number) {
    const z = (n:number)=> (n < 10 ? '0' : '') + n;
    const d = new Date(epoch * 1000);
    return `${z(d.getDate())}.${z(d.getMonth()+1)} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
  }

  private async waitFor(predicate: () => any, { timeout=3000, interval=50 } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (predicate()) return true; } catch {}
      await new Promise(r => setTimeout(r, interval));
    }
    return false;
  }

  private async waitForUiLib(ms=3000) {
    return this.waitFor(() => (window as any).UI_LIB && typeof (window as any).UI_LIB.createToggleButton === 'function',
                        { timeout: ms, interval: 50 });
  }

  private uiUrl(rel: string) {
    const CACHE_BUCKET_MS = 60_000;
    const base = ((window as any).DS_ASSETS_BASE || '').replace(/\/$/, '');
    const cb   = Math.floor(Date.now()/CACHE_BUCKET_MS);
    const url  = `${base}/ui/${rel}`;
    return url + (url.includes('?') ? '&' : '?') + `_cb=${cb}`;
  }

  // ========= alte Kernlogik (1:1) =========

  private tryInitUiBySubmitVisible(fallback = false, attempts = 0) {
    const $ = (window as any).jQuery;
    const $submit = $('#troop_confirm_submit');
    const isVisible = ($el: any) => $el.length > 0 && $el.is(':visible');

    const inTargetScreen = ((window as any).game_data?.screen === 'map' || (window as any).game_data?.screen === 'place');

    if (inTargetScreen &&
        $('#place_confirm_units').length > 0 &&
        $('.sendTime').length === 0 &&
        !this.sendTimeInit &&
        isVisible($submit)) {
      this.initCommandUI();
      console.info('[DST][confirmEnhancer] UI gestartet');
      return;
    }

    // Fallback wie früher (versuche bis zu 10x)
    if (fallback) {
      if (isVisible($submit)) {
        this.initCommandUI();
        console.info('[DST][confirmEnhancer] gestartet (Fallback)');
        return;
      }
      if (attempts < 10) {
        setTimeout(() => this.tryInitUiBySubmitVisible(true, attempts + 1), 300);
      } else {
        console.warn('[DST][confirmEnhancer] konnte nicht initialisiert werden (Fallback)');
      }
    }
  }

  private initCommandUI() {
    const $ = (window as any).jQuery;

    this.sendTimeInit = true;
    this.persistState();

    this.ensureAutoParamVisible();

    $.get(
      $('.village_anchor').first().find('a').first().attr('href'),
      (html: string) => {
        const $cc = $(html).find('.commands-container');
        const $commandTable = $('form[action*="action=command"]').find('table').first();
        const w = ((window as any).game_data?.screen === 'map')
          ? '100%'
          : (($('#content_value').width() || 0) - $commandTable.width() - 10) + 'px';

        // 1) Abschick Counter
        $commandTable
          .css('float', 'left')
          .find('tr').last()
          .after('<tr><td>Abschick Counter:</td><td class="sendTime">-</td></tr>');

        // 2) Ankunftszeit Inputs
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

        // 2a) Heute in TT/MM
        const jetzt = new Date();
        $('#arrivalDay').val(jetzt.getDate());
        $('#arrivalMonth').val(jetzt.getMonth() + 1);

        // Planner-Übernahme
        this.pickupArrivalFromPlanner().catch(()=>{});

        // 3) DatePicker (optional)
        $commandTable.find('tr').last().after(`
          <tr>
            <td style="white-space: nowrap;">Datum/ <br> Uhrzeit:</td>
            <td><div id="ds-date-picker"></div></td>
          </tr>
        `);
        const DP = (window as any).DATEPICKER;
        if (DP && typeof DP.mount === 'function') {
          DP.mount({
            container: '#ds-date-picker',
            onApply: () => { this.manualUpdateCountdown(); }
          });
        }

        // 4) Auto-Senden Toggle
        if ($('#autoSendToggle').length === 0) {
          const $row = $('<tr>');
          $row.append('<td style="white-space: nowrap;">Automatisch <br> abschicken:</td>');
          const $cell = $('<td>');
          $row.append($cell);
          $commandTable.find('tr').last().after($row);

          this.waitForUiLib(3000).then(async ok => {
            if (!ok) {
              console.warn('[DST][confirmEnhancer] UI_LIB nicht verfügbar – versuche später erneut');
              setTimeout(() => { if (!$('#autoSendToggle').length) this.initCommandUI(); }, 200);
              return;
            }
            try {
              const btn = await (window as any).UI_LIB.createToggleButton({
                id: 'autoSendToggle',
                initial: this.autoSendEnabled,
                onLabel: 'Automatik',
                offLabel: 'Automatik',
                onState: 'AN',
                offState: 'AUS',
                cssUrl: this.uiUrl('toggleButton.css'),
                htmlUrl: this.uiUrl('toggleButton.html'),
                onChange: (state: boolean) => {
                  this.autoSendEnabled = state;
                  this.persistState();
                  if (state) this.startAutoSendObserver(); else this.stopAutoSendObserver();
                }
              });
              $cell[0].appendChild(btn);

              if (this.isAutoFlow() && !this.autoSendEnabled) this.enableAutoSendUI();
            } catch (e) {
              console.warn('[DST][confirmEnhancer] toggle button failed', e);
              setTimeout(() => { if (!$('#autoSendToggle').length) this.initCommandUI(); }, 300);
            }
          });
        } else {
          if (this.isAutoFlow() && !this.autoSendEnabled) this.enableAutoSendUI();
        }

        // 5) Inputs -> Countdown
        $('#arrivalDay, #arrivalMonth, #arrivalHour, #arrivalMinute, #arrivalSecond')
          .off('change.ds')
          .on('change.ds', () => this.manualUpdateCountdown());

        // 6) Commands-Panel klonen
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

          // Rückkehrbefehle entfernen
          $commandPanel.find('tr.command-row').filter(function () {
            return $(this).find('img[src*="/return_"], img[src*="/back.png"]').length > 0;
          }).remove();

          // Delegierter Click-Handler (ohne :hover)
          $commandPanel.off('click.ds').on('click.ds', 'tr.command-row', (e: any) => {
            const $row = $(e.currentTarget);

            // a) Dauer lesen
            const durationText = $commandTable
              .find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")')
              .next().text().trim();
            const [h, m, s] = durationText.split(':').map((x: string) => parseInt(x, 10) || 0);
            const durationInSeconds = (h||0) * 3600 + (m||0) * 60 + (s||0);

            // b) Endzeit
            const endTime = parseInt($row.find('span.timer').data('endtime'), 10);
            if (isNaN(endTime) || durationInSeconds === 0) {
              $('.sendTime').html('Keine gültigen Zeitdaten');
              $('#sendCountdown')?.remove();
              this.clearTabCountdown();
              return;
            }

            // c) Inputs füllen
            const d = new Date(endTime * 1000);
            $('#arrivalDay').val(d.getDate());
            $('#arrivalMonth').val(d.getMonth() + 1);
            $('#arrivalHour').val(d.getHours());
            $('#arrivalMinute').val(d.getMinutes());
            $('#arrivalSecond').val(d.getSeconds());

            // d) Sendepunkt berechnen + UI
            const sendTime = endTime - durationInSeconds;
            this.clearTabCountdown();
            $('.sendTime').html(
              this.formatTimes(sendTime) +
              ` (<span id="sendCountdown" class="sendTimer" data-endtime="${sendTime}">-</span>)`
            );

            (window as any).Timing?.tickHandlers?.timers?.initTimers?.('sendTimer');

            // e) Auto-Send
            if (this.autoSendEnabled) this.startAutoSendObserver();

            // f) Highlight
            $commandPanel.find('td').css('background-color', '');
            $row.find('td').css('background-color', '#FFF68F');
          });

          // Standardtimer aktivieren
          $('.widget-command-timer').addClass('timer');
          (window as any).Timing?.tickHandlers?.timers?.initTimers?.('widget-command-timer');

          if (this.isAutoFlow() && $('#autoSendToggle').length && !this.autoSendEnabled) {
            this.enableAutoSendUI();
          }
        } else {
          (window as any).UI?.ErrorMessage?.('Keine Befehle gefunden');
        }

        // 7) Start-Button
        $('#startArrivalSend').off('click.ds').on('click.ds', () => {
          const heute = new Date();
          const year  = heute.getFullYear();

          const day    = parseInt(String($('#arrivalDay').val()), 10);
          const month  = parseInt(String($('#arrivalMonth').val()), 10);
          const hour   = parseInt(String($('#arrivalHour').val()), 10);
          const minute = parseInt(String($('#arrivalMinute').val()), 10);
          const second = parseInt(String($('#arrivalSecond').val()), 10);

          if ([day, month, hour, minute, second].some(x => isNaN(x))) {
            alert('Bitte alle Felder ausfüllen!');
            return;
          }

          const arrivalEpoch = Math.floor(new Date(year, month - 1, day, hour, minute, second).getTime() / 1000);

          const durationText = $commandTable
            .find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")')
            .next().text().trim();
          const [h2, m2, s2] = durationText.split(':').map((x: string) => parseInt(x, 10) || 0);
          const durationInSeconds2 = (h2||0) * 3600 + (m2||0) * 60 + (s2||0);

          const sendEpoch = arrivalEpoch - durationInSeconds2;
          if (sendEpoch < Math.floor(Date.now() / 1000)) {
            alert('Abschickzeit liegt in der Vergangenheit!');
            return;
          }
          this.scheduleSend(sendEpoch);
        });
      }
    );
  }

  private manualUpdateCountdown() {
    const $ = (window as any).jQuery;
    const heute = new Date();
    const year  = heute.getFullYear();

    let day     = parseInt(String($('#arrivalDay').val()), 10);   if (isNaN(day))   day = heute.getDate();
    let month   = parseInt(String($('#arrivalMonth').val()), 10); if (isNaN(month)) month = heute.getMonth()+1;
    const hour   = parseInt(String($('#arrivalHour').val()), 10);
    const minute = parseInt(String($('#arrivalMinute').val()), 10);
    const second = parseInt(String($('#arrivalSecond').val()), 10);
    if ([day, month, hour, minute, second].some(x => isNaN(x))) return;

    const arrivalEpoch = Math.floor(new Date(year, month - 1, day, hour, minute, second).getTime() / 1000);

    const $commandTable = $('form[action*="action=command"]').find('table').first();
    const durationText = $commandTable
      .find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")')
      .next().text().trim();
    const [h, m, s] = durationText.split(':').map((x: string) => parseInt(x, 10) || 0);
    const durationSeconds = (h||0) * 3600 + (m||0) * 60 + (s||0);

    const sendEpoch = arrivalEpoch - durationSeconds;

    this.stopAutoSendObserver();
    $('#sendCountdown').remove();

    $('.sendTime').html(
      this.formatTimes(sendEpoch) +
      ` (<span id="sendCountdown" class="sendTimer" data-endtime="${sendEpoch}">-</span>)`
    );

    (window as any).Timing?.tickHandlers?.timers?.initTimers?.('sendTimer');
    if (this.autoSendEnabled) this.startAutoSendObserver();
  }

  private scheduleSend(sendEpoch: number) {
    const $ = (window as any).jQuery;
    this.clearTabCountdown();
    $('.sendTime').html(
      this.formatTimes(sendEpoch) +
      ` (<span id="sendCountdown" class="sendTimer" data-endtime="${sendEpoch}">-</span>)`
    );
    (window as any).Timing?.tickHandlers?.timers?.initTimers?.('sendTimer');
    if (this.autoSendEnabled) this.startAutoSendObserver();
  }

  private clearTabCountdown() {
    const $ = (window as any).jQuery;
    this.stopAutoSendObserver();
    $('.sendTimer').remove();
    $('.sendTime').html('-');
    document.title = 'Stämme';
  }

  private startAutoSendObserver() {
    const $ = (window as any).jQuery;
    this.stopAutoSendObserver();
    const countdownElem = document.getElementById('sendCountdown');
    if (!countdownElem) return;

    this.autoSendObserver = new MutationObserver(() => {
      const text = (countdownElem.textContent || '').trim();
      if (this.autoSendEnabled && text === '0:00:00') {
        this.stopAutoSendObserver();
        setTimeout(() => {
          const $btn = $('#troop_confirm_submit');
          if ($btn.length && $btn.is(':visible') && !$btn.prop('disabled')) {
            $btn.click();
            this.clearTabCountdown();
          }
        }, Math.random() * (600 - 400) + 400);
      }
    });
    this.autoSendObserver.observe(countdownElem, { childList: true, characterData: true, subtree: true });
  }

  private stopAutoSendObserver() {
    this.autoSendObserver?.disconnect();
    this.autoSendObserver = null;
  }

  private async pickupArrivalFromPlanner() {
    const $ = (window as any).jQuery;
    try {
      const p = await this.ctx.storage.get<any>('pending_arrival', null);
      if (!p) return;

      // TTL 10 min
      if (!p.createdAt || (Date.now() - p.createdAt) > 10 * 60 * 1000) {
        await this.ctx.storage.set('pending_arrival', null);
        return;
      }

      // Village-Guard
      const u = new URL(location.href);
      const v = u.searchParams.get('village');
      if (p.village && v && p.village !== v) return;

      // Inputs vorhanden?
      const ok = () =>
        $('#arrivalDay').length &&
        $('#arrivalMonth').length &&
        $('#arrivalHour').length &&
        $('#arrivalMinute').length &&
        $('#arrivalSecond').length;

      let retries = 0;
      while (!ok() && retries < 100) { await new Promise(r => setTimeout(r, 100)); retries++; }
      if (!ok()) return;

      let parts = p.arrivalParts as {day:number;month:number;year?:number;hour:number;minute:number;second:number} | null;
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

      this.manualUpdateCountdown();
      await this.ctx.storage.set('pending_arrival', null);
    } catch (e) {
      console.warn('pickupArrivalFromPlanner error', e);
    }
  }

  private async persistState() {
    await this.ctx.storage.set('confirm_state', {
      autoSendEnabled: this.autoSendEnabled,
      sendTimeInit: this.sendTimeInit,
    });
  }
}
