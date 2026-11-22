# Advisory Rules — Revision Ledger

**File Standard:** `RPT-AdvisoryRules-RevisionLedger-NEW-20261122-v1.0.md` (first ledger of this module)
**Module:** `advisory-rules` — next: `rules/advisory-rules-next/advisory-rules-v1.0.0.js` (key `advisory-rules-next`, not built in, D90, D96); the integration PR moves it to `rules/advisory-rules/` (key `advisory-rules`)
**Current Version:** 1.0.0 (step 5f module PR B; not built in until its integration PR)
**Contents:** `evaluateAdvisories()`: volcanic ash (O-169, O-170, O-177, O-178, D116), RAIM (O-171, D115), volcanic FIR item / hazard flags (O-180), the OFP Remarks flag (O-179)
**QA Status:** TC-181 16/16 PASS on the 26 FlightKeys fixtures and synthetic cases; independent QA: CHANGES-REQUESTED (F-02), fix round 1 applied, re-QA pending
**Last Updated:** 2026-11-22

---

## Summary

| Metric | Value |
|:-------|:------|
| Total entries | 1 (A-01) |
| Current Version | 1.0.0 (next, not built in) |
| Sources | Exec answers O-169 … O-181 (sheet "Scoping Decisions", tab 5f, clarified 22 Nov); D115, D116, D88; ofp-flightkeys v1.1.0 (module PR A, contract 2.5, addendum 5) |
| Masters reconciled | none yet — published to a new subfolder of the Exec's Drive folder "00_General Rulesets" after its own QA, before its integration PR (O-173 addition: the Exec confirms the folder; CLAUDE.md rule 14); it must be byte-identical to `rules/advisory-rules-next/advisory-rules-v1.0.0.js` (SHA-256 in `rules/manifest.json`) |
| Gate Status | pending independent QA and Exec gate |
| Integration | **not built in** (D90): module PR A (ofp-flightkeys v1.1.0), this module PR B, then the integration and display PR |

---

## History

### A-01 — v1.0.0: first version (step 5f module PR B) (2026-11-22)

**Type:** NEW · **Brief:** step 5f module PR B (Exec answers O-169 … O-181; D115, D116, D88, D90, D96, D99, D103, D118, D87) · not built in (D90)
- **Volcanic ash (SPEC §3):** closed VA term list (`VA` capitals; `VOLCANO(ES)`, `VOLCANIC`, `ASH`, `ASHTAM`, `ERUPTION(S)`, `VAAC` any case; whole words); closed negative list (`NO VA ACTIVITY AFFECTING FLIGHT`); a remark is negative when no VA term is left after the negative forms are taken out. Advisory = `volcanicAsh.state` ADVISORY; linked by volcano name from a positive remark. WARNs (O-178, exact): advisory + linked remark → `VOLCANIC ASH ADVISORY FOR THIS FLIGHT – SEE OFP REMARKS AND THE VA PAGE ON THE OFP TAB`; positive remark with no linked advisory → `VOLCANIC ASH ROUTING IN OFP REMARKS – CHECK ROUTE`; advisory with no remark → nothing (O-170).
- **RAIM (§4):** RAIM remarks = `raim` records and remarks flagged `raim: true` (QA F-01); any PASSED form → no attention output (only that: no remark, field or VA result is hidden); else one attention record per RAIM remark, as printed; no OFP Alerts line (O-171).
- **Fix round 1 (QA F-02):** the VA scan reads every remark whatever its category (RAIM records included); `VA_SKIPPED_CATEGORIES` removed. On the 26 every result is unchanged (only the pinned module SHA-256s change).
- **Volcanic FIR items (§5, O-180):** FIR NOTAM items and hazard blocks with a VA term flagged ("no ash cloud" too); FIR codes for the groups to open.
- **OFP Remarks flag (§6, O-179):** positive VA remark or RAIM attention.
- **On the 26 (TC-181-010, 011):** 1 advisory (L02, no remark → nothing), 25 none; L03 positive → routing WARN (the only WARN); L14 negative; 24 volcanic FIR items in 10 packages; L15 WAAF hazard with 4 VA SIGMETs; 27 RAIM records, all PASSED → 0 attention; the OFP Remarks flag on L03 only. NavBlue: empty on 30/30 (TC-181-050).
- **Tests:** TC-181-001 … 005, 010, 011, 015, 020, 021 (QA F-02), 030, 031 (QA F-01), 040, 050, 051, 090 (`test/rules/advisory-rules.test.js`, 16 tests). Pinned: fixtures `expected/advisory-rules-v1.0.0/results.json` (exporter `test/corpus/advisory-v100-expected-export.js`).
- **Wiring:** manifest key `advisory-rules-next`, declared in `test/lib/not-built-in.js`. `index.html`, `src/`, `build/`, `sw.js`, `manifest.json` (1.10.0) and every other module unchanged.
