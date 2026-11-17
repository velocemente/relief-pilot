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
 *               a guessed or rolled-over date; 24:00 as NavBlue 2400; a header whose date cell
 *               cannot be read still starts its own item (QA F1)
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
 *   TC-171-030  NavBlue unchanged except D61: no FlightKeys header in any NavBlue text; split rule
 *               and windows unchanged; evalNotams() equals v1.12.0's recorded results (sweep) for
 *               every NOTAM except the D61 list (test/reports/NOTAM-v1.13.0-D61-changes.md), each
 *               of which is shown at every sweep point and flagged
 *   TC-171-031  the gate bites: broken variants of the new code are caught
 *   TC-171-040  fixtures missing → the fixture tests FAIL (never skip)
 *   TC-171-101  QA F1 + D61: each of the 17 unreadable / impossible header-date forms, placed
 *               directly after another NOTAM: two items, two IDs; the second shown at every ETA
 *               with the flag; the first unchanged (NEGATIVE: no cut without CREATED:)
 *   TC-171-102  D61: impossible / unreadable date + readable schedule (daily, DAILY, day-range;
 *               FlightKeys and NavBlue) → shown outside the schedule, flagged; readable date +
 *               schedule → unchanged (hidden outside, shown inside, no flag)
 *   TC-171-103  D61: the flag text is escaped like the rest; only NOTAMs with a header (location
 *               and ID) are flagged; content filters and D43 unchanged
 *   TC-171-104  D61: the airport card (src/edit.html renderAptIssues) shows the flag on the
 *               NOTAM's own row, with exactly the markup of an unflagged row (no src/ change)
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
  // QA F1: a header whose date cell cannot be read ("2O26", letter O) but whose location/ID cell reads
  // and whose CREATED: row follows is still a header: the NOTAM stands alone (D43), with no window (T6),
  // shown and flagged (D61). It is never joined to the NOTAM above it (v1.13.0 before F1 joined them).
  const garbled = fkItem({ id: 'A0098/26', start: '2O26-Nov-03 12:00', end: '2026-Nov-05 02:00' });
  const two = M._splitNotams([ok(1), garbled].join('\n'));
  assert.equal(two.length, 2, 'two items');
  assert.deepEqual(two.map(x => M._fkHeader(x).id), ['A0011/26', 'A0098/26'], 'two IDs');
  assert.equal(M._fkHeader(two[1]).dateUnreadable, true);
  assert.equal(M._fkHeader(two[1]).ambiguous, false);
  assert.equal(M.xNW_standalone(two[1], D0), null);
  const r2 = M.evalNotams(two, 'DEST', hm('1200'), null, D0, hm('0800'));
  assert.deepEqual(r2.issues.filter(i => i.notamRaw).map(i => [M._fkHeader(i.notamRaw).id, i.dateUnreadable]), [['A0098/26', true]],
    'only the unreadable NOTAM is shown, flagged');
  // NEGATIVE: the readable neighbour keeps its own window and stays hidden.
  assert.ok(!shownAt(two[0], hm('1200'), hm('0800')));
  assert.deepEqual(M.xNW_standalone(two[0], D0), M.xNW_standalone(ok(1), D0));
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
// D61 (Exec, 16 Nov): the NOTAMs v1.13.0 flags (its own date range cannot be read: a NOTAM header and no
// window) — piece indexes of the split. Their results change by design (always shown, flagged); every
// other NOTAM is compared with v1.12.0. Recorded with the digests; listed in the report.
function d61Indexes(mod, fx, parts) {
  const prof = AP.buildAcftProfile(fx.aircraft || '');
  return parts.map((x, k) => mod.evalNotams([x], 'DEST', null, prof, fx.date, null, AP.getWingspan).issues
    .some(i => i.dateUnreadable) ? k : -1).filter(k => k >= 0);
}
function navblueDigest(mod, fx, dir, skip = []) {
  const text = fs.readFileSync(path.join(dir, fx.files.text), 'utf8').replace(/\r\n/g, '\n');
  const h = crypto.createHash('sha256');
  const all = mod._splitNotams(text);
  h.update(canonStr(all.map(p => crypto.createHash('sha256').update(p).digest('hex'))));
  for (const n of all) h.update(canonStr([mod.xNW_standalone(n, fx.date), mod._windowEndEstimated(n)]));
  const parts = all.filter((_, k) => !skip.includes(k));   // D61 NOTAMs out of the evalNotams() sweep
  const prof = AP.buildAcftProfile(fx.aircraft || '');
  let calls = 0;
  for (let i = 0; i < parts.length; i += SWEEP.group) {
    const grp = parts.slice(i, i + SWEEP.group);
    for (const role of SWEEP.roles) for (const eta of SWEEP.etas) for (const dep of SWEEP.deps) for (const d of [fx.date, null]) {
      h.update(canonStr(mod.evalNotams(grp, role, eta, prof, d, dep, AP.getWingspan)));
      calls++;
    }
  }
  return { digest: h.digest('hex'), notams: all.length, calls, d61: skip };
}

