'use strict';
// DEF-TBD-1a-1, F-5, F-6: a render of the OFP viewer owns it only while its number (_ofpViewSeq) is the
// current one. Once it is superseded (clearOFPPanel, push('screen-flight'), a newer loadOFPPanel) none of
// its later steps writes to the viewer, the page counter or the pill row, scrolls, or asks pdf.js for
// anything more. The PDF bytes and text are the ones the render started with.
//
// No browser: the app's own loadOFPPanel / clearOFPPanel / push run in the harness against a small fake DOM
// that logs every write, and a fake pdf.js whose script load, documents, outlines, pages and animation
// frames are held and released (or failed) by the test. Writers are named as in the scoping report §1:
// A1 loadPdfJs success, A2 getDocument success, A3 outline result, A3c pill tap, A4 animation frame,
// A5 each page, A6 getDocument failure, A7 loadPdfJs failure.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadApp } = require('../harness');

const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setImmediate(r)); };
const defer = () => {
  let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};

// Two flights. The fake pdf.js tells them apart by the length of the bytes it is given.
const FLIGHTS = {
  A: { bytes: 8,  total: 4, outline: [{ title: 'ROOT A', items: [{ title: 'Charts', dest: [{ i: 2 }] }] }], label: 'CHARTS', pill: 3 },
  B: { bytes: 16, total: 3, outline: [{ title: 'ROOT B', items: [{ title: 'TLR', dest: [{ i: 1 }] }] }], label: 'TLR', pill: 2 },
};
const flightOf = n => Object.keys(FLIGHTS).find(k => FLIGHTS[k].bytes === n);

// ── Fake DOM: a stacked layout (pill row 47 px, page 1000 px + 16 px margin, viewer 600 px high) ──
function heightOf(el) {
  if (el.className === 'pb-bookmark-pills') return 47;
  if (el.attrs['data-page']) return el.children[0].height + 16;
  return 0;
}
function makeEl(tag, log) {
  const el = {
    tag, children: [], parent: null, attrs: {}, listeners: {}, style: {}, className: '', _text: '',
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { if (this.log) this.log.push(['append', c]); c.parent = this; this.children.push(c); return c; },
    insertBefore(c, ref) {
      if (this.log) this.log.push(['insert', c]);
      c.parent = this; const i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c;
    },
    addEventListener(t, fn) { this.listeners[t] = fn; },
    getContext() { return {}; },
    get textContent() { return this._text; },
    set textContent(v) { if (this.log) this.log.push(['text', String(v)]); this._text = String(v); },
    get firstChild() { return this.children[0] || null; },
    get offsetHeight() { return heightOf(this); },
    // like a browser, setting innerHTML drops every child; the HTML itself is kept as a string
    set innerHTML(v) { if (this.log) this.log.push(['html', String(v)]); this.children.forEach(c => { c.parent = null; }); this.children = []; this.html = String(v); },
    get innerHTML() { return this.html || ''; },
    querySelectorAll(sel) { return sel === 'button' ? this.children.filter(c => c.tag === 'button') : []; },
    querySelector(sel) {
      const m = /^\[data-page="(\d+)"\]$/.exec(sel);
      const hit = c => (sel === 'canvas' ? c.tag === 'canvas' : sel === '.pb-bookmark-pills' ? c.className === 'pb-bookmark-pills' : !!m && c.attrs['data-page'] === m[1]);
      const walk = n => { for (const c of n.children) { if (hit(c)) return c; const d = walk(c); if (d) return d; } return null; };
      return walk(this);
    },
    getBoundingClientRect() {
      const p = this.parent; if (!p) return { top: 0 };
      let y = 0; for (const c of p.children) { if (c === this) break; y += heightOf(c); }
      return { top: y - (p.scrollTop || 0) };
    },
  };
  if (log) el.log = log;
  return el;
}

