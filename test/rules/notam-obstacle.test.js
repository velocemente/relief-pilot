'use strict';
/**
 * TC-172 — NOTAM ruleset v1.14.0 (ledger P-26): the obstacle rule of Exec decisions D67 / D67a and the
 * FlightKeys type headings. Module rules/notam-rules-next/notam-rules-v1.14.0.js (manifest entry
 * 'notam-rules-next'; not built into index.html, which keeps v1.13.0 until step 5e).
 *
 *   TC-172-001  module standard: version, manifest, exports, validateSchema (a broken pattern set is
 *               rejected), Node / rules-loader / browser give the same API, no DOM; not built into
 *               index.html (the app keeps v1.13.0)
 *   TC-172-002  every declaration of v1.13.0 except the edited ones is byte-identical in v1.14.0
 *   TC-172-010  each effect pattern (item 2): shown, and its pattern is the reason; the same NOTAM
 *               without the height/gradient phrase: hidden — also when it still names the runway or
 *               procedure (E1 is gone); NavBlue and FlightKeys
 *   TC-172-011  each other-content case (item 3): shown by its own content, classified exactly as
 *               v1.13.0 classifies it; without the change: hidden
 *   TC-172-012  group U samples (item 5): shown; without the height / surface: hidden
 *   TC-172-013  stated non-effects and obstacle-light outages are not read as effects (pos. and neg.)
 *   TC-172-014  a NOTAM that is not an obstacle NOTAM is never touched by the rule: v1.14.0 = v1.13.0
 *   TC-172-015  the OBSTACLE heading makes an item an obstacle NOTAM; the 16 other headings never
 *   TC-172-016  D67a O-22 / O-23 / O-24: a height near a runway or procedure with no effect stated,
 *               obstacle-light outages, men and equipment with no height, items under OBSTACLE → hidden;
 *               the same NOTAM with a procedure affected → shown
 *   TC-172-017  D67a O-25: apron / stand, area closed, procedure changed, LVO → shown in a card group with
 *               a row (GENERAL, RWY-<rwy>, SIDs, STARs), ORIG and DEST; a classification with a row kept
 *   TC-172-018  D67a O-26: OCA/H NOT AFFECTED + height near a runway + take-off side unstated → U, shown do
 *   TC-172-020  headings: each of the 17 cut out as a piece of its own, never in an item's text; the
 *               pieces give the text back byte for byte; indent ≥ 15 only; NavBlue text unchanged
 *   TC-172-021  a trailing heading hides nothing (O-12): each of the 17 after an item, unsplit;
 *               v1.13.0 hides it under OBSTACLE (the defect, negative)
 *   TC-172-022  category: the items after a heading carry it (fkCategory) until the next heading;
 *               a heading above row 1 in a piece; NavBlue items carry none
 *   TC-172-030  FlightKeys corpus (26 packages, the parser's notamsRaw from the fixtures' expected/):
 *               the split gives every item with its printed category and every heading as a piece;
 *               no heading in any item's text or issue; with and without headings the same result for
 *               every item except the OBSTACLE-category items of the change list
 *   TC-172-031  FlightKeys corpus: every item not in the change list gives identical v1.13.0 and
 *               v1.14.0 results (no window and each airport window); every B / C entry differs; every
 *               U entry is shown
 *   TC-172-032  NavBlue corpus (30 fixtures, whole text, the TC-171-030 sweep): split unchanged; every
 *               NOTAM not in the change list identical; every B / C entry differs; every U entry shown
 *   TC-172-033  the change list data (v1.1) = the report's counts (B, C, U, G, O-28 a and c); card groups
 *   TC-172-060  O-28 (b): each kind v1.13.0's obstacle filter hid (circling OCA/H, taxiway closure, navaid
 *               outages, beacon, area closed, minimum altitude, procedure affected, obstacle word only in
 *               the weather after the NOTAM) is shown by v1.14.0 — and hidden by v1.13.0
 *   TC-172-061  O-28 (a) on the corpus: every audit NOTAM hidden by v1.13.0, shown by v1.14.0; the beta
 *               exposure entries are change-list NOTAMs v1.14.0 shows
 *   TC-172-040  D61, D43 and the aircraft filter unchanged (v1.14.0 = v1.13.0)
 *   TC-172-050  the gate bites: E1 restored, headings not read, the OBSTACLE heading ignored → caught
 *   TC-172-070  D67b O-29 / F-1: a shown C or U row with no card row → GENERAL on the destination /
 *               alternate card; the departure card unchanged (step 5e); shown-by-both rows untouched
 *   TC-172-071  D67b O-31 / F-7: a surface notice that states minima / procedures unchanged → hidden
 *   TC-172-072  D67b F-5: en-route MEA / MOCA NOTAMs deferred — exactly v1.13.0's result
 *   TC-172-073  D67b F-2: an area closed (also from the ground to a height) → shown, GENERAL
 *   TC-172-074  D67b F-3: only the NOTAM's own text is read (weather, FAA domestic NOTAMs after it)
 *   TC-172-075  D67b F-4: a table's values decide, never its column title
 *   TC-172-090  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Synthetic NOTAMs use airports XXXX / XXX and invented IDs. Fixture tests report counts, package ids,
 * ICAO codes and NOTAM IDs only; no fixture text is printed or asserted.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const vm     = require('vm');
const { findFixtures, readManifest } = require('../lib/app-path');
const { nodeAircraftProfile } = require('../lib/acft');
const ACFT = require('./data/acft-cases');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const FILE     = path.join(RULES, MANIFEST['notam-rules-next'].file);
const SRC      = fs.readFileSync(FILE, 'utf8');
const M        = require(FILE);                                              // v1.14.0
const OLD_FILE = path.join(RULES, MANIFEST['notam-rules'].file);
const OLD_SRC  = fs.readFileSync(OLD_FILE, 'utf8');
const M13      = require(OLD_FILE);                                          // v1.13.0 (built into the app)
const AP       = nodeAircraftProfile();
const CHANGES  = require('./data/notam-v1.14.0-obstacle-changes.json');
const REPORT   = path.join(ROOT, 'docs', 'RPT-NOTAM-ObstacleRule-ChangeList-UPD-20261119-v1.2.md');
const FK_RAW   = path.join('expected', 'notam-rules-v1.14.0', 'fk-notams-raw.json');

const PROF  = AP.buildAcftProfile('B744');
const DATE  = '2026-11-10';
const PAD   = ' '.repeat(36);
const canon = r => JSON.stringify(r, (k, v) => v instanceof Map ? [...v] : v === Infinity ? '$Inf' : k === 'fkCategory' ? undefined : v);
const sha   = s => crypto.createHash('sha256').update(s).digest('hex');
const ev    = (mod, notams, role = 'DEST', eta = null, d = DATE, dep = null, prof = PROF) => mod.evalNotams(notams, role, eta, prof, d, dep, AP.getWingspan);
const shown = (mod, notams, text, ...a) => ev(mod, notams, ...a).issues.some(i => i.notamRaw === text);

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
function requireFkRaw() {
  const f = path.join(requireFixturesDir(), FK_RAW);
  if (!fs.existsSync(f)) throw new Error(`fixtures not found: ${FK_RAW} (fixtures branch claude/notam-v1.14.0 or later)`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

// ── synthetic NOTAMs ─────────────────────────────────────────────────────────
let seq = 0;
const nextId = () => `${'ABCDEFGHJK'[Math.floor(seq / 9000) % 10]}${1000 + (seq++ % 9000)}/26`;   // unique, 4 digits
const NB = body => `- XXXX ${nextId()} 01NOV0000-30NOV2359\n${body}\n`;
const FK = body => `XXXX XXX ${nextId()}   2026-Nov-01 00:00 - 2026-Nov-30 23:59\nCREATED:2026-Oct-31 12:00   FL: SFC - UNL\n${body}\n`;
const BASE = 'TEMP CRANE 2NM N OF ARP.';
// Card rows (E2): the runway groups, GENERAL, TAXIWAYS, SIDs, STARs. The group an issue lands in, or null.
const O25 = ['APRON_STAND', 'CLOSED_TO_TRAFFIC', 'AREA_CLOSED', 'PROCEDURE_CHANGE', 'LOW_VIS_OPS'];
const hasRow = (c, isOrig) => c.category === 'SID' || c.category === 'STAR' ||
  ([3, 6].includes(c.slot) && !!c.label && /^TWY\b/i.test(c.label)) || (isOrig ? [1, 2, 5, 6] : [1, 2, 3, 4]).includes(c.slot);
function cardGroup(res, raw) {
  const it = res.issues.find(i => i.notamRaw === raw);
  if (!it) return undefined;
  if (res.sidIssues.includes(it)) return 'SIDs';
  if (res.starIssues.includes(it)) return 'STARs';
  for (const [k, g] of res.rwyGroups) if (g.items.includes(it)) return k;
  return null;
}

// ══ TC-172-001 module standard ═══════════════════════════════════════════════

test('TC-172-001 v1.14.0: version, manifest, exports, validateSchema, dual context; not built into the app', () => {
  assert.equal(M.RULESET_TYPE, 'notam');
  assert.equal(M.RULESET_VERSION, '1.14.0');
  assert.equal(M.SCHEMA_VERSION, 2);
  const e = MANIFEST['notam-rules-next'];
  assert.equal(e.version, '1.14.0');
  assert.equal(e.file, 'notam-rules-next/notam-rules-v1.14.0.js');
  assert.equal(e.sha256, sha(fs.readFileSync(FILE)));
  // The new exports, and every v1.13.0 export kept in the same order.
  const NEW = ['FK_TYPE_HEADINGS', '_fkTypeHeading', 'OBSTACLE_RULE', '_obstacleRule', '_ownNotamText'];
  assert.deepEqual(Object.keys(M).filter(k => !NEW.includes(k)), Object.keys(M13));
  for (const k of NEW) assert.ok(k in M, `export ${k}`);
  assert.deepEqual([...M.FK_TYPE_HEADINGS], ['RUNWAY', 'TAXIWAY', 'APPROACH AND LANDING', 'AIRPORT', 'OBSTACLE', 'NAVIGATION',
    'COMMUNICATION', 'AIRSPACE', 'WARNING', 'GENERAL', 'RAMP', 'DEPARTURE PROCEDURES', 'ARRIVAL PROCEDURES', 'FACILITIES', 'N/A',
    'HAZARD', 'SERVICE']);
  assert.ok(Object.isFrozen(M.FK_TYPE_HEADINGS) && Object.isFrozen(M.OBSTACLE_RULE));
  // validateSchema: valid; a broken pattern set is rejected with each error.
  assert.deepEqual(M.validateSchema(), { valid: true, errors: [] });
  const broken = { ...M, OBSTACLE_RULE: { ...M.OBSTACLE_RULE, height: 'x', effect: { A: /a/, B: 'b' }, other: null } };
  const r = M.validateSchema(broken);
  assert.equal(r.valid, false);
  assert.ok(r.errors.includes('OBSTACLE_RULE.height is not a RegExp'));
  assert.ok(r.errors.includes('OBSTACLE_RULE.effect.B is not a RegExp'));
  assert.ok(r.errors.includes('OBSTACLE_RULE.other is not an object'));
  // Dual context: rules-loader and the browser give the same API; the browser adds only NotamRules.
  const m = { exports: {} };
  new Function('module', 'exports', 'require', SRC)(m, m.exports, () => { throw new Error('ruleset called require()'); });
  assert.deepEqual(Object.keys(m.exports), Object.keys(M));
  const ctx = vm.createContext({});
  const before = new Set(Object.getOwnPropertyNames(ctx));
  vm.runInContext(SRC, ctx, { filename: 'notam-rules v1.14.0 (browser)' });
  assert.deepEqual(Object.getOwnPropertyNames(ctx).filter(k => !before.has(k)), ['NotamRules']);
  assert.deepEqual(Object.keys(ctx.NotamRules), Object.keys(M));
  const n = NB('RWY 09 CLSD DUE CRANE.');
  const sansMap = r => canon({ ...r, rwyGroups: [...r.rwyGroups.entries()] });   // the browser realm has its own Map
  assert.equal(sansMap(ctx.NotamRules.evalNotams([n], 'DEST', null, PROF, DATE, null, AP.getWingspan)), sansMap(ev(M, [n])));
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const re of [/\bwindow\b/, /\bdocument\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bfetch\s*\(/]) assert.ok(!re.test(code), `no ${re}`);
  // Not built into the app: index.html holds v1.13.0 (byte for byte) and not v1.14.0.
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal(MANIFEST['notam-rules'].version, '1.13.0');
  assert.ok(html.includes(OLD_SRC), 'index.html carries the v1.13.0 module');
  assert.ok(!html.includes("RULESET_VERSION = '1.14.0'") && !html.includes('OBSTACLE_RULE'), 'v1.14.0 is not built into index.html');
});

// ══ TC-172-002 only the edited declarations differ ═══════════════════════════

function declarations(src) {
  const lines = src.split('\n'), out = new Map();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(?:function\s+(\w+)\s*\(|const\s+(\w+)\s*=)/);
    if (!m) continue;
    let j = i;
    const count = c => lines[i].split(c).length - 1;
    if (m[1]) { if (count('{') > count('}')) while (j < lines.length && lines[j] !== '}') j++; }
    else if (!/;\s*$/.test(lines[i])) { while (j < lines.length && !/^[}\)\]]+;\s*$/.test(lines[j])) j++; }
    out.set(m[1] || m[2], lines.slice(i, j + 1).join('\n'));
    i = j;
  }
  return out;
}

test('TC-172-002 every v1.13.0 declaration except the edited ones is unchanged in v1.14.0', () => {
  const a = declarations(OLD_SRC), b = declarations(SRC);
  const EDITED = ['RULESET_VERSION', '_splitNotams', '_splitAt', 'evalNotams', 'validateSchema', 'API'];
  const ADDED = ['FK_TYPE_HEADINGS', '_FK_HEADING_MIN_INDENT', '_fkTypeHeading', '_fkHeadingLines', '_fkHeadingPiece',
    '_OB_SENT', '_OB_US', '_obRe', 'OBSTACLE_RULE', '_obstacleRule', '_OB_CARD_CASES', '_hasCardRow', '_obstacleCardGroup', '_ownNotamText'];
  for (const [name, text] of a) {
    assert.ok(b.has(name), `${name} kept`);
    if (!EDITED.includes(name)) assert.equal(b.get(name), text, `${name} unchanged`);
    else assert.notEqual(b.get(name), text, `${name} edited`);
  }
  assert.deepEqual([...b.keys()].filter(k => !a.has(k)).sort(), ADDED.slice().sort());
  // The v1.13.0 obstacle filter (E1) is gone; its TKOF keywords live on as OBSTACLE_RULE.effect.TKOF_ODP.
  assert.ok(!b.get('evalNotams').includes('hasApchKeyword'));
  assert.equal(String(M.OBSTACLE_RULE.effect.TKOF_ODP), String(/\bTAKEOFF\s+MINIMUMS?\b|\bOBST(?:ACLE)?\s+DEP(?:ARTURE)?\s+PROC|\bODP\b|\bMINIMUM\s+CLIMB\b|\bMIN\s+CLIMB\b|\bCLIMB\s+GRADIENT\b/i));
  assert.ok(a.get('evalNotams').includes(String(M.OBSTACLE_RULE.effect.TKOF_ODP).slice(1, -2)), 'TKOF_ODP = the v1.13.0 TKOF keywords');
  assert.equal(String(M.OBSTACLE_RULE.obstacleWord), String(/\bOBST\b|\bCRANE\b|\bOBSTACLE\b/), 'obstacle words as in v1.13.0');
});

// ══ TC-172-010 effect patterns (item 2) ══════════════════════════════════════

// [pattern, phrase that states the effect, negative: the same NOTAM without the phrase that still names
// the runway / procedure (v1.13.0 showed it by its keyword)]
const EFFECT_CASES = [
  ['MINIMA_CHANGED',     'LOC RWY 27 OCA/H INCREASED DUE TO CRANE.',                   'LOC RWY 27 DUE TO CRANE.'],
  ['MINIMA_CHANGED',     'CHANGE OF CIRCLING MINIMA OCA(OCH) DUE TO CRANE. CAT A 739(750).', 'CIRCLING AREA, DUE TO CRANE.'],
  ['MINIMA_VALUE',       'RNAV (GPS) Y RWY 7L, AMDT 3A... LNAV/VNAV DA 474/HAT 346 ALL CATS.', 'RNAV (GPS) Y RWY 7L, AMDT 3A...'],
  ['MINIMA_VALUE',       'ILS RWY 27 VIS CATS C/D RVR 4500.',                          'ILS RWY 27.'],
  ['NOT_AUTHORISED',     'ILS RWY 23L (SA CAT II), AMDT 8 ... PROC NA.',                'ILS RWY 23L (SA CAT II), AMDT 8 ...'],
  ['NOT_AUTHORISED',     'CIRCLING CAT C/D NOT AUTHORIZED.',                           'CIRCLING CAT C/D.'],
  ['GLIDE_PATH_VGSI',    'PAPI RWY 09 ANGLE 3.5 DEG.',                                 'PAPI RWY 09.'],
  ['GLIDE_PATH_VGSI',    'VGSI RWY 27 NOT COINCIDENT WITH ILS GP.',                    'VGSI RWY 27 AND ILS GP.'],
  ['OBSTACLE_CLEARANCE', 'PAPI RWY 27 DOES NOT PROVIDE OBST CLEARANCE BEYOND 3NM.',     'PAPI RWY 27 BEYOND 3NM.'],
  ['OBSTACLE_CLEARANCE', 'INTERMEDIATE APPROACH MOCA CHANGED FM 530M TO 550M.',        'INTERMEDIATE APPROACH.'],
  ['CLIMB_GRADIENT',     'MISSED APCH RWY 27 REQUIRES 250 FT/NM TO 3000.',              'MISSED APCH RWY 27.'],
  ['CLIMB_GRADIENT',     'SID RWY 28L GRADIENT OF 4.9 PERCENT REQUIRED.',              'SID RWY 28L.'],
  ['CLIMB_GRADIENT',     'DEPARTURE RWY 21 PDG 3.3.',                                  'DEPARTURE RWY 21.'],
  ['TKOF_ODP',           'ODP XXX. TAKEOFF MINIMUMS AND (OBST) DEPARTURE PROCEDURES AMDT 2.', 'XXX RWY 21. DEPARTURE PROCEDURES AMDT 2.'],
  ['TKOF_MINIMA',        'TAKE-OFF MINIMUMS: RWY 31R 300-1.',                          'RWY 31R.'],
  ['PROCEDURE_ALTITUDE', 'SID RWY 27 ABCDE1A CROSS ABCDE AT OR ABOVE 3000FT.',          'SID RWY 27 ABCDE1A.'],
  ['PROCEDURE_ALTITUDE', 'IAC RNP RWY33 CHANGED AS FLW: ADD NEW WAY POINT XX053, ALT:750M.', 'IAC RNP RWY33.'],
  ['PROCEDURE_ALTITUDE', 'ILS RWY 34L MISSED APCH TURN ALT 600FT VICE 500FT.',          'ILS RWY 34L MISSED APCH TURN.'],
  // D67a: a procedure stated affected; a close-in obstacle (the departure)
  ['PROCEDURE_AFFECTED', 'CRANE 1. FLT PROC/TAKE-OFF PATH AREA AFFECTED: RWY35R VOR/DME FINAL APCH.', 'CRANE 1. RWY35R VOR/DME FINAL APCH.'],
  ['PROCEDURE_AFFECTED', 'APPROACH PROCEDURES RWY 09 AFFECTED.',                       'APPROACH PROCEDURES RWY 09.'],
  ['CLOSE_IN_OBSTACLE',  'SIDS RWY 36L ABCDE1A CLOSE-IN OBST BTN PSN 522246N 0044206E.', 'SIDS RWY 36L ABCDE1A BTN PSN 522246N 0044206E.'],
  ['CLOSE_IN_OBSTACLE',  'CTN! CRANE .55NM W OF RWY 09R APCH END INCURS A LOW CLOSE END OBST.', 'CTN! CRANE .55NM W OF RWY 09R APCH END.'],
];

test('TC-172-010 each effect pattern: shown with its reason; without the phrase: hidden (E1 gone); NavBlue and FlightKeys', () => {
  const seen = new Set();
  for (const [pat, phrase, neg] of EFFECT_CASES) {
    seen.add(pat);
    for (const mk of [NB, FK]) {
      const pos = mk(`${phrase} ${BASE}`);
      const d = M._obstacleRule(phrase + ' ' + BASE, null);
      assert.equal(d.obstacle, true, `${pat}: an obstacle NOTAM`);
      assert.equal(d.group, 'EFFECT', `${pat}: ${phrase}`);
      assert.equal(d.pattern, pat, `${phrase}: reason`);
      assert.ok(shown(M, [pos], pos), `${pat}: shown`);
      const n1 = mk(BASE);
      assert.ok(!shown(M, [n1], n1), `${pat}: the obstacle alone is hidden`);
      const n2 = mk(`${neg} ${BASE}`);
      assert.equal(M._obstacleRule(neg + ' ' + BASE).group, 'NONE', `${pat} negative: ${neg}`);
      assert.ok(!shown(M, [n2], n2), `${pat}: without the phrase, hidden although it names the runway / procedure`);
      // v1.13.0 (E1) showed the negative by its keyword whenever it named one.
      if (/\b(?:ILS|LOC|RNAV|PAPI|GP|SID|RWY|APCH|PROC|IAC|RNP)\b/.test(neg) && /\b(?:RWY|ILS|LOC|RNAV|GP|SID|APCH|PROC|RNP)\b/.test(neg)) {
        assert.ok(shown(M13, [n2], n2), `${pat}: v1.13.0 showed "${neg}" (E1)`);
      }
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(M.OBSTACLE_RULE.effect).filter(k => k !== 'TKOF_ODP' || seen.has(k)).sort(), 'every effect pattern tested');
  assert.deepEqual(Object.keys(M.OBSTACLE_RULE.effect), ['MINIMA_CHANGED', 'MINIMA_VALUE', 'NOT_AUTHORISED', 'GLIDE_PATH_VGSI', 'OBSTACLE_CLEARANCE',
    'CLIMB_GRADIENT', 'TKOF_ODP', 'TKOF_MINIMA', 'PROCEDURE_ALTITUDE', 'PROCEDURE_AFFECTED', 'CLOSE_IN_OBSTACLE']);
});

// ══ TC-172-011 other content (item 3) ════════════════════════════════════════

const OTHER_CASES = [
  ['RWY_AVAILABILITY',       'RWY 09 CLSD.'],
  ['RWY_AVAILABILITY',       'RWY 09/27 NOT AVBL.'],
  ['CLOSED_TO_TRAFFIC',      'EAST RAMP NW CORNER CLSD TO ACFT.'],
  ['AREA_CLOSED',            'AN AREA BTN FLW PSN CLSD FM GND UP TO 72M 236FT AMSL.'],
  ['TWY_AVAILABILITY',       'TWY B CLSD.'],
  ['TWY_AVAILABILITY',       'TWY A AND B RESTRICTED.'],
  ['APRON_STAND',            'STAND 12 NOT AVBL.'],
  ['DECLARED_DISTANCES',     'RWY 27 TORA REDUCED TO 2800M.'],
  ['DECLARED_DISTANCES',     'LDA RWY 09 2600M.'],
  ['THRESHOLD',              'THR RWY 27 DISPLACED 300M.'],
  ['THRESHOLD',              'DSPLCD THR RWY 09.'],
  ['NAVAID',                 'VOR ABC U/S.'],
  ['NAVAID',                 'VOR/DME ABC 113.55MHZ CH82Y, THERE MAY BE BEARING FLUCTUATIONS.'],
  ['LIGHTING',               'PAPI RWY 27 U/S.'],
  ['LIGHTING',               'ALS RWY 09 OTS.'],
  ['PROCEDURE_AVAILABILITY', 'RNAV RWY 27 APCH NOT AVBL.'],
  ['PROCEDURE_AVAILABILITY', 'FLW PROCEDURES U/S: IAC RNP W RWY34R(AR).'],
  ['PROCEDURE_CHANGE',       'STAR ABCDE1A AMENDED.'],
  ['PROCEDURE_CHANGE',       'AP VISUAL APCH REGULAR OPR.'],
  ['LOW_VIS_OPS',            'LOW VIS OPS AMD.'],
];

test('TC-172-011 each other-content case: shown by its own content as v1.13.0 classifies it; without the change: hidden', () => {
  const seen = new Set();
  for (const [pat, phrase] of OTHER_CASES) {
    seen.add(pat);
    for (const mk of [NB, FK]) {
      const pos = mk(`${BASE} ${phrase}`);
      const d = M._obstacleRule(`${BASE} ${phrase}`, null);
      assert.equal(d.group, 'OTHER', `${phrase}`);
      assert.equal(d.pattern, pat, `${phrase}: reason`);
      const r = ev(M, [pos]);
      const it = r.issues.find(i => i.notamRaw === pos);
      assert.ok(it, `${pat}: shown`);
      // Classified exactly as v1.13.0 classifies the same text (the classifier is unchanged) — except
      // the four O-25 cases when v1.13.0's classification has no card row (TC-172-017).
      const h = M._fkHeader(pos);
      const ruleRaw = h ? pos.split('\n').filter((_, k) => !h.headerRows.includes(k)).join('\n') : pos;
      const c13 = M13._classifyNotamSlot(ruleRaw.toUpperCase(), ruleRaw, 'DEST', PROF.type, true, AP.getWingspan);
      if (O25.includes(pat) && !hasRow(c13, false)) { assert.ok(cardGroup(r, pos) !== null, `${pat}: a card group with a row`); continue; }
      assert.deepEqual([it.slot, it.level, it.label, it.rwy, it.category], [c13.slot, c13.level, c13.label || null, c13.rwy || null, c13.category || null], `${pat}: classification`);
      // Where v1.13.0 shows it too (it names one of its keywords), the whole result is identical.
      if (shown(M13, [pos], pos)) assert.equal(canon(r), canon(ev(M13, [pos])), `${pat}: = v1.13.0`);
      const neg = mk(BASE);
      assert.ok(!shown(M, [neg], neg), `${pat}: without the change, hidden`);
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(M.OBSTACLE_RULE.other).sort(), 'every other-content pattern tested');
});

// ══ TC-172-012 group U (item 5) ══════════════════════════════════════════════

const U_CASES = [
  ['SURFACE_PENETRATION',     'NEW OBST PENETRATING TRANSITIONAL SFC.',                      'NEW OBST.'],
  ['SURFACE_PENETRATION',     'CRANE INFRINGES INNER HORIZONTAL SFC BY 74FT.',               'CRANE BY 74FT.'],
  ['SURFACE_NAMED',           'CRANE EXIST ABV CONICAL SFC.',                                'CRANE EXIST.'],
  ['SURFACE_NAMED',           'HVY EQPT (OBST) EXIST ABV APCH SFC FOR RWY 16R.',             'HVY EQPT (OBST) EXIST FOR RWY 16R.'],
  ['RUNWAY_STRIP',            'NEW OBST OBSERVED IN THE RWY STRIP.',                         'NEW OBST OBSERVED.'],
  // D67a O-26: the approach side stated not affected, a height near a runway, the take-off side unstated
  ['TAKEOFF_SIDE_UNSTATED',   'CRANE 1950M BEYOND TORA RWY 36L ON EXTD RCL. 155FT AMSL. OCA/H NOT AFFECTED.', 'CRANE 1950M BEYOND TORA RWY 36L ON EXTD RCL. OCA/H NOT AFFECTED.'],
];

test('TC-172-012 group U samples: shown (undecided); without the surface / height: hidden', () => {
  const seen = new Set();
  for (const [pat, phrase, neg] of U_CASES) {
    seen.add(pat);
    for (const mk of [NB, FK]) {
      const d = M._obstacleRule(phrase, null);
      assert.equal(d.group, 'UNDECIDED', phrase);
      assert.equal(d.pattern, pat, `${phrase}: reason`);
      const pos = mk(phrase);
      assert.ok(shown(M, [pos], pos), `${pat}: shown`);
      const n = mk(neg);
      assert.equal(M._obstacleRule(neg, null).group, 'NONE', `${pat} negative: ${neg}`);
      assert.ok(!shown(M, [n], n), `${pat}: hidden without it`);
    }
  }
  assert.deepEqual([...seen].sort(), [...Object.keys(M.OBSTACLE_RULE.undecided), 'TAKEOFF_SIDE_UNSTATED'].sort());
  assert.deepEqual(Object.keys(M.OBSTACLE_RULE.undecided), ['SURFACE_PENETRATION', 'SURFACE_NAMED', 'RUNWAY_STRIP']);
  // A height with no runway or procedure named decides nothing: hidden.
  const far = NB('CRANE 120FT AGL 2NM N OF ARP.');
  assert.ok(!shown(M, [far], far));
});

// ══ TC-172-013 stated non-effects, obstacle lights ═══════════════════════════

test('TC-172-013 a stated non-effect and an obstacle-light outage are not read as effects', () => {
  // "OCA/H NOT AFFECTED" is no effect (hidden) …
  const a = NB('CRANE ERECTED 6600M FM ARP. 158FT AMSL. OCA/H NOT AFFECTED.');
  const da = M._obstacleRule(a);
  assert.deepEqual([da.group, da.noEffectStated], ['NONE', true]);
  assert.ok(!shown(M, [a], a));
  // "… NOT CHANGED" and "PROCEDURES NOT AFFECTED" read without their negation would be an effect
  // (MINIMA_CHANGED) or undecided (PROCEDURE_AREA_AFFECTED): they are set aside, hidden.
  for (const t of ['CRANE ERECTED 6600M FM ARP. OCA/H NOT CHANGED.', 'CRANE 2NM N OF ARP. FLT PROCEDURES NOT AFFECTED.',
                   'CRANE 2NM N OF ARP. NO IMPACT ON PROCEDURES.']) {
    const n = NB(t);
    assert.deepEqual([M._obstacleRule(t).group, M._obstacleRule(t).noEffectStated], ['NONE', true], t);
    assert.ok(!shown(M, [n], n), t);
  }
  // … while "OCA/H INCREASED" is (shown).
  const b = NB('CRANE ERECTED 6600M FM ARP. 158FT AMSL. OCA/H INCREASED TO 270.');
  assert.equal(M._obstacleRule(b).group, 'EFFECT');
  assert.ok(shown(M, [b], b));
  // Near a runway the height still leaves the take-off side undecided: shown, with the note.
  const c = NB('CRANE 1950M BEYOND TORA RWY 36L ON EXTD RCL. 155FT AMSL. OCA/H NOT AFFECTED.');
  const dc = M._obstacleRule(c);
  assert.deepEqual([dc.group, dc.pattern, dc.noEffectStated], ['UNDECIDED', 'TAKEOFF_SIDE_UNSTATED', true]);   // D67a O-26
  // An obstacle light out of service is not a navaid or an aerodrome light out of service (hidden) …
  for (const t of ['AD VORTAC OBST LGT U/S 6,600 FT WEST OF RWY 10 END.', 'OBST LGTS ON RWY 09 GLIDESLOPE U/S.',
                   'RWY 05L LLZ OBST LGTS U/S.', 'OBST TOWER LGT (ASR 1009056) 4.3NM NNE ORD U/S.']) {
    const n = NB(t);
    assert.equal(M._obstacleRule(t).group, 'NONE', t);
    assert.ok(!shown(M, [n], n), t);
  }
  // … the navaid or light itself out of service is (shown).
  for (const t of ['VORTAC ABC U/S DUE OBST.', 'RWY 09 GLIDESLOPE U/S DUE CRANE.', 'RWY 05L LLZ U/S DUE OBST.']) {
    const n = NB(t);
    assert.equal(M._obstacleRule(t).group, 'OTHER', t);
    assert.ok(shown(M, [n], n), t);
  }
});

// ══ TC-172-014 non-obstacle NOTAMs untouched ═════════════════════════════════

test('TC-172-014 a NOTAM that is not an obstacle NOTAM is never touched: v1.14.0 = v1.13.0', () => {
  const texts = [...EFFECT_CASES.map(c => c[1]), ...EFFECT_CASES.map(c => c[2]), ...OTHER_CASES.map(c => c[1]),
    'TWY B CLSD DUE MAINT.', 'BIRD ACTIVITY IN VICINITY OF AD.', 'TOWER 300FT AGL 2NM N OF ARP.', 'WORK IN PROGRESS NEAR RWY 09, MEN AND EQPT.']
    .map(t => t.replace(/\b(?:OBST|OBSTACLE|CRANE)\b/g, 'WORKS'));
  let n = 0;
  for (const t of texts) {
    assert.equal(M._obstacleRule(t, null).obstacle, false, t);
    for (const mk of [NB, FK]) for (const role of ['ORIG', 'DEST']) for (const eta of [null, 600]) {
      const x = mk(t);
      assert.equal(canon(ev(M, [x], role, eta, DATE, 0)), canon(ev(M13, [x], role, eta, DATE, 0)), t);
      n++;
    }
  }
  assert.ok(n >= 200);
});

// ══ TC-172-015 the OBSTACLE heading ══════════════════════════════════════════

test('TC-172-015 the OBSTACLE heading makes an item an obstacle NOTAM; the other 16 headings never', () => {
  const body = 'TOWER 300FT AGL 2NM N OF ARP.';
  for (const h of M.FK_TYPE_HEADINGS) {
    const it = FK(body);
    const text = `${PAD}${h}\n${it}`;
    const r = ev(M, M._splitNotams(text));
    const issue = r.issues.find(i => i.notamRaw === it);
    if (h === 'OBSTACLE') {
      assert.ok(!issue, 'under OBSTACLE: an obstacle NOTAM with no effect → hidden');
      const d = M._obstacleRule(body, h);
      assert.deepEqual([d.obstacle, d.byText, d.byHeading, d.show], [true, false, true, false]);
      // with an effect / other content / undecided it is shown
      for (const extra of ['RWY 09 CLSD.', 'OCA/H INCREASED.', 'PENETRATES THE APCH SFC.']) {
        const it2 = FK(`${body} ${extra}`);
        assert.ok(shown(M, M._splitNotams(`${PAD}OBSTACLE\n${it2}`), it2), extra);
      }
      // D67a O-24: a height near a runway or a procedure, no effect stated → hidden, as O-22
      for (const extra of ['MAX HGT 300FT NEAR THR 09.', 'MAX HGT 300FT NW OF APCH COURSE RWY 09.']) {
        const it2 = FK(`${body} ${extra}`);
        assert.ok(!shown(M, M._splitNotams(`${PAD}OBSTACLE\n${it2}`), it2), extra);
      }
    } else {
      assert.ok(issue, `under ${h}: not an obstacle NOTAM → shown`);
      assert.equal(issue.fkCategory, h);
      assert.equal(M._obstacleRule(body, h).obstacle, false);
    }
  }
});

// ══ TC-172-020 headings are cut out ══════════════════════════════════════════

test('TC-172-020 each of the 17 headings is a piece of its own, never in an item; byte for byte; indent ≥ 15; NavBlue unchanged', () => {
  for (const h of M.FK_TYPE_HEADINGS) {
    const a = FK('RWY 09 CLSD.'), b = FK('TWY A CLSD.');
    const text = `${PAD}${h}\n${a}\n${PAD.slice(7)}${h}\n\n${b}${PAD}${h}`;
    const p = M._splitNotams(text);
    assert.equal(p.join(''), text, `${h}: the pieces give the text back`);
    assert.equal(p.length, 5, `${h}: 3 headings + 2 items`);
    for (const k of [0, 2, 4]) assert.equal(M._fkTypeHeading(p[k].replace(/\n+$/, '')), h, `${h}: heading piece`);
    for (const k of [1, 3]) {
      assert.ok(M._fkHeader(p[k]), 'item piece');
      assert.ok(!p[k].split('\n').some(l => M._fkTypeHeading(l)), `${h}: never in an item's text`);
    }
    const r = ev(M, p);
    for (const i of r.issues) {
      assert.ok(!i.text.includes(h + '<') && !new RegExp(`^${h.replace('/', '\\/')}$`).test(i.rowLabel), `${h}: not in the display`);
      assert.equal(i.fkCategory, h);
    }
  }
  // Indent: 15 spaces or more is a heading, 14 or fewer (and 0) is not.
  assert.equal(M._fkTypeHeading(' '.repeat(15) + 'RUNWAY'), 'RUNWAY');
  assert.equal(M._fkTypeHeading(' '.repeat(14) + 'RUNWAY'), null);
  assert.equal(M._fkTypeHeading('RUNWAY'), null);
  assert.equal(M._fkTypeHeading(PAD + 'RUNWAYS'), null);
  assert.equal(M._fkTypeHeading(PAD + 'runway'), null);
  // A body line that is a heading word at indent 0 stays in its item (as the 6 such corpus lines).
  const it = FK('ACFT ARE REQUESTED NOT TO PENETRATE\nAIRSPACE\nOF THE FIR.');
  const p = M._splitNotams(`${PAD}WARNING\n${it}`);
  assert.equal(p.length, 2);
  assert.equal(p[1], it);
  // NavBlue text has no FlightKeys header: no heading is read, the split is v1.13.0's.
  const nb = `- XXXX A0001/26 01NOV0000-30NOV2359\nRWY 09 CLSD\n${PAD}OBSTACLE\n- XXXX A0002/26 01NOV0000-30NOV2359\nTWY A CLSD\n`;
  assert.deepEqual(M._splitNotams(nb), M13._splitNotams(nb));
  assert.equal(M._splitNotams(nb).length, 2);
});

// ══ TC-172-021 a trailing heading hides nothing (O-12) ═══════════════════════

test('TC-172-021 a heading left at the end of an item hides nothing; v1.13.0 hid it under OBSTACLE', () => {
  const bodies = ['TWY B CLSD.', 'RWY 09 CLSD DUE MAINT.', 'BIRD ACTIVITY.', 'TOWER 300FT AGL 2NM N OF ARP.'];
  for (const body of bodies) for (const h of M.FK_TYPE_HEADINGS) for (const eta of [null, 600]) {
    const it = FK(body).replace(/\n$/, '');
    const q = `${it}\n${PAD}${h}`;
    const alone = ev(M, [it], 'DEST', eta).issues.filter(i => i.notamRaw === it).map(i => [i.slot, i.level, i.label, i.text]);
    const trail = ev(M, [q], 'DEST', eta).issues.filter(i => i.notamRaw === q).map(i => [i.slot, i.level, i.label, i.text]);
    assert.deepEqual(trail, alone, `${body} + ${h}`);
    assert.ok(alone.length === 1, `${body}: shown alone`);
    const after = ev(M, [q, FK('APRON 3 CLSD.')]).issues.find(i => /APRON 3/.test(i.notamRaw));
    assert.equal(after.fkCategory, h, 'the heading is the category of the item after it');
  }
  // The defect it closes: v1.13.0 reads the trailing OBSTACLE as text and hides the item.
  const it = FK('TWY B CLSD.').replace(/\n$/, '');
  assert.ok(shown(M13, [it], it));
  assert.ok(!shown(M13, [`${it}\n${PAD}OBSTACLE`], `${it}\n${PAD}OBSTACLE`), 'v1.13.0: hidden (O-12)');
  assert.ok(shown(M, [`${it}\n${PAD}OBSTACLE`], `${it}\n${PAD}OBSTACLE`), 'v1.14.0: shown');
});

// ══ TC-172-022 category ══════════════════════════════════════════════════════

test('TC-172-022 the items after a heading carry it until the next heading; a heading above row 1; NavBlue none', () => {
  const a = FK('RWY 09 CLSD.'), b = FK('TWY A CLSD.'), c = FK('APRON 3 CLSD.');
  const text = `${PAD}RUNWAY\n${a}${b}${PAD}TAXIWAY\n${c}`;
  const r = ev(M, M._splitNotams(text));
  const cat = x => r.issues.find(i => i.notamRaw === x).fkCategory;
  assert.deepEqual([cat(a), cat(b), cat(c)], ['RUNWAY', 'RUNWAY', 'TAXIWAY']);
  // A piece that starts with its heading (not cut by _splitNotams).
  const q = `${PAD}RAMP\n${c}`;
  const iq = ev(M, [q]).issues.find(i => i.notamRaw === q);
  assert.equal(iq.fkCategory, 'RAMP');
  assert.ok(!/RAMP/.test(iq.text.replace(/APRON 3 CLSD/g, '')));
  // No heading → no fkCategory (the field is absent, as dateUnreadable when false).
  assert.ok(!('fkCategory' in ev(M, [a]).issues[0]));
  const nb = NB('RWY 09 CLSD.');
  assert.ok(!('fkCategory' in ev(M, [nb]).issues[0]));
  // Only heading pieces → nothing to show (the green "reviewed" item).
  assert.equal(ev(M, [`${PAD}RUNWAY\n`]).issues[0].slot, 99);
});

// ══ TC-172-016 D67a O-22 / O-23 / O-24: hidden ═══════════════════════════════

test('TC-172-016 D67a: a height near a runway / procedure, obstacle-light outages, men and equipment, OBSTACLE items → hidden', () => {
  const HIDE = [
    // O-22: a height near a runway, no procedure named (FAA crane NOTAMs among them)
    ['HEIGHT_NEAR_RUNWAY',    'MIA OBST CRANE (ASN UNKNOWN) 254716N0801310W (3.03NM E APCH END RWY 27) 304FT (300FT AGL) FLAGGED AND LGTD.'],
    ['HEIGHT_NEAR_RUNWAY',    'MOBILE CRANE APRX 1040FT BFR THR 10 AND 2490FT SOUTH EXTENDED RCL. 120FT AGL 317FT AMSL.'],
    ['HEIGHT_NEAR_RUNWAY',    'CRANE ERECTED 510M BEYOND THR 04 AND 330M RIGHT OF RCL, 138FT AMSL, MARKED AND LGTD.'],
    // O-22: a height near a procedure with no effect stated
    ['HEIGHT_NEAR_PROCEDURE', 'CRANE ERECTED NW OF APCH COURSE RWY 05, MAX HEIGHT OF (9843FT/30M).'],
    // O-23: obstacle-light outages; men and equipment near a runway with no height
    [null,                    'OBST LGTS ON HANGAR 12 2,095 FT NORTH OF RWY 06 CL AT N 61.26 W 149.81 U/S.'],
    [null,                    'AD VORTAC OBST LGT U/S 6,600 FT WEST OF RWY 10 END.'],
    [null,                    'OBST MEN/EQPT OPR 280FT SOUTH OF RWY 06/24 CL ON RWY 16/34.'],
    [null,                    'OBST MEN AND EQUIPMENT OPERATING 280FT FROM RWY 06/24 CENTERLINE ON TWY R AND ELBOW.'],
  ];
  for (const [pat, t] of HIDE) for (const mk of [NB, FK]) {
    const d = M._obstacleRule(t);
    assert.deepEqual([d.group, d.pattern, d.show], ['NONE', pat, false], t);
    const x = mk(t);
    assert.ok(!shown(M, [x], x), `hidden: ${t}`);
    // the positive: the same NOTAM with a procedure affected is shown
    const y = mk(`${t} RNAV RWY 27 LNAV MDA 580/HAT 452.`);
    assert.ok(shown(M, [y], y), `shown with a procedure affected: ${t}`);
  }
  // O-24: a FlightKeys item under OBSTACLE with no obstacle word takes the same test
  for (const [body, want] of [['TOWER 120FT AGL 1040FT BFR THR 10.', false], ['TOWER 120FT AGL NW OF APCH COURSE RWY 05.', false],
                              ['TOWER 120FT AGL BFR THR 10. LOC RWY 10 OCA/H INCREASED TO 560.', true], ['TOWER BFR THR 10. TWY B CLSD.', true]]) {
    const it = FK(body);
    assert.equal(shown(M, M._splitNotams(`${PAD}OBSTACLE\n${it}`), it), want, body);
    assert.equal(shown(M, M._splitNotams(`${PAD}AIRPORT\n${it}`), it), true, `${body}: not an obstacle NOTAM under AIRPORT`);
  }
});

// ══ TC-172-017 D67a O-25: the four cases in their card group ══════════════════

test('TC-172-017 D67a O-25: apron / stand, area closed, procedure changed, LVO → shown in a card group with a row', () => {
  const CASES = [
    // [text, role, group, label]
    [`${BASE} STAND 12 NOT AVBL.`,                       'DEST', 'GENERAL', 'APRON/STAND NOT AVBL'],
    [`${BASE} STAND 12 NOT AVBL.`,                       'ORIG', 'GENERAL', 'APRON/STAND NOT AVBL'],
    [`${BASE} APRON 3 CLSD.`,                            'DEST', 'GENERAL', 'APRON/STAND CLSD'],
    ['OBST CTN: EAST RAMP NW CORNER CLSD TO ACFT.',      'DEST', 'GENERAL', 'AREA CLSD TO ACFT'],
    ['OBST CTN: EAST RAMP NW CORNER CLSD TO ACFT.',      'ORIG', 'GENERAL', 'AREA CLSD TO ACFT'],
    [`${BASE} SID ABCDE1A AMENDED.`,                     'ORIG', 'SIDs',    'ABCDE1A CHANGE'],
    [`${BASE} SID ABCDE1A AMENDED.`,                     'DEST', 'GENERAL', 'SID ABCDE1A CHANGE'],
    [`${BASE} STAR ABCDE1A AMENDED.`,                    'ORIG', 'GENERAL', 'STAR ABCDE1A CHANGE'],
    ['DUE CRANE AP VISUAL APCH RWY 27 REGULAR OPR.',     'DEST', 'RWY-27',  'APCH PROC CHANGE RWY 27'],
    ['DUE CRANE AP VISUAL APCH RWY 27 REGULAR OPR.',     'ORIG', 'RWY-27',  'APCH PROC CHANGE RWY 27'],
    ['DUE CRANE AP VISUAL APCH REGULAR OPR.',            'DEST', 'GENERAL', 'APCH PROC CHANGE'],
    ['DUE CRANE LOW VIS OPS AMD.',                       'DEST', 'GENERAL', 'LVO CHANGED'],
    ['DUE CRANE LOW VIS OPS RWY 09 AMD.',                'ORIG', 'RWY-09',  'LVO CHANGED RWY 09'],
  ];
  for (const [t, role, group, label] of CASES) for (const mk of [NB, FK]) {
    const x = mk(t);
    assert.ok(O25.includes(M._obstacleRule(t).pattern), `${t}: an O-25 case`);
    const r = ev(M, [x], role);
    assert.equal(cardGroup(r, x), group, `${t} (${role}): card group`);
    assert.equal(r.issues.find(i => i.notamRaw === x).label, label, `${t} (${role}): label`);
  }
  // A classification that already has a row is kept: a STAR amended at an arrival airport (v1.13.0's STAR row).
  const s = NB(`${BASE} STAR ABCDE1A CHANGED.`);
  const r = ev(M, [s], 'DEST');
  assert.equal(M._obstacleRule(s).pattern, 'PROCEDURE_CHANGE');
  assert.equal(cardGroup(r, s), 'STARs');
  const c13 = M13._classifyNotamSlot(s.toUpperCase(), s, 'DEST', PROF.type, true, AP.getWingspan);
  assert.equal(c13.category, 'STAR', 'v1.13.0 classifies it as a STAR');
  assert.equal(r.issues[0].label, c13.label, 'the classifier\'s own STAR row is kept');
  // Not an obstacle NOTAM → the classifier alone, as v1.13.0 (no group set).
  const n = NB('STAND 12 NOT AVBL.');
  assert.equal(canon(ev(M, [n], 'DEST')), canon(ev(M13, [n], 'DEST')));
});

// ══ TC-172-018 D67a O-26 ══════════════════════════════════════════════════════

test('TC-172-018 D67a O-26: OCA/H NOT AFFECTED + a height near a runway + the take-off side unstated → U, shown', () => {
  const pos = 'CRANE ERECTED BTN PSN 522246N 0044206E 1950M BEYOND TORA RWY 36L AND 340M LEFT OF EXTD RCL. 155FT AMSL, MARKED AND LGTD. OCA/H NOT AFFECTED.';
  for (const mk of [NB, FK]) {
    const x = mk(pos);
    assert.deepEqual([M._obstacleRule(pos).group, M._obstacleRule(pos).pattern], ['UNDECIDED', 'TAKEOFF_SIDE_UNSTATED']);
    assert.ok(shown(M, [x], x));
  }
  // negatives: the take-off side stated too, all procedures stated, no height, no runway → hidden
  for (const t of [pos.replace('OCA/H NOT AFFECTED', 'OCA/H AND TKOF NOT AFFECTED'), pos.replace('OCA/H NOT AFFECTED', 'OCA/H NOT AFFECTED. SID NOT AFFECTED'),
                   pos.replace('OCA/H NOT AFFECTED', 'PROCEDURES NOT AFFECTED'), pos.replace(' 155FT AMSL,', ''),
                   'CRANE ERECTED AT PSN 521628N 0044104E 6600M FM ARP. 158FT AMSL. OCA/H NOT AFFECTED.']) {
    const x = NB(t);
    assert.equal(M._obstacleRule(t).show, false, t);
    assert.ok(!shown(M, [x], x), t);
  }
});

// ══ TC-172-060 O-28 (b): each kind v1.13.0 hid is shown — fails on v1.13.0 ═════

test('TC-172-060 O-28: each kind of NOTAM v1.13.0\'s obstacle filter hid is shown by v1.14.0 (and hidden by v1.13.0)', () => {
  const KINDS = [
    ['circling OCA/H increased',      'MINIMA_CHANGED',     'CHANGE OF CIRCLING MINIMA OCA(OCH) DUE TO CRANE. CAT A AND B INCREASED TO 916(927).'],
    ['taxiway closure',               'TWY_AVAILABILITY',   'TWY B CLSD DUE CRANE OPS.'],
    ['navaid outage (TACAN)',         'NAVAID',             'XXX NAV TACAN U/S DUE OBST.'],
    ['navaid unusable (VORTAC)',      'NAVAID',             'V38 ABC VORTAC R-285 UNUSABLE BLW 12500 DUE OBST.'],
    ['aerodrome beacon outage',       'LIGHTING',           'ABN U/S DUE CRANE.'],
    ['area closed to aircraft',       'CLOSED_TO_TRAFFIC',  'OBST CTN: EAST RAMP NW CORNER CLSD TO ACFT DUE TO CONST.'],
    ['minimum altitude changed',      'MINIMA_CHANGED',     'DUE TO OBST, ATC SURVEILLANCE MINIMUM ALT CHART, SECTOR 15 ALT LIMIT CHANGED TO 600M.'],
    ['area closed from the ground',   'AREA_CLOSED',        'CRANE ERECTED WI XXXX CTR. AN AREA BTN FLW PSN CLSD FM GND UP TO 74.50M 245FT AMSL.'],
  ];
  for (const [kind, pat, t] of KINDS) for (const mk of [NB, FK]) {
    const x = mk(t);
    assert.equal(M._obstacleRule(t).pattern, pat, kind);
    assert.ok(shown(M, [x], x), `${kind}: shown by v1.14.0`);
    assert.ok(!shown(M13, [x], x), `${kind}: hidden by v1.13.0 (the defect)`);
  }
  // NavBlue whole text: the obstacle word only in the text after the NOTAM (the weather) — the NOTAM
  // is no obstacle NOTAM; v1.13.0 hid it, v1.14.0 shows it by its content.
  const tw = '- XXXX E2929/26 30APR1258-22MAY1430\nTWY B CLSD DUE MAINT.\nOTHER\nMETAR XXXX 061730Z 02020KT 9999 SCT038 04/M06 Q1022\n- NO OPERATIONAL NOTAMS ON FILE FOR XXXX OBST\n';
  const nv = '- XXXX A3994/25 17JUN1409-PERM\nXXX NAV TACAN U/S\nOTHER\nMETAR XXXX 081554Z AUTO 26007KT 10SM CLR 09/03 A3002 RMK AO2 OBST\n';
  for (const x of [tw, nv]) {
    assert.ok(!shown(M13, [x], x), 'v1.13.0 hid it');
    assert.ok(shown(M, [x], x), 'v1.14.0 shows it');
  }
});

// ══ TC-172-070 … 075 D67b ═════════════════════════════════════════════════════
// Each has a case the D67a head (dcf8378) gets wrong.

test('TC-172-070 D67b O-29 / F-1: a shown C or U row with no card row → GENERAL on the destination card', () => {
  // C: v1.13.0's E1 hid it (an obstacle word, none of E1's keywords); v1.14.0 shows it
  const CASES = [
    ['- XXXX A3994/25 17JUN1409-PERM\nXXX NAV TACAN U/S\nOTHER\nMETAR XXXX 081554Z AUTO 26007KT 10SM CLR 09/03 A3002 RMK AO2 OBST\n', 'C: TACAN U/S, obstacle word only in the weather after it'],
    ['- XXXX J5859/25 19DEC0517-18MAR0800 2026 EST\nABN U/S\nOTHER\nNO METAR REPORTS FOUND FOR XXXX OBST\n', 'C: aerodrome beacon U/S'],
    [NB('XXX VORTAC R-285 UNUSABLE BLW 12500 DUE OBST.'), 'C: VORTAC radial unusable'],
    [NB('CRANE INFRINGES INNER HORIZONTAL SFC BY 74FT.'), 'U: inner horizontal surface infringed'],
    [NB('NEW OBST PENETRATING TRANSITIONAL SFC, MAX ELEV 40.9M AGL.'), 'U: surface penetrated'],
  ];
  for (const [x, what] of CASES) {
    const r = ev(M, [x], 'DEST');
    assert.equal(cardGroup(r, x), 'GENERAL', `${what}: GENERAL on the destination card`);
    const c13 = M13._classifyNotamSlot(x.toUpperCase(), x, 'DEST', PROF.type, true, AP.getWingspan);
    assert.ok(!hasRow(c13, false), `${what}: v1.13.0's classification has no row (the defect)`);
    // the departure card is step 5e: unchanged here
    const o = ev(M, [x], 'ORIG');
    assert.equal(cardGroup(o, x), null, `${what}: no departure-card row yet (5e)`);
  }
  // a NOTAM shown by both versions (an E1 keyword) keeps v1.13.0's result: not moved
  const both = NB('ODP XXX. TAKEOFF MINIMUMS AND (OBST) DEPARTURE PROCEDURES AMDT 2.');
  assert.equal(canon(ev(M, [both], 'DEST')), canon(ev(M13, [both], 'DEST')));
});

test('TC-172-071 D67b O-31 / F-7: a surface notice that states minima / procedures unchanged → hidden', () => {
  const STATED = [
    'CRANE EXIST ABV CONICAL SFC 1.PSN : BOUNDED BY FLW POINT 3.RMK : (1)WX MNM,INST APCH PROC,SID,STAR NO CHANGE (2)OBST DAY MARKING INSTL FM SFC TO 221FT AMSL',
    'HVY EQPT (OBST) EXIST ABV APCH SFC FOR RWY 16R. RMK: WX MNM, INST APCH PROC, SID, STAR NO CHANGE.',
    'NEW OBST PENETRATING TRANSITIONAL SFC. MINIMA NOT AFFECTED.',
  ];
  for (const t of STATED) for (const mk of [NB, FK]) {
    const x = mk(t);
    assert.ok(!shown(M, [x], x), `hidden: ${t}`);
    assert.deepEqual([M._obstacleRule(t).pattern, M._obstacleRule(t).show], ['STATED_UNCHANGED', false], t);
    // without the statement: undecided, shown (U)
    const y = mk(t.replace(/(?:RMK ?: ?)?\(1\)WX MNM,INST APCH PROC,SID,STAR NO CHANGE|RMK: WX MNM, INST APCH PROC, SID, STAR NO CHANGE\.|MINIMA NOT AFFECTED\./, ''));
    assert.ok(shown(M, [y], y), `shown without the statement: ${t}`);
  }
});

test('TC-172-072 D67b F-5: en-route MEA / MOCA NOTAMs are deferred — exactly v1.13.0', () => {
  const EN = [
    'RTE ZOB SPECIAL NY RTE ZK487 RLANE WAYPOINT TO CIPSI WAYPOINT MEA 4700FT. REASON: NEW CONTROLLING OBST: WINDMILL 595FT AGL/2614FT MSL.',
    'OH..RTE ZID. V144 APPLETON (APE) VORTAC, OH R-300 TO BUZZI, OH MOCA 2800. TEMPO CRANE 1771 MSL 5.9NM SW OF APPLETON (APE) VORTAC.',
    // D67a would decide these differently from v1.13.0: the deferral keeps v1.13.0's result
    'RTE ZXX V38 MOCA RAISED TO 3000 DUE TO OBST.',                                          // D67a: shown (obstacle clearance); v1.13.0: hidden
    'V144 ABC VORTAC R-300 TO XYZ MOCA 2800. TEMPO CRANE 1771 MSL 2NM SW OF RWY 09 THR.',     // D67a: hidden (height near runway); v1.13.0: shown (RWY)
  ];
  for (const t of EN) for (const mk of [NB, FK]) {
    const x = mk(t);
    for (const role of ['ORIG', 'DEST']) assert.equal(canon(ev(M, [x], role)), canon(ev(M13, [x], role)), `${t} (${role}): = v1.13.0`);
    assert.equal(M._obstacleRule(t).group, 'DEFERRED', t);
  }
  // "OBSTACLES" (plural) is no obstacle word: shown by both, untouched (KZOB A0409/26)
  const pl = NB('RTE ZOB RLANE WAYPOINT TO NERGE WAYPOINT MEA 4700FT. REASON: NEW CONTROLLING OBSTACLES: WINDMILLS.');
  assert.equal(M._obstacleRule(pl).obstacle, false);
  assert.ok(shown(M, [pl], pl) && shown(M13, [pl], pl));
  // a NOTAM ID is never read as an airway (A1023/26 … MOCA): an approach MOCA stays an effect
  const ap = NB('INTERMEDIATE APPROACH MOCA CHANGED FM 530M TO 550M DUE TO OBST.');
  assert.equal(M._obstacleRule(ap).group, 'EFFECT');
});

test('TC-172-073 D67b F-2: an area closed — also from the ground to a height around an obstacle → shown, GENERAL', () => {
  for (const t of ['CRANE ERECTED WI XXXX CTR. AN AREA BTN FLW PSN CLSD FM GND UP TO 74.50M 245FT AMSL: 320152N0345416E 320150N0345416E. LIT AND DAY MARKED.',
                   'OBST: CRANE. AIRSPACE WI 200M RADIUS CLSD SFC TO 300FT AGL.']) {
    for (const role of ['DEST', 'ORIG']) {
      const x = NB(t);
      const r = ev(M, [x], role);
      assert.equal(cardGroup(r, x), 'GENERAL', `${t} (${role})`);
      assert.equal(M._obstacleRule(t).pattern, 'AREA_CLOSED', t);
      assert.equal(r.issues.find(i => i.notamRaw === x).label, 'AREA CLSD');
    }
  }
  // FlightKeys under OBSTACLE with no obstacle word (LLBG A0720/26)
  const it = FK('DRILLING TOWER ERECTED WI XXXX CTR. AN AREA BTN FLW PSN CLSD FM GND UP TO 72M 236FT AMSL. LIT AND DAY MARKED.');
  const r = ev(M, M._splitNotams(`${PAD}OBSTACLE\n${it}`), 'DEST');
  assert.equal(cardGroup(r, it), 'GENERAL');
  // negative: the same NOTAM without the closure → hidden
  const n = NB('CRANE ERECTED WI XXXX CTR. 245FT AMSL. LIT AND DAY MARKED.');
  assert.ok(!shown(M, [n], n));
});

test('TC-172-074 D67b F-3: only the NOTAM\'s own text is read — a crane followed by another NOTAM\'s VORTAC U/S stays hidden', () => {
  const crane = '- XXXX A5647/24 (12/055) 03DEC2109-22AUG2359 2026\nSFO OBST CRANE (ASN 2023-AWP-6491-NRA) 373658N1222318W (0.6NM WSW\nSFO) 210FT (200FT AGL) FLAGGED AND LGTD\n';
  const after = 'ETP ALTERNATES\nMETAR PAKN 110254Z AUTO 34012G23KT 10SM BKN038 OVC047 M18/M23 A3015\n- AKN 03/022 (A0796/26) AKN NAV VORTAC U/S 2603030944-2604031500EST\n';
  const x = crane + after;
  assert.ok(!shown(M, [x], x), 'hidden: the VORTAC U/S belongs to another NOTAM');
  assert.equal(M._ownNotamText(x), crane.replace(/\n$/, ''), 'own text ends before the section heading');
  // the FAA domestic NOTAM line alone also ends it
  const y = crane + '- LOU 09/098 IIU RWY 09 CLSD 2609062258-2610220600\n';
  assert.ok(!shown(M, [y], y), 'hidden: the RWY CLSD belongs to "- LOU 09/098"');
  // positive: the outage in the NOTAM's own text → shown
  const z = crane.replace('FLAGGED AND LGTD', 'FLAGGED AND LGTD. SFO VORTAC U/S');
  assert.ok(shown(M, [z], z));
  // FlightKeys items are their own text: unchanged
  const f = FK('CRANE 200FT AGL 2NM N OF ARP. VORTAC U/S.');
  assert.equal(M._ownNotamText(f), f);
});

test('TC-172-075 D67b F-4: a table\'s values decide "procedure affected", never its column title', () => {
  const head = 'ADD NEW TEMPO OBST WITHIN A CIRCLE WITH A RADIUS OF 15KM(CENTERED ON THE APR):\nOBST ID/DESIGNATION TYPE POSITION MAG BRG(DEGREE)/DIST(M)\nELEVATION(M) MARKING/LIGHTING TYPE AND COLOUR FLIGHT\nPROCEDURE/TAKE-OFF PATH AREA AFFECTED?REMARKS\n';
  const none = head + 'A01 CRANE  CRANE   013/2,275  2,163.4  RED/LIM/STROBE   -\nA02 CRANE  CRANE   013/2,357  2,154.4  RED/LIM/STROBE   -';
  const empty = head + 'CRANE 13    CRANE       008/2,712    2,145.3      RED/LIM/STROBE\nCRANE 18    CRANE       021/2,460    2,155.3      RED/LIM/STROBE';
  const apch = head + 'CRANE 1 CRANE 139/3,206 76.0 RED LGT\nCRANE 5 CRANE 145/3,236 85.5 RED LGT RWY35R VOR/DME\nFINAL APCH';
  const tkof = head + 'BLDG BLDG 140/6,614 45.0 RED LGT RWY16L\nTAKE-OFF FLT PATH';
  for (const mk of [NB, FK]) {
    for (const t of [none, empty]) { const x = mk(t); assert.ok(!shown(M, [x], x), 'every value "-" or empty → not affected, hidden'); }
    for (const t of [apch, tkof]) { const x = mk(t); assert.equal(M._obstacleRule(t).pattern, 'PROCEDURE_AFFECTED'); assert.ok(shown(M, [x], x), 'a value names a procedure → shown'); }
  }
});

// ══ FlightKeys corpus helpers ════════════════════════════════════════════════

const changeKeys = new Map(CHANGES.entries.map(e => [e.key, e]));
const fkKey = (pkg, h, cat) => `FK ${pkg} ${h.locations.join(' ')} ${h.id} ${cat || '-'}`;
function fkAirports(raw) {
  const out = [];
  for (const [pkg, p] of Object.entries(raw.packages)) for (const [icao, a] of Object.entries(p.airports)) out.push({ pkg, p, icao, a });
  return out;
}
// The items of an airport as v1.14.0 cuts notamsRaw: [{ text, category, h }] and the heading count.
function fkItems(a) {
  const items = [];
  let cat = null, headings = 0;
  for (const pc of M._splitNotams(a.notamsRaw)) {
    const hd = pc.split('\n').filter(l => l.trim()).every(l => M._fkTypeHeading(l)) && pc.trim() ? M._fkTypeHeading(pc.replace(/\n+$/, '').split('\n').filter(l => l.trim()).pop()) : null;
    if (hd) { cat = hd; headings++; continue; }
    const h = M._fkHeader(pc);
    if (h) items.push({ text: pc, category: cat, h });
  }
  return { items, headings };
}

test('TC-172-030 FlightKeys corpus: every item with its printed category, every heading a piece, none in an item; with / without headings', () => {
  const raw = requireFkRaw();
  assert.equal(Object.keys(raw.packages).length, 26);
  let items = 0, headings = 0, headingLines = 0, differ = [];
  for (const { pkg, icao, a } of fkAirports(raw)) {
    const pieces = M._splitNotams(a.notamsRaw);
    assert.equal(pieces.join(''), a.notamsRaw, `${pkg} ${icao}: byte for byte`);
    const r = fkItems(a);
    headingLines += a.notamsRaw.split('\n').filter(l => M._fkTypeHeading(l)).length;
    headings += r.headings;
    items += r.items.length;
    // the parser's items, in order, with the parser's categories
    assert.deepEqual(r.items.map(x => [x.h.id, x.category || '']), a.items.map(x => [x.id, x.category || '']), `${pkg} ${icao}: items and categories`);
    for (const x of r.items) assert.ok(!x.text.split('\n').some(l => M._fkTypeHeading(l)), `${pkg} ${icao} ${x.h.id}: no heading in the item text`);
    // with headings (notamsRaw) vs without (the parser's notams), v1.14.0, the whole airport at no window
    const withH = ev(M, pieces, 'DEST', null, raw.packages[pkg].date, raw.packages[pkg].depMin);
    const without = ev(M, M._splitNotams(a.notams), 'DEST', null, raw.packages[pkg].date, raw.packages[pkg].depMin);
    for (const i of withH.issues) {
      if (!i.notamRaw) continue;
      assert.ok(!M.FK_TYPE_HEADINGS.some(h => i.text.includes(`${PAD}${h}`) || i.rowLabel === h), 'no heading in an issue');
    }
    const sw = new Set(withH.issues.map(i => i.notamRaw.replace(/\s+$/, '')));
    const so = new Set(without.issues.map(i => i.notamRaw.replace(/\s+$/, '')));
    for (const x of r.items) {
      const t = x.text.replace(/\s+$/, '');
      if (sw.has(t) !== so.has(t)) differ.push(fkKey(pkg, x.h, x.category));
    }
  }
  assert.equal(items, 2292, 'the 2,292 items of the 137 airports');
  assert.equal(headings, headingLines, 'every heading line is a heading piece');
  assert.equal(headings, 635);
  // Only OBSTACLE-category items differ, and exactly the change list's items printed under OBSTACLE
  // with no obstacle word (hidden by the heading).
  assert.ok(differ.length > 0 && differ.every(k => / OBSTACLE$/.test(k)), 'only OBSTACLE-category items differ');
  const listed = CHANGES.entries.filter(e => e.fmt === 'FK' && e.byHeadingOnly && e.group === 'B').map(e => e.key);
  assert.deepEqual([...new Set(differ)].sort(), [...new Set(listed)].sort());
  console.log(`TC-172-030: ${items} items, ${headings} headings; with/without headings differ for ${new Set(differ).size} OBSTACLE-category items (all in the change list)`);
});

test('TC-172-031 FlightKeys corpus: v1.13.0 (no headings) = v1.14.0 (notamsRaw) for every item not in the change list', () => {
  const raw = requireFkRaw();
  const found = new Set();
  let calls = 0;
  for (const { pkg, p, icao, a } of fkAirports(raw)) {
    const prof = AP.buildAcftProfile(p.acftType || '');
    const old = new Map();
    for (const q of M13._splitNotams(a.notams)) { const h = M13._fkHeader(q); if (h) old.set(`${h.locations.join(' ')} ${h.id}#${q.replace(/\s+$/, '')}`, q); }
    for (const x of fkItems(a).items) {
      const q = old.get(`${x.h.locations.join(' ')} ${x.h.id}#${x.text.replace(/\s+$/, '')}`);
      assert.ok(q !== undefined, `${pkg} ${icao} ${x.h.id}: the same item in the text without headings`);
      const key = fkKey(pkg, x.h, x.category);
      const e = changeKeys.get(key);
      const hd = x.category ? `${PAD}${x.category}\n` : null;
      const norm = (res, rawText) => canon(res).split(JSON.stringify(rawText).slice(1, -1)).join('<RAW>');
      let diff = 0, s13 = null, s14 = null;
      for (const w of [{ role: 'DEST', eta: null }, ...a.windows]) {
        const b = M13.evalNotams([q], w.role, w.eta, prof, p.date, p.depMin, AP.getWingspan);
        const n = M.evalNotams(hd ? [hd, x.text] : [x.text], w.role, w.eta, prof, p.date, p.depMin, AP.getWingspan);
        calls += 2;
        if (norm(b, q) !== norm(n, x.text)) diff++;
        if (w.eta === null) { s13 = b.issues.some(i => i.notamRaw === q); s14 = n.issues.some(i => i.notamRaw === x.text); }
      }
      if (!e) { assert.equal(diff, 0, `${key}: not in the change list, results identical`); continue; }
      found.add(key);
      assert.equal(sha(x.text.replace(/\s+$/, '')), e.sha, `${key}: the listed text`);
      if (e.group === 'B') assert.deepEqual([s13, s14, diff > 0], [true, false, true], `${key}: B`);
      if (e.group === 'C') assert.deepEqual([s13, s14, diff > 0], [false, true, true], `${key}: C`);
      if (e.group === 'U') assert.equal(s14, true, `${key}: U shown`);
      if (e.group === 'G') assert.deepEqual([s13, s14, diff > 0], [true, true, true], `${key}: G (card group set)`);
    }
  }
  const fkListed = new Set(CHANGES.entries.filter(e => e.fmt === 'FK').map(e => e.key));
  assert.deepEqual([...found].sort(), [...fkListed].sort(), 'every FlightKeys entry of the change list is found');
  console.log(`TC-172-031: ${calls} calls; ${found.size} listed FlightKeys items, every other item identical`);
});

// ══ TC-172-032 NavBlue corpus ════════════════════════════════════════════════

const SWEEP = { roles: ['ORIG', 'DEST'], etas: [0, 59, 300, 600, 719, 720, 1000, 1380, 1439], deps: [null, 0, 700], group: 40 };

test('TC-172-032 NavBlue corpus: split unchanged; every NOTAM not in the change list identical at the TC-171-030 sweep', () => {
  const dir = requireFixturesDir();
  const list = readManifest(dir).fixtures.filter(f => f.format !== 'flightkeys');
  assert.equal(list.length, 30);
  let notams = 0, calls = 0, listed = 0;
  for (const fx of list) {
    const text = fs.readFileSync(path.join(dir, fx.files.text), 'utf8').replace(/\r\n/g, '\n');
    const all = M13._splitNotams(text);
    assert.deepEqual(M._splitNotams(text), all, `${fx.id}: split`);
    assert.equal(M._fkHeader(text), null);
    notams += all.length;
    const prof = AP.buildAcftProfile(fx.aircraft || '');
    const keep = [];
    all.forEach((pc, k) => {
      const e = changeKeys.get(`NB ${fx.id} #${k}`);
      if (!e) { keep.push(pc); return; }
      listed++;
      assert.equal(sha(pc), e.sha, `${fx.id} #${k}: the listed NOTAM`);
      const s13 = shown(M13, [pc], pc, 'DEST', null, fx.date, null, prof), s14 = shown(M, [pc], pc, 'DEST', null, fx.date, null, prof);
      if (e.group === 'B') assert.deepEqual([s13, s14], [true, false], `${fx.id} #${k} ${e.id}: B`);
      if (e.group === 'C') assert.deepEqual([s13, s14], [false, true], `${fx.id} #${k} ${e.id}: C`);
      if (e.group === 'U') assert.equal(s14, true, `${fx.id} #${k} ${e.id}: U shown`);
      if (e.group === 'G') {
        assert.deepEqual([s13, s14], [true, true], `${fx.id} #${k} ${e.id}: G shown by both`);
        assert.notEqual(canon(ev(M, [pc], 'DEST', null, fx.date, null, prof)) + canon(ev(M, [pc], 'ORIG', null, fx.date, null, prof)),
          canon(ev(M13, [pc], 'DEST', null, fx.date, null, prof)) + canon(ev(M13, [pc], 'ORIG', null, fx.date, null, prof)), `${fx.id} #${k}: G differs`);
      }
    });
    for (let i = 0; i < keep.length; i += SWEEP.group) {
      const grp = keep.slice(i, i + SWEEP.group);
      for (const role of SWEEP.roles) for (const eta of SWEEP.etas) for (const dep of SWEEP.deps) for (const d of [fx.date, null]) {
        const b = M13.evalNotams(grp, role, eta, prof, d, dep, AP.getWingspan), a = M.evalNotams(grp, role, eta, prof, d, dep, AP.getWingspan);
        calls += 2;
        assert.equal(canon(a), canon(b), `${fx.id} group ${i / SWEEP.group} ${role} ${eta} ${dep} ${d}`);
      }
    }
  }
  assert.equal(notams, 7704);
  assert.equal(listed, CHANGES.entries.filter(e => e.fmt === 'NB').length, 'every NavBlue entry of the change list is found');
  console.log(`TC-172-032: ${notams} NOTAMs, ${listed} listed, ${calls} calls on the others: identical`);
});

// ══ TC-172-033 change list data = report ═════════════════════════════════════

test('TC-172-033 the change list data and the report agree; recorded from these two modules', () => {
  const md = fs.readFileSync(REPORT, 'utf8');
  assert.ok(/\*\*Version:\*\* v1\.2-UPD/.test(md) && /## Change log/.test(md) && /\| \*\*v1\.2\*\* \|/.test(md), 'v1.2 with its change log');
  assert.equal(CHANGES.version, '1.2');
  const cnt = g => CHANGES.entries.filter(e => e.group === g).length;
  assert.deepEqual(CHANGES.counts, { B: cnt('B'), C: cnt('C'), U: cnt('U'), G: cnt('G'), deferred: CHANGES.deferred.length });
  // D67b F-5: the four en-route NOTAMs, deferred and unchanged from v1.13.0
  assert.deepEqual(CHANGES.deferred.map(e => `${e.airport} ${e.id}`).sort(), ['KZID A0314/25', 'KZID A0718/26', 'KZOB A0408/26', 'KZOB A0409/26']);
  for (const e of CHANGES.deferred) assert.equal(e.before, e.after, `${e.key}: unchanged`);
  assert.ok(new RegExp(`\\| \\*\\*Deferred\\*\\* \\| [^|]+\\| \\*\\*${CHANGES.deferred.length}\\*\\* \\|`).test(md), 'deferred count');
  // F-8: the split pieces before the first NOTAM are labelled, and the summary counts them apart
  const secB = md.split('## Group B ')[1].split('\n## ')[0];
  const pieces = (secB.match(/^\| \d+ \|.*NOT A NOTAM/gm) || []).length;
  assert.equal(pieces, 6, 'the 6 split pieces labelled NOT A NOTAM');
  assert.ok(md.includes(`**${cnt('B') - pieces} NOTAMs + ${pieces} split pieces**`), 'B summary: NOTAMs + split pieces');
  // D67b: the 5e departure-row list, one row per shown row without a departure-card row
  const dep = CHANGES.entries.filter(e => ['C', 'U', 'G'].includes(e.group) && /^no row/.test(e.cards.ORIG));
  const sec5e = md.split('## Departure card — step 5e')[1].split('\n## ')[0];
  assert.equal((sec5e.match(/^\| \d+ \|/gm) || []).length, dep.length, '5e list');
  assert.ok(/src\/airports\.html.*line 313/.test(sec5e) && /src\/edit\.html.*renderAptIssues/.test(sec5e), '5e list names the src lines');
  for (const g of ['B', 'C', 'U', 'G']) assert.ok(new RegExp(`\\| \\*\\*${g}\\*\\* \\| [^|]+\\| \\*\\*${cnt(g)}\\*\\* \\|`).test(md), `report count ${g} = ${cnt(g)}`);
  for (const g of ['B', 'C', 'U', 'G']) {
    const sec = md.split(`## Group ${g} `)[1].split('\n## ')[0];
    assert.equal((sec.match(/^\| \d+ \|/gm) || []).length, cnt(g), `report rows of group ${g}`);
  }
  // O-28: the audit (a) and the beta exposure (c), counts at the top and one row each
  assert.ok(new RegExp(`\\| \\*\\*O-28 \\(a\\)\\*\\* \\| [^|]+\\| \\*\\*${CHANGES.audit.length}\\*\\* \\|`).test(md), 'audit count');
  assert.ok(new RegExp(`\\| \\*\\*O-28 \\(c\\)\\*\\* \\| [^|]+\\| \\*\\*${CHANGES.beta.entries.length}\\*\\* \\|`).test(md), 'beta exposure count');
  const secA = md.split('### (a) ')[1].split('\n### ')[0], secC = md.split('### (c) ')[1];
  assert.equal((secA.match(/^\| \d+ \|/gm) || []).length, CHANGES.audit.length);
  assert.equal((secC.match(/^\| \d+ \|/gm) || []).length, CHANGES.beta.entries.length);
  assert.equal(CHANGES.beta.sha256, 'faa8377dadf6b24dfe1f7a44325647f24de704b4e9e026b6dd266a7ea7438997', 'beta exposure from v1.11.2 (TC-151 record)');
  // every shown row of C, U and G carries its card group (O-25); the four O-25 cases all have a row
  for (const e of CHANGES.entries.filter(x => ['C', 'U', 'G'].includes(x.group))) {
    assert.ok(e.cards && e.cards.DEST && e.cards.ORIG, `${e.key}: card group`);
    if (O25.includes(e.pattern)) assert.ok(!/^no row/.test(e.cards.DEST) && !/^no row/.test(e.cards.ORIG), `${e.key}: O-25 case has a row`);
    assert.ok(!/^no row/.test(e.cards.DEST), `${e.key}: a row on the destination / alternate card (D67b O-29)`);
  }
  assert.equal(CHANGES.before.sha256, MANIFEST['notam-rules'].sha256, 'recorded from v1.13.0');
  assert.equal(CHANGES.after.sha256, MANIFEST['notam-rules-next'].sha256, 'recorded from this v1.14.0 file');
  // No NOTAM text in this repository's data.
  for (const e of CHANGES.entries) assert.deepEqual(Object.keys(e), ['key', 'fmt', 'pkg', 'airport', 'id', 'category', 'group', 'pattern', 'byHeadingOnly', 'before', 'after', 'cards', 'sha']);
});

// ══ TC-172-061 O-28 (a) on the corpus ═════════════════════════════════════════

test('TC-172-061 O-28 audit: every NOTAM of the corpus v1.13.0\'s obstacle filter hid that changes something else or affects a procedure is shown by v1.14.0', () => {
  const dir = requireFixturesDir();
  const raw = requireFkRaw();
  const byKey = new Map(CHANGES.audit.map(e => [e.key, e]));
  assert.ok(CHANGES.audit.length >= 14, 'the audit list');
  let found = 0;
  for (const fx of readManifest(dir).fixtures.filter(f => f.format !== 'flightkeys')) {
    const text = fs.readFileSync(path.join(dir, fx.files.text), 'utf8').replace(/\r\n/g, '\n');
    const prof = AP.buildAcftProfile(fx.aircraft || '');
    M._splitNotams(text).forEach((pc, k) => {
      const e = byKey.get(`NB ${fx.id} #${k}`);
      if (!e) return;
      found++;
      assert.equal(sha(pc), e.sha);
      assert.ok(!shown(M13, [pc], pc, 'DEST', null, fx.date, null, prof), `${e.key} ${e.id}: hidden by v1.13.0`);
      assert.ok(shown(M, [pc], pc, 'DEST', null, fx.date, null, prof), `${e.key} ${e.id}: shown by v1.14.0`);
      // effect / other, or (D67b F-3) no obstacle NOTAM at all: its obstacle word stands after its own text
      assert.ok(['EFFECT', 'OTHER', null].includes(M._obstacleRule(pc).group), `${e.key}: decided`);
    });
  }
  for (const { pkg, p, a } of fkAirports(raw)) {
    const prof = AP.buildAcftProfile(p.acftType || '');
    for (const x of fkItems(a).items) {
      const e = byKey.get(fkKey(pkg, x.h, x.category));
      if (!e) continue;
      found++;
      const hd = x.category ? [`${PAD}${x.category}\n`] : [];
      assert.ok(!shown(M13, [x.text], x.text, 'DEST', null, p.date, p.depMin, prof), `${e.key}: hidden by v1.13.0`);
      assert.ok(shown(M, [...hd, x.text], x.text, 'DEST', null, p.date, p.depMin, prof), `${e.key}: shown by v1.14.0`);
    }
  }
  assert.equal(found, CHANGES.audit.length, 'every audit row found in the corpus');
  // the beta exposure (v1.11.2 is not in this checkout; recorded by the script): each a change-list NOTAM v1.14.0 shows
  for (const b of CHANGES.beta.entries) {
    const e = changeKeys.get(b.key);
    assert.ok(e && e.after === true && ['C', 'U'].includes(e.group), `${b.key}: in the change list, shown by v1.14.0`);
  }
});

// ══ TC-172-040 D61, D43, aircraft filter ═════════════════════════════════════

test('TC-172-040 D61, D43 and the aircraft filter: v1.14.0 = v1.13.0', () => {
  const cases = [];
  // D61: unreadable / impossible dates, FlightKeys and NavBlue, with a schedule
  cases.push(['XXXX A0101/26   2026-Feb-30 00:00 - 2026-Mar-30 23:59\nCREATED:2026-Feb-01 00:00   FL: SFC - UNL\nSCHEDULE:0800-0900\nRWY 09 CLSD\n']);
  cases.push(['XXXX A0102/26   2026-Nov-04 0700 - PERM\nCREATED:2026-Nov-01 00:00   FL: SFC - UNL\nTWY A CLSD\n']);
  cases.push(['- XXXX A0103/26 07JAN0000 2026-05APR2359 2026\nDLY 0800-0900\nRWY 09 CLSD\n']);
  // D43: the same ID twice (one kept), different IDs (both kept), an obstacle NOTAM's second copy
  const d1 = '- XXXX A0201/26 01NOV0000-30NOV2359\nRWY 09 CLSD\n';
  cases.push([d1, d1, '- XXXX A0202/26 01NOV0000-30NOV2359\nRWY 09 CLSD\n']);
  const f1 = 'XXXX XXX A0203/26   2026-Nov-01 00:00 - 2026-Nov-30 23:59\nCREATED:2026-Oct-31 00:00   FL: SFC - UNL\nTWY A CLSD\n';
  cases.push([f1, f1.replace('TWY A', 'TWY B')]);
  const o1 = '- XXXX A0204/26 01NOV0000-30NOV2359\nRWY 09 CLSD DUE CRANE\n';
  cases.push([o1, o1]);
  let n = 0;
  for (const c of cases) for (const role of ['ORIG', 'DEST']) for (const eta of [null, 0, 510, 600, 1200]) for (const dep of [null, 0]) {
    assert.equal(canon(ev(M, c, role, eta, DATE, dep)), canon(ev(M13, c, role, eta, DATE, dep)), `${c[0].split('\n')[0]} ${role} ${eta}`);
    n++;
  }
  assert.ok(ev(M, cases[0]).issues[0].dateUnreadable, 'D61 flag kept');
  // Aircraft filter: the TC-151 cases × every type of the aircraft table and odd inputs.
  const types = [...Object.keys(AP.AIRCRAFT_DATA), ...ACFT.EXTRA_TYPES];
  for (const [k, [label]] of ACFT.CASES.entries()) {
    const text = ACFT.CASE_TEXT[k];
    for (const t of types) {
      const prof = AP.buildAcftProfile(typeof t === 'string' ? t : '');
      assert.equal(M._acftApplies(text, prof, AP.getWingspan), M13._acftApplies(text, prof, AP.getWingspan), `${label} ${t}`);
      for (const role of ['ORIG', 'DEST']) {
        assert.equal(canon(ev(M, [text], role, 600, DATE, 0, prof)), canon(ev(M13, [text], role, 600, DATE, 0, prof)), `${label} ${t} ${role}`);
        n++;
      }
    }
  }
  assert.ok(n > 4000);
});

// ══ TC-172-050 the gate bites ════════════════════════════════════════════════

function variant(edit) {
  const src = edit(SRC);
  assert.notEqual(src, SRC, 'the variant changes the code');
  const m = { exports: {} };
  new Function('module', 'exports', 'require', src)(m, m.exports, () => ({}));
  return m.exports;
}

test('TC-172-050 the gate bites: broken variants of v1.14.0 are caught', () => {
  // (a) E1 restored: the negative of TC-172-010 is shown again.
  const e1 = variant(s => s.replace("if (!obst.show) continue;",
    "if (/\\bOBST\\b|\\bCRANE\\b|\\bOBSTACLE\\b/.test(nu) && !/\\b(?:ILS|LOC|RWY|APCH|PROC|SID|STAR)\\b/i.test(ruleRaw)) continue;"));
  const neg = NB(`LOC RWY 27 DUE TO CRANE. ${BASE}`);
  assert.ok(!shown(M, [neg], neg));
  assert.ok(shown(e1, [neg], neg), 'E1 variant: caught (shown)');
  // (b) headings not read: a trailing OBSTACLE hides the item again (O-12).
  const noHd = variant(s => s.replace("if (indent < _FK_HEADING_MIN_INDENT) return null;", 'return null;'));
  const it = FK('BIRD ACTIVITY IN VICINITY OF AD.').replace(/\n$/, '');
  const q = `${it}\n${PAD}OBSTACLE`;
  assert.ok(shown(M, [q], q));
  assert.ok(!shown(noHd, [q], q), 'no-heading variant: caught (hidden)');
  // (c) the OBSTACLE heading ignored: an item under it with no effect is shown.
  const noCat = variant(s => s.replace("const byHeading = fkCategory === 'OBSTACLE';", 'const byHeading = false;'));
  const t = FK('TOWER 300FT AGL 2NM N OF ARP.');
  const pcs = M._splitNotams(`${PAD}OBSTACLE\n${t}`);
  assert.ok(!shown(M, pcs, t));
  assert.ok(shown(noCat, pcs, t), 'no-category variant: caught (shown)');
  // (d) the stated non-effect read as an effect: "PROCEDURES NOT AFFECTED" shown.
  const noNeg = variant(s => s.replace("let n = t.replace(R.noEffect, ' ')", "let n = t"));
  const x = NB('CRANE 2NM N OF ARP. FLT PROCEDURES NOT AFFECTED.');
  assert.ok(!shown(M, [x], x));
  assert.ok(shown(noNeg, [x], x), 'no-negation variant: caught (shown)');
});

// ══ TC-172-090 fixtures missing ══════════════════════════════════════════════

test('TC-172-090 fixtures missing: the fixture tests fail, they are never skipped', () => {
  const saved = process.env.PB_FIXTURES;
  process.env.PB_FIXTURES = path.join(ROOT, 'does-not-exist');
  try {
    assert.throws(() => requireFixturesDir(), /fixtures not found/);
    assert.throws(() => requireFkRaw(), /fixtures not found/);
  } finally { if (saved === undefined) delete process.env.PB_FIXTURES; else process.env.PB_FIXTURES = saved; }
});
