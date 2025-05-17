// ==UserScript==
// @name         SpeckMichs Auto Recruiter v1
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatisiert Masseneinheitenrekrutierung mit UI-Kontrolle in Die Stämme (DE)
// @author       SpeckMich
// @match        https://*.die-staemme.de/game.php?village=*&screen=train&mode=*
// @grant        none
// @icon         https://www.google.com/s2/favicons?sz=64&domain=die-staemme.de
// @updateURL    https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/massRecruiter.user.js
// @downloadURL  https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/massRecruiter.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    let recruitingEnabled = JSON.parse(localStorage.getItem("recruitingEnabled")) ?? false;
    let recruitDelaySeconds = parseInt(localStorage.getItem("recruitDelaySeconds")) || 5;
    let recruitInterval = null;

    function createControlPanel() {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '120px';
        container.style.right = '20px';
        container.style.zIndex = 9999;
        container.style.backgroundColor = '#f9f9f9';
        container.style.padding = '10px';
        container.style.border = '1px solid #ccc';
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 0 5px rgba(0,0,0,0.2)';
        container.style.fontSize = '14px';

        const toggleButton = document.createElement('button');
        toggleButton.textContent = recruitingEnabled ? "Recruiting: ON" : "Recruiting: OFF";
        toggleButton.style.padding = '8px 12px';
        toggleButton.style.backgroundColor = recruitingEnabled ? '#4CAF50' : '#f44336';
        toggleButton.style.color = 'white';
        toggleButton.style.border = 'none';
        toggleButton.style.borderRadius = '5px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.fontWeight = 'bold';
        toggleButton.style.marginBottom = '10px';

        toggleButton.addEventListener('click', () => {
            recruitingEnabled = !recruitingEnabled;
            localStorage.setItem("recruitingEnabled", JSON.stringify(recruitingEnabled));
            toggleButton.textContent = recruitingEnabled ? "Recruiting: ON" : "Recruiting: OFF";
            toggleButton.style.backgroundColor = recruitingEnabled ? '#4CAF50' : '#f44336';

            if (recruitingEnabled) {
                startRecruiting();
            } else {
                stopRecruiting();
            }
        });

        const delayLabel = document.createElement('label');
        delayLabel.textContent = 'Delay (s): ';
        delayLabel.style.marginRight = '5px';

        const delayInput = document.createElement('input');
        delayInput.type = 'number';
        delayInput.value = recruitDelaySeconds;
        delayInput.min = 1;
        delayInput.style.width = '50px';

        delayInput.addEventListener('change', () => {
            recruitDelaySeconds = parseInt(delayInput.value) || 5;
            localStorage.setItem("recruitDelaySeconds", recruitDelaySeconds.toString());
            if (recruitingEnabled) {
                stopRecruiting();
                startRecruiting();
            }
        });

        container.appendChild(toggleButton);
        const lineBreak = document.createElement('br');
        container.appendChild(lineBreak);
        container.appendChild(delayLabel);
        container.appendChild(delayInput);

        document.body.appendChild(container);
    }

    async function clickRecruitButtons() {
        const fillButtons = document.querySelectorAll('input[type="button"][value="Truppen einfügen"]');
        if (fillButtons.length > 0) {
            fillButtons.forEach(btn => btn.click());

            await new Promise(resolve => setTimeout(resolve, 500)); // kurz warten

            const recruitButtons = document.querySelectorAll('input[type="submit"][value="Rekrutieren"]');
            recruitButtons.forEach(btn => btn.click());

            console.log("✅ Rekrutierung ausgeführt.");
        } else {
            console.log("⚠️ Keine Rekrutierungsfelder gefunden.");
        }
    }

    function startRecruiting() {
        if (!recruitInterval) {
            clickRecruitButtons(); // einmal direkt ausführen
            recruitInterval = setInterval(() => {
                if (recruitingEnabled) {
                    clickRecruitButtons();
                }
            }, recruitDelaySeconds * 1000);
            console.log("🔁 Recruiting gestartet.");
        }
    }

    function stopRecruiting() {
        clearInterval(recruitInterval);
        recruitInterval = null;
        console.log("⛔ Recruiting gestoppt.");
    }

    function tryReturn() {
        const timeout = localStorage.getItem("recruitDelaySeconds")*1000;
        const backLink = document.querySelector('a[href*="screen=train"][href*="mode=mass"][href*="page=0"]');
        if (backLink) {
           setTimeout(() => {
             backLink.click();
           }, timeout); // 10 seconds = 10000 ms
        } else {

            setTimeout(tryReturn, 100);
        }
    }

    createControlPanel();
    window.addEventListener('load', () => {
        if (recruitingEnabled) {
            startRecruiting();
            tryReturn();
        }
    });

})();
