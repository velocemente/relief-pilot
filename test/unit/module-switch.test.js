'use strict';
/**
 * TC-174 — step 5e-1, the module switch (Exec answers O-74 … O-88, sheet "Scoping Decisions", tab 5e-1).
 * NOTAM ruleset v1.14.0, NAT ruleset v1.2.0, icao-fpl v1.0.0 and the FlightKeys OFP parser v1.0.0 are built
 * into index.html; the app routes a FlightKeys package to the FlightKeys parser (detector O-78) and shows the
 * parser's findings on the Preflight card (O-76, O-87, O-88). The series is TC-174: TC-173 (NAT v1.2.0) was
 * the last used.
 *
 *   TC-174-001  build order: every rule module once, in order (nat-rules before src/nat.html; icao-fpl,
 *               ofp-flightkeys, ofp-navblue before src/ofp-parse.html); each built in once, byte for byte
 *   TC-174-002  rules/manifest.json has no *-next key; v1.13.0 and the v1.1.0 NAT parser are out (O-79).
 *               Step 5e-2 display PR 1 (O-116): the declared exception ofp-flightkeys-next is removed; v1.0.1 is
 *               ofp-flightkeys, built in; any *-next key fails (D96)
 *   TC-174-003  NAT v1.2.0 built in (D77): window.parseNatTrack = NatRules.parseNatTrack; the renderer is
 *               v1.1.0 + the four declared D85 edits (step 5e-2 display PR 1) and draws the same card for a
 *               NavBlue object
 *   TC-174-004  NavBlue lock (D47): the built app = the NavBlue module with NAT v1.1.0, except exactly the 26
 *               natTrack fl lines of NAT v1.2.0 (D83 / O-65)
 *   TC-174-005  NOTAM v1.14.0 on the app path, per NOTAM ID against change list v1.2 (O-82): at the OFP ETA
 *               156 shown → hidden (all group B), 10 hidden → shown (groups C / U), 1 card colour change
 *   TC-174-006  ETAR card: P2531/26 (obstacle lights out) hidden by D67a; the ETAR card red → yellow
 *   TC-174-007  NEGATIVE: a plain "RWY 09 GLIDESLOPE U/S" stays shown and the card red
 *   TC-174-010  detector (O-78), positive: the 26 FlightKeys packages, L21 – L23 included
 *   TC-174-011  detector, negative: the 30 NavBlue / eOFP fixtures, pasted NavBlue text, mixed (named
 *               error), empty / garbled (NavBlue, as before), a UUID or a FUFI: line inside a NOTAM
 *   TC-174-012  router: FlightKeys → OfpFlightKeys.parseFlightKeys({ text, pages }, options) once; NavBlue →
 *               the NavBlue call unchanged; the parser's output is the same with NOTAM v1.13.0 and v1.14.0
 *   TC-174-013  positions kept: processPDF keeps the positioned items per page = the extractor's items/;
 *               the tools/extract copy matches the app's code
 *   TC-174-014  options passed: icaoFpl, aircraftProfile, notamRules (O-18), parseNatTrack — the app's own
 *   TC-174-015  pasted FlightKeys text (O-80): read from the text only, its WARN on the findings list
 *   TC-174-020  O-68 GATE end to end: a synthetic FlightKeys package through processPDF (fake pdf.js) →
 *               parseOFP → stored findings → the D79 text exactly on the Preflight-card list
 *   TC-174-021  O-68 gate: a random route → the NAT-RANDOM-ROUTE INFO on the list
 *   TC-174-022  the gate bites: on scratch copies of index.html that break the path, TC-174-020 fails
 *   TC-174-030  findings list (O-76, O-87, O-88): WARNs first, message only, NAT INFOs only, esc();
 *               NavBlue: no list; a saved flight without findings reads safely
 *   TC-174-031  the findings shown on the 26, by package and code (7 WARN, 4 INFO); every INFO code listed
 *   TC-174-032  O-89: the list title "OFP Alerts" is red (the existing .nt-red) until the crew selects it, then
 *               the normal title colour; the selection is stored with the flight; a new import starts red; a
 *               flight saved before O-89 (no state) reads safely (red); no list → no title
 *   TC-174-040  safety fields on FlightKeys (rule 6): crew count (step 5e-2: operatingPilots, D62), CAT II/III, DOT exemption, ETOPS, slot,
 *               block and minimum fuel = the parser's values on all 26; a package without the field →
 *               empty, never carried over from the flight before
 *   TC-174-050  the app-path golden covers the 26 FlightKeys packages (snapshots-app, 56 fixtures)
 *   TC-174-051  type-heading trap closed on the app path: parser v1.0.0 + NOTAM v1.14.0 — a trailing type
 *               heading hides nothing (5c QA F2, O-12)
 *   TC-174-060  beta hold (O-75): APP_VERSION, CACHE_NAME and manifest.json stay 1.9.9-hf6
 *   TC-174-090  fixtures missing → the fixture tests FAIL, never skip
 *
 * Synthetic packages are labelled "synthetic" (invented identifiers). Fixture tests assert counts, codes, IDs and
 * airports only; no crew name, employee number or fixture text is printed or asserted. All times are UTC.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const vm     = require('vm');
const { loadApp } = require('../harness');
const { findFixtures, readManifest, importFixture, importItems, peek, isFkHeadingPiece } = require('../lib/app-path');
const { notamSnapshot, appSnapshot } = require('../lib/v0-snapshots');
const { normalize } = require('../golden/serialize');
const { assemble, MODULES } = require('../../build/build');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const HTML     = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ruleSrc  = k => fs.readFileSync(path.join(RULES, MANIFEST[k].file), 'utf8');
const ORACLE   = path.join(ROOT, 'test', 'oracle');
const NOTAM13  = fs.readFileSync(path.join(ORACLE, 'notam-rules-v1.13.0.js'), 'utf8');
const NAT11    = fs.readFileSync(path.join(ORACLE, 'nat-v1.1.0.html'), 'utf8');
const sha      = s => crypto.createHash('sha256').update(s).digest('hex');
const plain    = x => JSON.parse(JSON.stringify(x));   // a value made in the app's vm realm, as a plain value here
const CHANGES  = require('../rules/data/notam-v1.14.0-obstacle-changes.json');
const NB_MOD   = require(path.join(RULES, MANIFEST['ofp-navblue'].file));
const D79      = (l, tmi, dir) => `FILED NAT ${l} NOT IN TRACK MESSAGE TMI ${tmi} (${dir}) – CHECK OCEANIC CLEARANCE`;
const TEXT_ONLY_WARN = 'positioned items (input.pages) not supplied; read from text only';

// ── fixtures: missing = FAIL (TC-174-090) ───────────────────────────────────
const FIX = findFixtures(process.env.PB_FIXTURES || null);
const needFix = () => assert.ok(FIX, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)');
const fixtureTest = (name, fn) => test(name, async () => { needFix(); return fn(); });
let _man = null;
const manifest = () => (_man = _man || readManifest(FIX));
const fkFixtures = () => manifest().fixtures.filter(f => f.format === 'flightkeys');
const nbFixtures = () => manifest().fixtures.filter(f => f.format !== 'flightkeys');
const readText = fx => fs.readFileSync(path.join(FIX, fx.files.text), 'utf8');
const readItems = fx => JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
// Package labels of the field map (T1–T3 the prototypes, L01–L23 the live packages in manifest order).
const PROTO = { 'FK_UAAA-EHAM_27OCT26_prototype': 'T1', 'FK_ZUCK-UAAA_27OCT26_prototype': 'T2', 'FK_KLAX-RKSI_31OCT26_rda-etp_prototype': 'T3' };
function labels() {
  let n = 0;
  return new Map(fkFixtures().map(fx => [fx.id, PROTO[fx.id] || 'L' + String(++n).padStart(2, '0')]));
}

// One app-path import per fixture (the built index.html), shared by the tests of this file.
const _imp = new Map();
async function imported(fx) {
  if (!_imp.has(fx.id)) _imp.set(fx.id, await importFixture(fx, FIX));
  return _imp.get(fx.id);
}
// index.html with NOTAM v1.13.0 in place of v1.14.0 (in memory): the app as it was before the switch, for
// the NOTAM before / after comparison. Nothing else differs on the NavBlue path but NAT, which no NOTAM reads.
const HTML_NOTAM13 = (() => {
  const v14 = ruleSrc('notam-rules');
  assert.equal(HTML.split(v14).length, 2);
  return HTML.replace(v14, () => NOTAM13);
})();

// ══ TC-174-001 / 002 / 003 build, manifest, NAT ══════════════════════════════════

// Step 5e-2 display PR 1 (O-116): the FlightKeys parser v1.0.1 moved from ofp-flightkeys-next to ofp-flightkeys and
// is built in; the declared exception of the module PR is gone. Every manifest module is built in; no *-next key.
const RULE_ORDER = [['aircraft-profile', 'notam.html'], ['notam-rules', 'notam.html'], ['nat-rules', 'nat.html'],
  ['icao-fpl', 'ofp-parse.html'], ['ofp-flightkeys', 'ofp-parse.html'], ['ofp-navblue', 'ofp-parse.html']];
// Problems with a module list: each rule once, in the order above, before the fragment that uses it.
function orderProblems(mods) {
  const p = [];
  const at = k => mods.findIndex(m => m && m.rule === k);
  for (const [k, user] of RULE_ORDER) {
    const n = mods.filter(m => m && m.rule === k).length;
    if (n !== 1) p.push(`${k} listed ${n} times`);
    else if (at(k) > mods.indexOf(user)) p.push(`${k} after src/${user}`);
  }
  const ks = RULE_ORDER.map(([k]) => at(k));
  if (ks.some((x, i) => i && x < ks[i - 1])) p.push(`rule modules out of order: ${RULE_ORDER.map(([k]) => k).join(', ')}`);
  if (mods.indexOf('nat.html') !== at('nat-rules') + 1) p.push('nat-rules is not just above src/nat.html');
  if (mods.indexOf('ofp-parse.html') !== at('ofp-navblue') + 1) p.push('ofp-navblue is not just above src/ofp-parse.html');
  return p;
}

test('TC-174-001 build order: every rule module once, in order, before its user; each built into index.html once, byte for byte', () => {
  assert.deepEqual(orderProblems(MODULES), []);
  assert.deepEqual(MODULES.filter(m => typeof m !== 'string').map(m => m.rule), RULE_ORDER.map(([k]) => k));
  assert.equal(MODULES.length, 26);
  for (const k of Object.keys(MANIFEST)) assert.equal(HTML.split(ruleSrc(k)).length, 2, `${k}: in index.html once, byte for byte`);
  assert.equal(MANIFEST['ofp-flightkeys'].version, '1.0.1', 'O-116: the FlightKeys parser built in is v1.0.1');
  assert.ok(assemble(ROOT).equals(fs.readFileSync(path.join(ROOT, 'index.html'))), 'index.html = node build/build.js output');
  // NEGATIVE: a module twice, a module after its user, two modules swapped
  const dup = [...MODULES]; dup.splice(dup.indexOf('pdf.html'), 0, { rule: 'icao-fpl' });
  assert.ok(orderProblems(dup).some(x => /icao-fpl listed 2 times/.test(x)));
  const late = MODULES.filter(m => !(m && m.rule === 'nat-rules')); late.splice(late.indexOf('state.html'), 0, { rule: 'nat-rules' });
  assert.ok(orderProblems(late).some(x => /nat-rules after src\/nat\.html/.test(x)));
  const swap = [...MODULES]; const a = swap.findIndex(m => m && m.rule === 'icao-fpl'), b = swap.findIndex(m => m && m.rule === 'ofp-flightkeys');
  [swap[a], swap[b]] = [swap[b], swap[a]];
  assert.ok(orderProblems(swap).some(x => /out of order/.test(x)));
});

const manifestProblems = man => Object.entries(man).flatMap(([k, e]) => [
  ...(/-next$/.test(k) ? [`${k}: a *-next key`] : []),
  ...(e.file.split('/')[0] !== k ? [`${k}: file not in rules/${k}/`] : [])]);

test('TC-174-002 rules/manifest.json: no *-next key; v1.13.0 and the NAT v1.1.0 parser are out; frozen copies in test/oracle (O-79)', () => {
  assert.deepEqual(Object.keys(MANIFEST), ['notam-rules', 'ofp-navblue', 'aircraft-profile', 'icao-fpl', 'ofp-flightkeys', 'nat-rules']);
  assert.deepEqual(manifestProblems(MANIFEST), [], 'no *-next key (O-116 removed the declared exception, D96)');
  assert.deepEqual(Object.values(MANIFEST).map(e => e.version), ['1.14.0', '2.0.1', '1.0.0', '1.0.0', '1.0.1', '1.2.0']);
  assert.ok(fs.readdirSync(RULES).every(d => !/-next$/.test(d)), 'no *-next folder');
  assert.ok(!fs.existsSync(path.join(RULES, 'notam-rules', 'notam-rules-v1.13.0.js')), 'v1.13.0 is out of rules/');
  assert.equal(sha(NOTAM13), 'e640b45ce9ecb75675222106b954ef241cf9d7c21fc96e1072b02f0265a6a90b', 'test/oracle: NOTAM v1.13.0 byte for byte');
  assert.equal(sha(NAT11), '4fa953e938dd09805eee31f4cf88b0f718109afb50333cb43be0686be5fb78a0', 'test/oracle: src/nat.html v1.1.0 byte for byte');
  assert.ok(!HTML.includes(NOTAM13) && !HTML.includes("RULESET_VERSION = '1.13.0'"), 'NOTAM v1.13.0 is not in index.html');
  // NEGATIVE: a *-next key, a file outside its folder
  assert.deepEqual(manifestProblems({ ...MANIFEST, 'notam-rules-next': { file: 'notam-rules-next/x.js' } }), ['notam-rules-next: a *-next key']);
  assert.deepEqual(manifestProblems({ ...MANIFEST, 'ofp-flightkeys-next': { file: 'ofp-flightkeys-next/x.js' } }), ['ofp-flightkeys-next: a *-next key'], 'the former exception now fails too');
  assert.deepEqual(manifestProblems({ 'nat-rules': { file: 'nat-rules-next/nat-rules-v1.2.0.js' } }), ['nat-rules: file not in rules/nat-rules/']);
});

test('TC-174-003 NAT v1.2.0 built in (D77): window.parseNatTrack = NatRules.parseNatTrack; renderer = v1.1.0 + the four D85 edits (step 5e-2), same card for a NavBlue object', () => {
  const app = loadApp();
  assert.equal(app.sandbox.NatRules.RULESET_VERSION, '1.2.0');
  assert.equal(app.sandbox.parseNatTrack, app.sandbox.NatRules.parseNatTrack, 'the app binds the module');
  assert.equal(app.sandbox.NAT_RULES_VERSION, '1.2.0');
  const now = fs.readFileSync(path.join(ROOT, 'src', 'nat.html'), 'utf8');
  const r11 = NAT11.slice(NAT11.indexOf('§ 2  RENDERER'), NAT11.indexOf('§ 3  EXPORTS'));
  const r12 = now.slice(now.indexOf('§ 2  RENDERER'), now.indexOf('§ 3  EXPORTS'));
  // Step 5e-2 display PR 1 (D85): renderNatTrack = v1.1.0 with exactly these four declared edits, each read only
  // from fields a FlightKeys card object carries (published, publishedDirs, assignedDir); a NavBlue object has
  // none of them, so its card is unchanged (the equal-card check below, and TC-176-030 on the 8 NavBlue NAT cards).
  const D85 = [
    ["    if (!blocks.some(function (b) { return b.tracks.length > 0; })) return '';",
     "    if (!blocks.some(function (b) { return b.tracks.length > 0; }) && !nt.published) return '';   // D85: a published message keeps the card"],
    ['      var isAssigned = tr.assigned || tr.id === nt.assignedId;',
     '      var isAssigned = tr.assigned || (tr.id === nt.assignedId && (!nt.assignedDir || nt.assignedDir === dir));   // D85'],
    ["      : '<div style=\"padding:var(--sp3);font-size:14px;color:var(--label3)\">No eastbound tracks found.</div>';",
     "      : (nt.publishedDirs && nt.publishedDirs.indexOf('EAST') >= 0) ? ''   // D85: a published direction is never \"no tracks\"\n      : '<div style=\"padding:var(--sp3);font-size:14px;color:var(--label3)\">No eastbound tracks found.</div>';"],
    ["      : '<div style=\"padding:var(--sp3);font-size:14px;color:var(--label3)\">No westbound tracks found.</div>';",
     "      : (nt.publishedDirs && nt.publishedDirs.indexOf('WEST') >= 0) ? ''   // D85\n      : '<div style=\"padding:var(--sp3);font-size:14px;color:var(--label3)\">No westbound tracks found.</div>';"],
  ];
  for (const [a] of D85) assert.equal(r11.split(a).length, 2, `v1.1.0 has the line once: ${a.trim().slice(0, 50)}`);
  assert.ok(r11.length > 4000 && D85.reduce((t, [a, b]) => t.replace(a, () => b), r11) === r12, 'renderNatTrack: v1.1.0 + the four D85 edits, nothing else');
  assert.ok(!/function parseNatTrack\(/.test(now) && !HTML.includes("var VERSION = '1.1.0';"), 'no v1.1.0 parser left in the app');
  // the same card from the same track object (v1.1.0 renderer in its own context, esc() as the app's)
  const win = {};
  vm.runInNewContext(NAT11, { window: win, console: { log() {} }, esc: app.sandbox.esc || (s => String(s)) });
  const nt = { trackType: 'NAT', tmi: '307', flightDir: 'WEST', assignedId: 'B', rawFallback: '', eastComments: '', westComments: 'REMARK <1>',
    blocks: [{ dir: 'WEST', tracks: [{ id: 'A', waypoints: ['AAAAA', '51N020W'], fl: 'FL340 360', mach: '', valid: '11/03-1130–11/03-1900', assigned: false },
      { id: 'B', waypoints: ['BBBBB', '52N030W'], fl: 'FL340–400', mach: '', valid: '', assigned: true }] }] };
  const navLog = [{ wpt: 'AAAAA', elapsedMins: 60 }];
  assert.equal(app.sandbox.renderNatTrack(nt, navLog), win.renderNatTrack(nt, navLog));
  assert.equal(app.sandbox.renderNatTrack(null, navLog), '', 'no track: no card');
});

// ══ TC-174-004 … 007 NavBlue lock, NOTAM v1.14.0 ═════════════════════════════════

const leafDiff = (a, b, p = '') => {
  if (a === b) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...ks].flatMap(k => leafDiff(a[k], b[k], `${p}.${k}`));
  }
  return [p];
};

fixtureTest('TC-174-004 NavBlue lock (D47): the built app = the NavBlue module with NAT v1.1.0, except exactly 26 natTrack fl lines (D83)', () => {
  const app = loadApp();
  const win = {};
  vm.runInNewContext(NAT11, { window: win, console: { log() {} } });
  let diffs = [], fixtures = 0;
  for (const fx of nbFixtures()) {
    const raw = readText(fx);
    assert.equal(app._ofpDetectFormat(raw), 'navblue');
    const now = JSON.parse(JSON.stringify(app._ofpRulesetParse(raw)));
    const before = JSON.parse(JSON.stringify(NB_MOD._ofpRulesetParse(raw, { parseNatTrack: win.parseNatTrack })));
    const after = JSON.parse(JSON.stringify(NB_MOD._ofpRulesetParse(raw, { parseNatTrack: app.sandbox.NatRules.parseNatTrack })));
    assert.deepEqual(now, after, `${fx.id}: the app = the module with NAT v1.2.0`);
    diffs.push(...leafDiff(before, now).map(d => `${fx.id} ${d}`));
    fixtures++;
  }
  assert.equal(fixtures, 30);
  const bad = diffs.filter(d => !/ \.natTrack\.blocks\.\d+\.tracks\.\d+\.fl$/.test(d));
  assert.deepEqual(bad, [], 'nothing but natTrack fl lines differs from v1.1.0');
  assert.equal(diffs.length, 26, 'exactly 26 fl lines (D83)');
});

// Per release airport of every NavBlue / eOFP fixture: the NOTAM IDs evalNotams() reports at the OFP ETA and
// the card colour, with NOTAM v1.14.0 (the app) and v1.13.0 (the app before the switch).
let _notamCmp = null;
async function notamCompare() {
  if (_notamCmp) return _notamCmp;
  const res = { hidden: [], shown: [], colour: [], airports: 0 };
  for (const fx of nbFixtures()) {
    const a14 = await imported(fx), a13 = await importFixture(fx, FIX, { html: HTML_NOTAM13 });
    const n14 = normalize(notamSnapshot(fx, a14)), n13 = normalize(notamSnapshot(fx, a13));
    const s14 = normalize(appSnapshot(fx, a14)).status, s13 = normalize(appSnapshot(fx, a13)).status;
    n14.airports.forEach((ap, i) => {
      const old = new Set(n13.airports[i].ids), now = new Set(ap.ids);
      res.airports++;
      for (const id of old) if (!now.has(id)) res.hidden.push({ fx: fx.id, icao: ap.icao, role: ap.role, id });
      for (const id of now) if (!old.has(id)) res.shown.push({ fx: fx.id, icao: ap.icao, role: ap.role, id });
    });
    s14.forEach((st, i) => { if (st.color !== s13[i].color) res.colour.push({ fx: fx.id, icao: st.icao, role: st.role, from: s13[i].color, to: st.color }); });
  }
  _notamCmp = res;
  return res;
}
const groupsOf = (pkg, id) => CHANGES.entries.filter(e => e.fmt === 'NB' && e.pkg === pkg && e.id === id).map(e => e.group);

fixtureTest('TC-174-005 NOTAM v1.14.0 per NOTAM ID vs change list v1.2 (O-82): 156 shown → hidden (all B), 10 hidden → shown (C / U), 1 card colour', async () => {
  const r = await notamCompare();
  console.log(`TC-174-005: ${r.airports} release airports; shown → hidden ${r.hidden.length}, hidden → shown ${r.shown.length}, card colour changes ${r.colour.length}`);
  assert.equal(r.hidden.length, 156);
  assert.equal(r.shown.length, 10);
  assert.equal(r.colour.length, 1);
  // Every newly hidden ID is a group B row of the change list for its package (D67 / D67a / D67b); none other.
  const unjustified = r.hidden.filter(h => !groupsOf(h.fx, h.id.split(' ').pop()).includes('B'));
  assert.deepEqual(unjustified.map(h => `${h.fx} ${h.icao} ${h.id}`), [], 'STOP (O-82): a newly hidden NOTAM not justified by D67 / D67a / D67b');
  const reasons = {};
  for (const h of r.hidden) {
    const e = CHANGES.entries.find(x => x.fmt === 'NB' && x.pkg === h.fx && x.id === h.id.split(' ').pop() && x.group === 'B');
    reasons[e.pattern || '(none)'] = (reasons[e.pattern || '(none)'] || 0) + 1;
  }
  assert.deepEqual(reasons, { '(none)': 83, HEIGHT_NEAR_RUNWAY: 59, STATED_UNCHANGED: 14 });
  const notCU = r.shown.filter(s => !groupsOf(s.fx, s.id.split(' ').pop()).some(g => g === 'C' || g === 'U'));
  assert.deepEqual(notCU.map(s => `${s.fx} ${s.icao} ${s.id}`), [], 'every newly shown ID is a group C or U row');
  // NEGATIVE: the reconciliation catches an ID that is not in group B
  assert.deepEqual(groupsOf('NB_KPSM-ETAR_19APR26_nat_rev12', 'X0000/26'), []);
});

fixtureTest('TC-174-006 ETAR card: P2531/26 (obstacle lights out, D67a O-23) hidden; the ETAR destination card red → yellow', async () => {
  const r = await notamCompare();
  assert.deepEqual(r.colour, [{ fx: 'NB_KPSM-ETAR_19APR26_nat_rev12', icao: 'ETAR', role: 'DEST', from: 'red', to: 'yellow' }]);
  assert.ok(r.hidden.some(h => h.fx === 'NB_KPSM-ETAR_19APR26_nat_rev12' && h.icao === 'ETAR' && h.id === 'ETAR P2531/26'));
  assert.deepEqual(groupsOf('NB_KPSM-ETAR_19APR26_nat_rev12', 'P2531/26'), ['B']);
});

test('TC-174-007 NEGATIVE: a plain "RWY 09 GLIDESLOPE U/S" stays shown, the card red; with "OBST LGTS ON" (D67a) hidden (synthetic)', () => {
  const app = loadApp();
  app.sandbox.window._flightDateISO = '2026-04-19';
  const card = body => app.evalAirport('ETAR', '1200', `- ETAR P9999/26 01APR0000-30APR2359\n${body}\n`, '', null, 'DEST', 'B763');
  const gs = card('RWY 09 GLIDESLOPE U/S');
  assert.equal(gs.color, 'red');
  assert.equal(gs.issues.length, 1);
  assert.equal(gs.issues[0].level, 'red');
  const lights = card('OBST LGTS ON RWY 09 GLIDESLOPE U/S.');
  assert.equal(lights.issues.length, 0, 'obstacle lights out: hidden (D67a O-23)');
  assert.notEqual(lights.color, 'red');
});

// ══ TC-174-010 … 015 detector, router, positions, options, pasted text ════════════

fixtureTest('TC-174-010 detector (O-78), positive: all 26 FlightKeys packages, L21 – L23 included', () => {
  const app = loadApp(), lbl = labels();
  const got = fkFixtures().map(fx => [lbl.get(fx.id), app._ofpDetectFormat(readText(fx))]);
  assert.equal(got.length, 26);
  assert.deepEqual(got.filter(([, f]) => f !== 'flightkeys'), []);
  // L21 – L23: the three packages the ADR-004 detector rejected (its known gaps until step 5e-1)
  for (const id of ['FK_NZWN-NFFN_10NOV26_pax-remarks_live', 'FK_EPPW-KPSM_10NOV26_nat-random-callsign_live', 'FK_KDOV-ETAR_03NOV26_pax-nat-random_live']) {
    assert.ok(['L21', 'L22', 'L23'].includes(lbl.get(id)), id);
    assert.equal(app._ofpDetectFormat(readText(fkFixtures().find(f => f.id === id))), 'flightkeys');
  }
});

const UUID = 'A1B2C3D4-E5F6-4789-ABCD-EF0123456789';
fixtureTest('TC-174-011 detector, negative: 30 NavBlue / eOFP, pasted NavBlue text, mixed (named error), empty / garbled, a UUID or FUFI: inside a NOTAM', () => {
  const app = loadApp();
  const nb = nbFixtures();
  assert.equal(nb.length, 30);
  for (const fx of nb) assert.equal(app._ofpDetectFormat(readText(fx)), 'navblue', fx.id);
  // pasted NavBlue text: a part of the OFP, with or without the BRIEF PAGE line, page breaks gone
  const raw = readText(nb[0]);
  assert.equal(app._ofpDetectFormat(raw.replace(/\n\n/g, '\n').slice(0, 4000)), 'navblue');
  assert.equal(app._ofpDetectFormat(raw.split('\n').filter(l => !/BRIEF\s+PAGE/.test(l)).join('\n')), 'navblue');
  // empty / garbled → NavBlue, as before the switch (and the NavBlue call gives what it gave)
  for (const t of ['', '   ', '\u0000\u0001garbled %%%', 'FUFI', 'FUFI: not-a-uuid PAGE 1/2', `FUFI${UUID} PAGE 1/3`]) assert.equal(app._ofpDetectFormat(t), 'navblue', JSON.stringify(t));
  assert.equal(app._ofpParse('', null), null);
  // a UUID, or the whole footer text, inside a NOTAM line (not a line of its own)
  const notam = `- EDDF A0001/26 01JAN0000-31DEC2359\nREF ${UUID} SEE FUFI: ${UUID} PAGE 1/2 OF THE DOC\n`;
  assert.equal(app._ofpDetectFormat(raw + notam), 'navblue');
  // mixed: a FlightKeys release footer line and a BRIEF PAGE line → the named error, nothing parsed
  const fk = readText(fkFixtures()[0]);
  const mixed = [fk + 'ATLAS AIR BRIEF PAGE 1 OF 30\n', raw + `FUFI: ${UUID} PAGE 1/9\n`];
  for (const t of mixed) {
    assert.throws(() => app._ofpDetectFormat(t), e => e.name === 'OfpFormatMixedError' && /both FlightKeys \(FUFI:\) and NavBlue \(BRIEF PAGE\)/.test(e.message));
    assert.throws(() => app._ofpParse(t, null), e => e.name === 'OfpFormatMixedError');
  }
  // parseOFP: the named error is shown (toast) and nothing is stored
  const toasts = [];
  app.sandbox.showToast = (type, msg) => toasts.push([type, msg]);
  vm.runInContext(`pdfRawText = ${JSON.stringify(mixed[0])}; pdfPages = null;`, app.sandbox);
  app.parseOFP();
  assert.deepEqual(toasts.map(t => t[0]), ['err']);
  assert.match(toasts[0][1], /OFP format not recognised: both/);
  assert.equal(app.S.fltNum, '', 'nothing parsed');
});

fixtureTest('TC-174-012 router: FlightKeys → parseFlightKeys({ text, pages }, options) once; NavBlue → the NavBlue call unchanged; NOTAM v1.13.0 / v1.14.0 give the same parser output', () => {
  const app = loadApp();
  const calls = { fk: [], nb: [] };
  const fkReal = app.sandbox.OfpFlightKeys.parseFlightKeys, nbReal = app.sandbox.OfpNavBlue._ofpRulesetParse;
  app.sandbox.OfpFlightKeys.parseFlightKeys = (...a) => { calls.fk.push(a); return fkReal(...a); };
  app.sandbox.OfpNavBlue._ofpRulesetParse = (...a) => { calls.nb.push(a); return nbReal(...a); };
  const fx = fkFixtures()[0], items = readItems(fx), text = readText(fx);
  const pages = items.pages;
  const r = app._ofpParse(text, pages);
  assert.equal(calls.fk.length, 1); assert.equal(calls.nb.length, 0);
  assert.equal(calls.fk[0][0].text, text);
  assert.equal(calls.fk[0][0].pages.length, pages.length);
  assert.equal(r.fltNum, fkReal(app.sandbox.OfpFlightKeys.inputFromExtractor(text, items), calls.fk[0][1]).fltNum);
  assert.ok(Array.isArray(r.findings));
  const nbFx = nbFixtures()[0], nbText = readText(nbFx);
  const n = app._ofpParse(nbText, readItems(nbFx).pages);
  assert.equal(calls.fk.length, 1, 'NavBlue: the FlightKeys parser is not called');
  assert.equal(calls.nb.length, 1);
  assert.deepEqual(Object.keys(calls.nb[0][1]), ['parseNatTrack'], 'the NavBlue call: (rawText, { parseNatTrack }), as before');
  assert.equal(calls.nb[0][0], nbText);
  assert.ok(!('findings' in n), 'the NavBlue call returns no findings');
  // The parser's output with NOTAM v1.13.0 and v1.14.0 as its splitter (the parser calls only _splitNotams and
  // _fkHeader): identical on all 26, so building v1.14.0 in changes nothing in the parser's output.
  const fk = require(path.join(RULES, MANIFEST['ofp-flightkeys'].file));
  const base = { icaoFpl: require(path.join(RULES, MANIFEST['icao-fpl'].file)), aircraftProfile: require(path.join(RULES, MANIFEST['aircraft-profile'].file)),
    parseNatTrack: require(path.join(RULES, MANIFEST['nat-rules'].file)).parseNatTrack };
  const nr13 = require(path.join(ORACLE, 'notam-rules-v1.13.0.js')), nr14 = require(path.join(RULES, MANIFEST['notam-rules'].file));
  for (const f of fkFixtures()) {
    const input = () => fk.inputFromExtractor(readText(f), readItems(f));
    assert.equal(JSON.stringify(fk.parseFlightKeys(input(), { ...base, notamRules: nr13 })), JSON.stringify(fk.parseFlightKeys(input(), { ...base, notamRules: nr14 })), f.id);
  }
});

fixtureTest('TC-174-013 positions kept: processPDF keeps the positioned items per page (= items/); tools/extract copy matches', async () => {
  for (const fx of [fkFixtures()[0], nbFixtures()[0]]) {
    const imp = await imported(fx);
    const pages = JSON.parse(JSON.stringify(peek(imp.app, 'pdfPages')));
    assert.deepEqual(pages, readItems(fx).pages, `${fx.id}: pdfPages = the extractor's items, page for page`);
  }
  // the text and the items are built by the same code in the app and in the extractor (the copy)
  const norm = s => s.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')).join('\n');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'pdf.html'), 'utf8');
  const appLoop = app.slice(app.indexOf('const YTOL = 2;'), app.indexOf('    }\n\n    pdfRawText = fullText;'));
  const ex = fs.readFileSync(path.join(ROOT, 'tools', 'extract', 'extract.js'), 'utf8');
  const exLoop = ex.slice(ex.indexOf('const YTOL = 2;'), ex.indexOf('    // ── end copy'));
  assert.ok(appLoop.includes('pages.push({') && appLoop.includes('font: it.fontName'));
  assert.equal(norm(exLoop), norm(appLoop), 'the extractor copy = processPDF (text lines and positioned items)');
  // a new flight / pasted text clears them
  const imp = await imported(fkFixtures()[0]);
  vm.runInContext('resetStateForNewFlight()', imp.app.sandbox);
  assert.equal(peek(imp.app, 'pdfPages'), null);
  _imp.delete(fkFixtures()[0].id);
});

fixtureTest('TC-174-014 options passed: icaoFpl, aircraftProfile, notamRules (O-18), parseNatTrack — the modules built into the app', async () => {
  const app = loadApp();
  let got = null;
  const real = app.sandbox.OfpFlightKeys.parseFlightKeys;
  app.sandbox.OfpFlightKeys.parseFlightKeys = (input, options) => { got = { input, options }; return real(input, options); };
  const fx = fkFixtures().find(f => f.id.includes('KGSP-EPWA'));
  await importItems(readItems(fx), 'x.pdf', { app });
  const o = got.options;
  assert.deepEqual(Object.keys(o), ['icaoFpl', 'aircraftProfile', 'notamRules', 'parseNatTrack']);
  assert.equal(o.icaoFpl, app.sandbox.IcaoFpl);
  assert.equal(o.aircraftProfile, app.sandbox.AircraftProfile);
  assert.equal(o.notamRules, app.sandbox.NotamRules);
  assert.equal(o.notamRules.RULESET_VERSION, '1.14.0');
  assert.equal(o.parseNatTrack, app.sandbox.NatRules.parseNatTrack);
  assert.equal(got.input.text, peek(app, 'pdfRawText'));
  assert.equal(got.input.pages.length, readItems(fx).pages.length);
  // NEGATIVE: with every option supplied, none of the parser's "not supplied" findings
  assert.deepEqual(plain(app.S.ofpFindings.filter(f => /not supplied/.test(f.message))), []);
  assert.ok(app.S.natTrack && app.S.natTrack.blocks.length > 0, 'NAT v1.2.0 reads the FlightKeys track message');
});

// The import screen's text box (#manualText) holds the pasted text; every other element stays a stub.
function pasteInto(app, text) {
  const doc = app.sandbox.document;
  app.sandbox.document = new Proxy(doc, { get: (t, p) => (p === 'getElementById' ? (id => (id === 'manualText' ? { value: text } : t.getElementById(id))) : t[p]) });
}

fixtureTest('TC-174-015 pasted FlightKeys text (O-80): detected by FUFI:, read from the text only; its WARN on the findings list; NEGATIVE PDF import: none', async () => {
  const fx = fkFixtures().find(f => f.id.includes('KCVG-KSEA'));
  const app = loadApp();
  pasteInto(app, readText(fx));
  app.importManual();
  assert.equal(peek(app, 'pdfPages'), null, 'pasted: no positions');
  const warn = app.S.ofpFindings.filter(f => f.message === TEXT_ONLY_WARN);
  assert.deepEqual(plain(warn.map(f => f.level)), ['WARN']);
  assert.ok(app.S.fltNum, 'the release is read from the text');
  const html = app.renderPreflightPhase();
  assert.ok(html.includes(TEXT_ONLY_WARN), 'shown on the Preflight card');
  // NEGATIVE: the PDF import of the same package has positions: no such WARN, not on the list
  const pdf = await imported(fx);
  assert.deepEqual(plain(pdf.S.ofpFindings.filter(f => f.message === TEXT_ONLY_WARN)), []);
  assert.ok(!pdf.app.renderPreflightPhase().includes(TEXT_ONLY_WARN));
  // pasted NavBlue text stays NavBlue: no findings stored
  const app2 = loadApp();
  pasteInto(app2, readText(nbFixtures()[0]));
  app2.importManual();
  assert.ok(app2.S.fltNum && !('ofpFindings' in app2.S));
});

// ══ TC-174-020 … 022 O-68 GATE end to end ════════════════════════════════════════

// Synthetic FlightKeys package (invented identifiers): a release of two pages with the FUFI: footer and the
// ICAO FPL, and a NAT track message (westbound, TMI 307, tracks A and B) on its own NAT-TRACKS pages. Each
// text line is one pdf.js item, so processPDF() rebuilds the text exactly; the package goes through the
// app's real import path. No briefing pages: the parser says so in a WARN (also on the list).
function synthPackage({ route, orig = 'EDDA', dest = 'KBBB' }) {
  const hdr = `TST0001/03NOV/${orig}-${dest}/N000ZZ`;
  const page = (n, of, body) => [hdr, 'OPERATIONAL FLIGHT PLAN RLS 01 03NOV26 12:00', ...body, `FUFI: 00000000-0000-0000-0000-000000000000 PAGE ${n}/${of}`];
  const p1 = [`TST0001/03 ${orig} - ${dest} 03 NOV 26 N000ZZ`, 'COST INDEX 020 Revision: 1.0', 'B747-400F / CF6-80C2-B1F / KG / IFR / FF +4.0',
    'PROGS 031200 Release Valid Until 2300Z 03NOV26', `ORIG ${orig}/AAA ALPHA INTL N50000E008000 1130Z`, `DEST ${dest}/BBB BRAVO INTL N41000W081000 1930Z`];
  const fpl = ['(FPL-TST0001-IS', '-B744/H-SDE1E2E3FGHIJ3J5M1P2RWXYZ/LB1D1', `-${orig}1130`, `-${route}`, `-${dest}0800 KCCC`,
    '-PBN/A1B1 DOF/261103 REG/N000ZZ SEL/ABCD RMK/TCAS II EQUIPPED)'];
  const words = ['ONE', 'TWO'];
  const nat = [1, 2].map(k => ['NAT-TRACKS', `(NAT-${k}/2 TRACKS FLS 340/400 INCLUSIVE`, 'NOV 03/1130Z TO NOV 03/1900Z', `PART ${words[k - 1]} OF TWO PARTS-`,
    `${'AB'[k - 1]} AAAAA 5${k}/20 5${k}/30 5${k}/40 BBBBB`, 'EAST LVLS NIL', 'WEST LVLS 340 350', 'EUR RTS WEST NIL', 'NAR NIL-',
    ...(k === 2 ? ['REMARKS.', '1. TMI IS 307.', '2. SECOND REMARK.-'] : []), `END OF PART ${words[k - 1]} OF TWO PARTS)`]);
  const textPages = [page(1, 2, p1), page(2, 2, ['TIME FUEL', ...fpl]), ...nat];
  const pages = textPages.map((lines, i) => ({ n: i + 1, width: 841.889, height: 595.275,
    items: lines.map((str, k) => ({ str, x: 30, y: 20 + k * 10, w: str.length * 4.8, h: 8, font: 'g_d0_f1' })) }));
  return { meta: { file: 'synthetic.pdf', pageCount: pages.length, outline: [] }, pages };
}
// processPDF → parseOFP → S.ofpFindings → the Preflight card. Returns what the crew sees and what is stored.
async function gate(route, html) {
  const imp = await importItems(synthPackage({ route }), 'synthetic.pdf', html ? { html } : {});
  const card = imp.app.renderPreflightPhase();
  const m = card.match(/<div class="section"><div class="callout"[^>]*>[\s\S]*?<span class="callout-title[^"]*"[^>]*>OFP Alerts<\/span>([\s\S]*?)<\/span><\/div><\/div>/);
  return { imp, stored: imp.S.ofpFindings, list: m ? m[1].split('<br>') : [] };
}
const unEsc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

test('TC-174-020 O-68 GATE end to end (synthetic): filed NATZ not in the message → the D79 text exactly on the Preflight-card list', async () => {
  const { imp, stored, list } = await gate('N0481F320 DCT AAAAA NATZ BBBBB');
  assert.equal(peek(imp.app, '_ofpDetectFormat(pdfRawText)'), 'flightkeys');
  const d79 = stored.filter(f => f.code === 'NAT-FILED-NOT-IN-MESSAGE');
  assert.deepEqual(plain(d79), [{ level: 'WARN', field: 'natTrack', code: 'NAT-FILED-NOT-IN-MESSAGE', message: D79('Z', '307', 'WEST') }], 'stored with the flight');
  assert.ok(list.map(unEsc).includes(D79('Z', '307', 'WEST')), 'the D79 text exactly, as one line of the list');
  assert.equal(imp.S.natTrack.assignedId, 'Z');
  // the stored findings survive a save and reload
  const saved = JSON.parse(JSON.stringify(imp.app.getFlights()[0]));
  assert.ok(saved.state.ofpFindings.some(f => f.code === 'NAT-FILED-NOT-IN-MESSAGE'));
  // NEGATIVE: the letter is printed (NATB) → no D79 on the list, the track marked
  const ok = await gate('N0481F320 DCT AAAAA NATB BBBBB');
  assert.ok(!ok.list.some(l => /NOT IN TRACK MESSAGE/.test(l)));
  assert.deepEqual(plain(ok.imp.S.natTrack.blocks.flatMap(b => b.tracks.filter(t => t.assigned).map(t => t.id))), ['B']);
});

test('TC-174-021 O-68 gate (synthetic): a random route → INFO NAT-RANDOM-ROUTE on the list (O-88: NAT INFOs shown)', async () => {
  const { stored, list } = await gate('N0481F320 DCT AAAAA 52N020W 52N030W BBBBB');
  const info = stored.filter(f => f.code === 'NAT-RANDOM-ROUTE');
  assert.deepEqual(plain(info.map(f => [f.level, f.message])), [['INFO', 'NO FILED NAT TRACK LETTER: NO TRACK MARKED (TMI 307)']]);
  assert.ok(list.map(unEsc).includes('NO FILED NAT TRACK LETTER: NO TRACK MARKED (TMI 307)'));
  assert.ok(!list.some(l => /NOT IN TRACK MESSAGE/.test(l)), 'NEGATIVE: no D79 for a random route');
});

test('TC-174-022 the gate bites: scratch copies of index.html that break the path make TC-174-020 fail', async () => {
  const route = 'N0481F320 DCT AAAAA NATZ BBBBB', want = D79('Z', '307', 'WEST');
  const passes = async html => (await gate(route, html)).list.map(unEsc).includes(want);
  assert.equal(await passes(undefined), true, 'the real index.html passes');
  const breaks = [
    ['router never calls the FlightKeys parser', "if (_ofpDetectFormat(rawText) !== 'flightkeys') return _ofpRulesetParse(rawText);", 'return _ofpRulesetParse(rawText);'],
    ['NAT parser not passed', 'parseNatTrack:   window.parseNatTrack,  // NatRules.parseNatTrack (D77, O-68)', ''],
    ['findings not stored', 'if (Array.isArray(result.findings)) S.ofpFindings = result.findings;', ''],
    ['WARNs not shown', "return list.filter(f => ok(f) && f.level === 'WARN')", "return list.filter(f => ok(f) && f.level === 'NONE')"],
    ['list not drawn', 'h += _findings.map(f => esc(f.message)).join(\'<br>\');', ''],
  ];
  for (const [label, from, to] of breaks) {
    assert.equal(HTML.split(from).length, 2, `${label}: the line to break is in index.html once`);
    assert.equal(await passes(HTML.replace(from, () => to)), false, `${label}: the gate fails`);
  }
});

// ══ TC-174-030 / 031 findings list ═══════════════════════════════════════════════

test('TC-174-030 findings list: WARNs first, message only, NAT INFOs only, escaped; NavBlue no list; a saved flight without findings reads safely', () => {
  const app = loadApp();
  const F = [
    { level: 'INFO', field: 'crewMembers', message: 'INFO OWN' },
    { level: 'INFO', field: 'natTrack', code: 'NAT-RANDOM-ROUTE', message: 'INFO NAT' },
    { level: 'WARN', field: 'permits', message: 'WARN ONE <b>&' },
    { level: 'INFO', field: 'natTrack', message: 'INFO NAT OWN (no code)' },
    { level: 'WARN', field: 'natTrack', code: 'NAT-FILED-NOT-IN-MESSAGE', message: 'WARN TWO' },
    { level: 'INFO', field: 'x', code: 'NOT-A-NAT-CODE', message: 'INFO OTHER CODE' },
  ];
  assert.deepEqual(app._ofpShownFindings(F).map(f => f.message), ['WARN ONE <b>&', 'WARN TWO', 'INFO NAT']);
  app.S.ofpFindings = F;
  const h = app.renderPreflightPhase();
  const list = h.match(/<span class="callout-title[^"]*"[^>]*>OFP Alerts<\/span>([\s\S]*?)<\/span><\/div><\/div>/)[1];
  assert.equal(list, 'WARN ONE &lt;b&gt;&amp;<br>WARN TWO<br>INFO NAT', 'message only, escaped (rule 2), WARN first');
  assert.ok(!/NAT-RANDOM-ROUTE|NAT-FILED|permits|WARN:|INFO:/.test(list), 'no code, field or level shown (O-87)');
  assert.equal(h.indexOf('<div class="section"><div class="callout" onclick="ofpAlertsSelect()" role="button" aria-label="OFP Alerts">'), 0, 'one list, at the top of the Preflight card');
  assert.equal(h.split('class="callout"').length, 2, 'one list');
  // existing components only (rule 3): no style attribute, no class but the existing ones
  const block = h.slice(0, h.indexOf('</div></div>') + 12);
  assert.ok(!/style=/.test(block));
  assert.deepEqual([...new Set([...block.matchAll(/class="([^"]+)"/g)].map(m => m[1]))], ['section', 'callout', 'callout-text', 'callout-title nt-red']);
  for (const c of ['.section {', '.callout {', '.callout-text {', '.callout-title {', '.nt-red {']) assert.ok(HTML.includes(c), `${c} exists`);
  // nothing to show → no list
  app.S.ofpFindings = [{ level: 'INFO', field: 'crewMembers', message: 'X' }];
  assert.ok(!app.renderPreflightPhase().includes('OFP Alerts'));
  for (const v of [undefined, null, [], 'x', [null, {}, { level: 'WARN' }]]) {
    app.S.ofpFindings = v;
    assert.ok(!app.renderPreflightPhase().includes('OFP Alerts'), JSON.stringify(v));
  }
  // a flight saved before the switch (no ofpFindings in its state) loads and renders with no list
  const entry = { id: 'f_1', fltNum: 'GTI0001/01', date: '01 NOV 26', state: { fltNum: 'GTI0001/01', date: '01 NOV 26', origIcao: 'KAAA', destIcao: 'KBBB' }, raw: '', aptData: {} };
  app.S.ofpFindings = F;
  app.loadFlight(entry);
  assert.ok(!('ofpFindings' in app.S), 'the previous flight\'s findings are not carried over');
  assert.ok(!app.renderPreflightPhase().includes('OFP Alerts'));
});

fixtureTest('TC-174-031 findings shown on the 26 by package and code: 7 WARN, 4 INFO (NAT-RANDOM-ROUTE); NavBlue: none', async () => {
  const lbl = labels();
  const shown = [], infoCodes = {};
  for (const fx of fkFixtures()) {
    const imp = await imported(fx);
    for (const f of imp.app._ofpShownFindings(imp.S.ofpFindings)) shown.push(`${lbl.get(fx.id)} ${f.level} ${f.code || f.field}`);
    for (const f of imp.S.ofpFindings.filter(x => x.level === 'INFO')) infoCodes[f.code || f.field] = (infoCodes[f.code || f.field] || 0) + 1;
  }
  assert.deepEqual(shown, [
    'T1 WARN permits', 'T1 WARN permits',
    'L08 WARN natTrack', 'L08 INFO NAT-RANDOM-ROUTE',
    'L12 INFO NAT-RANDOM-ROUTE',
    'L21 WARN altData',
    'L22 WARN natTrack', 'L22 INFO NAT-RANDOM-ROUTE',
    'L23 WARN airportData.curfew', 'L23 INFO NAT-RANDOM-ROUTE']);
  // every INFO code on the 26 (code, or the field for the parser's own findings) and whether it is shown (O-88)
  console.log(`TC-174-031 INFO codes on the 26: ${Object.entries(infoCodes).sort().map(([k, n]) => `${k} ${n} (${k.startsWith('NAT-') ? 'shown' : 'not shown'})`).join('; ')}`);
  assert.deepEqual(Object.keys(infoCodes).filter(k => k.startsWith('NAT-')), ['NAT-RANDOM-ROUTE']);
  for (const fx of nbFixtures().slice(0, 3)) {
    const imp = await imported(fx);
    assert.ok(!('ofpFindings' in imp.S) && !imp.app.renderPreflightPhase().includes('OFP Alerts'), `${fx.id}: NavBlue, no list`);
  }
});

// ══ TC-174-032 O-89 the OFP Alerts title ═════════════════════════════════════════

// The list title as drawn: { red } or null when there is no title.
function alertsTitle(app) {
  const m = app.renderPreflightPhase().match(/<span class="callout-title( nt-red)?">OFP Alerts<\/span>/);
  return m ? { red: !!m[1] } : null;
}

// What a tap does (O-98). The Preflight HTML is read as a tree; a tap on an element runs the onclick of the
// element or of the nearest ancestor that has one (the browser's bubbling). Returns the elements of the page
// as { tag, cls, text, handler } where handler is the onclick found by bubbling, or null.
function tapTargets(html) {
  const VOID = new Set(['br', 'input', 'img', 'hr', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'use', 'meta', 'link']);
  const out = [], stack = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)(\/?)>/g;
  let m, last = 0;
  const add = (text) => { if (text.trim()) out.push({ tag: '#text', cls: '', text: text.trim(), handler: handlerOf(stack) }); };
  const handlerOf = st => { for (let i = st.length - 1; i >= 0; i--) if (st[i].onclick) return st[i].onclick; return null; };
  while ((m = re.exec(html))) {
    add(html.slice(last, m.index)); last = re.lastIndex;
    const [, close, tag, attrs, selfc] = m;
    if (close) { const i = stack.map(e => e.tag).lastIndexOf(tag.toLowerCase()); if (i >= 0) stack.length = i; continue; }
    const g = n => { const a = attrs.match(new RegExp('\\s' + n + '="([^"]*)"')) || attrs.match(new RegExp('^' + n + '="([^"]*)"')); return a ? a[1] : null; };
    const el = { tag: tag.toLowerCase(), cls: g('class') || '', onclick: g('onclick') };
    stack.push(el);
    out.push({ tag: el.tag, cls: el.cls, text: '', handler: handlerOf(stack) });
    if (VOID.has(el.tag) || selfc) stack.pop();
  }
  add(html.slice(last));
  return out;
}

fixtureTest('TC-174-032 O-89 OFP Alerts: red on import; normal after the crew selects it; stored with the flight; a new import red again; pre-O-89 flight safe; no list, no title', async () => {
  const pkgWith = fkFixtures().find(f => f.id === 'FK_EBLG-KORD_03NOV26_nat-random_live');      // L12: one NAT INFO shown
  const pkgOther = fkFixtures().find(f => f.id === 'FK_KDOV-ETAR_03NOV26_pax-nat-random_live'); // L23: WARN + INFO shown
  const pkgNone = fkFixtures().find(f => f.id === 'FK_KCVG-KSEA_04NOV26_pax-catiii_live');      // L05: nothing shown
  const app = loadApp();
  // red on import
  await importItems(readItems(pkgWith), 'a.pdf', { app });
  assert.deepEqual(alertsTitle(app), { red: true }, 'a new import: the title is red');
  assert.ok(!('ofpAlertsSeen' in app.S));
  // normal colour after the crew selects it; stored with the flight
  app.ofpAlertsSelect();
  assert.equal(app.S.ofpAlertsSeen, true);
  assert.deepEqual(alertsTitle(app), { red: false }, 'selected: the normal title colour');
  const saved = plain(app.getFlights().find(f => f.fltNum === app.S.fltNum));
  assert.equal(saved.state.ofpAlertsSeen, true, 'the selection is saved with the flight');
  app.ofpAlertsSelect();
  assert.deepEqual(alertsTitle(app), { red: false }, 'selecting again keeps it normal (one way)');
  // the saved flight reopens in the normal colour (another session)
  const app2 = loadApp();
  app2.loadFlight(saved);
  assert.deepEqual(alertsTitle(app2), { red: false }, 'the saved flight reopens in the normal colour');
  // a new import (another package, same session) starts red again
  await importItems(readItems(pkgOther), 'b.pdf', { app });
  assert.ok(!('ofpAlertsSeen' in app.S), 'the selection is not carried over');
  assert.deepEqual(alertsTitle(app), { red: true }, 'a new import: red again');
  // re-importing the selected flight's package also starts red
  await importItems(readItems(pkgWith), 'a.pdf', { app });
  assert.deepEqual(alertsTitle(app), { red: true });
  // a flight saved before O-89 (findings, no selection state) reads safely: red until selected
  const before = JSON.parse(JSON.stringify(saved)); delete before.state.ofpAlertsSeen;
  const app3 = loadApp();
  app3.loadFlight(before);
  assert.deepEqual(alertsTitle(app3), { red: true });
  // a flight saved before the switch (no findings at all): no list, no title, selecting does nothing harmful
  const old = { id: 'f_1', fltNum: 'GTI0001/01', date: '01 NOV 26', state: { fltNum: 'GTI0001/01', date: '01 NOV 26' }, raw: '', aptData: {} };
  app3.loadFlight(old);
  assert.equal(alertsTitle(app3), null);
  // NEGATIVE: no list → no title (a package with nothing to show; a NavBlue package)
  await importItems(readItems(pkgNone), 'c.pdf', { app });
  assert.equal(alertsTitle(app), null, 'no shown finding: no title');
  const nb = await imported(nbFixtures()[0]);
  assert.equal(alertsTitle(nb.app), null, 'NavBlue: no title');
  // NEGATIVE: only a stored true counts as selected
  for (const v of ['true', 1, {}, false, null]) { app.S.ofpFindings = [{ level: 'WARN', field: 'x', message: 'W' }]; app.S.ofpAlertsSeen = v; assert.deepEqual(alertsTitle(app), { red: true }, JSON.stringify(v)); }
  // the red is the existing class: no new colour in the CSS (src/styles.html unchanged by O-89)
  assert.ok(HTML.includes('.nt-red { color: var(--sys-red);'));
});

fixtureTest('TC-174-032 O-98 the whole OFP Alerts callout is the tap target: a tap anywhere on it sets the normal colour; a tap outside it leaves the title red', async () => {
  const pkgWith = fkFixtures().find(f => f.id === 'FK_KDOV-ETAR_03NOV26_pax-nat-random_live');   // L23: WARN + INFO shown
  const TAP = 'ofpAlertsSelect()';
  const app = loadApp();
  await importItems(readItems(pkgWith), 'a.pdf', { app });
  const shown = app._ofpShownFindings(app.S.ofpFindings);
  assert.ok(shown.length >= 1);
  const tapsFresh = () => tapTargets(app.renderPreflightPhase());
  const els = tapsFresh();
  // the handler sits on the .callout (one element); the title and the rest of the callout inherit it
  const withOwn = els.filter(e => e.handler === TAP);
  assert.ok(withOwn.length > 0);
  const callouts = els.filter(e => e.tag === 'div' && /(^|\s)callout(\s|$)/.test(e.cls));
  assert.equal(callouts.length, 1, 'one callout on the Preflight page');
  assert.equal(app.renderPreflightPhase().split('onclick="ofpAlertsSelect()"').length - 1, 1, 'one handler, on the callout');
  assert.equal(callouts[0].handler, TAP, 'the callout carries the handler');
  // POSITIVE: every part of the callout (the icon, the title, every message line) taps the selection
  const idx = els.indexOf(callouts[0]);
  const end = els.findIndex((e, i) => i > idx && e.handler !== TAP);
  const inside = els.slice(idx, end < 0 ? els.length : end);
  assert.ok(inside.some(e => e.tag === 'svg'), 'the icon is inside the callout');
  assert.ok(inside.some(e => e.tag === '#text' && e.text === 'OFP Alerts'), 'the title is inside the callout');
  for (const f of shown) assert.ok(inside.some(e => e.tag === '#text' && e.text.includes(f.message.slice(0, 20).replace(/&/g, '&amp;'))), 'message text is inside the callout: ' + f.field);
  // each part, tapped alone, sets the normal colour
  for (const part of inside.filter(e => e.tag === 'svg' || e.tag === '#text' || e.tag === 'span' || e.tag === 'div')) {
    delete app.S.ofpAlertsSeen;
    assert.deepEqual(alertsTitle(app), { red: true });
    assert.equal(part.handler, TAP, `tap on ${part.tag} ${part.cls}${part.text ? ' "' + part.text.slice(0, 12) + '"' : ''}`);
    app.ofpAlertsSelect();   // what the handler runs
    assert.deepEqual(alertsTitle(app), { red: false }, 'a tap anywhere on the callout: the normal colour');
  }
  // NEGATIVE: a tap outside the callout (every other element of the page, the section around it included) has no
  // handler: the title stays red
  delete app.S.ofpAlertsSeen;
  const after = tapTargets(app.renderPreflightPhase());
  const outsideNow = after.filter(e => e.handler !== TAP);
  assert.ok(outsideNow.length > 20, 'the rest of the Preflight page is outside the callout');
  assert.ok(outsideNow.every(e => e.handler !== TAP));
  assert.ok(!outsideNow.some(e => e.tag === '#text' && e.text === 'OFP Alerts'), 'the title is not outside');
  assert.ok(after.filter(e => e.tag === 'div' && /(^|\s)section(\s|$)/.test(e.cls))[0].handler !== TAP, 'the section around the callout is not a tap target');
  assert.deepEqual(alertsTitle(app), { red: true }, 'no tap reached the handler: the title is still red');
  // the title has no handler of its own any more (the callout carries it)
  assert.ok(!/<span class="callout-title[^"]*"[^>]*onclick/.test(app.renderPreflightPhase()));
  // no list → no callout, no handler
  app.S.ofpFindings = [];
  assert.ok(!/ofpAlertsSelect/.test(app.renderPreflightPhase()), 'no list: nothing to tap');
});

// ══ TC-174-040 safety fields on FlightKeys (rule 6) ═══════════════════════════════

const SAFETY = {
  crew:   S => (S.crewMembers || []).filter(c => c.active).length,
  catII:  S => S.catIiIiiApproaches,
  dotEx:  S => S.dotExemption,
  etops:  S => [S.etopsEntry, S.etopsExit, S.etopsSpec].join('|'),
  slot:   S => S.slotTime,
  block:  S => S.blockFuel,
  minf:   S => S.minfFuel,
};
const present = (k, v) => k === 'etops' ? v !== '||' : k === 'crew' ? v > 0 : !(v === null || v === undefined || v === '');

fixtureTest('TC-174-040 safety fields on FlightKeys (rule 6): crew count, CAT II/III, DOT exemption, ETOPS, slot, block / min fuel = the parser; absent → empty, never carried over', async () => {
  const app = loadApp(), lbl = labels();
  const fk = app.sandbox.OfpFlightKeys;
  const opts = { icaoFpl: app.sandbox.IcaoFpl, aircraftProfile: app.sandbox.AircraftProfile, notamRules: app.sandbox.NotamRules, parseNatTrack: app.sandbox.NatRules.parseNatTrack };
  const with_ = {}, without = {};
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), S = imp.S;
    const r = fk.parseFlightKeys(fk.inputFromExtractor(readText(fx), readItems(fx)), opts);
    // POSITIVE: the app's state = the parser's values. Crew (step 5e-2 display PR 1, D62 / O-106): the
    // parser's operatingPilots and one anonymous chip per pilot (TC-176-040), no crew record of the parser.
    assert.equal(S.operatingPilots, r.operatingPilots, `${lbl.get(fx.id)} crew count`);
    assert.equal(JSON.stringify(S.crewMembers.map(c => c.role)), JSON.stringify(['CA', 'FO', 'AO', 'AO'].slice(0, r.operatingPilots)), `${lbl.get(fx.id)} crew chips`);
    for (const k of ['catIiIiiApproaches', 'dotExemption', 'etopsEntry', 'etopsExit', 'etopsSpec', 'slotTime'])
      assert.equal(JSON.stringify(S[k]), JSON.stringify(r[k] === undefined ? null : r[k]), `${lbl.get(fx.id)} ${k}`);
    assert.equal(S.blockFuel, imp.app.sandbox.fuelK(r.blockFuelRaw), `${lbl.get(fx.id)} block fuel`);
    assert.equal(S.minfFuel, imp.app.sandbox.fuelK(r.minfFuelRaw), `${lbl.get(fx.id)} min fuel`);
    assert.ok(S.blockFuel && S.minfFuel && SAFETY.crew(S) >= 2, `${lbl.get(fx.id)}: block, min fuel and two pilots read`);
    for (const [k, get] of Object.entries(SAFETY)) (present(k, get(S)) ? with_ : without)[k] = [...((present(k, get(S)) ? with_ : without)[k] || []), fx];
  }
  console.log(`TC-174-040 present on the 26: ${Object.keys(SAFETY).map(k => `${k} ${(with_[k] || []).length}`).join(', ')}`);
  assert.deepEqual(Object.fromEntries(Object.keys(SAFETY).map(k => [k, (with_[k] || []).length])), { crew: 26, catII: 22, dotEx: 6, etops: 7, slot: 1, block: 26, minf: 26 });
  // NEGATIVE: a package without the field after one with it, in the same app session → empty (no carry-over)
  for (const k of ['catII', 'dotEx', 'etops', 'slot']) {
    const a = loadApp();
    await importItems(readItems(with_[k][0]), 'a.pdf', { app: a });
    assert.ok(present(k, SAFETY[k](a.S)), `${k}: set by the first package`);
    await importItems(readItems(without[k][0]), 'b.pdf', { app: a });
    assert.equal(present(k, SAFETY[k](a.S)), false, `${k}: empty after a package without it (${lbl.get(without[k][0].id)})`);
  }
});

// ══ TC-174-050 / 051 golden, type-heading trap ════════════════════════════════════

fixtureTest('TC-174-050 the app-path golden covers all 56 fixtures, the 26 FlightKeys packages included', () => {
  const src = fs.readFileSync(path.join(ROOT, 'test', 'golden', 'app.js'), 'utf8');
  assert.match(src, /select: m => m\.fixtures/);
  for (const fx of manifest().fixtures) assert.ok(fs.existsSync(path.join(FIX, 'snapshots-app', `${fx.id}.json`)), `snapshots-app/${fx.id}.json`);
  for (const fx of fkFixtures()) {
    const s = JSON.parse(fs.readFileSync(path.join(FIX, 'snapshots-app', `${fx.id}.json`), 'utf8'));
    assert.ok(Array.isArray(s.state.ofpFindings) && s.state.ofpFindings.length > 0, `${fx.id}: a FlightKeys snapshot (findings stored)`);
  }
});

fixtureTest('TC-174-051 type-heading trap closed on the app path: parser v1.0.0 + NOTAM v1.14.0 — a trailing type heading hides nothing', async () => {
  let items = 0, evals = 0;
  const heads = loadApp().sandbox.NotamRules.FK_TYPE_HEADINGS;
  assert.equal(heads.length, 17);
  for (const fx of fkFixtures()) {
    const imp = await imported(fx);
    for (const apt of imp.app.getAllAirports()) {
      const text = (imp.airportData[apt.icao] || {}).notams;
      if (!text) continue;
      const eta = imp.app.pZM(apt.eta), iso = imp.app.sandbox.window._flightDateISO, ac = imp.S.acftType;
      let heading = null;
      for (const p of imp.app._splitNotams(text)) {
        if (isFkHeadingPiece(p)) { heading = p; continue; }
        items++;
        const arr = q => (heading ? [heading, q] : [q]);
        const shown = q => imp.app.evalNotamsAs(arr(q), apt.role === 'ORIG' ? 'ORIG' : 'DEST', eta, ac, iso, null).issues.some(i => i.notamRaw === q);
        const base = shown(p);
        for (const h of heads) {
          const q = p.replace(/\n*$/, '') + '\n' + ' '.repeat(36) + h + '\n';
          evals++;
          assert.equal(shown(q), base, `${fx.id} ${apt.icao}: a trailing ${h} heading changes the result`);
        }
      }
    }
  }
  console.log(`TC-174-051: ${items} FlightKeys items on the app path × 17 headings (${evals} evaluations): no result changed`);
  assert.ok(items > 1500, `items checked: ${items}`);
});

// ══ TC-174-060 / 090 ═════════════════════════════════════════════════════════════

test('TC-174-060 beta hold (O-75): APP_VERSION, CACHE_NAME and manifest.json stay 1.9.9-hf6', () => {
  assert.match(HTML, /const APP_VERSION = '1\.9\.9-hf6';/);
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /const CACHE_NAME\s*=\s*'pb-v1\.9\.9-hf6';/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version, '1.9.9-hf6');
  // NEGATIVE: a bumped version would be caught
  assert.doesNotMatch(HTML.replace("'1.9.9-hf6'", "'1.9.9-hf7'"), /const APP_VERSION = '1\.9\.9-hf6';/);
});

test('TC-174-090 fixtures missing → the fixture tests FAIL, never skip', () => {
  assert.equal(findFixtures(path.join(ROOT, 'no-such-dir')) === path.join(ROOT, 'no-such-dir'), false, 'a directory without a manifest is not taken as the fixtures');
  const saved = FIX;
  assert.throws(() => assert.ok(null, 'fixtures not found'), /fixtures not found/, 'the guard fails without fixtures');
  assert.ok(saved, 'the fixtures are available in this run');
});
