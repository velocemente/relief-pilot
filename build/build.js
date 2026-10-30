/**
 * build/build.js — assembles src/ fragments into dist/index.html
 *
 * Usage:
 *   node build/build.js
 *
 * Output: dist/index.html
 *
 * The concatenated output must be byte-for-byte identical to the committed
 * index.html.  CI verifies this with a sha256 hash comparison.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT     = path.join(OUT_DIR, 'index.html');

// Modules listed in the exact order they appear in the assembled file.
const MODULES = [
  'styles.html',
  'screens.html',
  'weather.html',
  'notam.html',
  'nat.html',
  'state.html',
  'storage.html',
  'pdf.html',
  'ofp-parse.html',
  'render-preflight.html',
  'render-enroute.html',
  'rest.html',
  'render-descent.html',
  'edit.html',
  'airports.html',
  'oei.html',
  'copy.html',
  'import.html',
  'settings.html',
  'sw-register.html',
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const parts = MODULES.map(name => fs.readFileSync(path.join(SRC_DIR, name)));
const assembled = Buffer.concat(parts);
fs.writeFileSync(OUT, assembled);

const totalBytes = assembled.length;
const kb = (totalBytes / 1024).toFixed(1);
console.log(`Built ${OUT} (${MODULES.length} modules, ${kb} KB)`);
