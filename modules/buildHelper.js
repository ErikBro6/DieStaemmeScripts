
(function() {
 
let wind = typeof unsafeWindow != 'undefined' ? unsafeWindow : window;
wind.ScriptAPI.register('690-Dorfaufbau-Helfer (Startphase)', true, 'suilenroc', 'support-nur-im-forum@die-staemme.de');
const nextBuildCache = { ts: 0, pending: false, data: null };
const incomingCache = { ts: 0, pending: false, data: null };
const marketGroupCache = { pending: false, data: null };

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
        updateNextBuildBox()
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
    updateNextBuildBox()
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

// Show next Account-Manager build entry in "Bauen" tab
function updateNextBuildBox() {
    if (!document.getElementById('buildings')) return;
    if (!nextBuildCache.pending) {
        fetchNextBuildInfo();
    }
    if (!incomingCache.pending && (Date.now() - incomingCache.ts > 30000 || !incomingCache.data)) {
        fetchIncomingForVillage();
    }
}

function fetchNextBuildInfo() {
    nextBuildCache.pending = true;
    const url = `${game_data.link_base_pure}main&mode=accountmanager&_=${Date.now()}`;
    $.ajax({ url, method: 'get', cache: false, success: (html)=>{
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            nextBuildCache.data = parseNextBuildInfo(doc);
            nextBuildCache.ts = Date.now();
        } catch (e) {
            nextBuildCache.data = null;
        }
        nextBuildCache.pending = false;
        renderNextBuildBox(nextBuildCache.data);
    }, error: ()=>{
        nextBuildCache.pending = false;
        nextBuildCache.data = null;
        renderNextBuildBox(null, true);
    }});
}

function parseNextBuildInfo(doc) {
    // Prefer "Nächster Bauauftrag" section
    const h4s = Array.from(doc.querySelectorAll('div.vis h4'));
    const nextHeader = h4s.find(h=>h.textContent.trim() === 'Nächster Bauauftrag');
    if (nextHeader) {
        const wrap = nextHeader.closest('div.vis');
        const link = wrap ? wrap.querySelector('a.inline-icon') : null;
        const name = link ? link.textContent.trim() : '';
        const classList = link ? Array.from(link.classList) : [];
        const buildingClass = classList.find(c=>c.indexOf('building-') === 0);
        const buildingKey = buildingClass ? buildingClass.replace('building-', '') : '';
        return buildingKey ? { buildingKey, name, level: null } : null;
    }
    // Account-Manager not active message
    const statusHeader = h4s.find(h=>h.textContent.trim() === 'Dorfstatus');
    if (statusHeader) {
        const wrap = statusHeader.closest('div.vis');
        const p = wrap ? wrap.querySelector('p.vis_item') : null;
        const msg = p ? p.textContent.trim() : '';
        if (msg) return { statusMessage: msg };
    }
    // Fallback: first queued entry
    const row = doc.querySelector('#buildqueue tr[class*="buildorder_"]');
    if (!row) return null;
    const classList = Array.from(row.classList);
    const buildClass = classList.find(c=>c.indexOf('buildorder_') === 0);
    const buildingKey = buildClass ? buildClass.replace('buildorder_', '') : '';
    const text = row.textContent || '';
    const lvlMatch = text.match(/Stufe\s*(\d+)/i);
    const level = lvlMatch ? parseInt(lvlMatch[1], 10) : null;
    const name = buildingKey ? buildingKey : '';
    return buildingKey ? { buildingKey, name, level } : null;
}

function renderNextBuildBox(data, isError) {
    const containerId = 'xd_next_build_box';
    let box = document.getElementById(containerId);
    if (!box) {
        const buildings = document.getElementById('buildings');
        if (!buildings) return;
        box = document.createElement('div');
        box.id = containerId;
        box.className = 'vis';
        buildings.parentElement.insertBefore(box, buildings);
    }
    if (isError) {
        box.innerHTML = `<h4>Nächster Bauauftrag</h4><p class="vis_item">Konnte Account-Manager nicht laden.</p>`;
        return;
    }
    if (!data || !data.buildingKey) {
        if (data && data.statusMessage) {
            box.innerHTML = `<h4>Nächster Bauauftrag</h4><p class="vis_item">${data.statusMessage}</p>`;
        } else {
            box.innerHTML = `<h4>Nächster Bauauftrag</h4><p class="vis_item">Kein Bauauftrag gefunden.</p>`;
        }
        return;
    }
    const buildingKey = data.buildingKey;
    const displayName = data.name || buildingKey;

    // Prefer current page build table costs/level (matches UI and AM constraints)
    const buildRow = document.getElementById(`main_buildrow_${buildingKey}`);
    let targetLvl = null;
    let wood = null;
    let stone = null;
    let iron = null;
    if (buildRow) {
        const link = buildRow.querySelector('a.btn-build[data-level-next]');
        if (link) {
            targetLvl = parseInt(link.getAttribute('data-level-next'), 10);
        }
        const woodTd = buildRow.querySelector('td.cost_wood[data-cost]');
        const stoneTd = buildRow.querySelector('td.cost_stone[data-cost]');
        const ironTd = buildRow.querySelector('td.cost_iron[data-cost]');
        if (woodTd && stoneTd && ironTd) {
            wood = parseInt(woodTd.getAttribute('data-cost'), 10);
            stone = parseInt(stoneTd.getAttribute('data-cost'), 10);
            iron = parseInt(ironTd.getAttribute('data-cost'), 10);
        }
    }
    if (targetLvl == null) {
        const currentLvl = game_data.village.buildings[buildingKey] || 0;
        targetLvl = data.level != null ? data.level : currentLvl + 1;
    }
    if (wood == null || stone == null || iron == null) {
        wood = buildCost(buildingKey, targetLvl, 'wood');
        stone = buildCost(buildingKey, targetLvl, 'stone');
        iron = buildCost(buildingKey, targetLvl, 'iron');
    }
    const curWood = readRes('wood');
    const curStone = readRes('stone');
    const curIron = readRes('iron');
    const inc = incomingCache.data;
    const incWood = inc ? inc.wood : 0;
    const incStone = inc ? inc.stone : 0;
    const incIron = inc ? inc.iron : 0;
    const totalWood = curWood != null ? curWood + incWood : null;
    const totalStone = curStone != null ? curStone + incStone : null;
    const totalIron = curIron != null ? curIron + incIron : null;
    const diffWood = totalWood != null ? totalWood - wood : null;
    const diffStone = totalStone != null ? totalStone - stone : null;
    const diffIron = totalIron != null ? totalIron - iron : null;
    const needWood = diffWood != null ? Math.max(0, -diffWood) : 0;
    const needStone = diffStone != null ? Math.max(0, -diffStone) : 0;
    const needIron = diffIron != null ? Math.max(0, -diffIron) : 0;
    const needsAny = (needWood + needStone + needIron) > 0;
    const diffHtml = (diffWood != null && diffStone != null && diffIron != null)
        ? `<span data-title="inkl. ankommend: ${numberWithCommas(incWood)}"><span class="icon header wood"></span>${formatDiff(diffWood)}</span>
            <span data-title="inkl. ankommend: ${numberWithCommas(incStone)}"><span class="icon header stone"></span>${formatDiff(diffStone)}</span>
            <span data-title="inkl. ankommend: ${numberWithCommas(incIron)}"><span class="icon header iron"></span>${formatDiff(diffIron)}</span>`
        : '';
    const structureKey = [
        buildingKey,
        targetLvl,
        needsAny ? 'need' : 'none',
        (marketGroupCache.data ? marketGroupCache.data.map(g=>g.id).join(',') : 'nogroups')
    ].join('|');
    if (box.dataset.structureKey !== structureKey) {
        box.dataset.structureKey = structureKey;
        const callControls = renderCallControls(needsAny);
        box.innerHTML = `<h4 id="xd_next_build_header">Nächster Bauauftrag</h4>
            <p class="vis_item" id="xd_next_build_name"></p>
            <p class="vis_item" id="xd_next_build_costs"></p>
            <p class="vis_item" id="xd_next_build_diff"></p>
            ${callControls}`;
    }
    const nameLine = document.getElementById('xd_next_build_name');
    if (nameLine) {
        nameLine.innerHTML = `<span class="inline-icon building-${buildingKey}">${displayName}</span> (Stufe ${targetLvl})`;
    }
    const costLine = document.getElementById('xd_next_build_costs');
    if (costLine) {
        costLine.innerHTML = `
            <span><span class="icon header wood"></span>${numberWithCommas(wood)}</span>
            <span><span class="icon header stone"></span>${numberWithCommas(stone)}</span>
            <span><span class="icon header iron"></span>${numberWithCommas(iron)}</span>`;
    }
    const diffLine = document.getElementById('xd_next_build_diff');
    if (diffLine) {
        diffLine.innerHTML = diffHtml;
    }
    bindCallControls(needWood, needStone, needIron, needsAny);
}

function readRes(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const raw = (el.textContent || '').replace(/[^\d]/g, '');
    return raw ? parseInt(raw, 10) : null;
}

function formatDiff(val) {
    const sign = val >= 0 ? '+' : '-';
    const color = val >= 0 ? 'green' : 'red';
    return `<span style="color:${color}">${sign}${numberWithCommas(Math.abs(val))}</span>`;
}

function fetchActiveOverviewGroupId() {
    const url = `${game_data.link_base_pure}overview_villages&type=all`;
    return $.get(url).then((html)=>{
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const selected = doc.querySelector('strong.group-menu-item');
        const id = selected ? selected.getAttribute('data-group-id') : null;
        return id || '0';
    });
}

function restoreGroupSelection(groupId) {
    const safeId = groupId != null ? groupId : '0';
    const urlOverview = `${game_data.link_base_pure}overview_villages&type=all&group=${safeId}`;
    const urlMarket = `${game_data.link_base_pure}market&mode=call&group=${safeId}`;
    $.get(urlOverview);
    $.get(urlMarket);
}

function renderCallControls(needsAny) {
    if (!needsAny) return '';
    const selected = marketGroupCache.selectedId || '0';
    const groupOptions = (marketGroupCache.data || [{ id: 0, label: 'alle' }])
        .map(g=>`<option value="${g.id}"${String(g.id) === String(selected) ? ' selected' : ''}>${g.label}</option>`)
        .join('');
    return `<div class="vis_item" id="xd_call_controls">
        <label style="margin-right:6px;">Gruppe:</label>
        <select id="xd_call_group">${groupOptions}</select>
        <button class="btn" id="xd_call_send" style="margin-left:8px;">Rohstoffe anfordern</button>
    </div>`;
}

function bindCallControls(needWood, needStone, needIron, needsAny) {
    if (!needsAny) return;
    const btn = document.getElementById('xd_call_send');
    if (!btn) return;
    btn.dataset.needWood = String(needWood);
    btn.dataset.needStone = String(needStone);
    btn.dataset.needIron = String(needIron);
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', (e)=>{
        e.preventDefault();
        const sel = document.getElementById('xd_call_group');
        const groupId = sel ? sel.value : '0';
        const doRequest = (restoreId) => {
            marketGroupCache.selectedId = groupId;
            requestResourcesFromGroup({
                wood: parseInt(btn.dataset.needWood || '0', 10),
                stone: parseInt(btn.dataset.needStone || '0', 10),
                iron: parseInt(btn.dataset.needIron || '0', 10),
                groupId: groupId,
                restoreGroupId: restoreId
            });
        };
        fetchActiveOverviewGroupId()
            .then((restoreId)=> doRequest(restoreId || '0'))
            .catch(()=> doRequest('0'));
    });
    const sel = document.getElementById('xd_call_group');
    if (sel && !sel.dataset.bound) {
        sel.dataset.bound = '1';
        if (marketGroupCache.selectedId) sel.value = marketGroupCache.selectedId;
        sel.addEventListener('change', ()=>{
            if (marketGroupCache.selectedId !== sel.value) {
                marketGroupCache.selectedId = sel.value;
            }
        });
        if (!marketGroupCache.data && !marketGroupCache.pending) {
            loadMarketGroups(()=> {
                // re-render box to refresh dropdown options
                renderNextBuildBox(nextBuildCache.data);
            });
        }
    }
}