async function rig() {
  const app = loadApp(), sb = app.sandbox;
  const writes = [];                       // every write to the viewer, the counter, or a scroll
  const container = makeEl('div', writes), counter = makeEl('div', writes);
  container.scrollTop = 0; container.clientWidth = 800; container.clientHeight = 600;
  Object.defineProperty(container, 'scrollHeight', { get() { return this.children.reduce((s, k) => s + heightOf(k), 0); } });
  container.scrollTo = function (o) { writes.push(['scroll', o.top]); this.scrollTop = o.top; };
  const realDoc = sb.document;
  sb.document = new Proxy(realDoc, { get(t, p) {
    if (p === 'getElementById') return id => (id === 'ofpViewerContainer' ? container : id === 'ofpPageCounter' ? counter : t.getElementById(id));
    if (p === 'createElement') return tag => makeEl(tag);
    return t[p];
  } });

  // Animation frames: run at once, or queued while held.
  const hold = { raf: false, pdfjs: false, doc: false, index: false };
  const rafQ = [];
  sb.requestAnimationFrame = fn => { if (hold.raf) rafQ.push(fn); else fn(); return 0; };
  // pdf.js script load: one shared promise, as the app's own loadPdfJs() keeps one (src/import.html).
  let pdfjs = null;
  sb.loadPdfJs = () => {
    if (!pdfjs) { pdfjs = defer(); if (!hold.pdfjs) pdfjs.resolve(); }
    return pdfjs.promise;
  };
  // Documents: one per getDocument() call, held while hold.doc is set.
  const docs = [];
  sb.pdfjsLib = { getDocument({ data }) {
    const k = flightOf(data.byteLength), F = FLIGHTS[k];
    const d = { flight: k, open: defer(), outline: defer(), index: defer(), pages: {}, getPage: [], getPageIndex: 0, getOutline: 0 };
    for (let n = 1; n <= F.total; n++) d.pages[n] = defer();
    d.pdf = { numPages: F.total,
      getOutline: () => { d.getOutline++; return d.outline.promise; },
      getPageIndex: ref => { d.getPageIndex++; return hold.index ? d.index.promise.then(() => ref.i) : Promise.resolve(ref.i); },
      getDestination: () => { d.getPageIndex++; return Promise.resolve(null); },
      getPage: n => { d.getPage.push(n); return d.pages[n].promise.then(() => ({ getViewport: ({ scale }) => ({ width: 100 * scale, height: 125 * scale }), render() {} })); } };
    if (!hold.doc) d.open.resolve(d.pdf);
    docs.push(d);
    return { promise: d.open.promise };
  } };

  const set = (flight, text) => {
    vm.runInContext(`pdfArrayBuffer = ${flight ? `new ArrayBuffer(${FLIGHTS[flight].bytes})` : 'null'}; pdfRawText = ${JSON.stringify(text || '')};`, sb);
  };
  const r = {
    app, sb, container, counter, writes, docs, hold, rafQ,
    set,
    // the OFP tab of the flight now loaded (as switchFlightTab('ofp') calls it)
    open: async () => { app.loadOFPPanel(); await flush(); },
    // open another flight: its bytes and text, a wipe (as loadFlight / importManual do), its OFP tab
    switchTo: async (flight, text) => { set(flight, text); app.clearOFPPanel(); app.loadOFPPanel(); await flush(); },
    doc: (flight, i = 0) => docs.filter(d => d.flight === flight)[i],
    // release everything a document is still waiting for: open, outline, every page
    finish: async d => {
      d.open.resolve(d.pdf); await flush();
      d.outline.resolve(FLIGHTS[d.flight].outline); d.index.resolve(); await flush();
      for (let n = 1; n <= FLIGHTS[d.flight].total; n++) { d.pages[n].resolve(); await flush(); }
    },
    releaseRaf: async () => { hold.raf = false; rafQ.splice(0).forEach(f => f()); await flush(); },
    releasePdfjs: async () => { hold.pdfjs = false; pdfjs.resolve(); await flush(); },
    failPdfjs: async () => { hold.pdfjs = false; pdfjs.reject(new Error('offline')); pdfjs = null; await flush(); },
    mark: () => writes.length,
    since: m => writes.slice(m),
    labels: () => container.children.filter(c => c.attrs['data-page']).map(w => w.children[1].textContent),
    rows: () => container.children.filter(c => c.className === 'pb-bookmark-pills'),
    proxy: () => vm.runInContext('_pdfDocProxy', sb),
  };
  return r;
}

