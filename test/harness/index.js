'use strict';
// Loads index.html's main inline script into a Node vm with stubbed browser
// objects, and returns the functions the tests exercise. index.html is read,
// never modified; the only addition is an export line appended to the script
// text inside the vm.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// PB_INDEX_HTML lets a test run point at a modified copy (used to prove the gate bites).
const INDEX_HTML = process.env.PB_INDEX_HTML || path.resolve(__dirname, '..', '..', 'index.html');
const EXPOSED = ['_ofpRulesetParse', '_splitNotams', 'evalNotams', 'xNW_standalone'];
// Fixed "now" so anything that reads the clock is repeatable.
const FIXED_NOW = Date.UTC(2026, 9, 30, 0, 0, 0);

// All <script> blocks without a src, in document order.
function inlineScripts(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

// A stand-in for any DOM/browser object: every property is another stub,
// calling it returns a stub, and it converts to ''/0.
function makeStub() {
  const target = function () {};
  const handler = {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'then') return undefined;           // never look like a promise
      if (prop === 'length') return 0;
      if (prop === Symbol.iterator) return function* () {};
      if (prop === 'style' || prop === 'classList' || prop === 'dataset') return stub;
      return stub;
    },
    set() { return true; },
    apply() { return stub; },
    construct() { return stub; },
  };
  const stub = new Proxy(target, handler);
  return stub;
}

function makeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

function loadApp({ html } = {}) {
  const src = html != null ? html : fs.readFileSync(INDEX_HTML, 'utf8');
  const scripts = inlineScripts(src);
  const mainIdx = scripts.findIndex(s => s.includes('function _ofpRulesetParse'));
  if (mainIdx < 0) throw new Error('main inline script (with _ofpRulesetParse) not found in index.html');

  const stub = makeStub();
  const doc = new Proxy({
    getElementById: () => stub,
    querySelector: () => stub,
    querySelectorAll: () => [],
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    createElement: () => stub,
    createTextNode: () => stub,
    addEventListener: () => {},
    removeEventListener: () => {},
    body: stub,
    documentElement: stub,
    head: stub,
    readyState: 'complete',
    cookie: '',
  }, { get: (t, p) => (p in t ? t[p] : stub), set: () => true });

  class FakeDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(FIXED_NOW); }
    static now() { return FIXED_NOW; }
  }

  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    document: doc,
    navigator: { userAgent: 'node-test', serviceWorker: undefined, clipboard: stub, onLine: true },
    location: { href: 'http://localhost/', origin: 'http://localhost', search: '', hash: '', pathname: '/' },
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    history: stub,
    Date: FakeDate,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    fetch: () => Promise.reject(new Error('network disabled in tests')),
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    getComputedStyle: () => stub,
    addEventListener: () => {}, removeEventListener: () => {},
    alert() {}, confirm: () => false, prompt: () => null,
    performance: { now: () => 0 },
    URL, URLSearchParams, TextEncoder, TextDecoder,
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    Blob: function Blob() {}, File: function File() {}, FileReader: function FileReader() {},
    Image: function Image() {}, Notification: undefined, caches: undefined, indexedDB: undefined,
    IntersectionObserver: function () { return { observe() {}, disconnect() {} }; },
    ResizeObserver: function () { return { observe() {}, disconnect() {} }; },
    MutationObserver: function () { return { observe() {}, disconnect() {} }; },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const exportLine = `\n;globalThis.__pb = { ${EXPOSED.map(n => `${n}: typeof ${n} === 'function' ? ${n} : undefined`).join(', ')} };\n`;
  new vm.Script(scripts[mainIdx] + exportLine, { filename: 'index.html:main-inline-script' })
    .runInContext(sandbox);

  const api = sandbox.__pb;
  for (const n of EXPOSED) if (typeof api[n] !== 'function') throw new Error(`${n} not found in index.html main script`);
  return { ...api, sandbox };
}

module.exports = { loadApp, inlineScripts, INDEX_HTML };
