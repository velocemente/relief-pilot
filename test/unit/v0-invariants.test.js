'use strict';
/*
 * V0 corpus invariants. Every test here needs the fixtures repo and FAILS without it
 * (never skips). Runs the app's real import path (test/lib/app-path.js) on every fixture.
 *
 *   1. hidden NOTAMs = 0, measured against test/oracle/notam-oracle.js (HF-5 QA oracle)
 *   2. no "[object Object]" anywhere in an app-path snapshot
 *   3. every Navtech/eOFP release airport has NOTAM and weather text, or an explicit nil;
 *      FlightKeys gaps must be listed in test/known-gaps.json
 *   4. fuel / weight cross-checks on every fixture
 *   5. D43: a NOTAM whose ID differs from every earlier NOTAM is never dropped by evalNotams()
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { findFixtures, readManifest, importFixture, notamKey } = require('../lib/app-path');
const { appSnapshot, notamSnapshot, evalArgsFor, callEvalNotams, notamIdOf } = require('../lib/v0-snapshots');
const { normalize } = require('../golden/serialize');
const oracle = require('../oracle/notam-oracle');

const FIXTURES_DIR = findFixtures();
const KNOWN_GAPS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'known-gaps.json'), 'utf8')).gaps;

// One import of every fixture, shared by all tests of this file.
let _ctx = null;
function ctx() {
  if (!_ctx) _ctx = (async () => {
    assert.ok(FIXTURES_DIR, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)');
    const manifest = readManifest(FIXTURES_DIR);
    const items = [];
    for (const fx of manifest.fixtures) items.push({ fx, imp: await importFixture(fx, FIXTURES_DIR) });
    return { dir: FIXTURES_DIR, manifest, items };
  })();
  return _ctx;
}
const isFk = fx => fx.format === 'flightkeys';

test('V0 fixtures are present (missing fixtures FAIL, never skip)', async () => {
  const c = await ctx();
  assert.ok(c.items.length >= 33, `expected at least 33 fixtures, found ${c.items.length}`);
  for (const { fx, imp } of c.items) {
    const want = fs.readFileSync(path.join(c.dir, fx.files.text), 'utf8');
    assert.equal(imp.rawText, want, `${fx.id}: processPDF() text differs from text/ — the app-path import is not reproducing the extractor`);
  }
});

// ── 1. hidden NOTAMs = 0 ───────────────────────────────────────────────────
// Oracle: test/oracle/notam-oracle.js (variant "all": table + trailing EST + 3..n location
// codes, the variant that reproduces the HF-5 audit count of 717 on 1.9.9-hf1).
// A NOTAM is HIDDEN when the oracle says it is in effect on the flight date and every copy
// of it that the app splits out resolves (xNW_standalone) to a window that misses that day.
function measureHidden(app, dir, fixtures) {
  const entries = oracle.build(dir, { all: true });
  const byFx = new Map();
  for (const e of entries) (byFx.get(e.pkg) || byFx.set(e.pkg, []).get(e.pkg)).push(e);
  const res = { fixtures: 0, oracleNotams: 0, oracleInEffect: 0, hidden: [], unmatched: [] };
  for (const fx of fixtures) {
    if (isFk(fx)) continue;
    res.fixtures++;
    const raw = fs.readFileSync(path.join(dir, fx.files.text), 'utf8');
    const d0 = Date.UTC(+fx.date.slice(0, 4), +fx.date.slice(5, 7) - 1, +fx.date.slice(8, 10));
    const d1 = d0 + 86400000;
    const appCopies = new Map();   // "loc|id" -> [inEffect, ...]
    for (const chunk of app._splitNotams(raw)) {
      const m = oracle.HDR_ALL.exec(chunk.split('\n')[0]);
      if (!m) continue;
      const w = app.xNW_standalone(chunk, fx.date);
      const eff = !w || (w.startMs < d1 && w.endMs > d0);   // no window = in effect (T6 fail-safe)
      const k = oracle.locOf(m) + '|' + m[3];
      (appCopies.get(k) || appCopies.set(k, []).get(k)).push(eff);
    }
    for (const e of byFx.get(fx.id) || []) {
      res.oracleNotams++;
      if (!e.inEffect) continue;
      res.oracleInEffect++;
      const copies = appCopies.get(e.loc + '|' + e.id);
      if (!copies) res.unmatched.push(`${fx.id} ${e.loc} ${e.id}`);
      else if (!copies.some(Boolean)) res.hidden.push(`${fx.id} ${e.loc} ${e.id}`);
    }
  }
  return res;
}

test('V0 hidden NOTAMs = 0 against the HF-5 oracle (and every oracle NOTAM is found by the app)', async () => {
  const c = await ctx();
  const r = measureHidden(c.items[0].imp.app, c.dir, c.manifest.fixtures);
  console.log(`V0: hidden-NOTAM check: ${r.fixtures} Navtech/eOFP fixtures, ${r.oracleNotams} oracle NOTAMs, ${r.oracleInEffect} in effect on the flight date, ${r.hidden.length} hidden, ${r.unmatched.length} not found by the app`);
  assert.ok(r.oracleNotams > 7000, `oracle found only ${r.oracleNotams} NOTAMs; expected about 7,500`);
  assert.equal(r.hidden.length, 0, `${r.hidden.length} NOTAM(s) in effect per the oracle are hidden by the app, e.g. ${r.hidden.slice(0, 5).join('; ')}`);
  assert.equal(r.unmatched.length, 0, `${r.unmatched.length} oracle NOTAM(s) not split out by the app, e.g. ${r.unmatched.slice(0, 5).join('; ')}`);
});

// ── 2. no "[object Object]" ────────────────────────────────────────────────
test('V0 no "[object Object]" anywhere in an app-path snapshot', async () => {
  const c = await ctx();
  let scanned = 0;
  for (const { fx, imp } of c.items) {
    for (const [what, snap] of [['app', appSnapshot(fx, imp)], ['notam', notamSnapshot(fx, imp)]]) {
      const s = JSON.stringify(normalize(snap));
      scanned += s.length;
      const at = s.indexOf('[object Object]');
      assert.equal(at, -1, `${fx.id} (${what} snapshot): "[object Object]" at: …${s.slice(Math.max(0, at - 80), at + 40)}…`);
    }
  }
  assert.ok(scanned > 1e6, 'snapshots were suspiciously small');
});

test('V0 negative: the "[object Object]" scan sees an object that was string-concatenated', () => {
  const s = JSON.stringify(normalize({ text: 'ALT ' + { icao: 'EDDF' } }));
  assert.notEqual(s.indexOf('[object Object]'), -1);
});

// ── 3. release airports have NOTAM and weather text, or an explicit nil ─────
// Explicit nil = the OFP itself says there is none for that airport.
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function explicitNil(raw, icao, field) {
  const I = esc(icao);
  const pats = field === 'notams'
    ? [new RegExp(`NO OPERATIONAL NOTAMS ON FILE FOR ${I}\\b`), new RegExp(`NO NOTAMS?\\b[^\\n]*\\b${I}\\b`), new RegExp(`\\b${I}\\b[^\\n]*NOTAMS?:?\\s+NIL\\b`)]
    : [new RegExp(`NO (?:METAR|TAF|WEATHER)[^\\n]*\\b${I}\\b`), new RegExp(`\\b${I}\\b[^\\n]*(?:METAR|TAF|WEATHER):?\\s+NIL\\b`)];
  return pats.some(re => re.test(raw));
}
function airportGaps(c) {
  const gaps = [];
  for (const { fx, imp } of c.items) {
    for (const apt of imp.app.getAllAirports()) {
      const d = imp.airportData[apt.icao] || {};
      for (const field of ['weather', 'notams']) {
        if ((d[field] || '').trim()) continue;
        gaps.push({ fixture: fx.id, icao: apt.icao, field, fk: isFk(fx), nil: explicitNil(imp.rawText, apt.icao, field) });
      }
    }
  }
  return gaps;
}

test('V0 every Navtech/eOFP release airport has NOTAM and weather text, or an explicit nil', async () => {
  const c = await ctx();
  const gaps = airportGaps(c).filter(g => !g.fk);
  const bad = gaps.filter(g => !g.nil);
  const stated = gaps.filter(g => g.nil);
  console.log(`V0: Navtech/eOFP airports checked: ${c.items.filter(i => !isFk(i.fx)).reduce((n, i) => n + i.imp.app.getAllAirports().length, 0)}; explicit nil: ${stated.map(g => `${g.fixture}/${g.icao}/${g.field}`).join(', ') || 'none'}`);
  assert.deepEqual(bad.map(g => `${g.fixture} ${g.icao} ${g.field}`), [], 'release airport(s) with no text and no explicit nil in the OFP');
});

test('V0 FlightKeys gaps: every gap is listed in test/known-gaps.json (reminder when one is fixed)', async (t) => {
  const c = await ctx();
  const listed = new Set(KNOWN_GAPS.map(g => `${g.fixture} ${g.icao} ${g.field}`));
  assert.equal(listed.size, KNOWN_GAPS.length, 'duplicate line in known-gaps.json');
  for (const g of KNOWN_GAPS) assert.ok(g.row, `known-gaps.json line without a field-map row: ${g.fixture} ${g.icao} ${g.field}`);
  const actual = airportGaps(c).filter(g => g.fk);
  const actualKeys = new Set(actual.map(g => `${g.fixture} ${g.icao} ${g.field}`));
  const unlisted = [...actualKeys].filter(k => !listed.has(k));
  const fixed = [...listed].filter(k => !actualKeys.has(k));
  fixed.forEach(k => { const m = `REMINDER: known gap now fixed, delete it from test/known-gaps.json: ${k}`; console.log(m); t.diagnostic(m); });
  console.log(`V0: FlightKeys gaps: ${actualKeys.size} found, ${listed.size} listed, ${fixed.length} fixed`);
  assert.deepEqual(unlisted, [], 'FlightKeys gap(s) not listed in test/known-gaps.json');
});

// ── 4. fuel and weight cross-checks ─────────────────────────────────────────
// Values the app parses (S) plus TOF, RAMP, TRIP and BALLAST from the OFP summary text.
// The OFP's own relation when a BALLAST line is present (Exec decision, KLAX-RJAA fixture):
//   TOGW = ZFW + TOF - BALLAST     (ballast is counted in the minimum ZFW and is inside TOF)
// With no BALLAST line the relation is TOGW = ZFW + TOF.
function weightChecks(v) {
  const ballast = v.BALLAST || 0;
  const checks = [
    ['TOF + TAXI = BLOCK', v.TOF + v.TAXI, v.BLOCK],
    [ballast ? 'ZFW + TOF - BALLAST = TOGW' : 'ZFW + TOF = TOGW', v.ZFW + v.TOF - ballast, v.TOGW],
    ['TOGW + TAXI = RAMP', v.TOGW + v.TAXI, v.RAMP],
    ['TOGW - TRIP = LDGW', v.TOGW - v.TRIP, v.LDGW],
  ];
  const fails = checks.filter(([, a, b]) => !(Number.isFinite(a) && Number.isFinite(b) && a === b))
    .map(([name, a, b]) => `${name}: ${a} != ${b}`);
  if (!(Number.isFinite(v.MINF) && Number.isFinite(v.TOF) && v.MINF <= v.TOF)) fails.push(`MINF <= TOF: ${v.MINF} > ${v.TOF}`);
  return fails;
}
function weightValues(imp) {
  const t = imp.rawText, S = imp.S;
  const first = re => { const m = t.match(re); return m ? parseInt(m[1], 10) : NaN; };
  const ballastLine = t.match(/^BALLAST\s+(\d{3,7})/m);
  return {
    v: { BLOCK: S.blockFuelRaw, TAXI: S.taxiFuelRaw, MINF: S.minfFuelRaw, ZFW: S.zfwActual, TOGW: S.togwActual, LDGW: S.ldgwActual,
         TOF: first(/^TOF\s+(\d{4,7})\b/m), RAMP: first(/^RAMP\s+(\d{5,7})\b/m), TRIP: first(/^TRIP\s+(\d{4,7})\b/m),
         BALLAST: ballastLine ? parseInt(ballastLine[1], 10) : 0 },
    ballastLine: !!ballastLine,
  };
}

test('V0 fuel and weight cross-checks hold on every fixture', async () => {
  const c = await ctx();
  const mismatches = [];
  let ballastFixtures = 0;
  for (const { fx, imp } of c.items) {
    const { v, ballastLine } = weightValues(imp);
    if (ballastLine) { ballastFixtures++; assert.equal(imp.S.ballastFuel, v.BALLAST, `${fx.id}: S.ballastFuel is not the OFP BALLAST line`); }
    for (const f of weightChecks(v)) mismatches.push(`${isFk(fx) ? 'FlightKeys' : 'Navtech/eOFP'} ${fx.id}: ${f}`);
  }
  console.log(`V0: fuel/weight checks: 5 relations x ${c.items.length} fixtures (${c.items.filter(i => !isFk(i.fx)).length} Navtech/eOFP, ${c.items.filter(i => isFk(i.fx)).length} FlightKeys); BALLAST rule applied to ${ballastFixtures} fixture(s); mismatches: ${mismatches.length}`);
  assert.deepEqual(mismatches, []);
});

test('V0 negative: the weight checks flag a broken relation, and BALLAST only applies when present', () => {
  // Synthetic numbers (not from any fixture) that satisfy the five relations.
  const ok = { BLOCK: 100500, TAXI: 1000, MINF: 90000, ZFW: 250000, TOGW: 349500, LDGW: 250500, TOF: 99500, RAMP: 350500, TRIP: 99000, BALLAST: 0 };
  assert.deepEqual(weightChecks(ok), []);
  assert.equal(weightChecks({ ...ok, BLOCK: 115101 }).length, 1);
  assert.equal(weightChecks({ ...ok, ZFW: ok.ZFW + 1 }).length, 1);
  assert.equal(weightChecks({ ...ok, RAMP: ok.RAMP - 1 }).length, 1);
  assert.equal(weightChecks({ ...ok, LDGW: ok.LDGW + 1 }).length, 1);
  assert.equal(weightChecks({ ...ok, MINF: ok.TOF + 1 }).length, 1);
  assert.equal(weightChecks({ ...ok, TOF: NaN }).length > 0, true, 'a missing value must fail, not pass');
  // With a BALLAST line (the KLAX-RJAA kind of OFP): ZFW + TOF - BALLAST = TOGW. Synthetic numbers.
  const bal = { BLOCK: 100500, TAXI: 1000, MINF: 90000, ZFW: 150000, TOGW: 247000, LDGW: 148000, TOF: 99500, RAMP: 248000, TRIP: 99000, BALLAST: 2500 };
  assert.deepEqual(weightChecks(bal), []);
  assert.equal(weightChecks({ ...bal, BALLAST: 0 }).length, 1, 'without a BALLAST line the same numbers must fail');
});

// ── 5. D43: a NOTAM with a new ID is never dropped ──────────────────────────
// For every release airport, in the same call the app makes: each NOTAM whose ID (with its
// location(s)) differs from every earlier NOTAM, and which evalNotams() reports when given
// on its own (so it is in effect and passes the obstacle and aircraft filters), must also
// be reported when given with all the others. Anything else was merged away by another
// NOTAM (the 1.9.9-hf1 merge on slot:level:label, fixed by D43 / HF-6).
function droppedNewIds(notamArr, evalFn) {
  const seenKeys = new Set();
  const dropped = [];
  const full = evalFn(notamArr).issues.map(i => i.notamRaw);
  for (const chunk of notamArr) {
    const key = notamIdOf(chunk);
    if (seenKeys.has(key)) continue;          // same ID again: a duplicate, allowed to merge
    seenKeys.add(key);
    const alone = evalFn([chunk]).issues.some(i => i.notamRaw === chunk);
    if (alone && !full.includes(chunk)) dropped.push(key);
  }
  return dropped;
}

test('V0 D43: no NOTAM with a new ID is dropped from evalNotams() output at any release airport', async () => {
  const c = await ctx();
  const dropped = [];
  let airports = 0, notams = 0;
  for (const { fx, imp } of c.items) {
    for (const apt of imp.app.getAllAirports()) {
      const a = evalArgsFor(imp, apt);
      if (!a) continue;
      airports++; notams += a.notamArr.length;
      for (const key of droppedNewIds(a.notamArr, arr => callEvalNotams(imp.app, a, arr))) dropped.push(`${fx.id} ${apt.icao} ${key}`);
    }
  }
  console.log(`V0: D43 check: ${airports} airport evaluations, ${notams} NOTAM chunks, ${dropped.length} new-ID NOTAMs dropped`);
  assert.ok(airports >= 100, `only ${airports} airport evaluations ran`);
  assert.deepEqual(dropped, [], `NOTAM(s) with a new ID dropped by evalNotams(): ${dropped.slice(0, 5).join('; ')}`);
});

test('V0 negative: the D43 check catches an evaluator that merges two different IDs', () => {
  const A = '- EDDF A0001/26 01JAN0000-31DEC2359\nRWY 07C CLSD';
  const B = '- EDDF A0002/26 01JAN0000-31DEC2359\nRWY 07C CLSD';
  const merging = arr => ({ issues: arr.slice(0, 1).map(n => ({ notamRaw: n })) });   // keeps only the first
  const keeping = arr => ({ issues: arr.map(n => ({ notamRaw: n })) });
  assert.deepEqual(droppedNewIds([A, B], merging), ['EDDF A0002/26']);
  assert.deepEqual(droppedNewIds([A, B], keeping), []);
  assert.deepEqual(droppedNewIds([A, A], merging), [], 'the same ID printed twice may merge');
});
