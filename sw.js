// ═══════════════════════════════════════════════════════
//  PilotBrief — Service Worker  v1.9.5
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

const CACHE_NAME    = 'pb-v1.9.5';
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
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────
// Cache-first for all requests. Background revalidation for
// same-origin assets keeps the cache fresh without blocking.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        if (url.origin === self.location.origin) {
          fetch(event.request)
            .then(response => {
              if (response && response.ok) {
                caches.open(CACHE_NAME).then(c => c.put(event.request, response));
              }
            })
            .catch(() => {});
        }
        return cached;
      }
      return fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => new Response('', {
          status:  503,
          headers: { 'Content-Type': 'text/plain' },
        }));
    })
  );
});
