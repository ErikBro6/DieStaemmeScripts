(function(){
  window.UI_LIB = window.UI_LIB || {};

  function ensureCss(url, id="ds-toggle-css"){
    if (!document.getElementById(id)) {
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet"; l.href = url;
      document.head.appendChild(l);
    }
  }
  function gmFetch(url){
    return new Promise((resolve, reject)=>{
      if (typeof GM_xmlhttpRequest === "function"){
        GM_xmlhttpRequest({ method:"GET", url, timeout:15000,
          onload:r=>resolve(r.responseText), onerror:reject, ontimeout:()=>reject(new Error("timeout")) });
      } else { fetch(url).then(r=>r.text()).then(resolve).catch(reject); }
    });
  }
  function applyState(btn, on){
    btn.dataset.state = on ? "on" : "off";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.classList.toggle("is-on",  on);
    btn.classList.toggle("is-off", !on);
    const stateEl = btn.querySelector(".state");
    if (stateEl) stateEl.textContent = on ? (btn._labels?.onState || "AN") : (btn._labels?.offState || "AUS");
  }

  // API
  // UI_LIB.createToggleButton({
  //   id, initial, onLabel, offLabel, onState, offState, cssUrl, htmlUrl, onChange(state, btn), disabled
  // })
  UI_LIB.createToggleButton = async function(opts){
    const {
      id, initial=false,
      onLabel="Automatik", offLabel="Automatik",
      onState="AN", offState="AUS",
      cssUrl, htmlUrl,
      onChange=()=>{},
      disabled=false
    } = opts || {};
    if (!cssUrl || !htmlUrl) throw new Error("cssUrl und htmlUrl sind erforderlich");

    ensureCss(cssUrl);
    const tpl = await gmFetch(htmlUrl);
    const tmp = document.createElement("div"); tmp.innerHTML = tpl.trim();
    const btn = tmp.firstElementChild;
    if (!btn) throw new Error("toggleButton.html leer/ungültig");

    if (id) btn.id = id;
    btn._labels = { onLabel, offLabel, onState, offState };
    btn.disabled = !!disabled;

    // set Label text once
    const lbl = btn.querySelector(".label");
    if (lbl) lbl.textContent = initial ? onLabel : offLabel;

    applyState(btn, !!initial);

    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const next = !(btn.dataset.state === "on");
      // update both label & state text
      const lbl = btn.querySelector(".label");
      if (lbl) lbl.textContent = next ? onLabel : offLabel;
      applyState(btn, next);
      try { onChange(next, btn); } catch(e){ console.error(e); }
    });

    // control API
    btn.setState = (on)=>{
      const lbl = btn.querySelector(".label");
      if (lbl) lbl.textContent = on ? onLabel : offLabel;
      applyState(btn, !!on);
    };
    btn.getState = ()=> btn.dataset.state === "on";
    btn.setDisabled = (v)=>{ btn.disabled = !!v; };

    return btn;
  };
})();
