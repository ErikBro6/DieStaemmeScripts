// ==UserScript==
// @name         MassUTFilter
// @version      1.0
// @description  Fuegt eine Filter auf der MassenUT Seite hinzu
// @author       Osse,TheHebel97
// @match        https://*.die-staemme.de/game.php*screen=place*mode=call*
// @match        https://*.staemme.ch/game.php*screen=place*mode=call*
// ==/UserScript==

var api = typeof unsafeWindow != 'undefined' ? unsafeWindow.ScriptAPI : window.ScriptAPI;
api.register('610-MassenunterstÃ¼tzungsfilter', true, 'Osse, TheHebel97', 'support-nur-im-forum@die-staemme.de');

$(document).ready(function () {
    "use strict";

    let startDate;
    let endDate;
    let dateNow;

    appendUI()

    $("#startFilter").on("click", checkParamaters)
    $(".supFilter").on("change", checkParamaters)

    function checkParamaters() {
        $("#msg").text("")
        if ($("#supFilterStartDate").val() !== "" && $("#supFilterStartTime").val() !== "" &&
            $("#supFilterEndDate").val() !== "" && $("#supFilterEndTime").val() !== "") {
            dateNow = Math.round(Date.now() / 1000);
            startDate = Math.round(new Date($("#supFilterStartDate").val() + "T" + $("#supFilterStartTime").val() + ":00") / 1000)
            endDate = Math.round(new Date($("#supFilterEndDate").val() + "T" + $("#supFilterEndTime").val() + ":00") / 1000)
            if (endDate < dateNow) {
                $("#msg").text("Enddatum liegt in der Vergangenheit.")
            } else {
                if (startDate < dateNow) {
                    startDate = dateNow;
                    $("#msg").text("Startdatum liegt in der Vergangenheit. Automatisch auf die aktuelle Zeit angepasst.")
                }
                setLocalstorageValues()
                sortTable()
            }
        } else {
            $("#msg").text("Bitte alle Felder ausfÃ¼llen.")
        }
    }

    function sortTable() {
        $("#village_troup_list > tbody > tr").show();

        if ($("#place_call_select_all").prop("checked")) {
            $("#place_call_select_all").trigger("click");
            $("#place_call_select_all").trigger("click");
        } else {
            $("#place_call_select_all").trigger("click");
        }

        $("#village_troup_list > tbody > tr").each(function () {
            let slowestAvailableUnit = {
                "unit": "",
                "time": 0
            };
            let allAvailableUnit = [];
            let knightPossible = false;
            $("td", this).each(function () {
                let unit = $(this).attr("data-unit");
                let lfz = $(this).attr("data-title");
                let unitAvailable = $(".call-unit-box", this).prop("disabled");
                let unitQuantity = $(".call-unit-box", this).val();
                if (unit && !unitAvailable && unitQuantity !== "") {
                    lfz = lfz.split(":");
                    lfz = lfz[1] * 3600 + lfz[2] * 60 + parseInt(lfz[3]);
                    let tempArray = {
                        unit: unit,
                        lfz: lfz,
                        html: this
                    };
                    allAvailableUnit.push(tempArray);
                    if (dateNow + lfz >= startDate && dateNow + lfz <= endDate) {
                        if (unit == "knight") {
                            knightPossible = true;
                        }
                        if (slowestAvailableUnit["time"] < lfz) {
                            slowestAvailableUnit["unit"] = unit;
                            slowestAvailableUnit["time"] = lfz;
                        }
                    }
                }
            })
            if (slowestAvailableUnit["unit"] == "") {
                $(this).hide()
                allAvailableUnit.forEach(element => {
                    $(".call-unit-box", element["html"]).prop("disabled", true);
                });
            } else {
                allAvailableUnit.forEach(element => {
                    if(element["unit"] == "knight"){
                        $(".call-unit-box", element["html"]).prop("disabled", true);
                    }else{
                        if (element["lfz"] <= slowestAvailableUnit["time"]) {
                            $(".call-unit-box", element["html"]).prop("disabled", false);
                        } else {
                            $(".call-unit-box", element["html"]).prop("disabled", true);
                        }
                    }
                });
                if (knightPossible) {
                    $(".call-unit-box", $(this)).prop("disabled", false);
                }
            }
        })
    }

    function appendUI() {
        let uiDiv = `<div style="margin-bottom:5px;">
                    Ankunftszeiten:
                    Startdatum <input type="date" class="supFilter" id="supFilterStartDate">
                    Startzeit <input type="time" class="supFilter" id="supFilterStartTime">
                    Enddatum <input type="date" class="supFilter" id="supFilterEndDate">
                    Endzeit <input type="time" class="supFilter" id="supFilterEndTime">
                    <input type="button" class="btn" id="startFilter" value="Filter anwenden">
                    </div>
                    <div id="msg" style="margin-bottom:5px;"></div>`
        $("#content_value >br").after(uiDiv)
        loadLocalstorageValues()
    }

    function setLocalstorageValues() {
        let tempArray = {
            startDate: $("#supFilterStartDate").val(),
            startTime: $("#supFilterStartTime").val(),
            endDate: $("#supFilterEndDate").val(),
            endTime: $("#supFilterEndTime").val()
        }
        localStorage.setItem("supFilter", JSON.stringify(tempArray))
    }

    function loadLocalstorageValues() {
        let filterValues = localStorage.getItem("supFilter")
        if (filterValues !== null) {
            filterValues = JSON.parse(filterValues);
            $("#supFilterStartDate").val(filterValues["startDate"])
            $("#supFilterStartTime").val(filterValues["startTime"])
            $("#supFilterEndDate").val(filterValues["endDate"])
            $("#supFilterEndTime").val(filterValues["endTime"])
        }
    }
});