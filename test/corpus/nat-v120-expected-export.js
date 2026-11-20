#!/usr/bin/env node
// Exports the values the NAT ruleset v1.2.0 (rules/nat-rules-next, step 5d-3) gives on the fixtures, for the
// pinned checks of TC-173 (test/rules/nat-rules.test.js):
//   fk       per FlightKeys package with NAT pages: the filed track letter ofp-flightkeys reads (O-57), and per
//            NAT message: TMI, direction, validity, the natTrack the parser returns for it (tracks: id, waypoints,
//            posted levels, validity, assigned), SHA-256 of the two comment strings
//   navblue  the NavBlue / eOFP calls: how many, how many return a track object, the tracks, and every track whose
//            output differs from src/nat.html v1.1.0 (O-65): fixture, direction, track, old → new
//
//   node test/corpus/nat-v120-expected-export.js [--fixtures <dir>]
//        --out <fixtures>/expected/nat-rules-v1.2.0/nat.json
//
// The file is written to the PRIVATE fixtures repository only (expected/), never to this repository. NAT track
// messages carry no crew data; the NavBlue lines are tracks and levels only.
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

const modFile = path.join(RULES, MAN['nat-rules-next'].file);
const nat = require(modFile);
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'nat.html'), 'utf8'), { window: win });
const v11 = win.parseNatTrack;
const fkMod = require(path.join(RULES, MAN['ofp-flightkeys'].file));
const nbMod = require(path.join(RULES, MAN['ofp-navblue'].file));
const OPTS = {
  icaoFpl: require(path.join(RULES, MAN['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MAN['aircraft-profile'].file)),
  notamRules: require(path.join(RULES, MAN['notam-rules'].file)),
  parseNatTrack: v11,
};
const flat = r => r.blocks.flatMap(b => b.tracks.map(t => [b.dir, t]));
const res = {
  _about: 'nat-rules v1.2.0 (step 5d-3) values on the fixtures, for TC-173 (relief-pilot test/rules/nat-rules.test.js); made by test/corpus/nat-v120-expected-export.js.',
  module: { version: nat.RULESET_VERSION, sha256: sha(fs.readFileSync(modFile)) },
  fk: {}, navblue: { calls: 0, tracksObjects: 0, tracks: 0, changed: [] },
};
const man = readManifest(FIX);
for (const fx of man.fixtures.filter(f => f.format === 'flightkeys')) {
  const text = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8');
  const items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
  const r = fkMod.parseFlightKeys(fkMod.inputFromExtractor(text, items), OPTS);
  if (!r.natMessages.length) continue;
  const filed = r.natTrack ? r.natTrack.assignedId : null;
  res.fk[fx.id] = {
    orig: r.origIcao, dest: r.destIcao, filed,
    messages: r.natMessages.map(m => {
      const f = [];
      const t = nat.parseNatTrack(m.text, r.origIcao, r.destIcao, { filed, findings: f });
      return {
        tmi: m.tmi, direction: m.direction, valid: m.valid, selected: m.selected,
        assignedId: t.assignedId, flightDir: t.flightDir,
        tracks: flat(t).map(([d, k]) => [d, k.id, k.waypoints, k.fl, k.valid, k.assigned]),
        eastComments: sha(t.eastComments), westComments: sha(t.westComments),
        findings: f.map(x => [x.level, x.code]),
      };
    }),
  };
}
for (const fx of man.fixtures.filter(f => f.format !== 'flightkeys')) {
  const raw = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8');
  nbMod._ofpRulesetParse(raw, { parseNatTrack: (t, o, d) => {
    const a = v11(t, o, d), b = nat.parseNatTrack(t, o, d);
    res.navblue.calls++;
    if (a) {
      res.navblue.tracksObjects++;
      const A = flat(a), B = flat(b);
      res.navblue.tracks += A.length;
      A.forEach(([dir, k], i) => { if (k.fl !== B[i][1].fl) res.navblue.changed.push([fx.id, dir, k.id, k.fl, B[i][1].fl]); });
    }
    return a;
  } });
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
console.log(`wrote ${out}: ${Object.keys(res.fk).length} FlightKeys NAT packages, ${res.navblue.calls} NavBlue calls, ${res.navblue.changed.length} changed level lines`);
