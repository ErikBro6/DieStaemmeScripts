(function () {
    console.log("hello");
    'use strict';

    const fmt = (n) => n.toLocaleString('de-DE');

    function init() {
        const table = document.getElementById('village_list');
        if (!table) return;

        if (!table.querySelector('thead tr.sum')) {
            const tr = document.createElement('tr');
            tr.className = 'sum';
            table.querySelector('thead').appendChild(tr);
        }

        table.addEventListener('input', update);
        table.addEventListener('change', update);

        update();
    }

    function update() {
        let wood = 0, stone = 0, iron = 0;

        $('#village_list tbody input[name="select-village"]:checked').each(function () {
            const row = $(this).closest('tr');

            row.find('input[name^="resource["]').each(function () {
                const v = parseInt(this.value || 0, 10);
                if (this.name.includes('[wood]')) wood += v;
                if (this.name.includes('[stone]')) stone += v;
                if (this.name.includes('[iron]')) iron += v;
            });
        });

        $('#village_list thead tr.sum').html(`
            <th>Summe</th>
            <th></th>
            <th><span class="res wood"></span>${fmt(wood)}</th>
            <th><span class="res stone"></span>${fmt(stone)}</th>
            <th><span class="res iron"></span>${fmt(iron)}</th>
            <th colspan="3"></th>
        `);
    }

    const wait = setInterval(() => {
        if (document.getElementById('village_list')) {
            clearInterval(wait);
            init();
        }
    }, 100);
})();
