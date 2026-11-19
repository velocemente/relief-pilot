'use strict';
/**
 * TC-163 — FlightKeys OFP parser v0.4.0 (rules/ofp-flightkeys, development version, D58; step 5d-2):
 * airport NOTAM type headings for NOTAM v1.14.0 (D67), Company NOTAMs, curfews, ops notes, FIR NOTAMs
 * (items + raw, D64), hazards, NAT / PACOTS. Exec answers O-33 … O-45 (19 Nov 2026).
 *
 *   TC-163-001  v0.3.0 byte-identical on all 26: every v0.3.0 field, airport value and finding equal the
 *               recorded v0.3.0 output, except the declared changes (scope 0–6) — listed exactly
 *   TC-163-002  scope 0 (D67): notams keeps the printed type headings; v1.14.0 on all 26 at no window and
 *               each role window: every item shown / hidden as with v0.3.0's text, except the OBSTACLE-
 *               category items of the 5c-2 change list v1.2
 *   TC-163-010  Company NOTAMs, synthetic: ID, SUBJECT, location / GENERAL, severity, origin, text with its
 *               line breaks; the "Contact Dispatch" line in no item; the P0110-type pair kept; no ruleset
 *   TC-163-011  Company NOTAMs on all 26: 298 = 26 HSCN + 272; per package = grammar §A.2; texts = the
 *               independent reading; source positions; the pinned values (fixtures expected/)
 *   TC-163-020  curfews, synthetic, positive and negative (CLAUDE.md rule 6): O-33 type table, registration
 *               never matched, no line for the type; O-34 dated season / changeover month / undated;
 *               O-35 LCL bracket; O-36 departure-only; O-37 CURFEW key only; no new airport entry; the
 *               app's window reader reads exactly the UTC windows (no digits in a note)
 *   TC-163-021  curfews on all 26: 16 CURFEW items in 10 packages; each read; the pinned strings; the
 *               5 curfew-like items under other keys named in an INFO
 *   TC-163-030  FIR NOTAMs, synthetic: blocks, items, categories, headings out of the text, block name before
 *               its items, empty blocks omitted + INFO, firRaw as printed, FIR-keyed Company item (O-40)
 *   TC-163-031  FIR NOTAMs on all 26: 221 blocks, 989 items, 43 empty, 4 items with no heading; repeats kept;
 *               items = the independent reading; firRaw every item once under its heading, no Company item
 *   TC-163-040  hazards, synthetic and on all 26: 221 blocks, 66 empty, 1,980 products (grammar §A.9);
 *               as printed; never in airport weather, weatherRaw or E-WINS
 *   TC-163-050  NAT, synthetic: messages across pages; direction first, then the higher TMI; unreadable TMI
 *               lowest + WARN; equal TMI a finding only if same direction and validity; one direction →
 *               crew-alert WARN; filed track from the route string only; no NAT parser
 *   TC-163-051  NAT on all 26: 5 packages, 6 messages, complete; L12 307 returned (308 in natMessages[]);
 *               L08 / L22 one direction → WARN; L11 filed track; the pinned values
 *   TC-163-060  PACOTS: synthetic (wrapped headline, sets, natTrack null) and on all 26: 38 items, 13 sets,
 *               10 packages
 *   TC-163-070  ops notes, synthetic (O-38 repeat suppressed / one extra word kept; O-39 body; curfew item
 *               out; no new entry) and on all 26 (3 repeats; the pinned values)
 *   TC-163-090  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Synthetic packages use invented identifiers (KAAA, KBBB, KXXX …). Fixture tests assert counts, package
 * labels, ICAO codes, NOTAM IDs and hashes; the fixture values themselves are in the private fixtures repo
 * (expected/ofp-flightkeys-v0.4.0/). No fixture text is printed or asserted here.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const vm     = require('vm');
const { spawnSync } = require('child_process');
const { findFixtures, readManifest } = require('../lib/app-path');
const fkb = require('../lib/fk-briefing');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const mod      = require(path.join(RULES, MANIFEST['ofp-flightkeys'].file));
const icaoFpl  = require(path.join(RULES, MANIFEST['icao-fpl'].file));
const acProf   = require(path.join(RULES, MANIFEST['aircraft-profile'].file));
const NR       = require(path.join(RULES, MANIFEST['notam-rules'].file));        // v1.13.0 (the parser's splitter)
const NR14     = require(path.join(RULES, MANIFEST['notam-rules-next'].file));   // v1.14.0 (D67)
const BASE     = require('./data/ofp-flightkeys-v0.3.0-baseline.json');
const CHANGES  = require('./data/notam-v1.14.0-obstacle-changes.json');
const GRAMMAR  = fs.readFileSync(path.join(ROOT, 'docs', 'RPT-OFP-FlightKeys-BriefingGrammar-UPD-20261118-v1.1.md'), 'utf8');
const EXPECTED_FILE = path.join('expected', 'ofp-flightkeys-v0.4.0', 'briefing.json');

// The app's own NAT track parser (src/nat.html, window.parseNatTrack) and curfew window reader
// (src/render-descent.html parseCurfewWindows), loaded unchanged.
const appWin = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'nat.html'), 'utf8'), { window: appWin });
const parseNatTrack = appWin.parseNatTrack;
const descent = fs.readFileSync(path.join(ROOT, 'src', 'render-descent.html'), 'utf8');
const parseCurfewWindows = vm.runInNewContext(/function parseCurfewWindows[\s\S]*?\n}\n/.exec(descent)[0] + '; parseCurfewWindows');
const OPTS = { icaoFpl, aircraftProfile: acProf, notamRules: NR, parseNatTrack };

const sha   = s => crypto.createHash('sha256').update(s).digest('hex');
const warns = (r, re) => r.findings.filter(f => f.level === 'WARN' && (!re || re.test(f.field)));
const infos = (r, re) => r.findings.filter(f => f.level === 'INFO' && (!re || re.test(f.field)));
const isHeadingLine = l => /^\s{21,}\S/.test(l) && fkb.CATEGORIES.includes(l.trim());
const v03 = t => t.split('\n').filter(l => !isHeadingLine(l)).join('\n');
const win = w => `${String(Math.floor(w.start / 60)).padStart(2, '0')}${String(w.start % 60).padStart(2, '0')}-${String(Math.floor(w.end / 60)).padStart(2, '0')}${String(w.end % 60).padStart(2, '0')}`;

// ══ synthetic packages (invented identifiers; positions as FlightKeys prints them) ═════════════
const W = 841.889, H = 595.275, CW = 4.8, LX = 30.346, RX = 430.031;
function lineItems(col, y, text) {
  const x0 = col === 'R' ? RX : LX, items = [], re = /\S+(?: \S+)*/g;
  let m;
  while ((m = re.exec(text)) !== null) items.push({ str: m[0], x: x0 + m.index * CW, y, w: m[0].length * CW, h: 8, font: 'f8' });
  return items;
}
const HDR_TEXT = 'TST0001 / KAAA - KBBB / 2026-11-03 / N000ZZ';
function briefPage(n, N, uuid, cols) {
  const items = [{ str: HDR_TEXT, x: 28.346, y: 19.877, w: HDR_TEXT.length * CW, h: 8, font: 'f6' },
    { str: '2026-Nov-03 08:17', x: 747.2, y: 19.877, w: 81.6, h: 8, font: 'f6' }];
  for (const col of ['L', 'R']) (cols[col] || []).forEach((t, k) => items.push(...lineItems(col, 35.034 + k * 9.6, t)));
  items.push({ str: `Page ${n} of ${N}`, x: 28.346, y: 579.398, w: 52.8, h: 8, font: 'f6' }, { str: uuid, x: 640, y: 579.398, w: 172.8, h: 8, font: 'f6' });
  return { width: W, height: H, items };
}
const U1 = '00000000-0000-4000-8000-000000000001', U2 = '00000000-0000-4000-8000-000000000002', U3 = '00000000-0000-4000-8000-000000000003';
const pad = (n, s) => ' '.repeat(n) + s;
const heading = t => pad(36, t);
const CREATED = 'CREATED:2026-Oct-31 00:00       FL: SFC - UNL';
const fkItem = (loc, id, body, dates = '2026-Nov-01 00:00 - 2026-Dec-01 00:00') => [`${loc}        ${id}        ${dates}`, CREATED, ...body];
const coItem = (loc, id, subject, body) => [loc ? `${loc}            ${id}        2026-Nov-01 00:00 - UFN` : pad(16, `${id}        2026-Nov-01 00:00 - UFN`), CREATED, `SUBJECT: ${subject}`, ...body];
const nameLine = (iata, name, role, w) => pad(18, `${iata} - ${name}`.padEnd(48) + `${role}  ${w}`);
const aptLine = (icao, rwys) => pad(2, `APT${icao}   RWYS: ${rwys}`);
const firHead = (name, code) => [pad(18, name), pad(2, `FIR${code}`)];
const EMPTY_FIR = code => [pad(17, `THERE ARE NO ACTIVE NOTAMS FOR FIR ${code} WITHIN THE GIVEN TIME`), 'NIL', pad(17, 'PERIOD THAT MATCHES THE FILTERING CRITERIA.')];

