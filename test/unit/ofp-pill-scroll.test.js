'use strict';
// DEF-024: a bookmark pill tap on the OFP tab must put the top of the page just below the sticky
// pill row. _ofpPillScrollTop() is the arithmetic only; the DOM reads stay in loadOFPPanel().
// Numbers are CSS px from a measured iPad layout: viewer top 111 (nav bar + tab bar above it),
// pill row 47 high.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness');

const app = loadApp();
const f = app._ofpPillScrollTop;
const CT = 111, BAR = 47, MAX = 100000;

test('positive: scroll so the page top sits just below the pill row', () => {
  // Page 24 is 27107 px down the content. The viewer starts at the top (scrollTop 0), so the page
  // top is on screen at containerTop + 27107 + the pill row that sits above page 1.
  assert.equal(f(0, CT, CT + 27107, BAR, MAX, true), 27107 - BAR);
});

test('positive: the result does not depend on where the viewer is scrolled now', () => {
  // Same page, viewer already scrolled 5000 px (or mid-way through an earlier smooth scroll):
  // the page top is on screen 5000 px higher, and the answer is the same.
  assert.equal(f(5000, CT, CT + 27107 - 5000, BAR, MAX, true), 27107 - BAR);
  assert.equal(f(27107, CT, CT, BAR, MAX, true), 27107 - BAR);
});

test('positive: the viewer\'s own offset on the screen is not added (the DEF-024 fault)', () => {
  // The old code added the offsets of the elements above the viewer (111 px) and took a fixed 52.
  const top = f(0, CT, CT + 27107, BAR, MAX, true);
  assert.notEqual(top, 27107 + CT - 52);
  assert.equal(top, 27060);
});

test('positive: page 1 sits just below the pill row, so no scroll is needed', () => {
  assert.equal(f(0, CT, CT + BAR, BAR, MAX, true), 0);
});

test('positive: never a negative position', () => {
  assert.equal(f(0, CT, CT + 10, BAR, MAX, true), 0);
});

test('positive: no pill row height is taken as 0, not NaN', () => {
  assert.equal(f(0, CT, CT + 500, undefined, MAX, true), 500);
  assert.equal(f(0, CT, CT + 500, NaN, MAX, true), 500);
});

test('negative: a page that is not drawn yet has no position (nothing is taken from it)', () => {
  assert.equal(f(0, CT, null, BAR, MAX, true), null);
  assert.equal(f(0, CT, undefined, BAR, MAX, false), null);
  assert.equal(f(0, CT, NaN, BAR, MAX, true), null);
  assert.equal(f(0, CT, Infinity, BAR, MAX, true), null);
});

test('negative: while pages are still being added, a position the viewer cannot reach yet waits', () => {
  // The newest page, in a narrow viewer: the pages added so far end 38 px before the position.
  assert.equal(f(0, CT, CT + 3000 + BAR, BAR, 2962, false), null);
});

test('positive: a position the viewer can reach is used even while pages are still being added', () => {
  assert.equal(f(0, CT, CT + 3000 + BAR, BAR, 3000, false), 3000);
});

test('positive: once every page is added the scroll end is the limit, so the scroll goes ahead', () => {
  assert.equal(f(0, CT, CT + 3000 + BAR, BAR, 2962, true), 3000);
});

test('positive: a fractional position is rounded down, so the page is never under the pill row', () => {
  // Page top 500.6 px below the viewer top, pill row 47: ideal 453.6, taken as 453 (page 0.6 px below the row).
  assert.equal(f(0, CT, CT + 500.6, BAR, MAX, true), 453);
  assert.equal(f(1000.4, CT, CT + 500.6 - 1000.4, BAR, MAX, true), 453);
});

// ── DEF-024 F-1: a bookmark tap that is still waiting for its page scrolls only while the render it
// came from still owns the OFP viewer. No browser: the app's own loadOFPPanel / clearOFPPanel / push run
// in the harness against a small fake DOM (a tree with a stacked layout: pill row 47 px, page 1000 px +
// 16 px margin, viewer 600 px high) and a fake pdfjsLib whose pages and outline are released by the test.
const vm = require('node:vm');

