// ==UserScript Module==
// Läuft NUR auf place&mode=call, UI via Hotkey "s"

(function () {
  "use strict";

  // --- Seite prüfen: nur place&mode=call ---
  const sp = new URL(location.href).searchParams;
  const IS_CALL_PAGE = sp.get("screen") === "place" && sp.get("mode") === "call";
  if (!IS_CALL_PAGE) return;

  // ---------------------------------------------------------------------------
  // Basis-Variablen
  // ---------------------------------------------------------------------------
  const LOG = "[DS-Tools][MassSupporter]";
  const localStorageThemeName = "supportSenderTheme";

  let heavyCav = 4;
  let units = game_data.units.slice().filter(v => v !== "snob" && v !== "militia" && v !== "knight");

  // Theme Defaults (werden ggf. überschrieben)
  const headerColorDarken = -50;
  const headerColorAlternateHover = 30;
  const headerWood = "#001a33";
  const headerWoodEven = "#002e5a";
  const headerStone = "#3b3b00";
  const headerStoneEven = "#626200";
  const headerIron = "#1e003b";
  const headerIronEven = "#3c0076";
  let textColor = "#ffffff";
  let backgroundInput = "#000000";
  let borderColor = "#C5979D";
  let backgroundContainer = "#2B193D";
  let backgroundHeader = "#2C365E";
  let backgroundMainTable = "#484D6D";
  let backgroundInnerTable = "#4B8F8C";
  let widthInterface = 50;
  const headerColorAlternateTable = -30;
  let backgroundAlternateTableEven = backgroundContainer;
  let backgroundAlternateTableOdd = getColorDarker(backgroundContainer, headerColorAlternateTable);

  const defaultTheme = '[["theme1",["#E0E0E0","#000000","#C5979D","#2B193D","#2C365E","#484D6D","#4B8F8C","50"]],["currentTheme","theme1"],["theme2",["#E0E0E0","#000000","#F76F8E","#113537","#37505C","#445552","#294D4A","50"]],["theme3",["#E0E0E0","#000000","#ACFCD9","#190933","#665687","#7C77B9","#623B5A","50"]],["theme4",["#E0E0E0","#000000","#181F1C","#60712F","#274029","#315C2B","#214F4B","50"]],["theme5",["#E0E0E0","#000000","#9AD1D4","#007EA7","#003249","#1F5673","#1C448E","50"]],["theme6",["#E0E0E0","#000000","#EA8C55","#81171B","#540804","#710627","#9E1946","50"]],["theme7",["#E0E0E0","#000000","#754043","#37423D","#171614","#3A2618","#523A34","50"]],["theme8",["#E0E0E0","#000000","#9E0031","#8E0045","#44001A","#600047","#770058","50"]],["theme9",["#E0E0E0","#000000","#C1BDB3","#5F5B6B","#323031","#3D3B3C","#575366","50"]],["theme10",["#E0E0E0","#000000","#E6BCCD","#29274C","#012A36","#14453D","#7E52A0","50"]]]';

  function getPreferredWidth(){
    try {
      const raw = localStorage.getItem(localStorageThemeName);
      if (raw) {
        const mapTheme = new Map(JSON.parse(raw));
        const current = mapTheme.get("currentTheme");
        const colours = mapTheme.get(current);
        const w = Number(colours?.[7]);
        if (Number.isFinite(w) && w > 0) return w;
      }
    } catch {}
    return 50;
  }

  // ---------------------------
  // Hotkey-Bind nur auf Call-Seite
  // ---------------------------
  (function setupMassSupporterHotkey() {
    if (window.__ds_ms_hotkey_bound) return;
    window.__ds_ms_hotkey_bound = true;
    console.info(LOG, "Hotkey bound on call page.");

    window.dsMsDebugStart = function () {
      try {
        if (!document.getElementById("div_container")) {
          console.info(LOG, "manual start main()");
          main();
        } else {
          console.info(LOG, "UI already open");
        }
      } catch (err) {
        console.error(LOG, "main() crashed:", err);
        window.UI?.ErrorMessage?.("MassSupporter Fehler – Details in der Konsole.");
      }
    };

    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = (e.key || "").toLowerCase();
      const isS = key === "s" || e.code === "KeyS" || e.which === 83;
      if (!isS) return;

      console.info(LOG, "'s' pressed");
      try { document.activeElement?.blur?.(); } catch {}

      e.preventDefault();
      e.stopPropagation();

      if (!document.getElementById("div_container")) {
        try { main(); } catch (err) {
          console.error(LOG, "main() crashed:", err);
          window.UI?.ErrorMessage?.("MassSupporter Fehler – Details in der Konsole.");
        }
      }
    }

    document.addEventListener("keydown", onKey, { capture: true });
    document.addEventListener("keypress", onKey, { capture: true });
  })();

  // ---------------------------
  // Utils
  // ---------------------------
  function getColorDarker(hexInput, percent) {
    let hex = hexInput.replace(/^\s*#|\s*$/g, "");
    if (hex.length === 3) hex = hex.replace(/(.)/g, "$1$1");
    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);
    const p = (100 + percent) / 100;
    r = Math.round(Math.min(255, Math.max(0, r * p)));
    g = Math.round(Math.min(255, Math.max(0, g * p)));
    b = Math.round(Math.min(255, Math.max(0, b * p)));
    return `#${("00"+r.toString(16)).slice(-2).toUpperCase()}${("00"+g.toString(16)).slice(-2).toUpperCase()}${("00"+b.toString(16)).slice(-2).toUpperCase()}`;
  }

  function padZero(str, len = 2) {
    const zeros = "0".repeat(len);
    return (zeros + String(str)).slice(-len);
  }
  function invertColor(hex) {
    if (hex[0] === "#") hex = hex.slice(1);
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
    if (hex.length !== 6) throw new Error("Invalid HEX color.");
    const r = padZero((255 - parseInt(hex.slice(0,2),16)).toString(16));
    const g = padZero((255 - parseInt(hex.slice(2,4),16)).toString(16));
    const b = padZero((255 - parseInt(hex.slice(4,6),16)).toString(16));
    return `#${r}${g}${b}`;
  }

  function httpGet(theUrl) {
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", theUrl, false); // sync
    try { xmlHttp.send(null); } catch { return ""; }
    return xmlHttp.responseText || "";
  }

  function calcDistance(coord1,coord2){
    let x1=parseInt(coord1.split("|")[0],10);
    let y1=parseInt(coord1.split("|")[1],10);
    let x2=parseInt(coord2.split("|")[0],10);
    let y2=parseInt(coord2.split("|")[1],10);
    return Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
  }

  function getSpeedConstant() {
    const k = game_data.world+"speedWorld";
    const cached = localStorage.getItem(k);
    if (cached) return JSON.parse(cached);
    const data = httpGet("/interface.php?func=get_config");
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(data, "text/html");
    const obj = {
      worldSpeed: Number(htmlDoc.getElementsByTagName("speed")[0]?.innerHTML || 1),
      unitSpeed:  Number(htmlDoc.getElementsByTagName("unit_speed")[0]?.innerHTML || 1),
    };
    localStorage.setItem(k, JSON.stringify(obj));
    return obj;
  }

  function initializationTheme() {
    if (localStorage.getItem(localStorageThemeName) === undefined) {
      localStorage.setItem(localStorageThemeName, defaultTheme);
    }
    const mapTheme = new Map(JSON.parse(localStorage.getItem(localStorageThemeName)));
    const current = mapTheme.get("currentTheme");
    const colours = mapTheme.get(current);
    textColor = colours[0];
    backgroundInput = colours[1];
    borderColor = colours[2];
    backgroundContainer = colours[3];
    backgroundHeader = colours[4];
    backgroundMainTable = colours[5];
    backgroundInnerTable = colours[6];
    widthInterface = colours[7];
    if (game_data.device !== "desktop") widthInterface = 98;
    backgroundAlternateTableEven = backgroundContainer;
    backgroundAlternateTableOdd = getColorDarker(backgroundContainer, headerColorAlternateTable);
  }

  function buildThemeObject() {
    return {
      textColor,
      backgroundInput,
      borderColor,
      backgroundContainer,
      backgroundHeader,
      backgroundMainTable,
      backgroundInnerTable,
      backgroundAlternateTableOdd,
      backgroundAlternateTableEven,
      widthInterface,
      headerColorAlternateTable,
      headerColorAlternateHover: 30,
      headerColorDarken: -50,
      headerWood,
      headerWoodEven,
      headerStone,
      headerStoneEven,
      headerIron,
      headerIronEven,
      getColorDarker,
      invertColor,
      padZero,
    };
  }

  // ---------------------------------------------------------------------------
  // Eingebaute Styles (vormals ui/massSupportStyle.js)
  // ---------------------------------------------------------------------------
  function DS_addCssStyle(theme) {
    const g = theme;
    const cssStyle = `
    .scriptContainer{
      width:${g.widthInterface}%;
      background:${g.backgroundContainer};
      aspect-ratio:100 / 29;
      cursor:move;
      z-index:50;
      border-radius:15px;
      border-style:solid;
      border-width:5px 5px;
      border-color:${g.backgroundHeader};
    }
    .scriptHeader{
      color:${g.textColor};
      background:${g.backgroundHeader};
      width:100%;
      margin:0 auto;
      display:flex;
      justify-content:center;
      align-items:center;
    }
    .scriptFooter{
      color:${g.textColor};
      background:${g.backgroundHeader};
      width:100%;
      margin:0 auto;
      display:flex;
      justify-content:right;
      align-items:center;
      margin-right:50px;
    }
    .scriptTable{
      position:relative;width:95%;border-collapse:collapse;table-layout:fixed;
      margin:20px auto;
    }
    .scriptTable td{
      width:auto;overflow:hidden;text-overflow:ellipsis;
      border:1px solid ${g.borderColor};padding:10px;text-align:center;color:${g.textColor};word-wrap:break-word;
    }
    .scriptTable tr:nth-child(odd){background:${g.getColorDarker(g.backgroundMainTable, g.headerColorAlternateTable)};}
    .scriptTable tr:nth-child(even){background:${g.backgroundMainTable};}
    .scriptTable tr:first-child{
      border:1px solid ${g.borderColor};padding:15px;text-align:center;color:${g.textColor};
      background:${g.getColorDarker(g.backgroundMainTable, g.headerColorDarken)};
    }
    .scriptTable tr:not(:first-child):hover{
      background-color:${g.getColorDarker(g.backgroundMainTable, g.headerColorAlternateHover)};
    }
    input[type="text"]:disabled{
      background:${g.getColorDarker(g.invertColor(g.textColor),50)};
      text-align:center;
    }`;
    const head = document.head || document.getElementsByTagName("head")[0];
    const style = document.createElement("style");
    style.type = "text/css";
    if (style.styleSheet) style.styleSheet.cssText = cssStyle;
    else style.appendChild(document.createTextNode(cssStyle));
    head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // MAIN
  // ---------------------------------------------------------------------------
  async function main() {
    initializationTheme();
    // Styles aus Theme direkt injizieren (kein externes Laden)
    DS_addCssStyle(buildThemeObject());
    createMainInterface();
    addEvents();
  }

  function createMainInterface() {
    const uiWidth = getPreferredWidth();
    const rowsSpawnDatetimes = (game_data.units.includes("archer") ? 4 : 3);

    let html = `
    <div id="div_container" class="scriptContainer" style="z-index:99999;width:${uiWidth}%;position:fixed;">
      <div class="scriptHeader" style="background:${backgroundHeader};color:${textColor};position:relative;padding:8px 10px;border:1px solid ${borderColor};border-bottom:0;">
        <div style="margin-top:2px;"><h2 style="margin:0;font-size:16px;">Support sender</h2></div>
        <div style="position:absolute;top:8px;right: 8px;">
          <a href="#" id="btn_close_ui" title="Schließen">✖</a>
        </div>
        <div style="position:absolute;top:8px;right: 34px;">
          <a href="#" id="btn_minimize_ui" title="Minimieren">▁</a>
        </div>
        <div style="position:absolute;top:8px;right: 60px;">
          <a href="#" id="btn_toggle_theme" title="Theme">⚙</a>
        </div>
      </div>

      <div id="theme_settings" style="display:none;background:${backgroundInnerTable};border:1px solid ${borderColor};border-top:0;padding:6px;color:${textColor};"></div>

      <div id="div_body" style="background:${backgroundMainTable};border:1px solid ${borderColor};border-top:0;padding:6px;">
        <table id="table_upload" class="scriptTable" style="width:100%;color:${textColor};">
          <tr>
            <td>troops</td>
            ${units.filter(u => !["axe","light","ram","catapult","marcher"].includes(u)).map(u =>
              `<td class="fm_unit"><img src="https://dsen.innogamescdn.com/asset/1d2499b/graphic/unit/unit_${u}.png"></td>`
            ).join("")}
            <td>pop</td>
          </tr>
          <tr id="totalTroops">
            <td>total</td>
            ${units.filter(u => !["axe","light","ram","catapult","marcher"].includes(u)).map(u =>
              `<td><input id="${u}total" value="0" type="text" class="totalTroops scriptInput" disabled></td>`
            ).join("")}
            <td><input id="packets_total" value="0" type="text" class="scriptInput" disabled></td>
          </tr>
          <tr id="sendTroops">
            <td>send</td>
            ${units.filter(u => !["axe","light","ram","catapult","marcher"].includes(u)).map(u =>
              `<td><input id="${u}send" value="0" type="number" class="scriptInput sendTroops"></td>`
            ).join("")}
            <td><input id="packets_send" value="0" type="number" class="scriptInput"></td>
          </tr>
          <tr id="reserveTroops">
            <td>reserve</td>
            ${units.filter(u => !["axe","light","ram","catapult","marcher"].includes(u)).map(u =>
              `<td><input id="${u}Reserve" value="0" type="number" class="scriptInput reserveTroops"></td>`
            ).join("")}
            <td><input id="packets_reserve" value="0" type="text" class="scriptInput" disabled></td>
          </tr>

          <tr>
            <td colspan="1">
              <center><span>sigil:</span> <input type="number" id="flag_boost" class="scriptInput" min="0" max="100" placeholder="0" value="0" style="text-align:center"></center>
            </td>
            <td colspan="2">
              <center><input type="checkbox" id="checkbox_window" value="land_specific"><span> packets land between:</span></center>
            </td>
            <td colspan="${rowsSpawnDatetimes}">
              <center style="margin:5px">start: <input type="datetime-local" id="start_window" style="text-align:center;"></center>
              <center style="margin:5px">end: <input type="datetime-local" id="stop_window" style="text-align:center;"></center>
            </td>
          </tr>

          <tr>
            <td colspan="6">
              <button type="button" class="btn evt-confirm-btn btn-confirm-yes" id="btn_fill_inputs">Fill inputs</button>
              <button type="button" class="btn evt-confirm-btn btn-confirm-yes" id="btn_calculate">Calculate</button>
            </td>
          </tr>
        </table>
      </div>

      <div class="scriptFooter" style="background:${backgroundHeader};color:${textColor};border:1px solid ${borderColor};border-top:0;padding:6px;">
        <div style="margin-top:2px;"><h5 style="margin:0;">made by Costache</h5></div>
      </div>
    </div>`;

    $("#div_container").remove();
    $("#contentContainer, #mobileContent").eq(0).prepend(html);

    if ($.fn?.draggable) $("#div_container").draggable();

    $("#btn_close_ui").on("click", (e) => { e.preventDefault(); $("#div_container").remove(); });
    $("#btn_minimize_ui").on("click", (e) => {
      e.preventDefault();
      const body = $("#div_body");
      const isHidden = !body.is(":visible");
      if (isHidden) {
        $('#div_container').css({ width: `${uiWidth}%` });
        body.show();
      } else {
        $('#div_container').css({ width: '10%' });
        body.hide();
      }
    });
    $("#btn_toggle_theme").on("click", (e) => { e.preventDefault(); $("#theme_settings").toggle(); });

    if (game_data.device !== "desktop") {
      $("#table_upload").find("input[type=text]").css("width","100%");
    }

    // Startwerte berechnen
    countTotalTroops();
  }

  // ---------------------------
  // Events
  // ---------------------------
  function addEvents() {
    // sendTroops -> packets_send
    $('.sendTroops').off('input').on('input', function () {
      let totalPop = 0;
      $('.sendTroops').each(function () {
        const id = this.id;
        const v = this.value === "" ? 0 : parseFloat(this.value);
        if (/(spear|sword|archer)send$/.test(id)) totalPop += v * 1000;
        if (/heavysend$/.test(id)) totalPop += v * 1000 * heavyCav;
      });
      $('#packets_send').val((totalPop/1000).toFixed(2));
    });

    // packets_send -> Verteilung
    $('#packets_send').off('input').on('input', function () {
      const needTroops = parseFloat(this.value);
      const totalPop = parseFloat($('#packets_total').val());
      const ratio = (isFinite(needTroops/totalPop) ? needTroops/totalPop : 0);

      const totals = $('.totalTroops');
      const sends  = $('.sendTroops');

      for (let i=0; i<totals.length; i++) {
        const send = sends[i];
        const total = parseFloat(totals[i].value) || 0;
        if (!/spy/.test(send.id)) {
          send.value = Math.round(total * ratio * 100) / 100;
        } else {
          send.value = 0;
        }
      }
    });

    // Buttons
    $('#btn_calculate').off('click').on('click', countTotalTroops);
    $('#btn_fill_inputs').off('click').on('click', fillInputs);
  }

  // ---------------------------
  // Kernlogik
  // ---------------------------
  function countTotalTroops(){
    let dateStart = new Date();
    let dateStop = new Date();
    dateStart.setFullYear(dateStart.getFullYear()-1);
    dateStop.setFullYear(dateStop.getFullYear()+1);

    let sigil = 0;
    const timeWindow = document.getElementById("checkbox_window")?.checked;
    if(timeWindow){
      dateStart = new Date(document.getElementById("start_window").value);
      dateStop = new Date(document.getElementById("stop_window").value);
      sigil = parseInt(document.getElementById("flag_boost").value);
      if (dateStart.toString() === "Invalid Date") window.UI?.ErrorMessage?.("start date has an invalid format",2000);
      if (dateStop.toString() === "Invalid Date") window.UI?.ErrorMessage?.("stop date has an invalid format",2000);
      sigil = (Number.isNaN(sigil) ? 0 : sigil);
    }

    const mapVillages = new Map();
    let coordDestination;

    if (game_data.device === "desktop") {
      coordDestination = $(".village-name").text().match(/\d+\|\d+/)[0];
    } else {
      coordDestination = $("#inputx").val() + "|" + $("#inputy").val();
    }

    const { worldSpeed, unitSpeed } = getSpeedConstant();
    const speedTroop = {
      snob:     2100 * 1000 / (worldSpeed * unitSpeed),
      ram:      1800 * 1000 / (worldSpeed * unitSpeed),
      catapult: 1800 * 1000 / (worldSpeed * unitSpeed),
      sword:    1320 * 1000 / (worldSpeed * unitSpeed),
      axe:      1080 * 1000 / (worldSpeed * unitSpeed),
      spear:    1080 * 1000 / (worldSpeed * unitSpeed),
      archer:   1080 * 1000 / (worldSpeed * unitSpeed),
      heavy:     660 * 1000 / (worldSpeed * unitSpeed),
      light:     600 * 1000 / (worldSpeed * unitSpeed),
      marcher:   600 * 1000 / (worldSpeed * unitSpeed),
      knight:    600 * 1000 / (worldSpeed * unitSpeed),
      spy:       540 * 1000 / (worldSpeed * unitSpeed),
    };

    Array.from($("#village_troup_list tbody tr")).forEach(row => {
      const coord = row.children[0].innerText.match(/\d+\|\d+/)[0];
      const distance = calcDistance(coord, coordDestination);
      const objTroops = { distance };

      units.forEach(troopName => {
        let totalTroops = parseInt($(row).find(`[data-unit='${troopName}']`).text());
        let reserveTroops = parseFloat($(`#${troopName}Reserve`).val());
        reserveTroops = (reserveTroops == undefined || Number.isNaN(reserveTroops)) ? 0 : reserveTroops*1000;
        totalTroops = (totalTroops > reserveTroops) ? totalTroops - reserveTroops : 0;

        let timeTroop = speedTroop[troopName] * distance; // ms
        timeTroop = timeTroop / (1 + sigil / 100.0);

        const serverTime = document.getElementById("serverTime").innerText;
        let serverDate = document.getElementById("serverDate").innerText.split("/");
        serverDate = serverDate[1]+"/"+serverDate[0]+"/"+serverDate[2];
        let date_current = new Date(serverDate+" "+serverTime);
        date_current = new Date(date_current.getTime() + timeTroop);

        if(totalTroops > 0 && dateStart.getTime() < date_current.getTime() && date_current.getTime() < dateStop.getTime()){
          objTroops[troopName+"_speed"] = troopName;
        }
        objTroops[troopName] = totalTroops;

        if(timeWindow == false){
          delete objTroops.ram; delete objTroops.catapult;
          delete objTroops.ram_speed; delete objTroops.catapult_speed;
        }
      });

      mapVillages.set(coord, objTroops);
    });

    const objTroopsTotal = { spear:0, sword:0, archer:0, spy:0, heavy:0, totalPop:0 };

    Array.from(mapVillages.keys()).forEach(key => {
      const obj = mapVillages.get(key);
      if(obj["ram_speed"] || obj["catapult_speed"] || obj["sword_speed"]){
        objTroopsTotal.spear += obj.spear;
        objTroopsTotal.sword += obj.sword;
        objTroopsTotal.spy   += obj.spy;
        objTroopsTotal.heavy += obj.heavy;
        if(obj.archer != undefined) objTroopsTotal.archer += obj.archer;
      } else if (obj["spear_speed"] || obj["archer_speed"]) {
        objTroopsTotal.spear += obj.spear;
        objTroopsTotal.heavy += obj.heavy;
        objTroopsTotal.spy   += obj.spy;
        if(obj.archer != undefined) objTroopsTotal.archer += obj.archer;
      } else if (obj["heavy_speed"]) {
        objTroopsTotal.heavy += obj.heavy;
        objTroopsTotal.spy   += obj.spy;
      } else if (obj["spy_speed"]) {
        objTroopsTotal.spy += obj.spy;
      }
    });

    if(!game_data.units.includes("archer")) delete objTroopsTotal.archer;

    let totalPop = 0;
    Object.keys(objTroopsTotal).forEach(key=>{
      if(["spear","sword","archer","spy","heavy"].includes(key) && units.includes(key)) {
        document.getElementById(key+"total").value = (objTroopsTotal[key]/1000).toFixed(2);
      }
      if(["spear","sword","archer"].includes(key)) totalPop += objTroopsTotal[key];
      else if(key === "heavy") totalPop += objTroopsTotal[key]*heavyCav;
    });

    document.getElementById("packets_total").value = (totalPop/1000).toFixed(2);
    addEvents();
    return mapVillages;
  }

  function fillInputs(){
    const mapVillages = countTotalTroops();
    const troopsTotal = Array.from(document.getElementsByClassName("totalTroops")).map(e=>parseFloat(e.value) * 1000);

    const sendTotal = Array.from(document.getElementsByClassName("sendTroops")).map(e => ({
      value: (Number.isNaN(parseFloat(e.value) * 1000) ? 0 : parseFloat(e.value) * 1000),
      troopName: e.id.replace("send", "")
    }));

    const sendTotalObj = {};
    sendTotal.forEach(e => sendTotalObj[e.troopName] = e.value);

    for(let i=0;i<troopsTotal.length && i<sendTotal.length;i++){
      if(troopsTotal[i] < sendTotal[i].value){
        alert("wrong input\n not enough troops");
        return;
      }
    }

    const checkbox = document.getElementById("village_troup_list").children[0].children[0].getElementsByTagName("input");
    for(let i=0;i<checkbox.length-1;i++){
      const id = checkbox[i].id.split("_")[1];
      const troops = ["spear","sword","archer","spy","heavy","ram","catapult"];
      checkbox[i].checked = troops.includes(id);
    }
    document.getElementById("place_call_select_all").click();
    $("#village_troup_list").find("input[type=number]:visible").val(0);

    const listTotal = [];
    Array.from(mapVillages.keys()).forEach(key=>{
      const obj = mapVillages.get(key);
      const t = { coord:key };

      if(obj.ram_speed != undefined){
        t.ram = 1; t.catapult = 0;
        t.sword = (sendTotalObj["sword"]  > 0) ? obj.sword  : 0;
        t.spear = (sendTotalObj["spear"]  > 0) ? obj.spear  : 0;
        t.heavy = (sendTotalObj["heavy"]  > 0) ? obj.heavy  : 0;
        t.spy   = (sendTotalObj["spy"]    > 0) ? obj.spy    : 0;
        t.speedTroop = "ram";
        if(obj.archer != undefined) t.archer = (sendTotalObj["archer"] > 0) ? obj.archer : 0;
      } else if (obj.catapult_speed != undefined){
        t.ram = 0; t.catapult = 1;
        t.sword = (sendTotalObj["sword"]  > 0) ? obj.sword  : 0;
        t.spear = (sendTotalObj["spear"]  > 0) ? obj.spear  : 0;
        t.heavy = (sendTotalObj["heavy"]  > 0) ? obj.heavy  : 0;
        t.spy   = (sendTotalObj["spy"]    > 0) ? obj.spy    : 0;
        t.speedTroop = "catapult";
        if(obj.archer != undefined) t.archer = (sendTotalObj["archer"] > 0) ? obj.archer : 0;
      } else if (obj.sword_speed != undefined){
        t.ram = 0; t.catapult = 0;
        t.sword = (sendTotalObj["sword"]  > 0) ? obj.sword  : 0;
        t.spear = (sendTotalObj["spear"]  > 0) ? obj.spear  : 0;
        t.heavy = (sendTotalObj["heavy"]  > 0) ? obj.heavy  : 0;
        t.spy   = (sendTotalObj["spy"]    > 0) ? obj.spy    : 0;
        t.speedTroop = "sword";
        if(obj.archer != undefined) t.archer = (sendTotalObj["archer"] > 0) ? obj.archer : 0;
      } else if (obj.spear_speed != undefined){
        t.ram = 0; t.catapult = 0;
        t.sword = 0;
        t.spear = (sendTotalObj["spear"]  > 0) ? obj.spear  : 0;
        t.heavy = (sendTotalObj["heavy"]  > 0) ? obj.heavy  : 0;
        t.spy   = (sendTotalObj["spy"]    > 0) ? obj.spy    : 0;
        t.speedTroop = "spear";
        if(obj.archer != undefined) t.archer = (sendTotalObj["archer"] > 0) ? obj.archer : 0;
      } else if (obj.archer_speed != undefined){
        t.ram = 0; t.catapult = 0;
        t.sword = 0;
        t.spear = (sendTotalObj["spear"]  > 0) ? obj.spear  : 0;
        t.heavy = (sendTotalObj["heavy"]  > 0) ? obj.heavy  : 0;
        t.spy   = (sendTotalObj["spy"]    > 0) ? obj.spy    : 0;
        t.speedTroop = "archer";
        if(obj.archer != undefined) t.archer = (sendTotalObj["archer"] > 0) ? obj.archer : 0;
      } else if (obj.heavy_speed != undefined){
        t.ram = 0; t.catapult = 0;
        t.sword = 0; t.spear = 0;
        t.spy   = obj.spy;
        t.heavy = (sendTotalObj["heavy"]  > 0) ? obj.heavy  : 0;
        t.speedTroop = "heavy";
        if(obj.archer != undefined) t.archer = 0;
      } else if (obj.spy_speed != undefined){
        t.ram = 0; t.catapult = 0;
        t.sword = 0; t.spear = 0; t.heavy = 0;
        t.spy   = (sendTotalObj["spy"]    > 0) ? obj.spy    : 0;
        t.speedTroop = "spy";
        if(obj.archer != undefined) t.archer = 0;
      }

      t.axe = 0; t.light = 0;
      if(obj.marcher != undefined) t.marcher = 0;
      listTotal.push(t);
    });

    const listTotalRange = listTotal.filter(row => row.speedTroop != undefined);

    const factorTroopSent = {};
    sendTotal.forEach(elem => {
      factorTroopSent[elem.troopName] = elem.value / (listTotalRange.length || 1);
    });

    const mapResult = new Map();

    Object.keys(factorTroopSent).forEach(troopName=>{
      let factorValue = factorTroopSent[troopName];

      // Pro Troop unabhängig sortieren
      const arr = listTotalRange.slice().sort((o1,o2)=>{
        return o1[troopName] > o2[troopName] ? 1 : o1[troopName] < o2[troopName] ? -1 : 0;
      });

      for(let i=0;i<arr.length;i++){
        let troopValue = arr[i][troopName] || 0;

        if(troopValue < factorValue){
          const redistribute = factorValue - troopValue;
          factorValue += redistribute/Math.max(1,(arr.length-i-1));
          arr[i][troopName] = troopValue;
        } else {
          const module = factorValue % parseInt(factorValue||0,10);
          if((arr[i][troopName] + 1) > factorValue){
            const randomValue = (Math.random() < module) ? 1 : 0;
            arr[i][troopName] = parseInt(factorValue,10) + randomValue;
          } else {
            arr[i][troopName] = factorValue;
          }
        }

        const timeWindow = document.getElementById("checkbox_window").checked;
        if(arr[i]["speedTroop"] === troopName && arr[i][troopName] === 0 && timeWindow){
          arr[i][troopName] = 1;
        }
        if(!timeWindow){
          arr[i]["ram"] = 0;
          arr[i]["catapult"] = 0;
        }

        mapResult.set(arr[i].coord, Object.assign({}, mapResult.get(arr[i].coord), arr[i]));
      }
    });

    // Werte in die Tabelle schreiben
    const table = Array.from($(".overview_table .selected"));
    table.forEach(row=>{
      const coord = row.children[0].innerText.match(/\d+\|\d+/).pop();
      if(mapResult.has(coord)){
        const obj = mapResult.get(coord);
        let totalTroopCount = 0;
        Object.keys(obj).forEach(tn=>{
          if(tn !== "speedTroop" && tn !== "coord") totalTroopCount += obj[tn];
        });

        if(totalTroopCount > 1){
          Object.keys(obj).forEach(tn=>{
            if(tn !== "speedTroop"){
              const value = obj[tn];
              $(row).find(`.call-unit-box-${tn}`).val(value);
            }
          });
        }
      }
    });
  }

})();