// The viewer holds exactly flight F's pages 1..N in order, once, its counter and its one pill row.
function assertWhole(r, flight) {
  const F = FLIGHTS[flight];
  assert.deepEqual(r.labels(), Array.from({ length: F.total }, (_, i) => `${i + 1} / ${F.total}`));
  assert.equal(r.counter.textContent, `${F.total} pages`);
  assert.equal(r.rows().length, 1);
  assert.deepEqual(r.rows()[0].children.map(b => b.textContent), [F.label]);
  assert.equal(r.container.children[0].className, 'pb-bookmark-pills');
}
const describe = w => w.map(([k, v]) => k + ':' + (typeof v === 'string' ? v.slice(0, 40) : v && v.attrs ? (v.className || 'page ' + v.attrs['data-page']) : v));

let unhandled = 0;
process.on('unhandledRejection', () => { unhandled++; });

// ── T2 positive: one flight, nothing superseded ──────────────────────────────────────────────
test('T2 positive: one flight draws pages 1..N once, in order, with its counter and one pill row', async () => {
  const r = await rig();
  r.set('A'); await r.open(); await r.finish(r.doc('A'));
  assertWhole(r, 'A');
  assert.deepEqual(r.doc('A').getPage, [1, 2, 3, 4]);
  assert.deepEqual(r.since(0).filter(w => w[0] === 'scroll'), []);
  assert.equal(r.proxy(), r.doc('A').pdf);
});

// ── T1 (and T6 for A1, A2, A4, A5): a switch to flight B at each phase of A's render ─────────
const PHASES = {
  'pdf.js load (A1)':     { setup: r => { r.hold.pdfjs = true; }, release: r => r.releasePdfjs() },
  'getDocument (A2)':     { setup: r => { r.hold.doc = true; },   release: r => r.finish(r.doc('A')) },
  'before the animation frame (A4)': { setup: r => { r.hold.raf = true; }, release: r => r.releaseRaf() },
  'mid-chain (A5)':       { setup: () => {}, mid: true },
};
for (const [phase, P] of Object.entries(PHASES)) {
  test(`T1 negative / positive: switch to flight B during A's ${phase}: A writes nothing after the switch, B is whole`, async () => {
    const r = await rig();
    P.setup(r);
    r.set('A'); await r.open();
    if (P.mid) { const a = r.doc('A'); a.open.resolve(a.pdf); a.pages[1].resolve(); a.pages[2].resolve(); await flush();
      assert.deepEqual(r.labels(), ['1 / 4', '2 / 4'], 'A is mid-chain at the switch'); }
    const aPagesAtSwitch = r.doc('A') ? r.doc('A').getPage.length : 0;
    r.hold.doc = false;
    await r.switchTo('B');
    if (P.release && phase.startsWith('pdf.js')) { await P.release(r); }       // the shared script load ends: A first, then B
    if (phase.startsWith('before the animation')) await P.release(r);          // A's frame, then B's
    await r.finish(r.doc('B'));
    assertWhole(r, 'B');
    const m = r.mark();
    // Now everything A is still waiting for comes back.
    if (phase.startsWith('getDocument')) await P.release(r);
    if (r.doc('A')) await r.finish(r.doc('A'));
    assert.deepEqual(describe(r.since(m)), [], 'A wrote nothing after it was superseded');
    assertWhole(r, 'B');
    assert.deepEqual(r.since(0).filter(w => w[0] === 'scroll'), []);
    // A asked pdf.js for nothing more: no document (A1), no page (A4, A5), no outline destination (A3).
    if (phase.startsWith('pdf.js')) assert.equal(r.doc('A'), undefined, 'A opened no document');
    else {
      assert.equal(r.doc('A').getPage.length, P.mid ? 3 : aPagesAtSwitch, 'A requested no page after the switch');
      if (phase.startsWith('before the animation')) assert.deepEqual(r.doc('A').getPage, []);
    }
    assert.equal(r.proxy(), r.doc('B').pdf, 'the document kept is B\'s');
  });
}

