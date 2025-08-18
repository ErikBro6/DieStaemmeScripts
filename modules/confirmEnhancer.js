console.log("Confirm Enhancer");
let sendTimeInit = false;
let autoSendEnabled = false;
let autoSendObserver = null;

function formatTimes(epoch) {
    function z(n) {
        let s = "" + n;
        while (s.length < 2) s = "0" + s;
        return s;
    }
    let d = new Date(epoch * 1000);
    return z(d.getDate()) + "." + z(d.getMonth() + 1) +
           " " + z(d.getHours()) + ":" + z(d.getMinutes()) + ":" + z(d.getSeconds());
}

function initCommandUI() {
    if (
        (game_data.screen === 'map' || game_data.screen === 'place') &&
        $('#place_confirm_units').length > 0 &&
        $('.sendTime').length === 0 &&
        !sendTimeInit
    ) {
        sendTimeInit = true;

        $.get(
            $('.village_anchor').first().find('a').first().attr('href'),
            function (html) {
                let $cc = $(html).find('.commands-container');
                let $commandTable = $('form[action*="action=command"]').find('table').first();
                let w = (game_data.screen === 'map')
                    ? '100%'
                    : ($('#content_value').width() - $commandTable.width() - 10) + 'px';

                // 1) „Abschick Counter“-Zelle einfügen
                $commandTable
                    .css('float', 'left')
                    .find('tr').last()
                    .after('<tr><td>Abschick Counter:</td><td class="sendTime">-</td></tr>');

                // 3) Ankunftszeit-Eingaben (Tag, Monat, Stunde, Minute, Sekunde)
                $commandTable.find('tr').last().after(`
                    <tr>
                        <td style="white-space: nowrap;">Ankunftszeit:</td>
                        <td style="white-space: nowrap;">
                            <input type="number" id="arrivalDay"   min="1" max="31" placeholder="TT" style="width:40px;"> .
                            <input type="number" id="arrivalMonth" min="1" max="12" placeholder="MM" style="width:40px;">&nbsp;
                            <input type="number" id="arrivalHour"  min="0" max="23" placeholder="HH" style="width:40px;"> :
                            <input type="number" id="arrivalMinute"min="0" max="59" placeholder="MM" style="width:40px;"> :
                            <input type="number" id="arrivalSecond"min="0" max="59" placeholder="SS" style="width:40px;">
                        </td>
                    </tr>
                `);

                // 3a) Felder für Tag/Monat sofort mit heutigem Datum befüllen
                let jetzt = new Date();
                $('#arrivalDay').val(jetzt.getDate());
                $('#arrivalMonth').val(jetzt.getMonth() + 1);

                // 4) Auto-Senden-Button (falls nicht vorhanden)
                if ($('#autoSendToggle').length === 0) {
                    $commandTable.find('tr').last().after(`
                        <tr>
                            <td style="white-space: nowrap;">&nbsp;</td>
                            <td>
                                <button id="autoSendToggle" type="button" style="margin-left:10px;">Auto-Senden: AUS</button>
                            </td>
                        </tr>
                    `);
                    $('#autoSendToggle')
                        .css('background', '#f44336')
                        .css('color', '#fff')
                        .on('click', function () {
                            autoSendEnabled = !autoSendEnabled;
                            $(this)
                                .text('Auto-Senden: ' + (autoSendEnabled ? 'AN' : 'AUS'))
                                .css('background', autoSendEnabled ? '#4caf50' : '#f44336');

                            if (autoSendEnabled) {
                                startAutoSendObserver();
                            } else {
                                stopAutoSendObserver();
                            }
                        });
                }

                // 5) Listener für Änderung der Ankunftszeit-Eingaben (aktualisiert Countdown)
                $('#arrivalDay, #arrivalMonth, #arrivalHour, #arrivalMinute, #arrivalSecond').on('change', function() {
                    manualUpdateCountdown();
                });

                // 6) Wenn Commands vorhanden sind: Panel andocken + Klick-Handler
if ($cc.length > 0) {
    console.log("Binding click to command-row (delegated)...");

    // Panel vorbereiten
    const $commandPanel = $('<div id="command-panel"></div>').css({
        'float': 'right',
        'width': w,
        'display': 'block',
        'max-height': $commandTable.height(),
        'overflow': 'scroll'
    });

    // Tabelle aus $cc einfügen
    const $clonedTable = $cc.find('table').clone();
    $commandPanel.append($clonedTable).append('<br><div style="clear:both;"></div>');

    // Panel ins DOM einfügen
    $commandTable.closest('table').after($commandPanel);

    // Rückkehr-Befehle entfernen
    $commandPanel.find('tr.command-row').filter(function () {
        return $(this).find('img[src*="/return_"], img[src*="/back.png"]').length > 0;
    }).remove();

    // Delegierter Click-Handler
    $commandPanel.on('click', 'tr.command-row', function () {
        const $this = $(this);

        // a) Dauer auslesen
        let durationText = $commandTable
            .find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")')
            .next().text().trim();
        let [h, m, s] = durationText.split(':').map(x => parseInt(x, 10) || 0);
        let durationInSeconds = h * 3600 + m * 60 + s;

        // b) Endzeit aus <span class="timer">
        let endTime = parseInt($this.find('span.timer').data('endtime'), 10);
        if (isNaN(endTime) || durationInSeconds === 0) {
            $('.sendTime').html('Keine gültigen Zeitdaten');
            $('#sendCountdown')?.remove();
            clearTabCountdown();
            return;
        }

        // c) Ankunftszeit in Input-Felder schreiben
        let arrivalDate = new Date(endTime * 1000);
        $('#arrivalDay').val(arrivalDate.getDate());
        $('#arrivalMonth').val(arrivalDate.getMonth() + 1);
        $('#arrivalHour').val(arrivalDate.getHours());
        $('#arrivalMinute').val(arrivalDate.getMinutes());
        $('#arrivalSecond').val(arrivalDate.getSeconds());

        // d) Sendepunkt berechnen
        let sendTime = endTime - durationInSeconds;

        // e) Vorherige Timer/Observer stoppen
        clearTabCountdown();

        // f) Abschick Counter anzeigen
        $('.sendTime').html(
            formatTimes(sendTime) +
            ' (<span id="sendCountdown" class="sendTimer" data-endtime="' + sendTime + '">-</span>)'
        );

        // g) Timer starten
        Timing.tickHandlers.timers.initTimers('sendTimer');

        // h) Auto-Send-Observer starten
        if (autoSendEnabled) {
            startAutoSendObserver();
        }

        // i) Zeile hervorheben
        $this.closest('table').find('td').css('background-color', '');
        $this.find('td').css('background-color', '#FFF68F');
    });

    // Timer für Standardanzeigen aktivieren
    $('.widget-command-timer').addClass('timer');
    Timing.tickHandlers.timers.initTimers('widget-command-timer');
} else {
    UI.ErrorMessage('Keine Befehle gefunden');
}


                // 7) „Start Ankunfts-Senden“-Button binden
                $('#startArrivalSend').off('click').on('click', function () {
                    let heute = new Date();
                    let day   = heute.getDate();
                    let month = heute.getMonth() + 1;
                    let year  = heute.getFullYear();

                    let hour   = parseInt($('#arrivalHour').val(), 10);
                    let minute = parseInt($('#arrivalMinute').val(), 10);
                    let second = parseInt($('#arrivalSecond').val(), 10);

                    if ([day, month, hour, minute, second].some(x => isNaN(x))) {
                        alert('Bitte alle Felder ausfüllen!');
                        return;
                    }

                    let arrivalTime = new Date(year, month - 1, day, hour, minute, second);
                    let arrivalEpoch = Math.floor(arrivalTime.getTime() / 1000);

                    // Dauer auslesen (0, wenn kein Command)
                    let durationText = $commandTable
                        .find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")')
                        .next().text().trim();
                    let [h2, m2, s2] = durationText.split(':').map(x => parseInt(x, 10) || 0);
                    let durationInSeconds2 = h2 * 3600 + m2 * 60 + s2;

                    let sendEpoch = arrivalEpoch - durationInSeconds2;
                    if (sendEpoch < Math.floor(Date.now() / 1000)) {
                        alert('Abschickzeit liegt in der Vergangenheit!');
                        return;
                    }
                    scheduleSend(sendEpoch);
                });
            }
        );
    }
}

