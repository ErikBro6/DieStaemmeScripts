(function () {
  "use strict";

  const HOST_OK = location.hostname.endsWith("twforge.net");
  const PATH_OK = /^\/worlds\/[^/]+\/planner\/plans\/\d+/.test(location.pathname);
  if (!HOST_OK || !PATH_OK) return;

  const STORAGE_KEY_ENABLED = "twf_auto_sender_enabled";
  const STORAGE_KEY_TRIGGER = "twf_auto_sender_trigger";
  const DEFAULT_TRIGGER_SEC = 10;
  const SCAN_MS = 250;
  const SAFETY_MS = 0;

  const GM_API = (typeof GM !== "undefined" && GM) ? GM : null;
  const addValueChangeListener =
    (typeof GM_addValueChangeListener === "function")
      ? GM_addValueChangeListener
      : (GM_API && typeof GM_API.addValueChangeListener === "function"
        ? GM_API.addValueChangeListener.bind(GM_API)
        : null);

  function readBool(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  let autoEnabled = readBool(STORAGE_KEY_ENABLED, true);
  let triggerSec = parseInt(localStorage.getItem(STORAGE_KEY_TRIGGER), 10);
  if (!Number.isFinite(triggerSec)) triggerSec = DEFAULT_TRIGGER_SEC;
  triggerSec = Math.max(1, Math.min(20, triggerSec));

  const fired = new Set();
  const armed = new Set();
  const lastSeenSec = new Map();
  const openedTabs = new Map();
  const tokenToRow = new Map();

  function nowMs() {
    return Date.now();
  }

  function cacheRowKey(tr) {
    const sourceId = getVillageIdFromCell(tr.querySelector("td.mat-column-source a[href*='info_village']"));
    const targetId = getVillageIdFromCell(tr.querySelector("td.mat-column-target a[href*='info_village']"));
    const sendTime = parseSendEpochSec(tr);
    const arrivalTxt = (tr.querySelector("td.mat-column-arrival")?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    return [sourceId || "s", targetId || "t", sendTime || "x", arrivalTxt || "a"].join("_");
  }

  function parseVillageIdFromHref(href) {
    if (!href) return null;
    try {
      const u = new URL(href, location.href);
      const id = u.searchParams.get("id") || u.searchParams.get("village");
      return id && /^\d+$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  function getVillageIdFromCell(anchor) {
    return parseVillageIdFromHref(anchor?.getAttribute("href") || "");
  }

  function parseDeDateTime(text) {
    if (!text) return null;
    const m = text.replace(/\s+/g, " ").trim().match(
      /^(\d{1,2})\.(\d{1,2})\.(\d{4}),\s*(\d{1,2}):(\d{1,2}):(\d{1,2})$/
    );
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6]);
    const d = new Date(year, month - 1, day, hour, minute, second);
    if (!Number.isFinite(d.getTime())) return null;
    return { day, month, year, hour, minute, second, ms: d.getTime() };
  }

  function parseSendEpochSec(tr) {
    const raw = tr.querySelector("td.mat-column-sendTime")?.textContent || "";
    const parsed = parseDeDateTime(raw);
    if (!parsed) return null;
    return Math.floor(parsed.ms / 1000);
  }

  function parseRemainingSec(tr) {
    const raw = tr.querySelector("td.mat-column-remaining")?.textContent || "";
    const m = raw.replace(/\s+/g, " ").trim().match(/(\d{1,2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    const s = Number(m[3]);
    if (![h, min, s].every(Number.isFinite)) return null;
    return h * 3600 + min * 60 + s;
  }

  function getArrivalPayload(tr) {
    const raw = tr.querySelector("td.mat-column-arrival")?.textContent || "";
    const parsed = parseDeDateTime(raw);
    if (!parsed) return null;
    return {
      arrivalStr:
        String(parsed.day).padStart(2, "0") + "." +
        String(parsed.month).padStart(2, "0") + "." +
        String(parsed.year).padStart(4, "0") + " " +
        String(parsed.hour).padStart(2, "0") + ":" +
        String(parsed.minute).padStart(2, "0") + ":" +
        String(parsed.second).padStart(2, "0"),
      arrivalParts: {
        day: parsed.day,
        month: parsed.month,
        year: parsed.year,
        hour: parsed.hour,
        minute: parsed.minute,
        second: parsed.second
      }
    };
  }

  function normalizeUnitName(name) {
    const n = String(name || "").trim().toLowerCase();
    const map = {
      spear: "spear",
      sword: "sword",
      axe: "axe",
      archer: "archer",
      spy: "spy",
      light: "light",
      marcher: "marcher",
      heavy: "heavy",
      ram: "ram",
      catapult: "catapult",
      knight: "knight",
      snob: "snob"
    };
    return map[n] || null;
  }

  function parseChipAmount(label) {
    const txt = String(label || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!txt) return null;
    if (/\balle\b/.test(txt)) return 9999;
    const nums = [...txt.matchAll(/\d+/g)].map((m) => Number(m[0])).filter(Number.isFinite);
    if (!nums.length) return null;
    // fallback strategy for composite labels like "fake/8+1" -> 9
    const sum = nums.reduce((a, b) => a + b, 0);
    return sum > 0 ? sum : null;
  }

  function getTemplateUnits(tr) {
    const units = {};
    const chips = Array.from(tr.querySelectorAll("td.mat-column-template mat-chip"));
    chips.forEach((chip) => {
      const img = chip.querySelector("img[alt]");
      const unit = normalizeUnitName(img?.getAttribute("alt"));
      if (!unit) return;
      const amount = parseChipAmount(chip.textContent || "");
      if (!Number.isFinite(amount) || amount <= 0) return;
      units[unit] = amount;
    });
    return units;
  }

  function getCommandType(tr) {
    const txt = (
      tr.querySelector("td.mat-column-type img")?.getAttribute("alt") ||
      tr.querySelector("td.mat-column-type")?.textContent ||
      ""
    ).trim();
    if (!txt) return null;
    if (/unterst|support/i.test(txt)) return "Unterstutzung";
    return txt;
  }

  function findSendButton(tr) {
    const icons = Array.from(tr.querySelectorAll("td.mat-column-actions button mat-icon"));
    const icon = icons.find((i) => (i.textContent || "").trim().toLowerCase() === "send");
    const btn = icon ? icon.closest("button") : null;
    if (!btn) return null;
    const cls = btn.className || "";
    if (btn.disabled || /opacity-25/.test(cls) || btn.getAttribute("aria-disabled") === "true") {
      return null;
    }
    return btn;
  }

  function buildPlaceUrl(tr, token) {
    const sourceAnchor = tr.querySelector("td.mat-column-source a[href*='info_village']");
    const targetAnchor = tr.querySelector("td.mat-column-target a[href*='info_village']");
    const sourceId = getVillageIdFromCell(sourceAnchor);
    const targetId = getVillageIdFromCell(targetAnchor);
    if (!sourceId || !targetId) return null;

    const sourceHref = sourceAnchor?.getAttribute("href") || "";
    const gameOrigin = (() => {
      try {
        return new URL(sourceHref, location.href).origin;
      } catch {
        return null;
      }
    })();
    if (!gameOrigin) return null;

    const u = new URL("/game.php", gameOrigin);
    u.searchParams.set("village", sourceId);
    u.searchParams.set("screen", "place");
    u.searchParams.set("target", targetId);
    u.searchParams.set("auto", "1");
    u.searchParams.set("autotoken", token);
    return u.toString();
  }

  function withAutoParams(url, token) {
    try {
      const u = new URL(url, location.href);
      u.searchParams.set("auto", "1");
      u.searchParams.set("autotoken", token);
      return u.toString();
    } catch {
      return url;
    }
  }

  function openAutoTab(url, token) {
    const handle = (typeof GM_openInTab === "function")
      ? GM_openInTab(url, { active: true, insert: true, setParent: true })
      : window.open(url, "_blank", "noopener,noreferrer");

    if (handle) openedTabs.set(token, handle);
  }

  function clickNativeSendButton(tr, token) {
    const btn = findSendButton(tr);
    if (!btn) return false;

    const originalOpen = window.open;
    let opened = false;

    try {
      window.open = function patchedOpen(url, target, features) {
        opened = true;
        const patchedUrl = withAutoParams(url, token);
        const handle = originalOpen.call(window, patchedUrl, target, features);
        if (handle) openedTabs.set(token, handle);
        return handle;
      };

      btn.click();
    } catch {
      return false;
    } finally {
      window.open = originalOpen;
    }

    return opened;
  }

  function markRowAsSent(rowKey) {
    const tr = document.querySelector(`tr[data-twf-row-key="${rowKey}"]`);
    if (!tr) return;
    tr.style.outline = "2px solid #2f6fdd";
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
    addValueChangeListener("auto_close_signal", (name, oldVal, newVal) => {
      if (!newVal || !newVal.token) return;
      if (newVal.status === "sent") {
        const rowKey = tokenToRow.get(newVal.token);
        if (rowKey) markRowAsSent(rowKey);
      }
      closeOpenedTab(newVal.token, newVal.delayMs);
    });
  }

  async function storeHandoffPayload(tr, sourceId, targetId, commandType) {
    if (!GM_API || typeof GM_API.setValue !== "function") return;
    const arrival = getArrivalPayload(tr);
    if (arrival) {
      await GM_API.setValue("pending_arrival", {
        createdAt: Date.now(),
        source: "twforge",
        arrivalStr: arrival.arrivalStr,
        arrivalParts: arrival.arrivalParts,
        village: sourceId || null,
        target: targetId || null
      });
    }
    await GM_API.setValue("pending_command_type", {
      createdAt: Date.now(),
      commandType: commandType || null
    });

    const units = getTemplateUnits(tr);
    await GM_API.setValue("pending_units", {
      createdAt: Date.now(),
      source: "twforge",
      village: sourceId || null,
      target: targetId || null,
      units
    });
  }

  async function triggerSend(tr, rowKey) {
    if (!autoEnabled) return;
    if (fired.has(rowKey)) return;

    const sourceId = getVillageIdFromCell(tr.querySelector("td.mat-column-source a[href*='info_village']"));
    const targetId = getVillageIdFromCell(tr.querySelector("td.mat-column-target a[href*='info_village']"));
    const token = "twf_" + rowKey + "_" + Date.now();
    const commandType = getCommandType(tr);
    const fallbackUrl = buildPlaceUrl(tr, token);
    if (!fallbackUrl || !sourceId || !targetId) return;

    fired.add(rowKey);
    tokenToRow.set(token, rowKey);
    await storeHandoffPayload(tr, sourceId, targetId, commandType);
    const openedByNativeButton = clickNativeSendButton(tr, token);
    if (!openedByNativeButton) {
      openAutoTab(fallbackUrl, token);
    }
    tr.style.outline = "2px solid limegreen";
  }

  function checkRow(tr) {
    if (!autoEnabled) return;
    const rowKey = tr.getAttribute("data-twf-row-key");
    if (!rowKey || fired.has(rowKey)) return;

    // Prefer live countdown from "Verbleibend"; fallback to absolute send time.
    let secLeft = parseRemainingSec(tr);
    if (!Number.isFinite(secLeft)) {
      const sendEpoch = parseSendEpochSec(tr);
      if (!Number.isFinite(sendEpoch)) return;
      const msLeft = sendEpoch * 1000 - nowMs() - SAFETY_MS;
      secLeft = Math.max(-1, Math.floor(msLeft / 1000));
    }

    const prev = lastSeenSec.get(rowKey);
    if (prev === undefined) {
      // Arm only while still in the future (never at 00:00:00 or negative).
      if (secLeft <= triggerSec && secLeft > 0) {
        armed.add(rowKey);
      }
      lastSeenSec.set(rowKey, secLeft);
    } else {
      if (prev > triggerSec && secLeft <= triggerSec && secLeft > 0) {
        armed.add(rowKey);
      }
      lastSeenSec.set(rowKey, secLeft);
    }

    // Fire immediately once armed and still > 0s left.
    // If native row button cannot open yet, triggerSend() will fallback once to direct place URL.
    if (armed.has(rowKey) && secLeft > 0) {
      triggerSend(tr, rowKey);
      armed.delete(rowKey);
    }
  }

  function scanRows() {
    const rows = Array.from(document.querySelectorAll("tbody tr.mat-mdc-row"));
    rows.forEach((tr) => {
      if (!tr.hasAttribute("data-twf-row-key")) {
        tr.setAttribute("data-twf-row-key", cacheRowKey(tr));
      }
      checkRow(tr);
    });
  }

  function createControlPanel() {
    if (document.getElementById("twf_auto_sender_panel")) return;
    const box = document.createElement("div");
    box.id = "twf_auto_sender_panel";
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
    box.style.width = "200px";

    box.innerHTML = "" +
      "<div style='font-weight:bold; margin-bottom:6px;'>TwForge Auto-Sender</div>" +
      "<label style='font-weight:bold;'>Status</label><br>" +
      "<button id='twf_toggle_btn' style='margin-top:4px;width:100%;padding:6px;border:none;border-radius:5px;font-weight:bold;cursor:pointer;background:" +
      (autoEnabled ? "#4CAF50" : "#f44336") +
      ";color:white;'>" + (autoEnabled ? "ON" : "OFF") + "</button>" +
      "<div style='margin-top:10px;font-weight:bold;'>Trigger (sec)</div>" +
      "<input id='twf_trigger_input' type='number' min='1' max='20' value='" + triggerSec + "' style='width:60px;margin-top:5px;'>";

    document.body.appendChild(box);

    document.getElementById("twf_toggle_btn").addEventListener("click", () => {
      autoEnabled = !autoEnabled;
      localStorage.setItem(STORAGE_KEY_ENABLED, JSON.stringify(autoEnabled));
      const btn = document.getElementById("twf_toggle_btn");
      btn.textContent = autoEnabled ? "ON" : "OFF";
      btn.style.background = autoEnabled ? "#4CAF50" : "#f44336";
    });

    document.getElementById("twf_trigger_input").addEventListener("change", (e) => {
      triggerSec = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || DEFAULT_TRIGGER_SEC));
      e.target.value = String(triggerSec);
      localStorage.setItem(STORAGE_KEY_TRIGGER, String(triggerSec));
    });
  }

  function init() {
    createControlPanel();
    setInterval(scanRows, SCAN_MS);
    scanRows();
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init);
  }
})();
