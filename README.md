# Relief Pilot

**OFP Briefing Notes for Relief & Augmented Crew**

> A Progressive Web App for airline relief crew — parses Atlas Air / Polar Air Operational Flight Plans and generates structured Preflight, Enroute, and Descent briefing cards. Runs entirely on-device. No account, no backend, no data leaves the iPad.

---

## Live App

Once deployed, the app is available at:

```
https://<your-github-username>.github.io/<your-repo-name>/
```

Add to iPad Home Screen for the full PWA experience (standalone mode, safe-area insets, offline support).

---

## Repository Structure

```
relief-pilot/
├── .github/
│   └── workflows/
│       └── deploy.yml          ← GitHub Actions → GitHub Pages (auto-deploy on push to main)
├── icons/
│   ├── icon-192.png            ← PWA icon (192×192)
│   └── icon-512.png            ← PWA icon (512×512)
├── index.html                  ← Full single-page PWA (5,200+ lines)
├── wx-rules.js                 ← Weather interpretation engine (universal ESM/CJS/browser)
├── notam-rules.js              ← NOTAM evaluation engine (universal ESM/CJS/browser)
├── manifest.json               ← Web App Manifest (PWA metadata)
├── sw.js                       ← Service Worker (offline-first cache strategy)
└── README.md                   ← This file
```

---

## GitHub Pages Deployment

### One-time setup

**1. Enable GitHub Pages**

In your repository: **Settings → Pages → Source → GitHub Actions**

No branch selection required — the workflow deploys directly from Actions.

**2. Push to `main`**

Every push to `main` triggers `.github/workflows/deploy.yml`, which:
- Validates all required files are present
- Stamps the commit SHA and deploy timestamp into `index.html`
- Uploads the repo root as a Pages artifact
- Deploys to `https://<username>.github.io/<repo>/`

**3. Manual deploy (optional)**

In your repo: **Actions → Deploy to GitHub Pages → Run workflow**

### Deployment checklist

| Requirement | Detail |
|---|---|
| Pages enabled | Settings → Pages → Source → GitHub Actions |
| Branch | `main` (or update `deploy.yml` `branches:` to match yours) |
| `GITHUB_TOKEN` permissions | Already configured in `deploy.yml` (`pages: write`, `id-token: write`) |
| No build tool needed | Pure static files — no npm, no bundler |

---

## Rule Files

The weather and NOTAM interpretation engines are published as standalone modules.

### `wx-rules.js` — Weather Interpretation

```javascript
// ES module
import { parseMetar, parseTaf, classifyAirportStatus } from './wx-rules.js';

// CommonJS
const { parseMetar, parseTaf } = require('./wx-rules.js');

// Browser global (after <script src="wx-rules.js">)
const result = window.WxRules.parseMetar('METAR KJFK 041751Z 28015G22KT ...');
```

**Key exports:**

| Function / Constant | Description |
|---|---|
| `parseMetar(raw)` | Parse raw METAR/SPECI → structured object with ceiling, vis, flight category |
| `parseTaf(raw)` | Parse TAF → base forecast + change groups array |
| `classifyAirportStatus(ceilFt, visSm)` | 3-tier status: `OPEN` / `OPERATIONAL` / `RED` |
| `classifyAirportStatusFromRaw(visRaw, ceilFt)` | Accepts SM, KM, or 4-digit metre visibility strings |
| `classifyFlightCategory(ceilFt, visSm)` | Legacy LIFR / IFR / MVFR / VFR (backward compat) |
| `interpretSigmet(raw)` | Parse SIGMET text → phenomena, severity, flight levels |
| `interpretAirmet(raw)` | Parse AIRMET text → Sierra / Tango / Zulu series |
| `parsePirep(raw)` | Parse PIREP → turbulence, icing intensity, altitude |
| `convertUtcToLocal(hhmm, tz)` | Convert `"1430"` + `"EST"` → `{ local: "0930", display: "0930 EST" }` |
| `AIRPORT_STATUS` | 3-tier constant definitions |
| `FLIGHT_CATEGORIES` | Legacy LIFR/IFR/MVFR/VFR color map |
| `PRODUCT_VALIDITY` | Standard validity windows for all product types |

