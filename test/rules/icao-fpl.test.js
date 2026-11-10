'use strict';
/**
 * TC-152 — ICAO filed flight plan reader (rules/icao-fpl, v1.0.0)
 *
 * A NEW shared module (ADR-005 §2.1 "ICAO flight plan"): parseIcaoFpl(text) reads the "(FPL- … )"
 * block of an OFP package, format-independent, per ICAO Doc 4444 Appendix 2/3. Not built into the
 * app in this step; the NavBlue parser keeps its own FPL patterns (D47 lock).
 *
 *   TC-152-001  metadata present; validateSchema() valid; broken objects rejected
 *   TC-152-002  rules/manifest.json: the icao-fpl entry, its version, file and SHA-256
 *   TC-152-003  dual context: Node (module.exports), rules-loader (new Function), browser (plain
 *               script → one global IcaoFpl); loaded and run in a context whose window, document,
 *               storage and app globals throw on access — none touched
 *   TC-152-004  not in the app: index.html and build/build.js do not carry or name the module;
 *               index.html is still the build of src/ + rules/
 *   TC-152-010  synthetic FPLs (Doc 4444 field rules), positive: a full block; line breaks inside
 *               fields 7–18; 0, 1 and 2 alternates; field 18 with and without DOF/REG/SEL/RMK, and
 *               "0"; flight rules I, V, Y, Z with and without a type of flight; number of aircraft;
 *               SSR code in field 7; ZZZZ / AFIL; field 19; regional indicators; "/" in RMK text;
 *               a block inside other text; identical copies
 *   TC-152-011  synthetic, negative: not found (no block, empty, non-string, unclosed) → found
 *               false and every field empty; each field malformed → that field empty + WARN, the
 *               others still read; impossible DOF / EOBT / EET; too few fields; copies that differ;
 *               3 alternates; repeated indicator; hyphen inside field 18
 *   TC-152-012  no state between calls; every result is a fresh object; never throws
 *   TC-152-020  every NavBlue/eOFP fixture (≥ 30): found = true, and flightId, aircraftType, wake and
 *               dof EQUAL what the NavBlue parser reads from the same text (its FPL patterns
 *               FLIGHT_ID_FPL, AIRCRAFT_TYPE, FPL_WAKE, DATE_DOF, and its _ofpRulesetParse acftType,
 *               isHeavy, flightDateISO); FlightKeys fixtures: found = true. No fixture gives a WARN.
 *               Equipment and route are REPORTED per fixture (counts), not asserted.
 *   TC-152-021  the gate bites: a reader with one rule broken fails the consistency check
 *   TC-152-030  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Fixtures: PB_FIXTURES (authoritative when set), else ./fixtures or ../pilotbrief-fixtures.
 * Messages name fixture ids and field names only; no fixture text, flight numbers or registrations.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const vm     = require('vm');
const crypto = require('crypto');
const { findFixtures, readManifest } = require('../lib/app-path');
const { assemble } = require('../../build/build');

const ROOT      = path.resolve(__dirname, '..', '..');
const RULES     = path.join(ROOT, 'rules');
const MANIFEST  = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const MOD_FILE  = path.join(RULES, MANIFEST['icao-fpl'].file);
const MOD_SRC   = fs.readFileSync(MOD_FILE, 'utf8');
const mod       = require(MOD_FILE);
const navblue   = require(path.join(RULES, MANIFEST['ofp-navblue'].file));

const NAVBLUE_FORMATS = new Set(['navtech-company', 'navtech-eofp-ios-print']);
const FIELDS = ['found', 'raw', 'flightId', 'flightRules', 'flightType', 'aircraftType', 'wake',
  'equipment', 'surveillance', 'departure', 'eobt', 'route', 'destination', 'eet', 'alternates',
  'dof', 'reg', 'sel', 'rmk', 'other', 'findings'];
const STRING_FIELDS = FIELDS.filter(f => !['found', 'alternates', 'other', 'findings'].includes(f));

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

// ── helpers ────────────────────────────────────────────────────────────────
const plain = v => v === undefined ? '$undefined' : JSON.parse(JSON.stringify(v));
const warns = r => r.findings.filter(f => f.level === 'WARN');
const hasFinding = (r, level, field, re) =>
  r.findings.some(f => f.level === level && f.field === field && (!re || re.test(f.message)));
function assertEmpty(r, label) {
  assert.deepEqual(Object.keys(r), FIELDS, `${label}: result fields and order`);
  assert.equal(r.found, false, `${label}: found`);
  for (const f of STRING_FIELDS) assert.equal(r[f], '', `${label}: ${f} empty`);
  assert.deepEqual(r.alternates, [], `${label}: alternates empty`);
  assert.deepEqual(r.other, {}, `${label}: other empty`);
}
// Everything except the fields named in `except` is as in `base`.
function assertSameExcept(r, base, except, label) {
  for (const f of FIELDS) {
    if (f === 'findings' || f === 'raw' || except.includes(f)) continue;
    assert.deepEqual(r[f], base[f], `${label}: ${f} unchanged`);
  }
}

function loadInContext(src, ctx, filename) {
  const m = { exports: {} };
  vm.runInContext(`(function (module, exports) {\n${src}\n})`, ctx, { filename })(m, m.exports);
  return m.exports;
}

// ── synthetic FPLs (no fixture data; identifiers are made up) ───────────────
// Builds "(FPL-7-8\n-9-10\n-13\n-15\n-16\n-18)" from field texts; each may contain line breaks.
function fpl(f = {}) {
  const v = Object.assign({
    f7: 'TST123', f8: 'IS', f9: 'B744/H', f10: 'SDE1E2E3FGHIJ3J5M1P2RWXYZ/LB1D1', f13: 'KAAA1755',
    f15: 'N0481F320 AAA1R AAA N852 BBBBB DCT 49N020W/M084F340 47N030W DCT CCCCC/N0485F340 DCT DDD',
    f16: 'KBBB0933 KCCC',
    f18: 'PBN/A1B1C1D1L1O1S2 NAV/RNVD1E2A1 DAT/CPDLCX SUR/260B RSP180 DOF/260308 REG/N000ZZ EET/KZNY0100 SEL/ABCD CODE/A00000 OPR/TST RMK/TCAS II EQUIPPED',
  }, f);
  return `(FPL-${v.f7}-${v.f8}\n-${v.f9}-${v.f10}\n-${v.f13}\n-${v.f15}\n-${v.f16}\n-${v.f18}${v.f19 !== undefined ? '\n-' + v.f19 : ''})`;
}
const BASE = mod.parseIcaoFpl(fpl());

// Inputs used to exercise every context (TC-152-003).
function syntheticInputs() {
  return [
    fpl(), fpl({ f8: 'Y' }), fpl({ f8: 'ZN' }), fpl({ f16: 'KBBB0933' }), fpl({ f16: 'KBBB0933 KCCC KDDD' }),
    fpl({ f18: '0' }), fpl({ f19: 'E/0900 P/4' }), fpl({ f9: 'B744/X' }), fpl({ f13: 'KAAA2460' }),
    'header text\n' + fpl() + '\nfooter', '(FPL-TST1-IS', '', '   ', 'no plan here', null, undefined, 0, 42, {}, [],
  ];
}

// ══ TC-152-001 metadata and validateSchema ═══════════════════════════════════

test('TC-152-001 metadata present; validateSchema() is valid; a broken object is rejected', () => {
  assert.equal(mod.RULESET_TYPE, 'icao-fpl');
  assert.equal(mod.RULESET_VERSION, '1.0.0');
  assert.equal(mod.SCHEMA_VERSION, 1);
  assert.ok(mod.RULESET_SOURCE.trim().length > 0 && /Doc 4444/.test(mod.RULESET_SOURCE));
  assert.deepEqual(Object.keys(mod), ['RULESET_TYPE', 'RULESET_VERSION', 'SCHEMA_VERSION', 'RULESET_SOURCE',
    'validateSchema', 'RESULT_FIELDS', 'FIELD18_INDICATORS', 'parseIcaoFpl']);
  assert.deepEqual([...mod.RESULT_FIELDS], FIELDS);
  assert.ok(Object.isFrozen(mod.RESULT_FIELDS) && Object.isFrozen(mod.FIELD18_INDICATORS));
  for (const k of ['DOF', 'REG', 'SEL', 'RMK', 'EET', 'PBN', 'ALTN', 'RALT', 'TALT', 'RIF', 'RVR'])
    assert.ok(mod.FIELD18_INDICATORS.includes(k), `indicator ${k} listed`);
  assert.deepEqual(mod.validateSchema(), { valid: true, errors: [] });
  assert.deepEqual(mod.validateSchema(mod), { valid: true, errors: [] });
  const broken = [
    [o => { delete o.parseIcaoFpl; }, /missing export: parseIcaoFpl/],
    [o => { o.validateSchema = 1; }, /validateSchema must be a function/],
    [o => { o.RESULT_FIELDS = null; }, /RESULT_FIELDS must be a object/],
    [o => { o.RESULT_FIELDS = ['found']; }, /RESULT_FIELDS must be found, raw/],
    [o => { o.FIELD18_INDICATORS = ['DOF', 'dof']; }, /'dof' is not a 3–4 letter indicator/],
    [o => { o.FIELD18_INDICATORS = ['DOF', 'DOF']; }, /'DOF' listed twice/],
    [o => { o.FIELD18_INDICATORS = { DOF: 1 }; }, /FIELD18_INDICATORS must be an array/],
    [o => { o.parseNavBlue = () => null; }, /parseNavBlue must not be exported/],
    [o => { o._ofpRulesetParse = () => null; }, /_ofpRulesetParse must not be exported/],
    [o => { o.RULESET_TYPE = 'ofp'; }, /RULESET_TYPE must be 'icao-fpl'/],
    [o => { o.RULESET_VERSION = '1.0'; }, /not semver/],
    [o => { o.SCHEMA_VERSION = 1.5; }, /SCHEMA_VERSION 1.5 must be an integer >= 1/],
    [o => { o.RULESET_SOURCE = ' '; }, /RULESET_SOURCE is empty/],
    [o => { o.parseIcaoFpl = () => ({ found: false }); }, /must return the fields/],
    [o => { o.parseIcaoFpl = () => { throw new Error('x'); }; }, /throws: x/],
    [o => { o.parseIcaoFpl = t => Object.assign(mod.parseIcaoFpl(t), { found: true }); }, /must return found: false/],
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

// ══ TC-152-002 manifest ══════════════════════════════════════════════════════

test('TC-152-002 rules/manifest.json lists icao-fpl 1.0.0 with its SHA-256', () => {
  const e = MANIFEST['icao-fpl'];
  assert.deepEqual(Object.keys(e), ['version', 'file', 'sha256']);
  assert.equal(e.version, '1.0.0');
  assert.equal(e.version, mod.RULESET_VERSION);
  assert.equal(e.file, 'icao-fpl/icao-fpl-v1.0.0.js');
  assert.equal(e.sha256, crypto.createHash('sha256').update(fs.readFileSync(MOD_FILE)).digest('hex'));
});

// ══ TC-152-003 dual context, no app state ════════════════════════════════════

const TRAPPED_GLOBALS = ['window', 'document', 'self', 'top', 'parent', 'navigator', 'location',
  'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'Date',
  'S', 'pdfRawText', 'airportData', '_flightDateISO', 'NotamRules', 'OfpNavBlue', 'AircraftProfile',
  'PATTERNS', 'parseOFP', '_ofpRulesetParse'];
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
function exercise(api) {
  return {
    v: plain(api.validateSchema()),
    r: syntheticInputs().map(t => plain(api.parseIcaoFpl(t))),
    f: plain(api.RESULT_FIELDS), i: plain(api.FIELD18_INDICATORS),
  };
}

test('TC-152-003 dual context: Node, rules-loader, browser global; no window / DOM / app state / clock', () => {
  const base = exercise(mod);
  // rules-loader
  const m = { exports: {} };
  new Function('module', 'exports', 'require', MOD_SRC)(m, m.exports, () => { throw new Error('require used'); });
  assert.deepEqual(exercise(m.exports), base);
  // browser: a plain script, no module → exactly one new global, IcaoFpl
  const ctx = vm.createContext({});
  const before = new Set(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx));
  vm.runInContext(MOD_SRC, ctx, { filename: 'icao-fpl (browser)' });
  const added = vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx).filter(n => !before.has(n));
  assert.deepEqual([...added], ['IcaoFpl']);
  assert.deepEqual(exercise(vm.runInContext('IcaoFpl', ctx)), base);
  // trapped: loaded and every export called — nothing touched
  for (const asScript of [false, true]) {
    const { ctx: t, touched } = trappedContext();
    const api = asScript ? (vm.runInContext(MOD_SRC, t, { filename: 'trapped (browser)' }), vm.runInContext('IcaoFpl', t))
                         : loadInContext(MOD_SRC, t, 'trapped (module)');
    assert.deepEqual(exercise(api), base);
    assert.deepEqual(touched, [], `globals touched (${asScript ? 'browser' : 'module'}): ${touched}`);
  }
  // the code (comments and strings removed) names no browser or app global
  const code = MOD_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/'[^'\n]*'|"[^"\n]*"/g, "''");
  for (const g of ['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'navigator',
                   'Date', 'OfpNavBlue', 'AircraftProfile', 'NotamRules', 'require'])
    assert.ok(!new RegExp(`\\b${g}\\b`).test(code), `the module code names ${g}`);
});

// ══ TC-152-004 not in the app ════════════════════════════════════════════════

test('TC-152-004 not built into the app: index.html and build/build.js do not carry it; the build is unchanged', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const build = fs.readFileSync(path.join(ROOT, 'build', 'build.js'), 'utf8');
  for (const s of ['IcaoFpl', 'parseIcaoFpl', 'icao-fpl'])
    assert.ok(!html.includes(s), `index.html does not contain ${s}`);
  assert.ok(!build.includes('icao-fpl'), 'build/build.js does not list icao-fpl');
  const srcFiles = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true })
    .filter(f => fs.statSync(path.join(ROOT, 'src', f)).isFile());
  assert.ok(srcFiles.length >= 20, 'src/ files found');
  for (const f of srcFiles)
    assert.ok(!/IcaoFpl|parseIcaoFpl|icao-fpl/.test(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')), `src/${f} does not use the module`);
  assert.ok(assemble(ROOT).equals(fs.readFileSync(path.join(ROOT, 'index.html'))), 'index.html is the build of src/ + rules/');
});

// ══ TC-152-010 synthetic, positive ═══════════════════════════════════════════

test('TC-152-010 synthetic FPLs (Doc 4444): every field read; line breaks, alternates, field 18 variants, flight rules', () => {
  // (a) a full block
  const r = BASE;
  assert.deepEqual(Object.keys(r), FIELDS);
  assert.equal(r.found, true);
  assert.equal(r.raw, fpl());
  assert.deepEqual(
    { flightId: r.flightId, flightRules: r.flightRules, flightType: r.flightType, aircraftType: r.aircraftType, wake: r.wake,
      equipment: r.equipment, surveillance: r.surveillance, departure: r.departure, eobt: r.eobt, destination: r.destination,
      eet: r.eet, alternates: r.alternates, dof: r.dof, reg: r.reg, sel: r.sel, rmk: r.rmk },
    { flightId: 'TST123', flightRules: 'I', flightType: 'S', aircraftType: 'B744', wake: 'H',
      equipment: 'SDE1E2E3FGHIJ3J5M1P2RWXYZ', surveillance: 'LB1D1', departure: 'KAAA', eobt: '1755', destination: 'KBBB',
      eet: '0933', alternates: ['KCCC'], dof: '2026-03-08', reg: 'N000ZZ', sel: 'ABCD', rmk: 'TCAS II EQUIPPED' });
  assert.equal(r.route, 'N0481F320 AAA1R AAA N852 BBBBB DCT 49N020W/M084F340 47N030W DCT CCCCC/N0485F340 DCT DDD');
  assert.deepEqual(r.other, { PBN: 'A1B1C1D1L1O1S2', NAV: 'RNVD1E2A1', DAT: 'CPDLCX', SUR: '260B RSP180', DOF: '260308',
    REG: 'N000ZZ', EET: 'KZNY0100', SEL: 'ABCD', CODE: 'A00000', OPR: 'TST', RMK: 'TCAS II EQUIPPED' });
  assert.deepEqual(Object.keys(r.other), ['PBN', 'NAV', 'DAT', 'SUR', 'DOF', 'REG', 'EET', 'SEL', 'CODE', 'OPR', 'RMK'], 'filed order kept');
  assert.deepEqual(r.findings, []);

  // (b) line breaks inside every field (wraps): the same values
  const wrapped = mod.parseIcaoFpl(fpl({
    f7: 'TST\n123', f8: 'I\nS', f9: 'B74\n4/H', f10: 'SDE1E2E3FGHIJ3J5\nM1P2RWXYZ/LB\n1D1', f13: 'KAAA\n1755',
    f15: 'N0481F320 AAA1R AAA N852 BBBBB DCT\n49N020W/M084F340 47N030W DCT\nCCCCC/N0485F340 DCT DDD',
    f16: 'KBBB0933\nKCCC',
    f18: 'PBN/A1B1C1D1L1O1S2 NAV/RNVD1E2A1 DAT/CPDLCX SUR/260B RSP180\nDOF/260308 REG/N000ZZ\nEET/KZNY0100 SEL/ABCD CODE/A00000 OPR/TST RMK/TCAS II\nEQUIPPED',
  }));
  assertSameExcept(wrapped, BASE, [], 'wrapped');
  assert.deepEqual(wrapped.findings, []);
  // CRLF line ends and double spaces read the same
  const crlf = mod.parseIcaoFpl(fpl().replace(/\n/g, '\r\n').replace('TCAS II', 'TCAS  II'));
  assertSameExcept(crlf, BASE, [], 'CRLF');

  // (c) alternates: none, one, two
  for (const [f16, alts] of [['KBBB0933', []], ['KBBB0933 KCCC', ['KCCC']], ['KBBB0933 KCCC KDDD', ['KCCC', 'KDDD']], ['KBBB0933\nKCCC\nKDDD', ['KCCC', 'KDDD']]]) {
    const a = mod.parseIcaoFpl(fpl({ f16 }));
    assert.deepEqual(a.alternates, alts, `alternates for ${JSON.stringify(f16)}`);
    assert.equal(a.destination, 'KBBB'); assert.equal(a.eet, '0933');
    assert.deepEqual(warns(a), []);
  }

  // (d) field 18 with and without DOF / REG / SEL / RMK
  const without = mod.parseIcaoFpl(fpl({ f18: 'PBN/A1B1 NAV/RNVD1E2A1 EET/KZNY0100 OPR/TST' }));
  assert.equal(without.dof, ''); assert.equal(without.reg, ''); assert.equal(without.sel, ''); assert.equal(without.rmk, '');
  assert.deepEqual(without.other, { PBN: 'A1B1', NAV: 'RNVD1E2A1', EET: 'KZNY0100', OPR: 'TST' });
  assert.ok(hasFinding(without, 'INFO', 'other', /not filed: DOF, REG, SEL, RMK/));
  assert.deepEqual(warns(without), []);
  const onlyDof = mod.parseIcaoFpl(fpl({ f18: 'DOF/261231' }));
  assert.equal(onlyDof.dof, '2026-12-31'); assert.deepEqual(onlyDof.other, { DOF: '261231' });
  assert.ok(hasFinding(onlyDof, 'INFO', 'other', /not filed: REG, SEL, RMK/));
  const rmkFirst = mod.parseIcaoFpl(fpl({ f18: 'RMK/FIRST ITEM REG/N1 SEL/WXYZ DOF/280229' }));
  assert.deepEqual([rmkFirst.rmk, rmkFirst.reg, rmkFirst.sel, rmkFirst.dof], ['FIRST ITEM', 'N1', 'WXYZ', '2028-02-29'], 'leap day, any order');
  const zero = mod.parseIcaoFpl(fpl({ f18: '0' }));
  assert.deepEqual(zero.other, {}); assert.equal(zero.dof, '');
  assert.ok(hasFinding(zero, 'INFO', 'other', /0 \(no other information\)/));
  assert.deepEqual(warns(zero), []);
  // regional and less common indicators; "/" inside RMK text stays in RMK
  const more = mod.parseIcaoFpl(fpl({ f18: 'STS/HOSP PBN/A1 DEP/5130N00010W TYP/B744 DLE/AAA0030 ORGN/KAAAXXXX PER/D ALTN/KEEE RALT/RJCC KSFO TALT/KFFF RIF/AAA DCT KGGG RVR/300 EUR/PROTECTED RMK/ATC/ACK TCAS' }));
  assert.equal(more.other.RALT, 'RJCC KSFO');
  assert.equal(more.other.RIF, 'AAA DCT KGGG');
  assert.equal(more.other.RVR, '300'); assert.equal(more.other.EUR, 'PROTECTED');
  assert.equal(more.rmk, 'ATC/ACK TCAS');
  assert.ok(hasFinding(more, 'INFO', 'other.RMK', /"ATC\/" is not a field 18 indicator/));
  assert.deepEqual(warns(more), []);

  // (e) flight rules I, V, Y, Z; type of flight present or absent
  for (const [f8, rules, type] of [['IS', 'I', 'S'], ['VG', 'V', 'G'], ['YN', 'Y', 'N'], ['ZM', 'Z', 'M'], ['IX', 'I', 'X'], ['Y', 'Y', ''], ['Z', 'Z', '']]) {
    const a = mod.parseIcaoFpl(fpl({ f8 }));
    assert.deepEqual([a.flightRules, a.flightType], [rules, type], `field 8 ${f8}`);
    assert.deepEqual(warns(a), [], `field 8 ${f8}: no WARN`);
    assert.equal(hasFinding(a, 'INFO', 'flightType'), !type, `field 8 ${f8}: INFO when no type of flight`);
  }

  // (f) field 9 number of aircraft and wake categories; field 7 SSR code; ZZZZ / AFIL
  const formation = mod.parseIcaoFpl(fpl({ f9: '2F16/M' }));
  assert.deepEqual([formation.aircraftType, formation.wake], ['F16', 'M']);
  assert.ok(hasFinding(formation, 'INFO', 'aircraftType', /number of aircraft 2/));
  for (const w of ['L', 'M', 'H', 'J']) assert.equal(mod.parseIcaoFpl(fpl({ f9: `A388/${w}` })).wake, w);
  assert.equal(mod.parseIcaoFpl(fpl({ f9: 'C5/H' })).aircraftType, 'C5');
  assert.equal(mod.parseIcaoFpl(fpl({ f7: 'TST123/A1234' })).flightId, 'TST123');
  assert.equal(mod.parseIcaoFpl(fpl({ f7: 'N000ZZ' })).flightId, 'N000ZZ');
  const zz = mod.parseIcaoFpl(fpl({ f9: 'ZZZZ/M', f13: 'AFIL1200', f16: 'ZZZZ0100 ZZZZ' }));
  assert.deepEqual([zz.aircraftType, zz.departure, zz.destination, zz.alternates], ['ZZZZ', 'AFIL', 'ZZZZ', ['ZZZZ']]);
  assert.ok(hasFinding(zz, 'INFO', 'aircraftType', /TYP\//) && hasFinding(zz, 'INFO', 'departure', /DEP\//) &&
            hasFinding(zz, 'INFO', 'destination', /DEST\//) && hasFinding(zz, 'INFO', 'alternates', /ALTN\//));
  // route forms: Mach / metric level / VFR
  for (const f15 of ['M084F340 DCT AAA', 'K0900S1150 AAA', 'N0120A045 DCT', 'N0120VFR DCT AAA', 'N0480M1250 AAA'])
    assert.equal(mod.parseIcaoFpl(fpl({ f15 })).route, f15, `route ${f15}`);

  // (g) field 19 present: field 18 ends at it; nothing of field 19 is read into field 18
  const f19 = mod.parseIcaoFpl(fpl({ f19: 'E/0945 P/4 R/UVE S/M J/L D/2 10 C ORANGE A/WHITE N/NIL C/CAPTAIN' }));
  assertSameExcept(f19, BASE, [], 'field 19');
  assert.ok(hasFinding(f19, 'INFO', 'other', /field 19/));

  // (h) a block inside other text; three identical copies (the OFP repeats it) → read once, no WARN
  const pkg = `PAGE 1\nTEXT BEFORE (NOTE)\n${fpl()}\nOTHER TEXT\n${fpl()}\nMORE\n${fpl()}\nEND`;
  const inPkg = mod.parseIcaoFpl(pkg);
  assertSameExcept(inPkg, BASE, [], 'package');
  assert.equal(inPkg.raw, fpl());
  assert.deepEqual(inPkg.findings, []);
});

// ══ TC-152-011 synthetic, negative ═══════════════════════════════════════════

test('TC-152-011 negative: not found → found false, every field empty; a malformed field → empty + WARN, never a guessed value', () => {
  // (a) not found
  for (const [input, label, level] of [['', 'empty', 'INFO'], ['   \n ', 'blank', 'INFO'], ['NO PLAN (FPL) HERE FPL-TST1-IS', 'no "(FPL-"', 'INFO'],
                                       [null, 'null', 'INFO'], [undefined, 'undefined', 'INFO'], [42, 'number', 'INFO'], [{}, 'object', 'INFO'],
                                       ['(FPL-TST123-IS\n-B744/H-S/C\n-KAAA1755', 'unclosed', 'WARN'],
                                       ['(FPL-TST1-IS\n(FPL-TST2-IS', 'two unclosed', 'WARN']]) {
    const r = mod.parseIcaoFpl(input);
    assertEmpty(r, label);
    assert.equal(r.findings.length, 1, `${label}: one finding`);
    assert.equal(r.findings[0].level, level, `${label}: ${level}`);
    assert.equal(r.findings[0].field, 'found');
  }
  // an unclosed block before a complete one: the complete one is read, with a WARN
  const unclosedFirst = mod.parseIcaoFpl('(FPL-TST9-IS\n-B744/H\n' + fpl());
  assertSameExcept(unclosedFirst, BASE, [], 'unclosed first');
  assert.ok(hasFinding(unclosedFirst, 'WARN', 'raw', /without a closing/));

  // (b) each field malformed → that field (only) empty, WARN on it, the rest still read
  const cases = [
    [{ f7: 'TST-123' }, null],                                       // extra hyphen → field count changes (below)
    [{ f7: 'TOOLONG12' }, ['flightId'], 'flightId'],
    [{ f7: 'T' }, ['flightId'], 'flightId'],
    [{ f7: 'tst123' }, ['flightId'], 'flightId'],
    [{ f8: 'Q' }, ['flightRules', 'flightType'], 'flightRules'],
    [{ f8: 'IQ' }, ['flightRules', 'flightType'], 'flightRules'],
    [{ f8: 'ISS' }, ['flightRules', 'flightType'], 'flightRules'],
    [{ f9: 'B744' }, ['aircraftType', 'wake'], 'aircraftType'],
    [{ f9: 'B744/' }, ['aircraftType', 'wake'], 'aircraftType'],
    [{ f9: 'B7444/H' }, ['aircraftType', 'wake'], 'aircraftType'],
    [{ f9: '/H' }, ['aircraftType', 'wake'], 'aircraftType'],
    [{ f9: 'B744/X' }, ['wake'], 'wake'],                            // type still read, wake not guessed
    [{ f9: 'B744/HH' }, ['aircraftType', 'wake'], 'aircraftType'],
    [{ f10: 'SDE1E2' }, ['equipment', 'surveillance'], 'equipment'],
    [{ f10: 'S/' }, ['equipment', 'surveillance'], 'equipment'],
    [{ f10: '/LB1' }, ['equipment', 'surveillance'], 'equipment'],
    [{ f10: 'S12/C' }, ['equipment', 'surveillance'], 'equipment'],
    [{ f13: 'KAAA' }, ['departure', 'eobt'], 'departure'],
    [{ f13: 'KAA1755' }, ['departure', 'eobt'], 'departure'],
    [{ f13: 'KAAA2460' }, ['eobt'], 'eobt'],                         // aerodrome read, EOBT not
    [{ f13: 'KAAA2400' }, ['eobt'], 'eobt'],
    [{ f15: 'AAA1R AAA N852 BBBBB' }, ['route'], 'route'],
    [{ f15: 'N481F320 AAA' }, ['route'], 'route'],
    [{ f15: '' }, ['route'], 'route'],
    [{ f16: 'KBBB KCCC' }, ['destination', 'eet', 'alternates'], 'destination'],
    [{ f16: 'KBBB093 KCCC' }, ['destination', 'eet', 'alternates'], 'destination'],
    [{ f16: '' }, ['destination', 'eet', 'alternates'], 'destination'],
    [{ f16: 'KBBB0960 KCCC' }, ['eet'], 'eet'],                      // destination read, EET not
    [{ f16: 'KBBB0933 KCC1' }, ['alternates'], 'alternates'],
    [{ f16: 'KBBB0933 KCCC 12' }, ['alternates'], 'alternates', ['KCCC']],
  ];
  for (const [patch, emptied, warnField, keep] of cases) {
    if (!emptied) continue;
    const label = JSON.stringify(patch);
    const r = mod.parseIcaoFpl(fpl(patch));
    assert.equal(r.found, true, `${label}: found`);
    for (const f of emptied) {
      if (f === 'alternates') assert.deepEqual(r.alternates, keep || [], `${label}: alternates`);
      else assert.equal(r[f], '', `${label}: ${f} empty`);
    }
    assert.ok(hasFinding(r, 'WARN', warnField), `${label}: WARN on ${warnField} — ${JSON.stringify(r.findings)}`);
    assertSameExcept(r, BASE, emptied, label);
  }

  // (c) DOF not a real date → dof empty + WARN; the raw text stays in other.DOF
  for (const d of ['260230', '270229', '261301', '260001', '260100', '26038', '2603081', 'TODAY', '991332']) {
    const r = mod.parseIcaoFpl(fpl({ f18: `DOF/${d} REG/N000ZZ` }));
    assert.equal(r.dof, '', `DOF/${d}: dof empty`);
    assert.equal(r.other.DOF, d, `DOF/${d}: kept as filed in other`);
    assert.ok(hasFinding(r, 'WARN', 'dof'), `DOF/${d}: WARN`);
    assert.equal(r.reg, 'N000ZZ');
  }
  const emptyDof = mod.parseIcaoFpl(fpl({ f18: 'DOF/ REG/N000ZZ' }));
  assert.equal(emptyDof.dof, ''); assert.equal(emptyDof.other.DOF, '');
  assert.ok(hasFinding(emptyDof, 'WARN', 'other.DOF', /no text/));

  // (d) too few fields (one missing, or a hyphen joins two): nothing positional is guessed
  const short = '(FPL-TST123-IS\n-B744/H-SDE/LB1\n-KAAA1755\n-N0481F320 AAA\n-PBN/A1 DOF/260308)';
  const s = mod.parseIcaoFpl(short);
  assert.equal(s.found, true); assert.equal(s.raw, short);
  for (const f of STRING_FIELDS.filter(f => f !== 'raw')) assert.equal(s[f], '', `short: ${f} empty`);
  assert.deepEqual(s.alternates, []); assert.deepEqual(s.other, {});
  assert.ok(hasFinding(s, 'WARN', 'raw', /expected 8/));
  // an extra hyphen in field 7 shifts the fields: each shifted field fails its syntax — WARNs, no guessed value
  const shifted = mod.parseIcaoFpl(fpl({ f7: 'TST-123' }));
  assert.equal(shifted.flightId, 'TST'); assert.equal(shifted.flightRules, '');
  assert.ok(warns(shifted).length >= 5, 'every shifted field WARNs');

  // (e) copies that differ → the first is read, WARN
  const differ = mod.parseIcaoFpl(fpl() + '\n' + fpl({ f9: 'B748/H' }) + '\n' + fpl());
  assertSameExcept(differ, BASE, [], 'differing copies');
  assert.ok(hasFinding(differ, 'WARN', 'raw', /3 FPL blocks, 1 differ/));
  // a copy that differs only in line wrapping is the same plan
  const rewrapped = mod.parseIcaoFpl(fpl() + '\n' + fpl().replace('KBBB0933 KCCC', 'KBBB0933\nKCCC'));
  assert.deepEqual(rewrapped.findings, []);

  // (f) three alternates (Doc 4444 allows two in field 16): all read, WARN
  const three = mod.parseIcaoFpl(fpl({ f16: 'KBBB0933 KCCC KDDD KEEE' }));
  assert.deepEqual(three.alternates, ['KCCC', 'KDDD', 'KEEE']);
  assert.ok(hasFinding(three, 'WARN', 'alternates', /3 alternates/));

  // (g) field 18 problems: repeated indicator (joined, WARN); text before the first indicator; hyphen inside
  const rep = mod.parseIcaoFpl(fpl({ f18: 'RMK/ONE DOF/260308 RMK/TWO' }));
  assert.equal(rep.rmk, 'ONE TWO');
  assert.ok(hasFinding(rep, 'WARN', 'other.RMK', /more than once/));
  const lead = mod.parseIcaoFpl(fpl({ f18: 'GARBAGE DOF/260308' }));
  assert.equal(lead.dof, '2026-03-08');
  assert.ok(hasFinding(lead, 'WARN', 'other', /before the first indicator/));
  assert.ok(!JSON.stringify(lead.other).includes('GARBAGE'), 'unread text not put in any item');
  const noInd = mod.parseIcaoFpl(fpl({ f18: 'FREE TEXT ONLY' }));
  assert.deepEqual(noInd.other, {});
  assert.ok(hasFinding(noInd, 'WARN', 'other', /before the first indicator/));
  const hyph = mod.parseIcaoFpl(fpl({ f18: 'DOF/260308 RMK/CTC 1-800-000' }));
  assert.equal(hyph.rmk, 'CTC 1-800-000');
  assert.ok(hasFinding(hyph, 'WARN', 'other', /hyphen/));
  assertSameExcept(hyph, BASE, ['reg', 'sel', 'rmk', 'other'], 'hyphen in field 18');
});

// ══ TC-152-012 no state, fresh results ═══════════════════════════════════════

test('TC-152-012 no state between calls; fresh result objects; never throws', () => {
  const inputs = syntheticInputs();
  const first = inputs.map(t => plain(mod.parseIcaoFpl(t)));
  const reversed = inputs.slice().reverse().map(t => plain(mod.parseIcaoFpl(t))).reverse();
  assert.deepEqual(reversed, first, 'order of calls does not matter');
  const a = mod.parseIcaoFpl(fpl()), b = mod.parseIcaoFpl(fpl());
  assert.notEqual(a, b); assert.notEqual(a.alternates, b.alternates); assert.notEqual(a.other, b.other); assert.notEqual(a.findings, b.findings);
  a.alternates.push('XXXX'); a.other.DOF = 'X'; a.findings.push({});
  assert.deepEqual(plain(mod.parseIcaoFpl(fpl())), plain(b));
  const e1 = mod.parseIcaoFpl(''), e2 = mod.parseIcaoFpl('');
  assert.notEqual(e1.other, e2.other); assert.notEqual(e1.alternates, e2.alternates);
  // a sweep of odd inputs: every one returns the result shape, none throws
  const odd = ['(FPL-)', '(FPL--------)', '(FPL-' + '-'.repeat(40) + ')', '((FPL-A-B))', '(FPL-\n)', ')(FPL-',
               fpl().slice(0, -1) + '\n-' + ')', fpl({ f18: '' }), fpl({ f18: '/ / /' }), fpl({ f18: 'DOF/' }), 'x'.repeat(5000)];
  for (const t of odd) {
    const r = mod.parseIcaoFpl(t);
    assert.deepEqual(Object.keys(r), FIELDS, `shape for ${JSON.stringify(t).slice(0, 30)}`);
    for (const f of r.findings) assert.ok(['INFO', 'WARN'].includes(f.level) && typeof f.field === 'string' && typeof f.message === 'string');
  }
});

// ══ TC-152-020 fixtures: consistency with the NavBlue parser ═════════════════

// What the NavBlue parser (locked, D47) reads from the same text, and what this reader reads.
// Returns per-fixture differences (field names only) and the reported counts.
function consistency(api) {
  const dir = requireFixturesDir();
  const list = readManifest(dir).fixtures;
  const P = navblue.PATTERNS;
  const out = { navblue: 0, flightkeys: 0, found: 0, diffs: [], warns: [], notFound: [], report: [] };
  for (const fx of list) {
    const text = fs.readFileSync(path.join(dir, fx.files.text), 'utf8');
    const r = api.parseIcaoFpl(text);
    const isNb = NAVBLUE_FORMATS.has(fx.format);
    if (isNb) out.navblue++; else out.flightkeys++;
    if (r.found) out.found++; else out.notFound.push(fx.id);
    if (warns(r).length) out.warns.push(`${fx.id}: ${warns(r).map(w => w.field).join(', ')}`);
    out.report.push({ id: fx.id, format: fx.format, equipmentCodes: (r.equipment.match(/[A-Z]\d?/g) || []).length,
      surveillanceCodes: (r.surveillance.match(/[A-Z]\d?/g) || []).length, routeElements: r.route ? r.route.split(' ').length : 0,
      alternates: r.alternates.length, field18Items: Object.keys(r.other).length, reg: r.reg ? 1 : 0 });
    if (!isNb) continue;
    const g = re => { const m = text.match(re); return m; };
    const fltM = g(P.FLIGHT_ID_FPL), typM = g(P.AIRCRAFT_TYPE), wakeM = g(P.FPL_WAKE), dofM = g(P.DATE_DOF);
    const core = navblue._ofpRulesetParse(text);
    const expected = {
      flightId:     fltM ? fltM[1] : '',
      aircraftType: typM ? typM[1] : '',
      wake:         wakeM ? wakeM[1] : '',
      dof:          dofM ? `${2000 + parseInt(dofM[1], 10)}-${dofM[2]}-${dofM[3]}` : '',
    };
    const d = [];
    for (const k of Object.keys(expected)) if (r[k] !== expected[k]) d.push(k);
    // the NavBlue core fields built from those patterns
    if (core.acftType !== r.aircraftType) d.push('aircraftType (core acftType)');
    if (core.isHeavy !== /^[HJ]$/.test(r.wake)) d.push('wake (core isHeavy)');
    if (dofM && core.flightDateISO !== r.dof) d.push('dof (core flightDateISO)');
    if (!fltM || !typM || !wakeM || !dofM) d.push('NavBlue pattern did not match');
    if (d.length) out.diffs.push(`${fx.id}: ${d.join(', ')}`);
  }
  return out;
}

test('TC-152-020 every NavBlue fixture: found; flightId, aircraftType, wake, dof = the NavBlue parser; FlightKeys found; no WARN', (t) => {
  const c = consistency(mod);
  assert.ok(c.navblue >= 30, `at least the 30 NavBlue/eOFP packages (found ${c.navblue})`);
  assert.deepEqual(c.notFound, [], 'every fixture has an FPL block');
  assert.deepEqual(c.diffs, [], 'differences from the NavBlue parser (fixture: field)');
  assert.deepEqual(c.warns, [], 'WARN findings (fixture: field)');
  // reported, not asserted: counts per fixture (no values)
  t.diagnostic(`consistency: ${c.navblue} NavBlue/eOFP fixtures, 4 fields each, ${c.diffs.length} differences; ${c.flightkeys} FlightKeys; found ${c.found}/${c.navblue + c.flightkeys}`);
  for (const x of c.report)
    t.diagnostic(`${x.id}: equipment ${x.equipmentCodes} codes, surveillance ${x.surveillanceCodes}, route ${x.routeElements} elements, alternates ${x.alternates}, field 18 items ${x.field18Items}, REG ${x.reg}`);
});

// ══ TC-152-021 the gate bites ════════════════════════════════════════════════

test('TC-152-021 the gate bites: a reader with one rule broken fails the consistency check', () => {
  const mutants = [
    ['wake fixed to M', "if (WAKE_CATEGORIES.includes(m[3])) r.wake = m[3];", "if (WAKE_CATEGORIES.includes(m[3])) r.wake = 'M';", /wake/],
    ['type from the wrong group', 'r.aircraftType = m[2];', "r.aircraftType = m[2].slice(0, 3);", /aircraftType/],
    ['flight id without its last digit', 'if (m) r.flightId = m[1];', 'if (m) r.flightId = m[1].slice(0, -1);', /flightId/],
    ['DOF read as 19YY', 'const y = 2000 + parseInt', 'const y = 1900 + parseInt', /dof/],
  ];
  for (const [name, from, to, re] of mutants) {
    assert.equal(MOD_SRC.split(from).length, 2, `${name}: anchor found once`);
    const m = { exports: {} };
    new Function('module', 'exports', 'require', MOD_SRC.replace(from, to))(m, m.exports, () => { throw new Error('require used'); });
    const c = consistency(m.exports);
    assert.ok(c.diffs.length >= 30 && c.diffs.every(d => re.test(d)), `${name}: caught on every NavBlue fixture (${c.diffs.length})`);
  }
});

// ══ TC-152-030 fixtures missing → FAIL ═══════════════════════════════════════

test('TC-152-030 fixtures missing → the fixture comparison fails (never skip)', () => {
  const saved = process.env.PB_FIXTURES;
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-nofix-'));
  try {
    process.env.PB_FIXTURES = empty;
    assert.throws(() => consistency(mod), /fixtures not found/);
  } finally {
    if (saved === undefined) delete process.env.PB_FIXTURES; else process.env.PB_FIXTURES = saved;
    fs.rmSync(empty, { recursive: true, force: true });
  }
});