const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function heightOf(el) {
  if (el.className === 'pb-bookmark-pills') return 47;
  if (el.attrs['data-page']) return el.children[0].height + 16;
  return 0;
}
function makeEl(tag) {
  const el = {
    tag, children: [], parent: null, attrs: {}, listeners: {}, style: {}, className: '', textContent: '',
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { c.parent = this; this.children.push(c); return c; },
    insertBefore(c, ref) {
      c.parent = this; const i = ref ? this.children.indexOf(ref) : -1;
      if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c;
    },
    addEventListener(t, fn) { this.listeners[t] = fn; },
    getContext() { return {}; },
    get firstChild() { return this.children[0] || null; },
    get offsetHeight() { return heightOf(this); },
    // like a browser, setting innerHTML drops every child (they are no longer in the viewer)
    set innerHTML(v) { this.children.forEach(c => { c.parent = null; }); this.children = []; },
    get innerHTML() { return ''; },
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
  return el;
}
function makeContainer() {
  const c = makeEl('div');
  c.scrollTop = 0; c.clientWidth = 800; c.clientHeight = 600; c.scrolls = [];
  Object.defineProperty(c, 'scrollHeight', { get() { return this.children.reduce((s, k) => s + heightOf(k), 0); } });
  c.scrollTo = function (o) { this.scrolls.push(o.top); this.scrollTop = o.top; };
  return c;
}

const TOTAL = 4, TAP_PAGE = 3, TAP_TOP = 47 + 2 * 1016 - 47;   // page 3 sits below the row and two pages; minus the row
const OUTLINE = [{ title: 'ROOT', items: [{ title: 'Charts', dest: [{ i: TAP_PAGE - 1 }] }] }];

async function rig() {
  const app = loadApp(), sb = app.sandbox;
  const container = makeContainer(), counter = makeEl('div');
  const realDoc = sb.document;
  sb.document = new Proxy(realDoc, { get(t, p) {
    if (p === 'getElementById') return id => (id === 'ofpViewerContainer' ? container : id === 'ofpPageCounter' ? counter : t.getElementById(id));
    if (p === 'createElement') return makeEl;
    return t[p];
  } });
  sb.requestAnimationFrame = fn => { fn(); return 0; };
  sb.loadPdfJs = () => Promise.resolve();
  const docs = [];
  sb.pdfjsLib = { getDocument() {
    const d = { outline: defer(), pages: {} };
    for (let n = 1; n <= TOTAL; n++) d.pages[n] = defer();
    d.pdf = { numPages: TOTAL, getOutline: () => d.outline.promise, getPageIndex: ref => Promise.resolve(ref.i),
      getPage: n => d.pages[n].promise.then(() => ({ getViewport: ({ scale }) => ({ width: 100 * scale, height: 125 * scale }), render() {} })) };
    docs.push(d); return { promise: Promise.resolve(d.pdf) };
  } };
  vm.runInContext('pdfArrayBuffer = new ArrayBuffer(8)', sb);
  const r = {
    app, container, docs,
    open: async () => { app.loadOFPPanel(); await flush(); },
    outline: async (k = 0) => { docs[k].outline.resolve(OUTLINE); await flush(); },
    tap: () => container.querySelector('.pb-bookmark-pills').children[0].listeners.click(),
    draw: async (upTo, k = 0) => { for (let n = 1; n <= upTo; n++) { docs[k].pages[n].resolve(); await flush(); } },
  };
  return r;
}

const RESETS = {
  'clearOFPPanel()':           app => app.clearOFPPanel(),
  "push('screen-flight')":     app => app.push('screen-flight'),
  'a new loadOFPPanel()':      app => app.loadOFPPanel(),
};

test('F-1 positive: a waiting tap fires once, when its page is drawn, while its render owns the viewer', async () => {
  const r = await rig();
  await r.open(); await r.outline();
  r.tap();                                            // page 3 is not drawn yet
  assert.equal(r.container.querySelector('[data-page="3"]'), null);
  assert.deepEqual(r.container.scrolls, []);
  await r.draw(2); assert.deepEqual(r.container.scrolls, []);   // pages 1 and 2: nothing yet
  await r.draw(TOTAL);
  assert.deepEqual(r.container.scrolls, [TAP_TOP]);   // page 3 drawn: one scroll, to the right place
});

test('F-1 positive: a second loadOFPPanel that returns early (canvas present) does not cancel the waiting tap', async () => {
  const r = await rig();
  await r.open(); await r.outline(); await r.draw(1);
  assert.ok(r.container.querySelector('canvas'));
  r.tap();
  r.app.loadOFPPanel(); await flush();                // tab away and back: the early return, no wipe
  assert.equal(r.docs.length, 1);
  await r.draw(TOTAL);
  assert.deepEqual(r.container.scrolls, [TAP_TOP]);
});

for (const [name, reset] of Object.entries(RESETS)) {
  test(`F-1 negative: tap waiting, then ${name}: the old render's tap does not scroll`, async () => {
    const r = await rig();
    await r.open(); await r.outline();
    r.tap();
    reset(r.app); await flush();
    await r.draw(TOTAL, 0);                           // the old render keeps adding its pages
    assert.ok(r.container.querySelector('[data-page="3"]'), 'the target page was added after the reset');
    assert.deepEqual(r.container.scrolls, []);
  });

  test(`F-1 negative: ${name} before the old render's pill row exists, tap on that row afterwards: no scroll`, async () => {
    const r = await rig();
    await r.open();                                   // outline held: no pill row yet
    reset(r.app); await flush();
    await r.outline(0);                               // the row now lands in the wiped viewer
    assert.ok(r.container.querySelector('.pb-bookmark-pills'), 'the old render\'s row is in the viewer');
    r.tap();
    await r.draw(TOTAL, 0);
    assert.ok(r.container.querySelector('[data-page="3"]'), 'the target page was added after the reset');
    assert.deepEqual(r.container.scrolls, []);
  });
}
