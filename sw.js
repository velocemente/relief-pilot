// ═══════════════════════════════════════════════════════
//  Relief Pilot — Service Worker  v1.9.0
//  Strategy: Cache-first for app shell
//            Stale-while-revalidate for CDN assets
//            Network-only for live data (ARINC HF frequencies)
// ═══════════════════════════════════════════════════════
'use strict';

const CACHE_NAME   = 'rp-v1.9.0';
const PDFJS_VER    = '2.16.105';   // pinned — no Worker spawned, zero CORS errors

// ── App shell: cached at install, served offline ─────────────────────────────
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── CDN assets: cached after first fetch (stale-while-revalidate) ─────────────
// pdf.js 2.16.105 — worker script loaded as <script> tag so no Worker is created.
// Eliminates the cross-origin "Script Error" that plagued 3.x CDN worker setup.
const CDN_ASSETS = [
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.min.js`,
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.worker.min.js`,
];

// ── Live-data origins: always network, never cached ──────────────────────────
// ARINC HF frequency pages must always be fresh — crew safety data.
const NETWORK_ONLY_ORIGINS = [
  'radio.arinc.net',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install cache failed:', err))
  );
});

// ── Activate: purge old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Network-only: live data (ARINC HF, any external API not listed below)
  if (NETWORK_ONLY_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. CDN assets (pdf.js): stale-while-revalidate
  if (CDN_ASSETS.some(a => request.url.includes(a.split('/').pop()))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 3. Same-origin (app shell + rule files): cache-first, network fallback + update
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstWithUpdate(request));
    return;
  }

  // 4. Everything else: network only (don't interfere)
  event.respondWith(fetch(request));
});

// ── Cache strategies ─────────────────────────────────────────────────────────

function cacheFirstWithUpdate(request) {
  return caches.match(request).then(cached => {
    const networkFetch = fetch(request).then(response => {
      if (response && response.ok) {
        caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
      }
      return response;
    }).catch(() => cached);   // offline: fall back to cached copy
    return cached || networkFetch;
  });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(cached => {
    const networkFetch = fetch(request).then(response => {
      if (response && response.ok) {
        caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
      }
      return response;
    }).catch(() => cached);
    return cached || networkFetch;
  });
}
