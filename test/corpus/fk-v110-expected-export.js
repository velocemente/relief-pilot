#!/usr/bin/env node
// Exports what the FlightKeys parser v1.1.0 (step 5f module PR A; Exec answers O-169 … O-181) changes on the
// 26 FlightKeys packages against v1.0.1, for the pinned checks of TC-180-015 (test/rules/ofp-flightkeys-v110
// .test.js): per package the label, volcanicAsh, dispatchContact, and the findings v1.0.1 has and v1.1.0 does
// not (removed) and the other way round (added), each [index, level, field, message]. Every other field is
// byte-identical to v1.0.1 (TC-180-010) and not listed.
//
//   node test/corpus/fk-v110-expected-export.js [--fixtures <dir>]
//        --out <fixtures>/expected/ofp-flightkeys-v1.1.0/changes.json
//
// Written to the PRIVATE fixtures repository only (expected/), never to this repository. No crew data: the
// values are the VA page, the Contact Dispatch remark and finding texts, which name no crew member.
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

const oldMod = require(path.join(ROOT, 'test', 'oracle', 'ofp-flightkeys-v1.0.1.js'));   // v1.0.1 (frozen)
const modFile = path.join(RULES, MAN['ofp-flightkeys-next'].file);                       // v1.1.0 (not built in, D90)
const mod = require(modFile);
const OPTS = {
  icaoFpl: require(path.join(RULES, MAN['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MAN['aircraft-profile'].file)),
  notamRules: require(path.join(RULES, MAN['notam-rules'].file)),
  parseNatTrack: require(path.join(RULES, MAN['nat-rules'].file)).parseNatTrack,
};
const LBL = Object.fromEntries(Object.entries(require('../rules/data/ofp-flightkeys-v0.3.0-baseline.json').fixtures).map(([id, b]) => [id, b.label]));
const j = x => JSON.stringify(x);
// The findings of a that b does not have (as a multiset, by value), with their index in a.
const minus = (a, b) => { const left = b.map(j); return a.map((f, i) => [i, f]).filter(([, f]) => { const k = left.indexOf(j(f)); if (k < 0) return true; left.splice(k, 1); return false; }).map(([i, f]) => [i, f.level, f.field, f.message]); };

const res = {
  _about: 'ofp-flightkeys v1.1.0 (step 5f module PR A: VA page, RAIM, Dispatch contact as printed, O-117, O-129) - what differs from v1.0.1 on the 26 FlightKeys packages, for TC-180-015 (relief-pilot test/rules/ofp-flightkeys-v110.test.js); made by test/corpus/fk-v110-expected-export.js. Per package: volcanicAsh, dispatchContact, findings removed / added as [index, level, field, message].',
  module: { version: mod.RULESET_VERSION, sha256: sha(fs.readFileSync(modFile)) },
  packages: {},
};
for (const fx of readManifest(FIX).fixtures.filter(f => f.format === 'flightkeys')) {
  const text = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8');
  const items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
  const a = oldMod.parseFlightKeys(oldMod.inputFromExtractor(text, items), OPTS);
  const b = mod.parseFlightKeys(mod.inputFromExtractor(text, items), OPTS);
  res.packages[fx.id] = {
    label: LBL[fx.id],
    volcanicAsh: b.volcanicAsh,
    dispatchContact: b.dispatchContact,
    findingsRemoved: minus(a.findings, b.findings),
    findingsAdded: minus(b.findings, a.findings),
  };
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
const n = k => Object.values(res.packages).reduce((s, p) => s + p[k].length, 0);
console.log(`wrote ${out}: ${Object.keys(res.packages).length} packages, ${n('findingsRemoved')} findings removed, ${n('findingsAdded')} added`);
