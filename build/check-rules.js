/**
 * build/check-rules.js — checks rules/ against rules/manifest.json (ADR-005 §2.5)
 *
 * Usage:
 *   node build/check-rules.js
 *
 * Every file in rules/ must be one of:
 *   - rules/manifest.json itself,
 *   - a module file listed in the manifest, whose SHA-256 equals the listed one,
 *   - a Markdown document (.md: SPEC, ledger) — not code, never built into the app.
 * Anything else (an unlisted module file, a listed file that is missing, a hash
 * that does not match) is a failure: exit code 1.
 *
 * build/build.js uses checkRules() as well, so a module whose bytes differ from
 * the manifest is never built into index.html.
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

function listFiles(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(dir, p));
    else out.push(p);
  }
  return out.sort();
}

// Returns { ok, errors[], modules[{ name, file, version, sha256 }], documents[] }.
function checkRules(root = ROOT) {
  const rulesDir = path.join(root, 'rules');
  const errors = [], modules = [], documents = [];
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(rulesDir, 'manifest.json'), 'utf8'));
  } catch (e) {
    return { ok: false, errors: [`rules/manifest.json cannot be read: ${e.message}`], modules, documents };
  }
  const listed = new Set();
  for (const [name, e] of Object.entries(manifest)) {
    if (!e || typeof e.file !== 'string' || typeof e.sha256 !== 'string' || typeof e.version !== 'string') {
      errors.push(`${name}: manifest entry needs file, version and sha256`);
      continue;
    }
    listed.add(e.file);
    const file = path.join(rulesDir, e.file);
    if (!fs.existsSync(file)) { errors.push(`${name}: rules/${e.file} is listed but missing`); continue; }
    const actual = sha256(fs.readFileSync(file));
    if (actual !== e.sha256) errors.push(`${name}: rules/${e.file} SHA-256 ${actual} does not match the manifest ${e.sha256}`);
    else modules.push({ name, file: e.file, version: e.version, sha256: actual });
  }
  for (const f of listFiles(rulesDir)) {
    if (f === 'manifest.json' || listed.has(f)) continue;
    if (f.endsWith('.md')) { documents.push(f); continue; }
    errors.push(`rules/${f} is not listed in rules/manifest.json`);
  }
  return { ok: errors.length === 0, errors, modules, documents };
}

module.exports = { checkRules };

if (require.main === module) {
  const r = checkRules();
  for (const m of r.modules) console.log(`ok    rules/${m.file}  v${m.version}  sha256 ${m.sha256}`);
  for (const d of r.documents) console.log(`doc   rules/${d}  (document, not built into the app)`);
  for (const e of r.errors) console.log(`FAIL  ${e}`);
  console.log(r.ok ? `rules/: ${r.modules.length} module file(s) match rules/manifest.json`
                   : `rules/: ${r.errors.length} mismatch(es) with rules/manifest.json`);
  process.exit(r.ok ? 0 : 1);
}
