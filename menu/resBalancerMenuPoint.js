// Hole das Tabellen-Element
const menuTable = document.querySelector('.vis.modemenu tbody');

// Erstelle den neuen Menüpunkt als <tr>
const newRow = document.createElement('tr');
newRow.id = "id_resource_balancer";
newRow.innerHTML = `
  <td style="min-width: 80px">
    <a href="/game.php?village=17692&screen=market&mode=resource_balancer">
      Resource Balancer
    </a>
  </td>
`;

// Füge den Menüpunkt z.B. ans Ende an
menuTable.appendChild(newRow);
