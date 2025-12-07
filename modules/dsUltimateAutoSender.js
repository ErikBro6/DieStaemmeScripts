// ==UserScript Module==
// DS Ultimate Auto-Sender – Baba-Farmer Style UI

(function () {
  'use strict';

  // -------------------------------------------------------------
  // STORAGE
  // -------------------------------------------------------------
  const STORAGE_KEY_ENABLED = "dsu_auto_sender_enabled";
  const STORAGE_KEY_TRIGGER = "dsu_auto_sender_trigger";

  let autoEnabled = JSON.parse(localStorage.getItem(STORAGE_KEY_ENABLED)) ?? true;
  let triggerSec  = parseInt(localStorage.getItem(STORAGE_KEY_TRIGGER)) || 10;
  triggerSec = Math.max(1, Math.min(20, triggerSec));

  // -------------------------------------------------------------
  // STYLE PANEL (Baba Farmer Style)
  // -------------------------------------------------------------
  function createControlPanel() {
    if (document.getElementById("dsu_auto_sender_panel")) return;

    const box = document.createElement("div");
    box.id = "dsu_auto_sender_panel";
    box.style.position = "fixed";
    box.style.top = "150px";
    box.style.right = "20px";
    box.style.zIndex = 9999;
    box.style.backgroundColor = "#f9f9f9";
    box.style.padding = "10px";
    box.style.border = "1px solid #ccc";
    box.style.borderRadius = "8px";
    box.style.boxShadow = "0 0 5px rgba(0,0,0,0.2)";
    box.style.fontSize = "14px";
    box.style.width = "180px";

    box.innerHTML = `
      <div style="font-weight:bold; margin-bottom:6px;">
        Auto-Sender
      </div>

      <label style="font-weight:bold;">Status</label><br>
      <button id="dsu_toggle_btn"
        style="margin-top:4px;width:100%;padding:6px;border:none;border-radius:5px;font-weight:bold;cursor:pointer;
               background:${autoEnabled ? "#4CAF50" : "#f44336"};color:white;">
        ${autoEnabled ? "ON" : "OFF"}
      </button>

      <div style="margin-top:10px;font-weight:bold;">
        Trigger (Sek.)
      </div>
      <input id="dsu_trigger_input" type="number"
        min="1" max="20"
        value="${triggerSec}"
        style="width:60px;margin-top:5px;">
    `;

    document.body.appendChild(box);

    // --- Events ------------------------------------------
    document.getElementById("dsu_toggle_btn").addEventListener("click", () => {
      autoEnabled = !autoEnabled;
      localStorage.setItem(STORAGE_KEY_ENABLED, JSON.stringify(autoEnabled));

      const btn = document.getElementById("dsu_toggle_btn");
      btn.textContent = autoEnabled ? "ON" : "OFF";
      btn.style.background = autoEnabled ? "#4CAF50" : "#f44336";
    });

    document.getElementById("dsu_trigger_input").addEventListener("change", e => {
      triggerSec = Math.max(1, Math.min(20, parseInt(e.target.value) || 10));
      localStorage.setItem(STORAGE_KEY_TRIGGER, triggerSec.toString());
    });
  }



  // -------------------------------------------------------------
  // AUTO-SENDER ENGINE
  // -------------------------------------------------------------
  const SCAN_MS = 200;
  const SAFETY_MS = 0;

  const fired = new Set();
  const lastSeenSec = new Map();
  const nowMs = () => Date.now();

  function getRows() {
    return [...document.querySelectorAll("tr[id]")].filter(tr =>
      tr.querySelector("countdown[date]")
    );
  }

  function findSendAnchor(tr) {
    let a = tr.querySelector("a.text-success i.fa-redo");
    if (a) a = a.closest("a");
    if (!a) a = tr.querySelector('a[href*="game.php"][href*="screen=place"]');
    return a || null;
  }

  function withParam(u, k, v) {
    const x = new URL(u, location.href);
    x.searchParams.set(k, v);
    return x.toString();
  }

  // TAB CLOSE SUPPORT
  const openedTabs = new Map();
  if (typeof GM_addValueChangeListener === "function") {
    GM_addValueChangeListener("auto_close_signal", (name, oldVal, newVal, remote) => {
      if (!remote || !newVal) return;

      const { token, delayMs } = newVal;
      const handle = openedTabs.get(token);

      if (handle && typeof handle.close === "function") {
        setTimeout(() => {
          try { handle.close(); } catch {}
          openedTabs.delete(token);
        }, delayMs ?? 3000);
      }
    });
  }

  function openAutoTab(href, token) {
    let url = withParam(href, "auto", "1");
    url = withParam(url, "autotoken", token);

    const handle = (typeof GM_openInTab === "function")
      ? GM_openInTab(url, { active: true, insert: true, setParent: true })
      : window.open(url, "_blank", "noopener,noreferrer");

    if (handle) openedTabs.set(token, handle);
  }


  function triggerSend(tr, rowId) {
    if (!autoEnabled) return;

    const a = findSendAnchor(tr);
    if (!a) return;

    fired.add(rowId);

    const token = `auto_${rowId}_${Date.now()}`;
    openAutoTab(a.href, token);

    tr.style.outline = "2px solid limegreen";
  }


  function checkRow(tr) {
    if (!autoEnabled) return;

    const rowId = tr.getAttribute("id");
    if (!rowId || fired.has(rowId)) return;

    const cd = tr.querySelector("countdown[date]");
    if (!cd) return;

    const ts = Number(cd.getAttribute("date"));
    if (!Number.isFinite(ts)) return;

    const msLeft = ts * 1000 - nowMs() - SAFETY_MS;
    const secLeft = Math.max(-1, Math.floor(msLeft / 1000));

    const prev = lastSeenSec.get(rowId);
    if (prev === undefined) {
      lastSeenSec.set(rowId, secLeft);
      return;
    }

    if (prev > triggerSec && secLeft === triggerSec) {
      triggerSend(tr, rowId);
    }

    lastSeenSec.set(rowId, secLeft);
  }


  // Poll loop
  setInterval(() => {
    if (!autoEnabled) return;
    getRows().forEach(checkRow);
  }, SCAN_MS);


  // -------------------------------------------------------------
  // INIT
  // -------------------------------------------------------------
  function init() {
    createControlPanel();
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init);
  }

})();
