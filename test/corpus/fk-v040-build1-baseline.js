#!/usr/bin/env node
// Records the output of the FlightKeys parser v0.4.0 build 1 (PR head 9a76b58, before the Exec answers
// O-46 … O-49) on the 26 FlightKeys packages, as SHA-256 only, for TC-163-100 (everything the answers do
// not name stays byte-identical to build 1). Per package: top-level keys in order and the SHA-256 of each
// field; each finding's SHA-256 in order; per airport entry its keys and the SHA-256 of each value; per FIR
// block its code and the SHA-256 of each item; per Company NOTAM record the SHA-256 without its source
// positions, and the positions (page, column, y range: no text); per finding its
// field and whether it is the NAT "filed track" INFO. No fixture text.
//
//   git show 9a76b58:rules/ofp-flightkeys/ofp-flightkeys-v0.4.0.js > <scratch>/fk-build1.js
//   node test/corpus/fk-v040-build1-baseline.js [--fixtures <dir>] --module <scratch>/fk-build1.js \
//        --out test/rules/data/ofp-flightkeys-v0.4.0-build1-baseline.json
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { findFixtures, readManifest } = require('../lib/app-path');

const ROOT = path.resolve(__dirname, '..', '..');
const RULES = path.join(ROOT, 'rules');
const MAN = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const out = opt('--out');
if (!out) { console.error('--out <file> is required'); process.exit(2); }
const FIX = findFixtures(opt('--fixtures'));
if (!FIX) { console.error('fixtures directory not found'); process.exit(2); }
const modFile = opt('--module') ? path.resolve(opt('--module')) : path.join(RULES, MAN['ofp-flightkeys'].file);
const mod = require(modFile);
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'test', 'oracle', 'nat-v1.1.0.html'), 'utf8'), { window: win });   // NAT v1.1.0, frozen (O-79)
const OPTS = {
  icaoFpl: require(path.join(RULES, MAN['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MAN['aircraft-profile'].file)),
  notamRules: require(path.join(RULES, MAN['notam-rules'].file)),
  parseNatTrack: win.parseNatTrack,
};
const res = { _about: '', module: { version: mod.RULESET_VERSION, sha256: sha(fs.readFileSync(modFile)) }, fixtures: {} };
for (const fx of readManifest(FIX).fixtures.filter(f => f.format === 'flightkeys')) {
  const text = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8');
  const items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
  const r = mod.parseFlightKeys(mod.inputFromExtractor(text, items), OPTS);
  res.fixtures[fx.id] = {
    keys: Object.keys(r),
    sha256: Object.fromEntries(Object.keys(r).filter(k => k !== 'findings').map(k => [k, sha(JSON.stringify(r[k]))])),
    findings: r.findings.map(f => ({ sha256: sha(JSON.stringify(f)), field: f.field, filedTrack: f.field === 'natTrack' && /; filed track /.test(f.message) })),
    companyNotams: r.companyNotams.map(c => { const o = Object.assign({}, c); delete o.source; return { sha256: sha(JSON.stringify(o)), source: c.source }; }),
    airportData: Object.fromEntries(Object.entries(r.airportData).map(([i, e]) => [i, { keys: Object.keys(e), sha256: Object.fromEntries(Object.entries(e).map(([k, v]) => [k, sha(JSON.stringify(v))])) }])),
    firNotams: r.firNotams.map(b => ({ code: b.code, name: sha(b.name), empty: b.empty, items: b.items.map(i => sha(JSON.stringify(i))) })),
  };
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
console.log(`wrote ${out}: ${Object.keys(res.fixtures).length} packages, module ${res.module.version} ${res.module.sha256.slice(0, 12)}`);
