'use strict';
/**
 * TC-180 — FlightKeys OFP parser v1.1.0 (rules/ofp-flightkeys-next; step 5f module PR A, Exec answers O-169 …
 * O-181 of 22 Nov, D115, D116, D88, D90, D96, D99, D103, D131 as amended by O-175, D63/D63a): the module only,
 * NOT built into the app (D90). Contract 2.5 (ADR-005 Appendix B addendum 5). Extraction only (D88): the
 * advisory-rules engine (module PR B) decides what the crew is told.
 *
 *   TC-180-001  identity: v1.1.0, contract 2.5, key ofp-flightkeys-next (file, SHA-256); the built-in key
 *               ofp-flightkeys stays v1.0.1 (SHA-256 a307b185…); v1.0.1 frozen in test/oracle byte for byte;
 *               the other modules' bytes unchanged; a changed byte is caught (negative)
 *   TC-180-002  not built in (D90): index.html carries v1.0.1 once and no byte-run of v1.1.0; no -next module in
 *               build/build.js; build = index.html; labels 1.10.0 unchanged (rule 9)
 *   TC-180-003  validateSchema(): valid; EXTENSION_FIELDS = v1.0.1's plus volcanicAsh before sections;
 *               NEGATIVE: the retired '5d' step and a 19-field list are refused
 *   TC-180-004  the code differs from v1.0.1 only where declared: every top-level declaration byte-identical
 *               (comments aside) except the 10 listed; 3 new; PATTERNS: v1.0.1's 146 keys unchanged but
 *               RMK_RAIM; 11 new keys listed (negative: an undeclared change is caught)
 *   TC-180-005  O-117 / D99 / D103: no finding template and no step text carries "(open item)", "brief",
 *               "read in 5d", an O-/D-/SME- reference or a version number; the deferred INFO reads
 *               "not read: not yet read from FlightKeys packages"; NEGATIVE control: v1.0.1 gives the old text
 *   TC-180-010  all 26 vs v1.0.1: every field except dispatchContact, volcanicAsh and findings byte-identical
 *               (ofpRemarks, hasPerishables included); findings = v1.0.1's with exactly 3 changes per package:
 *               the dispatchContact INFO and the fplEquipment INFO reworded in place, one volcanicAsh INFO
 *               added after the hazards INFO — 52 removed, 78 added, no WARN touched
 *   TC-180-011  volcanicAsh on the 26 (O-169): 26 pages = sections[] va; 1 ADVISORY (L02: SHEVELUCH, TOKYO,
 *               2026/370), 25 NONE, 0 UNREADABLE; text = the page as printed
 *   TC-180-012  dispatchContact on the 26 (O-175): 23 from the OFP Remarks (18 "… Contact Dispatch with
 *               questions." form, 5 "… if you have any questions." form), 3 from the Company NOTAMs (T1–T3, no
 *               such remark); the label (internal flag, O-181) = v1.0.1's (22 REQUIRED, 4 IF QUESTIONS); no
 *               text carries REQUIRED or IF QUESTIONS
 *   TC-180-013  RAIM on the 26 (O-171, O-172): 27 raim records (26 plain PASSED, 1 ETOPS ALTN PASSED), one line
 *               each; no other OFP remark names RAIM
 *   TC-180-014  perishables on the 26 (O-129, O-176 f): 7 packages print PERISHABLES ONBOARD bare — one item,
 *               alone on its row, no YES/NO anywhere after it on the page row or the next line — and keep
 *               hasPerishables true (as v1.0.1); 0 print ": YES" or ": NO"
 *   TC-180-015  pinned values (fixtures expected/ofp-flightkeys-v1.1.0/changes.json), made with this module
 *   TC-180-020  VA page synthetic: NONE form; one and two advisories; volcano from the list row when its
 *               VOLCANO: line is missing; UNREADABLE: garbled page, rows ≠ blocks, no volcano, heading only;
 *               no VA page → null; no positions → null; a VA remark never changes volcanicAsh (negative)
 *   TC-180-030  RAIM synthetic (O-172): outage with satellites and times takes its continuation lines, across a
 *               page break; ends at a blank line, a sub-heading, a recognised item; "no outages" wording and
 *               FAILED / garbled forms are raim and take continuation; PASSED stays one line (= v1.0.1);
 *               PASSED + outage → two records; RAIM named mid-line in a new remark → raim; the word RAIM on a
 *               continuation line, in a station block, in a Company NOTAM → no raim record (negatives)
 *   TC-180-040  perishables synthetic (O-129): ": YES" → true; ": NO" → false (v1.0.1: true — negative
 *               control); bare → true; none → false; the NavBlue form still → true
 *   TC-180-050  Dispatch contact synthetic (O-175): "with questions" / "if you have any questions" /
 *               an extra Contact Dispatch remark / the words split over two lines / other case → the whole
 *               remark(s) as printed; no such remark and no Company line → null; boilerplate without the words
 *               → null (negative)
 *   TC-180-060  NavBlue identical, 30 of 30: _ofpRulesetParse with v1.1.0 swapped in = the golden snapshots
 *   TC-180-061  the app's real import path with v1.1.0 swapped in (in memory) on all 26: the Preflight card and
 *               the stored flight are identical to the committed app's except S.ofpFindings, which = the
 *               module's findings (no app change in this PR; the display is the integration PR)
 *   TC-180-090  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Every synthetic case is built by test/lib/fk-synth.js and is labelled SYNTHETIC (D87); made-up identifiers.
 * Fixture tests assert counts, labels, levels and fields; fixture values are in the private fixtures repo.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const crypto = require('crypto');
const { findFixtures, readManifest, importFixture } = require('../lib/app-path');
const { loadApp } = require('../harness');
const { normalize } = require('../golden/serialize');
const { diff } = require('../golden/diff');
const { MODULES, assemble } = require('../../build/build');
const { checkRules } = require('../../build/check-rules');
const { NOT_BUILT_IN } = require('../lib/not-built-in');
const S5 = require('../lib/fk-synth');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const NEW_FILE = path.join(RULES, MANIFEST['ofp-flightkeys-next'].file);
const OLD_FILE = path.join(ROOT, 'test', 'oracle', 'ofp-flightkeys-v1.0.1.js');
const NEW_SRC  = fs.readFileSync(NEW_FILE, 'utf8');
const OLD_SRC  = fs.readFileSync(OLD_FILE, 'utf8');
const mod      = require(NEW_FILE);    // v1.1.0
const v101     = require(OLD_FILE);    // v1.0.1, frozen (= the built-in rules/ofp-flightkeys)
const OPTS     = {
  icaoFpl:         require(path.join(RULES, MANIFEST['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MANIFEST['aircraft-profile'].file)),
  notamRules:      require(path.join(RULES, MANIFEST['notam-rules'].file)),
  parseNatTrack:   require(path.join(RULES, MANIFEST['nat-rules'].file)).parseNatTrack,
};
const HTML     = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const EXPECTED_FILE = path.join('expected', 'ofp-flightkeys-v1.1.0', 'changes.json');
const sha      = s => crypto.createHash('sha256').update(s).digest('hex');
const j        = x => JSON.stringify(x);
const SYN      = (o, extra) => S5.input(S5.release(o), extra);              // a SYNTHETIC package (D87)
const parse    = (inp, m = mod) => m.parseFlightKeys(inp, OPTS);
const rec      = (r, cat) => r.ofpRemarks.filter(x => x.category === cat);
const infos    = (r, f) => r.findings.filter(x => x.level === 'INFO' && x.field === f);
const warnsOf  = r => r.findings.filter(x => x.level === 'WARN');

// ══ TC-180-001 … 005 module ══════════════════════════════════════════════════════════════════════

test('TC-180-001 identity: v1.1.0, contract 2.5, under ofp-flightkeys-next; ofp-flightkeys stays v1.0.1; v1.0.1 frozen in test/oracle; others unchanged; a changed byte is caught', () => {
  assert.deepEqual([mod.RULESET_TYPE, mod.OFP_FORMAT, mod.RULESET_VERSION, mod.SCHEMA_VERSION, mod.CONTRACT_VERSION], ['ofp', 'flightkeys', '1.1.0', 2, '2.5']);
  const e = MANIFEST['ofp-flightkeys-next'];
  assert.deepEqual(Object.keys(e), ['version', 'file', 'sha256']);
  assert.deepEqual([e.version, e.file], ['1.1.0', 'ofp-flightkeys-next/ofp-flightkeys-v1.1.0.js']);
  assert.equal(sha(fs.readFileSync(NEW_FILE)), e.sha256, 'the module file = the manifest SHA-256');
  assert.deepEqual(fs.readdirSync(path.join(RULES, 'ofp-flightkeys-next')), ['ofp-flightkeys-v1.1.0.js'], 'one file in rules/ofp-flightkeys-next');
  assert.ok(NOT_BUILT_IN.includes('ofp-flightkeys-next'), 'declared not built in (test/lib/not-built-in.js)');
  // the built-in module stays v1.0.1; its frozen copy is byte-identical
  assert.deepEqual([MANIFEST['ofp-flightkeys'].version, MANIFEST['ofp-flightkeys'].sha256], ['1.0.1', 'a307b18558a43da53c2e8bf2648a2c921facc699610951fde77bd24cc607750d']);
  assert.equal(sha(fs.readFileSync(OLD_FILE)), MANIFEST['ofp-flightkeys'].sha256, 'test/oracle/ofp-flightkeys-v1.0.1.js = rules/ofp-flightkeys v1.0.1, byte for byte');
  assert.equal(v101.RULESET_VERSION, '1.0.1');
  const pinned = {
    'ofp-navblue':      ['2.0.1',  'f7dd7b28f2c61555a1cdfd9a21d601bd6c10ddc0af3d3df890d53541079c6025'],
    'nat-rules':        ['1.2.0',  'a0ed2a31a344680424e96fd31d3046ac8cd65244e58cebd553fe5021fa2ca80d'],
    'notam-rules':      ['1.14.0', '139ce1691574a440a2c371296aea82985bfe26904d77114fa81969c8e86621cb'],
    'icao-fpl':         ['1.0.0',  'd7b432506f32a3675ce3ffa68a07b7e194ed523c9e8dcbd3177f78da36d49ad2'],
    'aircraft-profile': ['1.0.0',  '7ca993193303228d595454ac5bf24ee82eddb9ae1fecc56ad7176dad238a4be5'],
  };
  for (const [k, v] of Object.entries(pinned)) assert.deepEqual([MANIFEST[k].version, MANIFEST[k].sha256], v, k);
  assert.equal(checkRules(ROOT).ok, true);
  // NEGATIVE: one changed byte in a copy of rules/ → the manifest check fails
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tc180-'));
  try {
    fs.cpSync(RULES, path.join(tmp, 'rules'), { recursive: true });
    fs.appendFileSync(path.join(tmp, 'rules', e.file), ' ');
    const c = checkRules(tmp);
    assert.equal(c.ok, false);
    assert.ok(c.errors.some(x => /ofp-flightkeys-next.*does not match the manifest/.test(x)), c.errors.join('; '));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('TC-180-002 not built in (D90): index.html carries v1.0.1 once, no v1.1.0; build = index.html; labels 1.10.0', () => {
  assert.equal(HTML.split(OLD_SRC).length, 2, 'index.html carries v1.0.1 once, byte for byte');
  assert.ok(!HTML.includes(NEW_SRC.slice(0, 600)), 'v1.1.0 header not in index.html');
  assert.ok(!HTML.includes("const RULESET_VERSION  = '1.1.0';") && !HTML.includes('_readVolcanicAsh'), 'v1.1.0 not in index.html');
  assert.equal(MODULES.filter(m => m && m.rule === 'ofp-flightkeys').length, 1);
  assert.equal(MODULES.filter(m => m && /-next$/.test(m.rule)).length, 0, 'build/build.js builds no -next module');
  assert.equal(sha(assemble(ROOT)), sha(fs.readFileSync(path.join(ROOT, 'index.html'))), 'the build from src/ and rules/ = the committed index.html');
  assert.match(HTML, /const APP_VERSION = '1\.10\.0';/);
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /const CACHE_NAME\s*=\s*'pb-v1\.10\.0';/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version, '1.10.0');
});

test('TC-180-003 validateSchema(): valid; volcanicAsh before sections; the retired 5d step and a 19-field list are refused', () => {
  assert.deepEqual(mod.validateSchema(), { valid: true, errors: [] });
  assert.deepEqual(mod.EXTENSION_FIELDS.filter(k => k !== 'volcanicAsh'), v101.EXTENSION_FIELDS, 'v1.0.1 extensions, same order');
  assert.equal(mod.EXTENSION_FIELDS.indexOf('volcanicAsh'), mod.EXTENSION_FIELDS.indexOf('sections') - 1);
  assert.deepEqual(mod.CORE_FIELDS, v101.CORE_FIELDS, 'the 57 core fields unchanged (FK-P)');
  assert.deepEqual(Object.values(mod.DEFERRED_FIELDS), ['open']);
  // NEGATIVE
  const bad = Object.assign({}, mod, { DEFERRED_FIELDS: { fplEquipment: '5d' } });
  assert.ok(mod.validateSchema(bad).errors.some(e => /step '5d' is not open/.test(e)));
  const short = Object.assign({}, mod, { EXTENSION_FIELDS: v101.EXTENSION_FIELDS });
  assert.ok(mod.validateSchema(short).errors.some(e => /EXTENSION_FIELDS must list 20 fields, has 19/.test(e)));
});

// Top-level declarations ("function x" / "const X" at column 0) → { name: code without comment lines }.
function decls(src) {
  const out = {};
  let name = null, buf = [];
  const flush = () => { if (name) out[name] = buf.filter(l => !/^\s*(?:\/\/|\/\*\*|\*)/.test(l)).join('\n').replace(/\s+\/\/[^'"`\n]*$/gm, ''); };
  for (const l of src.split('\n')) {
    const m = /^(?:function\s+(\w+)|const\s+(\w+))/.exec(l);
    if (m) { flush(); name = m[1] || m[2]; buf = []; }
    if (name) buf.push(l);
  }
  flush();
  return out;
}
const CHANGED_DECLS = ['RULESET_VERSION', 'CONTRACT_VERSION', 'EXTENSION_FIELDS', 'DEFERRED_STEPS', 'PATTERNS',
  '_emptyExtensions', 'parseFlightKeys', '_readRemarks', '_readCompany', 'validateSchema'];
const NEW_DECLS = ['_readVolcanicAsh', '_readDispatchContact', 'DISPATCH_CONTACT_REMARK'];
const NEW_PATTERNS = ['PERISHABLES_VALUE', 'RMK_RAIM_WORD', 'RMK_RAIM_PASSED', 'VA_NONE', 'VA_HEAD', 'VA_INTERSECTS',
  'VA_LIST_ROW', 'VA_ADVISORY', 'VA_VAAC', 'VA_VOLCANO', 'VA_NUMBER'];

test('TC-180-004 the code differs from v1.0.1 only in the declared declarations and patterns; an undeclared change is caught', () => {
  const a = decls(OLD_SRC), b = decls(NEW_SRC);
  assert.deepEqual(Object.keys(b).filter(k => !(k in a)).sort(), NEW_DECLS.slice().sort(), 'new declarations');
  assert.deepEqual(Object.keys(a).filter(k => !(k in b)), [], 'no declaration removed');
  const changed = Object.keys(a).filter(k => a[k] !== b[k]);
  assert.deepEqual(changed.sort(), CHANGED_DECLS.slice().sort(), 'changed declarations (comments aside)');
  // PATTERNS: every v1.0.1 pattern unchanged but RMK_RAIM (O-172); the new ones listed
  const pa = v101.PATTERNS, pb = mod.PATTERNS;
  assert.equal(Object.keys(pa).length, 146);
  assert.deepEqual(Object.keys(pa).filter(k => String(pa[k]) !== String(pb[k])), ['RMK_RAIM']);
  assert.deepEqual([String(pa.RMK_RAIM), String(pb.RMK_RAIM)], ['/^RAIM VALIDATION\\b/', '/^RAIM\\b/']);
  assert.deepEqual(Object.keys(pb).filter(k => !(k in pa)), NEW_PATTERNS.concat([]).sort((x, y) => Object.keys(pb).indexOf(x) - Object.keys(pb).indexOf(y)));
  assert.equal(Object.keys(pb).length, 146 + 11);
  // NEGATIVE: the comparison sees a changed declaration
  const planted = decls(OLD_SRC.replace('function _readHazards(ctx) {', 'function _readHazards(ctx) {\n  ctx = ctx;'));
  assert.notEqual(planted._readHazards, a._readHazards);
  assert.equal(decls(OLD_SRC.replace('function _readHazards(ctx) {', '// a comment\nfunction _readHazards(ctx) {'))._readHazards, a._readHazards, 'a comment line alone is no code change');
});

// D99 / D103 / O-117: no internal phrase in a finding text.
const INTERNAL = /\(open item\)|\bbrief\b|\bread in 5d\b|\((?:SME|O)-|\bSME-\d|\bO-\d|\bD-?\d+[a-z]?\b|\bCS-\d|§|\bv?\d+\.\d+\.\d+\b/;

test('TC-180-005 O-117: no finding template or step text carries "(open item)", "brief", "read in 5d" or a reference; the deferred INFO text; v1.0.1 gave the old text (negative control)', () => {
  // every string literal in an add()/ctx.add()/warns.push() call of v1.1.0
  const calls = [];
  const re = /(?<![\w.$])(?:ctx\.)?add\(\s*'(?:WARN|INFO)'|\bwarns\.push\(/g;
  let m;
  while ((m = re.exec(NEW_SRC)) !== null) {
    let i = m.index, depth = 0, s = '';
    for (; i < NEW_SRC.length; i++) { const c = NEW_SRC[i]; s += c; if (c === '(') depth++; else if (c === ')' && --depth === 0) break; }
    calls.push(s);
  }
  assert.ok(calls.length >= 150, `finding calls found: ${calls.length}`);
  const lit = s => (s.match(/'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g) || []).map(x => x.replace(/\$\{[^}]*\}/g, '')).join('|');
  assert.deepEqual(calls.filter(c => INTERNAL.test(lit(c))), [], 'no internal phrase in a v1.1.0 finding template');
  assert.match(NEW_SRC, /const DEFERRED_STEPS = Object\.freeze\(\{ open: 'not yet read from FlightKeys packages' \}\);/);
  assert.ok(!/read in 5d'/.test(NEW_SRC) && !/\(open item\)'/.test(NEW_SRC), 'the old step texts are gone');
  // on a package: the deferred INFO (SYNTHETIC)
  const inp = SYN();
  assert.deepEqual(infos(parse(inp), 'fplEquipment').map(f => f.message), ['not read: not yet read from FlightKeys packages']);
  // NEGATIVE control: v1.0.1 gave the internal phrase
  assert.deepEqual(infos(parse(inp, v101), 'fplEquipment').map(f => f.message), ['not read: not in any brief yet (open item)']);
  assert.ok(INTERNAL.test('not read: not in any brief yet (open item)') && INTERNAL.test('read in 5d') && !INTERNAL.test('not read: not yet read from FlightKeys packages'));
});

// ══ TC-180-010 … 015 fixtures ════════════════════════════════════════════════════════════════════

const FIX = findFixtures(process.env.PB_FIXTURES || null);
const fixtureTest = (name, fn) => test(name, async () => { assert.ok(FIX, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)'); return fn(); });
const LBL = Object.fromEntries(Object.entries(require('./data/ofp-flightkeys-v0.3.0-baseline.json').fixtures).map(([id, b]) => [id, b.label]));
let _fk = null;
function fk() {
  if (_fk) return _fk;
  _fk = readManifest(FIX).fixtures.filter(f => f.format === 'flightkeys').map(fx => {
    const text = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8'), items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
    return { fx, lbl: LBL[fx.id], text, items, a: parse(v101.inputFromExtractor(text, items), v101), b: parse(mod.inputFromExtractor(text, items)) };
  }).sort((x, y) => x.lbl.localeCompare(y.lbl));
  return _fk;
}
const CHANGED_FIELDS = ['dispatchContact', 'volcanicAsh', 'findings'];
const PERISHABLES_BARE = ['L03', 'L08', 'L10', 'L12', 'L13', 'L16', 'L17'];

fixtureTest('TC-180-010 all 26 vs v1.0.1: every other field byte-identical; findings = v1.0.1 with 3 declared changes per package (52 removed, 78 added, no WARN)', () => {
  assert.equal(fk().length, 26);
  let removed = 0, added = 0;
  for (const { lbl, a, b } of fk()) {
    assert.deepEqual(Object.keys(b).filter(k => k !== 'volcanicAsh'), Object.keys(a), `${lbl}: keys in order, volcanicAsh added`);
    for (const k of Object.keys(a)) if (!CHANGED_FIELDS.includes(k)) assert.equal(j(b[k]), j(a[k]), `${lbl}: ${k} byte-identical`);
    assert.equal(a.volcanicAsh, undefined);
    // findings: v1.0.1's, with the volcanicAsh INFO added right after the hazards INFO and two INFO texts reworded in place
    const vi = b.findings.findIndex(f => f.field === 'volcanicAsh');
    assert.equal(b.findings.filter(f => f.field === 'volcanicAsh').length, 1, `${lbl}: one volcanicAsh finding`);
    assert.equal(b.findings[vi].level, 'INFO');
    assert.equal(b.findings[vi - 1].field, 'hazards', `${lbl}: volcanicAsh INFO after the hazards INFO`);
    const rest = b.findings.filter((_, i) => i !== vi);
    assert.equal(rest.length, a.findings.length, `${lbl}: same findings otherwise`);
    a.findings.forEach((f, i) => {
      const g = rest[i];
      assert.deepEqual([g.level, g.field, g.code], [f.level, f.field, f.code], `${lbl} #${i}: level, field, code`);
      if (f.field === 'dispatchContact' || f.field === 'fplEquipment') { assert.equal(f.level, 'INFO'); assert.notEqual(g.message, f.message); removed++; added++; }
      else assert.equal(g.message, f.message, `NEGATIVE: ${lbl} #${i} ${f.level} ${f.field} unchanged`);
    });
    added++;
    assert.deepEqual(warnsOf(b), warnsOf(a), `${lbl}: WARNs unchanged`);
  }
  assert.deepEqual([removed, added], [52, 78]);
});

fixtureTest('TC-180-011 volcanicAsh on the 26 (O-169): 26 pages; 1 ADVISORY (L02), 25 NONE, 0 UNREADABLE; text as printed', () => {
  const st = { NONE: [], ADVISORY: [], UNREADABLE: [] };
  for (const { lbl, b, items } of fk()) {
    const v = b.volcanicAsh, sec = b.sections.find(s => s.id === 'va');
    assert.ok(v && sec, `${lbl}: a VA page`);
    assert.deepEqual(Object.keys(v), ['page', 'state', 'text', 'advisories']);
    assert.equal(v.page, sec.startPage, `${lbl}: page = sections[] va`);
    st[v.state].push(lbl);
    // text = the page's lines as printed: every item string of the page body, in order, is in it
    const pg = items.pages.find(p => p.n === v.page);
    const body = pg.items.filter(it => it.str.trim() && it.y > 27.5 && it.y < 571.6).map(it => it.str.trim());
    let at = 0;
    for (const s of body) { const k = v.text.indexOf(s, 0); assert.ok(k >= 0, `${lbl}: "${s.slice(0, 12)}…" in volcanicAsh.text`); at = k; }
    assert.ok(at >= 0);
    if (v.state === 'NONE') { assert.deepEqual(v.advisories, []); assert.equal(v.text.replace(/\s+/g, ' ').trim(), 'NO VOLCANIC ASH ADVISORIES FOUND FOR THIS FLIGHT'); }
  }
  assert.deepEqual(st.ADVISORY, ['L02']);
  assert.equal(st.NONE.length, 25);
  assert.deepEqual(st.UNREADABLE, []);
  const l02 = fk().find(p => p.lbl === 'L02').b.volcanicAsh;
  assert.deepEqual(l02.advisories, [{ volcano: 'SHEVELUCH', vaac: 'TOKYO', number: '2026/370' }]);
  assert.match(l02.text, /^\s*VOLCANIC ASH ADVISORIES\n/);
  assert.ok(l02.text.includes('\nVA ADVISORY\n') && l02.text.includes('INTERSECTS'));
});

fixtureTest('TC-180-012 dispatchContact on the 26 (O-175): 23 OFP Remarks (18 + 5 forms), 3 Company NOTAMs (T1–T3); label = v1.0.1 (22 REQUIRED, 4 IF QUESTIONS); never REQUIRED / IF QUESTIONS in the text', () => {
  const by = { 'OFP Remarks': [], 'Company NOTAMs': [] }, forms = { with: 0, ifAny: 0 };
  const labels = { REQUIRED: 0, 'IF QUESTIONS': 0 };
  for (const { lbl, a, b } of fk()) {
    const d = b.dispatchContact;
    assert.deepEqual(Object.keys(d), ['label', 'text', 'source']);
    assert.equal(d.label, a.dispatchContact.label, `${lbl}: label (internal flag) as v1.0.1`);
    labels[d.label]++;
    by[d.source].push(lbl);
    assert.ok(!/REQUIRED|IF QUESTIONS/.test(d.text), `${lbl}: no label text in the dispatch text`);
    assert.match(d.text.replace(/\n/g, ' '), /\bContact Dispatch\b/);
    if (d.source === 'OFP Remarks') {
      const r = b.ofpRemarks.filter(x => /contact\s+dispatch/i.test(x.text.replace(/\n/g, ' ')));
      assert.equal(r.length, 1, `${lbl}: one Contact Dispatch remark`);
      assert.equal(d.text, r[0].text, `${lbl}: the whole remark, every line, as printed`);
      assert.equal(r[0].category, 'boilerplate');
      assert.equal(d.text.split('\n').length, 3);
      if (/Contact Dispatch with\nquestions\.$/.test(d.text)) forms.with++;
      else if (/Contact Dispatch if you have\nany questions\.$/.test(d.text)) forms.ifAny++;
      else assert.fail(`${lbl}: unknown form`);
    } else assert.equal(d.text, a.dispatchContact.text, `${lbl}: the Company NOTAM line as printed (no remark)`);
  }
  assert.equal(by['OFP Remarks'].length, 23);
  assert.deepEqual(by['Company NOTAMs'], ['T1', 'T2', 'T3']);
  assert.deepEqual(forms, { with: 18, ifAny: 5 });
  assert.deepEqual(labels, { REQUIRED: 22, 'IF QUESTIONS': 4 });
});

fixtureTest('TC-180-013 RAIM on the 26 (O-171, O-172): 27 raim records, all PASSED forms, one line each; no other remark names RAIM', () => {
  let plain = 0, etops = 0;
  for (const { lbl, b } of fk()) {
    for (const r of rec(b, 'raim')) {
      assert.ok(!r.text.includes('\n'), `${lbl}: one line`);
      assert.match(r.text, mod.PATTERNS.RMK_RAIM_PASSED);
      if (r.text === 'RAIM VALIDATION PASSED') plain++; else { etops++; assert.equal(lbl, 'L14'); }
    }
    assert.deepEqual(b.ofpRemarks.filter(r => /\bRAIM\b/.test(r.text) && r.category !== 'raim'), [], `${lbl}: RAIM only in raim records`);
  }
  assert.deepEqual([plain, etops], [26, 1]);
});

fixtureTest('TC-180-014 perishables on the 26 (O-129, O-176 f): 7 print PERISHABLES ONBOARD bare (one item, nothing after it) and keep hasPerishables; none prints YES or NO', () => {
  const bare = [];
  for (const { lbl, a, b, items } of fk()) {
    assert.equal(b.hasPerishables, a.hasPerishables, `${lbl}: hasPerishables as v1.0.1`);
    const pr = rec(b, 'perishables');
    if (!pr.length) { assert.equal(b.hasPerishables, false, `${lbl}: no perishables line → false`); continue; }
    assert.equal(pr.length, 1);
    assert.equal(pr[0].text, 'PERISHABLES ONBOARD', `${lbl}: the bare form`);
    assert.equal(mod.PATTERNS.PERISHABLES_VALUE.exec(pr[0].text), null);
    assert.equal(b.hasPerishables, true);
    // how it is printed: one item, alone on its row; the next row is another remark, not a value
    const pg = items.pages.find(p => p.n === pr[0].page);
    const it = pg.items.filter(x => x.str.trim() === 'PERISHABLES ONBOARD');
    assert.equal(it.length, 1, `${lbl}: one item`);
    assert.deepEqual(pg.items.filter(x => x.str.trim() && Math.abs(x.y - it[0].y) <= 3).map(x => x.str.trim()), ['PERISHABLES ONBOARD'], `${lbl}: alone on its row`);
    const next = b.ofpRemarks.find(r => r.page === pr[0].page && r.line === pr[0].line + 1);
    assert.ok(next && next.category !== 'perishables' && !/^(?:YES|NO)\b/.test(next.text), `${lbl}: the next line is another remark`);
    bare.push(lbl);
  }
  assert.deepEqual(bare, PERISHABLES_BARE);
});

fixtureTest('TC-180-015 pinned values on all 26 (expected/ofp-flightkeys-v1.1.0/changes.json), made with this module', () => {
  const pin = JSON.parse(fs.readFileSync(path.join(FIX, EXPECTED_FILE), 'utf8'));
  assert.equal(pin.module.version, '1.1.0');
  assert.equal(pin.module.sha256, MANIFEST['ofp-flightkeys-next'].sha256, 'the pinned values were made with this module');
  assert.deepEqual(Object.keys(pin.packages).sort(), fk().map(p => p.fx.id).sort());
  const minus = (x, y) => { const left = y.map(j); return x.map((f, i) => [i, f]).filter(([, f]) => { const k = left.indexOf(j(f)); if (k < 0) return true; left.splice(k, 1); return false; }).map(([i, f]) => [i, f.level, f.field, f.message]); };
  for (const p of fk()) {
    const e = pin.packages[p.fx.id];
    assert.equal(e.label, p.lbl);
    assert.deepEqual(p.b.volcanicAsh, e.volcanicAsh, `${p.lbl}: volcanicAsh`);
    assert.deepEqual(p.b.dispatchContact, e.dispatchContact, `${p.lbl}: dispatchContact`);
    assert.deepEqual(minus(p.a.findings, p.b.findings), e.findingsRemoved, `${p.lbl}: findings removed`);
    assert.deepEqual(minus(p.b.findings, p.a.findings), e.findingsAdded, `${p.lbl}: findings added`);
  }
});

// ══ TC-180-020 … 050 synthetic (D87: every case here is SYNTHETIC) ══════════════════════════════

test('TC-180-020 SYNTHETIC VA page (O-169): NONE, ADVISORY (1 and 2), list-row fallback; UNREADABLE forms; no page / no positions → null; a VA remark never changes volcanicAsh', () => {
  const one = [{ nr: '2026/001', volcano: 'TESTVOLCANO', vaac: 'ANCHORAGE', volcanoNo: '300000' }];
  const two = [...one, { nr: '2026/002', volcano: 'OTHER PEAK', vaac: 'TOKYO', volcanoNo: '300001' }];
  const va = (lines, o) => parse(SYN(o, [S5.vaPage(lines)])).volcanicAsh;
  // NONE
  const none = va(S5.VA_NONE_LINES);
  assert.deepEqual([none.state, none.advisories, none.page], ['NONE', [], 6]);
  assert.equal(none.text, S5.VA_NONE_LINES.join('\n'));
  // ADVISORY
  const a1 = va(S5.vaAdvisory(one));
  assert.equal(a1.state, 'ADVISORY');
  assert.deepEqual(a1.advisories, [{ volcano: 'TESTVOLCANO', vaac: 'ANCHORAGE', number: '2026/001' }]);
  assert.deepEqual(va(S5.vaAdvisory(two)).advisories.map(x => x.volcano), ['TESTVOLCANO', 'OTHER PEAK']);
  // a missing VOLCANO: / ADVISORY NR: line → taken from the list row; a missing VAAC: → null, still ADVISORY
  const fb = va(S5.vaAdvisory(two, { noVolcano: true, noNumber: true, noVaac: true }));
  assert.equal(fb.state, 'ADVISORY');
  assert.deepEqual(fb.advisories, [{ volcano: 'TESTVOLCANO', vaac: null, number: '2026/001' }, { volcano: 'OTHER PEAK', vaac: null, number: '2026/002' }]);
  // UNREADABLE (garbled VA page): rows ≠ blocks; no volcano at all; heading only; random text; the NONE form cut
  const blocksOnly = S5.vaAdvisory(two).filter(l => !/^\s*VAA/.test(l));
  assert.equal(va(blocksOnly).state, 'UNREADABLE', 'no list rows');
  const noVolc = S5.vaAdvisory(one, { noVolcano: true }).map(l => /^\s*VAA/.test(l) ? '  VAA2026/001' : l);
  const nv = va(noVolc);
  assert.deepEqual([nv.state, nv.advisories[0].volcano], ['UNREADABLE', null], 'no volcano readable');
  assert.equal(va(['          VOLCANIC ASH ADVISORIES']).state, 'UNREADABLE', 'heading only');
  assert.equal(va(['VOLCANIC ASH ### ?? ## ASH ADV#SORIES', 'X#Y 2026/??? V#LC#NO']).state, 'UNREADABLE', 'garbled text');
  assert.equal(va(['         NO VOLCANIC ASH ADVISORIES']).state, 'UNREADABLE', 'the NONE form cut short is not NONE');
  assert.equal(va(S5.vaAdvisory(one).filter(l => l.trim() !== 'INTERSECTS')).state, 'UNREADABLE', 'no INTERSECTS column');
  for (const v of [nv, va(blocksOnly)]) assert.ok(v.text.length > 0, 'text kept as printed');
  // findings: INFO only (O-170: nothing for the crew from the parser)
  for (const lines of [S5.VA_NONE_LINES, S5.vaAdvisory(one), blocksOnly]) {
    const r = parse(SYN({}, [S5.vaPage(lines)]));
    assert.equal(r.findings.filter(f => f.field === 'volcanicAsh').map(f => f.level).join(), 'INFO');
  }
  // no VA page → null (with a briefing document present: one INFO); no positions → null, no VA finding
  const noVa = parse(SYN({}, [S5.notamPage(['                              COMPANY NOTAMS', '                                    GENERAL'])]));
  assert.equal(noVa.volcanicAsh, null);
  assert.deepEqual(infos(noVa, 'volcanicAsh').map(f => f.message), ['no Volcanic Ash Advisories page in the briefing package: volcanicAsh null']);
  const textOnly = mod.parseFlightKeys({ text: S5.release().split('\n').filter(l => l !== S5.BL).join('\n') }, OPTS);
  assert.equal(textOnly.volcanicAsh, null);
  assert.deepEqual(infos(textOnly, 'volcanicAsh'), []);
  // NEGATIVE: VA remarks (positive or negative) are extraction-neutral: volcanicAsh is the page only
  for (const rm of ['ROUTED SOUTH TO AVOID POTENTIAL VA FROM TESTVOLCANO', 'NO VA ACTIVITY AFFECTING FLIGHT']) {
    assert.deepEqual(parse(SYN({ remarks: [rm] }, [S5.vaPage(S5.VA_NONE_LINES)])).volcanicAsh, parse(SYN({}, [S5.vaPage(S5.VA_NONE_LINES)])).volcanicAsh);
  }
});

test('TC-180-030 SYNTHETIC RAIM (O-172): continuation for a non-PASSED remark, its ends; PASSED one line; RAIM in a continuation, a station block or a NOTAM → no raim record', () => {
  const raimOf = o => rec(parse(SYN(o)), 'raim').map(r => r.text);
  // outage with satellites and times takes its continuation lines, ended by a blank line
  assert.deepEqual(raimOf({ raim: ['RAIM OUTAGE PREDICTED FOR KBBB', 'PRN 12 0300Z-0345Z', 'PRN 21 0310Z-0400Z', S5.BL, 'ZZZZ REMARK AFTER A BLANK LINE'] }),
    ['RAIM OUTAGE PREDICTED FOR KBBB\nPRN 12 0300Z-0345Z\nPRN 21 0310Z-0400Z']);
  // ended by a sub-heading / a recognised item (PCF)
  assert.deepEqual(raimOf({ raim: ['RAIM OUTAGE PREDICTED FOR KBBB', 'PRN 12 0300Z-0345Z', 'NOTES:', 'ZZZZ NOTE'] }), ['RAIM OUTAGE PREDICTED FOR KBBB\nPRN 12 0300Z-0345Z']);
  assert.deepEqual(raimOf({ raim: ['RAIM OUTAGE PREDICTED FOR KBBB', 'PRN 12 0300Z-0345Z', 'PCF 002000 FOR WX'] }), ['RAIM OUTAGE PREDICTED FOR KBBB\nPRN 12 0300Z-0345Z']);
  // a page break is not a blank line (D63a): the remark continues on the next release page
  assert.deepEqual(raimOf({ remarks: ['RAIM OUTAGE PREDICTED FOR KBBB', 'PRN 12 0300Z-0345Z'], remarksNextPage: ['PRN 21 0310Z-0400Z'], raim: [] }),
    ['RAIM OUTAGE PREDICTED FOR KBBB\nPRN 12 0300Z-0345Z\nPRN 21 0310Z-0400Z']);
  // "no outages" wording, FAILED, garbled: raim, not PASSED → take continuation
  assert.deepEqual(raimOf({ raim: ['RAIM VALIDATION: NO OUTAGES PREDICTED', 'FOR ALL WAYPOINTS AND ALTERNATES'] }), ['RAIM VALIDATION: NO OUTAGES PREDICTED\nFOR ALL WAYPOINTS AND ALTERNATES']);
  assert.deepEqual(raimOf({ raim: ['RAIM VALIDATION FAILED', 'SEE DISPATCH'] }), ['RAIM VALIDATION FAILED\nSEE DISPATCH']);
  assert.deepEqual(raimOf({ raim: ['RAIM V#L#D#TION ?? P#SS', '#### 03##Z'] }), ['RAIM V#L#D#TION ?? P#SS\n#### 03##Z']);
  // the PASSED forms stay one line; the next unmarked line is a remark of its own (as v1.0.1)
  for (const p of ['RAIM VALIDATION PASSED', 'RAIM VALIDATION FOR ETOPS ALTN PAKN PASSED']) {
    const o = { raim: [p, 'ZZZZ UNMARKED LINE'] };
    assert.deepEqual(raimOf(o), [p]);
    assert.deepEqual(parse(SYN(o)).ofpRemarks, parse(SYN(o), v101).ofpRemarks, `${p}: = v1.0.1`);
  }
  // PASSED + outage → two records (the module extracts both; advisory-rules decides, O-171)
  assert.deepEqual(raimOf({ raim: ['RAIM VALIDATION PASSED', 'RAIM OUTAGE PREDICTED FOR KCCC', 'PRN 05 0500Z-0530Z'] }),
    ['RAIM VALIDATION PASSED', 'RAIM OUTAGE PREDICTED FOR KCCC\nPRN 05 0500Z-0530Z']);
  // RAIM named mid-line in the first line of a new remark → raim (after a blank line, and as a sub-heading)
  assert.deepEqual(raimOf({ remarks: [S5.BL, 'GPS RAIM OUTAGE KBBB 0300Z-0345Z', 'PRN 12'], raim: [] }), ['GPS RAIM OUTAGE KBBB 0300Z-0345Z\nPRN 12']);
  assert.deepEqual(raimOf({ remarks: [S5.BL, 'PREDICTED RAIM OUTAGES:', 'PRN 12 0300Z-0345Z'], raim: [] }), ['PREDICTED RAIM OUTAGES:\nPRN 12 0300Z-0345Z']);
  // NEGATIVE: the word RAIM on a continuation line of another remark → that remark, no raim record
  const cont = parse(SYN({ remarks: ['PCF 002000 FOR WX DEVIATIONS', 'NOT RAIM RELATED'], raim: [] }));
  assert.deepEqual(rec(cont, 'raim'), []);
  assert.deepEqual(rec(cont, 'pcf').map(r => r.text), ['PCF 002000 FOR WX DEVIATIONS\nNOT RAIM RELATED']);
  // NEGATIVE: RAIM named inside a station block stays the station restriction (an airport remark)
  const st = parse(SYN({ remarks: ['KBBB FLIGHT OPS RESTRICTIONS:', '- RNAV APPROACH NOT AUTH WHEN RAIM UNAVAILABLE'], raim: [] }));
  assert.deepEqual(rec(st, 'raim'), []);
  assert.ok(st.airportData.KBBB.remarks.some(r => /RAIM UNAVAILABLE/.test(r.text)));
  // NEGATIVE: RAIM in NOTAM text (a Company NOTAM) never reaches the remarks reader
  const nt = parse(SYN({ raim: [] }, [S5.notamPage(['                              COMPANY NOTAMS', '                                    GENERAL',
    '               A0001/26        2026-Mar-01 00:00 - UFN', 'CREATED:2026-Feb-28 00:00       FL: SFC - UNL', 'SUBJECT: GPS', 'RAIM OUTAGE PREDICTED KZZZ 0300-0400Z'])]));
  assert.deepEqual(rec(nt, 'raim'), []);
  assert.ok(nt.companyNotams.some(c => /RAIM OUTAGE/.test(c.text)), 'the NOTAM keeps its RAIM text');
  // no RAIM line at all → no raim record
  assert.deepEqual(raimOf({ raim: [] }), []);
});

test('TC-180-040 SYNTHETIC perishables (O-129): YES → true; NO → false (v1.0.1 true); bare → true; none → false; NavBlue form → true', () => {
  const per = (rm, m) => parse(SYN({ remarks: rm }), m).hasPerishables;
  assert.equal(per(['PERISHABLES ONBOARD: YES']), true);
  assert.equal(per(['PERISHABLES ONBOARD: NO']), false);
  assert.equal(per(['PERISHABLES ONBOARD: NO'], v101), true, 'NEGATIVE control: v1.0.1 read ": NO" as perishables');
  assert.equal(per(['PERISHABLES ON BOARD: NO']), false);
  assert.equal(per(['PERISHABLES ONBOARD']), true, 'the bare form, as v1.0.1 (O-176 f: open item)');
  assert.equal(per(['PERISHABLES ONBOARD'], v101), true);
  assert.equal(per([]), false);
  assert.equal(per(['PERISHABLES O/B: YES']), true, 'the NavBlue rule still applies');
  assert.equal(per(['PERISHABLES O/B: NO']), false);
  // the remark itself is kept as printed in both cases
  assert.deepEqual(rec(parse(SYN({ remarks: ['PERISHABLES ONBOARD: NO'] })), 'perishables').map(r => r.text), ['PERISHABLES ONBOARD: NO']);
});

test('TC-180-050 SYNTHETIC Dispatch contact (O-175): every variant as printed, every line; none → null', () => {
  const dc = o => parse(SYN(o)).dispatchContact;
  const withQ = dc({});
  assert.deepEqual(withQ, { label: null, text: S5.BOILER.join('\n'), source: 'OFP Remarks' }, 'the "with questions" form; no Company line → label null');
  const ifAny = ['This OFP prepared with FlightKeys. Review Operations Bulletin', 'for FlightKeys OFP and procedure changes. Contact Dispatch if you have', 'any questions.'];
  assert.equal(dc({ boiler: ifAny }).text, ifAny.join('\n'));
  // an extra Contact Dispatch remark: both, in printed order, each whole
  const extra = dc({ remarks: [S5.BL, 'CONTACT DISPATCH PRIOR TO DEPARTURE FOR', 'UPDATED SLOT INFORMATION'] });
  assert.equal(extra.text, [...S5.BOILER, 'CONTACT DISPATCH PRIOR TO DEPARTURE FOR', 'UPDATED SLOT INFORMATION'].join('\n'));
  // the words split over two lines; other case
  const split = ['This OFP prepared with FlightKeys. Review Operations Bulletin', 'for FlightKeys OFP and procedure changes. Contact', 'Dispatch with questions.'];
  assert.equal(dc({ boiler: split }).text, split.join('\n'));
  assert.equal(dc({ boiler: [], remarks: ['contact dispatch before departure'] }).text, 'contact dispatch before departure');
  // NEGATIVE: no remark with the words and no Company line → null; the words elsewhere in a line are needed
  assert.equal(dc({ boiler: [] }), null);
  assert.equal(dc({ boiler: ['This OFP prepared with FlightKeys. Review Operations Bulletin', 'for FlightKeys OFP and procedure changes.'] }), null);
  assert.equal(dc({ boiler: [], remarks: ['DISPATCH CONTACTED CREW'] }), null);
  // v1.0.1 read the Company line only: null here (no Company NOTAMs in the synthetic package)
  assert.equal(parse(SYN({}), v101).dispatchContact, null, 'NEGATIVE control: v1.0.1 did not read the remark');
});

// ══ TC-180-060 / 061 / 090 the app ═══════════════════════════════════════════════════════════════

const HTML_V110 = (() => {
  assert.equal(HTML.split(OLD_SRC).length, 2);
  return HTML.replace(OLD_SRC, () => NEW_SRC);
})();

fixtureTest('TC-180-060 NavBlue identical, 30 of 30: _ofpRulesetParse with v1.1.0 swapped in = the golden snapshots; a changed value is caught', () => {
  const nb = readManifest(FIX).fixtures.filter(f => f.format !== 'flightkeys');
  assert.equal(nb.length, 30);
  const app = loadApp({ html: HTML_V110 });
  let first = null;
  for (const fx of nb) {
    const raw = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8');
    let r;
    try { r = { result: normalize(app._ofpRulesetParse(raw)) }; } catch (e) { r = { error: String(e && e.message || e) }; }
    const snap = normalize({ id: fx.id, parser: '_ofpRulesetParse', ...r });
    const want = JSON.parse(fs.readFileSync(path.join(FIX, 'snapshots', `${fx.id}.json`), 'utf8'));
    assert.deepEqual(diff(want, snap), [], `${fx.id}: NavBlue output = its snapshot`);
    if (!first) first = { want, snap };
  }
  const bad = JSON.parse(JSON.stringify(first.want));
  bad.result.fltNum = String(bad.result.fltNum) + 'X';
  assert.ok(diff(bad, first.snap).length > 0, 'NEGATIVE: a changed value is caught');
});

fixtureTest('TC-180-061 the app with v1.1.0 swapped in, all 26: Preflight card and stored flight = the committed app, S.ofpFindings = the module findings', async () => {
  const strip = s => { const o = JSON.parse(JSON.stringify(s)); delete o.ofpFindings; return o; };
  for (const p of fk()) {
    const before = await importFixture(p.fx, FIX, { html: HTML }), after = await importFixture(p.fx, FIX, { html: HTML_V110 });
    assert.equal(after.app.renderPreflightPhase(), before.app.renderPreflightPhase(), `${p.lbl}: the Preflight card is unchanged`);
    assert.deepEqual(strip(after.S), strip(before.S), `${p.lbl}: the stored flight is unchanged but the findings`);
    assert.deepEqual(JSON.parse(JSON.stringify(after.S.ofpFindings)), p.b.findings, `${p.lbl}: findings = v1.1.0's`);
    assert.deepEqual(JSON.parse(JSON.stringify(before.S.ofpFindings)), p.a.findings, `${p.lbl}: NEGATIVE control: the committed app = v1.0.1's`);
  }
});

test('TC-180-090 fixtures missing → the fixture tests FAIL, never skip', () => {
  assert.equal(findFixtures(path.join(ROOT, 'no-such-dir')) === path.join(ROOT, 'no-such-dir'), false, 'a directory without a manifest is not taken as the fixtures');
  assert.ok(FIX, 'the fixtures are available in this run');
});
