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
const fs     = require('fs');
const { loadApp, INDEX_HTML } = require('../harness');
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
function flight({ dof, out, destOff, trip = null, taxi = 20, alts = [], html }) {
  const app = loadApp({ html });
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
  // Cleared → the dated IN is kept (F1, TC-141: an entry that is not a valid time never
  // clears the timeline; before TC-141 this cleared it).
  edit(a, 'etaDest', '');
  assert.equal(at(tl(a).etaDestMs), '2026-03-10 22:00Z');
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
      const ref = app.evalNotamsAs(app._splitNotams(data.notams), role, hm(apt.eta), imp.S.acftType, iso(e), hm(apt.eta));
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

// ══════════════════════════════════════════════════════════════════════════
// TC-141 — QA findings on the D51 timeline (app PR #43).
//   F1  an entry that is not a valid time ("003", empty, "2400", letters, minutes > 59)
//       never clears, resets or re-dates the dated OUT, OFF or IN; the next valid entry
//       is placed nearest the last good dated value. The field shows the entry as before.
//   F2  a flight saved by an older version (no timeline) is reopened with each saved time
//       nearest its OFP planned time from the save; no OFP times → as at import.
//   D53 (Exec, 8 Nov) an IN edit does not move the alternate ETAs (as on main).
//
//   TC-141-001  OUT: invalid entries keep the dated OUT; the next valid one is dated from it
//   TC-141-002  OFF: the same for OFF (and the IN computed from it)
//   TC-141-003  IN: the same for IN
//   TC-141-004  the QA sequence on the real package: OUT 2300 → "003" → 0030 = next day
//   TC-141-005  OUT delayed past 0000Z after an invalid entry, real packages: no NOTAM in
//               effect on the actual date is hidden
//   TC-141-006  save → reload with an invalid entry standing keeps the last good dates
//   TC-141-007  older save: recovery from the OFP times, with and without OFP times
//   TC-141-008  D53: an IN edit leaves the alternate ETAs unchanged
// ══════════════════════════════════════════════════════════════════════════
// Entries that are not a valid time, as typed. confirmEdit() keeps the digits only (first 4).
const INVALID = ['003', '', '2400', 'ABCD', '2360', '23'];
const typed = v => v.replace(/\D/g, '').slice(0, 4);
// The HHMM the screens read (S), to show the display is what it was before TC-141.
const shown = a => ({ outZ: a.S.outZ, offZ: a.S.offZ, etaDest: a.S.etaDest, alts: a.S.altData.map(x => x.currentEta) });

test('TC-141-001 OUT: an invalid entry keeps the dated OUT; the next valid entry is placed nearest it', () => {
  for (const bad of INVALID) {
    // OUT 09 MAR 2300 → 0030 (10 MAR) → invalid → 0045: 10 MAR, not 09 MAR.
    const a = flight({ dof: '2026-03-09', out: '2300', destOff: 600, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 630 }] });
    edit(a, 'outZ', '0030');
    const good = tl(a);
    assert.equal(at(good.outMs), '2026-03-10 00:30Z');
    edit(a, 'outZ', bad);
    // negative: nothing on the timeline changes
    assert.deepEqual(tl(a), good, `"${bad}": timeline unchanged`);
    // the field shows the entry, as before TC-141
    assert.equal(a.S.outZ, typed(bad), `"${bad}": OUT field shows the entry`);
    // positive: the next valid entry is placed nearest the last good OUT (10 MAR 0030)
    edit(a, 'outZ', '0045');
    const t = tl(a);
    assert.equal(at(t.outMs), '2026-03-10 00:45Z', `"${bad}" then 0045: next day`);
    assert.equal(at(t.etaDestMs), '2026-03-10 10:45Z', `"${bad}" then 0045: IN follows`);
    assert.equal(at(t.alt.XXXA), '2026-03-10 11:15Z', `"${bad}" then 0045: ALT follows`);
  }
  // The other way (QA): 0100 → "23" → 2300 is the previous day.
  const b = flight({ dof: '2026-03-10', out: '0100', destOff: 600 });
  edit(b, 'outZ', '23');
  assert.equal(at(tl(b).outMs), '2026-03-10 01:00Z', '"23": OUT unchanged');
  edit(b, 'outZ', '2300');
  assert.equal(at(tl(b).outMs), '2026-03-09 23:00Z', '0100 → "23" → 2300: previous day');
  assert.equal(at(tl(b).etaDestMs), '2026-03-10 09:00Z');
  // "2400" runs the HHMM recalc as before (display); the timeline downline is not reset.
  const c = flight({ dof: '2026-03-09', out: '2300', destOff: 600 });
  edit(c, 'etaDest', '1000');                       // IN 10 MAR 1000
  edit(c, 'outZ', '2400');
  assert.equal(c.S.etaDest, '1000', '"2400": IN shown as the recalc gives it (0000 + 600), as before');
  assert.equal(at(tl(c).etaDestMs), '2026-03-10 10:00Z', '"2400": dated IN not reset');
  assert.equal(at(tl(c).outMs), '2026-03-09 23:00Z', '"2400": dated OUT not reset');
});

