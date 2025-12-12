// ==UserScript==
// @name         DS UI Erweitert
// @version      3.3
// @description  A minimal aproach to improve TW by displaying summed info of a page and adding filters
// @author       suilenroc, Get Drunk, ruingvar
// @include      https://*.die-staemme.de/game.php?*screen=place*
// @include      https://*.die-staemme.de/game.php?*screen=info_village*
// @include      https://*.die-staemme.de/game.php?*screen=overview_villages*
// @include      https://*.die-staemme.de/game.php?*screen=report*
// @include      https://*.die-staemme.de/game.php?*screen=flags*
// @include      https://*.die-staemme.de/game.php?*screen=ally*mode=members*
// @include      https://*.die-staemme.de/public_report/*
// @include      https://*.die-staemme.de/game.php?*screen=settings*
//CH Development Adaption
// @include      https://*.staemme.ch/game.php?*screen=place*
// @include      https://*.staemme.ch/game.php?*screen=info_village*
// @include      https://*.staemme.ch/game.php?*screen=overview_villages*
// @include      https://*.staemme.ch/game.php?*screen=report*
// @include      https://*.staemme.ch/game.php?*screen=flags*
// @include      https://*.staemme.ch/game.php?*screen=ally*mode=members*
// @include      https://*.staemme.ch/public_report/*
// @include      https://*.staemme.ch/game.php?*screen=settings*
 
// @license      MIT-Lizenz
 
/*Changelog
1.0 initial version + troop count and export + tablefilter + villageInfo ut summed
1.1 +mint ratio button
1.2 +smal text fixes + non paladin world support
1.3 mint Button removed (not rule conform)
2.0 added Report summary (attack,def, ut) + modified Massen-Unterstuetzung Zusammenfassung Get Drunk + standardDeviation calculation + added distance and filters + + summed return Troops
2.1 troop calculation fix and german letters
2.2 small Bugfix
2.3 added Troop count all own , forward report site added
2.4 transport summed
2.5 Flag Stats button
2.6 ally summed data
2.7 report sum survived troops
2.8 add config option
2.8.1 spy prod
2.8.2 fixed villageInfo return troops
2.8.3 added PP sum to Transport summary and Points in spy
2.8.4 back and send time in Reports
2.8.5 minor code cleanup and backtime calculation fix
2.8.6 CommandAndNotes sharing
2.8.7 Firefox fix
2.8.8 fixes res production calculation and error on the settings and tribe page
2.8.9 fixed support summary on non miliz worlds
2.9 added summed ut report preview
3.0 umlaut fixed and village info troop sum fix by ruingvar
3.0.1 Safari fix
3.1 Fix for release_8.288 (troopcount)
3.2 Fix for Mil+Bog+Pal+MS Worlds
3.3 Firefox and nonMs fix, removed var declarations
 
*/
 
/* Config Default Variables
var CopyAndExportButton = true
var OverviewVillages = true
var TroopCounter = true
var InfoVillage = true
var ReportBashPoints = true
var ReportSurvived = false
var MassSupport = true
var Transport = true
var FlagStats = true
var AllySummarie = true
var spear_bunker_value = 20000
var PlaceFilters = true
var ReportSpyInfo = true
var ReportTimes = true
var CommandAndNotesSharing = true
var ReportPreview = true
*/
 
function setupConfig() {
    //defines variables with default values if not set
    function setup(name, defaultValue) {
        if (typeof window[name] === 'undefined')
            window[name] = defaultValue
    }
    setup('CopyAndExportButton', true)
    setup('OverviewVillages', true)
    setup('TroopCounter', true)
    setup('InfoVillage', true)
    setup('ReportBashPoints', true)
    setup('ReportSurvived', false)
    setup('MassSupport', true)
    setup('Transport', true)
    setup('FlagStats', true)
    setup('AllySummarie', true)
    setup('spear_bunker_value', 20000)
    setup('PlaceFilters', true)
    setup('ReportSpyInfo', true)
    setup('ReportTimes', true)
    setup('CommandAndNotesSharing', true)
    setup('ReportPreview', true)
}
 
