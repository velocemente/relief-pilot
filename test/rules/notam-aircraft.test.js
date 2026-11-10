'use strict';
/**
 * TC-151 — NOTAM ruleset v1.12.0 holds no aircraft data; the app passes the aircraft profile in
 *
 * Integration of the aircraft-profile module (ADR-005, plan v4.5 §2): ONE copy of the aircraft table
 * and the callsign index, in rules/aircraft-profile. The NOTAM module no longer has AIRCRAFT_DATA,
 * getWingspan() or buildAcftProfile(); evalNotams() takes the profile OBJECT (and, as an optional 7th
 * argument, the module's getWingspan, for the wingspan of the types a NOTAM names and the taxiway
 * wingspan limit). The app's behaviour is identical (CLAUDE.md rules 3, 4, 6).
 *
 *   TC-151-001  the NOTAM module: no table, no getWingspan, no buildAcftProfile (code, exports);
 *               version, schema, manifest entry
 *   TC-151-010  EQUIVALENCE with v1.11.2: 42 synthetic NOTAMs (every branch of the aircraft filter and
 *               the taxiway wingspan check) x 70 types: _acftApplies() and evalNotams() (ORIG, DEST),
 *               called as the app calls them, give what v1.11.2 gave for the type string — on the
 *               standalone file and on the copy built into index.html
 *   TC-151-011  a type string or nothing as the aircraft = unknown profile: every aircraft-restricted
 *               NOTAM is shown (fail-safe), and nothing else changes. Positive: shown for string, empty,
 *               null, undefined, a number. Negative: the same NOTAMs are hidden for a real profile
 *   TC-151-012  getWingspan not passed: the types a NOTAM names (and the taxiway limit) are unknown,
 *               so the NOTAM is shown; passed: the wingspan decides. Positive and negative
 *   TC-151-020  the app: evalAirport() hands evalNotams() the profile object built by the module and the
 *               module's getWingspan, for every release airport of every fixture; the NOTAMs it reports
 *               equal a direct call
 *   TC-151-021  ONE copy in index.html: the aircraft-profile module byte for byte, once, before the
 *               NOTAM module; no other AIRCRAFT_DATA / getWingspan / buildAcftProfile / deriveCallsign;
 *               src/ofp-parse.html takes deriveCallsign from the module
 *   TC-151-030  the gate bites: a changed table value or a changed rule is caught by 010
 *
 * Fixtures: PB_FIXTURES (authoritative when set), else ./fixtures or ../pilotbrief-fixtures.
 * No fixture text in messages.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const crypto = require('crypto');
const { loadApp } = require('../harness');
const { findFixtures, readManifest, importFixture } = require('../lib/app-path');
const { evalArgsFor } = require('../lib/v0-snapshots');
const { nodeAircraftProfile, callAsApp } = require('../lib/acft');
const { assemble } = require('../../build/build');
const D = require('./data/acft-cases');
const EXPECTED = require('./data/acft-expected-v1.11.2.json');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const NOTAM_FILE = path.join(RULES, MANIFEST['notam-rules'].file);
const NOTAM_SRC  = fs.readFileSync(NOTAM_FILE, 'utf8');
const notam    = require(NOTAM_FILE);
const AP       = nodeAircraftProfile();
const AP_SRC   = fs.readFileSync(path.join(RULES, MANIFEST['aircraft-profile'].file), 'utf8');
const HTML     = () => fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
// The code of a module without comments and strings.
const codeOf = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/'[^'\n]*'|"[^"\n]*"/g, "''");

let _app = null;
const app = () => (_app ||= loadApp({ html: assemble(ROOT).toString('utf8') }));

function fixturesDir() {
  const d = process.env.PB_FIXTURES ? require('path').resolve(process.env.PB_FIXTURES) : findFixtures();
  if (!d || !fs.existsSync(path.join(d, 'manifest.json'))) throw new Error('fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)');
  return d;
}

// One evaluator under test: _acftApplies and evalNotams of a NOTAM module, plus the aircraft-profile
// module whose profile and getWingspan are passed in, exactly as the app does.
function evaluator(NR, AircraftProfile) {
  return {
    applies: (text, type) => NR._acftApplies(text, AircraftProfile.buildAcftProfile(type), AircraftProfile.getWingspan),
    evalAt: (text, role, type) => callAsApp(NR.evalNotams, AircraftProfile, [text], role, 600, type, '2026-11-09', 480),
  };
}
// Differences between an evaluator and v1.11.2's recorded results: 'case/type/what' strings.
function differences(ev) {
  const types = EXPECTED.types;
  const out = [];
  D.CASE_TEXT.forEach((text, i) => {
    const name = D.CASES[i][0];
    const want = { acftApplies: D.expand(EXPECTED.acftApplies[i], types), ORIG: D.expand(EXPECTED.eval.ORIG[i], types), DEST: D.expand(EXPECTED.eval.DEST[i], types) };
    for (const t of types) {
      if (String(ev.applies(text, t)) !== want.acftApplies[t]) out.push(`${name}/${JSON.stringify(t)}/_acftApplies`);
      for (const role of ['ORIG', 'DEST'])
        if (D.sig(ev.evalAt(text, role, t)) !== want[role][t]) out.push(`${name}/${JSON.stringify(t)}/evalNotams ${role}`);
    }
  });
  return out;
}

// ══ TC-151-001 the NOTAM module holds no aircraft data ═══════════════════════

test('TC-151-001 the NOTAM module has no aircraft table, getWingspan or buildAcftProfile; version and manifest', () => {
  const code = codeOf(NOTAM_SRC);
  for (const n of ['AIRCRAFT_DATA', 'getWingspan', 'buildAcftProfile']) {
    // getWingspan is the passed-in parameter; it is never declared or assigned in the module.
    assert.ok(!new RegExp(`(?:function\\s+${n}\\s*\\(|(?:const|let|var)\\s+${n}\\b)`).test(code), `${n} is not declared in the NOTAM module`);
  }
  assert.ok(!/\bAIRCRAFT_DATA\b/.test(code), 'AIRCRAFT_DATA is not named in the NOTAM module code');
  assert.ok(!/\bbuildAcftProfile\b/.test(code), 'buildAcftProfile is not named in the NOTAM module code');
  assert.equal(typeof notam.buildAcftProfile, 'undefined', 'buildAcftProfile is not exported');
  assert.equal(typeof notam.getWingspan, 'undefined');
  assert.equal(typeof notam._acftApplies, 'function', '_acftApplies stays in the NOTAM module');
  assert.equal(notam.RULESET_VERSION, '1.12.0');
  assert.equal(notam.SCHEMA_VERSION, 2);
  assert.deepEqual(notam.validateSchema(), { valid: true, errors: [] });
  const e = MANIFEST['notam-rules'];
  assert.equal(e.version, '1.12.0');
  assert.equal(e.file, 'notam-rules/notam-rules-v1.12.0.js');
  assert.equal(e.sha256, sha(fs.readFileSync(NOTAM_FILE)));
  assert.ok(!fs.existsSync(path.join(RULES, 'notam-rules', 'notam-rules-v1.11.2.js')), 'v1.11.2 is removed from rules/');
  // The recorded expectations are v1.11.2's, which the module this replaces produced.
  assert.equal(EXPECTED.recordedFrom.sha256, 'faa8377dadf6b24dfe1f7a44325647f24de704b4e9e026b6dd266a7ea7438997');
  assert.deepEqual(EXPECTED.cases, D.CASES.map(c => c[0]), 'the recorded cases are the cases');
  assert.deepEqual(EXPECTED.types.slice(0, Object.keys(AP.AIRCRAFT_DATA).length), Object.keys(AP.AIRCRAFT_DATA), 'the recorded types are the aircraft-profile table keys');
});

// ══ TC-151-010 equivalence with v1.11.2 ══════════════════════════════════════

test('TC-151-010 EQUIVALENCE: 42 NOTAMs x 70 types give what v1.11.2 gave (file and index.html)', () => {
  assert.deepEqual(differences(evaluator(notam, AP)), [], 'standalone NOTAM module + aircraft-profile module');
  const a = app().sandbox;
  assert.deepEqual(differences(evaluator(a.NotamRules, a.AircraftProfile)), [], 'the modules built into index.html');
  // coverage: the cases really separate the types (not 42 identical rows)
  const varied = EXPECTED.acftApplies.filter(r => Object.keys(r.except).length > 0).length;
  assert.ok(varied >= 25, `cases whose _acftApplies result depends on the type: ${varied}`);
  assert.equal(EXPECTED.types.length, 70);
});

// ══ TC-151-011 string / nothing = unknown profile = shown ════════════════════

test('TC-151-011 a type string or nothing as the aircraft: every aircraft-restricted NOTAM is shown (fail-safe)', () => {
  const restricted = D.CASES.map(([n], i) => ({ n, text: D.CASE_TEXT[i] })).filter(c => !/^(none|twy-closed|twy-restr-plain)$/.test(c.n));
  const shown = r => r.issues.some(i => i.slot !== 99);
  const hiddenFor = new Set();   // restricted cases hidden for at least one real profile (negative control)
  for (const c of restricted) {
    for (const t of ['B744', 'B748', 'B738', 'A388', 'B763']) {
      if (!shown(callAsApp(notam.evalNotams, AP, [c.text], 'DEST', 600, t, '2026-11-09', 480))) hiddenFor.add(c.n);
    }
  }
  assert.ok(hiddenFor.size >= 20, `NOTAMs a real profile hides: ${hiddenFor.size}`);
  const unknowns = [['string', 'B744'], ['string, other', 'B738'], ['empty string', ''], ['null', null], ['undefined', undefined], ['number', 0], ['false', false]];
  for (const [label, acft] of unknowns) {
    for (const role of ['ORIG', 'DEST']) {
      for (const c of restricted) {
        const r = notam.evalNotams([c.text], role, 600, acft, '2026-11-09', 480, AP.getWingspan);
        assert.ok(shown(r), `${label}: ${c.n} (${role}) is shown`);
        assert.equal(notam._acftApplies(c.text, acft, AP.getWingspan), true, `${label}: _acftApplies(${c.n}) is true`);
      }
    }
  }
  // "adds nothing else": the result for an unknown profile is the result of the NOTAM with no
  // aircraft qualifier at all (same slot, level, label as the profile of an aircraft it applies to).
  const plain = D.CASE_TEXT[0];
  for (const acft of ['B744', '', undefined])
    assert.equal(D.sig(notam.evalNotams([plain], 'DEST', 600, acft, '2026-11-09', 480, AP.getWingspan)),
                 D.sig(callAsApp(notam.evalNotams, AP, [plain], 'DEST', 600, 'B744', '2026-11-09', 480)));
  // Negative control, the same NOTAMs through the app's profile: hidden where v1.11.2 hid them.
  const ws60 = D.CASE_TEXT[D.CASES.findIndex(c => c[0] === 'ws-max-60')];
  assert.equal(shown(callAsApp(notam.evalNotams, AP, [ws60], 'DEST', 600, 'B738', '2026-11-09', 480)), false, 'MAX WS 60M: hidden for a B738 (35.8 m)');
  assert.equal(shown(callAsApp(notam.evalNotams, AP, [ws60], 'DEST', 600, 'B748', '2026-11-09', 480)), true, 'MAX WS 60M: shown for a B748 (68.4 m)');
  assert.equal(shown(notam.evalNotams([ws60], 'DEST', 600, 'B738', '2026-11-09', 480)), true, 'a type string: shown');
  // The unknown TYPE (a profile with known:false) is not the unknown PROFILE: it keeps v1.11.2's
  // conservative values and filters as before.
  const unk = AP.buildAcftProfile('ZZZZ');
  assert.equal(unk.known, false);
  const light = D.CASE_TEXT[D.CASES.findIndex(c => c[0] === 'wake-light-only')];
  assert.equal(shown(notam.evalNotams([light], 'DEST', 600, unk, '2026-11-09', 480, AP.getWingspan)), false, 'LIGHT ACFT ONLY: hidden for an unknown TYPE (wake H), as in v1.11.2');
});

// ══ TC-151-012 getWingspan passed or not ═════════════════════════════════════

test('TC-151-012 getWingspan: passed → the wingspan of named types decides; not passed → unknown → NOTAM shown', () => {
  const text = n => D.CASE_TEXT[D.CASES.findIndex(c => c[0] === n)];
  const shown = (t, type, gw) => notam.evalNotams([t], 'DEST', 600, AP.buildAcftProfile(type), '2026-11-09', 480, gw).issues.some(i => i.slot !== 99);
  // "B744 AND ABOVE PROHIBITED": a B738 (35.8 m) is smaller than a B744 (64.4 m) → hidden; a B748 → shown.
  assert.equal(shown(text('type-b744-above'), 'B738', AP.getWingspan), false, 'passed: B738 hidden');
  assert.equal(shown(text('type-b744-above'), 'B748', AP.getWingspan), true, 'passed: B748 shown');
  assert.equal(shown(text('type-b744-above'), 'B738', undefined), true, 'not passed: named type unknown → shown');
  assert.equal(shown(text('type-b744-above'), 'B738', null), true, 'null: shown');
  assert.equal(shown(text('type-b744-above'), 'B738', 'B744'), true, 'not a function: shown');
  // "B737 AND SMALLER ONLY": a B744 is larger → hidden; a B737 itself (28.9 m) → shown. Not passed → shown.
  assert.equal(shown(text('type-b737-smaller'), 'B744', AP.getWingspan), false, 'passed: B744 hidden');
  assert.equal(shown(text('type-b737-smaller'), 'B737', AP.getWingspan), true, 'passed: B737 shown');
  assert.equal(shown(text('type-b737-smaller'), 'B744', undefined), true, 'not passed: shown');
  // taxiway wingspan limit: 40 m. A B744 (64.4 m) is over it → the restriction applies (TWY item, slot 6);
  // a B738 (35.8 m) is under it → the NOTAM is not a taxiway restriction for us. Not passed → applies.
  const slotOf = (t, type, gw) => notam.evalNotams([t], 'DEST', 600, AP.buildAcftProfile(type), '2026-11-09', 480, gw).issues.map(i => i.slot);
  const twy = text('twy-ws-greater-40');
  assert.deepEqual(slotOf(twy, 'B744', AP.getWingspan), [6], 'passed: B744 over 40 m → taxiway restriction (slot 6)');
  assert.deepEqual(slotOf(twy, 'B738', AP.getWingspan), [7], 'passed: B738 under 40 m → not a taxiway restriction (general slot 7)');
  assert.deepEqual(slotOf(twy, 'B738', undefined), [6], 'not passed: type unknown → conservative, restriction applies');
});

// ══ TC-151-020 the app passes the profile ════════════════════════════════════

const BIND = 'const { evalNotams, _splitNotams } = NotamRules;';
test('TC-151-020 the app: evalAirport() passes the module\'s profile object and getWingspan to evalNotams()', async () => {
  const dir = fixturesDir();
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal(src.split(BIND).length, 2);
  // In-memory copy of index.html whose evalNotams() records what it is given; nothing else changes.
  const html = src.replace(BIND, 'const { _splitNotams } = NotamRules;\n' +
    'const evalNotams = function (notams, role, etaMin, acft, flightISO, depMin, gw) {\n' +
    '  (globalThis.__calls = globalThis.__calls || []).push({ acft, gw });\n' +
    '  return NotamRules.evalNotams.apply(this, arguments); };');
  const fixtures = readManifest(dir).fixtures.filter(f => f.format !== 'flightkeys');
  assert.ok(fixtures.length >= 30);
  let calls = 0;
  for (const fx of fixtures) {
    const imp = await importFixture(fx, dir, { html });
    const sb = imp.app.sandbox;
    for (const apt of imp.app.getAllAirports()) {
      const a = evalArgsFor(imp, apt);
      if (!a) continue;
      sb.__calls = [];
      const data = imp.airportData[apt.icao];
      imp.app.evalAirport(apt.icao, apt.eta, data.notams, data.weather, apt.wxWindow, apt.role, imp.S.acftType);
      assert.equal(sb.__calls.length, 1, `${fx.id} ${apt.icao}: one evalNotams() call`);
      const { acft, gw } = sb.__calls[0];
      assert.equal(typeof acft, 'object');
      assert.equal(JSON.stringify(acft), JSON.stringify(sb.AircraftProfile.buildAcftProfile(imp.S.acftType || '')), `${fx.id} ${apt.icao}: the profile is the module's`);
      assert.equal(acft.known, true, `${fx.id}: fleet type in the table`);
      assert.equal(gw, sb.AircraftProfile.getWingspan, `${fx.id} ${apt.icao}: the module's getWingspan is passed`);
      calls++;
    }
  }
  assert.ok(calls >= 100, `evalAirport() calls checked: ${calls}`);
});

// ══ TC-151-021 ONE copy in index.html ════════════════════════════════════════

test('TC-151-021 ONE copy: index.html carries the aircraft-profile module once; no other table, profile builder or callsign code', () => {
  const html = HTML();
  const first = html.indexOf(AP_SRC);
  assert.ok(first >= 0, 'index.html contains the aircraft-profile module byte for byte');
  assert.equal(html.indexOf(AP_SRC, first + 1), -1, 'once');
  const main = html.split(/<script>/).find(x => x.includes(AP_SRC));
  assert.ok(main, 'inside an inline script');
  assert.ok(main.indexOf(AP_SRC) < main.indexOf(NOTAM_SRC), 'before the NOTAM module');
  assert.ok(main.indexOf(AP_SRC) < main.indexOf('const { deriveCallsign } = AircraftProfile;'), 'before the app takes deriveCallsign from it');
  const rest = html.replace(AP_SRC, '');
  for (const re of [/(?:const|let|var)\s+AIRCRAFT_DATA\b/, /function\s+getWingspan\s*\(/, /function\s+buildAcftProfile\s*\(/, /function\s+deriveCallsign\s*\(/,
                    /(?:const|let|var)\s+CALLSIGN_INDEX\b/])
    assert.ok(!re.test(rest), `index.html outside the module declares ${re}`);
  assert.ok(!rest.includes("GTI: 'GIANT'"), 'the GTI → GIANT map is not in index.html outside the module');
  // src/: the app calls the module; none keeps a copy.
  const srcDir = path.join(ROOT, 'src');
  for (const f of fs.readdirSync(srcDir).filter(x => x.endsWith('.html'))) {
    const code = fs.readFileSync(path.join(srcDir, f), 'utf8');
    assert.ok(!/function\s+deriveCallsign\s*\(/.test(code) && !/AIRCRAFT_DATA|function\s+buildAcftProfile|function\s+getWingspan/.test(code), `src/${f} keeps no copy`);
  }
  const ofp = fs.readFileSync(path.join(srcDir, 'ofp-parse.html'), 'utf8');
  assert.equal(ofp.split('const { deriveCallsign } = AircraftProfile;').length - 1, 1, 'src/ofp-parse.html takes deriveCallsign from the module, once');
  const air = fs.readFileSync(path.join(srcDir, 'airports.html'), 'utf8');
  assert.equal(air.split('AircraftProfile.buildAcftProfile(acftType || \'\')').length - 1, 1);
  assert.equal(air.split('evalNotams(notamArr, evalRole, etaMin, acftProfile, flightISO, depMin, AircraftProfile.getWingspan)').length - 1, 1);
  // the app's functions ARE the module's
  const a = app();
  assert.equal(a.deriveCallsign, a.sandbox.AircraftProfile.deriveCallsign, 'the app\'s deriveCallsign is AircraftProfile.deriveCallsign');
  assert.ok(assemble(ROOT).equals(fs.readFileSync(path.join(ROOT, 'index.html'))), 'index.html is the build of src/ + rules/');
  // build order: the module is listed in build/build.js before notam-rules
  const b = require('../../build/build');
  const names = b.MODULES.map(m => typeof m === 'string' ? m : `rule:${m.rule}`);
  assert.ok(names.indexOf('rule:aircraft-profile') > -1 && names.indexOf('rule:aircraft-profile') < names.indexOf('rule:notam-rules'));
});

// ══ TC-151-030 the gate bites ════════════════════════════════════════════════

test('TC-151-030 the gate bites: a changed table value or a changed NOTAM rule is caught by the v1.11.2 comparison', () => {
  const load = (src, filename) => { const m = { exports: {} }; vm.runInContext(`(function (module, exports) {\n${src}\n})`, vm.createContext({}), { filename })(m, m.exports); return m.exports; };
  const edit = (src, from, to) => { assert.equal(src.split(from).length - 1, 1, `edit target unique: ${from}`); return src.replace(from, to); };
  // a table value (B748 wingspan): the aircraft-profile module is changed
  const ap = load(edit(AP_SRC, 'B748: { ws:68.4,', 'B748: { ws:58.4,'), 'broken aircraft-profile');
  assert.ok(differences(evaluator(notam, ap)).length > 0, 'a wingspan change is caught');
  // a NOTAM rule that reads the passed-in lookup: "AND ABOVE" uses 0 instead of the lookup
  const n1 = load(edit(NOTAM_SRC, "getWingspan(t.slice(0,4)) : null) || 0);", "getWingspan(t.slice(0,4)) : null) || 999);"), 'broken notam (and above)');
  assert.ok(differences(evaluator(n1, AP)).length > 0, 'a changed "and above" default is caught');
  // the taxiway check not given the lookup
  const n2 = load(edit(NOTAM_SRC, 'NM.TWY_RESTR.test(nu) && _twyApplies(notamRaw, acftType, getWingspan))) {\n      const tm', 'NM.TWY_RESTR.test(nu) && _twyApplies(notamRaw, acftType))) {\n      const tm'), 'broken notam (twy)');
  assert.ok(differences(evaluator(n2, AP)).length > 0, 'a taxiway check without the lookup is caught');
  // the unknown profile filtering instead of showing
  const n3 = load(edit(NOTAM_SRC, "if (!acft || typeof acft !== 'object') return true;", "if (!acft || typeof acft !== 'object') return false;"), 'broken notam (unknown)');
  assert.equal(n3.evalNotams([D.CASE_TEXT[1]], 'DEST', 600, 'B744', '2026-11-09', 480, AP.getWingspan).issues.some(i => i.slot !== 99), false, 'the broken module hides it');
  assert.equal(notam.evalNotams([D.CASE_TEXT[1]], 'DEST', 600, 'B744', '2026-11-09', 480, AP.getWingspan).issues.some(i => i.slot !== 99), true, 'the module shows it');
});
