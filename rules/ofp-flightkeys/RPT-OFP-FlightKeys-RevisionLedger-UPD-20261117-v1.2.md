# FlightKeys OFP Parser — Revision Ledger

**File Standard:** `RPT-OFP-FlightKeys-RevisionLedger-UPD-20261117-v1.2.md` (supersedes ledger v1.1 of the same date)
**Module:** `ofp-flightkeys` — file `rules/ofp-flightkeys/ofp-flightkeys-v0.2.0.js`
**Current Version:** 0.2.0 (development version, D58)
**Contents:** `parseFlightKeys()`. Release rows 1–23, 29–31, 33, 34, 36, 39–41 (v0.1.0) plus rows 24–28, 32, 32a, 35 and the Appendix B release/remarks extensions (v0.2.0) of field map v1.1. Contract 2.2.
**QA Status:** TC-160 20/20 and TC-161 17/17 PASS on the 26 FlightKeys fixtures; independent QA of PR #62: CHANGES-REQUESTED (F1), F1 fixed under D63 (K-03), re-review pending
**Last Updated:** 2026-11-17

---

## Summary

| Metric | Value |
|:-------|:------|
| Total entries | 3 (K-01, K-02, K-03) |
| Current Version | 0.2.0 |
| Sources | Field map `SPRINT-OFP-FlightKeysMigration-REF-20261113-v1.1` (rows, SME-1 … SME-23, SME-3a, SME-18a); `rules/ofp-navblue` v2.0.1 (contract and NavBlue rules, FK-P); `rules/icao-fpl` v1.0.0; `rules/aircraft-profile` v1.0.0; 5b-1 QA on relief-pilot #60 (F3, F4); QA of relief-pilot #62 (F1–F4); Exec decision D63; the Exec's 8 truth sheets (Rev 00) |
| Masters reconciled | none: no master exists; v0.2.0 is not published to Drive (D58) |
| Gate Status | development version; not gated |
| Integration | none; must not be integrated (step 5d fields are explicit empties) |

---

## History

### K-03 — v0.2.0: one remark per item in a marked block (D63) (2026-11-17)