// The D61 list on the NavBlue/eOFP fixtures (= test/reports/NOTAM-v1.13.0-D61-changes.md): fixture,
// location, NOTAM ID. All print the date range in a form the rules cannot read (the start year after
// the start time, "07JAN0000 2026-…"), so they had no window and were already shown at every ETA.
const D61_NAVBLUE = [
  'EOFP_KMIA-EHAM_06SEP26_pkgA_rev7 KMIA A3337/25', 'EOFP_KMIA-EHAM_06SEP26_pkgA_rev7 KMIA A3340/25',
  'NB_ELLX-KHSV_08MAR26_baseline_rev16 LPPO A6120/25',
  'NB_KCHS-LIBG_12MAR26_lcf_rev16 LIRR W5239/25',
  'NB_KMIA-EHAM_12MAR26_etp_rev8 KMIA A3337/25', 'NB_KMIA-EHAM_12MAR26_etp_rev8 KMIA A3340/25', 'NB_KMIA-EHAM_12MAR26_etp_rev8 LPPO A6120/25',
  'NB_KORD-RJAA_05APR26_tempcontrol_rev8 KZMP A0144/22', 'NB_KORD-RKSI_08APR26_catii_rev14 KZMP A0144/22',
  'NB_KORD-RKSI_31MAY26_altroute_rev10 KZMP A0144/22',
  'NB_LTFM-EBLG_11MAR26_thy_rev10 LTBB A5825/25', 'NB_LTFM-EBLG_11MAR26_thy_rev10 LTBB A5826/25', 'NB_LTFM-EBLG_11MAR26_thy_rev10 LTBB A5829/25',
  'NB_PANC-KORD_10APR26_maxldgw_rev6 KZMP A0144/22',
];