**Sources:** FAA AIP GEN 2.1, 2.2, 3.5 · ICAO Doc 4444

---

### `notam-rules.js` — NOTAM Evaluation Engine

```javascript
// ES module
import { evalNotams, parseNotam, xNW_standalone } from './notam-rules.js';

// CommonJS
const { evalNotams, parseNotam } = require('./notam-rules.js');

// Browser global
const { issues, rwyGroups, worst } = window.NotamRules.evalNotams(
  notamArray, 'DEST', etaMin, 'B748', '2026-04-15'
);
```

**Key exports:**

| Function / Constant | Description |
|---|---|
| `evalNotams(notams, role, etaMin, acftType, flightDateISO)` | **Primary engine** — evaluates an array of NOTAM strings for a given airport role and ETA. Returns `{ issues, rwyGroups, worst }` |
| `parseNotam(raw)` | Parse full ICAO NOTAM → structured object (Q-line, items A–G, decoded Q-code) |
| `classifyNotam(notam)` | Classify parsed NOTAM by operational priority (P1–P4) and category |
| `isNotamActive(notam, now?)` | Check if a NOTAM is currently active given current UTC time |
| `xNW_standalone(notamText, flightDateISO)` | Extract UTC `{startMs, endMs}` window from any Atlas/ICAO NOTAM text |
| `nwOverlap_standalone(window, etaMin, flightDateISO)` | Check if a NOTAM window overlaps with ETA ±60 min |
| `buildAcftProfile(icaoType)` | Build aircraft profile (wingspan, MTOW, wake cat) from ICAO designator |
| `interpretQCode(qcode)` | Decode ICAO Q-code → `{ subject, condition, description }` |
| `evalNotams` return shape | `{ issues: [{slot, level, text, active, rwy, label}], rwyGroups: Map, worst: 'red'\|'yellow'\|'green' }` |
| `AIRCRAFT_DATA` | Database of 60+ aircraft types with wingspan, MTOW, wake category |
| `NM` | All NOTAM regex pattern constants (`NM.GS_US`, `NM.APCH_US`, `NM.RWY_CLSD`, etc.) |

**`evalNotams` role values:**

| Value | Meaning |
|---|---|
| `'ORIG'` | Origin airport (departure window, slots: Closed RWY → TWY → SID → Approach → Alt MA) |
| `'DEST'` | Destination airport (arrival window, slots: Closed RWY → Approach U/S → Approach CHG → Alt MA → STAR → TWY) |
| `'ALT'` | Alternate airport (same slot scheme as DEST) |
| `'CFS ALT'` | ETOPS Critical Fuel Scenario alternate |

**Sources:** FAA AIP GEN 3.1 §5 · ICAO Doc 4444 Appendix 6

---

## App Features

### Briefing Tab — three phases

| Phase | Contents |
|---|---|
| **Preflight** | ATIS + Parking · OEI runway picker (TLR-parsed) · STAB trim · OFP Fuel (Block/MIN/FRES/GA) · Airport status dots · DDG · Overflights · Curfew alerts · Perishables · Notes pad |
| **Enroute** | TAXI (hh.mm) · OFF time (cascades to IN and all alt ETAs) · ETOPS entry time · POR/RDA window · Company report schedule · Scratchpad · ARINC HF frequency sheet (live fetch) |
| **Descent** | ATIS + Parking · Arrival Fuel (REMF / ALT1 / FRES / GA) |

### Airports Tab

Full airport cards for every release airport — ORIG, DEST, all alternates, CFS alternates. Weather and NOTAM data auto-populated from the OFP. Each card shows:
- ETA and WX evaluation window (ETA ±1 hr, or OFP CFS window for ETOPS alternates)
- Colour-coded status badge: **CLEAR** / **REVIEW** / **ALERT**
- Expandable weather and NOTAM groups with cross-runway grouping
- Curfew row with proximity alert (90 / 120 min thresholds)

