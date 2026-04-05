# Relief Pilot

**OFP briefing notes for relief and augmented crew**  
Version 1.9.0-r3 · Atlas Air / Polar Air Cargo OFP format

---

## What It Is

Relief Pilot is a progressive web app (PWA) that parses an Atlas Air / Polar Air Cargo Operational Flight Plan and produces a structured crew briefing note. It runs entirely in the browser — no server, no account, no data leaves the device.

**Core capabilities:**
- PDF or text OFP import (Atlas/Polar format)
- Parsed flight header, fuel, ETOPS, POR, CFS/ETP, OEI/TLR, DDG/MEL
- Airport cards with weather and NOTAM evaluation for every release airport
- NOTAM evaluation per FAA AIP GEN 3.1 §5 and ICAO Doc 4444 — grouped by runway and taxiway, expandable to raw text
- Weather evaluation per FOM §7.1.31 — Open / Operational / Red thresholds
- Curfew detection from Company NOTAMs
- FCIR/ASAP narrative notepad
- Offline-first — works in airplane mode after first load

---

## Repository File Structure

```
/
├── index.html          # Entire application (HTML + CSS + JS, single file)
├── sw.js               # Service worker — offline-first cache strategy
├── manifest.json       # PWA manifest — app name, icons, display mode
├── _headers            # Netlify / Cloudflare Pages HTTP headers
├── icons/
│   ├── icon-192.png    # PWA icon (required for Add to Home Screen)
│   └── icon-512.png    # PWA icon (required for splash screen)
└── README.md           # This file
```

> **Icons:** The `icons/` directory ships empty in this release package.  
> Add `icon-192.png` and `icon-512.png` before deploying.  
> Both icons must be square PNG; `maskable` purpose is declared in the manifest.

---

## Deployment

### GitHub Pages

1. Push all files to the `main` (or `gh-pages`) branch root.
2. In the repository → **Settings → Pages**, set source to `main` / `(root)`.
3. GitHub will serve the site at `https://<user>.github.io/<repo>/`.

> **Note:** GitHub Pages does not process `_headers`. HTTP security headers are applied automatically at the Pages CDN level for standard headers (X-Frame-Options, X-Content-Type-Options). The service worker and manifest will work correctly without it.

### Netlify

1. Drag-and-drop the `release/` folder onto [netlify.com/drop](https://netlify.com/drop), **or**
2. Connect the GitHub repository and set **publish directory** to `/` (repo root).
3. The `_headers` file is processed automatically — all MIME types, cache headers, and security headers are applied as specified.

### Cloudflare Pages

1. Connect the GitHub repository.
2. Set **build output directory** to `/` (repo root). No build command.
3. The `_headers` file is processed automatically.

### Self-hosted / Any static host

Serve the files from any web server. Ensure:
- `sw.js` is served with `Content-Type: application/javascript`
- `sw.js` is served from the root path (`/sw.js`) — required for full-scope service worker registration
- `manifest.json` is served with `Content-Type: application/manifest+json`
- `index.html` has `Cache-Control: no-cache` to ensure the latest version is always fetched

---

## Updating

### Releasing a new version

1. Increment `APP_VERSION` in `index.html`:
   ```js
   const APP_VERSION = '1.9.0-r3';   // → '1.9.1' or next version
   ```

2. Increment `CACHE_NAME` in `sw.js`:
   ```js
   const CACHE_NAME = 'rp-v1.9.0-r3';  // → 'rp-v1.9.1' etc.
   ```
   The cache name **must change** on every release. The service worker's `activate` handler deletes all caches whose name does not match `CACHE_NAME`, forcing clients to fetch fresh assets.

3. Update the comment header at the top of `sw.js`:
   ```js
   //  Relief Pilot — Service Worker  v1.9.0-r3
   ```

4. Commit and push. Connected clients will receive the update on the next page load that finds a changed `sw.js` (typically within 24 hours, or immediately on hard reload).

### Forcing immediate update on client devices

The service worker checks for updates on every navigation. Users can also:
- Hard reload (iOS Safari: close and reopen)
- Go to Settings → Clear browser cache

---

## OFP Format Support

| Carrier | Format | Status |
|---------|--------|--------|
| Atlas Air | Atlas/Polar dispatch system | ✅ Supported |
| Polar Air Cargo | Atlas/Polar dispatch system | ✅ Supported |
| Other carriers | — | ❌ Not supported in this build |

The OFP parser is fully separated into a ruleset module (`ofp-rules.js`, inlined). To add a new carrier format, the `PATTERNS`, `ALT_PATTERNS`, `WX_SECTION_LABELS`, and related constants can be updated independently without touching the parser logic.

---

## Ruleset Versions

| Ruleset | Version | Source |
|---------|---------|--------|
| OFP parser (`ofp-rules.js`) | 1.9.0 | Atlas/Polar dispatch system; ICAO Doc 4444 App 6 |
| NOTAM engine (`notam-rules.js`) | 1.9.0 | FAA AIP GEN 3.1 §5; ICAO Doc 4444 Appendix 6 |
| Weather engine (`wx-rules.js`) | 1.9.0 | FAA AIP GEN 3.5; FAA AIP GEN 2.2; ICAO Doc 4444 |

All three rulesets are inlined into `index.html` at build time.

---

## NOTAM Evaluation — How It Works

NOTAMs extracted from the OFP weather pages are evaluated by the NOTAM engine per FAA and ICAO standards. The engine:

- Splits the NOTAM blob into individual NOTAM entries at `- ICAO` boundaries
- Applies an aircraft-type applicability filter (wingspan limits, type restrictions)
- Checks each NOTAM's UTC effectivity window against the airport's ETA ±1 hour
- Classifies each NOTAM into a display slot (runway closure, ILS/navaid, procedure change, STAR, taxiway, etc.)
- Groups results by affected runway (`RWY-24L`, `RWY-07R`) and taxiway (`TAXIWAYS`)

**Display on the airport card:**
- Runway groups are collapsible — tap the row to expand individual triggers
- Each trigger is collapsible — tap to reveal raw NOTAM text
- All taxiway NOTAMs collapse under a single `Taxiway NOTAMs` group
- Only red/yellow (operational) items are shown; informational items are suppressed

---

## Weather Evaluation — Thresholds

Per FOM §7.1.31 (Atlas/Polar Terminal Weather Definitions):

| Category | Ceiling | Visibility | Badge |
|----------|---------|------------|-------|
| Open | ≥ 3,000 ft | ≥ 5 SM | 🟢 |
| Operational | 1,000–2,999 ft | 3–4.99 SM | 🟡 |
| Red | < 1,000 ft | < 3 SM | 🔴 |

Worst of ceiling and visibility governs. RVR thresholds: ≥ 4,000 ft = Open; 2,400–3,999 ft = Operational; < 2,400 ft = Red.

TEMPO and PROB40 groups are evaluated separately. PROB30 + significant weather (TS, FZRA, +SN, +RA) triggers an advisory.

---

## Disclaimer

Relief Pilot is **not** certified aviation software. It is an informational reference tool. All data must be independently verified against the official OFP and dispatch release. Do not use as a sole reference for any operational decision.

---

## License

Proprietary — internal use only. Not for distribution.
