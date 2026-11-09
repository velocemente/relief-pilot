# SPEC-AircraftProfile

**Version:** v1.0.0 | **Status:** NEW | **Date:** 2026-11-09
**Owner:** Engineering | **Approver:** Exec
**Tier:** 2 — Platform Architecture
**Module file:** `rules/aircraft-profile/aircraft-profile-v1.0.0.js` (SHA-256 in `rules/manifest.json`)
**Architecture:** ADR-005 §2.1 (module catalogue: "Aircraft and registration"), §2.2 (module standard), §2.3 (master copies and CI)
**Ledger:** `RPT-AircraftProfile-RevisionLedger-NEW-20261109-v1.0.md` (beside this file)
**Supersedes:** nothing (new module). There is no earlier master in "00_General Rulesets".

---

## 1. What this module is

The aircraft profile module holds what PilotBrief knows about an aircraft type and an operator designator, for every OFP format and every ruleset:

- the **aircraft type table** (`AIRCRAFT_DATA`: wingspan, MTOW, ICAO aerodrome reference code, wake turbulence category, turbine) and the two readers of it (`getWingspan`, `buildAcftProfile`);
- the **callsign index** (CS-1: operator designator → verbal callsign, e.g. GTI = GIANT) and the radio callsign derivation from the flight number (`deriveCallsign`).

v1.0.0 is an **extraction** (ADR-005 §5 step 4). Its output is **identical to today's code**:

| Part | Copied from (on `main` at `74e9dd5`) | How |
| :--- | :--- | :--- |
| `AIRCRAFT_DATA`, `getWingspan()`, `buildAcftProfile()` | `rules/notam-rules/notam-rules-v1.11.2.js` lines 509–625 (the NOTAM module the app builds into `index.html`) | verbatim, byte for byte (TC-150-004) |
| `CALLSIGN_INDEX`, `deriveCallsign()` | `src/ofp-parse.html` (`deriveCallsign`, lines 21–37) | behaviour identical; the inline designator map becomes the named export `CALLSIGN_INDEX` (two marked `v1.0.0` edits, §6) |

This PR does **not** build the module into `index.html`, and does not change the NOTAM module or `src/`. The app still runs its own copies. Integration is a separate PR (§8).

**Not in this module:** `_acftApplies()`, `_twyApplies()` and every NOTAM rule (they stay in `notam-rules`); the FPL field 9 heavy flag `isHeavy` and the OFP remark "VERBAL CALLSIGN – {NAME}" (`parsedVerbalCallsign`), which are read by the OFP parsers; `parseOFP()` and any UI.

---

## 2. Module standard (ADR-005 §2.2)

| Item | v1.0.0 |
| :--- | :--- |
| One standalone file | Yes. No `require`, no imports. |
| Dual context | Node: `module.exports = API`. rules-loader (`new Function('module','exports','require', code)`): same. Browser (a plain script): no `module`, so the API object is published once as the global **`AircraftProfile`**. All declarations live inside one factory function, so none collides with the app's names (`AIRCRAFT_DATA`/`buildAcftProfile` inside `NotamRules`, `deriveCallsign` in `src/ofp-parse.html`). |
| Metadata | `RULESET_TYPE = 'aircraft-profile'`, `RULESET_VERSION = '1.0.0'`, `SCHEMA_VERSION = 1`, `RULESET_SOURCE` (the table's sources as stated in the NOTAM module: Jane's / manufacturer type certificate data sheets / FAA AC 150/5300-13A; ICAO Annex 14 code, Doc 8643 / Doc 4444 wake category; callsigns per Atlas Air SOPs as carried in the app). |
| `validateSchema()` | Yes, §3.2. |
| No app state, no DOM, no UI | The module never reads `window`, `document`, storage, the network or any app global. TC-150-003 loads it and calls every export with `window`, `document`, storage and the app's globals set to throw on any access: none is touched. |
| Strict mode | On, like the app's main inline script. The copied functions have the same results strict or not (they assign no undeclared names and use no `this`). |
| Clock, network | None. |
| Shared data | `AIRCRAFT_DATA` (table and every entry) and `CALLSIGN_INDEX` are frozen, so one consumer cannot change them for another. Results are new objects on every call, as today. |

---

## 3. Exports

### 3.1 API

