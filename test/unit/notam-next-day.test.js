'use strict';
/**
 * TC-121 — NOTAMs for the arrival day are not hidden when the flight lands on the
 * next UTC day at or after 1200Z (NOTAM ruleset module v1.11.1, ledger P-22; TC-121-007
 * updated for v1.11.2, ledger P-23).
 * Source: HF-8 QA (app PR #36, S2 finding) and the 1.9.9-hf3 gate (app PR #40).
 *
 * Exec rule (HF-8, unchanged): schedules are checked against the actual UTC date and
 * time of every part of the evaluation window (ETA ± 60 min; both UTC dates when the
 * window crosses 0000Z). In effect if ANY part of the window falls in a scheduled
 * period. D27: a schedule that cannot be read → the NOTAM is shown.
 *
 * Defect (v1.11.0): the date-range check (nwOverlap_standalone) anchored the ETA on
 * the departure date D and tried D + 1 only when the ETA time was before 1200Z. A
 * NOTAM dated only for the arrival day (D + 1) was therefore hidden for an arrival at
 * or after 1200Z on D + 1, before its schedule was even read.
 *
 *   TC-121-001  arrival-day-only schedule, ETA on D + 1 at 0030Z, 1159Z, 1200Z, 1800Z,
 *               2330Z → in effect
 *   TC-121-002  same, through evalAirport() (departure time from S.outZ)
 *   TC-121-003  negatives: departure-day-only schedule with the window wholly on D + 1;
 *               arrival-day NOTAM outside the window; NOTAM dated D + 2; ORIG unchanged
 *   TC-121-004  window crossing 0000Z both ways (ETA 0030Z and 2330Z on D + 1)
 *   TC-121-005  day-of-month (single, range, several ranges), day-of-week and DLY forms
 *   TC-121-006  unreadable schedule on the arrival day → shown (D27)
 *   TC-121-007  nwOverlap_standalone(): D + 1 tried when the departure time says so;
 *               departure time unknown (or the 3-argument call) → D and D + 1 (v1.11.2)
 *
 * Synthetic NOTAMs only (XXXX); no fixture text. All times are UTC.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness');

const app = loadApp();
const hm  = s => parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(2), 10);

// Synthetic flight: departs on D = Mon 09 MAR 2026; every ETA below is earlier in the
// day than the departure time, so the flight lands on D + 1 = Tue 10 MAR.
const D = '2026-03-09';

function shows(notam, { role = 'DEST', eta, dep, iso = D } = {}) {
  const r = app.evalNotamsAs([notam], role, hm(eta), 'B744', iso, dep === null ? null : hm(dep));
  return r.issues.some(i => i.notamRaw === notam);
}
// A NOTAM with a header date range and an optional schedule line.
const nt = (id, range, sched) => `- XXXX ${id} ${range}\n${sched ? sched + '\n' : ''}RWY 09/27 CLSD\n`;

// Arrival-day-only NOTAMs: dated and scheduled on 10 MAR only, around each ETA.
const ARRIVAL_DAY = [
  // ETA,   departure, period on 10 MAR
  ['0030', '1600', '0000', '0200'],
  ['1159', '2300', '1100', '1300'],
  ['1200', '2300', '1130', '1400'],
  ['1800', '2300', '1700', '1900'],
  ['2330', '2345', '2300', '2359'],
];

test('TC-121-001 arrival-day-only schedule, ETA on D+1 at 0030Z, 1159Z, 1200Z, 1800Z, 2330Z → in effect', () => {
  for (const [eta, dep, s, e] of ARRIVAL_DAY) {
    const n = nt('A2101/26', `10MAR${s}-10MAR${e}`, `10-10 ${s}-${e}`);
    assert.equal(shows(n, { eta, dep }), true, `ETA 10 MAR ${eta}Z (departed 09 MAR ${dep}Z): 10-10 ${s}-${e} in effect`);
  }
});

test('TC-121-002 the same, through evalAirport() with the departure time from S.outZ', () => {
  for (const [eta, dep, s, e] of ARRIVAL_DAY) {
    const n = nt('A2102/26', `10MAR${s}-10MAR${e}`, `10-10 ${s}-${e}`);
    const a = loadApp();
    a.sandbox.window._flightDateISO = D;
    a.S.outZ = dep;
    const st = a.evalAirport('XXXX', eta, n, '', null, 'DEST', 'B744');
    assert.ok(st.issues.some(i => /RWY 09\/27/.test(i.text)), `evalAirport() shows it at ETA ${eta}Z`);
  }
});

test('TC-121-003 negatives: departure-day-only schedule with the window wholly on D+1 → not in effect', () => {
  // Window 10 MAR 1700–1900. Schedule on 09 MAR only, at the same times of day.
  assert.equal(shows(nt('A2103/26', '09MAR1700-09MAR1900', '09-09 1700-1900'), { eta: '1800', dep: '2300' }), false,
    '09-09 1700-1900, ETA 10 MAR 1800Z');
  assert.equal(shows(nt('A2104/26', '09MAR0000-10MAR2359', '09-09 1700-1900'), { eta: '1800', dep: '2300' }), false,
    'range 09–10 MAR, schedule 09-09 1700-1900, ETA 10 MAR 1800Z');
  assert.equal(shows(nt('A2105/26', '09MAR1100-09MAR1300', '09-09 1100-1300'), { eta: '1200', dep: '2300' }), false,
    '09-09 1100-1300, ETA 10 MAR 1200Z');
  // Arrival-day NOTAM whose period is outside ETA ± 60.
  assert.equal(shows(nt('A2106/26', '10MAR0000-10MAR2359', '10-10 0800-1000'), { eta: '1800', dep: '2300' }), false,
    '10-10 0800-1000, ETA 10 MAR 1800Z');
  assert.equal(shows(nt('A2107/26', '10MAR1901-10MAR2200', '10-10 1901-2200'), { eta: '1800', dep: '2300' }), false,
    '10-10 1901-2200 starts after ETA + 60');
  assert.equal(shows(nt('A2108/26', '10MAR1000-10MAR1059', '10-10 1000-1059'), { eta: '1200', dep: '2300' }), false,
    '10-10 1000-1059 ends before ETA − 60');
  // Dated the day after the arrival day.
  assert.equal(shows(nt('A2109/26', '11MAR0000-11MAR2359'), { eta: '1200', dep: '2300' }), false, 'dated 11 MAR, ETA 10 MAR 1200Z');
  // Departure airport: the window is the departure time on D; a NOTAM dated D + 1 is not in effect.
  assert.equal(shows(nt('A2110/26', '10MAR0000-10MAR2359', '10-10 0000-2359'), { role: 'ORIG', eta: '1800', dep: '1800' }), false,
    'ORIG, departure 09 MAR 1800Z, NOTAM 10 MAR');
  // Flight that lands the same UTC day (ETA later than departure): D + 1 is not tried at or after 1200Z.
  assert.equal(shows(nt('A2111/26', '10MAR1700-10MAR1900', '10-10 1700-1900'), { eta: '1800', dep: '0600' }), false,
    'departed 09 MAR 0600Z, ETA 09 MAR 1800Z, NOTAM 10 MAR');
});

test('TC-121-004 window crossing 0000Z both ways', () => {
  // ETA 0030Z on D+1: window 09 MAR 2330 – 10 MAR 0130.
  assert.equal(shows(nt('A2112/26', '09MAR2300-09MAR2359', '09-09 2300-2359'), { eta: '0030', dep: '1600' }), true, '09-09 2300-2359');
  assert.equal(shows(nt('A2113/26', '10MAR0100-10MAR0300', '10-10 0100-0300'), { eta: '0030', dep: '1600' }), true, '10-10 0100-0300');
  assert.equal(shows(nt('A2114/26', '10MAR0131-10MAR0300', '10-10 0131-0300'), { eta: '0030', dep: '1600' }), false, '10-10 0131-0300 (after ETA + 60)');
  // ETA 2330Z on D+1: window 10 MAR 2230 – 11 MAR 0030.
  assert.equal(shows(nt('A2115/26', '11MAR0000-11MAR0300', '11-11 0000-0300'), { eta: '2330', dep: '2345' }), true, '11-11 0000-0300');
  assert.equal(shows(nt('A2116/26', '10MAR2300-11MAR0100', '10-10 2300-0100'), { eta: '2330', dep: '2345' }), true, 'overnight 10-10 2300-0100');
  assert.equal(shows(nt('A2117/26', '11MAR0031-11MAR0300', '11-11 0031-0300'), { eta: '2330', dep: '2345' }), false, '11-11 0031-0300 (after ETA + 60)');
  assert.equal(shows(nt('A2118/26', '10MAR1000-10MAR2229', '10-10 1000-2229'), { eta: '2330', dep: '2345' }), false, '10-10 1000-2229 (before ETA − 60)');
});

test('TC-121-005 day-of-month, day-of-week and DLY forms on the arrival day (ETA 10 MAR 1800Z)', () => {
  const f = { eta: '1800', dep: '2300' };
  // Day-of-month: one day, a range, several ranges.
  assert.equal(shows(nt('A2119/26', '10MAR1700-12MAR1900', '10-12 1700-1900'), f), true, '10-12 1700-1900');
  assert.equal(shows(nt('A2120/26', '10MAR1700-14MAR1900', '10-10 12-14 1700-1900'), f), true, '10-10 12-14 1700-1900');
  assert.equal(shows(nt('A2121/26', '10MAR1700-14MAR1900', '11-14 1700-1900'), f), false, '11-14 1700-1900 (not on 10 MAR)');
  assert.equal(shows(nt('A2122/26', '11MAR1700-14MAR1900', '11-14 1700-1900'), f), false, 'dated and scheduled 11–14 MAR');
  // Day-of-week: the day is not read (fail-safe); the NOTAM's dates decide.
  assert.equal(shows(nt('A2123/26', '10MAR1700-10MAR1900', 'TUE 1700-1900'), f), true, 'TUE 1700-1900, dated 10 MAR');
  assert.equal(shows(nt('A2124/26', '11MAR1700-11MAR1900', 'WED 1700-1900'), f), false, 'WED 1700-1900, dated 11 MAR');
  // DLY: the same every day.
  assert.equal(shows(nt('A2125/26', '10MAR0000-12MAR2359', 'DLY 1700-1900'), f), true, 'DLY 1700-1900');
  assert.equal(shows(nt('A2126/26', '10MAR0000-12MAR2359', 'DLY 0800-1000'), f), false, 'DLY 0800-1000');
});

test('TC-121-006 unreadable schedule on the arrival day → shown (D27)', () => {
  const f = { eta: '1800', dep: '2300' };
  for (const s of ['10-10 2500-2600', '32-35 1700-1900', '12-10 1700-1900', 'DLY 2560-9999']) {
    assert.equal(shows(nt('A2127/26', '10MAR0000-10MAR2359', s), f), true, `${s}, ETA 10 MAR 1800Z`);
  }
});

test('TC-121-007 nwOverlap_standalone(): D+1 tried when the departure time places the ETA on D+1', () => {
  const w = app.xNW_standalone('- XXXX A2128/26 10MAR1100-10MAR1300\nRWY 09/27 CLSD\n', D);
  assert.ok(w, 'window read');
  assert.equal(app.nwOverlap_standalone(w, hm('1200'), D, hm('2300')), true,  'ETA 1200Z, departed 2300Z → D+1 → in effect');
  assert.equal(app.nwOverlap_standalone(w, hm('1200'), D, hm('1100')), false, 'ETA 1200Z, departed 1100Z → D → not in effect');
  assert.equal(app.nwOverlap_standalone(w, hm('1200'), D, hm('1200')), false, 'ETA = departure time → D');
  // v1.11.2 (P-23): no departure time → the date cannot be read, D and D + 1 are both
  // tried whatever the ETA time (fail-safe). v1.11.1 tried D + 1 only before 1200Z.
  assert.equal(app.nwOverlap_standalone(w, hm('1200'), D), true, '3-argument call: D and D+1 → in effect on D+1');
  assert.equal(app.nwOverlap_standalone(w, hm('1200'), D, null), true, 'departure time unknown: D and D+1 → in effect on D+1');
  assert.equal(app.nwOverlap_standalone(w, hm('1159'), D, null), true, 'departure time unknown, ETA before 1200Z → in effect on D+1');
  assert.equal(app.nwOverlap_standalone(w, hm('1500'), D, null), false, 'departure time unknown: neither D nor D+1 (10 MAR 1400–1600) → not in effect');
});
