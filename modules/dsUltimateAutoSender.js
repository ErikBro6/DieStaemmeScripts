// ==UserScript Module==
// DS Ultimate Auto-Sender – Baba-Farmer Style UI

(function () {
  'use strict';

  // -------------------------------------------------------------
  // STORAGE
  // -------------------------------------------------------------
  const STORAGE_KEY_ENABLED = "dsu_auto_sender_enabled";
  const STORAGE_KEY_TRIGGER = "dsu_auto_sender_trigger";
  const STORAGE_KEY_WITHHOLD_RAM = "dsu_auto_sender_withhold_ram";
  const STORAGE_KEY_WITHHOLD_LIGHT = "dsu_auto_sender_withhold_light";
  const WITHHOLD_CFG_KEY = "dsu_auto_sender_withhold";
  const DEFAULT_WITHHOLD = { ram: 5, light: 125 };

  let autoEnabled = JSON.parse(localStorage.getItem(STORAGE_KEY_ENABLED)) ?? true;
  let triggerSec  = parseInt(localStorage.getItem(STORAGE_KEY_TRIGGER)) || 10;
  triggerSec = Math.max(1, Math.min(20, triggerSec));
  let withholdRam = parseInt(localStorage.getItem(STORAGE_KEY_WITHHOLD_RAM), 10);
  if (!Number.isFinite(withholdRam) || withholdRam < 0) withholdRam = DEFAULT_WITHHOLD.ram;
  let withholdLight = parseInt(localStorage.getItem(STORAGE_KEY_WITHHOLD_LIGHT), 10);
  if (!Number.isFinite(withholdLight) || withholdLight < 0) withholdLight = DEFAULT_WITHHOLD.light;
// --- NEW (minimal): store DS-Ultimate command type for next tab ---
const GM_API = (typeof GM !== 'undefined' && GM) ? GM : null;
const addValueChangeListener =
  (typeof GM_addValueChangeListener === "function")
    ? GM_addValueChangeListener
    : (GM_API && typeof GM_API.addValueChangeListener === "function"
      ? GM_API.addValueChangeListener.bind(GM_API)
      : null);

function clampNonNegativeInt(v, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

function saveWithholdConfig() {
  localStorage.setItem(STORAGE_KEY_WITHHOLD_RAM, String(withholdRam));
  localStorage.setItem(STORAGE_KEY_WITHHOLD_LIGHT, String(withholdLight));
  if (!GM_API || typeof GM_API.setValue !== "function") return;
  GM_API.setValue(WITHHOLD_CFG_KEY, {
    ram: withholdRam,
    light: withholdLight,
    createdAt: Date.now(),
  }).catch(() => {});
}

async function loadWithholdConfig() {
  if (!GM_API || typeof GM_API.getValue !== "function") return;
  try {
    const cfg = await GM_API.getValue(WITHHOLD_CFG_KEY, null);
    if (!cfg || typeof cfg !== "object") return;
    withholdRam = clampNonNegativeInt(cfg.ram, withholdRam);
    withholdLight = clampNonNegativeInt(cfg.light, withholdLight);
    localStorage.setItem(STORAGE_KEY_WITHHOLD_RAM, String(withholdRam));
    localStorage.setItem(STORAGE_KEY_WITHHOLD_LIGHT, String(withholdLight));

    const ramInput = document.getElementById("dsu_withhold_ram");
    const lightInput = document.getElementById("dsu_withhold_light");
    if (ramInput) ramInput.value = String(withholdRam);
    if (lightInput) lightInput.value = String(withholdLight);
  } catch {}
}

function getCommandType(tr) {
  const imgs = tr?.querySelectorAll('img#type_img');
  const last = (imgs && imgs.length) ? imgs[imgs.length - 1] : null;
  const label =
    last?.getAttribute('data-content')?.trim() ||
    last?.dataset?.content?.trim() ||
    '';
  return label || null;
}

function storeCommandType(tr) {
  if (!GM_API || typeof GM_API.setValue !== "function") return;
  const commandType = getCommandType(tr);
  // bewusst simpel: nur ein String + timestamp
  GM_API.setValue('pending_command_type', {
    createdAt: Date.now(),
    commandType,
  });
}


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

      <div style="margin-top:10px;font-weight:bold;">Withhold Ram</div>
      <input id="dsu_withhold_ram" type="number"
        min="0" step="1"
        value="${withholdRam}"
        style="width:70px;margin-top:5px;">

      <div style="margin-top:8px;font-weight:bold;">Withhold Light</div>
      <input id="dsu_withhold_light" type="number"
        min="0" step="1"
        value="${withholdLight}"
        style="width:70px;margin-top:5px;">
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

    document.getElementById("dsu_withhold_ram").addEventListener("change", e => {
      withholdRam = clampNonNegativeInt(e.target.value, withholdRam);
      e.target.value = String(withholdRam);
      saveWithholdConfig();
    });

    document.getElementById("dsu_withhold_light").addEventListener("change", e => {
      withholdLight = clampNonNegativeInt(e.target.value, withholdLight);
      e.target.value = String(withholdLight);
      saveWithholdConfig();
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
  const tokenToRow = new Map();

  function markRowAsSent(rowId) {
    if (!rowId) return;
    const tr = document.getElementById(rowId);
    if (!tr) return;

    tr.style.outline = "2px solid #2f6fdd";

    const cell = tr.querySelector("td");
    if (!cell || cell.querySelector(".dsu-auto-sent-badge")) return;

    const badge = document.createElement("span");
    badge.className = "dsu-auto-sent-badge";
    badge.textContent = " SENT";
    badge.style.cssText = "margin-left:6px;padding:1px 6px;border-radius:999px;background:#2f6fdd;color:#fff;font-size:11px;font-weight:700;";
    cell.appendChild(badge);
  }

  function closeOpenedTab(token, delayMs) {
    const handle = openedTabs.get(token);
    if (!handle || typeof handle.close !== "function") return;

    setTimeout(() => {
      try { handle.close(); } catch {}
      openedTabs.delete(token);
    }, delayMs ?? 3000);
  }

  if (addValueChangeListener) {
    addValueChangeListener("auto_close_signal", (name, oldVal, newVal, remote) => {
      if (!newVal) return;

      const { token, delayMs, status } = newVal;
      if (!token) return;

      if (status === "sent") {
        const rowId = tokenToRow.get(token);
        if (rowId) markRowAsSent(rowId);
      }

      closeOpenedTab(token, delayMs);
    });
  }

  function openAutoTab(href, token) {
    let url = withParam(href, "autotoken", token);

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
    tokenToRow.set(token, rowId);

    // NEW (MINIMAL): commandType für autoSender speichern
    storeCommandType(tr);

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
    loadWithholdConfig();
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init);
  }

})();
