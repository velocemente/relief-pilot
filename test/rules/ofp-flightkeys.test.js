'use strict';
/**
 * TC-160 — FlightKeys OFP parser (rules/ofp-flightkeys, v0.1.0 development version, D58)
 *
 * A NEW format parser (ADR-005 §2.1): parseFlightKeys(input, options) reads a FlightKeys package
 * (the extractor's text + positioned items) and returns the briefing contract (57 core fields with
 * the NavBlue meanings and types, FK-P; Appendix B extensions; findings[]). Not built into the app.
 *
 *   TC-160-001  metadata; validateSchema() valid; broken objects rejected
 *   TC-160-002  rules/manifest.json: the ofp-flightkeys entry, version, file, SHA-256
 *   TC-160-003  dual context (Node, rules-loader, browser global OfpFlightKeys); loaded and run with
 *               window, document, storage, Date and app globals that THROW on access — none touched;
 *               the shared modules are used only when passed in
 *   TC-160-004  not in the app: index.html, build/build.js and src/ do not name it
 *   TC-160-005  contract shape on every FlightKeys fixture: 57 core fields in order, 13 extensions,
 *               airport extensions on every airportData entry, NavBlue types; every deferred field
 *               an explicit empty with exactly one INFO finding naming its step (5b-2 / 5d)
 *   TC-160-006  input mapping (inputFromExtractor) and input checks; null for empty text; no state
 *               between calls
 *   TC-160-010  rows 1–4, 5–8a, SME-1/2/5/16 on all 26 FlightKeys fixtures against the expected
 *               values (test/rules/data/ofp-flightkeys-expected-v0.1.0.json, no crew data) and the
 *               field-map counts
 *   TC-160-011  date (D57): DOF present / OFP header only / neither → '' + WARN / impossible → '' + WARN
 *   TC-160-012  airport line without a 3-letter code (L22, and synthetic on every line keyword)
 *   TC-160-013  Q token (SME-2): positive and negative; text and positions disagree → positions + WARN
 *   TC-160-030  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Fixtures: PB_FIXTURES (authoritative when set), else ./fixtures or ../pilotbrief-fixtures.
 * Messages name fixture labels/ids and field names; no crew data is read or printed.
 * Expected values were taken from the release text by a separate, simpler extraction (one grep per
 * field) and checked against the field map v1.1 counts; they are not the module's own output.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const crypto = require('crypto');
const { findFixtures, readManifest } = require('../lib/app-path');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const MOD_FILE = path.join(RULES, MANIFEST['ofp-flightkeys'].file);
const MOD_SRC  = fs.readFileSync(MOD_FILE, 'utf8');
const mod      = require(MOD_FILE);
const icaoFpl  = require(path.join(RULES, MANIFEST['icao-fpl'].file));
const acProf   = require(path.join(RULES, MANIFEST['aircraft-profile'].file));
const navblue  = require(path.join(RULES, MANIFEST['ofp-navblue'].file));
const OPTS     = { icaoFpl, aircraftProfile: acProf };
const EXPECTED = require('./data/ofp-flightkeys-expected-v0.1.0.json');

const plain = v => JSON.parse(JSON.stringify(v));
const warns = (r, field) => r.findings.filter(f => f.level === 'WARN' && (!field || f.field === field));

// ── synthetic FlightKeys release (made-up identifiers; no fixture data) ──────
const REL_HDR = 'TST0001/08MAR/KAAA-KBBB/N000ZZ';
function fplBlock({ dof = 'DOF/260308 ', type = 'B744/H' } = {}) {
  return ['(FPL-TST0001-IS', `-${type}-SDE1E2E3FGHIJ3J5M1P2RWXYZ/LB1D1`, '-KAAA1755',
    '-N0481F320 DCT AAAAA DCT BBBBB', '-KBBB0933 KCCC',
    `-PBN/A1B1 ${dof}REG/N000ZZ SEL/ABCD RMK/TCAS II EQUIPPED)`];
}
function release({ identity = 'TST0001/08 KAAA - KBBB 08 MAR 26 N000ZZ', airports, extraP1 = [], fpl } = {}) {
  const apts = airports || [
    'ORIG KAAA/AAA ALPHA INTL N40000W080000 1755Z',
    'DEST KBBB/BBB BRAVO INTL N41000W081000 0328Z',
    'PALT KCCC/CCC CHARLIE N42000W082000 0345Z',
  ];
  const page = (n, of, body) => [REL_HDR, 'OPERATIONAL FLIGHT PLAN RLS 01 08MAR26 12:00', ...body,
    `FUFI: 00000000-0000-0000-0000-000000000000 PAGE ${n}/${of}`].join('\n') + '\n\n';
  const p1 = [identity, 'COST INDEX 020 Revision: 1.0', 'B747-400F / CF6-80C2-B1F / KG / IFR / FF +4.0',
    'PROGS 081200 Release Valid Until 2300Z 08MAR26', ...apts, ...extraP1];
  const p2 = ['TIME FUEL', ...(fpl === null ? [] : (fpl || fplBlock()))];
  return 'BRIEFING COVER PAGE\n\n' + page(1, 2, p1) + page(2, 2, p2) + 'NOTAM BRIEFING PAGE\n\n';
}
const parseText = (text, opts = OPTS) => mod.parseFlightKeys({ text, pages: [] }, opts);

// ══ TC-160-001 metadata, validateSchema ══════════════════════════════════════

test('TC-160-001 metadata; validateSchema() valid; broken objects rejected', () => {
  assert.equal(mod.RULESET_TYPE, 'ofp');
  assert.equal(mod.OFP_FORMAT, 'flightkeys');
  assert.equal(mod.RULESET_VERSION, '0.1.0');
  assert.equal(mod.SCHEMA_VERSION, 2);
  assert.equal(mod.CONTRACT_VERSION, '2.1');
  assert.ok(mod.RULESET_SOURCE.length > 10);
  assert.deepEqual(mod.validateSchema(), { valid: true, errors: [] });
  assert.deepEqual([...mod.CORE_FIELDS], [...navblue.CORE_FIELDS], 'core fields = NavBlue core fields, same order');
  assert.deepEqual(mod.EXTENSION_FIELDS.filter(f => f !== 'swa'), [...navblue.EXTENSION_FIELDS],
    'extensions = contract v2.0 list + swa (addendum)');
  assert.deepEqual([...mod.AIRPORT_EXTENSION_FIELDS], [...navblue.AIRPORT_EXTENSION_FIELDS, 'specialQualification']);
  assert.deepEqual([...mod.DDG_EXTENSION_FIELDS], [...navblue.DDG_EXTENSION_FIELDS]);
  const copy = () => Object.assign({}, mod);
  const broken = [
    [o => { delete o.parseFlightKeys; }, /missing export: parseFlightKeys/],
    [o => { o.RULESET_TYPE = 'notam'; }, /RULESET_TYPE/],
    [o => { o.OFP_FORMAT = 'navblue'; }, /OFP_FORMAT/],
    [o => { o.RULESET_VERSION = '0.1'; }, /semver/],
    [o => { o.SCHEMA_VERSION = 1; }, /SCHEMA_VERSION/],
    [o => { o.CONTRACT_VERSION = '1.0'; }, /CONTRACT_VERSION/],
    [o => { o.RULESET_SOURCE = ' '; }, /RULESET_SOURCE/],
    [o => { o.CORE_FIELDS = mod.CORE_FIELDS.slice(1); }, /CORE_FIELDS must list 57/],
    [o => { o.EXTENSION_FIELDS = [...mod.EXTENSION_FIELDS.slice(0, -1), 'fltNum']; }, /both a core field|end with findings/],
    [o => { o.AIRPORT_EXTENSION_FIELDS = ['remarks', 'remarks', 'x']; }, /unique/],
    [o => { o.PATTERNS = { X: 'not a regexp' }; }, /PATTERNS\.X/],
    [o => { o.DEFERRED_FIELDS = { nope: '5d' }; }, /not a contract field/],
    [o => { o.DEFERRED_FIELDS = { crewMembers: '6' }; }, /not 5b-2 or 5d/],
    [o => { o.parseNavBlue = () => null; }, /parseNavBlue must not be exported/],
    [o => { o.deriveCallsign = () => null; }, /deriveCallsign must not be exported/],
  ];
  for (const [breakIt, re] of broken) {
    const o = copy(); breakIt(o);
    const v = mod.validateSchema(o);
    assert.equal(v.valid, false, `rejected: ${re}`);
    assert.ok(v.errors.some(e => re.test(e)), `${re} in ${v.errors.join('; ')}`);
  }
  assert.equal(mod.validateSchema(null).valid, false);
});

// ══ TC-160-002 manifest ══════════════════════════════════════════════════════

test('TC-160-002 rules/manifest.json lists ofp-flightkeys 0.1.0 with its SHA-256', () => {
  const e = MANIFEST['ofp-flightkeys'];
  assert.deepEqual(Object.keys(e), ['version', 'file', 'sha256']);
  assert.equal(e.version, mod.RULESET_VERSION);
  assert.equal(e.file, 'ofp-flightkeys/ofp-flightkeys-v0.1.0.js');
  assert.equal(e.sha256, crypto.createHash('sha256').update(fs.readFileSync(MOD_FILE)).digest('hex'));
});

// ══ TC-160-003 dual context, no app state ════════════════════════════════════

const TRAPPED_GLOBALS = ['window', 'document', 'self', 'top', 'parent', 'navigator', 'location',
  'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'Date',
  'S', 'pdfRawText', 'airportData', '_flightDateISO', 'NotamRules', 'OfpNavBlue', 'AircraftProfile',
  'IcaoFpl', 'parseNatTrack', 'PATTERNS', 'parseOFP', '_ofpRulesetParse'];
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
  touched.length = 0;
  return { ctx, touched };
}
function loadInContext(src, ctx, filename) {
  const m = { exports: {} };
  vm.runInContext(`(function (module, exports) {\n${src}\n})`, ctx, { filename })(m, m.exports);
  return m.exports;
}
function exercise(api) {
  return {
    v: plain(api.validateSchema()),
    r: [release(), release({ airports: ['ORIG KAAA/ ALPHA Q N40000W080000 1755Z'] }), 'x', '', null]
      .map(t => plain(api.parseFlightKeys({ text: t, pages: [] }, OPTS))),
  };
}

test('TC-160-003 dual context; no window / DOM / storage / clock / app globals; modules only when passed in', () => {
  const base = exercise(mod);
  const m = { exports: {} };
  new Function('module', 'exports', 'require', MOD_SRC)(m, m.exports, () => { throw new Error('require used'); });
  assert.deepEqual(exercise(m.exports), base, 'rules-loader');
  const ctx = vm.createContext({});
  const before = new Set(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx));
  vm.runInContext(MOD_SRC, ctx, { filename: 'ofp-flightkeys (browser)' });
  const added = vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx).filter(n => !before.has(n));
  assert.deepEqual([...added], ['OfpFlightKeys']);
  assert.deepEqual(exercise(vm.runInContext('OfpFlightKeys', ctx)), base, 'browser global');
  for (const asScript of [false, true]) {
    const { ctx: t, touched } = trappedContext();
    const api = asScript ? (vm.runInContext(MOD_SRC, t, { filename: 'trapped (browser)' }), vm.runInContext('OfpFlightKeys', t))
                         : loadInContext(MOD_SRC, t, 'trapped (module)');
    assert.deepEqual(exercise(api), base);
    assert.deepEqual(touched, [], `globals touched: ${touched}`);
  }
  const code = MOD_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, "''");
  for (const g of ['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'navigator',
                   'Date', 'OfpNavBlue', 'AircraftProfile', 'IcaoFpl', 'NotamRules', 'require'])
    assert.ok(!new RegExp(`\\b${g}\\b`).test(code), `the module code names ${g}`);
  // Without icao-fpl: no FPL value is read, and the parser says so.
  const r = parseText(release(), {});
  assert.equal(r.acftType, '');
  assert.equal(r.isHeavy, false);
  assert.ok(warns(r, 'icaoFpl').some(f => /not supplied/.test(f.message)));
  // A passed-in NAT parser is not called in v0.1.0 (row 42 is read in 5d).
  let called = 0;
  const rn = parseText(release(), Object.assign({ parseNatTrack: () => { called++; return {}; } }, OPTS));
  assert.equal(called, 0);
  assert.equal(rn.natTrack, null);
});

// ══ TC-160-004 not in the app ════════════════════════════════════════════════

test('TC-160-004 not built into the app: index.html, build/build.js and src/ do not name it', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const build = fs.readFileSync(path.join(ROOT, 'build', 'build.js'), 'utf8');
  for (const s of ['OfpFlightKeys', 'parseFlightKeys', 'ofp-flightkeys']) assert.ok(!html.includes(s), `index.html: ${s}`);
  assert.ok(!build.includes('ofp-flightkeys'));
  const srcFiles = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true })
    .filter(f => fs.statSync(path.join(ROOT, 'src', f)).isFile());
  for (const f of srcFiles)
    assert.ok(!/OfpFlightKeys|parseFlightKeys|ofp-flightkeys/.test(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')), `src/${f}`);
});

// ══ synthetic: input, dates, airport lines, Q ════════════════════════════════

test('TC-160-006 input mapping and checks; null for empty text; no state between calls', () => {
  for (const bad of [null, undefined, {}, { text: '' }, { text: '   ' }, { text: 42 }, 'plain string'])
    assert.equal(mod.parseFlightKeys(bad, OPTS), null);
  const itemsDoc = { pages: [{ n: 1, width: 595, height: 842, items: [{ str: 'A', x: 1, y: 2, w: 3, h: 4, font: 'f' }, { str: 'B', x: 5, y: 6, w: 7, h: 8, font: 'g' }] }] };
  assert.deepEqual(mod.inputFromExtractor('A B\n\n', itemsDoc), { text: 'A B\n\n', pages: [{ page: 1, width: 595, height: 842,
    items: [{ str: 'A', x: 1, y: 2, w: 3, h: 4, font: 'f', order: 0 }, { str: 'B', x: 5, y: 6, w: 7, h: 8, font: 'g', order: 1 }] }] });
  const noPages = mod.parseFlightKeys({ text: release() }, OPTS);
  assert.ok(warns(noPages, 'input').some(f => /not supplied/.test(f.message)));
  const a = parseText(release()), b = parseText(release());
  assert.deepEqual(plain(a), plain(b));
  a.altData.push({}); a.findings.push({});
  assert.deepEqual(plain(parseText(release())), plain(b), 'fresh objects each call');
  const none = parseText('no release here\n\n');
  assert.ok(warns(none, 'release').length === 1);
  assert.equal(none.fltNum === '' && none.origIcao === '' && none.altData.length === 0, true);
});

test('TC-160-011 date (D57): DOF / OFP header only / neither / impossible — never free text', () => {
  // DOF present (and equal to the header)
  let r = parseText(release());
  assert.equal(r.flightDateISO, '2026-03-08');
  assert.equal(r.dateStr, '08 MAR 26');
  assert.deepEqual(warns(r, 'flightDateISO'), []);
  // DOF present, header differs → DOF + WARN
  r = parseText(release({ identity: 'TST0001/08 KAAA - KBBB 09 MAR 26 N000ZZ' }));
  assert.equal(r.flightDateISO, '2026-03-08');
  assert.ok(warns(r, 'flightDateISO').some(f => /differ/.test(f.message)));
  // header only (no DOF filed)
  r = parseText(release({ fpl: fplBlock({ dof: '' }) }));
  assert.equal(r.flightDateISO, '2026-03-08');
  assert.equal(r.dateStr, '08 MAR 26');
  assert.ok(r.findings.some(f => f.field === 'flightDateISO' && f.level === 'INFO' && /OFP header/.test(f.message)));
  // header only (no FPL at all) — and a date in free text elsewhere is never used
  r = parseText(release({ fpl: null, extraP1: ['REMARK VALID 12 APR 26'] }));
  assert.equal(r.flightDateISO, '2026-03-08');
  // neither → '' + WARN, even with dates in free text
  r = parseText(release({ identity: 'TST0001/08 KAAA - KBBB N000ZZ', fpl: fplBlock({ dof: '' }), extraP1: ['NEXT 12 APR 26 DOF/260412'] }));
  assert.equal(r.flightDateISO, '');
  assert.equal(r.dateStr, '');
  assert.ok(warns(r, 'flightDateISO').some(f => /no valid flight date/.test(f.message)));
  // impossible DOF and no header date → '' + WARN
  r = parseText(release({ identity: 'TST0001/08 KAAA - KBBB N000ZZ', fpl: fplBlock({ dof: 'DOF/260230 ' }) }));
  assert.equal(r.flightDateISO, '');
  assert.ok(warns(r, 'flightDateISO').some(f => /DOF is not a real date/.test(f.message)));
  assert.ok(warns(r, 'flightDateISO').some(f => /no valid flight date/.test(f.message)));
  // impossible header date and no DOF → '' + WARN
  r = parseText(release({ identity: 'TST0001/08 KAAA - KBBB 31 NOV 26 N000ZZ', fpl: fplBlock({ dof: '' }) }));
  assert.equal(r.flightDateISO, '');
  assert.ok(warns(r, 'flightDateISO').some(f => /header date is not a real date/.test(f.message)));
  // impossible DOF, valid header → header + WARN on the DOF
  r = parseText(release({ fpl: fplBlock({ dof: 'DOF/261341 ' }) }));
  assert.equal(r.flightDateISO, '2026-03-08');
  assert.ok(warns(r, 'flightDateISO').some(f => /DOF is not a real date/.test(f.message)));
  // leap day
  r = parseText(release({ identity: 'TST0001/29 KAAA - KBBB 29 FEB 28 N000ZZ', fpl: fplBlock({ dof: 'DOF/280229 ' }) }));
  assert.equal(r.flightDateISO, '2028-02-29');
  assert.equal(r.dateStr, '29 FEB 28');
});

test('TC-160-012 airport line without a 3-letter code (rows 5–6, not NavBlue NB-F1)', () => {
  const kws = ['ORIG', 'DEST', 'PALT', 'SALT', 'RAPT', 'RALT', 'TALT'];
  const lines = kws.map((k, i) => `${k} KA${String.fromCharCode(65 + i)}A/ NAME ${k} N4${i}000W08${i}000 ${String(10 + i).padStart(2, '0')}00Z`);
  const r = parseText(release({ airports: lines }));
  assert.equal(r.origIcao, 'KAAA');
  assert.equal(r.offFromOFP, '1000');
  assert.equal(r.destIcao, 'KABA');
  assert.equal(r.etaDest, '1100');
  assert.equal(r.destEtaOffsetMins, 60);
  // NavBlue role rule (D55), OFP p1 line order (SME-1)
  assert.deepEqual(r.altData.map(a => [a.icao, a.role, a.ofpEta, a.ofpOffsetMins]), [
    ['KACA', 'DEST ALT', '1200', 120], ['KADA', 'DEST ALT', '1300', 180], ['KAEA', 'EN ROUTE ALT', '1400', 240],
    ['KAFA', 'EN ROUTE ALT', '1500', 300], ['KAGA', 'TKOF ALT', '1600', 360]]);
  assert.equal(r.findings.filter(f => /no 3-letter code/.test(f.message)).length, 7);
  // the NavBlue template misses it (the defect this rule fixes)
  assert.equal(navblue._ofpRulesetParse(release({ airports: lines })).origIcao, '');
  // negative: no airport line at all → empty + WARN; a non-airport "SALT LAKE …" line is not an alternate
  const n = parseText(release({ airports: ['SALT LAKE ARTCC HIGH', 'DEST WX.'] }));
  assert.equal(n.origIcao, '');
  assert.equal(n.destIcao, '');
  assert.deepEqual(n.altData, []);
  assert.ok(warns(n, 'origIcao').length === 1 && warns(n, 'destIcao').length === 1);
  // a bad clock time is not taken
  const bt = parseText(release({ airports: ['ORIG KAAA/AAA A N40000W080000 2575Z', 'DEST KBBB/BBB B N41000W081000 0328Z'] }));
  assert.equal(bt.offFromOFP, '');
  assert.equal(bt.destEtaOffsetMins, null);
  assert.ok(warns(bt, 'ORIG').length === 1);
});

test('TC-160-013 Q token = Special Qualification (SME-2): text, positions, negative', () => {
  const r = parseText(release({ airports: [
    'ORIG KAAA/AAA ALPHA INTL Q N40000W080000 1755Z',
    'DEST KBBB/ BRAVO Q S41000E081000 0328Z',
    'PALT KCCC/CCC CHARLIE TOWN N42000W082000 0345Z'] }));
  assert.deepEqual(Object.keys(r.airportData), ['KAAA', 'KBBB', 'KCCC']);
  assert.deepEqual(Object.values(r.airportData).map(a => a.specialQualification), [true, true, false]);
  for (const a of Object.values(r.airportData))
    assert.deepEqual(Object.keys(a), ['weather', 'notams', 'remarks', 'remarksWeather', 'specialQualification']);
  // positions decide when they disagree with the text (a 1-letter name word "Q" at the column end)
  const text = release({ airports: ['ORIG KAAA/AAA NAME ENDS IN Q N40000W080000 1755Z', 'DEST KBBB/BBB B N41000W081000 0328Z'] });
  const items = [{ str: 'ORIG', x: 58.7, y: 100 }, { str: 'KAAA/AAA NAME ENDS IN', x: 102, y: 100 }, { str: 'Q', x: 250, y: 100 },
    { str: 'N40000W080000', x: 411.2, y: 100 }, { str: '1755Z', x: 503.6, y: 100 }];
  const pages = [{ page: 1, items: [] }, { page: 2, width: 595, height: 842, items: items.map((it, i) => Object.assign({ w: 6, h: 11, font: 'f', order: i }, it)) },
    { page: 3, items: [] }, { page: 4, items: [] }];
  const p = mod.parseFlightKeys({ text, pages }, OPTS);
  assert.equal(p.airportData.KAAA.specialQualification, false);
  assert.ok(warns(p, 'specialQualification').length === 1);
  // and a real Q item next to the lat/long confirms the text
  pages[1].items[2].x = 396.85;
  const q = mod.parseFlightKeys({ text, pages }, OPTS);
  assert.equal(q.airportData.KAAA.specialQualification, true);
  assert.deepEqual(warns(q, 'specialQualification'), []);
});

// ══ fixtures ═════════════════════════════════════════════════════════════════

const FIXTURES = findFixtures();
if (!FIXTURES) {
  test('TC-160-030 fixtures missing → the fixture tests FAIL (never skip)', () => {
    assert.fail('pilotbrief-fixtures not found (set PB_FIXTURES or clone it beside the repo): TC-160-005/010 cannot run');
  });
} else {
  const manifest = readManifest(FIXTURES);
  const fkFixtures = manifest.fixtures.filter(f => f.format === 'flightkeys');
  const cache = new Map();
  const runFixture = fx => {
    if (!cache.has(fx.id)) {
      const text = fs.readFileSync(path.join(FIXTURES, fx.files.text), 'utf8');
      const items = JSON.parse(fs.readFileSync(path.join(FIXTURES, fx.files.items), 'utf8'));
      cache.set(fx.id, mod.parseFlightKeys(mod.inputFromExtractor(text, items), OPTS));
    }
    return cache.get(fx.id);
  };
  const byLabel = Object.fromEntries(Object.entries(EXPECTED).map(([id, e]) => [e.label, id]));

  test('TC-160-030 the fixture set is complete: 26 FlightKeys packages, each with expected values', () => {
    assert.equal(fkFixtures.length, 26);
    assert.deepEqual(fkFixtures.map(f => f.id).sort(), Object.keys(EXPECTED).sort());
    for (const fx of fkFixtures) {
      assert.ok(fs.existsSync(path.join(FIXTURES, fx.files.text)), `${fx.id}: text`);
      assert.ok(fs.existsSync(path.join(FIXTURES, fx.files.items)), `${fx.id}: items`);
    }
  });

  test('TC-160-005 contract shape on every FlightKeys fixture; deferred fields empty with one INFO each', () => {
    for (const fx of fkFixtures) {
      const r = runFixture(fx);
      const lbl = EXPECTED[fx.id].label;
      assert.deepEqual(Object.keys(r), [...mod.CORE_FIELDS, ...mod.EXTENSION_FIELDS], `${lbl}: field order`);
      for (const [icao, a] of Object.entries(r.airportData))
        for (const k of mod.AIRPORT_EXTENSION_FIELDS) assert.ok(k in a, `${lbl} ${icao}: ${k}`);
      for (const f of Object.keys(mod.DEFERRED_FIELDS)) {
        const n = r.findings.filter(x => x.level === 'INFO' && x.field === f && /^not read in v0\.1\.0: read in (5b-2|5d)$/.test(x.message)).length;
        assert.equal(n, 1, `${lbl}: one INFO for ${f}`);
      }
      // explicit empties with the NavBlue types
      assert.deepEqual(r.crewMembers, []); assert.equal(r.catIiIiiApproaches, null); assert.deepEqual(r.ddgItems, []);
      assert.equal(r.melItems, ''); assert.equal(r.overflightPerms, ''); assert.deepEqual(r.oeiData, []);
      assert.equal(r.hasPerishables, false); assert.equal(r.hasTemperatureControl, false); assert.equal(r.natTrack, null);
      assert.deepEqual(r.enrouteNotams, { route: '', fir: '', airway: '', waypoint: '', geographic: '' });
      for (const a of Object.values(r.airportData)) {
        assert.equal(a.weather, ''); assert.equal(a.notams, ''); assert.deepEqual(a.remarks, []); assert.deepEqual(a.remarksWeather, []);
      }
      for (const k of ['companyNotams', 'ofpRemarks', 'catIiIiiRestrictions', 'securityMessages', 'permits', 'sections'])
        assert.deepEqual(r[k], [], `${lbl}: ${k}`);
      for (const k of ['revision', 'fplEquipment', 'extraFuel', 'pcf']) assert.equal(r[k], null, `${lbl}: ${k}`);
      assert.equal(typeof r.rawOFP, 'string');
      for (const f of r.findings) assert.ok(['INFO', 'WARN'].includes(f.level) && f.field && f.message, `${lbl}: finding shape`);
    }
  });

  test('TC-160-010 rows 1–8a on 26 fixtures: identity, type, date, airports, alternates, Q (SME-1/2/5/16)', () => {
    const fields = ['fltNum', 'designator', 'acftType', 'isHeavy', 'weightUnit', 'dateStr', 'flightDateISO',
      'origIcao', 'offFromOFP', 'destIcao', 'etaDest', 'destEtaOffsetMins'];
    const tally = {};
    for (const fx of fkFixtures) {
      const r = runFixture(fx), e = EXPECTED[fx.id];
      for (const f of fields) {
        assert.deepEqual(r[f], e[f], `${e.label}: ${f}`);
        tally[f] = (tally[f] || 0) + 1;
      }
      assert.deepEqual(r.altData.map(a => ({ icao: a.icao, role: a.role, ofpEta: a.ofpEta })), e.altData, `${e.label}: altData (OFP p1 order)`);
      for (const a of r.altData) {
        const exp = (a.ofpEta.slice(0, 2) * 60 + +a.ofpEta.slice(2) - (r.offFromOFP.slice(0, 2) * 60 + +r.offFromOFP.slice(2)) + 1440) % 1440;
        assert.equal(a.ofpOffsetMins, exp, `${e.label}: ${a.icao} offset`);
        assert.equal(a.currentEta, a.ofpEta);
      }
      const q = Object.keys(r.airportData).filter(k => r.airportData[k].specialQualification);
      assert.deepEqual(q, e.specialQualification, `${e.label}: Q airports`);
      assert.deepEqual(warns(r).filter(f => ['fltNum', 'acftType', 'isHeavy', 'weightUnit', 'flightDateISO', 'origIcao', 'destIcao'].includes(f.field)), [], `${e.label}: no WARN on rows 1–6`);
    }
    // field-map v1.1 counts
    const labelsWhere = pred => fkFixtures.filter(fx => pred(runFixture(fx))).map(fx => EXPECTED[fx.id].label).sort();
    assert.deepEqual(labelsWhere(r => r.weightUnit === 'LBS'), ['L01', 'L04', 'L15', 'L21', 'L22', 'L23'], 'row 3: LB in 6');
    assert.deepEqual(labelsWhere(r => Object.values(r.airportData).some(a => a.specialQualification)),
      ['L03', 'L09', 'L10', 'L13', 'L16', 'L17', 'T1', 'T2'], 'SME-2: Q in 8');
    assert.deepEqual(labelsWhere(r => r.altData.some(a => a.role === 'EN ROUTE ALT')),
      ['L02', 'L08', 'L11', 'L12', 'L13', 'L14', 'L18', 'L19', 'L20', 'T3'], 'row 8: RAPT/RALT in 10');
    assert.deepEqual(labelsWhere(r => r.altData.some(a => a.role === 'TKOF ALT')), [], 'row 8a: no TALT');
    const d = {};
    for (const fx of fkFixtures) { const g = runFixture(fx).designator; d[g] = (d[g] || 0) + 1; }
    assert.deepEqual(d, { GTI: 23, BWA: 1, ETD: 1, CMB: 1 }, 'designators');
    // L22: origin without a 3-letter code is read; CMB550 (release/FPL), never the briefing number (SME-16)
    const l22 = runFixture(fkFixtures.find(f => f.id === byLabel.L22));
    assert.equal(l22.origIcao, 'EPPW');
    assert.equal(l22.fltNum, 'CMB550/10');
    assert.equal(l22.designator, 'CMB');
    // SME-5: L08 (Polar desk) keeps the GTI designator
    assert.equal(runFixture(fkFixtures.find(f => f.id === byLabel.L08)).designator, 'GTI');
    // date: the DOF, not the release print date (L11 printed the day before)
    assert.equal(runFixture(fkFixtures.find(f => f.id === byLabel.L11)).flightDateISO, '2026-11-04');
    assert.equal(Object.keys(tally).length, fields.length);
  });
}
