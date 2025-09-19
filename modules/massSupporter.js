

(function () {
  "use strict";

  // --- Nur auf place&mode=call aktiv sein ---
  const params = new URL(location.href).searchParams;
  const IS_CALL_PAGE = params.get("screen") === "place" && params.get("mode") === "call";
  if (!IS_CALL_PAGE) {
    // Auf anderen Seiten nichts tun (kein Redirect, kein Hotkey).
    return;
  }

  // (alles Weitere bleibt)
  
// made by Costache Madalin (lllll llll)
// discord: costache madalin#8472

let url=window.location.href
var countApiKey = "support_sender";
var countNameSpace="madalinoTribalWarsScripts"
var heavyCav=4

var units=game_data.units;
var unitsLength=units.length;
if(units.includes("snob"))
    unitsLength--;
if(units.includes("militia"))
    unitsLength--;
if(units.includes("knight"))
    unitsLength--;
    
units = Array.from(game_data.units.slice()).filter(value =>{
    return value != "snob" && value != "militia" && value != "knight"
})
var troupesPop = {
    spear : 1,
    sword : 1,
    axe : 1,
    archer : 1,
    spy : 2,
    light : 4,
    marcher : 5,
    heavy : 6,
    ram : 5,
    catapult : 8,
    knight : 10,
    snob : 100
    };
troupesPop.heavy=heavyCav

var keepTroopsHome=21;


function httpGet(theUrl)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", theUrl, false ); // false for synchronous request
    xmlHttp.send( null );
    return xmlHttp.responseText;
}



    
var headerWood="#001a33"
var headerWoodEven="#002e5a"
var headerStone="#3b3b00"
var headerStoneEven="#626200"
var headerIron="#1e003b"
var headerIronEven="#3c0076"


var defaultTheme= '[["theme1",["#E0E0E0","#000000","#C5979D","#2B193D","#2C365E","#484D6D","#4B8F8C","50"]],["currentTheme","theme1"],["theme2",["#E0E0E0","#000000","#F76F8E","#113537","#37505C","#445552","#294D4A","50"]],["theme3",["#E0E0E0","#000000","#ACFCD9","#190933","#665687","#7C77B9","#623B5A","50"]],["theme4",["#E0E0E0","#000000","#181F1C","#60712F","#274029","#315C2B","#214F4B","50"]],["theme5",["#E0E0E0","#000000","#9AD1D4","#007EA7","#003249","#1F5673","#1C448E","50"]],["theme6",["#E0E0E0","#000000","#EA8C55","#81171B","#540804","#710627","#9E1946","50"]],["theme7",["#E0E0E0","#000000","#754043","#37423D","#171614","#3A2618","#523A34","50"]],["theme8",["#E0E0E0","#000000","#9E0031","#8E0045","#44001A","#600047","#770058","50"]],["theme9",["#E0E0E0","#000000","#C1BDB3","#5F5B6B","#323031","#3D3B3C","#575366","50"]],["theme10",["#E0E0E0","#000000","#E6BCCD","#29274C","#012A36","#14453D","#7E52A0","50"]]]'
var localStorageThemeName = "supportSenderTheme"
if(localStorage.getItem(localStorageThemeName)!=undefined){
    let mapTheme = new Map(JSON.parse(localStorage.getItem(localStorageThemeName)))
    Array.from(mapTheme.keys()).forEach((key)=>{
        if(key!="currentTheme"){
            let listColors=mapTheme.get(key);
            if(listColors.length == 7){
                listColors.push(50);
                mapTheme.set(key,listColors)
            }
        }
    })
    localStorage.setItem(localStorageThemeName, JSON.stringify(Array.from(mapTheme.entries())))
}

var textColor="#ffffff"
var backgroundInput="#000000"

var borderColor = "#C5979D";//#026440
var backgroundContainer="#2B193D"
var backgroundHeader="#2C365E"
var backgroundMainTable="#484D6D"
var backgroundInnerTable="#4B8F8C"

var widthInterface=50;//percentage
var headerColorDarken=-50 //percentage( how much the header should be darker) if it's with -(darker) + (lighter)
var headerColorAlternateTable=-30;
var headerColorAlternateHover=30;

var backgroundAlternateTableEven=backgroundContainer;
var backgroundAlternateTableOdd=getColorDarker(backgroundContainer,headerColorAlternateTable);


// --- Hotkey-Start nur auf der Call-Seite -----------------------------------
(function setupMassSupporterHotkey() {
  if (window.__ds_ms_hotkey_bound) return;
  window.__ds_ms_hotkey_bound = true;

  function startNowIfReady() {
    if (document.getElementById("div_container")) return; // UI schon da
    try { main(); } catch (err) { console.error("[DS-Tools][MassSupporter] start failed", err); }
  }

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = (e.key || "").toLowerCase();
    const byCode = e.code === "KeyS";
    if (!(key === "s" || byCode)) return;

    // Nur hier (mode=call) reagieren, sonst ignorieren:
    e.preventDefault();
    e.stopPropagation();
    try { document.activeElement?.blur?.(); } catch {}
    startNowIfReady();
  }, { capture: true });
})();



