import { log } from './log';
import { gmGet } from './http';
import { EventBus } from './bus';
import { mount, injectCssOnce } from './ui/mount';
import type { DsModule, ModuleContext } from '../types/module';

type ManifestModuleEntry = { url: string, integrity?: string };
type Manifest = {
  baseUrl?: string;
  assets?: { cssUrl?: string };
  modules: Record<string, ManifestModuleEntry | ManifestModuleEntry[] | Record<string, ManifestModuleEntry | string> | string[] | string>;
};

const registry: DsModule[] = []; // <— bleibt global in dieser Datei

async function fetchText(u: string): Promise<string> {
  const res = await gmGet(u);
  return res.responseText;
}

async function loadScript(u: string) {
  const code = await fetchText(u);

  // gemeinsame Registry-Funktion
  const register = (m: DsModule) => { registry.push(m); };

  // Wir WRAPPEN den Modulcode in eine IIFE, deren Parameter "defineModule" heißt,
  // und rufen sie SOFORT mit "register" auf. So ist "defineModule" garantiert im Scope.
  const wrapped =
    '(function(defineModule){\n' +
      code +
    '\n})(defineModule);\n';

  // Den Wrapper mit "defineModule" ausführen – keine Globals nötig.
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    'defineModule',
    '"use strict";\n' + wrapped + `\n//# sourceURL=${u}`
  );
  fn(register);
}


function flatEntries(x: any): ManifestModuleEntry[] {
  if (!x) return [];
  if (typeof x === 'string') return [{ url: x }];
  if (Array.isArray(x)) return x.flatMap(flatEntries);
  if (typeof x === 'object' && 'url' in x) return [x as ManifestModuleEntry];
  if (typeof x === 'object') return Object.values(x).flatMap(flatEntries);
  return [];
}

export async function loadForContext(
  ctxRaw: {url:URL,host:string,path:string,screen:string,mode:string},
  manifest: Manifest
) {
  const g: any = (typeof window !== 'undefined' ? window : globalThis);
  const root: any = (typeof globalThis !== 'undefined' ? globalThis : g);
  const shared = root.DST || g.DST || {};
  root.DST = shared;
  if (typeof window !== 'undefined') (window as any).DST = shared;
  g.DST = shared;
  g.DST.defineModule = (m: DsModule) => { registry.push(m); };


  // Context + Helpers
  const bus = new EventBus();
  const storage = {
    async get<T>(k: string, d: T) { /* @ts-ignore */ const v = await GM.getValue('ds:'+k); return v ? JSON.parse(v) : d; },
    async set<T>(k: string, v: T) { /* @ts-ignore */ await GM.setValue('ds:'+k, JSON.stringify(v)); }
  };
  const ctx: ModuleContext = { ...ctxRaw, bus, storage, mount: (id?:string)=>mount(id) };

  // CSS einmal injizieren
  const mountTmp = mount('__ds-style');
  if (manifest.assets?.cssUrl) injectCssOnce(manifest.assets.cssUrl, mountTmp.root);

  // Module laden (parallel begrenzt)
  const entries = flatEntries(manifest.modules);
  const seen = new Set<string>();
  const urls = entries.map(e=>e.url).filter(u=>u && !seen.has(u) && (seen.add(u), true));

  const queue = urls.slice();
  const concurrency = 4;
  let active = 0;
  await new Promise<void>(resolve => {
    console.info('[DST] loading modules:', urls);
    const next = () => {
      if (!queue.length && active === 0) return resolve();
      while (active < concurrency && queue.length) {
        const u = queue.shift()!;
        active++;
        loadScript(u)
          .catch(e => log.error('Load fail', u, e))
          .finally(()=>{ active--; next(); });
      }
    };
    next();
  });

  // Ausführen
  const toRun = registry.filter(m => {
    try { return m.when(ctx); } catch (e) { log.error('when() error', m.id, e); return false; }
  });
  for (const m of toRun) {
    try { await m.run(ctx); } catch (e) { log.error('run() error', m.id, e); }
  }
  mountTmp.dispose();
}
