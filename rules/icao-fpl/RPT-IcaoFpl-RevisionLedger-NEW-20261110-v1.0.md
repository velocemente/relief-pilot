# ICAO Flight Plan Module — Revision Ledger

**File Standard:** `RPT-IcaoFpl-RevisionLedger-NEW-20261110-v1.0.md` (first ledger of this module)
**Module:** `icao-fpl` — file `rules/icao-fpl/icao-fpl-v1.0.0.js`
**Current Version:** 1.0.0
**Contents:** `parseIcaoFpl()` — ICAO Doc 4444 fields 7, 8, 9, 10, 13, 15, 16, 18; 28 field 18 indicators (23 Doc 4444, 5 regional)
**QA Status:** TC-152-001 … 120 PASS (18/18); 30 NavBlue/eOFP fixtures, 0 differences in 210 comparisons with the NavBlue parser on flight ID, aircraft type, wake and date of flight. Independent QA (PR 52): CHANGES-REQUESTED on `2690dbb` (F1–F4) → addressed in F-02; re-review pending
**Last Updated:** 2026-11-10

---

## Summary

| Metric | Value |
|:-------|:------|
| Total entries | 2 (F-01, F-02) |
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

### F-02 — QA findings F1–F4 (2026-11-10, same version, before the gate)

**Type:** FIX · **Source:** independent QA of PR 52 at `2690dbb` (F1 must fix; F2, F3 low; F4 info). The module was not gated or mastered, so the version stays 1.0.0; the file and its SHA-256 change.
- **F1 + F3 — block end.** v1.0.0 took the first `)` anywhere after `(FPL-`; a block that lost its `)` was read into the following package text (QA: RMK +179 / +495 / +2,014 characters on the FlightKeys packages). Now the block ends at the `)` that closes it; a `(` or a blank line (page break) before it, or no `)`, makes it **incomplete**: new result field `complete: false`, one ERROR `FPL block incomplete (<reason>): field(s) … not read`, only fields 7–16 wholly inside the readable part read, field 18 never, `raw` only the part read. A page header after a page break inside the block is therefore never read (F3).
- **F2 — copies.** Compared with all white space removed (was: line breaks as spaces), so a wrap inside a field is not a difference; a real difference still WARNs.
- **F4 — joined field 18 item** (`DOF/261109REG/N123`): not split; the item keeps the text, WARN `field 18 item not separated`.
- Result shape: `complete` added after `found` (`RESULT_FIELDS`); findings level `ERROR` added; `validateSchema()` also requires `complete: false` for `''`. An unclosed block alone is now `found: true, complete: false` (was `found: false` + WARN).
- Real blocks: all 93 copies in the 33 fixtures complete and read exactly as before (TC-152-111: 0 touched); the NavBlue consistency is unchanged (210/210).
- Tests: TC-152-101 … 105 (synthetic), 110 / 111 (fixtures, simulated and real), 120 (each F1–F4 check fails with the first-push rule put back). `npm test` 389/389. On `2690dbb` all eight new tests fail.
- SHA-256: `de59a1c6…8279a` → `d7b43250…49ad2`.

---

## Consistency with the NavBlue parser (2026-11-10)

| Field | Compared with | NavBlue fixtures | Differences (after F-02) |
| :--- | :--- | ---: | ---: |
| `flightId` | `FLIGHT_ID_FPL` capture | 30 | 0 |
| `aircraftType` | `AIRCRAFT_TYPE` capture and `_ofpRulesetParse().acftType` | 30 | 0 |
| `wake` | `FPL_WAKE` capture and `_ofpRulesetParse().isHeavy` (H or J) | 30 | 0 |
| `dof` | `DATE_DOF` capture (`20YY-MM-DD`) and `_ofpRulesetParse().flightDateISO` | 30 | 0 |

`found` and `complete` are true on all 33 fixtures (including the 3 FlightKeys packages); all 93 block copies are complete. No fixture gives a WARN or an ERROR.

---

## Open items

| # | Item | Owner |
| :--- | :--- | :--- |
| O-1 | Confirm the regional field 18 indicators (RVR, EUR, IFP, AWR, RFP) to keep in the list | Exec |
| O-2 | Write the gated file to "00_General Rulesets/icao-fpl" and record its hash | Exec, at the gate |
| O-3 | FlightKeys parser (step 6) and D41 equipment check: use the module (separate briefs) | Engineering |
