'use strict';
/**
 * TC-122 — NOTAMs are checked against the ACTUAL UTC date and time of the evaluation
 * window (NOTAM ruleset module v1.11.2, ledger P-23).
 * Source: Exec finding on beta 1.9.9-hf3 (NOTAMs not in effect during the evaluation
 * window were shown) and the app #41 QA (finding 14).
 *
 * Exec rule (7 Nov): a NOTAM is shown only if it is in effect at some time during the
 * airport's evaluation window (ETA ± 60 min) on the window's actual UTC date and time.
 *   - Actual date: flight date D (DOF) + departure time (OUT). ETA time of day earlier
 *     than OUT → the ETA is on D + 1; otherwise on D. Same for every airport role.
 *   - One function builds the window (_evalWindows); the date-range check and the
 *     day-of-month schedule check both use it. DLY uses the window's times of day.
 *   - No "ETA < 1200Z → also D + 1" rule; no second day when OUT is known.
 *   - Edges included: a NOTAM ending exactly at ETA − 60, or starting exactly at
 *     ETA + 60, is shown.
 *   - Fail-safe unchanged: OUT unknown → D and D + 1 (date range AND schedules);
 *     no ETA / no flight date / unreadable dates (T6, D27) → shown; UFN/EST → no end;
 *     PERM → no end.
 *
 *   TC-122-001  departure-day-only NOTAM, arrival on D + 1 (ETA 0030Z, 1300Z) → hidden
 *   TC-122-002  departure airport, departure 0300Z: NOTAM starting D + 1 → hidden
 *   TC-122-003  NOTAM ending before ETA − 60 / starting after ETA + 60 on the actual date
 *               → hidden; edges exactly at ETA − 60 / ETA + 60 → shown
 *   TC-122-004  window crossing 0000Z (ETA 2330Z and 0030Z) → both dates covered
 *   TC-122-005  departure time unknown → shown if in effect on D or D + 1 (date range
 *               AND day-of-month schedule, incl. an arrival-day NOTAM at or after 1200Z)
 *   TC-122-006  no ETA / no flight date / unreadable dates / UFN / EST / PERM → shown
 *   TC-122-007  day-of-month schedule on the wrong day → hidden; right day → shown
 *   TC-122-008  _evalWindows(): the one window; nwOverlap_standalone() and the
 *               schedule check use it and nothing else builds a window
 *   TC-122-009  through evalAirport(), with the departure time from S.outZ
 *
 * Synthetic NOTAMs only (XXXX); no fixture text. All times are UTC.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const { loadApp } = require('../harness');

const app = loadApp();
const RULES = path.join(__dirname, '..', '..', 'rules');
const MOD_FILE = path.join(RULES, JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'))['notam-rules'].file);
const mod = require(MOD_FILE);

const hm = s => parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(2), 10);
const z  = ms => new Date(ms).toISOString().slice(0, 16);

// Synthetic flight date D = Mon 09 MAR 2026; D + 1 = Tue 10 MAR.
const D = '2026-03-09';

// Is the NOTAM reported by evalNotams()? dep: 'HHMM', or null for "departure time unknown".
function shows(notam, { role = 'DEST', eta, dep, iso = D } = {}) {
  const r = app.evalNotams([notam], role, eta === null ? null : hm(eta), 'B744', iso,
    dep === null || dep === undefined ? null : hm(dep));
  return r.issues.some(i => i.notamRaw === notam);
}
// A NOTAM with a header date range and an optional schedule line.
const nt = (id, range, sched) => `- XXXX ${id} ${range}\n${sched ? sched + '\n' : ''}RWY 09/27 CLSD\n`;

test('TC-122-001 departure-day-only NOTAM, arrival on D+1 (ETA 0030Z, 1300Z) → hidden', () => {
  // ETA 0030Z after a 1600Z departure: window 09 MAR 2330 – 10 MAR 0130.
  assert.equal(shows(nt('A2201/26', '09MAR0000-09MAR2200'), { eta: '0030', dep: '1600' }), false,
    'dated 09 MAR 0000–2200, ETA 10 MAR 0030Z');
  assert.equal(shows(nt('A2202/26', '09MAR0000-09MAR0200'), { eta: '0030', dep: '1600' }), false,
    'dated 09 MAR 0000–0200 (the ETA time of day, one day early), ETA 10 MAR 0030Z');
  // ETA 1300Z after a 2300Z departure: window 10 MAR 1200 – 1400. (Exec finding.)
  assert.equal(shows(nt('A2203/26', '09MAR1200-09MAR1400'), { eta: '1300', dep: '2300' }), false,
    'dated 09 MAR 1200–1400, ETA 10 MAR 1300Z');
  assert.equal(shows(nt('A2204/26', '09MAR0000-09MAR2359'), { eta: '1300', dep: '2300' }), false,
    'dated 09 MAR all day, ETA 10 MAR 1300Z');
  // Positive controls: the same NOTAMs moved to the arrival day are shown.
  assert.equal(shows(nt('A2205/26', '10MAR0000-10MAR0200'), { eta: '0030', dep: '1600' }), true, 'dated 10 MAR 0000–0200');
  assert.equal(shows(nt('A2206/26', '10MAR1200-10MAR1400'), { eta: '1300', dep: '2300' }), true, 'dated 10 MAR 1200–1400');
  // Every alternate role is evaluated as 'DEST' by evalAirport(); the rule is the same.
  assert.equal(shows(nt('A2207/26', '09MAR1200-09MAR1400'), { role: 'ALT', eta: '1300', dep: '2300' }), false, 'ALT, dated 09 MAR');
});

test('TC-122-002 departure airport, departure 0300Z: NOTAM starting D+1 → hidden', () => {
  // ORIG: the "ETA" is the departure time itself, so the window is 09 MAR 0200 – 0400.
  const f = { role: 'ORIG', eta: '0300', dep: '0300' };
  assert.equal(shows(nt('A2211/26', '10MAR0000-10MAR2359'), f), false, 'starts 10 MAR 0000Z');
  assert.equal(shows(nt('A2212/26', '10MAR0200-10MAR0400'), f), false, '10 MAR 0200–0400 (the window times, one day late)');
  assert.equal(shows(nt('A2213/26', '10MAR0000-PERM'), f), false, 'PERM starting 10 MAR');
  // Positive controls on D.
  assert.equal(shows(nt('A2214/26', '09MAR0200-09MAR0400'), f), true, '09 MAR 0200–0400');
  assert.equal(shows(nt('A2215/26', '08MAR0000-09MAR0230'), f), true, 'ends 09 MAR 0230Z');
});

test('TC-122-003 outside ETA ± 60 on the actual date → hidden; exactly on an edge → shown', () => {
  // Arrival on D + 1: ETA 10 MAR 1800Z (departed 09 MAR 2300Z), window 10 MAR 1700 – 1900.
  const f = { eta: '1800', dep: '2300' };
  assert.equal(shows(nt('A2221/26', '09MAR1700-10MAR1659'), f), false, 'ends 10 MAR 1659Z (in effect on D at the ETA time)');
  assert.equal(shows(nt('A2222/26', '10MAR1200-10MAR1700'), f), true,  'ends exactly 10 MAR 1700Z = ETA − 60');
  assert.equal(shows(nt('A2223/26', '10MAR1901-10MAR2200'), f), false, 'starts 10 MAR 1901Z');
  assert.equal(shows(nt('A2224/26', '10MAR1900-10MAR2200'), f), true,  'starts exactly 10 MAR 1900Z = ETA + 60');
  // Same day: ETA 09 MAR 1000Z (departed 0200Z), window 09 MAR 0900 – 1100.
  const g = { eta: '1000', dep: '0200' };
  assert.equal(shows(nt('A2225/26', '09MAR1101-10MAR2359'), g), false, 'starts 09 MAR 1101Z (in effect on D + 1 at the ETA time)');
  assert.equal(shows(nt('A2226/26', '09MAR1100-10MAR2359'), g), true,  'starts exactly 09 MAR 1100Z = ETA + 60');
  assert.equal(shows(nt('A2227/26', '08MAR0000-09MAR0859'), g), false, 'ends 09 MAR 0859Z');
  assert.equal(shows(nt('A2228/26', '08MAR0000-09MAR0900'), g), true,  'ends exactly 09 MAR 0900Z = ETA − 60');
  // Other date forms: B)/C) and the 10-digit pair use the same window.
  assert.equal(shows(`- XXXX A2229/26\nB) 2603101200 C) 2603101700\nRWY 09/27 CLSD\n`, f), true,  'B)/C) ends at ETA − 60');
  assert.equal(shows(`- XXXX A2230/26\nB) 2603091700 C) 2603101659\nRWY 09/27 CLSD\n`, f), false, 'B)/C) ends before ETA − 60');
  assert.equal(shows(`- XXXX A2231/26 2603101900-2603102200\nRWY 09/27 CLSD\n`, f), true,  '10-digit starts at ETA + 60');
  assert.equal(shows(`- XXXX A2232/26 2603101901-2603102200\nRWY 09/27 CLSD\n`, f), false, '10-digit starts after ETA + 60');
  // A day-of-month schedule period touching an edge is shown as well.
  assert.equal(shows(nt('A2233/26', '01MAR0000-31MAR2359', '10-10 1500-1700'), f), true,  '10-10 1500-1700 ends at ETA − 60');
  assert.equal(shows(nt('A2234/26', '01MAR0000-31MAR2359', '10-10 1500-1659'), f), false, '10-10 1500-1659');
});

test('TC-122-004 window crossing 0000Z (ETA 2330Z and 0030Z) → both dates covered', () => {
  // ETA 2330Z on D (departed 1200Z): window 09 MAR 2230 – 10 MAR 0030.
  const a = { eta: '2330', dep: '1200' };
  assert.equal(shows(nt('A2241/26', '09MAR2200-09MAR2240'), a), true,  '09 MAR 2200–2240');
  assert.equal(shows(nt('A2242/26', '10MAR0000-10MAR0200'), a), true,  '10 MAR 0000–0200');
  assert.equal(shows(nt('A2243/26', '10MAR0031-10MAR0200'), a), false, '10 MAR 0031–0200');
  assert.equal(shows(nt('A2244/26', '01MAR0000-31MAR2359', '10-10 0000-0100'), a), true, 'schedule 10-10 0000-0100');
  assert.equal(shows(nt('A2245/26', '01MAR0000-31MAR2359', '09-09 2200-2240'), a), true, 'schedule 09-09 2200-2240');
  assert.equal(shows(nt('A2246/26', '01MAR0000-31MAR2359', '11-11 0000-0100'), a), false, 'schedule 11-11 0000-0100');
  // ETA 2330Z on D + 1 (departed 2345Z): window 10 MAR 2230 – 11 MAR 0030.
  const b = { eta: '2330', dep: '2345' };
  assert.equal(shows(nt('A2247/26', '10MAR2200-10MAR2240'), b), true,  '10 MAR 2200–2240');
  assert.equal(shows(nt('A2248/26', '11MAR0000-11MAR0200'), b), true,  '11 MAR 0000–0200');
  assert.equal(shows(nt('A2249/26', '09MAR2200-10MAR0040'), b), false, 'ends 10 MAR 0040Z (the D window)');
  // ETA 0030Z on D + 1 (departed 1600Z): window 09 MAR 2330 – 10 MAR 0130.
  const c = { eta: '0030', dep: '1600' };
  assert.equal(shows(nt('A2250/26', '09MAR2300-09MAR2340'), c), true,  '09 MAR 2300–2340');
  assert.equal(shows(nt('A2251/26', '10MAR0100-10MAR0300'), c), true,  '10 MAR 0100–0300');
  assert.equal(shows(nt('A2252/26', '01MAR0000-31MAR2359', '09-09 2300-2359'), c), true, 'schedule 09-09 2300-2359');
  assert.equal(shows(nt('A2253/26', '01MAR0000-31MAR2359', '10-10 0100-0300'), c), true, 'schedule 10-10 0100-0300');
  assert.equal(shows(nt('A2254/26', '01MAR0000-31MAR2359', '10-10 2300-2359'), c), false, 'schedule 10-10 2300-2359');
});

test('TC-122-005 departure time unknown → shown if in effect on D or D+1 (date range AND schedule)', () => {
  const f = { eta: '1400', dep: null };   // candidate windows 09 MAR and 10 MAR, 1300 – 1500
  // Date range, at or after 1200Z (v1.11.1 hid the arrival-day one).
  assert.equal(shows(nt('A2261/26', '10MAR1300-10MAR1500'), f), true,  'dated 10 MAR 1300–1500 (D + 1)');
  assert.equal(shows(nt('A2262/26', '09MAR1300-09MAR1500'), f), true,  'dated 09 MAR 1300–1500 (D)');
  assert.equal(shows(nt('A2263/26', '11MAR1300-11MAR1500'), f), false, 'dated 11 MAR: neither D nor D + 1');
  assert.equal(shows(nt('A2264/26', '10MAR1501-10MAR2359'), f), false, 'dated 10 MAR after the window');
  // Date range AND day-of-month schedule on the arrival day.
  assert.equal(shows(nt('A2265/26', '10MAR1300-10MAR1500', '10-10 1300-1500'), f), true,  'dated and scheduled 10 MAR');
  assert.equal(shows(nt('A2266/26', '01MAR0000-31MAR2359', '10-10 1300-1500'), f), true,  'scheduled 10-10');
  assert.equal(shows(nt('A2267/26', '01MAR0000-31MAR2359', '09-09 1300-1500'), f), true,  'scheduled 09-09');
  assert.equal(shows(nt('A2268/26', '01MAR0000-31MAR2359', '11-11 1300-1500'), f), false, 'scheduled 11-11');
  // Before 1200Z: as before, both days.
  assert.equal(shows(nt('A2269/26', '10MAR0000-10MAR0200'), { eta: '0030', dep: null }), true, 'ETA 0030Z, dated 10 MAR');
  assert.equal(shows(nt('A2270/26', '09MAR0000-09MAR0200'), { eta: '0030', dep: null }), true, 'ETA 0030Z, dated 09 MAR');
});

test('TC-122-006 no ETA / no flight date / unreadable dates / UFN / EST / PERM → shown', () => {
  const f = { eta: '1800', dep: '2300' };   // window 10 MAR 1700 – 1900
  assert.equal(shows(nt('A2271/26', '01JAN0000-02JAN0000'), { eta: null, dep: '2300' }), true, 'no ETA');
  assert.equal(shows(nt('A2272/26', '01JAN0000-02JAN0000'), { eta: '1800', dep: '2300', iso: '' }), true, 'no flight date');
  assert.equal(shows(nt('A2273/26', '01JAN0000-02JAN0000'), { eta: '1800', dep: '2300', iso: 'not-a-date' }), true, 'flight date unreadable');
  for (const r of ['32MAR0000-33MAR2359', '10MAR1800-09MAR1800', '10MAR2500-10MAR2600']) {
    assert.equal(shows(nt('A2274/26', r), f), true, `unreadable dates ${r} (T6, D27)`);
  }
  assert.equal(shows(nt('A2275/26', '01MAR0000-UFN'), f), true, 'UFN');
  assert.equal(shows('- XXXX A2276/26 01MAR0000-UFN(EST 05MAR1200)\nRWY 09/27 CLSD\n', f), true, 'UFN(EST …) passed');
  assert.equal(shows(nt('A2277/26', '09MAR0000-09MAR1200 EST'), f), true, 'EST end passed (D31)');
  assert.equal(shows(nt('A2278/26', '01MAR0000-PERM'), f), true, 'PERM');
  // Negatives: a readable start after the window still limits EST and PERM.
  assert.equal(shows(nt('A2279/26', '11MAR0000-11MAR1200 EST'), f), false, 'EST, starts 11 MAR');
  assert.equal(shows(nt('A2280/26', '11MAR0000-PERM'), f), false, 'PERM, starts 11 MAR');
});

test('TC-122-007 day-of-month schedule: wrong day → hidden; right day → shown', () => {
  // Arrival on D + 1 at 1300Z (departed 2300Z): window 10 MAR 1200 – 1400.
  const f = { eta: '1300', dep: '2300' };
  assert.equal(shows(nt('A2281/26', '01MAR0000-31MAR2359', '09-09 1200-1400'), f), false, '09-09 (D)');
  assert.equal(shows(nt('A2282/26', '01MAR0000-31MAR2359', '11-12 1200-1400'), f), false, '11-12');
  assert.equal(shows(nt('A2283/26', '01MAR0000-31MAR2359', '10-10 1200-1400'), f), true,  '10-10 (D + 1)');
  assert.equal(shows(nt('A2284/26', '01MAR0000-31MAR2359', '08-08 10-11 1200-1400'), f), true, '08-08 10-11');
  // Departure airport at 0300Z: window 09 MAR 0200 – 0400.
  const g = { role: 'ORIG', eta: '0300', dep: '0300' };
  assert.equal(shows(nt('A2285/26', '01MAR0000-31MAR2359', '10-10 0200-0400'), g), false, 'ORIG 10-10 (D + 1)');
  assert.equal(shows(nt('A2286/26', '01MAR0000-31MAR2359', '09-09 0200-0400'), g), true,  'ORIG 09-09 (D)');
  // DLY keeps the window's times of day.
  assert.equal(shows(nt('A2287/26', '01MAR0000-31MAR2359', 'DLY 1200-1400'), f), true,  'DLY 1200-1400');
  assert.equal(shows(nt('A2288/26', '01MAR0000-31MAR2359', 'DLY 1401-1600'), f), false, 'DLY 1401-1600');
});

test('TC-122-008 _evalWindows(): the one window; the date-range and schedule checks use it', () => {
  assert.equal(typeof mod._evalWindows, 'function', 'module exports _evalWindows');
  const w = (eta, dep, iso = D) => mod._evalWindows(hm(eta), dep === null ? null : hm(dep), iso).map(x => `${z(x.startMs)}/${z(x.endMs)}`);
  assert.deepEqual(w('1300', '2300'), ['2026-03-10T12:00/2026-03-10T14:00'], 'ETA earlier than OUT → D + 1');
  assert.deepEqual(w('1300', '0200'), ['2026-03-09T12:00/2026-03-09T14:00'], 'ETA later than OUT → D');
  assert.deepEqual(w('0300', '0300'), ['2026-03-09T02:00/2026-03-09T04:00'], 'ETA = OUT (departure airport) → D');
  assert.deepEqual(w('0300', '2300'), ['2026-03-10T02:00/2026-03-10T04:00'], 'before 1200Z, OUT known → D + 1 only');
  assert.deepEqual(w('1500', '0100'), ['2026-03-09T14:00/2026-03-09T16:00'], 'at or after 1200Z, OUT known → D only');
  assert.deepEqual(w('1400', null), ['2026-03-09T13:00/2026-03-09T15:00', '2026-03-10T13:00/2026-03-10T15:00'], 'OUT unknown → D and D + 1');
  assert.deepEqual(mod._evalWindows(hm('1400'), undefined, D).length, 2, 'OUT omitted → D and D + 1');
  assert.deepEqual(w('0030', '1600', '2026-12-31'), ['2026-12-31T23:30/2027-01-01T01:30'], 'D + 1 across the year end');
  assert.deepEqual(mod._evalWindows(hm('1400'), hm('0100'), 'not-a-date'), [], 'flight date unreadable → []');
  // nwOverlap_standalone() agrees with the window, edges included.
  const [x] = mod._evalWindows(hm('1800'), hm('2300'), D);
  assert.equal(mod.nwOverlap_standalone({ startMs: x.endMs, endMs: x.endMs + 1 }, hm('1800'), D, hm('2300')), true, 'starts at the end edge');
  assert.equal(mod.nwOverlap_standalone({ startMs: x.startMs - 1, endMs: x.startMs }, hm('1800'), D, hm('2300')), true, 'ends at the start edge');
  assert.equal(mod.nwOverlap_standalone({ startMs: x.endMs + 60000, endMs: x.endMs + 120000 }, hm('1800'), D, hm('2300')), false, 'after the window');
  assert.equal(mod.nwOverlap_standalone({ startMs: x.startMs - 86400000, endMs: x.endMs - 86400000 }, hm('1800'), D, hm('2300')), false, 'the same times on D');
  // One builder: the window arithmetic (ETA ms from the flight date) exists only in _evalWindows.
  const src = fs.readFileSync(MOD_FILE, 'utf8');
  const body = name => { const i = src.indexOf(`function ${name}(`); return src.slice(i, src.indexOf('\n}\n', i)); };
  for (const n of ['nwOverlap_standalone', '_schedWindowMinutes']) {
    assert.ok(/_evalWindows\(/.test(body(n)), `${n}() uses _evalWindows()`);
    assert.ok(!/86400000|T00:00:00Z|etaMin\s*<\s*720/.test(body(n)), `${n}() builds no window of its own`);
  }
  assert.ok(!/etaMin\s*<\s*720/.test(src.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')), 'no "ETA before 1200Z" rule in the module code');
});

test('TC-122-009 through evalAirport(), departure time from S.outZ', () => {
  const run = (n, eta, out, role = 'DEST') => {
    const a = loadApp();
    a.sandbox.window._flightDateISO = D;
    a.S.outZ = out;
    return a.evalAirport('XXXX', eta, n, '', null, role, 'B744').issues.some(i => /RWY 09\/27/.test(i.text));
  };
  assert.equal(run(nt('A2291/26', '09MAR1200-09MAR1400'), '1300', '2300'), false, 'departure-day-only NOTAM, ETA 10 MAR 1300Z');
  assert.equal(run(nt('A2292/26', '10MAR1200-10MAR1400'), '1300', '2300'), true,  'arrival-day NOTAM, ETA 10 MAR 1300Z');
  assert.equal(run(nt('A2293/26', '10MAR0000-10MAR2359'), '0300', '0300', 'ORIG'), false, 'ORIG 0300Z, NOTAM 10 MAR');
  assert.equal(run(nt('A2294/26', '09MAR0000-09MAR2359'), '0300', '0300', 'ORIG'), true,  'ORIG 0300Z, NOTAM 09 MAR');
  assert.equal(run(nt('A2295/26', '10MAR1300-10MAR1500'), '1400', ''), true, 'S.outZ empty (departure time unknown), arrival-day NOTAM');
});
