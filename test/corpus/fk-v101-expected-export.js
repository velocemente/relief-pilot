#!/usr/bin/env node
// Exports the finding texts the FlightKeys parser v1.0.1 (step 5e-2 module PR; Exec answers O-100, O-103) changes
// on the 26 FlightKeys packages, for the pinned checks of TC-175-011 (test/rules/ofp-flightkeys-v101.test.js): per
// package the label and, for every finding whose message differs from v1.0.0's, its index in findings[], level,
// field and the v1.0.1 message. Findings whose text is unchanged are not listed (they are v1.0.0's, TC-175-010).
//
//   node test/corpus/fk-v101-expected-export.js [--fixtures <dir>]
//        --out <fixtures>/expected/ofp-flightkeys-v1.0.1/messages.json
//
// Written to the PRIVATE fixtures repository only (expected/), never to this repository. No crew data: the
// changed findings name counts, airports, NOTAM IDs and NAT TMIs, never a crew name or number.
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

const oldMod = require(path.join(RULES, MAN['ofp-flightkeys'].file));          // v1.0.0 (built in)
const modFile = path.join(RULES, MAN['ofp-flightkeys-next'].file);              // v1.0.1 (not built in, D90)
const mod = require(modFile);
const OPTS = {
  icaoFpl: require(path.join(RULES, MAN['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MAN['aircraft-profile'].file)),
  notamRules: require(path.join(RULES, MAN['notam-rules'].file)),
  parseNatTrack: require(path.join(RULES, MAN['nat-rules'].file)).parseNatTrack,
};
const LBL = Object.fromEntries(Object.entries(require('../rules/data/ofp-flightkeys-v0.3.0-baseline.json').fixtures).map(([id, b]) => [id, b.label]));
const res = {
  _about: 'ofp-flightkeys v1.0.1 (step 5e-2 module PR, O-100: internal references out of the crew-facing finding texts) - the finding texts that differ from v1.0.0 on the 26 FlightKeys packages, for TC-175-011 (relief-pilot test/rules/ofp-flightkeys-v101.test.js); made by test/corpus/fk-v101-expected-export.js. Per package: [index in findings[], level, field, v1.0.1 message].',
  module: { version: mod.RULESET_VERSION, sha256: sha(fs.readFileSync(modFile)) },
  packages: {},
};
for (const fx of readManifest(FIX).fixtures.filter(f => f.format === 'flightkeys')) {
  const text = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8');
  const items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
  const a = oldMod.parseFlightKeys(oldMod.inputFromExtractor(text, items), OPTS).findings;
  const b = mod.parseFlightKeys(mod.inputFromExtractor(text, items), OPTS).findings;
  if (a.length !== b.length) { console.error(`${fx.id}: findings count differs`); process.exit(1); }
  res.packages[fx.id] = {
    label: LBL[fx.id],
    changed: b.map((f, i) => [i, f.level, f.field, f.message]).filter(([i]) => a[i].message !== b[i].message),
  };
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
const n = Object.values(res.packages).reduce((s, p) => s + p.changed.length, 0);
console.log(`wrote ${out}: ${Object.keys(res.packages).length} packages, ${n} changed texts`);
