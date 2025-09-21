import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import esbuild from 'rollup-plugin-esbuild';
import postcss from 'rollup-plugin-postcss';

const pluginsCdn = [
  resolve({ extensions: ['.mjs', '.js', '.ts'] }),
  // WICHTIG: PostCSS VOR esbuild, damit CSS-Imports verarbeitet werden
  postcss({
    extract: 'styles/app.css', // feste Datei, ohne Hash (Builder hat Fallback)
    minimize: false,
    sourceMap: true
  }),
  commonjs(),
  esbuild({ include: /\.[jt]s?$/i, target: 'es2020', tsconfig: 'tsconfig.json' })
];

const iifeBanner = `// ==UserScript==
// @name         DS Tools
// @namespace    https://github.com/ErikBro6/DieStaemmeScripts
// @version      2.9.0
// @description  Tools & UI für Die Stämme
// @author       ...
// @match        https://*.die-staemme.de/game.php?*
// @match        https://*ds-ultimate.de/tools/attackPlanner/*
// @updateURL    https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/releases/download/v2.9.0/main.user.js
// @downloadURL  https://raw.githubusercontent.com/ErikBro6/DieStaemmeScripts/releases/download/v2.9.0/main.user.js
// @connect      cdn.jsdelivr.net
// @connect      raw.githubusercontent.com
// @connect      localhost
// @grant        GM_xmlhttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==`;


export default [
  {
    input: {
      'core/loader': 'packages/core/loader.ts',
      'core/context': 'packages/core/context.ts',
      'core/ui/mount': 'packages/core/ui/mount.ts',
      // WICHTIG: TS-Datei importiert ./app.css
      'styles/app': 'packages/styles/index.ts',
      // Beispiel-Module
      'modules/place/confirmEnhancer/index': 'packages/modules/place/confirmEnhancer/index.ts',
      'modules/market/resource_balancer': 'packages/modules/market/resource_balancer.ts'
    },
    output: {
      dir: 'dist/cdn',
      entryFileNames: '[name]-[hash].js',
      assetFileNames: '[name]-[hash][extname]',
      chunkFileNames: 'chunks/[name]-[hash].js',
      format: 'esm',
      sourcemap: true
    },
    plugins: pluginsCdn
  },
  
  // 2) Userscript Bootstrap (ein IIFE-File)
  {
    input: 'src/userscript/main.ts',
    output: {
      file: 'dist/userscript/main.user.js',
      format: 'iife',
      banner: iifeBanner,
      sourcemap: false
    },
    plugins: [
      resolve({ extensions: ['.mjs', '.js', '.ts'] }),
      commonjs(),
      esbuild({ include: /\.[jt]s?$/i, target: 'es2020', tsconfig: 'tsconfig.json' })
    ]
  }
];
