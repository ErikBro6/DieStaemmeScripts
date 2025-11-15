(function () {
  'use strict';
  const legend = document.querySelector('#map_legend');
  if (!legend) return;

  const html = `
    <div style="margin-bottom:6px">
      <div style="position:relative; display:inline-block; margin-right:8px;">
        <div style="
          background:#111; color:#fff; border-radius:8px; padding:10px 12px;
          box-shadow:0 8px 24px rgba(0,0,0,.2);
          display:inline-flex; align-items:center; gap:10px; font-size:14px;">
          <strong>Linien&nbsp;Tool</strong>
          <kbd style="
            font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
            font-size:13px; border:1px solid rgba(255,255,255,.25); border-bottom-width:2px;
            padding:0 .55em; border-radius:4px; background:rgba(255,255,255,.08);">L</kbd>
        </div>
        <div style="
          position:absolute; top:-6px; left:16px; width:0; height:0;
          border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:6px solid #111;"></div>
      </div>

      <div style="position:relative; display:inline-block;">
        <div style="
          background:#111; color:#fff; border-radius:8px; padding:10px 12px;
          box-shadow:0 8px 24px rgba(0,0,0,.2);
          display:inline-flex; align-items:center; gap:10px; font-size:14px;">
          <strong>Village&nbsp;Select</strong>
          <kbd style="
            font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
            font-size:13px; border:1px solid rgba(255,255,255,.25); border-bottom-width:2px;
            padding:0 .55em; border-radius:4px; background:rgba(255,255,255,.08);">B</kbd>
        </div>
        <div style="
          position:absolute; top:-6px; left:16px; width:0; height:0;
          border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:6px solid #111;"></div>
      

    </div>
          <div style="position:relative; display:inline-block;">
        <div style="
          background:#111; color:#fff; border-radius:8px; padding:10px 12px;
          box-shadow:0 8px 24px rgba(0,0,0,.2);
          display:inline-flex; align-items:center; gap:10px; font-size:14px;">
          <strong>Distance&nbsp;Calculator</strong>
          <kbd style="
            font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
            font-size:13px; border:1px solid rgba(255,255,255,.25); border-bottom-width:2px;
            padding:0 .55em; border-radius:4px; background:rgba(255,255,255,.08);">X</kbd>
        </div>
        <div style="
          position:absolute; top:-6px; left:16px; width:0; height:0;
          border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:6px solid #111;"></div>
      </div>
    </div>
  </div>
    `;

  legend.insertAdjacentHTML('beforebegin', html);
})();
