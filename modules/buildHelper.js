
(function() {
 
let wind = typeof unsafeWindow != 'undefined' ? unsafeWindow : window;
wind.ScriptAPI.register('690-Dorfaufbau-Helfer (Startphase)', true, 'suilenroc', 'support-nur-im-forum@die-staemme.de');

let SettingsHelper;           // <— declare in module scope so strict-mode is happy


function setupConfig() {
    //defines variables with default values if not set
    function setup(name, defaultValue) {
        if (typeof window[name] === 'undefined')
            window[name] = defaultValue
    }
    setup('suoc_ppAverage', 64)
    setup('suoc_greenPPcount', 30)
    setup('suoc_yellowPPcount', 25)
    setup('suoc_quest', true)
}
 
function startInterval() {
    setInterval(()=>{
        if ($('[id*=xd_custom]').length === 0 && $('#build_queue').length !== 0) {
            updateQue()
            updateBuildingInfo()
        } else if ($('#build_queue #xd_custom').length === 0 && $('[id*=xd_custom]').length !== 0) {
            updateQue()
        }
        updateInactive()
const firstCustom = $("#xd_custom")[0];
if (firstCustom && typeof firstCustom.tooltipText !== "string") {
    $('[id*=xd_custom]').each((i,e)=>UI.ToolTip($(e)));
}

    }
    , 1000)
}
 
//
setupConfig()
initSettingsHelper()
if (SettingsHelper.checkConfigs()) {
    updateQue()
    updateBuildingInfo()
    startInterval()
}
 
//Village
 
function getStorage(lvl) {
    return Math.round(1000 * Math.pow(1.2294934, (parseInt(lvl ? lvl : game_data.village.buildings.storage) - 1)))
}
 
function getFarm(lvl) {
    return Math.round(240 * Math.pow(1.17210245334, (parseInt(lvl ? lvl : game_data.village.buildings.farm) - 1)))
}
 
function getMarket(lvl) {
    let marketTradesmen = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 19, 26, 35, 46, 59, 74, 91, 110, 131, 154, 179, 206, 235]
    return marketTradesmen[parseInt(lvl ? lvl : game_data.village.buildings.market)]
}
 
function getResProduction(lvl, type) {
    return Math.round(parseFloat(SettingsHelper.getServerConf().game.base_production) * parseFloat(SettingsHelper.getServerConf().speed) * Math.pow(1.163118, (parseInt(lvl ? lvl : type ? game_data.village.buildings[type] : null) - 1)) * (type && game_data.village.bonus != null && game_data.village.bonus[type] != null ? game_data.village.bonus[type] : 1))
}
 
function amortisation(type){
    const building = BuildingMain.buildings[type];
    const cheap_cost = building.wood_cheap + building.stone_cheap + building.iron_cheap;
    return cheap_cost / (getResProduction(building.level_next, type) - getResProduction(building.level_next - 1, type));
}
wind.amortisation = amortisation;   // expose if others call it

 
function hqFactor(lvl) {
    return Math.pow(1.05, (-parseInt(lvl ? lvl : game_data.village.buildings.main)))
    //Math.pow(0.952381, parseInt(lvl? lvl:game_data.village.buildings.main))
}
 
function buildTime(building, lvl, hqlvl) {
    const special_factor = [0.01, 0.01, 0.16, 0.50, 0.96, 1.51, 2.16, 2.92, 3.83, 4.89];
    const buld_time_factor = [1.259, 1.245, 1.233, 1.225, 1.218, 1.213, 1.209, 1.205, 1.203, 1.200, 1.198, 1.196, 1.195, 1.194, 1.193, 1.192, 1.191, 1.189, 1.189, 1.188];
    const speed = parseFloat(SettingsHelper.getServerConf().speed) || 1;  // fetch when called
    const base = SettingsHelper.getBuildConf()[building]['build_time'] / speed;
    return (lvl > 10 ? buildTime(building, lvl - 1, hqlvl) * (Math.pow(1.2, (lvl - 1))) : special_factor[lvl - 1] * base) * hqFactor(hqlvl);
}

 
function buildCost(building, lvl, res) {
    return Math.round((SettingsHelper.getBuildConf()[building][res]) * (Math.pow(SettingsHelper.getBuildConf()[building][res + '_factor'], (parseInt(lvl) - 1))))
}
 
function buildCostSum(building, lvl) {
    return buildCost(building, lvl, 'wood') + buildCost(building, lvl, 'stone') + buildCost(building, lvl, 'iron')
}
 
function convertToSeconds(time) {
    let[h,m,s] = time.split(':');
    return (parseInt(h) * 60 + parseInt(m)) * 60 + parseInt(s)
}
 
function numberWithCommas(x) {
    const value = new Intl.NumberFormat("de-DE").format(x);
    // short → show as is; medium → “K”; long → “Mio”
    if (value.length < 6) return value;
    if (value.length < 10) return value.substr(0, value.length - 4) + 'K ';
    return value.substr(0, value.length - 8) + 'Mio ';
}

 
function range(start, end) {
    return Array(end - start + 1).fill().map((_,idx)=>start + idx)
}
 
function updateInactive() {
    if($('#buildings_unmet > tbody > tr > td:nth-child(2) > div > span > span:has(span.inactive) ').length==0){
        return 0;
    }
    $('#buildings_unmet > tbody > tr > td:nth-child(2) > div > span > span:has(span.inactive) ').each((i,e)=>{
        let building = $(e).find('img').get(0).src.split(`grey/`)[1].split(/[0-9]/)[0];
        let targetLvl = parseInt($(e).find('span').get(0).innerHTML.replace(/\D/g, ''));
        let startLvl = parseInt($(`[id*="main_buildlink_${building}"].btn-build`).attr('data-level-next')) ?? game_data.village.buildings[building] + 1;
        if (targetLvl >= startLvl) {
            let wood = range(startLvl, targetLvl).map((e,i)=>buildCost(building, e, "wood"));
            wood = wood.map((e,i)=>parseInt((e * 0.1 <= 150 ? e - 150 : e * 0.1 >= 2000 ? e - 2000 : e * 0.9).toFixed(0)))
            let stone = range(startLvl, targetLvl).map((e,i)=>buildCost(building, e, "stone"));
            stone = stone.map((e,i)=>parseInt((e * 0.1 <= 150 ? e - 150 : e * 0.1 >= 2000 ? e - 2000 : e * 0.9).toFixed(0)))
            let iron = range(startLvl, targetLvl).map((e,i)=>buildCost(building, e, "iron"));
            iron = iron.map((e,i)=>parseInt((e * 0.1 <= 150 ? e - 150 : e * 0.1 >= 2000 ? e - 2000 : e * 0.9).toFixed(0)))
            let data_title = ` Level ${startLvl} bis ${targetLvl}<br> Kosten - Belohnung :<br />
 
<span><span class="icon header wood"> </span>${numberWithCommas(wood.reduce((a,b)=>a + b, 0))}</span><br/>
<span><span class="icon header stone"> </span>${numberWithCommas(stone.reduce((a,b)=>a + b, 0))}</span><br/>
<span><span class="icon header iron" > </span>${numberWithCommas(iron.reduce((a,b)=>a + b, 0))}</span>`
            $(e).parent().attr('data-title', data_title);
            UI.ToolTip($(e).parent())
        }
    }
    )
}
 
function updateQue() {
    let que = $('tbody#buildqueue tr[class*="buildorder_"]')
    que.each((i,e)=>{
        let tdQue = $(e).find('td')
        if (!e.building) {
            e.building = e.classList[e.classList.length - 1].replace('buildorder_', '')
            e.lvl = tdQue[0].innerText.replace(/\D/g, '')
            e.time = convertToSeconds(tdQue[1].innerText)
            e.resProd = e.building.match('stone|wood|iron') ? getResProduction(e.lvl, e.building) - getResProduction(e.lvl - 1, e.building) : 0
        }
        let html = (e.resProd ? `<span id="xd_custom" style="color: green; float: right; margin-right: 0.7em;" data-title="zus\u00e4tzliche Produktion\nInsgesamt ${getResProduction(e.lvl, e.building)}">+${e.resProd}</span>` : '<span id="xd_custom"</span>')
        html = e.building.match('storage') ? `<span id="xd_custom" style="color: brown; float: right; margin-right: 0.7em;" data-title="Speicherkapazit\u00e4t"> ${numberWithCommas(getStorage(e.lvl))}</span>` : html
        html = e.building.match('farm') ? `<span id="xd_custom" style="color: blue; float: right; margin-right: 0.7em;" data-title="Maximale Bev\u00f6lkerung"> ${getFarm(e.lvl)}</span>` : html
        html = e.building.match('market') ? `<span id="xd_custom" style="color: blue; float: right; margin-right: 0.7em;" data-title="H\u00e4ndleranzahl"> ${getMarket(e.lvl)}</span>` : html
        $(tdQue[0]).html(tdQue[0].innerHTML + html)
    }
    )
    if ($('.btn-instant,.btn-btr,.btn-bcr').length !== 0) {
        que.each((i,e)=>{
            let tdQue = $(e).find('td')
            let combinedProd = que.filter(index=>index >= i).get().reduce((a,b)=>a + b.resProd, 0)
            let moreRes = Math.round(combinedProd * (e.time / 2 / 3600))
            let html = moreRes !== 0 && !(e.time < 300 && i > 0) ? `<span id="xd_custom" style="color: green;" data-title="zus\u00e4tzliche Rohstoffe produziert bei verk\u00fcrzung und gleichbleibender Bauschleife">+${moreRes}</span>` : ''
            $(tdQue[2]).html(tdQue[2].innerHTML + html)
        }
        )
    }
}
 
function updateBuildingInfo() {
    const isPPWorld = 0 !== parseInt(game_data.world.replace('de', '')) % 2;
    function gid(id) {
        return document.getElementById(id);
    }
    if ($('#building_wrapper').length > 0) {
        if (isPPWorld) {
            $('#buildings > tbody > tr:nth-child(1) > th:nth-child(3)').append($(`<span id="xd_custom" style="margin-left: 30%; font-size: smaller; float: right; margin-right: 0.7em;" data-title="Wert kann in der Configuration des USerscripts angepasst werden.\nWird verwendet f\u00fcr die Berechnung der Kostenreduktion und Amortisation\nGrenzenwerte ab wie vielen PPs Kosten einsparung Felder Gr\u00fcn oder Gelb \nhinterlegt werden sollen.">1pp = ${suoc_ppAverage}res</span>`))
        }
        const protab = gid("buildings");
        const zeile = protab.getElementsByTagName('tr');
        for (let i = 1; i < zeile.length; i++) {
            let gesamt = 0;
            const spalten = zeile[i].getElementsByTagName('td');
            let costTable = [0, 0, 0]
            if (spalten) {
                for (let j = 1; j < spalten.length; j++) {
                    if (spalten[j].hasAttribute("data-cost")) {
                        let cost = parseInt(spalten[j].getAttribute("data-cost"));
                        costTable[j - 1] = cost;
                        gesamt = gesamt + cost;
                    }
                }
            }
            const building_name = zeile[i].getAttribute("id").substr(14);
            const inactive = spalten[1].classList.contains('inactive');
            if (suoc_quest && gesamt <= 400 && inactive === false) {
                //400 is the minimal quest reward for a building level 150 150 100
                const last = spalten[spalten.length - 1];
                if (costTable[0] > 150 || costTable[1] > 150 || costTable[2] > 100) {
                    last.title = 'Quest Belohnung > Gesamtkosten, \naber Einzelkosten < Belohnung bei Holz,Lehm oder Eisen  ';
                    last.style.background = '#2fffff';
                } else {
                    last.title = 'Quest Belohnung > Gesamtkosten '
                    last.style.background = '#2fff89';
                }
            }
 
            if (isPPWorld) {
                const cheap = spalten[spalten.length - 1];
                const savedPP = (suoc_ppAverage !== 0 ? (Math.round((gesamt * 0.2 / suoc_ppAverage) * 10) / 10) : 0);
                cheap.title = suoc_ppAverage !== 0 && !inactive ? `Kosten reduzierung spart dir \n${numberWithCommas(Math.round(gesamt * 0.2))} Rohstoffe = ${savedPP} PPs` : ''
                if (suoc_ppAverage !== 0 && savedPP >= suoc_greenPPcount) {
                    cheap.style.background = 'springgreen';
                } else if (suoc_ppAverage !== 0 && savedPP >= suoc_yellowPPcount) {
                    cheap.style.background = '#f2ff2f';
                }
            }
            const isProd = building_name.match('iron|wood|stone');
            if ((isProd || building_name.match('storage|farm|market')) && !inactive) {
                let elem = spalten[6].getElementsByTagName('a')[1] !== undefined ? spalten[6].getElementsByTagName('a')[1] : spalten[6].getElementsByTagName('a')[0]
                const next_lvl = elem.attributes['data-level-next'].value * 1;
                let resProd = isProd ? getResProduction(next_lvl, building_name) - getResProduction(next_lvl - 1, building_name) : 0
                let questAdaption = (costTable)=>{
                    if (!suoc_quest)
                        return 0
                    let reduced = 0;
                    for (let j = 0; j < costTable.length; j++) {
                        if (j === 2) {
                            if (costTable[j] < 1000) {
                                reduced += 100
                            } else if (costTable[j] > 20000) {
                                reduced += 2000
                            } else {
                                reduced += costTable[j] * 0.1
                            }
                        } else {
                            if (costTable[j] < 1500) {
                                reduced += 150
                            } else if (costTable[j] > 30000) {
                                reduced += 2000
                            } else {
                                reduced += costTable[j] * 0.1
                            }
                        }
                    }
                    return reduced
                }
                let html = (isProd ? `<span id="xd_custom" style="color: green; float: right; margin-right: 0.7em;" data-title="Produktion bei Level ${next_lvl} = ${getResProduction(next_lvl, building_name)} \nKosten armotisiert in ${Math.round((gesamt - questAdaption(costTable)) / resProd * 10) / 10}h
                            ${!isPPWorld ? '' : ('\noder mit -20% in ' + (Math.round(((gesamt * 0.8) - questAdaption(costTable)) / resProd * 10) / 10) + 'h')}">+${resProd}</span>` : '<span id="xd_custom"</span>')
                html = building_name.match('storage') ? `<span id="xd_custom" style="color: brown; float: right; margin-right: 0.7em;" data-title="Speicherkapazit\u00e4t bei Level ${next_lvl}"> ${numberWithCommas(getStorage(next_lvl))}</span>` : html
                html = building_name.match('farm') ? `<span id="xd_custom" style="color: blue; float: right; margin-right: 0.7em;" data-title="Maximale Bev\u00f6lkerung bei Level ${next_lvl}"> ${getFarm(next_lvl)}</span>` : html
                html = building_name.match('market') ? `<span id="xd_custom" style="color: blue; float: right; margin-right: 0.7em;" data-title="H\u00e4ndleranzahl bei Level ${next_lvl} \n +${next_lvl !== 0 ? getMarket(next_lvl) - getMarket(next_lvl - 1) : getMarket(next_lvl)} H\u00e4ndler"> ${getMarket(next_lvl)}</span>` : html
                $(spalten[0]).html(spalten[0].innerHTML + html)
            }
        }
    }
}
 
//same as is DS-UI-erweitert
function initSettingsHelper() {
    SettingsHelper = {
        serverConf: null,
        unitConf: null,
        buildConf: null,
 
        loadSettings(type) {
            const settingUrls = {
                server: {
                    path: 'server_settings_',
                    url: '/interface.php?func=get_config'
                },
                unit: {
                    path: 'unit_settings_',
                    url: '/interface.php?func=get_unit_info'
                },
                building: {
                    path: 'building_settings_',
                    url: '/interface.php?func=get_building_info'
                }
            };
            if (typeof settingUrls[type] != 'undefined') {
                var win = typeof unsafeWindow != 'undefined' ? unsafeWindow : window;
                const path = settingUrls[type].path + win.game_data.world;
                if (win.localStorage.getItem(path) == null) {
                    const oRequest = new XMLHttpRequest();
                    const sURL = 'https://' + window.location.hostname + settingUrls[type].url;
                    oRequest.open('GET', sURL, 0);
                    oRequest.send(null);
                    if (oRequest.status !== 200) {
                        throw "Error executing XMLHttpRequest call to get Config! " + oRequest.status;
                    }
                    win.localStorage.setItem(path, JSON.stringify(this.xmlToJson(oRequest.responseXML).config))
                }
                return JSON.parse(win.localStorage.getItem(path))
            }
        },
        //Helper deepXmlConverter method for easy access of config values
        xmlToJson(xml) {
            // Create the return object
            let obj = {};
            if (xml.nodeType === 1) {
                // element
                // do attributes
                if (xml.attributes.length > 0) {
                    obj["@attributes"] = {};
                    for (let j = 0; j < xml.attributes.length; j++) {
                        const attribute = xml.attributes.item(j);
                        obj["@attributes"][attribute.nodeName] = isNaN(parseFloat(attribute.nodeValue)) ? attribute.nodeValue : parseFloat(attribute.nodeValue);
                    }
                }
            } else if (xml.nodeType === 3) {
                // text
                obj = xml.nodeValue;
            }
            // do children
            // If all text nodes inside, get concatenated text from them.
            const textNodes = [].slice.call(xml.childNodes).filter(function(node) {
                return node.nodeType === 3;
            });
            if (xml.hasChildNodes() && xml.childNodes.length === textNodes.length) {
                obj = [].slice.call(xml.childNodes).reduce(function(text, node) {
                    return text + node.nodeValue;
                }, "");
            } else if (xml.hasChildNodes()) {
                for (let i = 0; i < xml.childNodes.length; i++) {
                    const item = xml.childNodes.item(i);
                    const nodeName = item.nodeName;
                    if (typeof obj[nodeName] == "undefined") {
                        obj[nodeName] = this.xmlToJson(item);
                    } else {
                        if (typeof obj[nodeName].push == "undefined") {
                            const old = obj[nodeName];
                            obj[nodeName] = [];
                            obj[nodeName].push(old);
                        }
                        obj[nodeName].push(this.xmlToJson(item));
                    }
                }
            }
            return obj;
        },
        getServerConf() {
            if (!this.serverConf) {
                this.serverConf = JSON.parse(window.localStorage.getItem('server_settings_' + game_data.world))
            }
            return this.serverConf
        },
 
        getUnitConf() {
            if (!this.unitConf) {
                this.unitConf = JSON.parse(window.localStorage.getItem('unit_settings_' + game_data.world))
            }
            return this.unitConf
        },
 
        getBuildConf() {
            if (!this.buildConf) {
                this.buildConf = JSON.parse(window.localStorage.getItem('building_settings_' + game_data.world))
            }
            return this.buildConf
        },
 
        resetSettings() {
            localStorage.removeItem('server_settings_' + game_data.world)
            localStorage.removeItem('unit_settings_' + game_data.world)
            localStorage.removeItem('building_settings_' + game_data.world)
            this.serverConf = undefined
            this.unitConf = undefined
            this.buildConf = undefined
        },
 
        //Helper methods to load Settings
        missingConfigCheck() {
            setTimeout(()=>{
                if (this.getServerConf() != null && this.getUnitConf() != null && this.getBuildConf() != null) {
                    $(document.querySelector("#popup_box_config .popup_box_close")).click()
                } else {
                    $(document.querySelector("#popup_box_config .popup_box_close")).click()
                    this.checkConfigs()
                }
            }
            , 500)
        },
        checkConfigs() {
            const serverConf = this.getServerConf()
            const unitConf = this.getUnitConf()
            const buildConf = this.getBuildConf()
            if (serverConf != null && unitConf != null && buildConf != null)
                return true
            let buttonBar = serverConf == null ? `<br><button class="btn" onclick="SettingsHelper.loadSettings('server');$(this).replaceWith('<br>Server Einstelungen laden...');SettingsHelper.missingConfigCheck()">Lade Server Einstelungen</button>` : "<br>Server Einstelungen \u2705";
            buttonBar += unitConf == null ? `<br><br><button class="btn" onclick="SettingsHelper.loadSettings('unit');$(this).replaceWith('<br>Einheiten Einstelungen laden...');SettingsHelper.missingConfigCheck()">Lade Einheiten Einstelungen</button>` : "<br><br>Einheiten Einstelungen \u2705";
            buttonBar += buildConf == null ? `<br><br><button class="btn" onclick="SettingsHelper.loadSettings('building');$(this).replaceWith('<br>Geb\u00E4ude Einstelungen laden...');SettingsHelper.missingConfigCheck()">Lade Geb\u00E4ude Einstelungen</button>` : "<br><br>Geb\u00E4ude Einstelungen \u2705";
            Dialog.show("config", `<div class="center"><h2>Server Settings</h2><p>Werden f\u00FCr Funktionen des Skripts gebraucht</p>${buttonBar}</div>`)
            return false
        }
        
    };
    (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).SettingsHelper = SettingsHelper;
}
 
})();
 