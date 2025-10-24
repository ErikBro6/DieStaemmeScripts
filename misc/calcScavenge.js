
  // [REMOVED] Auto-Send constants & UI

  // [ADD] Optimization (only two modes)
  const OPT_KEY = 'dsu_scavenger_opt_mode'; // 'equalTime' | 'perHour'
  let optMode = localStorage.getItem(OPT_KEY) || 'equalTime';

  // [ADD] Carry map (common TW values; only units present on this screen)
  const CARRY = { spear: 25, sword: 15, axe: 10, light: 80, heavy: 50, knight: 100 };

  // [ADD] Scavenge ratios
  const RATIOS = [0.10, 0.25, 0.50, 0.75];

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
      let arrayUseableTroops = getTroopAmount(); // [{unit, amount, value}, ...]
      let SendTroops = [];

      // Build enabled slot indices
      const enabledIdx = [];
      for (let i = 0; i < 4; i++) if (rzSlots.charAt(i) === '1') enabledIdx.push(i);

      // Compute GLOBAL fractional split 'a' (sum to 1 over enabled)
      const totalCap = arrayUseableTroops.reduce((s, e) => s + (CARRY[e.unit] || 0) * (parseInt(e.amount) || 0), 0);
      const a = (optMode === 'perHour')
        ? computeOptimalA_PerHour(totalCap, enabledIdx)
        : computeEqualTimeA(enabledIdx);

      // Split each *unit count* according to 'a'
      arrayUseableTroops.forEach(element => {
        SendTroops[element.unit] = splitByFractions(element.amount, a);
      });

      Truppenarray = SendTroops;
      startScavenger();
    });

    $(".free_send_button").on("click", function () {
      // follow-up clicks when a free button appears again
      startScavenger();
    });

    if ($('.premium_send_button').length > 0) {
      $(".premium_send_button").on("click", function () {
        setTimeout(() => { sendPremium(); }, 200);
      });
    }

    function sendPremium() {
      $(".evt-confirm-btn").on("click", function () {
        startScavenger();
      });
    }

    String.prototype.replaceAt = function (index, replacement) {
      return this.substr(0, index) + replacement + this.substr(index + replacement.length);
    }

    function startScavenger() {
      setTimeout(function () {
        let Scaveng = 0;
        for (let index = 3; index > -1; index--) {
          const element = rzSlots.charAt(index)
          if (element === "1" && Scaveng === 0) {
            Scaveng = 1;
            if ($('.scavenge-option').eq(index).find('.premium_send_button').length > 0) {
              $('.scavenge-option').eq(index).find('.premium_send_button').css('visibility', "visible");
            }
            if ($('.scavenge-option').eq(index).find('.free_send_button').length > 0) {
              $('.scavenge-option').eq(index).find('.free_send_button').css('visibility', "visible");
            }
            getTroopAmount().forEach(element => {
              let eInput = document.querySelector("#scavenge_screen > div > div.candidate-squad-container > table > tbody > tr:nth-child(2) > td:nth-child(" + element["value"] + ") > input")
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
              let temparray = { unit: element, amount: amount, value: value };
              if (parseInt(amount) > 0) troopObject.push(temparray)
            }
          })
        }
      });
      return troopObject
    }

    // Distribute a unit count by fractions a[0..3]
    function splitByFractions(amount, a) {
      const res = [0,0,0,0];
      let assigned = 0;
      for (let i = 0; i < 4; i++) {
        const v = Math.floor((amount || 0) * (a[i] || 0));
        res[i] = v;
        assigned += v;
      }
      // put any remainder into the last enabled slot (if any)
      const remainder = (amount || 0) - assigned;
      if (remainder > 0) {
        for (let i = 3; i >= 0; i--) {
          if (a[i] > 0) { res[i] += remainder; break; }
        }
      }
      return res;
    }

    // Equal-time fractions: a_i ∝ 1/ratio_i for enabled slots
    function computeEqualTimeA(enabledIdx) {
      const a = [0,0,0,0];
      let sum = 0;
      enabledIdx.forEach(i => { a[i] = 1 / RATIOS[i]; sum += a[i]; });
      if (sum <= 0) return a;
      enabledIdx.forEach(i => { a[i] = a[i] / sum; });
      return a;
    }

    // Resources/hour objective (df cancels for optimization)
    function revPerHour(iCap, ai, i) {
      if (ai <= 0) return 0;
      const r = RATIOS[i];
      // revenue = (iCap*ai*r) / ( ((iCap*ai)^2 * 100 * r^2) ^0.45 + 1800 )
      const load = iCap * ai;
      const denom = Math.pow((load*load) * 100 * (r*r), 0.45) + 1800;
      return (load * r) / denom;
    }

    function totalRev(iCap, a) {
      let s = 0;
      for (let i = 0; i < 4; i++) s += revPerHour(iCap, a[i] || 0, i);
      return s;
    }

    // Optimize a over enabled by simple coordinate-descent (adjacent transfers)
    function computeOptimalA_PerHour(iCap, enabledIdx) {
      const a = [0,0,0,0];
      if (!enabledIdx.length || iCap <= 0) return a;

      // init equal over enabled
      enabledIdx.forEach(i => a[i] = 1 / enabledIdx.length);

      let improved = true;
      let guard = 0;
      while (improved && guard++ < 200) {
        improved = false;
        for (let k = 0; k < enabledIdx.length - 1; k++) {
          const i = enabledIdx[k], j = enabledIdx[k+1];

          const cur = totalRev(iCap, a);

          // move half of i -> j
          if (a[i] > 0) {
            const di = a[i] * 0.5;
            a[i] -= di; a[j] += di;
            const v1 = totalRev(iCap, a);
            if (v1 <= cur) { a[j] -= di; a[i] += di; } else { improved = true; continue; }
          }

          // move half of j -> i
          if (a[j] > 0) {
            const dj = a[j] * 0.5;
            a[j] -= dj; a[i] += dj;
            const v2 = totalRev(iCap, a);
            if (v2 <= cur) { a[i] -= dj; a[j] += dj; } else { improved = true; }
          }
        }
      }
      return a;
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

      // [ADD] Two-option optimization UI (mutually exclusive)
      addOptimizationUI();
    }

    // Two checkboxes right above the table
    function addOptimizationUI() {
      if ($('#dsu-opt-box').length) return;

      const optBox = $(`
        <div id="dsu-opt-box" style="margin:6px 0 10px 0;display:flex;gap:18px;align-items:center;">
          <strong>Optimierung:</strong>
          <label style="display:inline-flex;gap:6px;align-items:center;cursor:pointer;">
            <input type="checkbox" id="optEqualTime">
            Gleiche Dauer
          </label>
          <label style="display:inline-flex;gap:6px;align-items:center;cursor:pointer;">
            <input type="checkbox" id="optPerHour">
            Rohstoffe / Stunde
          </label>
          <span style="opacity:.7;font-size:11px">(*wirkt beim Klick auf "Raubzug senden")</span>
        </div>
      `);

      $(".candidate-squad-widget").before(optBox);

      // restore
      $('#optEqualTime').prop('checked', optMode === 'equalTime');
      $('#optPerHour').prop('checked', optMode === 'perHour');

      // mutual exclusivity + persist
      $('#optEqualTime').on('change', function () {
        if ($(this).is(':checked')) {
          $('#optPerHour').prop('checked', false);
          optMode = 'equalTime';
        } else {
          optMode = $('#optPerHour').is(':checked') ? 'perHour' : 'equalTime';
        }
        localStorage.setItem(OPT_KEY, optMode);
      });
      $('#optPerHour').on('change', function () {
        if ($(this).is(':checked')) {
          $('#optEqualTime').prop('checked', false);
          optMode = 'perHour';
        } else {
          optMode = $('#optEqualTime').is(':checked') ? 'equalTime' : 'perHour';
        }
        localStorage.setItem(OPT_KEY, optMode);
      });
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
        let tempObject = { unit: $(this).attr("unit"), checked: $(this).is(":checked") }
        tempArray.push(tempObject)
      })
      storage.setItem("scavenger", JSON.stringify(tempArray))
      let maxValue = $(".maxTroops").val();
      storage.setItem("maxScavenger", maxValue)
      tempArray = [];
      for (let index = 0; index <= 4; index++) {
        if ($(".checkbox_" + index).is(':checked')) { tempArray.push(1); } else { tempArray.push(0); }
      }
      storage.setItem("SelectionScavenger", JSON.stringify(tempArray))
    }

    // [REMOVED] runAutoOnce & intervals entirely

  }, 50);
