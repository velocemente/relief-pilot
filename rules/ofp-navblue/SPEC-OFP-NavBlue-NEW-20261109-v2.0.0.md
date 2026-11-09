# SPEC-OFP-NavBlue

**Version:** v2.0.0 | **Status:** NEW | **Date:** 2026-11-09
**Owner:** Engineering | **Approver:** Exec
**Tier:** 2 — Platform Architecture
**Module file:** `rules/ofp-navblue/ofp-navblue-v2.0.0.js` (SHA-256 in `rules/manifest.json`)
**Architecture:** ADR-005 §2.1–2.4 (module catalogue, module standard, master copies and CI, OFP output contract)
**Ledger:** `RPT-OFP-NavBlue-RevisionLedger-NEW-20261109-v1.0.md` (beside this file)
**Supersedes:** master `CODE-OFP-AtlasPolar5yRuleset-NEW-20260513-v1.0.js` and `CODE-OFP-AtlasPolar5yRuleset-UPD-20260530-v1_1.js` with their SPECs (Drive "00_General Rulesets / 20_5Y specific / V1.0"). The archived v1.2 delta (D9) is not carried.

---

## 1. What this module is

The NavBlue OFP parser reads the text of an Atlas Air / Polar Air Cargo OFP package in the NavBlue (Navtech) format — the company PDF or the eOFP print, which give the same text — and returns the **briefing contract** the app consumes: flight identity, airports and times, ETOPS and redispatch, fuel, weights, crew, special conditions, CAT II/III, MEL/DDG, route, permits, TLR data and the per-airport weather / NOTAM / curfew / remarks text.

v2.0.0 is an **extraction**. It is the OFP parser the PilotBrief app runs today — `_ofpRulesetParse()` and everything it uses in `src/ofp-parse.html`, plus the two ENR V2 helpers it calls from `src/render-preflight.html` — copied into one standalone file on `main` at `d073e54`, renamed "NavBlue" and **locked** (§4). **Its core output is identical to the app's.** The proof is §9: the module and the app give the same 57 fields, value by value and in the same key order, on every NavBlue/eOFP fixture.

This PR does **not** build the module into `index.html`; `src/` and `index.html` are unchanged. Integration is a separate PR (ADR-005 §2.3.3, §8 below).

**Not in this module:** the `parseOFP()` adapter (merges the result into app state), `fuelK()`, `deriveCallsign()` (moves to the aircraft/callsign module, ADR-005 step 4), the D-EVAL timeline (`_tlBuild`, D51), the NAT track parser (its own module, passed in, §6), the rest of the en-route timeline (`buildTimelineEventsV2`, `validateEtpOrder`), and any UI.

---

## 2. Module standard (ADR-005 §2.2)

| Item | v2.0.0 |
| :--- | :--- |
| One standalone file | Yes. No `require`, no imports. |
| Dual context | Node: `module.exports = API`. rules-loader (`new Function('module','exports','require', code)`): same. Browser (a plain script): no `module` exists, so the API object is published once as the global **`OfpNavBlue`**. All declarations live inside one factory function, so none collides with the app's own names (`PATTERNS`, `RULESET_TYPE`, `extractEtopsExitV2` …), which still exist in the app until integration. |
| Metadata | `RULESET_TYPE = 'ofp'`, `OFP_FORMAT = 'navblue'`, `RULESET_VERSION = '2.0.0'`, `SCHEMA_VERSION = 2`, `CONTRACT_VERSION = '2.0'`, `RULESET_SOURCE` (NavBlue (Navtech) OFP issued by Atlas Air / Polar Air Cargo dispatch, company PDF and eOFP print; ICAO Doc 4444 App 6). |
| `SCHEMA_VERSION` | **2.** The export shape is new (`parseNavBlue`, the contract field lists) and the contract is v2.0, so the app's value 1 is not kept. |
| `validateSchema()` | Yes, §3.2. |
| No app state, no DOM, no UI | No `document`, storage, network or app state (`S`, `pdfRawText`, `window._flightDateISO`). The only global read is `window.parseNatTrack`, and only when the caller does not pass a NAT parser (§6) — exactly the app's call. |
| Strict mode | **On**, like the app's main inline script the code was copied from (it begins with `'use strict'`), so the copied code has the same semantics in Node and in the browser. |
| Clock | None. The parser does not read the clock. |
| Times | All UTC. OFP times are Z; no time-zone suffix is converted. |