test('TC-171-030 NavBlue unchanged except D61: no FlightKeys header; split, windows and results equal v1.12.0 except the D61 list', () => {
  const dir = requireFixturesDir();
  const rec = JSON.parse(fs.readFileSync(RECORD, 'utf8'));
  assert.equal(rec.recordedFrom.sha256, '0d615a13f8cfcb7afc625f825a086d47beedbfc47afa9a7c51f7c47ba9162557', 'recorded from the v1.12.0 file');
  const list = readManifest(dir).fixtures.filter(f => f.format !== 'flightkeys');
  assert.equal(Object.keys(rec.fixtures).length, list.length);
  let notams = 0, calls = 0, flagCalls = 0;
  const d61 = [];
  for (const fx of list) {
    const text = fs.readFileSync(path.join(dir, fx.files.text), 'utf8').replace(/\r\n/g, '\n');
    // The FlightKeys path is never taken for NavBlue text.
    assert.equal(M._fkHeader(text), null, `${fx.id}: no FlightKeys header in the whole text`);
    const parts = M._splitNotams(text);
    for (const x of parts) assert.equal(M._fkHeader(x), null, `${fx.id}: no FlightKeys header in a NOTAM`);
    // The v1.12.0 split rule, verbatim.
    const old = text.split(/^(?=- [A-Z]{4}\b)/m).filter(s => s.trim());
    assert.deepEqual(parts, old.length > 1 ? old : [text], `${fx.id}: split = v1.12.0`);
    // D61: the flagged NOTAMs are exactly the recorded ones; each is shown at every sweep point, flagged.
    const skip = d61Indexes(M, fx, parts);
    assert.deepEqual(skip, rec.fixtures[fx.id].d61, `${fx.id}: D61 NOTAMs = the recorded list`);
    const prof = AP.buildAcftProfile(fx.aircraft || '');
    for (const k of skip) {
      const x = parts[k], m = x.match(/^\s*-\s+((?:[A-Z]{4}\s+)+)([A-Z]\d{1,4}\/\d{2})/);
      d61.push(`${fx.id} ${m[1].trim().split(/\s+/).join(' ')} ${m[2]}`);
      assert.equal(M.xNW_standalone(x, fx.date), null, `${fx.id} #${k}: no window (T6)`);
      for (const role of SWEEP.roles) for (const eta of [...SWEEP.etas, null]) for (const dep of SWEEP.deps) for (const dd of [fx.date, null]) {
        const it = M.evalNotams([x], role, eta, prof, dd, dep, AP.getWingspan).issues.find(i => i.notamRaw === x);
        assert.ok(it && it.dateUnreadable === true && it.text.startsWith(M.DATE_UNREADABLE_FLAG + ' — ') && it.rowLabel.startsWith(M.DATE_UNREADABLE_FLAG),
          `${fx.id} #${k}: shown and flagged (${role} ${eta} ${dep} ${dd})`);
        flagCalls++;
      }
    }
    // Every other NOTAM: windows and evalNotams() results = v1.12.0 (sweep).
    const d = navblueDigest(M, fx, dir, skip);
    assert.deepEqual(d, rec.fixtures[fx.id], `${fx.id}: windows and evalNotams() results = v1.12.0 (sweep), D61 NOTAMs aside`);
    notams += d.notams; calls += d.calls;
  }
  assert.deepEqual(d61.sort(), [...D61_NAVBLUE].sort(), 'the D61 list (report)');
  console.log(`TC-171-030: ${list.length} NavBlue/eOFP fixtures, ${notams} NOTAMs, ${calls} evalNotams() calls: identical to v1.12.0 except the ${d61.length} D61 NOTAMs, each shown and flagged in ${flagCalls / d61.length} of ${flagCalls / d61.length} calls`);
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

// ══ TC-171-101 … 104 QA F1 and Exec decision D61 ═════════════════════════════

// A FlightKeys item with row 1's date cell exactly as given (it may be unreadable).
function fkRaw({ loc = 'XXXX', id = 'A0099/26', cell, sched = null, body = ['RWY 09/27 CLSD.'] }) {
  const lines = [`${loc ? loc + '            ' : ''}${id}        ${cell}`, 'CREATED:2026-Nov-01 00:00       FL: SFC - UNL'];
  if (sched !== null) [].concat(sched).forEach((x, i) => lines.push(i ? x : 'SCHEDULE:' + x));
  return [...lines, ...body].join('\n');
}
const FLAGGED = it => !!it && it.dateUnreadable === true && it.text.startsWith(M.DATE_UNREADABLE_FLAG + ' — ') &&
  it.rowLabel.startsWith(M.DATE_UNREADABLE_FLAG);
// The 9 unreadable header-date forms of the QA (§4, F1) and the 8 impossible ones (§4).
const UNREADABLE_FORMS = [
  ['no colon',            '2026-Nov-04 0700 - 2026-Nov-04 11:00'],
  ['numeric month',       '2026-11-04 07:00 - 2026-11-04 11:00'],
  ['day first',           '04-Nov-2026 07:00 - 04-Nov-2026 11:00'],
  ['PERM',                '2026-Nov-04 07:00 - PERM'],
  ['UNK',                 '2026-Nov-04 07:00 - UNK'],
  ['UFN EST, no brackets', '2026-Nov-04 07:00 - UFN EST 2026-Nov-05 00:00'],
  ['trailing EST',        '2026-Nov-04 07:00 - 2026-Nov-04 11:00 EST'],
  ['no end',              '2026-Nov-04 07:00 -'],
  ['en dash',             '2026-Nov-04 07:00 – 2026-Nov-04 11:00'],
];
const IMPOSSIBLE_FORMS = [
  ['30 Feb',              '2026-Feb-30 10:00 - 2026-Mar-02 10:00'],
  ['29 Feb non-leap',     '2026-Feb-29 10:00 - 2026-Mar-02 10:00'],
  ['31 Nov',              '2026-Nov-31 10:00 - 2026-Dec-02 10:00'],
  ['25:00',               '2026-Nov-04 25:00 - 2026-Nov-05 02:00'],
  ['12:60',               '2026-Nov-04 12:60 - 2026-Nov-05 02:00'],
  ['month Abc',           '2026-Abc-04 07:00 - 2026-Nov-05 02:00'],
  ['backwards window',    '2026-Nov-05 12:00 - 2026-Nov-03 02:00'],
  ['impossible EST',      '2026-Nov-04 07:00 - UFN(EST 2026-Feb-30 10:00)'],
];
// The sweep: every 30 min of the day and no ETA, three flight dates (incl. none), three OUT times
// (incl. unknown), both roles.
function* sweep() {
  for (const date of [D0, '2026-11-05', null]) for (const dep of [0, hm('1200'), null]) for (const role of ['DEST', 'ORIG']) {
    for (let eta = 0; eta < 1440; eta += 30) yield { date, dep, role, eta };
    yield { date, dep, role, eta: null };
  }
}

test('TC-171-101 F1 + D61: each unreadable / impossible header date, directly after another NOTAM: two items, two IDs; it is shown at every ETA, flagged; the first is unchanged', () => {
  // The first NOTAM: readable window (04 NOV 06:00–18:00) and a daily schedule 0800-1000. It is shown at
  // some ETAs and hidden at others; joined with the next item (as before F1) it would be shown at all.
  const first = fkItem({ id: 'A0010/26', start: '2026-Nov-04 06:00', end: '2026-Nov-04 18:00', sched: '0800-1000', body: ['TWY A CLSD.'] });
  let points = 0;
  for (const [what, cell] of [...UNREADABLE_FORMS, ...IMPOSSIBLE_FORMS]) {
    const second = fkRaw({ id: 'A0099/26', cell });
    const text = [first, second].join('\n');
    const parts = M._splitNotams(text);
    // Two items, two IDs (D43); the pieces are the text (D54).
    assert.equal(parts.length, 2, `${what}: two items`);
    assert.equal(parts.join(''), text, `${what}: the pieces are the text`);
    assert.deepEqual(parts.map(x => M._fkHeader(x).id), ['A0010/26', 'A0099/26'], `${what}: two IDs`);
    assert.equal(M._fkHeader(parts[1]).ambiguous, false, `${what}: one item per text`);
    assert.equal(M.xNW_standalone(parts[1], D0), null, `${what}: no window (T6), no date guessed`);
    assert.deepEqual(M.xNW_standalone(parts[0], D0), { startMs: ms('2026-11-04 06:00'), endMs: ms('2026-11-04 18:00') }, `${what}: the first keeps its window`);
    let firstShown = 0, firstHidden = 0;
    for (const p of sweep()) {
      points++;
      const r = M.evalNotams(parts, p.role, p.eta, null, p.date, p.dep);
      const where = `${what}: ${p.role} ETA ${p.eta} OUT ${p.dep} ${p.date}`;
      // The second: shown at every ETA, flagged.
      const s2 = r.issues.filter(i => i.notamRaw === parts[1]);
      assert.equal(s2.length, 1, `${where}: the unreadable NOTAM is shown`);
      assert.ok(FLAGGED(s2[0]), `${where}: and flagged`);
      // The first: exactly as when it is evaluated alone, and never flagged.
      const s1 = r.issues.find(i => i.notamRaw === parts[0]) || null;
      const alone = M.evalNotams([parts[0]], p.role, p.eta, null, p.date, p.dep).issues.find(i => i.notamRaw === parts[0]) || null;
      assert.deepEqual(s1, alone, `${where}: the first NOTAM is unchanged`);
      if (s1) { firstShown++; assert.ok(!('dateUnreadable' in s1) && !s1.text.includes(M.DATE_UNREADABLE_FLAG), `${where}: the first is not flagged`); }
      else firstHidden++;
    }
    assert.ok(firstShown > 0 && firstHidden > 0, `${what}: the first keeps its window and schedule (shown ${firstShown}, hidden ${firstHidden})`);
  }
  // The same with the location cell wrapped (5 codes, the ID on a row of its own: header row desync).
  const wrapped = ['XXXA XXXB XXXC   2026-Nov-04 07:00 - PERM', 'A0098/26', 'XXXD XXXE    FL: 195 - UNL', 'CREATED:2026-Nov-01 00:00', 'RWY 09/27 CLSD.'].join('\n');
  const pw = M._splitNotams([first, wrapped].join('\n'));
  assert.deepEqual(pw.map(x => M._fkHeader(x).id), ['A0010/26', 'A0098/26'], 'wrapped cell: two IDs');
  assert.deepEqual(M._fkHeader(pw[1]).locations, ['XXXA', 'XXXB', 'XXXC', 'XXXD', 'XXXE']);
  assert.ok(FLAGGED(M.evalNotams(pw, 'DEST', hm('1500'), null, D0, 0).issues.find(i => i.notamRaw === pw[1])), 'wrapped cell: shown, flagged');
  // A Company item (no location) and a page footer + running header between row 1 and CREATED: (§A.5).
  const co = ['                A0929/26        2026-Nov-03 00:00 - PERM', 'Page 3 of 8 00000000-0000-0000-0000-000000000000',
    'GTI000 / XXXX - XXXY / 2026-11-04 / N000XX 2026-Nov-04 08:17', 'CREATED:2026-Nov-03 00:14       FL: SFC - UNL', 'SUBJECT: XXXX-CURFEW', 'CURFEW TEXT'].join('\n');
  const pc = M._splitNotams([first, co].join('\n'));
  assert.deepEqual(pc.map(x => M._fkHeader(x).id), ['A0010/26', 'A0929/26'], 'Company item, header split by a page: two IDs');
  // NEGATIVE: no cut without the CREATED: row (a body line naming another NOTAM), nor across another row 1.
  const bodyRef = fkItem({ id: 'A0011/26', start: '2026-Nov-01 00:00', end: '2026-Nov-30 23:59', body: ['SEE ALSO', 'XXXX A0002/26 2026 TEXT', 'RWY 09/27 CLSD.'] });
  assert.equal(M._splitNotams([bodyRef, first].join('\n')).length, 2, 'a body line "XXXX A0002/26 2026 …" is not a header');
  const lastLine = fkItem({ id: 'A0012/26', start: '2026-Nov-01 00:00', end: '2026-Nov-30 23:59', body: ['XXXX A0003/26 12 NM'] });
  assert.equal(M._splitNotams([lastLine, first].join('\n')).length, 2, 'a last body line before the next header is not a header');
  assert.equal(M._fkHeader('XXXX A0099/26   2026-Nov-04 07:00 - PERM\nRWY 09/27 CLSD.'), null, 'no CREATED: row → not a header');
  console.log(`TC-171-101: ${UNREADABLE_FORMS.length} unreadable + ${IMPOSSIBLE_FORMS.length} impossible header-date forms, ${points} evaluations: two items each, the second shown and flagged at every one, the first unchanged`);
});

test('TC-171-102 D61: an impossible / unreadable date with a readable schedule is shown outside the schedule, flagged; a readable date with a schedule is unchanged', () => {
  const at = (t, eta, date = D0, dep = hm('0700')) => M.evalNotams([t], 'DEST', hm(eta), null, date, dep).issues.find(i => i.notamRaw === t) || null;
  // POSITIVE (D61): the schedule says 0800-1000; at 1500Z (outside it) the NOTAM is still shown, flagged.
  const bad = [
    ['FK 30 Feb + SCHEDULE: hhmm-hhmm',  fkRaw({ cell: '2026-Feb-30 10:00 - 2026-Mar-02 10:00', sched: '0800-1000' })],
    ['FK 30 Feb + SCHEDULE: DAILY',      fkRaw({ cell: '2026-Feb-30 10:00 - 2026-Mar-02 10:00', sched: 'DAILY 0800-1000' })],
    ['FK 30 Feb + day-range schedule',   fkRaw({ cell: '2026-Feb-30 10:00 - 2026-Mar-02 10:00', sched: '04-05 0800-1000' })],
    ['FK 25:00 + DAILY',                 fkRaw({ cell: '2026-Nov-04 25:00 - 2026-Nov-05 02:00', sched: 'DAILY 0800-1000' })],
    ['FK backwards + DAILY',             fkRaw({ cell: '2026-Nov-05 12:00 - 2026-Nov-03 02:00', sched: 'DAILY 0800-1000' })],
    ['FK PERM (unreadable) + DAILY',     fkRaw({ cell: '2026-Nov-04 07:00 - PERM', sched: 'DAILY 0800-1000' })],
    ['FK en dash (unreadable) + day-range', fkRaw({ cell: '2026-Nov-04 07:00 – 2026-Nov-30 11:00', sched: '04-05 0800-1000' })],
    ['NavBlue 30FEB + DLY',              nbItem({ head: '30FEB1000-02MAR1000', sched: 'DLY 0800-1000' })],
    ['NavBlue 30FEB + bare hhmm-hhmm',   nbItem({ head: '30FEB1000-02MAR1000', sched: '0800-1000' })],
    ['NavBlue 30FEB + day-range',        nbItem({ head: '30FEB1000-02MAR1000', sched: '04-05 0800-1000' })],
    ['NavBlue backwards + DLY',          nbItem({ head: '05NOV1200-03NOV0200', sched: 'DLY 0800-1000' })],
    ['NavBlue B)/C) 2500 + DLY',         nbItem({ head: 'B) 2611042500 C) 2611050200', sched: 'DLY 0800-1000' })],
  ];
  for (const [what, t] of bad) {
    assert.equal(M.xNW_standalone(t, D0), null, `${what}: no window`);
    for (const eta of ['1500', '0300', '2200', '0900']) assert.ok(FLAGGED(at(t, eta)), `${what}: shown at ${eta}Z, flagged`);
    assert.ok(FLAGGED(at(t, '1500', '2026-11-20')), `${what}: shown on another day, flagged`);
    assert.ok(FLAGGED(M.evalNotams([t], 'ORIG', null, null, null, null).issues[0]), `${what}: no ETA, no flight date: shown, flagged`);
  }
  // NEGATIVE: a readable date with the same schedules → the schedule still applies; no flag.
  const good = [
    ['FK SCHEDULE: hhmm-hhmm', fkItem({ start: '2026-Nov-01 00:00', end: '2026-Nov-30 23:59', sched: '0800-1000' })],
    ['FK SCHEDULE: DAILY',     fkItem({ start: '2026-Nov-01 00:00', end: '2026-Nov-30 23:59', sched: 'DAILY 0800-1000' })],
    ['FK PERM-style UFN + DAILY', fkItem({ start: '2026-Nov-01 00:00', end: 'UFN', sched: 'DAILY 0800-1000' })],
    ['NavBlue DLY',            nbItem({ head: '01NOV0000-30NOV2359', sched: 'DLY 0800-1000' })],
    ['NavBlue bare hhmm-hhmm', nbItem({ head: '01NOV0000-30NOV2359', sched: '0800-1000' })],
  ];
  for (const [what, t] of good) {
    assert.equal(at(t, '1500'), null, `${what}: hidden at 1500Z (outside the schedule)`);
    const i = at(t, '0900');
    assert.ok(i && !('dateUnreadable' in i) && !i.text.includes(M.DATE_UNREADABLE_FLAG) && !i.rowLabel.includes(M.DATE_UNREADABLE_FLAG), `${what}: shown at 0900Z, not flagged`);
  }
  for (const [what, t] of [['FK day-range', fkItem({ start: '2026-Nov-01 00:00', end: '2026-Nov-30 23:59', sched: '04-05 0800-1000' })],
                           ['NavBlue day-range', nbItem({ head: '01NOV0000-30NOV2359', sched: '04-05 0800-1000' })]]) {
    assert.ok(at(t, '0900') && !at(t, '0900').dateUnreadable, `${what}: shown on 04 NOV 0900Z, not flagged`);
    assert.equal(at(t, '0900', '2026-11-10'), null, `${what}: hidden on 10 NOV (not a listed day)`);
    assert.equal(at(t, '1500'), null, `${what}: hidden at 1500Z`);
  }
  // NEGATIVE: a readable window that has ended → hidden (the window rule is unchanged; only T6 is shown).
  assert.equal(at(fkItem({ start: '2026-Oct-01 00:00', end: '2026-Nov-01 00:00' }), '1200'), null);
  assert.equal(at(nbItem({ head: '01OCT0000-01NOV0000' }), '1200'), null);
});

test('TC-171-103 D61: the flag is escaped like the rest; only NOTAMs with a header are flagged; filters and D43 unchanged', () => {
  const ev = (arr, eta = hm('1500')) => M.evalNotams(arr, 'DEST', eta, null, D0, hm('0700')).issues.filter(i => i.notamRaw);
  assert.equal(M.DATE_UNREADABLE_FLAG, 'DATE NOT READABLE – CHECK NOTAM');
  // The display text is HTML: flag and body escaped (rule 2); rowLabel is plain text (the card escapes it).
  const t = fkRaw({ cell: '2026-Nov-04 07:00 - PERM', body: ['RWY 09/27 CLSD <B> & X.'] });
  const [i] = ev([t]);
  assert.ok(i.text.startsWith('DATE NOT READABLE – CHECK NOTAM — '), 'flag first');
  assert.ok(i.text.includes('&lt;B&gt; &amp; X') && !i.text.includes('<B>'), 'body escaped');
  assert.ok(i.rowLabel.startsWith('DATE NOT READABLE – CHECK NOTAM — '), 'row label');
  const nb = ev([nbItem({ head: '30FEB1000-02MAR1000', body: ['RWY 09/27 CLSD <B>.'] })])[0];
  assert.ok(FLAGGED(nb) && nb.text.includes('&lt;B&gt;'), 'NavBlue: flagged, escaped');
  // NEGATIVE: an item with no NOTAM header (no ID) and no date has no date range of its own → not
  // flagged, and its schedule line still applies, as before (NavBlue "- XXXX …" text).
  const noId = '- XXXX INFO LAST VERIFIED 06-JAN-22\nRWY 09/27 CLSD.';
  assert.ok(ev([noId]).length === 1 && !ev([noId])[0].dateUnreadable, 'no ID: shown, not flagged');
  const noIdSched = '- XXXX RWY 09/27 CLSD.\nDLY 0800-1000';
  assert.equal(ev([noIdSched]).length, 0, 'no ID + DLY: hidden at 1500Z as before');
  // NEGATIVE: the content filters are not windows or schedules and still apply (obstacle with no approach
  // or departure keyword).
  assert.equal(ev([fkRaw({ cell: '2026-Nov-04 07:00 - PERM', body: ['CRANE 250FT AGL 1NM E OF AD.'] })]).length, 0, 'obstacle filter unchanged');
  // D43: the same NOTAM twice → one item; different IDs → both, each flagged.
  const a = fkRaw({ id: 'A0101/26', cell: '2026-Nov-04 07:00 - PERM' }), b = fkRaw({ id: 'A0102/26', cell: '2026-Nov-04 07:00 - PERM' });
  assert.equal(ev(M._splitNotams([a, a].join('\n'))).length, 1, 'same ID: one');
  const two = ev(M._splitNotams([a, b].join('\n')));
  assert.equal(two.length, 2, 'different IDs: two');
  assert.ok(two.every(FLAGGED), 'both flagged');
});

test('TC-171-104 D61: the airport card shows the flag on the NOTAM\'s own row, with the markup of an unflagged row (no src/ change)', () => {
  const { loadApp } = require('../harness');
  const app = loadApp();
  // QUOTED (src/edit.html renderNotamGroups _renderItem): the row text is
  //   const lbl = esc(item.rowLabel || item.label || '');  …  <span class="notam-item-label">${lbl}</span>
  const card = t => {
    const r = app.evalNotams([t], 'DEST', hm('1500'), null, D0, hm('0700'));
    return app.renderAptIssues({ rwyGroups: r.rwyGroups, sidIssues: r.sidIssues || [], starIssues: r.starIssues || [], wxIssues: [] });
  };
  const body = ['RWY 09/27 CLSD <B>.'];
  const flagged = card(fkRaw({ cell: '2026-Nov-04 07:00 - PERM', body }));
  const plain   = card(fkItem({ id: 'A0099/26', start: '2026-Nov-01 00:00', end: '2026-Nov-30 23:59', body }));
  assert.ok(flagged.includes('<span class="notam-item-label">DATE NOT READABLE – CHECK NOTAM — '), 'the flag on the NOTAM row');
  assert.ok(!plain.includes('DATE NOT READABLE'), 'NEGATIVE: no flag on a readable NOTAM');
  // Same elements, classes and order: only the text differs (no new element, no layout change).
  const skeleton = h => h.replace(/>[^<]*</g, '><').replace(/>[^<]*$/, '>');
  assert.equal(skeleton(flagged), skeleton(plain), 'the same markup as an unflagged row');
  assert.ok(!flagged.includes('<B>'), 'escaped');
  // The NavBlue twin is rendered the same way.
  const nbFlag = card(nbItem({ head: '30FEB1000-02MAR1000', body }));
  assert.ok(nbFlag.includes('<span class="notam-item-label">DATE NOT READABLE – CHECK NOTAM — '), 'NavBlue: the flag on the row');
});

// ══ TC-171-040 ═══════════════════════════════════════════════════════════════

test('TC-171-040 fixtures missing: the fixture tests fail, they are never skipped', () => {
  const saved = process.env.PB_FIXTURES;
  process.env.PB_FIXTURES = path.join(ROOT, 'does-not-exist');
  try { assert.throws(() => requireFixturesDir(), /fixtures not found/); }
  finally { if (saved === undefined) delete process.env.PB_FIXTURES; else process.env.PB_FIXTURES = saved; }
});

// Recording (run once, by hand, from the v1.12.0 file; the D61 indexes come from this module):
//   PB_RECORD_V112=<path to notam-rules-v1.12.0.js> PB_FIXTURES=<fixtures> node test/rules/notam-flightkeys.test.js
if (require.main === module && process.env.PB_RECORD_V112) {
  const file = path.resolve(process.env.PB_RECORD_V112);
  const old = require(file);
  const dir = requireFixturesDir();
  const out = { recordedFrom: { file: 'notam-rules/notam-rules-v1.12.0.js', version: old.RULESET_VERSION,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }, sweep: SWEEP, fixtures: {} };
  // D61: the NOTAMs v1.13.0 flags (this module, M) are left out of v1.12.0's evalNotams() sweep.
  out.d61 = { from: MANIFEST['notam-rules'].file, note: 'piece indexes of the NOTAMs v1.13.0 flags (D61), left out of the evalNotams() sweep' };
  for (const fx of readManifest(dir).fixtures.filter(f => f.format !== 'flightkeys')) {
    const text = fs.readFileSync(path.join(dir, fx.files.text), 'utf8').replace(/\r\n/g, '\n');
    out.fixtures[fx.id] = navblueDigest(old, fx, dir, d61Indexes(M, fx, M._splitNotams(text)));
  }
  fs.writeFileSync(RECORD, JSON.stringify(out, null, 1) + '\n');
  console.log(`recorded ${Object.keys(out.fixtures).length} fixtures to ${path.relative(ROOT, RECORD)}`);
}
