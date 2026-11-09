'use strict';
/**
 * TC-130 — NavBlue OFP parser module (rules/ofp-navblue, v2.0.0) is the app's OFP parser, LOCKED
 *
 * The module was extracted from the app (src/ofp-parse.html and the ENR V2 helpers in
 * src/render-preflight.html) and must give IDENTICAL core fields to the parser the app runs
 * (ADR-005 §2.4 NavBlue lock, D47). This PR does not build it into index.html; the app keeps
 * its own copy until the integration PR.
 *
 *   TC-130-001  metadata present; validateSchema() valid; a broken parser object is rejected
 *   TC-130-002  rules/manifest.json: the ofp-navblue entry, its version, file and SHA-256
 *   TC-130-003  dual context: Node (module.exports), rules-loader (new Function), browser
 *               (plain script → one global OfpNavBlue); no window / DOM / storage / app state
 *               (loaded and run with a window, document and app globals that throw on access)
 *   TC-130-004  the copies: § 2–§ 10 are byte-identical to the app source except the three
 *               marked v2.0.0 edits; parseOFP, fuelK, deriveCallsign are not in the module
 *   TC-130-005  the app is unchanged: index.html is still the build of src/ + rules/, and does
 *               not carry this module (integration is a separate PR)
 *   TC-130-010  LOCK: every NavBlue/eOFP fixture, module loaded in the app's own context, the
 *               NAT parser passed in: _ofpRulesetParse and the parseNavBlue core fields equal
 *               the app's, all 57 fields, values and key order
 *   TC-130-011  LOCK: the same with the module loaded in Node, the NAT parser passed in
 *               as options.parseNatTrack
 *   TC-130-012  contract: every Appendix B extension present and empty on every fixture
 *               (top level, airportData[icao], ddgItems[i]); findings exactly the one INFO
 *               (NAT parser passed in) or that INFO plus "NAT parser not supplied" (not passed)
 *   TC-130-013  NAT hook on the fixtures: without a NAT parser natTrack is null (and only
 *               natTrack and findings differ); with it, the app's track is returned
 *   TC-130-014  synthetic: empty / non-string input → null; no state carried between calls;
 *               no two results share an extension array
 *   TC-130-015  NAT hook: the parser is used only when passed in as options.parseNatTrack;
 *               never looked up on window (a window that throws on access, and a window that
 *               publishes parseNatTrack, are both left alone); not passed → null + the INFO
 *   TC-130-016  the masters' embedded self-test assertions (SPEC v1.0 #1–9, v1.1 #10–14) hold;
 *               slot time chain, positive and negative
 *   TC-130-020  the gate bites: a module with one rule broken fails the lock
 *   TC-130-030  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Fixtures: PB_FIXTURES (authoritative when set), else ./fixtures or ../pilotbrief-fixtures.
 * Messages name fixture ids and field paths only; values are shown as type/length/hash, never
 * as fixture text.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const vm     = require('vm');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { loadApp } = require('../harness');
const { findFixtures, readManifest } = require('../lib/app-path');
const { assemble } = require('../../build/build');

const ROOT      = path.resolve(__dirname, '..', '..');
const RULES     = path.join(ROOT, 'rules');
const MANIFEST  = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const MOD_FILE  = path.join(RULES, MANIFEST['ofp-navblue'].file);
const MOD_SRC   = fs.readFileSync(MOD_FILE, 'utf8');
const mod       = require(MOD_FILE);

// The fixture formats that are NavBlue (Navtech company PDF, eOFP print). Every fixture that
// is not FlightKeys must be one of these, so a new NavBlue variant is never silently left out.
const NAVBLUE_FORMATS = new Set(['navtech-company', 'navtech-eofp-ios-print']);
const FINDING = { level: 'INFO', field: 'sections', message: 'sections: content-built bookmarks arrive in step 5' };
const NAT_FINDING = { level: 'INFO', field: 'natTrack', message: 'NAT parser not supplied' };
const EMPTIES = {
  revision: null, companyNotams: [], ofpRemarks: [], fplEquipment: null, catIiIiiRestrictions: [],
  securityMessages: [], extraFuel: null, pcf: null, permits: [], designator: '', sections: [],
  findings: [FINDING],
};

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

// Loads a module source in a vm context the way the browser would see a script inside a
// function (module/exports given, as rules-loader does).
function loadInContext(src, ctx, filename) {
  const m = { exports: {} };
  vm.runInContext(`(function (module, exports) {\n${src}\n})`, ctx, { filename })(m, m.exports);
  return m.exports;
}

// A vm context in which window, document, self, storage and the app's globals exist but
// throw on any access (typeof included), and every access is recorded. A module that reads
// any of them fails; nothing can swallow the error unseen, because `touched` is checked too.
const TRAPPED_GLOBALS = ['window', 'document', 'self', 'top', 'parent', 'navigator', 'location',
  'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest',
  'parseNatTrack', 'renderNatTrack', 'S', 'pdfRawText', 'airportData', '_flightDateISO'];
// The accessors are defined from inside the context: Node's vm does not run a getter set on the
// sandbox object from outside for a bare global lookup (`typeof window` would quietly give
// 'undefined'), so that form would not bite.
function trappedContext() {
  const touched = [];
  const ctx = vm.createContext({});
  vm.runInContext(`(function (names, hit) {
    for (const name of names) {
      Object.defineProperty(globalThis, name, {
        configurable: true, enumerable: true,
        get() { hit(name); throw new Error('module read the global ' + name); },
        set() { hit(name + ' (write)'); throw new Error('module wrote the global ' + name); },
      });
    }
  })`, ctx, { filename: 'trapped globals' })(TRAPPED_GLOBALS, n => { if (!touched.includes(n)) touched.push(n); });
  // the trap bites (checked here, then the record is cleared)
  assert.throws(() => vm.runInContext('typeof window', ctx), /module read the global window/);
  assert.deepEqual(touched, ['window']);
  touched.length = 0;
  return { ctx, touched };
}

// One app load and one parse per fixture, shared by TC-130-010..013.
let _corpus = null;
function corpus() {
  if (_corpus) return _corpus;
  const dir = requireFixturesDir();
  const all = readManifest(dir).fixtures;
  const list = all.filter(f => f.format !== 'flightkeys');
  for (const fx of list) assert.ok(NAVBLUE_FORMATS.has(fx.format), `${fx.id}: format ${fx.format} is a known NavBlue format`);
  assert.ok(list.length >= 30, `at least the 30 NavBlue/eOFP packages of ADR-005 §2.4 (found ${list.length})`);
  const app = loadApp();
  const inApp = loadInContext(MOD_SRC, app.sandbox, 'ofp-navblue (app context)');
  const items = list.map(fx => {
    const raw = fs.readFileSync(path.join(dir, fx.files.text), 'utf8');
    return { fx, raw, app: app._ofpRulesetParse(raw) };
  });
  _corpus = { dir, app, inApp, items };
  return _corpus;
}

// ── field-by-field comparison (order-preserving; values from two realms) ────
function canon(v) {
  if (v === undefined) return '$undefined';
  if (v === null) return null;
  const t = typeof v;
  if (t === 'number') return Number.isNaN(v) ? '$NaN' : v === Infinity ? '$Infinity' : v === -Infinity ? '$-Infinity' : v;
  if (t === 'string' || t === 'boolean') return v;
  if (t === 'function') return '$function';
  const tag = Object.prototype.toString.call(v);
  if (Array.isArray(v)) return v.map(canon);
  if (tag === '[object Map]') return { $map: [...v].map(([k, x]) => [canon(k), canon(x)]) };
  if (tag === '[object Set]') return { $set: [...v].map(canon) };
  if (tag === '[object RegExp]') return { $regexp: String(v) };
  const o = {};
  for (const k of Object.keys(v)) o[k] = canon(v[k]);   // insertion order kept: key order is compared too
  return o;
}
const short = v => typeof v === 'string' ? `string(${v.length}) #${crypto.createHash('sha256').update(v).digest('hex').slice(0, 8)}`
                                         : JSON.stringify(v);
// Paths where two results differ; values shown as type/length/hash, never as text.
function diffPaths(a, b, p = '', out = []) {
  if (out.length > 20) return out;
  if (a === b) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) { out.push(`${p}: array/object mismatch`); return out; }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.join('\u0000') !== kb.join('\u0000')) out.push(`${p}: keys [${ka}] -> [${kb}]`);
    for (const k of new Set([...ka, ...kb])) diffPaths(a[k], b[k], `${p}.${k}`, out);
    return out;
  }
  out.push(`${p}: ${short(a)} -> ${short(b)}`);
  return out;
}
// A plain copy of a JSON-shaped value made in another realm (vm), for deepStrictEqual.
const plain = v => JSON.parse(JSON.stringify(v));
const leaves = v => (v && typeof v === 'object') ? Object.values(v).reduce((n, x) => n + leaves(x), 0) : 1;

// The core fields of a parseNavBlue() result: the extensions that live on core records
// (airportData[icao].remarks / .remarksWeather, ddgItems[i].type / .notes) taken off again.
function coreOf(nb) {
  const o = {};
  for (const k of mod.CORE_FIELDS) o[k] = nb[k];
  o.airportData = {};
  for (const icao of Object.keys(nb.airportData)) {
    const { remarks, remarksWeather, ...rest } = nb.airportData[icao];
    o.airportData[icao] = rest;
  }
  o.ddgItems = nb.ddgItems.map(({ type, notes, ...rest }) => rest);
  return o;
}

// A small synthetic NavBlue-shaped text (no fixture content).
const SYNTH = [
  'GTI1234/05 XXAA-YYBB',
  'B747-400F / CF680C2B1F / KGS / IFR',
  'ORIG XXAA/XAA SAMPLE ORIGIN INTL 0510Z',
  'DEST YYBB/YBB SAMPLE DEST INTL 1415Z',
  'PALT ZZCC/ZCC SAMPLE ALT INTL 1500Z',
  'BLOCK 123456',
  'MINF 100000',
  'TOGW 322195 ...... S396893',
  'WHEELS UP NOT BEFORE 0737Z',
  '(FPL-GTI1234-IN',
  '-B744/H-SDE2E3FGHIJ3J4J5M1RWXY/LB1D1',
  '-XXAA0510',
  '-YYBB0905 ZZCC',
  '-DOF/261105)',
  '',
].join('\n');

// ══ TC-130-001 metadata and validateSchema ═══════════════════════════════════

test('TC-130-001 metadata present; validateSchema() is valid; a broken parser object is rejected', () => {
  assert.equal(mod.RULESET_TYPE, 'ofp');
  assert.equal(mod.OFP_FORMAT, 'navblue');
  assert.equal(mod.RULESET_VERSION, '2.0.0');
  assert.equal(mod.SCHEMA_VERSION, 2);
  assert.equal(mod.CONTRACT_VERSION, '2.0');
  assert.ok(mod.RULESET_SOURCE.trim().length > 0);
  assert.equal(mod.CORE_FIELDS.length, 57);
  assert.deepEqual([...mod.EXTENSION_FIELDS], Object.keys(EMPTIES));
  assert.deepEqual([...mod.AIRPORT_EXTENSION_FIELDS], ['remarks', 'remarksWeather']);
  assert.deepEqual([...mod.DDG_EXTENSION_FIELDS], ['type', 'notes']);
  assert.deepEqual(mod.validateSchema(), { valid: true, errors: [] });
  assert.deepEqual(mod.validateSchema(mod), { valid: true, errors: [] });
  // negative: each break is reported
  const broken = [
    [o => { delete o.parseNavBlue; }, /missing export: parseNavBlue/],
    [o => { o._ofpRulesetParse = 'x'; }, /_ofpRulesetParse must be a function/],
    [o => { o.RULESET_TYPE = 'notam'; }, /RULESET_TYPE must be 'ofp'/],
    [o => { o.RULESET_VERSION = '2.0'; }, /not semver/],
    [o => { o.SCHEMA_VERSION = 1; }, /SCHEMA_VERSION 1 must be an integer >= 2/],
    [o => { o.CONTRACT_VERSION = '1.0'; }, /not a v2 contract/],
    [o => { o.OFP_FORMAT = ' '; }, /OFP_FORMAT is empty/],
    [o => { o.PATTERNS = { ...o.PATTERNS, TOGW: 'TOGW' }; }, /PATTERNS\.TOGW is not a RegExp/],
    [o => { o.CORE_FIELDS = o.CORE_FIELDS.slice(1); }, /CORE_FIELDS must list 57 fields/],
    [o => { o.EXTENSION_FIELDS = [...o.EXTENSION_FIELDS.slice(1), 'fltNum']; }, /fltNum is both a core field and an extension/],
    [o => { o.deriveCallsign = () => ({}); }, /deriveCallsign must not be exported/],
  ];
  for (const [mutate, re] of broken) {
    const o = { ...mod };
    mutate(o);
    const r = mod.validateSchema(o);
    assert.equal(r.valid, false, `rejected: ${re}`);
    assert.ok(r.errors.some(e => re.test(e)), `${re} in ${r.errors.join('; ')}`);
  }
  assert.equal(mod.validateSchema(null).valid, false);
});

// ══ TC-130-002 manifest ══════════════════════════════════════════════════════

test('TC-130-002 rules/manifest.json lists ofp-navblue with its version, file and SHA-256', () => {
  const e = MANIFEST['ofp-navblue'];
  assert.deepEqual(Object.keys(e).sort(), ['file', 'sha256', 'version']);
  assert.equal(e.version, '2.0.0');
  assert.equal(e.version, mod.RULESET_VERSION, 'manifest version = RULESET_VERSION');
  assert.equal(e.file, 'ofp-navblue/ofp-navblue-v2.0.0.js');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(MOD_FILE)).digest('hex'), e.sha256, 'SHA-256 matches');
  assert.ok(MANIFEST['notam-rules'], 'the NOTAM module entry is still listed');
});

// ══ TC-130-003 dual context ══════════════════════════════════════════════════

test('TC-130-003 dual context: Node, rules-loader and browser script give the same API; no window, no DOM, no app state', () => {
  const names = Object.keys(mod);
  // rules-loader evalRuleset(): new Function('module', 'exports', 'require', code)
  const m = { exports: {} };
  new Function('module', 'exports', 'require', MOD_SRC)(m, m.exports, () => { throw new Error('parser called require()'); });
  assert.deepEqual(Object.keys(m.exports), names);
  // Browser: a plain script (no module) in a context where window, document and the app's
  // globals throw on access. It must publish exactly one global, OfpNavBlue, and never read
  // any of them — while loading, parsing, or building the contract.
  const { ctx, touched } = trappedContext();
  const before = new Set(Object.getOwnPropertyNames(ctx));
  vm.runInContext(MOD_SRC, ctx, { filename: 'ofp-navblue (browser)' });
  const added = Object.getOwnPropertyNames(ctx).filter(k => !before.has(k));
  assert.deepEqual(added, ['OfpNavBlue'], 'only the OfpNavBlue global is added');
  assert.deepEqual(Object.keys(ctx.OfpNavBlue), names);
  assert.equal(ctx.OfpNavBlue.validateSchema().valid, true);
  // The browser copy parses exactly like the Node copy.
  assert.deepEqual(diffPaths(canon(mod._ofpRulesetParse(SYNTH)), canon(ctx.OfpNavBlue._ofpRulesetParse(SYNTH))), []);
  assert.deepEqual(diffPaths(canon(mod.parseNavBlue(SYNTH)), canon(ctx.OfpNavBlue.parseNavBlue(SYNTH))), []);
  const nat = () => ({ from: 'option' });
  assert.deepEqual(plain(ctx.OfpNavBlue._ofpRulesetParse(SYNTH, { parseNatTrack: nat }).natTrack), { from: 'option' });
  assert.equal(ctx.OfpNavBlue.parseNavBlue(SYNTH).natTrack, null);
  assert.deepEqual(touched, [], 'no window, document or app global was read');
  // No window, DOM, storage or app state in the code (comments aside).
  const code = MOD_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const re of [/\bwindow\b/, /\bdocument\b/, /\bself\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bindexedDB\b/, /\bfetch\s*\(/, /\bS\.\w/, /\bpdfRawText\b/, /\b_flightDateISO\b/]) {
    assert.ok(!re.test(code), `module code does not use ${re}`);
  }
  assert.equal((code.match(/\bwindow\b/g) || []).length, 0, 'window: 0 uses outside comments');
  assert.equal((code.match(/\bparseNatTrack\b/g) || []).length,
    (code.match(/\boptions\.parseNatTrack\b/g) || []).length, 'parseNatTrack is only ever read from options');
});

// ══ TC-130-004 the copies ════════════════════════════════════════════════════

// The three v2.0.0 edits, exactly as documented in the module header and SPEC §5.
const EDITS = [
  [' * @param {string} rawText — full OFP text from PDF extraction\n',
   ' * @param {string} rawText — full OFP text from PDF extraction\n' +
   ' * @param {object} [options] — v2.0.0: { parseNatTrack } (§ 11); optional\n'],
  ['function _ofpRulesetParse(rawText) {\n', 'function _ofpRulesetParse(rawText, options) {\n'],
  ["  const natTrack = (typeof window.parseNatTrack === 'function')\n" +
   '    ? window.parseNatTrack(t, origIcao, destIcao)\n' +
   '    : null;\n',
   '  // v2.0.0: the NAT track parser is its own module — used only when passed\n' +
   '  // in as options.parseNatTrack, else null (§ 11).\n' +
   '  const natTrack = _natTrackFrom(options, t, origIcao, destIcao);\n'],
];
// A block of app source: from the start of the line holding `startMark` (or of the banner line
// just above it) to the "}\n" that closes the function declared by `endFn`.
function block(src, startMark, endFn, banner) {
  let s = src.indexOf(startMark);
  assert.ok(s > -1, `marker present in app source: ${startMark}`);
  s = src.lastIndexOf('\n', s) + 1;
  if (banner) s = src.lastIndexOf('\n', s - 2) + 1;
  const f = src.indexOf(endFn, s);
  assert.ok(f > -1, `function present in app source: ${endFn}`);
  const e = src.indexOf('\n}\n', f) + 3;
  return src.slice(s, e);
}
const once = (hay, needle) => hay.split(needle).length - 1;

test('TC-130-004 the copies: § 2–§ 10 are the app source byte for byte, except the three marked edits', () => {
  const ofp = fs.readFileSync(path.join(ROOT, 'src', 'ofp-parse.html'), 'utf8');
  const pre = fs.readFileSync(path.join(ROOT, 'src', 'render-preflight.html'), 'utf8');
  const A = block(ofp, '// § 2 · CORE FIELD PATTERNS', 'function normalizeWaypointCoord(', true);
  const B = block(pre, '// ── ENR TIMELINE V2 — INJECTED FUNCTIONS', 'function applyNavlogEtpTimes(', false);
  const C0 = block(ofp, '// § 10 · FULL OFP PARSE FUNCTION', 'function _ofpRulesetParse(', true);
  // C0 ends at the first "\n}\n" after the signature: the closing brace of _ofpRulesetParse
  // (inner functions are indented, so their braces never sit at column 0).
  assert.ok(C0.trimEnd().endsWith('rawOFP: t,    // full raw text retained for navlog TOT-T extraction (ENR V2)\n  };\n}'));
  let C = C0;
  for (const [from, to] of EDITS) {
    assert.equal(once(C, from), 1, `edit site present once in the app source: ${from.trim().slice(0, 50)}`);
    C = C.replace(from, to);
  }
  for (const [name, b] of [['§ 2–§ 9 (src/ofp-parse.html)', A], ['§ 9b ENR V2 helpers (src/render-preflight.html)', B], ['§ 10 _ofpRulesetParse with the v2.0.0 edits', C]]) {
    assert.equal(once(MOD_SRC, b), 1, `${name}: present in the module exactly once, byte for byte (${b.length} chars)`);
  }
  // negative: the unedited app parser is not in the module; app-only code is not either
  assert.equal(once(MOD_SRC, C0), 0, 'the app parser without the NAT edit is not in the module');
  for (const n of ['function parseOFP(', 'function fuelK(', 'function deriveCallsign(', 'function _tlBuild(', 'function validateEtpOrder(', 'function buildTimelineEventsV2(']) {
    assert.equal(once(MOD_SRC, n), 0, `${n} is not in the module`);
  }
  // every "v2.0.0" marker in § 10 belongs to one of the edits
  const marks = C.match(/v2\.0\.0/g) || [];
  assert.equal(marks.length, 2, 'two v2.0.0 markers in § 10 (JSDoc and NAT)');
});

// ══ TC-130-005 the app is unchanged ══════════════════════════════════════════

test('TC-130-005 the app is unchanged: index.html is the build of src/ + rules/ and does not carry the module', () => {
  assert.ok(assemble(ROOT).equals(fs.readFileSync(path.join(ROOT, 'index.html'))), 'index.html = build of src/ + rules/');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(!html.includes('OfpNavBlue'), 'index.html does not publish OfpNavBlue');
  assert.ok(!html.includes('ofp-navblue.js — NavBlue OFP Parser'), 'index.html does not contain the module');
  assert.equal(once(html, 'function _ofpRulesetParse(rawText) {'), 1, 'the app keeps its own parser');
});

// ══ TC-130-010..013 LOCK on the fixtures ═════════════════════════════════════

test('TC-130-010 LOCK: every NavBlue/eOFP fixture, module in the app context, NAT parser passed in: core fields identical to the app (57 fields)', () => {
  const { app: appCtx, inApp, items } = corpus();
  const opts = { parseNatTrack: appCtx.sandbox.parseNatTrack };
  assert.equal(typeof opts.parseNatTrack, 'function', 'the app publishes window.parseNatTrack');
  let fields = 0, values = 0;
  const failures = [];
  for (const { fx, raw, app } of items) {
    assert.ok(app && typeof app === 'object', `${fx.id}: the app parses the fixture`);
    assert.deepEqual(Object.keys(app), [...mod.CORE_FIELDS], `${fx.id}: the app returns the 57 core fields in contract order`);
    const r = inApp._ofpRulesetParse(raw, opts);
    const nb = inApp.parseNavBlue(raw, opts);
    const d1 = diffPaths(canon(app), canon(r));
    const d2 = diffPaths(canon(app), canon(coreOf(nb)));
    try { assert.deepStrictEqual(r, app); } catch (e) { d1.push('deepStrictEqual: ' + e.message.split('\n')[0]); }
    if (d1.length) failures.push(`${fx.id} _ofpRulesetParse: ${d1.join(' | ')}`);
    if (d2.length) failures.push(`${fx.id} parseNavBlue core: ${d2.join(' | ')}`);
    fields += Object.keys(app).length;
    values += leaves(canon(app));
  }
  console.log(`TC-130-010: ${items.length} fixtures; ${fields} core fields and ${values} values compared ` +
    `(x2: _ofpRulesetParse and parseNavBlue); differences: ${failures.length}`);
  assert.deepEqual(failures, [], 'STOP: the NavBlue lock is broken');
  assert.equal(fields, items.length * 57);
});

test('TC-130-011 LOCK: module loaded in Node, NAT parser passed as options.parseNatTrack: identical to the app', () => {
  const { app: appCtx, items } = corpus();
  const opts = { parseNatTrack: appCtx.sandbox.parseNatTrack };
  assert.equal(typeof opts.parseNatTrack, 'function', 'the app publishes window.parseNatTrack');
  const failures = [];
  let nat = 0;
  for (const { fx, raw, app } of items) {
    const d1 = diffPaths(canon(app), canon(mod._ofpRulesetParse(raw, opts)));
    const d2 = diffPaths(canon(app), canon(coreOf(mod.parseNavBlue(raw, opts))));
    if (d1.length) failures.push(`${fx.id} _ofpRulesetParse: ${d1.join(' | ')}`);
    if (d2.length) failures.push(`${fx.id} parseNavBlue core: ${d2.join(' | ')}`);
    if (app.natTrack) nat++;
  }
  console.log(`TC-130-011: ${items.length} fixtures identical in Node (${nat} with a NAT track); differences: ${failures.length}`);
  assert.deepEqual(failures, [], 'STOP: the NavBlue lock is broken');
  assert.ok(nat > 0, 'the corpus has NAT tracks, so the hook is exercised');
});

test('TC-130-012 contract: every Appendix B extension present and empty; findings exactly the one INFO', () => {
  const { app: appCtx, items } = corpus();
  const opts = { parseNatTrack: appCtx.sandbox.parseNatTrack };
  const topKeys = [...mod.CORE_FIELDS, ...mod.EXTENSION_FIELDS];
  let apts = 0, ddgs = 0;
  for (const { fx, raw, app } of items) {
    const nb = mod.parseNavBlue(raw, opts);
    assert.deepEqual(Object.keys(nb), topKeys, `${fx.id}: 57 core fields then the 12 extensions, in order`);
    for (const k of mod.EXTENSION_FIELDS) {
      assert.ok(k in nb, `${fx.id}: ${k} present`);
      assert.deepEqual(nb[k], EMPTIES[k], `${fx.id}: ${k} is the explicit empty value`);
    }
    assert.deepEqual(nb.findings, [FINDING], `${fx.id}: findings = the one INFO (NAT parser passed in)`);
    // negative: the same package with no NAT parser carries the not-supplied INFO as well
    assert.deepEqual(mod.parseNavBlue(raw).findings, [FINDING, NAT_FINDING], `${fx.id}: findings without a NAT parser`);
    assert.deepEqual(Object.keys(nb.airportData), Object.keys(app.airportData), `${fx.id}: same airports`);
    for (const icao of Object.keys(nb.airportData)) {
      const e = nb.airportData[icao];
      assert.deepEqual(Object.keys(e), [...Object.keys(app.airportData[icao]), 'remarks', 'remarksWeather'], `${fx.id} ${icao}: core keys, then remarks, remarksWeather`);
      assert.deepEqual(e.remarks, [], `${fx.id} ${icao}: remarks empty`);
      assert.deepEqual(e.remarksWeather, [], `${fx.id} ${icao}: remarksWeather empty`);
      apts++;
    }
    assert.equal(nb.ddgItems.length, app.ddgItems.length, `${fx.id}: same DDG items`);
    nb.ddgItems.forEach((d, i) => {
      assert.deepEqual(Object.keys(d), [...Object.keys(app.ddgItems[i]), 'type', 'notes'], `${fx.id} ddgItems[${i}]: core keys, then type, notes`);
      assert.equal(d.type, '', `${fx.id} ddgItems[${i}].type empty`);
      assert.deepEqual(d.notes, [], `${fx.id} ddgItems[${i}].notes empty`);
      ddgs++;
    });
  }
  console.log(`TC-130-012: ${items.length} fixtures; ${mod.EXTENSION_FIELDS.length} top-level extensions each; ` +
    `${apts} airportData entries and ${ddgs} DDG items carry their empty extensions`);
  assert.ok(apts > 0 && ddgs > 0, 'the nested extensions are exercised');
});

test('TC-130-013 NAT hook on the fixtures: no NAT parser → natTrack null and nothing else differs', () => {
  const { app: appCtx, inApp, items } = corpus();
  let natFixtures = 0;
  for (const { fx, raw, app } of items) {
    const without = mod._ofpRulesetParse(raw);        // Node: no options
    assert.equal(without.natTrack, null, `${fx.id}: natTrack null without a NAT parser`);
    const d = diffPaths(canon({ ...app, natTrack: null }), canon(without));
    assert.deepEqual(d, [], `${fx.id}: only natTrack depends on the NAT parser`);
    // In the app's own context (window.parseNatTrack published) the module still does not use it.
    assert.equal(inApp._ofpRulesetParse(raw).natTrack, null, `${fx.id}: window.parseNatTrack is not used when not passed`);
    const nbWithout = mod.parseNavBlue(raw);
    assert.equal(nbWithout.natTrack, null);
    assert.deepEqual(nbWithout.findings.filter(f => f.field === 'natTrack'), [NAT_FINDING], `${fx.id}: the not-supplied INFO`);
    if (app.natTrack) {
      natFixtures++;
      // negative: the lock comparison sees a missing NAT parser
      assert.ok(diffPaths(canon(app), canon(without)).length > 0, `${fx.id}: the lock detects the missing NAT track`);
      const withIt = mod._ofpRulesetParse(raw, { parseNatTrack: appCtx.sandbox.parseNatTrack });
      assert.deepEqual(diffPaths(canon(app.natTrack), canon(withIt.natTrack)), [], `${fx.id}: the app's NAT track`);
    }
    // with the parser passed in, there is no not-supplied INFO (whether or not a track is found)
    const nbWith = mod.parseNavBlue(raw, { parseNatTrack: appCtx.sandbox.parseNatTrack });
    assert.deepEqual(nbWith.findings, [FINDING], `${fx.id}: no not-supplied INFO when the parser is passed`);
  }
  console.log(`TC-130-013: ${natFixtures} fixture(s) with a NAT track; null without the NAT parser on all ${items.length}`);
  assert.ok(natFixtures > 0);
});

// ══ TC-130-014 / 015 synthetic ═══════════════════════════════════════════════

test('TC-130-014 synthetic: empty input → null; no state carried between calls; fresh extension values', () => {
  for (const v of [undefined, null, '', '   \n  ', 42, {}, []]) {
    assert.equal(mod._ofpRulesetParse(v), null, `_ofpRulesetParse(${JSON.stringify(v)}) → null`);
    assert.equal(mod.parseNavBlue(v), null, `parseNavBlue(${JSON.stringify(v)}) → null`);
  }
  const first = canon(mod.parseNavBlue(SYNTH));
  mod.parseNavBlue('ORIG QQQQ/QQQ OTHER 0100Z\nDEST RRRR/RRR OTHER 0900Z\n');
  assert.deepEqual(diffPaths(first, canon(mod.parseNavBlue(SYNTH))), [], 'same text → same result after another parse');
  const a = mod.parseNavBlue(SYNTH), b = mod.parseNavBlue(SYNTH);
  for (const k of mod.EXTENSION_FIELDS) if (a[k] && typeof a[k] === 'object') assert.notEqual(a[k], b[k], `${k}: not shared between results`);
  assert.notEqual(a.findings[0], b.findings[0]);
  // the synthetic text is read as expected (positive), the empties are still empty (negative)
  assert.equal(a.fltNum, 'GTI1234/05');
  assert.equal(a.origIcao, 'XXAA');
  assert.equal(a.slotTime, 'NOT BEFORE 0737Z');
  assert.equal(a.designator, '', 'designator stays empty: NavBlue is locked (no extension work)');
  // parseNavBlue leaves the core record it builds from untouched: a plain parse has no extensions
  const plain = mod._ofpRulesetParse(SYNTH);
  for (const icao of Object.keys(plain.airportData)) assert.ok(!('remarks' in plain.airportData[icao]));
});

test('TC-130-015 NAT hook: used only when passed in; never looked up on window; not passed → null + INFO', () => {
  // (1) A window (and document, app globals) that throws on any access, typeof included.
  const { ctx, touched } = trappedContext();
  const m = loadInContext(MOD_SRC, ctx, 'ofp-navblue (trapped window)');
  // not passed: natTrack null — the app's value when no NAT track is found — and one more INFO
  assert.equal(m._ofpRulesetParse(SYNTH).natTrack, null, 'no option → natTrack null');
  const nbNone = m.parseNavBlue(SYNTH);
  assert.equal(nbNone.natTrack, null);
  assert.deepEqual(plain(nbNone.findings), [FINDING, NAT_FINDING], 'no option → findings carry "NAT parser not supplied"');
  // passed: the injected parser is used, with the app's arguments (text, origIcao, destIcao)
  const calls = [];
  const opt = (t, o, d) => { calls.push([typeof t, t === SYNTH, o, d]); return { from: 'option' }; };
  assert.deepEqual(plain(m._ofpRulesetParse(SYNTH, { parseNatTrack: opt }).natTrack), { from: 'option' }, 'the injected parser is used');
  const nbOpt = m.parseNavBlue(SYNTH, { parseNatTrack: opt });
  assert.deepEqual(plain(nbOpt.natTrack), { from: 'option' });
  assert.deepEqual(plain(nbOpt.findings), [FINDING], 'passed → no not-supplied INFO');
  assert.deepEqual(calls, [['string', true, 'XXAA', 'YYBB'], ['string', true, 'XXAA', 'YYBB']], 'called once per parse with (text, orig, dest)');
  // an injected parser that finds no track: null, and no not-supplied INFO (it was supplied)
  const nbNull = m.parseNavBlue(SYNTH, { parseNatTrack: () => null });
  assert.equal(nbNull.natTrack, null);
  assert.deepEqual(plain(nbNull.findings), [FINDING]);
  // not a function → not supplied
  for (const o of [{}, { parseNatTrack: null }, { parseNatTrack: 'parseNatTrack' }, { parseNatTrack: {} }, null]) {
    assert.equal(m._ofpRulesetParse(SYNTH, o).natTrack, null, `${JSON.stringify(o)} → null`);
    assert.deepEqual(plain(m.parseNavBlue(SYNTH, o).findings), [FINDING, NAT_FINDING], `${JSON.stringify(o)} → not supplied`);
  }
  assert.deepEqual(touched, [], 'the module never touched window, document or an app global');

  // (2) A window that publishes parseNatTrack (as the app does), plus a bare global of the
  // same name: neither is ever called when no option is passed.
  const spied = [];
  const ctx2 = vm.createContext({});
  ctx2.window = { parseNatTrack: () => { spied.push('window'); return { from: 'window' }; } };
  ctx2.parseNatTrack = () => { spied.push('global'); return { from: 'global' }; };
  const m2 = loadInContext(MOD_SRC, ctx2, 'ofp-navblue (window with parseNatTrack)');
  assert.equal(m2._ofpRulesetParse(SYNTH).natTrack, null, 'window.parseNatTrack present, no option → null');
  assert.deepEqual(plain(m2.parseNavBlue(SYNTH).findings), [FINDING, NAT_FINDING]);
  assert.deepEqual(plain(m2._ofpRulesetParse(SYNTH, { parseNatTrack: opt }).natTrack), { from: 'option' }, 'the option, not window');
  assert.deepEqual(spied, [], 'the window / global parser is never called');
});

test('TC-130-016 the masters\' self-test assertions (SPEC v1.0 #1–9, v1.1 #10–14) hold; slot time negatives', () => {
  const P = mod.PATTERNS;
  // v1.0 #1–9
  assert.ok(P.SLOT_TIME_AT.test('PCF FOR ROUTE DEVIATIONS WHEELS UP 0433Z'), '#1 SLOT_TIME_AT bare WHEELS UP time');
  assert.ok(P.SLOT_TIME_NOT_BEFORE.test('WHEELS UP NOT BEFORE 0737Z'), '#2');
  assert.ok(P.SLOT_TIME_WINDOW.test('WHEELS UP MUST BE BETWEEN 0737Z AND 0807Z'), '#3');
  assert.ok(P.EXEMPTION_NO, '#4');
  assert.ok(P.SLOT_TIME_CURFEW, '#5');
  assert.ok(mod.CAT_II_III_PATTERNS, '#6');
  assert.ok(mod.COMPANY_NOTAM, '#7');
  assert.equal(typeof mod._ofpRulesetParse, 'function', '#8');
  assert.equal(mod.deriveCallsign, undefined, '#9 deriveCallsign is app logic, not exported');
  // v1.1 #10–14
  assert.ok(P.ZFW_INCR_FACTOR.test('ZFW INCR/1000 X 259 MINF ADJ'), '#10');
  assert.ok(P.ZFW_INCR_FACTOR.test('ZFW INCR/1000 X 326 MINF ADJ'), '#11');
  assert.equal(mod._ofpRulesetParse('ZFW INCR/1000 X 259 MINF ADJ').zfwIncrFactor, 259, '#12');
  assert.ok(P.TAXI_FUEL.test('TAXI 1200'), '#13');
  assert.ok(P.TAXI_FUEL.test('TAXI\n1200'), '#14');
  // slot time (safety-critical): the chain's priorities, positive and negative
  const slot = s => mod._ofpRulesetParse(s).slotTime;
  assert.equal(slot('PCF FOR ROUTE DEVIATIONS WHEELS UP 0433Z'), 'AT 0433Z');
  assert.equal(slot('WHEELS UP NOT BEFORE 0737Z'), 'NOT BEFORE 0737Z');
  assert.equal(slot('WHEELS UP MUST BE BETWEEN 0737Z AND 0807Z DUE TO ANC SLOT TIME'), '0737Z – 0807Z');
  assert.equal(slot('WHEELS UP MUST BE BEFORE 0807Z'), 'BEFORE 0807Z');
  assert.equal(slot('EARLIEST WHEELS UP 2247Z DUE TO ANC PARKING'), 'NOT BEFORE 2247Z');
  assert.ok(!P.SLOT_TIME_AT.test('WHEELS UP 0737Z MUST BE OBSERVED'), 'negative: AT does not fire when a qualifier follows');
  assert.equal(slot('NO SLOT RESTRICTION TODAY'), null, 'negative: no slot phrase → null');
  assert.equal(mod._ofpRulesetParse('NO FACTOR HERE').zfwIncrFactor, null, 'negative: no ZFW increment → null');
});

// ══ TC-130-020 the gate bites ════════════════════════════════════════════════

test('TC-130-020 the gate bites: a module with one rule broken fails the lock', () => {
  const { items, app: appCtx } = corpus();
  // Break the landing weight limit (safety: weights): read the actual value instead of the limit.
  const from = '  if (ldgwM) { ldgwActual = parseInt(ldgwM[1], 10); ldgwLimit = parseInt(ldgwM[2], 10); }\n';
  assert.equal(once(MOD_SRC, from), 1, 'mutation site present');
  const broken = MOD_SRC.replace(from, '  if (ldgwM) { ldgwActual = parseInt(ldgwM[1], 10); ldgwLimit = parseInt(ldgwM[1], 10); }\n');
  const bm = { exports: {} };
  new Function('module', 'exports', 'require', broken)(bm, bm.exports, () => ({}));
  const opts = { parseNatTrack: appCtx.sandbox.parseNatTrack };
  let diffs = 0;
  for (const { raw, app } of items) {
    if (diffPaths(canon(app), canon(bm.exports._ofpRulesetParse(raw, opts))).length) diffs++;
  }
  console.log(`TC-130-020: broken module → ${diffs} of ${items.length} fixture(s) differ from the app`);
  assert.ok(diffs > 0, 'the lock detects the broken rule');
});

// ══ TC-130-030 fixtures missing → FAIL ═══════════════════════════════════════

function runTests(files, env, extra = []) {
  // NODE_TEST_CONTEXT would make the child report to this runner instead of printing TAP.
  const childEnv = { ...process.env, ...env };
  delete childEnv.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...extra, ...files], {
    cwd: ROOT, encoding: 'utf8', env: childEnv, timeout: 300000, maxBuffer: 64 * 1024 * 1024,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const num = k => { const m = out.match(new RegExp(`^# ${k} (\\d+)$`, 'm')); return m ? parseInt(m[1], 10) : null; };
  return { status: r.status, tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'), out };
}

test('TC-130-030 fixtures missing: the fixture tests fail, they are never skipped', () => {
  const r = runTests([__filename], { PB_FIXTURES: path.join(os.tmpdir(), 'no-such-fixtures-dir') },
    ['--test-name-pattern', 'TC-130-01[0-3]']);
  assert.notEqual(r.status, 0, 'the run fails');
  assert.equal(r.skipped, 0, 'nothing is skipped');
  assert.ok(r.fail >= 4, `TC-130-010..013 fail (fail=${r.fail})`);
  assert.ok(/fixtures not found/.test(r.out), 'the failure says the fixtures were not found');
});
