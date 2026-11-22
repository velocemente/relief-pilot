# ADR-005 — Appendix B addendum 6: the advisory-rules result (volcanic ash, RAIM, volcanic FIR items)

| Field | Value |
| :---- | :---- |
| **Extends** | ADR-005 Modular OFP Platform v1.0, §2.1 (module catalogue) and Appendix B; addendum 5 (contract 2.5, the input) |
| **Status** | Written 2026-11-22 for `advisory-rules` v1.0.0 (step 5f module PR B). Exec answers **O-169 … O-181** (22 Nov), D88, D115, D116 |
| **Contract** | The OFP contract is unchanged (2.5). This addendum adds a **shared rules engine** to the module catalogue and fixes the shape of its result, which the app reads in `parseOFP()` after the format parser (O-173 option A) |
| **Source** | SPEC `rules/advisory-rules/SPEC-AdvisoryRules-NEW-20261122-v1.0.0.md` |

## Module catalogue entry

| Module | Kind | Input | Output | Key / file |
| :--- | :--- | :--- | :--- | :--- |
| Advisory rules | shared rules engine (D88), both formats | the format parser's contract object (`volcanicAsh`, `ofpRemarks[]`, `firNotams[]`, `hazards[]`; missing → empty, D118) | the result below | `advisory-rules-next` (not built in, D90) → `advisory-rules` at integration |

## Result of `evaluateAdvisories(ofp)`

| Key | Content |
| :--- | :--- |
| `volcanicAsh` | `{ state, page, advisories[], remarks[], noted, routing }` — `state` as the parser's page (`null` / `NONE` / `ADVISORY` / `UNREADABLE`); `advisories[]` `{ index, volcano, vaac, number, remarks[] }` (linked remark indexes into `ofpRemarks`); `remarks[]` every VA remark `{ index, text, page, line, polarity POSITIVE | NEGATIVE, terms, advisories[] }`; `noted` an advisory with a linked remark (D116); `routing` a positive remark with no linked advisory (O-177) |
| `raim` | `{ passed, records[], attention[] }` — `passed` a PASSED form printed (O-171: then `attention` is `[]`); `records[]` every `raim` remark `{ index, text, page, line, passed }`; `attention[]` `{ text, page, line }` (D115) |
| `volcanicFir` | `{ notams[], hazards[], notamFirs[], hazardFirs[] }` — flagged FIR NOTAM items `{ fir, name, block, item, id, origin, terms }` and hazard blocks `{ fir, name, index, vaSigmets, terms }`; the FIR codes whose groups the display opens (O-180) |
| `openOfpRemarks` | `true` when a positive VA remark or a RAIM attention record is present (O-179) |
| `findings[]` | the crew WARNs for OFP Alerts, `{ level: 'WARN', field: 'volcanicAsh', code, message }`, at most one per code: `VA-ADVISORY-REMARK` `VOLCANIC ASH ADVISORY FOR THIS FLIGHT – SEE OFP REMARKS AND THE VA PAGE ON THE OFP TAB`; `VA-REMARK-ROUTING` `VOLCANIC ASH ROUTING IN OFP REMARKS – CHECK ROUTE` (O-178). None for RAIM (O-171) |

`null` when the input is not an object. The input is never changed. NavBlue: the empty result (D118).