test('TC-141-002 OFF: an invalid entry keeps the dated OFF; the next valid entry is placed nearest it', () => {
  for (const bad of INVALID) {
    // OUT 09 MAR 2300, OFF delayed to 10 MAR 0600 (7 h after OUT), invalid, then 1200.
    // Nearest the last good OFF (0600) → 10 MAR 1200. Nearest the planned OFF (2320) would
    // be 09 MAR 1200, before OUT.
    const a = flight({ dof: '2026-03-09', out: '2300', destOff: 600, taxi: 20, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 630 }] });
    edit(a, 'offZ', '0600');
    const good = tl(a);
    assert.equal(at(good.offMs), '2026-03-10 06:00Z');
    assert.equal(at(good.etaDestMs), '2026-03-10 15:40Z', 'IN = OFF + trip 580');
    const before = shown(a);
    edit(a, 'offZ', bad);
    assert.deepEqual(tl(a), good, `"${bad}": timeline unchanged (OFF and IN)`);
    assert.equal(a.S.offZ, typed(bad), `"${bad}": OFF field shows the entry`);
    if (typed(bad).length !== 4) assert.deepEqual({ ...shown(a), offZ: before.offZ }, before, `"${bad}": other times shown as before`);
    edit(a, 'offZ', '1200');
    const t = tl(a);
    assert.equal(at(t.offMs), '2026-03-10 12:00Z', `"${bad}" then 1200: on 10 MAR`);
    assert.equal(at(t.etaDestMs), '2026-03-10 21:40Z', `"${bad}" then 1200: IN follows`);
    assert.equal(at(t.alt.XXXA), '2026-03-10 22:10Z', `"${bad}" then 1200: ALT follows`);
    assert.equal(at(t.outMs), '2026-03-09 23:00Z', 'OUT unchanged');
  }
});

test('TC-141-003 IN: an invalid entry keeps the dated IN; the next valid entry is placed nearest it', () => {
  for (const bad of INVALID) {
    // OUT 09 MAR 0100, IN 1100 → 2000 → 0400 (10 MAR), invalid, then 0500 → 10 MAR.
    const a = flight({ dof: '2026-03-09', out: '0100', destOff: 600, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 630 }] });
    edit(a, 'etaDest', '2000');
    edit(a, 'etaDest', '0400');
    const good = tl(a);
    assert.equal(at(good.etaDestMs), '2026-03-10 04:00Z');
    edit(a, 'etaDest', bad);
    assert.deepEqual(tl(a), good, `"${bad}": timeline unchanged`);
    assert.equal(a.S.etaDest, typed(bad), `"${bad}": IN field shows the entry`);
    edit(a, 'etaDest', '0500');
    assert.equal(at(tl(a).etaDestMs), '2026-03-10 05:00Z', `"${bad}" then 0500: on 10 MAR`);
    assert.equal(at(tl(a).outMs), '2026-03-09 01:00Z', 'OUT unchanged');
  }
});

test('TC-141-004 the QA sequence on the real package: OUT 2300 → "003" → 0030 is on the next day', async () => {
  const dir = requireFixtures();
  const fx = readManifest(dir).fixtures.find(f => f.id === 'NB_YSSY-RKSI_11MAR26_rda_rev6');
  assert.ok(fx, 'package in the fixtures');
  const { app } = await importFixture(fx, dir);
  assert.equal(app.S.outZ, '2300');
  const before = shown(app), good = tl(app);
  edit(app, 'outZ', '003');
  assert.deepEqual(tl(app), good, '"003": timeline unchanged');
  assert.deepEqual({ ...shown(app), outZ: before.outZ }, before, '"003": the other times are shown as before');
  assert.equal(app.S.outZ, '003', '"003": OUT shows the entry, as before');
  edit(app, 'outZ', '0030');
  const t = tl(app);
  assert.equal(at(t.outMs), '2026-03-12 00:30Z', 'OUT 12 MAR 0030 (QA expected)');
  assert.equal(at(t.etaDestMs), '2026-03-12 10:48Z', 'IN 12 MAR 1048 (QA expected)');
  for (const a of app.S.altData) {
    if (typeof a.ofpOffsetMins === 'number') assert.equal(iso(t.alt[a.icao]), '2026-03-12', `${a.icao} on 12 MAR`);
  }
  // The departure NOTAM date is the date of the current OUT.
  assert.equal(run(app, `_tlNotamDate(${t.outMs}, ${hm('0030')})`).flightISO, '2026-03-12');
});

