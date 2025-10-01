var win = typeof unsafeWindow != 'undefined' ? unsafeWindow : window;

// --- Anfang einstellbare Variablen ------
win.filter = false;
win.showWithCoords = false;
win.showWithCounter = false;

win.breakAfter = 5;
win.activationCharCode = 'b';

(function() {
    var win = typeof unsafeWindow != 'undefined' ? unsafeWindow : window;
    win.ScriptAPI.register('90-Select Villages', true, 'Phisa, suilenroc', 'support-nur-im-forum@die-staemme.de');
 
    win.DSSelectVillages = {
        currentLang: 'de',
 
        showWithCoords: win.showWithCoords,
        showWithCounter: win.showWithCounter,
        filter: win.filter,
 
        breakAfter: win.breakAfter,
        activationCharCode: win.activationCharCode,
 
        enabled: false,
 
        villages: [],
        villagesId: [],
        villagesToInsert: [],
        allyRelations: [],
        
        // NEW: toggle to select all villages of the clicked player's owner
        selectAllByPlayer: false,
 
        lang: {
            de: {
                UI: {
                    selectedVillages: "Ausgew\u00E4hlte D\u00F6rfer:",
                    insertOptions: "Auswahl/Einf\u00FCgen",
                    enableShowWithCoords: "Mit BBCodes anzeigen",
                    enableShowWithCounter: "Mit Z\u00E4hler anzeigen",
                    enableFilter: "Nach Diplomatie filtern",
                    // NEW: label for the new checkbox
                    enableSelectAllByPlayer: "Alle D\u00F6rfer des Spielers ausw\u00E4hlen"
                }
            }
        },
 
        enableScript: function() {
            this.enabled = true;
            win.TWMap.mapHandler.integratedSpawnSector = win.TWMap.mapHandler.spawnSector;
            win.TWMap.mapHandler.spawnSector = this.spawnSector;
 
            this.oldClickFunction = win.TWMap.mapHandler.onClick;
            win.TWMap.mapHandler.onClick = this.clickFunction;
            win.TWMap.reload();
 
            this.allyRelations = win.TWMap.allyRelations;
            this.allyRelations[game_data.player.ally] = "partner";
 
            this.showUi();
        },
 
        spawnSector: function(data, sector) {
            win.TWMap.mapHandler.integratedSpawnSector(data, sector);
            for (var i = 0; i < win.DSSelectVillages.villagesId.length; i++) {
                var villageId = win.DSSelectVillages.villagesId[i];
                if (villageId === null) {
                    continue;
                }
                var v = $('#map_village_' + villageId);
                $('<div class="DSSelectVillagesOverlay" id="DSSelectVillages_overlay_' + villageId + '" style="width:52px; height:37px; position: absolute; z-index: 50; left:' + $(v).css('left') + '; top: ' + $(v).css('top') + ';"></div>').appendTo(v.parent());
                $('#DSSelectVillages_overlay_' + villageId).css('outline', '2px solid red');
            }
        },
 
        markVillageAsSelected: function(id) {
            $('#DSSelectVillages_overlay_' + id).css('outline', '2px solid red');
        },
        demarkVillageAsSelected: function(id) {
            $('#DSSelectVillages_overlay_' + id).css('outline', '');
        },
 
        disableScript: function() {
            this.enabled = false;
            this.villages = [];
            this.villagesId = [];
            win.TWMap.mapHandler.onClick = this.oldClickFunction;
            win.TWMap.mapHandler.spawnSector = win.TWMap.mapHandler.integratedSpawnSector;
            win.TWMap.reload();
            $('#bb_main_div').remove();
        },
 
        showUi: function() {
            // Haupt-Popup anlegen
            var main_div = $('<div id="bb_main_div" class="popup_style" style="display:block; top:100px; right:100px; z-index:9999; position:fixed"></div>');
            $('body').append(main_div);
            $(main_div).draggable();

            var close_button = $('<div class="popup_menu"><p style="display:inline;">DSSelect</p><a href="Javascript:void(0);" id="a_close">Schlie&szlig;en</a></div>');
            var main = $('#bb_main_div');
            main.append(close_button);
            $('#a_close').on('click', function() {
                $('#bb_main_div').remove();
                win.DSSelectVillages.disableScript();
            });

            // EINMALIGES output_div mit Attack-Planner-Button
            var output_div = $(
                '<div class="popup_content">'
            +   '<h1 align="center">' + this.lang[this.currentLang].UI.insertOptions + '</h1>'
            +   '<div style="text-align:center"><input type="" id="insert_text"><button id="insert" class="btn">Einf\u00FCgen</button><br>'
            +   '<input type="checkbox" checked="true" id="filter" /> ' + this.lang[this.currentLang].UI.enableFilter + '</div>'
            +   '<h1 align="center">' + this.lang[this.currentLang].UI.selectedVillages + '</h1>'
            +   '<div style="text-align:center">'
            +     '<input type="checkbox" checked="true" id="bbcode" /> ' + this.lang[this.currentLang].UI.enableShowWithCoords + '<br />'
            +     '<input type="checkbox" checked="true" id="zaehlen" /> ' + this.lang[this.currentLang].UI.enableShowWithCounter + '<br />'
            +   '</div>'
            // NEW: the new checkbox row
            +   '<div style="text-align:center; margin-top:6px">'
            +     '<input type="checkbox" id="select_all_player" /> ' + this.lang[this.currentLang].UI.enableSelectAllByPlayer
            +   '</div>'
            +   '<textarea id="output" cols="35" rows="20" readonly style="width:307px!important; height:332px!important; text-align:center;"></textarea>'
            +   '<br/>'
            +   '<div style="text-align:center"><button id="copy" class="btn">Kopieren</button></div>'
            +   '<div style="text-align:center; margin-top:5px;"><button id="startAttackPlanner" class="btn">Start Attack Planner</button></div>'
            + '</div>'
            );
            main.append(output_div);

            // Jetzt erst Events binden (Element existiert)
            $('#startAttackPlanner').on('click', function() {
                window.open('https://staemmedb.de/attackPlaner', '_blank'); // gleiche Seite? -> window.location.href=...
            });

            var chkbxBBcode = $('#bbcode');
            var chkbxcounter = $('#zaehlen');
            var chkbxFilter = $('#filter');
            var chkbxAllPlayer = $('#select_all_player'); // NEW

            chkbxBBcode.prop('checked', this.showWithCoords);
            chkbxcounter.prop('checked', this.showWithCounter);
            chkbxFilter.prop('checked', this.filter);
            chkbxAllPlayer.prop('checked', this.selectAllByPlayer); // NEW

            chkbxBBcode.on('change', function() {
                win.DSSelectVillages.showWithCoords = this.checked;
                win.DSSelectVillages.outputCoords();
            });
            chkbxcounter.on('change', function() {
                win.DSSelectVillages.showWithCounter = this.checked;
                win.DSSelectVillages.outputCoords();
            });
            chkbxFilter.on('change', function() {
                win.DSSelectVillages.filter = this.checked;
                win.DSSelectVillages.outputCoords();
            });
            // NEW: wire the select-all-by-player toggle
            chkbxAllPlayer.on('change', function() {
                win.DSSelectVillages.selectAllByPlayer = this.checked;
            });

            $('#copy').on('click', function() {
                let textarea = $('#output');
                textarea.focus();
                textarea.select();
                try { document.execCommand('copy'); } catch (err) { console.log('Oops, unable to copy'); }
            });

            $('#insert').on('click', function() {
                var coordTextPattern = /\(\d{3}\|\d{3}\) K/g;
                var coordPattern = /\d{3}\|\d{3}/g;
                var villageText = $('#insert_text').val();
                villageText = villageText.match(coordTextPattern) != null ? villageText.match(coordTextPattern).join('') : villageText;
                var insertCoords = villageText.match(coordPattern);
                win.DSSelectVillages.pos = win.TWMap.pos;
                win.DSSelectVillages.villagesToInsert = insertCoords;
                win.DSSelectVillages.insertNextVillages();
            });
        },

        // NEW: helper to add a single village if eligible (reuses your filtering & overlay)
        addVillageIfEligible: function(x, y, update) {
            var coord = x + "|" + y;
            if (this.villages.indexOf(coord) !== -1) return;

            var village = win.TWMap.villages[(x) * 1000 + y];
            if (!village) return;

            var allyRelation = this.allyRelations[village.ally_id];
            if (this.filter && (allyRelation == "nap" || allyRelation == "partner")) return;

            this.villages.push(coord);
            this.villagesId.push(village.id);
            this.markVillageAsSelected(village.id);
            if (update) win.TWMap.reload();
        },

        // NEW: bulk add all villages by the same owner as the clicked village
        bulkAddByOwner: function(ownerId) {
            for (var key in win.TWMap.villages) {
                if (!win.TWMap.villages.hasOwnProperty(key)) continue;
                var v = win.TWMap.villages[key];
                if (!v || v.owner !== ownerId) continue;

                var k = parseInt(key, 10);
                var x = Math.floor(k / 1000);
                var y = k % 1000;

                this.addVillageIfEligible(x, y, false);
            }
            this.outputCoords();
        },
 
        outputCoords: function() {
            var coordsOutput = "";
            for (var i = 0; i < this.villages.length; i++) {
                if (this.villages[i] === null) {
                    continue;
                }
                var realCount = 0;
                for (var j = 0; j <= i; j++) {
                    if (this.villages[j] != null) {
                        realCount++;
                    }
                }
 
                coordsOutput += (this.showWithCounter ? realCount + ". " : "") + (this.showWithCoords ? "[coord]" : "") + this.villages[i] + (this.showWithCoords ? "[/coord]" : "") + "\n";
 
                if (this.breakAfter != -1 && realCount % this.breakAfter == 0) {
                    coordsOutput += "\n";
                }
            }
            $('#output').html(coordsOutput);
            $("#output").select();
        },
 
        insertNextVillages: function() {
            function waitForVillage(x, y, n) {
                var e = Date.now();
                !function o() {
                    win.TWMap.villages[(x) * 1000 + y] ? win.DSSelectVillages.insertNextVillages() : setTimeout(function() {
                        100 * n && Date.now() - e > 100 * n ? win.console.log(x + '|' + y) : o()
                    }, 100)
                }()
            }
            var insertCoords = win.DSSelectVillages.villagesToInsert;
            var leftCoord = [];
            if (insertCoords != null && insertCoords.length > 0) {
                for (let coord of insertCoords) {
                    if (win.DSSelectVillages.villages.indexOf(coord) == -1) {
                        let coordSplit = coord.split('|');
                        let x = ~~coordSplit[0];
                        let y = ~~coordSplit[1];
                        if (win.TWMap.villages[(x) * 1000 + y]) {
                            win.DSSelectVillages.handleVillage(x, y, false);
                        } else {
                            leftCoord.push(coord)
                        }
                    }
                }
                if (leftCoord.length > 0) {
                    let coordSplit = leftCoord[0].split('|');
                    let x = ~~coordSplit[0];
                    let y = ~~coordSplit[1];
                    win.TWMap.focusUserSpecified(x, y);
                    villagesToInsert = leftCoord;
                    waitForVillage(x, y, 40)
                } else {
                    win.TWMap.reload();
                    win.TWMap.focusUserSpecified(win.DSSelectVillages.pos[0], win.DSSelectVillages.pos[1]);
                    $('#insert_text').val('');
                }
            }
        },
 
        handleVillage: function(x, y, update) {
            var coord = x + "|" + y;
            var index = this.villages.indexOf(coord);
            var village = win.TWMap.villages[(x) * 1000 + y];
            if (!village) {
                return;
            }

            if (index === -1) {
                // NEW: if toggle is on, select all villages of this owner in one go
                if (this.selectAllByPlayer) {
                    this.bulkAddByOwner(village.owner);
                    if (update) win.TWMap.reload();
                    return this.outputCoords();
                }

                // original single-add path (with diplomacy filter)
                var allyRelation = this.allyRelations[village.ally_id];
                if (this.filter && (allyRelation == "nap" || allyRelation == "partner")) {
                    return;
                }
                this.villages.push(coord);
                this.villagesId.push(village.id);
                this.markVillageAsSelected(village.id);
                if (update) {
                    win.TWMap.reload();
                }
            } else {
                // original toggle-off of the single clicked village
                this.villages[index] = null;
                var indexId = this.villagesId.indexOf(village.id);
                this.villagesId[indexId] = null;
                this.demarkVillageAsSelected(village.id);
            }
            this.outputCoords();
        },
 
        clickFunction: function(x, y, event) {
            win.DSSelectVillages.handleVillage(x, y, true);
            return false;
            //Signal that the TWMap should not follow the URL associated to this click event
        },
 
        oldClickFunction: null
    };

    (function() {
        $(document).on("keypress", function(e) {
            if (String.fromCharCode(e.which) == win.DSSelectVillages.activationCharCode) {
                if (win.DSSelectVillages.enabled == false) {
                    win.DSSelectVillages.enableScript();
                } else {
                    win.DSSelectVillages.disableScript();
                }
            }
        });
    })();
 
    $('#content_value h2').css('display', 'inline')
})();