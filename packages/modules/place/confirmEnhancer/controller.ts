// packages/modules/place/confirmEnhancer/controller.ts
import type { ModuleContext } from '../../../types/module';
import { DomApi } from './dom';
import type { ConfirmState } from './state';
import { View } from './view';

export class ConfirmController {
  private ctx: ModuleContext;
  private dom: DomApi;
  private state: { load():Promise<void>; get(): ConfirmState; set(p:Partial<ConfirmState>):Promise<void>; setAndSave(p:Partial<ConfirmState>):Promise<void>; };
  private view: View;

  private autoSendObserver: MutationObserver | null = null;
  private pageObserver: MutationObserver | null = null;

  constructor({ ctx, dom, state, view }: { ctx:ModuleContext; dom:DomApi; state:any; view:View }) {
    this.ctx = ctx; this.dom = dom; this.state = state; this.view = view;
  }

  async init() {
    await this.state.load();
    this.ensureAutoParamVisible();

    // Beobachten bis die Form da ist
    this.pageObserver = new MutationObserver(() => this.tryInitUi());
    this.pageObserver.observe(document.body, { childList: true, subtree: true });

    // Fallback-Init
    this.tryInitUi(true);
  }

  dispose() { this.stopAutoSendObserver(); this.pageObserver?.disconnect(); this.pageObserver = null; }

  // ===== Helpers (wie vorher) =====
  private isAutoFlow() {
    const u = new URL(location.href);
    const byParam = u.searchParams.get('auto') === '1';
    const bySession = sessionStorage.getItem('ds_auto_flow') === '1';
    return byParam || bySession;
  }
  private ensureAutoParamVisible() {
    if (!this.isAutoFlow()) return;
    const u = new URL(location.href);
    if (u.searchParams.get('auto') !== '1') { u.searchParams.set('auto','1'); history.replaceState(null,'',u); }
  }

  // ===== Init-Flow =====
  private tryInitUi(fallback=false, attempts=0) {
    const $ = this.dom.jQuery();
    const screenOk = ((window as any).game_data?.screen === 'map' || (window as any).game_data?.screen === 'place');
    const hasForm  = this.dom.hasCommandForm();           // robuster als #place_confirm_units
    const uiMissing = $('.sendTime').length === 0;
    const notInited = !this.state.get().sendTimeInit;

    if (screenOk && hasForm && uiMissing && notInited) {
      this.initCommandUI();
      return;
    }

    if (fallback) {
      if (attempts < 10) {
        setTimeout(()=>this.tryInitUi(true, attempts+1), 300);
      } else {
        console.warn('[DST][confirmEnhancer] konnte nicht initialisiert werden (Fallback)');
      }
    }
  }

  private initCommandUI() {
    const $ = this.dom.jQuery();
    if ($('.sendTime').length) return; // nicht doppelt

    awaitState(this.state, { sendTimeInit: true });

    // Zeilen einfügen wie früher
    this.view.appendRowsInOldOrder();
    this.view.setInitialDayMonthToToday();
    this.view.bindArrivalInputs(()=> this.manualUpdateCountdown());

    // Planner-Übernahme
    this.pickupArrivalFromPlanner().catch(()=>{});

    // DatePicker optional
    const DP = (window as any).DATEPICKER;
    if (DP && typeof DP.mount === 'function') {
      DP.mount({
        container: '#ds-date-picker',
        onApply: () => this.manualUpdateCountdown()
      });
    }

    // Auto-Toggle (native Checkbox)
    this.view.setAutoToggleChecked(this.state.get().autoSendEnabled);
    this.view.onAutoToggleChange((enabled)=> {
      this.state.setAndSave({ autoSendEnabled: enabled }).then(()=>{
        if (enabled) this.startAutoSendObserver(); else this.stopAutoSendObserver();
      });
    });

    // Auto-Flow
    if (this.isAutoFlow() && !this.state.get().autoSendEnabled) this.enableAutoSendUI();

    // Commands-Panel klonen (map/place)
    this.mountCommandsPanelFlow().catch(()=>{});
  }

