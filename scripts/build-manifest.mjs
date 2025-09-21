// scripts/build-manifest.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix, sep } from 'node:path';
import { createHash } from 'node:crypto';

// >>> anpassen: Dein CDN-Tag/Version
const CDN_BASE_PROD = 'https://cdn.jsdelivr.net/gh/ErikBro6/DieStaemmeScripts@v2.9.0';
const DIST_DIR = 'dist/cdn';
const SCHEMA_FILE = 'config/manifest.schema.json';

// Helpers
function sha256Base64(buf) {
  return 'sha256-' + createHash('sha256').update(buf).digest('base64');
}
function toPosix(p) {
  // Windows "\" -> "/" für URLs
  return p.split(sep).join('/');
}
function list(dir) {
  return readdirSync(dir).map(n => ({ name: n, abs: join(dir, n) }));
}
function findFirst(dir, predicate) {
  for (const { name, abs } of list(dir)) {
    if (predicate(name, abs)) return { name, abs };
  }
  return null;
}

/**
 * Sucht eine gebaute Datei zu einem Quellpfad-Muster (ohne Hash).
 * Beispiel: source "modules/place/confirmEnhancer.js"
 * Wir suchen in dist/cdn/modules/place/*: "confirmEnhancer-<hash>.js"
 */
function resolveBuiltJs(sourceRelJs) {
  if (!sourceRelJs.endsWith('.js')) {
    throw new Error('Expected .js in manifest.schema.json routes: ' + sourceRelJs);
  }
  const relNoExt = sourceRelJs.replace(/\.js$/, ''); // modules/place/confirmEnhancer
  const parts = relNoExt.split('/');
  const baseName = parts.pop();                        // confirmEnhancer
  const dir = join(DIST_DIR, ...parts);               // dist/cdn/modules/place

  const hit = findFirst(dir, (name, abs) => {
    return name.startsWith(baseName + '-') && name.endsWith('.js') && statSync(abs).isFile();
  });
  if (!hit) {
    // Fallback: evtl. ohne Hash gebaut (z. B. leeres Modul)
    const plain = join(dir, baseName + '.js');
    try {
      if (statSync(plain).isFile()) return { abs: plain, rel: toPosix(plain).replace(toPosix(DIST_DIR) + '/', '') };
    } catch {}
    throw new Error('Built JS not found for ' + sourceRelJs + ' in ' + dir);
  }
  return { abs: hit.abs, rel: toPosix(hit.abs).replace(toPosix(DIST_DIR) + '/', '') };
}

function resolveBuiltCss(basename = 'app') {
  const dir = join(DIST_DIR, 'styles');
  const hit = findFirst(dir, (name, abs) => name.startsWith(basename + '-') && name.endsWith('.css'));
  if (!hit) {
    // Fallback: un-hashed
    const plain = join(dir, basename + '.css');
    try {
      if (statSync(plain).isFile()) return { abs: plain, rel: toPosix(plain).replace(toPosix(DIST_DIR) + '/', '') };
    } catch {}
    throw new Error('Built CSS not found (app-*.css) in ' + dir);
  }
  return { abs: hit.abs, rel: toPosix(hit.abs).replace(toPosix(DIST_DIR) + '/', '') };
}

function mapRoutesToEntries(x, baseUrl) {
  // Gibt eine Struktur zurück, in der überall { url, integrity } Objekte stehen
  if (typeof x === 'string') {
    const built = resolveBuiltJs(x);
    const buf = readFileSync(built.abs);
    return { url: `${baseUrl}/${built.rel}`, integrity: sha256Base64(buf) };
  }
  if (Array.isArray(x)) return x.map(item => mapRoutesToEntries(item, baseUrl));
  if (x && typeof x === 'object') {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, mapRoutesToEntries(v, baseUrl)]));
  }
  throw new Error('Unsupported entry in manifest.schema.json routes: ' + JSON.stringify(x));
}

function main() {
  const schema = JSON.parse(readFileSync(SCHEMA_FILE, 'utf8'));
  if (!schema.routes) throw new Error('manifest.schema.json must contain "routes"');
  const cssBuilt = resolveBuiltCss('app');

  // PROD
  const prod = {
    baseUrl: CDN_BASE_PROD,
    assets: { cssUrl: `${CDN_BASE_PROD}/${cssBuilt.rel}` },
    modules: mapRoutesToEntries(schema.routes, CDN_BASE_PROD)
  };

  // DEV: gleiche gebauten Dateien, andere Base-URL
  const DEV_BASE = 'http://localhost:8123';
  const dev = {
    baseUrl: DEV_BASE,
    assets: { cssUrl: `${DEV_BASE}/${cssBuilt.rel}` },
    modules: mapRoutesToEntries(schema.routes, DEV_BASE)
  };

  // Schreiben
  writeFileSync('config/manifest.prod.json', JSON.stringify(prod, null, 2));
  writeFileSync('config/manifest.dev.json', JSON.stringify(dev, null, 2));
  // zusätzlich in dist/cdn, damit der Dev-Server es ausliefert
  writeFileSync(join(DIST_DIR, 'manifest.dev.json'), JSON.stringify(dev, null, 2));

  console.log('✔ Wrote config/manifest.prod.json');
  console.log('✔ Wrote config/manifest.dev.json');
  console.log('✔ Wrote dist/cdn/manifest.dev.json');
}

main();
