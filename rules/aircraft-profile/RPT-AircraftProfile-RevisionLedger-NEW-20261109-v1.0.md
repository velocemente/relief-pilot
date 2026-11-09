# Aircraft Profile Module — Revision Ledger

**File Standard:** `RPT-AircraftProfile-RevisionLedger-NEW-20261109-v1.0.md` (first ledger of this module)
**Module:** `aircraft-profile` — file `rules/aircraft-profile/aircraft-profile-v1.0.0.js`
**Current Version:** 1.0.0
**Contents:** 62 aircraft types; 4 callsign designators
**QA Status:** TC-150-001 … 030 PASS (9/9); 689 type inputs and 116 callsign inputs, 0 differences against the NOTAM module and the app. Independent QA pending
**Last Updated:** 2026-11-09

---

## Summary

| Metric | Value |
|:-------|:------|
| Total entries | 1 (A-01) |
| Current Version | 1.0.0 |
| Sources | `rules/notam-rules/notam-rules-v1.11.2.js` lines 509–625; `src/ofp-parse.html` `deriveCallsign` — both on `main` at `74e9dd5` |
| Masters reconciled | none: no aircraft or callsign master exists in "00_General Rulesets" (ADR-005 §2.1: "new", extracted from the app) |
| Gate Status | pending Exec gate (ADR-005 §2.2.6) and independent QA; master copy to be written to Drive at the gate |
| Integration | not integrated; the app still runs its own copies (SPEC §8) |
| Data review | report only, nothing changed (below); Exec decides |

---

## History

### A-01 — Module extraction v1.0.0 (2026-11-09)

**Type:** EXTRACTION (no behaviour change) · **Brief:** SPRINT-OFP-ModularPlatform step 4 (ADR-005 §5.4)
- Table and profile: `AIRCRAFT_DATA`, `getWingspan()`, `buildAcftProfile()` copied byte for byte from the NOTAM module v1.11.2. `_acftApplies()` and every NOTAM rule stay in the NOTAM module, which is not changed.
- Callsign index (CS-1): `deriveCallsign()` from `src/ofp-parse.html`, behaviour identical. Two marked edits: the inline map becomes the named export `CALLSIGN_INDEX`; the prefix pattern is built from its keys (same source and flags as the app's literal).
- New: metadata (`'aircraft-profile'`, `'1.0.0'`, `SCHEMA_VERSION 1`, `RULESET_SOURCE`), `validateSchema()`; `AIRCRAFT_DATA` and `CALLSIGN_INDEX` frozen (results unchanged: every call returns a new object).
- Dual context; global `AircraftProfile` in the browser; never reads `window`, `document`, storage or any app global.
- Tests: `test/rules/aircraft-profile.test.js` TC-150-001 … 030 (9 tests), run by `npm test`; the harness exposes the app's `deriveCallsign` for the comparison.
- Evidence: golden, NOTAM and app-path snapshots unchanged (33/33 each); `src/`, `build/`, `index.html` and the NOTAM module unchanged.

---

## Data review (2026-11-09) — report only, nothing changed

Method: each `AIRCRAFT_DATA` wake category compared with ICAO Doc 8643 (*Aircraft Type Designators*), whose wake turbulence category (WTC) follows maximum certificated take-off mass — **L** ≤ 7,000 kg, **M** 7,000–136,000 kg, **H** ≥ 136,000 kg, **J** (Super) for the A388 only. The ICAO Doc 8643 online search could not be reached from the build environment (network policy), so each difference was checked twice: against the table's **own** `mtow` value, and against published secondary sources that cite Doc 8643. The Exec should confirm against the current Doc 8643 entry before any change.

### D-1 Wake category differences

| Type | Table `wake` | Doc 8643 WTC | Table `mtow` (kg) | Source / note |
| :--- | :---: | :---: | ---: | :--- |
| B752 (757-200) | H | **M** | 115,900 | Doc 8643 WTC M (SKYbrary B752 entry; ICAO APAC ATM/SG/10 IP14, 2022: "B757 family … Medium"). FAA: a B757 is filed `B752/M`; some national practice treats it as heavy *for wake separation behind it* — that is not its Doc 8643 category. |
| B753 (757-300) | H | **M** | 122,470 | Doc 8643 WTC M (same family as B752; MTOW below 136 t). |
| B722 (727-200) | H | **M** | 95,028 | MTOW below 136 t → M. |
| CRJ2 (CRJ200) | L | **M** | 21,319 | MTOW above 7 t → M. |

Every other entry agrees with Doc 8643 (and with its own `mtow` under the bands above). `A380`/`A388` carry `J`, which is the Doc 8643 Super category of the A388.

**Effect today:** the table's `wake` is read only by `_acftApplies()` in the NOTAM module (NOTAMs worded for heavy aircraft only, or light aircraft only). The on-screen "Heavy" comes from the OFP's FPL field 9, not from this table. None of the four types is in the fleet seen in the fixtures. Correcting B752/B753/B722 to M would let a "heavy aircraft only" NOTAM be hidden for those types; correcting CRJ2 to M would show a "light aircraft only" NOTAM less often. Exec decides; any change is its own version with positive and negative tests.

### D-2 Other observations (report only)

| # | Item | Note |
| :--- | :--- | :--- |
| D-2a | `A380` key | Not a Doc 8643 designator (`A388` is). Duplicate entry; harmless. |
| D-2b | CRJ7 code `C` | Wingspan 23.2 m is code **B** under the table's own header rule (B 15–24 m). Only the code letter is affected. |
| D-2c | Types the NOTAM rule names but the table lacks | `_acftApplies` `TYPE_RE` matches `B773`, `A30B` and `A344` (the last via `A34[23456]`; no A340-400 was built). Not in `AIRCRAFT_DATA`: a NOTAM listing them is compared using ws 0 / 999 defaults. |
| D-2d | Callsign index | Fixture designators: GTI, CMB, QFA (in the index) and THY (not in it: the verbal callsign comes from the OFP's "VERBAL CALLSIGN" remark). PAC is in the index but in no fixture (tested synthetically). |

### D-3 Fleet types in the fixtures missing from the table

**None.** Types seen in the 30 NavBlue/eOFP fixtures: B744 (19), B748 (6), B763 (3), BLCF (1), B77L (1); the 3 FlightKeys fixtures are B744. All five are in `AIRCRAFT_DATA` (`known: true`, asserted by TC-150-010).

Sources consulted: [SKYbrary — B752](https://skybrary.aero/aircraft/b752); [SKYbrary — ICAO Wake Turbulence Category](https://skybrary.aero/articles/icao-wake-turbulence-category); [ICAO APAC ATM/SG/10 IP14 (2022)](https://www.icao.int/sites/default/files/APAC/Meetings/2022/2022%20ATM-SG-10/4-Information%20Papers/IP14-Application-of-Re-Categorisation-of-Wake-Turbulence-Separation-Minima-in-China.pdf); [FAA Notice N7110.504](https://www.faa.gov/documentLibrary/media/Notice/N7110.504.pdf); [ICAO Doc 8643](https://www.icao.int/publications/doc-8643-aircraft-type-designators).

---

## Open items

| # | Item | Owner |
| :--- | :--- | :--- |
| O-1 | Data review D-1 / D-2: correct or keep | Exec |
| O-2 | D44 fleet table (type → approach category) for v1.1.0 | Exec |
| O-3 | Write the gated file to "00_General Rulesets/aircraft-profile" and record its hash | Exec, at the gate |