// ── T4 / F-5: when a render takes its number ─────────────────────────────────────────────────
const RESETS = {
  'clearOFPPanel()':       r => r.app.clearOFPPanel(),
  "push('screen-flight')": r => r.app.push('screen-flight'),
  'a new loadOFPPanel()':  r => r.app.loadOFPPanel(),
};
for (const [name, reset] of Object.entries(RESETS)) {
  test(`T4 F-5 negative: A's document is held, ${name}, then it opens: A makes 0 writes`, async () => {
    const r = await rig();
    r.hold.doc = true;
    r.set('A'); await r.open();
    reset(r); await flush();
    const m = r.mark();
    await r.finish(r.doc('A', 0));
    assert.deepEqual(describe(r.since(m)), [], 'the superseded render wrote nothing');
    assert.deepEqual(r.doc('A', 0).getPage, []);
    assert.equal(r.doc('A', 0).getOutline, 0);
  });
}

// ── T5 / F-6: render 2's document opens first, then render 1's ───────────────────────────────
test('T5 F-6 negative / positive: a stale render never removes or replaces the live pill row; a waiting tap on it still fires', async () => {
  const r = await rig();
  r.hold.doc = true;
  r.set('A'); await r.open();
  await r.switchTo('B');
  const b = r.doc('B');
  b.open.resolve(b.pdf); await flush();                       // render 2 opens first
  b.outline.resolve(FLIGHTS.B.outline); await flush();
  b.pages[1].resolve(); await flush();
  const row = r.rows()[0];
  assert.ok(row, 'B\'s row is in the viewer');
  row.children[0].listeners.click();                          // TLR → page 2, not drawn yet: the tap waits
  assert.deepEqual(r.since(0).filter(w => w[0] === 'scroll'), []);
  const m = r.mark();
  await r.finish(r.doc('A'));                                 // render 1's document opens afterwards
  assert.deepEqual(describe(r.since(m)), [], 'render 1 wrote nothing (no wipe, no row, no page)');
  assert.equal(r.rows()[0], row, 'the live row is still the one in the viewer');
  b.pages[2].resolve(); await flush(); b.pages[3].resolve(); await flush();
  assertWhole(r, 'B');
  assert.deepEqual(r.since(0).filter(w => w[0] === 'scroll').map(w => w[1]), [47 + 1016 - 47], 'the waiting tap fired once, to page 2');
});

// ── T6: each remaining writer of a superseded render ─────────────────────────────────────────
test('T6 A3 negative: outline result after the switch: no pill row and no destination lookup', async () => {
  const r = await rig();
  r.set('A'); await r.open();                                 // A's document is open, its outline held
  await r.switchTo('B'); await r.finish(r.doc('B'));
  const a = r.doc('A'), m = r.mark(), before = a.getPageIndex;
  a.outline.resolve(FLIGHTS.A.outline); await flush();
  assert.deepEqual(describe(r.since(m)), []);
  assert.equal(a.getPageIndex, before, 'A resolved no bookmark destination');
  assertWhole(r, 'B');
});

test('T6 A3 negative: destinations resolved after the switch: the pill row is not inserted', async () => {
  const r = await rig();
  r.hold.index = true;
  r.set('A'); await r.open();
  const a = r.doc('A');
  a.outline.resolve(FLIGHTS.A.outline); await flush();       // A still owns: its destinations are being resolved
  assert.equal(a.getPageIndex, 1);
  r.hold.index = false;
  await r.switchTo('B'); await r.finish(r.doc('B'));
  const m = r.mark();
  a.index.resolve(); await flush();
  assert.deepEqual(describe(r.since(m)), []);
  assertWhole(r, 'B');
});

