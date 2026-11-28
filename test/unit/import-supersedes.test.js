'use strict';
/**
 * Sprint 1w (DEF-TBD-1v-3, DEF-TBD-1w-1): who owns the open flight's data when an import, a flight
 * tap or a restore overlap. One sequence (_loadSeq): loadFlight() takes it, processPDF() takes it as its
 * first step and checks it after each wait and in its 400 ms timer, a non-empty importManual() takes it.
 *
 *   T1 … T10   scoping §4: each with a negative (fails on main 4c8a9d5) and, where the scoping lists one,
 *              a positive (passes on main and on the fix)
 *   L1 … L4    liveness: an import is overtaken only by a flight opening or another non-empty import
 *
 * The app runs unmodified in the harness vm. The test supplies, before the app script runs:
 *   - indexedDB      a controllable stand-in for the stored-PDF store (_pdfDb): get() waits on a gate
 *   - pdfjsLib       a fake pdf.js: getDocument() and the last page's text wait on gates, pages are counted
 *   - loadPdfJs      waits on a gate (src/import.html is a separate script the harness does not load)
 *   - setTimeout     captured: the test fires the import's 400 ms timer itself
 *   - File / Blob    for processPDFFromNative()
 * A gate is open unless the test holds it; a held gate resolves (release) or rejects (fail) when the test
 * says so. Every PDF and text here is SYNTHETIC (test/lib/fk-synth.js, invented flight numbers and text).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { loadApp } = require('../harness');
const fk = require('../lib/fk-synth');

// ── Synthetic packages ───────────────────────────────────────────────────────────────────────────────
// A: TST0001 KAAA–KBBB block 122.5 (fk-synth as is). B: TST0002 KDDD–KEEE block 133.3 with an invented
// RAIM line (its OFP Remarks texts differ from A's). C: TST0003 KFFF–KGGG block 155.5.
const as = (t, n, o, d, blk) => t.replace(/TST0001/g, n).replace(/KAAA/g, o).replace(/KBBB/g, d).replace('BLOCK 122500', blk);
const TEXT = {
  A: fk.release(),
  B: as(fk.release({ raim: ['RAIM ALERT INVENTED TEST LINE 0000Z-2359Z'] }), 'TST0002', 'KDDD', 'KEEE', 'BLOCK 133300'),
  C: as(fk.release(), 'TST0003', 'KFFF', 'KGGG', 'BLOCK 155500'),
  // D89: both format markers → refused, the crew stays on the import screen.
  MIX: fk.release().replace('COST INDEX 020 Revision: 1.0', 'COST INDEX 020 Revision: 1.0\nBRIEF PAGE 1 OF 2'),
  // Neither marker: the NavBlue parser gives an empty flight (F-18, unchanged).
  JUNK: 'INVENTED FILLER PAGE ONE\nNO FORMAT MARKER ON THIS PAGE\n\n',
};
const FLT = { A: 'TST0001/08', B: 'TST0002/08', C: 'TST0003/08' };
const NOTE = 'INVENTED CREW NOTE';
const DOCS = {};
for (const [id, t] of Object.entries(TEXT)) {
  DOCS[id] = { pages: fk.input(t).pages.map(p => ({ width: p.width, height: p.height,
    items: p.items.map(({ str, x, y, w, h, font }) => ({ str, x, y, w, h, font })) })) };
}
// A package's PDF bytes carry its id, so every buffer the app holds or stores can be told apart.
const bytesOf = id => { const u = Buffer.from('PBTEST:' + id, 'ascii'); const ab = new ArrayBuffer(u.length); new Uint8Array(ab).set(u); return ab; };
const pkgOf = buf => {
  if (!buf) return null;
  const u = ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf);
  let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return s.startsWith('PBTEST:') ? s.slice(7) : '?';
};
// Which package a text is: the flight number it carries.
const textOf = t => { if (!t) return t === '' ? '' : null; const m = String(t).match(/TST000(\d)/); return m ? ({ 1: 'A', 2: 'B', 3: 'C' })[m[1]] : '?'; };

// ── Gates ────────────────────────────────────────────────────────────────────────────────────────────
function deferred() { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); p.catch(() => {}); return { p, res, rej }; }
function makeGates() {
  const held = new Map(), count = {};
  return {
    count,
    hold(name) { if (!held.has(name)) held.set(name, deferred()); },
    release(name) { const d = held.get(name); held.delete(name); if (d) d.res(); },
    fail(name) { const d = held.get(name); held.delete(name); if (d) d.rej(new Error('synthetic read failure')); },
    wait(name) { count[name] = (count[name] || 0) + 1; const d = held.get(name); return d ? d.p : Promise.resolve(); },
    n(name) { return count[name] || 0; },
  };
}

// ── IndexedDB stand-in (the shape _pdfDb uses; its handlers are set after the call returns) ──────────
function makeIdb(gates) {
  const store = new Map();
  const later = fn => setImmediate(fn);
  const db = {
    transaction() {
      const tx = {
        objectStore: () => ({
          put(buf, key) { store.set(key, buf); later(() => tx.oncomplete && tx.oncomplete()); },
          get(key) {
            const req = {};
            gates.wait('idb:' + (store.has(key) ? pkgOf(store.get(key)) : 'none')).then(
              () => { req.result = store.has(key) ? store.get(key) : undefined; req.onsuccess && req.onsuccess(); },
              err => { req.onerror && req.onerror({ target: { error: err } }); });
            return req;
          },
          delete(key) { store.delete(key); },
        }),
      };
      return tx;
    },
  };
  return { store, indexedDB: { open() { const req = {}; later(() => req.onsuccess && req.onsuccess({ target: { result: db } })); return req; } } };
}

// ── Fake pdf.js: the document and the last page's text wait on gates; pages read are counted ──────────
function makePdfjs(gates) {
  return {
    GlobalWorkerOptions: {},
    getDocument({ data }) {
      const id = pkgOf(data), src = DOCS[id];
      return { promise: gates.wait('doc:' + id).then(() => ({
        numPages: src.pages.length,
        getPage: async n => {
          gates.wait('page:' + id);
          const pg = src.pages[n - 1];
          return {
            getViewport: () => ({ width: pg.width, height: pg.height }),
            getTextContent: async () => {
              if (n === src.pages.length) await gates.wait('text:' + id);
              return { items: pg.items.map(it => ({ str: it.str, transform: [0, 0, 0, 0, it.x, pg.height - it.y], width: it.w, height: it.h, fontName: it.font })) };
            },
          };
        },
      })) };
    },
  };
}

const CLOCK = { base: Date.UTC(2026, 9, 30, 0, 0, 0), tick: 0 };   // shared by every session of this file
// ── The app, with the stand-ins in place before its script runs (the resume runs while it loads) ─────
function makeApp({ storageData, idbData, hold = [] } = {}) {
  const gates = makeGates();
  hold.forEach(g => gates.hold(g));
  const idb = makeIdb(gates);
  if (idbData) for (const [k, v] of idbData) idb.store.set(k, v);
  const timers = [];
  class Blob { constructor(parts) { this._parts = parts; } }
  class File {
    constructor(parts, name) { this.name = name; this._parts = parts; }
    arrayBuffer() {
      const u = this._parts[0]._parts[0], ab = new ArrayBuffer(u.length); new Uint8Array(ab).set(Array.from(u));
      return gates.wait('bytes:' + pkgOf(ab)).then(() => ab);
    }
  }
  // The harness clock is fixed; saved flights take their id from Date.now(), so here it moves 1 ms per read
  // (two flights saved in one session get two ids, as on a device). Same day as the harness clock.
  class TickDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(CLOCK.base + CLOCK.tick); }
    static now() { return CLOCK.base + (++CLOCK.tick); }
  }
  const extra = {
    Date: TickDate,
    indexedDB: idb.indexedDB, pdfjsLib: makePdfjs(gates), loadPdfJs: () => gates.wait('pdfjs'),
    setTimeout: (fn, ms) => { timers.push({ fn, ms, fired: false }); return timers.length; },
    File, Blob,
  };
  const create = vm.createContext;
  vm.createContext = (sb, ...rest) => { Object.assign(sb, extra); return create.call(vm, sb, ...rest); };
  let app;
  try { app = loadApp({ storageData }); } finally { vm.createContext = create; }
  const sb = app.sandbox;
  // The import screen's text box and the OFP panel (open or not); every other element as the harness gives it.
  // The OFP panel's 'active' class follows switchFlightTab() (el.ofpActive; a test may set it).
  const doc = sb.document, stub = doc.getElementById('any');
  const el = { ofpActive: false };
  const classList = { contains: c => c === 'active' && el.ofpActive, add: c => { if (c === 'active') el.ofpActive = true; },
    remove: c => { if (c === 'active') el.ofpActive = false; }, toggle: (c, f) => { if (c === 'active') el.ofpActive = f === undefined ? !el.ofpActive : !!f; } };
  const ids = { manualText: { value: '' }, 'fpanel-ofp': new Proxy({ classList }, { get: (t, p) => (p in t ? t[p] : stub[p]), set: () => true }) };
  el.manualText = ids.manualText;
  sb.document = new Proxy(doc, { get: (t, p) => (p === 'getElementById' ? (id => (id in ids ? ids[id] : t.getElementById(id))) : t[p]) });
  // Spies on the app's own functions (calls only; each then runs as written).
  const calls = { toast: [], push: [], parse: 0 };
  const spy = (name, rec) => { const f = sb[name]; sb[name] = function (...a) { rec(a); return f.apply(this, a); }; };
  spy('showToast', a => calls.toast.push(a.join(' ')));
  spy('push', a => calls.push.push(a[0]));
  spy('parseOFP', () => { calls.parse++; });
  sb.__pkgOf = pkgOf;
  const run = code => vm.runInContext(code, sb);
  const fire = (ms = 400) => timers.filter(t => t.ms === ms && !t.fired).forEach(t => { t.fired = true; t.fn(); });
  return { app, sb, gates, idb, timers, el, calls, run, fire, pending: (ms = 400) => timers.filter(t => t.ms === ms && !t.fired).length };
}
const settle = async (n = 60) => { for (let k = 0; k < n; k++) await new Promise(r => setImmediate(r)); };
const file = (r, id) => ({ name: id + '.pdf', type: 'application/pdf', arrayBuffer: () => r.gates.wait('bytes:' + id).then(() => bytesOf(id)) });
// processPDF() as the file picker calls it (not awaited: the test drives its waits).
const importPdf = (r, id) => { const p = r.app.processPDF(file(r, id)); p.catch(() => {}); return p; };
const paste = (r, text) => { r.el.manualText.value = text; r.app.importManual(); };
// An import that nothing overtakes: read, then the 400 ms timer.
async function importDone(r, id) { importPdf(r, id); await settle(); r.fire(); await settle(); }

// The open flight's globals, as plain data.
// Everything an import sets: all of S, airportData, the timeline (rule 6: every field, safety-critical ones included).
const whole = r => JSON.parse(r.run('JSON.stringify({ S, airportData, tl: _tl, flightDateISO: window._flightDateISO })'));
// Each saved entry in full (number, date, state, airport data, timeline), its id and save time left out, and its stored PDF.
const savedFull = r => JSON.parse(JSON.stringify(r.app.getFlights())).map(f => { const { id, at, ...rest } = f; return { ...rest, pdf: pkgOf(r.idb.store.get(id)) }; })
  .sort((a, b) => a.fltNum.localeCompare(b.fltNum));
const open = r => JSON.parse(r.run(`JSON.stringify({ flt: S.fltNum, block: S.blockFuel, note: S.userNotes,
  text: pdfRawText, rawOFP: S.rawOFP, pages: pdfPages, bytes: __pkgOf(pdfArrayBuffer), rawIndex: S.rawIndex || null,
  rawViews: _rawViews, ofpTexts: _ofpTexts, top: _navStack[_navStack.length - 1], seq: _loadSeq })`));
// What storage holds: each saved flight's number, block fuel, note and stored PDF (ids and times left out).
const saved = r => JSON.parse(JSON.stringify(r.app.getFlights())).map(f => ({ flt: f.fltNum, block: f.state.blockFuel, note: f.state.userNotes || '', pdf: pkgOf(r.idb.store.get(f.id)) }))
  .sort((a, b) => a.flt.localeCompare(b.flt));
const entry = (r, id) => r.app.getFlights().find(f => f.fltNum === FLT[id]);
// Which package each part of the open flight came from.
const sources = o => ({ flt: textOf(o.flt), text: textOf(o.text), rawOFP: textOf(o.rawOFP), pages: o.pages ? textOf(o.pages.map(p => p.items.map(i => i.str).join('\n')).join('\n')) : null, bytes: o.bytes });

// A session with flight A saved (its PDF stored, a crew note), back on the flight list.
async function withA(opts) {
  const r = makeApp(opts);
  await importDone(r, 'A');
  r.app.S.userNotes = NOTE; r.app.saveFlight(); await settle();
  r.app.push('screen-flights');
  return r;
}
async function withAC() {
  const r = await withA();
  await importDone(r, 'C');
  r.app.push('screen-flights');
  return r;
}
const tapA = r => r.app.loadFlight(entry(r, 'A'));
const A_SAVED = { flt: FLT.A, block: '122.5', note: NOTE, pdf: 'A' };

// The reference: each package imported alone in a fresh session, nothing overtaking it.
const REF = {};
async function ref(id) {
  if (!REF[id]) { const r = makeApp(); await importDone(r, id); REF[id] = { open: open(r), whole: whole(r), saved: saved(r), savedFull: savedFull(r) }; }
  return REF[id];
}
// The open flight exactly as when the package is imported alone in a fresh session: the globals above, and (with
// the session) all of S, airportData, the timeline and the package's saved entry in full.
const same = (o, refOpen, msg, r, id) => {
  const pick = x => ({ flt: x.flt, block: x.block, text: x.text, rawOFP: x.rawOFP, pages: x.pages, bytes: x.bytes, rawIndex: x.rawIndex, rawViews: x.rawViews, ofpTexts: x.ofpTexts });
  assert.deepEqual(pick(o), pick(refOpen), msg);
  if (r) {
    assert.deepEqual(whole(r), REF[id].whole, (msg || '') + ': all of S, airportData and the timeline');
    assert.deepEqual(savedFull(r).find(f => f.fltNum === FLT[id]), REF[id].savedFull[0], (msg || '') + ': the saved entry in full');
  }
};

// ══ T1 tap A, paste B; A's re-read resolves after ═══════════════════════════════════════════════════
test('T1 negative: tap A, paste B, A\'s re-read lands after: B\'s text, pages, OFP text and Remarks texts unchanged', async () => {
  const r = await withA();
  r.gates.hold('text:A');
  tapA(r); await settle();
  paste(r, TEXT.B);
  const before = open(r);
  assert.equal(before.flt, FLT.B);
  r.gates.release('text:A'); await settle();
  const after = open(r);
  assert.deepEqual(sources(after), { flt: 'B', text: 'B', rawOFP: 'B', pages: null, bytes: null });
  assert.deepEqual({ text: after.text, rawOFP: after.rawOFP, pages: after.pages, ofpTexts: after.ofpTexts, rawViews: after.rawViews },
    { text: before.text, rawOFP: before.rawOFP, pages: before.pages, ofpTexts: before.ofpTexts, rawViews: before.rawViews });
  assert.deepEqual(saved(r).find(s => s.flt === FLT.A), A_SAVED, 'A\'s entry unchanged');
});
test('T1 positive: tap A alone: A\'s re-read writes A\'s text, pages and OFP text', async () => {
  const r = await withA();
  r.gates.hold('text:A');
  tapA(r); await settle();
  assert.equal(open(r).text, '', 'not yet re-read');
  r.gates.release('text:A'); await settle();
  const o = open(r);
  assert.deepEqual(sources(o), { flt: 'A', text: 'A', rawOFP: 'A', pages: 'A', bytes: 'A' });
  assert.equal(o.note, NOTE);
});

// ══ T2 tap A, import B; A's re-read lands inside the 400 ms ══════════════════════════════════════════
test('T2 negative: tap A, import B, A\'s re-read lands inside the 400 ms: B is parsed and saved with B\'s PDF; A unchanged', async () => {
  const r = await withA();
  r.gates.hold('text:A');
  tapA(r); await settle();
  importPdf(r, 'B'); await settle();
  assert.equal(r.pending(), 1, 'B read, its timer set');
  r.gates.release('text:A'); await settle();   // inside the 400 ms
  r.fire(); await settle();
  const o = open(r);
  same(o, (await ref('B')).open, 'the open flight is B exactly as when imported alone', r, 'B');
  assert.equal(o.top, 'screen-flight');
  assert.deepEqual(saved(r), [A_SAVED, { flt: FLT.B, block: '133.3', note: '', pdf: 'B' }]);
});
test('T2 positive: import B with no tap: parsed and saved (as on main)', async () => {
  const r = await withA();
  await importDone(r, 'B');
  const o = open(r);
  same(o, (await ref('B')).open, undefined, r, 'B');
  assert.equal(o.top, 'screen-flight');
  assert.deepEqual(saved(r), [A_SAVED, { flt: FLT.B, block: '133.3', note: '', pdf: 'B' }]);
});

// ══ T3 the same; A's re-read lands after the parse ═════════════════════════════════════════════════
test('T3 negative: tap A, import B, A\'s re-read lands after the parse: B\'s text, pages, OFP text, RAW views, Remarks texts unchanged', async () => {
  const r = await withA();
  r.gates.hold('text:A');
  tapA(r); await settle();
  importPdf(r, 'B'); await settle();
  r.fire(); await settle();
  const before = open(r);
  r.gates.release('text:A'); await settle();
  const after = open(r);
  assert.deepEqual(after, before);
  same(after, (await ref('B')).open, undefined, r, 'B');
  assert.deepEqual(saved(r), [A_SAVED, { flt: FLT.B, block: '133.3', note: '', pdf: 'B' }]);
});

// ══ T4 A's restore resolves after an import's bytes ═════════════════════════════════════════════════
test('T4 negative (PDF): A\'s restore lands after B\'s bytes: B keeps and stores B\'s PDF', async () => {
  const r = await withA();
  r.gates.hold('idb:A');
  tapA(r); await settle();
  importPdf(r, 'B'); await settle();
  r.gates.release('idb:A'); await settle();
  assert.equal(open(r).bytes, 'B');
  r.fire(); await settle();
  same(open(r), (await ref('B')).open, undefined, r, 'B');
  assert.deepEqual(saved(r), [A_SAVED, { flt: FLT.B, block: '133.3', note: '', pdf: 'B' }]);
});
test('T4 negative (paste): A\'s restore lands after paste B: B holds no PDF; after an edit B has no stored PDF', async () => {
  const r = await withA();
  r.gates.hold('idb:A');
  tapA(r); await settle();
  paste(r, TEXT.B);
  r.gates.release('idb:A'); await settle();
  const o = open(r);
  assert.deepEqual(sources(o), { flt: 'B', text: 'B', rawOFP: 'B', pages: null, bytes: null });
  r.app.S.userNotes = 'INVENTED EDIT'; r.app.saveFlight(); await settle();   // the crew's next edit saves
  assert.deepEqual(saved(r), [A_SAVED, { flt: FLT.B, block: '133.3', note: 'INVENTED EDIT', pdf: null }]);
});
test('T4 positive: tap A alone: the restore sets A\'s bytes and redraws an open OFP panel; a closed one is not redrawn', async () => {
  for (const active of [true, false]) {
    const r = await withA();
    r.gates.hold('idb:A');
    tapA(r);
    if (active) r.run("switchFlightTab('ofp')");   // as the resume does for a saved OFP tab, before the restore lands
    await settle();
    assert.equal(r.el.ofpActive, active);
    const view = r.run('_ofpViewSeq');
    assert.equal(open(r).bytes, null);
    r.gates.release('idb:A'); await settle();
    assert.equal(open(r).bytes, 'A');
    assert.equal(r.run('_ofpViewSeq') > view, active, `OFP panel ${active ? 'open: redrawn' : 'closed: not redrawn'}`);
  }
});

// ══ T5 a second loadFlight during the first's restore or re-read (the check main already has) ═══════
test('T5 guard (the check loadFlight already has; passes on main too): tap A, then tap C during A\'s restore or re-read: A writes nothing', async () => {
  for (const gate of ['idb:A', 'text:A']) {
    const r = await withAC();
    r.gates.hold(gate);
    tapA(r); await settle();
    r.app.push('screen-flights');
    r.app.loadFlight(entry(r, 'C')); await settle();
    const before = open(r);
    r.gates.release(gate); await settle();
    assert.deepEqual(open(r), before, gate);
    assert.deepEqual(sources(before), { flt: 'C', text: 'C', rawOFP: 'C', pages: 'C', bytes: 'C' }, gate);
  }
});
test('T5 positive: the second flight\'s restore and re-read write', async () => {
  const r = await withAC();
  r.gates.hold('idb:C');
  tapA(r); await settle();
  r.app.loadFlight(entry(r, 'C')); await settle();
  assert.equal(open(r).bytes, null);
  r.gates.release('idb:C'); await settle();
  assert.deepEqual(sources(open(r)), { flt: 'C', text: 'C', rawOFP: 'C', pages: 'C', bytes: 'C' });
});

// ══ T6 import B reading; tap A (DEF-TBD-1w-1, F-21) ══════════════════════════════════════════════════
// A's own restore and re-read land before B's wait is released, so A's state is final and B's write shows.
async function overtakenByTap(stage) {
  const r = await withA();
  r.gates.hold(stage.replace('fail:', ''));
  importPdf(r, 'B'); await settle();
  r.app.push('screen-flights');   // Back
  const toasts = r.calls.toast.length;
  tapA(r); await settle();
  let before = open(r);
  const view = r.run('_ofpViewSeq'), pushes = r.calls.push.length, parses = r.calls.parse;
  // pdf.js not yet loaded holds A's re-read too (one loader): A's state is final only once it is released.
  if (stage !== 'pdfjs') assert.deepEqual(sources(before), { flt: 'A', text: 'A', rawOFP: 'A', pages: 'A', bytes: 'A' }, 'A open, its re-read landed');
  if (stage.startsWith('fail:')) r.gates.fail(stage.slice(5)); else r.gates.release(stage);
  await settle();
  if (stage === 'pdfjs') {
    assert.equal(r.run('_ofpViewSeq'), view + (r.el.ofpActive ? 1 : 0), 'no viewer wipe by B');
    before = open(r);
    assert.deepEqual(sources(before), { flt: 'A', text: 'A', rawOFP: 'A', pages: 'A', bytes: 'A' }, 'A open, its re-read landed');
  }
  return { r, before, view: r.run('_ofpViewSeq'), pushes, toasts, parses };
}
const STAGES = { 'pdfjs': 'loadPdfJs()', 'bytes:B': 'file.arrayBuffer()', 'doc:B': 'getDocument()', 'text:B': '_pdfReadText()' };
for (const [gate, wait] of Object.entries(STAGES)) {
  test(`T6 negative (${wait}): import B waiting on ${wait}, Back, tap A: B writes nothing; A's state, note and PDF intact`, async () => {
    const { r, before, view, pushes, toasts, parses } = await overtakenByTap(gate);
    assert.deepEqual(open(r), before, 'the open flight is A, unchanged');
    assert.equal(r.run('_ofpViewSeq'), view, 'no viewer wipe');
    assert.equal(before.note, NOTE);
    assert.equal(r.pending(), 0, 'no parse timer');
    r.fire(); await settle();
    assert.deepEqual(open(r), before);
    assert.equal(r.calls.push.length, pushes, 'no screen change');
    assert.deepEqual(r.calls.toast.slice(toasts), [], 'no toast');
    assert.equal(r.calls.parse, parses, 'no parse');
    assert.deepEqual(saved(r), [A_SAVED], 'B not saved, A unchanged');
    // What B did not do once overtaken (pdf.js calls; no global shows them).
    if (gate === 'pdfjs') assert.equal(r.gates.n('bytes:B'), 0, 'B\'s file not read');
    if (gate === 'bytes:B') assert.equal(r.gates.n('doc:B'), 0, 'B\'s document not opened');
    if (gate === 'doc:B') assert.equal(r.gates.n('page:B'), 0, 'no page of B read');
  });
}
test('T6 negative (timer set): B read and its timer set, Back, tap A, A\'s re-read lands first, then the timer: no parse, A\'s note kept', async () => {
  const r = await withA();
  importPdf(r, 'B'); await settle();
  assert.equal(r.pending(), 1);
  r.app.push('screen-flights');
  tapA(r); await settle();
  const before = open(r), pushes = r.calls.push.length, parses = r.calls.parse;
  assert.deepEqual(sources(before), { flt: 'A', text: 'A', rawOFP: 'A', pages: 'A', bytes: 'A' });
  r.fire(); await settle();
  assert.equal(r.calls.parse, parses, 'the timer does not parse');
  assert.equal(r.calls.push.length, pushes, 'no screen change');
  assert.deepEqual(open(r), before);
  assert.equal(open(r).note, NOTE);
  assert.deepEqual(saved(r), [A_SAVED]);
});
test('T6 negative (timer set, A\'s re-read not yet landed): the timer does nothing; A\'s re-read then lands', async () => {
  const r = await withA();
  importPdf(r, 'B'); await settle();
  r.app.push('screen-flights');
  r.gates.hold('text:A');
  tapA(r); await settle();
  const parses = r.calls.parse, pushes = r.calls.push.length;
  r.fire(); await settle();
  assert.equal(r.calls.parse, parses);
  assert.equal(r.calls.push.length, pushes);
  r.gates.release('text:A'); await settle();
  assert.deepEqual(sources(open(r)), { flt: 'A', text: 'A', rawOFP: 'A', pages: 'A', bytes: 'A' });
  assert.deepEqual(saved(r), [A_SAVED]);
});
test('T6 negative (the read fails after the tap): the overtaken import shows no error toast', async () => {
  const { r, before, toasts } = await overtakenByTap('fail:doc:B');
  assert.deepEqual(r.calls.toast.slice(toasts), [], 'no "Error:" toast');
  assert.deepEqual(open(r), before);
  assert.deepEqual(saved(r), [A_SAVED]);
});
test('T6 positive (failure, nothing overtaking): the read error shows its toast as on main', async () => {
  const r = makeApp();
  r.gates.hold('doc:B');
  importPdf(r, 'B'); await settle();
  r.gates.fail('doc:B'); await settle();
  assert.deepEqual(r.calls.toast.slice(-1), ['err Error: synthetic read failure']);
});

// ══ T7 import X reading; import Y (DEF-TBD-1w-1, F-22) ═══════════════════════════════════════════════
for (const gate of ['bytes:B', 'doc:B', 'text:B', 'timer']) {
  test(`T7 negative (${gate}): import B, then import C before B opens: B writes nothing more; C saved with C's PDF; B not saved`, async () => {
    const r = await withA();
    if (gate !== 'timer') r.gates.hold(gate);
    importPdf(r, 'B'); await settle();
    if (gate === 'timer') assert.equal(r.pending(), 1, 'B\'s timer set');
    r.gates.hold('text:C');
    importPdf(r, 'C'); await settle();
    if (gate === 'timer') {   // B's timer fires while C is still reading
      const parses = r.calls.parse, pushes = r.calls.push.length;
      r.fire(); await settle();
      assert.equal(r.calls.parse, parses, 'B\'s timer does not parse');
      assert.equal(r.calls.push.length, pushes, 'B\'s timer does not change the screen');
    } else r.gates.release(gate);
    await settle();
    assert.equal(r.pending(), 0, 'B set no timer');
    r.gates.release('text:C'); await settle();
    r.fire(); await settle();
    const o = open(r);
    same(o, (await ref('C')).open, 'the open flight is C exactly as when imported alone', r, 'C');
    assert.equal(o.top, 'screen-flight');
    assert.deepEqual(saved(r), [A_SAVED, { flt: FLT.C, block: '155.5', note: '', pdf: 'C' }]);
  });
}

// ══ T8 importManual with empty text moves nothing ═══════════════════════════════════════════════════
test('T8 guard (passes on main too): an empty paste during A\'s re-read moves nothing: A\'s re-read still lands', async () => {
  const r = await withA();
  r.gates.hold('text:A');
  tapA(r); await settle();
  const seq = open(r).seq;
  paste(r, '   ');
  assert.equal(open(r).seq, seq, 'the sequence did not move');
  assert.equal(r.calls.toast.slice(-1)[0], 'err Please paste OFP text first.');
  r.gates.release('text:A'); await settle();
  assert.deepEqual(sources(open(r)), { flt: 'A', text: 'A', rawOFP: 'A', pages: 'A', bytes: 'A' });
});

// ══ T9 resume at start, then processPDFFromNative ═══════════════════════════════════════════════════
async function resumeSession(hold) {
  const s = await withA();
  const a = entry(s, 'A');
  return makeApp({ hold, idbData: [[a.id, s.idb.store.get(a.id)]],
    storageData: { rp_flights: s.sb.localStorage.getItem('rp_flights'), rp_resume_view: { flightId: a.id, screen: 'screen-flight', tab: 'note', phase: 'preflight', scrollY: 0 } } });
}
test('T9 negative: resume A at start, its re-read held; B arrives through processPDFFromNative: B\'s fields, text and PDF; A\'s entry intact', async () => {
  const r = await resumeSession(['text:A']);
  await settle();
  assert.equal(open(r).flt, FLT.A, 'the resume opened A');
  assert.equal(open(r).text, '', 'A\'s re-read still waiting');
  const p = r.sb.processPDFFromNative(Buffer.from(bytesOf('B')).toString('base64'), 'B.pdf'); p.catch(() => {});
  await settle();
  assert.equal(r.pending(), 1);
  r.gates.release('text:A'); await settle();   // inside the 400 ms
  r.fire(); await settle();
  same(open(r), (await ref('B')).open, undefined, r, 'B');
  assert.deepEqual(saved(r), [A_SAVED, { flt: FLT.B, block: '133.3', note: '', pdf: 'B' }]);
});
test('T9 positive: resume alone: A reopened with its note, text and PDF (unchanged)', async () => {
  const r = await resumeSession([]);
  await settle();
  const o = open(r);
  assert.deepEqual(sources(o), { flt: 'A', text: 'A', rawOFP: 'A', pages: 'A', bytes: 'A' });
  assert.equal(o.note, NOTE);
  assert.deepEqual(saved(r), [A_SAVED]);
});

// ══ T10 a pasted flight with a Dispatch or RAIM flag; a late _rawMissing from the previous flight ═══
test('T10 negative: paste B (Dispatch and RAIM flags) while A\'s restore finds no PDF or A\'s re-read fails: B\'s Remarks texts unchanged', async () => {
  for (const how of ['no stored PDF', 're-read fails']) {
    const r = makeApp();
    if (how === 'no stored PDF') { paste(r, TEXT.A); r.app.S.userNotes = NOTE; r.app.saveFlight(); r.gates.hold('idb:none'); }
    else { await importDone(r, 'A'); r.gates.hold('text:A'); }
    r.app.push('screen-flights');
    tapA(r); await settle();
    paste(r, TEXT.B);
    const before = open(r);
    assert.equal(before.flt, FLT.B);
    assert.ok(before.ofpTexts && !before.ofpTexts.missing && before.ofpTexts.raim.length === 1, `${how}: B's texts built from its paste`);
    if (how === 'no stored PDF') r.gates.release('idb:none'); else r.gates.fail('text:A');
    await settle();
    assert.deepEqual(open(r), before, how);
  }
});
test('T10 positive: tap a pasted flight with a Dispatch flag and no stored PDF: its Remarks texts are "missing" (as on main)', async () => {
  const r = makeApp();
  paste(r, TEXT.B);
  r.app.push('screen-flights');
  r.app.loadFlight(entry(r, 'B')); await settle();
  assert.deepEqual(open(r).ofpTexts, { missing: true });
});

// ══ Liveness: an import is overtaken only by a flight opening or another non-empty import ═══════════
test('L1: during an import, Back, tab switches, the resume key, toast timers and an empty paste move nothing; the import completes as when alone', async () => {
  const r = await withA();
  r.gates.hold('text:B');
  importPdf(r, 'B'); await settle();
  const seq = open(r).seq;
  r.app.push('screen-flights'); r.sb.pop();                     // Back
  r.run("switchFlightTab('ofp'); switchFlightTab('airports'); switchFlightTab('note')");
  r.app._saveResumeView(); r.app._clearResumeView();
  r.fire(3500);                                                 // toast timers
  paste(r, '');                                                 // empty paste
  r.run('renderFlightList()');
  assert.equal(open(r).seq, seq, 'the sequence did not move');
  r.gates.release('text:B'); await settle();
  r.fire(); await settle();
  same(open(r), (await ref('B')).open, undefined, r, 'B');
  assert.deepEqual(saved(r), [A_SAVED, { flt: FLT.B, block: '133.3', note: '', pdf: 'B' }]);
});
test('L2: each import moves the sequence once, at its start; its parse (accepted, refused, unrecognised) or a failed read moves it no further', async () => {
  for (const id of ['B', 'MIX', 'JUNK', 'fail']) {
    const r = makeApp();
    if (id === 'fail') r.gates.hold('doc:B');
    const seq0 = open(r).seq;
    importPdf(r, id === 'fail' ? 'B' : id);
    assert.equal(open(r).seq, seq0 + 1, `${id}: taken at the start, before any wait`);
    await settle();
    if (id === 'fail') { assert.equal(r.gates.n('doc:B'), 1); r.gates.fail('doc:B'); await settle(); }
    r.fire(); await settle();
    assert.equal(open(r).seq, seq0 + 1, `${id}: no further move`);
  }
  for (const t of [TEXT.B, TEXT.MIX, TEXT.JUNK]) {
    const r = makeApp();
    paste(r, t);
    assert.equal(open(r).seq, 1, 'a non-empty paste moves it once');
  }
});
test('L3: the controls are unchanged: refused package stays on the import screen with its toast; an unrecognised PDF opens an empty, unsaved flight (F-18)', async () => {
  const r = makeApp();
  r.app.push('screen-import');
  await importDone(r, 'MIX');
  assert.equal(open(r).top, 'screen-import');
  assert.match(r.calls.toast.slice(-1)[0], /^err /);
  assert.deepEqual(saved(r), []);
  const j = makeApp();
  await importDone(j, 'JUNK');
  assert.equal(open(j).top, 'screen-flight');
  assert.equal(open(j).flt, '');
  assert.deepEqual(saved(j), []);
});
test('L4: a refused import after a saved flight A was opened still overtakes A\'s re-read (a non-empty import), and A\'s entry is kept', async () => {
  const r = await withA();
  r.gates.hold('text:A');
  tapA(r); await settle();
  r.app.push('screen-import');
  importPdf(r, 'MIX'); await settle(); r.fire(); await settle();
  r.gates.release('text:A'); await settle();
  const o = open(r);
  assert.equal(o.flt, '');
  assert.equal(o.top, 'screen-import', 'refused: the import screen');
  // The refused package's own text and bytes stay (as on main); A's re-read wrote none of A's.
  assert.ok(o.text.includes('BRIEF PAGE 1 OF 2'), 'the text is the refused package\'s');
  assert.equal(o.bytes, 'MIX');
  assert.equal(o.rawOFP, '');
  assert.deepEqual(saved(r), [A_SAVED]);
});
// An import still reading is overtaken by any non-empty import started meanwhile, also one that is then
// refused (D89), opens an empty flight (F-18) or fails: the first then writes nothing and says nothing, and the
// second ends exactly as when alone (Objectives 1-2: the number is taken at the start, before the outcome is known).
for (const [y, how] of [['MIX', 'refused'], ['JUNK', 'unrecognised'], ['C', 'read fails']]) {
  test(`L5 (${how}): import B reading, then an import that is ${how}: B writes nothing more and is not saved; the second ends as when alone`, async () => {
    const run = async withB => {
      const r = await withA();
      r.app.push('screen-import');
      if (withB) { r.gates.hold('text:B'); importPdf(r, 'B'); await settle(); }
      if (how === 'read fails') r.gates.hold('doc:C');
      const toasts = r.calls.toast.length;
      importPdf(r, y); await settle();
      if (how === 'read fails') { r.gates.fail('doc:C'); await settle(); }
      if (withB) { r.gates.release('text:B'); await settle(); }
      r.fire(); await settle();
      return { o: open(r), saved: saved(r), toasts: r.calls.toast.slice(toasts), pending: r.pending() };
    };
    const alone = await run(false), over = await run(true);
    const { seq: _a, ...a } = alone.o, { seq: _b, ...b } = over.o;
    assert.deepEqual(b, a, 'the open flight and screen as when the second import is alone');
    assert.deepEqual(over.saved, alone.saved, 'storage as when alone: B not saved');
    assert.deepEqual(over.saved, [A_SAVED]);
    assert.deepEqual(over.toasts, alone.toasts, 'only the second import\'s own toasts');
    assert.equal(over.pending, 0);
  });
}

// One drop on the import screen's drop zone runs both drop handlers (the zone's and the document's, F-27): two
// imports of the same file back to back. The first is overtaken by the second; the file is read, parsed and saved once.
test('L6: the same PDF imported twice back to back (one drop on the drop zone): parsed once, saved once with its PDF, as when alone', async () => {
  const r = await withA();
  r.app.push('screen-import');
  importPdf(r, 'B'); importPdf(r, 'B'); await settle();
  assert.equal(r.gates.n('doc:B'), 1, 'B\'s document opened once');
  assert.equal(r.pending(), 1, 'one parse timer');
  const parses = r.calls.parse;
  r.fire(); await settle();
  assert.equal(r.calls.parse, parses + 1, 'parsed once');
  same(open(r), (await ref('B')).open, 'as when alone', r, 'B');
  assert.deepEqual(saved(r), [A_SAVED, { flt: FLT.B, block: '133.3', note: '', pdf: 'B' }]);
});