**Type:** UPD (same development version, before merge) · **Brief:** Exec prompt, 17 Nov (QA F1 on PR #62; D63)
- **D63:** in airport remarks and in any remark block that marks its items, a new remark starts only at the block's own item marker (dash, number or sub-heading); any other line continues the remark above it, with its printed line breaks kept (`"\n"`, nothing reflowed). Applied to `airportData[icao].remarks[]` and to the station-block and ADHOC-block records of `ofpRemarks[]` (SPEC §5.12, markers per block layout from the field map v1.1 §2.4).
- **Changed on the 26:** 4 remarks in 3 packages (13 printed lines): L06 2 (LEZG caution, `DEPARTURES`), L09 1 (VHHH), L21 1 (NFFN circling + minima). Every other package and field unchanged; v0.1.0 fields byte-identical (TC-161-001); findings unchanged on all 26.
- The SME-18a INFO counts printed lines, as before (unchanged message); SME-18 is read on the joined remark, so a wrapped `Takeoff alternate` / `required` is flagged (synthetic).
- Outside a marked block `ofpRemarks` stays one record per printed line (open item O-9).
- Tests: TC-161-100 (fixtures), 101 (synthetic positive and negative, page break), 102 (scope); TC-161-050 changed (lines counted inside joined records; L06 sub-cards one remark each). The new tests fail on `1a96479`; mutants of each part of the rule are caught.
- Exec, 17 Nov, also: a blank TO/LNDG expiry stays an INFO (QA F4); non-crew remark text may be quoted in the public SPEC and tests after `tools/redact` (QA F2; every quoted remark checked, no change needed). The STATUS 1 wording "listed once" is superseded (QA F3; the current rule is §5.7: every printed copy kept).

### K-02 — v0.2.0: release and remarks pages (2026-11-17)

**Type:** UPD · **Brief:** FlightKeys parser v0.2.0 (Exec prompt, 17 Nov; D58, D62)
- Crew (row 26, SC): pilots with role and TO/LNDG currency (blank → "Not Reported", SME-9); `*` kept with the last name, never seniority (SME-3/3a); DH/JS as NavBlue; MX/LM/FA/PU not crew (INFO counts); new extension `operatingPilots` (D62); crew-record extensions `firstName`, `toLndgExpiry`.
- CAT II/III (row 24, SC): authorisations in the NavBlue form; restrictions from Remarks lines and MEL notes/titles in `catIiIiiRestrictions[]`, never as an authorisation (SME-10).
- MEL/CDL/DDG (row 25): items as printed with `type` and `notes[]`; indentation from the positioned items; ADHOC penalty lines kept apart; every printed item kept, a repeated one included (Exec, 17 Nov); late additions named only in a remark (SME-19). TLR cross-reference (32a), including the codes printed below the `RMKS` line.
- TLR (row 32): `oeiData` by the NavBlue rule on the TLR with page furniture removed (fixes the L10 page-break leak; field map §6).
- Perishables (27, bare `PERISHABLES ONBOARD` + NavBlue rule) and temperature control (28, NavBlue rule, D55), read on the release Remarks only.
- Permits (35): `overflightPerms` (NavBlue form), `permits[]` with route, registration restriction, missing permit, ADC number.
- `ofpRemarks[]` with categories, sub-headings and provenance, plus the MEL-block ADHOC lines and the CDC attestation. Station restrictions on `airportData[icao].remarks[]` (D34), with the fleet rule (SME-18a). Takeoff alternate required but none listed → WARN (SME-18). `remarksWeather[]` on its airport (D34, D46, SME-23); one airport entry created for a release alternate not on page 1 (L15 PWAK). `securityMessages[]` (D45). `extraFuel` with type and tanker flag (D39). `pcf` with reasons (SME-7). `revision`.
- 5b-1 QA F4: `icao-fpl` reads the release lines only. QA F3: SPEC corrected (no `curfew` / `opsNotes` keys before 5d).
- `fplEquipment` (D41) is not in the brief: explicit `null`, step `open`.
- Proof: every v0.1.0 field byte-identical on the 26 fixtures (TC-161-001, SHA-256 per field against the output recorded with v0.1.0 before the change).
- Truth sheets: 3 differences at first (L07 1, L08 1, L12 1), all presentation decisions; private report `pilotbrief-fixtures/expected/ofp-flightkeys-v0.2.0/TRUTH-SHEETS-REPORT.md`.
- **Exec decisions, 17 Nov (PR #62 review):**
  - L07 security line stays on the Preflight card only (O-5 closed).
  - Repeated MEL items are possible and not an anomaly; every printed item is kept and no finding is raised (O-6 closed; L08 and L12 now match their sheets). This replaces the NavBlue dedup of the first push.
  - Ignore NavBlue for the contract 2.2 fields (O-1 closed).
  - Names as printed: OK.
  - `fplEquipment` is a later issue (O-7 deferred).
  - Step 5d items stay with 5d: OK (O-4).
  - Draft truth sheets: OK (O-8 closed).
  After these, 0 truth-sheet differences remain open.
- Tests: TC-161-001 … 090 (`test/rules/ofp-flightkeys-release.test.js`); TC-160 scoped to the v0.1.0 fields. Crew values only in the private fixtures repo (`expected/ofp-flightkeys-v0.2.0/crew.json`).
- Nothing else changes: `index.html`, `src/`, `build/`, the other modules, golden / NOTAM / app-path snapshots unchanged.

### K-01 — New module v0.1.0 (2026-11-17)

**Type:** NEW · **Brief:** FlightKeys parser v0.1.0 (Exec prompt, 17 Nov; D58)
- `parseFlightKeys(input, options)`: input = extractor text + positioned items (mapping documented, `inputFromExtractor`); options = `icaoFpl`, `aircraftProfile`, `parseNatTrack`, passed in.
- Contract 2.1: the 57 core fields with the NavBlue names, order, types and meanings; the 12 contract v2.0 extensions + `swa`; airport extensions + `specialQualification` (ADR-005 Appendix B addendum, Exec SME answers 13 Nov).
- Read: identity, type, date (FPL DOF or OFP header only, real dates, D57), airports incl. the no-IATA line and the Q token, fuel, weights, SWA, DOT exemption incl. the wrapped form, slot, verbal callsign, nav log (TOC, ETOPS, ETP, POR), alternate routes, ETP points, CFS alternates incl. E.ENT/E.EXIT-only airports.
- Not read (explicit empties + one INFO each): crew, perishables, temperature control, CAT II/III, DDG/MEL, permits, TLR (5b-2); weather, NOTAMs, curfew, ops notes, en-route NOTAMs, NAT, Company NOTAMs, sections (5d); remaining extensions (5b-2/5d).
- Decisions applied: SME-1 (page-1 order), SME-2, SME-5, SME-6, SME-8, SME-11, SME-13, SME-16, D55 (SALT/TALT, NavBlue rule), D57 (empty date), FK-P (`navLog` `[]`).
- Tests: `test/rules/ofp-flightkeys.test.js` TC-160-001 … 040, run by `npm test`. Expected values `test/rules/data/ofp-flightkeys-expected-v0.1.0.json` (no crew data).

---

## Open items

| ID | Item | Owner |
|:---|:-----|:------|
| O-1 | ~~NavBlue does not return the addendum fields~~ **Closed (Exec, 17 Nov): ignore NavBlue**; the contract 2.2 fields are FlightKeys only | — |
| O-2 | `porWpt` for a fix-plus-distance POR carries the lat/long in the same string (SME-11) | Exec (confirm at the visual check) |
| O-3 | `navLog` stays `[]` by FK-P; a real nav log would change the en-route screen | Exec |
| O-4 | Step 5d: Company NOTAMs, NOTAMs, weather incl. the `* PRIO *` E-WINS TAF, curfew, opsNotes, NAT, sections; SME-18 "not noted twice" against the Company NOTAM repeat | next session |
| O-5 | ~~L07 security line~~ **Closed (Exec, 17 Nov): Preflight card only** (`securityMessages[]`, D45) | — |
| O-6 | ~~Duplicate MEL items~~ **Closed (Exec, 17 Nov): keep all items**, a repeat is not an anomaly | — |
| O-7 | `fplEquipment` (D41: filed 10a and the codes the MEL notes remove) has no brief. **Exec, 17 Nov: a later issue** | Exec (later brief) |
| O-8 | ~~Truth sheets are drafts~~ **Closed (Exec, 17 Nov): OK** | — |
| O-9 | D63 outside a marked block: `ofpRemarks` keeps one record per printed line in the general Remarks run (2-line exemption, 3-line fleet note, wrapped PCF reason, CDC attestation). Apply D63 there too? | Exec |
