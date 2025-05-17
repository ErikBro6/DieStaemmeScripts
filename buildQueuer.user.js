// ==UserScript==
// @name         SpeckMichs Auto Builder
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatischer Gebäudeausbau mit GUI, Intervall, Auto-Reload und persistenter Steuerung
// @author       SpeckMich
// @match        https://des1.die-staemme.de/game.php?village=*&screen=overview_villages*
// @grant        none
// @icon         https://www.google.com/s2/favicons?sz=64&domain=die-staemme.de
// @updateURL    https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/buildQueuer.user.js
// @downloadURL  https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/master/buildQueuer.user.js
// ==/UserScript==

(function () {
    'use strict';

    const BUILDINGS = [
        'main', 'barracks', 'stable', 'garage', 'snob',
        'smith', 'market', 'wood', 'stone', 'iron',
        'farm', 'storage', 'place', 'wall'
    ];

    let autoBuildEnabled = JSON.parse(localStorage.getItem("autoBuildEnabled")) ?? false;
    let buildDelaySeconds = parseInt(localStorage.getItem("buildDelaySeconds")) || 30;

    function getSelectedPriorities() {
        const selected = [];
        for (let i = 0; i < 16; i++) {
            const val = localStorage.getItem(`building_priority_${i}`);
            if (val && BUILDINGS.includes(val)) {
                selected.push(val);
            }
        }
        return selected;
    }

    async function Sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function processVillageRow(row, priorities) {
        const lastCell = row.querySelector(':scope > td:last-child');
        const currentQueue = lastCell?.querySelector(':scope > ul')?.children.length || 0;
        if (currentQueue >= 5) return;

        for (const building of priorities) {
            const cell = row.querySelector(`:scope > .b_${building}`);
            const button = cell?.querySelector(':scope > a') || null;
            if (button) {
                button.click();
                await Sleep(Math.floor(Math.random() * 500 + 100));
                break;
            }
        }
    }

    async function runBuildCheck() {
        const buildMenu = [...document.querySelectorAll('#overview_menu td')]
            .find(td => td.textContent.includes('Gebäude'));
        if (!buildMenu || !buildMenu.classList.contains('selected')) return;

        const toggleBtn = document.getElementById('get_all_possible_build');
        const alreadyVisible = document.querySelector('.show_buildings_row');
        if (toggleBtn && !alreadyVisible) toggleBtn.click();

        await Sleep(Math.floor(Math.random() * 1000 + 300));

        const table = document.getElementById('villages');
        if (!table) return;

        const rows = table.querySelectorAll(':scope > tr');
        const priorities = getSelectedPriorities();
        for (const row of rows) {
            await processVillageRow(row, priorities);
        }
    }

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
        container.style.maxHeight = '90vh';
        container.style.overflowY = 'auto';

        const toggleButton = document.createElement('button');
        toggleButton.textContent = autoBuildEnabled ? "Auto Build: ON" : "Auto Build: OFF";
        toggleButton.style.backgroundColor = autoBuildEnabled ? '#4CAF50' : '#f44336';
        toggleButton.style.width = '100%';
        toggleButton.style.padding = '8px';
        toggleButton.style.color = 'white';
        toggleButton.style.border = 'none';
        toggleButton.style.borderRadius = '5px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.fontWeight = 'bold';
        toggleButton.style.marginBottom = '10px';

        toggleButton.addEventListener('click', () => {
            autoBuildEnabled = !autoBuildEnabled;
            localStorage.setItem("autoBuildEnabled", JSON.stringify(autoBuildEnabled));
            toggleButton.textContent = autoBuildEnabled ? "Auto Build: ON" : "Auto Build: OFF";
            toggleButton.style.backgroundColor = autoBuildEnabled ? '#4CAF50' : '#f44336';

            if (autoBuildEnabled) {
                window.location.href = window.location.href;
            }
        });

        const delayLabel = document.createElement('label');
        delayLabel.textContent = 'Delay (s): ';
        delayLabel.style.marginRight = '5px';

        const delayInput = document.createElement('input');
        delayInput.type = 'number';
        delayInput.value = buildDelaySeconds;
        delayInput.min = 5;
        delayInput.style.width = '60px';

        delayInput.addEventListener('change', () => {
            buildDelaySeconds = parseInt(delayInput.value) || 30;
            localStorage.setItem("buildDelaySeconds", buildDelaySeconds.toString());
        });

        container.appendChild(toggleButton);
        container.appendChild(document.createElement('br'));
        container.appendChild(delayLabel);
        container.appendChild(delayInput);

        const title = document.createElement('div');
        title.textContent = 'Baupriorität';
        title.style.fontWeight = 'bold';
        title.style.margin = '8px 0 4px 0';
        container.appendChild(title);

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'auto auto';
        grid.style.columnGap = '8px';
        grid.style.rowGap = '4px';

        for (let i = 0; i < 16; i++) {
            const label = document.createElement('label');
            label.textContent = `Prio ${i + 1}:`;
            label.style.textAlign = 'right';

            const select = document.createElement('select');
            select.style.width = '100px';

            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '--';
            select.appendChild(emptyOpt);

            BUILDINGS.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b;
                opt.textContent = b;
                select.appendChild(opt);
            });

            const saved = localStorage.getItem(`building_priority_${i}`);
            if (saved) select.value = saved;

            select.addEventListener('change', () => {
                localStorage.setItem(`building_priority_${i}`, select.value);
            });

            grid.appendChild(label);
            grid.appendChild(select);
        }

        container.appendChild(grid);
        document.body.appendChild(container);
    }

    createControlPanel();

    (async () => {
        buildDelaySeconds = parseInt(localStorage.getItem("buildDelaySeconds")) || 30;
        autoBuildEnabled = JSON.parse(localStorage.getItem("autoBuildEnabled")) ?? false;

        console.log("AutoBuild aktiv:", autoBuildEnabled);

        if (!autoBuildEnabled) return;

        await runBuildCheck();

        await Sleep(buildDelaySeconds * 1000);
        console.log(`[AutoBuild] Forcing reload after ${buildDelaySeconds}s`);
        window.location.reload();
    })();

})();