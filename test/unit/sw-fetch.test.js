'use strict';
// Unit tests for sw.js fetch handler:
//   cache hit  → return cached; fetch NEVER called
//   cache miss → fetch called once; response cached
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

const swSrc = fs.readFileSync(path.join(__dirname, '../../sw.js'), 'utf8');

function buildSwContext(opts) {
  const { cachePrimed, throwFetch } = opts || {};
  let fetchCallCount = 0;
  const cachedResponse  = { status: 200, ok: true, clone() { return cachedResponse; } };
  const networkResponse = { status: 200, ok: true, clone() { return networkResponse; } };
  const store = {};
  if (cachePrimed) store['https://app.example.com/index.html'] = cachedResponse;

  const mockCaches = {
    async match(req) {
      const k = typeof req === 'string' ? req : req.url;
      return store[k];
    },
    async open() {
      return {
        async put(req, resp) {
          const k = typeof req === 'string' ? req : req.url;
          store[k] = resp;
        },
        async addAll() {},
      };
    },
    async keys() { return []; },
  };

  const mockFetch = async (req) => {
    fetchCallCount++;
    if (throwFetch) throw new Error('network error');
    return networkResponse;
  };

  const handlers = {};
  vm.runInContext(swSrc, vm.createContext({
    caches: mockCaches,
    fetch:  mockFetch,
    self: {
      addEventListener(ev, fn) { handlers[ev] = fn; },
      skipWaiting() {},
      clients: { claim() {}, matchAll() { return Promise.resolve([]); } },
      location: { origin: 'https://app.example.com' },
      navigator: { onLine: true },
    },
    Response: class Response {
      constructor(body, init) {
        this.body   = body;
        this.status = (init || {}).status || 200;
        this.ok     = this.status < 400;
      }
    },
    URL, Promise, console: { log() {}, warn() {} },
  }));

  return {
    handlers,
    store,
    cachedResponse,
    networkResponse,
    get fetchCallCount() { return fetchCallCount; },
    async fire(reqUrl) {
      let p;
      handlers['fetch']({
        request: { url: reqUrl, method: 'GET', mode: 'no-cors' },
        respondWith(x) { p = x; },
        waitUntil() {},
      });
      return p;
    },
  };
}

test('sw fetch: cache HIT → fetch never called', async () => {
  const sw = buildSwContext({ cachePrimed: true });
  const result = await sw.fire('https://app.example.com/index.html');
  assert.equal(sw.fetchCallCount, 0, 'fetch must not be called on a cache hit');
  assert.equal(result, sw.cachedResponse, 'must return the cached response');
});

test('sw fetch: cache MISS → fetch called once, response stored in cache', async () => {
  const sw = buildSwContext({ cachePrimed: false });
  const result = await sw.fire('https://app.example.com/index.html');
  assert.equal(sw.fetchCallCount, 1, 'fetch must be called once on a cache miss');
  assert.equal(result, sw.networkResponse, 'must return the network response');
  assert.ok(sw.store['https://app.example.com/index.html'], 'network response must be stored in cache');
});

test('sw fetch: cache MISS + network failure → 503, fetch called once', async () => {
  const sw = buildSwContext({ cachePrimed: false, throwFetch: true });
  const result = await sw.fire('https://app.example.com/missing.js');
  assert.equal(sw.fetchCallCount, 1, 'fetch must be called once even when it fails');
  assert.equal(result.status, 503, 'must return 503 when both cache and network fail');
});
