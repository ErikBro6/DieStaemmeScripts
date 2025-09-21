// packages/modules/place/confirmEnhancer/dom.ts
export class DomApi {
  private doc: Document;
  private $: any;

  constructor(doc: Document) {
    this.doc = doc;
    this.$ = (window as any).jQuery;
  }

  isVisible($el: any) { return $el && $el.length > 0 && $el.is(':visible'); }

  hasConfirmSection() { return this.$('#place_confirm_units').length > 0; }
  findConfirmSubmit() { return this.$('#troop_confirm_submit'); }
  getCommandTable()   { return this.$('form[action*="action=command"]').find('table').first(); }

  /** Neu: existiert die Command-Form überhaupt? (robuster als #place_confirm_units) */
  hasCommandForm(): boolean {
    return this.$('form[action*="action=command"]').length > 0;
  }

  readDurationSeconds(): number {
    const $t = this.getCommandTable();
    const txt = $t.find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")').next().text().trim();
    const [h, m, s] = txt.split(':').map((x: string) => parseInt(x, 10) || 0);
    return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
  }

  setCountdownHtml(epoch: number) {
    this.$('.sendTime').html(
      this.formatTimes(epoch) +
      ` (<span id="sendCountdown" class="sendTimer" data-endtime="${epoch}">-</span>)`
    );
    (window as any).Timing?.tickHandlers?.timers?.initTimers?.('sendTimer');
  }

  clearCountdownHtml() {
    this.$('.sendTimer').remove();
    this.$('.sendTime').html('-');
    this.doc.title = 'Stämme';
  }

  formatTimes(epoch: number) {
    const z = (n:number)=> (n<10?'0':'')+n;
    const d = new Date(epoch*1000);
    return `${z(d.getDate())}.${z(d.getMonth()+1)} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
  }

  // Panel-HTML laden/klonen
  getVillageAnchorHref(): string | null {
    const a = this.$('.village_anchor').first().find('a').first().attr('href');
    return a || null;
  }

  fetchVillageHtml(href: string): Promise<string> {
    return new Promise((resolve,reject)=>{
      this.$.get(href, (html:string)=>resolve(html)).fail((e:any)=>reject(e));
    });
  }

  extractCommandsContainer(html: string) {
    return (this.$(html).find('.commands-container') as any);
  }

  mountCommandsPanel($cc: any, width: string) {
    const $commandTable = this.getCommandTable();
    const $panel = this.$('<div id="command-panel"></div>').css({
      'float': 'right', 'width': width, 'display': 'block',
      'max-height': $commandTable.height(), 'overflow': 'scroll'
    });
    const $cloned = $cc.find('table').clone();
    $panel.append($cloned).append('<br><div style="clear:both;"></div>');
    $commandTable.closest('table').after($panel);

    // Rückkehr-Befehle entfernen
    $panel.find('tr.command-row').filter(function (this: any) {
      return (window as any).jQuery(this).find('img[src*="/return_"], img[src*="/back.png"]').length > 0;
    }).remove();

    // Standardtimer aktivieren
    this.$('.widget-command-timer').addClass('timer');
    (window as any).Timing?.tickHandlers?.timers?.initTimers?.('widget-command-timer');

    return $panel;
  }

  jQuery() { return this.$; }
}