test('TC-141-005 OUT delayed past 0000Z after an invalid entry, real packages: no NOTAM in effect on the actual date is hidden', async () => {
  const dir = requireFixtures();
  const man = readManifest(dir);
  let inEffect = 0;
  for (const [id, newOut] of QA_EDITS) {
    const fx = man.fixtures.find(f => f.id === id);
    assert.ok(fx, `${id} in the fixtures`);
    const imp = await importFixture(fx, dir);
    const app = imp.app, dof = app.sandbox.window._flightDateISO;
    edit(app, 'outZ', newOut.slice(0, 3));            // the incomplete entry first ("003")
    edit(app, 'outZ', newOut);
    assert.equal(iso(tl(app).outMs), iso(Date.parse(dof + 'T00:00:00Z') + DAY), `${id}: OUT moved to D + 1`);
    for (const apt of app.getAllAirports()) {
      const data = imp.airportData[apt.icao] || {};
      if (!(data.notams && data.notams.trim()) || !apt.eta) continue;
      const e = run(app, `_tlEtaMs(${JSON.stringify(apt.icao)}, ${JSON.stringify(apt.role)}, ${JSON.stringify(apt.eta)})`);
      const role = apt.role === 'ORIG' ? 'ORIG' : 'DEST';
      const ref = app.evalNotamsAs(app._splitNotams(data.notams), role, hm(apt.eta), imp.S.acftType, iso(e), hm(apt.eta));
      const want = [];
      for (const [, g] of ref.rwyGroups) for (const it of g.items) want.push(it.notamRaw);
      (ref.sidIssues || []).concat(ref.starIssues || []).forEach(i => want.push(i.notamRaw));
      const shownN = new Set(card(app, apt.icao).notams);
      inEffect += want.length;
      assert.deepEqual(want.filter(n => !shownN.has(n)).map(n => n.split('\n')[0].slice(0, 22)), [], `${id} ${apt.icao} ${apt.role}: NOTAMs in effect at ${at(e)} hidden`);
    }
  }
  assert.ok(inEffect > 100, `${inEffect} NOTAMs in effect checked`);
});

test('TC-141-006 save → reload with an invalid entry standing keeps the last good dates', () => {
  for (const bad of ['003', '', '2400']) {
    const a = flight({ dof: '2026-03-09', out: '2300', destOff: 600, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 630 }] });
    edit(a, 'outZ', '0030');                          // 10 MAR 0030
    const good = tl(a);
    edit(a, 'outZ', bad);                             // saved with the invalid entry
    const b = reload(a);
    assert.deepEqual(tl(b), good, `"${bad}": reloaded timeline = the last good one`);
    assert.equal(b.S.outZ, typed(bad), `"${bad}": OUT field shows the entry after reload`);
    edit(b, 'outZ', '0045');
    assert.equal(at(tl(b).outMs), '2026-03-10 00:45Z', `"${bad}", reload, 0045: next day`);
  }
  // Empty OFF after a dated OFF: kept across reload.
  const c = flight({ dof: '2026-03-09', out: '2300', destOff: 600 });
  edit(c, 'offZ', '0600');
  edit(c, 'offZ', '');
  assert.equal(at(tl(reload(c)).offMs), '2026-03-10 06:00Z', 'empty OFF: dated OFF kept after reload');
  // negative: a saved timeline that does not match a valid saved time is still not used
  const d = flight({ dof: '2026-03-09', out: '2300', destOff: 600 });
  edit(d, 'outZ', '0030');
  const fl = d.getFlights(); fl[0].timeline.outMs -= 3600000;   // 2330 ≠ saved 0030
  const e = loadApp({ storageData: { rp_flights: fl } });
  e.loadFlight(e.getFlights()[0]);
  assert.notEqual(tl(e).outMs, fl[0].timeline.outMs, 'mismatched timeline not restored');
});

test('TC-141-007 older save: each saved time nearest its OFP planned time; no OFP times → as at import', async () => {
  const oldSave = a => { a.saveFlight(); const f = a.getFlights(); delete f[0].timeline; return f; };
  const open = f => { const b = loadApp({ storageData: { rp_flights: f } }); b.loadFlight(b.getFlights()[0]); return b; };
  // OUT 09 MAR 2300 edited to 0030 by an older version (no timeline in the save).
  const mk = () => flight({ dof: '2026-03-09', out: '2300', destOff: 600, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 630 }] });
  let a = mk();
  edit(a, 'outZ', '0030');
  let t = tl(open(oldSave(a)));
  assert.equal(at(t.outMs), '2026-03-10 00:30Z', 'OUT nearest the OFP OUT (09 MAR 2300) → 10 MAR');
  assert.equal(at(t.etaDestMs), '2026-03-10 10:30Z', 'IN follows');
  assert.equal(at(t.alt.XXXA), '2026-03-10 11:00Z', 'ALT follows');
  // An earlier OUT (2230) stays on 09 MAR; no edit is as at import.
  a = mk(); edit(a, 'outZ', '2230');
  assert.equal(at(tl(open(oldSave(a))).outMs), '2026-03-09 22:30Z', 'OUT 2230 → 09 MAR');
  a = mk();
  const imp = tl(a);
  assert.deepEqual(tl(open(oldSave(a))), imp, 'no edit → the same timeline as at import');
  // OFF and IN entered: OFF nearest OUT + taxi, IN nearest OFF + trip.
  a = mk(); edit(a, 'outZ', '0030'); edit(a, 'offZ', '0100'); edit(a, 'etaDest', '1030');
  t = tl(open(oldSave(a)));
  assert.equal(at(t.offMs), '2026-03-10 01:00Z');
  assert.equal(at(t.etaDestMs), '2026-03-10 10:30Z');
  assert.equal(at(t.alt.XXXA), '2026-03-10 11:10Z', 'ALT = OFF + (630 - taxi 20)');
  // A saved OUT that is not a valid time: the OFP OUT is kept; the next entry is nearest it.
  a = mk(); edit(a, 'outZ', '003');
  const b = open(oldSave(a));
  assert.equal(at(tl(b).outMs), '2026-03-09 23:00Z');
  edit(b, 'outZ', '0030');
  assert.equal(at(tl(b).outMs), '2026-03-10 00:30Z');
  // negative: no OFP times in the save → as at import (OUT on the DOF date).
  a = flight({ dof: '2026-03-09', out: '2300', destOff: 600 });   // no alternates
  edit(a, 'outZ', '0030');
  assert.equal(at(tl(open(oldSave(a))).outMs), '2026-03-09 00:30Z', 'no alternates → as at import');
  a = mk(); edit(a, 'outZ', '0030');
  let f = oldSave(a); f[0].state.destEtaOffsetMins = null;         // offsets not from the OFP OUT
  assert.equal(at(tl(open(f)).outMs), '2026-03-09 00:30Z', 'no OFP DEST offset → as at import');
  a = flight({ dof: '2026-03-09', out: '2300', destOff: 600, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 630 }, { icao: 'XXXB', role: 'DEST ALT', off: 640 }] });
  edit(a, 'outZ', '0030');
  f = oldSave(a); f[0].state.altData[1].ofpOffsetMins = 700;       // the OFP times disagree
  assert.equal(at(tl(open(f)).outMs), '2026-03-09 00:30Z', 'OFP times disagree → as at import');
  // QA Q14 on the real package: saved by an older version after OUT 2300 → 0030.
  const dir = requireFixtures();
  const fx = readManifest(dir).fixtures.find(x => x.id === 'NB_YSSY-RKSI_11MAR26_rda_rev6');
  const { app } = await importFixture(fx, dir);
  edit(app, 'outZ', '0030');
  const want = tl(app);
  const r = tl(open(oldSave(app)));
  assert.equal(at(r.outMs), '2026-03-12 00:30Z', 'Q14: OUT 12 MAR 0030');
  assert.deepEqual(r, want, 'Q14: the same timeline as before the save');
});

