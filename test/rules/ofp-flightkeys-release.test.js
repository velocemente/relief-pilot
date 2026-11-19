'use strict';
/**
 * TC-161 — FlightKeys OFP parser v0.2.0 (rules/ofp-flightkeys, development version, D58):
 * the release and remarks pages. TC-160 (test/rules/ofp-flightkeys.test.js) keeps testing the
 * v0.1.0 fields; this battery tests what v0.2.0 adds.
 *
 *   TC-161-001  v0.1.0 fields byte-identical: v0.2.0 vs the recorded v0.1.0 output on all 26 FlightKeys
 *               fixtures (SHA-256 per field, specialQualification, v0.1.0 findings in order); the only
 *               airportData change is one entry added for a remarks-weather alternate (L15 PWAK)
 *   TC-161-002  5b-1 QA F4: the FPL block is read from the release, never from an earlier "(FPL-"
 *   TC-161-010  crew (row 26, SC) on 26 fixtures: values against the PRIVATE expected file in the
 *               fixtures repo; public assertions are counts, roles and flags; operating pilots per package
 *               (D62); "*" never seniority (SME-3/3a); blank expiry "Not Reported" (SME-9); FA/PU/MX/LM
 *               not crew; DH/JS as NavBlue
 *   TC-161-011  crew synthetic, positive and negative; QA F2: a crew block planted before the release is never read
 *   TC-161-020  CAT II/III (row 24, SC) on 26 fixtures: authorisations (NavBlue form) and restrictions
 *   TC-161-021  CAT II/III synthetic (SME-10), positive and negative
 *   TC-161-030  MEL/CDL/DDG (row 25) on 26 fixtures: items, type, notes, TLR cross-reference (row 32a)
 *   TC-161-031  MEL/CDL/DDG synthetic: wraps, notes with indentation (positions), ADHOC lines, repeated items kept,
 *               late addition (SME-19) positive and negative, TLR cross-reference
 *   TC-161-032  TLR (row 32) on 26 fixtures = NavBlue, except the page-break leak NavBlue has (L10);
 *               synthetic page-break case
 *   TC-161-040  FK-P matched pair (FK UAAA-EHAM prototype vs EOFP matched pair) for every field in scope
 *   TC-161-050  remarks on 26 fixtures: ofpRemarks and its categories; airport remarks (D34) incl. the
 *               fleet rule (SME-18a); takeoff-alternate flag (SME-18); remarks weather (D34, D46, SME-23);
 *               perishables (27); temperature control (28, D55); security (D45); extra fuel (D39); PCF
 *               (SME-7); permits (35); revision
 *   TC-161-051  remarks synthetic, a negative test per rule
 *   TC-161-100  D63 on the fixtures: a wrapped airport remark is ONE remark (L21 NFFN, L06 LEZG, L09 VHHH), with
 *               its printed line breaks; adjacent marked items stay separate (L21 NZWN, NFFN); counts per package
 *   TC-161-101  D63 synthetic: a new remark only at the block's own marker; adjacent marked items stay two; a
 *               sub-heading always starts a new item; a remark across a page break; the SME-18 flag on a wrapped item
 *   TC-161-102  D63 on the ADHOC block (dash items): wraps join the item above
 *   TC-161-103  O-11 (Exec, 18 Nov): a marked item printed across a blank line stays one remark; the next marker splits
 *   TC-161-200  D63a on the fixtures: the 2-line exemption, the 3-line fleet note, the CDC attestation (and the
 *               boilerplate, MEL-change and weather paragraphs) are ONE remark each; records per package
 *   TC-161-201  D63a synthetic: a blank line, a sub-heading or a recognised item ends a remark; a one-line item never
 *               takes a continuation; a paragraph across a page break; the reason lists keep their line breaks
 *   TC-161-202  O-10 (1), Exec 17 Nov: a fixed-length recognised item never takes a continuation (every one-line kind,
 *               the boilerplate to "questions."; T3 on the fixtures)
 *   TC-161-203  O-10 (2), Exec 17 Nov: a page break is not a blank line (a remark continues across it; a blank line splits)
 *   TC-161-300  QA F1: the tests' copy of the app reader (appText) rebuilds the text of all 26 fixtures from their items
 *   TC-161-301  QA F1 cases on a copy of the real items (L15 PHNL-WIHH, L17 OMAA-VHHH): an unrelated line after a printed
 *               blank line never joins the PWAK weather or the PCF reason; the same item moved up one pitch joins
 *   TC-161-302  QA F1 synthetic: a blank line is a gap in the positions (≥ 1.6 × the release pitch); normal spacing joins;
 *               a gap at a page break never splits; CDC; no / mismatched positions → no blank line + WARN
 *   TC-161-303  QA F1 on the 26: joined remarks = printed lines in order; every printed blank line in an unmarked block ends
 *               a remark
 *   TC-161-304  QA F3 on the 26: an MEL/CDL note keeps its printed line breaks (L13, L19)
 *   TC-161-090  fixtures (or the private crew file) missing → FAIL, never skip (child run)
 *
 * v0.3.0 (the briefing, TC-162 in test/rules/ofp-flightkeys-briefing.test.js) changes this battery only where
 * it assumed the briefing unread: OPTS passes the NOTAM ruleset (as the app passes it); TC-161-001 accepts the
 * airportData entries v0.3.0 adds for briefing airports (after the v0.1.0 entries, each with its briefing
 * record); TC-161-050 checks that remarks weather never enters the briefing weather (it was '' before v0.3.0).
 *
 * Synthetic packages are parsed as the app delivers them (appInput): positioned items with a 13.2 pt pitch, the text
 * rebuilt by the app's line reader; a printed blank line (BL) is a gap in the positions, never an empty text line.
 * Fixtures: PB_FIXTURES (authoritative when set), else ./fixtures or ../pilotbrief-fixtures.
 * Messages name fixture labels and field names only; no crew data is printed. Synthetic packages use
 * made-up identifiers and obviously fake names.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { findFixtures, readManifest } = require('../lib/app-path');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const mod      = require(path.join(RULES, MANIFEST['ofp-flightkeys'].file));
const icaoFpl  = require(path.join(RULES, MANIFEST['icao-fpl'].file));
const acProf   = require(path.join(RULES, MANIFEST['aircraft-profile'].file));
const navblue  = require(path.join(RULES, MANIFEST['ofp-navblue'].file));
const notamRules = require(path.join(RULES, MANIFEST['notam-rules'].file));
const OPTS     = { icaoFpl, aircraftProfile: acProf, notamRules };
const BASELINE = require('./data/ofp-flightkeys-v0.1.0-baseline.json');
const EXPECTED = require('./data/ofp-flightkeys-expected-v0.2.0.json').fixtures;
const CREW_FILE = path.join('expected', 'ofp-flightkeys-v0.2.0', 'crew.json');

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const warns = (r, field) => r.findings.filter(f => f.level === 'WARN' && (!field || f.field === field));
const infos = (r, field) => r.findings.filter(f => f.level === 'INFO' && (!field || f.field === field));

// ── synthetic FlightKeys package (made-up identifiers, fake names; no fixture data) ──
const HDR = 'TST0001/08MAR/KAAA-KBBB/N000ZZ';
const CREW_DEFAULT = [
  'CA 100001 Sample, Alpha .. .. .. .. ..', 'TO/LNDG Expiry: 2027-01-01',
  'FO 100002 * Example, Bravo Q. .. .. .. .. ..', 'TO/LNDG Expiry:',
  'TO/LNDG currency questions? contact Duty Pilot',
  'FA 7000001 Cabin, Charlie (Chuck)', 'PU 7000002 Purser, Della', 'MX 20001 MECH DELTA', 'LM 20002 LOAD ECHO',
  'JS 0 RIDER FOXTROT G', 'DH 100003 Dead, Golf',
];
function pkg(o = {}) {
  const title = o.title || 'OPERATIONAL FLIGHT PLAN RLS 01 08MAR26 12:00';
  const airports = o.airports || ['ORIG KAAA/AAA ALPHA INTL N40000W080000 1755Z', 'DEST KBBB/BBB BRAVO INTL N41000W081000 0328Z',
    'PALT KCCC/CCC CHARLIE N42000W082000 0345Z'];
  const fuel = o.fuel || ['TRIP 100000 09.33 4000', 'CONT 003000 00.10', 'ALT1 008000 00.25 0200', 'FRES 007000 00.30',
    `PCF ${o.pcf || '002000'} 00.07`, 'MINF 120000 10.45 ....', `EXTRA ${o.extra || '001500'} 00.05`, 'TOF 121500 10.50',
    'TAXI 001000 00.20', 'BLOCK 122500 11.10', 'REMF 020000 01.12'];
  const p1 = ['TST0001/08 KAAA - KBBB 08 MAR 26 N000ZZ', 'COST INDEX 020 Revision: ' + (o.revision || '1.0'),
    `${o.acftLine || 'B747-400F / CF6-80C2-B1F / KG'} / IFR / FF +4.0`, 'PROGS 081200 Release Valid Until 2300Z 08MAR26',
    ...airports, ...fuel];
  // o.remarksNextPage: remark lines printed at the top of the next release page (a page break inside the Remarks)
  const p2a = ['Remarks', 'DISPATCHER DESK: 00', 'This OFP prepared with FlightKeys. Review Operations Bulletin',
    'for FlightKeys OFP and procedure changes. Contact Dispatch with', 'questions.', ...(o.remarks || [])];
  const p2 = [...(o.remarksNextPage || []),
    'RAIM VALIDATION PASSED', ...(o.cat || []), 'MEL/CDL', ...(o.mel || []), 'Flight Release Authorization',
    'I certify that this flight has been dispatched in accordance with', ...(o.afterAuth || []),
    'Signed by PIC .. .. .. .. (Circle name below)', 'Signed by Dispatcher: DISPATCHER', 'Fit for Duty Affirmation', 'By signing below, I affirm that I am fit for duty to operate this',
    'flight.', 'FIT FOR DUTY/   RELIEF PIC', 'JS VERIFY   START-END(Z)', ...(o.crew || CREW_DEFAULT)];
  const p3 = ['TIME FUEL', ...(o.fpl || ['(FPL-TST0001-IS', `-${o.fplType || 'B744/H'}-SDE1E2E3FGHIJ3J5M1P2RWXYZ/LB1D1`, '-KAAA1755',
    '-N0481F320 DCT AAAAA DCT BBBBB', '-KBBB0933 KCCC', '-PBN/A1B1 DOF/260308 REG/N000ZZ SEL/ABCD RMK/TCAS II EQUIPPED)']),
    'Overflight/Landing Permits', ...(o.permits || [])];
  const p4 = ['AWY   WPT   MTK   NM   GS   TAS   LEG-T   ETA   MTRS   ISA   WC   REMF',
    'MORA  TTK  MH  IAS  .M  TOT-T  ATA  FL  TEMP  WIND  AREM', 'SID TOC', 'N40 10.0 090 50 400 450 00.15', 'W079 50.0 090 090 300 .80 00.15 320',
    'Destination Primary Alternate Route', 'KBBB DCT KCCC', 'KCCC/0100', 'GCD 50 GDIS 55 FUEL 8000 TIME 00.25', 'MORA 3000'];
  const pages = o.remarksNextPage ? [p1, p2a, p2, p3, p4] : [p1, [...p2a, ...p2], p3, p4];
  const relPages = n => pages.map((b, i) => [HDR, title, ...b, `FUFI: 00000000-0000-0000-0000-00000000000${n} PAGE ${i + 1}/${pages.length}`].join('\n') + '\n\n').join('');
  let copies = relPages(0);
  for (let c = 1; c < (o.copies || 1); c++) copies += o.copyDiffers ? relPages(c).replace('DISPATCHER DESK: 00', 'DISPATCHER DESK: 01') : relPages(0);
  const tlr = o.tlr ? o.tlr.map((b, i) => ['REL 1/1 08MAR26 1200Z TST0001 KAAA/KBBB 08MAR26', ...b,
    `FUFI00000000-0000-0000-0000-000000000000 PAGE ${i + 1}/${o.tlr.length}`].join('\n') + '\n\n').join('') : '';
  return (o.before || 'BRIEFING COVER PAGE') + '\n\n' + copies + (o.after || 'COMPANY NOTAMS\nGENERAL') + '\n\n' + tlr;
}
// ── the input exactly as the app delivers it (QA F1, 17 Nov) ──
// appText(): a copy of the line reconstruction in processPDF() (src/pdf.html; the same copy as
// tools/extract/extract.js), run on positioned items. TC-161-300 checks that it rebuilds the text of
// all 26 fixtures from their items byte for byte. The app writes no empty line inside a page, so a
// printed blank line exists only as a gap in the items' y positions.
function appLines(p) {   // one page: [{ y, str }], top to bottom, as processPDF() builds its lines
  const lines = [];
  p.items.slice().sort((a, b) => a.order - b.order).forEach(item => {
    if (!item.str) return;
    let bucket = lines.find(l => Math.abs(l.y - item.y) <= 2);
    if (!bucket) { bucket = { y: item.y, items: [] }; lines.push(bucket); }
    bucket.items.push({ x: item.x, str: item.str, w: item.w || 0 });
  });
  lines.sort((a, b) => a.y - b.y);
  const out = [];
  lines.forEach(line => {
    line.items.sort((a, b) => a.x - b.x);
    let lineStr = '', prevRight = null;
    line.items.forEach(item => {
      if (prevRight !== null) { const gap = item.x - prevRight; lineStr += gap > 20 ? '   ' : gap > 8 ? '  ' : gap > 3 ? ' ' : ''; }
      lineStr += item.str;
      prevRight = item.x + (item.w || item.str.length * 5);
    });
    if (lineStr.trim()) out.push({ y: line.y, str: lineStr });
  });
  return out;
}
function appText(pages) {
  return pages.map(p => appLines(p).map(l => l.str + '\n').join('') + '\n').join('');   // '\n' = page break
}
// A synthetic package as the app reads it: every text line becomes one positioned item (13.2 pt
// pitch, the FlightKeys release pitch); a BL line is a printed blank line — no item, one pitch of
// empty space — so it reaches the module only as a gap. The text is then rebuilt with appText().
// x as the fixtures print it: 58.7, and 65.3 for a note line ("- " / "RMK -") in the MEL/CDL block.
const BL = '\u0000BLANK LINE';
const PITCH = 13.2;
function appInput(src) {
  let inMel = false;
  const pages = src.replace(/\n$/, '').split('\n\n').map((pg, i) => {
    const items = [];
    pg.split('\n').forEach((l, k) => {
      if (l === 'MEL/CDL') inMel = true; else if (/^Flight Release Authorization/.test(l)) inMel = false;
      const x = inMel && /^(?:RMK\s+-|-)\s/.test(l) ? 65.3 : 58.7;
      if (l !== BL) items.push({ str: l, x, y: 40 + k * PITCH, w: l.length * 5, h: 9.6, font: 'f1', order: items.length });
    });
    return { page: i + 1, width: 612, height: 792, items };
  });
  const text = appText(pages);
  assert.equal(text, src.split('\n').filter(l => l !== BL).join('\n'), 'appInput: the app reader gives back the package text');
  return { text, pages };
}
const parse = (text, opts = OPTS) => mod.parseFlightKeys(appInput(text), opts);
const parseTextOnly = (text, opts = OPTS) => mod.parseFlightKeys({ text: text.split('\n').filter(l => l !== BL).join('\n') }, opts);

// ══ TC-161-002 FPL from the release (QA F4) ══════════════════════════════════

test('TC-161-002 5b-1 QA F4: the FPL is read from the release, never from an earlier "(FPL-" block', () => {
  const quoted = 'HIGH SEVERITY COMPANY NOTAMS\n(FPL-TST9999-IS\n-B763/H-SDFGHIRWY/S\n-KZZZ0100\n-N0450F300 DCT\n-KYYY0500\n-DOF/260101 REG/N999ZZ)';
  const r = parse(pkg({ before: quoted }));
  assert.equal(r.acftType, 'B744', 'type from the release FPL, not the quoted one');
  assert.equal(r.flightDateISO, '2026-03-08');
  assert.deepEqual(warns(r, 'fltNum'), []);
  // positive control: without the release FPL nothing is taken from the quoted one
  const n = parse(pkg({ before: quoted, fpl: ['NO FLIGHT PLAN PRINTED'] }));
  assert.equal(n.acftType, '', 'no FPL in the release → no type (the quoted FPL is never used)');
  assert.ok(warns(n, 'icaoFpl').some(w => /no ICAO flight plan \(FPL\) block found in the release/.test(w.message)));
});

// ══ TC-161-011 crew synthetic ════════════════════════════════════════════════

test('TC-161-011 crew synthetic (row 26, SC; SME-3/3a, SME-9; D62): positive and negative', () => {
  const r = parse(pkg());
  assert.deepEqual(r.crewMembers.map(c => c.role), ['CA', 'FO', 'JS', 'DH'], 'FA, PU, MX, LM are not returned as crew');
  assert.deepEqual(Object.keys(r.crewMembers[0]), ['role', 'empNum', 'lastName', 'initial', 'displayName', 'active', 'isSen', ...mod.CREW_EXTENSION_FIELDS]);
  assert.deepEqual(r.crewMembers[0], { role: 'CA', empNum: '100001', lastName: 'Sample', initial: 'A', displayName: 'Sample A',
    active: true, isSen: false, firstName: 'Alpha', toLndgExpiry: '2027-01-01' });
  // "*" kept with the last name and never seniority (SME-3, SME-3a); blank expiry → Not Reported (SME-9)
  assert.deepEqual(r.crewMembers[1], { role: 'FO', empNum: '100002', lastName: '* Example', initial: 'B', displayName: '* Example B',
    active: true, isSen: false, firstName: 'Bravo Q.', toLndgExpiry: 'Not Reported' });
  // JS / DH as NavBlue: active false; the JS "0" is not an employee number
  assert.deepEqual(r.crewMembers[2], { role: 'JS', empNum: '', lastName: 'RIDER FOXTROT G', initial: '', displayName: 'RIDER FOXTROT G',
    active: false, isSen: false, firstName: '', toLndgExpiry: '' });
  assert.deepEqual(r.crewMembers[3], { role: 'DH', empNum: '100003', lastName: 'Dead', initial: 'G', displayName: 'Dead G',
    active: false, isSen: false, firstName: 'Golf', toLndgExpiry: '' });
  assert.equal(r.operatingPilots, 2, 'D62: two operating pilots (DH and JS not counted)');
  assert.ok(infos(r, 'crewMembers').some(f => f.message === 'crew lines not returned as crew (not shown): FA 1, LM 1, MX 1, PU 1'));
  assert.ok(infos(r, 'crewMembers').some(f => /Expiry blank for 1 pilot/.test(f.message)));
  assert.ok(infos(r, 'crewMembers').some(f => /"\*" printed for 1 pilot/.test(f.message)));
  assert.deepEqual(warns(r).filter(f => /crew|operatingPilots/.test(f.field)), []);
  // 3 and 4 pilots, a list crossing a page break (the repeated column headers are skipped)
  const pilot = (role, n) => [`${role} 10000${n} Pilot${n}, Name .. .. ..`, 'TO/LNDG Expiry: 2027-02-02'];
  const four = parse(pkg({ crew: [...pilot('CA', 1), ...pilot('FO', 2), 'FIT FOR DUTY/   RELIEF PIC', 'JS VERIFY   START-END(Z)',
    ...pilot('FO', 3), ...pilot('FO', 4), 'TO/LNDG currency questions? contact Duty Pilot'] }));
  assert.equal(four.operatingPilots, 4);
  assert.deepEqual(four.crewMembers.map(c => c.role), ['CA', 'FO', 'FO', 'FO']);
  assert.equal(parse(pkg({ crew: [...pilot('CA', 1), ...pilot('CA', 2), ...pilot('FO', 3)] })).operatingPilots, 3);
  // negative: an impossible date is never shown as a currency date
  const bad = parse(pkg({ crew: ['CA 100001 Sample, Alpha .. ..', 'TO/LNDG Expiry: 2027-02-30'] }));
  assert.equal(bad.crewMembers[0].toLndgExpiry, 'Not Reported');
  assert.ok(warns(bad, 'crewMembers').some(w => /not a date/.test(w.message)));
  // negative: no expiry line at all → Not Reported + WARN
  const none = parse(pkg({ crew: ['CA 100001 Sample, Alpha .. ..', 'FO 100002 Example, Bravo .. ..'] }));
  assert.deepEqual(none.crewMembers.map(c => c.toLndgExpiry), ['Not Reported', 'Not Reported']);
  assert.equal(warns(none, 'crewMembers').length, 2);
  // 5 pilots → counted, WARN; no crew list → [] + null + WARN
  const five = parse(pkg({ crew: [1, 2, 3, 4, 5].flatMap(n => pilot(n === 1 ? 'CA' : 'FO', n)) }));
  assert.equal(five.operatingPilots, 5);
  assert.ok(warns(five, 'operatingPilots').length === 1);
  const noList = parse(pkg().replace('Fit for Duty Affirmation', 'Fit for Duty'));
  assert.deepEqual(noList.crewMembers, []);
  assert.equal(noList.operatingPilots, null);
  assert.ok(warns(noList, 'crewMembers').length === 1);
  // negative: crew lines outside the release are never read
  const out = parse(pkg({ after: 'COMPANY NOTAMS\nCA 999999 Outside, Person .. ..\nTO/LNDG Expiry: 2027-01-01' }));
  assert.equal(out.crewMembers.filter(c => c.empNum === '999999').length, 0);
  // QA F2: a full crew block, heading included, on a briefing page BEFORE the release (where a reader of
  // the whole package would meet it first) is never read; the release crew is returned unchanged
  const planted = ['BRIEFING PAGE', 'Fit for Duty Affirmation', 'By signing below, I affirm that I am fit for duty to operate this', 'flight.',
    'FIT FOR DUTY/   RELIEF PIC', 'JS VERIFY   START-END(Z)', 'CA 999991 Planted, Uno .. .. .. .. ..', 'TO/LNDG Expiry: 2027-03-03',
    'FO 999992 Planted, Dos .. .. .. .. ..', 'TO/LNDG Expiry: 2027-03-03', 'FO 999993 Planted, Tres .. .. .. .. ..', 'TO/LNDG Expiry: 2027-03-03',
    'TIME FUEL'].join('\n');
  const pl = parse(pkg({ before: planted }));
  assert.deepEqual(pl.crewMembers, r.crewMembers, 'the release crew, not the planted block');
  assert.equal(pl.operatingPilots, 2, 'two operating pilots from the release (the planted block has three)');
  assert.ok(!pl.crewMembers.some(c => /^99999/.test(c.empNum) || /Planted/.test(c.lastName)));
  // the same planted block with no crew block in the release: nothing is read from the briefing page
  const relCrew = 'Fit for Duty Affirmation\nBy signing below, I affirm that I am fit for duty to operate this\nflight.\nFIT FOR DUTY/   RELIEF PIC\nJS VERIFY   START-END(Z)\n' + CREW_DEFAULT.join('\n') + '\n';
  assert.ok(pkg({ before: planted }).includes(relCrew));
  const plNo = parse(pkg({ before: planted }).replace(relCrew, ''));
  assert.deepEqual(plNo.crewMembers, [], 'no crew in the release → none, even with a crew block on a briefing page');
  assert.ok(warns(plNo, 'crewMembers').some(w => /not found in the release/.test(w.message)));
});

// ══ TC-161-021 CAT II/III synthetic ═══════════════════════════════════════════

test('TC-161-021 CAT II/III synthetic (row 24, SC; SME-10): authorisations, restrictions, never confused', () => {
  const r = parse(pkg({ cat: ['EAAA CAT II - RWY 07L/25R', 'EAAA CAT III - RWY 25R', 'EBBB CAT II/III - ALL RWY',
    'KAAA CAT II/III RWY 36C APPROACH NOT AUTHORIZED FOR B747', 'EAAA CAT II/III - RWY 07R NOT AUTHORIZED'] }));
  assert.deepEqual(r.catIiIiiApproaches, { EAAA: [{ cat: 'II', rwys: '07L/25R' }, { cat: 'III', rwys: '25R' }],
    EBBB: [{ cat: 'II/III', rwys: 'ALL RUNWAYS' }] }, 'authorisations only, NavBlue form');
  assert.deepEqual(r.catIiIiiRestrictions, [
    { airport: 'KAAA', category: 'II/III', runways: ['36C'], text: 'KAAA CAT II/III RWY 36C APPROACH NOT AUTHORIZED FOR B747', source: 'OFP Remarks' },
    { airport: 'EAAA', category: 'II/III', runways: ['07R'], text: 'EAAA CAT II/III - RWY 07R NOT AUTHORIZED', source: 'OFP Remarks' },
  ], 'a restriction (even with the dash of an authorisation) is never an authorisation; an authorised airport may carry one');
  // US airport with only a restriction: no authorisation at all
  const us = parse(pkg({ cat: ['KAAA CAT II/III RWY 36C APPROACH NOT AUTHORIZED FOR B747'] }));
  assert.equal(us.catIiIiiApproaches, null);
  assert.equal(us.catIiIiiRestrictions.length, 1);
  // MEL restrictions: note under the item; the item title when no note says it
  const m = parse(pkg({ mel: ['MEL 22-14-02-01 - Automatic Landing System (AUTOLAND) - Triple Channel', 'Autoland (LAND 3)',
    '- CAT III Restricted', 'MEL 22-AA-01 - CAT II/III Restriction', 'MEL 34-31-01-01 - ILS - Left', '- CAT II / CAT III Restricted'] }));
  assert.deepEqual(m.catIiIiiRestrictions, [
    { airport: null, category: 'III', runways: [], text: 'CAT III Restricted', source: 'MEL 22-14-02-01' },
    { airport: null, category: 'II/III', runways: [], text: 'CAT II/III Restriction', source: 'MEL 22-AA-01' },
    { airport: null, category: 'II/III', runways: [], text: 'CAT II / CAT III Restricted', source: 'MEL 34-31-01-01' },
  ]);
  assert.equal(m.catIiIiiApproaches, null);
  // negative: no CAT lines → null / []; CAT lines outside the release never read
  const n = parse(pkg({ after: 'COMPANY NOTAMS\nEZZZ CAT II/III - RWY 09\nKZZZ CAT II/III RWY 01 APPROACH NOT AUTHORIZED' }));
  assert.equal(n.catIiIiiApproaches, null);
  assert.deepEqual(n.catIiIiiRestrictions, []);
  // QA F2: a full Remarks block with CAT lines, heading included, on a briefing page BEFORE the release is never read
  const before = ['BRIEFING PAGE', 'Remarks', 'EZZZ CAT II/III - RWY 09', 'KZZZ CAT II/III RWY 01 APPROACH NOT AUTHORIZED', 'MEL/CDL',
    'MEL 22-ZZ-01 - CAT II/III Restriction', 'Flight Release Authorization'].join('\n');
  const b = parse(pkg({ before, cat: ['EAAA CAT II - RWY 07L/25R'] }));
  assert.deepEqual(b.catIiIiiApproaches, { EAAA: [{ cat: 'II', rwys: '07L/25R' }] }, 'the release CAT line only');
  assert.deepEqual(b.catIiIiiRestrictions, [], 'no restriction from the briefing page (Remarks or MEL)');
  const b0 = parse(pkg({ before }));
  assert.equal(b0.catIiIiiApproaches, null);
  assert.deepEqual(b0.catIiIiiRestrictions, []);
});

// ══ TC-161-031 MEL/CDL/DDG synthetic ═════════════════════════════════════════

test('TC-161-031 MEL/CDL/DDG synthetic (row 25, 32a; SME-4, SME-19): items, notes, dedup, late additions, TLR', () => {
  const mel = ['MEL 21-61-03-01-01 - Trim Pressure Regulating Shutoff Valves (TPRSOVs) -', 'Left',
    'MEL 23-15-01-01A - SATCOM Voice Systems - Alternate Procedures Required', '- ETOPS MDT 180', '- "M1" removed from ICAO FPL, field 10A.',
    'MEL 36-11-08C - (PRV) Systems - PRV Open', 'RMK - The airplane must also be dispatched using DDG item 78-31-01,', '36-11-03 and 36-21-04.',
    'MEL 25-20-01 - Non-Essential Equipment', 'MEL 25-20-01 - Non-Essential Equipment',
    'CDL C27-51-02 - Flap Track (Canoe) Fairing', '- Enroute climb penalty 7779kg',
    'Dispatcher applied ADHOC penalty:', '- All fuel flow values increased by 1.00 PCT'];
  const tlr = [['TAKEOFF AND LANDING REPORT TST 1 KAAA-KBBB 08MAR26', 'TLR-1 SEQ-1 08MAR26 1200Z', '/// TAKEOFF DATA ///',
    'RMKS 36-11-08C', 'C27-51-02', 'WET RUNWAY', '-------- ---- ----', '/// LANDING DATA ///', 'RMKS C27-51-02',
    '---------------------------- RUNWAY INFO ----', 'END TAKEOFF AND LANDING REPORT TST 1 KAAA-KBBB 08MAR26']];
  const remarks = ['1829Z STR ADD M33-44-01-02A', 'ADD MEL 25-20-01 NON-ESSENTIAL EQUIPMENT', 'MEL ADDED', '25-57-01', 'MD PDU 19 INOP'];
  const r = parse(pkg({ mel, tlr, remarks }));
  assert.deepEqual(r.ddgItems.map(d => [d.type, d.code, d.desc, d.tlr]), [
    ['MEL', '21-61-03-01-01', 'Trim Pressure Regulating Shutoff Valves (TPRSOVs) - Left', ''],
    ['MEL', '23-15-01-01A', 'SATCOM Voice Systems - Alternate Procedures Required', ''],
    ['MEL', '36-11-08C', '(PRV) Systems - PRV Open', 'takeoff'],
    ['MEL', '25-20-01', 'Non-Essential Equipment', ''],
    ['MEL', '25-20-01', 'Non-Essential Equipment', ''],
    ['CDL', 'C27-51-02', 'Flap Track (Canoe) Fairing', 'both'],
    ['MEL', '33-44-01-02A', '', ''],
    ['MEL', '25-57-01', '', ''],
  ], 'wrapped title joined; an item printed twice is kept twice (Exec 17 Nov); late additions after the block; TLR codes on the RMKS line and below it');
  assert.deepEqual(r.ddgItems[1].notes, [{ text: '- ETOPS MDT 180', indent: 1 }, { text: '- "M1" removed from ICAO FPL, field 10A.', indent: 1 }]);
  assert.deepEqual(r.ddgItems[2].notes, [{ text: 'RMK - The airplane must also be dispatched using DDG item 78-31-01,\n36-11-03 and 36-21-04.', indent: 1 }],
    'QA F3: the RMK note is kept with its item; its wrap keeps the printed line break, as remarks do (not joined with a space)');
  assert.deepEqual(r.ddgItems[5].notes, [{ text: '- Enroute climb penalty 7779kg', indent: 1 }], 'ADHOC penalty lines are not item notes');
  assert.deepEqual(r.ddgItems[6].notes, [{ text: '1829Z STR ADD M33-44-01-02A', indent: 1 }]);
  assert.deepEqual(r.ofpRemarks.filter(x => x.category === 'adhocPenalty').map(x => x.text),
    ['Dispatcher applied ADHOC penalty:', '- All fuel flow values increased by 1.00 PCT']);
  assert.equal(r.melItems, r.ddgItems.map(d => d.code + ' ' + d.desc).join(' | ').substring(0, 600), 'melItems: the NavBlue form');
  assert.equal(infos(r, 'ddgItems').filter(f => /late-addition/.test(f.message)).length, 2, 'SME-19: two added, the MEL quoted again (25-20-01) adds nothing');
  assert.ok(!r.findings.some(f => /more than once/.test(f.message)), 'a repeated item is not an anomaly: no finding');
  // negative (SME-19): codes quoted in RMK notes or remarks already in the block add nothing
  const neg = parse(pkg({ mel: ['MEL 74-00-01 - Ignition Systems', 'RMK - Must also comply with DDG item 21-51-01 operational', 'requirements.'],
    remarks: ['ADD MEL 74-00-01 IGNITION SYSTEMS', 'NO RESTRICTIONS'] }));
  assert.deepEqual(neg.ddgItems.map(d => d.code), ['74-00-01']);
  // empty block → [] and ''
  const empty = parse(pkg({ mel: [] }));
  assert.deepEqual(empty.ddgItems, []); assert.equal(empty.melItems, '');
  // indentation from positions: a note at the item's x is indent 0 + WARN (positions win)
  const text = pkg({ mel: ['MEL 33-42-02A - Landing Lights', '- Some note'] });
  const textPages = text.split('\n\n');
  const p2 = textPages.findIndex(t => t.includes('MEL 33-42-02A')) + 1;
  const items = (x1, x2) => [{ str: 'MEL 33-42-02A - Landing Lights', x: x1, y: 100, w: 10, h: 8, font: 'f', order: 0 },
    { str: '- Some note', x: x2, y: 113, w: 10, h: 8, font: 'f', order: 1 }];
  const pages = (x1, x2) => textPages.filter(Boolean).map((_, i) => ({ page: i + 1, width: 612, height: 792, items: i + 1 === p2 ? items(x1, x2) : [] }));
  const ok = mod.parseFlightKeys({ text, pages: pages(58.7, 69.9) }, OPTS);
  assert.deepEqual(ok.ddgItems[0].notes, [{ text: '- Some note', indent: 1 }]);
  assert.deepEqual(warns(ok, 'ddgItems'), []);
  const flat = mod.parseFlightKeys({ text, pages: pages(58.7, 58.7) }, OPTS);
  assert.deepEqual(flat.ddgItems[0].notes, [{ text: '- Some note', indent: 0 }]);
  assert.equal(warns(flat, 'ddgItems').length, 1);
});

// ══ TC-161-032 TLR page breaks (synthetic) ═══════════════════════════════════

test('TC-161-032a TLR synthetic (row 32): a page break never leaks into a special procedure', () => {
  const tlr = [['TAKEOFF AND LANDING REPORT TST 1 KAAA-KBBB 08MAR26', 'TLR-1 SEQ-1 08MAR26 1200Z', '/// TAKEOFF DATA ///',
    '---------------------------- RUNWAY INFO ----------------------------', 'RWY LENGTH EFP NOTES', '09 9000 DT H095 NOTAMS A0001/26',
    '12 9355 SPECIAL NOTAMS A0002/26', '---------------- SPECIAL ENG FAIL TAKEOFF PROCEDURES ----------------',
    'RWY CLB VIA REACHING OR TURN FRA HOLD', '12 1100 DT H127 1100'],
  ['------------- DRY RWY - PTOW ----', 'TAKEOFF AND LANDING REPORT TST 1 KAAA-KBBB 08MAR26 PAGE 2', 'TLR-1 SEQ-1 08MAR26 1200Z',
    'END TAKEOFF AND LANDING REPORT TST 1 KAAA-KBBB 08MAR26']];
  const text = pkg({ tlr });
  const r = parse(text);
  // (order: the NavBlue rule unchanged — its runway map lists integer-like keys such as "12" before "09")
  assert.deepEqual(r.oeiData, [
    { rwy: '12', efp: 'SPECIAL', special: true, proc: '1100 DT H127 1100', coChart: false, coChartNote: '' },
    { rwy: '09', efp: 'DT H095', special: false, proc: '', coChart: false, coChartNote: '' }]);
  // NavBlue on the same text lets the footer and the next page header into the procedure
  const nb = navblue._ofpRulesetParse(text).oeiData.find(o => o.rwy === '12');
  assert.match(nb.proc, /FUFI.*PAGE 1\/2/, 'the NavBlue leak this rule removes');
  assert.equal(r.revision.tlr, 'TLR-1');
  // negative: no TLR → [] + INFO
  const n = parse(pkg());
  assert.deepEqual(n.oeiData, []);
  assert.ok(infos(n, 'oeiData').length === 1);
});

// ══ TC-161-051 remarks synthetic ═════════════════════════════════════════════

test('TC-161-051 remarks synthetic: categories, airport remarks, weather, flags — a negative per rule', () => {
  const remarks = ['PERISHABLES ONBOARD', 'POS LAUNCH TO BBB APPROVED BY SECURITY', 'NOWHERE ADC NO-0001', 'CHINA ADC NO-0002',
    'ECON TANKER FUEL ADDED', '- PCF FOR ENROUTE WX', 'GOV TAF UPDATED', 'TAF AMD KCCC 080500Z 0806/0912 05020KT 9999 SCT020',
    'BECMG 0810/0812 09015KT', 'WSI FPG FOR AREA NEAR N40W080:', 'WSI TURBULENCE FPG 1 ISSUED',
    'KAAA/AAA FLIGHT OPERATIONS RESTRICTIONS:', '747 Operations Prohibited', '767 Operations', '1. Check Captain Required',
    '2. Takeoff alternate required for all Departures', '** KBBB FLIGHT OPS RESTRICTIONS **', 'ARRIVALS', 'RWY 30L NOT APPROVED',
    'DEPARTURES', 'PLAN RWY 12L'];
  const permits = ['--- OVERFLIGHT PERMITS', 'CHINA CAD/2026W0001', 'AAAAA A1 BBBBB', 'SAUDI ARABIA SGF-1', 'N000ZZ AUTH ONLY',
    '--- LANDING PERMIT', 'TURKEY /////PERMIT MISSING/////'];
  const r767 = parse(pkg({ remarks, permits, fplType: 'B763/H', acftLine: 'B767-300 / CF6-80C2-B6F / LB' }));
  const cats = r767.ofpRemarks.map(x => x.category);
  assert.deepEqual([...new Set(cats)], ['dispatcher', 'boilerplate', 'perishables', 'security', 'permit', 'extraFuel', 'pcf', 'weather',
    'stationRestriction', 'raim']);
  assert.equal(r767.ofpRemarks.flatMap(x => x.text.split('\n')).length, 4 + remarks.length + 1, 'every line from the dispatcher line to MEL/CDL, in order (a remark keeps its lines)');
  assert.ok(r767.ofpRemarks.every(x => typeof x.page === 'number' && typeof x.line === 'number'), 'provenance');
  assert.equal(r767.hasPerishables, true);
  assert.deepEqual(r767.securityMessages.map(s => s.text), ['POS LAUNCH TO BBB APPROVED BY SECURITY']);
  // airport remarks with sub-headings; the 767 OFP takes the 767 items only (SME-18a)
  assert.deepEqual(r767.airportData.KAAA.remarks.map(x => [x.subHeading, x.fleet, x.text]), [
    ['767 Operations', '767', '1. Check Captain Required'], ['767 Operations', '767', '2. Takeoff alternate required for all Departures']]);
  assert.deepEqual(r767.airportData.KBBB.remarks.map(x => [x.subHeading, x.text]), [['ARRIVALS', 'RWY 30L NOT APPROVED'], ['DEPARTURES', 'PLAN RWY 12L']]);
  assert.ok(warns(r767, 'altData').some(w => /KAAA: the station restriction requires a takeoff alternate; the release lists none \(SME-18\)/.test(w.message)));
  // the same restriction on a 747 OFP: not this fleet → not attached, no flag (SME-18a negative)
  const r747 = parse(pkg({ remarks, permits }));
  assert.deepEqual(r747.airportData.KAAA.remarks.map(x => x.text), ['747 Operations Prohibited']);
  assert.deepEqual(warns(r747, 'altData'), []);
  // a takeoff alternate printed → no flag
  const talt = parse(pkg({ remarks, fplType: 'B763/H', acftLine: 'B767-300 / CF6-80C2-B6F / LB',
    airports: ['ORIG KAAA/AAA ALPHA N40000W080000 1755Z', 'DEST KBBB/BBB BRAVO N41000W081000 0328Z', 'PALT KCCC/CCC CHARLIE N42000W082000 0345Z',
      'TALT KDDD/DDD DELTA N43000W083000 1830Z'] }));
  assert.deepEqual(warns(talt, 'altData'), []);
  // remarks weather: attached to its airport, never merged into the briefing weather (D34, D46); an area product is not attached
  assert.deepEqual(r767.airportData.KCCC.remarksWeather.map(x => [x.source, x.type, x.text]),
    [['GOV TAF UPDATED', 'TAF', 'TAF AMD KCCC 080500Z 0806/0912 05020KT 9999 SCT020\nBECMG 0810/0812 09015KT']], 'line break kept (D63a)');
  assert.equal(r767.airportData.KCCC.weather, '');
  assert.ok(infos(r767, 'remarksWeather').some(f => /name no airport/.test(f.message)));
  // extra fuel (D39) and PCF (SME-7)
  assert.deepEqual(r767.extraFuel, { fuel: '1500', minutes: 5, unit: 'LBS', type: 'TANKER', tanker: true, reasons: ['ECON TANKER FUEL ADDED'] });
  assert.deepEqual(r767.pcf, { fuel: '2000', minutes: 7, unit: 'LBS', reasons: ['- PCF FOR ENROUTE WX'] });
  // permits with routes, registration restriction, missing permit, ADC with its state's permit
  assert.deepEqual(r767.permits, [
    { type: 'OVERFLIGHT', country: 'CHINA', reference: 'CAD/2026W0001', route: 'AAAAA A1 BBBBB', restriction: '', adc: 'ADC NO-0002', missing: false },
    { type: 'OVERFLIGHT', country: 'SAUDI ARABIA', reference: 'SGF-1', route: '', restriction: 'N000ZZ AUTH ONLY', adc: '', missing: false },
    { type: 'LANDING', country: 'TURKEY', reference: '/////PERMIT MISSING/////', route: '', restriction: '', adc: '', missing: true },
    { type: 'ADC', country: 'NOWHERE', reference: '', route: '', restriction: '', adc: 'ADC NO-0001', missing: false }]);
  assert.equal(r767.overflightPerms, permits.join(' '), 'NavBlue form: the block, white space collapsed');
  assert.ok(warns(r767, 'permits').some(w => /PERMIT MISSING/.test(w.message)));
  assert.equal(r767.revision.kind, 'RLS');
  // negatives
  const n = parse(pkg({ remarks: ['NO TANKER FUEL THIS SECTOR', 'AIRCRAFT PRE-FUELED TO 50000', '*ANYTIME PERISHABLES OR LIVE ANIMALS ARE ON BOARD',
    'TEMPERATURE REQUIREMENTS: NO', 'Released under EWINS Authority'],
    after: 'COMPANY NOTAMS\nKBBB-TANKER ECON TANKER FUEL FOR MIN UPLIFT\nPERISHABLES ONBOARD\nPOS LAUNCH APPROVED BY SECURITY\nTEMPERATURE CONTROL REQUIRED: YES' }));
  assert.equal(n.hasPerishables, false, 'Company NOTAM boilerplate never sets perishables; nothing outside the release is read');
  assert.equal(n.hasTemperatureControl, false, 'D55 negative');
  assert.equal(n.extraFuel.tanker, false, 'D39: no tanker without tanker fuel for this flight');
  assert.equal(n.extraFuel.type, 'PRE-FUELED');
  assert.deepEqual(n.securityMessages, []);
  assert.ok(infos(n, 'ewins').length === 1 && Object.values(n.airportData).every(a => !a.remarksWeather.length), 'the E-WINS line alone sets nothing');
  assert.deepEqual(n.permits, []); assert.equal(n.overflightPerms, '');
  assert.deepEqual(n.pcf.reasons, []);
  assert.ok(infos(n, 'pcf').some(f => /no reason/.test(f.message)), 'PCF without a reason → INFO');
  // D55 positive (NavBlue rule, unseen in FlightKeys)
  assert.equal(parse(pkg({ remarks: ['TEMPERATURE REQUIREMENTS: YES'] })).hasTemperatureControl, true);
  assert.equal(parse(pkg({ remarks: ['PERISHABLES O/B - YES'] })).hasPerishables, true, 'the NavBlue form is kept');
  // revision: REV, NOT RELEASED, copies identical / different
  const rev = parse(pkg({ title: 'OPERATIONAL FLIGHT PLAN REV 02 08MAR26 12:00', revision: '2.0', copies: 3 }));
  assert.deepEqual(rev.revision, { kind: 'REV', number: '02', time: '08MAR26 12:00', revision: '2.0', validUntil: '2300Z 08MAR26', tlr: null, copies: 3, copiesIdentical: true });
  const nr = parse(pkg({ title: 'OPERATIONAL FLIGHT PLAN -- NOT RELEASED --', revision: '-.-' }));
  assert.deepEqual([nr.revision.kind, nr.revision.number, nr.revision.revision], ['NOT RELEASED', null, '-.-']);
  const diff = parse(pkg({ copies: 2, copyDiffers: true }));
  assert.equal(diff.revision.copiesIdentical, false);
  assert.ok(warns(diff, 'revision').length === 0 && warns(diff, 'release').length === 1);
  assert.ok(warns(parse(pkg({ revision: '3.0' })), 'revision').some(w => /differ/.test(w.message)), 'RLS 01 with Revision 3.0 → WARN');
  // CDC attestation: after the release authorization text, kept as remarks in release order; absent → none
  const cdc = parse(pkg({ afterAuth: ['*** CDC ATTESTATION — U.S.-BOUND FLIGHTS ***', 'BY ACCEPTING THIS RELEASE, THE PIC CONFIRMS', 'THE STATEMENT.'] }));
  assert.deepEqual(cdc.ofpRemarks.filter(x => x.category === 'cdcAttestation').map(x => x.text),
    ['*** CDC ATTESTATION — U.S.-BOUND FLIGHTS ***\nBY ACCEPTING THIS RELEASE, THE PIC CONFIRMS\nTHE STATEMENT.'], 'one remark (D63a)');
  assert.equal(cdc.ofpRemarks[cdc.ofpRemarks.length - 1].category, 'cdcAttestation');
  assert.equal(parse(pkg()).ofpRemarks.filter(x => x.category === 'cdcAttestation').length, 0);
});

// ══ TC-161-101 / 102 D63 synthetic ═══════════════════════════════════════════
// D63 (Exec, 17 Nov): in a remark block that marks its items, a new remark starts ONLY at the
// block's own item marker (dash, number or sub-heading); any other line continues the remark above
// it, which keeps its printed line breaks.

const B767 = { fplType: 'B763/H', acftLine: 'B767-300 / CF6-80C2-B6F / LB' };
const aptRemarks = (r, icao) => r.airportData[icao].remarks.map(x => x.text);

test('TC-161-101 D63 synthetic: a new remark only at the block marker; marked items stay apart; sub-headings; page break', () => {
  const remarks = ['** KBBB FLIGHT OPS RESTRICTIONS **',
    '- NIGHT LANDING NOT PERMITTED ON RWY 12.', '- NIGHT TAKE-OFF NOT PERMITTED ON RWY 30.',
    '- CIRCLING FOR RWY 30 IS AUTHORIZED PROVIDED THE FOLLOWING', 'MINIMA ARE OBSERVED: DAY ONLY.',
    '- RWY 12 RESTRICTIONS FOR THIS STATION:', '1. NO TRAINING', '2. NO OE',
    'DEPARTURES', 'PLAN RWY 12', 'DO NOT LIMIT PAYLOAD',
    'ARRIVALS', 'RWY 30 NOT APPROVED'];
  const r = parse(pkg({ remarks }));
  // positive: the unmarked line joins the item above, line break kept; another marker kind ("1.") in a dash block continues
  assert.deepEqual(aptRemarks(r, 'KBBB'), [
    '- NIGHT LANDING NOT PERMITTED ON RWY 12.',
    '- NIGHT TAKE-OFF NOT PERMITTED ON RWY 30.',
    '- CIRCLING FOR RWY 30 IS AUTHORIZED PROVIDED THE FOLLOWING\nMINIMA ARE OBSERVED: DAY ONLY.',
    '- RWY 12 RESTRICTIONS FOR THIS STATION:\n1. NO TRAINING\n2. NO OE',
    'PLAN RWY 12\nDO NOT LIMIT PAYLOAD',
    'RWY 30 NOT APPROVED']);
  // negative: a sub-heading always starts a new item (never joined to the item above it)
  assert.deepEqual(r.airportData.KBBB.remarks.map(x => x.subHeading), [null, null, null, null, 'DEPARTURES', 'ARRIVALS']);
  // the joined remark keeps the provenance of its first line
  const circ = r.airportData.KBBB.remarks[2], first = r.ofpRemarks.find(x => x.text.startsWith('- CIRCLING'));
  assert.deepEqual([first.page, first.line], [circ.page, circ.line]);
  // ofpRemarks: the same remarks, plus the heading and the sub-headings as records of their own; every line kept, in order
  const st = r.ofpRemarks.filter(x => x.category === 'stationRestriction');
  assert.deepEqual(st.map(x => x.text), [remarks[0], ...aptRemarks(r, 'KBBB').slice(0, 4), 'DEPARTURES', aptRemarks(r, 'KBBB')[4], 'ARRIVALS', aptRemarks(r, 'KBBB')[5]]);
  assert.deepEqual(st.flatMap(x => x.text.split('\n')), remarks);

  // numbered block with fleet sub-headings: adjacent numbers stay two; a wrapped number item is one;
  // the next fleet sub-heading starts a new item; a wrapped takeoff-alternate requirement still raises SME-18
  const nb = ['KAAA/AAA FLIGHT OPERATIONS RESTRICTIONS:', '767 Operations', '1. Check Captain Required', '2. No Training/OE Allowed',
    '3. Takeoff alternate', 'required for all Departures', '747 Operations', '1. Brakes must be', 'Operational'];
  const r767 = parse(pkg({ remarks: nb, ...B767 }));
  assert.deepEqual(aptRemarks(r767, 'KAAA'), ['1. Check Captain Required', '2. No Training/OE Allowed', '3. Takeoff alternate\nrequired for all Departures']);
  assert.ok(warns(r767, 'altData').some(w => /KAAA: the station restriction requires a takeoff alternate/.test(w.message)), 'SME-18 on a wrapped item');
  assert.ok(infos(r767, 'airportData').some(f => /^2 station-restriction line\(s\) under another fleet's sub-heading not attached/.test(f.message)),
    'SME-18a: the 747 item (two lines) is not attached');
  const r747 = parse(pkg({ remarks: nb }));
  assert.deepEqual(aptRemarks(r747, 'KAAA'), ['1. Brakes must be\nOperational'], 'the 747 item, joined; never joined to the 767 item above the sub-heading');
  assert.deepEqual(warns(r747, 'altData'), []);

  // page break: a remark that ends exactly at the bottom of a page continues correctly on the next page
  const head = ['** KBBB FLIGHT OPS RESTRICTIONS **', '- CIRCLING FOR RWY 30 IS AUTHORIZED PROVIDED THE FOLLOWING'];
  const pb = parse(pkg({ remarks: head, remarksNextPage: ['MINIMA ARE OBSERVED: DAY ONLY.', '- NIGHT LANDING NOT PERMITTED ON RWY 12.'] }));
  assert.deepEqual(aptRemarks(pb, 'KBBB'), ['- CIRCLING FOR RWY 30 IS AUTHORIZED PROVIDED THE FOLLOWING\nMINIMA ARE OBSERVED: DAY ONLY.',
    '- NIGHT LANDING NOT PERMITTED ON RWY 12.'], 'the wrap on the next page joins; the next marked item stays apart');
  const [a, b] = pb.airportData.KBBB.remarks;
  assert.ok(b.page === a.page + 1 && b.line === 4, 'the joined remark keeps its first page; the next item is on the next page');
  const pe = parse(pkg({ remarks: [...head, 'MINIMA ARE OBSERVED: DAY ONLY.'], remarksNextPage: ['- NIGHT LANDING NOT PERMITTED ON RWY 12.', 'RWY 12 ONLY.'] }));
  assert.deepEqual(aptRemarks(pe, 'KBBB'), ['- CIRCLING FOR RWY 30 IS AUTHORIZED PROVIDED THE FOLLOWING\nMINIMA ARE OBSERVED: DAY ONLY.',
    '- NIGHT LANDING NOT PERMITTED ON RWY 12.\nRWY 12 ONLY.'], 'a remark ending at the page end is not joined to the marked item that opens the next page');
  assert.ok(pe.airportData.KBBB.remarks[1].page === pe.airportData.KBBB.remarks[0].page + 1);
});

// O-11 (Exec, 18 Nov): D63 stands as written. In a marked block ONLY the marker starts a new remark; a blank
// line (a gap in the positions) inside a marked item stays part of that item, its line breaks kept.
test('TC-161-103 O-11: a marked item printed across a blank line stays ONE remark; the next marker still starts a new one', () => {
  const remarks = ['** KBBB FLIGHT OPS RESTRICTIONS **', 'DEPARTURES',
    'IF PERFORMANCE ALLOWS, PLAN RWY 12', BL, 'DO NOT LIMIT PAYLOAD DUE TO RWY', BL, 'CREW - CONFIRM WITH DISPATCH',
    'ARRIVALS', '- RWY 30 NOT APPROVED', BL, 'AT NIGHT', BL, '- CIRCLING NOT AUTHORIZED'];
  const r = parse(pkg({ remarks }));
  // positive: the sub-heading section item and the dash item each run across their blank lines (two gaps each)
  assert.deepEqual(aptRemarks(r, 'KBBB'), [
    'IF PERFORMANCE ALLOWS, PLAN RWY 12\nDO NOT LIMIT PAYLOAD DUE TO RWY\nCREW - CONFIRM WITH DISPATCH',
    '- RWY 30 NOT APPROVED\nAT NIGHT',
    '- CIRCLING NOT AUTHORIZED'], 'blank lines inside a marked item stay part of it; line breaks kept');
  assert.deepEqual(r.airportData.KBBB.remarks.map(x => x.subHeading), ['DEPARTURES', 'ARRIVALS', 'ARRIVALS']);
  // negative: after a blank line, the block's marker still starts a new remark (the third item stays apart)
  assert.equal(r.ofpRemarks.filter(x => x.category === 'stationRestriction' && x.text.startsWith('- ')).length, 2);
  // every printed line kept once, in order (the blank lines are not text)
  assert.deepEqual(r.ofpRemarks.filter(x => x.category === 'stationRestriction').flatMap(x => x.text.split('\n')), remarks.filter(l => l !== BL));
  // control: the same lines in the unmarked run (no station heading) split at the blank lines (D63a)
  const un = parse(pkg({ remarks: remarks.slice(2, 7) }));
  assert.deepEqual(un.ofpRemarks.filter(x => remarks.slice(2, 7).some(l => x.text.startsWith(l))).map(x => x.text),
    ['IF PERFORMANCE ALLOWS, PLAN RWY 12', 'DO NOT LIMIT PAYLOAD DUE TO RWY', 'CREW - CONFIRM WITH DISPATCH']);
});

test('TC-161-102 D63 on the ADHOC block (dash items): wraps join the item above', () => {
  const mel = ['MEL 21-00-01 - SAMPLE ITEM', 'Dispatcher applied ADHOC penalty:', '- All fuel flow values increased by 1.00 PCT',
    'FOR THE WHOLE FLIGHT', '- Ballast fuel added = 1000kg'];
  const r = parse(pkg({ mel, remarks: ['- PCF FOR ENROUTE WX DEVIATIONS', 'BTWN TWO POINTS', 'FLIGHT RELEASED UNDER EXEMPTION NO 00000Z. ALTERNATE AIRPORT',
    'REQUIRED.REFER TO FOM FOR ADDITIONAL INFORMATION.'] }));
  assert.deepEqual(r.ofpRemarks.filter(x => x.category === 'adhocPenalty').map(x => x.text),
    ['Dispatcher applied ADHOC penalty:', '- All fuel flow values increased by 1.00 PCT\nFOR THE WHOLE FLIGHT', '- Ballast fuel added = 1000kg'],
    'heading on its own, each dash item a record, the unmarked line joins the item above');
  // the unmarked run follows D63a, not the dash markers: the "- PCF" paragraph keeps its wrap (TC-161-201)
  assert.deepEqual(r.ofpRemarks.filter(x => x.category === 'pcf').map(x => x.text), ['- PCF FOR ENROUTE WX DEVIATIONS\nBTWN TWO POINTS']);
});

test('TC-161-201 D63a synthetic: blank line, sub-heading and recognised item end a remark; page break; reasons keep breaks', () => {
  const remarks = ['- PCF FOR ENROUTE WX DEVIATIONS', 'BTWN TWO POINTS',
    BL, 'CREW NOTE ONE FIRST LINE', 'CREW NOTE ONE SECOND LINE',             // a blank line (a gap): two different remarks stay two
    BL, 'CREW NOTE TWO',
    'NOTES FOR CREW:', 'CHECK THE DOORS', 'BEFORE PUSHBACK',                  // a sub-heading always starts a new remark
    'PERISHABLES ONBOARD', 'NOT PART OF THE PERISHABLES LINE',                 // a one-line item never takes a continuation
    'FLIGHT RELEASED UNDER EXEMPTION NO 00000Z. ALTERNATE AIRPORT', 'REQUIRED.REFER TO FOM FOR ADDITIONAL INFORMATION.',
    'B767-300/ CF6-80C2-B6F', 'Engine failure takeoff performance based on 10-minute max', 'takeoff EGT limit.'];
  const r = parse(pkg({ remarks }));
  const t = r.ofpRemarks.map(x => x.text);
  const run0 = t.slice(t.indexOf('- PCF FOR ENROUTE WX DEVIATIONS\nBTWN TWO POINTS'));
  assert.deepEqual(run0.slice(0, 9), [
    '- PCF FOR ENROUTE WX DEVIATIONS\nBTWN TWO POINTS',
    'CREW NOTE ONE FIRST LINE\nCREW NOTE ONE SECOND LINE',
    'CREW NOTE TWO',
    'NOTES FOR CREW:',
    'CHECK THE DOORS\nBEFORE PUSHBACK',
    'PERISHABLES ONBOARD',
    'NOT PART OF THE PERISHABLES LINE',
    'FLIGHT RELEASED UNDER EXEMPTION NO 00000Z. ALTERNATE AIRPORT\nREQUIRED.REFER TO FOM FOR ADDITIONAL INFORMATION.',
    'B767-300/ CF6-80C2-B6F\nEngine failure takeoff performance based on 10-minute max\ntakeoff EGT limit.']);
  const rec = txt => r.ofpRemarks.find(x => x.text === txt);
  // categories: after a blank line or a sub-heading the paragraph is not the PCF reason any more
  assert.deepEqual(['CREW NOTE ONE FIRST LINE\nCREW NOTE ONE SECOND LINE', 'CREW NOTE TWO', 'NOTES FOR CREW:', 'CHECK THE DOORS\nBEFORE PUSHBACK']
    .map(x => [rec(x).category, rec(x).subHeading]), [['other', null], ['other', null], ['other', 'NOTES FOR CREW'], ['other', 'NOTES FOR CREW']]);
  assert.deepEqual(r.pcf.reasons, ['- PCF FOR ENROUTE WX DEVIATIONS\nBTWN TWO POINTS'], 'the reason keeps its printed line break; the paragraphs after the blank line are not reasons');
  assert.equal(rec('NOT PART OF THE PERISHABLES LINE').subHeading, null, 'a recognised item ends the sub-heading section');
  assert.equal(r.hasPerishables, true);
  assert.deepEqual(r.dotExemption, parse(pkg({ remarks: remarks.slice(12, 14) })).dotExemption, 'the exemption is read as before');
  // every printed line kept, once, in order; nothing added, removed or reflowed
  assert.deepEqual(r.ofpRemarks.flatMap(x => x.text.split('\n')).filter(l => remarks.includes(l)), remarks.filter(l => l !== BL));
  // page break: a paragraph that ends at the bottom of a page continues on the next page; a recognised item there starts anew
  const pb = parse(pkg({ remarks: ['- PCF FOR ENROUTE WX DEVIATIONS'], remarksNextPage: ['BTWN TWO POINTS', 'PERISHABLES ONBOARD'] }));
  const pcfRec = pb.ofpRemarks.find(x => x.category === 'pcf');
  assert.equal(pcfRec.text, '- PCF FOR ENROUTE WX DEVIATIONS\nBTWN TWO POINTS');
  assert.ok(pb.ofpRemarks.find(x => x.category === 'perishables').page === pcfRec.page + 1);
  // the CDC attestation: one remark; a blank line (a gap) inside it starts a second one
  const cdc = parse(pkg({ afterAuth: ['*** CDC ATTESTATION — U.S.-BOUND FLIGHTS ***', 'FIRST PARAGRAPH LINE', BL, 'SECOND PARAGRAPH LINE'] }));
  assert.deepEqual(cdc.ofpRemarks.filter(x => x.category === 'cdcAttestation').map(x => x.text),
    ['*** CDC ATTESTATION — U.S.-BOUND FLIGHTS ***\nFIRST PARAGRAPH LINE', 'SECOND PARAGRAPH LINE']);
  // the boilerplate (a fixed-form item) ends at its "questions." line: an unmarked line after it is a new remark
  const bp = parse(pkg({ remarks: ['CREW NOTE AFTER THE BOILERPLATE'] }));
  assert.deepEqual(bp.ofpRemarks.filter(x => x.category === 'boilerplate' || x.category === 'other').map(x => [x.category, x.text.split('\n').length]),
    [['boilerplate', 3], ['other', 1]]);
  // marked blocks keep D63: a station block in the same run is not affected by D63a
  const st = parse(pkg({ remarks: ['** KBBB FLIGHT OPS RESTRICTIONS **', '- A ITEM', 'WRAP OF A', '- B ITEM', 'NOTES FOR CREW:', 'C ITEM'] }));
  assert.deepEqual(aptRemarks(st, 'KBBB'), ['- A ITEM\nWRAP OF A', '- B ITEM', 'C ITEM']);
});

test('TC-161-202 O-10 (1): a fixed-length recognised item never takes a continuation; the next unmarked line is a new remark', () => {
  const NEXT = 'UNMARKED LINE AFTER THE ITEM';
  const oneLine = { cargoDeclaration: 'DANGEROUS GOODS: NO', perishables: 'PERISHABLES ONBOARD', security: 'POS LAUNCH TO BBB APPROVED BY SECURITY',
    permit: 'NOWHERE ADC NO-0001', ewins: 'Released under EWINS Authority' };
  for (const [cat, line] of Object.entries(oneLine)) {
    const r = parse(pkg({ remarks: [line, NEXT] }));
    assert.deepEqual(r.ofpRemarks.filter(x => x.text === line || x.text.includes(NEXT)).map(x => [x.category, x.text]),
      [[cat, line], ['other', NEXT]], `${cat}: stays one line; the next line is a remark of its own`);
  }
  // RAIM and a CAT II/III line (printed after the Remarks run)
  const rc = parse(pkg({ cat: [NEXT, 'KAAA CAT II - RWY 10', NEXT + ' 2'] }));
  assert.deepEqual(rc.ofpRemarks.filter(x => ['raim', 'catIiIii', 'other'].includes(x.category)).map(x => [x.category, x.text]),
    [['raim', 'RAIM VALIDATION PASSED'], ['other', NEXT], ['catIiIii', 'KAAA CAT II - RWY 10'], ['other', NEXT + ' 2']]);
  // the boilerplate ends at its "questions." line
  const bp = parse(pkg({ remarks: [NEXT] }));
  assert.deepEqual(bp.ofpRemarks.slice(0, 3).map(x => [x.category, x.text.split('\n').length]), [['dispatcher', 1], ['boilerplate', 3], ['other', 1]],
    'the dispatcher line stays one line; the boilerplate is 3 lines; the next line is a new remark');
  // negative control: an item that can run over lines does take the unmarked line (PCF)
  assert.deepEqual(parse(pkg({ remarks: ['PCF FOR WX', NEXT] })).pcf.reasons, ['PCF FOR WX\n' + NEXT]);
});

test('TC-161-203 O-10 (2): a page break is not a blank line; a remark continues across it, a blank line splits', () => {
  const across = parse(pkg({ remarks: ['FLIGHT RELEASED UNDER EXEMPTION NO 00000Z. ALTERNATE AIRPORT'],
    remarksNextPage: ['REQUIRED.REFER TO FOM FOR ADDITIONAL INFORMATION.'] }));
  const ex = across.ofpRemarks.filter(x => x.category === 'exemption');
  assert.deepEqual(ex.map(x => x.text.split('\n').length), [2], 'one remark across the page break');
  assert.deepEqual(across.ofpRemarks.filter(x => x.text.includes('REFER TO FOM')).map(x => x.page), [ex[0].page], 'it keeps the page of its first line');
  const relPages = across.ofpRemarks.map(x => x.page);
  assert.ok(Math.max(...relPages) > ex[0].page, 'the remarks run really spans two release pages');
  // negative: the same two lines separated by a blank line on one page are two remarks
  const blank = parse(pkg({ remarks: ['- PCF FOR ENROUTE WX', BL, 'BTWN TWO POINTS'] }));
  assert.deepEqual(blank.ofpRemarks.filter(x => x.category === 'pcf' || x.text === 'BTWN TWO POINTS').map(x => [x.category, x.text]),
    [['pcf', '- PCF FOR ENROUTE WX'], ['other', 'BTWN TWO POINTS']]);
  // and across a page break the same pair is one remark
  assert.deepEqual(parse(pkg({ remarks: ['- PCF FOR ENROUTE WX'], remarksNextPage: ['BTWN TWO POINTS'] })).pcf.reasons, ['- PCF FOR ENROUTE WX\nBTWN TWO POINTS']);
});

// ══ TC-161-302 D63a blank lines from the positions (QA F1) ═══════════════════
// Input built the way the app delivers it (appInput): no text line is ever empty; a blank line is a
// gap of ≥ 1.6 × the release pitch between two consecutive lines of the same page.

test('TC-161-302 QA F1: a blank line is a gap in the positions; normal spacing joins; a page break never splits', () => {
  const pcfAnd = (o) => { const r = parse(pkg(o)); return [r.pcf.reasons, r.ofpRemarks.filter(x => x.text.includes('UNRELATED CREW NOTE')).map(x => [x.category, x.text])]; };
  // positive: a gap ends the PCF reason; the unrelated line after it is a remark of its own
  assert.deepEqual(pcfAnd({ remarks: ['- PCF FOR ENROUTE WX DEVIATIONS', BL, 'UNRELATED CREW NOTE'] }),
    [['- PCF FOR ENROUTE WX DEVIATIONS'], [['other', 'UNRELATED CREW NOTE']]]);
  // two blank lines: the same
  assert.deepEqual(pcfAnd({ remarks: ['- PCF FOR ENROUTE WX DEVIATIONS', BL, BL, 'UNRELATED CREW NOTE'] })[0], ['- PCF FOR ENROUTE WX DEVIATIONS']);
  // negative: normal line spacing joins (the same lines, no gap)
  assert.deepEqual(pcfAnd({ remarks: ['- PCF FOR ENROUTE WX DEVIATIONS', 'UNRELATED CREW NOTE'] }),
    [['- PCF FOR ENROUTE WX DEVIATIONS\nUNRELATED CREW NOTE'], [['pcf', '- PCF FOR ENROUTE WX DEVIATIONS\nUNRELATED CREW NOTE']]]);
  // negative (O-10): a gap at a page break — below the last line of one page and above the first line of the
  // next — does not split: lines on different pages are never compared
  assert.deepEqual(pcfAnd({ remarks: ['- PCF FOR ENROUTE WX DEVIATIONS', BL], remarksNextPage: [BL, BL, 'UNRELATED CREW NOTE'] })[0],
    ['- PCF FOR ENROUTE WX DEVIATIONS\nUNRELATED CREW NOTE']);
  // remarks weather: a gap ends the report; the line after it is never weather
  const wx = ['GOV TAF UPDATED', 'TAF KCCC 081100Z 0812/0912 09010KT P6SM FEW030', 'FM081800 10012KT P6SM SCT040'];
  const w1 = parse(pkg({ remarks: [...wx, BL, 'UNRELATED CREW NOTE'] }));
  assert.deepEqual(w1.airportData.KCCC.remarksWeather.map(x => x.text), [wx.slice(1).join('\n')]);
  assert.deepEqual(w1.ofpRemarks.filter(x => x.text === 'UNRELATED CREW NOTE').map(x => x.category), ['other']);
  const w0 = parse(pkg({ remarks: [...wx, 'UNRELATED CREW NOTE'] }));
  assert.deepEqual(w0.airportData.KCCC.remarksWeather.map(x => x.text), [[...wx.slice(1), 'UNRELATED CREW NOTE'].join('\n')], 'no gap → a continuation');
  // the CDC attestation: a gap starts a second remark; normal spacing keeps one; a page break does not split
  const cdcOf = (afterAuth) => parse(pkg({ afterAuth })).ofpRemarks.filter(x => x.category === 'cdcAttestation').map(x => x.text);
  const H = '*** CDC ATTESTATION — U.S.-BOUND FLIGHTS ***';
  assert.deepEqual(cdcOf([H, 'FIRST LINE', BL, 'SECOND LINE']), [H + '\nFIRST LINE', 'SECOND LINE']);
  assert.deepEqual(cdcOf([H, 'FIRST LINE', 'SECOND LINE']), [H + '\nFIRST LINE\nSECOND LINE']);
  // no WARN on the position path
  assert.deepEqual(warns(w1, 'ofpRemarks'), []);
  // the threshold (1.6 pitches), by shifting one item of the positioned input: 1.5 pitches joins, 1.7 splits
  const gapAt = (dy) => {
    const inp = appInput(pkg({ remarks: ['- PCF FOR ENROUTE WX DEVIATIONS', 'UNRELATED CREW NOTE', 'RAIM VALIDATION PASSED'] }));
    const pg = inp.pages.find(p => p.items.some(i => i.str === 'UNRELATED CREW NOTE'));
    const it = pg.items.find(i => i.str === 'UNRELATED CREW NOTE');
    it.y += dy;                                              // shift one item down (still above the next line)
    return mod.parseFlightKeys(inp, OPTS).pcf.reasons;
  };
  assert.deepEqual(gapAt(0.5 * PITCH), ['- PCF FOR ENROUTE WX DEVIATIONS\nUNRELATED CREW NOTE'], '1.5 pitches: not a blank line');
  assert.deepEqual(gapAt(0.7 * PITCH), ['- PCF FOR ENROUTE WX DEVIATIONS'], '1.7 pitches: a blank line');
  // without positions (text only) a blank line cannot be seen: the lines join (the app never types an empty line)
  // and a WARN says so; a spaces-only text line is not a blank line either
  const t0 = parseTextOnly(pkg({ remarks: ['- PCF FOR ENROUTE WX DEVIATIONS', BL, 'UNRELATED CREW NOTE'] }));
  assert.deepEqual(t0.pcf.reasons, ['- PCF FOR ENROUTE WX DEVIATIONS\nUNRELATED CREW NOTE']);
  assert.ok(warns(t0, 'ofpRemarks').some(w => /a printed blank line cannot be seen there/.test(w.message)));
  const sp = parseTextOnly(pkg({ remarks: ['- PCF FOR ENROUTE WX DEVIATIONS', '   ', 'UNRELATED CREW NOTE'] }));
  assert.deepEqual(sp.pcf.reasons, ['- PCF FOR ENROUTE WX DEVIATIONS\nUNRELATED CREW NOTE'], 'spaces-only text is not a blank line');
  // positions that do not match the text (another page's items) → WARN, never a guess
  const inp = appInput(pkg({ remarks: ['- PCF FOR ENROUTE WX DEVIATIONS', BL, 'UNRELATED CREW NOTE'] }));
  const k = inp.pages.findIndex(p => p.items.some(i => i.str === 'UNRELATED CREW NOTE'));
  inp.pages[k] = Object.assign({}, inp.pages[k], { items: inp.pages[0].items });
  const mm = mod.parseFlightKeys(inp, OPTS);
  assert.ok(warns(mm, 'ofpRemarks').some(w => w.message.startsWith(`positioned items missing or not matching the text on PDF page(s) ${k + 1}:`)));
});

// ══ fixtures ═════════════════════════════════════════════════════════════════

function fixturesDir() {
  if (process.env.PB_FIXTURES) {
    const d = path.resolve(process.env.PB_FIXTURES);
    return fs.existsSync(path.join(d, 'manifest.json')) ? d : null;
  }
  return findFixtures();
}
const FIXTURES = fixturesDir();

test('TC-161-090 fixtures missing → the fixture tests FAIL, none skipped (child run, empty PB_FIXTURES)', () => {
  if (process.env.PB_FC_CHILD) return;
  const os = require('os');
  const { spawnSync } = require('child_process');
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-nofix-'));
  try {
    const env = Object.assign({}, process.env, { PB_FIXTURES: empty, PB_FC_CHILD: '1' });
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', __filename], { encoding: 'utf8', env });
    assert.notEqual(run.status, 0, 'the child run fails');
    assert.match(run.stdout, /not ok \d+ - TC-161-090 fixtures missing/);
    assert.match(run.stdout, /# skipped 0/);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

if (!FIXTURES) {
  test('TC-161-090 fixtures missing → the fixture tests FAIL (never skip)', () => {
    assert.fail('pilotbrief-fixtures not found (set PB_FIXTURES or clone it beside the repo): TC-161-001/010/020/030/032/040/050 cannot run');
  });
} else {
  const manifest = readManifest(FIXTURES);
  const fk = manifest.fixtures.filter(f => f.format === 'flightkeys');
  const cache = new Map();
  const text = fx => fs.readFileSync(path.join(FIXTURES, fx.files.text), 'utf8');
  const run = fx => {
    if (!cache.has(fx.id)) {
      const items = JSON.parse(fs.readFileSync(path.join(FIXTURES, fx.files.items), 'utf8'));
      cache.set(fx.id, mod.parseFlightKeys(mod.inputFromExtractor(text(fx), items), OPTS));
    }
    return cache.get(fx.id);
  };
  const L = id => EXPECTED[id].label;
  const byLabel = lbl => fk.find(f => L(f.id) === lbl);
  const labelsWhere = pred => fk.filter(fx => pred(run(fx), fx)).map(fx => L(fx.id)).sort();

  test('TC-161-001 v0.1.0 fields byte-identical: v0.2.0 = recorded v0.1.0 output on all 26 fixtures', () => {
    assert.equal(fk.length, 26);
    assert.deepEqual(fk.map(f => f.id).sort(), Object.keys(BASELINE.fixtures).sort());
    let n = 0;
    for (const fx of fk) {
      const r = run(fx), b = BASELINE.fixtures[fx.id];
      for (const f of BASELINE.fields) { assert.equal(sha(JSON.stringify(r[f])), b.sha256[f], `${b.label}: ${f} unchanged`); n++; }
      for (const [icao, q] of Object.entries(b.specialQualification)) assert.equal(r.airportData[icao].specialQualification, q, `${b.label}: ${icao} Q`);
      const added = Object.keys(r.airportData).filter(k => !(k in b.specialQualification));
      // v0.2.0 added L15 PWAK (remarks weather); v0.3.0 adds every briefing airport (TC-162), each with its
      // briefing record. Nothing else is added.
      assert.equal(added.includes('PWAK'), b.label === 'L15', `${b.label}: PWAK entry (remarks weather)`);
      assert.deepEqual(added.filter(k => !r.airportData[k].briefing && k !== 'PWAK'), [], `${b.label}: airportData entries added only for briefing airports`);
      for (const k of added) assert.equal(r.airportData[k].specialQualification, false, `${b.label}: ${k} Q`);
      assert.deepEqual(Object.keys(r.airportData).slice(0, Object.keys(b.specialQualification).length), Object.keys(b.specialQualification), `${b.label}: entry order kept`);
      // the v0.1.0 findings, in order, inside the v0.2.0 findings
      const all = r.findings.map(f => JSON.stringify(f));
      let j = 0;
      for (const f of all) if (j < b.findings.length && f === JSON.stringify(b.findings[j])) j++;
      assert.equal(j, b.findings.length, `${b.label}: v0.1.0 findings kept`);
    }
    assert.equal(n, 26 * BASELINE.fields.length);
  });

  test('TC-161-010 crew on 26 fixtures (row 26, SC): private values; public counts, roles, flags; D62', () => {
    const crewPath = path.join(FIXTURES, CREW_FILE);
    assert.ok(fs.existsSync(crewPath), `private crew values missing: ${CREW_FILE} in the fixtures repo`);
    const CREW = JSON.parse(fs.readFileSync(crewPath, 'utf8')).fixtures;
    for (const fx of fk) {
      const r = run(fx), e = EXPECTED[fx.id], lbl = e.label;
      // values only from the private file; never printed (the message names the field)
      const got = r.crewMembers.map(c => ({ role: c.role, empNum: c.empNum, lastName: c.lastName, firstName: c.firstName, toLndgExpiry: c.toLndgExpiry, active: c.active }));
      assert.ok(JSON.stringify(got) === JSON.stringify(CREW[fx.id].crew), `${lbl}: crew values = private expected`);
      for (const c of r.crewMembers) {
        assert.equal(c.isSen, false, `${lbl}: isSen never set (SME-3)`);
        assert.equal(c.displayName, c.initial ? `${c.lastName} ${c.initial}` : c.lastName, `${lbl}: displayName`);
      }
      assert.deepEqual(r.crewMembers.map(c => c.role), e.crewRoles, `${lbl}: roles`);
      assert.equal(r.operatingPilots, e.operatingPilots, `${lbl}: operating pilots (D62)`);
      assert.equal(r.crewMembers.filter(c => c.toLndgExpiry === 'Not Reported').length, e.notReported, `${lbl}: Not Reported (SME-9)`);
      assert.equal(r.crewMembers.filter(c => c.lastName.startsWith('* ')).length, e.starPilots, `${lbl}: "*" kept with the last name`);
      const nc = Object.keys(e.notCrew).sort().map(k => `${k} ${e.notCrew[k]}`).join(', ');
      assert.equal(infos(r, 'crewMembers').filter(f => f.message === `crew lines not returned as crew (not shown): ${nc}`).length, nc ? 1 : 0, `${lbl}: not-crew INFO`);
      assert.ok(r.crewMembers.every(c => ['CA', 'FO', 'DH', 'JS'].includes(c.role)), `${lbl}: FA/PU/MX/LM never crew`);
      assert.deepEqual(warns(r).filter(f => /crew|operatingPilots/.test(f.field)), [], `${lbl}: no crew WARN`);
    }
    // D62: operating pilots per package (public)
    const op = Object.fromEntries(fk.map(fx => [L(fx.id), run(fx).operatingPilots]));
    assert.deepEqual(op, { T1: 4, T2: 4, T3: 4, L01: 2, L02: 4, L03: 3, L04: 2, L05: 2, L06: 3, L07: 3, L08: 3, L09: 3, L10: 3, L11: 3,
      L12: 4, L13: 4, L14: 4, L15: 4, L16: 3, L17: 3, L18: 4, L19: 3, L20: 4, L21: 2, L22: 3, L23: 3 });
    // field-map row 26 counts
    assert.deepEqual(labelsWhere(r => r.crewMembers.some(c => c.toLndgExpiry === 'Not Reported')), ['L03', 'L14', 'L16', 'L17', 'L18', 'L19', 'T1', 'T2', 'T3'], 'SME-9: blank in 9');
    assert.deepEqual(labelsWhere(r => r.crewMembers.some(c => c.lastName.startsWith('* '))), ['L01', 'L02', 'L15'], 'SME-3: "*" in 3');
    assert.deepEqual(labelsWhere(r => r.crewMembers.some(c => c.role === 'DH')), ['L08', 'L12', 'L21'], 'DH in 3');
    assert.equal(labelsWhere(r => r.crewMembers.some(c => c.role === 'JS')).length, 10, 'JS in 10');
    assert.deepEqual(labelsWhere(r => r.crewMembers.filter(c => c.role === 'CA').length === 2), ['L05', 'L22'], 'two CA in L05, L22');
  });

  test('TC-161-020 CAT II/III on 26 fixtures (row 24, SC): authorisations and restrictions', () => {
    for (const fx of fk) {
      const r = run(fx), e = EXPECTED[fx.id];
      assert.deepEqual(r.catIiIiiApproaches, e.catIiIiiApproaches, `${e.label}: authorisations`);
      assert.deepEqual(r.catIiIiiRestrictions.map(x => x.airport || x.source), e.catRestrictions, `${e.label}: restrictions`);
      for (const x of r.catIiIiiRestrictions) {
        assert.ok(!(x.airport && r.catIiIiiApproaches && (r.catIiIiiApproaches[x.airport] || []).some(a => x.runways.some(rw => a.rwys.split('/').includes(rw)))),
          `${e.label}: a restricted runway is never listed as authorised`);
      }
      assert.deepEqual(warns(r, 'catIiIiiApproaches'), []);
    }
    assert.deepEqual(labelsWhere(r => r.catIiIiiApproaches === null), ['L01', 'L05', 'L15', 'L19'], 'no authorisation in L01, L15, L19 (none printed) and L05 (restriction only)');
    assert.deepEqual(labelsWhere(r => r.catIiIiiRestrictions.length > 0), ['L01', 'L04', 'L05', 'T1', 'T3'], 'restrictions in 5 (SME-10)');
    assert.deepEqual(run(byLabel('L05')).catIiIiiRestrictions.map(x => [x.airport, x.category, x.runways]), [['KCVG', 'II/III', ['36C']]]);
    assert.deepEqual(run(byLabel('L23')).catIiIiiApproaches.ETAR, [{ cat: 'II/III', rwys: 'ALL RUNWAYS' }], 'ALL RWY = an authorisation');
  });

  test('TC-161-030 MEL/CDL/DDG on 26 fixtures (row 25, 32a): items, type, notes, TLR cross-reference', () => {
    for (const fx of fk) {
      const r = run(fx), e = EXPECTED[fx.id];
      assert.deepEqual(r.ddgItems.map(d => ({ type: d.type, code: d.code, tlr: d.tlr, notes: d.notes.length, descSha256: sha(d.desc) })), e.ddgItems, `${e.label}: ddgItems`);
      assert.equal(r.melItems, r.ddgItems.map(d => d.code + ' ' + d.desc).join(' | ').substring(0, 600), `${e.label}: melItems`);
      assert.ok(r.ddgItems.every(d => Object.keys(d).join() === 'code,desc,tlr,type,notes' && d.notes.every(n => n.indent === 1)), `${e.label}: shape; notes indented`);
      assert.deepEqual(warns(r, 'ddgItems'), [], `${e.label}: no WARN`);
    }
    assert.equal(labelsWhere(r => r.ddgItems.length > 0).length, 25, 'items in 25');
    assert.deepEqual(labelsWhere(r => r.ddgItems.length === 0), ['L15'], 'empty block in L15');
    assert.deepEqual(labelsWhere(r => r.ddgItems.some(d => d.type === 'CDL')), ['L01', 'L16', 'L18'], 'CDL in 3');
    assert.deepEqual(labelsWhere(r => r.ddgItems.some(d => d.tlr)), ['L10', 'L11', 'L12', 'L13', 'L16'], 'row 32a: 5');
    // Exec 17 Nov (PR #62): an item printed more than once is possible and not an anomaly — every copy is kept, no finding
    const repeated = r => r.ddgItems.some((d, i) => r.ddgItems.findIndex(x => x.code === d.code && x.desc === d.desc) !== i);
    assert.deepEqual(labelsWhere(repeated), ['L08', 'L09', 'L10', 'L12', 'L13', 'L14', 'L16', 'L20', 'L23'], 'repeated items in 9, every copy kept');
    assert.deepEqual(run(byLabel('L08')).ddgItems.map(d => d.code), ['31-41-01-01', '25-58-01A', '25-58-01A'], 'KMIA-EHBK truth sheet: listed twice');
    assert.deepEqual(run(byLabel('L12')).ddgItems.map(d => d.code), ['29-34-01-03', '25-57-01', '25-57-01', '25-20-01', '78-31-01A'], 'EBLG-KORD truth sheet: listed twice');
    assert.deepEqual(labelsWhere(r => infos(r, 'ddgItems').some(f => /more than once/.test(f.message))), [], 'no finding for a repeated item');
    assert.deepEqual(labelsWhere(r => infos(r, 'ddgItems').some(f => /late-addition/.test(f.message))), ['L23'], 'SME-19: L23 only (L12, L13 quote MELs already in the block)');
    assert.deepEqual(run(byLabel('L23')).ddgItems.slice(-1).map(d => [d.type, d.code]), [['MEL', '25-58-01A']]);
    assert.deepEqual(run(byLabel('L11')).ddgItems.filter(d => d.tlr).map(d => [d.code, d.tlr]), [['36-11-01', 'takeoff'], ['36-12-02-01', 'both']],
      'codes below the RMKS line are read (FlightKeys form)');
  });

  test('TC-161-032 TLR on 26 fixtures (row 32): oeiData = NavBlue, except the NavBlue page-break leak (L10)', () => {
    for (const fx of fk) {
      const r = run(fx), nb = navblue._ofpRulesetParse(text(fx)).oeiData, lbl = L(fx.id);
      if (lbl === 'L10') {
        assert.equal(r.oeiData.length, nb.length);
        r.oeiData.forEach((o, i) => {
          if (o.proc === nb[i].proc) assert.deepEqual(o, nb[i]);
          else {
            assert.match(nb[i].proc, /FUFI[0-9A-F-]+ PAGE \d+\/\d+/, 'NavBlue: footer in the procedure');
            assert.ok(nb[i].proc.startsWith(o.proc + ' '), 'the module keeps the procedure, without the page furniture');
            assert.deepEqual(Object.assign({}, o, { proc: nb[i].proc }), nb[i]);
          }
        });
      } else assert.deepEqual(r.oeiData, nb, `${lbl}: oeiData = NavBlue`);
      assert.ok(r.oeiData.every(o => !/FUFI|PAGE \d+\/\d+|^REL /.test(o.proc)), `${lbl}: no page furniture in a procedure`);
    }
    assert.equal(labelsWhere(r => r.oeiData.length > 0).length, 23, 'TLR in 23 (every live package)');
    assert.deepEqual(labelsWhere(r => r.revision.tlr && r.revision.tlr !== 'TLR-' + String(+r.revision.number)), [], 'TLR-n = release number');
  });

  test('TC-161-040 FK-P matched pair: FK UAAA-EHAM prototype vs EOFP matched pair, every field in scope', () => {
    const fkFx = fk.find(f => f.id === 'FK_UAAA-EHAM_27OCT26_prototype');
    const nbFx = manifest.fixtures.find(f => f.id === 'EOFP_UAAA-EHAM_27OCT26_matchedpair_rev11');
    assert.ok(fkFx && nbFx);
    const r = run(fkFx), nb = navblue._ofpRulesetParse(text(nbFx));
    const core = c => ({ role: c.role, empNum: c.empNum, lastName: c.lastName, initial: c.initial, displayName: c.displayName, active: c.active, isSen: c.isSen });
    // crew: the same four pilots; every NavBlue key equal person by person (the two plans print them in another order)
    assert.equal(r.crewMembers.length, nb.crewMembers.length);
    for (const c of r.crewMembers) {
      const n = nb.crewMembers.find(x => x.empNum === c.empNum);
      assert.ok(n && JSON.stringify(core(c)) === JSON.stringify(core(n)), 'crew: NavBlue keys equal for the same person');
    }
    assert.equal(r.hasTemperatureControl, nb.hasTemperatureControl, 'temperature control: equal (none in either)');
    // CAT II/III: equal for every airport both packages list
    const common = Object.keys(r.catIiIiiApproaches).filter(k => k in nb.catIiIiiApproaches);
    assert.deepEqual(common.sort(), ['EBBR', 'EHAM', 'LTAC', 'UAAA']);
    for (const k of common) assert.deepEqual(r.catIiIiiApproaches[k], nb.catIiIiiApproaches[k], `CAT ${k}`);
    // DDG: the same items and TLR values; NavBlue's core keys only (code, desc, tlr) — desc is worded differently
    assert.deepEqual(r.ddgItems.map(d => d.code).sort(), nb.ddgItems.map(d => d.code).sort());
    assert.ok(r.ddgItems.every(d => Object.keys(d).slice(0, 3).join() === 'code,desc,tlr'), 'NavBlue keys first');
    assert.deepEqual(r.ddgItems.map(d => d.tlr), nb.ddgItems.map(d => d.tlr));
    // Content the two PDFs print differently (checked in both texts; EOFP release 11 vs an unreleased FK prototype):
    const PLAN_DIFFERENCES = {
      hasPerishables: 'the EOFP prints "PERISHABLES O/B - YES"; the FK prototype prints no perishables line',
      catIiIiiApproaches: 'other airports listed: EOFP EDDB, EDDP (its redispatch airports); FK EBLG, EDDK, ELLX',
      ddgItems: 'same codes; titles worded differently (EOFP abbreviated capitals) and printed in another order',
      melItems: 'follows ddgItems',
      overflightPerms: 'different permit lists (FK prototype: two permits MISSING)',
      oeiData: 'the FK prototype has no TLR; the EOFP has one',
      crewMembers: 'same people and values; printed in another order',
    };
    const differ = Object.keys(PLAN_DIFFERENCES).filter(f => JSON.stringify(r[f]) !== JSON.stringify(nb[f]));
    assert.deepEqual(differ, Object.keys(PLAN_DIFFERENCES), 'exactly the listed differences differ');
    assert.equal(JSON.stringify(r.hasTemperatureControl), JSON.stringify(nb.hasTemperatureControl));
  });

  test('TC-161-050 remarks on 26 fixtures: ofpRemarks, airport remarks, weather, flags, fuel, permits, revision', () => {
    for (const fx of fk) {
      const r = run(fx), e = EXPECTED[fx.id], lbl = e.label;
      const rem = r.ofpRemarks.filter(x => x.category !== 'adhocPenalty' && x.category !== 'cdcAttestation');
      assert.equal(rem.flatMap(x => x.text.split('\n')).length, e.ofpRemarksLines, `${lbl}: every Remarks line (a D63 remark keeps its lines)`);
      assert.equal(sha(rem.map(x => x.text).join('\n')), e.ofpRemarksSha, `${lbl}: Remarks text, in order`);
      const cdc = r.ofpRemarks.filter(x => x.category === 'cdcAttestation');
      assert.equal(cdc.flatMap(x => x.text.split('\n')).length, e.cdcLines, `${lbl}: CDC attestation lines`);
      assert.ok(cdc.length <= 1, `${lbl}: the CDC attestation is one remark (D63a)`);
      if (cdc.length) assert.equal(sha(cdc.map(x => x.text).join('\n')), e.cdcSha, `${lbl}: CDC attestation text`);
      assert.deepEqual(r.ofpRemarks.map(x => x.category).filter(c => c === 'adhocPenalty' || c === 'cdcAttestation'),
        r.ofpRemarks.slice(rem.length).map(x => x.category), `${lbl}: release order (Remarks, MEL-block penalty lines, CDC)`);
      assert.equal(r.hasPerishables, e.perishables, `${lbl}: perishables`);
      assert.equal(r.hasTemperatureControl, e.temperatureControl, `${lbl}: temperature control`);
      assert.equal(r.securityMessages.length, e.securityMessages, `${lbl}: security`);
      assert.deepEqual({ fuel: r.extraFuel.fuel, minutes: r.extraFuel.minutes, tanker: r.extraFuel.tanker }, e.extra, `${lbl}: extra fuel`);
      assert.deepEqual({ fuel: r.pcf.fuel, minutes: r.pcf.minutes }, e.pcf, `${lbl}: PCF`);
      assert.deepEqual(r.permits.map(x => x.type + ' ' + x.country).concat(r.permits.filter(x => x.adc && x.type !== 'ADC').map(x => 'ADC ' + x.country)), e.permits, `${lbl}: permits`);
      assert.equal(sha(r.overflightPerms), e.overflightPermsSha, `${lbl}: overflightPerms`);
      assert.deepEqual({ kind: r.revision.kind, number: r.revision.number }, e.revision, `${lbl}: revision`);
      assert.deepEqual([...new Set(r.ofpRemarks.filter(x => x.category === 'stationRestriction' && x.airport).map(x => x.airport))], e.stationAirports, `${lbl}: station blocks`);
      assert.deepEqual(Object.entries(r.airportData).flatMap(([k, v]) => v.remarksWeather.map(() => k)), e.remarksWeather, `${lbl}: remarks weather`);
      assert.equal(r.findings.some(f => /\(SME-18\)$/.test(f.message)), e.takeoffAlternateFlag, `${lbl}: takeoff-alternate flag`);
      for (const a of Object.values(r.airportData)) for (const w of a.remarksWeather)
        assert.ok(!a.weather.includes(w.text), `${lbl}: remarks weather never merged into the briefing weather`);
      assert.deepEqual(warns(r).filter(f => !(lbl === 'L21' && /\(SME-18\)$/.test(f.message)) && !(lbl === 'T1' && f.field === 'permits')), [], `${lbl}: no other WARN`);
    }
    const has = cat => labelsWhere(r => r.ofpRemarks.some(x => x.category === cat));
    assert.equal(has('raim').length, 26);
    assert.equal(has('boilerplate').length, 23, 'FlightKeys boilerplate in every live package');
    assert.deepEqual(has('cargoDeclaration'), ['L20']);
    assert.deepEqual(has('perishables'), ['L03', 'L08', 'L10', 'L12', 'L13', 'L16', 'L17']);
    assert.deepEqual(has('security'), ['L07']);
    // Exec 17 Nov (PR #62): the security line is for the Preflight card only (D45), never on the airport card
    const l07 = run(byLabel('L07'));
    assert.deepEqual(l07.securityMessages.map(s => s.text), ['POS LAUNCH TO DWC APPROVED BY SECURITY']);
    assert.ok(Object.values(l07.airportData).every(a => a.remarks.every(x => !/SECURITY/.test(x.text))), 'security line on no airport card');
    assert.deepEqual(has('permit'), ['L17']);
    assert.deepEqual(has('slot'), ['L16']);
    assert.deepEqual(has('ewins'), ['L22']);
    assert.deepEqual(has('stationRestriction'), ['L01', 'L06', 'L09', 'L21', 'L22']);
    assert.deepEqual(has('weather'), ['L15', 'T3']);
    assert.deepEqual(has('route'), ['L03', 'L12', 'L14', 'L23']);
    assert.deepEqual(has('melChange'), ['L12', 'L13', 'L23']);
    assert.deepEqual(has('fleetNote'), ['L03', 'L14', 'L17', 'L20']);
    assert.deepEqual(has('exemption'), ['L08', 'L11', 'L13', 'L15', 'L21', 'L22']);
    assert.deepEqual(has('extraFuel'), ['L05', 'L15', 'L23']);
    assert.deepEqual(has('cdcAttestation'), ['L01', 'L09', 'L12', 'L16', 'L22'], 'CDC attestation in every US-bound live package (5)');
    assert.deepEqual(has('adhocPenalty'), ['L02', 'T1', 'T3']);
    assert.deepEqual(labelsWhere(r => r.hasPerishables), ['L03', 'L08', 'L10', 'L12', 'L13', 'L16', 'L17'], 'row 27: 7');
    assert.deepEqual(labelsWhere(r => r.hasTemperatureControl), [], 'row 28: none (L20 declares NO)');
    assert.deepEqual(labelsWhere(r => r.extraFuel.tanker), ['L15'], 'D39: tanker in L15 only');
    assert.deepEqual(labelsWhere(r => +r.pcf.fuel > 0).length, 17, 'non-zero PCF in 17');
    assert.deepEqual(labelsWhere(r => +r.pcf.fuel > 0 && !r.pcf.reasons.length), ['L01'], 'PCF reason in 16 of 17 (none in L01)');
    assert.deepEqual(labelsWhere(r => r.permits.some(p => p.type === 'OVERFLIGHT')), ['L01', 'L07', 'L09', 'L10', 'L13', 'L17', 'L22', 'T1'], 'overflight 8');
    assert.deepEqual(labelsWhere(r => r.permits.some(p => p.type === 'LANDING')), ['L03', 'L06', 'L07', 'L11', 'L15'], 'landing 5');
    assert.deepEqual(labelsWhere(r => r.permits.some(p => p.type === 'TAKEOFF')), ['L16', 'T2'], 'takeoff 2');
    assert.deepEqual(labelsWhere(r => r.permits.some(p => p.restriction)), ['L07'], 'registration restriction in L07');
    assert.deepEqual(labelsWhere(r => r.permits.some(p => p.adc)), ['L17'], 'ADC with its permit');
    assert.deepEqual(labelsWhere(r => r.findings.some(f => /\(SME-18\)$/.test(f.message))), ['L21'], 'SME-18: L21 only');
    // SME-18a: L21 (B763) takes the 767 items; the 747 line is not attached
    const l21 = run(byLabel('L21'));
    assert.equal(l21.airportData.NZWN.remarks.length, 5);
    assert.ok(l21.airportData.NZWN.remarks.every(x => x.fleet === '767'));
    assert.ok(infos(l21, 'airportData').some(f => /1 station-restriction line\(s\) under another fleet's sub-heading not attached/.test(f.message)));
    assert.deepEqual(Object.entries(run(byLabel('L06')).airportData.LEZG.remarks.reduce((a, x) => (a[x.subHeading] = (a[x.subHeading] || 0) + 1, a), {})),
      [['null', 1], ['ARRIVALS', 1], ['DEPARTURES', 1]], 'L06 sub-cards ARRIVALS / DEPARTURES (D34); one remark each (D63)');
    // SME-23: L15's dispatcher TAF for PWAK is attached to PWAK, raw only
    const l15 = run(byLabel('L15'));
    assert.deepEqual(l15.airportData.PWAK.remarksWeather.map(x => [x.source, x.type]), [['GOV TAF UPDATED', 'TAF']]);
    assert.equal(run(byLabel('L23')).extraFuel.type, 'CAPTAIN');
    assert.equal(run(byLabel('L05')).extraFuel.type, 'PRE-FUELED');
    assert.deepEqual(labelsWhere(r => r.revision.kind === 'REV'), ['L20', 'L21', 'L22', 'L23']);
    assert.deepEqual(labelsWhere(r => r.revision.kind === 'NOT RELEASED'), ['T1', 'T2', 'T3']);
    assert.deepEqual(labelsWhere(r => r.revision.copies === 3 && r.revision.copiesIdentical), ['L02', 'L20', 'L21', 'L22', 'L23']);
  });

  test('TC-161-100 D63 on the fixtures: a wrapped airport remark is one remark; marked items stay apart', () => {
    // airport remarks per package (station blocks in L01, L06, L09, L21, L22 only; field map §2.4)
    const want = { L01: { MKJP: 1 }, L06: { LEZG: 3 }, L09: { VHHH: 1 }, L21: { NZWN: 5, NFFN: 3 }, L22: { EPPW: 1 } };
    for (const fx of fk) {
      const r = run(fx), e = EXPECTED[fx.id], lbl = e.label;
      const got = Object.fromEntries(Object.entries(r.airportData).filter(([, v]) => v.remarks.length).map(([k, v]) => [k, v.remarks.length]));
      assert.deepEqual(got, want[lbl] || {}, `${lbl}: airport remarks per airport`);
      const st = r.ofpRemarks.filter(x => x.category === 'stationRestriction' && x.airport);
      const items = Object.values(r.airportData).flatMap(v => v.remarks);
      assert.ok(items.every(it => st.some(x => x.text === it.text && x.page === it.page && x.line === it.line)), `${lbl}: each airport remark is one ofpRemarks record`);
    }
    // L21 NFFN (positive): the circling condition and its minima are ONE remark, its line break kept
    const l21 = run(byLabel('L21'));
    assert.deepEqual(l21.airportData.NFFN.remarks.map(x => x.text), ['- NIGHT TAKE-OFF NOT PERMITTED ON RWY 09.',
      '- NIGHT LANDING NOT PERMITTED ON RWYS 20 & 27.', '- CIRCLING FOR RWY 20 IS AUTHORIZED PROVIDED THE FOLLOWING\nMINIMA ARE OBSERVED: DAY ONLY.']);
    // L21 NZWN (negative): five adjacent numbered items stay five
    assert.deepEqual(l21.airportData.NZWN.remarks.map(x => x.text.slice(0, 3)), ['1. ', '2. ', '3. ', '4. ', '5. ']);
    assert.ok(l21.airportData.NZWN.remarks.every(x => !x.text.includes('\n')));
    // L06 LEZG (positive): the caution (3 lines) is one remark; each sub-heading starts one remark (no item marker in the block)
    const lezg = run(byLabel('L06')).airportData.LEZG.remarks;
    assert.deepEqual(lezg.map(x => [x.subHeading, x.text.split('\n').length]), [[null, 3], ['ARRIVALS', 1], ['DEPARTURES', 6]]);
    assert.ok(lezg[0].text.startsWith('***USE EXTREME CAUTION') && lezg[0].text.endsWith('PROCEDURES***'));
    // L09 VHHH (positive): one dash item over two lines
    assert.deepEqual(run(byLabel('L09')).airportData.VHHH.remarks.map(x => x.text.split('\n').length), [2]);
  });

  test('TC-161-200 D63a on the fixtures: exemption, fleet note, CDC attestation (and other paragraphs) are one remark each', () => {
    // ofpRemarks records per package (Remarks run, without the ADHOC and CDC blocks) after D63 and D63a
    const RECORDS = { L01: 5, L02: 12, L03: 14, L04: 11, L05: 5, L06: 12, L07: 8, L08: 14, L09: 10, L10: 8, L11: 16, L12: 9,
      L13: 15, L14: 13, L15: 7, L16: 7, L17: 14, L18: 9, L19: 4, L20: 15, L21: 17, L22: 12, L23: 15, T1: 10, T2: 6, T3: 13 };
    const lines = (r, cat) => r.ofpRemarks.filter(x => x.category === cat).map(x => x.text.split('\n').length);
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx.id);
      assert.equal(r.ofpRemarks.filter(x => x.category !== 'adhocPenalty' && x.category !== 'cdcAttestation').length, RECORDS[lbl], `${lbl}: records`);
      if (EXPECTED[fx.id].cdcLines) assert.deepEqual(lines(r, 'cdcAttestation'), [6], `${lbl}: the CDC attestation = ONE remark of 6 lines`);
    }
    // positive: the 2-line exemption (6 packages), the 3-line fleet note (4), the boilerplate (23) are ONE remark each
    assert.deepEqual(labelsWhere(r => lines(r, 'exemption').join() === '2'), ['L08', 'L11', 'L13', 'L15', 'L21', 'L22']);
    assert.deepEqual(labelsWhere(r => lines(r, 'fleetNote').join() === '3'), ['L03', 'L14', 'L17', 'L20']);
    assert.equal(labelsWhere(r => lines(r, 'boilerplate').join() === '3').length, 23);
    const l08 = run(byLabel('L08')).ofpRemarks.find(x => x.category === 'exemption');
    assert.ok(/ALTERNATE AIRPORT\nREQUIRED\./.test(l08.text), 'L08: the wrapped exemption keeps its printed line break');
    assert.deepEqual(lines(run(byLabel('L12')), 'melChange'), [4], 'L12: the MEL-change paragraph is one remark');
    assert.deepEqual(lines(run(byLabel('L15')), 'weather'), [1, 4], 'L15: heading, then the TAF with its 3 continuation lines');
    // negative: two recognised items in a row stay two (L13: two PCF lines, the second with its wrap; L20 cargo declarations)
    assert.deepEqual(lines(run(byLabel('L13')), 'pcf'), [1, 2]);
    assert.deepEqual(lines(run(byLabel('L20')), 'cargoDeclaration'), [1, 1, 1, 1], 'one-line items never take a continuation');
    assert.ok(labelsWhere(r => r.ofpRemarks.some(x => ['dispatcher', 'raim', 'catIiIii', 'perishables', 'security', 'permit', 'ewins'].includes(x.category) && x.text.includes('\n'))).length === 0,
      'a one-line recognised item is never joined');
    // O-10 (1) on the fixtures: T3's 3 test lines after the dispatcher line stay a remark of their own (counts only)
    const t3 = run(byLabel('T3')).ofpRemarks;
    assert.deepEqual(t3.slice(0, 2).map(x => [x.category, x.text.split('\n').length]), [['dispatcher', 1], ['other', 3]]);
    // the reason lists keep the printed line breaks (no reflow)
    assert.deepEqual(run(byLabel('L13')).pcf.reasons.map(x => x.split('\n').length), [1, 2]);
    assert.ok(run(byLabel('L15')).airportData.PWAK.remarksWeather[0].text.split('\n').length === 4);
  });

  // ── QA F1: blank lines from the positions, on the real items ──
  const itemsOf = fx => mod.inputFromExtractor(text(fx), JSON.parse(fs.readFileSync(path.join(FIXTURES, fx.files.items), 'utf8'))).pages;
  // the first release copy as printed: body lines with their PDF page and y (the test's own reading)
  const releaseRows = (pages) => {
    const rows = [];
    for (const p of pages) {
      const ls = appLines(p), fm = /^FUFI: [0-9A-F-]+ PAGE (\d+)\/(\d+)$/.exec(ls.length ? ls[ls.length - 1].str : '');
      if (!fm || !/^OPERATIONAL FLIGHT PLAN\b/.test(ls[1].str)) { if (rows.length) break; continue; }
      if (rows.length && +fm[1] === 1) break;
      ls.slice(2, -1).forEach(l => rows.push({ page: p.page, y: l.y, t: l.str.trim() }));
      if (+fm[1] === +fm[2]) break;
    }
    return rows;
  };
  const GAP = 1.6 * 13.2;
  const isGap = (a, b) => a.page === b.page && b.y - a.y >= GAP;
  // one printed line of a copy of the real items (the row at y on PDF page pg) made into ONE item, then its str
  // replaced and/or its y shifted; the text is rebuilt by the app reader
  const edited = (fx, pg, y, change) => {
    const pages = JSON.parse(JSON.stringify(itemsOf(fx)));
    const row = pages.find(p => p.page === pg).items.filter(it => it.str && Math.abs(it.y - y) <= 2).sort((a, b) => a.x - b.x);
    assert.ok(row.length >= 1, 'the line to change is found');
    row[0].str = row.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
    row.slice(1).forEach(it => { it.str = ''; });
    change(row[0]);
    return mod.parseFlightKeys({ text: appText(pages), pages }, OPTS);
  };
  const INVENTED = 'GALLEY DRAIN TO BE CHECKED BEFORE DEPARTURE';   // made up; recognised as no category

  test('TC-161-300 QA F1: the test input is the app reader: appText() rebuilds the text of all 26 fixtures from their items', () => {
    for (const fx of fk) assert.equal(appText(itemsOf(fx)), text(fx), `${L(fx.id)}: text = app reader(items)`);
  });

  test('TC-161-301 QA F1 cases: an unrelated remark after a printed blank line never joins the PWAK weather (L15) or the PCF reason (L17)', () => {
    for (const [lbl, field] of [['L15', 'PWAK weather'], ['L17', 'PCF reasons']]) {
      const fx = byLabel(lbl), base = run(fx);
      const get = r => lbl === 'L15' ? r.airportData.PWAK.remarksWeather.map(x => x.text) : r.pcf.reasons;
      // the RAIM line follows the TAF / the PCF reason after a printed blank line
      const rows = releaseRows(itemsOf(fx));
      const k = rows.findIndex(x => x.t === 'RAIM VALIDATION PASSED');
      assert.ok(k > 0 && isGap(rows[k - 1], rows[k]), `${lbl}: a printed blank line above RAIM`);
      const raim = [rows[k].page, rows[k].y];
      // positive (QA's case): the RAIM text replaced by an unrelated line, positions unchanged → a remark of its own
      const r1 = edited(fx, ...raim, it => { it.str = INVENTED; });
      assert.deepEqual(get(r1), get(base), `${lbl}: ${field} unchanged`);
      assert.ok(!get(r1).join('\n').includes(INVENTED), `${lbl}: the unrelated line is not in the ${field}`);
      assert.deepEqual(r1.ofpRemarks.filter(x => x.text.includes(INVENTED)).map(x => [x.category, x.text, x.subHeading]), [['other', INVENTED, null]]);
      assert.deepEqual(warns(r1, 'ofpRemarks'), []);
      // negative: the same item shifted up by one line pitch (no blank line any more) → it continues the remark above
      const r2 = edited(fx, ...raim, it => { it.str = INVENTED; it.y -= 13.2; });
      assert.deepEqual(get(r2), [...get(base).slice(0, -1), get(base).slice(-1)[0] + '\n' + INVENTED], `${lbl}: normal spacing joins (D63a)`);
      // and the real RAIM line shifted the same way still starts its own remark (a recognised item)
      const r3 = edited(fx, ...raim, it => { it.y -= 13.2; });
      assert.deepEqual(get(r3), get(base));
    }
  });

  // Unmarked blocks (D63a: the general Remarks run, the CDC attestation): every printed blank line ends a remark.
  // Station blocks mark their items (D63): a new remark starts only at the block's marker, so an item may run
  // across a printed blank line there (L06 LEZG DEPARTURES, two blank lines); those are counted, not split.
  test('TC-161-303 QA F1 on the 26: joined remarks = printed lines in order; every printed blank line in an unmarked block is a record boundary', () => {
    let gaps = 0, joins = 0;
    const marked = [];
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx.id), rows = releaseRows(itemsOf(fx));
      const rs = rows.findIndex(x => x.t === 'Remarks'), me = rows.findIndex((x, i) => i > rs && x.t === 'MEL/CDL');
      const fe = rows.findIndex((x, i) => i > rs && /^Flight Release Authorization\b/.test(x.t));
      assert.ok(rs !== -1 && me > rs && fe > me, `${lbl}: Remarks, MEL/CDL and the authorisation found`);
      const blocks = [['Remarks', rows.slice(rs + 1, me), r.ofpRemarks.filter(x => x.category !== 'adhocPenalty' && x.category !== 'cdcAttestation')]];
      const cs = rows.findIndex((x, i) => i > fe && /^\*{3}\s*CDC ATTESTATION\b/.test(x.t));
      if (cs !== -1) {
        const ce = rows.findIndex((x, i) => i > cs && /^Signed by PIC\b|^Fit for Duty Affirmation\b/.test(x.t));
        blocks.push(['CDC', rows.slice(cs, ce), r.ofpRemarks.filter(x => x.category === 'cdcAttestation')]);
      } else assert.equal(r.ofpRemarks.filter(x => x.category === 'cdcAttestation').length, 0, `${lbl}: no CDC block, no CDC remark`);
      for (const [name, printed, recs] of blocks) {
        const owner = recs.flatMap((x, n) => x.text.split('\n').map(t => ({ t, n })));
        assert.deepEqual(owner.map(o => o.t), printed.map(x => x.t), `${lbl} ${name}: joined remarks = printed lines, in order`);
        for (let j = 1; j < printed.length; j++) {
          const st = recs[owner[j].n].category === 'stationRestriction' && recs[owner[j - 1].n].category === 'stationRestriction';
          if (isGap(printed[j - 1], printed[j])) {
            if (st) { if (owner[j].n === owner[j - 1].n) marked.push(`${lbl} ${recs[owner[j].n].airport}`); continue; }
            gaps++; assert.notEqual(owner[j].n, owner[j - 1].n, `${lbl} ${name}: a printed blank line before "${name} line ${j + 1}" ends the remark`);
          } else if (owner[j].n === owner[j - 1].n) joins++;
        }
      }
      // the ADHOC lines of the MEL/CDL block, in order, from its heading
      const ad = r.ofpRemarks.filter(x => x.category === 'adhocPenalty').flatMap(x => x.text.split('\n'));
      if (ad.length) { const a0 = rows.findIndex((x, i) => i > me && x.t === ad[0]); assert.deepEqual(rows.slice(a0, a0 + ad.length).map(x => x.t), ad, `${lbl}: ADHOC lines`); }
      assert.deepEqual(warns(r, 'ofpRemarks'), [], `${lbl}: positions read on every release page`);
    }
    assert.equal(gaps, 131, 'printed blank lines in the unmarked blocks of the 26 (each ends a remark)');
    assert.ok(joins > 0);
    assert.deepEqual(marked, ['L06 LEZG', 'L06 LEZG'], 'D63: one station item (L06 LEZG DEPARTURES) printed across two blank lines, kept one remark as D63 says');
  });

  test('TC-161-304 QA F3: an MEL/CDL note printed over several lines keeps its line breaks (L13, L19); every note = its printed lines', () => {
    const multi = {};
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx.id), rows = releaseRows(itemsOf(fx)).map(x => x.t);
      const me = rows.indexOf('MEL/CDL');
      for (const d of r.ddgItems.filter(x => !x.notes.some(n => /\bSTR ADD\b|ADD MEL|MEL ADDED/.test(n.text)))) for (const n of d.notes) {
        const ls = n.text.split('\n'), a = rows.indexOf(ls[0], me);
        assert.ok(a > me, `${lbl} ${d.code}: note found in the MEL/CDL block`);
        assert.deepEqual(rows.slice(a, a + ls.length), ls, `${lbl} ${d.code}: the note = its printed lines, line breaks kept`);
        if (ls.length > 1) (multi[lbl] = multi[lbl] || []).push(`${d.code}:${ls.length}`);
      }
    }
    assert.deepEqual(multi, { L13: ['36-11-08C:2'], L19: ['21-51-06-02:2'] }, 'the notes printed over several lines (2 each), with their line breaks');
    // negative: a one-line note stays one line (no line break added)
    assert.ok(fk.every(fx => run(fx).ddgItems.every(d => d.notes.every(n => !/\n$|^\n|\n\n/.test(n.text)))));
  });
}
