# NAT Ruleset — Revision Ledger

**File Standard:** `RPT-NAT-RevisionLedger-NEW-20261120-v1.0.md` (first ledger of this module in the repository)
**Module:** `nat-rules` — file `rules/nat-rules/nat-rules-v1.2.0.js` (manifest key `nat-rules`; `nat-rules-next` until step 5e-1, O-79)
**Current Version:** 1.2.0 (built into the app at step 5e-1, D77)
**Contents:** `parseNatTrack()` for NavBlue / eOFP (v1.1.0 verbatim + O-65) and FlightKeys track messages (O-57 … O-67, D74); `levelText()`
**QA Status:** TC-173-001 … 090 PASS; independent QA pending
**Last Updated:** 2026-11-20

---

## Summary

| Metric | Value |
|:-------|:------|
| Total entries | 1 (N-01) |
| Current Version | 1.2.0 |
| Sources | `src/nat.html` v1.1.0 (built into `index.html`); FlightKeys track messages on 5 of the 26 packages; Exec answers O-57 … O-67 (sheet "Scoping Decisions", tab 5d-3, 19 Nov) and D74 |
| Masters reconciled | Drive master "nat-rules" v1.0.0 (Exec's folder "00_General Rulesets") is replaced at 5e; not read or written in this PR (O-63) |
| Gate Status | pending Exec gate and independent QA |
| Integration | **built in** by the switch PR (step 5e-1 PR 2, D77; TC-174): `build/build.js` inserts it just above `src/nat.html`, which binds `window.parseNatTrack = NatRules.parseNatTrack` and keeps `renderNatTrack` unchanged; the v1.1.0 parser left `src/nat.html` (frozen copy `test/oracle/nat-v1.1.0.html`, O-79). NavBlue: the 26 `fl` lines (O-65 / D83) on the app path, nothing else. `ofp-flightkeys` v1.0.0 passes `{ filed, findings }` (O-68); its NAT findings reach the crew on the Preflight card (O-76, O-88). Module file unchanged (SHA-256 `a0ed2a31…a80d`) |

---

## History

### N-01 — v1.2.0 (2026-11-20)

| | |
|:--|:--|
| Change | New module file. NavBlue / eOFP path: v1.1.0 lines 59–184 verbatim; one edit (O-65): a gapped level list is posted as is. FlightKeys path: one track message → the NavBlue `natTrack` shape (letter, waypoints, posted levels, validity `MM/DD-HHMM`, remarks with line breaks, direction, TMI); filed letter passed in (O-57); letter not in the message → WARN, no track marked (O-59); random route → INFO (O-61); no validity check (O-60); no raw fallback. |
| NavBlue output | 30 fixtures: 26 `fl` lines changed (gapped lists), nothing else; ELLX-KHSV stays `null` (O-66). |
| FlightKeys output | 5 packages, 6 messages, 42 tracks, 36 short coordinates converted. `ofp-flightkeys` v0.4.0 unchanged: the 5 NAT packages differ in `natTrack` only. |
| Tests | `test/rules/nat-rules.test.js` (TC-173-001 … 090); pinned values `expected/nat-rules-v1.2.0/nat.json` in the private fixtures repository |