function loadMarketGroups(onDone) {
    marketGroupCache.pending = true;
    const url = `${game_data.link_base_pure}market&mode=call`;
    $.get(url, (html)=>{
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            marketGroupCache.data = parseMarketGroups(doc);
        } catch (e) {
            marketGroupCache.data = null;
        }
        marketGroupCache.pending = false;
        if (onDone) onDone();
    }).fail(()=>{
        marketGroupCache.pending = false;
        if (onDone) onDone();
    });
}

function parseMarketGroups(doc) {
    const items = Array.from(doc.querySelectorAll('.group-menu-item'));
    if (!items.length) return null;
    const groups = [];
    items.forEach(el=>{
        const id = el.getAttribute('data-group-id');
        const label = (el.textContent || '').trim().replace(/^\s*>\s*|\s*<\s*$/g,'');
        if (id != null && label) groups.push({ id, label });
    });
    if (!groups.find(g=>g.id === '0')) {
        groups.unshift({ id: '0', label: 'alle' });
    }
    return groups;
}

function requestResourcesFromGroup({ wood, stone, iron, groupId, restoreGroupId }) {
    const need = { wood, stone, iron };
    const baseUrl = `${game_data.link_base_pure}market&mode=call&order=distance&dir=ASC&group=${groupId}`;
    $.get(baseUrl, (html)=>{
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const rows = Array.from(doc.querySelectorAll('tr.supply_location'));
        const launches = [];
        let remaining = { ...need };

        rows.forEach(row=>{
            if (remaining.wood + remaining.stone + remaining.iron <= 0) return;
            const villageId = row.getAttribute('data-village');
            if (!villageId) return;
            const traders = row.querySelector('td.traders');
            if (traders) {
                const txt = traders.textContent || '';
                const available = parseInt(txt.split('/')[0].replace(/[^\d]/g, ''), 10);
                if (!available) return;
            }
            const resWood = parseInt(row.querySelector('td.wood')?.getAttribute('data-res') || '0', 10);
            const resStone = parseInt(row.querySelector('td.stone')?.getAttribute('data-res') || '0', 10);
            const resIron = parseInt(row.querySelector('td.iron')?.getAttribute('data-res') || '0', 10);

            const sendWood = Math.min(remaining.wood, resWood);
            const sendStone = Math.min(remaining.stone, resStone);
            const sendIron = Math.min(remaining.iron, resIron);
            if (sendWood + sendStone + sendIron <= 0) return;
            launches.push({
                villageId,
                wood: sendWood,
                stone: sendStone,
                iron: sendIron
            });

            remaining.wood -= sendWood;
            remaining.stone -= sendStone;
            remaining.iron -= sendIron;
        });

        if (launches.length === 0) {
            UI.ErrorMessage("Keine passenden Dörfer für die Anforderung gefunden.", 4000);
            return;
        }

        const targetId = game_data.village.id;
        let idx = 0;
        const sendNext = () => {
            if (idx >= launches.length) {
                UI.SuccessMessage("Rohstoffe angefordert.", 4000);
                incomingCache.ts = 0;
                incomingCache.data = null;
                fetchIncomingForVillage();
                if (restoreGroupId != null) {
                    marketGroupCache.selectedId = restoreGroupId;
                    const sel = document.getElementById('xd_call_group');
                    if (sel) sel.value = restoreGroupId;
                    restoreGroupSelection(restoreGroupId);
                }
                renderNextBuildBox(nextBuildCache.data);
                return;
            }
            const l = launches[idx++];
            TribalWars.post(
                "market",
                { ajaxaction: "map_send", village: l.villageId },
                { target_id: targetId, wood: l.wood, stone: l.stone, iron: l.iron },
                function (resp) {
                    if (resp && resp.error) {
                        UI.ErrorMessage(resp.error, 4000);
                    }
                    // small delay to avoid server spam
                    window.setTimeout(sendNext, 200);
                },
                false
            );
        };
        sendNext();
    }).fail(()=>{
        UI.ErrorMessage("Markt-Seite konnte nicht geladen werden.", 4000);
    });
}

