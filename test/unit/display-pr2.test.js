'use strict';
/**
 * TC-177 — step 5e-2 display PR 2 (Exec answers O-103 B, O-104 A, O-107 A, O-109, O-110, O-111, O-112, O-113,
 * O-114, O-118 + QA #71 F-5; sheet "Scoping Decisions", tab 5e-2). The series is TC-177: TC-176 (display PR 1)
 * was the last used. Positive and negative per scope item and per Exec answer (CLAUDE.md rule 6).
 *
 *   TC-177-001  O-104 / D64 airport RAW NOTAMs: the card group is the NOTAM Briefing block as printed, line by
 *               line (2 airports); 118 cards, every one with its NOTAMS and Weather group (labels without "RAW" since step 5e-3, O-157 / O-158); collapsed; NEGATIVE the
 *               card's evaluated rows are unchanged, a NavBlue card has no RAW group
 *   TC-177-002  D65 RAW weather TAF -> METAR -> ATIS as printed; NEGATIVE the evaluated weather keeps the reader's
 *               order (METAR first, TAF last) and is not the RAW text
 *   TC-177-003  O-104 / O-112 / D64 per-FIR groups: 221 "FIR XXXX NOTAMs" groups (2 blocks line by line; step 5f
 *               display, O-180: collapsed unless the advisory rules flag a volcanic item in it),
 *               collapsed; the parser's combined "FIR Company NOTAMs" group is never shown with them; NEGATIVE
 *               NavBlue and pasted FlightKeys text keep the combined group
 *   TC-177-004  D71 / O-40 / O-131 FIR-keyed Company items: 3, each in its own collapsed "Company NOTAMs" group
 *               directly after its FIR group, never inside it; NEGATIVE no Company group for any other block, and no
 *               Company item is in an airport card
 *   TC-177-005  D76 hazards: 155 "FIR XXXX Hazards" groups (the blocks that print a product), collapsed (step 5f
 *               display, O-180: open when flagged volcanic, L15 WAAF), text as
 *               printed; NEGATIVE the 66 empty blocks have no group; hazard text is never in weather, E-WINS,
 *               remarks weather or an airport's RAW weather
 *   TC-177-006  O-111 "Other briefing airports": one group, 167 airports with no card, 19 with NOTAM text, RAW
 *               only; NEGATIVE no card airport in it, NavBlue none
 *   TC-177-010  O-107 RAW from the stored PDF after reload: the same groups and text as at import; the RAW text
 *               and the OFP text are not in the save; NEGATIVE another flight opened meanwhile is not overwritten
 *   TC-177-011  O-107 missing PDF: every RAW group says "RAW not available – re-import the package", the card is
 *               still evaluated; O-135 (QA F-2) the saved FIR text shows as on main (EBLG-KORD: 25 IDs); NEGATIVE
 *               with the PDF no such text and no combined group; D95 pasted text has no RAW group at all
 *   TC-177-020  O-110 airport remarks on that airport's card (14 remarks, 6 airports), line breaks kept, a
 *               sub-heading once; NEGATIVE an airport without remarks has none
 *   TC-177-021  D45 security message on the Preflight card (LLBG-OMDW); NEGATIVE 25 other packages and NavBlue none
 *   TC-177-022  O-110 / QA F-4 permits one per line under their printed group heading (word PERMIT kept; landing 5
 *               and take-off 2 never under OVERFLIGHT), ADC numbers and missing markers unchanged; NEGATIVE a flight
 *               saved without permits shows the OFP permits text as before
 *   TC-177-023  O-110 CAT II/III restrictions: an airport restriction on that airport's card and Descent summary;
 *               NEGATIVE not on another airport; an MEL restriction is shown with its MEL item's notes only
 *   TC-177-024  O-110 MEL / DDG notes: 24 notes, 23 shown (one is under a 25-series item, hidden by the DDG list
 *               as before); the 2 wrapped notes keep their break; NEGATIVE NavBlue items have no notes
 *   TC-177-025  display rules: FA / MX lines and "*" never on the rest chips; TANKER Company item on the
 *               destination card only; perishables banner only when YES is printed (step 5f display, O-182: none on
 *               the 26; the 7 bare PERISHABLES ONBOARD packages show none)
 *   TC-177-026  remarks weather feeds D-EVAL (synthetic below-minima TAF turns the card red); both weather sources
 *               expandable; NEGATIVE E-WINS stays controlling (L15 PWAK), a report adds no duplicate row; on the
 *               26 no card status changes
 *   TC-177-027  O-127 (Exec, C): one collapsed "OFP Remarks" group on the Preflight card: PCF 17, extra fuel 3,
 *               route 5, ADHOC penalty 6 records as printed, 21 packages; NEGATIVE the other 261 records, NavBlue and old saves none
 *   TC-177-030  O-118 / F-5: no OFP text and no crew name or number in any save, either format (56); every old save
 *               stripped once at app start, not only when opened; NEGATIVE clean saves are not rewritten
 *   TC-177-031  O-118 navlog after reload: the ETP times read from the navigation log are the same after reload
 *               (from the stored PDF); NEGATIVE without the OFP text they are not
 *   TC-177-032  O-113 old save loads safely: no new field → not shown, no error; save size smaller than main
 *   TC-177-033  O-107 (PR 1) failed-save toast still works
 *   TC-177-034  esc() on every RAW and remark text (synthetic markup in every new view)
 *   TC-177-040  NavBlue screens (30) byte-identical to main (hashes in test/unit/data); OFP Alerts unchanged (D92)
 *   TC-177-041  release labels are 1.10.0 (release); no rule module changed
 *
 * Synthetic data is labelled "synthetic". Fixture tests assert counts, codes, ICAOs and labels only; no crew
 * name, employee number or fixture text is printed or asserted. All times are UTC.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const crypto = require('crypto');
const { loadApp } = require('../harness');
const { findFixtures, readManifest, importFixture, importItems, fakePdfjs, peek } = require('../lib/app-path');
const { NOT_BUILT_IN } = require('../lib/not-built-in');   // step 5f: the declared *-next keys (D90, D96)

const ROOT  = path.resolve(__dirname, '..', '..');
const plain = x => JSON.parse(JSON.stringify(x));
const NB_SCREENS = require('./data/display-pr2-navblue-screens.json').screens;

const FIX = findFixtures(process.env.PB_FIXTURES || null);
const needFix = () => assert.ok(FIX, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)');
const fixtureTest = (name, fn) => test(name, async () => { needFix(); return fn(); });
let _man = null;
const manifest = () => (_man = _man || readManifest(FIX));
const fkFixtures = () => manifest().fixtures.filter(f => f.format === 'flightkeys');
const nbFixtures = () => manifest().fixtures.filter(f => f.format !== 'flightkeys');
const fkBy = re => fkFixtures().find(f => re.test(f.id));
const readItems = fx => JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
const _imp = new Map();
async function imported(fx) {
  if (!_imp.has(fx.id)) _imp.set(fx.id, await importFixture(fx, FIX));
  return _imp.get(fx.id);
}
const run = (app, expr) => vm.runInContext(expr, app.sandbox);
// The import screen's text box (#manualText) holds the pasted text; every other element stays a stub (as TC-174-015).
function pasteInto(app, text) {
  const doc = app.sandbox.document;
  app.sandbox.document = new Proxy(doc, { get: (t, p) => (p === 'getElementById' ? (id => (id === 'manualText' ? { value: text } : t.getElementById(id))) : t[p]) });
}
const J = JSON.stringify;
// The parser's own output for an imported package (the same call the app makes).
const parsed = imp => imp.app._ofpParse(imp.rawText, peek(imp.app, 'pdfPages'));
// Step 5f display (O-180): the volcanic FIR items and hazard blocks, by the advisory-rules module loaded in Node
// (the bytes built into the app), on the app's parse; their groups start open, every other one collapsed.
const ADV = require(path.join(ROOT, 'rules', JSON.parse(fs.readFileSync(path.join(ROOT, 'rules', 'manifest.json'), 'utf8'))['advisory-rules'].file));
const volcanic = r => ADV.evaluateAdvisories(JSON.parse(JSON.stringify(r))).volcanicFir;

// Rendered HTML helpers: group labels, and each group's body; the text of every .notam-raw-text block, decoded.
const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const labels = h => [...h.matchAll(/<span class="notam-group-label">([^<]*)<\/span>/g)].map(m => unesc(m[1]));
const raws = h => [...h.matchAll(/<pre class="notam-raw-text">([\s\S]*?)<\/pre>/g)].map(m => unesc(m[1]));
// DEF-014: the OFP Remarks group's records are standard remark items (.notam-item-label), line breaks as <br>.
const remItems = h => [...h.matchAll(/<span class="notam-item-label">([\s\S]*?)<\/span>/g)].map(m => unesc(m[1].replace(/<br>/g, '\n')));
// [label, bodyHtml] per RAW group (renderRawGroup: header, then one hidden body).
function groups(h) {
  const out = [];
  const re = /<div class="notam-group"><div class="notam-group-hdr" onclick="toggleNotamGroup\(this\)"><span class="notam-group-label">([^<]*)<\/span>[\s\S]*?<\/div><div class="notam-group-body"( hidden)?>/g;
  let m;
  const starts = [];
  while ((m = re.exec(h))) starts.push({ label: unesc(m[1]), hidden: !!m[2], at: re.lastIndex, from: m.index });
  starts.forEach((s, k) => out.push({ label: s.label, hidden: s.hidden, body: h.slice(s.at, k + 1 < starts.length ? starts[k + 1].from : h.length) }));
  return out;
}
const aptRaw  = (app, icao) => run(app, `renderAptRaw(${J(icao)})`);
const enrRaw  = app => run(app, 'renderEnrouteRaw()');
const opsNote = (app, icao) => run(app, `renderAptOpsNotes(${J(icao)})`);
const otherSeg = h => { const i = h.indexOf('<span class="notam-group-label">Other briefing airports</span>'); return i < 0 ? '' : h.slice(i); };
const otherApts = h => [...otherSeg(h).matchAll(/onclick="toggleNotamItem\(this\)"><span class="notam-item-label">([A-Z0-9]{4})<\/span>/g)].map(m => m[1]);

// Waits for the async re-derive after loadFlight() (IndexedDB stub → fake pdf.js → parse).
async function settle(app, done) {
  for (let k = 0; k < 400; k++) { if (done()) return; await new Promise(r => setImmediate(r)); }
  throw new Error('re-derive did not finish');
}
// A second app session that opens the flight saved by `imp`, with its stored PDF (or none).
async function reopened(fx, imp, { pdf = true } = {}) {
  const app = loadApp({ storageData: { rp_flights: imp.app.sandbox.localStorage.getItem('rp_flights') } });
  app.sandbox.pdfjsLib = fakePdfjs(readItems(fx));
  app.sandbox.loadPdfJs = async () => {};
  run(app, `_pdfDb.get = () => Promise.resolve(${pdf ? 'new ArrayBuffer(8)' : 'null'})`);
  app.loadFlight(app.getFlights()[0]);
  await settle(app, () => run(app, '_rawViews !== null || !S.rawIndex') && (!pdf || run(app, 'pdfRawText.length > 0')));
  return app;
}

// ══ TC-177-001 … 006 RAW views ═══════════════════════════════════════════════════

fixtureTest('TC-177-001 O-104/D64: airport RAW NOTAMs as printed, line by line; 118 cards; collapsed; NavBlue none', async () => {
  let cards = 0, withN = 0, withW = 0, lineChecked = 0;
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), r = parsed(imp);
    for (const a of imp.app.getAllAirports()) {
      const g = groups(aptRaw(imp.app, a.icao));
      if (g.length) cards++;
      const n = g.find(x => x.label === 'NOTAMS'), w = g.find(x => x.label === 'Weather');   // O-157 / O-158: labels without RAW
      const ad = r.airportData[a.icao] || {};
      assert.equal(!!n, !!(ad.notamsRaw || '').trim(), `${fx.id} ${a.icao}: a NOTAMS group iff the briefing prints a block`);
      if (n) {
        withN++;
        assert.ok(n.hidden, 'collapsed by default');
        assert.deepEqual(raws(n.body), [ad.notamsRaw], `${fx.id} ${a.icao}: the block exactly as printed`);
        if (lineChecked < 2 && ad.notamsRaw.split('\n').length >= 20) {
          // line by line: every printed line, its indentation and the headings kept, nothing reflowed (D54)
          assert.deepEqual(raws(n.body)[0].split('\n'), ad.notamsRaw.split('\n'));
          assert.ok(ad.notamsRaw.split('\n').some(l => /^\s{10,}\S/.test(l)), 'a centred type heading is kept');
          lineChecked++;
        }
      }
      if (w) withW++;
    }
  }
  assert.equal(lineChecked, 2, 'two airports checked line by line');
  assert.deepEqual([cards, withN, withW], [118, 118, 118]);
  // NEGATIVE: the evaluated card rows are those of main (TC-177-040 hashes for NavBlue; golden snapshots-app for
  // FlightKeys): renderAptIssues does not read RAW. A NavBlue card has no RAW group.
  for (const fx of nbFixtures().slice(0, 6)) {
    const imp = await imported(fx);
    for (const a of imp.app.getAllAirports()) assert.equal(aptRaw(imp.app, a.icao), '', `${fx.id} ${a.icao}`);
    assert.equal(run(imp.app, 'S.rawIndex'), undefined);
  }
});

fixtureTest('TC-177-002 D65: RAW weather TAF -> METAR -> ATIS as printed; the evaluated weather keeps its own order', async () => {
  let ordered = 0;
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), r = parsed(imp);
    for (const a of imp.app.getAllAirports()) {
      const w = groups(aptRaw(imp.app, a.icao)).find(x => x.label === 'Weather');   // O-157
      const raw = r.airportData[a.icao].weatherRaw;
      assert.deepEqual(raws(w.body), [raw], `${fx.id} ${a.icao}`);
      const heads = raw.split('\n').map(l => l.trim()).filter(l => /^(TAF|METAR|ATIS)$/.test(l));
      const order = { TAF: 0, METAR: 1, ATIS: 2 };
      assert.deepEqual(heads, [...heads].sort((x, y) => order[x] - order[y]), `${fx.id} ${a.icao}: TAF -> METAR -> ATIS`);
      if (heads.join(' ') === 'TAF METAR ATIS') {
        ordered++;
        // NEGATIVE: the weather the card evaluates (S / airportData) is the reader's order, untouched
        const ev = imp.airportData[a.icao].weather;
        assert.equal(ev, r.airportData[a.icao].weather);
        assert.notEqual(ev, raw);
        assert.ok(!/^\s*TAF\s*$/m.test(ev), 'no RAW sub-headings in the evaluated text');
      }
    }
  }
  assert.ok(ordered >= 50, `cards with all three sub-headings: ${ordered}`);
});

fixtureTest('TC-177-003 O-104/O-112/D64: 221 per-FIR groups as printed (2 blocks line by line); never with the combined group', async () => {
  let n = 0, lineChecked = 0;
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), r = parsed(imp);
    const g = groups(enrRaw(imp.app)).filter(x => /^FIR \S+ NOTAMs$/.test(x.label));
    assert.deepEqual(g.map(x => x.label), plain(r.firRaw.map(b => `FIR ${b.code} NOTAMs`)), fx.id);
    const vf = volcanic(r), open = new Set(vf.notams.filter(v => v.origin !== 'COMPANY').map(v => v.block));
    g.forEach((x, k) => {
      assert.equal(x.hidden, !open.has(k), `${fx.id} ${r.firRaw[k].code}: collapsed, open when it holds a volcanic item (O-180)`);
      assert.equal(raws(x.body)[0], r.firRaw[k].raw, `${fx.id} ${r.firRaw[k].code}`);
      if (lineChecked < 2 && r.firRaw[k].raw.split('\n').length >= 15) {
        assert.deepEqual(raws(x.body)[0].split('\n'), r.firRaw[k].raw.split('\n'), 'line by line');
        lineChecked++;
      }
    });
    n += g.length;
    // O-112: "FIR XXXX NOTAMs" groups and the parser's combined "FIR Company NOTAMs" group never both
    const card = imp.app.renderEnroutePhase();
    assert.ok(!card.includes('>FIR Company NOTAMs<'), `${fx.id}: no combined FIR group`);
    assert.ok(labels(card).every(l => !/^FIR \S+ NOTAMs$/.test(l) || !/Company/.test(l)));
  }
  assert.equal(n, 221);
  assert.equal(lineChecked, 2);
  assert.equal((await Promise.all(fkFixtures().map(imported))).reduce((a, imp) => a + groups(enrRaw(imp.app)).filter(x => /^FIR \S+ NOTAMs$/.test(x.label) && !x.hidden).length, 0), 12,
    'O-180: 12 FIR groups open on the 10 packages (PAZA on L02, L03, L09, L14, L16, L18, L19, L20; L06 LIRR, LIBB; L15 WAAF, WIIF)');
  // NEGATIVE: NavBlue (no RAW) keeps its combined group; the 30 print none, so synthetic FIR text; pasted
  // FlightKeys text (D95) too
  for (const fx of nbFixtures()) assert.equal(enrRaw((await imported(fx)).app), '', fx.id);
  const nb = await importFixture(nbFixtures()[0], FIX);
  run(nb.app, `S.enrouteNotams = Object.assign({}, S.enrouteNotams || {}, { fir: ${J('SYNTHETIC FIR (XXXX)\nA0001/26 SYNTHETIC')} })`);
  assert.ok(nb.app.renderEnroutePhase().includes('>FIR Company NOTAMs<'), 'NavBlue: the combined group as before');
  const app = loadApp();
  pasteInto(app, (await imported(fkBy(/EBLG-KORD/))).rawText);
  app.importManual();
  assert.equal(run(app, 'S.rawIndex'), undefined, 'pasted text: no RAW');
  assert.equal(enrRaw(app), '', 'pasted text: no RAW group (the briefing is read from positions only)');
  assert.ok(!labels(app.renderEnroutePhase()).some(l => /^FIR \S+ (NOTAMs|Hazards)$|^Other briefing airports$/.test(l)));
});

fixtureTest('TC-177-004 D71/O-131: 3 FIR-keyed Company items, each in its own "Company NOTAMs" group right after its FIR block', async () => {
  let n = 0, groupsN = 0;
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), r = parsed(imp);
    const g = groups(enrRaw(imp.app));
    const firAt = g.map((x, k) => (/^FIR \S+ NOTAMs$/.test(x.label) ? k : -1)).filter(k => k >= 0);
    assert.equal(firAt.length, r.firNotams.length, fx.id);
    r.firNotams.forEach((b, j) => {
      const co = b.items.filter(i => i.origin === 'COMPANY');
      const k = firAt[j], next = g[k + 1];
      // never inside the FIR group: its body is the printed block only
      assert.deepEqual(raws(g[k].body), [r.firRaw[j].raw], `${fx.id} ${b.code}: the FIR group holds its block only`);
      assert.ok(!g[k].body.includes('Company NOTAMs'));
      if (co.length) {
        assert.equal(next.label, 'Company NOTAMs', `${fx.id} ${b.code}: the Company group directly after its FIR group`);
        assert.ok(next.hidden, 'collapsed');
        assert.deepEqual(raws(next.body), plain(co.map(i => i.text)), 'the Company items as printed');
        groupsN++;
      } else assert.ok(!next || next.label !== 'Company NOTAMs', `${fx.id} ${b.code}: NEGATIVE no Company group without Company items`);
      n += co.length;
      co.forEach(i => imp.app.getAllAirports().forEach(a => assert.ok(!aptRaw(imp.app, a.icao).includes(i.text.split('\n')[0] + '\n' + (i.text.split('\n')[1] || '')))));
    });
    // every "Company NOTAMs" group follows a FIR group
    g.forEach((x, k) => { if (x.label === 'Company NOTAMs') assert.ok(k > 0 && /^FIR \S+ NOTAMs$/.test(g[k - 1].label)); });
  }
  assert.deepEqual([n, groupsN], [3, 3]);
});

fixtureTest('TC-177-027 O-127: "OFP Remarks" on the Preflight card — PCF 17, extra fuel 3, route 5, ADHOC penalty 6; nothing else', async () => {
  const SHOWN = ['pcf', 'extraFuel', 'route', 'adhocPenalty'];
  const per = {}, hidden = {};
  let pk = 0, noGroup = 0;
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), r = parsed(imp);
    const h = imp.app.renderPreflightPhase();
    const g = groups(h).filter(x => x.label === 'OFP Remarks');
    const want = r.ofpRemarks.filter(x => SHOWN.includes(x.category));
    // O-152 / DEF-013: the group holds the Dispatch contact row (23 of the 26 packages: the remark; the other 3 none), the
    // Security messages and the records (DEF-014: standard remark items, the same text as before): one group when any
    // of them is there, none when none is (the one package with no row and nothing else)
    const inGroup = !!r.dispatchContact || want.length > 0 || (imp.S.securityMessages || []).some(Boolean);
    assert.equal(g.length, inGroup ? 1 : 0, `${fx.id}: the group is there when it has a row, a Security message or a record`);
    r.ofpRemarks.filter(x => !SHOWN.includes(x.category)).forEach(x => { hidden[x.category] = (hidden[x.category] || 0) + 1; });
    if (!g.length) { noGroup++; continue; }
    // O-164 / D123: open with a Security message or a REQUIRED Dispatch contact (SUGGESTION does not open it); O-179 (step 5f):
    // or a positive VA remark / a RAIM attention record; otherwise collapsed
    assert.equal(g[0].hidden, !((imp.S.securityMessages || []).some(Boolean) || (r.dispatchContact && r.dispatchContact.category === 'REQUIRED') || ADV.evaluateAdvisories(plain(r)).openOfpRemarks), `${fx.id}: open / collapsed by O-164, O-179`);
    assert.deepEqual(remItems(g[0].body), plain(want.map(x => x.text)), `${fx.id}: the records as printed, in release order`);
    if (!want.length) continue;
    pk++;
    want.forEach(x => { per[x.category] = (per[x.category] || 0) + 1; });
    // NEGATIVE: no other record of the package is in the group (the slotted ones and those left on the OFP tab)
    r.ofpRemarks.filter(x => !SHOWN.includes(x.category)).forEach(x => {
      if (!want.some(w => w.text === x.text)) assert.ok(!remItems(g[0].body).includes(x.text), `${fx.id}: a ${x.category} record`);
    });
    // a wrapped record keeps its printed line breaks
    want.filter(x => x.text.includes('\n')).forEach(x => assert.ok(remItems(g[0].body).includes(x.text)));
  }
  assert.deepEqual(per, { pcf: 17, extraFuel: 3, route: 5, adhocPenalty: 6 });
  assert.equal(Object.values(hidden).reduce((a, b) => a + b, 0), 292 - 31, 'every other record stays out');
  assert.equal(pk, 21, 'packages with records in the group');
  assert.equal(noGroup, 1, 'DEF-013: the one package with no Dispatch row, no Security message and no record has no group');
  // NEGATIVE: NavBlue none; a flight saved before (no S.ofpRemarks) none
  for (const fx of nbFixtures()) assert.ok(!labels((await imported(fx)).app.renderPreflightPhase()).includes('OFP Remarks'), fx.id);
  const imp = await importFixture(fkBy(/KCVG-KSEA/), FIX);
  assert.ok(labels(imp.app.renderPreflightPhase()).includes('OFP Remarks'));
  run(imp.app, 'delete S.ofpRemarks');
  assert.ok(labels(imp.app.renderPreflightPhase()).includes('OFP Remarks'), 'O-152: the Dispatch contact row alone keeps the group');
  run(imp.app, 'delete S.dispatchContact; delete S.securityMessages');
  assert.ok(labels(imp.app.renderPreflightPhase()).includes('OFP Remarks'), 'DEF-013: the remark alone keeps the group (what is saved is not read for it)');
  imp.app._setOfpTexts({ missing: true });
  assert.ok(labels(imp.app.renderPreflightPhase()).includes('OFP Remarks'), 'the saved flag alone (the stored PDF missing, remark not rebuilt) still says "Review OFP Remarks"');
  run(imp.app, 'delete S.dispatchPrinted');
  assert.ok(!labels(imp.app.renderPreflightPhase()).includes('OFP Remarks'), 'nothing to show: no group');
});

fixtureTest('TC-177-005 D76: 155 hazard groups by FIR, collapsed, as printed; empty blocks none; never weather or E-WINS', async () => {
  let n = 0, empty = 0;
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), r = parsed(imp);
    const g = groups(enrRaw(imp.app)).filter(x => / Hazards$/.test(x.label));
    const shown = r.hazards.filter(z => !z.empty);
    empty += r.hazards.length - shown.length;
    assert.deepEqual(g.map(x => x.label), plain(shown.map(z => `FIR ${z.code} Hazards`)), fx.id);
    const hz = new Set(volcanic(r).hazards.map(v => v.index));
    g.forEach((x, k) => { assert.equal(x.hidden, !hz.has(r.hazards.indexOf(shown[k])), `${fx.id}: collapsed, open when flagged volcanic (O-180)`); assert.deepEqual(raws(x.body), [shown[k].text]); });
    n += g.length;
    // NEGATIVE: no hazard product line reaches airport weather, E-WINS, remarks weather or an airport's RAW weather
    const hazLines = new Set(shown.flatMap(z => z.text.split('\n')).map(l => l.trim()).filter(l => /^(TWC FPG|TWC SIGMET|AIRMET|SIGMET|CONVECTIVE SIGMET)\b/.test(l)));
    for (const [icao, a] of Object.entries(imp.airportData)) {
      const wx = [a.weather, a.ewinsWeather, ...(a.remarksWeather || []).map(w => w.text), ...(peek(imp.app, `_rawViews.apt[${J(icao)}] ? _rawViews.apt[${J(icao)}].weather : ''`) || '').split('\n')].join('\n');
      for (const l of hazLines) assert.ok(!wx.split('\n').some(x => x.trim() === l), `${fx.id} ${icao}: hazard line in weather`);
    }
  }
  assert.deepEqual([n, empty], [155, 66]);
});

fixtureTest('TC-177-006 O-111: one "Other briefing airports" group; 167 airports with no card, 19 with NOTAM text; NavBlue none', async () => {
  let apts = 0, withN = 0;
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), r = parsed(imp);
    const h = enrRaw(imp.app);
    const carded = new Set(imp.app.getAllAirports().map(a => a.icao));
    const want = Object.keys(r.airportData).filter(i => !carded.has(i));
    assert.equal(labels(h).filter(l => l === 'Other briefing airports').length, want.length ? 1 : 0, fx.id);
    assert.deepEqual(otherApts(h), plain(want), `${fx.id}: the briefing airports with no card, in briefing order`);
    const seg = otherSeg(h);
    want.forEach(icao => {
      const ad = r.airportData[icao];
      if (ad.notamsRaw.trim()) { withN++; assert.ok(raws(seg).includes(ad.notamsRaw)); }
      assert.ok(raws(seg).includes(ad.weatherRaw), `${fx.id} ${icao}: RAW weather`);
    });
    // NEGATIVE: no card airport in the group; RAW only (no card, no status dot, no evaluation row)
    assert.ok(otherApts(h).every(i => !carded.has(i)));
    assert.ok(!/notam-dot [rg]|apt-issue/.test(seg));
    apts += want.length;
  }
  assert.deepEqual([apts, withN], [167, 19]);
  for (const fx of nbFixtures().slice(0, 4)) assert.ok(!(await imported(fx)).app.renderEnroutePhase().includes('Other briefing airports'));
});

// ══ TC-177-010 / 011 RAW after reload, missing PDF ══════════════════════════════

fixtureTest('TC-177-010 O-107: after reload the RAW groups come from the stored PDF, identical; not in the save', async () => {
  for (const fx of [fkBy(/EBLG-KORD/), fkBy(/OMAA-VHHH/)]) {
    const imp = await imported(fx);
    const before = { enr: enrRaw(imp.app), apts: imp.app.getAllAirports().map(a => aptRaw(imp.app, a.icao)) };
    const save = imp.app.sandbox.localStorage.getItem('rp_flights');
    // the RAW text is never saved (O-107): no RAW block of the package is in storage
    const r = parsed(imp);
    for (const b of r.firRaw.filter(x => x.raw.length > 200)) assert.ok(!save.includes(J(b.raw).slice(1, -1)), `${fx.id}: firRaw not saved`);
    for (const z of r.hazards.filter(x => !x.empty)) assert.ok(!save.includes(J(z.text).slice(1, -1)), 'hazards not saved');
    // the airport RAW fields are not saved (the evaluated NOTAM and weather text is, as before)
    const saved = JSON.parse(save)[0], RAWK = ['notamsRaw', 'weatherRaw', 'firRaw', 'hazards', 'notamItems', 'briefing', 'rawViews'];
    assert.ok(!RAWK.some(k => k in saved.state), `${fx.id}: no RAW field in the saved state`);
    assert.ok(Object.values(saved.aptData).every(a => !RAWK.some(k => k in a)), `${fx.id}: no RAW field in the saved airports`);
    for (const a of Object.values(r.airportData).filter(x => x.weatherRaw.length > 200)) assert.ok(!save.includes(J(a.weatherRaw).slice(1, -1)), 'weatherRaw not saved');
    const app = await reopened(fx, imp);
    assert.equal(enrRaw(app), before.enr, `${fx.id}: Enroute RAW groups identical after reload`);
    assert.deepEqual(plain(app.getAllAirports().map(a => aptRaw(app, a.icao))), plain(before.apts), `${fx.id}: card RAW groups identical`);
    // nothing else changed by the re-derive: the state is the saved state
    const st = plain(app.S), st0 = plain(imp.S);
    for (const k of Object.keys(st0)) if (!['rawOFP', 'activePhase'].includes(k)) assert.equal(J(st[k]), J(st0[k]), `${fx.id}: S.${k} after reload`);
  }
  // NEGATIVE: a flight opened while the re-derive runs is not overwritten by it
  const a = fkBy(/EBLG-KORD/), b = fkBy(/KMIA-EHBK/);
  const ia = await imported(a), ib = await imported(b);
  const both = JSON.parse(ia.app.sandbox.localStorage.getItem('rp_flights')).concat(JSON.parse(ib.app.sandbox.localStorage.getItem('rp_flights')));
  both[1].id = 'f_second';   // the harness clock is fixed: give the second save its own id
  const app = loadApp({ storageData: { rp_flights: both } });
  app.sandbox.pdfjsLib = fakePdfjs(readItems(a));
  app.sandbox.loadPdfJs = async () => {};
  run(app, '_pdfDb.get = k => k === "' + both[0].id + '" ? new Promise(r => { globalThis.__rel = () => r(new ArrayBuffer(8)); }) : Promise.resolve(null)');
  app.loadFlight(app.getFlights()[0]);
  app.loadFlight(app.getFlights()[1]);
  await settle(app, () => run(app, '_rawViews !== null'));
  run(app, '__rel()');
  for (let k = 0; k < 50; k++) await new Promise(r => setImmediate(r));
  assert.equal(app.S.destIcao, ib.S.destIcao);
  assert.equal(run(app, '_rawViews.missing'), true, 'the second flight keeps its own (missing) state');
  assert.equal(run(app, 'pdfRawText'), '', 'the first flight\'s text did not replace it');
});

fixtureTest('TC-177-011 O-107 missing PDF: "RAW not available – re-import the package"; card still evaluated; D95 pasted none', async () => {
  const MSG = 'RAW not available \u2013 re-import the package';
  const fx = fkBy(/EBLG-KORD/), imp = await imported(fx);
  const app = await reopened(fx, imp, { pdf: false });
  const enr = groups(enrRaw(app));
  assert.equal(enr.length, labels(enrRaw(imp.app)).length, 'the same groups');
  assert.ok(enr.every(g => raws(g.body).length === 1 && raws(g.body)[0] === MSG || /toggleNotamItem/.test(g.body)), 'each group says so');
  assert.ok(raws(otherSeg(enrRaw(app))).every(t => t === MSG));
  for (const a of app.getAllAirports()) {
    const g = groups(aptRaw(app, a.icao));
    assert.ok(g.length >= 2 && g.filter(x => x.label !== 'Remarks Weather').every(x => raws(x.body)[0] === MSG), a.icao);
    const st = run(app, `(function(){const a=getAllAirports().find(x=>x.icao===${J(a.icao)});const d=airportData[a.icao];return evalAirport(a.icao,a.eta,d.notams,d.weather,a.wxWindow,a.role,S.acftType).color})()`);
    const st0 = run(imp.app, `(function(){const a=getAllAirports().find(x=>x.icao===${J(a.icao)});const d=airportData[a.icao];return evalAirport(a.icao,a.eta,d.notams,d.weather,a.wxWindow,a.role,S.acftType).color})()`);
    assert.equal(st, st0, `${a.icao}: the card is still evaluated from the saved NOTAMs and weather`);
  }
  // O-135 (QA F-2): the saved FIR text is shown as main shows it (the combined group), beside the RAW groups
  const firGroup = h => { const i = h.indexOf('>FIR Company NOTAMs<'); if (i < 0) return null; const j = h.lastIndexOf('<div class="notam-group"', i); return h.slice(j, h.indexOf('</pre>', i) + 6); };
  const fb = firGroup(app.renderEnroutePhase());
  assert.ok(fb, 'missing PDF: the saved FIR text is shown');
  assert.equal(unesc(fb.slice(fb.indexOf('>', fb.indexOf('<pre')) + 1, -6)), app.S.enrouteNotams.fir, 'exactly the saved text');
  const asMain = loadApp({ storageData: { rp_flights: imp.app.sandbox.localStorage.getItem('rp_flights') } });
  asMain.loadFlight(asMain.getFlights()[0]);
  run(asMain, 'delete S.rawIndex; _rawViews = null');   // the flight as main shows it: no RAW
  assert.equal(fb, firGroup(asMain.renderEnroutePhase()), 'the group exactly as main shows it');
  // the NOTAM IDs on the whole Enroute screen, each occurrence (the QA count): main 25, all still shown
  const idList = h => unesc(h.replace(/<[^>]+>/g, ' ')).match(/\b[A-Z]\d{1,5}\/\d{2}\b/g) || [];
  const tally = l => l.reduce((m, i) => (m[i] = (m[i] || 0) + 1, m), {});
  const mainIds = tally(idList(asMain.renderEnroutePhase())), headIds = tally(idList(app.renderEnroutePhase()));
  assert.equal(Object.values(mainIds).reduce((a, b) => a + b, 0), 25, 'EBLG-KORD: main shows 25 NOTAM IDs on Enroute after reload');
  assert.deepEqual(Object.keys(mainIds).filter(i => (headIds[i] || 0) < mainIds[i]), [], 'all 25 shown with the PDF missing');
  assert.ok(app.renderEnroutePhase().includes(`<pre class="notam-raw-text">${MSG}</pre>`), 'the RAW groups keep the message');
  // NEGATIVE: with the PDF, no such text and no combined group (never both)
  const ok = await reopened(fx, imp);
  assert.ok(!enrRaw(ok).includes('RAW not available') && !aptRaw(ok, ok.S.destIcao).includes('RAW not available'));
  assert.equal(firGroup(ok.renderEnroutePhase()), null, 'RAW rebuilt: the combined group is not shown');
  // NEGATIVE D95: pasted FlightKeys text has no RAW group and no message
  const p = loadApp();
  pasteInto(p, imp.rawText);
  p.importManual();
  assert.equal(enrRaw(p), '');
  assert.ok(p.getAllAirports().every(a => aptRaw(p, a.icao) === ''));
});

// ══ TC-177-020 … 026 O-110 slots and display rules ══════════════════════════════

fixtureTest('TC-177-020 O-110: airport remarks on their own card (14 on 6 airports), line breaks kept, sub-heading once', async () => {
  let remarks = 0, apts = 0, multi = 0;
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), r = parsed(imp);
    for (const icao of Object.keys(imp.airportData)) {
      const rem = r.airportData[icao].remarks || [];
      const h = opsNote(imp.app, icao);
      const rows = [...h.matchAll(/<span class="notam-item-label">([\s\S]*?)<\/span>/g)].map(m => unesc(m[1].replace(/<br>/g, '\n')));
      if (!rem.length) { assert.ok(!(imp.airportData[icao].remarks), `${fx.id} ${icao}: no remarks`); continue; }
      apts++;
      rem.forEach(x => {
        assert.ok(rows.includes(x.text), `${fx.id} ${icao}: the remark as one row, its printed lines kept`);
        if (x.text.includes('\n')) multi++;
      });
      const subs = [...new Set(rem.map(x => x.subHeading).filter(Boolean))];
      subs.forEach(s => assert.equal(rows.filter(t => t === s).length, 1, `sub-heading ${s} once`));
      remarks += rem.length;
      // NEGATIVE: another airport's remarks are not on this card
      Object.keys(imp.airportData).filter(o => o !== icao).forEach(o => (r.airportData[o].remarks || []).forEach(x => assert.ok(!rows.includes(x.text) || rem.some(y => y.text === x.text))));
    }
  }
  assert.deepEqual([remarks, apts], [14, 6]);
  assert.ok(multi >= 3, `remarks of more than one line: ${multi}`);
});

fixtureTest('TC-177-021 D45: the security message on the Preflight card (1 package); none elsewhere, NavBlue none', async () => {
  let n = 0;
  for (const fx of [...fkFixtures(), ...nbFixtures()]) {
    const imp = await imported(fx);
    const h = imp.app.renderPreflightPhase();
    const rows = [...h.matchAll(/<span class="data-label">Security<\/span><span class="data-value">([\s\S]*?)<\/span>/g)].map(m => unesc(m[1].replace(/<br>/g, '\n')));
    const want = fx.format === 'flightkeys' ? plain(parsed(imp).securityMessages.map(m => m.text)) : [];
    assert.deepEqual(rows, want, fx.id);
    n += rows.length;
    if (rows.length) assert.ok(/LLBG-OMDW/.test(fx.id));
  }
  assert.equal(n, 1);
});

fixtureTest('TC-177-022 O-110/F-4: permits one per line under their printed group heading, with the ADC number; old saves as before', async () => {
  const HEAD = /^--- (OVERFLIGHT|LANDING|TAKEOFF) PERMITS?$/;
  const bodyOf = app => {
    const m = run(app, 'renderNotesSection()').match(/<span class="notes-sub-header">OVERFLIGHTS<\/span><span class="notes-sub-body">([\s\S]*?)<\/span>/);
    return m ? unesc(m[1]).split('<br>') : null;
  };
  const fx = fkBy(/OMAA-VHHH/), imp = await imported(fx), r = parsed(imp);
  const body = bodyOf(imp.app);
  const adc = r.permits.find(p => p.adc);
  assert.ok(adc, 'one permit with an ADC number');
  const k = body.indexOf([adc.country, adc.reference].join(' '));
  assert.ok(k >= 0, 'the permit line');
  assert.equal(body[k + 1], adc.adc, 'its ADC number on the line after it, unchanged');
  assert.equal(body[0], '--- OVERFLIGHT PERMITS', 'the printed group heading, with the word PERMIT');
  let landing = 0, takeoff = 0, missing = 0;
  for (const f of fkFixtures()) {
    const i2 = await imported(f), r2 = parsed(i2), b2 = bodyOf(i2.app);
    assert.equal(!!b2, r2.permits.length > 0, f.id);
    if (!b2) continue;
    // the headings are the ones the OFP prints, in order, each once per group (FK-P: NavBlue's text shows them)
    assert.deepEqual(b2.filter(l => HEAD.test(l)), plain(r2.overflightPerms.match(/--- [A-Z]+ PERMITS?/g)), `${f.id}: group headings`);
    for (const p of r2.permits) {
      const at = b2.indexOf([p.country, p.reference].filter(Boolean).join(' '));
      assert.ok(at > 0, `${f.id} ${p.country}: its line, reference unchanged`);
      const head = b2.slice(0, at).filter(l => HEAD.test(l)).pop();
      assert.equal(head.split(' ')[1], p.type, `${f.id} ${p.country}: under its own ${p.type} heading, never under OVERFLIGHT`);
      if (p.type === 'LANDING') landing++;
      if (p.type === 'TAKEOFF') takeoff++;
      if (p.missing) { missing++; assert.ok(/\/{3,}\s*PERMIT MISSING\s*\/{3,}/.test(b2[at]), 'the missing marker unchanged'); }
      [p.route, p.restriction, p.adc].filter(Boolean).forEach(x => assert.ok(b2.includes(x), `${f.id}: ${p.country} detail line`));
      assert.ok(!b2.some(l => /^(OVERFLIGHT|LANDING|TAKEOFF) /.test(l)), `${f.id}: no type word put in front of an entry`);
    }
  }
  assert.deepEqual([landing, takeoff, missing], [5, 2, 2]);
  // NEGATIVE: a flight saved before (no S.permits) shows the OFP permits text as before; NavBlue: TC-177-040
  run(imp.app, 'delete S.permits');
  assert.ok(run(imp.app, 'renderNotesSection()').includes(`<span class="notes-sub-body">${run(imp.app, 'esc(S.overflightPerms)')}</span>`));
});

fixtureTest('TC-177-023 O-110: CAT II/III restrictions — airport ones on that card and Descent summary; MEL ones with their item', async () => {
  const fx = fkBy(/KCVG-KSEA/), imp = await imported(fx);
  const rs = plain(imp.S.catIiIiiRestrictions).filter(c => c.airport);
  assert.equal(rs.length, 1);
  const rowsOf = icao => [...opsNote(imp.app, icao).matchAll(/<span class="notam-item-label">([\s\S]*?)<\/span>/g)].map(m => unesc(m[1]));
  assert.ok(rowsOf(rs[0].airport).includes(rs[0].text), 'on that airport\'s card');
  imp.app.getAllAirports().filter(a => a.icao !== rs[0].airport).forEach(a => assert.ok(!rowsOf(a.icao).includes(rs[0].text), `NEGATIVE: not on ${a.icao}`));
  // the Descent summary (no departure airport there): the restriction row in the NOT AUTHORIZED style
  const sum = icao => { run(imp.app, `S.descentAirport=${J(icao)}`); return run(imp.app, 'renderDescentAirportSummary()'); };
  run(imp.app, `S.catIiIiiRestrictions[S.catIiIiiRestrictions.findIndex(c=>c.airport)].airport = S.destIcao`);   // synthetic: on the destination
  assert.ok(unesc(sum(imp.S.destIcao)).includes(`>${rs[0].text}</span>`), 'synthetic: on the destination\'s Descent summary');
  const alt = imp.app.getAllAirports().find(a => a.role !== 'ORIG' && a.icao !== imp.S.destIcao);
  assert.ok(!unesc(sum(alt.icao)).includes(rs[0].text), 'NEGATIVE: not on another airport\'s summary');
  // MEL restrictions (no airport): never an airport row; shown as their MEL item's note "- CAT … Restricted"
  let mel = 0;
  for (const f of fkFixtures()) {
    const i2 = await imported(f);
    for (const c of plain(i2.S.catIiIiiRestrictions).filter(c => !c.airport)) {
      mel++;
      const code = c.source.replace(/^MEL /, '');
      const item = i2.S.ddgItems.find(d => d.code === code);
      assert.ok(item.notes.some(n => n.text.includes(c.text)));
      assert.ok(unesc(run(i2.app, 'renderNotesSection()')).includes(item.notes.find(n => n.text.includes(c.text)).text));
      i2.app.getAllAirports().forEach(a => assert.ok(!unesc(opsNote(i2.app, a.icao)).includes(c.text), `${f.id}: an MEL restriction is no airport row`));
    }
  }
  assert.equal(mel, 4);
});

fixtureTest('TC-177-024 O-110: MEL/DDG notes — 24, 23 shown (one under a 25-series item), wrapped notes keep their break', async () => {
  let all = 0, shown = 0, wrapped = 0;
  for (const fx of fkFixtures()) {
    const imp = await imported(fx);
    const notes = run(imp.app, 'renderNotesSection()');
    for (const d of imp.S.ddgItems) for (const n of d.notes) {
      all++;
      const on = notes.includes(`<span class="ddg-item-desc">${run(imp.app, `${J(n.text)}.split('\\n').map(esc).join('<br>')`)}</span>`);
      assert.equal(on, !d.code.startsWith('25-'), `${fx.id} ${d.code}`);
      if (on) shown++;
      if (on && n.text.includes('\n')) { wrapped++; assert.ok(notes.includes(n.text.split('\n').map(l => run(imp.app, `esc(${J(l)})`)).join('<br>'))); }
    }
  }
  assert.deepEqual([all, shown, wrapped], [24, 23, 2]);
  // NEGATIVE: NavBlue DDG items have no notes; their list is main's (TC-177-040)
  for (const fx of nbFixtures()) assert.ok((await imported(fx)).S.ddgItems.every(d => !d.notes), fx.id);
});

fixtureTest('TC-177-025 display rules: no FA/MX, no "*" on the chips; TANKER on the destination card only; perishables', async () => {
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), r = parsed(imp);
    const chips = plain(imp.S.crewMembers);
    assert.equal(chips.length, r.operatingPilots, fx.id);
    assert.ok(chips.every(c => !['FA', 'MX', 'LM', 'PU'].includes(c.role) && !c.isSen), `${fx.id}: no FA/MX line, no senior mark`);
    assert.ok(!/[*\u2605]/.test(imp.app.renderInflightRestModule()), `${fx.id}: "*" never shown`);
    // perishables (step 5f display, O-182): the banner only when the package prints YES (the parser's hasPerishables);
    // the 7 packages printing PERISHABLES ONBOARD bare show none
    assert.equal(run(imp.app, 'renderNotesSection()').includes('PERISHABLES — SEE SP'), r.hasPerishables === true, fx.id);
    if (r.ofpRemarks.some(x => x.category === 'perishables')) assert.ok(!run(imp.app, 'renderNotesSection()').includes('PERISHABLES — SEE SP'), `${fx.id}: bare PERISHABLES ONBOARD, no banner (O-182)`);
  }
  assert.equal((await Promise.all(fkFixtures().map(imported))).filter(i => i.S.hasPerishables).length, 0);
  // TANKER: MKJP-KMIA carries the Company item MKJP-TANKER; MKJP is the departure → not on its card
  const fx = fkBy(/MKJP-KMIA/), imp = await imported(fx);
  assert.ok(imp.airportData.MKJP.opsNotes.body.includes('SUBJECT: MKJP-TANKER'));
  assert.ok(!opsNote(imp.app, 'MKJP').includes('MKJP-TANKER'), 'departure: the tankering item is not shown');
  assert.ok(!/TANKERING/.test(opsNote(imp.app, 'MKJP')), 'none of its lines');
  // synthetic: the same item with MKJP as the destination is shown, whole
  const dest = imp.S.destIcao;
  run(imp.app, 'S.destIcao = "MKJP"');
  const h = unesc(opsNote(imp.app, 'MKJP'));
  imp.airportData.MKJP.opsNotes.body.split('\n').map(l => l.trim()).filter(l => l && !/^[-\s]*$/.test(l)).forEach(l => assert.ok(h.includes(l)));
  run(imp.app, `S.destIcao = ${J(dest)}`);
  // NEGATIVE: NavBlue ops notes are never filtered (no S.ofpFormat); their cards are main's (TC-177-040)
  const nbi = await imported(nbFixtures()[0]);
  assert.equal(run(nbi.app, 'S.ofpFormat'), undefined);
  assert.equal(run(nbi.app, `_opsNoteBody('XXXX', ${J('SUBJECT: XXXX-TANKER\nSYNTHETIC')})`), 'SUBJECT: XXXX-TANKER\nSYNTHETIC');
});

fixtureTest('TC-177-026 remarks weather feeds D-EVAL; both sources expandable; E-WINS stays controlling; no change on the 26', async () => {
  // L15 PWAK: the remarks TAF (GOV TAF UPDATED) under E-WINS (D46): the E-WINS forecast decides, as before
  const fx = fkBy(/PHNL-WIHH/), imp = await imported(fx);
  const pw = imp.airportData.PWAK;
  assert.ok(pw.ewinsWeather && pw.remarksWeather.length === 1);
  const evalOf = (app, icao) => run(app, `(function(){const a=getAllAirports().find(x=>x.icao===${J(icao)});const d=airportData[a.icao];const s=evalAirport(a.icao,a.eta,d.notams,d.weather,a.wxWindow,a.role,S.acftType);return {color:s.color,issues:s.issues.map(i=>i.text)}})()`);
  const withRw = plain(evalOf(imp.app, 'PWAK'));
  run(imp.app, 'var __rw = airportData.PWAK.remarksWeather; delete airportData.PWAK.remarksWeather');
  assert.deepEqual(plain(evalOf(imp.app, 'PWAK')), withRw, 'E-WINS controlling: the remarks TAF changes nothing');
  run(imp.app, 'airportData.PWAK.remarksWeather = __rw');
  const g = groups(aptRaw(imp.app, 'PWAK'));
  assert.deepEqual(g.map(x => x.label), ['Weather', 'NOTAMS', 'Remarks Weather'].filter(l => l !== 'NOTAMS' || imp.S.rawIndex.apt.PWAK.includes('N')), 'both weather sources expandable (O-157 / O-158: Weather before NOTAMS)');
  assert.deepEqual(raws(g.find(x => x.label === 'Remarks Weather').body), [pw.remarksWeather[0].source + '\n' + pw.remarksWeather[0].text]);
  // synthetic: a card airport (not E-WINS) with open briefing weather; a remarks TAF below minima turns it red
  const dest = imp.S.destIcao;
  run(imp.app, `airportData[${J(dest)}].ewinsWeather = ''`);
  const base = plain(evalOf(imp.app, dest));
  run(imp.app, `airportData[${J(dest)}].remarksWeather = [{ source: 'OFP Remarks', type: 'TAF', text: 'TAF AMD ${dest} 031200Z 0312/0418 00000KT 0200 FG OVC002' }]`);   // synthetic
  const worse = plain(evalOf(imp.app, dest));
  assert.equal(worse.color, 'red', 'the remarks report is evaluated: LIFR');
  assert.ok(worse.issues.length > base.issues.length);
  assert.ok(!worse.issues.some(t => /Open — wx at or above mins/.test(t)), 'no "open" row beside a red weather row');
  // NEGATIVE: a remarks report repeating the briefing's own conditions adds no duplicate row
  run(imp.app, `airportData[${J(dest)}].remarksWeather = [{ source: 'OFP Remarks', type: 'TAF', text: airportData[${J(dest)}].weather }]`);
  const same = plain(evalOf(imp.app, dest));
  assert.equal(same.color, base.color);
  assert.equal(new Set(same.issues).size, same.issues.length, 'no row twice');
  // NEGATIVE: a NavBlue airport (no remarksWeather) evaluates as before: covered on all 30 by TC-177-040;
  // on the 26 no card status changes (snapshots-app status unchanged; only PWAK has remarks weather).
});

// ══ TC-177-030 … 034 storage ═════════════════════════════════════════════════════

// The printed forms of a crew record the OFP parsers read (a name, a name with its number). Built from the
// parser's crew list; each is first found in the OFP text itself (the check can bite), then never in the save.
function crewForms(r, rawText) {
  const forms = new Set();
  (r.crewMembers || []).forEach(c => {
    if (c.lastName && c.firstName) forms.add(`${c.lastName}, ${c.firstName}`.trim());
    if (c.displayName && /\s/.test(c.displayName.trim())) forms.add(c.displayName.trim());
    if (c.empNum && c.role) forms.add(`${c.role} ${c.empNum}`);
  });
  return [...forms].filter(f => f.length >= 6 && rawText.includes(f));
}

fixtureTest('TC-177-030 O-118/F-5: no OFP text, no crew name or number in any save (56); old saves stripped at app start', async () => {
  let checked = 0;
  for (const fx of manifest().fixtures) {
    const imp = await imported(fx), r = parsed(imp);
    const save = imp.app.sandbox.localStorage.getItem('rp_flights');
    const e = JSON.parse(save)[0];
    assert.ok(!('raw' in e), `${fx.id}: no raw OFP text`);
    assert.ok(!('rawOFP' in e.state), `${fx.id}: no state.rawOFP`);
    assert.ok(imp.S.rawOFP.length > 0, 'the open flight keeps it in memory');
    const forms = crewForms(r, imp.rawText);
    forms.forEach(f => assert.ok(!save.includes(f), `${fx.id}: a crew record form is in the save`));
    if (forms.length) checked++;
  }
  assert.ok(checked >= 50, `packages whose printed crew forms were checked: ${checked}`);
  // every old save stripped once at app start (F-5), not only when opened: synthetic names and OFP text
  const imp = await imported(fkBy(/EBLG-KORD/));
  const st = plain(imp.S);
  const old = n => ({ id: 'f_old' + n, fltNum: st.fltNum + n, date: st.date, at: '2026-11-01T00:00:00.000Z', raw: 'SYNTHETIC OFP TEXT CA 0000001 SYNTHETICA, ANNE',
    state: { ...st, fltNum: st.fltNum + n, rawOFP: 'SYNTHETIC OFP TEXT CA 0000001 SYNTHETICA, ANNE',
      crewMembers: [{ role: 'CA', empNum: '0000001', lastName: 'SYNTHETICA', initial: 'A', displayName: 'SYNTHETICA A', active: true, isSen: false }] },
    aptData: {} });
  const app = loadApp({ storageData: { rp_flights: [old(1), old(2)] } });
  const after = app.sandbox.localStorage.getItem('rp_flights');
  assert.ok(!/SYNTHETIC|0000001/.test(after), 'no name, number or OFP text left in any saved flight');
  assert.deepEqual(JSON.parse(after).map(f => plain(f.state.crewMembers)), [[{ role: 'CA', active: true, displayName: '' }], [{ role: 'CA', active: true, displayName: '' }]]);
  assert.equal(JSON.parse(after).length, 2, 'the flights stay');
  // NEGATIVE: a store with nothing to strip is not rewritten at start
  const clean = imp.app.sandbox.localStorage.getItem('rp_flights');
  const app2 = loadApp({ storageData: { rp_flights: clean } });
  assert.equal(app2.sandbox.localStorage.getItem('rp_flights'), clean, 'unchanged');
});

fixtureTest('TC-177-031 O-118: navlog after reload — an ETP time read from the navigation log is kept (stored PDF)', async () => {
  // On the 56 packages every ETP has its time from the parser. Synthetic: an ETP without one (the case the
  // navigation-log read exists for, ENR V2 BUG 1/2/3); its time then comes from the OFP text, which is no
  // longer saved: after reload it is re-derived from the stored PDF.
  const events = app => plain(run(app, 'buildTimelineEventsV2(S, S.navLog || [], true, S.destEtaOffsetMins || S.tripMinutes || 0, S.rawOFP || "")'))
    .filter(e => e.type === 'etp').map(e => [e.label, e.elapsed]);
  for (const fx of [manifest().fixtures.find(f => /NB_KMIA-EHAM/.test(f.id)), fkBy(/EPPW-KPSM/)]) {
    const imp = await importFixture(fx, FIX);
    const nav = plain(run(imp.app, 'extractEtpElapsedFromNavlog(S.rawOFP)'));
    run(imp.app, 'S.etpPoints = S.etpPoints.map(p => Object.assign({}, p, { elapsedMins: null })); saveFlight()');   // synthetic
    const at = events(imp.app);
    assert.deepEqual(at, Object.entries(nav), `${fx.id}: the ETP times from the navigation log`);
    const app = await reopened(fx, imp);
    assert.equal(run(app, 'S.rawOFP'), imp.S.rawOFP, 'the OFP text re-derived from the stored PDF');
    assert.deepEqual(events(app), at, `${fx.id}: the same ETP times after reload`);
    // NEGATIVE: without the stored PDF there is no OFP text, so no navigation-log time
    const noPdf = await reopened(fx, imp, { pdf: false });
    assert.equal(run(noPdf, 'S.rawOFP'), '');
    assert.deepEqual(events(noPdf), []);
  }
});

fixtureTest('TC-177-032 O-113: an old save loads safely (missing fields not shown); the save is smaller than before', async () => {
  const fx = fkBy(/LLBG-OMDW/), imp = await imported(fx);
  const st = plain(imp.S);
  for (const k of ['ofpFormat', 'rawIndex', 'securityMessages', 'permits', 'catIiIiiRestrictions', 'ofpRemarks', 'dispatchContact', 'dispatchPrinted']) delete st[k];   // an old save has no 5f flag   // O-152: the Dispatch contact row is in the OFP Remarks group now
  const apt = plain(imp.airportData);
  Object.values(apt).forEach(a => { delete a.remarks; delete a.remarksWeather; });
  const app = loadApp({ storageData: { rp_flights: [{ id: 'f_old', fltNum: st.fltNum, date: st.date, at: '2026-11-01T00:00:00.000Z', state: st, aptData: apt }] } });
  assert.doesNotThrow(() => app.loadFlight(app.getFlights()[0]));
  assert.doesNotThrow(() => { app.renderPreflightPhase(); app.renderEnroutePhase(); run(app, 'renderDescentPhase(); renderNotesSection()'); });
  assert.ok(!/data-label">Security</.test(app.renderPreflightPhase()), 'no security row');
  assert.ok(!labels(app.renderPreflightPhase()).includes('OFP Remarks'), 'no OFP Remarks group');
  assert.equal(enrRaw(app), '', 'no RAW groups');
  assert.ok(app.getAllAirports().every(a => aptRaw(app, a.icao) === ''));
  assert.ok(run(app, 'renderNotesSection()').includes(`<span class="notes-sub-body">${run(app, 'esc(S.overflightPerms)')}</span>`), 'permits as before');
  // save size: the 56 packages, this build (the report compares main)
  const sizes = [];
  for (const f of manifest().fixtures) sizes.push((await imported(f)).app.sandbox.localStorage.getItem('rp_flights').length);
  const avg = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length), max = Math.max(...sizes);
  console.log(`TC-177-032: saved flight size over the 56 packages: average ${avg} chars, max ${max}`);
  assert.ok(max < 120000, 'no OFP text in a save');
});

fixtureTest('TC-177-033 O-107 (PR 1): a failed save still shows "Flight not saved – storage full"', async () => {
  const imp = await importFixture(fkBy(/EBLG-KORD/), FIX);
  const toasts = [];
  imp.app.sandbox.showToast = (t, m) => toasts.push([t, m]);
  imp.app.saveFlight();
  assert.deepEqual(toasts, []);
  imp.app.sandbox.localStorage.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
  assert.doesNotThrow(() => imp.app.saveFlight());
  assert.deepEqual(toasts, [['err', 'Flight not saved \u2013 storage full']]);
});

fixtureTest('TC-177-034 esc() on every RAW and remark text (synthetic markup)', async () => {
  const imp = await importFixture(fkBy(/OMAA-VHHH/), FIX);
  const X = '<img src=x onerror="alert(1)">&';   // synthetic
  run(imp.app, `(function(){ const X=${J(X)}; const icao=S.destIcao;
    Object.keys(_rawViews.apt).forEach(k=>{ _rawViews.apt[k].notams = X + _rawViews.apt[k].notams; _rawViews.apt[k].weather = X; });
    _rawViews.fir.forEach(b=>{ b.raw = X; b.company = [X]; S.rawIndex.fir.forEach(f=>f.company=1); });
    _rawViews.haz.forEach(z=>{ z.text = X; });
    airportData[icao].remarks = [{ text: X + '\\n' + X, subHeading: X }];
    airportData[icao].remarksWeather = [{ source: X, type: 'TAF', text: X }];
    S.ofpRemarks = [{ category: 'pcf', text: X + '\\n' + X }];
    S.securityMessages = [X]; S.permits = [{ type: X, country: X, reference: X, route: X, restriction: X, adc: X, missing: false }];
    S.catIiIiiRestrictions = [{ airport: icao, category: X, runways: [], text: X, source: 'OFP Remarks' }];
    S.ddgItems = [{ code: '21-00-00', desc: 'synthetic', tlr: 'landing', type: 'MEL', notes: [{ text: X + '\\n' + X, indent: 1 }] }];
  })()`);
  const all = [enrRaw(imp.app), imp.app.renderEnroutePhase(), imp.app.renderPreflightPhase(), run(imp.app, 'renderDescentPhase()'), run(imp.app, 'renderNotesSection()'),
    ...imp.app.getAllAirports().map(a => aptRaw(imp.app, a.icao) + opsNote(imp.app, a.icao)),
    run(imp.app, 'S.descentAirport = S.destIcao; renderDescentAirportSummary()')].join('\n');
  assert.ok(!all.includes('<img'), 'no markup from the data');
  const n = (all.match(/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;&amp;/g) || []).length;
  assert.ok(n >= 12, `escaped occurrences: ${n}`);
});

// ══ TC-177-040 / 041 NavBlue unchanged, labels ═══════════════════════════════════

const sha16 = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
// main's Company Remarks markup (before O-155) from the new one: the class, the toggle, the chevron and the body's hidden
// attribute are the only differences.
function opsNoteAsMain(h) {
  if (!h) return h;
  const CHEV = '<svg class="notam-chev" viewBox="0 0 9 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l6.5 6L1 13"/></svg>';
  const OLD_CHEV = '<svg class="cell-chevron" viewBox="0 0 9 14"\n             aria-hidden="true">\n          <path d="M1 1l6.5 6L1 13"/>\n        </svg>';
  const steps = [
    ['<div class="apt-ops-note"\n', '<div class="apt-ops-note collapsed"\n'],
    ['onclick="toggleNotamGroup(this)"\n           role="button">', 'onclick="this.parentElement.classList.toggle(\'collapsed\')"\n           role="button" aria-expanded="false">'],
    [CHEV, OLD_CHEV],
    ['<div class="notam-group-body" hidden>', '<div class="notam-group-body">'],
  ];
  return steps.reduce((t, [n, o]) => { assert.ok(t.includes(n), 'markup step present: ' + n.slice(0, 40)); return t.replace(n, () => o); }, h);
}

fixtureTest('TC-177-040 NavBlue screens (30) byte-identical to main; OFP Alerts unchanged (D92)', async () => {
  for (const fx of nbFixtures()) {
    const imp = await imported(fx), app = imp.app;
    const want = NB_SCREENS[fx.id];
    assert.ok(want, fx.id);
    const got = { pre: sha16(app.renderPreflightPhase()), enr: sha16(app.renderEnroutePhase()), des: sha16(run(app, 'renderDescentPhase()')), notes: sha16(run(app, 'renderNotesSection()')) };
    for (const a of app.getAllAirports()) {
      // O-155 (step 5e-3): Company Remarks is a collapsed group now; its markup is mapped back to main's (opsNoteAsMain) so
      // this hash still shows that nothing else on the card changed. The new markup itself is TC-179-030.
      got['card:' + a.icao] = sha16(run(app, `(function(){const d=airportData[${J(a.icao)}]||{notams:'',weather:''};const a=getAllAirports().find(x=>x.icao===${J(a.icao)});return renderAptIssues(evalAirport(a.icao,a.eta,d.notams,d.weather,a.wxWindow,a.role,S.acftType))})()`)
        + opsNoteAsMain(run(app, `renderAptOpsNotes(${J(a.icao)})`)) + run(app, `renderAptRaw(${J(a.icao)})`));
      run(app, `S.descentAirport=${J(a.icao)}`);
      got['desc:' + a.icao] = sha16(run(app, 'renderDescentAirportSummary()'));
    }
    assert.deepEqual(got, want, `${fx.id}: every screen as main`);
  }
  // D92: the OFP Alerts list is the parser's, unchanged by this PR (FlightKeys)
  for (const fx of fkFixtures()) {
    const imp = await imported(fx);
    const h = imp.app.renderPreflightPhase();
    const shown = imp.app._ofpShownFindings(run(imp.app, '_ofpAlertFindings()')).map(f => f.message);
    if (shown.length) assert.ok(h.includes(shown.map(m => run(imp.app, `esc(${J(m)})`)).join('<br>')), fx.id);
  }
});

test('TC-177-041 labels are 1.10.0 (release); no rule module or module text changed by this PR', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /const APP_VERSION\s*=\s*'1\.10\.0'/);
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /const CACHE_NAME\s*=\s*'pb-v1\.10\.0'/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version, '1.10.0');
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'rules', 'manifest.json'), 'utf8'));
  // Step 5f: the declared *-next keys (not built in, D90) are not this PR's modules
  assert.deepEqual(Object.fromEntries(Object.entries(man).filter(([k]) => !NOT_BUILT_IN.includes(k)).map(([k, v]) => [k, v.version])),
    { 'notam-rules': '1.14.0', 'ofp-navblue': '2.0.1', 'aircraft-profile': '1.0.0', 'icao-fpl': '1.0.0', 'ofp-flightkeys': '1.1.1', 'nat-rules': '1.2.0', 'advisory-rules': '1.0.0' });
  // DEF-013 integration: the module PR bytes (#81), moved unchanged
  assert.equal(man['ofp-flightkeys'].sha256, 'dbe3ee963ed003fd462ea1cdaabcb8188ca98adfd4229c3f7ebb28dd05e1415c');
  assert.equal(man['advisory-rules'].sha256, '8373fb54866a19fbedd7f0547d237046987146e24f9e821cb03863a7f523ebff');
});
