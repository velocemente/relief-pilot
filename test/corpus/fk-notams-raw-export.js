#!/usr/bin/env node
// Exports what the FlightKeys parser hands the NOTAM ruleset for every airport of the 26 FlightKeys
// packages — notamsRaw (the NOTAM section as printed, type headings included), notams (the item
// text with no heading), the items' IDs and categories, and the airport's role windows — so that
// the NOTAM v1.14.0 tests (TC-172) and the change list read exactly the parser's text without
// needing the parser itself: CI reads the fixtures' expected/ file (ofp-flightkeys v0.3.0, merged
// in velocemente/relief-pilot#63; --fk-parser defaults to the manifest's ofp-flightkeys module).
//
//   node test/corpus/fk-notams-raw-export.js --fk-parser <ofp-flightkeys-v0.3.0.js> [--fixtures <dir>]
//        --out <fixtures>/expected/notam-rules-v1.14.0/fk-notams-raw.json
//
// The output holds NOTAM text from the private fixtures: it is written to the PRIVATE fixtures
// repository only (expected/), never to this repository. No crew data: the parser's airport
// NOTAM blocks carry none.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { findFixtures, readManifest } = require('../lib/app-path');
const { nodeAircraftProfile } = require('../lib/acft');

const ROOT = path.resolve(__dirname, '..', '..');
const RULES = path.join(ROOT, 'rules');
const MAN = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function parseArgs(argv) {
  const o = { fixtures: null, fkParser: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--fixtures') o.fixtures = argv[++i];
    else if (k === '--fk-parser') o.fkParser = argv[++i];
    else if (k === '--out') o.out = argv[++i];
    else { console.error(`unknown argument: ${k}`); process.exit(2); }
  }
  o.fkParser = o.fkParser || path.join(RULES, MAN['ofp-flightkeys'].file);
  if (!o.out) { console.error('--out <file> is required'); process.exit(2); }
  o.fixtures = findFixtures(o.fixtures);
  if (!o.fixtures) { console.error('fixtures directory not found'); process.exit(2); }
  return o;
}

// The evaluation time of one role window: its midpoint (minutes of the UTC day), as TC-162 does.
const hm = s => { const m = /(\d{2}) (\d{2}):(\d{2})/.exec(s); return { d: +m[1], m: +m[2] * 60 + +m[3] }; };
const windowsOf = a => ((a.briefing && a.briefing.roles) || []).map(x => {
  const s = hm(x.start), e = hm(x.end);
  return { role: x.role === 'DEPARTURE' ? 'ORIG' : 'DEST', eta: (s.m + Math.round(((e.d - s.d) * 1440 + e.m - s.m) / 2) + 1440) % 1440, name: x.role };
});

function exportAll(o) {
  const FK = require(path.resolve(o.fkParser));
  const NR = require(path.join(RULES, MAN['notam-rules'].file));   // the parser cuts its runs with the built ruleset
  const icaoFpl = require(path.join(RULES, MAN['icao-fpl'].file));
  const AP = nodeAircraftProfile();
  const out = {
    _about: 'NOTAM ruleset v1.14.0 (TC-172, change list): per FlightKeys package and airport, what the FlightKeys parser gives the NOTAM ruleset: notamsRaw (type headings included), notams (no heading), the items (ID, category) and the role windows (midpoint ETA, minutes of the UTC day). Made by relief-pilot test/corpus/fk-notams-raw-export.js. PRIVATE: NOTAM text of the fixtures; no crew data.',
    parser: { file: path.relative(ROOT, path.resolve(o.fkParser)), sha256: sha(fs.readFileSync(o.fkParser)) },
    notamRules: { file: MAN['notam-rules'].file, sha256: MAN['notam-rules'].sha256 },
    packages: {},
  };
  for (const fx of readManifest(o.fixtures).fixtures.filter(f => f.format === 'flightkeys')) {
    const text = fs.readFileSync(path.join(o.fixtures, fx.files.text), 'utf8');
    const items = JSON.parse(fs.readFileSync(path.join(o.fixtures, fx.files.items), 'utf8'));
    const r = FK.parseFlightKeys(FK.inputFromExtractor(text, items), { icaoFpl, aircraftProfile: AP, notamRules: NR });
    const dep = /^\d{4}$/.test(r.offFromOFP || '') ? (+r.offFromOFP.slice(0, 2)) * 60 + +r.offFromOFP.slice(2) : null;
    const pkg = { date: fx.date, acftType: r.acftType || null, depMin: dep, airports: {} };
    for (const [icao, a] of Object.entries(r.airportData || {})) {
      if (typeof a.notamsRaw !== 'string') throw new Error(`${fx.id}: the parser gives no notamsRaw (needs ofp-flightkeys v0.3.0 or later)`);
      if (!a.notamsRaw.trim()) continue;
      pkg.airports[icao] = { notamsRaw: a.notamsRaw, notams: a.notams, items: (a.notamItems || []).map(i => ({ id: i.id, category: i.category })), windows: windowsOf(a) };
    }
    out.packages[fx.id] = pkg;
  }
  return out;
}

module.exports = { exportAll, windowsOf };

if (require.main === module) {
  const o = parseArgs(process.argv.slice(2));
  const out = exportAll(o);
  fs.mkdirSync(path.dirname(o.out), { recursive: true });
  fs.writeFileSync(o.out, JSON.stringify(out, null, 1) + '\n');
  const n = Object.values(out.packages).reduce((s, p) => s + Object.keys(p.airports).length, 0);
  const it = Object.values(out.packages).reduce((s, p) => s + Object.values(p.airports).reduce((t, a) => t + a.items.length, 0), 0);
  console.log(`${Object.keys(out.packages).length} packages, ${n} airports, ${it} items → ${o.out}`);
}
