// ==UserScript Module==
// Läuft NUR auf place&mode=call, UI via Hotkey "s"

(function () {
  "use strict";

  // --- Seite prüfen: nur place&mode=call ---
  const sp = new URL(location.href).searchParams;
  const IS_CALL_PAGE = sp.get("screen") === "place" && sp.get("mode") === "call";
  if (!IS_CALL_PAGE) return; // auf allen anderen Seiten: nichts tun

  // ---------------------------------------------------------------------------
  // Original-Variablen (gekürzt auf das Notwendige, dein restlicher Code bleibt)
  // ---------------------------------------------------------------------------
  let url = window.location.href;
  var heavyCav = 4;
  var units = game_data.units.slice();
  units = units.filter(v => v !== "snob" && v !== "militia" && v !== "knight");

  var textColor = "#ffffff";
  var backgroundInput = "#000000";
  var borderColor = "#C5979D";
  var backgroundContainer = "#2B193D";
  var backgroundHeader = "#2C365E";
  var backgroundMainTable = "#484D6D";
  var backgroundInnerTable = "#4B8F8C";
  var widthInterface = 50;
  var headerColorAlternateTable = -30;
  var backgroundAlternateTableEven = backgroundContainer;
  var backgroundAlternateTableOdd = getColorDarker(backgroundContainer, headerColorAlternateTable);

  const localStorageThemeName = "supportSenderTheme";
  const defaultTheme = '[["theme1",["#E0E0E0","#000000","#C5979D","#2B193D","#2C365E","#484D6D","#4B8F8C","50"]],["currentTheme","theme1"],["theme2",["#E0E0E0","#000000","#F76F8E","#113537","#37505C","#445552","#294D4A","50"]],["theme3",["#E0E0E0","#000000","#ACFCD9","#190933","#665687","#7C77B9","#623B5A","50"]],["theme4",["#E0E0E0","#000000","#181F1C","#60712F","#274029","#315C2B","#214F4B","50"]],["theme5",["#E0E0E0","#000000","#9AD1D4","#007EA7","#003249","#1F5673","#1C448E","50"]],["theme6",["#E0E0E0","#000000","#EA8C55","#81171B","#540804","#710627","#9E1946","50"]],["theme7",["#E0E0E0","#000000","#754043","#37423D","#171614","#3A2618","#523A34","50"]],["theme8",["#E0E0E0","#000000","#9E0031","#8E0045","#44001A","#600047","#770058","50"]],["theme9",["#E0E0E0","#000000","#C1BDB3","#5F5B6B","#323031","#3D3B3C","#575366","50"]],["theme10",["#E0E0E0","#000000","#E6BCCD","#29274C","#012A36","#14453D","#7E52A0","50"]]]';

  // ---------------------------
  // Hotkey-Bind nur auf Call-Seite
  // ---------------------------
  (function setupMassSupporterHotkey() {
    if (window.__ds_ms_hotkey_bound) return;
    window.__ds_ms_hotkey_bound = true;
    console.info("[DS-Tools][MassSupporter] Hotkey bound on call page.");

    window.dsMsDebugStart = function () {
      try {
        if (!document.getElementById("div_container")) {
          console.info("[DS-Tools][MassSupporter] manual start main()");
          main();
        } else {
          console.info("[DS-Tools][MassSupporter] UI already open");
        }
      } catch (err) {
        console.error("[DS-Tools][MassSupporter] main() crashed:", err);
        UI?.ErrorMessage?.("MassSupporter Fehler – Details in der Konsole.");
      }
    };

    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = (e.key || "").toLowerCase();
      const isS = key === "s" || e.code === "KeyS" || e.which === 83;
      if (!isS) return;

      console.info("[DS-Tools][MassSupporter] 's' pressed");
      try { document.activeElement?.blur?.(); } catch {}

      e.preventDefault();
      e.stopPropagation();

      if (!document.getElementById("div_container")) {
        try { main(); } catch (err) {
          console.error("[DS-Tools][MassSupporter] main() crashed:", err);
          UI?.ErrorMessage?.("MassSupporter Fehler – Details in der Konsole.");
        }
      }
    }

    // breit binden, um Konflikte zu umgehen
    document.addEventListener("keydown", onKey, { capture: true });
    document.addEventListener("keypress", onKey, { capture: true });
  })();

  // ---------------------------
  // Utils (deine bestehenden)
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

  // ---------------------------
  // Hauptstart
  // ---------------------------
  async function main() {
    initializationTheme();
    try {
      await $.getScript("https://dl.dropboxusercontent.com/s/i5c0so9hwsizogm/styleCSSGlobal.js?dl=0");
    } catch (e) {
      console.warn("[MassSupporter] styleCSSGlobal laden fehlgeschlagen:", e);
    }
    createMainInterface();
    addEvents();
  }

  function createMainInterface() {
    // EINDEUTIGE IDs benutzen
    const rowsSpawnDatetimes = (game_data.units.includes("archer") ? 4 : 3);

    let html = `
    <div id="div_container" class="scriptContainer" style="z-index:99999;width:${widthInterface}%;">
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

    // draggable nur wenn vorhanden
    if ($.fn?.draggable) $("#div_container").css("position","fixed").draggable();

    // Events
    $("#btn_close_ui").on("click", (e) => { e.preventDefault(); $("#div_container").remove(); });
    $("#btn_minimize_ui").on("click", (e) => {
      e.preventDefault();
      const body = $("#div_body");
      const isHidden = !body.is(":visible");
      if (isHidden) {
        $('#div_container').css({ width: `${widthInterface}%` });
        body.show();
      } else {
        $('#div_container').css({ width: '10%' });
        body.hide();
      }
    });
    $("#btn_toggle_theme").on("click", (e) => { e.preventDefault(); $("#theme_settings").toggle(); });

    // minimal Theme-UI (optional, kann durch deine volle changeTheme() ersetzt werden)
    $("#theme_settings").html(`<div>Theme einfach (deaktiviert) – nutze deine bestehende changeTheme(), wenn gewünscht.</div>`);

    if (game_data.device !== "desktop") {
      $("#table_upload").find("input[type=text]").css("width","100%");
    }

    // Startwerte berechnen
    countTotalTroops();
  }

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

function addEvents(){
    // $('.sendTroops').off('input')
    $('.sendTroops').on('input',function(e){
        let sendTotal=document.getElementsByClassName("sendTroops")
        let totalPop=0;
        for(let i=0;i<sendTotal.length;i++){
            let id=sendTotal[i].id
            let value=(sendTotal[i].value=="")?0:sendTotal[i].value
    
            if(id.includes("spear") || id.includes("sword") || id.includes("archer")){
                totalPop+=parseFloat(value)*1000
            }
            if(id.includes("heavy")){
                totalPop+=parseFloat(value)*1000*heavyCav
            }
        }
        document.getElementById("packets_send").value=(totalPop/1000).toFixed(2)
    
    });
    // $('.packets_send').off('input')
    $('#packets_send').on('input',function(e){
        let needTroops=parseFloat(document.getElementById("packets_send").value)
        let totalPop =parseFloat(document.getElementById("packets_total").value)
        let sendTotal=document.getElementsByClassName("sendTroops")
        let totalTroops=document.getElementsByClassName("totalTroops")

        console.log(needTroops)
        console.log(totalPop)
        let ratio = needTroops/totalPop
        console.log(ratio)
        for(let i=0;i<totalTroops.length;i++){
            let id=sendTotal[i].id
            if(!id.includes("spy")){
                sendTotal[i].value= parseInt(parseFloat(totalTroops[i].value)*ratio*100)/100.0
            }
            else{
                sendTotal[i].value=0
            }
        }


    
    });
}



function calcDistance(coord1,coord2){
    let x1=parseInt(coord1.split("|")[0])
    let y1=parseInt(coord1.split("|")[1])
    let x2=parseInt(coord2.split("|")[0])
    let y2=parseInt(coord2.split("|")[1])

    return Math.sqrt( (x1-x2)*(x1-x2) +  (y1-y2)*(y1-y2) );
}

function getSpeedConstant() { //Get speed constant (world speed * unit speed) for world
    if (localStorage.getItem(game_data.world+"speedWorld") !== null) {
        let obj=JSON.parse(localStorage.getItem(game_data.world+"speedWorld"))
        console.log("speed world already exist")
        return obj
    }
    else { //Get data from xml and save it in localStorage to avoid excessive XML requests to server
            let data=httpGet("/interface.php?func=get_config") //Load world data
            const parser = new DOMParser();
            const htmlDoc = parser.parseFromString(data, 'text/html');
            let obj={}
            let worldSpeed = Number(htmlDoc.getElementsByTagName("speed")[0].innerHTML)
            let unitSpeed = Number(htmlDoc.getElementsByTagName("unit_speed")[0].innerHTML);
            obj.unitSpeed=unitSpeed
            obj.worldSpeed=worldSpeed

            localStorage.setItem(game_data.world+"speedWorld",JSON.stringify(obj));
            console.log("save speed world")
        return obj
    }
}
})