### OFP Tab

Original OFP rendered page-by-page from the imported PDF (falls back to raw text when no PDF binary is available — e.g. loaded flights without re-import).

### Alternates Tab

Alternate routes parsed from the OFP, editable, individually copyable to clipboard. ETP coordinate block with copy buttons for each waypoint.

### FCIR / ASAP Toggle

Locks the flight entry (prevents deletion), highlights the flight row yellow in the Saved Flights list, and reveals a dedicated narrative notepad with clipboard copy. State persists across sessions until explicitly turned off.

---

## OFP Import

Three methods supported:

| Method | Steps |
|---|---|
| **PDF file** | Tap **+** → drop zone or file picker → selects PDF → parses automatically |
| **iOS Share** | Open PDF in Files or Mail → Share ↑ → **Relief Pilot** (requires Home Screen install) |
| **Paste text** | Tap **+** → paste OFP text into the text area → tap **Import Text** |

**Supported OFP formats:** Atlas Air, Polar Air Cargo (Atlas/Polaris dispatcher system)

---

## Offline Operation

The service worker (`sw.js`) caches the full app shell — `index.html`, `wx-rules.js`, `notam-rules.js`, `manifest.json`, and icons — on first visit. Subsequent visits and all core briefing functionality work fully offline.

The only feature requiring network access is the **ARINC HF frequency sheet** (fetches live from `radio.arinc.net`). When offline, a fallback link is shown.

---

## PDF Rendering — Script Error Fix

pdf.js version **2.16.105** is used (not the latest). The reason:

pdf.js 3.x spawns a cross-origin CDN Worker by default. Any internal worker exception propagates to `window.onerror` as an opaque `"Script Error"` string — a browser security guarantee that **cannot be suppressed or caught from JavaScript**. The workaround used here:

1. Both `pdf.min.js` **and** `pdf.worker.min.js` are loaded as regular `<script crossorigin="anonymous">` tags
2. `pdfjsLib.PDFJS.disableWorker = true` (2.x API) is set after load
3. `GlobalWorkerOptions.workerSrc = ''` prevents any Worker from being created
4. Zero Worker objects = zero cross-origin errors

---

## Design Standards

The UI is built to Apple Human Interface Guidelines and the project design token system:

| Token | Value | Standard |
|---|---|---|
| Minimum touch target | 44×44pt (`--touch: 44px`) | Apple HIG · UX Design Token Studio §6.4 |
| Minimum font size | 11px (`--type-overline`) | Apple HIG · UX Design Token Studio §6.3 |
| Body line-height | 1.4 (`lineHeightBody`) | Apple HIG · UX Design Token Studio §6.3 |
| Normal text contrast | ≥ 4.5:1 | WCAG 2.2 AA · Apple HIG |
| Motion respect | `prefers-reduced-motion` zeroes all transitions | WCAG 2.3.3 · Apple HIG |
| Dark mode | `prefers-color-scheme` via CSS custom properties | Apple HIG |

---

## Disclaimer

**Relief Pilot is NOT certified aviation software.**

It is an informational reference tool only. All data must be independently verified against the official OFP and dispatch release. Do not use as the sole reference for any operational decision.

---

## Version

`v1.9.0-dev` · Built for Atlas Air / Polar Air Cargo B747-400F / B747-8F operations

**Reference documents:**
- `ux-design-token-studio.md` v1.1.0 — Design tokens
- `qa-framework-multiplatform.md` v1.1 — QA standards (ISO/IEC 25010)
- `product-lifecycle-framework.md` v1.1.0 — Lifecycle framework
- `apple-compliance-audit-relief-pilot.md` v1.0.0 — Apple HIG compliance record
- `wx-rules.js` — FAA AIP GEN 2.1, 2.2, 3.5 · ICAO Doc 4444
- `notam-rules.js` v1.9.0 — FAA AIP GEN 3.1 §5 · ICAO Doc 4444 Appendix 6
