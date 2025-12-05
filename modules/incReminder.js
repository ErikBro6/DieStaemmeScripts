// modules/incReminder.js
(function () {
    'use strict';

    let intervalId = null;
    let intervalTime = 10000;
    let lastSentValue = 0;

    function getWebhook() {
        return window.DS_USER_SETTINGS?.incWebhookURL?.trim() || "";
    }

    function getSpielerName() {
        const el = document.querySelector('a[href*="screen=ranking"]');
        return el ? el.textContent.trim() : "Unbekannt";
    }

    function sendToDiscord(value) {
        const webhookURL = getWebhook();
        if (!webhookURL) return;

        fetch(webhookURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: `🚨 Neuer Inc – Gesamtanzahl: ${value}`,
                username: "DS Inc Bot",
            })
        })
        .catch(() => {});
    }

    function checkValue() {
        const p = document.getElementById("incomings_amount");
        if (!p) return;

        const x = parseInt(p.textContent.trim(), 10);
        if (isNaN(x)) return;

        if (x > lastSentValue) {
            sendToDiscord(x);
            lastSentValue = x;
        } else if (x < lastSentValue) {
            lastSentValue = x;
        }
    }

    function startInterval() {
        const webhookURL = getWebhook();
        if (!webhookURL) return;

        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(checkValue, intervalTime);
    }

    // Auto-Start in allen normalen Game-Screens
    setTimeout(() => {
        if (getWebhook()) startInterval();
    }, 1000);

})();
