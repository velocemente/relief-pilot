'use strict';
/**
 * TC-183 — FlightKeys OFP parser v1.1.1 (DEF-013 module PR; Exec rulings R1–R5, O-C, O-D of 23 Nov, amended the same
 * day by R2a–R2e and R4: the category, and the negative sentence ignored). The Dispatch contact comes from the OFP Remarks only: dispatchContact =
 * { category: 'REQUIRED' | 'SUGGESTION', remark } — ONE Dispatch sentence as printed (wrapped lines joined, final full stop
 * dropped, nothing else from the paragraph) — or null. Built into index.html by the DEF-013 integration PR: moved from
 * rules/ofp-flightkeys-next to rules/ofp-flightkeys (bytes unchanged); v1.1.0 left rules/ (frozen copy
 * test/oracle/ofp-flightkeys-v1.1.0.js). The display is TC-184.
 *
 *   TC-183-001  identity: v1.1.1, contract 2.5, key ofp-flightkeys (file, SHA-256; was ofp-flightkeys-next); v1.1.0
 *               frozen in test/oracle (SHA-256); no *-next key; the other modules as pinned; a changed byte is
 *               caught (negative)
 *   TC-183-002  built in: index.html carries v1.1.1 once and no byte-run of v1.1.0; build = index.html; labels 1.10.0
 *   TC-183-003  the code differs from v1.1.0 only where declared: every top-level declaration byte-identical
 *               (comments aside) except RULESET_VERSION and _readDispatchContact; 3 new, 2 removed; PATTERNS and
 *               the schema lists identical; validateSchema() valid
 *   TC-183-010  all 26 vs v1.1.0: every field but dispatchContact and findings byte-identical (companyNotams, with the
 *               cover sentences as printed, included); findings = v1.1.0's with exactly one changed text per package
 *               (the dispatchContact INFO), same level, field, order, count
 *   TC-183-011  the 26: printed wording → category and row text: 18 SUGGESTION "Contact Dispatch with questions", 5
 *               SUGGESTION "Contact Dispatch if you have any questions", 3 null (T1–T3), 0 REQUIRED, 0 other; L15
 *               (GIANT 8752) and L08 (GIANT 8414) → SUGGESTION "…with questions"
 *   TC-183-012  the cover-page / Company NOTAM sentences are printed on all 26 (22 short, 4 long) and decide nothing (R1)
 *   TC-183-020  SYNTHETIC R2 / R2d: the kept sentence as printed — wrapped lines joined (also inside the words "Contact
 *               Dispatch"); the sentence only, not the paragraph; final full stop dropped, other punctuation and case kept
 *   TC-183-021  SYNTHETIC R2a: REQUIRED ("Contact Dispatch", "Call Dispatch", "Contact Dispatch before departure", any case,
 *               a condition other than questions) and SUGGESTION (with questions / if you have any questions) — positive
 *               and negative for each
 *   TC-183-022  SYNTHETIC R2b: both categories printed → only the REQUIRED sentence, in either printed order, in one
 *               paragraph or in two records; negative: no SUGGESTION text in the output
 *   TC-183-023  SYNTHETIC R2c: two or more of the same category → only the first printed (REQUIRED and SUGGESTION);
 *               the same sentence printed again once; negative: the second is not carried, not even on another line
 *   TC-183-024  SYNTHETIC R2e: a sentence telling the crew NOT to contact or call Dispatch is ignored — alone → null;
 *               negative + REQUIRED → REQUIRED; negative + SUGGESTION → SUGGESTION; both categories + negative →
 *               REQUIRED; a negative counts for neither R2b nor R2c; negatives that are NOT negatives ("Do not hesitate
 *               to contact Dispatch", "If you do not have the release, contact Dispatch") stay Dispatch sentences
 *   TC-183-025  SYNTHETIC R2e fix round (gate NO-GO on d383779): the negation is recognised whatever words sit between it
 *               and "Dispatch" — every sentence of the Exec's list 1 ("Do not contact or call Dispatch", "Do not call or
 *               contact Dispatch", "Crews are not to contact Dispatch", "Do not attempt to contact Dispatch", …) is ignored,
 *               plain, wrapped at every position, in upper and lower case; list 2 (a negation that belongs to a condition:
 *               "If LATT message is not received, contact Dispatch", …) stays REQUIRED, plain, wrapped, any case; list 3 (mixed:
 *               "Do not contact or call Dispatch. Contact Dispatch with questions." → SUGGESTION); a negative never outranks
 *               or replaces a real sentence (R2b / R2c)
 *   TC-183-030  SYNTHETIC R1: Company NOTAM short / long sentence with no remark → null; with a remark → the remark only
 *   TC-183-040  SYNTHETIC R3: no sentence in the OFP Remarks → null (several negatives)
 *   TC-183-050  SYNTHETIC R4: exactly { category, remark }; no label / text / company; the same output whatever the cover prints
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
const NEW_FILE = path.join(RULES, MANIFEST['ofp-flightkeys'].file);
const OLD_FILE = path.join(ROOT, 'test', 'oracle', 'ofp-flightkeys-v1.1.0.js');
const NEW_SRC  = fs.readFileSync(NEW_FILE, 'utf8');
const OLD_SRC  = fs.readFileSync(OLD_FILE, 'utf8');
const mod      = require(NEW_FILE);    // v1.1.1
const v110     = require(OLD_FILE);    // v1.1.0, frozen (built in until the DEF-013 integration)
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
const SUG = remark => ({ category: 'SUGGESTION', remark }), REQ = remark => ({ category: 'REQUIRED', remark });
const SHORT = 'Contact Dispatch for a preflight briefing.', LONG = 'Contact Dispatch for a preflight briefing if you have any questions.';
const LEAD = 'This OFP prepared with FlightKeys. Review Operations Bulletin';

// ══ TC-183-001 … 003 module ══════════════════════════════════════════════════════════════════════

test('TC-183-001 identity: v1.1.1, contract 2.5, under ofp-flightkeys (was ofp-flightkeys-next); v1.1.0 frozen in test/oracle; others as pinned; a changed byte is caught', () => {
  assert.deepEqual([mod.RULESET_TYPE, mod.OFP_FORMAT, mod.RULESET_VERSION, mod.SCHEMA_VERSION, mod.CONTRACT_VERSION], ['ofp', 'flightkeys', '1.1.1', 2, '2.5']);
  const e = MANIFEST['ofp-flightkeys'];
  assert.deepEqual(Object.keys(e), ['version', 'file', 'sha256']);
  assert.deepEqual([e.version, e.file], ['1.1.1', 'ofp-flightkeys/ofp-flightkeys-v1.1.1.js']);
  assert.equal(sha(fs.readFileSync(NEW_FILE)), e.sha256, 'the module file = the manifest SHA-256');
  assert.equal(e.sha256, 'dbe3ee963ed003fd462ea1cdaabcb8188ca98adfd4229c3f7ebb28dd05e1415c', 'the bytes of the module PR (#81) = the Drive master, moved unchanged');
  assert.deepEqual(fs.readdirSync(path.join(RULES, 'ofp-flightkeys')).filter(f => f.endsWith('.js')), ['ofp-flightkeys-v1.1.1.js'], 'one module file in rules/ofp-flightkeys (v1.1.0 out)');
  assert.deepEqual(NOT_BUILT_IN, [], 'no *-next key declared (DEF-013 integration)');
  assert.deepEqual(Object.keys(MANIFEST).filter(k => /-next$/.test(k)), [], 'no *-next key');
  assert.ok(!fs.existsSync(path.join(RULES, 'ofp-flightkeys-next')), 'no rules/ofp-flightkeys-next');
  // v1.1.0: frozen in test/oracle, byte for byte (the bytes of the 5f module PR, built in by the 5f display PR)
  assert.equal(v110.RULESET_VERSION, '1.1.0');
  assert.equal(sha(fs.readFileSync(OLD_FILE)), 'd2e1d7a17eea2badec40c599cd2ee5d459e9172e0b54b76b841fb6fad0691ff9', 'test/oracle/ofp-flightkeys-v1.1.0.js = v1.1.0 byte for byte');
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
    assert.ok(c.errors.some(x => /ofp-flightkeys.*does not match the manifest/.test(x)), c.errors.join('; '));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('TC-183-002 built in (DEF-013 integration): index.html carries v1.1.1 once and no byte-run of v1.1.0; build = index.html; labels 1.10.0', () => {
  assert.equal(HTML.split(NEW_SRC).length, 2, 'index.html carries v1.1.1 once, byte for byte');
  assert.ok(!HTML.includes(OLD_SRC), 'v1.1.0 is not in index.html');
  assert.ok(!HTML.includes("const RULESET_VERSION  = '1.1.0';"), 'no v1.1.0 version line');
  assert.ok(HTML.includes('_dispatchSentences'), 'the v1.1.1 Dispatch code is in index.html');
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
  assert.deepEqual(Object.keys(b).filter(k => !(k in a)).sort(), ['DISPATCH_CONDITION', 'DISPATCH_INSTRUCTION', 'DISPATCH_NEG_AFTER', 'DISPATCH_NEG_FILLER', 'DISPATCH_NEG_IDIOM', 'DISPATCH_NEG_LOOSE', 'DISPATCH_NEG_START', 'DISPATCH_NEG_STRICT', 'DISPATCH_NEG_TOKEN', 'DISPATCH_QUESTIONS', 'DISPATCH_SENTENCE', '_dispatchIsNegative', '_dispatchSentences'], 'new declarations');
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

fixtureTest('TC-183-011 the 26: printed wording → category and row text: 23 SUGGESTION (18 "with questions", 5 "if you have any questions"), 3 none, 0 REQUIRED; L15 and L08 → SUGGESTION "with questions"', () => {
  const got = { W1: [], W2: [], NONE: [] };
  for (const { lbl, b, text } of fk()) {
    const d = b.dispatchContact;
    // the printed wording: the OFP Remarks paragraph, wrapped (the fixture text is the extractor's)
    const printed = text.replace(/\s+/g, ' ');
    if (d === null) { got.NONE.push(lbl); continue; }
    assert.deepEqual(Object.keys(d), ['category', 'remark'], `${lbl}: exactly { category, remark }`);
    assert.equal(d.category, 'SUGGESTION', `${lbl}: category (0 REQUIRED on the 26)`);
    assert.ok(printed.includes(d.remark + '.'), `${lbl}: the row text is printed, followed by its full stop`);
    assert.equal(d.remark.includes('\n'), false, `${lbl}: one sentence`);
    if (d.remark === W1) got.W1.push(lbl); else if (d.remark === W2) got.W2.push(lbl); else assert.fail(`${lbl}: other wording: ${d.remark}`);
    // nothing else from the paragraph
    assert.ok(!/FlightKeys|Bulletin/.test(d.remark), `${lbl}: not the whole paragraph`);
  }
  assert.deepEqual(got, TABLE);
  const by = Object.fromEntries(fk().map(p => [p.lbl, p.b.dispatchContact]));
  assert.deepEqual(by.L15, SUG(W1), 'GIANT 8752');
  assert.deepEqual(by.L08, SUG(W1), 'GIANT 8414');
  assert.ok(/GTI8752/.test(fk().find(p => p.lbl === 'L15').text) && /GTI8414/.test(fk().find(p => p.lbl === 'L08').text), 'L15 is 8752, L08 is 8414');
  // the INFO names the OFP Remarks and the position, or says none
  for (const { lbl, b } of fk()) {
    const f = infos(b, 'dispatchContact');
    assert.equal(f.length, 1, lbl);
    if (b.dispatchContact) assert.match(f[0].message, /^Dispatch contact as printed in the OFP Remarks: SUGGESTION, PDF p\d+ line \d+; 1 Dispatch sentence\(s\) read, 1 kept$/, lbl);
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
const only = (...remarks) => dc({ boiler: [], remarks });                  // OFP Remarks that are exactly these lines (one record)
const recs = (...rs) => dc({ boiler: [], remarks: rs.flatMap((r, i) => (i ? [S5.BL, r] : [r])) });   // one record per entry

test('TC-183-020 SYNTHETIC R2 / R2d: the kept sentence as printed — wrapped lines joined, the sentence only, final full stop dropped', () => {
  // the two printed forms (the default boilerplate is the W1 form)
  assert.deepEqual(dc({}), SUG(W1));
  assert.deepEqual(dc({ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes. Contact Dispatch if you have', 'any questions.') }), SUG(W2));
  // wrapped lines joined: the words themselves split over two lines
  assert.deepEqual(dc({ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes. Contact', 'Dispatch with questions.') }), SUG(W1));
  assert.deepEqual(dc({ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes. Contact Dispatch', 'if you have any', 'questions.') }), SUG(W2));
  assert.deepEqual(only('Contact', 'Dispatch before', 'departure.'), REQ('Contact Dispatch before departure'), 'a REQUIRED sentence wrapped over three lines');
  // nothing else from the paragraph: not the lead sentences, nor a sentence after it
  assert.deepEqual(dc({ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes. Contact Dispatch with', 'questions. Departure gate may change.') }), SUG(W1));
  // the final full stop dropped; other punctuation and the case kept
  assert.deepEqual(only('CONTACT DISPATCH BEFORE DEPARTURE.'), REQ('CONTACT DISPATCH BEFORE DEPARTURE'));
  assert.deepEqual(only('Contact Dispatch (ext. 12) before departure!'), REQ('Contact Dispatch (ext. 12) before departure!'));
  assert.deepEqual(only('Contact Dispatch with questions'), SUG(W1), 'no final stop printed: unchanged');
  assert.deepEqual(only('contact dispatch before departure'), REQ('contact dispatch before departure'));
  // the cover sentence printed in the OFP Remarks is a REQUIRED Dispatch sentence, as printed
  assert.deepEqual(only(SHORT), REQ(SHORT.slice(0, -1)));
  // the INFO finding: category, position, how many read and kept
  const f = infos(parse(SYN({ remarks: [S5.BL, 'CONTACT DISPATCH PRIOR TO DEPARTURE.'] })), 'dispatchContact');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /^Dispatch contact as printed in the OFP Remarks: REQUIRED, PDF p\d+ line \d+; 2 Dispatch sentence\(s\) read, 1 kept$/);
});

test('TC-183-021 SYNTHETIC R2a: REQUIRED = an instruction to contact or call Dispatch; SUGGESTION = contact only if there are questions', () => {
  // REQUIRED (positive)
  for (const t of ['Contact Dispatch.', 'Call Dispatch.', 'Contact Dispatch before departure.', 'CALL DISPATCH BEFORE ENGINE START.', 'contact dispatch',
    'Contact Dispatch for a preflight briefing.', 'Contact Dispatch if the TAF does not cover ETA.']) {
    assert.deepEqual(only(t), REQ(t.replace(/\.$/, '')), `REQUIRED: ${t}`);
  }
  // SUGGESTION (positive)
  for (const t of ['Contact Dispatch with questions.', 'Contact Dispatch if you have any questions.', 'Call Dispatch if you have a question.',
    'CONTACT DISPATCH WITH ANY QUESTIONS.', 'Contact Dispatch for a preflight briefing if you have any questions.']) {
    assert.deepEqual(only(t), SUG(t.replace(/\.$/, '')), `SUGGESTION: ${t}`);
  }
  // NEGATIVES: a REQUIRED sentence is never a SUGGESTION and the other way round; the word alone is not a category
  assert.notEqual(only('Contact Dispatch before departure.').category, 'SUGGESTION');
  assert.notEqual(only('Contact Dispatch with questions.').category, 'REQUIRED');
  assert.notEqual(only('Call Dispatch.').category, 'SUGGESTION');
  // "question" in another sentence of the paragraph does not make a REQUIRED sentence a SUGGESTION
  assert.deepEqual(only('Contact Dispatch before departure. Crew questions go to the chief pilot.'), REQ('Contact Dispatch before departure'));
  assert.deepEqual(only('Any questions? Contact Dispatch before departure.'), REQ('Contact Dispatch before departure'));
  // the category does not depend on the cover / Company sentence (R1)
  assert.deepEqual(dc({ boiler: [], remarks: ['Contact Dispatch before departure.'] }, [co(SHORT)]), REQ('Contact Dispatch before departure'));
  assert.deepEqual(dc({}, [co(SHORT)]), SUG(W1));
  // not a Dispatch sentence: no category, no row (negatives; "call" or "contact" alone, Dispatcher)
  assert.equal(only('CALL THE DISPATCHER FOR DETAILS.'), null);
  assert.equal(only('Call ground control.'), null);
  assert.equal(only('Contact the chief pilot with questions.'), null);
});

test('TC-183-022 SYNTHETIC R2b: both categories printed → only the REQUIRED sentence is kept', () => {
  // one paragraph: SUGGESTION first, REQUIRED second (and the other way round)
  assert.deepEqual(only('Contact Dispatch with questions. Contact Dispatch before departure.'), REQ('Contact Dispatch before departure'));
  assert.deepEqual(only('Contact Dispatch before departure. Contact Dispatch with questions.'), REQ('Contact Dispatch before departure'));
  // wrapped lines, one paragraph
  assert.deepEqual(only('Contact Dispatch if you have', 'any questions. Call', 'Dispatch before departure.'), REQ('Call Dispatch before departure'));
  // two records (the FlightKeys boilerplate and a remark of its own), either order
  assert.deepEqual(dc({ remarks: [S5.BL, 'CONTACT DISPATCH PRIOR TO DEPARTURE FOR', 'UPDATED SLOT INFORMATION.'] }), REQ('CONTACT DISPATCH PRIOR TO DEPARTURE FOR UPDATED SLOT INFORMATION'));
  assert.deepEqual(recs('Contact Dispatch before departure.', 'Contact Dispatch with questions.'), REQ('Contact Dispatch before departure'));
  assert.deepEqual(recs('Contact Dispatch with questions.', 'Contact Dispatch before departure.'), REQ('Contact Dispatch before departure'));
  // NEGATIVE: the SUGGESTION text is nowhere in the output (not carried, not on another line, no second key)
  for (const d of [only('Contact Dispatch with questions. Contact Dispatch before departure.'), recs('Contact Dispatch with questions.', 'Call Dispatch.')]) {
    assert.deepEqual(Object.keys(d), ['category', 'remark']);
    assert.ok(!/questions/i.test(d.remark) && !d.remark.includes('\n'), 'one REQUIRED sentence only');
  }
  // the INFO says how many were read and that one was kept
  assert.match(infos(parse(SYN({ boiler: [], remarks: ['Contact Dispatch with questions. Contact Dispatch before departure.'] })), 'dispatchContact')[0].message, /REQUIRED, PDF p\d+ line \d+; 2 Dispatch sentence\(s\) read, 1 kept$/);
  // control: SUGGESTION alone stays SUGGESTION (nothing REQUIRED to prefer)
  assert.deepEqual(only('Contact Dispatch with questions.'), SUG(W1));
});

test('TC-183-023 SYNTHETIC R2c: two or more of the same category → only the first printed is kept', () => {
  // REQUIRED x2, x3 (one paragraph, two records, wrapped)
  assert.deepEqual(only('Contact Dispatch before departure. Call Dispatch on arrival.'), REQ('Contact Dispatch before departure'));
  assert.deepEqual(only('Call Dispatch on arrival. Contact Dispatch before departure.'), REQ('Call Dispatch on arrival'));
  assert.deepEqual(only('Contact Dispatch. Call Dispatch. Contact Dispatch again.'), REQ('Contact Dispatch'));
  assert.deepEqual(recs('Call Dispatch on arrival.', 'Contact Dispatch before departure.'), REQ('Call Dispatch on arrival'));
  assert.deepEqual(only('Contact Dispatch', 'before departure. Call Dispatch', 'on arrival.'), REQ('Contact Dispatch before departure'));
  // SUGGESTION x2: the first printed — the two printed wordings, in both orders
  assert.deepEqual(only('Contact Dispatch with questions. Contact Dispatch if you have any questions.'), SUG(W1));
  assert.deepEqual(only('Contact Dispatch if you have any questions. Contact Dispatch with questions.'), SUG(W2));
  assert.deepEqual(recs('Contact Dispatch if you have any questions.', 'Contact Dispatch with questions.'), SUG(W2));
  // the same sentence printed twice: once
  assert.deepEqual(recs('Contact Dispatch with questions.', 'Contact Dispatch with questions.'), SUG(W1));
  // R2b with repeats: the first REQUIRED wins over later REQUIRED and over every SUGGESTION
  assert.deepEqual(only('Contact Dispatch with questions. Call Dispatch on arrival. Contact Dispatch before departure. Contact Dispatch if you have any questions.'), REQ('Call Dispatch on arrival'));
  // NEGATIVE: the second sentence is not carried, not even on another line
  const d = only('Contact Dispatch before departure. Call Dispatch on arrival.');
  assert.ok(!/arrival/.test(d.remark) && !d.remark.includes('\n'));
  assert.deepEqual(Object.keys(d), ['category', 'remark']);
  assert.match(infos(parse(SYN({ boiler: [], remarks: ['Contact Dispatch before departure. Call Dispatch on arrival.'] })), 'dispatchContact')[0].message, /2 Dispatch sentence\(s\) read, 1 kept$/);
});

test('TC-183-024 SYNTHETIC R2e: a sentence telling the crew NOT to contact or call Dispatch is ignored — no category, no row, not counted for R2b or R2c', () => {
  const NEGS = ['Do not contact Dispatch.', 'DO NOT CALL DISPATCH.', "Don't contact Dispatch.", 'Don’t call Dispatch.', 'Please do not contact Dispatch.',
    'Do not contact Dispatch before departure.', 'You must not contact Dispatch.', 'Never contact Dispatch.', 'No need to contact Dispatch.', 'No need to call Dispatch.',
    'You do not need to contact Dispatch.', 'It is not necessary to contact Dispatch.', 'Contact Dispatch is not required.', 'Contact Dispatch not required.',
    'Dispatch contact not required.', 'Dispatch contact is no longer necessary.', 'Dispatch contact is not required.'];
  // each negative alone: no category, no row (null)
  for (const t of NEGS) assert.equal(only(t), null, `negative alone: ${t}`);
  assert.equal(only('Do not', 'contact Dispatch.'), null, 'wrapped negative');
  assert.equal(only('No need to contact', 'Dispatch.'), null, 'wrapped negative, words split');
  // negative + REQUIRED: the REQUIRED sentence, either order, one paragraph or two records, whatever the negative
  for (const n of NEGS) {
    assert.deepEqual(only(`${n} Contact Dispatch before departure.`), REQ('Contact Dispatch before departure'), `neg + REQUIRED: ${n}`);
    assert.deepEqual(only(`Contact Dispatch before departure. ${n}`), REQ('Contact Dispatch before departure'), `REQUIRED + neg: ${n}`);
  }
  assert.deepEqual(recs('Do not contact Dispatch.', 'Call Dispatch before departure.'), REQ('Call Dispatch before departure'));
  assert.deepEqual(recs('Call Dispatch before departure.', 'No need to call Dispatch.'), REQ('Call Dispatch before departure'));
  // negative + SUGGESTION: the SUGGESTION sentence (the negative neither wins nor removes it)
  for (const n of NEGS) {
    assert.deepEqual(only(`${n} Contact Dispatch with questions.`), SUG(W1), `neg + SUGGESTION: ${n}`);
    assert.deepEqual(only(`Contact Dispatch if you have any questions. ${n}`), SUG(W2), `SUGGESTION + neg: ${n}`);
  }
  assert.deepEqual(recs('Do not contact Dispatch.', 'Contact Dispatch with questions.'), SUG(W1));
  // negative + both categories: R2b unchanged (the REQUIRED sentence)
  assert.deepEqual(only('Contact Dispatch with questions. Do not contact Dispatch. Call Dispatch before departure.'), REQ('Call Dispatch before departure'));
  assert.deepEqual(only('Do not call Dispatch. Contact Dispatch with questions. Contact Dispatch before departure.'), REQ('Contact Dispatch before departure'));
  // R2c unchanged: a negative between two sentences of one category neither counts nor changes "the first printed"
  assert.deepEqual(only('Call Dispatch on arrival. Do not contact Dispatch. Contact Dispatch before departure.'), REQ('Call Dispatch on arrival'));
  assert.deepEqual(only('Do not contact Dispatch. Call Dispatch on arrival. Contact Dispatch before departure.'), REQ('Call Dispatch on arrival'));
  assert.deepEqual(only('Contact Dispatch with questions. No need to call Dispatch. Contact Dispatch if you have any questions.'), SUG(W1));
  // a negative never becomes the kept sentence and is never carried, not even on another line
  const d = only('Do not contact Dispatch. Contact Dispatch before departure. No need to call Dispatch.');
  assert.deepEqual(Object.keys(d), ['category', 'remark']);
  assert.ok(!/not|no need/i.test(d.remark) && !d.remark.includes('\n'));
  // the boilerplate paragraph with a negative remark of its own: the boilerplate sentence
  assert.deepEqual(dc({ remarks: [S5.BL, 'Do not contact Dispatch.'] }), SUG(W1));
  // NEGATIVE controls: sentences with "not" that are NOT a negative instruction stay Dispatch sentences
  assert.deepEqual(only('Do not hesitate to contact Dispatch.'), REQ('Do not hesitate to contact Dispatch'));
  assert.deepEqual(only('Do not forget to call Dispatch.'), REQ('Do not forget to call Dispatch'));
  assert.deepEqual(only('If you do not have the release, contact Dispatch.'), REQ('If you do not have the release, contact Dispatch'));
  assert.deepEqual(only('Contact Dispatch if you do not understand.'), REQ('Contact Dispatch if you do not understand'));
  assert.deepEqual(only('Contact Dispatch if you do not have any questions.'), SUG('Contact Dispatch if you do not have any questions'));
  assert.deepEqual(only('Not all stations answer. Contact Dispatch before departure.'), REQ('Contact Dispatch before departure'));
  // not a Dispatch remark at all, with or without a negative: no row
  assert.equal(only('Do not contact the chief pilot.'), null);
  // the INFO finding: the ignored negatives are counted, not read
  assert.match(infos(parse(SYN({ boiler: [], remarks: ['Do not contact Dispatch. Contact Dispatch before departure.'] })), 'dispatchContact')[0].message,
    /^Dispatch contact as printed in the OFP Remarks: REQUIRED, PDF p\d+ line \d+; 1 Dispatch sentence\(s\) read, 1 kept \(1 negative sentence\(s\) ignored\)$/);
  assert.deepEqual(infos(parse(SYN({ boiler: [], remarks: ['Do not contact Dispatch.'] })), 'dispatchContact').map(f => f.message),
    ['no sentence about contacting Dispatch in the OFP Remarks (1 negative sentence(s) ignored): dispatchContact null']);
  // NEGATIVE control: with no negative the INFO has no such suffix
  assert.ok(!/negative/.test(infos(parse(SYN({ boiler: [], remarks: ['Contact Dispatch before departure.'] })), 'dispatchContact')[0].message));
});

// every way of wrapping a sentence over two printed lines (a split at each space)
const wraps = t => { const w = t.split(' '); return w.slice(1).map((_, i) => [w.slice(0, i + 1).join(' '), w.slice(i + 1).join(' ')]); };

test('TC-183-025 SYNTHETIC R2e fix round: the negation is recognised whatever words sit between it and "Dispatch"; a negation that belongs to a condition does not make the sentence negative', () => {
  // 1. must be ignored (no row) — the Exec's list, plus the same family
  const NEG1 = ['Do not contact Dispatch', 'Do not call Dispatch', 'Do not contact or call Dispatch', 'Do not call or contact Dispatch',
    'Crews are not to contact Dispatch', 'Do not attempt to contact Dispatch', 'No need to contact Dispatch', 'Never call Dispatch', 'Dispatch contact not required',
    // the same family
    'Do not contact and call Dispatch', 'Crews are not to contact or call Dispatch', 'You are not required to call Dispatch', 'Do not try to call or contact Dispatch',
    'There is no need to call Dispatch', 'Dispatch contact is no longer required', 'Please do not contact or call Dispatch', 'Do not, under any circumstances, call Dispatch',
    'Before departure do not contact Dispatch', 'If LATT message is not received, do not call Dispatch', "Don't contact or call Dispatch", 'Do not contact or call Dispatch before departure'];
  for (const t of NEG1) {
    for (const v of [t, t.toUpperCase(), t.toLowerCase()]) {
      assert.equal(only(`${v}.`), null, `ignored: ${v}`);
      assert.equal(only(v), null, `ignored (no final stop): ${v}`);
      for (const [a, b] of wraps(`${v}.`)) assert.equal(only(a, b), null, `ignored, wrapped: ${a} / ${b}`);
    }
    // not a row, not counted: with a real sentence on either side the real sentence is the result (R2b / R2c unchanged)
    assert.deepEqual(only(`${t}. Contact Dispatch before departure.`), REQ('Contact Dispatch before departure'), `neg + REQUIRED: ${t}`);
    assert.deepEqual(only(`Contact Dispatch before departure. ${t}.`), REQ('Contact Dispatch before departure'), `REQUIRED + neg: ${t}`);
    assert.deepEqual(only(`${t}. Contact Dispatch with questions.`), SUG(W1), `neg + SUGGESTION: ${t}`);
    assert.deepEqual(only(`Contact Dispatch if you have any questions. ${t}.`), SUG(W2), `SUGGESTION + neg: ${t}`);
    assert.deepEqual(only(`Contact Dispatch with questions. ${t}. Call Dispatch on arrival.`), REQ('Call Dispatch on arrival'), `both categories + neg: ${t}`);
    assert.deepEqual(recs(`${t}.`, 'Contact Dispatch with questions.'), SUG(W1), `two records: ${t}`);
  }
  // 2. a negation that belongs to a condition: REQUIRED, as printed
  const COND = ['If LATT message is not received, contact Dispatch', 'Contact Dispatch if the TAF does not cover ETA', 'If no release is received, call Dispatch',
    // the same family
    'If the LATT message is not received contact Dispatch', 'When the release is not available, call Dispatch', 'Unless the crew has not been briefed, contact Dispatch',
    'LATT not received, contact Dispatch', 'Call Dispatch if the weather does not improve', 'If you do not have the release, contact Dispatch',
    'Contact Dispatch if you do not understand', 'Do not hesitate to contact Dispatch', 'Do not forget to call Dispatch', 'Contact Dispatch if the ATIS is not available'];
  for (const t of COND) {
    for (const v of [t, t.toUpperCase(), t.toLowerCase()]) {
      assert.deepEqual(only(`${v}.`), REQ(v), `REQUIRED: ${v}`);
      for (const [a, b] of wraps(`${v}.`)) assert.deepEqual(only(a, b), REQ(v), `REQUIRED, wrapped: ${a} / ${b}`);
    }
    // a negative beside it does not remove it, and it outranks a SUGGESTION (R2b)
    assert.deepEqual(only(`${t}. Do not contact or call Dispatch.`), REQ(t), `REQUIRED + neg: ${t}`);
    assert.deepEqual(only(`Contact Dispatch with questions. ${t}. Do not call Dispatch.`), REQ(t), `SUGGESTION + REQUIRED + neg: ${t}`);
  }
  // 3. mixed: the negative is ignored, the real sentence is the result
  assert.deepEqual(only('Do not contact or call Dispatch. Contact Dispatch with questions.'), SUG(W1));
  assert.deepEqual(only('Contact Dispatch with questions. Do not contact or call Dispatch.'), SUG(W1));
  assert.deepEqual(only('Do not contact or', 'call Dispatch. Contact Dispatch with', 'questions.'), SUG(W1), 'mixed, wrapped');
  assert.deepEqual(only('DO NOT CONTACT OR CALL DISPATCH. CONTACT DISPATCH WITH QUESTIONS.'), SUG('CONTACT DISPATCH WITH QUESTIONS'), 'mixed, upper case');
  assert.deepEqual(recs('Do not contact or call Dispatch.', 'Contact Dispatch with questions.'), SUG(W1), 'mixed, two records');
  assert.deepEqual(dc({ remarks: [S5.BL, 'Do not contact or call Dispatch.'] }), SUG(W1), 'boilerplate + a negative remark of its own: the boilerplate sentence');
  // the negative is counted, never read; the INFO says so
  assert.match(infos(parse(SYN({ boiler: [], remarks: ['Do not contact or call Dispatch. Contact Dispatch with questions.'] })), 'dispatchContact')[0].message,
    /^Dispatch contact as printed in the OFP Remarks: SUGGESTION, PDF p\d+ line \d+; 1 Dispatch sentence\(s\) read, 1 kept \(1 negative sentence\(s\) ignored\)$/);
  // NEGATIVE controls: a sentence without a negation, and a negation without Dispatch, are not changed by the rule
  assert.deepEqual(only('Contact or call Dispatch before departure.'), REQ('Contact or call Dispatch before departure'));
  assert.deepEqual(only('Call or contact Dispatch with questions.'), SUG('Call or contact Dispatch with questions'));
  assert.equal(only('Do not contact or call the chief pilot.'), null);
  assert.equal(only('Do not contact or call the Dispatcher.'), null);
});

test('TC-183-030 SYNTHETIC R1: the Company NOTAM / cover sentences are ignored — alone they give null; with a remark, the remark only', () => {
  // alone: short, long, both — no remark in the OFP Remarks → null (v1.1.0: label REQUIRED / IF QUESTIONS)
  assert.equal(dc({ boiler: [] }, [co(SHORT)]), null);
  assert.equal(dc({ boiler: [] }, [co(LONG)]), null);
  assert.equal(dc({ boiler: [] }, [co(SHORT, LONG)]), null);
  // with a remark: the remark; the cover sentence neither replaces it, nor changes its category, nor is added
  assert.deepEqual(dc({}, [co(SHORT)]), SUG(W1));
  assert.deepEqual(dc({}, [co(LONG)]), SUG(W1), 'a long cover sentence does not change W1');
  assert.deepEqual(dc({ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes. Contact Dispatch if you have', 'any questions.') }, [co(SHORT)]), SUG(W2), 'the L02 case: short cover, W2 remark');
  assert.deepEqual(dc({ boiler: [], remarks: ['Contact Dispatch before departure.'] }, [co(SHORT, LONG)]), REQ('Contact Dispatch before departure'));
  // the Company NOTAMs themselves are still read, untouched
  const r = parse(SYN({ boiler: [] }, [co(SHORT)]));
  assert.ok(r.companyNotams.some(n => n.text.includes(SHORT)), 'companyNotams carries the cover sentence as printed');
});

test('TC-183-040 SYNTHETIC R3: no sentence about contacting Dispatch in the OFP Remarks → null (no row)', () => {
  assert.equal(dc({ boiler: [] }), null);
  assert.equal(dc({ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes.') }), null);
  assert.equal(only('DISPATCH CONTACTED CREW'), null, 'the word Dispatch alone');
  assert.equal(only('CONTACT THE DISPATCHER FOR DETAILS'), null, 'Dispatcher is not Dispatch');
  assert.equal(only('COORDINATE ANY EARLY ARRIVAL WITH DISPATCH.'), null, 'Dispatch without "contact" or "call"');
  assert.equal(only('Dispatch contact number is on the release.'), null, 'the words not adjacent in that order');
  // positive control: the same package with the sentence printed gives a row
  assert.notEqual(only('Contact Dispatch with questions.'), null);
  // the finding says so
  assert.deepEqual(infos(parse(SYN({ boiler: [] })), 'dispatchContact').map(f => f.message), ['no sentence about contacting Dispatch in the OFP Remarks: dispatchContact null']);
});

test('TC-183-050 SYNTHETIC R4: exactly { category, remark }; no label, text or company; the same whatever the cover prints', () => {
  for (const [o, extra] of [[{}, undefined], [{}, [co(SHORT)]], [{}, [co(LONG)]], [{ boiler: para(LEAD, 'for FlightKeys OFP and procedure changes. Contact Dispatch if you have', 'any questions.') }, [co(SHORT, LONG)]],
    [{ boiler: [], remarks: ['Call Dispatch before departure.'] }, [co(SHORT)]]]) {
    const d = dc(o, extra);
    assert.deepEqual(Object.keys(d), ['category', 'remark']);
    assert.ok(['REQUIRED', 'SUGGESTION'].includes(d.category));
    assert.equal(typeof d.remark, 'string');
    assert.equal('label' in d || 'text' in d || 'company' in d, false);
    assert.ok(!/IF QUESTIONS/.test(j(d)), 'no v1.1.0 label word');
  }
  // identical with and without a cover sentence
  assert.equal(j(dc({})), j(dc({}, [co(SHORT)])));
  assert.equal(j(dc({})), j(dc({}, [co(LONG)])));
  // NEGATIVE: v1.1.0's shape had label, text, company
  assert.deepEqual(Object.keys(parse(SYN({}, [co(SHORT)]), v110).dispatchContact), ['label', 'text', 'company', 'remark']);
});

test('TC-183-060 SYNTHETIC R5: "Contact Dispatch" inside a NOTAM body is not a Dispatch remark', () => {
  const body = ['IF LATT MESSAGE IS NOT RECEIVED, CONTACT DISPATCH.', 'CONTACT DISPATCH IF TAF DOES NOT COVER ETA.', 'CALL DISPATCH.'];
  assert.equal(dc({ boiler: [] }, [co(...body)]), null, 'only in a Company NOTAM body → null');
  assert.deepEqual(dc({}, [co(...body)]), SUG(W1), 'with the OFP remark: the remark only (a NOTAM REQUIRED-looking sentence does not outrank it)');
  // the NOTAM text stays in companyNotams as printed
  const r = parse(SYN({ boiler: [] }, [co(...body)]));
  assert.ok(r.companyNotams.some(n => n.text.includes('IF LATT MESSAGE IS NOT RECEIVED, CONTACT DISPATCH.')), 'the NOTAM text is untouched');
  // the same words as an OFP remark ARE a Dispatch remark (positive control)
  assert.deepEqual(only('IF LATT MESSAGE IS NOT RECEIVED, CONTACT DISPATCH.'), REQ('IF LATT MESSAGE IS NOT RECEIVED, CONTACT DISPATCH'));
});

test('TC-183-070 SYNTHETIC NEGATIVE controls: v1.1.0 on the same inputs labels from the cover sentence (the defect); v1.1.1 does not', () => {
  const a = parse(SYN({}, [co(SHORT)]), v110).dispatchContact;
  assert.equal(a.label, 'REQUIRED', 'v1.1.0: W1 remark + short cover sentence → REQUIRED');
  assert.equal(parse(SYN({}, [co(LONG)]), v110).dispatchContact.label, 'IF QUESTIONS');
  assert.equal(parse(SYN({ boiler: [] }, [co(SHORT)]), v110).dispatchContact.label, 'REQUIRED', 'v1.1.0: the cover sentence alone made a row (T1–T3)');
  assert.deepEqual(dc({}, [co(SHORT)]), SUG(W1), 'v1.1.1: SUGGESTION, from the remark');
  assert.equal(dc({ boiler: [] }, [co(SHORT)]), null);
});

test('TC-183-090 fixtures missing → the fixture tests FAIL (never skip)', () => {
  assert.equal(findFixtures('/nonexistent/path/xyz'), findFixtures(null), 'a wrong explicit path falls back to the same search');
  const miss = fixtureTest.toString();
  assert.match(miss, /assert\.ok\(FIX,/);
  assert.ok(!/skip/i.test(miss));
});
