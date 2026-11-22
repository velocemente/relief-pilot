'use strict';
/**
 * TC-181 — advisory-rules v1.0.0 (rules/advisory-rules-next; step 5f module PR B, Exec answers O-169 … O-181 of
 * 22 Nov, D115, D116, D88, D90, D96, D99, D103, D118): the shared volcanic ash and RAIM rules, NOT built into the
 * app (D90). Read on the contract of ofp-flightkeys v1.1.0 (ofp-flightkeys-next, module PR A).
 *
 *   TC-181-001  identity: v1.0.0, key advisory-rules-next (file, SHA-256), declared not built in; the other
 *               modules' bytes unchanged; a changed byte is caught (negative)
 *   TC-181-002  not built in (D90): index.html carries no byte-run of it; build = index.html; no -next module
 *               built; labels 1.10.0; the module reads no window, DOM, storage, clock or network (static)
 *   TC-181-003  validateSchema(): valid; NEGATIVE: a sentence-case text, an internal reference, a version in a
 *               text, a forbidden export, a wrong type are refused
 *   TC-181-004  O-178 crew texts, byte for byte (capitals, U+2013 en dash, no full stop)
 *   TC-181-005  the closed lists (VA terms, the negative form, the RAIM PASSED forms) and their rules: "VA" in
 *               capitals only, whole words; "no ash cloud" carries a term; negatives
 *   TC-181-010  the 26 against scoping: 26 VA pages (1 advisory L02, 25 none); VA remarks L03 positive, L14
 *               negative; WARN on L03 only (routing), none on L02 (O-170); 27 RAIM records, all PASSED → 0
 *               attention; the OFP Remarks flag on L03 only
 *   TC-181-011  the 26: 24 volcanic FIR items in 10 packages (per package and FIR), L06 "no ash cloud" items
 *               flagged (O-180); hazards: L15 WAAF only, 4 VA SIGMETs
 *   TC-181-015  pinned results (fixtures expected/advisory-rules-v1.0.0/results.json), made with this module
 *               and ofp-flightkeys v1.1.0
 *   TC-181-020  SYNTHETIC volcanic ash, end to end through ofp-flightkeys v1.1.0: VAA + positive remark; VAA, no
 *               remark; VAA + remark naming another volcano; garbled VA page (with and without a remark); VA remark
 *               joined to a neighbouring paragraph; NO VA ACTIVITY + VAA; NONE / no page + positive remark; both
 *               WARNs once each; two advisories; a volcano name over a line break; skipped remark kinds
 *   TC-181-030  SYNTHETIC RAIM, end to end: outage with satellite and times; "no outages" wording; FAILED;
 *               garbled; outage with continuation lines; PASSED + outage → no output (also ETOPS ALTN); the word
 *               RAIM in a non-RAIM remark; RAIM in NOTAM text; no RAIM remark; never a WARN (O-171)
 *   TC-181-040  SYNTHETIC volcanic FIR items (O-180): ASHTAM, "no ash cloud", VAAC, a Company item, lower-case
 *               "va" (negative), hazards with and without a VA SIGMET
 *   TC-181-050  D88 / D118: the 30 NavBlue results give nothing; the same content in a format-neutral object
 *               gives the same result as the FlightKeys object; not an object → null
 *   TC-181-051  the input is never changed
 *   TC-181-090  fixtures missing → the fixture tests FAIL (never skip)
 *
 * Every synthetic case is labelled SYNTHETIC (D87), made-up identifiers, built by test/lib/fk-synth.js.
 * Fixture tests assert counts, labels, codes, FIRs and NOTAM IDs; no fixture text is printed.
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
const FILE     = path.join(RULES, MANIFEST['advisory-rules-next'].file);
const SRC      = fs.readFileSync(FILE, 'utf8');
const adv      = require(FILE);
const fk       = require(path.join(RULES, MANIFEST['ofp-flightkeys-next'].file));   // v1.1.0 (module PR A)
const OPTS     = {
  icaoFpl:         require(path.join(RULES, MANIFEST['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MANIFEST['aircraft-profile'].file)),
  notamRules:      require(path.join(RULES, MANIFEST['notam-rules'].file)),
  parseNatTrack:   require(path.join(RULES, MANIFEST['nat-rules'].file)).parseNatTrack,
};
const HTML     = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const EXPECTED_FILE = path.join('expected', 'advisory-rules-v1.0.0', 'results.json');
const sha      = s => crypto.createHash('sha256').update(s).digest('hex');
const ADVISORY = 'VOLCANIC ASH ADVISORY FOR THIS FLIGHT – SEE OFP REMARKS AND THE VA PAGE ON THE OFP TAB';
const ROUTING  = 'VOLCANIC ASH ROUTING IN OFP REMARKS – CHECK ROUTE';
// A SYNTHETIC package (D87) through ofp-flightkeys v1.1.0, then the rules.
const run = (o, extra) => adv.evaluateAdvisories(fk.parseFlightKeys(S5.input(S5.release(o), extra), OPTS));
const msgs = e => e.findings.map(f => f.message);
const ONE = [{ nr: '2026/001', volcano: 'TESTVOLCANO', vaac: 'ANCHORAGE', volcanoNo: '300000' }];
const vaa = (list = ONE, o) => [S5.vaPage(S5.vaAdvisory(list, o))];

// ══ TC-181-001 … 005 module ══════════════════════════════════════════════════════════════════════

test('TC-181-001 identity: v1.0.0 under advisory-rules-next, declared not built in; other modules unchanged; a changed byte is caught', () => {
  assert.deepEqual([adv.RULESET_TYPE, adv.RULESET_VERSION, adv.SCHEMA_VERSION], ['advisory-rules', '1.0.0', 1]);
  const e = MANIFEST['advisory-rules-next'];
  assert.deepEqual([e.version, e.file], ['1.0.0', 'advisory-rules-next/advisory-rules-v1.0.0.js']);
  assert.equal(sha(fs.readFileSync(FILE)), e.sha256);
  assert.deepEqual(fs.readdirSync(path.join(RULES, 'advisory-rules-next')), ['advisory-rules-v1.0.0.js']);
  assert.ok(NOT_BUILT_IN.includes('advisory-rules-next'));
  assert.deepEqual(Object.keys(MANIFEST).slice(-2), ['ofp-flightkeys-next', 'advisory-rules-next']);
  const pinned = {
    'ofp-flightkeys':   ['1.0.1',  'a307b18558a43da53c2e8bf2648a2c921facc699610951fde77bd24cc607750d'],
    'ofp-navblue':      ['2.0.1',  'f7dd7b28f2c61555a1cdfd9a21d601bd6c10ddc0af3d3df890d53541079c6025'],
    'nat-rules':        ['1.2.0',  'a0ed2a31a344680424e96fd31d3046ac8cd65244e58cebd553fe5021fa2ca80d'],
    'notam-rules':      ['1.14.0', '139ce1691574a440a2c371296aea82985bfe26904d77114fa81969c8e86621cb'],
    'icao-fpl':         ['1.0.0',  'd7b432506f32a3675ce3ffa68a07b7e194ed523c9e8dcbd3177f78da36d49ad2'],
    'aircraft-profile': ['1.0.0',  '7ca993193303228d595454ac5bf24ee82eddb9ae1fecc56ad7176dad238a4be5'],
  };
  for (const [k, v] of Object.entries(pinned)) assert.deepEqual([MANIFEST[k].version, MANIFEST[k].sha256], v, k);
  assert.equal(MANIFEST['ofp-flightkeys-next'].version, '1.1.0');
  assert.equal(checkRules(ROOT).ok, true);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tc181-'));
  try {
    fs.cpSync(RULES, path.join(tmp, 'rules'), { recursive: true });
    fs.appendFileSync(path.join(tmp, 'rules', e.file), ' ');
    const c = checkRules(tmp);
    assert.equal(c.ok, false);
    assert.ok(c.errors.some(x => /advisory-rules-next.*does not match the manifest/.test(x)), c.errors.join('; '));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('TC-181-002 not built in (D90): not in index.html; build = index.html; labels 1.10.0; no window, DOM, storage, clock or network', () => {
  assert.ok(!HTML.includes(SRC.slice(0, 400)) && !HTML.includes('AdvisoryRules') && !HTML.includes('evaluateAdvisories'), 'not in index.html');
  assert.equal(MODULES.filter(m => m && /advisory-rules/.test(m.rule)).length, 0, 'build/build.js does not build it');
  assert.equal(sha(assemble(ROOT)), sha(fs.readFileSync(path.join(ROOT, 'index.html'))));
  assert.match(HTML, /const APP_VERSION = '1\.10\.0';/);
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const re of [/\bwindow\b/, /\bdocument\b/, /localStorage|sessionStorage|indexedDB/, /\bDate\b/, /\bfetch\b|XMLHttpRequest|WebSocket/, /\brequire\(/])
    assert.doesNotMatch(code, re, `the module code has no ${re}`);
});

test('TC-181-003 validateSchema(): valid; style, reference, version, export and type errors are refused', () => {
  assert.deepEqual(adv.validateSchema(), { valid: true, errors: [] });
  const bad = o => adv.validateSchema(Object.assign({}, adv, o)).errors;
  assert.ok(bad({ VA_WARN: { A: 'Volcanic ash advisory for this flight – read both.' } }).some(e => /alert style/.test(e)));
  assert.ok(bad({ VA_WARN: { A: 'VOLCANIC ASH ROUTING (O-177) – CHECK ROUTE' } }).some(e => /internal reference/.test(e)));
  assert.ok(bad({ VA_WARN: { A: 'VOLCANIC ASH 1.0.0 – CHECK ROUTE' } }).some(e => /version/.test(e)));
  assert.ok(bad({ VA_WARN: { A: 'VOLCANIC ASH - CHECK ROUTE' } }).some(e => /alert style/.test(e)), 'a hyphen is not the en dash');
  assert.ok(bad({ parseFlightKeys: () => null }).some(e => /must not be exported/.test(e)));
  assert.ok(bad({ evaluateAdvisories: 1 }).some(e => /must be a function/.test(e)));
  assert.ok(bad({ FINDING_CODES: { X: 'ERROR' } }).some(e => /WARN or INFO/.test(e)));
});

test('TC-181-004 O-178 crew texts byte for byte', () => {
  assert.deepEqual(adv.VA_WARN, { ADVISORY, ROUTING });
  assert.equal(Buffer.from(adv.VA_WARN.ADVISORY).toString('hex'), Buffer.from('VOLCANIC ASH ADVISORY FOR THIS FLIGHT – SEE OFP REMARKS AND THE VA PAGE ON THE OFP TAB').toString('hex'));
  assert.equal(adv.VA_WARN.ROUTING, 'VOLCANIC ASH ROUTING IN OFP REMARKS – CHECK ROUTE');
  for (const m of Object.values(adv.VA_WARN)) { assert.equal(m, m.toUpperCase()); assert.ok(!/\.$/.test(m)); assert.ok(m.includes('–') && !m.includes(' - ')); }
  assert.deepEqual(adv.FINDING_CODES, { 'VA-ADVISORY-REMARK': 'WARN', 'VA-REMARK-ROUTING': 'WARN' });
});

test('TC-181-005 the closed lists and their rules', () => {
  assert.deepEqual(adv.VA_TERMS.map(t => t.term), ['VA', 'VOLCANO', 'VOLCANIC', 'ASH', 'ASHTAM', 'ERUPTION', 'VAAC']);
  assert.deepEqual(adv.VA_NEGATIVE_FORMS, ['NO VA ACTIVITY AFFECTING FLIGHT']);
  assert.deepEqual(adv.RAIM_PASSED_FORMS.map(String), ['/^RAIM VALIDATION PASSED$/', '/^RAIM VALIDATION FOR ETOPS ALTN [A-Z]{4} PASSED$/']);
  assert.deepEqual(adv.VA_SKIPPED_CATEGORIES, ['dispatcher', 'boilerplate', 'cdcAttestation', 'raim']);
  // terms: whole words; "VA" in capitals only
  assert.deepEqual(adv.vaTerms('ROUTED SOUTH TO AVOID POTENTIAL VA FROM X'), ['VA']);
  assert.deepEqual(adv.vaTerms('NO ASH CLOUD IS\nPRODUCED'), ['ASH']);
  assert.deepEqual(adv.vaTerms('Volcanic Ash Advisory Center (VAAC)'), ['VOLCANIC', 'ASH', 'VAAC']);
  assert.deepEqual(adv.vaTerms('WAAF ASHTAM 0677'), ['ASHTAM']);
  for (const no of ['AVAIL', 'VAAC2', 'va from x', 'WASH RACK', 'CASH', 'NOVA', 'EVAC']) assert.deepEqual(adv.vaTerms(no), [], `NEGATIVE: ${no}`);
  // polarity
  assert.equal(adv.remarkPolarity('NO VA ACTIVITY AFFECTING FLIGHT'), 'NEGATIVE');
  assert.equal(adv.remarkPolarity('NO VA ACTIVITY AFFECTING FLIGHT.'), 'NEGATIVE');
  assert.equal(adv.remarkPolarity('NO VA ACTIVITY\nAFFECTING FLIGHT'), 'NEGATIVE', 'a line break is a space');
  assert.equal(adv.remarkPolarity('PCF 002000 FOR WX\nNO VA ACTIVITY AFFECTING FLIGHT'), 'NEGATIVE');
  assert.equal(adv.remarkPolarity('NO VA ACTIVITY AFFECTING FLIGHT\nROUTED TO AVOID VA FROM X'), 'POSITIVE');
  assert.equal(adv.remarkPolarity('NO VA ACTIVITY AFFECTING THIS FLIGHT'), 'POSITIVE', 'an unseen wording is positive (closed list)');
  assert.equal(adv.remarkPolarity('NO VA ACTIVITY AFFECTING FLIGHTS'), 'POSITIVE', 'whole words only');
  assert.equal(adv.remarkPolarity('PCF 002000 FOR WX'), null);
  // the volcano name: whole words, any case, line breaks as spaces
  assert.equal(adv.namesVolcano('AVOID VA FROM GREAT\nSITKIN', 'GREAT SITKIN'), true);
  assert.equal(adv.namesVolcano('AVOID VA FROM SITKINA', 'SITKIN'), false);
  assert.equal(adv.namesVolcano('ANYTHING', null), false);
  assert.equal(adv.isRaimPassed('RAIM VALIDATION PASSED'), true);
  assert.equal(adv.isRaimPassed('RAIM VALIDATION FOR ETOPS ALTN PAKN PASSED'), true);
  for (const no of ['RAIM VALIDATION PASSED WITH OUTAGES', 'RAIM VALIDATION: NO OUTAGES', 'RAIM VALIDATION FAILED', 'RAIM VALIDATION FOR ETOPS ALTN PAKN PASSED\nPRN 12']) assert.equal(adv.isRaimPassed(no), false, `NEGATIVE: ${no}`);
});

// ══ TC-181-010 … 015 fixtures ════════════════════════════════════════════════════════════════════

const FIX = findFixtures(process.env.PB_FIXTURES || null);
const fixtureTest = (name, fn) => test(name, async () => { assert.ok(FIX, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)'); return fn(); });
const LBL = Object.fromEntries(Object.entries(require('./data/ofp-flightkeys-v0.3.0-baseline.json').fixtures).map(([id, b]) => [id, b.label]));
let _p = null;
function pk() {
  if (_p) return _p;
  _p = readManifest(FIX).fixtures.filter(f => f.format === 'flightkeys').map(fx => {
    const text = fs.readFileSync(path.join(FIX, fx.files.text), 'utf8'), items = JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
    const r = fk.parseFlightKeys(fk.inputFromExtractor(text, items), OPTS);
    return { fx, lbl: LBL[fx.id], r, e: adv.evaluateAdvisories(r) };
  }).sort((a, b) => a.lbl.localeCompare(b.lbl));
  return _p;
}

fixtureTest('TC-181-010 the 26 against scoping: VA (1 advisory, 25 none; L03 positive, L14 negative); WARN on L03 only; RAIM 27 PASSED → 0 attention', () => {
  assert.equal(pk().length, 26);
  const st = {}, warn = {}, pos = [], neg = [], open = [];
  let raim = 0, attention = 0;
  for (const { lbl, e } of pk()) {
    st[e.volcanicAsh.state] = (st[e.volcanicAsh.state] || []).concat(lbl);
    if (e.findings.length) warn[lbl] = e.findings.map(f => [f.level, f.field, f.code, f.message]);
    for (const r of e.volcanicAsh.remarks) (r.polarity === 'POSITIVE' ? pos : neg).push(lbl);
    raim += e.raim.records.length; attention += e.raim.attention.length;
    assert.equal(e.raim.passed, true, `${lbl}: a PASSED form`);
    if (e.openOfpRemarks) open.push(lbl);
  }
  assert.deepEqual(st.ADVISORY, ['L02']);
  assert.equal(st.NONE.length, 25);
  assert.deepEqual(pos, ['L03']);
  assert.deepEqual(neg, ['L14']);
  assert.deepEqual(warn, { L03: [['WARN', 'volcanicAsh', 'VA-REMARK-ROUTING', ROUTING]] }, 'one WARN on the 26: L03 routing (O-177)');
  const l02 = pk().find(p => p.lbl === 'L02').e.volcanicAsh;
  assert.deepEqual([l02.noted, l02.advisories[0].volcano, l02.advisories[0].remarks, l02.remarks], [false, 'SHEVELUCH', [], []], 'L02: advisory, no linked remark → nothing (O-170)');
  const l03 = pk().find(p => p.lbl === 'L03').e.volcanicAsh;
  assert.equal(l03.state, 'NONE', 'L03: the remark names SHEVELUCH, its page prints no advisory');
  assert.deepEqual([raim, attention], [27, 0]);
  assert.deepEqual(open, ['L03'], 'O-179: the OFP Remarks flag on L03 only');
});

const FIR_EXPECTED = { L02: { PAZA: 2 }, L03: { PAZA: 2 }, L06: { LIRR: 2, LIBB: 2 }, L09: { PAZA: 2 }, L14: { PAZA: 2 }, L15: { WAAF: 3, WIIF: 1 },
  L16: { PAZA: 2 }, L18: { PAZA: 2 }, L19: { PAZA: 2 }, L20: { PAZA: 2 } };

fixtureTest('TC-181-011 the 26: 24 volcanic FIR items in 10 packages; L06 "no ash cloud" flagged; hazards L15 WAAF only, 4 VA SIGMETs', () => {
  const got = {};
  let n = 0;
  for (const { lbl, r, e } of pk()) {
    for (const x of e.volcanicFir.notams) {
      ((got[lbl] = got[lbl] || {})[x.fir] = (got[lbl][x.fir] || 0) + 1); n++;
      assert.equal(r.firNotams[x.block].items[x.item].id, x.id);
      assert.equal(x.origin, 'NOTAM');
    }
    assert.deepEqual(e.volcanicFir.notamFirs, Object.keys(got[lbl] || {}));
    if (lbl !== 'L15') assert.deepEqual(e.volcanicFir.hazards, [], `${lbl}: no volcanic hazard`);
  }
  assert.deepEqual(got, FIR_EXPECTED);
  assert.equal(n, 24);
  const l06 = pk().find(p => p.lbl === 'L06');
  for (const x of l06.e.volcanicFir.notams) assert.match(l06.r.firNotams[x.block].items[x.item].text.replace(/\s+/g, ' '), /NO ASH CLOUD IS PRODUCED/, 'L06: a "no ash cloud" item is flagged (O-180)');
  const l15 = pk().find(p => p.lbl === 'L15').e.volcanicFir;
  assert.deepEqual(l15.notams.filter(x => /^ASHTAM /.test(x.id)).length, 4, 'L15: the 4 ASHTAMs');
  assert.deepEqual(l15.hazards.map(h => [h.fir, h.vaSigmets]), [['WAAF', 4]]);
  assert.deepEqual(l15.hazardFirs, ['WAAF']);
});

fixtureTest('TC-181-015 pinned results on all 26 (expected/advisory-rules-v1.0.0/results.json), made with this module and ofp-flightkeys v1.1.0', () => {
  const pin = JSON.parse(fs.readFileSync(path.join(FIX, EXPECTED_FILE), 'utf8'));
  assert.deepEqual(pin.module, { version: '1.0.0', sha256: MANIFEST['advisory-rules-next'].sha256 });
  assert.deepEqual(pin.parser, { version: '1.1.0', sha256: MANIFEST['ofp-flightkeys-next'].sha256 });
  assert.deepEqual(Object.keys(pin.packages).sort(), pk().map(p => p.fx.id).sort());
  for (const p of pk()) {
    assert.equal(pin.packages[p.fx.id].label, p.lbl);
    assert.deepEqual(JSON.parse(JSON.stringify(p.e)), pin.packages[p.fx.id].result, `${p.lbl}: result`);
  }
});

// ══ TC-181-020 … 051 synthetic (D87: every case here is SYNTHETIC) ══════════════════════════════

test('TC-181-020 SYNTHETIC volcanic ash: the brief\'s cases, end to end through ofp-flightkeys v1.1.0', () => {
  const POS = 'ROUTED NORTH TO AVOID POTENTIAL VA FROM TESTVOLCANO';
  // VAA + positive remark (linked) → the ADVISORY WARN only (D116)
  const a = run({ remarks: [POS] }, vaa());
  assert.deepEqual(msgs(a), [ADVISORY]);
  assert.deepEqual([a.volcanicAsh.state, a.volcanicAsh.noted, a.volcanicAsh.routing, a.openOfpRemarks], ['ADVISORY', true, false, true]);
  assert.equal(a.findings[0].code, 'VA-ADVISORY-REMARK');
  assert.deepEqual(a.volcanicAsh.advisories[0].remarks, [a.volcanicAsh.remarks[0].index]);
  // VAA, no remark → nothing (O-170, Exec-decided hide)
  const b = run({}, vaa());
  assert.deepEqual([msgs(b), b.volcanicAsh.state, b.volcanicAsh.noted, b.openOfpRemarks], [[], 'ADVISORY', false, false]);
  // VAA + remark naming another volcano → ROUTING only (O-169: linked by volcano name)
  const c = run({ remarks: ['ROUTED NORTH TO AVOID POTENTIAL VA FROM OTHERPEAK'] }, vaa());
  assert.deepEqual(msgs(c), [ROUTING]);
  assert.equal(c.volcanicAsh.noted, false);
  // a negative remark joined to a PCF line (one record) is still negative
  const jn = run({ remarks: ['PCF 002000 FOR WX DEVIATIONS', 'NO VA ACTIVITY AFFECTING FLIGHT'] }, vaa());
  assert.deepEqual(jn.volcanicAsh.remarks.map(x => x.polarity), ['NEGATIVE']);
  assert.deepEqual(msgs(jn), []);
  // garbled VA page: UNREADABLE; no remark → nothing; positive remark → ROUTING, even naming the volcano read
  const garbled = [S5.vaPage(S5.vaAdvisory(ONE).filter(l => !/^\s*VAA/.test(l)))];
  assert.deepEqual([run({}, garbled).volcanicAsh.state, msgs(run({}, garbled))], ['UNREADABLE', []]);
  assert.deepEqual(msgs(run({ remarks: [POS] }, garbled)), [ROUTING], 'UNREADABLE + positive remark → O-177');
  // VA remark joined to a neighbouring paragraph (an unmarked line, no blank line: one pcf record, D63a) → still
  // positive and linked; a recognised item ("ROUTED …") would start its own remark instead
  const j = run({ remarks: ['PCF 002000 FOR WX DEVIATIONS', 'AND POTENTIAL VA NEAR TESTVOLCANO'] }, vaa());
  assert.equal(j.volcanicAsh.remarks.length, 1);
  assert.equal(j.volcanicAsh.remarks[0].text, 'PCF 002000 FOR WX DEVIATIONS\nAND POTENTIAL VA NEAR TESTVOLCANO');
  assert.deepEqual(msgs(j), [ADVISORY]);
  // NO VA ACTIVITY + VAA → nothing; NO VA ACTIVITY alone → nothing; printed after a PCF line → nothing
  for (const [rm, extra] of [[['NO VA ACTIVITY AFFECTING FLIGHT'], vaa()], [['NO VA ACTIVITY AFFECTING FLIGHT'], undefined],
    [['PCF 002000 FOR WX', 'NO VA ACTIVITY AFFECTING FLIGHT'], vaa()]]) {
    const e = run({ remarks: rm }, extra);
    assert.deepEqual([msgs(e), e.openOfpRemarks, e.volcanicAsh.remarks.map(r => r.polarity)], [[], false, ['NEGATIVE']], rm.join(' / '));
  }
  // positive remark with the NONE page, with no VA page → ROUTING (O-177)
  assert.deepEqual(msgs(run({ remarks: [POS] }, [S5.vaPage(S5.VA_NONE_LINES)])), [ROUTING]);
  const noPage = run({ remarks: [POS] });
  assert.deepEqual([msgs(noPage), noPage.volcanicAsh.state], [[ROUTING], null]);
  // one linked and one unlinked positive remark → both WARNs, once each, ADVISORY first
  const both = run({ remarks: [POS, S5.BL, 'AVOID VOLCANIC ASH AREA NEAR OTHERPEAK', S5.BL, 'ROUTE ALSO AVOIDS VA FROM TESTVOLCANO'] }, vaa());
  assert.deepEqual(msgs(both), [ADVISORY, ROUTING]);
  // two advisories, one linked → ADVISORY once
  const two = run({ remarks: [POS] }, vaa([...ONE, { nr: '2026/002', volcano: 'OTHER PEAK', vaac: 'TOKYO', volcanoNo: '300001' }]));
  assert.deepEqual([msgs(two), two.volcanicAsh.advisories.map(x => x.remarks.length)], [[ADVISORY], [1, 0]]);
  // a two-word volcano name split over a line break is linked
  const g = run({ remarks: ['ROUTED NORTH TO AVOID VA FROM GREAT', 'SITKIN'] }, vaa([{ nr: '2026/003', volcano: 'GREAT SITKIN', vaac: 'ANCHORAGE', volcanoNo: '311120' }]));
  assert.deepEqual(msgs(g), [ADVISORY]);
  // NEGATIVE: VA terms in the dispatcher line, the boilerplate, a RAIM remark are not VA remarks
  const skip = adv.evaluateAdvisories({ ofpRemarks: [{ text: 'DISPATCHER DESK: 00 ASH', category: 'dispatcher' }, { text: 'VA BOILER', category: 'boilerplate' },
    { text: 'RAIM OUTAGE VA', category: 'raim' }, { text: 'SIGNED ASH', category: 'cdcAttestation' }] });
  assert.deepEqual([skip.volcanicAsh.remarks, skip.findings], [[], []]);
});

test('TC-181-030 SYNTHETIC RAIM end to end (O-171, D115): attention only without a PASSED form; never a WARN', () => {
  const att = o => run(o).raim;
  const OUT = ['RAIM OUTAGE PREDICTED FOR KBBB', 'PRN 12 0300Z-0345Z', 'PRN 21 0310Z-0400Z'];
  // outage with satellite and times; with continuation lines → one record, text as printed
  const o = run({ raim: [...OUT, S5.BL, 'ZZZZ NEXT REMARK'] });
  assert.deepEqual(o.raim.attention.map(r => r.text), [OUT.join('\n')]);
  assert.equal(o.raim.passed, false);
  assert.deepEqual(o.findings, [], 'no OFP Alerts line for RAIM (O-171)');
  assert.equal(o.openOfpRemarks, true, 'O-179');
  assert.ok(o.raim.attention[0].page > 0 && o.raim.attention[0].line > 0);
  // "no outages" wording, FAILED, garbled → attention (not on the closed PASSED list)
  for (const r of [['RAIM VALIDATION: NO OUTAGES PREDICTED'], ['RAIM VALIDATION FAILED'], ['RAIM V#L#D#TION ?? P#SS']]) {
    assert.deepEqual(att({ raim: r }).attention.map(x => x.text), [r[0]], r[0]);
  }
  // PASSED + outage → no output at all (Exec-decided hide); the ETOPS ALTN form too
  for (const p of ['RAIM VALIDATION PASSED', 'RAIM VALIDATION FOR ETOPS ALTN PAKN PASSED']) {
    const e = run({ raim: [p, ...OUT] });
    assert.equal(e.raim.records.length, 2, 'both remarks extracted');
    assert.deepEqual([e.raim.passed, e.raim.attention, e.openOfpRemarks, e.findings], [true, [], false, []], p);
  }
  // PASSED alone → no output
  assert.deepEqual(att({}).attention, []);
  // NEGATIVE: the word RAIM in a non-RAIM remark (a continuation line), RAIM in NOTAM text, no RAIM remark
  const cont = att({ remarks: ['PCF 002000 FOR WX DEVIATIONS', 'NOT RAIM RELATED'], raim: [] });
  assert.deepEqual([cont.records, cont.attention, cont.passed], [[], [], false]);
  const nt = run({ raim: [] }, [S5.notamPage(['                              COMPANY NOTAMS', '                                    GENERAL',
    '               A0001/26        2026-Mar-01 00:00 - UFN', 'CREATED:2026-Feb-28 00:00       FL: SFC - UNL', 'SUBJECT: GPS', 'RAIM OUTAGE PREDICTED KZZZ 0300-0400Z'])]);
  assert.deepEqual([nt.raim.records, nt.raim.attention, nt.openOfpRemarks], [[], [], false]);
  assert.deepEqual(att({ raim: [] }), { passed: false, records: [], attention: [] });
});

test('TC-181-040 SYNTHETIC volcanic FIR items (O-180): flagged by the closed term list, "no ash cloud" too', () => {
  const item = (id, text, origin = 'NOTAM') => ({ id, category: 'HAZARD', origin, text, source: [] });
  const e = adv.evaluateAdvisories({
    firNotams: [
      { name: 'TEST FIR', code: 'KXXX', empty: false, items: [item('ASHTAM 0001', 'KXXX ASHTAM 0001\nC)TESTVOLCANO 000-00'), item('A0002/26', 'NO ASH CLOUD IS PRODUCED.'),
        item('A0003/26', 'RWY 09/27 CLSD.'), item('A0004/26', 'va lower case is not the term'), item('C0005/26', 'SEE TOULOUSE VAAC', 'COMPANY')] },
      { name: 'OTHER FIR', code: 'KYYY', empty: true, items: [] },
      { name: 'THIRD FIR', code: 'KZZZ', empty: false, items: [item('A0006/26', 'VOLCANIC ACTIVITY ADVISORY FOR TESTVOLCANO')] },
    ],
    hazards: [
      { name: 'TEST FIR', code: 'KXXX', empty: false, text: '                                     SIGMET\nKXXX SIGMET 1 VALID 080600/081200 KXXX-\nKXXX TEST FIR VA\nERUPTION MT TESTVOLCANO PSN N5000 E15000 VA CLD OBS\nTWC FPG - CONV\nType: TS' },
      { name: 'OTHER FIR', code: 'KYYY', empty: false, text: 'TWC FPG - TURB\nIntensity: MDT Type: CAT\nKYYY SIGMET 2 VALID 080600/081200 KYYY-\nEMBD TS OBS' },
    ],
  });
  assert.deepEqual(e.volcanicFir.notams.map(x => [x.fir, x.id, x.origin, x.terms]), [
    ['KXXX', 'ASHTAM 0001', 'NOTAM', ['ASHTAM']], ['KXXX', 'A0002/26', 'NOTAM', ['ASH']], ['KXXX', 'C0005/26', 'COMPANY', ['VAAC']],
    ['KZZZ', 'A0006/26', 'NOTAM', ['VOLCANIC']]]);
  assert.deepEqual(e.volcanicFir.notamFirs, ['KXXX', 'KZZZ']);
  assert.deepEqual(e.volcanicFir.hazards.map(h => [h.fir, h.vaSigmets, h.terms]), [['KXXX', 1, ['VA', 'ERUPTION']]]);
  assert.deepEqual(e.volcanicFir.hazardFirs, ['KXXX']);
  assert.deepEqual(e.findings, [], 'FIR items raise no WARN (the display opens their groups)');
  assert.equal(adv.vaSigmetCount('KXXX SIGMET 1 VALID 0606/1212 KXXX-\nEMBD TS\nKXXX SIGMET 2 VALID 0606/1212 KXXX-\nKXXX FIR VA ERUPTION'), 1);
});

const VA_OBJ = { ofpRemarks: [{ text: 'ROUTED NORTH TO AVOID VA FROM TESTVOLCANO', category: 'route', airport: null, subHeading: null, page: 3, line: 9 },
  { text: 'RAIM OUTAGE KBBB\nPRN 12 0300Z-0345Z', category: 'raim', airport: null, subHeading: null, page: 3, line: 10 }],
  volcanicAsh: { page: 9, state: 'ADVISORY', text: '…', advisories: [{ volcano: 'TESTVOLCANO', vaac: 'ANCHORAGE', number: '2026/001' }] } };

fixtureTest('TC-181-050 D88 / D118: the 30 NavBlue results give nothing; a format-neutral object with the same content gives the same result; not an object → null', () => {
  const nb = readManifest(FIX).fixtures.filter(f => f.format !== 'flightkeys');
  assert.equal(nb.length, 30);
  const EMPTY = { volcanicAsh: { state: null, page: null, advisories: [], remarks: [], noted: false, routing: false },
    raim: { passed: false, records: [], attention: [] }, volcanicFir: { notams: [], hazards: [], notamFirs: [], hazardFirs: [] }, openOfpRemarks: false, findings: [] };
  for (const fx of nb) {
    const snap = JSON.parse(fs.readFileSync(path.join(FIX, 'snapshots', `${fx.id}.json`), 'utf8'));
    assert.ok(snap.result && typeof snap.result === 'object', `${fx.id}: a NavBlue result`);
    assert.deepEqual(adv.evaluateAdvisories(snap.result), EMPTY, `${fx.id}: nothing for NavBlue (D118)`);
  }
  // the same content, whatever the format: a FlightKeys result vs only the fields read (SYNTHETIC)
  const full = fk.parseFlightKeys(S5.input(S5.release({ remarks: ['ROUTED NORTH TO AVOID VA FROM TESTVOLCANO'], raim: ['RAIM OUTAGE KBBB', 'PRN 12 0300Z-0345Z'] }), vaa()), OPTS);
  const neutral = { ofpRemarks: full.ofpRemarks, volcanicAsh: full.volcanicAsh, firNotams: full.firNotams, hazards: full.hazards };
  assert.deepEqual(adv.evaluateAdvisories(neutral), adv.evaluateAdvisories(full));
  assert.deepEqual(msgs(adv.evaluateAdvisories(VA_OBJ)), [ADVISORY]);
  for (const x of [null, undefined, 'text', 7]) assert.equal(adv.evaluateAdvisories(x), null);
});

test('TC-181-051 the input is never changed', () => {
  const deepFreeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };
  const o = JSON.parse(JSON.stringify(VA_OBJ));
  const before = JSON.stringify(o);
  const e = adv.evaluateAdvisories(deepFreeze(o));
  assert.equal(JSON.stringify(o), before);
  assert.deepEqual(e.raim.attention.map(r => r.text), ['RAIM OUTAGE KBBB\nPRN 12 0300Z-0345Z']);
});

test('TC-181-090 fixtures missing → the fixture tests FAIL, never skip', () => {
  assert.equal(findFixtures(path.join(ROOT, 'no-such-dir')) === path.join(ROOT, 'no-such-dir'), false);
  assert.ok(FIX, 'the fixtures are available in this run');
});
