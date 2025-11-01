// ==UserScript==
// @name         Rohstoffe anfordern Zusammenfassung
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  ZÃ¤hlt die angeforderten Rohstoffe vor dem Anfordern zusammen
// @author       TheHebel97 (Code "teilweise" von Get Drunk :)
// @match        https://*.die-staemme.de/*&screen=market*&mode=call*
// ==/UserScript==

var api = typeof unsafeWindow != 'undefined' ? unsafeWindow.ScriptAPI : window.ScriptAPI
api.register( '320-Rohstoffe anfordern Zusammenfassung', true, 'TheHebel97', 'support-nur-im-forum@die-staemme.de' );

(function () {
    "use strict";
    var ressis = new Array(3);

    $('#village_list thead').append('<tr></tr>');
    // Select the node that will be observed for mutations
    const targetNode = document
        .getElementById("village_list")
        .getElementsByTagName("tbody")[0];

    // Options for the observer (which mutations to observe)
    const config = {
        attributes: true,
        childList: true,
        subtree: true,
    };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback);

    // Start observing the target node for configured mutations
    observer.observe(targetNode, config);
    if ($("select >option").text() != "Keine Vorlagen verfÃ¼gbar") {
        $("select").change(callback);
    }
    $("#village_list input.hide_toggle").on("input", callback);
    $(".res_checkbox").change(callback);
    

    //functions
    function callback() {
        for (var i = 0; i < 3; i++) {
            ressis[i] = 0;
        }
        $(
            "#village_list > tbody > tr > td:nth-child(8) > input[name=select-village]:checkbox:checked"
        ).each(function () {
            $(this).parent().parent()
                .find("td[data-res-type] input")
                .each(function () {
                    let resName = getRessName($(this).attr("name"));
                    let value = parseInt($(this).val() ? $(this).val() : 0)
                    resName == "wood" ? ressis[0] += value : ressis[0] += 0
                    resName == "stone" ? ressis[1] += value : ressis[1] += 0
                    resName == "iron" ? ressis[2] += value : ressis[2] += 0
                });
        });

        let output = `<td style='font-weight: bold;'>Rohstoffe Zusammenfassung</td><td></td>
                    <td style='font-weight: bold;'><span class="res wood"></span>` + ressis[0] + `</td>
                    <td style='font-weight: bold;'><span class="res stone"></span>` + ressis[1] + `</td>
                    <td style='font-weight: bold;'><span class="res iron"></span>` + ressis[2] + `</td><td></td><td></td><td></td>`

        $('#village_list thead tr:eq(1)').html(output);
    }

    function getRessName(resString) {
        let stringParts = resString.split("[");
        let res = stringParts[2].split("]");
        return res[0];
    }
})();