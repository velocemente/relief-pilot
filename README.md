# PilotBrief

**OFP briefing notes for relief and augmented crew**  
Version 1.9.7 · Atlas Air / Polar Air Cargo OFP format

---

## What It Is

PilotBrief is a progressive web app (PWA) that parses an Atlas Air / Polar Air Cargo Operational Flight Plan and produces a structured crew briefing note. It runs entirely in the browser — no server, no account, no data leaves the device.

**Core capabilities:**
- PDF or text OFP import (Atlas/Polar format); iOS Share sheet from Files/Mail
- Three-phase briefing note: Preflight / Enroute / Descent
- Parsed flight header, fuel (Block, MIN, REMF, ballast), ETOPS, POR, CFS/ETP, OEI/TLR, DDG/MEL, CAT II/III authorisation, slot time
- Radio callsign display (GIANT / POLAR / CAMBER / ACMI verbal callsign) with Heavy suffix from FPL field 9; callsign stacks above ETOPS in flight header
- Airport cards with weather and NOTAM evaluation for every release airport; WX/NOTAM/curfew re-evaluated automatically when OUT or OFF time is amended
- NOTAM tree grouped by runway in numerical order — Closed → Takeoff Minimums/ODP → Approach/Navaid → Lighting → Procedure
- GNSS/GPS/RAIM NOTAM enrichment — spatial detail (radius, altitude bounds) appended inline to GPS issue rows
- FICON (Field Condition) NOTAMs classified by runway and taxiway/ramp group
- NAT and PACOTS track message — both eastbound and westbound displayed, flight direction first; TMI · NAT/PAC T badge
- Weight unit (KGS/LBS) parsed from OFP narrative header
- Weather evaluation per FOM §7.1.31 — Open / Operational / Red thresholds
- Enroute phase: OFF time pre-populated from OUT + OFP taxi time; editable by crew; enroute timeline (ETOPS entry, POR, RDA) derived from effective OFF
- Inflight rest schedule (14 CFR 121.467): three-phase (thirds / halves / quarters) for 3- and 4-pilot augmented crews; TOC computed from effective OFF + OFP elapsed time
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
├── manifest.json       # PWA manifest — app name, icons, display mode, Share Target
├── icon192.png         # PWA icon — Add to Home Screen (192 × 192)
├── icon512.png         # PWA icon — splash / store (512 × 512)
├── _headers            # HTTP cache / security headers (Cloudflare Pages)
├── .gitignore          # Excludes OFP PDFs and dev artefacts
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
4. iOS Share from Files / Mail then routes PDFs directly into the app via the Web Share Target API.

---

## Offline Behaviour

The service worker pre-caches `index.html`, `manifest.json`, `icon192.png`, `icon512.png`, and the pdf.js CDN assets at install time. Shell assets are cached atomically (SW install aborts if any fail). CDN assets (pdf.js) are cached best-effort — a CDN timeout does not abort SW installation. After the first successful online load, the app is fully functional in airplane mode. Flight data is persisted in `localStorage` — the service worker never touches it. PDF blobs are stored separately in IndexedDB.

Cache key: `pb-v1.9.7` — bump this string in `sw.js` with every release to force clients to pick up updated assets.

---

## Release Notes

### v1.9.7 (current)

**Header Layout**
- Callsign and ETOPS now stack vertically in the flight header right column — callsign above, ETOPS below. Previously they were siblings in the flex row and interfered with each other when both were present.

**Enroute Phase**
- OFF time pre-populated from `OUT + OFP taxi time` when crew has not yet entered actual wheels-off. A basis badge (`OUT+Nm`) distinguishes the computed value from a manually entered time.
- Crew taps OFF to enter actual wheels-off; badge clears on manual entry.
- Enroute timeline (ETOPS entry, POR, RDA) and inflight rest schedule derive from the effective OFF (manual > computed > OUT fallback).

**Airport Status Cascade**
- Editing OUT or OFF time now immediately re-evaluates WX, NOTAMs, and curfews for all airports. Previously only ETAs were updated; airport cards required a manual tab switch to refresh.

**GNSS NOTAM Enrichment**
- GPS/GNSS/RAIM NOTAMs classified by the existing `evalNotams()` engine are now enriched with spatial detail parsed by the new GNSS Ruleset (`evalGNSS()`): radius in NM and altitude bounds appended inline to the issue row (e.g. `GPS/GNSS UNRELIABLE — WI 50NM SFC–FL280`).
- Supports 10 primary condition keywords (Interference, Unavailable, Outage, Loss, RAIM Outages, etc.) and three coordinate formats (decimal degrees, DMS, ICAO compact).

**PWA Installability**
- Icon files (`icon192.png`, `icon512.png`) now resolve at the repository root. Previously referenced as `icons/icon-*.png` (subdirectory that did not exist), preventing PWA install prompt on all platforms.

**Inflight Rest Module (internal)**
- `_deriveOffZ()` helper introduced — single source of truth for effective OFF across the enroute phase, inflight rest module, and TOC calculation. Eliminates double-taxi arithmetic that was present in the out-only fallback path.

### v1.9.6
- Web Share Target — PDF shared from Files.app or Mail loads directly into the import flow (installed PWA only)
- SW update notification banner — crew notified non-intrusively when a new version activates; session never interrupted automatically
- DDG page-footer bleed fix — page footer lines (`ATLAS AIR BRIEF PAGE X OF 65`) no longer appended to DDG item descriptions

### v1.9.5
- Descent card redesign with Airport section and bottom-sheet alternate picker
- DDG Landing subcard in descent phase
- Full array-per-airport CAT II/III parser
- Hierarchical NOTAM tree with numerical runway sorting and tiered bucketing
- Ballast fuel support with yellow-highlighted caution row
- Narrow-viewport (≤400px) two-row nav bar
- Fully rewritten help screen
- Inflight Rest Module — 14 CFR 121.467 augmented crew rest scheduling (thirds / halves / quarters); TOC parsing from OFP route table; crew list parser with toggle chips; pre-landing buffer control; copy-to-clipboard

---

## Aircraft Support

| Type | OFP Format |
|---|---|
| B747-400F (GE CF6-80C2) | Atlas Air / Polar Air Cargo |
| B747-8F | Atlas Air |
| B747-400F (PW4056) | Atlas Air |

NOTAM and weather rulesets are modular and version-controlled per ADR-001 (Ruleset Modularity). Customer-specific rulesets are loaded at runtime from the CDN.

---

## Disclaimer

PilotBrief is **not** certified aviation software. It is an informational tool only. All data must be independently verified against the official OFP and dispatch release. Do not use as a sole reference for any operational decision.
