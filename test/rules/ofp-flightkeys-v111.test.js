'use strict';
/**
 * TC-183 — FlightKeys OFP parser v1.1.1 (DEF-013 module PR; Exec rulings R1–R5 and O-C, O-D of 23 Nov).
 * The Dispatch contact comes from the OFP Remarks only: dispatchContact = { remark } with the sentence about
 * contacting Dispatch as printed (wrapped lines joined, final full stop dropped, nothing else from the
 * paragraph), or null. Not built into index.html: rules/ofp-flightkeys-next until the integration PR (D90, D96).
 *
 *   TC-183-001  identity: v1.1.1, contract 2.5, key ofp-flightkeys-next (file, SHA-256); v1.1.0 unchanged in
 *               rules/ofp-flightkeys (SHA-256); the other modules as pinned; a changed byte is caught (negative)
 *   TC-183-002  not built in: index.html carries v1.1.0 once and no byte of v1.1.1; build = index.html; labels 1.10.0
 *   TC-183-003  the code differs from v1.1.0 only where declared: every top-level declaration byte-identical
 *               (comments aside) except RULESET_VERSION and _readDispatchContact; 2 new, 2 removed; PATTERNS and
 *               the schema lists identical; validateSchema() valid
 *   TC-183-010  all 26 vs v1.1.0: every field but dispatchContact and findings byte-identical (companyNotams, with the
 *               cover sentences as printed, included); findings = v1.1.0's with exactly one changed text per package
 *               (the dispatchContact INFO), same level, field, order, count
 *   TC-183-011  the 26: printed wording → row text: 18 "Contact Dispatch with questions", 5 "Contact Dispatch if you
 *               have any questions", 3 null (T1–T3), 0 other; L15 (GIANT 8752) and L08 (GIANT 8414) → "…with questions"
 *   TC-183-012  the cover-page / Company NOTAM sentences are printed on all 26 (22 short, 4 long) and decide nothing (R1)
 *   TC-183-020  SYNTHETIC R2: both printed forms; wrapped lines joined (also inside the words "Contact Dispatch");
 *               the sentence only, not the paragraph; final full stop dropped, other punctuation and case kept;
 *               a sentence inside a longer paragraph; two records; the same sentence twice is carried once
 *   TC-183-030  SYNTHETIC R1: Company NOTAM short / long sentence with no remark → null; with a remark → the remark only
 *   TC-183-040  SYNTHETIC R3: no sentence in the OFP Remarks → null (several negatives)
 *   TC-183-050  SYNTHETIC R4: exactly { remark }; no label / text / company; the same output whatever the cover prints
 *   TC-183-060  SYNTHETIC R5: "Contact Dispatch" inside a NOTAM body (Company NOTAM) is not a Dispatch remark → null;
 *               with a remark the remark only
 *   TC-183-070  NEGATIVE controls: v1.1.0 on the same SYNTHETIC inputs gives the label REQUIRED / IF QUESTIONS from the
 *               cover sentence (the defect)
 *   TC-183-090  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Every synthetic case is built by test/lib/fk-synth.js and is labelled SYNTHETIC (D87); made-up identifiers.
 * The fixtures are read, never copied: the printed Dispatch sentences are not crew data and are quoted.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const crypto = require('crypto');
const { findFixtures, readManifest } = require('../lib/app-path');
const { MODULES, assemble } = require('../../build/build');
const { checkRules } = require('../../build/check-rules');
const { NOT_BUILT_IN } = require('../lib/not-built-in');
const S5 = require('../lib/fk-synth');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const NEW_FILE = path.join(RULES, MANIFEST['ofp-flightkeys-next'].file);
const OLD_FILE = path.join(RULES, MANIFEST['ofp-flightkeys'].file);
const NEW_SRC  = fs.readFileSync(NEW_FILE, 'utf8');
const OLD_SRC  = fs.readFileSync(OLD_FILE, 'utf8');
const mod      = require(NEW_FILE);    // v1.1.1
const v110     = require(OLD_FILE);    // v1.1.0, built in
const OPTS     = {
  icaoFpl:         require(path.join(RULES, MANIFEST['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MANIFEST['aircraft-profile'].file)),
  notamRules:      require(path.join(RULES, MANIFEST['notam-rules'].file)),
  parseNatTrack:   require(path.join(RULES, MANIFEST['nat-rules'].file)).parseNatTrack,
};
const HTML     = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sha      = s => crypto.createHash('sha256').update(s).digest('hex');
const j        = x => JSON.stringify(x);
const SYN      = (o, extra) => S5.input(S5.release(o), extra);              // a SYNTHETIC package (D87)
const parse    = (inp, m = mod) => m.parseFlightKeys(inp, OPTS);
const infos    = (r, f) => r.findings.filter(x => x.level === 'INFO' && x.field === f);

const W1 = 'Contact Dispatch with questions', W2 = 'Contact Dispatch if you have any questions';
const SHORT = 'Contact Dispatch for a preflight briefing.', LONG = 'Contact Dispatch for a preflight briefing if you have any questions.';
const LEAD = 'This OFP prepared with FlightKeys. Review Operations Bulletin';

// ══ TC-183-001 … 003 module ══════════════════════════════════════════════════════════════════════

test('TC-183-001 identity: v1.1.1, contract 2.5, under ofp-flightkeys-next; v1.1.0 unchanged; others as pinned; a changed byte is caught', () => {
  assert.deepEqual([mod.RULESET_TYPE, mod.OFP_FORMAT, mod.RULESET_VERSION, mod.SCHEMA_VERSION, mod.CONTRACT_VERSION], ['ofp', 'flightkeys', '1.1.1', 2, '2.5']);
  const e = MANIFEST['ofp-flightkeys-next'];
  assert.deepEqual(Object.keys(e), ['version', 'file', 'sha256']);
  assert.deepEqual([e.version, e.file], ['1.1.1', 'ofp-flightkeys-next/ofp-flightkeys-v1.1.1.js']);
  assert.equal(sha(fs.readFileSync(NEW_FILE)), e.sha256, 'the module file = the manifest SHA-256');
  assert.deepEqual(NOT_BUILT_IN, ['ofp-flightkeys-next'], 'declared in test/lib/not-built-in.js (D96)');
  assert.deepEqual(fs.readdirSync(path.join(RULES, 'ofp-flightkeys-next')).filter(f => f.endsWith('.js')), ['ofp-flightkeys-v1.1.1.js']);
  // v1.1.0: unchanged (the bytes of the 5f module PR, built in by the 5f display PR)
  assert.equal(v110.RULESET_VERSION, '1.1.0');
  assert.equal(MANIFEST['ofp-flightkeys'].version, '1.1.0');
  assert.equal(sha(fs.readFileSync(OLD_FILE)), 'd2e1d7a17eea2badec40c599cd2ee5d459e9172e0b54b76b841fb6fad0691ff9', 'v1.1.0 byte for byte');
  assert.deepEqual(fs.readdirSync(path.join(RULES, 'ofp-flightkeys')).filter(f => f.endsWith('.js')), ['ofp-flightkeys-v1.1.0.js']);
  const pinned = {
    'ofp-navblue':      ['2.0.1',  'f7dd7b28f2c61555a1cdfd9a21d601bd6c10ddc0af3d3df890d53541079c6025'],
    'nat-rules':        ['1.2.0',  'a0ed2a31a344680424e96fd31d3046ac8cd65244e58cebd553fe5021fa2ca80d'],
    'notam-rules':      ['1.14.0', '139ce1691574a440a2c371296aea82985bfe26904d77114fa81969c8e86621cb'],
    'icao-fpl':         ['1.0.0',  'd7b432506f32a3675ce3ffa68a07b7e194ed523c9e8dcbd3177f78da36d49ad2'],
    'aircraft-profile': ['1.0.0',  '7ca993193303228d595454ac5bf24ee82eddb9ae1fecc56ad7176dad238a4be5'],
    'advisory-rules':   ['1.0.0',  '8373fb54866a19fbedd7f0547d237046987146e24f9e821cb03863a7f523ebff'],
  };
  for (const [k, v] of Object.entries(pinned)) assert.deepEqual([MANIFEST[k].version, MANIFEST[k].sha256], v, k);
  assert.equal(checkRules(ROOT).ok, true);
  // NEGATIVE: one changed byte in a copy of rules/ → the manifest check fails
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tc183-'));
  try {
    fs.cpSync(RULES, path.join(tmp, 'rules'), { recursive: true });
    fs.appendFileSync(path.join(tmp, 'rules', e.file), ' ');
    const c = checkRules(tmp);
    assert.equal(c.ok, false);
    assert.ok(c.errors.some(x => /ofp-flightkeys-next.*does not match the manifest/.test(x)), c.errors.join('; '));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('TC-183-002 not built in: index.html carries v1.1.0 once and no byte of v1.1.1; build = index.html; labels 1.10.0', () => {
  assert.equal(HTML.split(OLD_SRC).length, 2, 'index.html carries v1.1.0 once, byte for byte');
  assert.ok(!HTML.includes("const RULESET_VERSION  = '1.1.1';"), 'v1.1.1 is not in index.html');
  assert.ok(!HTML.includes('_dispatchSentences'), 'no v1.1.1 code in index.html');
  assert.equal(MODULES.filter(m => m && m.rule === 'ofp-flightkeys').length, 1);
  assert.equal(MODULES.filter(m => m && /-next$/.test(m.rule)).length, 0, 'build/build.js builds no -next module');
  assert.equal(sha(assemble(ROOT)), sha(fs.readFileSync(path.join(ROOT, 'index.html'))), 'the build from src/ and rules/ = the committed index.html');
  assert.match(HTML, /const APP_VERSION = '1\.10\.0';/);
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /const CACHE_NAME\s*=\s*'pb-v1\.10\.0';/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version, '1.10.0');
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

test('TC-183-003 the code differs from v1.1.0 only in the declared declarations; PATTERNS and schema lists identical; an undeclared change is caught', () => {
  const a = decls(OLD_SRC), b = decls(NEW_SRC);
  assert.deepEqual(Object.keys(b).filter(k => !(k in a)).sort(), ['DISPATCH_SENTENCE', '_dispatchSentences'], 'new declarations');
  assert.deepEqual(Object.keys(a).filter(k => !(k in b)).sort(), ['DISPATCH_CONTACT', 'DISPATCH_CONTACT_REMARK'], 'removed declarations (the cover-line labels, R1 / R4)');
  assert.deepEqual(Object.keys(a).filter(k => k in b && a[k] !== b[k]).sort(), ['RULESET_VERSION', '_readDispatchContact'], 'changed declarations (comments aside)');
  assert.equal(j(Object.entries(mod.PATTERNS).map(([k, v]) => [k, String(v)])), j(Object.entries(v110.PATTERNS).map(([k, v]) => [k, String(v)])), 'PATTERNS identical');
  for (const k of ['CORE_FIELDS', 'EXTENSION_FIELDS', 'AIRPORT_EXTENSION_FIELDS', 'DDG_EXTENSION_FIELDS', 'DEFERRED_FIELDS', 'DEFERRED_STEPS']) assert.equal(j(mod[k]), j(v110[k]), k);
  assert.deepEqual(mod.validateSchema(), { valid: true, errors: [] });
  // NEGATIVE: the comparison sees a changed declaration, not a comment
  const planted = decls(OLD_SRC.replace('function _readHazards(ctx) {', 'function _readHazards(ctx) {\n  ctx = ctx;'));
  assert.notEqual(planted._readHazards, a._readHazards);
  assert.equal(decls(OLD_SRC.replace('function _readHazards(ctx) {', '// a comment\nfunction _readHazards(ctx) {'))._readHazards, a._readHazards);
});

// ══ TC-183-010 … 012 fixtures ════════════════════════════════════════════════════════════════════

const FIX = findFixtures(process.env.PB_FIXTURES || null);
const fixtureTest = (name, fn) => test(name, async () => { assert.ok(FIX, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)'); return fn(); });
const LBL = Object.fromEntries(Object.entries(require('./data/ofp-flightkeys-v0.3.0-baseline.json').fixtures).map(([id, b]) => [id, b.label]));
let _fk = null;
function fk() {
  if (_fk) return _fk;
  _fk = readManifest(FIX).fixtures.filter(f => f.format === 'flightkeys').map(fx => {
    const text = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8'), items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
    return { fx, lbl: LBL[fx.id], text, a: parse(v110.inputFromExtractor(text, items), v110), b: parse(mod.inputFromExtractor(text, items)) };
  }).sort((x, y) => x.lbl.localeCompare(y.lbl));
  return _fk;
}

fixtureTest('TC-183-010 all 26 vs v1.1.0: every field but dispatchContact and findings byte-identical; findings differ only in the dispatchContact INFO text', () => {
  assert.equal(fk().length, 26);
  for (const { lbl, a, b } of fk()) {
    assert.deepEqual(Object.keys(b), Object.keys(a), `${lbl}: keys, same order`);
    for (const k of Object.keys(a)) if (k !== 'dispatchContact' && k !== 'findings') assert.equal(j(b[k]), j(a[k]), `${lbl}: ${k} byte-identical`);
    assert.equal(b.findings.length, a.findings.length, `${lbl}: same number of findings`);
    const changed = b.findings.map((f, i) => i).filter(i => j(b.findings[i]) !== j(a.findings[i]));
    assert.equal(changed.length, 1, `${lbl}: exactly one finding differs`);
    const f = b.findings[changed[0]], g = a.findings[changed[0]];
    assert.deepEqual([f.level, f.field, f.code], [g.level, g.field, g.code], `${lbl}: same level and field`);
    assert.equal(f.field, 'dispatchContact');
    assert.equal(f.level, 'INFO');
    assert.ok(!b.findings.some(x => x.level === 'WARN' && x.field === 'dispatchContact'), `${lbl}: no WARN`);
  }
});

const TABLE = { W1: ['L01', 'L03', 'L04', 'L05', 'L06', 'L07', 'L08', 'L09', 'L10', 'L11', 'L12', 'L13', 'L14', 'L15', 'L16', 'L17', 'L18', 'L19'],
  W2: ['L02', 'L20', 'L21', 'L22', 'L23'], NONE: ['T1', 'T2', 'T3'] };

fixtureTest('TC-183-011 the 26: printed wording → row text: 18 "with questions", 5 "if you have any questions", 3 none, 0 other; L15 and L08 → "with questions"', () => {
  const got = { W1: [], W2: [], NONE: [] };
  for (const { lbl, b, text } of fk()) {
    const d = b.dispatchContact;
    // the printed wording: the OFP Remarks paragraph, wrapped (the fixture text is the extractor's)
    const printed = text.replace(/\s+/g, ' ');
    if (d === null) { got.NONE.push(lbl); continue; }
    assert.deepEqual(Object.keys(d), ['remark'], `${lbl}: exactly { remark }`);
    assert.ok(printed.includes(d.remark + '.'), `${lbl}: the row text is printed, followed by its full stop`);
    assert.equal(d.remark.includes('\n'), false, `${lbl}: one sentence`);
    if (d.remark === W1) got.W1.push(lbl); else if (d.remark === W2) got.W2.push(lbl); else assert.fail(`${lbl}: other wording: ${d.remark}`);
    // nothing else from the paragraph
    assert.ok(!/FlightKeys|Bulletin/.test(d.remark), `${lbl}: not the whole paragraph`);
  }
  assert.deepEqual(got, TABLE);
  const by = Object.fromEntries(fk().map(p => [p.lbl, p.b.dispatchContact]));
  assert.deepEqual(by.L15, { remark: W1 }, 'GIANT 8752');
  assert.deepEqual(by.L08, { remark: W1 }, 'GIANT 8414');
  assert.ok(/GTI8752/.test(fk().find(p => p.lbl === 'L15').text) && /GTI8414/.test(fk().find(p => p.lbl === 'L08').text), 'L15 is 8752, L08 is 8414');
  // the INFO names the OFP Remarks and the position, or says none
  for (const { lbl, b } of fk()) {
    const f = infos(b, 'dispatchContact');
    assert.equal(f.length, 1, lbl);
    if (b.dispatchContact) assert.match(f[0].message, /^Dispatch contact as printed in the OFP Remarks: 1 sentence\(s\), PDF p\d+ line \d+$/, lbl);
    else assert.equal(f[0].message, 'no sentence about contacting Dispatch in the OFP Remarks: dispatchContact null', lbl);
  }
});

fixtureTest('TC-183-012 R1: the cover-page / Company NOTAM sentences are printed on all 26 (22 short, 4 long) and decide nothing', () => {
  const longOnes = [];
  let short = 0;
  for (const { lbl, a, b, text } of fk()) {
    assert.ok(text.includes(SHORT) || text.includes(LONG), `${lbl}: the cover sentence is printed`);
    if (text.includes(LONG)) longOnes.push(lbl); else { short++; assert.ok(text.includes(SHORT), lbl); }
    // v1.1.0 read it (label, company); v1.1.1 does not
    assert.equal(a.dispatchContact.company, text.includes(LONG) ? LONG : SHORT, `${lbl}: v1.1.0 carried the Company line`);
    assert.ok(!j(b.dispatchContact).includes('preflight briefing'), `${lbl}: v1.1.1 carries no cover sentence`);
    // the Company NOTAM texts are untouched (byte-identical, TC-183-010) and still print it
    assert.ok(b.companyNotams.some(n => n.text.includes('Contact Dispatch for a preflight briefing')), `${lbl}: companyNotams still print it`);
  }
  assert.equal(short, 22);
  assert.deepEqual(longOnes, ['L20', 'L21', 'L22', 'L23']);
  assert.deepEqual(fk().filter(p => p.a.dispatchContact.label === 'REQUIRED').map(p => p.lbl).length, 22, 'v1.1.0: 22 labelled REQUIRED (the defect)');
});

// ══ TC-183-020 … 070 synthetic ═══════════════════════════════════════════════════════════════════

const dc = (o, extra) => parse(SYN(o, extra)).dispatchContact;
const para = (...ls) => ls;
const co = (...ls) => S5.notamPage(['                              COMPANY NOTAMS', '                                    GENERAL',
  '               P0110/26        2026-Mar-01 00:00 - UFN', 'CREATED:2026-Feb-28 00:00       FL: SFC - UNL', 'SUBJECT: TEST BRIEFING', 'TEXT OF THE ITEM.', ...ls]);

test('TC-183-020 SYNTHETIC R2: the sentence as printed — both forms, wrapped lines joined, the sentence only, final full stop dropped', () => {
  // the two printed forms (the default boilerplate is the W1 form)
  assert.deepEqual(dc({}), { remark: W1 });
  assert.deepEqual(dc({ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes. Contact Dispatch if you have', 'any questions.') }), { remark: W2 });
  // wrapped lines joined: the words themselves split over two lines
  assert.deepEqual(dc({ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes. Contact', 'Dispatch with questions.') }), { remark: W1 });
  assert.deepEqual(dc({ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes. Contact Dispatch', 'if you have any', 'questions.') }), { remark: W2 });
  // nothing else from the paragraph: not the lead sentences, nor a sentence after it
  const mid = dc({ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes. Contact Dispatch with', 'questions. Departure gate may change.') });
  assert.deepEqual(mid, { remark: W1 });
  // the final full stop dropped; other punctuation and the case kept
  assert.deepEqual(dc({ boiler: [], remarks: ['CONTACT DISPATCH BEFORE DEPARTURE.'] }), { remark: 'CONTACT DISPATCH BEFORE DEPARTURE' });
  assert.deepEqual(dc({ boiler: [], remarks: ['Contact Dispatch (ext. 12) before departure!'] }), { remark: 'Contact Dispatch (ext. 12) before departure!' });
  assert.deepEqual(dc({ boiler: [], remarks: ['Contact Dispatch with questions'] }), { remark: 'Contact Dispatch with questions' }, 'no final stop printed: unchanged');
  assert.deepEqual(dc({ boiler: [], remarks: ['contact dispatch before departure'] }), { remark: 'contact dispatch before departure' });
  // the sentence printed in the OFP Remarks, whatever its wording, is carried as printed (the cover sentence in the Remarks is a sentence about contacting Dispatch)
  assert.deepEqual(dc({ boiler: [], remarks: [SHORT] }), { remark: SHORT.slice(0, -1) });
  // two records, two sentences: each, in printed order, one per line; the same sentence printed again once
  assert.deepEqual(dc({ remarks: [S5.BL, 'CONTACT DISPATCH PRIOR TO DEPARTURE FOR', 'UPDATED SLOT INFORMATION.'] }),
    { remark: `${W1}\nCONTACT DISPATCH PRIOR TO DEPARTURE FOR UPDATED SLOT INFORMATION` });
  assert.deepEqual(dc({ remarks: [S5.BL, 'Contact Dispatch with questions.'] }), { remark: W1 }, 'the same sentence twice: once');
  // the INFO finding names the position
  const f = infos(parse(SYN({ remarks: [S5.BL, 'CONTACT DISPATCH PRIOR TO DEPARTURE.'] })), 'dispatchContact');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /^Dispatch contact as printed in the OFP Remarks: 2 sentence\(s\), PDF p\d+ line \d+, PDF p\d+ line \d+$/);
});

test('TC-183-030 SYNTHETIC R1: the Company NOTAM / cover sentences are ignored — alone they give null; with a remark, the remark only', () => {
  // alone: short, long, both — no remark in the OFP Remarks → null (v1.1.0: label REQUIRED / IF QUESTIONS)
  assert.equal(dc({ boiler: [] }, [co(SHORT)]), null);
  assert.equal(dc({ boiler: [] }, [co(LONG)]), null);
  assert.equal(dc({ boiler: [] }, [co(SHORT, LONG)]), null);
  // with a remark: the remark; the cover sentence neither replaces it nor is added
  assert.deepEqual(dc({}, [co(SHORT)]), { remark: W1 });
  assert.deepEqual(dc({}, [co(LONG)]), { remark: W1 }, 'a long cover sentence does not turn W1 into anything');
  assert.deepEqual(dc({ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes. Contact Dispatch if you have', 'any questions.') }, [co(SHORT)]), { remark: W2 }, 'the L02 case: short cover, W2 remark');
  // the Company NOTAMs themselves are still read, untouched
  const r = parse(SYN({ boiler: [] }, [co(SHORT)]));
  assert.ok(r.companyNotams.some(n => n.text.includes(SHORT)), 'companyNotams carries the cover sentence as printed');
});

test('TC-183-040 SYNTHETIC R3: no sentence about contacting Dispatch in the OFP Remarks → null (no row)', () => {
  assert.equal(dc({ boiler: [] }), null);
  assert.equal(dc({ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes.') }), null);
  assert.equal(dc({ boiler: [], remarks: ['DISPATCH CONTACTED CREW'] }), null, 'the word Dispatch alone');
  assert.equal(dc({ boiler: [], remarks: ['CONTACT THE DISPATCHER FOR DETAILS'] }), null, 'Dispatcher is not Dispatch');
  assert.equal(dc({ boiler: [], remarks: ['COORDINATE ANY EARLY ARRIVAL WITH DISPATCH.'] }), null, 'Dispatch without "contact"');
  assert.equal(dc({ boiler: [], remarks: ['Dispatch contact number is on the release.'] }), null, 'the words not adjacent in that order');
  // positive control: the same package with the sentence printed gives a row
  assert.notEqual(dc({ boiler: [], remarks: ['Contact Dispatch with questions.'] }), null);
  // the finding says so
  assert.deepEqual(infos(parse(SYN({ boiler: [] })), 'dispatchContact').map(f => f.message), ['no sentence about contacting Dispatch in the OFP Remarks: dispatchContact null']);
});

test('TC-183-050 SYNTHETIC R4: exactly { remark }; no label, text or company; the same whatever the cover prints', () => {
  for (const [o, extra] of [[{}, undefined], [{}, [co(SHORT)]], [{}, [co(LONG)]], [{ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes. Contact Dispatch if you have', 'any questions.') }, [co(SHORT, LONG)]]]) {
    const d = dc(o, extra);
    assert.deepEqual(Object.keys(d), ['remark']);
    assert.ok(!/REQUIRED|IF QUESTIONS/.test(j(d)), 'no classification word');
    assert.equal('label' in d || 'text' in d || 'company' in d, false);
  }
  // identical with and without a cover sentence
  assert.equal(j(dc({})), j(dc({}, [co(SHORT)])));
  assert.equal(j(dc({})), j(dc({}, [co(LONG)])));
  // NEGATIVE: v1.1.0's shape had them
  assert.deepEqual(Object.keys(parse(SYN({}, [co(SHORT)]), v110).dispatchContact), ['label', 'text', 'company', 'remark']);
});

test('TC-183-060 SYNTHETIC R5: "Contact Dispatch" inside a NOTAM body is not a Dispatch remark', () => {
  const body = ['IF LATT MESSAGE IS NOT RECEIVED, CONTACT DISPATCH.', 'CONTACT DISPATCH IF TAF DOES NOT COVER ETA.'];
  assert.equal(dc({ boiler: [] }, [co(...body)]), null, 'only in a Company NOTAM body → null');
  assert.deepEqual(dc({}, [co(...body)]), { remark: W1 }, 'with the OFP remark: the remark only');
  // the NOTAM text stays in companyNotams as printed
  const r = parse(SYN({ boiler: [] }, [co(...body)]));
  assert.ok(r.companyNotams.some(n => n.text.includes('IF LATT MESSAGE IS NOT RECEIVED, CONTACT DISPATCH.')), 'the NOTAM text is untouched');
  // the same words as an OFP remark ARE a Dispatch remark (positive control)
  assert.deepEqual(dc({ boiler: [], remarks: ['IF LATT MESSAGE IS NOT RECEIVED, CONTACT DISPATCH.'] }), { remark: 'IF LATT MESSAGE IS NOT RECEIVED, CONTACT DISPATCH' });
});

test('TC-183-070 SYNTHETIC NEGATIVE controls: v1.1.0 on the same inputs labels from the cover sentence (the defect); v1.1.1 does not', () => {
  const a = parse(SYN({}, [co(SHORT)]), v110).dispatchContact;
  assert.equal(a.label, 'REQUIRED', 'v1.1.0: W1 remark + short cover sentence → REQUIRED');
  assert.equal(parse(SYN({}, [co(LONG)]), v110).dispatchContact.label, 'IF QUESTIONS');
  assert.equal(parse(SYN({ boiler: [] }, [co(SHORT)]), v110).dispatchContact.label, 'REQUIRED', 'v1.1.0: the cover sentence alone made a row (T1–T3)');
  assert.deepEqual(dc({}, [co(SHORT)]), { remark: W1 });
  assert.equal(dc({ boiler: [] }, [co(SHORT)]), null);
});

test('TC-183-090 fixtures missing → the fixture tests FAIL (never skip)', () => {
  assert.equal(findFixtures('/nonexistent/path/xyz'), findFixtures(null), 'a wrong explicit path falls back to the same search');
  const miss = fixtureTest.toString();
  assert.match(miss, /assert\.ok\(FIX,/);
  assert.ok(!/skip/i.test(miss));
});