// The release (text pages): FPL type, date of flight, route, origin, destination, remarks.
function releasePages({ type = 'B744/H', dof = 'DOF/261103 ', route = 'N0481F320 DCT AAAAA DCT BBBBB', orig = 'KAAA', dest = 'KBBB', remarks = null } = {}) {
  const hdr = `TST0001/03NOV/${orig}-${dest}/N000ZZ`;
  const page = (n, of, body) => [hdr, 'OPERATIONAL FLIGHT PLAN RLS 01 03NOV26 12:00', ...body, `FUFI: 00000000-0000-0000-0000-000000000000 PAGE ${n}/${of}`].join('\n');
  const p1 = [`TST0001/03 ${orig} - ${dest} 03 NOV 26 N000ZZ`, 'COST INDEX 020 Revision: 1.0', 'B747-400F / CF6-80C2-B1F / KG / IFR / FF +4.0',
    'PROGS 031200 Release Valid Until 2300Z 03NOV26', `ORIG ${orig}/AAA ALPHA INTL N40000W080000 1755Z`, `DEST ${dest}/BBB BRAVO INTL N41000W081000 0328Z`];
  const rem = remarks ? ['Remarks', 'DISPATCHER DESK: 00', ...remarks, 'RAIM VALIDATION PASSED', 'MEL/CDL', 'Flight Release Authorization'] : [];
  const fpl = ['(FPL-TST0001-IS', `-${type}-SDE1E2E3FGHIJ3J5M1P2RWXYZ/LB1D1`, `-${orig}1755`, `-${route}`, `-${dest}0933 KCCC`, `-PBN/A1B1 ${dof}REG/N000ZZ SEL/ABCD RMK/TCAS II EQUIPPED)`];
  return [page(1, 2, p1), page(2, 2, [...rem, 'TIME FUEL', ...fpl])];
}

// A whole package: release (text), HSCN, Company + NOTAM Briefing, Weather + Hazard Briefing (positions),
// NAT track pages (text).
function pkg(o = {}) {
  const orig = o.orig || 'KAAA', dest = o.dest || 'KBBB';
  const company = [pad(30, 'COMPANY NOTAMS'), pad(36, 'GENERAL'),
    ...coItem('', 'P0001/26', 'TEST OFP', ['HIGH SEVERITY TEXT.', '  INDENTED SECOND LINE.']),
    'Contact Dispatch for a preflight briefing.',
    ...coItem('', 'A0002/26', 'ADMIN-TEST', ['GENERAL TEXT.']),
    ...coItem('', 'A0003/26', 'PUBS- 999 TEST', ['PUBLICATIONS TEXT.']),
    ...(o.company || [])];
  const airports = [
    nameLine('AAA', 'ALPHA INTL', 'DEPARTURE', '03 17:00 - 03 18:15'), aptLine(orig, '09/27'),
    heading('RUNWAY'), ...fkItem(orig, 'A0101/26', ['RWY 09/27 CLSD.']),
    nameLine('BBB', 'BRAVO INTL', 'DESTINATION', '04 02:30 - 04 04:30'), aptLine(dest, '18/36'),
    heading('TAXIWAY'), ...fkItem(dest, 'A0201/26', ['TWY A CLSD.']),
  ];
  const firs = o.firs || [
    ...firHead('TEST FIR', 'KXXX'), ...fkItem('KXXX', 'A0899/26', ['ITEM WITH NO HEADING.']),
    heading('AIRSPACE'), ...fkItem('KXXX', 'A0900/26', ['FIR TEXT ONE.', '  SECOND LINE KEPT.']),
    heading('WARNING'), ...fkItem('KXXX', 'A0901/26', ['WARNING TEXT.']),
    ...firHead('EMPTY FIR', 'KYYY'), ...EMPTY_FIR('KYYY'),
    ...firHead('GUARD FIR', 'KZZZ'), heading('NAVIGATION'), ...fkItem('KZZZ', 'A0902/26', ['NAV TEXT.']),
  ];
  const wx = [
    nameLine('AAA', 'ALPHA INTL', 'DEPARTURE', '03 17:00 - 03 18:15'), aptLine(orig, '09/27'),
    pad(38, 'TAF'), `TAF ${orig} 031100Z 0312/0418 27010KT P6SM SCT030`, pad(37, 'METAR'), `METAR ${orig} 031651Z 27010KT 10SM SCT030 12/04 A3000`,
    pad(38, 'ATIS'), pad(17, `THERE ARE NO ACTIVE ATIS FOR AIRPORT ${orig} WITHIN THE GIVEN TIME`), 'NIL', pad(17, 'PERIOD.'),
    nameLine('BBB', 'BRAVO INTL', 'DESTINATION', '04 02:30 - 04 04:30'), aptLine(dest, '18/36'),
    pad(38, 'TAF'), `TAF ${dest} 031100Z 0312/0418 18010KT P6SM SCT030`, pad(37, 'METAR'), `METAR ${dest} 031650Z 18010KT 10SM SCT030 10/05 A3001`,
    pad(38, 'ATIS'), pad(17, `THERE ARE NO ACTIVE ATIS FOR AIRPORT ${dest} WITHIN THE GIVEN TIME`), 'NIL', pad(17, 'PERIOD.'),
  ];
  const hazards = [
    ...firHead('TEST FIR', 'KXXX'), pad(37, 'SIGMET'), 'TWC FPG - TURB', 'Valid: 2026-11-03 18:00:00+00 until 2026-11-03 21:00:00+00', 'Level: FL300 - FL370', 'ID: 0001 (WSI/XXX)',
    'TWC FPG - CONV', 'Type: TS', 'ID: 0002 (WSI/XXX)',
    ...firHead('EMPTY FIR', 'KYYY'), pad(37, 'SIGMET'), pad(17, 'THERE ARE NO ACTIVE SIGMET FOR FIR WITHIN THE GIVEN TIME'), 'NIL', pad(17, 'PERIOD.'),
  ];
  const brief = [
    briefPage(1, 1, U1, { L: [pad(21, 'HIGH SEVERITY COMPANY NOTAMS'), ...coItem('', 'P0001/26', 'TEST OFP', ['HIGH SEVERITY TEXT.', '  INDENTED SECOND LINE.']), 'Contact Dispatch for a preflight briefing.'] }),
    briefPage(1, 2, U2, { L: company.slice(0, 50), R: company.slice(50) }),
    briefPage(2, 2, U2, { L: airports, R: firs }),
    briefPage(1, 1, U3, { L: wx, R: hazards }),
  ];
  const rel = releasePages({ type: o.type, dof: o.dof, route: o.route, orig, dest, remarks: o.remarks });
  const nat = o.nat || [];
  const texts = [...rel, ...brief.map((_, i) => `BRIEFING PAGE ${i + 1}`), ...nat.map(p => p.join('\n'))];
  const pages = [...rel.map(() => ({ width: W, height: H, items: [] })), ...brief, ...nat.map(() => ({ width: W, height: H, items: [] }))];
  const input = { text: texts.join('\n\n') + '\n\n', pages: pages.map((p, i) => ({ page: i + 1, width: p.width, height: p.height, items: p.items.map((it, k) => Object.assign({ order: k }, it)) })) };
  return mod.parseFlightKeys(input, o.opts || OPTS);
}

// ══ TC-163-010 Company NOTAMs, synthetic ══════════════════════════════════════════════════════

test('TC-163-010 Company NOTAMs synthetic: fields, line breaks, GENERAL, severity, origin; Contact line; pair kept', () => {
  const r = pkg({ company: coItem('KBBB', 'A0010/26', 'KBBB-FREQ', ['GROUND FREQ 121.9.', '  SECOND LINE.']) });
  const c = r.companyNotams;
  assert.deepEqual(c.map(x => [x.id, x.location, x.subject, x.severity, x.origin]), [
    ['P0001/26', 'GENERAL', 'TEST OFP', 'high', 'HSCN'],
    ['P0001/26', 'GENERAL', 'TEST OFP', 'normal', 'COMPANY'],
    ['A0002/26', 'GENERAL', 'ADMIN-TEST', 'normal', 'COMPANY'],
    ['A0003/26', 'GENERAL', 'PUBS- 999 TEST', 'normal', 'COMPANY'],
    ['A0010/26', 'KBBB', 'KBBB-FREQ', 'normal', 'COMPANY'],
  ], 'every item as printed; the HSCN / Company pair of one ID kept as two records (never merged, D43)');
  assert.deepEqual(Object.keys(c[0]), ['id', 'location', 'subject', 'start', 'end', 'severity', 'origin', 'text', 'source']);
  assert.equal(c[1].text, [pad(16, 'P0001/26        2026-Nov-01 00:00 - UFN'), CREATED, 'SUBJECT: TEST OFP', 'HIGH SEVERITY TEXT.', '  INDENTED SECOND LINE.'].join('\n'),
    'text as printed: header rows, line breaks and indentation kept (D54)');
  assert.deepEqual([c[4].start, c[4].end], ['2026-Nov-01 00:00', 'UFN']);
  assert.ok(c.every(x => !/Contact Dispatch/.test(x.text)), '"Contact Dispatch for a preflight briefing." belongs to no item');
  assert.deepEqual(c[4].source.map(s => s.page), [4], 'source positions: absolute PDF page');
  assert.ok(c.every(x => !/COMPANY NOTAMS|^\s+GENERAL$/m.test(x.text)), 'no document heading in an item');
  assert.equal(infos(r, /^companyNotams$/).filter(f => /^5 Company NOTAMs read \(1 High Severity, 4 Company\)/.test(f.message)).length, 1);
  // NEGATIVE: Company items never enter an airport's NOTAMs
  assert.ok(!/A0010\/26|A0002\/26/.test(r.airportData.KBBB.notams + r.airportData.KBBB.notamsRaw));
  // NEGATIVE: no NOTAM ruleset → no items, one WARN (never cut by the parser itself)
  const n = pkg({ opts: { icaoFpl, aircraftProfile: acProf, parseNatTrack } });
  assert.deepEqual(n.companyNotams, []);
  assert.equal(warns(n, /^companyNotams$/).length, 1);
});

// ══ TC-163-020 curfews, synthetic (positive and negative, CLAUDE.md rule 6) ════════════════════