```javascript
module.exports = {
  RULESET_TYPE, RULESET_VERSION, SCHEMA_VERSION, RULESET_SOURCE,
  validateSchema,     // (ruleset?) → { valid, errors[] }
  AIRCRAFT_DATA,      // { [icaoType]: { ws, mtow, code, wake, turbine } } — 62 types, frozen
  getWingspan,        // (acftType) → wingspan metres | null
  buildAcftProfile,   // (icaoType) → { type, ws, mtow, code, wake, turbine, known }
  CALLSIGN_INDEX,     // { GTI: 'GIANT', PAC: 'POLAR', CMB: 'CAMBER', QFA: 'QANTAS' } — CS-1, frozen
  deriveCallsign,     // (fltNum) → { radioCallsign, verbalCallsign, isHeavy }
};
```

| Export | Behaviour (unchanged from today) |
| :--- | :--- |
| `AIRCRAFT_DATA` | Fields per entry: `ws` wingspan m; `mtow` kg; `code` ICAO aerodrome reference code A–F; `wake` L/M/H/J; `turbine` boolean. Keys are ICAO type designators (2–4 characters). |
| `getWingspan(t)` | Falsy `t` → `null`. Else looks up `t.toUpperCase().slice(0,4)`; unknown → `null`. |
| `buildAcftProfile(t)` | Key = `(t \|\| '').toUpperCase().slice(0,4)` (no trimming: `' B744'` is unknown). Known → `{ type: key, ...entry, known: true }`. Unknown → the conservative profile `{ type: key \|\| 'UNKN', ws: 999, mtow: 999999, code: 'F', wake: 'H', turbine: true, known: false }`, so no NOTAM is hidden by mistake. A truthy non-string throws `TypeError`, as today. |
| `CALLSIGN_INDEX` | Operator designator → verbal callsign, in the app's order. |
| `deriveCallsign(f)` | Falsy `f` → `{ radioCallsign: '', verbalCallsign: '', isHeavy: false }`. `f` matching `/^(GTI\|PAC\|CMB\|QFA)(\d+)/i` (pattern built from the index keys) → `{ radioCallsign: DESIGNATOR + digits, verbalCallsign: CALLSIGN_INDEX[DESIGNATOR], isHeavy: true }`. Otherwise → `{ radioCallsign: f, verbalCallsign: '', isHeavy: false }`. In the app, `parseOFP()` then overrides `isHeavy` with the FPL wake (field 9) and `verbalCallsign` with the OFP's "VERBAL CALLSIGN" remark when present. |

### 3.2 `validateSchema(ruleset?)`

Checks the module's own exports (no argument) or a given object. Errors reported: a missing export or one of the wrong type; `_acftApplies`, `evalNotams` or `parseOFP` exported (not aircraft data); `RULESET_TYPE` not `'aircraft-profile'`; `RULESET_VERSION` not semver; `SCHEMA_VERSION` not an integer ≥ 1; `RULESET_SOURCE` empty; an `AIRCRAFT_DATA` key that is not an upper-case designator, an entry whose fields are not exactly `ws, mtow, code, wake, turbine`, `ws`/`mtow` not positive numbers, `code` not A–F, `wake` not L/M/H/J, `turbine` not boolean; a `CALLSIGN_INDEX` key that is not a 3-letter upper-case designator or a callsign that is not upper-case letters. It does **not** check data plausibility (e.g. wake against MTOW): see §7.

---

## 4. Data sources

| Data | Source today | Notes |
| :--- | :--- | :--- |
| `AIRCRAFT_DATA` | NOTAM ruleset v1.11.2 header: "Jane's / manufacturer type certificate data sheets / FAA AC 150/5300-13A". Code letter "derived from wingspan" (A <15 m, B 15–24, C 24–36, D 36–52, E 52–65, F >65). Wake: "ICAO wake turbulence category". | Copied as is. Differences with ICAO Doc 8643 are listed in the ledger (data review) for the Exec; none is changed here. |
| `CALLSIGN_INDEX` | `src/ofp-parse.html` comment: "Verbal callsigns per Atlas Air SOPs". | GTI GIANT, PAC POLAR, CMB CAMBER, QFA QANTAS. |

---

## 5. Callers today (none changed by this PR)