test('TC-141-008 D53: an IN edit leaves the alternate ETAs unchanged', () => {
  const a = flight({ dof: '2026-03-13', out: '1200', destOff: 560, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 576 }] });
  const alt0 = a.S.altData[0].currentEta, altMs = tl(a).alt.XXXA;
  edit(a, 'etaDest', '0045');                        // IN 2120 → 0045 (14 MAR)
  assert.equal(at(tl(a).etaDestMs), '2026-03-14 00:45Z', 'IN moved to 14 MAR');
  assert.equal(a.S.altData[0].currentEta, alt0, 'ALT shown unchanged');
  assert.equal(tl(a).alt.XXXA, altMs, 'dated ALT unchanged');
  // negative: an OUT edit does move the alternates
  edit(a, 'outZ', '1300');
  assert.notEqual(a.S.altData[0].currentEta, alt0, 'OUT edit moves the ALT');
  assert.equal(tl(a).alt.XXXA, altMs + 3600000, 'OUT +1 h → dated ALT +1 h');
});

// ══════════════════════════════════════════════════════════════════════════
// TC-142 — QA finding F5 on the D51 timeline (app PR #43).
//   Principle (Exec): a time and its date always come from the SAME valid entry. Every
//   evaluation (NOTAMs, weather, curfew) reads one dated value — UTC date + time — from the
//   timeline, never the raw field text. While an entry that is not a valid time ("2400",
//   "2360", "2575", letters, incomplete, empty) stands in OUT, OFF or IN, every evaluation
//   uses the last valid dated value, its date AND its time. The fields show what they did.
//
//   TC-142-001  OUT moved past 0000Z, then "2400" / "2360" (and the other invalid entries)
//               left standing: every evaluation = the last valid value; the next valid entry
//               is placed nearest it; the raw text never reaches an evaluation
//   TC-142-002  the same for OFF
//   TC-142-003  the same for IN
//   TC-142-004  the departure card with OUT "2400" standing: the NOTAM at the last valid
//               OUT is shown, the one at the raw "2400" (24 h later) is hidden
//   TC-142-005  curfew with an invalid entry standing: checked at the last valid ETA
//   TC-142-006  QA YSSY-RKSI 2300 → 0030 → "2400" on the real package
//   TC-142-007  QA KORD-EDDF 2126 → 0030 → "2400" and the delay packages: no NOTAM in effect
//               on the actual date is hidden; every card is the card before the invalid entry
//   TC-142-008  save → reload, and an older save, with an invalid entry standing
// ══════════════════════════════════════════════════════════════════════════
// A copy of index.html, in memory only, whose evalNotams() records what it is given (the
// app binds the module's evalNotams as a const, so it cannot be wrapped from outside).
// The file is not changed; the module and every other line run as built.
const NOTAM_BIND = 'const { evalNotams, _splitNotams } = NotamRules;';
const REC_HTML = (() => {
  const src = fs.readFileSync(INDEX_HTML, 'utf8');
  assert.equal(src.split(NOTAM_BIND).length, 2, 'index.html binds evalNotams once');
  return src.replace(NOTAM_BIND, 'const { _splitNotams } = NotamRules;\n' +
    'const evalNotams = function (notams, role, etaMin, acft, flightISO, depMin) {\n' +
    '  (globalThis.__rec = globalThis.__rec || { notam: [], wx: [], curfew: [] }).notam.push({ role, etaMin, flightISO, depMin });\n' +
    '  return NotamRules.evalNotams.apply(this, arguments); };');
})();
// Records the weather and curfew inputs too (both are global functions the app calls).
function record(app) {
  run(app, `globalThis.__rec = { notam: [], wx: [], curfew: [] };
    (function () {
      const x = extractEtaWindow, c = curfewDeltaMins;
      extractEtaWindow = function (t, etaMin, w, etaISO) { __rec.wx.push({ etaMin, etaISO }); return x.apply(this, arguments); };
      curfewDeltaMins = function (ws, etaMin) { __rec.curfew.push({ etaMin }); return c.apply(this, arguments); };
    })();`);
  return app;
}
const recFlight = o => record(flight({ ...o, html: REC_HTML }));
// Evaluates one airport card (NOTAMs, weather, curfew) and returns the dated value each
// evaluation was given, as UTC ms. NOTAMs: the module places the ETA on flightISO, or on
// the next day when the ETA time is earlier than the departure time.
function evaluated(app, icao) {
  run(app, '__rec.notam = []; __rec.wx = []; __rec.curfew = [];');
  const c = card(app, icao);
  run(app, `evalCurfew(${JSON.stringify(icao)}, ${JSON.stringify(c.apt.eta)}, ${JSON.stringify(c.apt.role)})`);
  const r = JSON.parse(JSON.stringify(run(app, '__rec')));
  assert.equal(r.notam.length, 1, `${icao}: one NOTAM evaluation`);
  assert.equal(r.wx.length, 1, `${icao}: one weather evaluation`);
  assert.equal(r.curfew.length, 1, `${icao}: one curfew evaluation`);
  const n = r.notam[0], w = r.wx[0];
  return {
    notam: Date.parse(n.flightISO + 'T00:00:00Z') + n.etaMin * 60000 + (n.depMin !== null && n.etaMin < n.depMin ? DAY : 0),
    depMin: n.depMin, wx: Date.parse(w.etaISO + 'T00:00:00Z') + w.etaMin * 60000,
    mins: [n.etaMin, w.etaMin, r.curfew[0].etaMin], card: c,
  };
}
// Gives an airport something to evaluate: a NOTAM, a TAF and a curfew.
function feed(app, icao, notams = [nt(icao, 'A0001/26', '01JAN0000-31DEC2359')]) {
  setNotams(app, icao, notams);
  setWx(app, icao, `TAF ${icao} 081700Z 0818/1124 27010KT P6SM SKC\n`);
  aptData(app)[icao].curfew = '0300-0400Z';
}
// The entries that are not a valid time, left standing. "2400" and "2360" are 4 digits:
// they run the HHMM recalc the screens show (as before), which moves the downline HHMM.
const STANDING = ['2400', '2360', '2575', 'AB12', '003', ''];
// Checks every airport of a synthetic flight: each evaluation (NOTAM, weather, curfew)
// uses the expected dated value; the raw text of the fields is not used (negative).
function assertEvaluated(a, want, label) {
  const raw = { XXXO: a.S.outZ, XXXX: a.S.etaDest, XXXA: a.S.altData[0].currentEta };
  for (const icao of Object.keys(want)) {
    const e = evaluated(a, icao);
    assert.equal(at(e.notam), at(want[icao]), `${label}: ${icao} NOTAMs at the last valid date and time`);
    assert.equal(at(e.wx), at(want[icao]), `${label}: ${icao} weather at the last valid date and time`);
    const m = hm(at(want[icao]).slice(11, 16).replace(':', ''));
    assert.deepEqual(e.mins, [m, m, m], `${label}: ${icao} NOTAM, weather and curfew times = the last valid time`);
    assert.equal(e.depMin, hm(at(want.XXXO).slice(11, 16).replace(':', '')), `${label}: ${icao} departure time = the last valid OUT`);
    // negative: the field's raw text, when it differs from the last valid time, is used nowhere
    const r = a.pZM(raw[icao]);
    if (r !== m) assert.ok(!e.mins.includes(r), `${label}: ${icao} raw "${raw[icao]}" (${r} min) not used`);
    if (icao === 'XXXO' && r !== m) assert.notEqual(e.depMin, r, `${label}: raw OUT not the departure time`);
  }
}
const mk142 = o => {
  const a = recFlight({ dof: '2026-03-09', out: '2300', destOff: 600, taxi: 20, alts: [{ icao: 'XXXA', role: 'DEST ALT', off: 630 }], ...o });
  ['XXXO', 'XXXX', 'XXXA'].forEach(i => feed(a, i));
  return a;
};