const curfewPkg = (body, o = {}) => pkg(Object.assign({ company: coItem('KBBB', 'A0020/26', o.subject || 'KBBB-CURFEW', body) }, o));
const BY_TYPE = ['****************************************', 'BBB CURFEW:', 'B747-400/F CURFEW = 1400-2100Z DAILY',
  'N001ZZ, N002ZZ, N003ZZ CURFEW = 1500-2100Z DAILY', 'B767, B777, B748 CURFEW = 1500-2100Z DAILY', '****************************************'];
const SEASONS = ['OPERATIONS DURING NIGHT TIME REQUIRE A SLOT.', 'NIGHT-TIME =',
  '- WINTER: NOVEMBER TO MARCH 2200-0600 UTC (UTC+1)(2300-0700 LCL)', '- SUMMER: APRIL TO OCTOBER 2100-0500 UTC (UTC+2)(2300-0700 LCL)'];
const UNDATED = ['BBB CURFEW (TIMES IN UTC)', 'SUMMER:', 'MONDAY-SATURDAY 2000-0400Z', 'SUNDAY & HOLIDAYS 2000-1100Z', 'WINTER:', 'MONDAY-SATURDAY 2100-0500Z', 'SUNDAY & HOLIDAYS 2100-1200Z'];
const DEP_ONLY = ['BBB CARGO DEPARTURE ONLY CURFEW:', '0100Z-1300Z. IF DEPARTING DURING THIS TIME, VERIFY WITH', 'OPS/STATION THAT AN EXEMPTION HAS BEEN GRANTED.',
  'CURFEW IS NOT APPLICABLE TO ARRIVALS OR ALTERNATE USAGE'];
const windowsOf = s => Array.from(parseCurfewWindows(s), win);   // Array.from: the app's function runs in its own vm realm

test('TC-163-020 curfews synthetic: O-33 … O-37, positive and negative', () => {
  // O-33: the closed type table; registration lists never matched
  const t744 = curfewPkg(BY_TYPE, { type: 'B744/H' }).airportData.KBBB.curfew;
  assert.equal(t744, 'B747-400/F CURFEW = 1400-2100Z DAILY', 'B744 → the B747-400/F line only');
  assert.deepEqual(windowsOf(t744), ['1400-2100'], 'NEGATIVE: the 1500Z registration and B767/B777/B748 lines are not applied');
  for (const ty of ['B77L/H', 'B748/H']) {
    const s = curfewPkg(BY_TYPE, { type: ty }).airportData.KBBB.curfew;
    assert.equal(s, 'B767, B777, B748 CURFEW = 1500-2100Z DAILY', `${ty} → the B767, B777, B748 line only`);
  }
  const r763 = curfewPkg(BY_TYPE, { type: 'B763/H' });
  assert.equal(r763.airportData.KBBB.curfew, [BY_TYPE[2], BY_TYPE[3], BY_TYPE[4], mod.CURFEW_NOTES.type].join('\n'),
    'a type outside the table (B763) → every line and the note (the table is closed: O-33)');
  assert.equal(warns(r763, /^airportData\.curfew$/).filter(f => /no curfew line for aircraft type B763/.test(f.message)).length, 1);
  assert.deepEqual(Object.keys(mod.CURFEW_TYPES), ['B747-400/F', 'B767, B777, B748']);
  assert.deepEqual(mod.CURFEW_TYPES['B747-400/F'], ['B744', 'B747-400F']);
  assert.deepEqual(mod.CURFEW_TYPES['B767, B777, B748'], ['B77L', 'B777F', 'B748']);
  // O-34 / SME-22a: dated seasons — the season in force only, no note (NEGATIVE for the note) …
  const jan = curfewPkg(SEASONS, { dof: 'DOF/260115 ' });
  assert.equal(jan.airportData.KBBB.curfew, '- WINTER: NOVEMBER TO MARCH 2200-0600 UTC (UTC+1)', 'January → WINTER only, no note');
  assert.deepEqual(warns(jan, /curfew/), []);
  assert.equal(curfewPkg(SEASONS, { dof: 'DOF/260715 ' }).airportData.KBBB.curfew, '- SUMMER: APRIL TO OCTOBER 2100-0500 UTC (UTC+2)', 'July → SUMMER only');
  // … the changeover month (the month a stated season ends): both windows + note
  for (const dof of ['DOF/261027 ', 'DOF/260315 ']) {
    const r = curfewPkg(SEASONS, { dof });
    assert.equal(r.airportData.KBBB.curfew, ['- WINTER: NOVEMBER TO MARCH 2200-0600 UTC (UTC+1)', '- SUMMER: APRIL TO OCTOBER 2100-0500 UTC (UTC+2)', mod.CURFEW_NOTES.changeover].join('\n'), `${dof.trim()}: both + note`);
    assert.deepEqual(windowsOf(r.airportData.KBBB.curfew), ['2200-0600', '2100-0500'], 'O-35: the app reads the two UTC windows only (no LCL window)');
  }
  // … no readable effectivity: every window, no weekday split, note + WARN
  const und = curfewPkg(UNDATED, { dof: 'DOF/260115 ' });
  assert.equal(und.airportData.KBBB.curfew, [...UNDATED.slice(1), mod.CURFEW_NOTES.dates].join('\n'));
  assert.deepEqual(windowsOf(und.airportData.KBBB.curfew), ['2000-0400', '2000-1100', '2100-0500', '2100-1200']);
  assert.equal(warns(und, /^airportData\.curfew$/).filter(f => /effective dates of SUMMER \/ WINTER not stated/.test(f.message)).length, 1);
  // O-35: the LCL bracket is dropped; NavBlue's form keeps it and reads its times as a UTC window (NB-F8)
  assert.ok(!/LCL/.test(curfewPkg(SEASONS, { dof: 'DOF/260115 ' }).airportData.KBBB.curfew));
  assert.deepEqual(windowsOf('- WINTER: NOVEMBER TO MARCH 2200-0600 UTC (UTC+1)(2300-0700 LCL)'), ['2200-0600', '2300-0700'], 'NB-F8: the LCL bracket kept → a false window');
  // O-36: departure-only qualifier lines kept; other lines without a window dropped (NEGATIVE)
  const dep = curfewPkg(DEP_ONLY).airportData.KBBB.curfew;
  assert.equal(dep, [DEP_ONLY[0], DEP_ONLY[1], DEP_ONLY[3]].join('\n'));
  assert.ok(!/EXEMPTION HAS BEEN GRANTED/.test(dep));
  // a plain daily curfew: the line, no note, no WARN
  const daily = curfewPkg(['****', 'KBBB/BBB CURFEW: 1300-2200Z DAILY', '****']);
  assert.equal(daily.airportData.KBBB.curfew, 'KBBB/BBB CURFEW: 1300-2200Z DAILY');
  assert.deepEqual(warns(daily, /curfew/), []);
  // the notes carry no digits (the app would read "HHMM-HHMM" in a note as a window)
  for (const n of Object.values(mod.CURFEW_NOTES)) assert.ok(!/\d/.test(n), `no digit in "${n}"`);
  // O-37: CURFEW key only — a curfew-like item under another key gives no curfew, one INFO (NEGATIVE)
  const like = curfewPkg(['NOISE RESTRICTIONS: TAKEOFF AND LANDING IS NOT', 'ALLOWED BETWEEN 22:00 AND 06:00 UTC'], { subject: 'KBBB-INTAM' });
  assert.ok(!('curfew' in like.airportData.KBBB), 'no curfew from the INTAM key');
  assert.equal(infos(like, /^airportData\.curfew$/).filter(f => /A0020\/26 \(SUBJECT: KBBB-INTAM\) reads like a curfew/.test(f.message)).length, 1);
  assert.ok(!('curfew' in pkg().airportData.KBBB), 'NEGATIVE: no CURFEW item → no curfew key (as NavBlue)');
  // no airportData entry → no entry created, INFO; the item stays in companyNotams[]
  const none = pkg({ company: coItem('KQQQ', 'A0021/26', 'KQQQ-CURFEW', ['KQQQ CURFEW 1300-2200Z DAILY']) });
  assert.ok(!('KQQQ' in none.airportData));
  assert.equal(infos(none, /^airportData\.curfew$/).filter(f => /^KQQQ: CURFEW Company NOTAM A0021\/26 for an airport with no airportData entry/.test(f.message)).length, 1);
  assert.ok(none.companyNotams.some(c => c.id === 'A0021/26'));
  // two CURFEW items for one airport: both, in printed order (NavBlue appends)
  const two = pkg({ company: [...coItem('KBBB', 'A0022/26', 'KBBB-CURFEW', ['KBBB CURFEW 1300-1400Z DAILY']), ...coItem('KBBB', 'A0023/26', 'KBBB-CURFEW', ['KBBB CURFEW 1500-1600Z DAILY'])] });
  assert.deepEqual(windowsOf(two.airportData.KBBB.curfew), ['1300-1400', '1500-1600']);
});

// ══ TC-163-070 ops notes, synthetic ════════════════════════════════════════════════════════════

