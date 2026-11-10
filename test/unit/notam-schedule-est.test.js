'use strict';
/**
 * TC-113 — NOTAMs in effect are not hidden by the schedule checks (H1) or by an
 * estimated end (H2). Source: QA of the EV-0 inventory (app PR #35, comment 6701985196).
 *
 * Exec rules applied in evalNotams() (src/notam.html):
 *   D31  UFN = in effect with no end date. An estimated end (EST) is not an end:
 *        the NOTAM stays in effect until cancelled or replaced.
 *   Schedules: every schedule is checked against the actual UTC date and time of
 *        every part of the evaluation window (ETA ± 60 min; ORIG: departure ± 60).
 *        A window that crosses 0000Z is checked on both UTC dates. In effect if ANY
 *        part of the window falls in a scheduled period.
 *   D27  a schedule or date that cannot be read → the NOTAM is shown.
 *
 *   TC-113-001  H1: scheduled only on the arrival UTC day (D+1), ETA D+1 0030Z → in effect
 *   TC-113-002  H1 negative: same schedule on day D only → not in effect
 *   TC-113-003  window crossing 0000Z (ETA 0010Z): schedule day D 2300-2359 → in effect
 *   TC-113-004  H2 real fixtures: the 4 NOTAMs named by QA are in effect at their
 *               airports' ETA (and an EST NOTAM that has not started stays hidden)
 *   TC-113-005  H2 synthetic: UFN(EST …) and an EST end, after the estimated date → in effect
 *   TC-113-006  corpus: the NOTAMs that change from hidden to shown on every
 *               Navtech/eOFP fixture are exactly the reviewed list; the NOTAMs that
 *               change from shown to hidden are exactly the v1.11.2 (P-23) list,
 *               each with dates wholly outside the actual evaluation window
 *   TC-113-010..015  further positive/negative cases of the same rules
 *
 * Fixture tests FAIL (never skip) when the fixtures are missing.
 * Messages name fixture ids, ICAO codes, NOTAM IDs and dates only; no fixture text.
 * All times are UTC.
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness');
const { findFixtures, readManifest, importFixture } = require('../lib/app-path');
const { evalArgsFor, callEvalNotams, notamIdOf } = require('../lib/v0-snapshots');

const app = loadApp();

// Is this NOTAM reported by evalNotams() (i.e. in effect and past the filters)?
function shows(notam, { role = 'DEST', eta, iso, dep } = {}) {
  const r = app.evalNotamsAs([notam], role, eta, 'B744', iso, dep);
  return r.issues.some(i => i.notamRaw === notam);
}
const hm = s => parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(2), 10);

// Synthetic flight: departs 09 MAR 2026 at 1600Z (day D = 09), arrives after 0000Z (D+1 = 10).
const D   = '2026-03-09';
const DEP = hm('1600');
const nt  = (id, sched) => `- XXXX ${id} 01MAR0000-31MAR2359\n${sched}\nRWY 09/27 CLSD\n`;

// ══ H1: day-of-month schedule on the actual UTC date ═══════════════════════

test('TC-113-001 H1: NOTAM scheduled only on the arrival UTC day, ETA D+1 0030Z → in effect at DEST', () => {
  const n = nt('A0301/26', '10-10 0000-0300');
  assert.equal(shows(n, { eta: hm('0030'), iso: D, dep: DEP }), true);
  // Same through evalAirport(), which takes the departure time from S.outZ.
  const a = loadApp();
  a.sandbox.window._flightDateISO = D;
  a.S.outZ = '1600';
  const st = a.evalAirport('XXXX', '0030', n, '', null, 'DEST', 'B744');
  assert.ok(st.issues.some(i => /RWY 09\/27/.test(i.text)), 'evalAirport() shows it at the destination');
});

test('TC-113-002 H1 negative: same NOTAM scheduled only on day D → not in effect at DEST (ETA on D+1)', () => {
  const n = nt('A0302/26', '09-09 0000-0300');
  assert.equal(shows(n, { eta: hm('0030'), iso: D, dep: DEP }), false);
  const a = loadApp();
  a.sandbox.window._flightDateISO = D;
  a.S.outZ = '1600';
  const st = a.evalAirport('XXXX', '0030', n, '', null, 'DEST', 'B744');
  assert.ok(!st.issues.some(i => /RWY 09\/27/.test(i.text)), 'evalAirport() does not show it');
});

test('TC-113-003 window crossing 0000Z (ETA 0010Z on D+1): schedule day D 2300-2359 → in effect', () => {
  assert.equal(shows(nt('A0303/26', '09-09 2300-2359'), { eta: hm('0010'), iso: D, dep: DEP }), true);
  // Negative: a period on day D that ends before ETA − 60 (2310Z) → not in effect.
  assert.equal(shows(nt('A0304/26', '09-09 2200-2309'), { eta: hm('0010'), iso: D, dep: DEP }), false);
});

// ══ H2: estimated end (synthetic) ══════════════════════════════════════════

test('TC-113-005 H2: "UFN(EST <date>)" and an "EST" end, both after the estimated date → in effect', () => {
  const F = { eta: hm('1200'), iso: '2026-05-20', dep: hm('0200') };   // well after 10 MAY
  const body = '\nRWY 09/27 CLSD\n';
  const inEffect = [
    ['UFN(EST) Navtech-style',   '- XXXX A0501/26 01MAY0800-UFN(EST 10MAY1200)' + body],
    ['UFN(EST) FlightKeys-style','XXXX XXX A0502/26   2026-May-01 08:00 - UFN(EST 2026-May-10 12:00)' + body],
    ['EST end',                  '- XXXX A0503/26 01MAY0800-10MAY1200 EST' + body],
    ['EST end with year',        '- XXXX A0504/26 01MAY0800-10MAY1200 2026 EST' + body],
    ['EST end, 10-digit pair',   '- XXXX A0505/26 RWY 09/27 CLSD 2605010800-2605101200EST\n'],
    ['EST end, B)/C) items',     'B) 2605010800 C) 2605101200 EST E) RWY 09/27 CLSD\n'],
    ['EST end, WEF/UNTIL',       'XXXX RWY 09/27 CLSD WEF 01MAY0800 UNTIL 10MAY1200 EST\n'],
    ['EST end, previous year',   '- XXXX A0506/25 20DEC1930-20MAR2300 2026 EST' + body],
  ];
  for (const [what, n] of inEffect) assert.equal(shows(n, F), true, `${what}: in effect`);
  // Negatives: without EST the same end date is a real end → not in effect.
  const ended = [
    ['firm end',                 '- XXXX A0511/26 01MAY0800-10MAY1200' + body],
    ['firm end, 10-digit pair',  '- XXXX A0512/26 RWY 09/27 CLSD 2605010800-2605101200\n'],
    ['firm end, B)/C) items',    'B) 2605010800 C) 2605101200 E) RWY 09/27 CLSD\n'],
    ['EST only in the body text','- XXXX A0513/26 01MAY0800-10MAY1200\nRWY 09/27 CLSD EST COMPLETION 15MAY\n'],
  ];
  for (const [what, n] of ended) assert.equal(shows(n, F), false, `${what}: not in effect`);
});

test('TC-113-010 H2 negative: an EST NOTAM that has not started by ETA + 60 is not in effect', () => {
  const n = '- XXXX A0521/26 21MAY0800-30MAY1200 EST\nRWY 09/27 CLSD\n';
  assert.equal(shows(n, { eta: hm('1200'), iso: '2026-05-20', dep: hm('0200') }), false);
  assert.equal(shows(n, { eta: hm('1200'), iso: '2026-05-22', dep: hm('0200') }), true);
});

// ══ Further schedule cases ═════════════════════════════════════════════════

test('TC-113-011 daily schedule: in effect when any part of ETA ± 60 is in the period', () => {
  const F = { eta: hm('1312'), iso: '2026-03-15', dep: hm('0135') };
  assert.equal(shows(nt('A0601/26', '1410-2030'), F), true, 'starts 58 min after ETA');
  assert.equal(shows(nt('A0602/26', 'DLY 1000-1212'), F), true, 'ends exactly at ETA − 60');
  assert.equal(shows(nt('A0603/26', '1413-2030'), F), false, 'starts after ETA + 60');
  assert.equal(shows(nt('A0604/26', 'DLY 1000-1211'), F), false, 'ends before ETA − 60');
  // Crossing 0000Z on both sides.
  const G = { eta: hm('0020'), iso: D, dep: DEP };
  assert.equal(shows(nt('A0605/26', 'DLY 2300-2330'), G), true, 'window 2320-0120 reaches back before 0000Z');
  assert.equal(shows(nt('A0606/26', 'DLY 2200-2319'), G), false);
});

test('TC-113-012 day-of-month period that crosses 0000Z counts on the day after the listed day', () => {
  // "08-09 2200-0300": the period that starts 09 MAR 2200Z runs to 10 MAR 0300Z.
  // QA case: flight date 10 MAR, time 0100Z on 10 MAR (here the departure airport).
  const Q = { role: 'ORIG', eta: hm('0100'), iso: '2026-03-10', dep: hm('0100') };
  assert.equal(shows(nt('A0611/26', '08-09 2200-0300'), Q), true);
  assert.equal(shows(nt('A0612/26', '07-08 2200-0300'), Q), false, 'last period ends 09 MAR 0300Z');
  // Destination reached on D+1 (10 MAR) at 0100Z after a 09 MAR departure.
  const F = { eta: hm('0100'), iso: D, dep: DEP };
  assert.equal(shows(nt('A0613/26', '08-09 2200-0300'), F), true);
  assert.equal(shows(nt('A0614/26', '07-08 2200-0300'), F), false, 'last period ends 09 MAR 0300Z');
});

test('TC-113-013 departure airport: the departure window ± 60 is checked on both UTC dates', () => {
  const F = { role: 'ORIG', eta: hm('2330'), iso: D, dep: hm('2330') };   // window 09 2230 – 10 0030
  assert.equal(shows(nt('A0621/26', '10-10 0000-0100'), F), true, 'D+1 part of the window');
  assert.equal(shows(nt('A0622/26', '09-09 2200-2235'), F), true, 'D part of the window');
  assert.equal(shows(nt('A0623/26', '10-10 0031-0300'), F), false);
  assert.equal(shows(nt('A0624/26', '09-09 2000-2229'), F), false);
});

test('TC-113-014 D27: departure time unknown → both D and D+1 are tried', () => {
  const F = { eta: hm('0030'), iso: D, dep: null };
  assert.equal(shows(nt('A0631/26', '10-10 0000-0300'), F), true);
  assert.equal(shows(nt('A0632/26', '09-09 0000-0300'), F), true);
  assert.equal(shows(nt('A0633/26', '11-11 0000-0300'), F), false, 'neither D nor D+1');
});

test('TC-113-015 D27: a schedule that cannot be read is not applied (shown)', () => {
  const F = { eta: hm('1200'), iso: D, dep: hm('0200') };
  assert.equal(shows(nt('A0641/26', '09-09 2500-2600'), F), true, 'impossible hours');
  assert.equal(shows(nt('A0642/26', '00-00 0000-0100'), F), true, 'impossible day');
  assert.equal(shows(nt('A0643/26', '28-03 0000-0100'), F), true, 'day range not readable as one month');
  assert.equal(shows(nt('A0644/26', 'DLY 0060-0100'), F), true, 'impossible minutes');
  // Flight date that cannot be read (NOTAM with no date range, so only the schedule decides).
  assert.equal(shows('- XXXX A0647/26\n09-09 2000-2100\nRWY 09/27 CLSD\n', { eta: hm('1200'), iso: 'not-a-date', dep: hm('0200') }),
    true, 'flight date unreadable');
  // Negatives: the same schedules with readable values outside the window → not in effect.
  assert.equal(shows(nt('A0645/26', '09-09 2000-2100'), F), false);
  assert.equal(shows(nt('A0646/26', 'DLY 0000-0100'), F), false);
});

// ══ Real fixtures ═════════════════════════════════════════════════════════

const FIXTURES_DIR = findFixtures();
let _imports = null;
async function imports() {
  if (!_imports) _imports = (async () => {
    assert.ok(FIXTURES_DIR, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)');
    const manifest = readManifest(FIXTURES_DIR);
    const out = [];
    for (const fx of manifest.fixtures) {
      if (fx.format === 'flightkeys') continue;
      out.push({ fx, imp: await importFixture(fx, FIXTURES_DIR) });
    }
    return out;
  })();
  return _imports;
}

// IDs evalNotams() reports for one airport, called exactly as evalAirport() calls it.
function shownIds(imp, apt) {
  const a = evalArgsFor(imp, apt);
  if (!a) return new Set();
  return new Set(callEvalNotams(imp.app, a).issues.filter(i => i.notamRaw).map(i => notamIdOf(i.notamRaw)));
}

test('TC-113-004 H2 real fixtures: the 4 NOTAMs with a passed estimated end are in effect', async () => {
  const all = await imports();
  const want = [
    ['NB_KORD-EDDF_06MAY26_notam_rev10',   'KORD', 'KORD A7829/26'],   // departure airport
    ['NB_KORD-EDDF_06MAY26_notam_rev10',   'EINN', 'EINN A4292/25'],
    ['NB_KPSM-ETAR_19APR26_nat_rev12',     'EINN', 'EINN A4292/25'],
    ['NB_KLAX-RJAA_01MAY26_notam_rev5',    'RJTT', 'RJTT J0971/26'],
    ['NB_VHHH-PANC_11MAY26_wheelsup_rev23','RJCC', 'RJCC C1326/26'],
  ];
  for (const [fid, icao, id] of want) {
    const it = all.find(x => x.fx.id === fid);
    assert.ok(it, `${fid}: fixture missing`);
    const apt = it.imp.app.getAllAirports().find(a => a.icao === icao);
    assert.ok(apt, `${fid}: airport ${icao} not evaluated`);
    assert.ok(shownIds(it.imp, apt).has(id), `${fid} ${icao}: ${id} must be in effect at ETA ${apt.eta}`);
  }
  // Negative: an EST NOTAM that has not started by the ETA window stays hidden.
  const it = all.find(x => x.fx.id === 'NB_YPDN-PHNL_11MAR26_etops_rev16');
  assert.ok(it, 'NB_YPDN-PHNL_11MAR26_etops_rev16: fixture missing');
  const hits = it.imp.app.getAllAirports().filter(apt => {
    const a = evalArgsFor(it.imp, apt);
    return a && a.notamArr.some(c => notamIdOf(c) === 'PHOG A0755/26');
  });
  assert.ok(hits.length > 0, 'PHOG A0755/26 not found at any airport');
  for (const apt of hits) assert.ok(!shownIds(it.imp, apt).has('PHOG A0755/26'), `${apt.icao}: PHOG A0755/26 has not started; must stay hidden`);
});

// ── TC-113-006: corpus change list ─────────────────────────────────────────
// "Before" = main (e688a72) evalNotams(), rebuilt here from two parts:
//   - the filters (obstacle, aircraft) are the app's own: a chunk passes them when
//     evalNotams() reports it with etaMin = null (no date or schedule check runs);
//   - the date window and the two schedule checks are main's code, quoted below
//     unchanged (only the variable names of the loop are kept).
// main's nwOverlap_standalone (unchanged by this change; copied so "before" is fixed).
function mainOverlap(w, etaMin, iso) {
  if (etaMin === null) return true;
  if (!iso) return true;
  const base  = new Date(iso + 'T00:00:00Z').getTime();
  const etaMs = base + Math.floor(etaMin / 60) * 3600000 + (etaMin % 60) * 60000;
  if (w.startMs < etaMs + 3600000 && w.endMs > etaMs - 3600000) return true;
  if (etaMin < 720) {
    const nextMs = etaMs + 86400000;
    return w.startMs < nextMs + 3600000 && w.endMs > nextMs - 3600000;
  }
  return false;
}
// main's active-status block of evalNotams(): EST ignored, schedules at the ETA minute
// on the departure date.
function mainActive(notamRaw, etaMin, resolvedISO) {
  let active = true;
  const w = app.xNW_standalone(notamRaw, resolvedISO);
  if (w) active = mainOverlap(w, etaMin, resolvedISO);
  if (active !== false && etaMin !== null && resolvedISO) {
    const ofpSchedM = notamRaw.match(/^\s*((?:\d{2}-\d{2}\s+)+)(\d{4})-(\d{4})\s*$/m);
    if (ofpSchedM) {
      const etaMs  = new Date(resolvedISO + 'T00:00:00Z').getTime() + etaMin * 60000;
      const etaDay = new Date(etaMs).getUTCDate();
      const etaHM  = new Date(etaMs).getUTCHours() * 60 + new Date(etaMs).getUTCMinutes();
      const startT = parseInt(ofpSchedM[2].slice(0, 2)) * 60 + parseInt(ofpSchedM[2].slice(2));
      const endT   = parseInt(ofpSchedM[3].slice(0, 2)) * 60 + parseInt(ofpSchedM[3].slice(2));
      const dayRanges = [...ofpSchedM[1].matchAll(/(\d{2})-(\d{2})/g)]
        .map(m => ({ from: parseInt(m[1]), to: parseInt(m[2]) }));
      const dayOk  = dayRanges.some(r => etaDay >= r.from && etaDay <= r.to);
      const timeOk = endT >= startT ? (etaHM >= startT && etaHM <= endT) : (etaHM >= startT || etaHM <= endT);
      active = dayOk && timeOk;
    }
  }
  if (active !== false && etaMin !== null) {
    const hasDayRangeSched = /^\s*(?:\d{2}-\d{2}\s+)+\d{4}-\d{4}\s*$/m.test(notamRaw);
    if (!hasDayRangeSched) {
      const dlyLine = notamRaw.match(/^\s*(?:DLY\s+)?(\d{4}\s*-\s*\d{4}(?:\s*,\s*\d{4}\s*-\s*\d{4})*)/m);
      if (dlyLine) {
        const pairs = [...dlyLine[1].matchAll(/(\d{4})\s*-\s*(\d{4})/g)];
        if (pairs.length > 0) {
          active = pairs.some(([, s, e]) => {
            const startT = parseInt(s.slice(0, 2)) * 60 + parseInt(s.slice(2));
            const endT   = parseInt(e.slice(0, 2)) * 60 + parseInt(e.slice(2));
            return endT >= startT ? (etaMin >= startT && etaMin <= endT) : (etaMin >= startT || etaMin <= endT);
          });
        }
      }
    }
  }
  return active;
}
function mainIds(imp, apt) {
  const a = evalArgsFor(imp, apt);
  if (!a) return new Set();
  const ids = new Set();
  for (const chunk of a.notamArr) {
    const passesFilters = imp.app.evalNotamsAs([chunk], a.evalRole, null, a.acftType, a.flightISO)
      .issues.some(i => i.notamRaw === chunk);
    if (passesFilters && mainActive(chunk, a.etaMin, a.flightISO)) ids.add(notamIdOf(chunk));
  }
  return ids;
}

// Reviewed list: fixture, airport, NOTAM ID, why it was hidden before.
//   EST  = H2, estimated end passed (D31)
//   WIN  = schedule was checked at the ETA minute only; any part of ETA ± 60 now counts
const EXPECTED_NEWLY_SHOWN = [
  ['EOFP_UAAA-EHAM_27OCT26_matchedpair_rev11', 'EBBR', 'EBBR A3859/26', 'WIN'],
  ['NB_KCHS-LIBG_12MAR26_lcf_rev16',           'EIDW', 'EIDW A1035/26', 'WIN'],
  ['NB_EHAM-RKSI_08MAY26_exemption_rev11',     'RKSI', 'RKSI A0291/26', 'WIN'],
  ['NB_KLAX-RJAA_01MAY26_notam_rev5',          'RJAA', 'RJAA A0656/26', 'WIN'],
  ['NB_KLAX-RJAA_01MAY26_notam_rev5',          'RJAA', 'RJAA A0660/26', 'WIN'],
  ['NB_KLAX-RJAA_01MAY26_notam_rev5',          'RJTT', 'RJTT J0971/26', 'EST'],
  ['NB_KLAX-ZSAM_11MAR26_etops-rda_rev6',      'KLAX', 'KLAX A1621/26', 'WIN'],
  ['NB_KLAX-ZSAM_11MAR26_etops-rda_rev6',      'KLAX', 'KLAX A1622/26', 'WIN'],
  ['NB_KLAX-ZSAM_11MAR26_etops-rda_rev6',      'KLAX', 'KLAX A1624/26', 'WIN'],
  ['NB_KORD-EDDF_06MAY26_notam_rev10',         'EINN', 'EINN A4292/25', 'EST'],
  ['NB_KORD-EDDF_06MAY26_notam_rev10',         'KORD', 'KORD A7829/26', 'EST'],
  ['NB_KORD-RJAA_05APR26_tempcontrol_rev8',    'RJAA', 'RJAA A0421/26', 'WIN'],
  ['NB_KORD-RJAA_05APR26_tempcontrol_rev8',    'RJAA', 'RJAA A0435/26', 'WIN'],
  ['NB_KORD-RJAA_05APR26_tempcontrol_rev8',    'RJAA', 'RJAA A0485/26', 'WIN'],
  ['NB_KORD-RJAA_05APR26_tempcontrol_rev8',    'RJAA', 'RJAA A0486/26', 'WIN'],
  ['NB_KORD-RJAA_05APR26_tempcontrol_rev8',    'RJAA', 'RJAA A0487/26', 'WIN'],
  ['NB_KORD-RJAA_05APR26_tempcontrol_rev8',    'RJAA', 'RJAA A0488/26', 'WIN'],
  ['NB_KORD-RJAA_05APR26_tempcontrol_rev8',    'RJAA', 'RJAA A0489/26', 'WIN'],
  ['NB_KORD-RJAA_05APR26_tempcontrol_rev8',    'RJAA', 'RJAA A0490/26', 'WIN'],
  ['NB_KORD-RKSI_31MAY26_altroute_rev10',      'RJAA', 'RJAA A0664/26', 'WIN'],
  ['NB_KPSM-ETAR_19APR26_nat_rev12',           'EINN', 'EINN A4292/25', 'EST'],
  ['NB_NZAA-YSSY_06APR26_qfa_rev3',            'YMML', 'YMMM E1246/26', 'WIN'],
  ['NB_NZAA-YSSY_06APR26_qfa_rev3',            'YMML', 'YMMM E1247/26', 'WIN'],
  ['NB_NZAA-YSSY_06APR26_qfa_rev3',            'YMML', 'YMMM E1248/26', 'WIN'],
  ['NB_PGUA-RKSO_05JUN26_dod_rev5',            'PGUA', 'PGUA V0001/26', 'WIN'],
  ['NB_RODN-PANC_13MAR26_etops_rev16',         'RJTT', 'RJTT J0030/26', 'WIN'],
  ['NB_VHHH-PANC_11MAY26_wheelsup_rev23',      'PANC', 'PANC A3903/26', 'WIN'],
  ['NB_VHHH-PANC_11MAY26_wheelsup_rev23',      'RJCC', 'RJCC C1326/26', 'EST'],
  ['NB_VHHH-PANC_11MAY26_wheelsup_rev23',      'RJTT', 'RJTT J0955/26', 'WIN'],
];

// v1.11.2 (ledger P-23, Exec rule 7 Nov): the "before" above still tries a second UTC date
// (D + 1 for an ETA before 1200Z, and D for an ETA on D + 1). The NOTAMs below were shown
// only because of that second date: their dates lie wholly outside the evaluation window
// (ETA ± 60) on its actual UTC date. Reviewed one by one in
// test/reports/NOTAM-v1.11.2-corpus-changes.md (test/corpus/notam-window-changes.js).
//   D    = in effect only on the departure date D; the ETA is on D + 1
//   D+1  = in effect only from D + 1; the window is on D (ETA before 1200Z)
const EXPECTED_NEWLY_HIDDEN = [
  ['EOFP_EHBK-RKSI_09SEP26_pkgC_rev16',        'RKSS', 'RKSS A1065/26', 'D'],
  ['NB_ELLX-KHSV_08MAR26_baseline_rev16',      'KBHM', 'KBHM A0403/26', 'D'],
  ['NB_ELLX-KHSV_08MAR26_baseline_rev16',      'KBHM', 'KBHM A0404/26', 'D'],
  ['NB_KCHS-LIBG_12MAR26_lcf_rev16',           'EDDF', 'EDDF A6692/25', 'D'],
  ['NB_KLAX-RJAA_01MAY26_notam_rev5',          'KLAX', 'KLAX A2522/26', 'D+1'],
  ['NB_KLAX-RJAA_01MAY26_notam_rev5',          'KLAX', 'KLAX A2540/26', 'D+1'],
  ['NB_KLAX-RJAA_01MAY26_notam_rev5',          'KLAX', 'KLAX A2545/26', 'D+1'],
  ['NB_KLAX-RJAA_01MAY26_notam_rev5',          'KLAX', 'KLAX A2546/26', 'D+1'],
  ['NB_KLAX-RJAA_01MAY26_notam_rev5',          'KLAX', 'KLAX A2547/26', 'D+1'],
  ['NB_KLAX-RJAA_01MAY26_notam_rev5',          'KLAX', 'KLAX A2548/26', 'D+1'],
  ['NB_KORD-RJAA_05APR26_tempcontrol_rev8',    'KORD', 'KORD A6436/26', 'D+1'],
  ['NB_KORD-RKSI_08APR26_catii_rev14',         'KORD', 'KORD A7034/26', 'D+1'],
  ['NB_KORD-RKSI_08APR26_catii_rev14',         'KORD', 'KORD A7035/26', 'D+1'],
  ['NB_KORD-RKSI_31MAY26_altroute_rev10',      'RJTT', 'RJTT E2130/26', 'D'],
  ['NB_KORD-RKSI_31MAY26_altroute_rev10',      'RJTT', 'RJTT E2182/26', 'D'],
  ['NB_KORD-RKSI_31MAY26_altroute_rev10',      'RJTT', 'RJTT E2243/26', 'D'],
  ['NB_KORD-RKSI_31MAY26_altroute_rev10',      'RJTT', 'RJTT J0903/26', 'D'],
  ['NB_KORD-RKSI_31MAY26_altroute_rev10',      'RJTT', 'RJTT J0904/26', 'D'],
  ['NB_KORD-RKSI_31MAY26_altroute_rev10',      'RJTT', 'RJTT J0905/26', 'D'],
  ['NB_KORD-RKSI_31MAY26_altroute_rev10',      'RJTT', 'RJTT J0957/26', 'D'],
  ['NB_KORD-RKSI_31MAY26_altroute_rev10',      'RJTT', 'RJTT J0958/26', 'D'],
  ['NB_PANC-KORD_10APR26_maxldgw_rev6',        'KORD', 'KORD A6859/26', 'D'],
  ['NB_RJAA-PANC_11APR26_notamschedule_rev5',  'PANC', 'PANC A3258/26', 'D'],
];

test('TC-113-006 corpus: hidden → shown is exactly the reviewed list; shown → hidden is exactly the P-23 list', async () => {
  const all = await imports();
  const newlyShown = [], newlyHidden = [];
  let airports = 0;
  for (const { fx, imp } of all) {
    for (const apt of imp.app.getAllAirports()) {
      const before = mainIds(imp, apt);
      const after  = shownIds(imp, apt);
      airports++;
      for (const id of after)  if (!before.has(id)) newlyShown.push(`${fx.id} ${apt.icao} ${id}`);
      for (const id of before) if (!after.has(id))  newlyHidden.push(`${fx.id} ${apt.icao} ${id}`);
    }
  }
  console.log(`TC-113-006: ${all.length} Navtech/eOFP fixtures, ${airports} airports; hidden -> shown ${newlyShown.length}, shown -> hidden ${newlyHidden.length}`);
  assert.ok(all.length >= 30, `expected at least 30 Navtech/eOFP fixtures, found ${all.length}`);
  assert.deepEqual(newlyHidden.sort(), EXPECTED_NEWLY_HIDDEN.map(([f, a, id]) => `${f} ${a} ${id}`).sort(),
    'the NOTAMs that change from shown to hidden differ from the reviewed P-23 list');
  assert.deepEqual(newlyShown.sort(), EXPECTED_NEWLY_SHOWN.map(([f, a, id]) => `${f} ${a} ${id}`).sort(),
    'the NOTAMs that change from hidden to shown differ from the reviewed list');
});