// ==/UserScript==
(function() {
        init()
 
        function init() {
            'use strict';
            let win = typeof unsafeWindow != 'undefined' ? unsafeWindow : window;
            win.ScriptAPI.register('315-DS-UI erweitern', true, 'suilenroc', 'support-nur-im-forum@die-staemme.de');
            try {
                setupConfig()
                initSettingsHelper()
                let screen = win.game_data.screen;
                let mode = win.game_data.mode;
                let unitAmount = win.game_data.units.length;
                switch (screen) {
                    case "place":
                        if (mode === "units" && gid("units_home") && PlaceFilters) {
                            tabelFilter('units_home', 2, -2, '')
                        }
                        if (mode === "call" && gid("village_troup_list") && MassSupport) {
                            sumMassSupport()
                        }
                        break;
                    case "overview_villages":
                        if (mode === "combined" || gid('combined_table')) {
                            addCopyButton();
                        } else if (mode === "prod" || gid("production_table")) {
                            if (OverviewVillages)
                                overviewVillages();
                            addCopyButton();
                        } else if (mode === "units" || gid("units_table")) {
                            if (TroopCounter)
                                troopCounter(unitAmount - (win.game_data.units.includes('knight') ? 2 : 1) - ((win.game_data.units.includes('militia') ? 1 : 0)))
                            if (CopyAndExportButton)
                                troopExport()
                        } else if ((mode === "trader" || gid("trades_table")) && Transport) {
                            sumTransports(false)
                        }
                        break;
                    case "info_village":
                        if (gid('withdraw_selected_units_village_info') && InfoVillage) {
                            sumTroopsInVillageInfo(unitAmount)
                            sumReturnSupport()
                            if ($("#withdraw_selected_units_village_info > table tr td:first").text() === "Aus diesem Dorf") {
                                tabelFilter("withdraw_selected_units_village_info", 4, -1, ':not(:last-child)')
                            } else {
                                tabelFilter("withdraw_selected_units_village_info", 3, -1, ':not(:last-child)')
                            }
 
                        }
                        break;
                    case "report":
                        if (window.location.href.includes('&view=') || mode === "view_public_report") {
                            if (ReportBashPoints)
                                sumBashPoints()
                            if (ReportSurvived)
                                survivedReport()
                            if (ReportTimes)
                                sendAndReTimes()
                            if (ReportSpyInfo)
                                spyInformation()
                        } else {
                            if (ReportPreview)
                                customReportPreview()
                        }
                        break;
                    case "flags":
                        if ($('table.modemenu td.selected a[href*="flags&mode=index"]').length === 1 && FlagStats) {
                            $('#content_value h2').append('<a id="ui_flag_stats" class="btn " style=" float: right;" href="#">Flaggen Zusammenfassung</a>')
                            document.querySelector("#ui_flag_stats").addEventListener('click', function() {
                                flagStats();
                            });
                        }
                        break;
                    case "ally":
                        //add selected player to links
                        if (AllySummarie) {
                            if (mode.includes("members")) {
                                $('#ally_content .modemenu td:gt(0) a').each((i,e)=>{
                                        let selected_player = $('[name*="player_id"] option[selected]').attr('value')
                                        e.href = selected_player === undefined ? e.href : e.href + "&player_id=" + selected_player
                                    }
                                )
                            }
                            if (mode === "members_defense") {
                                allyDeffSum()
                            } else if (mode === "members_troops") {
                                allyTroopSum()
                            }
                            break;
                        }
                    case "settings":
                        if ($('table.modemenu td.selected a').length > 0) {
                            if ((ReportTimes || ReportSpyInfo) && $('table.modemenu td.selected a').attr('href').includes('mode=settings')) {
                                $('#content_value > table > tbody > tr > td:nth-child(2) > h3').after(`<input class="btn" style="margin: 4px;" type="button" value="DS UI Erweitert gespeicherte Server Settings resetten" onclick="SettingsHelper.resetSettings(),UI.SuccessMessage('Gespeicherte Server Einstellungen fuer DS UI Erweitert entfernt')">`)
                            } else if (CommandAndNotesSharing && $('table.modemenu td.selected a').attr('href').includes('mode=command_sharing')) {
                                $('#content_value > table > tbody > tr > td:nth-child(2) > form:nth-child(4) > h3').after(`<p>Aufgelistet alle Spieler die ihre Befehle nicht mit ihnen geteilt haben:</p><textarea disabled="" name="text" style="height: 50px; margin: 0px; width: 98%;">${$('form tr:has(img[src*="error.png"]) td:nth-child(1)').get().map(e=>e.innerText).reduce((a,b)=>a + '; ' + b)}</textarea>`)
                            } else if (CommandAndNotesSharing && $('table.modemenu td.selected a').attr('href').includes('mode=village_notes_sharing')) {
                                $('#content_value > table > tbody > tr > td:nth-child(2) > form:nth-child(7) > h3').after(`<p>Aufgelistet alle Spieler die ihre Dorfnotizen nicht mit ihnen geteilt haben obwohl sie ihre geteilt haben:</p><textarea disabled="" name="text" style="height: 50px; margin: 0px; width: 98%;">${$('form tr:has(img[src*="error.png"]) td:nth-child(1)').get().map(e=>e.innerText).reduce((a,b)=>a + '; ' + b)}</textarea>`)
                            }
                        }
                        break;
                    default:
 
                }
            } catch (e) {
                //check if user is logged in and variables are set
                if (typeof game_data.units != 'undefined') {
                    UI.ErrorMessage("UserScript DS-UI-Erweitert hatte einen Fehler", 3000)
                    console.log(e)
                }
            }
        }
 
        function troopExport() {
            if ($('[class*="selected"] [href*="type=complete"]').length === 0) {
                return;
            }
            $('#units_table').find('th:nth-child(1)').append($('<button id="copy_troops" class="btn" style="margin-left: 1em;" title="Truppen werden f\u00FCr Workbench in die Zwischenablage kopiert " >WB</button>'));
            $('#copy_troops').click(()=>{
                    selectElementContents(document);
                }
            )
        }
 
        function selectElementContents(el) {
            let range;
            if (window.getSelection && document.createRange) {
                range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(el);
                sel.removeAllRanges();
                sel.addRange(range);
            } else if (document.body && document.body.createTextRange) {
                range = document.body.createTextRange();
                range.moveToElementText(el);
                range.select();
            }
            document.execCommand('copy')
            if (window.getSelection) {
                window.getSelection().removeAllRanges();
            } else if (document.selection) {
                document.selection.empty();
            }
        }
 
        function troopCounter(troopCount) {
            if ($('[class*="selected"] [href*="type=complete"]').length === 0) {
                return;
            }
 
            function sumUnits(array, rowNumber) {
                $('#units_table tr:nth-child(' + rowNumber + ')').map((i,e)=>Array.from(e.getElementsByTagName('td')).slice((rowNumber === 1 ? 2 : 1), troopCount + (rowNumber === 1 ? 2 : 1))).map((i, e)=>parseInt(e.innerText)).map((i, e)=>array[(i % (troopCount))] += e);
            }
            let unit_names = $('#units_table th img').splice(0, troopCount).map(e=>e.attributes["data-title"].value);
            let troops_away = Array.apply(null, Array(unit_names.length)).map(()=>0);
            let troops_all = Array.apply(null, Array(unit_names.length)).map(()=>0);
            let troops_running = Array.apply(null, Array(unit_names.length)).map(()=>0);
            let troops_home = Array.apply(null, Array(unit_names.length)).map(()=>0);
            let troops_inVillage = Array.apply(null, Array(unit_names.length)).map(()=>0);
            let troops_all_own = Array.apply(null, Array(unit_names.length)).map(()=>0);
 
            sumUnits(troops_home, 1);
            sumUnits(troops_inVillage, 2);
            sumUnits(troops_away, 3);
            sumUnits(troops_running, 4);
            sumUnits(troops_all, 5);
 
            sumUnits(troops_all_own, 1);
            sumUnits(troops_all_own, 3);
            sumUnits(troops_all_own, 4);
 
            const tbl = document.createElement("table");
            tbl.className = "vis";
            tbl.style = "width: 100%; padding-right: 10em; padding-left: 10em;"
            const nf = Intl.NumberFormat();
            let output = '<thead><tr><th>Truppen</th><th>Eigene</th><th>Im Dorf</th><th>Ausw\u00E4rts</th><th>Unterwegs</th><th title="Alle Eigenen Truppen">Eigene Gesamt</th><th title="Alle Eigene Truppen und UT Truppen in eigenen D\u00F6rfern">Ingesamt</th></tr></thead>';
            unit_names.forEach(()=>output += '');
            for (let i = 0; i < unit_names.length; i++) {
                output += "<tr><td style='color:blue; font-weight: bold;'>" + unit_names[i] + "</td><td style='color:red; text-align:right'>" + nf.format(troops_home[i]) + "</td><td style='color:red; text-align:right'>" + nf.format(troops_inVillage[i]) + "</td><td style='color:red; text-align:right'>" + nf.format(troops_away[i]) + "</td><td title='Alle eigenen und stationierten Truppen' style='color:red; text-align:right'>" + nf.format(troops_running[i]) + "</td><td style='color:red; text-align:right'>" + nf.format(troops_all_own[i]) + "</td><td style='color:red; text-align:right'>" + nf.format(troops_all[i]) + "</td></tr>";
            }
            tbl.innerHTML = output;
            document.querySelector("#paged_view_content > table.vis.modemenu").insertAdjacentElement("afterend", tbl);
        }
 
        function overviewVillages() {
            let doerferAnzahl = $('[id=production_table] tr').length - 1;
            if (doerferAnzahl !== -1) {
                let haendler = 0;
                $('[id=production_table] a[href*="screen=market"]').each((index,a)=>{
                        haendler += parseInt(a.innerText.split('/')[0]);
                    }
                );
                $('[id=production_table] th:nth-child(6)').append('<div>\u00D8 ' + parseInt(haendler / doerferAnzahl) + '</div>');
 
                let bhPlaetze = 0;
                $('[id=production_table] tr td:nth-child(7)').each((index,a)=>{
                        bhPlaetze += parseInt(a.innerText.split('/')[0]);
                    }
                );
                $('[id=production_table] th:nth-child(7)').append('<div>\u00D8 ' + numberWithCommas(parseInt(bhPlaetze / doerferAnzahl)) + '</div>');
 
                let points = 0;
                $('[id=production_table] tr td:nth-child(3)').each((index,td)=>{
                        points += parseInt(td.innerText.replace('.', ''));
                    }
                );
                $('[id=production_table] th:nth-child(3)').append('<div style="white-space: nowrap">\u00D8 ' + numberWithCommas(parseInt(points / doerferAnzahl)) + '</div>');
 
                const res = [0, 0, 0];
                const resStandardDeviation = [0, 0, 0];
                $('[id=production_table] tr td:nth-child(4) span').filter('.res , .warn , .warn_90').each((index,span)=>{
                        let resourc = parseInt(span.innerText.replace('.', ''))
                        res[index % 3] += resourc
                        resStandardDeviation[index % 3] += (resourc / 1000) * (resourc / 1000)
                    }
                );
                function standardDeviation(index) {
                    return numberWithCommas(parseInt(Math.sqrt(resStandardDeviation[index] / doerferAnzahl - (res[index] / 1000 / doerferAnzahl) * (res[index] / 1000 / doerferAnzahl))))
                }
                $('[id=production_table] th:nth-child(4)').append('<div><span class="res wood" title="\u00D8' + numberWithCommas(parseInt(res[0] / doerferAnzahl)) + ' Holz \n\u03C3  ' + standardDeviation(0) + '">' + numberWithCommas(res[0]) + '</span><span class="res stone" title="\u00D8 ' + numberWithCommas(parseInt(res[1] / doerferAnzahl)) + ' Lehm \n\u03C3  ' + standardDeviation(1) + '">' + numberWithCommas(res[1]) + '</span><span class="res iron" title="\u00D8 ' + numberWithCommas(parseInt(res[2] / doerferAnzahl)) + ' Eisen \n\u03C3  ' + standardDeviation(2) + '">' + numberWithCommas(res[2]) + '</span></div>');
                let storage = 0;
                $('[id=production_table] tr td:nth-child(5)').each((index,a)=>{
                        storage += parseInt(a.innerText.split('/')[0]);
                    }
                );
                $('[id=production_table] th:nth-child(5)').append('<div> ' + numberWithCommas(storage) + '</div>');
 
                function numberWithCommas(x) {
                    const value = new Intl.NumberFormat("de-DE").format(x);
                    return value.length < 10 ? value.length < 6 ? value : (value.substr(0, value.length - 4) + 'K ') : (value.substr(0, value.length - 8) + 'Mio ');
                }
            }
 
        }
 
        function gid(id) {
            return document.getElementById(id);
        }
 
        function sumTroopsInVillageInfo(truppenCount) {
            let trcnt = $("#withdraw_selected_units_village_info > table").find("tr").length;
            // sind keine unterstuetzungen im dorf existieren nur 2 rows, in diesem fall soll nichts gemacht werden da sonst bei doerfern ohne unterstuetzung die tabelle zerissen wird
            if (trcnt === 2)
                return;
 
            const cords = $('#content_value table:nth-child(1):first tr:nth-child(3) td:last').text().split('|');
            let truppen = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            let zeilen = $("#withdraw_selected_units_village_info > table tr").get()
            for (let i = 1; i < zeilen.length - 1; i++) {
                let spalten = zeilen[i].getElementsByTagName('td');
                for (let j = 0; j < truppenCount; j++) {
                    truppen[j] = truppen[j] + parseInt(spalten[j + 1].innerText);
                }
            }
            let sumDist = 0;
            let a = $("#withdraw_selected_units_village_info > table tr").get()[0].children[1]
            let cloneA = a.cloneNode(true)
            cloneA.innerHTML = '<th><img src="https://dsde.innogamescdn.com/asset/689698d9/graphic/rechts.png"></th>'
            a.before(cloneA)
            let ownVillageTroopRow = $('#withdraw_selected_units_village_info tr  td:first').text()
            const isOwnVillage = ownVillageTroopRow.includes('Aus diesem Dorf') || ownVillageTroopRow.includes('Us d\u00E4m Dorf');
            if(isOwnVillage)
                $('#withdraw_selected_units_village_info tr  td:first').after('<td></td>')
            $('#withdraw_selected_units_village_info a[href*="screen=info_village"]').each((i,e)=>{
                    let trCords = $(e).text().match(/\d{3}\|\d{3}/g)[0].split('|')
                    let distance = Math.round(Math.sqrt(Math.pow((parseInt(cords[0]) - parseInt(trCords[0])), 2) + Math.pow((parseInt(cords[1]) - parseInt(trCords[1])), 2)) * 10) / 10
                    sumDist += distance
                    $(e).parent().after('<td style="text-align:center">' + distance + '</td>')
                }
            )
            $("#withdraw_selected_units_village_info > table tr:last th").attr('colspan', 13)
 
            let header = zeilen[0].cloneNode(true);
            let hspalten = header.getElementsByTagName('th');
            hspalten[0].innerHTML = "Gesamt (" + (zeilen.length -(isOwnVillage?3:2)) + ")";
            hspalten[1].innerHTML = "\u00D8" + Math.round(sumDist / (zeilen.length - 2) * 10) / 10
            for (let x = 0; x < truppenCount; x++) {
                hspalten[x + 2].innerHTML = truppen[x];
            }
            hspalten[hspalten.length - 1].innerHTML = "";
            zeilen[0].insertAdjacentElement("afterend", header);
        }
 
        function tabelFilter(id, hcount, tcount, thSelector) {
            function comparer(index) {
                function getCellValue(row, index) {
                    return $(row).children('td').eq(index).text().replace('%', '')
                }
                return function(a, b) {
                    const valA = getCellValue(a, index)
                        , valB = getCellValue(b, index);
                    return $.isNumeric(valA) && $.isNumeric(valB) ? valA - valB : valA.toString().localeCompare(valB)
                }
            }
            $('[id=' + id + '] tr:first-child th' + thSelector).click(function() {
                let i;
                const table = $(this).parents('table').eq(0);
                let rows = table.find('tr');
                const head = rows.slice(0, hcount);
                const tale = tcount === 0 ? rows.slice(0, 0) : rows.slice(tcount);
                rows = (tcount === 0 ? rows.slice(hcount) : rows.slice(hcount, tcount)).toArray().sort(comparer($(this).index()))
                this.asc = !this.asc
                if (!this.asc) {
                    rows = rows.reverse()
                }
                for (i = 0; i < head.length; i++) {
                    table.append(head[i])
                }
                for (i = 0; i < rows.length; i++) {
                    table.append(rows[i])
                }
                for (i = 0; i < tale.length; i++) {
                    table.append(tale[i])
                }
            })
        }
 
        function copyTextToClipboard(text) {
            const textArea = document.createElement("textarea");
            textArea.style.position = 'fixed';
            textArea.style.top = 0;
            textArea.style.left = 0;
            textArea.style.width = '2em';
            textArea.style.height = '2em';
            textArea.style.padding = 0;
            textArea.style.border = 'none';
            textArea.style.outline = 'none';
            textArea.style.boxShadow = 'none';
            textArea.style.background = 'transparent';
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {//console.log('Oops, unable to copy'); //optional
            }
            document.body.removeChild(textArea);
        }
 
        function addCopyButton() {
            if (CopyAndExportButton) {
                let table = $('[id*=_table]');
                if (table.length !== 0) {
                    table.find('th:nth-child(2)').append($('<button id="copy_villages" class="btn" style="margin-left: 1em;">D\u00F6rfer kopieren</button>'))
                    document.querySelector("#copy_villages").addEventListener('click', function(event) {
                        let villageText = table.find('tr[class*=row] td:nth-child(2)').text().match(/\(\d{3}\|\d{3}\) K/g).join().match(/\d{3}\|\d{3}/g).join(' \n')
                        copyTextToClipboard(villageText);
                    });
                }
            }
        }
 
        function sumBashPoints() {
            //unterstuetzungs Bericht
            let tables = $('.report_ReportSupportAttackMerged').find("table.vis")
            if (tables.length > 0) {
                const display_units = game_data.units.filter((e) => e !== 'militia');
                let allUnits = new Array(display_units.length).fill(0)
                let lostUnits = new Array(display_units.length).fill(0)
                tables.find('tr:nth-child(2)').find('td.unit-item').each((i,e)=>{
                        let index = i % display_units.length
                        allUnits[index] += isNaN(parseInt(e.innerText)) ? 0 : parseInt(e.innerText)
                    }
                )
                tables.find('tr:nth-child(3)').find('td.unit-item').each((i,e)=>{
                        let index = i % display_units.length
                        lostUnits[index] += isNaN(parseInt(e.innerText)) ? 0 : parseInt(e.innerText)
                    }
                )
                let sumTable = $('<table>').append('<tbody>').append('<tr>')
                let th, tr1, tr2 = ""
                th += '<tr><th>Gesamt (' + tables.length + ')</th>'
                tr1 += '</tr><tr><td>Anzahl:</td>'
                tr2 += '</tr><tr><td>Verluste:</td>'
                for (let i = 0; i < display_units.length; i++) {
                    let unit = display_units[i]
                    th += '<th width="35"><a href="#" class="unit_link" data-unit="' + unit + '"><img src="https://dsde.innogamescdn.com/asset/689698d9/graphic/unit/unit_' + unit + '.png" alt="" ' + (allUnits[i] === 0 ? 'class="faded"' : 'class=""') + '></a></th>'
                    tr1 += '<td class="unit-item ' + (allUnits[i] === 0 ? 'hidden' : '') + '">' + allUnits[i] + '</td>'
                    tr2 += '<td class="unit-item ' + (lostUnits[i] === 0 ? 'hidden' : '') + '">' + lostUnits[i] + '</td>'
                }
                tr2 += '</tr>'
                $('.report_ReportSupportAttackMerged table:nth-child(1)').after($('<table>').append('<tbody>').append(th + tr1 + tr2))
                $('.report_ReportSupportAttackMerged table:nth-child(2)').next().after(`<button class="btn" id="toggleEntrys" >Alle anzeigen / ausblenden</button>`)
                $('.report_ReportSupportAttackMerged').children().filter((i)=>i > 3).toggle()
                document.getElementById('toggleEntrys').onclick = function() {
                    $('.report_ReportSupportAttackMerged').children().filter((i)=>i > 3).toggle()
                }
            }
            //angriff oder verteidigungs Bericht
            if ($('.report_ReportAttack')) {
                // Bashpoints
                const unit_points = {
                    //  def   att
                    'spear': [4, 1],
                    'sword': [5, 2],
                    'axe': [1, 4],
                    'archer': [5, 2],
                    'spy': [1, 2],
                    'light': [5, 13],
                    'marcher': [6, 12],
                    'heavy': [23, 15],
                    'ram': [4, 8],
                    'catapult': [12, 10],
                    'knight': [40, 20],
                    'priest': [0, 0],
                    'snob': [200, 200],
                    'militia': [4, 0],
                };
 
                let attackers_points = 0;
                let defender_points = 0;
                $('#attack_info_att_units tr:nth-child(3) td:gt(0)').each((i,e)=>{
                        attackers_points += parseInt(e.innerText) * unit_points[game_data.units[i]][1];
                    }
                )
                $('#attack_info_def_units tr:nth-child(3) td:gt(0)').each((i,e)=>{
                        defender_points += parseInt(e.innerText) * unit_points[game_data.units[i]][0];
                    }
                )
                if (attackers_points > 0)
                    $('#attack_info_att tbody tr:nth-child(1) th:nth-child(2)').append('<p style="float: right; display: inline; margin: auto;">ODD: ' + attackers_points + '</p>')
                if (defender_points > 0)
                    $('#attack_info_def tbody tr:nth-child(1) th:nth-child(2)').append('<p style="float: right; display: inline; margin: auto;">ODA: ' + defender_points + '</p>')
            }
        }
 
        function customReportPreview() {
 
            // Callback function to execute when mutations are observed
            const callback = function(mutationsList, observer) {
                const mutation = mutationsList[0]
                const headline = $('.report-preview-content table:first tbody tr th:first').text()
                const isUtPreview = headline.includes('tztes Dorf:') || headline.includes('tzts Dorf:')
                if (mutation.type === 'attributes' && mutation.target.style.display !== 'none' && isUtPreview && $('#custom_ut_sum').length === 0) {
                    sumPreviewUt()
                }
            };
 
            // Create an observer instance linked to the callback function
            const observer = new MutationObserver(callback);
            // Start observing the target node for configured mutations
            if ($('div.report-preview').length > 0) {
                observer.observe($('div.report-preview')[0], {
                    attributes: true
                });
            }
 
            function sumPreviewUt() {
                //unterstuetzungs Bericht Preview
                let tables = $('.report-preview-content').find("table.vis")
                if (tables.length > 0) {
                    const display_units = game_data.units.filter((e) => e !== 'militia');
                    let allUnits = new Array(display_units.length).fill(0)
                    let lostUnits = new Array(display_units.length).fill(0)
                    // count units
                    tables.find('tr:nth-child(2)').find('td.unit-item').each((i,e)=>{
                            let index = i % display_units.length
                            allUnits[index] += isNaN(parseInt(e.innerText)) ? 0 : parseInt(e.innerText)
                        }
                    )
                    //count lost units
                    tables.find('tr:nth-child(3)').find('td.unit-item').each((i,e)=>{
                            let index = i % display_units.length
                            lostUnits[index] += isNaN(parseInt(e.innerText)) ? 0 : parseInt(e.innerText)
                        }
                    )
                    // add html and adjust css and visibility
                    let th, tr1, tr2 = ""
                    th += '<tr><th>Gesamt (' + tables.length + ')</th>'
                    tr1 += '</tr><tr><td>Anzahl:</td>'
                    tr2 += '</tr><tr><td>Verluste:</td>'
                    for (let i = 0; i < display_units.length; i++) {
                        let unit = display_units[i]
                        th += '<th width="35"><a href="#" class="unit_link" data-unit="' + unit + '"><img src="https://dsde.innogamescdn.com/asset/689698d9/graphic/unit/unit_' + unit + '.png" alt="" ' + (allUnits[i] === 0 ? 'class="faded"' : 'class=""') + '></a></th>'
                        tr1 += '<td class="unit-item ' + (allUnits[i] === 0 ? 'hidden' : '') + '">' + allUnits[i] + '</td>'
                        tr2 += '<td class="unit-item ' + (lostUnits[i] === 0 ? 'hidden' : '') + '">' + lostUnits[i] + '</td>'
                    }
                    tr2 += '</tr>'
                    $('.report-preview-content table:nth-child(1)').after($('<table id="custom_ut_sum">').append('<tbody>').append(th + tr1 + tr2))
                    $('.report-preview').css('top', '')
                    $('.report-preview').css('transform', '')
                    $('.report-preview-content').children().filter((i)=>i > 1).toggle()
                }
            }
 
        }
 
        function survivedReport() {
            function surviveReport(type) {
                if ($(`#attack_info_${type}_units`).length > 0) {
                    $(`#attack_info_${type}_units tr:nth-child(3)`).after($(`#attack_info_${type}_units tr:nth-child(2)`)[0].outerHTML)
                    const loss = $(`#attack_info_${type}_units tr:nth-child(3) td`).get();
                    $(`#attack_info_${type}_units tr:nth-child(4) td`).each((i,e)=>{
                            if (i === 0) {
                                e.innerHTML = "\u00DCberlebt"
                                return
                            }
                            let all = parseInt(e.innerText)
                            let lost = loss[i].innerText
                            let survive = all - lost
                            e.innerText = survive
                            if (survive === 0)
                                e.classList.add("hidden")
                            if (lost !== 0)
                                e.title = Math.round(lost / all * 100) + '% Verluste'
                        }
                    )
                }
            }
            surviveReport("att")
            surviveReport("def")
        }
 
        function sumMassSupport() {
            /* The MIT License (MIT)
                        Copyright (c) 2021 Get Drunk
                        Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
                        The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
                        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
                        Version 0.2 slight changes by suilenroc (standardDeviation, distance, game_data use)
                        */
 
            const units_count = game_data.units.includes('militia') ? game_data.units.length - 2 : game_data.units.length - 1;
            const troops = new Array(units_count).fill(0);
            const standardDeviation = new Array(units_count).fill(0);
            let dist = 0;
            let distStandardDeviation = 0;
 
            $('#village_troup_list thead').append('<tr></tr>');
            // Select the node that will be observed for mutations
            // Callback function to execute when mutations are observed
            const callback = function() {
                //disconnect to doge loop
                if (observer) {
                    observer.disconnect()
                }
                troops.fill(0)
                standardDeviation.fill(0)
                dist = 0
                distStandardDeviation = 0;
                $('#village_troup_list tbody tr.selected').each(function() {
                    $(this).find('td[data-unit] input').each(function(index) {
                        let value = parseInt($(this).val() && !($(this)[0].disabled) ? $(this).val() : 0)
                        troops[index] += value
                        standardDeviation[index] += value * value
                    })
                    let distance = parseFloat($(this).find('td:nth-child(2)').text())
                    dist += distance
                    distStandardDeviation += distance * distance
                })
                let selectedCount = $('#village_troup_list tbody tr.selected').length
                let averDist = dist / selectedCount
                averDist = isNaN(averDist) ? 0 : averDist
                let standardDeviationTroopDist = Math.sqrt(distStandardDeviation / selectedCount - averDist * averDist)
                let output = "<td style='font-weight: bold;' title=''>Zusammenfassung<span class='note-icon village_note' style='  display: inline-block; margin-left: 0.5em;' title='Tooltip zeigen den Mittelwert und die Standartabweichung. Eine kleine Standardabweichung bedeutet, dass alle Werte nahe am Mittelwert liegen. Bei einer gro\u00DFen Standardabweichung sind die Werte weit um den Mittelwert gestreut.'></span></td><td style='font-weight: bold;' title='\u03C3  " + Math.round(standardDeviationTroopDist * 10) / 10 + "'>\u00D8 " + Math.round(averDist * 10) / 10 + "</td>";
                for (let i = 0; i < units_count; i++) {
                    let averTroop = troops[i] / selectedCount
                    let standardDeviationTroop = Math.sqrt(standardDeviation[i] / selectedCount - averTroop * averTroop)
                    output += "<td style='font-weight: bold;' title='\u00D8 " + Math.round(averTroop * 10) / 10 + "\n\u03C3  " + Math.round(standardDeviationTroop * 10) / 10 + "'> " + troops[i] + '</td>';
                }
                output += "<td style='font-weight: bold;' class='center'> <span class='icon header village'></span> " + selectedCount + '</td>';
                $('#village_troup_list thead tr:eq(1)').html(output);
                if (observer) {
                    observer.observe(document.getElementById('village_troup_list').getElementsByTagName('tbody')[0], {
                        attributes: true,
                        childList: true,
                        subtree: true,
                    })
                }
            }
            // Create an observer instance linked to the callback function
            // Start observing the target nodes for configured mutations
            const observer = new MutationObserver(callback);
            observer.observe(document.getElementById('village_troup_list').getElementsByTagName('tbody')[0], {
                attributes: true,
                childList: true,
                subtree: true,
            })
            $('#village_troup_list input.troop-request-selector').on('change', ()=>window.setTimeout(callback, 200))
            $('#village_troup_list input.call-unit-box').on('input', callback)
            $('.evt-button-fill').on('click', ()=>window.setTimeout(callback, 200))
        }
 
        function sumReturnSupport() {
            const troops = new Array(game_data.units.length).fill(0);
 
            $('#withdraw_selected_units_village_info tbody tr:nth-child(2)').after('<tr id="drawId"></tr>');
            // Select the node that will be observed for mutations
            // Callback function to execute when mutations are observed
            const callback = function() {
                //disconect to doge loop
                if (observer) {
                    observer.disconnect()
                }
                troops.fill(0)
                $('#withdraw_selected_units_village_info tbody tr:has(:checkbox:checked)').each(function() {
                    ownUntis = $(this).find('td.has-input input')
                    if (ownUntis.length !== 0) {
                        ownUntis.each(function(index) {
                            troops[index] += parseInt($(this).val() ? $(this).val() : 0)
                        })
                    } else {
                        $(this).find('td.unit-item').each(function(index) {
                            troops[index] += parseInt($(this).text() ? $(this).text() : 0)
                        })
                    }
                })
                let selectedCount = $('#withdraw_selected_units_village_info tbody tr:gt(1):has(:checkbox:checked)').length
                let output = "<th style='font-weight: bold; ' title='F\u00FCr den R\u00FCckzug ausgew\u00E4hlte Einheiten summiert'>Zur\u00FCckziehen </th><th style='font-weight: bold;'></th>";
                for (let i = 0; i < game_data.units.length; i++) {
                    output += "<th style='font-weight: bold; text-align:center'> " + troops[i] + '</th>';
                }
                output += "<th style='font-weight: bold;' class='center'> <span class='icon header village'></span> " + selectedCount + '</th>';
                $('#drawId').html(output);
                if (observer) {
                    observer.observe(document.getElementById('withdraw_selected_units_village_info').getElementsByTagName('tbody')[0], {
                        attributes: true,
                        childList: true,
                        subtree: true,
                    })
                }
                $('#withdraw_selected_units_village_info tbody tr:has(:checkbox:checked) td.has-input input').on('input', callback)
            }
            // Create an observer instance linked to the callback function
            // Start observing the target nodes for configured mutations
            const observer = new MutationObserver(callback)
            observer.observe(document.getElementById('withdraw_selected_units_village_info').getElementsByTagName('tbody')[0], {
                attributes: true,
                childList: true,
                subtree: true,
            })
            $('#withdraw_selected_units_village_info > table input.troop-request-selector-all').on('input', ()=>{
                    setTimeout(callback, 400)
                }
            )
            $('#withdraw_selected_units_village_info > table input.troop-request-selector').on('input', callback)
        }
 
        //rerun should always be false
        function sumTransports(rerun) {
            let titel, type, recieve_player, text, nf, player_row, res_row;
            recieve_player = []
            text = ""
            nf = Intl.NumberFormat();
            type = $('table.modemenu td.selected a[href*="trader&type"]').parent().index()
            if (rerun) {
                player_row = 3
                res_row = 10
                titel = "Eintreffend von"
            } else if (type === 0) {
                sumTransports(true)
                player_row = 5
                res_row = 10
                titel = "Ausgehend zu"
            } else if (type === 1) {
                player_row = 4
                res_row = 10
                titel = "Ausgehend zu"
            } else if (type === 2) {
                player_row = 3
                res_row = 9
                titel = "Eintreffend von"
            } else if (type === 3) {
                player_row = 2
                res_row = 9
                titel = "Eigene Transporte"
                let traders_returning = $('#trades_table tr[class*="row_"]').has('td img[src*="return"]').find('td:nth-child(8)').map((i,e)=>parseInt(e.innerText)).get().reduce((a,b)=>a + b, 0)
                text += `<span style="font-weight: bold; margin-left: 35%;">${nf.format(traders_returning)}   H\u00E4ndler auf dem R\u00FCckweg</span>`
            } else {
                return
            }
            $('#trades_table tr[class*="row_"]').each((index,tr)=>{
                    tr = $(tr)
                    player = tr.find(`td:nth-child(${player_row})`).text()
                    if (player === "") {
                        return true
                    }
                let player_entry = recieve_player.find(entry => entry.name === player);
                if (player_entry === undefined) {
                        recieve_player.push({
                            name: player,
                            res: [0, 0, 0],
                            pp: 0,
                            count: 0
                        })
                        player_entry = recieve_player[recieve_player.length - 1]
                    }
                    let spans = tr.find(`td:nth-child(${res_row}) span`).has('span.header')
                    spans = spans.length === 0 ? tr.find(`td:nth-child(${res_row}) span.res`) : spans
                    spans.each((ind,span)=>{
                            if (span.outerHTML.includes('wood')) {
                                player_entry.res[0] += parseInt(span.innerText.replace('.', ''))
                            } else if (span.outerHTML.includes('stone')) {
                                player_entry.res[1] += parseInt(span.innerText.replace('.', ''))
                            } else if (span.outerHTML.includes('iron')) {
                                player_entry.res[2] += parseInt(span.innerText.replace('.', ''))
                            }
                        }
                    )
                    let pp = spans.length === 0 ? parseInt(tr.find(`td:nth-child(${res_row}) span`).parent().text()) : 0
                    player_entry.pp += isNaN(pp) ? 0 : pp
                    player_entry.count += spans.length === 0 ? 0 : 1
                }
            );
            text += '<table class="vis" style="width: 74%; margin-right: 13%; margin-left: 13%;">'
            text += `<thead><tr><th>${titel}</th><th>Holz</th><th>Lehm</th><th>Eisen</th><th>Gesamt</th>${$("#trades_table td").has("span.icon.premium").length > 0 ? '<th>Premium Punkte</th>' : ''}'</tr></thead><tbody>`
            recieve_player.forEach((obj,i)=>{
                    text += `<tr class="${(i % 2 === 0 ? 'row_a' : 'row_b')}"><td style="font-weight: bold;">${obj.name} <span title="Anzahl der Befehle">(${obj.count})</span></td>`
                    text += `<td><span class="nowrap"><span class="icon header wood"> </span>${nf.format(obj.res[0])} </span></td>`
                    text += `<td><span class="nowrap"><span class="icon header stone"> </span>${nf.format(obj.res[1])} </span></td>`
                    text += `<td><span class="nowrap"><span class="icon header iron"> </span>${nf.format(obj.res[2])} </span></td>`
                    text += `<td><span class="nowrap"><span class="icon header ressources"> </span>${nf.format(obj.res[0] + obj.res[1] + obj.res[2])} </span></td>`
                    text += $("#trades_table td").has("span.icon.premium").length > 0 ? `<td><span class="nowrap"><span class="icon header premium"> </span>${nf.format(obj.pp)} </span></td> ` : ''
                    text += '</tr>'
                }
            )
            text += '</tbody></table>'
            $('#content_value').parent().before(text)
        }
 
        function flagStats() {
            const nf = Intl.NumberFormat();
            let t = ["Rohstoffproduktion", "Rekrutierungs\nGeschwindigkeit", "Angriffsst\u00E4rke", "Verteidigungsst\u00E4rke", "Gl\u00FCck", "Einwohnerzahl", "Reduzierte\nM\u00FCnzkosten", "Beutekapazit\u00E4t"].map((t, e) => {
                        let a = $(`[id*=flag_box_${e + 1}_]`).map((t, e) => e.classList.contains("flag_box_empty") ? 0 : parseInt(e.lastElementChild.innerText) * Math.pow(3, t)).get().reduce((t, e) => t + e);
                        return [t, a]
                    }
                )
                ,
                e = "<tr><th colspan='2'>Flaggen Typ</th><th style='white-space: nowrap;' title='in graue Flaggen umgerechnet'>Anzahl</th><tr>";
            e += '<h2 style="font-weight: bold; text-align: center;" title="Flaggen auf der aktuellen Seite in graue Flaggen umgerechnet">Flaggen Zusammenfassung</h2>';
            let a = 0
            for (let i=0; i < 8; i++)
                e += `<tr><td><img src='/graphic/flags/medium/${i + 1}_1.png' title='${t[i][0]}'/></td><td style="font-weight: bold; white-space: nowrap;">${t[i][0]}</td><td>${nf.format(t[i][1])}</td></tr>`,
                    a += t[i][1];
            e += `<tr><th colspan="3" style=" text-align: center; font-weight: bold;">Insgesamt: ${nf.format(a)}</th><tr>`,
                Dialog.show("stats", `<div style="margin: 0.6em;"><table class="vis" >${e}</table></div>`)
            $('#popup_box_stats').attr('style', '')
        }
 
        function allyDeffSum() {
            const nf = Intl.NumberFormat();
            let player_villages;
            const display_units = game_data.units.filter((e) => e !== 'militia');
            const units_array = new Array(display_units.length).fill(0);
            const units_away = new Array(display_units.length).fill(0);
            const units_in_town = new Array(display_units.length).fill(0);
            let inced_village_count = 0;
            let incs_count = 0;
            player_villages = $('.table-responsive .vis tr:gt(0):even').map((i,in_town)=>{
                    away = in_town.nextElementSibling
                    let village = {
                        coords_td: in_town.firstElementChild.innerHTML,
                        in_town: units_array.map((e,i)=>{
                                let count = parseInt(in_town.children[2 + i].innerText)
                                units_in_town[i] += count
                                return count
                            }
                        ),
                        away: units_array.map((e,i)=>{
                                let count = parseInt(away.children[1 + i].innerText)
                                units_away[i] += count
                                return count
                            }
                        ),
                        incs: parseInt(in_town.lastElementChild.innerText)
                    }
                    incs_count += village.incs
                    inced_village_count += village.incs > 0 ? village.incs : 0
                    return village
                }
            )
            let html = inced_village_count > 0 ? `<div style="float: right;"><strong title="ignorierte Angriffe werden hier nicht beachtet">\u00D8 ${Math.round(incs_count / inced_village_count * 10) / 10}  Angriffe je angegriffenes Dorf</strong></div>` : '';
            html += `<div id="ds_ui_deff_sum">`
            html += `<table class="vis" style="width: 100%" ><th style='min-width: 6em' title='D\u00F6rfer Anzahl'>Truppen (${player_villages.length})</th>`
 
            display_units.forEach((e,i)=>{
                    html += `<th ><img src="https://dsde.innogamescdn.com/asset/ff850eff/graphic/unit/unit_${e}.png" class=""></th>`
                }
            )
            html += "<tr><td title='inklusive Fremder Deff'>in D\u00F6rfern</td>"
            units_in_town.forEach((e,i)=>{
                    html += `<td ${e === 0 ? 'class="hidden"' : ''} style='padding-right: 1em;'>${nf.format(e)}</td>`
                }
            )
            html += "</tr><tr><td>unterwegs</td>"
            units_away.forEach((e,i)=>{
                    html += `<td ${e === 0 ? 'class="hidden"' : ''} style='padding-right: 1em;'>${nf.format(e)}</td>`
                }
            )
            html += "</tr></table><br>"
            bunker_villages = player_villages.filter((i,e)=>e.in_town[0] >= (spear_bunker_value === 'undefined' ? 20000 : spear_bunker_value))
            bunker_villages.sort((a,b)=>{
                    if (a.in_town[0] > b.in_town[0])
                        return -1;
                    if (a.in_town[0] < b.in_town[0])
                        return 1;
                    return 0;
                }
            )
            html += `<table class="vis" style="width: 100%" ><tr><th style='min-width: 6em' title='Bunker Anzahl'>Bunker (${bunker_villages.length})</th>`
            display_units.forEach((e,i)=>{
                    html += `<th ><img src="https://dsde.innogamescdn.com/asset/ff850eff/graphic/unit/unit_${e}.png" class=""></th>`
                }
            )
            html += '<th title="nicht ignorierte Angriffe"><img src="https://dsde.innogamescdn.com/asset/ff850eff/graphic/unit/att.png" class=""></th></tr><tr><th><b>Gesamt</b>'
            let bunker_incs = 0;
            bunker_villages.each((i,bunker)=>{
                    display_units.forEach((e,i)=>{
                            units_array[i] += bunker.in_town[i]
                            bunker_incs += bunker.incs
                        }
                    )
                }
            )
            display_units.forEach((e,i)=>{
                    html += `<th ${units_array[i] === 0 ? 'class="hidden"' : ''} style='padding-right: 1em;'>${nf.format(units_array[i])}</th>`
                }
            )
            html += `<th ${bunker_incs === 0 ? 'class="hidden"' : ''} style='padding-right: 1em;'>${bunker_incs}</th></tr>`
            bunker_villages.each((i,e)=>{
                    html += "</tr>"
                    html += "<td>" + e.coords_td + "</td>"
                    e.in_town.forEach((e,i)=>{
                            html += `<td ${e === 0 ? 'class="hidden"' : ''} style='padding-right: 1em;'>${nf.format(e)}</td>`
                        }
                    )
                    html += `<td ${e.incs === 0 ? 'class="hidden"' : ''} style='padding-right: 1em;'>${e.incs}</td>`
                    html += "</tr>"
                }
            )
            html += "</table><br></div>"
            $('.table-responsive').before(html)
        }
 
        function allyTroopSum() {
 
            if ($('#ally_content .vis.modemenu td').length < 3)
                return;
 
            const nf = Intl.NumberFormat();
            let player_villages;
            const display_units = game_data.units.filter((e) => e !== 'militia');
            const units_array = new Array(display_units.length).fill(0);
            const units_all = new Array(display_units.length).fill(0);
            let commands = 0;
            let incs = 0;
            const all_units = ["spear", "sword", "axe", "archer", "spy", "light", "marcher", "heavy", "ram", "catapult", "knight", "snob", "militia"];
            const all_units_pop = [1, 1, 1, 1, 2, 4, 5, 6, 5, 8, 10, 100, 0];
            const deff_villages = [];
            const off_villages = [];
            const flex_villages = [];
            const other_villages = [];
 
            function getUnitsPop(troops, t_name_array) {
                let pop = 0
                t_name_array.forEach((e,i)=>{
                        if (-1 !== display_units.indexOf(e)) {
                            pop += troops[display_units.indexOf(e)] * all_units_pop[all_units.indexOf(e)]
                        }
                    }
                )
                return pop
            }
            player_villages = $('.table-responsive .vis tr:gt(0)').map((i,row)=>{
                    let village = {
                        coords_td: row.firstElementChild.innerHTML,
                        own: units_array.map((e,i)=>{
                                let count = parseInt(row.children[1 + i].innerText)
                                units_all[i] += count
                                return count
                            }
                        ),
                        commands: parseInt(row.lastElementChild.previousElementSibling.innerText),
                        incs: parseInt(row.lastElementChild.innerText),
                        pop: 0
                    }
                    commands += village.commands
                    incs += village.incs
                    let defPop = getUnitsPop(village.own, ['spear', 'sword', 'archer'])
                    let offPop = getUnitsPop(village.own, ['axe', 'light', 'marcher', 'ram'])
                    let flexPop = getUnitsPop(village.own, ['heavy'])
                    let otherPop = getUnitsPop(village.own, ['catapult', 'knight', 'snob'])
                    let isSpear = village.own[0] > 1000
                    let isAxe = village.own[2] > 1000
                    let isHeavy = village.own[display_units.indexOf('heavy')] > 100
                    village.pop = defPop + offPop + flexPop + otherPop
                    if (defPop > offPop && getUnitsPop(village.own, ['sword']) > flexPop) {
                        //deff
                        deff_villages.push(village.pop)
                    } else if (offPop > defPop) {
                        //off
                        off_villages.push(village.pop)
                    } else if (flexPop > getUnitsPop(village.own, ['sword'])) {
                        //flex
                        flex_villages.push(village.pop)
                    } else {
                        //other
                        other_villages.push(village.pop)
                    }
                    return village
                }
            )
            let html = "";
 
            function td(value, format) {
                return `<td ${value === 0 ? 'class="hidden"' : ''}>${format ? nf.format(value) : value}</td>`
            }
            html += `<br><table class="vis" ><tr><th style='min-width: 6em'>D\u00F6rfer Typen</th><th style='min-width: 6em'><img src="https://dsde.innogamescdn.com/asset/ff850eff/graphic/unit/unit_axe.png" class="">Off</th><th style='min-width: 6em'><img src="https://dsde.innogamescdn.com/asset/ff850eff/graphic/unit/unit_sword.png" class="">Deff</th><th style='min-width: 6em'><img src="https://dsde.innogamescdn.com/asset/ff850eff/graphic/unit/unit_spear.png" class="">Flex</th></tr>`
            html += `<tr><th title="Prozent Angaben sind gerundet">Verh\u00E4ltnis</th><th>${Math.round(off_villages.length / player_villages.length * 100)}%</th><th>${Math.round(deff_villages.length / player_villages.length * 100)}%</th><th>${Math.round(flex_villages.length / player_villages.length * 100)}%</th></tr>`
            html += `<tr><td title="" >Voll</td>` + td(off_villages.filter((e)=>e >= 18000).length, false) + td(deff_villages.filter((e)=>e >= 18000).length, false) + td(flex_villages.filter((e)=>e >= 18000).length, false) + `</tr>`
            html += `<tr><td title="" >3/4</td>` + td(off_villages.filter((e)=>e < 18000 && e >= 15000).length, false) + td(deff_villages.filter((e)=>e < 18000 && e >= 15000).length, false) + td(flex_villages.filter((e)=>e < 18000 && e >= 15000).length, false) + `</tr>`
            html += `<tr><td title="" >2/4</td>` + td(off_villages.filter((e)=>e < 15000 && e >= 10000).length, false) + td(deff_villages.filter((e)=>e < 15000 && e >= 10000).length, false) + td(flex_villages.filter((e)=>e < 15000 && e >= 10000).length, false) + `</tr>`
            html += `<tr><td title="" >1/4</td>` + td(off_villages.filter((e)=>e < 10000 && e >= 5000).length, false) + td(deff_villages.filter((e)=>e < 10000 && e >= 5000).length, false) + td(flex_villages.filter((e)=>e < 10000 && e >= 5000).length, false) + `</tr>`
            html += `<tr><td title="W" >Leer</td>` + td(off_villages.filter((e)=>e < 5000).length, false) + td(deff_villages.filter((e)=>e < 5000).length, false) + td(flex_villages.filter((e)=>e < 5000).length, false) + `</tr>`
            html += other_villages.length > 0 ? `<tr><th colspan="4" >Nicht zuweisbare oder ganz Leere D\u00F6rfer ${other_villages.length}</th></tr>` : ''
            html += '</table><br>'
 
            html += `<table class="vis" style="width: 100%" ><tr><th style='min-width: 6em' title='D\u00F6rfer Anzahl'>Truppen (${player_villages.length})</th>`
            display_units.forEach((e,i)=>{
                    html += `<th ><img src="https://dsde.innogamescdn.com/asset/ff850eff/graphic/unit/unit_${e}.png" class=""></th>`
                }
            )
            html += `<th title="\u00D8 ${Math.round(commands / player_villages.length * 1000) / 1000} Befehle pro Dorf"><img src="https://dsde.innogamescdn.com/asset/ff850eff/graphic/icons/commands_outgoing.png" class=""></th><th title="nicht ignorierte Angriffe"><img src="https://dsde.innogamescdn.com/asset/ff850eff/graphic/unit/att.png" class=""></th></tr>`
            html += `<tr><td title='Alle eigene Truppen'>Gesamt </td>`
            units_all.forEach((e,i)=>{
                    html += `<td ${e === 0 ? 'class="hidden"' : ''} style='padding-right: 0.2em;'>${nf.format(e)}</td>`
                }
            )
            html += `<td ${commands === 0 ? 'class="hidden"' : ''}>${nf.format(commands)}</td><td ${incs === 0 ? 'class="hidden"' : ''}>${nf.format(incs)}</td></tr>`
            $('.table-responsive').before(html)
        }
 
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
                //Helepr deepXmlConverter method for easy acess of config values
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
                    const textNodes = [].slice.call(xml.childNodes).filter(function (node) {
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
            }
        }
 
        function sendAndReTimes() {
            if ($(`#attack_info_att_units`).length === 0 || !SettingsHelper.checkConfigs()) {
                return
            }
            const [x1,y1,x2,y2] = $('span.village_anchor a[href*="info_village"]').map((i,e)=>e.innerText.match(/\d{3}\|\d{3}/)[0].split('|').map((e)=>parseInt(e)))
            const deltaX = Math.abs(x1 - x2);
            const deltaY = Math.abs(y1 - y2);
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            let isPublic = false;
            let attackTimeElement = $("#content_value > table > tbody > tr > td:nth-child(2) > table > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2)");
            let attackkTimeElement = null;
            if (attackTimeElement.length === 0) {
                //public reports
                attackTimeElement = $("#content_value > table > tbody > tr > td:nth-child(2) > table > tbody > tr > td > h4:nth-child(2)")
                attackkTimeElement = attackTimeElement
                isPublic = true
            } else {
                //normal reports
                attackkTimeElement = attackTimeElement.find('td:nth-child(2)')
            }
            let attackTime = null;
            if(SettingsHelper.getServerConf().commands.millis_arrival==='1') {
                attackTime = new Date(attackkTimeElement.text().trim().replace(/(.*)\.(.*)\.(.*) (.*):(.*):(.*):(.*)/, '20$3-$2-$1T$4:$5:$6.$7'))
            } else {
                let a = attackkTimeElement.text().trim()
                let b = a.split(' ')
                let [day, month, rest] = b[0].split('.')
                let result = [("20" + rest), month, day].join('-') + 'T' + b[1]
                attackTime = new Date(result)
            }
 
            const slowestUnit = $(`#attack_info_att_units tr:nth-child(2) td:gt(0)`).map((i,e)=>{
                    const unitSpeed = SettingsHelper.getUnitConf()[$(`#attack_info_att_units tr:nth-child(1) td:gt(0) a`).get(i).getAttribute('data-unit')].speed
                    return e.innerText === '0' ? 0 : parseInt(unitSpeed)
                }
            ).get().reduce((a,b)=>a > b ? a : b)
 
            const msPerSec = 1000;
            const secsPerMin = 60;
            const msPerMin = 60000;
 
            const travelTime = Math.round((slowestUnit * distance * msPerMin) / 1000) * 1000
 
            attackTimeElement.before($(formatDateTime(attackTime - travelTime, 'Abschickzeit', isPublic)))
 
            attackTimeElement.after($(formatDateTime(Math.floor((attackTime.getTime() + travelTime) / msPerSec) * msPerSec, 'R\u00FCckkehrzeit', isPublic)))
 
        }
 
        // Helper: Format date and time
        function formatDateTime(date, title, isPublic) {
            let currentDateTime = new Date(date);
 
            const currentYear = currentDateTime.getFullYear() - 2000;
            const currentMonth = currentDateTime.getMonth() + 1;
            const currentDate = currentDateTime.getDate();
            let currentHours = '' + currentDateTime.getHours();
            let currentMinutes = '' + currentDateTime.getMinutes();
            let currentSeconds = '' + currentDateTime.getSeconds();
            let currentMilliSeconds = '' + currentDateTime.getMilliseconds();
 
            currentHours = currentHours.padStart(2, '0');
            currentMinutes = currentMinutes.padStart(2, '0');
            currentSeconds = currentSeconds.padStart(2, '0');
            currentMilliSeconds = currentMilliSeconds.padStart(3, '0');
 
            let formatted_date = currentDate + '.' + currentMonth + '.' + currentYear + ' ' + currentHours + ':' + currentMinutes + ':' + currentSeconds;
            return isPublic ? `<h4>${title}:  ${formatted_date}</h4>` : `<tr><td>${title}</td><td>${formatted_date}<span class="small grey">:${currentMilliSeconds}</span></td></tr>`;
        }
 
        function spyInformation() {
            if ($('[id*="attack_spy_buildings_"]').length === 0 || !SettingsHelper.checkConfigs()) {
                return
            }
            //SettingsHelper.getUnitConf()
            config_base_production = parseInt(SettingsHelper.getServerConf().game.base_production)
            config_speed = parseFloat(SettingsHelper.getServerConf().speed)
            attack_spy_building_data = JSON.parse($('#attack_spy_building_data').attr('value'))
            building_pop = {
                "main": {
                    "pop": 5,
                    "pop_factor": 1.17
                },
                "barracks": {
                    "pop": 7,
                    "pop_factor": 1.17
                },
                "stable": {
                    "pop": 8,
                    "pop_factor": 1.17
                },
                "garage": {
                    "pop": 8,
                    "pop_factor": 1.17
                },
                "church": {
                    "pop": 5000,
                    "pop_factor": 1.55
                },
                "church_f": {
                    "pop": 5,
                    "pop_factor": 1.55
                },
                "watchtower": {
                    "pop": 500,
                    "pop_factor": 1.18
                },
                "snob": {
                    "pop": 80,
                    "pop_factor": 1.17
                },
                "smith": {
                    "pop": 20,
                    "pop_factor": 1.17
                },
                "place": {
                    "pop": 0,
                    "pop_factor": 1.17
                },
                "statue": {
                    "pop": 10,
                    "pop_factor": 1.17
                },
                "market": {
                    "pop": 20,
                    "pop_factor": 1.17
                },
                "wood": {
                    "pop": 5,
                    "pop_factor": 1.155
                },
                "stone": {
                    "pop": 10,
                    "pop_factor": 1.14
                },
                "iron": {
                    "pop": 10,
                    "pop_factor": 1.17
                },
                "farm": {
                    "pop": 0,
                    "pop_factor": 1
                },
                "storage": {
                    "pop": 0,
                    "pop_factor": 1.15
                },
                "hide": {
                    "pop": 2,
                    "pop_factor": 1.17
                },
                "wall": {
                    "pop": 5,
                    "pop_factor": 1.17
                }
            }
 
            unit_pop = {
                'spear': 1,
                'sword': 1,
                'axe': 1,
                'archer': 1,
                'spy': 2,
                'light': 4,
                'marcher': 5,
                'heavy': 6,
                'ram': 5,
                'catapult': 8,
                'knight': 10,
                'priest': 0,
                'snob': 100,
                'militia': 0,
            };
 
            building_points = {
                'main': [10, 2, 2, 3, 4, 4, 5, 6, 7, 9, 10, 12, 15, 18, 21, 26, 31, 37, 44, 53, 64, 77, 92, 110, 133, 159, 191, 229, 274, 330],
                'barracks': [16, 3, 4, 5, 5, 7, 8, 9, 12, 14, 16, 20, 24, 28, 34, 42, 49, 59, 71, 85, 102, 123, 147, 177, 212],
                'stable': [20, 4, 5, 6, 6, 9, 10, 12, 14, 17, 21, 25, 29, 36, 43, 51, 62, 74, 88, 107],
                'garage': [24, 5, 6, 6, 9, 10, 12, 14, 17, 21, 25, 29, 36, 43, 51],
                'church': [10, 2, 2],
                'church_f': [10],
                'snob': [512, 102, 123],
                'smith': [19, 4, 4, 6, 6, 8, 10, 11, 14, 16, 20, 23, 28, 34, 41, 49, 58, 71, 84, 101],
                'place': [0],
                'statue': [24],
                'market': [10, 2, 2, 3, 4, 4, 5, 6, 7, 9, 10, 12, 15, 18, 21, 26, 31, 37, 44, 53, 64, 77, 92, 110, 133, 159, 191, 229, 274, 330],
                'wood': [6, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38, 46, 55, 66, 80, 95, 115, 137, 165, 198],
                'stone': [6, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38, 46, 55, 66, 80, 95, 115, 137, 165, 198],
                'iron': [6, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38, 46, 55, 66, 80, 95, 115, 137, 165, 198],
                'farm': [5, 1, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38, 46, 55, 66, 80, 95, 115, 137, 165],
                'storage': [6, 1, 2, 1, 2, 3, 3, 3, 5, 5, 6, 8, 8, 11, 13, 15, 19, 22, 27, 32, 38, 46, 55, 66, 80, 95, 115, 137, 165, 198],
                'hide': [5, 1, 1, 2, 1, 2, 3, 3, 3, 5],
                'wall': [8, 2, 2, 2, 3, 3, 4, 5, 5, 7, 9, 9, 12, 15, 17, 20, 25, 29, 36, 43],
                'watchtower': [42, 8, 10, 13, 14, 18, 20, 25, 31, 36, 43, 52, 62, 75, 90, 108, 130, 155, 186, 224],
            };
 
            function getStorage(lvl) {
                return Math.round(1000 * Math.pow(1.2294934, (parseInt(lvl) - 1)))
            }
 
            function getFarm(lvl) {
                return Math.round(240 * Math.pow(1.17210245334, (parseInt(lvl) - 1)))
            }
 
            function getResProduction(lvl) {
                return Math.round(parseFloat(config_base_production) * parseFloat(config_speed) * Math.pow(1.163118, (parseInt(lvl) - 1)))
            }
 
            function getMarket(lvl) {
                let marketTradesmen = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 19, 26, 35, 46, 59, 74, 91, 110, 131, 154, 179, 206, 235]
                return marketTradesmen[parseInt(lvl)]
            }
 
            function numberWithCommas(x) {
                const value = new Intl.NumberFormat("de-DE").format(x);
                return value.length < 10 ? length < 6 ? value : (value.substr(0, value.length - 4) + 'K ') : (value.substr(0, value.length - 8) + 'Mio ');
            }
 
            function popUsed(buildingType, level) {
                let building = building_pop[buildingType]
                if (typeof building === 'undefined') {
                    return 0;
                }
                return Math.round(building.pop * building.pop_factor ** (parseInt(level) - 1));
            }
 
            function calcBuildingPop() {
                let pop = 0
                for (e in attack_spy_building_data) {
                    building = attack_spy_building_data[e]
                    pop += popUsed(building.id, building.level)
                }
                return pop
            }
 
            function calcUnitLeftPop() {
                let pop = 0;
                $('#attack_info_def_units tr:nth-child(2) td:gt(0)').each((i,e)=>{
                        let loss = parseInt($('#attack_info_def_units tr:nth-child(3) td:gt(0)')[i].innerText)
                        pop += (parseInt(e.innerText) - loss) * unit_pop[game_data.units[i]];
                    }
                )
                return pop
            }
            function calcUnitSpyPop() {
                let pop = 0;
                $('#attack_spy_away table.vis tr:nth-child(2) td').each((i,e)=>{
                        pop += parseInt(e.innerText) * unit_pop[game_data.units[i]];
                    }
                )
                return pop
            }
 
            let wood_lvl = $('[id*="attack_spy_buildings_"] td:has(img[src*="wood"])').next().text()
            let stone_lvl = $('[id*="attack_spy_buildings_"] td:has(img[src*="stone"])').next().text()
            let iron_lvl = $('[id*="attack_spy_buildings_"] td:has(img[src*="iron"])').next().text()
            let storage_lvl = $('[id*="attack_spy_buildings_"] td:has(img[src*="storage"])').next().text()
            let farm_lvl = $('[id*="attack_spy_buildings_"] td:has(img[src*="farm"])').next().text()
            let pop_all_buildings = calcBuildingPop()
            let pop_max = getFarm(farm_lvl)
            let pop_unit_spy = calcUnitSpyPop()
            let pop_unit_left = calcUnitLeftPop()
            let points = attack_spy_building_data.map((e)=>(building_points[e.id].slice(0, e.level).reduce((a,b)=>a + b))).reduce((a,b)=>a + b)
 
            $('#attack_spy_buildings_right').after(`<table id="attack_results" width="100%" style="border: 1px solid #DED3B9"><tbody>
            <tr><th>Punkte</th>
                <td colspan="2">
                    <span class="nowrap" style="margin-left: 0.5em;"><b>${numberWithCommas(points)} P</b></span>
                </td>
             </tr>
            <tr><th>Produktion</th>
            <td width="250">
                <span class="nowrap"><span class="icon header wood" title="Holz"></span>${numberWithCommas(getResProduction(wood_lvl))}</span>
                <span class="nowrap"><span class="icon header stone" title="Lehm"> </span>${numberWithCommas(getResProduction(stone_lvl))}</span>
                <span class="nowrap"><span class="icon header iron" title="Eisen"> </span>${numberWithCommas(getResProduction(iron_lvl))}</span>
            </td><td><span class="nowrap"><span class="icon header ressources"> </span>${numberWithCommas(getStorage(storage_lvl))}</span></td>
            </tr><tr><th>Bev\u00f6lkerung</th>
                <td colspan="2">
                    <span class="nowrap" style="margin-left: 0.5em;" title="Auserhalb ${pop_unit_spy} und Im Dorf ${pop_unit_left}">Truppen <b>${numberWithCommas(pop_unit_spy + pop_unit_left)}</b></span>
                    <span class="nowrap" style="margin-left: 0.5em;">Geb\u00E4ude <b>${numberWithCommas(pop_all_buildings)}</b></span>
                    <span class="nowrap" style="margin-left: 0.5em;" title="Maximal ${numberWithCommas(pop_max - pop_all_buildings - pop_unit_spy)} frei wenn nur Truppen auserhalb beachtet werden." >Frei <b>${numberWithCommas(pop_max - pop_all_buildings - pop_unit_spy - pop_unit_left)}</b></span>
                </td>
         </tr></tbody></table>`)
 
        }
    }
)();