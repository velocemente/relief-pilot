'use strict';
/**
 * TC-178 — step 5e-3: synthetic paste inputs (D87). Invented FlightKeys text in test/synthetic/, pasted through the
 * app's own import route (the #manualText box → importManual() → parseOFP(), D95). No parsing code is copied
 * here, no fixture is read, no app change is needed: the tests pass on a plain checkout.
 *
 *   TC-178-001  both files are labelled SYNTHETIC (file name and first line); invented identifiers only
 *   TC-178-010  O-68 / D79: the filed NAT track Z is not in the track message → the WARN with the D79 text is
 *               stored with the flight and is a line of OFP Alerts on the Preflight card.
 *               NEGATIVE: the same text with NATB printed in the route → no D79, track B marked
 *   TC-178-020  D57: no readable flight date → "Operating date needed", the date pop-up open, and a later time
 *               past 0000Z (ETA 0130Z after OUT 2330Z): once the crew enters the date, the ETA is on the next UTC
 *               day. NEGATIVE: the same text with a readable date → no pop-up, no "Operating date needed"
 *
 * Pasted FlightKeys text is read from the text only (no positions): its WARN says so (O-80).
 * All times are UTC.
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const { loadApp } = require('../harness');
const { peek } = require('../lib/app-path');

const DIR  = path.resolve(__dirname, '..', 'synthetic');
const F_O68 = 'SYNTHETIC-o68-filed-nat-not-in-message.txt';
const F_D57 = 'SYNTHETIC-d57-no-flight-date.txt';
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));   // a value made in the app's vm realm, as a plain value here
const unEsc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const D79 = (l, tmi, dir) => `FILED NAT ${l} NOT IN TRACK MESSAGE TMI ${tmi} (${dir}) – CHECK OCEANIC CLEARANCE`;

// The import screen's text box (#manualText) holds the pasted text; every other element stays as it was.
function pasteInto(app, text) {
  const doc = app.sandbox.document;
  app.sandbox.document = new Proxy(doc, { get: (t, p) => (p === 'getElementById' ? (id => (id === 'manualText' ? { value: text } : t.getElementById(id))) : t[p]) });
}
// Paste, then Import Text. Returns the app after the import.
function pasted(text, opts = {}) {
  const app = loadApp(opts);
  if (opts.domModel) app.fireDomReady();
  pasteInto(app, text);
  app.importManual();
  return app;
}
// The OFP Alerts lines of the Preflight card, as the crew reads them.
function alertLines(app) {
  const m = app.renderPreflightPhase().match(/<div class="section"><div class="callout"[^>]*>[\s\S]*?<span class="callout-title[^"]*"[^>]*>OFP Alerts<\/span>([\s\S]*?)<\/span><\/div><\/div>/);
  return m ? m[1].split('<br>').map(unEsc) : [];
}
const at = ms => class extends Date { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };

test('TC-178-001 the synthetic inputs are labelled SYNTHETIC in the file name and the first line', () => {
  for (const f of [F_O68, F_D57]) {
    assert.match(f, /SYNTHETIC/);
    assert.match(read(f).split('\n')[0], /^SYNTHETIC TEST INPUT/);
    assert.match(read(f), /FUFI: 00000000-0000-0000-0000-000000000000 PAGE 1\/2/, 'invented FlightKeys footer');
  }
});

test('TC-178-010 O-68 / D79 (synthetic paste): the filed NAT track is not in the message → the D79 text on OFP Alerts; NEGATIVE: the letter printed → none', () => {
  const app = pasted(read(F_O68));
  assert.equal(peek(app, '_ofpDetectFormat(pdfRawText)'), 'flightkeys');
  assert.equal(peek(app, 'pdfPages'), null, 'the paste route: text only, no positions');
  assert.ok(app.S.fltNum, 'the release is read from the pasted text');
  const d79 = app.S.ofpFindings.filter(f => f.code === 'NAT-FILED-NOT-IN-MESSAGE');
  assert.deepEqual(plain(d79), [{ level: 'WARN', field: 'natTrack', code: 'NAT-FILED-NOT-IN-MESSAGE', message: D79('Z', '307', 'WEST') }], 'stored with the flight');
  assert.ok(alertLines(app).includes(D79('Z', '307', 'WEST')), 'the D79 text exactly, as one line of OFP Alerts');
  assert.equal(app.S.natTrack.assignedId, 'Z');
  // NEGATIVE: the track letter is printed in the filed route
  const ok = pasted(read(F_O68).replace('NATZ', 'NATB'));
  assert.ok(!ok.S.ofpFindings.some(f => f.code === 'NAT-FILED-NOT-IN-MESSAGE'), 'no D79 stored');
  assert.ok(!alertLines(ok).some(l => /NOT IN TRACK MESSAGE/.test(l)), 'no D79 on OFP Alerts');
  assert.deepEqual(plain(ok.S.natTrack.blocks.flatMap(b => b.tracks.filter(t => t.assigned).map(t => t.id))), ['B']);
});

test('TC-178-020 D57 (synthetic paste): no readable flight date → "Operating date needed", the pop-up, and a later time past 0000Z goes to the next UTC day; NEGATIVE: a readable date → no prompt', () => {
  const clock = at(Date.UTC(2026, 10, 3, 12, 0));
  const app = loadApp({ domModel: true });
  app.fireDomReady();
  app.sandbox.Date = clock;
  pasteInto(app, read(F_D57));
  app.importManual();
  const S = app.S, input = app.document.getElementById('editInput');
  assert.equal(peek(app, '_ofpDetectFormat(pdfRawText)'), 'flightkeys');
  assert.equal(peek(app, 'pdfPages'), null, 'the paste route: text only, no positions');
  assert.deepEqual([S.date, S.outZ, S.etaDest], ['', '2330', '0130'], 'no date; OUT 2330Z, ETA 0130Z (past 0000Z)');
  assert.equal(peek(app, '_editField'), 'date', 'the date pop-up is open after the import');
  assert.equal(input.value, '03 11 2026', "prefilled with today's UTC date");
  app.renderNote();
  assert.match(app.document.getElementById('briefingStickyHeader').innerHTML, />Operating date needed<\/span>/);
  assert.equal(peek(app, '_tl').outMs, null, 'nothing is dated before the crew enters the date');
  // the crew enters the date: the 0130Z arrival is on the next UTC day
  app.openEdit('date'); input.value = '03 11 2026'; app.confirmEdit();
  assert.deepEqual([S.date, S.dateEnteredByCrew], ['03 NOV 26', true]);
  const tl = peek(app, '_tl');
  assert.equal(new Date(tl.outMs).toISOString(), '2026-11-03T23:30:00.000Z');
  assert.equal(new Date(tl.etaDestMs).toISOString(), '2026-11-04T01:30:00.000Z', 'ETA past 0000Z is the next UTC day');
  // NEGATIVE: the same text with a readable date: no prompt, the date shown, the same next-day arrival
  const dated = read(F_D57).replace(/31FEB/g, '03NOV').replace('31 FEB 26', '03 NOV 26').replace('TST0002/31 ', 'TST0002/03 ');
  const app2 = loadApp({ domModel: true });
  app2.fireDomReady();
  app2.sandbox.Date = clock;
  pasteInto(app2, dated);
  app2.importManual();
  assert.equal(app2.S.date, '03 NOV 26');
  assert.equal(peek(app2, '_editField'), null, 'no pop-up');
  app2.renderNote();
  assert.ok(!/Operating date needed/.test(app2.document.getElementById('briefingStickyHeader').innerHTML));
  assert.equal(new Date(peek(app2, '_tl').etaDestMs).toISOString(), '2026-11-04T01:30:00.000Z');
});
