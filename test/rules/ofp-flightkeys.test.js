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
 *   TC-160-014  fuel and weights, synthetic (rows 9–23, SC block/min fuel): positive and negative;
 *               BALST, ZFW INC, ADDL FF ADJ as printed, VZFW/CK inline and NavBlue form, SWA
 *   TC-160-015  rows 9–23 + SWA on all 26 fixtures; field-map counts (ballast 4, FF ADJ 10, VZFW 9,
 *               POR MINF 10, SWA 4)
 *   TC-160-016  rows 29–31 synthetic (SC DOT exemption and slot: positive and negative): one-line and
 *               wrapped exemption, DOT-SP form, every NavBlue slot form; text outside the release
 *               Remarks (Company NOTAMs, briefing) never read
 *   TC-160-017  rows 29–31 on all 26 fixtures (exemption 6 incl. L08 wrapped, slot 1, callsign 0)
 *   TC-160-018  route, synthetic (SC ETOPS entry/exit, ETP/CFS: positive and negative): nav log with a
 *               fix split by a page break; TOC; ETOPS entry HH.MM and its cross-check; exit from (E.EXT);
 *               POR plain and "(<WPT>+nnNM) lat lon" (SME-11); ETP points; CFS windows without Z;
 *               E.ENT/E.EXIT-only airports as CFS alternates (SME-13); alternate routes; navLog [] (FK-P)
 *   TC-160-019  rows 33, 34, 36, 39–41 on all 26 fixtures; field-map counts
 *   TC-160-020  where the field map says today's NavBlue parser already reads FlightKeys right (✅
 *               rows), the module gives exactly the NavBlue value on all 26 fixtures
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
function release({ identity = 'TST0001/08 KAAA - KBBB 08 MAR 26 N000ZZ', airports, extraP1 = [], fpl, remarks, after = '' } = {}) {
  const apts = airports || [
    'ORIG KAAA/AAA ALPHA INTL N40000W080000 1755Z',
    'DEST KBBB/BBB BRAVO INTL N41000W081000 0328Z',
    'PALT KCCC/CCC CHARLIE N42000W082000 0345Z',
  ];
  const page = (n, of, body) => [REL_HDR, 'OPERATIONAL FLIGHT PLAN RLS 01 08MAR26 12:00', ...body,
    `FUFI: 00000000-0000-0000-0000-000000000000 PAGE ${n}/${of}`].join('\n') + '\n\n';
  const p1 = [identity, 'COST INDEX 020 Revision: 1.0', 'B747-400F / CF6-80C2-B1F / KG / IFR / FF +4.0',
    'PROGS 081200 Release Valid Until 2300Z 08MAR26', ...apts, ...extraP1];
  const rem = remarks ? ['Remarks', 'DISPATCHER DESK: 00', ...remarks, 'RAIM VALIDATION PASSED', 'MEL/CDL', 'Flight Release Authorization'] : [];
  const p2 = [...rem, 'TIME FUEL', ...(fpl === null ? [] : (fpl || fplBlock()))];
  return 'BRIEFING COVER PAGE\n\n' + page(1, 2, p1) + page(2, 2, p2) + 'NOTAM BRIEFING PAGE\n' + after + '\n';
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

test('TC-160-014 fuel and weights, synthetic (rows 9–23; SC block/min fuel positive and negative)', () => {
  const fuel = ['UAAA-EHAM', 'ALT1/2 KCCC/', 'FUEL TIME GDIS',
    'TRIP 085879 07.26 3395', 'CONT 007479 00.44', 'ALT1 005424 00.27 0118', 'FRES 004587 00.30',
    'PCF 000000 00.00', 'BALST 002500 00.00', 'MINF 103369 09.08 ....', 'EXTRA 002831 00.14', 'TOF 106200',
    'TAXI 000900 00.20', 'BLOCK 107100 09.43', 'REMF 020321 02.12 ....', '*ADDL FF ADJ -0.25 *',
    'Weight Actual Limit', 'DOW 161416', 'SWA (003718)', 'PYLD 109500',
    'ZFW 270916 ...... S284110 ZFW INC/1000 X 191 MINF ADJ', 'RAMP 378016 S397800',
    'TOGW 377116 ...... L377116 MTOW LTD BY VZFW/CK LIMITS', 'LDGW 291237 P302092'];
  const r = parseText(release({ extraP1: fuel }));
  assert.deepEqual(
    [r.blockFuelRaw, r.minfFuelRaw, r.fresFuelRaw, r.taxiFuelRaw, r.taxiMins, r.tripMinutes, r.alt1Fuel, r.destRemf, r.porMinf, r.ballastFuel, r.addlFfAdj, r.zfwIncrFactor],
    ['107100', '103369', '4587', '900', 20, 446, '5424', '20321', '', 2500, '-0.25', 191]);
  assert.deepEqual([r.zfwActual, r.zfwLimit, r.togwActual, r.togwLimit, r.ldgwActual, r.ldgwLimit, r.hasVzfwCkLimit],
    [270916, 284110, 377116, 377116, 291237, 302092, true]);
  assert.deepEqual(r.swa, { value: 3718, unit: 'KGS' });
  // redispatch three-column table: first column for the core fields, second column = porMinf
  const rd = parseText(release({ extraP1: ['TRIP 088113 14.26 6180 009645 02.15 0892 081286 13.01 5599',
    'MINF 094677 15.39 .... 016209 03.29 092098 15.05', 'BLOCK 096200 16.15', 'REMF 007097 01.24 .... 007097 01.24 013924 02.45',
    'BALST 001860 00.00 001860 00.00 001860 00.00'] }));
  assert.deepEqual([rd.minfFuelRaw, rd.porMinf, rd.tripMinutes, rd.blockFuelRaw, rd.destRemf, rd.ballastFuel], ['94677', '16209', 866, '96200', '7097', 1860]);
  // NavBlue form of the VZFW alert (own line, asterisks) is accepted too
  assert.equal(parseText(release({ extraP1: ['TOGW 377116 S377116', '*MTOW LTD BY VZFW/CK LIMITS*'] })).hasVzfwCkLimit, true);
  // negative: nothing printed → explicit empties + WARN for the SC fuel rows; no alert, no ballast, no SWA
  const n = parseText(release({ extraP1: ['TOGW 377116 ...... S377116', 'COMPANY NOTE: BLOCK 999999 MINF 999999 ADDL FF ADJ +9.99'] }));
  assert.deepEqual([n.blockFuelRaw, n.minfFuelRaw, n.ballastFuel, n.addlFfAdj, n.zfwIncrFactor, n.hasVzfwCkLimit, n.swa, n.porMinf],
    ['', '', null, null, null, false, null, '']);
  assert.ok(warns(n, 'blockFuelRaw').length === 1 && warns(n, 'minfFuelRaw').length === 1);
  // fuel and weights printed outside OFP page 1 (e.g. in the briefing) are never read
  const elsewhere = release() + 'BLOCK 107100 09.43\nMINF 103369 09.08 ....\nTOGW 377116 ...... S377116 MTOW LTD BY VZFW/CK LIMITS\n\n';
  const e = parseText(elsewhere);
  assert.deepEqual([e.blockFuelRaw, e.minfFuelRaw, e.togwActual, e.hasVzfwCkLimit], ['', '', 0, false]);
});

test('TC-160-016 rows 29–31 synthetic: DOT exemption (wrapped), slot forms, verbal callsign; Remarks only', () => {
  const one = parseText(release({ remarks: ['FLIGHT RELEASED UNDER EXEMPTION NO 12345A. ALTERNATE AIRPORT REQUIRED.', 'REFER TO FOM FOR ADDITIONAL INFORMATION.'] }));
  assert.deepEqual(one.dotExemption, { number: 'Exemption 12345A', restrictions: "ALT REQ'D", altRequired: true });
  // wrapped between "ALTERNATE AIRPORT" and "REQUIRED." (L08 form), and between ALTERNATE and AIRPORT
  for (const lines of [['FLIGHT RELEASED UNDER POLAR EXEMPTION NO 12345B. ALTERNATE AIRPORT', 'REQUIRED.REFER TO FOM FOR ADDITIONAL INFORMATION.'],
                       ['FLIGHT RELEASED UNDER EXEMPTION NO 12345B. ALTERNATE', 'AIRPORT REQUIRED. REFER TO FOM.']]) {
    const w = parseText(release({ remarks: lines }));
    assert.deepEqual(w.dotExemption, { number: 'Exemption 12345B', restrictions: "ALT REQ'D", altRequired: true }, lines.join(' / '));
  }
  // exemption without the alternate sentence → altRequired false + WARN
  const na = parseText(release({ remarks: ['FLIGHT RELEASED UNDER EXEMPTION NO 12345C.'] }));
  assert.deepEqual(na.dotExemption, { number: 'Exemption 12345C', restrictions: null, altRequired: false });
  assert.ok(warns(na, 'dotExemption').length === 1);
  // a sentence far away is not joined to it
  const far = parseText(release({ remarks: ['FLIGHT RELEASED UNDER EXEMPTION NO 12345D.', 'OTHER REMARK', 'ALTERNATE AIRPORT REQUIRED FOR KZZZ'] }));
  assert.equal(far.dotExemption.altRequired, false);
  // NavBlue DOT-SP form
  // (the NavBlue rule, unchanged: one continuation line is joined unless it starts with "-" or "*")
  const sp = parseText(release({ remarks: ['*OPERATING UNDER EXEMPTION DOT-SP7573*', 'RESTRICTIONS: DAY VMC ONLY', '- END OF RESTRICTIONS'] }));
  assert.deepEqual(sp.dotExemption, { number: 'DOT-SP7573', restrictions: 'DAY VMC ONLY', altRequired: false });
  // slot forms (NavBlue value forms)
  const slot = l => parseText(release({ remarks: [l] })).slotTime;
  assert.equal(slot('WHEELS UP NOT BEFORE 1627Z DUE TO ANC PARKING'), 'NOT BEFORE 1627Z');
  assert.equal(slot('WHEELS UP MUST BE BETWEEN 0737Z AND 0807Z DUE TO ANC SLOT TIME'), '0737Z – 0807Z');
  assert.equal(slot('WHEELS UP MUST BE BEFORE 0807Z'), 'BEFORE 0807Z');
  assert.equal(slot('EARLIEST WHEELS UP 2247Z DUE TO ANC PARKING'), 'NOT BEFORE 2247Z');
  assert.equal(slot('WHEELS UP 0433Z'), 'AT 0433Z');
  assert.equal(slot('NO EARLY DEPARTURE. AIRPORT CLOSED TILL 06:00Z'), 'NOT BEFORE 0600Z');
  assert.equal(slot('ADJUST WHEELS UP TIME TO ENSURE ARRIVAL WITHIN 15 MINS'), null);
  // verbal callsign remark (NavBlue form)
  assert.equal(parseText(release({ remarks: ['ICAO - THY = IATA - TK = VERBAL CALLSIGN - TURKISH'] })).parsedVerbalCallsign, 'TURKISH');
  // negative: none printed → null; the same words OUTSIDE the release Remarks are never read
  const outside = 'WHEELS UP NOT BEFORE 1627Z\nFLIGHT RELEASED UNDER EXEMPTION NO 12345A. ALTERNATE AIRPORT REQUIRED.\nVERBAL CALLSIGN - TURKISH\n';
  for (const r of [parseText(release({ remarks: ['ROUTE NOTE ONLY'] })), parseText(release({ remarks: ['ROUTE NOTE ONLY'], after: outside })),
                   parseText(release({ remarks: ['ROUTE NOTE ONLY'], extraP1: outside.trim().split('\n') }))]) {
    assert.equal(r.dotExemption, null);
    assert.equal(r.slotTime, null);
    assert.equal(r.parsedVerbalCallsign, null);
  }
});

test('TC-160-018 route synthetic: nav log, TOC, ETOPS, POR, ETP/CFS, alternate routes (SC positive and negative)', () => {
  const HDR = ['AWY   WPT MTK  NM  GS  TAS LEG-T ETA  MTRS  ISA   WC   REMF', 'MORA   TTK  MH  IAS .M  TOT-T ATA  FL   TEMP   WIND  AREM'];
  const fix = (l1, lat, lon, tot) => [l1, `${lat}  315  004 379 481 00:01   P01   H102   0906`, `${lon} 311  310 278 834 ${tot} F360  -55   285/111`];
  const page = (n, of, body) => [REL_HDR, 'OPERATIONAL FLIGHT PLAN RLS 01 08MAR26 12:00', ...body, `FUFI: 00000000-0000-0000-0000-000000000000 PAGE ${n}/${of}`].join('\n') + '\n\n';
  const build = ({ typeExtra = ' ETOPS Entry 02.08', por = 'POR: AAAAA+119NM 03.10', navA, navB, cfs, routes }) => {
    const p1 = ['TST0001/08 KAAA - KBBB 08 MAR 26 N000ZZ', `B777F / GE90-110BL / KG / IFR / FF +2.6${typeExtra}`,
      'ORIG KAAA/AAA ALPHA INTL N40000W080000 1000Z', 'DEST KBBB/BBB BRAVO INTL N41000W081000 2000Z',
      'PALT KCCC/CCC CHARLIE N42000W082000 2030Z', `FMC Reserves: 9.6 ADIS: 4105 ${por}`];
    const p2 = ['TIME FUEL', ...fplBlock({ type: 'B77L/H' }), 'Overflight/Landing Permits', ...HDR, ...navA];
    const p3 = [...HDR, ...navB, ...routes, ...cfs];
    return 'COVER\n\n' + page(1, 3, p1) + page(2, 3, p2) + page(3, 3, p3) + 'NOTAM PAGE\n\n';
  };
  const navA = [...fix('J70 TOC', 'N43 09.8', 'W088 21.3', '00.15'), ...fix('J120 (E.ENT)', 'N50 00.0', 'W150 00.0', '02.08'),
    'DCT (GOKEEE) ETP1'];                                           // the ETP fix is split by the page break
  const navB = ['N46 45.2   139 416 483 00:20   P09   0276', 'E166 28.3   251 826 04.07 F400  -47 248/067',
    ...fix('DCT (E.EXT)', 'N45 00.0', 'E160 00.0', '06.14'), ...fix('DCT (POR) AT AAAAA+119NM', '^177   N46 01.2', 'W076 30.5', '03.10'),
    ...fix('Y685 TOD', 'N36 39.4', 'E128 16.8', '09.59')];
  const routes = ['Destination Primary Alternate Route', 'KBBB R16R EGOBA G597 KARBU DCT LANAT Y597 MIHOU', 'ATMUGC KCCC', 'KBBB/0390',
    'GCD 465 GDIS 536 FUEL 9950 TIME 01.07', 'MORA 6700', 'Initial Airport Route', 'AAAAA DCT KDDD', 'MORA 4400'];
  const cfs = ['Critical Fuel Scenario ETOPS 60/180', 'DEPRESS/1EO', '(GOKEEE) E.ENT KEEE N50 00.0 W150 00.0',
    'GCD TIME A/I REMF PAD MINF WX WINDOW', 'KEEE 438 01:23 3-078PC 31646 21771 009875 20:40-00:37', 'RMK MIN INCL APU / 5PC WIND',
    'DEPRESS/1EO', '(GOKFFF) ETP1 KEEE-KFFF N46 45.2 E166 28.3', 'GCD TIME A/I REMF PAD MINF WX WINDOW',
    'KEEE 720 02:08 3-056PC 27638 12314 015324 20:40-00:37', 'KFFF 708 02:08 3-013PC 27638 12539 015099 22:03-00:37',
    'DEPRESS/1EO', 'E.EXIT KGGG N45 06.2 E151 16.6', 'GCD TIME A/I REMF PAD MINF WX WINDOW',
    'KGGG 438 01:22 3-009PC 23665 14009 009656 23:50-00:10', 'Last Adequate: KEEE', 'First Adequate: KHHH'];
  const r = parseText(build({ navA, navB, cfs, routes }));
  assert.equal(r.tocOffsetMins, 15);
  assert.deepEqual([r.etopsEntry, r.etopsEntryMins, r.etopsExit, r.etopsExitMins, r.etopsSpec], ['02:08', 128, '06:14', 374, '60/180']);
  assert.deepEqual([r.porWpt, r.porOffsetMins], ['(AAAAA+119NM) N46 01.2 W076 30.5', 190]);
  assert.deepEqual(r.etpPoints, [{ name: 'ETP1', lat: 'N46 45.2', lon: 'E166 28.3', elapsedMins: 247 }]);
  assert.deepEqual(r.altData.filter(a => a.role === 'CFS ALT'), [
    { icao: 'KEEE', role: 'CFS ALT', ofpEta: '2239', ofpOffsetMins: null, currentEta: '2239', wxWindow: '2040Z-0037Z', etpName: 'ETP1' },
    { icao: 'KFFF', role: 'CFS ALT', ofpEta: '2320', ofpOffsetMins: null, currentEta: '2320', wxWindow: '2203Z-0037Z', etpName: 'ETP1' },
    { icao: 'KGGG', role: 'CFS ALT', ofpEta: '0000', ofpOffsetMins: null, currentEta: '0000', wxWindow: '2350Z-0010Z', etpName: 'E.EXIT' }]);
  assert.deepEqual(r.altRoutes, [
    { title: 'Destination Primary Alternate Route', route: 'KBBB R16R EGOBA G597 KARBU DCT LANAT Y597 MIHOU ATMUGC KCCC', mora: '6700' },
    { title: 'Initial Airport Route', route: 'AAAAA DCT KDDD', mora: '4400' }]);
  assert.deepEqual(r.navLog, [], 'navLog [] as NavBlue (FK-P)');
  assert.deepEqual(warns(r).filter(f => /^(navLog|toc|etops|por|etp|altData)/.test(f.field)), []);
  // plain-fix POR; ETOPS entry differing from the nav log → page 1 + WARN
  const p = parseText(build({ typeExtra: ' ETOPS Entry 02.10', por: 'POR: AAAAA+119NM 03.10', navA, navB: navB.map(l => l.replace('(POR) AT AAAAA+119NM', '(POR) AT BBBBB')), cfs, routes }));
  assert.equal(p.etopsEntry, '02:10');
  assert.ok(warns(p, 'etopsEntry').some(f => /differ/.test(f.message)));
  assert.ok(warns(p, 'porWpt').some(f => /differ/.test(f.message)));
  assert.equal(p.porWpt, '(AAAAA+119NM)', 'no lat/long taken from another point');
  const plainPor = parseText(build({ por: 'POR: BBBBB 03.10', navA, navB: navB.map(l => l.replace('(POR) AT AAAAA+119NM', '(POR) AT BBBBB')), cfs, routes }));
  assert.deepEqual([plainPor.porWpt, plainPor.porOffsetMins], ['BBBBB', 190]);
  // negative: a non-ETOPS release → every ETOPS/ETP/POR field empty, no CFS alternate; no WARN on them
  const n = parseText(build({ typeExtra: '', por: '', navA: fix('J70 TOC', 'N43 09.8', 'W088 21.3', '00.15'), navB: fix('Y685 TOD', 'N36 39.4', 'E128 16.8', '09.59'), cfs: [], routes }));
  assert.deepEqual([n.etopsEntry, n.etopsEntryMins, n.etopsExit, n.etopsExitMins, n.etopsSpec, n.porWpt, n.porOffsetMins], ['', null, '', null, '', '', null]);
  assert.deepEqual(n.etpPoints, []);
  assert.deepEqual(n.altData.map(a => a.role), ['DEST ALT']);
  assert.deepEqual(warns(n).filter(f => /etops|por|etp|altData/i.test(f.field)), []);
  // 747 2EO scenario (no ETOPS spec, E.ENT/E.EXIT only) → its airport is still a CFS alternate (SME-13)
  const twoEo = parseText(build({ typeExtra: '', por: '', navA: fix('J70 TOC', 'N43 09.8', 'W088 21.3', '00.15'), navB: [], routes: [],
    cfs: ['Critical Fuel Scenario', '2EO', '(GOKEEE) E.ENT KEEE N42 34.2 E158 39.8', 'GCD TIME A/I REMF PAD MINF WX WINDOW',
      'KEEE 870 02:05 5-010PC 57946 37742 020204 02:24-04:27', '2EO', 'E.EXIT KEEE N43 35.6 E161 16.6'] }));
  assert.equal(twoEo.etopsSpec, '');
  assert.deepEqual(twoEo.altData.filter(a => a.role === 'CFS ALT').map(a => [a.icao, a.etpName, a.wxWindow]), [['KEEE', 'E.ENT', '0224Z-0427Z']]);
  // a CFS block printed outside the release (e.g. in the briefing) is never read
  const outside = parseText(build({ typeExtra: '', por: '', navA: [], navB: [], routes: [], cfs: [] }).replace('NOTAM PAGE', cfs.join('\n')));
  assert.deepEqual([outside.etpPoints, outside.etopsSpec, outside.altData.filter(a => a.role === 'CFS ALT')], [[], '', []]);
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
      const p1Alts = r.altData.filter(a => a.role !== 'CFS ALT');
      assert.deepEqual(p1Alts.map(a => ({ icao: a.icao, role: a.role, ofpEta: a.ofpEta })), e.altData, `${e.label}: altData (OFP p1 order)`);
      assert.ok(r.altData.findIndex(a => a.role === 'CFS ALT') === -1 || r.altData.findIndex(a => a.role === 'CFS ALT') === p1Alts.length, `${e.label}: CFS alternates after the page-1 alternates`);
      for (const a of p1Alts) {
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

  test('TC-160-015 rows 9–23 + SWA on 26 fixtures; field-map counts', () => {
    const fields = ['blockFuelRaw', 'minfFuelRaw', 'fresFuelRaw', 'taxiFuelRaw', 'taxiMins', 'tripMinutes', 'alt1Fuel',
      'destRemf', 'porMinf', 'ballastFuel', 'addlFfAdj', 'zfwIncrFactor', 'zfwActual', 'zfwLimit', 'togwActual',
      'togwLimit', 'ldgwActual', 'ldgwLimit', 'hasVzfwCkLimit', 'swa'];
    for (const fx of fkFixtures) {
      const r = runFixture(fx), e = EXPECTED[fx.id];
      for (const f of fields) assert.deepEqual(r[f], e[f], `${e.label}: ${f}`);
      assert.deepEqual(warns(r).filter(f => fields.includes(f.field)), [], `${e.label}: no WARN on rows 9–23`);
    }
    const labelsWhere = pred => fkFixtures.filter(fx => pred(runFixture(fx))).map(fx => EXPECTED[fx.id].label).sort();
    assert.deepEqual(labelsWhere(r => r.ballastFuel !== null), ['L02', 'L04', 'L12', 'L18'], 'row 16: BALST in 4');
    assert.deepEqual(labelsWhere(r => r.addlFfAdj !== null), ['L03', 'L08', 'L10', 'L12', 'L13', 'L16', 'L17', 'L18', 'T1', 'T3'], 'row 19: 10');
    assert.deepEqual(labelsWhere(r => r.hasVzfwCkLimit), ['L02', 'L09', 'L10', 'L11', 'L12', 'L19', 'T1', 'T2', 'T3'], 'row 23: 9');
    assert.deepEqual(labelsWhere(r => r.porMinf !== ''), ['L02', 'L08', 'L11', 'L12', 'L13', 'L14', 'L18', 'L19', 'L20', 'T3'], 'row 17: 10');
    assert.deepEqual(labelsWhere(r => r.swa !== null), ['L05', 'L15', 'L21', 'L22'], 'SME-8: SWA in 4');
    assert.deepEqual(labelsWhere(r => r.zfwIncrFactor !== null).length, 26, 'row 18: 26/26');
    assert.equal(runFixture(fkFixtures.find(f => f.id === byLabel.L16)).addlFfAdj, '+4.30', 'SME-6: as printed');
  });

  test('TC-160-017 rows 29–31 on 26 fixtures: exemption 6 (L08 wrapped), slot 1, verbal callsign 0', () => {
    for (const fx of fkFixtures) {
      const r = runFixture(fx), e = EXPECTED[fx.id];
      for (const f of ['dotExemption', 'slotTime', 'parsedVerbalCallsign']) assert.deepEqual(r[f], e[f], `${e.label}: ${f}`);
      assert.deepEqual(warns(r).filter(f => ['dotExemption', 'slotTime'].includes(f.field)), [], `${e.label}: no WARN`);
    }
    const labelsWhere = pred => fkFixtures.filter(fx => pred(runFixture(fx))).map(fx => EXPECTED[fx.id].label).sort();
    assert.deepEqual(labelsWhere(r => r.dotExemption && r.dotExemption.altRequired), ['L08', 'L11', 'L13', 'L15', 'L21', 'L22'], 'row 29');
    assert.deepEqual(labelsWhere(r => r.dotExemption !== null).length, 6);
    assert.deepEqual(labelsWhere(r => r.slotTime !== null), ['L16'], 'row 30');
    assert.equal(runFixture(fkFixtures.find(f => f.id === byLabel.L16)).slotTime, 'NOT BEFORE 1627Z');
    assert.deepEqual(labelsWhere(r => r.parsedVerbalCallsign !== null), [], 'row 31 ⚪');
    // the NavBlue parser gets L08 wrong (altRequired false); the module reads it right
    const l08 = fkFixtures.find(f => f.id === byLabel.L08);
    assert.equal(navblue._ofpRulesetParse(fs.readFileSync(path.join(FIXTURES, l08.files.text), 'utf8')).dotExemption.altRequired, false);
  });

  test('TC-160-019 rows 33, 34, 36, 39–41 on 26 fixtures; field-map counts', () => {
    const fields = ['tocOffsetMins', 'etopsEntry', 'etopsEntryMins', 'etopsExit', 'etopsExitMins', 'etopsSpec', 'porWpt', 'porOffsetMins', 'etpPoints'];
    for (const fx of fkFixtures) {
      const r = runFixture(fx), e = EXPECTED[fx.id];
      for (const f of fields) assert.deepEqual(r[f], e[f], `${e.label}: ${f}`);
      assert.deepEqual(r.navLog, [], `${e.label}: navLog [] (FK-P)`);
      assert.deepEqual(r.altData.filter(a => a.role === 'CFS ALT').map(a => ({ icao: a.icao, etpName: a.etpName, wxWindow: a.wxWindow })),
        e.cfsAlternates, `${e.label}: CFS alternates`);
      assert.deepEqual(r.altRoutes.map(a => ({ title: a.title, mora: a.mora, routeWords: a.route.split(' ').length,
        routeSha256: crypto.createHash('sha256').update(a.route).digest('hex') })), e.altRoutes, `${e.label}: altRoutes`);
      assert.deepEqual(warns(r).filter(f => /^(navLog|toc|etops|por|etp|altData)/.test(f.field)), [], `${e.label}: no WARN on the route`);
    }
    const labelsWhere = pred => fkFixtures.filter(fx => pred(runFixture(fx))).map(fx => EXPECTED[fx.id].label).sort();
    const ETOPS = ['L03', 'L14', 'L15', 'L20', 'L21', 'L22', 'L23'];
    assert.deepEqual(labelsWhere(r => r.etopsEntry !== ''), ETOPS, 'row 39 entry 7');
    assert.deepEqual(labelsWhere(r => r.etopsExit !== ''), ETOPS, 'row 39 exit 7');
    assert.deepEqual(labelsWhere(r => r.etopsSpec === '60/180'), ['L03', 'L15']);
    assert.deepEqual(labelsWhere(r => r.etopsSpec === '60/120'), ['L14', 'L20', 'L21', 'L22', 'L23']);
    assert.deepEqual(labelsWhere(r => r.porWpt !== ''), ['L02', 'L08', 'L11', 'L12', 'L13', 'L14', 'L18', 'L19', 'L20', 'T3'], 'row 40: 10');
    assert.deepEqual(labelsWhere(r => r.porWpt.startsWith('(')), ['L08', 'L12', 'L13'], 'row 40: +nnNM in 3 (SME-11)');
    assert.deepEqual(labelsWhere(r => r.etpPoints.length > 0), ['L03', 'L14', 'L15', 'L20', 'L21', 'L22', 'T3'], 'row 41: ETP 7');
    assert.deepEqual(labelsWhere(r => r.altData.some(a => a.role === 'CFS ALT')), ['L03', 'L09', 'L11', 'L14', 'L15', 'L20', 'L21', 'L22', 'L23', 'T3'], 'row 41: CFS 10 (SME-13)');
    assert.ok(fkFixtures.every(fx => runFixture(fx).altData.filter(a => a.role === 'CFS ALT').every(a => /^\d{4}Z-\d{4}Z$/.test(a.wxWindow))), 'every CFS window read');
    assert.equal(labelsWhere(r => r.tocOffsetMins !== null).length, 26, 'row 34: 26/26');
    assert.equal(labelsWhere(r => r.altRoutes.some(a => a.title === 'Destination Primary Alternate Route')).length, 26, 'row 36: 26/26');
    assert.deepEqual(labelsWhere(r => r.altRoutes.some(a => a.title === 'Initial Airport Route')), ['L02', 'L08', 'L11', 'L12', 'L13', 'L14', 'L18', 'L19', 'L20', 'T3']);
    assert.deepEqual(labelsWhere(r => r.altRoutes.some(a => a.mora === '')), ['L07', 'T1'], 'no MORA line in T1, L07');
    assert.equal(labelsWhere(r => r.etpPoints.length === 2).length, 4);
  });

  test('TC-160-020 the ✅ rows of the field map: module value = NavBlue value on all 26 fixtures', () => {
    // Field map v1.1 rows marked ✅ (today's NavBlue parser reads FlightKeys right) plus rows 5–6 outside L22.
    const SAME = ['tocOffsetMins', 'etopsExit', 'etopsExitMins', 'etopsSpec', 'porOffsetMins', 'slotTime', 'parsedVerbalCallsign', 'fltNum', 'acftType', 'weightUnit', 'isHeavy', 'dateStr', 'flightDateISO', 'blockFuelRaw',
      'minfFuelRaw', 'fresFuelRaw', 'taxiFuelRaw', 'taxiMins', 'tripMinutes', 'alt1Fuel', 'destRemf', 'porMinf',
      'zfwActual', 'zfwLimit', 'togwActual', 'togwLimit', 'ldgwActual', 'ldgwLimit'];
    let n = 0;
    for (const fx of fkFixtures) {
      const text = fs.readFileSync(path.join(FIXTURES, fx.files.text), 'utf8');
      const nb = navblue._ofpRulesetParse(text), r = runFixture(fx), lbl = EXPECTED[fx.id].label;
      const fields = lbl === 'L22' ? SAME : SAME.concat(['origIcao', 'offFromOFP', 'destIcao', 'etaDest', 'destEtaOffsetMins']);
      for (const f of fields) { assert.deepEqual(r[f], nb[f], `${lbl}: ${f} = NavBlue`); n++; }
    }
    assert.ok(n >= 26 * 21);
  });
}
