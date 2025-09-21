let cssInjected = false;

export function mount(id = 'ds-tools') {
  const host = document.createElement('div');
  host.id = id;
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  return {
    root, host,
    render(html: string) { root.innerHTML = html; },
    dispose() { host.remove(); }
  };
}

export function injectCssOnce(cssUrl: string, root: ShadowRoot) {
  if (cssInjected) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssUrl;
  root.appendChild(link);
  cssInjected = true;
}
