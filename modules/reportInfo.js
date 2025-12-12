// ==UserScript Module==
// DS-Tools Module: reportInfo.js
// Report-Auswertung (ODA/ODD, Überlebt, Zeiten, Spy-Info, UT-Summaries)
// Kompatibel mit aktuellem DS-HTML und DS-Tools Loader

(function () {
    'use strict';

    // -------------------------------------------------------------------------
    // Basics
    // -------------------------------------------------------------------------
    var win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    var doc = document;

    function $(sel, ctx) {
        return (ctx || doc).querySelector(sel);
    }

    function $all(sel, ctx) {
        return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
    }

    function parseIntSafe(v) {
        if (v == null) return 0;
        v = String(v).replace(/\./g, '');
        var n = parseInt(v, 10);
        return isNaN(n) ? 0 : n;
    }

    function getRowByFirstCellText(table, textStartsWith) {
        if (!table) return null;
        var rows = table.rows;
        for (var i = 0; i < rows.length; i++) {
            var c0 = rows[i].cells[0];
            if (!c0) continue;
            var t = c0.textContent.replace(/\s+/g, ' ').trim();
            if (t.indexOf(textStartsWith) === 0) {
                return rows[i];
            }
        }
        return null;
    }

    function getUnitOrderFromHeader(table) {
        var order = [];
        if (!table) return order;
        var headerRow = null;
        for (var i = 0; i < table.rows.length; i++) {
            var r = table.rows[i];
            if (r.cells.length > 1 && r.className.indexOf('center') !== -1) {
                headerRow = r;
                break;
            }
        }
        if (!headerRow) return order;
        for (var j = 1; j < headerRow.cells.length; j++) {
            var link = headerRow.cells[j].querySelector('a[data-unit]');
            if (link && link.getAttribute('data-unit')) {
                order.push(link.getAttribute('data-unit'));
            } else {
                order.push(null);
            }
        }
        return order;
    }

    // -------------------------------------------------------------------------
    // 1) ODA / ODD Bashpunkte
    // -------------------------------------------------------------------------
    function addBashPoints() {
        var attUnitsTbl = doc.getElementById('attack_info_att_units');
        var defUnitsTbl = doc.getElementById('attack_info_def_units');
        if (!attUnitsTbl || !defUnitsTbl) return;

        var unitPoints = {
            spear:   [4, 1],
            sword:   [5, 2],
            axe:     [1, 4],
            archer:  [5, 2],
            spy:     [1, 2],
            light:   [5, 13],
            marcher: [6, 12],
            heavy:   [23, 15],
            ram:     [4, 8],
            catapult:[12,10],
            knight:  [40,20],
            priest:  [0, 0],
            snob:    [200,200],
            militia: [4, 0]
        };

        var attLossRow = getRowByFirstCellText(attUnitsTbl, 'Verluste');
        var defLossRow = getRowByFirstCellText(defUnitsTbl, 'Verluste');
        if (!attLossRow || !defLossRow) return;

        var attOrder = getUnitOrderFromHeader(attUnitsTbl);
        var defOrder = getUnitOrderFromHeader(defUnitsTbl);

        var oda = 0;
        var odd = 0;

        // Attacker losses → ODA
        for (var i = 1; i < attLossRow.cells.length; i++) {
            var uName = attOrder[i - 1];
            if (!uName || !unitPoints[uName]) continue;
            var losses = parseIntSafe(attLossRow.cells[i].textContent);
            oda += losses * unitPoints[uName][1];
        }

        // Defender losses → ODD
        for (var j = 1; j < defLossRow.cells.length; j++) {
            var duName = defOrder[j - 1];
            if (!duName || !unitPoints[duName]) continue;
            var dLosses = parseIntSafe(defLossRow.cells[j].textContent);
            odd += dLosses * unitPoints[duName][0];
        }

        var attHeaderCell = $('#attack_info_att tbody tr:first-child th:nth-child(2)');
        var defHeaderCell = $('#attack_info_def tbody tr:first-child th:nth-child(2)');

        if (attHeaderCell && oda > 0 && attHeaderCell.textContent.indexOf('ODA:') === -1) {
            attHeaderCell.insertAdjacentHTML('beforeend',
                "<span style='float:right; margin-left:1em;'>ODA: " + oda + "</span>");
        }
        if (defHeaderCell && odd > 0 && defHeaderCell.textContent.indexOf('ODD:') === -1) {
            defHeaderCell.insertAdjacentHTML('beforeend',
                "<span style='float:right; margin-left:1em;'>ODD: " + odd + "</span>");
        }
    }

    // -------------------------------------------------------------------------
    // 2) Überlebt-Zeile
    // -------------------------------------------------------------------------
    function addSurvivedRowForTable(tableId) {
        var tbl = doc.getElementById(tableId);
        if (!tbl) return;

        // Wenn bereits Überlebt-Zeile vorhanden → nichts tun
        for (var i = 0; i < tbl.rows.length; i++) {
            var c0 = tbl.rows[i].cells[0];
            if (!c0) continue;
            var t = c0.textContent.replace(/\s+/g, ' ').trim();
            if (t.indexOf('Überlebt') === 0) {
                return;
            }
        }

        var countRow = getRowByFirstCellText(tbl, 'Anzahl');
        var lossRow  = getRowByFirstCellText(tbl, 'Verluste');
        if (!countRow || !lossRow) return;

        var survivedRow = countRow.cloneNode(true);
        survivedRow.cells[0].textContent = 'Überlebt';

        for (var c = 1; c < survivedRow.cells.length; c++) {
            var total = parseIntSafe(countRow.cells[c].textContent);
            var lost  = parseIntSafe(lossRow.cells[c].textContent);
            var surv  = total - lost;
            survivedRow.cells[c].textContent = surv;
            if (surv === 0) {
                survivedRow.cells[c].classList.add('hidden');
            }
        }

        // hinter Verluste einfügen
        lossRow.parentNode.insertBefore(survivedRow, lossRow.nextSibling);
    }

    function addSurvived() {
        addSurvivedRowForTable('attack_info_att_units');
        addSurvivedRowForTable('attack_info_def_units');
    }

    // -------------------------------------------------------------------------
    // 3) Abschick- & Rückkehrzeit
    // -------------------------------------------------------------------------
    function addTimes() {
        // SettingsHelper muss da sein, sonst macht das keinen Sinn
        if (!win.SettingsHelper || typeof win.SettingsHelper.getUnitConf !== 'function') return;
        if (win.SettingsHelper.checkConfigs && !win.SettingsHelper.checkConfigs()) return;

        // Kampfzeit-Zeile finden
        var mainVisTables = $all('table.vis');
        var fightRow = null;
        var fightTimeStr = null;

        outer:
        for (var t = 0; t < mainVisTables.length; t++) {
            var trs = mainVisTables[t].rows;
            for (var r = 0; r < trs.length; r++) {
                var row = trs[r];
                if (row.cells.length !== 2) continue;
                var label = row.cells[0].textContent.replace(/\s+/g, ' ').trim();
                if (label === 'Kampfzeit') {
                    fightRow = row;
                    fightTimeStr = row.cells[1].textContent.replace(/\s+/g, ' ').trim();
                    break outer;
                }
            }
        }

        if (!fightRow || !fightTimeStr) return;

        // Schon hinzugefügt? (Abschickzeit-Zeile prüfen)
        var parentTable = fightRow.parentNode.parentNode;
        for (var r2 = 0; r2 < parentTable.rows.length; r2++) {
            var c0 = parentTable.rows[r2].cells[0];
            if (!c0) continue;
            var txt = c0.textContent.replace(/\s+/g, ' ').trim();
            if (txt === 'Abschickzeit' || txt === 'Rückkehrzeit') {
                return;
            }
        }

        // Datum parsen: DD.MM.YY HH:MM:SS
        var m = fightTimeStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
        if (!m) return;
        var dd = parseInt(m[1], 10);
        var MM = parseInt(m[2], 10) - 1;
        var yy = 2000 + parseInt(m[3], 10);
        var hh = parseInt(m[4], 10);
        var mi = parseInt(m[5], 10);
        var ss = parseInt(m[6], 10);

        var arrival = new Date(yy, MM, dd, hh, mi, ss);

        // Herkunft/Ziel-Koordinaten
        var originLink  = $('#attack_info_att .village_anchor a[href*="info_village"]');
        var targetLink  = $('#attack_info_def .village_anchor a[href*="info_village"]');
        if (!originLink || !targetLink) return;

        function extractCoords(text) {
            var mm = text.match(/(\d{3})\|(\d{3})/);
            if (!mm) return null;
            return { x: parseInt(mm[1], 10), y: parseInt(mm[2], 10) };
        }

        var originCoords = extractCoords(originLink.textContent);
        var targetCoords = extractCoords(targetLink.textContent);
        if (!originCoords || !targetCoords) return;

        var dx = originCoords.x - targetCoords.x;
        var dy = originCoords.y - targetCoords.y;
        var distance = Math.sqrt(dx * dx + dy * dy);

        // langsamste Einheit aus Angreifer-Anzahl
        var unitConf = win.SettingsHelper.getUnitConf();
        var attTbl = doc.getElementById('attack_info_att_units');
        if (!unitConf || !attTbl) return;

        var headerOrder = getUnitOrderFromHeader(attTbl);
        var countRow = getRowByFirstCellText(attTbl, 'Anzahl');
        if (!countRow) return;

        var maxSpeed = 0; // speed = Minuten pro Feld
        for (var c = 1; c < countRow.cells.length; c++) {
            var uName = headerOrder[c - 1];
            if (!uName || !unitConf[uName]) continue;
            var cnt = parseIntSafe(countRow.cells[c].textContent);
            if (cnt <= 0) continue;
            var sp = parseFloat(unitConf[uName].speed);
            if (sp > maxSpeed) maxSpeed = sp;
        }

        if (!maxSpeed || maxSpeed <= 0) return;

        var travelMs = maxSpeed * distance * 60 * 1000; // Minuten * Felder * 60s * 1000ms

        var sendTime = new Date(arrival.getTime() - travelMs);
        var returnTime = new Date(arrival.getTime() + travelMs);

        function fmt(d) {
            var dd = String(d.getDate()).padStart(2, '0');
            var mm = String(d.getMonth() + 1).padStart(2, '0');
            var yy = String(d.getFullYear()).slice(2);
            var hh = String(d.getHours()).padStart(2, '0');
            var mi = String(d.getMinutes()).padStart(2, '0');
            var ss = String(d.getSeconds()).padStart(2, '0');
            return dd + '.' + mm + '.' + yy + ' ' + hh + ':' + mi + ':' + ss;
        }

        var sendRow = parentTable.insertRow(fightRow.rowIndex + 1);
        var sendLabel = sendRow.insertCell(0);
        var sendVal   = sendRow.insertCell(1);
        sendLabel.textContent = 'Abschickzeit';
        sendVal.textContent   = fmt(sendTime);

        var retRow = parentTable.insertRow(sendRow.rowIndex + 1);
        var retLabel = retRow.insertCell(0);
        var retVal   = retRow.insertCell(1);
        retLabel.textContent = 'Rückkehrzeit';
        retVal.textContent   = fmt(returnTime);
    }

    // -------------------------------------------------------------------------
    // 4) Spy-Info (Produktion / Bevölkerung)
    // -------------------------------------------------------------------------
    function addSpyInfo() {
        var hidden = doc.getElementById('attack_spy_building_data');
        if (!hidden) return;
        if (!win.SettingsHelper || typeof win.SettingsHelper.getServerConf !== 'function') return;
        if (win.SettingsHelper.checkConfigs && !win.SettingsHelper.checkConfigs()) return;

        var serverConf = win.SettingsHelper.getServerConf();
        if (!serverConf || !serverConf.game) return;

        var baseProd = parseInt(serverConf.game.base_production, 10);
        var speed    = parseFloat(serverConf.speed || '1');

        var spyData;
        try {
            spyData = JSON.parse(hidden.value || '[]');
        } catch (e) {
            return;
        }

        function getLevel(id) {
            for (var i = 0; i < spyData.length; i++) {
                if (spyData[i].id === id) {
                    return parseInt(spyData[i].level, 10) || 0;
                }
            }
            return 0;
        }

        function resProd(lvl) {
            if (!lvl || lvl <= 0) return 0;
            return Math.round(baseProd * speed * Math.pow(1.163118, (lvl - 1)));
        }

        function storageCap(lvl) {
            if (!lvl || lvl <= 0) return 0;
            return Math.round(1000 * Math.pow(1.2294934, (lvl - 1)));
        }

        function farmPop(lvl) {
            if (!lvl || lvl <= 0) return 0;
            return Math.round(240 * Math.pow(1.17210245, (lvl - 1)));
        }

        var woodLvl    = getLevel('wood');
        var stoneLvl   = getLevel('stone');
        var ironLvl    = getLevel('iron');
        var storageLvl = getLevel('storage');
        var farmLvl    = getLevel('farm');

        // Einheiten-Population
        var unitPop = {
            spear:1, sword:1, axe:1, archer:1,
            spy:2, light:4, marcher:5, heavy:6,
            ram:5, catapult:8, knight:10, snob:100,
            militia:0
        };

        function popFromRow(tableId, label) {
            var tbl = doc.getElementById(tableId);
            if (!tbl) return 0;
            var row = getRowByFirstCellText(tbl, label);
            if (!row) return 0;
            var headerOrder = getUnitOrderFromHeader(tbl);
            var sum = 0;
            for (var i = 1; i < row.cells.length; i++) {
                var uName = headerOrder[i - 1];
                if (!uName || !(uName in unitPop)) continue;
                var cnt = parseIntSafe(row.cells[i].textContent);
                sum += cnt * unitPop[uName];
            }
            return sum;
        }

        function popFromSpyAway() {
            var container = doc.getElementById('attack_spy_away');
            if (!container) return 0;
            var inner = container.querySelector('table.vis');
            if (!inner) return 0;
            var rows = inner.rows;
            if (rows.length < 2) return 0;
            var headerRow = rows[0];
            var valueRow  = rows[1];

            var unitOrder = [];
            for (var i = 0; i < headerRow.cells.length; i++) {
                var link = headerRow.cells[i].querySelector('a[data-unit]');
                if (link && link.getAttribute('data-unit')) {
                    unitOrder.push(link.getAttribute('data-unit'));
                } else {
                    unitOrder.push(null);
                }
            }

            var sum = 0;
            for (var c = 0; c < valueRow.cells.length; c++) {
                var uName = unitOrder[c];
                if (!uName || !(uName in unitPop)) continue;
                var cnt = parseIntSafe(valueRow.cells[c].textContent);
                sum += cnt * unitPop[uName];
            }
            return sum;
        }

        var popDef   = popFromRow('attack_info_def_units', 'Anzahl');
        var popAway  = popFromSpyAway();
        var popUnits = popDef + popAway;

        var popFarm = farmPop(farmLvl);

        // Einfacher Building-Pop (grob, optional)
        var building_pop = {
            main:      { pop: 5,    factor: 1.17 },
            barracks:  { pop: 7,    factor: 1.17 },
            stable:    { pop: 8,    factor: 1.17 },
            garage:    { pop: 8,    factor: 1.17 },
            church:    { pop: 5000, factor: 1.55 },
            church_f:  { pop: 5,    factor: 1.55 },
            watchtower:{ pop: 500,  factor: 1.18 },
            snob:      { pop: 80,   factor: 1.17 },
            smith:     { pop: 20,   factor: 1.17 },
            place:     { pop: 0,    factor: 1.17 },
            statue:    { pop: 10,   factor: 1.17 },
            market:    { pop: 20,   factor: 1.17 },
            wood:      { pop: 5,    factor: 1.155 },
            stone:     { pop: 10,   factor: 1.14 },
            iron:      { pop: 10,   factor: 1.17 },
            farm:      { pop: 0,    factor: 1.0 },
            storage:   { pop: 0,    factor: 1.15 },
            hide:      { pop: 2,    factor: 1.17 },
            wall:      { pop: 5,    factor: 1.17 }
        };

        var popBuildings = 0;
        for (var k = 0; k < spyData.length; k++) {
            var b = spyData[k];
            var bp = building_pop[b.id];
            if (!bp) continue;
            var lvl = parseInt(b.level, 10) || 0;
            if (lvl <= 0) continue;
            popBuildings += Math.round(bp.pop * Math.pow(bp.factor, (lvl - 1)));
        }

        var freePop = popFarm - popUnits - popBuildings;

        function fmtNum(n) {
            return n.toLocaleString('de-DE');
        }

        var html = '' +
            '<table class="vis" style="border:1px solid #DED3B9; width:100%; margin-top:5px;" id="ds_tools_spy_info">' +
            '<tr><th>Produktion (pro Stunde)</th>' +
            '<td>' +
            '<span class="nowrap"><span class="icon header wood"></span> '  + fmtNum(resProd(woodLvl))  + '</span> ' +
            '<span class="nowrap"><span class="icon header stone"></span> ' + fmtNum(resProd(stoneLvl)) + '</span> ' +
            '<span class="nowrap"><span class="icon header iron"></span> '  + fmtNum(resProd(ironLvl))  + '</span>' +
            '</td>' +
            '<td><span class="nowrap"><span class="icon header storage"></span> ' + fmtNum(storageCap(storageLvl)) + '</span></td>' +
            '</tr>' +
            '<tr><th>Bevölkerung</th>' +
            '<td colspan="2">' +
            'Truppen: <b>'   + fmtNum(popUnits)     + '</b> &nbsp; ' +
            'Gebäude: <b>'   + fmtNum(popBuildings) + '</b> &nbsp; ' +
            'Max: <b>'       + fmtNum(popFarm)      + '</b> &nbsp; ' +
            'Frei: <b>'      + fmtNum(freePop)      + '</b>' +
            '</td></tr>' +
            '</table>';

        var anchor = doc.getElementById('attack_spy_buildings_right');
        if (anchor && !doc.getElementById('ds_tools_spy_info')) {
            anchor.insertAdjacentHTML('afterend', html);
        }
    }

    // -------------------------------------------------------------------------
    // 5) UT-Summary (Support-Merge Reports)
    // -------------------------------------------------------------------------
    function sumSupportMerged() {
        var container = doc.querySelector('.report_ReportSupportAttackMerged');
        if (!container) return;

        var tables = $all('table.vis', container);
        if (!tables.length) return;

        // Wir gehen davon aus, dass alle Tabellen denselben Unit-Header haben
        var first = tables[0];
        var headerOrder = [];
        var headerRow = first.querySelector('tr.center');
        if (!headerRow) return;

        for (var i = 1; i < headerRow.cells.length; i++) {
            var link = headerRow.cells[i].querySelector('a[data-unit]');
            headerOrder.push(link ? link.getAttribute('data-unit') : null);
        }

        var len = headerOrder.length;
        var total = new Array(len);
        var lost  = new Array(len);
        for (var z = 0; z < len; z++) { total[z] = 0; lost[z] = 0; }

        function accumulate(tbl) {
            var rows = tbl.rows;
            if (rows.length < 3) return;
            var countRow = rows[1];
            var lossRow  = rows[2];
            for (var c = 1; c < countRow.cells.length && c < len + 1; c++) {
                total[c - 1] += parseIntSafe(countRow.cells[c].textContent);
                lost[c - 1]  += parseIntSafe(lossRow.cells[c].textContent);
            }
        }

        for (var t = 0; t < tables.length; t++) {
            accumulate(tables[t]);
        }

        var html = '<table class="vis" id="ds_tools_ut_summary"><tr><th>Gesamt (' +
                   tables.length + ')</th>';
        for (var i2 = 0; i2 < len; i2++) {
            var uName = headerOrder[i2];
            if (!uName) {
                html += '<th></th>';
            } else {
                html += '<th><img src="/graphic/unit/unit_' + uName + '.png"></th>';
            }
        }
        html += '</tr><tr><td>Anzahl</td>';
        for (var i3 = 0; i3 < len; i3++) {
            html += '<td>' + total[i3] + '</td>';
        }
        html += '</tr><tr><td>Verluste</td>';
        for (var i4 = 0; i4 < len; i4++) {
            html += '<td>' + lost[i4] + '</td>';
        }
        html += '</tr></table>';

        if (!doc.getElementById('ds_tools_ut_summary')) {
            first.insertAdjacentHTML('afterend', html);
        }
    }

    // -------------------------------------------------------------------------
    // 6) UT-Summary in Report-Preview
    // -------------------------------------------------------------------------
    function initPreviewSummary() {
        var preview = doc.querySelector('.report-preview');
        if (!preview) return;

        var observer = new MutationObserver(function () {
            var content = doc.querySelector('.report-preview-content');
            if (!content) return;
            if (doc.getElementById('ds_tools_ut_preview_summary')) return;

            var tables = $all('table.vis', content);
            if (!tables.length) return;

            // wir nehmen nur UT-ähnliche Tabellen (2/3 Zeilen mit unit-item)
            var unitTables = tables.filter(function (tbl) {
                return tbl.querySelector('td.unit-item');
            });
            if (!unitTables.length) return;

            var first = unitTables[0];
            var headerRow = first.querySelector('tr.center');
            if (!headerRow) return;

            var headerOrder = [];
            for (var i = 1; i < headerRow.cells.length; i++) {
                var link = headerRow.cells[i].querySelector('a[data-unit]');
                headerOrder.push(link ? link.getAttribute('data-unit') : null);
            }

            var len = headerOrder.length;
            var total = new Array(len);
            var lost  = new Array(len);
            var t;
            for (t = 0; t < len; t++) { total[t] = 0; lost[t] = 0; }

            function acc(tbl) {
                var r = tbl.rows;
                if (r.length < 3) return;
                var countRow = r[1];
                var lossRow  = r[2];
                for (var c = 1; c < countRow.cells.length && c < len + 1; c++) {
                    total[c - 1] += parseIntSafe(countRow.cells[c].textContent);
                    lost[c - 1]  += parseIntSafe(lossRow.cells[c].textContent);
                }
            }

            for (t = 0; t < unitTables.length; t++) {
                acc(unitTables[t]);
            }

            var html = '<table class="vis" id="ds_tools_ut_preview_summary"><tr><th>Gesamt (' +
                       unitTables.length + ')</th>';
            for (var i2 = 0; i2 < len; i2++) {
                var uName = headerOrder[i2];
                if (!uName) html += '<th></th>';
                else html += '<th><img src="/graphic/unit/unit_' + uName + '.png"></th>';
            }
            html += '</tr><tr><td>Anzahl</td>';
            for (var i3 = 0; i3 < len; i3++) {
                html += '<td>' + total[i3] + '</td>';
            }
            html += '</tr><tr><td>Verluste</td>';
            for (var i4 = 0; i4 < len; i4++) {
                html += '<td>' + lost[i4] + '</td>';
            }
            html += '</tr></table>';

            first.insertAdjacentHTML('afterend', html);
        });

        observer.observe(preview, { attributes: true, childList: true, subtree: true });
    }

    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------
    function init() {
        try {
            if (!win.game_data || win.game_data.screen !== 'report') return;

            var isDetail = location.search.indexOf('view=') !== -1 ||
                           win.game_data.mode === 'view_public_report';

            if (isDetail) {
                addBashPoints();
                addSurvived();
                addTimes();
                addSpyInfo();
                sumSupportMerged();
            } else {
                // Nur Übersichtsseite: UT-Preview-Summaries
                initPreviewSummary();
            }
        } catch (e) {
            console.error('[DS-Tools] Fehler im Modul reportInfo.js:', e);
        }
    }

    init();
})();
