#!/usr/bin/env node
// Exports the NAT values the FlightKeys parser v1.0.0 (step 5e-1 PR 1; O-68) gives on the 26 FlightKeys
// packages, for the pinned checks of TC-164-021 (test/rules/ofp-flightkeys-v100.test.js): per package the
// label, the natTrack hash (NAT ruleset v1.2.0 injected, called with { filed, findings }), the filed letter
// and the marked track(s), and the NAT findings forwarded into findings[] (level, code, message).
//
//   node test/corpus/fk-v100-expected-export.js [--fixtures <dir>]
//        --out <fixtures>/expected/ofp-flightkeys-v1.0.0/nat.json
//
// Written to the PRIVATE fixtures repository only (expected/), never to this repository. No crew data:
// the NAT pages and the NAT findings carry none.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

const modFile = path.join(RULES, MAN['ofp-flightkeys'].file);
const mod = require(modFile);
const OPTS = {
  icaoFpl: require(path.join(RULES, MAN['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MAN['aircraft-profile'].file)),
  notamRules: require(path.join(RULES, MAN['notam-rules'].file)),
  parseNatTrack: require(path.join(RULES, MAN['nat-rules'].file)).parseNatTrack,
};
const LBL = Object.fromEntries(Object.entries(require('../rules/data/ofp-flightkeys-v0.3.0-baseline.json').fixtures).map(([id, b]) => [id, b.label]));
const res = {
  _about: 'ofp-flightkeys v1.0.0 (step 5e-1 PR 1, O-68: the NAT call with { filed, findings }) NAT values on the 26 FlightKeys packages, for TC-164-021 (relief-pilot test/rules/ofp-flightkeys-v100.test.js); made by test/corpus/fk-v100-expected-export.js with nat-rules-next v1.2.0 injected.',
  module: { version: mod.RULESET_VERSION, sha256: sha(fs.readFileSync(modFile)) },
  packages: {},
};
for (const fx of readManifest(FIX).fixtures.filter(f => f.format === 'flightkeys')) {
  const text = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8');
  const items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
  const r = mod.parseFlightKeys(mod.inputFromExtractor(text, items), OPTS);
  const marked = r.natTrack ? r.natTrack.blocks.flatMap(b => b.tracks.filter(t => t.assigned).map(t => t.id)) : null;
  res.packages[fx.id] = {
    label: LBL[fx.id],
    natTrack: r.natTrack ? sha(JSON.stringify(r.natTrack)) : null,
    filed: r.natTrack ? [r.natTrack.assignedId, marked] : null,
    natFindings: r.findings.filter(f => 'code' in f).map(f => [f.level, f.code, f.message]),
  };
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
console.log(`wrote ${out}: ${Object.keys(res.packages).length} packages`);
