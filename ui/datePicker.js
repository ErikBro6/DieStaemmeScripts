// Lightweight Date+Time Picker, der die vorhandenen arrival*-Felder synced.
window.DATEPICKER = (function () {
  function fmt2(n) { return n < 10 ? "0"+n : ""+n; }
  function toDateInputValue(d) {
    return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}`;
  }
  function toTimeInputValue(d) {
    return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}:${fmt2(d.getSeconds())}`;
  }
  function fromInputs(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const [Y,M,D] = dateStr.split("-").map(x => parseInt(x,10));
    const [h,m,s] = timeStr.split(":").map(x => parseInt(x,10));
    if ([Y,M,D,h,m].some(Number.isNaN)) return null;
    return new Date(Y, M-1, D, h, m, isNaN(s)?0:s);
  }

  async function mount({ container, onApply }) {
    const host = (typeof container === "string") ? document.querySelector(container) : container;
    if (!host) return;

    // CSS (optional: direkt hier referenzieren, sonst Manifest lädt es separat)
    // nichts zu tun, wenn deine Loader-Strategie CSS nicht auto-lädt.

    // UI bauen
    const wrap = document.createElement("div");
    wrap.className = "ds-dp";

    wrap.innerHTML = `
      <label>Datum</label>
      <input id="dsDate" type="date">
      <label>Uhrzeit</label>
      <input id="dsTime" type="time" step="1">
      <button class="apply" type="button">Übernehmen</button>
    `;
    host.appendChild(wrap);

    const iDate = wrap.querySelector("#dsDate");
    const iTime = wrap.querySelector("#dsTime");
    const btn   = wrap.querySelector(".apply");

    // Initialwerte aus bestehenden arrival*-Feldern
    const day   = parseInt($("#arrivalDay").val(), 10);
    const month = parseInt($("#arrivalMonth").val(), 10);
    const hour  = parseInt($("#arrivalHour").val(), 10);
    const min   = parseInt($("#arrivalMinute").val(), 10);
    const sec   = parseInt($("#arrivalSecond").val(), 10);
    const now   = new Date();
    const base  = new Date(
      now.getFullYear(),
      Number.isNaN(month)? now.getMonth() : month-1,
      Number.isNaN(day)?   now.getDate()  : day,
      Number.isNaN(hour)?  0 : hour,
      Number.isNaN(min)?   0 : min,
      Number.isNaN(sec)?   0 : sec
    );

    iDate.value = toDateInputValue(base);
    iTime.value = toTimeInputValue(base);

    // Apply → schreibe zurück in arrival*-Felder
    btn.addEventListener("click", () => {
      const dt = fromInputs(iDate.value, iTime.value);
      if (!dt) return;
      $("#arrivalDay").val(dt.getDate());
      $("#arrivalMonth").val(dt.getMonth()+1);
      $("#arrivalHour").val(dt.getHours());
      $("#arrivalMinute").val(dt.getMinutes());
      $("#arrivalSecond").val(dt.getSeconds());
      if (typeof onApply === "function") onApply(dt);
    });

    // Einweg-Sync (wenn Textfelder sich ändern, aktualisiere Date/Time UI)
    const syncFromLegacy = () => {
      const d  = parseInt($("#arrivalDay").val(), 10);
      const mo = parseInt($("#arrivalMonth").val(), 10);
      const h  = parseInt($("#arrivalHour").val(), 10);
      const mi = parseInt($("#arrivalMinute").val(), 10);
      const s  = parseInt($("#arrivalSecond").val(), 10);
      const now = new Date();
      const dt = new Date(
        now.getFullYear(),
        Number.isNaN(mo) ? now.getMonth() : mo-1,
        Number.isNaN(d)  ? now.getDate()  : d,
        Number.isNaN(h)  ? 0 : h,
        Number.isNaN(mi) ? 0 : mi,
        Number.isNaN(s)  ? 0 : s
      );
      iDate.value = toDateInputValue(dt);
      iTime.value = toTimeInputValue(dt);
    };

    $("#arrivalDay, #arrivalMonth, #arrivalHour, #arrivalMinute, #arrivalSecond")
      .off("change.dsdp").on("change.dsdp", syncFromLegacy);
  }

  return { mount };
})();
