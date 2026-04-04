# Relief Pilot

**OFP briefing notes for relief and augmented crew — Atlas Air / Polar Air Cargo**

> ⚠️ **Disclaimer:** Relief Pilot is NOT certified aviation software. It is an informational tool only. All data must be independently verified against the official OFP and dispatch release. Do not use as a sole reference for any operational decision.

---

## Overview

Relief Pilot is a progressive web app (PWA) that parses Atlas Air and Polar Air Cargo Operational Flight Plans (OFPs) and presents a structured, interactive briefing note. Designed for iPad, optimised for iPadOS Slide Over, and works fully offline in airplane mode after the initial load.

---

## Features

### OFP Import
- PDF upload via file picker or drag-and-drop
- iOS Share sheet (open OFP PDF in Files or Mail → Share → Relief Pilot)
- Paste raw OFP text

### Briefing Tab — Three Phase Cards

**Preflight**
- ATIS letter + notes and Parking (departure)
- OEI runway picker — TLR EFP procedures; SPECIAL proc display; SEE CO CHART notepad
- STAB trim entry
- OFP fuel (Block / MIN / FRES / GA) with Block color-coded by TOGW margin
- Notes section: airport status dots, DDG/MEL list with TLR badges, overflight permits, curfew alerts, perishables banner, free-text notepad

**Enroute**
- OFF time entry → live IN time recalculation using OFP ETE
- E.ENT — ETOPS airspace entry time (ETOPS flights)
- RDA — Redispatch Authorisation time (2 hrs before POR)
- POR — waypoint, time, and MINF
- CO RPT schedule at 4-hour intervals with RDA/POR suppression window
- Scratchpad (keyboard + Apple Pencil Scribble)

**Descent**
- Arrival airport status row with live color dot — tap ICAO to change arrival airport
- ATIS letter + notes and Parking (arrival — independent from departure fields)
- TLR Landing items displayed automatically below Parking
- Arrival fuel (REMF / ALT 1 / FRES / GA)

### Airports Tab
- Airport cards for every airport on the release
- NOTAM evaluation: runway closures, ILS/navaid U/S, Cat II/III NOT AVBL, approach minimums raised, curfews, volcanic ash
- Each alert item is tappable — shows the exact NOTAM entry or TAF group in full
- Weather categories: Open / Operational / Instruments / 🔴 with actual values
- Per-airport NOTAM and WX fields — auto-populated from OFP, crew-supplementable

### OFP Tab
- Original OFP rendered page-by-page from the imported PDF

### Alternates Tab
- Parsed alternate routes; per-route clipboard copy
- ETP waypoint coordinates (ETOPS flights)

### FCIR / ASAP Toggle
- Narrative notepad on every phase; flight ID turns yellow; deletion locked while active

### Additional
- **Per-user data isolation** — each browser profile has its own private storage namespace
- **Dark mode** — full iOS semantic color token system (light / dark / auto)
- **Slide Over optimised** — icon-only tab bar and compact layout at ≤400pt width
- **Apple Pencil Scribble** — all text fields accept stylus input
- **Offline-first** — service worker pre-caches app shell and pdf.js at install

---

## Repository Files

```
index.html              ← single-file app (all HTML/CSS/JS)
sw.js                   ← service worker (offline-first, cache rp-v1.9.0-dev-r2)
manifest.json           ← PWA manifest
notam-rules.js          ← NOTAM interpretation ruleset (reference / test module)
_headers                ← Netlify/Cloudflare Pages headers
icons/
  icon-192.png          ← PWA icon (192×192)  [add to repo manually]
  icon-512.png          ← PWA icon (512×512)  [add to repo manually]
.github/
  workflows/
    deploy.yml          ← GitHub Actions → GitHub Pages on push to main
```

---

## Supported OFP Formats

- **Atlas Air** (B747-8F, B747-400F) — primary format, fully tested
- **Polar Air Cargo** (B747-400F) — same dispatch system, same format

---

## Technology

- Vanilla HTML / CSS / JavaScript — zero runtime dependencies
- pdf.js 3.11.174 (CDN, pre-cached by service worker at install)
- iOS semantic color tokens aligned to `DesignTokens.swift`
- SF Pro / `-apple-system` font stack; 8pt spacing grid; 44pt touch targets
- Service worker: offline-first, cache-first with background revalidation, safe 503 fallback

---

## Changelog

### v1.9.0-dev-r2

#### Critical: service worker replaced
The `sw.js` in the repository was the original broken version — it was never wired into `index.html` (no `<link rel="manifest">`, no `serviceWorker.register()` call), and it did not pre-cache pdf.js. This build replaces it with the correct offline-first service worker. **This file must replace the old `sw.js` in the repository root.**

