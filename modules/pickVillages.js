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

        // NEW: caches for world map files
        _worldVillages: null, // Array<{id:number,x:number,y:number,owner:number}>
        _worldPlayers: null,  // Map-like: { [playerId:number]: {ally:number} }
        _mapsLoading: false,
 
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
                if (!v.length) continue; // NEW: only if present in DOM
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
                window.open('https://staemmedb.de/attackPlaner', '_blank');
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

        // NEW: helper to add a single village by id & coords (works even if not in TWMap cache)
        addVillageByIdCoord: function(villageId, x, y, update) {
            var coord = x + "|" + y;
            if (this.villages.indexOf(coord) !== -1) return;

            this.villages.push(coord);
            this.villagesId.push(villageId);
            // overlay will be created by spawnSector when the sector is visible
            this.markVillageAsSelected(villageId);
            if (update) win.TWMap.reload();
        },

        // (old helper kept for local/visible fallback paths)
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

        // NEW: normalize owner id from TWMap village (string/number compatibility)
        _getOwnerIdFromTW: function(villageObj) {
            var raw = (villageObj && (villageObj.owner != null ? villageObj.owner :
                                      (villageObj.owner_id != null ? villageObj.owner_id :
                                       villageObj.player_id)));
            var n = Number(raw);
            return isNaN(n) ? 0 : n;
        },

        // NEW: load and cache /map/village.txt and /map/player.txt
        _ensureWorldMaps: function() {
            var self = this;
            if (self._worldVillages && self._worldPlayers) return Promise.resolve();

            if (self._mapsLoading) {
                // avoid parallel fetches
                return new Promise(function(resolve) {
                    var chk = setInterval(function() {
                        if (self._worldVillages && self._worldPlayers) {
                            clearInterval(chk);
                            resolve();
                        }
                    }, 100);
                });
            }

            self._mapsLoading = true;

            var base = location.origin.replace(/\/$/, '');
            var urlVillages = base + '/map/village.txt';
            var urlPlayers  = base + '/map/player.txt';

            function fetchText(url) {
                // no-cache to avoid stale lists
                return fetch(url, { credentials: 'include', cache: 'no-store' }).then(function(r) { return r.text(); });
            }

            function smartSplit(line) {
                // prefer commas (as in your sample), fallback to semicolons
                var a = line.split(',');
                if (a.length < 5) a = line.split(';');
                return a;
            }

            function parseVillageTxt(txt) {
                // Expected (per sample): id,name,x,y,player_id,points,rank
                var lines = txt.trim().split(/\r?\n/);
                var out = [];
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    if (!line) continue;
                    var p = smartSplit(line);
                    if (p.length < 5) continue;
                    var id = Number(p[0]);
                    var x = Number(p[2]);
                    var y = Number(p[3]);
                    var owner = Number(p[4]); // can be 0 for barbs, or big numbers (as in sample)
                    if (!isFinite(id) || !isFinite(x) || !isFinite(y) || isNaN(owner)) continue;
                    out.push({ id: id, x: x, y: y, owner: owner });
                }
                return out;
            }

            function parsePlayerTxt(txt) {
                // Format: id,name,ally_id,villages,points,rank  (comma or semicolon)
                var lines = txt.trim().split(/\r?\n/);
                var map = Object.create(null);
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    if (!line) continue;
                    var p = smartSplit(line);
                    if (p.length < 3) continue;
                    var pid = Number(p[0]);
                    var ally = Number(p[2]);
                    if (!isFinite(pid)) continue;
                    map[pid] = { ally: isFinite(ally) ? ally : 0 };
                }
                return map;
            }

            return Promise.all([fetchText(urlVillages), fetchText(urlPlayers)]).then(function(res) {
                self._worldVillages = parseVillageTxt(res[0]);
                self._worldPlayers  = parsePlayerTxt(res[1]);
            }).catch(function(e) {
                console.error('DSSelectVillages map fetch failed', e);
            }).finally(function() {
                self._mapsLoading = false;
            });
        },

        // NEW: bulk add all villages by the same owner (worldwide, via village.txt)
        bulkAddByOwner: function(ownerIdRaw) {
            var self = this;
            var ownerId = Number(ownerIdRaw); // normalize for reliable matching
            if (!isFinite(ownerId)) ownerId = 0;

            return this._ensureWorldMaps().then(function() {
                // If world file missing for any reason, fallback to visible-only
                if (!self._worldVillages) {
                    for (var key in win.TWMap.villages) {
                        if (!win.TWMap.villages.hasOwnProperty(key)) continue;
                        var v = win.TWMap.villages[key];
                        if (!v) continue;
                        var vOwner = self._getOwnerIdFromTW(v);
                        if (Number(vOwner) !== ownerId) continue;

                        var k = parseInt(key, 10);
                        var x = Math.floor(k / 1000);
                        var y = k % 1000;
                        self.addVillageIfEligible(x, y, false);
                    }
                    self.outputCoords();
                    return;
                }

                // Diplomacy filter only if we can resolve ally via player.txt
                if (self.filter && self._worldPlayers && ownerId) {
                    var allyId = (self._worldPlayers[ownerId] && self._worldPlayers[ownerId].ally) || 0;
                    var rel = self.allyRelations[allyId];
                    if (rel === 'nap' || rel === 'partner') {
                        return; // skip entirely
                    }
                }

                // Collect all villages owned by ownerId
                for (var i = 0; i < self._worldVillages.length; i++) {
                    var vv = self._worldVillages[i];
                    if (Number(vv.owner) !== ownerId) continue;
                    self.addVillageByIdCoord(vv.id, vv.x, vv.y, false);
                }
                self.outputCoords();
            });
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
                // NEW: if toggle is on, select all villages of this owner (WORLDWIDE via village.txt)
                if (this.selectAllByPlayer) {
                    var ownerNorm = this._getOwnerIdFromTW(village); // ensure numeric
                    var self = this;
                    this.bulkAddByOwner(ownerNorm).then(function() {
                        if (update) win.TWMap.reload();
                        self.outputCoords();
                    });
                    return;
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
