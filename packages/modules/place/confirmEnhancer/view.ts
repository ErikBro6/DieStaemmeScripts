// packages/modules/place/confirmEnhancer/view.ts
export class View {
  private $: any;
  constructor($: any) { this.$ = $; }

  /** Fügt die Zeilen in exakt der alten Reihenfolge ein */
  appendRowsInOldOrder() {
    const $ = this.$;
    const $commandTable = $('form[action*="action=command"]').find('table').first();

    // 1) Abschick Counter
    $commandTable.css('float','left').find('tr').last()
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

    // 3) DatePicker Slot
    $commandTable.find('tr').last().after(`
      <tr>
        <td style="white-space: nowrap;">Datum/ <br> Uhrzeit:</td>
        <td><div id="ds-date-picker"></div></td>
      </tr>
    `);

    // 4) Auto-Senden Checkbox (ohne UI_LIB)
    $commandTable.find('tr').last().after(`
      <tr>
        <td style="white-space: nowrap;">Automatisch <br> abschicken:</td>
        <td style="white-space: nowrap;">
          <label>
            <input type="checkbox" id="autoSendToggle" />
            <span>Automatik</span>
          </label>
        </td>
      </tr>
    `);
  }

  setInitialDayMonthToToday() {
    const $ = this.$;
    const now = new Date();
    $('#arrivalDay').val(now.getDate());
    $('#arrivalMonth').val(now.getMonth()+1);
  }

  bindArrivalInputs(onChange: ()=>void) {
    this.$('#arrivalDay, #arrivalMonth, #arrivalHour, #arrivalMinute, #arrivalSecond')
      .off('change.ds')
      .on('change.ds', onChange);
  }

  /** Toggle Wert setzen/lesen */
  setAutoToggleChecked(checked: boolean) {
    const el = document.getElementById('autoSendToggle') as HTMLInputElement | null;
    if (el) el.checked = checked;
  }
  getAutoToggleChecked(): boolean {
    const el = document.getElementById('autoSendToggle') as HTMLInputElement | null;
    return !!el?.checked;
  }
  onAutoToggleChange(handler: (checked:boolean)=>void) {
    const el = document.getElementById('autoSendToggle') as HTMLInputElement | null;
    if (!el) return;
    el.removeEventListener('change', this._autoToggleListener as any);
    const fn = () => handler(!!el.checked);
    el.addEventListener('change', fn);
    (this as any)._autoToggleListener = fn;
  }
}
