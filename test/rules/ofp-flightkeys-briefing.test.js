'use strict';
/**
 * TC-162 — FlightKeys OFP parser v0.3.0 (rules/ofp-flightkeys, development version, D58 amended): the
 * briefing reader (step 5d; Exec decision D64). TC-160 / TC-161 keep testing the v0.1.0 / v0.2.0 fields.
 * Grammar: docs/RPT-OFP-FlightKeys-BriefingGrammar-UPD-20261118-v1.1.md §A.1–§A.11 (v1.1); field map v1.2 rows 37,
 * 38, 43–45, 48, 50; SME-1, SME-15, SME-17, SME-21, SME-23.
 *
 *   TC-162-001  v0.2.0 byte-identical: every field v0.2.0 read, every v0.2.0 airportData value and the v0.2.0
 *               findings (in order) on all 26 fixtures = the recorded v0.2.0 output
 *   TC-162-002  reader thresholds (header / footer band, column split, column edges) hold on all 567 briefing
 *               pages; no briefing WARN on the 26
 *   TC-162-003  documents by content: HSCN, Company + NOTAM, Weather + Hazard, VA on all 26 (field map §1.1)
 *   TC-162-004  positions only: the briefing output is the same when the text of every briefing page is blanked
 *   TC-162-005  reader synthetic: running header / footer removed by shape (not by the release callsign), a row
 *               in the band that is not furniture kept + WARN; left→right column and page continuation joined;
 *               header rows split by a page read whole; no positions → WARN, nothing read
 *   TC-162-010  airport blocks on all 26: NOTAM / WX block counts per package = grammar doc §A.2; roles = §A.4
 *               (two corrections, O-items); ALTN / dest2Altn never a NOTAM block; airports without IATA code;
 *               every role window kept
 *   TC-162-011  airport blocks synthetic: glued role, no IATA, APT glued to RWYS:, wrapped runway line with a
 *               role, role-only line, same role twice; negative: a name-like line without an APT line
 *   TC-162-020  NOTAM items on all 26: every item of the NOTAM Briefing exactly once, under the right airport,
 *               with the right category; the split of notams gives back exactly notamItems; by source
 *               position no item holds a line of another item, a heading or page furniture; line breaks kept
 *   TC-162-021  D64 raw layout on every airport of all 26: notamsRaw = the headings in printed order and every
 *               item once under its heading in printed order; nothing else (no furniture, no other column)
 *   TC-162-022  5c QA F2: a type heading left at the end of an item changes nothing in its shown/hidden result
 *               (NOTAM v1.13.0, every item of the 26, its airport's windows)
 *   TC-162-023  evaluation check: NOTAM v1.13.0 over each airport's notams at each of its windows; per package
 *               the items with a readable window; no item lost or merged (two IDs never one item)
 *   TC-162-024  NOTAM synthetic: heading → category, heading removed from the text; empty-state box → no item,
 *               printed text kept in notamsRaw; weather-only airport → INFO; no NOTAM ruleset → WARN
 *   TC-162-030  weather on all 26: TAF / METAR / ATIS counts per airport = an independent count, totals = the
 *               grammar doc §A.9; reports as printed; NavBlue order METAR → ATIS → TAF; no hazard product
 *   TC-162-031  E-WINS (row 48; D46, D55, SME-17/21/23; D66): the 3 "* PRIO *" airports (L15 PWAK, L20 CYXY,
 *               L22 EPPW) and no other; ewinsWindow '' (fails if a validity window comes back); ewinsRole = the
 *               airport's role codes (EPPW departure); NavBlue's faults NB-F6 / NB-F7 logged, not copied
 *   TC-162-034  D66 in the app: src/airports.html line 297 and the app's extractEtaWindow (harness) read the
 *               E-WINS forecast in the airport's normal window; control: the NB-F6 window would not
 *   TC-162-032  weather synthetic: report split by indent + keyword; wrapped TAF groups kept; empty state;
 *               PRIO positive and negative; weatherRaw (D65) as printed
 *   TC-162-033  D65 weatherRaw on every airport of all 26: the block as printed (independent reading), TAF →
 *               METAR → ATIS, every report once and whole, no "* PRIO *", no furniture, no Hazard text
 *   TC-162-040  card order (SME-1) on 6 packages, and the rule on all 26
 *   TC-162-041  an airportData entry for every airport in either briefing (rows 43–45)
 *   TC-162-050  sections on all 26 = the field map v1.2 §1.1 page ranges; each anchor on its start page
 *   TC-162-060  every v0.3.0 value byte-identical to the PR head before the Exec answers (e96ed88), except
 *               weatherRaw (added, D65) and the D66 E-WINS fields
 *   TC-162-090  fixtures missing → FAIL, never skip (child run)
 *
 * Independent reading (test code only): the expected items, categories, reports and blocks are built here from
 * the fixtures' items/*.items.json with test/lib/fk-briefing.js (the two-column reading the NOTAM v1.13.0
 * battery uses), never from the module. Messages name fixture labels, ICAO codes, NOTAM IDs and counts only;
 * no fixture text is printed. Synthetic packages use made-up identifiers.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { findFixtures, readManifest } = require('../lib/app-path');
const fkb = require('../lib/fk-briefing');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const mod      = require(path.join(RULES, MANIFEST['ofp-flightkeys'].file));
const icaoFpl  = require(path.join(RULES, MANIFEST['icao-fpl'].file));
const acProf   = require(path.join(RULES, MANIFEST['aircraft-profile'].file));
const NR       = require(path.join(RULES, MANIFEST['notam-rules'].file));
const navblue  = require(path.join(RULES, MANIFEST['ofp-navblue'].file));
const OPTS     = { icaoFpl, aircraftProfile: acProf, notamRules: NR };
const BASELINE = require('./data/ofp-flightkeys-v0.2.0-baseline.json');
const LABELS   = require('./data/ofp-flightkeys-expected-v0.2.0.json').fixtures;
const GRAMMAR  = fs.readFileSync(path.join(ROOT, 'docs', 'RPT-OFP-FlightKeys-BriefingGrammar-UPD-20261118-v1.1.md'), 'utf8');
const FIELDMAP = fs.readFileSync(path.join(ROOT, 'docs', 'SPRINT-OFP-FlightKeysMigration-UPD-20261118-v1.2-FieldMap.md'), 'utf8');

const sha   = s => crypto.createHash('sha256').update(s).digest('hex');
const warns = (r, re) => r.findings.filter(f => f.level === 'WARN' && (!re || re.test(f.field)));
const infos = (r, re) => r.findings.filter(f => f.level === 'INFO' && (!re || re.test(f.field)));
const ROLES_LAST = ['IA', 'TA', 'EA'];

// ── the grammar doc's per-package table (§A.2) and the field map's sections (§1.1), parsed from the docs ──
function grammarTable() {
  const out = {};
  for (const l of GRAMMAR.split('\n')) {
    const m = /^\| (L\d\d|T\d) \| ([\d-]+) \| ([\d-]+) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \|/.exec(l);
    if (m && !out[m[1]]) out[m[1]] = { notamDoc: m[2], wxDoc: m[3], aptItems: +m[6], notamBlocks: +m[8], wxBlocks: +m[9] };
  }
  return out;
}
function fieldMapSections() {
  const out = {};
  for (const l of FIELDMAP.split('\n')) {
    const m = /^\| (L\d\d|T\d) \| `[^`]+` \| \d+ \| ([^|]+) \|/.exec(l);
    if (!m || out[m[1]]) continue;
    out[m[1]] = m[2].trim().split(' · ').map(s => {
      const p = /^(\S+) (\d+)(?:–(\d+))?$/.exec(s.trim());
      return { part: p[1], start: +p[2], end: +(p[3] || p[2]) };
    });
  }
  return out;
}

// ── synthetic briefing pages (made-up identifiers; positions as FlightKeys prints them) ──
const W = 841.889, H = 595.275, CW = 4.8, LX = 30.346, RX = 430.031;
// A line: { col: 'L'|'R', y, text } → positioned items (one item per word run, Courier 4.8 pt per character).
function lineItems(col, y, text, h = 8) {
  const x0 = col === 'R' ? RX : LX;
  const items = [];
  const re = /\S+(?: \S+)*/g;
  let m;
  while ((m = re.exec(text)) !== null) items.push({ str: m[0], x: x0 + m.index * CW, y, w: m[0].length * CW, h, font: 'f8' });
  return items;
}
const HDR_TEXT = 'TST0001 / KAAA - KBBB / 2026-11-04 / N000ZZ';
function briefPage(n, N, uuid, cols, o = {}) {
  const items = [];
  if (!o.noHeader) {
    items.push({ str: o.header || HDR_TEXT, x: 28.346, y: 19.877, w: (o.header || HDR_TEXT).length * CW, h: 8, font: 'f6' });
    items.push({ str: '2026-Nov-04 08:17', x: 747.2, y: 19.877, w: 81.6, h: 8, font: 'f6' });
  }
  for (const col of ['L', 'R']) (cols[col] || []).forEach((t, k) => { if (t !== null) items.push(...lineItems(col, 35.034 + k * 9.6, t)); });
  for (const extra of o.extra || []) items.push(extra);
  items.push({ str: `Page ${n} of ${N}`, x: 28.346, y: 579.398, w: 52.8, h: 8, font: 'f6' });
  items.push({ str: uuid, x: 640, y: 579.398, w: 172.8, h: 8, font: 'f6' });
  return { width: W, height: H, items };
}
const UUID = '00000000-0000-4000-8000-000000000001';
const UUID2 = '00000000-0000-4000-8000-000000000002';
// A FlightKeys item (§A.5) as printed.
const fkItem = (loc, id, body = ['RWY 09/27 CLSD.'], dates = '2026-Nov-01 00:00 - 2026-Dec-01 00:00') =>
  [`${loc}        ${id}        ${dates}`, 'CREATED:2026-Oct-31 00:00       FL: SFC - UNL', ...body];