test('TC-142-001 OUT moved past 0000Z, invalid entry standing: every evaluation uses the last valid OUT, date and time', () => {
  for (const bad of STANDING) {
    const a = mk142();
    edit(a, 'outZ', '0030');                           // 09 MAR 2300 → 10 MAR 0030
    const want = { XXXO: ms('2026-03-10', '0030'), XXXX: ms('2026-03-10', '1030'), XXXA: ms('2026-03-10', '1100') };
    assertEvaluated(a, want, 'after 0030');
    const cards = Object.keys(want).map(i => card(a, i).st);
    edit(a, 'outZ', bad);
    assert.equal(a.S.outZ, typed(bad), `"${bad}": OUT shows the entry, as before`);
    if (bad === '2400' || bad === '2360') {
      // display as before: the HHMM recalc from "2400" (0000 + 600 / + 630)
      assert.equal(a.S.etaDest, '1000', `"${bad}": IN shown as the recalc gives it`);
      assert.equal(a.S.altData[0].currentEta, '1030', `"${bad}": ALT shown as the recalc gives it`);
    }
    // positive: the last valid dated values, date AND time; negative: no raw text
    assertEvaluated(a, want, `"${bad}" standing`);
    assert.deepEqual(Object.keys(want).map(i => card(a, i).st), cards, `"${bad}": every card as before the entry`);
    // positive: the next valid entry is placed nearest the last valid OUT (10 MAR 0030)
    edit(a, 'outZ', '0045');
    assertEvaluated(a, { XXXO: ms('2026-03-10', '0045'), XXXX: ms('2026-03-10', '1045'), XXXA: ms('2026-03-10', '1115') }, `"${bad}" then 0045`);
  }
});

