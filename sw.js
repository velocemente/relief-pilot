// ═══════════════════════════════════════════════════════
//  PilotBrief — Service Worker  v1.9.6
//
//  Strategy: Offline-first (cache-first for everything)
//  ─────────────────────────────────────────────────────
//  The app must work fully in airplane mode after the
//  first online load. This means:
//
//    1. APP SHELL (index.html, manifest.json, icons)
//       → pre-cached atomically at SW install time;
//         always served from cache first.
//
//    2. CDN ASSETS (pdf.js + worker) → best-effort
//       pre-cache at install time. A CDN timeout on a
//       slow or metered connection does NOT abort SW
//       installation. The lazy-loader in index.html will
//       retry when the device is next online.
//
//    3. ALL GET REQUESTS → cache-first; if not in cache,
//       try network and cache the response; if network
//       fails and nothing is cached, return a safe
//       fallback Response rather than letting the fetch
//       handler crash.
//
//    4. SHARE TARGET POST → intercept multipart POST
//       from the OS share sheet, relay the PDF blob to
//       the 'pb-share-relay' cache, then redirect to
//       /?shared so the app consumer can import it.
//
//  Data (flight records, settings) lives in localStorage —
//  the SW does not touch it; it survives SW updates cleanly.
//
//  Offline behaviour on iOS Home Screen
//  ─────────────────────────────────────────────────────
//  All UI-visible error messages are suppressed when the
//  device is offline. Background revalidation failures are
//  swallowed (.catch(() => {})). The SW_UPDATED message is
//  only posted when a new SW actually activates — which
//  requires the browser to download a new sw.js — so the
//  update banner in index.html never appears offline.
//
//  Update notification
//  ─────────────────────────────────────────────────────
//  When a new SW activates it posts SW_UPDATED to all open
//  clients. The app surfaces a non-blocking dismissible
//  banner; the crew member decides when to reload — the
//  session is never interrupted automatically.
//
//  Listener in index.html (SW registration IIFE):
//    navigator.serviceWorker.addEventListener('message', function(e) {
//      if (e.data && e.data.type === 'SW_UPDATED') {
//        var b = document.getElementById('sw-update-banner');
//        if (b) b.classList.add('visible');
//      }
//    });
// ═══════════════════════════════════════════════════════
'use strict';

const CACHE_NAME    = 'pb-v1.9.7';
const PDFJS_VERSION = '3.11.174';

// ── Mandatory shell ────────────────────────────────────
// These must ALL succeed or SW installation is aborted.
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon192.png',
  './icon512.png',
];

// ── CDN assets (best-effort) ───────────────────────────
// Pre-cached so PDF import works offline after the first
// online session. A CDN failure does NOT abort SW install.
const CDN_URLS = [
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`,
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`,
];

// ── Install ───────────────────────────────────────────
// Phase 1 (shell) is atomic — any failure aborts install.
// Phase 2 (CDN)   is best-effort — failures are swallowed.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        cache.addAll(SHELL_URLS).then(() =>
          Promise.allSettled(
            CDN_URLS.map(url =>
              fetch(url, { cache: 'no-store' })
                .then(r => { if (r.ok) return cache.put(url, r); })
                .catch(() => {}) // CDN unreachable — lazy-loader will retry online
            )
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────
// Prune stale caches, claim all clients, then notify them
// a new version is available. pb-share-relay is preserved
// across activations (it is a separate, persistent store).
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== 'pb-share-relay')
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
      .then(clients => {
        clients.forEach(client =>
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME })
        );
      })
  );
});

// ── Fetch ─────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // ── Share Target relay (POST) ────────────────────────
  // The OS share sheet issues a multipart POST to ./?share-target
  // (as declared in manifest.json share_target.action).
  // Extract the PDF file, write it to a single-slot relay cache,
  // then redirect to /?shared. The _consumeSharedPDF() consumer
  // in index.html reads the relay cache and triggers the import flow.
  if (event.request.method === 'POST' && url.searchParams.has('share-target')) {
    event.respondWith((async () => {
      try {
        const data = await event.request.formData();
        const file = data.get('ofp_pdf');
        if (file) {
          const relay = await caches.open('pb-share-relay');
          await relay.put(
            'pb-pending-share',
            new Response(file, {
              headers: {
                'Content-Type': 'application/pdf',
                'X-PB-Filename': encodeURIComponent(file.name || 'OFP.pdf'),
              }
            })
          );
        }
      } catch (_) {
        // Relay write failure is non-fatal; consumer will find an
        // empty relay and return silently — no crash, no UI error.
      }
      // Redirect to the app with ?shared flag; consumer handles the rest.
      const dest = new URL(event.request.url);
      dest.search = '?shared';
      return Response.redirect(dest.href, 303);
    })());
    return;
  }

  // All remaining non-GET requests pass through unintercepted.
  if (event.request.method !== 'GET') return;

  // ── Cache-first GET ──────────────────────────────────
  // Serve from cache immediately; revalidate same-origin assets
  // in the background. All network failures are silent — no UI
  // message is generated by this handler, ever.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Background revalidation — same-origin only.
        // Failure is swallowed: offline devices must not see errors.
        if (url.origin === self.location.origin) {
          fetch(event.request)
            .then(response => {
              if (response && response.ok) {
                caches.open(CACHE_NAME).then(c => c.put(event.request, response));
              }
            })
            .catch(() => {}); // offline — silent, intentional
        }
        return cached;
      }
      // Cache miss — try network; cache a successful response.
      return fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => new Response(
          'Offline — resource unavailable. Flight data in localStorage is intact.',
          { status: 503, headers: { 'Content-Type': 'text/plain' } }
        ));
    })
  );
});