const pad = (n, s) => ' '.repeat(n) + s;
const nameLine = (iata, name, role, win) => pad(18, `${iata ? iata + ' ' : ''}- ${name}`.padEnd(48) + `${role}  ${win}`);
const aptLine = (icao, rwys, role, win) => pad(2, `APT${icao}   RWYS: ${rwys}`.padEnd(54) + (role ? `${role}  ${win}` : ''));
const heading = t => pad(36, t);
// Pages → the parser input: positioned items; the text is irrelevant to the reader (TC-162-004) and is
// written as one line per page so the page count matches.
function synth(pages, o = {}) {
  const input = { text: pages.map((p, i) => `PAGE ${i + 1}`).join('\n\n') + '\n\n', pages: pages.map((p, i) => ({ page: i + 1, width: p.width, height: p.height, items: p.items.map((it, k) => Object.assign({ order: k }, it)) })) };
  if (o.noPages) delete input.pages;
  return mod.parseFlightKeys(input, o.opts || OPTS);
}
const WIN = '04 07:00 - 04 08:15';
function smallBriefing(o = {}) {
  const notam = [
    pad(30, 'COMPANY NOTAMS'), pad(36, 'GENERAL'), ...fkItem('', pad(15, 'A0001/26')).map((l, k) => k === 0 ? pad(15, 'A0001/26        2026-Nov-01 00:00 - UFN') : l),
    'SUBJECT: TEST', 'COMPANY TEXT',
    nameLine('AAA', 'ALPHA INTL', 'DEPARTURE', WIN), aptLine('KAAA', '09/27', 'IA', '04 07:10 - 04 09:00'),
    heading('RUNWAY'), ...fkItem('KAAA AAA', 'A0101/26', ['RWY 09/27 CLSD', 'DUE TO WIP.']),
    heading('TAXIWAY'), ...fkItem('KAAA AAA', 'A0102/26', ['TWY A CLSD.']), ...fkItem('KAAA AAA', 'A0103/26', ['TWY B CLSD.']),
  ];
  const notam2 = [
    nameLine('BBB', 'BRAVO INTL', 'DESTINATION', '04 10:00 - 04 12:00'), aptLine('KBBB', '18/36', '', ''),
    pad(17, 'THERE ARE NO ACTIVE NOTAMS FOR AIRPORT KBBB WITHIN THE GIVEN'), 'NIL', pad(17, 'TIME PERIOD THAT MATCHES THE FILTERING CRITERIA.'),
    pad(18, 'TEST FIR'), pad(2, 'FIRKXXX'), heading('AIRSPACE'), ...fkItem('KXXX', 'A0900/26', ['FIR TEXT.']),
  ];
  const wx = [
    nameLine('AAA', 'ALPHA INTL', 'DEPARTURE', WIN), aptLine('KAAA', '09/27', 'IA', '04 07:10 - 04 09:00'),
    pad(38, 'TAF'), (o.prio ? '* PRIO * ' : '') + 'TAF KAAA 040500Z 0406/0512 27010KT P6SM SCT030', pad(5, 'FM041200 30012KT P6SM BKN040'),
    pad(37, 'METAR'), 'METAR KAAA 040651Z 27010KT 10SM SCT030 12/04 A3000 RMK', pad(5, 'AO2 SLP160'), 'METAR KAAA 040551Z 27009KT 10SM SCT030 11/04 A3001',
    pad(38, 'ATIS'), pad(17, 'THERE ARE NO ACTIVE ATIS FOR AIRPORT KAAA WITHIN THE GIVEN TIME'), 'NIL', pad(17, 'PERIOD.'),
    nameLine('CCC', 'CHARLIE', 'ALTN', '04 10:10 - 04 12:10'), aptLine('KCCC', '01/19', '', ''),
    pad(38, 'TAF'), 'TAF KCCC 040500Z 0406/0512 VRB03KT 9999 FEW020', pad(37, 'METAR'), 'METAR KCCC 040650Z 00000KT 9999 FEW020 10/05 Q1020',
    pad(38, 'ATIS'), 'AD CCC /OS AD0650-  CCC ATIS INFO A 0650Z.', ' AD CONTINUATION TEXT.',
    pad(18, 'TEST FIR'), pad(2, 'FIRKXXX'), pad(37, 'SIGMET'), 'TWC FPG - TURB VALID 0600-1200',
  ];
  return [
    briefPage(1, 1, UUID, { L: [pad(20, 'HIGH SEVERITY COMPANY NOTAMS')] }),
    briefPage(1, 2, UUID2, { L: notam }),
    briefPage(2, 2, UUID2, { L: notam2 }),
    briefPage(1, 1, UUID2, { L: wx }),
  ];
}

// ══ synthetic tests (no fixtures needed) ═════════════════════════════════════

test('TC-162-005 reader synthetic: furniture by shape; continuation joined; split header rows; no positions', () => {
  // POSITIVE: an item continuing from the left to the right column and across a page; the footer and the
  // next running header (another flight number: L22) are removed; the header rows split by the page.
  const item1 = fkItem('KAAA AAA', 'A0101/26', ['LINE ONE', 'LINE TWO']);
  const left = [pad(30, 'COMPANY NOTAMS'), nameLine('AAA', 'ALPHA', 'DEPARTURE', WIN), aptLine('KAAA', '09/27', '', ''), heading('RUNWAY'), ...item1.slice(0, 3)];
  const right = [item1[3], 'KAAA AAA        A0102/26        2026-Nov-01 00:00 - 2026-Dec-01 00:00'];
  const p2 = ['CREATED:2026-Oct-31 00:00       FL: SFC - UNL', 'SECOND ITEM BODY'];
  const pages = [briefPage(1, 2, UUID, { L: left, R: right }), briefPage(2, 2, UUID, { L: p2 }, { header: 'XYZ9999 / KAAA - KBBB / 2026-11-04 / N999ZZ' })];
  const r = synth(pages);
  const a = r.airportData.KAAA;
  assert.ok(a, 'KAAA entry');
  assert.deepEqual(a.notamItems.map(i => i.id), ['A0101/26', 'A0102/26']);
  const parts = NR._splitNotams(a.notams);
  assert.deepEqual(parts.map(p => p.replace(/\n$/, '').split('\n').length), [4, 3], 'item 1 = 4 lines (column continuation joined), item 2 = 3 lines (page continuation joined)');
  assert.ok(!/Page \d+ of|XYZ9999|TST0001/.test(a.notams + a.notamsRaw), 'no footer, no running header (any flight number) in the text');
  assert.deepEqual(a.notamItems[0].source.map(s => [s.page, s.column]), [[1, 'L'], [1, 'R']], 'item 1 spans the two columns');
  assert.deepEqual(a.notamItems[1].source.map(s => [s.page, s.column]), [[1, 'R'], [2, 'L']], 'item 2 spans the page break');
  const h = NR._fkHeader(parts[1]);
  assert.equal(h.created, '2026-Oct-31 00:00', 'header rows split by the page: CREATED: read');
  // these pages hold a NOTAM Briefing only: the missing Weather Briefing is reported, nothing else
  assert.deepEqual(warns(r, /briefing|airportData|notam/).map(f => f.message), ['0 Weather Briefing documents found (1 expected)', 'KAAA: no block in the Weather Briefing']);
  // NEGATIVE / fail-safe: a row in the header band that is not the running header is kept as text + WARN.
  const odd = briefPage(1, 1, UUID, { L: [pad(30, 'COMPANY NOTAMS'), nameLine('AAA', 'ALPHA', 'DEPARTURE', WIN), aptLine('KAAA', '09/27', '', ''), heading('RUNWAY'), ...fkItem('KAAA', 'A0001/26')] },
    { header: 'NOT A RUNNING HEADER' });
  const ro = synth([odd]);
  assert.equal(warns(ro, /^briefing$/).filter(f => /header band is not the running header; kept as text/.test(f.message)).length, 1);
  // NEGATIVE: no positioned items → nothing read from the text, one WARN.
  const rn = synth(pages, { noPages: true });
  assert.equal(Object.values(rn.airportData).every(x => x.notams === '' && x.weather === ''), true);
  assert.equal(warns(rn, /^briefing$/).filter(f => /read from positions only/.test(f.message)).length, 1);
  assert.deepEqual(rn.sections.filter(s => s.id !== 'ofp'), [], 'no briefing sections without positions');
});

test('TC-162-011 airport blocks synthetic: roles anchored to the window; negatives', () => {
  const block = [
    pad(18, 'ANC - ANCHORAGE/TED STEVENS ANCHORAGDEPARTURE  04 07:45 - 04 09:00'),      // glued role (§A.4)
    pad(2, 'APTPANC  RWYS: 07L/25R 07R/25L                        TA  04 08:00 - 04 11:08'),
    pad(18, '15/33'),                                                                  // wrapped runway line
    pad(60, 'IA  04 08:00 - 04 11:08'),                                                // role-only line
    heading('RUNWAY'), ...fkItem('ANC PANC', 'A0001/26'),
    pad(18, '- POWIDZ                          DEPARTURE  10 21:40 - 10 22:55'),      // no IATA code
    pad(2, 'APTEPPWRWYS: 10L/28R'),                                                    // APT glued to RWYS:
    pad(18, '12/30                                    TA  10 22:00 - 11 01:00'),      // runway line + role
    pad(60, 'TA  11 03:00 - 11 04:00'),                                                // the same role twice
    heading('RUNWAY'), ...fkItem('EPPW', 'A0002/26'),
    pad(18, 'XXX - NOT A BLOCK                 IA  04 08:00 - 04 11:08'),             // NEGATIVE: no APT line
    'BODY LINE',
  ];
  const r = synth([briefPage(1, 1, UUID, { L: [pad(30, 'COMPANY NOTAMS'), ...block] })]);
  const b = r.airportData.PANC.briefing;
  assert.equal(b.iata, 'ANC'); assert.equal(b.name, 'ANCHORAGE/TED STEVENS ANCHORAG', 'name as printed (clipped), role not in it');
  assert.deepEqual(b.roles.map(x => `${x.role} ${x.start} - ${x.end}`), ['DEPARTURE 04 07:45 - 04 09:00', 'TA 04 08:00 - 04 11:08', 'IA 04 08:00 - 04 11:08']);
  const e = r.airportData.EPPW.briefing;
  assert.equal(e.iata, '', 'no IATA code'); assert.equal(e.name, 'POWIDZ');
  assert.deepEqual(e.roles.map(x => `${x.role} ${x.start} - ${x.end}`), ['DEPARTURE 10 21:40 - 10 22:55', 'TA 10 22:00 - 11 01:00', 'TA 11 03:00 - 11 04:00'], 'every window kept, the same role twice');
  assert.ok(!('XXX' in r.airportData) && Object.keys(r.airportData).length === 2, 'a name-like line without an APT line is not a block');
  assert.deepEqual(r.airportData.EPPW.notamItems.map(i => i.id), ['A0002/26']);
  assert.ok(NR._splitNotams(r.airportData.EPPW.notams).slice(-1)[0].includes('NOT A BLOCK'), 'that line stays body text of the item above (nothing lost)');
  // the role list is closed and taken at the window: a name ending in a role word is not split on spaces
  const t = mod.PATTERNS.BR_APT_NAME.exec(pad(18, 'IAD - WASHINGTON DULLES INTL TA       ALTN 1  04 10:00 - 04 12:00'));
  assert.deepEqual([t[1], t[2], t[3]], ['IAD', 'WASHINGTON DULLES INTL TA', 'ALTN 1']);
  const g = mod.PATTERNS.BR_APT_NAME.exec(pad(18, 'PSM - PORTSMOUTH INTL AT PEASEdest2AltnPlanned  04 10:00 - 04 12:00'));
  assert.deepEqual([g[2], g[3]], ['PORTSMOUTH INTL AT PEASE', 'dest2AltnPlanned']);
});

