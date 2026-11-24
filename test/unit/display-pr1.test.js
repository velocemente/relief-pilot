'use strict';
/**
 * TC-176 — step 5e-2 display PR 1 (Exec answers O-103 B, O-105 A+, O-106, O-107 A, O-108, O-109, O-113,
 * O-116 A; sheet "Scoping Decisions", tab 5e-2). The series is TC-176: TC-175 (FlightKeys v1.0.1) was the
 * last used. Positive and negative per scope item and per Exec answer (CLAUDE.md rule 6).
 *
 *   TC-176-001  O-116: ofp-flightkeys v1.0.1 built in once, v1.0.0 not; no *-next key or folder; NEGATIVE a
 *               *-next key is refused
 *   TC-176-010  data path, 26 FlightKeys + 30 NavBlue: the fields copied from the parser are the parser's; the
 *               new fields (operatingPilots, dispatchContact, natMessages, dateEnteredByCrew) as declared; no raw
 *               text in them (O-107); NEGATIVE a NavBlue package has no dispatchContact and no natMessages
 *   TC-176-011  O-113 old save: a flight saved before this PR (no new fields, crew names) loads without an
 *               error; the missing items are not shown; NAT card as before; names removed (D62)
 *   TC-176-012  O-107: a failed save shows the existing error toast "Flight not saved – storage full";
 *               NEGATIVE a save that works shows none
 *   TC-176-020  D85 NAT card: FK EBLG-KORD East 5 + West 6 (chosen message first); single-direction packages:
 *               "No … tracks found." only for the direction no message has; NavBlue 8 / 8 byte-identical
 *   TC-176-020  (QA F-2) each direction under its own message's TMI, the chosen message's direction first
 *               (EBLG-KORD westbound: West, TMI 307, before East, TMI 308)
 *   TC-176-022  QA F-3 synthetic: the findings of the card's own NAT parses are on OFP Alerts (WARNs, then NAT
 *               INFOs; the same text once); "Tracks not readable" only when such a line exists; NEGATIVE no line →
 *               no such text; the filed-letter findings of a message that is not the chosen one are not shown
 *   TC-176-023  QA F-6 synthetic: a message whose direction is unreadable → "Tracks not readable – see OFP
 *               Alerts" under the flight's direction (with its OFP Alerts WARN), not "No eastbound tracks found."
 *   TC-176-021  D85 synthetic: a published message with no tracks keeps the card (WARN stays on OFP Alerts);
 *               O-122: a published direction with no readable track says "Tracks not readable – see OFP Alerts",
 *               NEGATIVE an unpublished direction says "No … tracks found."; the filed track marked in the chosen
 *               direction only; NEGATIVE an object with no published message and no tracks has no card
 *   TC-176-030  D57 synthetic: no readable flight date → "Operating date needed" in the header date slot and
 *               the date pop-up prefilled with today's UTC DD MM YYYY; the prefill moves forward past 0000Z,
 *               never back; the entered date → S.date DD MON YY + dateEnteredByCrew; the timeline is dated;
 *               reload keeps it; NEGATIVE an unreadable entry is not taken; 56 / 56 dated show no prompt
 *   TC-176-032  O-121 synthetic no-date flight crossing 0000Z: with the entered date, every later time after
 *               0000Z (downline ETAs, NOTAM and weather windows) on the next day; NEGATIVE nothing is ever dated
 *               before the entered date (an OUT edited back across 0000Z, a flight with an OFP date unchanged)
 *   TC-176-041  QA F-1: the NavBlue senior-designee mark on the role chip ("FO ★", NB KORD-RKSI 08APR26), also
 *               after an old save is stripped; NEGATIVE FlightKeys never ("*" is not seniority, SME-3); no other chip
 *   TC-176-040  D62 / O-106 / O-109 / O-124: FK counts 2:4, 3:12, 4:10; one chip per pilot with the printed role
 *               (e.g. CA FO FO FO), both formats; no crew name or number in state or save; an edited count changes
 *               the chips and the count; NEGATIVE a package without a count gives no chips and the existing picker,
 *               never carried over
 *   TC-176-050  D89 / O-108: a mixed package is refused with the named error; the crew stays on the import
 *               screen, nothing saved; NEGATIVE a FlightKeys package goes to the flight screen
 *   TC-176-060  D72 dispatchContact: 26 FK (saved: the category only; SUGGESTION 23, none 3, REQUIRED 0), row label
 *               "Dispatch contact" (O-123) in the OFP Remarks group (O-152); DEF-013 (Exec rulings): the row shows the
 *               remark exactly as the parser gives it; none → no row; the stored PDF missing → "Review OFP Remarks"; NavBlue none
 *   TC-176-070  D67b / O-105 rows on the app path, per card and group: FK 5 + NavBlue 11 departure, 21 + 37
 *               destination / alternate; KMIA A3054/26, KSFO A5323/26; every row by NOTAM ID against change
 *               list v1.2; card colour and issues unchanged
 *   TC-176-071  D67b negatives on the app path: no added row changes a card colour or an issue; D67a hides stay
 *               hidden; every added row is drawn inside an E2 group
 *   TC-176-072  D67b synthetic: "RWY 09 GLIDESLOPE U/S" unchanged; take-off / climb effects → SIDs, others →
 *               GENERAL; a NOTAM the module already rows is not added twice; a hidden one never; esc() on every row
 *   TC-176-080  D92 OFP Alerts: order unchanged; red until tapped, per flight; the new items (date, crew, NAT,
 *               dispatch) do not reset it; a new import starts red
 *   TC-176-090  release labels: APP_VERSION, CACHE_NAME, manifest.json are 1.11.0 (release)
 *   TC-176-099  fixtures missing → the fixture tests FAIL, never skip
 *
 * Synthetic packages and NOTAMs are labelled "synthetic" (invented identifiers). Fixture tests assert counts,
 * codes, NOTAM IDs and airports only; no crew name, employee number or fixture text is printed or asserted.
 * All times are UTC.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const { loadApp } = require('../harness');
const { findFixtures, readManifest, importFixture, importItems, peek, notamKey } = require('../lib/app-path');
const { MODULES } = require('../../build/build');
const { NOT_BUILT_IN } = require('../lib/not-built-in');   // step 5f: the declared *-next keys (D90, D96)

const ROOT     = path.resolve(__dirname, '..', '..');
const RULES    = path.join(ROOT, 'rules');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RULES, 'manifest.json'), 'utf8'));
const HTML     = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const CHANGES  = require('../rules/data/notam-v1.14.0-obstacle-changes.json');
const plain    = x => JSON.parse(JSON.stringify(x));

const FIX = findFixtures(process.env.PB_FIXTURES || null);
const needFix = () => assert.ok(FIX, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)');
const fixtureTest = (name, fn) => test(name, async () => { needFix(); return fn(); });
let _man = null;
const manifest = () => (_man = _man || readManifest(FIX));
const fkFixtures = () => manifest().fixtures.filter(f => f.format === 'flightkeys');
const nbFixtures = () => manifest().fixtures.filter(f => f.format !== 'flightkeys');
const readItems = fx => JSON.parse(fs.readFileSync(path.join(FIX, fx.files.items), 'utf8'));
const _imp = new Map();
async function imported(fx) {
  if (!_imp.has(fx.id)) _imp.set(fx.id, await importFixture(fx, FIX));
  return _imp.get(fx.id);
}
// The crew record fields the OFP parsers return (a name, a number, a date of the person); none may be stored.
const CREW_RECORD = ['empNum', 'lastName', 'firstName', 'initial', 'name', 'toLndgExpiry'];
const chipProblems = list => plain(list || []).flatMap((c, i) => [
  ...Object.keys(c).filter(k => !['role', 'active', 'displayName', 'isSen'].includes(k)).map(k => `${i}: field ${k}`),
  ...('isSen' in c && c.isSen !== true ? [`${i}: isSen not true`] : []),
  ...(c.displayName ? [`${i}: displayName set`] : []),
  ...(typeof c.role === 'string' && /^[A-Z]{1,3}$/.test(c.role) ? [] : [`${i}: role not a role code`])]);
const opRoles = r => plain((r.crewMembers || []).filter(c => c.role !== 'JS' && c.role !== 'DH').map(c => c.role));

// A one-page synthetic items document whose text lines are `lines` (the app's own line assembly reads it).
function itemsDoc(lines) {
  return { pages: [{ n: 1, width: 600, height: 800, items: lines.map((t, i) => ({ str: t, x: 10, y: 20 + i * 12, w: t.length * 5, h: 10, font: 'f1' })) }] };
}

// ══ TC-176-001 O-116 ════════════════════════════════════════════════════════════

test('TC-176-001 O-116: ofp-flightkeys built in once (DEF-013 integration: v1.1.1), v1.0.0, v1.0.1 and v1.1.0 not; no *-next key or folder; a *-next key is refused', () => {
  const built = fs.readFileSync(path.join(RULES, MANIFEST['ofp-flightkeys'].file), 'utf8');
  const v100 = fs.readFileSync(path.join(ROOT, 'test', 'oracle', 'ofp-flightkeys-v1.0.0.js'), 'utf8');
  const v101 = fs.readFileSync(path.join(ROOT, 'test', 'oracle', 'ofp-flightkeys-v1.0.1.js'), 'utf8');
  const v110 = fs.readFileSync(path.join(ROOT, 'test', 'oracle', 'ofp-flightkeys-v1.1.0.js'), 'utf8');
  assert.equal(MANIFEST['ofp-flightkeys'].version, '1.1.1');
  assert.equal(HTML.split(built).length, 2, 'v1.1.1 once, byte for byte');
  assert.ok(!HTML.includes(v110), 'v1.1.0 not in index.html (DEF-013 integration)');
  assert.ok(!HTML.includes(v100), 'v1.0.0 not in index.html');
  assert.ok(!HTML.includes(v101), 'v1.0.1 not in index.html (step 5f display)');
  // Step 5f (D90, D96): only the declared *-next keys of test/lib/not-built-in.js, none built in
  assert.deepEqual(Object.keys(MANIFEST).filter(k => /-next$/.test(k)), NOT_BUILT_IN, 'no *-next key but the declared ones (D96)');
  assert.deepEqual(fs.readdirSync(RULES).filter(d => /-next$/.test(d)).sort(), NOT_BUILT_IN.slice().sort(), 'no *-next folder but the declared ones');
  assert.equal(MODULES.filter(m => m && m.rule === 'ofp-flightkeys').length, 1);
  assert.equal(MODULES.filter(m => m && /-next$/.test(m.rule)).length, 0, 'no *-next module built in');
  // NEGATIVE: the manifest check of TC-174-002 refuses any other *-next key
  const nextKeys = man => Object.keys(man).filter(k => /-next$/.test(k) && !NOT_BUILT_IN.includes(k));
  assert.deepEqual(nextKeys({ ...MANIFEST, 'nat-rules-next': {} }), ['nat-rules-next']);
});

// ══ TC-176-010 … 012 data path, old save, failed save ═══════════════════════════

// The parser fields parseOFP copies unchanged (the rest: fuel in tonnes, the callsign, the crew chips).
const COPIED = { fltNum: 'fltNum', outZ: 'offFromOFP', etaDest: 'etaDest', origIcao: 'origIcao', destIcao: 'destIcao',
  altData: 'altData', acftType: 'acftType', ballastFuel: 'ballastFuel', togwActual: 'togwActual', zfwActual: 'zfwActual',
  ldgwActual: 'ldgwActual', ddgItems: 'ddgItems', melItems: 'melItems', overflightPerms: 'overflightPerms',
  oeiData: 'oeiData', hasPerishables: 'hasPerishables', slotTime: 'slotTime', catIiIiiApproaches: 'catIiIiiApproaches',
  etopsEntry: 'etopsEntry', etopsExit: 'etopsExit', etopsSpec: 'etopsSpec', natTrack: 'natTrack' };

fixtureTest('TC-176-010 data path, 26 FlightKeys + 30 NavBlue: copied fields = the parser; new fields as declared; no raw text', async () => {
  const fk = fkFixtures(), nb = nbFixtures();
  assert.deepEqual([fk.length, nb.length], [26, 30]);
  for (const fx of [...fk, ...nb]) {
    const imp = await imported(fx), S = imp.S;
    const r = imp.app._ofpParse(imp.rawText, peek(imp.app, 'pdfPages'));
    for (const [k, rk] of Object.entries(COPIED)) {
      const want = r[rk] === undefined ? null : r[rk];
      assert.equal(JSON.stringify(S[k] === undefined ? null : S[k]), JSON.stringify(k === 'natTrack' ? (want || null) : want), `${fx.id}: ${k}`);
    }
    assert.equal(S.date, r.dateStr, `${fx.id}: dated (D57 not triggered)`);
    assert.equal(S.dateEnteredByCrew, false);
    // the new fields: nothing raw (O-107)
    for (const m of S.natMessages) {
      assert.deepEqual(Object.keys(m), ['tmi', 'direction', 'selected', 'track', 'findings'], `${fx.id}: natMessages entry, no message text`);
      for (const f of m.findings) assert.deepEqual(Object.keys(f), ['level', 'field', 'code', 'message']);
    }
    if (S.dispatchContact) assert.deepEqual(Object.keys(S.dispatchContact), ['category']);   // DEF-013: the category only, never the remark
    if (fx.format === 'flightkeys') {
      assert.equal(S.operatingPilots, r.operatingPilots);
      assert.equal(S.natMessages.length, (r.natMessages || []).length, `${fx.id}: every NAT message`);
      assert.equal(JSON.stringify(S.dispatchContact), JSON.stringify(r.dispatchContact ? { category: r.dispatchContact.category } : null));
    } else {
      // NEGATIVE: NavBlue (locked, D47) has no Dispatch contact and no NAT message list
      assert.equal(S.dispatchContact, null, fx.id);
      assert.deepEqual(plain(S.natMessages), [], fx.id);
      assert.equal(S.operatingPilots, (r.crewMembers || []).filter(c => c.role !== 'JS' && c.role !== 'DH').length || null, `${fx.id}: the NavBlue pilot count`);
    }
    // the save carries them (the stored entry = S)
    const saved = imp.app.getFlights()[0].state;
    for (const k of ['operatingPilots', 'dispatchContact', 'natMessages', 'dateEnteredByCrew']) assert.equal(JSON.stringify(saved[k]), JSON.stringify(S[k]), `${fx.id}: ${k} saved`);
  }
});

// A flight as main (before this PR) saved it: no new fields, the OFP's crew records (synthetic names).
function oldSave(imp) {
  const st = plain(imp.S);
  for (const k of ['operatingPilots', 'dispatchContact', 'natMessages', 'dateEnteredByCrew', 'dispatchPrinted']) delete st[k];   // an old save has no 5f flag
  st.crewMembers = [
    { role: 'CA', empNum: '000001', lastName: 'SYNTHETICA', initial: 'A', displayName: 'SYNTHETICA A', active: true, isSen: false },
    { role: 'FO', empNum: '000002', lastName: 'SYNTHETICB', initial: 'B', displayName: 'SYNTHETICB B', active: false, isSen: true },
    { role: 'FO', empNum: '000003', lastName: 'SYNTHETICC', initial: 'C', displayName: 'SYNTHETICC C', active: true, isSen: false },
    { role: 'FO', empNum: '', lastName: 'First Officer', initial: '', displayName: 'First Officer', active: true, manual: true },
  ];
  return { id: 'f_old', fltNum: st.fltNum, date: st.date, at: '2026-11-01T00:00:00.000Z', state: st, raw: '', aptData: plain(imp.airportData) };
}

fixtureTest('TC-176-011 O-113 old save: loads safely; missing items not shown; NAT card as before; crew names removed in the app and in storage', async () => {
  const fx = fkFixtures().find(f => /EBLG-KORD/.test(f.id));
  const entry = oldSave(await imported(fx));
  const app = loadApp({ storageData: { rp_flights: [entry] } });
  assert.doesNotThrow(() => app.loadFlight(app.getFlights()[0]));
  const S = app.S;
  assert.equal(S.operatingPilots, null);
  assert.equal(S.dispatchContact, null);
  assert.deepEqual(plain(S.natMessages), []);
  assert.ok(!/<span class="data-label">Dispatch contact<\/span>/.test(app.renderPreflightPhase()), 'no Dispatch contact row');
  assert.equal(app.sandbox.renderNatTrack(app._natCardTrack(), S.navLog), app.sandbox.renderNatTrack(S.natTrack, S.navLog), 'NAT card as before (the chosen message only)');
  // D62: names gone, roles and on/off kept; the manual chip (role words only) kept as it was
  assert.deepEqual(plain(S.crewMembers).slice(0, 3), [{ role: 'CA', active: true, displayName: '' }, { role: 'FO', active: false, displayName: '', isSen: true }, { role: 'FO', active: true, displayName: '' }], 'F-1: the senior mark kept, no name');
  assert.equal(S.crewMembers[3].manual, true);
  const stored = JSON.stringify(app.getFlights()[0].state.crewMembers);
  assert.ok(!/SYNTHETIC|00000[123]/.test(stored), 'no name or number left in storage');
  assert.ok(!/SYNTHETIC/.test(app.renderInflightRestModule()), 'no name on the rest card');
  // NEGATIVE: a flight saved with anonymous chips is not rewritten
  const app2 = loadApp({ storageData: { rp_flights: [{ ...entry, state: { ...entry.state, crewMembers: [{ role: 'CA', active: true, displayName: '' }] } }] } });
  const writes = [];
  const set = app2.sandbox.localStorage.setItem;
  app2.sandbox.localStorage.setItem = (k, v) => { writes.push(k); return set(k, v); };
  app2.loadFlight(app2.getFlights()[0]);
  assert.ok(!writes.includes('rp_flights'), 'nothing to strip: storage untouched by the load');
});

fixtureTest('TC-176-012 O-107: a failed save shows "Flight not saved – storage full"; a save that works shows nothing', async () => {
  const imp = await imported(fkFixtures()[0]);
  const toasts = [];
  imp.app.sandbox.showToast = (t, m) => toasts.push([t, m]);
  imp.app.saveFlight();
  assert.deepEqual(toasts, [], 'NEGATIVE: saved, no toast');
  imp.app.sandbox.localStorage.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
  assert.doesNotThrow(() => imp.app.saveFlight());
  assert.deepEqual(toasts, [['err', 'Flight not saved – storage full']]);
  assert.equal(imp.app.putFlights([]), false);
});

// ══ TC-176-020 / 021 NAT card (D85) ════════════════════════════════════════════

const rows = (h, d) => (h.match(new RegExp(`id="nat-track-${d}-`, 'g')) || []).length;
const card = app => app.sandbox.renderNatTrack(app._natCardTrack(), app.S.navLog);

fixtureTest('TC-176-020 D85 NAT card: EBLG-KORD East 5 + West 6; single-direction packages; NavBlue 8 / 8 unchanged', async () => {
  const fk = fkFixtures();
  // EBLG-KORD (westbound): both messages published → both directions, the chosen (westbound) message first
  const two = await imported(fk.find(f => /EBLG-KORD/.test(f.id)));
  const h2 = card(two.app);
  assert.deepEqual([rows(h2, 'EAST'), rows(h2, 'WEST')], [5, 6]);
  assert.deepEqual(plain(two.S.natMessages.map(m => [m.direction, m.selected])), [['EAST', false], ['WEST', true]]);
  assert.equal(two.app._natCardTrack().blocks[0].dir, 'WEST', 'the chosen message first');
  // F-2 (O-69): the westbound (chosen) block with its TMI first, then the eastbound under its own TMI
  assert.ok(h2.indexOf('Westbound NAT Tracks\u00a0\u00b7\u00a0TMI\u00a0307') > 0, 'West under TMI 307');
  assert.ok(h2.indexOf('Eastbound NAT Tracks\u00a0\u00b7\u00a0TMI\u00a0308') > 0, 'East under TMI 308');
  assert.ok(h2.indexOf('Westbound NAT Tracks') < h2.indexOf('Eastbound NAT Tracks'), 'West first');
  assert.ok(h2.indexOf('id="nat-track-WEST-') < h2.indexOf('id="nat-track-EAST-'), 'West tracks first');
  assert.match(h2, />TMI\u00a0307<\/span>/, 'the card badge: the chosen message');
  assert.ok(!/No (east|west)bound tracks found|Tracks not readable/.test(h2), 'no "no tracks" text: both directions published and read');
  const before = two.app.sandbox.renderNatTrack(two.S.natTrack, two.S.navLog);
  assert.equal(rows(before, 'EAST'), 0, 'before this PR the eastbound message was not shown');
  // one message only: the other direction says "No … tracks found." (no message has it), as before
  const single = { 'KMIA-EHBK': ['WEST', 6], 'KGSP-EPWA': ['EAST', 5], 'EPPW-KPSM': ['EAST', 10], 'KDOV-ETAR': ['EAST', 10] };
  for (const [k, [dir, n]] of Object.entries(single)) {
    const imp = await imported(fk.find(f => f.id.includes(k)));
    const h = card(imp.app), other = dir === 'EAST' ? 'WEST' : 'EAST';
    assert.deepEqual([rows(h, dir), rows(h, other)], [n, 0], k);
    assert.match(h, new RegExp(`No ${other.toLowerCase()}bound tracks found`), `${k}: the unpublished direction`);
    assert.ok(!new RegExp(`No ${dir.toLowerCase()}bound tracks found`).test(h), `${k}: the published direction`);
    // one message: the card as before, except the direction header carries its TMI and the chosen direction is first
    const tmi = imp.S.natMessages[0].tmi;
    assert.ok(h.includes(`${dir === 'EAST' ? 'East' : 'West'}bound NAT Tracks\u00a0\u00b7\u00a0TMI\u00a0${tmi}`), `${k}: TMI ${tmi} header`);
    assert.equal(h.indexOf(`${dir === 'EAST' ? 'East' : 'West'}bound NAT Tracks`) < h.indexOf(`${other === 'EAST' ? 'East' : 'West'}bound NAT Tracks`), true, `${k}: its direction first`);
    const before = imp.app.sandbox.renderNatTrack(imp.S.natTrack, imp.S.navLog);
    assert.deepEqual([rows(before, dir), rows(before, other)], [n, 0], `${k}: the same track rows as before`);
  }
  // FlightKeys packages without NAT pages: no card
  for (const fx of fk.filter(f => !/EBLG-KORD|KMIA-EHBK|KGSP-EPWA|EPPW-KPSM|KDOV-ETAR/.test(f.id))) {
    const imp = await imported(fx);
    assert.equal(imp.S.natTrack, null, fx.id);
    assert.ok(!/Track Message/.test(imp.app.renderEnroutePhase()), `${fx.id}: no NAT card`);
  }
  // NavBlue: the same card, byte for byte, on every NavBlue package with a NAT card (8)
  let n = 0;
  for (const fx of nbFixtures()) {
    const imp = await imported(fx);
    if (!imp.S.natTrack) continue;
    assert.equal(card(imp.app), imp.app.sandbox.renderNatTrack(imp.S.natTrack, imp.S.navLog), fx.id);
    n++;
  }
  assert.equal(n, 8);
});

// Synthetic track objects (invented fixes), in the shape NatRules.parseNatTrack returns for a FlightKeys message.
const trk = (id, dir, assigned = false) => ({ id, waypoints: ['AAAAA', '50N020W', 'BBBBB'], fl: 'FL340–400', mach: '', valid: '', assigned });
const msgTrack = (dir, ids, extra = {}) => ({ trackType: 'NAT', tmi: '301', flightDir: 'WEST', assignedId: null, rawFallback: '', eastComments: '', westComments: '',
  blocks: ids.length ? [{ dir, tracks: ids.map(i => trk(i, dir, extra.filed === i)) }] : [], ...extra.over });

const WARN_NT = msg => ({ level: 'WARN', field: 'natTrack', code: 'NAT-NO-TRACKS', message: msg });
const alertsOf = app => { const m = app.renderPreflightPhase().match(/OFP Alerts<\/span>([\s\S]*?)<\/span><\/div><\/div>/); return m ? m[1].split('<br>') : []; };

test('TC-176-021 D85 synthetic: a published message with no tracks keeps the card; filed track in its direction only; no message and no tracks → no card', () => {
  const app = loadApp();
  const S = app.S;
  // the chosen westbound message has no readable track and its WARN is on OFP Alerts; an eastbound one has two
  const chosen = msgTrack('WEST', []);
  S.natTrack = chosen;
  S.ofpFindings = [WARN_NT('NO READABLE TRACK IN THE MESSAGE (synthetic)')];
  S.natMessages = [{ tmi: '301', direction: 'WEST', selected: true, track: chosen, findings: [] }, { tmi: '302', direction: 'EAST', selected: false, track: msgTrack('EAST', ['A', 'B']), findings: [] }];
  let h = card(app);
  assert.match(h, /Track Message/, 'the card is shown');
  assert.deepEqual([rows(h, 'EAST'), rows(h, 'WEST')], [2, 0]);
  assert.equal((h.match(/<div style="padding:var\(--sp3\);font-size:14px;color:var\(--label3\)">Tracks not readable \u2013 see OFP Alerts<\/div>/g) || []).length, 1, 'westbound: the O-122 text in the existing style');
  assert.ok(h.indexOf('Tracks not readable') > h.indexOf('Westbound NAT Tracks') && !/No westbound tracks found/.test(h));
  // only the no-track message: the card is still shown (before this PR: hidden)
  S.natMessages = [S.natMessages[0]];
  h = card(app);
  assert.match(h, /Track Message/);
  assert.equal(app.sandbox.renderNatTrack(S.natTrack, S.navLog), '', 'before: no card');
  assert.match(h, /No eastbound tracks found/, 'NEGATIVE: the direction no message has');
  // NEGATIVE: a published direction with tracks shows its tracks, not the text
  S.natMessages = [{ tmi: '301', direction: 'WEST', selected: true, track: msgTrack('WEST', ['A']), findings: [] }];
  S.natTrack = S.natMessages[0].track;
  assert.ok(!/Tracks not readable/.test(card(app)));
  // filed track B: marked in the chosen (westbound) message only, never the eastbound B
  const w = msgTrack('WEST', ['A', 'B'], { filed: 'B', over: { assignedId: 'B' } });
  S.natTrack = w;
  S.natMessages = [{ tmi: '301', direction: 'WEST', selected: true, track: w, findings: [] }, { tmi: '302', direction: 'EAST', selected: false, track: msgTrack('EAST', ['A', 'B']), findings: [] }];
  h = card(app);
  assert.equal((h.match(/ — FILED/g) || []).length, 1, 'one track row marked');
  assert.match(h, /id="nat-track-WEST-B" class="notam-group-body" >/, 'the westbound B is open (filed)');
  assert.match(h, /id="nat-track-EAST-B" class="notam-group-body" hidden>/, 'the eastbound B is not');
  // esc() on the message's values
  S.natMessages[1].track.blocks[0].tracks[0].waypoints = ['<b>X</b>', 'YYYYY'];
  S.natMessages[1].tmi = '<i>';
  assert.ok(!card(app).includes('<b>X</b>') && card(app).includes('&lt;b&gt;X&lt;/b&gt;') && card(app).includes('TMI\u00a0&lt;i&gt;'));
  // NEGATIVE: no published message (NavBlue shape) and no tracks → no card, as before
  S.natMessages = [];
  S.natTrack = msgTrack('WEST', []);
  assert.equal(card(app), '');
});

test('TC-176-022 QA F-3 synthetic: the card\'s own NAT parses on OFP Alerts; "Tracks not readable" only with its line; filed-letter findings of another message not shown', () => {
  const app = loadApp();
  const S = app.S;
  // chosen westbound message with tracks; the eastbound message has none and its own parse gave a WARN
  const w = msgTrack('WEST', ['A', 'B']);
  S.natTrack = w;
  S.ofpFindings = [{ level: 'INFO', field: 'natTrack', code: 'NAT-RANDOM-ROUTE', message: 'NO FILED NAT TRACK LETTER: NO TRACK MARKED (TMI 301)' }];
  const eWarn = WARN_NT('NAT TRACK MESSAGE TMI 302: NO READABLE TRACK (synthetic)');
  S.natMessages = [{ tmi: '301', direction: 'WEST', selected: true, track: w, findings: [] },
                   { tmi: '302', direction: 'EAST', selected: false, track: msgTrack('EAST', []), findings: [eWarn, eWarn] }];
  let h = card(app);
  assert.ok(h.indexOf('Tracks not readable') > h.indexOf('Eastbound NAT Tracks'), 'the eastbound section points to OFP Alerts');
  const list = alertsOf(app);
  assert.deepEqual(list, [eWarn.message, 'NO FILED NAT TRACK LETTER: NO TRACK MARKED (TMI 301)'], 'its WARN on OFP Alerts once, WARNs first, then NAT INFOs');
  // NEGATIVE: the same card with no line for that message → no "Tracks not readable" pointer
  S.natMessages[1].findings = [];
  h = card(app);
  assert.ok(!/Tracks not readable/.test(h), 'no pointer without a line');
  assert.deepEqual(alertsOf(app), ['NO FILED NAT TRACK LETTER: NO TRACK MARKED (TMI 301)']);
  // parseOFP keeps a non-chosen message's own findings, without the filed-letter ones (they are the chosen message's)
  const fake = { tmi: '302', direction: 'EAST', selected: false, text: 'synthetic' };
  app.sandbox.parseNatTrack = (t, o, d, opts) => {
    opts.findings.push(eWarn, { level: 'INFO', field: 'natTrack', code: 'NAT-RANDOM-ROUTE', message: 'NO FILED NAT TRACK LETTER: NO TRACK MARKED (TMI 302)' });
    return msgTrack('EAST', []);
  };
  const out = vm.runInContext('_ofpNatMessages', app.sandbox)({ natMessages: [{ tmi: '301', direction: 'WEST', selected: true }, fake], natTrack: w, origIcao: 'EDDA', destIcao: 'KBBB' });
  assert.deepEqual(plain(out.map(m => m.findings.map(f => f.code))), [[], ['NAT-NO-TRACKS']]);
});

test('TC-176-023 QA F-6 synthetic: a message with an unreadable direction → "Tracks not readable – see OFP Alerts" under the flight\'s direction, not "No … tracks found."', () => {
  const app = loadApp();
  const S = app.S;
  const nd = msgTrack('EAST', [], { over: { flightDir: 'EAST' } });
  S.natTrack = nd;
  S.ofpFindings = [{ level: 'WARN', field: 'natTrack', message: 'NAT message 1 (PDF p9-9): direction (EAST / WEST levels) not readable' }];
  S.natMessages = [{ tmi: '301', direction: null, selected: true, track: nd, findings: [] }];
  const h = card(app);
  assert.ok(h.indexOf('Tracks not readable \u2013 see OFP Alerts') > h.indexOf('Eastbound NAT Tracks'), 'under the flight\'s direction (east)');
  assert.ok(!/No eastbound tracks found/.test(h), 'not "No eastbound tracks found."');
  assert.match(h, /No westbound tracks found/, 'the other direction: no message has it');
  assert.deepEqual(alertsOf(app), [S.ofpFindings[0].message], 'its OFP Alerts line');
  // NEGATIVE: without the WARN line, no pointer
  S.ofpFindings = [];
  assert.ok(!/Tracks not readable/.test(card(app)));
});

// ══ TC-176-030 D57 ═════════════════════════════════════════════════════════════

// A synthetic no-date case: a real FlightKeys package whose parse result has no readable flight date.
async function noDateImport(app) {
  const fx = fkFixtures().find(f => /KGSP-EPWA/.test(f.id));
  const real = app.sandbox._ofpParse;
  app.sandbox._ofpParse = (t, p) => Object.assign(real(t, p), { dateStr: '', flightDateISO: '' });
  return importItems(readItems(fx), 'synthetic-nodate.pdf', { app });
}
const at = ms => class extends Date { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };

fixtureTest('TC-176-030 D57 synthetic: "Operating date needed", pop-up prefilled with today (UTC), forward past 0000Z never back; entered date stored, dated, kept on reload', async () => {
  const app = loadApp({ domModel: true });
  app.fireDomReady();
  app.sandbox.Date = at(Date.UTC(2026, 10, 3, 23, 59));
  const imp = await noDateImport(app);
  const S = imp.S, input = app.document.getElementById('editInput');
  assert.equal(S.date, '');
  assert.equal(peek(app, '_editField'), 'date', 'the date pop-up is open after the import');
  assert.equal(input.value, '03 11 2026', "prefilled with today's UTC date, DD MM YYYY");
  app.renderNote();
  assert.match(app.document.getElementById('briefingStickyHeader').innerHTML, /<span class="flt-date" role="button" tabindex="0" onclick="openEdit\('date'\)">Operating date needed<\/span>/);
  // past 0000Z → the next day; the clock back → never back
  app.sandbox.Date = at(Date.UTC(2026, 10, 4, 0, 1));
  app.openEdit('date');
  assert.equal(input.value, '04 11 2026');
  app.sandbox.Date = at(Date.UTC(2026, 10, 3, 12, 0));
  app.openEdit('date');
  assert.equal(input.value, '04 11 2026', 'never back');
  // NEGATIVE: an entry that is not a date is not taken
  for (const bad of ['31 02 2026', '2026-11-04', 'ABC', '']) {
    app.openEdit('date'); input.value = bad; app.confirmEdit();
    assert.equal(S.date, '', JSON.stringify(bad));
  }
  assert.equal(app._d57Read('4/11/2026'), '2026-11-04');
  // the crew enters the date
  app.openEdit('date'); input.value = '04 11 2026'; app.confirmEdit();
  assert.deepEqual([S.date, S.dateEnteredByCrew, app.sandbox.window._flightDateISO], ['04 NOV 26', true, '2026-11-04']);
  assert.ok(peek(app, '_tl').outMs !== null, 'the timeline is dated (D51)');
  assert.equal(new Date(peek(app, '_tl').outMs).toISOString().slice(0, 10), '2026-11-04');
  app.renderNote();
  assert.match(app.document.getElementById('briefingStickyHeader').innerHTML, />04 NOV 26<\/span>/);
  // one saved flight, with the date; reload keeps it
  const flights = app.getFlights();
  assert.equal(flights.length, 1, 'the same saved flight (not a second one)');
  assert.deepEqual([flights[0].date, flights[0].state.dateEnteredByCrew], ['04 NOV 26', true]);
  const app2 = loadApp({ storageData: { rp_flights: flights } });
  app2.loadFlight(app2.getFlights()[0]);
  assert.deepEqual([app2.S.date, app2.S.dateEnteredByCrew, app2.sandbox.window._flightDateISO], ['04 NOV 26', true, '2026-11-04']);
});

fixtureTest('TC-176-031 D57 NEGATIVE: the 56 dated packages show no prompt and no "Operating date needed"', async () => {
  let n = 0;
  for (const fx of manifest().fixtures) {
    const imp = await imported(fx);
    assert.ok(imp.S.date, fx.id);
    assert.equal(peek(imp.app, '_editField'), null, `${fx.id}: no pop-up`);
    n++;
  }
  assert.equal(n, 56);
});

// O-121: a synthetic no-date flight crossing 0000Z. The entered date is 03 NOV 26; OUT is set to 2300Z on it, so
// the arrival (OUT + its OFP offset) falls after 0000Z, on 04 NOV.
fixtureTest('TC-176-032 O-121 synthetic: entered date + a flight crossing 0000Z → downline times, NOTAM and weather windows on the next day; nothing before the entered date', async () => {
  const app = loadApp({ domModel: true });
  app.fireDomReady();
  const imp = await noDateImport(app);
  const S = imp.S, input = app.document.getElementById('editInput');
  app.openEdit('date'); input.value = '03 11 2026'; app.confirmEdit();
  app.openEdit('outZ'); input.value = '2300'; app.confirmEdit();
  const tl = () => peek(app, '_tl');
  const day = Date.UTC(2026, 10, 3), next = Date.UTC(2026, 10, 4);
  assert.equal(tl().outMs, day + 23 * 3600000, 'OUT 2300Z on the entered date');
  assert.ok(S.destEtaOffsetMins > 60, 'the arrival is after 0000Z');
  assert.equal(tl().etaDestMs, tl().outMs + S.destEtaOffsetMins * 60000, 'IN = OUT + its OFP offset, no wrap');
  assert.ok(tl().etaDestMs >= next, 'IN on the next day');
  for (const a of S.altData) if (typeof tl().alt[a.icao] === 'number' && a.ofpOffsetMins > 60) assert.ok(tl().alt[a.icao] >= next, `${a.icao} on the next day`);
  // NOTAM window at the destination: on its actual date (04 NOV), so a NOTAM in effect only on 03 NOV at that time is hidden
  const inZ = S.etaDest, inMin = +inZ.slice(0, 2) * 60 + +inZ.slice(2, 4);
  const pad = n => String(n).padStart(2, '0');
  const from = m => `${pad(Math.floor(((m + 1440) % 1440) / 60))}${pad(((m + 1440) % 1440) % 60)}`;
  const nb = (id, yymmdd) => `- ${S.destIcao} ${id} ${yymmdd}${from(inMin - 30)}-${yymmdd}${from(inMin + 30)}\nRWY 09 CLSD\n`;
  const dest = app.getAllAirports().find(a => a.role === 'DEST');
  const evalAt = txt => app.evalAirport(dest.icao, dest.eta, txt, '', dest.wxWindow, dest.role, S.acftType);
  assert.equal(evalAt(nb('A0901/26', '261104')).color, 'red', 'a NOTAM on 04 NOV at the arrival time is in effect');
  assert.notEqual(evalAt(nb('A0902/26', '261103')).color, 'red', 'NEGATIVE: the same NOTAM on 03 NOV is not');
  // weather window: the TAF reader gets the arrival's date, 04 NOV
  const seen = [];
  const real = app.sandbox.extractEtaWindow;
  app.sandbox.extractEtaWindow = (...a) => { seen.push(a[3]); return real(...a); };
  app.evalAirport(dest.icao, dest.eta, '', 'TAF ' + dest.icao + ' 031700Z 0318/0424 18010KT 9999 SCT030', dest.wxWindow, dest.role, S.acftType);
  app.sandbox.extractEtaWindow = real;
  assert.deepEqual(seen, ['2026-11-04']);
  // NEGATIVE: an OUT edited back across 0000Z of the entered date is never dated before it. 2300Z → 1200Z → 0010Z
  // keeps 03 NOV (nearest, D51); 0010Z → 2350Z would be 02 NOV 2350Z by the nearest rule: it goes on 03 NOV instead.
  for (const t of ['1200', '0010']) { app.openEdit('outZ'); input.value = t; app.confirmEdit(); }
  assert.equal(tl().outMs, day + 10 * 60000, 'OUT 0010Z on 03 NOV');
  app.openEdit('outZ'); input.value = '2350'; app.confirmEdit();
  assert.equal(new Date(tl().outMs).toISOString().slice(0, 16), '2026-11-03T23:50', 'not 02 NOV (before the entered date)');
  const all = () => [tl().outMs, tl().offMs, tl().etaDestMs, ...Object.values(tl().alt)].filter(x => x !== null);
  assert.ok(all().every(ms => ms >= day), 'no time before the entered date');
  assert.ok(tl().etaDestMs >= next, 'the arrival again on the next day');
  // an IN edited to a time before 0000Z of the entered date is not dated before it either
  vm.runInContext("_tl.etaDestMs = Date.UTC(2026, 10, 3, 0, 30); _tlPlaceEdit('etaDest', '2340');", app.sandbox);
  assert.ok(tl().etaDestMs >= day, 'IN 2340Z near 0030Z 03 NOV: not 02 NOV');
  // NEGATIVE: a flight with an OFP date (no crew date) keeps D51 as before: the same edits go to the nearest day
  const imp2 = await importFixture(fkFixtures().find(f => /KGSP-EPWA/.test(f.id)), FIX);
  const a2 = imp2.app;
  assert.equal(imp2.S.dateEnteredByCrew, false);
  const d2 = Date.parse(a2.sandbox.window._flightDateISO + 'T00:00:00Z');
  vm.runInContext("S.outZ = '0010'; _tlPlaceEdit('outZ', '0010'); S.outZ = '2350'; _tlPlaceEdit('outZ', '2350');", a2.sandbox);
  const o2 = peek(a2, '_tl').outMs;
  assert.equal(o2, d2 - 10 * 60000, 'D51 unchanged on an OFP-dated flight: 2350Z the day before (nearest to 0010Z)');
});

// ══ TC-176-040 D62 ═════════════════════════════════════════════════════════════

fixtureTest('TC-176-040 D62: FK counts 2:4, 3:12, 4:10; anonymous chips; no names in state or save, either format; editable; no count → no chips', async () => {
  const count = {};
  for (const fx of [...fkFixtures(), ...nbFixtures()]) {
    const imp = await imported(fx), S = imp.S;
    if (fx.format === 'flightkeys') count[S.operatingPilots] = (count[S.operatingPilots] || 0) + 1;
    assert.deepEqual(chipProblems(S.crewMembers), [], `${fx.id}: chips carry a role only`);
    assert.equal(S.crewMembers.length, S.operatingPilots || 0, `${fx.id}: one chip per pilot`);
    const r0 = imp.app._ofpParse(imp.rawText, peek(imp.app, 'pdfPages'));
    if (fx.format !== 'flightkeys' || opRoles(r0).length === S.operatingPilots)
      assert.deepEqual(plain(S.crewMembers.map(c => c.role)), opRoles(r0), `${fx.id}: the printed roles (O-124)`);
    const saved = JSON.stringify(imp.app.getFlights()[0].state.crewMembers);
    for (const k of CREW_RECORD) assert.ok(!saved.includes(`"${k}"`), `${fx.id}: no ${k} saved`);
    // the OFP's names are not on the rest card (checked against the parser's own crew records)
    const r = imp.app._ofpParse(imp.rawText, peek(imp.app, 'pdfPages'));
    const names = (r.crewMembers || []).map(c => c.lastName).filter(x => x && x.length > 2);
    const card = imp.app.renderInflightRestModule();
    assert.ok(names.every(nm => !card.includes(nm) && !saved.includes(nm)), `${fx.id}: no crew name shown or saved`);
  }
  assert.deepEqual(count, { 2: 4, 3: 12, 4: 10 });
  // O-124 on NavBlue too: the printed roles of the operating crew, no names (checked above per package)
  // editable by the crew: the count on the existing N-pilot line and chips
  const imp = await importFixture(fkFixtures().find(f => /KORD-RKSI_05NOV26/.test(f.id)), FIX);
  const app = imp.app, S = imp.S;
  assert.deepEqual(plain(S.crewMembers.map(c => c.role)), ['CA', 'FO', 'FO', 'FO'], 'printed roles, no names');
  assert.match(app.renderInflightRestModule(), /<span style="font-weight:700">FO<\/span>\s*<span><\/span>/);
  app.toggleCrewMember(3);
  assert.equal(S.crewMembers.filter(c => c.active).length, 3, '4 → 3');
  assert.equal(S.operatingPilots, 3, 'the count follows the edit');
  S.crewVerified = true;
  assert.match(app.renderInflightRestModule(), /3-pilot confirmed/);
  app.addManualCrew('FO');
  S.crewVerified = true;
  assert.match(app.renderInflightRestModule(), /4-pilot confirmed/, 'added');
  assert.equal(S.operatingPilots, 4);
  assert.equal(app.getFlights()[0].state.operatingPilots, 4, 'the edited count is saved');
  // NEGATIVE: a package without a pilot count → no chips, the existing 2/3/4 picker; not carried over
  const real = app.sandbox._ofpParse;
  app.sandbox._ofpParse = (t, p) => Object.assign(real(t, p), { operatingPilots: null });
  await importItems(readItems(fkFixtures().find(f => /KORD-RKSI_05NOV26/.test(f.id))), 'synthetic-nocount.pdf', { app });
  assert.equal(app.S.operatingPilots, null);
  assert.deepEqual(plain(app.S.crewMembers), [], 'no chips (nothing from the flight before)');
  assert.match(app.renderInflightRestModule(), /No crew parsed — add manually below\.[\s\S]*Add Crew Rest/);
  app.addBulkCrew(3);
  assert.equal(app.S.crewMembers.length, 3, 'the 2/3/4 picker');
  assert.equal(app.S.operatingPilots, 3, 'chips and count follow the picker');
});

fixtureTest('TC-176-041 QA F-1: NavBlue senior mark on the role chip (KORD-RKSI 08APR26), kept after an old save is stripped; FlightKeys never', async () => {
  const nb = nbFixtures().find(f => /KORD-RKSI_08APR26/.test(f.id));
  const imp = await imported(nb);
  const r = imp.app._ofpRulesetParse(imp.rawText);
  const op = r.crewMembers.filter(c => c.role !== 'JS' && c.role !== 'DH');
  const sen = op.map((c, i) => c.isSen ? i : -1).filter(i => i >= 0);
  assert.equal(sen.length, 1, 'one senior designee printed');
  assert.deepEqual(plain(imp.S.crewMembers.map((c, i) => i === sen[0] ? c.isSen === true : !('isSen' in c))), plain(op.map(() => true)), 'the mark on that chip only');
  const card = imp.app.renderInflightRestModule();
  assert.equal((card.match(/★/g) || []).length, 1);
  assert.ok(card.includes(`<span style="font-weight:700">${imp.S.crewMembers[sen[0]].role} ★</span>`), 'role ★ on the chip, as main');
  assert.deepEqual(chipProblems(imp.S.crewMembers), [], 'no name with the mark');
  // NEGATIVE: every other NavBlue package and every FlightKeys package has no mark
  for (const fx of manifest().fixtures.filter(f => f.id !== nb.id)) {
    const i2 = await imported(fx);
    const rr = i2.app._ofpParse(i2.rawText, peek(i2.app, 'pdfPages'));
    const want = fx.format === 'flightkeys' ? 0 : rr.crewMembers.filter(c => c.role !== 'JS' && c.role !== 'DH' && c.isSen).length;
    assert.equal(i2.S.crewMembers.filter(c => c.isSen).length, want, fx.id);
    if (fx.format === 'flightkeys') assert.ok(!/★/.test(i2.app.renderInflightRestModule()), `${fx.id}: no star`);
  }
  // FlightKeys, synthetic: a crew record flagged isSen is not shown as senior ("*" is not seniority, SME-3)
  const fk = loadApp();
  const chips = vm.runInContext('_crewChips', fk.sandbox)(2, [{ role: 'CA', isSen: true }, { role: 'FO' }], false);
  assert.deepEqual(plain(chips), [{ role: 'CA', active: true, displayName: '' }, { role: 'FO', active: true, displayName: '' }]);
  // an old NavBlue save with names: the mark stays, the name goes
  const st = plain(imp.S);
  st.crewMembers = [{ role: 'CA', empNum: '000009', lastName: 'SYNTHETICZ', displayName: 'SYNTHETICZ Z', active: true, isSen: false },
                    { role: 'FO', empNum: '000010', lastName: 'SYNTHETICY', displayName: '★ SEN SYNTHETICY', active: true, isSen: true }];
  const app = loadApp({ storageData: { rp_flights: [{ id: 'f_nb', fltNum: st.fltNum, date: st.date, at: '2026-11-01T00:00:00.000Z', state: st, raw: '', aptData: {} }] } });
  app.loadFlight(app.getFlights()[0]);
  assert.deepEqual(plain(app.S.crewMembers), [{ role: 'CA', active: true, displayName: '' }, { role: 'FO', active: true, displayName: '', isSen: true }]);
  assert.ok(!/SYNTHETIC/.test(JSON.stringify(app.getFlights()[0].state.crewMembers)));
});

// ══ TC-176-050 D89 ═════════════════════════════════════════════════════════════

const UUID = '12345678-90AB-CDEF-1234-567890ABCDEF';
test('TC-176-050 D89: a mixed package is refused with the named error and the crew stays on the import screen; a FlightKeys package opens the flight', async () => {
  const app = loadApp();
  const toasts = [];
  app.sandbox.showToast = (t, m) => toasts.push([t, m]);
  const nav0 = [...app._navStack];
  await importItems(itemsDoc(['synthetic', 'ATLAS AIR BRIEF PAGE 1 OF 2', `FUFI: ${UUID} PAGE 1/9`]), 'synthetic-mixed.pdf', { app });
  assert.ok(toasts.some(([t, m]) => t === 'err' && /OFP format not recognised: both FlightKeys \(FUFI:\) and NavBlue \(BRIEF PAGE\)/.test(m)));
  assert.deepEqual([...app._navStack], nav0, 'no flight screen pushed');
  assert.equal(app.S.fltNum, '');
  assert.deepEqual(plain(app.getFlights()), [], 'nothing saved');
  assert.equal(app.parseOFP(), false);
});

fixtureTest('TC-176-051 D89 NEGATIVE: a FlightKeys and a NavBlue package open the flight screen', async () => {
  for (const fx of [fkFixtures()[0], nbFixtures()[0]]) {
    const imp = await imported(fx);
    assert.equal(imp.app._navStack[imp.app._navStack.length - 1], 'screen-flight', fx.id);
  }
});

// ══ TC-176-060 dispatchContact ═════════════════════════════════════════════════

fixtureTest('TC-176-060 D72 dispatchContact: 26 FK in the OFP Remarks group below DDG (O-152; DEF-013: the remark as printed, SUGGESTION 23, none 3, REQUIRED 0); NavBlue none; escaped', async () => {
  const n = { REQUIRED: 0, SUGGESTION: 0, none: 0 }, forms = {};
  const escH = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  for (const fx of fkFixtures()) {
    const imp = await imported(fx);
    const r = imp.app._ofpParse(imp.rawText, peek(imp.app, 'pdfPages'));
    const h = imp.app.renderPreflightPhase();
    const dep = h.slice(h.indexOf('<div class="subcard-header">Departure</div>'), h.indexOf('OFP Fuel &amp; Weight Summary'));
    const rows = h.match(/<span class="data-label">Dispatch contact<\/span><span class="data-value">[^<]*<\/span>/g) || [];
    // O-152: the row is in the OFP Remarks group (O-153: directly below DDG), never on the Departure subcard
    assert.ok(!dep.includes('Dispatch contact'), `${fx.id}: NEGATIVE: not on the Departure subcard`);
    assert.ok(!/<span class="data-label">Dispatch<\/span>/.test(h), 'NEGATIVE: not the former label');
    const d = r.dispatchContact;
    if (!d) {
      n.none++;
      assert.equal(imp.S.dispatchContact, null, `${fx.id}: nothing saved`);
      assert.equal(rows.length, 0, `${fx.id}: DEF-013 ruling 1: no dispatchContact → no row`);
      continue;
    }
    n[d.category]++;
    forms[d.remark] = (forms[d.remark] || 0) + 1;
    assert.deepEqual(plain(imp.S.dispatchContact), { category: d.category }, `${fx.id}: the category only is saved`);
    assert.equal(imp.app._getOfpTexts().dispatch, d.remark, `${fx.id}: the remark is held outside the save (D107)`);
    assert.deepEqual(rows, [`<span class="data-label">Dispatch contact</span><span class="data-value">${escH(d.remark)}</span>`], `${fx.id}: ruling 2: one row, the remark exactly as the parser gives it`);
    const grp = h.indexOf('<span class="notam-group-label">OFP Remarks</span>');
    assert.ok(grp > h.indexOf('>DDG</span>') && h.slice(grp).includes(rows[0]), `${fx.id}: in the OFP Remarks group (O-123 label)`);
  }
  assert.deepEqual(n, { REQUIRED: 0, SUGGESTION: 23, none: 3 });
  assert.deepEqual(forms, { 'Contact Dispatch with questions': 18, 'Contact Dispatch if you have any questions': 5 });
  for (const fx of nbFixtures()) {
    const imp = await imported(fx);
    assert.ok(!/<span class="data-label">Dispatch contact<\/span>/.test(imp.app.renderPreflightPhase()), `${fx.id}: NavBlue: no row`);
    assert.equal(imp.S.dispatchContact, null, fx.id);
  }
  // SYNTHETIC: the remark is escaped, nothing else is shown with it; the stored PDF missing → "Review OFP Remarks"; a value that is not a category shows no row
  const app = loadApp();
  app.S.dispatchContact = { category: 'SUGGESTION' };
  app._setOfpTexts({ dispatch: '<b>\n&', dispatchCategory: 'SUGGESTION', raim: [] });
  assert.ok(app.renderPreflightPhase().includes('<span class="data-value">&lt;b&gt;\n&amp;</span>') && !app.renderPreflightPhase().includes('<b>'), 'POSITIVE: the remark, escaped');
  app._setOfpTexts({ missing: true });
  assert.ok(app.renderPreflightPhase().includes('<span class="data-value">Review OFP Remarks</span>'), 'POSITIVE: flagged, the stored PDF missing → "Review OFP Remarks"');
  app.S.dispatchContact = null; app._setOfpTexts({ missing: true });
  assert.ok(!app.renderPreflightPhase().includes('Dispatch contact'), 'NEGATIVE: not flagged → no row');
  app._setOfpTexts({ dispatch: null, dispatchCategory: null, raim: [] });
  assert.ok(!app.renderPreflightPhase().includes('Dispatch contact'), 'NEGATIVE: no remark → no row');
});

// ══ TC-176-070 / 071 D67b rows ═════════════════════════════════════════════════

// Every D67b row on the app path, at the OFP times: { fmt, pkg, card, role, icao, id, group, pattern }.
let _d67 = null;
async function d67bAll() {
  if (_d67) return _d67;
  const out = [];
  for (const fx of manifest().fixtures) {
    const imp = await imported(fx), app = imp.app, sb = app.sandbox;
    const orig = sb._d67bRows;
    let cur = null;
    sb._d67bRows = r => (cur = orig(r));
    for (const apt of app.getAllAirports()) {
      const d = imp.airportData[apt.icao] || { notams: '', weather: '' };
      cur = null;
      const st = app.evalAirport(apt.icao, apt.eta, d.notams, d.weather, apt.wxWindow, apt.role, imp.S.acftType);
      if (!cur) continue;
      for (const g of ['sid', 'star', 'general']) for (const it of cur[g]) {
        const ob = sb.NotamRules._obstacleRule(app._d67bRuleText(it.notamRaw), it.fkCategory || null);
        out.push({ fmt: fx.format === 'flightkeys' ? 'FK' : 'NB', pkg: fx.id, card: apt.role === 'ORIG' ? 'DEP' : 'DEST/ALT', role: apt.role,
          icao: apt.icao, id: (notamKey(it.notamRaw) || {}).id || null, group: g, ob, item: it, st });
      }
    }
    sb._d67bRows = orig;
  }
  return (_d67 = out);
}

fixtureTest('TC-176-070 D67b rows: FK 5 + NavBlue 11 departure, 21 + 37 destination / alternate; named NOTAMs; by NOTAM ID against change list v1.2', async () => {
  const all = await d67bAll();
  const by = {};
  for (const r of all) by[`${r.fmt} ${r.card}`] = (by[`${r.fmt} ${r.card}`] || 0) + 1;
  assert.deepEqual(by, { 'FK DEP': 5, 'NB DEP': 11, 'FK DEST/ALT': 21, 'NB DEST/ALT': 37 });
  const grp = {};
  for (const r of all) grp[`${r.card} ${r.group}`] = (grp[`${r.card} ${r.group}`] || 0) + 1;
  assert.deepEqual(grp, { 'DEP general': 14, 'DEP sid': 2, 'DEST/ALT general': 16, 'DEST/ALT sid': 42 });
  // the group comes from the module's pattern code only
  for (const r of all) {
    assert.ok(r.ob.obstacle && r.ob.show, `${r.pkg} ${r.id}: an obstacle NOTAM the module shows`);
    assert.equal(r.group === 'sid', ['TKOF_ODP', 'TKOF_MINIMA', 'CLIMB_GRADIENT', 'CLOSE_IN_OBSTACLE'].includes(r.ob.pattern), `${r.id} ${r.ob.pattern}`);
    assert.ok(r.id, 'every row has a NOTAM ID');
  }
  // the named ones (D67b O-32 note): KMIA A3054/26, KSFO A5323/26 have a row now (GENERAL, approach minima)
  for (const [icao, id] of [['KMIA', 'A3054/26'], ['KSFO', 'A5323/26']]) {
    const rs = all.filter(r => r.icao === icao && r.id === id);
    assert.ok(rs.length >= 1 && rs.every(r => r.group === 'general' && r.ob.pattern === 'MINIMA_VALUE'), `${icao} ${id}`);
  }
  assert.equal(all.filter(r => r.id === 'F1556/26').length, 0, 'ZSPD F1556/26: not shown at the OFP times on the app path (no row to add)');
  // change list v1.2: every row is a change-list entry (group U: LTFM B0812/26, B0651/26) or a NOTAM outside it, which
  // v1.13.0 and v1.14.0 both show for a stated effect or other content (O-32, the change list's closing statement)
  const listed = r => CHANGES.entries.filter(e => e.pkg === r.pkg && e.id === r.id);
  const inList = all.filter(r => listed(r).length);
  assert.deepEqual(inList.map(r => `${r.icao} ${r.id} ${listed(r).map(e => e.group).join('/')}`).sort(), ['LTFM B0651/26 U', 'LTFM B0812/26 U']);
  for (const r of all.filter(x => !listed(x).length)) assert.ok(['EFFECT', 'OTHER'].includes(r.ob.group), `${r.pkg} ${r.id}: outside the list → an effect or other content`);
  console.log('TC-176-070 rows: ' + all.map(r => `${r.card} ${r.icao} ${r.id} ${r.group.toUpperCase()}`).join('; '));
  // the card colour and the issues are the module's: only the rows are added
  for (const r of all.slice(0, 10)) {
    const ids = new Set([...(r.st.sidIssues || []), ...(r.st.starIssues || []), ...[...r.st.rwyGroups.values()].flatMap(g => g.items)]);
    assert.ok(ids.has(r.item), `${r.id}: the row is on the card`);
  }
});

fixtureTest('TC-176-071 D67b negatives: no added row changes a card colour or issue; D67a hides stay hidden; rows only in E2 groups', async () => {
  const all = await d67bAll();
  const seen = new Set();
  for (const r of all) {
    const key = `${r.pkg} ${r.icao} ${r.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const imp = await imported(manifest().fixtures.find(f => f.id === r.pkg)), app = imp.app;
    const apt = app.getAllAirports().find(a => a.icao === r.icao && a.role === r.role);
    const d = imp.airportData[apt.icao];
    const orig = app.sandbox._d67bRows;
    app.sandbox._d67bRows = () => ({ sid: [], star: [], general: [] });
    const off = app.evalAirport(apt.icao, apt.eta, d.notams, d.weather, apt.wxWindow, apt.role, imp.S.acftType);
    app.sandbox._d67bRows = orig;
    const on = app.evalAirport(apt.icao, apt.eta, d.notams, d.weather, apt.wxWindow, apt.role, imp.S.acftType);
    assert.equal(on.color, off.color, `${key}: card colour unchanged`);
    assert.deepEqual(plain(on.issues), plain(off.issues), `${key}: issues unchanged`);
    // the rendered card: the module's rows plus the added ones, all inside notam groups
    const h = app.renderAptIssues(on);
    for (const x of all.filter(y => `${y.pkg} ${y.icao} ${y.role}` === key)) {
      const lbl = app.sandbox.esc(x.item.rowLabel);
      assert.ok(h.includes(`<span class="notam-item-label">${lbl}</span>`), `${key} ${x.id}: a row`);
    }
    assert.ok(app.renderAptIssues(off).length < h.length);
  }
  // D67a hides stay hidden: ETAR P2531/26 (obstacle lights out) is neither an issue nor a row
  const etar = all.filter(r => r.id === 'P2531/26');
  assert.equal(etar.length, 0);
});

test('TC-176-072 D67b synthetic: "RWY 09 GLIDESLOPE U/S" unchanged; take-off / climb → SIDs, others → GENERAL; hidden stays hidden; esc() on the row', () => {
  const app = loadApp();
  // synthetic NavBlue NOTAMs (invented airport KAAA), dated across the fixed clock's day
  const H = id => `- KAAA ${id} 2610010000-2612312359\n`;
  const nt = (id, body) => H(id) + body + '\n';
  const ev = (txt, role) => app.evalAirport('KAAA', '1200', txt, '', null, role, 'B744');
  const res = (txt, role) => app.evalNotams(app._splitNotams(txt), role, 720, null, '2026-10-30', null);
  const rowsOf = r => [...r.sidIssues, ...r.starIssues, ...[...r.rwyGroups.values()].flatMap(g => g.items)];
  // NEGATIVE: the plain glideslope NOTAM is no obstacle NOTAM: the module's runway row only, nothing added
  const gs = nt('A0001/26', 'RWY 09 GLIDESLOPE U/S');
  const r0 = ev(gs, 'DEST');
  assert.deepEqual(plain(app._d67bRows(res(gs, 'DEST'))), { sid: [], star: [], general: [] });
  assert.deepEqual([...r0.rwyGroups.keys()], ['RWY-09']);
  assert.equal(rowsOf(r0).length, 1, 'one row');
  // POSITIVE: shown obstacle NOTAMs the module gave no row (slot 7) → SIDs (take-off / climb) or GENERAL (others)
  const cases = [
    ['DEST', nt('A0002/26', 'OBST TOWER 900FT AMSL. MINIMUM CLIMB OF 350FT PER NM REQUIRED <B>X</B>'), 'sid', 'CLIMB_GRADIENT'],
    ['DEST', nt('A0003/26', 'OBST TOWER 900FT AMSL. ODP AMENDED <B>X</B>'), 'sid', 'TKOF_ODP'],
    ['ORIG', nt('A0004/26', 'CLOSE-IN OBST <B>X</B> TREES 40FT AGL'), 'sid', 'CLOSE_IN_OBSTACLE'],
    ['ORIG', nt('A0005/26', 'OBST TOWER 900FT AMSL. CIRCLING CAT C/D NA <B>X</B>'), 'general', 'NOT_AUTHORISED'],
  ];
  for (const [role, txt, group, pattern] of cases) {
    const r = res(txt, role);
    const shown = r.issues.filter(i => i.level !== 'green');
    assert.equal(shown.length, 1);
    assert.equal(shown[0].slot, 7, 'no card row from the module');
    assert.equal(app.sandbox.NotamRules._obstacleRule(app._d67bRuleText(shown[0].notamRaw), null).pattern, pattern);
    const add = app._d67bRows(r);
    assert.deepEqual(['sid', 'star', 'general'].map(g => add[g].length), ['sid', 'star', 'general'].map(g => (g === group ? 1 : 0)), `${role} ${pattern}`);
    const st = ev(txt, role);
    assert.equal(rowsOf(st).length, 1, `${pattern}: a row on the card`);
    assert.equal(group === 'sid' ? st.sidIssues.length : st.rwyGroups.get('GENERAL').items.length, 1);
    const h = app.renderAptIssues(st);
    assert.ok(!h.includes('<B>X</B>') && h.includes('&lt;B&gt;X&lt;/B&gt;'), `${pattern}: esc() on the row`);
    assert.ok(group !== 'sid' || /<span class="notam-group-label">SIDs<\/span>/.test(h), 'in the SIDs group');
  }
  // the same take-off NOTAM at a destination, where the module already gives it a row → kept, not added twice
  const close = nt('A0006/26', 'CLOSE-IN OBST TREES 40FT AGL');
  assert.equal(res(close, 'DEST').issues[0].slot, 4);
  assert.deepEqual(plain(app._d67bRows(res(close, 'DEST'))), { sid: [], star: [], general: [] });
  assert.equal(rowsOf(ev(close, 'DEST')).length, 1);
  // NEGATIVE (D67a O-22): a hidden obstacle NOTAM (a height near a runway) is never added
  const hid = nt('A0007/26', 'OBST CRANE 120FT AGL 0.5NM E APCH END RWY 27');
  assert.equal(res(hid, 'DEST').issues.filter(i => i.level !== 'green').length, 0);
  assert.equal(rowsOf(ev(hid, 'DEST')).length, 0);
});

// ══ TC-176-080 OFP Alerts (D92) ════════════════════════════════════════════════

const alertsTitle = h => { const m = h.match(/<span class="callout-title( nt-red)?">OFP Alerts<\/span>/); return m ? (m[1] ? 'red' : 'normal') : null; };

fixtureTest('TC-176-080 D92 OFP Alerts: order unchanged; red until tapped, per flight; the new items do not reset it; a new import starts red', async () => {
  const fx = fkFixtures().find(f => /EBLG-KORD/.test(f.id));
  const imp = await importFixture(fx, FIX), app = imp.app, S = imp.S;
  const shown = app._ofpShownFindings(S.ofpFindings);
  const lv = plain(shown.map(f => f.level));
  assert.deepEqual(lv, [...lv].sort((a, b) => (a === 'WARN' ? 0 : 1) - (b === 'WARN' ? 0 : 1)), 'every WARN first, then the NAT INFOs');
  assert.equal(alertsTitle(app.renderPreflightPhase()), 'red');
  app.ofpAlertsSelect();
  assert.equal(alertsTitle(app.renderPreflightPhase()), 'normal');
  // the new items of this PR: crew chips, the NAT card, the dispatch row, a date entry, a save → still normal
  app.toggleCrewMember(3);
  app.renderEnroutePhase();
  vm.runInContext("_d57Set('2026-11-03')", app.sandbox);
  app.saveFlight();
  assert.equal(S.ofpAlertsSeen, true);
  assert.equal(alertsTitle(app.renderPreflightPhase()), 'normal');
  // per flight: reload keeps it; a new import starts red
  const app2 = loadApp({ storageData: { rp_flights: app.getFlights() } });
  app2.loadFlight(app2.getFlights()[0]);
  assert.equal(alertsTitle(app2.renderPreflightPhase()), 'normal');
  await importItems(readItems(fx), 'again.pdf', { app: app2 });
  assert.equal(alertsTitle(app2.renderPreflightPhase()), 'red');
});

// ══ TC-176-090 / 099 ═══════════════════════════════════════════════════════════

test('TC-176-090 release labels (1.11.0 release): APP_VERSION, CACHE_NAME, manifest.json 1.11.0', () => {
  assert.match(HTML, /const APP_VERSION = '1\.11\.0';/);
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /const CACHE_NAME\s*=\s*'pb-v1\.11\.0';/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version, '1.11.0');
});

test('TC-176-099 fixtures missing → the fixture tests FAIL, never skip', () => {
  assert.equal(findFixtures(path.join(ROOT, 'no-such-dir')) === path.join(ROOT, 'no-such-dir'), false);
  assert.ok(FIX, 'the fixtures are available in this run');
});