test('TC-142-002 OFF moved past 0000Z, invalid entry standing: every evaluation uses the last valid OFF, date and time', () => {
  for (const bad of STANDING) {
    const a = mk142();
    edit(a, 'offZ', '0030');                           // planned 09 MAR 2320 → 10 MAR 0030
    // IN = OFF + trip 580; ALT = OFF + (630 − taxi 20); OUT unchanged
    const want = { XXXO: ms('2026-03-09', '2300'), XXXX: ms('2026-03-10', '1010'), XXXA: ms('2026-03-10', '1040') };
    assertEvaluated(a, want, 'after OFF 0030');
    const cards = Object.keys(want).map(i => card(a, i).st);
    edit(a, 'offZ', bad);
    assert.equal(a.S.offZ, typed(bad), `"${bad}": OFF shows the entry, as before`);
    if (bad === '2400' || bad === '2360') assert.equal(a.S.etaDest, '0940', `"${bad}": IN shown as the recalc from "${typed(bad)}" gives it`);
    assertEvaluated(a, want, `OFF "${bad}" standing`);
    assert.deepEqual(Object.keys(want).map(i => card(a, i).st), cards, `OFF "${bad}": every card as before the entry`);
    edit(a, 'offZ', '0100');                           // nearest 10 MAR 0030
    assertEvaluated(a, { XXXO: want.XXXO, XXXX: ms('2026-03-10', '1040'), XXXA: ms('2026-03-10', '1110') }, `OFF "${bad}" then 0100`);
  }
});

test('TC-142-003 IN moved past 0000Z, invalid entry standing: the destination uses the last valid IN, date and time', () => {
  for (const bad of STANDING) {
    const a = mk142({ out: '1200' });                  // IN 09 MAR 2200, ALT 2230
    edit(a, 'etaDest', '0045');                        // → 10 MAR 0045
    const want = { XXXO: ms('2026-03-09', '1200'), XXXX: ms('2026-03-10', '0045'), XXXA: ms('2026-03-09', '2230') };
    assertEvaluated(a, want, 'after IN 0045');
    const cards = Object.keys(want).map(i => card(a, i).st);
    edit(a, 'etaDest', bad);
    assert.equal(a.S.etaDest, typed(bad), `"${bad}": IN shows the entry, as before`);
    assertEvaluated(a, want, `IN "${bad}" standing`);
    assert.deepEqual(Object.keys(want).map(i => card(a, i).st), cards, `IN "${bad}": every card as before the entry`);
    edit(a, 'etaDest', '0100');                        // nearest 10 MAR 0045
    assertEvaluated(a, { ...want, XXXX: ms('2026-03-10', '0100') }, `IN "${bad}" then 0100`);
  }
});

// The raw "2400" on the dated OUT's date would be checked at 10 MAR 2400 ± 60 (10 MAR 2300 –
// 11 MAR 0100). Module v1.11.1 also checks an ETA before 1200Z on the next day (fail-safe;
// v1.11.2 removes it), so 11 MAR 0030 ± 60 is shown on every build; the probe that only the
// raw text reaches is 10 MAR 2300–2320. The module inputs are the last valid OUT's date and
// time, so a module that checks that day only (v1.11.2) checks 10 MAR 0030 ± 60.
test('TC-142-004 departure card, OUT "2400" standing: the NOTAM at the last valid OUT is shown, the raw "2400" is not checked', () => {
  for (const bad of ['2400', '2360']) {
    const a = record(flight({ dof: '2026-03-09', out: '2300', destOff: 600, html: REC_HTML }));
    const now = nt('XXXO', 'A0010/26', '10MAR0000-10MAR0100');   // at 10 MAR 0030 ± 60
    const raw = nt('XXXO', 'A0011/26', '10MAR2300-10MAR2320');   // only at the raw "2400"
    setNotams(a, 'XXXO', [now, raw]);
    edit(a, 'outZ', '0030');
    assert.equal(shows(a, 'XXXO', now), true, 'after 0030: in effect, shown');
    assert.equal(shows(a, 'XXXO', raw), false, 'after 0030: 10 MAR 2300–2320 not in effect, hidden');
    edit(a, 'outZ', bad);
    assert.equal(shows(a, 'XXXO', now), true, `"${bad}" standing: the NOTAM at the last valid OUT is shown`);
    assert.equal(shows(a, 'XXXO', raw), false, `"${bad}" standing: the NOTAM only the raw "${bad}" reaches is hidden`);
    run(a, '__rec.notam = []');
    card(a, 'XXXO');
    const n = JSON.parse(JSON.stringify(run(a, '__rec.notam[0]')));
    assert.deepEqual(n, { role: 'ORIG', etaMin: 30, flightISO: '2026-03-10', depMin: 30 }, `"${bad}": module given 10 MAR 0030 (not ${a.pZM(a.S.outZ)} min)`);
  }
});