function manualUpdateCountdown() {
    let heute = new Date();
    let day   = heute.getDate();
    let month = heute.getMonth() + 1;
    let year  = heute.getFullYear();

    let hour   = parseInt($('#arrivalHour').val(), 10);
    let minute = parseInt($('#arrivalMinute').val(), 10);
    let second = parseInt($('#arrivalSecond').val(), 10);
    let dayVal   = parseInt($('#arrivalDay').val(), 10);
    let monthVal = parseInt($('#arrivalMonth').val(), 10);

    // Wenn Tag/Monat manuell geändert wurden, ignorieren wir heute – 
    //    sonst setzen wir sie auf heute (falls leer)
    if (isNaN(dayVal))   dayVal = day;
    if (isNaN(monthVal)) monthVal = month;

    if ([dayVal, monthVal, hour, minute, second].some(x => isNaN(x))) {
        return;
    }

    let arrivalEpoch = Math.floor(new Date(year, monthVal - 1, dayVal, hour, minute, second).getTime() / 1000);

    let $commandTable = $('form[action*="action=command"]').find('table').first();
    let durationText = $commandTable
        .find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")')
        .next().text().trim();
    let [h, m, s] = durationText.split(':').map(x => parseInt(x, 10) || 0);
    let durationSeconds = h * 3600 + m * 60 + s;

    let sendEpoch = arrivalEpoch - durationSeconds;

    stopAutoSendObserver();
    $('#sendCountdown').remove();

    $('.sendTime').html(
        formatTimes(sendEpoch) +
        ' (<span id="sendCountdown" class="sendTimer" data-endtime="' + sendEpoch + '">-</span>)'
    );

    Timing.tickHandlers.timers.initTimers('sendTimer');

    if (autoSendEnabled) {
        startAutoSendObserver();
    }
}

