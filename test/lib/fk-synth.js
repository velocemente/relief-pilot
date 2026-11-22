'use strict';
/**
 * test/lib/fk-synth.js — TEST CODE ONLY (step 5f). Builds SYNTHETIC FlightKeys packages (D87: every case
 * made here is synthetic; made-up identifiers, no fixture data, no crew names) as the app's extractor
 * delivers them: { text, pages[{ page, width, height, items[] }] }.
 *
 *   release(o)          the release pages as text (the TC-161 package of test/rules/ofp-flightkeys-release
 *                       .test.js, reduced): o.remarks = lines after the FlightKeys boilerplate, o.raim = the
 *                       RAIM line(s) (default ['RAIM VALIDATION PASSED']; [] = none), o.boiler = the
 *                       boilerplate lines (default the "Contact Dispatch with questions." form; [] = none),
 *                       o.remarksNextPage = remark lines printed at the top of the next release page
 *   BL                  a printed blank line (no item; one pitch of empty space: a gap in the positions)
 *   input(src, extra)   positioned items for the release text (one item per line, 13.2 pt pitch, x 58.7)
 *                       plus extra briefing pages (vaPage(), notamPage()) appended as their own PDF pages
 *   vaPage(lines)       a Volcanic Ash Advisories page as FlightKeys prints it (footer "Page1of1 <uuid>")
 *   VA_NONE_LINES       the closed "no advisories" form
 *   vaAdvisory(list)    an advisory page: [{ nr, volcano, vaac, volcanoNo }] → lines
 *   notamPage(lines)    a one-page NOTAM Briefing document (footer "Page 1 of 1 <uuid>")
 *
 * The release reader sees a blank line only as a gap (src/pdf.html writes no empty line, D63a); the
 * briefing reader reads positions only (§ 7 of the module). Nothing here is copied into the app.
 */
const assert = require('node:assert/strict');

const HDR = 'TST0001/08MAR/KAAA-KBBB/N000ZZ';
const BOILER = ['This OFP prepared with FlightKeys. Review Operations Bulletin', 'for FlightKeys OFP and procedure changes. Contact Dispatch with', 'questions.'];
const BL = '\u0000BLANK LINE';
const PITCH = 13.2;

function release(o = {}) {
  const title = 'OPERATIONAL FLIGHT PLAN RLS 01 08MAR26 12:00';
  const p1 = ['TST0001/08 KAAA - KBBB 08 MAR 26 N000ZZ', 'COST INDEX 020 Revision: 1.0',
    'B747-400F / CF6-80C2-B1F / KG / IFR / FF +4.0', 'PROGS 081200 Release Valid Until 2300Z 08MAR26',
    'ORIG KAAA/AAA ALPHA INTL N40000W080000 1755Z', 'DEST KBBB/BBB BRAVO INTL N41000W081000 0328Z',
    'PALT KCCC/CCC CHARLIE N42000W082000 0345Z',
    'TRIP 100000 09.33 4000', 'CONT 003000 00.10', 'ALT1 008000 00.25 0200', 'FRES 007000 00.30', 'PCF 002000 00.07',
    'MINF 120000 10.45 ....', 'EXTRA 001500 00.05', 'TOF 121500 10.50', 'TAXI 001000 00.20', 'BLOCK 122500 11.10', 'REMF 020000 01.12'];
  const p2a = ['Remarks', 'DISPATCHER DESK: 00', ...(o.boiler || BOILER), ...(o.remarks || [])];
  const p2 = [...(o.remarksNextPage || []), ...(o.raim || ['RAIM VALIDATION PASSED']), 'MEL/CDL', 'Flight Release Authorization',
    'I certify that this flight has been dispatched in accordance with',
    'Signed by PIC .. .. .. .. (Circle name below)', 'Signed by Dispatcher: DISPATCHER', 'Fit for Duty Affirmation',
    'By signing below, I affirm that I am fit for duty to operate this', 'flight.', 'FIT FOR DUTY/   RELIEF PIC', 'JS VERIFY   START-END(Z)',
    'CA 100001 Sample, Alpha .. .. .. .. ..', 'TO/LNDG Expiry: 2027-01-01', 'FO 100002 Example, Bravo .. .. .. .. ..', 'TO/LNDG Expiry:'];
  const p3 = ['TIME FUEL', '(FPL-TST0001-IS', '-B744/H-SDE1E2E3FGHIJ3J5M1P2RWXYZ/LB1D1', '-KAAA1755',
    '-N0481F320 DCT AAAAA DCT BBBBB', '-KBBB0933 KCCC', '-PBN/A1B1 DOF/260308 REG/N000ZZ SEL/ABCD RMK/TCAS II EQUIPPED)',
    'Overflight/Landing Permits'];
  const p4 = ['AWY   WPT   MTK   NM   GS   TAS   LEG-T   ETA   MTRS   ISA   WC   REMF',
    'MORA  TTK  MH  IAS  .M  TOT-T  ATA  FL  TEMP  WIND  AREM', 'SID TOC', 'N40 10.0 090 50 400 450 00.15', 'W079 50.0 090 090 300 .80 00.15 320',
    'Destination Primary Alternate Route', 'KBBB DCT KCCC', 'KCCC/0100', 'GCD 50 GDIS 55 FUEL 8000 TIME 00.25', 'MORA 3000'];
  const pages = o.remarksNextPage ? [p1, p2a, p2, p3, p4] : [p1, [...p2a, ...p2], p3, p4];
  return 'BRIEFING COVER PAGE\n\n' + pages.map((b, i) => [HDR, title, ...b,
    `FUFI: 00000000-0000-0000-0000-000000000000 PAGE ${i + 1}/${pages.length}`].join('\n') + '\n\n').join('');
}