test('TC-142-005 curfew with an invalid entry standing: checked at the last valid ETA', () => {
  const cf = (a, icao, role) => { const r = run(a, `evalCurfew('${icao}', ${JSON.stringify(card(a, icao).apt.eta)}, '${role}')`); return { color: r.color, delta: r.delta }; };
  for (const bad of ['2400', '2360']) {
    // OUT 2300 → 0030: IN 10 MAR 1030. "2400" moves the IN shown to 1000.
    const a = flight({ dof: '2026-03-09', out: '2300', destOff: 600 });
    aptData(a).XXXX = { notams: '', weather: '', curfew: '1200-1300Z' };
    aptData(a).XXXO = { notams: '', weather: '', curfew: '2230-2300Z' };
    edit(a, 'outZ', '0030');
    assert.deepEqual(cf(a, 'XXXX', 'DEST'), { color: 'red', delta: 90 }, 'after 0030: IN 1030, 90 min to 1200');
    assert.deepEqual(cf(a, 'XXXO', 'ORIG'), { color: 'red', delta: 90 }, 'after 0030: OUT 0030, 90 min after 2300');
    edit(a, 'outZ', bad);
    assert.equal(a.S.etaDest, '1000', `"${bad}": IN shown as before`);
    // positive: the last valid ETA; negative: not the raw / recalculated HHMM (1000 → 120 min, yellow; 2400 → 60 min)
    assert.deepEqual(cf(a, 'XXXX', 'DEST'), { color: 'red', delta: 90 }, `"${bad}": destination curfew at the last valid IN 1030`);
    assert.deepEqual(cf(a, 'XXXO', 'ORIG'), { color: 'red', delta: 90 }, `"${bad}": departure curfew at the last valid OUT 0030`);
    // without a role (curfew detail): the airport's first role on getAllAirports()
    assert.equal(run(a, `evalCurfew('XXXX', '1000').delta`), 90, `"${bad}": no role → destination, last valid IN`);
  }
  // IN "2400" standing: the destination curfew stays at the last valid IN.
  const b = flight({ dof: '2026-03-09', out: '2300', destOff: 600 });
  aptData(b).XXXX = { notams: '', weather: '', curfew: '1200-1300Z' };
  edit(b, 'etaDest', '1030');
  edit(b, 'etaDest', '2400');
  assert.deepEqual(cf(b, 'XXXX', 'DEST'), { color: 'red', delta: 90 }, 'IN "2400": curfew at the last valid IN 1030');
  // negative: with no dated value (no flight date) the HHMM is read, as before
  const c = flight({ dof: '', out: '2300', destOff: 600 });
  aptData(c).XXXX = { notams: '', weather: '', curfew: '1200-1300Z' };
  assert.equal(run(c, `evalCurfew('XXXX', '1000', 'DEST').delta`), 120, 'no timeline → the HHMM as before');
});

test('TC-142-006 QA YSSY-RKSI: OUT 2300 → 0030 → "2400" on the real package', async () => {
  const dir = requireFixtures();
  const fx = readManifest(dir).fixtures.find(f => f.id === 'NB_YSSY-RKSI_11MAR26_rda_rev6');
  assert.ok(fx, 'package in the fixtures');
  for (const bad of ['2400', '2360']) {
    const { app } = await importFixture(fx, dir, { html: REC_HTML });
    record(app);
    const now  = nt('YSSY', 'A9990/26', '12MAR0000-12MAR0100');   // around 12 MAR 0030
    const late = nt('YSSY', 'A9991/26', '12MAR2300-12MAR2320');   // only at the raw "2400" (12 MAR 2400 ± 60)
    const d = aptData(app);
    d.YSSY.notams = now + late + d.YSSY.notams;
    edit(app, 'outZ', '0030');
    const good = tl(app);
    const before = {};
    for (const apt of app.getAllAirports()) before[apt.icao + apt.role] = card(app, apt.icao).st;
    edit(app, 'outZ', bad);
    assert.deepEqual(tl(app), good, `"${bad}": timeline = the last valid one`);
    assert.equal(shows(app, 'YSSY', now), true, `"${bad}": departure NOTAM around 12 MAR 0030 shown`);
    assert.equal(shows(app, 'YSSY', late), false, `"${bad}": departure NOTAM only the raw "${bad}" reaches hidden`);
    for (const apt of app.getAllAirports()) {
      const data = d[apt.icao] || {};
      if (!(data.notams && data.notams.trim())) continue;
      run(app, '__rec.notam = []; __rec.wx = [];');
      const st = card(app, apt.icao).st;
      const r = JSON.parse(JSON.stringify(run(app, '__rec')));
      const n = r.notam[0];
      const e = Date.parse(n.flightISO + 'T00:00:00Z') + n.etaMin * 60000 + (n.etaMin < n.depMin ? DAY : 0);
      const want = apt.role === 'ORIG' ? good.outMs : apt.role === 'DEST' && apt.icao === app.S.destIcao ? good.etaDestMs : good.alt[apt.icao];
      // The module is given the arrival day (12 MAR) and the last valid time: with a module
      // that checks only that day (v1.11.2), the arrival-day NOTAMs are the ones checked.
      assert.equal(at(e), at(want), `"${bad}": ${apt.icao} ${apt.role} evaluated at the last valid date and time`);
      assert.equal(n.depMin, 30, `"${bad}": ${apt.icao} departure time 0030, not the raw "${bad}"`);
      assert.deepEqual(st, before[apt.icao + apt.role], `"${bad}": ${apt.icao} card as before the entry`);
    }
    assert.ok(good.alt && iso(good.etaDestMs) === '2026-03-12', 'RKSI on 12 MAR');
  }
});

