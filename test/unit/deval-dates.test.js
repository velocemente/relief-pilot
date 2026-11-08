'use strict';
/**
 * TC-140 — D-EVAL dates (Exec rule D51, 7 Nov): "If the flight is delayed past 0000Z the
 * date MUST change. Each time update (OUT, OFF, etc.) dynamically updates the time and the
 * weather and NOTAM evaluation window for all downline times."
 *
 * The app keeps OUT, OFF, the destination ETA and every alternate ETA as a UTC date-and-time
 * (ms) beside its HHMM display value (the timeline, src/state.html). On import OUT is on the
 * DOF date and each downline time is OUT + its OFP offset (no 24 h wrap). An edited HHMM goes
 * on the UTC date nearest the time it replaces (within 12 h). evalAirport() gives the NOTAM
 * module the UTC date of the current OUT and the OUT time, and reads the TAF on the
 * airport's own ETA date.
 *
 *   TC-140-001  no edit, synthetic: departure, destination and alternate dates, same-day
 *               and next-day flights
 *   TC-140-002  no edit, every fixture: each time is OUT + its OFP offset; next-day
 *               arrivals on D + 1, same-day arrivals on D
 *   TC-140-003  no edit, next-day arrival: NOTAM and TAF windows on the arrival date
 *   TC-140-004  OUT edit 2300Z → 0100Z: OUT, ETAs on D + 1; NOTAM and TAF windows move
 *   TC-140-005  OFF edit past 0000Z: OFF and ETAs on D + 1; TAF window moves
 *   TC-140-006  OFF delayed more than a day after OUT: the ETA's own date is used
 *   TC-140-007  IN (destination ETA) edit placement, both ways and the 12 h tie
 *   TC-140-008  edit back (0100Z → 2300Z): previous day, as at import
 *   TC-140-009  31 DEC 2330Z → 0030Z on 01 JAN (year end): dates, NOTAM year, TAF month end
 *   TC-140-010  28 / 29 FEB (non-leap and leap years)
 *   TC-140-011  save → reload keeps the dates
 *   TC-140-012  a flight saved by an older version (no timeline) reloads, rebuilt as at import
 *   TC-140-013  fixtures, OUT delayed past 0000Z (the v1.11.2 QA simulation): no NOTAM in
 *               effect on the actual date is hidden
 *   TC-140-014  TAF month end without an edit (TAF issued the previous month)
 *
 * Synthetic airports (XXXO, XXXX, XXXA), NOTAMs and TAFs only; the fixtures are read through
 * the app's import path and only IDs, ICAO codes and times are used. All times are UTC.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const vm     = require('vm');
const { loadApp } = require('../harness');
const { importFixture, readManifest, requireFixtures, peek } = require('../lib/app-path');

const DAY = 86400000;
const hm  = s => parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(2), 10);
const run = (app, code) => vm.runInContext(code, app.sandbox);
const tl  = app => JSON.parse(JSON.stringify(run(app, '_tl')));
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const at  = ms => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
const ms  = (date, hhmm) => Date.parse(date + 'T00:00:00Z') + hm(hhmm) * 60000;
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const ofpDate = d => `${d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(2, 4)}`;   // "09 MAR 26"
const addHM = (hhmm, mins) => { const t = ((hm(hhmm) + mins) % 1440 + 1440) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + String(t % 60).padStart(2, '0'); };

// The edit popover: confirmEdit() reads document.getElementById('editInput').value.
function withEditInput(app) {
  const input = { value: '', maxLength: 0, focus() {}, select() {}, addEventListener() {} };
  const doc = app.sandbox.document;
  app.sandbox.document = new Proxy(doc, {
    get: (t, p) => (p === 'getElementById' ? (id => (id === 'editInput' ? input : t.getElementById(id))) : t[p]),
  });
  return input;
}
function edit(app, field, value) {
  if (!app._input) app._input = withEditInput(app);
  app._input.value = value;
  run(app, `_editField = ${JSON.stringify(field)}`);
  app.confirmEdit();
}

// A synthetic flight, set up as parseOFP() leaves it: S from the OFP, the flight date, then
// the timeline (parseOFP() calls _tlBuild() before it renders).
//   alts: [{ icao, role, off }] — off = minutes from OUT (OFP offset)
function flight({ dof, out, destOff, trip = null, taxi = 20, alts = [] }) {
  const app = loadApp();
  run(app, 'resetStateForNewFlight()');
  Object.assign(app.S, {
    fltNum: 'XXX1', date: ofpDate(dof), outZ: out, origIcao: 'XXXO', destIcao: 'XXXX',
    etaDest: addHM(out, destOff), destEtaOffsetMins: destOff,
    tripMinutes: trip === null ? destOff - taxi : trip, taxiMins: taxi, acftType: 'B744',
    altData: alts.map(a => ({ icao: a.icao, role: a.role, ofpEta: addHM(out, a.off), ofpOffsetMins: a.off, currentEta: addHM(out, a.off) })),
  });
  app.sandbox.window._flightDateISO = dof;
  run(app, '_tlBuild()');
  return app;
}
const aptData = app => peek(app, 'airportData');

// The NOTAMs and weather the airport cards show, through the app's own path:
// getAllAirports() → evalAirport(), as buildAirportCards() calls it.
function card(app, icao) {
  const apt = app.getAllAirports().find(a => a.icao === icao);
  assert.ok(apt, `${icao} is a release airport`);
  const d = aptData(app)[icao] || { notams: '', weather: '' };
  const st = app.evalAirport(apt.icao, apt.eta, d.notams, d.weather, apt.wxWindow, apt.role, app.S.acftType);
  const notams = [];
  for (const [, g] of st.rwyGroups) for (const it of g.items) notams.push(it.notamRaw);
  st.sidIssues.concat(st.starIssues).forEach(i => notams.push(i.notamRaw));
  return { st, notams, wx: st.wxIssues.map(i => i.text).join(' | '), apt };
}
const shows = (app, icao, n) => card(app, icao).notams.some(r => r === n);
// Synthetic NOTAM: header date range, then text.
const nt = (icao, id, range) => `- ${icao} ${id} ${range}\nRWY 09/27 CLSD\n`;
function setNotams(app, icao, list) {
  const d = aptData(app);
  d[icao] = Object.assign(d[icao] || { weather: '' }, { notams: list.join('') });
}
function setWx(app, icao, taf) {
  const d = aptData(app);
  d[icao] = Object.assign(d[icao] || { notams: '' }, { weather: taf });
}

// ══ TC-140-001 ════════════════════════════════════════════════════════════
test('TC-140-001 no edit: departure, destination and alternate dates, same-day and next-day flights', () => {
  // Same day: OUT 09 MAR 0100Z, DEST +600 (1100Z), ALT +630 (1130Z) — all on 09 MAR.
  let a = flight({ dof: '2026-03-09', out: '0100', destOff: 600, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 630 }] });
  let t = tl(a);
  assert.equal(at(t.outMs), '2026-03-09 01:00Z', 'OUT on DOF');
  assert.equal(at(t.etaDestMs), '2026-03-09 11:00Z', 'same-day DEST stays on D (not D + 1)');
  assert.equal(at(t.alt.XXXA), '2026-03-09 11:30Z', 'same-day ALT stays on D');
  // Next day: OUT 09 MAR 2300Z, DEST +600 (10 MAR 0900Z), ALT +630 (10 MAR 0930Z).
  a = flight({ dof: '2026-03-09', out: '2300', destOff: 600, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 630 }] });
  t = tl(a);
  assert.equal(at(t.outMs), '2026-03-09 23:00Z', 'OUT on DOF');
  assert.equal(at(t.etaDestMs), '2026-03-10 09:00Z', 'next-day DEST on D + 1');
  assert.equal(at(t.alt.XXXA), '2026-03-10 09:30Z', 'next-day ALT on D + 1');
  assert.equal(t.offMs, null, 'no OFF entered');
  // The display values are unchanged HHMM.
  assert.equal(a.S.outZ, '2300'); assert.equal(a.S.etaDest, '0900'); assert.equal(a.S.altData[0].currentEta, '0930');
  // The ETA used by evalAirport() is the dated one; the departure airport uses OUT.
  assert.equal(at(run(a, `_tlEtaMs('XXXO', 'ORIG', '2300')`)), '2026-03-09 23:00Z');
  assert.equal(at(run(a, `_tlEtaMs('XXXX', 'DEST', '0900')`)), '2026-03-10 09:00Z');
  assert.equal(at(run(a, `_tlEtaMs('XXXA', 'DEST ALT', '0930')`)), '2026-03-10 09:30Z');
  // No flight date → no dated times (evaluation falls back to the flight date, as before).
  a = flight({ dof: '', out: '2300', destOff: 600 });
  assert.equal(tl(a).outMs, null, 'no DOF → no dated OUT');
  assert.equal(run(a, `_tlEtaMs('XXXX', 'DEST', '0900')`), null);
});

// ══ TC-140-002 ════════════════════════════════════════════════════════════
test('TC-140-002 no edit, every fixture: each time is OUT + its OFP offset on the actual date', async () => {
  const dir = requireFixtures();
  let checked = 0, nextDay = 0;
  const seen = {};
  for (const fx of readManifest(dir).fixtures) {
    const imp = await importFixture(fx, dir);
    const t = tl(imp.app), S = imp.S, dof = imp.app.sandbox.window._flightDateISO;
    assert.equal(at(t.outMs), `${dof} ${S.outZ.slice(0, 2)}:${S.outZ.slice(2)}Z`, `${fx.id}: OUT on the DOF date`);
    if (S.destEtaOffsetMins !== null) {
      assert.equal(t.etaDestMs - t.outMs, S.destEtaOffsetMins * 60000, `${fx.id}: DEST = OUT + offset`);
      checked++;
    }
    for (const alt of S.altData) {
      if (alt.ofpOffsetMins !== null) {
        assert.equal(t.alt[alt.icao] - t.outMs, alt.ofpOffsetMins * 60000, `${fx.id} ${alt.icao}: = OUT + offset`);
      } else if (alt.currentEta) {
        const d = t.alt[alt.icao] - t.outMs;    // CFS ALT: the first time at or after OUT
        assert.ok(d >= 0 && d < DAY, `${fx.id} ${alt.icao} (${alt.role}): within 24 h after OUT`);
      }
      checked++;
    }
    for (const apt of imp.app.getAllAirports()) {
      const e = run(imp.app, `_tlEtaMs(${JSON.stringify(apt.icao)}, ${JSON.stringify(apt.role)}, ${JSON.stringify(apt.eta)})`);
      if (e === null) continue;
      if (iso(e) !== dof) nextDay++;
      seen[`${fx.id} ${apt.icao}`] = iso(e);
    }
  }
  assert.ok(checked > 100, `${checked} downline times checked`);
  assert.ok(nextDay > 0, `${nextDay} airports reached on a later UTC day than DOF`);
  // Spot checks: a next-day arrival and a same-day arrival.
  assert.equal(seen['NB_YSSY-RKSI_11MAR26_rda_rev6 RKSI'], '2026-03-12', 'OUT 2300Z on 11 MAR → RKSI on 12 MAR');
  assert.equal(seen['NB_YSSY-RKSI_11MAR26_rda_rev6 YSSY'], '2026-03-11', 'departure on 11 MAR');
  assert.equal(seen['NB_VHHH-PANC_05APR26_vzfw_rev29 PANC'], '2026-04-05', 'OUT 0700Z → PANC the same day');
  assert.equal(seen['NB_KORD-RKSI_31MAY26_altroute_rev10 RKSI'], '2026-06-01', 'month end: 31 MAY → 01 JUN');
  assert.equal(seen['NB_KCHS-LIBG_12MAR26_lcf_rev16 CYQX'], '2026-03-13', 'CFS ALT window midpoint after OUT → 13 MAR');
});

// ══ TC-140-003 ════════════════════════════════════════════════════════════
// Next-day arrival without an edit. OUT 09 MAR 2000Z, DEST +1000 → 10 MAR 1240Z.
test('TC-140-003 no edit, next-day arrival: NOTAM and TAF windows on the arrival date', () => {
  const a = flight({ dof: '2026-03-09', out: '2000', destOff: 1000 });
  const onArr = nt('XXXX', 'A1401/26', '10MAR1200-10MAR1300');
  // (Module v1.11.1 also tries the departure date D for a next-day arrival, fail-safe; v1.11.2
  // narrows that. The negative here is a NOTAM on D + 2, outside both.)
  const after = nt('XXXX', 'A1402/26', '11MAR1200-11MAR1300');
  setNotams(a, 'XXXX', [onArr, after]);
  assert.equal(shows(a, 'XXXX', onArr), true, 'NOTAM 10 MAR 1200–1300 in effect at 10 MAR 1240Z');
  assert.equal(shows(a, 'XXXX', after), false, 'NOTAM 11 MAR 1200–1300 not in effect at 10 MAR 1240Z');
  // TAF: a TEMPO at the same time of day on each date. Only the arrival day's applies.
  setWx(a, 'XXXX', 'TAF XXXX 091700Z 0918/1024 27010KT P6SM SKC\nTEMPO 0912/0914 1/2SM FG OVC002\nTEMPO 1012/1014 2SM BR OVC008\n');
  const c = card(a, 'XXXX');
  assert.match(c.wx, /800ft/, 'TEMPO 1012/1014 (arrival day) applies');
  assert.doesNotMatch(c.wx, /200ft/, 'TEMPO 0912/0914 (departure day) does not');
  assert.equal(c.st.color, 'red');
  // The window itself: extractEtaWindow() with the ETA date selects only the arrival-day group.
  const sel = a.extractEtaWindow('TAF XXXX 091700Z 0918/1024 27010KT P6SM SKC\nTEMPO 0912/0914 1/2SM FG OVC002\nTEMPO 1012/1014 2SM BR OVC008\n', hm('1240'), null, '2026-03-10');
  assert.match(sel, /TEMPO 1012\/1014/); assert.doesNotMatch(sel, /TEMPO 0912\/0914/);
});

// ══ TC-140-004 ════════════════════════════════════════════════════════════
// OUT 09 MAR 2300Z, DEST +820 (10 MAR 1240Z), ALT +850. Edit OUT → 0100Z: 10 MAR 0100Z
// (2 h later, next day); DEST 10 MAR 1440Z, ALT 10 MAR 1510Z.
test('TC-140-004 OUT edit 2300Z → 0100Z: OUT and every ETA on D + 1; NOTAM and TAF windows move', () => {
  const a = flight({ dof: '2026-03-09', out: '2300', destOff: 820, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 850 }] });
  edit(a, 'outZ', '0100');
  const t = tl(a);
  assert.equal(a.S.outZ, '0100');
  assert.equal(at(t.outMs), '2026-03-10 01:00Z', 'OUT moved to the next day');
  assert.equal(at(t.etaDestMs), '2026-03-10 14:40Z', 'DEST follows');
  assert.equal(a.S.etaDest, '1440');
  assert.equal(at(t.alt.XXXA), '2026-03-10 15:10Z', 'ALT follows');
  assert.equal(a.S.altData[0].currentEta, '1510');
  // The NOTAM module gets the date of the current OUT.
  const nd = run(a, `_tlNotamDate(${t.etaDestMs}, ${hm('1440')})`);
  assert.equal(nd.flightISO, '2026-03-10'); assert.equal(nd.depMin, hm('0100'));
  // DEST at 10 MAR 1440Z.
  const destNew = nt('XXXX', 'A1403/26', '10MAR1400-10MAR1500');
  const destOld = nt('XXXX', 'A1404/26', '09MAR1400-09MAR1500');
  setNotams(a, 'XXXX', [destNew, destOld]);
  assert.equal(shows(a, 'XXXX', destNew), true, 'DEST: NOTAM 10 MAR 1400–1500 in effect');
  assert.equal(shows(a, 'XXXX', destOld), false, 'DEST: NOTAM 09 MAR 1400–1500 not in effect');
  // ORIG at 10 MAR 0100Z.
  const origNew = nt('XXXO', 'A1405/26', '10MAR0030-10MAR0130');
  const origOld = nt('XXXO', 'A1406/26', '09MAR0030-09MAR0130');
  setNotams(a, 'XXXO', [origNew, origOld]);
  assert.equal(shows(a, 'XXXO', origNew), true, 'ORIG: NOTAM 10 MAR 0030–0130 in effect at the new OUT');
  assert.equal(shows(a, 'XXXO', origOld), false, 'ORIG: NOTAM 09 MAR 0030–0130 not in effect');
  // TAF at DEST: TEMPO at 1400–1600 on each date; only 10 MAR applies.
  setWx(a, 'XXXX', 'TAF XXXX 092300Z 1000/1106 27010KT P6SM SKC\nTEMPO 0914/0916 1/2SM FG OVC002\nTEMPO 1014/1016 2SM BR OVC008\n');
  const d = card(a, 'XXXX');
  assert.match(d.wx, /800ft/, 'TEMPO 1014/1016 applies');
  assert.doesNotMatch(d.wx, /200ft/, 'TEMPO 0914/0916 does not');
  // TAF at ORIG: TEMPO 1000/1002 applies to the 10 MAR 0100Z departure, 0900/0902 does not.
  setWx(a, 'XXXO', 'TAF XXXO 091700Z 0918/1024 27010KT P6SM SKC\nTEMPO 0900/0902 1/2SM FG OVC002\nTEMPO 1000/1002 2SM BR OVC008\n');
  const o = card(a, 'XXXO');
  assert.match(o.wx, /800ft/, 'ORIG: TEMPO 1000/1002 applies');
  assert.doesNotMatch(o.wx, /200ft/, 'ORIG: TEMPO 0900/0902 does not');
  // The saved flight carries the timeline.
  const saved = a.getFlights()[0];
  assert.equal(at(saved.timeline.outMs), '2026-03-10 01:00Z');
});

// ══ TC-140-005 ════════════════════════════════════════════════════════════
// OUT 09 MAR 2200Z, taxi 20 → planned OFF 2220Z. OFF entered 0030Z: 10 MAR 0030Z (2 h 10 min
// after the planned OFF). DEST = OFF + trip (780) = 10 MAR 1330Z; ALT = OFF + (810 − taxi 20).
test('TC-140-005 OFF edit past 0000Z: OFF and every ETA on D + 1; TAF window moves', () => {
  const a = flight({ dof: '2026-03-09', out: '2200', destOff: 800, trip: 780, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 810 }] });
  assert.equal(at(tl(a).etaDestMs), '2026-03-10 11:20Z', 'before: DEST 10 MAR 1120Z');
  edit(a, 'offZ', '0030');
  const t = tl(a);
  assert.equal(at(t.outMs), '2026-03-09 22:00Z', 'OUT unchanged');
  assert.equal(at(t.offMs), '2026-03-10 00:30Z', 'OFF on the next day');
  assert.equal(at(t.etaDestMs), '2026-03-10 13:30Z', 'DEST = OFF + trip'); assert.equal(a.S.etaDest, '1330');
  assert.equal(at(t.alt.XXXA), '2026-03-10 13:40Z', 'ALT = OFF + offset − taxi (0030 + 790)'); assert.equal(a.S.altData[0].currentEta, '1340');
  setWx(a, 'XXXX', 'TAF XXXX 092300Z 1000/1106 27010KT P6SM SKC\nTEMPO 0913/0915 1/2SM FG OVC002\nTEMPO 1013/1015 2SM BR OVC008\n');
  const c = card(a, 'XXXX');
  assert.match(c.wx, /800ft/, 'TEMPO 1013/1015 applies at 10 MAR 1330Z');
  assert.doesNotMatch(c.wx, /200ft/, 'TEMPO 0913/0915 does not');
  // OFF edited again, earlier: 0030Z → 2350Z is 40 min earlier, previous day.
  edit(a, 'offZ', '2350');
  assert.equal(at(tl(a).offMs), '2026-03-09 23:50Z');
  assert.equal(at(tl(a).etaDestMs), '2026-03-10 12:50Z');
});

// ══ TC-140-006 ════════════════════════════════════════════════════════════
// OUT 09 MAR 1000Z; OFF 2000Z (same day), then 0400Z (8 h later: 10 MAR). trip 600 →
// DEST 10 MAR 1400Z, 28 h after OUT. The module's OUT rule only covers 24 h, so the
// ETA's own date is passed.
test('TC-140-006 an ETA more than 24 h after OUT is evaluated on its own date', () => {
  const a = flight({ dof: '2026-03-09', out: '1000', destOff: 620, trip: 600 });
  edit(a, 'offZ', '2000');
  edit(a, 'offZ', '0400');
  const t = tl(a);
  assert.equal(at(t.offMs), '2026-03-10 04:00Z');
  assert.equal(at(t.etaDestMs), '2026-03-10 14:00Z');
  const nd = run(a, `_tlNotamDate(${t.etaDestMs}, ${hm('1400')})`);
  assert.equal(nd.flightISO, '2026-03-10', 'ETA date'); assert.equal(nd.depMin, hm('1400'));
  const n10 = nt('XXXX', 'A1407/26', '10MAR1330-10MAR1430');
  const n09 = nt('XXXX', 'A1408/26', '09MAR1330-09MAR1430');
  setNotams(a, 'XXXX', [n10, n09]);
  assert.equal(shows(a, 'XXXX', n10), true, '10 MAR 1330–1430 in effect');
  assert.equal(shows(a, 'XXXX', n09), false, '09 MAR 1330–1430 not in effect');
  // Within 24 h the module is given the OUT date and time.
  const b = flight({ dof: '2026-03-09', out: '1000', destOff: 620 });
  const nb = run(b, `_tlNotamDate(${tl(b).etaDestMs}, ${hm('2020')})`);
  assert.equal(nb.flightISO, '2026-03-09'); assert.equal(nb.depMin, hm('1000'));
});

// ══ TC-140-007 ════════════════════════════════════════════════════════════
test('TC-140-007 IN (destination ETA) edit: placed nearest the time it replaces', () => {
  const a = flight({ dof: '2026-03-09', out: '2300', destOff: 600 });     // IN 10 MAR 0900Z
  edit(a, 'etaDest', '0830');
  assert.equal(at(tl(a).etaDestMs), '2026-03-10 08:30Z', '0900 → 0830: 30 min earlier, same day');
  edit(a, 'etaDest', '2330');
  assert.equal(at(tl(a).etaDestMs), '2026-03-09 23:30Z', '0830 → 2330: 9 h earlier, previous day');
  edit(a, 'etaDest', '1000');
  assert.equal(at(tl(a).etaDestMs), '2026-03-10 10:00Z', '2330 → 1000: 10 h 30 min later, next day');
  edit(a, 'etaDest', '2200');
  assert.equal(at(tl(a).etaDestMs), '2026-03-10 22:00Z', '1000 → 2200: exactly 12 h → later');
  assert.equal(at(tl(a).outMs), '2026-03-09 23:00Z', 'OUT unchanged by an IN edit');
  // Cleared → no dated IN (evaluation falls back to the flight date).
  edit(a, 'etaDest', '');
  assert.equal(tl(a).etaDestMs, null);
});

// ══ TC-140-008 ════════════════════════════════════════════════════════════
test('TC-140-008 edit back 0100Z → 2300Z: previous day, the same timeline as at import', () => {
  const a = flight({ dof: '2026-03-09', out: '2300', destOff: 600, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 630 }] });
  const atImport = tl(a);
  edit(a, 'outZ', '0100');
  assert.equal(at(tl(a).outMs), '2026-03-10 01:00Z');
  edit(a, 'outZ', '2300');
  const t = tl(a);
  assert.equal(at(t.outMs), '2026-03-09 23:00Z', '0100Z → 2300Z: 2 h earlier, previous day');
  assert.deepEqual(t, atImport, 'OUT, DEST and ALT as at import');
  // A NOTAM dated only for 10 MAR around the delayed departure no longer applies.
  const n = nt('XXXO', 'A1409/26', '10MAR0030-10MAR0130');
  setNotams(a, 'XXXO', [n]);
  assert.equal(shows(a, 'XXXO', n), false, 'ORIG 09 MAR 2300Z: NOTAM 10 MAR 0030–0130 not in effect');
});

// ══ TC-140-009 ════════════════════════════════════════════════════════════
test('TC-140-009 year end: 31 DEC 2330Z → 0030Z on 01 JAN', () => {
  const a = flight({ dof: '2026-12-31', out: '2330', destOff: 600, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 630 }] });
  assert.equal(at(tl(a).etaDestMs), '2027-01-01 09:30Z', 'before the edit: DEST 01 JAN 2027');
  edit(a, 'outZ', '0030');
  const t = tl(a);
  assert.equal(at(t.outMs), '2027-01-01 00:30Z', 'OUT 01 JAN 2027');
  assert.equal(at(t.etaDestMs), '2027-01-01 10:30Z');
  assert.equal(at(t.alt.XXXA), '2027-01-01 11:00Z');
  assert.equal(run(a, `_tlNotamDate(${t.etaDestMs}, ${hm('1030')})`).flightISO, '2027-01-01', 'NOTAM year from the new date');
  const jan = nt('XXXX', 'A0001/27', '01JAN1000-01JAN1100');
  const jan2 = nt('XXXX', 'A0002/27', '02JAN1600-02JAN1700');
  setNotams(a, 'XXXX', [jan, jan2]);
  assert.equal(shows(a, 'XXXX', jan), true, 'NOTAM 01 JAN 1000–1100 in effect at 01 JAN 1030Z');
  assert.equal(shows(a, 'XXXX', jan2), false, 'NOTAM 02 JAN 1600–1700 not in effect');
  // Before this change the NOTAM module was given 31 DEC 2026 (DOF) and 0030Z: the ETA was
  // placed on 31 DEC and 01 JAN 2026 was read as the year's first day — 2026, not 2027.
  assert.equal(run(a, `_tlNotamDate(${t.etaDestMs}, ${hm('1030')})`).depMin, hm('0030'));
  // TAF issued on 31 DEC, valid into 01 JAN: FM groups on both days.
  setWx(a, 'XXXX', 'TAF XXXX 311700Z 3118/0124 27010KT P6SM SKC\nFM311800 27010KT P6SM SKC\nFM010900 27010KT 2SM BR OVC008\nFM011300 27010KT P6SM SKC\n');
  const c = card(a, 'XXXX');
  assert.match(c.wx, /800ft/, 'FM010900 (01 JAN) is in force at 01 JAN 1030Z');
  // ORIG at 01 JAN 0030Z: FM311800 (31 DEC 1800Z → 01 JAN 0900Z) is in force.
  setWx(a, 'XXXO', 'TAF XXXO 311700Z 3118/0124 27010KT P6SM SKC\nFM311800 27010KT 2SM BR OVC008\nFM010900 27010KT P6SM SKC\n');
  assert.match(card(a, 'XXXO').wx, /800ft/, 'ORIG: FM311800 in force across the year end');
});

// ══ TC-140-010 ════════════════════════════════════════════════════════════
test('TC-140-010 28 / 29 FEB: non-leap and leap years', () => {
  let a = flight({ dof: '2027-02-28', out: '2300', destOff: 600 });
  edit(a, 'outZ', '0100');
  assert.equal(at(tl(a).outMs), '2027-03-01 01:00Z', '2027: 28 FEB → 01 MAR');
  assert.equal(at(tl(a).etaDestMs), '2027-03-01 11:00Z');
  setWx(a, 'XXXX', 'TAF XXXX 282300Z 0100/0206 27010KT P6SM SKC\nTEMPO 2810/2812 1/2SM FG OVC002\nTEMPO 0110/0112 2SM BR OVC008\n');
  let c = card(a, 'XXXX');
  assert.match(c.wx, /800ft/, 'TEMPO 0110/0112 (01 MAR) applies');
  assert.doesNotMatch(c.wx, /200ft/, 'TEMPO 2810/2812 (28 FEB) does not');
  a = flight({ dof: '2028-02-28', out: '2300', destOff: 600 });
  edit(a, 'outZ', '0100');
  assert.equal(at(tl(a).outMs), '2028-02-29 01:00Z', '2028: 28 FEB → 29 FEB');
  a = flight({ dof: '2028-02-29', out: '2330', destOff: 600 });
  assert.equal(at(tl(a).etaDestMs), '2028-03-01 09:30Z', '29 FEB 2330Z + 10 h → 01 MAR');
  edit(a, 'outZ', '0030');
  assert.equal(at(tl(a).outMs), '2028-03-01 00:30Z', '2028: 29 FEB → 01 MAR');
  setWx(a, 'XXXX', 'TAF XXXX 292300Z 0100/0206 27010KT P6SM SKC\nTEMPO 2909/2911 1/2SM FG OVC002\nTEMPO 0109/0111 2SM BR OVC008\n');
  c = card(a, 'XXXX');
  assert.match(c.wx, /800ft/, 'TEMPO 0109/0111 (01 MAR) applies at 01 MAR 1030Z');
  assert.doesNotMatch(c.wx, /200ft/, 'TEMPO 2909/2911 (29 FEB) does not');
});

// ══ TC-140-011 / 012 ═══════════════════════════════════════════════════════
function reload(a) {
  const b = loadApp({ storageData: { rp_flights: a.getFlights() } });
  b.loadFlight(b.getFlights()[0]);
  return b;
}
test('TC-140-011 save → reload keeps the dates', () => {
  const a = flight({ dof: '2026-03-09', out: '2300', destOff: 820, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 850 }] });
  edit(a, 'outZ', '0100');          // confirmEdit() saves the flight
  edit(a, 'offZ', '0125');
  const before = tl(a);
  const b = reload(a);
  assert.deepEqual(tl(b), before, 'timeline restored');
  assert.equal(at(tl(b).outMs), '2026-03-10 01:00Z', 'OUT still on 10 MAR after reload');
  assert.equal(b.sandbox.window._flightDateISO, '2026-03-09', 'flight date (DOF) unchanged');
  assert.equal(run(b, `_tlNotamDate(${tl(b).etaDestMs}, ${hm(b.S.etaDest)})`).flightISO, '2026-03-10');
  const n = nt('XXXX', 'A1410/26', '10MAR1400-10MAR1500');
  setNotams(b, 'XXXX', [n]);
  // after the OFF edit DEST = 10 MAR 0125Z + trip 800 = 1445Z
  assert.equal(b.S.etaDest, '1445');
  assert.equal(shows(b, 'XXXX', n), true, 'NOTAM on 10 MAR in effect after reload');
});

test('TC-140-012 a flight saved by an older version (no timeline) reloads, rebuilt as at import', () => {
  const a = flight({ dof: '2026-03-09', out: '2300', destOff: 600, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 630 }] });
  a.saveFlight();
  const flights = a.getFlights();
  delete flights[0].timeline;      // as saved by 1.9.9-hf3
  const old = loadApp({ storageData: { rp_flights: flights } });
  old.loadFlight(old.getFlights()[0]);
  const t = tl(old);
  assert.equal(at(t.outMs), '2026-03-09 23:00Z', 'OUT on the saved flight date');
  assert.equal(at(t.etaDestMs), '2026-03-10 09:00Z', 'DEST downline, next day');
  assert.equal(at(t.alt.XXXA), '2026-03-10 09:30Z', 'ALT downline, next day');
  // A saved timeline that does not match the saved times is not used.
  const bad = a.getFlights();
  bad[0].timeline.outMs += DAY + 60000;
  const c = loadApp({ storageData: { rp_flights: bad } });
  c.loadFlight(c.getFlights()[0]);
  assert.equal(at(tl(c).outMs), '2026-03-09 23:00Z', 'mismatched timeline → rebuilt');
  // A saved OFF is placed nearest the planned OFF (OUT + taxi).
  const withOff = a.getFlights();
  delete withOff[0].timeline; withOff[0].state.offZ = '0010';
  const d = loadApp({ storageData: { rp_flights: withOff } });
  d.loadFlight(d.getFlights()[0]);
  assert.equal(at(tl(d).offMs), '2026-03-10 00:10Z');
});

// ══ TC-140-013 ════════════════════════════════════════════════════════════
// The v1.11.2 QA simulation (app PR #42 QA, finding F1): OUT edited past 0000Z on the
// packages with an evening departure. "In effect" = the module's verdict on the ACTUAL
// UTC date of each airport's ETA (flight date = the ETA's date, departure time = the ETA,
// so the ETA is on that date). Nothing in effect may be hidden by the airport cards.
const QA_EDITS = [
  ['NB_YSSY-RKSI_11MAR26_rda_rev6', '0030'],          // 2300 → 0030
  ['NB_PGUA-RKSO_05JUN26_dod_rev5', '0045'],          // 2330 → 0045
  ['NB_KCHS-LIBG_12MAR26_lcf_rev16', '0015'],         // 2230 → 0015
  ['NB_RJAA-PANC_11APR26_notamschedule_rev5', '0015'],// 2230 → 0015
  ['NB_KORD-EDDF_06MAY26_notam_rev10', '0030'],       // 2126 → 0030
];
test('TC-140-013 OUT delayed past 0000Z on real packages: no NOTAM in effect on the actual date is hidden', async () => {
  const dir = requireFixtures();
  const man = readManifest(dir);
  let inEffect = 0;
  for (const [id, newOut] of QA_EDITS) {
    const fx = man.fixtures.find(f => f.id === id);
    assert.ok(fx, `${id} in the fixtures`);
    const imp = await importFixture(fx, dir);
    const app = imp.app, dof = app.sandbox.window._flightDateISO;
    edit(app, 'outZ', newOut);
    const t = tl(app);
    assert.equal(iso(t.outMs), iso(Date.parse(dof + 'T00:00:00Z') + DAY), `${id}: OUT moved to D + 1`);
    for (const apt of app.getAllAirports()) {
      const data = imp.airportData[apt.icao] || {};
      if (!(data.notams && data.notams.trim()) || !apt.eta) continue;
      const e = run(app, `_tlEtaMs(${JSON.stringify(apt.icao)}, ${JSON.stringify(apt.role)}, ${JSON.stringify(apt.eta)})`);
      const role = apt.role === 'ORIG' ? 'ORIG' : 'DEST';
      const ref = app.evalNotams(app._splitNotams(data.notams), role, hm(apt.eta), imp.S.acftType, iso(e), hm(apt.eta));
      // Same projection as card(): the rows the airport card groups (runway / taxiway /
      // general groups, SIDs, STARs).
      const want = [];
      for (const [, g] of ref.rwyGroups) for (const it of g.items) want.push(it.notamRaw);
      (ref.sidIssues || []).concat(ref.starIssues || []).forEach(i => want.push(i.notamRaw));
      const shown = new Set(card(app, apt.icao).notams);
      const hidden = want.filter(n => !shown.has(n));
      inEffect += want.length;
      assert.deepEqual(hidden.map(n => n.split('\n')[0].slice(0, 22)), [], `${id} ${apt.icao} ${apt.role}: NOTAMs in effect at ${at(e)} hidden`);
    }
  }
  assert.ok(inEffect > 100, `${inEffect} NOTAMs in effect checked`);
});

// ══ TC-140-014 ════════════════════════════════════════════════════════════
test('TC-140-014 TAF month end without an edit: a TAF issued the previous month', () => {
  // Departure 01 MAY 0135Z; TAF issued 30 APR, valid 3018/0124. FM302000 is in force at
  // 01 MAY 0035–0235Z; FM010300 starts after the window.
  const taf = 'TAF XXXO 301700Z 3018/0124 27010KT P6SM SKC\nFM302000 27010KT 2SM BR OVC008\nFM010300 27010KT P6SM SKC\n';
  const a = flight({ dof: '2026-05-01', out: '0135', destOff: 600 });
  setWx(a, 'XXXO', taf);
  assert.match(card(a, 'XXXO').wx, /800ft/, 'FM302000 in force at the 01 MAY departure');
  const sel = a.extractEtaWindow(taf, hm('0135'), null, '2026-05-01');
  assert.match(sel, /FM302000/); assert.doesNotMatch(sel, /FM010300/);
  // Negative: the same TAF read at 01 MAY 0500Z selects FM010300, not FM302000.
  const late = a.extractEtaWindow(taf, hm('0500'), null, '2026-05-01');
  assert.match(late, /FM010300/); assert.doesNotMatch(late, /FM302000/);
});
