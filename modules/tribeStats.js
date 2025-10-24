
(function () {
  'use strict';


    /*if (window.location.href.indexOf('screen=ally&mode=members') < 0) {
        //relocate
        window.location.assign(game_data.link_base_pure + "ally&mode=members");
    }*/
    // Sophie "Shinko to Kuma"
    var tribeTable = '';
    var rowStart = 1;
    var columnStart = 6;
    var columnName = 0;
    var rows;
    var BBTable = "";
    var csvTable = "";
    var statsEnabled = {};
    
    let width=$("#contentContainer")[0].clientWidth;


    if (localStorage.getItem("tribeStatsEnabled") == null) {
        console.log("No settings stored, creating")
        statsEnabled = {
            "ODA": true,
            "ODD": true,
            "ODS": true,
            "Loot": true,
            "Gathering": true,
            "Combined": true,
            "ODATotal": true,
            "ODDTotal": true,
            "ODSTotal": true
        };
        localStorage.setItem("tribeStatsEnabled", JSON.stringify(statsEnabled));
    }
    else {
        console.log("Getting settings");
        statsEnabled = JSON.parse(localStorage.getItem("tribeStatsEnabled"));
    }






    var langShinko;
    switch (game_data.locale) {
        case "pt_BR":
            langShinko = {
                "ODA": "ODA",
                "ODD": "ODD",
                "ODS": "ODS",
                "Loot": "Saqueado",
                "Gathered": "Coletado",
                "Combined": "Combinado",
                "ODATotal": "ODA TOTAL",
                "ODDTotal": "ODD TOTAL",
                "ODSTotal": "ODS TOTAL"
            }
            break;
        case "es_ES":
            langShinko = {
                "ODA": "ODA",
                "ODD": "ODD",
                "ODS": "ODS",
                "Loot": "Saqueado",
                "Gathered": "Recolectado",
                "Combined": "Combinado",
                "ODATotal": "ODA TOTAL",
                "ODDTotal": "ODD TOTAL",
                "ODSTotal": "ODS TOTAL"
            }
            break;
        case "de_DE":
            langShinko = {
                "ODA": "BGA",
                "ODD": "BGV",
                "ODS": "BGU",
                "Loot": "GeplÃ¼ndert",
                "Gathered": "Gesammelt",
                "Combined": "Insgesamt ",
                "ODATotal": "ODA TOTAL",
                "ODDTotal": "ODD TOTAL",
                "ODSTotal": "ODS TOTAL"
            }
            break;
        default:
            langShinko = {
                "ODA": "ODA",
                "ODD": "ODD",
                "ODS": "ODS",
                "Loot": "Loot",
                "Gathered": "Gathered",
                "Combined": "Combined",
                "ODATotal": "ODA TOTAL",
                "ODDTotal": "ODD TOTAL",
                "ODSTotal": "ODS TOTAL"
            }
    }

    if (window.location.href.indexOf('screen=ally&mode=members') > -1) {
        //members own tribe
        tribeTable = "#content_value table.vis";
        rowStart = 3;
        columnStart = 6;
        columnName = 0;
        rows = $($("table .vis")[2]).find('tr');
    }
    if (window.location.href.indexOf('&screen=info_ally') > -1) {
        //any tribe
        tribeTable = ".vis:eq(" + (2 + $(".bbcodetable").length) + ")";
        rowStart = 1;
        columnStart = 4;
        columnName = 0;
        rows = $($("table .vis")[1]).find('tr');
    }
    if ((window.location.href.indexOf('screen=ranking&mode=player') > -1 || window.location.href.indexOf('screen=ranking&mode=con_player') > -1) || (window.location.href.indexOf('screen=ranking') > -1 && window.location.href.indexOf('&mode') == -1)) {
        //any player
        tribeTable = ".vis:eq(2)";
        rowStart = 1;
        columnStart = 5;
        columnName = 1;
        rows = $($("table .vis")[1]).find('tr');
    }


    $.getAll = function (
        urls, // array of URLs
        onLoad, // called when any URL is loaded, params (index, data)
        onDone, // called when all URLs successfully loaded, no params
        onError // called when a URL load fails or if onLoad throws an exception, params (error)
    ) {
        var numDone = 0;
        var lastRequestTime = 0;
        var minWaitTime = 200; // ms between requests
        loadNext();
        function loadNext() {
            if (numDone == urls.length) {
                onDone();
                return;
            }

            let now = Date.now();
            let timeElapsed = now - lastRequestTime;
            if (timeElapsed < minWaitTime) {
                let timeRemaining = minWaitTime - timeElapsed;
                setTimeout(loadNext, timeRemaining);
                return;
            }
            console.log('Getting ', urls[numDone]);
            $("#progress").css("width", `${(numDone + 1) / urls.length * 100}%`);
            $("#count").text(`${(numDone + 1)} / ${urls.length}`);
            $("#count2").text(`${(numDone + 1)} / ${urls.length}`);            lastRequestTime = now;
            $.get(urls[numDone])
                .done((data) => {
                    try {
                        onLoad(numDone, data);
                        ++numDone;
                        loadNext();
                    } catch (e) {
                        onError(e);
                    }
                })
                .fail((xhr) => {
                    onError(xhr);
                })
        }
    };
    var names = [];
    var html = "<div style='width:500px'>";
    if (typeof customNames == 'undefined') {
        for (var i = 1; i < rows.length; i++) {
            names.push($(rows[i]).find('a')[0].innerText.trim().split(' ').join('+'));
        }
    }
    else {
        html += `<table class="vis" id="tableMembers" border="1" style="width: 100%"><tr><th>Player Name</th></tr>`;
        tribeTable = "#tableMembers";
        rowStart = 1;
        columnStart = 1;
        columnName = 0;
        rows = 4;
        for (var i = 0; i < customNames.length; i++) {
            html += `<tr><td id="${customNames[i]}" style="width:50px;padding: 5px;">${customNames[i]}</td></tr>`
            customNames[i] = customNames[i].trim().split(' ').join('+');
        }
        html += `</table></div>`
        names = customNames;
        //$("#contentContainer").eq(0).prepend(html);
    }

    function getData() {

  console.log("collecting data");
  $("#getData").prop('disabled', true);

  // save checkboxes...
  for (var i = 0; i < Object.keys(statsEnabled).length; i++) {
    statsEnabled[Object.keys(statsEnabled)[i]] = $(`:checkbox#${Object.keys(statsEnabled)[i]}`).is(":checked");
  }
  localStorage.setItem("tribeStatsEnabled", JSON.stringify(statsEnabled));

  // ✅ declare everything you use
  let linksODS = [];
  let linksODD = [];
  let linksODA = [];
  let linksODSTotal = [];
  let linksODDTotal = [];
  let linksODATotal = [];
  let linksLoot = [];
  let linksGathering = [];

  let ODSperPlayer = [];
  let ODDperPlayer = [];
  let ODAperPlayer = [];
  let ODSTotalperPlayer = [];
  let ODDTotalperPlayer = [];
  let ODATotalperPlayer = [];
  let lootperPlayer = [];
  let gatheredperPlayer = [];

  let temp, x;
  let titleCount = 0;


        console.log("collecting data")
        $("#getData").prop('disabled', true);
        //save checkboxes to localstorage
        for (var i = 0; i < Object.keys(statsEnabled).length; i++) {
            console.log("Current stat:" + Object.keys(statsEnabled)[i]);
            console.log("Set to: " + $(`:checkbox#${Object.keys(statsEnabled)[i]}`).is(":checked"))
            statsEnabled[Object.keys(statsEnabled)[i]] = $(`:checkbox#${Object.keys(statsEnabled)[i]}`).is(":checked");
        }
        localStorage.setItem("tribeStatsEnabled", JSON.stringify(statsEnabled));

        linksODS = [];
        linksODD = [];
        linksODA = [];
        linksODSTotal = [];
        linksODDTotal = [];
        linksODATotal = [];
        linksLoot = [];
        linksGathering = [];
        ODSperPlayer = [];
        ODDperPlayer = [];
        ODAperPlayer = [];
        ODSTotalperPlayer = [];
        ODDTotalperPlayer = [];
        ODATotalperPlayer = [];
        lootperPlayer = [];
        gatheredperPlayer = [];
        for (var i = 0; i < names.length; i++) {
            if (statsEnabled.ODA) linksODA.push("/game.php?screen=ranking&mode=in_a_day&type=kill_att&name=" + names[i]);
            if (statsEnabled.ODD) linksODD.push("/game.php?screen=ranking&mode=in_a_day&type=kill_def&name=" + names[i]);
            if (statsEnabled.ODS) linksODS.push("/game.php?screen=ranking&mode=in_a_day&type=kill_sup&name=" + names[i]);
            if (statsEnabled.Loot) linksLoot.push("/game.php?screen=ranking&mode=in_a_day&type=loot_res&name=" + names[i]);
            if (statsEnabled.Gathering) linksGathering.push("/game.php?screen=ranking&mode=in_a_day&type=scavenge&name=" + names[i]);
            if (statsEnabled.ODATotal) linksODATotal.push("/game.php?screen=ranking&mode=kill_player&type=att&name=" + names[i]);
            if (statsEnabled.ODDTotal) linksODDTotal.push("/game.php?screen=ranking&mode=kill_player&type=def&name=" + names[i]);
            if (statsEnabled.ODSTotal) linksODSTotal.push("/game.php?screen=ranking&mode=kill_player&type=support&name=" + names[i]);
        }
        titleCount = 0;
        for (var i = 0; i < Object.keys(statsEnabled).length; i++) {
            if (statsEnabled[Object.keys(statsEnabled)[i]]) {
                $(tribeTable + " tr").eq(rowStart - 1).append("<th onclick='sortTableTest(" + (columnStart + titleCount) + ")'>" + langShinko[Object.keys(langShinko)[i]] + "</th>");
                titleCount++;
            }
        }
        $(tribeTable).eq(rowStart - 1).attr('id', 'tableMembers');
        $("#contentContainer").eq(0).prepend(`
        <div id="progressbar" class="progress-bar progress-bar-alive">
        <span id="count" class="label">0/${names.length}</span>
        <div id="progress"><span id="count2" class="label" style="width: ${width}px;">0/${names.length}</span></div>
        </div>`);
        $("#mobileHeader").eq(0).prepend(`
        <div id="progressbar" class="progress-bar progress-bar-alive">
        <span id="count" class="label">0/${names.length}</span>
        <div id="progress"><span id="count2" class="label" style="width: ${width}px;">0/${names.length}</span></div>
        </div>`);
        //ODA
        $.getAll(linksODA, (i, data) => {
            if ($(data).find(".lit-item")[3] != undefined) {
                temp = $(data).find(".lit-item")
                ODAperPlayer.push([temp[3].innerText.replace(/\./g, ','), temp[4].innerText]);
            }
            else {
                ODAperPlayer.push(["0", "Never"]);
            }

        },
            () => {
                $("#progress").css("width", `${(linksODA.length) / linksODA.length * 100}%`);
                for (var o = rowStart; o < ODAperPlayer.length + rowStart; o++) {
                    $(tribeTable + " tr").eq(o).append("<td title=" + ODAperPlayer[o - rowStart][1] + ">" + ODAperPlayer[o - rowStart][0] + "</td>")
                }
                //ODD
                $.getAll(linksODD, (i, data) => {
                    if ($(data).find(".lit-item")[3] != undefined) {
                        temp = $(data).find(".lit-item")
                        ODDperPlayer.push([temp[3].innerText.replace(/\./g, ','), temp[4].innerText]);
                    }
                    else {
                        ODDperPlayer.push(["0", "Never"]);
                    }

                },
                    () => {
                        for (var o = rowStart; o < ODDperPlayer.length + rowStart; o++) {
                            $(tribeTable + " tr").eq(o).append("<td title=" + ODDperPlayer[o - rowStart][1] + ">" + ODDperPlayer[o - rowStart][0] + "</td>")
                        }
                        //ODS
                        $.getAll(linksODS, (i, data) => {
                            if ($(data).find(".lit-item")[3] != undefined) {
                                temp = $(data).find(".lit-item")
                                ODSperPlayer.push([temp[3].innerText.replace(/\./g, ','), temp[4].innerText]);
                            }
                            else {
                                ODSperPlayer.push(["0", "Never"]);
                            }

                        },
                            () => {
                                for (var o = rowStart; o < ODSperPlayer.length + rowStart; o++) {
                                    $(tribeTable + " tr").eq(o).append("<td title=" + ODSperPlayer[o - rowStart][1] + ">" + ODSperPlayer[o - rowStart][0] + "</td>")
                                }

                                //loot
                                $.getAll(linksLoot, (i, data) => {
                                    if ($(data).find(".lit-item")[3] != undefined) {
                                        temp = $(data).find(".lit-item")
                                        lootperPlayer.push([temp[3].innerText.replace(/\./g, ','), temp[4].innerText]);
                                    }
                                    else {
                                        lootperPlayer.push(["0", "Never"]);
                                    }

                                },
                                    () => {
                                        for (var o = rowStart; o < lootperPlayer.length + rowStart; o++) {
                                            $(tribeTable + " tr").eq(o).append("<td title=" + lootperPlayer[o - rowStart][1] + ">" + lootperPlayer[o - rowStart][0] + "</td>")
                                        }
                                        //gathering
                                        $.getAll(linksGathering, (i, data) => {
                                            if ($(data).find(".lit-item")[3] != undefined) {
                                                temp = $(data).find(".lit-item")
                                                gatheredperPlayer.push([temp[3].innerText.replace(/\./g, ','), temp[4].innerText]);
                                            }
                                            else {
                                                gatheredperPlayer.push(["0", "Never"]);
                                            }

                                        },
                                            () => {
                                                for (var o = rowStart; o < gatheredperPlayer.length + rowStart; o++) {
                                                    $(tribeTable + " tr").eq(o).append("<td title=" + gatheredperPlayer[o - rowStart][1] + ">" + gatheredperPlayer[o - rowStart][0] + "</td>")
                                                    //only show combined if loot and gathering are collected
                                                    if (statsEnabled["Loot"] == true && statsEnabled["Gathering"] == true) {
                                                        $(tribeTable + " tr").eq(o).append("<td>" + numberWithCommas(parseInt(gatheredperPlayer[o - rowStart][0].split(",").join("")) + parseInt(lootperPlayer[o - rowStart][0].split(",").join(""))) + "</td>")
                                                    }
                                                    else {
                                                        if (statsEnabled["Combined"] == true)
                                                            $(tribeTable + " tr").eq(o).append("<td>Need both Loot and Gathering enabled to see this column</td>")
                                                    }
                                                }
                                                // ODA total
                                                $.getAll(linksODATotal, (i, data) => {
                                                    if ($(data).find(".lit-item")[3] != undefined) {
                                                        temp = $(data).find(".lit-item")
                                                        x = temp[3].innerText;
                                                        console.log(x);
                                                        if (x.indexOf(" Mil.") > -1) {
                                                            x = x.replace(" Mil.", "");
                                                            x = x.replace(",", "");
                                                            x = parseInt(x) * 10000;
                                                            x=x.toString();
                                                        }
                                                        ODATotalperPlayer.push(x.replace(/\./g, ','));
                                                    }
                                                    else {
                                                        ODATotalperPlayer.push("0");
                                                    }

                                                },
                                                    () => {
                                                        for (var o = rowStart; o < ODATotalperPlayer.length + rowStart; o++) {
                                                            $(tribeTable + " tr").eq(o).append("<td>" + numberWithCommas(ODATotalperPlayer[o - rowStart]) + "</td>")
                                                        }

                                                        // ODD total
                                                        $.getAll(linksODDTotal, (i, data) => {
                                                            if ($(data).find(".lit-item")[3] != undefined) {
                                                                temp = $(data).find(".lit-item")
                                                                x = temp[3].innerText;
                                                                console.log(x);
                                                                if (x.indexOf(" Mil.") > -1) {
                                                                    x = x.replace(" Mil.", "");
                                                                    x = x.replace(",", "");
                                                                    x = parseInt(x) * 10000;
                                                                    x=x.toString();
                                                                }
                                                                ODDTotalperPlayer.push(x.replace(/\./g, ','));
                                                            }
                                                            else {
                                                                ODDTotalperPlayer.push("0");
                                                            }

                                                        },
                                                            () => {
                                                                for (var o = rowStart; o < ODDTotalperPlayer.length + rowStart; o++) {
                                                                    $(tribeTable + " tr").eq(o).append("<td>" + numberWithCommas(ODDTotalperPlayer[o - rowStart]) + "</td>")
                                                                }

                                                                // ODS total
                                                                $.getAll(linksODSTotal, (i, data) => {
                                                                    if ($(data).find(".lit-item")[3] != undefined) {
                                                                        temp = $(data).find(".lit-item")
                                                                        x = temp[3].innerText;
                                                                        console.log(x);
                                                                        if (x.indexOf(" Mil.") > -1) {
                                                                            x = x.replace(" Mil.", "");
                                                                            x = x.replace(",", "");
                                                                            x = parseInt(x) * 10000;
                                                                            x=x.toString();
                                                                        }
                                                                        ODSTotalperPlayer.push(x.replace(/\./g, ','));
                                                                    }
                                                                    else {
                                                                        ODSTotalperPlayer.push("0");
                                                                    }

                                                                },
                                                                    () => {
                                                                        for (var o = rowStart; o < ODSTotalperPlayer.length + rowStart; o++) {
                                                                            $(tribeTable + " tr").eq(o).append("<td>" + numberWithCommas(ODSTotalperPlayer[o - rowStart]) + "</td>")
                                                                        }

                                                                        $("#progressbar").remove();
                                                                        
                                                                        sortTableTest(columnStart);
                                                                    },
                                                                    (error) => {
                                                                        console.error(error);
                                                                    });



                                                            },
                                                            (error) => {
                                                                console.error(error);
                                                            });


                                                    },
                                                    (error) => {
                                                        console.error(error);
                                                    });

                                            },
                                            (error) => {
                                                console.error(error);
                                            });
                                    },
                                    (error) => {
                                        console.error(error);
                                    });
                            },
                            (error) => {
                                console.error(error);
                            });

                    },
                    (error) => {
                        console.error(error);
                    });



            },
            (error) => {
                console.error(error);
            });
    }

    function sortTableTest(n) {
        var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
        table = document.getElementById("tableMembers");
        switching = true;
        // Set the sorting direction to ascending:
        dir = "desc";
        /* Make a loop that will continue until
        no switching has been done: */
        while (switching) {
            // Start by saying: no switching is done:
            switching = false;
            rows = table.rows;
            /* Loop through all table rows (except the
            first, which contains table headers): */
            for (i = 1; i < (rows.length - 1); i++) {
                // Start by saying there should be no switching:
                shouldSwitch = false;
                /* Get the two elements you want to compare,
                one from current row and one from the next: */
                x = rows[i].getElementsByTagName("td")[n];
                y = rows[i + 1].getElementsByTagName("td")[n];
                /* Check if the two rows should switch place,
                based on the direction, asc or desc: */
                if (dir == "asc") {
                    if (Number(x.innerHTML.replace(/\,/g, '')) > Number(y.innerHTML.replace(/\,/g, ''))) {
                        // If so, mark as a switch and break the loop:
                        shouldSwitch = true;
                        break;
                    }
                } else if (dir == "desc") {
                    if (Number(x.innerHTML.replace(/\,/g, '')) < Number(y.innerHTML.replace(/\,/g, ''))) {
                        // If so, mark as a switch and break the loop:
                        shouldSwitch = true;
                        break;
                    }
                }
            }
            if (shouldSwitch) {
                /* If a switch has been marked, make the switch
                and mark that a switch has been done: */
                rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                switching = true;
                // Each time a switch is done, increase this count by 1:
                switchcount++;
            } else {
                /* If no switching has been done AND the direction is "asc",
                set the direction to "desc" and run the while loop again. */
                if (switchcount == 0 && dir == "desc") {
                    dir = "asc";
                    switching = true;
                }
            }
        }
        createBB(tribeTable, rowStart);
        $("#BBCODE")[0].value = BBTable;
        $("#CSVCODE")[0].value = csvTable;
    }

    function createBB(tableID, rowStart) {
        BBTable = "[table]\n";
        csvTable = "";

        //grab rows
        for (var i = rowStart - 1; i < $(tableID + " tr").length; i++) {
            //grab cells
            if (i == rowStart - 1) {
                BBTable += "[**]";
            }
            else {
                BBTable += "[*]";
            }
            for (var j = 0; j < $(tableID + " tr")[i].children.length; j++) {
                //add text to code
                if (i == rowStart - 1) {
                    //header row
                    BBTable += $(tableID + " tr")[i].children[j].innerText;
                    csvTable += $(tableID + " tr")[i].children[j].innerText;
                    if (j != $(tableID + " tr")[i].children.length - 1) {
                        BBTable += "[||]";
                        csvTable += ";"
                    }
                }
                else {
                    //regular row
                    BBTable += $(tableID + " tr")[i].children[j].innerText;
                    csvTable += $(tableID + " tr")[i].children[j].innerText;
                    if (j != $(tableID + " tr")[i].children.length - 1) {
                        BBTable += "[|]";
                        csvTable += ";"
                    }
                }

            }
            if (i == rowStart - 1) {
                BBTable += "[/**]\n";
                csvTable += "\n";
            }
            else {
                BBTable += "\n";
                csvTable += "\n";
            }
        }
        BBTable += "[/table]"
    }

    function numberWithCommas(x) {
        // add . to make numbers more readable
        x = x.toString();
        var pattern = /(-?\d+)(\d{3})/;
        while (pattern.test(x))
            x = x.replace(pattern, "$1,$2");
        return x;
    }

    // make functions reachable from inline handlers
const _g = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
_g.getData = getData;
_g.sortTableTest = sortTableTest;

  // Build the stats UI only when requested
  function buildStatsUIOnce() {
    if (document.getElementById('dsuStatsUI')) {
      document.getElementById('dsuStatsUI').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const root = $("#contentContainer").eq(0);
    const $box = $('<div id="dsuStatsUI" style="margin-top:8px;"></div>');
    root.prepend($box);

    // 1) Settings (checkboxes + button)
    //    (this replaces: $("#contentContainer").eq(0).prepend(html);)
    $box.append(html);

    // 2) Bind the button (no inline onclick needed)
    document.getElementById('getData')?.addEventListener('click', getData);

    
    // NEW: BB/CSV inside a collapsible spoiler
const rowsLen = (typeof rows === 'number' ? rows : $(tribeTable + " tr").length) || 10;

const $spoiler = $(`
  <details id="dsuExportSpoiler" style="margin-top:8px;">
    <summary class="btn" style="display:inline-block; cursor:pointer; user-select:none;">
      BB / CSV anzeigen
    </summary>
    <div style="margin-top:8px;">
      <span>BB</span><br>
      <textarea id="BBCODE" rows="${rowsLen + 4}" cols="100"></textarea><br>
      <span>CSV</span><br>
      <textarea id="CSVCODE" rows="${rowsLen + 4}" cols="100"></textarea><br>
    </div>
  </details>
`);
$box.append($spoiler);


    // 4) Restore checkbox states (moved from bottom)
    for (var i = 0; i < Object.keys(statsEnabled).length; i++) {
      const key = Object.keys(statsEnabled)[i];
      $('#' + key).prop("checked", statsEnabled[key]);
    }
  }

  // Inline launcher under the <h2> (styled like SingleVillageSnipe button)
  (function addStatsLauncher(){
    const btnId = 'dsu-open-stats';
    if (document.getElementById(btnId)) return;

    const h2 = document.querySelector('#content_value > h2');
    if (!h2) return;

    const wrap = document.createElement('div');
    wrap.style.margin = '6px 0 10px';
    wrap.innerHTML =
      '<a href="#" id="'+btnId+'" class="btn btn-confirm-yes" ' +
      'style="display:inline-flex;align-items:center;gap:6px;">' +
      '<span>Statistiken</span></a>';

    h2.insertAdjacentElement('afterend', wrap);
    document.getElementById(btnId).addEventListener('click', function(e){
      e.preventDefault();
      buildStatsUIOnce();
      // optional: auto-scroll to the UI
      document.getElementById('dsuStatsUI')?.scrollIntoView({ behavior:'smooth', block:'start' });
    }, false);
  })();


    html = "<table id='settingsData' class='vis content-border'><tr>";
    for (var i = 0; i < Object.keys(statsEnabled).length; i++) {
        html += `
                <th align="center" style="width:50px;padding: 5px;">${Object.keys(statsEnabled)[i]}</th>
            `;
    }
    html += "</tr><tr>"
    for (var i = 0; i < Object.keys(statsEnabled).length; i++) {
        html += `
                <td align="center" style="padding: 5px;"><input type="checkbox" ID="${Object.keys(statsEnabled)[i]}" name="${Object.keys(statsEnabled)[i]}"></td>
            `;
    }
    html += `</tr></table><input type="button" class="btn btnSophie" id="getData"  value="Get data"><br>`;


// after you prepend the button HTML


    for (var i = 0; i < Object.keys(statsEnabled).length; i++) {
        $(`#${Object.keys(statsEnabled)[i]}`).prop("checked", statsEnabled[Object.keys(statsEnabled)[i]]);
    }
})();