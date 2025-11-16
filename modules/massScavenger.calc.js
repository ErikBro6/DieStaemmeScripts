// ==UserScript==
// @name         Massenraubzug schicken
// @version      1.0
// @description  Vorlagen fÃ¼r Massenraubzug
// @author       Osse,TheHebel97
// @match        https://*.die-staemme.de/game.php?*screen=place&mode=scavenge_mass*
// ==/UserScript==

var api = typeof unsafeWindow != 'undefined' ? unsafeWindow.ScriptAPI : window.ScriptAPI;
api.register('480-Massenraubzug schicken', true, 'Osse, TheHebel97', 'support-nur-im-forum@die-staemme.de');

(function () {
    setTimeout(function () {
        let storage = localStorage;
        let templateArray = [];
        let Temp;
        let Start = 0;
        if (storage.getItem("massScav") == null) {
            storage.setItem("massScav", JSON.stringify(templateArray));

        } else {
            templateArray = JSON.parse(storage.getItem("massScav"));
        }
        setupUI();

        let Scav = "0000";
        let units = [];
        $(".unit_link:data").filter(function () {
            units.push($(this).data("unit"))
        });

        $(document).on("click", ".changeTemplate", function () {
            setTimeout(changeTemplatesUI, 100);
        });

        $(document).on("click", ".closeTemplate", function () {
            setTimeout(closeTemplatesUI, 100);
        });

        $(document).on("click", ".safeTemplate", function () {
            setTimeout(safeTemplate, 100);
        });


        $(document).on("click", ".DeleteTemplateBtn", function () {
            let Val = $(".DeleteTemplate").val();
            $(".DeleteTemplate option[value='" + Val + "']").remove();
            $(".ScavVorlagen option[value='" + Val + "']").remove();
            templateArray.shift(Val)
            storage.setItem("massScav", JSON.stringify(templateArray));
        });

        $(document).on("click", ".SendScavenger", function () {
            let Value = $(".ScavVorlagen").val()
            if (Value !== null) {
                Scav = templateArray[Value][4]["Combination"];
                Start = 1;
                Temp = Value;
                $(".SendScavenger").css("visibility", "hidden")
                startScavenger()
            }
        });
        $(document).on("change", ".ScavVorlagen", function () {
            $(".SendScavenger").css("visibility", "visible")
            Start = 0;
        });

        $(".btn-send").click(function () {
            startScavenger();
        });

        $(".btn-send-premium").click(function () {
            setTimeout(() => {
                sendPremium();
            }, 200);
        });

        function sendPremium() {
            $(".btn-confirm-yes").click(function () {
                startScavenger();
            });
        }

        function startScavenger() {
            setTimeout(function () {
                let Scaveng = 0;
                let Template = Temp;
                for (let index = 3; index > -1; index--) {
                    const element = Scav.charAt(index)
                    if (element === "1" && Scaveng === 0) {
                        Scaveng = 1;
                        Scav = Scav.replaceAt(index, "0");
                        let TempUnits = templateArray[Template][index];
                        for (let index_2 = 0; index_2 < TempUnits.length; index_2++) {
                            $(".unitsInput").eq(index_2).val(TempUnits[index_2]["val"]).change();
                        }
                        //Um Bugs zu vermeiden, wenn man mehrfach Raubzug senden klickt
                        $(".select-all-col").click();
                        $(".status-inactive").click();
                        $(".select-all-col:checked").click();
                        $(".status-inactive:checked").click();
                        let Val = index + 1;
                        if ($(".option-" + Val + ".option-inactive").length === 0) {
                            startScavenger();
                        } 
                        $(".select-all-col").eq(index).click();
                        //Bugs vermeiden wenn kein Input gesetzt worden ist,obwohl es eigentlich gesetzt worden sein soll
                        let repeat = true;
                        for (let index_2 = 0; index_2 < TempUnits.length; index_2++) {
                            if($(".unitsInput").eq(index_2).val() > 0){
                                repeat = false;
                            }
                        }
                        if(repeat){
                            startScavenger();
                        }
                    }
                }
            }, 400);
        }

        function safeTemplate() {
            let SafeTemplates = [];
            let Combinate = "";
            for (let index = 0; index < 4; index++) {
                let tempArray = [];
                let flag = false;
                $("input[name$=_" + index + "]").each(function () {

                    let name = $(this).attr('name');
                    name = name.substring(0, name.length - 2);
                    let val = $(this).val() == 0 ? 0 : parseInt($(this).val());
                    if (val > 0) flag = true;
                    let tempObj = {
                        name: name,
                        val: val
                    };
                    tempArray.push(tempObj);
                });
                if (flag) {
                    Combinate += "1";
                } else {
                    Combinate += "0";
                }
                SafeTemplates.push(tempArray);
            }
            let tempObj = {
                templateName: $("input[name=TemplateName]").val(),
                Combination: Combinate
            }
            SafeTemplates.push(tempObj);

            let incomingArray = JSON.parse(storage.getItem("massScav"));
            incomingArray.push(SafeTemplates)
            templateArray = incomingArray;
            storage.setItem("massScav", JSON.stringify(incomingArray));
            $('.ScavVorlagen').append($('<option>', {
                value: incomingArray.length - 1,
                text: $("input[name=TemplateName]").val()
            }));
            $('.DeleteTemplate').append($('<option>', {
                value: incomingArray.length - 1,
                text: $("input[name=TemplateName]").val()
            }));
        }

        function closeTemplatesUI() {
            $(".closeTemplate").remove()
            $(".ScavTemplateTable").remove()
            $(".safeTemplate").remove()
            $(".TemplateName").remove()
            $(".candidate-squad-widget").after('<button class="changeTemplate btn">Vorlagen bearbeiten</button>')
        }

        function changeTemplatesUI() {
            let options;
            let optionValue = 0;
            templateArray.forEach(element => {
                options += '<option value="' + optionValue + '">' + element[4]["templateName"] + '</options>';
                optionValue += 1;
            });

            $(".changeTemplate").remove()
            $(".candidate-squad-widget").after('<button class="closeTemplate btn">Schlie\u00dfen</button>')
            $(".candidate-squad-widget").after('<button class="safeTemplate btn">Vorlage speichern</button>')

            let TemplateName = '<label class="TemplateName"> Vorlagenname </label><input class="TemplateName input-nicer" name="TemplateName" type="text">'
            $(".closeTemplate").after(TemplateName)
            let table = `<table class="candidate-squad-widget ScavTemplateTable"><tbody><tr>`;
            let img_src = $(".candidate-squad-widget > tbody > tr").eq(0).children().eq(0).find("img").attr("src");
            img_src = img_src.replace("spear.png", "");
            units.forEach(element => {
                table += `<th><a href="#" class="unit_link" data-unit="${element}"><img src="` + img_src + element + `.png"></a></th>`
            });
            table += `<th>Vorlage</th>
            </tr>
            </thead>
            <tbody>`;

            for (let index = 0; index < 4; index++) {
                table += "<tr>"
                units.forEach(element => {
                    table += `<td><input name="${element+"_"+index}" type="number" value="" maxlength="5" max="99999" class="unitsInput input-nicer"></td>`
                });
                if (index === 0) {
                    table += "<td>Faule Sammler</td>"
                }
                if (index === 1) {
                    table += "<td>Bescheidene Sammler</td>"
                }
                if (index === 2) {
                    table += "<td>Kluge Sammler</td>"
                }
                if (index === 3) {
                    table += "<td>GroÃŸartige Sammler</td>"
                }
                table += "</tr>"
            }

            $(".closeTemplate").after(table)
            $(".TemplateName").eq(1).after('<td><select class="DeleteTemplate TemplateName">' + options + '</select></td>');
            $(".DeleteTemplate").after('<button class="btn TemplateName DeleteTemplateBtn"> Vorlage l\u00f6schen </button>')
        }

        function setupUI() {
            let options;
            let optionValue = 0;
            templateArray.forEach(element => {
                options += '<option value="' + optionValue + '">' + element[4]["templateName"] + '</options>';
                optionValue += 1;
            });
            $(".candidate-squad-widget > tbody > tr").eq(0).append("<th>Vorlage</th>");
            $(".candidate-squad-widget > tbody > tr").eq(1).append('<td><select class="ScavVorlagen">' + options + '</select></td>');
            $(".candidate-squad-widget > tbody > tr").eq(0).append("<th>Senden</th>");
            $(".candidate-squad-widget > tbody > tr").eq(1).append('<td><button class="SendScavenger btn">Raubzug senden</button></td>');
            $(".candidate-squad-widget").after('<button class="changeTemplate btn">Vorlagen bearbeiten</button>')

        }
        String.prototype.replaceAt = function (index, replacement) {
            return this.substr(0, index) + replacement + this.substr(index + replacement.length);
        }
    }, 100);
})();