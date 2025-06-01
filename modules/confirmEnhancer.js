console.log("Production Skript");

let sendTimeInit = false;      // Flag zur Initialisierung
let autoSendEnabled = false;   // Default aus
let autoSendObserver = null;   // Für DOM-Observer
let sendInterval = null;

function formatTimes(e) {
    function t(e) {
        for (var t = "" + e; t.length < 2;) t = "0" + t;
        return t;
    }
    var n = new Date(1e3 * e);
    return t(n.getDate()) + "." + t(n.getMonth() + 1) + " " + t(n.getHours()) + ":" + t(n.getMinutes()) + ":" + t(n.getSeconds());
}

function formatCountdown(sec) {
    if (sec < 0) return '0:00:00';
    let h = Math.floor(sec / 3600);
    let m = Math.floor((sec % 3600) / 60);
    let s = sec % 60;
    return h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}


function initCommandUI() {
    if (
        (game_data.screen == 'map' || game_data.screen == 'place') &&
        $('#place_confirm_units').length > 0 &&
        $('.sendTime').length == 0 &&
        !sendTimeInit
    ) {
        sendTimeInit = true;
        $.get($('.village_anchor').first().find('a').first().attr('href'), function (html) {
            var $cc = $(html).find('.commands-container');
            if ($cc.length > 0) {
                var w = (game_data.screen == 'map')
                    ? '100%'
                    : ($('#content_value').width() - $('form[action*="action=command"]').find('table').first().width() - 10) + 'px';

                // Abschick Counter einfügen
                $('form[action*="action=command"]').find('table').first()
                    .css('float', 'left')
                    .find('tr').last().after('<tr><td>Abschick Counter:</td><td class="sendTime">-</td>');

                // Toggle-Button einfügen, falls noch nicht vorhanden
                if ($('#autoSendToggle').length === 0) {
                
                    $('.sendTime').after('<input type="text" id="arrivalTimeInput" placeholder="Ankunft (YYYY-MM-DD HH:MM:SS)" style="margin-left:10px;width:200px;"> <button id="startArrivalSend" type="button">Auf Ankunft senden</button>');

                    $('.sendTime').parent().append(
                        '<button id="autoSendToggle" type="button" style="margin-left:10px;">Auto-Senden: AUS</button>'
                    );
                    $('#autoSendToggle')
                        .css('background', '#f44336')
                        .css('color', '#fff');
                    $('#autoSendToggle').on('click', function() {
                        autoSendEnabled = !autoSendEnabled;
                        $(this)
                            .text('Auto-Senden: ' + (autoSendEnabled ? 'AN' : 'AUS'))
                            .css('background', autoSendEnabled ? '#4caf50' : '#f44336')
                            .css('color', '#fff');
                    });
                }

                $('form[action*="action=command"]').find('table').first()
                    .closest('table').after($cc.find('table').parent().html() + '<br><div style="clear:both;"></div>')
                    .next().css({
                        'float': 'right',
                        'width': w,
                        'display': 'block',
                        'max-height': $('form[action*="action=command"]').find('table').first().height(),
                        'overflow': 'scroll'
                    }).find('tr.command-row').on('click', function () {
                        var $this = $(this);

                        var durationText = $('form[action*="action=command"]').find('table')
                            .find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")').next().text().trim();

                        var duration = durationText.split(':');
                        var h = parseInt(duration[0], 10) || 0;
                        var m = parseInt(duration[1], 10) || 0;
                        var s = parseInt(duration[2], 10) || 0;
                        var durationInSeconds = h * 3600 + m * 60 + s;

                        var endTime = parseInt($this.find('span.timer').data('endtime'), 10);

                        if (isNaN(endTime) || durationInSeconds === 0) {
                            $('.sendTime').html('Keine gültigen Zeitdaten');
                            clearTabCountdown();
                            return;
                        }

                        var sendTime = endTime - durationInSeconds;

                        // Vorherigen Observer stoppen
                        clearTabCountdown();

                        // Sofortiger Startwert im Titel
                        let now = Math.floor(Date.now() / 1000);
                        let left = sendTime - now;
                        document.title = "⏰ Abschick in " + formatCountdown(left);

                        $this.closest('table').find('td').css('background-color', '');
                        $this.find('td').css('background-color', '#FFF68F');
                        $('.sendTime').html(
                            formatTimes(sendTime) + ' (<span class="sendTimer" data-endtime="' + sendTime + '">-</span>)'
                        );
                        Timing.tickHandlers.timers.initTimers('sendTimer');

                        // Richtiges <span> selektieren (exakt wie im DOM)
                        let sendTimerElem = $('.sendTime .sendTimer')[0];
                        if (sendTimerElem) {
                            autoSendObserver = new MutationObserver(function(mutations) {
                                mutations.forEach(function(mutation) {
                                    console.log('Mutation:', mutation, sendTimerElem.textContent); // <--- Debug!
                                    // Korrekt auf "0:00:00" prüfen
                                    if (
                                        autoSendEnabled &&
                                        (sendTimerElem.textContent.trim() === "0:00:00")
                                    ) {
                                        let $btn = $('#troop_confirm_submit');
                                        if ($btn.length && $btn.is(':visible') && !$btn.prop('disabled')) {
                                            $btn.click();
                                            clearTabCountdown();
                                        }
                                    }
                                });
                            });
                            autoSendObserver.observe(sendTimerElem, { childList: true, characterData: true, subtree: true });
                        }
                    }).filter(function () {
                        return $('img[src*="/return_"], img[src*="/back.png"]', this).length > 0;
                    }).remove();

                $('.widget-command-timer').addClass('timer');
                Timing.tickHandlers.timers.initTimers('widget-command-timer');
                $('#startArrivalSend').on('click', function() {
    let arrivalStr = $('#arrivalTimeInput').val();
    if (!arrivalStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        alert('Ungültiges Zeitformat');
        return;
    }
    let arrivalTime = new Date(arrivalStr.replace(' ', 'T')); // ISO-Format hack
    let arrivalEpoch = Math.floor(arrivalTime.getTime() / 1000);

    // Dauer holen (wie bisher)
    let durationText = $('form[action*="action=command"]').find('table')
        .find('td:contains("Dauer:"),td:contains("Duur:"),td:contains("Duration:")').next().text().trim();
    let [h, m, s] = durationText.split(':').map(e => parseInt(e, 10) || 0);
    let durationInSeconds = h * 3600 + m * 60 + s;

    let sendEpoch = arrivalEpoch - durationInSeconds;

    if (sendEpoch < Math.floor(Date.now() / 1000)) {
        alert('Abschickzeit liegt in der Vergangenheit!');
        return;
    }

    scheduleSend(sendEpoch);
});

            } else {
                UI.ErrorMessage('Keine Befehle gefunden');
                clearTabCountdown();
            }
        });
    }
}
function scheduleSend(sendEpoch) {
    clearTabCountdown();
    sendInterval = setInterval(function() {
        let now = Math.floor(Date.now() / 1000);
        let left = sendEpoch - now;
        document.title = "⏰ Abschick in " + formatCountdown(left);

        if (left <= 0) {
            clearInterval(sendInterval);
            sendInterval = null;
            let $btn = $('#troop_confirm_submit');
            if ($btn.length && $btn.is(':visible') && !$btn.prop('disabled')) {
                $btn.click();
                clearTabCountdown();
            }
        }
    }, 200);
}
function clearTabCountdown() {
    if (sendInterval !== null) {
        clearInterval(sendInterval);
    }
    sendInterval = null;
    if (autoSendObserver) {
        autoSendObserver.disconnect();
        autoSendObserver = null;
    }
    document.title = "Stämme";
}



function isVisible($el) {
    return $el.length > 0 && $el.is(':visible');
}

const observer = new MutationObserver(function () {
    const $submit = $('#troop_confirm_submit');
    if (isVisible($submit)) {
        initCommandUI();
    } else {
        sendTimeInit = false; // Flag zurücksetzen, falls das Element wieder entfernt wird
            clearTabCountdown();

        
    }
});

// Beobachte body dauerhaft
observer.observe(document.body, { childList: true, subtree: true });

// Direkt beim Laden prüfen
if (isVisible($('#troop_confirm_submit'))) {
    initCommandUI();
}
