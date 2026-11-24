'use strict';
/**
 * TC-175 — FlightKeys OFP parser v1.0.1 (rules/ofp-flightkeys-next; step 5e-2 module PR, Exec answers O-100,
 * O-103 option B, O-115): the module only, NOT built into the app (D90: the integration is its own PR). The only
 * change from v1.0.0: the internal references ("(SME-n)", "(O-n)", "(D63a)", "(CS-1)", "rows 29–31", "read in
 * 5d", "(§A.8)" and combinations) are removed from the
 * crew-facing finding texts, at the source (O-100); meaning, wording and capitals are unchanged, and only the
 * spaces and brackets the references leave behind are tidied. Level, field and code of every finding unchanged.
 * The references stay in the module's comments, the SPEC and these tests.
 *
 *   TC-175-001  identity: v1.0.1, contract 2.4; built in under ofp-flightkeys from display PR 1 (O-116) to the
 *               step 5f display PR, which replaced it with v1.1.0: frozen in test/oracle (SHA-256 a307b185…),
 *               out of rules/; v1.0.0 frozen in test/oracle (SHA-256 8a7d3e8f…); NavBlue, NAT, NOTAM and
 *               icao-fpl bytes unchanged; a changed byte is caught by the manifest check (negative)
 *   TC-175-002  replaced (step 5f display): index.html carries neither v1.0.1 nor v1.0.0 (v1.1.1 once);
 *               build/build.js has no -next entry; the build from src/ equals index.html; APP_VERSION,
 *               CACHE_NAME and manifest.json stay 1.11.0 (release)
 *   TC-175-003  validateSchema(): valid
 *   TC-175-004  every finding template, by level and field (static, all templates, fired or not): none in v1.0.1
 *               carries "(SME-", "(O-", "D-n", "CS-n", "§", a row or step reference or a version number (O-115);
 *               NEGATIVE control: the same scan finds the references in v1.0.0 — 11 WARN and 20 INFO templates;
 *               the deferred-field INFO keeps the text O-84 set; its unused 5d step is unreachable
 *   TC-175-005  the source differs from v1.0.0 only in the header comment, RULESET_VERSION and those 31 templates,
 *               and each changed template is the v1.0.0 one with the references removed (an independent strip),
 *               expressions untouched; a template without a reference is unchanged (negative)
 *   TC-175-010  all 26 vs v1.0.0: every key except findings byte-identical, keys in order; findings[] the same
 *               length, order, level, field, code and keys; a message differs only where v1.0.0's carried a
 *               reference, and then equals v1.0.0's with the reference removed; no message of v1.0.1 carries a
 *               reference; counts: 143 texts on 26 packages, 4 of them WARN (L08, L21, L22, L23)
 *   TC-175-011  pinned values on all 26 (fixtures expected/ofp-flightkeys-v1.0.1/messages.json): every changed
 *               text with its index, level and field, made with this module (SHA-256)
 *   TC-175-020  the 4 shown WARNs on OFP Alerts (the app's real import path, index.html with v1.0.1 in place of
 *               v1.1.0 in memory): NAT one-direction CREW ALERT (L08, L22), NZWN takeoff alternate (L21), ETAR
 *               curfew (L23) show the new text exactly, the old text nowhere; the list keeps its lines and order;
 *               NEGATIVE control: index.html with v1.0.0 put back (in memory) shows the v1.0.0 texts
 *   TC-175-030  NavBlue identical, 30 of 30: _ofpRulesetParse with v1.0.1 swapped in = the committed golden
 *               snapshots; a changed snapshot value is caught (negative)
 *   TC-175-090  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Fixture tests assert counts, package labels, levels and fields; the fixture values themselves are in the
 * private fixtures repo. No fixture text is printed here.
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
const { NOT_BUILT_IN } = require('../lib/not-built-in');   // step 5f: the declared *-next keys (D90, D96)
const { diff } = require('../golden/diff');
const { MODULES, assemble } = require('../../build/build');
const { checkRules } = require('../../build/check-rules');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
// Step 5e-2 display PR 1 (O-116): v1.0.1 moved to the key ofp-flightkeys and was built in; v1.0.0 left rules/
// (frozen copy test/oracle/ofp-flightkeys-v1.0.0.js, SHA-256 8a7d3e8f…). Step 5f display: v1.1.0 replaced
// v1.0.1, which left rules/ (frozen copy test/oracle/ofp-flightkeys-v1.0.1.js, SHA-256 a307b185…).
const NEW_FILE = path.join(ROOT, 'test', 'oracle', 'ofp-flightkeys-v1.0.1.js');
const BUILT_FILE = path.join(RULES, MANIFEST['ofp-flightkeys'].file);   // v1.1.1, built in (DEF-013 integration; v1.1.0 at step 5f display)
const BUILT_SRC  = fs.readFileSync(BUILT_FILE, 'utf8');
const OLD_FILE = path.join(ROOT, 'test', 'oracle', 'ofp-flightkeys-v1.0.0.js');
const NEW_SRC  = fs.readFileSync(NEW_FILE, 'utf8');
const OLD_SRC  = fs.readFileSync(OLD_FILE, 'utf8');
const mod      = require(NEW_FILE);    // v1.0.1
const v100     = require(OLD_FILE);    // v1.0.0, frozen copy (built in until O-116)
const OPTS     = {
  icaoFpl:         require(path.join(RULES, MANIFEST['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MANIFEST['aircraft-profile'].file)),
  notamRules:      require(path.join(RULES, MANIFEST['notam-rules'].file)),
  parseNatTrack:   require(path.join(RULES, MANIFEST['nat-rules'].file)).parseNatTrack,
};
const HTML     = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const EXPECTED_FILE = path.join('expected', 'ofp-flightkeys-v1.0.1', 'messages.json');
const sha      = s => crypto.createHash('sha256').update(s).digest('hex');
const j        = x => JSON.stringify(x);

// The reference patterns (O-100, O-115, D99): "(SME-", "(O-", "D-n" (D63a, D47 …), "CS-n", "§", a field-map row
// ("rows 29–31"), a step ("in 5d", "step 5e") or a version number.
const REF = /\((?:SME|O)-|\bSME-\d|\bO-\d|\bD-?\d+[a-z]?\b|\bCS-\d|§|\brows? \d|\b(?:in|step) \d[a-e]\b|\bv?\d+\.\d+\.\d+\b/;
// Independent strip (the oracle): " (O-42, SME-20)", " (SME-17/21)", " (D63a)" → ""; "; SME-18a)" → ")".
// O-115: " (CS-1)", " (§A.8)" as above; "rows 29–31 " → ""; ", read in 5d" → "".
const ITEM  = '(?:(?:SME|O|CS)-\\d+[a-z]?(?:\\/\\d+)?|D\\d+[a-z]?|§[A-Z]\\.\\d+)';
const STRIP = [[new RegExp(` \\(${ITEM}(?:, ${ITEM})*\\)`, 'g'), ''], [new RegExp(`; ${ITEM}\\)`, 'g'), ')'],
  [/\brows? \d+(?:[–-]\d+)? /g, ''], [/, read in \d[a-e]\b/g, '']];
const strip = s => STRIP.reduce((t, [re, to]) => t.replace(re, to), s);

// ══ static scan of the finding templates ═════════════════════════════════════════════════════════
// A template = one call add(level, field, message) / ctx.add(…) or warns.push(message) (the curfew WARNs, added
// as WARN airportData.curfew). Returns { line, level, field, text: the call's source, literals: its string text }.
function scanCall(src, open) {
  // from the "(" at `open` to its matching ")": [args source, top-level argument starts, string text per arg]
  let i = open + 1, depth = 0;
  const stack = [], lits = [[]], cut = [i];
  const lit = s => lits[lits.length - 1].push(s);
  while (i < src.length) {
    const c = src[i];
    const mode = stack[stack.length - 1];
    if (mode === "'" || mode === '"') {
      if (c === '\\') { lit(src.slice(i, i + 2)); i += 2; continue; }
      if (c === mode) stack.pop(); else lit(c);
      i++; continue;
    }
    if (mode === '`') {
      if (c === '\\') { lit(src.slice(i, i + 2)); i += 2; continue; }
      if (c === '`') { stack.pop(); i++; continue; }
      if (c === '$' && src[i + 1] === '{') { stack.push('{'); i += 2; continue; }
      lit(c); i++; continue;
    }
    // code (top level of the call, or inside ${ … })
    if (c === "'" || c === '"' || c === '`') { stack.push(c); i++; continue; }
    if (c === '/' && src[i + 1] === '/') throw new Error(`comment inside a finding call at ${open}`);
    if (c === '{') { stack.push('{'); i++; continue; }
    if (c === '}' && mode === '{') { stack.pop(); i++; continue; }
    if (!stack.length) {
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') { if (depth === 0) break; depth--; }
      else if (c === ',' && depth === 0) { cut.push(i + 1); lits.push([]); }
    }
    i++;
  }
  return { end: i, args: src.slice(open + 1, i), cut, lits: lits.map(x => x.join('')) };
}
function templates(src) {
  const out = [], re = /(?<![\w.$])(?:ctx\.)?add\(|\bwarns\.push\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const open = m.index + m[0].length - 1;
    const c = scanCall(src, open);
    const line = src.slice(0, m.index).split('\n').length;
    if (m[0].startsWith('warns')) { out.push({ line, level: 'WARN', field: 'airportData.curfew', text: src.slice(m.index, c.end + 1), literals: c.lits.join('|') }); continue; }
    const lvl = c.args.slice(0, c.cut[1] - open - 2);
    if (!/'(WARN|INFO)'/.test(lvl)) continue;                                         // Set.add(…), not a finding
    const level = /'WARN'/.test(lvl) && /'INFO'/.test(lvl) ? 'WARN/INFO' : /'WARN'/.test(lvl) ? 'WARN' : 'INFO';
    out.push({ line, level, field: c.lits[1], text: src.slice(m.index, c.end + 1), literals: c.lits.slice(2).join('|') });
  }
  return out;
}
const T_NEW = templates(NEW_SRC), T_OLD = templates(OLD_SRC);
const withRef = ts => ts.filter(t => REF.test(t.literals));
const count = ts => ({ WARN: ts.filter(t => t.level === 'WARN').length, INFO: ts.filter(t => t.level === 'INFO').length });

// ══ TC-175-001 … 005 module ══════════════════════════════════════════════════════════════════════

test('TC-175-001 identity: v1.0.1 (built in at O-116, replaced by v1.1.0 at step 5f display, v1.1.1 at DEF-013) frozen in test/oracle; v1.0.0 frozen; other modules unchanged; a changed byte is caught', () => {
  assert.deepEqual([mod.RULESET_TYPE, mod.OFP_FORMAT, mod.RULESET_VERSION, mod.SCHEMA_VERSION, mod.CONTRACT_VERSION], ['ofp', 'flightkeys', '1.0.1', 2, '2.4']);
  const e = MANIFEST['ofp-flightkeys'];
  assert.deepEqual(Object.keys(e), ['version', 'file', 'sha256']);
  assert.deepEqual([e.version, e.file], ['1.1.1', 'ofp-flightkeys/ofp-flightkeys-v1.1.1.js'], 'step 5f display: v1.1.0 replaced v1.0.1; DEF-013 integration: v1.1.1');
  assert.equal(sha(fs.readFileSync(NEW_FILE)), 'a307b18558a43da53c2e8bf2648a2c921facc699610951fde77bd24cc607750d', 'test/oracle: the bytes of the module PR (#70), byte for byte');
  assert.deepEqual(fs.readdirSync(path.join(RULES, 'ofp-flightkeys')).filter(f => f.endsWith('.js')), ['ofp-flightkeys-v1.1.1.js'], 'v1.0.1 (and v1.1.0) are no longer in rules/ofp-flightkeys');
  assert.deepEqual(NOT_BUILT_IN, [], 'DEF-013 integration: no *-next key declared (D96)');
  // v1.0.0: out of rules/, frozen copy byte for byte
  assert.equal(sha(fs.readFileSync(OLD_FILE)), '8a7d3e8fbf02ebae421739dfd65f8598d47e4d016ae1e7a3a2a791389e548e40');
  assert.equal(v100.RULESET_VERSION, '1.0.0');
  const pinned = {
    'ofp-navblue':      ['2.0.1',  'f7dd7b28f2c61555a1cdfd9a21d601bd6c10ddc0af3d3df890d53541079c6025'],
    'nat-rules':        ['1.2.0',  'a0ed2a31a344680424e96fd31d3046ac8cd65244e58cebd553fe5021fa2ca80d'],
    'notam-rules':      ['1.14.0', '139ce1691574a440a2c371296aea82985bfe26904d77114fa81969c8e86621cb'],
    'icao-fpl':         ['1.0.0',  'd7b432506f32a3675ce3ffa68a07b7e194ed523c9e8dcbd3177f78da36d49ad2'],
    'aircraft-profile': ['1.0.0',  '7ca993193303228d595454ac5bf24ee82eddb9ae1fecc56ad7176dad238a4be5'],
  };
  for (const [k, v] of Object.entries(pinned)) assert.deepEqual([MANIFEST[k].version, MANIFEST[k].sha256], v, k);
  assert.deepEqual(Object.keys(MANIFEST), ['notam-rules', 'ofp-navblue', 'aircraft-profile', 'icao-fpl', 'ofp-flightkeys', 'nat-rules', 'advisory-rules', ...NOT_BUILT_IN]);
  assert.equal(checkRules(ROOT).ok, true);
  // NEGATIVE: one changed byte in a copy of rules/ → the manifest check fails
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tc175-'));
  try {
    fs.cpSync(RULES, path.join(tmp, 'rules'), { recursive: true });
    fs.appendFileSync(path.join(tmp, 'rules', e.file), ' ');
    const c = checkRules(tmp);
    assert.equal(c.ok, false);
    assert.ok(c.errors.some(x => /ofp-flightkeys.*does not match the manifest/.test(x)), c.errors.join('; '));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('TC-175-002 replaced (step 5f display, DEF-013): index.html carries neither v1.0.1 nor v1.0.0 (v1.1.1 once); build = index.html; labels 1.11.0 (release)', () => {
  assert.ok(!HTML.includes(NEW_SRC), 'v1.0.1 not in index.html');
  assert.equal(HTML.split(BUILT_SRC).length, 2, 'index.html carries v1.1.1 once, byte for byte');
  assert.ok(!HTML.includes(OLD_SRC), 'v1.0.0 not in index.html');
  assert.ok(!HTML.includes("const RULESET_VERSION  = '1.0.0';\n"), 'no v1.0.0 version line');
  assert.equal(MODULES.filter(m => m && m.rule === 'ofp-flightkeys').length, 1);
  assert.equal(MODULES.filter(m => m && /-next$/.test(m.rule)).length, 0, 'build/build.js has no -next module');
  assert.equal(sha(assemble(ROOT)), sha(fs.readFileSync(path.join(ROOT, 'index.html'))), 'the build from src/ and rules/ = the committed index.html');
  assert.match(HTML, /const APP_VERSION = '1\.11\.0';/);
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /const CACHE_NAME\s*=\s*'pb-v1\.11\.0';/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version, '1.11.0');
});

test('TC-175-003 validateSchema(): valid', () => {
  assert.deepEqual(mod.validateSchema(), { valid: true, errors: [] });
});

test('TC-175-004 no finding template carries "(SME-", "(O-", "D-n", "CS-n", "§", a row / step reference or a version number (all templates, by level and field); v1.0.0 had 11 WARN + 20 INFO', () => {
  assert.equal(T_NEW.length, T_OLD.length, 'the same templates, in the same order');
  assert.equal(T_NEW.length, 147, 'every add() / ctx.add() / warns.push() finding call of the module (grep count)');
  T_NEW.forEach((t, i) => assert.deepEqual([t.level, t.field], [T_OLD[i].level, T_OLD[i].field], `template ${i}: level and field unchanged`));
  const left = withRef(T_NEW);
  assert.deepEqual(left.map(t => `${t.level} ${t.field} (line ${t.line})`), [], 'no template of v1.0.1 carries a reference');
  // NEGATIVE control: the scan finds the references where they were
  const had = withRef(T_OLD);
  assert.deepEqual(count(had), { WARN: 11, INFO: 20 });
  assert.equal(had.filter(t => t.level === 'WARN/INFO').length, 0);
  assert.deepEqual(had.map(t => `${t.level} ${t.field}`).sort(), [
    'INFO airportData', 'INFO airportData.curfew', 'INFO airportData.opsNotes', 'INFO crewMembers', 'INFO crewMembers',
    'INFO ddgItems', 'INFO designator', 'INFO dispatchContact', 'INFO dispatchContact', 'INFO enrouteNotams', 'INFO enrouteNotams',
    'INFO enrouteNotams', 'INFO enrouteNotams', 'INFO enrouteNotams', 'INFO enrouteNotams', 'INFO ewins', 'INFO ewins', 'INFO hazards',
    'INFO natTrack', 'INFO sections',
    'WARN airportData.curfew', 'WARN airportData.curfew', 'WARN airportData.curfew', 'WARN altData', 'WARN dotExemption', 'WARN enrouteNotams',
    'WARN natTrack', 'WARN natTrack', 'WARN natTrack', 'WARN natTrack', 'WARN ofpRemarks',
  ]);
  // the scan sees a planted reference (negative)
  assert.equal(withRef(templates("add('WARN', 'x', `text (O-7)`); add('INFO', 'y', 'v1.2.3'); add('INFO', 'z', 'see D47');")).length, 3);
  assert.equal(withRef(templates("add('WARN', 'x', `text (CS-1)`); add('INFO', 'y', 'rows 29–31 not read'); add('INFO', 'z', 'read in 5d (§A.8)');")).length, 3);
  assert.equal(withRef(templates("add('WARN', 'x', `text ${a.b} (aircraft ${c})`); s.add(`(O-1)`);")).length, 0);
  // the deferred-field INFO is built from DEFERRED_STEPS, not a literal: it keeps the text the Exec set (O-84),
  // and the '5d' step text is unreachable (no field is deferred to 5d)
  assert.deepEqual(Object.values(mod.DEFERRED_FIELDS), ['open']);
  assert.ok(NEW_SRC.includes("add('INFO', f, `not read: ${DEFERRED_STEPS[DEFERRED_FIELDS[f]]}`)"));
});

test('TC-175-005 the source differs from v1.0.0 only in the header, RULESET_VERSION and the 31 templates, each = v1.0.0 with the references stripped', () => {
  const oldL = OLD_SRC.split('\n'), newL = NEW_SRC.split('\n');
  const anchor = l => l.findIndex(x => x.startsWith(' * v1.0.0 (D58; step 5e-1'));
  const ao = anchor(oldL), an = anchor(newL);
  assert.ok(ao > 0 && an > ao, 'the v1.0.1 paragraph is added before the v1.0.0 one');
  assert.match(newL.slice(1, an).join('\n'), /v1\.0\.1[\s\S]*O-100[\s\S]*NOT? built into index\.html|v1\.0\.1[\s\S]*Not built into index\.html/);
  assert.deepEqual(newL.slice(0, an).filter(l => !/^ \*/.test(l) && l !== '/**'), [], 'only comment lines added in the header');
  assert.equal(newL.length - an, oldL.length - ao, 'the same number of lines after the header');
  const tplLines = new Set(withRef(T_OLD).flatMap(t => { const n = t.text.split('\n').length; return Array.from({ length: n }, (_, k) => t.line - 1 + k); }));
  const changed = [];
  for (let k = 0; k < oldL.length - ao; k++) if (oldL[ao + k] !== newL[an + k]) changed.push(ao + k);
  const version = changed.filter(i => !tplLines.has(i));
  assert.deepEqual(version.map(i => oldL[i]), ["const RULESET_VERSION  = '1.0.0';"], 'outside the templates only RULESET_VERSION changes');
  assert.equal(newL[an + version[0] - ao], "const RULESET_VERSION  = '1.0.1';");
  assert.equal(changed.length - 1, 32, '32 changed lines: 31 templates, one of them over two lines');
  // each changed template = the v1.0.0 template with the references stripped; every other template unchanged
  let stripped = 0;
  T_OLD.forEach((t, i) => {
    if (REF.test(t.literals)) { assert.equal(T_NEW[i].text, strip(t.text), `${t.level} ${t.field} (line ${t.line})`); assert.notEqual(T_NEW[i].text, t.text); stripped++; }
    else assert.equal(T_NEW[i].text, t.text, `NEGATIVE: ${t.level} ${t.field} (line ${t.line}) has no reference and is unchanged`);
  });
  assert.equal(stripped, 31);
});