function fetchIncomingForVillage() {
    incomingCache.pending = true;
    const baseUrl = game_data.link_base_pure + "overview_villages&mode=trader&type=inc";
    $.get(baseUrl, (data)=>{
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(data, "text/html");
        let list_pages = [];

        if ($(htmlDoc).find(".paged-nav-item").parent().find("select").length > 0) {
            Array.from($(htmlDoc).find(".paged-nav-item").parent().find("select").find("option")).forEach(function (item) {
                list_pages.push(item.value);
            });
            list_pages.pop();
        } else if (htmlDoc.getElementsByClassName("paged-nav-item").length > 0) {
            let nr = 0;
            Array.from(htmlDoc.getElementsByClassName("paged-nav-item")).forEach(function (item) {
                let current = item.href;
                current = current.split("page=")[0] + "page=" + nr;
                nr++;
                list_pages.push(current);
            });
        } else {
            list_pages.push(baseUrl);
        }
        list_pages = list_pages.reverse();

        const total = { wood: 0, stone: 0, iron: 0 };
        const coordTarget = `${game_data.village.x}|${game_data.village.y}`;

        function extractCoord(row) {
            try {
                if (row.children && row.children[4]) {
                    const m = row.children[4].innerText.match(/[0-9]{3}\|[0-9]{3}/);
                    if (m) return m[0];
                }
                if (row.children && row.children[3]) {
                    const m = row.children[3].innerText.match(/[0-9]{3}\|[0-9]{3}/g);
                    if (m && m[1]) return m[1];
                    if (m && m[0]) return m[0];
                }
            } catch (_) {}
            const m = (row.textContent || "").match(/[0-9]{3}\|[0-9]{3}/g);
            if (m && m.length > 0) return m[m.length - 1];
            return null;
        }

        function parseIncoming(doc) {
            let rows = Array.from($(doc).find(".row_a, .row_b"));
            for (let i = 0; i < rows.length; i++) {
                const coord = extractCoord(rows[i]);
                if (coord !== coordTarget) continue;
                const wood = parseInt($(rows[i]).find(".wood").parent().text().replace(/[^\d]/g, ""), 10) || 0;
                const stone = parseInt($(rows[i]).find(".stone").parent().text().replace(/[^\d]/g, ""), 10) || 0;
                const iron = parseInt($(rows[i]).find(".iron").parent().text().replace(/[^\d]/g, ""), 10) || 0;
                total.wood += wood;
                total.stone += stone;
                total.iron += iron;
            }
        }

        function ajaxRequest(urls) {
            let current_url;
            if (urls.length > 0) {
                current_url = urls.pop();
            } else {
                current_url = "stop";
            }
            if (urls.length >= 0 && current_url !== "stop") {
                $.ajax({
                    url: current_url,
                    method: "get",
                    success: (resp) => {
                        const doc = parser.parseFromString(resp, "text/html");
                        parseIncoming(doc);
                        window.setTimeout(function () {
                            ajaxRequest(urls);
                        }, 200);
                    },
                    error: () => {
                        incomingCache.pending = false;
                        incomingCache.data = null;
                    },
                });
            } else {
                incomingCache.data = total;
                incomingCache.ts = Date.now();
                incomingCache.pending = false;
                renderNextBuildBox(nextBuildCache.data);
            }
        }
        ajaxRequest(list_pages);
    }).fail(()=>{
        incomingCache.pending = false;
        incomingCache.data = null;
    });
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
 
