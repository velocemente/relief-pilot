'use strict';
/**
 * TC-182 — step 5f display (the integration PR): ofp-flightkeys v1.1.0 built in under ofp-flightkeys and
 * advisory-rules v1.0.0 under advisory-rules (both *-next keys and the v1.0.1 copy out of rules/); parseOFP() calls
 * the advisory rules after the format parser; the outputs are placed per the Exec answers (tab 5f, clarified 22 Nov):
 * O-170, O-171, O-175, O-177 / O-178, O-179, O-180, O-181, O-182, O-183; D92 / D125, D107, D113 / D123 / D124,
 * D76 / D104, D118. Existing slots and CSS only (rule 3). The series is TC-182: TC-181 (advisory-rules) was the last.
 * Each case has a positive and a negative check (rule 6).
 *
 *   TC-182-001  the call: AdvisoryRules is built in once; parseOFP() calls it right after the format parser; the
 *               NavBlue result reads as empty (D118): no finding, no flag; not an object → null
 *   TC-182-010  the 26: per package, where each advisory output is shown (OFP Alerts VA lines, OFP Remarks group
 *               open, RAIM records in the group, open FIR NOTAMs / FIR Hazards groups) against the answers:
 *               L03 the routing WARN and the group open; L02 and L14 nothing; no RAIM (every package PASSED);
 *               the placement table is printed (labels, counts, FIR codes only)
 *   TC-182-011  L03 (O-177 / O-178): the routing WARN on OFP Alerts exactly as the module returns it, red until
 *               tapped, the OFP Remarks group open with the VA remark in it; NEGATIVE: the advisory text nowhere;
 *               the WARN with the module's WARNs removed from the parse (in memory) → no VA line, the open state
 *               as 1.10.0 (O-181)
 *   TC-182-012  L02 (O-170, Exec-decided hide) and L14 (negative remark): no VA line on OFP Alerts, the VA page
 *               shown nowhere on the Preflight card; their volcanic FIR group (PAZA) open (O-180)
 *   TC-182-013  O-180: the volcanic FIR NOTAMs groups open on exactly the 10 packages (12 groups) and the L15 WAAF
 *               hazard group; every other FIR / hazard group collapsed; the crew can collapse one; the flags survive
 *               a reload; NEGATIVE: a save without the flags (1.10.0) → collapsed
 *   TC-182-020  O-175 / O-183: the Dispatch contact row on all 26 shows every printed Contact Dispatch text as
 *               printed (the Company NOTAM line, then the OFP remark), T1–T3 the Company line only; no REQUIRED /
 *               IF QUESTIONS text on any screen; O-181 the open state on the internal flag as 1.10.0; SYNTHETIC
 *               none printed → no row
 *   TC-182-021  D107: the save holds no Dispatch contact or RAIM text (the 26 and synthetic); reopened with its
 *               stored PDF the row and the RAIM records are re-derived; without it, the RAW-missing line in the
 *               row (O-184), nothing breaks; a failed save shows the toast; a flight saved under 1.10.0 opens
 *               with no error
 *   TC-182-022  O-184 (Exec, before QA): never silent. The save holds flags only (dispatchPrinted, raimAttention:
 *               true or absent, no text). Flag set + no stored PDF (PDF missing, pasted text) → the existing
 *               "RAW not available – re-import the package" line in the OFP Remarks group in place of the
 *               Dispatch contact row / the RAIM record; NEGATIVE: flag not set → nothing; with the PDF → the
 *               texts, no such line; a flight saved under 1.10.0 (no flags) opens with no error and no line
 *   TC-182-030  SYNTHETIC RAIM (O-171, D115): an attention record → the remark as printed in the OFP Remarks group,
 *               the group open (O-179), no OFP Alerts line; NEGATIVE: a PASSED form → nothing, the group by
 *               O-181 only; a flagged remark the group shows already is not shown twice
 *   TC-182-031  SYNTHETIC volcanic ash (O-170, O-177, O-178, O-179): advisory + linked remark → the advisory WARN,
 *               group open; advisory, no remark → nothing; positive remark, no advisory → the routing WARN; the
 *               WARNs after the parser's own, WARNs first (D92 / D125); esc() on the remark text
 *   TC-182-032  SYNTHETIC volcanic FIR items (the TC-181-040 object, O-180): FIR NOTAMs, Company NOTAMs (a flagged
 *               Company item, O-131) and FIR Hazards groups open; the others collapsed; saved as flags only
 *   TC-182-040  O-182: perishables only when YES is printed — none of the 7 bare packages shows the banner;
 *               SYNTHETIC "PERISHABLES ONBOARD: YES" shows it (positive), ": NO" does not
 *   TC-182-050  D118: the NavBlue screens (30 packages, 406 screens, raw markup) byte-identical to main
 *               (test/unit/data/display-5f-navblue-screens.json, made from main baf3063); NavBlue has no OFP
 *               Remarks group, no volcanic flag, no new S key
 *   TC-182-060  labels stay 1.10.0 (D91); no *-next key; rules/ holds only the manifest's modules
 *   TC-182-090  fixtures missing → the fixture tests FAIL, never skip
 *
 * Synthetic packages are built by test/lib/fk-synth.js and labelled SYNTHETIC (D87; invented identifiers). Fixture
 * tests assert counts, labels, codes and FIR codes only; no crew name, employee number or fixture text is printed.
 * All times are UTC.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const crypto = require('crypto');
const { loadApp } = require('../harness');
const { findFixtures, readManifest, importFixture, importItems, fakePdfjs } = require('../lib/app-path');
const { MODULES } = require('../../build/build');
const { NOT_BUILT_IN } = require('../lib/not-built-in');
const S5 = require('../lib/fk-synth');

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const HTML     = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ADV      = require(path.join(RULES, MANIFEST['advisory-rules'].file));   // the bytes built in, loaded in Node
const FK       = require(path.join(RULES, MANIFEST['ofp-flightkeys'].file));
const OPTS     = {
  icaoFpl:         require(path.join(RULES, MANIFEST['icao-fpl'].file)),
  aircraftProfile: require(path.join(RULES, MANIFEST['aircraft-profile'].file)),
  notamRules:      require(path.join(RULES, MANIFEST['notam-rules'].file)),
  parseNatTrack:   require(path.join(RULES, MANIFEST['nat-rules'].file)).parseNatTrack,
};
const NB_PIN   = require('./data/display-5f-navblue-screens.json').screens;
const LBL      = Object.fromEntries(Object.entries(require('../rules/data/ofp-flightkeys-v0.3.0-baseline.json').fixtures).map(([id, b]) => [id, b.label]));
const ADVISORY = 'VOLCANIC ASH ADVISORY FOR THIS FLIGHT – SEE OFP REMARKS AND THE VA PAGE ON THE OFP TAB';
const ROUTING  = 'VOLCANIC ASH ROUTING IN OFP REMARKS – CHECK ROUTE';
const PERISHABLES_BARE = ['L03', 'L08', 'L10', 'L12', 'L13', 'L16', 'L17'];   // O-182: PERISHABLES ONBOARD bare
const FIR_OPEN = { L02: ['PAZA'], L03: ['PAZA'], L06: ['LIRR', 'LIBB'], L09: ['PAZA'], L14: ['PAZA'], L15: ['WAAF', 'WIIF'],
  L16: ['PAZA'], L18: ['PAZA'], L19: ['PAZA'], L20: ['PAZA'] };   // TC-181-011: the 24 volcanic items, by FIR
const HAZ_OPEN = { L15: ['WAAF'] };

const sha    = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const plain  = x => JSON.parse(JSON.stringify(x));
const J      = JSON.stringify;
const run    = (app, expr) => vm.runInContext(expr, app.sandbox);
const unesc  = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const escH   = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const raws   = h => [...h.matchAll(/<pre class="notam-raw-text">([\s\S]*?)<\/pre>/g)].map(m => unesc(m[1]));
// [label, hidden, body] per group drawn by renderRawGroup (header, then one body).
function groups(h) {
  const re = /<div class="notam-group"><div class="notam-group-hdr" onclick="toggleNotamGroup\(this\)"><span class="notam-group-label">([^<]*)<\/span>[\s\S]*?<\/div><div class="notam-group-body"( hidden)?>/g;
  const starts = [];
  let m;
  while ((m = re.exec(h))) starts.push({ label: unesc(m[1]), hidden: !!m[2], at: re.lastIndex, from: m.index });
  return starts.map((s, k) => ({ label: s.label, hidden: s.hidden, body: h.slice(s.at, k + 1 < starts.length ? starts[k + 1].from : h.length) }));
}
const alertLines = h => { const m = h.match(/<div class="section"><div class="callout"[^>]*>[\s\S]*?<span class="callout-title[^"]*"[^>]*>OFP Alerts<\/span>([\s\S]*?)<\/span><\/div><\/div>/); return m ? m[1].split('<br>').map(unesc) : []; };
const alertsTitle = h => { const m = h.match(/<span class="callout-title( nt-red)?">OFP Alerts<\/span>/); return m ? (m[1] ? 'red' : 'normal') : null; };
const remarksGroup = app => groups(app.renderPreflightPhase()).find(g => g.label === 'OFP Remarks') || null;
const dispatchRow = h => { const m = h.match(/<div class="data-row"><span class="data-label">Dispatch contact<\/span><span class="data-value">([\s\S]*?)<\/span><\/div>/); return m ? unesc(m[1].replace(/<br>/g, '\n')) : null; };
const openFirs = (app, re) => groups(app.renderEnroutePhase()).filter(g => re.test(g.label) && !g.hidden).map(g => g.label.split(' ')[1]);

const FIX = findFixtures(process.env.PB_FIXTURES || null);
const fixtureTest = (name, fn) => test(name, async () => { assert.ok(FIX, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)'); return fn(); });
let _man = null;
const manifest = () => (_man = _man || readManifest(FIX));
const fkFixtures = () => manifest().fixtures.filter(f => f.format === 'flightkeys').sort((a, b) => LBL[a.id].localeCompare(LBL[b.id]));
const nbFixtures = () => manifest().fixtures.filter(f => f.format !== 'flightkeys');
const fkByLbl = l => fkFixtures().find(f => LBL[f.id] === l);
const readItems = fx => JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
const _imp = new Map();
async function imported(fx) {
  if (!_imp.has(fx.id)) _imp.set(fx.id, await importFixture(fx, FIX));
  return _imp.get(fx.id);
}
// The parser and the rules in Node on the fixture (the expected values, independent of the app's code).
const _ref = new Map();
function ref(fx) {
  if (!_ref.has(fx.id)) {
    const r = FK.parseFlightKeys(FK.inputFromExtractor(fs.readFileSync(path.join(FIX, fx.files.text), 'utf8'), readItems(fx)), OPTS);
    _ref.set(fx.id, { r, e: ADV.evaluateAdvisories(r) });
  }
  return _ref.get(fx.id);
}

// A SYNTHETIC package (fk-synth) through the app's real import path: items → processPDF() → parseOFP().
const synthDoc = (o, extra) => ({ pages: S5.input(S5.release(o), extra).pages.map(p => ({ n: p.page, width: p.width, height: p.height,
  items: p.items.map(({ str, x, y, w, h, font }) => ({ str, x, y, w, h, font })) })) });
const synth = (o, extra, opts) => importItems(synthDoc(o, extra), 'SYNTHETIC.pdf', opts);
// Waits for the async re-derive after loadFlight() (IndexedDB stub → fake pdf.js → parse), as TC-177.
async function settle(done) {
  for (let k = 0; k < 400; k++) { if (done()) return; await new Promise(r => setImmediate(r)); }
  throw new Error('re-derive did not finish');
}
// A second app session that opens the flight saved by `app`, with its stored PDF (items) or none.
async function reopened(app, items, { pdf = true, saves } = {}) {
  const b = loadApp({ storageData: { rp_flights: saves || app.sandbox.localStorage.getItem('rp_flights') } });
  b.sandbox.pdfjsLib = fakePdfjs(items);
  b.sandbox.loadPdfJs = async () => {};
  run(b, `_pdfDb.get = () => Promise.resolve(${pdf ? 'new ArrayBuffer(8)' : 'null'})`);
  assert.doesNotThrow(() => b.loadFlight(b.getFlights()[0]));
  await settle(() => run(b, '_rawViews !== null || !S.rawIndex') && (!pdf || run(b, 'pdfRawText.length > 0'))
    && (pdf || run(b, '_ofpTexts !== null || !_ofpTextsFlagged()')));   // O-184: the PDF-missing path has run
  return b;
}
const savedJson = app => app.sandbox.localStorage.getItem('rp_flights') || '';
const RAW_MISSING = 'RAW not available \u2013 re-import the package';   // the existing D107 / O-107 text (src/edit.html)

const VAA = [{ nr: '2026/001', volcano: 'TESTVOLCANO', vaac: 'ANCHORAGE', volcanoNo: '300000' }];
const vaa = () => [S5.vaPage(S5.vaAdvisory(VAA))];
const POS = 'ROUTED NORTH TO AVOID POTENTIAL VA FROM TESTVOLCANO';
const OUTAGE = ['RAIM OUTAGE PREDICTED FOR KBBB', 'PRN 12 0300Z-0345Z', 'PRN 21 0310Z-0400Z'];

// ══ TC-182-001 the call ══════════════════════════════════════════════════════════════════════════

test('TC-182-001 AdvisoryRules built in once; parseOFP() calls it right after the format parser; NavBlue result empty (D118)', () => {
  const src = fs.readFileSync(path.join(RULES, MANIFEST['advisory-rules'].file), 'utf8');
  assert.equal(HTML.split(src).length, 2, 'advisory-rules once, byte for byte');
  assert.deepEqual(MODULES.filter(m => m && /advisory/.test(m.rule)).map(m => m.rule), ['advisory-rules']);
  const app = loadApp();
  assert.equal(app.sandbox.AdvisoryRules.RULESET_VERSION, '1.0.0', 'the global the module publishes');
  const po = fs.readFileSync(path.join(ROOT, 'src', 'ofp-parse.html'), 'utf8');
  const body = po.slice(po.indexOf('function parseOFP()'));
  const call = body.indexOf('_ofpParse(pdfRawText, pdfPages)'), adv = body.indexOf('const _adv = _ofpAdvisories(result);');
  assert.ok(call > 0 && adv > call && body.indexOf('if (!result) return;') < adv, 'after the format parser, on its result (O-173 A)');
  assert.ok(adv < body.indexOf('Object.assign(S, {'), 'before the state is written');
  assert.equal(body.split('_ofpAdvisories(').length - 1, 1, 'called once per import');
  // D118: the NavBlue result reads as empty; not an object → null (NEGATIVE)
  const nb = { fltNum: 'X', airportData: {}, findings: undefined };
  const e = app._ofpAdvisories(nb);
  assert.deepEqual([plain(e.findings), e.openOfpRemarks, plain(e.volcanicFir.notamFirs), plain(e.raim.attention)], [[], false, [], []]);
  assert.equal(app._ofpAdvisories(null), null);
  assert.equal(app._ofpAdvisories('text'), null);
});

// ══ TC-182-010 … 013 the 26 ══════════════════════════════════════════════════════════════════════

fixtureTest('TC-182-010 the 26: where each advisory output is shown (OFP Alerts, OFP Remarks open, RAIM, FIR / hazard groups)', async () => {
  const table = [], vaLines = {}, open = [];
  let raimShown = 0;
  for (const fx of fkFixtures()) {
    const lbl = LBL[fx.id], imp = await imported(fx), { r, e } = ref(fx);
    const h = imp.app.renderPreflightPhase();
    const va = alertLines(h).filter(l => /VOLCANIC/.test(l));
    if (va.length) vaLines[lbl] = va;
    const g = remarksGroup(imp.app);
    assert.ok(g, `${lbl}: the OFP Remarks group (every package prints a Contact Dispatch text)`);
    if (!g.hidden) open.push(lbl);
    // O-171: every package prints a PASSED form → no RAIM record anywhere on the card
    const raim = (r.ofpRemarks || []).filter(x => x.category === 'raim').map(x => x.text);
    assert.equal(raim.length > 0 && e.raim.passed, true, `${lbl}: a PASSED form is printed`);
    for (const t of raim) assert.ok(!raws(h).includes(t) && !h.includes(escH(t)), `${lbl}: NEGATIVE: the PASSED line is not shown (O-171)`);
    raimShown += plain(imp.app._getOfpTexts().raim).length;
    const firs = openFirs(imp.app, /^FIR \S+ NOTAMs$/), haz = openFirs(imp.app, /^FIR \S+ Hazards$/);
    assert.deepEqual(firs, FIR_OPEN[lbl] || [], `${lbl}: the FIR NOTAMs groups open (O-180)`);
    assert.deepEqual(haz, HAZ_OPEN[lbl] || [], `${lbl}: the FIR Hazards groups open (O-180)`);
    table.push(`${lbl} | alerts ${va.length ? 'VA routing' : '-'} | OFP Remarks ${g.hidden ? 'collapsed' : 'open'} | RAIM - | FIR open ${firs.join('/') || '-'} | hazards open ${haz.join('/') || '-'}`);
  }
  console.log('TC-182-010 placement on the 26:\n  ' + table.join('\n  '));
  assert.deepEqual(vaLines, { L03: [ROUTING] }, 'one VA line on the 26: L03, the routing WARN (O-177); L02 none (O-170), L14 none');
  assert.equal(raimShown, 0, 'no RAIM attention record on the 26 (O-171)');
  // O-181 / O-179: open = the 1.10.0 rule (security or the short form) or the advisory flag (L03 only)
  const want = fkFixtures().filter(fx => { const i = _imp.get(fx.id); return (i.S.securityMessages || []).some(Boolean) || i.S.dispatchContact.label === 'REQUIRED' || ref(fx).e.openOfpRemarks; }).map(fx => LBL[fx.id]);
  assert.deepEqual(open, want);
  assert.deepEqual(fkFixtures().filter(fx => _imp.get(fx.id).S.ofpRemarksOpen === true).map(fx => LBL[fx.id]), ['L03'], 'the O-179 flag on L03 only');
});

fixtureTest('TC-182-011 L03: the routing WARN on OFP Alerts as returned, red until tapped; the OFP Remarks group open with the VA remark', async () => {
  const fx = fkByLbl('L03'), imp = await imported(fx), { r, e } = ref(fx);
  assert.deepEqual(plain(e.findings).map(f => f.message), [ROUTING]);
  let h = imp.app.renderPreflightPhase();
  const lines = alertLines(h);
  assert.equal(lines.filter(l => l === e.findings[0].message).length, 1, 'the module text exactly, once (O-178)');
  assert.ok(!lines.includes(ADVISORY) && !h.includes(escH(ADVISORY)), 'NEGATIVE: not the advisory text (no advisory page on L03)');
  assert.deepEqual(plain(imp.S.ofpFindings).slice(-1), plain(e.findings), 'stored with the flight after the parser\'s findings (D92 / D125)');
  assert.equal(alertsTitle(h), 'red', 'red until tapped (D92)');
  // the VA remark (a route record, O-127) is shown in the group, which is open (O-179)
  const g = remarksGroup(imp.app), vaRem = r.ofpRemarks[e.volcanicAsh.remarks[0].index];
  assert.equal(g.hidden, false);
  assert.ok(raws(g.body).includes(vaRem.text), 'the VA remark in the OFP Remarks group, as printed');
  // NEGATIVE: the same import without the advisory outputs (in memory) → no VA line; the group open by O-181 alone
  const b = await importFixture(fx, FIX, { html: HTML.replace('const _adv = _ofpAdvisories(result);', 'const _adv = null;') });
  assert.ok(!alertLines(b.app.renderPreflightPhase()).some(l => /VOLCANIC/.test(l)), 'NEGATIVE control: no VA line without the rules');
  assert.equal(b.S.ofpRemarksOpen, undefined);
  assert.equal(remarksGroup(b.app).hidden, b.S.dispatchContact.label !== 'REQUIRED', 'NEGATIVE control: O-181 alone');
  imp.app.ofpAlertsSelect();
  assert.equal(alertsTitle(imp.app.renderPreflightPhase()), 'normal', 'tapped → the normal title colour');
});

fixtureTest('TC-182-012 L02 (O-170) and L14 (negative remark): nothing from the VA page; their volcanic FIR group open (O-180)', async () => {
  for (const lbl of ['L02', 'L14']) {
    const fx = fkByLbl(lbl), imp = await imported(fx), { r, e } = ref(fx);
    const h = imp.app.renderPreflightPhase();
    assert.deepEqual(plain(e.findings), [], `${lbl}: the rules return no WARN`);
    assert.ok(!alertLines(h).some(l => /VOLCANIC|\bVA\b/.test(l)), `${lbl}: no VA line on OFP Alerts`);
    assert.ok(!(imp.S.ofpFindings || []).some(f => f.field === 'volcanicAsh' && f.level === 'WARN'), `${lbl}: no VA WARN stored`);
    assert.equal(imp.S.ofpRemarksOpen, undefined, `${lbl}: no O-179 flag`);
    const vaText = r.volcanicAsh && r.volcanicAsh.text;
    assert.ok(typeof vaText === 'string' && vaText.length > 0);
    for (const l of vaText.split('\n').map(x => x.trim()).filter(x => x.length > 20)) assert.ok(!h.includes(escH(l)), `${lbl}: the VA page is not shown on the Preflight card`);
    assert.deepEqual(openFirs(imp.app, /^FIR \S+ NOTAMs$/), ['PAZA'], `${lbl}: the PAZA group open (O-180)`);
  }
  assert.equal(ref(fkByLbl('L02')).e.volcanicAsh.state, 'ADVISORY', 'L02 prints an advisory (positive control: hidden by O-170)');
  assert.equal(ref(fkByLbl('L14')).e.volcanicAsh.remarks[0].polarity, 'NEGATIVE');
});

fixtureTest('TC-182-013 O-180: volcanic groups open on the 10 packages (12 FIR groups, L15 WAAF hazards); others collapsed; the crew can collapse; kept on reload; a 1.10.0 save collapsed', async () => {
  let openN = 0, closedN = 0, hazOpen = 0, hazClosed = 0;
  for (const fx of fkFixtures()) {
    const imp = await imported(fx);
    for (const g of groups(imp.app.renderEnroutePhase())) {
      if (/^FIR \S+ NOTAMs$/.test(g.label)) g.hidden ? closedN++ : openN++;
      if (/^FIR \S+ Hazards$/.test(g.label)) g.hidden ? hazClosed++ : hazOpen++;
      if (g.label === 'Company NOTAMs') assert.ok(g.hidden, `${LBL[fx.id]}: no volcanic Company item on the 26 → collapsed`);
    }
  }
  assert.deepEqual([openN, closedN, hazOpen, hazClosed], [12, 221 - 12, 1, 155 - 1]);
  // the crew can collapse an open group (the existing handler and markup)
  const l15 = await imported(fkByLbl('L15'));
  assert.match(l15.app.renderEnroutePhase(), /<span class="notam-group-label">FIR WAAF Hazards<\/span><svg class="notam-chev open"[^>]*>[\s\S]*?<\/svg><\/div><div class="notam-group-body">/);
  // kept on reload: the flags are saved (codes only); with the PDF and without it
  for (const pdf of [true, false]) {
    const b = await reopened(l15.app, readItems(fkByLbl('L15')), { pdf });
    assert.deepEqual([openFirs(b, /^FIR \S+ NOTAMs$/), openFirs(b, /^FIR \S+ Hazards$/)], [['WAAF', 'WIIF'], ['WAAF']], `reopened, PDF ${pdf}`);
  }
  // NEGATIVE: a save without the flags (as 1.10.0 saved it) → every group collapsed, nothing breaks
  const flights = JSON.parse(savedJson(l15.app));
  for (const b of flights[0].state.rawIndex.fir) { delete b.open; delete b.companyOpen; }
  for (const z of flights[0].state.rawIndex.haz) delete z.open;
  const old = await reopened(l15.app, readItems(fkByLbl('L15')), { saves: JSON.stringify(flights) });
  assert.deepEqual([openFirs(old, /^FIR \S+ NOTAMs$/), openFirs(old, /^FIR \S+ Hazards$/)], [[], []]);
});

// ══ TC-182-020 / 021 Dispatch contact, saves ═════════════════════════════════════════════════════

fixtureTest('TC-182-020 O-175 / O-183: the Dispatch contact row as printed on all 26 (T1–T3 the Company line); no REQUIRED / IF QUESTIONS on screen; O-181', async () => {
  const forms = { both: 0, company: 0 };
  for (const fx of fkFixtures()) {
    const lbl = LBL[fx.id], imp = await imported(fx), d = ref(fx).r.dispatchContact;
    const h = imp.app.renderPreflightPhase();
    assert.equal(dispatchRow(h), d.text, `${lbl}: every Contact Dispatch text, as printed`);
    assert.equal(d.text, [d.company, d.remark].filter(Boolean).join('\n'), `${lbl}: the Company line first, then the remark`);
    if (/^T/.test(lbl)) assert.deepEqual([d.text, d.remark], [d.company, null], `${lbl}: the Company NOTAM line only`);
    forms[d.remark ? 'both' : 'company']++;
    // no internal label on any screen (O-175, QA F-05)
    for (const screen of [h, imp.app.renderEnroutePhase(), run(imp.app, 'renderDescentPhase()')]) {
      assert.ok(!/>\s*(REQUIRED|IF QUESTIONS)\s*</.test(screen), `${lbl}: NEGATIVE: no REQUIRED / IF QUESTIONS element`);
      assert.ok(!screen.includes('IF QUESTIONS'), `${lbl}: NEGATIVE: no IF QUESTIONS text`);
    }
    // O-181: the open state from the internal flag (and security), as 1.10.0, where no advisory flag is set
    if (!imp.S.ofpRemarksOpen) assert.equal(remarksGroup(imp.app).hidden, !(imp.S.dispatchContact.label === 'REQUIRED' || (imp.S.securityMessages || []).some(Boolean)), lbl);
  }
  assert.deepEqual(forms, { both: 23, company: 3 });
  // SYNTHETIC: nothing printed → no row (O-183); the remark only → that remark
  const none = await synth({ boiler: [] });
  assert.equal(none.S.dispatchContact, null);
  assert.equal(dispatchRow(none.app.renderPreflightPhase()), null, 'no Contact Dispatch printed → no row');
  const rem = await synth({});
  assert.equal(dispatchRow(rem.app.renderPreflightPhase()), S5.BOILER.join('\n'), 'the boilerplate remark, every line, as printed');
});

fixtureTest('TC-182-021 D107: no Dispatch contact or RAIM text in the save; re-derived from the stored PDF; the RAW-missing line without it (O-184); failed save → toast; a 1.10.0 save opens', async () => {
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), d = ref(fx).r.dispatchContact;
    const st = JSON.stringify(JSON.parse(savedJson(imp.app))[0].state);
    if (d.remark) assert.ok(!st.includes(J(d.remark).slice(1, -1)) && !savedJson(imp.app).includes(d.remark.split('\n')[0]), `${LBL[fx.id]}: the remark text is not saved`);
    assert.ok(!st.includes(J(d.text).slice(1, -1)), `${LBL[fx.id]}: the row text is not in the saved state`);
    assert.ok(!('dispatch' in JSON.parse(st)) && !/"_ofpTexts"/.test(st));
  }
  // reopened with its stored PDF: re-derived; without it: the RAW-missing line in the row (O-184), the rest as saved
  const fx = fkByLbl('L03'), imp = await imported(fx);
  const a = await reopened(imp.app, readItems(fx));
  assert.equal(dispatchRow(a.renderPreflightPhase()), ref(fx).r.dispatchContact.text, 'with the PDF: the row re-derived');
  assert.equal(remarksGroup(a).hidden, false);
  assert.deepEqual(alertLines(a.renderPreflightPhase()).filter(l => /VOLCANIC/.test(l)), [ROUTING], 'the WARN is saved with the flight');
  const n = await reopened(imp.app, readItems(fx), { pdf: false });
  assert.equal(dispatchRow(n.renderPreflightPhase()), RAW_MISSING, 'without the PDF: the RAW-missing line in its place (O-184)');
  assert.equal(remarksGroup(n).hidden, false, 'the open flag is saved');
  // a failed save shows the existing toast (O-107)
  const t = loadApp();
  run(t, `S.fltNum = 'TST0001/08'; localStorage.setItem = () => { throw new Error('QuotaExceededError'); }; window.__toasts = []; showToast = (k, m) => window.__toasts.push([k, m]);`);
  t.saveFlight();
  assert.deepEqual(plain(run(t, 'window.__toasts')), [['err', 'Flight not saved – storage full']]);
  // a flight saved under 1.10.0: its state as 1.10.0 wrote it (no flag, the label only, no open FIR flags)
  const old = JSON.parse(savedJson(imp.app));
  delete old[0].state.ofpRemarksOpen; delete old[0].state.dispatchPrinted; delete old[0].state.raimAttention;
  old[0].state.ofpFindings = old[0].state.ofpFindings.filter(f => f.field !== 'volcanicAsh' || f.level !== 'WARN');
  old[0].state.rawIndex.fir.forEach(b => { delete b.open; delete b.companyOpen; });
  for (const pdf of [true, false]) {
    const o = await reopened(imp.app, readItems(fx), { pdf, saves: JSON.stringify(old) });
    assert.doesNotThrow(() => { o.renderPreflightPhase(); o.renderEnroutePhase(); run(o, 'renderDescentPhase()'); });
    assert.ok(!alertLines(o.renderPreflightPhase()).some(l => /VOLCANIC/.test(l)), '1.10.0 save: its own alerts');
    assert.equal(dispatchRow(o.renderPreflightPhase()), pdf ? ref(fx).r.dispatchContact.text : null, `1.10.0 save, PDF ${pdf}: the row re-derived, or nothing (no flag)`);
  }
});

// The import screen's text box (#manualText) holds the pasted text (as TC-178 / TC-179).
function pasted(text) {
  const app = loadApp(), doc = app.sandbox.document;
  app.sandbox.document = new Proxy(doc, { get: (t, p) => (p === 'getElementById' ? (id => (id === 'manualText' ? { value: text } : t.getElementById(id))) : t[p]) });
  app.importManual();
  return app;
}

fixtureTest('TC-182-022 O-184: flags only in the save; flag set + no stored PDF (or pasted text) → the RAW-missing line in place of the row; flag not set → nothing', async () => {
  const MISS_PRE = `<pre class="notam-raw-text">${escH(RAW_MISSING)}</pre>`;
  // the 26: dispatchPrinted on all (every package prints a Contact Dispatch text), raimAttention on none (PASSED)
  for (const fx of fkFixtures()) {
    const st = JSON.parse(savedJson((await imported(fx)).app))[0].state;
    assert.deepEqual([st.dispatchPrinted, st.raimAttention], [true, undefined], LBL[fx.id]);
  }
  // fixture, flag set, stored PDF missing → the line in the Dispatch contact row (existing row, existing text)
  const fx = fkByLbl('L05'), imp = await imported(fx);
  const miss = await reopened(imp.app, readItems(fx), { pdf: false });
  let h = miss.renderPreflightPhase();
  assert.ok(h.includes(`<div class="data-row"><span class="data-label">Dispatch contact</span><span class="data-value">${escH(RAW_MISSING)}</span></div>`), 'the line in the row');
  assert.equal(h.split(escH(RAW_MISSING)).length - 1, 1, 'once (no RAIM flag on the 26)');
  // NEGATIVE: with the PDF → the printed text, no line
  const ok = await reopened(imp.app, readItems(fx));
  assert.equal(dispatchRow(ok.renderPreflightPhase()), ref(fx).r.dispatchContact.text);
  assert.ok(!ok.renderPreflightPhase().includes(escH(RAW_MISSING)));
  // NEGATIVE: flag not set, PDF missing → nothing (no row, no line)
  const noFlag = JSON.parse(savedJson(imp.app)); delete noFlag[0].state.dispatchPrinted;
  const nf = await reopened(imp.app, readItems(fx), { pdf: false, saves: JSON.stringify(noFlag) });
  assert.equal(dispatchRow(nf.renderPreflightPhase()), null);
  assert.ok(!nf.renderPreflightPhase().includes(escH(RAW_MISSING)));
  // SYNTHETIC: a RAIM attention record + a Dispatch remark, PDF missing → the line in both places, the group open
  const a = await synth({ raim: OUTAGE });
  const sa = JSON.parse(savedJson(a.app))[0].state;
  assert.deepEqual([sa.dispatchPrinted, sa.raimAttention, sa.ofpRemarksOpen], [true, true, true]);
  assert.ok(!JSON.stringify(sa).includes('PRN 12') && !JSON.stringify(sa).includes('Contact Dispatch with'), 'D107: flags, no text');
  const am = await reopened(a.app, synthDoc({ raim: OUTAGE }), { pdf: false });
  const g = remarksGroup(am);
  assert.equal(dispatchRow(am.renderPreflightPhase()), RAW_MISSING, 'the Dispatch contact row');
  assert.ok(g.body.includes(MISS_PRE) && !g.body.includes('PRN 12'), 'the RAIM record\'s place');
  assert.equal(g.hidden, false, 'open (O-179, saved flag)');
  // NEGATIVE: the RAIM flag not set → no line for it; with the PDF → the RAIM record, no line
  const nr = JSON.parse(savedJson(a.app)); delete nr[0].state.raimAttention;
  assert.ok(!remarksGroup(await reopened(a.app, synthDoc({ raim: OUTAGE }), { pdf: false, saves: JSON.stringify(nr) })).body.includes(MISS_PRE));
  const ap = await reopened(a.app, synthDoc({ raim: OUTAGE }));
  assert.ok(raws(remarksGroup(ap).body).includes(OUTAGE.join('\n')) && !remarksGroup(ap).body.includes(escH(RAW_MISSING)));
  // pasted text (no PDF is stored): flags saved; reopened → the line in both places
  const p = pasted(S5.input(S5.release({ raim: OUTAGE })).text);
  const sp = JSON.parse(savedJson(p))[0].state;
  assert.deepEqual([sp.dispatchPrinted, sp.raimAttention, 'rawIndex' in sp], [true, true, false], 'pasted: flags, no RAW index');
  assert.ok(raws(remarksGroup(p).body).includes(OUTAGE.join('\n')), 'at import: the record as printed');
  const pr = await reopened(p, synthDoc({}), { pdf: false });
  assert.equal(dispatchRow(pr.renderPreflightPhase()), RAW_MISSING);
  assert.ok(remarksGroup(pr).body.includes(MISS_PRE));
  // NEGATIVE: nothing printed (no Contact Dispatch, PASSED) → no flag, no line, no group text
  const z = await synth({ boiler: [] });
  const sz = JSON.parse(savedJson(z.app))[0].state;
  assert.deepEqual([sz.dispatchPrinted, sz.raimAttention], [undefined, undefined]);
  const zr = await reopened(z.app, synthDoc({ boiler: [] }), { pdf: false });
  assert.ok(!zr.renderPreflightPhase().includes(escH(RAW_MISSING)), 'no RAW-missing line on the Preflight card');
  assert.equal(dispatchRow(zr.renderPreflightPhase()), null);
  // a flight saved under 1.10.0 (no flags), PDF missing: opens, no line in the OFP Remarks group
  const old = JSON.parse(savedJson(imp.app)); delete old[0].state.dispatchPrinted; delete old[0].state.ofpRemarksOpen;
  const o = await reopened(imp.app, readItems(fx), { pdf: false, saves: JSON.stringify(old) });
  assert.doesNotThrow(() => { o.renderPreflightPhase(); o.renderEnroutePhase(); run(o, 'renderDescentPhase()'); });
  const og = remarksGroup(o);
  assert.ok(!og || !og.body.includes(escH(RAW_MISSING)), '1.10.0 save: no RAW-missing line in OFP Remarks');
  // NavBlue: no flag
  const nb = await importFixture(nbFixtures()[0], FIX);
  assert.ok(!('dispatchPrinted' in nb.S) && !('raimAttention' in nb.S));
});

// ══ TC-182-030 / 031 synthetic RAIM and volcanic ash ═════════════════════════════════════════════

test('TC-182-030 SYNTHETIC RAIM (O-171, D115): attention record in the OFP Remarks group, group open, no alert; PASSED → nothing', async () => {
  // an outage, no PASSED form: the remark as printed, in the group, which opens (O-179); no OFP Alerts line
  const a = await synth({ raim: OUTAGE });
  assert.equal(a.S.dispatchContact, null, 'no Company line: no short-form flag, O-181 does not open the group');
  assert.equal(dispatchRow(a.app.renderPreflightPhase()), S5.BOILER.join('\n'), 'the printed Contact Dispatch remark is the row');
  let g = remarksGroup(a.app);
  assert.ok(raws(g.body).includes(OUTAGE.join('\n')), 'the RAIM remark as printed, line breaks kept');
  assert.equal(g.hidden, false, 'the group open (O-179)');
  assert.equal(a.S.ofpRemarksOpen, true);
  assert.ok(!alertLines(a.app.renderPreflightPhase()).some(l => /RAIM/.test(l)), 'no OFP Alerts line for RAIM (O-171)');
  assert.ok(!(a.S.ofpFindings || []).some(f => f.level === 'WARN' && /RAIM/.test(f.message)));
  assert.ok(!savedJson(a.app).includes('PRN 12 0300Z-0345Z'), 'D107: the RAIM text is not saved');
  const re = await reopened(a.app, synthDoc({ raim: OUTAGE }));
  assert.ok(raws(remarksGroup(re).body).includes(OUTAGE.join('\n')), 're-derived from the stored PDF');
  // NEGATIVE: PASSED + outage → no RAIM output; the group by O-181 only (collapsed here)
  const p = await synth({ raim: ['RAIM VALIDATION PASSED', ...OUTAGE] });
  g = remarksGroup(p.app);
  assert.ok(!raws(g.body).some(t => /RAIM/.test(t)), 'PASSED printed → no RAIM record shown');
  assert.equal(g.hidden, true, 'collapsed (no security, no short form, no advisory flag)');
  assert.equal(p.S.ofpRemarksOpen, undefined);
  // NEGATIVE: the PASSED form alone → nothing
  const q = await synth({});
  assert.ok(!raws(remarksGroup(q.app).body).some(t => /RAIM/.test(t)) && remarksGroup(q.app).hidden);
  // a flagged remark the group shows already (an extra-fuel record, a security message naming RAIM; QA F-01: they keep
  // their category) is not shown twice; its RAIM attention still opens the group (O-179)
  for (const [line, cat] of [['EXTRA FUEL 001500 FOR GPS RAIM OUTAGE AT KBBB', 'extraFuel'], ['SECURITY LEVEL 2 RAIM', 'security']]) {
    const f = await synth({ raim: [], remarks: [S5.BL, line, S5.BL] });
    const body = remarksGroup(f.app).body;
    assert.equal(body.split(escH(line)).length - 1, 1, `${cat}: shown once in the group`);
    assert.deepEqual(plain(f.app._getOfpTexts().raim), [], `${cat}: no second copy as a RAIM record`);
    assert.equal(f.S.ofpRemarksOpen, true, `${cat}: the group opens (O-179)`);
    assert.equal(remarksGroup(f.app).hidden, false);
  }
});

test('TC-182-031 SYNTHETIC volcanic ash (O-170, O-177, O-178, O-179): the WARNs on OFP Alerts; advisory, no remark → nothing', async () => {
  // advisory + linked positive remark → the advisory WARN, the group open, the remark in it (escaped)
  const a = await synth({ remarks: [S5.BL, POS + ' <A&B>', S5.BL] }, vaa());
  let h = a.app.renderPreflightPhase();
  assert.deepEqual(alertLines(h).filter(l => /VOLCANIC/.test(l)), [ADVISORY]);
  assert.equal(remarksGroup(a.app).hidden, false);
  assert.ok(h.includes(escH(POS + ' <A&B>')) && !h.includes('<A&B>'), 'esc() on the remark text (rule 2)');
  // WARNs first, the module's after the parser's own WARNs (D92 / D125)
  const shown = a.app._ofpShownFindings(plain(a.S.ofpFindings));
  assert.ok(shown.findIndex(f => f.message === ADVISORY) === shown.filter(f => f.level === 'WARN').length - 1, 'the last WARN, before any INFO');
  // advisory, no remark → nothing (O-170); the group not opened by it
  const b = await synth({}, vaa());
  h = b.app.renderPreflightPhase();
  assert.ok(!alertLines(h).some(l => /VOLCANIC/.test(l)), 'NEGATIVE: no VA line (O-170, Exec-decided hide)');
  assert.equal(b.S.ofpRemarksOpen, undefined);
  assert.equal(remarksGroup(b.app).hidden, true);
  // positive remark, no advisory (no VA page) → the routing WARN
  const c = await synth({ remarks: [S5.BL, POS, S5.BL] });
  assert.deepEqual(alertLines(c.app.renderPreflightPhase()).filter(l => /VOLCANIC/.test(l)), [ROUTING]);
  assert.equal(remarksGroup(c.app).hidden, false);
  // NEGATIVE: the negative form → nothing
  const d = await synth({ remarks: [S5.BL, 'NO VA ACTIVITY AFFECTING FLIGHT', S5.BL] });
  assert.ok(!alertLines(d.app.renderPreflightPhase()).some(l => /VOLCANIC/.test(l)));
  assert.equal(d.S.ofpRemarksOpen, undefined);
});

test('TC-182-032 SYNTHETIC volcanic FIR items (the TC-181-040 object, O-180): their FIR NOTAMs, Company NOTAMs and FIR Hazards groups open; the others collapsed', () => {
  const app = loadApp();
  const item = (id, text, origin = 'NOTAM') => ({ id, category: 'HAZARD', origin, text, source: [] });
  const R = {
    airportData: {},
    firRaw: [{ code: 'KXXX', name: 'TEST FIR', raw: 'SYNTHETIC KXXX BLOCK' }, { code: 'KYYY', name: 'OTHER FIR', raw: 'SYNTHETIC KYYY BLOCK' },
      { code: 'KZZZ', name: 'THIRD FIR', raw: 'SYNTHETIC KZZZ BLOCK' }, { code: 'KWWW', name: 'FOURTH FIR', raw: 'SYNTHETIC KWWW BLOCK' }],
    firNotams: [
      { name: 'TEST FIR', code: 'KXXX', empty: false, items: [item('ASHTAM 0001', 'KXXX ASHTAM 0001\nC)TESTVOLCANO 000-00'), item('A0002/26', 'NO ASH CLOUD IS PRODUCED.'),
        item('A0003/26', 'RWY 09/27 CLSD.'), item('A0004/26', 'va lower case is not the term'), item('C0005/26', 'SEE TOULOUSE VAAC', 'COMPANY')] },
      { name: 'OTHER FIR', code: 'KYYY', empty: false, items: [item('C0007/26', 'RWY 18 CLSD', 'COMPANY')] },
      { name: 'THIRD FIR', code: 'KZZZ', empty: false, items: [item('A0006/26', 'VOLCANIC ACTIVITY ADVISORY FOR TESTVOLCANO')] },
      { name: 'FOURTH FIR', code: 'KWWW', empty: false, items: [item('A0008/26', 'TWY A CLSD'), item('C0009/26', 'ASH CLOUD FORECAST', 'COMPANY')] },
    ],
    hazards: [
      { name: 'TEST FIR', code: 'KXXX', empty: false, text: '                                     SIGMET\nKXXX SIGMET 1 VALID 080600/081200 KXXX-\nKXXX TEST FIR VA\nERUPTION MT TESTVOLCANO PSN N5000 E15000 VA CLD OBS\nTWC FPG - CONV\nType: TS' },
      { name: 'OTHER FIR', code: 'KYYY', empty: true, text: '' },
      { name: 'OTHER FIR', code: 'KYYY', empty: false, text: 'TWC FPG - TURB\nIntensity: MDT Type: CAT\nKYYY SIGMET 2 VALID 080600/081200 KYYY-\nEMBD TS OBS' },
    ],
  };
  run(app, `(function (R) { const adv = _ofpAdvisories(R); _rawViews = _ofpRawViews(R); S.rawIndex = _ofpRawIndex(_rawViews, _ofpVolcanicOpen(adv)); })(${J(R)})`);
  const g = groups(app.renderEnroutePhase()).map(x => [x.label, x.hidden ? 'collapsed' : 'open']);
  assert.deepEqual(g, [
    ['FIR KXXX NOTAMs', 'open'], ['Company NOTAMs', 'open'],          // ASHTAM, "no ash cloud"; the VAAC Company item
    ['FIR KYYY NOTAMs', 'collapsed'], ['Company NOTAMs', 'collapsed'], // NEGATIVE: no term
    ['FIR KZZZ NOTAMs', 'open'],                                       // VOLCANIC
    ['FIR KWWW NOTAMs', 'collapsed'], ['Company NOTAMs', 'open'],     // only its Company item carries a term (O-131: it is shown there)
    ['FIR KXXX Hazards', 'open'], ['FIR KYYY Hazards', 'collapsed']]); // a VA SIGMET; NEGATIVE: none (the empty block has no group)
  const saved = plain(app.S.rawIndex);
  assert.deepEqual([saved.fir.map(b => [b.code, !!b.open, !!b.companyOpen]), saved.haz.map(z => [z.code, !!z.open])],
    [[['KXXX', true, true], ['KYYY', false, false], ['KZZZ', true, false], ['KWWW', false, true]], [['KXXX', true], ['KYYY', false]]], 'saved: codes and flags only');
  assert.ok(!J(saved).includes('ASHTAM') && !J(saved).includes('SIGMET'), 'D107: no printed text in the index');
  assert.deepEqual(plain(app.S.ofpFindings || []), [], 'no OFP Alerts line for FIR items');
  // NEGATIVE: no advisory result → every group collapsed
  run(app, `(function (R) { _rawViews = _ofpRawViews(R); S.rawIndex = _ofpRawIndex(_rawViews, _ofpVolcanicOpen(null)); })(${J(R)})`);
  assert.ok(groups(app.renderEnroutePhase()).every(x => x.hidden));
});

// ══ TC-182-040 perishables ═══════════════════════════════════════════════════════════════════════

fixtureTest('TC-182-040 O-182: perishables only when YES is printed; none on the 7 bare packages', async () => {
  for (const fx of fkFixtures()) {
    const lbl = LBL[fx.id], imp = await imported(fx);
    assert.equal(imp.S.hasPerishables, false, lbl);
    assert.ok(!run(imp.app, 'renderNotesSection()').includes('PERISHABLES — SEE SP'), `${lbl}: no banner`);
  }
  for (const lbl of PERISHABLES_BARE) assert.ok(ref(fkByLbl(lbl)).r.ofpRemarks.some(x => x.category === 'perishables'), `${lbl}: prints PERISHABLES ONBOARD bare`);
  const yes = await synth({ remarks: [S5.BL, 'PERISHABLES ONBOARD: YES', S5.BL] });
  assert.equal(yes.S.hasPerishables, true);
  assert.ok(run(yes.app, 'renderNotesSection()').includes('PERISHABLES — SEE SP'), 'YES printed → the banner (positive)');
  const no = await synth({ remarks: [S5.BL, 'PERISHABLES ONBOARD: NO', S5.BL] });
  assert.ok(!run(no.app, 'renderNotesSection()').includes('PERISHABLES — SEE SP'), 'NO → no banner');
});

// ══ TC-182-050 NavBlue ═══════════════════════════════════════════════════════════════════════════

fixtureTest('TC-182-050 D118: the NavBlue screens (30 packages, 406 screens, raw markup) byte-identical to main 1.10.0', async () => {
  let n = 0;
  for (const fx of nbFixtures()) {
    const imp = await importFixture(fx, FIX), app = imp.app;
    const got = { pre: sha(app.renderPreflightPhase()), enr: sha(app.renderEnroutePhase()), des: sha(run(app, 'renderDescentPhase()')), notes: sha(run(app, 'renderNotesSection()')) };
    for (const a of app.getAllAirports()) {
      got['card:' + a.icao] = sha(run(app, `(function(){const d=airportData[${J(a.icao)}]||{notams:'',weather:''};const a=getAllAirports().find(x=>x.icao===${J(a.icao)});return renderAptIssues(evalAirport(a.icao,a.eta,d.notams,d.weather,a.wxWindow,a.role,S.acftType))})()`)
        + '\u0000' + run(app, `renderAptOpsNotes(${J(a.icao)})`) + '\u0000' + run(app, `renderAptRaw(${J(a.icao)})`));
      run(app, `S.descentAirport=${J(a.icao)}`);
      got['desc:' + a.icao] = sha(run(app, 'renderDescentAirportSummary()'));
    }
    assert.deepEqual(got, NB_PIN[fx.id], `${fx.id}: every screen as main`);
    n += Object.keys(got).length;
    // no new state for NavBlue (D118)
    for (const k of ['ofpRemarksOpen', 'ofpFindings', 'rawIndex', 'ofpFormat']) assert.ok(!(k in imp.S), `${fx.id}: no ${k}`);
    assert.equal(app._getOfpTexts(), null);
  }
  assert.equal(n, 406);
  // NEGATIVE: a changed screen is caught
  const first = nbFixtures()[0], imp = await importFixture(first, FIX);
  run(imp.app, 'S.stabTrim = "1.5/2.5"');
  assert.notEqual(sha(imp.app.renderPreflightPhase()), NB_PIN[first.id].pre);
});

// ══ TC-182-060 / 090 ═════════════════════════════════════════════════════════════════════════════

test('TC-182-060 labels stay 1.10.0 (D91); no *-next key; rules/ holds only the manifest\'s modules', () => {
  assert.match(HTML, /const APP_VERSION = '1\.10\.0';/);
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /const CACHE_NAME\s*=\s*'pb-v1\.10\.0';/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version, '1.10.0');
  assert.deepEqual(NOT_BUILT_IN, []);
  assert.ok(Object.keys(MANIFEST).every(k => !/-next$/.test(k)) && fs.readdirSync(RULES).every(d => !/-next$/.test(d)), 'no *-next key or folder (D96)');
  const js = d => fs.readdirSync(path.join(RULES, d)).filter(f => f.endsWith('.js'));
  assert.deepEqual(js('ofp-flightkeys'), ['ofp-flightkeys-v1.1.0.js'], 'the v1.0.1 copy is out of rules/');
  assert.deepEqual(js('advisory-rules'), ['advisory-rules-v1.0.0.js']);
  assert.ok(fs.existsSync(path.join(ROOT, 'test', 'oracle', 'ofp-flightkeys-v1.0.1.js')), 'the frozen oracle stays in test/oracle');
});

test('TC-182-090 fixtures missing → the fixture tests FAIL, never skip', () => {
  assert.equal(findFixtures(path.join(ROOT, 'no-such-dir')) === path.join(ROOT, 'no-such-dir'), false);
  assert.ok(FIX, 'the fixtures are available in this run');
});
