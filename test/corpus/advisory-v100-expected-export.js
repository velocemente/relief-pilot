#!/usr/bin/env node
// Exports what the advisory-rules engine v1.0.0 (step 5f module PR B; Exec answers O-169 … O-181) gives on the
// 26 FlightKeys packages, parsed by ofp-flightkeys v1.1.0 (ofp-flightkeys-next), for the pinned checks of
// TC-181-015 (test/rules/advisory-rules.test.js): per package the label and evaluateAdvisories()'s result.
//
//   node test/corpus/advisory-v100-expected-export.js [--fixtures <dir>]
//        --out <fixtures>/expected/advisory-rules-v1.0.0/results.json
//
// Written to the PRIVATE fixtures repository only (expected/), never to this repository. No crew data: the
// result carries VA remark and RAIM remark texts, NOTAM IDs and FIR codes, never a crew name or number.
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

const fkFile = path.join(RULES, MAN['ofp-flightkeys-next'].file);     // v1.1.0 (not built in, D90)
const advFile = path.join(RULES, MAN['advisory-rules-next'].file);    // v1.0.0 (not built in, D90)
const fk = require(fkFile), adv = require(advFile);
const OPTS = {
  icaoFpl: require(path.join(RULES, MAN['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MAN['aircraft-profile'].file)),
  notamRules: require(path.join(RULES, MAN['notam-rules'].file)),
  parseNatTrack: require(path.join(RULES, MAN['nat-rules'].file)).parseNatTrack,
};
const LBL = Object.fromEntries(Object.entries(require('../rules/data/ofp-flightkeys-v0.3.0-baseline.json').fixtures).map(([id, b]) => [id, b.label]));
const res = {
  _about: 'advisory-rules v1.0.0 (step 5f module PR B: volcanic ash, RAIM, volcanic FIR items) - evaluateAdvisories() on the 26 FlightKeys packages parsed by ofp-flightkeys v1.1.0, for TC-181-015 (relief-pilot test/rules/advisory-rules.test.js); made by test/corpus/advisory-v100-expected-export.js.',
  module: { version: adv.RULESET_VERSION, sha256: sha(fs.readFileSync(advFile)) },
  parser: { version: fk.RULESET_VERSION, sha256: sha(fs.readFileSync(fkFile)) },
  packages: {},
};
for (const fx of readManifest(FIX).fixtures.filter(f => f.format === 'flightkeys')) {
  const text = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8');
  const items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
  res.packages[fx.id] = { label: LBL[fx.id], result: adv.evaluateAdvisories(fk.parseFlightKeys(fk.inputFromExtractor(text, items), OPTS)) };
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
const n = Object.values(res.packages).reduce((s, p) => s + p.result.findings.length, 0);
console.log(`wrote ${out}: ${Object.keys(res.packages).length} packages, ${n} WARN finding(s)`);
