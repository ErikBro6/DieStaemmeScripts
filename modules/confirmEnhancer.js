console.log("aha");

let sendTimeInit = false;      // Flag zur Initialisierung
let countdownInterval = null;  // Für den Tab-Countdown

function formatTimes(e) {
    function t(e) {
        for (var t = "" + e; t.length < 2;) t = "0" + t;
        return t;
    }
    var n = new Date(1e3 * e);
    return t(n.getDate()) + "." + t(n.getMonth() + 1) + " " + t(n.getHours()) + ":" + t(n.getMinutes()) + ":" + t(n.getSeconds());
}

function formatCountdown(sec) {
    if (sec < 0) return '0:00';
    let m = Math.floor(sec / 60);
    let s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
}

function clearTabCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    document.title = "Stämme"; // Oder Wunschtitel
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

                $('form[action*="action=command"]').find('table').first()
                    .css('float', 'left')
                    .find('tr').last().after('<tr><td>Abschick Counter:</td><td class="sendTime">-</td>')
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

    // Vorherigen Tab-Countdown stoppen
    clearTabCountdown();

    // Neuer, präziser Countdown + Autoklick
countdownInterval = setInterval(function() {
    let now = Math.ceil(Date.now() / 1000); // <- das ist der entscheidende Unterschied!
    let left = sendTime - now;
    document.title = "⏰ Abschick in " + formatCountdown(left >= 0 ? left : 0);

    if (now >= sendTime) {
        clearTabCountdown();
        let $btn = $('#troop_confirm_submit');
        if ($btn.length && $btn.is(':visible') && !$btn.prop('disabled')) {
            $btn.click();
        }
    }
}, 100); // 100ms Takt


    // Sofortiger Startwert im Titel
    let now = Math.floor(Date.now() / 1000);
    let left = sendTime - now;
    document.title = "⏰ Abschick in " + formatCountdown(left);

    $this.closest('table').find('td').css('background-color', '');
    $this.find('td').css('background-color', '#FFF68F');
    $('.sendTime').html(
        formatTimes(sendTime) + ' (<span class="sendTimer" data-endtime="' + sendTime + '"></span>)'
    );
    Timing.tickHandlers.timers.initTimers('sendTimer');
}).filter(function () {
                        return $('img[src*="/return_"], img[src*="/back.png"]', this).length > 0;
                    }).remove();

                $('.widget-command-timer').addClass('timer');
                Timing.tickHandlers.timers.initTimers('widget-command-timer');
            } else {
                UI.ErrorMessage('Keine Befehle gefunden');
                clearTabCountdown();
            }
        });
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
