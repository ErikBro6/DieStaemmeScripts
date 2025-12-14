// ==UserScript==
// @name         DS Inc Observer Auto-Rename (DSGuards)
// @namespace    https://die-staemme.de/
// @version      1.2
// @description  Beobachtet Inc-Counter, lädt gepaced neu und benennt Angriffe bot-sicher um
// @match        https://*.die-staemme.de/game.php*screen=overview_villages*mode=incomings*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const { DSGuards } = window;
    if (
        !DSGuards ||
        !DSGuards.guardAction ||
        !DSGuards.gateTimeout
    ) {
        console.warn('[DS Inc Auto-Rename] DSGuards nicht verfügbar – Script deaktiviert.');
        return;
    }

    const { guardAction, gateTimeout } = DSGuards;

    const FLAG = 'ds_inc_do_rename';

    const JITTER = (base, spread = 300) => {
        const half = spread / 2;
        return Math.max(0, base + (Math.random() * spread - half));
    };

    /* ------------------------------------------------------------------
       PHASE 2 – Nach Reload: Select All + Rename (bot-sicher)
    ------------------------------------------------------------------ */
    if (sessionStorage.getItem(FLAG)) {
        sessionStorage.removeItem(FLAG);

        const form = document.getElementById('incomings_form');
        if (!form) return;

        const selectAll = form.querySelector('#select_all, input.selectAll');
        const renameBtn = form.querySelector('input[type="submit"][name="label"]');

        if (!selectAll || !renameBtn) return;

        gateTimeout(() => {
            guardAction(() => {
                selectAll.click();
            });

            gateTimeout(() => {
                guardAction(() => {
                    renameBtn.click();
                });
            }, JITTER(700, 400));
        }, JITTER(600, 400));

        return;
    }

    /* ------------------------------------------------------------------
       PHASE 1 – MutationObserver auf Inc-Counter
    ------------------------------------------------------------------ */
    const counter = document.getElementById('incomings_amount');
    if (!counter) return;

    let lastValue = counter.textContent.trim();

    const observer = new MutationObserver(() => {
        const currentValue = counter.textContent.trim();
        if (currentValue === lastValue) return;

        lastValue = currentValue;

        observer.disconnect();

        sessionStorage.setItem(FLAG, '1');

        gateTimeout(() => {
            guardAction(() => {
                location.reload();
            });
        }, JITTER(800, 600));
    });

    observer.observe(counter, {
        childList: true,
        characterData: true,
        subtree: true
    });
})();
