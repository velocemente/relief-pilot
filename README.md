# Relief Pilot

**OFP briefing notes for relief and augmented crew.**

Relief Pilot is a progressive web app (PWA) that parses Atlas Air / Polar Air Cargo Operational Flight Plans and presents a structured, interactive briefing note. Designed to run offline on iPad after installation from Safari.

> ⚠️ **Disclaimer:** Relief Pilot is NOT certified aviation software. It is an informational tool only. All data must be independently verified against the official OFP and dispatch release. Do not use as a sole reference for any operational decision.

---

## Features

- **OFP Import** — PDF upload, iOS Share sheet, or paste raw text
- **Briefing Tab** — Phase-segmented card (Preflight / Enroute / Descent):
  - **Preflight** — ATIS + Parking (Departure), OEI runway picker with TLR EFP procedures, STAB trim, OFP fuel (Block / MIN / FRES / GA color-coded by TOGW margin)
  - **Enroute** — OFF time entry → live IN time update (using OFP ETE), E.ENT (ETOPS), RDA single time, POR waypoint + time + MINF, CO RPT schedule with POR suppression window, scratchpad
  - **Descent** — ATIS + Parking (Arrival), arrival fuel (REMF / ALT1 / FRES / GA)
  - DDG/MEL list with TLR Takeoff / Landing cross-reference badges
  - Airport status dots, curfew alerts, perishables banner, free-text notes
- **Airports Tab** — Per-airport cards with WX/NOTAM evaluation, curfew proximity, ETA ±1hr window
- **OFP Tab** — Original OFP rendered page-by-page from the PDF
- **Alternates Tab** — Parsed alternate routes + ETP coordinates with copy buttons
- **FCIR / ASAP** — Toggle activates narrative notepad; flight locked from deletion while active
- **Dark Mode** — Full iOS semantic color token support (light/dark/auto)
- **Offline** — Service worker caches app shell; fully functional without network after first load

---

## Deployment

### GitHub Pages (automatic)

1. Push to `main` — the `.github/workflows/deploy.yml` workflow runs automatically
2. In repo **Settings → Pages**, set source to **GitHub Actions**
3. App is live at `https://<org>.github.io/<repo>/`

### Netlify / Cloudflare Pages

Deploy the repo root directly. The `_headers` file configures correct MIME types, cache headers, and security headers.

### iOS PWA Installation

1. Open the deployed URL in **Safari** on iPad or iPhone
2. Tap **Share → Add to Home Screen**
3. App installs as a standalone PWA with full offline support

### Required files at repo root

```
index.html          ← single-file app (all HTML/CSS/JS)
sw.js               ← service worker
manifest.json       ← PWA manifest
_headers            ← Netlify/Cloudflare Pages headers
icons/
  icon-192.png      ← PWA icon (192×192)
  icon-512.png      ← PWA icon (512×512)
.github/
  workflows/
    deploy.yml      ← GitHub Actions → GitHub Pages
```

---

## Changelog

### v1.9.0 — Enroute, DDG/TLR, ATIS/Parking isolation, TOGW fix

#### Enroute subcard — three correctness fixes

**1. OFF time cascades IN time and WX windows**
- Entering actual wheels-off time (OFF) now recalculates the IN time in the sticky header using the OFP ETE (`tripMinutes`)
- Formula: `IN = offZ + tripMinutes`
- Alternate ETAs also recalculate from `offZ`, adjusted for the OFP-implied taxi block (`destEtaOffsetMins − tripMinutes`)
- Previously entering OFF had no effect on any displayed time

**2. RDA — single time, displayed first**
- RDA is the single point in time when the crew must make the redispatch go/no-go decision: `porZ − 2 hours`
- Was incorrectly labelled `RDA WINDOW` and displayed as a range (`0830Z – 1030Z`)
- Now displays as a single time: `RDA  0423Z` — and appears **before** POR in the card

**3. POR — displayed second, with time + POR MINF**
- POR now shows: waypoint, time in Z, and the **POR MINF** (minimum fuel required on board at the POR to continue under the redispatch plan)
- POR MINF is parsed from column 2 of the OFP `MINF` line (the `(POR)→DEST` column present on RDA OFPs)
- Non-RDA OFPs (single MINF column) show no MINF — correct fallback
- Example: `POR  20N135E  0623Z` / `MINF 30679`

#### DDG / MEL parsing rewrite

- Structured line-by-line parse: ATA code on its own line → all indented description lines joined (including multi-line operational notes)
- TLR cross-reference: `crossRefTlrRmks()` scans `/// TAKEOFF DATA ///` and `/// LANDING DATA ///` sections for `RMKS <ATA-code>` lines independently
- Each DDG item tagged: `tlr: '' | 'takeoff' | 'landing' | 'both'`
- TLR badge rendered beneath description:
  - 🟡 `*TLR Takeoff` — yellow
  - 🔵 `*TLR Landing` — tint blue
  - 🟠 `*TLR Takeoff & Landing` — orange
- Duplicate items (release copy repeats) deduplicated on `code|desc` key
- 25-series (cabin/fuselage NEF) items filtered per company policy

#### ATIS + Parking — per-phase instance isolation

- Preflight/Departure and Descent/Arrival ATIS + Parking are now fully independent state fields
- `preAtisLetter`, `preAtisNotes`, `preParkingNotes` (Departure subcard)
- `descAtisLetter`, `descAtisNotes`, `descParkingNotes` (Arrival subcard)
- Previously both subcards shared the same state — entering arrival ATIS overwrote departure ATIS

#### New flight isolation hardened

- `loadFlight()` now calls `resetStateForNewFlight()` before restoring saved state
- Prevents any field from a previously-viewed flight bleeding into a newly-loaded one

#### TOGW color coding fixed

- Block fuel color was suppressed on flights where the TOGW limit code was `L` (MTOW based on LDW + trip fuel) or `I` (by dispatcher)
- The OFP documents four limit codes: `S-STRUCT  P-PERF  L-MTOW BASED ON LDW+TRIP FUEL  I-BY DISPATCHER`
- Old regex `[SP]` only matched structural and performance limits — `L` and `I` caused `togwLimit = 0`, suppressing color entirely
- Fixed to `[SPLI]` — all four limit types now correctly parsed

---

### v1.8.x — Airport evaluation, ETOPS, enroute foundations

- Per-NOTAM UTC timestamp window matching
- ETOPS entry time, POR, CO RPT schedule on Enroute phase (initial implementation)
- CFS / ETOPS alternate airport cards with OFP-provided WX windows
- Curfew detection engine from STATION COMPANY NOTAMS
- FCIR / ASAP toggle with narrative notepad and deletion lock
- TAF ETA window extraction (FM / TEMPO / BECMG / PROB group splitting)

---

## Supported OFP Formats

- **Atlas Air** (B747-8F, B747-400F) — primary format, fully tested
- **Polar Air Cargo** (B747-400F) — same dispatch system, same format

Other carriers using compatible Lido/Navtech format may parse partially.

---

## Technology

- Vanilla HTML / CSS / JavaScript — zero runtime dependencies
- pdf.js 3.11.174 (CDN, lazy-loaded on first PDF import)
- iOS semantic color tokens (`--sys-bg`, `--label`, `--tint`, etc.) aligned to `DesignTokens.swift`
- SF Pro / `-apple-system` font stack; 8pt spacing grid; 44pt touch targets throughout
- Service worker: cache-first for app shell, stale-while-revalidate for CDN assets
