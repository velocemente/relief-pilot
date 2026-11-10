# ICAO Flight Plan Module — Revision Ledger

**File Standard:** `RPT-IcaoFpl-RevisionLedger-NEW-20261110-v1.0.md` (first ledger of this module)
**Module:** `icao-fpl` — file `rules/icao-fpl/icao-fpl-v1.0.0.js`
**Current Version:** 1.0.0
**Contents:** `parseIcaoFpl()` — ICAO Doc 4444 fields 7, 8, 9, 10, 13, 15, 16, 18; 28 field 18 indicators (23 Doc 4444, 5 regional)
**QA Status:** TC-152-001 … 030 PASS (10/10); 30 NavBlue/eOFP fixtures, 0 differences from the NavBlue parser on flight ID, aircraft type, wake and date of flight. Independent QA pending
**Last Updated:** 2026-11-10

---

## Summary

| Metric | Value |
|:-------|:------|
| Total entries | 1 (F-01) |
| Current Version | 1.0.0 |
| Sources | ICAO Doc 4444 Appendix 2 and 3; the NavBlue parser's FPL patterns (`rules/ofp-navblue/ofp-navblue-v2.0.0.js` lines 111–125, on `main` at `ad7e431`) as the consistency reference |
| Masters reconciled | none: no ICAO FPL master exists in "00_General Rulesets" (ADR-005 §2.1: "new") |
| Gate Status | pending Exec gate (ADR-005 §2.2.6) and independent QA; master copy to be written to Drive at the gate |
| Integration | not integrated; users are the FlightKeys parser (step 6) and the D41 equipment check (later) |

---

## History

### F-01 — New module v1.0.0 (2026-11-10)

**Type:** NEW · **Brief:** SPRINT-OFP-ModularPlatform, ICAO FPL module (ADR-005 §2.1)
- `parseIcaoFpl(text)` → `{ found, raw, flightId, flightRules, flightType, aircraftType, wake, equipment, surveillance, departure, eobt, route, destination, eet, alternates[], dof, reg, sel, rmk, other, findings[] }`.
- Not found → `found: false`, every field empty. A field that does not meet its Doc 4444 syntax → empty + WARN; no value is guessed (SPEC §3.2).
- Metadata (`'icao-fpl'`, `'1.0.0'`, `SCHEMA_VERSION 1`, `RULESET_SOURCE`), `validateSchema()`, frozen `RESULT_FIELDS` and `FIELD18_INDICATORS`.
- Dual context; global `IcaoFpl` in the browser; never reads `window`, `document`, storage, the clock or any app global.
- The NavBlue parser is not changed and keeps its own FPL patterns (D47). `index.html`, `src/`, `build/`, the golden and V0 snapshots are unchanged.
- Tests: `test/rules/icao-fpl.test.js` TC-152-001 … 030 (10 tests), run by `npm test`.

---

## Consistency with the NavBlue parser (2026-11-10)

| Field | Compared with | NavBlue fixtures | Differences |
| :--- | :--- | ---: | ---: |
| `flightId` | `FLIGHT_ID_FPL` capture | 30 | 0 |
| `aircraftType` | `AIRCRAFT_TYPE` capture and `_ofpRulesetParse().acftType` | 30 | 0 |
| `wake` | `FPL_WAKE` capture and `_ofpRulesetParse().isHeavy` (H or J) | 30 | 0 |
| `dof` | `DATE_DOF` capture (`20YY-MM-DD`) and `_ofpRulesetParse().flightDateISO` | 30 | 0 |

`found` is true on all 33 fixtures (including the 3 FlightKeys packages). No fixture gives a WARN.

---

## Open items

| # | Item | Owner |
| :--- | :--- | :--- |
| O-1 | Confirm the regional field 18 indicators (RVR, EUR, IFP, AWR, RFP) to keep in the list | Exec |
| O-2 | Write the gated file to "00_General Rulesets/icao-fpl" and record its hash | Exec, at the gate |
| O-3 | FlightKeys parser (step 6) and D41 equipment check: use the module (separate briefs) | Engineering |
