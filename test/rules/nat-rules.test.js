'use strict';
/**
 * TC-173 — NAT ruleset v1.2.0 (rules/nat-rules, step 5d-3; built into the app at step 5e-1, D77). Exec answers
 * O-57 … O-67 and D74 (19–20 Nov 2026). The series is TC-173: TC-172 (NOTAM v1.14.0) was the last used.
 * Step 5e-1 (O-79): the manifest key is nat-rules (folder rules/nat-rules/); the v1.1.0 parser is removed from
 * src/nat.html; its frozen copy test/oracle/nat-v1.1.0.html (src/nat.html at v1.1.0, byte for byte) is "v1.1.0" here.
 *
 *   TC-173-001  module identity: listed in rules/manifest.json as nat-rules 1.2.0 with its SHA-256; built into
 *               index.html once, before src/nat.html, which binds window.parseNatTrack to it; v1.1.0 oracle pinned (D77, O-79)
 *   TC-173-002  NavBlue code verbatim from src/nat.html v1.1.0 (the oracle copy) — one edited line (O-65); the region sets equal;
 *               a changed copy is detected (negative)                                               (scope 0)
 *   TC-173-003  levelText: contiguous → range, gapped → as posted, one level; negatives              (O-65)
 *   TC-173-010  NavBlue / eOFP on the 30 fixtures: byte-identical to v1.1.0 except the level text of gapped
 *               lists; the changed lines listed; the options argument ignored on NavBlue text       (scope 0, O-65)
 *   TC-173-011  O-65 independent reading: 126 Atlantic tracks printed, 31 gapped lists; 113 tracks in the output,
 *               26 changed lines + 5 on ELLX-KHSV (null, O-66); each new text = the printed list; contiguous unchanged
 *   TC-173-012  O-66: Atlantic test NAM ↔ EUR by ICAO prefix; ELLX-KHSV null; non-Atlantic null (synthetic)
 *   TC-173-020  FlightKeys messages on the fixtures: 5 packages, 6 messages, 42 tracks, 36 short coordinates
 *               (9999/99 form) converted; direction, TMI, validity, levels, remarks; pinned values (expected/)
 *   TC-173-021  PBCS "TRACK x" list lines (3 of 6 messages) are never tracks; synthetic positive / negative
 *   TC-173-022  remarks with line breaks to the message's direction, the other direction empty         (O-62, D54)
 *   TC-173-030  filed track (O-57, O-58, O-59, O-61): L11 W filed; letter not in the message → exact WARN, no track
 *               marked, no other-direction search; random routes L08 L12 L22 L23 → INFO, none marked
 *   TC-173-031  the parser never reads a route, remarks, NOTAM text, NATO / NATS: synthetic and L11's NATX NOTAM text,
 *               TRACK V / W NOTAM text                                                               (O-57, O-58)
 *   TC-173-032  O-60: no validity check, no validity WARN (L12 and synthetic)
 *   TC-173-040  one direction only / both (O-67; D74): L08 west-only, L22 east-only, L12 both; each message is read
 *   TC-173-041  ofp-flightkeys (the manifest version) with v1.2.0 injected, 3 arguments: the 21 packages without NAT byte-identical,
 *               the 5 NAT packages differ in natTrack only, findings identical, a track object on all 5 (scope 3, 4)
 *   TC-173-042  scope 3 synthetic: every unreadable case is a named WARN / INFO, never raw text
 *   TC-173-050  O-62 shape: key order, coordinate forms, validity MM/DD-HHMM, mach '', rawFallback ''
 *   TC-173-090  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Synthetic cases are labelled "synthetic": NAT track messages in the printed layout with invented track lines.
 * Fixture tests assert counts, letters, TMIs and pinned values from the private fixtures repo
 * (expected/nat-rules-v1.2.0/nat.json). No fixture text is printed or asserted here.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const vm     = require('vm');
const { findFixtures, readManifest } = require('../lib/app-path');
const { assemble, MODULES } = require('../../build/build');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const NAT_REL  = MANIFEST['nat-rules'].file;
const natSrc   = fs.readFileSync(path.join(RULES, NAT_REL), 'utf8');
const nat      = require(path.join(RULES, NAT_REL));
const fkMod    = require(path.join(RULES, MANIFEST['ofp-flightkeys'].file));
const nbMod    = require(path.join(RULES, MANIFEST['ofp-navblue'].file));
const BASE_OPTS = {
  icaoFpl: require(path.join(RULES, MANIFEST['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MANIFEST['aircraft-profile'].file)),
  notamRules: require(path.join(RULES, MANIFEST['notam-rules'].file)),
};
const EXPECTED_FILE = path.join('expected', 'nat-rules-v1.2.0', 'nat.json');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

// The app's NAT parser v1.1.0 before step 5e-1 (src/nat.html, window.parseNatTrack): the frozen copy (O-79).
const appSrc = fs.readFileSync(path.join(ROOT, 'test', 'oracle', 'nat-v1.1.0.html'), 'utf8');
const appWin = {};
vm.runInNewContext(appSrc, { window: appWin });
const v11 = appWin.parseNatTrack;
const SRC_NAT_SHA256 = '4fa953e938dd09805eee31f4cf88b0f718109afb50333cb43be0686be5fb78a0';   // src/nat.html v1.1.0 = test/oracle/nat-v1.1.0.html

const flat = r => r.blocks.flatMap(b => b.tracks.map(t => [b.dir, t]));
const codes = f => f.map(x => x.level + ':' + x.code);

// ── fixtures (a missing fixtures directory FAILS, TC-173-090) ────────────────
const FIX = findFixtures(process.env.PB_FIXTURES || null);
const fixtureTest = (name, fn) => test(name, () => { assert.ok(FIX, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)'); return fn(); });
const readText = fx => fs.readFileSync(path.join(FIX, fx.files.text), 'utf8');
let _man = null, _fk = null, _nb = null, _pinned = null;
const manifest = () => (_man = _man || readManifest(FIX));
const pinned = () => (_pinned = _pinned || JSON.parse(fs.readFileSync(path.join(FIX, EXPECTED_FILE), 'utf8')));

// FlightKeys packages with NAT pages, parsed by ofp-flightkeys (the manifest version) with v1.1.0 injected: { fx, text, r }.
function fkPackages() {
  if (_fk) return _fk;
  _fk = [];
  for (const fx of manifest().fixtures.filter(f => f.format === 'flightkeys')) {
    const text = readText(fx);
    if (!/^NAT-TRACKS$/m.test(text)) continue;
    const items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
    const r = fkMod.parseFlightKeys(fkMod.inputFromExtractor(text, items), { ...BASE_OPTS, parseNatTrack: v11 });
    _fk.push({ fx, text, r });
  }
  return _fk;
}
const L = { L08: 'KMIA-EHBK', L11: 'KGSP-EPWA', L12: 'EBLG-KORD', L22: 'EPPW-KPSM', L23: 'KDOV-ETAR' };
const pkg = k => fkPackages().find(p => p.fx.id.includes(L[k]));

// NavBlue / eOFP: every call of the NAT parser: { fx, raw, t, o, d, a (v1.1.0), b (v1.2.0) }.
function nbCalls() {
  if (_nb) return _nb;
  _nb = [];
  for (const fx of manifest().fixtures.filter(f => f.format !== 'flightkeys')) {
    const raw = readText(fx);
    nbMod._ofpRulesetParse(raw, { parseNatTrack: (t, o, d) => {
      const a = v11(t, o, d);
      _nb.push({ fx, raw, t, o, d, a, b: nat.parseNatTrack(t, o, d) });
      return a;
    } });
  }
  return _nb;
}

// ── synthetic messages (invented tracks in FlightKeys' printed layout) ──────
const WEST_V = 'NOV 03/1130Z TO NOV 03/1900Z', EAST_V = 'NOV 04/0100Z TO NOV 04/0800Z';
const ln = (id, route, east, west) => [`${id} ${route}`, `EAST LVLS ${east}`, `WEST LVLS ${west}`, `EUR RTS ${east === 'NIL' ? 'WEST' : 'EAST'} NIL`, 'NAR NIL-'];
const eTrack = (id, route, lv = '340 350 360 370 380 390 400') => ln(id, route, lv, 'NIL');
const wTrack = (id, route, lv = '340 350 360 370 380 390 400') => ln(id, route, 'NIL', lv);
function msg(tracks, { valid = EAST_V, remarks = ['1.TMI IS 301.', '2.SEND RCL 90-60 MINUTES PRIOR TO OCEANIC ENTRY POINT.', 'INCLUDE MAX LEVEL IN RCL.-'] } = {}) {
  const lines = ['(NAT-1/1 TRACKS FLS 340/400 INCLUSIVE', valid, 'PART ONE OF ONE PARTS-'];
  tracks.forEach(t => lines.push(...t));
  if (remarks) lines.push('REMARKS:', ...remarks);
  lines.push('END OF PART ONE OF ONE PARTS)');
  return lines.join('\n');
}
const E3 = () => [eTrack('V', 'NICSO 48/50 51/40 53/30 53/20 MALOT GISTI'), eTrack('W', 'PORTI 47/50 50/40 52/30 52/20 LIMRI XETBO'), eTrack('Z', 'DOVEY 42/60 44/50 47/40 49/30 49/20 BEDRA NASBA', '360 380 400')];
const run = (t, o, d, opts) => { const f = []; const r = nat.parseNatTrack(t, o, d, { findings: f, ...(opts || {}) }); return { r, f }; };

// ══ TC-173-001 / 002 / 003 ═════════════════════════════════════════════════
test('TC-173-001 module identity: manifest entry nat-rules and SHA-256; built into index.html once, before src/nat.html; v1.1.0 oracle pinned (D77, O-79)', () => {
  const e = MANIFEST['nat-rules'];
  assert.equal(e.version, '1.2.0');
  assert.equal(e.file, 'nat-rules/nat-rules-v1.2.0.js');
  assert.equal(e.sha256, sha(fs.readFileSync(path.join(RULES, NAT_REL))));
  assert.equal(nat.RULESET_TYPE, 'nat-rules'); assert.equal(nat.RULESET_VERSION, '1.2.0');
  assert.deepEqual(Object.keys(nat).sort(), ['FINDING_CODES', 'RULESET_SOURCE', 'RULESET_TYPE', 'RULESET_VERSION', 'SCHEMA_VERSION', 'levelText', 'parseNatTrack']);
  assert.equal(MODULES.filter(m => m && m.rule === 'nat-rules').length, 1, 'build/build.js lists nat-rules once');
  assert.equal(MODULES.findIndex(m => m && m.rule === 'nat-rules') + 1, MODULES.indexOf('nat.html'), 'just before src/nat.html');
  assert.ok(!MANIFEST['nat-rules-next'] && !MODULES.some(m => m && m.rule === 'nat-rules-next'), 'no nat-rules-next key (O-79)');
  const app = assemble().toString('utf8');
  assert.equal(app.split(natSrc).length, 2, 'the assembled app contains the module once, byte for byte');
  assert.equal(sha(Buffer.from(appSrc)), SRC_NAT_SHA256, 'the v1.1.0 oracle is src/nat.html v1.1.0, byte for byte');
  assert.equal(appWin.NAT_RULES_VERSION, '1.1.0');
  assert.ok(!/function parseNatTrack\(/.test(fs.readFileSync(path.join(ROOT, 'src', 'nat.html'), 'utf8')), 'src/nat.html has no parser of its own');
  assert.ok(assemble().equals(fs.readFileSync(path.join(ROOT, 'index.html'))), 'index.html is the build of src/ and rules/');
  // negative: one byte of the module changed → the SHA-256 no longer matches
  assert.notEqual(e.sha256, sha(Buffer.from(natSrc.replace('1.2.0', '1.2.1'))));
});

test('TC-173-002 NavBlue code verbatim from src/nat.html v1.1.0, one edited line (O-65); regions equal; a changed copy is detected', () => {
  const lines = appSrc.split('\n');
  const body = lines.slice(58, 184).join('\n');                                  // lines 59–184 of src/nat.html v1.1.0 (the oracle copy)
  const EDIT_OLD = "            fl = 'FL' + flListM[2] + '\\u2013' + flListM[3];";
  assert.equal(body.split(EDIT_OLD).length, 2, 'the one line v1.2.0 edits is in v1.1.0 once');
  const first = natSrc.indexOf('function _parseOfpText(t, origIcao, destIcao) {\n') + 'function _parseOfpText(t, origIcao, destIcao) {\n'.length;
  const copy = natSrc.slice(first, natSrc.indexOf('\n}\n\n// ═', first));
  const expected = body.replace(EDIT_OLD, "            fl = levelText(flListM[1].split(/\\s+/));   // v1.2.0 (O-65): a gapped list is posted as is; v1.1.0: 'FL' + first + '\\u2013' + last");
  assert.equal(copy, expected, 'v1.2.0 § 3 equals v1.1.0 lines 59–184 but for the marked line');
  const region = re => new RegExp(`var ${re} = (/.*/);`).exec(natSrc)[1];
  const regionApp = re => new RegExp(`var ${re}\\s+= (/.*/);`).exec(appSrc)[1];
  assert.equal(region('NAM'), regionApp('NAM')); assert.equal(region('EUR'), regionApp('EUR'));
  // negative: a copy with one waypoint pattern changed is not equal
  assert.notEqual(copy.replace('{3,5}', '{3,6}'), expected);
});

test('TC-173-003 levelText (O-65): contiguous → range; gapped → as posted; one level; negatives', () => {
  const f = nat.levelText;
  assert.equal(f(['340', '350', '360', '370', '380', '390', '400']), 'FL340–400');
  assert.equal(f(['360', '370']), 'FL360–370');
  assert.equal(f(['360', '380', '400']), 'FL360 380 400');
  assert.equal(f(['350', '360', '370', '390']), 'FL350 360 370 390');
  assert.equal(f(['340', '360']), 'FL340 360');
  assert.equal(f(['340']), 'FL340');
  assert.equal(f([]), '');
  assert.notEqual(f(['360', '380', '400']), 'FL360–400', 'never the range of a gapped list');
  assert.equal(f([360, 380, 400]), 'FL360 380 400', 'numbers as well');
});

// ══ TC-173-010 / 011 / 012 NavBlue ═════════════════════════════════════════
const printedGapped = raw => {                       // independent reading of the printed tracks of a NavBlue / eOFP text
  const ls = raw.split('\n'); const out = [];
  ls.forEach((l, i) => {
    if (!/^\s*NAT\s+[A-Z]\s+VALID\s+FROM/.test(l)) return;
    for (let j = i + 1; j < Math.min(i + 6, ls.length); j++) {
      const m = /^\s*FL\s*:\s*([\d ]+)$/.exec(ls[j]);
      if (m) { const v = m[1].trim().split(/\s+/).map(Number); out.push({ id: /NAT\s+([A-Z])/.exec(l)[1], list: v, gapped: v.some((x, k) => k && x - v[k - 1] !== 10) }); return; }
    }
    out.push({ id: /NAT\s+([A-Z])/.exec(l)[1], list: null, gapped: false });
  });
  return out;
};

fixtureTest('TC-173-010 NavBlue / eOFP: 30 fixtures byte-identical to v1.1.0 except the level text of gapped lists; changed lines listed; options ignored on NavBlue text', () => {
  const calls = nbCalls();
  assert.equal(calls.length, 30, 'one NAT parser call per NavBlue / eOFP fixture');
  const changed = []; let tracks = 0, objs = 0, nulls = 0;
  for (const c of calls) {
    if (c.a === null) { assert.equal(c.b, null, `${c.fx.id}: null stays null`); nulls++; continue; }
    objs++;
    const A = flat(c.a), B = flat(c.b);
    assert.equal(A.length, B.length, `${c.fx.id}: same tracks`); tracks += A.length;
    assert.deepEqual(Object.keys(c.b), Object.keys(c.a));
    A.forEach(([d, k], i) => {
      assert.equal(B[i][0], d);
      const { fl: fa, ...ra } = k, { fl: fb, ...rb } = B[i][1];
      assert.equal(JSON.stringify(rb), JSON.stringify(ra), `${c.fx.id} ${d} ${k.id}: every field but fl identical`);   // v1.1.0 runs in its own vm context: compare as JSON
      if (fa !== fb) changed.push([c.fx.id, d, k.id, fa, fb]);
    });
    const { blocks: _a, ...ca } = c.a, { blocks: _b, ...cb } = c.b;
    assert.equal(JSON.stringify(cb), JSON.stringify(ca), `${c.fx.id}: every field but blocks identical`);
    // the second form of the call (the options argument) changes nothing on NavBlue text
    assert.deepStrictEqual(nat.parseNatTrack(c.t, c.o, c.d, { filed: 'Z', findings: [] }), c.b, `${c.fx.id}: options ignored`);
  }
  console.log(`TC-173-010: ${calls.length} calls, ${objs} track objects, ${nulls} null, ${tracks} tracks; ${changed.length} changed level lines:`);
  changed.forEach(c => console.log(`   ${c[0]} ${c[1]} ${c[2]}: ${c[3]} -> ${c[4]}`));
  assert.equal(objs, 8); assert.equal(nulls, 22); assert.equal(tracks, 113);
  assert.equal(changed.length, 26);
  assert.ok(changed.every(c => /^FL\d{3}–\d{3}$/.test(c[3]) && /^FL\d{3}( \d{3})+$/.test(c[4])), 'old range → new posted list, nothing else');
  assert.deepEqual(changed, pinned().navblue.changed, 'the changed lines equal the pinned list (expected/)');
  assert.equal(pinned().navblue.tracks, 113);
  // negative: the comparison would see a one-field change (a waypoint dropped from one track)
  const some = calls.find(c => c.b); const bad = JSON.parse(JSON.stringify(some.b)); bad.blocks[0].tracks[0].waypoints.pop();
  assert.notDeepEqual(flat(bad)[0][1], flat(some.a)[0][1]);
});

fixtureTest('TC-173-011 O-65 independent reading: 126 Atlantic tracks printed, 31 gapped; 26 changed in the output + 5 on ELLX-KHSV (null); each new text = the printed list', () => {
  const calls = nbCalls(); let printed = 0, gapped = 0;
  const atl = calls.filter(c => c.a !== null || c.fx.id.includes('ELLX'));      // the Atlantic packages: a track object, or ELLX-KHSV (null by O-66)
  for (const c of atl) {
    const p = printedGapped(c.raw); printed += p.length; gapped += p.filter(x => x.gapped).length;
    if (!c.b) continue;
    flat(c.b).forEach(([d, k]) => {
      const q = p.find(x => x.id === k.id && x.list && k.fl); assert.ok(q, `${c.fx.id} ${k.id}: printed`);
      const expect = q.gapped ? 'FL' + q.list.join(' ') : 'FL' + q.list[0] + '–' + q.list[q.list.length - 1];
      assert.equal(k.fl, expect, `${c.fx.id} ${d} ${k.id}`);
    });
  }
  const ellx = calls.find(c => c.fx.id.includes('ELLX-KHSV'));
  assert.equal(ellx.b, null); assert.equal(ellx.a, null);
  const ellxGap = printedGapped(ellx.raw);
  assert.equal(printed, 126); assert.equal(gapped, 31);
  assert.equal(ellxGap.length, 13); assert.equal(ellxGap.filter(x => x.gapped).length, 5);
  console.log(`TC-173-011: printed ${printed}, gapped ${gapped}; output tracks 113, changed 26; ELLX-KHSV 13 printed, 5 gapped, not in the output`);
  // negative: a contiguous list never changes — exactly the gapped lists of the output differ
  let diffs = 0, gappedInOutput = 0;
  calls.filter(c => c.b).forEach(c => {
    const pr = printedGapped(c.raw);
    flat(c.b).forEach(([, k], i) => {
      const gap = pr.find(x => x.id === k.id).gapped, differs = flat(c.a)[i][1].fl !== k.fl;
      assert.equal(differs, gap, `${c.fx.id} ${k.id}: changed only when gapped`);
      if (differs) diffs++; if (gap) gappedInOutput++;
    });
  });
  assert.equal(diffs, 26); assert.equal(gappedInOutput, 26);
});

test('TC-173-012 O-66: Atlantic test NAM ↔ EUR by ICAO prefix; non-Atlantic null (synthetic)', () => {
  const t = msg([eTrack('V', 'NICSO 48/50 51/40 53/30 53/20 MALOT GISTI')]);
  assert.ok(nat.parseNatTrack(t, 'KJFK', 'EGLL')); assert.ok(nat.parseNatTrack(t, 'EGLL', 'KJFK'));
  assert.equal(nat.parseNatTrack(t, 'KJFK', 'EGLL').flightDir, 'EAST'); assert.equal(nat.parseNatTrack(t, 'EGLL', 'KJFK').flightDir, 'WEST');
  for (const [o, d] of [['ELLX', 'KHSV'], ['KHSV', 'ELLX'], ['OMDB', 'EGLL'], ['KLAX', 'RJAA'], ['KJFK', 'KLAX'], ['EGLL', 'LFPG'], ['RJAA', 'PANC']]) {
    assert.equal(nat.parseNatTrack(t, o, d), null, `${o}-${d}`);
    assert.equal(nat.parseNatTrack(t, o, d), v11(t, o, d), `${o}-${d} as v1.1.0`);
  }
});

// ══ TC-173-020 … 022 FlightKeys messages on the fixtures ═══════════════════
const independent = text => {                         // tracks printed in a message text: letter, route tokens, east / west levels
  const ls = text.split('\n').map(x => x.trim()); const out = [];
  ls.forEach((l, i) => { const m = /^([A-Z]) (\S.*)$/.exec(l); if (m && /^EAST LVLS/.test(ls[i + 1] || '')) out.push({ id: m[1], route: m[2].split(' '), east: ls[i + 1].slice(9).trim(), west: ls[i + 2].slice(9).trim() }); });
  return out;
};

fixtureTest('TC-173-020 FlightKeys messages on the fixtures: 5 packages, 6 messages, 42 tracks, 36 short coordinates; pinned values', () => {
  const P = fkPackages();
  assert.equal(P.length, 5, 'packages with NAT pages');
  const msgs = P.flatMap(p => p.r.natMessages.map(m => ({ p, m })));
  assert.equal(msgs.length, 6);
  let tracks = 0, short = 0, shortOut = 0;
  const pin = pinned();
  assert.equal(pin.module.sha256, MANIFEST['nat-rules'].sha256, 'the pinned values are of this module');
  for (const { p, m } of msgs) {
    const filed = p.r.natTrack ? p.r.natTrack.assignedId : null;
    const { r, f } = run(m.text, p.r.origIcao, p.r.destIcao, { filed });
    const ind = independent(m.text);
    assert.equal(flat(r).length, ind.length, `${p.fx.id}: every printed track read`);
    assert.equal(r.tmi, m.tmi); assert.equal(r.rawFallback, ''); assert.equal(r.trackType, 'NAT');
    assert.equal(r.blocks.length, 1); assert.equal(r.blocks[0].dir, m.direction);
    assert.equal(r.flightDir, /^K|^CY|^PA/.test(p.r.origIcao) ? 'EAST' : 'WEST');
    flat(r).forEach(([d, k], i) => {
      assert.equal(k.id, ind[i].id);
      assert.equal(k.waypoints.length, ind[i].route.length, `${k.id}: one waypoint per printed token`);
      assert.ok(k.waypoints.every(w => /^(?:[A-Z]{3,5}|\d{2}N\d{3}W|\d{4}N\d{3}00W)$/.test(w)), `${k.id}: fixes and converted coordinates`);
      ind[i].route.forEach((tok, n) => { if (/^\d{4}\/\d{2}$/.test(tok)) { short++; if (/^\d{4}N\d{3}00W$/.test(k.waypoints[n])) shortOut++; assert.equal(k.waypoints[n], tok.slice(0, 4) + 'N0' + tok.slice(5) + '00W'); } });
      const lv = (m.direction === 'EAST' ? ind[i].east : ind[i].west).split(' ');
      assert.equal(k.fl, nat.levelText(lv));
      assert.equal(k.mach, '');
      assert.match(k.valid, /^11\/\d{2}-\d{4}–11\/\d{2}-\d{4}$/);
      tracks++;
    });
    assert.ok(f.every(x => x.level === 'INFO'), `${p.fx.id}: no WARN on the real messages: ${codes(f)}`);
    // pinned values (expected/)
    const pm = pin.fk[p.fx.id].messages.find(x => x.tmi === m.tmi && x.direction === m.direction);
    assert.ok(pm, `${p.fx.id}: pinned message`);
    assert.deepEqual(flat(r).map(([d, k]) => [d, k.id, k.waypoints, k.fl, k.valid, k.assigned]), pm.tracks);
    assert.equal(sha(r.eastComments), pm.eastComments); assert.equal(sha(r.westComments), pm.westComments);
    assert.deepEqual(codes(f).map(x => x.split(':')), pm.findings);
  }
  console.log(`TC-173-020: 5 packages, 6 messages, ${tracks} tracks, ${short} short coordinates (9999/99) → ${shortOut} converted`);
  assert.equal(tracks, 42); assert.equal(short, 36); assert.equal(shortOut, 36);
  // negative: no raw-text fallback and no unconverted "nn/nn" token reaches a waypoint
  msgs.forEach(({ p, m }) => assert.ok(!flat(nat.parseNatTrack(m.text, p.r.origIcao, p.r.destIcao)).some(([, k]) => k.waypoints.some(w => /\//.test(w)))));
});

fixtureTest('TC-173-021 PBCS "TRACK x" list lines (3 of 6 messages) are never tracks; synthetic positive / negative', () => {
  const msgs = fkPackages().flatMap(p => p.r.natMessages.map(m => ({ p, m })));
  const withPbcs = msgs.filter(({ m }) => /^TRACK [A-Z]$/m.test(m.text));
  assert.equal(withPbcs.length, 3, 'messages with a PBCS track list');
  for (const { p, m } of withPbcs) {
    const r = nat.parseNatTrack(m.text, p.r.origIcao, p.r.destIcao);
    const listed = (m.text.match(/^TRACK ([A-Z])$/gm) || []).length;
    assert.ok(listed >= 3);
    assert.equal(flat(r).length, independent(m.text).length, 'tracks = printed track lines only');
    assert.ok(flat(r).every(([, k]) => k.waypoints.length >= 3), 'each track has its route; a "TRACK x" line has none');
    assert.equal(new Set(flat(r).map(([, k]) => k.id)).size, flat(r).length, 'no letter twice');
  }
  // synthetic positive: PBCS lines in the remarks beside two real tracks → two tracks
  const s = msg([eTrack('V', 'NICSO 48/50 51/40 53/30 53/20 MALOT GISTI'), eTrack('W', 'PORTI 47/50 50/40 52/30 52/20 LIMRI XETBO')], { remarks: ['1.TMI IS 301.', '3.PBCS OTS LEVELS 340-400.PBCS TRACKS AS FOLLOWS:', 'TRACK V', 'TRACK W', 'TRACK X', 'END OF PBCS OTS.-'] });
  const { r, f } = run(s, 'KJFK', 'EGLL');
  assert.deepEqual(flat(r).map(([, k]) => k.id), ['V', 'W']);
  assert.ok(/TRACK X/.test(r.eastComments), 'the list stays in the remarks as printed');
  assert.deepEqual(codes(f), ['INFO:NAT-RANDOM-ROUTE']);
  // synthetic negative: only PBCS lines → no track, a named WARN
  const n = run(msg([], { remarks: ['1.TMI IS 301.', 'PBCS TRACKS AS FOLLOWS', 'TRACK A', 'TRACK B', 'END OF PBCS OTS.-'] }), 'KJFK', 'EGLL');
  assert.deepEqual(n.r.blocks, []); assert.ok(codes(n.f).includes('WARN:NAT-NO-TRACKS'));
});

fixtureTest('TC-173-022 remarks with their line breaks go to the message\'s direction; the other direction is empty (O-62, D54)', () => {
  for (const { p, m } of fkPackages().flatMap(p => p.r.natMessages.map(m => ({ p, m })))) {
    const r = nat.parseNatTrack(m.text, p.r.origIcao, p.r.destIcao);
    const [mine, other] = m.direction === 'EAST' ? [r.eastComments, r.westComments] : [r.westComments, r.eastComments];
    assert.equal(other, '');
    assert.match(mine, /^1\.\s?TMI IS \d{3}\./);
    const i = m.text.search(/^REMARKS[:.]/m), j = m.text.lastIndexOf('END OF PART');
    const printed = m.text.slice(i, m.text.lastIndexOf('END OF PART')).split('\n').slice(1).join('\n').trim().replace(/-\s*$/, '').trim();
    assert.equal(mine, printed, 'as printed: line breaks kept, only the label and the closing "-" out');
    assert.ok(mine.split('\n').length > 10); assert.ok(j > i);
  }
  // synthetic: west message → westComments; the other direction empty
  const { r } = run(msg([wTrack('A', 'PIKIL 57/20 58/30 59/40 59/50 AVUTI')], { valid: WEST_V }), 'EGLL', 'KJFK');
  assert.equal(r.eastComments, ''); assert.match(r.westComments, /^1\.TMI IS 301\.\n2\./);
});

// ══ TC-173-030 … 032 filed track ═══════════════════════════════════════════
fixtureTest('TC-173-030 filed track: L11 (the Exec\'s "L27", same Drive file) W; letter not in the message → exact WARN, none marked, no other-direction search; random routes → INFO', () => {
  const p11 = pkg('L11');
  assert.equal(p11.fx.source.driveTitle, '744 NAT Track DDG with performance penalty.pdf', 'L11 is the package the Exec calls L27 (same Drive file, already in the fixtures)');
  assert.equal(p11.r.natMessages.length, 1); assert.equal(p11.r.natMessages[0].tmi, '308'); assert.equal(p11.r.natMessages[0].direction, 'EAST');
  assert.equal(p11.r.natTrack.assignedId, 'W', 'ofp-flightkeys reads W from the OFP page 1 route and the FPL route');
  const m = p11.r.natMessages[0];
  const { r, f } = run(m.text, p11.r.origIcao, p11.r.destIcao, { filed: 'W' });
  assert.equal(r.assignedId, 'W');
  assert.deepEqual(flat(r).filter(([, k]) => k.assigned).map(([, k]) => k.id), ['W']);
  assert.equal(flat(r).filter(([, k]) => !k.assigned).length, 4);
  assert.deepEqual(f, [], 'filed and printed: no finding');
  // O-59: a letter not in the chosen message
  const x = run(m.text, p11.r.origIcao, p11.r.destIcao, { filed: 'Q' });
  assert.equal(x.r.assignedId, 'Q'); assert.equal(flat(x.r).filter(([, k]) => k.assigned).length, 0); assert.equal(flat(x.r).length, 5, 'the message as selected');
  assert.deepEqual(x.f, [{ level: 'WARN', field: 'natTrack', code: 'NAT-FILED-NOT-IN-MESSAGE', message: 'FILED NAT Q NOT IN TRACK MESSAGE TMI 308 (EAST) – CHECK OCEANIC CLEARANCE' }]);
  // no other-direction search: L12 prints both directions; the westbound letter A is not in the eastbound message
  const p12 = pkg('L12'); const east = p12.r.natMessages.find(q => q.direction === 'EAST'), west = p12.r.natMessages.find(q => q.direction === 'WEST');
  assert.ok(west.text.includes('\nA ') || /^A /m.test(west.text)); assert.ok(!/^A /m.test(east.text));
  const y = run(east.text, p12.r.origIcao, p12.r.destIcao, { filed: 'A' });
  assert.equal(y.r.assignedId, 'A'); assert.equal(flat(y.r).filter(([, k]) => k.assigned).length, 0);
  assert.equal(y.f.length, 1); assert.equal(y.f[0].message, 'FILED NAT A NOT IN TRACK MESSAGE TMI 308 (EAST) – CHECK OCEANIC CLEARANCE');
  assert.ok(y.r.blocks.every(b => b.dir === 'EAST'), 'the other direction is not searched');
  // negative: a filed letter that is printed gives no WARN
  assert.ok(!codes(run(m.text, p11.r.origIcao, p11.r.destIcao, { filed: 'V' }).f).includes('WARN:NAT-FILED-NOT-IN-MESSAGE'));
  // O-61: random routes — L08, L12, L22, L23
  for (const k of ['L08', 'L12', 'L22', 'L23']) {
    const p = pkg(k); assert.equal(p.r.natTrack.assignedId, null, `${k}: no filed track`);
    for (const mm of p.r.natMessages) {
      const q = run(mm.text, p.r.origIcao, p.r.destIcao, { filed: null });
      assert.equal(q.r.assignedId, null); assert.equal(flat(q.r).filter(([, t]) => t.assigned).length, 0, `${k}: no track marked`);
      assert.ok(flat(q.r).length > 0, `${k}: the chosen message is returned`);
      assert.deepEqual(codes(q.f), ['INFO:NAT-RANDOM-ROUTE']);
    }
  }
  // invalid input is ignored with an INFO (never a letter from anything else)
  for (const bad of ['NATW', 'w', '', 'WW', 5]) {
    const q = run(m.text, 'KGSP', 'EPWA', { filed: bad });
    assert.equal(q.r.assignedId, null); assert.ok(codes(q.f).includes('INFO:NAT-FILED-IGNORED') || bad === '');
  }
});

fixtureTest('TC-173-031 the parser never reads a route, remarks, NOTAM text, NATO / NATS: L11\'s NOTAM text naming NATX and TRACK V / W; synthetic', () => {
  const p = pkg('L11'); const m = p.r.natMessages[0];
  // witnesses: the package text outside the NAT pages does name NATX and "TRACK V" / "TRACK W" (a FIR NOTAM)
  const outside = p.text.split('\nNAT-TRACKS\n').join('\n');
  assert.ok(/\bNATX\b/.test(outside), 'witness: NATX in a FIR NOTAM'); assert.ok(/\bTRACK V\b/.test(outside) && /\bTRACK W\b/.test(outside), 'witness: TRACK V / W in a FIR NOTAM');
  const r = nat.parseNatTrack(m.text, p.r.origIcao, p.r.destIcao);                   // no letter passed
  assert.equal(r.assignedId, null); assert.equal(flat(r).filter(([, k]) => k.assigned).length, 0);
  assert.equal(nat.parseNatTrack(m.text, 'KGSP', 'EPWA', { filed: 'W' }).assignedId, 'W');
  // synthetic: route and NOTAM text appended to / inside the input never become a letter
  const base = msg(E3());
  const noise = ['CO ROUTE', 'KGSP DCT NATW DCT EPWA', 'NOTAM: ROUTES WOULD BE FILED TO JOIN NATX', 'HOIST TRACK T', 'ASSIGNED NAT TRACK: V', '1. AN AIRCRAFT WISHES TO JOIN NATX FROM M201'];
  for (const text of [base + '\n' + noise.join('\n'), noise.join('\n') + '\n' + base]) {
    const q = run(text, 'KJFK', 'EGLL'); assert.equal(q.r.assignedId, null); assert.equal(flat(q.r).filter(([, k]) => k.assigned).length, 0); assert.equal(flat(q.r).length, 3);
  }
  // remarks naming NAT designators, NATO, NATS, "NAT W", "TRACK V" are not a letter
  const rem = ['1.TMI IS 301.', '8.OPERATORS SHALL FILE NAT DESIGNATORS IN FLIGHT PLANS NAT W TRACK V NATW NATO NATS NATX.-'];
  const q = run(msg(E3(), { remarks: rem }), 'KJFK', 'EGLL'); assert.equal(q.r.assignedId, null); assert.equal(flat(q.r).filter(([, k]) => k.assigned).length, 0);
  assert.match(q.r.eastComments, /NATO NATS NATX\.$/, 'the remark stays as printed');
});

fixtureTest('TC-173-032 O-60: no validity check, no validity WARN (entry or 30W): the six messages, L12, synthetic', () => {
  for (const { p, m } of fkPackages().flatMap(p => p.r.natMessages.map(m => ({ p, m })))) {
    const { f } = run(m.text, p.r.origIcao, p.r.destIcao, { filed: null });
    assert.ok(!f.some(x => x.level === 'WARN'), `${p.fx.id} ${m.tmi}: ${codes(f)}`);
    assert.ok(!f.some(x => /VALID/i.test(x.message)));
  }
  const p12 = pkg('L12');
  assert.ok(!p12.r.findings.some(x => x.field === 'natTrack' && x.level === 'WARN' && /valid/i.test(x.message)), 'L12 through ofp-flightkeys: no validity WARN');
  // synthetic: validity long before / after any entry time, year-end, an unreadable line → never a WARN
  for (const v of ['JAN 01/0000Z TO JAN 01/0001Z', 'DEC 31/2359Z TO JAN 01/0800Z', 'NOV 04/2500Z TO NOV 04/9999Z']) {
    const q = run(msg(E3(), { valid: v }), 'KJFK', 'EGLL'); assert.ok(!q.f.some(x => x.level === 'WARN'), v);
  }
  const bad = run(msg(E3(), { valid: 'NOV 04/0100Z UNTIL NOV 04/0800Z' }), 'KJFK', 'EGLL');
  assert.deepEqual(codes(bad.f).sort(), ['INFO:NAT-RANDOM-ROUTE', 'INFO:NAT-VALIDITY-UNREADABLE']); assert.ok(flat(bad.r).every(([, k]) => k.valid === ''));
});

// ══ TC-173-040 / 041 / 042 ═════════════════════════════════════════════════
fixtureTest('TC-173-040 a package carries westbound only, eastbound only or both (O-67, D74): L08, L22, L12 — each message is read, all in natMessages[]', () => {
  const p08 = pkg('L08'), p22 = pkg('L22'), p12 = pkg('L12');
  assert.deepEqual(p08.r.natMessages.map(m => m.direction), ['WEST']); assert.equal(p08.r.flightDir || (/^K/.test(p08.r.origIcao) ? 'EAST' : 'WEST'), 'EAST');
  assert.deepEqual(p22.r.natMessages.map(m => m.direction), ['EAST']); assert.ok(/^E/.test(p22.r.origIcao));
  assert.deepEqual(p12.r.natMessages.map(m => m.direction).sort(), ['EAST', 'WEST']);
  for (const p of [p08, p22]) {                                                  // one direction only: returned + the module's crew WARN
    assert.ok(p.r.natTrack, `${p.fx.id}: natTrack returned`);
    assert.ok(p.r.findings.some(x => x.level === 'WARN' && x.field === 'natTrack' && /^CREW ALERT: the package prints only the/.test(x.message)));
    assert.equal(p.r.natTrack.blocks.length, 0, 'v1.1.0 returned no track; see TC-173-041 for v1.2.0');
  }
  const r08 = nat.parseNatTrack(p08.r.natMessages[0].text, p08.r.origIcao, p08.r.destIcao), r22 = nat.parseNatTrack(p22.r.natMessages[0].text, p22.r.origIcao, p22.r.destIcao);
  assert.deepEqual(r08.blocks.map(b => [b.dir, b.tracks.length]), [['WEST', 6]]); assert.equal(r08.flightDir, 'EAST'); assert.ok(r08.westComments && !r08.eastComments);
  assert.deepEqual(r22.blocks.map(b => [b.dir, b.tracks.length]), [['EAST', 10]]); assert.equal(r22.flightDir, 'WEST'); assert.ok(r22.eastComments && !r22.westComments);
  // both: each message gives its own direction; the chosen one (higher TMI of the flight's direction: 307, WEST) goes to natTrack
  const w = p12.r.natMessages.find(m => m.direction === 'WEST'), e = p12.r.natMessages.find(m => m.direction === 'EAST');
  assert.equal(w.tmi, '307'); assert.equal(e.tmi, '308'); assert.equal(w.selected, true); assert.equal(e.selected, false);
  const rw = nat.parseNatTrack(w.text, 'EBLG', 'KORD'), re = nat.parseNatTrack(e.text, 'EBLG', 'KORD');
  assert.deepEqual(rw.blocks.map(b => [b.dir, b.tracks.length]), [['WEST', 6]]); assert.deepEqual(re.blocks.map(b => [b.dir, b.tracks.length]), [['EAST', 5]]);
  assert.equal(rw.tmi, '307'); assert.equal(re.tmi, '308'); assert.equal(rw.flightDir, 'WEST'); assert.equal(re.flightDir, 'WEST');
  // synthetic: both directions in ONE text (not how ofp-flightkeys calls it) → both blocks, the flight's direction first
  const both = msg([eTrack('V', 'NICSO 48/50 51/40 53/30 53/20 MALOT GISTI'), wTrack('A', 'PIKIL 57/20 58/30 59/40 59/50 AVUTI')]);
  assert.deepEqual(nat.parseNatTrack(both, 'EGLL', 'KJFK').blocks.map(b => b.dir), ['WEST', 'EAST']);
  assert.deepEqual(nat.parseNatTrack(both, 'KJFK', 'EGLL').blocks.map(b => b.dir), ['EAST', 'WEST']);
});

fixtureTest('TC-173-041 ofp-flightkeys (manifest version) with NAT v1.1.0 vs v1.2.0 injected (3 arguments), all 26: 21 packages byte-identical, the 5 NAT packages differ in natTrack only; a track object on all 5 (O-86)', () => {
  assert.equal(sha(fs.readFileSync(path.join(RULES, MANIFEST['ofp-flightkeys'].file))), MANIFEST['ofp-flightkeys'].sha256, 'ofp-flightkeys is the manifest file, unchanged');
  let same = 0; const diff = [];
  for (const fx of manifest().fixtures.filter(f => f.format === 'flightkeys')) {
    const text = readText(fx), items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
    const a = fkPackages().find(p => p.fx.id === fx.id)?.r || fkMod.parseFlightKeys(fkMod.inputFromExtractor(text, items), { ...BASE_OPTS, parseNatTrack: v11 });
    const b = fkMod.parseFlightKeys(fkMod.inputFromExtractor(text, items), { ...BASE_OPTS, parseNatTrack: (t, o, d) => nat.parseNatTrack(t, o, d) });
    if (JSON.stringify(a) === JSON.stringify(b)) { same++; continue; }
    const keys = Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    diff.push(fx.id); assert.deepEqual(keys, ['natTrack'], `${fx.id}: only natTrack differs`);
    assert.deepEqual(a.findings, b.findings, `${fx.id}: findings identical`);
    assert.deepEqual(a.natMessages.map(m => m.text), b.natMessages.map(m => m.text));
    assert.ok(b.natTrack && flat(b.natTrack).length > 0 && b.natTrack.rawFallback === '', `${fx.id}: a track object, no raw fallback`);
    assert.equal(b.natTrack.tmi, a.natTrack.tmi); assert.equal(b.natTrack.assignedId, a.natTrack.assignedId); assert.equal(b.natTrack.flightDir, a.natTrack.flightDir);
    assert.deepEqual(flat(b.natTrack).filter(([, k]) => k.assigned).map(([, k]) => k.id), b.natTrack.assignedId ? [b.natTrack.assignedId] : []);
  }
  assert.equal(same, 21); assert.equal(diff.length, 5);
  // the O-59 WARN needs the letter passed in (options.filed) — ofp-flightkeys v0.4.0 does not pass it; this is open item O-68 (5e)
});

test('TC-173-042 scope 3, synthetic: every unreadable case is a named WARN / INFO, never raw text', () => {
  const T = (m, opts) => run(m, 'KJFK', 'EGLL', opts);
  let q = T(msg([]));                                                              // no track
  assert.equal(q.r.rawFallback, ''); assert.deepEqual(q.r.blocks, []); assert.ok(codes(q.f).includes('WARN:NAT-NO-TRACKS'));
  q = T(msg([['V NICSO 48/50 51/40', 'WEST LVLS NIL']]));                          // no EAST LVLS line
  assert.ok(codes(q.f).includes('WARN:NAT-TRACK-UNREADABLE')); assert.deepEqual(q.r.blocks, []);
  q = T(msg([eTrack('V', 'NICSO')]));                                              // one waypoint
  assert.ok(codes(q.f).includes('WARN:NAT-TRACK-UNREADABLE'));
  q = T(msg([ln('V', 'NICSO 48/50 51/40 53/30', 'NIL', 'NIL')]));                  // levels in neither direction
  assert.ok(codes(q.f).includes('WARN:NAT-TRACK-UNREADABLE'));
  q = T(msg([ln('V', 'NICSO 48/50 51/40 53/30', '340 350', '340 350')]));          // levels in both
  assert.ok(codes(q.f).includes('WARN:NAT-TRACK-UNREADABLE'));
  q = T(msg([eTrack('V', 'NICSO 48/50 5x/40 53/30 MALOT')]));                      // an unreadable token is kept as printed
  assert.ok(codes(q.f).includes('WARN:NAT-WAYPOINT-UNREAD')); assert.deepEqual(flat(q.r)[0][1].waypoints, ['NICSO', '48N050W', '5x/40', '53N030W', 'MALOT']);
  q = T(msg([eTrack('V', 'NICSO 48/50 51/40'), eTrack('V', 'PORTI 47/50 50/40')]));
  assert.ok(codes(q.f).includes('WARN:NAT-TRACK-DUPLICATE'));
  q = T(msg(E3()) + '\n' + msg(E3(), { valid: 'NOV 05/0100Z TO NOV 05/0800Z' }));
  assert.ok(codes(q.f).includes('WARN:NAT-MULTI-MESSAGE')); assert.equal(flat(q.r).length, 3, 'the first message is read');
  q = T(msg(E3()).replace(/^REMARKS:\n/m, ''), {});                                // no REMARKS label → remarks empty
  assert.equal(q.r.eastComments, '');
  q = run(msg([wTrack('A', 'PIKIL 57/20 58/30 59/40 59/50 AVUTI')], { valid: WEST_V }), 'EGLL', 'KJFK', { filed: 'A' });
  assert.deepEqual(codes(q.f), []);                                                // positive: filed and printed, nothing to report
  // a multi-line route (a wrapped track line) is one track
  q = T(msg([['V NICSO 48/50 51/40 53/30', '53/20 MALOT GISTI', 'EAST LVLS 340 350', 'WEST LVLS NIL', 'EUR RTS EAST NIL', 'NAR NIL-']]));
  assert.deepEqual(flat(q.r)[0][1].waypoints, ['NICSO', '48N050W', '51N040W', '53N030W', '53N020W', 'MALOT', 'GISTI']);
  // a track message of a non-Atlantic flight is null (no object, no finding)
  const o = run(msg(E3()), 'OMDB', 'EGLL'); assert.equal(o.r, null); assert.deepEqual(o.f, []);
  // findings are optional: the call without options is the v1.1.0 call
  assert.ok(nat.parseNatTrack(msg(E3()), 'KJFK', 'EGLL'));
});

test('TC-173-050 O-62 shape (synthetic): key order of v1.1.0; coordinate forms; validity MM/DD-HHMM in all months; mach empty; rawFallback empty', () => {
  const r = nat.parseNatTrack(msg([eTrack('V', 'NICSO 48/50 51/40 53/30 53/20 MALOT GISTI'), eTrack('X', 'UMESI 5130/50 5630/20 5430/30 5430/20 VENER KOKIB', '360 380 400')]), 'KJFK', 'EGLL');
  assert.deepEqual(Object.keys(r), ['trackType', 'tmi', 'flightDir', 'assignedId', 'blocks', 'rawFallback', 'eastComments', 'westComments']);
  assert.deepEqual(Object.keys(r.blocks[0]), ['dir', 'tracks']);
  assert.deepEqual(Object.keys(r.blocks[0].tracks[0]), ['id', 'waypoints', 'fl', 'mach', 'valid', 'assigned']);
  assert.deepEqual(r.blocks[0].tracks[0].waypoints, ['NICSO', '48N050W', '51N040W', '53N030W', '53N020W', 'MALOT', 'GISTI']);
  assert.deepEqual(r.blocks[0].tracks[1].waypoints, ['UMESI', '5130N05000W', '5630N02000W', '5430N03000W', '5430N02000W', 'VENER', 'KOKIB']);
  assert.equal(r.blocks[0].tracks[0].fl, 'FL340–400'); assert.equal(r.blocks[0].tracks[1].fl, 'FL360 380 400');
  assert.equal(r.blocks[0].tracks[0].valid, '11/04-0100–11/04-0800'); assert.equal(r.blocks[0].tracks[0].mach, '');
  assert.equal(r.tmi, '301'); assert.equal(r.rawFallback, ''); assert.equal(r.trackType, 'NAT'); assert.equal(r.assignedId, null);
  assert.equal(nat.parseNatTrack(msg([eTrack('V', 'NICSO 48/100 51/40')]), 'KJFK', 'EGLL').blocks[0].tracks[0].waypoints[1], '48N100W', 'a 3-digit longitude');
  ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].forEach((mo, i) => {
    const mm = String(i + 1).padStart(2, '0');
    const q = nat.parseNatTrack(msg(E3(), { valid: `${mo} 28/2300Z TO ${mo} 29/0630Z` }), 'KJFK', 'EGLL');
    assert.equal(q.blocks[0].tracks[0].valid, `${mm}/28-2300–${mm}/29-0630`, mo);
  });
  // negative: an unknown month is not read; the track is still returned (O-60: never a WARN)
  const u = run(msg(E3(), { valid: 'XXX 28/2300Z TO XXX 29/0630Z' }), 'KJFK', 'EGLL');
  assert.equal(u.r.blocks[0].tracks[0].valid, ''); assert.ok(!u.f.some(x => x.level === 'WARN'));
  // the finding record shape and the closed code list
  assert.deepEqual(Object.keys(u.f[0]), ['level', 'field', 'code', 'message']); assert.equal(u.f[0].field, 'natTrack');
  codes(run(msg(E3()), 'KJFK', 'EGLL').f).forEach(c => assert.ok(nat.FINDING_CODES[c.split(':')[1]] === c.split(':')[0]));
  assert.deepEqual(Object.keys(nat.FINDING_CODES).sort(), ['NAT-FILED-IGNORED', 'NAT-FILED-NOT-IN-MESSAGE', 'NAT-MULTI-MESSAGE', 'NAT-NO-TRACKS', 'NAT-RANDOM-ROUTE', 'NAT-REMARKS-DIRECTION', 'NAT-TRACK-DUPLICATE', 'NAT-TRACK-UNREADABLE', 'NAT-VALIDITY-UNREADABLE', 'NAT-WAYPOINT-UNREAD']);
});

// ══ TC-173-090 ═════════════════════════════════════════════════════════════
test('TC-173-090 fixtures missing → the fixture tests FAIL, never skip', () => {
  assert.equal(findFixtures(path.join(ROOT, 'no-such-dir')) === path.join(ROOT, 'no-such-dir'), false, 'a directory without a manifest is not taken as the fixtures');
  assert.ok(FIX, 'the fixtures are available in this run');
});