test('TC-163-070 ops notes synthetic: O-38 repeat (positive / negative), O-39 body, curfew item out, no new entry', () => {
  const remarks = ['** KBBB FLIGHT OPS RESTRICTIONS **', '1. NO TRAINING FLIGHTS.', '2. CHECK CAPTAIN REQUIRED.'];
  const rep = ['----------', 'KBBB/BBB FLIGHT OPS RESTRICTIONS', '- NO TRAINING FLIGHTS', '- CHECK CAPTAIN REQUIRED', '----------'];
  const base = [...coItem('KBBB', 'A0030/26', 'KBBB-FREQ', ['GROUND FREQ 121.9.']), ...coItem('KBBB', 'A0031/26', 'KBBB-CURFEW', ['KBBB CURFEW 1300-2200Z DAILY'])];
  const r = pkg({ remarks, company: [...base, ...coItem('KBBB', 'A0032/26', 'KBBB-FLTOPS', rep), ...coItem('KQQQ', 'A0033/26', 'KQQQ-FREQ', ['X'])] });
  assert.ok(r.airportData.KBBB.remarks.length, 'precondition: the OFP Remarks hold a KBBB restriction block');
  assert.deepEqual(r.airportData.KBBB.opsNotes, { header: 'KBBB COMPANY NOTAMS', body: 'SUBJECT: KBBB-FREQ\nGROUND FREQ 121.9.' },
    'O-39: subject + text; the CURFEW item and the repeat (O-38) left out');
  assert.equal(infos(r, /^airportData\.opsNotes$/).filter(f => /A0032\/26 \(SUBJECT: KBBB-FLTOPS\) repeats the OFP Remarks/.test(f.message)).length, 1);
  assert.ok(r.companyNotams.some(c => c.id === 'A0032/26'), 'the repeat stays in companyNotams[]');
  assert.ok(!('KQQQ' in r.airportData), 'no airportData entry created (L13 UAAA)');
  // NEGATIVE: one content word that is not in the Remarks → not a repeat, in opsNotes
  const n = pkg({ remarks, company: coItem('KBBB', 'A0032/26', 'KBBB-FLTOPS', [...rep.slice(0, 4), '- RAMP 9 ONLY', rep[4]]) });
  assert.equal(n.airportData.KBBB.opsNotes.body, ['SUBJECT: KBBB-FLTOPS', ...rep.slice(0, 4), '- RAMP 9 ONLY', rep[4]].join('\n'));
  // NEGATIVE: no Remarks at all → nothing is a repeat
  assert.ok(pkg({ company: coItem('KBBB', 'A0032/26', 'KBBB-FLTOPS', rep) }).airportData.KBBB.opsNotes);
  // no airport item → no opsNotes key
  assert.ok(!('opsNotes' in pkg().airportData.KBBB));
});

// ══ TC-163-030 FIR NOTAMs, synthetic ═══════════════════════════════════════════════════════════

test('TC-163-030 FIR NOTAMs synthetic: blocks, categories, text, empty blocks, firRaw, FIR-keyed Company item (O-40, O-41)', () => {
  const guard = coItem('', 'A0040/26', 'KZZZ-GUARD', ['MONITOR GUARD IN KZZZ AIRSPACE.']);
  const r = pkg({ company: [...guard, ...coItem('', 'A0041/26', 'KQQQ-GUARD', ['NO SUCH FIR.'])] });
  assert.deepEqual(r.firNotams.map(b => [b.name, b.code, b.empty, b.items.map(i => `${i.id} ${i.category || '-'} ${i.origin}`)]), [
    ['TEST FIR', 'KXXX', false, ['A0899/26 - NOTAM', 'A0900/26 AIRSPACE NOTAM', 'A0901/26 WARNING NOTAM']],
    ['EMPTY FIR', 'KYYY', true, []],
    ['GUARD FIR', 'KZZZ', false, ['A0902/26 NAVIGATION NOTAM', 'A0040/26 - COMPANY']],
  ]);
  const it = r.firNotams[0].items[1];
  assert.equal(it.text, fkItem('KXXX', 'A0900/26', ['FIR TEXT ONE.', '  SECOND LINE KEPT.']).join('\n'), 'item text as printed, line breaks and indentation kept; no heading');
  assert.deepEqual(it.source.map(s => [s.page, s.column]), [[5, 'R']]);
  const fir = [
    'TEST FIR (KXXX)', ...fkItem('KXXX', 'A0899/26', ['ITEM WITH NO HEADING.']), ...fkItem('KXXX', 'A0900/26', ['FIR TEXT ONE.', '  SECOND LINE KEPT.']), ...fkItem('KXXX', 'A0901/26', ['WARNING TEXT.']),
    '', 'GUARD FIR (KZZZ)', ...fkItem('KZZZ', 'A0902/26', ['NAV TEXT.']), '[COMPANY NOTAM]', ...guard,
  ].join('\n');
  assert.equal(r.enrouteNotams.fir, fir, 'block name before its items; no type heading; empty block left out; Company item marked');
  assert.deepEqual([r.enrouteNotams.route, r.enrouteNotams.airway, r.enrouteNotams.waypoint, r.enrouteNotams.geographic], ['', '', '', '']);
  assert.ok(!r.enrouteNotams.fir.split('\n').some(isHeadingLine), 'no type heading in the FIR text');
  assert.equal(infos(r, /^enrouteNotams$/).filter(f => /^1 FIR block\(s\) print no active NOTAMs and are left out of enrouteNotams\.fir: KYYY/.test(f.message)).length, 1);
  assert.equal(infos(r, /^enrouteNotams$/).filter(f => /route, airway, waypoint and geographic are empty/.test(f.message)).length, 1);
  // firRaw: every block exactly as printed (headings, items, empty box); no Company item
  assert.deepEqual(r.firRaw.map(b => b.code), ['KXXX', 'KYYY', 'KZZZ']);
  assert.equal(r.firRaw[0].raw, [...fkItem('KXXX', 'A0899/26', ['ITEM WITH NO HEADING.']), heading('AIRSPACE'), ...fkItem('KXXX', 'A0900/26', ['FIR TEXT ONE.', '  SECOND LINE KEPT.']),
    heading('WARNING'), ...fkItem('KXXX', 'A0901/26', ['WARNING TEXT.'])].join('\n'));
  assert.equal(r.firRaw[1].raw, EMPTY_FIR('KYYY').join('\n'));
  assert.ok(!r.firRaw.some(b => /A0040\/26|GUARD IN KZZZ/.test(b.raw)), 'NEGATIVE: no Company item in firRaw');
  // O-40: a FIR key with no block → company only + INFO; PUBS- is no location (no INFO)
  assert.equal(infos(r, /^enrouteNotams$/).filter(f => /A0041\/26 \(SUBJECT: KQQQ-GUARD\) is keyed to KQQQ, which has no FIR block/.test(f.message)).length, 1);
  assert.equal(infos(r, /^enrouteNotams$/).filter(f => /PUBS/.test(f.message)).length, 0);
  assert.ok(r.companyNotams.some(c => c.id === 'A0040/26') && r.companyNotams.some(c => c.id === 'A0041/26'), 'both stay in companyNotams[]');
  // NEGATIVE: FIR items never enter an airport's NOTAMs
  assert.ok(!Object.values(r.airportData).some(a => /A090\d\/26/.test(a.notams + a.notamsRaw)));
});

// ══ TC-163-040 hazards, synthetic ══════════════════════════════════════════════════════════════

test('TC-163-040a hazards synthetic: per FIR as printed; empty; never airport weather, weatherRaw or E-WINS', () => {
  const r = pkg();
  assert.deepEqual(r.hazards.map(h => [h.name, h.code, h.empty]), [['TEST FIR', 'KXXX', false], ['EMPTY FIR', 'KYYY', true]]);
  assert.deepEqual(Object.keys(r.hazards[0]), ['name', 'code', 'text', 'empty']);
  assert.equal(r.hazards[0].text, [pad(37, 'SIGMET'), 'TWC FPG - TURB', 'Valid: 2026-11-03 18:00:00+00 until 2026-11-03 21:00:00+00', 'Level: FL300 - FL370', 'ID: 0001 (WSI/XXX)',
    'TWC FPG - CONV', 'Type: TS', 'ID: 0002 (WSI/XXX)'].join('\n'), 'as printed; not split, not evaluated');
  for (const [icao, a] of Object.entries(r.airportData)) {
    assert.ok(!/TWC FPG|SIGMET/.test((a.weather || '') + (a.weatherRaw || '') + (a.ewinsWeather || '')), `${icao}: no hazard text in the airport weather`);
    assert.ok(!('ewinsWeather' in a), `${icao}: a hazard product is never E-WINS`);
  }
});

// ══ TC-163-050 NAT, synthetic ══════════════════════════════════════════════════════════════════

// A NAT message as FlightKeys prints it (invented fixes), split over pages: [[page lines], …].
function natMsg({ n = 2, tmi = '307', dir = 'WEST', valid = 'NOV 03/1130Z TO NOV 03/1900Z' } = {}) {
  const words = ['ONE', 'TWO', 'THREE'];
  const parts = [];
  for (let k = 1; k <= n; k++) {
    const p = [`(NAT-${k}/${n} TRACKS FLS 340/400 INCLUSIVE`, valid, `PART ${words[k - 1]} OF ${words[n - 1]} PARTS-`,
      `${'ABC'[k - 1]} AAAAA 5${k}/20 5${k}/30 5${k}/40 BBBBB`, `EAST LVLS ${dir === 'EAST' ? '340 350' : 'NIL'}`, `WEST LVLS ${dir === 'WEST' ? '340 350' : 'NIL'}`,
      `EUR RTS ${dir} NIL`, 'NAR NIL-'];
    if (k === n) p.push('REMARKS.', tmi === null ? '1. TMI NOT GIVEN.' : `1. TMI IS ${tmi}.`, '2. SECOND REMARK.-');
    p.push(`END OF PART ${words[k - 1]} OF ${words[n - 1]} PARTS)`);
    parts.push(p);
  }
  return parts;
}
const natPages = (...msgs) => {   // every part on a page of its own, each page headed NAT-TRACKS
  const parts = msgs.flat();
  return parts.map(p => ['NAT-TRACKS', ...p]);
};
const EAST_FLT = { orig: 'KAAA', dest: 'EDDA' }, WEST_FLT = { orig: 'EDDA', dest: 'KBBB' };

