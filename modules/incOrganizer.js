(function () {
  'use strict';

  const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const $ = win.jQuery;
  if (!$) return;

  const url = new URL(location.href);

  /*****************************************************************
   * CONFIG (wie gehabt)
   *****************************************************************/
  win.font_size = 8;
  win.attack_layout = 'column'; // column | line | nothing

  win.settings = {
    0:['/🟢+++','🟢', 'green', 'white'],
    1:['/🟡Nachdeffen','ND', 'yellow', 'black'],
    2:['/🔴rausstellen','raus!', 'dorange', 'black'],
    3:['/🟢---','leer', 'green', 'black'],
    4:['Unbekannt','🦄', 'white', 'white'],
    5:['/💩 tabben','💩', 'red', 'black'],
    6:['/🟢+++/Wall prüfen!','Wall prüfen!', 'green', 'black'],
    7:['/🔴---/Rausgestellte Def zurück!','Def zurück!', 'dorange', 'black'],
    8:['/Abbruch bei ','Abb', 'black', 'white'],
    9:['/Fake','FS', 'blue', 'black']
  };

  win.colors = {
    red:['#e20606', '#b70707'],
    green:['#31c908', '#228c05'],
    blue:['#0d83dd', '#0860a3'],
    yellow:['#ffd91c', '#e8c30d'],
    orange:['#ef8b10', '#d3790a'],
    lblue:['#22e5db', '#0cd3c9'],
    lime:['#ffd400', '#ffd400'],
    white:['#ffffff', '#dbdbdb'],
    black:['#000000', '#2b2b2b'],
    gray:['#adb6c6', '#828891'],
    dorange:['#ff0000', '#ff0000'],
    pink:['#ff69b4', '#ff69b4']
  };

  const buttonNames      = $.map(win.settings, o => o[0]);
  const buttonIcons      = $.map(win.settings, o => o[1]);
  const buttonColors     = $.map(win.settings, o => o[2]);
  const buttonTextColors = $.map(win.settings, o => o[3]);

  const getTop  = i => win.colors[buttonColors[i]]?.[0] || '#b69471';
  const getBot  = i => win.colors[buttonColors[i]]?.[1] || '#6c4d2d';
  const getFont = i => win.colors[buttonTextColors[i]]?.[0] || '#fff';

  /*****************************************************************
   * BUTTON SIZE FIX (nur auf screen=overview)
   *****************************************************************/
  const isOverviewScreen = url.searchParams.get('screen') === 'overview';
  const uiFont = isOverviewScreen ? 7 : (win.font_size || 8);

  function ensureCss() {
    if (document.getElementById('incOrganizerCss')) return;
    const style = document.createElement('style');
    style.id = 'incOrganizerCss';

    // kompakt auf overview
    // (keine Layout-Änderung, nur Button-Box kleiner)
    style.textContent = `
      .inc-org-btn{
        padding: 0 4px !important;
        line-height: 16px !important;
        height: 18px !important;
        min-height: 18px !important;
        margin-left: 2px !important;
        border-radius: 3px !important;
      }
    `;
    document.head.appendChild(style);
  }

  /*****************************************************************
   * HELPERS
   *****************************************************************/
  function isSupport(line) {
    const src = $(line).find('img:eq(0)').attr('src') || '';
    return src.includes('support');
  }

  function getLabelText(line) {
    // robust: je nach Seite anders
    const $lbl = $(line).find('.quickedit-label').first();
    if ($lbl.length) return $.trim($lbl.text());
    const $qe = $(line).find('.quickedit-content .quickedit-label').first();
    if ($qe.length) return $.trim($qe.text());
    // fallback: irgendein sichtbarer Text in der ersten Zelle
    return $.trim($(line).find('td:eq(0)').text());
  }

  // Original-Logik: Tag steht nach dem ersten Leerzeichen
  function extractTagPart(fullName) {
    if (!fullName) return '';
    const i = fullName.indexOf(' ');
    return i >= 0 ? fullName.substr(i + 1) : fullName;
  }

  // Dual-Tag-Erkennung wie Original: name enthält tagA + tagB direkt hintereinander
  function checkDual(name, nr) {
    for (let i = 0; i < buttonNames.length; i++) {
      for (let j = 0; j < buttonNames.length; j++) {
        if (name.indexOf(buttonNames[i] + buttonNames[j]) !== -1) {
          if (nr === 1) return i;
          if (nr === 2) return j;
          return true;
        }
      }
    }
    return false;
  }

  function applySolid(line, color) {
    if (win.attack_layout === 'line') {
      $(line).find('td').attr('style', `background:${color} !important;`);
      $(line).find('a').attr('style', `color:${win.colors.white[0]} !important;`);
    } else if (win.attack_layout === 'column') {
      $(line).find('td:eq(0)').attr('style', `background:${color} !important;`);
      $(line).find('a:eq(0)').attr('style',
        'color:white !important; text-shadow:-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;'
      );
    }
  }

  function applyStriped(line, color1, color2) {
    const bg = `repeating-linear-gradient(45deg, ${color1}, ${color1} 10px, ${color2} 10px, ${color2} 20px)`;
    if (win.attack_layout === 'line') {
      $(line).find('td').attr('style', `background:${bg} !important;`);
    } else if (win.attack_layout === 'column') {
      $(line).find('td:eq(0)').attr('style', `background:${bg} !important;`);
      $(line).find('a:eq(0)').attr('style',
        'color:white !important; text-shadow:-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;'
      );
    }
  }

  /*****************************************************************
   * BUTTON INJECTION
   *****************************************************************/
  function injectButtons(nr, line) {
    if ($(line).data('incOrganizer')) return;
    $(line).data('incOrganizer', true);

    ensureCss();

    let html = '<span style="float:right">';
    buttonIcons.forEach((icon, i) => {
      html += `
        <button type="button"
          class="btn inc-org-btn"
          title="${buttonNames[i]}"
          style="
            font-size:${uiFont}px !important;
            color:${getFont(i)} !important;
            background:linear-gradient(to bottom, ${getTop(i)} 30%, ${getBot(i)} 70%) !important;
          "
          data-idx="${i}"
        >${icon}</button>`;
    });
    html += '</span>';

    const $qc = $(line).find('.quickedit-content');
    if (!$qc.length) return;
    $qc.append(html);

    $qc.find('.inc-org-btn').on('click', function () {
      const idx = Number(this.dataset.idx);
      const name = buttonNames[idx];

      $(line).find('.rename-icon').click();

      const $input = $(line).find('input[type=text]');
      if (name.includes('|')) $input.val($input.val() + name);
      else $input.val($input.val().split(' ')[0] + ' ' + name);

      $(line).find('input[type=button]').click();
    });
  }

  /*****************************************************************
   * SCAN: Buttons + Coloring (robust für overview_villages incomings attacks)
   *****************************************************************/
  function scan() {
    // Buttons: commands/incomings-Liste (wenn vorhanden)
    $('#commands_incomings .command-row').each(function (nr, line) {
      if (isSupport(line)) return;
      injectButtons(nr, line);
    });

    // Coloring: overview_villages incomings attacks nutzt in der Regel #incomings_table
    // (wir nehmen mehrere Fallbacks, ohne viel umzubauen)
    const $rows =
      $('#incomings_table tr.nowrap')
        .add('#incomings_table tr')
        .add('#commands_incomings .command-row');

    $rows.each(function (_, line) {
      if (isSupport(line)) return;

      const fullName = getLabelText(line);
      const tagPart = extractTagPart(fullName);

      const code = buttonNames.indexOf(tagPart);
      const dual = checkDual(tagPart);

      if (code !== -1) {
        const colorcode = buttonColors[code];
        const color = win.colors[colorcode]?.[1] || '#6c4d2d';
        applySolid(line, color);
        return;
      }

      if (dual) {
        const c1 = buttonColors[checkDual(tagPart, 1)];
        const c2 = buttonColors[checkDual(tagPart, 2)];
        const color1 = win.colors[c1]?.[0] || '#6c4d2d';
        const color2 = win.colors[c2]?.[0] || '#6c4d2d';
        applyStriped(line, color1, color2);
        return;
      }

      // Fallback wie Original:
      // Wenn "unknown"/nicht erkannt -> rot, sonst (z.B. ohne rename) -> gelb
      // Heuristik: wenn Quickedit-Label leer oder kein Space (noch nicht umbenannt) -> gelb
      if (!fullName || fullName.indexOf(' ') === -1) {
        applySolid(line, win.colors.yellow[1]);
      } else {
        applySolid(line, win.colors.red[1]);
      }
    });
  }

  /*****************************************************************
   * OBSERVER + INIT
   *****************************************************************/
  const observer = new MutationObserver(() => scan());
  observer.observe(document.body, { childList: true, subtree: true });

  scan();
})();
