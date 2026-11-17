'use strict';
/**
 * TC-171 — NOTAM ruleset v1.13.0 reads FlightKeys NOTAM item headers (ledger P-25)
 *
 * Brief 5c: the NOTAM ruleset evaluates FlightKeys NOTAM items exactly as it does NavBlue ones
 * (same window rule: actual UTC date, ETA ± 60, D51; T1–T6, D27, D31, D43). NavBlue results do
 * not change. Grammar: docs/RPT-OFP-FlightKeys-BriefingGrammar-NEW-20261114-v1.0.md §A.5–§A.7,
 * §A.10 (D54).
 *
 *   TC-171-001  version, manifest, exports; v1.12.0 file gone
 *   TC-171-010  every §A.5 header form read (locations 0–7 incl. the wrapped cell, ID with and
 *               without series letter, ASHTAM, start, end date / UFN / UFN(EST), CREATED:, FL:,
 *               SCHEDULE:, SUBJECT:, Company ID indent); lines that are not headers are not read
 *   TC-171-011  windows: date end; UFN = NavBlue "-PERM"; UFN(EST) = NavBlue "… EST" (D31)
 *   TC-171-012  a date that cannot be read → no window → that NOTAM alone is shown (T6); never
 *               a guessed or rolled-over date; 24:00 as NavBlue 2400
 *   TC-171-013  the window rule is NavBlue's: a FlightKeys item and its NavBlue twin are shown
 *               at exactly the same ETAs (actual UTC date, ETA ± 60 with edges, D + 1 after
 *               0000Z, departure unknown, ORIG, no flight date, year end)
 *   TC-171-014  SCHEDULE: read as NavBlue reads its D) line; a wrapped cell is read whole and
 *               never in pieces; a body line is never a schedule; D27
 *   TC-171-015  D43: location(s) + ID; different IDs never merged
 *   TC-171-016  D54: split pieces are exact substrings; notamRaw unchanged; nothing reflowed
 *   TC-171-020  the 26 FlightKeys fixtures: per-form counts = the grammar doc; every NOTAM item
 *               has a readable window (reported per package)
 *   TC-171-021  the fixtures: _splitNotams cuts every package exactly at its item headers
 *   TC-171-022  header rows split across a page (40 items; the L07 example)
 *   TC-171-023  wrapped location cell (13 items)
 *   TC-171-024  FK-P on the matched pair (NavBlue eOFP and FlightKeys, same flight)
 *   TC-171-030  NavBlue unchanged: no FlightKeys header in any NavBlue text; split rule
 *               unchanged; evalNotams()/windows equal v1.12.0's recorded results (sweep)
 *   TC-171-031  the gate bites: broken variants of the new code are caught
 *   TC-171-040  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Synthetic NOTAMs use airports XXXX / XXX and invented IDs. Fixture tests report counts, fixture
 * labels, ICAO codes and NOTAM IDs only; no fixture text is printed or asserted.
 * Item texts are built from items/*.json by test/lib/fk-briefing.js (test code only, §A.1).
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { findFixtures, readManifest } = require('../lib/app-path');
const { nodeAircraftProfile } = require('../lib/acft');
const fkb = require('../lib/fk-briefing');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const MOD_FILE = path.join(RULES, MANIFEST['notam-rules'].file);
const MOD_SRC  = fs.readFileSync(MOD_FILE, 'utf8');
const M        = require(MOD_FILE);
const AP       = nodeAircraftProfile();
const RECORD   = path.join(__dirname, 'data', 'notam-v1.12.0-navblue.json');

// ── fixtures: missing = FAIL ────────────────────────────────────────────────
function fixturesDir() {
  if (process.env.PB_FIXTURES) {
    const d = path.resolve(process.env.PB_FIXTURES);
    return fs.existsSync(path.join(d, 'manifest.json')) ? d : null;
  }
  return findFixtures();
}
function requireFixturesDir() {
  const d = fixturesDir();
  if (!d) throw new Error('fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)');
  return d;
}
// Labels of the 26 FlightKeys packages (field map v1.1 §1.1; grammar doc §A.2).
const LABELS = {
  'FK_UAAA-EHAM_27OCT26_prototype': 'T1', 'FK_ZUCK-UAAA_27OCT26_prototype': 'T2', 'FK_KLAX-RKSI_31OCT26_rda-etp_prototype': 'T3',
  'FK_MKJP-KMIA_03NOV26_caribbean-callsign_live': 'L01', 'FK_KORD-RKSI_05NOV26_crew-ballast-rda_live': 'L02',
  'FK_PANC-ZHEC_04NOV26_etops-ddg_live': 'L03', 'FK_RCTP-RJGG_03NOV26_lcf-lbs_live': 'L04', 'FK_KCVG-KSEA_04NOV26_pax-catiii_live': 'L05',
  'FK_LEZG-LLBG_04NOV26_remarks-subcards_live': 'L06', 'FK_LLBG-OMDW_04NOV26_poslaunch-permits_live': 'L07',
  'FK_KMIA-EHBK_03NOV26_polar-callsign_live': 'L08', 'FK_VHHH-PANC_02NOV26_mtow-equipcode_live': 'L09',
  'FK_KMIA-SBGL_03NOV26_perishables-ddg_live': 'L10', 'FK_KGSP-EPWA_03NOV26_nat-track-ddg_live': 'L11',
  'FK_EBLG-KORD_03NOV26_nat-random_live': 'L12', 'FK_UBBB-RJFK_03NOV26_bcf-multicrew_live': 'L13',
  'FK_KORD-RKSI_03NOV26_etops-rda-dateline_live': 'L14', 'FK_PHNL-WIHH_03NOV26_pax-etops-tanker_live': 'L15',
  'FK_ZHEC-PANC_02NOV26_wheelsup-penalty_live': 'L16', 'FK_OMAA-VHHH_03NOV26_etihad-permits_live': 'L17',
  'FK_KORD-RJAA_03NOV26_intl-redispatch_live': 'L18', 'FK_PANC-KMIA_03NOV26_dom-redispatch-mel_live': 'L19',
  'FK_KORD-RKSI_10NOV26_nopac-etops-remarks_live': 'L20', 'FK_NZWN-NFFN_10NOV26_pax-remarks_live': 'L21',
  'FK_EPPW-KPSM_10NOV26_nat-random-callsign_live': 'L22', 'FK_KDOV-ETAR_03NOV26_pax-nat-random_live': 'L23',
};
let _fk = null;
function fkPackages() {
  if (_fk) return _fk;
  const dir = requireFixturesDir();
  const list = readManifest(dir).fixtures.filter(f => f.format === 'flightkeys');
  _fk = list.map(fx => {
    const json = fkb.loadItems(dir, fx.id);
    return { fx, label: LABELS[fx.id] || fx.id, items: fkb.packageItems(json), itemsFurniture: fkb.packageItems(json, { keepFurniture: true }) };
  });
  return _fk;
}

// ── synthetic helpers ───────────────────────────────────────────────────────
const D0 = '2026-11-04';                        // flight date for the synthetic cases
const ms = s => Date.parse(s.replace(' ', 'T') + ':00Z');
// A FlightKeys item as the parser hands it over (reading order, line breaks and indentation kept).
function fkItem({ loc = 'XXXX', id = 'A0001/26', start, end, created = '2026-Nov-01 00:00', fl = 'FL: SFC - UNL',
                  sched = null, subject = null, body = ['RWY 09/27 CLSD.'] }) {
  const lines = [`${loc ? loc + '            ' : ''}${id}        ${start} - ${end}`, `CREATED:${created}       ${fl}`];
  if (sched !== null) [].concat(sched).forEach((s, i) => lines.push(i ? s : 'SCHEDULE:' + s));
  if (subject) lines.push('SUBJECT: ' + subject);
  return [...lines, ...body].join('\n');
}
// Its NavBlue twin: "- XXXX A0001/26 01NOV1000-02NOV1000[ EST]" + D) line + body.
function nbItem({ loc = 'XXXX', id = 'A0001/26', head, sched = null, body = ['RWY 09/27 CLSD.'] }) {
  return [`- ${loc}  ${id} ${head}`, ...(sched !== null ? [].concat(sched) : []), ...body].join('\n');
}
const shownAt = (text, eta, dep, date = D0, role = 'DEST') =>
  M.evalNotams([text], role, eta, null, date, dep).issues.some(i => i.notamRaw === text);
const effWindow = (text, date = D0) => {
  let w = M.xNW_standalone(text, date);
  if (w && M._windowEndEstimated(text)) w = { startMs: w.startMs, endMs: Infinity };
  return w;
};
const hm = s => parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(2), 10);

// ══ TC-171-001 ═══════════════════════════════════════════════════════════════

test('TC-171-001 v1.13.0: version, manifest, exports; the v1.12.0 file is gone', () => {
  assert.equal(M.RULESET_VERSION, '1.13.0');
  assert.equal(M.SCHEMA_VERSION, 2, 'export shape and evalNotams() return shape unchanged → SCHEMA_VERSION stays 2');
  assert.deepEqual(M.validateSchema(), { valid: true, errors: [] });
  const e = MANIFEST['notam-rules'];
  assert.equal(e.version, '1.13.0');
  assert.equal(e.file, 'notam-rules/notam-rules-v1.13.0.js');
  assert.equal(e.sha256, crypto.createHash('sha256').update(fs.readFileSync(MOD_FILE)).digest('hex'));
  assert.ok(!fs.existsSync(path.join(RULES, 'notam-rules', 'notam-rules-v1.12.0.js')), 'v1.12.0 removed from rules/');
  for (const n of ['_fkHeader', '_fkWindow', '_fkScheduleText']) assert.equal(typeof M[n], 'function', `exports ${n}`);
  // The module never reads positions (brief 5c §2): no x/y, items, pages or width in its code.
  const code = MOD_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const re of [/\.pages\b/, /\.transform\b/, /getTextContent/, /\.str\b/, /\.width\b/, /\b(?:it|item)\.[xy]\b/]) {
    assert.ok(!re.test(code), `module code does not read positions (${re})`);
  }
});

// ══ TC-171-010 header forms ══════════════════════════════════════════════════

test('TC-171-010 every §A.5 header form is read; lines that are not headers are not', () => {
  const S = '2026-Nov-03 18:00', E = '2026-Nov-05 02:00';
  // Locations (§A.5 "Locations"): 0–7 codes, ICAO and IATA in either order.
  const forms = [
    ['IIII',           'XXXX',                ['XXXX']],
    ['IIII AAA',       'XXXX XXX',            ['XXXX', 'XXX']],
    ['AAA IIII',       'XXX XXXX',            ['XXX', 'XXXX']],
    ['IIII AAA AAA',   'XXXX XXA XXB',        ['XXXX', 'XXA', 'XXB']],
    ['IIII IIII',      'XXXX XXXY',           ['XXXX', 'XXXY']],
    ['IIII IIII IIII', 'XXXX XXXY XXXZ',      ['XXXX', 'XXXY', 'XXXZ']],
    ['none (Company)', '',                    []],
  ];
  for (const [form, loc, want] of forms) {
    const h = M._fkHeader(fkItem({ loc, start: S, end: E }));
    assert.ok(h, `form ${form}: read`);
    assert.deepEqual(h.locations, want, `form ${form}: locations`);
    assert.equal(h.id, 'A0001/26', `form ${form}: ID`);
    assert.equal(h.start, S); assert.equal(h.end, E); assert.equal(h.endKind, 'DATE');
    assert.equal(h.created, '2026-Nov-01 00:00'); assert.equal(h.fl, 'FL: SFC - UNL');
  }
  // Company item with no location: the ID cell is right-aligned (indent 75–77 pt ≈ 16 characters).
  const co = M._fkHeader(['                A0929/26        2026-Nov-03 00:00 - UFN', 'CREATED:2026-Nov-03 00:14       FL: SFC - UNL',
    'SUBJECT: XXXX-CURFEW', 'XXXX CURFEW = 1400-2100Z DAILY'].join('\n'));
  assert.ok(co && co.id === 'A0929/26' && co.locations.length === 0 && co.endKind === 'UFN' && co.subjectRow === 2, 'Company item, indented ID');
  // ID forms: series letter, none (FAA local), ASHTAM (no CREATED: row).
  assert.equal(M._fkHeader(fkItem({ loc: 'XXX XXXX', id: '0491/26', start: S, end: E })).id, '0491/26', 'ID with no series letter');
  const ash = M._fkHeader(['XXXF ASHTAM 0677 2026-Nov-03 13:10 - 2026-Nov-04 13:10', 'VAXX0677 XXXF 11031310', 'ASHTAM 0677', 'A)XXXF'].join('\n'));
  assert.ok(ash && ash.id === 'ASHTAM 0677' && ash.created === null && ash.endKind === 'DATE', 'ASHTAM one-line header');
  // End forms: date, UFN, UFN(EST …) (EST = estimated end, never a time zone; rule 1).
  const ufn = M._fkHeader(fkItem({ start: S, end: 'UFN' }));
  assert.ok(ufn.endKind === 'UFN' && ufn.end === null, 'UFN');
  const est = M._fkHeader(fkItem({ start: S, end: 'UFN(EST 2026-Dec-26 18:33)' }));
  assert.ok(est.endKind === 'UFN_EST' && est.end === '2026-Dec-26 18:33', 'UFN(EST …)');
  // FL forms (§A.5 "Levels").
  for (const fl of ['FL: SFC - UNL', 'FL: SFC - 300', 'FL: 580 - UNL', 'FL: 60 - 300', 'FL: SFC - 4']) {
    assert.equal(M._fkHeader(fkItem({ start: S, end: E, fl })).fl, fl, fl);
  }
  // SCHEDULE: (line 3; no space after the colon) and its wrapped lines.
  const sc = M._fkHeader(fkItem({ start: S, end: E, sched: ['MON-THU 0630-0700', '1630-1800 FRI 0630-0700', '1300-1800'] }));
  assert.equal(sc.schedule, 'MON-THU 0630-0700 1630-1800 FRI 0630-0700 1300-1800');
  assert.deepEqual(sc.scheduleRows, [2, 3, 4]);
  // Wrapped location cell, 5 codes, the ID on a row of its own; 7 codes, the ID on row 2 (§A.5 desync).
  const five = M._fkHeader(['XXXA XXXB XXXC   2025-Nov-19 09:49 - UFN', 'F1665/25', 'XXXD XXXE    FL: 195 - UNL',
    'CREATED:2025-Nov-19 09:49', 'BODY TEXT'].join('\n'));
  assert.deepEqual([five.id, five.locations.length, five.fl, five.created, five.headerRows],
    ['F1665/25', 5, 'FL: 195 - UNL', '2025-Nov-19 09:49', [0, 1, 2, 3]], '5-code wrapped cell');
  const seven = M._fkHeader(['XXXA XXXB XXXC   2026-Oct-28 16:00 - 2026-Nov-11 15:59', 'XXXD XXXE XXXF A4854/26   FL: SFC - UNL',
    'XXXG', 'CREATED:2026-Sep-21 07:47', 'TRIGGER NOTAM'].join('\n'));
  assert.deepEqual([seven.id, seven.locations.length, seven.headerRows], ['A4854/26', 7, [0, 1, 2, 3]], '7-code wrapped cell');
  // Single-digit day / hour and several spaces between the cells are read; the item is not reflowed.
  assert.ok(M._fkHeader('XXXX A0001/26 2026-Nov-3 8:00 - 2026-Nov-4 08:00\nCREATED:2026-Nov-01 00:00 FL: SFC - UNL\nX'), 'loose spacing');

  // NEGATIVE: not item headers.
  const notHeaders = [
    '2026-Nov-03 18:00 - 2026-Nov-05 02:00\nCREATED:2026-Nov-01 00:00   FL: SFC - UNL',               // no location, no ID
    'XXXA XXXB   2026-Nov-03 18:00 - 2026-Nov-05 02:00\nBODY LINE\nCREATED:2026-Nov-01 00:00',     // location-only row, no ID below
    'XXXA XXXB   2026-Nov-03 18:00 - 2026-Nov-05 02:00',                                           // location-only row, nothing below
    'GTI000 / XXXX - XXXY / 2026-11-04 / N000XX 2026-Nov-04 08:17',                                // running header (§A.3)
    'Page 3 of 8 00000000-0000-0000-0000-000000000000',                                            // footer
    '- XXXX  A0001/26 03NOV1800-05NOV0200\nRWY 09/27 CLSD.',                                        // NavBlue header
    'XXXX A0001/26   2026-Nov-03 18:00 - 2026-Nov-05 02:00 TEXT AFTER',                            // not alone on its line
    'XXXX A0001/26   2026-Nov-03 18:00',                                                           // no end
    'CREATED:2026-Nov-01 00:00   FL: SFC - UNL',
    'WEF 2026-Nov-03 18:00 - 2026-Nov-05 02:00 BODY',
  ];
  for (const t of notHeaders) assert.equal(M._fkHeader(t), null, `not a header: ${JSON.stringify(t.split('\n')[0].slice(0, 40))}`);
});

// ══ TC-171-011 windows ═══════════════════════════════════════════════════════

test('TC-171-011 windows: date end; UFN = NavBlue PERM; UFN(EST) = NavBlue EST end (D31)', () => {
  const S = '2026-Nov-03 18:00';
  // Date end: exactly the printed UTC times (rule 1: no time-zone conversion).
  assert.deepEqual(M.xNW_standalone(fkItem({ start: S, end: '2026-Nov-05 02:00' }), D0), { startMs: ms('2026-11-03 18:00'), endMs: ms('2026-11-05 02:00') });
  assert.equal(M._windowEndEstimated(fkItem({ start: S, end: '2026-Nov-05 02:00' })), false);
  // UFN: start kept, no end — the NavBlue print of the same NOTAM is "-PERM" (matched pair: UAAA A5176/26).
  const fu = fkItem({ start: S, end: 'UFN' }), nu = nbItem({ head: '03NOV1800-PERM' });
  assert.deepEqual(M.xNW_standalone(fu, D0), M.xNW_standalone(nu, D0), 'UFN window = NavBlue -PERM window');
  assert.equal(M.xNW_standalone(fu, D0).startMs, ms('2026-11-03 18:00'));
  assert.equal(M._windowEndEstimated(fu), false);
  // UFN(EST d): the estimated end is not an end — NavBlue prints "start-d EST" (matched pair: EHAM A2422/26).
  const fe = fkItem({ start: S, end: 'UFN(EST 2026-Nov-04 00:00)' }), ne = nbItem({ head: '03NOV1800-04NOV0000 EST' });
  assert.deepEqual(M.xNW_standalone(fe, D0), M.xNW_standalone(ne, D0), 'UFN(EST) window = NavBlue EST window');
  assert.equal(M._windowEndEstimated(fe), true);
  assert.deepEqual(effWindow(fe), { startMs: ms('2026-11-03 18:00'), endMs: Infinity });
  // POSITIVE: past the estimated end, still shown (EST is not an end); past nothing for UFN.
  assert.ok(shownAt(fe, hm('2200'), 0, '2026-11-20'), 'UFN(EST): shown after the estimated date');
  assert.ok(shownAt(fu, hm('2200'), 0, '2027-06-20'), 'UFN: shown long after the start');
  // NEGATIVE: the start still limits it (as NavBlue's PERM and EST windows).
  assert.ok(!shownAt(fe, hm('1000'), 0, '2026-11-02'), 'UFN(EST): hidden before its start');
  assert.ok(!shownAt(fu, hm('1000'), 0, '2026-11-02'), 'UFN: hidden before its start');
  assert.equal(shownAt(nu, hm('1000'), 0, '2026-11-02'), false, 'NavBlue PERM twin: hidden too');
  // The header decides: a date range in the body is never read for a FlightKeys item.
  const bodyDates = fkItem({ start: S, end: 'UFN', body: ['B) 2601010000 C) 2601020000', 'WEF 01JAN0000 UNTIL 02JAN0000 EST', 'RWY 09/27 CLSD.'] });
  assert.equal(M.xNW_standalone(bodyDates, D0).startMs, ms('2026-11-03 18:00'), 'body B)/C) and WEF ignored');
  assert.equal(M._windowEndEstimated(bodyDates), false, 'body EST ignored');
});

// ══ TC-171-012 impossible dates ══════════════════════════════════════════════

test('TC-171-012 a date that cannot be read → no window → only that NOTAM is shown (T6); never a guessed date', () => {
  const bad = [
    ['30 Feb',              '2026-Feb-30 10:00', '2026-Mar-02 10:00'],
    ['29 Feb non-leap',     '2026-Feb-29 10:00', '2026-Mar-02 10:00'],
    ['31 Nov (no rollover)', '2026-Nov-31 10:00', '2026-Dec-02 10:00'],
    ['hour 25',             '2026-Nov-03 25:00', '2026-Nov-05 02:00'],
    ['minute 60',           '2026-Nov-03 12:60', '2026-Nov-05 02:00'],
    ['hour 24:30',          '2026-Nov-03 24:30', '2026-Nov-05 02:00'],
    ['month Abc',           '2026-Abc-03 12:00', '2026-Nov-05 02:00'],
    ['day 00',              '2026-Nov-00 12:00', '2026-Nov-05 02:00'],
    ['year 0026',           '0026-Nov-03 12:00', '2026-Nov-05 02:00'],
    ['end impossible',      '2026-Nov-03 12:00', '2026-Nov-32 02:00'],
    ['backwards window',    '2026-Nov-05 12:00', '2026-Nov-03 02:00'],
    ['UFN(EST impossible)', '2026-Nov-03 12:00', 'UFN(EST 2026-Feb-30 10:00)'],
    ['UFN(EST before start)', '2026-Nov-03 12:00', 'UFN(EST 2026-Nov-01 10:00)'],
    ['start impossible, UFN', '2026-Feb-30 12:00', 'UFN'],
  ];
  // Four readable neighbours, all OUT of effect at the ETA (they end on 01 NOV).
  const ok = n => fkItem({ id: `A00${10 + n}/26`, start: '2026-Oct-20 00:00', end: '2026-Nov-01 00:00', body: [`TWY X${n} CLSD.`] });
  for (const [what, start, end] of bad) {
    const b = fkItem({ id: 'A0099/26', start, end, body: ['RWY 09/27 CLSD.'] });
    assert.equal(M.xNW_standalone(b, D0), null, `${what}: no window`);
    const text = [ok(1), ok(2), b, ok(3), ok(4)].join('\n');
    const parts = M._splitNotams(text);
    assert.equal(parts.length, 5, `${what}: still five items (the header is recognised by its shape)`);
    const r = M.evalNotams(parts, 'DEST', hm('1200'), null, D0, hm('0800'));
    const shown = r.issues.filter(i => i.notamRaw).map(i => M._fkHeader(i.notamRaw).id);
    assert.deepEqual(shown, ['A0099/26'], `${what}: only that NOTAM is shown`);
  }
  // 24:00 = 00:00 the next day, as NavBlue's 2400 (not an impossible date).
  assert.deepEqual(M.xNW_standalone(fkItem({ start: '2026-Nov-03 00:00', end: '2026-Nov-03 24:00' }), D0),
                   M.xNW_standalone(nbItem({ head: '03NOV0000-03NOV2400' }), D0));
  // A header so garbled that it is no longer a header: the two items stay one text, which then holds two
  // CREATED: rows and is not trusted → no window, no schedule → shown (fail-safe; D54 "flag, not guess").
  const garbled = fkItem({ id: 'A0098/26', start: '2O26-Nov-03 12:00', end: '2026-Nov-05 02:00' });
  const two = M._splitNotams([ok(1), garbled].join('\n'));
  assert.equal(two.length, 1);
  assert.equal(M._fkHeader(two[0]).ambiguous, true);
  assert.equal(M.xNW_standalone(two[0], D0), null);
  assert.ok(shownAt(two[0], hm('1200'), hm('0800')), 'garbled neighbour: the merged text is shown');
  // NEGATIVE: the readable neighbour alone stays hidden.
  assert.ok(!shownAt(ok(1), hm('1200'), hm('0800')));
});

// ══ TC-171-013 the window rule is NavBlue's ═══════════════════════════════════

test('TC-171-013 a FlightKeys item and its NavBlue twin are shown at exactly the same ETAs (D51 window rule)', () => {
  const pairs = [
    // [FlightKeys start, end, NavBlue header]
    ['2026-Nov-04 10:00', '2026-Nov-04 12:00', '04NOV1000-04NOV1200'],
    ['2026-Nov-05 00:30', '2026-Nov-05 02:00', '05NOV0030-05NOV0200'],      // next UTC day only
    ['2026-Nov-03 22:00', '2026-Nov-04 00:30', '03NOV2200-04NOV0030'],      // across 0000Z
    ['2026-Oct-01 00:00', '2026-Dec-31 23:59', '01OCT0000-31DEC2359'],
    ['2026-Nov-04 13:00', 'UFN', '04NOV1300-PERM'],
    ['2026-Nov-04 13:00', 'UFN(EST 2026-Nov-04 14:00)', '04NOV1300-04NOV1400 EST'],
  ];
  const etas = []; for (let m = 0; m < 1440; m += 15) etas.push(m);
  let calls = 0;
  for (const [s, e, h] of pairs) {
    const f = fkItem({ start: s, end: e }), n = nbItem({ head: h });
    assert.deepEqual(effWindow(f), effWindow(n), `window ${h}`);
    for (const date of ['2026-11-04', '2026-11-03', null]) for (const dep of [0, hm('1200'), hm('2330'), null]) for (const role of ['DEST', 'ORIG']) for (const eta of [...etas, null]) {
      calls++;
      assert.equal(shownAt(f, eta, dep, date, role), shownAt(n, eta, dep, date, role), `${h} ETA ${eta} OUT ${dep} ${date} ${role}`);
    }
  }
  // The edges (ETA ± 60 included) and the actual date, spelled out.
  const f = fkItem({ start: '2026-Nov-04 10:00', end: '2026-Nov-04 12:00' });
  assert.ok(shownAt(f, hm('1300'), 0), 'ends exactly at ETA − 60: shown');
  assert.ok(!shownAt(f, hm('1301'), 0), 'ends 1 min before ETA − 60: hidden');
  assert.ok(shownAt(f, hm('0900'), 0), 'starts exactly at ETA + 60: shown');
  assert.ok(!shownAt(f, hm('1100'), hm('2300')), 'ETA earlier than OUT → ETA on D + 1: hidden');
  assert.ok(shownAt(f, hm('1100'), null), 'departure unknown → D or D + 1: shown');
  // Year end: FlightKeys prints the year; NavBlue infers it (D38). Same result.
  const yf = fkItem({ id: 'A0001/26', start: '2026-Dec-31 22:00', end: '2027-Jan-01 02:00' });
  const yn = nbItem({ id: 'A0001/26', head: '31DEC2200-01JAN0200 2027' });
  for (const [date, eta, dep] of [['2026-12-31', hm('2330'), hm('2000')], ['2026-12-31', hm('0030'), hm('2000')], ['2027-01-01', hm('0100'), 0], ['2027-01-01', hm('1200'), 0]]) {
    calls++;
    assert.equal(shownAt(yf, eta, dep, date), shownAt(yn, eta, dep, date), `year end ${date} ${eta}`);
  }
  assert.ok(shownAt(yf, hm('0030'), hm('2000'), '2026-12-31'), 'lands 01 JAN 0030Z: shown');
  assert.ok(!shownAt(yf, hm('1200'), 0, '2027-01-01'), '01 JAN 1200Z: hidden');
  console.log(`TC-171-013: ${pairs.length} FlightKeys/NavBlue pairs, ${calls} ETA cases, same result in all`);
});

// ══ TC-171-014 SCHEDULE ═════════════════════════════════════════════════════

test('TC-171-014 SCHEDULE: read as NavBlue reads its D) line; wrapped cells whole; body lines never', () => {
  const W = { start: '2026-Nov-01 00:00', end: '2026-Nov-30 23:59' }, NH = '01NOV0000-30NOV2359';
  const same = (sched, nbSched, cases, what) => {
    const f = fkItem({ ...W, sched }), n = nbItem({ head: NH, sched: nbSched });
    for (const [date, eta] of cases) assert.equal(shownAt(f, hm(eta), 0, date), shownAt(n, hm(eta), 0, date), `${what}: ${date} ${eta}`);
    return f;
  };
  const CASES = [['2026-11-04', '0530'], ['2026-11-04', '1200'], ['2026-11-04', '2330'], ['2026-11-16', '1500'], ['2026-11-11', '1500'], ['2026-11-16', '0800']];
  // Daily window: "hhmm-hhmm" and "DAILY hhmm-hhmm" (NavBlue prints "DLY"; matched pair: EBBR D0587/26).
  const a = same('0430-0630', '0430-0630', CASES, 'bare daily');
  assert.ok(shownAt(a, hm('0530'), 0) && !shownAt(a, hm('1200'), 0), 'bare daily: in / out');
  const b = same('DAILY 1600-0800', 'DLY 1600-0800', CASES, 'DAILY = DLY');
  assert.ok(shownAt(b, hm('2330'), 0) && shownAt(b, hm('0530'), 0) && !shownAt(b, hm('1200'), 0), 'DAILY across 0000Z: in / out');
  // Day-of-month list wrapped over three lines, read whole (NavBlue prints it on one line).
  const c = same(['01-03 05-06 08-10', '12-13 15-17 19-20', '22-24 1430-2100'], '01-03 05-06 08-10 12-13 15-17 19-20 22-24 1430-2100', CASES, 'day list');
  assert.ok(shownAt(c, hm('1500'), 0, '2026-11-16') && !shownAt(c, hm('1500'), 0, '2026-11-11') && !shownAt(c, hm('0800'), 0, '2026-11-16'), 'day list: in / out');
  // A comma list wrapped after the comma: the second window is read too (not hidden at 1430).
  const d = same(['0800-0900,', '1400-1500'], '0800-0900, 1400-1500', [['2026-11-04', '1430'], ['2026-11-04', '1130']], 'comma list');
  assert.ok(shownAt(d, hm('1430'), 0) && !shownAt(d, hm('1130'), 0), 'wrapped comma list: in / out');
  // Weekday wording is not read (EV-0 G-6, as NavBlue): shown at any time.
  const e = same('MON-FRI 1430-2359', 'MON-FRI 1430-2359', CASES, 'weekdays');
  assert.ok(shownAt(e, hm('0530'), 0), 'weekday schedule: not read → shown');
  // A wrapped cell is never read in pieces: "1630-1800 FRI …" is NOT a daily 1630–1800 schedule.
  const f = fkItem({ ...W, sched: ['MON-THU 0630-0700', '1630-1800 FRI 0630-0700', '1300-1800'] });
  assert.ok(shownAt(f, hm('0645'), 0), 'MON-THU 0630-0700 at 0645Z: shown (the wrapped line is not a daily schedule)');
  const g = fkItem({ ...W, sched: ['09 0000-0900', '2300-2359, 10 0000-1300,'] });
  assert.ok(shownAt(g, hm('0500'), 0, '2026-11-10'), 'per-day list: not read in pieces → shown');
  const h = fkItem({ ...W, sched: ['MON 1100-1400', '2000-2045'] });   // the shape of the L07 OMDW item (§A.5)
  assert.ok(shownAt(h, hm('1200'), 0), 'MON 1100-1400 / 2000-2045 at 1200Z: shown');
  // A body line is never a schedule for a FlightKeys item (it has its own D) cell).
  const i = fkItem({ ...W, body: ['0800-1600 RWY 09/27 CLSD.'] });
  assert.ok(shownAt(i, hm('2000'), 0), 'body line "0800-1600 …" is not read as a schedule');
  // D27: a schedule time that cannot be read is not applied.
  const j = same('2500-2600', '2500-2600', CASES, 'unreadable time');
  assert.ok(shownAt(j, hm('1200'), 0), 'unreadable schedule → shown');
  // The schedule ends at the body: a body line after the cell is not part of it.
  assert.equal(M._fkHeader(fkItem({ ...W, sched: '1800-2200', body: ['RWY 02/20 CLSD DUE TO MAINT.'] })).schedule, '1800-2200');
  assert.equal(M._fkScheduleText(M._fkHeader(fkItem({ ...W, sched: 'DAILY 1600-0800' }))), 'DLY 1600-0800');
});

// ══ TC-171-015 D43 ═══════════════════════════════════════════════════════════

test('TC-171-015 D43: duplicates only by location(s) + ID; different IDs are never merged', () => {
  const W = { start: '2026-Nov-01 00:00', end: '2026-Nov-30 23:59' };
  const ids = r => r.issues.filter(i => i.notamRaw).map(i => { const h = M._fkHeader(i.notamRaw); return `${h.locations.join(' ')} ${h.id}`; });
  const ev = arr => M.evalNotams(arr, 'DEST', hm('1200'), null, D0, 0);
  const a = fkItem({ ...W, loc: 'XXXX XXX', id: 'A0001/26' });
  // POSITIVE: the same NOTAM printed twice → one (even with a different text, e.g. a page break inside).
  assert.deepEqual(ids(ev([a, a])), ['XXXX XXX A0001/26']);
  assert.deepEqual(ids(ev([a, a.replace('CLSD.', 'CLSD.\nPage 1 of 2 x')])), ['XXXX XXX A0001/26']);
  // NEGATIVE: different IDs with the same text → both; same ID at another location → both.
  const b = fkItem({ ...W, loc: 'XXXX XXX', id: 'A0002/26' });
  assert.equal(ids(ev([a, b])).length, 2);
  assert.equal(ids(ev([a, fkItem({ ...W, loc: 'XXXY', id: 'A0001/26' })])).length, 2);
  // No series letter and ASHTAM are IDs too.
  const c = fkItem({ ...W, loc: 'XXX XXXX', id: '0491/26' });
  assert.equal(ids(ev([c, c])).length, 1);
  assert.equal(ids(ev([c, fkItem({ ...W, loc: 'XXX XXXX', id: '0492/26' })])).length, 2);
});

// ══ TC-171-016 D54 ═══════════════════════════════════════════════════════════

test('TC-171-016 D54: the item text is read as delivered; nothing is joined into it or reflowed', () => {
  const W = { start: '2026-Nov-01 00:00', end: '2026-Nov-30 23:59' };
  const items = [
    fkItem({ ...W, id: 'A0001/26', body: ['MIA IAP MIAMI INTL, MIAMI, FL.', 'RNAV (GPS) Y RWY 26L, AMDT 4...', '   LPV DA 266/HAT 257 ALL CATS.'] }),
    fkItem({ ...W, id: 'A0002/26', sched: ['01-03 05-06', '08-10 1430-2100'], body: ['****************', 'ACARS...........YES', '****************'] }),
    fkItem({ ...W, loc: '', id: 'A0003/26', subject: 'XXXX-CURFEW', body: ['B747 CURFEW = 1400-2100Z DAILY', 'B767 CURFEW = 1500-2100Z DAILY'] }),
  ];
  const text = items.join('\n');
  const parts = M._splitNotams(text);
  assert.equal(parts.join(''), text, 'the pieces are the text, in order, byte for byte');
  assert.deepEqual(parts.map(p => p.replace(/\n$/, '')), items);
  const r = M.evalNotams(parts, 'DEST', hm('1500'), null, '2026-11-02', 0);
  for (const i of r.issues) assert.ok(parts.includes(i.notamRaw), 'notamRaw is the item text unchanged');
  // The display line is the first body line, as NavBlue shows its first body line.
  const first = M.evalNotams([items[0]], 'DEST', hm('1500'), null, '2026-11-02', 0).issues[0].text;
  assert.ok(first.includes('MIA IAP MIAMI INTL') && !first.includes('CREATED') && !first.includes('2026-Nov'), 'display line = first body line');
  const co = M.evalNotams([items[2]], 'DEST', hm('1500'), null, '2026-11-02', 0).issues[0].text;
  assert.ok(co.includes('B747 CURFEW') && !co.includes('SUBJECT'), 'Company display line skips SUBJECT:');
  // The content rules read the D) and body lines, never the header rows: an IATA code such as SID in
  // the location cell does not make the NOTAM a SID item (NavBlue headers carry ICAO codes only).
  const sid = fkItem({ ...W, loc: 'XXXX SID', body: ['TWY B CLSD.'] });
  const nbSid = nbItem({ head: NH(), body: ['TWY B CLSD.'] });
  const ra = M.evalNotams([sid], 'ORIG', hm('1500'), null, '2026-11-02', hm('1500')).issues[0];
  const rb = M.evalNotams([nbSid], 'ORIG', hm('1500'), null, '2026-11-02', hm('1500')).issues[0];
  assert.deepEqual([ra.slot, ra.level, ra.label, ra.category], [rb.slot, rb.level, rb.label, rb.category], 'same classification as the NavBlue twin');
  function NH() { return '01NOV0000-30NOV2359'; }
});

// ══ TC-171-020 … 024 the FlightKeys fixtures ═════════════════════════════════

// §A.5 counts (grammar doc), NOTAM Briefing items. Locations: the doc's 7 forms plus the two 5-code
// wrapped cells (L06, L23), whose dates stand above the ID (the doc's line pattern did not count them as
// a location form, nor their UFN end or FL: row: hence UFN 168 → 170 and FL nnn - UNL 31 → 33 here).
const GRAMMAR = {
  items: { NOTAM: 3281, COMPANY: 272, HSCN: 26 },
  locations: { 'IIII': 1871, 'IIII AAA': 807, 'AAA IIII': 474, 'IIII AAA AAA': 32, 'IIII IIII': 51, 'IIII IIII IIII': 33, '7 x IIII': 11, '5 x IIII': 2 },
  companyNoLocation: 186,          // general Company items incl. the 26 HSCN
  ids: { noSeries: 2, ashtam: 4 },
  ends: { DATE: 2653, UFN_EST: 458, UFN: 170 },
  companyEnds: { UFN: 294, DATE: 4 },
  fl: { 'SFC - UNL': 3202, 'SFC - nnn': 224, 'nnn - UNL': 33, 'nnn - nnn': 116 },
  created: 3575,                   // = 3,573 of the doc + the 2 wrapped 5-code items
  schedule: 381, wrapped: 13, headerSplit: 40, headerSplitNotam: 35, cutByPage: 202,
};

function countForms() {
  const c = { items: { NOTAM: 0, COMPANY: 0, HSCN: 0 }, locations: {}, companyNoLocation: 0, ids: { noSeries: 0, ashtam: 0 },
    ends: {}, companyEnds: {}, fl: {}, created: 0, schedule: 0, wrapped: 0, headerSplit: 0, headerSplitNotam: 0, cutByPage: 0,
    perPackage: [], unread: [] };
  const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
  for (const p of fkPackages()) {
    let n = 0, readable = 0, coReadable = 0, coN = 0;
    for (const it of p.items) {
      const h = M._fkHeader(it.text);
      if (!h) { c.unread.push(`${p.label} item on PDF p${it.page}`); continue; }
      c.items[it.kind]++;
      if (h.created) c.created++;
      if (h.fl) inc(c.fl, h.fl.replace(/^FL: /, '').replace(/\d+/g, 'nnn'));
      if (it.headerSplit) { c.headerSplit++; if (it.kind === 'NOTAM') c.headerSplitNotam++; }
      if (it.crossesPage) c.cutByPage++;
      const w = M.xNW_standalone(it.text, p.fx.date);
      if (it.kind !== 'NOTAM') {
        coN++; if (w) coReadable++;
        if (!h.locations.length) c.companyNoLocation++;
        inc(c.companyEnds, h.endKind === 'DATE' ? 'DATE' : 'UFN');
        continue;
      }
      n++; if (w) readable++;
      const form = h.locations.length > 3 && h.locations.every(x => x.length === 4) ? `${h.locations.length} x IIII`
        : h.locations.map(x => x.length === 4 ? 'IIII' : 'AAA').join(' ');
      inc(c.locations, form);
      if (h.id && /^ASHTAM/.test(h.id)) c.ids.ashtam++; else if (h.id && /^\d/.test(h.id)) c.ids.noSeries++;
      inc(c.ends, h.endKind);
      if (h.schedule !== null) c.schedule++;
      if (h.headerRows.length > 2) c.wrapped++;
    }
    c.perPackage.push({ label: p.label, notamItems: n, readableWindow: readable, companyItems: coN, companyReadable: coReadable });
  }
  return c;
}

test('TC-171-020 the 26 FlightKeys fixtures: every §A.5 form counted as in the grammar doc; every item has a readable window', () => {
  const c = countForms();
  assert.equal(fkPackages().length, 26, '26 FlightKeys packages');
  assert.deepEqual(c.unread, [], 'every item header is read');
  assert.deepEqual(c.items, GRAMMAR.items, 'items: NOTAM Briefing, Company, HSCN');
  for (const k of ['locations', 'ids', 'ends', 'companyEnds', 'fl']) {
    assert.deepEqual(Object.fromEntries(Object.entries(c[k]).sort()), Object.fromEntries(Object.entries(GRAMMAR[k]).sort()), k);
  }
  for (const k of ['companyNoLocation', 'created', 'schedule', 'wrapped', 'headerSplit', 'headerSplitNotam', 'cutByPage']) assert.equal(c[k], GRAMMAR[k], k);
  // POSITIVE: every item has a readable window (the 26 packages have no impossible header date).
  for (const r of c.perPackage) {
    assert.equal(r.readableWindow, r.notamItems, `${r.label}: NOTAM items with a readable window`);
    assert.equal(r.companyReadable, r.companyItems, `${r.label}: Company items with a readable window`);
  }
  console.log('TC-171-020 per package: label NOTAM-items readable-window | Company(+HSCN) readable');
  for (const r of c.perPackage) console.log(`  ${r.label.padEnd(4)} ${String(r.notamItems).padStart(4)} ${String(r.readableWindow).padStart(4)} | ${String(r.companyItems).padStart(3)} ${String(r.companyReadable).padStart(3)}`);
  const t = c.perPackage.reduce((a, r) => [a[0] + r.notamItems, a[1] + r.readableWindow, a[2] + r.companyItems, a[3] + r.companyReadable], [0, 0, 0, 0]);
  console.log(`  total ${t[0]} NOTAM items, ${t[1]} with a readable window; ${t[2]} Company/HSCN items, ${t[3]} readable`);
  console.log('TC-171-020 forms: ' + JSON.stringify({ locations: c.locations, ids: c.ids, ends: c.ends, fl: c.fl, schedule: c.schedule, wrapped: c.wrapped, headerSplit: c.headerSplit }));
});

test('TC-171-021 the fixtures: _splitNotams cuts each package exactly at its item headers (no more, no fewer)', () => {
  let n = 0;
  for (const p of fkPackages()) {
    for (const items of [p.items, p.itemsFurniture]) {
      const texts = items.map(i => i.text);
      const joined = texts.join('\n');
      const parts = M._splitNotams(joined);
      assert.equal(parts.length, texts.length, `${p.label}: pieces`);
      assert.equal(parts.join(''), joined, `${p.label}: the pieces are the text (D54)`);
      parts.forEach((x, k) => assert.equal(x.replace(/\n$/, ''), texts[k], `${p.label}: piece ${k} is item ${k}`));
      n += parts.length;
    }
  }
  console.log(`TC-171-021: ${n} items (with and without page furniture) cut exactly at their headers`);
});

test('TC-171-022 header rows split across a page: 40 items read whole; the L07 example', () => {
  let n = 0;
  for (const p of fkPackages()) {
    p.items.forEach((it, k) => {
      if (!it.headerSplit) return;
      n++;
      const a = M._fkHeader(it.text), b = M._fkHeader(p.itemsFurniture[k].text);
      const where = `${p.label} ${a.locations.join(' ')} ${a.id}`;
      assert.ok(a.id && a.created, `${where}: ID and CREATED: read (furniture removed)`);
      assert.deepEqual([b.id, b.start, b.end, b.endKind, b.created, b.fl, b.schedule], [a.id, a.start, a.end, a.endKind, a.created, a.fl, a.schedule],
        `${where}: the same header with the page footer and running header left inside`);
      assert.deepEqual(M.xNW_standalone(p.itemsFurniture[k].text, p.fx.date), M.xNW_standalone(it.text, p.fx.date), `${where}: same window`);
    });
  }
  assert.equal(n, 40);
  // L07 LLBG-OMDW, NOTAM Briefing PDF p13 → p14 (§A.5): row 1 on p13, CREATED:/FL:/SCHEDULE: on p14.
  const l07 = fkPackages().find(p => p.label === 'L07');
  const it = l07.items.find(i => { const h = M._fkHeader(i.text); return h.id === 'A3532/26' && h.locations[0] === 'OMAA'; });
  assert.ok(it && it.headerSplit && it.page === 13, 'L07 OMAA A3532/26 starts at the foot of p13');
  const h = M._fkHeader(it.text);
  assert.deepEqual([h.start, h.end, h.created, h.fl, h.schedule], ['2026-Nov-04 04:30', '2026-Nov-05 06:30', '2026-Nov-03 19:01', 'FL: 60 - 60', '0430-0630']);
  assert.deepEqual(M.xNW_standalone(it.text, l07.fx.date), { startMs: ms('2026-11-04 04:30'), endMs: ms('2026-11-05 06:30') });
  assert.ok(shownAt(it.text, hm('0530'), hm('0300'), '2026-11-04') && !shownAt(it.text, hm('1200'), hm('0300'), '2026-11-04'), 'L07 example: schedule in / out');
});

test('TC-171-023 wrapped location cell (header row desync): 13 items, ID and window read', () => {
  const seen = [];
  for (const p of fkPackages()) for (const it of p.items) {
    if (it.kind !== 'NOTAM') continue;
    const h = M._fkHeader(it.text);
    if (h.headerRows.length <= 2) continue;
    seen.push(`${p.label} ${h.id}`);
    assert.ok(h.id && h.locations.length > 3 && h.created, `${p.label} ${h.id}: ID, ${h.locations.length} locations, CREATED:`);
    assert.ok(M.xNW_standalone(it.text, p.fx.date), `${p.label} ${h.id}: readable window`);
  }
  assert.equal(seen.length, 13);
  assert.deepEqual([...new Set(seen.map(s => s.split(' ')[0]))].sort(), ['L03', 'L06', 'L13', 'L16', 'L17', 'L23', 'T3'], 'packages (§A.5)');
});

test('TC-171-024 FK-P on the matched pair: the same NOTAM gets the same window, and is shown at the same ETAs', () => {
  const dir = requireFixturesDir();
  const DATE = '2026-10-27';
  const nbText = fs.readFileSync(path.join(dir, 'text', 'EOFP_UAAA-EHAM_27OCT26_matchedpair_rev11.raw.txt'), 'utf8').replace(/\r\n/g, '\n');
  const nb = new Map();
  for (const x of M._splitNotams(nbText)) {
    const m = x.match(/^- ((?:[A-Z]{4}\s+)+)([A-Z]\d{1,4}\/\d{2})/);
    if (m) { const k = m[1].trim().split(/\s+/)[0] + ' ' + m[2]; if (!nb.has(k)) nb.set(k, x); }
  }
  const fkm = new Map();
  for (const it of fkPackages().find(p => p.label === 'T1').items) {
    const h = M._fkHeader(it.text);
    const k = (h.locations.find(c => c.length === 4) || '') + ' ' + h.id;
    if (h.id && !fkm.has(k)) fkm.set(k, it.text);
  }
  const prof = AP.buildAcftProfile('B744');
  const etas = []; for (let m = 0; m < 1440; m += 20) etas.push(m);
  let both = 0, sameWindow = 0;
  const shownDiff = [];
  for (const [k, nt] of nb) {
    const ft = fkm.get(k);
    if (!ft) continue;
    both++;
    if (JSON.stringify(effWindow(nt, DATE)) === JSON.stringify(effWindow(ft, DATE))) sameWindow++;
    for (const dep of [0, 600, null]) {
      const bad = etas.find(e => {
        const sn = M.evalNotams([nt], 'DEST', e, prof, DATE, dep, AP.getWingspan).issues.some(i => i.notamRaw === nt);
        const sf = M.evalNotams([ft], 'DEST', e, prof, DATE, dep, AP.getWingspan).issues.some(i => i.notamRaw === ft);
        if (sn !== sf) assert.ok(sf && !sn, `${k}: never hidden in FlightKeys where NavBlue shows it`);
        return sn !== sf;
      });
      if (bad !== undefined) { shownDiff.push(k); break; }
    }
  }
  assert.equal(both, 133, 'NOTAM IDs printed in both packages');
  assert.equal(sameWindow, 133, 'the same window for every one');
  // Known, reviewed: 3 NOTAMs whose D) schedule NavBlue prints wrapped ("… 27" / "0300-1800, 28 0700-1800");
  // the NavBlue schedule reader takes the wrapped line for a daily 0300–1800 schedule and hides them at
  // 0000Z. FlightKeys reads the cell whole, cannot read it, and shows them (fail-safe). NavBlue is locked
  // (D47): reported, not changed.
  assert.deepEqual(shownDiff.sort(), ['LTAA A4767/26', 'LTAA A4769/26', 'LTAA A4770/26']);
  console.log(`TC-171-024: matched pair ${both} NOTAM IDs: ${sameWindow} same window; shown at the same ETAs except ${shownDiff.length} (FlightKeys shows, NavBlue hides: ${shownDiff.join(', ')})`);
});

// ══ TC-171-030 NavBlue unchanged ═════════════════════════════════════════════

// The sweep whose v1.12.0 results are recorded in test/rules/data/notam-v1.12.0-navblue.json.
const SWEEP = { roles: ['ORIG', 'DEST'], etas: [0, 59, 300, 600, 719, 720, 1000, 1380, 1439], deps: [null, 0, 700], group: 40 };
const canonStr = r => JSON.stringify(r, (k, v) => v instanceof Map ? [...v] : v === Infinity ? '$Inf' : v);
function navblueDigest(mod, fx, dir) {
  const text = fs.readFileSync(path.join(dir, fx.files.text), 'utf8').replace(/\r\n/g, '\n');
  const h = crypto.createHash('sha256');
  const parts = mod._splitNotams(text);
  h.update(canonStr(parts.map(p => crypto.createHash('sha256').update(p).digest('hex'))));
  for (const n of parts) h.update(canonStr([mod.xNW_standalone(n, fx.date), mod._windowEndEstimated(n)]));
  const prof = AP.buildAcftProfile(fx.aircraft || '');
  let calls = 0;
  for (let i = 0; i < parts.length; i += SWEEP.group) {
    const grp = parts.slice(i, i + SWEEP.group);
    for (const role of SWEEP.roles) for (const eta of SWEEP.etas) for (const dep of SWEEP.deps) for (const d of [fx.date, null]) {
      h.update(canonStr(mod.evalNotams(grp, role, eta, prof, d, dep, AP.getWingspan)));
      calls++;
    }
  }
  return { digest: h.digest('hex'), notams: parts.length, calls };
}

test('TC-171-030 NavBlue unchanged: no FlightKeys header in any NavBlue text; split and results equal v1.12.0', () => {
  const dir = requireFixturesDir();
  const rec = JSON.parse(fs.readFileSync(RECORD, 'utf8'));
  assert.equal(rec.recordedFrom.sha256, '0d615a13f8cfcb7afc625f825a086d47beedbfc47afa9a7c51f7c47ba9162557', 'recorded from the v1.12.0 file');
  const list = readManifest(dir).fixtures.filter(f => f.format !== 'flightkeys');
  assert.equal(Object.keys(rec.fixtures).length, list.length);
  let notams = 0, calls = 0;
  for (const fx of list) {
    const text = fs.readFileSync(path.join(dir, fx.files.text), 'utf8').replace(/\r\n/g, '\n');
    // The FlightKeys path is never taken for NavBlue text.
    assert.equal(M._fkHeader(text), null, `${fx.id}: no FlightKeys header in the whole text`);
    const parts = M._splitNotams(text);
    for (const x of parts) assert.equal(M._fkHeader(x), null, `${fx.id}: no FlightKeys header in a NOTAM`);
    // The v1.12.0 split rule, verbatim.
    const old = text.split(/^(?=- [A-Z]{4}\b)/m).filter(s => s.trim());
    assert.deepEqual(parts, old.length > 1 ? old : [text], `${fx.id}: split = v1.12.0`);
    const d = navblueDigest(M, fx, dir);
    assert.deepEqual(d, rec.fixtures[fx.id], `${fx.id}: windows and evalNotams() results = v1.12.0 (sweep)`);
    notams += d.notams; calls += d.calls;
  }
  console.log(`TC-171-030: ${list.length} NavBlue/eOFP fixtures, ${notams} NOTAMs, ${calls} evalNotams() calls: identical to v1.12.0`);
});

// ══ TC-171-031 the gate bites ════════════════════════════════════════════════

function variant(edit) {
  const src = edit(MOD_SRC);
  assert.notEqual(src, MOD_SRC, 'the variant edit applied');
  const m = { exports: {} };
  new Function('module', 'exports', 'require', src)(m, m.exports, require);
  return m.exports;
}
test('TC-171-031 the gate bites: broken variants of the FlightKeys code are caught', () => {
  const W = { start: '2026-Nov-01 00:00', end: '2026-Nov-30 23:59' };
  // 1. Schedules read from every line (as NavBlue): the wrapped "1630-1800 …" line hides a NOTAM in effect.
  const v1 = variant(s => s.replace('const schedRaw = fkH ? _fkScheduleText(fkH) : notamRaw;', 'const schedRaw = notamRaw.replace(/^SCHEDULE:/m, "");'));
  const f = fkItem({ ...W, sched: ['MON-THU 0630-0700', '1630-1800 FRI 0630-0700', '1300-1800'] });
  assert.equal(v1.evalNotams([f], 'DEST', hm('0645'), null, D0, 0).issues.some(i => i.notamRaw === f), false, 'variant 1 hides it');
  assert.equal(shownAt(f, hm('0645'), 0), true, 'the module shows it');
  // 2. No FlightKeys header in xNW_standalone: no window for any FlightKeys item (the fixture count fails).
  const v2 = variant(s => s.replace('if (fkH) return _fkWindow(fkH, baseYear);', ''));
  assert.equal(v2.xNW_standalone(fkItem(W), D0), null);
  // 3. UFN(EST) treated as an end: hidden after the estimated date.
  const v3 = variant(s => s.replace("if (fkH) return fkH.endKind === 'UFN_EST';", 'if (fkH) return false;'));
  const e = fkItem({ start: '2026-Nov-01 00:00', end: 'UFN(EST 2026-Nov-02 00:00)' });
  assert.equal(v3.evalNotams([e], 'DEST', hm('1200'), null, D0, 0).issues.some(i => i.notamRaw === e), false, 'variant 3 hides it');
  assert.equal(shownAt(e, hm('1200'), 0), true);
  // 4. An impossible date rolled over (Date.UTC without the T6 check): 31 Nov becomes 01 Dec.
  const v4 = variant(s => s.replace('if (!_validDateParts(yr, mo, dd, hh, mi)) return null;\n  return Date.UTC(yr, mo, dd, hh, mi);\n}\n\n/**\n * The FlightKeys item header', 'return Date.UTC(yr, mo, dd, hh, mi);\n}\n\n/**\n * The FlightKeys item header'));
  assert.notEqual(v4.xNW_standalone(fkItem({ start: '2026-Nov-31 10:00', end: '2026-Dec-02 10:00' }), D0), null, 'variant 4 guesses a date');
  // 5. The NavBlue split cut inside FlightKeys text: a Company body line "- FIRE RESCUE …" becomes an item.
  const v5 = variant(s => s.replace('if (fkStarts.length) return _splitAt(text, fkStarts);', ''));
  const co = fkItem({ ...W, loc: '', subject: 'XXXX-ETOPS', body: ['- FIRE RESCUE PH: 000', '- CHECK OPSPEC'] });
  assert.equal(M._splitNotams([co, co].join('\n')).length, 2);
  assert.notEqual(v5._splitNotams([co, co].join('\n')).length, 2, 'variant 5 splits wrongly');
});

// ══ TC-171-040 ═══════════════════════════════════════════════════════════════

test('TC-171-040 fixtures missing: the fixture tests fail, they are never skipped', () => {
  const saved = process.env.PB_FIXTURES;
  process.env.PB_FIXTURES = path.join(ROOT, 'does-not-exist');
  try { assert.throws(() => requireFixturesDir(), /fixtures not found/); }
  finally { if (saved === undefined) delete process.env.PB_FIXTURES; else process.env.PB_FIXTURES = saved; }
});

// Recording (run once, by hand, from the v1.12.0 file):
//   PB_RECORD_V112=<path to notam-rules-v1.12.0.js> PB_FIXTURES=<fixtures> node test/rules/notam-flightkeys.test.js
if (require.main === module && process.env.PB_RECORD_V112) {
  const file = path.resolve(process.env.PB_RECORD_V112);
  const old = require(file);
  const dir = requireFixturesDir();
  const out = { recordedFrom: { file: 'notam-rules/notam-rules-v1.12.0.js', version: old.RULESET_VERSION,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }, sweep: SWEEP, fixtures: {} };
  for (const fx of readManifest(dir).fixtures.filter(f => f.format !== 'flightkeys')) out.fixtures[fx.id] = navblueDigest(old, fx, dir);
  fs.writeFileSync(RECORD, JSON.stringify(out, null, 1) + '\n');
  console.log(`recorded ${Object.keys(out.fixtures).length} fixtures to ${path.relative(ROOT, RECORD)}`);
}
