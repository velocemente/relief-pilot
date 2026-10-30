// ═══════════════════════════════════════════════════════
//  PilotBrief — Service Worker  v1.9.9
//
//  Strategy: Offline-first (cache-first, no background fetch)
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
//       Cache HIT: return cached response immediately.
//       No background revalidation — zero network activity
//       unless the crew explicitly requests an update.
//
//    4. SHARE TARGET POST → intercept multipart POST
//       from the OS share sheet, relay the PDF blob to
//       the 'pb-share-relay' cache, then redirect to
//       /?shared so the app consumer can import it.
//
//  Data (flight records, settings) lives in localStorage —
//  the SW does not touch it; it survives SW updates cleanly.
//
//  Update notification
//  ─────────────────────────────────────────────────────
//  When a new SW activates it posts SW_UPDATED to all open
//  clients. The app surfaces a non-blocking dismissible
//  banner; the crew member decides when to reload — the
//  session is never interrupted automatically.
//
//  Updates are crew-initiated via Settings → "Check for update"
//  (registration.update()). The SW is registered with
//  { updateViaCache: 'all' } so the browser does not fetch
//  sw.js on every navigation. iOS may still perform its own
//  SW script check on a Home Screen app reload (typically
//  once per 24 h per spec, but iOS behaviour may vary); that
//  check is outside app control and is the browser's own
//  update mechanism, not triggered by app code.
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

const CACHE_NAME    = 'pb-v1.9.9';
const PDFJS_VERSION = '3.11.174';

// ── Mandatory shell ────────────────────────────────────
// These must ALL succeed or SW installation is aborted.
// ONLY app-critical resources — icons are cosmetic.
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
];

// ── Optional shell (best-effort) ──────────────────────
// Icons for home screen / splash. A missing icon does NOT
// abort SW install — the app still works offline without them.
const ICON_URLS = [
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
// Phase 2 (icons + CDN) is best-effort — failures swallowed.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        cache.addAll(SHELL_URLS).then(() =>
          Promise.allSettled(
            [...ICON_URLS, ...CDN_URLS].map(url =>
              fetch(url, { cache: 'no-store' })
                .then(r => { if (r.ok) return cache.put(url, r); })
                .catch(() => {}) // missing icon or CDN — non-fatal
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

  // ── Navigation requests → app shell ──────────────────
  // iOS Home Screen PWA cold-start navigates to the stored start_url.
  // caches.match(event.request) performs an exact-URL lookup: if iOS
  // appends a timestamp query-param, or canonicalises the URL
  // differently from what was cached at install time, the lookup misses,
  // the fetch falls through to the network, and offline cold-start fails
  // with "Connect to Wi-Fi or cellular".
  //
  // Fix: for any in-scope navigate-mode request, serve ./index.html
  // from the cache by name — bypassing URL matching entirely.
  // Fallback chain: ./index.html → ./ → network → 503 stub.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html')
        .then(r => r || caches.match('./'))
        .then(r => r || fetch(event.request))
        .catch(() => new Response(
          'Offline — PilotBrief is loading. Flight data in localStorage is intact.',
          { status: 503, headers: { 'Content-Type': 'text/plain' } }
        ))
    );
    return;
  }

  // ── Cache-first GET ──────────────────────────────────
  // Cache hit → return cached response immediately; no background
  // fetch. Zero network activity from cached assets — prevents iOS
  // "Cellular Data is Turned Off" alerts when the app is moved into
  // Slide Over with cellular off.
  // Cache miss → try network; cache a successful response.
  // All network failures are silent — no UI message ever.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
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