test('T6 A3c negative: a tap on a superseded render\'s pill does not scroll or change its highlight', async () => {
  const r = await rig();
  r.set('A'); await r.open(); await r.finish(r.doc('A'));
  const staleBtn = r.rows()[0].children[0];                   // A's CHARTS → page 3
  await r.switchTo('B'); await r.finish(r.doc('B'));         // B has a page 3, so a stale tap would have a target
  assert.ok(r.container.querySelector('[data-page="3"]'));
  const m = r.mark();
  staleBtn.listeners.click();
  await flush();
  assert.deepEqual(describe(r.since(m)), []);
  assert.equal(staleBtn.style.background, undefined, 'no highlight');
});

test('T6 A3c positive: a tap on the owning render\'s pill scrolls and highlights, also after an early-return revisit', async () => {
  const r = await rig();
  r.set('A'); await r.open(); await r.finish(r.doc('A'));
  r.app.loadOFPPanel(); await flush();                        // tab away and back: canvas present, early return
  assert.equal(r.docs.length, 1);
  const btn = r.rows()[0].children[0];
  btn.listeners.click();
  assert.deepEqual(r.since(0).filter(w => w[0] === 'scroll').map(w => w[1]), [47 + 2 * 1016 - 47]);
  assert.equal(btn.style.background, 'var(--tint)');
});

test('T6 A6 negative: A\'s document fails after the switch: no error message, counter and document untouched', async () => {
  const r = await rig();
  r.hold.doc = true;
  r.set('A'); await r.open();
  r.hold.doc = false;
  await r.switchTo('B'); await r.finish(r.doc('B'));
  const m = r.mark();
  r.doc('A').open.reject(new Error('Invalid PDF structure')); await flush();
  assert.deepEqual(describe(r.since(m)), []);
  assertWhole(r, 'B');
  assert.equal(r.proxy(), r.doc('B').pdf);
});

test('T6 A6 positive: the owning render\'s document fails: the error is shown as on main', async () => {
  const r = await rig();
  r.hold.doc = true;
  r.set('A'); await r.open();
  r.doc('A').open.reject(new Error('Invalid <PDF> structure')); await flush();
  assert.equal(r.container.innerHTML, '<div class="ofp-raw" style="color:var(--sys-red);padding:var(--sp4)">PDF render error: Invalid &lt;PDF&gt; structure</div>');
  assert.equal(r.counter.textContent, '');
  assert.equal(r.proxy(), null);
});

test('T6 A7 negative: pdf.js fails to load after a switch to a pasted flight: A writes nothing, B\'s text stays', async () => {
  const r = await rig();
  r.hold.pdfjs = true;
  r.set('A', 'TEXT OF A'); await r.open();
  await r.switchTo(null, 'TEXT OF B');                       // a pasted import: no PDF bytes, text at once
  assert.equal(r.container.children[0].textContent, 'TEXT OF B');
  const m = r.mark();
  await r.failPdfjs();
  assert.deepEqual(describe(r.since(m)), []);
  assert.equal(r.container.children.length, 1);
  assert.equal(r.container.children[0].textContent, 'TEXT OF B');
});

test('T6 A7 positive: pdf.js fails to load for the owning render: its text is shown as on main', async () => {
  const r = await rig();
  r.hold.pdfjs = true;
  r.set('A', 'TEXT OF A'); await r.open();
  await r.failPdfjs();
  assert.equal(r.container.children.length, 1);
  assert.equal(r.container.children[0].className, 'ofp-raw');
  assert.equal(r.container.children[0].textContent, 'TEXT OF A');
  assert.equal(r.counter.textContent, '');
});

test('T6 A7 positive: pdf.js fails to load and there is no text: "No OFP imported yet." as on main', async () => {
  const r = await rig();
  r.hold.pdfjs = true;
  r.set('A', ''); await r.open();
  await r.failPdfjs();
  assert.equal(r.container.children[0].textContent, 'No OFP imported yet.');
});

