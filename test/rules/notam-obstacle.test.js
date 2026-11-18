'use strict';
/**
 * TC-172 — NOTAM ruleset v1.14.0 (ledger P-26): the obstacle rule of Exec decision D67 and the
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
 *   TC-172-015  the OBSTACLE heading makes an item an obstacle NOTAM; the 16 other headings never do
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
 *   TC-172-033  the change list data = the report's counts; every listed NOTAM is the fixture's NOTAM
 *   TC-172-040  D61, D43 and the aircraft filter unchanged (v1.14.0 = v1.13.0)
 *   TC-172-050  the gate bites: E1 restored, headings not read, the OBSTACLE heading ignored → caught
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
const REPORT   = path.join(ROOT, 'docs', 'RPT-NOTAM-ObstacleRule-ChangeList-NEW-20261118-v1.0.md');
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
  const NEW = ['FK_TYPE_HEADINGS', '_fkTypeHeading', 'OBSTACLE_RULE', '_obstacleRule'];
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
    '_OB_SENT', '_OB_US', '_obRe', 'OBSTACLE_RULE', '_obstacleRule'];
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
    'CLIMB_GRADIENT', 'TKOF_ODP', 'TKOF_MINIMA', 'PROCEDURE_ALTITUDE']);
});

// ══ TC-172-011 other content (item 3) ════════════════════════════════════════

const OTHER_CASES = [
  ['RWY_AVAILABILITY',       'RWY 09 CLSD.'],
  ['RWY_AVAILABILITY',       'RWY 09/27 NOT AVBL.'],
  ['CLOSED_TO_TRAFFIC',      'EAST RAMP NW CORNER CLSD TO ACFT.'],
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
      // Classified exactly as v1.13.0 classifies the same text (the classifier is unchanged).
      const h = M._fkHeader(pos);
      const ruleRaw = h ? pos.split('\n').filter((_, k) => !h.headerRows.includes(k)).join('\n') : pos;
      const c13 = M13._classifyNotamSlot(ruleRaw.toUpperCase(), ruleRaw, 'DEST', PROF.type, true, AP.getWingspan);
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
  ['SURFACE_PENETRATION',     'CTN! CRANE INCURS A LOW CLOSE END OBST.',                     'CTN! CRANE.'],
  ['SURFACE_NAMED',           'CRANE EXIST ABV CONICAL SFC.',                                'CRANE EXIST.'],
  ['SURFACE_NAMED',           'HVY EQPT (OBST) EXIST ABV APCH SFC FOR RWY 16R.',             'HVY EQPT (OBST) EXIST FOR RWY 16R.'],
  ['RUNWAY_STRIP',            'NEW OBST OBSERVED IN THE RWY STRIP.',                         'NEW OBST OBSERVED.'],
  ['PROCEDURE_AREA_AFFECTED', 'CRANE 1. FLT PROC/TAKE-OFF PATH AREA AFFECTED: RWY35R VOR/DME FINAL APCH.', 'CRANE 1. RWY35R VOR/DME FINAL APCH.'],
  ['HEIGHT_NEAR_PROCEDURE',   'CRANE ERECTED NW OF APCH COURSE RWY 05, MAX HEIGHT OF (9843FT/30M).', 'CRANE ERECTED NW OF APCH COURSE RWY 05.'],
  ['HEIGHT_NEAR_RUNWAY',      'MOBILE CRANE APRX 1040FT BFR THR 10. 120FT AGL 317FT AMSL.',   'MOBILE CRANE APRX 1040FT BFR THR 10.'],
  ['HEIGHT_NEAR_RUNWAY',      'OBST CRANE (0.1NM E APCH END RWY 27) UNKNOWN (75FT AGL) FLAGGED AND LGTD.', 'OBST CRANE (0.1NM E APCH END RWY 27) FLAGGED AND LGTD.'],
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
  assert.deepEqual([...seen].sort(), [...Object.keys(M.OBSTACLE_RULE.undecided), 'HEIGHT_NEAR_PROCEDURE', 'HEIGHT_NEAR_RUNWAY'].sort());
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
  assert.deepEqual([dc.group, dc.pattern, dc.noEffectStated], ['UNDECIDED', 'HEIGHT_NEAR_RUNWAY', true]);
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
      for (const extra of ['RWY 09 CLSD.', 'OCA/H INCREASED.', 'MAX HGT 300FT NEAR THR 09.']) {
        const it2 = FK(`${body} ${extra}`);
        assert.ok(shown(M, M._splitNotams(`${PAD}OBSTACLE\n${it2}`), it2), extra);
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
  const cnt = g => CHANGES.entries.filter(e => e.group === g).length;
  assert.deepEqual(CHANGES.counts, { B: cnt('B'), C: cnt('C'), U: cnt('U') });
  for (const g of ['B', 'C', 'U']) assert.ok(new RegExp(`\\| \\*\\*${g}\\*\\* \\| [^|]+\\| \\*\\*${cnt(g)}\\*\\* \\|`).test(md), `report count ${g} = ${cnt(g)}`);
  for (const g of ['B', 'C', 'U']) {
    const sec = md.split(`## Group ${g} `)[1].split('\n## ')[0];
    assert.equal((sec.match(/^\| \d+ \|/gm) || []).length, cnt(g), `report rows of group ${g}`);
  }
  assert.equal(CHANGES.before.sha256, MANIFEST['notam-rules'].sha256, 'recorded from v1.13.0');
  assert.equal(CHANGES.after.sha256, MANIFEST['notam-rules-next'].sha256, 'recorded from this v1.14.0 file');
  // No NOTAM text in this repository's data; the report holds no crew data marker words.
  for (const e of CHANGES.entries) assert.deepEqual(Object.keys(e), ['key', 'fmt', 'pkg', 'airport', 'id', 'category', 'group', 'pattern', 'byHeadingOnly', 'before', 'after', 'sha']);
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
  const e1 = variant(s => s.replace("if (!_obstacleRule(ruleRaw, itemHeading).show) continue;",
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
  const noNeg = variant(s => s.replace("const n = t.replace(R.noEffect, ' ')", "const n = t"));
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