---

## 3. Exports

### 3.1 API

```javascript
module.exports = {
  RULESET_TYPE, OFP_FORMAT, RULESET_VERSION, SCHEMA_VERSION, CONTRACT_VERSION, RULESET_SOURCE,
  validateSchema,            // (ruleset?) → { valid, errors[] }
  // SPEC v1.0 §4 — unchanged names
  PATTERNS,                  // primary regex map (47 entries: 46 RegExp + APT_LINE_TEMPLATE)
  ALT_PATTERNS,              // [{ key, role }] alternate keywords → crew roles
  CFS_PATTERNS,              // Critical Fuel Scenario (ETOPS) block
  WX_SECTION_LABELS, WX_METAR_ANCHOR, WX_NOTAM_START, WX_PAGE_HEADER,
  CAT_II_III_PATTERNS, COMPANY_NOTAM, TLR_PATTERNS, ALT_ROUTE_PATTERNS,
  MONTHS, MON_NAMES,
  elapsedToMins,             // (hh, mm) → minutes
  wxWindowMidpoint,          // ('HHMM', 'HHMM') → 'HHMM'
  normalizeWaypointCoord,    // '60N040W' → 'N60W040'
  _ofpRulesetParse,          // (rawText, options?) → core object | null
  // contract v2.0
  parseNavBlue,              // (rawText, options?) → contract object | null
  CORE_FIELDS,               // the 57 core field names, in order (Appendix A)
  EXTENSION_FIELDS,          // the 12 top-level extensions, in order (Appendix B)
  AIRPORT_EXTENSION_FIELDS,  // ['remarks', 'remarksWeather']  on airportData[icao]
  DDG_EXTENSION_FIELDS,      // ['type', 'notes']              on ddgItems[i]
};
```

Everything SPEC v1.0 §4 exports is exported under the same name. **Not exported** (app logic): `deriveCallsign`, `parseOFP`, `fuelK`; `validateSchema()` rejects an object that exports any of them.

### 3.2 `validateSchema(ruleset?)`

