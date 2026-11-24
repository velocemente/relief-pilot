'use strict';
/**
 * TC-179 — step 5e-3 display (Exec answers O-152 ... O-159, the UI changes approved for rule 3).
 * Each test has a positive and a negative check. Fixture tests assert counts, codes, ICAOs and labels only; no crew
 * name, employee number or fixture text is printed or asserted. The synthetic input is test/synthetic/ (invented).
 *
 *   (Step 5f display, O-175: the Dispatch contact row shows the printed Contact Dispatch text(s), held outside the save
 *   (_ofpTexts, D107); the synthetic cases set that text with the flag; TC-182 has the step 5f cases.)
 *   TC-179-010  O-152 / O-153  the Dispatch contact row and the Security message(s) are in the OFP Remarks group, which
 *               sits directly below the DDG subsection of the Preflight card's NOTES; content unchanged; NEGATIVE: not
 *               on the Departure subcard any more; no content → no group; escaped
 *   TC-179-012  O-164  the OFP Remarks group starts OPEN when it holds a Security message or a Dispatch contact labelled
 *               REQUIRED, otherwise collapsed; the crew can collapse and expand it; an old save (none of the fields)
 *               has no group; NEGATIVE: IF QUESTIONS alone, records alone → collapsed
 *   TC-179-020  O-154  the OFP Alerts callout is in NOTES under the airport status (above DDG); red until tapped, stored
 *               per flight, survives a reload, a re-import starts red again, no list → no title (synthetic D79 input)
 *   TC-179-030  O-155  Company Remarks is collapsed by default and opens by the crew: the group pattern of the runway
 *               and general NOTAM groups (hidden body, .notam-chev, toggleNotamGroup)
 *   TC-179-040  O-156 / O-161  the chevron on the airport ID row opens / closes ALL display groups and sub-groups of the
 *               card; a single NOTAM's raw text stays closed; the NOTAM / WX paste boxes behave as in main (flipped by
 *               their own state, not by the groups); NEGATIVE: a group header toggles only its group
 *   TC-179-070  O-166  rule 6 (CAT II/III): a departure-airport CAT II/III restriction is in that airport's Company Remarks
 *               group, collapsed by default, revealed on tap, and shown nowhere else (Exec-decided hide)
 *   TC-179-050  O-157 / O-158  "Weather" then "NOTAMS" (no "RAW"), content as printed; Remarks Weather, FIR groups and
 *               "Other briefing airports" unchanged
 *   TC-179-060  O-159  the D79 warning is on the row of the TMI it names in the NAT Track subsection, same text, and
 *               still on OFP Alerts; NEGATIVE: letter printed → no warning; other NAT warnings not on the card
 *
 * All times are UTC.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const { loadApp } = require('../harness');
const { findFixtures, readManifest, importFixture, peek } = require('../lib/app-path');

const ROOT = path.resolve(__dirname, '..', '..');
const SYN  = path.join(ROOT, 'test', 'synthetic', 'SYNTHETIC-o68-filed-nat-not-in-message.txt');
const plain = x => JSON.parse(JSON.stringify(x));
const J = JSON.stringify;
const run = (app, expr) => vm.runInContext(expr, app.sandbox);
const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const D79 = (l, tmi, dir) => `FILED NAT ${l} NOT IN TRACK MESSAGE TMI ${tmi} (${dir}) – CHECK OCEANIC CLEARANCE`;

const FIX = findFixtures(process.env.PB_FIXTURES || null);
const fixtureTest = (name, fn) => test(name, async () => { assert.ok(FIX, 'fixtures not found (set PB_FIXTURES or clone pilotbrief-fixtures beside the repo)'); return fn(); });
let _man = null;
const manifest = () => (_man = _man || readManifest(FIX));
const fkFixtures = () => manifest().fixtures.filter(f => f.format === 'flightkeys');
const nbFixtures = () => manifest().fixtures.filter(f => f.format !== 'flightkeys');
const _imp = new Map();
async function imported(fx) {
  if (!_imp.has(fx.id)) _imp.set(fx.id, await importFixture(fx, FIX));
  return _imp.get(fx.id);
}

// The import screen's text box (#manualText) holds the pasted text (as TC-178).
function pasteInto(app, text) {
  const doc = app.sandbox.document;
  app.sandbox.document = new Proxy(doc, { get: (t, p) => (p === 'getElementById' ? (id => (id === 'manualText' ? { value: text } : t.getElementById(id))) : t[p]) });
}
function pasted(text, app) {
  app = app || loadApp();
  pasteInto(app, text);
  app.importManual();
  return app;
}
const alertsTitle = h => { const m = h.match(/<span class="callout-title( nt-red)?">OFP Alerts<\/span>/); return m ? (m[1] ? 'red' : 'normal') : null; };
const alertLines = h => { const m = h.match(/<div class="section"><div class="callout"[^>]*>[\s\S]*?<span class="callout-title[^"]*"[^>]*>OFP Alerts<\/span>([\s\S]*?)<\/span><\/div><\/div>/); return m ? m[1].split('<br>').map(unesc) : []; };

// ── A small document model for the airport card: the harness stubs the DOM, so the card's HTML is parsed here into
// elements with the few members the toggle code uses (attributes, classList, nextElementSibling, querySelector[All]).
function parseDom(html) {
  const mk = (tag, attrs) => ({
    tagName: tag.toUpperCase(), attrs, children: [], parent: null, style: {},
    get nextElementSibling() { const i = this.parent.children.indexOf(this); return this.parent.children[i + 1] || null; },
    getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; },
    hasAttribute(n) { return n in this.attrs; },
    setAttribute(n, v) { this.attrs[n] = v; },
    removeAttribute(n) { delete this.attrs[n]; },
    get classList() {
      const el = this, list = () => (el.attrs.class || '').split(/\s+/).filter(Boolean);
      return { contains: c => list().includes(c), toggle(c, force) { const on = force === undefined ? !list().includes(c) : !!force; el.attrs.class = list().filter(x => x !== c).concat(on ? [c] : []).join(' '); return on; } };
    },
    all() { return this.children.flatMap(c => [c, ...c.all()]); },
    querySelectorAll(sel) { const cs = sel.split(',').map(x => x.trim().replace(/^\./, '')); return this.all().filter(e => cs.some(c => e.classList.contains(c))); },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
  });
  const root = mk('root', {});
  let cur = root;
  const re = /<(\/)?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*(\/)?>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) { cur = cur.parent || root; continue; }
    const attrs = {};
    for (const a of m[3].matchAll(/\s([a-zA-Z-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] === undefined ? '' : a[2];
    const el = mk(m[2], attrs);
    el.parent = cur; cur.children.push(el);
    if (!m[4] && !/^(path|br|circle|input)$/i.test(m[2])) cur = el;
  }
  return root;
}

// ══ TC-179-010 O-152 / O-153 ═══════════════════════════════════════════════════════
const ROW_D = l => `<div class="data-row"><span class="data-label">Dispatch contact</span><span class="data-value">${l}</span></div>`;
const ROW_S = t => `<span class="notes-sub-header">Security</span><span class="notes-sub-body">${t}</span>`;   // DEF-014: NOTES text
const GROUP_HDR = '<div class="notam-groups"><div class="notam-group"><div class="notam-group-hdr" onclick="toggleNotamGroup(this)"><span class="notam-group-label">OFP Remarks</span>';
// DEF-013: the row's value is the label (REQUIRED / IF QUESTIONS); the printed Contact Dispatch text (synthetic here) is never shown.
const DTXT = 'SYNTHETIC CONTACT DISPATCH LINE';
const escH = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const REMARK = t => `<span class="notes-sub-body">${t}</span>`;   // DEF-014: NOTES text
const dispatch = (app, dc, text = DTXT) => { app.S.dispatchContact = dc; app._setOfpTexts(dc ? { dispatch: text, raim: [] } : null); };

test('TC-179-010 O-152 / O-153 (synthetic): Dispatch contact and Security rows are in the OFP Remarks group, directly below DDG; content unchanged; none on the Departure subcard', () => {
  const app = loadApp();
  dispatch(app, { label: 'REQUIRED' });
  app.S.securityMessages = ['SYNTHETIC SECURITY LINE 1\nSYNTHETIC <LINE> 2'];
  app.S.ofpRemarks = [{ category: 'pcf', text: 'SYNTHETIC PCF REMARK' }];
  let h = app.renderPreflightPhase();
  // the group is directly below the DDG subsection: after its empty marker, before the next subsection or the Notes pad
  const ddg = h.indexOf('<span class="notes-sub-header">DDG</span>');
  assert.ok(ddg > 0);
  assert.ok(h.slice(ddg).startsWith('<span class="notes-sub-header">DDG</span><span class="notes-sub-body notes-sub-empty">—</span>' + GROUP_HDR), 'no DDG items: the group follows DDG directly');
  const g = h.slice(h.indexOf(GROUP_HDR));
  // content unchanged: the two row markups as before, then the printed records; the group is open (O-164: Security + REQUIRED)
  const body = g.slice(g.indexOf('<div class="notam-group-body"'), g.indexOf('<span class="notes-sub-header">Notes</span>'));
  assert.ok(body.startsWith('<div class="notam-group-body"><div class="data-table data-table-lg">' + ROW_D('REQUIRED') + '</div>' + REMARK('SYNTHETIC PCF REMARK') + ROW_S('SYNTHETIC SECURITY LINE 1<br>SYNTHETIC &lt;LINE&gt; 2')), 'Dispatch, the records, then Security last (O-185 option b; line breaks kept, escaped)');
  // DEF-014 (Exec rulings): NOTES text, no status ball, no monospace row; NEGATIVE: not the rejected remark item nor a data row
  assert.ok(!/notam-dot|notam-item/.test(body), 'no status ball, no remark item');
  assert.ok(!/data-value">SYNTHETIC/.test(body) && !h.includes('data-label">Security<'), 'the Security message is not a data row');
  // the inline bodies never run together: a body that follows a body is separated by <br>; a header starts its own line
  app.S.securityMessages = ['SYNTHETIC SEC A', 'SYNTHETIC SEC B'];
  app.S.ofpRemarks = [{ category: 'pcf', text: 'SYNTHETIC R1' }, { category: 'extraFuel', text: 'SYNTHETIC R2\nSYNTHETIC R2 LINE 2' }];
  const _b = app.renderPreflightPhase();
  assert.ok(_b.includes(ROW_D('REQUIRED') + '</div>' + REMARK('SYNTHETIC R1') + '<br>' + REMARK('SYNTHETIC R2<br>SYNTHETIC R2 LINE 2') + ROW_S('SYNTHETIC SEC A') + ROW_S('SYNTHETIC SEC B')), 'order kept; every entry on its own line; Security last');
  assert.ok(_b.indexOf('SYNTHETIC R2 LINE 2') < _b.indexOf('notes-sub-header">Security<'), 'NEGATIVE: no Security message before an entry');
  app.S.securityMessages = ['SYNTHETIC SECURITY LINE 1\nSYNTHETIC <LINE> 2'];
  app.S.ofpRemarks = [{ category: 'pcf', text: 'SYNTHETIC PCF REMARK' }];
  // NEGATIVE: nothing of it on the Departure subcard any more
  const dep = h.slice(h.indexOf('<div class="subcard-header">Departure</div>'), h.indexOf('OFP Fuel &amp; Weight Summary'));
  assert.ok(!dep.includes('Dispatch contact') && !dep.includes('notes-sub-header">Security<') && !dep.includes('OFP Remarks'), 'not on the Departure subcard');
  assert.equal(h.split('data-label">Dispatch contact<').length - 1, 1, 'shown once');
  // with DDG items the group still follows the DDG list directly
  app.S.ddgItems = [{ code: '21-31-01', desc: 'SYNTHETIC ITEM', tlr: '' }];
  h = app.renderPreflightPhase();
  const list = h.slice(h.indexOf('<div class="ddg-list">'));
  assert.ok(list.indexOf(GROUP_HDR) > list.indexOf('SYNTHETIC ITEM') && !/notes-sub-header/.test(list.slice(0, list.indexOf(GROUP_HDR))), 'after the DDG list, no other subsection in between');
  // each part alone keeps the group; no part → no group (NEGATIVE)
  app.S.securityMessages = []; app.S.ofpRemarks = [];
  assert.ok(app.renderPreflightPhase().includes(GROUP_HDR), 'the Dispatch contact row alone');
  dispatch(app, null); app.S.securityMessages = ['', null, 'ONLY SECURITY']; app.S.ofpRemarks = [{ text: '' }];
  h = app.renderPreflightPhase();
  assert.ok(h.includes(GROUP_HDR) && h.includes(ROW_S('ONLY SECURITY')) && !h.includes('Dispatch contact'), 'the Security row alone; empty entries are skipped');
  assert.equal(h.split('notes-sub-header">Security<').length - 1, 1);
  app.S.securityMessages = []; app.S.ofpRemarks = [];
  h = app.renderPreflightPhase();
  assert.ok(!h.includes('OFP Remarks') && !h.includes('Dispatch contact'), 'nothing to show: no group');
  // DEF-013: a value that is not a label shows no row, and the printed text is never shown; DEF-014: a remark is escaped, line by line
  dispatch(app, { label: '<b>' }, '<b>\nLINE 2');
  assert.ok(app.renderPreflightPhase().includes(ROW_D('Review OFP')) && !app.renderPreflightPhase().includes('LINE 2') && !app.renderPreflightPhase().includes('<b>'), 'not a label: "Review OFP", no printed text');
  dispatch(app, null); app.S.ofpRemarks = [{ text: '<b>\nLINE 2' }];
  assert.ok(app.renderPreflightPhase().includes(REMARK('&lt;b&gt;<br>LINE 2')), 'esc() on every line of a remark');
  app.S.ofpRemarks = [];
  // other phases do not show the group
  dispatch(app, { label: 'REQUIRED' });
  assert.ok(!/OFP Remarks/.test(app.renderEnroutePhase()) && !/Dispatch contact/.test(app.renderEnroutePhase()));
});

fixtureTest('TC-179-011 O-152 / O-153: the 26 FlightKeys packages: the Dispatch row and every Security message in the OFP Remarks group below DDG; NavBlue: no group', async () => {
  let withSecurity = 0, openN = 0;
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), h = imp.app.renderPreflightPhase();
    const at = h.indexOf(GROUP_HDR);
    assert.ok(at > h.indexOf('>DDG</span>'), `${fx.id}: the group is below DDG`);
    const end = h.indexOf('</div></div></div>', at);   // the group's own end: body, group, groups
    const g = h.slice(at, end < 0 ? h.length : end + 6);
    assert.ok(g.includes(ROW_D(imp.S.dispatchContact.label)), `${fx.id}: Dispatch contact in the group (DEF-013: the label, one short row)`);
    assert.ok(!g.includes(escH(imp.app._getOfpTexts().dispatch.split('\n')[0])), `${fx.id}: NEGATIVE: not the printed text`);
    const sec = (imp.S.securityMessages || []).filter(Boolean);
    assert.equal(g.split('notes-sub-header">Security<').length - 1, sec.length, `${fx.id}: every Security message in the group`);
    assert.equal(h.split('notes-sub-header">Security<').length - 1, sec.length, `${fx.id}: none elsewhere on the card`);
    if (sec.length) withSecurity++;
    // O-164 / O-181: open when a Security message or REQUIRED; O-179 (step 5f): or the advisory flag; else collapsed
    const open = sec.length > 0 || imp.S.dispatchContact.label === 'REQUIRED' || imp.S.ofpRemarksOpen === true;
    assert.equal(g.includes('<div class="notam-group-body" hidden>'), !open, `${fx.id}: ${open ? 'open' : 'collapsed'} (O-164)`);
    assert.equal(g.includes('<svg class="notam-chev open"'), open, `${fx.id}: the chevron follows`);
    openN += open ? 1 : 0;
    const dep = h.slice(h.indexOf('<div class="subcard-header">Departure</div>'), h.indexOf('OFP Fuel &amp; Weight Summary'));
    assert.ok(!dep.includes('Dispatch contact') && !dep.includes('notes-sub-header">Security<'), `${fx.id}: not on the Departure subcard`);
  }
  console.log(`TC-179-011: ${fkFixtures().length} FlightKeys packages, ${withSecurity} with a Security message, ${openN} open, ${fkFixtures().length - openN} collapsed`);
  assert.ok(withSecurity > 0, 'the positive case is in the data');
  assert.ok(openN > 0 && openN < fkFixtures().length, 'both cases are in the data: open and collapsed');
  for (const fx of nbFixtures()) assert.ok(!(await imported(fx)).app.renderPreflightPhase().includes('OFP Remarks'), `${fx.id}: NavBlue none`);
});

test('TC-179-012 O-164 (synthetic): the OFP Remarks group opens by default with a Security message or a REQUIRED Dispatch contact, else collapsed; the crew can collapse and expand; an old save', () => {
  const app = loadApp();
  const state = () => {
    const h = app.renderPreflightPhase(), at = h.indexOf(GROUP_HDR);
    if (at < 0) return null;
    const dom = parseDom(h.slice(at, h.indexOf('<span class="notes-sub-header">Notes</span>')));
    const hdr = dom.querySelector('.notam-group-hdr'), body = hdr.nextElementSibling;
    return { hdr, body, open: !body.hasAttribute('hidden'), chevOpen: hdr.querySelector('.notam-chev').classList.contains('open') };
  };
  const set = (dc, sec, rem) => { dispatch(app, dc); app.S.securityMessages = sec; app.S.ofpRemarks = rem; return state(); };
  // POSITIVE: REQUIRED alone, a Security message alone, both: open, the chevron open
  for (const [dc, sec] of [[{ label: 'REQUIRED' }, []], [null, ['SYNTHETIC SECURITY']], [{ label: 'IF QUESTIONS' }, ['SYNTHETIC SECURITY']], [{ label: 'REQUIRED' }, ['SYNTHETIC SECURITY']]]) {
    const st = set(dc, sec, [{ text: 'SYNTHETIC REMARK' }]);
    assert.deepEqual([st.open, st.chevOpen], [true, true], JSON.stringify([dc, sec]));
  }
  // NEGATIVE: IF QUESTIONS alone, the records alone, empty Security entries: collapsed
  for (const [dc, sec, rem] of [[{ label: 'IF QUESTIONS' }, [], []], [{ label: 'IF QUESTIONS' }, ['', null], [{ text: 'SYNTHETIC REMARK' }]], [null, [], [{ text: 'SYNTHETIC REMARK' }]], [{ label: 'required' }, [], []]]) {
    const st = set(dc, sec, rem);
    // a value that is not a label (lower case) leaves nothing to show: no group, which is also not open
    assert.deepEqual(st ? [st.open, st.chevOpen] : [false, false], [false, false], JSON.stringify([dc, sec, rem]));
  }
  // the crew can collapse an open group and expand a collapsed one (the existing handler)
  let st = set({ label: 'REQUIRED' }, [], []);
  assert.equal(st.open, true);
  app.sandbox.toggleNotamGroup(st.hdr);
  assert.ok(st.body.hasAttribute('hidden') && !st.hdr.querySelector('.notam-chev').classList.contains('open'), 'collapsed by the crew');
  app.sandbox.toggleNotamGroup(st.hdr);
  assert.ok(!st.body.hasAttribute('hidden') && st.hdr.querySelector('.notam-chev').classList.contains('open'), 'expanded again');
  st = set({ label: 'IF QUESTIONS' }, [], []);
  app.sandbox.toggleNotamGroup(st.hdr);
  assert.ok(!st.body.hasAttribute('hidden') && st.hdr.querySelector('.notam-chev').classList.contains('open'), 'a collapsed group opens by the crew');
  // an old save: none of the fields → no group, nothing breaks; records only (a save with ofpRemarks) → collapsed
  const old = { id: 'f_1', fltNum: 'GTI0001/01', date: '01 NOV 26', state: { fltNum: 'GTI0001/01', date: '01 NOV 26', origIcao: 'KAAA', destIcao: 'KBBB' }, raw: '', aptData: {} };
  const app2 = loadApp({ storageData: { rp_flights: [old] } });
  assert.doesNotThrow(() => app2.loadFlight(app2.getFlights()[0]));
  let h = app2.renderPreflightPhase();
  assert.ok(!h.includes('OFP Remarks') && !h.includes('Dispatch contact') && !h.includes('notes-sub-header">Security<'), 'an old save: no group');
  const old2 = plain(old); old2.state.ofpRemarks = [{ category: 'pcf', text: 'SYNTHETIC REMARK' }];
  const app3 = loadApp({ storageData: { rp_flights: [old2] } });
  app3.loadFlight(app3.getFlights()[0]);
  h = app3.renderPreflightPhase();
  assert.ok(h.includes(GROUP_HDR) && h.includes('<div class="notam-group-body" hidden>') && !h.includes('<svg class="notam-chev open"'), 'an old save with records only: collapsed');
  const old3 = plain(old); old3.state.securityMessages = ['SYNTHETIC SECURITY'];
  const app4 = loadApp({ storageData: { rp_flights: [old3] } });
  app4.loadFlight(app4.getFlights()[0]);
  assert.ok(app4.renderPreflightPhase().includes('<div class="notam-group-body">' + ROW_S('SYNTHETIC SECURITY')), 'a save with a Security message: open');
});

// ══ TC-179-020 O-154 ═══════════════════════════════════════════════════════════════
test('TC-179-020 O-154 (synthetic D79 input): the OFP Alerts callout is in NOTES above DDG; red until tapped; stored per flight; survives a reload; a re-import starts red; no list → no title', () => {
  const text = fs.readFileSync(SYN, 'utf8');
  const app = pasted(text);
  let h = app.renderPreflightPhase();
  // position: in NOTES, above DDG, and no longer above the Departure subcard
  const at = h.indexOf('<div class="section"><div class="callout" onclick="ofpAlertsSelect()" role="button" aria-label="OFP Alerts">');
  assert.ok(at > h.indexOf('<span class="notes-section-title">NOTES</span>') && at < h.indexOf('<span class="notes-sub-header">DDG</span>'), 'in NOTES, above DDG');
  assert.ok(at > h.indexOf('OFP Fuel &amp; Weight Summary'), 'NEGATIVE: not at the top of the card');
  assert.equal(h.split('class="callout"').length, 2, 'one list');
  assert.ok(alertLines(h).includes(D79('Z', '361', 'WEST')), 'the list is the parser\'s, unchanged');
  // red until the crew taps it (the callout is the tap target, O-98)
  assert.equal(alertsTitle(h), 'red');
  assert.ok(h.slice(at, at + 200).includes('onclick="ofpAlertsSelect()"'));
  app.ofpAlertsSelect();
  assert.equal(app.S.ofpAlertsSeen, true);
  assert.equal(alertsTitle(app.renderPreflightPhase()), 'normal', 'after the tap: the normal colour');
  // stored per flight; the flight reopens normal in another session
  const saved = plain(app.getFlights().find(f => f.fltNum === app.S.fltNum));
  assert.equal(saved.state.ofpAlertsSeen, true, 'saved with the flight');
  const app2 = loadApp({ storageData: { rp_flights: [saved] } });
  app2.loadFlight(app2.getFlights()[0]);
  assert.equal(alertsTitle(app2.renderPreflightPhase()), 'normal', 'survives the reload');
  assert.ok(alertLines(app2.renderPreflightPhase()).includes(D79('Z', '361', 'WEST')));
  // a re-import (same session) starts red again; the old selection is not carried over
  pasted(text, app);
  assert.ok(!('ofpAlertsSeen' in app.S), 'not carried over');
  assert.equal(alertsTitle(app.renderPreflightPhase()), 'red', 'a new import starts red');
  // NEGATIVE: the saved flight before the selection state: red; only a stored true counts
  const before = plain(saved); delete before.state.ofpAlertsSeen;
  const app3 = loadApp({ storageData: { rp_flights: [before] } });
  app3.loadFlight(app3.getFlights()[0]);
  assert.equal(alertsTitle(app3.renderPreflightPhase()), 'red');
  // NEGATIVE: no list → no callout, no title, no handler
  app.S.ofpFindings = [];
  h = app.renderPreflightPhase();
  assert.ok(!h.includes('OFP Alerts') && !h.includes('ofpAlertsSelect') && !h.includes('class="callout"'));
  // the other phases do not show it (it was only on the Preflight card)
  pasted(text, app);
  assert.ok(!app.renderEnroutePhase().includes('OFP Alerts'));
});

fixtureTest('TC-179-021 O-154: the callout is under the airport status rows (FlightKeys package with findings); the list, its order and the red title as before', async () => {
  const fx = fkFixtures().find(f => f.id === 'FK_KDOV-ETAR_03NOV26_pax-nat-random_live');   // WARN + INFO shown
  const imp = await imported(fx), h = imp.app.renderPreflightPhase();
  const at = h.indexOf('<div class="section"><div class="callout"');
  const rows = [...h.matchAll(/<div class="apt-status-row">/g)].map(m => m.index);
  assert.ok(rows.length >= 2, 'airport status rows');
  assert.ok(at > rows[rows.length - 1], 'under the airport status rows');
  assert.ok(at < h.indexOf('<span class="notes-sub-header">DDG</span>'), 'above DDG');
  const shown = imp.app._ofpShownFindings(run(imp.app, '_ofpAlertFindings()')).map(f => f.message);
  assert.deepEqual(alertLines(h), plain(shown), 'the same list, the same order (D92)');
  assert.equal(alertsTitle(h), 'red');
  // NEGATIVE: a package with nothing to show has no callout; neither has a NavBlue package
  const none = fkFixtures().find(f => f.id === 'FK_KCVG-KSEA_04NOV26_pax-catiii_live');
  assert.equal(alertsTitle((await imported(none)).app.renderPreflightPhase()), null);
  assert.equal(alertsTitle((await imported(nbFixtures()[0])).app.renderPreflightPhase()), null);
});

// ══ TC-179-030 O-155 ═══════════════════════════════════════════════════════════════
test('TC-179-030 O-155 (synthetic): Company Remarks is collapsed by default and opens by the crew, as the runway and general NOTAM groups do', () => {
  const app = loadApp();
  run(app, `airportData.XXXX = { notams: '', weather: '', opsNotes: { body: 'SUBJECT: SYNTHETIC ITEM\\nSYNTHETIC LINE' }, remarks: [{ text: 'SYNTHETIC REMARK', subHeading: '' }] }`);
  const h = run(app, `renderAptOpsNotes('XXXX')`);
  const dom = parseDom(h);
  const hdr = dom.querySelector('.notam-group-hdr'), body = hdr.nextElementSibling;
  assert.ok(hdr && body && body.classList.contains('notam-group-body'), 'the group pattern: header, then body');
  assert.ok(body.hasAttribute('hidden'), 'collapsed by default');
  assert.equal(hdr.getAttribute('onclick'), 'toggleNotamGroup(this)', 'the same toggle as the NOTAM groups');
  assert.ok(hdr.querySelector('.notam-chev') && !hdr.querySelector('.notam-chev').classList.contains('open'), 'the group chevron, closed');
  assert.ok(h.includes('Company Remarks') && h.includes('SYNTHETIC REMARK') && h.includes('SYNTHETIC LINE'), 'content unchanged');
  // NEGATIVE: not the earlier mechanism (a class toggled on the wrapper)
  assert.ok(!/collapsed|classList\.toggle|cell-chevron/.test(h));
  // the pattern equals the general NOTAM group's: same classes, same attribute, same chevron
  const gen = run(app, `renderNotamGroups(new Map([['GENERAL', { groupType: 'general', items: [{ level: 'red', label: 'A' }, { level: 'yellow', label: 'B' }] }]]))`);
  const genDom = parseDom(gen), gh = genDom.querySelector('.notam-group-hdr'), gb = gh.nextElementSibling;
  assert.deepEqual([gh.getAttribute('class'), gb.getAttribute('class'), gb.hasAttribute('hidden'), gh.getAttribute('onclick')], [hdr.getAttribute('class'), body.getAttribute('class'), true, hdr.getAttribute('onclick')]);
  // the crew expands it with the existing handler, and collapses it again
  app.sandbox.toggleNotamGroup(hdr);
  assert.ok(!body.hasAttribute('hidden'), 'expanded by the crew');
  assert.ok(hdr.querySelector('.notam-chev').classList.contains('open'));
  app.sandbox.toggleNotamGroup(hdr);
  assert.ok(body.hasAttribute('hidden'));
  // NEGATIVE: no note and no remark → nothing to collapse
  run(app, `airportData.YYYY = { notams: '', weather: '' }`);
  assert.equal(run(app, `renderAptOpsNotes('YYYY')`), '');
});

// ══ TC-179-040 O-156 ═══════════════════════════════════════════════════════════════
fixtureTest('TC-179-040 O-156 / O-161: the chevron on the airport ID row opens / closes ALL display groups and sub-groups; the paste boxes as in main; a group header toggles only its group', async () => {
  // the richest card of the first FlightKeys package: STARs / SIDs, runway groups with sub-groups, Company Remarks, Weather, NOTAMS
  const fx = fkFixtures().find(f => f.id === 'FK_UAAA-EHAM_27OCT26_prototype'), imp = await imported(fx), app = imp.app;
  const icao = 'EHAM';
  const issues = run(app, `(function(){const d=airportData[${J(icao)}]||{notams:'',weather:''};const a=getAllAirports().find(x=>x.icao===${J(icao)});return renderAptIssues(evalAirport(a.icao,a.eta,d.notams,d.weather,a.wxWindow,a.role,S.acftType))})()`);
  const html = `<div class="apt-card section" id="apc-${icao}"><div class="apt-card-header" aria-expanded="false" role="button"></div>`
    + `<div class="apt-issues-list" id="api-${icao}">${issues}</div>${run(app, `renderAptOpsNotes(${J(icao)})`)}${run(app, `renderAptRaw(${J(icao)})`)}`
    + `<div class="apt-inputs" id="api-in-${icao}" style="display:none"></div></div>`;
  const root = parseDom(html), card = root.children[0];
  const byId = {};
  card.all().concat([card]).forEach(e => { if (e.attrs.id) byId[e.attrs.id] = e; });
  const doc = app.sandbox.document;
  app.sandbox.document = new Proxy(doc, { get: (t, p) => (p === 'getElementById' ? (id => byId[id] || t.getElementById(id)) : t[p]) });
  const tap = () => run(app, `toggleAptInputs(${J(icao)})`);
  const hdr = card.querySelector('.apt-card-header'), inputs = byId[`api-in-${icao}`];
  inputs.style.display = 'none';                   // as the stylesheet has it (.apt-inputs { display: none })
  // the card's subsections: every group header and every sub-group header (a header whose body is not a raw NOTAM text)
  const heads = card.querySelectorAll('.notam-group-hdr, .notam-item-hdr').filter(h => h.nextElementSibling && h.nextElementSibling.tagName !== 'PRE');
  const bodies = heads.map(h => h.nextElementSibling);
  assert.ok(heads.length >= 14, `the card has many subsections (${heads.length})`);
  for (const l of ['Company Remarks', 'Weather', 'NOTAMS', 'SIDs', 'General NOTAMs', 'Taxiway NOTAMs', 'RWY 04']) assert.ok(html.includes(l), `the card has ${l}`);
  assert.ok(bodies.filter(b => b.attrs.class && /notam-group-body/.test(b.attrs.class)).length >= 8, 'groups');
  assert.ok(bodies.some(b => b.attrs.style && /padding-left:14px/.test(b.attrs.style)), 'a sub-group inside a runway group');
  const leafRaw = card.all().filter(e => e.tagName === 'PRE' && e.hasAttribute('hidden'));
  assert.ok(leafRaw.length > 0, 'single NOTAM raw texts exist and are closed');
  const closed = () => bodies.filter(b => b.hasAttribute('hidden')).length;
  // default: groups closed (the RAW groups, the runway groups, Company Remarks) except the STARs / SIDs groups; the paste boxes closed
  assert.ok(closed() > 0 && closed() < bodies.length, 'mixed at the start: the STARs / SIDs groups start open');
  assert.equal(inputs.style.display, 'none');
  // tap: ALL groups open; the paste boxes flip as in main; the raw text of a single NOTAM stays closed
  tap();
  assert.equal(closed(), 0, 'every subsection is open');
  assert.equal(inputs.style.display, 'flex', 'the paste boxes flip as in main');
  assert.equal(hdr.getAttribute('aria-expanded'), 'true');
  assert.ok(leafRaw.every(p => p.hasAttribute('hidden')), 'a single NOTAM\'s own raw text stays closed');
  assert.ok(heads.every(h => !h.querySelector('.notam-chev') || h.querySelector('.notam-chev').classList.contains('open')), 'the chevrons follow');
  // tap again: ALL closed (the STARs / SIDs groups too), the paste boxes flip back
  tap();
  assert.equal(closed(), bodies.length, 'every subsection is closed');
  assert.equal(inputs.style.display, 'none');
  assert.equal(hdr.getAttribute('aria-expanded'), 'false');
  assert.ok(heads.every(h => !h.querySelector('.notam-chev') || !h.querySelector('.notam-chev').classList.contains('open')));
  // the crew opened one group by hand: the next chevron tap opens ALL (it does not just close that one)
  app.sandbox.toggleNotamGroup(heads[0]);
  assert.equal(closed(), bodies.length - 1);
  tap();
  assert.equal(closed(), 0, 'all open');
  // O-161: the paste boxes are flipped by their own state (main's code), not by the groups' state
  tap();                                           // (all closed now)
  inputs.style.display = 'flex';                   // the paste boxes opened by themselves
  tap();                                           // the groups open; the paste boxes were open, so they close
  assert.equal(closed(), 0);
  assert.equal(inputs.style.display, 'none', 'main: an open paste box closes on the tap');
  tap();                                           // the groups close; the paste boxes open
  assert.equal(closed(), bodies.length);
  assert.equal(inputs.style.display, 'flex');
  inputs.style.display = 'none';
  // NEGATIVE: a group header toggles only its own group; the card's chevron state and the other groups stay
  const before = bodies.map(b => b.hasAttribute('hidden'));
  app.sandbox.toggleNotamGroup(heads[2]);
  const after = bodies.map(b => b.hasAttribute('hidden'));
  assert.deepEqual(after.map((v, i) => v !== before[i]), after.map((_, i) => i === 2), 'only that group changed');
  assert.equal(hdr.getAttribute('aria-expanded'), 'false', 'the card chevron is untouched');
  assert.equal(inputs.style.display, 'none');
});

// ══ TC-179-050 O-157 / O-158 ═══════════════════════════════════════════════════════
fixtureTest('TC-179-050 O-157 / O-158: airport cards show "Weather" then "NOTAMS" (no "RAW"), content as printed; Remarks Weather, FIR groups and Other briefing airports unchanged', async () => {
  const lab = h => [...h.matchAll(/<span class="notam-group-label">([^<]*)<\/span>/g)].map(m => unesc(m[1]));
  let cards = 0, both = 0, rw = 0;
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), app = imp.app;
    const views = run(app, '_rawViews');
    for (const a of app.getAllAirports()) {
      const l = lab(run(app, `renderAptRaw(${J(a.icao)})`));
      if (!l.length) continue;
      cards++;
      assert.ok(!l.some(x => /^RAW\b/.test(x)), `${fx.id} ${a.icao}: no "RAW" label`);
      assert.deepEqual(l.filter(x => x !== 'Remarks Weather'), ['Weather', 'NOTAMS'], `${fx.id} ${a.icao}: Weather, then NOTAMS`);
      assert.ok(l.indexOf('Weather') < l.indexOf('NOTAMS'));
      if (l.includes('Remarks Weather')) { rw++; assert.equal(l[l.length - 1], 'Remarks Weather', 'Remarks Weather after them'); }
      both++;
      // content unchanged: the text of both groups is the briefing's, as printed
      const v = views.apt[a.icao], h = run(app, `renderAptRaw(${J(a.icao)})`);
      const pres = [...h.matchAll(/<pre class="notam-raw-text">([\s\S]*?)<\/pre>/g)].map(m => unesc(m[1]));
      assert.deepEqual(pres.slice(0, 2), [v.weather, v.notams], `${fx.id} ${a.icao}: Weather text, then NOTAMS text`);
    }
    // the Enroute RAW groups keep their labels
    const e = lab(run(app, 'renderEnrouteRaw()'));
    assert.ok(e.every(x => /^FIR \S+ (NOTAMs|Hazards)$|^Company NOTAMs$|^Other briefing airports$/.test(x)), `${fx.id}: FIR groups and Other briefing airports unchanged`);
  }
  console.log(`TC-179-050: ${cards} cards with Weather before NOTAMS, ${rw} with Remarks Weather`);
  assert.equal(cards, 118);
  assert.equal(both, 118);
  assert.ok(rw > 0, 'the positive Remarks Weather case is in the data');
  // NEGATIVE: the evaluated card rows and a NavBlue card have no such group
  for (const fx of nbFixtures().slice(0, 3)) {
    const imp = await imported(fx);
    for (const a of imp.app.getAllAirports()) assert.equal(run(imp.app, `renderAptRaw(${J(a.icao)})`), '');
  }
});

// ══ TC-179-060 O-159 ═══════════════════════════════════════════════════════════════
test('TC-179-060 O-159 (SYNTHETIC-o68): the D79 warning is also on the TMI row of the NAT Track subsection, same text, and still on OFP Alerts; NEGATIVE: letter printed → none; other NAT warnings not on the card', () => {
  const text = fs.readFileSync(SYN, 'utf8');
  const app = pasted(text);
  const msg = D79('Z', '361', 'WEST');
  const d79 = app.S.ofpFindings.filter(f => f.code === 'NAT-FILED-NOT-IN-MESSAGE');
  assert.deepEqual(plain(d79).map(f => f.message), [msg], 'the parser\'s warning, as before');
  const card = app.renderEnroutePhase();
  const dom = parseDom(card);
  // the row: the Westbound NAT Tracks header, which carries the TMI ID of the message the warning names
  const rows = dom.querySelectorAll('.notam-group-hdr').filter(h => /nat-west-tracks/.test(h.attrs.onclick || ''));
  assert.equal(rows.length, 1);
  const rowHtml = card.slice(card.indexOf('<span class="notam-group-label" style="color:var(--label2);font-size:13px">Westbound NAT Tracks'));
  const label = unesc(rowHtml.slice(0, rowHtml.indexOf('</span></span>') + 7).replace(/<[^>]+>/g, ''));
  assert.equal(label, 'Westbound NAT Tracks · TMI 361 · ' + msg, 'TMI ID and the warning on one row, same text');
  assert.equal(card.split('NOT IN TRACK MESSAGE').length - 1, 1, 'shown once on the card');
  assert.ok(!/Eastbound NAT Tracks[^<]*NOT IN TRACK MESSAGE/.test(card), 'not on the other direction\'s row');
  assert.ok(card.includes('<span class="nt-red">'), 'the existing .nt-red style');
  // it stays on OFP Alerts (D92)
  assert.ok(alertLines(app.renderPreflightPhase()).includes(msg), 'still on OFP Alerts');
  // the card object carries it for the one direction only
  assert.deepEqual(plain(app._natCardTrack().dirWarn), { WEST: [msg] });
  // escaped
  app.S.ofpFindings = [{ level: 'WARN', field: 'natTrack', code: 'NAT-FILED-NOT-IN-MESSAGE', message: 'FILED NAT <b> NOT IN TRACK MESSAGE TMI 361 (WEST) – X' }];
  assert.ok(app.renderEnroutePhase().includes('FILED NAT &lt;b&gt; NOT IN TRACK MESSAGE TMI 361 (WEST) – X'));
  // NEGATIVE: other NAT warnings and infos are not on the card
  app.S.ofpFindings = [
    { level: 'WARN', field: 'natTrack', code: 'NAT-FILED-IGNORED', message: 'OTHER NAT WARNING TMI 361 (WEST)' },
    { level: 'INFO', field: 'natTrack', code: 'NAT-RANDOM-ROUTE', message: 'OTHER NAT INFO' },
    { level: 'WARN', field: 'natTrack', message: 'WARNING WITH NO CODE TMI 361 (WEST)' }];
  assert.ok(!/OTHER NAT|WARNING WITH NO CODE|nt-red/.test(app.renderEnroutePhase()), 'other NAT warnings unchanged: not on the card');
  // NEGATIVE: a D79 naming a TMI that no row shows is not placed on the card
  app.S.ofpFindings = [{ level: 'WARN', field: 'natTrack', code: 'NAT-FILED-NOT-IN-MESSAGE', message: D79('Z', '999', 'WEST') }];
  assert.ok(!/NOT IN TRACK MESSAGE/.test(app.renderEnroutePhase()));
  assert.deepEqual(plain(app._natCardTrack().dirWarn), {});
  // NEGATIVE: the letter is printed in the route → no D79 anywhere, the card as before
  const ok = pasted(text.replace('NATZ', 'NATB'));
  assert.ok(!ok.S.ofpFindings.some(f => f.code === 'NAT-FILED-NOT-IN-MESSAGE'));
  assert.ok(!/NOT IN TRACK MESSAGE|nt-red/.test(ok.renderEnroutePhase()), 'no warning on the card');
  assert.ok(!alertLines(ok.renderPreflightPhase()).some(l => /NOT IN TRACK MESSAGE/.test(l)));
  // a flight saved without natMessages / findings renders as before
  const old = loadApp();
  old.S.natTrack = plain(app.S.natTrack);
  assert.doesNotThrow(() => old.renderEnroutePhase());
});

// ══ TC-179-070 O-166 (rule 6: CAT II/III) ══════════════════════════════════════════
// Exec-decided (O-166, QA F-1): the departure airport's CAT II/III restriction stays inside the collapsed Company Remarks
// group of its card. The restriction text is read from the flight's own state at run time, never written in the test.
fixtureTest('TC-179-070 O-166 rule 6: a departure-airport CAT II/III restriction is in Company Remarks, collapsed by default, revealed on tap, shown nowhere else; NEGATIVE: not on other cards, not for a MEL restriction', async () => {
  const fx = fkFixtures().find(f => f.id === 'FK_KCVG-KSEA_04NOV26_pax-catiii_live');   // the one FlightKeys package whose CAT II/III restriction names its departure airport
  const imp = await imported(fx), app = imp.app, S = imp.S;
  const dep = S.origIcao;
  const restr = plain(S.catIiIiiRestrictions).filter(r => r && r.text && r.airport === dep);
  assert.equal(restr.length, 1, 'the fixture has one CAT II/III restriction for its departure airport');
  const markup = r => r.text.split('\n').map(l => run(app, `esc(${J(l)})`)).join('<br>');   // how the card prints it
  const want = markup(restr[0]);
  assert.ok(want.length > 20, 'a real restriction text');
  // POSITIVE: in the departure card's Company Remarks group, collapsed by default
  const ops = run(app, `renderAptOpsNotes(${J(dep)})`);
  assert.ok(ops.includes('Company Remarks') && ops.includes(want), 'in the Company Remarks group');
  const dom = parseDom(ops), hdr = dom.querySelector('.notam-group-hdr'), body = hdr.nextElementSibling;
  assert.ok(body.hasAttribute('hidden'), 'collapsed by default');
  assert.ok(!hdr.querySelector('.notam-chev').classList.contains('open'));
  assert.ok(ops.indexOf(want) > ops.indexOf('<div class="notam-group-body" hidden>'), 'the text is inside the hidden body');
  // revealed on tap (the existing handler)
  app.sandbox.toggleNotamGroup(hdr);
  assert.ok(!body.hasAttribute('hidden'), 'revealed on tap');
  assert.ok(body.children.length > 0 && ops.slice(ops.indexOf(want) - 200).includes(want));
  // NEGATIVE: shown nowhere else: not on any phase, not in the card's other parts, not on any other card, not in any
  // Descent airport summary (the departure airport has none)
  const others = {
    preflight: app.renderPreflightPhase(), enroute: app.renderEnroutePhase(), descent: run(app, 'renderDescentPhase()'), notes: run(app, 'renderNotesSection()'),
  };
  for (const a of app.getAllAirports()) {
    run(app, `S.descentAirport = ${J(a.icao)}`);
    others['summary:' + a.icao] = run(app, 'renderDescentAirportSummary()');
    others['raw:' + a.icao] = run(app, `renderAptRaw(${J(a.icao)})`);
    others['issues:' + a.icao] = run(app, `(function(){const d=airportData[${J(a.icao)}]||{notams:'',weather:''};const a=getAllAirports().find(x=>x.icao===${J(a.icao)});return renderAptIssues(evalAirport(a.icao,a.eta,d.notams,d.weather,a.wxWindow,a.role,S.acftType))})()`);
    if (a.icao !== dep) others['ops:' + a.icao] = run(app, `renderAptOpsNotes(${J(a.icao)})`);
  }
  assert.ok(app.getAllAirports().length >= 2);
  for (const [k, v] of Object.entries(others)) assert.ok(!v.includes(want), `not shown in ${k.replace(/:.*/, '')}${k.includes(':') ? ' (' + k.split(':')[0] + ')' : ''}`);
  // NEGATIVE: a restriction with no airport (a MEL item's) is on no airport card's Company Remarks
  const mel = fkFixtures().find(f => f.id === 'FK_MKJP-KMIA_03NOV26_caribbean-callsign_live');
  const m = await imported(mel);
  const melR = plain(m.S.catIiIiiRestrictions).filter(r => r && r.text && !r.airport);
  assert.ok(melR.length > 0, 'the MEL-restriction case is in the data');
  for (const a of m.app.getAllAirports()) {
    const o = run(m.app, `renderAptOpsNotes(${J(a.icao)})`);
    for (const r of melR) assert.ok(!o.includes(r.text.split('\n').map(l => run(m.app, `esc(${J(l)})`)).join('<br>')), `${a.icao}: a restriction naming no airport is not on a card`);
  }
  // NEGATIVE: without the flight's restriction nothing is shown on the card
  run(app, 'S.catIiIiiRestrictions = []');
  assert.ok(!run(app, `renderAptOpsNotes(${J(dep)})`).includes(want), 'no restriction in state: none shown');
});

// ══ DEF-011..014 FlightKeys Preflight card = the NavBlue layout ═════════════════════════════════════
fixtureTest('DEF-013 / DEF-014: the OFP Remarks group on the 26 FlightKeys packages holds no RAW block or monospace box, the Dispatch row is one short label row, one NOTES heading, no empty card', async () => {
  for (const fx of fkFixtures()) {
    const imp = await imported(fx), h = imp.app.renderPreflightPhase();
    const at = h.indexOf(GROUP_HDR), end = h.indexOf('<span class="notes-sub-header">', at);
    const g = h.slice(at, end < 0 ? h.length : end + 6);
    assert.ok(!g.includes('<pre') && !g.includes('notam-raw-text'), `${fx.id}: DEF-014: no RAW block in the group`);
    const rows = g.match(/<span class="data-label">Dispatch contact<\/span><span class="data-value">([^<]*)<\/span>/g) || [];
    assert.equal(rows.length, 1, `${fx.id}: DEF-013: one Dispatch contact row`);
    assert.ok(/data-value">(REQUIRED|IF QUESTIONS)</.test(rows[0]), `${fx.id}: DEF-013: its value is the label`);
    assert.equal(h.split('class="notes-section-title"').length - 1, 1, `${fx.id}: DEF-012: one NOTES heading`);
    assert.ok(!/<div class="subcard-body">\s*<\/div>/.test(h) && !/<div class="subcard">\s*<\/div>/.test(h), `${fx.id}: DEF-011: no empty card`);
  }
  // NEGATIVE: NavBlue keeps its layout: one NOTES heading, no OFP Remarks group, no remark item
  for (const fx of nbFixtures()) {
    const h = (await imported(fx)).app.renderPreflightPhase();
    assert.equal(h.split('class="notes-section-title"').length - 1, 1, `${fx.id}: one NOTES heading`);
    assert.ok(!h.includes('OFP Remarks') && !h.includes('notam-item-label'), `${fx.id}: NavBlue has no OFP Remarks group`);
  }
});

// ══ Exec ruling before merge: a Contact Dispatch remark printed but no label → "Review OFP" ════════════════
test('Review OFP (synthetic): a printed Contact Dispatch remark with no label shows the row "Dispatch contact | Review OFP"; NEGATIVE: nothing printed → no row; a label wins', () => {
  const app = loadApp();
  const row = () => { const m = app.renderPreflightPhase().match(/<span class="data-label">Dispatch contact<\/span><span class="data-value">([^<]*)<\/span>/); return m ? m[1] : null; };
  // POSITIVE: the remark text is printed (held in memory), no label → the safe-side row; the group exists, closed (the open state is unchanged)
  dispatch(app, null); app._setOfpTexts({ dispatch: 'SYNTHETIC CONTACT DISPATCH LINE', raim: [] });
  assert.equal(row(), 'Review OFP');
  assert.ok(app.renderPreflightPhase().includes(GROUP_HDR) && app.renderPreflightPhase().includes('<div class="notam-group-body" hidden>'), 'the group, collapsed');
  assert.ok(!app.renderPreflightPhase().includes('SYNTHETIC CONTACT DISPATCH LINE'), 'the printed text is not shown');
  // POSITIVE: a reopened flight whose remark cannot be rebuilt (no stored PDF) but whose flag says it was printed
  app._setOfpTexts(null); app.S.dispatchPrinted = true;
  assert.equal(row(), 'Review OFP', 'the saved flag counts as printed');
  // NEGATIVE: nothing printed (no text, no flag, no label) → no row, no group
  app.S.dispatchPrinted = undefined; dispatch(app, null);
  assert.equal(row(), null);
  assert.ok(!app.renderPreflightPhase().includes('OFP Remarks'));
  // NEGATIVE: an empty or blank printed text is not a remark → no row
  for (const t of ['', '  \n ']) { app._setOfpTexts({ dispatch: t, raim: [] }); assert.equal(row(), null, JSON.stringify(t)); }
  // NEGATIVE: a label wins over "Review OFP", and REQUIRED still opens the group
  for (const [l, open] of [['REQUIRED', true], ['IF QUESTIONS', false]]) {
    dispatch(app, { label: l }); app._setOfpTexts({ dispatch: 'SYNTHETIC CONTACT DISPATCH LINE', raim: [] });
    assert.equal(row(), l, 'the label, not "Review OFP"');
    assert.equal(app.renderPreflightPhase().includes('<div class="notam-group-body" hidden>'), !open, `${l}: open state as before`);
  }
});