// processPDF()'s line assembly (the copy in test/rules/ofp-flightkeys-release.test.js, TC-161-300).
function appLines(p) {
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
    if (lineStr.trim()) out.push(lineStr);
  });
  return out;
}

// ── briefing pages (positions as FlightKeys prints them: 841.9 x 595.3 pt, Courier 4.8 pt per character) ──
const W = 841.889, H = 595.275, CW = 4.8, LX = 30.346;
function lineItems(y, text) {
  const items = [], re = /\S+(?: \S+)*/g;
  let m;
  while ((m = re.exec(text)) !== null) items.push({ str: m[0], x: LX + m.index * CW, y, w: m[0].length * CW, h: 8, font: 'f8' });
  return items;
}
function briefingPage(lines, footer, uuid) {
  const items = [{ str: 'TST0001/KAAA-KBBB/2026-03-08/N000ZZ', x: 28.346, y: 19.877, w: 160, h: 8, font: 'f6' },
    { str: '2026-Mar-08 08:17', x: 747.2, y: 19.877, w: 81.6, h: 8, font: 'f6' }];
  lines.forEach((t, k) => items.push(...lineItems(48 + k * 9.6, t)));
  items.push({ str: footer, x: 28.346, y: 579.398, w: footer.length * CW, h: 8, font: 'f6' });
  items.push({ str: uuid, x: 671.1, y: 579.398, w: 172.8, h: 8, font: 'f6' });
  return { width: W, height: H, items };
}
const vaPage = lines => briefingPage(lines, 'Page1of1', '00000000-0000-4000-8000-0000000000a1');
const notamPage = lines => briefingPage(lines, 'Page 1 of 1', '00000000-0000-4000-8000-0000000000b1');
const VA_NONE_LINES = ['         NO VOLCANIC ASH ADVISORIES', '               FOUND FOR THIS FLIGHT'];
// An advisory page: the list (one row per advisory, the INTERSECTS / FLIGHT / TIMES column header) and the
// advisory blocks, as the one real page prints them (the VAA number glued to its label).
function vaAdvisory(list, o = {}) {
  const out = ['          VOLCANIC ASH ADVISORIES', ' '.repeat(69) + 'INTERSECTS'];
  list.forEach((a, k) => out.push(`  VAA${a.nr}      ${a.volcano.padEnd(20)}${k === 0 ? 'FLIGHT' : ''}`.replace(/\s+$/, ''),
    ...(k === 0 ? [' '.repeat(69) + 'TIMES'] : [])));
  for (const a of list) {
    out.push('2026-03-08T10:00:00Z - 2026-03-08T16:00:00Z', 'FVXX01 KZZZ 080600', 'VA ADVISORY', 'DTG: 20260308/0600Z');
    if (!o.noVaac) out.push(`VAAC: ${a.vaac}`);
    if (!o.noVolcano) out.push(`VOLCANO: ${a.volcano}${a.volcanoNo ? ' ' + a.volcanoNo : ''}`);
    out.push('PSN: N5000 E15000', 'AREA: TESTLAND');
    if (!o.noNumber) out.push(`ADVISORY NR: ${a.nr}`);
    out.push('OBS VA CLD: SFC/FL100 N5000 E15000 - N5100 E15100 - N5000 E15000', 'NXT ADVISORY: 20260308/1200Z');
  }
  return out;
}

// The release text + extra briefing pages → the extractor's input. Release lines: one item each, x 58.7,
// 13.2 pt pitch; a BL line takes one pitch and gives no item.
function input(src, extra = []) {
  const pages = src.replace(/\n$/, '').split('\n\n').map((pg, i) => {
    const items = [];
    pg.split('\n').forEach((l, k) => { if (l !== BL) items.push({ str: l, x: 58.7, y: 40 + k * PITCH, w: l.length * 5, h: 9.6, font: 'f1', order: items.length }); });
    return { page: i + 1, width: 612, height: 792, items };
  });
  const relText = pages.map(p => appLines(p).join('\n') + '\n\n').join('');
  assert.equal(relText, src.split('\n').filter(l => l !== BL).join('\n'), 'fk-synth: the app reader gives back the release text');
  for (const p of extra) pages.push({ page: pages.length + 1, width: p.width, height: p.height, items: p.items.map((it, k) => Object.assign({ order: k }, it)) });
  const text = pages.map(p => appLines(p).join('\n') + '\n\n').join('');
  return { text, pages };
}

module.exports = { release, input, vaPage, notamPage, vaAdvisory, VA_NONE_LINES, BL, BOILER };