test('TC-163-050 NAT synthetic: complete messages; direction first then TMI; WARNs; filed track from the route only', () => {
  const E308 = natMsg({ tmi: '308', dir: 'EAST', valid: 'NOV 04/0100Z TO NOV 04/0800Z' }), W307 = natMsg({ tmi: '307', dir: 'WEST' });
  // L12 shape: two messages; a westbound flight gets the westbound 307 (O-42), not the higher 308
  const w = pkg(Object.assign({ nat: natPages(E308, W307) }, WEST_FLT));
  assert.deepEqual(w.natMessages.map(m => [m.tmi, m.direction, m.parts, m.complete, m.selected]), [['308', 'EAST', 2, true, false], ['307', 'WEST', 2, true, true]]);
  assert.equal(w.natTrack.tmi, '307'); assert.equal(w.natTrack.flightDir, 'WEST');
  assert.deepEqual(Object.keys(w.natMessages[0]), ['tmi', 'direction', 'valid', 'parts', 'complete', 'pages', 'text', 'selected']);
  assert.equal(w.natMessages[1].text, W307.flat().join('\n'), 'the message complete across its pages; the NAT-TRACKS page headings removed');
  assert.deepEqual(w.natMessages[1].pages, [w.natMessages[0].pages[1] + 1, w.natMessages[0].pages[1] + 2]);
  assert.deepEqual(warns(w, /^natTrack$/), [], 'NEGATIVE: both directions printed → no crew alert');
  // the same package, eastbound flight → 308
  const e = pkg(Object.assign({ nat: natPages(E308, W307) }, EAST_FLT));
  assert.equal(e.natTrack.tmi, '308');
  // two messages of the flight's direction → the higher TMI
  const hi = pkg(Object.assign({ nat: natPages(natMsg({ tmi: '310' }), natMsg({ tmi: '311', valid: 'NOV 03/1900Z TO NOV 04/0100Z' })) }, WEST_FLT));
  assert.equal(hi.natTrack.tmi, '311');
  // only the opposite direction printed (L08, L22) → returned + crew-alert WARN
  const one = pkg(Object.assign({ nat: natPages(E308) }, WEST_FLT));
  assert.equal(one.natTrack.tmi, '308');
  assert.equal(warns(one, /^natTrack$/).filter(f => /^CREW ALERT: the package prints only the EAST NAT track message \(TMI 308\); none for this WESTBOUND flight/.test(f.message)).length, 1);
  // unreadable TMI = the lowest, WARN
  const un = pkg(Object.assign({ nat: natPages(natMsg({ tmi: null }), natMsg({ tmi: '200', valid: 'NOV 03/1900Z TO NOV 04/0100Z' })) }, WEST_FLT));
  assert.equal(un.natTrack.tmi, '200');
  assert.equal(warns(un, /^natTrack$/).filter(f => /TMI not readable; counted as the lowest/.test(f.message)).length, 1);
  // equal TMI: a finding only if same direction AND validity
  const dup = pkg(Object.assign({ nat: natPages(W307, W307) }, WEST_FLT));
  assert.equal(warns(dup, /^natTrack$/).filter(f => /TMI 307 printed 2 times with the same direction and validity/.test(f.message)).length, 1);
  const notDup = pkg(Object.assign({ nat: natPages(W307, natMsg({ tmi: '307', valid: 'NOV 03/1900Z TO NOV 04/0100Z' })) }, WEST_FLT));
  assert.deepEqual(warns(notDup, /^natTrack$/), [], 'NEGATIVE: same TMI, other validity → no finding');
  // an incomplete message: kept, WARN
  const inc = pkg(Object.assign({ nat: natPages([W307[0]]) }, WEST_FLT));
  assert.equal(inc.natMessages[0].complete, false);
  assert.equal(warns(inc, /^natTrack$/).filter(f => /2 part\(s\) expected, not all printed/.test(f.message)).length, 1);
  // O-43: the filed track from the FPL route string only
  const filed = pkg(Object.assign({ nat: natPages(W307), route: 'N0481F320 DCT AAAAA NATB BBBBB' }, WEST_FLT));
  assert.equal(filed.natTrack.assignedId, 'B');
  const rmk = pkg(Object.assign({ nat: natPages(W307), remarks: ['YOU ARE FILED UNDER NAT TRACK X AND Z ON A RANDOM ROUTE'],
    company: coItem('', 'A0050/26', 'ADMIN-NAT', ['ASSIGNED NAT TRACK: C', 'NATC']) }, WEST_FLT));
  assert.equal(rmk.natTrack.assignedId, null, 'NEGATIVE: remarks and Company NOTAM text never give the filed track');
  // no NAT parser → natTrack null (as NavBlue), messages still read
  const np = pkg(Object.assign({ nat: natPages(W307), opts: { icaoFpl, aircraftProfile: acProf, notamRules: NR } }, WEST_FLT));
  assert.equal(np.natTrack, null);
  assert.equal(np.natMessages.length, 1);
  assert.equal(infos(np, /^natTrack$/).filter(f => f.message === 'NAT parser not supplied').length, 1);
  // no NAT pages → nothing
  const none = pkg(WEST_FLT);
  assert.deepEqual([none.natTrack, none.natMessages], [null, []]);
});

// ══ TC-163-060 PACOTS, synthetic ═══════════════════════════════════════════════════════════════

test('TC-163-060a PACOTS synthetic: "PACOTS TRACKS" anywhere (wrapped headline), sets, sections, natTrack null', () => {
  const firs = [...firHead('FUKUOKA FIR', 'RJJJ'), heading('AIRSPACE'),
    ...fkItem('RJJJ', 'Q0003/26', ['EASTBOUND PACOTS', 'TRACKS BETWEEN AAA AND BBB, TRACK 1.'], '2026-Nov-04 07:00 - 2026-Nov-04 21:00'),
    ...fkItem('RJJJ', 'Q0002/26', ['EASTBOUND PACOTS TRACKS BETWEEN CCC AND DDD,', 'TRACK 11.'], '2026-Nov-04 10:00 - 2026-Nov-04 21:00'),
    ...fkItem('RJJJ', 'Q0001/26', ['EASTBOUND PACOTS TRACKS BETWEEN AAA AND BBB, TRACK 1.'], '2026-Nov-03 07:00 - 2026-Nov-03 21:00'),
    ...fkItem('RJJJ', 'A0001/26', ['PACOTS ROUTE NOTE WITHOUT THE PHRASE.'])];
  const r = pkg({ firs });
  const s = r.sections.filter(x => x.id === 'pacots');
  assert.deepEqual(s.map(x => [x.title, x.anchor, x.startPage, x.endPage]), [['PACOTS Tracks', 'Q0003/26', 5, 5], ['PACOTS Tracks', 'Q0001/26', 5, 5]],
    'two sets: one per validity end; the wrapped headline counts; "PACOTS" without "TRACKS" does not');
  assert.equal(r.natTrack, null, 'no track object for PACOTS (O-44)');
  assert.equal(infos(r, /^sections$/).filter(f => /^3 PACOTS track item\(s\) in 2 set\(s\)/.test(f.message)).length, 1);
});

// ══ fixtures ═══════════════════════════════════════════════════════════════════════════════════

function fixturesDir() {
  if (process.env.PB_FIXTURES) {
    const d = path.resolve(process.env.PB_FIXTURES);
    return fs.existsSync(path.join(d, 'manifest.json')) ? d : null;
  }
  return findFixtures();
}
const FIXTURES = fixturesDir();

