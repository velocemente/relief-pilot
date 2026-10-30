# ADR-001 — Ruleset Modularity & Hot-Update Architecture

| Field | Value |
|---|---|
| **ID** | ADR-001 |
| **Title** | Ruleset Modularity & Hot-Update Architecture |
| **Status** | Accepted |
| **Date** | 2026-04-02 |
| **Authors** | Engineering Lead |
| **Reviewers** | Product — Relief Pilot |
| **Related** | Product Lifecycle Framework §4 (Build); QA Framework §2 (ISO/IEC 29119) |

---

## Context

Relief Pilot currently embeds all interpretation logic — NOTAM evaluation, weather categorisation, and OFP parsing — as inline JavaScript inside `index.html`. The standalone ruleset files (`notam-rules.js`, `wx-rules.js`) exist as reference/test modules but are **not wired to the airport card**. Instead, `evalAirport()` maintains a parallel, divergent copy of the same logic.

Three requirements have emerged that make this architecture inadequate:

1. **Regulatory updates** — NOTAM formats, weather thresholds, and OFP field layouts are governed by FAA/ICAO/airline dispatch. When these change, the app must be updatable without a full rebuild and redeployment.
2. **Multi-customer support** — A future Atlas Air customer and a future FedEx customer may define "below minimums" differently, use different OFP field names, or follow different NOTAM conventions. The app must serve both from the same codebase with per-customer rulesets.
3. **Divergence risk** — Two independent NOTAM engines (`evalAirport` and `evalNotams`) are a maintenance liability. Every new pattern must be added in two places, and the two engines are already out of sync (29 equipment gaps existed in `evalAirport` that were not present in `notam-rules.js`).

---

## Decision

### 1. Rulesets become versioned, independently-deployable JSON + JS files

Each ruleset is extracted from `index.html` into a standalone file:

| File | Contains | Customer-configurable |
|---|---|---|
| `notam-rules.js` | NOTAM slot definitions, NM patterns, `evalNotams()` | Yes — per-customer pattern overrides |
| `wx-rules.js` | Weather thresholds, flight category definitions | Yes — per-customer minima |
| `ofp-rules.js` | OFP parser regex anchors, field mappings | Yes — per-customer OFP format |

Each file exports a **version string** and a **schema version integer**. The loader validates both before activating.

### 2. A `RulesLoader` module handles fetch, cache, validation, and fallback

`rules-loader.js` is a new standalone module responsible for:
- Fetching the current ruleset version from `rules-manifest.json` (a lightweight JSON file, ~200 bytes)
- If a newer version exists: fetching the new ruleset file, validating its schema, storing it in `localStorage` under a namespaced key
- Serving the cached ruleset in offline mode
- Falling back to the **bundled baseline** (compiled into `index.html` at build time) if the remote fetch fails and no cached version exists

This makes ruleset updates a **zero-downtime, zero-rebuild operation**: push a new `notam-rules.js` to the CDN, bump `rules-manifest.json`, and the app picks it up on next online load — without touching `index.html` or `sw.js`.

### 3. `evalAirport()` is retired; all NOTAM evaluation routes through `evalNotams()`

The inline NOTAM logic in `evalAirport()` is removed. `evalAirport()` becomes a thin adapter that:
1. Calls `RulesLoader.get('notam')` to obtain the active ruleset
2. Calls `evalNotams()` from that ruleset
3. Converts the structured `{ issues, rwyGroups, worst }` result into the `{ color, issues }` shape the card renderer expects

This eliminates the divergence, ensures the 62-test battery covers exactly what the card executes, and enables per-customer NOTAM logic without branching `index.html`.

### 4. Service worker caches rulesets as versioned assets

`sw.js` is updated to:
- Pre-cache `rules-manifest.json` and the baseline ruleset files at install
- Serve cached ruleset files offline
- Treat ruleset files as **stale-while-revalidate** rather than cache-first, so updates propagate on the next online session

### 5. Customer configuration via `customer-config.json`

A per-deployment JSON file identifies the customer and points to their ruleset overrides:

```json
{
  "customer": "atlas-air",
  "displayName": "Atlas Air / Polar Air Cargo",
  "rulesets": {
    "notam": "notam-rules-atlas.js",
    "wx": "wx-rules-atlas.js",
    "ofp": "ofp-rules-atlas.js"
  },
  "schemaVersion": 2
}
```

A FedEx deployment would ship `customer-config.json` pointing to `notam-rules-fedex.js` with different OFP anchors and WX thresholds, sharing the same `index.html` and `sw.js`.

---

## Consequences

**Positive**
- Regulatory update = deploy one `.js` file + update `rules-manifest.json`. No app rebuild.
- Multi-customer support without forking `index.html`.
- Single NOTAM engine — 62-test battery covers production behaviour.
- Offline-safe: bundled baseline always present as fallback.
- Testable in isolation: each ruleset file is a standalone Node module with its own test suite.

**Negative / Mitigations**
- Added startup latency (~50–100ms) for manifest fetch on first online load. Mitigation: manifest is tiny (~200 bytes); served from CDN with `Cache-Control: max-age=300`.
- localStorage size limit (~5MB on iOS Safari). Mitigation: ruleset files are ~30–60KB each; three rulesets = ~150KB, well within limit.
- Schema validation complexity. Mitigation: schema version integers + mandatory export checklist; loader rejects files missing required exports rather than silently degrading.
- Malicious ruleset injection risk. Mitigation: rulesets served only from the same origin or a pinned CDN domain; loader validates schema, not arbitrary code execution paths.

---

## Alternatives Considered

| Option | Rejected Because |
|---|---|
| Keep all logic in `index.html`, update whole app | Requires full redeployment for regulatory changes; no customer modularity |
| ES module dynamic `import()` | Not supported in all iOS Safari PWA contexts without a bundler; service worker caching of dynamic imports is complex |
| Server-side rendering / API | Contradicts offline-first requirement; adds infrastructure cost |
| WASM ruleset container | Overkill; rulesets are regex/logic, not compute-intensive; adds complexity without benefit |

---

## Implementation Plan

Per Product Lifecycle Framework §4 Sprint Cycle:

| Sprint Item | Owner | Gate |
|---|---|---|
| `rules-loader.js` — fetch, validate, cache, fallback | Engineering | Unit tests pass, Node `--check` clean |
| `rules-manifest.json` — baseline for Atlas Air | Engineering | Schema validated by loader |
| `sw.js` update — ruleset caching strategy | Engineering | Offline test: cached ruleset served in airplane mode |
| `evalAirport()` adapter — retire inline NOTAM logic | Engineering | Existing 62 NOTAM tests + new integration test |
| `customer-config.json` — Atlas Air baseline | Engineering | Loader resolves correct ruleset |
| `ofp-rules.js` extraction | Engineering | OFP parser tests pass |
| QA test run — RUN-090 | QA | ISO/IEC 29119-3 test completion report |
