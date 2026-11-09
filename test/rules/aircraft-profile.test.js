'use strict';
/**
 * TC-150 — Aircraft and registration profile module (rules/aircraft-profile, v1.0.0)
 *
 * An EXTRACTION (ADR-005 §2.1, step 4): AIRCRAFT_DATA, getWingspan() and buildAcftProfile() from
 * the NOTAM module (rules/notam-rules, which the app builds into index.html), and the callsign
 * index (CS-1) with deriveCallsign() from src/ofp-parse.html. Output must be IDENTICAL to today's
 * code. The app is unchanged: it still runs its own copies; integration is a separate PR.
 *
 *   TC-150-001  metadata present; validateSchema() valid; broken objects rejected
 *   TC-150-002  rules/manifest.json: the aircraft-profile entry, its version, file and SHA-256
 *   TC-150-003  dual context: Node (module.exports), rules-loader (new Function), browser (plain
 *               script → one global AircraftProfile); loaded and every export called in a context
 *               whose window, document, storage and app globals throw on access — none touched
 *   TC-150-004  the copies: the NOTAM module's table + getWingspan + buildAcftProfile byte for
 *               byte; deriveCallsign = the app's text with the two marked v1.0.0 edits undone;
 *               CALLSIGN_INDEX = the app's inline map (keys, values, order); _acftApplies and the
 *               NOTAM rules not in the module; index.html does not carry the module
 *   TC-150-010  buildAcftProfile / getWingspan deep-equal the NOTAM module's (standalone file AND
 *               the copy built into index.html), values and key order: every AIRCRAFT_DATA key,
 *               every acftType in the fixtures, lowercase / space / suffix variants, unknown types,
 *               empty / null / undefined; a non-string type throws the same error in both
 *   TC-150-011  deriveCallsign deep-equals the app's (built index.html AND src/ofp-parse.html):
 *               every fixture flight number, each designator (upper/lower/mixed case), designator
 *               with no number, unknown designators, empty / null / undefined, odd spacing
 *   TC-150-012  the shared tables are frozen; every call returns a fresh object
 *   TC-150-020  the gate bites: one table value or one callsign changed → the comparison fails
 *   TC-150-030  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Fixtures: PB_FIXTURES (authoritative when set), else ./fixtures or ../pilotbrief-fixtures.
 * Messages name fixture ids and inputs by hash only; no fixture text, no flight numbers.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const vm     = require('vm');
const crypto = require('crypto');
const { loadApp } = require('../harness');
const { findFixtures, readManifest } = require('../lib/app-path');
const { assemble } = require('../../build/build');

const ROOT      = path.resolve(__dirname, '..', '..');
const RULES     = path.join(ROOT, 'rules');
const MANIFEST  = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const MOD_FILE  = path.join(RULES, MANIFEST['aircraft-profile'].file);
const MOD_SRC   = fs.readFileSync(MOD_FILE, 'utf8');
const mod       = require(MOD_FILE);
const NOTAM_FILE = path.join(RULES, MANIFEST['notam-rules'].file);
const NOTAM_SRC  = fs.readFileSync(NOTAM_FILE, 'utf8');
const notam      = require(NOTAM_FILE);
const APP_OFP_PARSE = fs.readFileSync(path.join(ROOT, 'src', 'ofp-parse.html'), 'utf8');

const NAVBLUE_FORMATS = new Set(['navtech-company', 'navtech-eofp-ios-print']);
const DESIGNATORS = ['GTI', 'PAC', 'CMB', 'QFA'];

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
// acftType and fltNum of every fixture, from its golden snapshot (the app's parse).
function fixtureInputs() {
  const dir = requireFixturesDir();
  const list = readManifest(dir).fixtures;
  const navblue = list.filter(f => NAVBLUE_FORMATS.has(f.format));
  assert.ok(navblue.length >= 30, `at least the 30 NavBlue/eOFP packages (found ${navblue.length})`);
  return list.map(fx => {
    const file = path.join(dir, 'snapshots', `${fx.id}.json`);
    assert.ok(fs.existsSync(file), `${fx.id}: golden snapshot present`);
    const r = JSON.parse(fs.readFileSync(file, 'utf8')).result;
    assert.equal(typeof r.acftType, 'string', `${fx.id}: snapshot acftType is a string`);
    assert.equal(typeof r.fltNum, 'string', `${fx.id}: snapshot fltNum is a string`);
    return { id: fx.id, format: fx.format, acftType: r.acftType, fltNum: r.fltNum };
  });
}

// ── helpers ────────────────────────────────────────────────────────────────
const hash = v => `#${crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 8)}`;
// An input as it may appear in a message: fixture-derived values only as a hash.
const label = (v, secret) => secret ? `${typeof v}${hash(v)}` : JSON.stringify(v);
// A plain copy of a JSON-shaped value made in another realm (vm), key order kept.
const plain = v => v === undefined ? '$undefined' : JSON.parse(JSON.stringify(v));
// Calls fn(x); a throw is captured as { $throws: <constructor name>: <message> }.
function outcome(fn, x) {
  try { return plain(fn(x)); } catch (e) { return { $throws: `${e && e.constructor && e.constructor.name}: ${e && e.message}` }; }
}
// Every input where a and b differ (deepStrictEqual on plain copies; key order via JSON text).
function differences(a, b, inputs, secret = new Set()) {
  const out = [];
  for (const x of inputs) {
    const ra = outcome(a, x), rb = outcome(b, x);
    let same = JSON.stringify(ra) === JSON.stringify(rb);
    if (same) { try { assert.deepStrictEqual(ra, rb); } catch { same = false; } }
    if (!same) out.push(label(x, secret.has(x)));
  }
  return out;
}

function loadInContext(src, ctx, filename) {
  const m = { exports: {} };
  vm.runInContext(`(function (module, exports) {\n${src}\n})`, ctx, { filename })(m, m.exports);
  return m.exports;
}

// The section of src from the line starting with `start` to the closing "\n}" of the function
// declared by `fnDecl` (the first "\n}\n" after it).
function cut(src, start, fnDecl) {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `marker present: ${start}`);
  const f = src.indexOf(fnDecl, i);
  assert.ok(f >= i, `function present: ${fnDecl}`);
  const e = src.indexOf('\n}\n', f);
  assert.ok(e > f, `end of ${fnDecl}`);
  return src.slice(i, e + 2);
}
const NOTAM_BLOCK = () => cut(NOTAM_SRC, '// ── Aircraft data database', 'function buildAcftProfile(');
const APP_DERIVE  = () => cut(APP_OFP_PARSE, 'function deriveCallsign(', 'function deriveCallsign(');
const MOD_DERIVE  = () => cut(MOD_SRC, 'function deriveCallsign(', 'function deriveCallsign(');

// The NOTAM module's own getWingspan (not exported): its table + getWingspan text, run in a vm.
function notamGetWingspan() {
  const ctx = vm.createContext({});
  const src = cut(NOTAM_SRC, '// ── Aircraft data database', 'function getWingspan(');
  return vm.runInContext(`${src}\ngetWingspan;`, ctx, { filename: 'notam-rules getWingspan' });
}
// The app's own deriveCallsign, from src/ofp-parse.html, run in a vm (strict, like the app).
function srcDeriveCallsign() {
  const ctx = vm.createContext({});
  return vm.runInContext(`'use strict';\n${APP_DERIVE()}\nderiveCallsign;`, ctx, { filename: 'src/ofp-parse.html deriveCallsign' });
}

let _app = null;
const app = () => (_app ||= loadApp({ html: assemble(ROOT).toString('utf8') }));

// Inputs for buildAcftProfile / getWingspan (no fixture data).
function typeInputs() {
  const keys = Object.keys(mod.AIRCRAFT_DATA);
  const variants = [];
  for (const k of keys) {
    variants.push(k, k.toLowerCase(), k[0] + k.slice(1).toLowerCase(), ` ${k}`, `${k} `, `${k}F`,
                  `${k}/H`, `${k.slice(0, 2)} ${k.slice(2)}`, k.slice(0, 3));
  }
  return [...variants,
    // unknown types (some appear in NOTAM type lists but not in the table)
    'ZZZZ', 'XXXX', 'A225', 'B773', 'A30B', 'A344', 'C5M', 'B77F', 'B74F', 'B747', 'B777', 'B767',
    'B747-400F', 'B747-8F', 'B767-300F', 'B777-200LRF', 'MD-11', '74F', '1', 'A', 'UNKN',
    // empty and non-values
    '', ' ', '    ', null, undefined, 0, false, NaN,
    // non-strings that are truthy: both throw
    123, {}, [],
  ];
}

// Inputs for deriveCallsign (no fixture data).
function callsignInputs() {
  const out = [];
  for (const d of DESIGNATORS) {
    out.push(`${d}1`, `${d}123`, `${d}8993`, `${d}0`, `${d}0012`, d.toLowerCase() + '45',
             d[0] + d.slice(1).toLowerCase() + '7', `${d}12A`, `${d}123/05`, `${d}`, d.toLowerCase(),
             `${d} 123`, ` ${d}123`, `${d}X12`, `X${d}12`, `${d}-123`);
  }
  out.push('THY1', 'THY123', 'ABC1', 'GTX12', 'GT123', 'PO123', 'POLAR123', 'GIANT1', '123', '1',
           '', ' ', null, undefined, 0, false, NaN, 123, {});
  return out;
}

// ══ TC-150-001 metadata and validateSchema ═══════════════════════════════════

test('TC-150-001 metadata present; validateSchema() is valid; a broken object is rejected', () => {
  assert.equal(mod.RULESET_TYPE, 'aircraft-profile');
  assert.equal(mod.RULESET_VERSION, '1.0.0');
  assert.equal(mod.SCHEMA_VERSION, 1);
  assert.ok(mod.RULESET_SOURCE.trim().length > 0);
  assert.deepEqual(Object.keys(mod), ['RULESET_TYPE', 'RULESET_VERSION', 'SCHEMA_VERSION', 'RULESET_SOURCE',
    'validateSchema', 'AIRCRAFT_DATA', 'getWingspan', 'buildAcftProfile', 'CALLSIGN_INDEX', 'deriveCallsign']);
  assert.deepEqual(mod.validateSchema(), { valid: true, errors: [] });
  assert.deepEqual(mod.validateSchema(mod), { valid: true, errors: [] });
  const data = (t, patch) => ({ ...mod.AIRCRAFT_DATA, [t]: { ...mod.AIRCRAFT_DATA[t], ...patch } });
  const broken = [
    [o => { delete o.buildAcftProfile; }, /missing export: buildAcftProfile/],
    [o => { o.deriveCallsign = 'x'; }, /deriveCallsign must be a function/],
    [o => { o.CALLSIGN_INDEX = null; }, /CALLSIGN_INDEX must be a object/],
    [o => { o._acftApplies = () => true; }, /_acftApplies must not be exported/],
    [o => { o.evalNotams = () => null; }, /evalNotams must not be exported/],
    [o => { o.RULESET_TYPE = 'notam'; }, /RULESET_TYPE must be 'aircraft-profile'/],
    [o => { o.RULESET_VERSION = '1.0'; }, /not semver/],
    [o => { o.SCHEMA_VERSION = 0; }, /SCHEMA_VERSION 0 must be an integer >= 1/],
    [o => { o.RULESET_SOURCE = ' '; }, /RULESET_SOURCE is empty/],
    [o => { o.AIRCRAFT_DATA = data('B744', { wake: 'X' }); }, /B744\.wake must be L, M, H or J/],
    [o => { o.AIRCRAFT_DATA = data('B744', { code: 'G' }); }, /B744\.code must be A–F/],
    [o => { o.AIRCRAFT_DATA = data('B744', { ws: '64' }); }, /B744\.ws must be a positive number/],
    [o => { o.AIRCRAFT_DATA = data('B744', { mtow: 0 }); }, /B744\.mtow must be a positive number/],
    [o => { o.AIRCRAFT_DATA = data('B744', { turbine: 1 }); }, /B744\.turbine must be a boolean/],
    [o => { o.AIRCRAFT_DATA = data('B744', { extra: 1 }); }, /B744: fields must be/],
    [o => { o.AIRCRAFT_DATA = { ...mod.AIRCRAFT_DATA, b744: mod.AIRCRAFT_DATA.B744 }; }, /b744: not an ICAO type designator/],
    [o => { o.CALLSIGN_INDEX = { ...mod.CALLSIGN_INDEX, GT: 'GIANT' }; }, /CALLSIGN_INDEX\.GT: not a 3-letter/],
    [o => { o.CALLSIGN_INDEX = { ...mod.CALLSIGN_INDEX, THY: 'Turkish' }; }, /CALLSIGN_INDEX\.THY: callsign must be upper-case/],
  ];
  for (const [breakIt, re] of broken) {
    const o = { ...mod };
    breakIt(o);
    const r = mod.validateSchema(o);
    assert.equal(r.valid, false, `rejected: ${re}`);
    assert.ok(r.errors.some(e => re.test(e)), `${re} in ${JSON.stringify(r.errors)}`);
  }
  assert.deepEqual(mod.validateSchema(null), { valid: false, errors: ['ruleset is not an object'] });
});

// ══ TC-150-002 manifest ══════════════════════════════════════════════════════

test('TC-150-002 rules/manifest.json lists aircraft-profile 1.0.0 with its SHA-256', () => {
  const e = MANIFEST['aircraft-profile'];
  assert.deepEqual(Object.keys(e), ['version', 'file', 'sha256']);
  assert.equal(e.version, '1.0.0');
  assert.equal(e.version, mod.RULESET_VERSION);
  assert.equal(e.file, 'aircraft-profile/aircraft-profile-v1.0.0.js');
  assert.equal(e.sha256, crypto.createHash('sha256').update(fs.readFileSync(MOD_FILE)).digest('hex'));
});

// ══ TC-150-003 dual context, no app state ════════════════════════════════════

const TRAPPED_GLOBALS = ['window', 'document', 'self', 'top', 'parent', 'navigator', 'location',
  'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest',
  'S', 'pdfRawText', 'airportData', '_flightDateISO', 'NotamRules', 'OfpNavBlue',
  'AIRCRAFT_DATA', 'buildAcftProfile', 'getWingspan', 'deriveCallsign'];
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
  assert.throws(() => vm.runInContext('typeof window', ctx), /module read the global window/);
  assert.deepEqual(touched, ['window']);
  touched.length = 0;
  return { ctx, touched };
}
// Calls every export once with a range of inputs; returns the plain results.
function exercise(api) {
  return {
    v: plain(api.validateSchema()),
    p: typeInputs().map(t => outcome(api.buildAcftProfile, t)),
    w: typeInputs().map(t => outcome(api.getWingspan, t)),
    c: callsignInputs().map(f => outcome(api.deriveCallsign, f)),
    d: plain(api.AIRCRAFT_DATA), i: plain(api.CALLSIGN_INDEX),
  };
}

test('TC-150-003 dual context: Node, rules-loader, browser global; no window / DOM / app state', () => {
  const base = exercise(mod);
  // rules-loader
  const m = { exports: {} };
  new Function('module', 'exports', 'require', MOD_SRC)(m, m.exports, () => { throw new Error('require used'); });
  assert.deepEqual(exercise(m.exports), base);
  // browser: a plain script, no module → exactly one new global, AircraftProfile
  const ctx = vm.createContext({});
  const before = new Set(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx));
  vm.runInContext(MOD_SRC, ctx, { filename: 'aircraft-profile (browser)' });
  const added = vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx).filter(n => !before.has(n));
  assert.deepEqual([...added], ['AircraftProfile']);
  assert.deepEqual(exercise(vm.runInContext('AircraftProfile', ctx)), base);
  // trapped: loaded and every export called — nothing touched
  for (const asScript of [false, true]) {
    const { ctx: t, touched } = trappedContext();
    const api = asScript ? (vm.runInContext(MOD_SRC, t, { filename: 'trapped (browser)' }), vm.runInContext('AircraftProfile', t))
                         : loadInContext(MOD_SRC, t, 'trapped (module)');
    assert.deepEqual(exercise(api), base);
    assert.deepEqual(touched, [], `globals touched (${asScript ? 'browser' : 'module'}): ${touched}`);
  }
  // the code (comments and strings removed) names no browser or app global
  const code = MOD_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/'[^'\n]*'|"[^"\n]*"/g, "''");
  for (const g of ['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'navigator', 'NotamRules', 'require'])
    assert.ok(!new RegExp(`\\b${g}\\b`).test(code), `the module code names ${g}`);
});

// ══ TC-150-004 the copies ════════════════════════════════════════════════════

test('TC-150-004 copies: table/getWingspan/buildAcftProfile byte for byte; deriveCallsign = app with the two marked edits', () => {
  // (a) the NOTAM module block, byte for byte, once
  const block = NOTAM_BLOCK();
  assert.ok(block.includes('const AIRCRAFT_DATA = {') && block.includes('function getWingspan(') && block.includes('function buildAcftProfile('));
  assert.equal(MOD_SRC.split(block).length - 1, 1, 'the NOTAM module block appears exactly once, byte for byte');
  // (b) deriveCallsign: the module text with its two marked v1.0.0 edits undone = the app text
  const appFn = APP_DERIVE();
  const mapLit = appFn.match(/const verbal = (\{[^}]*\})\[prefix\] \|\| '';/);
  const reLit  = appFn.match(/fltNum\.match\((\/\^\([A-Z|]+\)\(\\d\+\)\/i)\);/);
  assert.ok(mapLit && reLit, 'the app has the inline map and regex literal');
  const undone = MOD_DERIVE()
    .replace("fltNum.match(CALLSIGN_PREFIX_RE);   // v1.0.0: was the literal /^(GTI|PAC|CMB|QFA)(\\d+)/i", `fltNum.match(${reLit[1]});`)
    .replace("CALLSIGN_INDEX[prefix] || '';  // v1.0.0: was the inline map { GTI: 'GIANT', … }[prefix]", `${mapLit[1]}[prefix] || '';`);
  assert.equal(undone, appFn, 'deriveCallsign is the app text except the two marked edits');
  // (c) CALLSIGN_INDEX is the app's inline map: keys, values and order
  const appMap = vm.runInNewContext(`(${mapLit[1]})`);
  assert.equal(JSON.stringify(mod.CALLSIGN_INDEX), JSON.stringify(appMap));
  assert.deepEqual(Object.keys(mod.CALLSIGN_INDEX), DESIGNATORS);
  // (d) the prefix pattern built from the index is the app's literal
  const appRe = vm.runInNewContext(reLit[1]);
  const built = new RegExp('^(' + Object.keys(mod.CALLSIGN_INDEX).join('|') + ')(\\d+)', 'i');
  assert.equal(built.source, appRe.source);
  assert.equal(built.flags, appRe.flags);
  assert.ok(MOD_SRC.includes("new RegExp('^(' + Object.keys(CALLSIGN_INDEX).join('|') + ')(\\\\d+)', 'i')"), 'the module builds that pattern');
  // (e) the NOTAM rules stay in the NOTAM module; this module is not in index.html yet
  for (const n of ['function _acftApplies(', 'function _twyApplies(', 'function evalNotams(', 'TYPE_RE'])
    assert.ok(!MOD_SRC.includes(n), `${n} is not in the module`);
  assert.equal(typeof notam._acftApplies, 'function', 'the NOTAM module keeps _acftApplies');
  assert.equal(typeof notam.buildAcftProfile, 'function', 'the NOTAM module keeps buildAcftProfile (unchanged)');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(!html.includes('AircraftProfile') && !html.includes('CALLSIGN_INDEX'), 'index.html does not carry the module (integration is a separate PR)');
  assert.ok(assemble(ROOT).equals(fs.readFileSync(path.join(ROOT, 'index.html'))), 'index.html is the build of src/ + rules/');
});

// ══ TC-150-010 buildAcftProfile / getWingspan = the NOTAM module's ═══════════

function profileComparison(api) {
  const fx = fixtureInputs();
  const fxTypes = fx.map(f => f.acftType);
  const secret = new Set();   // fixture types are fleet designators, not crew data: shown as is
  const inputs = [...typeInputs(), ...fxTypes, ...fxTypes.map(t => t.toLowerCase()), ...fxTypes.map(t => ` ${t} `)];
  const appNotam = app().sandbox.NotamRules;
  assert.equal(typeof appNotam.buildAcftProfile, 'function', 'index.html publishes NotamRules.buildAcftProfile');
  const nGw = notamGetWingspan();
  return {
    inputs, fx,
    vsFile: differences(api.buildAcftProfile, notam.buildAcftProfile, inputs, secret),
    vsApp:  differences(api.buildAcftProfile, appNotam.buildAcftProfile, inputs, secret),
    ws:     differences(api.getWingspan, nGw, inputs, secret),
  };
}

test('TC-150-010 buildAcftProfile and getWingspan equal the NOTAM module (file and index.html) on every input', () => {
  const r = profileComparison(mod);
  assert.deepEqual(r.vsFile, [], 'module vs rules/notam-rules buildAcftProfile');
  assert.deepEqual(r.vsApp, [], 'module vs NotamRules.buildAcftProfile built into index.html');
  assert.deepEqual(r.ws, [], 'module vs the NOTAM module getWingspan');
  // coverage: every table key, every fixture type known, unknowns conservative
  for (const k of Object.keys(mod.AIRCRAFT_DATA)) {
    assert.ok(r.inputs.includes(k));
    assert.deepEqual(plain(mod.buildAcftProfile(k)), { type: k, ...mod.AIRCRAFT_DATA[k], known: true });
    assert.equal(mod.getWingspan(k), mod.AIRCRAFT_DATA[k].ws);
  }
  const navblue = r.fx.filter(f => NAVBLUE_FORMATS.has(f.format));
  assert.ok(navblue.length >= 30);
  for (const f of r.fx) assert.equal(mod.buildAcftProfile(f.acftType).known, true, `${f.id}: fleet type in the table`);
  assert.deepEqual(plain(mod.buildAcftProfile('')), { type: 'UNKN', ws: 999, mtow: 999999, code: 'F', wake: 'H', turbine: true, known: false });
  assert.deepEqual(plain(mod.buildAcftProfile('zzzz')), { type: 'ZZZZ', ws: 999, mtow: 999999, code: 'F', wake: 'H', turbine: true, known: false });
  assert.equal(mod.buildAcftProfile('b744').type, 'B744');
  assert.equal(mod.buildAcftProfile(' B744').known, false, 'a leading space is not trimmed (as today)');
  assert.equal(mod.getWingspan(''), null);
  assert.equal(mod.getWingspan('ZZZZ'), null);
  assert.throws(() => mod.buildAcftProfile(123), TypeError);
  assert.throws(() => notam.buildAcftProfile(123), TypeError);
});

// ══ TC-150-011 deriveCallsign = the app's ════════════════════════════════════

function callsignComparison(api) {
  const fx = fixtureInputs();
  const fxNums = fx.map(f => f.fltNum);
  const secret = new Set(fxNums);
  const inputs = [...callsignInputs(), ...fxNums];
  const a = app();
  assert.equal(typeof a.deriveCallsign, 'function', 'index.html has the app deriveCallsign');
  return {
    inputs, fx,
    vsApp: differences(api.deriveCallsign, a.deriveCallsign, inputs, secret),
    vsSrc: differences(api.deriveCallsign, srcDeriveCallsign(), inputs, secret),
  };
}

test('TC-150-011 deriveCallsign equals the app (index.html and src/ofp-parse.html) on every input', () => {
  const r = callsignComparison(mod);
  assert.deepEqual(r.vsApp, [], 'module vs the app deriveCallsign in index.html');
  assert.deepEqual(r.vsSrc, [], 'module vs src/ofp-parse.html deriveCallsign');
  // each designator, positive and negative
  assert.deepEqual(plain(mod.deriveCallsign('GTI1')), { radioCallsign: 'GTI1', verbalCallsign: 'GIANT', isHeavy: true });
  assert.deepEqual(plain(mod.deriveCallsign('pac22')), { radioCallsign: 'PAC22', verbalCallsign: 'POLAR', isHeavy: true });
  assert.deepEqual(plain(mod.deriveCallsign('Cmb3')), { radioCallsign: 'CMB3', verbalCallsign: 'CAMBER', isHeavy: true });
  assert.deepEqual(plain(mod.deriveCallsign('QFA7')), { radioCallsign: 'QFA7', verbalCallsign: 'QANTAS', isHeavy: true });
  assert.deepEqual(plain(mod.deriveCallsign('GTI')), { radioCallsign: 'GTI', verbalCallsign: '', isHeavy: false }, 'no number');
  assert.deepEqual(plain(mod.deriveCallsign('THY1')), { radioCallsign: 'THY1', verbalCallsign: '', isHeavy: false }, 'unknown designator');
  assert.deepEqual(plain(mod.deriveCallsign('')), { radioCallsign: '', verbalCallsign: '', isHeavy: false }, 'empty');
  assert.deepEqual(plain(mod.deriveCallsign(null)), { radioCallsign: '', verbalCallsign: '', isHeavy: false }, 'null');
  assert.throws(() => mod.deriveCallsign(123), TypeError);
  // every fixture flight number was compared; each fixture designator seen
  assert.equal(r.fx.length, r.inputs.length - callsignInputs().length);
});

// ══ TC-150-012 frozen tables, fresh results ══════════════════════════════════

test('TC-150-012 the shared tables are frozen; every call returns a fresh object', () => {
  assert.ok(Object.isFrozen(mod.AIRCRAFT_DATA) && Object.isFrozen(mod.CALLSIGN_INDEX));
  for (const k of Object.keys(mod.AIRCRAFT_DATA)) assert.ok(Object.isFrozen(mod.AIRCRAFT_DATA[k]), k);
  assert.throws(() => { mod.AIRCRAFT_DATA.B744.ws = 1; }, TypeError);
  assert.throws(() => { mod.CALLSIGN_INDEX.GTI = 'X'; }, TypeError);
  const p = mod.buildAcftProfile('B744');
  assert.ok(!Object.isFrozen(p), 'the profile is the caller\'s own object, as today');
  p.ws = 1;
  assert.equal(mod.buildAcftProfile('B744').ws, 64.4);
  const c = mod.deriveCallsign('GTI1');
  c.verbalCallsign = 'X';
  assert.equal(mod.deriveCallsign('GTI1').verbalCallsign, 'GIANT');
});

// ══ TC-150-020 the gate bites ════════════════════════════════════════════════

test('TC-150-020 the gate bites: one table value or one callsign changed → the comparison fails', () => {
  const variant = (from, to) => {
    assert.equal(MOD_SRC.split(from).length - 1, 1, `edit target unique: ${from}`);
    return loadInContext(MOD_SRC.replace(from, to), vm.createContext({}), 'broken variant');
  };
  const ws = variant('B744: { ws:64.4,', 'B744: { ws:64.5,');
  const r1 = profileComparison(ws);
  assert.ok(r1.vsFile.length > 0 && r1.vsApp.length > 0 && r1.ws.length > 0, 'a wingspan change is caught');
  const wake = variant("B752: { ws:38.1, mtow:115900, code:'D', wake:'H'", "B752: { ws:38.1, mtow:115900, code:'D', wake:'M'");
  assert.ok(profileComparison(wake).vsFile.includes('"B752"'), 'a wake change is caught');
  const cs = variant("CMB: 'CAMBER'", "CMB: 'CAMBR'");
  const r2 = callsignComparison(cs);
  assert.ok(r2.vsApp.length > 0 && r2.vsSrc.length > 0, 'a callsign change is caught');
  const drop = variant("QFA: 'QANTAS' }", "QFA: '' }");
  assert.ok(callsignComparison(drop).vsApp.includes('"QFA1"'), 'an emptied callsign is caught');
});

// ══ TC-150-030 fixtures missing → FAIL ═══════════════════════════════════════

test('TC-150-030 fixtures missing → the fixture comparisons fail (never skip)', () => {
  const saved = process.env.PB_FIXTURES;
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-nofix-'));
  try {
    process.env.PB_FIXTURES = empty;
    assert.throws(() => profileComparison(mod), /fixtures not found/);
    assert.throws(() => callsignComparison(mod), /fixtures not found/);
  } finally {
    if (saved === undefined) delete process.env.PB_FIXTURES; else process.env.PB_FIXTURES = saved;
    fs.rmSync(empty, { recursive: true, force: true });
  }
});