// ══ TC-175-010 / 011 / 020 / 030 / 090 fixtures ══════════════════════════════════════════════════

const FIX = findFixtures(process.env.PB_FIXTURES || null);
const fixtureTest = (name, fn) => test(name, async () => { assert.ok(FIX, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)'); return fn(); });
const LBL = Object.fromEntries(Object.entries(require('./data/ofp-flightkeys-v0.3.0-baseline.json').fixtures).map(([id, b]) => [id, b.label]));
let _fk = null;
function fk() {
  if (_fk) return _fk;
  _fk = readManifest(FIX).fixtures.filter(f => f.format === 'flightkeys').map(fx => {
    const text = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8'), items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
    const a = v100.parseFlightKeys(v100.inputFromExtractor(text, items), OPTS);
    const b = mod.parseFlightKeys(mod.inputFromExtractor(text, items), OPTS);
    return { fx, lbl: LBL[fx.id], a, b };
  });
  return _fk;
}
const SHOWN_WARN = ['L08', 'L21', 'L22', 'L23'];

fixtureTest('TC-175-010 all 26 vs v1.0.0: every other field byte-identical; findings differ only in the texts that carried a reference (143 on 26, 4 WARN)', () => {
  assert.equal(fk().length, 26);
  let n = 0, kept = 0;
  const warnPkgs = [], perLevel = { WARN: 0, INFO: 0 };
  for (const { lbl, a, b } of fk()) {
    assert.deepEqual(Object.keys(b), Object.keys(a), `${lbl}: keys in order`);
    for (const k of Object.keys(a)) if (k !== 'findings') assert.equal(j(b[k]), j(a[k]), `${lbl}: ${k} byte-identical`);
    assert.equal(b.findings.length, a.findings.length, `${lbl}: findings count`);
    a.findings.forEach((f, i) => {
      const g = b.findings[i];
      assert.deepEqual(Object.keys(g), Object.keys(f), `${lbl} #${i}: keys`);
      assert.deepEqual([g.level, g.field, g.code], [f.level, f.field, f.code], `${lbl} #${i}: level, field, code`);
      assert.ok(!REF.test(g.message), `${lbl} #${i} ${g.level} ${g.field}: no reference in a v1.0.1 text`);
      if (REF.test(f.message)) {
        assert.equal(g.message, strip(f.message), `${lbl} #${i} ${f.level} ${f.field}: v1.0.0 text with the reference removed`);
        n++; perLevel[f.level]++;
        if (f.level === 'WARN' && !warnPkgs.includes(lbl)) warnPkgs.push(lbl);
      } else { assert.equal(g.message, f.message, `NEGATIVE: ${lbl} #${i} ${f.level} ${f.field}: no reference, unchanged`); kept++; }
    });
  }
  assert.equal(n, 143, 'changed texts on the 26');
  assert.deepEqual(perLevel, { WARN: 4, INFO: 139 });
  assert.deepEqual(warnPkgs.sort(), SHOWN_WARN);
  assert.equal(fk().filter(p => p.a.findings.some((f, i) => f.message !== p.b.findings[i].message)).length, 26, 'a changed text in every package');
  console.log(`TC-175-010: ${n} texts changed (WARN ${perLevel.WARN}, INFO ${perLevel.INFO}), ${kept} unchanged, on ${fk().length} packages; every other field equal`);
});

fixtureTest('TC-175-011 pinned values on all 26 (expected/ofp-flightkeys-v1.0.1/messages.json)', () => {
  const pin = JSON.parse(fs.readFileSync(path.join(FIX, EXPECTED_FILE), 'utf8'));
  assert.equal(pin.module.version, '1.0.1');
  assert.equal(pin.module.sha256, sha(fs.readFileSync(NEW_FILE)), 'the pinned values were made with this module');
  assert.deepEqual(Object.keys(pin.packages).sort(), fk().map(p => p.fx.id).sort());
  let total = 0;
  for (const p of fk()) {
    const e = pin.packages[p.fx.id];
    assert.equal(e.label, p.lbl);
    const got = p.b.findings.map((f, i) => [i, f.level, f.field, f.message]).filter(([i]) => p.a.findings[i].message !== p.b.findings[i].message);
    assert.deepEqual(got, e.changed, `${p.lbl}: changed texts`);
    total += e.changed.length;
  }
  assert.equal(total, 143);
});

// The app's real import path (processPDF → parseOFP → S.ofpFindings → the Preflight card), with an index.html.
// Step 5f display / DEF-013: the committed index.html carries v1.1.1; HTML_V101 is it with v1.0.1 put back (in memory, the app
// from O-116 to step 5f), HTML_V100 with v1.0.0 put back (the app before O-116).
const HTML_V101 = (() => {
  assert.equal(HTML.split(BUILT_SRC).length, 2);
  return HTML.replace(BUILT_SRC, () => NEW_SRC);
})();
const HTML_V100 = (() => {
  assert.equal(HTML.split(BUILT_SRC).length, 2);
  return HTML.replace(BUILT_SRC, () => OLD_SRC);
})();
const unEsc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
async function alerts(fx, html) {
  const imp = await importFixture(fx, FIX, { html });
  const m = imp.app.renderPreflightPhase().match(/<div class="section"><div class="callout"[^>]*>[\s\S]*?<span class="callout-title[^"]*"[^>]*>OFP Alerts<\/span>([\s\S]*?)<\/span><\/div><\/div>/);
  return { list: m ? m[1].split('<br>').map(unEsc) : [], stored: JSON.parse(JSON.stringify(imp.S.ofpFindings || [])) };
}

fixtureTest('TC-175-020 the 4 shown WARNs (NAT CREW ALERT x2, NZWN takeoff alternate, ETAR curfew) show the new text on OFP Alerts (v1.0.1 put back); with v1.0.0 put back the old text', async () => {
  const fields = { L08: 'natTrack', L21: 'altData', L22: 'natTrack', L23: 'airportData.curfew' };
  for (const lbl of SHOWN_WARN) {
    const p = fk().find(x => x.lbl === lbl);
    const oldW = p.a.findings.filter(f => f.level === 'WARN' && REF.test(f.message));
    assert.equal(oldW.length, 1, `${lbl}: one WARN with a reference in v1.0.0`);
    assert.equal(oldW[0].field, fields[lbl]);
    const newText = strip(oldW[0].message);
    if (lbl === 'L08' || lbl === 'L22') assert.match(newText, /^CREW ALERT: the package prints only the .* NAT track message .*Returned so the crew can check it$/);
    if (lbl === 'L21') assert.match(newText, /^NZWN: the station restriction requires a takeoff alternate; the release lists none$/);
    if (lbl === 'L23') assert.match(newText, /^ETAR /);
    const after = await alerts(p.fx, HTML_V101), before = await alerts(p.fx, HTML_V100);
    // positive: the new text exactly, once; negative: the old text nowhere
    assert.equal(after.list.filter(l => l === newText).length, 1, `${lbl}: the new text on OFP Alerts`);
    assert.ok(!after.list.includes(oldW[0].message), `${lbl}: the old text is not shown`);
    assert.ok(after.list.every(l => !REF.test(l)), `${lbl}: no reference on the list`);
    assert.deepEqual(after.stored.map(f => f.message), p.b.findings.map(f => f.message), `${lbl}: stored with the flight = the module's findings`);
    // the list keeps its lines and order: v1.0.0's lines with the references removed
    assert.deepEqual(after.list, before.list.map(strip), `${lbl}: same lines, same order`);
    // NEGATIVE control: the app with v1.0.0 put back shows the old text, not the new one
    assert.ok(before.list.includes(oldW[0].message), `${lbl}: with v1.0.0 the v1.0.0 text`);
    assert.ok(!before.list.includes(newText), `${lbl}: with v1.0.0 not the new text`);
  }
});

fixtureTest('TC-175-030 NavBlue identical, 30 of 30: _ofpRulesetParse with v1.0.1 swapped in = the golden snapshots; a changed value is caught', () => {
  const nb = readManifest(FIX).fixtures.filter(f => f.format !== 'flightkeys');
  assert.equal(nb.length, 30);
  const app = loadApp({ html: HTML_V101 });
  let same = 0, first = null;
  for (const fx of nb) {
    const raw = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8');
    let r;
    try { r = { result: normalize(app._ofpRulesetParse(raw)) }; } catch (e) { r = { error: String(e && e.message || e) }; }
    const snap = normalize({ id: fx.id, parser: '_ofpRulesetParse', ...r });
    const want = JSON.parse(fs.readFileSync(path.join(FIX, 'snapshots', `${fx.id}.json`), 'utf8'));
    assert.deepEqual(diff(want, snap), [], `${fx.id}: NavBlue output = its snapshot`);
    if (!first) first = { want, snap };
    same++;
  }
  assert.equal(same, 30);
  // NEGATIVE: a changed value is seen by the compare
  const bad = JSON.parse(JSON.stringify(first.want));
  bad.result.fltNum = String(bad.result.fltNum) + 'X';
  assert.ok(diff(bad, first.snap).length > 0);
});

test('TC-175-090 fixtures missing → the fixture tests FAIL, never skip', () => {
  assert.equal(findFixtures(path.join(ROOT, 'no-such-dir')) === path.join(ROOT, 'no-such-dir'), false, 'a directory without a manifest is not taken as the fixtures');
  assert.ok(FIX, 'the fixtures are available in this run');
});
