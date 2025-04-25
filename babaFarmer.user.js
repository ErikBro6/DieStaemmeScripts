// ==UserScript==
// @name         Eriks Baba Farmer v1
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Automates farming of nearby barbarian villages in Tribal Wars with toggle button
// @author       SpeckMich
// @match        https://*.die-staemme.de/game.php*
// @grant        GM.xmlHttpRequest
// @connect      *.die-staemme.de
// @icon         https://www.google.com/s2/favicons?sz=64&domain=die-staemme.de
// @updateURL    https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/babaFarmer.user.js
// @downloadURL  https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/babaFarmer.user.js
// @require      https://gist.githubusercontent.com/BrockA/2625891/raw/waitForKeyElements.js
// @run-at       document-idle
// ==/UserScript==

(async function () {
    'use strict';

    let unitsToSend = JSON.parse(localStorage.getItem("unitsToSend")) || {
        spear: 0,
        light: 0,
        knight: 0
    };

    const delayBetweenAttacks = 500;
    let radius = parseInt(localStorage.getItem("farmingRadius")) || 5;
    const farmingIntervalDelay = 500;

    let farmingEnabled = JSON.parse(localStorage.getItem("farmingEnabled")) ?? true;
    let farmingInterval = null;

    function getWorld() {
        const hostname = window.location.hostname;
        const subdomain = hostname.split('.')[0];
        return subdomain;
    }
function createUnitsInputPanel() {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '150px';
    container.style.right = '20px';
    container.style.zIndex = 9999;
    container.style.backgroundColor = '#f9f9f9';
    container.style.padding = '10px';
    container.style.border = '1px solid #ccc';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 0 5px rgba(0,0,0,0.2)';
    container.style.fontSize = '14px';
    container.style.maxHeight = '400px';
    container.style.overflowY = 'auto';

    const title = document.createElement('div');
    title.textContent = 'Units to Send';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '6px';
    container.appendChild(title);

    for (const unit in unitsToSend) {
        const row = document.createElement('div');
        row.style.marginBottom = '4px';

        const label = document.createElement('label');
        label.textContent = unit;
        label.style.marginRight = '5px';

        const input = document.createElement('input');
        input.type = 'number';
        input.value = unitsToSend[unit];
        input.style.width = '50px';
        input.min = 0;

        input.addEventListener('change', () => {
            unitsToSend[unit] = parseInt(input.value) || 0;
            localStorage.setItem("unitsToSend", JSON.stringify(unitsToSend));
        });

        row.appendChild(label);
        row.appendChild(input);
        container.appendChild(row);
    }

    const radiusTitle = document.createElement('div');
    radiusTitle.textContent = 'Farm Radius';
    radiusTitle.style.marginTop = '10px';
    radiusTitle.style.fontWeight = 'bold';
    container.appendChild(radiusTitle);

    const radiusInput = document.createElement('input');
    radiusInput.type = 'number';
    radiusInput.value = radius;
    radiusInput.min = 1;
    radiusInput.style.width = '50px';
    radiusInput.style.marginTop = '5px';

    radiusInput.addEventListener('change', () => {
        radius = parseInt(radiusInput.value) || 5;
        localStorage.setItem("farmingRadius", radius.toString());
    });

    container.appendChild(radiusInput);

    document.body.appendChild(container);
}



    function getStartCoordFromHeader() {
        const headerText = document.querySelector('#menu_row2 b')?.textContent;
        const match = headerText?.match(/\((\d+)\|(\d+)\)/);
        if (!match) throw new Error('Start coordinates not found!');
        return { x: parseInt(match[1]), y: parseInt(match[2]) };
    }

    function getDistance(x1, y1, x2, y2) {
        return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
    }

    function fillUnitsAndSend(coords) {
        console.log("Attacking:", coords);

        waitForKeyElements('input[name="x"]', xInput => xInput.val(coords.x));
        waitForKeyElements('input[name="y"]', yInput => yInput.val(coords.y));

        for (const [unit, amount] of Object.entries(unitsToSend)) {
            waitForKeyElements(`input[name="${unit}"]`, unitInput => unitInput.val(amount));
        }

        let nextPosition = parseInt(localStorage.getItem("position")) + 1;
        localStorage.setItem("position", nextPosition);

        waitForKeyElements('.village-info', infoSpan => {
            const ownerInfo = infoSpan.text();
            if (ownerInfo.includes('Besitzer: Barbaren')) {
                waitForKeyElements('#target_attack', attackButton => attackButton.click());
            } else {
                console.log("Actually Spieler!");
                waitForKeyElements('img.village-delete', deleteIcon => {
                    deleteIcon.click();
                    setTimeout(() => location.reload(), 250);
                });
            }
        });
    }

    async function getAllVillages() {
        const world = getWorld();
        const url = `https://${world}.die-staemme.de/map/village.txt`;
        console.log("Fetching:", url);

        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: "GET",
                url: url,
                onload: function (response) {
                    const lines = response.responseText.trim().split('\n');
                    const barbarianVillages = [];

                    lines.forEach(line => {
                        const fields = line.split(',');
                        if (fields.length >= 6) {
                            const [id, name, x, y, owner_id, points] = fields;
                            if (owner_id === '0') {
                                barbarianVillages.push({
                                    id: parseInt(id),
                                    name: decodeURIComponent(name),
                                    x: parseInt(x),
                                    y: parseInt(y),
                                    points: parseInt(points)
                                });
                            }
                        }
                    });

                    resolve(barbarianVillages);
                },
                onerror: function (error) {
                    console.error('Error fetching village data:', error);
                    reject(error);
                }
            });
        });
    }

    async function farmBarbarians() {
        const barbarianVillages = await getAllVillages();
        const { x: originX, y: originY } = getStartCoordFromHeader();

        const nearbyBarbarians = barbarianVillages.filter(village => {
            const distance = getDistance(originX, originY, village.x, village.y);
            return distance <= radius;
        });

        console.log('Nearby Barbarian Villages:', nearbyBarbarians);

        let position = parseInt(localStorage.getItem("position") || "0");
        if (position >= nearbyBarbarians.length) {
            position = 0;
        }

        localStorage.setItem("position", position.toString());
        const targetVillage = nearbyBarbarians[position];

        if (targetVillage) {
            fillUnitsAndSend({ x: targetVillage.x, y: targetVillage.y });
        } else {
            console.log("No valid target found at position", position);
        }
    }

    function startFarming() {
        if (!farmingInterval) {
            farmBarbarians();
            farmingInterval = setInterval(() => {
                if (farmingEnabled) {
                    farmBarbarians();
                }
            }, farmingIntervalDelay);
            console.log("Farming started.");
        }
    }

    function stopFarming() {
        clearInterval(farmingInterval);
        farmingInterval = null;
        console.log("Farming stopped.");
    }

    function createToggleButton() {
        const toggleButton = document.createElement('button');
        toggleButton.textContent = farmingEnabled ? "Farming: ON" : "Farming: OFF";
        toggleButton.style.position = 'fixed';
        toggleButton.style.top = '100px';
        toggleButton.style.right = '20px';
        toggleButton.style.zIndex = 9999;
        toggleButton.style.padding = '8px 12px';
        toggleButton.style.backgroundColor = farmingEnabled ? '#4CAF50' : '#f44336';
        toggleButton.style.color = 'white';
        toggleButton.style.border = 'none';
        toggleButton.style.borderRadius = '5px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.fontWeight = 'bold';

        toggleButton.addEventListener('click', () => {
            farmingEnabled = !farmingEnabled;
            localStorage.setItem("farmingEnabled", JSON.stringify(farmingEnabled));
            toggleButton.textContent = farmingEnabled ? "Farming: ON" : "Farming: OFF";
            toggleButton.style.backgroundColor = farmingEnabled ? '#4CAF50' : '#f44336';

            if (farmingEnabled) {
                startFarming();
            } else {
                stopFarming();
            }
        });

        document.body.appendChild(toggleButton);
    }

    window.addEventListener('load', () => {
        createToggleButton();
        createUnitsInputPanel();
        if (farmingEnabled) {
            startFarming();
        }
    });
})();
