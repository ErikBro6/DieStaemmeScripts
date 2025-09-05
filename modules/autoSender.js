(function () {
  'use strict';

  const PARAM_KEY = 'auto';
  const PARAM_VAL = '1';
  const BTN_SEL   = '#target_attack';
  const SCAN_MS   = 300;
  const TIMEOUT_MS = 150_000;

  const url = new URL(location.href);
  const hasParam   = url.searchParams.get(PARAM_KEY) === PARAM_VAL;
  const cameByRef  = !!(document.referrer && /:\/\/(?:www\.)?ds-ultimate\.de\//i.test(document.referrer));

  const isAutoFlow = sessionStorage.getItem('ds_auto_flow') === '1';

  // Nur im Auto-Flow
  if (hasParam || isAutoFlow) {
    // Seite "try=confirm" = Rücksprung nach Abschicken
    if (url.searchParams.get('try') === 'confirm') {
      // Leichter Delay, damit Requests sicher rausgehen
      setTimeout(() => {
        window.close();
      }, 3000);
    }
  }

  // Sticky-Flag aufräumen, falls wir organisch hier sind
  if (!(cameByRef || hasParam)) {
    sessionStorage.removeItem('ds_auto_flow');
    return;
  }

  // Nur wenn wir JETZT wirklich im Auto-Flow sind, merken (Tab-weit für Confirm)
  if (cameByRef || hasParam) {
    sessionStorage.setItem('ds_auto_flow', '1');
  }

  // pro URL nur einmal feuern
  const onceKey = 'ds_auto_sent_' + url.pathname + '?' + url.search;
  if (sessionStorage.getItem(onceKey) === '1') return;

  // Kosmetisch: auto=1 nur beim ERSTEN Einstieg via Referrer sichtbar machen
  if (cameByRef && !hasParam) {
    url.searchParams.set(PARAM_KEY, PARAM_VAL);
    history.replaceState(null, '', url);
  }

  function withParam(u, key, val) {
    const x = new URL(u, location.href);
    x.searchParams.set(key, val);
    return x.toString();
  }

  function prepareFormForAuto(btn) {
    // Nur anhängen, wenn wir wirklich im Auto-Flow sind (Referrer oder Param)
    if (!(cameByRef || hasParam)) return;

    const form = btn.closest('form') || btn.form;
    if (!form) return;

    // Hidden-Input → trägt auto=1 zuverlässig weiter
    if (!form.querySelector(`input[name="${PARAM_KEY}"]`)) {
      const h = document.createElement('input');
      h.type = 'hidden';
      h.name = PARAM_KEY;
      h.value = PARAM_VAL;
      form.appendChild(h);
    }

    // Action-URL sichtbar erweitern (GET/Redirects)
    if (form.action) {
      form.action = withParam(form.action, PARAM_KEY, PARAM_VAL);
    }
  }

  function tryClick() {
    const btn = document.querySelector(BTN_SEL);
    if (!btn || btn.disabled) return false;

    prepareFormForAuto(btn);

    btn.click();
    sessionStorage.setItem(onceKey, '1');
    return true;
  }

  if (tryClick()) return;

  const start = Date.now();
  const iv = setInterval(() => {
    if (tryClick()) {
      clearInterval(iv);
    } else if (Date.now() - start > TIMEOUT_MS) {
      clearInterval(iv);
    }
  }, SCAN_MS);

  const mo = new MutationObserver(() => { tryClick(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), TIMEOUT_MS);

    const u = new URL(location.href);

  // Nur im Auto-Flow & auf der Confirm-Route
  if (u.searchParams.get('screen') === 'place' &&
      u.searchParams.get('try') === 'confirm' &&
      u.searchParams.get('auto') === '1') {

    const token   = u.searchParams.get('autotoken'); // vom Opener mitgegeben
    const delayMs = 3000; // 3 Sekunden

    if (token) {
      // Signal an den Opener-Tab: schließ mich nach 3s
      GM.setValue('auto_close_signal', { token, delayMs }).catch(() => {});
    }
  }
})();