test('positive: no PDF bytes: the text, or "No OFP imported yet.", at once as on main', async () => {
  const r = await rig();
  r.set(null, 'PASTED TEXT'); await r.open();
  assert.equal(r.container.children.length, 1);
  assert.equal(r.container.children[0].textContent, 'PASTED TEXT');
  r.set(null, ''); r.app.clearOFPPanel(); await r.open();
  assert.equal(r.container.children[0].textContent, 'No OFP imported yet.');
  assert.equal(r.docs.length, 0);
});

// ── T7: the bytes and the text are read when the render starts ───────────────────────────────
test('T7 negative: bytes set after the render started are not used (another PDF, or none)', async () => {
  for (const later of ['B', null]) {
    const r = await rig();
    r.hold.pdfjs = true;
    r.set('A'); await r.open();
    r.set(later);                                             // the global changes, the number does not
    await r.releasePdfjs();
    assert.equal(r.docs.length, 1);
    assert.equal(r.docs[0].flight, 'A', 'the document opened is the one the render started with');
    await r.finish(r.docs[0]);
    assertWhole(r, 'A');
  }
});

test('T7 negative: text set after the render started is not used by its text fallback (rig only, see the PR)', async () => {
  // In the app the text changes without a wipe only in _ofpRederive (src/storage.html), after pdf.js has
  // loaded; pdf.js loading is one shared promise, so this order is not reached there. The rig forces it.
  const r = await rig();
  r.hold.pdfjs = true;
  r.set('A', 'TEXT AT START'); await r.open();
  vm.runInContext('pdfRawText = "TEXT SET LATER"', r.sb);
  await r.failPdfjs();
  assert.equal(r.container.children[0].textContent, 'TEXT AT START');
});

// ── T8: the same flight rendered again before its first page (Exec: "Newer wins") ────────────
for (const held of ['getDocument', 'animation frame']) {
  test(`T8 negative / positive: OFP, Note, OFP before the first page (${held} held): one set of pages, one row`, async () => {
    const r = await rig();
    if (held === 'getDocument') r.hold.doc = true; else r.hold.raf = true;
    r.set('A'); await r.open();
    await r.open();                                           // no canvas yet: no early return, a newer render
    assert.equal(r.docs.length, 2);
    if (held === 'animation frame') await r.releaseRaf();
    await r.finish(r.doc('A', 1));                            // the newer render
    await r.finish(r.doc('A', 0));                            // the older one comes back afterwards
    assertWhole(r, 'A');
    assert.deepEqual(r.doc('A', 0).getPage, [], 'the older render requested no page');
    assert.equal(r.proxy(), r.doc('A', 1).pdf);
  });
}

test('T8 positive: OFP, Note, OFP after a page is drawn: the early return keeps the running render', async () => {
  const r = await rig();
  r.set('A'); await r.open();
  const a = r.doc('A'); a.open.resolve(a.pdf); a.pages[1].resolve(); await flush();
  await r.open();
  assert.equal(r.docs.length, 1);
  await r.finish(a);
  assertWhole(r, 'A');
});

// ── a reset with no new render ───────────────────────────────────────────────────────────────
for (const name of ['clearOFPPanel()', "push('screen-flight')"]) {
  test(`negative: ${name} mid-chain with no new render: the viewer stays empty`, async () => {
    const r = await rig();
    r.set('A'); await r.open();
    const a = r.doc('A'); a.open.resolve(a.pdf); a.pages[1].resolve(); await flush();
    RESETS[name](r); await flush();
    const m = r.mark();
    await r.finish(a);
    assert.deepEqual(describe(r.since(m)), []);
    assert.equal(r.container.children.length, 0);
    assert.equal(r.counter.textContent, '');
    assert.deepEqual(a.getPage, [1, 2]);
  });
}

test('no unhandled rejection in any of the above', async () => {
  await flush();
  assert.equal(unhandled, 0);
});