test('TC-162-024 NOTAM synthetic: category, empty state, weather-only airport, no NOTAM ruleset', () => {
  const r = synth(smallBriefing());
  const a = r.airportData.KAAA;
  assert.deepEqual(a.notamItems.map(i => `${i.id} ${i.category}`), ['A0101/26 RUNWAY', 'A0102/26 TAXIWAY', 'A0103/26 TAXIWAY']);
  assert.ok(!/RUNWAY\n|TAXIWAY\n/.test(a.notams.replace(/RWY 09\/27 CLSD/, '')) && !a.notams.split('\n').some(l => ['RUNWAY', 'TAXIWAY'].includes(l.trim())), 'headings removed from the item text');
  assert.ok(a.notams.includes('RWY 09/27 CLSD\nDUE TO WIP.'), 'line break inside the item kept (D54)');
  assert.ok(!/COMPANY TEXT|A0001\/26|A0900\/26|FIR TEXT/.test(a.notams), 'no Company or FIR item in the airport NOTAMs');
  assert.deepEqual(a.notamsRaw.split('\n').filter(l => /^\s{21,}\S/.test(l)).map(l => l.trim()), ['RUNWAY', 'TAXIWAY'], 'raw layout keeps the headings');
  const b = r.airportData.KBBB;
  assert.deepEqual([b.notams, b.notamItems.length], ['', 0], 'empty-state box → no item');
  assert.ok(/THERE ARE NO ACTIVE NOTAMS FOR AIRPORT KBBB/.test(b.notamsRaw) && /\nNIL\n/.test(b.notamsRaw), 'raw keeps the printed empty-state text');
  assert.equal(infos(r, /airportData.notams/).filter(f => f.message === 'KBBB: the NOTAM Briefing prints no active NOTAMs').length, 1);
  const c = r.airportData.KCCC;
  assert.deepEqual([c.notams, c.notamsRaw, c.notamItems.length], ['', '', 0], 'weather-only airport (ALTN): no NOTAMs');
  assert.equal(infos(r, /airportData.notams/).filter(f => f.message === 'KCCC: no NOTAM block in the FlightKeys briefing').length, 1);
  assert.equal(c.briefing.notamBlock, false); assert.equal(c.briefing.weatherBlock, true);
  // NEGATIVE: without the NOTAM ruleset the text is read but not cut (one WARN); never cut by the parser itself
  const n = synth(smallBriefing(), { opts: { icaoFpl, aircraftProfile: acProf } });
  assert.equal(n.airportData.KAAA.notams, a.notams, 'same text');
  assert.deepEqual(n.airportData.KAAA.notamItems, []);
  assert.equal(warns(n, /^notamRules$/).length, 1);
});