Checks (default: the module's own exports): every export in §3.1 is present with its type; `RULESET_TYPE === 'ofp'`; `OFP_FORMAT` non-empty; `RULESET_VERSION` semver; `SCHEMA_VERSION` an integer ≥ 2; `CONTRACT_VERSION` a 2.x contract; `RULESET_SOURCE` non-empty; every `PATTERNS` entry a RegExp (`APT_LINE_TEMPLATE` a function); the three `WX_*` anchors RegExps; `CORE_FIELDS` 57, `EXTENSION_FIELDS` 12, the two nested lists 2 each, all unique, no name both core and extension; none of the forbidden app exports. Returns `{ valid, errors[] }`.

---

## 4. Lock rule (ADR-005 §2.4; Exec, 7 Nov 2026; D47)

1. **The core fields are locked.** On every NavBlue/eOFP package, `_ofpRulesetParse()` and the core fields of `parseNavBlue()` must equal the app's `_ofpRulesetParse()` — all 57 fields, every nested value, the key order. Golden, V0 NOTAM-at-ETA and app-path snapshots stay unchanged.
2. **No extension work is planned for NavBlue.** Every Appendix B extension is returned as an explicit empty value (§5.3) and stays empty.
3. **Any change** to this module's output needs an Exec decision and its own gate (ADR-005 §2.2.6). The tests TC-130-010/011 fail on any difference; TC-130-020 proves they do.
4. The FlightKeys parser is measured against this one (FK-P): for the same OFP content it must give the rulesets what this parser gives.

---

## 5. Output contract v2.0

### 5.1 `_ofpRulesetParse(rawText, options?)`

Returns `null` when `rawText` is not a string, or is empty or whitespace only. Otherwise the core object, exactly as the app's: the 57 fields of ADR-005 Appendix A in this order —

`fltNum, acftType, weightUnit, isHeavy, dateStr, flightDateISO, origIcao, destIcao, offFromOFP, etaDest, destEtaOffsetMins, tripMinutes, taxiMins, etopsEntry, etopsSpec, etopsEntryMins, etopsExit, etopsExitMins, porWpt, porOffsetMins, porMinf, alt1Fuel, destRemf, blockFuelRaw, minfFuelRaw, fresFuelRaw, ballastFuel, crewMembers, tocOffsetMins, togwActual, togwLimit, zfwActual, zfwLimit, ldgwActual, ldgwLimit, hasPerishables, dotExemption, hasTemperatureControl, hasVzfwCkLimit, slotTime, catIiIiiApproaches, addlFfAdj, ddgItems, melItems, overflightPerms, altRoutes, altData, oeiData, etpPoints, navLog, enrouteNotams, natTrack, airportData, parsedVerbalCallsign, zfwIncrFactor, taxiFuelRaw, rawOFP`.

Field types and meanings are those of master SPEC v1.0 §9 and v1.1 §9.6, with the app's later changes (ledger, reconciliation (a)): `etopsExit`/`etopsExitMins` from the OFP header, else the navlog `(E.EXT)` time (PB-ENR-01); `etpPoints[i].elapsedMins` from the navlog TOT-T of the ETP (PB-ENR-01); `rawOFP` the full text; `airportData[icao].opsNotes` from each Remarks section's delimiter pairs (HF-2).

`options` (optional): `{ parseNatTrack }` — §6. Without `options`, a call is the app's call.

### 5.2 `parseNavBlue(rawText, options?)`

Returns `null` exactly when `_ofpRulesetParse()` does. Otherwise a new object:

1. the 57 core fields, in `CORE_FIELDS` order, with the values `_ofpRulesetParse()` returned;
2. `airportData` and `ddgItems` replaced by copies whose records carry the nested extensions after their own keys (§5.3) — the core record and every other value are passed through unchanged;
3. the 12 top-level extensions, in `EXTENSION_FIELDS` order.

The **core projection** of a `parseNavBlue()` result — the 57 core fields with `airportData[icao].remarks`, `.remarksWeather`, `ddgItems[i].type` and `.notes` taken off — equals `_ofpRulesetParse()` (TC-130-010/011).

### 5.3 Extensions (ADR-005 Appendix B) — NavBlue values

Explicit empty values: an object the parser does not read → `null`; a list → `[]`; a text → `''`. Built fresh on every call (no two results share an array).

| Field | NavBlue v2.0.0 |
| :--- | :--- |
| `revision` | `null` |
| `companyNotams` | `[]` |
| `ofpRemarks` | `[]` |
| `airportData[icao].remarks` | `[]` (every airport entry) |
| `airportData[icao].remarksWeather` | `[]` (every airport entry) |
| `ddgItems[i].type` | `''` (every item) |
| `ddgItems[i].notes` | `[]` (every item) |
| `fplEquipment` | `null` |
| `catIiIiiRestrictions` | `[]` |
| `securityMessages` | `[]` |
| `extraFuel` | `null` |
| `pcf` | `null` |
| `permits` | `[]` |
| `designator` | `''` |
| `sections` | `[]` |
| `findings` | `[{ level: 'INFO', field: 'sections', message: 'sections: content-built bookmarks arrive in step 5' }]` — exactly this one item |

The NavBlue content behind these items is still read where the app reads it today (e.g. Remarks blocks → `opsNotes`, E-WINS → `ewins*`, permits → `overflightPerms`). Nothing is moved into the extensions: that would change the locked core.

---

## 6. The NAT track parser (input)

The NAT track parser is its own module (`natTrackRuleset`; in the app `src/nat.html`, which publishes `window.parseNatTrack(t, origIcao, destIcao)`). The parser's call is replaced by `_natTrackFrom(options, t, origIcao, destIcao)`:

1. `options.parseNatTrack`, when it is a function;
2. else `window.parseNatTrack`, when `window` exists and it is a function — the app's call, unchanged;
3. else `null`.

In the app (2) gives exactly today's result. In Node, with no option and no `window`, `natTrack` is `null` (the app's expression would throw there; it never runs outside a browser). TC-130-013 shows that only `natTrack` depends on the NAT parser; TC-130-015 the precedence.