  private async mountCommandsPanelFlow() {
    const $ = this.dom.jQuery();
    const href = this.dom.getVillageAnchorHref();
    if (!href) return;

    const html = await this.dom.fetchVillageHtml(href);
    const $cc  = this.dom.extractCommandsContainer(html);
    if (!$cc || $cc.length === 0) return;

    const $commandTable = this.dom.getCommandTable();
    const w = ((window as any).game_data?.screen === 'map')
      ? '100%'
      : ((document.getElementById('content_value')?.clientWidth || 0) - $commandTable.width() - 10) + 'px';

    const $panel = this.dom.mountCommandsPanel($cc, w);

    $panel.off('click.ds').on('click.ds', 'tr.command-row', (e: any) => {
      const $row = $(e.currentTarget);

      // a) Dauer lesen
      const duration = this.dom.readDurationSeconds();

      // b) Endzeit
      const endTime = parseInt($row.find('span.timer').data('endtime'), 10);
      if (isNaN(endTime) || duration === 0) {
        $('.sendTime').html('Keine gültigen Zeitdaten');
        document.getElementById('sendCountdown')?.remove();
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

      // d) Sendepunkt + UI
      const sendTime = endTime - duration;
      this.clearTabCountdown();
      this.dom.setCountdownHtml(sendTime);

      // e) Auto-Send
      if (this.state.get().autoSendEnabled) this.startAutoSendObserver();

      // f) Highlight
      $panel.find('td').css('background-color','');
      $row.find('td').css('background-color','#FFF68F');
    });

    // Safety: Auto-Flow
    if (this.isAutoFlow() && this.dom.jQuery()('#autoSendToggle').length && !this.state.get().autoSendEnabled) {
      this.enableAutoSendUI();
    }
  }

  // ===== Inputs / Countdown =====
  private manualUpdateCountdown() {
    const $ = this.dom.jQuery();
    const heute = new Date(); const year = heute.getFullYear();

    let day     = parseInt(String($('#arrivalDay').val()), 10);   if (isNaN(day))   day = heute.getDate();
    let month   = parseInt(String($('#arrivalMonth').val()), 10); if (isNaN(month)) month = heute.getMonth()+1;
    const hour   = parseInt(String($('#arrivalHour').val()), 10);
    const minute = parseInt(String($('#arrivalMinute').val()), 10);
    const second = parseInt(String($('#arrivalSecond').val()), 10);
    if ([day, month, hour, minute, second].some(x => isNaN(x))) return;

    const arrivalEpoch = Math.floor(new Date(year, month - 1, day, hour, minute, second).getTime()/1000);
    const duration = this.dom.readDurationSeconds();
    const sendEpoch = arrivalEpoch - duration;

    this.stopAutoSendObserver();
    document.getElementById('sendCountdown')?.remove();

    this.dom.setCountdownHtml(sendEpoch);
    if (this.state.get().autoSendEnabled) this.startAutoSendObserver();
  }

  private scheduleSend(sendEpoch: number) {
    this.clearTabCountdown();
    this.dom.setCountdownHtml(sendEpoch);
    if (this.state.get().autoSendEnabled) this.startAutoSendObserver();
  }

  private clearTabCountdown() {
    this.stopAutoSendObserver();
    this.dom.clearCountdownHtml();
  }

  private startAutoSendObserver() {
    this.stopAutoSendObserver();
    const el = document.getElementById('sendCountdown');
    if (!el) return;

    this.autoSendObserver = new MutationObserver(() => {
      const text = (el.textContent || '').trim();
      if (this.state.get().autoSendEnabled && text === '0:00:00') {
        this.stopAutoSendObserver();
        setTimeout(() => {
          const $btn = this.dom.jQuery()('#troop_confirm_submit');
          if ($btn.length && $btn.is(':visible') && !$btn.prop('disabled')) {
            $btn.click(); this.clearTabCountdown();
          }
        }, Math.random()*(600-400)+400);
      }
    });
    this.autoSendObserver.observe(el, { childList: true, characterData: true, subtree: true });
  }

  private stopAutoSendObserver() { this.autoSendObserver?.disconnect(); this.autoSendObserver=null; }

  private async pickupArrivalFromPlanner() {
    try {
      const p = await this.ctx.storage.get<any>('pending_arrival', null);
      if (!p) return;

      if (!p.createdAt || (Date.now() - p.createdAt) > 10 * 60 * 1000) {
        await this.ctx.storage.set('pending_arrival', null);
        return;
      }

      const u = new URL(location.href);
      const v = u.searchParams.get('village');
      if (p.village && v && p.village !== v) return;

      const ok = () =>
        !!document.getElementById('arrivalDay') &&
        !!document.getElementById('arrivalMonth') &&
        !!document.getElementById('arrivalHour') &&
        !!document.getElementById('arrivalMinute') &&
        !!document.getElementById('arrivalSecond');

      let retries = 0;
      while (!ok() && retries < 100) { await new Promise(r => setTimeout(r, 100)); retries++; }
      if (!ok()) return;

      let parts = p.arrivalParts as {day:number;month:number;year?:number;hour:number;minute:number;second:number} | null;
      if (!parts) {
        const m = (p.arrivalStr || '').match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
        if (m) parts = { day:+m[1], month:+m[2], year:+m[3], hour:+m[4], minute:+m[5], second:+m[6] };
      }
      if (!parts) return;

      (document.getElementById('arrivalDay')    as HTMLInputElement).value = String(parts.day);
      (document.getElementById('arrivalMonth')  as HTMLInputElement).value = String(parts.month);
      (document.getElementById('arrivalHour')   as HTMLInputElement).value = String(parts.hour);
      (document.getElementById('arrivalMinute') as HTMLInputElement).value = String(parts.minute);
      (document.getElementById('arrivalSecond') as HTMLInputElement).value = String(parts.second);

      this.manualUpdateCountdown();
      await this.ctx.storage.set('pending_arrival', null);
    } catch (e) {
      console.warn('pickupArrivalFromPlanner error', e);
    }
  }

  private enableAutoSendUI() {
    this.state.setAndSave({ autoSendEnabled: true });
    this.view.setAutoToggleChecked(true);
    this.startAutoSendObserver();
  }
}

async function awaitState(state: any, patch: any) {
  await state.set(patch);
}
