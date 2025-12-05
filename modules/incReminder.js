// ==UserScript==
// @name         Inc DC Reminder via Webhook (DS-Tools Version)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Sendet Discord-Nachricht bei Inc-Erhöhung. Webhook wird aus DS-Tools Settings gelesen.
// @author       SpeckMich
// @match        https://*.die-staemme.de/*
// ==/UserScript==

(function () {
    'use strict';

    let intervalId = null;
    let intervalTime = 10000; // 10 Sekunden
    let lastSentValue = 0;

    //
    // 🔥 Webhook direkt aus DS-Tools Settings
    //
    function getWebhook() {
        return window?.DS_USER_SETTINGS?.incWebhookURL?.trim() || "";
    }

function getSpielerName() {
    try {
        // Profil-Menü → Name steht in der ersten Zeile des Dropdowns
        const el = document.querySelector(
            'td.menu-column-item a[href*="screen=info_player"]'
        );
        if (el) return el.textContent.trim();

        // Fallback (falls Dropdown nicht gerendert wurde)
        const el2 = document.querySelector('#topdisplay .menu_column a[href*="info_player"]');
        if (el2) return el2.textContent.trim();

        return "Unbekannt";
    } catch (e) {
        return "Unbekannt";
    }
}

function getWorld() {
    const m = location.hostname.match(/^(.*?)\.die-staemme\.de$/);
    return m ? m[1] : "Unbekannte Welt";
}


function sendToDiscord(value) {
    const webhookURL = getWebhook();
    if (!webhookURL) {
        console.warn("[IncReminder] Kein Webhook gesetzt.");
        return;
    }

    const spielerName = getSpielerName();
    const world = getWorld(); // 🌍 direkt aus URL

    const payload = {
        content: `🚨 Neuer Inc auf **${spielerName}** (${world}) – Gesamtanzahl: **${value}**`,
        username: "Incs-Bot",
        avatar_url: "https://i.imgur.com/4M34hi2.png"
    };

    fetch(webhookURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).catch(() => {});
}


//
// persistent lastSentValue
//
function getLast() {
    return parseInt(localStorage.getItem("ds_inc_last") || "0", 10);
}

function setLast(v) {
    localStorage.setItem("ds_inc_last", String(v));
    lastSentValue = v;
}

//
// INC checker — jetzt spamfrei
//
function checkValue() {
    const p = document.getElementById("incomings_amount");
    if (!p) return;

    const x = parseInt(p.textContent.trim(), 10);
    if (isNaN(x)) return;

    const last = getLast();

    // ↑ INC steigt → senden
    if (x > last) {
        sendToDiscord(x);
        setLast(x);
    }

    // ↓ INC sinkt (Angriff abgeschlossen) → neuen Basiswert setzen
    else if (x < last) {
        setLast(x);
    }
}


    //
    // 🔥 Intervall starten
    //
    function startInterval() {
        const webhookURL = getWebhook();
        if (!webhookURL) {
            console.warn("[IncReminder] Kein Webhook gesetzt.");
            return;
        }

        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(checkValue, intervalTime);

        console.log("[IncReminder] Intervall gestartet:", intervalTime / 1000, "Sekunden");
    }

    //
    // 🔥 Intervall stoppen
    //
    function stopInterval() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
            console.log("[IncReminder] Intervall gestoppt.");
        }
    }

    //
    // 🔥 Intervall ändern
    //
    function changeIntervalTime() {
        const newTimeSec = prompt("Neues Intervall in Sekunden:", intervalTime / 1000);
        if (newTimeSec !== null) {
            const parsed = parseInt(newTimeSec, 10);
            if (!isNaN(parsed) && parsed > 0) {
                intervalTime = parsed * 1000;
                if (intervalId) startInterval();
            }
        }
    }

    //
    // 🔥 Automatisch starten, sobald DS-Tools geladen hat
    //
    const start = () => {
        if (!getWebhook()) return;
        startInterval();
    };

    //
    // DS-Tools benötigt ~100–300ms, um DS_USER_SETTINGS zu setzen
    //
    const waitForDSTools = setInterval(() => {
        if (window.DS_USER_SETTINGS) {
            clearInterval(waitForDSTools);
            start();
        }
    }, 100);

})();