function scheduleSend(sendEpoch) {
    clearTabCountdown();

    $('.sendTime').html(
        formatTimes(sendEpoch) +
        ' (<span id="sendCountdown" class="sendTimer" data-endtime="' + sendEpoch + '">-</span>)'
    );

    Timing.tickHandlers.timers.initTimers('sendTimer');

    if (autoSendEnabled) {
        startAutoSendObserver();
    }
}

function clearTabCountdown() {
    stopAutoSendObserver();
    $('.sendTimer').remove();
    $('.sendTime').html('-');
    document.title = "Stämme";
}

function startAutoSendObserver() {
    stopAutoSendObserver();
    let countdownElem = document.getElementById('sendCountdown');
    if (!countdownElem) return;

    autoSendObserver = new MutationObserver(function () {
        let text = countdownElem.textContent.trim();
        if (autoSendEnabled && text === "0:00:00") {
            stopAutoSendObserver();
            setTimeout(function () {
                let $btn = $('#troop_confirm_submit');
                if ($btn.length && $btn.is(':visible') && !$btn.prop('disabled')) {
                    $btn.click();
                    clearTabCountdown();
                }
            }, Math.random() * (600 - 400) + 400);
        }
    });
    autoSendObserver.observe(countdownElem, { childList: true, characterData: true, subtree: true });
}

function stopAutoSendObserver() {
    if (autoSendObserver) {
        autoSendObserver.disconnect();
        autoSendObserver = null;
    }
}

function isVisible($el) {
    return $el.length > 0 && $el.is(':visible');
}

const observer = new MutationObserver(function () {
    const $submit = $('#troop_confirm_submit');
    if (isVisible($submit)) {
        initCommandUI();
    } else {
        sendTimeInit = false;
        clearTabCountdown();
    }
});

observer.observe(document.body, { childList: true, subtree: true });


function tryInitConfirmEnhancer(attempts = 0) {
    const $submit = $('#troop_confirm_submit');
    if (isVisible($submit)) {
        initCommandUI();
        console.log("Confirm Enhancer gestartet (Fallback)");
        return;
    }

    if (attempts < 10) {
        setTimeout(() => tryInitConfirmEnhancer(attempts + 1), 300);
    } else {
        console.warn("Confirm Enhancer konnte nicht initialisiert werden.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    tryInitConfirmEnhancer();
});