function getColorDarker(hexInput, percent) {
    let hex = hexInput;

    // strip the leading # if it's there
    hex = hex.replace(/^\s*#|\s*$/g, "");

    // convert 3 char codes --> 6, e.g. `E0F` --> `EE00FF`
    if (hex.length === 3) {
        hex = hex.replace(/(.)/g, "$1$1");
    }

    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);

    const calculatedPercent = (100 + percent) / 100;

    r = Math.round(Math.min(255, Math.max(0, r * calculatedPercent)));
    g = Math.round(Math.min(255, Math.max(0, g * calculatedPercent)));
    b = Math.round(Math.min(255, Math.max(0, b * calculatedPercent)));

    return `#${("00"+r.toString(16)).slice(-2).toUpperCase()}${("00"+g.toString(16)).slice(-2).toUpperCase()}${("00"+b.toString(16)).slice(-2).toUpperCase()}`
}

async function main() {
  initializationTheme();
  try {
    await $.getScript("https://dl.dropboxusercontent.com/s/i5c0so9hwsizogm/styleCSSGlobal.js?dl=0");
  } catch (e) {
    console.warn("[MassSupporter] styleCSSGlobal laden fehlgeschlagen:", e);
  }
  createMainInterface();
  changeTheme();
  addEvents();
  hitCountApi();
}

