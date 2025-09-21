export function detectContext() {
  const url = new URL(location.href);
  return {
    url, host: url.hostname, path: url.pathname,
    screen: url.searchParams.get('screen') || '',
    mode: url.searchParams.get('mode') || ''
  };
}
