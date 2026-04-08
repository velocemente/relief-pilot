# PilotBrief

**OFP briefing notes for relief and augmented crew**  
Version 1.9.5 · Atlas Air / Polar Air Cargo OFP format

---

## What It Is

PilotBrief is a progressive web app (PWA) that parses an Atlas Air / Polar Air Cargo Operational Flight Plan and produces a structured crew briefing note. It runs entirely in the browser — no server, no account, no data leaves the device.

**Core capabilities:**
- PDF or text OFP import (Atlas/Polar format)
- Three-phase briefing note: Preflight / Enroute / Descent
- Parsed flight header, fuel (Block, MIN, REMF, ballast), ETOPS, POR, CFS/ETP, OEI/TLR, DDG/MEL, CAT II/III authorisation, slot time
- Airport cards with weather and NOTAM evaluation for every release airport
- NOTAM tree grouped by runway in numerical order — Closed → Takeoff Minimums/ODP → Approach/Navaid → Lighting → Procedure
- Weather evaluation per FOM §7.1.31 — Open / Operational / Red thresholds
- Descent phase: selectable airport summary (DEST + alternates), DDG landing items, CAT II/III per runway
- Curfew detection from Company NOTAMs
- FCIR/ASAP narrative notepad with copy-to-clipboard
- Offline-first — works in airplane mode after first load
- iPad Slide Over optimised (two-row nav bar at ≤ 400 px)

---

## Repository File Structure

```
/
├── index.html          # Entire application (HTML + CSS + JS, single file)
├── sw.js               # Service worker — offline-first cache strategy
├── manifest.json       # PWA manifest — app name, icons, display mode
├── _headers            # HTTP cache / security headers (Netlify / Cloudflare Pages)
├── .gitignore          # Excludes OFP PDFs and dev artefacts
├── icons/
│   ├── icon-192.png    # PWA icon — Add to Home Screen
│   └── icon-512.png    # PWA icon — splash / store
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions → GitHub Pages deployment
```

---

## Deployment

### GitHub Pages (recommended)

1. Push this repository to GitHub.
2. Go to **Settings → Pages → Source** and select **GitHub Actions**.
3. The `deploy.yml` workflow triggers automatically on every push to `main`.
4. Live URL: `https://<your-username>.github.io/<repo-name>/`

### Add to iPad Home Screen

1. Open the live URL in Safari on iPad.
2. Tap **Share ↑ → Add to Home Screen**.
3. The app installs as a standalone PWA with offline capability.
4. iOS Share from Files / Mail then routes PDFs directly into the app.

---

## Offline Behaviour

The service worker pre-caches `index.html`, `manifest.json`, and the pdf.js CDN assets at install time. After the first successful online load, the app is fully functional in airplane mode. Flight data is persisted in `localStorage` — the service worker never touches it.

Cache key: `pb-v1.9.5` — bump this string in `sw.js` with every release to force clients to pick up updated assets.

---

## Aircraft Support

| Type | OFP Format |
|---|---|
| B747-400F (PW4056) | Atlas Air / Polar Air Cargo |
| B747-8F | Atlas Air |

NOTAM and weather rulesets are modular and version-controlled. Customer-specific rulesets are loaded at runtime from the CDN (ADR-001 architecture).

---

## Disclaimer

PilotBrief is **not** certified aviation software. It is an informational tool only. All data must be independently verified against the official OFP and dispatch release. Do not use as a sole reference for any operational decision.
