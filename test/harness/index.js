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
const EXPOSED = ['_ofpRulesetParse', '_splitNotams', 'evalNotams', 'xNW_standalone',
                 'getFlights', 'putFlights', 'loadFlight', 'deleteFlight',
                 '_saveResumeView', '_clearResumeView',
                 // V0 (app-path golden, NOTAM-evaluation golden): the real import path
                 // and the helpers src/airports.html uses around evalNotams().
                 'processPDF', 'parseOFP', 'getAllAirports', 'pZM', 'evalAirport',
                 // NOTAM ruleset module equivalence (test/rules): the window helpers evalNotams() uses.
                 'nwOverlap_standalone', '_windowEndEstimated'];
// The NOTAM functions the standalone module (rules/notam-rules) provides in place of the app's.
const NOTAM_MODULE_FNS = ['_splitNotams', 'evalNotams', 'xNW_standalone', 'nwOverlap_standalone', '_windowEndEstimated'];
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

// Opt-in model of document order (domModel: true). While the main script runs the
// page is still 'loading': getElementById() returns null for any element whose markup
// comes after the script in index.html, exactly as in a browser. fireDomReady() then
// behaves like DOMContentLoaded: it runs the registered listeners and every element
// becomes reachable. Elements start with the textContent written in the markup.
function makeDomModel(src, scriptPos, fallback) {
  const els = new Map();
  const re = /<(\w+)\b[^>]*?\bid="([^"]+)"[^>]*>([^<]*)/g;
  let m;
  while ((m = re.exec(src))) {
    if (els.has(m[2])) continue;
    const own = { id: m[2], textContent: m[3].trim(), _pos: m.index };
    els.set(m[2], new Proxy(own, {
      get: (t, p) => (p in t ? t[p] : fallback),
      set: (t, p, v) => { t[p] = v; return true; },
    }));
  }
  const model = { loaded: false, listeners: [], els };
  model.getElementById = id => {
    const el = els.get(id);
    if (!el) return null;
    return (model.loaded || el._pos < scriptPos) ? el : null;
  };
  model.fireDomReady = () => {
    model.loaded = true;
    model.listeners.splice(0).forEach(fn => fn());
  };
  return model;
}

function loadApp({ html, storageData, domModel } = {}) {
  const src = html != null ? html : fs.readFileSync(INDEX_HTML, 'utf8');
  const scripts = inlineScripts(src);
  const mainIdx = scripts.findIndex(s => s.includes('function _ofpRulesetParse'));
  if (mainIdx < 0) throw new Error('main inline script (with _ofpRulesetParse) not found in index.html');

  const stub = makeStub();
  const dom = domModel ? makeDomModel(src, src.indexOf(scripts[mainIdx]), stub) : null;
  const doc = new Proxy({
    getElementById: dom ? dom.getElementById : () => stub,
    querySelector: () => stub,
    querySelectorAll: () => [],
    getElementsByClassName: () => [],
    getElementsByTagName: () => [],
    createElement: () => stub,
    createTextNode: () => stub,
    addEventListener: (type, fn) => { if (dom && type === 'DOMContentLoaded') dom.listeners.push(fn); },
    removeEventListener: () => {},
    body: stub,
    documentElement: stub,
    head: stub,
    cookie: '',
  }, {
    get: (t, p) => (p === 'readyState' ? (dom && !dom.loaded ? 'loading' : 'complete') : (p in t ? t[p] : stub)),
    set: () => true,
  });

  class FakeDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(FIXED_NOW); }
    static now() { return FIXED_NOW; }
  }

  const ls = makeStorage();
  if (storageData) {
    Object.entries(storageData).forEach(function([k, v]) {
      ls.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    });
  }

  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    document: doc,
    navigator: { userAgent: 'node-test', serviceWorker: undefined, clipboard: stub, onLine: true },
    location: { href: 'http://localhost/', origin: 'http://localhost', search: '', hash: '', pathname: '/' },
    localStorage: ls,
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

  const exportLine = `\n;globalThis.__pb = { ${EXPOSED.map(n => `${n}: typeof ${n} === 'function' ? ${n} : undefined`).join(', ')}, S: (typeof S !== 'undefined' ? S : undefined), _navStack: (typeof _navStack !== 'undefined' ? _navStack : undefined), _getActiveFlightTab: function() { return typeof _activeFlightTab !== 'undefined' ? _activeFlightTab : undefined; } };\n`;
  new vm.Script(scripts[mainIdx] + exportLine, { filename: 'index.html:main-inline-script' })
    .runInContext(sandbox);

  const api = sandbox.__pb;
  for (const n of EXPOSED) if (typeof api[n] !== 'function') throw new Error(`${n} not found in index.html main script`);
  // PB_NOTAM_ENGINE=module (or a path to a module file): the direct NOTAM calls a test makes
  // (app.evalNotams, app._splitNotams, app.xNW_standalone, ...) go to the standalone NOTAM
  // ruleset module instead, loaded unmodified in this same sandbox (same fixed clock).
  // The app's own code (evalAirport, the import path) keeps using the app's engine.
  const engine = process.env.PB_NOTAM_ENGINE;
  if (engine) {
    const rulesDir = path.resolve(__dirname, '..', '..', 'rules');
    const file = engine === 'module'
      ? path.join(rulesDir, JSON.parse(fs.readFileSync(path.join(rulesDir, 'manifest.json'), 'utf8'))['notam-rules'].file)
      : path.resolve(engine);
    const mod = { exports: {} };
    vm.runInContext(`(function (module, exports) {\n${fs.readFileSync(file, 'utf8')}\n})`, sandbox,
      { filename: file })(mod, mod.exports);
    for (const n of NOTAM_MODULE_FNS) {
      if (typeof mod.exports[n] !== 'function') throw new Error(`${n} not exported by ${file}`);
      api[n] = mod.exports[n];
    }
    api.notamEngine = file;
  }
  return { ...api, sandbox, document: doc, fireDomReady: dom ? dom.fireDomReady : () => {} };
}

module.exports = { loadApp, inlineScripts, INDEX_HTML };
