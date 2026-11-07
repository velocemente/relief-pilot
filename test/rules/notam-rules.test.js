'use strict';
/**
 * TC-120 — NOTAM ruleset module v1.11.0 (rules/notam-rules) is the app's NOTAM engine
 *
 * The module is extracted from the app (src/notam.html, src/airports.html on main) and
 * must behave IDENTICALLY to the engine the app runs today (ADR-005 §2.1–2.3).
 *
 *   TC-120-001  metadata present; validateSchema() valid; a broken ruleset is rejected
 *   TC-120-002  rules/manifest.json: version, file and SHA-256 match every module file
 *   TC-120-003  dual context: Node (module.exports), rules-loader (new Function), browser
 *               (plain script → one global NotamRules); runs with no DOM / window / app state
 *   TC-120-004  copy check: every declaration equals the app source, except the
 *               documented v1.11.0 edits (window._flightDateISO fallback removed)
 *   TC-120-010  EQUIVALENCE: every Navtech/eOFP fixture, every release airport at its OFP
 *               ETA, called exactly as evalAirport() calls it: same split, same evalNotams()
 *               output field by field (issues, rwyGroups, sid/star/infoIssues, worst)
 *   TC-120-011  EQUIVALENCE: every NOTAM of every fixture (airport text and the whole OFP
 *               text): same window (xNW_standalone), same EST flag, same overlap at ETA
 *   TC-120-012  EQUIVALENCE beyond the ETA: every airport, both roles, 9 times of day,
 *               departure time known and unknown, no flight date
 *   TC-120-013  removing the window._flightDateISO fallback is invisible to the app's call
 *   TC-120-020  every existing NOTAM unit test (TC-110-*, TC-111-*, TC-113-*, the
 *               copies-agree synthetic set) passes against the MODULE as well
 *   TC-120-021  the gate bites: a module with one rule broken fails 020 and 010
 *   TC-120-030  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Fixtures: PB_FIXTURES (authoritative when set), else ./fixtures or ../pilotbrief-fixtures.
 * Messages name fixture ids, ICAO codes, NOTAM IDs, field paths and dates only; no fixture text.
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
const { findFixtures, readManifest, importFixture, notamKey } = require('../lib/app-path');
const { evalArgsFor, callEvalNotams } = require('../lib/v0-snapshots');

const ROOT      = path.resolve(__dirname, '..', '..');
const RULES     = path.join(ROOT, 'rules');
const MANIFEST  = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const MOD_FILE  = path.join(RULES, MANIFEST['notam-rules'].file);
const MOD_SRC   = fs.readFileSync(MOD_FILE, 'utf8');
const mod       = require(MOD_FILE);

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

// One import per fixture, shared by TC-120-010..013 (the app's real import path).
let _imports = null;
async function imports() {
  if (_imports) return _imports;
  const dir = requireFixturesDir();
  const list = readManifest(dir).fixtures.filter(f => f.format !== 'flightkeys');
  const out = [];
  for (const fx of list) out.push({ fx, dir, imp: await importFixture(fx, dir) });
  _imports = out;
  return out;
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
  if (tag === '[object RegExp]') return { $regexp: String(v) };
  const o = {};
  for (const k of Object.keys(v)) o[k] = canon(v[k]);   // insertion order kept: key order is compared too
  return o;
}
const short = v => typeof v === 'string' ? `string(${v.length}) #${crypto.createHash('sha256').update(v).digest('hex').slice(0, 8)}`
                                         : JSON.stringify(v);
// Paths where app and module differ; values shown as type/length/hash, never as text.
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
const idOf = raw => { const k = notamKey(raw); return k ? `${k.loc} ${k.id}` : '(no id)'; };

// ══ TC-120-001 metadata and validateSchema ═══════════════════════════════════

test('TC-120-001 metadata present; validateSchema() is valid; a broken ruleset is rejected', () => {
  assert.equal(mod.RULESET_TYPE, 'notam');
  assert.equal(mod.RULESET_VERSION, '1.11.0');
  assert.equal(mod.SCHEMA_VERSION, 2, 'SCHEMA_VERSION stays at the current contract value (rules-loader: notam >= 2)');
  assert.equal(typeof mod.RULESET_SOURCE, 'string');
  assert.ok(mod.RULESET_SOURCE.trim().length > 0);
  assert.deepEqual(mod.validateSchema(), { valid: true, errors: [] });
  assert.deepEqual(mod.validateSchema(mod), { valid: true, errors: [] });
  // rules-loader v1.0.0 REQUIRED_EXPORTS for 'notam'
  for (const k of ['RULESET_TYPE', 'RULESET_VERSION', 'SCHEMA_VERSION', 'RULESET_SOURCE', 'evalNotams', 'NM', '_classifyNotamSlot']) {
    assert.ok(k in mod, `rules-loader export ${k}`);
  }
  // Negative: each defect is reported.
  const broken = { ...mod, RULESET_TYPE: 'wx', SCHEMA_VERSION: 1, RULESET_VERSION: '1.11', NM: { ...mod.NM, X: 'not a regexp' } };
  delete broken.evalNotams;
  const r = mod.validateSchema(broken);
  assert.equal(r.valid, false);
  for (const e of ['missing export: evalNotams', "RULESET_TYPE must be 'notam'", "RULESET_VERSION '1.11' is not semver",
                   'SCHEMA_VERSION 1 must be an integer >= 2', 'NM.X is not a RegExp']) {
    assert.ok(r.errors.some(x => x.startsWith(e)), `reports: ${e} (got ${JSON.stringify(r.errors)})`);
  }
  assert.deepEqual(mod.validateSchema(null), { valid: false, errors: ['ruleset is not an object'] });
});

// ══ TC-120-002 manifest ══════════════════════════════════════════════════════

test('TC-120-002 rules/manifest.json lists every module file with its version and SHA-256', () => {
  const listed = new Set();
  for (const [name, e] of Object.entries(MANIFEST)) {
    assert.deepEqual(Object.keys(e).sort(), ['file', 'sha256', 'version'], `${name}: entry fields`);
    const file = path.join(RULES, e.file);
    assert.ok(fs.existsSync(file), `${name}: ${e.file} exists`);
    const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.equal(sha, e.sha256, `${name}: SHA-256 of ${e.file} matches the manifest`);
    assert.ok(e.file.startsWith(`${name}/`), `${name}: file lives in rules/${name}/`);
    assert.ok(e.file.endsWith(`-v${e.version}.js`), `${name}: file name carries version ${e.version}`);
    listed.add(path.normalize(e.file));
  }
  // every module file in rules/<module>/ is listed
  for (const d of fs.readdirSync(RULES, { withFileTypes: true }).filter(x => x.isDirectory())) {
    for (const f of fs.readdirSync(path.join(RULES, d.name)).filter(f => f.endsWith('.js'))) {
      assert.ok(listed.has(path.normalize(`${d.name}/${f}`)), `rules/${d.name}/${f} is listed in rules/manifest.json`);
    }
  }
  assert.equal(MANIFEST['notam-rules'].version, mod.RULESET_VERSION, 'manifest version = RULESET_VERSION');
});

// ══ TC-120-003 dual context ══════════════════════════════════════════════════

test('TC-120-003 dual context: Node, rules-loader and browser script give the same API; no DOM, no app state', () => {
  const names = Object.keys(mod);
  // rules-loader evalRuleset(): new Function('module', 'exports', 'require', code)
  const m = { exports: {} };
  new Function('module', 'exports', 'require', MOD_SRC)(m, m.exports, () => { throw new Error('ruleset called require()'); });
  assert.deepEqual(Object.keys(m.exports), names);
  // Browser: a plain script in a context with nothing but JS built-ins (no window, no document,
  // no module). It must publish exactly one global, NotamRules.
  const ctx = vm.createContext({});
  const before = new Set(Object.getOwnPropertyNames(ctx));
  vm.runInContext(MOD_SRC, ctx, { filename: 'notam-rules (browser)' });
  const added = Object.getOwnPropertyNames(ctx).filter(k => !before.has(k));
  assert.deepEqual(added, ['NotamRules'], 'only the NotamRules global is added');
  assert.deepEqual(Object.keys(ctx.NotamRules), names);
  assert.equal(ctx.NotamRules.validateSchema().valid, true);
  // The browser copy evaluates a NOTAM exactly like the Node copy.
  const n = '- XXXX A0301/26 01MAR0000-31MAR2359\n10-10 0000-0300\nRWY 09/27 CLSD\n';
  const node = canon(mod.evalNotams([n], 'DEST', 30, 'B744', '2026-03-09', 960));
  const brow = canon(ctx.NotamRules.evalNotams([n], 'DEST', 30, 'B744', '2026-03-09', 960));
  assert.deepEqual(diffPaths(node, brow), []);
  // No DOM, no storage, no window state in the code (comments aside).
  const code = MOD_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const re of [/\bwindow\b/, /\bdocument\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bairportData\b/, /\bfetch\s*\(/, /\bS\.\w/]) {
    assert.ok(!re.test(code), `module code does not use ${re}`);
  }
});

// ══ TC-120-004 copy check against the app source ═════════════════════════════

// Column-0 declarations: "function NAME(" … first column-0 "}", "const NAME =" … first column-0 "};"/");".
function declarations(src) {
  const lines = src.split('\n'), out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(?:function\s+(\w+)\s*\(|const\s+(\w+)\s*=)/);
    if (!m) continue;
    let j = i;
    const count = c => lines[i].split(c).length - 1;
    if (m[1]) {
      // a one-line function ends on its own line
      if (count('{') > count('}')) while (j < lines.length && lines[j] !== '}') j++;
    } else if (!/;\s*$/.test(lines[i])) {
      while (j < lines.length && !/^[}\)\]];\s*$/.test(lines[j])) j++;
    }
    out.push({ name: m[1] || m[2], text: lines.slice(i, j + 1).join('\n') });
    i = j;
  }
  return out;
}
const NOWIN = '  // v1.11.0: no window._flightDateISO fallback (no app state); the caller passes the flight date.';
// The only edits v1.11.0 makes to the app's code (applied to the app text before comparing).
const EDITS = {
  xNW_standalone: [["  const iso = flightDateISO ||\n    (typeof window !== 'undefined' && window._flightDateISO) || null;",
                    `${NOWIN}\n  const iso = flightDateISO || null;`]],
  nwOverlap_standalone: [["  const iso = flightDateISO ||\n    (typeof window !== 'undefined' && window._flightDateISO) || null;",
                          `${NOWIN}\n  const iso = flightDateISO || null;`]],
  evalNotams: [
    ["  const resolvedISO = flightDateISO ||\n    (typeof window !== 'undefined' && window._flightDateISO) || null;\n\n" +
     "  const _prevISO = (typeof window !== 'undefined') ? window._flightDateISO : null;\n" +
     "  if (typeof window !== 'undefined') window._flightDateISO = resolvedISO || window._flightDateISO;\n",
     `${NOWIN}\n  const resolvedISO = flightDateISO || null;\n`],
    ["  // Restore flight date global\n  if (typeof window !== 'undefined' && _prevISO !== null) window._flightDateISO = _prevISO;\n\n", ''],
  ],
};
// Declarations of the module's own frame (not copied from the app).
const OWN = new Set(['RULESET_TYPE', 'RULESET_VERSION', 'SCHEMA_VERSION', 'RULESET_SOURCE', 'REQUIRED_EXPORTS', 'validateSchema', 'API']);
// App declarations deliberately not carried into the module (never called by the app's NOTAM path).
const NOT_CARRIED = ['classifyNotam', 'extractNotamKeywords', 'deriveOperationalImpact', 'isNotamActive', 'notamTimeToDate',
  'SCHEDULE_PATTERNS', 'DAY_ABBR', 'decodeNotamSchedule', 'isActiveInSchedule', 'AIRPORT_TIMEZONES',
  'getAirportTimezone', 'airportLocalTime', 'AIRCRAFT_WINGSPAN'];

test('TC-120-004 copy check: every module declaration equals the app source except the documented edits', () => {
  const appNotam = fs.readFileSync(path.join(ROOT, 'src', 'notam.html'), 'utf8');
  const engineEnd = appNotam.indexOf('//  GNSS NOTAM RULESET');   // the GNSS ruleset stays separate
  assert.ok(engineEnd > 0, 'GNSS ruleset marker found in src/notam.html');
  const appDecls = [...declarations(appNotam.slice(0, engineEnd)),
                    ...declarations(fs.readFileSync(path.join(ROOT, 'src', 'airports.html'), 'utf8'))];
  const appByName = new Map();
  for (const d of appDecls) appByName.set(d.name, d);   // later declaration wins, as in the browser
  const modDecls = declarations(MOD_SRC);
  const seen = new Set();
  let compared = 0;
  for (const d of modDecls) {
    assert.ok(!seen.has(d.name), `${d.name} declared once in the module`);
    seen.add(d.name);
    if (OWN.has(d.name)) continue;
    const app = appByName.get(d.name);
    assert.ok(app, `${d.name} exists in the app`);
    let expected = app.text;
    for (const [from, to] of EDITS[d.name] || []) {
      assert.ok(expected.includes(from), `${d.name}: documented edit site still present in the app`);
      expected = expected.replace(from, to);
    }
    assert.equal(d.text, expected, `${d.name}: module copy equals the app source`);
    compared++;
  }
  // _twyApplies: the app declares it twice; the browser uses the second, and so does the module.
  assert.equal(appDecls.filter(d => d.name === '_twyApplies').length, 2);
  for (const n of NOT_CARRIED) {
    assert.ok(appByName.has(n), `${n} exists in the app`);
    assert.ok(!seen.has(n), `${n} is not carried into the module`);
    assert.ok(!new RegExp(`\\b${n}\\b`).test(MOD_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')),
      `${n} is not referenced by module code`);
  }
  // Every declaration of the app's NOTAM engine (src/notam.html up to the GNSS ruleset) is
  // either in the module or listed as not carried.
  for (const d of declarations(appNotam.slice(0, engineEnd))) {
    assert.ok(seen.has(d.name) || NOT_CARRIED.includes(d.name), `${d.name}: in the module or listed as not carried`);
  }
  assert.ok(compared >= 20, `declarations compared: ${compared}`);
  console.log(`TC-120-004: ${compared} declarations equal the app source (${Object.keys(EDITS).length} with documented edits); ${NOT_CARRIED.length} unused app declarations not carried`);
});

// ══ TC-120-010 equivalence at the OFP ETA ════════════════════════════════════

// Compare app (harness) and module for one call. Returns diff lines.
function compareEval(app, a, notamText, label) {
  const lines = [];
  const modArr = mod._splitNotams(notamText);
  if (JSON.stringify(modArr) !== JSON.stringify(Array.from(a.notamArr))) lines.push(`${label} _splitNotams differs`);
  const appRes = callEvalNotams(app, a);
  const modRes = mod.evalNotams(modArr, a.evalRole, a.etaMin, a.acftType, a.flightISO, a.depMin);
  for (const l of diffPaths(canon(appRes), canon(modRes), 'result')) lines.push(`${label} ${l}`);
  return { lines, appRes };
}

test('TC-120-010 EQUIVALENCE: every Navtech/eOFP fixture, every release airport at its OFP ETA', async () => {
  const all = await imports();
  assert.ok(all.length >= 30, `expected at least 30 Navtech/eOFP fixtures, found ${all.length}`);
  const c = { fixtures: all.length, airports: 0, evaluated: 0, chunks: 0, issues: 0, groups: 0, groupItems: 0, sid: 0, star: 0, info: 0 };
  const worst = {};
  const bad = [];
  for (const { fx, imp } of all) {
    for (const apt of imp.app.getAllAirports()) {
      c.airports++;
      const a = evalArgsFor(imp, apt);
      if (!a) continue;
      c.evaluated++;
      c.chunks += a.notamArr.length;
      const { lines, appRes } = compareEval(imp.app, a, imp.airportData[apt.icao].notams, `${fx.id} ${apt.icao} (${apt.role})`);
      bad.push(...lines);
      c.issues += appRes.issues.length;
      c.groups += appRes.rwyGroups.size;
      for (const g of appRes.rwyGroups.values()) c.groupItems += g.items.length;
      c.sid += appRes.sidIssues.length; c.star += appRes.starIssues.length; c.info += appRes.infoIssues.length;
      worst[appRes.worst] = (worst[appRes.worst] || 0) + 1;
    }
  }
  console.log(`TC-120-010: ${c.fixtures} fixtures, ${c.airports} release airports (${c.evaluated} with NOTAM text), ` +
    `${c.chunks} NOTAMs evaluated; app = module on ${c.issues} issues, ${c.groups} rwyGroups (${c.groupItems} items), ` +
    `${c.sid} SID, ${c.star} STAR, ${c.info} INFO items; worst ${JSON.stringify(worst)}; differences ${bad.length}`);
  assert.ok(c.evaluated >= 100 && c.chunks > 1000, 'corpus size');
  assert.deepEqual(bad, [], `${bad.length} difference(s) between app and module`);
});

// ══ TC-120-011 every NOTAM's resolved window ═════════════════════════════════

test('TC-120-011 EQUIVALENCE: every NOTAM of every fixture has the same window, EST flag and overlap', async () => {
  const all = await imports();
  const c = { airportNotams: 0, ofpNotams: 0, windows: 0, none: 0, est: 0, inEffect: 0 };
  const bad = [];
  const check = (app, n, iso, etaMin, where) => {
    const wa = app.xNW_standalone(n, iso), wm = mod.xNW_standalone(n, iso);
    const ea = app._windowEndEstimated(n),  em = mod._windowEndEstimated(n);
    if (JSON.stringify(canon(wa)) !== JSON.stringify(canon(wm))) bad.push(`${where} ${idOf(n)} window ${short(canon(wa))} -> ${short(canon(wm))}`);
    if (ea !== em) bad.push(`${where} ${idOf(n)} EST ${ea} -> ${em}`);
    if (wa) {
      c.windows++; if (ea) c.est++;
      const oa = app.nwOverlap_standalone(wa, etaMin, iso), om = mod.nwOverlap_standalone(wm, etaMin, iso);
      if (oa !== om) bad.push(`${where} ${idOf(n)} overlap ${oa} -> ${om}`);
      if (oa) c.inEffect++;
    } else c.none++;
  };
  for (const { fx, dir, imp } of all) {
    const app = imp.app;
    for (const apt of app.getAllAirports()) {
      const a = evalArgsFor(imp, apt);
      if (!a) continue;
      for (const n of a.notamArr) { c.airportNotams++; check(app, n, a.flightISO, a.etaMin, `${fx.id} ${apt.icao}`); }
    }
    // Every NOTAM in the whole OFP text (as TC-111-001), at the fixture's flight date.
    const raw = fs.readFileSync(path.join(dir, fx.files.text), 'utf8');
    const sa = app._splitNotams(raw), sm = mod._splitNotams(raw);
    if (JSON.stringify(sa) !== JSON.stringify(sm)) bad.push(`${fx.id} whole-OFP _splitNotams differs`);
    for (const n of sa) { c.ofpNotams++; check(app, n, fx.date, null, `${fx.id} OFP`); }
  }
  console.log(`TC-120-011: ${c.airportNotams} airport NOTAMs + ${c.ofpNotams} whole-OFP NOTAMs; ` +
    `${c.windows} with a window (${c.est} EST end), ${c.none} with none (in effect, T6); differences ${bad.length}`);
  assert.ok(c.windows > 500 && c.none > 0, 'both kinds present');
  assert.deepEqual(bad.slice(0, 50), [], `${bad.length} difference(s)`);
});

// ══ TC-120-012 equivalence beyond the ETA ════════════════════════════════════

test('TC-120-012 EQUIVALENCE: both roles, 9 times of day, departure known/unknown, no flight date', async () => {
  const all = await imports();
  const ETAS = [null, 0, 180, 360, 540, 720, 900, 1080, 1290];
  let calls = 0;
  const bad = [];
  for (const { fx, imp } of all) {
    for (const apt of imp.app.getAllAirports()) {
      const base = evalArgsFor(imp, apt);
      if (!base) continue;
      const text = imp.airportData[apt.icao].notams;
      for (const evalRole of ['ORIG', 'DEST']) {
        for (const etaMin of ETAS) {
          for (const depMin of [base.depMin, null]) {
            for (const flightISO of [base.flightISO, '']) {
              if (flightISO === '' && depMin === null) continue;
              const a = { ...base, evalRole, etaMin, depMin, flightISO };
              // evalAirport() passes flightISO = window._flightDateISO, so "no flight date"
              // means the global is empty too.
              const win = imp.app.sandbox.window, saved = win._flightDateISO;
              win._flightDateISO = flightISO;
              calls++;
              try {
                bad.push(...compareEval(imp.app, a, text, `${fx.id} ${apt.icao} ${evalRole} eta=${etaMin} dep=${depMin} date=${flightISO || 'none'}`).lines);
              } finally { win._flightDateISO = saved; }
            }
          }
        }
      }
    }
  }
  console.log(`TC-120-012: ${calls} evalNotams() calls compared; differences ${bad.length}`);
  assert.ok(calls > 3000, `calls: ${calls}`);
  assert.deepEqual(bad.slice(0, 50), [], `${bad.length} difference(s)`);
});

// ══ TC-120-013 the window._flightDateISO fallback is invisible to the app ════

test('TC-120-013 the app\'s evalNotams() output does not depend on window._flightDateISO beyond the date it is passed', async () => {
  // evalAirport() passes flightISO = window._flightDateISO itself, so the fallback the module
  // drops can never supply a different date. Proof on the corpus: with the global cleared or
  // set to another date, the app's own evalNotams() gives the same output, and leaves the
  // global as it found it.
  const all = await imports();
  let n = 0;
  const bad = [];
  for (const { fx, imp } of all) {
    const win = imp.app.sandbox.window;
    const saved = win._flightDateISO;
    for (const apt of imp.app.getAllAirports()) {
      const a = evalArgsFor(imp, apt);
      if (!a) continue;
      assert.equal(a.flightISO, saved, 'evalAirport passes the global as the flight date');
      // (i) the call evalAirport makes leaves the global as it was
      const ref = canon(callEvalNotams(imp.app, a));
      if (win._flightDateISO !== saved) bad.push(`${fx.id} ${apt.icao} global changed by the call`);
      // (ii) given the date, the output does not depend on the global
      for (const g of [undefined, null, '', '1999-01-01']) {
        win._flightDateISO = g;
        const out = canon(callEvalNotams(imp.app, a));
        if (diffPaths(ref, out).length) bad.push(`${fx.id} ${apt.icao} output changes with global=${g}`);
        n++;
      }
      win._flightDateISO = saved;
    }
    assert.ok(saved, `${fx.id}: the import set window._flightDateISO`);
  }
  console.log(`TC-120-013: ${n} app calls with the global altered; differences ${bad.length}`);
  assert.deepEqual(bad, []);
});

// ══ TC-120-020 / 021 existing NOTAM tests against the module ═════════════════

const NOTAM_TESTS = ['notam-year', 'notam-merge', 'notam-schedule-est', 'notam-copies-agree']
  .map(f => path.join(ROOT, 'test', 'unit', `${f}.test.js`));

function runTests(files, env, extra = []) {
  // NODE_TEST_CONTEXT would make the child report to this runner instead of printing TAP.
  const childEnv = { ...process.env, ...env };
  delete childEnv.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...extra, ...files], {
    cwd: ROOT, encoding: 'utf8', env: childEnv, timeout: 300000, maxBuffer: 64 * 1024 * 1024,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const num = k => { const m = out.match(new RegExp(`^# ${k} (\\d+)$`, 'm')); return m ? parseInt(m[1], 10) : null; };
  const ids = [...new Set((out.match(/TC-11[013]-[A-Z0-9]+/g) || []))];
  return { status: r.status, tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'), todo: num('todo'), ids, out };
}

test('TC-120-020 every existing NOTAM unit test (TC-110, TC-111, TC-113, copies-agree set) passes against the module', () => {
  const dir = requireFixturesDir();
  const onApp = runTests(NOTAM_TESTS, { PB_FIXTURES: dir, PB_NOTAM_ENGINE: '' });
  const onMod = runTests(NOTAM_TESTS, { PB_FIXTURES: dir, PB_NOTAM_ENGINE: 'module' });
  console.log(`TC-120-020: app ${onApp.pass}/${onApp.tests} pass; module ${onMod.pass}/${onMod.tests} pass ` +
    `(fail ${onMod.fail}, skipped ${onMod.skipped}); TC IDs seen ${onMod.ids.length}`);
  assert.equal(onApp.status, 0, 'baseline: the tests pass against the app');
  assert.equal(onMod.status, 0, `module run failed:\n${onMod.out.split('\n').filter(l => /^not ok|Error|assert/i.test(l)).slice(0, 20).join('\n')}`);
  assert.equal(onMod.fail, 0);
  assert.equal(onMod.skipped, 0);
  assert.equal(onMod.todo, 0);
  assert.equal(onMod.tests, onApp.tests, 'same number of tests on app and module');
  assert.equal(onMod.pass, onMod.tests);
  for (const p of ['TC-110-', 'TC-111-', 'TC-113-']) assert.ok(onMod.ids.some(i => i.startsWith(p)), `${p}* ran`);
});

test('TC-120-021 the gate bites: a module with one rule broken fails the NOTAM tests and the equivalence', async () => {
  const dir = requireFixturesDir();
  // Break D31 (an estimated end is not an end): the EST rule in evalNotams() removed.
  const from = '    if (w && _windowEndEstimated(notamRaw)) w = { startMs: w.startMs, endMs: Infinity };\n';
  assert.ok(MOD_SRC.includes(from), 'mutation site present');
  const broken = MOD_SRC.replace(from, '');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tc120-'));
  const file = path.join(tmp, 'notam-rules-broken.js');
  fs.writeFileSync(file, broken);
  try {
    const r = runTests(NOTAM_TESTS, { PB_FIXTURES: dir, PB_NOTAM_ENGINE: file });
    assert.notEqual(r.status, 0, 'the NOTAM tests fail against the broken module');
    assert.ok(r.fail > 0, `failing tests: ${r.fail}`);
    // and the equivalence comparison sees it on the corpus
    const bm = { exports: {} };
    new Function('module', 'exports', 'require', broken)(bm, bm.exports, () => ({}));
    let diffs = 0;
    for (const { imp } of await imports()) {
      for (const apt of imp.app.getAllAirports()) {
        const a = evalArgsFor(imp, apt);
        if (!a) continue;
        const x = canon(callEvalNotams(imp.app, a));
        const y = canon(bm.exports.evalNotams(bm.exports._splitNotams(imp.airportData[apt.icao].notams), a.evalRole, a.etaMin, a.acftType, a.flightISO, a.depMin));
        if (diffPaths(x, y).length) diffs++;
      }
    }
    console.log(`TC-120-021: broken module → ${r.fail} NOTAM test(s) fail; ${diffs} airport(s) differ from the app`);
    assert.ok(diffs > 0, 'the equivalence check detects the broken rule');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ══ TC-120-030 fixtures missing → FAIL ═══════════════════════════════════════

test('TC-120-030 fixtures missing: the fixture tests fail, they are never skipped', () => {
  const r = runTests([__filename], { PB_FIXTURES: path.join(os.tmpdir(), 'no-such-fixtures-dir') },
    ['--test-name-pattern', 'TC-120-01[0-3]']);
  assert.notEqual(r.status, 0, 'the run fails');
  assert.equal(r.skipped, 0, 'nothing is skipped');
  assert.ok(r.fail >= 4, `TC-120-010..013 fail (fail=${r.fail})`);
  assert.ok(/fixtures not found/.test(r.out), 'the failure says the fixtures were not found');
});
