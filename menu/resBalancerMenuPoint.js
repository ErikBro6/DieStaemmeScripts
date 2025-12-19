(function () {
    'use strict';

    function addResBalancerMenu() {
        const menuTable = document.querySelector('.vis.modemenu tbody');
        if (!menuTable) return;

        // schon vorhanden → nix tun
        if (document.getElementById('id_resource_balancer')) return;

        const newRow = document.createElement('tr');
        newRow.id = 'id_resource_balancer';
        newRow.innerHTML = `
            <td style="min-width:80px">
                <a href="/game.php?village=${game_data.village.id}&screen=market&mode=resource_balancer">
                    Resource Balancer
                </a>
            </td>
        `;

        menuTable.appendChild(newRow);
    }

    // initial
    addResBalancerMenu();

    // Re-Renders abfangen
    const observer = new MutationObserver(() => {
        addResBalancerMenu();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
