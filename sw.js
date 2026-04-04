// ═══════════════════════════════════════════════════════
//  Relief Pilot — Service Worker  v1.9.0-dev-r2
//
//  Strategy: Offline-first (cache-first for everything)
//  ─────────────────────────────────────────────────────
//  The app must work fully in airplane mode after the
//  first online load. This means:
//
//    1. APP SHELL (index.html, manifest.json) → pre-cached
//       at SW install time; always served from cache first.
//
//    2. CDN ASSETS (pdf.js + worker) → pre-cached at install
//       time so PDF import works offline. Without this, the
//       first offline attempt to import a PDF would fail.
//
//    3. ALL REQUESTS → cache-first; if not in cache, try
//       network and cache the response; if network fails and
//       nothing is cached, return a safe fallback Response
//       rather than letting the fetch handler crash.
//
//  Data (flight records, settings) lives in localStorage —
//  the SW does not touch it; it survives SW updates cleanly.
// ═══════════════════════════════════════════════════════
'use strict';

const CACHE_NAME    = 'rp-v1.9.0-dev-r2';
const PDFJS_VERSION = '3.11.174';

// Everything the app needs to function offline.
// CDN assets are included so PDF import works in airplane mode
// after the first online session.
const PRECACHE_URLS = [
  // App shell
  './',
  './index.html',
  './manifest.json',
  // pdf.js — lazy-loaded at runtime but pre-cached here so it's
  // available even when the network is unreachable
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`,
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`,
];

// ── Install ───────────────────────────────────────────
// Pre-cache everything. If any asset fails, the SW install
// is aborted so the old SW stays active — safer than
// shipping a broken offline cache.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())   // activate immediately, don't wait for tab reload
  );
});

// ── Activate ─────────────────────────────────────────
// Delete every cache that isn't this version.
// This frees storage and ensures stale assets from old
// SW versions are never served.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // take control of open tabs immediately
  );
});

// ── Fetch ─────────────────────────────────────────────
// Cache-first for all requests.
//
// Flow:
//   1. Check cache  → hit: return immediately (offline-safe)
//   2. Cache miss   → fetch from network
//                     → on success: cache + return
//                     → on failure: return offline fallback
//
// This ensures:
//   • The app shell always loads in airplane mode
//   • pdf.js is available offline after first use
//   • No fetch handler ever resolves to undefined (which
//     would crash the browser's network stack)
self.addEventListener('fetch', event => {
  // Only handle GET requests — POST/PUT/DELETE pass through
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and non-http(s) requests
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Cache hit — return immediately.
        // Trigger a background revalidation for same-origin assets
        // so the cache stays fresh without blocking the user.
        if (url.origin === self.location.origin) {
          fetch(event.request)
            .then(response => {
              if (response && response.ok) {
                caches.open(CACHE_NAME)
                  .then(c => c.put(event.request, response));
              }
            })
            .catch(() => { /* network unavailable — fine, cached copy served */ });
        }
        return cached;
      }

      // Cache miss — fetch and cache
      return fetch(event.request)
        .then(response => {
          // Only cache valid responses (not opaque/error responses)
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME)
              .then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Network failed and nothing in cache.
          // Return a minimal offline fallback so the fetch handler
          // never rejects — a rejected respondWith() causes a
          // network error in the browser, which is worse than a
          // graceful empty response.
          return new Response('', {
            status:  503,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
    })
  );
});