test('TC-142-007 QA KORD-EDDF and the delay packages, invalid OUT left standing: no NOTAM in effect is hidden', async () => {
  const dir = requireFixtures();
  const man = readManifest(dir);
  let inEffect = 0;
  for (const bad of ['2400', '2360', '003', '']) {
    for (const [id, newOut] of QA_EDITS) {
      const fx = man.fixtures.find(f => f.id === id);
      assert.ok(fx, `${id} in the fixtures`);
      const imp = await importFixture(fx, dir);
      const app = imp.app, dof = app.sandbox.window._flightDateISO;
      edit(app, 'outZ', newOut);
      const good = tl(app);
      assert.equal(iso(good.outMs), iso(Date.parse(dof + 'T00:00:00Z') + DAY), `${id}: OUT moved to D + 1`);
      const before = {};
      for (const apt of app.getAllAirports()) before[apt.icao + apt.role] = card(app, apt.icao).st;
      edit(app, 'outZ', bad);                           // left standing
      for (const apt of app.getAllAirports()) {
        const data = imp.airportData[apt.icao] || {};
        const e = apt.role === 'ORIG' ? good.outMs : apt.role === 'DEST' && apt.icao === imp.S.destIcao ? good.etaDestMs : good.alt[apt.icao];
        if (!(data.notams && data.notams.trim()) || e == null) continue;
        // In effect: the module on the actual date and time (the last valid value).
        const m = Math.round((e % DAY) / 60000);
        const ref = app.evalNotamsAs(app._splitNotams(data.notams), apt.role === 'ORIG' ? 'ORIG' : 'DEST', m, imp.S.acftType, iso(e), m);
        const want = [];
        for (const [, g] of ref.rwyGroups) for (const it of g.items) want.push(it.notamRaw);
        (ref.sidIssues || []).concat(ref.starIssues || []).forEach(i => want.push(i.notamRaw));
        const c = card(app, apt.icao);
        const shownN = new Set(c.notams);
        inEffect += want.length;
        assert.deepEqual(want.filter(n => !shownN.has(n)).map(n => n.split('\n')[0].slice(0, 22)), [], `${id} "${bad}" ${apt.icao} ${apt.role}: NOTAMs in effect at ${at(e)} hidden`);
        assert.deepEqual(c.st, before[apt.icao + apt.role], `${id} "${bad}" ${apt.icao} ${apt.role}: card as before the entry`);
      }
    }
  }
  assert.ok(inEffect > 400, `${inEffect} NOTAMs in effect checked`);
});

test('TC-142-008 save → reload, and an older save, with an invalid entry standing', () => {
  const recReload = (a, drop) => {
    const f = a.getFlights(); if (drop) delete f[0].timeline;
    const b = loadApp({ html: REC_HTML, storageData: { rp_flights: f } });
    b.loadFlight(b.getFlights()[0]);
    record(b);
    ['XXXO', 'XXXX', 'XXXA'].forEach(i => feed(b, i));
    return b;
  };
  for (const bad of ['2400', '2360']) {
    // Saved with the timeline: the last valid values come back and are evaluated.
    let a = mk142();
    edit(a, 'outZ', '0030'); edit(a, 'outZ', bad);
    assertEvaluated(recReload(a, false), { XXXO: ms('2026-03-10', '0030'), XXXX: ms('2026-03-10', '1030'), XXXA: ms('2026-03-10', '1100') }, `"${bad}", reload`);
    // Older save (no timeline) with OUT "2400" standing: the last valid OUT is not in the
    // save, so OUT is the OFP OUT; IN and ALT are planned from it, not the HHMM recalculated
    // from "2400" (1000 / 1030).
    a = mk142();
    edit(a, 'outZ', bad);
    const b = recReload(a, true);
    assert.equal(b.S.etaDest, '1000', 'IN shown as saved');
    assertEvaluated(b, { XXXO: ms('2026-03-09', '2300'), XXXX: ms('2026-03-10', '0900'), XXXA: ms('2026-03-10', '0930') }, `older save, OUT "${bad}"`);
    // Older save with IN "2400" standing: IN is its planned time (OUT + 600).
    a = mk142();
    edit(a, 'etaDest', bad);
    assertEvaluated(recReload(a, true), { XXXO: ms('2026-03-09', '2300'), XXXX: ms('2026-03-10', '0900'), XXXA: ms('2026-03-10', '0930') }, `older save, IN "${bad}"`);
  }
  // negative: an older save with every entry valid still places the saved HHMM (F2).
  const a = mk142();
  edit(a, 'outZ', '0030');
  assertEvaluated(recReload(a, true), { XXXO: ms('2026-03-10', '0030'), XXXX: ms('2026-03-10', '1030'), XXXA: ms('2026-03-10', '1100') }, 'older save, all valid');
});