| Name | Caller | Where |
| :--- | :--- | :--- |
| `AIRCRAFT_DATA` | `getWingspan`, `buildAcftProfile`; `_acftApplies` type-list check ("and above" / "only") | `rules/notam-rules/notam-rules-v1.11.2.js` 595, 620, 718, 724 |
| `getWingspan` | `_twyApplies` (taxiway wingspan limit) | notam-rules 1069 |
| `buildAcftProfile` | `_acftApplies` (string → profile), `evalNotams` (once per call), exported by `NotamRules` | notam-rules 647, 1709, 2043 |
| (indirect) | `evalAirport` → `evalNotams(…, S.acftType …)` | `src/airports.html` 15, 145, 320; `src/render-descent.html` 151, 451 |
| `deriveCallsign` | `parseOFP()` spread into the flight state | `src/ofp-parse.html` 119 |
| (its result) | callsign hero `S.verbalCallsign`, `S.isHeavy`; state defaults | `src/render-preflight.html` 15–19; `src/state.html` 355–357, 432 |

**Not callers:** the GNSS NOTAM ruleset (`evalGNSS`, `src/notam.html`), the TLR patterns (`ofp-navblue` `TLR_PATTERNS`) and OEI (`src/oei.html`) do not use the table, the profile or the callsign. Related but separate: `ofp-navblue` reads `isHeavy` from FPL field 9 (lines 589–592) and `parsedVerbalCallsign` from Remarks (1046–1049); `src/import/atlas-fk.js` (ADR-004 FlightKeys profile, to be retired) has its own `extractAircraft`/`extractWakeCategory` (747–751). `src/copy.html` 45 copies `S.acftType` as text only.

---

## 6. The copies (what is verbatim, what is edited)

| Section | Source | Status |
| :--- | :--- | :--- |
| § 1 metadata | — | new |
| § 2 `AIRCRAFT_DATA` (with its comment header), `getWingspan`, `buildAcftProfile` | notam-rules v1.11.2 lines 509–625 | verbatim; then **one addition**: `Object.freeze` of the table and each entry (marked `v1.0.0`) |
| § 3 `deriveCallsign` (with its comment header) | `src/ofp-parse.html` | verbatim except **two edits**, each marked `v1.0.0`: (1) `fltNum.match(/^(GTI\|PAC\|CMB\|QFA)(\d+)/i)` → `fltNum.match(CALLSIGN_PREFIX_RE)`, the same pattern built from the index keys; (2) `{ GTI: 'GIANT', … }[prefix]` → `CALLSIGN_INDEX[prefix]`. New: `CALLSIGN_INDEX` (frozen), `CALLSIGN_PREFIX_RE`. |
| § 4 `validateSchema`, exports | — | new |

TC-150-004 checks the § 2 block byte for byte against the NOTAM module, and that the module's `deriveCallsign` with the two edits undone is the app's text byte for byte.

---

## 7. Planned: v1.1.0 — approach category (D44)

D44 (Exec, 6 Nov): within a NOTAM, show only the minima for the aircraft's approach category. The design note is `docs/EV-0-NOTAM-Evaluator-Inventory-v0.1.md` §4.1. The aircraft's category is known nowhere today; the smallest option is a fixed **fleet table type → approach category set by the Exec**.

v1.1.0 (minor: a field is added, nothing changes meaning) will add, **once the Exec supplies the fleet table**:

