const win = typeof unsafeWindow != 'undefined' ? unsafeWindow : window;

// show UI and enable line mode
win.TWLD_enableScriptHotkey = "l";
// enable line mode
win.TWLD_enableLineModeHotkey = "q";
// enable label mode
win.TWLD_enableLabelModeHotkey = "r";
// enable delete mode
win.TWLD_enableDeleteModeHotkey = "t";
// enable select corridor mode
win.TWLD_enableSelectCorridorHotkey = "u";
// enable edit select mode
win.TWLD_enableEditSelectModeHotkey = "i";
// adds the drawn line to the selected group
win.TWLD_addLineHotkey = "w";
// removes the last coordinates pair
win.TWLD_undoCoordsHotkey = "e";

// set language
win.TWLD_lang = "en";

// set default map scale
win.TWLD_scale = 1;

// enables zooming for the map
win.TWLD_enableZoom = false;

// how many continents are populated? (needed for coord wrap)
win.TWLD_continents = 16;

// import data from website
win.TWLD_data = [
	["de246", "https://raw.githubusercontent.com/EmoteBot6/DieStaemmeScripts/refs/heads/master/maps/korridore_246.js"],
	[]
];

(function () {
	const win = typeof unsafeWindow != 'undefined' ? unsafeWindow : window;

	// if clicked on forum link, save link and close window
	if (location.href.indexOf("screen=twld") > -1) {
		const searchParams = new URLSearchParams(location.search);
		if (searchParams.has("thread_id")) {
			var thread_id = searchParams.get("thread_id");
			localStorage.setItem("tw_line_drawer_forum_link_" + game_data.world + "_" + game_data.player.id, `/game.php?screen=forum&screenmode=view_thread&thread_id=${thread_id}`);
			window.close();
		} else {
			UI.ErrorMessage("thread_id parameter missing", 1000000);
		};
		return;
	};

	// show UI and enable line mode
	const enableScriptHotkey = win.TWLD_enableScriptHotkey || "l";
	// enable line mode
	const enableLineModeHotkey = win.TWLD_enableLineModeHotkey || "q";
	// enable label mode
	const enableLabelModeHotkey = win.TWLD_enableLabelModeHotkey || "r";
	// enable delete mode
	const enableDeleteModeHotkey = win.TWLD_enableDeleteModeHotkey || "t";
	// enable select corridor mode
	const enableSelectCorridorModeHotkey = win.TWLD_enableSelectCorridorHotkey || "u";
	// enable edit select mode
	const enableEditSelectModeHotkey = win.TWLD_enableEditSelectModeHotkey || "i";
	// adds the drawn line to the selected group
	const addLineHotkey = win.TWLD_addLineHotkey || "w";
	// removes the last coordinates pair
	const undoCoordsHotkey = win.TWLD_undoCoordsHotkey || "e";

	// set language
	const lang = win.TWLD_lang || "en";

	// set default map scale
	const scale = win.TWLD_scale || 1;

	// enables zooming for the map
	const enableZoom = win.TWLD_enableZoom || false;

	// how many continents are populated? (needed for coord wrap)
	const continents = win.TWLD_continents || 16;

	// import data from website
	const data = win.TWLD_data || [
		["de246", "https://raw.githubusercontent.com/EmoteBot6/DieStaemmeScripts/refs/heads/master/maps/korridore_246.js"],
		[]
	];

	// main object
	let TWLineDrawer = {

		map: TWMap,
		handler: TWMap.mapHandler,

		world: game_data.world,
		player: game_data.player.id,

		currentLine: undefined,

		mode: "",

		lastImportId: 1,

		lastLoadId: 1000,

		groups: new Map(),

		enabled: false,

		// init
		init: function () {
			// set language
			switch (lang) {
				case "de":
					this.UI.lang = this.UI.lang.german;
					break;
			};

			// reload map on document-idle
			win.addEventListener ("load", function() {
				TWMap.reload();
			});

			// set scale
			this.scale = scale;
			TWMap.scale = scale;

			// enables draw function
			this.overrideSpawnSector();

			// loads data from website
			this.importData(data);

			// loads saved data from local storage
			this.loadData();

			// loads data from forum
			this.loadForumData();

			// adds map scale chooser
			this.addMapRescaleChooser(this.scale);

			// override map functions 
			this.Override.override(this.map);

			try {
				this.map.map.reload();
				this.map.minimap && this.map.minimap.reload();
			} catch (e) {
				console.log("[TWLineDrawer] initial reload failed:", e);
			}

			// if scale preset is not 1, rescale map
			if (this.scale != 1) {
				// wait till map is loaded then resize it
				let interval = setInterval(() => {
					if (this.map.map) {
						clearInterval(interval);
						this.rescaleMap(this.scale, true);
					};
				}, 10);
			}

			// adds scroll functionality to the map
			if (enableZoom) {
				$("#map_wrap").on("mousewheel", (e) => {
					e.preventDefault();
					if (e.originalEvent.deltaY > 0) {
						let scale = TWLineDrawer.scale;
						scale = scale > 1 && Math.max(0.5, scale -= 0.1) || Math.max(0.5, scale -= 0.05);
						scale = Math.round(scale * 100) / 100;
						TWLineDrawer.rescaleMap(scale)
						$("#map_scale_chooser").val(scale);
					} else if (e.originalEvent.deltaY < 0) {
						let scale = TWLineDrawer.scale;
						scale = scale >= 1 && Math.min(1.5, scale += 0.1) || Math.min(1.5, scale += 0.05);
						scale = Math.round(scale * 100) / 100;
						TWLineDrawer.rescaleMap(scale)
						$("#map_scale_chooser").val(scale);
					};
					return false;
				});
			};
		},

		// extends the default draw function with the lines overlay
		overrideSpawnSector: function () {
			// save draw function
			if (!this.map.mapHandler._spawnSector) {
				this.map.mapHandler._spawnSector = this.map.mapHandler.spawnSector;
			};
			// override draw function
			this.map.mapHandler.spawnSector = (sub, sector) => {

				// call saved draw function
				this.map.mapHandler._spawnSector(sub, sector);

				// draw on map
				let overlayElem = $("#map_canvas_overlay_" + sector.x + "_" + sector.y);
				if (!overlayElem.length) {
					var overlay = document.createElement("canvas");
					overlay.style.position = "absolute";
					overlay.width = this.map.map.scale[0] * this.map.map.sectorSize;
					overlay.height = this.map.map.scale[1] * this.map.map.sectorSize;
					overlay.style.zIndex = 10;
					overlay.id = "map_canvas_overlay_" + sector.x + '_' + sector.y
					sector.appendElement(overlay);

					this.draw(sector, overlay, "map");
				};

				// draw on minimap
				for (let id in this.map.minimap._loadedSectors) {
					let sector = this.map.minimap._loadedSectors[id];
					let overlayElem = $("#mini_canvas_overlay_" + id);
					if (!overlayElem.length) {
						let overlay = document.createElement("canvas");
						overlay.style.position = "absolute";
						overlay.width = '250';
						overlay.height = '250';
						overlay.style.zIndex = 1;
						overlay.id = "mini_canvas_overlay_" + id;
						sector.appendElement(overlay);

						this.draw(sector, overlay, "mini");
					};
				};
			};
		},

		// object that handels function overrides
		Override: {
			override: function (map) {
				map.generateCommandIcons = this.generateCommandIcons;
				map.createVillageIcons = this.createVillageIcons;
				map.createVillageDot = this.createVillageDot;
				map.mapHandler._spawnSector = this._spawnSector;
				map.mapHandler.onResize = this.onResize;
				map.resize = this.resize;
			},

			generateCommandIcons: function (e) {
				var a = [];
				var sc = TWMap.scale
				if (TWMap.commandIcons[e])
					for (var t = TWMap.commandIcons[e], i = (t.length,
						2 * (Math.max(2, t.length) - 2)), o = 14 - i, n = 0; n < t.length; n++) {
						var s = document.createElement("img");
						s.style.position = "absolute",
							s.style.right = "0px",
							s.style.zIndex = "4",
							s.style.width = o * sc + "px",
							s.style.height = o * sc + "px",
							s.style.marginTop = "0px",
							s.style.marginLeft = (34 + 2 * i - n * (o + 5 - i)) * sc + "px",
							s.id = "map_cmdicons_" + e + "_" + n,
							s.src = TWMap.image_base + "/map/" + t[n].img + ".png",
							a.push(s)
					}
				return a
			},

			createVillageIcons: function (e) {
				if (TWMap.minimap_only)
					return [];
				var a = []
					, sc = TWMap.scale
					, t = 0;
				if (TWMap.villageIcons[e.id]) {
					var i = TWMap.villageIcons[e.id];
					for (var o in i)
						if (i.hasOwnProperty(o)) {
							var n, s = i[o];
							t++,
								(n = document.createElement("img")).style.position = "absolute",
								n.style.top = "0px",
								n.style.left = "0px",
								n.style.width = 18 * sc + "px",
								n.style.height = 18 * sc + "px",
								n.style.zIndex = "4",
								n.style.marginTop = 18 * sc + "px",
								n.style.marginLeft = (20 * t - 20) * sc + "px",
								n.id = "map_icons_" + e.id,
								n.style.backgroundColor = s.c,
								n.src = s.img ? s.img : TWMap.image_base + "/blank-16x22.png",
								a.push(n)
						}
				}
				TWMap.reservations.hasOwnProperty(e.id) && (t++,
					(n = document.createElement("img")).style.position = "absolute",
					n.style.top = "0px",
					n.style.left = "0px",
					n.style.width = 18 * sc + "px",
					n.style.height = 18 * sc + "px",
					n.style.zIndex = "4",
					n.style.marginTop = 18 * sc + "px",
					n.style.marginLeft = (20 * t - 20) * sc + "px",
					n.src = "/graphic/map/reserved_" + TWMap.reservations[e.id] + ".png",
					a.push(n));
				var l = this.generateCommandIcons(e.id);
				if ($(l).each(function () {
					a.push(this)
				}),
					TWMap.attackPlannerMode) {
					var p = AttackPlanner.getMapInfo();
					if (p[e.id]) {
						var r = 0;
						$.each(p[e.id].type, function (e, t) {
							if (t) {
								var i = document.createElement("img");
								switch (i.style.position = "absolute",
								i.style.zIndex = "10",
								r) {
									case 0:
									default:
										i.style.marginTop = "0px",
											i.style.marginLeft = "0px";
										break;
									case 1:
										i.style.marginTop = 20 * sc + "px",
											i.style.marginLeft = "0px";
										break;
									case 2:
										i.style.marginTop = "0px",
											i.style.marginLeft = 35 * sc + "px";
										break;
									case 3:
										i.style.marginTop = 20 * sc + "px",
											i.style.marginLeft = 35 * sc + "px"
								}
								i.src = TWMap.image_base + "/icons/attack_planner_" + e + ".png",
									a.push(i),
									r++
							}
						})
					}
				}
				return a
			},

			createVillageDot: function (e) {
				var a = document.createElement("canvas");
				var sc = TWMap.scale
				if (a.getContext) {
					a.style.position = "absolute",
						a.style.left = "0px",
						a.style.top = "0px",
						a.width = 18 * sc,
						a.height = 18 * sc,
						a.style.zIndex = "4",
						a.style.marginTop = "0px",
						a.style.marginLeft = "0px";
					var t = a.getContext("2d");
					return t.fillStyle = "rgb(" + e[0] + "," + e[1] + "," + e[2] + ")",
						t.strokeStyle = "#000000",
						t.beginPath(),
						t.arc(5 * sc, 5 * sc, 3.3 * sc, 0, 2 * sc * Math.PI, !1),
						t.fill(),
						t.stroke(),
						a
				}
				var i = document.createElement("img");
				return i.style.position = "absolute",
					i.style.left = "0px",
					i.style.top = "0px",
					i.style.width = 6 * sc + "px",
					i.style.height = 6 * sc + "px",
					i.style.zIndex = "4",
					i.style.marginTop = 3 * sc + "px",
					i.style.marginLeft = "0px",
					i.style.border = "0px",
					i.style.backgroundColor = "rgb(" + e[0] + "," + e[1] + "," + e[2] + ")",
					i
			},

			resize: function (e, a) {
				var sc = TWMap.scale
				0 == e ? (dstWidth = $(window).width(),
					dstHeight = Math.max(window.outerHeight, window.innerHeight),
					TWMap.fullscreen || (dstWidth -= 100,
						dstHeight -= 100),
					this.isAutoSize = !0) : "number" == typeof e ? (dstWidth = e * this.map.scale[0] / sc,
						dstHeight = e * this.map.scale[1] / sc,
						this.isAutoSize = !1) : (dstWidth = e[0] * this.map.scale[0] / sc,
							dstHeight = e[1] * this.map.scale[1] / sc,
							this.isAutoSize = !1),
					$.browser.msie && (a = !1),
					TWMap.map.resize(dstWidth, dstHeight, a ? 1 : 0),
					TWMap.home.updateDisplay()
			},

			_spawnSector: function (e, a) {
				if (!TWMap.minimap_only) {
					var sc = TWMap.scale
					var i = a.x - e.x
						, t = i + TWMap.mapSubSectorSize
						, p = a.y - e.y
						, s = p + TWMap.mapSubSectorSize;
					(TWMap.church.displayed || TWMap.church.possible_displayed || TWMap.attackPlannerMode || TribalWars._settings.map_show_watchtower) && MapCanvas.createCanvas(a, e),
						a.dom_fragment = document.createDocumentFragment();
					var o, n = this._createBorder(a.x % 100 == 0);
					if ("map_con_border" == n.className ? n.style.width = "3px" : n.style.width = "1px",
						n.style.height = TWMap.mapSubSectorSize * TWMap.tileSize[1] + "px",
						a.appendElement(n, 0, 0),
						"map_con_border" == (n = this._createBorder(a.y % 100 == 0)).className ? n.style.height = "3px" : n.style.height = "1px",
						n.style.width = TWMap.mapSubSectorSize * TWMap.tileSize[0] + "px",
						a.appendElement(n, 0, 0),
						TWMap.ghost) {
						var l = TWMap.ghost.x
							, r = TWMap.ghost.y;
						if (l >= a.x && l < a.x + TWMap.mapSubSectorSize && r >= a.y && r < a.y + TWMap.mapSubSectorSize) {
							TWMap.ghost.x,
								TWMap.ghost.y;
							TWMap.villages[1e3 * l + r] = {
								owner: 0,
								points: 0,
								img: TWMap.ghost_village_tile,
								special: "ghost"
							}
						}
					}
					for (o in e.tiles) {
						var m;
						if (e.tiles.hasOwnProperty(o))
							if (!((o = parseInt(o)) < i || o >= t))
								for (m in e.tiles[o])
									if (e.tiles[o].hasOwnProperty(m) && !((m = parseInt(m)) < p || m >= s)) {
										var d = document.createElement("img");
										d.style.position = "absolute",
											d.style.zIndex = "2";
										var c = TWMap.villages[1e3 * (e.x + o) + e.y + m];
										if (c) {
											var M = c.owner
												, h = c.owner > 0 && TWMap.players[c.owner] ? TWMap.players[c.owner].ally : 0
												, W = null;
											if (c.id == game_data.village.id ? W = TWMap.colors.this : TWMap.villageColors[c.id] ? W = TWMap.villageColors[c.id] : 0 != c.owner ? W = TWMap.getColorByPlayer(M, h, c.id) : c.ally_id && (W = TWMap.getColorByPlayer(0, c.ally_id, c.id)) && (W = TWMap.createVillageDot(W)),
												W) {
												var T = TWMap.createVillageDot(W);
												a.appendElement(T, o - i, m - p)
											}
											imgsrc = TWMap.images[c.img],
												d.id = "map_village_" + c.id,
												d.setAttribute("src", TWMap.graphics + imgsrc),
												d.style.width = 53 * sc + "px",
												d.style.height = 38 * sc + "px",
												!TribalWars._settings.map_casual_hide || parseInt(c.owner) === parseInt(game_data.player.id) || -1 === $.inArray(c.owner, TWMap.non_attackable_players) && -1 === $.inArray(c.id, TWMap.non_attackable_villages) || (d.style.opacity = .4,
													d.style.filter = "alpha(opacity=40)");
											var y, u = TWMap.createVillageIcons(c);
											for (y = 0; y < u.length; y++)
												a.appendElement(u[y], o - i, m - p);
											$(d).mouseout(TWMap.popup.hide())
										} else
											d.setAttribute("src", TWMap.graphics + TWMap.images[e.tiles[o][m]]),
												d.style.width = 53 * sc + "px",
												d.style.height = 38 * sc + "px"
										a.appendElement(d, o - i, m - p)
									}
					}
					a._element_root.appendChild(a.dom_fragment),
						a.dom_fragment = void 0
				}
			},

			onResize: function (e, a) {
				var sc = TWMap.scale
				TWMap.scaleMinimap(),
					TWMap.size = TWMap.map.coordByPixel(e, a, !1),
					TWMap.size = [Math.round(TWMap.size[0] * sc), Math.round(TWMap.size[1] * sc)],
					TWMap.isDragResizing || TWMap.notifyMapSize(TWMap.isAutoSize)
			}
		},

		// imports data from website
		importData: function (data) {
			if (!data.length) return;

			try {
				for (let [world, link] of data) {
					if (world == this.world) {
						$.ajax({
							url: link
						}).done((data) => {
							data = JSON.parse(data);

							if (data.length) {
								for (let i = 0; i < data.length; i++) {
									let dat = data[i];
									let group = Object.assign(new this.UI.Group, dat);
									this.groups.set(this.lastImportId++, group);
								};
							}

							this.map.reload();
						});
					};
				};
			} catch (error) {
				console.log("Error in function: importData", error.message);
				UI.ErrorMessage(error);
			};
		},

		// loads data from local storage
		loadData: function () {
			let data = JSON.parse(localStorage.getItem("tw_line_drawer_" + this.world + "_" + this.player) || "[]");

			try {
				if (data.length) {
					for (let i = 0; i < data.length; i++) {
						let dat = data[i];
						let group = Object.assign(new this.UI.Group, dat);
						this.groups.set(this.lastLoadId++, group);
					};
				}
			} catch (error) {
				console.log("Error in function: loadData", error.message);
			};
		},

		// loads data from forum
		loadForumData: function () {
			// get forum link from local storage
			let link = localStorage.getItem("tw_line_drawer_forum_link_" + this.world + "_" + this.player) || "[]";
			if (!link.length) return;
			// load data from forum
			try {
				$.ajax({
					url: link
				}).done((data) => {
					var posts = $(data).find(".post");
					for (let i = 0; i < posts.length; i++) {
						// only get data from posts that are thanked
						if ($(posts[i]).html().indexOf("unthank") > -1) {
							// search with jquery for class "text", filter text with regex for "[{...}]"
							let data = $(posts[i]).find(".text").text().match(/\[{.*}\]/g);
							// if data found, parse and create group object
							if (data.length) {
								for (let j = 0; j < data.length; j++) {
									// parse with json and create group object
									let dat = JSON.parse(data[j])[0];
									let group = Object.assign(new this.UI.Group, dat);
									this.groups.set(this.lastImportId++, group);
								};
							};
						};
					};
					// reload map
					this.map.reload();
				});
			} catch (error) {
				console.log("Error in function: loadForumData", error.message);
			};
		},

		// reloads map and minimap
		refreshMap: function () {
			this.map.map.reload();
			this.map.minimap.reload();
		},

		// sets the map scale
		rescaleMap: function (scale, first) {
			let c = Math.round(Math.sqrt(continents) * 50);
			let old = first ? 1 : this.scale;
			let pos = window.location.hash.match(/^#([0-9]+);([0-9]+)$/);
			this.scale = scale;
			TWMap.scale = scale;
			this.map.map.scale = [53 * scale, 38 * scale];
			this.map.tileSize = [53 * scale, 38 * scale];
			this.map.map.bias = 26500 * scale;
			for (let i = (500 - c); i < (500 + c); i++)
				TWMap._coord_el_y_active[i] || (TWMap._coord_el_y_active[i] = !0,
					TWMap.map_el_coordy.appendChild(TWMap._coord_el_y[i]));
			for (let i = (500 - c); i < (500 + c); i++)
				TWMap._coord_el_x_active[i] || (TWMap._coord_el_x_active[i] = !0,
					TWMap.map_el_coordx.appendChild(TWMap._coord_el_x[i]));
			/*$.each(TWMap._coord_el_y, function() { 
				$(this).css("height", 38 * scale + "px");
				$(this).css("line-height", 38 * scale + "px");
				$(this).css("top", $(this).css("top").replace("px", "") / old * scale + "px");
			});*/
			$("#map_coord_y > div").each(function () {
				$(this).css("height", 38 * scale + "px");
				$(this).css("line-height", 38 * scale + "px");
				$(this).css("top", $(this).css("top").replace("px", "") / old * scale + "px");
			});
			$("#map_coord_x > div").each(function () {
				$(this).css("width", 53 * scale + "px");
				$(this).css("left", $(this).css("left").replace("px", "") / old * scale + "px");
			});
			$("#map_container").css("image-rendering", "pixelated");
			this.map.minimap.resize();
			this.map.map.reload();
			null !== pos && this.map.map.centerPos(pos[1], pos[2]);
			this.UI.updateUiName();
		},

		// adds map scale select element
		addMapRescaleChooser: function (scale) {
			const elem = $(`
				<tr>
					<td>
						<table cellspacing="0">
							<tbody>
								<tr>
									<td width="80">
										${this.UI.lang.scale + ":"}
									</td>
									<td colspan="2">
										<select id="map_scale_chooser">
											<option value="0.5">50%</option>
											<option value="0.55">55%</option>
											<option value="0.6">60%</option>
											<option value="0.65">65%</option>
											<option value="0.7">70%</option>
											<option value="0.75">75%</option>
											<option value="0.8">80%</option>
											<option value="0.85">85%</option>
											<option value="0.9">90%</option>
											<option value="0.95">95%</option>
											<option value="1" selected="selected">100%</option>
											<option value="1.1">110%</option>
											<option value="1.2">120%</option>
											<option value="1.3">130%</option>
											<option value="1.4">140%</option>
											<option value="1.5">150%</option>
										</select>
									</td>
								</tr>
							</tbody>
						</table>
					</td>
				</tr>
			`);

			$("#map_topo > table").append(elem);

			$("#map_scale_chooser").val(scale);

			$("#map_scale_chooser").on("change", function () {
				TWLineDrawer.rescaleMap($(this).val());
				return false;
			});
		},

		// creates empty line
		createLine: function () {
			return ([[]]);
		},

		// adds a coord pair to currentLine
		addCoordsToLine: function (coords) {
			this.currentLine[0].push(coords);
			this.map.reload();
		},

		// removes last added coord from currentLine
		undoCoords: function () {
			if (this.currentLine && this.currentLine[0].length >= 1) {
				this.currentLine[0].pop();
				this.map.reload();
			};
		},

		// adds currentLine to lines object and to UI and resets it
		addLine: function () {
			if (this.currentLine[0].length > 1) {
				this.UI.addLineToGroup(this.currentLine);
			}
			this.currentLine = this.createLine();
		},

		// adds label to labels object and to UI
		addLabel: function (coords) {
			let label = prompt(this.UI.lang.enterLabel)
			if (label) {
				this.UI.addLabelToGroup([coords, label]);
			};
			this.map.reload();
		},

		// starts the drawing process
		draw: function (sector, canvas, type) {
			// draw everything if ui not enabled
			if (!this.enabled) {
				if (!this.groups.size) return;
				for (let [id, data] of this.groups) {
					// only draw if show == true
					if (data.show) {
						for (let line of data.lines) {
							if (type == "map") {
								this.drawLineOnMap(...line, data.mapColor, data.mapWidth.replace("px", ""), sector, canvas);
							} else if (type == "mini" && data.drawOnMini) {
								this.drawLineOnMinimap(...line, data.miniColor, data.miniWidth.replace("px", ""), sector, canvas);
							};
						};
						for (let label of data.labels) {
							this.drawLabelOnMap(...label, data.labelsColor, data.labelsFontSize, data.labelsRoot, sector, canvas);
						};
					};
				};
				return;
			};

			// else draw currentLine
			if (this.currentLine && this.currentLine.length && this.currentLine[0].length > 1) {
				this.drawLine(...this.currentLine, sector, canvas, type);
			};

			// and data from selected group
			let id = this.UI.selected;
			if (!id || !this.groups.size) return;

			let data = this.groups.get(id);

			if (!data) return

			for (let line of data.lines) {
				if (type == "map") {
					this.drawLineOnMap(...line, data.mapColor, data.mapWidth.replace("px", ""), sector, canvas);
				} else if (type == "mini" && data.drawOnMini) {
					this.drawLineOnMinimap(...line, data.miniColor, data.miniWidth.replace("px", ""), sector, canvas);
				};
			};
			for (let label of data.labels) {
				this.drawLabelOnMap(...label, data.labelsColor, data.labelsFontSize, data.labelsRoot, sector, canvas);
			};
		},

		// gets missing data and calls the right draw function
		drawLine: function (coords, sector, canvas, type) {
			if (this.UI.selected == undefined) {
				return false;
			}
			var id = this.UI.selected;

			if (type == "map") {
				var color = $(`#map_color_chooser_${id}`).val();
				var width = $(`#map_width_chooser_${id}`).val();
				this.drawLineOnMap(coords, color, width, sector, canvas);
			};

			let drawOnMini = $(`#draw_on_mini_${id}`).prop("checked");
			if (drawOnMini && type == "mini") {
				var color = $(`#mini_color_chooser_${id}`).val();
				var width = $(`#mini_width_chooser_${id}`).val();
				this.drawLineOnMinimap(coords, color, width, sector, canvas);
			};
		},

		// draws a line on the map
		drawLineOnMap: function (coords, color, width, sector, canvas) {
			//.... todo check if line is on canvas
			let context = canvas.getContext("2d");
			let startPixels = this.getPixelsByCoords(sector, coords[0]);
			context.beginPath();
			context.moveTo(...startPixels);
			for (let i = 1; i < coords.length; i++) {
				let pixels = this.getPixelsByCoords(sector, coords[i]);
				context.lineTo(...pixels);
			};
			context.strokeStyle = color;
			context.lineWidth = width * this.scale;
			context.stroke();
		},

		// draws a line on the minimap
		drawLineOnMinimap: function (coords, color, width, sector, canvas) {
			//.... todo check if line is on canvas
			let context = canvas.getContext("2d");
			let startPixels = [(coords[0][0] - sector.x) * 5, (coords[0][1] - sector.y) * 5];
			context.beginPath();
			context.moveTo(...startPixels);
			for (let i = 1; i < coords.length; i++) {
				let pixels = [(coords[i][0] - sector.x) * 5, (coords[i][1] - sector.y) * 5];
				context.lineTo(...pixels);
			};
			context.strokeStyle = color;
			context.lineWidth = width;
			context.stroke();
		},

		// gets missing data and calls drawLabelOnMap function
		drawLabel: function (coords, label, sector, canvas, /*color, size, root, id*/) {
			// todo data in function call?
			if (this.UI.selected == undefined) {
				return;
			}
			let id = this.UI.selected;

			let color = $(`#label_color_chooser_${id}`).val();
			let size = $(`#label_font_size_chooser_${id}`).val();
			let root = $(`#label_root_chooser_${id}`).val();
			this.drawLabelOnMap(coords, label, color, size, root, sector, canvas);
		},

		// draws a label on the map
		drawLabelOnMap: function (coords, label, color, size, root, sector, canvas) {
			//.... todo check if label is on canvas
			let context = canvas.getContext("2d");
			let position = this.getPixelsByCoords(sector, coords);
			context.fillStyle = color;
			context.textAlign = "center";
			context.font = size.replace(size.match(/[0-9]+/g)[0], size.match(/[0-9]+/g)[0] * this.scale) + " Arial";
			context.textBaseline = "middle";
			context.fillText(label, position[0] + this.map.map.scale[0] * (root == "center" ? 0.5 : 0), position[1]);
		},

		// returns the pixels coresponding to the coordinates
		getPixelsByCoords: function (sector, coords) {
			let sectorPixels = this.map.map.pixelByCoord(sector.x, sector.y)
			let coordsPixels = this.map.map.pixelByCoord(...coords);
			return ([(coordsPixels[0] - sectorPixels[0]), (coordsPixels[1] - sectorPixels[1])])
		},

		// overrides the on click function and shows the ui
		enableScript: function () {
			if (this.enabled) return;

			this.UI.enableScript(this);

			this.setMode("line");

			this.enabled = true;

			if (!this.map.mapHandler._onClick) {
				this.map.mapHandler._onClick = this.map.mapHandler.onClick;
				this.map.mapHandler.onClick = this.clickFunction;
			};

			this.map.reload();

			if (!this.currentLine) {
				this.currentLine = this.createLine();
			};
		},

		// restores normal functionality
		disableScript: function () {
			this.enabled = false;
			this.map.reload();
		},

		// handles the onClick event
		clickHandler: function (x, y, event) {
			if (!this.enabled) {
				this.map.mapHandler._onClick(x, y, event);
			} else if (this.UI.selected == undefined) {
				UI.ErrorMessage("Select Group");
			} else if (this.mode == "line") {
				this.addCoordsToLine([x, y]);
			} else if (this.mode == "label") {
				this.addLabel([x, y]);
			} else if (this.mode == "delete") {
				this.UI.removeAtCoords([x, y]);
			} else if (this.mode == "select corridor") {
				this.UI.selectVillagesInCorridorOfCoord([x, y]);
			} else if (this.mode == "edit select") {
				this.UI.selectVillages([x, y]);
			};
			return false;
		},

		// new click function
		clickFunction: function (x, y, event) {
			// call clickHandler
			TWLineDrawer.clickHandler(x, y);
			return false;
		},

		// sets the mode
		setMode: function (mode) {
			this.mode = mode;
			this.UI.updateUiName();
		},

		// UI object
		UI: {
			textContainer: function () { return $("#line_drawer_value"); },
			tabContainer: function () { return $("#line_drawer_tab_bar"); },

			// todo nach TWLineDrawer verschieben 
			parent: undefined,
			selected: undefined,
			lastSelected: [],
			groups: new Map(),
			lastId: 10000,
			villages: [],

			// saves groups into local storage
			saveData: function () {
				// return if not enabled
				if (!this.enabled) return;

				let data = [];

				this.groups.forEach(function (value, id, map) {
					// add group if not imported (id >= 1000)
					id >= 1000 && data.push(value);
				});

				localStorage.setItem("tw_line_drawer_" + this.parent.world + "_" + this.parent.player, JSON.stringify(data));
			},

			//language object
			lang: {
				newGroup: "New Group",
				group: "Group",
				groups: "Groups",
				map: "Map",
				minimap: "Minimap",
				lines: "Lines",
				labels: "Labels",
				enterNewGroupName: "Enter new Group name",
				enterLabel: "Enter text for Label",
				rename: "Rename",
				delete: "Delete",
				left: "Left",
				center: "Center",
				scale: "Scale",
				settings: "Settings",
				show: "Show",
				export: "Export",
				import: "Import",
				save: "Save",
				selectAll: "Select all",
				settingsWindowExistsAlready: "Settings Window already exists",
				villages: "Villages",
				copied: "Copied",
				readIn: "Read in",
				nameTooShort: "Name must be at least 3 characters long",
				selectCorridorFirst: "Select corridor first",


				// language object for german
				german: {
					newGroup: "Neue Gruppe",
					group: "Gruppe",
					groups: "Gruppen",
					map: "Karte",
					minimap: "Minimap",
					lines: "Linien",
					labels: "Beschriftungen",
					enterNewGroupName: "Neuen Namen für Gruppe eingeben",
					enterLabel: "Text für Beschriftung eingeben",
					rename: "Umbenennen",
					delete: "Löschen",
					left: "Links",
					center: "Mittig",
					scale: "Skalierung",
					settings: "Einstellungen",
					show: "Anzeigen",
					export: "Export",
					import: "Import",
					save: "Speichern",
					selectAll: "Alle auswählen",
					settingsWindowExistsAlready: "Einstellungsfenster existiert bereits",
					villages: "Dörfer",
					copied: "Kopiert",
					readIn: "Eingelesen",
					nameTooShort: "Name muss mindestens 3 Zeichen lang sein",
					selectCorridorFirst: "Korridor muss ausgewählt sein",
				},
			},

			// creates the tab element for group "id", adds listeners and appends it to "elem"
			createTabElement: function (id) {
				const elem = $(`
					<div id="tab_${id}" class="memo-tab">
						<span class="memo-tab-label" style="margin: auto 2px">
							<a class="TWLineDrawer_Select" href="#">${this.lang.newGroup}</a>
						</span>
						<a class="rename-icon" href="#" style="margin-top: 4px"></a>
						<span class="memo-tab-button-close" style="margin: 1px">
							<img src="https://dsde.innogamescdn.com/asset/2871a0d9/graphic/delete.png">
						</span>
					</div>
				`);

				// if imported add to front
				id < 1000 ? this.tabContainer().children().eq(1).after(elem) : this.tabContainer().append(elem);

				$(`#tab_${id} .rename-icon`).on("click", () => {
					this.renameGroup(id);
					return false;
				});

				$(`#tab_${id} .TWLineDrawer_Select`).on("click", () => {
					this.selectGroup(id);
					return false;
				});

				$(`#tab_${id} .memo-tab-button-close`).on("click", () => {
					// "Gruppe wirklich löschen?", "Bestätigen"
					UI.ConfirmationBox(_('1d7a209e5461c92be4a38e7cfef02380'), [{
						'text': _('70d9be9b139893aa6c69b5e77e614311'),
						'confirm': true, 'callback': () => { this.deleteGroup(id) }
					}]);
					return false;
				});
			},

			// creates the element holding text for group "id", adds listeners and appends it to "elem"
			createTextElement: function (id) {
				const elem = $(`
					<div id="group_${id}" class="memo_container" style="display:none">
						<table class="vis" width="100%" style="margin-top: 5px;">
							<tbody>
								<tr class="edit_row" style="">
									<td colspan="2">
										<textarea id="lines_${id}" placeholder="${this.lang.lines}" cols="62" rows="12" "></textarea>
									</td>
								</tr>
								<tr>
									<td>
										<span>
											<input type="color" id="map_color_chooser_${id}" value="#ffffff" style="margin-right: 2px">
											<select id="map_width_chooser_${id}" style="font-size: 12pt;">
												<option value="1">1px</option>
												<option value="2">2px</option>
												<option value="3">3px</option>
												<option value="4">4px</option>
												<option selected="selected" value="5">5px</option>
												<option value="6">6px</option>
												<option value="8">8px</option>
												<option value="10">10px</option>
											</select>
											<span style="font-size: 12pt;">
												${this.lang.map}
											</span>
										</span>
									</td>
									<td>
										<span style="float: right;">
											<input type="checkbox" name="draw_on_mini" id="draw_on_mini_${id}">
											<span style="font-size: 12pt;">
												${this.lang.minimap}
											</span>
											<select id="mini_width_chooser_${id}" style="font-size: 12pt;">
												<option value="1">1px</option>
												<option selected="selected" value="1.5">1.5px</option>
												<option value="2">2px</option>
												<option value="2.5">2.5px</option>
												<option value="3">3px</option>
												<option value="3.5">3.5px</option>
												<option value="4">4px</option>
												<option value="5">5px</option>
											</select>
											<input type="color" id="mini_color_chooser_${id}" value="#ffffff" style="margin-left: 2px">
										</span>
									</td>
								</tr>
								<tr class="edit_row" style="">
									<td colspan="2">
										<textarea id="labels_${id}" placeholder="${this.lang.labels}" cols="62" rows="6" "></textarea>
									</td>
								</tr>
								<tr>
									<td>
										<span>
											<input type="color" id="label_color_chooser_${id}" value="#00ff00" style="margin-right: 2px">
											<select id="label_font_size_chooser_${id}" style="font-size: 12pt;">
												<option value="10px">10px</option>
												<option value="bold 10px">bold 10px</option>
												<option value="12px">12px</option>
												<option value="bold 12px">bold 12px</option>
												<option value="16px">16px</option>
												<option selected="selected" value="bold 16px">bold 16px</option>
												<option value="20px">20px</option>
												<option value="bold 20px">bold 20px</option>
												<option value="24px">24px</option>
												<option value="bold 24px">bold 24px</option>
												<option value="32px">32px</option>
												<option value="bold 32px">bold 32px</option>
											</select>
											<select id="label_root_chooser_${id}" style="font-size: 12pt;">
												<option value="left">${this.lang.left}</option>
												<option selected="selected" value="center">${this.lang.center}</option>
											</select>
										</span>
									</td>
									<td style="position: relative; text-align: right">
										<a class="TWLineDrawer_Refresh" href="#" style="position: absolute; bottom: 0px; right: 0px; margin: 5px">
											Refresh
										</a>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				`);

				this.textContainer().append(elem);

				$(elem).on("change", () => {
					this.updateGroup(id);
					return false;
				});

				$(`#group_${id} .TWLineDrawer_Refresh`).on("click", () => {
					this.parent.refreshMap();
					return false;
				});
			},

			// creates the UI element and adds listeners
			createUiElement: function () {
				const elem = $(`
					<div id="line_drawer" class="popup_style ui-draggable"
						style="z-index: 11111; display: block; top: 24%; left: 68%; position: fixed; width: min-content; min-width: 350px">
						<div class="popup_menu ui-draggable-handle">
							<p style="display: inline;">Line Drawer</p><a id="closelink_line_drawer" href="#">X</a>
						</div>
						<div class="popup_content" style="height: auto; overflow-y: auto;">
							<table class="main" root="left">
								<tbody>
									<tr>
										<td id="line_drawer_value">
											<h2 style="float: left; margin-right: 20px">
												${this.lang.groups}
											</h2>
											<div id="line_drawer_tab_bar" style=" clear:both; overflow:hidden; margin-top: 0px; margin-bottom: 10px">
												<div id="line_drawer_settings" class="memo-tab" style="padding: 0px; height: 22px; width: 22px; text-align: center; line-height: 22px;">
													<a href="#">⚙️</a>
												</div>
												<div id="memo-add-tab-button">
													<a href="#">+</a>
												</div>
											</div>
										</td>
									</tr>
									<tr>
										<td colspan="2">
											<hr>
										</td>
									</tr>
									<tr>
										<td colspan="2">
											<h5 id="hotkey_toggle" class="popup_options_toggler" style="margin:0px;">
												Hotkeys
												<img id="hotkey_toggle_icon" class="popup_options_toggler" src="https://dsde.innogamescdn.com/asset/2871a0d9/graphic//icons/slide_up.png" style="float:right;">
											</h5>
										</td>
									</tr>
									<tr id="hotkey_row" style="display: block">
										<td>
											<input id="line_mode_btn" type="button" class="btn" style="margin: 2px" value="line mode (${enableLineModeHotkey})">
											<input id="label_mode_btn" type="button" class="btn" style="margin: 2px" value="label mode (${enableLabelModeHotkey})">
											<input id="delete_mode_btn" type="button" class="btn" style="margin: 2px" value="delete mode (${enableDeleteModeHotkey})">
											<input id="select_corr_mode_btn" type="button" class="btn" style="margin: 2px" value="select corr mode (${enableSelectCorridorModeHotkey})">
											<input id="edit_select_mode_btn" type="button" class="btn" style="margin: 2px" value="edit select mode (${enableEditSelectModeHotkey})">
											<input id="add_line_btn" type="button" class="btn" style="margin: 2px" value="add line (${addLineHotkey})">
											<input id="undo_btn" type="button" class="btn" style="margin: 2px" value="undo (${undoCoordsHotkey})">
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				`);
				$("body").append(elem);
				$(elem).draggable();

				$("#closelink_line_drawer").on("click", (event) => {
					$("#line_drawer").remove();
					// close settings window if open
					$("#line_drawer_settings_popup").remove();
					// close select window if open
					$("#TWLD_Select").remove();
					this.disableScript();
					return false;
				});

				$("#memo-add-tab-button").on("click", (event) => {
					this.addGroup(true, undefined, true);
					return false;
				});

				$("#line_drawer_settings").on("click", (event) => {
					this.createSettingsPopup();
					return false;
				});

				$("#hotkey_toggle").on("click", (event) => {
					if ($("#hotkey_toggle_icon").attr("src").includes("up")) {
						$("#hotkey_toggle_icon").attr("src", $("#hotkey_toggle_icon").attr("src").replace("up", "down"));
						$("#hotkey_row").css("display", "none");
					} else if ($("#hotkey_toggle_icon").attr("src").includes("down")) {
						$("#hotkey_toggle_icon").attr("src", $("#hotkey_toggle_icon").attr("src").replace("down", "up"));
						$("#hotkey_row").css("display", "block");
					};
				});

				$("#line_mode_btn").on("click", (event) => {
					this.parent.setMode("line");
					UI.InfoMessage("line mode");
				});

				$("#label_mode_btn").on("click", (event) => {
					this.parent.setMode("label");
					UI.InfoMessage("label mode");
				});

				$("#delete_mode_btn").on("click", (event) => {
					this.parent.setMode("delete");
					UI.InfoMessage("delete mode");
				});

				$("#select_corr_mode_btn").on("click", (event) => {
					this.parent.setMode("select corridor");
					UI.InfoMessage("select corridor mode");
				});

				$("#edit_select_mode_btn").on("click", (event) => {
					this.parent.setMode("edit select");
					UI.InfoMessage("edit select mode");
				});

				$("#add_line_btn").on("click", (event) => {
					this.parent.addLine();
					UI.InfoMessage("add line");
				});

				$("#undo_btn").on("click", (event) => {
					this.parent.undoCoords();
					UI.InfoMessage("undo");
				});
			},

			// creates settings window and shows it
			createSettingsPopup: function () {
				// return if settings window already open
				if ($("#line_drawer_settings_popup").length) {
					UI.ErrorMessage(this.lang.settingsWindowExistsAlready);
					return;
				};

				// main window
				const main = $(`
					<div id="line_drawer_settings_popup" class="popup_style ui-draggable ui-draggable-handle" style="display: block;top: 20%;left: 60%;position: fixed;width: min-content;min-width: 400px;">
						<div class="popup_menu ui-draggable-handle">
							<p style="display: inline;">${this.lang.settings}</p>
							<a id="closelink_line_drawer_settings" href="#">
								X
							</a>
						</div>
						<div class="popup_content" style="height: auto;overflow-y: auto;">
							<table class="vis" style="width: -webkit-fill-available;">
								<tbody>
									<tr>
										<th>${this.lang.group}</th>
										<th>${this.lang.show}</th>
										<th>${this.lang.export}</th>
									</tr>
									<tr>
										<th>
											${this.lang.selectAll}
										</th>
										<th>
											<input type="checkbox" class="select_all_show">
										</th>
										<th>
											<input type="checkbox" class="select_all_export">
										</th>
									</tr>
								</tbody>
							</table>
							<table class="vis" style="width: 100%; text-align: right">
								<tbody>
									<tr>
										<td>
											<input id="line_drawer_settings_save" class="btn" value="${this.lang.save}" type="submit" style="float: left">
											<input id="line_drawer_settings_export" class="btn" value="${this.lang.export}" type="submit">
											<input id="line_drawer_settings_import" class="btn" value="${this.lang.import}" type="submit">
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				`);

				$("body").append(main);
				$(main).draggable();

				// groups
				for (let [id, data] of this.groups) {
					if (id < 1000) continue;
					const child = $(`
						<tr>
							<td>
								<a>
									${data.name}
								</a>
							</td>
							<td>
								<input type="checkbox" name="show" value="${id}" class="show" ${data.show ? 'checked = "checked"' : ''}>
							</td>
							<td>
								<input type="checkbox" name="export" value="${id}" class="export">
							</td>
						</tr>
					`);


					$("#line_drawer_settings_popup > div.popup_content > table:nth-child(1) > tbody > tr").eq(-2).after(child);
				};

				// listeners
				// close 
				$("#closelink_line_drawer_settings").on("click", (event) => {
					;
					$("#line_drawer_settings_popup").remove();
					return false;
				});

				// check all "show" checkboxes
				$("#line_drawer_settings_popup .select_all_show").on("change", (event) => {
					if (event.currentTarget.checked) {
						$("#line_drawer_settings_popup .show").prop("checked", true);
					} else {
						$("#line_drawer_settings_popup .show").prop("checked", false);
					};
					return false;
				});

				// check all "export" checkboxes
				$("#line_drawer_settings_popup .select_all_export").on("change", (event) => {
					if (event.currentTarget.checked) {
						$("#line_drawer_settings_popup .export").prop("checked", true);
					} else {
						$("#line_drawer_settings_popup .export").prop("checked", false);
					};
					return false;
				});

				// save settings and show/hide groups
				$("#line_drawer_settings_save").on("click", (event) => {
					$("#line_drawer_settings_popup .show").each((index, elem) => {
						let id = $(elem).val() * 1;
						group = this.groups.get(id);
						let checked = $(elem).prop("checked")
						group.show = checked;

						if (checked) {
							$(`#tab_${id}`).css("display", "block");
						} else {
							group.selected = false;
							this.selected = undefined;
							$(`#tab_${id}`).css("display", "none");
							$(`#group_${id}`).css("display", "none");
							$(`#tab_${id}`).removeClass("memo-tab-selected");
						};

						this.groups.set(id, group);
					});
					this.saveData();
					this.parent.map.reload();
					$("#line_drawer_settings_popup").remove();
					return false;
				});

				// export
				$("#line_drawer_settings_export").on("click", (event) => {
					let groupArr = [];
					$("#line_drawer_settings_popup .export").each((index, elem) => {
						if ($(elem).prop("checked")) {
							let id = $(elem).val() * 1;
							// clone
							let group = JSON.parse(JSON.stringify(this.groups.get(id)));
							group.selected = false;
							group.show = true;
							groupArr.push(group);
						};
					});
					console.log(JSON.stringify(groupArr, null, 4));
					navigator.clipboard.writeText(JSON.stringify(groupArr)).then(() => {
						UI.SuccessMessage(this.lang.copied);
					});
				});

				// import 
				$("#line_drawer_settings_import").on("click", (event) => {
					if (typeof navigator.clipboard.readText !== "undefined") {
						navigator.clipboard.readText()
							.then(text => {
								try {
									let data = JSON.parse(text);

									if (data.length) {
										for (let i = 0; i < data.length; i++) {
											let dat = data[i];
											let group = Object.assign(new this.Group, dat);
											group.selected = false;
											this.groups.set(this.lastId, group);
											this.loadGroup(group, this.lastId++);
										};
									}

									this.saveData();
									UI.SuccessMessage(this.lang.readIn);
								} catch (error) {
									console.log("Error while importing", error.message);
									UI.ErrorMessage(error);
								};
							})
							.catch(error => {
								UI.ErrorMessage(error);
							});
					} else {
						let elem = `
							<table class="vis" width="100%">
								<tbody>
									<tr class="edit_row">
										<td>
											<textarea placeholder="${this.lang.import}" cols="40" rows="20"></textarea>
										</td>
									</tr>
									<tr>
										<td style="text-align: center">
											<span>
												<input type="button" class="btn" value="${this.lang.import}">
											</span>
										</td>
									</tr>
								</tbody>
							</table>
						`;
						UI.AjaxPopup(null, "TWLD_Import", elem, `${this.lang.import}`, null, { dataType: "prerendered" }, "min-content", "auto", "auto");
						$("#TWLD_Import_content table > tbody > tr > td > span > input").on("click", () => {
							try {
								let data = JSON.parse($("#TWLD_Import_content > table > tbody > tr > td > textarea").val());

								if (data.length) {
									for (let i = 0; i < data.length; i++) {
										let dat = data[i];
										let group = Object.assign(new this.Group, dat);
										group.selected = false;
										this.groups.set(this.lastId, group);
										this.loadGroup(group, this.lastId++);
									};
								}

								this.saveData();
								UI.SuccessMessage(this.lang.readIn);
							} catch (error) {
								console.log("Error while importing", error.message);
								UI.ErrorMessage(error);
							};
						});
					};
				});
			},

			// group object
			Group: function (name = "New Group", mapColor = "#ffffff", mapWidth = "5px",
				drawOnMini = false, miniColor = "#ffffff", miniWidth = "1.5px", lines = [], labelsColor = "#00ff00",
				labelsFontSize = "bold 16px", labelsRoot = "center", labels = [], selected = false, show = true) {
				this.name = name;
				this.mapColor = mapColor;
				this.mapWidth = mapWidth;
				this.drawOnMini = drawOnMini;
				this.miniColor = miniColor;
				this.miniWidth = miniWidth;
				this.lines = lines;
				this.labelsColor = labelsColor;
				this.labelsFontSize = labelsFontSize;
				this.labelsRoot = labelsRoot;
				this.labels = labels;
				this.selected = selected;
				this.show = show
			},

			// creates a group in the UI for each group in the groups map
			loadGroupsMapIntoUi() {
				let last = undefined;
				let selected = undefined;

				if (!this.groups.size) return;
				for (let [id, data] of this.groups) {
					// create UI elements
					this.addGroup(false, id, false, false);
					// load data into UI
					$(`#tab_${id} > span.memo-tab-label > a`).text(data.name);
					for (let line of data.lines) {
						$(`#lines_${id}`).val($(`#lines_${id}`).val() + JSON.stringify(line) + "\n");
					};
					for (let label of data.labels) {
						$(`#labels_${id}`).val($(`#labels_${id}`).val() + JSON.stringify(label) + "\n");
					};
					$(`#map_color_chooser_${id}`).val(data.mapColor);
					$(`#map_width_chooser_${id}`).val(data.mapWidth.replace("px", ""));
					data.drawOnMini && $(`#draw_on_mini_${id}`).prop("checked", "checked");
					$(`#mini_color_chooser_${id}`).val(data.miniColor);
					$(`#mini_width_chooser_${id}`).val(data.miniWidth.replace("px", ""));
					$(`#label_color_chooser_${id}`).val(data.labelsColor);
					$(`#label_font_size_chooser_${id}`).val(data.labelsFontSize);
					$(`#label_root_chooser_${id}`).val(data.labelsRoot);
					data.selected && (selected = id);
					// if group is imported rename to [imp] name, disable and remove rename/delete buttons
					if (id < 1000) {
						$(`#tab_${id} > span.memo-tab-label > a`).text("[imp]" + data.name);
						$(`#group_${id}`).find("input,select,textarea,button").prop("disabled", true);
						$(`#tab_${id} > .rename-icon`).remove();
						$(`#tab_${id} > .memo-tab-button-close`).remove();

					};
					// if show==true display:block and last = id, else display:none
					data.show ? $(`#tab_${id}`).css("display", "block") && (last = id) : $(`#tab_${id}`).css("display", "none");
					// save id if shown
					data.show && (last = id);
				};

				// select last added group (with selected = true)
				last && this.selectGroup(selected !== undefined ? selected : last);
			},

			// loads a single group into the UI
			loadGroup: function (group, id) {
				this.addGroup(false, id, false, false);
				// load group into UI
				$(`#tab_${id} > span.memo-tab-label > a`).text(group.name);
				for (let line of group.lines) {
					$(`#lines_${id}`).val($(`#lines_${id}`).val() + JSON.stringify(line) + "\n");
				};
				for (let label of group.labels) {
					$(`#labels_${id}`).val($(`#labels_${id}`).val() + JSON.stringify(label) + "\n");
				};
				$(`#map_color_chooser_${id}`).val(group.mapColor);
				$(`#map_width_chooser_${id}`).val(group.mapWidth.replace("px", ""));
				group.drawOnMini && $(`#draw_on_mini_${id}`).prop("checked", "checked");
				$(`#mini_color_chooser_${id}`).val(group.miniColor);
				$(`#mini_width_chooser_${id}`).val(group.miniWidth.replace("px", ""));
				$(`#label_color_chooser_${id}`).val(group.labelsColor);
				$(`#label_font_size_chooser_${id}`).val(group.labelsFontSize);
				$(`#label_root_chooser_${id}`).val(group.labelsRoot);
				$(`#tab_${id}`).css("display", "block");
			},

			// adds a group to the UI
			addGroup: function (select, id, set, save) {
				var id = id || this.lastId++;

				this.createTabElement(id);
				this.createTextElement(id);
				select && this.selectGroup(id);

				// map(id: {name: "New Group", ...})
				set && this.groups.set(id, new this.Group(this.lang.newGroup));

				// save
				save && this.saveData();

				return id;
			},

			// cleans up lines and labels data
			updateGroup: function () {
				let id = this.selected;

				// regular expressions
				// matches a line [[xxx, yyy], [xxx,yyy], ...]
				let regLine = /\[{1}(\[[0-9]{3}, *[0-9]{3}\], *)*(\[[0-9]{3}, *[0-9]{3} *\]{2})/g;
				// matches a label [xxx, yyy], "text"
				let regLabel = /\[[0-9]{3}, *[0-9]{3} *\],"[^,]*"/g;
				// matches "map" or "mini"
				let regType = /"map"|"mini"/g;
				// matches a color #000000 | #aaaaaa | #FFFFFF
				let regColor = /#([0-9]|[a-f]|[A-F]){6}/g;
				// matches the allowed line widths
				let regWidth = /(?<![0-9])(0.5|1|1.5|2|2.5|3|3.5|4|5|6|8|10){1}px/g;
				// matches the allowed text sizes
				let regSize = /(bold){0,1} +(?<![0-9])(10|12|16|20|24|32){1}px/g;
				// matches "left" or "center"
				let regRoot = /"left"|"root"/g;

				// compute lines data
				// get textbox data and split it into lines
				let lnLines = $(`#lines_${id}`).val().split("\n");
				// clear textbox
				$(`#lines_${id}`).val("");
				// return if no lines found
				if (!lnLines) {
					return;
				};

				// check for matches
				for (let i = 0; i < lnLines.length; i++) {
					let line = lnLines[i].match(regLine);
					let type = lnLines[i].match(regType);
					let color = lnLines[i].match(regColor);
					let width = lnLines[i].match(regWidth);

					// clean variables
					type = type ? type[0].replaceAll("\"", "") : type;
					color = color ? color[0] : color;
					width = width ? width[0].replace("px", "") : width;

					// push values to ui
					if (line) {
						$(`#lines_${id}`).val($(`#lines_${id}`).val() + JSON.stringify([JSON.parse(line)]) + "\n");
					};

					switch (type) {
						case "map":
							if (color) {
								$(`#map_color_chooser_${id}`).val(color);
							};
							if (width) {
								$(`#map_width_chooser_${id}`).val(width);
							};
							break;
						case "mini":
							$(`#draw_on_mini_${id}`).prop("checked", "checked");

							if (color) {
								$(`#mini_color_chooser_${id}`).val(color);
							};
							if (width) {
								$(`#mini_width_chooser_${id}`).val(width);
							};
							break;
						default:
							if (color) {
								$(`#map_color_chooser_${id}`).val(color);
								$(`#mini_color_chooser_${id}`).val(color);
							};
							if (width) {
								$(`#map_width_chooser_${id}`).val(width);
								$(`#mini_width_chooser_${id}`).val(width);
							};
					};
				};


				// compute labels data
				// get textbox data and split it into lines
				let lnLabels = $(`#labels_${id}`).val().split("\n");
				// clear textbox
				$(`#labels_${id}`).val("");
				// return if no labels found
				if (!lnLabels) {
					return;
				};

				// check for matches
				for (let i = 0; i < lnLabels.length; i++) {
					let label = lnLabels[i].match(regLabel);
					let color = lnLabels[i].match(regColor);
					let size = lnLabels[i].match(regSize);
					let root = lnLabels[i].match(regRoot);

					// clean variables
					label = label ? `[${label[0]}]` : label;
					color = color ? color[0] : color;
					size = size ? size[0] : size;
					root = root ? root[0] : root;

					// push values to ui
					if (label) {
						$(`#labels_${id}`).val($(`#labels_${id}`).val() + JSON.stringify(JSON.parse(label)) + "\n");
					};
					if (color) {
						$(`#label_color_chooser_${id}`).val(color);
					};
					if (size) {
						$(`#label_font_size_chooser_${id}`).val(size);
					};
					if (root) {
						$(`#label_root_chooser_${id}`).val(root);
					};
				};

				// get group data
				let group = this.groups.get(id);

				let name = $(`#tab_${id} > span.memo-tab-label > a`).text();
				let mapColor = $(`#map_color_chooser_${id}`).val();
				let mapWidth = $(`#map_width_chooser_${id}`).val() + "px";
				let drawOnMini = $(`#draw_on_mini_${id}`).prop("checked");
				let miniColor = $(`#mini_color_chooser_${id}`).val();
				let miniWidth = $(`#mini_width_chooser_${id}`).val() + "px";
				let lines = JSON.parse(`[${$(`#lines_${id}`).val().trim().replaceAll("\n", ",")}]`);
				let labelsColor = $(`#label_color_chooser_${id}`).val();
				let labelsFontSize = $(`#label_font_size_chooser_${id}`).val();
				let labelsRoot = $(`#label_root_chooser_${id}`).val();
				let labels = JSON.parse(`[${$(`#labels_${id}`).val().trim().replaceAll("\n", ",")}]`);
				let selected = group.selected;
				let show = group.show;

				// push data into groups map
				this.groups.set(id, new this.Group(name, mapColor, mapWidth, drawOnMini, miniColor, miniWidth,
					lines, labelsColor, labelsFontSize, labelsRoot, labels, selected, show));

				// set selected to false for all other groups
				if (!this.groups.size) return;
				for (let [key, value] of this.groups) {
					data.selected = false;
					key != id && this.groups.set(key, value);
				};

				// save
				this.saveData();

				// reload map
				this.parent.map.reload();
			},

			// renames group
			renameGroup: function (id) {
				// ask for new name
				let name = prompt(this.lang.enterNewGroupName)
				if (name.length > 2) {
					$(`#tab_${id} > span.memo-tab-label > a`).text(name);
				} else {
					UI.ErrorMessage(this.lang.nameTooShort);
					return;
				};

				// set new name
				let group = this.parent.groups.get(id);
				group.name = name;
				this.parent.groups.set(id, group);

				// save
				this.saveData();
			},

			// deletes a group from the UI
			deleteGroup: function (id) {
				// remove UI elements
				$(`#tab_${id}`).remove();
				$(`#group_${id}`).remove();

				// delete from groups map
				this.groups.delete(id);

				// delete from lastSelected
				let n = [];
				for (let i = 0; i < this.lastSelected.length; i++) {
					this.lastSelected[i] != id && n.push(this.lastSelected[i]);
				};

				this.lastSelected = n;

				// if selected group gets deleted, select last selected or another group if possible else remove selected
				if (this.selected == id) {
					if (this.lastSelected.length && this.groups.get(this.lastSelected[this.lastSelected.length - 1])) {
						this.selectGroup(this.lastSelected[this.lastSelected.length - 1]);
					} else if (this.groups.entries().next().value) {
						this.selectGroup(this.groups.entries().next().value[0]);
					} else {
						this.selected = undefined;
						this.parent.map.reload();
					};
				};

				// save
				this.saveData();
			},

			// selects a Group and shows its contents
			selectGroup: function (id) {
				// unselect all
				$(".memo-tab").each(function () {
					this.className = "memo-tab";
				});
				$(".memo_container").each(function () {
					this.style.display = "none";
				});

				// select id
				$(`#tab_${id}`).addClass("memo-tab-selected");
				$(`#group_${id}`).css("display", "block");
				this.selected = id;

				// add to lastSelected
				this.lastSelected.push(id);

				// set selected for all groups
				for (let [key, data] of this.groups) {
					if (key == id) {
						data.selected = true;
					} else {
						data.selected = false;
					};
					this.groups.set(key, data);
				};

				// save
				this.saveData();

				// reload map
				this.parent.map.reload();
			},

			// adds a line to the currently selected group
			addLineToGroup: function (line) {
				let linesElem = $(`#lines_${this.selected}`);
				$(linesElem).val($(linesElem).val() + JSON.stringify(line) + "\n");
				this.updateGroup();
			},

			// adds a label to the currently selected group
			addLabelToGroup: function (label) {
				let labelsElem = $(`#labels_${this.selected}`);
				$(labelsElem).val($(labelsElem).val() + JSON.stringify(label) + "\n");
				this.updateGroup();
			},

			// removes all lines / labels at coordinates
			removeAtCoords: function ([x, y]) {
				if (!this.selected) return;
				let id = this.selected;
				// clear lines and labels
				$(`#lines_${id}`).val("");
				$(`#labels_${id}`).val("");
				let group = this.groups.get(this.selected);
				let lines = group.lines;
				let labels = group.labels;
				let linesN = [];
				let labelsN = [];

				// check for coords
				for (let i = 0; i < lines.length; i++) {
					let found = false;
					for (let j = 0; j < lines[i][0].length; j++) {
						if (lines[i][0][j][0] == x, lines[i][0][j][1] == y) {
							found = true;
						};
					};
					if (!found) {
						$(`#lines_${id}`).val($(`#lines_${id}`).val() + JSON.stringify(lines[i]) + "\n");
						linesN.push(lines[i]);
					};
				};

				for (let i = 0; i < labels.length; i++) {
					if (!(labels[i][0][0] == x && labels[i][0][1] == y)) {
						$(`#labels_${id}`).val($(`#labels_${id}`).val() + JSON.stringify(labels[i]) + "\n");
						labelsN.push(labels[i]);
					};
				};

				// update group
				group.lines = linesN;
				group.labels = labelsN;

				// save
				this.saveData()

				// reload
				this.parent.map.reload();
			},

			// shows the UI
			enableScript: function (parent) {
				// set parent
				this.parent = parent;

				// set enabled = true
				this.enabled = true;

				// load groups data
				this.groups = this.parent.groups;

				// get village data from server
				this.getVillages();

				// create the UI element
				this.createUiElement();

				// load css
				if (!$("link[href*='memo']")[0]) {
					$("head").append($(document.createElement("link")).load("/game.php?screen=memo link[href*='memo']"));
				};

				// load groups data into UI
				this.loadGroupsMapIntoUi();
			},

			// todo
			disableScript: function () {
				// save all lines and labels
				this.saveData();
				this.selected = undefined;
				this.parent.groups = this.groups;
				this.parent.disableScript();
				this.enabled = false;
			},

			// updates the UI name (show mode and zoom)
			updateUiName: function () {
				let elem = $("#line_drawer");
				if (elem.length) {
					let title = "Line Drawer";
					let mode = this.parent.mode;
					let scale = this.parent.scale;
					title += mode ? " > " + mode + " mode" : "";
					title += scale != 1 ? " > " + Math.round(scale * 100) + "%" : "";
					$("#line_drawer > div.popup_menu.ui-draggable-handle > p").text(title);
				};
			},

			// gets village data from server
			getVillages: function (poly) {
				let currentTime = Date.parse(new Date());
				let villageData;
				let villagesString = `TWLD_Villages_${this.parent.world}`;
				let lastGetString = `TWLD_LastGet_${this.parent.world}`;
				// check if item exists
				if (localStorage.getItem(villagesString)) {
					let lastGet = localStorage.getItem(lastGetString);
					// check if 1 hour has passed since last request
					if (currentTime > parseInt(lastGet) + 60 * 60 * 24 * 1000) {
						$.get("map/village.txt", (data) => {
							villageData = data;
							localStorage.setItem(lastGetString, Date.parse(new Date()));
							localStorage.setItem(villagesString, data);
						})
							.done(() => {
								this.getVillagesFromVillageData(villageData);
							});
					}
					else {
						let villageData = localStorage.getItem(villagesString);
						this.getVillagesFromVillageData(villageData);
					};
				} else {
					$.get("map/village.txt", (data) => {
						villageData = data;
						localStorage.setItem(lastGetString, Date.parse(new Date()));
						localStorage.setItem(villagesString, data);

					})
						.done(() => {
							this.getVillagesFromVillageData(villageData);
						});
				};
			},

			// extracts villages from village data
			getVillagesFromVillageData: function (villageData) {
				let villages = villageData.split("\n");
				// clean villages
				this.villages = [];
				// fill villages
				for (let village of villages) {
					this.villages.push(village.split(",").slice(2, 4).map(Number));
				};
			},

			// object that handels calculations
			Math: {
				getVillagesInCorridor: function (poly, villages) {
					let villagesFound = [];
					for (let village of villages) {
						if (this.checkInside(poly, poly.length, village)) {
							villagesFound.push(village);
						};
					};
					return villagesFound;
				},

				getCorridorPoly: function (coord, lines) {
					let first = [1000000, []];
					let second = [1000000, []];
					for (let line of lines) {
						if (!line.length) return;
						line = line[0];
						let distance = 1000000;
						for (let i = 0; i < line.length - 1; i++) {
							let distanceSeg = this.getDistanceToLine(coord, [line[i], line[i + 1]]);
							if (distanceSeg < distance) distance = distanceSeg;
						};
						if (distance < first[0]) {
							second[0] = first[0];
							second[1] = first[1];
							first[0] = distance;
							first[1] = line;
						} else if (distance < second[0]) {
							second[0] = distance;
							second[1] = line;
						};
					};
					// check if nearest line is poly
					if (this.isPoly([...first[1]])) {
						return [...first[1]];
					} else if (lines.length < 2) {
						return;
					}
					let dis1 = this.getDistanceBetweenCoords(first[1][first[1].length - 1], second[1][0]);
					let dis2 = this.getDistanceBetweenCoords(first[1][first[1].length - 1], second[1][second[1].length - 1]);
					if (dis1 < dis2) {
						return [...first[1], ...second[1]];
					} else if (dis2 < dis1) {
						return [...first[1], ...second[1].reverse()];
					};
					return;
				},

				isPoly: function (line) {
					let counter = 0;
					let hash = {};

					line.forEach((el) => (hash.hasOwnProperty(el) && counter++) || (hash[(el)] = undefined));

					return counter == 1;
				},

				getDistanceToLine: function (coord, line) {
					let a = coord[0] - line[0][0];
					let b = coord[1] - line[0][1];
					let c = line[1][0] - line[0][0];
					let d = line[1][1] - line[0][1];

					let dot = a * c + b * d;
					let segmentLengthSquared = c * c + d * d;
					let param = (segmentLengthSquared === 0 ? -1 : dot / segmentLengthSquared);

					let closestSegmentPointX;
					let closestSegmentPointY;

					// the closest point is the end node at x1, y1
					if (param < 0) {
						closestSegmentPointX = line[0][0];
						closestSegmentPointY = line[0][1];
					}
					// the closest point is the end node at x2, y2
					else if (param > 1) {
						closestSegmentPointX = line[1][0];
						closestSegmentPointY = line[1][1];
					}
					// the closest point is located inside the segment
					else {
						closestSegmentPointX = line[0][0] + param * c;
						closestSegmentPointY = line[0][1] + param * d;
					}

					return (this.getDistanceBetweenCoords([closestSegmentPointX, closestSegmentPointY], coord))
				},

				getDistanceBetweenCoords: function (coord1, coord2) {
					return Math.sqrt(Math.pow(coord2[0] - coord1[0], 2) + Math.pow(coord2[1] - coord1[1], 2));
				},

				onLine: function (l1, p) {
					// Check whether p is on the line or not
					if (p[0] <= Math.max(l1[0][0], l1[1][0])
						&& p[0] >= Math.min(l1[0][0], l1[1][0])
						&& (p[1] <= Math.max(l1[0][1], l1[1][1])
							&& p[1] >= Math.min(l1[0][1], l1[1][1])))
						return true;

					return false;
				},

				direction: function (a, b, c) {
					let val = (b[1] - a[1]) * (c[0] - b[0])
						- (b[0] - a[0]) * (c[1] - b[1]);

					if (val == 0)

						// Collinear
						return 0;

					else if (val < 0)

						// Anti-clockwise direction
						return 2;

					// Clockwise direction
					return 1;
				},

				isIntersect: function (l1, l2) {
					// Four direction for two lines and points of other line
					let dir1 = this.direction(l1[0], l1[1], l2[0]);
					let dir2 = this.direction(l1[0], l1[1], l2[1]);
					let dir3 = this.direction(l2[0], l2[1], l1[0]);
					let dir4 = this.direction(l2[0], l2[1], l1[1]);

					// When intersecting
					if (dir1 != dir2 && dir3 != dir4)
						return true;

					// When p2 of line2 are on the line1
					if (dir1 == 0 && this.onLine(l1, l2[0]))
						return true;

					// When p1 of line2 are on the line1
					if (dir2 == 0 && this.onLine(l1, l2[1]))
						return true;

					// When p2 of line1 are on the line2
					if (dir3 == 0 && this.onLine(l2, l1[0]))
						return true;

					// When p1 of line1 are on the line2
					if (dir4 == 0 && this.onLine(l2, l1[1]))
						return true;

					return false;
				},

				checkInside: function (poly, n, p) {

					// When polygon has less than 3 edge, it is not polygon
					if (n < 3)
						return false;

					// Create a point at infinity, y is same as point p
					let tmp = [999999, p[1]];
					let exline = [p, tmp];
					let count = 0;
					let i = 0;
					do {

						// Forming a line from two consecutive points of
						// poly
						let side = [poly[i], poly[(i + 1) % n]];
						if (this.isIntersect(side, exline)) {

							// If side is intersects exline
							if (this.direction(side[0], p, side[1]) == 0)
								return this.onLine(side, p);
							count++;
						}
						i = (i + 1) % n;
					} while (i != 0);

					// When count is odd
					return count & 1;
				},
			},

			// select villages handler
			selectVillages: function (coord) {
				// if element with id "TWLD_Select" exists and has attribute "style" with value "display: block;"
				if ($("#TWLD_Select").length && $("#TWLD_Select").attr("style").includes("display: block;")) {
					this.updateSelectedVillages(coord, true);
				} else {
					UI.ErrorMessage(this.lang.selectCorridorFirst);
				};
			},

			// update selected villages
			updateSelectedVillages: function (coord, updateText = false) {
				// get village at coord
				let xy = `${coord[0]}${coord[1]}`;
				let village = this.parent.map.villages[xy];
				if (!village) return;
				// update village border
				this.updateVillageBorder(village.id);
				// if updateText is true update selected villages text
				if (updateText) {
					this.updateSelectedVillagesText(coord);
				};
			},

			// updates selected villages text
			updateSelectedVillagesText: function (coord) {
				let villagesText = $("#TWLD_Select_content > tr > td > textarea").val();
				// make a list of all villages using the format "x|y" with regex
				let reg = /[0-9]{3}\|[0-9]{3}/g;
				let villages = villagesText.match(reg);
				// check if village with coords "coord" is already in the list. remove it if it is else add it
				let xy = `${coord[0]}|${coord[1]}`;
				let index = villages.indexOf(xy);
				if (index > -1) {
					villages.splice(index, 1);
				} else {
					villages.push(xy);
				};
				// create list of villages with a counter
				let villagesString = "";
				let counter = 1;
				for (let village of villages) {
					villagesString += `${counter}. ${village}\n`
					if (counter > 0 && counter % 5 == 0) villagesString += "\n";
					counter++;
				};
				// update textarea
				$("#TWLD_Select_content > tr > td > textarea").val(villagesString);
			},

			// updates village border
			updateVillageBorder: function (village) {
				let villageElem = $(`#map_village_${village}`);
				if (villageElem.length) {
					villageElem.css("box-sizing", "border-box");
					// if border color is not red set it to 3px (times map scale) solid red and set z-index to 3 else remove border and set z-index to 2
					if (villageElem.css("border-color") != "rgb(255, 0, 0)") {
						villageElem.css("z-index", "3");
						villageElem.css("border", `${3 * this.parent.map.scale}px solid red`);
					} else {
						// remove village from selected
						villageElem.css("z-index", "2");
						villageElem.css("border", "");
					};
				};
			},

			// get villages in corridor
			selectVillagesInCorridorOfCoord: function (coord) {
				// reload map
				this.parent.map.map.reload();
				//
				let lines = (this.groups.get(this.selected)).lines;
				let xSc = this.parent.map.map.scale[0];
				let ySc = this.parent.map.map.scale[1];
				let coordPix = [coord[0] * xSc, coord[1] * ySc];
				let linesPix = [];
				for (let i = 0; i < lines.length; i++) {
					let line = [];
					for (let j = 0; j < lines[i][0].length; j++) {
						let lineSegment = [Math.round(lines[i][0][j][0] * xSc - 0.5 * xSc), Math.round(lines[i][0][j][1] * ySc - 0.5 * ySc)];
						line.push(lineSegment);
					};
					linesPix.push([line]);
				};
				let villagesPix = [];
				for (let i = 0; i < this.villages.length; i++) {
					if (!this.villages[i][0]) break;
					villagesPix.push([this.villages[i][0] * xSc, this.villages[i][1] * ySc]);
				};
				let poly = this.Math.getCorridorPoly(coordPix, linesPix);
				if (!poly) return;
				/* debug
				let debugPoly = "[[";
				for (let i = 0; i < poly.length; i++) {
					debugPoly += `[${Math.round(poly[i][0] / xSc)},${Math.round(poly[i][1] / ySc)}],`;
				};
				debugPoly = debugPoly.slice(0, -1);
				debugPoly += "]]";
				console.log(debugPoly);
				*/
				let villagesFound = this.Math.getVillagesInCorridor(poly, villagesPix);
				let villagesText = "";
				let counter = 1;
				for (let village of villagesFound) {
					let x = Math.round(village[0] / xSc);
					let y = Math.round(village[1] / ySc);
					villagesText += `${counter}. ${x}|${y}\n`
					if (counter > 0 && counter % 5 == 0) villagesText += "\n";
					counter++;
					this.updateSelectedVillages([x, y]);
				};

				// create UI element
				let elem = `
					<tr class="edit_row">
						<td colspan="2">
							<textarea placeholder="${this.lang.villages}" cols="15" rows="20" style="text-align: center"></textarea>
						</td>
					</tr>
				`;
				UI.AjaxPopup(null, "TWLD_Select", elem, "Select", null, { dataType: "prerendered" }, "min-content", "auto", "auto");
				$("#TWLD_Select_content > tr > td > textarea").val(villagesText);
				$("#TWLD_Select_content > tr > td > textarea").attr("readonly", true);
				navigator.clipboard.writeText(villagesText).then(() => {
					UI.SuccessMessage(this.lang.copied);
				});
				// close button listener
				$("#closelink_TWLD_Select").on("click", () => {
					this.parent.map.reload();
				});
			},
		},
	};

	// hotkeys
	(function () {
		$(document).on("keypress", function (e) {
			switch (String.fromCharCode(e.which)) {
				case addLineHotkey:
					if (!TWLineDrawer.enabled) return;
					TWLineDrawer.addLine();
					UI.InfoMessage("add line");
					break;
				case undoCoordsHotkey:
					if (!TWLineDrawer.enabled) return;
					TWLineDrawer.undoCoords();
					UI.InfoMessage("undo");
					break;
				case enableLineModeHotkey:
					if (!TWLineDrawer.enabled) return;
					TWLineDrawer.setMode("line");
					UI.InfoMessage("line mode");
					break;
				case enableLabelModeHotkey:
					if (!TWLineDrawer.enabled) return;
					TWLineDrawer.setMode("label");
					UI.InfoMessage("label mode");
					break;
				case enableDeleteModeHotkey:
					if (!TWLineDrawer.enabled) return;
					TWLineDrawer.setMode("delete");
					UI.InfoMessage("delete mode");
					break;
				case enableSelectCorridorModeHotkey:
					if (!TWLineDrawer.enabled) return;
					TWLineDrawer.setMode("select corridor");
					UI.InfoMessage("select corridor mode");
					break;
				case enableEditSelectModeHotkey:
					if (!TWLineDrawer.enabled) return;
					TWLineDrawer.setMode("edit select");
					UI.InfoMessage("edit select mode");
					break;
				case enableScriptHotkey:
					TWLineDrawer.enableScript();
			};
		});
	})();

	TWLineDrawer.init();
})();