Changes in the new `sw.js`:
- `CACHE_NAME = 'rp-v1.9.0-dev-r2'` — forces cache bust on install
- `PRECACHE_URLS` includes app shell + pdf.js + pdf.worker — all pre-cached at install so the app works offline immediately after first load
- Cache-first fetch strategy with background revalidation for same-origin assets
- Safe `503` fallback response on total network failure — fetch handler never resolves to `undefined`
- GET-only filter; non-http protocols skipped

Changes in `index.html` to wire the SW:
- `<link rel="manifest" href="manifest.json">` added to `<head>`
- `navigator.serviceWorker.register('./sw.js')` added before `</body>`, deferred to `load` event
- `visibilitychange` → `reg.update()` so reopening the app checks for updates

#### SPECI observation parsing (fix)
- Origin airport weather sections opening with `SPECI` (special observation) were not parsed — the block parser anchored only on `^METAR ICAO`
- Fixed: anchor now matches `^(?:METAR|SPECI)\s+ICAO`

#### Approach minimums NOTAM rules (new)
Two new evaluation rules in both `index.html` (`evalAirport`) and `notam-rules.js` (`_classifyNotamSlot`):

**CAT II/III NOT AVBL → 🔴 Red**
Fires on `CAT II.*NOT AVBL` / `CAT III.*NOT AVBL` in Atlas OFP parenthetical format:
`ILS Z AND ILS Y RWY 07(CAT II) NOT AVBL DUE TO TEMPO OBST`

**IAP amended / minimums raised → ⚠ Yellow**
Fires on `IAP`, `INCREASED FR \d` (Atlas raised-minimums format), `DA/HAT`, `MDA/HAT`, `PROC NA`, `LPV DA`, `LNAV MDA`, `RNAV/RNP.*AMDT`. Catches:
- `ILS Z RWY 07(CAT I) INCREASED FR 287(200)FT TO 387(300)FT`
- `RNAV (RNP) Z RWY 07(LPV) INCREASED FR 430(343)FT TO 510(423)FT`
- `IAP LOS ANGELES INTL ILS OR LOC RWY 6L, AMDT 14A`

#### notam-rules.js updates
- `NM.CAT_II_NA` — new: Cat II/III NOT AVBL, handles Atlas parenthetical format
- `NM.IAP_CHG` — new: IAP/ILS/LPV/LNAV/RNAV/RNP amended minimums
- `NM.APCH_CHG` — expanded: added `INCREASED\s+FR\s+\d` alternative
- `_classifyNotamSlot()` DEST/ALT: `CAT_II_NA` → slot 2 red; `IAP_CHG` in slot 3
- `_classifyNotamSlot()` ORIG: `CAT_II_NA` → slot 4 red; `IAP_CHG` in slot 4

#### NOTAM raw data panel (fix)
- Tappable alert items now display in a `<pre>` block — previously used `<input>` (single-line, truncated all NOTAM text)

#### Descent subcard
- Arrival airport status row with tappable ICAO and airport picker
- TLR Landing items auto-displayed below Parking field

#### Per-user data isolation
- UUID-namespaced localStorage keys per browser profile; two crew members on one iPad with separate Safari profiles have fully isolated data

#### Help icon
- `?` icon in flight screen nav bar (left of FCIR toggle) opens Instructions directly

#### Slide Over layout (`@media (max-width: 400px)`)
- Tab bar icons only; enroute split stacks vertically; tighter padding throughout

#### Weather alert changes
- PROB40 standalone trigger removed
- "Below mins" label removed from alert text — values shown directly

---

### v1.9.0

- OFF time cascades IN time using OFP ETE; RDA = single time; POR + MINF
- DDG/MEL structured parse; TLR cross-reference badges; 25-series filtered
- ATIS + Parking per-phase isolation
- TOGW color coding fixed for `L` and `I` limit codes

---

### v1.8.x

- Per-NOTAM UTC timestamp window matching
- CFS / ETOPS alternate airport cards with OFP WX windows
- Curfew detection from STATION COMPANY NOTAMS
- FCIR / ASAP toggle with narrative and deletion lock

---

## License

Copyright © 2025. All rights reserved.

This software is proprietary and confidential. It is provided for **private use only** by authorized personnel. Unauthorized copying, distribution, modification, public deployment, or use by any person or organization outside of those explicitly authorized is strictly prohibited.

No open-source license is granted. This repository and its contents may not be forked, redistributed, sublicensed, or used as the basis for any derivative work without prior written permission.