function createMainInterface(){
    let rowsSpawnButtons = (game_data.units.includes("archer") == true)?7:6;
    let rowsSpawnDatetimes = (game_data.units.includes("archer") == true)?4:3;

    let html=`
    
    <div id="div_container" class="scriptContainer">
        <div class="scriptHeader">
            <div style=" margin-top:10px;"><h2>Support sender</h2></div>
            <div style="position:absolute;top:10px;right: 10px;"><a href="#" onclick="$('#div_container').remove()"><img src="https://img.icons8.com/emoji/24/000000/cross-mark-button-emoji.png"/></a></div>
            <div style="position:absolute;top:8px;right: 35px;" id="div_minimize"><a href="#"><img src="https://img.icons8.com/plasticine/28/000000/minimize-window.png"/></a></div>
            <div style="position:absolute;top:10px;right: 60px;" id="div_theme"><a href="#" onclick="$('#theme_settings').toggle()"><img src="https://img.icons8.com/material-sharp/24/fa314a/change-theme.png"/></a></div>
        </div>

        <div id="theme_settings"></div>

        <div id="div_body">
            <table id="table_upload" class="scriptTable"> 
                <tr>
                    <td>troops</td>    
        `;
    for(let i=0;i<units.length;i++){
        if(units[i]!="knight" && units[i]!="snob" && units[i]!="militia" && units[i]!="axe" && units[i]!="light" && units[i]!="ram" && units[i]!="catapult" && units[i]!="marcher"){
            html+=`<td class="fm_unit"><img src="https://dsen.innogamescdn.com/asset/1d2499b/graphic/unit/unit_${units[i]}.png"></td>`
        }
    }
    html+=`
                    <td >pop</td>
                </tr>
                <tr id="totalTroops"
                >
                    <td>total</td>   
                `;
            
    for(let i=0;i<units.length;i++){
        if(units[i]!="knight" && units[i]!="snob" && units[i]!="militia" && units[i]!="axe" && units[i]!="light" && units[i]!="ram" && units[i]!="catapult" && units[i]!="marcher"){
            html+=` <td>
                        <input id="`+units[i]+`total" value="0" type="text"  class="totalTroops scriptInput"  disabled>
                        <font color="${textColor}" class="hideMobile">k</font>
                    </td>  `
        }
    }  
    html+=`
                    <td >
                        <input id="packets_total" value="0" type="text" class="scriptInput "  disabled>
                    <font color="${textColor}" class="hideMobile">k</font>
                    </td>  
                </tr>
                <tr id="sendTroops">
                    <td>send</td>`;

            
for(let i=0;i<units.length;i++){
    if(units[i]!="knight" && units[i]!="snob" && units[i]!="militia" && units[i]!="axe" && units[i]!="light" && units[i]!="ram" && units[i]!="catapult" && units[i]!="marcher"){
            html+=`
                    <td align="center" >
                        <input id="`+units[i]+`total" value="0" type="number"   class="scriptInput sendTroops" >
                        <font color="${textColor}" class="hideMobile">k</font>
                    </td>  `
        }
    }     
        html+=`
                    <td align="center" >
                        <input id="packets_send" value="0" type="number" class="scriptInput"  >
                        <font color="${textColor}" class="hideMobile">k</font>
                    </td> 
                </tr>`


        html+=`</tr>
                <tr id="reserveTroops">
                    <td>reserve</td>`;

            
for(let i=0;i<units.length;i++){
    if(units[i]!="knight" && units[i]!="snob" && units[i]!="militia" && units[i]!="axe" && units[i]!="light" && units[i]!="ram" && units[i]!="catapult" && units[i]!="marcher"){
            html+=`
                    <td align="center" >
                        <input id="`+units[i]+`Reserve" value="0" type="number"   class="scriptInput reserveTroops" >
                        <font color="${textColor}" class="hideMobile">k</font>
                    </td>  `
        }
    }     
        html+=`
                    <td align="center" >
                        <input id="packets_reserve" value="0" type="text" class="scriptInput" disabled >
                        <font color="${textColor}" class="hideMobile">k</font>
                    </td> 
                </tr>`




        html+=`
                <tr>
                    <td colspan="1">
                        <center><font color="${textColor}"> sigil:</font><input type="number" id="flag_boost" class="scriptInput" min="0" max="100" placeholder="0" value="0" style="text-align: center"></center>
                    </td>
                    <td colspan="2">
                        <center><input type="checkbox" id="checkbox_window" value="land_specific"><font color="${textColor}"> packets land between:</font> </center>
                    </td>
                    <td colspan="${rowsSpawnDatetimes}">
                        <center style="margin:5px">start:<input type="datetime-local" id="start_window" style="text-align:center;" ></center>
                        <center style="margin:5px">end:  <input type="datetime-local" id="stop_window" style="text-align:center;" ></center>

                    </td>   
                </tr>
                <tr>
                    <td colspan='${rowsSpawnButtons}'>
                        <button type="button" class="btn evt-confirm-btn btn-confirm-yes" id="fillInputs" onclick="fillInputs()">Fill inputs</button>
                        <button type="button" class="btn evt-confirm-btn btn-confirm-yes" id="fillInputs" onclick="countTotalTroops()">Calculate</button>
                    </td>   

                </tr>
            </table>
        </div>
        <div class="scriptFooter">
            <div style=" margin-top:5px;"><h5>made by Costache</h5></div>
        </div> 
    </div>`


    ////////////////////////////////////////add and remove window from page///////////////////////////////////////////
    $("#div_container").remove()
    $("#contentContainer").eq(0).prepend(html);
    $("#mobileContent").eq(0).prepend(html);

    //for mobile browser



    $("#div_container").css("position","fixed");
    $("#div_container").draggable();
    
    $("#div_minimize").on("click",()=>{
        let currentWidthPercentage=Math.ceil($('#div_container').width() / $('body').width() * 100);
        if(currentWidthPercentage >=widthInterface ){
            $('#div_container').css({'width' : '10%'});
            $('#div_body').hide();
        }
        else{
            $('#div_container').css({'width' : `${widthInterface}%`});
            $('#div_body').show();
        }
    })
    

    if(localStorage.getItem(game_data.world+"support_sender_settings2")!=null ){
        //initialize checkbox
        let list_checkbox=JSON.parse(localStorage.getItem(game_data.world+"support_sender_settings2"))[0]
        $('#table_upload input[type=checkbox]').each(function (index,elem) {
            this.checked=list_checkbox[index]
            // console.log(elem.value)
        });


        //initialize input numbers
        let list_input=JSON.parse(localStorage.getItem(game_data.world+"support_sender_settings2"))[1]
        $('#table_upload input').each(function (index,elem) {
            // console.log(elem)
            this.value=list_input[index]
        });

        $('.totalTroops').each(function (index,elem) {
            console.log(elem)
            this.value=0
        });
        $("#packets_total").val(0)
    }
    //save settings
    $("#table_upload input[type=checkbox], #table_upload input").on("click input change",()=>{
        countTotalTroops()
        let list_checkbox=[]
        let list_input=[]
        //save checkbox
        $('#table_upload input[type=checkbox]').each(function () {
            var checked = this.checked
            // console.log(this)
            list_checkbox.push(checked)
        });

        //save inputs
        $('#table_upload input').each(function () {
            // table_upload checked = this.checked
            var value=this.value
            // console.log(value)
            list_input.push(value)
        });

        let list_final=[list_checkbox,list_input]
        let data=JSON.stringify(list_final)
        let data_localStorage=localStorage.getItem(game_data.world+"support_sender_settings2")
        console.log(data)
        console.log(data_localStorage)
        if(data!=data_localStorage){
            localStorage.setItem(game_data.world+"support_sender_settings2",data)
        }
        
    })

    if(game_data.device !="desktop"){
        $(".hideMobile").hide()
        $("#table_upload").find("input[type=text]").css("width","100%")

    }
}



