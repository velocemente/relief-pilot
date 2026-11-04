'use strict';
/**
 * TC-111 — NOTAM merge (HF-6) and /YY year crossing on WEF / EFFECTIVE (F2)
 *
 * D43: the NOTAM ID is the unique identifier. Two NOTAMs are duplicates ONLY
 *      when they have the same location and the same ID (the same NOTAM
 *      printed twice). Different IDs are always both shown. A NOTAM with no
 *      readable ID is a duplicate only of a NOTAM whose text is identical
 *      after whitespace is normalised. The first copy is kept.
 * D38: end month before start month → the end is in the year after the
 *      start. With /YY the start year is never before I = 2000 + YY; if any
 *      candidate window (start in Y, end in Y+1, Y from I to the flight year)
 *      covers the flight date, the NOTAM is in effect with that window.
 *      D27 fail-safe: anything unresolvable is shown.
 *
 * TC-111-001       real fixture (FAILS if fixtures are missing)
 * TC-111-002..004  synthetic
 * TC-111-005       corpus, every release airport (FAILS if fixtures are missing)
 * TC-111-006       F2 synthetic, every WEF / EFFECTIVE form the parser supports
 *
 * Real-fixture tests assert only NOTAM IDs; no fixture text is copied here.
 * All times are UTC.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const { loadApp } = require('../harness');
const { releaseRuns, shown, headerId } = require('../corpus/notam-merge');

const app = loadApp();

// ── Fixtures path resolution (same candidates as notam-year.test.js) ──────
const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES_DIR = [
  process.env.PB_FIXTURES,
  path.join(ROOT, 'fixtures'),
  path.join(ROOT, '..', 'pilotbrief-fixtures'),
].filter(Boolean).find(d => {
  try { return fs.existsSync(path.join(d, 'manifest.json')); } catch (_) { return false; }
});

// Never skip: without fixtures every fixture test fails here.
function manifest() {
  assert.ok(FIXTURES_DIR, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)');
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8'));
}
function readText(fx) { return fs.readFileSync(path.join(FIXTURES_DIR, fx.files.text), 'utf8'); }

const ETA  = 720;   // 1200Z: no cross-midnight next-day check in nwOverlap
const ev   = (notams, iso) => app.evalNotams(notams, 'DEST', ETA, 'B744', iso);
// Copied into this realm: arrays built inside the vm fail deepStrictEqual.
const raws = r => [...r.issues.filter(i => i.notamRaw).map(i => i.notamRaw)];
const iso16 = ms => new Date(ms).toISOString().slice(0, 16);

// ══ TC-111-001 real fixture ═══════════════════════════════════════════════

test('TC-111-001 PANC-KORD 10 APR: KRFD A1124/24 and A0359/25 both shown at the alternate ETA', () => {
  const fx = manifest().fixtures.find(f => f.id === 'NB_PANC-KORD_10APR26_maxldgw_rev6');
  assert.ok(fx, 'fixture NB_PANC-KORD_10APR26_maxldgw_rev6 not in manifest');
  const rel = releaseRuns(app, readText(fx), fx);
  const run = rel.runs.find(r => r.icao === 'KRFD');
  assert.ok(run, 'KRFD is a release airport');
  assert.equal(run.role, 'DEST ALT');
  for (const id of ['A1124/24', 'A0359/25']) {
    assert.ok(run.notams.some(n => headerId(n) === `KRFD ${id}`), `KRFD ${id} is in the package`);
  }
  const ids = shown(app, run, rel.iso, rel.acftType).map(headerId);
  assert.ok(ids.includes('KRFD A1124/24'), 'KRFD A1124/24 shown');
  assert.ok(ids.includes('KRFD A0359/25'), 'KRFD A0359/25 shown');
});

// ══ TC-111-002..004 synthetic ═════════════════════════════════════════════

const ISO = '2026-04-10';
const apch = (id, mins) => `- XXXX ${id} 01APR0000-30APR2359\n` +
  `IAP XXXX RNAV (GPS) RWY 25, AMDT 1 PROCEDURE CHANGE LNAV MDA ${mins}\n`;

test('TC-111-002 two different IDs, same label and same first 40 characters → both shown', () => {
  const a = apch('A0001/26', '1100 VIS 1');
  const b = apch('A0002/26', '1240 VIS 1 1/2');
  const r = ev([a, b], ISO);
  const items = r.issues.filter(i => i.notamRaw);
  // Precondition: this is the pair the old slot:level:label key merged.
  assert.equal(items.length, 2, 'both NOTAMs shown');
  assert.equal(items[0].slot, items[1].slot, 'same slot');
  assert.equal(items[0].level, items[1].level, 'same level');
  assert.ok(items[0].label && items[0].label === items[1].label, 'same label');
  assert.deepEqual(raws(r).sort(), [a, b].sort());
  // The runway group lists every NOTAM.
  const grp = r.rwyGroups.get('RWY-25');
  assert.ok(grp, 'RWY 25 group');
  assert.deepEqual([...grp.items.map(i => i.notamRaw)].sort(), [a, b].sort());
});

test('TC-111-003 the same ID printed twice → shown once (first copy kept)', () => {
  const a = apch('A0001/26', '1100 VIS 1');
  // Identical copy.
  assert.deepEqual(raws(ev([a, a], ISO)), [a]);
  // Same ID, whitespace differs: still the same NOTAM; the first copy is kept.
  const a2 = a.replace('RWY 25, AMDT', 'RWY 25,  AMDT').replace(/\n$/, '  \n\n');
  assert.deepEqual(raws(ev([a, a2], ISO)), [a]);
  assert.deepEqual(raws(ev([a2, a], ISO)), [a2]);
  // Negative: same ID at a different location is a different NOTAM.
  const c = a.replace('- XXXX ', '- YYYY ');
  assert.deepEqual(raws(ev([a, c], ISO)).sort(), [a, c].sort());
});

test('TC-111-004 no readable ID: identical text → shown once; different text → both shown', () => {
  const a = '- XXXX 01APR0000-30APR2359\nRWY 09/27 CLSD DUE TO WIP, HOURS 0400-0600 ONLY\n';
  const b = '- XXXX 01APR0000-30APR2359\nRWY 09/27 CLSD DUE TO WIP, HOURS 0800-1400 ONLY\n';
  // Identical, and identical after whitespace is normalised.
  assert.deepEqual(raws(ev([a, a], ISO)), [a]);
  const a2 = a.replace('CLSD DUE', 'CLSD\n  DUE');
  assert.deepEqual(raws(ev([a, a2], ISO)), [a]);
  // Different text with the same label (the old key merged these) → both.
  const r = ev([a, b], ISO);
  const items = r.issues.filter(i => i.notamRaw);
  assert.equal(items.length, 2, 'both shown');
  assert.equal(items[0].label, items[1].label, 'same label (precondition)');
  assert.deepEqual(raws(r).sort(), [a, b].sort());
});

// ══ TC-111-005 corpus ═════════════════════════════════════════════════════

// D43 identity, written from the decision: location(s) + ID, else the text.
const identity = n => headerId(n) || 'TXT:' + n.replace(/\s+/g, ' ').trim();

test('TC-111-005 corpus: every NOTAM that passes the filters is shown unless it repeats an earlier ID', (t) => {
  const fixtures = manifest().fixtures.filter(f => f.format !== 'flightkeys');
  assert.ok(fixtures.length > 0, 'Navtech/eOFP fixtures present');
  let runs = 0, passing = 0, repeats = 0;
  for (const fx of fixtures) {
    const rel = releaseRuns(app, readText(fx), fx);
    for (const run of rel.runs) {
      runs++;
      // A NOTAM passes the existing filters when evalNotams() shows it alone.
      const pass = run.notams.filter(n =>
        shown(app, { ...run, notams: [n] }, rel.iso, rel.acftType).length === 1);
      const seen = new Set(), expected = [];
      for (const n of pass) {
        const k = identity(n);
        if (seen.has(k)) { repeats++; continue; }
        seen.add(k); expected.push(n);
      }
      passing += pass.length;
      const got = shown(app, run, rel.iso, rel.acftType);
      assert.deepEqual([...got].sort(), [...expected].sort(),
        `${fx.id} ${run.icao} (${run.role}): output = passing NOTAMs less repeated IDs`);
    }
  }
  assert.ok(runs > 0 && passing > 0, 'corpus measured');
  t.diagnostic(`release airport runs ${runs}; NOTAMs passing filters ${passing}; repeated IDs dropped ${repeats}`);
});

// ══ TC-111-006 F2: /YY window crossing New Year on WEF / EFFECTIVE ════════

const body = '\nRWY 09/27 CLSD\n';
const shows = (n, iso) => raws(ev([n], iso)).includes(n);
// Every WEF / EFFECTIVE form the parser reads (wefRe, effRe in xNW_standalone).
const FORMS = ['WEF 28DEC0000 UFC 05JAN2359', 'WEF 28DEC0000 UNTIL 05JAN2359',
               'WEF 28DEC0000 TO 05JAN2359', 'EFFECTIVE 28DEC0000 UNTIL 05JAN2359',
               'EFFECTIVE 28DEC0000 TO 05JAN2359'];

test('TC-111-006 /26 window 28 DEC – 05 JAN: in effect 30 DEC 2026 and 02 JAN 2027 only', () => {
  const cases = [
    ['2026-12-27', false],   // not started
    ['2026-12-30', true],
    ['2027-01-02', true],    // second year (was hidden: F2)
    ['2027-01-10', false],   // ended
  ];
  for (const f of FORMS) {
    const n = `- XXXX A0001/26 ${f}` + body;
    for (const [flt, inEffect] of cases) {
      const w = app.xNW_standalone(n, flt);
      assert.ok(w, `${f} ${flt}: window`);
      if (inEffect) {
        assert.equal(iso16(w.startMs), '2026-12-28T00:00', `${f} ${flt}: start`);
        assert.equal(iso16(w.endMs),   '2027-01-05T23:59', `${f} ${flt}: end`);
      }
      assert.equal(shows(n, flt), inEffect, `${f} ${flt}: ${inEffect ? 'in effect' : 'not in effect'}`);
    }
  }
});

test('TC-111-006 /25 window 28 DEC – 05 JAN: in effect on 02 JAN 2026', () => {
  for (const f of FORMS) {
    const n = `- XXXX A0001/25 ${f}` + body;
    const w = app.xNW_standalone(n, '2026-01-02');
    assert.ok(w, `${f}: window`);
    assert.equal(iso16(w.startMs), '2025-12-28T00:00', `${f}: start`);
    assert.equal(iso16(w.endMs),   '2026-01-05T23:59', `${f}: end`);
    assert.equal(shows(n, '2026-01-02'), true, `${f}: in effect`);
  }
});

test('TC-111-006N /YY negative: the start is never before the issue year; unresolvable → shown', () => {
  for (const f of FORMS) {
    // Issued /27: cannot have started 28 DEC 2026 → not in effect on 02 JAN 2027.
    const n27 = `- XXXX A0001/27 ${f}` + body;
    assert.equal(shows(n27, '2027-01-02'), false, `${f} /27 on 2027-01-02: not in effect`);
    assert.equal(shows(n27, '2027-12-30'), true,  `${f} /27 on 2027-12-30: in effect`);
    // Issue year after the flight year: no candidate window → shown (D27).
    const n28 = `- XXXX A0001/28 ${f}` + body;
    assert.equal(app.xNW_standalone(n28, '2027-01-02'), null, `${f} /28: no window`);
    assert.equal(shows(n28, '2027-01-02'), true, `${f} /28: shown`);
  }
});
