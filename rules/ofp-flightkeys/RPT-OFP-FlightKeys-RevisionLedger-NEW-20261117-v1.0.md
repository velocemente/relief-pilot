# FlightKeys OFP Parser — Revision Ledger

**File Standard:** `RPT-OFP-FlightKeys-RevisionLedger-NEW-20261117-v1.0.md` (first ledger of this module)
**Module:** `ofp-flightkeys` — file `rules/ofp-flightkeys/ofp-flightkeys-v0.1.0.js`
**Current Version:** 0.1.0 (development version, D58)
**Contents:** `parseFlightKeys()` — release rows 1–23, 29–31, 33, 34, 36, 39–41 of field map v1.1; contract 2.1
**QA Status:** TC-160-001 … 040 PASS (20/20) on the 26 FlightKeys fixtures; independent QA pending
**Last Updated:** 2026-11-17

---

## Summary

| Metric | Value |
|:-------|:------|
| Total entries | 1 (K-01) |
| Current Version | 0.1.0 |
| Sources | Field map `SPRINT-OFP-FlightKeysMigration-REF-20261113-v1.1` (rows, SME-1 … SME-23); `rules/ofp-navblue` v2.0.1 (contract and NavBlue rules, FK-P); `rules/icao-fpl` v1.0.0; `rules/aircraft-profile` v1.0.0 |
| Masters reconciled | none: no master exists; v0.1.0 is not published to Drive (D58) |
| Gate Status | development version; not gated |
| Integration | none; must not be integrated (deferred fields are explicit empties) |

---

## History

### K-01 — New module v0.1.0 (2026-11-17)

**Type:** NEW · **Brief:** FlightKeys parser v0.1.0 (Exec prompt, 17 Nov; D58)
- `parseFlightKeys(input, options)`: input = extractor text + positioned items (mapping documented, `inputFromExtractor`); options = `icaoFpl`, `aircraftProfile`, `parseNatTrack`, passed in.
- Contract 2.1: the 57 core fields with the NavBlue names, order, types and meanings; the 12 contract v2.0 extensions + `swa`; airport extensions + `specialQualification` (ADR-005 Appendix B addendum, Exec SME answers 13 Nov).
- Read: identity, type, date (FPL DOF or OFP header only, real dates, D57), airports incl. the no-IATA line and the Q token, fuel, weights, SWA, DOT exemption incl. the wrapped form, slot, verbal callsign, nav log (TOC, ETOPS, ETP, POR), alternate routes, ETP points, CFS alternates incl. E.ENT/E.EXIT-only airports.
- Not read (explicit empties + one INFO each): crew, perishables, temperature control, CAT II/III, DDG/MEL, permits, TLR (5b-2); weather, NOTAMs, curfew, ops notes, en-route NOTAMs, NAT, Company NOTAMs, sections (5d); remaining extensions (5b-2/5d).
- Decisions applied: SME-1 (page-1 order), SME-2, SME-5, SME-6, SME-8, SME-11, SME-13, SME-16, D55 (SALT/TALT, NavBlue rule), D57 (empty date), FK-P (`navLog` `[]`).
- Tests: `test/rules/ofp-flightkeys.test.js` TC-160-001 … 040, run by `npm test`. Expected values `test/rules/data/ofp-flightkeys-expected-v0.1.0.json` (no crew data).
- Nothing else changes: `index.html`, `src/`, `build/`, the other modules, golden / NOTAM / app-path snapshots unchanged.

---

## Open items

| ID | Item | Owner |
|:---|:-----|:------|
| O-1 | NavBlue (locked) does not return the two addendum fields; ADR-005 §2.4 asks every parser to return every extension | Exec |
| O-2 | `porWpt` for a fix-plus-distance POR carries the lat/long in the same string (SME-11) | Exec (confirm at the visual check) |
| O-3 | `navLog` stays `[]` by FK-P; a real nav log would change the en-route screen | Exec |
| O-4 | Rows of 5b-2 and 5d; SME-18 takeoff-alternate flag needs the station restriction blocks | next sessions |