test('TC-162-032 weather synthetic: indent + keyword; order METAR → ATIS → TAF; PRIO positive and negative', () => {
  const r = synth(smallBriefing());
  const a = r.airportData.KAAA;
  assert.deepEqual(a.weather.split('\n'), ['METAR KAAA 040651Z 27010KT 10SM SCT030 12/04 A3000 RMK', pad(5, 'AO2 SLP160'),
    'METAR KAAA 040551Z 27009KT 10SM SCT030 11/04 A3001', 'TAF KAAA 040500Z 0406/0512 27010KT P6SM SCT030', pad(5, 'FM041200 30012KT P6SM BKN040')],
  'METARs as printed (newest first), then the TAF; the ATIS empty state is no report');
  const c = r.airportData.KCCC.weather.split('\n');
  assert.deepEqual(c.map(l => `${l.length - l.trimStart().length}:${l.trim().split(' ')[0]}`), ['0:METAR', '0:AD', '1:AD', '0:TAF'],
    'METAR, ATIS (its continuation stays indented, also when it starts with "AD"), TAF');
  assert.ok(!/TWC FPG|SIGMET/.test(Object.values(r.airportData).map(x => x.weather).join('\n')), 'hazard products are never airport weather');
  assert.ok(!('ewinsWeather' in a), 'NEGATIVE: a TAF without "* PRIO *" is not E-WINS');
  const p = synth(smallBriefing({ prio: true })).airportData.KAAA;
  assert.equal(p.ewinsWeather, 'TAF KAAA 040500Z 0406/0512 27010KT P6SM SCT030\n' + pad(5, 'FM041200 30012KT P6SM BKN040'), 'E-WINS forecast, prefix not shown');
  assert.equal(p.ewinsWindow, '', 'D66: no window from the validity 0406/0512 (NB-F6 would give 0600Z-1200Z)');
  assert.equal(p.ewinsRole, 'DEPARTURE/IA', 'D66: the airport\'s roles in printed order (NB-F7 would give ALT)');
  assert.ok(!/PRIO/.test(p.weather) && p.weather.includes('TAF KAAA 040500Z'), 'the TAF stays in weather (D46: both kept), prefix not shown');
  // D65: weatherRaw = the block as printed (TAF, METAR, ATIS; sub-headings; empty state), prefix removed only
  const rawLines = [pad(38, 'TAF'), 'TAF KAAA 040500Z 0406/0512 27010KT P6SM SCT030', pad(5, 'FM041200 30012KT P6SM BKN040'),
    pad(37, 'METAR'), 'METAR KAAA 040651Z 27010KT 10SM SCT030 12/04 A3000 RMK', pad(5, 'AO2 SLP160'), 'METAR KAAA 040551Z 27009KT 10SM SCT030 11/04 A3001',
    pad(38, 'ATIS'), pad(17, 'THERE ARE NO ACTIVE ATIS FOR AIRPORT KAAA WITHIN THE GIVEN TIME'), 'NIL', pad(17, 'PERIOD.')];
  assert.equal(p.weatherRaw, rawLines.join('\n'), 'weatherRaw (PRIO): as printed, prefix removed');
  assert.equal(a.weatherRaw, rawLines.join('\n'), 'weatherRaw (no PRIO): the same lines');
  assert.ok(!/SIGMET|TWC FPG|FIRKXXX|CHARLIE/.test(a.weatherRaw), 'NEGATIVE: no Hazard Briefing text, no other airport');
  assert.ok(r.airportData.KCCC.weatherRaw.endsWith(pad(38, 'ATIS') + '\nAD CCC /OS AD0650-  CCC ATIS INFO A 0650Z.\n AD CONTINUATION TEXT.'), 'the last block stops at the FIR block');
  assert.equal(r.airportData.KBBB.weatherRaw, '', 'no weather block → weatherRaw ""');
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

if (!FIXTURES) {
  test('TC-162 fixtures available', () => {
    assert.fail('pilotbrief-fixtures not found (set PB_FIXTURES or clone it beside the repo): TC-162 fixture tests cannot run');
  });
} else {
  const manifest = readManifest(FIXTURES);
  const fk = manifest.fixtures.filter(f => f.format === 'flightkeys');
  const L = fx => LABELS[fx.id].label;
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

  // ── the independent reading (test code; fk-briefing.js two-column reading) ──
  const isName = t => /^\s*(?:[A-Z0-9]{3}\s+)?-\s+.*\d{2} \d{2}:\d{2}\s*-\s*\d{2} \d{2}:\d{2}\s*$/.test(t);
  const oracleCache = new Map();
  function oracle(fx) {
    if (oracleCache.has(fx.id)) return oracleCache.get(fx.id);
    const json = load(fx).items;
    const docs = fkb.documents(json.pages);
    const o = { notam: [], wx: {}, wxBlocks: [], notamBlocks: [], docs };
    for (const d of docs) {
      const ls = fkb.readingOrder(d).filter(l => !l.furniture);
      if (!ls.length) continue;
      const isNotam = ls[0].text.trim() === 'COMPANY NOTAMS';
      const isWx = !isNotam && isName(ls[0].text) && ls.some(l => /^\s{15,}(TAF|METAR|ATIS)$/.test(l.text));
      if (!isNotam && !isWx) continue;
      let apt = null, cat = '', sub = null, inFir = false;
      const at = [];
      ls.forEach((l, i) => {
        const t = l.text;
        const a = /^\s*APT([A-Z0-9]{4})/.exec(t);
        if (a && i > 0 && isName(ls[i - 1].text) && !inFir) { apt = a[1]; cat = ''; sub = null; (isNotam ? o.notamBlocks : o.wxBlocks).push(apt); }
        if (/^\s*FIR[A-Z0-9]{4}\s*$/.test(t) && (apt || inFir)) { inFir = true; apt = null; }
        if (isNotam && fkb.CATEGORIES.includes(t.trim()) && /^\s{21,}/.test(t)) cat = t.trim();
        if (isWx && /^\s{15,}(TAF|METAR|ATIS)$/.test(t)) sub = t.trim();
        at.push({ apt, cat, sub });
        if (isWx && apt && sub) {
          const w = o.wx[apt] || (o.wx[apt] = { TAF: [], METAR: [], ATIS: [] });
          const ind = t.length - t.trimStart().length;
          const kw = { TAF: /^(\* PRIO \* )?TAF\b/, METAR: /^METAR\b/, ATIS: /^AD\s+\S+\s+\/OS\b/ }[sub];
          if (ind <= 2 && kw.test(t.trim())) w[sub].push([t]);
          else if (w[sub].length && !/^\s{15,}(TAF|METAR|ATIS)$/.test(t) && !/THERE ARE NO ACTIVE|^NIL$|^\s+(TIME )?PERIOD\.$/.test(t) && !(i + 1 < ls.length && /^\s*(APT[A-Z0-9]{4}|FIR[A-Z0-9]{4}\s*$)/.test(ls[i + 1].text))) w[sub][w[sub].length - 1].push(t);
        }
      });
      if (!isNotam) continue;
      let k = 0;
      for (const it of fkb.segment(d)) {
        const first = it.text.split('\n')[0];
        while (k < ls.length && !(ls[k].text === first && ls[k].page === it.page)) k++;
        const c = at[k] || {};
        if (c.apt) o.notam.push({ icao: c.apt, id: NR._fkHeader(it.text).id, category: c.cat, text: it.text });
      }
    }
    oracleCache.set(fx.id, o);
    return o;
  }

  test('TC-162-001 v0.2.0 byte-identical: v0.3.0 = the recorded v0.2.0 output on all 26 fixtures', () => {
    assert.equal(fk.length, 26);
    assert.deepEqual(fk.map(f => f.id).sort(), Object.keys(BASELINE.fixtures).sort());
    const NOW_READ = ['airportData.weather', 'airportData.notams', 'sections'];
    let fields = 0, values = 0, findings = 0, orderMoves = [];
    for (const fx of fk) {
      const r = run(fx), b = BASELINE.fixtures[fx.id], lbl = b.label;
      assert.deepEqual(Object.keys(r), b.keys, `${lbl}: top-level keys and order`);
      for (const f of BASELINE.fields) { assert.equal(sha(JSON.stringify(r[f])), b.sha256[f], `${lbl}: ${f} unchanged`); fields++; }
      // every v0.2.0 airport entry: its keys first, in order; every value unchanged except weather / notams,
      // which were the explicit empty '' in v0.2.0 and are read now
      const v2 = Object.keys(b.airportData);
      for (const icao of v2) {
        const e = r.airportData[icao], be = b.airportData[icao];
        assert.ok(e, `${lbl}: ${icao} entry kept`);
        assert.deepEqual(Object.keys(e).slice(0, be.keys.length), be.keys, `${lbl}: ${icao} v0.2.0 keys first, in order`);
        for (const k of be.keys) {
          if (k === 'weather' || k === 'notams') { assert.equal(be.sha256[k], sha(JSON.stringify('')), `${lbl}: ${icao}.${k} was the explicit empty`); continue; }
          assert.equal(sha(JSON.stringify(e[k])), be.sha256[k], `${lbl}: ${icao}.${k} unchanged`); values++;
        }
      }
      // the v0.2.0 entries keep their relative order; the OFP page-1 entries stay first
      const now = Object.keys(r.airportData).filter(k => v2.includes(k));
      assert.deepEqual(now, v2, `${lbl}: v0.2.0 entries in their v0.2.0 order`);
      const moved = Object.keys(r.airportData).slice(0, v2.length).filter((k, i) => k !== v2[i]);
      if (moved.length) orderMoves.push(`${lbl} ${v2.filter(k => !Object.keys(r.airportData).slice(0, v2.length).includes(k)).join(',')}`);
      // the v0.2.0 findings, in order, inside the v0.3.0 findings (the INFOs of the fields read now dropped;
      // the deferred INFOs name the version)
      const norm = f => JSON.stringify(Object.assign({}, f, { message: f.message.replace(/^not read in v0\.[23]\.0:/, 'not read in v0.x:') }));
      const want = b.findings.filter(f => !(f.level === 'INFO' && NOW_READ.includes(f.field) && /^not read in/.test(f.message))).map(norm);
      const got = r.findings.map(norm);
      let j = 0;
      for (const g of got) if (j < want.length && g === want[j]) j++;
      assert.equal(j, want.length, `${lbl}: v0.2.0 findings kept, in order`);
      findings += want.length;
      assert.equal(r.findings.filter(f => NOW_READ.includes(f.field) && /^not read in/.test(f.message)).length, 0, `${lbl}: no "not read" INFO for the fields read now`);
    }
    // The only entry that changes place: L15 PWAK (v0.2.0's remarks-weather entry; an EA airport) now stands
    // with the other IA/TA/EA airports after the briefing alternates (card order, SME-1).
    assert.deepEqual(orderMoves, ['L15 PWAK']);
    console.log(`TC-162-001: ${fields} field values, ${values} airport values and ${findings} findings equal v0.2.0 on 26 fixtures; entry moved: ${orderMoves.join('; ')}`);
  });

  test('TC-162-002 reader thresholds hold on all 567 briefing pages; no briefing WARN on the 26', () => {
    let pages = 0;
    for (const fx of fk) {
      for (const p of load(fx).items.pages) {
        const its = p.items.filter(i => i.str && i.str.trim());
        if (!its.length) continue;
        const foot = its.filter(i => i.y > 571.6).sort((a, b) => a.x - b.x).map(i => i.str).join(' ');
        if (!/^Page\s*\d+\s*of\s*\d+/.test(foot)) continue;
        pages++;
        for (const i of its) {
          if (i.y < 27.5) assert.ok(Math.abs(i.y - 19.877) < 0.01, `${L(fx)} p${p.n}: header band = the running header row`);
          else if (i.y > 571.6) assert.ok(Math.abs(i.y - 579.398) < 0.01, `${L(fx)} p${p.n}: footer band = the footer row`);
          else {
            assert.ok(i.y >= 35.0 && i.y <= 563.9, `${L(fx)} p${p.n}: body row inside 35.0–563.9`);
            assert.ok(i.x < 404.8 || i.x >= 430.0, `${L(fx)} p${p.n}: no item starts in the column gap`);
            assert.ok(i.x >= 30.34, `${L(fx)} p${p.n}: left edge`);
          }
        }
      }
      assert.deepEqual(warns(run(fx), /^(briefing|airportData|airportData\.notams|airportData\.weather|ewins|notamRules)$/), [], `${L(fx)}: no briefing WARN`);
    }
    assert.equal(pages, 567);
  });

  test('TC-162-003 documents by content on all 26: HSCN, Company + NOTAM, Weather + Hazard, VA', () => {
    const fm = fieldMapSections();
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx);
      const s = id => r.sections.find(x => x.id === id);
      const parts = fm[lbl];
      const part = re => parts.find(p => re.test(p.part));
      assert.deepEqual([s('hscn').startPage, s('hscn').endPage], [part(/^HSCN$/).start, part(/^HSCN$/).end], `${lbl}: HSCN`);
      const cn = part(/^(CN\+NOTAM|NOTAM)$/), wx = part(/^WX\+HAZ$/), va = part(/^VA$/);
      assert.deepEqual([s('companyNotams').startPage, s('notamBriefing').endPage], [cn.start, cn.end], `${lbl}: Company + NOTAM document`);
      assert.deepEqual([s('weatherBriefing').startPage, s('hazardBriefing').endPage], [wx.start, wx.end], `${lbl}: Weather + Hazard document`);
      assert.deepEqual([s('va').startPage, s('va').endPage], [va.start, va.end], `${lbl}: VA`);
      const g = grammarTable()[lbl];
      assert.equal(`${s('companyNotams').startPage}-${s('notamBriefing').endPage}`, g.notamDoc, `${lbl}: NOTAM document = grammar doc §A.2`);
      assert.equal(`${s('weatherBriefing').startPage}-${s('hazardBriefing').endPage}`, g.wxDoc, `${lbl}: WX document = grammar doc §A.2`);
    }
  });

  test('TC-162-004 positions only: blanking the text of every briefing page changes no briefing output', () => {
    for (const lbl of ['L02', 'L15', 'L22', 'T1']) {
      const fx = fk.find(f => L(f) === lbl);
      const { text, items, r } = load(fx);
      const pages = text.replace(/\r\n?/g, '\n').split('\n\n');
      const brief = new Set(r.sections.filter(s => ['hscn', 'companyNotams', 'notamBriefing', 'weatherBriefing', 'hazardBriefing', 'va'].includes(s.id))
        .flatMap(s => Array.from({ length: s.endPage - s.startPage + 1 }, (_, k) => s.startPage + k)));
      const blanked = pages.map((p, i) => brief.has(i + 1) ? 'X' : p).join('\n\n');
      const b = mod.parseFlightKeys(mod.inputFromExtractor(blanked, items), OPTS);
      assert.equal(JSON.stringify(b.airportData), JSON.stringify(r.airportData), `${lbl}: airportData from positions only`);
      assert.deepEqual(b.sections.filter(s => brief.has(s.startPage)), r.sections.filter(s => brief.has(s.startPage)), `${lbl}: briefing sections from positions only`);
    }
  });

  test('TC-162-010 airport blocks on all 26: counts per package = grammar doc; roles; windows', () => {
    const g = grammarTable();
    const roleN = {}, roleW = {}, perN = {}, perW = {};
    const noIata = [];
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx), o = oracle(fx);
      const br = Object.entries(r.airportData).filter(([, a]) => a.briefing);
      const nb = br.filter(([, a]) => a.briefing.notamBlock).map(([k]) => k), wb = br.filter(([, a]) => a.briefing.weatherBlock).map(([k]) => k);
      assert.equal(nb.length, g[lbl].notamBlocks, `${lbl}: NOTAM Briefing airport blocks = grammar doc`);
      assert.equal(wb.length, g[lbl].wxBlocks, `${lbl}: Weather Briefing airport blocks = grammar doc`);
      assert.deepEqual(nb.slice().sort(), o.notamBlocks.slice().sort(), `${lbl}: the NOTAM blocks = the independent reading`);
      assert.deepEqual(wb.slice().sort(), o.wxBlocks.slice().sort(), `${lbl}: the WX blocks = the independent reading`);
      for (const [icao, a] of br) {
        const rn = a.briefing.roles.filter(x => x.in.includes('NOTAM')), rw = a.briefing.roles.filter(x => x.in.includes('WX'));
        if (rn.length) perN[rn.length] = (perN[rn.length] || 0) + 1;
        if (rw.length) perW[rw.length] = (perW[rw.length] || 0) + 1;
        for (const x of new Set(rn.map(y => y.role))) roleN[x] = (roleN[x] || 0) + 1;
        for (const x of new Set(rw.map(y => y.role))) roleW[x] = (roleW[x] || 0) + 1;
        for (const x of a.briefing.roles) assert.match(`${x.start} - ${x.end}`, /^\d{2} \d{2}:\d{2} - \d{2} \d{2}:\d{2}$/, `${lbl} ${icao}: window DD HH:MM - DD HH:MM`);
        if (a.briefing.roles.some(x => x.role === 'ALTN' || x.role === 'dest2Altn')) assert.equal(a.briefing.notamBlock, false, `${lbl} ${icao}: ALTN / dest2Altn never has a NOTAM block`);
        if (!a.briefing.iata) noIata.push(`${lbl} ${icao}`);
        // the roles of the airport's block are the same in both briefings
        if (a.briefing.notamBlock && a.briefing.weatherBlock) assert.deepEqual(rn, rw, `${lbl} ${icao}: same roles and windows in both briefings`);
      }
    }
    // §A.4 of grammar v1.1 (O-13 corrected, Exec 18 Nov): T2 ZUCK's third role (TA) is printed on its wrapped runway
    // line, so TA 28 and 9 three-role blocks in each briefing; no block carries the same role twice.
    assert.deepEqual(roleN, { DEPARTURE: 26, DESTINATION: 26, 'ALTN 1': 26, IA: 83, TA: 28, EA: 21, dest2: 10, dest2AltnPlanned: 10 });
    assert.deepEqual(roleW, { DEPARTURE: 26, DESTINATION: 26, 'ALTN 1': 26, ALTN: 101, IA: 122, TA: 28, EA: 21, dest2: 10, dest2AltnPlanned: 10, dest2Altn: 9 });
    assert.deepEqual(perN, { 1: 53, 2: 75, 3: 9 }); assert.deepEqual(perW, { 1: 200, 2: 76, 3: 9 });
    // the same numbers as grammar v1.1 §A.4 prints them
    assert.ok(GRAMMAR.includes('| `TA` | 28 (15) | 28 (15) |') && GRAMMAR.includes('NOTAM: 1 role in 53 blocks, 2 in 75, 3 in 9. WX: 1 in 200, 2 in 76, 3 in 9'), 'grammar v1.1 §A.4');
    // §A.4: no IATA code in 3 blocks of 2 packages: L22 EPPW (NOTAM and WX), L16 RJCJ (WX)
    assert.deepEqual(noIata.sort(), ['L16 RJCJ', 'L22 EPPW']);
    console.log('TC-162-010 roles (NOTAM | WX): ' + JSON.stringify(roleN) + ' | ' + JSON.stringify(roleW));
  });

  // ── part 3: NOTAM items ────────────────────────────────────────────────────
  const AP = acProf;
  const hm = s => { const m = /(\d{2}) (\d{2}):(\d{2})/.exec(s); return { d: +m[1], m: +m[2] * 60 + +m[3] }; };
  // The evaluation time of one role window: its midpoint (minutes of the UTC day); ORIG for DEPARTURE.
  const windowsOf = a => a.briefing.roles.map(x => {
    const s = hm(x.start), e = hm(x.end);
    return { role: x.role === 'DEPARTURE' ? 'ORIG' : 'DEST', eta: (s.m + Math.round(((e.d - s.d) * 1440 + e.m - s.m) / 2) + 1440) % 1440, name: x.role };
  });
  const depOf = r => /^\d{4}$/.test(r.offFromOFP) ? (+r.offFromOFP.slice(0, 2)) * 60 + +r.offFromOFP.slice(2) : null;
  const piecesOf = a => a.notams === '' ? [] : NR._splitNotams(a.notams).map(p => p.replace(/\n$/, ''));
  const shown = (r, fx, text, w) => NR.evalNotams([text], w.role, w.eta, AP.buildAcftProfile(r.acftType), fx.date, depOf(r), AP.getWingspan).issues.some(i => i.notamRaw === text);

  // Rows of one source span, rebuilt from the positioned items (test code): { y, text } (compared without spaces).
  function spanRows(json, s) {
    const p = json.pages.find(x => x.n === s.page);
    const its = p.items.filter(i => i.str && i.str.trim() && (s.column === 'L' ? i.x < p.width / 2 : i.x >= p.width / 2) && i.y >= s.y[0] - 0.5 && i.y <= s.y[1] + 0.5);
    const rows = [];
    for (const it of its.sort((a, b) => a.y - b.y || a.x - b.x)) {
      const r = rows[rows.length - 1];
      if (r && Math.abs(it.y - r.y) <= 2) r.items.push(it); else rows.push({ y: it.y, items: [it] });
    }
    return rows.map(r => ({ y: r.y, text: norm(r.items.sort((a, b) => a.x - b.x).map(i => i.str).join('')) }));
  }
  const norm = t => t.replace(/\s+/g, '');

  test('TC-162-020 NOTAM items on all 26: each once, right airport, right category; split = items; by position', () => {
    const per = [];
    let total = 0, multi = 0, dups = 0;
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx), o = oracle(fx), json = load(fx).items;
      const mine = [];
      const spans = [];
      for (const [icao, a] of Object.entries(r.airportData)) {
        if (!a.notamItems || !a.notamItems.length) continue;
        const pcs = piecesOf(a);
        // the split of the airport's NOTAM text gives back exactly its items (FK-P: the form v1.13.0 splits)
        assert.equal(pcs.length, a.notamItems.length, `${lbl} ${icao}: _splitNotams(notams) = notamItems`);
        assert.equal(NR._splitNotams(a.notams).join(''), a.notams, `${lbl} ${icao}: the pieces are the text (D54)`);
        a.notamItems.forEach((it, k) => {
          const h = NR._fkHeader(pcs[k]);
          assert.ok(h && h.id === it.id, `${lbl} ${icao}: item ${k} ID ${it.id} = its header`);
          assert.equal(NR._splitNotams(pcs[k]).length, 1, `${lbl} ${icao} ${it.id}: one item, one ID (never two)`);
          assert.ok(!pcs[k].split('\n').some(l => mod.PATTERNS.BR_RUNNING_HDR.test(l.trim()) || mod.PATTERNS.BR_FOOTER.test(l.trim())), `${lbl} ${icao} ${it.id}: no page furniture`);
          assert.ok(!pcs[k].split('\n').some(l => /^\s{21,}\S/.test(l) && fkb.CATEGORIES.includes(l.trim())), `${lbl} ${icao} ${it.id}: no type heading in the item`);
          // by source position: the rows inside the item's spans are exactly the item's lines, in order
          const rows = it.source.flatMap(s => {
            assert.ok(s.y[0] > 27.5 && s.y[1] < 571.6, `${lbl} ${icao} ${it.id}: span inside the body band`);
            return spanRows(json, s);
          });
          assert.deepEqual(rows.map(x => x.text), pcs[k].split('\n').map(norm), `${lbl} ${icao} ${it.id}: its source positions hold its lines and nothing else`);
          if (pcs[k].split('\n').length > 3) multi++;
          for (const s of it.source) spans.push({ key: `${icao} ${it.id}`, ...s });
          mine.push({ icao, id: it.id, category: it.category, text: pcs[k] });
        });
      }
      // no two items share a source row
      for (let i = 0; i < spans.length; i++) for (let j = i + 1; j < spans.length; j++) {
        const a = spans[i], b = spans[j];
        if (a.page === b.page && a.column === b.column) assert.ok(a.y[1] < b.y[0] || b.y[1] < a.y[0], `${lbl}: ${a.key} and ${b.key} do not overlap`);
      }
      // every item of the NOTAM Briefing exactly once, under the right airport, with the right category
      const key = x => `${x.icao}|${x.id}|${x.category}`;
      assert.deepEqual(mine.map(key).sort(), o.notam.map(key).sort(), `${lbl}: (airport, ID, category) = the independent reading`);
      assert.deepEqual(mine.map(x => x.text).sort(), o.notam.map(x => x.text).sort(), `${lbl}: item texts = the independent reading (line breaks and indentation kept)`);
      assert.equal(mine.length, grammarTable()[lbl].aptItems, `${lbl}: airport NOTAM items = grammar doc §A.2`);
      const seen = {};
      for (const x of mine) seen[`${x.icao}|${x.id}`] = (seen[`${x.icao}|${x.id}`] || 0) + 1;
      const twice = Object.values(seen).filter(v => v > 1).length;
      dups += twice;
      per.push(`${lbl} ${mine.length}${twice ? ` (${twice} IDs printed twice under one airport)` : ''}`);
      total += mine.length;
    }
    assert.equal(total, 2292);
    // L15 PHNL prints 23 IDs twice under GENERAL (same header row, body wrapped differently): both printed items
    // are kept, never merged by the parser (D43; the NOTAM ruleset's own D43 rule decides at evaluation).
    assert.equal(dups, 23);
    console.log(`TC-162-020: ${total} airport NOTAM items (${multi} with more than 3 lines) = the independent reading; per package: ${per.join(', ')}`);
  });

  test('TC-162-021 D64 raw layout on every airport of all 26: headings and items in printed order, nothing else', () => {
    let airports = 0, headings = 0;
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx), o = oracle(fx);
      for (const [icao, a] of Object.entries(r.airportData)) {
        if (!a.briefing) continue;
        airports++;
        if (!a.briefing.notamBlock) { assert.equal(a.notamsRaw, '', `${lbl} ${icao}: no NOTAM block → no raw layout`); continue; }
        const raw = a.notamsRaw.split('\n');
        const pcs = piecesOf(a).map(p => p.split('\n'));
        // walk the raw layout: a heading, an item (its lines, contiguous), or the empty-state box — nothing else
        let k = 0, at = 0, cat = '';
        const heads = [];
        while (at < raw.length) {
          const l = raw[at];
          if (/^\s{21,}\S/.test(l) && fkb.CATEGORIES.includes(l.trim())) { cat = l.trim(); heads.push(cat); at++; continue; }
          if (/THERE ARE NO ACTIVE NOTAMS FOR AIRPORT/.test(l)) { at += 3; continue; }
          assert.ok(k < pcs.length, `${lbl} ${icao}: raw line ${at} belongs to an item`);
          assert.deepEqual(raw.slice(at, at + pcs[k].length), pcs[k], `${lbl} ${icao}: item ${a.notamItems[k].id} once, whole, in printed order`);
          assert.equal(a.notamItems[k].category, cat, `${lbl} ${icao}: item ${a.notamItems[k].id} under its printed heading`);
          at += pcs[k].length; k++;
        }
        assert.equal(k, pcs.length, `${lbl} ${icao}: every item in the raw layout`);
        assert.ok(!raw.some(l => mod.PATTERNS.BR_RUNNING_HDR.test(l.trim()) || mod.PATTERNS.BR_FOOTER.test(l.trim())), `${lbl} ${icao}: no page furniture`);
        // the headings appear in printed order (the independent reading's category sequence for this airport)
        const want = o.notam.filter(x => x.icao === icao).map(x => x.category).filter((c, i, arr) => c && c !== arr[i - 1]);
        assert.deepEqual(heads.filter((c, i, arr) => c !== arr[i - 1]), want, `${lbl} ${icao}: headings in printed order`);
        assert.ok(new Set(heads).size === heads.length, `${lbl} ${icao}: each heading at most once per block (§A.6)`);
        headings += heads.length;
      }
    }
    console.log(`TC-162-021: raw layout checked on ${airports} briefing airports; ${headings} headings in printed order`);
  });

  test('TC-162-022 5c QA F2: a type heading left at the end of an item — the parser leaves none; effect measured', () => {
    // The parser removes every heading from the item text (TC-162-020). What a heading LEFT at the end of an
    // item would do, through NOTAM v1.13.0 at the airport's windows, for each of the 17 headings:
    const changed = {};
    let evals = 0;
    const hidden = new Set();
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx);
      for (const [icao, a] of Object.entries(r.airportData)) {
        if (!a.notamItems || !a.notamItems.length) continue;
        const ws = windowsOf(a);
        for (const p of piecesOf(a)) for (const w of ws) {
          const base = shown(r, fx, p, w);
          evals++;
          for (const c of fkb.CATEGORIES) {
            const q = p + '\n' + ' '.repeat(36) + c;
            if (shown(r, fx, q, w) !== base) {
              changed[c] = (changed[c] || 0) + 1;
              assert.ok(base, `${lbl} ${icao}: a trailing heading never SHOWS an item that is hidden`);
              hidden.add(`${lbl} ${icao} ${NR._fkHeader(p).id}`);
            }
          }
        }
      }
    }
    // 16 of the 17 headings change nothing. A trailing "OBSTACLE" would HIDE items: NOTAM v1.13.0's obstacle
    // filter (R-OBS) skips a NOTAM that says OBSTACLE without an approach/departure keyword. Reported (O-12); the
    // parser never leaves a heading in an item, so no FlightKeys item reaches the module that way.
    assert.deepEqual(Object.keys(changed), ['OBSTACLE']);
    console.log(`TC-162-022: ${evals} item × window evaluations × 17 headings; changed only by OBSTACLE: ${changed.OBSTACLE} evaluations, ${hidden.size} items would be hidden`);
  });

  test('TC-162-023 evaluation check: NOTAM v1.13.0 over each airport at each window; nothing lost or merged', () => {
    const rows = [];
    let all = 0, readableAll = 0;
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx);
      let n = 0, readable = 0, shownAny = 0, evals = 0;
      for (const [icao, a] of Object.entries(r.airportData)) {
        if (!a.notamItems || !a.notamItems.length) continue;
        const pcs = NR._splitNotams(a.notams);
        const set = new Set(pcs);
        const shownIds = new Set();
        for (const w of windowsOf(a)) {
          const res = NR.evalNotams(pcs, w.role, w.eta, AP.buildAcftProfile(r.acftType), fx.date, depOf(r), AP.getWingspan);
          evals++;
          for (const i of res.issues) {
            if (i.slot === 99) continue;
            assert.ok(set.has(i.notamRaw), `${lbl} ${icao}: every result is one item, unchanged (never merged)`);
            shownIds.add(pcs.indexOf(i.notamRaw));
          }
        }
        pcs.forEach((p, k) => {
          n++;
          if (NR.xNW_standalone(p, fx.date)) readable++;
          if (shownIds.has(k)) shownAny++;
        });
      }
      rows.push(`  ${lbl.padEnd(4)} items ${String(n).padStart(4)}  readable window ${String(readable).padStart(4)}  shown at a window ${String(shownAny).padStart(4)}  (${evals} airport-window evaluations)`);
      assert.equal(readable, n, `${lbl}: every airport NOTAM item has a readable window`);
      all += n; readableAll += readable;
    }
    assert.equal(all, 2292); assert.equal(readableAll, 2292);
    console.log('TC-162-023 per package (NOTAM v1.13.0 at each role window midpoint):\n' + rows.join('\n'));
  });

  // ── part 4: weather and E-WINS ─────────────────────────────────────────────
  // The airport's weather split back into reports: a report starts at indent 0–2 with its keyword (§A.9).
  const reportsOf = w => {
    const out = [];
    for (const l of w ? w.split('\n') : []) {
      const t = l.trim(), ind = l.length - l.trimStart().length;
      const type = ind <= 2 && /^TAF\b/.test(t) ? 'TAF' : ind <= 2 && /^METAR\b/.test(t) ? 'METAR' : ind <= 2 && /^AD\s+\S+\s+\/OS\b/.test(t) ? 'ATIS' : null;
      if (type) out.push({ type, lines: [l] }); else out[out.length - 1].lines.push(l);
    }
    return out;
  };
  const HAZARD = /^\s*(?:TWC FPG|TWC SIGMET|AIRMET|SIGMET|CONVECTIVE SIGMET)\b/m;

  test('TC-162-030 weather on all 26: report counts per airport, totals = grammar doc §A.9; as printed; order; no hazard', () => {
    const tot = { TAF: 0, METAR: 0, ATIS: 0 }, forms = {}, empty = { TAF: 0, METAR: 0, ATIS: 0 };
    let airports = 0;
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx), o = oracle(fx);
      for (const d of o.docs) for (const l of fkb.readingOrder(d)) {
        const m = /^\s*THERE ARE NO ACTIVE (ATIS|METAR|TAF) FOR AIRPORT/.exec(l.text);
        if (m) empty[m[1]]++;
      }
      for (const [icao, a] of Object.entries(r.airportData)) {
        if (!a.briefing || !a.briefing.weatherBlock) { if (a.briefing) assert.equal(a.weather, '', `${lbl} ${icao}`); continue; }
        airports++;
        const reps = reportsOf(a.weather);
        const want = o.wx[icao] || { TAF: [], METAR: [], ATIS: [] };
        for (const t of ['TAF', 'METAR', 'ATIS']) {
          assert.equal(reps.filter(x => x.type === t).length, want[t].length, `${lbl} ${icao}: ${t} reports = the independent count`);
          tot[t] += want[t].length;
        }
        // as printed, in NavBlue's order: METAR (newest first, as printed), ATIS, then TAF; "* PRIO *" not shown
        const strip = ls => ls.map((l, k) => k ? l : l.replace(/^(\s*)\* PRIO \* /, '$1'));
        const expect = [...want.METAR, ...want.ATIS, ...want.TAF].map(strip).map(ls => ls.join('\n')).join('\n');
        assert.equal(a.weather, expect, `${lbl} ${icao}: weather = its reports as printed, METAR → ATIS → TAF`);
        assert.ok(!HAZARD.test(a.weather), `${lbl} ${icao}: no hazard product (TWC FPG, SIGMET, AIRMET) in airport weather (row 48)`);
        assert.ok(!/\* PRIO \*/.test(a.weather), `${lbl} ${icao}: the "* PRIO *" prefix is not shown (SME-21)`);
        for (const x of reps) if (x.type !== 'ATIS') {
          const f = x.lines[0].trim().split(/\s+/).slice(0, 2).join(' ').replace(/ [A-Z]{4}$/, '');
          forms[f] = (forms[f] || 0) + 1;
        }
      }
    }
    // §A.9: TAF 282 = 237 + 37 AMD + 5 COR + 3 PRIO (shown as "TAF IIII"); METAR 1,398 = 1,312 + 83 SPECI + 3 COR;
    // ATIS 38; empty states ATIS 247, METAR 5, TAF 6
    assert.deepEqual(tot, { TAF: 282, METAR: 1398, ATIS: 38 });
    assert.deepEqual(forms, { TAF: 240, 'TAF AMD': 37, 'TAF COR': 5, METAR: 1312, 'METAR SPECI': 83, 'METAR COR': 3 });
    assert.deepEqual(empty, { TAF: 6, METAR: 5, ATIS: 247 });
    assert.equal(airports, 285);
    console.log(`TC-162-030: ${airports} airport weather blocks; reports ${JSON.stringify(tot)}; forms ${JSON.stringify(forms)}; empty states ${JSON.stringify(empty)}`);
  });

  // ── D65: weatherRaw ───────────────────────────────────────────────────────
  // The independent reading of one airport's Weather Briefing block as printed: from its first sub-heading
  // (TAF, always first, §A.9) to the line before the next airport or FIR block (test code, fk-briefing.js).
  function oracleWxRaw(fx) {
    const out = {};
    for (const d of oracle(fx).docs) {
      const ls = fkb.readingOrder(d).filter(l => !l.furniture);
      if (!ls.length || ls[0].text.trim() === 'COMPANY NOTAMS' || !isName(ls[0].text)) continue;
      let cur = null;
      for (let i = 0; i < ls.length; i++) {
        const t = ls[i].text, next = ls[i + 1] ? ls[i + 1].text : '';
        const blockStart = (isName(t) && /^\s*APT[A-Z0-9]{4}/.test(next)) || /^\s*FIR[A-Z0-9]{4}\s*$/.test(next);
        if (blockStart) { cur = null; if (/^\s*APT/.test(next)) cur = out[/^\s*APT([A-Z0-9]{4})/.exec(next)[1]] = { lines: [], started: false }; continue; }
        if (!cur) continue;
        if (!cur.started && /^\s{15,}TAF$/.test(t)) cur.started = true;
        if (cur.started) cur.lines.push(t);
      }
    }
    return out;
  }

  test('TC-162-033 D65 weatherRaw on every airport of all 26: as printed, TAF → METAR → ATIS, every report once', () => {
    let airports = 0, reports = 0, prio = 0;
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx), want = oracleWxRaw(fx);
      for (const [icao, a] of Object.entries(r.airportData)) {
        if (!a.briefing || !a.briefing.weatherBlock) { assert.equal(a.weatherRaw, '', `${lbl} ${icao}: no weather block → ''`); continue; }
        airports++;
        const raw = a.weatherRaw.split('\n');
        // as printed (the independent reading), the "* PRIO *" prefix removed and nothing else changed (D55)
        const exp = want[icao].lines.map(t => t.replace(/^(\s*)\* PRIO \* /, '$1'));
        assert.deepEqual(raw, exp, `${lbl} ${icao}: weatherRaw = the block as printed`);
        prio += want[icao].lines.filter(t => /^\* PRIO \* /.test(t)).length;
        assert.ok(!/\* PRIO \*/.test(a.weatherRaw), `${lbl} ${icao}: no "* PRIO *"`);
        assert.ok(!raw.some(l => mod.PATTERNS.BR_RUNNING_HDR.test(l.trim()) || mod.PATTERNS.BR_FOOTER.test(l.trim())), `${lbl} ${icao}: no page furniture`);
        assert.ok(!HAZARD.test(a.weatherRaw) && !raw.some(l => /^\s*FIR[A-Z0-9]{4}\s*$/.test(l)), `${lbl} ${icao}: no Hazard Briefing text`);
        // the sub-headings TAF, METAR, ATIS once each, in that order
        assert.deepEqual(raw.filter(l => /^\s{21,}(TAF|METAR|ATIS)$/.test(l)).map(l => l.trim()), ['TAF', 'METAR', 'ATIS'], `${lbl} ${icao}: sub-headings`);
        // every report of weather once, whole, in printed order TAF → METAR → ATIS; line breaks kept
        const reps = reportsOf(a.weather);
        const ordered = [...reps.filter(x => x.type === 'TAF'), ...reps.filter(x => x.type === 'METAR'), ...reps.filter(x => x.type === 'ATIS')];
        let at = 0;
        for (const x of ordered) {
          const k = raw.findIndex((l, i) => i >= at && l === x.lines[0]);
          assert.ok(k >= 0, `${lbl} ${icao}: ${x.type} report in weatherRaw, in printed order`);
          assert.deepEqual(raw.slice(k, k + x.lines.length), x.lines, `${lbl} ${icao}: ${x.type} report whole, line breaks kept`);
          assert.equal(raw.filter(l => l === x.lines[0]).length, 1, `${lbl} ${icao}: ${x.type} report once`);
          at = k + x.lines.length;
          reports++;
        }
        // every raw line is a sub-heading, a line of a report, or empty-state text — nothing else
        const inRep = new Set(ordered.flatMap(x => x.lines));
        for (const l of raw) assert.ok(/^\s{21,}(TAF|METAR|ATIS)$/.test(l) || inRep.has(l) || /THERE ARE NO ACTIVE (TAF|METAR|ATIS)|^NIL$|^\s+(TIME )?PERIOD\.$|^\s+.*WITHIN THE GIVEN( TIME)?$/.test(l), `${lbl} ${icao}: raw line is printed weather`);
      }
    }
    assert.equal(airports, 285); assert.equal(reports, 282 + 1398 + 38); assert.equal(prio, 3);
    console.log(`TC-162-033: weatherRaw on ${airports} airports = the blocks as printed; ${reports} reports once each in printed order; "* PRIO *" removed from ${prio}`);
  });

  test('TC-162-031 E-WINS (D66): the 3 "* PRIO *" airports and no other; window \'\', the airport\'s own role; negatives', () => {
    const got = [], nbFaults = [];
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx);
      for (const [icao, a] of Object.entries(r.airportData)) {
        if (!('ewinsWeather' in a)) { assert.ok(!('ewinsRole' in a) && !('ewinsWindow' in a), `${lbl} ${icao}: no E-WINS keys`); continue; }
        got.push(`${lbl} ${icao}`);
        // the forecast = the airport's "* PRIO *" TAF in the Weather Briefing (independent reading), prefix not
        // shown; every TAF of the block stays in weather (D46: both kept for RAW)
        const prio = oracle(fx).wx[icao].TAF.filter(x => /^\* PRIO \* /.test(x[0]));
        assert.equal(prio.length, 1, `${lbl} ${icao}: one PRIO TAF printed`);
        assert.equal(a.ewinsWeather, [prio[0][0].replace(/^\* PRIO \* /, ''), ...prio[0].slice(1)].join('\n'), `${lbl} ${icao}: ewinsWeather = the PRIO TAF`);
        const tafs = reportsOf(a.weather).filter(x => x.type === 'TAF').map(x => x.lines.join('\n'));
        assert.equal(tafs[0], a.ewinsWeather, `${lbl} ${icao}: the PRIO TAF also kept in weather`);
        assert.ok(!/\* PRIO \*/.test(a.ewinsWeather), `${lbl} ${icao}: prefix not shown`);
        // D66: no window from the forecast's validity — a validity window coming back fails here
        assert.equal(a.ewinsWindow, '', `${lbl} ${icao}: ewinsWindow '' (D66)`);
        assert.doesNotMatch(String(a.ewinsWindow), /\d{4}Z/, `${lbl} ${icao}: no validity window`);
        // D66: the airport's actual role = its briefing role codes in printed order, each once, joined by "/"
        assert.equal(a.ewinsRole, [...new Set(a.briefing.roles.map(x => x.role))].join('/'), `${lbl} ${icao}: ewinsRole = its briefing roles`);
        // FK-P does not copy a logged NavBlue fault: the locked NavBlue parser, given the same forecast in its own
        // E-WINS form, still builds the validity window (NB-F6, G-NB-6) and the free-text role (NB-F7, G-NB-7)
        const nbText = ['HEADER', `***FLIGHT RELEASED UNDER E-WINS AUTHORITY FOR TAF (${icao})`, a.briefing.roles.map(x => x.role).join(' '),
          ...a.ewinsWeather.split('\n').map((l, k) => k ? l.trim() : l.replace(/^TAF /, 'WSITAF ')), '', 'END'].join('\n');
        const nb = navblue.parseNavBlue(nbText).airportData[icao];
        assert.match(nb.ewinsWindow, /^\d{4}Z-\d{4}Z$/, `${lbl} ${icao}: NavBlue still builds a window (G-NB-6, NavBlue not changed, D47)`);
        nbFaults.push(`${lbl} ${icao} NavBlue ${nb.ewinsWindow} ${nb.ewinsRole}`);
        assert.equal(infos(r, /^ewins$/).filter(f => f.message.startsWith(`${icao}: "* PRIO *" TAF`)).length, 1);
      }
    }
    // row 48: L15 PWAK (EA), L20 CYXY (TA/IA), L22 EPPW (DEPARTURE/IA); every other TAF is not E-WINS (negative)
    assert.deepEqual(got.sort(), ['L15 PWAK', 'L20 CYXY', 'L22 EPPW']);
    // NEGATIVE: L22's "Released under EWINS Authority" release line names no airport and sets nothing (v0.2.0 finding kept)
    const l22 = run(fk.find(f => L(f) === 'L22'));
    assert.equal(l22.findings.filter(f => f.field === 'ewins' && /names no airport/.test(f.message)).length, 1);
    // SME-23 (L15 PWAK): the Weather Briefing prints the PRIO TAF (0400Z) and, under it, the later TAF AMD (1520Z),
    // which the Remarks also quote (remarksWeather, D34). The E-WINS (PRIO) TAF is controlling: it is ewinsWeather;
    // both briefing TAFs stay in weather for RAW (D46); the Remarks copy stays in remarksWeather.
    const pw = run(fk.find(f => L(f) === 'L15')).airportData.PWAK;
    const pwTafs = reportsOf(pw.weather).filter(x => x.type === 'TAF').map(x => x.lines[0].trim().split(/\s+/).slice(0, 4).join(' '));
    assert.deepEqual(pwTafs, ['TAF PWAK 030400Z 0304/0404', 'TAF AMD PWAK 031520Z'], 'L15 PWAK: both briefing TAFs, as printed');
    assert.ok(pw.ewinsWeather.startsWith('TAF PWAK 030400Z'), 'L15 PWAK: the PRIO TAF is the E-WINS');
    assert.equal(pw.remarksWeather.length, 1, 'L15 PWAK: the Remarks copy stays in remarksWeather');
    // D66 per airport: window '' and the airport's role; L22 EPPW is the departure (origIcao of the release)
    const ew = got.sort().map(k => { const [lbl, icao] = k.split(' '); const a = run(fk.find(f => L(f) === lbl)).airportData[icao]; return [k, a.ewinsWindow, a.ewinsRole]; });
    assert.deepEqual(ew, [['L15 PWAK', '', 'EA'], ['L20 CYXY', '', 'TA/IA'], ['L22 EPPW', '', 'DEPARTURE/IA']]);
    assert.equal(l22.origIcao, 'EPPW', 'L22 EPPW is the departure');
    // the NavBlue faults are logged as open gaps (test/known-gaps.json "navblue-parser"), NavBlue unchanged
    const gaps = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'known-gaps.json'), 'utf8'))['navblue-parser'].gaps;
    assert.deepEqual(gaps.filter(g => g.id === 'G-NB-6' || g.id === 'G-NB-7').map(g => [g.id, g.status, g.lines]), [['G-NB-6', 'open', '1320-1321'], ['G-NB-7', 'open', '1316-1318']]);
    console.log('TC-162-031: ' + ew.map(x => `${x[0]} window '${x[1]}' role ${x[2]}`).join('; ') + ' | NavBlue on the same forecast: ' + nbFaults.join('; '));
  });

  test('TC-162-034 D66 in the app: line 297 + the app\'s TAF window reader give the E-WINS forecast the airport\'s normal window', () => {
    // src/airports.html line 297 (evalAirport): the window for an E-WINS airport
    const line297 = fs.readFileSync(path.join(ROOT, 'src', 'airports.html'), 'utf8').split('\n')[296];
    assert.match(line297, /var effectiveWin = isEwins \? \(_ewRef\.ewinsWindow\s+\|\| wxWindowOverride\) : wxWindowOverride;/, 'line 297 as cited');
    const effectiveWin = (a, override) => a.ewinsWindow || override;      // that expression, for an E-WINS airport
    const app = require('../harness').loadApp();
    let n = 0, differOld = 0;
    for (const [lbl, icao] of [['L15', 'PWAK'], ['L20', 'CYXY'], ['L22', 'EPPW']]) {
      const fx = fk.find(f => L(f) === lbl), r = run(fx), a = r.airportData[icao];
      // the airport's windows: none (ETA ± 60) and each role window as the app's "HHMMZ-HHMMZ"
      const overrides = [null, ...a.briefing.roles.map(x => `${x.start.slice(3).replace(':', '')}Z-${x.end.slice(3).replace(':', '')}Z`)];
      // the NB-F6 window (NavBlue's rule, G-NB-6) for the same forecast, as a control
      const vm = /\d{6}Z\s+(\d{2})(\d{2})\/(\d{2})(\d{2})/.exec(a.ewinsWeather);
      const old = vm[2] + '00Z-' + vm[4] + '00Z';
      for (const ov of overrides) for (let eta = 0; eta < 1440; eta += 30) {
        const iso = fx.date;
        const withEwins = app.extractEtaWindow(a.ewinsWeather, eta, effectiveWin(a, ov), iso);
        const normal = app.extractEtaWindow(a.ewinsWeather, eta, ov, iso);
        assert.equal(withEwins, normal, `${lbl} ${icao} ETA ${eta} window ${ov}: the E-WINS forecast is read in the airport's normal window`);
        if (app.extractEtaWindow(a.ewinsWeather, eta, old, iso) !== normal) differOld++;
        n++;
      }
    }
    // control: the NavBlue-style window (NB-F6) would have changed what is read
    assert.ok(differOld > 0, 'control: a validity window gives other TAF groups');
    console.log(`TC-162-034: ${n} evaluations (3 airports × windows × ETA every 30 min): E-WINS window = normal window; the NB-F6 window would differ in ${differOld}`);
  });

  // ── parts 5–6: airports, card order, sections ──────────────────────────────
  test('TC-162-040 card order (SME-1): 6 packages in full; the rule on all 26', () => {
    // OFP page-1 airports in line order, then briefing airports with a role other than IA/TA/EA (briefing
    // order), then the IA/TA/EA-only airports (briefing order). Lists checked against the PDFs' page 1 and
    // briefing block order.
    const want = {
      L01: 'MKJP KMIA KRSW KFLL KDJT MYNN KMLB',
      L02: 'KORD RKSI RKSS RJAA RJTT RKSO RKJK RKPK RKPC RJGG RJCC PAEI CYOD PASY',
      L09: 'VHHH PANC PAED PAFA PAEI PACD PASY RJCC ZSNB',
      L15: 'PHNL WIHH WIII WIPP WARR WBGG WSAP PGUA PHLI PWAK WAJJ WAPP WAAA',
      L22: 'EPPW KPSM KBOS KBDL KBGR KSWF KJFK EINN BIKF CYYR CYQX EDDH',
      T3:  'KLAX RKSI RJBB RJTT RJGG RKJK RKPC RJSM RJCC KSFO PACD',
    };
    for (const [lbl, order] of Object.entries(want)) assert.equal(Object.keys(run(fk.find(f => L(f) === lbl)).airportData).join(' '), order, `${lbl}: card order`);
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx), keys = Object.keys(r.airportData);
      const p1 = Object.keys(BASELINE.fixtures[fx.id].airportData).filter(k => k !== 'PWAK' || lbl !== 'L15');
      assert.deepEqual(keys.slice(0, p1.length), p1, `${lbl}: the OFP page-1 airports first, in line order`);
      const rest = keys.slice(p1.length);
      const lastOnly = k => r.airportData[k].briefing && r.airportData[k].briefing.roles.every(x => ROLES_LAST.includes(x.role));
      const firstLast = rest.findIndex(lastOnly);
      if (firstLast >= 0) assert.ok(rest.slice(firstLast).every(lastOnly), `${lbl}: IA/TA/EA-only airports last`);
      const wx = oracle(fx).wxBlocks;
      for (const part of [rest.filter(k => !lastOnly(k)), rest.filter(lastOnly)]) {
        const inWx = part.filter(k => wx.includes(k));
        assert.deepEqual(inWx, wx.filter(k => inWx.includes(k)), `${lbl}: briefing order within each group`);
      }
    }
  });

  test('TC-162-041 an airportData entry for every airport in either briefing, incl. alternates (rows 43–45)', () => {
    let n = 0, altn = 0;
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx), o = oracle(fx);
      const all = [...new Set([...o.wxBlocks, ...o.notamBlocks])];
      for (const icao of all) {
        const a = r.airportData[icao];
        assert.ok(a && a.briefing, `${lbl} ${icao}: entry with its briefing record`);
        assert.deepEqual(Object.keys(a).slice(0, 8), ['weather', 'notams', 'remarks', 'remarksWeather', 'specialQualification', 'notamItems', 'notamsRaw', 'briefing'], `${lbl} ${icao}: entry shape`);
        if (a.briefing.roles.some(x => x.role === 'ALTN')) altn++;
        n++;
      }
      // the OFP page-1 airports are all in the briefing (no WARN), and nothing else has an entry
      assert.deepEqual(Object.keys(r.airportData).filter(k => !all.includes(k)), [], `${lbl}: every entry is a briefing airport`);
    }
    assert.equal(n, 285); assert.equal(altn, 101, 'the 101 weather-only ALTN airports have an entry');
  });

  test('TC-162-050 sections on all 26 = field map §1.1 page ranges; each anchor on its start page', () => {
    const fm = fieldMapSections();
    const MAP = { HSCN: ['hscn'], OFP: ['ofp'], VA: ['va'], TLR: ['tlr'], NAT: ['nat'], Jepp: ['charts'] };
    // Field map v1.2 §1.1 carries the measured L16 / L18 pages (O-16, Exec 18 Nov): four and six image-only pages
    // (no items), TLR on PDF 36–38 and 47–50 (the items' own page numbers; checked below by the anchor in the items).
    assert.deepEqual([fm.L16.find(p => p.part === 'TLR'), fm.L18.find(p => p.part === 'TLR')].map(p => `${p.start}-${p.end}`), ['36-38', '47-50'], 'field map v1.2 §1.1');
    for (const fx of fk) {
      const r = run(fx), lbl = L(fx), text = load(fx).text.replace(/\r\n?/g, '\n').split('\n\n');
      const want = [];
      let ofpSeen = false;
      for (const p of fm[lbl]) {
        if (p.part === 'OFP') { if (ofpSeen) continue; ofpSeen = true; }   // bookmarks point to the first copy (ADR-005 §2.6.3)
        if (p.part === 'blank') continue;
        if (MAP[p.part]) want.push(`${MAP[p.part][0]} ${p.start}-${p.end}`);
      }
      const got = r.sections.filter(s => !['companyNotams', 'notamBriefing', 'weatherBriefing', 'hazardBriefing'].includes(s.id)).map(s => `${s.id} ${s.startPage}-${s.endPage}`);
      assert.deepEqual(got, want, `${lbl}: sections = field map §1.1`);
      const s = id => r.sections.find(x => x.id === id);
      assert.equal(s('notamBriefing').startPage, Math.min(...Object.values(r.airportData).flatMap(a => (a.notamItems || []).map(i => i.source[0].page)).concat([s('notamBriefing').startPage])), `${lbl}: NOTAM Briefing starts at its first airport block`);
      assert.ok(s('companyNotams').endPage === s('notamBriefing').startPage && s('weatherBriefing').endPage === s('hazardBriefing').startPage, `${lbl}: the parts of one document meet`);
      for (const x of r.sections) {
        assert.deepEqual(Object.keys(x), ['id', 'title', 'startPage', 'endPage', 'anchor'], `${lbl}: ADR-005 §2.6 section shape`);
        assert.ok(x.title && x.startPage <= x.endPage, `${lbl} ${x.id}`);
        assert.ok(text[x.startPage - 1].replace(/\s+/g, '').includes(x.anchor.replace(/\s+/g, '')), `${lbl} ${x.id}: anchor on its start page (text)`);
        const ip = load(fx).items.pages.find(pg => pg.n === x.startPage);
        assert.ok(ip.items.map(i => i.str).join('').replace(/\s+/g, '').includes(x.anchor.replace(/\s+/g, '')), `${lbl} ${x.id}: anchor on its start page (items)`);
      }
      const order = r.sections.map(x => x.startPage);
      assert.deepEqual(order, order.slice().sort((a, b) => a - b), `${lbl}: page order`);
    }
  });

  // ── D65 / D66: everything else byte-identical to the PR head before the Exec answers (e96ed88) ──
  const HEAD = require('./data/ofp-flightkeys-v0.3.0-e96ed88-baseline.json');
  // The values D65 / D66 change on purpose: airport → keys (weatherRaw is added on every entry).
  const CHANGED_AT_HEAD = { 'L15 PWAK': ['ewinsRole', 'ewinsWindow'], 'L20 CYXY': ['ewinsRole', 'ewinsWindow'], 'L22 EPPW': ['ewinsRole', 'ewinsWindow'] };

  test('TC-162-060 v0.3.0 at e96ed88 byte-identical except weatherRaw (D65, added) and the D66 E-WINS fields', () => {
    assert.deepEqual(fk.map(f => f.id).sort(), Object.keys(HEAD.fixtures).sort());
    let fields = 0, values = 0;
    const changed = [];
    for (const fx of fk) {
      const r = run(fx), b = HEAD.fixtures[fx.id], lbl = b.label;
      assert.deepEqual(Object.keys(r), b.keys, `${lbl}: top-level keys`);
      for (const [k, h] of Object.entries(b.sha256)) { assert.equal(sha(JSON.stringify(r[k])), h, `${lbl}: ${k} unchanged`); fields++; }
      assert.equal(sha(JSON.stringify(r.findings)), b.findings, `${lbl}: findings unchanged`);
      assert.deepEqual(Object.keys(r.airportData), Object.keys(b.airportData), `${lbl}: airport entries and card order unchanged`);
      for (const [icao, be] of Object.entries(b.airportData)) {
        const e = r.airportData[icao];
        assert.deepEqual(Object.keys(e), [...be.keys, 'weatherRaw'], `${lbl} ${icao}: keys = head keys + weatherRaw`);
        for (const k of be.keys) {
          if (sha(JSON.stringify(e[k])) === be.sha256[k]) { values++; continue; }
          changed.push(`${lbl} ${icao}.${k}`);
        }
      }
    }
    assert.deepEqual(changed.sort(), Object.entries(CHANGED_AT_HEAD).flatMap(([a, ks]) => ks.map(k => `${a}.${k}`)).sort(), 'only the intended values changed');
    console.log(`TC-162-060: ${fields} fields, ${values} airport values and the findings equal the head e96ed88; changed: ${changed.join(', ') || 'none'}`);
  });
}

// ── TC-162-090: a missing fixtures repo is a FAILURE (child run) ──
// Registered in the parent run only (the child must not start another child); nothing is skipped.
if (!process.env.TC162_CHILD) test('TC-162-090 fixtures missing → the fixture tests FAIL, never skip', () => {
  // NODE_TEST_CONTEXT would make the child report to this runner instead of printing TAP.
  const env = Object.assign({}, process.env, { PB_FIXTURES: path.join(ROOT, 'no-such-dir'), TC162_CHILD: '1' });
  delete env.NODE_TEST_CONTEXT;
  const out = spawnSync(process.execPath, ['--test', __filename], { env, encoding: 'utf8' });
  assert.notEqual(out.status, 0, 'child run fails');
  assert.match(out.stdout, /pilotbrief-fixtures not found/);
});
