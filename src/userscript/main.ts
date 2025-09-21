import { detectContext } from '../../packages/core/context';
import { loadForContext } from '../../packages/core/loader';

const ENV_KEY = 'dsToolsEnv';
const DEFAULT_ENV = 'prod';

const MANIFEST_URLS = {
  prod: 'https://cdn.jsdelivr.net/gh/ErikBro6/DieStaemmeScripts@v2.9.0/config/manifest.prod.json',
  dev:  'http://localhost:8123/manifest.dev.json'
};

async function getEnv(): Promise<'prod'|'dev'> {
  try {
    const qp = new URL(location.href).searchParams;
    const forced = qp.get('dstools_env') as 'prod'|'dev'|null;
    if (forced) { /* @ts-ignore */ await GM.setValue(ENV_KEY, forced); return forced; }
    // @ts-ignore
    return (await GM.getValue(ENV_KEY, DEFAULT_ENV)) as any;
  } catch { return DEFAULT_ENV as any; }
}

async function gmFetchJson(url: string) {
  return new Promise<any>((resolve, reject) => {
    // @ts-ignore
    GM_xmlhttpRequest({ method: 'GET', url, timeout: 15000, onload: r => resolve(JSON.parse(r.responseText)), onerror: reject, ontimeout: ()=>reject(new Error('timeout')) });
  });
}

(function registerEnvMenu(){
  // @ts-ignore
  if (typeof GM_registerMenuCommand === 'function') {
    ['prod','dev'].forEach(env => {
      // @ts-ignore
      GM_registerMenuCommand(`[DS] Environment: ${env}`, async () => { /* @ts-ignore */ await GM.setValue(ENV_KEY, env); location.reload(); });
    });
  }
})();

(async function bootstrap(){
  const env = await getEnv();
  const manifest = await gmFetchJson(MANIFEST_URLS[env]);
  const ctx = detectContext();
  await loadForContext(ctx, manifest);
})();
