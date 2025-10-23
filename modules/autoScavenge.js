// ==UserScript==
// @name         Raubzug schicken + Auto Toggle
// @version      1.3
// @description  Rechnet/Fügt die Truppen ein und sendet automatisch alle 30s mit Toggle & sequentiellen Startklicks (von hinten nach vorne)
// @author       TheHebel97, Osse (+auto by you)
// @match        https://*.die-staemme.de/game.php?*&screen=place&mode=scavenge*
// @run-at       document-idle
// ==/UserScript==

var api = typeof unsafeWindow != 'undefined' ? unsafeWindow.ScriptAPI : window.ScriptAPI;
api.register('470-Raubzug schicken', true, 'osse, TheHebel97', 'support-nur-im-forum@die-staemme.de');

(function () {
  'use strict';

  // ---- Auto Config ----
  const AUTO_INTERVAL_MS = 30_000;
  const AUTO_KEY = 'dsu_scavenger_auto_enabled';
  let autoEnabled = JSON.parse(localStorage.getItem(AUTO_KEY) || 'true');
  let autoIv = null;
  let autoBusy = false;
  let lastClickTs = 0;

  setTimeout(function () {
    setupUI();

    let storage = localStorage;
    getLocalStorage();

    $(".saveLocalStorage").on("click", function () {
      setLocalStorage();
    });

    $(".clearLocalStorage").on("click", function () {
      storage.removeItem("scavenger");
    });

    let Start = 0;
    let rzSlots;
    let Truppenarray = [];

    $(".SendScavenger").on("click", function () {
      Start = 1;
      rzSlots = readOutRZSlotsCB();
      let arrayUseableTroops = getTroopAmount();
      let SendTroops = [];
      for (let index = 0; index < 4; index++) {
        const element = rzSlots.charAt(index);
      }
      arrayUseableTroops.forEach(element => {
        SendTroops[element["unit"]] = getTroopsPerRzSlot(element["amount"], rzSlots, "equalyLong");
      });
      Truppenarray = SendTroops;
      startScavenger();
    });

    $(".free_send_button").on("click", function () {
      if (Start === 1) {
        $(".SendScavenger").css('visibility', "hidden");
        startScavenger();
      }
    });

    if ($('.premium_send_button').length > 0) {
      $(".premium_send_button").on("click", function () {
        setTimeout(() => {
          sendPremium();
        }, 200);
      });
    }

    function sendPremium() {
      $(".evt-confirm-btn").on("click", function () {
        if (Start === 1) {
          $(".SendScavenger").css('visibility', "hidden");
          startScavenger();
        }
      });
    }

    String.prototype.replaceAt = function (index, replacement) {
      return this.substr(0, index) + replacement + this.substr(index + replacement.length);
    }

    function startScavenger() {
      setTimeout(function () {
        let Scaveng = 0;
        for (let index = 3; index > -1; index--) {
          const element = rzSlots.charAt(index);
          if (element === "1" && Scaveng === 0) {
            Scaveng = 1;
            if ($('.scavenge-option').eq(index).find('.premium_send_button').length > 0) {
              $('.scavenge-option').eq(index).find('.premium_send_button').css('visibility', "visible");
            }
            if ($('.scavenge-option').eq(index).find('.free_send_button').length > 0) {
              $('.scavenge-option').eq(index).find('.free_send_button').css('visibility', "visible");
            }
            getTroopAmount().forEach(element => {
              let eInput = document.querySelector("#scavenge_screen > div > div.candidate-squad-container > table > tbody > tr:nth-child(2) > td:nth-child(" + element["value"] + ") > input");
              eInput.value = Truppenarray[element["unit"]][index];
              let event = new Event('change');
              eInput.dispatchEvent(event);
            });
            rzSlots = rzSlots.replaceAt(index, "0");
          } else {
            if ($('.scavenge-option').eq(index).find('.premium_send_button').length > 0) {
              $('.scavenge-option').eq(index).find('.premium_send_button').css('visibility', "hidden");
            }
            if ($('.scavenge-option').eq(index).find('.free_send_button').length > 0) {
              $('.scavenge-option').eq(index).find('.free_send_button').css('visibility', "hidden");
            }
          }
        }
      }, 200);
    }

    function getNumberOfUnlockedScavengeSlots() {
      return 4 - $(".lock").length;
    }

    function getTroopAmount() {
      let troopObject = [];
      let value = 0;
      game_data.units.forEach(element => {
        if (element != "ram" && element != "catapult" && element != "spy") {
          value += 1;
        }
        if ($("input[unit='" + element + "']").is(":checked")) {
          $(".unitsInput").each(function () {
            if (this.name === element) {
              let amount = $(".units-entry-all[data-unit='" + element + "']").text().match(/\d+/)[0];
              if (parseInt($('.maxTroops').val()) < amount) {
                amount = parseInt($('.maxTroops').val());
              }
              let temparray = {
                unit: element,
                amount: amount,
                value: value
              }
              if (parseInt(amount) > 0) troopObject.push(temparray)
            }
          })
        }
      });
      return troopObject
    }

    function getTroopsPerRzSlot(amount, level, calcType) {
      let weigths;
      switch (calcType) {
        case "equalyLong":
          weigths = [7.5, 3, 1.5, 1]
      }
      let amounts = []
      let sum = 0
      for (var i = 0; i < weigths.length; i++) {
        if (level.charAt(i) == "1") {
          sum += weigths[i]
        }
      }
      for (var i = 0; i < weigths.length; i++) {
        if (level.charAt(i) == "1") {
          let troops = Math.floor(amount * weigths[i] / sum)
          amounts.push(troops)
        } else {
          amounts.push(0)
        }
      }
      return amounts
    }

    function setupUI() {
      $(".border-frame-gold-red").css("padding-bottom", "10px");
      $(".candidate-squad-widget > tbody > tr").eq(0).append("<th>Senden</th>");
      $(".candidate-squad-widget > tbody > tr").eq(1).append('<td><button class="SendScavenger btn">Raubzug senden</button></td>');
      let Options = `<label>max. Truppen</label><input class="maxTroops" type="number" min="10" max="10000" checked><button class="clearLocalStorage btn">Default löschen</button><button class="saveLocalStorage btn">Default speichern</button>`;
      $(".candidate-squad-widget").before(Options);

      for (let index = 0; index < getNumberOfUnlockedScavengeSlots(); index++) {
        $(".preview").eq(index).before('<input class="checkbox_' + index + '" type="checkbox" checked style="margin-left: 50%;margin-top: 10px;" unit="' + index + '">');
        if ($(".preview").eq(index).find(".return-countdown").length) {
          $(".checkbox_" + index).prop('disabled', true);
          $(".checkbox_" + index).removeAttr("checked");
        }
      }
      $(".unit_link").each(function () {
        let unit = $(this).attr("data-unit");
        $(this).parent().append('<input class="checkboxTroops" type="checkbox" checked="" style="width:20%;" unit="' + unit + '"></input>');
      });

      // ---- Auto-Toggle UI ----
      addToggleUI();

      // ---- Start Auto Timer ----
      if (!autoIv) {
        autoIv = setInterval(runAutoOnce, AUTO_INTERVAL_MS);
        setTimeout(runAutoOnce, 800);
      }
    }

    function addToggleUI() {
      if ($('#dsu-auto-toggle').length) return;
      const box = $(`
        <div id="dsu-auto-toggle" style="
          position:fixed;right:10px;bottom:50px;z-index:9999;
          background:#222;color:#fff;padding:8px 10px;border-radius:8px;
          box-shadow:0 4px 18px rgba(0,0,0,.3);font:12px system-ui;display:flex;align-items:center;gap:8px;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input id="autoEnabledBox" type="checkbox" ${autoEnabled ? 'checked' : ''}>
            Auto Raubzug (30s)
          </label>
          <span style="opacity:.8">⏱️ <span id="autoLast">–</span></span>
        </div>
      `);
      $('body').append(box);
      $('#autoEnabledBox').on('change', function () {
        autoEnabled = $(this).is(':checked');
        localStorage.setItem(AUTO_KEY, JSON.stringify(autoEnabled));
      });

      setInterval(() => {
        const sec = lastClickTs ? Math.floor((Date.now() - lastClickTs) / 1000) : '–';
        $('#autoLast').text(sec + 's');
      }, 1000);
    }

    function readOutRZSlotsCB() {
      let level = "";
      for (let index = 0; index < getNumberOfUnlockedScavengeSlots(); index++) {
        if ($('.checkbox_' + index).is(":checked")) {
          level += "1";
        } else {
          level += "0";
        }
      }
      if (level.length < 4) {
        for (let index = level.length; index < 4; index++) {
          level += "0";
        }
      }
      return level;
    }

    function getLocalStorage() {
      let data = storage.getItem("scavenger")
      if (data != null) {
        data = JSON.parse(data);
        data.forEach(element => {
          $("input[unit='" + element.unit + "']").prop('checked', element.checked);
        });
      }
      let maxValue = storage.getItem("maxScavenger")
      if (data != null) {
        $(".maxTroops").val(maxValue);
      }
      let selectedScavenger = storage.getItem("SelectionScavenger")
      if (selectedScavenger != null) {
        selectedScavenger = JSON.parse(selectedScavenger);
        for (let index = 0; index < 4; index++) {
          if (selectedScavenger[index] == 1 && $(".checkbox_" + index).attr('disabled') == undefined) {
            $(".checkbox_" + index).prop("checked", true);
          } else {
            $(".checkbox_" + index).prop("checked", false);
          }
        }
      }
    }

    function setLocalStorage() {
      let tempArray = [];
      $(".checkboxTroops").each(function () {
        let tempObject = {
          unit: $(this).attr("unit"),
          checked: $(this).is(":checked")
        }
        tempArray.push(tempObject)
      })
      storage.setItem("scavenger", JSON.stringify(tempArray))
      let maxValue = $(".maxTroops").val();
      storage.setItem("maxScavenger", maxValue)
      tempArray = [];
      for (let index = 0; index <= 4; index++) {
        if ($(".checkbox_" + index).is(':checked')) {
          tempArray.push(1);
        } else {
          tempArray.push(0);
        }
      }
      storage.setItem("SelectionScavenger", JSON.stringify(tempArray))
    }

    // ---- Auto Flow ----
    function runAutoOnce() {
      if (!autoEnabled || autoBusy) return;
      const $send = $('.SendScavenger.btn:visible');
      if (!$send.length) return;

      autoBusy = true;
      try {
        $send.first().trigger('click');
        lastClickTs = Date.now();

        setTimeout(() => {
          const $starts = $('.scavenge-option .free_send_button:visible');
          let idx = $starts.length - 1;
          function clickNext() {
            if (idx < 0) { autoBusy = false; return; }
            const $btn = $starts.eq(idx);
            if ($btn && $btn.length) $btn.trigger('click');
            idx--;
            setTimeout(clickNext, 1000);
          }
          clickNext();
        }, 1000);
      } catch (e) {
        autoBusy = false;
      }
    }

  }, 50);
})();
