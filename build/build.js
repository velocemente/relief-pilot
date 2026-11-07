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
 *
 * Rule modules (ADR-005): an entry { rule: '<name>' } inserts the module file
 * that rules/manifest.json lists under <name>, byte for byte. The build stops
 * if any file in rules/ does not match the manifest (build/check-rules.js).
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { checkRules } = require('./check-rules');

const ROOT    = path.join(__dirname, '..');

// Modules listed in the exact order they appear in the assembled file.
const MODULES = [
  'styles.html',
  'screens.html',
  'weather.html',
  { rule: 'notam-rules' },   // rules/notam-rules: publishes NotamRules, bound in notam.html
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

// Returns the assembled index.html as a Buffer. Throws if rules/ does not match its manifest.
function assemble(root = ROOT) {
  const rules = checkRules(root);
  if (!rules.ok) throw new Error(`rules/ does not match rules/manifest.json:\n  ${rules.errors.join('\n  ')}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'rules', 'manifest.json'), 'utf8'));
  const parts = MODULES.map(m => {
    if (typeof m === 'string') return fs.readFileSync(path.join(root, 'src', m));
    const entry = manifest[m.rule];
    if (!entry) throw new Error(`rule module ${m.rule} is not listed in rules/manifest.json`);
    return fs.readFileSync(path.join(root, 'rules', entry.file));
  });
  return Buffer.concat(parts);
}

module.exports = { MODULES, assemble };

if (require.main === module) {
  const OUT_DIR = path.join(ROOT, 'dist');
  const OUT     = path.join(OUT_DIR, 'index.html');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const assembled = assemble();
  fs.writeFileSync(OUT, assembled);

  const totalBytes = assembled.length;
  const kb = (totalBytes / 1024).toFixed(1);
  console.log(`Built ${OUT} (${MODULES.length} modules, ${kb} KB)`);
}