---

## 7. The copies (what is verbatim, what is edited)

| Module section | Source (on `main` at `d073e54`) | Status |
| :--- | :--- | :--- |
| § 1 metadata | — | new |
| § 2 – § 9 `PATTERNS` … `normalizeWaypointCoord` | `src/ofp-parse.html` (from the § 2 banner to the end of `normalizeWaypointCoord`) | verbatim |
| § 9b ENR V2 helpers: `NAVLOG_EEXT_RE`, `NAVLOG_ETP_RE`, `HEADER_ETOPS_EXIT_RE`, `extractEtopsExitV2`, `extractEtpElapsedFromNavlog`, `applyNavlogEtpTimes` | `src/render-preflight.html` (PB-ENR-01 block, up to the end of `applyNavlogEtpTimes`) | verbatim |
| § 10 `_ofpRulesetParse` | `src/ofp-parse.html` (§ 10 banner to the function's closing brace) | verbatim except **three edits**, each marked `v2.0.0`: (1) a JSDoc line for `options`; (2) the signature `(rawText)` → `(rawText, options)`; (3) the NAT call → `_natTrackFrom(options, …)` |
| § 11 NAT hook, § 12 contract, § 13 `validateSchema`, exports | — | new |

The app's § 1 metadata (`RULESET_VERSION '1.9.0'`, `SCHEMA_VERSION 1`, `OFP_FORMAT 'atlas-v2'`) is replaced by § 1 above. TC-130-004 checks every verbatim block against the app source byte for byte, and that the unedited parser is *not* in the module.

---

## 8. Integration notes (the separate integration PR)

1. Build the module into `index.html` with a `{ rule: 'ofp-navblue' }` entry in `build/build.js` before `ofp-parse.html` (after `nat.html`, so `window.parseNatTrack` exists when the parser is first called — it is only called at import time, so order of definition is enough).
2. In `src/ofp-parse.html` remove the copied block (§ 2 – § 10) and bind the app names to the module: `const _ofpRulesetParse = OfpNavBlue._ofpRulesetParse;` and, where the app reads `PATTERNS`, `MONTHS` etc. elsewhere, bind those too (today only the parser reads them). Keep `parseOFP()`, `fuelK()`, `deriveCallsign()` in the app.
3. The ENR V2 helpers stay in `src/render-preflight.html` (the en-route timeline uses them). The module's copy is private to its factory; the two copies must stay identical until the en-route timeline module (`CODE-ENR-TimelineEvents`) owns them — then the parser should take them from there (option or import) instead of a copy.
4. The parser call stays `_ofpRulesetParse(pdfRawText)` (no options) so the NAT parser is still taken from `window.parseNatTrack`; or pass `{ parseNatTrack: window.parseNatTrack }` explicitly.
5. The integration PR must show golden, NOTAM and app-path snapshots unchanged, and TC-130-010 rewritten to compare the copy built into `index.html` with this file (as TC-120-004/010 did for the NOTAM module).
6. At the gate the same file is written to the master folder in Drive and its hash recorded (ADR-005 §2.3.3).

---

## 9. Tests and evidence (test/rules/ofp-navblue.test.js, run by `npm test`)

| ID | What | Result (2026-11-09) |
| :--- | :--- | :--- |
| TC-130-001 | metadata; `validateSchema()` valid; 11 kinds of broken object rejected | PASS |
| TC-130-002 | manifest entry: version, file, SHA-256 | PASS |
| TC-130-003 | dual context: Node, rules-loader, browser (one global `OfpNavBlue`); same parse; no DOM/storage/app state; `window` read only in the NAT hook | PASS |
| TC-130-004 | the three verbatim blocks byte for byte; unedited parser absent; `parseOFP`, `fuelK`, `deriveCallsign`, `_tlBuild` absent | PASS |
| TC-130-005 | `index.html` = build of `src/` + `rules/`; it does not carry this module | PASS |
| TC-130-010 | **LOCK**, module in the app's own context: 30 fixtures, 1,710 core fields, 6,464 values, `_ofpRulesetParse` and `parseNavBlue` core — 0 differences | PASS |
| TC-130-011 | **LOCK**, module in Node with `options.parseNatTrack`: 30 fixtures (8 with a NAT track) — 0 differences | PASS |
| TC-130-012 | every extension present and empty on 30 fixtures; 148 airport entries, 71 DDG items carry their nested empties; findings = the one INFO | PASS |
| TC-130-013 | no NAT parser → `natTrack` null, nothing else differs; the lock detects it on the 8 NAT fixtures | PASS |
| TC-130-014 | empty/non-string → null; no state between calls; fresh empties | PASS |
| TC-130-015 | NAT precedence: option, else `window`, else null; arguments `(text, orig, dest)` | PASS |
| TC-130-016 | the masters' embedded self-test assertions (v1.0 #1–9, v1.1 #10–14) on the module; slot-time chain positive and negative | PASS |
| TC-130-020 | the gate bites: landing-weight limit broken → 30 of 30 fixtures differ | PASS |
| TC-130-030 | fixtures missing → TC-130-010..013 fail, none skipped | PASS |

The fixtures are the 30 NavBlue/eOFP packages of the private fixtures repository (26 company PDF, 4 eOFP print); the 3 FlightKeys prototypes are excluded. Any fixture format that is neither NavBlue nor FlightKeys fails the test.

---

## 10. Known limitations (unchanged from the app; not fixed by an extraction)

| Item | Note |
| :--- | :--- |
| `slotTime` "AT" form | The app keeps the captured time as written (`'AT ' + match`), without the `Z` upper-casing the other slot forms get. Master v1.0 normalised it. Kept as the app (ledger (a)-3). |
| ENR V2 helpers duplicated | Two identical copies until the en-route timeline module exists (§8.3). |
| `PATTERNS.ETOPS_EXIT` | Still exported; the parser reads the exit through `extractEtopsExitV2()` (header regex identical to it, then navlog). |
| Header label in § 2 | The copied banner still says "parseOFP() depends on these" (app wording). Comments are not edited in a verbatim copy. |

---

## 11. Version history

| Version | Date | Status | Changes |
| :--- | :--- | :--- | :--- |
| 1.9.9-r1 (master file v1.0) | 2026-05-13 | NEW | Extraction from `index.html` as CODE-OFP-AtlasPolar5yRuleset; `SLOT_TIME_AT` added. |
| 1.9.9-r2 (master file v1.1) | 2026-05-30 | UPD | `ZFW_INCR_FACTOR`, `TAXI_FUEL`; `zfwIncrFactor`, `taxiFuelRaw`. (The v1.1 code file in Drive is a header only.) |
| 1.9.9-r3 (master file v1.2) | 2026-09-13 | UPD — ARCHIVED (D9) | Delta: ops-notes size guard, `OFP_FORMAT 'atlas-5y'`, `ofpSource`, `ofpSections`. Never deployed; not carried. |
| **2.0.0** | 2026-11-09 | NEW | Renamed NavBlue, locked. Engine = the app on `main` at `d073e54` (every app change since May carried in). Blueprint metadata, `validateSchema()`, contract v2.0 (`parseNavBlue`, Appendix B as explicit empties, findings). NAT parser passed in. |