function changeTheme(){
    let html= `
    <h3 style="color:${textColor};padding-left:10px;padding-top:5px">after theme is selected run the script again<h3>
    <table class="scriptTable" >
        
        <tr>
            <td>
                <select  id="select_theme">
                    <option value="theme1">theme1</option>
                    <option value="theme2">theme2</option>
                    <option value="theme3">theme3</option>
                    <option value="theme4">theme4</option>
                    <option value="theme5">theme5</option>
                    <option value="theme6">theme6</option>
                    <option value="theme7">theme7</option>
                    <option value="theme8">theme8</option>
                    <option value="theme9">theme9</option>
                    <option value="theme10">theme10</option>
                </select>
            </td>
            <td>value</td>
            <td >color hex</td>
        </tr>
        <tr>
            <td>textColor</td>
            <td style="background-color:${textColor}" class="td_background"></td>
            <td><input type="text" class="scriptInput input_theme" value="${textColor}"></td>
        </tr>
        <tr>
            <td>backgroundInput</td>
            <td style="background-color:${backgroundInput}" class="td_background"></td>
            <td><input type="text" class="scriptInput input_theme" value="${backgroundInput}"></td>
        </tr>
        <tr>
            <td>borderColor</td>
            <td style="background-color:${borderColor}" class="td_background"></td>
            <td><input type="text" class="scriptInput input_theme" value="${borderColor}"></td>
        </tr>
        <tr>
            <td>backgroundContainer</td>
            <td style="background-color:${backgroundContainer}" class="td_background"></td>
            <td><input type="text" class="scriptInput input_theme" value="${backgroundContainer}"></td>
        </tr>
        <tr>
            <td>backgroundHeader</td>
            <td style="background-color:${backgroundHeader}" class="td_background"></td>
            <td><input type="text" class="scriptInput input_theme" value="${backgroundHeader}"></td>
        </tr>
        <tr>
            <td>backgroundMainTable</td>
            <td style="background-color:${backgroundMainTable}" class="td_background"></td>
            <td><input type="text" class="scriptInput input_theme" value="${backgroundMainTable}"></td>
        </tr>
        <tr>
            <td>backgroundInnerTable</td>
            <td style="background-color:${backgroundInnerTable}" class="td_background"></td>
            <td><input type="text" class="scriptInput input_theme" value="${backgroundInnerTable}"></td>
        </tr>
        <tr>
            <td>widthInterface</td>
            <td><input type="range" min="25" max="100" class="slider input_theme" id="input_slider_width" value="${widthInterface}"></td>
            <td id="td_width">${widthInterface}%</td>
        </tr>
        <tr >
            <td><input class="btn evt-confirm-btn btn-confirm-yes" type="button" id="btn_save_theme" value="Save"></td>
            <td><input class="btn evt-confirm-btn btn-confirm-yes" type="button" id="btn_reset_theme" value="Default themes"></td>
            <td></td>
        </tr>

    </table>
    `
    $("#theme_settings").append(html)
    $("#theme_settings").hide()

    let selectedTheme = ""
    let colours =[]
    let mapTheme = new Map()

    $("#select_theme").on("change",()=>{
        if(localStorage.getItem(localStorageThemeName) != undefined){
            selectedTheme = $('#select_theme').find(":selected").text();
            colours = Array.from($(".input_theme")).map(elem=>elem.value.toUpperCase().trim())
            mapTheme = new Map(JSON.parse(localStorage.getItem(localStorageThemeName)))
            console.log(selectedTheme)
            console.log(mapTheme)
            colours = mapTheme.get(selectedTheme)
            console.log(colours)
            Array.from($(".input_theme")).forEach((elem,index)=>{
                elem.value = colours[index]
            })
            Array.from($(".td_background")).forEach((elem,index)=>{
                elem.style.background = colours[index]
            })

            mapTheme.set("currentTheme",selectedTheme)
            localStorage.setItem(localStorageThemeName, JSON.stringify(Array.from(mapTheme.entries())))
        }
    })

    $("#btn_save_theme").on("click",()=>{
        colours = Array.from($(".input_theme")).map(elem=>elem.value.toUpperCase().trim())
        selectedTheme = $('#select_theme').find(":selected").text();

        for(let i=0;i<colours.length-1;i++){
            if(colours[i].match(/#[0-9 A-F]{6}/) == null ){
                UI.ErrorMessage("wrong colour: "+colours[i])  
                throw new Error("wrong colour")
            }
        }

        if(localStorage.getItem(localStorageThemeName) != undefined)
            mapTheme = new Map(JSON.parse(localStorage.getItem(localStorageThemeName)))


        mapTheme.set(selectedTheme,colours)
        mapTheme.set("currentTheme",selectedTheme)

        localStorage.setItem(localStorageThemeName, JSON.stringify(Array.from(mapTheme.entries())))
        console.log("saved colours for: "+selectedTheme)
        UI.SuccessMessage(`saved colours for: ${selectedTheme} \n run the script again`,1000)


    })

    $("#btn_reset_theme").on("click",()=>{
        localStorage.setItem(localStorageThemeName, defaultTheme)
        UI.SuccessMessage("run the script again",1000)

    })
    $("#input_slider_width").on("input",()=>{
        $("#td_width").text($("#input_slider_width").val()+"%")
    })


    if(localStorage.getItem(localStorageThemeName) != undefined){
        mapTheme = new Map(JSON.parse(localStorage.getItem(localStorageThemeName)))
        let currentTheme=mapTheme.get("currentTheme")
        document.querySelector('#select_theme').value=currentTheme
    }

    
}

function initializationTheme(){
    if(localStorage.getItem(localStorageThemeName) != undefined){
        let mapTheme = new Map(JSON.parse(localStorage.getItem(localStorageThemeName)))
        let currentTheme=mapTheme.get("currentTheme")
        let colours=mapTheme.get(currentTheme)

        textColor=colours[0]
        backgroundInput=colours[1]

        borderColor = colours[2]
        backgroundContainer=colours[3]
        backgroundHeader=colours[4]
        backgroundMainTable=colours[5]
        backgroundInnerTable=colours[6]
        widthInterface=colours[7]

        if(game_data.device != "desktop"){
            widthInterface = 98
        }

        backgroundAlternateTableEven=backgroundContainer;
        backgroundAlternateTableOdd=getColorDarker(backgroundContainer,headerColorAlternateTable);       
        console.log("textColor: "+textColor)
        console.log("backgroundContainer: "+backgroundContainer)
        
    }
    else{
        localStorage.setItem(localStorageThemeName, defaultTheme)

        let mapTheme = new Map(JSON.parse(localStorage.getItem(localStorageThemeName)))
        let currentTheme=mapTheme.get("currentTheme")
        let colours=mapTheme.get(currentTheme)

        textColor=colours[0]
        backgroundInput=colours[1]

        borderColor = colours[2]
        backgroundContainer=colours[3]
        backgroundHeader=colours[4]
        backgroundMainTable=colours[5]
        backgroundInnerTable=colours[6]
        widthInterface=colours[7]

        if(game_data.device != "desktop"){
            widthInterface = 98
        }

        backgroundAlternateTableEven=backgroundContainer;
        backgroundAlternateTableOdd=getColorDarker(backgroundContainer,headerColorAlternateTable);  
    }

}






function countTotalTroops(){

    
    let dateStart = new Date()
    let dateStop = new Date()
    dateStart.setFullYear(dateStart.getFullYear()-1)
    dateStop.setFullYear(dateStop.getFullYear()+1)

    let sigil = 0;
    let timeWindow = document.getElementById("checkbox_window").checked
    if(timeWindow){
        dateStart = new Date(document.getElementById("start_window").value)
        dateStop = new Date(document.getElementById("stop_window").value)
        sigil = parseInt(document.getElementById("flag_boost").value)

        if(dateStart == "Invalid Date")
            UI.ErrorMessage("start date has an invalid format",2000)
        if(dateStop == "Invalid Date")
            UI.ErrorMessage("stop date has an invalid format",2000)

        sigil = (Number.isNaN(sigil) == true ) ? 0 : sigil;
    }


    let mapVillages = new Map()

    let coordDestination 
    if(game_data.device == "desktop")
        coordDestination = $(".village-name").text().match(/\d+\|\d+/)[0]
    else{
        coordDestination = $("#inputx").val() + "|" + $("#inputy").val()
    }
    let speedWorld = getSpeedConstant().worldSpeed;
    let speedTroupes = getSpeedConstant().unitSpeed;
    let speedTroop = {
        snob: 2100 * 1000 / (speedWorld * speedTroupes),
        ram: 1800 * 1000 / (speedWorld * speedTroupes),
        catapult: 1800 * 1000 / (speedWorld * speedTroupes),
        sword: 1320 * 1000 / (speedWorld * speedTroupes),
        axe: 1080 * 1000 / (speedWorld * speedTroupes),
        spear: 1080 * 1000 / (speedWorld * speedTroupes),
        archer:1080 * 1000 / (speedWorld * speedTroupes),
        heavy: 660 * 1000 / (speedWorld * speedTroupes),
        light: 600 * 1000 / (speedWorld * speedTroupes),
        marcher: 600 * 1000 / (speedWorld * speedTroupes),
        knight: 600 * 1000 / (speedWorld * speedTroupes),
        spy: 540 * 1000 / (speedWorld * speedTroupes)
    }




    Array.from($("#village_troup_list tbody tr")).forEach(row => {
        let coord = row.children[0].innerText.match(/\d+\|\d+/)[0]
        let distance = calcDistance(coord, coordDestination)
        let objTroops = {
            distance: distance
        }
        // if(game_data.units.includes("knight"))
        //     units.push("knight")


        units.forEach(troopName => {
            let totalTroops = parseInt($(row).find(`[data-unit='${troopName}']`).text())
            let reserveTroops = parseFloat($(`#${troopName}Reserve`).val())

            reserveTroops = (reserveTroops == undefined || Number.isNaN(reserveTroops) == true) ? 0 : reserveTroops*1000

            totalTroops = (totalTroops > reserveTroops) ? totalTroops - reserveTroops : 0

            let timeTroop = speedTroop[troopName] * distance //ms
            timeTroop = timeTroop / (1 + sigil / 100.0) //if boost flag is on 


            let serverTime=document.getElementById("serverTime").innerText
            let serverDate=document.getElementById("serverDate").innerText.split("/")
            serverDate=serverDate[1]+"/"+serverDate[0]+"/"+serverDate[2]
            let date_current=new Date(serverDate+" "+serverTime);
            date_current = new Date(date_current.getTime() + timeTroop)

            // console.log(date_current)
            if(totalTroops > 0 && dateStart.getTime() < date_current.getTime() && date_current.getTime() < dateStop.getTime()){
                objTroops[troopName+"_speed"] = troopName
            }
            objTroops[troopName] = totalTroops


            if(timeWindow == false){
                delete objTroops.ram
                delete objTroops.catapult
                delete objTroops.ram_speed
                delete objTroops.catapult_speed
            }




        })
        mapVillages.set(coord, objTroops)

    })

    let objTroopsTotal = {
        spear: 0,
        sword: 0,
        archer: 0,
        spy: 0,
        heavy: 0,
        totalPop: 0
        
    }
    
    Array.from(mapVillages.keys()).forEach(key => {
        let obj = mapVillages.get(key)
        if(obj["ram_speed"] != undefined || obj["catapult_speed"] != undefined || obj["sword_speed"] != undefined){
            objTroopsTotal.spear += obj.spear
            objTroopsTotal.sword += obj.sword
            objTroopsTotal.spy += obj.spy
            objTroopsTotal.heavy += obj.heavy

            if(obj.archer != undefined)
                objTroopsTotal.archer += obj.archer
        }
        else if(obj["spear_speed"] != undefined || obj["archer_speed"] != undefined){
            objTroopsTotal.spear += obj.spear
            objTroopsTotal.heavy += obj.heavy
            objTroopsTotal.spy += obj.spy

            
            if(obj.archer != undefined)
                objTroopsTotal.archer += obj.archer
        }
        else if(obj["heavy_speed"] != undefined){
            objTroopsTotal.heavy += obj.heavy
            objTroopsTotal.spy += obj.spy

        }
        else if(obj["spy_speed"] != undefined){
            objTroopsTotal.spy += obj.spy
        }
    })

    if(!game_data.units.includes("archer"))
        delete objTroopsTotal.archer

    let totalPop = 0; 
    console.log(objTroopsTotal)

    Object.keys(objTroopsTotal).forEach(key=>{
        if(key=="spear" || key=="sword" || key=="archer" || key=="spy" || key=="heavy")
            if(units.includes(key)){
                document.getElementById(key+"total").value=(objTroopsTotal[key]/1000).toFixed(2)
            }

        if(key=="spear" || key=="sword" || key=="archer" ){
            totalPop+=objTroopsTotal[key]
        }
        else if(key =='heavy')
            totalPop+=objTroopsTotal[key]*heavyCav;
    })


    console.log(objTroopsTotal)
    console.log("totalPop: "+totalPop)
    document.getElementById("packets_total").value=(totalPop/1000).toFixed(2)
    addEvents()
    console.log(mapVillages)
    return mapVillages;
}




function fillInputs(){
    let mapVillages = countTotalTroops()
    let listTotal = []

   //check inputs
   
   let troopsTotal = Array.from(document.getElementsByClassName("totalTroops")).map(e=>parseFloat(e.value) * 1000)
   let sendTotalObj = {}
   let sendTotal = Array.from(document.getElementsByClassName("sendTroops")).map(e => ({
        value: (Number.isNaN(parseFloat(e.value) * 1000) ? 0 : parseFloat(e.value) * 1000),
        troopName: e.id.replace("total", "")
    }))
    sendTotal.forEach(e=>{
        sendTotalObj[e.troopName] = e.value
    })

    console.log(sendTotal)


   for(let i=0;i<troopsTotal.length;i++){
       if(troopsTotal[i] <sendTotal[i].value){
           alert("wrong input\n not enough troops");
           return;
       }
   }
   

    let checkbox=document.getElementById("village_troup_list").children[0].children[0].getElementsByTagName("input");
    for(let i=0;i<checkbox.length-1;i++){
        let id=checkbox[i].id.split("_")[1]
        console.log(id)
        let troops = ["spear", "sword", "archer", "spy", "heavy", "ram", "catapult"]
        if(troops.includes(id)){
            checkbox[i].checked=true;
        }
        else
            checkbox[i].checked=false;
    }
    document.getElementById("place_call_select_all").click()
    $("#village_troup_list").find("input[type=number]:visible").val(0)




    Array.from(mapVillages.keys()).forEach(key=>{
        let obj = mapVillages.get(key)
        let objTotal ={ 
            coord: key
        }
        if(obj.ram_speed != undefined){
            objTotal.ram = 1
            objTotal.catapult = 0
            objTotal.sword = (sendTotalObj["sword"] > 0) ? obj.sword : 0
            objTotal.spear = (sendTotalObj["spear"] > 0) ? obj.spear : 0
            objTotal.heavy = (sendTotalObj["heavy"] > 0) ? obj.heavy : 0
            objTotal.spy = (sendTotalObj["spy"] > 0) ? obj.spy : 0
            objTotal.speedTroop = "ram"



            if(obj.archer != undefined ){
                objTotal.archer = (sendTotalObj["archer"] > 0) ? obj.archer : 0
            }


        }
        else if(obj.catapult_speed != undefined){
            console.log(sendTotalObj)
            objTotal.ram = 0
            objTotal.catapult = 1
            objTotal.sword = (sendTotalObj["sword"] > 0) ? obj.sword : 0
            objTotal.spear = (sendTotalObj["spear"] > 0) ? obj.spear : 0
            objTotal.heavy = (sendTotalObj["heavy"] > 0) ? obj.heavy : 0
            objTotal.spy = (sendTotalObj["spy"] > 0) ? obj.spy : 0
            objTotal.speedTroop = "catapult"

            if(obj.archer != undefined )
            objTotal.archer = (sendTotalObj["archer"] > 0) ? obj.archer : 0

        }
        else if(obj.sword_speed != undefined){
            objTotal.ram = 0
            objTotal.catapult = 0
            objTotal.sword = (sendTotalObj["sword"] > 0) ? obj.sword : 0
            objTotal.spear = (sendTotalObj["spear"] > 0) ? obj.spear : 0
            objTotal.heavy = (sendTotalObj["heavy"] > 0) ? obj.heavy : 0
            objTotal.spy = (sendTotalObj["spy"] > 0) ? obj.spy : 0
            objTotal.speedTroop = "sword"

            if(obj.archer != undefined )
                objTotal.archer = (sendTotalObj["archer"] > 0) ? obj.archer : 0

        }
        else if(obj.spear_speed != undefined){
            
            objTotal.ram = 0
            objTotal.catapult = 0
            objTotal.sword = 0
            objTotal.spear = (sendTotalObj["spear"] > 0) ? obj.spear : 0
            objTotal.heavy = (sendTotalObj["heavy"] > 0) ? obj.heavy : 0
            objTotal.spy = (sendTotalObj["spy"] > 0) ? obj.spy : 0
            objTotal.speedTroop = "spear"

            if(obj.archer != undefined )
                objTotal.archer = (sendTotalObj["archer"] > 0) ? obj.archer : 0

        }
        else if(obj.archer_speed != undefined){
            objTotal.ram = 0
            objTotal.catapult = 0
            objTotal.sword = 0
            objTotal.spear = (sendTotalObj["spear"] > 0) ? obj.spear : 0
            objTotal.heavy = (sendTotalObj["heavy"] > 0) ? obj.heavy : 0
            objTotal.spy = (sendTotalObj["spy"] > 0) ? obj.spy : 0
            objTotal.speedTroop = "archer"

            if(obj.archer != undefined )
                objTotal.archer = (sendTotalObj["archer"] > 0) ? obj.archer : 0

        }
        else if(obj.heavy_speed != undefined ){
            objTotal.ram = 0
            objTotal.catapult = 0
            objTotal.sword = 0
            objTotal.spear = 0
            objTotal.spy = obj.spy
            objTotal.speedTroop = "heavy"
            objTotal.heavy = (sendTotalObj["heavy"] > 0) ? obj.heavy : 0
        

            if(obj.archer != undefined )
                objTotal.archer = 0

        }
        else if(obj.spy_speed != undefined){
            objTotal.ram = 0
            objTotal.catapult = 0
            objTotal.sword = 0
            objTotal.spear = 0
            objTotal.heavy = 0
            objTotal.spy = (sendTotalObj["spy"] > 0) ? obj.spy : 0
            objTotal.speedTroop = "spy"

            if(obj.archer != undefined )
                objTotal.archer = 0

        }
        objTotal.axe = 0
        objTotal.light = 0
        if(obj.marcher != undefined )
            objTotal.marcher = 0
            

        // if(!game_data.units.includes("archer"))
        //     delete objTotal.archer

        listTotal.push(objTotal)
    })
    console.log(listTotal)

    let listTotalRange = [];
    listTotal.forEach(row=>{
        if(row.speedTroop != undefined){
            listTotalRange.push(row)
        }
    })

    let factorTroopSent = {}
    sendTotal.forEach(elem => {
        factorTroopSent[elem.troopName] = elem.value/listTotalRange.length
    })

    console.log(factorTroopSent)

    let mapResult = new Map()
    Object.keys(factorTroopSent).forEach(troopName=>{
        let factorValue = factorTroopSent[troopName]


        listTotalRange.sort((o1,o2)=>{
            return o1[troopName] > o2[troopName] ? 1 : o1[troopName] < o2[troopName] ? -1 : 0
        })
        console.log(listTotalRange)
        


        for(let i=0;i<listTotalRange.length;i++){
            let troopValue = listTotalRange[i][troopName]

            if(troopValue < factorValue){
                let redistribute = factorValue - troopValue
                factorValue += redistribute/(listTotalRange.length-i-1)
                listTotalRange[i][troopName] = troopValue
            }
            else{
                let module = factorValue % parseInt(factorValue)

                if(listTotalRange[i][troopName] + 1 > factorValue){
                    let randomValue = (Math.random() < module) ? 1 : 0
                    listTotalRange[i][troopName] = parseInt(factorValue) + randomValue
                }
                else{
                    listTotalRange[i][troopName] = factorValue
                    console.log(`troop name ${troopName}, value: ${listTotalRange[i][troopName]}`)
                }
            }
            let timeWindow = document.getElementById("checkbox_window").checked

            if(listTotalRange[i]["speedTroop"] == troopName && listTotalRange[i][troopName] == 0 && timeWindow == true){
                listTotalRange[i][troopName] = 1
            }
            if(timeWindow == false){
                listTotalRange[i]["ram"] = 0
                listTotalRange[i]["catapult"] = 0
            }

            mapResult.set(listTotalRange[i].coord, listTotalRange[i])
        


        }
    
    })
    console.log(mapResult)


    let table = Array.from($(".overview_table .selected"))
    table.forEach(row=>{
        let coord = row.children[0].innerText.match(/\d+\|\d+/).pop()
        if(mapResult.has(coord)){
            let obj = mapResult.get(coord)
            console.log(obj)
            let totalTroopCount = 0
            Object.keys(obj).forEach(troopName=>{
                if(troopName != "speedTroop" && troopName != "coord")
                    totalTroopCount += obj[troopName]
            })

            if(totalTroopCount > 1){
                Object.keys(obj).forEach(troopName=>{
                    if(troopName != "speedTroop"){
                        let value = obj[troopName]
                        $(row).find(`.call-unit-box-${troopName}`).val(value)
    
                    }
                })
            }
        }
    })


    // document.getElementById("fillInputs").disabled=true;

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

function hitCountApi(){
    $.getJSON(`https://api.counterapi.dev/v1/${countNameSpace}/${countApiKey}/up`, response=>{
        console.log(`This script has been run: ${response.count} times`);
    });
    if(game_data.device !="desktop"){
        $.getJSON(`https://api.counterapi.dev/v1/${countNameSpace}/${countApiKey}_phone/up`, response=>{
            console.log(`This script has been run on mobile: ${response.count} times`);
        });
    }
 
    $.getJSON(`https://api.counterapi.dev/v1/${countNameSpace}/${countApiKey}_id2${game_data.player.id}/up`, response=>{
        if(response.count == 1){
            $.getJSON(`https://api.counterapi.dev/v1/${countNameSpace}/${countApiKey}_scriptUsers/up`, response=>{});
        }

    });

    try {
        $.getJSON(`https://api.counterapi.dev/v1/${countNameSpace}/${countApiKey}_scriptUsers`, response=>{
            console.log(`Total number of users: ${response.count}`);
        }); 
      
    } catch (error) {}

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