- an `apchCat` field (A–E) on the `AIRCRAFT_DATA` entries the Exec lists, and on the `buildAcftProfile` result (unknown type → no category, so nothing is narrowed: EV-0 §4.1 recommended option, subject to the Exec's Q3/Q4);
- `validateSchema()` accepting `apchCat` (A–E) as an optional sixth field;
- tests: every listed type returns the Exec's category; every other type, and an unknown type, returns none.

The NOTAM change that uses it (narrowing minima on the airport card) is a separate, visible, safety-critical change with its own brief, gate and positive/negative tests (CLAUDE.md rules 3 and 6). Nothing in v1.0.0 anticipates it.

Registration profile (ADR-005 §2.1 "type and registration"): not yet specified; no registration data exists in the app today.

---

## 8. Integration notes (the separate integration PR)

1. Build the module into `index.html` with `{ rule: 'aircraft-profile' }` in `build/build.js`, **before** `notam-rules` (the NOTAM module would then take the table from it) — or, if the NOTAM module keeps its own copy for now, before `ofp-parse.html`.
2. `src/ofp-parse.html`: replace the app's `deriveCallsign` with `const { deriveCallsign } = AircraftProfile;`. `parseOFP()` is unchanged.
3. The NOTAM module: a new NOTAM version (v1.12.0) takes `AIRCRAFT_DATA`, `getWingspan`, `buildAcftProfile` from this module (passed in, like the NAT parser for NavBlue, so the NOTAM module stays standalone) and removes its copy. Until then two identical copies exist; TC-150-004/010 keep them identical.
4. The integration PR must show golden, NOTAM and app-path snapshots unchanged.
5. At the gate the same file is written to the master folder "00_General Rulesets" and its hash recorded (ADR-005 §2.3.3).

---

## 9. Tests and evidence (`test/rules/aircraft-profile.test.js`, run by `npm test`)

| ID | What | Result (2026-11-09) |
| :--- | :--- | :--- |
| TC-150-001 | metadata; export list; `validateSchema()` valid; 18 kinds of broken object rejected; non-object rejected | PASS |
| TC-150-002 | manifest entry: version, file, SHA-256 | PASS |
| TC-150-003 | dual context: Node, rules-loader, browser (exactly one new global `AircraftProfile`) give the same results; loaded and every export called (590 type inputs, 83 callsign inputs) with `window`, `document`, storage, app globals and the app's own names for these functions set to throw — none touched; the code names no browser global | PASS |
| TC-150-004 | NOTAM block byte for byte, once; `deriveCallsign` = app text with the two marked edits undone; `CALLSIGN_INDEX` = the app map (keys, values, order); pattern source and flags = the app literal; `_acftApplies`, `_twyApplies`, `evalNotams`, `TYPE_RE` absent; `index.html` does not carry the module and is the build of `src/` + `rules/` | PASS |
| TC-150-010 | `buildAcftProfile` vs the NOTAM module file **and** `NotamRules.buildAcftProfile` built into `index.html`; `getWingspan` vs the NOTAM module's own: 689 inputs — all 62 table keys and 8 variants of each (lowercase, mixed case, leading/trailing space, suffix, `/H`, split, 3-char), every fixture `acftType` (33) plus lowercase and padded, 21 unknown types, empty/blank/`null`/`undefined`/`0`/`false`/`NaN`, three non-strings (same `TypeError`) — **0 differences**, values and key order | PASS |
| TC-150-011 | `deriveCallsign` vs the app's in `index.html` **and** the text in `src/ofp-parse.html`: 116 inputs — every fixture flight number (33), each designator in 16 forms (upper/lower/mixed, number forms, no number, spaces, suffixes, prefixed), unknown designators, empty/blank/`null`/`undefined`/`0`/`false`/`NaN`, non-strings — **0 differences** | PASS |
| TC-150-012 | tables frozen; results fresh objects (mutating one does not affect the next) | PASS |
| TC-150-020 | gate bites: B744 wingspan +0.1 m, B752 wake H→M, CAMBER misspelt, QANTAS emptied — each caught by the comparison | PASS |
| TC-150-030 | fixtures missing → the fixture comparisons fail, none skipped | PASS |

Fixture messages show inputs as hashes only; no fixture text, flight numbers or crew data appear in test output.

Whole suite on the branch: `npm test` 364/364; `check-rules` 3 modules match; build = committed `index.html`; extractor 33/33; golden, NOTAM and app-path compares 33/33 each — unchanged.

---

## 10. Known limitations (unchanged from today; not fixed by an extraction)

| Item | Note |
| :--- | :--- |
| Wake categories | Four entries differ from ICAO Doc 8643 (ledger data review D-1). `isHeavy` on screen comes from the OFP's FPL, not from this table; the table's `wake` is used only by `_acftApplies` (heavy-only / light-only NOTAM wording). |
| `A380` key | Not a Doc 8643 designator (`A388` is); harmless duplicate. |
| No trimming | `buildAcftProfile(' B744')` is unknown (conservative profile). Callers pass the parser's value, which has no spaces. |
| Callsign index | Four designators. Wet-lease flights (e.g. THY in the fixtures) get the verbal callsign from the OFP remark, not from the index. |
| `deriveCallsign` comment | Says "All Atlas/Polar fleet are heavies"; `parseOFP()` overrides `isHeavy` with the FPL wake. Comments are not edited in a copy. |

---

## 11. Version history

| Version | Date | Status | Changes |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-11-09 | NEW | Extraction: table + profile from notam-rules v1.11.2 (verbatim), callsign index + derivation from the app (behaviour identical, index as a named export). Blueprint metadata, `validateSchema()`, frozen shared tables. |
| 1.1.0 | planned | — | D44 approach category, once the Exec supplies the fleet table (§7). |
