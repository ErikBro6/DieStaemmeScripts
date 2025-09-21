(() => {
  "use strict";
  const logNs = "[DS-Tools:autoWorldSelector]";
  const q = new URL(location.href).searchParams;

  const fromUrl = (q.get("autoworld") || "").trim().toLowerCase();
  const wantUrl = fromUrl ? (fromUrl.startsWith("de") ? fromUrl : ("de" + fromUrl.replace(/\D+/g, ""))) : "";

  // kleine Helper
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function getAutoFlowWorldWithRetry(retries = 5, waitMs = 150) {
    const KEY = 'ds_auto_flow_hints';
    const now = Date.now();
    const TTL_MS_DEFAULT = 5 * 60_000;

    for (let i = 0; i < retries; i++) {
      try {
        const list = (await GM.getValue(KEY, [])) || [];
        const fresh = list.filter(x => (now - (x.ts||0)) < (x.ttl||TTL_MS_DEFAULT));
        const last = fresh[fresh.length - 1];
        if (last && last.world && /^de\d+$/.test(last.world)) {
          // konsumieren
          fresh.pop();
          await GM.setValue(KEY, fresh);
          return last.world.toLowerCase();
        }
      } catch {}
      await sleep(waitMs);
    }
    return "";
  }

  async function waitForWorldsContainer(timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = document.querySelector(".worlds-container");
      if (el) return el;
      await sleep(50);
    }
    return null;
  }

  (async () => {
    let want = wantUrl;

    if (q.get("auto") !== "1" || !want) {
      const w = await getAutoFlowWorldWithRetry();
      if (w) {
        want = w;
        console.info(logNs, "Benutze GM-Hint (Retry):", want);
      } else if (!wantUrl) {
        console.info(logNs, "Kein gültiger Auto-Flow-Hint gefunden. Kein Auto-Klick.");
        return;
      }
    }

    if (!/^de\d+$/.test(want)) {
      console.warn(logNs, "Zielwelt ungültig:", want);
      return;
    }

    const container = await waitForWorldsContainer();
    if (!container) {
      console.warn(logNs, "worlds-container nicht gefunden (Timeout).");
      return;
    }

    const links = Array.from(container.querySelectorAll("a.world-select[href]"));
    const matchLink = links.find(a => {
      try {
        const href = new URL(a.getAttribute("href"), location.origin).pathname.toLowerCase();
        return href.includes("/page/play/" + want)
            || href.match(/\/page\/play\/de(\d+)/)?.[1] === want.replace(/^de/, "");
      } catch { return false; }
    });

    if (!matchLink) {
      console.warn(logNs, `Keine passende Welt gefunden für ${want}.`);
      return;
    }

    setTimeout(() => {
      console.info(logNs, "Klicke Welt:", matchLink.href);
      const btn = matchLink.querySelector("span.world_button_active") || matchLink;
      btn.style.outline = "2px solid limegreen";
      matchLink.click();
    }, 150);
  })();
})();