if (!FIXTURES) {
  test('TC-163 fixtures available', () => {
    assert.fail('pilotbrief-fixtures not found (set PB_FIXTURES or clone it beside the repo): TC-163 fixture tests cannot run');
  });
} else {
  const manifest = readManifest(FIXTURES);
  const fk = manifest.fixtures.filter(f => f.format === 'flightkeys');
  const LBL = Object.fromEntries(Object.entries(BASE.fixtures).map(([id, b]) => [id, b.label]));
  const L = fx => LBL[fx.id];
  const byL = l => fk.find(f => L(f) === l);
  const cache = new Map();
  const load = fx => {
    if (!cache.has(fx.id)) {
      const text = fs.readFileSync(path.join(FIXTURES, fx.files.text), 'utf8');
      const items = JSON.parse(fs.readFileSync(path.join(FIXTURES, fx.files.items), 'utf8'));
      cache.set(fx.id, { text, items, r: mod.parseFlightKeys(mod.inputFromExtractor(text, items), OPTS) });
    }
    return cache.get(fx.id);
  };
  const run = fx => load(fx).r;
  const expectedFile = path.join(FIXTURES, EXPECTED_FILE);
  const EXP = fs.existsSync(expectedFile) ? JSON.parse(fs.readFileSync(expectedFile, 'utf8')) : null;
  const needExp = () => assert.ok(EXP, `fixtures ${EXPECTED_FILE} not found (fixtures branch claude/fk-parser-v0.4 or later)`);
  // The grammar doc's §A.2 per-package table: Company items (column 6) and FIR items (column 8).
  const grammar = {};
  for (const l of GRAMMAR.split('\n')) {
    const m = /^\| (L\d\d|T\d) \| [\d-]+ \| [\d-]+ \| (\d+) \| (\d+) \| (\d+) \| (\d+) \| \d+ \| \d+ \| (\d+) \| (\d+) \|/.exec(l);
    if (m && !grammar[m[1]]) grammar[m[1]] = { hscn: +m[2], company: +m[3], firItems: +m[5], firNotam: +m[6], firWx: +m[7] };
  }

  // ── TC-163-001 v0.3.0 byte-identical except the declared changes ──
  // Declared (Exec brief v0.4.0): scope 0 airportData notams (+ headings); scope 1 companyNotams; scope 2–3
  // airportData curfew / opsNotes (added keys); scope 4 enrouteNotams, firNotams, firRaw; scope 5 natTrack,
  // natMessages, sections (PACOTS); scope 6 hazards; the findings (the deferred INFOs of the fields read now
  // removed, the INFOs / WARNs of the new readers added).
  const DECLARED = ['companyNotams', 'enrouteNotams', 'natTrack', 'sections'];
  test('TC-163-001 v0.3.0 byte-identical on all 26 except the declared changes', () => {
    assert.deepEqual(fk.map(f => f.id).sort(), Object.keys(BASE.fixtures).sort());
    let fields = 0, values = 0;
    const changed = {}, notamsChanged = [];
    for (const fx of fk) {
      const r = run(fx), b = BASE.fixtures[fx.id], lbl = b.label;
      assert.deepEqual(Object.keys(r).filter(k => !['firNotams', 'firRaw', 'natMessages', 'hazards'].includes(k)), b.keys, `${lbl}: v0.3.0 keys, in order`);
      assert.deepEqual(Object.keys(r).slice(-6), ['firNotams', 'firRaw', 'natMessages', 'hazards', 'sections', 'findings'], `${lbl}: the 4 new fields before sections`);
      for (const [k, h] of Object.entries(b.sha256)) {
        if (sha(JSON.stringify(r[k])) === h) { fields++; continue; }
        (changed[k] = changed[k] || []).push(lbl);
      }
      assert.deepEqual(Object.keys(r.airportData), Object.keys(b.airportData), `${lbl}: airport entries and card order unchanged (no entry added)`);
      for (const [icao, be] of Object.entries(b.airportData)) {
        const e = r.airportData[icao];
        assert.deepEqual(Object.keys(e).filter(k => k !== 'curfew' && k !== 'opsNotes'), be.keys, `${lbl} ${icao}: v0.3.0 keys, in order`);
        assert.deepEqual(Object.keys(e).slice(be.keys.length), ['curfew', 'opsNotes'].filter(k => k in e), `${lbl} ${icao}: curfew / opsNotes after weatherRaw`);
        for (const k of be.keys) {
          if (k === 'notams') {
            assert.equal(sha(JSON.stringify(v03(e.notams))), be.sha256.notams, `${lbl} ${icao}: notams without the heading lines = v0.3.0`);
            if (e.notams !== v03(e.notams)) notamsChanged.push(`${lbl} ${icao}`);
            values++; continue;
          }
          assert.equal(sha(JSON.stringify(e[k])), be.sha256[k], `${lbl} ${icao}.${k} unchanged`); values++;
        }
      }
    }
    assert.deepEqual(Object.keys(changed).sort(), DECLARED.slice().sort(), 'only the declared top-level fields change');
    assert.equal(changed.companyNotams.length, 26, 'companyNotams read in 26/26');
    assert.equal(changed.enrouteNotams.length, 26, 'enrouteNotams.fir read in 26/26');
    assert.deepEqual(changed.natTrack.sort(), ['L08', 'L11', 'L12', 'L22', 'L23'], 'natTrack in the 5 NAT packages');
    assert.deepEqual(changed.sections.sort(), ['L02', 'L03', 'L04', 'L09', 'L13', 'L14', 'L16', 'L18', 'L20', 'T3'], 'sections: PACOTS in 10 packages');
    assert.equal(notamsChanged.length, 137 - 2, 'the type headings added to every airport with NOTAM items (137 blocks, 2 empty)');
    console.log(`TC-163-001: ${fields} top-level fields and ${values} airport values equal v0.3.0 on 26 fixtures (notams compared without the heading lines); changed as declared: ${DECLARED.map(k => `${k} ${changed[k].length}`).join(', ')}; notams + headings at ${notamsChanged.length} airports`);
  });

  test('TC-163-001b findings: v0.3.0 findings kept in order, except the deferred INFOs of the fields read now', () => {
    const NOW_READ = ['enrouteNotams', 'natTrack', 'airportData.curfew', 'airportData.opsNotes', 'companyNotams'];
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx);
      assert.equal(r.findings.filter(f => NOW_READ.includes(f.field) && /^not read in/.test(f.message)).length, 0, `${lbl}: no "not read" INFO for the fields read now`);
      assert.equal(r.findings.filter(f => f.field === 'fplEquipment' && /^not read in v0\.4\.0: not in any brief yet/.test(f.message)).length, 1, `${lbl}: fplEquipment still deferred`);
      const bad = r.findings.filter(f => f.level === 'WARN' && !['permits', 'altData', 'airportData.curfew', 'natTrack'].includes(f.field));
      assert.deepEqual(bad, [], `${lbl}: no WARN outside the known ones`);
    }
    // the v0.3.0 findings (hash per package) = the v0.4.0 findings minus the v0.4.0 readers' findings and with the
    // removed deferred INFOs put back
    for (const fx of fk) {
      const r = run(fx), b = BASE.fixtures[fx.id];
      const NEW_FIELDS = ['companyNotams', 'airportData.curfew', 'airportData.opsNotes', 'enrouteNotams', 'hazards', 'natTrack'];
      const isNew = f => NEW_FIELDS.includes(f.field) || (f.field === 'sections' && /PACOTS/.test(f.message));
      const back = [];
      for (const f of r.findings) {
        if (isNew(f)) continue;
        if (f.field === 'fplEquipment') {
          for (const k of ['enrouteNotams', 'natTrack', 'airportData.curfew', 'airportData.opsNotes', 'companyNotams']) back.push({ level: 'INFO', field: k, message: 'not read in v0.3.0: read in 5d' });
          back.push(Object.assign({}, f, { message: f.message.replace('v0.4.0', 'v0.3.0') }));
          continue;
        }
        back.push(f);
      }
      assert.equal(sha(JSON.stringify(back)), b.findings, `${b.label}: the other findings unchanged, in order`);
    }
  });

  // ── TC-163-002 scope 0: type headings to the rules (D67) ──
  test('TC-163-002 scope 0: notams keeps the headings; v1.14.0 shows / hides every item as with v0.3.0\'s text except the change list\'s OBSTACLE items', () => {
    const hm = s => { const m = /(\d{2}) (\d{2}):(\d{2})/.exec(s); return { d: +m[1], m: +m[2] * 60 + +m[3] }; };
    const windowsOf = a => [{ role: 'DEST', eta: null }, ...a.briefing.roles.map(x => {
      const s = hm(x.start), e = hm(x.end);
      return { role: x.role === 'DEPARTURE' ? 'ORIG' : 'DEST', eta: (s.m + Math.round(((e.d - s.d) * 1440 + e.m - s.m) / 2) + 1440) % 1440 };
    })];
    const depOf = r => /^\d{4}$/.test(r.offFromOFP) ? (+r.offFromOFP.slice(0, 2)) * 60 + +r.offFromOFP.slice(2) : null;
    const listed = new Set(CHANGES.entries.filter(e => e.fmt === 'FK' && e.byHeadingOnly && e.group === 'B').map(e => e.key));
    assert.equal(CHANGES.version, '1.2');
    const differ = new Set();
    let airports = 0, items = 0, calls = 0, headings = 0;
    for (const fx of fk) {
      const r = run(fx), prof = acProf.buildAcftProfile(r.acftType);
      for (const [icao, a] of Object.entries(r.airportData)) {
        if (!a.notamItems || !a.notamItems.length) continue;
        airports++;
        // the heading lines of notams = those of notamsRaw, in order, with their centring
        const hs = a.notams.split('\n').filter(isHeadingLine);
        assert.deepEqual(hs, a.notamsRaw.split('\n').filter(isHeadingLine), `${L(fx)} ${icao}: the printed headings, in printed order`);
        headings += hs.length;
        const withH = NR14._splitNotams(a.notams), without = NR14._splitNotams(v03(a.notams));
        assert.equal(withH.join(''), a.notams);
        const itemsW = withH.filter(p => NR14._fkHeader(p));
        assert.equal(itemsW.length, a.notamItems.length, `${L(fx)} ${icao}: v1.14.0 cuts the headings out: the items are notamItems`);
        itemsW.forEach((p, k) => assert.equal(NR14._fkHeader(p).id, a.notamItems[k].id));
        items += itemsW.length;
        for (const w of windowsOf(a)) {
          const sw = new Set(NR14.evalNotams(withH, w.role, w.eta, prof, fx.date, depOf(r), acProf.getWingspan).issues.map(i => i.notamRaw && i.notamRaw.replace(/\s+$/, '')));
          const so = new Set(NR14.evalNotams(without, w.role, w.eta, prof, fx.date, depOf(r), acProf.getWingspan).issues.map(i => i.notamRaw && i.notamRaw.replace(/\s+$/, '')));
          calls += 2;
          a.notamItems.forEach((it, k) => {
            const t = itemsW[k].replace(/\s+$/, '');
            if (sw.has(t) !== so.has(t)) {
              const h = NR14._fkHeader(itemsW[k]);
              differ.add(`FK ${fx.id} ${h.locations.join(' ')} ${h.id} ${it.category || '-'}`);
            }
          });
        }
      }
    }
    assert.equal(airports, 135); assert.equal(items, 2292); assert.equal(headings, 635);
    assert.ok([...differ].every(k => / OBSTACLE$/.test(k)), 'only OBSTACLE-category items differ');
    assert.ok([...differ].every(k => listed.has(k)), 'every differing item is in the change list v1.2 (FK, by the OBSTACLE heading, group B)');
    assert.deepEqual([...differ].sort(), [...listed].sort(), 'and every such change-list item differs');
    console.log(`TC-163-002: ${airports} airports, ${items} items, ${headings} headings; ${calls} v1.14.0 evaluations (no window and each role window); differ only for the ${differ.size} OBSTACLE-category items of the change list v1.2`);
  });

  // ── TC-163-011 Company NOTAMs ──
  test('TC-163-011 Company NOTAMs on all 26: 298 = 26 HSCN + 272; = grammar §A.2 and the independent reading', () => {
    needExp();
    let hscn = 0, co = 0, pairs = 0, contact = 0;
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx), c = r.companyNotams;
      const h = c.filter(x => x.origin === 'HSCN'), k = c.filter(x => x.origin === 'COMPANY');
      assert.equal(h.length, grammar[lbl].hscn, `${lbl}: HSCN items = grammar §A.2`);
      assert.equal(k.length, grammar[lbl].company, `${lbl}: Company items = grammar §A.2`);
      assert.ok(h.every(x => x.severity === 'high') && k.every(x => x.severity === 'normal'));
      assert.ok(c.every(x => x.id && x.subject), `${lbl}: every item has an ID and a SUBJECT`);
      assert.ok(c.every(x => x.location === 'GENERAL' || /^[A-Z0-9]{4}$/.test(x.location)));
      assert.ok(!c.some(x => x.location === 'PUBS'), 'PUBS- is no location (O-40)');
      // the HSCN item is also printed in the Company NOTAMs: both kept (O-40)
      for (const x of h) if (k.some(y => y.id === x.id)) pairs++;
      // independent reading (test/lib/fk-briefing.js): the same texts, in order
      const ind = fkb.packageItems(load(fx).items);
      assert.deepEqual(h.map(x => x.text), ind.filter(x => x.kind === 'HSCN').map(x => x.text), `${lbl}: HSCN texts = the independent reading`);
      assert.deepEqual(k.map(x => x.text), ind.filter(x => x.kind === 'COMPANY').map(x => x.text), `${lbl}: Company texts = the independent reading (line breaks kept)`);
      assert.ok(c.every(x => !/^Contact Dispatch for a preflight briefing\.$/m.test(x.text)), `${lbl}: the Contact Dispatch line in no item`);
      contact += load(fx).items.pages.reduce((n, p) => n + fkb.pageLines(p).left.concat(fkb.pageLines(p).right).filter(t => /^\s*Contact Dispatch for a preflight briefing\.$/.test(t)).length, 0);
      // pinned values (fixtures expected/)
      assert.deepEqual(c.map(x => [x.id, x.location, x.subject, x.origin, sha(x.text)]), EXP.packages[fx.id].companyNotams, `${lbl}: = expected/`);
      hscn += h.length; co += k.length;
    }
    assert.deepEqual([hscn, co, hscn + co], [26, 272, 298]);
    assert.equal(pairs, 26, 'the P0110-type pair in 26/26, never merged');
    console.log(`TC-163-011: ${hscn + co} Company NOTAMs (${hscn} HSCN + ${co} Company) = grammar §A.2 and the independent reading; HSCN/Company pairs kept ${pairs}; "Contact Dispatch for a preflight briefing." lines left out: ${contact}`);
  });

  // ── TC-163-021 curfews ──
  test('TC-163-021 curfews on all 26: 16 CURFEW items in 10 packages; strings = expected/; curfew-like items named', () => {
    needExp();
    let items = 0;
    const pkgs = new Set(), like = [];
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx);
      const cf = r.companyNotams.filter(x => x.origin === 'COMPANY' && /^[A-Z0-9]{4}-CURFEW$/.test(x.subject));
      items += cf.length; if (cf.length) pkgs.add(lbl);
      for (const x of cf) assert.ok(r.airportData[x.location] && r.airportData[x.location].curfew, `${lbl} ${x.location}: curfew read`);
      const got = Object.fromEntries(Object.entries(r.airportData).filter(([, a]) => 'curfew' in a).map(([i, a]) => [i, a.curfew]));
      assert.deepEqual(got, EXP.packages[fx.id].curfew, `${lbl}: curfew strings = expected/`);
      for (const s of Object.values(got)) {
        assert.ok(!/LCL|LOCAL\)/.test(s), `${lbl}: no local-time bracket (O-35)`);
        assert.ok(parseCurfewWindows(s).length >= 1, `${lbl}: the app reads a window`);
      }
      for (const f of infos(r, /^airportData\.curfew$/)) { const m = /^(\w{4}): Company NOTAM \S+ \(SUBJECT: (.*)\) reads like a curfew/.exec(f.message); if (m) like.push(`${lbl} ${m[2]}`); }
    }
    assert.equal(items, 16); assert.equal(pkgs.size, 10);
    assert.deepEqual([...pkgs].sort(), ['L02', 'L03', 'L09', 'L14', 'L18', 'L20', 'L23', 'T1', 'T2', 'T3']);
    assert.deepEqual(like.sort(), ['L03 ZHCC-RWY CLSD', 'L06 LLBG-RWY 30', 'L07 LLBG-RWY 30', 'L23 ETAR-RAMP CLSR', 'T1 EHAM-ARRL CRF', 'T1 EHAM-INTAM'], 'O-37: the 5 curfew-like items (LLBG in 2 packages)');
    // O-33 on the corpus: RJAA by type — the B744 packages take the 1400Z line, the B77L package the 1500Z line
    const rjaa = l => Array.from(parseCurfewWindows(run(byL(l)).airportData.RJAA.curfew), win);
    assert.deepEqual([rjaa('L02'), rjaa('L18'), rjaa('L14')], [['1400-2100'], ['1400-2100'], ['1500-2100']]);
    // O-34 on the corpus: T1 EHAM (27 Oct, changeover month) both windows + note; L23 ETAR undated → all + note + WARN
    assert.ok(run(byL('T1')).airportData.EHAM.curfew.endsWith(mod.CURFEW_NOTES.changeover));
    assert.ok(run(byL('L23')).airportData.ETAR.curfew.endsWith(mod.CURFEW_NOTES.dates));
    assert.equal(warns(run(byL('L23')), /^airportData\.curfew$/).length, 1);
    assert.equal(fk.reduce((n, fx) => n + warns(run(fx), /^airportData\.curfew$/).length, 0), 1, 'the one curfew WARN of the 26 is L23 ETAR');
    console.log(`TC-163-021: ${items} CURFEW items in ${pkgs.size} packages read; curfew-like items under other keys: ${like.length}`);
  });

  // ── TC-163-070 ops notes ──
  test('TC-163-070b ops notes on all 26: one per airport, curfew items out, 3 repeats, no new entry; = expected/', () => {
    needExp();
    const repeats = [], noEntry = [];
    let notes = 0;
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx);
      for (const f of infos(r, /^airportData\.opsNotes$/)) {
        if (/repeats the OFP Remarks/.test(f.message)) repeats.push(`${lbl} ${f.message.slice(0, 4)}`);
        if (/no airportData entry/.test(f.message)) noEntry.push(`${lbl} ${f.message.slice(0, 4)}`);
      }
      const got = {};
      for (const [icao, a] of Object.entries(r.airportData)) {
        if (!('opsNotes' in a)) continue;
        notes++;
        assert.equal(a.opsNotes.header, `${icao} COMPANY NOTAMS`);
        assert.ok(!/^SUBJECT: \w{4}-CURFEW$/m.test(a.opsNotes.body), `${lbl} ${icao}: no CURFEW item in opsNotes`);
        got[icao] = sha(a.opsNotes.body);
      }
      assert.deepEqual(got, EXP.packages[fx.id].opsNotes, `${lbl}: opsNotes = expected/`);
    }
    assert.deepEqual(repeats.sort(), ['L06 LEZG', 'L09 VHHH', 'L21 NZWN'], 'O-38: the Company items that repeat the OFP Remarks');
    assert.deepEqual(noEntry.sort(), ['L13 UAAA', 'L13 UAAA'], 'O-39: no entry created (L13 UAAA, two items)');
    console.log(`TC-163-070: ${notes} airports with opsNotes; repeats left out: ${repeats.join(', ')}`);
  });

  // ── TC-163-031 FIR NOTAMs ──
  test('TC-163-031 FIR NOTAMs on all 26: 221 blocks, 989 items, 43 empty; = the independent reading; firRaw; repeats kept', () => {
    needExp();
    let blocks = 0, items = 0, empty = 0, noHead = 0, company = 0, rawHeadings = 0;
    const repeats = [], noHeadAt = new Set();
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx);
      assert.equal(r.firNotams.length, grammar[lbl].firNotam, `${lbl}: FIR blocks = grammar §A.2`);
      const nItems = r.firNotams.reduce((n, b) => n + b.items.filter(i => i.origin === 'NOTAM').length, 0);
      assert.equal(nItems, grammar[lbl].firItems, `${lbl}: FIR items = grammar §A.2`);
      blocks += r.firNotams.length; items += nItems;
      empty += r.firNotams.filter(b => b.empty).length;
      company += r.firNotams.reduce((n, b) => n + b.items.filter(i => i.origin === 'COMPANY').length, 0);
      // independent reading: every NOTAM-Briefing item that is not an airport item is a FIR item (multiset)
      const ind = fkb.packageItems(load(fx).items).filter(x => x.kind === 'NOTAM').map(x => x.text);
      const apt = Object.values(r.airportData).flatMap(a => a.notams ? NR._splitNotams(v03(a.notams)).map(p => p.replace(/\n$/, '')) : []);
      const rest = ind.slice();
      for (const t of apt) { const k = rest.indexOf(t); assert.ok(k >= 0, `${lbl}: airport item in the independent reading`); rest.splice(k, 1); }
      const mine = r.firNotams.flatMap(b => b.items.filter(i => i.origin === 'NOTAM').map(i => i.text));
      assert.deepEqual(mine.slice().sort(), rest.sort(), `${lbl}: FIR item texts = the independent reading`);
      // firRaw: every item once, under its heading, in printed order; no Company item
      r.firRaw.forEach((raw, bi) => {
        const b = r.firNotams[bi];
        assert.deepEqual([raw.name, raw.code], [b.name, b.code]);
        const lines = raw.raw.split('\n');
        let at = 0, cat = '';
        for (const it of b.items.filter(i => i.origin === 'NOTAM')) {
          while (at < lines.length && !lines.slice(at, at + it.text.split('\n').length).join('\n').startsWith(it.text.split('\n')[0])) {
            if (isHeadingLine(lines[at])) { cat = lines[at].trim(); rawHeadings++; }
            at++;
          }
          assert.equal(lines.slice(at, at + it.text.split('\n').length).join('\n'), it.text, `${lbl} ${b.code} ${it.id}: in firRaw as printed`);
          assert.equal(it.category, cat, `${lbl} ${b.code} ${it.id}: category = the heading above it in firRaw`);
          if (!cat) { noHead++; noHeadAt.add(lbl); }
          at += it.text.split('\n').length;
        }
        for (; at < lines.length; at++) if (isHeadingLine(lines[at])) rawHeadings++;
        assert.ok(!b.items.filter(i => i.origin === 'COMPANY').some(i => raw.raw.includes(i.text.split('\n')[0])), `${lbl} ${b.code}: no Company item in firRaw`);
        assert.equal(b.empty, !b.items.length);
        if (b.empty) assert.ok(/THERE ARE NO ACTIVE NOTAMS FOR FIR/.test(raw.raw), `${lbl} ${b.code}: empty block prints the empty-state box`);
      });
      // the FIR text: the non-empty blocks, block name first, no heading, no empty block
      const txt = r.enrouteNotams.fir;
      assert.ok(!txt.split('\n').some(isHeadingLine), `${lbl}: no type heading in enrouteNotams.fir`);
      assert.deepEqual(txt.split('\n\n').map(s => s.split('\n')[0]), r.firNotams.filter(b => !b.empty).map(b => `${b.name} (${b.code})`), `${lbl}: one block per non-empty FIR, name first`);
      // repeats: the same location(s) + ID under more than one FIR block — kept (O-41)
      const seen = new Map();
      for (const b of r.firNotams) for (const i of b.items.filter(x => x.origin === 'NOTAM')) {
        const h = NR._fkHeader(i.text), key = `${h.locations.join(' ')} ${h.id}`;
        if (!seen.has(key)) seen.set(key, new Set());
        seen.get(key).add(b.code);
      }
      for (const [k, s] of seen) if (s.size > 1) repeats.push(`${lbl} ${k}`);
      assert.deepEqual(r.firNotams.map(b => [b.code, b.empty, b.items.map(i => [i.id, i.category, i.origin, sha(i.text)])]), EXP.packages[fx.id].firNotams, `${lbl}: firNotams = expected/`);
    }
    assert.deepEqual([blocks, items, empty], [221, 989, 43]);
    assert.equal(company, 3, 'O-40: RCAA-GUARD (L04, L09) and VGFR-VGFRADC (L17) listed with their FIR');
    assert.equal(noHead, 4); assert.deepEqual([...noHeadAt], ['L15'], 'the 4 ASHTAMs without a heading (L15)');
    const repPk = new Set(repeats.map(x => x.split(' ')[0]));
    console.log(`TC-163-031: ${blocks} FIR blocks, ${items} items (= grammar §A.2 and the independent reading), ${empty} empty, ${company} Company items with their FIR, ${noHead} items with no heading; headings in firRaw ${rawHeadings}; FIR NOTAMs printed under more than one FIR block: ${repeats.length} in ${repPk.size} packages (kept)`);
  });

  // ── TC-163-040 hazards ──
  test('TC-163-040b hazards on all 26: 221 blocks, 66 empty, 1,980 products; never airport weather, weatherRaw or E-WINS', () => {
    needExp();
    const HEAD = /^(?:TWC (?:FPG|SIGMET) - |AIRMET |SIGMET |CONVECTIVE SIGMET )/;
    let blocks = 0, empty = 0, products = 0;
    const kinds = {};
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx);
      assert.equal(r.hazards.length, grammar[lbl].firWx, `${lbl}: hazard blocks = grammar §A.2`);
      assert.deepEqual(r.hazards.map(h => h.code), r.firNotams.map(b => b.code), `${lbl}: the same FIR list as the NOTAM Briefing`);
      blocks += r.hazards.length; empty += r.hazards.filter(h => h.empty).length;
      const wx = Object.values(r.airportData).map(a => [a.weather, a.weatherRaw, a.ewinsWeather].join('\n')).join('\n');
      for (const h of r.hazards) {
        for (const l of h.text.split('\n')) {
          const t = l.trim();
          if (HEAD.test(t)) { products++; const k = t.split(' - ')[0].split(' ').slice(0, 2).join(' '); kinds[k] = (kinds[k] || 0) + 1; }
        }
        if (h.empty) assert.ok(/THERE ARE NO ACTIVE SIGMET/.test(h.text));
      }
      assert.ok(!/^\s*(?:TWC FPG|TWC SIGMET|AIRMET|CONVECTIVE SIGMET)\b/m.test(wx), `${lbl}: no hazard product in airport weather, weatherRaw or E-WINS`);
      assert.deepEqual(r.hazards.map(h => [h.code, h.empty, sha(h.text)]), EXP.packages[fx.id].hazards, `${lbl}: hazards = expected/`);
    }
    assert.deepEqual([blocks, empty, products], [221, 66, 1980]);
    console.log(`TC-163-040: ${blocks} hazard blocks, ${empty} with no SIGMET, ${products} products (grammar §A.9 forms: ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')})`);
  });

  // ── TC-163-051 NAT ──
  test('TC-163-051 NAT on all 26: 5 packages, 6 messages; L12 307 returned (308 kept); L08 / L22 alert; L11 filed track', () => {
    needExp();
    let msgs = 0;
    const pk = [];
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx);
      if (r.natMessages.length) pk.push(lbl);
      msgs += r.natMessages.length;
      for (const m of r.natMessages) {
        assert.ok(m.complete && m.tmi && m.direction, `${lbl}: message complete, TMI and direction read`);
        assert.ok(!/^NAT-TRACKS$/m.test(m.text), `${lbl}: page headings removed`);
        assert.ok(m.parts >= 2 && m.pages[1] >= m.pages[0]);
      }
      assert.equal(r.natMessages.filter(m => m.selected).length, r.natTrack ? 1 : 0);
      if (r.natTrack) assert.equal(r.natTrack.tmi, r.natMessages.find(m => m.selected).tmi, `${lbl}: natTrack is the selected message`);
      assert.deepEqual({ natMessages: r.natMessages.map(m => [m.tmi, m.direction, m.valid, m.parts, m.pages, m.selected, sha(m.text)]),
        natTrack: r.natTrack ? [r.natTrack.tmi, r.natTrack.flightDir, r.natTrack.assignedId] : null }, EXP.packages[fx.id].nat, `${lbl}: NAT = expected/`);
    }
    assert.deepEqual(pk, ['L08', 'L11', 'L12', 'L22', 'L23']);
    assert.equal(msgs, 6);
    const l12 = run(byL('L12'));
    assert.deepEqual(l12.natMessages.map(m => [m.tmi, m.direction, m.selected]), [['308', 'EAST', false], ['307', 'WEST', true]], 'L12 (westbound): 307 returned, 308 in natMessages[] (O-42)');
    assert.equal(l12.natTrack.tmi, '307');
    for (const [l, tmi, dir] of [['L08', '308', 'EAST'], ['L22', '315', 'WEST']]) {
      const r = run(byL(l));
      assert.equal(r.natTrack.tmi, tmi, `${l}: the one message returned`);
      assert.equal(warns(r, /^natTrack$/).filter(f => new RegExp(`^CREW ALERT: .*none for this ${dir}BOUND flight`).test(f.message)).length, 1, `${l}: crew-alert WARN`);
    }
    assert.deepEqual(['L11', 'L12', 'L23'].map(l => warns(run(byL(l)), /^natTrack$/).length), [0, 0, 0], 'NEGATIVE: the flight\'s direction printed → no alert');
    assert.equal(run(byL('L11')).natTrack.assignedId, 'W', 'L11: filed track from the route string');
    assert.deepEqual(['L08', 'L12', 'L22', 'L23'].map(l => run(byL(l)).natTrack.assignedId), [null, null, null, null], 'random routes: none (L23 remarks name tracks: never read, O-43)');
    console.log(`TC-163-051: ${msgs} NAT messages in ${pk.length} packages, all complete; returned ${pk.map(l => `${l} ${run(byL(l)).natTrack.tmi}`).join(', ')}`);
  });

  // ── TC-163-060 PACOTS ──
  test('TC-163-060b PACOTS on all 26: 38 items, 13 sets, 10 packages; no track object', () => {
    let items = 0, sets = 0;
    const pk = [];
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx);
      const n = r.firNotams.flatMap(b => b.items).filter(i => i.origin === 'NOTAM' && /\bPACOTS\s+TRACKS\b/.test(i.text)).length;
      const s = r.sections.filter(x => x.id === 'pacots');
      if (n) { pk.push(lbl); assert.ok(s.length >= 1, `${lbl}: a PACOTS section`); assert.equal(r.natTrack, null, `${lbl}: natTrack null`); }
      else assert.equal(s.length, 0);
      for (const x of s) assert.ok(r.firNotams.some(b => b.items.some(i => i.id === x.anchor && i.source[0].page === x.startPage)), `${lbl}: anchor = an item ID on the start page`);
      items += n; sets += s.length;
    }
    assert.deepEqual([items, sets, pk.length], [38, 13, 10]);
    console.log(`TC-163-060: ${items} PACOTS items, ${sets} sets (sections) in ${pk.length} packages: ${pk.join(', ')}`);
  });
}

// ── TC-163-090: a missing fixtures repo is a FAILURE (child run) ──
if (!process.env.TC163_CHILD) test('TC-163-090 fixtures missing → the fixture tests FAIL, never skip', () => {
  const env = Object.assign({}, process.env, { PB_FIXTURES: path.join(ROOT, 'no-such-dir'), TC163_CHILD: '1' });
  delete env.NODE_TEST_CONTEXT;
  const out = spawnSync(process.execPath, ['--test', __filename], { env, encoding: 'utf8' });
  assert.notEqual(out.status, 0, 'child run fails');
  assert.match(out.stdout, /pilotbrief-fixtures not found/);
});
