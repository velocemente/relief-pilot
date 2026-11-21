#!/usr/bin/env node
// Exports the values the FlightKeys parser v0.4.0 (step 5d-2) reads from the 26 FlightKeys packages, for
// the pinned checks of TC-163 (test/rules/ofp-flightkeys-v040.test.js): per package the Company NOTAMs
// (ID, location, SUBJECT, origin, text hash), the curfew strings, the opsNotes body hashes, the FIR blocks
// (code, empty, items: ID, category, origin, text hash; O-49 copies left out), the hazard blocks (code, empty,
// text hash), the NAT messages (TMI, direction, validity, parts, pages, selected, text hash) with the returned
// natTrack, and the Dispatch contact (O-46).
//
//   node test/corpus/fk-v040-expected-export.js [--fixtures <dir>]
//        --out <fixtures>/expected/ofp-flightkeys-v0.4.0/briefing.json
//
// The curfew strings are text from the private fixtures: the file is written to the PRIVATE fixtures
// repository only (expected/), never to this repository. No crew data: the briefing documents carry none.
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

const modFile = path.join(RULES, MAN['ofp-flightkeys'].file);
const mod = require(modFile);
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'test', 'oracle', 'nat-v1.1.0.html'), 'utf8'), { window: win });   // NAT v1.1.0, frozen (O-79)
const OPTS = {
  icaoFpl: require(path.join(RULES, MAN['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MAN['aircraft-profile'].file)),
  notamRules: require(path.join(RULES, MAN['notam-rules'].file)),
  parseNatTrack: win.parseNatTrack,
};
const res = {
  _about: 'ofp-flightkeys v0.4.0 (step 5d-2, with the Exec answers O-46 … O-50) values on the 26 FlightKeys packages, for TC-163 (relief-pilot test/rules/ofp-flightkeys-v040.test.js); made by test/corpus/fk-v040-expected-export.js. Private: holds curfew text.',
  module: { version: mod.RULESET_VERSION, sha256: sha(fs.readFileSync(modFile)) },
  packages: {},
};
for (const fx of readManifest(FIX).fixtures.filter(f => f.format === 'flightkeys')) {
  const text = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8');
  const items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
  const r = mod.parseFlightKeys(mod.inputFromExtractor(text, items), OPTS);
  const ad = Object.entries(r.airportData);
  res.packages[fx.id] = {
    companyNotams: r.companyNotams.map(x => [x.id, x.location, x.subject, x.origin, sha(x.text)]),
    curfew: Object.fromEntries(ad.filter(([, a]) => 'curfew' in a).map(([i, a]) => [i, a.curfew])),
    opsNotes: Object.fromEntries(ad.filter(([, a]) => 'opsNotes' in a).map(([i, a]) => [i, sha(a.opsNotes.body)])),
    firNotams: r.firNotams.map(b => [b.code, b.empty, b.items.map(i => [i.id, i.category, i.origin, sha(i.text)])]),
    hazards: r.hazards.map(h => [h.code, h.empty, sha(h.text)]),
    nat: {
      natMessages: r.natMessages.map(m => [m.tmi, m.direction, m.valid, m.parts, m.pages, m.selected, sha(m.text)]),
      natTrack: r.natTrack ? [r.natTrack.tmi, r.natTrack.flightDir, r.natTrack.assignedId] : null,
    },
    dispatchContact: r.dispatchContact,
  };
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
console.log(`wrote ${out}: ${Object.keys(res.packages).length} packages`);
